import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildPromotionCheckpointAuthorization,
  buildReleaseLatestMutationHead,
  buildReleaseMutationAcceptanceReceipt,
  buildReleaseMutationBrokerLedgerFound,
  buildReleaseMutationBrokerLedgerLookup,
  buildReleaseMutationBrokerLedgerNotFound,
  buildReleaseMutationBrokerLedgerOutcomeUnknown,
  buildReleaseMutationBrokerLedgerRecord,
  buildReleaseMutationBrokerLedgerSnapshot,
  buildReleaseMutationPreApiFence,
  buildReleaseMutationVersionAggregate,
  decideReleaseMutationBrokerAdmission,
  externalReleaseMutationBroker,
  externalReleaseMutationBrokerLedgerLookup,
  validateHistoricalReleaseMutationAcceptanceReceipt,
  validateReleaseMutationAcceptanceReceipt,
  validateReleaseMutationBrokerLedgerLookupResult,
  validateReleaseMutationBrokerRequest,
  validateReleaseMutationPreApiFence,
} from '../../scripts/release-mutation-broker.ts';
import {
  readReleaseBrokerAuthority,
  validateReleaseBrokerAuthority,
} from '../../scripts/release-broker-authority.ts';

const digest = (value: string) => `sha256:${value.repeat(64)}`;

test('historical promotion checkpoint projection remains deterministic and non-authoritative', () => {
  const first = buildPromotionCheckpointAuthorization({
    mutation: 'promotion_dispatch',
    attempt_id: digest('1'),
    mutation_payload: { resume_from_checkpoint: 'release_public_nonlatest' },
  });
  assert.equal(first?.last_verified_checkpoint, null);
  assert.equal(first?.first_unverified_checkpoint, 'release_public_nonlatest');
  assert.deepEqual(first?.receipt_digests, []);
  assert.match(first?.bundle_sha256 ?? '', /^sha256:[0-9a-f]{64}$/);

  const receipt = { checkpoint: 'release_public_nonlatest', receipt_sha256: digest('2') };
  const sequential = buildPromotionCheckpointAuthorization({
    mutation: 'promotion_dispatch',
    attempt_id: digest('3'),
    mutation_payload: {
      resume_from_checkpoint: 'distribution_synced',
      promotion_checkpoint_receipts_json: JSON.stringify([receipt]),
    },
  });
  assert.deepEqual(sequential?.receipt_digests, [receipt]);
});

test('canonical legacy broker authority is contract-readable but cannot admit mutation or lookup', () => {
  const authority = readReleaseBrokerAuthority();
  assert.deepEqual(validateReleaseBrokerAuthority(authority, { capability: 'contract_read' }), []);
  assert.ok(validateReleaseBrokerAuthority(authority, { capability: 'mutation_submit', requireCredentialReceipt: false }).length > 0);
  assert.ok(validateReleaseBrokerAuthority(authority, { capability: 'ledger_lookup', requireCredentialReceipt: false }).length > 0);
  assert.equal(authority.lifecycle, 'retired_historical_receipt_verification_only');
  assert.equal(authority.live_mutation_authority, false);
  assert.equal(authority.new_admission_allowed, false);
});

test('every legacy broker constructor, signer, admission decision, submit, and lookup fails closed', () => {
  const retired = [
    buildReleaseMutationPreApiFence,
    buildReleaseMutationAcceptanceReceipt,
    buildReleaseMutationBrokerLedgerRecord,
    buildReleaseMutationVersionAggregate,
    buildReleaseLatestMutationHead,
    buildReleaseMutationBrokerLedgerNotFound,
    buildReleaseMutationBrokerLedgerFound,
    buildReleaseMutationBrokerLedgerOutcomeUnknown,
    decideReleaseMutationBrokerAdmission,
    buildReleaseMutationBrokerLedgerSnapshot,
    externalReleaseMutationBroker,
    externalReleaseMutationBrokerLedgerLookup,
  ];
  for (const api of retired) {
    assert.throws(
      () => api(),
      (error: unknown) => {
        const receipt = JSON.parse((error as Error).message);
        assert.equal(receipt.schema, 'opl_app_legacy_release_entry_retired.v1');
        assert.equal(receipt.status, 'retired_fail_closed');
        assert.equal(receipt.mutation_authorized, false);
        assert.equal(receipt.external_lookup_authorized, false);
        return true;
      },
    );
  }
});

test('historical validators remain fail-safe for untrusted receipt bytes', () => {
  const authority = readReleaseBrokerAuthority();
  const lookup = buildReleaseMutationBrokerLedgerLookup({
    repository: 'gaofeng21cn/one-person-lab-app',
    version: '26.7.18',
    stableSessionId: digest('1'),
    releaseCohortRef: digest('2'),
    attemptId: digest('3'),
    mutationPayloadSha256: digest('4'),
    requestSha256: digest('5'),
    challenge: '6'.repeat(32),
  });
  assert.equal(lookup.challenge, '6'.repeat(32));
  assert.doesNotThrow(() => validateReleaseMutationBrokerRequest({}));
  assert.match(validateReleaseMutationBrokerRequest({}).join('; '), /cannot authorize a new mutation/);
  assert.doesNotThrow(() => validateReleaseMutationPreApiFence({}, {} as never, authority));
  assert.doesNotThrow(() => validateHistoricalReleaseMutationAcceptanceReceipt({}, {} as never, authority));
  assert.doesNotThrow(() => validateReleaseMutationBrokerLedgerLookupResult({}, lookup, authority));
  assert.match(validateReleaseMutationAcceptanceReceipt().join('; '), /cannot authorize a new mutation/);
});

test('legacy broker source contains no external process execution or signing primitive', () => {
  const source = fs.readFileSync('scripts/release-mutation-broker.ts', 'utf8');
  assert.doesNotMatch(source, /spawnSync|\/dev\/fd\/3|crypto\.sign|operation:\s*'submit'/);
  assert.match(source, /externalReleaseMutationBroker\.submit/);
  assert.match(source, /externalReleaseMutationBroker\.lookup/);
});
