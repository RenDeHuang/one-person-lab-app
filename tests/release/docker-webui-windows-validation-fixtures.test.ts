import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { appRoot } from './release-readiness/helpers.ts';

const fixtureDir = path.join(
  appRoot,
  'docs',
  'delivery',
  'user-guides',
  'docker-webui-install',
  'fixtures',
);
const cleanInstallRunnerPath = path.join(fixtureDir, 'windows-clean-install-run.ps1');
const hostReadbackPath = path.join(fixtureDir, 'windows-host-readback.ps1');

test('Windows clean-install fixture cannot reuse the previous Compose runtime', () => {
  const runner = fs.readFileSync(cleanInstallRunnerPath, 'utf8');
  const downIndex = runner.indexOf("'compose', '--project-directory', $InstallRoot, '-f', $previousComposePath, 'down', '--remove-orphans'");
  const moveIndex = runner.indexOf('Move-Item -LiteralPath $InstallRoot -Destination $backupRoot');
  const installerIndex = runner.indexOf('& $installerPath @installerArguments');

  assert.ok(downIndex >= 0, 'the previous Compose project must be stopped');
  assert.ok(moveIndex > downIndex, 'the old runtime must be stopped before its install root moves');
  assert.ok(installerIndex > moveIndex, 'the public installer must run only after the old install root moves');
  assert.match(runner, /'compose', '--project-directory', \$InstallRoot, '-f', \$previousComposePath, 'down', '--remove-orphans'/);
  assert.match(runner, /previous-runtime-down\.txt/);
  assert.match(runner, /rollback directory exists without a previous-runtime-down marker/);
  assert.ok(
    runner.indexOf("Set-Content -LiteralPath $previousRuntimeDownMarkerPath") < moveIndex,
    'the successful runtime-down marker must be durable before the old install root moves',
  );
  assert.match(runner, /previous_runtime_down = \$previousRuntimeDown/);
  assert.match(runner, /install_root_moved = \$installRootMoved/);
  assert.match(runner, /sourceFullPath\.Equals\(\$destinationFullPath/);
  assert.match(runner, /Set-Content -LiteralPath \(Join-Path \$validationDockerConfig 'config\.json'\) -Value '\{\}'/);
  assert.match(runner, /\[int\]\$WorkerTimeoutMinutes = 55/);
  assert.match(runner, /ExecutionTimeLimit \(New-TimeSpan -Minutes \(\$WorkerTimeoutMinutes \+ 5\)\)/);
  assert.match(runner, /\[int\]\$MinimumSystemDriveFreeGiB = 5/);
  assert.match(runner, /system_drive_free_below_floor/);
  assert.match(runner, /Stop-ValidationWorkerOperation/);
  assert.match(runner, /taskkill\.exe \/PID \$workerProcess\.ProcessId \/T \/F/);
  assert.match(runner, /objective_status = 'repair_required'/);
  assert.match(runner, /resume_run_id = \$RunId/);
  assert.match(runner, /Resuming the same clean-install RunId after a bounded repair checkpoint/);
  assert.doesNotMatch(runner, /Timed out waiting for the interactive public installer worker/);
});

test('Windows WebUI validation fixtures remain a small reusable surface', () => {
  const files = fs
    .readdirSync(fixtureDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(files, [
    'README.md',
    'windows-clean-install-run.ps1',
    'windows-host-readback.ps1',
  ]);
  const readback = fs.readFileSync(hostReadbackPath, 'utf8');
  assert.match(readback, /opl_windows_docker_webui_host_readback\.v1/);
  assert.match(readback, /One Person Lab WebUI Latest Update/);
  assert.match(readback, /Get-HttpSummary -Url \$HealthUrl/);
  assert.match(readback, /\[int\]\$NativeCommandTimeoutSeconds = 30/);
  assert.match(readback, /\[int\]\$InventoryTimeoutSeconds = 30/);
  assert.match(readback, /taskkill\.exe \/PID \$process\.Id \/T \/F/);
  assert.match(readback, /timed_out = \$true/);
  assert.match(readback, /docker\.daemon_available/);
  assert.match(readback, /docker_daemon_probe_timed_out/);
  assert.match(readback, /skipped_after_breakpoint/);
  assert.doesNotMatch(readback, /\$output = & \$FilePath @Arguments/);
});

test('Windows Docker/WebUI smoke runbook keeps repairing toward a usable terminal state', () => {
  const runbookPath = path.join(appRoot, 'docs', 'delivery', 'install', 'docker-webui-smoke-gates.md');
  const runbook = fs.readFileSync(runbookPath, 'utf8');

  assert.match(runbook, /A timeout or\s+non-zero exit stops the \*\*current operation\*\*, not the validation objective/);
  assert.match(runbook, /Do not start parallel `vmrun`, PowerShell, Docker, or browser probes/);
  assert.match(runbook, /resume the same `RunId`/);
  assert.match(runbook, /Continue until the installer, data preservation, scheduled-task, digest,\s+HTTP, and UI checks all pass/);
  assert.match(runbook, /one targeted restart/);
  assert.doesNotMatch(runbook, /失败即停止/);
});
