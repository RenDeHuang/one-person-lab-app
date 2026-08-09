import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '../..');
const version = '26.7.29-nightly';
const linuxAssetName = `One-Person-Lab-${version}-linux-x64.deb`;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-prepare-release-assets-'));
  const artifacts = path.join(root, 'artifacts');
  const output = path.join(root, 'output');
  const shell = path.join(root, 'shell');
  fs.mkdirSync(path.join(artifacts, 'macos'), { recursive: true });
  fs.mkdirSync(path.join(artifacts, 'linux'), { recursive: true });
  fs.mkdirSync(path.join(shell, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(artifacts, 'macos', `One-Person-Lab-${version}-mac-arm64.dmg`), 'dmg');
  fs.writeFileSync(path.join(artifacts, 'macos', `One-Person-Lab-${version}-mac-arm64.zip`), 'zip');
  fs.writeFileSync(
    path.join(artifacts, 'macos', `One-Person-Lab-${version}-mac-arm64.zip.blockmap`),
    'blockmap',
  );
  fs.writeFileSync(path.join(artifacts, 'macos', 'latest-arm64-mac.yml'), `version: ${version}\n`);
  fs.writeFileSync(path.join(artifacts, 'linux', linuxAssetName), 'linux desktop');
  const normalizer = path.join(shell, 'scripts', 'prepare-release-assets.sh');
  fs.writeFileSync(normalizer, `#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$2"
while IFS= read -r file; do
  case "$file" in
    *-mac-arm64.dmg|*-mac-arm64.zip|*.blockmap|*/latest-arm64-mac.yml) cp "$file" "$2/" ;;
  esac
done < <(find "$1" -type f -print)
`);
  fs.chmodSync(normalizer, 0o755);
  return { root, artifacts, output, shell };
}

function run(input: ReturnType<typeof fixture>, args: string[] = []) {
  return spawnSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/prepare-release-assets.ts',
    input.artifacts,
    input.output,
    ...args,
  ], {
    cwd: appRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      OPL_APP_SHELL_ROOT: input.shell,
      OPL_RELEASE_VERSION: version,
    },
  });
}

test('release asset staging preserves exactly one current Linux Desktop payload', (t) => {
  const input = fixture();
  t.after(() => fs.rmSync(input.root, { recursive: true, force: true }));
  const result = run(input);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(input.output, linuxAssetName), 'utf8'), 'linux desktop');
});

test('release asset staging fails closed when the current Linux Desktop payload is absent or duplicated', (t) => {
  const missing = fixture();
  const duplicate = fixture();
  t.after(() => {
    fs.rmSync(missing.root, { recursive: true, force: true });
    fs.rmSync(duplicate.root, { recursive: true, force: true });
  });

  fs.rmSync(path.join(missing.artifacts, 'linux', linuxAssetName));
  const missingResult = run(missing);
  assert.notEqual(missingResult.status, 0);
  assert.match(missingResult.stderr, /Expected exactly one .*linux-x64\.deb, found 0/);

  fs.mkdirSync(path.join(duplicate.artifacts, 'duplicate'));
  fs.copyFileSync(
    path.join(duplicate.artifacts, 'linux', linuxAssetName),
    path.join(duplicate.artifacts, 'duplicate', linuxAssetName),
  );
  const duplicateResult = run(duplicate);
  assert.notEqual(duplicateResult.status, 0);
  assert.match(duplicateResult.stderr, /Expected exactly one .*linux-x64\.deb, found 2/);
});

test('release asset staging can omit Linux Desktop for a macOS-only Nightly', (t) => {
  const input = fixture();
  t.after(() => fs.rmSync(input.root, { recursive: true, force: true }));
  fs.rmSync(path.join(input.artifacts, 'linux', linuxAssetName));

  const result = run(input, ['--skip-linux-desktop-payload']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(input.output, linuxAssetName)), false);
  assert.equal(
    fs.existsSync(path.join(input.output, `One-Person-Lab-${version}-mac-arm64.dmg`)),
    true,
  );
});
