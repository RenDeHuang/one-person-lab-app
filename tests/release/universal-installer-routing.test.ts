import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { createAppComponentManifest } from '../../scripts/write-opl-app-component-manifest.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const installerPath = path.join(appRoot, 'install.sh');

function sha256(bytes: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function writeExecutable(filePath: string, source: string): void {
  fs.writeFileSync(filePath, source);
  fs.chmodSync(filePath, 0o755);
}

function route(osName: string, architecture: string, args: string[] = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-install-route-'));
  try {
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    const uname = path.join(bin, 'uname');
    fs.writeFileSync(uname, `#!/usr/bin/env sh\ncase "\${1:-}" in\n  -s) printf '%s\\n' '${osName}' ;;\n  -m) printf '%s\\n' '${architecture}' ;;\nesac\n`);
    fs.chmodSync(uname, 0o755);
    return spawnSync('/bin/bash', [installerPath, '--print-install-route', ...args], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function directStableMacInstall(osName: string, architecture: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-direct-macos-install-'));
  try {
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    writeExecutable(
      path.join(bin, 'uname'),
      `#!/usr/bin/env sh\ncase "\${1:-}" in\n  -s) printf '%s\\n' '${osName}' ;;\n  -m) printf '%s\\n' '${architecture}' ;;\nesac\n`,
    );
    return spawnSync('/bin/bash', [installerPath, '--stable-macos-install', '--yes', '--no-open'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('personal hosts install one platform Desktop payload by default', () => {
  assert.equal(route('Darwin', 'arm64').stdout.trim(), 'desktop');
  assert.equal(route('Linux', 'x86_64').stdout.trim(), 'linux-desktop');
});

test('explicit Desktop density reaches the platform carrier and unsupported Linux Full fails closed', () => {
  assert.equal(route('Darwin', 'arm64', ['--standard']).stdout.trim(), 'desktop-standard');
  assert.equal(route('Darwin', 'arm64', ['--full']).stdout.trim(), 'desktop-full');
  assert.equal(route('Linux', 'x86_64', ['--standard']).stdout.trim(), 'linux-desktop-standard');

  const linuxFull = route('Linux', 'x86_64', ['--full']);
  assert.notEqual(linuxFull.status, 0);
  assert.equal(linuxFull.stdout, '');
  assert.match(
    linuxFull.stderr,
    /Full Desktop density is not published for Linux x86_64; use --standard/,
  );
});

test('WebUI mode reuses packaged Desktop bytes and native-webui is only its deprecated alias', () => {
  const webui = route('Linux', 'x86_64', ['--webui']);
  const alias = route('Linux', 'x86_64', ['--native-webui']);
  assert.equal(webui.status, 0, webui.stderr);
  assert.equal(webui.stdout.trim(), 'linux-desktop-webui');
  assert.equal(alias.status, 0, alias.stderr);
  assert.equal(alias.stdout.trim(), 'linux-desktop-webui');
  assert.match(alias.stderr, /deprecated; using the packaged Desktop WebUI mode/);
});

test('server, isolated, headless, and Windows routes stay distinct from the Desktop carrier', () => {
  assert.equal(route('Linux', 'x86_64', ['--server']).stdout.trim(), 'container-webui');
  assert.equal(route('Linux', 'x86_64', ['--isolated']).stdout.trim(), 'container-webui');
  assert.equal(route('Linux', 'x86_64', ['--headless']).stdout.trim(), 'headless');
  assert.equal(route('MINGW64_NT-10.0', 'x86_64').stdout.trim(), 'container-webui');
});

test('unsupported Desktop architecture fails closed before any release asset lookup', () => {
  const result = route('Linux', 'aarch64');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /supported only on macOS arm64 and Linux x86_64/);

  const intelMac = route('Darwin', 'x86_64');
  assert.notEqual(intelMac.status, 0);
  assert.match(intelMac.stderr, /supported only on macOS arm64 and Linux x86_64/);
});

test('direct Stable macOS helper rejects Intel before release asset lookup', () => {
  const result = directStableMacInstall('Darwin', 'x86_64');
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /supported only on macOS arm64/);
  assert.doesNotMatch(result.stderr, /curl|download|release/i);
});

test('Linux Desktop resolves its package from the same exact Release tag', () => {
  const source = fs.readFileSync(installerPath, 'utf8');
  assert.match(source, /resolve_release_asset "\$record_path" "\$asset_name"/);
  assert.match(source, /releases\/download\/\$tag\/\$asset_name/);
  assert.match(source, /Linux Desktop asset URL is not bound to the selected Desktop Release/);
  assert.doesNotMatch(source, /resolve_linux_adjunct_release_record|v\*-optional-\*|opl-optional-platforms-manifest\.json/);
});

test('the universal installer has no Native tarball discovery or verifier fallback', () => {
  const source = fs.readFileSync(installerPath, 'utf8');
  assert.match(source, /One-Person-Lab-\$\{version\}-linux-x64\.deb/);
  assert.doesNotMatch(source, /resolve_linux_adjunct_release_record|opl-optional-platforms-manifest\.json/);
  assert.match(source, /desktop_release_asset_selection_requested/);
  assert.match(source, /validate_install_density_for_route "\$SELECTED_INSTALL_ROUTE"/);
  assert.match(source, /if desktop_release_asset_selection_requested; then\s+stable_macos_install/);
  assert.doesNotMatch(source, /OPL_NATIVE_WEBUI_|install-web\.sh|native-webui-qualified/);
});

test('macOS Full resolves from the exact Standard tag and binds its unified attestation', () => {
  const source = fs.readFileSync(installerPath, 'utf8');
  assert.match(source, /asset_name=\$\(release_asset_name "\$tag" full\)/);
  assert.match(source, /releases\/download\/\$tag\/\$asset_name/);
  assert.match(source, /carrier_context\.standard_attestation\.sha256/);
  assert.match(source, /Full public manifest does not bind the exact Full DMG digest and size/);
  assert.match(source, /Full DMG identity changed while validating its same-tag public manifest/);
  assert.match(source, /No same-tag Full module is published/);
  assert.match(source, /continuing with the Standard DMG/);
  assert.doesNotMatch(source, /resolve_full_adjunct_release_record/);
  assert.doesNotMatch(source, /resolve_linux_adjunct_release_record/);
});
