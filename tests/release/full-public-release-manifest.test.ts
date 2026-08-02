import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildFullPublicReleaseManifest } from '../../scripts/build-full-first-install-package.ts';

test('Full public manifest binds its DMG with a canonical prefixed SHA-256 digest', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-public-manifest-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dmgName = 'One-Person-Lab-Full-26.8.1-r5-mac-arm64.dmg';
  const dmgPath = path.join(root, dmgName);
  fs.writeFileSync(dmgPath, 'exact Full DMG fixture bytes\n');

  const manifest = buildFullPublicReleaseManifest({
    version: '26.8.1-r5',
    updaterVersion: '26.8.1005',
    artifactNames: {
      dmg: dmgName,
      manifest: 'full-package-manifest.json',
      runtimeCacheEvents: 'runtime-cache-events.json',
      readme: 'README-Full-First-Install.txt',
    },
    outDir: root,
    fullDmgPath: dmgPath,
    fullPackageManifest: { version: '26.8.1-r5' },
    runtimeCacheEvents: { events: [] },
    runtimeCurrentnessProbePath: path.join(root, 'full-runtime-currentness-probe.json'),
    runtimeNativeTrust: { status: 'passed' },
    appBundleTrimReport: null,
    packageBoundaryAudit: null,
    precompressionGate: null,
  });
  const expected = crypto.createHash('sha256').update(fs.readFileSync(dmgPath)).digest('hex');

  assert.equal(manifest.assets.length, 1);
  assert.equal(manifest.assets[0].name, dmgName);
  assert.equal(manifest.assets[0].sha256, `sha256:${expected}`);
  assert.match(manifest.assets[0].sha256, /^sha256:[0-9a-f]{64}$/);
});
