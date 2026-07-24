import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { releaseBoundaryChecks, releaseWorkflowPaths } from './release-checks.ts';

const workflowMutationCommandPattern = /gh\s+api\s+--method\s+(?:POST|PATCH|PUT|DELETE)|gh\s+workflow\s+run|gh\s+run\s+(?:cancel|rerun)|gh\s+release\s+(?:create|edit|upload|delete)|git\b[^\n]*\s(?:push|tag)\b|\bopl\s+release\s+(?:freeze|operation\s+admit|build|verify|publish|reconcile)\b|publish-(?:release|full-addon)\.ts|cleanup-draft-release-candidates\.ts|curl\b[^\n]*(?:--request|-X)\s*(?:POST|PATCH|PUT|DELETE)/;
const retiredLiveAuthorityPattern = /release[_ -]broker|verify-release-broker|verify-release-session-lease|release_attempt_id|release_mutation_payload_sha256|pre_api_admission_receipt_base64|release[_ -]session[_ -]lease/i;
const exactReadPermissions = { contents: 'read', actions: 'read' } as const;
const exactStableEntryPermissions = { contents: 'write', actions: 'read' } as const;
const exactWebUiReadPermissions = { contents: 'read', actions: 'read', packages: 'read' } as const;
const exactWebUiCompileCeilingPermissions = {
  contents: 'read',
  actions: 'read',
  packages: 'write',
} as const;
const exactStableStandardPermissions = { contents: 'write', actions: 'read' } as const;
const exactWebUiPublishPermissions = { contents: 'read', packages: 'write' } as const;
const manualFullPreviewWorkflowPath = '.github/workflows/release-manual-full-preview.yml';
const manualFullPreviewMutationJob = 'mutate';
const webuiStablePromotionWorkflowPath = '.github/workflows/release-webui-stable.yml';
const webuiStablePromotionMutationJob = 'promote-webui-stable';
const webuiDevelopmentWorkflowPath = '.github/workflows/release-webui-development.yml';
const webuiDevelopmentPromotionWorkflowPath =
  '.github/workflows/release-webui-development-promote.yml';
const nativeWebuiFollowerWorkflowPath = '.github/workflows/release-native-webui-follower.yml';
const nativeWebuiCarrierWorkflowPath = '.github/workflows/_release-native-webui-carrier.yml';
const homebrewFullFollowerWorkflowPath = '.github/workflows/release-homebrew-full-follower.yml';
const homebrewFullPublisherWorkflowPath = '.github/workflows/_release-homebrew-full-publish.yml';
const exactWebuiStablePromotionPermissions = {
  actions: 'read',
  contents: 'read',
  packages: 'write',
} as const;

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

function requestsWritePermission(value: unknown): boolean {
  if (value === 'write-all') return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).some((permission) => permission === 'write');
}

type PermissionLevel = 'none' | 'read' | 'write';

function permissionLevel(value: unknown, name: string): PermissionLevel {
  if (value === 'read-all') return 'read';
  if (value === 'write-all') return 'write';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'none';
  const level = (value as Record<string, unknown>)[name];
  return level === 'read' || level === 'write' ? level : 'none';
}

function intersectPermission(
  caller: unknown,
  callee: unknown,
  name: string,
): PermissionLevel {
  const levels: PermissionLevel[] = ['none', 'read', 'write'];
  const callerLevel = permissionLevel(caller, name);
  const calleeLevel = callee === undefined ? callerLevel : permissionLevel(callee, name);
  return levels[Math.min(levels.indexOf(callerLevel), levels.indexOf(calleeLevel))];
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

export function isAuthorizedWebuiStablePromotionWriteJob(
  workflowPath: string,
  jobId: string,
  job: Record<string, any>,
): boolean {
  return workflowPath === webuiStablePromotionWorkflowPath
    && jobId === webuiStablePromotionMutationJob
    && needsExactly(job, ['admission'])
    && job.environment === 'release-stable'
    && exactObject(job.permissions, exactWebuiStablePromotionPermissions);
}

function isAuthorizedNativeWebuiWriteJob(
  workflowPath: string,
  jobId: string,
  job: Record<string, any>,
): boolean {
  if (
    workflowPath === nativeWebuiFollowerWorkflowPath
    && jobId === 'native-webui-carrier'
  ) {
    return job.uses === './.github/workflows/_release-native-webui-carrier.yml'
      && needsExactly(job, ['resolve-handoff'])
      && exactObject(job.permissions, exactReadPermissions)
      && job.with?.mode === 'readback';
  }
  return workflowPath === nativeWebuiCarrierWorkflowPath
    && jobId === 'publish-native-assets'
    && job.environment === 'release-stable'
    && exactObject(job.permissions, exactStableEntryPermissions);
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
    permissions: exactStableStandardPermissions,
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
    permissions: exactStableEntryPermissions,
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
    permissions: exactStableEntryPermissions,
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
    '--started-at "$operation_created_at"',
    'operation_started_at="$(jq -er .started_at release-operation-admission.json)"',
    'operation_deadline_at="$(jq -er .deadline_at release-operation-admission.json)"',
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
    if (!exactObject(job.permissions, spec.permissions)) {
      failures += reportFailure(
        id,
        jobId === 'standard'
          ? 'standard permissions must be exactly contents:write/actions:read without packages:write'
          : `${jobId} permissions must be exactly contents:write/actions:read without packages:write`,
      );
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

function validateReusablePermissionInheritance(
  id: string,
  name: string,
  workflow: Record<string, any>,
  inheritedMutationJobs: string[],
): number {
  let failures = 0;
  if (workflow.permissions !== undefined) {
    failures += reportFailure(
      id,
      `${name} must inherit its caller permission ceiling so read-only Canary and Stable use the same graph`,
    );
  }
  const mutationJobs = new Set(inheritedMutationJobs);
  for (const [jobId, job] of Object.entries(workflowJobs(workflow))) {
    if (mutationJobs.has(jobId)) {
      if (job.permissions !== undefined) {
        failures += reportFailure(
          id,
          `${name}:${jobId} must inherit the admitted caller permission instead of statically requesting write`,
        );
      }
      continue;
    }
    if (!exactObject(job.permissions, exactReadPermissions)) {
      failures += reportFailure(id, `${name}:${jobId} must explicitly downgrade to contents:read/actions:read`);
    }
  }
  return failures;
}

export function validateReleaseBundleTopology(appRoot: string): number {
  const id = 'release_bundle_topology';
  const bundle = parseWorkflow(appRoot, '.github/workflows/_release-bundle.yml', id);
  const standard = parseWorkflow(appRoot, '.github/workflows/_release-standard-publish.yml', id);
  const full = parseWorkflow(appRoot, '.github/workflows/_release-full-addon.yml', id);
  const webui = parseWorkflow(appRoot, '.github/workflows/_release-webui-carrier.yml', id);
  const webuiFollower = parseWorkflow(appRoot, '.github/workflows/release-webui-follower.yml', id);
  const webuiStable = parseWorkflow(appRoot, '.github/workflows/release-webui-stable.yml', id);
  if (!bundle || !standard || !full || !webui || !webuiFollower || !webuiStable) {
    return [bundle, standard, full, webui, webuiFollower, webuiStable]
      .filter((value) => !value).length;
  }
  let failures = 0;

  for (const [name, parsed] of Object.entries({ bundle, standard, full })) {
    if (JSON.stringify(Object.keys(parsed.workflow.on ?? {})) !== JSON.stringify(['workflow_call'])) {
      failures += reportFailure(id, `${name} workflow must expose only workflow_call`);
    }
    if (retiredLiveAuthorityPattern.test(parsed.text)) {
      failures += reportFailure(id, `${name} workflow still depends on retired broker/session/lease authority`);
    }
    if (parsed.workflow.on?.workflow_call?.inputs?.mode?.default !== 'execute') {
      failures += reportFailure(id, `${name} workflow must expose an explicit execute/canary mode boundary`);
    }
  }
  failures += validateReusablePermissionInheritance(
    id,
    'bundle',
    bundle.workflow,
    ['publish-standard', 'publish-native-webui'],
  );
  failures += validateReusablePermissionInheritance(
    id,
    'standard',
    standard.workflow,
    ['publish-standard-nonlatest', 'activate-latest'],
  );
  failures += validateReusablePermissionInheritance(id, 'full', full.workflow, ['publish-full']);

  const bundleJobs = workflowJobs(bundle.workflow);
  if (JSON.stringify(Object.keys(bundleJobs)) !== JSON.stringify([
    'startup-canary',
    'admission',
    'freeze',
    'standard-build',
    'standard-qualification',
    'checkpoint-standard',
    'prepare-native-webui',
    'publish-standard',
    'publish-native-webui',
  ])) {
    failures += reportFailure(id, 'Bundle jobs must contain only Desktop Standard plus the isolated Native additive sidecar');
  }
  if (bundle.workflow.on?.workflow_call?.inputs?.operation?.default !== 'standard') {
    failures += reportFailure(id, 'Bundle workflow operation must be standard');
  }
  if (!bundle.text.includes('Only Stable may execute the Release Bundle.') ||
      /resolveNightlyReleaseVersion|nightly-operation-request/.test(bundle.text)) {
    failures += reportFailure(id, 'Bundle execute mode must be Stable-only and contain no Nightly allocation or operation window');
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
  );
  failures += validateReusableCall(
    id,
    bundleJobs,
    'prepare-native-webui',
    './.github/workflows/_release-native-webui-carrier.yml',
    exactReadPermissions,
  );
  failures += validateReusableCall(
    id,
    bundleJobs,
    'publish-native-webui',
    './.github/workflows/_release-native-webui-carrier.yml',
  );
  if (
    !needsExactly(bundleJobs['prepare-native-webui'], ['freeze'])
    || !needsExactly(bundleJobs['publish-native-webui'], [
      'freeze',
      'checkpoint-standard',
      'prepare-native-webui',
      'publish-standard',
    ])
    || String(bundleJobs['publish-standard']?.needs) !== 'freeze,checkpoint-standard'
  ) {
    failures += reportFailure(id, 'Native preparation must run beside Standard, while Native publish waits for Latest without blocking it');
  }
  if (/\bopl\s+release\s+(?:publish|reconcile|status)\b/.test(bundle.text)) {
    failures += reportFailure(id, '_release-bundle.yml must delegate publish/reconcile/status to Standard publish');
  }
  const followerTriggers = webuiFollower.workflow.on ?? {};
  const followerJobs = workflowJobs(webuiFollower.workflow);
  if (JSON.stringify(Object.keys(followerTriggers)) !== JSON.stringify(['workflow_run']) ||
      JSON.stringify(followerTriggers.workflow_run?.workflows) !==
        JSON.stringify(['OPL Stable Release Bundle']) ||
      JSON.stringify(followerTriggers.workflow_run?.types) !== JSON.stringify(['completed']) ||
      Object.prototype.hasOwnProperty.call(followerTriggers, 'workflow_dispatch') ||
      !exactObject(webuiFollower.workflow.permissions, exactReadPermissions) ||
      JSON.stringify(Object.keys(followerJobs)) !==
        JSON.stringify(['resolve-handoff', 'webui-carrier', 'promote-webui-stable'])) {
    failures += reportFailure(id, 'WebUI follower must be an automatic, read-default workflow_run lane');
  }
  const followerCarrier = followerJobs['webui-carrier'];
  const followerPromotion = followerJobs['promote-webui-stable'];
  if (!followerCarrier ||
      followerCarrier.uses !== './.github/workflows/_release-webui-carrier.yml' ||
      !needsExactly(followerCarrier, ['resolve-handoff']) ||
      !exactObject(followerCarrier.permissions, exactWebUiCompileCeilingPermissions) ||
      followerCarrier.with?.mode !== 'execute') {
    failures += reportFailure(id, 'WebUI follower carrier must consume only the resolved exact handoff');
  }
  if (!followerPromotion ||
      followerPromotion.uses !== './.github/workflows/release-webui-stable.yml' ||
      !needsExactly(followerPromotion, ['resolve-handoff', 'webui-carrier']) ||
      !exactObject(followerPromotion.permissions, exactWebUiCompileCeilingPermissions) ||
      followerPromotion.with?.mode !== 'execute' ||
      followerPromotion.with?.stable_authority_run_id !==
        '${{ needs.resolve-handoff.outputs.stable_authority_run_id }}' ||
      followerPromotion.with?.carrier_artifact_name !==
        '${{ needs.webui-carrier.outputs.carrier_artifact_name }}' ||
      Object.keys(followerPromotion.with ?? {}).length !== 3) {
    failures += reportFailure(
      id,
      'WebUI promotion must bind the triggering Stable authority and current-run carrier artifact',
    );
  }
  if (/continue-on-error/.test(webuiFollower.text)) {
    failures += reportFailure(id, 'WebUI follower failures must remain visible on the independent follower run');
  }
  failures += validateWebUiCarrierCallee(
    id,
    webui.workflow,
    followerCarrier?.permissions ?? exactWebUiCompileCeilingPermissions,
  );
  const stableInputs = webuiStable.workflow.on?.workflow_call?.inputs ?? {};
  if (JSON.stringify(Object.keys(stableInputs)) !== JSON.stringify([
    'mode',
    'authority_mode',
    'stable_authority_run_id',
    'carrier_follower_run_id',
    'carrier_executor_ref',
    'carrier_artifact_name',
  ])) {
    failures += reportFailure(id, 'WebUI Stable reusable must accept only exact follower identities');
  }

  const standardJobs = workflowJobs(standard.workflow);
  if (standardJobs['nightly-terminal'] ||
      !standard.text.includes('Historical Nightly checkpoints are read-only and cannot enter the live publisher.')) {
    failures += reportFailure(id, 'Standard publisher must reject Nightly checkpoints and expose no Nightly terminal');
  }
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
    if (job && job.environment !== 'release-stable') {
      failures += reportFailure(id, `${jobId} must use the release-stable environment`);
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
      exactReadPermissions,
    );
  }
  if (fullJobs['full-qualification']) {
    failures += validateReusableCall(
      id,
      fullJobs,
      'full-qualification',
      './.github/workflows/opl-first-run-vm.yml',
      exactReadPermissions,
    );
  }
  if (fullJobs['publish-full'] && fullJobs['publish-full'].environment !== 'release-stable') {
    failures += reportFailure(id, 'publish-full must use the release-stable environment');
  }
  if (standardUpdaterOrLatest(full.text)) {
    failures += reportFailure(id, 'append_full must not qualify Standard updater or activate Latest');
  }
  if (/publish-homebrew-full|update-homebrew-tap|OPL_HOMEBREW_TAP_TOKEN|tap-source|Casks\/one-person-lab\.rb|git\b[^\n]*\bpush\b/.test(full.text)) {
    failures += reportFailure(id, 'append_full must not directly mutate Homebrew or touch the Standard Cask');
  }
  for (const required of [
    'opl_homebrew_full_follower_handoff.v1',
    'homebrew_modified:false',
    'latest_modified:false',
    'completed_stage:"full_qualified"',
    'qualification_receipt_sha256',
    'operation_control',
    'operation_id',
    'operation_started_at',
    'operation_deadline_at',
  ]) {
    if (!full.text.includes(required)) failures += reportFailure(id, `append_full handoff is missing ${required}`);
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

export function validateNativeWebuiPublicationTopology(appRoot: string): number {
  const id = 'native_webui_publication_topology';
  const follower = parseWorkflow(appRoot, nativeWebuiFollowerWorkflowPath, id);
  const carrier = parseWorkflow(appRoot, nativeWebuiCarrierWorkflowPath, id);
  if (!follower || !carrier) return [follower, carrier].filter((value) => !value).length;
  let failures = 0;
  const followerTriggers = follower.workflow.on ?? {};
  const followerJobs = workflowJobs(follower.workflow);
  if (
    JSON.stringify(Object.keys(followerTriggers)) !== JSON.stringify(['workflow_run'])
    || JSON.stringify(followerTriggers.workflow_run?.workflows) !== JSON.stringify(['OPL Stable Release Bundle'])
    || JSON.stringify(followerTriggers.workflow_run?.types) !== JSON.stringify(['completed'])
    || !exactObject(follower.workflow.permissions, exactReadPermissions)
    || JSON.stringify(Object.keys(followerJobs)) !== JSON.stringify(['resolve-handoff', 'native-webui-carrier'])
  ) {
    failures += reportFailure(id, 'Native WebUI follower must be one automatic read-default Stable workflow_run lane');
  }
  const followerCarrier = followerJobs['native-webui-carrier'];
  if (!followerCarrier || !isAuthorizedNativeWebuiWriteJob(
    nativeWebuiFollowerWorkflowPath,
    'native-webui-carrier',
    followerCarrier,
  )) {
    failures += reportFailure(id, 'Native WebUI follower must delegate only the exact resolved handoff to its reusable carrier');
  }
  for (const required of [
    '.path == ".github/workflows/release-stable.yml"',
    'opl-release-activation-${STABLE_AUTHORITY_RUN_ID}',
    'webui-follower-handoff.json',
    'opl_standard_latest_admission_receipt.v1',
    'framework_terminal_status == "complete"',
  ]) {
    if (!follower.text.includes(required)) failures += reportFailure(id, `Native follower is missing ${required}`);
  }
  if (/workflow_dispatch:|continue-on-error|packages: write|release-webui-stable\.yml|_release-webui-carrier\.yml/.test(follower.text)) {
    failures += reportFailure(id, 'Native follower must not expose manual, GHCR, or hidden failure paths');
  }

  const carrierInputs = carrier.workflow.on?.workflow_call?.inputs ?? {};
  const carrierJobs = workflowJobs(carrier.workflow);
  if (
    JSON.stringify(Object.keys(carrier.workflow.on ?? {})) !== JSON.stringify(['workflow_call'])
    || JSON.stringify(Object.keys(carrierInputs)) !== JSON.stringify([
      'mode',
      'stable_authority_run_id',
      'app_ref',
      'shell_ref',
      'framework_ref',
      'opl_version',
      'release_bundle_digest',
      'source_run_id',
      'source_artifact',
      'standard_identity_sha256',
      'qualified_artifact_name',
      'publication_artifact_name',
    ])
    || !exactObject(carrier.workflow.permissions, { contents: 'read' })
    || JSON.stringify(Object.keys(carrierJobs)) !== JSON.stringify([
      'startup-canary',
      'build-and-qualify',
      'publish-native-assets',
      'readback-native-assets',
    ])
  ) {
    failures += reportFailure(id, 'Native reusable must expose only exact cohort/checkpoint inputs and startup/prepare/publish/readback jobs');
  }
  const startup = carrierJobs['startup-canary'];
  const build = carrierJobs['build-and-qualify'];
  const publish = carrierJobs['publish-native-assets'];
  const readback = carrierJobs['readback-native-assets'];
  if (
    !startup
    || startup.if !== "${{ inputs.mode == 'canary' }}"
    || !exactObject(startup.permissions, exactReadPermissions)
    || !build
    || build.if !== "${{ inputs.mode == 'prepare' }}"
    || !exactObject(build.permissions, exactReadPermissions)
    || build['continue-on-error'] !== true
    || !publish
    || publish.if !== "${{ inputs.mode == 'publish' }}"
    || publish['continue-on-error'] !== true
    || !isAuthorizedNativeWebuiWriteJob(nativeWebuiCarrierWorkflowPath, 'publish-native-assets', publish)
    || !readback
    || readback.if !== "${{ inputs.mode == 'readback' }}"
    || !exactObject(readback.permissions, exactReadPermissions)
  ) {
    failures += reportFailure(id, 'Native reusable permissions or canary/prepare/publish/readback isolation drifted');
  }
  for (const required of [
    'test "$(id -u)" -ne 0',
    'repository: gaofeng21cn/opl-aion-shell',
    'repository: gaofeng21cn/one-person-lab',
    'desired_root_package_ids',
    'tests/unit/web-cli/nativeDistribution.test.ts',
    'tests/unit/web-cli/packWebCli.test.ts',
    '--rollback',
    'official-profile-first-install-complete',
    'user-sentinel.txt',
    'project-sentinel.txt',
    'release-native-webui-carrier.ts publish',
    'release-native-webui-carrier.ts readback',
    'restore-release-checkpoint',
    '--publication-scope external_target',
    'prior_mutation_attempt_id',
    'find native-release/native-publication-checkpoint -type f -name checkpoint.json',
    'test -f native-release/publication-manifest.json',
    'test "$(jq -r .operation_id <<<"$marker")"',
    'opl release reconcile',
    'latest_modified',
    'container_registry_modified',
    'homebrew_modified',
  ]) {
    if (!carrier.text.includes(required)) failures += reportFailure(id, `Native reusable is missing ${required}`);
  }
  if (/workflow_dispatch:|ghcr\.io|packages: write|make_latest|github-activate-latest|_release-full-addon\.yml/.test(carrier.text)) {
    failures += reportFailure(id, 'Native reusable must remain additive GitHub Release publication only');
  }
  return failures;
}

export function validateHomebrewFullPromotionTopology(appRoot: string): number {
  const id = 'homebrew_full_promotion_topology';
  const follower = parseWorkflow(appRoot, homebrewFullFollowerWorkflowPath, id);
  const publisher = parseWorkflow(appRoot, homebrewFullPublisherWorkflowPath, id);
  if (!follower || !publisher) return [follower, publisher].filter((value) => !value).length;
  let failures = 0;
  const followerJobs = workflowJobs(follower.workflow);
  const followerTriggers = follower.workflow.on ?? {};
  if (
    JSON.stringify(Object.keys(followerTriggers)) !== JSON.stringify(['workflow_run'])
    || JSON.stringify(followerTriggers.workflow_run?.workflows) !== JSON.stringify(['OPL Stable Release Bundle'])
    || JSON.stringify(followerTriggers.workflow_run?.types) !== JSON.stringify(['completed'])
    || !exactObject(follower.workflow.permissions, exactReadPermissions)
    || JSON.stringify(Object.keys(followerJobs)) !== JSON.stringify(['resolve-handoff', 'publish-homebrew-full'])
  ) {
    failures += reportFailure(id, 'Full Homebrew follower must be one automatic read-default Stable workflow_run lane');
  }
  const delegated = followerJobs['publish-homebrew-full'];
  if (
    !delegated
    || delegated.uses !== './.github/workflows/_release-homebrew-full-publish.yml'
    || !needsExactly(delegated, ['resolve-handoff'])
    || !exactObject(delegated.permissions, exactReadPermissions)
    || delegated.with?.mode !== 'execute'
    || delegated.secrets !== 'inherit'
  ) {
    failures += reportFailure(id, 'Full Homebrew follower must delegate only the exact handoff to the protected reusable');
  }
  for (const required of [
    '.path == ".github/workflows/release-stable.yml"',
    '.run_attempt == 1',
    'opl-release-full-published-${AUTHORITY_RUN_ID}',
    'homebrew-full-handoff.json',
    'opl_homebrew_full_follower_handoff.v1',
    '.source.completed_stage == "full_qualified"',
    '.source.checkpoint_transport_executor == "github_actions"',
    '.source.transport_run_id',
    '.homebrew_modified == false',
  ]) {
    if (!follower.text.includes(required)) failures += reportFailure(id, `Full Homebrew follower is missing ${required}`);
  }
  if (/workflow_dispatch:|continue-on-error|git\b[^\n]*\bpush\b|OPL_HOMEBREW_TAP_TOKEN/.test(follower.text)) {
    failures += reportFailure(id, 'Full Homebrew follower must not expose manual or direct mutation paths');
  }

  const publisherJobs = workflowJobs(publisher.workflow);
  const publisherInputs = publisher.workflow.on?.workflow_call?.inputs ?? {};
  if (
    JSON.stringify(Object.keys(publisher.workflow.on ?? {})) !== JSON.stringify(['workflow_call'])
    || JSON.stringify(Object.keys(publisherInputs)) !== JSON.stringify(['mode', 'authority_run_id', 'handoff_base64', 'handoff_sha256'])
    || !exactObject(publisher.workflow.permissions, exactReadPermissions)
    || JSON.stringify(Object.keys(publisherJobs)) !== JSON.stringify(['startup-canary', 'prepare-candidate', 'qualify-candidate', 'publish-cask', 'readback'])
  ) {
    failures += reportFailure(id, 'Full Homebrew reusable must expose only exact handoff inputs and candidate/qualification/publish/readback jobs');
  }
  const startup = publisherJobs['startup-canary'];
  const prepare = publisherJobs['prepare-candidate'];
  const qualify = publisherJobs['qualify-candidate'];
  const publish = publisherJobs['publish-cask'];
  const readback = publisherJobs.readback;
  if (
    !startup || startup.if !== "${{ inputs.mode == 'canary' }}" || !exactObject(startup.permissions, exactReadPermissions)
    || !prepare || prepare.if !== "${{ inputs.mode == 'execute' }}" || !exactObject(prepare.permissions, exactReadPermissions)
    || !qualify || qualify.if !== "${{ inputs.mode == 'execute' }}" || qualify.uses !== './.github/workflows/opl-first-run-vm.yml'
    || !needsExactly(qualify, ['prepare-candidate']) || !exactObject(qualify.permissions, exactReadPermissions)
    || qualify.with?.package_profile !== 'homebrew-full'
    || qualify.with?.homebrew_candidate_artifact !== '${{ needs.prepare-candidate.outputs.candidate_artifact }}'
    || !publish || publish.if !== "${{ inputs.mode == 'execute' }}" || !needsExactly(publish, ['prepare-candidate', 'qualify-candidate'])
    || publish.environment !== 'release-stable' || !exactObject(publish.permissions, exactReadPermissions)
    || !readback || readback.if !== "${{ inputs.mode == 'execute' }}" || !needsExactly(readback, ['prepare-candidate', 'publish-cask'])
    || !exactObject(readback.permissions, exactReadPermissions)
  ) {
    failures += reportFailure(id, 'Full Homebrew reusable must qualify exact candidate before protected Tap CAS and public readback');
  }
  const prepareRuns = jobRuns(prepare);
  const publishRuns = jobRuns(publish);
  for (const required of [
    'app_full_first_install',
    'inspect_only',
    'version_conflict',
    'direct_commit',
    'full_dmg_embedded_opl_base',
    'active_framework_count_target',
    'opl-homebrew-full-candidate-${GITHUB_RUN_ID}',
    'a1561bdf1dfe6f316dad22f16152a537ddfb69d5',
    'merge-base --is-ancestor "$embedded_base_floor" "$shell_sha"',
    'predates the embedded-Base fail-closed carrier',
    "test '${{ steps.checkpoint.outputs.completed_stage }}' = full_qualified",
    'qualification_receipt_sha256',
  ]) {
    if (!prepareRuns.includes(required)) failures += reportFailure(id, `Full Homebrew candidate preparation is missing ${required}`);
  }
  for (const required of [
    'tart-smoke-summary.json',
    'homebrew-full-cask',
    'formula_opl_installed_before == false',
    'formula_opl_installed_after == false',
    'active_framework_count == 1',
    'official_profile.status == "passed"',
    'append_full_operation_id',
    'append_full_operation_deadline_at',
    'publication-scope track_assets',
    'homebrew:gaofeng21cn/homebrew-one-person-lab/Casks/one-person-lab-full.rb/${expected_cask_sha}',
    'publication-scope external_target',
    'release-operation-deadline.ts check',
    'git -C tap-source push --no-force origin "$result_commit:refs/heads/main"',
    'active_unknown_markers',
    'test "$(jq -r .operation_id <<<"$marker")" = "$operation_id"',
    'prior_mutation_attempt_id',
    'opl release reconcile',
    'no second push was attempted',
    'homebrew-full-unknown-checkpoint',
    'git -C tap-source ls-remote origin refs/heads/main',
    'git -C tap-source fetch --no-tags --depth=1 origin "$remote_commit"',
    "git -C tap-source show 'FETCH_HEAD:Casks/one-person-lab-full.rb'",
    'opl_homebrew_full_publication_receipt.v1',
  ]) {
    if (!publishRuns.includes(required)) failures += reportFailure(id, `Full Homebrew protected publish is missing ${required}`);
  }
  if (!publisher.text.includes('Restore qualified Full publication checkpoint')) {
    failures += reportFailure(id, 'Full Homebrew protected publish must restore the exact qualified Full checkpoint');
  }
  if ((publishRuns.match(/git -C tap-source push --no-force/g) ?? []).length !== 1) {
    failures += reportFailure(id, 'Full Homebrew publisher must contain exactly one non-force Tap push call');
  }
  if (publisher.text.includes('contents/Casks/one-person-lab-full.rb?ref=main')) {
    failures += reportFailure(id, 'Full Homebrew readback must bind Cask bytes to a fetched exact Tap commit');
  }
  if (
    !publisher.text.includes(
      'OPL_HOMEBREW_TAP_TOKEN: ${{ secrets.OPL_HOMEBREW_TAP_TOKEN }}',
    )
  ) {
    failures += reportFailure(id, 'Full Homebrew token must be scoped to the protected publish job');
  }
  if (prepareRuns.includes('OPL_HOMEBREW_TAP_TOKEN') || jobRuns(qualify).includes('OPL_HOMEBREW_TAP_TOKEN')) {
    failures += reportFailure(id, 'Full Homebrew token must be unreachable before candidate clean-VM qualification passes');
  }
  if (/workflow_dispatch:|depends_on formula: "opl"|github-activate-latest|make_latest|release-webui/.test(publisher.text)) {
    failures += reportFailure(id, 'Full Homebrew reusable must remain isolated from Formula, Latest, WebUI, and manual entry paths');
  }
  const vmWorkflow = parseWorkflow(appRoot, '.github/workflows/opl-first-run-vm.yml', id);
  if (
    !vmWorkflow
    || !vmWorkflow.text.includes('oplProductProfile/oplProductProfile.generated.json')
  ) {
    failures += reportFailure(
      id,
      'Full Homebrew qualification must carry the generated Official Profile roots into the Shell harness checkout',
    );
  }
  return failures;
}

function standardUpdaterOrLatest(text: string): boolean {
  return text.includes('uses: ./.github/workflows/opl-updater-upgrade-vm.yml') ||
    /^\s*activate-latest:/m.test(text) ||
    /--latest(?:\s+|=)(?:true|1)/.test(text);
}

const canaryReusableCalls = {
  standard: {
    workflow: './.github/workflows/_release-bundle.yml',
    permissions: exactReadPermissions,
  },
  'resume-standard': {
    workflow: './.github/workflows/_release-standard-publish.yml',
    permissions: exactReadPermissions,
  },
  'append-full': {
    workflow: './.github/workflows/_release-full-addon.yml',
    permissions: exactReadPermissions,
  },
  'nested-standard-build': {
    workflow: './.github/workflows/_build-reusable.yml',
    permissions: exactReadPermissions,
  },
  'nested-standard-qualification': {
    workflow: './.github/workflows/opl-first-run-vm.yml',
    permissions: exactReadPermissions,
  },
  'nested-webui-carrier': {
    workflow: './.github/workflows/_release-webui-carrier.yml',
    permissions: exactWebUiCompileCeilingPermissions,
  },
  'nested-webui-stable': {
    workflow: './.github/workflows/release-webui-stable.yml',
    permissions: exactWebUiCompileCeilingPermissions,
  },
  'nested-updater-qualification': {
    workflow: './.github/workflows/opl-updater-upgrade-vm.yml',
    permissions: exactReadPermissions,
  },
  'nested-full-build': {
    workflow: './.github/workflows/full-first-install-release.yml',
    permissions: exactReadPermissions,
  },
} as const;

function validateWebUiCarrierCallee(
  id: string,
  workflow: Record<string, any>,
  callerPermissions: Record<string, unknown>,
): number {
  let failures = 0;
  if (!exactObject(workflow.permissions, { contents: 'read' })) {
    failures += reportFailure(id, 'WebUI carrier top-level permissions must be exactly contents:read');
  }
  const jobs = workflowJobs(workflow);
  if (JSON.stringify(Object.keys(jobs).sort()) !==
      JSON.stringify(['build-and-qualify', 'publish-immutable-carrier', 'startup-canary'])) {
    failures += reportFailure(id, 'WebUI carrier jobs must be exactly startup, build/qualify, and immutable publish');
  }
  const startup = jobs['startup-canary'];
  const build = jobs['build-and-qualify'];
  const publish = jobs['publish-immutable-carrier'];
  if (!startup || startup.if !== "${{ inputs.mode == 'canary' }}" ||
      !Array.isArray(startup.steps) || startup.steps.length === 0) {
    failures += reportFailure(id, 'WebUI carrier startup must be the only Canary-reachable job');
  }
  if (!build || build.if !== "${{ inputs.mode == 'execute' }}" ||
      !exactObject(build.permissions, exactWebUiReadPermissions)) {
    failures += reportFailure(id, 'WebUI build/qualification must be execute-only with exact read permissions');
  }
  if (!publish || publish.if !== "${{ inputs.mode == 'execute' }}" ||
      publish.needs !== 'build-and-qualify' ||
      publish.environment !== 'release-stable' ||
      !exactObject(publish.permissions, exactWebUiPublishPermissions)) {
    failures += reportFailure(id, 'WebUI immutable publish must be execute-only, protected, and request only contents:read/packages:write');
  }
  if (publish &&
      intersectPermission(callerPermissions, publish.permissions, 'packages') !==
        permissionLevel(callerPermissions, 'packages')) {
    failures += reportFailure(id, 'WebUI callee attempted to elevate beyond the caller package permission ceiling');
  }
  return failures;
}

export function validateReleaseBundleCanaryTopology(appRoot: string): number {
  const id = 'release_bundle_canary_topology';
  const parsed = parseWorkflow(appRoot, '.github/workflows/release-bundle-canary.yml', id);
  if (!parsed) return 1;
  const { workflow, text } = parsed;
  let failures = 0;
  if (Object.prototype.hasOwnProperty.call(workflow.on ?? {}, 'workflow_dispatch')) {
    failures += reportFailure(id, 'Canary must not expose workflow_dispatch');
  }
  const triggers = workflow.on ?? {};
  const schedule = triggers.schedule;
  if (JSON.stringify(Object.keys(triggers).sort()) !==
      JSON.stringify(['pull_request', 'push', 'schedule']) ||
      JSON.stringify(triggers.push?.branches) !== JSON.stringify(['main']) ||
      !Array.isArray(schedule) || schedule.length !== 1 ||
      schedule[0]?.cron !== '0 13 * * *') {
    failures += reportFailure(id, 'Canary must run on main push, pull request, and the one daily schedule');
  }
  if (!exactObject(workflow.concurrency, {
    group: 'opl-release-validation-canary-${{ github.ref }}',
    'cancel-in-progress': true,
  })) {
    failures += reportFailure(id, 'Canary must use its own cancellable validation concurrency, not the Stable mutation mutex');
  }
  if (!exactObject(workflow.permissions, exactReadPermissions)) {
    failures += reportFailure(id, 'Canary permissions must be exactly contents:read/actions:read');
  }
  if (/^\s*secrets:/m.test(text) || workflowMutationCommandPattern.test(text) ||
      text.includes('opl-release-bundle-global')) {
    failures += reportFailure(id, 'Canary must not receive secrets or contain mutation commands');
  }

  const jobs = workflowJobs(workflow);
  for (const [jobId, spec] of Object.entries(canaryReusableCalls)) {
    const workflowPath = spec.workflow;
    const job = jobs[jobId];
    failures += validateReusableCall(id, jobs, jobId, workflowPath, spec.permissions);
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
    if (permissionLevel(spec.permissions, 'packages') === 'write') {
      const startupPermissions = startup?.permissions ?? callee.workflow.permissions;
      if (!startupPermissions || requestsWritePermission(startupPermissions)) {
        failures += reportFailure(
          id,
          `${jobId} compile ceiling may be write only when the reachable startup job explicitly downgrades to read-only`,
        );
      }
    }
    if (jobId === 'nested-webui-carrier') {
      failures += validateWebUiCarrierCallee(id, callee.workflow, spec.permissions);
      if (permissionLevel(spec.permissions, 'packages') !== 'write') {
        failures += reportFailure(id, 'Canary WebUI caller must permit the protected publish job to compile');
      }
      continue;
    }
    if (jobId === 'nested-webui-stable') {
      const admission = calleeJobs.admission;
      const promotion = calleeJobs['promote-webui-stable'];
      const expectedInputs = [
        'mode',
        'authority_mode',
        'stable_authority_run_id',
        'carrier_follower_run_id',
        'carrier_executor_ref',
        'carrier_artifact_name',
      ].sort();
      if (!exactObject(callee.workflow.permissions, exactReadPermissions) ||
          !admission || admission.if !== "${{ inputs.mode == 'execute' }}" ||
          !exactObject(admission.permissions, exactReadPermissions) ||
          !promotion || promotion.if !== "${{ inputs.mode == 'execute' }}" ||
          !isAuthorizedWebuiStablePromotionWriteJob(calleePath, 'promote-webui-stable', promotion) ||
          JSON.stringify(Object.keys(callee.workflow.on?.workflow_call?.inputs ?? {}).sort()) !==
            JSON.stringify(expectedInputs)) {
        failures += reportFailure(
          id,
          'WebUI Stable follower must expose exact run identities and keep its protected execute writer unreachable from Canary',
        );
      }
      continue;
    }
    if (requestsWritePermission(callee.workflow.permissions)) {
      failures += reportFailure(id, `${calleePath} must not request top-level write permission`);
    }
    for (const [calleeJobId, calleeJob] of Object.entries(calleeJobs)) {
      if (requestsWritePermission(calleeJob.permissions)) {
        failures += reportFailure(
          id,
          `${calleePath}:${calleeJobId} cannot statically request write from a read-only Canary caller`,
        );
      }
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

export function validateManualFullPreviewControlPlane(appRoot: string): number {
  const id = 'manual_full_preview_control_plane';
  const parsed = parseWorkflow(appRoot, manualFullPreviewWorkflowPath, id);
  if (!parsed) return 1;
  const { workflow, text } = parsed;
  let failures = 0;
  if (JSON.stringify(Object.keys(workflow.on ?? {})) !== JSON.stringify(['workflow_dispatch'])) {
    failures += reportFailure(id, 'Manual Full preview must expose only workflow_dispatch');
  }
  const inputs = workflow.on?.workflow_dispatch?.inputs ?? {};
  if (JSON.stringify(Object.keys(inputs).sort()) !== JSON.stringify([
    'handoff_manifest_sha256', 'handoff_nonce', 'operation',
  ])) {
    failures += reportFailure(id, 'Manual Full preview inputs must be exactly operation, handoff_nonce, and handoff_manifest_sha256');
  }
  if (
    inputs.operation?.required !== true
    || inputs.operation?.type !== 'choice'
    || JSON.stringify(inputs.operation?.options) !== JSON.stringify(['publish', 'cleanup'])
    || inputs.handoff_nonce?.required !== true
    || inputs.handoff_nonce?.type !== 'string'
    || inputs.handoff_manifest_sha256?.required !== true
    || inputs.handoff_manifest_sha256?.type !== 'string'
  ) {
    failures += reportFailure(id, 'Manual Full preview dispatch input contract is invalid');
  }
  if (!exactObject(workflow.permissions, exactReadPermissions)) {
    failures += reportFailure(id, 'Manual Full preview top-level permissions must be exactly contents:read/actions:read');
  }
  if (
    workflow.concurrency?.group !== 'opl-release-bundle-global'
    || workflow.concurrency?.['cancel-in-progress'] !== false
  ) {
    failures += reportFailure(id, 'Manual Full preview must share the non-cancelling repository release mutex');
  }
  const jobs = workflowJobs(workflow);
  if (JSON.stringify(Object.keys(jobs).sort()) !== JSON.stringify(['ingress', 'mutate'])) {
    failures += reportFailure(id, 'Manual Full preview jobs must be exactly ingress and mutate');
  }
  const ingress = jobs.ingress;
  const mutate = jobs.mutate;
  if (
    !ingress
    || JSON.stringify(ingress['runs-on']) !== JSON.stringify(['self-hosted', 'macOS', 'ARM64', 'opl-gui-vm'])
    || ingress.environment !== undefined
    || !exactObject(ingress.permissions, exactReadPermissions)
    || ingress.secrets !== undefined
  ) {
    failures += reportFailure(id, 'Manual Full preview ingress must be the read-only dedicated macOS ARM64 runner');
  }
  if (
    !mutate
    || !needsExactly(mutate, ['ingress'])
    || mutate.environment !== 'release-stable'
    || !exactObject(mutate.permissions, exactStableEntryPermissions)
    || mutate.secrets !== undefined
  ) {
    failures += reportFailure(id, 'Manual Full preview mutation must be admission-dependent and protected by release-stable');
  }
  const ingressRuns = jobRuns(ingress);
  const mutateRuns = jobRuns(mutate);
  if (
    !ingressRuns.includes('test "$GITHUB_RUN_ATTEMPT" = 1')
    || !ingressRuns.includes('OPL_MANUAL_PREVIEW_INGRESS_ROOT')
    || !ingressRuns.includes('manual-full-preview-release.ts ingest')
    || !mutateRuns.includes('test "$GITHUB_RUN_ATTEMPT" = 1')
    || !mutateRuns.includes('manual-full-preview-release.ts verify-artifact')
    || !mutateRuns.includes('manual-full-preview-release.ts mutate')
  ) {
    failures += reportFailure(id, 'Manual Full preview must enforce attempt one, fixed ingress, artifact readback, and the thin executor');
  }
  if (
    !text.includes('artifact-ids: ${{ needs.ingress.outputs.artifact_id }}')
    || !text.includes('overwrite: false')
    || !text.includes('compression-level: 0')
    || /(?:opl release|gh workflow run|gh run (?:rerun|cancel)|--clobber)/.test(text)
  ) {
    failures += reportFailure(id, 'Manual Full preview transport or forbidden mutation boundary drifted');
  }
  for (const [jobId, job] of Object.entries(jobs)) {
    failures += validateExactActionPins(
      manualFullPreviewWorkflowPath,
      jobId,
      Array.isArray(job.steps) ? job.steps : [],
    );
  }
  return failures;
}

export function validateWorkflowDispatchWriteAuthority(appRoot: string): number {
  let failures = validateStableReleaseControlPlane(appRoot) +
    validateReleaseBundleTopology(appRoot) +
    validateReleaseBundleCanaryTopology(appRoot) +
    validateManualFullPreviewControlPlane(appRoot) +
    validateNativeWebuiPublicationTopology(appRoot) +
    validateHomebrewFullPromotionTopology(appRoot);
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
    const isNativeWebuiWorkflow = workflowPath === nativeWebuiFollowerWorkflowPath
      || workflowPath === nativeWebuiCarrierWorkflowPath;
    if (!Object.prototype.hasOwnProperty.call(workflow?.on ?? {}, 'workflow_dispatch') && !isNativeWebuiWorkflow) continue;
    const topPermissions = workflow.permissions && typeof workflow.permissions === 'object' ? workflow.permissions : {};
    const topWrites = Object.entries(topPermissions).filter(([, value]) => value === 'write').map(([key]) => key);
    if (topWrites.length > 0) {
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
      if (isAuthorizedWebuiStablePromotionWriteJob(workflowPath, jobId, job)) {
        failures += validateExactActionPins(workflowPath, jobId, steps);
        continue;
      }
      if (isAuthorizedNativeWebuiWriteJob(workflowPath, jobId, job)) {
        failures += validateExactActionPins(workflowPath, jobId, steps);
        continue;
      }
      if (
        workflowPath === webuiDevelopmentWorkflowPath
        && (
          (
            jobId === 'webui-carrier'
            && job.uses === './.github/workflows/_release-webui-carrier.yml'
            && needsExactly(job, ['resolve-frozen-bundle'])
            && exactObject(job.permissions, exactWebUiCompileCeilingPermissions)
            && job.with?.mode === 'execute'
            && job.with?.authority_mode === 'development_validation'
          )
          || (
            jobId === 'promote-webui-stable'
            && job.uses === './.github/workflows/release-webui-stable.yml'
            && needsExactly(job, ['resolve-frozen-bundle', 'webui-carrier'])
            && exactObject(job.permissions, exactWebUiCompileCeilingPermissions)
            && job.with?.mode === 'execute'
            && job.with?.authority_mode === 'development_validation'
          )
        )
        && steps.length === 0
      ) {
        continue;
      }
      if (
        workflowPath === webuiDevelopmentPromotionWorkflowPath
        && jobId === 'promote-webui-stable'
        && job.uses === './.github/workflows/release-webui-stable.yml'
        && !Object.prototype.hasOwnProperty.call(job, 'needs')
        && exactObject(job.permissions, exactWebUiCompileCeilingPermissions)
        && job.with?.mode === 'execute'
        && job.with?.authority_mode === 'development_validation'
        && job.with?.stable_authority_run_id === '${{ inputs.stable_authority_run_id }}'
        && job.with?.carrier_follower_run_id === '${{ inputs.carrier_follower_run_id }}'
        && job.with?.carrier_executor_ref === '${{ inputs.carrier_executor_ref }}'
        && job.with?.carrier_artifact_name === '${{ inputs.carrier_artifact_name }}'
        && steps.length === 0
      ) {
        continue;
      }
      if (
        workflowPath === manualFullPreviewWorkflowPath
        && jobId === manualFullPreviewMutationJob
        && job.environment === 'release-stable'
        && needsExactly(job, ['ingress'])
        && exactObject(job.permissions, exactStableEntryPermissions)
      ) {
        failures += validateExactActionPins(workflowPath, jobId, steps);
        continue;
      }
      if (workflowPath === stableWorkflowPath && stableEntryJobs.has(jobId)) {
        const spec = stableEntrySpecs[jobId as keyof typeof stableEntrySpecs];
        if (job.uses && steps.length === 0 && spec && exactObject(job.permissions, spec.permissions)) {
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
