import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { releaseBoundaryChecks, releaseWorkflowPaths } from './release-checks.ts';

const workflowMutationCommandPattern = /gh\s+api\s+--method\s+(?:POST|PATCH|PUT|DELETE)|gh\s+workflow\s+run|gh\s+run\s+(?:cancel|rerun)|gh\s+release\s+(?:create|edit|upload|delete)|git\b[^\n]*\s(?:push|tag)\b|\bopl\s+release\s+(?:freeze|operation\s+admit|build|verify|publish|reconcile)\b|publish-(?:release|full-addon)\.ts|cleanup-draft-release-candidates\.ts|curl\b[^\n]*(?:--request|-X)\s*(?:POST|PATCH|PUT|DELETE)/;
const retiredLiveAuthorityPattern = /release[_ -]broker|verify-release-broker|verify-release-session-lease|release_attempt_id|release_mutation_payload_sha256|pre_api_admission_receipt_base64|release[_ -]session[_ -]lease/i;
const exactReadPermissions = { contents: 'read', actions: 'read' } as const;
const exactStableEntryPermissions = { contents: 'write', actions: 'read' } as const;

export const stableReleaseActionPaths = [...new Set([
  '.github/actions/setup-active-shell-deps/action.yml',
  '.github/workflows/opl-updater-upgrade-vm.yml',
  ...releaseWorkflowPaths,
])];

function exactObject(value: unknown, expected: Record<string, unknown>): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = value as Record<string, unknown>;
  return Object.keys(actual).length === Object.keys(expected).length &&
    Object.entries(expected).every(([name, expectedValue]) => actual[name] === expectedValue);
}

function jobRuns(job: Record<string, any> | undefined): string {
  return (Array.isArray(job?.steps) ? job.steps as Array<Record<string, any>> : [])
    .map((step) => typeof step.run === 'string' ? step.run : '')
    .join('\n');
}

function workflowJobs(workflow: Record<string, any>): Record<string, Record<string, any>> {
  return workflow.jobs && typeof workflow.jobs === 'object'
    ? workflow.jobs as Record<string, Record<string, any>>
    : {};
}

function needsExactly(job: Record<string, any>, expected: string[]): boolean {
  const needs = typeof job.needs === 'string' ? [job.needs] : job.needs;
  return Array.isArray(needs) && needs.length === expected.length &&
    expected.every((name, index) => needs[index] === name);
}

function reportFailure(id: string, message: string): number {
  console.error(`FAIL ${id}: ${message}`);
  return 1;
}

function parseWorkflow(appRoot: string, relativePath: string, id: string): {
  workflow: Record<string, any>;
  text: string;
} | null {
  const absolutePath = path.join(appRoot, relativePath);
  try {
    const text = fs.readFileSync(absolutePath, 'utf8');
    return { workflow: parseYaml(text) as Record<string, any>, text };
  } catch (error) {
    reportFailure(id, `${relativePath} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const stableEntrySpecs = {
  standard: {
    operation: 'standard',
    workflow: './.github/workflows/_release-bundle.yml',
    if: "${{ needs.admission.outputs.operation == 'standard' }}",
    requiredInputs: {
      mode: 'execute',
      operation: 'standard',
      channel: 'stable',
      version: '${{ needs.admission.outputs.version }}',
      include_full: '${{ fromJSON(needs.admission.outputs.include_full) }}',
      app_ref: '${{ needs.admission.outputs.app_ref }}',
      shell_ref: '${{ needs.admission.outputs.shell_ref }}',
      framework_ref: '${{ needs.admission.outputs.framework_ref }}',
      operation_started_at: '${{ needs.admission.outputs.operation_started_at }}',
      operation_deadline_at: '${{ needs.admission.outputs.operation_deadline_at }}',
    },
  },
  'resume-standard': {
    operation: 'resume_standard',
    workflow: './.github/workflows/_release-standard-publish.yml',
    if: "${{ needs.admission.outputs.operation == 'resume_standard' }}",
    requiredInputs: {
      mode: 'execute',
      operation: 'resume_standard',
      source_run_id: '${{ needs.admission.outputs.source_run_id }}',
      source_artifact: '${{ needs.admission.outputs.source_artifact }}',
    },
  },
  'append-full': {
    operation: 'append_full',
    workflow: './.github/workflows/_release-full-addon.yml',
    if: "${{ needs.admission.outputs.operation == 'append_full' }}",
    requiredInputs: {
      mode: 'execute',
      operation: 'append_full',
      source_run_id: '${{ needs.admission.outputs.source_run_id }}',
      source_artifact: '${{ needs.admission.outputs.source_artifact }}',
      operation_started_at: '${{ needs.admission.outputs.operation_started_at }}',
      operation_deadline_at: '${{ needs.admission.outputs.operation_deadline_at }}',
    },
  },
} as const;

export function validateStableReleaseControlPlane(appRoot: string): number {
  const id = 'stable_release_control_plane';
  const parsed = parseWorkflow(appRoot, '.github/workflows/release-stable.yml', id);
  if (!parsed) return 1;
  const { workflow, text } = parsed;
  let failures = 0;

  if (JSON.stringify(Object.keys(workflow.on ?? {})) !== JSON.stringify(['workflow_dispatch'])) {
    failures += reportFailure(id, 'release-stable.yml must expose only workflow_dispatch');
  }
  const operationInput = workflow.on?.workflow_dispatch?.inputs?.operation;
  const expectedOperations = ['standard', 'resume_standard', 'append_full'];
  if (operationInput?.type !== 'choice' || operationInput?.required !== true ||
      JSON.stringify(operationInput?.options) !== JSON.stringify(expectedOperations)) {
    failures += reportFailure(id, `operation choices must be exactly ${expectedOperations.join(', ')}`);
  }
  if (workflow.concurrency?.group !== 'opl-release-bundle-global' ||
      workflow.concurrency?.['cancel-in-progress'] !== false) {
    failures += reportFailure(id, 'all Stable operations must share fixed concurrency with cancel-in-progress=false');
  }
  if (!exactObject(workflow.permissions, exactReadPermissions)) {
    failures += reportFailure(id, 'top-level Stable permissions must be exactly contents:read/actions:read');
  }
  if (retiredLiveAuthorityPattern.test(text)) {
    failures += reportFailure(id, 'Stable entry must not depend on retired broker/session/lease authority');
  }

  const jobs = workflowJobs(workflow);
  const expectedJobs = ['admission', ...Object.keys(stableEntrySpecs)].sort();
  if (JSON.stringify(Object.keys(jobs).sort()) !== JSON.stringify(expectedJobs)) {
    failures += reportFailure(id, `jobs must be exactly ${expectedJobs.join(', ')}`);
  }
  const admission = jobs.admission;
  const admissionRun = jobRuns(admission);
  if (!admission || !exactObject(admission.permissions, exactReadPermissions)) {
    failures += reportFailure(id, 'admission must have only contents:read/actions:read');
  }
  if (workflowMutationCommandPattern.test(admissionRun)) {
    failures += reportFailure(id, 'admission must remain mutation-free');
  }
  for (const binding of [
    'test "$GITHUB_RUN_ATTEMPT" = 1',
    'actions/runs/$GITHUB_RUN_ID" --jq .created_at',
    'release-operation-deadline.ts resolve',
    '--started-at "$operation_started_at"',
    'operation_deadline_at=',
  ]) {
    if (!admissionRun.includes(binding)) {
      failures += reportFailure(id, `admission is missing immutable attempt/deadline binding ${binding}`);
    }
  }
  if (/Date\.now\(\).*operation_started_at|operation_started_at=.*date/i.test(admissionRun)) {
    failures += reportFailure(id, 'operation start must come from immutable Actions created_at');
  }
  if (!admissionRun.includes('if [ "$OPERATION" = standard ] || [ "$OPERATION" = append_full ]; then')) {
    failures += reportFailure(id, 'only new standard and append_full operations may resolve a fresh operation window');
  }

  for (const [jobId, spec] of Object.entries(stableEntrySpecs)) {
    const job = jobs[jobId];
    if (!job) continue;
    if (!needsExactly(job, ['admission']) || job.if !== spec.if) {
      failures += reportFailure(id, `${jobId} must be selected only by the admitted ${spec.operation} operation`);
    }
    if (job.uses !== spec.workflow || Object.prototype.hasOwnProperty.call(job, 'steps')) {
      failures += reportFailure(id, `${jobId} must be a step-free call to ${spec.workflow}`);
    }
    if (!exactObject(job.permissions, exactStableEntryPermissions)) {
      failures += reportFailure(id, `${jobId} permissions must be exactly contents:write/actions:read`);
    }
    if (job.secrets !== 'inherit') {
      failures += reportFailure(id, `${jobId} must pass release secrets only through the reusable boundary`);
    }
    const withInputs = job.with && typeof job.with === 'object'
      ? job.with as Record<string, unknown>
      : {};
    for (const [name, expected] of Object.entries(spec.requiredInputs)) {
      if (withInputs[name] !== expected) {
        failures += reportFailure(id, `${jobId} must bind ${name} to the admitted value`);
      }
    }
    if (jobId === 'resume-standard' && (
      Object.prototype.hasOwnProperty.call(withInputs, 'operation_started_at')
      || Object.prototype.hasOwnProperty.call(withInputs, 'operation_deadline_at')
    )) {
      failures += reportFailure(id, 'resume-standard must inherit the exact Standard control from its checkpoint');
    }
    if (Object.keys(withInputs).some((name) => retiredLiveAuthorityPattern.test(name))) {
      failures += reportFailure(id, `${jobId} must not forward broker/session/lease inputs`);
    }
  }
  return failures;
}

function validateReusableCall(
  id: string,
  jobs: Record<string, Record<string, any>>,
  jobId: string,
  workflowPath: string,
  expectedPermissions?: Record<string, unknown>,
): number {
  const job = jobs[jobId];
  if (!job || job.uses !== workflowPath || Object.prototype.hasOwnProperty.call(job, 'steps')) {
    return reportFailure(id, `${jobId} must be a step-free call to ${workflowPath}`);
  }
  if (expectedPermissions && !exactObject(job.permissions, expectedPermissions)) {
    return reportFailure(id, `${jobId} has broader or incomplete permissions`);
  }
  return 0;
}

export function validateReleaseBundleTopology(appRoot: string): number {
  const id = 'release_bundle_topology';
  const bundle = parseWorkflow(appRoot, '.github/workflows/_release-bundle.yml', id);
  const standard = parseWorkflow(appRoot, '.github/workflows/_release-standard-publish.yml', id);
  const full = parseWorkflow(appRoot, '.github/workflows/_release-full-addon.yml', id);
  if (!bundle || !standard || !full) return [bundle, standard, full].filter((value) => !value).length;
  let failures = 0;

  for (const [name, parsed] of Object.entries({ bundle, standard, full })) {
    if (JSON.stringify(Object.keys(parsed.workflow.on ?? {})) !== JSON.stringify(['workflow_call'])) {
      failures += reportFailure(id, `${name} workflow must expose only workflow_call`);
    }
    const writes = Object.entries(parsed.workflow.permissions ?? {}).filter(([, value]) => value === 'write');
    if (writes.length > 0) {
      failures += reportFailure(id, `${name} workflow must not grant top-level write permissions`);
    }
    if (retiredLiveAuthorityPattern.test(parsed.text)) {
      failures += reportFailure(id, `${name} workflow still depends on retired broker/session/lease authority`);
    }
    if (parsed.workflow.on?.workflow_call?.inputs?.mode?.default !== 'execute') {
      failures += reportFailure(id, `${name} workflow must expose an explicit execute/canary mode boundary`);
    }
  }

  const bundleJobs = workflowJobs(bundle.workflow);
  if (bundle.workflow.on?.workflow_call?.inputs?.operation?.default !== 'standard') {
    failures += reportFailure(id, 'Bundle workflow operation must be standard');
  }
  for (const [jobId, command] of [
    ['freeze', 'opl release freeze'],
    ['checkpoint-standard', 'opl release build'],
    ['checkpoint-standard', 'opl release verify'],
    ['checkpoint-standard', 'opl release checkpoint export'],
  ]) {
    if (!jobRuns(bundleJobs[jobId]).includes(command)) {
      failures += reportFailure(id, `_release-bundle.yml ${jobId} is missing ${command}`);
    }
  }
  failures += validateReusableCall(id, bundleJobs, 'standard-build', './.github/workflows/_build-reusable.yml');
  failures += validateReusableCall(id, bundleJobs, 'standard-qualification', './.github/workflows/opl-first-run-vm.yml');
  failures += validateReusableCall(
    id,
    bundleJobs,
    'publish-standard',
    './.github/workflows/_release-standard-publish.yml',
    exactStableEntryPermissions,
  );
  if (/\bopl\s+release\s+(?:publish|reconcile|status)\b/.test(bundle.text)) {
    failures += reportFailure(id, '_release-bundle.yml must delegate publish/reconcile/status to Standard publish');
  }

  const standardJobs = workflowJobs(standard.workflow);
  for (const command of ['opl release publish', 'opl release reconcile', 'opl release status']) {
    if (!standard.text.includes(command)) {
      failures += reportFailure(id, `_release-standard-publish.yml is missing ${command}`);
    }
  }
  if (/\bopl\s+release\s+(?:freeze|build|verify)\b/.test(standard.text)) {
    failures += reportFailure(id, '_release-standard-publish.yml must not rebuild or reverify Bundle bytes');
  }
  for (const [jobId, workflowPath] of [
    ['updater-upgrade-qualification', './.github/workflows/opl-updater-upgrade-vm.yml'],
    ['updater-upgrade-qualification-highest', './.github/workflows/opl-updater-upgrade-vm.yml'],
    ['homebrew-standard-vm', './.github/workflows/opl-first-run-vm.yml'],
  ]) {
    failures += validateReusableCall(id, standardJobs, jobId, workflowPath, exactReadPermissions);
  }
  for (const jobId of [
    'publish-standard-nonlatest',
    'publish-homebrew-standard',
    'homebrew-standard-readback',
    'activate-latest',
  ]) {
    if (!standardJobs[jobId]) failures += reportFailure(id, `_release-standard-publish.yml is missing ${jobId}`);
  }
  for (const jobId of ['publish-standard-nonlatest', 'activate-latest']) {
    const job = standardJobs[jobId];
    if (job && (job.environment !== 'release-stable' ||
        !exactObject(job.permissions, exactStableEntryPermissions))) {
      failures += reportFailure(id, `${jobId} must use release-stable with minimal GitHub write permissions`);
    }
  }

  const fullJobs = workflowJobs(full.workflow);
  if (full.workflow.on?.workflow_call?.inputs?.operation?.default !== 'append_full') {
    failures += reportFailure(id, 'Full add-on workflow operation must be append_full');
  }
  for (const jobId of [
    'restore-standard',
    'full-build',
    'full-qualification',
    'checkpoint-full',
    'publish-full',
  ]) {
    if (!fullJobs[jobId]) failures += reportFailure(id, `_release-full-addon.yml is missing ${jobId}`);
  }
  for (const retiredJobId of ['publish-homebrew-full', 'homebrew-full-vm', 'homebrew-full-readback']) {
    if (fullJobs[retiredJobId]) {
      failures += reportFailure(id, `_release-full-addon.yml must not retain ${retiredJobId}`);
    }
  }
  if (fullJobs['full-build']) {
    failures += validateReusableCall(
      id,
      fullJobs,
      'full-build',
      './.github/workflows/full-first-install-release.yml',
    );
  }
  if (fullJobs['full-qualification']) {
    failures += validateReusableCall(
      id,
      fullJobs,
      'full-qualification',
      './.github/workflows/opl-first-run-vm.yml',
    );
  }
  if (fullJobs['publish-full'] && (fullJobs['publish-full'].environment !== 'release-stable' ||
      !exactObject(fullJobs['publish-full'].permissions, exactStableEntryPermissions))) {
    failures += reportFailure(id, 'publish-full must use release-stable with minimal GitHub write permissions');
  }
  if (standardUpdaterOrLatest(full.text)) {
    failures += reportFailure(id, 'append_full must not qualify Standard updater or activate Latest');
  }
  if (/publish-homebrew-full|homebrew-full|update-homebrew-tap|OPL_HOMEBREW_TAP_TOKEN|tap-source|Casks\/one-person-lab(?:-full)?\.rb|git\b[^\n]*\bpush\b/.test(full.text)) {
    failures += reportFailure(id, 'append_full must not update or push any Homebrew Cask');
  }

  const homebrewStandardRuns = jobRuns(standardJobs['publish-homebrew-standard']);
  for (const required of [
    'opl_homebrew_tap_cas_plan.v1',
    'inspect_only',
    'expected-current-cask-sha256',
    'idempotent_concurrent',
    'new_release_revision_required',
    'push_exit_status',
    'homebrew_remote_target',
    'active_unknown_markers',
    'prior-attempt-id',
    'publication-scope external_target',
    'opl release status',
    'opl release reconcile',
    'homebrew-unknown-checkpoint',
  ]) {
    if (!homebrewStandardRuns.includes(required)) {
      failures += reportFailure(id, `Standard Homebrew CAS is missing ${required}`);
    }
  }
  if ((homebrewStandardRuns.match(/git -C tap-source push --no-force/g) ?? []).length !== 1) {
    failures += reportFailure(id, 'Standard Homebrew must have exactly one non-force push call');
  }
  if (/for attempt in 1 2 3|three read-only reconciliations/.test(homebrewStandardRuns)) {
    failures += reportFailure(id, 'Standard Homebrew must defer unknown outcomes to one Framework marker/status/exact-reconcile path, not an App-local three-pass state machine');
  }
  return failures;
}

function standardUpdaterOrLatest(text: string): boolean {
  return text.includes('uses: ./.github/workflows/opl-updater-upgrade-vm.yml') ||
    /^\s*activate-latest:/m.test(text) ||
    /--latest(?:\s+|=)(?:true|1)/.test(text);
}

const canaryReusableCalls = {
  standard: './.github/workflows/_release-bundle.yml',
  'resume-standard': './.github/workflows/_release-standard-publish.yml',
  'append-full': './.github/workflows/_release-full-addon.yml',
  'nested-standard-build': './.github/workflows/_build-reusable.yml',
  'nested-standard-qualification': './.github/workflows/opl-first-run-vm.yml',
  'nested-updater-qualification': './.github/workflows/opl-updater-upgrade-vm.yml',
  'nested-full-build': './.github/workflows/full-first-install-release.yml',
} as const;

export function validateReleaseBundleCanaryTopology(appRoot: string): number {
  const id = 'release_bundle_canary_topology';
  const parsed = parseWorkflow(appRoot, '.github/workflows/release-bundle-canary.yml', id);
  if (!parsed) return 1;
  const { workflow, text } = parsed;
  let failures = 0;
  if (Object.prototype.hasOwnProperty.call(workflow.on ?? {}, 'workflow_dispatch')) {
    failures += reportFailure(id, 'Canary must not expose workflow_dispatch');
  }
  if (!exactObject(workflow.permissions, exactReadPermissions)) {
    failures += reportFailure(id, 'Canary permissions must be exactly contents:read/actions:read');
  }
  if (/^\s*secrets:/m.test(text) || workflowMutationCommandPattern.test(text)) {
    failures += reportFailure(id, 'Canary must not receive secrets or contain mutation commands');
  }

  const jobs = workflowJobs(workflow);
  for (const [jobId, workflowPath] of Object.entries(canaryReusableCalls)) {
    const job = jobs[jobId];
    failures += validateReusableCall(id, jobs, jobId, workflowPath, exactReadPermissions);
    if (!job) continue;
    if (job.secrets !== undefined || job.with?.mode !== 'canary') {
      failures += reportFailure(id, `${jobId} must start in canary mode without secrets`);
    }
    if (Object.keys(job.with ?? {}).some((name) => retiredLiveAuthorityPattern.test(name))) {
      failures += reportFailure(id, `${jobId} must not forward broker/session/lease inputs`);
    }

    const calleePath = workflowPath.replace('./', '');
    const callee = parseWorkflow(appRoot, calleePath, id);
    if (!callee) {
      failures += 1;
      continue;
    }
    const calleeJobs = workflowJobs(callee.workflow);
    const startup = calleeJobs['startup-canary'];
    if (!callee.workflow.on?.workflow_call || !startup ||
        typeof startup.if !== 'string' || !startup.if.includes("inputs.mode == 'canary'") ||
        !Array.isArray(startup.steps) || startup.steps.length === 0) {
      failures += reportFailure(id, `${calleePath} must expose a real startup-canary job`);
    }
    const topWrites = Object.values(callee.workflow.permissions ?? {}).filter((value) => value === 'write');
    if (topWrites.length > 0) {
      failures += reportFailure(id, `${calleePath} must not request top-level write permission`);
    }
  }
  return failures;
}

function validateExactActionPins(
  workflowPath: string,
  jobId: string,
  steps: Array<Record<string, any>>,
): number {
  let failures = 0;
  for (const [stepIndex, step] of steps.entries()) {
    if (typeof step.uses !== 'string' || step.uses.startsWith('./')) continue;
    if (!/@[0-9a-f]{40}$/.test(step.uses)) {
      console.error(`FAIL workflow_dispatch_write_authority: ${workflowPath} privileged job ${jobId} step ${stepIndex + 1} must pin ${step.uses} to an exact commit`);
      failures += 1;
    }
  }
  return failures;
}

export function runReleaseBoundaryTextChecks(appRoot: string): number {
  let failures = 0;

  for (const check of releaseBoundaryChecks) {
    const absolutePath = path.join(appRoot, check.file);
    if (check.retired) {
      if (fs.existsSync(absolutePath)) {
        console.error(`FAIL ${check.id}: ${check.file} is retired and must not exist`);
        failures += 1;
      }
      continue;
    }
    if (!fs.existsSync(absolutePath)) {
      console.error(`FAIL ${check.id}: missing ${check.file}`);
      failures += 1;
      continue;
    }
    const text = fs.readFileSync(absolutePath, 'utf8');
    for (const needle of check.required ?? []) {
      if (!text.includes(needle)) {
        console.error(`FAIL ${check.id}: ${check.file} missing ${needle}`);
        failures += 1;
      }
    }
    for (const needle of check.forbidden ?? []) {
      if (text.includes(needle)) {
        console.error(`FAIL ${check.id}: ${check.file} still contains ${needle}`);
        failures += 1;
      }
    }
  }

  return failures;
}

export function validateWorkflowNode24Policy(appRoot: string): number {
  let failures = 0;

  for (const workflowPath of releaseWorkflowPaths) {
    const absolutePath = path.join(appRoot, workflowPath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`FAIL actions_node24_runtime_policy: missing ${workflowPath}`);
      failures += 1;
      continue;
    }
    const text = fs.readFileSync(absolutePath, 'utf8');
    if (!/\nenv:\n(?:  [A-Z0-9_]+: .+\n)*  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true\n/.test(text)) {
      console.error(
        `FAIL actions_node24_runtime_policy: ${workflowPath} must declare FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true in top-level env`,
      );
      failures += 1;
    }
  }

  return failures;
}

export function validateStableReleaseActionPinPolicy(appRoot: string): number {
  let failures = 0;
  for (const relativePath of stableReleaseActionPaths) {
    const absolutePath = path.join(appRoot, relativePath);
    let document: Record<string, any>;
    try {
      document = parseYaml(fs.readFileSync(absolutePath, 'utf8')) as Record<string, any>;
    } catch (error) {
      console.error(`FAIL stable_release_action_pin_policy: ${relativePath} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
      failures += 1;
      continue;
    }
    const steps = relativePath.includes('/actions/')
      ? (Array.isArray(document.runs?.steps) ? document.runs.steps as Array<Record<string, any>> : [])
      : Object.values(document.jobs ?? {}).flatMap((jobValue) => {
          const job = jobValue as Record<string, any>;
          return Array.isArray(job.steps) ? job.steps as Array<Record<string, any>> : [];
        });
    for (const [stepIndex, step] of steps.entries()) {
      if (typeof step.uses !== 'string' || step.uses.startsWith('./')) continue;
      if (!/@[0-9a-f]{40}$/.test(step.uses)) {
        console.error(`FAIL stable_release_action_pin_policy: ${relativePath} step ${stepIndex + 1} must pin ${step.uses} to an exact commit`);
        failures += 1;
      }
    }
  }
  return failures;
}

export function validateWorkflowDispatchWriteAuthority(appRoot: string): number {
  let failures = validateStableReleaseControlPlane(appRoot) +
    validateReleaseBundleTopology(appRoot) +
    validateReleaseBundleCanaryTopology(appRoot);
  const stableWorkflowPath = '.github/workflows/release-stable.yml';
  const stableEntryJobs = new Set(Object.keys(stableEntrySpecs));
  const workflowDirectory = path.join(appRoot, '.github', 'workflows');
  const workflowPaths = fs.readdirSync(workflowDirectory)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => `.github/workflows/${name}`);
  for (const workflowPath of workflowPaths) {
    const text = fs.readFileSync(path.join(appRoot, workflowPath), 'utf8');
    let workflow: Record<string, any>;
    try {
      workflow = parseYaml(text) as Record<string, any>;
    } catch (error) {
      console.error(`FAIL workflow_dispatch_write_authority: ${workflowPath} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
      failures += 1;
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(workflow?.on ?? {}, 'workflow_dispatch')) continue;
    const topPermissions = workflow.permissions && typeof workflow.permissions === 'object' ? workflow.permissions : {};
    const topWrites = Object.entries(topPermissions).filter(([, value]) => value === 'write').map(([key]) => key);
    if (workflowPath === stableWorkflowPath && topWrites.length > 0) {
      console.error(`FAIL workflow_dispatch_write_authority: ${workflowPath} grants top-level write permissions (${topWrites.join(',')}); use job-level least privilege`);
      failures += 1;
    }
    const jobs = workflow.jobs && typeof workflow.jobs === 'object' ? workflow.jobs : {};
    for (const [jobId, jobValue] of Object.entries(jobs)) {
      const job = jobValue as Record<string, any>;
      const permissions = job.permissions && typeof job.permissions === 'object' ? job.permissions : topPermissions;
      const writes = Object.entries(permissions).filter(([, value]) => value === 'write').map(([key]) => key);
      if (writes.length === 0) continue;
      const steps = Array.isArray(job.steps) ? job.steps as Array<Record<string, any>> : [];
      if (workflowPath === stableWorkflowPath && stableEntryJobs.has(jobId)) {
        if (job.uses && steps.length === 0 && exactObject(job.permissions, exactStableEntryPermissions)) {
          continue;
        }
        console.error(`FAIL workflow_dispatch_write_authority: ${workflowPath} job ${jobId} must be a step-free least-privilege reusable entry`);
        failures += 1;
        failures += validateExactActionPins(workflowPath, jobId, steps);
        continue;
      }
      if (workflowPath !== stableWorkflowPath) {
        console.error(`FAIL workflow_dispatch_write_authority: ${workflowPath} job ${jobId} has write permission outside the immutable Release Bundle entry`);
        failures += 1;
        continue;
      }
      console.error(`FAIL workflow_dispatch_write_authority: ${workflowPath} job ${jobId} is not one of the three Stable operation entries`);
      failures += 1;
      failures += validateExactActionPins(workflowPath, jobId, steps);
    }
  }
  return failures;
}
