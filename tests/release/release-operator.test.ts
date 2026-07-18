import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import type { ReleaseCohortPlan } from '../../scripts/plan-release-cohort.ts';
import {
  appendReleaseMutationAttemptEvent,
  buildStableReleaseSession,
  planReleaseMutationAttempt,
} from '../../scripts/stable-release-session.ts';
import {
  appRoot,
  createGitCheckout,
  readJson,
  runGit,
  writeJson,
} from './release-readiness/helpers.ts';

function cleanEnv() {
  const {
    OPL_RELEASE_OPERATOR_STATE,
    OPL_RELEASE_OPERATOR_MARKDOWN,
    OPL_RELEASE_VERSION,
    OPL_RELEASE_MODE,
    OPL_RELEASE_ARTIFACT_RUN_ID,
    OPL_RELEASE_ARTIFACT_NAME,
    OPL_RELEASE_PACKAGE_PROFILE,
    OPL_RELEASE_DIAGNOSTIC_SCOPE,
    OPL_RELEASE_RUN_ID,
    OPL_RELEASE_REPO,
    OPL_RELEASE_EXPECTED_HEAD,
    OPL_RELEASE_RUN_JSON,
    OPL_APP_REF,
    OPL_APP_COMMIT,
    OPL_SHELL_REF,
    OPL_FRAMEWORK_REF,
    OPL_SHELL_ROOT,
    OPL_FRAMEWORK_ROOT,
    OPL_RELEASE_COHORT_LOCK,
    OPL_RELEASE_COHORT_LOCK_MARKDOWN,
    OPL_STABLE_RELEASE_SESSION_STATE,
    ...env
  } = process.env;
  return env;
}

function runScript(script: string, args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', script, ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: cleanEnv(),
    },
  );
}

function createReleaseRefCheckouts() {
  return {
    shell: createGitCheckout('opl-release-shell-'),
    framework: createGitCheckout('opl-release-framework-'),
    appHead: runGit(appRoot, ['rev-parse', 'HEAD']),
  };
}

const releaseOperatorScript = 'scripts/release-operator.ts';
const headA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const headE = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function runReleaseOperator(args: string[]) {
  return runScript(releaseOperatorScript, args);
}

function releaseOperatorPaths(prefix: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    tempRoot,
    runJsonPath: path.join(tempRoot, 'run.json'),
    outputPath: path.join(tempRoot, 'release-operator-state.json'),
    markdownPath: path.join(tempRoot, 'release-operator-state.md'),
  };
}

function runStatus(prefix: string, runPayload: unknown, args: string[] = []) {
  const paths = releaseOperatorPaths(prefix);
  const payload = runPayload as Record<string, any>;
  const argumentValue = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const version = argumentValue('--version') ?? '26.7.18';
  const expectedHead = argumentValue('--expected-head') ?? payload.headSha ?? headA;
  const stableStatePath = argumentValue('--stable-state') ?? path.join(paths.tempRoot, 'stable-session.json');
  const plan: ReleaseCohortPlan = {
    schema: 'opl_app_release_cohort_plan.v1', generated_at: '2026-07-18T00:00:00.000Z',
    version, tag: `v${version}`, release_mode: 'new_release', release_intent: 'stable_complete',
    full_omission_reason: null, operator_plan_ref: `sha256:${'d'.repeat(64)}`, gate_reuse_plan_ref: null,
    app_commit: headA, shell_ref: 'b'.repeat(40), framework_ref: 'c'.repeat(40),
    include_full_package: false, run_vm_smoke: true, publish_docker_webui: false,
    cohort_lock: {
      schema: 'opl_app_release_cohort_lock.v1', generated_at: '2026-07-18T00:00:00.000Z',
      app: { requested_ref: headA, resolved_sha: headA, repo_root: appRoot },
      shell: { requested_ref: 'b'.repeat(40), resolved_sha: 'b'.repeat(40), repo_root: '/shell' },
      framework: { requested_ref: 'c'.repeat(40), resolved_sha: 'c'.repeat(40), repo_root: '/framework' },
      authority_boundary: {
        cohort_lock_can_dispatch_workflow: false, cohort_lock_can_publish_release: false,
        cohort_lock_can_write_runtime_truth: false,
      },
    },
    cheap_gates: [],
    next_action: { action: 'plan_stable_release_start', command: 'unused', reason: 'fixture' },
    authority_boundary: {
      cohort_plan_can_publish_release: false, cohort_plan_can_write_runtime_truth: false,
      cohort_plan_can_claim_release_ready: false,
    },
  };
  let session = buildStableReleaseSession(plan, 'gaofeng21cn/one-person-lab-app', '2026-07-18T00:00:00.000Z');
  const planned = planReleaseMutationAttempt(session, {
    mutation: 'desktop_release_dispatch', workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: expectedHead, artifactAppSha: headA,
    mutationPayloadSha256: `sha256:${'1'.repeat(64)}`, mutationPayload: {},
    at: '2026-07-18T00:01:00.000Z', reason: 'fixture planned exact release run',
  });
  session = appendReleaseMutationAttemptEvent(planned.session, planned.attemptId, {
    at: '2026-07-18T00:02:00.000Z', state: 'dispatching', run_id: null, reason: 'fixture broker request durable',
  });
  const terminalState = payload.status === 'completed'
    ? payload.conclusion === 'success' ? 'succeeded' : payload.conclusion === 'cancelled' ? 'cancelled' : 'failed'
    : 'running';
  session = appendReleaseMutationAttemptEvent(session, planned.attemptId, {
    at: '2026-07-18T00:03:00.000Z', state: terminalState,
    run_id: String(payload.databaseId), reason: `fixture run ${terminalState}`,
  });
  writeJson(stableStatePath, session as unknown as Record<string, unknown>);
  writeJson(paths.runJsonPath, {
    ...payload,
    attempt: 1,
    displayTitle: `OPL Desktop Release v${version} attempt=${planned.attemptId}`,
    headBranch: 'main', event: 'workflow_dispatch',
    createdAt: '2026-07-18T00:02:00.000Z', startedAt: '2026-07-18T00:02:10.000Z',
    updatedAt: '2026-07-18T00:03:00.000Z',
    completedAt: payload.status === 'completed' ? '2026-07-18T00:03:00.000Z' : null,
  });
  const completeArgs = [...args];
  if (!argumentValue('--version')) completeArgs.push('--version', version);
  if (!argumentValue('--expected-head')) completeArgs.push('--expected-head', expectedHead);
  if (!argumentValue('--stable-state')) completeArgs.push('--stable-state', stableStatePath);
  const result = runReleaseOperator([
    'status',
    '--run-json',
    paths.runJsonPath,
    ...completeArgs,
    '--output',
    paths.outputPath,
    '--markdown',
    paths.markdownPath,
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { ...paths, result, state: readJson(paths.outputPath) };
}

function assertNoOperatorAuthority(boundary: Record<string, boolean>) {
  assert.equal(boundary.operator_can_publish_release, false);
  assert.equal(boundary.operator_can_write_runtime_truth, false);
  if ('operator_can_dispatch_workflow_without_explicit_user_action' in boundary) {
    assert.equal(boundary.operator_can_dispatch_workflow_without_explicit_user_action, false);
  }
  assert.equal(boundary.operator_can_authorize_mutation, false);
}

test('release operator plan routes pinned Full intent through the dry-run Stable controller', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-plan-'));
  const refs = createReleaseRefCheckouts();
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  const markdownPath = path.join(tempRoot, 'release-operator-state.md');
  const result = runScript('scripts/release-operator.ts', [
      'plan',
      '--version',
      '26.6.99',
      '--release-mode',
      'new_release',
      '--include-full-package',
      'true',
      '--run-vm-smoke',
      'true',
      '--app-ref',
      refs.appHead,
      '--shell-ref',
      refs.shell.head,
      '--framework-ref',
      refs.framework.head,
      '--shell-root',
      refs.shell.root,
      '--framework-root',
      refs.framework.root,
      '--output',
      outputPath,
      '--markdown',
      markdownPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
  assert.equal(state.status, 'planned');
  assert.equal(state.cohort_plan.cohort_lock.shell.resolved_sha, refs.shell.head);
  assert.equal(state.cohort_plan.cohort_lock.framework.resolved_sha, refs.framework.head);
  assert.equal(state.cohort_plan.cohort_lock.app.resolved_sha, refs.appHead);
  assert.match(state.cohort_plan.dispatch_handle.expected_workflow_sha, /^[0-9a-f]{40}$/);
  assert.equal(state.cohort_plan.next_action.action, 'plan_stable_release_start');
  assert.match(state.cohort_plan.next_action.command, /^npm run release:stable -- start /);
  assert.match(state.cohort_plan.next_action.command, new RegExp(`--app-ref ${refs.appHead}`));
  assert.match(state.cohort_plan.next_action.command, new RegExp(`--shell-ref ${refs.shell.head}`));
  assert.match(state.cohort_plan.next_action.command, new RegExp(`--framework-ref ${refs.framework.head}`));
  assert.match(state.cohort_plan.next_action.command, /--release-intent stable_complete/);
  assert.match(state.cohort_plan.next_action.command, /--include-full-package true/);
  assert.match(state.cohort_plan.next_action.reason, /independent Standard terminal.*non-blocking add-on intent/);
  assert.equal(state.cohort_plan.release_intent, 'stable_complete');
  assert.match(state.cohort_plan.operator_plan_ref, /^sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(state.cohort_plan.next_action.command, /gh workflow run|--field|--execute/);
  const sourceGate = state.cohort_plan.cheap_gates.find((gate: { id: string }) => gate.id === 'release_source_gate');
  assert.match(sourceGate.command, new RegExp(`--shell-root '${refs.shell.root}'`));
  assert.match(sourceGate.command, new RegExp(`--framework-root '${refs.framework.root}'`));
  assertNoOperatorAuthority(state.authority_boundary);
});

test('release operator requires an omission reason for a Standard-only hotfix', () => {
  const refs = createReleaseRefCheckouts();
  const appRef = `opl-release-test-hotfix-${process.pid}-${Date.now()}`;
  runGit(appRoot, ['update-ref', `refs/tags/${appRef}`, refs.appHead]);
  try {
    const result = runReleaseOperator([
      'plan',
      '--version',
      '26.6.29',
      '--release-mode',
      'refresh_existing',
      '--release-intent',
      'standard_hotfix',
      '--include-full-package',
      'false',
      '--run-vm-smoke',
      'true',
      '--app-ref',
      appRef,
      '--shell-root',
      refs.shell.root,
      '--framework-root',
      refs.framework.root,
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires --full-omission-reason/);
  } finally {
    runGit(appRoot, ['update-ref', '-d', `refs/tags/${appRef}`]);
  }
});

test('release operator plan accepts a frozen App SHA and normal Standard terminal without Full add-on intent', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-plan-sha-'));
  const refs = createReleaseRefCheckouts();
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  const result = runScript('scripts/release-operator.ts', [
    'plan',
    '--version',
    '26.6.99',
    '--release-mode',
    'new_release',
    '--include-full-package',
    'false',
    '--run-vm-smoke',
    'true',
    '--app-ref',
    refs.appHead,
    '--shell-ref',
    refs.shell.head,
    '--framework-ref',
    refs.framework.head,
    '--shell-root',
    refs.shell.root,
    '--framework-root',
    refs.framework.root,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
  assert.equal(state.cohort_plan.release_intent, 'stable_complete');
  assert.equal(state.cohort_plan.include_full_package, false);
  assert.equal(state.cohort_plan.next_action.action, 'plan_stable_release_start');
  assert.match(state.cohort_plan.next_action.command, /^npm run release:stable -- start /);
  assert.match(state.cohort_plan.next_action.command, new RegExp(`--app-ref ${refs.appHead}`));
  assert.match(state.cohort_plan.next_action.command, /--include-full-package false/);
  assert.match(state.cohort_plan.next_action.reason, /independent Standard terminal.*no Full add-on/);
  assert.doesNotMatch(state.cohort_plan.next_action.command, /gh workflow run|--execute/);
});

test('release operator status reports completed failure primary blocker', () => {
  const { state } = runStatus('opl-release-operator-status-failed-', {
    databaseId: 12345,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'failure',
    headSha: headA,
    url: 'https://github.example/runs/12345',
    jobs: [
      {
        name: 'release-preflight',
        status: 'completed',
        conclusion: 'success',
        steps: [{ name: 'Validate release boundary', status: 'completed', conclusion: 'success' }],
      },
      {
        name: 'Build App-owned DMG',
        status: 'completed',
        conclusion: 'failure',
        steps: [
          { name: 'Install dependencies', status: 'completed', conclusion: 'success' },
          { name: 'Package app', status: 'completed', conclusion: 'failure' },
        ],
      },
    ],
  });

  assert.equal(state.status, 'failed');
  assert.equal(state.primary_blocker.type, 'step');
  assert.equal(state.primary_blocker.job_name, 'Build App-owned DMG');
  assert.equal(state.primary_blocker.step_name, 'Package app');
  assert.equal(state.recommended_next_action.action, 'inspect_primary_blocker');
  assert.match(state.recommended_next_action.command, /gh run view 12345 --repo gaofeng21cn\/one-person-lab-app --log-failed/);
  assertNoOperatorAuthority(state.authority_boundary);
});

test('release operator status reports successful current run as ready for closeout review', () => {
  const stableState = '/tmp/opl-stable-session-ready.json';
  const { state } = runStatus('opl-release-operator-status-ready-', {
    databaseId: 45678,
    workflowName: 'OPL Desktop Release',
    displayTitle: 'Release v26.6.99',
    status: 'completed',
    conclusion: 'success',
    headSha: headE,
    url: 'https://github.example/runs/45678',
    jobs: [
      {
        name: 'release-readiness',
        status: 'completed',
        conclusion: 'success',
        steps: [{ name: 'Aggregate release readiness', status: 'completed', conclusion: 'success' }],
      },
    ],
  }, ['--version', '26.6.29', '--expected-head', headE, '--stable-state', stableState]);
  assert.equal(state.status, 'ready_for_closeout_review');
  assert.equal(state.run.id, '45678');
  assert.equal(state.primary_blocker, null);
  assert.equal(state.recommended_next_action.action, 'reconcile_stable_session');
  assert.match(state.recommended_next_action.command, /^npm run release:stable -- reconcile /);
  assert.match(state.recommended_next_action.command, new RegExp(stableState));
  assert.doesNotMatch(JSON.stringify(state), /gh workflow run|desktop-release-promote\.yml|--execute|rerun/i);
});

test('release operator diagnose-vm emits typed dry-run Stable controller actions only', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-diagnose-vm-'));
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  const stableState = path.join(tempRoot, 'stable-session.json');
  const result = runReleaseOperator([
    'diagnose-vm',
    '--version',
    '26.7.18',
    '--release-artifact-run-id',
    '777',
    '--release-artifact-name',
    'opl-full-first-install-dmg-26.7.18-mac-arm64',
    '--package-profile',
    'full',
    '--diagnostic-scope',
    'release_gate',
    '--state',
    stableState,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
  assert.equal(state.status, 'diagnostic_action_ready');
  assert.equal(state.diagnostic_actions.length, 2);
  assert.equal(state.diagnostic_actions[0].action, 'reconcile_stable_session');
  assert.equal(state.diagnostic_actions[1].action, 'retry_qualification_same_artifact');
  assert.equal(state.diagnostic_actions[1].mutation_authorized, false);
  assert.equal(state.diagnostic_actions[1].direct_workflow_dispatch_allowed, false);
  assert.match(
    state.diagnostic_actions[1].command,
    /^npm run release:stable -- retry-qualification .*--artifact-kind full$/,
  );
  assert.equal(state.diagnostic_actions[1].evidence.release_artifact_run_id, '777');
  assert.doesNotMatch(JSON.stringify(state), /gh workflow run|desktop-release-diagnostics\.yml|--execute|rerun/i);
});

test('release operator diagnose-vm requires the exact original Stable controller state', () => {
  const result = runReleaseOperator([
    'diagnose-vm',
    '--version',
    '26.7.18',
    '--release-artifact-run-id',
    '777',
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Pass --state <original-stable-release-session\.json>/);
});

test('release operator routes a terminal VM gate failure to bounded Stable qualification recovery', () => {
  const stableState = '/tmp/opl-stable-session-vm-failed.json';
  const { state } = runStatus('opl-release-operator-status-vm-failed-', {
    databaseId: 67890,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'failure',
    headSha: headA,
    jobs: [{
      name: 'standard-first-run-vm-smoke',
      status: 'completed',
      conclusion: 'failure',
      steps: [{ name: 'Run clean VM first launch smoke', status: 'completed', conclusion: 'failure' }],
    }],
  }, ['--version', '26.7.18', '--stable-state', stableState]);

  assert.equal(state.status, 'failed');
  assert.equal(state.next_action.action, 'retry_qualification_same_artifact');
  assert.match(state.next_action.command, /^npm run release:stable -- retry-qualification /);
  assert.match(state.next_action.command, /--artifact-kind standard$/);
  assert.doesNotMatch(state.next_action.command, /--execute|gh workflow run/i);
});

test('release operator reconciles a draining VM failure before suggesting qualification recovery', () => {
  const stableState = '/tmp/opl-stable-session-vm-draining.json';
  const { state } = runStatus('opl-release-operator-status-vm-draining-', {
    databaseId: 67891,
    workflowName: 'OPL Desktop Release',
    status: 'in_progress',
    conclusion: null,
    headSha: headA,
    jobs: [{
      name: 'standard-first-run-vm-smoke',
      status: 'completed',
      conclusion: 'failure',
      steps: [{ name: 'Run clean VM first launch smoke', status: 'completed', conclusion: 'failure' }],
    }],
  }, ['--version', '26.7.18', '--stable-state', stableState]);

  assert.equal(state.status, 'failed_gate_draining');
  assert.equal(state.next_action.action, 'reconcile_stable_session');
  assert.match(state.next_action.command, /^npm run release:stable -- reconcile /);
  assert.doesNotMatch(state.next_action.command, /retry-qualification|--execute|gh workflow run/i);
});
