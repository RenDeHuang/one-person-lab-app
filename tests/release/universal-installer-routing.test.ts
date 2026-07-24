import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '../..');
const installerPath = path.join(appRoot, 'install.sh');

type RunOptions = {
  osName: string;
  args?: string[];
  nativeProbeStatus?: number;
  withNativeVerifier?: boolean;
  env?: Record<string, string>;
};

const nativeVerifierSource = `#!/usr/bin/env bash
# dev.onepersonlab.opl-native-webui-artifact.v1
# --probe-artifact
`;
const nativeVerifierSha256 = crypto.createHash('sha256').update(nativeVerifierSource).digest('hex');

function runInstaller(options: RunOptions) {
  const args = options.args ?? [];
  const mirrorIndex = args.indexOf('--native-mirror');
  const versionIndex = args.indexOf('--native-version');
  const nativeMirror = mirrorIndex >= 0 ? args[mirrorIndex + 1] : options.env?.OPL_NATIVE_WEBUI_MIRROR;
  const nativeVersion = versionIndex >= 0 ? args[versionIndex + 1] : options.env?.OPL_NATIVE_WEBUI_VERSION;
  const nativeInstallerUrl =
    nativeMirror && nativeVersion
      ? `${nativeMirror.replace(/\/$/, '')}/v${nativeVersion}/install-web.sh`
      : 'file:///unconfigured-native-verifier';
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-universal-installer-'));
  const binDir = path.join(fixture, 'bin');
  const logPath = path.join(fixture, 'routing.log');
  const nativeVerifierPath = path.join(fixture, 'native-verifier.sh');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(nativeVerifierPath, nativeVerifierSource);
  fs.writeFileSync(
    path.join(binDir, 'uname'),
    `#!/usr/bin/env sh
printf '%s\\n' "$TEST_UNAME_S"
`
  );
  fs.writeFileSync(
    path.join(binDir, 'curl'),
    `#!/usr/bin/env sh
printf 'curl:%s\\n' "$*" >> "$OPL_ROUTING_TEST_LOG"
output=''
previous=''
for arg in "$@"; do
  if [ "$previous" = "-o" ]; then
    output="$arg"
    break
  fi
  previous="$arg"
done
if [ -n "$output" ]; then
  cp "$TEST_NATIVE_INSTALLER_SOURCE" "$output"
else
  printf '%s\\n' '# installer payload'
fi
`
  );
  fs.writeFileSync(
    path.join(binDir, 'bash'),
    `#!/usr/bin/env sh
printf 'bash:%s\\n' "$*" >> "$OPL_ROUTING_TEST_LOG"
case " $* " in
  *" --probe-artifact "*)
    exit "\${TEST_NATIVE_PROBE_STATUS:-1}"
    ;;
esac
cat >/dev/null || true
`
  );
  for (const name of ['uname', 'curl', 'bash']) {
    fs.chmodSync(path.join(binDir, name), 0o755);
  }

  const result = spawnSync('/bin/bash', [installerPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      TEST_UNAME_S: options.osName,
      TEST_NATIVE_PROBE_STATUS: String(options.nativeProbeStatus ?? 1),
      TEST_NATIVE_INSTALLER_SOURCE: nativeVerifierPath,
      OPL_ROUTING_TEST_LOG: logPath,
      ...(options.withNativeVerifier
        ? {
            OPL_NATIVE_WEBUI_INSTALLER_URL: nativeInstallerUrl,
            OPL_NATIVE_WEBUI_INSTALLER_SHA256: nativeVerifierSha256,
          }
        : {}),
      ...options.env,
    },
  });
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  fs.rmSync(fixture, { recursive: true, force: true });
  return { ...result, log };
}

test('macOS personal default routes to Desktop bootstrap', () => {
  const result = runInstaller({ osName: 'Darwin' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.log,
    /curl:-fsSL https:\/\/raw\.githubusercontent\.com\/gaofeng21cn\/one-person-lab\/main\/install\.sh/
  );
  assert.match(result.log, /bash:-s -- --with-app$/m);
  assert.doesNotMatch(result.log, /--skip-packages/);
  assert.doesNotMatch(result.log, /install-docker-webui/);
});

test('Linux personal default uses explicit Container fallback when no Native candidate is configured', () => {
  const result = runInstaller({ osName: 'Linux', args: ['--yes'] });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Native WebUI is not yet available as a verified artifact/);
  assert.match(result.log, /install-docker-webui\.sh/);
  assert.match(result.log, /bash:-s -- --yes/);
  assert.doesNotMatch(result.log, /--probe-artifact/);
});

test('Linux personal auto selects Native only for verified App Release base mirrors', () => {
  for (const mirror of [
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/',
  ]) {
    const result = runInstaller({
      osName: 'Linux',
      args: ['--native-mirror', mirror, '--native-version', '1.2.3'],
      nativeProbeStatus: 0,
      withNativeVerifier: true,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.log, /--version 1\.2\.3 --probe-artifact/);
    assert.match(result.log, /--version 1\.2\.3$/m);
    assert.doesNotMatch(result.log, /install-docker-webui/);
  }
});

test('explicit Native selection accepts a verified local development candidate', () => {
  const result = runInstaller({
    osName: 'Linux',
    args: ['--native-webui', '--native-mirror', 'file:///verified', '--native-version', '1.2.3'],
    nativeProbeStatus: 0,
    withNativeVerifier: true,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.log, /file:\/\/\/verified\/v1\.2\.3\/install-web\.sh/);
  assert.match(result.log, /--version 1\.2\.3 --probe-artifact/);
  assert.match(result.log, /--version 1\.2\.3$/m);
  assert.doesNotMatch(result.log, /install-docker-webui/);
});

test('Linux personal auto never consumes a local development candidate', () => {
  const result = runInstaller({
    osName: 'Linux',
    args: ['--native-mirror', 'file:///verified', '--native-version', '1.2.3'],
    nativeProbeStatus: 0,
    withNativeVerifier: true,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Local Native WebUI candidates require explicit --native-webui selection/);
  assert.match(result.log, /install-docker-webui\.sh/);
  assert.doesNotMatch(result.log, /native-verifier/);
  assert.doesNotMatch(result.log, /--probe-artifact/);
});

test('mutable verifier URL without caller-supplied digest fails closed', () => {
  const result = runInstaller({
    osName: 'Linux',
    args: ['--native-webui', '--native-mirror', 'file:///verified', '--native-version', '1.2.3'],
    env: {
      OPL_NATIVE_WEBUI_INSTALLER_URL:
        'https://raw.githubusercontent.com/gaofeng21cn/opl-aion-shell/main/scripts/install-web.sh',
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires an explicit URL and caller-supplied SHA256/);
  assert.doesNotMatch(result.log, /--probe-artifact/);
});

test('caller-selected verifier URL fails even when its digest is self-consistent', () => {
  const result = runInstaller({
    osName: 'Linux',
    args: [
      '--native-webui',
      '--native-mirror',
      'https://github.com/gaofeng21cn/one-person-lab-app/releases/download',
      '--native-version',
      '1.2.3',
    ],
    withNativeVerifier: true,
    env: {
      OPL_NATIVE_WEBUI_INSTALLER_URL:
        'https://raw.githubusercontent.com/gaofeng21cn/opl-aion-shell/main/scripts/install-web.sh',
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be the install-web\.sh asset from the selected App Release version/);
  assert.doesNotMatch(result.log, /native-verifier/);
  assert.doesNotMatch(result.log, /--probe-artifact/);
});

test('non-App remote Native mirror fails closed before verifier download', () => {
  const result = runInstaller({
    osName: 'Linux',
    args: [
      '--native-webui',
      '--native-mirror',
      'https://example.com/self-signed/releases/download/v1.2.3',
      '--native-version',
      '1.2.3',
    ],
    withNativeVerifier: true,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be the One Person Lab App GitHub Release base namespace/);
  assert.doesNotMatch(result.log, /native-verifier/);
  assert.doesNotMatch(result.log, /--probe-artifact/);
});

test('App Release mirror with an embedded version path fails before verifier download', () => {
  const result = runInstaller({
    osName: 'Linux',
    args: [
      '--native-webui',
      '--native-mirror',
      'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v1.2.3',
      '--native-version',
      '1.2.3',
    ],
    withNativeVerifier: true,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be the One Person Lab App GitHub Release base namespace/);
  assert.doesNotMatch(result.log, /native-verifier/);
  assert.doesNotMatch(result.log, /--probe-artifact/);
});

test('verifier digest mismatch fails closed before execution', () => {
  const result = runInstaller({
    osName: 'Linux',
    args: ['--native-webui', '--native-mirror', 'file:///verified', '--native-version', '1.2.3'],
    withNativeVerifier: true,
    env: { OPL_NATIVE_WEBUI_INSTALLER_SHA256: '0'.repeat(64) },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /verifier SHA256 mismatch/);
  assert.doesNotMatch(result.log, /--probe-artifact/);
});

test('explicit Native request fails closed without a verified OPL artifact', () => {
  const result = runInstaller({ osName: 'Linux', args: ['--native-webui'] });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /verified OPL Native WebUI artifact is required/);
  assert.doesNotMatch(result.log, /install-docker-webui/);
});

test('Native artifact identity does not imply support or qualification', () => {
  const source = fs.readFileSync(installerPath, 'utf8');

  assert.match(source, /Native WebUI development candidate is currently implemented only for Linux hosts/);
  assert.doesNotMatch(source, /Native WebUI selection is currently qualified/);
  assert.doesNotMatch(source, /opl-native-webui-probe\.log/);
});

test('server and isolated scenarios route to Container even when a Native candidate exists', () => {
  for (const scenario of ['--server', '--isolated']) {
    const result = runInstaller({
      osName: 'Linux',
      args: [
        scenario,
        '--native-mirror',
        'https://github.com/gaofeng21cn/one-person-lab-app/releases/download',
        '--native-version',
        '1.2.3',
      ],
      nativeProbeStatus: 0,
      withNativeVerifier: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.log, /install-docker-webui\.sh/);
    assert.doesNotMatch(result.log, /--probe-artifact/);
  }
});

test('headless routes to Framework Base-only without an App runtime form', () => {
  const result = runInstaller({ osName: 'Linux', args: ['--headless'] });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.log, /bash:-s -- --headless --skip-packages/);
  assert.doesNotMatch(result.log, /--with-app/);
  assert.doesNotMatch(result.log, /install-docker-webui/);
});

test('unsupported platforms fail closed before invoking an installer', () => {
  const result = runInstaller({ osName: 'Plan9' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported platform/);
  assert.equal(result.log, '');
});

test('unknown install scenarios fail closed before invoking an installer', () => {
  const result = runInstaller({
    osName: 'Linux',
    env: { OPL_INSTALL_SCENARIO: 'workstation-ish' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported install scenario/);
  assert.equal(result.log, '');
});
