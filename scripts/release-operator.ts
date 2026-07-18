#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { writeLinesFile } from './release-file-helpers.ts';
import {
  arrayOrEmpty as asArray,
  readJsonFile as readJson,
  recordOrNull as asRecord,
  stringField,
} from './release-json-helpers.ts';
import {
  buildReleaseCohortPlan,
  parseReleaseCohortPlanArgs,
  type ReleaseCohortPlan,
  type ReleaseCohortPlanOptions,
} from './plan-release-cohort.ts';
import {
  readStableReleaseSession,
  type StableReleaseSession,
} from './stable-release-session.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultRepo = 'gaofeng21cn/one-person-lab-app';
const commandMaxBuffer = 16 * 1024 * 1024;
const defaultGitHubReadTimeoutMs = 30_000;

type JsonRecord = Record<string, unknown>;

type DiagnosticAction = {
  id: 'reconcile_stable_session' | 'retry_qualification_same_artifact';
  action: 'reconcile_stable_session' | 'retry_qualification_same_artifact';
  controller: 'release:stable';
  controller_subcommand: 'reconcile' | 'retry-qualification';
  publishes_release: false;
  mutation_authorized: false;
  direct_workflow_dispatch_allowed: false;
  execute_flag_included: false;
  command: string;
  evidence: {
    release_artifact_run_id: string;
    release_artifact_name: string;
    package_profile: string;
    diagnostic_scope: string;
  };
};

type OperatorNextAction = {
  action:
    | 'follow_cohort_plan'
    | 'retry_qualification_same_artifact'
    | 'reconcile_stable_session'
    | 'repair_source_gate'
    | 'repair_webui_runtime_image'
    | 'repair_ghcr_publish_access'
    | 'inspect_primary_blocker'
    | 'inspect_current_step_progress'
    | 'reconcile_after_hard_stop'
    | 'wait_for_release_run_completion';
  command: string;
  reason: string;
  publishes_release?: false;
  dispatches_workflow?: false;
};

type OperatorGuidance = {
  currentness_freeze: {
    required_before_broker_submission: true;
    controller_input_source: 'release_cohort_plan_or_lock';
    direct_workflow_dispatch_allowed: false;
    post_freeze_drift_name: 'post-freeze drift';
    single_desktop_release_per_frozen_cohort: true;
    rule: string;
  };
  post_owner_receipt_fast_path: {
    default_action: 'verify_owner_candidate_record_then_use_stable_controller';
    verify_command: string;
    controller_command: string;
    direct_workflow_dispatch_allowed: false;
    desktop_release_rebuild_required: false;
    rule: string;
  };
};

type OperatorStatus =
  | 'planned'
  | 'diagnostic_action_ready'
  | 'failed'
  | 'failed_gate_draining'
  | 'stale_candidate'
  | 'superseded'
  | 'cancelled'
  | 'hard_stop_exceeded'
  | 'ready_for_closeout_review'
  | 'waiting_for_run_completion';

type OperatorPhase =
  | 'release_plan_ready'
  | 'release_diagnostic_action_ready'
  | 'release_run_failed'
  | 'release_run_failed_draining'
  | 'release_run_stale_candidate'
  | 'release_run_superseded'
  | 'release_run_cancelled'
  | 'release_run_hard_stop_exceeded'
  | 'release_run_waiting'
  | 'release_closeout_review_ready';

type RunStatusSummary = {
  id: string;
  attempt: number;
  workflow_name: string | null;
  display_title: string | null;
  status: string | null;
  conclusion: string | null;
  created_at: string | null;
  started_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  head_sha: string | null;
  head_branch: string | null;
  event: string | null;
  url: string | null;
  jobs: Array<{
    name: string;
    status: string | null;
    conclusion: string | null;
    started_at: string | null;
    completed_at: string | null;
    steps: Array<{
      name: string;
      status: string | null;
      conclusion: string | null;
      started_at: string | null;
      completed_at: string | null;
    }>;
  }>;
};

type PrimaryBlocker = {
  type: 'run' | 'job' | 'step' | 'stale_candidate';
  conclusion: string;
  job_name?: string;
  step_name?: string;
  run_id?: string;
  head_sha?: string | null;
  expected_head?: string;
  reason: string;
} | null;

type CurrentStep = {
  job_name: string | null;
  step_name: string | null;
  status: string | null;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  waiting: boolean;
  reason: string;
};

type OperatorElapsed = {
  started_at: string | null;
  ended_at: string | null;
  seconds: number | null;
};

type OperatorBudget = {
  status: 'unknown' | 'within_budget' | 'attention';
  elapsed_seconds: number | null;
  current_step_elapsed_seconds: number | null;
  run_updated_age_seconds: number | null;
  threshold_seconds: number | null;
  run_sla_profile: string | null;
  run_attention_seconds: number | null;
  run_hard_stop_seconds: number | null;
  run_sla_status: 'unknown' | 'within_sla' | 'attention' | 'exceeded';
  run_sla_reason: string;
  standard_admission_deadline_at: string;
  standard_admission_status: 'within_budget' | 'exceeded';
  reason: string;
};

type ReleaseSessionManifest = {
  schema: 'opl_app_release_operator_observation.v2';
  id: string;
  generated_at: string;
  version: string;
  stable_session: {
    id: string;
    revision: number;
    state_path: string;
    cohort_ref: string;
  };
  expected_head: string;
  run_set: {
    current_run_id: string;
    runs: Array<{
      id: string;
      attempt: number;
      controller_attempt_id: string;
      workflow_name: string | null;
      status: string | null;
      conclusion: string | null;
      head_sha: string | null;
      url: string | null;
      elapsed_seconds: number | null;
    }>;
  };
  current_authority_run: {
    id: string;
    status: string | null;
    conclusion: string | null;
    head_sha: string | null;
    ref?: string;
  };
  failed_run_tax: {
    action: OperatorNextAction['action'];
    primary_blocker: PrimaryBlocker;
    elapsed_seconds: number | null;
  };
  typed_next_action: OperatorNextAction;
  owner_receipt: {
    state: 'not_provided' | 'not_required_for_current_state' | 'provided';
    verify_command: string;
    ref?: string;
  };
  release_truth_refs?: {
    candidate_record?: string;
    closeout?: string;
    readback?: string;
  };
  post_publish_follow_up: {
    state:
      | 'not_applicable_until_release_published'
      | 'pending'
      | 'completed'
      | 'blocked';
    summary: string;
    ref?: string;
  };
  truth_boundary: string;
};

type OperatorState = {
  schema: 'opl_app_release_operator_state.v1';
  generated_at: string;
  command: 'plan' | 'diagnose-vm' | 'status';
  status: OperatorStatus;
  phase: OperatorPhase;
  cohort_plan?: ReleaseCohortPlan;
  diagnostic_actions?: DiagnosticAction[];
  run?: RunStatusSummary;
  current_step?: CurrentStep;
  elapsed?: OperatorElapsed;
  budget?: OperatorBudget;
  expected_head?: string;
  is_stale?: boolean;
  primary_blocker?: PrimaryBlocker;
  recommended_next_action?: OperatorNextAction;
  next_action: OperatorNextAction;
  session?: ReleaseSessionManifest;
  stable_session?: {
    id: string;
    revision: number;
    phase: StableReleaseSession['phase'];
    cohort_ref: string;
    state_path: string;
    controller_attempt_id: string;
  };
  operator_guidance?: OperatorGuidance;
  authority_boundary: {
    operator_can_publish_release: false;
    operator_can_write_runtime_truth: false;
    operator_can_dispatch_workflow_without_explicit_user_action: false;
    operator_can_authorize_mutation: false;
  };
};

type OperatorOutputOptions = {
  output: string;
  markdown: string;
  sessionOutput?: string;
};

type DiagnoseVmOptions = OperatorOutputOptions & {
  version: string;
  releaseMode: string;
  releaseArtifactRunId: string;
  releaseArtifactName: string;
  packageProfile: string;
  diagnosticScope: string;
  buildStandardArtifact: boolean;
  runVmDiagnostic: boolean;
  stableStatePath: string;
};

type StatusOptions = OperatorOutputOptions & {
  runId: string;
  repo: string;
  version: string;
  expectedHead: string;
  runJsonPath: string;
  sessionInput: string;
  ownerReceiptRef: string;
  candidateRef: string;
  closeoutRef: string;
  readbackRef: string;
  currentAuthorityRef: string;
  postPublishFollowUpRef: string;
  postPublishFollowUpState: ReleaseSessionManifest['post_publish_follow_up']['state'] | '';
  stableStatePath: string;
  stdoutFormat: 'json' | 'summary';
};

function usage(): void {
  process.stdout.write(`Usage:
  npm run release:operator -- plan --version <version> --release-mode <mode>
  npm run release:operator -- diagnose-vm --version <version> --release-artifact-run-id <run-id> --state <release-session.json>
  npm run release:operator -- status --run-id <id> --version <version> [--repo owner/name] [--expected-head <sha>]
  npm run release:operator -- status --run-json <path> [--expected-head <sha>]

Subcommands:
  plan          Generate release-operator-state.json/md with an embedded cohort plan.
  diagnose-vm  Describe typed Stable-controller qualification actions; never authorizes or dispatches a workflow.
  status       Summarize a GitHub Actions run and recommend the next operator action.

Common options:
  --output <path>      Write release-operator-state.json.
  --markdown <path>    Write release-operator-state.md.
  --session-output <path>
                       Write the non-authoritative operator observation manifest. Never pass it to release:stable.
  --session-input <path>
                       Read an existing operator observation manifest before updating it.
  --owner-receipt-ref <ref>
                       Record an owner receipt reference in the session manifest.
  --candidate-ref <ref>
                       Record a candidate-record reference in the session manifest.
  --closeout-ref <ref>
                       Record a closeout reference in the session manifest.
  --readback-ref <ref>
                       Record a readback/currentness reference in the session manifest.
  --current-authority-ref <ref>
                       Record the current authority reference for this run.
  --post-publish-follow-up-ref <ref>
                       Record a post-publish follow-up reference.
  --post-publish-follow-up-state <state>
                       Record post-publish follow-up state: pending, completed, or blocked.
  --stable-state <path>
                       Exact original Stable controller session consumed by status recommendations.
  --json               Print JSON to stdout.
  --summary            Print a one-screen human summary to stdout.
`);
}

function parseBoolean(value: string): boolean {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new Error(`Boolean value must be true or false, got ${value}`);
}

function defaultOutputOptions(): OperatorOutputOptions {
  return {
    output: process.env.OPL_RELEASE_OPERATOR_STATE || '',
    markdown: process.env.OPL_RELEASE_OPERATOR_MARKDOWN || '',
    sessionOutput: process.env.OPL_RELEASE_SESSION_MANIFEST || '',
  };
}

function resolveOutputOptions(options: OperatorOutputOptions): OperatorOutputOptions {
  return {
    output: options.output ? path.resolve(options.output) : '',
    markdown: options.markdown ? path.resolve(options.markdown) : '',
    sessionOutput: options.sessionOutput ? path.resolve(options.sessionOutput) : '',
  };
}

function assertOutputPathSafety(
  options: OperatorOutputOptions,
  protectedPaths: Array<{ label: string; value: string }> = [],
): void {
  const writes = [
    { label: '--output', value: options.output },
    { label: '--markdown', value: options.markdown },
    { label: '--session-output', value: options.sessionOutput ?? '' },
  ].filter((entry) => entry.value);
  for (let index = 0; index < writes.length; index += 1) {
    for (let other = index + 1; other < writes.length; other += 1) {
      if (writes[index].value === writes[other].value) {
        throw new Error(`${writes[index].label} and ${writes[other].label} must resolve to different files.`);
      }
    }
    for (const protectedPath of protectedPaths.filter((entry) => entry.value)) {
      if (writes[index].value === protectedPath.value) {
        throw new Error(`${writes[index].label} must not overwrite ${protectedPath.label}.`);
      }
    }
  }
}

function parsePlanArgs(argv: string[]): { cohort: ReleaseCohortPlanOptions; operator: OperatorOutputOptions } {
  const output = defaultOutputOptions();
  const cohortArgs: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--output' || token === '--markdown') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
      if (token === '--output') output.output = value;
      else output.markdown = value;
      index += 1;
      continue;
    }
    cohortArgs.push(token);
  }
  const operator = resolveOutputOptions(output);
  assertOutputPathSafety(operator);
  return {
    cohort: parseReleaseCohortPlanArgs(cohortArgs),
    operator,
  };
}

function parseDiagnoseVmArgs(argv: string[]): DiagnoseVmOptions {
  const parsed: DiagnoseVmOptions = {
    ...defaultOutputOptions(),
    version: process.env.OPL_RELEASE_VERSION || '',
    releaseMode: process.env.OPL_RELEASE_MODE || 'refresh_existing',
    releaseArtifactRunId: process.env.OPL_RELEASE_ARTIFACT_RUN_ID || '',
    releaseArtifactName: process.env.OPL_RELEASE_ARTIFACT_NAME || 'macos-build-arm64-dmg',
    packageProfile: process.env.OPL_RELEASE_PACKAGE_PROFILE || 'standard',
    diagnosticScope: process.env.OPL_RELEASE_DIAGNOSTIC_SCOPE || 'existing_artifact',
    buildStandardArtifact: false,
    runVmDiagnostic: true,
    stableStatePath: process.env.OPL_STABLE_RELEASE_SESSION_STATE || '',
  };
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'string' },
      'release-mode': { type: 'string' },
      'release-artifact-run-id': { type: 'string' },
      'release-artifact-name': { type: 'string' },
      'package-profile': { type: 'string' },
      'diagnostic-scope': { type: 'string' },
      'build-standard-artifact': { type: 'string' },
      'run-vm-diagnostic': { type: 'string' },
      state: { type: 'string' },
      output: { type: 'string' },
      markdown: { type: 'string' },
    },
  });
  if (values.help) {
    usage();
    process.exit(0);
  }
  if (typeof values.version === 'string') parsed.version = values.version;
  if (typeof values['release-mode'] === 'string') parsed.releaseMode = values['release-mode'];
  if (typeof values['release-artifact-run-id'] === 'string') parsed.releaseArtifactRunId = values['release-artifact-run-id'];
  if (typeof values['release-artifact-name'] === 'string') parsed.releaseArtifactName = values['release-artifact-name'];
  if (typeof values['package-profile'] === 'string') parsed.packageProfile = values['package-profile'];
  if (typeof values['diagnostic-scope'] === 'string') parsed.diagnosticScope = values['diagnostic-scope'];
  if (typeof values['build-standard-artifact'] === 'string') {
    parsed.buildStandardArtifact = parseBoolean(values['build-standard-artifact']);
  }
  if (typeof values['run-vm-diagnostic'] === 'string') {
    parsed.runVmDiagnostic = parseBoolean(values['run-vm-diagnostic']);
  }
  if (typeof values.state === 'string') parsed.stableStatePath = values.state;
  if (typeof values.output === 'string') parsed.output = values.output;
  if (typeof values.markdown === 'string') parsed.markdown = values.markdown;
  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.releaseArtifactRunId.trim()) {
    throw new Error('Pass --release-artifact-run-id <run-id> or set OPL_RELEASE_ARTIFACT_RUN_ID.');
  }
  if (!parsed.stableStatePath.trim()) {
    throw new Error('Pass --state <original-stable-release-session.json> or set OPL_STABLE_RELEASE_SESSION_STATE.');
  }
  const resolved = {
    ...parsed,
    stableStatePath: path.resolve(parsed.stableStatePath),
    ...resolveOutputOptions(parsed),
  };
  assertOutputPathSafety(resolved, [{ label: '--state', value: resolved.stableStatePath }]);
  return resolved;
}

function parseStatusArgs(argv: string[]): StatusOptions {
  const parsed: StatusOptions = {
    ...defaultOutputOptions(),
    runId: process.env.OPL_RELEASE_RUN_ID || '',
    repo: process.env.OPL_RELEASE_REPO || defaultRepo,
    version: process.env.OPL_RELEASE_VERSION || '',
    expectedHead: process.env.OPL_RELEASE_EXPECTED_HEAD || '',
    runJsonPath: process.env.OPL_RELEASE_RUN_JSON || '',
    sessionInput: '',
    ownerReceiptRef: '',
    candidateRef: '',
    closeoutRef: '',
    readbackRef: '',
    currentAuthorityRef: '',
    postPublishFollowUpRef: '',
    postPublishFollowUpState: '',
    stableStatePath: process.env.OPL_STABLE_RELEASE_SESSION_STATE || '',
    stdoutFormat: 'json',
  };
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      json: { type: 'boolean' },
      summary: { type: 'boolean' },
      'run-id': { type: 'string' },
      repo: { type: 'string' },
      version: { type: 'string' },
      'expected-head': { type: 'string' },
      'run-json': { type: 'string' },
      output: { type: 'string' },
      markdown: { type: 'string' },
      'session-output': { type: 'string' },
      'session-input': { type: 'string' },
      'owner-receipt-ref': { type: 'string' },
      'candidate-ref': { type: 'string' },
      'closeout-ref': { type: 'string' },
      'readback-ref': { type: 'string' },
      'current-authority-ref': { type: 'string' },
      'post-publish-follow-up-ref': { type: 'string' },
      'post-publish-follow-up-state': { type: 'string' },
      'stable-state': { type: 'string' },
    },
  });
  if (values.help) {
    usage();
    process.exit(0);
  }
  if (values.json) parsed.stdoutFormat = 'json';
  if (values.summary) parsed.stdoutFormat = 'summary';
  if (typeof values['run-id'] === 'string') parsed.runId = values['run-id'];
  if (typeof values.repo === 'string') parsed.repo = values.repo;
  if (typeof values.version === 'string') parsed.version = values.version;
  if (typeof values['expected-head'] === 'string') parsed.expectedHead = values['expected-head'];
  if (typeof values['run-json'] === 'string') parsed.runJsonPath = values['run-json'];
  if (typeof values.output === 'string') parsed.output = values.output;
  if (typeof values.markdown === 'string') parsed.markdown = values.markdown;
  if (typeof values['session-output'] === 'string') parsed.sessionOutput = values['session-output'];
  if (typeof values['session-input'] === 'string') parsed.sessionInput = values['session-input'];
  if (typeof values['owner-receipt-ref'] === 'string') parsed.ownerReceiptRef = values['owner-receipt-ref'];
  if (typeof values['candidate-ref'] === 'string') parsed.candidateRef = values['candidate-ref'];
  if (typeof values['closeout-ref'] === 'string') parsed.closeoutRef = values['closeout-ref'];
  if (typeof values['readback-ref'] === 'string') parsed.readbackRef = values['readback-ref'];
  if (typeof values['current-authority-ref'] === 'string') parsed.currentAuthorityRef = values['current-authority-ref'];
  if (typeof values['post-publish-follow-up-ref'] === 'string') parsed.postPublishFollowUpRef = values['post-publish-follow-up-ref'];
  if (typeof values['post-publish-follow-up-state'] === 'string') {
    const state = values['post-publish-follow-up-state'];
    if (!['pending', 'completed', 'blocked', 'not_applicable_until_release_published'].includes(state)) {
      throw new Error(`Invalid --post-publish-follow-up-state: ${state}`);
    }
    parsed.postPublishFollowUpState = state as StatusOptions['postPublishFollowUpState'];
  }
  if (typeof values['stable-state'] === 'string') parsed.stableStatePath = values['stable-state'];
  if (!parsed.runId.trim() && !parsed.runJsonPath.trim()) {
    throw new Error('Pass --run-id <id> or --run-json <path>.');
  }
  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!/^[0-9a-f]{40}$/i.test(parsed.expectedHead.trim())) {
    throw new Error('Pass --expected-head <40-character-sha> or set OPL_RELEASE_EXPECTED_HEAD.');
  }
  if (!parsed.stableStatePath.trim()) {
    throw new Error('Pass --stable-state <original-stable-release-session.json> or set OPL_STABLE_RELEASE_SESSION_STATE.');
  }
  if (parsed.runId && !/^[1-9][0-9]*$/.test(parsed.runId)) {
    throw new Error('--run-id must be an exact positive numeric GitHub run id.');
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(parsed.repo)) {
    throw new Error('--repo must be an exact owner/name GitHub repository.');
  }
  const resolved = {
    ...parsed,
    expectedHead: parsed.expectedHead.toLowerCase(),
    runJsonPath: parsed.runJsonPath ? path.resolve(parsed.runJsonPath) : '',
    sessionInput: parsed.sessionInput ? path.resolve(parsed.sessionInput) : '',
    stableStatePath: path.resolve(parsed.stableStatePath),
    ...resolveOutputOptions(parsed),
  };
  assertOutputPathSafety(resolved, [
    { label: '--run-json', value: resolved.runJsonPath },
    { label: '--stable-state', value: resolved.stableStatePath },
    { label: '--session-input', value: resolved.sessionInput === resolved.sessionOutput ? '' : resolved.sessionInput },
  ]);
  return resolved;
}

function quoteField(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function stableControllerCommand(
  subcommand: 'reconcile' | 'retry-qualification' | 'promote',
  statePath: string,
  extraArgs: string[] = [],
): string {
  return [
    'npm run release:stable --',
    subcommand,
    `--state ${quoteField(statePath || '<original-stable-release-session.json>')}`,
    ...extraArgs,
  ].join(' ');
}

function buildDiagnosticActions(options: DiagnoseVmOptions): DiagnosticAction[] {
  const artifactKind = options.packageProfile === 'full' ? 'full' : 'standard';
  const evidence = {
    release_artifact_run_id: options.releaseArtifactRunId,
    release_artifact_name: options.releaseArtifactName,
    package_profile: options.packageProfile,
    diagnostic_scope: options.diagnosticScope,
  };
  return [
    {
      id: 'reconcile_stable_session',
      action: 'reconcile_stable_session',
      controller: 'release:stable',
      controller_subcommand: 'reconcile',
      publishes_release: false,
      mutation_authorized: false,
      direct_workflow_dispatch_allowed: false,
      execute_flag_included: false,
      command: stableControllerCommand('reconcile', options.stableStatePath),
      evidence,
    },
    {
      id: 'retry_qualification_same_artifact',
      action: 'retry_qualification_same_artifact',
      controller: 'release:stable',
      controller_subcommand: 'retry-qualification',
      publishes_release: false,
      mutation_authorized: false,
      direct_workflow_dispatch_allowed: false,
      execute_flag_included: false,
      command: stableControllerCommand(
        'retry-qualification',
        options.stableStatePath,
        [`--artifact-kind ${artifactKind}`],
      ),
      evidence,
    },
  ];
}

function ownerCandidateRecordVerifyCommand(version: string): string {
  const versionArg = version.trim() || '<version>';
  return [
    'npm run release:owner-candidate-record:verify --',
    `--version ${versionArg}`,
    `--owner-record docs/delivery/release/records/v${versionArg}-release-owner-receipt.json`,
    `--artifacts-dir artifacts/release-closeout/v${versionArg}-<run-id>/artifacts`,
  ].join(' ');
}

function buildOperatorGuidance(version: string, stableStatePath = '<original-stable-release-session.json>'): OperatorGuidance {
  return {
    currentness_freeze: {
      required_before_broker_submission: true,
      controller_input_source: 'release_cohort_plan_or_lock',
      direct_workflow_dispatch_allowed: false,
      post_freeze_drift_name: 'post-freeze drift',
      single_desktop_release_per_frozen_cohort: true,
      rule: 'Freeze App/Shell/Framework SHAs before broker submission. Remote movement after freeze is post-freeze drift: reconcile the frozen Stable session, then either continue it through the controller or create a new controller plan from a newly frozen cohort.',
    },
    post_owner_receipt_fast_path: {
      default_action: 'verify_owner_candidate_record_then_use_stable_controller',
      verify_command: ownerCandidateRecordVerifyCommand(version),
      controller_command: stableControllerCommand(
        'promote',
        stableStatePath,
        [
          '--release-set-generation <YY.M.D[-rN]>',
          '--release-owner-receipt-ref <same-cohort-owner-receipt-ref>',
        ],
      ),
      direct_workflow_dispatch_allowed: false,
      desktop_release_rebuild_required: false,
      rule: 'When same-cohort evidence is complete and only the release-owner receipt was missing, verify the post-owner candidate record and use the dry-run Stable controller promotion route. The operator cannot submit the mutation or rebuild the desktop release for owner metadata.',
    },
  };
}

function buildPlanState(plan: ReleaseCohortPlan): OperatorState {
  return {
    schema: 'opl_app_release_operator_state.v1',
    generated_at: new Date().toISOString(),
    command: 'plan',
    status: 'planned',
    phase: 'release_plan_ready',
    cohort_plan: plan,
    next_action: {
      action: 'follow_cohort_plan',
      command: plan.next_action.command,
      reason: 'Release operator plan is a controller surface over the pinned cohort plan.',
    },
    operator_guidance: buildOperatorGuidance(plan.version),
    authority_boundary: {
      operator_can_publish_release: false,
      operator_can_write_runtime_truth: false,
      operator_can_dispatch_workflow_without_explicit_user_action: false,
      operator_can_authorize_mutation: false,
    },
  };
}

function buildDiagnoseVmState(options: DiagnoseVmOptions): OperatorState {
  const diagnosticActions = buildDiagnosticActions(options);
  return {
    schema: 'opl_app_release_operator_state.v1',
    generated_at: new Date().toISOString(),
    command: 'diagnose-vm',
    status: 'diagnostic_action_ready',
    phase: 'release_diagnostic_action_ready',
    diagnostic_actions: diagnosticActions,
    next_action: {
      action: 'retry_qualification_same_artifact',
      command: diagnosticActions[1].command,
      reason: 'Ask the Stable controller to validate a same-artifact qualification attempt in dry-run mode. This diagnostic output cannot authorize or submit the attempt.',
    },
    operator_guidance: buildOperatorGuidance(options.version, options.stableStatePath),
    authority_boundary: {
      operator_can_publish_release: false,
      operator_can_write_runtime_truth: false,
      operator_can_dispatch_workflow_without_explicit_user_action: false,
      operator_can_authorize_mutation: false,
    },
  };
}

function timestampField(record: JsonRecord | null | undefined, camelKey: string, snakeKey?: string): string | null {
  return stringField(record, camelKey) ?? (snakeKey ? stringField(record, snakeKey) : null);
}

function idField(record: JsonRecord | null | undefined): string {
  const value = record?.databaseId ?? record?.database_id ?? record?.id ?? record?.run_id;
  const id = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value : '';
  if (!/^[1-9][0-9]*$/.test(id)) throw new Error('Run JSON databaseId must be an exact positive numeric GitHub run id.');
  return id;
}

function normalizeRunPayload(payload: unknown): JsonRecord {
  const record = asRecord(payload);
  if (!record) throw new Error('Run JSON must be an object.');
  return record;
}

const allowedRunStatuses = new Set(['requested', 'pending', 'queued', 'waiting', 'in_progress', 'completed']);
const allowedRunConclusions = new Set([
  'success',
  'failure',
  'neutral',
  'cancelled',
  'skipped',
  'timed_out',
  'action_required',
  'stale',
  'startup_failure',
]);
const workflowFilesByName = new Map<string, StableReleaseSession['mutation_attempts'][number]['workflow']>([
  ['OPL Desktop Release', 'desktop-release.yml'],
  ['OPL GUI First-Run VM', 'opl-first-run-vm.yml'],
  ['OPL Desktop Release Promote', 'desktop-release-promote.yml'],
  ['OPL Desktop Full Add-on', 'desktop-release-full-addon.yml'],
] as const);

function validateStatusAndConclusion(
  status: string | null,
  conclusion: string | null,
  label: string,
): void {
  if (!status || !allowedRunStatuses.has(status)) throw new Error(`${label} status is missing or unsupported.`);
  if (conclusion !== null && !allowedRunConclusions.has(conclusion)) {
    throw new Error(`${label} conclusion is unsupported: ${conclusion}.`);
  }
  if (status === 'completed' && conclusion === null) throw new Error(`${label} completed without a conclusion.`);
  if (status !== 'completed' && conclusion !== null) throw new Error(`${label} is nonterminal but carries conclusion ${conclusion}.`);
}

function validateTimestamp(value: string | null, label: string): void {
  if (value !== null && !Number.isFinite(Date.parse(value))) throw new Error(`${label} is not a valid timestamp.`);
}

function githubReadTimeoutMs(): number {
  const configured = Number(process.env.OPL_RELEASE_GH_TIMEOUT_MS ?? defaultGitHubReadTimeoutMs);
  if (!Number.isSafeInteger(configured) || configured < 10 || configured > 120_000) {
    throw new Error('OPL_RELEASE_GH_TIMEOUT_MS must be an integer between 10 and 120000.');
  }
  return configured;
}

function runGitHubRead(args: string[], label: string): string {
  const result = spawnSync('gh', args, {
    cwd: appRoot,
    encoding: 'utf8',
    maxBuffer: commandMaxBuffer,
    timeout: githubReadTimeoutMs(),
  });
  const error = result.error as NodeJS.ErrnoException | undefined;
  if (error?.code === 'ETIMEDOUT') throw new Error(`${label} timed out; no operator state was advanced.`);
  if (error) throw new Error(`${label} failed to start: ${error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr ?? '').trim() || (result.stdout ?? '').trim() || `${label} failed`;
    throw new Error(`${label} failed: ${detail}`);
  }
  return result.stdout ?? '';
}

function fetchRun(options: StatusOptions): JsonRecord {
  if (options.runJsonPath) return normalizeRunPayload(readJson(options.runJsonPath));
  const stdout = runGitHubRead([
    'run',
    'view',
    options.runId,
    '--repo',
    options.repo,
    '--json',
    [
      'databaseId',
      'attempt',
      'status',
      'conclusion',
      'createdAt',
      'updatedAt',
      'startedAt',
      'completedAt',
      'headSha',
      'headBranch',
      'workflowName',
      'displayTitle',
      'event',
      'url',
      'jobs',
    ].join(','),
  ], 'Fetch release run status');
  try {
    return normalizeRunPayload(JSON.parse(stdout));
  } catch (error) {
    throw new Error(`Fetch release run status returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeSteps(job: JsonRecord): RunStatusSummary['jobs'][number]['steps'] {
  if (job.steps !== undefined && !Array.isArray(job.steps)) throw new Error('Run JSON job steps must be an array.');
  return asArray(job.steps).map((entry, index) => {
    const step = asRecord(entry);
    if (!step) throw new Error(`Run JSON step ${index} must be an object.`);
    const name = stringField(step, 'name') ?? stringField(step, 'displayName');
    if (!name?.trim()) throw new Error(`Run JSON step ${index} requires a non-empty name.`);
    const status = stringField(step, 'status');
    const conclusion = stringField(step, 'conclusion');
    validateStatusAndConclusion(status, conclusion, `Run JSON step ${name}`);
    const startedAt = timestampField(step, 'startedAt', 'started_at');
    const completedAt = timestampField(step, 'completedAt', 'completed_at');
    validateTimestamp(startedAt, `Run JSON step ${name} startedAt`);
    validateTimestamp(completedAt, `Run JSON step ${name} completedAt`);
    return {
      name,
      status,
      conclusion,
      started_at: startedAt,
      completed_at: completedAt,
    };
  });
}

function normalizeJobs(run: JsonRecord): RunStatusSummary['jobs'] {
  const jobs = run.jobs ?? run.workflow_jobs;
  if (!Array.isArray(jobs)) throw new Error('Run JSON jobs must be an array.');
  return jobs.map((entry, index) => {
    const job = asRecord(entry);
    if (!job) throw new Error(`Run JSON job ${index} must be an object.`);
    const name = stringField(job, 'name') ?? stringField(job, 'displayName');
    if (!name?.trim()) throw new Error(`Run JSON job ${index} requires a non-empty name.`);
    const status = stringField(job, 'status');
    const conclusion = stringField(job, 'conclusion');
    validateStatusAndConclusion(status, conclusion, `Run JSON job ${name}`);
    const startedAt = timestampField(job, 'startedAt', 'started_at');
    const completedAt = timestampField(job, 'completedAt', 'completed_at');
    validateTimestamp(startedAt, `Run JSON job ${name} startedAt`);
    validateTimestamp(completedAt, `Run JSON job ${name} completedAt`);
    return {
      name,
      status,
      conclusion,
      started_at: startedAt,
      completed_at: completedAt,
      steps: normalizeSteps(job),
    };
  });
}

function summarizeRun(run: JsonRecord, options: StatusOptions): RunStatusSummary {
  const payloadId = idField(run);
  if (options.runId && options.runId !== payloadId) {
    throw new Error(`--run-id ${options.runId} does not match Run JSON databaseId ${payloadId}.`);
  }
  const attempt = run.attempt;
  if (typeof attempt !== 'number' || !Number.isSafeInteger(attempt) || attempt < 1) {
    throw new Error('Run JSON attempt must be a positive integer.');
  }
  const workflowName = stringField(run, 'workflowName') ?? stringField(run, 'workflow_name') ?? stringField(run, 'name');
  if (!workflowName || !workflowFilesByName.has(workflowName)) {
    throw new Error(`Run JSON workflowName is missing or unsupported: ${workflowName ?? '<missing>'}.`);
  }
  const displayTitle = stringField(run, 'displayTitle') ?? stringField(run, 'display_title');
  if (!displayTitle?.trim()) throw new Error('Run JSON displayTitle is required.');
  const status = stringField(run, 'status');
  const conclusion = stringField(run, 'conclusion');
  validateStatusAndConclusion(status, conclusion, 'Run JSON');
  const headSha = stringField(run, 'headSha') ?? stringField(run, 'head_sha');
  if (!headSha || !/^[0-9a-f]{40}$/i.test(headSha)) {
    throw new Error('Run JSON headSha must be a 40-character commit SHA.');
  }
  const headBranch = stringField(run, 'headBranch') ?? stringField(run, 'head_branch');
  if (!headBranch?.trim()) throw new Error('Run JSON headBranch is required.');
  const event = stringField(run, 'event');
  if (event !== 'workflow_dispatch') throw new Error('Run JSON event must be workflow_dispatch.');
  const createdAt = timestampField(run, 'createdAt', 'created_at');
  const startedAt = timestampField(run, 'startedAt', 'started_at');
  const updatedAt = timestampField(run, 'updatedAt', 'updated_at');
  const completedAt = timestampField(run, 'completedAt', 'completed_at');
  for (const [label, value] of [['createdAt', createdAt], ['startedAt', startedAt], ['updatedAt', updatedAt], ['completedAt', completedAt]] as const) {
    validateTimestamp(value, `Run JSON ${label}`);
  }
  return {
    id: payloadId,
    attempt,
    workflow_name: workflowName,
    display_title: displayTitle,
    status,
    conclusion,
    created_at: createdAt,
    started_at: startedAt,
    updated_at: updatedAt,
    completed_at: completedAt,
    head_sha: headSha.toLowerCase(),
    head_branch: headBranch,
    event,
    url: stringField(run, 'url'),
    jobs: normalizeJobs(run),
  };
}

type StableRunBinding = {
  session: StableReleaseSession;
  mutationAttempt: StableReleaseSession['mutation_attempts'][number];
};

function bindRunToStableSession(
  options: StatusOptions,
  run: RunStatusSummary,
): StableRunBinding {
  const session = readStableReleaseSession(options.stableStatePath);
  if (session.repo !== options.repo) {
    throw new Error(`Stable session repo ${session.repo} does not match --repo ${options.repo}.`);
  }
  if (session.version !== options.version) {
    throw new Error(`Stable session version ${session.version} does not match --version ${options.version}.`);
  }
  const expectedWorkflow = workflowFilesByName.get(run.workflow_name ?? '');
  if (!expectedWorkflow) throw new Error(`Run workflow ${run.workflow_name ?? '<missing>'} is not a Stable controller workflow.`);
  const matches = session.mutation_attempts.filter((attempt) => (
    attempt.mutation !== 'workflow_cancel'
    && attempt.workflow === expectedWorkflow
    && attempt.events.some((event) => event.run_id === run.id)
  ));
  if (matches.length !== 1) {
    throw new Error(`Run ${run.id} must bind to exactly one durable Stable controller mutation attempt; found ${matches.length}.`);
  }
  const mutationAttempt = matches[0];
  if (mutationAttempt.artifact_app_sha.toLowerCase() !== session.cohort_plan.cohort_lock.app.resolved_sha.toLowerCase()) {
    throw new Error('Stable mutation attempt artifact App SHA does not match the frozen cohort.');
  }
  if (mutationAttempt.controller_workflow_sha.toLowerCase() !== options.expectedHead) {
    throw new Error('--expected-head does not match the durable Stable controller workflow SHA.');
  }
  if (run.head_sha !== options.expectedHead) {
    throw new Error(`Run head ${run.head_sha} does not match --expected-head ${options.expectedHead}.`);
  }
  if (run.head_branch !== mutationAttempt.dispatch_fence.workflow_head_branch) {
    throw new Error('Run headBranch does not match the durable Stable mutation dispatch fence.');
  }
  if (!run.display_title?.endsWith(`attempt=${mutationAttempt.attempt_id}`)) {
    throw new Error('Run displayTitle does not bind the durable Stable controller mutation attempt id.');
  }
  return { session, mutationAttempt };
}

function readDiagnosticStableSession(options: DiagnoseVmOptions): StableReleaseSession {
  const session = readStableReleaseSession(options.stableStatePath);
  if (session.version !== options.version) {
    throw new Error(`Stable session version ${session.version} does not match --version ${options.version}.`);
  }
  const artifactKind = options.packageProfile === 'full' ? 'full' : 'standard';
  const track = session.artifact_tracks[artifactKind];
  const knownRunIds = new Set([
    session.release_run.id,
    track.source_run_id,
    track.qualification_run.id,
    ...track.attempts.flatMap((attempt) => attempt.events.map((event) => event.run_id)),
  ].filter((value): value is string => Boolean(value)));
  if (!knownRunIds.has(options.releaseArtifactRunId)) {
    throw new Error(`Release artifact run ${options.releaseArtifactRunId} is not bound to the ${artifactKind} track in the Stable session.`);
  }
  return session;
}

const blockingConclusions = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure']);

function isBlockingConclusion(value: string | null): value is string {
  return Boolean(value && blockingConclusions.has(value));
}

function normalizeClassifierText(...values: Array<string | null | undefined>): string {
  return values
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

function classifyBlockerAction(blocker: PrimaryBlocker, run: RunStatusSummary): OperatorNextAction['action'] {
  if (!blocker) return 'inspect_primary_blocker';
  if (blocker.conclusion === 'cancelled') return 'inspect_primary_blocker';
  const text = normalizeClassifierText(run.workflow_name, blocker.job_name, blocker.step_name, blocker.reason);
  const blockerText = normalizeClassifierText(blocker.job_name, blocker.step_name, blocker.reason);
  if (text.includes('source gate')) return 'repair_source_gate';
  if (
    blockerText.includes('ghcr')
    && (
      blockerText.includes('permission')
      || blockerText.includes('denied')
      || blockerText.includes('unauthorized')
      || blockerText.includes('access')
      || blockerText.includes('push')
    )
  ) {
    return 'repair_ghcr_publish_access';
  }
  if (text.includes('webui') || text.includes('docker')) return 'repair_webui_runtime_image';
  if (text.includes('first-run vm') || text.includes('first run vm') || text.includes('vm smoke') || text.includes('first launch')) {
    return 'retry_qualification_same_artifact';
  }
  return 'inspect_primary_blocker';
}

function inferVmDiagnosticProfile(run: RunStatusSummary, blocker: PrimaryBlocker, version: string) {
  const text = normalizeClassifierText(run.workflow_name, blocker?.job_name, blocker?.step_name, blocker?.reason);
  if (text.includes('homebrew')) {
    return { packageProfile: 'homebrew-standard', releaseArtifactName: '' };
  }
  if (text.includes('full')) {
    return {
      packageProfile: 'full',
      releaseArtifactName: `opl-full-first-install-dmg-${version}-mac-arm64`,
    };
  }
  return { packageProfile: 'standard', releaseArtifactName: 'macos-build-arm64-dmg' };
}

function sameArtifactQualificationCommand(options: StatusOptions, run: RunStatusSummary, blocker: PrimaryBlocker): string {
  const version = options.version.trim() || '<version>';
  const profile = inferVmDiagnosticProfile(run, blocker, version);
  return stableControllerCommand(
    'retry-qualification',
    options.stableStatePath,
    [`--artifact-kind ${profile.packageProfile === 'full' ? 'full' : 'standard'}`],
  );
}

function phaseForStatus(status: OperatorStatus): OperatorPhase {
  if (status === 'planned') return 'release_plan_ready';
  if (status === 'diagnostic_action_ready') return 'release_diagnostic_action_ready';
  if (status === 'failed') return 'release_run_failed';
  if (status === 'failed_gate_draining') return 'release_run_failed_draining';
  if (status === 'stale_candidate') return 'release_run_stale_candidate';
  if (status === 'superseded') return 'release_run_superseded';
  if (status === 'cancelled') return 'release_run_cancelled';
  if (status === 'hard_stop_exceeded') return 'release_run_hard_stop_exceeded';
  if (status === 'ready_for_closeout_review') return 'release_closeout_review_ready';
  return 'release_run_waiting';
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function elapsedSeconds(startedAt: string | null, endedAt: string | null): number | null {
  const started = parseTimestamp(startedAt);
  const ended = parseTimestamp(endedAt);
  if (started === null || ended === null || ended < started) return null;
  return Math.floor((ended - started) / 1000);
}

function buildElapsed(run: RunStatusSummary, generatedAt: string): OperatorElapsed {
  const startedAt = run.started_at ?? run.created_at;
  const endedAt = run.status === 'completed'
    ? run.completed_at ?? run.updated_at
    : generatedAt;
  return {
    started_at: startedAt,
    ended_at: endedAt,
    seconds: elapsedSeconds(startedAt, endedAt),
  };
}

function progressThresholdSeconds(run: RunStatusSummary, currentStep: CurrentStep): number | null {
  if (run.status === 'completed') return null;
  if (currentStep.waiting) return 10 * 60;
  const classifier = normalizeClassifierText(run.workflow_name, currentStep.job_name, currentStep.step_name);
  if (classifier.includes('build, verify, and publish docker webui')) return 10 * 60;
  if (classifier.includes('docker') || classifier.includes('webui') || classifier.includes('ghcr')) return 20 * 60;
  if (classifier.includes('vm smoke') || classifier.includes('first-run vm') || classifier.includes('first run vm')) return 30 * 60;
  return 20 * 60;
}

function runSlaThresholds(run: RunStatusSummary): { profile: string; attention: number; hardStop: number } | null {
  const workflow = normalizeClassifierText(run.workflow_name);
  const jobs = normalizeClassifierText(...run.jobs.map((job) => job.name));
  if (workflow.includes('desktop release promote')) {
    return { profile: 'promote_after_owner_receipt', attention: 10 * 60, hardStop: 15 * 60 };
  }
  if (workflow.includes('desktop release diagnostics')) {
    return { profile: 'same_cohort_diagnostic', attention: 15 * 60, hardStop: 30 * 60 };
  }
  if (workflow.includes('first-run vm') || workflow.includes('first run vm')) {
    return { profile: 'same_artifact_vm_gate', attention: 15 * 60, hardStop: 30 * 60 };
  }
  if (workflow.includes('desktop release')) {
    if (
      jobs.includes('full first-install')
      || jobs.includes('full-first-install')
      || jobs.includes('full package')
      || jobs.includes('full release')
    ) {
      return { profile: 'stable_full_docker_vm', attention: 75 * 60, hardStop: 90 * 60 };
    }
    return { profile: 'stable_standard_only', attention: 45 * 60, hardStop: 60 * 60 };
  }
  return null;
}

function buildReleaseSessionManifest(
  options: StatusOptions,
  state: Omit<OperatorState, 'session'>,
  previous?: ReleaseSessionManifest,
): ReleaseSessionManifest | undefined {
  if (!state.run) return undefined;
  const version = options.version.trim() || '<version>';
  const ownerVerifyVersion = options.version.trim() || '<version>';
  const currentRun = {
    id: state.run.id,
    workflow_name: state.run.workflow_name,
    status: state.run.status,
    conclusion: state.run.conclusion,
    head_sha: state.run.head_sha,
    url: state.run.url,
    elapsed_seconds: state.elapsed?.seconds ?? null,
  };
  const runsById = new Map<string, typeof currentRun>();
  for (const run of previous?.run_set.runs ?? []) {
    runsById.set(run.id, run);
  }
  runsById.set(currentRun.id, currentRun);
  const releaseTruthRefs = {
    ...previous?.release_truth_refs,
    ...(options.candidateRef ? { candidate_record: options.candidateRef } : {}),
    ...(options.closeoutRef ? { closeout: options.closeoutRef } : {}),
    ...(options.readbackRef ? { readback: options.readbackRef } : {}),
  };
  const hasReleaseTruthRefs = Object.values(releaseTruthRefs).some(Boolean);
  const ownerReceiptRef = options.ownerReceiptRef || previous?.owner_receipt.ref;
  const postPublishFollowUpRef = options.postPublishFollowUpRef || previous?.post_publish_follow_up.ref;
  const postPublishFollowUpState = options.postPublishFollowUpState
    || previous?.post_publish_follow_up.state
    || 'not_applicable_until_release_published';
  const previousAuthorityRef = previous?.current_authority_run.id === state.run.id
    ? previous.current_authority_run.ref
    : undefined;
  const currentAuthorityRef = options.currentAuthorityRef || previousAuthorityRef;
  return {
    schema: 'opl_app_release_session_manifest.v1',
    id: previous?.id || `release-session:${version}:${state.run.id}`,
    generated_at: state.generated_at,
    version,
    run_set: {
      current_run_id: state.run.id,
      runs: [...runsById.values()],
    },
    current_authority_run: {
      id: state.run.id,
      status: state.run.status,
      conclusion: state.run.conclusion,
      head_sha: state.run.head_sha,
      ...(currentAuthorityRef ? { ref: currentAuthorityRef } : {}),
    },
    failed_run_tax: {
      action: state.next_action.action,
      primary_blocker: state.primary_blocker ?? null,
      elapsed_seconds: state.elapsed?.seconds ?? null,
    },
    typed_next_action: state.next_action,
    owner_receipt: {
      state: ownerReceiptRef
        ? 'provided'
        : state.status === 'ready_for_closeout_review' ? 'not_provided' : 'not_required_for_current_state',
      verify_command: `npm run release:owner-candidate-record:verify -- --version ${ownerVerifyVersion}`,
      ...(ownerReceiptRef ? { ref: ownerReceiptRef } : {}),
    },
    ...(hasReleaseTruthRefs ? { release_truth_refs: releaseTruthRefs } : {}),
    post_publish_follow_up: {
      state: postPublishFollowUpState,
      summary: postPublishFollowUpState === 'not_applicable_until_release_published'
        ? 'Post-publish follow-up is not applicable until the candidate is promoted or a published-with-follow-up state exists.'
        : `Post-publish follow-up is ${postPublishFollowUpState}.`,
      ...(postPublishFollowUpRef ? { ref: postPublishFollowUpRef } : {}),
    },
    truth_boundary: 'release-session is an operator control surface derived from run status; it is not release truth and cannot publish, promote, or write runtime truth.',
  };
}

function readReleaseSessionManifest(filePath: string): ReleaseSessionManifest | undefined {
  if (!filePath || !fs.existsSync(filePath)) return undefined;
  const parsed = asRecord(readJson(filePath));
  if (!parsed || parsed.schema !== 'opl_app_release_session_manifest.v1') {
    throw new Error(`Existing session manifest is not opl_app_release_session_manifest.v1: ${filePath}`);
  }
  return parsed as ReleaseSessionManifest;
}

function buildRunSlaBudget(run: RunStatusSummary, elapsedSecondsValue: number | null) {
  const thresholds = runSlaThresholds(run);
  if (!thresholds) {
    return {
      run_sla_profile: null,
      run_attention_seconds: null,
      run_hard_stop_seconds: null,
      run_sla_status: 'unknown' as const,
      run_sla_reason: 'No release SLA profile applies to this workflow.',
    };
  }
  if (elapsedSecondsValue === null) {
    return {
      run_sla_profile: thresholds.profile,
      run_attention_seconds: thresholds.attention,
      run_hard_stop_seconds: thresholds.hardStop,
      run_sla_status: 'unknown' as const,
      run_sla_reason: `Release SLA profile ${thresholds.profile} applies, but elapsed time is unavailable.`,
    };
  }
  if (elapsedSecondsValue >= thresholds.hardStop) {
    return {
      run_sla_profile: thresholds.profile,
      run_attention_seconds: thresholds.attention,
      run_hard_stop_seconds: thresholds.hardStop,
      run_sla_status: 'exceeded' as const,
      run_sla_reason: `Run elapsed ${elapsedSecondsValue}s exceeded the ${thresholds.hardStop}s hard-stop SLA for ${thresholds.profile}.`,
    };
  }
  if (elapsedSecondsValue >= thresholds.attention) {
    return {
      run_sla_profile: thresholds.profile,
      run_attention_seconds: thresholds.attention,
      run_hard_stop_seconds: thresholds.hardStop,
      run_sla_status: 'attention' as const,
      run_sla_reason: `Run elapsed ${elapsedSecondsValue}s crossed the ${thresholds.attention}s attention SLA for ${thresholds.profile}.`,
    };
  }
  return {
    run_sla_profile: thresholds.profile,
    run_attention_seconds: thresholds.attention,
    run_hard_stop_seconds: thresholds.hardStop,
    run_sla_status: 'within_sla' as const,
    run_sla_reason: `Run elapsed ${elapsedSecondsValue}s is inside the ${thresholds.attention}s attention SLA for ${thresholds.profile}.`,
  };
}

function buildBudget(run: RunStatusSummary, currentStep: CurrentStep, elapsed: OperatorElapsed, generatedAt: string): OperatorBudget {
  const stepStartedAt = currentStep.started_at ?? (currentStep.waiting ? currentStep.started_at : null);
  const currentStepElapsed = run.status === 'completed'
    ? null
    : elapsedSeconds(stepStartedAt, generatedAt);
  const runUpdatedAge = run.status === 'completed'
    ? null
    : elapsedSeconds(run.updated_at ?? run.started_at ?? run.created_at, generatedAt);
  const threshold = progressThresholdSeconds(run, currentStep);
  const runSla = buildRunSlaBudget(run, elapsed.seconds);
  if (run.status === 'completed') {
    return {
      status: 'unknown',
      elapsed_seconds: elapsed.seconds,
      current_step_elapsed_seconds: currentStepElapsed,
      run_updated_age_seconds: runUpdatedAge,
      threshold_seconds: threshold,
      ...runSla,
      reason: 'Run is complete; progress budget no longer applies.',
    };
  }
  if (threshold !== null && currentStepElapsed !== null && currentStepElapsed >= threshold) {
    return {
      status: 'attention',
      elapsed_seconds: elapsed.seconds,
      current_step_elapsed_seconds: currentStepElapsed,
      run_updated_age_seconds: runUpdatedAge,
      threshold_seconds: threshold,
      ...runSla,
      reason: `Current step has been active for ${currentStepElapsed}s, crossing the ${threshold}s release-operator attention budget.`,
    };
  }
  if (threshold !== null && runUpdatedAge !== null && runUpdatedAge >= threshold) {
    return {
      status: 'attention',
      elapsed_seconds: elapsed.seconds,
      current_step_elapsed_seconds: currentStepElapsed,
      run_updated_age_seconds: runUpdatedAge,
      threshold_seconds: threshold,
      ...runSla,
      reason: `Run status has not updated for ${runUpdatedAge}s, crossing the ${threshold}s release-operator attention budget.`,
    };
  }
  if (runSla.run_sla_status === 'attention' || runSla.run_sla_status === 'exceeded') {
    return {
      status: 'attention',
      elapsed_seconds: elapsed.seconds,
      current_step_elapsed_seconds: currentStepElapsed,
      run_updated_age_seconds: runUpdatedAge,
      threshold_seconds: threshold,
      ...runSla,
      reason: runSla.run_sla_reason,
    };
  }
  return {
    status: threshold === null ? 'unknown' : 'within_budget',
    elapsed_seconds: elapsed.seconds,
    current_step_elapsed_seconds: currentStepElapsed,
    run_updated_age_seconds: runUpdatedAge,
    threshold_seconds: threshold,
    ...runSla,
    reason: threshold === null
      ? 'No progress budget applies to this run state.'
      : `Current run is still inside the ${threshold}s release-operator attention budget.`,
  };
}

function findCurrentStep(run: RunStatusSummary): CurrentStep {
  const activeJob = run.jobs.find((job) => job.status === 'in_progress' || job.status === 'queued' || job.status === 'waiting');
  if (activeJob) {
    const activeStep = activeJob.steps.find((step) => (
      step.status === 'in_progress'
      || step.status === 'queued'
      || step.status === 'waiting'
      || (step.started_at && !step.completed_at)
    ));
    return {
      job_name: activeJob.name,
      step_name: activeStep?.name ?? null,
      status: activeStep?.status ?? activeJob.status,
      conclusion: activeStep?.conclusion ?? activeJob.conclusion,
      started_at: activeStep?.started_at ?? activeJob.started_at,
      completed_at: activeStep?.completed_at ?? activeJob.completed_at,
      waiting: activeJob.status !== 'in_progress' && !activeStep,
      reason: activeStep
        ? `Step ${activeStep.name} in job ${activeJob.name} is ${activeStep.status ?? 'active'}.`
        : `Job ${activeJob.name} is ${activeJob.status ?? 'active'} with no active step reported.`,
    };
  }
  if (run.status !== 'completed') {
    return {
      job_name: null,
      step_name: null,
      status: run.status,
      conclusion: run.conclusion,
      started_at: run.started_at ?? run.created_at,
      completed_at: run.completed_at,
      waiting: true,
      reason: `Run is ${run.status ?? 'unknown'} and no active job was reported.`,
    };
  }
  return {
    job_name: null,
    step_name: null,
    status: run.status,
    conclusion: run.conclusion,
    started_at: run.started_at ?? run.created_at,
    completed_at: run.completed_at ?? run.updated_at,
    waiting: false,
    reason: `Run completed with conclusion ${run.conclusion ?? 'none'}.`,
  };
}

function findPrimaryBlocker(run: RunStatusSummary): PrimaryBlocker {
  for (const job of run.jobs) {
    for (const step of job.steps) {
      if (isBlockingConclusion(step.conclusion)) {
        return {
          type: 'step',
          conclusion: step.conclusion,
          job_name: job.name,
          step_name: step.name,
          reason: `Step ${step.name} in job ${job.name} concluded ${step.conclusion}.`,
        };
      }
    }
    if (isBlockingConclusion(job.conclusion)) {
      return {
        type: 'job',
        conclusion: job.conclusion,
        job_name: job.name,
        reason: `Job ${job.name} concluded ${job.conclusion}.`,
      };
    }
  }
  if (isBlockingConclusion(run.conclusion)) {
    return {
      type: 'run',
      conclusion: run.conclusion,
      run_id: run.id,
      reason: `Run concluded ${run.conclusion}.`,
    };
  }
  return null;
}

function statusAction(
  options: StatusOptions,
  run: RunStatusSummary,
  status: OperatorStatus,
  blocker: PrimaryBlocker,
  budget?: OperatorBudget,
): OperatorNextAction {
  if (status === 'stale_candidate') {
    return {
      action: 'reconcile_stable_session',
      command: stableControllerCommand('reconcile', options.stableStatePath),
      reason: `Run head ${run.head_sha ?? 'unknown'} does not match expected head ${options.expectedHead}. Reconcile the original Stable session before the controller accepts any newly frozen cohort plan.`,
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'superseded') {
    return {
      action: 'reconcile_stable_session',
      command: stableControllerCommand('reconcile', options.stableStatePath),
      reason: `Cancelled run head ${run.head_sha ?? 'unknown'} does not match expected head ${options.expectedHead}; reconcile the original Stable session and keep this run as old-cohort diagnostics.`,
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'failed_gate_draining') {
    const action = classifyBlockerAction(blocker, run);
    return {
      action: action === 'retry_qualification_same_artifact' ? 'reconcile_stable_session' : action,
      command: action === 'retry_qualification_same_artifact'
        ? stableControllerCommand('reconcile', options.stableStatePath)
        : `gh run view ${run.id} --repo ${options.repo} --log-failed`,
      reason: action === 'retry_qualification_same_artifact'
        ? `VM gate failed while the workflow is still ${run.status ?? 'running'}; reconcile until the Stable session records a terminal qualification failure before planning any targeted recovery. ${blocker?.reason ?? ''}`.trim()
        : `Primary blocker failed while the workflow is still ${run.status ?? 'running'}: ${blocker?.reason ?? 'A gate failed.'}`,
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'failed') {
    const action = classifyBlockerAction(blocker, run);
    return {
      action,
      command: action === 'retry_qualification_same_artifact'
        ? sameArtifactQualificationCommand(options, run, blocker)
        : `gh run view ${run.id} --repo ${options.repo} --log-failed`,
      reason: action === 'retry_qualification_same_artifact'
        ? `VM gate failed; ask the Stable controller to validate a bounded same-artifact qualification attempt. This dry-run recommendation cannot authorize the attempt. ${blocker?.reason ?? ''}`.trim()
        : blocker?.reason ?? `Run conclusion is ${run.conclusion ?? 'unknown'}.`,
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'cancelled') {
    return {
      action: 'reconcile_stable_session',
      command: stableControllerCommand('reconcile', options.stableStatePath),
      reason: blocker?.reason ?? 'Run was cancelled; reconcile the durable Stable session before any later controller plan.',
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'ready_for_closeout_review') {
    const version = options.version.trim() || '<version>';
    return {
      action: 'reconcile_stable_session',
      command: stableControllerCommand('reconcile', options.stableStatePath),
      reason: options.version.trim()
        ? `Run completed successfully for v${version}; reconcile the canonical Stable session so exact receipts, run identity, and the next controller phase are validated.`
        : 'Run completed successfully; reconcile the canonical Stable session so exact receipts, run identity, and the next controller phase are validated.',
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'waiting_for_run_completion' && budget?.status === 'attention') {
    return {
      action: 'inspect_current_step_progress',
      command: `gh run view ${run.id} --repo ${options.repo} --json status,conclusion,updatedAt,jobs`,
      reason: budget.reason,
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  return {
    action: 'reconcile_stable_session',
    command: stableControllerCommand('reconcile', options.stableStatePath),
    reason: `Run is ${run.status ?? 'unknown'} with conclusion ${run.conclusion ?? 'none'}; use the controller's read-only reconcile path instead of creating another monitor or mutation path.`,
    publishes_release: false,
    dispatches_workflow: false,
  };
}

function buildStatusState(options: StatusOptions): OperatorState {
  const generatedAt = new Date().toISOString();
  const run = summarizeRun(fetchRun(options), options);
  bindRunToStableSession(options, run);
  const isStale = Boolean(options.expectedHead && run.head_sha && run.head_sha !== options.expectedHead);
  const foundBlocker = findPrimaryBlocker(run);
  const staleBlocker: PrimaryBlocker = isStale
    ? {
        type: 'stale_candidate',
        conclusion: 'stale',
        head_sha: run.head_sha,
        expected_head: options.expectedHead,
        reason: `Run head ${run.head_sha ?? 'unknown'} does not match expected head ${options.expectedHead}.`,
      }
    : null;
  const primaryBlocker = staleBlocker ?? foundBlocker;
  const status: OperatorStatus = isStale
    ? run.conclusion === 'cancelled' ? 'superseded' : 'stale_candidate'
    : foundBlocker && run.status !== 'completed'
      ? 'failed_gate_draining'
      : run.status === 'completed' && run.conclusion === 'cancelled'
        ? 'cancelled'
      : foundBlocker || (run.status === 'completed' && run.conclusion !== 'success')
        ? 'failed'
        : run.status === 'completed' && run.conclusion === 'success'
          ? 'ready_for_closeout_review'
          : 'waiting_for_run_completion';
  const currentStep = findCurrentStep(run);
  const elapsed = buildElapsed(run, generatedAt);
  const budget = buildBudget(run, currentStep, elapsed, generatedAt);
  const recommendedNextAction = statusAction(options, run, status, primaryBlocker, budget);
  if (
    ['reconcile_stable_session', 'retry_qualification_same_artifact'].includes(recommendedNextAction.action)
    && !options.stableStatePath.trim()
  ) {
    throw new Error('This status requires --stable-state <original-stable-release-session.json>; operator observation manifests are not Stable controller state.');
  }
  const state: Omit<OperatorState, 'session'> = {
    schema: 'opl_app_release_operator_state.v1',
    generated_at: generatedAt,
    command: 'status',
    status,
    phase: phaseForStatus(status),
    run,
    current_step: currentStep,
    elapsed,
    budget,
    expected_head: options.expectedHead || undefined,
    is_stale: isStale,
    primary_blocker: primaryBlocker,
    recommended_next_action: recommendedNextAction,
    next_action: recommendedNextAction,
    operator_guidance: buildOperatorGuidance(options.version, options.stableStatePath),
    authority_boundary: {
      operator_can_publish_release: false,
      operator_can_write_runtime_truth: false,
      operator_can_dispatch_workflow_without_explicit_user_action: false,
      operator_can_authorize_mutation: false,
    },
  };
  const previousSession = readReleaseSessionManifest(options.sessionInput || options.sessionOutput || '');
  return {
    ...state,
    session: buildReleaseSessionManifest(options, state, previousSession),
  };
}

function writeOperatorMarkdown(filePath: string, state: OperatorState): void {
  if (!filePath) return;
  const lines = [
    '# Release Operator State',
    '',
    `- Schema: ${state.schema}`,
    `- Command: ${state.command}`,
    `- Status: ${state.status}`,
    `- Phase: ${state.phase}`,
    `- Next action: ${state.next_action.action}`,
    `- Next command: \`${state.next_action.command.replaceAll('|', '\\|')}\``,
    '',
  ];
  if (state.run) {
    lines.push(
      '## Run',
      '',
      `- Run id: ${state.run.id}`,
      `- Workflow: ${state.run.workflow_name ?? 'unknown'}`,
      `- Run status: ${state.run.status ?? 'unknown'}`,
      `- Run conclusion: ${state.run.conclusion ?? 'none'}`,
      `- Head SHA: ${state.run.head_sha ?? 'unknown'}`,
      `- Current job: ${state.current_step?.job_name ?? 'none'}`,
      `- Current step: ${state.current_step?.step_name ?? 'none'}`,
      `- Elapsed seconds: ${state.elapsed?.seconds ?? 'unknown'}`,
      `- Release SLA: ${state.budget?.run_sla_status ?? 'unknown'} (${state.budget?.run_sla_profile ?? 'none'})`,
      `- Stale: ${String(state.is_stale ?? false)}`,
      `- Primary blocker: ${state.primary_blocker ? state.primary_blocker.reason : 'none'}`,
      '',
    );
  }
  if (state.cohort_plan) {
    lines.push(
      '## Cohort',
      '',
      `- Version: ${state.cohort_plan.version}`,
      `- Tag: ${state.cohort_plan.tag}`,
      `- App commit: ${state.cohort_plan.app_commit}`,
      `- Shell ref: ${state.cohort_plan.shell_ref}`,
      `- Shell SHA: ${state.cohort_plan.cohort_lock.shell.resolved_sha}`,
      `- Framework ref: ${state.cohort_plan.framework_ref}`,
      `- Framework SHA: ${state.cohort_plan.cohort_lock.framework.resolved_sha}`,
      '',
    );
  }
  if (state.operator_guidance) {
    lines.push(
      '## Operator guidance',
      '',
      `- Currentness freeze: ${state.operator_guidance.currentness_freeze.rule}`,
      `- Controller input source: ${state.operator_guidance.currentness_freeze.controller_input_source}`,
      `- Direct workflow dispatch allowed: ${String(state.operator_guidance.currentness_freeze.direct_workflow_dispatch_allowed)}`,
      `- Post-owner receipt fast path: ${state.operator_guidance.post_owner_receipt_fast_path.default_action}`,
      `- Owner candidate verify command: \`${state.operator_guidance.post_owner_receipt_fast_path.verify_command.replaceAll('|', '\\|')}\``,
      `- Stable controller command: \`${state.operator_guidance.post_owner_receipt_fast_path.controller_command.replaceAll('|', '\\|')}\``,
      `- Desktop release rebuild required: ${String(state.operator_guidance.post_owner_receipt_fast_path.desktop_release_rebuild_required)}`,
      '',
    );
  }
  if (state.session) {
    lines.push(
      '## Release session',
      '',
      `- Session id: ${state.session.id}`,
      `- Current authority run: ${state.session.current_authority_run.id}`,
      `- Failed-run tax: ${state.session.failed_run_tax.action}${state.session.failed_run_tax.primary_blocker ? ` - ${state.session.failed_run_tax.primary_blocker.reason}` : ''}`,
      `- Typed next action: ${state.session.typed_next_action.action}`,
      `- Truth boundary: ${state.session.truth_boundary}`,
      '',
    );
  }
  if (state.diagnostic_actions) {
    lines.push('| Diagnostic action | Controller | Mutation authorized | Command |');
    lines.push('| --- | --- | --- | --- |');
    for (const action of state.diagnostic_actions) {
      lines.push(`| ${action.id} | ${action.controller} | ${String(action.mutation_authorized)} | \`${action.command.replaceAll('|', '\\|')}\` |`);
    }
    lines.push('');
  }
  writeLinesFile(filePath, lines);
}

function writeOperatorState(options: OperatorOutputOptions, state: OperatorState): void {
  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
  if (options.sessionOutput && state.session) {
    fs.mkdirSync(path.dirname(options.sessionOutput), { recursive: true });
    fs.writeFileSync(options.sessionOutput, `${JSON.stringify(state.session, null, 2)}\n`, 'utf8');
  }
  writeOperatorMarkdown(options.markdown, state);
}

function formatOperatorSummary(state: OperatorState): string {
  const lines = [
    'Release operator status',
    `Status: ${state.status}`,
    `Phase: ${state.phase}`,
  ];
  if (state.run) {
    lines.push(
      `Run: ${state.run.id}`,
      `Workflow: ${state.run.workflow_name ?? 'unknown'}`,
      `Run state: ${state.run.status ?? 'unknown'} / ${state.run.conclusion ?? 'none'}`,
      `Head: ${state.run.head_sha ?? 'unknown'}`,
    );
  }
  if (state.current_step) {
    lines.push(
      `Current job: ${state.current_step.job_name ?? 'none'}`,
      `Current step: ${state.current_step.step_name ?? 'none'}`,
      `Waiting: ${String(state.current_step.waiting)}`,
    );
  }
  if (state.elapsed) {
    lines.push(`Elapsed: ${state.elapsed.seconds ?? 'unknown'}s`);
  }
  if (state.budget) {
    lines.push(
      `Budget: ${state.budget.status}`,
      `Current step elapsed: ${state.budget.current_step_elapsed_seconds ?? 'unknown'}s`,
      `Run updated age: ${state.budget.run_updated_age_seconds ?? 'unknown'}s`,
      `Release SLA: ${state.budget.run_sla_status} (${state.budget.run_sla_profile ?? 'none'})`,
    );
  }
  if (state.session) {
    lines.push(
      `Failed-run tax: ${state.session.failed_run_tax.action}${state.session.failed_run_tax.primary_blocker ? ` - ${state.session.failed_run_tax.primary_blocker.reason}` : ''}`,
    );
  }
  lines.push(
    `Primary blocker: ${state.primary_blocker ? state.primary_blocker.reason : 'none'}`,
    `Next action: ${state.next_action.action}`,
    `Next command: ${state.next_action.command}`,
  );
  return `${lines.join('\n')}\n`;
}

function writeStdout(state: OperatorState, format: 'json' | 'summary' = 'json'): void {
  if (format === 'summary') {
    process.stdout.write(formatOperatorSummary(state));
    return;
  }
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
}

function main(): void {
  const [subcommand, ...args] = process.argv.slice(2);
  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    usage();
    process.exit(subcommand ? 0 : 1);
  }
  if (subcommand === 'plan') {
    const { cohort, operator } = parsePlanArgs(args);
    const plan = buildReleaseCohortPlan(cohort);
    const state = buildPlanState(plan);
    writeOperatorState(operator, state);
    writeStdout(state);
    return;
  }
  if (subcommand === 'diagnose-vm') {
    const options = parseDiagnoseVmArgs(args);
    const state = buildDiagnoseVmState(options);
    writeOperatorState(options, state);
    writeStdout(state);
    return;
  }
  if (subcommand === 'status') {
    const options = parseStatusArgs(args);
    const state = buildStatusState(options);
    writeOperatorState(options, state);
    writeStdout(state, options.stdoutFormat);
    return;
  }
  throw new Error(`Unknown subcommand: ${subcommand}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
