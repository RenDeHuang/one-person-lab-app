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

test('Windows Docker/WebUI installer parses and dry-runs when PowerShell is available', { timeout: 30_000 }, () => {
  if (!pwshPath) {
    return;
  }
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
  const dataDir = path.join(tempRoot, 'data');
  const projectsDir = path.join(tempRoot, 'projects');
  const dryRun = runPwsh([
    '-NoLogo',
    '-NoProfile',
    '-File',
    installerPath,
    '-DryRun',
    '-Yes',
    '-Update',
    '-EnableAutoUpdate',
    '-AutoUpdateTime',
    '03:00',
    '-Port',
    '3133',
    '-HealthTimeoutSeconds',
    '5',
    '-DataDir',
    dataDir,
    '-ProjectsDir',
    projectsDir,
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
  assert.match(dryRun.stdout, /pull_policy: missing/);
  assert.match(dryRun.stdout, /Update mode: pull the configured WebUI image from the host and recreate the compose service/);
  assert.match(dryRun.stdout, /docker compose .* pull/);
  assert.match(dryRun.stdout, /docker compose .* up -d/);
  assert.match(dryRun.stdout, /would register scheduled task One Person Lab WebUI Latest Update at 03:00/);
  assert.match(dryRun.stdout, /would wait up to 5s for WebUI HTTP health at http:\/\/localhost:3133\//);
  assert.match(dryRun.stdout, /would write diagnostic directory .*diagnostics/);
  assert.match(dryRun.stdout, /would write diagnostic archive .*diagnostics\.zip/);
  assert.ok(dryRun.stdout.includes(`${dataDir}:/data`));
  assert.ok(dryRun.stdout.includes(`${projectsDir}:/projects`));
  assert.equal(fs.existsSync(path.join(tempRoot, 'compose.yaml')), false, 'dry-run must not create compose.yaml');

  const rejected = runPwsh(['-NoProfile', '-File', installerPath, '-DryRun', '-ApiKey', 'secret']);
  assert.ok(rejected);
  assert.notEqual(rejected.status, 0);
});

test('Windows Docker/WebUI prerequisite mode is explicit and dry-runnable when PowerShell is available', { timeout: 30_000 }, () => {
  if (!pwshPath) {
    return;
  }
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

test('Windows Docker/WebUI ordinary mode starts Docker Desktop when the CLI exists but the daemon is stopped', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const startFunction = installer.slice(
    installer.indexOf('function Start-DockerDesktopIfPresent'),
    installer.indexOf('function Wait-DockerDaemon'),
  );
  const captureFunction = installer.slice(
    installer.indexOf('function Invoke-DockerCommandCapture'),
    installer.indexOf('function Wait-DockerDaemon'),
  );
  const dockerAssertion = installer.slice(
    installer.indexOf('function Assert-DockerCli'),
    installer.indexOf('function Assert-DockerCompose'),
  );

  assert.match(startFunction, /Invoke-DockerCommandCapture -Arguments @\("desktop", "start"\)/);
  assert.match(startFunction, /Start-Process -FilePath \$dockerDesktop/);
  assert.match(captureFunction, /\$ErrorActionPreference = "Continue"/);
  assert.match(captureFunction, /\$ErrorActionPreference = \$previousErrorActionPreference/);
  assert.match(dockerAssertion, /Invoke-DockerCommandCapture -Arguments @\("--version"\)/);
  assert.match(
    dockerAssertion,
    /if \(\$info\.ExitCode -ne 0\) \{\s+Start-DockerDesktopIfPresent\s+Wait-DockerDaemon/s,
  );
  assert.doesNotMatch(
    dockerAssertion,
    /if \(\$InstallPrerequisites\) \{\s+Start-DockerDesktopIfPresent/s,
    'daemon recovery must also run from the ordinary non-administrator installer path',
  );
});

test('Windows Docker/WebUI image resolution returns only the pinned image reference', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const resolver = installer.slice(
    installer.indexOf('function Resolve-PinnedImageReference'),
    installer.indexOf('function Convert-ToComposeScalar'),
  );

  assert.match(resolver, /Invoke-DockerCommandCapture -Arguments @\("pull", \$RequestedImageReference\)/);
  assert.match(resolver, /Write-Host \$pull\.Output/);
  assert.doesNotMatch(resolver, /& docker pull/);
});

test('Windows Docker/WebUI automatic updates stay on the limited host-side latest route', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const autoUpdateWriter = installer.slice(
    installer.indexOf('function Write-WebUiAutoUpdater'),
    installer.indexOf('function Disable-WebUiAutoUpdate'),
  );
  const autoUpdateRegistration = installer.slice(
    installer.indexOf('function Register-WebUiAutoUpdate'),
    installer.indexOf('function Invoke-DockerComposeUp'),
  );

  assert.match(installer, /raw\.githubusercontent\.com\/gaofeng21cn\/one-person-lab-app\/main\/scripts\/install-docker-webui\.ps1/);
  assert.match(autoUpdateWriter, /`"-Update`"/);
  assert.match(autoUpdateWriter, /`"-Yes`"/);
  assert.match(autoUpdateWriter, /`"-NoOpen`"/);
  assert.match(autoUpdateRegistration, /New-ScheduledTaskPrincipal/);
  assert.match(autoUpdateRegistration, /-LogonType Interactive/);
  assert.match(autoUpdateRegistration, /-RunLevel Limited/);
  assert.match(autoUpdateRegistration, /-StartWhenAvailable/);
  assert.match(autoUpdateRegistration, /-MultipleInstances IgnoreNew/);
  assert.doesNotMatch(autoUpdateWriter, /docker\.sock|Docker socket/i);
});
