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
