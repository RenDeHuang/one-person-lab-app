import crypto from 'node:crypto';
import fs from 'node:fs';

type HistoricalReleaseCohortPlan = {
  schema: 'opl_app_release_cohort_plan.v1';
  version: string;
  generated_at: string;
  operator_plan_ref: string;
  cohort_lock: {
    app: { resolved_sha: string };
    shell: { resolved_sha: string };
    framework: { resolved_sha: string };
  };
  [key: string]: unknown;
};

export type StableReleasePhase =
  | 'candidate_frozen'
  | 'source_gates_passed'
  | 'artifact_build_running'
  | 'source_gate_failed'
  | 'standard_deadline_blocked'
  | 'artifact_build_failed'
  | 'release_train_failed'
  | 'qualification_failed'
  | 'retry_failed_gate_same_artifact'
  | 'artifacts_qualified'
  | 'owner_approved'
  | 'promotion_running'
  | 'promotion_failed'
  | 'release_published_not_latest'
  | 'distribution_synced'
  | 'homebrew_verified'
  | 'latest_activated'
  | 'awaiting_local_activation'
  | 'standard_stable_terminal'
  | 'addon_train_terminal';

export type HistoricalReleaseMutationAttempt = {
  attempt_id: string;
  mutation: string;
  workflow: string;
  events: Array<{ at: string; state: string; run_id: string | null; reason: string }>;
  [key: string]: unknown;
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
  cohort_plan: HistoricalReleaseCohortPlan;
  release_run: { id: string | null; url?: string | null; conclusion: string | null };
  promotion_run: {
    id: string | null;
    url?: string | null;
    conclusion: string | null;
    attempt?: number | null;
    rerun_requested_from_attempt?: number | null;
  };
  mutation_attempts: HistoricalReleaseMutationAttempt[];
  receipts: {
    promotion_saga: { ref: string; sha256: string } | null;
    local_activation?: { ref: string; sha256: string } | null;
  };
  authority_boundary?: {
    session_is_release_truth?: false;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const digestRefPattern = /^sha256:[0-9a-f]{64}$/;
const exactShaPattern = /^[0-9a-f]{40}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function stableReleaseSessionIdentity(plan: HistoricalReleaseCohortPlan): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify({
    version: plan.version,
    admitted_at: plan.generated_at,
    operator_plan_ref: plan.operator_plan_ref,
    app_sha: plan.cohort_lock.app.resolved_sha,
    shell_sha: plan.cohort_lock.shell.resolved_sha,
    framework_sha: plan.cohort_lock.framework.resolved_sha,
  })).digest('hex')}`;
}

export function validateStableReleaseSessionInvariants(value: unknown): string[] {
  const candidate = record(value);
  if (!candidate) return ['historical Stable session is missing or malformed'];
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_stable_release_session.v3') {
    errors.push('historical Stable session schema is unsupported');
  }
  if (!Number.isSafeInteger(candidate.revision) || Number(candidate.revision) < 0) {
    errors.push('historical Stable session revision is invalid');
  }
  if (!digestRefPattern.test(String(candidate.id))) errors.push('historical Stable session id is invalid');
  if (typeof candidate.version !== 'string' || candidate.version.length === 0) {
    errors.push('historical Stable session version is missing');
  }
  if (typeof candidate.repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate.repo)) {
    errors.push('historical Stable session repository is invalid');
  }
  if (!Number.isFinite(Date.parse(String(candidate.created_at))) || !Number.isFinite(Date.parse(String(candidate.updated_at)))) {
    errors.push('historical Stable session timestamps are invalid');
  }
  const plan = record(candidate.cohort_plan) as HistoricalReleaseCohortPlan | null;
  if (!plan || plan.schema !== 'opl_app_release_cohort_plan.v1') {
    errors.push('historical Stable session cohort plan is missing');
  } else {
    for (const [label, sha] of [
      ['App', plan.cohort_lock?.app?.resolved_sha],
      ['Shell', plan.cohort_lock?.shell?.resolved_sha],
      ['Framework', plan.cohort_lock?.framework?.resolved_sha],
    ] as const) {
      if (!exactShaPattern.test(String(sha))) errors.push(`historical Stable session ${label} SHA is invalid`);
    }
    if (candidate.id !== stableReleaseSessionIdentity(plan)) {
      errors.push('historical Stable session identity does not match its cohort plan');
    }
  }
  if (!record(candidate.release_run)) errors.push('historical Stable session release run is missing');
  if (!record(candidate.promotion_run)) errors.push('historical Stable session promotion run is missing');
  if (!Array.isArray(candidate.mutation_attempts)) errors.push('historical Stable session mutation attempts are malformed');
  if (!record(candidate.receipts)) errors.push('historical Stable session receipts are malformed');
  const authorityBoundary = record(candidate.authority_boundary);
  if (authorityBoundary?.session_is_release_truth === true) {
    errors.push('historical Stable session cannot claim live release truth');
  }
  return errors;
}

export function assertStableReleaseSessionInvariants(session: unknown): asserts session is StableReleaseSession {
  const errors = validateStableReleaseSessionInvariants(session);
  if (errors.length > 0) throw new Error(`Historical Stable session validation failed: ${errors.join('; ')}`);
}

export function readStableReleaseSession(statePath: string): StableReleaseSession {
  const value = JSON.parse(fs.readFileSync(statePath, 'utf8')) as unknown;
  assertStableReleaseSessionInvariants(value);
  return value;
}
