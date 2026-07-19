import crypto from 'node:crypto';
import { validateArtifactCohortV2, type BuildArtifactCohortV2 } from './build-artifact-cohort.ts';
import {
  validateArtifactQualificationReceipt,
  type ArtifactQualificationReceiptV1,
} from './artifact-qualification-receipt.ts';
import {
  appendQualificationAttemptEvent,
  appendReleaseMutationAttemptEvent,
  assertStableReleaseSessionInvariants,
  blockFullAddonAtDeadline,
  transitionStableReleaseSession,
  type ReleaseMutationAttempt,
  type StableReleaseSession,
} from './stable-release-session.ts';
import {
  validateQualificationAttemptReceipt,
  type QualificationAttemptReceiptV1,
} from './qualification-attempt-receipt.ts';
import {
  buildReleaseMutationBrokerLedgerLookup,
  validateHistoricalReleaseMutationAcceptanceReceipt,
  validateReleaseMutationBrokerLedgerRecord,
  validateReleaseMutationBrokerLedgerLookupResult,
  type ReleaseMutationAcceptanceReceiptV1,
  type ReleaseMutationBrokerLedgerLookupV1,
  type ReleaseMutationBrokerLedgerRecordV1,
  type ReleaseMutationBrokerLedgerLookupResultV1,
  type ReleaseMutationBrokerRequestV1,
} from './release-mutation-broker.ts';
import { readReleaseBrokerAuthority, type ReleaseBrokerAuthorityV1 } from './release-broker-authority.ts';
import { validateFullAddonReceipt, type FullAddonReceiptV1 } from './full-addon-receipt.ts';

type ArtifactKind = 'standard' | 'full';
type RemoteRun = {
  databaseId: string;
  status: string;
  conclusion: string | null;
  runAttempt: number;
  workflow: string;
  controllerWorkflowSha: string;
  mutationAttemptId: string;
  identityErrors?: string[];
  headBranch: string;
  event: string;
  createdAt?: string;
  url?: string | null;
};
type EvidenceFile<T> = { value: T; ref: string; sha256: string };

class StandardReconcileDeadlineBlocked extends Error {}

export type QualificationReconcileProvider = {
  readRun(runId: string, attempt: ReleaseMutationAttempt): RemoteRun | null;
  discoverAdminRuns?(attempt: ReleaseMutationAttempt): RemoteRun[];
  readBrokerRecord(lookup: ReleaseMutationBrokerLedgerLookupV1): ReleaseMutationBrokerLedgerLookupResultV1 | unknown;
  readBuildManifest?(artifactKind: ArtifactKind, sourceRunId: string): EvidenceFile<BuildArtifactCohortV2> | null;
  readStrictQualificationReceipt?(artifactKind: ArtifactKind, qualificationRunId: string): EvidenceFile<ArtifactQualificationReceiptV1> | null;
  readSmokeSummary?(artifactKind: ArtifactKind, qualificationRunId: string): EvidenceFile<Record<string, unknown>> | null;
  readFullAddonReceipt?(runId: string): EvidenceFile<FullAddonReceiptV1> | null;
  readAttemptReceipt(
    artifactKind: ArtifactKind,
    runId: string,
  ): { receipt: QualificationAttemptReceiptV1; ref: string; sha256?: string } | null;
};

function terminalMutationState(state: string): boolean {
  return ['succeeded', 'failed', 'cancelled'].includes(state);
}

function terminalQualificationState(state: string): boolean {
  return ['passed', 'failed', 'cancelled'].includes(state);
}

function sha256Json(value: unknown): string {
  return crypto.createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex');
}

function requestFromAttempt(
  session: StableReleaseSession,
  attempt: ReleaseMutationAttempt,
  receipt: ReleaseMutationAcceptanceReceiptV1,
): ReleaseMutationBrokerRequestV1 | null {
  if (!attempt.mutation_payload) return null;
  return {
    schema: 'opl_app_release_mutation_broker_request.v1',
    stable_session_id: session.id,
    release_cohort_ref: session.cohort_plan.operator_plan_ref,
    operator_actor: receipt.lease.operator_actor,
    attempt_id: attempt.attempt_id,
    planned_session_revision: attempt.planned_session_revision,
    mutation: attempt.mutation,
    workflow: attempt.workflow,
    artifact_kind: attempt.artifact_kind,
    controller_workflow_sha: attempt.controller_workflow_sha,
    artifact_app_sha: attempt.artifact_app_sha,
    mutation_payload: attempt.mutation_payload,
    mutation_payload_sha256: attempt.mutation_payload_sha256,
    idempotency: {
      key: `${session.repo}:stable:${session.version}`,
      channel: 'stable',
      version: session.version,
      same_attempt_returns_same_receipt: true,
      conflicting_session_or_cohort_rejected: true,
      concurrent_different_attempt_rejected: true,
    },
    credential_isolation_receipt: receipt.credential_isolation_receipt,
    github: {
      repository: session.repo,
      operation: attempt.mutation === 'workflow_cancel' ? 'workflow_cancel' : 'workflow_dispatch',
      workflow_ref: attempt.mutation === 'workflow_cancel' ? null : 'refs/heads/main',
      target_run_id: attempt.mutation === 'workflow_cancel' ? attempt.dispatch_fence.target_run_id : null,
    },
  };
}

function validateBrokerRequestAgainstAttempt(
  session: StableReleaseSession,
  attempt: ReleaseMutationAttempt,
  request: ReleaseMutationBrokerRequestV1,
  acceptance: ReleaseMutationAcceptanceReceiptV1,
): string[] {
  const expectedRequest = requestFromAttempt(session, attempt, acceptance);
  if (!expectedRequest) return ['local projection lacks the exact mutation payload needed to validate broker admission'];
  const errors: string[] = [];
  for (const field of [
    'stable_session_id', 'release_cohort_ref', 'operator_actor', 'attempt_id', 'planned_session_revision',
    'mutation', 'workflow', 'artifact_kind', 'controller_workflow_sha', 'artifact_app_sha',
    'mutation_payload_sha256',
  ] as const) {
    if (request[field] !== expectedRequest[field]) errors.push(`broker ledger request ${field} does not match the durable attempt`);
  }
  if (JSON.stringify(request.mutation_payload) !== JSON.stringify(expectedRequest.mutation_payload)) {
    errors.push('broker ledger request mutation payload does not match the durable attempt');
  }
  if (JSON.stringify(request.github) !== JSON.stringify(expectedRequest.github)) {
    errors.push('broker ledger GitHub operation does not match the durable attempt');
  }
  return errors;
}

function recordBrokerLookupObservation(
  session: StableReleaseSession,
  attemptId: string,
  observation: {
    status: 'found' | 'not_found' | 'outcome_unknown';
    observedAt: string;
    ledgerGeneration: number;
    versionAggregateRevision: number;
    latestMutationHeadRevision: number;
    completeThroughSequence: number;
    authorityEpoch: number;
  },
): { session: StableReleaseSession; errors: string[] } {
  const index = session.mutation_attempts.findIndex((attempt) => attempt.attempt_id === attemptId);
  if (index < 0) return { session, errors: [`broker lookup targets unknown mutation attempt ${attemptId}`] };
  const attempt = session.mutation_attempts[index];
  const previous = attempt.broker_lookup;
  const errors: string[] = [];
  const observedAt = Date.parse(observation.observedAt);
  const previousAt = previous.observed_at ? Date.parse(previous.observed_at) : Number.NEGATIVE_INFINITY;
  if (!Number.isFinite(observedAt) || observedAt < previousAt) {
    errors.push('broker lookup observation timestamp regressed');
  }
  if (previous.last_status === 'found' && observation.status !== 'found') {
    errors.push('signed broker non-found status cannot supersede a previously found durable record');
  }
  if (previous.last_status === 'outcome_unknown' && observation.status === 'not_found') {
    errors.push('signed broker not-found cannot supersede a previously fenced outcome-unknown record');
  }
  if (previous.ledger_generation !== null && observation.ledgerGeneration < previous.ledger_generation) {
    errors.push('signed broker ledger generation regressed');
  }
  if (
    previous.version_aggregate_revision !== null &&
    observation.versionAggregateRevision < previous.version_aggregate_revision
  ) errors.push('signed broker version aggregate revision regressed');
  if (
    previous.latest_mutation_head_revision !== null &&
    observation.latestMutationHeadRevision < previous.latest_mutation_head_revision
  ) errors.push('signed broker latest-mutation-head revision regressed');
  if (
    previous.complete_through_sequence !== null &&
    observation.completeThroughSequence < previous.complete_through_sequence
  ) errors.push('signed broker complete-through sequence regressed');
  if (previous.authority_epoch !== null && observation.authorityEpoch !== previous.authority_epoch) {
    errors.push('signed broker authority epoch changed within a frozen session');
  }
  const negativeGeneration = observation.status === 'not_found'
    ? observation.ledgerGeneration
    : previous.not_found_ledger_generation;
  if (errors.length > 0) return { session, errors };
  const attempts = [...session.mutation_attempts];
  attempts[index] = {
    ...attempt,
    broker_lookup: {
      ...previous,
      last_status: observation.status,
      observed_at: observation.observedAt,
      ledger_generation: observation.ledgerGeneration,
      version_aggregate_revision: observation.versionAggregateRevision,
      latest_mutation_head_revision: observation.latestMutationHeadRevision,
      complete_through_sequence: observation.completeThroughSequence,
      authority_epoch: observation.authorityEpoch,
      not_found_ledger_generation: negativeGeneration,
    },
  };
  const sessionUpdatedAt = new Date(Math.max(Date.parse(session.updated_at), observedAt)).toISOString();
  return { session: { ...session, updated_at: sessionUpdatedAt, mutation_attempts: attempts }, errors: [] };
}

function recoverBrokerAcceptance(
  session: StableReleaseSession,
  attempt: ReleaseMutationAttempt,
  provider: QualificationReconcileProvider,
  authority: ReleaseBrokerAuthorityV1,
  observeAfterRead: () => string,
): {
  session: StableReleaseSession;
  acceptance: ReleaseMutationAcceptanceReceiptV1 | null;
  record: ReleaseMutationBrokerLedgerRecordV1 | null;
  disposition: 'found' | 'not_found' | 'reconcile_pending' | 'invalid';
  reason: string;
  errors: string[];
} {
  const local = session.mutation_acceptances.find((candidate) => candidate.lease.attempt_id === attempt.attempt_id);
  const requestSha256 = attempt.broker_lookup.request_sha256;
  if (!requestSha256) {
    return {
      session, acceptance: null, record: null, disposition: 'reconcile_pending', errors: [],
      reason: 'durable broker request digest is missing; mutation resubmission and GitHub run discovery are forbidden',
    };
  }
  const lookup = buildReleaseMutationBrokerLedgerLookup({
    repository: session.repo,
    version: session.version,
    stableSessionId: session.id,
    releaseCohortRef: session.cohort_plan.operator_plan_ref,
    attemptId: attempt.attempt_id,
    mutationPayloadSha256: attempt.mutation_payload_sha256,
    requestSha256,
  });
  let lookupResult: unknown;
  try {
    lookupResult = provider.readBrokerRecord(lookup);
  } catch (error) {
    observeAfterRead();
    return {
      session, acceptance: null, record: null, disposition: 'reconcile_pending', errors: [],
      reason: `broker durable lookup threw safely: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const observedAt = observeAfterRead();
  if (
    lookupResult && typeof lookupResult === 'object' &&
    (lookupResult as { status?: unknown }).status === 'unavailable'
  ) {
    const unavailable = lookupResult as { status: 'unavailable'; reason?: unknown };
    return {
      session, acceptance: null, record: null, disposition: 'reconcile_pending', errors: [],
      reason: `broker durable lookup is unavailable: ${String(unavailable.reason ?? 'unknown transport failure')}`,
    };
  }
  const priorAuthoritativeStatus = ['found', 'not_found', 'outcome_unknown'].includes(attempt.broker_lookup.last_status)
    ? attempt.broker_lookup.last_status as 'found' | 'not_found' | 'outcome_unknown'
    : undefined;
  const lookupErrors = validateReleaseMutationBrokerLedgerLookupResult(lookupResult, lookup, authority, {
    now: observedAt,
    minimumLedgerGeneration: attempt.broker_lookup.ledger_generation ?? 0,
    minimumVersionAggregateRevision: attempt.broker_lookup.version_aggregate_revision ?? 0,
    minimumLatestHeadRevision: attempt.broker_lookup.latest_mutation_head_revision ?? 0,
    priorAuthoritativeStatus,
  });
  if (lookupErrors.length > 0) {
    return {
      session, acceptance: null, record: null, disposition: 'invalid', errors: lookupErrors,
      reason: 'broker durable lookup result failed validation',
    };
  }
  const result = lookupResult as ReleaseMutationBrokerLedgerLookupResultV1;
  if (result.status === 'not_found') {
    if (local) {
      return {
        session, acceptance: null, record: null, disposition: 'invalid',
        errors: ['signed broker not-found conflicts with a cached local acceptance'],
        reason: 'local acceptance cannot override linearizable broker absence',
      };
    }
    const observed = recordBrokerLookupObservation(session, attempt.attempt_id, {
      status: 'not_found',
      observedAt: result.read_proof.observed_at,
      ledgerGeneration: result.read_proof.ledger_generation,
      versionAggregateRevision: result.read_proof.version_aggregate_revision,
      latestMutationHeadRevision: result.latest_mutation_head.revision,
      completeThroughSequence: result.read_proof.complete_through_sequence,
      authorityEpoch: result.read_proof.authority_epoch,
    });
    return {
      session: observed.session, acceptance: null, record: null,
      disposition: observed.errors.length > 0 ? 'invalid' : 'not_found', errors: observed.errors,
      reason: 'signed broker lookup returned not_found; this observation never authorizes redispatch',
    };
  }
  if (
    attempt.broker_lookup.last_status === 'not_found' && attempt.broker_lookup.observed_at &&
    Date.parse(result.record.recorded_at) <= Date.parse(attempt.broker_lookup.observed_at)
  ) {
    return {
      session, acceptance: null, record: null, disposition: 'invalid',
      errors: ['broker found record predates or equals a prior linearizable not-found observation'],
      reason: 'broker durable lookup ordering validation failed closed',
    };
  }
  if (result.status === 'outcome_unknown') {
    const observed = recordBrokerLookupObservation(session, attempt.attempt_id, {
      status: 'outcome_unknown', observedAt: result.read_proof.observed_at,
      ledgerGeneration: result.read_proof.ledger_generation,
      versionAggregateRevision: result.read_proof.version_aggregate_revision,
      latestMutationHeadRevision: result.latest_mutation_head.revision,
      completeThroughSequence: result.read_proof.complete_through_sequence,
      authorityEpoch: result.read_proof.authority_epoch,
    });
    return {
      session: observed.session, acceptance: null, record: result.record,
      disposition: observed.errors.length > 0 ? 'invalid' : 'reconcile_pending', errors: observed.errors,
      reason: 'signed broker ledger outcome remains unknown; reconcile only and ignore its provisional run projection',
    };
  }
  const record = result.record;
  const acceptance = record.acceptance;
  const request = record.request;
  const errors = [
    ...validateHistoricalReleaseMutationAcceptanceReceipt(acceptance, request, authority),
    ...validateBrokerRequestAgainstAttempt(session, attempt, request, acceptance),
    ...validateReleaseMutationBrokerLedgerRecord(record, lookup, authority),
  ];
  if (local && JSON.stringify(local) !== JSON.stringify(record.acceptance)) {
    errors.push('local acceptance differs from the signed durable broker ledger acceptance');
  }
  if (errors.length > 0) {
    return {
      session, acceptance: null, record: null, disposition: 'invalid', errors,
      reason: 'broker ledger/acceptance validation failed closed',
    };
  }
  const observed = recordBrokerLookupObservation(session, attempt.attempt_id, {
    status: 'found', observedAt: result.read_proof.observed_at,
    ledgerGeneration: result.read_proof.ledger_generation,
    versionAggregateRevision: result.read_proof.version_aggregate_revision,
    latestMutationHeadRevision: result.latest_mutation_head.revision,
    completeThroughSequence: result.read_proof.complete_through_sequence,
    authorityEpoch: result.read_proof.authority_epoch,
  });
  if (observed.errors.length > 0) {
    return {
      session, acceptance: null, record: null, disposition: 'invalid', errors: observed.errors,
      reason: 'broker durable lookup ordering validation failed closed',
    };
  }
  session = observed.session;
  if (local) {
    return {
      session, acceptance, record, disposition: 'found', errors: [],
      reason: 'durable broker record matched the local acceptance',
    };
  }
  return {
    session: {
      ...session,
      mutation_leases: session.mutation_leases.some((lease) => lease.attempt_id === attempt.attempt_id)
        ? session.mutation_leases
        : [...session.mutation_leases, acceptance.lease],
      mutation_acceptances: [...session.mutation_acceptances, acceptance],
    },
    acceptance,
    record,
    disposition: 'found',
    reason: 'durable broker record restored acceptance after a controller crash',
    errors: [],
  };
}

function bindRunProjection(session: StableReleaseSession, attempt: ReleaseMutationAttempt, run: RemoteRun & { id: string }): StableReleaseSession {
  if (attempt.workflow === 'desktop-release.yml') {
    return { ...session, release_run: { id: run.id, url: run.url ?? session.release_run.url, conclusion: run.conclusion } };
  }
  if (attempt.workflow === 'desktop-release-promote.yml') {
    return {
      ...session,
      promotion_run: {
        ...session.promotion_run, id: run.id, url: run.url ?? session.promotion_run.url,
        conclusion: run.conclusion, attempt: run.runAttempt ?? session.promotion_run.attempt,
      },
    };
  }
  if (attempt.workflow === 'desktop-release-full-addon.yml') {
    if (session.addon_tracks.full.deadline_blocker) {
      return {
        ...session,
        addon_tracks: {
          ...session.addon_tracks,
          full: { ...session.addon_tracks.full, run_url: run.url ?? session.addon_tracks.full.run_url },
        },
      };
    }
    return {
      ...session,
      addon_tracks: {
        ...session.addon_tracks,
        full: {
          ...session.addon_tracks.full, run_id: run.id, run_url: run.url ?? session.addon_tracks.full.run_url,
          conclusion: run.conclusion, status: run.status === 'completed' ? session.addon_tracks.full.status : 'running',
        },
      },
    };
  }
  return session;
}

function bindArtifactTrack(
  session: StableReleaseSession,
  artifactKind: ArtifactKind,
  manifest: BuildArtifactCohortV2,
  buildManifestSha256: string,
  qualificationRunId: string,
  evidenceRef: string,
  evidenceSha256: string,
): StableReleaseSession {
  const qualificationRun = {
    ...session.artifact_tracks[artifactKind].qualification_run,
    id: qualificationRunId,
    url: `https://github.com/${session.repo}/actions/runs/${qualificationRunId}`,
    conclusion: 'success',
    artifact_run_id: manifest.actions.run_id,
    artifact_name: manifest.actions.artifact_name,
    artifact_sha256: manifest.artifact.sha256,
    evidence_ref: evidenceRef,
    evidence_sha256: evidenceSha256,
  };
  const next: StableReleaseSession = {
    ...session,
    qualification_run: artifactKind === 'standard' ? qualificationRun : session.qualification_run,
    artifact_tracks: {
      ...session.artifact_tracks,
      [artifactKind]: {
        ...session.artifact_tracks[artifactKind],
        artifact_sha256: manifest.artifact.sha256,
        build_manifest_sha256: buildManifestSha256,
        source_run_id: manifest.actions.run_id,
        source_artifact_name: manifest.actions.artifact_name,
        expectation_semantic_digest: manifest.digests.compiled_expectation_semantic_sha256,
        expectation_probe_digest: manifest.digests.compiled_expectation_probe_sha256,
        qualification_input_manifest_digest: manifest.digests.qualification_input_manifest_sha256,
        full_input_manifest_digest: manifest.digests.full_input_manifest_sha256 ?? null,
        framework_bundled_catalog_digest: manifest.digests.framework_bundled_catalog_sha256 ?? null,
        full_toolchain_observation_receipt_digest: manifest.digests.full_toolchain_observation_receipt_sha256 ?? null,
        qualification_run: qualificationRun,
      },
    },
  };
  return next;
}

export function reconcileStableReleaseSession(
  session: StableReleaseSession,
  provider: QualificationReconcileProvider,
  initialAt = new Date().toISOString(),
  authority = readReleaseBrokerAuthority(),
  clock: () => number = Date.now,
): StableReleaseSession {
  assertStableReleaseSessionInvariants(session);
  if (session.phase === 'addon_train_terminal') return session;
  let reconciled = session;
  let at = initialAt;
  const standardDeadlineAtMs = Date.parse(session.efficiency_policy.standard_admission_deadline_at);
  const observe = (stage: string, runId: string | null, throwWhenBlocked = true): string => {
    const observedAtMs = clock();
    if (!Number.isFinite(observedAtMs)) throw new Error('Stable release reconcile clock returned an invalid timestamp.');
    at = new Date(observedAtMs).toISOString();
    if (
      reconciled.terminal_truth.standard_status === 'in_progress' &&
      (!Number.isFinite(standardDeadlineAtMs) || observedAtMs >= standardDeadlineAtMs)
    ) {
      reconciled = transitionStableReleaseSession(
        reconciled,
        'standard_deadline_blocked',
        `immutable 90-minute Standard admission deadline elapsed during ${stage}`,
        at,
        { stage, run_id: runId },
      );
      if (throwWhenBlocked) throw new StandardReconcileDeadlineBlocked();
    }
    return at;
  };
  const activeRunId = session.promotion_run.id ?? session.qualification_run.id ?? session.release_run.id;
  try {
    const entryWasDeadlineBlocked = reconciled.phase === 'standard_deadline_blocked';
    observe('reconcile_entry', activeRunId, false);
    if (!entryWasDeadlineBlocked && reconciled.phase === 'standard_deadline_blocked') return reconciled;

  const durableMutations = new Map<string, {
    acceptance: ReleaseMutationAcceptanceReceiptV1;
    record: ReleaseMutationBrokerLedgerRecordV1;
  }>();
  const adminMutationRuns = new Map<string, string>();
  const runObservations = new Map<string, RemoteRun | null>();
  const readRunOnce = (runId: string, attempt: ReleaseMutationAttempt): RemoteRun | null => {
    if (!runObservations.has(runId)) {
      let observation: RemoteRun | null;
      try {
        observation = provider.readRun(runId, attempt);
      } finally {
        observe(`run_readback:${attempt.workflow}`, runId);
      }
      runObservations.set(runId, observation);
    }
    return runObservations.get(runId) ?? null;
  };
  const readEvidence = <T>(stage: string, runId: string, reader: () => T): T => {
    try {
      return reader();
    } finally {
      observe(stage, runId);
    }
  };
  const fullAbsorbing = () => reconciled.addon_tracks.full.status === 'blocked_with_debt';
  const remoteIdentityErrors = (runId: string, attempt: ReleaseMutationAttempt, remote: RemoteRun): string[] => {
    const expectedRunNameAttempt = attempt.mutation === 'workflow_cancel'
      ? attempt.dispatch_fence.target_attempt_id
      : attempt.attempt_id;
    return [
      ...(remote.identityErrors ?? []),
      remote.databaseId !== runId ? 'run database id does not match the signed exact run' : null,
      remote.runAttempt !== 1 ? 'run attempt is not 1' : null,
      remote.workflow !== attempt.workflow ? 'workflow does not match the durable attempt' : null,
      remote.controllerWorkflowSha.toLowerCase() !== attempt.controller_workflow_sha.toLowerCase()
        ? 'controller workflow SHA does not match the durable attempt'
        : null,
      remote.mutationAttemptId !== expectedRunNameAttempt ? 'workflow run-name does not bind the durable attempt' : null,
      remote.headBranch !== attempt.dispatch_fence.workflow_head_branch ? 'workflow branch is not the durable canonical branch' : null,
      remote.event !== 'workflow_dispatch' ? 'workflow event is not workflow_dispatch' : null,
    ].filter((error): error is string => Boolean(error));
  };
  for (const snapshot of reconciled.mutation_attempts) {
    const attempt = reconciled.mutation_attempts.find((entry) => entry.attempt_id === snapshot.attempt_id)!;
    if (attempt.artifact_kind === 'full' && fullAbsorbing()) continue;
    let latest = attempt.events.at(-1)!;
    const locallyTerminal = terminalMutationState(latest.state);
    if (attempt.admission_mode === 'admin_one_shot_controller') {
      if (
        !['desktop_release_dispatch', 'promotion_dispatch'].includes(attempt.mutation) ||
        !['desktop-release.yml', 'desktop-release-promote.yml'].includes(attempt.workflow)
      ) {
        reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
          at, state: 'ambiguous', run_id: null,
          reason: 'admin one-shot attempt is outside the exact Standard release/promotion allowlist',
        });
        continue;
      }
      if (!provider.discoverAdminRuns) {
        if (!locallyTerminal && latest.state !== 'acceptance_pending_visibility') {
          reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
            at, state: 'acceptance_pending_visibility', run_id: null,
            reason: 'admin one-shot run discovery is unavailable; reconcile only and never redispatch',
          });
        }
        continue;
      }
      let candidates: RemoteRun[];
      try {
        candidates = provider.discoverAdminRuns(attempt);
      } catch (error) {
        const reason = `admin one-shot discovery unavailable: ${error instanceof Error ? error.message : String(error)}; ` +
          'reconcile only and never redispatch';
        if (!locallyTerminal && (latest.state !== 'acceptance_pending_visibility' || latest.reason !== reason || latest.run_id !== null)) {
          reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
            at, state: 'acceptance_pending_visibility', run_id: null, reason,
          });
        }
        continue;
      } finally {
        observe(`admin_run_discovery:${attempt.workflow}`, latest.run_id);
      }
      if (candidates.length === 0) {
        if (locallyTerminal) throw new Error(`Terminal admin one-shot attempt ${attempt.attempt_id} has no exact GitHub run.`);
        if (latest.state !== 'acceptance_pending_visibility' || latest.run_id !== null) {
          reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
            at, state: 'acceptance_pending_visibility', run_id: null,
            reason: 'admin one-shot dispatch is not yet visible; reconcile only and never redispatch',
          });
        }
        continue;
      }
      if (candidates.length !== 1) {
        if (locallyTerminal) throw new Error(`Terminal admin one-shot attempt ${attempt.attempt_id} is ambiguous.`);
        reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
          at, state: 'ambiguous', run_id: null,
          reason: `admin one-shot attempt matched ${candidates.length} GitHub runs; never redispatch`,
        });
        continue;
      }
      const remote = candidates[0]!;
      const runId = remote.databaseId;
      const createdAtMs = Date.parse(String(remote.createdAt));
      const identityErrors = remoteIdentityErrors(runId, attempt, remote);
      if (!Number.isFinite(createdAtMs) || createdAtMs < Date.parse(attempt.dispatch_fence.earliest_created_at)) {
        identityErrors.push('workflow creation time predates the durable dispatch fence');
      }
      if (attempt.dispatch_fence.prior_run_ids.includes(runId)) identityErrors.push('workflow run predates this admin attempt');
      if (identityErrors.length > 0) {
        if (locallyTerminal) {
          throw new Error(`Terminal admin one-shot attempt ${attempt.attempt_id} failed exact identity: ${identityErrors.join('; ')}`);
        }
        reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
          at, state: 'ambiguous', run_id: null,
          reason: `admin one-shot GitHub identity failed closed: ${identityErrors.join('; ')}`,
        });
        continue;
      }
      adminMutationRuns.set(attempt.attempt_id, runId);
      reconciled = bindRunProjection(reconciled, attempt, { ...remote, id: runId });
      if (remote.status !== 'completed') {
        if (locallyTerminal) throw new Error(`Terminal admin one-shot attempt ${attempt.attempt_id} has nonterminal GitHub readback.`);
        if (latest.state !== 'running' || latest.run_id !== runId) {
          reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
            at, state: 'running', run_id: runId,
            reason: `exact admin one-shot workflow remains ${remote.status}`,
          });
        }
        continue;
      }
      const terminalState = remote.conclusion === 'success'
        ? 'succeeded'
        : remote.conclusion === 'cancelled' ? 'cancelled' : 'failed';
      if (locallyTerminal) {
        if (latest.state !== terminalState || latest.run_id !== runId) {
          throw new Error(`Terminal admin one-shot attempt ${attempt.attempt_id} conflicts with exact GitHub terminal truth.`);
        }
      } else {
        reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
          at, state: terminalState, run_id: runId,
          reason: `exact admin one-shot workflow concluded ${remote.conclusion ?? 'failure'}`,
        });
      }
      continue;
    }
    const recovered = recoverBrokerAcceptance(
      reconciled,
      attempt,
      provider,
      authority,
      () => observe(`broker_lookup:${attempt.mutation}`, latest.run_id ?? attempt.dispatch_fence.target_run_id),
    );
    reconciled = recovered.session;
    const acceptance = recovered.acceptance;
    if (acceptance && attempt.mutation === 'full_addon_dispatch') {
      const deadlineAt = acceptance.full_addon_deadline_at;
      const deadlineAtMs = Date.parse(String(deadlineAt));
      if (!deadlineAt || !Number.isFinite(deadlineAtMs) || new Date(deadlineAtMs).toISOString() !== deadlineAt) {
        throw new Error(`Full add-on acceptance ${attempt.attempt_id} lacks a valid signed deadline.`);
      }
      const existingDeadline = reconciled.addon_tracks.full.deadline_at;
      if (existingDeadline && existingDeadline !== deadlineAt) {
        throw new Error(`Full add-on acceptance ${attempt.attempt_id} conflicts with the durable deadline.`);
      }
      reconciled = {
        ...reconciled,
        addon_tracks: {
          ...reconciled.addon_tracks,
          full: {
            ...reconciled.addon_tracks.full,
            run_id: acceptance.github.run_id,
            deadline_at: deadlineAt,
          },
        },
      };
    }
    if (locallyTerminal) {
      if (recovered.disposition !== 'found' || !acceptance || !recovered.record) {
        throw new Error(
          `Terminal mutation attempt ${attempt.attempt_id} failed durable broker revalidation: ` +
          `${recovered.errors.join('; ') || recovered.reason}`,
        );
      }
      const expectedLedgerState = latest.state === 'succeeded'
        ? 'terminal_succeeded'
        : latest.state === 'failed' ? 'terminal_failed' : 'terminal_cancelled';
      if (recovered.record.mutation_state !== expectedLedgerState) {
        throw new Error(
          `Terminal mutation attempt ${attempt.attempt_id} claims ${latest.state} but durable broker ledger is ` +
          `${recovered.record.mutation_state}.`,
        );
      }
      if (latest.run_id !== recovered.record.exact_run_id || acceptance.github.run_id !== recovered.record.exact_run_id) {
        throw new Error(`Terminal mutation attempt ${attempt.attempt_id} exact run identity differs from the durable broker ledger.`);
      }
      durableMutations.set(attempt.attempt_id, { acceptance, record: recovered.record });
      continue;
    }
    if (recovered.disposition !== 'found' || !acceptance || !recovered.record) {
      const state = recovered.disposition === 'invalid' ? 'ambiguous' : 'reconcile_pending';
      const reason = recovered.errors.length > 0
        ? `broker durable lookup failed closed: ${recovered.errors.join('; ')}`
        : recovered.reason;
      if (latest.state !== state || latest.reason !== reason || latest.run_id !== null) {
        reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
          at, state, run_id: null, reason,
        });
      }
      continue;
    }

    const acceptedRunId = acceptance?.github.run_id ?? null;
    if (acceptedRunId && latest.run_id && acceptedRunId !== latest.run_id) {
      reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
        at, state: 'ambiguous', run_id: null,
        reason: `signed broker run ${acceptedRunId} conflicts with local projection run ${latest.run_id}`,
      });
      continue;
    }
    const runId = acceptedRunId;
    if (!runId) {
      reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
        at, state: 'ambiguous', run_id: null,
        reason: 'validated broker record lacks an exact run id; GitHub discovery is forbidden',
      });
      continue;
    }

    if (latest.run_id === null) {
      reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
        at, state: 'acceptance_pending_visibility', run_id: runId,
        reason: 'signed durable broker record restored the exact run identity; GitHub readback remains pending',
      });
      latest = reconciled.mutation_attempts.find((entry) => entry.attempt_id === attempt.attempt_id)!.events.at(-1)!;
    }
    const remote = readRunOnce(runId, attempt);
    if (!remote) continue;
    const identityErrors = remoteIdentityErrors(runId, attempt, remote);
    if (identityErrors.length > 0) {
      reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
        at, state: 'ambiguous', run_id: null,
        reason: `exact broker run failed GitHub identity readback: ${identityErrors.join('; ')}`,
      });
      continue;
    }
    durableMutations.set(attempt.attempt_id, { acceptance, record: recovered.record });
    const observedRun = { ...remote, id: runId };
    reconciled = bindRunProjection(reconciled, attempt, observedRun);
    if (remote.status !== 'completed') {
      if (latest.state !== 'running' || latest.run_id !== runId) {
        reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
          at, state: 'running', run_id: runId, reason: `broker-attributed remote workflow remains ${remote.status}`,
        });
      }
      continue;
    }
    const conclusion = remote.conclusion || 'failure';
    const acceptedCancel = attempt.mutation === 'workflow_cancel' &&
      acceptance?.github.operation === 'workflow_cancel' &&
      attempt.dispatch_fence.target_run_id === runId;
    const acceptedDispatch = attempt.mutation !== 'workflow_cancel' && Boolean(acceptance);
    const terminalState = acceptedCancel && conclusion === 'cancelled'
      ? 'succeeded'
      : conclusion === 'success' ? 'succeeded' : conclusion === 'cancelled' ? 'cancelled' : 'failed';
    const expectedLedgerState = terminalState === 'succeeded'
      ? 'terminal_succeeded'
      : terminalState === 'cancelled' ? 'terminal_cancelled' : 'terminal_failed';
    if (recovered.record.mutation_state !== expectedLedgerState) {
      reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
        at, state: 'reconcile_pending', run_id: runId,
        reason: `remote workflow is ${conclusion} but durable broker ledger remains ${recovered.record.mutation_state}`,
      });
      continue;
    }
    reconciled = appendReleaseMutationAttemptEvent(reconciled, attempt.attempt_id, {
      at,
      state: terminalState,
      run_id: runId,
      reason: acceptedCancel && conclusion === 'cancelled'
        ? 'signed emergency cancel acceptance and exact target remote cancellation reconciled'
        : !acceptance
          ? `remote workflow concluded ${conclusion} without a valid broker acceptance; mutation attribution is blocked`
          : `broker-attributed remote workflow concluded ${conclusion}`,
    });
    if (acceptedCancel && conclusion === 'cancelled' && attempt.dispatch_fence.target_attempt_id) {
      const target = reconciled.mutation_attempts.find((candidate) => candidate.attempt_id === attempt.dispatch_fence.target_attempt_id);
      const targetLatest = target?.events.at(-1);
      const targetDurable = durableMutations.get(attempt.dispatch_fence.target_attempt_id);
      if (
        target && targetLatest && !terminalMutationState(targetLatest.state) &&
        targetDurable?.record.mutation_state === 'terminal_cancelled' &&
        targetDurable.record.exact_run_id === runId
      ) {
        reconciled = appendReleaseMutationAttemptEvent(reconciled, target.attempt_id, {
          at, state: 'cancelled', run_id: runId,
          reason: `broker-confirmed emergency cancel reached terminal readback through ${attempt.attempt_id}`,
        });
      }
    }
  }

  const fullTrack = reconciled.addon_tracks.full;
  if (
    !fullAbsorbing() && fullTrack.run_id && fullTrack.deadline_at && !fullTrack.deadline_blocker &&
    fullTrack.status !== 'qualified' && Date.parse(at) >= Date.parse(fullTrack.deadline_at)
  ) {
    const fullAcceptance = reconciled.mutation_acceptances.find((acceptance) =>
      acceptance.pre_api_fence.request.mutation === 'full_addon_dispatch' && acceptance.github.run_id === fullTrack.run_id
    );
    if (!fullAcceptance) {
      throw new Error('Full add-on deadline elapsed without its exact durable broker acceptance.');
    }
    const observed = runObservations.get(fullTrack.run_id);
    reconciled = blockFullAddonAtDeadline(reconciled, {
      acceptanceAttemptId: fullAcceptance.lease.attempt_id,
      runId: fullTrack.run_id,
      deadlineAt: fullTrack.deadline_at,
      observedAtMs: Date.parse(at),
      remoteStatus: observed?.status ?? 'unknown',
    });
  }

  for (const artifactKind of ['standard', 'full'] as const) {
    if (artifactKind === 'full' && (fullAbsorbing() || reconciled.addon_tracks.full.deadline_blocker)) continue;
    for (const snapshot of reconciled.artifact_tracks[artifactKind].attempts) {
      const attempt = reconciled.artifact_tracks[artifactKind].attempts.find((entry) => entry.attempt_id === snapshot.attempt_id)!;
      const latest = attempt.events.at(-1)!;
      const locallyTerminal = terminalQualificationState(latest.state);
      const mutation = attempt.mutation_attempt_id
        ? reconciled.mutation_attempts.find((entry) => entry.attempt_id === attempt.mutation_attempt_id)
        : null;
      const durableMutation = mutation ? durableMutations.get(mutation.attempt_id) ?? null : null;
      const adminRunId = mutation ? adminMutationRuns.get(mutation.attempt_id) ?? null : null;
      const mutationAcceptance = durableMutation?.acceptance ?? null;
      const mutationLatest = mutation?.events.at(-1);
      const acceptedRunId = mutationAcceptance?.github.run_id ?? adminRunId;
      const projectedRunIds = [latest.run_id, mutationLatest?.run_id].filter((value): value is string => Boolean(value));
      if (acceptedRunId && projectedRunIds.some((value) => value !== acceptedRunId)) {
        if (locallyTerminal) {
          throw new Error(`Terminal ${artifactKind} qualification ${attempt.attempt_id} conflicts with durable exact run ${acceptedRunId}.`);
        }
        reconciled = appendQualificationAttemptEvent(reconciled, artifactKind, attempt.attempt_id, {
          at, state: 'ambiguous', run_id: null, conclusion: 'run_identity_conflict', failure_taxonomy: 'operator',
          remote_receipt_ref: null, retry_disposition: 'reconcile_only',
          retry_reason: `signed broker run ${acceptedRunId} conflicts with local qualification projection`,
          reason: 'qualification run identity failed closed on signed acceptance conflict',
        });
        continue;
      }
      if (!mutation || (!durableMutation && !adminRunId)) {
        if (locallyTerminal) {
          throw new Error(
            `Terminal ${artifactKind} qualification ${attempt.attempt_id} lacks a broker record validated in this reconcile pass.`,
          );
        }
        if (mutationLatest?.state === 'ambiguous' || mutationLatest?.state === 'reconcile_pending') {
          reconciled = appendQualificationAttemptEvent(reconciled, artifactKind, attempt.attempt_id, {
            at, state: mutationLatest.state, run_id: null, conclusion: 'run_identity_missing',
            failure_taxonomy: 'operator', remote_receipt_ref: null, retry_disposition: 'reconcile_only',
            retry_reason: mutationLatest.reason,
            reason: 'linked mutation did not pass durable broker validation in this reconcile pass',
          });
        }
        continue;
      }
      const runId = acceptedRunId;
      if (!runId) {
        if (locallyTerminal) {
          throw new Error(`Terminal ${artifactKind} qualification ${attempt.attempt_id} lacks an exact signed run id.`);
        }
        if (
          mutationLatest?.state === 'ambiguous' || mutationLatest?.state === 'dispatch_lost' ||
          mutationLatest?.state === 'reconcile_pending'
        ) {
          reconciled = appendQualificationAttemptEvent(reconciled, artifactKind, attempt.attempt_id, {
            at,
            state: mutationLatest.state === 'ambiguous'
              ? 'ambiguous'
              : mutationLatest.state === 'reconcile_pending'
                ? 'reconcile_pending'
                : 'dispatch_lost',
            run_id: null,
            conclusion: 'run_identity_missing', failure_taxonomy: 'operator', remote_receipt_ref: null,
            retry_disposition: 'reconcile_only', retry_reason: mutationLatest.reason,
            reason: 'linked broker mutation has no attributable workflow run',
          });
        }
        continue;
      }
      if (!locallyTerminal && latest.run_id === null) {
        reconciled = appendQualificationAttemptEvent(reconciled, artifactKind, attempt.attempt_id, {
          at, state: 'dispatching', run_id: runId, conclusion: null, failure_taxonomy: 'none',
          remote_receipt_ref: null, retry_disposition: 'reconcile_only',
          retry_reason: 'signed durable broker record restored the exact qualification run identity',
          reason: 'qualification GitHub readback remains pending',
        });
      }
      const remote = readRunOnce(runId, mutation);
      if (!remote) {
        if (locallyTerminal) throw new Error(`Terminal ${artifactKind} qualification ${attempt.attempt_id} lacks GitHub readback.`);
        continue;
      }
      const identityErrors = remoteIdentityErrors(runId, mutation, remote);
      if (identityErrors.length > 0) {
        if (locallyTerminal) {
          throw new Error(`Terminal ${artifactKind} qualification ${attempt.attempt_id} failed exact run identity: ${identityErrors.join('; ')}`);
        }
        reconciled = appendQualificationAttemptEvent(reconciled, artifactKind, attempt.attempt_id, {
          at, state: 'ambiguous', run_id: null, conclusion: 'run_identity_conflict', failure_taxonomy: 'operator',
          remote_receipt_ref: null, retry_disposition: 'reconcile_only', retry_reason: identityErrors.join('; '),
          reason: 'qualification exact GitHub identity failed closed',
        });
        continue;
      }
      if (remote.status !== 'completed') {
        if (locallyTerminal) {
          throw new Error(`Terminal ${artifactKind} qualification ${attempt.attempt_id} has nonterminal GitHub readback.`);
        }
        if (latest.state !== 'running' || latest.run_id !== runId) {
          reconciled = appendQualificationAttemptEvent(reconciled, artifactKind, attempt.attempt_id, {
            at, state: 'running', run_id: runId, conclusion: null, failure_taxonomy: 'none',
            remote_receipt_ref: null, reason: `broker-attributed qualification workflow remains ${remote.status}`,
          });
        }
        continue;
      }

      const receiptFile = readEvidence(
        `evidence:${artifactKind}:attempt_receipt`,
        runId,
        () => provider.readAttemptReceipt(artifactKind, runId),
      );
      const receipt = receiptFile?.receipt;
      const fullAddonFile = artifactKind === 'full' && provider.readFullAddonReceipt
        ? readEvidence(`evidence:${artifactKind}:addon_receipt`, runId, () => provider.readFullAddonReceipt!(runId))
        : null;
      const sourceRunId = artifactKind === 'full' ? runId : receipt?.identity?.source_artifact_run_id ?? '';
      const manifestFile = sourceRunId && provider.readBuildManifest
        ? readEvidence(`evidence:${artifactKind}:build_manifest`, runId, () => provider.readBuildManifest!(artifactKind, sourceRunId))
        : null;
      const strictFile = provider.readStrictQualificationReceipt
        ? readEvidence(
          `evidence:${artifactKind}:strict_qualification_receipt`,
          runId,
          () => provider.readStrictQualificationReceipt!(artifactKind, runId),
        )
        : null;
      const smokeFile = provider.readSmokeSummary
        ? readEvidence(`evidence:${artifactKind}:smoke_summary`, runId, () => provider.readSmokeSummary!(artifactKind, runId))
        : null;
      const evidenceErrors: string[] = [];
      if (!mutationAcceptance && !adminRunId) evidenceErrors.push('qualification run has no validated admission');
      if (remote.runAttempt !== 1) evidenceErrors.push('qualification workflow run attempt is not 1');
      if (!manifestFile) evidenceErrors.push('build cohort manifest is missing');
      if (!strictFile) evidenceErrors.push('strict qualification receipt is missing');
      if (!smokeFile) evidenceErrors.push('smoke summary is missing');
      if (artifactKind === 'standard' && (!receiptFile || !/^[0-9a-f]{64}$/.test(receiptFile.sha256 ?? ''))) {
        evidenceErrors.push('attempt receipt or its artifact digest is missing');
      }
      if (artifactKind === 'full' && (!fullAddonFile || !/^[0-9a-f]{64}$/.test(fullAddonFile.sha256))) {
        evidenceErrors.push('Full add-on publish receipt or its artifact digest is missing');
      }
      if (manifestFile) {
        evidenceErrors.push(...validateArtifactCohortV2(manifestFile.value, {
          appSha: reconciled.cohort_plan.cohort_lock.app.resolved_sha,
          shellSha: reconciled.cohort_plan.cohort_lock.shell.resolved_sha,
          frameworkSha: reconciled.cohort_plan.cohort_lock.framework.resolved_sha,
          version: reconciled.version,
          actionsRunId: sourceRunId,
          stableSessionId: reconciled.id,
          releaseCohortRef: reconciled.cohort_plan.operator_plan_ref,
        }));
        if (manifestFile.value.build.kind !== artifactKind) evidenceErrors.push('build cohort artifact kind does not match qualification track');
        if (manifestFile.sha256 !== sha256Json(manifestFile.value)) evidenceErrors.push('build cohort manifest bytes digest is invalid');
      }
      if (artifactKind === 'standard' && receipt && manifestFile) {
        evidenceErrors.push(...validateQualificationAttemptReceipt(receipt, {
          stableSessionId: reconciled.id,
          releaseCohortRef: reconciled.cohort_plan.operator_plan_ref,
          artifactKind,
          qualificationRunId: runId,
          qualificationRunAttempt: '1',
          sourceArtifactRunId: manifestFile.value.actions.run_id,
          sourceArtifactName: manifestFile.value.actions.artifact_name,
          artifactSha256: manifestFile.value.artifact.sha256,
          manifestSha256: manifestFile.sha256,
          semanticDigest: manifestFile.value.digests.compiled_expectation_semantic_sha256,
          probeDigest: manifestFile.value.digests.compiled_expectation_probe_sha256,
          qualificationInputManifestDigest: manifestFile.value.digests.qualification_input_manifest_sha256,
          observedAt: at,
        }));
      }
      if (artifactKind === 'full' && fullAddonFile && manifestFile) {
        const generation = reconciled.addon_tracks.full.release_set_generation ?? '';
        const manifestDigest = reconciled.addon_tracks.full.release_set_manifest_digest ?? '';
        evidenceErrors.push(...validateFullAddonReceipt(fullAddonFile.value, {
          version: reconciled.version,
          stableSessionId: reconciled.id,
          releaseCohortRef: reconciled.cohort_plan.operator_plan_ref,
          appSha: reconciled.cohort_plan.cohort_lock.app.resolved_sha,
          shellSha: reconciled.cohort_plan.cohort_lock.shell.resolved_sha,
          frameworkSha: reconciled.cohort_plan.cohort_lock.framework.resolved_sha,
          runId,
          releaseSetGeneration: generation,
          releaseSetManifestDigest: manifestDigest,
          qualificationInputManifestDigest: manifestFile.value.digests.qualification_input_manifest_sha256,
          fullInputManifestDigest: manifestFile.value.digests.full_input_manifest_sha256 ?? '',
          frameworkBundledCatalogDigest: manifestFile.value.digests.framework_bundled_catalog_sha256 ?? '',
          fullToolchainObservationReceiptDigest: manifestFile.value.digests.full_toolchain_observation_receipt_sha256 ?? '',
        }));
      }
      if (strictFile && manifestFile && smokeFile) {
        const scope = attempt.verification_harness?.scope_proof;
        evidenceErrors.push(...validateArtifactQualificationReceipt(strictFile.value, {
          stableSessionId: reconciled.id,
          releaseCohortRef: reconciled.cohort_plan.operator_plan_ref,
          version: reconciled.version,
          packageProfile: artifactKind,
          result: 'passed',
          qualificationRunId: runId,
          sourceArtifactRunId: manifestFile.value.actions.run_id,
          sourceArtifactName: manifestFile.value.actions.artifact_name,
          artifactSha256: manifestFile.value.artifact.sha256,
          appSha: reconciled.cohort_plan.cohort_lock.app.resolved_sha,
          shellSha: reconciled.cohort_plan.cohort_lock.shell.resolved_sha,
          frameworkSha: reconciled.cohort_plan.cohort_lock.framework.resolved_sha,
          verificationAppSha: attempt.verification_harness?.app_sha,
          verificationShellSha: attempt.verification_harness?.shell_sha,
          verificationScopeProof: scope ?? undefined,
          qualificationInputManifestDigest: manifestFile.value.digests.qualification_input_manifest_sha256,
          fullInputManifestDigest: manifestFile.value.digests.full_input_manifest_sha256,
          frameworkBundledCatalogDigest: manifestFile.value.digests.framework_bundled_catalog_sha256,
          fullToolchainObservationReceiptDigest: manifestFile.value.digests.full_toolchain_observation_receipt_sha256,
        }));
        if (strictFile.value.build_manifest.sha256 !== manifestFile.sha256) evidenceErrors.push('strict receipt does not bind the downloaded manifest bytes');
        if (strictFile.value.smoke_summary.sha256 !== smokeFile.sha256) evidenceErrors.push('strict receipt does not bind the downloaded smoke summary bytes');
        if (artifactKind === 'standard' && receipt?.evidence.strict_qualification_receipt_sha256 !== strictFile.sha256) {
          evidenceErrors.push('attempt receipt does not bind the downloaded strict receipt bytes');
        }
        if (artifactKind === 'standard' && receipt?.evidence.smoke_summary_sha256 !== smokeFile.sha256) {
          evidenceErrors.push('attempt receipt does not bind the downloaded smoke summary bytes');
        }
      }

      const conclusion = remote.conclusion || 'failure';
      const cancelled = conclusion === 'cancelled';
      const authorityReceiptPassed = artifactKind === 'full'
        ? fullAddonFile?.value.status === 'verified'
        : receipt?.status === 'passed';
      const authorityReceiptPresent = artifactKind === 'full' ? Boolean(fullAddonFile) : Boolean(receipt);
      const terminalEvidence = artifactKind === 'full' ? fullAddonFile : receiptFile;
      const passed = conclusion === 'success' && authorityReceiptPassed && evidenceErrors.length === 0;
      const reconciledState = passed ? 'passed' : cancelled ? 'cancelled' : authorityReceiptPresent && evidenceErrors.length === 0 ? 'failed' : 'runner_lost';
      if (locallyTerminal) {
        if (latest.state !== reconciledState || latest.run_id !== runId || latest.conclusion !== conclusion) {
          throw new Error(
            `Terminal ${artifactKind} qualification ${attempt.attempt_id} does not match revalidated broker/run/evidence truth ` +
            `(${reconciledState}, ${runId}, ${conclusion}).`,
          );
        }
        if (latest.state === 'passed' && (
          latest.remote_receipt_ref !== terminalEvidence?.ref || latest.remote_receipt_sha256 !== terminalEvidence?.sha256
        )) {
          throw new Error(`Terminal ${artifactKind} qualification ${attempt.attempt_id} receipt binding changed.`);
        }
        continue;
      }
      if (passed && manifestFile && terminalEvidence && strictFile) {
        observe(`evidence:${artifactKind}:commit`, runId);
        const evidenceSha256 = artifactKind === 'full' ? strictFile.sha256 : terminalEvidence.sha256;
        if (!evidenceSha256) {
          throw new Error(`Passed ${artifactKind} qualification lacks an exact evidence SHA-256.`);
        }
        reconciled = bindArtifactTrack(
          reconciled, artifactKind, manifestFile.value, manifestFile.sha256, runId,
          artifactKind === 'full' ? `opl-first-run-vm-full-${runId}` : terminalEvidence.ref,
          evidenceSha256,
        );
        if (
          artifactKind === 'standard' &&
          (reconciled.phase === 'artifact_build_running' || reconciled.phase === 'retry_failed_gate_same_artifact')
        ) {
          reconciled = transitionStableReleaseSession(
            reconciled,
            'artifacts_qualified',
            'local projection rebuilt from broker acceptance, GitHub execution, and exact qualification evidence',
            at,
          );
        }
      }
      const failureTaxonomy = passed ? 'none' : cancelled ? 'cancelled' : artifactKind === 'standard'
        ? receipt?.failure_taxonomy ?? 'infrastructure'
        : 'infrastructure';
      const remoteReceiptRef = evidenceErrors.length === 0 ? terminalEvidence?.ref ?? null : null;
      const remoteReceiptSha256 = evidenceErrors.length === 0 ? terminalEvidence?.sha256 ?? null : null;
      const retryDisposition = artifactKind === 'standard' ? receipt?.retry.disposition ?? 'reconcile_only' : 'reconcile_only';
      const retryReason = artifactKind === 'standard' ? receipt?.retry.reason ?? evidenceErrors.join('; ') : evidenceErrors.join('; ');
      const scopeProof = artifactKind === 'standard' ? receipt?.evidence.scope_proof ?? null : null;
      const observationReason = passed
        ? artifactKind === 'full'
          ? 'broker acceptance, signed deadline, GitHub attempt 1, manifest, strict receipt, smoke summary, and Full publish receipt reconciled'
          : 'broker acceptance, GitHub attempt 1, manifest, strict receipt, smoke summary, and attempt receipt reconciled'
        : `qualification evidence failed closed: ${evidenceErrors.join('; ') || `remote conclusion ${conclusion}`}`;
      const currentLatest = reconciled.artifact_tracks[artifactKind].attempts
        .find((candidate) => candidate.attempt_id === attempt.attempt_id)!.events.at(-1)!;
      const observationUnchanged =
        currentLatest.state === reconciledState && currentLatest.run_id === runId && currentLatest.conclusion === conclusion &&
        currentLatest.failure_taxonomy === failureTaxonomy && currentLatest.remote_receipt_ref === remoteReceiptRef &&
        (currentLatest.remote_receipt_sha256 ?? null) === remoteReceiptSha256 &&
        (currentLatest.retry_disposition ?? null) === retryDisposition && (currentLatest.retry_reason ?? null) === retryReason &&
        JSON.stringify(currentLatest.scope_proof ?? null) === JSON.stringify(scopeProof) && currentLatest.reason === observationReason;
      if (!observationUnchanged) reconciled = appendQualificationAttemptEvent(reconciled, artifactKind, attempt.attempt_id, {
        at,
        state: reconciledState,
        run_id: runId,
        conclusion,
        failure_taxonomy: failureTaxonomy,
        remote_receipt_ref: remoteReceiptRef,
        remote_receipt_sha256: remoteReceiptSha256,
        retry_disposition: retryDisposition,
        retry_reason: retryReason,
        scope_proof: scopeProof,
        reason: observationReason,
      });
      if (artifactKind === 'full' && passed && fullAddonFile) {
        reconciled = {
          ...reconciled,
          addon_tracks: {
            ...reconciled.addon_tracks,
            full: {
              ...reconciled.addon_tracks.full,
              status: 'qualified',
              run_id: runId,
              run_url: remote.url ?? reconciled.addon_tracks.full.run_url,
              conclusion,
              receipt_ref: fullAddonFile.ref,
              receipt_sha256: fullAddonFile.sha256,
            },
          },
        };
        const webui = reconciled.addon_tracks.webui;
        const webuiTerminal = !webui.required || ['verified', 'blocked_with_debt'].includes(webui.status);
        if (webuiTerminal) {
          reconciled = {
            ...reconciled,
            terminal_truth: {
              ...reconciled.terminal_truth,
              addon_status: webui.status === 'blocked_with_debt' ? 'blocked_with_debt' : 'terminal',
            },
          };
          if (reconciled.phase === 'standard_stable_terminal') {
            reconciled = transitionStableReleaseSession(
              reconciled,
              'addon_train_terminal',
              'Full add-on terminal truth rebuilt from broker, deadline, GitHub, and exact receipt evidence',
              at,
            );
          }
        }
      }
    }
  }
  observe('reconcile_commit', activeRunId);
  assertStableReleaseSessionInvariants(reconciled);
  return reconciled;
  } catch (error) {
    if (error instanceof StandardReconcileDeadlineBlocked) {
      assertStableReleaseSessionInvariants(reconciled);
      return reconciled;
    }
    throw error;
  }
}
