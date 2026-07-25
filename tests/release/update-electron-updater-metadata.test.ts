import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import { updateElectronUpdaterMetadataForArtifact } from '../../scripts/update-electron-updater-metadata.ts';

test('rebinds only the finalized DMG entries in electron-updater metadata', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-updater-final-dmg-'));
  try {
    const dmgName = 'One-Person-Lab-26.7.25-mac-arm64.dmg';
    const zipName = 'One-Person-Lab-26.7.25-mac-arm64.zip';
    const dmgPath = path.join(root, dmgName);
    fs.writeFileSync(dmgPath, 'final-stapled-dmg-bytes\n');
    fs.writeFileSync(path.join(root, 'latest-mac.yml'), [
      'version: 26.7.25',
      'files:',
      `  - url: ${zipName}`,
      '    sha512: zip-sha',
      '    size: 12',
      `  - url: ${dmgName}`,
      '    sha512: stale-dmg-sha',
      '    size: 10',
      `path: ${zipName}`,
      'sha512: zip-sha',
      '',
    ].join('\n'));

    const result = updateElectronUpdaterMetadataForArtifact(dmgPath, root);
    const metadata = parseYaml(fs.readFileSync(path.join(root, 'latest-mac.yml'), 'utf8'));
    const dmg = metadata.files.find((entry) => entry.url === dmgName);
    const zip = metadata.files.find((entry) => entry.url === zipName);
    assert.equal(dmg.sha512, crypto.createHash('sha512').update(fs.readFileSync(dmgPath)).digest('base64'));
    assert.equal(dmg.size, fs.statSync(dmgPath).size);
    assert.deepEqual(zip, { url: zipName, sha512: 'zip-sha', size: 12 });
    assert.equal(metadata.path, zipName);
    assert.deepEqual(result.metadata_files, ['latest-mac.yml']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed when updater metadata does not reference the finalized DMG', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-updater-missing-dmg-'));
  try {
    const dmgPath = path.join(root, 'One-Person-Lab-26.7.25-mac-arm64.dmg');
    fs.writeFileSync(dmgPath, 'dmg\n');
    fs.writeFileSync(path.join(root, 'latest-mac.yml'), 'version: 26.7.25\nfiles: []\n');
    assert.throws(
      () => updateElectronUpdaterMetadataForArtifact(dmgPath, root),
      /does not reference One-Person-Lab-26\.7\.25-mac-arm64\.dmg/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
