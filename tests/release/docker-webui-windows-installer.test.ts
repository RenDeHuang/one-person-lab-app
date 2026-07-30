import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot } from './release-readiness/helpers.ts';
import {
  dockerWebuiImageDigest as imageDigest,
  writeDockerWebuiDiagnostics,
} from './docker-webui-fixtures.ts';

const installerPath = path.join(appRoot, 'scripts', 'install-docker-webui.ps1');
const smokeGatePath = path.join(appRoot, 'scripts', 'docker-webui-smoke-gate.ts');
const fixtureCommandTimeoutMs = 30_000;
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
  return spawnSync(pwshPath, args, { cwd: appRoot, encoding: 'utf8' });
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
  return runPwsh(['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harnessPath]);
}

function assertCommandDidNotTimeOut(result: ReturnType<typeof spawnSync>, label: string) {
  if (result.error) {
    throw new Error(`${label} did not terminate within ${fixtureCommandTimeoutMs}ms: ${result.error.message}`);
  }
  return result;
}

function writeWindowsEvidence(root: string, overrides: Record<string, unknown> = {}) {
  const diagnostics = path.join(root, 'diagnostics');
  writeDockerWebuiDiagnostics(diagnostics);
  fs.writeFileSync(
    path.join(root, 'api-key-flow-evidence.json'),
    `${JSON.stringify(
      {
        schema: 'opl_docker_webui_api_key_flow_evidence.v1',
        status: 'passed',
        mode: 'webui_proxy_configure_codex',
        endpoint: 'http://127.0.0.1:3000/api/opl-runtime/configure-codex',
        response_http_status: 200,
        response_success: true,
        command: 'opl system configure-codex --api-key-stdin --json',
        stdin_transport: true,
        key_material_recorded: false,
        errors: [],
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(root, 'windows-smoke-evidence.json'),
    `${JSON.stringify(
      {
        schema: 'opl_docker_webui_windows_smoke_evidence.v1',
        gate_id: 'clean_windows_vm',
        status: 'passed',
        host_platform: 'win32',
        observed_at: '2026-06-30T00:00:00Z',
        installer_command:
          'powershell -ExecutionPolicy Bypass -File scripts/install-docker-webui.ps1 -Yes -NoOpen -DiagnosticsDir diagnostics',
        diagnostics_dir: 'diagnostics',
        api_key_flow_evidence: 'api-key-flow-evidence.json',
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
  return { diagnostics };
}

function runSmokeGate(args: string[]) {
  return assertCommandDidNotTimeOut(spawnSync(
    process.execPath,
    ['--experimental-strip-types', smokeGatePath, ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      timeout: fixtureCommandTimeoutMs,
      killSignal: 'SIGKILL',
    },
  ), 'Docker/WebUI smoke-gate fixture');
}

function runWindowsEvidenceGate(evidence: string) {
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-gate-artifacts-'));
  const result = runSmokeGate([
    '--gate',
    'clean_windows_vm',
    '--evidence',
    evidence,
    '--artifacts',
    artifacts,
    '--json',
  ]);
  const resultPath = path.join(artifacts, 'docker-webui-smoke-gate-result.json');
  const payload = fs.existsSync(resultPath)
    ? JSON.parse(fs.readFileSync(resultPath, 'utf8'))
    : null;
  return { artifacts, result, payload };
}

function assertPassedWindowsEvidencePayload(payload: any) {
  assert.equal(payload.status, 'passed');
  assert.equal(payload.gate_id, 'clean_windows_vm');
  assert.equal(payload.diagnostics_validation.status, 'passed');
  assert.equal(payload.diagnostics_validation.compose_volume_mapping.status, 'passed');
  assert.equal(payload.diagnostics_validation.preservation_evidence.status, 'passed');
  assert.equal(payload.diagnostics_validation.image_identity.digest, imageDigest);
  assert.equal(payload.image.digest, imageDigest);
  assert.equal(payload.image.currentness_claim, false);
  assert.equal(payload.api_key_flow.status, 'passed');
  assert.equal(payload.api_key_flow.stdin_transport, true);
  assert.equal(payload.evidence_validation.status, 'passed');
  assert.equal(payload.ordinary_user_status.path_id, 'ordinary_docker_webui_user_path');
  assert.equal(payload.ordinary_user_status.access_key_settings.status, 'passed');
  assert.equal(payload.ordinary_user_status.runtime_proxy.status, 'passed');
}

function runPassedWindowsEvidenceGate(evidence: string) {
  const { result, payload } = runWindowsEvidenceGate(evidence);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assertPassedWindowsEvidencePayload(payload);
  return payload;
}

function zipEvidence(evidence: string) {
  const archivePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-archive-')),
    'windows-clean-evidence.zip',
  );
  const zipped = assertCommandDidNotTimeOut(spawnSync('zip', ['-qr', archivePath, '.'], {
    cwd: evidence,
    encoding: 'utf8',
    timeout: fixtureCommandTimeoutMs,
    killSignal: 'SIGKILL',
  }), 'Docker/WebUI evidence archive fixture');
  assert.equal(zipped.status, 0, zipped.stderr || zipped.stdout);
  return archivePath;
}

test('Windows Docker/WebUI installer resolves a moving tag once and pins compose to its digest', () => {
  const windowsInstaller = fs.readFileSync(installerPath, 'utf8');
  const resolver = windowsInstaller.match(/function Resolve-PinnedImageReference \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const pullRoute = windowsInstaller.match(/function Invoke-DockerPullWithPublicGhcrIsolation \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const anonymousPull = windowsInstaller.match(/function Invoke-PublicGhcrAnonymousDockerCommandCapture \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const composeWriter = windowsInstaller.match(/function Write-ComposeFile \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const execution = windowsInstaller.slice(windowsInstaller.indexOf('$tagWasProvided ='));

  assert.match(resolver, /Invoke-DockerPullWithRetry/);
  assert.match(resolver, /Write-Host \$pull\.Output/);
  assert.doesNotMatch(
    resolver,
    /& docker pull/,
    'native docker progress must not leak into the resolver success output',
  );
  assert.match(
    resolver,
    /Invoke-DockerCommandCapture[\s\S]*-Arguments @\("image", "inspect", "--format", "\{\{json \.RepoDigests\}\}"[\s\S]*-TimeoutSeconds 30/,
  );
  assert.match(resolver, /matchingDigests\.Count -ne 1/);
  assert.match(resolver, /@sha256:\[0-9a-f\]\{64\}/);
  assert.match(pullRoute, /Test-PublicOplGhcrImageReference/);
  assert.match(pullRoute, /\[Parameter\(Mandatory = \$true\)\]\[string\]\$DockerCliPath/);
  assert.match(pullRoute, /return Invoke-PublicGhcrAnonymousDockerCommandCapture/);
  assert.match(pullRoute, /-DockerCliPath \$DockerCliPath/);
  assert.match(pullRoute, /return Invoke-DockerCommandCaptureWithTimeout/);
  assert.doesNotMatch(pullRoute, /Test-DockerCredentialHelperFailure/);
  assert.match(anonymousPull, /'\{"auths":\{\}\}'/);
  assert.doesNotMatch(anonymousPull, /"auth"\s*:|"credsStore"\s*:/);
  assert.match(anonymousPull, /Remove-Item -LiteralPath \$temporaryConfigDir -Force -Recurse/);
  assert.doesNotMatch(anonymousPull, /USERPROFILE|\.docker\\config\.json/);
  assert.match(composeWriter, /pull_policy: missing/);
  assert.doesNotMatch(composeWriter, /pull_policy: always/);
  assert.ok(
    execution.indexOf('Assert-DockerCompose') < execution.indexOf('Resolve-PinnedImageReference'),
    'tag resolution must run only after Docker is available',
  );
  assert.match(execution, /\$dockerCliPath = Assert-DockerCli/);
  assert.ok(
    execution.indexOf('Resolve-PinnedImageReference') < execution.indexOf('Write-ComposeFile'),
    'compose must be written only after the immutable digest is resolved',
  );
});

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

  const tempRoot = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-installer-')),
  );
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
  assert.match(dryRun.stdout, /ghcr\.io\/gaofeng21cn\/one-person-lab-webui:stable/);
  assert.match(dryRun.stdout, /pull_policy: missing/);
  assert.match(dryRun.stdout, /restart: unless-stopped/);
  assert.match(dryRun.stdout, /Update mode: pull the configured WebUI image from the host and recreate the compose service/);
  assert.match(dryRun.stdout, /docker compose .* pull/);
  assert.match(dryRun.stdout, /docker compose .* up -d/);
  assert.match(dryRun.stdout, /would register scheduled task One Person Lab WebUI Stable Update at 03:00 and at the current user's next logon/);
  assert.match(dryRun.stdout, /would wait up to 5s for WebUI HTTP health at http:\/\/localhost:3133\//);
  assert.match(dryRun.stdout, /would write daily launcher .*Start-OnePersonLab\.ps1/);
  assert.match(dryRun.stdout, /would create desktop shortcut %USERPROFILE%\\Desktop\\One Person Lab\.lnk/);
  assert.match(dryRun.stdout, /would write diagnostic directory .*diagnostics/);
  assert.match(dryRun.stdout, /would write diagnostic archive .*diagnostics\.zip/);
  const normalizedDryRun = dryRun.stdout.toLocaleLowerCase('en-US');
  assert.ok(normalizedDryRun.includes(`${dataDir}:/data`.toLocaleLowerCase('en-US')));
  assert.ok(normalizedDryRun.includes(`${projectsDir}:/projects`.toLocaleLowerCase('en-US')));
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
  assert.match(captureFunction, /\[switch\]\$StreamOutput/);
  assert.match(captureFunction, /Convert-ToWindowsProcessArgument/);
  assert.match(captureFunction, /\[System\.Diagnostics\.ProcessStartInfo\]::new\(\)/);
  assert.match(captureFunction, /\$startInfo\.RedirectStandardOutput = \$true/);
  assert.match(captureFunction, /\$startInfo\.RedirectStandardError = \$true/);
  assert.match(captureFunction, /\$process\.StandardOutput/);
  assert.match(captureFunction, /\$process\.StandardError/);
  assert.match(captureFunction, /Reader\.ReadAsync/);
  assert.match(captureFunction, /\.WaitForExit\(250\)/);
  assert.match(captureFunction, /\$deadline = \$startedAt\.AddSeconds\(\$TimeoutSeconds\)/);
  assert.doesNotMatch(
    captureFunction,
    /-WindowStyle Hidden/,
    'redirected Docker commands must retain a readable process exit code on Windows PowerShell',
  );
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

test('Windows Docker/WebUI reads WSL status from a process exit code, not an unset LASTEXITCODE', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const wslStatus = extractPowerShellFunction(installer, 'Invoke-WslStatus');
  const wslAssertion = extractPowerShellFunction(installer, 'Assert-Wsl2');

  assert.match(wslStatus, /Start-Process\s+`\s+-FilePath \$WslPath/);
  assert.match(wslStatus, /-ArgumentList @\("--status"\)/);
  assert.match(wslStatus, /-Wait\s+`\s+-PassThru/);
  assert.match(wslStatus, /-RedirectStandardOutput \$stdoutPath/);
  assert.match(wslStatus, /-RedirectStandardError \$stderrPath/);
  assert.match(wslAssertion, /Invoke-WslStatus -WslPath \$wsl\.Source/);
  assert.match(wslAssertion, /\$status\.ExitCode -ne 0/);
  assert.doesNotMatch(wslAssertion, /\$LASTEXITCODE/);
});

test('Windows Docker/WebUI installs a reusable health-gated desktop launcher', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const launcherWriter = installer.slice(
    installer.indexOf('function Write-WebUiLauncher'),
    installer.indexOf('function Write-WebUiAutoUpdater'),
  );
  const execution = installer.slice(installer.indexOf('$tagWasProvided ='));

  assert.match(launcherWriter, /Invoke-DockerCommand -Arguments @\("compose", "-f", \$composePath, "up", "-d"\)/);
  assert.doesNotMatch(launcherWriter, /compose -f \$composePath down/);
  assert.match(launcherWriter, /ArgumentList @\("desktop", "start"\)/);
  assert.match(launcherWriter, /desktopStart\.WaitForExit\(30000\)/);
  assert.match(launcherWriter, /Stop-Process -Id \$desktopStart\.Id -Force/);
  assert.match(launcherWriter, /AddSeconds\(180\)/);
  assert.match(launcherWriter, /Invoke-WebRequest -Uri \$url -Method Head/);
  assert.match(launcherWriter, /Invoke-WebRequest -Uri \$url -Method Get/);
  assert.match(launcherWriter, /Start-Process -FilePath \$url/);
  assert.match(launcherWriter, /function Invoke-DockerCommand/);
  assert.match(launcherWriter, /\[System\.Diagnostics\.ProcessStartInfo\]::new\(\)/);
  assert.match(launcherWriter, /\$startInfo\.RedirectStandardOutput = \$true/);
  assert.doesNotMatch(launcherWriter, /& \$dockerCliPath/);
  assert.match(launcherWriter, /Language\.Parser\]::ParseInput/);
  assert.match(launcherWriter, /Generated One Person Lab launcher is invalid/);
  assert.match(launcherWriter, /CreateShortcut\(\$shortcutPath\)/);
  assert.match(launcherWriter, /One Person Lab\.lnk/);
  assert.match(execution, /Install-WebUiLauncher -DockerCliPath \$dockerCliPath/);
  assert.match(installer, /restart: unless-stopped/);
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
  const canonicalDockerExe = fs.realpathSync.native(dockerExe);

  const result = runPwshHarness([
    extractPowerShellFunction(installer, 'Refresh-ProcessPathFromEnvironment'),
    extractPowerShellFunction(installer, 'Resolve-DockerCliPath'),
    `$env:Path = ${powerShellSingleQuoted(path.join(tempRoot, 'stale-process-path'))}`,
    "$env:PATHEXT = '.CPL'",
    `Refresh-ProcessPathFromEnvironment -MachinePath ${powerShellSingleQuoted(dockerBin)} -UserPath ''`,
    '$resolved = Resolve-DockerCliPath',
    `if (-not [string]::Equals($resolved, ${powerShellSingleQuoted(canonicalDockerExe)}, [System.StringComparison]::OrdinalIgnoreCase)) { throw "unexpected docker path: $resolved" }`,
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

  assert.match(resolver, /Invoke-DockerPullWithRetry/);
  assert.match(resolver, /-Arguments @\("pull", \$RequestedImageReference\)/);
  assert.match(resolver, /-ImageReference \$RequestedImageReference/);
  assert.match(resolver, /-not \$pull\.OutputWasStreamed/);
  assert.doesNotMatch(resolver, /& docker pull/);
});

test('Windows Docker/WebUI image pulls stream progress, identify Docker proxy configuration, and remain bounded', () => {
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
  assert.match(installer, /\[int\]\$DockerPullStallTimeoutSeconds = 180/);
  assert.match(installer, /\[int\]\$DockerPullRetryCount = 2/);
  assert.match(boundedCapture, /\.WaitForExit\(250\)/);
  assert.match(boundedCapture, /\[System\.Diagnostics\.ProcessStartInfo\]::new\(\)/);
  assert.match(boundedCapture, /\$startInfo\.RedirectStandardOutput = \$true/);
  assert.match(boundedCapture, /\$startInfo\.RedirectStandardError = \$true/);
  assert.match(boundedCapture, /\$streamState\.Reader\.ReadAsync/);
  assert.match(boundedCapture, /Write-Host \$chunk -NoNewline/);
  assert.match(boundedCapture, /Docker Desktop -> Settings -> Resources -> Proxies/);
  assert.match(boundedCapture, /\$nextHeartbeatAt = \$startedAt\.AddSeconds\(20\)/);
  assert.match(boundedCapture, /\$NoOutputTimeoutSeconds/);
  assert.match(boundedCapture, /\$stalled = \$true/);
  assert.match(boundedCapture, /if \(-not \$process\.HasExited\)/);
  assert.match(boundedCapture, /taskkill\.exe" \/PID \$process\.Id \/T \/F 2>\$null/);
  assert.match(boundedCapture, /catch \[System\.InvalidOperationException\]/);
  assert.match(boundedCapture, /\$process\.WaitForExit\(\)/);
  assert.doesNotMatch(boundedCapture, /\$process\.WaitForExit\(\$TimeoutSeconds \* 1000\)/);
  assert.match(boundedCapture, /ExitCode = 124/);
  assert.match(boundedCapture, /TimedOut = \$true/);
  assert.match(resolver, /if \(\$pull\.TimedOut\)/);
  assert.match(resolver, /The stalled pull was stopped/);
  assert.match(resolver, /made no layer progress/);
  assert.match(resolver, /Invoke-DockerCommandCapture[\s\S]*"image", "inspect"/);
  assert.match(installer, /function Invoke-DockerPullWithRetry/);
  assert.match(installer, /Test-DockerPullNetworkFailure/);
  assert.match(installer, /retrying image pull in/);
});

test('Windows Docker/WebUI reports first-time setup progress while waiting for HTTP health', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const healthWait = extractPowerShellFunction(installer, 'Wait-WebUiHealth');

  assert.match(healthWait, /\$nextHeartbeatAt = \$startedAt\.AddSeconds\(20\)/);
  assert.match(healthWait, /WebUI is still completing first-time setup/);
  assert.match(healthWait, /Docker Engine also needs GitHub\/GHCR access/);
  assert.match(healthWait, /Docker Desktop -> Settings -> Resources -> Proxies/);
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
  assert.match(fallback, /-StreamOutput/);
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

  assert.match(composeUp, /Invoke-DockerPullWithRetry/);
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
  const diagnostics = installer.slice(
    installer.indexOf('function Invoke-DiagnosticDockerCommand'),
    installer.indexOf('function Install-Wsl2Prerequisites'),
  );
  const execution = installer.slice(installer.indexOf('$tagWasProvided ='));

  assert.match(resolver, /Get-Command docker\.exe -CommandType Application/);
  assert.match(resolver, /Docker\\Docker\\resources\\bin\\docker\.exe/);
  assert.match(resolver, /Programs\\DockerDesktop\\resources\\bin\\docker\.exe/);
  assert.match(diagnostics, /Invoke-DockerCommandCapture/);
  assert.doesNotMatch(diagnostics, /\$output = & \$DockerCliPath @Arguments/);
  assert.match(installer, /\$startInfo\.FileName = \$DockerCliPath/);
  assert.match(installer, /\$startInfo\.Arguments = \$argumentLine/);
  assert.match(execution, /\$dockerCliPath = Assert-DockerCli/);
  assert.match(execution, /Resolve-PinnedImageReference -DockerCliPath \$dockerCliPath/);
  assert.match(execution, /Invoke-DockerComposeUp -DockerCliPath \$dockerCliPath/);
  assert.match(execution, /Collect-WebUiDiagnostics -DockerCliPath \$dockerCliPath/);
  assert.doesNotMatch(installer, /Get-Command docker(?!\.exe)/);
  assert.doesNotMatch(installer, /& docker(?:\s|$)/);
});

test('Windows Docker/WebUI health timeout classifies external input only with remote network evidence', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const healthWait = extractPowerShellFunction(installer, 'Wait-WebUiHealth');
  const classification = extractPowerShellFunction(installer, 'Get-WebUiHealthTimeoutClassification');
  assert.match(installer, /function Get-WebUiHealthTimeoutClassification/);
  assert.match(classification, /docker-compose-logs\.txt/);
  assert.match(classification, /ghcr\\\.io/);
  assert.match(classification, /github\\\.com/);
  assert.match(classification, /networkFailurePattern/);
  assert.match(classification, /networkErrorContextPattern/);
  assert.match(classification, /could not resolve/);
  assert.match(classification, /networkAdjacentFailurePattern/);
  assert.match(classification, /lineIndex - 1/);
  assert.match(classification, /lineIndex \+ 1/);
  assert.match(classification, /lineIndex -lt \$evidenceLines\.Count/);
  assert.match(classification, /if \(\$line -match \$networkFailurePattern -or \$line -match \$networkErrorContextPattern\)/);
  assert.match(healthWait, /Get-WebUiHealthTimeoutClassification -TargetDir \$failureDir/);
  assert.match(healthWait, /health-timeout-classification\.txt/);
  assert.match(healthWait, /external_input_required/);
  assert.match(healthWait, /local_startup_failure/);
  assert.match(healthWait, /Diagnostics do not establish a GitHub\/GHCR network blockage/);
  assert.match(installer, /Docker Desktop -> Settings -> Resources -> Proxies/);
  assert.doesNotMatch(healthWait, /throw "external_input_required: WebUI did not become reachable[\s\S]*First-time Official Profile initialization/);
});

test('Windows Docker/WebUI requires failure context for generic TLS/DNS/certificate terms', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const classification = extractPowerShellFunction(installer, 'Get-WebUiHealthTimeoutClassification');
  const primaryPattern = classification.match(/\$networkFailurePattern = "([^"]+)"/)?.[1] ?? '';
  assert.doesNotMatch(primaryPattern, /\b(?:dns|tls|ssl|certificate)\b/);
  assert.match(classification, /\$networkErrorContextPattern =/);
  assert.match(classification, /\$networkErrorContextPattern\)/);
  assert.match(classification, /(?:error|err|failed|failure|unable|cannot|could not)/i);
});

test('Windows Docker/WebUI defaults to Stable and keeps Latest as explicit Preview opt-in', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  assert.match(installer, /\[string\]\$Tag = "stable"/);
  assert.match(installer, /\$requestedImageReference -ne "ghcr\.io\/gaofeng21cn\/one-person-lab-webui:stable"/);
  assert.match(installer, /use -Tag latest only to opt in to Preview/);
  assert.match(installer, /\$script:LegacyAutoUpdateTaskName = "One Person Lab WebUI Latest Update"/);
  assert.match(installer, /Unregister-ScheduledTask -TaskName \$script:LegacyAutoUpdateTaskName -Confirm:\$false/);
});

test('Windows Docker/WebUI automatic updates stay on the limited host-side stable route', () => {
  const installer = fs.readFileSync(installerPath, 'utf8');
  const autoUpdateWriter = installer.slice(
    installer.indexOf('function Write-WebUiAutoUpdater'),
    installer.indexOf('function Disable-WebUiAutoUpdate'),
  );
  const autoUpdateRegistration = installer.slice(
    installer.indexOf('function Register-WebUiAutoUpdate'),
    installer.indexOf('function Invoke-DockerComposeUp'),
  );

  assert.doesNotMatch(
    installer,
    /raw\.githubusercontent\.com\/gaofeng21cn\/one-person-lab-app\/main\/scripts\/install-docker-webui\.ps1/,
    'the scheduled task must not download and execute a mutable main-branch installer',
  );
  assert.match(autoUpdateWriter, /Copy-Item -LiteralPath \$InstallerSourcePath/);
  assert.match(autoUpdateWriter, /Move-Item -LiteralPath \$installerTemporaryPath -Destination \$installerPath/);
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
  assert.match(installer, /\[switch\]\$AutoUpdateStatus/);
  assert.match(installer, /function Show-WebUiAutoUpdateStatus/);
  assert.match(installer, /schema=opl_webui_host_auto_update_result\.v1/);
  assert.match(installer, /schema=opl_webui_host_auto_update_config\.v1/);
  assert.match(installer, /daily_time=not_configured/);
  assert.match(autoUpdateWriter, /`\$installerExitCode = `\$LASTEXITCODE/);
  assert.match(autoUpdateWriter, /function Test-RestoredWebUiHealth/);
  assert.match(autoUpdateWriter, /`\$rollbackDeadline = \(Get-Date\)\.AddSeconds\(`\$healthTimeoutSeconds\)/);
  assert.match(autoUpdateWriter, /if \(Test-RestoredWebUiHealth\)/);
  assert.match(autoUpdateWriter, /phase=installer_update/);
  assert.match(autoUpdateWriter, /phase=health/);
  assert.match(installer, /function Test-WebUiAutoUpdateConfigured/);
  assert.match(installer, /Run -DisableAutoUpdate before switching to a custom image/);
  assert.doesNotMatch(autoUpdateWriter, /docker\.sock|Docker socket/i);
});

test('Docker/WebUI clean Windows smoke gate imports minimal Windows evidence', () => {
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-'));
  writeWindowsEvidence(evidence);

  const payload = runPassedWindowsEvidenceGate(evidence);
  assert.equal(payload.host_platform, process.platform);
  assert.equal(payload.evidence.windows_evidence_dir, evidence);
  assert.equal(payload.evidence.windows_diagnostics_dir, path.join(evidence, 'diagnostics'));
  assert.equal(
    payload.evidence.windows_api_key_flow_evidence,
    path.join(evidence, 'api-key-flow-evidence.json'),
  );
  assert.equal(payload.ordinary_user_status.settings_entry, 'Settings -> Account & Access');
});

test('Docker/WebUI clean Windows smoke gate imports zipped Windows evidence', () => {
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-'));
  writeWindowsEvidence(evidence);
  const archivePath = zipEvidence(evidence);

  const payload = runPassedWindowsEvidenceGate(archivePath);
  assert.equal(payload.evidence.windows_evidence_archive, archivePath);
  assert.match(payload.evidence.windows_evidence_dir, /windows-evidence-archive/);
});

test('Docker/WebUI clean Windows smoke gate imports PowerShell-style zipped Windows evidence', () => {
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-'));
  const { diagnostics } = writeWindowsEvidence(evidence);
  for (const bomFile of [
    'api-key-flow-evidence.json',
    'windows-smoke-evidence.json',
    path.join('diagnostics', 'data-preservation.txt'),
    path.join('diagnostics', 'metadata.txt'),
  ]) {
    const bomPath = path.join(evidence, bomFile);
    fs.writeFileSync(bomPath, `\uFEFF${fs.readFileSync(bomPath, 'utf8')}`);
  }
  const archivePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-archive-')),
    'windows-clean-evidence.zip',
  );
  const createArchive = assertCommandDidNotTimeOut(spawnSync(
    'python3',
    [
      '-c',
      [
        'import os, sys, zipfile',
        'source, archive = sys.argv[1], sys.argv[2]',
        'with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:',
        '    for root, _, files in os.walk(source):',
        '        for file_name in files:',
        '            full_path = os.path.join(root, file_name)',
        '            rel = os.path.relpath(full_path, source).replace(os.sep, "\\\\")',
        '            zf.write(full_path, rel)',
      ].join('\n'),
      evidence,
      archivePath,
    ],
    { encoding: 'utf8', timeout: fixtureCommandTimeoutMs, killSignal: 'SIGKILL' },
  ), 'PowerShell-style evidence archive fixture');
  assert.equal(createArchive.status, 0, createArchive.stderr || createArchive.stdout);

  const payload = runPassedWindowsEvidenceGate(archivePath);
  assert.equal(payload.diagnostics_validation.preservation_verdict, 'preserved_or_reused');
  assert.equal(payload.data_preservation.status, 'passed');
  assert.equal(payload.evidence.windows_evidence_archive, archivePath);
  assert.ok(
    fs.existsSync(path.join(payload.evidence.windows_evidence_dir, 'diagnostics', 'compose.yaml')),
  );
  assert.ok(fs.existsSync(path.join(diagnostics, 'data-preservation.txt')));
});

test('Docker/WebUI clean Windows smoke gate rejects unsafe zipped Windows evidence paths', () => {
  const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-unsafe-archive-'));
  const archivePath = path.join(archiveRoot, 'windows-clean-evidence.zip');
  fs.writeFileSync(path.join(archiveRoot, '..', 'evil.txt'), 'unsafe\n');
  const zipped = assertCommandDidNotTimeOut(spawnSync('zip', ['-q', archivePath, '../evil.txt'], {
    cwd: archiveRoot,
    encoding: 'utf8',
    timeout: fixtureCommandTimeoutMs,
    killSignal: 'SIGKILL',
  }), 'unsafe archive rejection fixture');
  assert.equal(zipped.status, 0, zipped.stderr || zipped.stdout);

  const { result } = runWindowsEvidenceGate(archivePath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsafe parent traversal entry/);
});

for (const { name, mutate, assertPayload } of [
  {
    name: 'incomplete Windows evidence',
    mutate({ diagnostics }: { diagnostics: string }) {
      fs.rmSync(path.join(diagnostics, 'http-probe.txt'));
    },
    assertPayload(payload: any) {
      assert.ok(payload.diagnostics_validation.missing_files.includes('http-probe.txt'));
    },
  },
  {
    name: 'secret-like markers in imported evidence',
    mutate({ diagnostics }: { diagnostics: string }) {
      fs.writeFileSync(
        path.join(diagnostics, 'docker-compose-logs.txt'),
        'Bearer abcdefghijklmnopqrstuvwxyz123456\n',
      );
    },
    assertPayload(payload: any) {
      assert.ok(
        payload.evidence_validation.forbidden_secret_markers.some(
          (marker: string) => marker.includes('Bearer'),
        ),
      );
    },
  },
  {
    name: 'evidence without API key UI flow receipt',
    mutate({ evidence }: { evidence: string }) {
      fs.rmSync(path.join(evidence, 'api-key-flow-evidence.json'));
    },
    assertPayload(payload: any) {
      assert.ok(
        payload.evidence_validation.errors.some(
          (error: string) => error.includes('API key flow evidence validation failed'),
        ),
      );
    },
  },
]) {
  test(`Docker/WebUI clean Windows smoke gate rejects ${name}`, () => {
    const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-windows-evidence-'));
    const { diagnostics } = writeWindowsEvidence(evidence);
    mutate({ evidence, diagnostics });

    const { result, payload } = runWindowsEvidenceGate(evidence);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.equal(payload.status, 'failed');
    assert.equal(payload.evidence_validation.status, 'failed');
    assertPayload(payload);
  });
}
