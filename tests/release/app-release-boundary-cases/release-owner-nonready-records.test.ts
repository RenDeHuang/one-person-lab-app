import { assert, fs, path, test, appRoot } from './helpers.ts';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

test('release owner typed nonready records preserve the authority boundary', () => {
  const ownerContract = readJson('contracts/app-release-channel.json')
    .operator_evidence_bundle.release_owner_verdict;
  const ownerReceipt = readJson('docs/delivery/release/records/v26.6.12-release-owner-receipt.json');
  const ownerBlocker = readJson('docs/delivery/release/records/v26.6.12-release-owner-verdict-pending.json');
  const receiptRef = 'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.6.12/receipt-20260612-owner-verdict';
  const blockerRef = 'typed_blocker_ref://one-person-lab-app/release-owner/v26.6.12/verdict-pending';

  assert.deepEqual([
    ownerReceipt.status,
    ownerReceipt.release_owner_receipt_ref,
    ownerReceipt.release_candidate_promote_ready,
  ], ['release_owner_receipt_recorded', receiptRef, true]);
  assert.deepEqual([
    ownerBlocker.schema,
    ownerBlocker.status,
    ownerBlocker.release_owner_receipt_ref,
    ownerBlocker.release_owner_acceptance_recorded,
    ownerBlocker.stable_latest_recorded,
    ownerBlocker.release_owner_typed_blocker_ref,
    ownerBlocker.typed_blocker_ref,
  ], [
    'opl_app_release_owner_typed_blocker_record.v1',
    ownerContract.typed_blocker_status,
    receiptRef,
    true,
    true,
    blockerRef,
    blockerRef,
  ]);
  for (const record of [ownerReceipt, ownerBlocker]) {
    for (const field of ['release_ready_claim', 'stable_latest_promotion_claim', 'family_production_ready_claim']) {
      assert.equal(record[field], false, `${field} must remain false`);
    }
  }
  assert.equal(ownerBlocker.can_close_opl_app_release_user_path, false);
  for (const field of [
    'can_claim_app_release_ready_from_evidence',
    'can_claim_stable_latest_from_evidence',
    'can_claim_family_production_ready',
  ]) assert.equal(ownerBlocker.authority_boundary[field], false, `${field} must remain false`);
  assert.match(ownerBlocker.reason, /receipt and owner acceptance are recorded/);
  assert.match(ownerBlocker.next_owner_action, /non-ready verdict/);
});
