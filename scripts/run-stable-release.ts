#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { parseArgs as parseNodeArgs } from 'node:util';
import {
  buildReleaseCohortPlan,
  parseReleaseCohortPlanArgs,
  type ReleaseCohortPlan,
  type ReleaseCohortPlanOptions,
} from './plan-release-cohort.ts';
import { sha256File, validateArtifactCohortV2, type BuildArtifactCohortV2 } from './build-artifact-cohort.ts';
import { validateArtifactQualificationReceipt, type ArtifactQualificationReceiptV1 } from './artifact-qualification-receipt.ts';
import {
  buildQualificationHarnessScopeProof,
  inspectQualificationHarnessScope,
  validateQualificationHarnessScopeProof,
  type QualificationHarnessScopeProof,
} from './qualification-harness-scope.ts';
import {
  validateLocalActivationReceipt,
  validatePromotionSagaReceipt,
  type PromotionSagaReceiptV2,
} from './release-saga-receipts.ts';
import {
  encodeReleaseSessionLease,
  validateReleaseSessionLease,
  type ReleaseMutation,
  type ReleaseSessionLeaseV2,
} from './release-session-lease.ts';
import type { QualificationAttemptReceiptV1 } from './qualification-attempt-receipt.ts';
import { validateQualificationAttemptReceipt } from './qualification-attempt-receipt.ts';
import {
  appendStableReleaseEfficiencyAdvisory,
  applyPromotionCheckpointReadback,
  blockFullAddonAtDeadline,
  appendQualificationAttempt,
  appendQualificationAttemptEvent,
  appendReleaseMutationAttemptEvent,
  buildStableReleaseSession,
  createStableReleaseSessionAtomic as createSession,
  exactHistoricalPromotionRecoveryChain,
  promotionCheckpointReceiptsFromJobs,
  promotionMutationPayloadCheckpointCompatible,
  planReleaseMutationAttempt,
  recoverStaleStableReleaseSessionLock,
  readStableReleaseSession as readSession,
  transitionStableReleaseSession,
  writeStableReleaseSessionAtomic as writeSession,
  type QualificationArtifactKind,
  type PromotionWorkflowJob,
  type StableReleaseSession,
} from './stable-release-session.ts';
import { reconcileStableReleaseSession } from './stable-release-reconcile.ts';
import {
  readReleaseBrokerAuthority,
  readValidatedCredentialIsolationReceipt,
  resolveHistoricalReleaseBrokerAuthority,
  validateReleaseBrokerAuthority,
} from './release-broker-authority.ts';
import { validateFullAddonReceipt, type FullAddonReceiptV1 } from './full-addon-receipt.ts';
import { validateAddonDebtReceipt } from './addon-debt-receipt.ts';
import {
  releaseMutationPayloadSha256,
  type ReleaseMutationPayload,
} from './release-mutation-payload.ts';
import {
  externalReleaseMutationBroker,
  externalReleaseMutationBrokerLedgerLookup,
  releaseMutationBrokerRequestSha256,
  validateHistoricalReleaseMutationAcceptanceReceipt,
  validateReleaseMutationAcceptanceReceipt,
  validateReleaseMutationBrokerRequest,
  type ReleaseMutationAcceptanceReceiptV1,
  type ReleaseMutationBroker,
  type ReleaseMutationBrokerRequestV1,
} from './release-mutation-broker.ts';
export { buildStableReleaseSession, transitionStableReleaseSession } from './stable-release-session.ts';
export type { StableReleaseSession } from './stable-release-session.ts';

const defaultRepo = 'gaofeng21cn/one-person-lab-app';
const releaseTransportTimeoutCapMs = 30_000;

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
};

export type StableReleaseCommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string; timeoutMs?: number },
) => CommandResult;

export type StartOptions = {
  execute: boolean;
  watch: boolean;
  repo: string;
  statePath: string;
  cohort: ReleaseCohortPlanOptions;
};

type PromoteOptions = {
  execute: boolean;
  watch: boolean;
  repo: string;
  statePath: string;
  ownerReceiptRef: string;
  releaseSetGeneration: string;
};

type ResumeOptions = { statePath: string; execute: boolean };
type ReconcileOptions = { statePath: string };
type RecoverStaleLockOptions = { statePath: string; sessionId: string; revision: number };
type CancelOptions = { statePath: string; targetRunId: string; reason: string; execute: boolean };
type FullAddonOptions = {
  statePath: string; releaseSetGeneration: string; releaseSetManifestDigest: string;
  execute: boolean; watch: boolean; forceRebuildRuntimeCache: boolean;
};
type AddonDebtOptions = { statePath: string; addon: 'full' | 'webui'; receiptPath: string };
type WorkflowWatchDeadline = {
  kind: 'full_addon';
  deadlineAt: string;
  acceptanceAttemptId: string;
} | {
  kind: 'historical_promotion_recovery';
  deadlineAt: string;
  predecessorAttemptId: string;
};

type RetryQualificationOptions = {
  execute: boolean;
  watch: boolean;
  statePath: string;
  artifactKind: QualificationArtifactKind;
  smokeHarnessAppRef?: string;
  smokeHarnessShellRef?: string;
};

type QualificationVerificationHarness = NonNullable<StableReleaseSession['qualification_run']['verification_harness']>;

type CompleteLocalOptions = { statePath: string; receiptPath: string; localAuthorizationPolicyPath: string };

function run(command: string, args: string[], options: { cwd?: string; timeoutMs?: number } = {}): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
    timeout: options.timeoutMs,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    timedOut: (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT',
  };
}

function now(): string {
  return new Date().toISOString();
}

export function formatCommandFailure(result: CommandResult, label: string): string {
  const detail = result.stdout.trim() || result.stderr.trim() || `${label} failed`;
  return `${label}: ${detail}`;
}

function failResult(result: CommandResult, label: string): never {
  throw new Error(formatCommandFailure(result, label));
}

function admissionDeadlineMs(session: StableReleaseSession): number {
  const deadline = Date.parse(session.efficiency_policy.standard_admission_deadline_at);
  if (!Number.isFinite(deadline)) {
    throw new Error('Stable release session has no valid absolute Standard admission deadline.');
  }
  return deadline;
}

function remainingAdmissionBudgetMs(
  session: StableReleaseSession,
  clock: () => number = Date.now,
): number {
  return admissionDeadlineMs(session) - clock();
}

function boundedReleaseTransportTimeoutMs(
  session: StableReleaseSession,
  label: string,
  clock: () => number = Date.now,
): number {
  if (session.terminal_truth.standard_status === 'terminal') return releaseTransportTimeoutCapMs;
  const remaining = remainingAdmissionBudgetMs(session, clock);
  if (remaining <= 0) {
    throw new Error(
      `${label} cannot start because the immutable 90-minute Standard admission deadline has elapsed; ` +
      'record a typed blocker and do not refresh the budget on resume.',
    );
  }
  return Math.max(1, Math.min(releaseTransportTimeoutCapMs, remaining));
}

function readOnlyReleaseTransportTimeoutMs(): number {
  return releaseTransportTimeoutCapMs;
}

function assertMutationWithinAdmissionDeadline(
  session: StableReleaseSession,
  mutation: ReleaseMutation,
  clock: () => number = Date.now,
): void {
  if (mutation === 'workflow_cancel') return;
  if (mutation === 'full_addon_dispatch' && session.terminal_truth.standard_status === 'terminal') return;
  if (remainingAdmissionBudgetMs(session, clock) <= 0) {
    throw new Error(
      `${mutation} cannot reach broker admission after the immutable 90-minute Standard deadline; ` +
      'only read-only reconcile, exact-run emergency cancel, or a typed blocker may continue.',
    );
  }
}

function standardDeadlineBlockedSession(
  session: StableReleaseSession,
  stage: string,
  runId: string | null,
  observedAtMs: number,
): StableReleaseSession {
  const blockedAtMs = Math.max(observedAtMs, admissionDeadlineMs(session));
  return transitionStableReleaseSession(
    session,
    'standard_deadline_blocked',
    `immutable 90-minute Standard admission deadline elapsed at ${stage}`,
    new Date(blockedAtMs).toISOString(),
    { stage, run_id: runId },
  );
}

function sha256Bytes(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function assertSessionLease(
  session: StableReleaseSession,
  mutation: ReleaseMutation,
  lease: ReleaseSessionLeaseV2,
  binding: {
    attemptId: string;
    workflow: ReleaseSessionLeaseV2['workflow'];
    artifactKind: ReleaseSessionLeaseV2['artifact_kind'];
    controllerWorkflowSha: string;
    artifactAppSha: string;
  },
  at = now(),
  authorityOverride?: ReturnType<typeof readReleaseBrokerAuthority>,
): void {
  const authority = authorityOverride ?? readReleaseBrokerAuthority();
  const authorityErrors = validateReleaseBrokerAuthority(authority);
  if (authorityErrors.length > 0) {
    throw new Error(`Stable release broker authority rejected mutation: ${authorityErrors.join('; ')}`);
  }
  const errors = validateReleaseSessionLease(lease, {
    stableSessionId: session.id,
    releaseCohortRef: session.cohort_plan.operator_plan_ref,
    repository: session.repo,
    operatorActor: lease.operator_actor,
    brokerActor: authority.broker_identity.github_actor,
    mutation,
    ...binding,
    mutationPayloadSha256: lease.mutation_payload_sha256,
    plannedSessionRevision: lease.planned_session_revision,
    now: at,
    issuer: authority.issuer,
    publicKeys: authority.trusted_ed25519_public_keys,
    requireSigned: true,
  });
  if (errors.length > 0) throw new Error(`Stable release mutation lease rejected: ${errors.join('; ')}`);
}

function workflowRef(plan: ReleaseCohortPlan): string {
  const ref = plan.cohort_lock.app.requested_ref;
  if (ref !== 'main') {
    throw new Error(`Stable release workflow verifier must run from canonical main, got cohort ref ${ref}.`);
  }
  return 'main';
}

function mutationPayloadArgs(payload: ReleaseMutationPayload): string[] {
  return Object.entries(payload).flatMap(([key, value]) => ['--field', `${key}=${value}`]);
}

function assertLeasePayload(lease: ReleaseSessionLeaseV2, payload: ReleaseMutationPayload): void {
  const digest = releaseMutationPayloadSha256(payload);
  if (lease.mutation_payload_sha256 !== digest) {
    throw new Error(`Signed mutation payload digest ${lease.mutation_payload_sha256} does not match dispatch payload ${digest}.`);
  }
}

function releaseOperatorActor(): string {
  const actor = readReleaseBrokerAuthority().operator_identity.github_actor;
  if (!/^[A-Za-z0-9-]{1,39}$/.test(actor)) throw new Error('Release operator actor must be an exact GitHub login.');
  return actor;
}

export type AdminOneShotAdmission = {
  schema: 'opl_app_release_admin_one_shot_admission.v1';
  status: 'durable_pre_api_fence';
  admission_mode: 'admin_one_shot_controller';
  persisted_at: string;
  request_sha256: string;
  request: {
    stable_session_id: string;
    release_cohort_ref: string;
    operator_actor: string;
    attempt_id: string;
    planned_session_revision: number;
    mutation: 'desktop_release_dispatch' | 'promotion_dispatch';
    workflow: 'desktop-release.yml' | 'desktop-release-promote.yml';
    artifact_kind: 'standard' | 'promotion';
    controller_workflow_sha: string;
    artifact_app_sha: string;
    mutation_payload: ReleaseMutationPayload;
    mutation_payload_sha256: string;
    github: {
      repository: string;
      operation: 'workflow_dispatch';
      workflow_ref: 'refs/heads/main';
      target_run_id: null;
    };
  };
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
}

function sha256Canonical(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

export function buildAdminOneShotAdmission(
  session: StableReleaseSession,
  attemptId: string,
  payload: ReleaseMutationPayload,
  persistedAt: string,
): AdminOneShotAdmission {
  const attempt = session.mutation_attempts.find((candidate) => candidate.attempt_id === attemptId);
  if (!attempt || !['desktop_release_dispatch', 'promotion_dispatch'].includes(attempt.mutation)) {
    throw new Error('Admin one-shot admission is limited to the Standard release and exact-artifact promotion paths.');
  }
  if (attempt.workflow !== 'desktop-release.yml' && attempt.workflow !== 'desktop-release-promote.yml') {
    throw new Error('Admin one-shot admission workflow is outside the Stable critical path.');
  }
  if (attempt.events.at(-1)?.state !== 'dispatching') {
    throw new Error('Admin one-shot admission requires a durable dispatching fence before GitHub mutation.');
  }
  if (attempt.mutation_payload_sha256 !== releaseMutationPayloadSha256(payload)) {
    throw new Error('Admin one-shot admission payload does not match the durable mutation attempt.');
  }
  const request: AdminOneShotAdmission['request'] = {
    stable_session_id: session.id,
    release_cohort_ref: session.cohort_plan.operator_plan_ref,
    operator_actor: releaseOperatorActor(),
    attempt_id: attempt.attempt_id,
    planned_session_revision: attempt.planned_session_revision,
    mutation: attempt.mutation as AdminOneShotAdmission['request']['mutation'],
    workflow: attempt.workflow as AdminOneShotAdmission['request']['workflow'],
    artifact_kind: attempt.artifact_kind as AdminOneShotAdmission['request']['artifact_kind'],
    controller_workflow_sha: attempt.controller_workflow_sha,
    artifact_app_sha: attempt.artifact_app_sha,
    mutation_payload: payload,
    mutation_payload_sha256: attempt.mutation_payload_sha256,
    github: {
      repository: session.repo,
      operation: 'workflow_dispatch',
      workflow_ref: 'refs/heads/main',
      target_run_id: null,
    },
  };
  return {
    schema: 'opl_app_release_admin_one_shot_admission.v1',
    status: 'durable_pre_api_fence',
    admission_mode: 'admin_one_shot_controller',
    persisted_at: persistedAt,
    request_sha256: sha256Canonical(request),
    request,
  };
}

export function adminOneShotDispatchArgs(
  admission: AdminOneShotAdmission,
  historicalPredecessorAdmission?: AdminOneShotAdmission,
): string[] {
  return [
    'workflow', 'run', admission.request.workflow,
    '--repo', admission.request.github.repository,
    '--ref', 'main',
    '--field', 'release_admission_mode=admin_one_shot_controller',
    '--field', `release_attempt_id=${admission.request.attempt_id}`,
    '--field', `release_mutation_payload_sha256=${admission.request.mutation_payload_sha256}`,
    '--field', `pre_api_admission_receipt_base64=${Buffer.from(JSON.stringify(admission), 'utf8').toString('base64')}`,
    ...(historicalPredecessorAdmission ? [
      '--field',
      `historical_predecessor_admission_receipt_base64=${Buffer.from(JSON.stringify(historicalPredecessorAdmission), 'utf8').toString('base64')}`,
    ] : []),
    ...mutationPayloadArgs(admission.request.mutation_payload),
  ];
}

export function historicalPromotionPredecessorAdmission(
  session: StableReleaseSession,
  ownerReceiptRef: string,
  releaseSetGeneration: string,
  observedAtMs = Date.now(),
): AdminOneShotAdmission | null {
  return historicalPromotionRecoveryContext(
    session, ownerReceiptRef, releaseSetGeneration, observedAtMs,
  )?.predecessorAdmission ?? null;
}

export function historicalPromotionRecoveryContext(
  session: StableReleaseSession,
  ownerReceiptRef: string,
  releaseSetGeneration: string,
  observedAtMs = Date.now(),
  promotionCheckpointReceiptsJson = '[]',
): { predecessorAdmission: AdminOneShotAdmission; priorRunIds: string[] } | null {
  if (remainingStandardAdmissionBudgetMs(session, observedAtMs) > 0) return null;
  if (
    session.phase !== 'promotion_failed' ||
    session.release_owner_receipt_ref !== ownerReceiptRef ||
    session.promotion_progress.release_set_generation !== releaseSetGeneration ||
    session.promotion_run.conclusion !== 'failure' ||
    !session.promotion_run.id
  ) {
    throw new Error('Expired promotion recovery requires the same failed session, owner receipt, and Release Set generation.');
  }
  const predecessor = [...session.mutation_attempts].reverse().find((attempt) =>
    attempt.mutation === 'promotion_dispatch'
  );
  if (!predecessor || predecessor.admission_mode !== 'admin_one_shot_controller') {
    throw new Error('Expired promotion recovery requires a prior admin one-shot promotion admission.');
  }
  const dispatchingEvents = predecessor.events.filter((event) => event.state === 'dispatching');
  const terminal = predecessor.events.at(-1);
  const dispatching = dispatchingEvents[0];
  const deadlineMs = admissionDeadlineMs(session);
  if (
    dispatchingEvents.length !== 1 || !dispatching ||
    !terminal || terminal.state !== 'failed' || terminal.run_id !== session.promotion_run.id ||
    Date.parse(terminal.at) < Date.parse(dispatching.at)
  ) {
    throw new Error('Expired promotion recovery predecessor is not a unique admission with a terminal failed run.');
  }
  const payload = promotionMutationPayload(
    session, ownerReceiptRef, releaseSetGeneration, promotionCheckpointReceiptsJson,
  );
  if (
    !predecessor.mutation_payload ||
    predecessor.mutation_payload_sha256 !== releaseMutationPayloadSha256(predecessor.mutation_payload) ||
    !promotionMutationPayloadCheckpointCompatible(predecessor.mutation_payload, payload) ||
    predecessor.artifact_app_sha !== session.cohort_plan.cohort_lock.app.resolved_sha
  ) {
    throw new Error('Expired promotion recovery predecessor does not bind an exact monotonic checkpoint successor for this artifact cohort.');
  }
  let root = predecessor;
  let priorRunIds = [terminal.run_id];
  if (Date.parse(dispatching.at) >= deadlineMs) {
    const chain = exactHistoricalPromotionRecoveryChain(session, deadlineMs);
    const predecessorCount = predecessor.dispatch_fence.prior_run_ids.length;
    if (predecessorCount < 1 || predecessorCount > 4 || !chain || chain.length !== predecessorCount) {
      throw new Error('Expired promotion recovery permits only the exact root plus at most four failed post-deadline successors.');
    }
    root = chain[0]!;
    priorRunIds = [...predecessor.dispatch_fence.prior_run_ids, terminal.run_id];
  } else if (predecessor.dispatch_fence.prior_run_ids.length !== 0) {
    throw new Error('Expired promotion recovery root must be the unique pre-deadline admission.');
  }
  const rootDispatching = root.events.filter((event) => event.state === 'dispatching');
  if (rootDispatching.length !== 1 || Date.parse(rootDispatching[0]!.at) >= deadlineMs) {
    throw new Error('Expired promotion recovery root is not the unique pre-deadline admission.');
  }
  if (!root.mutation_payload) {
    throw new Error('Expired promotion recovery root lacks its exact original mutation payload.');
  }
  const predecessorAtDispatch = {
    ...session,
    mutation_attempts: session.mutation_attempts.map((attempt) => attempt.attempt_id === root.attempt_id
      ? { ...attempt, events: [rootDispatching[0]!] }
      : attempt),
  };
  return {
    predecessorAdmission: buildAdminOneShotAdmission(
      predecessorAtDispatch,
      root.attempt_id,
      root.mutation_payload,
      rootDispatching[0]!.at,
    ),
    priorRunIds,
  };
}

function exactAcceptedRunId(
  receipt: ReleaseMutationAcceptanceReceiptV1,
  github: ReleaseMutationBrokerRequestV1['github'],
): string {
  const runId = receipt.github.run_id;
  if (!/^[1-9][0-9]*$/.test(runId ?? '')) {
    throw new Error('Release mutation broker acceptance must return an exact numeric GitHub run_id.');
  }
  if (github.operation === 'workflow_cancel' && runId !== github.target_run_id) {
    throw new Error('Release mutation broker cancel acceptance run_id does not match the exact target run.');
  }
  return runId!;
}

export function executeBrokeredReleaseMutation(
  session: StableReleaseSession,
  statePath: string,
  attemptId: string,
  payload: ReleaseMutationPayload,
  github: ReleaseMutationBrokerRequestV1['github'],
  broker: ReleaseMutationBroker = externalReleaseMutationBroker,
  authorityOverride?: ReturnType<typeof readReleaseBrokerAuthority>,
  persist: typeof writeSession = writeSession,
  clock: () => number = Date.now,
): { session: StableReleaseSession; receipt: ReleaseMutationAcceptanceReceiptV1 } {
  const attempt = session.mutation_attempts.find((candidate) => candidate.attempt_id === attemptId);
  if (!attempt) {
    throw new Error(`Release mutation broker requires durable mutation attempt ${attemptId}.`);
  }
  if (attempt.mutation_payload_sha256 !== releaseMutationPayloadSha256(payload)) {
    throw new Error(`Release mutation broker retry payload does not match durable attempt ${attemptId}.`);
  }
  const existingAcceptance = session.mutation_acceptances.find((receipt) => receipt.lease.attempt_id === attemptId);
  const latestAttemptState = attempt.events.at(-1)?.state;
  if (!existingAcceptance && latestAttemptState === 'dispatching') {
    throw new Error(
      `Release mutation attempt ${attemptId} already crossed its durable request fence; ` +
      'use broker ledger reconcile and never resubmit the mutation.',
    );
  }
  if (!existingAcceptance && latestAttemptState !== 'planned') {
    throw new Error(`Release mutation attempt ${attemptId} cannot be submitted from ${String(latestAttemptState)}.`);
  }
  const authority = authorityOverride ?? readReleaseBrokerAuthority();
  const authorityErrors = validateReleaseBrokerAuthority(authority, {
    capability: existingAcceptance ? 'contract_read' : 'mutation_submit',
  });
  if (authorityErrors.length > 0) throw new Error(`Release broker authority is not ready: ${authorityErrors.join('; ')}`);
  const credentialIsolationReceipt = existingAcceptance?.credential_isolation_receipt ??
    readValidatedCredentialIsolationReceipt(authority);
  const request: ReleaseMutationBrokerRequestV1 = {
    schema: 'opl_app_release_mutation_broker_request.v1',
    stable_session_id: session.id,
    release_cohort_ref: session.cohort_plan.operator_plan_ref,
    operator_actor: authority.operator_identity.github_actor,
    attempt_id: attemptId,
    planned_session_revision: attempt.planned_session_revision,
    mutation: attempt.mutation,
    workflow: attempt.workflow,
    artifact_kind: attempt.artifact_kind,
    controller_workflow_sha: attempt.controller_workflow_sha,
    artifact_app_sha: attempt.artifact_app_sha,
    mutation_payload: payload,
    mutation_payload_sha256: attempt.mutation_payload_sha256,
    idempotency: {
      key: `${session.repo}:stable:${session.version}`,
      channel: 'stable',
      version: session.version,
      same_attempt_returns_same_receipt: true,
      conflicting_session_or_cohort_rejected: true,
      concurrent_different_attempt_rejected: true,
    },
    credential_isolation_receipt: credentialIsolationReceipt,
    github,
  };
  const requestSha256 = releaseMutationBrokerRequestSha256(request);
  if (existingAcceptance) {
    const historicalAuthority = resolveHistoricalReleaseBrokerAuthority(
      authority,
      existingAcceptance.pre_api_fence.authority_epoch,
      existingAcceptance.credential_isolation_receipt.authority_sha256,
      existingAcceptance.signature.key_id,
    );
    const historicalErrors = validateHistoricalReleaseMutationAcceptanceReceipt(
      existingAcceptance, request, historicalAuthority,
    );
    if (historicalErrors.length > 0) {
      throw new Error(`Durable broker acceptance is invalid: ${historicalErrors.join('; ')}`);
    }
    exactAcceptedRunId(existingAcceptance, github);
    if (attempt.broker_lookup.request_sha256 !== null && attempt.broker_lookup.request_sha256 !== requestSha256) {
      throw new Error(`Durable broker request digest conflicts with acceptance for attempt ${attemptId}.`);
    }
    return { session, receipt: existingAcceptance };
  }
  try {
    assertMutationWithinAdmissionDeadline(session, attempt.mutation, clock);
  } catch (error) {
    const observedAtMs = clock();
    const blocked = standardDeadlineBlockedSession(
      session,
      `broker_admission:${attempt.mutation}`,
      attempt.events.at(-1)?.run_id ?? attempt.dispatch_fence.target_run_id,
      observedAtMs,
    );
    persist(statePath, blocked);
    throw error;
  }
  if (session.revision !== attempt.planned_session_revision) {
    throw new Error(`Release mutation broker attempt ${attemptId} is not at durable planned revision ${attempt.planned_session_revision}.`);
  }
  const requestObservedAt = new Date(clock()).toISOString();
  const requestErrors = validateReleaseMutationBrokerRequest(request, authority, requestObservedAt);
  if (requestErrors.length > 0) throw new Error(`Release mutation broker request is invalid: ${requestErrors.join('; ')}`);
  session = appendReleaseMutationAttemptEvent(session, attemptId, {
    at: requestObservedAt, state: 'dispatching', run_id: attempt.dispatch_fence.target_run_id,
    reason: 'exact broker request digest persisted before isolated external mutation admission',
  });
  session = {
    ...session,
    mutation_attempts: session.mutation_attempts.map((candidate) => candidate.attempt_id === attemptId ? {
      ...candidate,
      broker_lookup: { ...candidate.broker_lookup, request_sha256: requestSha256 },
    } : candidate),
  };
  persist(statePath, session);
  const receipt = broker(request);
  const responseObservedAtMs = clock();
  const responseObservedAt = new Date(responseObservedAtMs).toISOString();
  const receiptErrors = validateReleaseMutationAcceptanceReceipt(receipt, request, authority, responseObservedAt);
  if (receiptErrors.length > 0) throw new Error(`Release mutation broker returned an invalid acceptance receipt: ${receiptErrors.join('; ')}`);
  const acceptedRunId = exactAcceptedRunId(receipt, github);
  const fullAddonDeadlineAt = attempt.mutation === 'full_addon_dispatch'
    ? receipt.full_addon_deadline_at
    : null;
  if (attempt.mutation === 'full_addon_dispatch') {
    const acceptedAtMs = Date.parse(receipt.accepted_at);
    const deadlineAtMs = Date.parse(String(fullAddonDeadlineAt));
    if (
      !fullAddonDeadlineAt || !Number.isFinite(acceptedAtMs) || !Number.isFinite(deadlineAtMs) ||
      new Date(deadlineAtMs).toISOString() !== fullAddonDeadlineAt ||
      deadlineAtMs !== acceptedAtMs + 50 * 60 * 1_000
    ) {
      throw new Error('Full add-on broker acceptance lacks its exact signed 50-minute deadline.');
    }
  }
  let acceptedSession: StableReleaseSession = {
    ...session,
    mutation_leases: session.mutation_leases.some((lease) => lease.attempt_id === attemptId)
      ? session.mutation_leases
      : [...session.mutation_leases, receipt.lease],
    mutation_acceptances: [...session.mutation_acceptances, receipt],
    mutation_attempts: session.mutation_attempts.map((candidate) => candidate.attempt_id === attemptId ? {
      ...candidate,
      broker_lookup: {
        ...candidate.broker_lookup,
        request_sha256: requestSha256,
      },
    } : candidate),
  };
  if (attempt.workflow === 'desktop-release.yml') {
    acceptedSession.release_run = {
      id: acceptedRunId,
      url: `https://github.com/${session.repo}/actions/runs/${acceptedRunId}`,
      conclusion: null,
    };
  } else if (attempt.workflow === 'desktop-release-promote.yml') {
    acceptedSession.promotion_run = {
      id: acceptedRunId,
      url: `https://github.com/${session.repo}/actions/runs/${acceptedRunId}`,
      conclusion: null,
      attempt: 1,
      rerun_requested_from_attempt: null,
    };
  } else if (attempt.workflow === 'desktop-release-full-addon.yml') {
    acceptedSession.addon_tracks = {
      ...acceptedSession.addon_tracks,
      full: {
        ...acceptedSession.addon_tracks.full,
        status: 'running',
        run_id: acceptedRunId,
        run_url: `https://github.com/${session.repo}/actions/runs/${acceptedRunId}`,
        conclusion: null,
        deadline_at: fullAddonDeadlineAt,
        deadline_blocker: null,
      },
    };
  }
  const standardDeadlineElapsed = attempt.mutation !== 'workflow_cancel' &&
    !(attempt.mutation === 'full_addon_dispatch' && session.terminal_truth.standard_status === 'terminal') &&
    remainingStandardAdmissionBudgetMs(session, responseObservedAtMs) <= 0;
  if (standardDeadlineElapsed) {
    acceptedSession = standardDeadlineBlockedSession(
      acceptedSession,
      `broker_response:${attempt.mutation}`,
      acceptedRunId,
      responseObservedAtMs,
    );
    acceptedSession = appendReleaseMutationAttemptEvent(acceptedSession, attemptId, {
      at: responseObservedAt,
      state: 'acceptance_pending_visibility',
      run_id: acceptedRunId,
      reason: `signed broker accepted exact workflow run ${acceptedRunId} after the immutable Standard deadline; late acceptance is durable but cannot advance success`,
    });
    for (const artifactKind of ['standard', 'full'] as const) {
      const qualificationAttempt = acceptedSession.artifact_tracks[artifactKind].attempts.find(
        (candidate) => candidate.mutation_attempt_id === attemptId,
      );
      if (qualificationAttempt) {
        acceptedSession = appendQualificationAttemptEvent(acceptedSession, artifactKind, qualificationAttempt.attempt_id, {
          at: responseObservedAt,
          state: 'dispatching',
          run_id: acceptedRunId,
          conclusion: null,
          failure_taxonomy: 'operator',
          remote_receipt_ref: null,
          retry_disposition: 'reconcile_only',
          retry_reason: 'broker acceptance returned after the immutable Standard deadline',
          reason: 'exact late broker acceptance is preserved for read-only reconcile or emergency cancel only',
        });
      }
    }
    persist(statePath, acceptedSession);
    throw new Error(
      `${attempt.mutation} was accepted as exact run ${acceptedRunId} after the immutable 90-minute Standard deadline; ` +
      'the acceptance and typed blocker are durable, and only read-only reconcile or emergency cancel may continue.',
    );
  }
  acceptedSession = { ...acceptedSession, updated_at: responseObservedAt };
  acceptedSession = appendReleaseMutationAttemptEvent(acceptedSession, attemptId, {
    at: responseObservedAt,
    state: attempt.mutation === 'workflow_cancel' ? 'running' : 'acceptance_pending_visibility',
    run_id: acceptedRunId,
    reason: attempt.mutation === 'workflow_cancel'
      ? `signed broker accepted exact emergency cancel target ${acceptedRunId}`
      : `signed broker accepted exact workflow run ${acceptedRunId}; GitHub identity readback remains pending`,
  });
  persist(statePath, acceptedSession);
  return { receipt, session: acceptedSession };
}

export function desktopReleaseMutationPayload(session: StableReleaseSession): ReleaseMutationPayload {
  const plan = session.cohort_plan;
  return {
    opl_version: plan.version, release_mode: plan.release_mode, release_intent: plan.release_intent,
    full_omission_reason: plan.full_omission_reason ?? '', release_operator_plan_ref: plan.operator_plan_ref,
    stable_session_id: session.id,
    standard_admission_deadline_at: session.efficiency_policy.standard_admission_deadline_at,
    gate_reuse_plan_ref: plan.gate_reuse_plan_ref ?? '',
    include_full_package: String(plan.include_full_package), run_vm_smoke: String(plan.run_vm_smoke),
    publish_docker_webui: String(plan.publish_docker_webui), defer_addons: 'true',
    shell_ref: plan.cohort_lock.shell.resolved_sha,
    framework_ref: plan.cohort_lock.framework.resolved_sha,
    artifact_app_sha: plan.cohort_lock.app.resolved_sha,
    operator_actor: releaseOperatorActor(),
  };
}

export function qualificationMutationPayload(
  session: StableReleaseSession,
  verificationHarness: QualificationVerificationHarness,
  artifactKind: QualificationArtifactKind,
): ReleaseMutationPayload {
  const track = session.artifact_tracks[artifactKind];
  return {
    release_tag: `v${session.version}`, package_profile: artifactKind, diagnostic_scope: 'release_gate',
    release_artifact_name: track.source_artifact_name ?? '', release_artifact_run_id: track.source_run_id ?? '',
    stable_session_id: session.id,
    standard_admission_deadline_at: session.efficiency_policy.standard_admission_deadline_at,
    release_cohort_ref: session.cohort_plan.operator_plan_ref,
    artifact_app_ref: session.cohort_plan.cohort_lock.app.resolved_sha,
    shell_ref: session.cohort_plan.cohort_lock.shell.resolved_sha,
    smoke_harness_ref: verificationHarness.shell_sha,
    framework_ref: session.cohort_plan.cohort_lock.framework.resolved_sha,
    operator_actor: releaseOperatorActor(),
  };
}

export function promotionMutationPayload(
  session: StableReleaseSession,
  ownerReceiptRef: string,
  releaseSetGeneration: string,
  promotionCheckpointReceiptsJson = '[]',
): ReleaseMutationPayload {
  return {
    opl_version: session.version, release_set_generation: releaseSetGeneration,
    release_run_id: session.release_run.id ?? '', stable_session_id: session.id,
    standard_admission_deadline_at: session.efficiency_policy.standard_admission_deadline_at,
    release_cohort_ref: session.cohort_plan.operator_plan_ref,
    artifact_app_sha: session.cohort_plan.cohort_lock.app.resolved_sha,
    standard_vm_run_id: session.artifact_tracks.standard.qualification_run.id ?? '',
    release_owner_receipt_ref: ownerReceiptRef,
    shell_ref: session.cohort_plan.cohort_lock.shell.resolved_sha,
    framework_ref: session.cohort_plan.cohort_lock.framework.resolved_sha,
    resume_from_checkpoint: session.promotion_progress.resume_from_checkpoint,
    ...(promotionCheckpointReceiptsJson === '[]'
      ? {}
      : { promotion_checkpoint_receipts_json: promotionCheckpointReceiptsJson }),
    operator_actor: releaseOperatorActor(),
  };
}

export function fullAddonMutationPayload(
  session: StableReleaseSession,
  releaseSetGeneration: string,
  releaseSetManifestDigest: string,
  forceRebuildRuntimeCache = false,
): ReleaseMutationPayload {
  return {
    opl_version: session.version, stable_session_id: session.id,
    standard_admission_deadline_at: session.efficiency_policy.standard_admission_deadline_at,
    release_cohort_ref: session.cohort_plan.operator_plan_ref,
    app_sha: session.cohort_plan.cohort_lock.app.resolved_sha,
    shell_sha: session.cohort_plan.cohort_lock.shell.resolved_sha,
    framework_sha: session.cohort_plan.cohort_lock.framework.resolved_sha,
    release_set_generation: releaseSetGeneration,
    release_set_manifest_digest: releaseSetManifestDigest,
    force_rebuild_runtime_cache: String(forceRebuildRuntimeCache),
    operator_actor: releaseOperatorActor(),
  };
}

function resolveRemoteGitRefSha(
  runner: StableReleaseCommandRunner,
  repo: string,
  ref: string,
): string {
  if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
  const result = runner('git', [
    'ls-remote',
    `https://github.com/${repo}.git`,
    `refs/heads/${ref}`,
    `refs/tags/${ref}^{}`,
    `refs/tags/${ref}`,
    ref,
  ]);
  if (result.status !== 0) failResult(result, `resolve remote Git ref ${repo}@${ref}`);
  const refs = result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [sha = '', name = ''] = line.trim().split(/\s+/, 2);
    return { sha: sha.toLowerCase(), name };
  });
  const sha = (
    refs.find((candidate) => candidate.name === `refs/tags/${ref}^{}`) ??
    refs.find((candidate) => candidate.name === `refs/heads/${ref}`) ??
    refs.find((candidate) => candidate.name === `refs/tags/${ref}`) ??
    refs[0]
  )?.sha ?? '';
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`Remote Git ref ${repo}@${ref} did not resolve to a 40-character commit SHA.`);
  }
  return sha;
}

export function desktopReleaseDispatchArgs(
  session: StableReleaseSession,
  lease = session.mutation_leases.at(-1),
  authorityOverride?: ReturnType<typeof readReleaseBrokerAuthority>,
): string[] {
  if (!lease) throw new Error('Desktop release dispatch requires a per-attempt broker lease.');
  const payload = desktopReleaseMutationPayload(session);
  assertLeasePayload(lease, payload);
  assertSessionLease(session, 'desktop_release_dispatch', lease, {
    attemptId: lease.attempt_id, workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: lease.controller_workflow_sha,
    artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
  }, now(), authorityOverride);
  return [
    'workflow', 'run', 'desktop-release.yml',
    '--repo', session.repo,
    '--ref', 'main',
    '--field', `release_attempt_id=${lease.attempt_id}`,
    '--field', `release_session_lease_base64=${encodeReleaseSessionLease(lease)}`,
    ...mutationPayloadArgs(payload),
  ];
}

export function qualificationRetryDispatchArgs(
  session: StableReleaseSession,
  verificationHarness: QualificationVerificationHarness = {
    app_ref: workflowRef(session.cohort_plan),
    app_sha: session.cohort_plan.cohort_lock.app.resolved_sha,
    shell_ref: session.cohort_plan.cohort_lock.shell.resolved_sha,
    shell_sha: session.cohort_plan.cohort_lock.shell.resolved_sha,
    scope_proof: buildQualificationHarnessScopeProof({
      artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
      verificationAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
      appChangedPaths: [],
      artifactShellSha: session.cohort_plan.cohort_lock.shell.resolved_sha,
      verificationShellSha: session.cohort_plan.cohort_lock.shell.resolved_sha,
      shellChangedPaths: [],
    }),
  },
  lease = session.mutation_leases.at(-1),
  artifactKind: QualificationArtifactKind = 'standard',
  authorityOverride?: ReturnType<typeof readReleaseBrokerAuthority>,
): string[] {
  if (verificationHarness.app_ref !== 'main') {
    throw new Error('Qualification workflow must execute from canonical main; App harness branches can replace the lease verifier.');
  }
  const scopeErrors = validateQualificationHarnessScopeProof(verificationHarness.scope_proof, {
    artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
    verificationAppSha: verificationHarness.app_sha,
    artifactShellSha: session.cohort_plan.cohort_lock.shell.resolved_sha,
    verificationShellSha: verificationHarness.shell_sha,
  });
  if (scopeErrors.length > 0) {
    throw new Error(`Qualification scope proof is invalid: ${scopeErrors.join('; ')}`);
  }
  if (!verificationHarness.scope_proof.reuse_authorization.allowed) {
    throw new Error(
      `Qualification scope requires a new cohort: ${verificationHarness.scope_proof.reuse_authorization.reason}; ` +
      `forbidden App paths=${verificationHarness.scope_proof.reuse_authorization.forbidden_paths.app.join(',') || '<none>'}; ` +
      `forbidden Shell paths=${verificationHarness.scope_proof.reuse_authorization.forbidden_paths.shell.join(',') || '<none>'}.`,
    );
  }
  if (!lease) throw new Error('Qualification dispatch requires a per-attempt broker lease.');
  const payload = qualificationMutationPayload(session, verificationHarness, artifactKind);
  assertLeasePayload(lease, payload);
  assertSessionLease(session, 'qualification_dispatch', lease, {
    attemptId: lease.attempt_id, workflow: 'opl-first-run-vm.yml', artifactKind,
    controllerWorkflowSha: verificationHarness.app_sha,
    artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
  }, now(), authorityOverride);
  const track = session.artifact_tracks[artifactKind];
  if (!track.source_run_id) throw new Error(`Same-artifact ${artifactKind} qualification retry requires its source run id.`);
  const artifactName = track.source_artifact_name;
  if (!artifactName || !track.artifact_sha256) {
    throw new Error('Same-artifact qualification retry requires a validated artifact manifest in the release session.');
  }
  return [
    'workflow', 'run', 'opl-first-run-vm.yml',
    '--repo', session.repo,
    '--ref', 'main',
    '--field', `release_attempt_id=${lease.attempt_id}`,
    '--field', `release_session_lease_base64=${encodeReleaseSessionLease(lease)}`,
    ...mutationPayloadArgs(payload),
  ];
}

function resolveCanonicalControllerWorkflowSha(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  historicalPromotionRecovery = false,
): string {
  const authority = readReleaseBrokerAuthority();
  const authorityErrors = validateReleaseBrokerAuthority(authority, { requireProvisioned: false });
  if (authorityErrors.length > 0) throw new Error(`Canonical controller authority is invalid: ${authorityErrors.join('; ')}`);
  const ref = authority.canonical_workflow_ref.replace(/^refs\/heads\//, '');
  const result = runner('gh', [
    'api', `repos/${session.repo}/commits/${encodeURIComponent(ref)}`, '--jq', '.sha',
  ], { timeoutMs: historicalPromotionRecovery
    ? readOnlyReleaseTransportTimeoutMs()
    : boundedReleaseTransportTimeoutMs(session, 'canonical controller ref lookup') });
  if (result.status !== 0) failResult(result, `resolve remote App dispatch ref ${ref}`);
  const actual = result.stdout.trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(actual)) throw new Error(`Canonical controller ref ${authority.canonical_workflow_ref} did not resolve to an exact SHA.`);
  return actual;
}

export function promoteDispatchArgs(
  session: StableReleaseSession,
  ownerReceiptRef: string,
  releaseSetGeneration: string,
  lease = session.mutation_leases.at(-1),
  controllerWorkflowSha = lease?.controller_workflow_sha,
  authorityOverride?: ReturnType<typeof readReleaseBrokerAuthority>,
): string[] {
  if (!session.release_run.id) throw new Error('Stable release session has no source release run id.');
  if (!ownerReceiptRef.trim()) throw new Error('Promotion requires a same-cohort release owner receipt ref.');
  if (!/^\d{2}\.\d{1,2}\.\d{1,2}(?:-r[1-9][0-9]*)?$/.test(releaseSetGeneration)) {
    throw new Error('Promotion requires an exact Release Set generation in YY.M.D[-rN] form.');
  }
  const standardVmRunId = session.artifact_tracks.standard.qualification_run.id;
  if (!standardVmRunId || session.artifact_tracks.standard.qualification_run.conclusion !== 'success') {
    throw new Error('Promotion requires a passed Standard exact-artifact qualification run.');
  }
  if (!lease) throw new Error('Promotion dispatch requires a per-attempt broker lease.');
  const payload = promotionMutationPayload(session, ownerReceiptRef, releaseSetGeneration);
  assertLeasePayload(lease, payload);
  assertSessionLease(session, 'promotion_dispatch', lease, {
    attemptId: lease.attempt_id, workflow: 'desktop-release-promote.yml', artifactKind: 'promotion',
    controllerWorkflowSha: controllerWorkflowSha ?? '',
    artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
  }, now(), authorityOverride);
  return [
    'workflow', 'run', 'desktop-release-promote.yml',
    '--repo', session.repo,
    '--ref', workflowRef(session.cohort_plan),
    '--field', `release_attempt_id=${lease.attempt_id}`,
    '--field', `release_session_lease_base64=${encodeReleaseSessionLease(lease)}`,
    ...mutationPayloadArgs(payload),
  ];
}

export function workflowCancelArgs(session: StableReleaseSession, targetRunId: string): string[] {
  if (!/^\d+$/.test(targetRunId)) throw new Error('Emergency cancel target must be an exact workflow run id.');
  return ['run', 'cancel', targetRunId, '--repo', session.repo];
}

export function fullAddonDispatchArgs(
  session: StableReleaseSession,
  releaseSetGeneration: string,
  releaseSetManifestDigest: string,
  forceRebuildRuntimeCache = false,
  lease = session.mutation_leases.at(-1),
  controllerWorkflowSha = lease?.controller_workflow_sha,
  authorityOverride?: ReturnType<typeof readReleaseBrokerAuthority>,
): string[] {
  if (!lease) throw new Error('Full add-on dispatch requires a per-attempt broker lease.');
  const payload = fullAddonMutationPayload(
    session, releaseSetGeneration, releaseSetManifestDigest, forceRebuildRuntimeCache,
  );
  assertLeasePayload(lease, payload);
  if (session.terminal_truth.standard_status !== 'terminal') {
    throw new Error('Full add-on dispatch requires Standard Stable terminal truth.');
  }
  if (!/^\d{2}\.\d{1,2}\.\d{1,2}(?:-r[1-9][0-9]*)?$/.test(releaseSetGeneration)) {
    throw new Error('Full add-on requires an immutable Release Set generation.');
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(releaseSetManifestDigest)) {
    throw new Error('Full add-on requires an immutable Release Set manifest digest.');
  }
  assertSessionLease(session, 'full_addon_dispatch', lease, {
    attemptId: lease.attempt_id, workflow: 'desktop-release-full-addon.yml', artifactKind: 'full',
    controllerWorkflowSha: controllerWorkflowSha ?? '',
    artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
  }, now(), authorityOverride);
  return [
    'workflow', 'run', 'desktop-release-full-addon.yml', '--repo', session.repo, '--ref', 'main',
    '--field', `release_attempt_id=${lease.attempt_id}`,
    '--field', `release_session_lease_base64=${encodeReleaseSessionLease(lease)}`,
    ...mutationPayloadArgs(payload),
  ];
}

type WorkflowRun = {
  databaseId: number;
  attempt?: number;
  createdAt: string;
  headBranch: string;
  headSha: string;
  displayTitle?: string;
  workflowName?: string;
  event?: string;
  status: string;
  conclusion?: string;
  url: string;
};

type WorkflowJob = PromotionWorkflowJob;

function expectedQualificationProfile(artifactKind: QualificationArtifactKind = 'standard'): 'full' | 'standard' {
  return artifactKind;
}

function expectedBuildArtifactName(session: StableReleaseSession, artifactKind: QualificationArtifactKind = 'standard'): string {
  return artifactKind === 'full'
    ? `opl-full-first-install-dmg-${session.version}-mac-arm64`
    : 'macos-build-arm64-dmg';
}

function findFile(root: string, name: string): string | null {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = findFile(candidate, name);
      if (nested) return nested;
    } else if (entry.name === name) {
      return candidate;
    }
  }
  return null;
}

type DownloadedArtifactFile = { path: string; bytes: Buffer; cleanup: () => void };

function downloadArtifactFile(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
  artifactName: string,
  fileName: string,
): DownloadedArtifactFile | null {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-release-artifact-'));
  const result = runner(
    'gh',
    ['run', 'download', runId, '--repo', session.repo, '--name', artifactName, '--dir', root],
    { timeoutMs: boundedReleaseTransportTimeoutMs(session, `download ${artifactName}`) },
  );
  if (result.status !== 0) {
    fs.rmSync(root, { recursive: true, force: true });
    return null;
  }
  const filePath = findFile(root, fileName);
  if (!filePath) {
    fs.rmSync(root, { recursive: true, force: true });
    return null;
  }
  const bytes = fs.readFileSync(filePath);
  return { path: filePath, bytes, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

type ValidatedBuildArtifactManifest = { manifest: BuildArtifactCohortV2; sha256: string };

function readBuildArtifactManifest(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
  artifactKind: QualificationArtifactKind = 'standard',
): ValidatedBuildArtifactManifest | null {
  const artifactName = expectedBuildArtifactName(session, artifactKind);
  const downloaded = downloadArtifactFile(runner, session, runId, `${artifactName}-cohort`, 'opl-build-cohort.json');
  if (!downloaded) return null;
  try {
    const manifest = JSON.parse(downloaded.bytes.toString('utf8')) as BuildArtifactCohortV2;
    const errors = validateArtifactCohortV2(manifest, {
      appSha: session.cohort_plan.cohort_lock.app.resolved_sha,
      shellSha: session.cohort_plan.cohort_lock.shell.resolved_sha,
      frameworkSha: session.cohort_plan.cohort_lock.framework.resolved_sha,
      version: session.version,
      actionsRunId: runId,
      stableSessionId: session.id,
      releaseCohortRef: session.cohort_plan.operator_plan_ref,
    });
    if (errors.length > 0) return null;
    const manifestSha256 = sha256Bytes(downloaded.bytes);
    const track = session.artifact_tracks[artifactKind];
    const frozenErrors = [
      track.source_run_id && track.source_run_id !== manifest.actions.run_id ? 'source run id' : null,
      track.source_artifact_name && track.source_artifact_name !== manifest.actions.artifact_name ? 'source artifact name' : null,
      track.artifact_sha256 && track.artifact_sha256 !== manifest.artifact.sha256 ? 'artifact SHA-256' : null,
      track.build_manifest_sha256 && track.build_manifest_sha256 !== manifestSha256 ? 'build manifest SHA-256' : null,
      track.expectation_semantic_digest && track.expectation_semantic_digest !== manifest.digests.compiled_expectation_semantic_sha256 ? 'semantic expectation digest' : null,
      track.expectation_probe_digest && track.expectation_probe_digest !== manifest.digests.compiled_expectation_probe_sha256 ? 'probe expectation digest' : null,
      track.qualification_input_manifest_digest && track.qualification_input_manifest_digest !== manifest.digests.qualification_input_manifest_sha256 ? 'qualification input manifest digest' : null,
      track.full_input_manifest_digest && track.full_input_manifest_digest !== (manifest.digests.full_input_manifest_sha256 ?? null) ? 'Full input manifest digest' : null,
      track.framework_bundled_catalog_digest && track.framework_bundled_catalog_digest !== (manifest.digests.framework_bundled_catalog_sha256 ?? null) ? 'Framework bundled catalog digest' : null,
      track.full_toolchain_observation_receipt_digest && track.full_toolchain_observation_receipt_digest !== (manifest.digests.full_toolchain_observation_receipt_sha256 ?? null) ? 'Full toolchain receipt digest' : null,
    ].filter(Boolean);
    return frozenErrors.length === 0 ? { manifest, sha256: manifestSha256 } : null;
  } finally {
    downloaded.cleanup();
  }
}

function readQualificationReceipt(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  qualificationRunId: string,
  sourceArtifactRunId: string,
  expectedResult: 'passed' | 'failed',
  artifactKind: QualificationArtifactKind = 'standard',
  expectedManifest: ValidatedBuildArtifactManifest | null = null,
): { receipt: ArtifactQualificationReceiptV1; sha256: string } | null {
  const profile = expectedQualificationProfile(artifactKind);
  const evidenceRef = `opl-first-run-vm-${profile}-${qualificationRunId}`;
  const downloaded = downloadArtifactFile(
    runner,
    session,
    qualificationRunId,
    evidenceRef,
    'artifact-qualification-receipt.json',
  );
  if (!downloaded) return null;
  try {
    const receipt = JSON.parse(downloaded.bytes.toString('utf8')) as ArtifactQualificationReceiptV1;
    const errors = validateArtifactQualificationReceipt(receipt, {
      stableSessionId: session.id,
      releaseCohortRef: session.cohort_plan.operator_plan_ref,
      version: session.version,
      packageProfile: profile,
      result: expectedResult,
      qualificationRunId,
      sourceArtifactRunId,
      sourceArtifactName: expectedManifest?.manifest.actions.artifact_name ?? expectedBuildArtifactName(session, artifactKind),
      appSha: session.cohort_plan.cohort_lock.app.resolved_sha,
      shellSha: session.cohort_plan.cohort_lock.shell.resolved_sha,
      frameworkSha: session.cohort_plan.cohort_lock.framework.resolved_sha,
      verificationAppSha: session.artifact_tracks[artifactKind].qualification_run.verification_harness?.app_sha,
      verificationShellSha: session.artifact_tracks[artifactKind].qualification_run.verification_harness?.shell_sha,
      verificationScopeProof: session.artifact_tracks[artifactKind].qualification_run.verification_harness?.scope_proof,
      artifactSha256: expectedManifest?.manifest.artifact.sha256,
      qualificationInputManifestDigest: expectedManifest?.manifest.digests.qualification_input_manifest_sha256,
      fullInputManifestDigest: expectedManifest?.manifest.digests.full_input_manifest_sha256,
      frameworkBundledCatalogDigest: expectedManifest?.manifest.digests.framework_bundled_catalog_sha256,
      fullToolchainObservationReceiptDigest: expectedManifest?.manifest.digests.full_toolchain_observation_receipt_sha256,
    });
    if (expectedManifest && receipt.build_manifest.sha256 !== expectedManifest.sha256) {
      errors.push('qualification receipt build manifest SHA-256 does not match the frozen manifest bytes');
    }
    const track = session.artifact_tracks[artifactKind];
    if (track.build_manifest_sha256 && receipt.build_manifest.sha256 !== track.build_manifest_sha256) {
      errors.push('qualification receipt build manifest SHA-256 does not match the durable session identity');
    }
    return errors.length === 0 ? { receipt, sha256: sha256Bytes(downloaded.bytes) } : null;
  } finally {
    downloaded.cleanup();
  }
}

function bindQualificationEvidence(
  session: StableReleaseSession,
  validatedManifest: ValidatedBuildArtifactManifest,
  qualificationRunId: string,
  conclusion: 'success' | 'failure',
  evidenceSha256: string | null,
  artifactKind: QualificationArtifactKind = 'standard',
): StableReleaseSession {
  const { manifest } = validatedManifest;
  const profile = expectedQualificationProfile(artifactKind);
  const qualificationRun = {
    ...session.artifact_tracks[artifactKind].qualification_run,
    id: qualificationRunId,
    url: `https://github.com/${session.repo}/actions/runs/${qualificationRunId}`,
    conclusion,
    artifact_run_id: manifest.actions.run_id,
    artifact_name: manifest.actions.artifact_name,
    artifact_sha256: manifest.artifact.sha256,
    evidence_ref: `opl-first-run-vm-${profile}-${qualificationRunId}`,
    evidence_sha256: evidenceSha256,
  };
  return {
    ...session,
    qualification_run: artifactKind === 'standard' ? qualificationRun : session.qualification_run,
    artifact_tracks: {
      ...session.artifact_tracks,
      [artifactKind]: {
        ...session.artifact_tracks[artifactKind],
        artifact_sha256: manifest.artifact.sha256,
        build_manifest_sha256: validatedManifest.sha256,
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
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const workflowNames: Record<ReleaseSessionLeaseV2['workflow'], string> = {
  'desktop-release.yml': 'OPL Desktop Release',
  'opl-first-run-vm.yml': 'OPL GUI First-Run VM',
  'desktop-release-promote.yml': 'OPL Desktop Release Promote',
  'desktop-release-full-addon.yml': 'OPL Desktop Full Add-on',
  'desktop-release-cleanup-drafts.yml': 'OPL Desktop Release Draft Cleanup',
};

export function validateAcceptedWorkflowRunIdentity(
  run: WorkflowRun,
  expected: {
    runId: string;
    attemptId: string;
    workflow: ReleaseSessionLeaseV2['workflow'];
    controllerWorkflowSha: string;
    headBranch?: string;
  },
): string[] {
  const errors: string[] = [];
  if (String(run.databaseId) !== expected.runId) errors.push('GitHub run databaseId does not match broker acceptance');
  if (run.attempt !== 1) errors.push('broker-attributed workflow must be run attempt 1');
  if (run.event !== 'workflow_dispatch') errors.push('broker-attributed workflow event is not workflow_dispatch');
  if (run.workflowName !== workflowNames[expected.workflow]) errors.push('broker-attributed workflow name does not match the mutation');
  if (run.headBranch !== (expected.headBranch ?? 'main')) errors.push('broker-attributed workflow branch is not canonical main');
  if (run.headSha.toLowerCase() !== expected.controllerWorkflowSha.toLowerCase()) {
    errors.push('broker-attributed workflow controller SHA does not match the durable attempt');
  }
  if (!run.displayTitle?.endsWith(` attempt=${expected.attemptId}`)) {
    errors.push('broker-attributed workflow run-name does not end with the exact mutation attempt id');
  }
  return errors;
}

async function awaitAcceptedWorkflowRun(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
  attemptId: string,
  workflow: ReleaseSessionLeaseV2['workflow'],
  controllerWorkflowSha: string,
  expectedBranch = 'main',
  persist: (session: StableReleaseSession) => void,
  deadlinePolicy?: WorkflowWatchDeadline,
  clock: () => number = Date.now,
): Promise<WorkflowRun> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (deadlinePolicy?.kind === 'full_addon' && clock() >= Date.parse(deadlinePolicy.deadlineAt)) {
      const observedAtMs = clock();
      persist(blockFullAddonAtDeadline(session, {
        acceptanceAttemptId: deadlinePolicy.acceptanceAttemptId,
        runId,
        deadlineAt: deadlinePolicy.deadlineAt,
        observedAtMs,
        remoteStatus: 'visibility_pending',
      }));
      throw new Error(
        `Full add-on deadline expired while waiting for exact run ${runId}; ` +
        'the typed add-on debt blocker is durable and Standard remains unchanged.',
      );
    }
    if (
      session.terminal_truth.standard_status !== 'terminal' &&
      remainingStandardAdmissionBudgetMs(session, clock()) <= 0
    ) {
      persist(standardDeadlineBlockedSession(
        session, `run_visibility:${workflow}`, runId, clock(),
      ));
      throw new Error(
        `Standard admission deadline expired while waiting for exact run ${runId}; ` +
        'the typed blocker is durable; reconcile or cancel the exact run without redispatch.',
      );
    }
    const view = runView(runner, session, runId);
    const afterViewMs = clock();
    if (deadlinePolicy?.kind === 'full_addon' && afterViewMs >= Date.parse(deadlinePolicy.deadlineAt)) {
      persist(blockFullAddonAtDeadline(session, {
        acceptanceAttemptId: deadlinePolicy.acceptanceAttemptId,
        runId,
        deadlineAt: deadlinePolicy.deadlineAt,
        observedAtMs: afterViewMs,
        remoteStatus: view.readback?.status ?? 'visibility_pending',
      }));
      throw new Error(
        `Full add-on deadline expired during exact-run ${runId} readback; ` +
        'the typed add-on debt blocker is durable and Standard remains unchanged.',
      );
    }
    if (
      session.terminal_truth.standard_status !== 'terminal' &&
      remainingStandardAdmissionBudgetMs(session, afterViewMs) <= 0
    ) {
      persist(standardDeadlineBlockedSession(
        session, `run_visibility_readback:${workflow}`, runId, afterViewMs,
      ));
      throw new Error(
        `Standard deadline expired during exact-run ${runId} visibility readback; ` +
        'the durable typed blocker preserves the accepted run for reconcile or emergency cancel only.',
      );
    }
    if (view.readback) {
      const errors = validateAcceptedWorkflowRunIdentity(view.readback, {
        runId, attemptId, workflow, controllerWorkflowSha, headBranch: expectedBranch,
      });
      if (errors.length > 0) {
        throw new Error(`Broker-attributed workflow run identity is invalid: ${errors.join('; ')}`);
      }
      return view.readback;
    }
    const remaining = deadlinePolicy?.kind === 'full_addon'
      ? Date.parse(deadlinePolicy.deadlineAt) - clock()
      : remainingAdmissionBudgetMs(session, clock);
    if (remaining <= 0) break;
    await delay(Math.min(3_000, remaining));
  }
  throw new Error(
    `Broker-attributed workflow run ${runId} was not visible within 60 seconds; ` +
    'the exact accepted run remains durable and only reconcile or resume may continue.',
  );
}

async function discoverAdminOneShotRun(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  attemptId: string,
  workflow: 'desktop-release.yml' | 'desktop-release-promote.yml',
  controllerWorkflowSha: string,
  earliestCreatedAt: string,
): Promise<WorkflowRun> {
  for (let observation = 0; observation < 20; observation += 1) {
    const result = runner('gh', [
      'run', 'list', '--repo', session.repo, '--workflow', workflow, '--event', 'workflow_dispatch',
      '--branch', 'main', '--limit', '100',
      '--json', 'databaseId,attempt,createdAt,headBranch,headSha,displayTitle,workflowName,event,status,conclusion,url',
    ], { timeoutMs: readOnlyReleaseTransportTimeoutMs() });
    if (result.status !== 0) failResult(result, `discover admin one-shot ${workflow}`);
    let runs: WorkflowRun[];
    try {
      runs = JSON.parse(result.stdout) as WorkflowRun[];
    } catch (error) {
      throw new Error(`admin one-shot run discovery returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    const candidates = runs.filter((candidate) =>
      candidate.displayTitle?.endsWith(` attempt=${attemptId}`) &&
      candidate.workflowName === workflowNames[workflow] &&
      candidate.event === 'workflow_dispatch' && candidate.attempt === 1 &&
      candidate.headBranch === 'main' &&
      candidate.headSha.toLowerCase() === controllerWorkflowSha.toLowerCase() &&
      Date.parse(candidate.createdAt) >= Date.parse(earliestCreatedAt),
    );
    if (candidates.length > 1) {
      throw new Error(`Admin one-shot attempt ${attemptId} matched multiple workflow runs; mutation is ambiguous and must not be repeated.`);
    }
    if (candidates.length === 1) return candidates[0];
    await delay(3_000);
  }
  throw new Error(
    `Admin one-shot attempt ${attemptId} is not yet visible; the durable dispatching fence forbids redispatch. ` +
    'Use read-only reconcile.',
  );
}

function watchRun(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
  remainingBudgetMs: number,
): CommandResult {
  return runner(
    'gh',
    ['run', 'watch', runId, '--repo', session.repo, '--interval', '60', '--exit-status'],
    { timeoutMs: Math.max(1, remainingBudgetMs) },
  );
}

export function decodeWorkflowRunReadback(
  result: CommandResult,
): { readback: WorkflowRun | null; error: string | null } {
  if (result.status !== 0) {
    return { readback: null, error: formatCommandFailure(result, 'workflow run readback failed') };
  }
  try {
    return { readback: JSON.parse(result.stdout) as WorkflowRun, error: null };
  } catch (error) {
    return {
      readback: null,
      error: `workflow run readback returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function runView(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
  clock: () => number = Date.now,
  transportPolicy: 'admission_deadline' | 'read_only_reconcile' = 'admission_deadline',
): { readback: WorkflowRun | null; error: string | null } {
  const result = runner('gh', [
    'run', 'view', runId, '--repo', session.repo,
    '--json', 'databaseId,attempt,createdAt,headBranch,headSha,displayTitle,workflowName,event,status,conclusion,url',
  ], {
    timeoutMs: transportPolicy === 'read_only_reconcile'
      ? readOnlyReleaseTransportTimeoutMs()
      : boundedReleaseTransportTimeoutMs(session, `read workflow run ${runId}`, clock),
  });
  return decodeWorkflowRunReadback(result);
}

function readQualificationAttemptReceipt(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  artifactKind: QualificationArtifactKind,
  runId: string,
): { receipt: QualificationAttemptReceiptV1; ref: string; sha256: string } | null {
  const ref = `opl-qualification-attempt-${artifactKind}-${runId}`;
  const downloaded = downloadArtifactFile(runner, session, runId, ref, 'qualification-attempt-receipt.json');
  if (!downloaded) return null;
  try {
    const receipt = JSON.parse(downloaded.bytes.toString('utf8')) as QualificationAttemptReceiptV1;
    const track = session.artifact_tracks[artifactKind];
    const errors = validateQualificationAttemptReceipt(receipt, {
      stableSessionId: session.id,
      releaseCohortRef: session.cohort_plan.operator_plan_ref,
      artifactKind,
      qualificationRunId: runId,
      sourceArtifactRunId: track.source_run_id ?? '',
      sourceArtifactName: track.source_artifact_name ?? '',
      artifactSha256: track.artifact_sha256 ?? '',
      manifestSha256: track.build_manifest_sha256,
      semanticDigest: track.expectation_semantic_digest ?? '',
      probeDigest: track.expectation_probe_digest ?? '',
      qualificationInputManifestDigest: track.qualification_input_manifest_digest ?? undefined,
    });
    if (errors.length > 0) {
      return null;
    }
    return { receipt, ref, sha256: sha256Bytes(downloaded.bytes) };
  } catch {
    return null;
  } finally {
    downloaded.cleanup();
  }
}

function createReconcileEvidenceReader(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
): {
  readJson<T>(runId: string, artifactName: string, fileName: string): { value: T; ref: string; sha256: string } | null;
  cleanup(): void;
} {
  const artifactRoots = new Map<string, string | null>();
  const evidenceFiles = new Map<string, { value: unknown; ref: string; sha256: string } | null>();

  function artifactRoot(runId: string, artifactName: string): string | null {
    const key = `${runId}\u0000${artifactName}`;
    if (artifactRoots.has(key)) return artifactRoots.get(key) ?? null;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-reconcile-artifact-'));
    const result = runner(
      'gh',
      ['run', 'download', runId, '--repo', session.repo, '--name', artifactName, '--dir', root],
      { timeoutMs: readOnlyReleaseTransportTimeoutMs() },
    );
    if (result.status !== 0) {
      fs.rmSync(root, { recursive: true, force: true });
      artifactRoots.set(key, null);
      return null;
    }
    artifactRoots.set(key, root);
    return root;
  }

  return {
    readJson<T>(runId: string, artifactName: string, fileName: string) {
      const key = `${runId}\u0000${artifactName}\u0000${fileName}`;
      if (evidenceFiles.has(key)) {
        return evidenceFiles.get(key) as { value: T; ref: string; sha256: string } | null;
      }
      const root = artifactRoot(runId, artifactName);
      const filePath = root ? findFile(root, fileName) : null;
      if (!filePath) {
        evidenceFiles.set(key, null);
        return null;
      }
      try {
        const bytes = fs.readFileSync(filePath);
        const evidence = {
          value: JSON.parse(bytes.toString('utf8')) as T,
          ref: artifactName,
          sha256: sha256Bytes(bytes),
        };
        evidenceFiles.set(key, evidence);
        return evidence;
      } catch {
        evidenceFiles.set(key, null);
        return null;
      }
    },
    cleanup() {
      for (const root of artifactRoots.values()) {
        if (root) fs.rmSync(root, { recursive: true, force: true });
      }
      artifactRoots.clear();
      evidenceFiles.clear();
    },
  };
}

export function classifyWorkflowRunObservation(
  watched: CommandResult,
  readback: WorkflowRun,
): { terminal: boolean; succeeded: boolean; conclusion: string | null } {
  const terminal = readback.status === 'completed';
  if (!terminal) return { terminal: false, succeeded: false, conclusion: null };
  const conclusion = readback.conclusion || (watched.status === 0 ? 'success' : 'failure');
  return { terminal: true, succeeded: conclusion === 'success', conclusion };
}

export function standardReleaseCircuitBreaker(
  session: StableReleaseSession,
  observedAtMs = Date.now(),
): 'new_release_train_allowed' | 'typed_blocker_reconcile_or_emergency_cancel_only' {
  const deadlineAtMs = Date.parse(session.efficiency_policy.standard_admission_deadline_at);
  if (!Number.isFinite(deadlineAtMs)) return 'typed_blocker_reconcile_or_emergency_cancel_only';
  return observedAtMs < deadlineAtMs
    ? 'new_release_train_allowed'
    : 'typed_blocker_reconcile_or_emergency_cancel_only';
}

export function remainingStandardAdmissionBudgetMs(
  session: StableReleaseSession,
  observedAtMs = Date.now(),
): number {
  const deadlineAtMs = Date.parse(session.efficiency_policy.standard_admission_deadline_at);
  return Number.isFinite(deadlineAtMs) ? Math.max(0, deadlineAtMs - observedAtMs) : 0;
}

export async function watchRunToTerminal(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
  persist: (session: StableReleaseSession) => void,
  clock: () => number = Date.now,
  deadlinePolicy?: WorkflowWatchDeadline,
): Promise<{ readback: WorkflowRun; succeeded: boolean; conclusion: string; session: StableReleaseSession }> {
  const retryLimit = session.efficiency_policy.monitor_transport_retry_limit ?? 3;
  const historicalPromotionDeadline = deadlinePolicy?.kind === 'historical_promotion_recovery' ? deadlinePolicy : null;
  const standardDeadlineApplies = session.terminal_truth.standard_status !== 'terminal' && historicalPromotionDeadline === null;
  const fullAddonDeadline = deadlinePolicy?.kind === 'full_addon' ? deadlinePolicy : null;
  const fullAddonDeadlineApplies = fullAddonDeadline !== null;
  const phaseStartedAtMs = Date.parse(session.metrics.phases[session.phase]?.started_at ?? session.updated_at);
  const terminalTransportWindowMs =
    (session.efficiency_policy.monitor_wall_clock_timeout_seconds[session.phase] ?? 7_200) * 1_000;
  const deadline = fullAddonDeadlineApplies
    ? Date.parse(fullAddonDeadline!.deadlineAt)
    : historicalPromotionDeadline
      ? Date.parse(historicalPromotionDeadline.deadlineAt)
    : standardDeadlineApplies
      ? admissionDeadlineMs(session)
      : phaseStartedAtMs + terminalTransportWindowMs;
  if (!Number.isFinite(deadline)) throw new Error('Workflow monitor requires a valid immutable absolute deadline.');
  const warningAt = Date.parse(session.metrics.session_started_at) + 60 * 60 * 1_000;
  let monitoredSession = session;
  let lastReadback: WorkflowRun | null = null;
  let lastReadbackError: string | null = null;
  const failAtDeadline = (observedAtMs: number, stage: string): never => {
    if (fullAddonDeadlineApplies) {
      monitoredSession = blockFullAddonAtDeadline(monitoredSession, {
        acceptanceAttemptId: fullAddonDeadline!.acceptanceAttemptId,
        runId,
        deadlineAt: fullAddonDeadline!.deadlineAt,
        observedAtMs: Math.max(observedAtMs, deadline),
        remoteStatus: lastReadback?.status ?? 'unknown',
      });
      persist(monitoredSession);
      throw new Error(
        `Workflow run ${runId} reached the signed 50-minute Full add-on deadline during ${stage}; ` +
        'the durable add-on debt blocker is terminal and Standard remains unchanged.',
      );
    }
    if (historicalPromotionDeadline) {
      monitoredSession = transitionStableReleaseSession(
        monitoredSession,
        'promotion_failed',
        `historical promotion successor exceeded its bounded recovery window from ${historicalPromotionDeadline.predecessorAttemptId}`,
        new Date(observedAtMs).toISOString(),
      );
      persist(monitoredSession);
      throw new Error(`Workflow run ${runId} ${stage} reached its bounded historical promotion recovery window.`);
    }
    if (!standardDeadlineApplies) {
      throw new Error(`Workflow run ${runId} ${stage} reached its independent post-Standard transport window.`);
    }
    monitoredSession = standardDeadlineBlockedSession(
      monitoredSession, `workflow_watch:${monitoredSession.phase}`, runId, observedAtMs,
    );
    persist(monitoredSession);
    throw new Error(
      `Workflow run ${runId} reached the immutable 90-minute Standard deadline during ${stage}; ` +
      'the durable typed blocker permits only reconcile or emergency cancel.',
    );
  };
  for (let attempt = 1; attempt <= retryLimit; attempt += 1) {
    const observedAtMs = clock();
    if (
      standardDeadlineApplies && observedAtMs >= warningAt && observedAtMs < deadline &&
      monitoredSession.metrics.efficiency_advisories.length === 0
    ) {
      monitoredSession = appendStableReleaseEfficiencyAdvisory(monitoredSession, {
        stage: monitoredSession.phase, status: lastReadback?.status ?? 'unknown', observedAtMs,
      });
      persist(monitoredSession);
    }
    const remainingBudgetMs = deadline - observedAtMs;
    if (remainingBudgetMs <= 0) {
      failAtDeadline(observedAtMs, `pre-transport attempt ${attempt}`);
    }
    const warningPending = standardDeadlineApplies && monitoredSession.metrics.efficiency_advisories.length === 0 && observedAtMs < warningAt;
    const watchBudgetMs = Math.min(remainingBudgetMs, warningPending ? warningAt - observedAtMs : remainingBudgetMs);
    const watched = watchRun(runner, monitoredSession, runId, watchBudgetMs);
    const afterWatchMs = clock();
    if (afterWatchMs >= deadline) {
      failAtDeadline(afterWatchMs, 'monitor transport');
    }
    if (
      standardDeadlineApplies && afterWatchMs >= warningAt &&
      monitoredSession.metrics.efficiency_advisories.length === 0
    ) {
      monitoredSession = appendStableReleaseEfficiencyAdvisory(monitoredSession, {
        stage: monitoredSession.phase,
        status: lastReadback?.status ?? (watched.timedOut ? 'watch_timeout_at_warning_boundary' : 'watch_transport_returned'),
        observedAtMs: afterWatchMs,
      });
      persist(monitoredSession);
    }
    const view = runView(runner, monitoredSession, runId, clock);
    const afterReadbackMs = clock();
    if (afterReadbackMs >= deadline) {
      failAtDeadline(afterReadbackMs, 'terminal readback');
    }
    if (view.readback) {
      const observation = classifyWorkflowRunObservation(watched, view.readback);
      if (observation.terminal && observation.conclusion) {
        return {
          readback: view.readback,
          succeeded: observation.succeeded,
          conclusion: observation.conclusion,
          session: monitoredSession,
        };
      }
      lastReadback = view.readback;
    }
    lastReadbackError = view.error;
    if (
      standardDeadlineApplies && afterReadbackMs >= warningAt && monitoredSession.metrics.efficiency_advisories.length === 0
    ) {
      monitoredSession = appendStableReleaseEfficiencyAdvisory(monitoredSession, {
        stage: monitoredSession.phase, status: lastReadback?.status ?? 'unknown', observedAtMs: afterReadbackMs,
      });
      persist(monitoredSession);
    }
    if (watched.timedOut) {
      if (afterReadbackMs >= warningAt) continue;
      throw new Error(
        `Workflow run ${runId} monitor reached its wall-clock budget; remote status is ${lastReadback?.status ?? 'unknown'}. ` +
        'The durable run identity remains recoverable with reconcile or resume; no mutation was retried.',
      );
    }
    if (attempt < retryLimit) {
      const remainingAfterTransport = deadline - clock();
      if (remainingAfterTransport <= 0) continue;
      await delay(Math.min(session.efficiency_policy.monitor_interval_seconds * 1_000, remainingAfterTransport));
    }
  }
  throw new Error(
    `Workflow run ${runId} monitor exited before a terminal remote state after ${retryLimit} attempts; ` +
      `remote status is ${lastReadback?.status ?? 'unknown'}${lastReadbackError ? `; ${lastReadbackError}` : ''}. ` +
      'The release session remains recoverable with resume.',
  );
}

function runJobs(runner: StableReleaseCommandRunner, session: StableReleaseSession, runId: string): WorkflowJob[] {
  const result = runner(
    'gh',
    ['run', 'view', runId, '--repo', session.repo, '--json', 'jobs', '--jq', '.jobs'],
    { timeoutMs: readOnlyReleaseTransportTimeoutMs() },
  );
  if (result.status !== 0) return [];
  try {
    return JSON.parse(result.stdout) as WorkflowJob[];
  } catch {
    return [];
  }
}

function finalizeReleaseRun(
  session: StableReleaseSession,
  runId: string,
  succeeded: boolean,
  runner: StableReleaseCommandRunner,
  clock: () => number = Date.now,
): StableReleaseSession {
  const manifest = readBuildArtifactManifest(runner, session, runId);
  if (manifest) {
    const passedQualification = readQualificationReceipt(runner, session, runId, runId, 'passed', 'standard', manifest);
    if (passedQualification) {
      session = bindQualificationEvidence(session, manifest, runId, 'success', passedQualification.sha256);
      return transitionStableReleaseSession(
        session,
        'artifacts_qualified',
        succeeded
          ? 'build and exact-artifact qualification completed; owner approval is required before promotion'
          : 'exact artifact and qualification passed before a later nonblocking train failure; owner approval is required before promotion',
        new Date(clock()).toISOString(),
      );
    }
  }
  if (succeeded) {
    throw new Error(
      `Desktop release run ${runId} succeeded but exact manifest/qualification evidence is not yet readable; ` +
      'keep the durable run in readback_pending and use reconcile or resume without redispatch.',
    );
  }
  if (manifest) {
    const qualification = readQualificationReceipt(runner, session, runId, runId, 'failed', 'standard', manifest);
    if (qualification) {
      session = bindQualificationEvidence(session, manifest, runId, 'failure', qualification.sha256);
      return transitionStableReleaseSession(
        session,
        'qualification_failed',
        'the built artifact failed qualification; only a same-artifact qualification retry is allowed',
        new Date(clock()).toISOString(),
      );
    }
    return transitionStableReleaseSession(
      session,
      'release_train_failed',
      'release train failed outside the exact-artifact qualification gate',
      new Date(clock()).toISOString(),
    );
  }
  return transitionStableReleaseSession(
    session,
    'artifact_build_failed',
    'release run did not produce a valid exact-byte artifact manifest',
    new Date(clock()).toISOString(),
  );
}

function promotionSagaArtifactName(session: StableReleaseSession): string {
  return `opl-promotion-saga-receipt-${session.version}-${session.id.slice('sha256:'.length)}`;
}

function readPromotionSagaReceipt(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
): { sha256: string } | null {
  const downloaded = downloadArtifactFile(
    runner,
    session,
    runId,
    promotionSagaArtifactName(session),
    'opl-app-promotion-saga-receipt.json',
  );
  if (!downloaded) return null;
  try {
    const receipt = JSON.parse(downloaded.bytes.toString('utf8')) as unknown;
    const errors = validatePromotionSagaReceipt(receipt, {
      stableSessionId: session.id,
      version: session.version,
    });
    return errors.length === 0 ? { sha256: sha256Bytes(downloaded.bytes) } : null;
  } finally {
    downloaded.cleanup();
  }
}

function readFullAddonReceipt(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
  releaseSetGeneration: string,
  releaseSetManifestDigest: string,
  qualificationInputManifestDigest: string,
  fullInputManifestDigest: string,
  frameworkBundledCatalogDigest: string,
  fullToolchainObservationReceiptDigest: string,
): { sha256: string; ref: string } | null {
  const ref = `opl-app-full-addon-receipt-${session.version}-${runId}`;
  const downloaded = downloadArtifactFile(runner, session, runId, ref, 'opl-app-full-addon-receipt.json');
  if (!downloaded) return null;
  try {
    const receipt = JSON.parse(downloaded.bytes.toString('utf8')) as unknown;
    const errors = validateFullAddonReceipt(receipt, {
      version: session.version, stableSessionId: session.id,
      releaseCohortRef: session.cohort_plan.operator_plan_ref,
      appSha: session.cohort_plan.cohort_lock.app.resolved_sha,
      shellSha: session.cohort_plan.cohort_lock.shell.resolved_sha,
      frameworkSha: session.cohort_plan.cohort_lock.framework.resolved_sha,
      runId, releaseSetGeneration, releaseSetManifestDigest,
      qualificationInputManifestDigest,
      fullInputManifestDigest,
      frameworkBundledCatalogDigest,
      fullToolchainObservationReceiptDigest,
    });
    return errors.length === 0 ? { sha256: sha256Bytes(downloaded.bytes), ref } : null;
  } finally {
    downloaded.cleanup();
  }
}

function fullAddonWatchDeadline(
  session: StableReleaseSession,
  runId: string,
): Extract<WorkflowWatchDeadline, { kind: 'full_addon' }> {
  const acceptance = session.mutation_acceptances.find((candidate) =>
    candidate.pre_api_fence.request.mutation === 'full_addon_dispatch' && candidate.github.run_id === runId
  );
  const deadlineAt = acceptance?.full_addon_deadline_at ?? null;
  const deadlineAtMs = Date.parse(String(deadlineAt));
  if (
    !acceptance || !deadlineAt || !Number.isFinite(deadlineAtMs) ||
    new Date(deadlineAtMs).toISOString() !== deadlineAt || session.addon_tracks.full.deadline_at !== deadlineAt
  ) {
    throw new Error('Full add-on monitor requires the exact broker-signed acceptance deadline stored in the durable session.');
  }
  return { kind: 'full_addon', deadlineAt, acceptanceAttemptId: acceptance.lease.attempt_id };
}

function fullAddonDeadlineBlockedIfElapsed(
  session: StableReleaseSession,
  runId: string,
  remoteStatus: string,
  observedAtMs = Date.now(),
): StableReleaseSession | null {
  const policy = fullAddonWatchDeadline(session, runId);
  if (observedAtMs < Date.parse(policy.deadlineAt)) return null;
  return blockFullAddonAtDeadline(session, {
    acceptanceAttemptId: policy.acceptanceAttemptId,
    runId,
    deadlineAt: policy.deadlineAt,
    observedAtMs,
    remoteStatus,
  });
}

export { applyPromotionCheckpointReadback, promotionCheckpointReceiptsFromJobs };

const promotionCheckpointJobNames = [
  'Publish release without changing latest',
  'Validate brokered atomic Standard distribution',
  'Verify Standard Homebrew activation',
  'Activate App latest after Standard distribution gates',
] as const;

function promotionCheckpointReceiptsJsonForRecovery(
  session: StableReleaseSession,
  runner: StableReleaseCommandRunner,
): string {
  const resumeIndex = [
    'release_public_nonlatest', 'distribution_synced', 'homebrew_verified', 'latest_activated',
  ].indexOf(session.promotion_progress.resume_from_checkpoint);
  if (resumeIndex <= 0) return '[]';
  const sourceRuns = session.mutation_attempts
    .filter((attempt) => attempt.mutation === 'promotion_dispatch')
    .map((attempt) => attempt.events.at(-1)?.run_id ?? null)
    .filter((runId): runId is string => Boolean(runId));
  const matches = [...new Set(sourceRuns)].flatMap((runId) => {
    const receipts = promotionCheckpointReceiptsFromJobs(runId, runJobs(runner, session, runId));
    return receipts.length >= resumeIndex ? [{ runId, receipts: receipts.slice(0, resumeIndex) }] : [];
  });
  if (matches.length !== 1) {
    throw new Error(
      `Checkpoint recovery requires one exact promotion run with ${resumeIndex} contiguous job receipts; ` +
      `found ${matches.length}.`,
    );
  }
  return JSON.stringify(matches[0]!.receipts);
}

function finalizePromotionRun(
  session: StableReleaseSession,
  runId: string,
  succeeded: boolean,
  runner: StableReleaseCommandRunner,
  clock: () => number = Date.now,
): StableReleaseSession {
  const receipt = succeeded ? readPromotionSagaReceipt(runner, session, runId) : null;
  const jobs = runJobs(runner, session, runId);
  if (succeeded && (!receipt || jobs.length === 0 || promotionCheckpointJobNames.some((jobName) =>
    !jobs.some((candidate) => candidate.name.includes(jobName))
  ))) {
    throw new Error(
      `Promotion run ${runId} succeeded but saga receipt/jobs readback is not yet complete; ` +
      'keep promotion_running and use reconcile or resume without redispatch.',
    );
  }
  session = applyPromotionCheckpointReadback(session, jobs, new Date(clock()).toISOString());
  if (!succeeded || !receipt || session.phase !== 'latest_activated') {
    if (session.phase !== 'promotion_failed') {
      session = transitionStableReleaseSession(
        session,
        'promotion_failed',
        succeeded ? 'promotion run did not expose a valid complete saga receipt' : 'promotion saga stopped after its last verified checkpoint',
        new Date(clock()).toISOString(),
      );
    }
    return session;
  }
  session.receipts = { ...session.receipts, promotion_saga: { ref: promotionSagaArtifactName(session), sha256: receipt.sha256 } };
  return transitionStableReleaseSession(
    session,
    'awaiting_local_activation',
    'same-version local installation and CDP readback receipt remain required',
    new Date(clock()).toISOString(),
  );
}

async function dispatchAndWatchRelease(
  session: StableReleaseSession,
  statePath: string,
  watch: boolean,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  if (standardReleaseCircuitBreaker(session) !== 'new_release_train_allowed') {
    session = standardDeadlineBlockedSession(
      session, 'desktop_release_dispatch_admission', session.release_run.id, Date.now(),
    );
    writeSession(statePath, session);
    throw new Error(
      'The 90-minute Standard circuit breaker forbids release or recovery mutation; ' +
      'only a durable typed blocker, bounded read-only reconcile, or exact-run emergency cancel may continue.',
    );
  }
  if (session.release_run.id) throw new Error('This frozen cohort already has a desktop release run; refusing a second dispatch.');
  if (session.metrics.artifact_build_count >= 1) throw new Error('This frozen cohort already consumed its one artifact build.');
  const controllerWorkflowSha = resolveCanonicalControllerWorkflowSha(runner, session);
  assertStandardDeadlineOrPersist(
    session, statePath, 'desktop_release_controller_readback', session.release_run.id,
  );
  const dispatchedAt = now();
  const mutationPlanned = planReleaseMutationAttempt(session, {
    mutation: 'desktop_release_dispatch', workflow: 'desktop-release.yml', artifactKind: 'standard',
    admissionMode: 'admin_one_shot_controller',
    controllerWorkflowSha,
    artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
    mutationPayloadSha256: releaseMutationPayloadSha256(desktopReleaseMutationPayload(session)),
    mutationPayload: desktopReleaseMutationPayload(session),
    at: dispatchedAt, reason: 'persist desktop release mutation before external dispatch',
  });
  const planned = appendQualificationAttempt(mutationPlanned.session, {
    artifactKind: 'standard', workflow: 'desktop-release.yml', mutation: 'desktop_release_dispatch',
    at: dispatchedAt, reason: 'record Standard qualification before desktop release mutation',
    mutationAttemptId: mutationPlanned.attemptId,
  });
  session = planned.session;
  writeSession(statePath, session);
  const dispatchingAt = now();
  session = appendReleaseMutationAttemptEvent(session, mutationPlanned.attemptId, {
    at: dispatchingAt, state: 'dispatching', run_id: null,
    reason: 'durable admin one-shot fence persisted before the sole GitHub workflow dispatch',
  });
  const admission = buildAdminOneShotAdmission(
    session, mutationPlanned.attemptId, desktopReleaseMutationPayload(session), dispatchingAt,
  );
  session = {
    ...session,
    mutation_attempts: session.mutation_attempts.map((attempt) => attempt.attempt_id === mutationPlanned.attemptId
      ? { ...attempt, broker_lookup: { ...attempt.broker_lookup, request_sha256: admission.request_sha256 } }
      : attempt),
  };
  writeSession(statePath, session);
  const dispatch = runner('gh', adminOneShotDispatchArgs(admission), {
    timeoutMs: boundedReleaseTransportTimeoutMs(session, 'admin one-shot desktop release dispatch'),
  });
  if (dispatch.status !== 0) {
    throw new Error(
      `${formatCommandFailure(dispatch, 'admin one-shot desktop release dispatch')}; ` +
      'the durable dispatching fence forbids a second submission, so use read-only reconcile.',
    );
  }
  const releaseRun = await discoverAdminOneShotRun(
    runner, session, mutationPlanned.attemptId, 'desktop-release.yml', controllerWorkflowSha, dispatchedAt,
  );
  const acceptedRunId = String(releaseRun.databaseId);
  session = appendQualificationAttemptEvent(session, 'standard', planned.attemptId, {
    at: now(), state: 'dispatching', run_id: acceptedRunId, conclusion: null, failure_taxonomy: 'none',
    remote_receipt_ref: null, reason: 'admin one-shot dispatch discovered and bound the exact desktop release run',
  });
  session.metrics = {
    ...session.metrics,
    artifact_build_count: session.metrics.artifact_build_count + 1,
    workflow_dispatch_counts: {
      ...session.metrics.workflow_dispatch_counts,
      desktop_release: session.metrics.workflow_dispatch_counts.desktop_release + 1,
    },
  };
  session.release_run = {
    id: acceptedRunId,
    url: `https://github.com/${session.repo}/actions/runs/${acceptedRunId}`,
    conclusion: null,
  };
  session = transitionStableReleaseSession(session, 'artifact_build_running', `admin one-shot bound exact desktop release run ${acceptedRunId}`);
  session.release_run = { id: acceptedRunId, url: releaseRun.url, conclusion: null };
  session = appendReleaseMutationAttemptEvent(session, mutationPlanned.attemptId, {
    at: now(), state: 'running', run_id: acceptedRunId, reason: 'exact admin one-shot desktop release run read back',
  });
  session = appendQualificationAttemptEvent(session, 'standard', planned.attemptId, {
    at: now(), state: 'running', run_id: acceptedRunId, conclusion: null,
    failure_taxonomy: 'none', remote_receipt_ref: null, reason: 'exact admin one-shot workflow run read back',
  });
  writeSession(statePath, session);
  if (!watch) return session;

  const observation = await watchRunToTerminal(
    runner, session, acceptedRunId, (next) => writeSession(statePath, next),
  );
  session = observation.session;
  const { readback } = observation;
  session.release_run = {
    id: String(readback.databaseId),
    url: readback.url,
    conclusion: observation.conclusion,
  };
  session = finalizeStandardEvidenceBeforeDeadline(
    session,
    statePath,
    'desktop_release_finalization',
    String(readback.databaseId),
    () => finalizeReleaseRun(session, String(readback.databaseId), observation.succeeded, runner),
  );
  session = appendReleaseMutationAttemptEvent(session, mutationPlanned.attemptId, {
    at: now(),
    state: observation.succeeded ? 'succeeded' : observation.conclusion === 'cancelled' ? 'cancelled' : 'failed',
    run_id: String(readback.databaseId), reason: `desktop release workflow concluded ${observation.conclusion ?? 'unknown'}`,
  });
  session = appendQualificationAttemptEvent(session, 'standard', planned.attemptId, {
    at: now(),
    state: session.phase === 'artifacts_qualified' ? 'passed' : observation.conclusion === 'cancelled' ? 'cancelled' : 'failed',
    run_id: String(readback.databaseId), conclusion: observation.conclusion,
    failure_taxonomy: session.phase === 'artifacts_qualified' ? 'none' : observation.conclusion === 'cancelled' ? 'cancelled' : 'unknown',
    remote_receipt_ref: session.qualification_run.evidence_ref,
    reason: session.phase === 'artifacts_qualified'
      ? 'strict exact-artifact qualification receipt validated'
      : 'release terminal state requires reconcile before retry classification',
  });
  writeSession(statePath, session);
  return session;
}

async function dispatchAndWatchPromotion(
  session: StableReleaseSession,
  statePath: string,
  ownerReceiptRef: string,
  releaseSetGeneration: string,
  watch: boolean,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  if (!ownerReceiptRef.trim()) throw new Error('Promotion requires a same-cohort release owner receipt ref.');
  if (!/^\d{2}\.\d{1,2}\.\d{1,2}(?:-r[1-9][0-9]*)?$/.test(releaseSetGeneration)) {
    throw new Error('Promotion requires an exact Release Set generation in YY.M.D[-rN] form.');
  }
  if (!session.release_run.id || session.artifact_tracks.standard.qualification_run.conclusion !== 'success') {
    throw new Error('Promotion requires the exact source run and passed Standard qualification before mutation planning.');
  }
  const retrying = session.phase === 'promotion_failed';
  if (!retrying && session.phase !== 'artifacts_qualified') {
    throw new Error(`Promotion dispatch requires artifacts_qualified or promotion_failed, got ${session.phase}.`);
  }
  if (retrying && session.promotion_progress.release_set_generation !== releaseSetGeneration) {
    throw new Error('Promotion retry must preserve the exact Release Set generation from the failed promotion.');
  }
  if (retrying && session.release_owner_receipt_ref !== ownerReceiptRef) {
    throw new Error('Promotion retry must preserve the exact release owner receipt from the failed promotion.');
  }
  const promotionCheckpointReceiptsJson = retrying
    ? promotionCheckpointReceiptsJsonForRecovery(session, runner)
    : '[]';
  const mutationPayload = promotionMutationPayload(
    session, ownerReceiptRef, releaseSetGeneration, promotionCheckpointReceiptsJson,
  );
  const historicalRecovery = retrying
    ? historicalPromotionRecoveryContext(
      session, ownerReceiptRef, releaseSetGeneration, Date.now(), promotionCheckpointReceiptsJson,
    )
    : null;
  const historicalPredecessor = historicalRecovery?.predecessorAdmission ?? null;
  session = {
    ...session,
    promotion_progress: {
      ...session.promotion_progress,
      release_set_generation: releaseSetGeneration,
    },
  };
  if (!historicalPredecessor) {
    assertStandardDeadlineOrPersist(session, statePath, 'promotion_dispatch_admission', session.promotion_run.id);
  }
  const controllerWorkflowSha = resolveCanonicalControllerWorkflowSha(runner, session, historicalPredecessor !== null);
  if (!historicalPredecessor) {
    assertStandardDeadlineOrPersist(session, statePath, 'promotion_controller_readback', session.promotion_run.id);
  }
  const dispatchedAt = now();
  const planned = planReleaseMutationAttempt(session, {
    mutation: 'promotion_dispatch', workflow: 'desktop-release-promote.yml', artifactKind: 'promotion',
    admissionMode: 'admin_one_shot_controller',
    controllerWorkflowSha,
    artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
    mutationPayloadSha256: releaseMutationPayloadSha256(mutationPayload),
    mutationPayload,
    priorRunIds: historicalRecovery?.priorRunIds,
    at: dispatchedAt, reason: 'persist promotion mutation before external dispatch',
  });
  session = planned.session;
  writeSession(statePath, session);
  const dispatchingAt = now();
  session = appendReleaseMutationAttemptEvent(session, planned.attemptId, {
    at: dispatchingAt, state: 'dispatching', run_id: null,
    reason: 'durable admin one-shot promotion fence persisted before the sole GitHub workflow dispatch',
  });
  const admission = buildAdminOneShotAdmission(
    session, planned.attemptId, mutationPayload, dispatchingAt,
  );
  session = {
    ...session,
    mutation_attempts: session.mutation_attempts.map((attempt) => attempt.attempt_id === planned.attemptId
      ? { ...attempt, broker_lookup: { ...attempt.broker_lookup, request_sha256: admission.request_sha256 } }
      : attempt),
  };
  writeSession(statePath, session);
  const dispatch = runner('gh', adminOneShotDispatchArgs(admission, historicalPredecessor ?? undefined), {
    timeoutMs: historicalPredecessor
      ? readOnlyReleaseTransportTimeoutMs()
      : boundedReleaseTransportTimeoutMs(session, 'admin one-shot promotion dispatch'),
  });
  if (dispatch.status !== 0) {
    throw new Error(
      `${formatCommandFailure(dispatch, 'admin one-shot promotion dispatch')}; ` +
      'the durable dispatching fence forbids a second submission, so use read-only reconcile.',
    );
  }
  const promotionRun = await discoverAdminOneShotRun(
    runner, session, planned.attemptId, 'desktop-release-promote.yml', controllerWorkflowSha, dispatchedAt,
  );
  const acceptedRunId = String(promotionRun.databaseId);
  session.release_owner_receipt_ref = ownerReceiptRef;
  if (!retrying) {
    session = transitionStableReleaseSession(session, 'owner_approved', 'same-cohort release owner receipt accepted');
  }
  session.promotion_run = {
    id: acceptedRunId,
    url: `https://github.com/${session.repo}/actions/runs/${acceptedRunId}`,
    conclusion: null,
    attempt: 1,
    rerun_requested_from_attempt: null,
  };
  session = transitionStableReleaseSession(session, 'promotion_running', `admin one-shot bound exact promotion run ${acceptedRunId}`);
  session.metrics = {
    ...session.metrics,
    promotion_retry_count: session.metrics.promotion_retry_count + (retrying ? 1 : 0),
    workflow_dispatch_counts: {
      ...session.metrics.workflow_dispatch_counts,
      promotion: session.metrics.workflow_dispatch_counts.promotion + 1,
    },
  };
  writeSession(statePath, session);
  session.promotion_run = {
    id: acceptedRunId,
    url: promotionRun.url,
    conclusion: null,
    attempt: promotionRun.attempt ?? 1,
    rerun_requested_from_attempt: null,
  };
  session = appendReleaseMutationAttemptEvent(session, planned.attemptId, {
    at: now(), state: 'running', run_id: acceptedRunId, reason: 'exact admin one-shot promotion run read back',
  });
  writeSession(statePath, session);
  if (!watch) return session;

  const observation = await watchRunToTerminal(
    runner, session, acceptedRunId, (next) => writeSession(statePath, next),
    Date.now,
    historicalPredecessor ? {
      kind: 'historical_promotion_recovery',
      deadlineAt: new Date(
        Date.parse(dispatchingAt) +
        (session.efficiency_policy.monitor_wall_clock_timeout_seconds.promotion_running ?? 3_600) * 1_000,
      ).toISOString(),
      predecessorAttemptId: historicalPredecessor.request.attempt_id,
    } : undefined,
  );
  session = observation.session;
  const { readback } = observation;
  session.promotion_run = {
    id: String(readback.databaseId),
    url: readback.url,
    conclusion: observation.conclusion,
    attempt: readback.attempt ?? session.promotion_run.attempt ?? 1,
    rerun_requested_from_attempt: session.promotion_run.rerun_requested_from_attempt,
  };
  session = historicalPredecessor
    ? finalizePromotionRun(session, String(readback.databaseId), observation.succeeded, runner)
    : finalizeStandardEvidenceBeforeDeadline(
      session,
      statePath,
      'promotion_finalization',
      String(readback.databaseId),
      () => finalizePromotionRun(session, String(readback.databaseId), observation.succeeded, runner),
    );
  session = appendReleaseMutationAttemptEvent(session, planned.attemptId, {
    at: now(),
    state: observation.succeeded ? 'succeeded' : observation.conclusion === 'cancelled' ? 'cancelled' : 'failed',
    run_id: String(readback.databaseId), reason: `promotion workflow concluded ${observation.conclusion ?? 'unknown'}`,
  });
  writeSession(statePath, session);
  return session;
}

type WorkflowTerminalObservation = Awaited<ReturnType<typeof watchRunToTerminal>>;

function fullAddonAttemptIdsForRun(session: StableReleaseSession, runId: string): {
  mutationAttemptId: string;
  qualificationAttemptId: string;
} {
  if (session.addon_tracks.full.run_id !== runId) {
    throw new Error(`Full add-on run ${runId} does not match the durable add-on track.`);
  }
  const acceptances = session.mutation_acceptances.filter((acceptance) =>
    acceptance.pre_api_fence.request.mutation === 'full_addon_dispatch' && acceptance.github.run_id === runId
  );
  if (acceptances.length !== 1) {
    throw new Error(`Full add-on run ${runId} requires exactly one durable signed broker acceptance.`);
  }
  const mutation = session.mutation_attempts.find((attempt) =>
    attempt.attempt_id === acceptances[0].lease.attempt_id && attempt.mutation === 'full_addon_dispatch'
  );
  const qualification = mutation
    ? session.artifact_tracks.full.attempts.find((attempt) => attempt.mutation_attempt_id === mutation.attempt_id)
    : null;
  if (!mutation || !qualification) {
    throw new Error('Running Full add-on lacks its durable mutation and qualification attempt identities.');
  }
  return { mutationAttemptId: mutation.attempt_id, qualificationAttemptId: qualification.attempt_id };
}

function finalizeFullAddonObservation(
  session: StableReleaseSession,
  observation: WorkflowTerminalObservation,
  runner: StableReleaseCommandRunner,
  clock: () => number = Date.now,
): StableReleaseSession {
  const runId = String(observation.readback.databaseId);
  const deadlineBlockedBeforeEvidence = fullAddonDeadlineBlockedIfElapsed(
    session, runId, observation.readback.status, clock(),
  );
  if (deadlineBlockedBeforeEvidence) return deadlineBlockedBeforeEvidence;
  const releaseSetGeneration = session.addon_tracks.full.release_set_generation;
  const releaseSetManifestDigest = session.addon_tracks.full.release_set_manifest_digest;
  if (!releaseSetGeneration || !releaseSetManifestDigest) {
    throw new Error('Full add-on finalization lacks its frozen Release Set identity.');
  }
  const manifest = observation.succeeded ? readBuildArtifactManifest(runner, session, runId, 'full') : null;
  const sourceDigests = manifest ? {
    qualificationInputManifestDigest: manifest.manifest.digests.qualification_input_manifest_sha256,
    fullInputManifestDigest: manifest.manifest.digests.full_input_manifest_sha256 ?? '',
    frameworkBundledCatalogDigest: manifest.manifest.digests.framework_bundled_catalog_sha256 ?? '',
    fullToolchainObservationReceiptDigest: manifest.manifest.digests.full_toolchain_observation_receipt_sha256 ?? '',
  } : null;
  const strict = observation.succeeded && sourceDigests
    ? readQualificationReceipt(runner, session, runId, runId, 'passed', 'full', manifest)
    : null;
  const receipt = observation.succeeded && sourceDigests
    ? readFullAddonReceipt(
      runner, session, runId, releaseSetGeneration, releaseSetManifestDigest,
      sourceDigests.qualificationInputManifestDigest, sourceDigests.fullInputManifestDigest,
      sourceDigests.frameworkBundledCatalogDigest, sourceDigests.fullToolchainObservationReceiptDigest,
    )
    : null;
  const completedAtMs = clock();
  const deadlineBlockedAfterEvidence = fullAddonDeadlineBlockedIfElapsed(
    session, runId, observation.readback.status, completedAtMs,
  );
  if (deadlineBlockedAfterEvidence) return deadlineBlockedAfterEvidence;
  const passed = Boolean(observation.succeeded && manifest && strict && receipt);
  if (passed) session = bindQualificationEvidence(session, manifest!, runId, 'success', strict!.sha256, 'full');
  const completedAt = new Date(completedAtMs).toISOString();
  session.addon_tracks = {
    ...session.addon_tracks,
    full: {
      ...session.addon_tracks.full,
      status: passed ? 'qualified' : 'failed',
      run_id: runId,
      run_url: observation.readback.url,
      conclusion: observation.conclusion,
      receipt_ref: receipt?.ref ?? null,
      receipt_sha256: receipt?.sha256 ?? null,
    },
  };
  const { mutationAttemptId, qualificationAttemptId } = fullAddonAttemptIdsForRun(session, runId);
  const mutationLatest = session.mutation_attempts.find((attempt) => attempt.attempt_id === mutationAttemptId)!.events.at(-1)!;
  const mutationState = passed ? 'succeeded' : observation.conclusion === 'cancelled' ? 'cancelled' : 'failed';
  if (!['succeeded', 'failed', 'cancelled'].includes(mutationLatest.state)) {
    session = appendReleaseMutationAttemptEvent(session, mutationAttemptId, {
      at: completedAt, state: mutationState, run_id: runId,
      reason: passed
        ? 'Full build, strict qualification, publish receipt, and remote readback are bound before the signed deadline'
        : 'Full add-on ended without all required exact-byte evidence',
    });
  } else if (mutationLatest.state !== mutationState || mutationLatest.run_id !== runId) {
    throw new Error('Full add-on terminal mutation projection conflicts with exact run readback.');
  }
  const qualificationLatest = session.artifact_tracks.full.attempts
    .find((attempt) => attempt.attempt_id === qualificationAttemptId)!.events.at(-1)!;
  const qualificationState = passed ? 'passed' : observation.conclusion === 'cancelled' ? 'cancelled' : receipt ? 'failed' : 'runner_lost';
  if (!['passed', 'failed', 'cancelled'].includes(qualificationLatest.state)) {
    session = appendQualificationAttemptEvent(session, 'full', qualificationAttemptId, {
      at: completedAt, state: qualificationState,
      run_id: runId, conclusion: observation.conclusion,
      failure_taxonomy: passed ? 'none' : observation.conclusion === 'cancelled' ? 'cancelled' : receipt ? 'product' : 'infrastructure',
      remote_receipt_ref: receipt?.ref ?? null,
      remote_receipt_sha256: receipt?.sha256 ?? null,
      reason: passed
        ? 'Full add-on exact artifact and durable receipts validated before the signed deadline'
        : 'Full add-on evidence is incomplete; Standard terminal truth remains unchanged',
    });
  } else if (qualificationLatest.state !== qualificationState || qualificationLatest.run_id !== runId) {
    throw new Error('Full add-on terminal qualification projection conflicts with exact run evidence.');
  }
  if (addonTrackIsTerminal(session)) {
    const hasDebt = session.addon_tracks.full.status === 'blocked_with_debt' ||
      session.addon_tracks.webui.status === 'blocked_with_debt';
    session.terminal_truth = {
      ...session.terminal_truth,
      addon_status: hasDebt ? 'blocked_with_debt' : 'terminal',
    };
    if (session.phase === 'standard_stable_terminal') {
      session = transitionStableReleaseSession(
        session, 'addon_train_terminal', 'all declared add-ons reached verified or typed debt states', completedAt,
      );
    }
  }
  return session;
}

async function dispatchAndWatchFullAddon(
  session: StableReleaseSession,
  options: FullAddonOptions,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  if (!options.watch) {
    throw new Error('Executing Full add-on without the canonical deadline watcher is forbidden; use read-only status/reconcile in another process.');
  }
  if (!session.addon_tracks.full.required) throw new Error('This cohort did not declare the Full add-on.');
  if (session.terminal_truth.standard_status !== 'terminal') {
    throw new Error('Full add-on starts only after Standard Stable reaches its independent terminal state.');
  }
  if (
    session.phase !== 'standard_stable_terminal' || session.terminal_truth.addon_status !== 'pending' ||
    session.addon_tracks.full.status !== 'pending'
  ) {
    throw new Error(
      `Full add-on dispatch requires the original pending add-on state and cannot reopen terminal, failed, ` +
      `running, qualified, or typed-debt truth (phase=${session.phase}, status=${session.addon_tracks.full.status}).`,
    );
  }
  const existingAttempts = session.mutation_attempts.filter((attempt) => attempt.mutation === 'full_addon_dispatch').length;
  if (existingAttempts > 0) {
    throw new Error('Full add-on already has a durable attempt; use resume or reconcile and never refresh its signed clock.');
  }
  const controllerWorkflowSha = resolveCanonicalControllerWorkflowSha(runner, session);
  const dispatchedAt = now();
  const mutation = planReleaseMutationAttempt(session, {
    mutation: 'full_addon_dispatch', workflow: 'desktop-release-full-addon.yml', artifactKind: 'full',
    controllerWorkflowSha, artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
    mutationPayloadSha256: releaseMutationPayloadSha256(fullAddonMutationPayload(
      session, options.releaseSetGeneration, options.releaseSetManifestDigest, options.forceRebuildRuntimeCache,
    )),
    mutationPayload: fullAddonMutationPayload(
      session, options.releaseSetGeneration, options.releaseSetManifestDigest, options.forceRebuildRuntimeCache,
    ),
    at: dispatchedAt,
    reason: 'persist Full add-on mutation after Standard terminal and before external dispatch',
  });
  let plannedSession = mutation.session;
  plannedSession.addon_tracks = {
    ...plannedSession.addon_tracks,
    full: {
      ...plannedSession.addon_tracks.full,
      status: 'pending',
      release_set_generation: options.releaseSetGeneration,
      release_set_manifest_digest: options.releaseSetManifestDigest,
    },
  };
  const qualification = appendQualificationAttempt(plannedSession, {
    artifactKind: 'full', workflow: 'desktop-release-full-addon.yml', mutation: 'full_addon_dispatch',
    mutationAttemptId: mutation.attemptId, at: dispatchedAt,
    reason: 'record Full build and exact-artifact qualification as an independent add-on track',
  });
  session = qualification.session;
  writeSession(options.statePath, session);
  const fullPayload = fullAddonMutationPayload(
    session, options.releaseSetGeneration, options.releaseSetManifestDigest, options.forceRebuildRuntimeCache,
  );
  const accepted = executeBrokeredReleaseMutation(
    session,
    options.statePath,
    mutation.attemptId,
    fullPayload,
    { repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
    externalReleaseMutationBroker,
  );
  const acceptedRunId = exactAcceptedRunId(accepted.receipt, {
    repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null,
  });
  const fullAddonDeadlineAt = accepted.receipt.full_addon_deadline_at;
  const fullAddonDeadlineMs = Date.parse(String(fullAddonDeadlineAt));
  if (
    !fullAddonDeadlineAt || !Number.isFinite(fullAddonDeadlineMs) ||
    new Date(fullAddonDeadlineMs).toISOString() !== fullAddonDeadlineAt ||
    fullAddonDeadlineMs !== Date.parse(accepted.receipt.accepted_at) + 50 * 60 * 1_000
  ) {
    throw new Error('Full add-on broker acceptance lacks its exact signed 50-minute deadline.');
  }
  session = accepted.session;
  session = appendQualificationAttemptEvent(session, 'full', qualification.attemptId, {
    at: accepted.receipt.accepted_at, state: 'dispatching', run_id: acceptedRunId, conclusion: null,
    failure_taxonomy: 'none', remote_receipt_ref: null,
    reason: 'isolated broker accepted Full add-on mutation after durable planned state',
  });
  session.metrics = {
    ...session.metrics,
    workflow_dispatch_counts: {
      ...session.metrics.workflow_dispatch_counts,
      full_addon: session.metrics.workflow_dispatch_counts.full_addon + 1,
    },
  };
  session.addon_tracks = {
    ...session.addon_tracks,
    full: {
      ...session.addon_tracks.full,
      status: 'running',
      run_id: acceptedRunId,
      run_url: `https://github.com/${session.repo}/actions/runs/${acceptedRunId}`,
      conclusion: null,
      deadline_at: fullAddonDeadlineAt,
      deadline_blocker: null,
    },
  };
  writeSession(options.statePath, session);
  const run = await awaitAcceptedWorkflowRun(
    runner, session, acceptedRunId, mutation.attemptId, 'desktop-release-full-addon.yml', controllerWorkflowSha,
    'main', (next) => writeSession(options.statePath, next), fullAddonWatchDeadline(session, acceptedRunId),
  );
  const visibilityDeadlineBlocker = fullAddonDeadlineBlockedIfElapsed(session, acceptedRunId, run.status);
  if (visibilityDeadlineBlocker) {
    writeSession(options.statePath, visibilityDeadlineBlocker);
    throw new Error(
      `Full add-on run ${acceptedRunId} reached its signed 50-minute deadline during exact-run visibility; ` +
      'the durable debt blocker was recorded without changing Standard.',
    );
  }
  session.addon_tracks = {
    ...session.addon_tracks,
    full: { ...session.addon_tracks.full, run_url: run.url },
  };
  session = appendReleaseMutationAttemptEvent(session, mutation.attemptId, {
    at: now(), state: 'running', run_id: acceptedRunId, reason: 'exact broker-attributed Full add-on run read back',
  });
  session = appendQualificationAttemptEvent(session, 'full', qualification.attemptId, {
    at: now(), state: 'running', run_id: acceptedRunId, conclusion: null,
    failure_taxonomy: 'none', remote_receipt_ref: null, reason: 'exact broker-attributed Full add-on run read back',
  });
  writeSession(options.statePath, session);
  if (!options.watch) return session;

  const observation = await watchRunToTerminal(
    runner, session, acceptedRunId, (next) => writeSession(options.statePath, next), Date.now,
    fullAddonWatchDeadline(session, acceptedRunId),
  );
  session = finalizeFullAddonObservation(observation.session, observation, runner);
  writeSession(options.statePath, session);
  return session;
}

function addonTrackIsTerminal(session: StableReleaseSession): boolean {
  const full = session.addon_tracks.full;
  const webui = session.addon_tracks.webui;
  const fullTerminal = !full.required || ['qualified', 'blocked_with_debt'].includes(full.status);
  const webuiTerminal = !webui.required || ['verified', 'blocked_with_debt'].includes(webui.status);
  return fullTerminal && webuiTerminal;
}

export function applyAddonDebtDisposition(
  session: StableReleaseSession,
  addon: 'full' | 'webui',
  receiptPath: string,
): StableReleaseSession {
  if (session.terminal_truth.standard_status !== 'terminal') {
    throw new Error('Add-on debt disposition requires Standard Stable terminal truth.');
  }
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as unknown;
  const track = addon === 'full' ? session.addon_tracks.full : session.addon_tracks.webui;
  const errors = validateAddonDebtReceipt(receipt, {
    stableSessionId: session.id,
    releaseCohortRef: session.cohort_plan.operator_plan_ref,
    addon,
    trackStatus: track.status,
    runId: addon === 'full' ? session.addon_tracks.full.run_id : null,
  });
  if (errors.length > 0) throw new Error(`Add-on debt receipt invalid: ${errors.join('; ')}`);
  if (addon === 'full') {
    session.addon_tracks = {
      ...session.addon_tracks,
      full: { ...session.addon_tracks.full, status: 'blocked_with_debt', receipt_ref: receiptPath, receipt_sha256: sha256File(receiptPath) },
    };
  } else {
    session.addon_tracks = {
      ...session.addon_tracks,
      webui: { ...session.addon_tracks.webui, status: 'blocked_with_debt', receipt_ref: receiptPath, receipt_sha256: sha256File(receiptPath) },
    };
  }
  session.terminal_truth = { ...session.terminal_truth, addon_status: 'blocked_with_debt' };
  if (addonTrackIsTerminal(session) && session.phase === 'standard_stable_terminal') {
    session = transitionStableReleaseSession(session, 'addon_train_terminal', 'all declared add-ons reached verified or explicit typed debt disposition');
  }
  return session;
}

async function dispatchAndWatchQualificationRetry(
  session: StableReleaseSession,
  options: RetryQualificationOptions,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  assertStandardDeadlineOrPersist(
    session, options.statePath, 'qualification_retry_admission', session.qualification_run.id,
  );
  const verificationAppRef = options.smokeHarnessAppRef || workflowRef(session.cohort_plan);
  if (verificationAppRef !== 'main') {
    throw new Error('Qualification workflow must execute from canonical main; App changes require a new cohort.');
  }
  if (/^[0-9a-f]{7,40}$/i.test(verificationAppRef)) {
    throw new Error('Qualification retry App harness ref must be a remote branch or tag accepted by workflow_dispatch.');
  }
  const verificationShellRef = options.smokeHarnessShellRef || session.cohort_plan.cohort_lock.shell.resolved_sha;
  const verificationAppSha = resolveCanonicalControllerWorkflowSha(runner, session);
  const verificationShellSha = resolveRemoteGitRefSha(runner, 'gaofeng21cn/opl-aion-shell', verificationShellRef);
  const verificationHarness: QualificationVerificationHarness = {
    app_ref: verificationAppRef,
    app_sha: verificationAppSha,
    shell_ref: verificationShellRef,
    shell_sha: verificationShellSha,
    scope_proof: inspectQualificationHarnessScope(runner, {
      artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
      verificationAppSha,
      artifactShellSha: session.cohort_plan.cohort_lock.shell.resolved_sha,
      verificationShellSha,
      profile: options.artifactKind,
    }),
  };
  assertStandardDeadlineOrPersist(
    session, options.statePath, 'qualification_retry_harness_readback', session.qualification_run.id,
  );
  const dispatchedAt = now();
  const artifactKind = options.artifactKind;
  const track = session.artifact_tracks[artifactKind];
  if (!track.source_run_id || !track.source_artifact_name || !track.artifact_sha256) {
    throw new Error(`${artifactKind} same-artifact retry requires a previously validated independent artifact track.`);
  }
  const mutationPlanned = planReleaseMutationAttempt(session, {
    mutation: 'qualification_dispatch', workflow: 'opl-first-run-vm.yml', artifactKind,
    controllerWorkflowSha: verificationHarness.app_sha,
    artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
    mutationPayloadSha256: releaseMutationPayloadSha256(qualificationMutationPayload(session, verificationHarness, artifactKind)),
    mutationPayload: qualificationMutationPayload(session, verificationHarness, artifactKind),
    at: dispatchedAt, reason: 'persist same-artifact qualification mutation before external dispatch',
  });
  const planned = appendQualificationAttempt(mutationPlanned.session, {
    artifactKind, workflow: 'opl-first-run-vm.yml', mutation: 'qualification_dispatch',
    at: dispatchedAt, reason: `record ${artifactKind} same-artifact retry before workflow mutation`,
    verificationHarness,
    mutationAttemptId: mutationPlanned.attemptId,
  });
  session = planned.session;
  writeSession(options.statePath, session);
  const accepted = executeBrokeredReleaseMutation(
    session,
    options.statePath,
    mutationPlanned.attemptId,
    qualificationMutationPayload(session, verificationHarness, artifactKind),
    { repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
    externalReleaseMutationBroker,
  );
  const acceptedRunId = exactAcceptedRunId(accepted.receipt, {
    repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null,
  });
  session = accepted.session;
  session = appendQualificationAttemptEvent(session, artifactKind, planned.attemptId, {
    at: accepted.receipt.accepted_at, state: 'dispatching', run_id: acceptedRunId, conclusion: null, failure_taxonomy: 'none',
    remote_receipt_ref: null, reason: 'isolated broker accepted signed qualification mutation and same-artifact scope proof',
  });
  session.artifact_tracks = {
    ...session.artifact_tracks,
    [artifactKind]: {
      ...session.artifact_tracks[artifactKind],
      qualification_run: {
        ...session.artifact_tracks[artifactKind].qualification_run,
        verification_harness: verificationHarness,
      },
    },
  };
  if (artifactKind === 'standard') {
    session.qualification_run = { ...session.qualification_run, verification_harness: verificationHarness };
  }
  session = transitionStableReleaseSession(
    session,
    'retry_failed_gate_same_artifact',
    `broker accepted exact qualification run ${acceptedRunId} reusing ${artifactKind} artifact ${track.source_artifact_name} from run ${track.source_run_id}`,
  );
  session.metrics = {
    ...session.metrics,
    qualification_retry_count: session.metrics.qualification_retry_count + 1,
    reused_artifact_sha256: session.qualification_run.artifact_sha256,
    workflow_dispatch_counts: {
      ...session.metrics.workflow_dispatch_counts,
      qualification_retry: session.metrics.workflow_dispatch_counts.qualification_retry + 1,
    },
  };
  const runningQualification = {
    ...session.artifact_tracks[artifactKind].qualification_run,
    id: acceptedRunId,
    url: `https://github.com/${session.repo}/actions/runs/${acceptedRunId}`,
    conclusion: null,
    artifact_run_id: track.source_run_id,
    verification_harness: verificationHarness,
  };
  session.artifact_tracks = {
    ...session.artifact_tracks,
    [artifactKind]: { ...session.artifact_tracks[artifactKind], qualification_run: runningQualification },
  };
  if (artifactKind === 'standard') session.qualification_run = runningQualification;
  writeSession(options.statePath, session);
  const run = await awaitAcceptedWorkflowRun(
    runner, session, acceptedRunId, mutationPlanned.attemptId, 'opl-first-run-vm.yml', verificationHarness.app_sha,
    verificationHarness.app_ref, (next) => writeSession(options.statePath, next),
  );
  const visibleQualification = { ...runningQualification, url: run.url };
  session.artifact_tracks = {
    ...session.artifact_tracks,
    [artifactKind]: { ...session.artifact_tracks[artifactKind], qualification_run: visibleQualification },
  };
  if (artifactKind === 'standard') session.qualification_run = visibleQualification;
  session = appendReleaseMutationAttemptEvent(session, mutationPlanned.attemptId, {
    at: now(), state: 'running', run_id: acceptedRunId, reason: 'exact broker-attributed qualification run read back',
  });
  session = appendQualificationAttemptEvent(session, artifactKind, planned.attemptId, {
    at: now(), state: 'running', run_id: acceptedRunId, conclusion: null,
    failure_taxonomy: 'none', remote_receipt_ref: null, reason: 'exact broker-attributed qualification workflow run read back',
  });
  writeSession(options.statePath, session);
  if (!options.watch) return session;
  const observation = await watchRunToTerminal(
    runner, session, acceptedRunId, (next) => writeSession(options.statePath, next),
  );
  session = observation.session;
  const { readback } = observation;
  const retryRunId = String(readback.databaseId);
  const sourceRunId = track.source_run_id;
  let qualification: { receipt: ArtifactQualificationReceiptV1; sha256: string } | null = null;
  session = finalizeStandardEvidenceBeforeDeadline(
    session,
    options.statePath,
    'qualification_retry_finalization',
    retryRunId,
    () => {
      const manifest = readBuildArtifactManifest(runner, session, sourceRunId, artifactKind);
      const expectedResult = observation.succeeded ? 'passed' : 'failed';
      qualification = readQualificationReceipt(
        runner, session, retryRunId, sourceRunId, expectedResult, artifactKind, manifest,
      );
      if (!manifest || !qualification) {
        return transitionStableReleaseSession(
          session, 'qualification_failed', 'qualification retry did not produce a valid same-artifact receipt',
        );
      }
      let finalized = bindQualificationEvidence(
        session, manifest, retryRunId, observation.succeeded ? 'success' : 'failure', qualification.sha256, artifactKind,
      );
      finalized.metrics = { ...finalized.metrics, reused_artifact_sha256: manifest.manifest.artifact.sha256 };
      return transitionStableReleaseSession(
        finalized,
        observation.succeeded ? 'artifacts_qualified' : 'qualification_failed',
        observation.succeeded ? 'same exact artifact passed clean-VM qualification' : 'same exact artifact qualification retry failed',
      );
    },
  );
  session = appendQualificationAttemptEvent(session, artifactKind, planned.attemptId, {
    at: now(), state: session.phase === 'artifacts_qualified' ? 'passed' : observation.conclusion === 'cancelled' ? 'cancelled' : 'failed',
    run_id: retryRunId, conclusion: observation.conclusion,
    failure_taxonomy: session.phase === 'artifacts_qualified' ? 'none' : observation.conclusion === 'cancelled' ? 'cancelled' : 'unknown',
    remote_receipt_ref: qualification ? `opl-first-run-vm-${artifactKind}-${retryRunId}` : null,
    reason: qualification ? 'strict exact-artifact qualification receipt validated' : 'strict receipt missing or invalid; reconcile required',
  });
  session = appendReleaseMutationAttemptEvent(session, mutationPlanned.attemptId, {
    at: now(),
    state: session.phase === 'artifacts_qualified' ? 'succeeded' : observation.conclusion === 'cancelled' ? 'cancelled' : 'failed',
    run_id: retryRunId, reason: `qualification workflow concluded ${observation.conclusion ?? 'unknown'}`,
  });
  writeSession(options.statePath, session);
  return session;
}

export async function resumeSession(
  options: ResumeOptions,
  runner: StableReleaseCommandRunner,
  clock: () => number = Date.now,
): Promise<StableReleaseSession> {
  let session = readSession(options.statePath);
  if (!options.execute) return session;
  const isRunningFullAddon = session.terminal_truth.standard_status === 'terminal' && session.addon_tracks.full.status === 'running';
  if (isRunningFullAddon) {
    const runId = session.addon_tracks.full.run_id;
    if (!runId) throw new Error('Running Full add-on has no exact workflow run id.');
    const deadlineBlocked = fullAddonDeadlineBlockedIfElapsed(session, runId, 'resume_admission', clock());
    if (deadlineBlocked) {
      writeSession(options.statePath, deadlineBlocked);
      throw new Error('Full add-on resume reached its signed 50-minute deadline; typed debt is durable.');
    }
  } else {
    assertStandardDeadlineOrPersist(
      session,
      options.statePath,
      'resume_admission',
      session.promotion_run.id ?? session.qualification_run.id ?? session.release_run.id,
      clock(),
    );
  }
  if (session.phase === 'artifact_build_failed') {
    if (!session.release_run.id) throw new Error('Artifact build failure has no original workflow run id.');
    session = transitionStableReleaseSession(
      session,
      'artifact_build_running',
      `reconciling original release run ${session.release_run.id} after a nonterminal monitor exit`,
      new Date(clock()).toISOString(),
    );
    session.release_run = { ...session.release_run, conclusion: null };
    writeSession(options.statePath, session);
  }
  if (session.phase === 'promotion_failed') {
    throw new Error('Low-level workflow rerun is forbidden because it replays the original signed ticket. Reconcile first, then create a new controller mutation attempt.');
  }
  const isRelease = session.phase === 'artifact_build_running';
  const isQualification = session.phase === 'retry_failed_gate_same_artifact';
  const isPromotion = session.phase === 'promotion_running';
  const isFullAddon = session.terminal_truth.standard_status === 'terminal' && session.addon_tracks.full.status === 'running';
  if (!isRelease && !isQualification && !isPromotion && !isFullAddon) {
    throw new Error(
      `Resume requires artifact_build_running, retry_failed_gate_same_artifact, promotion_running, or a running Full add-on, ` +
      `got phase=${session.phase} full=${session.addon_tracks.full.status}.`,
    );
  }
  const runId = isRelease
    ? session.release_run.id
    : isQualification
      ? session.qualification_run.id
      : isPromotion
        ? session.promotion_run.id
        : session.addon_tracks.full.run_id;
  if (!runId) throw new Error(`Session phase ${session.phase} has no workflow run id.`);
  const observation = await watchRunToTerminal(
    runner, session, runId, (next) => writeSession(options.statePath, next),
    clock, isFullAddon ? fullAddonWatchDeadline(session, runId) : undefined,
  );
  session = observation.session;
  const { readback } = observation;
  if (isRelease) {
    session.release_run = {
      id: String(readback.databaseId),
      url: readback.url,
      conclusion: observation.conclusion,
    };
    session = finalizeStandardEvidenceBeforeDeadline(
      session,
      options.statePath,
      'resume_release_finalization',
      String(readback.databaseId),
      () => finalizeReleaseRun(session, String(readback.databaseId), observation.succeeded, runner, clock),
      clock,
    );
  } else if (isQualification) {
    const sourceRunId = session.release_run.id!;
    const retryRunId = String(readback.databaseId);
    session = finalizeStandardEvidenceBeforeDeadline(
      session,
      options.statePath,
      'resume_qualification_finalization',
      retryRunId,
      () => {
        const manifest = readBuildArtifactManifest(runner, session, sourceRunId);
        const qualification = manifest ? readQualificationReceipt(
          runner,
          session,
          retryRunId,
          sourceRunId,
          observation.succeeded ? 'passed' : 'failed',
          'standard',
          manifest,
        ) : null;
        if (!manifest || !qualification) {
          return transitionStableReleaseSession(
            session,
            'qualification_failed',
            'resumed qualification did not produce a valid same-artifact receipt',
            new Date(clock()).toISOString(),
          );
        }
        let finalized = bindQualificationEvidence(
          session, manifest, retryRunId, observation.succeeded ? 'success' : 'failure', qualification.sha256,
        );
        finalized.metrics = { ...finalized.metrics, reused_artifact_sha256: manifest.manifest.artifact.sha256 };
        return transitionStableReleaseSession(
          finalized,
          observation.succeeded ? 'artifacts_qualified' : 'qualification_failed',
          observation.succeeded ? 'resumed same-artifact qualification passed' : 'resumed same-artifact qualification failed',
          new Date(clock()).toISOString(),
        );
      },
      clock,
    );
  } else if (isPromotion) {
    session.promotion_run = {
      id: String(readback.databaseId),
      url: readback.url,
      conclusion: observation.conclusion,
      attempt: readback.attempt ?? session.promotion_run.attempt ?? 1,
      rerun_requested_from_attempt: session.promotion_run.rerun_requested_from_attempt,
    };
    session = finalizeStandardEvidenceBeforeDeadline(
      session,
      options.statePath,
      'resume_promotion_finalization',
      String(readback.databaseId),
      () => finalizePromotionRun(session, String(readback.databaseId), observation.succeeded, runner, clock),
      clock,
    );
  } else {
    session = finalizeFullAddonObservation(session, observation, runner, clock);
  }
  writeSession(options.statePath, session);
  return session;
}

function parseStartArgs(argv: string[]): StartOptions {
  const trainArgs: string[] = [];
  let execute = false;
  let watch = true;
  let repo = defaultRepo;
  let statePath = '';
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--execute') {
      execute = true;
      continue;
    }
    if (token === '--no-watch') {
      watch = false;
      continue;
    }
    if (token === '--repo' || token === '--state') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}.`);
      if (token === '--repo') repo = value;
      else statePath = value;
      index += 1;
      continue;
    }
    trainArgs.push(token);
  }
  const cohort = parseReleaseCohortPlanArgs(trainArgs);
  return {
    execute,
    watch,
    repo,
    statePath: path.resolve(statePath || `release-session-v${cohort.version}.json`),
    cohort,
  };
}

function parsePromoteArgs(argv: string[]): PromoteOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      execute: { type: 'boolean' },
      'no-watch': { type: 'boolean' },
      repo: { type: 'string' },
      state: { type: 'string' },
      'release-owner-receipt-ref': { type: 'string' },
      'release-set-generation': { type: 'string' },
    },
  });
  if (!values.state) throw new Error('Pass --state <release-session.json>.');
  if (!values['release-set-generation']) throw new Error('Pass --release-set-generation <YY.M.D[-rN]>.');
  return {
    execute: values.execute === true,
    watch: values['no-watch'] !== true,
    repo: values.repo || defaultRepo,
    statePath: path.resolve(values.state),
    ownerReceiptRef: values['release-owner-receipt-ref'] || '',
    releaseSetGeneration: values['release-set-generation'],
  };
}

function parseResumeArgs(argv: string[]): ResumeOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: { state: { type: 'string' }, execute: { type: 'boolean' } },
  });
  if (!values.state) throw new Error('Pass --state <release-session.json>.');
  return { statePath: path.resolve(values.state), execute: values.execute === true };
}

function parseRetryQualificationArgs(argv: string[]): RetryQualificationOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      execute: { type: 'boolean' },
      'no-watch': { type: 'boolean' },
      state: { type: 'string' },
      'artifact-kind': { type: 'string' },
      'smoke-harness-app-ref': { type: 'string' },
      'smoke-harness-shell-ref': { type: 'string' },
    },
  });
  if (!values.state) throw new Error('Pass --state from the original release run.');
  if (values['artifact-kind'] && values['artifact-kind'] !== 'standard' && values['artifact-kind'] !== 'full') {
    throw new Error('--artifact-kind must be standard or full.');
  }
  return {
    execute: values.execute === true,
    watch: values['no-watch'] !== true,
    statePath: path.resolve(values.state),
    artifactKind: values['artifact-kind'] === 'full' ? 'full' : 'standard',
    smokeHarnessAppRef: values['smoke-harness-app-ref'],
    smokeHarnessShellRef: values['smoke-harness-shell-ref'],
  };
}

function parseCompleteLocalArgs(argv: string[]): CompleteLocalOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      state: { type: 'string' }, receipt: { type: 'string' }, 'local-authorization-policy': { type: 'string' },
    },
  });
  if (!values.state || !values.receipt || !values['local-authorization-policy']) {
    throw new Error('Pass --state, --receipt, and --local-authorization-policy exact files.');
  }
  return {
    statePath: path.resolve(values.state),
    receiptPath: path.resolve(values.receipt),
    localAuthorizationPolicyPath: path.resolve(values['local-authorization-policy']),
  };
}

function parseReconcileArgs(argv: string[]): ReconcileOptions {
  const { values } = parseNodeArgs({ args: argv, options: { state: { type: 'string' } }, strict: true });
  if (!values.state) throw new Error('reconcile requires --state <path>.');
  return { statePath: path.resolve(values.state) };
}

function parseRecoverStaleLockArgs(argv: string[]): RecoverStaleLockOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: { state: { type: 'string' }, 'session-id': { type: 'string' }, revision: { type: 'string' } },
    strict: true,
  });
  const revision = Number(values.revision);
  if (!values.state || !values['session-id'] || !Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('recover-stale-lock requires --state, --session-id, and a non-negative integer --revision.');
  }
  return { statePath: path.resolve(values.state), sessionId: values['session-id'], revision };
}

function parseCancelArgs(argv: string[]): CancelOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: { state: { type: 'string' }, target: { type: 'string' }, reason: { type: 'string' }, execute: { type: 'boolean' } },
    strict: true,
  });
  if (!values.state || !values.target || !/^\d+$/.test(values.target) || !values.reason?.trim()) {
    throw new Error('cancel requires --state, numeric --target, and non-empty --reason.');
  }
  return { statePath: path.resolve(values.state), targetRunId: values.target, reason: values.reason.trim(), execute: values.execute === true };
}

function parseFullAddonArgs(argv: string[]): FullAddonOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      state: { type: 'string' }, execute: { type: 'boolean' }, 'no-watch': { type: 'boolean' },
      'release-set-generation': { type: 'string' }, 'release-set-manifest-digest': { type: 'string' },
      'force-rebuild-runtime-cache': { type: 'boolean' },
    },
    strict: true,
  });
  if (!values.state || !values['release-set-generation'] || !values['release-set-manifest-digest']) {
    throw new Error('dispatch-full-addon requires --state, --release-set-generation, and --release-set-manifest-digest.');
  }
  return {
    statePath: path.resolve(values.state), execute: values.execute === true, watch: values['no-watch'] !== true,
    releaseSetGeneration: values['release-set-generation'],
    releaseSetManifestDigest: values['release-set-manifest-digest'],
    forceRebuildRuntimeCache: values['force-rebuild-runtime-cache'] === true,
  };
}

function parseAddonDebtArgs(argv: string[]): AddonDebtOptions {
  const { values } = parseNodeArgs({
    args: argv, options: { state: { type: 'string' }, addon: { type: 'string' }, receipt: { type: 'string' } }, strict: true,
  });
  if (!values.state || !values.receipt || (values.addon !== 'full' && values.addon !== 'webui')) {
    throw new Error('disposition-addon-debt requires --state, --addon full|webui, and --receipt.');
  }
  return { statePath: path.resolve(values.state), addon: values.addon, receiptPath: path.resolve(values.receipt) };
}

function printSession(session: StableReleaseSession): void {
  process.stdout.write(`${JSON.stringify(session, null, 2)}\n`);
}

function planSession(options: StartOptions, startedAt = now()): StableReleaseSession {
  return buildStableReleaseSession(
    buildReleaseCohortPlan(options.cohort, undefined, startedAt),
    options.repo,
    startedAt,
  );
}

function persistStandardDeadlineBlocker(
  session: StableReleaseSession,
  statePath: string,
  stage: string,
  runId: string | null,
  observedAtMs: number,
): StableReleaseSession {
  const blocked = standardDeadlineBlockedSession(session, stage, runId, observedAtMs);
  writeSession(statePath, blocked);
  return blocked;
}

function assertStandardDeadlineOrPersist(
  session: StableReleaseSession,
  statePath: string,
  stage: string,
  runId: string | null,
  observedAtMs = Date.now(),
): void {
  if (
    session.terminal_truth.standard_status === 'in_progress' &&
    remainingStandardAdmissionBudgetMs(session, observedAtMs) <= 0
  ) {
    persistStandardDeadlineBlocker(session, statePath, stage, runId, observedAtMs);
    throw new Error(
      `${stage} cannot continue at or after the immutable 90-minute Standard deadline; ` +
      'the typed blocker is durable and no success transition is permitted.',
    );
  }
}

function finalizeStandardEvidenceBeforeDeadline(
  session: StableReleaseSession,
  statePath: string,
  stage: string,
  runId: string | null,
  finalize: () => StableReleaseSession,
  clock: () => number = Date.now,
): StableReleaseSession {
  assertStandardDeadlineOrPersist(session, statePath, `${stage}:before_evidence`, runId, clock());
  let finalized: StableReleaseSession;
  try {
    finalized = finalize();
  } catch (error) {
    const failedAtMs = clock();
    if (
      session.terminal_truth.standard_status === 'in_progress' &&
      remainingStandardAdmissionBudgetMs(session, failedAtMs) <= 0
    ) {
      persistStandardDeadlineBlocker(session, statePath, `${stage}:evidence_readback`, runId, failedAtMs);
      throw new Error(
        `${stage} crossed the immutable 90-minute Standard deadline during evidence readback; ` +
        'the typed blocker is durable and late success was ignored.',
        { cause: error },
      );
    }
    throw error;
  }
  const finalizedAtMs = clock();
  if (
    session.terminal_truth.standard_status === 'in_progress' &&
    remainingStandardAdmissionBudgetMs(session, finalizedAtMs) <= 0
  ) {
    persistStandardDeadlineBlocker(session, statePath, `${stage}:after_evidence`, runId, finalizedAtMs);
    throw new Error(
      `${stage} crossed the immutable 90-minute Standard deadline during evidence readback; ` +
      'the typed blocker is durable and late success was ignored.',
    );
  }
  writeSession(statePath, finalized);
  const durableAtMs = clock();
  if (
    finalized.terminal_truth.standard_status === 'in_progress' &&
    remainingStandardAdmissionBudgetMs(finalized, durableAtMs) <= 0
  ) {
    persistStandardDeadlineBlocker(finalized, statePath, `${stage}:durable_commit`, runId, durableAtMs);
    throw new Error(
      `${stage} did not become durable before the immutable 90-minute Standard deadline; ` +
      'the final durable truth is the typed blocker.',
    );
  }
  return finalized;
}

export async function start(
  options: StartOptions,
  runner: StableReleaseCommandRunner,
  clock: () => number = Date.now,
): Promise<StableReleaseSession> {
  const startedAtMs = clock();
  const startedAt = new Date(startedAtMs).toISOString();
  let session = planSession(options, startedAt);
  if (!options.execute) return session;
  if (!options.watch) {
    throw new Error('Executing Standard without the canonical 90-minute watcher is forbidden; use read-only status/reconcile in another process.');
  }
  if (fs.existsSync(options.statePath)) {
    let current = 'unreadable';
    try {
      const existing = readSession(options.statePath);
      current = `${existing.id} phase=${existing.phase} revision=${existing.revision}`;
    } catch {
      // An unreadable existing file is still never safe to replace.
    }
    throw new Error(
      `Stable release session already exists at ${options.statePath} (${current}); ` +
      'use status, reconcile, or resume instead of start.',
    );
  }
  createSession(options.statePath, session);

  const planningFinishedAtMs = clock();
  if (remainingStandardAdmissionBudgetMs(session, planningFinishedAtMs) <= 0) {
    const reason = 'cohort planning exhausted the immutable 90-minute Standard admission deadline before source gates';
    persistStandardDeadlineBlocker(session, options.statePath, 'cohort_planning', null, planningFinishedAtMs);
    throw new Error(reason);
  }

  for (let index = 0; index < session.source_gates.length; index += 1) {
    const gate = session.source_gates[index];
    const gateStartedAtMs = clock();
    const remainingGateBudgetMs = remainingStandardAdmissionBudgetMs(session, gateStartedAtMs);
    if (remainingGateBudgetMs <= 0) {
      const reason = `source gate ${gate.id} could not start before the immutable 90-minute Standard admission deadline`;
      persistStandardDeadlineBlocker(
        session, options.statePath, `source_gate:${gate.id}`, null, gateStartedAtMs,
      );
      throw new Error(reason);
    }
    const result = runner('bash', ['-lc', gate.command], { timeoutMs: Math.max(1, remainingGateBudgetMs) });
    const gateFinishedAtMs = clock();
    const deadlineElapsed = remainingStandardAdmissionBudgetMs(session, gateFinishedAtMs) <= 0;
    const hardSloFailed = result.timedOut === true || deadlineElapsed;
    session.source_gates[index] = {
      ...gate,
      status: !hardSloFailed && result.status === 0 ? 'passed' : 'failed',
    };
    writeSession(options.statePath, session);
    if (hardSloFailed) {
      const reason = result.timedOut === true
        ? `source gate ${gate.id} timed out against the immutable 90-minute Standard admission deadline`
        : `source gate ${gate.id} returned after the immutable 90-minute Standard admission deadline elapsed`;
      persistStandardDeadlineBlocker(
        session, options.statePath, `source_gate:${gate.id}`, null, gateFinishedAtMs,
      );
      throw new Error(reason);
    }
    if (result.status !== 0) {
      session = transitionStableReleaseSession(
        session, 'source_gate_failed', `source gate ${gate.id} failed`, new Date(gateFinishedAtMs).toISOString(),
      );
      writeSession(options.statePath, session);
      failResult(result, `source gate ${gate.id}`);
    }
  }
  const gatesFinishedAtMs = clock();
  if (remainingStandardAdmissionBudgetMs(session, gatesFinishedAtMs) <= 0) {
    const reason = 'source gate persistence exhausted the immutable 90-minute Standard admission deadline before dispatch';
    persistStandardDeadlineBlocker(
      session, options.statePath, 'source_gate_persistence', null, gatesFinishedAtMs,
    );
    throw new Error(reason);
  }
  session = transitionStableReleaseSession(
    session, 'source_gates_passed', 'all deduplicated cheap source gates passed', new Date(gatesFinishedAtMs).toISOString(),
  );
  writeSession(options.statePath, session);
  return dispatchAndWatchRelease(session, options.statePath, options.watch, runner);
}

async function promote(options: PromoteOptions, runner: StableReleaseCommandRunner): Promise<StableReleaseSession> {
  let session = readSession(options.statePath);
  if (session.phase !== 'artifacts_qualified' && session.phase !== 'promotion_failed') {
    throw new Error(`Promotion requires artifacts_qualified or promotion_failed state, got ${session.phase}.`);
  }
  if (!options.execute) return session;
  if (!options.watch) {
    throw new Error('Executing promotion without the canonical 90-minute watcher is forbidden; use read-only status/reconcile in another process.');
  }
  return dispatchAndWatchPromotion(
    session,
    options.statePath,
    options.ownerReceiptRef,
    options.releaseSetGeneration,
    options.watch,
    runner,
  );
}

async function retryQualification(
  options: RetryQualificationOptions,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  const session = readSession(options.statePath);
  if (session.phase !== 'qualification_failed') {
    throw new Error(`Qualification retry requires qualification_failed state, got ${session.phase}.`);
  }
  if (!options.execute) return session;
  if (!options.watch) {
    throw new Error('Executing qualification recovery without the canonical 90-minute watcher is forbidden; use read-only status/reconcile in another process.');
  }
  return dispatchAndWatchQualificationRetry(session, options, runner);
}

function identifyCancelableRun(session: StableReleaseSession, runId: string): {
  targetAttemptId: string;
  workflow: ReleaseSessionLeaseV2['workflow'];
  artifactKind: ReleaseSessionLeaseV2['artifact_kind'];
  controllerWorkflowSha: string;
} {
  const attempt = [...session.mutation_attempts].reverse().find((entry) =>
    entry.mutation !== 'workflow_cancel' && entry.events.some((event) => event.run_id === runId),
  );
  if (!attempt) throw new Error(`Workflow run ${runId} has no exact durable mutation attempt in this stable release session.`);
  if (attempt.admission_mode === 'admin_one_shot_controller') {
    throw new Error('Admin one-shot release attempts cannot be cancelled; use read-only reconcile until terminal.');
  }
  if (['succeeded', 'failed', 'cancelled'].includes(attempt.events.at(-1)?.state ?? '')) {
    throw new Error(`Workflow run ${runId} belongs to terminal mutation attempt ${attempt.attempt_id} and cannot be cancelled.`);
  }
  return {
    targetAttemptId: attempt.attempt_id,
    workflow: attempt.workflow,
    artifactKind: attempt.artifact_kind,
    controllerWorkflowSha: attempt.controller_workflow_sha,
  };
}

export function dispatchEmergencyCancel(
  session: StableReleaseSession,
  statePath: string,
  targetRunId: string,
  reason: string,
  _readOnlyRunner: StableReleaseCommandRunner,
  at = now(),
  persist: typeof writeSession = writeSession,
  broker: ReleaseMutationBroker = externalReleaseMutationBroker,
  authorityOverride?: ReturnType<typeof readReleaseBrokerAuthority>,
  clock: () => number = Date.now,
): StableReleaseSession {
  const target = identifyCancelableRun(session, targetRunId);
  const requestedAtMs = Date.parse(at);
  if (!Number.isFinite(requestedAtMs)) throw new Error('Emergency cancel timestamp must be valid UTC ISO-8601.');
  const admissionObservedAtMs = Math.max(requestedAtMs, clock());
  let effectiveAt = at;
  if (
    session.terminal_truth.standard_status === 'in_progress' &&
    remainingStandardAdmissionBudgetMs(session, admissionObservedAtMs) <= 0
  ) {
    session = standardDeadlineBlockedSession(
      session,
      'emergency_cancel_admission',
      targetRunId,
      admissionObservedAtMs,
    );
    persist(statePath, session);
    effectiveAt = new Date(admissionObservedAtMs).toISOString();
  }
  const payload: ReleaseMutationPayload = {
    opl_version: session.version,
    stable_session_id: session.id,
    release_cohort_ref: session.cohort_plan.operator_plan_ref,
    target_attempt_id: target.targetAttemptId,
    target_run_id: targetRunId,
    reason,
    operator_actor: releaseOperatorActor(),
  };
  const planned = planReleaseMutationAttempt(session, {
    mutation: 'workflow_cancel', workflow: target.workflow, artifactKind: target.artifactKind,
    controllerWorkflowSha: target.controllerWorkflowSha,
    artifactAppSha: session.cohort_plan.cohort_lock.app.resolved_sha,
    mutationPayloadSha256: releaseMutationPayloadSha256(payload),
    mutationPayload: payload,
    targetAttemptId: target.targetAttemptId,
    targetRunId, at: effectiveAt, reason: `emergency cancel planned: ${reason}`,
  });
  session = planned.session;
  persist(statePath, session);
  const accepted = executeBrokeredReleaseMutation(
    session,
    statePath,
    planned.attemptId,
    payload,
    { repository: session.repo, operation: 'workflow_cancel', workflow_ref: null, target_run_id: targetRunId },
    broker,
    authorityOverride,
    persist,
    clock,
  );
  return accepted.session;
}

export function completeLocalActivation(
  options: CompleteLocalOptions,
  observedAtMs = Date.now(),
  clock: () => number = Date.now,
): StableReleaseSession {
  let session = readSession(options.statePath);
  if (session.phase !== 'awaiting_local_activation') {
    throw new Error(`Local activation completion requires awaiting_local_activation state, got ${session.phase}.`);
  }
  const blockIfDeadlineElapsed = (stage: string, atMs: number): void => {
    if (remainingStandardAdmissionBudgetMs(session, atMs) > 0) return;
    session = standardDeadlineBlockedSession(
      session, stage, session.promotion_run.id, atMs,
    );
    writeSession(options.statePath, session);
    throw new Error(
      'Local activation cannot create a successful Standard terminal at or after the immutable 90-minute deadline; ' +
      'the typed blocker is durable.',
    );
  };
  blockIfDeadlineElapsed('complete_local_activation:entry', observedAtMs);
  const artifactSha256 = session.qualification_run.artifact_sha256;
  if (
    typeof artifactSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(artifactSha256) ||
    session.artifact_tracks.standard.artifact_sha256 !== artifactSha256
  ) {
    throw new Error('Local activation completion requires the exact qualified Standard artifact SHA-256.');
  }
  const receiptBytes = fs.readFileSync(options.receiptPath);
  const policyBytes = fs.readFileSync(options.localAuthorizationPolicyPath);
  blockIfDeadlineElapsed('complete_local_activation:evidence_read', clock());
  const receipt = JSON.parse(receiptBytes.toString('utf8')) as unknown;
  const policySha256 = crypto.createHash('sha256').update(policyBytes).digest('hex');
  const errors = validateLocalActivationReceipt(receipt, {
    stableSessionId: session.id,
    version: session.version,
    artifactSha256,
    localAuthorizationPolicySha256: policySha256,
  });
  if (errors.length > 0) throw new Error(`Local activation receipt invalid: ${errors.join('; ')}`);
  const finalizedAtMs = clock();
  blockIfDeadlineElapsed('complete_local_activation:evidence_validation', finalizedAtMs);
  session.receipts = {
    ...session.receipts,
    local_activation: {
      ref: options.receiptPath,
      sha256: crypto.createHash('sha256').update(receiptBytes).digest('hex'),
    },
  };
  session = transitionStableReleaseSession(
    session,
    'standard_stable_terminal',
    'same-version local installation and CDP Home/Settings/Capabilities readback passed',
    new Date(finalizedAtMs).toISOString(),
  );
  writeSession(options.statePath, session);
  return session;
}

async function main(): Promise<void> {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`Usage:\n  npm run release:stable -- plan <cohort options> [--state <path>]\n  npm run release:stable -- start <cohort options> [--state <path>] [--execute] [--no-watch]\n  npm run release:stable -- status --state <path>\n  npm run release:stable -- retry-qualification --state <path> [--smoke-harness-app-ref <branch-or-tag>] [--smoke-harness-shell-ref <ref>] [--execute] [--no-watch]\n  npm run release:stable -- reconcile --state <path>\n  npm run release:stable -- resume --state <path> [--execute]\n  npm run release:stable -- promote --state <path> --release-set-generation <YY.M.D[-rN]> --release-owner-receipt-ref <ref> [--execute] [--no-watch]\n  npm run release:stable -- dispatch-full-addon --state <path> --release-set-generation <generation> --release-set-manifest-digest <sha256:...> [--execute] [--no-watch]\n  npm run release:stable -- disposition-addon-debt --state <path> --addon full|webui --receipt <typed-receipt.json>\n  npm run release:stable -- cancel --state <path> --target <run-id> --reason <text> --execute\n  npm run release:stable -- recover-stale-lock --state <path> --session-id <sha256:...> --revision <n>\n  npm run release:stable -- complete-local --state <path> --receipt <local-activation-receipt.json> --local-authorization-policy <policy.json>\n\nPlan and dry-run are pure reads. start --execute creates a new session only when --state is absent. Each external mutation receives a fresh per-attempt signed broker lease and also requires --execute.\n`);
    return;
  }
  if (command === 'plan') {
    const options = parseStartArgs(argv);
    printSession(planSession({ ...options, execute: false }));
    return;
  }
  if (command === 'start') {
    const options = parseStartArgs(argv);
    printSession(await start(options, run));
    return;
  }
  if (command === 'status') {
    const options = parseReconcileArgs(argv);
    printSession(readSession(options.statePath));
    return;
  }
  if (command === 'promote') {
    printSession(await promote(parsePromoteArgs(argv), run));
    return;
  }
  if (command === 'retry-qualification') {
    printSession(await retryQualification(parseRetryQualificationArgs(argv), run));
    return;
  }
  if (command === 'dispatch-full-addon') {
    const options = parseFullAddonArgs(argv);
    let session = readSession(options.statePath);
    if (options.execute) session = await dispatchAndWatchFullAddon(session, options, run);
    printSession(session);
    return;
  }
  if (command === 'disposition-addon-debt') {
    const options = parseAddonDebtArgs(argv);
    const session = applyAddonDebtDisposition(readSession(options.statePath), options.addon, options.receiptPath);
    writeSession(options.statePath, session);
    printSession(session);
    return;
  }
  if (command === 'resume') {
    printSession(await resumeSession(parseResumeArgs(argv), run));
    return;
  }
  if (command === 'reconcile') {
    const options = parseReconcileArgs(argv);
    const current = readSession(options.statePath);
    const evidence = createReconcileEvidenceReader(run, current);
    try {
      const session = reconcileStableReleaseSession(current, {
        readRun: (runId, attempt) => {
          const result = runView(run, current, runId, Date.now, 'read_only_reconcile').readback;
          const workflow = result
            ? Object.entries(workflowNames).find(([, name]) => name === result.workflowName)?.[0] ?? result.workflowName ?? ''
            : '';
          return result ? {
            databaseId: String(result.databaseId),
            status: result.status,
            conclusion: result.conclusion || null,
            runAttempt: result.attempt ?? 0,
            workflow,
            controllerWorkflowSha: result.headSha,
            mutationAttemptId: result.displayTitle?.match(/ attempt=(sha256:[0-9a-f]{64})$/)?.[1] ?? '',
            headBranch: result.headBranch,
            event: result.event ?? '',
            createdAt: result.createdAt,
            url: result.url,
          } : null;
        },
        discoverAdminRuns: (attempt) => {
          const result = run('gh', [
            'run', 'list', '--repo', current.repo, '--workflow', attempt.workflow,
            '--event', 'workflow_dispatch', '--branch', 'main', '--limit', '100',
            '--json', 'databaseId,attempt,createdAt,headBranch,headSha,displayTitle,workflowName,event,status,conclusion,url',
          ], { timeoutMs: readOnlyReleaseTransportTimeoutMs() });
          if (result.status !== 0) failResult(result, `reconcile admin one-shot ${attempt.workflow}`);
          let runs: WorkflowRun[];
          try {
            runs = JSON.parse(result.stdout) as WorkflowRun[];
          } catch (error) {
            throw new Error(`admin one-shot reconcile returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
          }
          return runs.filter((candidate) =>
            candidate.displayTitle?.endsWith(` attempt=${attempt.attempt_id}`),
          ).map((candidate) => ({
            databaseId: String(candidate.databaseId), status: candidate.status,
            conclusion: candidate.conclusion || null, runAttempt: candidate.attempt ?? 0,
            workflow: attempt.workflow, controllerWorkflowSha: candidate.headSha,
            mutationAttemptId: candidate.displayTitle?.match(/ attempt=(sha256:[0-9a-f]{64})$/)?.[1] ?? '',
            headBranch: candidate.headBranch, event: candidate.event ?? '',
            createdAt: candidate.createdAt, url: candidate.url,
          }));
        },
        readPromotionJobs: (runId) => {
          const result = run('gh', [
            'run', 'view', runId, '--repo', current.repo, '--json', 'jobs', '--jq', '.jobs',
          ], { timeoutMs: readOnlyReleaseTransportTimeoutMs() });
          if (result.status !== 0) failResult(result, `reconcile promotion checkpoint jobs ${runId}`);
          try {
            const jobs = JSON.parse(result.stdout) as unknown;
            if (!Array.isArray(jobs)) throw new Error('jobs payload is not an array');
            return jobs as PromotionWorkflowJob[];
          } catch (error) {
            throw new Error(
              `promotion checkpoint reconcile returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        },
        readBrokerRecord: (lookup) => externalReleaseMutationBrokerLedgerLookup(lookup),
        readBuildManifest: (artifactKind, sourceRunId) => evidence.readJson<BuildArtifactCohortV2>(
          sourceRunId,
          `${expectedBuildArtifactName(current, artifactKind)}-cohort`,
          'opl-build-cohort.json',
        ),
        readStrictQualificationReceipt: (artifactKind, qualificationRunId) => evidence.readJson<ArtifactQualificationReceiptV1>(
          qualificationRunId,
          `opl-first-run-vm-${artifactKind}-${qualificationRunId}`,
          'artifact-qualification-receipt.json',
        ),
        readSmokeSummary: (artifactKind, qualificationRunId) => evidence.readJson<Record<string, unknown>>(
          qualificationRunId,
          `opl-first-run-vm-${artifactKind}-${qualificationRunId}`,
          'tart-smoke-summary.json',
        ),
        readFullAddonReceipt: (runId) => evidence.readJson<FullAddonReceiptV1>(
          runId,
          `opl-app-full-addon-receipt-${current.version}-${runId}`,
          'opl-app-full-addon-receipt.json',
        ),
        readAttemptReceipt: (artifactKind, runId) => {
          const result = evidence.readJson<QualificationAttemptReceiptV1>(
            runId,
            `opl-qualification-attempt-${artifactKind}-${runId}`,
            'qualification-attempt-receipt.json',
          );
          return result ? { receipt: result.value, ref: result.ref, sha256: result.sha256 } : null;
        },
      });
      writeSession(options.statePath, session);
      printSession(session);
    } finally {
      evidence.cleanup();
    }
    return;
  }
  if (command === 'cancel') {
    const options = parseCancelArgs(argv);
    let session = readSession(options.statePath);
    if (options.execute) session = dispatchEmergencyCancel(session, options.statePath, options.targetRunId, options.reason, run);
    printSession(session);
    return;
  }
  if (command === 'recover-stale-lock') {
    const options = parseRecoverStaleLockArgs(argv);
    const recovered = recoverStaleStableReleaseSessionLock(options.statePath, {
      sessionId: options.sessionId, revision: options.revision,
    });
    process.stdout.write(`${JSON.stringify({ recovered: recovered.exists, diagnostic: recovered }, null, 2)}\n`);
    return;
  }
  if (command === 'complete-local') {
    printSession(completeLocalActivation(parseCompleteLocalArgs(argv)));
    return;
  }
  throw new Error(`Unknown release:stable command: ${command}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
