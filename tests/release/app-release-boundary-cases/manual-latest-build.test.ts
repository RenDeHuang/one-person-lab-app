import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  manualVersions,
} from '../../../scripts/manual-latest-build/common.ts';
import {
  projectFrameworkPackageManifest,
} from '../../../scripts/manual-latest-build/framework-overlay.ts';
import {
  assertManualAppVersionIdentity,
} from '../../../scripts/manual-latest-build/install-app.ts';
import {
  selectLatestMineruCliRelease,
} from '../../../scripts/manual-latest-build/upstreams.ts';

const appRoot = path.resolve(import.meta.dirname, '..', '..', '..');

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
