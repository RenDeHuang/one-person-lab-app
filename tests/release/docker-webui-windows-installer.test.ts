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
  for (const parameter of ['DryRun', 'Yes', 'Port', 'Image', 'Tag', 'DataDir', 'ProjectsDir', 'NoOpen', 'Detach']) {
    assert.match(installer, new RegExp(`\\$${parameter}\\b`), `missing -${parameter}`);
  }

  assert.doesNotMatch(installer, /ApiKey|API_KEY|OPENAI_API_KEY|GFLABTOKEN|Secret/i);
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

test('Windows Docker/WebUI installer checks prerequisites without silently installing them', () => {
  assert.match(installer, /Test-WindowsHost/);
  assert.match(installer, /\[Version\]"5\.1"/);
  assert.match(installer, /Get-Command docker/);
  assert.match(installer, /docker info/);
  assert.match(installer, /docker compose version/);
  assert.match(installer, /Get-Command wsl\.exe/);
  assert.match(installer, /wsl --install/);
  assert.match(installer, /winget install Docker\.DockerDesktop/);
  assert.doesNotMatch(installer, /Start-Process\s+winget|&\s*winget|Start-Process\s+wsl|&\s*wsl\.exe\s+--install/);
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
    '-DataDir',
    path.join(tempRoot, 'data'),
    '-ProjectsDir',
    path.join(tempRoot, 'projects'),
    '-NoOpen',
    '-Detach',
  ]);
  assert.ok(dryRun, 'pwsh should be available for this test');
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  assert.match(dryRun.stdout, /Dry run: would write/);
  assert.match(dryRun.stdout, /127\.0\.0\.1:3133:3000/);
  assert.match(dryRun.stdout, /ghcr\.io\/gaofeng21cn\/one-person-lab-webui:latest/);
  assert.match(dryRun.stdout, /docker compose .* up -d/);
  assert.equal(fs.existsSync(path.join(tempRoot, 'compose.yaml')), false, 'dry-run must not create compose.yaml');
});
