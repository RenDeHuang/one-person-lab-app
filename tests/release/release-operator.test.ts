import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot } from './release-readiness/helpers.ts';

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

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath: string, payload: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
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
  ]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { ...paths, result, state: readJson(paths.outputPath) };
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
  assert.equal(state.authority_boundary.operator_can_publish_release, false);
  assert.equal(state.authority_boundary.operator_can_write_runtime_truth, false);
});

test('release operator VM diagnostics only emits non-dispatching suggested commands', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-diagnose-'));
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  const result = runScript('scripts/release-operator.ts', [
    'diagnose-vm',
    '--version',
    '26.6.99',
    '--release-mode',
    'refresh_existing',
    '--release-artifact-run-id',
    '123456789',
    '--release-artifact-name',
    'macos-build-arm64-dmg',
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
  assert.equal(state.schema, 'opl_app_release_operator_state.v1');
  assert.equal(state.command, 'diagnose-vm');
  assert.equal(state.status, 'diagnostic_command_ready');
  assert.equal(state.next_action.action, 'rerun_diagnostic_same_artifact');
  assert.match(state.next_action.command, /desktop-release-diagnostics\.yml/);
  assert.match(state.next_action.command, /--field package_profile="standard"/);
  assert.equal(state.authority_boundary.operator_can_dispatch_workflow_without_explicit_user_action, false);
  assert.ok(state.diagnostic_commands.every((command) => !command.dispatches_workflow && !command.publishes_release));
  assert.ok(
    state.diagnostic_commands.some((command: { command: string }) =>
      command.command.includes('desktop-release-diagnostics.yml')
      && command.command.includes('diagnostic_scope="existing_artifact"')
    ),
  );
});

test('release operator status applies Full and same-artifact SLA profiles', () => {
  const recentAt = new Date(Date.now() - 60 * 1000).toISOString();
  const cases = [
    {
      name: 'stable-full',
      startedAt: new Date(Date.now() - 76 * 60 * 1000).toISOString(),
      expectedProfile: 'stable_full_docker_vm',
      expectedAttention: 4500,
      expectedHardStop: 5400,
      expectedNextActionReason: /attention SLA/,
      run: {
        databaseId: 12349,
        workflowName: 'OPL Desktop Release',
        status: 'in_progress',
        conclusion: null,
        updatedAt: recentAt,
        headSha: headA,
        jobs: [
          {
            name: 'Build Full first-install assets / Build App-owned Full first-install DMG',
            status: 'completed',
            conclusion: 'success',
          },
          {
            name: 'Run Full first-run VM smoke / Clean VM first launch',
            status: 'completed',
            conclusion: 'success',
          },
          {
            name: 'Validate operator evidence bundle',
            status: 'in_progress',
            conclusion: null,
            startedAt: recentAt,
            steps: [{ name: 'Collect operator evidence', status: 'in_progress', conclusion: null, startedAt: recentAt }],
          },
        ],
      },
    },
    {
      name: 'same-artifact-vm',
      startedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      expectedProfile: 'same_artifact_vm_gate',
      expectedAttention: 900,
      expectedHardStop: 1800,
      run: {
        databaseId: 12351,
        workflowName: 'OPL GUI First-Run VM',
        status: 'in_progress',
        conclusion: null,
        updatedAt: recentAt,
        headSha: headA,
        jobs: [
          {
            name: 'Run clean VM first launch smoke',
            status: 'in_progress',
            conclusion: null,
            startedAt: recentAt,
            steps: [{ name: 'Run clean VM first launch smoke', status: 'in_progress', conclusion: null, startedAt: recentAt }],
          },
        ],
      },
    },
  ];

  for (const entry of cases) {
    const { state } = runStatus(`opl-release-operator-status-${entry.name}-`, {
      ...entry.run,
      startedAt: entry.startedAt,
    });
    assert.equal(state.status, 'waiting_for_run_completion', entry.name);
    assert.equal(state.budget.status, 'attention', entry.name);
    assert.equal(state.budget.run_sla_profile, entry.expectedProfile, entry.name);
    assert.equal(state.budget.run_sla_status, 'attention', entry.name);
    assert.equal(state.budget.run_attention_seconds, entry.expectedAttention, entry.name);
    assert.equal(state.budget.run_hard_stop_seconds, entry.expectedHardStop, entry.name);
    if (entry.expectedNextActionReason) {
      assert.equal(state.next_action.action, 'inspect_current_step_progress');
      assert.match(state.next_action.reason, entry.expectedNextActionReason);
    }
  }
});

test('release operator status routes VM failures to same-artifact diagnostics instead of full release reruns', () => {
  const { state } = runStatus('opl-release-operator-status-vm-diagnostic-', {
    databaseId: 12350,
    workflowName: 'OPL Desktop Release Promote',
    status: 'completed',
    conclusion: 'failure',
    headSha: headA,
    jobs: [
      {
        name: 'Run Homebrew standard first-run VM smoke / Clean VM first launch',
        status: 'completed',
        conclusion: 'failure',
        steps: [
          { name: 'Run clean VM first launch smoke', status: 'completed', conclusion: 'failure' },
        ],
      },
    ],
  }, ['--version', '26.7.9']);

  assert.equal(state.status, 'failed');
  assert.equal(state.next_action.action, 'rerun_diagnostic_same_artifact');
  assert.match(state.next_action.command, /release:operator -- diagnose-vm/);
  assert.match(state.next_action.command, /--version "26\.7\.9"/);
  assert.match(state.next_action.command, /--release-artifact-run-id "12350"/);
  assert.match(state.next_action.command, /--release-artifact-name ""/);
  assert.match(state.next_action.command, /--package-profile "homebrew-standard"/);
  assert.match(state.next_action.command, /--diagnostic-scope release_gate/);
  assert.doesNotMatch(state.next_action.command, /desktop-release\.yml/);
  assert.match(state.next_action.reason, /same-artifact diagnostic/);
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
  assert.equal(state.authority_boundary.operator_can_publish_release, false);
  assert.equal(state.authority_boundary.operator_can_write_runtime_truth, false);
  assert.equal(state.authority_boundary.operator_can_dispatch_workflow_without_explicit_user_action, false);
});

test('release operator status writes release session manifest and one-screen failed-run tax', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-session-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  const markdownPath = path.join(tempRoot, 'release-operator-state.md');
  const sessionPath = path.join(tempRoot, 'release-session.json');
  writeJson(runJsonPath, {
    databaseId: 12352,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'failure',
    headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    url: 'https://github.example/runs/12352',
    jobs: [
      {
        name: 'Build App-owned DMG',
        status: 'completed',
        conclusion: 'failure',
        steps: [
          { name: 'Package app', status: 'completed', conclusion: 'failure' },
        ],
      },
    ],
  });

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--version',
    '26.7.9',
    '--output',
    outputPath,
    '--markdown',
    markdownPath,
    '--session-output',
    sessionPath,
    '--summary',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
  const session = readJson(sessionPath);
  assert.equal(state.session.schema, 'opl_app_release_session_manifest.v1');
  assert.equal(session.schema, 'opl_app_release_session_manifest.v1');
  assert.equal(state.session.id, 'release-session:26.7.9:12352');
  assert.equal(session.id, state.session.id);
  assert.equal(session.version, '26.7.9');
  assert.equal(session.run_set.runs[0].id, '12352');
  assert.equal(session.current_authority_run.id, '12352');
  assert.equal(session.failed_run_tax.action, 'inspect_primary_blocker');
  assert.equal(session.failed_run_tax.primary_blocker.reason, 'Step Package app in job Build App-owned DMG concluded failure.');
  assert.equal(session.typed_next_action.action, 'inspect_primary_blocker');
  assert.match(session.owner_receipt.verify_command, /--version 26\.7\.9/);
  assert.match(session.post_publish_follow_up.summary, /not applicable until/);
  assert.match(session.truth_boundary, /operator control surface/);
});

test('release operator status updates existing release session manifest with run set and refs', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-session-update-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const sessionPath = path.join(tempRoot, 'release-session.json');
  writePreviousFailedSession(sessionPath);
  writeJson(runJsonPath, {
    databaseId: 12352,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'success',
    headSha: headA,
    url: 'https://github.example/runs/12352',
    jobs: [
      {
        name: 'release-readiness',
        status: 'completed',
        conclusion: 'success',
      },
    ],
  });

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--version',
    '26.7.9',
    '--session-input',
    sessionPath,
    '--session-output',
    sessionPath,
    '--owner-receipt-ref',
    'owner-receipts/v26.7.9.json',
    '--candidate-ref',
    'release-candidate-record.json',
    '--closeout-ref',
    'release-closeout.json',
    '--readback-ref',
    'tap-readback.json',
    '--current-authority-ref',
    'release-readiness-summary.json',
    '--post-publish-follow-up-ref',
    'post-publish-follow-up.json',
    '--post-publish-follow-up-state',
    'pending',
    '--summary',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const session = readJson(sessionPath);
  assert.equal(session.id, 'release-session:26.7.9:12351');
  assert.equal(session.run_set.current_run_id, '12352');
  assert.deepEqual(session.run_set.runs.map((run) => run.id), ['12351', '12352']);
  assert.equal(session.current_authority_run.id, '12352');
  assert.equal(session.current_authority_run.ref, 'release-readiness-summary.json');
  assert.equal(session.failed_run_tax.action, 'inspect_release_closeout_evidence');
  assert.equal(session.typed_next_action.action, 'inspect_release_closeout_evidence');
  assert.equal(session.owner_receipt.state, 'provided');
  assert.equal(session.owner_receipt.ref, 'owner-receipts/v26.7.9.json');
  assert.equal(session.release_truth_refs.candidate_record, 'release-candidate-record.json');
  assert.equal(session.release_truth_refs.closeout, 'release-closeout.json');
  assert.equal(session.release_truth_refs.readback, 'tap-readback.json');
  assert.equal(session.post_publish_follow_up.state, 'pending');
  assert.equal(session.post_publish_follow_up.ref, 'post-publish-follow-up.json');
  assert.match(session.truth_boundary, /not release truth/);
});

test('release operator status does not carry stale authority refs across current runs', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-session-authority-ref-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const sessionPath = path.join(tempRoot, 'release-session.json');
  writePreviousFailedSession(sessionPath, { currentAuthorityRef: 'old-closeout.json' });
  writeJson(runJsonPath, {
    databaseId: 12352,
    workflowName: 'OPL Desktop Release',
    status: 'in_progress',
    conclusion: null,
    headSha: headA,
    url: 'https://github.example/runs/12352',
    jobs: [
      {
        name: 'release-readiness',
        status: 'in_progress',
        conclusion: null,
        steps: [{ name: 'Summarize release readiness', status: 'in_progress' }],
      },
    ],
  });

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--version',
    '26.7.9',
    '--session-input',
    sessionPath,
    '--session-output',
    sessionPath,
    '--summary',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const session = readJson(sessionPath);
  assert.equal(session.current_authority_run.id, '12352');
  assert.equal(session.current_authority_run.ref, undefined);
});

test('release operator status --json writes only JSON stdout without default root state file', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-json-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const defaultStatePath = path.join(appRoot, 'release-operator-state.json');
  const defaultStateSnapshot = snapshotFile(defaultStatePath);
  writeJson(runJsonPath, {
    databaseId: 12346,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'failure',
    headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    jobs: [
      {
        name: 'Release source gate',
        status: 'completed',
        conclusion: 'failure',
        steps: [{ name: 'Validate release source gate', status: 'completed', conclusion: 'failure' }],
      },
    ],
  });

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--json',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, '');
  const state = JSON.parse(result.stdout);
  assert.equal(state.schema, 'opl_app_release_operator_state.v1');
  assert.equal(state.status, 'failed');
  assert.equal(state.next_action.action, 'repair_source_gate');
  assertFileSnapshotUnchanged(defaultStatePath, defaultStateSnapshot);
});

test('release operator status includes owner-receipt promote fast path guidance', () => {
  const { state } = runStatus('opl-release-operator-status-owner-fast-path-', {
    databaseId: 12348,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'success',
    headSha: headA,
    jobs: [
      {
        name: 'release-readiness',
        status: 'completed',
        conclusion: 'success',
      },
    ],
  }, ['--version', '26.6.99']);

  assert.equal(state.status, 'ready_for_closeout_review');
  assert.equal(state.next_action.action, 'inspect_release_closeout_evidence');
  assert.match(state.next_action.reason, /desktop-release-promote\.yml/);
  assert.equal(
    state.operator_guidance.post_owner_receipt_fast_path.default_action,
    'verify_owner_candidate_record_then_dispatch_promote',
  );
  assert.equal(state.operator_guidance.post_owner_receipt_fast_path.desktop_release_rerun_required, false);
  assert.equal(
    state.operator_guidance.post_owner_receipt_fast_path.promote_workflow,
    '.github/workflows/desktop-release-promote.yml',
  );
  assert.match(state.operator_guidance.post_owner_receipt_fast_path.verify_command, /--version 26\.6\.99/);
});

test('release operator status maps primary blockers to domain next actions', () => {
  const cases = [
    {
      name: 'source-gate',
      jobName: 'Release source gate',
      stepName: 'Validate release source gate',
      workflowName: 'OPL Desktop Release',
      expectedAction: 'repair_source_gate',
    },
    {
      name: 'standard-vm',
      jobName: 'Run clean standard first-run VM smoke / Clean VM first launch',
      stepName: 'Run clean VM first launch smoke',
      workflowName: 'OPL Desktop Release',
      expectedAction: 'rerun_diagnostic_same_artifact',
    },
    {
      name: 'webui-runtime-image',
      jobName: 'Build, verify, and publish WebUI GHCR image',
      stepName: 'Build, verify, and publish Docker WebUI',
      workflowName: 'OPL WebUI GHCR Release',
      expectedAction: 'repair_webui_runtime_image',
    },
    {
      name: 'ghcr-permission',
      jobName: 'Build, verify, and publish WebUI GHCR image',
      stepName: 'Push Docker image to GHCR',
      workflowName: 'OPL WebUI GHCR Release',
      expectedAction: 'repair_ghcr_publish_access',
    },
  ];

  for (const entry of cases) {
    const { result, state } = runStatus(`opl-release-operator-blocker-${entry.name}-`, {
      databaseId: 50000,
      workflowName: entry.workflowName,
      status: 'completed',
      conclusion: 'failure',
      headSha: headA,
      jobs: [
        {
          name: entry.jobName,
          status: 'completed',
          conclusion: 'failure',
          steps: [
            { name: 'Set up job', status: 'completed', conclusion: 'success' },
            { name: entry.stepName, status: 'completed', conclusion: 'failure' },
          ],
        },
      ],
    });

    assert.equal(result.status, 0, `${entry.name}: ${result.stderr || result.stdout}`);
    assert.equal(state.next_action.action, entry.expectedAction, entry.name);
  }
});

test('release operator status reports phase current step elapsed and budget for in-progress runs', () => {
  const { state } = runStatus('opl-release-operator-status-progress-', {
    databaseId: 56789,
    workflowName: 'OPL Desktop Release',
    status: 'in_progress',
    conclusion: null,
    startedAt: '2026-06-29T17:45:43Z',
    updatedAt: '2026-06-29T17:50:43Z',
    headSha: 'ffffffffffffffffffffffffffffffffffffffff',
    jobs: [
      {
        name: 'Release preflight',
        status: 'completed',
        conclusion: 'success',
        startedAt: '2026-06-29T17:45:50Z',
        completedAt: '2026-06-29T17:46:05Z',
        steps: [{ name: 'Run release preflight', status: 'completed', conclusion: 'success' }],
      },
      {
        name: 'Build standard App assets / Active shell tests (dom)',
        status: 'in_progress',
        conclusion: null,
        startedAt: '2026-06-29T17:47:06Z',
        steps: [
          {
            name: 'Setup active shell dependencies',
            status: 'completed',
            conclusion: 'success',
            startedAt: '2026-06-29T17:47:09Z',
            completedAt: '2026-06-29T17:47:47Z',
          },
          {
            name: 'Run active shell test project',
            status: 'in_progress',
            conclusion: null,
            startedAt: '2026-06-29T17:47:47Z',
          },
        ],
      },
    ],
  });

  assert.equal(state.status, 'waiting_for_run_completion');
  assert.equal(state.phase, 'release_run_waiting');
  assert.equal(state.current_step.job_name, 'Build standard App assets / Active shell tests (dom)');
  assert.equal(state.current_step.step_name, 'Run active shell test project');
  assert.equal(state.current_step.status, 'in_progress');
  assert.ok(state.elapsed.seconds > 300);
  assert.equal(state.elapsed.started_at, '2026-06-29T17:45:43Z');
  assert.notEqual(state.elapsed.ended_at, '2026-06-29T17:50:43Z');
  assert.equal(state.elapsed.ended_at, state.generated_at);
  assert.equal(state.budget.status, 'attention');
  assert.equal(state.budget.elapsed_seconds, state.elapsed.seconds);
  assert.ok(state.budget.current_step_elapsed_seconds > 0);
  assert.equal(state.budget.run_updated_age_seconds, state.elapsed.seconds - 300);
  assert.equal(state.budget.threshold_seconds, 1200);
  assert.equal(state.next_action.action, 'inspect_current_step_progress');
});

test('release operator status reports failed gate while run is draining', () => {
  const { state } = runStatus('opl-release-operator-status-draining-', {
    databaseId: 23456,
    workflowName: 'OPL Desktop Release',
    status: 'in_progress',
    conclusion: null,
    headSha: headB,
    jobs: [
      {
        name: 'release-preflight',
        status: 'completed',
        conclusion: 'failure',
        steps: [{ name: 'Validate release preflight', status: 'completed', conclusion: 'failure' }],
      },
      {
        name: 'Build App-owned DMG',
        status: 'in_progress',
        conclusion: null,
      },
    ],
  });

  assert.equal(state.status, 'failed_gate_draining');
  assert.equal(state.run.status, 'in_progress');
  assert.equal(state.run.conclusion, null);
  assert.equal(state.primary_blocker.job_name, 'release-preflight');
  assert.equal(state.primary_blocker.step_name, 'Validate release preflight');
  assert.equal(state.recommended_next_action.action, 'inspect_primary_blocker');
  assert.match(state.recommended_next_action.reason, /failed while the workflow is still in_progress/);
});

test('release operator status marks stale head and points to a new cohort', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-stale-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  writeJson(runJsonPath, {
    databaseId: 34567,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'success',
    headSha: 'cccccccccccccccccccccccccccccccccccccccc',
    jobs: [
      {
        name: 'release-readiness',
        status: 'completed',
        conclusion: 'success',
      },
    ],
  });

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--expected-head',
    'dddddddddddddddddddddddddddddddddddddddd',
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
  assert.equal(state.status, 'stale_candidate');
  assert.equal(state.run.head_sha, 'cccccccccccccccccccccccccccccccccccccccc');
  assert.equal(state.expected_head, 'dddddddddddddddddddddddddddddddddddddddd');
  assert.equal(state.is_stale, true);
  assert.equal(state.primary_blocker.type, 'stale_candidate');
  assert.equal(state.recommended_next_action.action, 'start_new_cohort_from_current_main');
  assert.equal(state.recommended_next_action.publishes_release, false);
  assert.equal(state.recommended_next_action.dispatches_workflow, false);
});

test('release operator status marks cancelled stale head as superseded', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-superseded-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  writeJson(runJsonPath, {
    databaseId: 34568,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'cancelled',
    headSha: 'cccccccccccccccccccccccccccccccccccccccc',
    jobs: [
      {
        name: 'Release source gate',
        status: 'completed',
        conclusion: 'cancelled',
        steps: [{ name: 'Validate release source gate', status: 'completed', conclusion: 'cancelled' }],
      },
    ],
  });

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--expected-head',
    'dddddddddddddddddddddddddddddddddddddddd',
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
  assert.equal(state.status, 'superseded');
  assert.equal(state.phase, 'release_run_superseded');
  assert.equal(state.primary_blocker.type, 'stale_candidate');
  assert.equal(state.recommended_next_action.action, 'start_new_cohort_from_current_main');
  assert.notEqual(state.recommended_next_action.action, 'repair_source_gate');
});

test('release operator status classifies current cancelled run without source-gate repair', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-cancelled-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  writeJson(runJsonPath, {
    databaseId: 34569,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'cancelled',
    headSha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    jobs: [
      {
        name: 'Release source gate',
        status: 'completed',
        conclusion: 'cancelled',
        steps: [{ name: 'Validate release source gate', status: 'completed', conclusion: 'cancelled' }],
      },
    ],
  });

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--expected-head',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
  assert.equal(state.status, 'cancelled');
  assert.equal(state.phase, 'release_run_cancelled');
  assert.equal(state.primary_blocker.conclusion, 'cancelled');
  assert.equal(state.recommended_next_action.action, 'inspect_primary_blocker');
  assert.notEqual(state.recommended_next_action.action, 'repair_source_gate');
});

test('release operator status reports successful current run as ready for closeout review', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-ready-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  const markdownPath = path.join(tempRoot, 'release-operator-state.md');
  writeJson(runJsonPath, {
    databaseId: 45678,
    workflowName: 'OPL Desktop Release',
    displayTitle: 'Release v26.6.99',
    status: 'completed',
    conclusion: 'success',
    headSha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    url: 'https://github.example/runs/45678',
    jobs: [
      {
        name: 'release-readiness',
        status: 'completed',
        conclusion: 'success',
        steps: [{ name: 'Aggregate release readiness', status: 'completed', conclusion: 'success' }],
      },
    ],
  });

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--version',
    '26.6.29',
    '--expected-head',
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '--output',
    outputPath,
    '--markdown',
    markdownPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
  assert.equal(state.status, 'ready_for_closeout_review');
  assert.equal(state.run.id, '45678');
  assert.equal(state.run.conclusion, 'success');
  assert.equal(state.is_stale, false);
  assert.equal(state.primary_blocker, null);
  assert.equal(state.recommended_next_action.action, 'inspect_release_closeout_evidence');
  assert.match(state.recommended_next_action.command, /npm run release:closeout -- --version 26\.6\.29 --run-id 45678/);
});
