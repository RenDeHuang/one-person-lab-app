import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stringify as stringifyYaml } from 'yaml';

import {
  validateWindowsAuthenticodeReceipt,
  validateWindowsUpdaterAssets,
} from '../../scripts/validate-windows-updater-assets.ts';

const releaseVersion = '26.7.31-r1';
const updaterVersion = '26.7.3101';
const installerName = `One-Person-Lab-${releaseVersion}-win-x64.exe`;

function fixture(t: test.TestContext): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-windows-updater-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const installer = Buffer.from('exact Windows installer bytes\n');
  const sha512 = crypto.createHash('sha512').update(installer).digest('base64');
  fs.writeFileSync(path.join(root, installerName), installer);
  fs.writeFileSync(path.join(root, `${installerName}.blockmap`), 'binary blockmap bytes\n');
  fs.writeFileSync(path.join(root, 'latest.yml'), stringifyYaml({
    version: updaterVersion,
    files: [{ url: installerName, sha512, size: installer.length }],
    path: installerName,
    sha512,
    releaseDate: '2026-07-31T00:00:00.000Z',
  }));
  return root;
}

function writeAuthenticodeReceipt(root: string): string {
  const installerPath = path.join(root, installerName);
  const receiptPath = path.join(root, 'opl-windows-authenticode-receipt.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify({
    schema: 'opl_windows_authenticode_receipt.v1',
    status: 'passed',
    platform: 'windows-x64',
    installer: {
      name: installerName,
      size_bytes: fs.statSync(installerPath).size,
      sha256: `sha256:${crypto.createHash('sha256').update(fs.readFileSync(installerPath)).digest('hex')}`,
    },
    signature: {
      status: 'Valid',
      signature_type: 'Authenticode',
      signer_subject: 'CN=One Person Lab',
      signer_thumbprint: '1'.repeat(40),
      signer_not_before: '2026-01-01T00:00:00.000Z',
      signer_not_after: '2027-01-01T00:00:00.000Z',
      timestamp_verified: true,
      timestamper_subject: 'CN=Trusted Timestamp Authority',
      timestamper_thumbprint: '2'.repeat(40),
    },
    verification_tool: 'Get-AuthenticodeSignature',
  }, null, 2)}\n`);
  return receiptPath;
}

test('validates exact Windows updater metadata, installer bytes, and blockmap receipt', (t) => {
  const root = fixture(t);
  const output = path.join(root, 'opl-windows-updater-assets.json');
  const receipt = validateWindowsUpdaterAssets({
    artifactDir: root,
    releaseVersion,
    updaterVersion,
    outputPath: output,
  });
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.assets.installer.name, installerName);
  assert.equal(receipt.assets.blockmap.name, `${installerName}.blockmap`);
  assert.equal(receipt.assets.metadata.name, 'latest.yml');
  assert.equal(receipt.updater_version, updaterVersion);
  assert.deepEqual(receipt.code_signing, {
    policy: 'optional_nonblocking',
    status: 'unsigned',
    authenticode_receipt: null,
    required_for_publication: false,
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), receipt);
});

test('records valid timestamped Authenticode as optional exact-byte certification', (t) => {
  const root = fixture(t);
  const receipt = validateWindowsUpdaterAssets({
    artifactDir: root,
    releaseVersion,
    updaterVersion,
    authenticodeReceiptPath: writeAuthenticodeReceipt(root),
  });
  assert.deepEqual(receipt.code_signing, {
    policy: 'optional_nonblocking',
    status: 'valid_timestamped_authenticode',
    authenticode_receipt: 'opl-windows-authenticode-receipt.json',
    required_for_publication: false,
  });
});

test('rejects metadata with a different machine updater version', (t) => {
  const root = fixture(t);
  const metadataPath = path.join(root, 'latest.yml');
  fs.writeFileSync(metadataPath, fs.readFileSync(metadataPath, 'utf8').replace(updaterVersion, '26.7.3100'));
  assert.throws(
    () => validateWindowsUpdaterAssets({ artifactDir: root, releaseVersion, updaterVersion }),
    /latest\.yml version must equal/,
  );
});

test('rejects metadata whose EXE size or SHA-512 does not bind the exact bytes', (t) => {
  const root = fixture(t);
  fs.appendFileSync(path.join(root, installerName), 'drift');
  assert.throws(
    () => validateWindowsUpdaterAssets({ artifactDir: root, releaseVersion, updaterVersion }),
    /does not match the exact EXE/,
  );
});

test('rejects missing, empty, or ambiguous updater sidecars', (t) => {
  const missing = fixture(t);
  fs.rmSync(path.join(missing, `${installerName}.blockmap`));
  assert.throws(
    () => validateWindowsUpdaterAssets({ artifactDir: missing, releaseVersion, updaterVersion }),
    /blockmap set/,
  );

  const empty = fixture(t);
  fs.writeFileSync(path.join(empty, `${installerName}.blockmap`), '');
  assert.throws(
    () => validateWindowsUpdaterAssets({ artifactDir: empty, releaseVersion, updaterVersion }),
    /blockmap must be one non-empty regular file/,
  );

  const ambiguous = fixture(t);
  fs.writeFileSync(path.join(ambiguous, 'latest-x64.yml'), 'version: invalid\n');
  assert.throws(
    () => validateWindowsUpdaterAssets({ artifactDir: ambiguous, releaseVersion, updaterVersion }),
    /metadata set must be exactly latest\.yml/,
  );
});

test('validates a timestamped Authenticode receipt against the exact installer bytes', (t) => {
  const root = fixture(t);
  const receipt = validateWindowsAuthenticodeReceipt({
    receiptPath: writeAuthenticodeReceipt(root),
    installerPath: path.join(root, installerName),
  });
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.signature.timestamp_verified, true);
});

test('rejects unsigned, untimestamped, or byte-drifted Authenticode receipts', (t) => {
  const unsigned = fixture(t);
  const unsignedReceipt = writeAuthenticodeReceipt(unsigned);
  const unsignedJson = JSON.parse(fs.readFileSync(unsignedReceipt, 'utf8'));
  unsignedJson.signature.status = 'NotSigned';
  fs.writeFileSync(unsignedReceipt, `${JSON.stringify(unsignedJson)}\n`);
  assert.throws(
    () => validateWindowsAuthenticodeReceipt({
      receiptPath: unsignedReceipt,
      installerPath: path.join(unsigned, installerName),
    }),
    /valid timestamped Authenticode signature/,
  );

  const untimestamped = fixture(t);
  const untimestampedReceipt = writeAuthenticodeReceipt(untimestamped);
  const untimestampedJson = JSON.parse(fs.readFileSync(untimestampedReceipt, 'utf8'));
  untimestampedJson.signature.timestamp_verified = false;
  fs.writeFileSync(untimestampedReceipt, `${JSON.stringify(untimestampedJson)}\n`);
  assert.throws(
    () => validateWindowsAuthenticodeReceipt({
      receiptPath: untimestampedReceipt,
      installerPath: path.join(untimestamped, installerName),
    }),
    /valid timestamped Authenticode signature/,
  );

  const drifted = fixture(t);
  const driftedReceipt = writeAuthenticodeReceipt(drifted);
  fs.appendFileSync(path.join(drifted, installerName), 'drift');
  assert.throws(
    () => validateWindowsAuthenticodeReceipt({
      receiptPath: driftedReceipt,
      installerPath: path.join(drifted, installerName),
    }),
    /does not bind the exact installer bytes/,
  );
});
