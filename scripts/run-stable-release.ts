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
  type QualificationHarnessScopeProof,
} from './qualification-harness-scope.ts';
import { readReceipt, validateLocalActivationReceipt, validatePromotionSagaReceipt } from './release-saga-receipts.ts';

const defaultRepo = 'gaofeng21cn/one-person-lab-app';

export type StableReleasePhase =
  | 'candidate_frozen'
  | 'source_gates_passed'
  | 'artifact_build_running'
  | 'source_gate_failed'
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
  | 'complete';

type PhaseTiming = { started_at: string; ended_at: string | null; duration_ms: number | null };

type ReleaseMetrics = {
  session_started_at: string;
  session_completed_at: string | null;
  total_wall_time_ms: number;
  phases: Partial<Record<StableReleasePhase, PhaseTiming>>;
  workflow_dispatch_counts: { desktop_release: number; qualification_retry: number; promotion: number };
  artifact_build_count: number;
  qualification_retry_count: number;
  promotion_retry_count: number;
  wait_poll_policy: {
    monitor: 'gh_run_watch';
    interval_seconds: 60;
    nested_polling_allowed: false;
    transport_retry_limit: 3;
  };
  reused_artifact_sha256: string | null;
  efficiency_advisories: Array<{ at: string; elapsed_ms: number; threshold_ms: 5400000; action: string }>;
};

export type StableReleaseSession = {
  schema: 'opl_app_stable_release_session.v2';
  id: string;
  created_at: string;
  updated_at: string;
  phase: StableReleasePhase;
  version: string;
  repo: string;
  cohort_plan: ReleaseCohortPlan;
  source_gates: Array<{
    id: string;
    command: string;
    status: 'pending' | 'passed' | 'failed';
  }>;
  release_run: {
    id: string | null;
    url: string | null;
    conclusion: string | null;
  };
  promotion_run: {
    id: string | null;
    url: string | null;
    conclusion: string | null;
    attempt: number | null;
    rerun_requested_from_attempt: number | null;
  };
  qualification_run: {
    id: string | null;
    url: string | null;
    conclusion: string | null;
    artifact_run_id: string | null;
    artifact_name: string | null;
    artifact_sha256: string | null;
    evidence_ref: string | null;
    evidence_sha256: string | null;
    verification_harness?: {
      app_ref: string;
      app_sha: string;
      shell_ref: string;
      shell_sha: string;
      scope_proof: QualificationHarnessScopeProof;
    } | null;
  };
  receipts: {
    promotion_saga: { ref: string; sha256: string } | null;
    local_activation: { ref: string; sha256: string } | null;
  };
  metrics: ReleaseMetrics;
  release_owner_receipt_ref: string | null;
  transitions: Array<{
    at: string;
    from: StableReleasePhase | null;
    to: StableReleasePhase;
    reason: string;
  }>;
  efficiency_policy: {
    desktop_release_dispatch_limit_per_cohort: 1;
    monitor_interval_seconds: 60;
    run_id_discovery_timeout_seconds: 60;
    monitor_transport_retry_limit: 3;
    cross_cohort_artifact_reuse_allowed: false;
    rebuild_after_smoke_only_change_allowed: false;
  };
  authority_boundary: {
    session_is_release_truth: false;
    execute_flag_required_for_external_mutation: true;
    publish_requires_candidate_and_owner_receipt: true;
  };
};

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type StableReleaseCommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => CommandResult;

type StartOptions = {
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

type RetryQualificationOptions = {
  execute: boolean;
  watch: boolean;
  statePath: string;
  smokeHarnessAppRef?: string;
  smokeHarnessShellRef?: string;
};

type QualificationVerificationHarness = NonNullable<StableReleaseSession['qualification_run']['verification_harness']>;

type CompleteLocalOptions = { statePath: string; receiptPath: string; localAuthorizationPolicyPath: string };

function run(command: string, args: string[], options: { cwd?: string } = {}): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
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

function writeSession(statePath: string, session: StableReleaseSession): void {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
}

function readSession(statePath: string): StableReleaseSession {
  const session = JSON.parse(fs.readFileSync(statePath, 'utf8')) as StableReleaseSession;
  if (session.schema !== 'opl_app_stable_release_session.v2') {
    throw new Error(`Unsupported stable release session schema in ${statePath}.`);
  }
  return session;
}

export function buildStableReleaseSession(
  plan: ReleaseCohortPlan,
  repo = defaultRepo,
  generatedAt = now(),
): StableReleaseSession {
  const identity = JSON.stringify({
    version: plan.version,
    operator_plan_ref: plan.operator_plan_ref,
    app_sha: plan.cohort_lock.app.resolved_sha,
    shell_sha: plan.cohort_lock.shell.resolved_sha,
    framework_sha: plan.cohort_lock.framework.resolved_sha,
  });
  return {
    schema: 'opl_app_stable_release_session.v2',
    id: `sha256:${crypto.createHash('sha256').update(identity).digest('hex')}`,
    created_at: generatedAt,
    updated_at: generatedAt,
    phase: 'candidate_frozen',
    version: plan.version,
    repo,
    cohort_plan: plan,
    source_gates: plan.cheap_gates
      .filter((gate) => gate.id !== 'release_cohort_lock')
      .filter((gate, index, gates) => gates.findIndex((candidate) => candidate.command === gate.command) === index)
      .map((gate) => ({ id: gate.id, command: gate.command, status: 'pending' })),
    release_run: { id: null, url: null, conclusion: null },
    promotion_run: { id: null, url: null, conclusion: null, attempt: null, rerun_requested_from_attempt: null },
    qualification_run: {
      id: null, url: null, conclusion: null, artifact_run_id: null, artifact_name: null,
      artifact_sha256: null, evidence_ref: null, evidence_sha256: null, verification_harness: null,
    },
    receipts: { promotion_saga: null, local_activation: null },
    metrics: {
      session_started_at: generatedAt,
      session_completed_at: null,
      total_wall_time_ms: 0,
      phases: { candidate_frozen: { started_at: generatedAt, ended_at: null, duration_ms: null } },
      workflow_dispatch_counts: { desktop_release: 0, qualification_retry: 0, promotion: 0 },
      artifact_build_count: 0,
      qualification_retry_count: 0,
      promotion_retry_count: 0,
      wait_poll_policy: {
        monitor: 'gh_run_watch',
        interval_seconds: 60,
        nested_polling_allowed: false,
        transport_retry_limit: 3,
      },
      reused_artifact_sha256: null,
      efficiency_advisories: [],
    },
    release_owner_receipt_ref: null,
    transitions: [{ at: generatedAt, from: null, to: 'candidate_frozen', reason: 'immutable cohort and candidate identity frozen' }],
    efficiency_policy: {
      desktop_release_dispatch_limit_per_cohort: 1,
      monitor_interval_seconds: 60,
      run_id_discovery_timeout_seconds: 60,
      monitor_transport_retry_limit: 3,
      cross_cohort_artifact_reuse_allowed: false,
      rebuild_after_smoke_only_change_allowed: false,
    },
    authority_boundary: {
      session_is_release_truth: false,
      execute_flag_required_for_external_mutation: true,
      publish_requires_candidate_and_owner_receipt: true,
    },
  };
}

const allowedTransitions: Record<StableReleasePhase, StableReleasePhase[]> = {
  candidate_frozen: ['source_gates_passed', 'source_gate_failed'],
  source_gates_passed: ['artifact_build_running'],
  source_gate_failed: [],
  artifact_build_running: ['artifacts_qualified', 'qualification_failed', 'artifact_build_failed', 'release_train_failed'],
  artifact_build_failed: ['artifact_build_running'],
  release_train_failed: [],
  qualification_failed: ['retry_failed_gate_same_artifact'],
  retry_failed_gate_same_artifact: ['artifacts_qualified', 'qualification_failed'],
  artifacts_qualified: ['owner_approved'],
  owner_approved: ['promotion_running'],
  promotion_running: ['release_published_not_latest', 'promotion_failed'],
  promotion_failed: ['promotion_running'],
  release_published_not_latest: ['distribution_synced', 'promotion_failed'],
  distribution_synced: ['homebrew_verified', 'promotion_failed'],
  homebrew_verified: ['latest_activated', 'promotion_failed'],
  latest_activated: ['awaiting_local_activation', 'promotion_failed'],
  awaiting_local_activation: ['complete'],
  complete: [],
};

export function transitionStableReleaseSession(
  session: StableReleaseSession,
  to: StableReleasePhase,
  reason: string,
  at = now(),
): StableReleaseSession {
  if (!allowedTransitions[session.phase].includes(to)) {
    throw new Error(`Invalid stable release transition: ${session.phase} -> ${to}.`);
  }
  const started = Date.parse(session.metrics.session_started_at);
  const ended = Date.parse(at);
  const elapsed = Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, ended - started) : 0;
  const currentTiming = session.metrics.phases[session.phase];
  const currentStarted = Date.parse(currentTiming?.started_at ?? session.updated_at);
  const phases = {
    ...session.metrics.phases,
    [session.phase]: {
      started_at: currentTiming?.started_at ?? session.updated_at,
      ended_at: at,
      duration_ms: Number.isFinite(currentStarted) && Number.isFinite(ended) ? Math.max(0, ended - currentStarted) : 0,
    },
    [to]: { started_at: at, ended_at: null, duration_ms: null },
  };
  const efficiencyAdvisories = elapsed >= 5_400_000 && session.metrics.efficiency_advisories.length === 0
    ? [{ at, elapsed_ms: elapsed, threshold_ms: 5_400_000 as const, action: 'classify blocker and reuse same-cohort evidence; do not stop the authorized release solely because of elapsed time' }]
    : session.metrics.efficiency_advisories;
  return {
    ...session,
    phase: to,
    updated_at: at,
    transitions: [...session.transitions, { at, from: session.phase, to, reason }],
    metrics: {
      ...session.metrics,
      total_wall_time_ms: elapsed,
      session_completed_at: to === 'complete' ? at : session.metrics.session_completed_at,
      phases,
      efficiency_advisories: efficiencyAdvisories,
    },
  };
}

function workflowRef(plan: ReleaseCohortPlan): string {
  const ref = plan.cohort_lock.app.requested_ref;
  if (/^[0-9a-f]{7,40}$/i.test(ref)) {
    throw new Error('Stable release dispatch requires the branch or tag recorded by the cohort plan, not a manually entered SHA.');
  }
  return ref;
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

export function desktopReleaseDispatchArgs(session: StableReleaseSession): string[] {
  const plan = session.cohort_plan;
  return [
    'workflow', 'run', 'desktop-release.yml',
    '--repo', session.repo,
    '--ref', workflowRef(plan),
    '--field', `opl_version=${plan.version}`,
    '--field', `release_mode=${plan.release_mode}`,
    '--field', `release_intent=${plan.release_intent}`,
    '--field', `full_omission_reason=${plan.full_omission_reason ?? ''}`,
    '--field', `release_operator_plan_ref=${plan.operator_plan_ref}`,
    '--field', `stable_session_id=${session.id}`,
    '--field', `gate_reuse_plan_ref=${plan.gate_reuse_plan_ref ?? ''}`,
    '--field', `include_full_package=${String(plan.include_full_package)}`,
    '--field', `run_vm_smoke=${String(plan.run_vm_smoke)}`,
    '--field', `publish_docker_webui=${String(plan.publish_docker_webui)}`,
    '--field', 'defer_addons=true',
    '--field', 'require_addon_gates_for_stable_readiness=false',
    '--field', `shell_ref=${plan.cohort_lock.shell.resolved_sha}`,
    '--field', `framework_ref=${plan.cohort_lock.framework.resolved_sha}`,
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
): string[] {
  if (!session.release_run.id) throw new Error('Same-artifact qualification retry requires the original release run id.');
  const artifactName = session.qualification_run.artifact_name;
  if (!artifactName || !session.qualification_run.artifact_sha256) {
    throw new Error('Same-artifact qualification retry requires a validated artifact manifest in the release session.');
  }
  return [
    'workflow', 'run', 'opl-first-run-vm.yml',
    '--repo', session.repo,
    '--ref', verificationHarness.app_ref,
    '--field', `release_tag=v${session.version}`,
    '--field', 'package_profile=full',
    '--field', 'diagnostic_scope=release_gate',
    '--field', `release_artifact_name=${artifactName}`,
    '--field', `release_artifact_run_id=${session.release_run.id}`,
    '--field', `stable_session_id=${session.id}`,
    '--field', `release_cohort_ref=${session.cohort_plan.operator_plan_ref}`,
    '--field', `artifact_app_ref=${session.cohort_plan.cohort_lock.app.resolved_sha}`,
    '--field', `shell_ref=${session.cohort_plan.cohort_lock.shell.resolved_sha}`,
    '--field', `smoke_harness_ref=${verificationHarness.shell_sha}`,
    '--field', `framework_ref=${session.cohort_plan.cohort_lock.framework.resolved_sha}`,
  ];
}

function verifyRemoteDispatchHead(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
): void {
  const ref = workflowRef(session.cohort_plan);
  const result = runner('gh', [
    'api', `repos/${session.repo}/commits/${encodeURIComponent(ref)}`, '--jq', '.sha',
  ]);
  if (result.status !== 0) failResult(result, `resolve remote App dispatch ref ${ref}`);
  const actual = result.stdout.trim().toLowerCase();
  const expected = session.cohort_plan.cohort_lock.app.resolved_sha.toLowerCase();
  if (actual !== expected) {
    throw new Error(
      `Remote App dispatch ref moved after cohort freeze: expected ${expected}, got ${actual || '<missing>'}. Freeze a new cohort instead of dispatching stale inputs.`,
    );
  }
}

export function promoteDispatchArgs(
  session: StableReleaseSession,
  ownerReceiptRef: string,
  releaseSetGeneration: string,
): string[] {
  if (!session.release_run.id) throw new Error('Stable release session has no source release run id.');
  if (!ownerReceiptRef.trim()) throw new Error('Promotion requires a same-cohort release owner receipt ref.');
  if (!/^\d{2}\.\d{1,2}\.\d{1,2}(?:-r[1-9][0-9]*)?$/.test(releaseSetGeneration)) {
    throw new Error('Promotion requires an exact Release Set generation in YY.M.D[-rN] form.');
  }
  const standardVmRunId = session.qualification_run.id;
  if (!standardVmRunId || session.qualification_run.conclusion !== 'success') {
    throw new Error('Promotion requires a passed Standard exact-artifact qualification run.');
  }
  return [
    'workflow', 'run', 'desktop-release-promote.yml',
    '--repo', session.repo,
    '--ref', workflowRef(session.cohort_plan),
    '--field', `opl_version=${session.version}`,
    '--field', `release_set_generation=${releaseSetGeneration}`,
    '--field', `release_run_id=${session.release_run.id}`,
    '--field', `stable_session_id=${session.id}`,
    '--field', `release_cohort_ref=${session.cohort_plan.operator_plan_ref}`,
    '--field', `standard_vm_run_id=${standardVmRunId}`,
    '--field', `schedule_full_addon=${String(session.cohort_plan.include_full_package)}`,
    '--field', `release_owner_receipt_ref=${ownerReceiptRef}`,
    '--field', `shell_ref=${session.cohort_plan.cohort_lock.shell.resolved_sha}`,
  ];
}

export function promotionRerunArgs(session: StableReleaseSession, failedOnly = true): string[] {
  if (session.phase !== 'promotion_failed') {
    throw new Error(`Promotion rerun requires promotion_failed state, got ${session.phase}.`);
  }
  if (!session.promotion_run.id || !session.promotion_run.attempt) {
    throw new Error('Promotion rerun requires the original promotion run id and attempt.');
  }
  if (!session.release_owner_receipt_ref) {
    throw new Error('Promotion rerun requires the owner receipt accepted by the original promotion run.');
  }
  if (session.metrics.workflow_dispatch_counts.promotion !== 1) {
    throw new Error('Promotion rerun requires exactly one original promotion workflow dispatch.');
  }
  return [
    'run', 'rerun', session.promotion_run.id,
    '--repo', session.repo,
    ...(failedOnly ? ['--failed'] : []),
  ];
}

type WorkflowRun = {
  databaseId: number;
  attempt?: number;
  createdAt: string;
  headBranch: string;
  headSha: string;
  status: string;
  conclusion?: string;
  url: string;
};

type WorkflowJob = {
  name: string;
  status: string;
  conclusion?: string;
  startedAt?: string;
  completedAt?: string;
};

function expectedQualificationProfile(session: StableReleaseSession): 'full' | 'standard' {
  return 'standard';
}

function expectedBuildArtifactName(session: StableReleaseSession): string {
  return 'macos-build-arm64-dmg';
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

function downloadArtifactFile(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
  artifactName: string,
  fileName: string,
): { path: string; cleanup: () => void } | null {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-release-artifact-'));
  const result = runner('gh', ['run', 'download', runId, '--repo', session.repo, '--name', artifactName, '--dir', root]);
  if (result.status !== 0) {
    fs.rmSync(root, { recursive: true, force: true });
    return null;
  }
  const filePath = findFile(root, fileName);
  if (!filePath) {
    fs.rmSync(root, { recursive: true, force: true });
    return null;
  }
  return { path: filePath, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function readBuildArtifactManifest(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
): BuildArtifactCohortV2 | null {
  const artifactName = expectedBuildArtifactName(session);
  const downloaded = downloadArtifactFile(runner, session, runId, `${artifactName}-cohort`, 'opl-build-cohort.json');
  if (!downloaded) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(downloaded.path, 'utf8')) as BuildArtifactCohortV2;
    const errors = validateArtifactCohortV2(manifest, {
      appSha: session.cohort_plan.cohort_lock.app.resolved_sha,
      shellSha: session.cohort_plan.cohort_lock.shell.resolved_sha,
      frameworkSha: session.cohort_plan.cohort_lock.framework.resolved_sha,
      version: session.version,
      actionsRunId: runId,
      stableSessionId: session.id,
      releaseCohortRef: session.cohort_plan.operator_plan_ref,
    });
    return errors.length === 0 ? manifest : null;
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
): { receipt: ArtifactQualificationReceiptV1; sha256: string } | null {
  const profile = expectedQualificationProfile(session);
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
    const receipt = JSON.parse(fs.readFileSync(downloaded.path, 'utf8')) as ArtifactQualificationReceiptV1;
    const errors = validateArtifactQualificationReceipt(receipt, {
      stableSessionId: session.id,
      releaseCohortRef: session.cohort_plan.operator_plan_ref,
      version: session.version,
      packageProfile: profile,
      result: expectedResult,
      qualificationRunId,
      sourceArtifactRunId,
      sourceArtifactName: expectedBuildArtifactName(session),
      appSha: session.cohort_plan.cohort_lock.app.resolved_sha,
      shellSha: session.cohort_plan.cohort_lock.shell.resolved_sha,
      frameworkSha: session.cohort_plan.cohort_lock.framework.resolved_sha,
      verificationAppSha: session.qualification_run.verification_harness?.app_sha,
      verificationShellSha: session.qualification_run.verification_harness?.shell_sha,
      verificationScopeProof: session.qualification_run.verification_harness?.scope_proof,
    });
    return errors.length === 0 ? { receipt, sha256: sha256File(downloaded.path) } : null;
  } finally {
    downloaded.cleanup();
  }
}

function bindQualificationEvidence(
  session: StableReleaseSession,
  manifest: BuildArtifactCohortV2,
  qualificationRunId: string,
  conclusion: 'success' | 'failure',
  evidenceSha256: string | null,
): StableReleaseSession {
  const profile = expectedQualificationProfile(session);
  return {
    ...session,
    qualification_run: {
      ...session.qualification_run,
      id: qualificationRunId,
      url: `https://github.com/${session.repo}/actions/runs/${qualificationRunId}`,
      conclusion,
      artifact_run_id: manifest.actions.run_id,
      artifact_name: manifest.actions.artifact_name,
      artifact_sha256: manifest.artifact.sha256,
      evidence_ref: `opl-first-run-vm-${profile}-${qualificationRunId}`,
      evidence_sha256: evidenceSha256,
    },
  };
}

function listRuns(runner: StableReleaseCommandRunner, workflow: string, repo: string): WorkflowRun[] {
  const result = runner('gh', [
    'run', 'list', '--repo', repo, '--workflow', workflow, '--event', 'workflow_dispatch', '--limit', '30',
    '--json', 'databaseId,attempt,createdAt,headBranch,headSha,status,conclusion,url',
  ]);
  if (result.status !== 0) failResult(result, `list ${workflow} runs`);
  return JSON.parse(result.stdout) as WorkflowRun[];
}

export function selectNewCohortRun(
  runs: WorkflowRun[],
  previousIds: Set<number>,
  expectedHead: string | null,
  expectedBranch: string,
  dispatchedAt: string,
): WorkflowRun | null {
  const earliest = Date.parse(dispatchedAt) - 5_000;
  return runs
    .filter((candidate) => (
      !previousIds.has(candidate.databaseId)
      && candidate.headBranch === expectedBranch
      && (expectedHead === null || candidate.headSha.toLowerCase() === expectedHead.toLowerCase())
      && Date.parse(candidate.createdAt) >= earliest
    ))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function discoverRun(
  runner: StableReleaseCommandRunner,
  workflow: string,
  session: StableReleaseSession,
  previousIds: Set<number>,
  dispatchedAt: string,
  expectedHead: string | null,
  expectedBranch = workflowRef(session.cohort_plan),
): Promise<WorkflowRun> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = selectNewCohortRun(
      listRuns(runner, workflow, session.repo),
      previousIds,
      expectedHead,
      expectedBranch,
      dispatchedAt,
    );
    if (candidate) return candidate;
    await delay(3_000);
  }
  throw new Error(`Unable to discover the exact ${workflow} run within 60 seconds; session was not advanced.`);
}

function watchRun(runner: StableReleaseCommandRunner, session: StableReleaseSession, runId: string): CommandResult {
  return runner('gh', ['run', 'watch', runId, '--repo', session.repo, '--interval', '60', '--exit-status']);
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
): { readback: WorkflowRun | null; error: string | null } {
  const result = runner('gh', [
    'run', 'view', runId, '--repo', session.repo,
    '--json', 'databaseId,attempt,createdAt,headBranch,headSha,status,conclusion,url',
  ]);
  return decodeWorkflowRunReadback(result);
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

async function watchRunToTerminal(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
  runId: string,
): Promise<{ readback: WorkflowRun; succeeded: boolean; conclusion: string }> {
  const retryLimit = session.efficiency_policy.monitor_transport_retry_limit ?? 3;
  let lastReadback: WorkflowRun | null = null;
  let lastReadbackError: string | null = null;
  for (let attempt = 1; attempt <= retryLimit; attempt += 1) {
    const watched = watchRun(runner, session, runId);
    const view = runView(runner, session, runId);
    if (view.readback) {
      const observation = classifyWorkflowRunObservation(watched, view.readback);
      if (observation.terminal && observation.conclusion) {
        return {
          readback: view.readback,
          succeeded: observation.succeeded,
          conclusion: observation.conclusion,
        };
      }
      lastReadback = view.readback;
    }
    lastReadbackError = view.error;
    if (attempt < retryLimit) await delay(session.efficiency_policy.monitor_interval_seconds * 1_000);
  }
  throw new Error(
    `Workflow run ${runId} monitor exited before a terminal remote state after ${retryLimit} attempts; ` +
      `remote status is ${lastReadback?.status ?? 'unknown'}${lastReadbackError ? `; ${lastReadbackError}` : ''}. ` +
      'The release session remains recoverable with resume.',
  );
}

function runJobs(runner: StableReleaseCommandRunner, session: StableReleaseSession, runId: string): WorkflowJob[] {
  const result = runner('gh', ['run', 'view', runId, '--repo', session.repo, '--json', 'jobs', '--jq', '.jobs']);
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
): StableReleaseSession {
  const manifest = readBuildArtifactManifest(runner, session, runId);
  if (succeeded && manifest) {
    const qualification = readQualificationReceipt(runner, session, runId, runId, 'passed');
    if (qualification) {
      session = bindQualificationEvidence(session, manifest, runId, 'success', qualification.sha256);
      return transitionStableReleaseSession(
        session,
        'artifacts_qualified',
        'build and exact-artifact qualification completed; owner approval is required before promotion',
      );
    }
    return transitionStableReleaseSession(session, 'release_train_failed', 'release run succeeded without a valid exact-artifact qualification receipt');
  }
  if (manifest) {
    const qualification = readQualificationReceipt(runner, session, runId, runId, 'failed');
    if (qualification) {
      session = bindQualificationEvidence(session, manifest, runId, 'failure', qualification.sha256);
      return transitionStableReleaseSession(
        session,
        'qualification_failed',
        'the built artifact failed qualification; only a same-artifact qualification retry is allowed',
      );
    }
    return transitionStableReleaseSession(session, 'release_train_failed', 'release train failed outside the exact-artifact qualification gate');
  }
  return transitionStableReleaseSession(session, 'artifact_build_failed', 'release run did not produce a valid exact-byte artifact manifest');
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
    const receipt = readReceipt(downloaded.path);
    const errors = validatePromotionSagaReceipt(receipt, {
      stableSessionId: session.id,
      version: session.version,
    });
    return errors.length === 0 ? { sha256: sha256File(downloaded.path) } : null;
  } finally {
    downloaded.cleanup();
  }
}

function finalizePromotionRun(
  session: StableReleaseSession,
  runId: string,
  succeeded: boolean,
  runner: StableReleaseCommandRunner,
): StableReleaseSession {
  const receipt = succeeded ? readPromotionSagaReceipt(runner, session, runId) : null;
  const jobs = runJobs(runner, session, runId);
  const checkpoints = [
    { phase: 'release_published_not_latest' as const, job: 'Publish release without changing latest', reason: 'release is public and explicitly not latest' },
    { phase: 'distribution_synced' as const, job: 'Dispatch atomic Standard distribution', reason: 'tap atomic Standard distribution receipt verified' },
    { phase: 'homebrew_verified' as const, job: 'Verify Standard Homebrew activation', reason: 'Standard Homebrew clean-VM receipt verified' },
    { phase: 'latest_activated' as const, job: 'Activate App latest after Standard distribution gates', reason: 'GitHub Stable latest activated after Standard downstream verification' },
  ];
  for (const checkpoint of checkpoints) {
    const job = jobs.find((candidate) => candidate.name.includes(checkpoint.job));
    if (job?.conclusion !== 'success') break;
    session = transitionStableReleaseSession(session, checkpoint.phase, checkpoint.reason, job.completedAt || now());
  }
  if (!succeeded || !receipt || session.phase !== 'latest_activated') {
    if (session.phase !== 'promotion_failed') {
      session = transitionStableReleaseSession(
        session,
        'promotion_failed',
        succeeded ? 'promotion run did not expose a valid complete saga receipt' : 'promotion saga stopped after its last verified checkpoint',
      );
    }
    return session;
  }
  session.receipts = { ...session.receipts, promotion_saga: { ref: promotionSagaArtifactName(session), sha256: receipt.sha256 } };
  return transitionStableReleaseSession(session, 'awaiting_local_activation', 'same-version local installation and CDP readback receipt remain required');
}

async function dispatchAndWatchRelease(
  session: StableReleaseSession,
  statePath: string,
  watch: boolean,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  if (session.release_run.id) throw new Error('This frozen cohort already has a desktop release run; refusing a second dispatch.');
  if (session.metrics.artifact_build_count >= 1) throw new Error('This frozen cohort already consumed its one artifact build.');
  verifyRemoteDispatchHead(runner, session);
  const previousIds = new Set(listRuns(runner, 'desktop-release.yml', session.repo).map((candidate) => candidate.databaseId));
  const dispatchedAt = now();
  const dispatch = runner('gh', desktopReleaseDispatchArgs(session));
  if (dispatch.status !== 0) failResult(dispatch, 'dispatch desktop release');
  const releaseRun = await discoverRun(
    runner,
    'desktop-release.yml',
    session,
    previousIds,
    dispatchedAt,
    session.cohort_plan.cohort_lock.app.resolved_sha,
  );
  session.metrics = {
    ...session.metrics,
    artifact_build_count: session.metrics.artifact_build_count + 1,
    workflow_dispatch_counts: {
      ...session.metrics.workflow_dispatch_counts,
      desktop_release: session.metrics.workflow_dispatch_counts.desktop_release + 1,
    },
  };
  session = transitionStableReleaseSession(session, 'artifact_build_running', `desktop release run ${releaseRun.databaseId} dispatched`);
  session.release_run = { id: String(releaseRun.databaseId), url: releaseRun.url, conclusion: null };
  writeSession(statePath, session);
  if (!watch) return session;

  const observation = await watchRunToTerminal(runner, session, String(releaseRun.databaseId));
  const { readback } = observation;
  session.release_run = {
    id: String(readback.databaseId),
    url: readback.url,
    conclusion: observation.conclusion,
  };
  session = finalizeReleaseRun(session, String(readback.databaseId), observation.succeeded, runner);
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
  const previousIds = new Set(listRuns(runner, 'desktop-release-promote.yml', session.repo).map((candidate) => candidate.databaseId));
  const dispatchedAt = now();
  const dispatch = runner('gh', promoteDispatchArgs(session, ownerReceiptRef, releaseSetGeneration));
  if (dispatch.status !== 0) failResult(dispatch, 'dispatch stable promotion');
  const promotionRun = await discoverRun(
    runner,
    'desktop-release-promote.yml',
    session,
    previousIds,
    dispatchedAt,
    null,
  );
  session.metrics = {
    ...session.metrics,
    workflow_dispatch_counts: {
      ...session.metrics.workflow_dispatch_counts,
      promotion: session.metrics.workflow_dispatch_counts.promotion + 1,
    },
  };
  session = transitionStableReleaseSession(session, 'promotion_running', `promotion run ${promotionRun.databaseId} dispatched`);
  session.promotion_run = {
    id: String(promotionRun.databaseId),
    url: promotionRun.url,
    conclusion: null,
    attempt: promotionRun.attempt ?? 1,
    rerun_requested_from_attempt: null,
  };
  session.release_owner_receipt_ref = ownerReceiptRef;
  writeSession(statePath, session);
  if (!watch) return session;

  const observation = await watchRunToTerminal(runner, session, String(promotionRun.databaseId));
  const { readback } = observation;
  session.promotion_run = {
    id: String(readback.databaseId),
    url: readback.url,
    conclusion: observation.conclusion,
    attempt: readback.attempt ?? session.promotion_run.attempt ?? 1,
    rerun_requested_from_attempt: session.promotion_run.rerun_requested_from_attempt,
  };
  session = finalizePromotionRun(session, String(readback.databaseId), observation.succeeded, runner);
  writeSession(statePath, session);
  return session;
}

async function dispatchAndWatchQualificationRetry(
  session: StableReleaseSession,
  options: RetryQualificationOptions,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  const verificationAppRef = options.smokeHarnessAppRef || workflowRef(session.cohort_plan);
  if (/^[0-9a-f]{7,40}$/i.test(verificationAppRef)) {
    throw new Error('Qualification retry App harness ref must be a remote branch or tag accepted by workflow_dispatch.');
  }
  const verificationShellRef = options.smokeHarnessShellRef || session.cohort_plan.cohort_lock.shell.resolved_sha;
  const verificationAppSha = resolveRemoteGitRefSha(runner, session.repo, verificationAppRef);
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
    }),
  };
  const previousIds = new Set(listRuns(runner, 'opl-first-run-vm.yml', session.repo).map((candidate) => candidate.databaseId));
  const dispatchedAt = now();
  const dispatch = runner('gh', qualificationRetryDispatchArgs(session, verificationHarness));
  if (dispatch.status !== 0) failResult(dispatch, 'dispatch same-artifact qualification retry');
  const run = await discoverRun(
    runner,
    'opl-first-run-vm.yml',
    session,
    previousIds,
    dispatchedAt,
    verificationHarness.app_sha,
    verificationHarness.app_ref,
  );
  session = transitionStableReleaseSession(
    session,
    'retry_failed_gate_same_artifact',
    `qualification run ${run.databaseId} reuses artifact ${session.qualification_run.artifact_name} from release run ${session.release_run.id}`,
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
  session.qualification_run = {
    ...session.qualification_run,
    id: String(run.databaseId),
    url: run.url,
    conclusion: null,
    artifact_run_id: session.release_run.id,
    verification_harness: verificationHarness,
  };
  writeSession(options.statePath, session);
  if (!options.watch) return session;
  const observation = await watchRunToTerminal(runner, session, String(run.databaseId));
  const { readback } = observation;
  const retryRunId = String(readback.databaseId);
  const sourceRunId = session.release_run.id!;
  const manifest = readBuildArtifactManifest(runner, session, sourceRunId);
  const expectedResult = observation.succeeded ? 'passed' : 'failed';
  const qualification = readQualificationReceipt(runner, session, retryRunId, sourceRunId, expectedResult);
  if (!manifest || !qualification) {
    session = transitionStableReleaseSession(session, 'qualification_failed', 'qualification retry did not produce a valid same-artifact receipt');
  } else {
    session = bindQualificationEvidence(
      session,
      manifest,
      retryRunId,
      observation.succeeded ? 'success' : 'failure',
      qualification.sha256,
    );
    session.metrics = { ...session.metrics, reused_artifact_sha256: manifest.artifact.sha256 };
    session = transitionStableReleaseSession(
      session,
      observation.succeeded ? 'artifacts_qualified' : 'qualification_failed',
      observation.succeeded ? 'same exact artifact passed clean-VM qualification' : 'same exact artifact qualification retry failed',
    );
  }
  writeSession(options.statePath, session);
  return session;
}

async function resumeSession(
  options: ResumeOptions,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  let session = readSession(options.statePath);
  if (session.phase === 'artifact_build_failed') {
    if (!session.release_run.id) throw new Error('Artifact build failure has no original workflow run id.');
    session = transitionStableReleaseSession(
      session,
      'artifact_build_running',
      `reconciling original release run ${session.release_run.id} after a nonterminal monitor exit`,
    );
    session.release_run = { ...session.release_run, conclusion: null };
    writeSession(options.statePath, session);
  }
  if (session.phase === 'promotion_failed') {
    const runId = session.promotion_run.id;
    if (!runId) throw new Error('Promotion failure has no original workflow run id.');
    const remoteView = runView(runner, session, runId);
    if (!remoteView.readback) {
      throw new Error(
        `Unable to reconcile promotion workflow ${runId}: ${remoteView.error ?? 'remote readback unavailable'}. ` +
          'The existing promotion session remains recoverable with resume.',
      );
    }
    const remote = remoteView.readback;
    const localAttempt = session.promotion_run.attempt ?? 0;
    const remoteAttempt = remote.attempt ?? localAttempt;
    const rerunAlreadyStarted = remoteAttempt > localAttempt || remote.status === 'queued' || remote.status === 'in_progress';
    if (!rerunAlreadyStarted) {
      if (!options.execute) {
        throw new Error('Promotion retry mutates the existing workflow run; pass --execute to rerun its failed jobs.');
      }
      const rerun = runner('gh', promotionRerunArgs(session, remote.conclusion !== 'success'));
      if (rerun.status !== 0) failResult(rerun, `rerun promotion workflow ${runId}`);
      session.metrics = {
        ...session.metrics,
        promotion_retry_count: session.metrics.promotion_retry_count + 1,
      };
      session.promotion_run = {
        ...session.promotion_run,
        conclusion: null,
        rerun_requested_from_attempt: localAttempt,
      };
    } else {
      session.promotion_run = {
        ...session.promotion_run,
        conclusion: null,
        attempt: remoteAttempt || session.promotion_run.attempt,
      };
    }
    session = transitionStableReleaseSession(
      session,
      'promotion_running',
      rerunAlreadyStarted
        ? `resuming already-started attempt ${remoteAttempt} of promotion run ${runId}`
        : `rerunning failed jobs in promotion run ${runId}; no new workflow dispatch`,
    );
    writeSession(options.statePath, session);
  }
  const isRelease = session.phase === 'artifact_build_running';
  const isQualification = session.phase === 'retry_failed_gate_same_artifact';
  const isPromotion = session.phase === 'promotion_running';
  if (!isRelease && !isQualification && !isPromotion) {
    throw new Error(`Resume requires artifact_build_running, retry_failed_gate_same_artifact, or promotion_running state, got ${session.phase}.`);
  }
  const runId = isRelease ? session.release_run.id : isQualification ? session.qualification_run.id : session.promotion_run.id;
  if (!runId) throw new Error(`Session phase ${session.phase} has no workflow run id.`);
  const observation = await watchRunToTerminal(runner, session, runId);
  const { readback } = observation;
  if (isRelease) {
    session.release_run = {
      id: String(readback.databaseId),
      url: readback.url,
      conclusion: observation.conclusion,
    };
    session = finalizeReleaseRun(session, String(readback.databaseId), observation.succeeded, runner);
  } else if (isQualification) {
    const sourceRunId = session.release_run.id!;
    const retryRunId = String(readback.databaseId);
    const manifest = readBuildArtifactManifest(runner, session, sourceRunId);
    const qualification = readQualificationReceipt(
      runner,
      session,
      retryRunId,
      sourceRunId,
      observation.succeeded ? 'passed' : 'failed',
    );
    if (!manifest || !qualification) {
      session = transitionStableReleaseSession(session, 'qualification_failed', 'resumed qualification did not produce a valid same-artifact receipt');
    } else {
      session = bindQualificationEvidence(session, manifest, retryRunId, observation.succeeded ? 'success' : 'failure', qualification.sha256);
      session.metrics = { ...session.metrics, reused_artifact_sha256: manifest.artifact.sha256 };
      session = transitionStableReleaseSession(
        session,
        observation.succeeded ? 'artifacts_qualified' : 'qualification_failed',
        observation.succeeded ? 'resumed same-artifact qualification passed' : 'resumed same-artifact qualification failed',
      );
    }
  } else {
    session.promotion_run = {
      id: String(readback.databaseId),
      url: readback.url,
      conclusion: observation.conclusion,
      attempt: readback.attempt ?? session.promotion_run.attempt ?? 1,
      rerun_requested_from_attempt: session.promotion_run.rerun_requested_from_attempt,
    };
    session = finalizePromotionRun(session, String(readback.databaseId), observation.succeeded, runner);
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
      'smoke-harness-app-ref': { type: 'string' },
      'smoke-harness-shell-ref': { type: 'string' },
    },
  });
  if (!values.state) throw new Error('Pass --state from the original release run.');
  return {
    execute: values.execute === true,
    watch: values['no-watch'] !== true,
    statePath: path.resolve(values.state),
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

function printSession(session: StableReleaseSession): void {
  process.stdout.write(`${JSON.stringify(session, null, 2)}\n`);
}

async function start(options: StartOptions, runner: StableReleaseCommandRunner): Promise<StableReleaseSession> {
  let session = buildStableReleaseSession(buildReleaseCohortPlan(options.cohort), options.repo);
  writeSession(options.statePath, session);
  if (!options.execute) return session;

  for (let index = 0; index < session.source_gates.length; index += 1) {
    const gate = session.source_gates[index];
    const result = runner('bash', ['-lc', gate.command]);
    session.source_gates[index] = { ...gate, status: result.status === 0 ? 'passed' : 'failed' };
    writeSession(options.statePath, session);
    if (result.status !== 0) {
      session = transitionStableReleaseSession(session, 'source_gate_failed', `source gate ${gate.id} failed`);
      writeSession(options.statePath, session);
      failResult(result, `source gate ${gate.id}`);
    }
  }
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'all deduplicated cheap source gates passed');
  writeSession(options.statePath, session);
  return dispatchAndWatchRelease(session, options.statePath, options.watch, runner);
}

async function promote(options: PromoteOptions, runner: StableReleaseCommandRunner): Promise<StableReleaseSession> {
  let session = readSession(options.statePath);
  if (session.phase !== 'artifacts_qualified') {
    throw new Error(`Initial promotion requires artifacts_qualified state, got ${session.phase}. Use resume --execute for a failed promotion run.`);
  }
  if (!options.execute) return session;
  session = transitionStableReleaseSession(session, 'owner_approved', 'same-cohort release owner receipt accepted');
  writeSession(options.statePath, session);
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
  return dispatchAndWatchQualificationRetry(session, options, runner);
}

function completeLocalActivation(options: CompleteLocalOptions): StableReleaseSession {
  let session = readSession(options.statePath);
  if (session.phase !== 'awaiting_local_activation') {
    throw new Error(`Local activation completion requires awaiting_local_activation state, got ${session.phase}.`);
  }
  const receipt = readReceipt(options.receiptPath);
  const errors = validateLocalActivationReceipt(receipt, {
    stableSessionId: session.id,
    version: session.version,
    artifactSha256: session.qualification_run.artifact_sha256 ?? undefined,
    localAuthorizationPolicyPath: options.localAuthorizationPolicyPath,
  });
  if (errors.length > 0) throw new Error(`Local activation receipt invalid: ${errors.join('; ')}`);
  session.receipts = {
    ...session.receipts,
    local_activation: { ref: options.receiptPath, sha256: sha256File(options.receiptPath) },
  };
  session = transitionStableReleaseSession(session, 'complete', 'same-version local installation and CDP Home/Settings/Capabilities readback passed');
  writeSession(options.statePath, session);
  return session;
}

async function main(): Promise<void> {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`Usage:\n  npm run release:stable -- start <cohort options> [--state <path>] [--execute] [--no-watch]\n  npm run release:stable -- retry-qualification --state <path> [--smoke-harness-app-ref <branch-or-tag>] [--smoke-harness-shell-ref <ref>] [--execute] [--no-watch]\n  npm run release:stable -- resume --state <path> [--execute]\n  npm run release:stable -- promote --state <path> --release-set-generation <YY.M.D[-rN]> --release-owner-receipt-ref <ref> [--execute] [--no-watch]\n  npm run release:stable -- complete-local --state <path> --receipt <local-activation-receipt.json> --local-authorization-policy <policy.json>\n\nDry-run is the default. External workflow dispatch or rerun requires --execute.\n`);
    return;
  }
  if (command === 'start' || command === 'plan') {
    const options = parseStartArgs(argv);
    printSession(await start({ ...options, execute: command === 'plan' ? false : options.execute }, run));
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
  if (command === 'resume') {
    printSession(await resumeSession(parseResumeArgs(argv), run));
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
