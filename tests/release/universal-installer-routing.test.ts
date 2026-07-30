import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '../..');
const installerPath = path.join(appRoot, 'install.sh');

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
});

test('the universal installer has no Native tarball discovery or verifier fallback', () => {
  const source = fs.readFileSync(installerPath, 'utf8');
  assert.match(source, /One-Person-Lab-\$\{version\}-linux-x64\.deb/);
  assert.match(source, /Component manifest does not bind the exact Linux Desktop package/);
  assert.match(source, /desktop_release_asset_selection_requested/);
  assert.match(source, /validate_install_density_for_route "\$SELECTED_INSTALL_ROUTE"/);
  assert.match(source, /if desktop_release_asset_selection_requested; then\s+stable_macos_install/);
  assert.doesNotMatch(source, /OPL_NATIVE_WEBUI_|install-web\.sh|native-webui-qualified/);
});
