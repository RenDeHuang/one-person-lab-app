import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { shouldRetryConfigureCodexProbe } from '../../scripts/docker-webui-smoke-gate.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const installerPath = path.join(appRoot, 'scripts', 'install-docker-webui.sh');
const smokeGatePath = path.join(appRoot, 'scripts', 'docker-webui-smoke-gate.ts');
const fixtureCommandTimeoutMs = 30_000;

function assertCommandDidNotTimeOut(result: ReturnType<typeof spawnSync>, label: string) {
  if (result.error) {
    throw new Error(`${label} did not terminate within ${fixtureCommandTimeoutMs}ms: ${result.error.message}`);
  }
  return result;
}

function runInstaller(args: string[], env: NodeJS.ProcessEnv = {}) {
  return assertCommandDidNotTimeOut(spawnSync('bash', [installerPath, ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: fixtureCommandTimeoutMs,
    killSignal: 'SIGKILL',
  }), 'Docker/WebUI installer fixture');
}

function runSmokeGate(args: string[]) {
  return assertCommandDidNotTimeOut(spawnSync(process.execPath, ['--experimental-strip-types', smokeGatePath, ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    timeout: fixtureCommandTimeoutMs,
    killSignal: 'SIGKILL',
  }), 'Docker/WebUI smoke-gate fixture');
}

test('Docker/WebUI installer shell parses cleanly', () => {
  const result = assertCommandDidNotTimeOut(spawnSync('bash', ['-n', installerPath], {
    cwd: appRoot,
    encoding: 'utf8',
    timeout: fixtureCommandTimeoutMs,
    killSignal: 'SIGKILL',
  }), 'Docker/WebUI installer syntax fixture');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const installer = fs.readFileSync(installerPath, 'utf8');
  const composeFunction = installer.match(/compose_content\(\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.doesNotMatch(composeFunction, /<<YAML/, 'compose dry-run must not depend on a heredoc writer process');
});

test('Docker/WebUI installer dry-run generates the compose-only startup plan', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-installer-home-'));
  const result = runInstaller(
    [
      '--dry-run',
      '--update',
      '--port',
      '3917',
      '--health-timeout',
      '7',
      '--tag',
      '26.6.30',
      '--data-dir',
      path.join(home, 'data-dir'),
      '--projects-dir',
      path.join(home, 'projects-dir'),
      '--diagnostics-dir',
      path.join(home, 'diagnostics-dir'),
      '--diagnostics-archive',
      path.join(home, 'diagnostics.tar.gz'),
      '--no-open',
    ],
    { HOME: home },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const escapedHome = home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const pattern of [
    /image: ghcr\.io\/gaofeng21cn\/one-person-lab-webui:26\.6\.30/,
    /pull_policy: always/,
    /"127\.0\.0\.1:3917:3000"/,
    /AIONUI_ALLOW_REMOTE: "true"/,
    /AIONUI_DATA_DIR: \/data/,
    /OPL_PROJECTS_DIR: \/projects/,
    new RegExp(`${escapedHome}/data-dir:/data`),
    new RegExp(`${escapedHome}/projects-dir:/projects`),
    /docker compose -f .*compose\.yaml pull/,
    /docker compose -f .*compose\.yaml up -d/,
    /Would wait up to 7s for WebUI HTTP health at http:\/\/localhost:3917\//,
    /Would write diagnostic directory: .*diagnostics-dir/,
    /Would write diagnostic archive: .*diagnostics\.tar\.gz/,
  ]) {
    assert.match(result.stdout, pattern);
  }
  assert.doesNotMatch(result.stdout, /docker run/);
  assert.doesNotMatch(result.stdout, /OPENAI_API_KEY|ANTHROPIC_API_KEY|api_key/i);
  assert.equal(fs.existsSync(path.join(home, 'OnePersonLab')), false, 'dry-run must not create host directories');
});

test('Docker/WebUI installer defaults to Stable and requires explicit Preview opt-in', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-channel-default-home-'));
  const stable = runInstaller(['--dry-run', '--yes', '--no-open'], { HOME: home });
  assert.equal(stable.status, 0, stable.stderr || stable.stdout);
  assert.match(stable.stdout, /image: ghcr\.io\/gaofeng21cn\/one-person-lab-webui:stable/);
  assert.doesNotMatch(stable.stdout, /image: ghcr\.io\/gaofeng21cn\/one-person-lab-webui:latest/);

  const preview = runInstaller(['--dry-run', '--yes', '--tag', 'latest', '--no-open'], { HOME: home });
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  assert.match(preview.stdout, /image: ghcr\.io\/gaofeng21cn\/one-person-lab-webui:latest/);
});

test('Docker/WebUI installer exposes one host auto-update contract across Linux and macOS', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-auto-update-home-'));
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin);
  const uname = path.join(bin, 'uname');
  fs.writeFileSync(uname, '#!/bin/sh\nprintf "Darwin\\n"\n', 'utf8');
  fs.chmodSync(uname, 0o755);
  const env = { HOME: home, PATH: `${bin}:${process.env.PATH ?? ''}` };
  const enabled = runInstaller(
    ['--dry-run', '--yes', '--update', '--enable-auto-update', '--auto-update-time', '04:15', '--no-open'],
    env,
  );

  assert.equal(enabled.status, 0, enabled.stderr || enabled.stdout);
  assert.match(enabled.stdout, /would write local automatic updater/i);
  assert.match(enabled.stdout, /LaunchAgent cn\.onepersonlab\.webui-update at 04:15/);
  assert.match(enabled.stdout, /Automatic WebUI updates enabled.*:stable at 04:15/);
  const installer = fs.readFileSync(installerPath, 'utf8');
  assert.match(installer, /one-person-lab-webui-update\.timer/);
  assert.match(installer, /Persistent=true/);
  assert.match(installer, /OnStartupSec=5m/);
  assert.match(installer, /cn\.onepersonlab\.webui-update/);
  assert.match(installer, /RunAtLoad/);
  assert.match(installer, /StartCalendarInterval/);
  assert.match(installer, /--pull never --force-recreate/);
  assert.match(
    installer,
    /compose -f "\$COMPOSE_FILE" up -d --pull never --force-recreate/,
  );
  assert.match(installer, /schema=opl_webui_host_auto_update_result\.v1/);
  assert.match(installer, /schema=opl_webui_host_auto_update_config\.v1/);
  assert.match(installer, /compose -f "\$COMPOSE_FILE" ps -q one-person-lab-webui/);
  assert.match(installer, /inspect "\$PREVIOUS_CONTAINER_ID" --format '\{\{\.Image\}\}'/);
  assert.match(installer, /LOCK_OWNER="\$LOCK_DIR\/owner\.pid"/);
  assert.match(installer, /kill -0 "\$lock_pid"/);
  assert.match(installer, /ps -p "\$lock_pid" -o command=/);
  assert.match(installer, /rmdir "\$LOCK_DIR".*return 1/);
  assert.doesNotMatch(
    installer,
    /raw\.githubusercontent\.com.*install-docker-webui\.sh/,
    'the scheduler must execute the locally generated updater rather than mutable branch code',
  );

  const disabled = runInstaller(['--dry-run', '--disable-auto-update'], env);
  assert.equal(disabled.status, 0, disabled.stderr || disabled.stdout);
  assert.match(disabled.stdout, /would unload LaunchAgent cn\.onepersonlab\.webui-update/);
  assert.match(disabled.stdout, /Manual --update remains available/);

  const status = runInstaller(['--auto-update-status'], env);
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.match(status.stdout, /scheduler=launchd_user/);
  assert.match(status.stdout, /enabled=false/);
  assert.match(status.stdout, /daily_time=not_configured/);
  assert.match(status.stdout, /status=not_run/);
});

test('Docker/WebUI installer executes the Linux systemd user timer dry-run path', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-linux-auto-update-home-'));
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin);
  const uname = path.join(bin, 'uname');
  fs.writeFileSync(uname, '#!/bin/sh\nprintf "Linux\\n"\n', 'utf8');
  fs.chmodSync(uname, 0o755);
  const enabled = runInstaller(
    ['--dry-run', '--yes', '--update', '--enable-auto-update', '--auto-update-time', '04:15', '--no-open'],
    { HOME: home, PATH: `${bin}:${process.env.PATH ?? ''}` },
  );

  assert.equal(enabled.status, 0, enabled.stderr || enabled.stdout);
  assert.match(enabled.stdout, /systemd user timer one-person-lab-webui-update\.timer at 04:15/);
  assert.match(enabled.stdout, /Automatic WebUI updates enabled.*:stable at 04:15/);

  const disabled = runInstaller(
    ['--dry-run', '--disable-auto-update'],
    { HOME: home, PATH: `${bin}:${process.env.PATH ?? ''}` },
  );
  assert.equal(disabled.status, 0, disabled.stderr || disabled.stdout);
  assert.match(disabled.stdout, /disable systemd user timer one-person-lab-webui-update\.timer/);

  const status = runInstaller(
    ['--auto-update-status'],
    { HOME: home, PATH: `${bin}:${process.env.PATH ?? ''}` },
  );
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.match(status.stdout, /scheduler=systemd_user/);
  assert.match(status.stdout, /enabled=false/);
  assert.match(status.stdout, /daily_time=not_configured/);
  assert.match(status.stdout, /status=not_run/);
});

test('Docker/WebUI auto-update rejects custom images and conflicting lifecycle actions', () => {
  const custom = runInstaller([
    '--dry-run',
    '--yes',
    '--enable-auto-update',
    '--tag',
    '26.7.28-r3',
    '--no-open',
  ]);
  assert.notEqual(custom.status, 0);
  assert.match(custom.stderr, /Automatic updates support only .*:stable/);

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-custom-channel-auto-update-home-'));
  const updater = path.join(home, 'OnePersonLab', 'updater');
  fs.mkdirSync(updater, { recursive: true });
  fs.writeFileSync(
    path.join(updater, 'config.env'),
    'schema=opl_webui_host_auto_update_config.v1\nchannel=ghcr.io/gaofeng21cn/one-person-lab-webui:stable\n',
  );
  const configuredCustom = runInstaller(
    ['--dry-run', '--yes', '--tag', '26.7.28-r3', '--no-open'],
    { HOME: home },
  );
  assert.notEqual(configuredCustom.status, 0);
  assert.match(configuredCustom.stderr, /Run --disable-auto-update before switching to a custom image/);

  const conflicting = runInstaller(['--dry-run', '--enable-auto-update', '--disable-auto-update']);
  assert.notEqual(conflicting.status, 0);
  assert.match(conflicting.stderr, /Choose only one of/);

  const invalidTime = runInstaller(['--dry-run', '--enable-auto-update', '--auto-update-time', '25:00']);
  assert.notEqual(invalidTime.status, 0);
  assert.match(invalidTime.stderr, /24-hour HH:MM format/);
});

test('Docker/WebUI installer dry-run can generate the cloud deployment template plan without starting Docker', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-cloud-template-home-'));
  const target = path.join(home, 'cloud');
  const result = runInstaller(['--dry-run', '--cloud-template', '--cloud-template-dir', target], { HOME: home });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Would copy cloud deployment template:/);
  assert.match(result.stdout, /deploy\/docker-webui\/cloud/);
  assert.match(result.stdout, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(result.stdout, /create secrets\/webui_password/);
  assert.match(result.stdout, /docker compose -f compose\.yaml up -d/);
  assert.doesNotMatch(result.stdout, /docker compose -f .*compose\.yaml up -d\n/);
  assert.equal(fs.existsSync(target), false, 'dry-run must not create the cloud template directory');
});

test('Docker/WebUI installer rejects API key parameters', () => {
  const result = runInstaller(['--dry-run', '--api-key', 'secret']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Do not pass API keys/);

  const providerKeyResult = runInstaller(['--dry-run', '--anthropic-api-key=secret']);
  assert.notEqual(providerKeyResult.status, 0);
  assert.match(providerKeyResult.stderr, /Do not pass API keys/);
});

test('Docker/WebUI installer validates health timeout before running', () => {
  const result = runInstaller(['--dry-run', '--health-timeout', '0']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Health timeout must be a positive integer/);
});

test('Docker/WebUI configure-codex probe retries runtime startup races but stops on secret leakage', () => {
  assert.equal(shouldRetryConfigureCodexProbe({
    errors: ['configure-codex proxy response did not report success=true'],
    elapsedMs: 2_000,
    timeoutMs: 120_000,
  }), true);
  assert.equal(shouldRetryConfigureCodexProbe({
    errors: ['configure-codex proxy response leaked the submitted API key placeholder'],
    elapsedMs: 2_000,
    timeoutMs: 120_000,
  }), false);
  assert.equal(shouldRetryConfigureCodexProbe({
    errors: ['configure-codex proxy response did not report success=true: surface_not_found: Mandatory OPL Flow plugin installer was not found.'],
    elapsedMs: 2_000,
    timeoutMs: 120_000,
  }), false);
  assert.equal(shouldRetryConfigureCodexProbe({
    errors: ['configure-codex proxy response did not report success=true'],
    elapsedMs: 120_000,
    timeoutMs: 120_000,
  }), false);
});

test('Docker/WebUI smoke gate writes typed blocker instead of passing unmatched VM gates', () => {
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-smoke-gate-'));
  const result = runSmokeGate(['--gate', 'clean_windows_vm', '--artifacts', artifacts, '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(artifacts, 'docker-webui-smoke-gate-result.json'), 'utf8'));
  assert.equal(payload.status, 'typed_blocker');
  assert.equal(payload.gate_id, 'clean_windows_vm');
  assert.match(payload.blocker.code, /windows_vm|requires_windows_vm/);
  assert.equal(payload.schema, 'opl_docker_webui_smoke_gate_result.v1');
  assert.equal(payload.ordinary_user_status.path_id, 'ordinary_docker_webui_user_path');
  assert.equal(payload.ordinary_user_status.priority, 'ordinary_user_path_before_evidence_bundle_language');
  assert.equal(payload.ordinary_user_status.access_key_settings.status, 'typed_blocker');
  assert.ok(payload.ordinary_user_status.must_not_claim.includes('clean_windows_vm_pass_without_clean_windows_evidence'));
});
