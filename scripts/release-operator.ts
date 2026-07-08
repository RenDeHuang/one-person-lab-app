#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { runGitHubCli as runGh, writeLinesFile } from './release-file-helpers.ts';
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

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultRepo = 'gaofeng21cn/one-person-lab-app';
const commandMaxBuffer = 16 * 1024 * 1024;

type DiagnosticTarget = 'opl_first_run_vm' | 'desktop_release_diagnostics';
type JsonRecord = Record<string, unknown>;

type DiagnosticCommand = {
  id: DiagnosticTarget;
  publishes_release: false;
  dispatches_workflow: false;
  command: string;
};

type OperatorNextAction = {
  action:
    | 'follow_cohort_plan'
    | 'rerun_diagnostic_same_artifact'
    | 'repair_source_gate'
    | 'repair_webui_runtime_image'
    | 'repair_ghcr_publish_access'
    | 'inspect_primary_blocker'
    | 'inspect_current_step_progress'
    | 'start_new_cohort_from_current_main'
    | 'inspect_release_closeout_evidence'
    | 'wait_for_release_run_completion';
  command: string;
  reason: string;
  publishes_release?: false;
  dispatches_workflow?: false;
};

type OperatorGuidance = {
  currentness_freeze: {
    required_before_dispatch: true;
    dispatch_input_source: 'release_cohort_plan_or_lock';
    manual_long_sha_dispatch_recommended: false;
    post_freeze_drift_name: 'post-freeze drift';
    single_desktop_release_per_frozen_cohort: true;
    rule: string;
  };
  post_owner_receipt_fast_path: {
    default_action: 'verify_owner_candidate_record_then_dispatch_promote';
    verify_command: string;
    promote_workflow: '.github/workflows/desktop-release-promote.yml';
    desktop_release_rerun_required: false;
    rule: string;
  };
};

type OperatorStatus =
  | 'planned'
  | 'diagnostic_command_ready'
  | 'failed'
  | 'failed_gate_draining'
  | 'stale_candidate'
  | 'superseded'
  | 'cancelled'
  | 'ready_for_closeout_review'
  | 'waiting_for_run_completion';

type OperatorPhase =
  | 'release_plan_ready'
  | 'release_diagnostic_ready'
  | 'release_run_failed'
  | 'release_run_failed_draining'
  | 'release_run_stale_candidate'
  | 'release_run_superseded'
  | 'release_run_cancelled'
  | 'release_run_waiting'
  | 'release_closeout_review_ready';

type RunStatusSummary = {
  id: string;
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
  reason: string;
};

type ReleaseSessionManifest = {
  schema: 'opl_app_release_session_manifest.v1';
  id: string;
  generated_at: string;
  version: string;
  run_set: {
    current_run_id: string;
    runs: Array<{
      id: string;
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
  diagnostic_commands?: DiagnosticCommand[];
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
  operator_guidance?: OperatorGuidance;
  authority_boundary: {
    operator_can_publish_release: false;
    operator_can_write_runtime_truth: false;
    operator_can_dispatch_workflow_without_explicit_user_action: false;
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
  stdoutFormat: 'json' | 'summary';
};

function usage(): void {
  process.stdout.write(`Usage:
  npm run release:operator -- plan --version <version> --release-mode <mode>
  npm run release:operator -- diagnose-vm --version <version> --release-artifact-run-id <run-id>
  npm run release:operator -- status --run-id <id> --version <version> [--repo owner/name] [--expected-head <sha>]
  npm run release:operator -- status --run-json <path> [--expected-head <sha>]

Subcommands:
  plan          Generate release-operator-state.json/md with an embedded cohort plan.
  diagnose-vm  Generate suggested VM diagnostic workflow commands only; does not dispatch.
  status       Summarize a GitHub Actions run and recommend the next operator action.

Common options:
  --output <path>      Write release-operator-state.json.
  --markdown <path>    Write release-operator-state.md.
  --session-output <path>
                       Write release-session.json for status runs.
  --session-input <path>
                       Read an existing release-session.json before updating it.
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
  return {
    cohort: parseReleaseCohortPlanArgs(cohortArgs),
    operator: resolveOutputOptions(output),
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
  if (typeof values.output === 'string') parsed.output = values.output;
  if (typeof values.markdown === 'string') parsed.markdown = values.markdown;
  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.releaseArtifactRunId.trim()) {
    throw new Error('Pass --release-artifact-run-id <run-id> or set OPL_RELEASE_ARTIFACT_RUN_ID.');
  }
  return {
    ...parsed,
    ...resolveOutputOptions(parsed),
  };
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
  if (!parsed.runId.trim() && !parsed.runJsonPath.trim()) {
    throw new Error('Pass --run-id <id> or --run-json <path>.');
  }
  return {
    ...parsed,
    runJsonPath: parsed.runJsonPath ? path.resolve(parsed.runJsonPath) : '',
    sessionInput: parsed.sessionInput ? path.resolve(parsed.sessionInput) : '',
    ...resolveOutputOptions(parsed),
  };
}

function quoteField(value: string): string {
  return JSON.stringify(value);
}

function buildDiagnosticCommands(options: DiagnoseVmOptions): DiagnosticCommand[] {
  const releaseTag = options.version.trim() ? `v${options.version.trim()}` : '';
  const firstRunVm = [
    'gh workflow run "OPL GUI First-Run VM"',
    `--field release_tag=${quoteField(releaseTag)}`,
    `--field release_artifact_name=${quoteField(options.releaseArtifactName)}`,
    `--field release_artifact_run_id=${quoteField(options.releaseArtifactRunId)}`,
    `--field package_profile=${quoteField(options.packageProfile)}`,
    `--field diagnostic_scope=${quoteField(options.diagnosticScope)}`,
  ].join(' ');
  const diagnostics = [
    'gh workflow run desktop-release-diagnostics.yml',
    `--field opl_version=${quoteField(options.version)}`,
    `--field release_mode=${quoteField(options.releaseMode)}`,
    `--field diagnostic_scope=${quoteField(options.diagnosticScope)}`,
    `--field release_artifact_run_id=${quoteField(options.releaseArtifactRunId)}`,
    `--field release_artifact_name=${quoteField(options.releaseArtifactName)}`,
    `--field package_profile=${quoteField(options.packageProfile)}`,
    `--field build_standard_artifact=${String(options.buildStandardArtifact)}`,
    `--field run_vm_diagnostic=${String(options.runVmDiagnostic)}`,
  ].join(' ');
  return [
    {
      id: 'opl_first_run_vm',
      publishes_release: false,
      dispatches_workflow: false,
      command: firstRunVm,
    },
    {
      id: 'desktop_release_diagnostics',
      publishes_release: false,
      dispatches_workflow: false,
      command: diagnostics,
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

function buildOperatorGuidance(version: string): OperatorGuidance {
  return {
    currentness_freeze: {
      required_before_dispatch: true,
      dispatch_input_source: 'release_cohort_plan_or_lock',
      manual_long_sha_dispatch_recommended: false,
      post_freeze_drift_name: 'post-freeze drift',
      single_desktop_release_per_frozen_cohort: true,
      rule: 'Freeze App/Shell/Framework SHAs before dispatch. Remote movement after freeze is post-freeze drift: choose owner receipt plus promote for the frozen cohort, or freeze and dispatch a new cohort.',
    },
    post_owner_receipt_fast_path: {
      default_action: 'verify_owner_candidate_record_then_dispatch_promote',
      verify_command: ownerCandidateRecordVerifyCommand(version),
      promote_workflow: '.github/workflows/desktop-release-promote.yml',
      desktop_release_rerun_required: false,
      rule: 'When same-cohort evidence is complete and only the release-owner receipt was missing, verify the post-owner candidate record and dispatch the promote workflow; do not rerun desktop-release solely for owner metadata.',
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
    },
  };
}

function buildDiagnoseVmState(options: DiagnoseVmOptions): OperatorState {
  const diagnosticCommands = buildDiagnosticCommands(options);
  return {
    schema: 'opl_app_release_operator_state.v1',
    generated_at: new Date().toISOString(),
    command: 'diagnose-vm',
    status: 'diagnostic_command_ready',
    phase: 'release_diagnostic_ready',
    diagnostic_commands: diagnosticCommands,
    next_action: {
      action: 'rerun_diagnostic_same_artifact',
      command: diagnosticCommands[1].command,
      reason: 'Diagnose the same release artifact without publishing or writing runtime truth.',
    },
    operator_guidance: buildOperatorGuidance(options.version),
    authority_boundary: {
      operator_can_publish_release: false,
      operator_can_write_runtime_truth: false,
      operator_can_dispatch_workflow_without_explicit_user_action: false,
    },
  };
}

function timestampField(record: JsonRecord | null | undefined, camelKey: string, snakeKey?: string): string | null {
  return stringField(record, camelKey) ?? (snakeKey ? stringField(record, snakeKey) : null);
}

function idField(record: JsonRecord | null | undefined): string {
  const value = record?.databaseId ?? record?.database_id ?? record?.id ?? record?.run_id;
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return 'local';
}

function normalizeRunPayload(payload: unknown): JsonRecord {
  const record = asRecord(payload);
  if (!record) throw new Error('Run JSON must be an object.');
  return record;
}

function fetchRun(options: StatusOptions): JsonRecord {
  if (options.runJsonPath) return normalizeRunPayload(readJson(options.runJsonPath));
  const stdout = runGh([
    'run',
    'view',
    options.runId,
    '--repo',
    options.repo,
    '--json',
    [
      'databaseId',
      'status',
      'conclusion',
      'createdAt',
      'updatedAt',
      'startedAt',
      'headSha',
      'headBranch',
      'workflowName',
      'displayTitle',
      'event',
      'url',
      'jobs',
    ].join(','),
  ], 'Fetch release run status', {
    cwd: appRoot,
    maxBuffer: commandMaxBuffer,
    prefixErrorWithLabel: true,
  });
  return normalizeRunPayload(JSON.parse(stdout));
}

function normalizeSteps(job: JsonRecord): RunStatusSummary['jobs'][number]['steps'] {
  return asArray(job.steps)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => entry !== null)
    .map((step) => ({
      name: stringField(step, 'name') ?? stringField(step, 'displayName') ?? 'unknown',
      status: stringField(step, 'status'),
      conclusion: stringField(step, 'conclusion'),
      started_at: timestampField(step, 'startedAt', 'started_at'),
      completed_at: timestampField(step, 'completedAt', 'completed_at'),
    }));
}

function normalizeJobs(run: JsonRecord): RunStatusSummary['jobs'] {
  return asArray(run.jobs ?? run.workflow_jobs)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => entry !== null)
    .map((job) => ({
      name: stringField(job, 'name') ?? stringField(job, 'displayName') ?? 'unknown',
      status: stringField(job, 'status'),
      conclusion: stringField(job, 'conclusion'),
      started_at: timestampField(job, 'startedAt', 'started_at'),
      completed_at: timestampField(job, 'completedAt', 'completed_at'),
      steps: normalizeSteps(job),
    }));
}

function summarizeRun(run: JsonRecord, options: StatusOptions): RunStatusSummary {
  return {
    id: options.runId || idField(run),
    workflow_name: stringField(run, 'workflowName') ?? stringField(run, 'workflow_name') ?? stringField(run, 'name'),
    display_title: stringField(run, 'displayTitle') ?? stringField(run, 'display_title'),
    status: stringField(run, 'status'),
    conclusion: stringField(run, 'conclusion'),
    created_at: timestampField(run, 'createdAt', 'created_at'),
    started_at: timestampField(run, 'startedAt', 'started_at'),
    updated_at: timestampField(run, 'updatedAt', 'updated_at'),
    completed_at: timestampField(run, 'completedAt', 'completed_at'),
    head_sha: stringField(run, 'headSha') ?? stringField(run, 'head_sha'),
    head_branch: stringField(run, 'headBranch') ?? stringField(run, 'head_branch'),
    url: stringField(run, 'url'),
    jobs: normalizeJobs(run),
  };
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
    return 'rerun_diagnostic_same_artifact';
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

function sameArtifactVmDiagnosticCommand(options: StatusOptions, run: RunStatusSummary, blocker: PrimaryBlocker): string {
  const version = options.version.trim() || '<version>';
  const profile = inferVmDiagnosticProfile(run, blocker, version);
  return [
    'npm run release:operator -- diagnose-vm --',
    `--version ${quoteField(version)}`,
    '--release-mode refresh_existing',
    `--release-artifact-run-id ${quoteField(run.id)}`,
    `--release-artifact-name ${quoteField(profile.releaseArtifactName)}`,
    `--package-profile ${quoteField(profile.packageProfile)}`,
    '--diagnostic-scope release_gate',
    '--build-standard-artifact false',
    '--run-vm-diagnostic true',
  ].join(' ');
}

function phaseForStatus(status: OperatorStatus): OperatorPhase {
  if (status === 'planned') return 'release_plan_ready';
  if (status === 'diagnostic_command_ready') return 'release_diagnostic_ready';
  if (status === 'failed') return 'release_run_failed';
  if (status === 'failed_gate_draining') return 'release_run_failed_draining';
  if (status === 'stale_candidate') return 'release_run_stale_candidate';
  if (status === 'superseded') return 'release_run_superseded';
  if (status === 'cancelled') return 'release_run_cancelled';
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
      action: 'start_new_cohort_from_current_main',
      command: 'npm run release:operator -- plan --app-commit <current-origin-main-sha>',
      reason: `Run head ${run.head_sha ?? 'unknown'} does not match expected head ${options.expectedHead}.`,
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'superseded') {
    return {
      action: 'start_new_cohort_from_current_main',
      command: 'npm run release:operator -- plan --app-commit <current-origin-main-sha>',
      reason: `Cancelled run head ${run.head_sha ?? 'unknown'} does not match expected head ${options.expectedHead}; treat it as an old-cohort stopped run.`,
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'failed_gate_draining') {
    const action = classifyBlockerAction(blocker, run);
    return {
      action,
      command: action === 'rerun_diagnostic_same_artifact'
        ? sameArtifactVmDiagnosticCommand(options, run, blocker)
        : `gh run view ${run.id} --repo ${options.repo} --log-failed`,
      reason: action === 'rerun_diagnostic_same_artifact'
        ? `VM gate failed while the workflow is still ${run.status ?? 'running'}; run the same-artifact diagnostic instead of rerunning desktop-release. ${blocker?.reason ?? ''}`.trim()
        : `Primary blocker failed while the workflow is still ${run.status ?? 'running'}: ${blocker?.reason ?? 'A gate failed.'}`,
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'failed') {
    const action = classifyBlockerAction(blocker, run);
    return {
      action,
      command: action === 'rerun_diagnostic_same_artifact'
        ? sameArtifactVmDiagnosticCommand(options, run, blocker)
        : `gh run view ${run.id} --repo ${options.repo} --log-failed`,
      reason: action === 'rerun_diagnostic_same_artifact'
        ? `VM gate failed; run the same-artifact diagnostic instead of rerunning desktop-release. ${blocker?.reason ?? ''}`.trim()
        : blocker?.reason ?? `Run conclusion is ${run.conclusion ?? 'unknown'}.`,
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'cancelled') {
    return {
      action: 'inspect_primary_blocker',
      command: `gh run view ${run.id} --repo ${options.repo} --log-failed`,
      reason: blocker?.reason ?? 'Run was cancelled; inspect the cancellation owner or source gate before redispatch.',
      publishes_release: false,
      dispatches_workflow: false,
    };
  }
  if (status === 'ready_for_closeout_review') {
    const version = options.version.trim() || '<version>';
    return {
      action: 'inspect_release_closeout_evidence',
      command: `npm run release:closeout -- --version ${version} --run-id ${run.id} --repo ${options.repo}`,
      reason: options.version.trim()
        ? 'Run completed successfully; inspect closeout artifacts before any owner release decision. If only the same-cohort owner receipt is missing, verify the post-owner candidate record and dispatch desktop-release-promote.yml instead of rerunning desktop-release.'
        : 'Run completed successfully; inspect closeout artifacts before any owner release decision. Replace <version> with the release version. If only the same-cohort owner receipt is missing, verify the post-owner candidate record and dispatch desktop-release-promote.yml instead of rerunning desktop-release.',
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
    action: 'wait_for_release_run_completion',
    command: `npm run release:operator -- status --run-id ${run.id} --repo ${options.repo}`,
    reason: `Run is ${run.status ?? 'unknown'} with conclusion ${run.conclusion ?? 'none'}.`,
    publishes_release: false,
    dispatches_workflow: false,
  };
}

function buildStatusState(options: StatusOptions): OperatorState {
  const generatedAt = new Date().toISOString();
  const run = summarizeRun(fetchRun(options), options);
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
    operator_guidance: buildOperatorGuidance(options.version),
    authority_boundary: {
      operator_can_publish_release: false,
      operator_can_write_runtime_truth: false,
      operator_can_dispatch_workflow_without_explicit_user_action: false,
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
      `- Dispatch input source: ${state.operator_guidance.currentness_freeze.dispatch_input_source}`,
      `- Manual long-SHA dispatch recommended: ${String(state.operator_guidance.currentness_freeze.manual_long_sha_dispatch_recommended)}`,
      `- Post-owner receipt fast path: ${state.operator_guidance.post_owner_receipt_fast_path.default_action}`,
      `- Owner candidate verify command: \`${state.operator_guidance.post_owner_receipt_fast_path.verify_command.replaceAll('|', '\\|')}\``,
      `- Promote workflow: ${state.operator_guidance.post_owner_receipt_fast_path.promote_workflow}`,
      `- Desktop release rerun required: ${String(state.operator_guidance.post_owner_receipt_fast_path.desktop_release_rerun_required)}`,
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
  if (state.diagnostic_commands) {
    lines.push('| Diagnostic | Dispatches workflow | Publishes release | Command |');
    lines.push('| --- | --- | --- | --- |');
    for (const command of state.diagnostic_commands) {
      lines.push(`| ${command.id} | ${String(command.dispatches_workflow)} | ${String(command.publishes_release)} | \`${command.command.replaceAll('|', '\\|')}\` |`);
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
