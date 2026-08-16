import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRemoteCompanionContract } from '../../scripts/validate-active-shell/remote-companion-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8')) as Record<string, any>;

test('OPL Link keeps the iOS product, Tencent MVP, capacity, and authority boundaries', () => {
  const policy = readJson('contracts/app-remote-companion.json');
  assert.doesNotThrow(() => validateRemoteCompanionContract(policy));
  assert.equal(policy.product_identity.app_store_name, 'OPL Link');
  assert.equal(policy.product_identity.home_screen_name, 'OPL Link');
  assert.equal(policy.transport.provider_strategy.active_provider, 'tencent_cloud_im');
  assert.equal(policy.transport.provider_strategy.runtime_dual_write, false);
  assert.equal(policy.transport.public_desktop_address_required, false);
  assert.equal(policy.transport.payload_confidentiality.provider_plaintext_task_content, false);
  assert.equal(policy.transport.usage_guardrails.active_pair_seat_limit, 40);
  assert.equal(policy.pairing.device_lifecycle.mvp_max_active_companion_pairs_per_desktop_installation, 1);
  assert.equal(policy.distribution_and_access.testflight_is_capacity_or_entitlement_authority, false);
  assert.equal(policy.product_identity.local_ios_runtime, false);
});

test('OPL Link validator rejects a second runtime, leaked provider authority, or unsafe seat reclaim', () => {
  const policy = readJson('contracts/app-remote-companion.json');
  const mutations = [
    (candidate: Record<string, any>) => { candidate.product_identity.local_ios_runtime = true; },
    (candidate: Record<string, any>) => { candidate.transport.provider_strategy.runtime_dual_write = true; },
    (candidate: Record<string, any>) => { candidate.transport.provider_strategy.automatic_provider_fallback = true; },
    (candidate: Record<string, any>) => { candidate.transport.provider_secret_embedded_in_client = true; },
    (candidate: Record<string, any>) => { candidate.transport.authentication.tencent_sdkapp_secret_in_client = true; },
    (candidate: Record<string, any>) => {
      candidate.transport.payload_confidentiality.provider_plaintext_task_content = true;
    },
    (candidate: Record<string, any>) => {
      candidate.transport.message_policy.provider_history_used_for_business_reads = true;
    },
    (candidate: Record<string, any>) => { candidate.transport.usage_guardrails.active_pair_seat_limit = 50; },
    (candidate: Record<string, any>) => {
      candidate.distribution_and_access.testflight_is_capacity_or_entitlement_authority = true;
    },
    (candidate: Record<string, any>) => { candidate.pairing.qr_payload.push('provider_secret_or_api_key'); },
    (candidate: Record<string, any>) => {
      candidate.pairing.broker_persistence.allowed.push('plaintext_qr_claim_secret');
    },
    (candidate: Record<string, any>) => {
      candidate.pairing.capacity_lifecycle.client_must_not_allocate_reclaim_or_infer_seats = false;
    },
    (candidate: Record<string, any>) => {
      candidate.pairing.capacity_lifecycle.seat_release_condition = 'client_reports_logout';
    },
    (candidate: Record<string, any>) => { candidate.action_policy.request_required_fields.push('action_id'); },
    (candidate: Record<string, any>) => { candidate.action_policy.idempotency.offline_command_queue = true; },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(policy);
    mutate(candidate);
    assert.throws(() => validateRemoteCompanionContract(candidate));
  }
});
