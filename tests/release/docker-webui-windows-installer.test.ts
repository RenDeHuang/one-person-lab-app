import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const installerPath = path.join(appRoot, 'scripts', 'install-docker-webui.ps1');
const installer = fs.readFileSync(installerPath, 'utf8');
const pwshPath = findPwsh();
const paramBlock = installer.match(/param\([\s\S]*?\n\)/)?.[0] ?? '';

function findPwsh() {
  if (process.env.PWSH) {
    return process.env.PWSH;
  }
  const result = spawnSync('/bin/sh', ['-lc', 'command -v pwsh'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function runPwsh(args: string[]) {
  if (!pwshPath) {
    return null;
  }
  return spawnSync(pwshPath, args, { cwd: appRoot, encoding: 'utf8' });
}

test('Windows Docker/WebUI installer exposes the required small parameter surface', () => {
  for (const parameter of [
    'DryRun',
    'Yes',
    'Port',
    'Image',
    'Tag',
    'DataDir',
    'ProjectsDir',
    'HealthTimeoutSeconds',
    'HealthUrl',
    'DiagnosticsDir',
    'DiagnosticsArchive',
    'EvidenceDir',
    'InstallPrerequisites',
    'NoOpen',
    'Foreground',
  ]) {
    assert.match(installer, new RegExp(`\\$${parameter}\\b`), `missing -${parameter}`);
  }

  assert.doesNotMatch(paramBlock, /ApiKey|API_KEY|OPENAI_API_KEY|GFLABTOKEN|Secret/i);
  assert.doesNotMatch(installer, /OPENAI_API_KEY|ANTHROPIC_API_KEY|GFLABTOKEN/i);
});

test('Windows Docker/WebUI installer writes a compose file with the App-owned WebUI boundary', () => {
  assert.match(installer, /compose\.yaml/);
  assert.match(installer, /docker @composeArgs/);
  assert.match(installer, /ghcr\.io\/gaofeng21cn\/one-person-lab-webui/);
  assert.match(installer, /127\.0\.0\.1:\$\{HostPort\}:3000/);
  assert.match(installer, /AIONUI_ALLOW_REMOTE/);
  assert.match(installer, /AIONUI_DATA_DIR:\s*\/data/);
  assert.match(installer, /OPL_PROJECTS_DIR:\s*\/projects/);
  assert.match(installer, /\$\{HostDataDir\}:\/data/);
  assert.match(installer, /\$\{HostProjectsDir\}:\/projects/);
});

test('Windows Docker/WebUI installer gates prerequisite installation behind an explicit admin switch', () => {
  assert.match(installer, /Test-WindowsHost/);
  assert.match(installer, /\[Version\]"5\.1"/);
  assert.match(installer, /Get-Command docker/);
  assert.match(installer, /docker info/);
  assert.match(installer, /docker compose version/);
  assert.match(installer, /Wait-WebUiHealth/);
  assert.match(installer, /Test-WebUiHttpHealth/);
  assert.match(installer, /Invoke-WebRequest/);
  assert.match(installer, /Collect-WebUiDiagnostics/);
  assert.match(installer, /docker-compose-ps\.txt/);
  assert.match(installer, /docker-compose-logs\.txt/);
  assert.match(installer, /docker-version\.txt/);
  assert.match(installer, /docker-compose-version\.txt/);
  assert.match(installer, /http-probe\.txt/);
  assert.match(installer, /directories\.txt/);
  assert.match(installer, /data-preservation\.txt/);
  assert.match(installer, /pre_data_inventory/);
  assert.match(installer, /post_data_inventory/);
  assert.match(installer, /Get-PathInventoryText/);
  assert.match(installer, /Compress-Archive/);
  assert.match(installer, /ConvertFrom-DiagnosticSensitiveText/);
  assert.doesNotMatch(installer, /Get-ChildItem\s+Env:|docker compose config/);
  assert.match(installer, /Get-Command wsl\.exe/);
  assert.match(installer, /\[switch\]\$InstallPrerequisites/);
  assert.match(installer, /Run PowerShell as Administrator when using -InstallPrerequisites/);
  assert.match(installer, /if \(-not \$InstallPrerequisites\) \{\s*return\s*\}/);
  assert.match(installer, /wsl --install/);
  assert.match(installer, /winget install Docker\.DockerDesktop/);
  assert.match(installer, /winget\.exe install --id Docker\.DockerDesktop --exact --accept-package-agreements --accept-source-agreements/);
  assert.match(installer, /wsl\.exe --install --no-distribution/);
  assert.match(installer, /wsl\.exe --set-default-version 2/);
  assert.match(installer, /Docker Desktop did not become ready within 180 seconds/);
  assert.match(installer, /Start-DockerDesktopIfPresent/);
  assert.doesNotMatch(installer, /Start-Process\s+(winget|wsl)/);
});

test('Windows Docker/WebUI installer parses and dry-runs when PowerShell is available', { skip: !pwshPath }, () => {
  const escapedInstallerPath = installerPath.replaceAll("'", "''");
  const parse = runPwsh([
    '-NoLogo',
    '-NoProfile',
    '-Command',
    `$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile('${escapedInstallerPath}',[ref]$tokens,[ref]$errors) | Out-Null;if($errors.Count){$errors | ForEach-Object { Write-Error $_ }; exit 1 }`,
  ]);
  assert.ok(parse, 'pwsh should be available for this test');
  assert.equal(parse.status, 0, parse.stderr || parse.stdout);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-installer-'));
  const dryRun = runPwsh([
    '-NoLogo',
    '-NoProfile',
    '-File',
    installerPath,
    '-DryRun',
    '-Yes',
    '-Port',
    '3133',
    '-HealthTimeoutSeconds',
    '5',
    '-DataDir',
    path.join(tempRoot, 'data'),
    '-ProjectsDir',
    path.join(tempRoot, 'projects'),
    '-DiagnosticsDir',
    path.join(tempRoot, 'diagnostics'),
    '-DiagnosticsArchive',
    path.join(tempRoot, 'diagnostics.zip'),
    '-NoOpen',
  ]);
  assert.ok(dryRun, 'pwsh should be available for this test');
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  assert.match(dryRun.stdout, /Dry run: would write/);
  assert.match(dryRun.stdout, /127\.0\.0\.1:3133:3000/);
  assert.match(dryRun.stdout, /ghcr\.io\/gaofeng21cn\/one-person-lab-webui:latest/);
  assert.match(dryRun.stdout, /docker compose .* up -d/);
  assert.match(dryRun.stdout, /would wait up to 5s for WebUI HTTP health at http:\/\/localhost:3133\//);
  assert.match(dryRun.stdout, /would write diagnostic directory .*diagnostics/);
  assert.match(dryRun.stdout, /would include compose\.yaml, docker versions, compose ps\/logs, HTTP probe summary, directory\/port\/image metadata/);
  assert.match(dryRun.stdout, /would write diagnostic archive .*diagnostics\.zip/);
  assert.equal(fs.existsSync(path.join(tempRoot, 'compose.yaml')), false, 'dry-run must not create compose.yaml');
});

test('Windows Docker/WebUI prerequisite mode is explicit and dry-runnable when PowerShell is available', { skip: !pwshPath }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-prereq-'));
  const dryRun = runPwsh([
    '-NoLogo',
    '-NoProfile',
    '-File',
    installerPath,
    '-DryRun',
    '-Yes',
    '-InstallPrerequisites',
    '-Port',
    '3134',
    '-DataDir',
    path.join(tempRoot, 'data'),
    '-ProjectsDir',
    path.join(tempRoot, 'projects'),
    '-NoOpen',
  ]);
  assert.ok(dryRun, 'pwsh should be available for this test');
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  assert.match(dryRun.stdout, /would install Docker Desktop with winget if docker CLI is missing/);
  assert.match(dryRun.stdout, /would enable WSL 2 prerequisites before checking wsl --status/);
  assert.match(dryRun.stdout, /127\.0\.0\.1:3134:3000/);
  assert.equal(fs.existsSync(path.join(tempRoot, 'compose.yaml')), false, 'dry-run must not create compose.yaml');
});
