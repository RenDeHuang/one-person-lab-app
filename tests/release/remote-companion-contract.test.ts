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
  assert.equal(policy.transport.payload_confidentiality.provider_plaintext_conversation_content, false);
  assert.equal(policy.surface_boundary.conversation_model.primary_object, 'canonical_codex_conversation');
  assert.ok(
    policy.surface_boundary.primary_user_outcomes.includes(
      'filter_the_currently_loaded_conversation_directory_locally_without_claiming_canonical_search',
    ),
  );
  assert.ok(
    policy.surface_boundary.deferred_outcomes.includes(
      'canonical_conversation_search_archive_rename_or_delete_until_desktop_apis_are_admitted',
    ),
  );
  assert.equal(policy.action_policy.wire_action_ids_are_internal_aliases, true);
  assert.equal(policy.transport.usage_guardrails.active_pair_seat_limit, 40);
  assert.equal(policy.pairing.fallback_method, 'paste_full_pairing_payload');
  assert.equal(policy.pairing.short_manual_code, 'deferred_not_implemented');
  assert.deepEqual(policy.pairing.legacy_manual_code, {
    status: 'compatibility_response_only',
    user_fallback: false,
    client_behavior: 'use_claim_secret_from_full_pairing_payload',
  });
  assert.equal(
    policy.transport.authentication.active_credential_policy,
    'existing_desktop_pair_token_or_ios_claim_token_becomes_active_device_credential_after_pair_activation_without_minting_a_second_bearer',
  );
  assert.equal(
    policy.pairing.ios_pending_pairing_persistence.storage,
    'ios_keychain_when_unlocked_this_device_only_until_activation_expiry_or_local_reset',
  );
  assert.deepEqual(policy.pairing.ios_pending_pairing_persistence.clear_on, [
    'active_pair_material_persisted_after_activation',
    'pairing_expiry',
    'failed_claim',
    'terminal_revocation',
  ]);
  assert.ok(policy.pairing.capacity_lifecycle.allocated_states.includes('awaiting_desktop_confirmation'));
  assert.equal(policy.pairing.device_lifecycle.mvp_max_active_companion_pairs_per_desktop_installation, 1);
  assert.equal(policy.distribution_and_access.testflight_is_capacity_or_entitlement_authority, false);
  assert.equal(policy.product_identity.local_ios_runtime, false);
  assert.equal(policy.implementation_status.protocol_source_implemented, true);
  assert.equal(policy.implementation_status.desktop_connector_source_implemented, true);
  assert.equal(policy.implementation_status.ios_source_implemented, true);
  assert.equal(policy.implementation_status.ios_conversation_surface_implemented, true);
  assert.equal(policy.implementation_status.desktop_conversation_projection_implemented, true);
  assert.equal(policy.implementation_status.cloud_broker_source_implemented, true);
  assert.equal(policy.implementation_status.tencent_cloud_application_configured, false);
  assert.equal(policy.implementation_status.release_ready_claim_allowed, false);
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
      candidate.transport.payload_confidentiality.provider_plaintext_conversation_content = true;
    },
    (candidate: Record<string, any>) => {
      candidate.transport.message_policy.provider_history_used_for_business_reads = true;
    },
    (candidate: Record<string, any>) => { candidate.transport.usage_guardrails.active_pair_seat_limit = 50; },
    (candidate: Record<string, any>) => {
      candidate.distribution_and_access.testflight_is_capacity_or_entitlement_authority = true;
    },
    (candidate: Record<string, any>) => { candidate.pairing.qr_payload.push('provider_secret_or_api_key'); },
    (candidate: Record<string, any>) => { candidate.pairing.fallback_method = 'short_lived_manual_pairing_code'; },
    (candidate: Record<string, any>) => { candidate.pairing.legacy_manual_code.user_fallback = true; },
    (candidate: Record<string, any>) => { candidate.transport.authentication.active_credential_policy = 'mint_a_second_bearer'; },
    (candidate: Record<string, any>) => { candidate.pairing.ios_pending_pairing_persistence.material = []; },
    (candidate: Record<string, any>) => { candidate.pairing.ios_pending_pairing_persistence.clear_on = ['activation']; },
    (candidate: Record<string, any>) => {
      candidate.pairing.broker_persistence.allowed.push('plaintext_qr_claim_secret');
    },
    (candidate: Record<string, any>) => {
      candidate.pairing.capacity_lifecycle.client_must_not_allocate_reclaim_or_infer_seats = false;
    },
    (candidate: Record<string, any>) => {
      candidate.pairing.capacity_lifecycle.allocated_states = ['reserved', 'provisioning', 'active'];
    },
    (candidate: Record<string, any>) => {
      candidate.pairing.capacity_lifecycle.seat_release_condition = 'client_reports_logout';
    },
    (candidate: Record<string, any>) => { candidate.action_policy.request_required_fields.push('action_id'); },
    (candidate: Record<string, any>) => { candidate.action_policy.idempotency.offline_command_queue = true; },
    (candidate: Record<string, any>) => { candidate.implementation_status.ios_source_implemented = false; },
    (candidate: Record<string, any>) => { candidate.implementation_status.release_ready_claim_allowed = true; },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(policy);
    mutate(candidate);
    assert.throws(() => validateRemoteCompanionContract(candidate));
  }
});
