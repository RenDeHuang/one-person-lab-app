import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ReleaseCohortPlan } from './plan-release-cohort.ts';
import {
  buildReleaseSessionLease,
  validateReleaseSessionLease,
  type ReleaseMutation,
  type ReleaseSessionLeaseV2,
} from './release-session-lease.ts';
import type { QualificationHarnessScopeProof } from './qualification-harness-scope.ts';
import type { QualificationAttemptReceiptV1, QualificationFailureTaxonomy } from './qualification-attempt-receipt.ts';
import type { ReleaseMutationAcceptanceReceiptV1 } from './release-mutation-broker.ts';
import type { ReleaseMutationPayload } from './release-mutation-payload.ts';
import { readReleaseBrokerAuthority, validateReleaseBrokerAuthority } from './release-broker-authority.ts';
import type { ReleaseBrokerAuthorityV1 } from './release-broker-authority.ts';

export type StableReleasePhase =
  | 'candidate_frozen' | 'source_gates_passed' | 'artifact_build_running' | 'source_gate_failed'
  | 'standard_deadline_blocked'
  | 'artifact_build_failed' | 'release_train_failed' | 'qualification_failed'
  | 'retry_failed_gate_same_artifact' | 'artifacts_qualified' | 'owner_approved'
  | 'promotion_running' | 'promotion_failed' | 'release_published_not_latest'
  | 'distribution_synced' | 'homebrew_verified' | 'latest_activated'
  | 'awaiting_local_activation' | 'standard_stable_terminal' | 'addon_train_terminal';

type PhaseTiming = { started_at: string; ended_at: string | null; duration_ms: number | null };

export type StandardEfficiencyAdvisory = {
  at: string;
  elapsed_ms: number;
  threshold_ms: 3600000;
  stage: string;
  status: string;
  blocker: 'standard_release_elapsed_60m';
  remaining_ms: number;
  action: 'inspect_current_stage_and_preserve_same_cohort_evidence';
};

export type StandardDeadlineBlocker = {
  status: 'blocked';
  blocker: 'standard_admission_deadline_elapsed';
  stage: string;
  run_id: string | null;
  observed_at: string;
  remaining_ms: 0;
  legal_next_actions: ['read_only_reconcile', 'emergency_cancel'];
};

export type FullAddonDeadlineBlocker = {
  status: 'blocked_with_debt';
  blocker: 'full_addon_deadline_elapsed';
  acceptance_attempt_id: string;
  run_id: string;
  deadline_at: string;
  observed_at: string;
  remote_status: string;
  remaining_ms: 0;
  legal_next_actions: ['read_only_reconcile', 'emergency_cancel'];
};

type ReleaseMetrics = {
  session_started_at: string;
  standard_completed_at: string | null;
  addon_completed_at: string | null;
  total_wall_time_ms: number;
  phases: Partial<Record<StableReleasePhase, PhaseTiming>>;
  workflow_dispatch_counts: { desktop_release: number; qualification_retry: number; promotion: number; full_addon: number };
  artifact_build_count: number;
  qualification_retry_count: number;
  promotion_retry_count: number;
  wait_poll_policy: {
    monitor: 'read_only_reconcile'; interval_seconds: null; absolute_deadline_enforced: true;
    nested_polling_allowed: false; transport_retry_limit: 3;
  };
  reused_artifact_sha256: string | null;
  efficiency_advisories: StandardEfficiencyAdvisory[];
};

export type QualificationArtifactKind = 'standard' | 'full';

export type QualificationAttemptEvent = {
  at: string;
  state: 'planned' | 'dispatching' | 'reconcile_pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'runner_lost' | 'dispatch_lost' | 'ambiguous';
  run_id: string | null;
  conclusion: string | null;
  failure_taxonomy: QualificationFailureTaxonomy;
  remote_receipt_ref: string | null;
  remote_receipt_sha256?: string | null;
  retry_disposition?: 'new_cohort_required' | 'same_artifact_retry_allowed' | 'reconcile_only' | 'terminal_blocked' | null;
  retry_reason?: string | null;
  scope_proof?: QualificationAttemptReceiptV1['evidence']['scope_proof'];
  reason: string;
};

export type QualificationAttempt = {
  attempt_id: string;
  sequence: number;
  workflow: 'desktop-release.yml' | 'opl-first-run-vm.yml' | 'desktop-release-full-addon.yml';
  mutation: 'desktop_release_dispatch' | 'qualification_dispatch' | 'full_addon_dispatch';
  created_at: string;
  mutation_attempt_id: string | null;
  verification_harness: StableReleaseSession['qualification_run']['verification_harness'];
  events: QualificationAttemptEvent[];
};

export type ReleaseMutationAttempt = {
  attempt_id: string;
  admission_mode: 'isolated_broker' | 'admin_one_shot_controller';
  mutation: ReleaseMutation;
  workflow: ReleaseSessionLeaseV2['workflow'];
  artifact_kind: ReleaseSessionLeaseV2['artifact_kind'];
  controller_workflow_sha: string;
  artifact_app_sha: string;
  mutation_payload_sha256: string;
  mutation_payload: ReleaseMutationPayload | null;
  planned_session_revision: number;
  broker_lookup: {
    request_sha256: string | null;
    last_status: 'never' | 'found' | 'not_found' | 'outcome_unknown' | 'reconcile_pending' | 'invalid';
    observed_at: string | null;
    ledger_generation: number | null;
    version_aggregate_revision: number | null;
    latest_mutation_head_revision: number | null;
    complete_through_sequence: number | null;
    authority_epoch: number | null;
    not_found_ledger_generation: number | null;
  };
  dispatch_fence: {
    mode: 'new_workflow_run' | 'existing_run_mutation';
    workflow_head_branch: 'main';
    earliest_created_at: string;
    prior_run_ids: string[];
    target_attempt_id: string | null;
    target_run_id: string | null;
  };
  created_at: string;
  events: Array<{
    at: string;
    state: 'planned' | 'dispatching' | 'acceptance_pending_visibility' | 'reconcile_pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'dispatch_lost' | 'ambiguous';
    run_id: string | null;
    reason: string;
  }>;
};

export type StableReleaseSession = {
  schema: 'opl_app_stable_release_session.v3';
  revision: number;
  id: string;
  created_at: string;
  updated_at: string;
  phase: StableReleasePhase;
  version: string;
  repo: string;
  cohort_plan: ReleaseCohortPlan;
  source_gates: Array<{ id: string; command: string; status: 'pending' | 'passed' | 'failed' }>;
  release_run: { id: string | null; url: string | null; conclusion: string | null };
  promotion_run: {
    id: string | null; url: string | null; conclusion: string | null;
    attempt: number | null; rerun_requested_from_attempt: number | null;
  };
  promotion_progress: {
    release_set_generation: string | null;
    release_set_manifest_digest: string | null;
    last_verified_checkpoint: 'release_public_nonlatest' | 'distribution_synced' | 'homebrew_verified' | 'latest_activated' | null;
    resume_from_checkpoint: 'release_public_nonlatest' | 'distribution_synced' | 'homebrew_verified' | 'latest_activated';
  };
  qualification_run: {
    id: string | null; url: string | null; conclusion: string | null;
    artifact_run_id: string | null; artifact_name: string | null; artifact_sha256: string | null;
    evidence_ref: string | null; evidence_sha256: string | null;
    verification_harness?: {
      app_ref: string; app_sha: string; shell_ref: string; shell_sha: string;
      scope_proof: QualificationHarnessScopeProof;
    } | null;
  };
  mutation_leases: ReleaseSessionLeaseV2[];
  mutation_acceptances: ReleaseMutationAcceptanceReceiptV1[];
  mutation_attempts: ReleaseMutationAttempt[];
  artifact_tracks: Record<QualificationArtifactKind, {
    artifact_sha256: string | null;
    build_manifest_sha256: string | null;
    source_run_id: string | null;
    source_artifact_name: string | null;
    expectation_semantic_digest: string | null;
    expectation_probe_digest: string | null;
    qualification_input_manifest_digest: string | null;
    full_input_manifest_digest: string | null;
    framework_bundled_catalog_digest: string | null;
    full_toolchain_observation_receipt_digest: string | null;
    qualification_run: StableReleaseSession['qualification_run'];
    attempts: QualificationAttempt[];
  }>;
  addon_tracks: {
    full: {
      required: boolean;
      status: 'not_requested' | 'pending' | 'running' | 'qualified' | 'failed' | 'blocked_with_debt';
      run_id: string | null;
      run_url: string | null;
      conclusion: string | null;
      receipt_ref: string | null;
      receipt_sha256: string | null;
      release_set_generation: string | null;
      release_set_manifest_digest: string | null;
      deadline_at: string | null;
      deadline_blocker: FullAddonDeadlineBlocker | null;
    };
    webui: {
      required: boolean;
      status: 'not_requested' | 'pending' | 'running' | 'verified' | 'failed' | 'blocked_with_debt';
      receipt_ref: string | null;
      receipt_sha256: string | null;
    };
  };
  terminal_truth: {
    standard_status: 'in_progress' | 'terminal' | 'blocked';
    addon_status: 'not_requested' | 'pending' | 'terminal' | 'blocked_with_debt';
    standard_terminal_at: string | null;
    addon_terminal_at: string | null;
  };
  qualification_retry_policy: {
    max_attempts_per_artifact_kind: 2;
    same_artifact_only: true;
    semantic_digest_must_match: true;
    missing_receipt_is_terminal_success: false;
  };
  receipts: {
    promotion_saga: { ref: string; sha256: string } | null;
    local_activation: { ref: string; sha256: string } | null;
  };
  standard_deadline_blocker: StandardDeadlineBlocker | null;
  metrics: ReleaseMetrics;
  release_owner_receipt_ref: string | null;
  transitions: Array<{ at: string; from: StableReleasePhase | null; to: StableReleasePhase; reason: string }>;
  efficiency_policy: {
    desktop_release_dispatch_limit_per_cohort: 1;
    monitor_interval_seconds: 60;
    standard_admission_deadline_at: string;
    run_id_discovery_timeout_seconds: 60;
    monitor_transport_retry_limit: 3;
    monitor_wall_clock_timeout_seconds: Partial<Record<StableReleasePhase, number>>;
    cross_cohort_artifact_reuse_allowed: false;
    rebuild_after_smoke_only_change_allowed: false;
  };
  authority_boundary: {
    session_is_release_truth: false;
    execute_flag_required_for_external_mutation: true;
    publish_requires_candidate_and_owner_receipt: true;
  };
};

type LeaseBuildInput = Parameters<typeof buildReleaseSessionLease>[0];
export type ReleaseLeaseBroker = (input: Omit<LeaseBuildInput, 'signingPrivateKeyPem'>) => ReleaseSessionLeaseV2;

function fsyncParentDirectory(targetPath: string): void {
  const directory = fs.openSync(path.dirname(targetPath), 'r');
  try {
    fs.fsyncSync(directory);
  } finally {
    fs.closeSync(directory);
  }
}

function removeLockDurably(lockPath: string): void {
  fs.rmSync(lockPath, { force: true });
  fsyncParentDirectory(lockPath);
}

function emptyArtifactTracks(): StableReleaseSession['artifact_tracks'] {
  const empty = () => ({
    artifact_sha256: null, build_manifest_sha256: null,
    source_run_id: null, source_artifact_name: null,
    expectation_semantic_digest: null, expectation_probe_digest: null, attempts: [],
    qualification_input_manifest_digest: null, full_input_manifest_digest: null,
    framework_bundled_catalog_digest: null, full_toolchain_observation_receipt_digest: null,
    qualification_run: {
      id: null, url: null, conclusion: null, artifact_run_id: null, artifact_name: null,
      artifact_sha256: null, evidence_ref: null, evidence_sha256: null, verification_harness: null,
    },
  });
  return { standard: empty(), full: empty() };
}

function numericRunId(value: string | null): boolean {
  return value === null || /^[1-9][0-9]*$/.test(value);
}

export function stableReleaseSessionIdentity(plan: ReleaseCohortPlan): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify({
    version: plan.version,
    admitted_at: plan.generated_at,
    operator_plan_ref: plan.operator_plan_ref,
    app_sha: plan.cohort_lock.app.resolved_sha,
    shell_sha: plan.cohort_lock.shell.resolved_sha,
    framework_sha: plan.cohort_lock.framework.resolved_sha,
  })).digest('hex')}`;
}

function hasExactHistoricalPromotionRecovery(session: StableReleaseSession, deadlineAt: number): boolean {
  const current = session.mutation_attempts.at(-1);
  if (
    !current || current.mutation !== 'promotion_dispatch' || current.workflow !== 'desktop-release-promote.yml' ||
    current.artifact_kind !== 'promotion' || current.admission_mode !== 'admin_one_shot_controller' ||
    Date.parse(current.created_at) < deadlineAt || current.dispatch_fence.prior_run_ids.length !== 1 ||
    !['promotion_failed', 'promotion_running', 'release_published_not_latest', 'distribution_synced',
      'homebrew_verified', 'latest_activated', 'awaiting_local_activation'].includes(session.phase)
  ) return false;
  const predecessorRunId = current.dispatch_fence.prior_run_ids[0];
  const predecessor = session.mutation_attempts.slice(0, -1).reverse().find((attempt) =>
    attempt.mutation === 'promotion_dispatch' && attempt.events.at(-1)?.run_id === predecessorRunId
  );
  const dispatching = predecessor?.events.filter((event) => event.state === 'dispatching') ?? [];
  const terminal = predecessor?.events.at(-1);
  const payload = current.mutation_payload as Record<string, unknown> | null;
  return Boolean(
    predecessor && predecessor.admission_mode === 'admin_one_shot_controller' && dispatching.length === 1 &&
    Date.parse(dispatching[0].at) < deadlineAt && terminal?.state === 'failed' && terminal.run_id === predecessorRunId &&
    Date.parse(terminal.at) < Date.parse(current.created_at) &&
    predecessor.mutation_payload_sha256 === current.mutation_payload_sha256 &&
    JSON.stringify(predecessor.mutation_payload) === JSON.stringify(current.mutation_payload) &&
    predecessor.artifact_app_sha === current.artifact_app_sha &&
    payload?.stable_session_id === session.id && payload?.release_cohort_ref === session.cohort_plan.operator_plan_ref &&
    payload?.release_owner_receipt_ref === session.release_owner_receipt_ref &&
    payload?.release_set_generation === session.promotion_progress.release_set_generation,
  );
}

export function validateStableReleaseSessionInvariants(session: StableReleaseSession): string[] {
  const errors: string[] = [];
  const terminalPhase = session.phase === 'standard_stable_terminal' || session.phase === 'addon_train_terminal';
  const blockedPhase = session.phase === 'source_gate_failed' || session.phase === 'standard_deadline_blocked';
  const createdAt = Date.parse(session.created_at);
  const updatedAt = Date.parse(session.updated_at);
  const startedAt = Date.parse(session.metrics.session_started_at);
  const deadlineAt = Date.parse(session.efficiency_policy.standard_admission_deadline_at);
  if (session.schema !== 'opl_app_stable_release_session.v3') errors.push('stable release session schema is invalid');
  if (!/^sha256:[0-9a-f]{64}$/.test(session.id)) errors.push('stable release session id is invalid');
  if (session.id !== stableReleaseSessionIdentity(session.cohort_plan)) {
    errors.push('stable release session id does not match the frozen cohort bytes');
  }
  if (!Number.isSafeInteger(session.revision) || session.revision < 0) errors.push('stable release session revision is invalid');
  if (!Number.isFinite(createdAt) || createdAt !== startedAt) {
    errors.push('session created_at must equal the immutable metrics session start');
  }
  if (session.cohort_plan.generated_at !== session.created_at) {
    errors.push('frozen cohort generated_at must equal the immutable Standard admission start');
  }
  if (!Number.isFinite(updatedAt) || updatedAt < startedAt) errors.push('session updated_at predates the immutable session start');
  if (!Number.isFinite(startedAt) || !Number.isFinite(deadlineAt) || deadlineAt !== startedAt + 90 * 60 * 1_000) {
    errors.push('Standard admission deadline must be exactly 90 minutes after the immutable session start');
  }
  if (session.version !== session.cohort_plan.version) errors.push('session version does not match the frozen cohort');
  if (
    session.terminal_truth.standard_status === 'in_progress' && updatedAt >= deadlineAt &&
    !hasExactHistoricalPromotionRecovery(session, deadlineAt)
  ) {
    errors.push('in-progress Standard session cannot remain open at or after its immutable deadline');
  }
  if (terminalPhase !== (session.terminal_truth.standard_status === 'terminal')) {
    errors.push('Standard terminal truth does not match the session phase');
  }
  if (blockedPhase !== (session.terminal_truth.standard_status === 'blocked')) {
    errors.push('Standard blocked truth does not match a typed blocked phase');
  }
  if (session.phase === 'standard_deadline_blocked') {
    const blocker = session.standard_deadline_blocker;
    if (
      !blocker || blocker.status !== 'blocked' || blocker.blocker !== 'standard_admission_deadline_elapsed' ||
      typeof blocker.stage !== 'string' || !blocker.stage || !numericRunId(blocker.run_id) ||
      blocker.observed_at !== session.transitions.at(-1)?.at || Date.parse(blocker.observed_at) < deadlineAt ||
      blocker.remaining_ms !== 0 ||
      JSON.stringify(blocker.legal_next_actions) !== JSON.stringify(['read_only_reconcile', 'emergency_cancel'])
    ) errors.push('Standard deadline blocked phase lacks its exact typed blocker and legal next actions');
  } else if (session.standard_deadline_blocker !== null) {
    errors.push('non-deadline phase unexpectedly carries a Standard deadline blocker');
  }
  const warningAdvisories = session.metrics.efficiency_advisories.filter((advisory) => advisory.threshold_ms === 3_600_000);
  if (warningAdvisories.length > 1) errors.push('Standard 60-minute efficiency warning is duplicated');
  for (const advisory of session.metrics.efficiency_advisories) {
    const advisoryAt = Date.parse(advisory.at);
    if (
      advisory.threshold_ms !== 3_600_000 || advisory.blocker !== 'standard_release_elapsed_60m' ||
      advisory.action !== 'inspect_current_stage_and_preserve_same_cohort_evidence' ||
      typeof advisory.stage !== 'string' || !advisory.stage || typeof advisory.status !== 'string' || !advisory.status ||
      !Number.isFinite(advisoryAt) || advisoryAt < startedAt + 3_600_000 || advisoryAt > updatedAt ||
      advisory.elapsed_ms !== advisoryAt - startedAt || advisory.remaining_ms !== Math.max(0, deadlineAt - advisoryAt)
    ) errors.push('Standard 60-minute efficiency warning is malformed or not bound to the immutable budget');
  }
  if (session.phase === 'awaiting_local_activation' || terminalPhase) {
    const qualificationArtifactSha256 = session.qualification_run.artifact_sha256;
    const standardArtifactSha256 = session.artifact_tracks.standard.artifact_sha256;
    if (!/^[0-9a-f]{64}$/.test(qualificationArtifactSha256 ?? '')) {
      errors.push('awaiting/terminal Standard session lacks an exact qualification artifact SHA-256');
    }
    if (!/^[0-9a-f]{64}$/.test(standardArtifactSha256 ?? '')) {
      errors.push('awaiting/terminal Standard artifact track lacks an exact artifact SHA-256');
    }
    if (qualificationArtifactSha256 !== standardArtifactSha256) {
      errors.push('awaiting/terminal Standard qualification and artifact-track SHA-256 differ');
    }
  }
  if (terminalPhase) {
    if (!session.terminal_truth.standard_terminal_at || !session.metrics.standard_completed_at) {
      errors.push('Standard terminal phase is missing terminal timestamps');
    }
    if (!session.receipts.local_activation) {
      errors.push('Standard terminal phase is missing the exact local activation receipt');
    }
    if (!session.receipts.promotion_saga) {
      errors.push('Standard terminal phase is missing the validated promotion saga receipt');
    }
    if (session.terminal_truth.standard_terminal_at !== session.metrics.standard_completed_at) {
      errors.push('Standard terminal truth and metrics timestamps differ');
    }
    const standardTerminalAt = Date.parse(String(session.terminal_truth.standard_terminal_at));
    if (!Number.isFinite(standardTerminalAt) || standardTerminalAt >= deadlineAt) {
      errors.push('Standard success terminal must be recorded before the immutable 90-minute deadline');
    }
    for (const [label, receipt] of [
      ['promotion saga', session.receipts.promotion_saga],
      ['local activation', session.receipts.local_activation],
    ] as const) {
      if (receipt && (!receipt.ref || !/^[0-9a-f]{64}$/.test(receipt.sha256))) {
        errors.push(`${label} receipt ref or digest is invalid`);
      }
    }
  } else if (session.terminal_truth.standard_terminal_at || session.metrics.standard_completed_at) {
    errors.push('nonterminal Standard session carries terminal timestamps');
  }
  if (session.phase === 'addon_train_terminal') {
    if (!['terminal', 'blocked_with_debt'].includes(session.terminal_truth.addon_status)) {
      errors.push('add-on terminal phase lacks terminal or typed-debt truth');
    }
    if (!session.terminal_truth.addon_terminal_at || !session.metrics.addon_completed_at) {
      errors.push('add-on terminal phase is missing terminal timestamps');
    }
    if (session.terminal_truth.addon_terminal_at !== session.metrics.addon_completed_at) {
      errors.push('add-on terminal truth and metrics timestamps differ');
    }
  }
  if (!Number.isSafeInteger(session.metrics.total_wall_time_ms) || session.metrics.total_wall_time_ms < 0) {
    errors.push('session total wall time is invalid');
  } else if (Number.isFinite(updatedAt) && session.metrics.total_wall_time_ms > updatedAt - startedAt) {
    errors.push('session total wall time exceeds the immutable wall-clock interval');
  }
  if (session.transitions.length === 0) {
    errors.push('stable release session has no transition history');
  } else {
    let priorAt = startedAt;
    let priorTo: StableReleasePhase | null = null;
    for (const [index, transition] of session.transitions.entries()) {
      const transitionAt = Date.parse(transition.at);
      if (!Number.isFinite(transitionAt) || transitionAt < priorAt || transitionAt > updatedAt) {
        errors.push(`session transition ${index + 1} timestamp is invalid or non-monotonic`);
      }
      if (transition.from !== priorTo) errors.push(`session transition ${index + 1} does not continue the prior phase`);
      if (index === 0 && (transition.to !== 'candidate_frozen' || transitionAt !== startedAt)) {
        errors.push('first session transition must freeze the candidate at the immutable session start');
      }
      priorAt = transitionAt;
      priorTo = transition.to;
    }
    if (priorTo !== session.phase) errors.push('session phase does not match the final transition');
  }
  const currentTiming = session.metrics.phases[session.phase];
  if (!currentTiming) {
    errors.push(`current phase ${session.phase} has no timing record`);
  }
  for (const [phase, timing] of Object.entries(session.metrics.phases) as Array<[StableReleasePhase, PhaseTiming]>) {
    const phaseStartedAt = Date.parse(timing.started_at);
    const phaseEndedAt = timing.ended_at === null ? Number.NaN : Date.parse(timing.ended_at);
    if (!Number.isFinite(phaseStartedAt) || phaseStartedAt < startedAt || phaseStartedAt > updatedAt) {
      errors.push(`phase ${phase} start timestamp is invalid`);
    }
    if (timing.ended_at === null) {
      if (phase !== session.phase || terminalPhase || blockedPhase || timing.duration_ms !== null) {
        errors.push(`phase ${phase} has an incoherent open timing record`);
      }
    } else if (
      !Number.isFinite(phaseEndedAt) || phaseEndedAt < phaseStartedAt || phaseEndedAt > updatedAt ||
      timing.duration_ms !== phaseEndedAt - phaseStartedAt
    ) {
      errors.push(`phase ${phase} has an incoherent closed timing record`);
    }
  }
  const expectedCurrentPhaseEnd = session.phase === 'standard_stable_terminal'
    ? session.terminal_truth.standard_terminal_at
    : session.phase === 'addon_train_terminal'
      ? session.terminal_truth.addon_terminal_at
      : blockedPhase
        ? session.transitions.at(-1)?.at ?? null
        : null;
  if ((terminalPhase || blockedPhase) && currentTiming?.ended_at !== expectedCurrentPhaseEnd) {
    errors.push(`terminal/blocked phase ${session.phase} timing is not closed at its durable transition`);
  }
  for (const [label, value] of [
    ['release_run.id', session.release_run.id],
    ['promotion_run.id', session.promotion_run.id],
    ['qualification_run.id', session.qualification_run.id],
    ['addon_tracks.full.run_id', session.addon_tracks.full.run_id],
  ] as const) {
    if (!numericRunId(value)) errors.push(`${label} is not an exact numeric GitHub run id`);
  }
  for (const acceptance of session.mutation_acceptances) {
    const runId = acceptance.github.run_id;
    if (!/^[1-9][0-9]*$/.test(runId ?? '')) {
      errors.push(`${acceptance.github.operation} acceptance ${acceptance.lease.attempt_id} lacks an exact numeric run id`);
    }
    const attempt = session.mutation_attempts.find((candidate) => candidate.attempt_id === acceptance.lease.attempt_id);
    if (!attempt) {
      errors.push(`broker acceptance ${acceptance.lease.attempt_id} has no durable mutation attempt`);
    } else if (attempt.events.some((event) => event.run_id !== null && event.run_id !== runId)) {
      errors.push(`broker acceptance ${acceptance.lease.attempt_id} conflicts with a projected event run id`);
    }
  }
  const acceptanceAttemptIds = session.mutation_acceptances.map((acceptance) => acceptance.lease.attempt_id);
  if (new Set(acceptanceAttemptIds).size !== acceptanceAttemptIds.length) {
    errors.push('stable release session contains duplicate broker acceptances for one attempt');
  }
  const mutationAttemptIds = new Set<string>();
  for (const attempt of session.mutation_attempts) {
    if (mutationAttemptIds.has(attempt.attempt_id)) errors.push(`duplicate mutation attempt ${attempt.attempt_id}`);
    mutationAttemptIds.add(attempt.attempt_id);
    if (!['isolated_broker', 'admin_one_shot_controller'].includes(attempt.admission_mode)) {
      errors.push(`mutation attempt ${attempt.attempt_id} admission mode is invalid`);
    }
    if (attempt.events.length === 0) errors.push(`mutation attempt ${attempt.attempt_id} has no event history`);
    if (attempt.broker_lookup.request_sha256 !== null && !/^sha256:[0-9a-f]{64}$/.test(attempt.broker_lookup.request_sha256)) {
      errors.push(`mutation attempt ${attempt.attempt_id} broker request digest is invalid`);
    }
    if (
      attempt.broker_lookup.not_found_ledger_generation !== null &&
      (!Number.isSafeInteger(attempt.broker_lookup.not_found_ledger_generation) || attempt.broker_lookup.not_found_ledger_generation < 0)
    ) errors.push(`mutation attempt ${attempt.attempt_id} broker lookup generation is invalid`);
    for (const [label, generation] of [
      ['ledger', attempt.broker_lookup.ledger_generation],
      ['version aggregate', attempt.broker_lookup.version_aggregate_revision],
      ['latest mutation head', attempt.broker_lookup.latest_mutation_head_revision],
      ['complete-through sequence', attempt.broker_lookup.complete_through_sequence],
      ['authority epoch', attempt.broker_lookup.authority_epoch],
    ] as const) {
      if (generation !== null && (!Number.isSafeInteger(generation) || generation < 0)) {
        errors.push(`mutation attempt ${attempt.attempt_id} broker ${label} high-water is invalid`);
      }
    }
    if (
      ['found', 'not_found', 'outcome_unknown'].includes(attempt.broker_lookup.last_status) &&
      (attempt.broker_lookup.observed_at === null || attempt.broker_lookup.ledger_generation === null ||
        attempt.broker_lookup.version_aggregate_revision === null ||
        attempt.broker_lookup.latest_mutation_head_revision === null ||
        attempt.broker_lookup.complete_through_sequence === null || attempt.broker_lookup.authority_epoch === null)
    ) errors.push(`mutation attempt ${attempt.attempt_id} signed broker observation lacks its high-water proof`);
    if (
      attempt.broker_lookup.observed_at !== null &&
      (!Number.isFinite(Date.parse(attempt.broker_lookup.observed_at)) || Date.parse(attempt.broker_lookup.observed_at) > updatedAt)
    ) errors.push(`mutation attempt ${attempt.attempt_id} broker lookup timestamp is invalid`);
    let eventAt = Date.parse(attempt.created_at);
    for (const [eventIndex, event] of attempt.events.entries()) {
      const observedAt = Date.parse(event.at);
      if (!Number.isFinite(observedAt) || observedAt < eventAt || observedAt > updatedAt) {
        errors.push(`mutation attempt ${attempt.attempt_id} event history is non-monotonic`);
      }
      if (!numericRunId(event.run_id)) errors.push(`mutation attempt ${attempt.attempt_id} has a nonnumeric run id`);
      if (
        eventIndex < attempt.events.length - 1 &&
        ['succeeded', 'failed', 'cancelled'].includes(event.state)
      ) errors.push(`mutation attempt ${attempt.attempt_id} has events after a terminal state`);
      eventAt = observedAt;
    }
    if (attempt.mutation === 'workflow_cancel') {
      if (!attempt.dispatch_fence.target_attempt_id || !attempt.dispatch_fence.target_run_id) {
        errors.push(`emergency cancel attempt ${attempt.attempt_id} lacks an exact target attempt/run binding`);
      }
      if (!session.mutation_attempts.some((candidate) => candidate.attempt_id === attempt.dispatch_fence.target_attempt_id)) {
        errors.push(`emergency cancel attempt ${attempt.attempt_id} targets an unknown mutation attempt`);
      }
    } else if (attempt.dispatch_fence.target_attempt_id !== null) {
      errors.push(`primary mutation attempt ${attempt.attempt_id} unexpectedly targets another attempt`);
    }
  }
  for (const artifactKind of ['standard', 'full'] as const) {
    const attempts = session.artifact_tracks[artifactKind].attempts;
    for (const [index, attempt] of attempts.entries()) {
      if (attempt.sequence !== index + 1) errors.push(`${artifactKind} qualification attempt sequence is not contiguous`);
      if (index > 0 && !['passed', 'failed', 'cancelled'].includes(attempts[index - 1].events.at(-1)?.state ?? '')) {
        errors.push(`${artifactKind} qualification attempt ${attempt.sequence} started before the prior attempt was terminal`);
      }
      let eventAt = Date.parse(attempt.created_at);
      for (const [eventIndex, event] of attempt.events.entries()) {
        const observedAt = Date.parse(event.at);
        if (!Number.isFinite(observedAt) || observedAt < eventAt || observedAt > updatedAt) {
          errors.push(`${artifactKind} qualification attempt ${attempt.sequence} event history is non-monotonic`);
        }
        if (!numericRunId(event.run_id)) errors.push(`${artifactKind} qualification attempt ${attempt.sequence} has a nonnumeric run id`);
        if (eventIndex < attempt.events.length - 1 && ['passed', 'failed', 'cancelled'].includes(event.state)) {
          errors.push(`${artifactKind} qualification attempt ${attempt.sequence} has events after a terminal state`);
        }
        eventAt = observedAt;
      }
    }
  }
  if (JSON.stringify(session.qualification_run) !== JSON.stringify(session.artifact_tracks.standard.qualification_run)) {
    errors.push('top-level qualification run differs from the Standard artifact track');
  }
  const promotionCheckpoints = ['release_public_nonlatest', 'distribution_synced', 'homebrew_verified', 'latest_activated'] as const;
  const lastCheckpointIndex = session.promotion_progress.last_verified_checkpoint === null
    ? -1
    : promotionCheckpoints.indexOf(session.promotion_progress.last_verified_checkpoint);
  const expectedResume = promotionCheckpoints[Math.min(lastCheckpointIndex + 1, promotionCheckpoints.length - 1)];
  if (session.promotion_progress.resume_from_checkpoint !== expectedResume) {
    errors.push('promotion resume checkpoint is not the first unverified frozen checkpoint');
  }
  if (
    session.promotion_progress.release_set_generation !== null &&
    !/^\d{2}\.\d{1,2}\.\d{1,2}(?:-r[1-9][0-9]*)?$/.test(session.promotion_progress.release_set_generation)
  ) errors.push('promotion Release Set generation is invalid');
  if (
    session.promotion_progress.release_set_manifest_digest !== null &&
    !/^sha256:[0-9a-f]{64}$/.test(session.promotion_progress.release_set_manifest_digest)
  ) errors.push('promotion Release Set manifest digest is invalid');
  const full = session.addon_tracks.full;
  const fullDeadlineAt = Date.parse(String(full.deadline_at));
  const fullDispatchAcceptance = session.mutation_acceptances.find((acceptance) =>
    acceptance.pre_api_fence.request.mutation === 'full_addon_dispatch' && acceptance.github.run_id === full.run_id
  );
  if (full.deadline_at !== null && (!Number.isFinite(fullDeadlineAt) || new Date(fullDeadlineAt).toISOString() !== full.deadline_at)) {
    errors.push('Full add-on deadline is not canonical UTC ISO-8601');
  }
  if (fullDispatchAcceptance && full.deadline_at !== fullDispatchAcceptance.full_addon_deadline_at) {
    errors.push('Full add-on deadline does not match its signed broker acceptance');
  }
  if (['running', 'qualified', 'failed'].includes(full.status) && !full.deadline_at) {
    errors.push(`Full add-on ${full.status} state lacks its signed broker deadline`);
  }
  if (full.deadline_blocker) {
    const blocker = full.deadline_blocker;
    if (
      blocker.status !== 'blocked_with_debt' || blocker.blocker !== 'full_addon_deadline_elapsed' ||
      full.status !== 'blocked_with_debt' || session.terminal_truth.standard_status !== 'terminal' ||
      blocker.acceptance_attempt_id !== fullDispatchAcceptance?.lease.attempt_id || blocker.run_id !== full.run_id ||
      blocker.deadline_at !== full.deadline_at ||
      !Number.isFinite(Date.parse(blocker.observed_at)) || Date.parse(blocker.observed_at) < fullDeadlineAt ||
      Date.parse(blocker.observed_at) > updatedAt ||
      typeof blocker.remote_status !== 'string' || !blocker.remote_status || blocker.remaining_ms !== 0 ||
      JSON.stringify(blocker.legal_next_actions) !== JSON.stringify(['read_only_reconcile', 'emergency_cancel'])
    ) errors.push('Full add-on deadline blocker is not bound to its signed acceptance, exact run, and terminal debt state');
  }
  if (full.status === 'blocked_with_debt' && !full.deadline_blocker && (!full.receipt_ref || !/^[0-9a-f]{64}$/.test(full.receipt_sha256 ?? ''))) {
    errors.push('Full add-on typed debt state lacks either a deadline blocker or an exact debt receipt');
  }
  if (full.status === 'qualified' && (!full.receipt_ref || !/^[0-9a-f]{64}$/.test(full.receipt_sha256 ?? ''))) {
    errors.push('qualified Full add-on lacks its exact receipt ref/digest');
  }
  const webui = session.addon_tracks.webui;
  if (webui.status === 'verified' && (!webui.receipt_ref || !/^[0-9a-f]{64}$/.test(webui.receipt_sha256 ?? ''))) {
    errors.push('verified WebUI add-on lacks its exact receipt ref/digest');
  }
  return errors;
}

export function assertStableReleaseSessionInvariants(session: StableReleaseSession): void {
  const errors = validateStableReleaseSessionInvariants(session);
  if (errors.length > 0) throw new Error(`Stable release session invariant violation: ${errors.join('; ')}`);
}

function persistStableReleaseSessionAtomic(
  statePath: string,
  session: StableReleaseSession,
  createOnly: boolean,
  failureInjection: { afterLockFsync?: () => void; afterSessionFsync?: () => void; afterRename?: () => void } = {},
): void {
  assertStableReleaseSessionInvariants(session);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const lockPath = `${statePath}.lock`;
  const temporaryPath = `${statePath}.tmp-${process.pid}`;
  let lock: number | null = null;
  let temporary: number | null = null;
  let lockMetadataDurable = false;
  let sessionCommitDurable = false;
  try {
    lock = fs.openSync(lockPath, 'wx', 0o600);
    const current = fs.existsSync(statePath)
      ? JSON.parse(fs.readFileSync(statePath, 'utf8')) as { id?: string; revision?: number }
      : null;
    if (createOnly && current) {
      throw new Error(
        `Stable release session already exists at ${statePath}; use status, reconcile, or resume instead of overwriting it.`,
      );
    }
    const currentRevision = Number(current?.revision ?? 0);
    if (current && current.id !== session.id) {
      throw new Error(`Stable release session identity conflict: expected ${session.id}, current ${String(current.id)}.`);
    }
    if (!Number.isSafeInteger(session.revision) || session.revision !== currentRevision) {
      throw new Error(`Stable release session revision conflict: expected ${session.revision}, current ${currentRevision}.`);
    }
    const nextRevision = currentRevision + 1;
    const targetSessionBytes = `${JSON.stringify({ ...session, revision: nextRevision }, null, 2)}\n`;
    fs.writeFileSync(lock, `${JSON.stringify({
      host: os.hostname(), pid: process.pid, session_id: session.id,
      base_revision: currentRevision, target_revision: nextRevision,
      target_session_sha256: crypto.createHash('sha256').update(targetSessionBytes).digest('hex'),
      acquired_at: new Date().toISOString(),
    })}\n`);
    fs.fsyncSync(lock);
    lockMetadataDurable = true;
    failureInjection.afterLockFsync?.();
    temporary = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(temporary, targetSessionBytes, 'utf8');
    fs.fsyncSync(temporary);
    fs.closeSync(temporary);
    temporary = null;
    failureInjection.afterSessionFsync?.();
    fs.renameSync(temporaryPath, statePath);
    failureInjection.afterRename?.();
    fsyncParentDirectory(statePath);
    session.revision = nextRevision;
    sessionCommitDurable = true;
  } finally {
    if (temporary !== null) fs.closeSync(temporary);
    fs.rmSync(temporaryPath, { force: true });
    if (lock !== null) fs.closeSync(lock);
    if (lock !== null && (sessionCommitDurable || !lockMetadataDurable)) {
      removeLockDurably(lockPath);
    }
  }
}

export function writeStableReleaseSessionAtomic(
  statePath: string,
  session: StableReleaseSession,
  failureInjection: { afterLockFsync?: () => void; afterSessionFsync?: () => void; afterRename?: () => void } = {},
): void {
  persistStableReleaseSessionAtomic(statePath, session, false, failureInjection);
}

export function createStableReleaseSessionAtomic(
  statePath: string,
  session: StableReleaseSession,
  failureInjection: { afterLockFsync?: () => void; afterSessionFsync?: () => void; afterRename?: () => void } = {},
): void {
  persistStableReleaseSessionAtomic(statePath, session, true, failureInjection);
}

export type StableReleaseSessionLockDiagnostic = {
  exists: boolean;
  path: string;
  metadata: null | {
    host: string;
    pid: number;
    session_id: string;
    base_revision: number;
    target_revision: number;
    target_session_sha256: string;
    acquired_at: string;
  };
  same_host: boolean;
  owner_process_alive: boolean | null;
};

function processAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function inspectStableReleaseSessionLock(statePath: string): StableReleaseSessionLockDiagnostic {
  const lockPath = `${statePath}.lock`;
  if (!fs.existsSync(lockPath)) {
    return { exists: false, path: lockPath, metadata: null, same_host: false, owner_process_alive: null };
  }
  let metadata: StableReleaseSessionLockDiagnostic['metadata'] = null;
  try {
    const raw = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as Record<string, unknown>;
    if (
      typeof raw.host === 'string' && Number.isSafeInteger(raw.pid) &&
      typeof raw.session_id === 'string' && Number.isSafeInteger(raw.base_revision) &&
      Number.isSafeInteger(raw.target_revision) &&
      typeof raw.target_session_sha256 === 'string' && /^[0-9a-f]{64}$/.test(raw.target_session_sha256) &&
      typeof raw.acquired_at === 'string'
    ) {
      metadata = raw as StableReleaseSessionLockDiagnostic['metadata'];
    }
  } catch {
    metadata = null;
  }
  const sameHost = metadata?.host === os.hostname();
  return {
    exists: true,
    path: lockPath,
    metadata,
    same_host: sameHost,
    owner_process_alive: sameHost && metadata ? processAlive(metadata.pid) : null,
  };
}

export function recoverStaleStableReleaseSessionLock(
  statePath: string,
  expected: { sessionId: string; revision: number },
): StableReleaseSessionLockDiagnostic {
  const diagnostic = inspectStableReleaseSessionLock(statePath);
  if (!diagnostic.exists) return diagnostic;
  if (!diagnostic.metadata) throw new Error('Stable release session lock metadata is malformed; manual forensic review is required.');
  if (!diagnostic.same_host) throw new Error('Stable release session lock belongs to another host and cannot be recovered locally.');
  if (diagnostic.owner_process_alive) throw new Error('Stable release session lock owner process is still alive.');
  const observedLockBytes = fs.readFileSync(diagnostic.path, 'utf8');
  const observedMetadata = JSON.parse(observedLockBytes) as Record<string, unknown>;
  if (
    observedMetadata.host !== diagnostic.metadata.host || observedMetadata.pid !== diagnostic.metadata.pid ||
    observedMetadata.session_id !== diagnostic.metadata.session_id ||
    observedMetadata.base_revision !== diagnostic.metadata.base_revision ||
    observedMetadata.target_revision !== diagnostic.metadata.target_revision ||
    observedMetadata.target_session_sha256 !== diagnostic.metadata.target_session_sha256
  ) throw new Error('Stable release session lock changed during recovery inspection.');
  const persistedBytes = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf8') : null;
  const session = persistedBytes ? JSON.parse(persistedBytes) as { id?: string; revision?: number } : null;
  const initialCreateBeforeRename = persistedBytes === null
    && expected.revision === 0
    && diagnostic.metadata.base_revision === 0
    && diagnostic.metadata.target_revision === 1;
  if (
    diagnostic.metadata.session_id !== expected.sessionId ||
    (!initialCreateBeforeRename && (session?.id !== expected.sessionId || session?.revision !== expected.revision))
  ) {
    throw new Error('Stable release session lock recovery identity or revision does not match exact persisted state.');
  }
  const beforeRename = initialCreateBeforeRename || session?.revision === diagnostic.metadata.base_revision;
  const afterRename = persistedBytes !== null && session?.revision === diagnostic.metadata.target_revision
    && crypto.createHash('sha256').update(persistedBytes).digest('hex') === diagnostic.metadata.target_session_sha256;
  if (!beforeRename && !afterRename) {
    throw new Error('Stable release session lock does not match an exact pre-rename or post-rename persisted state.');
  }
  const quarantinePath = `${diagnostic.path}.recover-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.renameSync(diagnostic.path, quarantinePath);
  } catch (error) {
    throw new Error(`Stable release session lock changed before atomic recovery: ${error instanceof Error ? error.message : String(error)}`);
  }
  const quarantinedBytes = fs.readFileSync(quarantinePath, 'utf8');
  if (quarantinedBytes !== observedLockBytes) {
    if (!fs.existsSync(diagnostic.path)) fs.renameSync(quarantinePath, diagnostic.path);
    throw new Error('Stable release session lock bytes changed before atomic recovery.');
  }
  fsyncParentDirectory(diagnostic.path);
  fs.rmSync(quarantinePath);
  fsyncParentDirectory(diagnostic.path);
  return diagnostic;
}

export function readStableReleaseSession(statePath: string): StableReleaseSession {
  const raw = JSON.parse(fs.readFileSync(statePath, 'utf8')) as StableReleaseSession;
  if (raw.schema !== 'opl_app_stable_release_session.v3') {
    throw new Error(`Unsupported stable release session schema in ${statePath}.`);
  }
  if ((raw.phase as string) === 'complete') {
    throw new Error('Legacy single-complete stable release sessions are not authoritative; migrate to explicit Standard and add-on terminal truth.');
  }
  const artifactTracks = raw.artifact_tracks ?? emptyArtifactTracks();
  const fullRunId = raw.addon_tracks?.full?.run_id ?? null;
  const fullAcceptanceDeadline = raw.mutation_acceptances?.find((acceptance) =>
    acceptance.pre_api_fence.request.mutation === 'full_addon_dispatch' && acceptance.github.run_id === fullRunId
  )?.full_addon_deadline_at ?? null;
  const session: StableReleaseSession = {
      ...raw,
      revision: raw.revision ?? 0,
      metrics: {
        ...raw.metrics,
        wait_poll_policy: {
          monitor: 'read_only_reconcile', interval_seconds: null, absolute_deadline_enforced: true,
          nested_polling_allowed: false, transport_retry_limit: raw.metrics.wait_poll_policy?.transport_retry_limit ?? 3,
        },
        workflow_dispatch_counts: {
          ...raw.metrics.workflow_dispatch_counts,
          full_addon: raw.metrics.workflow_dispatch_counts.full_addon ?? 0,
        },
        efficiency_advisories: raw.metrics.efficiency_advisories ?? [],
      },
      efficiency_policy: {
        ...raw.efficiency_policy,
        standard_admission_deadline_at: raw.efficiency_policy.standard_admission_deadline_at ??
          new Date(Date.parse(raw.metrics.session_started_at) + 90 * 60 * 1_000).toISOString(),
        monitor_wall_clock_timeout_seconds: raw.efficiency_policy.monitor_wall_clock_timeout_seconds ?? {
          artifact_build_running: 5_400,
          retry_failed_gate_same_artifact: 3_600,
          promotion_running: 3_600,
          standard_stable_terminal: 7_200,
        },
      },
      mutation_attempts: (raw.mutation_attempts ?? []).map((attempt) => ({
        ...attempt,
        admission_mode: attempt.admission_mode ?? 'isolated_broker',
        mutation_payload: attempt.mutation_payload ?? null,
        broker_lookup: {
          ...(attempt.broker_lookup ?? {}),
          request_sha256: attempt.broker_lookup?.request_sha256 ?? null,
          last_status: attempt.broker_lookup?.last_status ?? 'never',
          observed_at: attempt.broker_lookup?.observed_at ?? null,
          ledger_generation: attempt.broker_lookup?.ledger_generation ?? null,
          version_aggregate_revision: attempt.broker_lookup?.version_aggregate_revision ?? null,
          latest_mutation_head_revision: attempt.broker_lookup?.latest_mutation_head_revision ?? null,
          complete_through_sequence: attempt.broker_lookup?.complete_through_sequence ?? null,
          authority_epoch: attempt.broker_lookup?.authority_epoch ?? null,
          not_found_ledger_generation: attempt.broker_lookup?.not_found_ledger_generation ?? null,
        },
        dispatch_fence: {
          ...attempt.dispatch_fence,
          target_attempt_id: attempt.dispatch_fence.target_attempt_id ?? null,
        },
      })),
      mutation_acceptances: raw.mutation_acceptances ?? [],
      standard_deadline_blocker: raw.standard_deadline_blocker ?? null,
      artifact_tracks: Object.fromEntries(
        Object.entries(artifactTracks).map(([kind, track]) => [kind, {
          ...track,
          build_manifest_sha256: track.build_manifest_sha256 ?? null,
          qualification_input_manifest_digest: track.qualification_input_manifest_digest ?? null,
          full_toolchain_observation_receipt_digest: track.full_toolchain_observation_receipt_digest ?? null,
          qualification_run: track.qualification_run ?? {
            id: null, url: null, conclusion: null, artifact_run_id: track.source_run_id,
            artifact_name: track.source_artifact_name, artifact_sha256: track.artifact_sha256,
            evidence_ref: null, evidence_sha256: null, verification_harness: null,
          },
          attempts: track.attempts.map((attempt) => ({
            ...attempt,
            mutation_attempt_id: attempt.mutation_attempt_id ?? null,
            verification_harness: attempt.verification_harness ?? null,
          })),
        }]),
      ) as StableReleaseSession['artifact_tracks'],
      terminal_truth: raw.terminal_truth ?? {
        standard_status: raw.phase === 'standard_stable_terminal' || raw.phase === 'addon_train_terminal'
          ? 'terminal'
          : raw.phase === 'source_gate_failed' || raw.phase === 'standard_deadline_blocked'
            ? 'blocked'
            : 'in_progress',
        addon_status: raw.cohort_plan.include_full_package || raw.cohort_plan.publish_docker_webui ? 'pending' : 'not_requested',
        standard_terminal_at: raw.phase === 'standard_stable_terminal' || raw.phase === 'addon_train_terminal' ? raw.updated_at : null,
        addon_terminal_at: null,
      },
      promotion_progress: raw.promotion_progress ?? {
        release_set_generation: null,
        release_set_manifest_digest: null,
        last_verified_checkpoint: null,
        resume_from_checkpoint: 'release_public_nonlatest',
      },
      addon_tracks: {
        ...(raw.addon_tracks ?? {
          full: { required: raw.cohort_plan.include_full_package, status: raw.cohort_plan.include_full_package ? 'pending' : 'not_requested', run_id: null, run_url: null, conclusion: null, receipt_ref: null, receipt_sha256: null },
          webui: { required: raw.cohort_plan.publish_docker_webui, status: raw.cohort_plan.publish_docker_webui ? 'pending' : 'not_requested', receipt_ref: null, receipt_sha256: null },
        }),
        full: {
          ...(raw.addon_tracks?.full ?? { required: raw.cohort_plan.include_full_package, status: raw.cohort_plan.include_full_package ? 'pending' : 'not_requested', run_id: null, run_url: null, conclusion: null, receipt_ref: null, receipt_sha256: null }),
          release_set_generation: raw.addon_tracks?.full?.release_set_generation ?? null,
          release_set_manifest_digest: raw.addon_tracks?.full?.release_set_manifest_digest ?? null,
          deadline_at: raw.addon_tracks?.full?.deadline_at ?? fullAcceptanceDeadline,
          deadline_blocker: raw.addon_tracks?.full?.deadline_blocker ?? null,
        },
      },
  };
  assertStableReleaseSessionInvariants(session);
  return session;
}

export function buildStableReleaseSession(
  plan: ReleaseCohortPlan,
  repo = 'gaofeng21cn/one-person-lab-app',
  generatedAt = plan.generated_at,
): StableReleaseSession {
  const id = stableReleaseSessionIdentity(plan);
  return {
    schema: 'opl_app_stable_release_session.v3', revision: 0, id, created_at: generatedAt, updated_at: generatedAt,
    phase: 'candidate_frozen', version: plan.version, repo, cohort_plan: plan,
    source_gates: plan.cheap_gates
      .filter((gate) => gate.id !== 'release_cohort_lock')
      .filter((gate, index, gates) => gates.findIndex((candidate) => candidate.command === gate.command) === index)
      .map((gate) => ({ id: gate.id, command: gate.command, status: 'pending' })),
    release_run: { id: null, url: null, conclusion: null },
    promotion_run: { id: null, url: null, conclusion: null, attempt: null, rerun_requested_from_attempt: null },
    promotion_progress: {
      release_set_generation: null, release_set_manifest_digest: null,
      last_verified_checkpoint: null, resume_from_checkpoint: 'release_public_nonlatest',
    },
    qualification_run: {
      id: null, url: null, conclusion: null, artifact_run_id: null, artifact_name: null,
      artifact_sha256: null, evidence_ref: null, evidence_sha256: null, verification_harness: null,
    },
    mutation_leases: [],
    mutation_acceptances: [],
    mutation_attempts: [],
    artifact_tracks: emptyArtifactTracks(),
    addon_tracks: {
      full: { required: plan.include_full_package, status: plan.include_full_package ? 'pending' : 'not_requested', run_id: null, run_url: null, conclusion: null, receipt_ref: null, receipt_sha256: null, release_set_generation: null, release_set_manifest_digest: null, deadline_at: null, deadline_blocker: null },
      webui: { required: plan.publish_docker_webui, status: plan.publish_docker_webui ? 'pending' : 'not_requested', receipt_ref: null, receipt_sha256: null },
    },
    terminal_truth: {
      standard_status: 'in_progress',
      addon_status: plan.include_full_package || plan.publish_docker_webui ? 'pending' : 'not_requested',
      standard_terminal_at: null,
      addon_terminal_at: null,
    },
    qualification_retry_policy: {
      max_attempts_per_artifact_kind: 2, same_artifact_only: true,
      semantic_digest_must_match: true, missing_receipt_is_terminal_success: false,
    },
    receipts: { promotion_saga: null, local_activation: null },
    standard_deadline_blocker: null,
    metrics: {
      session_started_at: generatedAt, standard_completed_at: null, addon_completed_at: null, total_wall_time_ms: 0,
      phases: { candidate_frozen: { started_at: generatedAt, ended_at: null, duration_ms: null } },
      workflow_dispatch_counts: { desktop_release: 0, qualification_retry: 0, promotion: 0, full_addon: 0 },
      artifact_build_count: 0, qualification_retry_count: 0, promotion_retry_count: 0,
      wait_poll_policy: {
        monitor: 'read_only_reconcile', interval_seconds: null, absolute_deadline_enforced: true,
        nested_polling_allowed: false, transport_retry_limit: 3,
      },
      reused_artifact_sha256: null, efficiency_advisories: [],
    },
    release_owner_receipt_ref: null,
    transitions: [{ at: generatedAt, from: null, to: 'candidate_frozen', reason: 'immutable cohort and candidate identity frozen' }],
    efficiency_policy: {
      desktop_release_dispatch_limit_per_cohort: 1, monitor_interval_seconds: 60,
      standard_admission_deadline_at: new Date(Date.parse(generatedAt) + 90 * 60 * 1_000).toISOString(),
      run_id_discovery_timeout_seconds: 60, monitor_transport_retry_limit: 3,
      monitor_wall_clock_timeout_seconds: {
        artifact_build_running: 5_400,
        retry_failed_gate_same_artifact: 3_600,
        promotion_running: 3_600,
        standard_stable_terminal: 7_200,
      },
      cross_cohort_artifact_reuse_allowed: false, rebuild_after_smoke_only_change_allowed: false,
    },
    authority_boundary: {
      session_is_release_truth: false, execute_flag_required_for_external_mutation: true,
      publish_requires_candidate_and_owner_receipt: true,
    },
  };
}

const allowedTransitions: Record<StableReleasePhase, StableReleasePhase[]> = {
  candidate_frozen: ['source_gates_passed', 'source_gate_failed', 'standard_deadline_blocked'],
  source_gates_passed: ['artifact_build_running', 'standard_deadline_blocked'], source_gate_failed: [],
  standard_deadline_blocked: [],
  artifact_build_running: ['artifacts_qualified', 'qualification_failed', 'artifact_build_failed', 'release_train_failed', 'standard_deadline_blocked'],
  artifact_build_failed: ['artifact_build_running', 'standard_deadline_blocked'], release_train_failed: ['artifact_build_running', 'standard_deadline_blocked'],
  qualification_failed: ['retry_failed_gate_same_artifact', 'standard_deadline_blocked'],
  retry_failed_gate_same_artifact: ['artifacts_qualified', 'qualification_failed', 'standard_deadline_blocked'],
  artifacts_qualified: ['owner_approved', 'standard_deadline_blocked'], owner_approved: ['promotion_running', 'standard_deadline_blocked'],
  promotion_running: ['release_published_not_latest', 'promotion_failed', 'standard_deadline_blocked'], promotion_failed: ['promotion_running', 'standard_deadline_blocked'],
  release_published_not_latest: ['distribution_synced', 'promotion_failed', 'standard_deadline_blocked'],
  distribution_synced: ['homebrew_verified', 'promotion_failed', 'standard_deadline_blocked'],
  homebrew_verified: ['latest_activated', 'promotion_failed', 'standard_deadline_blocked'],
  latest_activated: ['awaiting_local_activation', 'promotion_failed', 'standard_deadline_blocked'],
  awaiting_local_activation: ['standard_stable_terminal', 'standard_deadline_blocked'],
  standard_stable_terminal: ['addon_train_terminal'], addon_train_terminal: [],
};

export function transitionStableReleaseSession(
  session: StableReleaseSession,
  to: StableReleasePhase,
  reason: string,
  at = new Date().toISOString(),
  deadlineBlocker?: { stage: string; run_id: string | null },
): StableReleaseSession {
  assertStableReleaseSessionInvariants(session);
  if (!allowedTransitions[session.phase].includes(to)) {
    throw new Error(`Invalid stable release transition: ${session.phase} -> ${to}.`);
  }
  const started = Date.parse(session.metrics.session_started_at);
  const ended = Date.parse(at);
  const deadline = Date.parse(session.efficiency_policy.standard_admission_deadline_at);
  const updated = Date.parse(session.updated_at);
  if (!Number.isFinite(ended) || !Number.isFinite(updated) || ended < updated) {
    throw new Error('Stable release transition timestamp must be valid and monotonic.');
  }
  if (
    session.terminal_truth.standard_status === 'in_progress' &&
    to !== 'standard_deadline_blocked' &&
    (!Number.isFinite(deadline) || ended >= deadline) &&
    !hasExactHistoricalPromotionRecovery(session, deadline)
  ) {
    throw new Error('Standard success or non-deadline failure transition cannot occur at or after the immutable 90-minute deadline.');
  }
  if (to === 'standard_deadline_blocked' && (!Number.isFinite(deadline) || ended < deadline)) {
    throw new Error('Standard deadline blocker cannot be recorded before the immutable 90-minute deadline.');
  }
  const elapsed = Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, ended - started) : 0;
  const currentTiming = session.metrics.phases[session.phase];
  const currentStarted = Date.parse(currentTiming?.started_at ?? session.updated_at);
  const phases = {
    ...session.metrics.phases,
    [session.phase]: {
      started_at: currentTiming?.started_at ?? session.updated_at, ended_at: at,
      duration_ms: Number.isFinite(currentStarted) && Number.isFinite(ended) ? Math.max(0, ended - currentStarted) : 0,
    },
    [to]: to === 'standard_stable_terminal' || to === 'addon_train_terminal' || to === 'source_gate_failed' || to === 'standard_deadline_blocked'
      ? { started_at: at, ended_at: at, duration_ms: 0 }
      : { started_at: at, ended_at: null, duration_ms: null },
  };
  const checkpointByPhase: Partial<Record<StableReleasePhase, StableReleaseSession['promotion_progress']['last_verified_checkpoint']>> = {
    release_published_not_latest: 'release_public_nonlatest',
    distribution_synced: 'distribution_synced',
    homebrew_verified: 'homebrew_verified',
    latest_activated: 'latest_activated',
  };
  const promotionCheckpoints = ['release_public_nonlatest', 'distribution_synced', 'homebrew_verified', 'latest_activated'] as const;
  const verifiedCheckpoint = checkpointByPhase[to] ?? session.promotion_progress.last_verified_checkpoint;
  const checkpointIndex = verifiedCheckpoint === null ? -1 : promotionCheckpoints.indexOf(verifiedCheckpoint);
  const transitioned: StableReleaseSession = {
    ...session, phase: to, updated_at: at,
    standard_deadline_blocker: to === 'standard_deadline_blocked' ? {
      status: 'blocked', blocker: 'standard_admission_deadline_elapsed',
      stage: deadlineBlocker?.stage ?? '', run_id: deadlineBlocker?.run_id ?? null,
      observed_at: at, remaining_ms: 0,
      legal_next_actions: ['read_only_reconcile', 'emergency_cancel'],
    } : session.standard_deadline_blocker,
    promotion_progress: {
      ...session.promotion_progress,
      last_verified_checkpoint: verifiedCheckpoint,
      resume_from_checkpoint: promotionCheckpoints[Math.min(checkpointIndex + 1, promotionCheckpoints.length - 1)],
    },
    terminal_truth: {
      ...session.terminal_truth,
      standard_status: to === 'standard_stable_terminal' || to === 'addon_train_terminal'
        ? 'terminal'
        : to === 'source_gate_failed' || to === 'standard_deadline_blocked'
          ? 'blocked'
          : session.terminal_truth.standard_status,
      standard_terminal_at: to === 'standard_stable_terminal' ? at : session.terminal_truth.standard_terminal_at,
      addon_status: to === 'addon_train_terminal' ? session.terminal_truth.addon_status : session.terminal_truth.addon_status,
      addon_terminal_at: to === 'addon_train_terminal' ? at : session.terminal_truth.addon_terminal_at,
    },
    transitions: [...session.transitions, { at, from: session.phase, to, reason }],
    metrics: {
      ...session.metrics, total_wall_time_ms: elapsed,
      standard_completed_at: to === 'standard_stable_terminal' ? at : session.metrics.standard_completed_at,
      addon_completed_at: to === 'addon_train_terminal' ? at : session.metrics.addon_completed_at,
      phases, efficiency_advisories: session.metrics.efficiency_advisories,
    },
  };
  assertStableReleaseSessionInvariants(transitioned);
  return transitioned;
}

export function blockFullAddonAtDeadline(
  session: StableReleaseSession,
  input: {
    acceptanceAttemptId: string;
    runId: string;
    deadlineAt: string;
    observedAtMs: number;
    remoteStatus: string;
  },
): StableReleaseSession {
  assertStableReleaseSessionInvariants(session);
  if (session.terminal_truth.standard_status !== 'terminal') {
    throw new Error('Full add-on deadline blocker cannot alter a nonterminal Standard session.');
  }
  if (session.addon_tracks.full.status === 'qualified') {
    throw new Error('A qualified Full add-on cannot be replaced by a deadline blocker.');
  }
  if (session.addon_tracks.full.deadline_blocker) return session;
  const acceptance = session.mutation_acceptances.find((candidate) =>
    candidate.lease.attempt_id === input.acceptanceAttemptId &&
    candidate.pre_api_fence.request.mutation === 'full_addon_dispatch' &&
    candidate.github.run_id === input.runId
  );
  if (!acceptance || acceptance.full_addon_deadline_at !== input.deadlineAt) {
    throw new Error('Full add-on deadline blocker lacks its exact signed broker acceptance.');
  }
  if (session.addon_tracks.full.run_id !== input.runId || session.addon_tracks.full.deadline_at !== input.deadlineAt) {
    throw new Error('Full add-on deadline blocker conflicts with the durable add-on track identity.');
  }
  const deadlineAtMs = Date.parse(input.deadlineAt);
  if (!Number.isFinite(deadlineAtMs) || !Number.isFinite(input.observedAtMs) || input.observedAtMs < deadlineAtMs) {
    throw new Error('Full add-on deadline blocker cannot be recorded before the signed deadline.');
  }
  const at = new Date(input.observedAtMs).toISOString();
  const elapsed = Math.max(0, input.observedAtMs - Date.parse(session.metrics.session_started_at));
  let blocked: StableReleaseSession = {
    ...session,
    updated_at: at,
    addon_tracks: {
      ...session.addon_tracks,
      full: {
        ...session.addon_tracks.full,
        status: 'blocked_with_debt',
        conclusion: 'deadline_blocked',
        receipt_ref: null,
        receipt_sha256: null,
        deadline_blocker: {
          status: 'blocked_with_debt',
          blocker: 'full_addon_deadline_elapsed',
          acceptance_attempt_id: input.acceptanceAttemptId,
          run_id: input.runId,
          deadline_at: input.deadlineAt,
          observed_at: at,
          remote_status: input.remoteStatus || 'unknown',
          remaining_ms: 0,
          legal_next_actions: ['read_only_reconcile', 'emergency_cancel'],
        },
      },
    },
    terminal_truth: { ...session.terminal_truth, addon_status: 'blocked_with_debt' },
    metrics: { ...session.metrics, total_wall_time_ms: Math.max(session.metrics.total_wall_time_ms, elapsed) },
  };
  const webui = blocked.addon_tracks.webui;
  const webuiTerminal = !webui.required || ['verified', 'blocked_with_debt'].includes(webui.status);
  if (webuiTerminal && blocked.phase === 'standard_stable_terminal') {
    blocked = transitionStableReleaseSession(
      blocked,
      'addon_train_terminal',
      'Full add-on reached its signed 50-minute deadline; Standard remains terminal and add-on debt is durable',
      at,
    );
  }
  assertStableReleaseSessionInvariants(blocked);
  return blocked;
}

export function appendStableReleaseEfficiencyAdvisory(
  session: StableReleaseSession,
  input: { stage: string; status: string; observedAtMs: number },
): StableReleaseSession {
  assertStableReleaseSessionInvariants(session);
  if (session.metrics.efficiency_advisories.some((advisory) => advisory.threshold_ms === 3_600_000)) return session;
  const startedAtMs = Date.parse(session.metrics.session_started_at);
  const deadlineAtMs = Date.parse(session.efficiency_policy.standard_admission_deadline_at);
  if (
    !Number.isFinite(input.observedAtMs) || input.observedAtMs < startedAtMs + 3_600_000 ||
    input.observedAtMs >= deadlineAtMs
  ) throw new Error('Standard efficiency warning must be recorded from 60:00 until before the immutable 90:00 deadline.');
  const at = new Date(input.observedAtMs).toISOString();
  const advisory: StandardEfficiencyAdvisory = {
    at, elapsed_ms: input.observedAtMs - startedAtMs, threshold_ms: 3_600_000,
    stage: input.stage, status: input.status, blocker: 'standard_release_elapsed_60m',
    remaining_ms: deadlineAtMs - input.observedAtMs,
    action: 'inspect_current_stage_and_preserve_same_cohort_evidence',
  };
  const next = {
    ...session, updated_at: at,
    metrics: {
      ...session.metrics,
      total_wall_time_ms: input.observedAtMs - startedAtMs,
      efficiency_advisories: [...session.metrics.efficiency_advisories, advisory],
    },
  };
  assertStableReleaseSessionInvariants(next);
  return next;
}

export function appendQualificationAttempt(
  session: StableReleaseSession,
  input: {
    artifactKind: QualificationArtifactKind; workflow: QualificationAttempt['workflow'];
    mutation: QualificationAttempt['mutation']; at?: string; reason: string;
    verificationHarness?: QualificationAttempt['verification_harness'];
    mutationAttemptId?: string;
  },
): { session: StableReleaseSession; attemptId: string } {
  const at = input.at ?? new Date().toISOString();
  const track = session.artifact_tracks[input.artifactKind];
  const existing = input.mutationAttemptId
    ? track.attempts.find((attempt) => attempt.mutation_attempt_id === input.mutationAttemptId)
    : null;
  if (existing) {
    if (
      existing.workflow !== input.workflow || existing.mutation !== input.mutation ||
      JSON.stringify(existing.verification_harness) !== JSON.stringify(input.verificationHarness ?? null)
    ) {
      throw new Error(`Qualification attempt linked to mutation ${input.mutationAttemptId} has conflicting immutable inputs.`);
    }
    return { session, attemptId: existing.attempt_id };
  }
  if (track.attempts.length >= session.qualification_retry_policy.max_attempts_per_artifact_kind) {
    throw new Error(`${input.artifactKind} qualification reached the bounded attempt limit of ${session.qualification_retry_policy.max_attempts_per_artifact_kind}.`);
  }
  const sequence = track.attempts.length + 1;
  const attemptId = `sha256:${crypto.createHash('sha256').update(JSON.stringify({ session: session.id, artifact_kind: input.artifactKind, sequence, at })).digest('hex')}`;
  const attempt: QualificationAttempt = {
    attempt_id: attemptId, sequence, workflow: input.workflow, mutation: input.mutation, created_at: at,
    mutation_attempt_id: input.mutationAttemptId ?? null,
    verification_harness: input.verificationHarness ?? null,
    events: [{ at, state: 'planned', run_id: null, conclusion: null, failure_taxonomy: 'none', remote_receipt_ref: null, reason: input.reason }],
  };
  return {
    attemptId,
    session: {
      ...session, updated_at: at,
      artifact_tracks: { ...session.artifact_tracks, [input.artifactKind]: { ...track, attempts: [...track.attempts, attempt] } },
    },
  };
}

export function appendQualificationAttemptEvent(
  session: StableReleaseSession,
  artifactKind: QualificationArtifactKind,
  attemptId: string,
  event: QualificationAttemptEvent,
): StableReleaseSession {
  const track = session.artifact_tracks[artifactKind];
  const index = track.attempts.findIndex((attempt) => attempt.attempt_id === attemptId);
  if (index < 0) throw new Error(`Unknown ${artifactKind} qualification attempt ${attemptId}.`);
  const attempt = track.attempts[index];
  if (['passed', 'failed', 'cancelled'].includes(attempt.events.at(-1)?.state ?? '')) {
    throw new Error(`Qualification attempt ${attemptId} is already terminal.`);
  }
  const attempts = [...track.attempts];
  attempts[index] = { ...attempt, events: [...attempt.events, event] };
  return {
    ...session, updated_at: event.at,
    artifact_tracks: { ...session.artifact_tracks, [artifactKind]: { ...track, attempts } },
  };
}

export function planReleaseMutationAttempt(
  session: StableReleaseSession,
  input: {
    mutation: ReleaseMutation;
    workflow: ReleaseSessionLeaseV2['workflow'];
    artifactKind: ReleaseSessionLeaseV2['artifact_kind'];
    controllerWorkflowSha: string;
    artifactAppSha: string;
    mutationPayloadSha256: string;
    mutationPayload?: ReleaseMutationPayload;
    admissionMode?: ReleaseMutationAttempt['admission_mode'];
    priorRunIds?: string[];
    targetAttemptId?: string;
    targetRunId?: string;
    at?: string;
    reason: string;
  },
): { session: StableReleaseSession; attemptId: string } {
  if (session.terminal_truth.standard_status === 'blocked' && input.mutation !== 'workflow_cancel') {
    throw new Error('Typed blocked Standard session permits only read-only reconcile or an exact emergency cancel.');
  }
  const at = input.at ?? new Date().toISOString();
  const authority = readReleaseBrokerAuthority();
  const authorityErrors = validateReleaseBrokerAuthority(authority, { requireProvisioned: false });
  if (authorityErrors.length > 0) throw new Error(`Release mutation dispatch fence authority is invalid: ${authorityErrors.join('; ')}`);
  const workflowHeadBranch = authority.canonical_workflow_ref.replace(/^refs\/heads\//, '');
  if (workflowHeadBranch !== 'main') throw new Error('Release mutation dispatch fence must use canonical main.');
  const activeAttempts = session.mutation_attempts.filter((attempt) =>
    !['succeeded', 'failed', 'cancelled'].includes(attempt.events.at(-1)?.state ?? ''),
  );
  if (activeAttempts.length > 0) {
    const matching = activeAttempts.find((attempt) => (
      attempt.mutation === input.mutation && attempt.workflow === input.workflow &&
      attempt.artifact_kind === input.artifactKind &&
      attempt.controller_workflow_sha === input.controllerWorkflowSha &&
      attempt.artifact_app_sha === input.artifactAppSha &&
      attempt.mutation_payload_sha256 === input.mutationPayloadSha256 &&
      attempt.admission_mode === (input.admissionMode ?? 'isolated_broker') &&
      JSON.stringify(attempt.mutation_payload) === JSON.stringify(input.mutationPayload ?? {}) &&
      attempt.dispatch_fence.target_attempt_id === (input.targetAttemptId ?? null) &&
      attempt.dispatch_fence.target_run_id === (input.targetRunId ?? null)
    ));
    if (matching) return { session, attemptId: matching.attempt_id };
    const activeCancels = activeAttempts.filter((attempt) => attempt.mutation === 'workflow_cancel');
    const activePrimaries = activeAttempts.filter((attempt) => attempt.mutation !== 'workflow_cancel');
    const targetPrimary = activePrimaries[0];
    const exactEmergencyCancel = Boolean(targetPrimary) && input.mutation === 'workflow_cancel' &&
      activeCancels.length === 0 && activePrimaries.length === 1 &&
      input.targetAttemptId === targetPrimary?.attempt_id &&
      input.targetRunId === targetPrimary?.events.at(-1)?.run_id &&
      input.workflow === targetPrimary?.workflow && input.artifactKind === targetPrimary?.artifact_kind &&
      input.controllerWorkflowSha === targetPrimary?.controller_workflow_sha &&
      input.artifactAppSha === targetPrimary?.artifact_app_sha;
    if (!exactEmergencyCancel) {
      throw new Error(
        `Stable release session has an in-flight mutation attempt; use status, reconcile, or resume before planning another mutation.`,
      );
    }
  }
  if (input.mutation === 'workflow_cancel' && (!input.targetAttemptId || !input.targetRunId)) {
    throw new Error('Emergency cancel planning requires the exact active target attempt and run id.');
  }
  const attemptId = `sha256:${crypto.createHash('sha256').update(JSON.stringify({
    session: session.id, mutation: input.mutation, workflow: input.workflow,
    artifact_kind: input.artifactKind,
    admission_mode: input.admissionMode ?? 'isolated_broker',
    controller_workflow_sha: input.controllerWorkflowSha,
    artifact_app_sha: input.artifactAppSha,
    mutation_payload_sha256: input.mutationPayloadSha256,
    mutation_payload: input.mutationPayload ?? null,
    planned_session_revision: session.revision + 1,
    sequence: session.mutation_attempts.length + 1, at,
  })).digest('hex')}`;
  const attempt: ReleaseMutationAttempt = {
    attempt_id: attemptId,
    admission_mode: input.admissionMode ?? 'isolated_broker',
    mutation: input.mutation,
    workflow: input.workflow,
    artifact_kind: input.artifactKind,
    controller_workflow_sha: input.controllerWorkflowSha,
    artifact_app_sha: input.artifactAppSha,
    mutation_payload_sha256: input.mutationPayloadSha256,
    mutation_payload: input.mutationPayload ?? {},
    planned_session_revision: session.revision + 1,
    broker_lookup: {
      request_sha256: null, last_status: 'never', observed_at: null,
      ledger_generation: null, version_aggregate_revision: null, latest_mutation_head_revision: null,
      complete_through_sequence: null, authority_epoch: null,
      not_found_ledger_generation: null,
    },
    dispatch_fence: {
      mode: input.targetRunId ? 'existing_run_mutation' : 'new_workflow_run',
      workflow_head_branch: workflowHeadBranch,
      earliest_created_at: at,
      prior_run_ids: [...new Set(input.priorRunIds ?? [])].sort(),
      target_attempt_id: input.targetAttemptId ?? null,
      target_run_id: input.targetRunId ?? null,
    },
    created_at: at,
    events: [{ at, state: 'planned', run_id: input.targetRunId ?? null, reason: input.reason }],
  };
  return {
    attemptId,
    session: { ...session, updated_at: at, mutation_attempts: [...session.mutation_attempts, attempt] },
  };
}

export function appendReleaseMutationAttemptEvent(
  session: StableReleaseSession,
  attemptId: string,
  event: ReleaseMutationAttempt['events'][number],
): StableReleaseSession {
  const index = session.mutation_attempts.findIndex((attempt) => attempt.attempt_id === attemptId);
  if (index < 0) throw new Error(`Unknown release mutation attempt ${attemptId}.`);
  const current = session.mutation_attempts[index];
  if (['succeeded', 'failed', 'cancelled'].includes(current.events.at(-1)?.state ?? '')) {
    throw new Error(`Release mutation attempt ${attemptId} is already terminal.`);
  }
  const mutationAttempts = [...session.mutation_attempts];
  mutationAttempts[index] = { ...current, events: [...current.events, event] };
  return { ...session, updated_at: event.at, mutation_attempts: mutationAttempts };
}

export function issueReleaseMutationLease(
  session: StableReleaseSession,
  input: {
    actor: string;
    attemptId: string;
    workflow: ReleaseSessionLeaseV2['workflow'];
    artifactKind: ReleaseSessionLeaseV2['artifact_kind'];
    controllerWorkflowSha: string;
    artifactAppSha: string;
    mutation: ReleaseMutation;
    issuedAt?: string;
    broker?: ReleaseLeaseBroker;
    authority?: ReleaseBrokerAuthorityV1;
  },
): { session: StableReleaseSession; lease: ReleaseSessionLeaseV2 } {
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const attempt = session.mutation_attempts.find((candidate) => candidate.attempt_id === input.attemptId);
  if (!attempt) throw new Error(`Release mutation lease requires a durable planned attempt ${input.attemptId}.`);
  const authority = input.authority ?? readReleaseBrokerAuthority();
  const authorityErrors = validateReleaseBrokerAuthority(authority);
  if (authorityErrors.length > 0) {
    throw new Error(`Release broker authority is not ready: ${authorityErrors.join('; ')}`);
  }
  if (attempt.events.at(-1)?.state !== 'planned') {
    throw new Error(`Release mutation attempt ${input.attemptId} must be in planned state before ticket issuance.`);
  }
  if (session.mutation_leases.some((lease) => lease.attempt_id === input.attemptId)) {
    throw new Error(`Release mutation attempt ${input.attemptId} already has a signed or advisory ticket.`);
  }
  if (
    attempt.mutation !== input.mutation || attempt.workflow !== input.workflow ||
    attempt.artifact_kind !== input.artifactKind ||
    attempt.controller_workflow_sha !== input.controllerWorkflowSha ||
    attempt.artifact_app_sha !== input.artifactAppSha
  ) {
    throw new Error(`Release mutation attempt ${input.attemptId} does not match the requested lease binding.`);
  }
  if (session.revision !== attempt.planned_session_revision) {
    throw new Error(`Release mutation attempt ${input.attemptId} is not durably persisted at planned session revision ${attempt.planned_session_revision}.`);
  }
  const leaseInput = {
    stableSessionId: session.id, releaseCohortRef: session.cohort_plan.operator_plan_ref,
    repository: session.repo,
    operatorActor: input.actor, brokerActor: authority.broker_identity.github_actor,
    attemptId: input.attemptId, workflow: input.workflow,
    artifactKind: input.artifactKind,
    controllerWorkflowSha: input.controllerWorkflowSha,
    artifactAppSha: input.artifactAppSha,
    mutationPayloadSha256: attempt.mutation_payload_sha256,
    plannedSessionRevision: attempt.planned_session_revision,
    mutation: input.mutation,
    issuedAt,
  } satisfies Omit<LeaseBuildInput, 'signingPrivateKeyPem'>;
  if (!input.broker) {
    throw new Error('Production mutation authorization is issued only inside the isolated release mutation broker; controller-side signer fallback is forbidden.');
  }
  const lease = input.broker(leaseInput);
  const leaseErrors = validateReleaseSessionLease(lease, {
    stableSessionId: session.id, releaseCohortRef: session.cohort_plan.operator_plan_ref,
    repository: session.repo, operatorActor: input.actor, brokerActor: authority.broker_identity.github_actor,
    mutation: input.mutation, attemptId: input.attemptId,
    workflow: input.workflow, artifactKind: input.artifactKind,
    controllerWorkflowSha: input.controllerWorkflowSha, artifactAppSha: input.artifactAppSha,
    mutationPayloadSha256: attempt.mutation_payload_sha256,
    plannedSessionRevision: attempt.planned_session_revision,
    issuer: authority.issuer, publicKeys: authority.trusted_ed25519_public_keys, requireSigned: true,
    now: issuedAt,
  });
  if (leaseErrors.length > 0) throw new Error(`Release broker returned an invalid ticket: ${leaseErrors.join('; ')}`);
  return {
    lease,
    session: { ...session, updated_at: issuedAt, mutation_leases: [...session.mutation_leases, lease] },
  };
}
