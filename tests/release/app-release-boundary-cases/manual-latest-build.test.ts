import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertDevelopmentRepoSnapshotUnchanged,
  manualVersions,
  snapshotDevelopmentRepo,
} from '../../../scripts/manual-latest-build/common.ts';
import {
  projectFrameworkPackageManifest,
} from '../../../scripts/manual-latest-build/framework-overlay.ts';
import {
  assertManualAppVersionIdentity,
  installLocalApp,
  ManualAppInstallationError,
} from '../../../scripts/manual-latest-build/install-app.ts';
import {
  selectLatestMineruCliRelease,
} from '../../../scripts/manual-latest-build/upstreams.ts';

const appRoot = path.resolve(import.meta.dirname, '..', '..', '..');

function createDevelopmentRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-manual-source-snapshot-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'OPL Test'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'opl-test@example.invalid'], { cwd: root });
  fs.writeFileSync(path.join(root, 'source.txt'), 'initial\n');
  execFileSync('git', ['add', 'source.txt'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: root });
  return root;
}

function writeExecutable(filePath: string, source: string) {
  fs.writeFileSync(filePath, source, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function createTestApp(
  appPath: string,
  input: { displayVersion: string; updaterVersion: string; marker?: string },
) {
  const contents = path.join(appPath, 'Contents');
  const manifestRoot = path.join(contents, 'Resources', 'opl-full-runtime', 'manifest');
  fs.mkdirSync(manifestRoot, { recursive: true });
  fs.writeFileSync(path.join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>cn.onepersonlab.opl</string>
  <key>CFBundleShortVersionString</key>
  <string>${input.updaterVersion}</string>
  <key>CFBundleVersion</key>
  <string>${input.updaterVersion}</string>
</dict>
</plist>
`, 'utf8');
  fs.writeFileSync(
    path.join(manifestRoot, 'full-package-manifest.json'),
    `${JSON.stringify({ version: input.displayVersion })}\n`,
    'utf8',
  );
  if (input.marker) fs.writeFileSync(path.join(contents, input.marker), '\n', 'utf8');
}

function createFakeMacInstallCommands(root: string) {
  const binaryRoot = path.join(root, 'bin');
  fs.mkdirSync(binaryRoot, { recursive: true });
  writeExecutable(path.join(binaryRoot, 'codesign'), `#!/bin/sh
app_path=''
for argument in "$@"; do app_path="$argument"; done
if [ "$app_path" = "$OPL_TEST_INSTALL_PATH" ] && {
  [ -f "$app_path/Contents/OLD_SIGNATURE_POLLUTION" ] ||
  [ -f "$app_path/Contents/FAIL_FINAL_SIGNATURE" ];
}; then
  echo 'a sealed resource is missing or invalid' >&2
  exit 1
fi
exit 0
`);
  writeExecutable(path.join(binaryRoot, 'ditto'), `#!/bin/sh
exec /bin/cp -R "$1" "$2"
`);
  writeExecutable(path.join(binaryRoot, 'pgrep'), `#!/bin/sh
if [ -f "$OPL_TEST_RUNNING_STATE" ] && [ "$(/bin/cat "$OPL_TEST_RUNNING_STATE")" = '1' ]; then
  echo 4242
  exit 0
fi
exit 1
`);
  writeExecutable(path.join(binaryRoot, 'osascript'), `#!/bin/sh
echo 0 > "$OPL_TEST_RUNNING_STATE"
`);
  writeExecutable(path.join(binaryRoot, 'open'), `#!/bin/sh
echo 1 > "$OPL_TEST_RUNNING_STATE"
`);
  writeExecutable(path.join(binaryRoot, 'xattr'), '#!/bin/sh\nexit 0\n');
  return binaryRoot;
}

test('manual latest versions use the Asia/Shanghai date and monotonic updater encoding', () => {
  assert.deepEqual(manualVersions(new Date('2026-07-20T15:59:59Z')), {
    displayVersion: '26.7.20',
    updaterVersion: '26.7.20',
  });
  assert.deepEqual(manualVersions(new Date('2026-07-20T16:00:00Z')), {
    displayVersion: '26.7.21',
    updaterVersion: '26.7.2100',
  });
});

test('MinerU latest selection ignores drafts, prereleases, and unrelated tags', () => {
  const selected = selectLatestMineruCliRelease([
    { tag_name: 'v9.0.0', draft: false, prerelease: false },
    { tag_name: 'cli/v0.2.0', draft: false, prerelease: false },
    { tag_name: 'cli/v0.3.0', draft: false, prerelease: true },
    { tag_name: 'cli/v0.4.0', draft: true, prerelease: false },
    { tag_name: 'cli/v0.2.1', draft: false, prerelease: false },
  ]);
  assert.equal(selected.tag_name, 'cli/v0.2.1');
});

test('Framework projection stamps the latest owner commit without mutating its inputs', () => {
  const frameworkManifest = {
    package_id: 'mas',
    version: '0.2.15',
    source: 'first_party_owner_projection',
    source_repo: 'https://github.com/gaofeng21cn/med-autoscience.git',
    source_manifest_ref: 'contracts/opl_agent_package_manifest.json',
    source_commit: 'old-commit',
    codex_surface: {
      plugin_payload_manifest_url: 'payloads/mas-0.2.15.json',
      carrier_source_commit: 'old-commit',
      framework_only: true,
    },
  };
  const ownerManifest = {
    package_id: 'mas',
    version: '0.2.15',
    source_commit: 'owner-recorded-commit',
    codex_surface: {
      plugin_payload_manifest_url: 'payloads/mas-0.2.15.json',
      carrier_source_commit: 'owner-recorded-commit',
      owner_only: true,
    },
  };
  const originalFramework = structuredClone(frameworkManifest);
  const originalOwner = structuredClone(ownerManifest);

  const projected = projectFrameworkPackageManifest(
    frameworkManifest,
    ownerManifest,
    'latest-owner-commit',
  );

  assert.equal(projected.source, 'first_party_owner_projection');
  assert.equal(projected.source_commit, 'latest-owner-commit');
  assert.equal(projected.codex_surface.carrier_source_commit, 'latest-owner-commit');
  assert.equal(projected.codex_surface.framework_only, true);
  assert.equal(projected.codex_surface.owner_only, true);
  assert.deepEqual(frameworkManifest, originalFramework);
  assert.deepEqual(ownerManifest, originalOwner);
});

test('manual App identity separates UI display version from both machine CFBundle versions', () => {
  const identity = {
    bundle_id: 'cn.onepersonlab.opl',
    display_version: '26.7.21',
    updater_version: '26.7.2100',
    cf_bundle_short_version: '26.7.2100',
    cf_bundle_version: '26.7.2100',
    full_manifest: '/tmp/full-package-manifest.json',
  };
  assert.doesNotThrow(() => assertManualAppVersionIdentity(identity, '26.7.21', '26.7.2100'));
  assert.throws(
    () => assertManualAppVersionIdentity(
      { ...identity, cf_bundle_short_version: '26.7.21' },
      '26.7.21',
      '26.7.2100',
    ),
    /version identity mismatch/,
  );
  assert.throws(
    () => assertManualAppVersionIdentity(
      { ...identity, display_version: null },
      '26.7.21',
      '26.7.2100',
    ),
    /display=<missing>/,
  );
});

test('manual installer replaces a runtime-mutated baseline and types a failed replacement rollback', {
  skip: process.platform !== 'darwin',
}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-manual-install-test-'));
  const binaryRoot = createFakeMacInstallCommands(root);
  const originalPath = process.env.PATH;
  const originalInstallPath = process.env.OPL_TEST_INSTALL_PATH;
  const originalRunningState = process.env.OPL_TEST_RUNNING_STATE;
  try {
    process.env.PATH = `${binaryRoot}:${originalPath ?? ''}`;

    const successRoot = path.join(root, 'success');
    const successInstall = path.join(successRoot, 'Applications', 'One Person Lab.app');
    const successBuilt = path.join(successRoot, 'built', 'One Person Lab.app');
    const successRunning = path.join(successRoot, 'running-state');
    createTestApp(successInstall, {
      displayVersion: '26.7.20',
      updaterVersion: '26.7.20',
      marker: 'OLD_SIGNATURE_POLLUTION',
    });
    createTestApp(successBuilt, {
      displayVersion: '26.7.21',
      updaterVersion: '26.7.2100',
    });
    fs.writeFileSync(successRunning, '0\n', 'utf8');
    process.env.OPL_TEST_INSTALL_PATH = successInstall;
    process.env.OPL_TEST_RUNNING_STATE = successRunning;

    const completed = installLocalApp({
      builtApp: successBuilt,
      installPath: successInstall,
      expectedDisplayVersion: '26.7.21',
      expectedUpdaterVersion: '26.7.2100',
      launch: false,
    });
    assert.equal(completed.status, 'completed');
    assert.equal(completed.replaced_version?.display_version, '26.7.20');
    assert.equal(completed.replaced_signature?.status, 'invalid');
    assert.match(completed.replaced_signature?.diagnostics ?? '', /sealed resource/);
    assert.equal(completed.installed_version.display_version, '26.7.21');
    assert.equal(fs.existsSync(path.join(successInstall, 'Contents', 'OLD_SIGNATURE_POLLUTION')), false);

    const failureRoot = path.join(root, 'failure');
    const failureInstall = path.join(failureRoot, 'Applications', 'One Person Lab.app');
    const failureBuilt = path.join(failureRoot, 'built', 'One Person Lab.app');
    const failureRunning = path.join(failureRoot, 'running-state');
    createTestApp(failureInstall, {
      displayVersion: '26.7.20',
      updaterVersion: '26.7.20',
      marker: 'OLD_SIGNATURE_POLLUTION',
    });
    createTestApp(failureBuilt, {
      displayVersion: '26.7.21',
      updaterVersion: '26.7.2100',
      marker: 'FAIL_FINAL_SIGNATURE',
    });
    fs.writeFileSync(failureRunning, '1\n', 'utf8');
    process.env.OPL_TEST_INSTALL_PATH = failureInstall;
    process.env.OPL_TEST_RUNNING_STATE = failureRunning;

    let failure: unknown = null;
    try {
      installLocalApp({
        builtApp: failureBuilt,
        installPath: failureInstall,
        expectedDisplayVersion: '26.7.21',
        expectedUpdaterVersion: '26.7.2100',
        launch: false,
      });
    } catch (error) {
      failure = error;
    }
    assert.ok(failure instanceof ManualAppInstallationError);
    assert.equal(failure.receipt.phase, 'verify_installed');
    assert.equal(failure.receipt.rollback.baseline_preserved_at_install_path, true);
    assert.equal(failure.receipt.rollback.relaunch_required, true);
    assert.equal(failure.receipt.rollback.relaunched, true);
    assert.equal(failure.receipt.rollback.error, null);
    assert.equal(fs.readFileSync(failureRunning, 'utf8').trim(), '1');
    assert.equal(fs.existsSync(path.join(failureInstall, 'Contents', 'OLD_SIGNATURE_POLLUTION')), true);
    assert.equal(fs.existsSync(path.join(failureInstall, 'Contents', 'FAIL_FINAL_SIGNATURE')), false);
    assert.deepEqual(
      fs.readdirSync(path.dirname(failureInstall)).filter((entry) => entry.startsWith('.opl-manual-app-')),
      [],
    );
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalInstallPath === undefined) delete process.env.OPL_TEST_INSTALL_PATH;
    else process.env.OPL_TEST_INSTALL_PATH = originalInstallPath;
    if (originalRunningState === undefined) delete process.env.OPL_TEST_RUNNING_STATE;
    else process.env.OPL_TEST_RUNNING_STATE = originalRunningState;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('manual source snapshot gate rejects tracked source dirtiness after freeze', (context) => {
  const root = createDevelopmentRepo();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const frozen = snapshotDevelopmentRepo('fixture', root);

  assert.doesNotThrow(() => assertDevelopmentRepoSnapshotUnchanged(frozen));
  fs.writeFileSync(path.join(root, 'source.txt'), 'dirty\n');

  assert.throws(
    () => assertDevelopmentRepoSnapshotUnchanged(frozen),
    /fixture source snapshot became invalid during manual latest build:.*not clean/s,
  );
});

test('manual source snapshot gate rejects main advancement after freeze', (context) => {
  const root = createDevelopmentRepo();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const frozen = snapshotDevelopmentRepo('fixture', root);

  fs.writeFileSync(path.join(root, 'source.txt'), 'advanced\n');
  execFileSync('git', ['add', 'source.txt'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'advance'], { cwd: root });

  assert.throws(
    () => assertDevelopmentRepoSnapshotUnchanged(frozen),
    /fixture source snapshot changed during manual latest build: head expected=/,
  );
});

test('manual latest commands and operator guide remain discoverable', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  assert.equal(
    packageJson.scripts['manual:local-app'],
    'node --experimental-strip-types scripts/manual-latest-build.ts local-app',
  );
  assert.equal(
    packageJson.scripts['manual:full-dmg'],
    'node --experimental-strip-types scripts/manual-latest-build.ts full-dmg',
  );
  assert.equal(
    fs.existsSync(path.join(appRoot, 'docs', 'delivery', 'release', 'manual-latest-builds.md')),
    true,
  );
});
