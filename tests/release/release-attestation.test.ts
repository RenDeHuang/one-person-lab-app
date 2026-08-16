import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createReleaseAttestation } from '../../scripts/write-release-attestation.ts';
import {
  asset,
  canonicalRepo,
  durablePublicationRecord,
  tag,
} from './framework-release-adapter-deadline-cases/fixtures.ts';

function trustEvidence() {
  const receiptSha = 'a'.repeat(64);
  return {
    notarization: {
      schema: 'opl_apple_notarized_dmg_receipt.v1',
      status: 'passed',
      team_identifier: 'TESTTEAMID',
      notarization: { status: 'Accepted', id: 'notary-id' },
      stapler_validate_status: 'passed',
      dmg_spctl_status: 'passed',
      app_spctl_status: 'passed',
      final_stapled_dmg_sha256: 'b'.repeat(64),
      final_stapled_dmg_size_bytes: 100,
    },
    gatekeeper: {
      schema: 'opl_gatekeeper_launch_policy.v1',
      package_kind: 'app_standard',
      distribution_mode: 'developer_id_notarized',
      team_identifier: 'TESTTEAMID',
      codesign_status: 'passed',
      spctl_status: 'passed',
      dmg_codesign_status: 'passed',
      dmg_spctl_status: 'passed',
      stapler_validate_status: 'passed',
      notarization_status: 'Accepted',
      notarization_receipt_sha256: receiptSha,
      local_authorization_required: false,
      quarantine_removal_required: false,
    },
  };
}

test('unified Standard attestation embeds trust and declares mutable CAS protection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-attestation-'));
  const payload = asset('One-Person-Lab-26.7.21-mac-arm64.dmg', '1');
  const durable = durablePublicationRecord(root, [payload]);
  const publicationRecord = JSON.parse(fs.readFileSync(durable.recordPath, 'utf8'));
  const componentPath = path.join(root, 'opl-app-component-manifest.json');
  fs.writeFileSync(componentPath, '{"surface_kind":"opl_app_component_manifest.v1"}\n');
  const trust = trustEvidence();
  const attestation = createReleaseAttestation({
    publicationRecord,
    gatekeeperPolicy: trust.gatekeeper,
    notarizationReceipt: trust.notarization,
    notarizationReceiptSha256: 'a'.repeat(64),
    componentManifestPath: componentPath,
    bundleDigest: `sha256:${'c'.repeat(64)}`,
  });

  assert.equal(attestation.schema, 'opl_app_release_attestation.v1');
  assert.equal(attestation.release.repository, canonicalRepo);
  assert.equal(attestation.release.tag, tag);
  assert.equal(attestation.protection.github_native_immutable, false);
  assert.equal(attestation.protection.retroactive_lock_claimed, false);
  assert.equal('repository_immutability_window' in attestation, false);
  assert.equal(attestation.protection.full_binding, 'full_manifest_binds_this_attestation_and_exact_full_assets');
  assert.deepEqual(attestation.superseded_public_assets, [
    'stable-operation-publication-record.json',
    'standard-apple-notarization-receipt.json',
    'standard-gatekeeper-launch-policy.json',
  ]);
});

test('unified Standard attestation rejects a notarization receipt byte-chain mismatch', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-attestation-mismatch-'));
  const payload = asset('One-Person-Lab-26.7.21-mac-arm64.dmg', '1');
  const durable = durablePublicationRecord(root, [payload]);
  const componentPath = path.join(root, 'opl-app-component-manifest.json');
  fs.writeFileSync(componentPath, '{"surface_kind":"opl_app_component_manifest.v1"}\n');
  const trust = trustEvidence();
  assert.throws(() => createReleaseAttestation({
    publicationRecord: JSON.parse(fs.readFileSync(durable.recordPath, 'utf8')),
    gatekeeperPolicy: trust.gatekeeper,
    notarizationReceipt: trust.notarization,
    notarizationReceiptSha256: '0'.repeat(64),
    componentManifestPath: componentPath,
    bundleDigest: `sha256:${'c'.repeat(64)}`,
  }), /exact notarization receipt bytes/);
});
