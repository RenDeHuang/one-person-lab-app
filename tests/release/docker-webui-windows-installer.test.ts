import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot } from './release-readiness/helpers.ts';

const installerPath = path.join(appRoot, 'scripts', 'install-docker-webui.ps1');
const pwshPath = findPwsh();

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
    '-Update',
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
  assert.match(dryRun.stdout, /ghcr\.io\/gaofeng21cn\/one-person-lab-webui:stable/);
  assert.match(dryRun.stdout, /pull_policy: always/);
  assert.match(dryRun.stdout, /Update mode: pull the configured WebUI image from the host and recreate the compose service/);
  assert.match(dryRun.stdout, /docker compose .* pull/);
  assert.match(dryRun.stdout, /docker compose .* up -d/);
  assert.match(dryRun.stdout, /would wait up to 5s for WebUI HTTP health at http:\/\/localhost:3133\//);
  assert.match(dryRun.stdout, /would write diagnostic directory .*diagnostics/);
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
