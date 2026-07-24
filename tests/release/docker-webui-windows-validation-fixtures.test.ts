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
  const downIndex = runner.indexOf('down --remove-orphans');
  const moveIndex = runner.indexOf('Move-Item -LiteralPath $InstallRoot -Destination $backupRoot');
  const installerIndex = runner.indexOf('& $installerPath @installerArguments');

  assert.ok(downIndex >= 0, 'the previous Compose project must be stopped');
  assert.ok(moveIndex > downIndex, 'the old runtime must be stopped before its install root moves');
  assert.ok(installerIndex > moveIndex, 'the public installer must run only after the old install root moves');
  assert.match(runner, /--project-directory \$InstallRoot/);
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
  assert.match(runner, /ExecutionTimeLimit \(New-TimeSpan -Minutes 45\)/);
  assert.match(runner, /AddMinutes\(40\)/);
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
  assert.match(fs.readFileSync(hostReadbackPath, 'utf8'), /opl_windows_docker_webui_host_readback\.v1/);
  assert.match(fs.readFileSync(hostReadbackPath, 'utf8'), /One Person Lab WebUI Latest Update/);
  assert.match(fs.readFileSync(hostReadbackPath, 'utf8'), /Get-HttpSummary -Url \$HealthUrl/);
});
