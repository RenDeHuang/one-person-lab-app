import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot } from './release-readiness/helpers.ts';

function runScript(script: string, args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', script, ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env },
    },
  );
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath: string, payload: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

test('release cohort planner writes pinned cohort JSON and typed next action', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-cohort-'));
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
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '--shell-ref',
    'shell-test-ref',
    '--framework-ref',
    'framework-test-ref',
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
  assert.equal(plan.app_commit, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(plan.shell_ref, 'shell-test-ref');
  assert.equal(plan.framework_ref, 'framework-test-ref');
  assert.equal(plan.include_full_package, true);
  assert.equal(plan.run_vm_smoke, true);
  assert.equal(plan.next_action.action, 'run_release_train_with_vm_smoke');
  assert.ok(plan.cheap_gates.some((gate: { id: string }) => gate.id === 'release_preflight'));
  assert.ok(plan.cheap_gates.some((gate: { id: string }) => gate.id === 'full_package_prune_audit'));
  assert.equal(plan.authority_boundary.cohort_plan_can_publish_release, false);
  assert.equal(plan.authority_boundary.cohort_plan_can_write_runtime_truth, false);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Release Cohort Plan/);
});

test('release operator plan reuses cohort plan and writes operator state', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-operator-plan-'));
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
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '--shell-ref',
    'shell-test-ref',
    '--framework-ref',
    'framework-test-ref',
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
  assert.equal(state.cohort_plan.app_commit, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.equal(state.next_action.action, 'follow_cohort_plan');
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
  assert.equal(state.recommended_next_action.action, 'repair_source_gate');
  assert.match(state.recommended_next_action.command, /gh run view 12345 --repo gaofeng21cn\/one-person-lab-app --log-failed/);
  assert.equal(state.authority_boundary.operator_can_publish_release, false);
  assert.equal(state.authority_boundary.operator_can_write_runtime_truth, false);
  assert.equal(state.authority_boundary.operator_can_dispatch_workflow_without_explicit_user_action, false);
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
  assert.match(state.recommended_next_action.command, /npm run release:closeout -- --run-id 45678/);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Primary blocker: none/);
});
