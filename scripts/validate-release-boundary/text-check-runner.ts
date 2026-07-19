import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { releaseBoundaryChecks, releaseWorkflowPaths } from './release-checks.ts';

const workflowMutationCommandPattern = /gh\s+api\s+--method\s+(?:POST|PATCH|PUT|DELETE)|gh\s+workflow\s+run|gh\s+run\s+(?:cancel|rerun)|gh\s+release\s+(?:create|edit|upload|delete)|git\s+(?:push|tag)|publish-(?:release|full-addon)\.ts|cleanup-draft-release-candidates\.ts|curl\b[^\n]*(?:--request|-X)\s*(?:POST|PATCH|PUT|DELETE)/;

const brokerLookupActionAllowlist = new Set([
  'actions/checkout',
  'actions/setup-node',
  'actions/upload-artifact',
  'actions/download-artifact',
]);

export const stableReleaseActionPaths = [...new Set([
  '.github/actions/setup-active-shell-deps/action.yml',
  ...releaseWorkflowPaths,
])];

function actionName(uses: string): string {
  return uses.slice(0, uses.lastIndexOf('@'));
}

export function isBrokerLookupOidcOnlyJob(job: Record<string, any>): boolean {
  const permissions = job.permissions && typeof job.permissions === 'object'
    ? job.permissions as Record<string, unknown>
    : null;
  if (!permissions) return false;
  const expectedPermissions = new Map<string, unknown>([
    ['contents', 'read'],
    ['actions', 'read'],
    ['id-token', 'write'],
  ]);
  if (Object.keys(permissions).length !== expectedPermissions.size ||
      [...expectedPermissions].some(([name, value]) => permissions[name] !== value)) {
    return false;
  }

  const steps = Array.isArray(job.steps) ? job.steps as Array<Record<string, any>> : [];
  const lookupRuns = steps
    .map((step) => typeof step.run === 'string' ? step.run : '')
    .filter((run) => run.includes('verify-release-broker-acceptance.ts') && (
      run.includes('--mode lookup') ||
      (run.includes('verifier_mode=lookup') && run.includes('verifier_mode=admin-one-shot') &&
        run.includes('--mode "$verifier_mode"'))
    ));
  if (lookupRuns.length !== 1) return false;
  const lookupRun = lookupRuns[0];
  const requiredBindings = [
    'GITHUB_RUN_ATTEMPT',
    '--pre-api-fence-base64',
    '--expected-repository',
    '--expected-run-id',
    '--expected-run-attempt',
    '--expected-workflow',
    '--expected-workflow-sha',
    '--expected-payload-sha256',
    '--expected-attempt-id',
  ];
  if (requiredBindings.some((binding) => !lookupRun.includes(binding))) return false;
  if (lookupRun.includes('verifier_mode=admin-one-shot') && (
    !lookupRun.includes('--expected-operator-actor') || !lookupRun.includes('--expected-github-actor')
  )) return false;
  if (!lookupRun.includes('$GITHUB_REPOSITORY') || !lookupRun.includes('$GITHUB_RUN_ID') ||
      !lookupRun.includes('$GITHUB_RUN_ATTEMPT') || !lookupRun.includes('$GITHUB_SHA')) {
    return false;
  }
  if (steps.some((step) => workflowMutationCommandPattern.test(typeof step.run === 'string' ? step.run : ''))) {
    return false;
  }
  return steps.every((step) => {
    if (typeof step.uses !== 'string') return true;
    if (step.uses.startsWith('./')) return false;
    return brokerLookupActionAllowlist.has(actionName(step.uses));
  });
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
  let failures = 0;
  const signedStableWriters = new Set([
    '.github/workflows/desktop-release.yml',
    '.github/workflows/desktop-release-promote.yml',
    '.github/workflows/desktop-release-full-addon.yml',
  ]);
  const canonicalBrokeredWorkflows = new Set([
    '.github/workflows/desktop-release.yml',
    '.github/workflows/desktop-release-promote.yml',
    '.github/workflows/desktop-release-full-addon.yml',
    '.github/workflows/opl-first-run-vm.yml',
  ]);
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
    if (!workflow?.on?.workflow_dispatch) continue;
    if (canonicalBrokeredWorkflows.has(workflowPath)) {
      const attemptInput = workflow.on.workflow_dispatch?.inputs?.release_attempt_id;
      const runName = workflow['run-name'];
      if (attemptInput?.required !== true) {
        console.error(`FAIL workflow_attempt_identity: ${workflowPath} must require workflow_dispatch.inputs.release_attempt_id`);
        failures += 1;
      }
      if (typeof runName !== 'string' || !runName.includes('${{ inputs.release_attempt_id }}')) {
        console.error(`FAIL workflow_attempt_identity: ${workflowPath} run-name must contain the complete release_attempt_id input`);
        failures += 1;
      }
    }
    const topPermissions = workflow.permissions && typeof workflow.permissions === 'object' ? workflow.permissions : {};
    const topWrites = Object.entries(topPermissions).filter(([, value]) => value === 'write').map(([key]) => key);
    if (signedStableWriters.has(workflowPath) && topWrites.length > 0) {
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
      if (isBrokerLookupOidcOnlyJob(job)) {
        failures += validateExactActionPins(workflowPath, jobId, steps);
        continue;
      }
      if (!signedStableWriters.has(workflowPath)) {
        console.error(`FAIL workflow_dispatch_write_authority: ${workflowPath} job ${jobId} has write permission outside the signed broker inventory`);
        failures += 1;
        continue;
      }
      const verifierIndex = steps.findIndex((step) => {
        const run = typeof step.run === 'string' ? step.run : '';
        const verifiesLeaseAndPayload = run.includes('verify-release-session-lease.ts') &&
          run.includes('verify-release-mutation-payload.ts');
        const verifiesHistoricalBrokerAcceptance = run.includes('verify-release-broker-acceptance.ts') &&
          run.includes('--mode historical') &&
          run.includes('--expected-payload-sha256') &&
          run.includes('--expected-attempt-id');
        return run.includes('GITHUB_RUN_ATTEMPT') &&
          (verifiesLeaseAndPayload || verifiesHistoricalBrokerAcceptance);
      });
      const mutationIndex = steps.findIndex((step) => {
        const run = typeof step.run === 'string' ? step.run : '';
        return /gh\s+(?:api\s+--method\s+(?:POST|PATCH|DELETE)|workflow\s+run|run\s+cancel|release\s+(?:create|edit|upload|delete))|publish-(?:release|full-addon)\.ts/.test(run);
      });
      if (verifierIndex < 0 || (mutationIndex >= 0 && verifierIndex >= mutationIndex)) {
        console.error(`FAIL workflow_dispatch_write_authority: ${workflowPath} job ${jobId} must verify attempt=1, lease, and payload before its first mutation`);
        failures += 1;
      }
      const attemptVerifierIndex = steps.findIndex((step) => {
        const run = typeof step.run === 'string' ? step.run : '';
        const environment = step.env && typeof step.env === 'object' ? step.env as Record<string, unknown> : {};
        const attemptFlag = run.includes('verify-release-session-lease.ts')
          ? '--attempt-id'
          : run.includes('verify-release-broker-acceptance.ts') && run.includes('--mode historical')
            ? '--expected-attempt-id'
            : null;
        const directAttemptBinding = run.includes('${{ inputs.release_attempt_id }}');
        const environmentAttemptBinding = Object.entries(environment).some(([name, value]) => (
          value === '${{ inputs.release_attempt_id }}' &&
          attemptFlag !== null && run.includes(`${attemptFlag} \"$${name}\"`)
        ));
        return attemptFlag !== null &&
          run.includes(attemptFlag) &&
          (directAttemptBinding || environmentAttemptBinding);
      });
      if (mutationIndex >= 0 && (attemptVerifierIndex < 0 || attemptVerifierIndex >= mutationIndex)) {
        console.error(`FAIL workflow_attempt_identity: ${workflowPath} job ${jobId} must bind release_attempt_id into the signed lease before its first mutation`);
        failures += 1;
      }
      failures += validateExactActionPins(workflowPath, jobId, steps);
    }
  }
  return failures;
}
