import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptPath = path.join(appRoot, 'scripts', 'write-first-run-vm-critical-diagnostics.ts');

function runDiagnostics(env: NodeJS.ProcessEnv, seed?: (cwd: string) => void) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-vm-critical-diagnostics-'));
  seed?.(cwd);
  const result = spawnSync(process.execPath, ['--experimental-strip-types', scriptPath], {
    cwd,
    env: {
      ...process.env,
      GITHUB_REPOSITORY: 'gaofeng21cn/one-person-lab-app',
      GITHUB_RUN_ID: '12345',
      PACKAGE_PROFILE: 'standard',
      DIAGNOSTIC_SCOPE: 'release_gate',
      INSTALL_MODE: 'dmg',
      ...env,
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summaryPath = path.join(
    cwd,
    'artifacts',
    'opl-first-run-vm-critical-diagnostics',
    'vm-gate-failure-summary.json',
  );
  return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
}

function writeJson(cwd: string, relativePath: string, payload: unknown) {
  const filePath = path.join(cwd, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

test('VM critical diagnostics classify failed artifact download and keep same-artifact retry scoped to VM only', () => {
  const summary = runDiagnostics({
    RELEASE_ARTIFACT_NAME: 'macos-build-arm64-dmg',
    RELEASE_ARTIFACT_RUN_ID: '777',
    RELEASE_ARTIFACT_DOWNLOAD_OUTCOME: 'failure',
    DMG_CONCLUSION: 'failure',
    VM_SMOKE_CONCLUSION: 'skipped',
  });

  assert.equal(summary.schema_version, 2);
  assert.equal(summary.failure.type, 'artifact_download_failed');
  assert.equal(summary.failure.boundary, 'workflow_artifact_download');
  assert.equal(summary.retry_entry.action, 'rerun_diagnostic_same_artifact');
  assert.equal(summary.retry_entry.scope, 'vm_qualification_only_same_cohort');
  assert.equal(summary.retry_entry.rebuilds_standard_or_full_artifact, false);
  assert.match(summary.retry_entry.command_hint, /release_artifact_name=macos-build-arm64-dmg/);
  assert.match(summary.retry_entry.command_hint, /release_artifact_run_id=777/);
});

test('VM critical diagnostics classify missing release asset before VM work', () => {
  const summary = runDiagnostics({
    RELEASE_TAG: 'v26.7.5',
    RELEASE_ARTIFACT_DOWNLOAD_OUTCOME: 'skipped',
    DMG_CONCLUSION: 'failure',
    VM_SMOKE_CONCLUSION: 'skipped',
  });

  assert.equal(summary.failure.type, 'release_asset_missing');
  assert.equal(summary.failure.boundary, 'resolve_release_dmg');
  assert.equal(summary.retry_entry.action, 'provide_existing_dmg_or_release_artifact_then_rerun_vm');
  assert.equal(summary.retry_entry.rebuilds_standard_or_full_artifact, false);
});

test('VM critical diagnostics distinguish Tart launch failure from App readiness failure', () => {
  const launchSummary = runDiagnostics(
    {
      RELEASE_ARTIFACT_DOWNLOAD_OUTCOME: 'success',
      DMG_CONCLUSION: 'success',
      VM_SMOKE_CONCLUSION: 'failure',
    },
    (cwd) => writeJson(cwd, 'artifacts/opl-first-run-vm/tart-smoke-summary.json', {
      status: 'failed',
      failure_stage: 'wait_for_ssh',
      error: 'Timed out waiting for SSH',
    }),
  );
  assert.equal(launchSummary.failure.type, 'vm_launch_failed');
  assert.equal(launchSummary.failure.boundary, 'wait_for_ssh');

  const appReadySummary = runDiagnostics(
    {
      RELEASE_ARTIFACT_DOWNLOAD_OUTCOME: 'success',
      DMG_CONCLUSION: 'success',
      VM_SMOKE_CONCLUSION: 'failure',
    },
    (cwd) => writeJson(cwd, 'artifacts/opl-first-run-vm/tart-smoke-summary.json', {
      status: 'failed',
      failure_stage: 'run_guest_smoke',
      error: 'Guid page did not become ready before assistant route smoke',
      guest_summary: {
        status: 'failed',
        error: 'Guid page did not become ready before assistant route smoke',
      },
    }),
  );
  assert.equal(appReadySummary.failure.type, 'app_ready_failed');
  assert.equal(appReadySummary.failure.boundary, 'guest_app_ready');
});

test('VM critical diagnostics classify OPL configure-codex failures before App readiness', () => {
  const summary = runDiagnostics(
    {
      RELEASE_ARTIFACT_DOWNLOAD_OUTCOME: 'success',
      DMG_CONCLUSION: 'success',
      VM_SMOKE_CONCLUSION: 'failure',
    },
    (cwd) => writeJson(cwd, 'artifacts/opl-first-run-vm/tart-smoke-summary.json', {
      status: 'failed',
      failure_stage: 'run_guest_smoke',
      error: 'opl system configure-codex --api-key-stdin --json failed before bootstrap readiness',
    }),
  );

  assert.equal(summary.failure.type, 'opl_configure_codex_failed');
  assert.equal(summary.failure.boundary, 'guest_opl_configuration');
  assert.match(summary.failure.reason, /before App readiness checks/);
});

test('VM critical diagnostics keep Settings contract failures out of App readiness', () => {
  const summary = runDiagnostics(
    {
      RELEASE_ARTIFACT_DOWNLOAD_OUTCOME: 'success',
      DMG_CONCLUSION: 'success',
      VM_SMOKE_CONCLUSION: 'failure',
    },
    (cwd) => writeJson(cwd, 'artifacts/opl-first-run-vm/tart-smoke-summary.json', {
      status: 'failed',
      failure_stage: 'run_guest_smoke',
      error: 'Advanced Settings did not expose the OPL Developer Profile status after page readiness polling',
      guest_summary: {
        status: 'failed',
        error: 'Advanced Settings did not expose the OPL Developer Profile status',
      },
    }),
  );

  assert.equal(summary.failure.type, 'settings_smoke_failed');
  assert.equal(summary.failure.boundary, 'guest_settings_smoke');
  assert.notEqual(summary.failure.type, 'app_ready_failed');
});

test('VM critical diagnostics keep Home assistant route failures out of App readiness', () => {
  const summary = runDiagnostics(
    {
      RELEASE_ARTIFACT_DOWNLOAD_OUTCOME: 'success',
      DMG_CONCLUSION: 'success',
      VM_SMOKE_CONCLUSION: 'failure',
    },
    (cwd) => writeJson(cwd, 'artifacts/opl-first-run-vm/tart-smoke-summary.json', {
      status: 'failed',
      failure_stage: 'run_guest_smoke',
      error: 'Could not select OPL built-in assistant: med-autoscience',
    }),
  );

  assert.equal(summary.failure.type, 'assistant_route_smoke_failed');
  assert.equal(summary.failure.boundary, 'guest_assistant_route_smoke');
  assert.notEqual(summary.failure.type, 'app_ready_failed');
});
