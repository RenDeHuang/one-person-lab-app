import {
  assert,
  fs,
  path,
  test,
  appRoot,
} from './helpers.ts';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

test('v26.6.12 release owner typed blocker records receipt without release-ready or production-ready claims', () => {
  const releaseContract = readJson('contracts/app-release-channel.json');
  const ownerContract = releaseContract.operator_evidence_bundle.release_owner_verdict;
  const ownerBlocker = readJson('docs/release/records/v26.6.12-release-owner-verdict-pending.json');
  const ownerReceipt = readJson('docs/release/records/v26.6.12-release-owner-receipt.json');
  const receiptRef = 'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.6.12/receipt-20260612-owner-verdict';
  const typedBlockerRef = 'typed_blocker_ref://one-person-lab-app/release-owner/v26.6.12/verdict-pending';

  assert.equal(ownerReceipt.status, 'release_owner_receipt_recorded');
  assert.equal(ownerReceipt.release_owner_receipt_ref, receiptRef);
  assert.equal(ownerReceipt.release_candidate_promote_ready, true);
  assert.equal(ownerReceipt.release_ready_claim, false);
  assert.equal(ownerReceipt.stable_latest_promotion_claim, false);
  assert.equal(ownerReceipt.family_production_ready_claim, false);

  assert.equal(ownerBlocker.schema, 'opl_app_release_owner_typed_blocker_record.v1');
  assert.equal(ownerBlocker.status, ownerContract.typed_blocker_status);
  assert.equal(ownerBlocker.status, 'release_owner_typed_blocker_required');
  assert.equal(ownerBlocker.release_owner_receipt_ref, receiptRef);
  assert.equal(ownerBlocker.release_owner_acceptance_recorded, true);
  assert.equal(ownerBlocker.stable_latest_recorded, true);
  assert.equal(ownerBlocker.release_owner_typed_blocker_ref, typedBlockerRef);
  assert.equal(ownerBlocker.typed_blocker_ref, typedBlockerRef);
  assert.equal(ownerBlocker.release_ready_claim, false);
  assert.equal(ownerBlocker.stable_latest_promotion_claim, false);
  assert.equal(ownerBlocker.family_production_ready_claim, false);
  assert.equal(ownerBlocker.can_close_opl_app_release_user_path, false);
  assert.equal(ownerBlocker.authority_boundary.can_claim_app_release_ready_from_evidence, false);
  assert.equal(ownerBlocker.authority_boundary.can_claim_stable_latest_from_evidence, false);
  assert.equal(ownerBlocker.authority_boundary.can_claim_family_production_ready, false);
  assert.match(ownerBlocker.reason, /receipt and owner acceptance are recorded/);
  assert.match(ownerBlocker.next_owner_action, /non-ready verdict/);
});
