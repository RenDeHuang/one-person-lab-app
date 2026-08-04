import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  canonicalJson,
  createStableOptionalExistingBaseAuthority,
  decodeStableOptionalExistingBaseCarrier,
  encodeStableOptionalExistingBaseCarrier,
  stableOptionalExistingBaseOperationId,
  validateStableOptionalExistingBaseAuthority,
} from '../../scripts/stable-optional-existing-base-control.ts';

const source = {
  run_id: '30897710301',
  receipt_digest: `sha256:${'1'.repeat(64)}`,
  app_sha: 'a'.repeat(40), app_tree: 'b'.repeat(40),
  shell_sha: 'c'.repeat(40), shell_tree: 'd'.repeat(40),
  framework_sha: 'e'.repeat(40), framework_tree: 'f'.repeat(40),
};
const base = {
  release_id: 364492386,
  version: '26.8.4', tag: 'v26.8.4', target_commitish: '9'.repeat(40),
  updated_at: '2026-08-03T21:00:56Z', mutable: true, latest_tag: 'v26.8.4',
  asset_inventory_digest: `sha256:${'2'.repeat(64)}`,
};
const criticalPaths = [
  '.github/workflows/release-stable-optional-existing-base.yml',
  '.github/workflows/build-manual.yml',
  'contracts/app-release-channel.json',
  'scripts/stable-optional-existing-base-control.ts',
];
const criticalBlobs = Object.fromEntries(criticalPaths.map((file, index) => [file, `sha256:${String(index + 3).repeat(64)}`]));
const objective = 'fg66-existing-base-v26.8.4-linux-windows-20260804';

function authority() {
  const operationId = stableOptionalExistingBaseOperationId({ objectiveFingerprint: objective, sourceQualification: source, baseRelease: base, criticalBlobs });
  const preNonceGuard = { schema: 'opl_release_dispatch_guard.v1', phase: 'pre_nonce', status: 'passed', dispatch_allowed: true, operation_id: operationId, owner_run_match_count: 0, nonce_consumed: false };
  return createStableOptionalExistingBaseAuthority({
    authorityId: 'authority-optional-existing-base-01', operationId, issuer: 'gaofeng21cn',
    issuedAt: '2026-08-04T10:00:00Z', expiresAt: '2026-08-04T12:00:00Z', objectiveFingerprint: objective,
    nonce: 'ab'.repeat(16), sourceQualification: source, baseRelease: base, criticalBlobs, preNonceGuard,
  });
}

test('existing-base optional authority freezes exact v26.8.4 base, source qualification, and two platforms', () => {
  const actual = authority();
  assert.equal(actual.operation, 'stable_optional_follower_existing_base');
  assert.deepEqual(actual.platforms, ['linux-x64', 'windows-x64']);
  assert.equal(actual.base_release.tag, 'v26.8.4');
  assert.equal(actual.source_qualification.app_sha, source.app_sha);
  assert.deepEqual(actual.mutation_scope, { standard_release: false, full_release: false, base_release: false, latest: false, adjunct_release: true });
  assert.equal(validateStableOptionalExistingBaseAuthority(actual).authority_digest, actual.authority_digest);
});

test('carrier accepts only pure canonical unpadded base64url, never the encode wrapper JSON', () => {
  const actual = authority();
  const carrier = encodeStableOptionalExistingBaseCarrier(actual);
  assert.match(carrier, /^[A-Za-z0-9_-]+$/);
  assert.equal(decodeStableOptionalExistingBaseCarrier({ carrier, authorityDigest: actual.authority_digest, authorityId: actual.authority_id }).operation_id, actual.operation_id);
  const wrapper = JSON.stringify({ status: 'encoded', authority_id: actual.authority_id, authority_digest: actual.authority_digest, authority_carrier: carrier });
  assert.throws(() => decodeStableOptionalExistingBaseCarrier({ carrier: wrapper, authorityDigest: actual.authority_digest, authorityId: actual.authority_id }), /unpadded canonical base64url/);
  const nonCanonical = Buffer.from(JSON.stringify(actual), 'utf8').toString('base64url');
  assert.notEqual(nonCanonical, carrier);
  assert.throws(() => decodeStableOptionalExistingBaseCarrier({ carrier: nonCanonical, authorityDigest: actual.authority_digest, authorityId: actual.authority_id }), /canonical authority JSON bytes/);
});

test('base target, asset inventory, source receipt, and critical bytes are digest-bound', () => {
  for (const mutate of [
    (item: any) => { item.base_release.target_commitish = '8'.repeat(40); },
    (item: any) => { item.base_release.asset_inventory_digest = `sha256:${'0'.repeat(64)}`; },
    (item: any) => { item.source_qualification.receipt_digest = `sha256:${'0'.repeat(64)}`; },
    (item: any) => { item.critical_blobs[criticalPaths[0]] = `sha256:${'0'.repeat(64)}`; },
  ]) {
    const changed = structuredClone(authority());
    mutate(changed);
    assert.throws(() => validateStableOptionalExistingBaseAuthority(changed), /operation_id|digest binding/);
  }
});

test('authority digest is the canonical JSON digest without its digest field', () => {
  const actual = authority();
  const { authority_digest: _ignored, ...core } = actual;
  const expected = `sha256:${crypto.createHash('sha256').update(canonicalJson(core)).digest('hex')}`;
  assert.equal(actual.authority_digest, expected);
});
