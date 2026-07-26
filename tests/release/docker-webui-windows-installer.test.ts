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
  if (process.platform === 'win32') {
    for (const executable of ['powershell.exe', 'pwsh.exe']) {
      const result = spawnSync('where.exe', [executable], { encoding: 'utf8' });
      const resolved = result.stdout.split(/\r?\n/).map((entry) => entry.trim()).find(Boolean);
      if (result.status === 0 && resolved) return resolved;
    }
    return '';
  }
  const result = spawnSync('/bin/sh', ['-lc', 'command -v pwsh'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function runPwsh(args: string[]) {
  if (!pwshPath) {
    return null;
  }
  return spawnSync(pwshPath, ['-ExecutionPolicy', 'Bypass', ...args], { cwd: appRoot, encoding: 'utf8' });
}

function extractPowerShellFunction(source: string, name: string) {
  const start = source.indexOf(`function ${name} {`);
  assert.notEqual(start, -1, `missing PowerShell function ${name}`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function powerShellSingleQuoted(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runPwshHarness(source: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-pwsh-harness-'));
  const harnessPath = path.join(tempRoot, 'harness.ps1');
  fs.writeFileSync(harnessPath, source, 'utf8');
  return runPwsh(['-NoLogo', '-NoProfile', '-File', harnessPath]);
}

test('Windows Docker/WebUI installer parses and dry-runs when PowerShell is available', { timeout: 30_000 }, () => {
  assert.match(fs.readFileSync(installerPath, 'utf8'), /\[int\]\$HealthTimeoutSeconds = 600/);
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
  assert.match(dryRun.stdout, /would register scheduled task One Person Lab WebUI Latest Update at 03:00 and at the current user's next logon/);
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
    installer.indexOf('function Invoke-DockerCommandCaptureWithTimeout'),
    installer.indexOf('function Wait-DockerDaemon'),
  );
  const dockerAssertion = installer.slice(
    installer.indexOf('function Assert-DockerCli'),
    installer.indexOf('function Assert-DockerCompose'),
  );

  assert.match(
    startFunction,
    /Invoke-DockerCommandCapture\s+`\s+-DockerCliPath \$DockerCliPath\s+`\s+-Arguments @\("desktop", "start"\)/,
  );
  assert.match(startFunction, /TimeoutSeconds 30/);
  assert.match(startFunction, /Start-Process -FilePath \$dockerDesktop/);
  assert.match(captureFunction, /\.WaitForExit\(\$TimeoutSeconds \* 1000\)/);
  assert.match(captureFunction, /TimeoutSeconds = 120/);
  assert.match(captureFunction, /Invoke-DockerCommandCaptureWithTimeout/);
  assert.match(
    dockerAssertion,
    /Invoke-DockerCommandCapture\s+`\s+-DockerCliPath \$dockerCliPath\s+`\s+-Arguments @\("--version"\)/,
  );
  assert.match(
    dockerAssertion,
    /if \(\$info\.ExitCode -ne 0\) \{\s+Start-DockerDesktopIfPresent -DockerCliPath \$dockerCliPath\s+Wait-DockerDaemon -DockerCliPath \$dockerCliPath/s,
  );
  assert.doesNotMatch(
    dockerAssertion,
    /if \(\$InstallPrerequisites\) \{\s+Start-DockerDesktopIfPresent/s,
    'daemon recovery must also run from the ordinary non-administrator installer path',
  );
});

test('Windows Docker/WebUI refreshes stale PATH and resolves docker.exe without relying on PATHEXT', {
  skip: process.platform === 'win32' && pwshPath
    ? false
    : 'requires native Windows PowerShell',
}, () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-docker-cli-resolution-'));
  const dockerBin = path.join(tempRoot, 'persisted-docker-bin');
  const dockerExe = path.join(dockerBin, 'docker.exe');
  fs.mkdirSync(dockerBin, { recursive: true });
  fs.writeFileSync(dockerExe, '');

  const result = runPwshHarness([
    extractPowerShellFunction(installer, 'Refresh-ProcessPathFromEnvironment'),
    extractPowerShellFunction(installer, 'Resolve-DockerCliPath'),
    `$env:Path = ${powerShellSingleQuoted(path.join(tempRoot, 'stale-process-path'))}`,
    "$env:PATHEXT = '.CPL'",
    `Refresh-ProcessPathFromEnvironment -MachinePath ${powerShellSingleQuoted(dockerBin)} -UserPath ''`,
    '$resolved = Resolve-DockerCliPath',
    `if ($resolved -ne ${powerShellSingleQuoted(dockerExe)}) { throw "unexpected docker path: $resolved" }`,
  ].join('\n\n'));

  assert.ok(result);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('Windows Docker/WebUI does not invoke winget for a non-admin per-user Docker Desktop install outside PATH', {
  skip: process.platform === 'win32' && pwshPath
    ? false
    : 'requires native Windows PowerShell',
}, () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-existing-docker-desktop-'));
  const localAppData = path.join(tempRoot, 'local');
  const desktopExe = path.join(localAppData, 'Programs', 'DockerDesktop', 'Docker Desktop.exe');
  fs.mkdirSync(path.dirname(desktopExe), { recursive: true });
  fs.writeFileSync(desktopExe, '');

  const result = runPwshHarness([
    extractPowerShellFunction(installer, 'Resolve-DockerDesktopApplicationPath'),
    extractPowerShellFunction(installer, 'Resolve-DockerCliPath'),
    extractPowerShellFunction(installer, 'Install-DockerDesktopPrerequisite'),
    '$InstallPrerequisites = $true',
    `$env:ProgramFiles = ${powerShellSingleQuoted(tempRoot)}`,
    `$env:LOCALAPPDATA = ${powerShellSingleQuoted(localAppData)}`,
    "$env:Path = ''",
    "$env:PATHEXT = '.CPL'",
    'function Test-Administrator { return $false }',
    'function Write-Step { param([string]$Message) }',
    "function Invoke-StepCommand { throw 'winget must not be invoked' }",
    'Install-DockerDesktopPrerequisite',
  ].join('\n\n'));

  assert.ok(result);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('Windows Docker/WebUI image resolution returns only the pinned image reference', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const resolver = installer.slice(
    installer.indexOf('function Resolve-PinnedImageReference'),
    installer.indexOf('function Convert-ToComposeScalar'),
  );

  assert.match(resolver, /Invoke-DockerPullWithPublicGhcrIsolation/);
  assert.match(resolver, /-Arguments @\("pull", \$RequestedImageReference\)/);
  assert.match(resolver, /-ImageReference \$RequestedImageReference/);
  assert.match(resolver, /Write-Host \$pull\.Output/);
  assert.doesNotMatch(resolver, /& docker pull/);
});

test('Windows Docker/WebUI image pulls are bounded and terminate the stalled process tree', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const boundedCapture = installer.slice(
    installer.indexOf('function Invoke-DockerCommandCaptureWithTimeout'),
    installer.indexOf('function Test-PublicOplGhcrImageReference'),
  );
  const resolver = installer.slice(
    installer.indexOf('function Resolve-PinnedImageReference'),
    installer.indexOf('function Convert-ToComposeScalar'),
  );

  assert.match(installer, /\[int\]\$DockerPullTimeoutSeconds = 1800/);
  assert.match(boundedCapture, /\.WaitForExit\(\$TimeoutSeconds \* 1000\)/);
  assert.match(boundedCapture, /taskkill\.exe \/PID \$process\.Id \/T \/F 2>\$null/);
  assert.doesNotMatch(boundedCapture, /taskkill\.exe \/PID \$process\.Id \/T \/F 2>&1/);
  assert.doesNotMatch(boundedCapture, /\$process\.WaitForExit\(\)/);
  assert.match(boundedCapture, /Stop-Process -Id \$process\.Id -Force/);
  assert.match(boundedCapture, /ExitCode = 124/);
  assert.match(boundedCapture, /TimedOut = \$true/);
  assert.match(resolver, /if \(\$pull\.TimedOut\)/);
  assert.match(resolver, /The stalled pull was stopped/);
  assert.match(resolver, /Invoke-DockerCommandCapture[\s\S]*"image", "inspect"/);
});

test('Windows Docker/WebUI isolates public OPL GHCR pulls from host credentials', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const fallback = installer.slice(
    installer.indexOf('function Test-PublicOplGhcrImageReference'),
    installer.indexOf('function Wait-DockerDaemon'),
  );

  assert.match(fallback, /ghcr\\\.io\/gaofeng21cn\/one-person-lab-webui/);
  assert.match(fallback, /return Invoke-PublicGhcrAnonymousDockerCommandCapture/);
  assert.match(fallback, /return Invoke-DockerCommandCaptureWithTimeout/);
  assert.doesNotMatch(fallback, /Test-DockerCredentialHelperFailure/);
  assert.match(fallback, /@\('--config', \$temporaryConfigDir\) \+ \$Arguments/);
  assert.match(fallback, /Remove-Item -LiteralPath \$temporaryConfigDir -Force -Recurse/);
});

test('Windows Docker/WebUI compose commands use exit codes instead of native stderr exceptions', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const composeUp = installer.slice(
    installer.indexOf('function Invoke-DockerComposeUp'),
    installer.indexOf('function Test-WebUiHttpHealth'),
  );

  assert.match(composeUp, /Invoke-DockerPullWithPublicGhcrIsolation/);
  assert.match(composeUp, /-Arguments \$pullArgs/);
  assert.match(composeUp, /-ImageReference \$ImageReference/);
  assert.match(composeUp, /Invoke-DockerCommandCapture -DockerCliPath \$DockerCliPath -Arguments \$upArgs/);
  assert.match(composeUp, /\$pull\.ExitCode -ne 0/);
  assert.match(composeUp, /\$up\.ExitCode -ne 0/);
  assert.doesNotMatch(composeUp, /& docker/);
});

test('Windows Docker/WebUI uses the resolved absolute docker.exe path for every native Docker invocation', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const resolver = installer.slice(
    installer.indexOf('function Refresh-ProcessPathFromEnvironment'),
    installer.indexOf('function Invoke-DiagnosticDockerCommand'),
  );
  const execution = installer.slice(installer.indexOf('$tagWasProvided ='));

  assert.match(resolver, /Get-Command docker\.exe -CommandType Application/);
  assert.match(resolver, /Docker\\Docker\\resources\\bin\\docker\.exe/);
  assert.match(resolver, /Programs\\DockerDesktop\\resources\\bin\\docker\.exe/);
  assert.match(installer, /\$output = & \$DockerCliPath @Arguments/);
  assert.match(installer, /`\$output = & `\$dockerCliPath @dockerArguments/);
  assert.match(execution, /\$dockerCliPath = Assert-DockerCli/);
  assert.match(execution, /Resolve-PinnedImageReference -DockerCliPath \$dockerCliPath/);
  assert.match(execution, /Invoke-DockerComposeUp -DockerCliPath \$dockerCliPath/);
  assert.match(execution, /Collect-WebUiDiagnostics -DockerCliPath \$dockerCliPath/);
  assert.doesNotMatch(installer, /Get-Command docker(?!\.exe)/);
  assert.doesNotMatch(installer, /& docker(?:\s|$)/);
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
  assert.match(autoUpdateRegistration, /New-ScheduledTaskTrigger -Daily -At \$scheduleTime/);
  assert.match(autoUpdateRegistration, /New-ScheduledTaskTrigger -AtLogOn -User \$currentUser/);
  assert.match(autoUpdateRegistration, /-Trigger \$triggers/);
  assert.match(autoUpdateRegistration, /-LogonType Interactive/);
  assert.match(autoUpdateRegistration, /-RunLevel Limited/);
  assert.match(autoUpdateRegistration, /-StartWhenAvailable/);
  assert.match(autoUpdateRegistration, /-MultipleInstances IgnoreNew/);
  assert.doesNotMatch(autoUpdateWriter, /docker\.sock|Docker socket/i);
});
