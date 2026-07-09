import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot, readJson, writeJson } from './release-readiness/helpers.ts';

function cleanEnv() {
  const {
    OPL_RELEASE_OPERATOR_STATE,
    OPL_RELEASE_OPERATOR_MARKDOWN,
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

function snapshotFile(filePath: string): string | null {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function assertFileSnapshotUnchanged(filePath: string, snapshot: string | null): void {
  assert.equal(snapshotFile(filePath), snapshot);
}

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function createGitCheckout(prefix: string): { root: string; head: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  runGit(root, ['init', '-b', 'main']);
  runGit(root, ['config', 'user.email', 'release-test@example.com']);
  runGit(root, ['config', 'user.name', 'Release Test']);
  fs.writeFileSync(path.join(root, 'README.md'), `${prefix}\n`, 'utf8');
  runGit(root, ['add', 'README.md']);
  runGit(root, ['commit', '-m', 'Initial test commit']);
  return { root, head: runGit(root, ['rev-parse', 'HEAD']) };
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
const headB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const headC = 'cccccccccccccccccccccccccccccccccccccccc';
const headD = 'dddddddddddddddddddddddddddddddddddddddd';
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
  writeJson(paths.runJsonPath, runPayload);
  const result = runReleaseOperator([
    'status',
    '--run-json',
    paths.runJsonPath,
    ...args,
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
}

function writePreviousFailedSession(sessionPath: string, options: { currentAuthorityRef?: string } = {}) {
  const currentAuthorityRun: Record<string, unknown> = {
    id: '12351',
    status: 'completed',
    conclusion: 'failure',
    head_sha: headB,
  };
  if (options.currentAuthorityRef) {
    currentAuthorityRun.ref = options.currentAuthorityRef;
  }
  writeJson(sessionPath, {
    schema: 'opl_app_release_session_manifest.v1',
    id: 'release-session:26.7.9:12351',
    generated_at: '2026-07-08T00:00:00.000Z',
    version: '26.7.9',
    run_set: {
      current_run_id: '12351',
      runs: [
        {
          id: '12351',
          workflow_name: 'OPL Desktop Release',
          status: 'completed',
          conclusion: 'failure',
          head_sha: headB,
          url: 'https://github.example/runs/12351',
          elapsed_seconds: 120,
        },
      ],
    },
    current_authority_run: currentAuthorityRun,
    failed_run_tax: {
      action: 'inspect_primary_blocker',
      primary_blocker: null,
      elapsed_seconds: 120,
    },
    typed_next_action: {
      action: 'inspect_primary_blocker',
      command: 'gh run view 12351 --log-failed',
      reason: 'Previous failed run.',
    },
    owner_receipt: {
      state: 'not_provided',
      verify_command: 'npm run release:owner-candidate-record:verify -- --version 26.7.9',
    },
    post_publish_follow_up: {
      state: 'not_applicable_until_release_published',
      summary: 'Post-publish follow-up is not applicable until the candidate is promoted or a published-with-follow-up state exists.',
    },
    truth_boundary: 'release-session is an operator control surface derived from run status; it is not release truth and cannot publish, promote, or write runtime truth.',
  });
}

test('release cohort planner writes pinned cohort JSON and typed next action', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-cohort-'));
  const refs = createReleaseRefCheckouts();
  const outputPath = path.join(tempRoot, 'release-cohort-plan.json');
  const markdownPath = path.join(tempRoot, 'release-cohort-plan.md');
  const result = runScript('scripts/plan-release-cohort.ts', [
    '--version',
    '26.6.99',
    '--release-mode',
    'new_release',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--app-commit',
    refs.appHead,
    '--shell-ref',
    'main',
    '--framework-ref',
    'main',
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
  const stdout = JSON.parse(result.stdout);
  const plan = readJson(outputPath);
  assert.equal(stdout.schema, 'opl_app_release_cohort_plan.v1');
  assert.equal(plan.schema, 'opl_app_release_cohort_plan.v1');
  assert.equal(plan.version, '26.6.99');
  assert.equal(plan.tag, 'v26.6.99');
  assert.equal(plan.app_commit, refs.appHead);
  assert.equal(plan.shell_ref, 'main');
  assert.equal(plan.framework_ref, 'main');
  assert.equal(plan.cohort_lock.app.requested_ref, refs.appHead);
  assert.equal(plan.cohort_lock.app.resolved_sha, refs.appHead);
  assert.equal(plan.cohort_lock.shell.requested_ref, 'main');
  assert.equal(plan.cohort_lock.shell.resolved_sha, refs.shell.head);
  assert.equal(plan.cohort_lock.framework.requested_ref, 'main');
  assert.equal(plan.cohort_lock.framework.resolved_sha, refs.framework.head);
  assert.equal(plan.include_full_package, true);
  assert.equal(plan.run_vm_smoke, true);
  assert.equal(plan.next_action.action, 'run_release_train_with_vm_smoke');
  assert.match(plan.next_action.command, new RegExp(`--ref ${refs.appHead}`));
  assert.match(plan.next_action.command, new RegExp(`--field shell_ref=${refs.shell.head}`));
  assert.match(plan.next_action.command, new RegExp(`--field framework_ref=${refs.framework.head}`));
  assert.doesNotMatch(plan.next_action.command, /shell_ref=main|framework_ref=main/);
  for (const id of ['release_cohort_lock', 'release_source_gate', 'release_preflight', 'full_package_prune_audit']) {
    assert.ok(plan.cheap_gates.some((gate: { id: string }) => gate.id === id), id);
  }
  assert.equal(plan.authority_boundary.cohort_plan_can_publish_release, false);
  assert.equal(plan.authority_boundary.cohort_plan_can_write_runtime_truth, false);
});

test('release operator plan reuses cohort plan and writes operator state', () => {
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
    'false',
    '--run-vm-smoke',
    'false',
    '--app-commit',
    refs.appHead,
    '--shell-ref',
    'main',
    '--framework-ref',
    'main',
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
  assert.equal(state.schema, 'opl_app_release_operator_state.v1');
  assert.equal(state.command, 'plan');
  assert.equal(state.status, 'planned');
  assert.equal(state.cohort_plan.schema, 'opl_app_release_cohort_plan.v1');
  assert.equal(state.cohort_plan.app_commit, refs.appHead);
  assert.equal(state.cohort_plan.cohort_lock.app.requested_ref, refs.appHead);
  assert.equal(state.cohort_plan.cohort_lock.shell.resolved_sha, refs.shell.head);
  assert.equal(state.cohort_plan.cohort_lock.framework.resolved_sha, refs.framework.head);
  assert.equal(state.next_action.action, 'follow_cohort_plan');
  assert.match(state.next_action.command, new RegExp(`--shell-ref ${refs.shell.head}`));
  assert.match(state.next_action.command, new RegExp(`--framework-ref ${refs.framework.head}`));
  assert.doesNotMatch(state.next_action.command, /--shell-ref main|--framework-ref main/);
  assert.equal(state.operator_guidance.currentness_freeze.required_before_dispatch, true);
  assert.equal(state.operator_guidance.currentness_freeze.dispatch_input_source, 'release_cohort_plan_or_lock');
  assert.equal(state.operator_guidance.currentness_freeze.single_desktop_release_per_frozen_cohort, true);
  assertNoOperatorAuthority(state.authority_boundary);
});

test('release operator status reports completed failure primary blocker', () => {
  const { result, state } = runStatus('opl-release-operator-status-failed-', {
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

  const stdout = JSON.parse(result.stdout);
  assert.equal(stdout.status, 'failed');
  assert.equal(state.schema, 'opl_app_release_operator_state.v1');
  assert.equal(state.command, 'status');
  assert.equal(state.status, 'failed');
  assert.equal(state.run.status, 'completed');
  assert.equal(state.run.conclusion, 'failure');
  assert.equal(state.is_stale, false);
  assert.equal(state.primary_blocker.type, 'step');
  assert.equal(state.primary_blocker.job_name, 'Build App-owned DMG');
  assert.equal(state.primary_blocker.step_name, 'Package app');
  assert.equal(state.recommended_next_action.action, 'inspect_primary_blocker');
  assert.match(state.recommended_next_action.command, /gh run view 12345 --repo gaofeng21cn\/one-person-lab-app --log-failed/);
  assertNoOperatorAuthority(state.authority_boundary);
});

test('release operator status reports successful current run as ready for closeout review', () => {
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
  }, ['--version', '26.6.29', '--expected-head', headE]);
  assert.equal(state.status, 'ready_for_closeout_review');
  assert.equal(state.run.id, '45678');
  assert.equal(state.run.conclusion, 'success');
  assert.equal(state.is_stale, false);
  assert.equal(state.primary_blocker, null);
  assert.equal(state.recommended_next_action.action, 'inspect_release_closeout_evidence');
  assert.match(state.recommended_next_action.command, /npm run release:closeout -- --version 26\.6\.29 --run-id 45678/);
});
