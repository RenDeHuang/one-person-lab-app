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

test('release guide documents no-watch operator runbook and lane boundaries', () => {
  const guide = fs.readFileSync(path.join(appRoot, 'docs', 'delivery', 'release', 'README.md'), 'utf8');

  for (const requiredText of [
    'No-watch operator runbook',
    'npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha>',
    "jq '{state, run: .run, next: .recommended_next_action, failed_gate_count, failed_job_count}'",
    'release-operator-state.json#status',
    'release-monitor.json#state',
    'primary_blocker',
    'recommended_next_action',
    'failed_gate_draining',
    'stale_candidate',
    'dispatch a new cohort',
    'Pinned cohort runbook',
    'Sync preparation',
    'moving refs to immutable values',
    'shell SHA',
    'framework SHA',
    'Moving `main`, shell `main`, and framework `main` are allowed only as',
    'preparation-time ref-resolution sources',
    'pinned cohort lock',
    'Source-gate blockers are repaired at the source gate',
    'old-cohort diagnostics only',
    'Desktop stable, WebUI GHCR, and diagnostics are separate lanes',
    'Docker/WebUI runtime image publish failure',
    'workflow_wall_time_seconds',
    'agent_orchestration_wall_time_seconds',
    'DORA-style lead time',
    'DORA-style MTTR',
    'DORA-style change failure',
    'They are not release-ready',
  ]) {
    assert.ok(guide.includes(requiredText), `release guide must document ${requiredText}`);
  }

  assert.match(guide, /28391573356[\s\S]*standard clean VM smoke failed/);
  assert.match(guide, /28391599033[\s\S]*not label that WebUI GHCR failure as an App source-gate failure/);
});

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
  assert.ok(plan.cheap_gates.some((gate: { id: string }) => gate.id === 'release_cohort_lock'));
  assert.ok(plan.cheap_gates.some((gate: { id: string }) => gate.id === 'release_source_gate'));
  assert.ok(plan.cheap_gates.some((gate: { id: string }) => gate.id === 'release_preflight'));
  assert.ok(plan.cheap_gates.some((gate: { id: string }) => gate.id === 'full_package_prune_audit'));
  assert.equal(plan.authority_boundary.cohort_plan_can_publish_release, false);
  assert.equal(plan.authority_boundary.cohort_plan_can_write_runtime_truth, false);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Release Cohort Plan/);
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
  assert.equal(state.authority_boundary.operator_can_publish_release, false);
  assert.equal(state.authority_boundary.operator_can_write_runtime_truth, false);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Release Operator State/);
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
  assert.equal(state.authority_boundary.operator_can_dispatch_workflow_without_explicit_user_action, false);
  for (const command of state.diagnostic_commands) {
    assert.equal(command.dispatches_workflow, false);
    assert.equal(command.publishes_release, false);
    assert.match(command.command, /^gh workflow run /);
  }
  assert.ok(
    state.diagnostic_commands.some((command: { command: string }) => command.command.includes('OPL GUI First-Run VM')),
  );
  assert.ok(
    state.diagnostic_commands.some((command: { command: string }) => command.command.includes('desktop-release-diagnostics.yml')),
  );
});

test('release operator status reports completed failure primary blocker', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-failed-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  writeJson(runJsonPath, {
    databaseId: 12345,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'failure',
    headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
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

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const stdout = JSON.parse(result.stdout);
  const state = readJson(outputPath);
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

test('release operator status --summary emits one-screen human summary', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-summary-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  writeJson(runJsonPath, {
    databaseId: 12347,
    workflowName: 'OPL Desktop Release',
    status: 'completed',
    conclusion: 'success',
    headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
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
    '--summary',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^Release operator status$/m);
  assert.match(result.stdout, /^Status: ready_for_closeout_review$/m);
  assert.match(result.stdout, /^Next action: inspect_release_closeout_evidence$/m);
  assert.throws(() => JSON.parse(result.stdout), SyntaxError);
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
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `opl-release-operator-blocker-${entry.name}-`));
    const runJsonPath = path.join(tempRoot, 'run.json');
    const outputPath = path.join(tempRoot, 'release-operator-state.json');
    writeJson(runJsonPath, {
      databaseId: 50000,
      workflowName: entry.workflowName,
      status: 'completed',
      conclusion: 'failure',
      headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
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

    const result = runScript('scripts/release-operator.ts', [
      'status',
      '--run-json',
      runJsonPath,
      '--output',
      outputPath,
    ]);

    assert.equal(result.status, 0, `${entry.name}: ${result.stderr || result.stdout}`);
    const state = readJson(outputPath);
    assert.equal(state.next_action.action, entry.expectedAction, entry.name);
  }
});

test('release operator status reports phase current step elapsed and budget for in-progress runs', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-progress-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  writeJson(runJsonPath, {
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

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
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

test('release operator status attention budget calls out opaque WebUI publish steps', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-webui-progress-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  writeJson(runJsonPath, {
    databaseId: 67890,
    workflowName: 'OPL WebUI GHCR Release',
    status: 'in_progress',
    conclusion: null,
    createdAt: '2026-06-29T19:53:18Z',
    updatedAt: '2026-06-29T19:53:23Z',
    headSha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    jobs: [
      {
        name: 'Build, verify, and publish WebUI GHCR image',
        status: 'in_progress',
        conclusion: null,
        startedAt: '2026-06-29T19:53:22Z',
        steps: [
          {
            name: 'Build, verify, and publish Docker WebUI',
            status: 'in_progress',
            conclusion: null,
            startedAt: '2026-06-29T19:54:10Z',
          },
        ],
      },
    ],
  });

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--summary',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^Status: waiting_for_run_completion$/m);
  assert.match(result.stdout, /^Current step: Build, verify, and publish Docker WebUI$/m);
  assert.match(result.stdout, /^Budget: attention$/m);
  assert.match(result.stdout, /^Next action: inspect_current_step_progress$/m);
});

test('release operator status reports failed gate while run is draining', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-status-draining-'));
  const runJsonPath = path.join(tempRoot, 'run.json');
  const outputPath = path.join(tempRoot, 'release-operator-state.json');
  writeJson(runJsonPath, {
    databaseId: 23456,
    workflowName: 'OPL Desktop Release',
    status: 'in_progress',
    conclusion: null,
    headSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
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

  const result = runScript('scripts/release-operator.ts', [
    'status',
    '--run-json',
    runJsonPath,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const state = readJson(outputPath);
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
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Primary blocker: none/);
});
