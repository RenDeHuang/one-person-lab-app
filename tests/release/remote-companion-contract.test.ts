import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRemoteCompanionContract } from '../../scripts/validate-active-shell/remote-companion-validator.ts';

const readPolicy = () =>
  JSON.parse(fs.readFileSync('contracts/app-remote-companion.json', 'utf8')) as Record<string, any>;

test('OPL Link selects Ably plus Workers and D1 while keeping implementation gaps explicit', () => {
  const policy = readPolicy();
  assert.doesNotThrow(() => validateRemoteCompanionContract(policy));

  assert.equal(policy.transport.provider_strategy.selected_provider, 'ably');
  assert.equal(policy.transport.provider_strategy.selection_gate.status, 'not_run');
  assert.equal(policy.transport.provider_strategy.conditional_alternative, 'tencent_cloud_im');
  assert.equal(policy.transport.provider_strategy.conditional_alternative_status, 'not_selected');
  assert.equal(policy.transport.provider_strategy.runtime_dual_write, false);
  assert.equal(policy.transport.provider_strategy.automatic_provider_fallback, false);

  assert.deepEqual(policy.service_boundary.target_runtime, {
    compute: 'cloudflare_workers_free',
    persistence: 'cloudflare_d1_free',
    request_model: 'serverless_request_driven_control_plane',
    always_on_server_required: false,
    user_managed_server_required: false,
    local_resident_service_required: false,
    cloudflare_tunnel_required: false,
    periodic_manual_renewal_required: false,
  });
  assert.equal(policy.optional_cloud_host.runtime_dependency_for_opl_link, false);
  assert.equal(policy.transport.public_desktop_address_required, false);
  assert.equal(policy.transport.usage_guardrails.fixed_pair_limit_in_ios_or_testflight, false);
  assert.equal(policy.distribution_and_access.testflight_is_capacity_or_entitlement_authority, false);

  assert.equal(policy.pairing.manual_code_resolution.response_fields.includes('service_url'), true);
  assert.equal(policy.pairing.qr_payload.includes('service_url'), true);
  assert.equal(policy.pairing.device_lifecycle.provider_user_account_deletion_required, false);
  assert.equal(policy.notifications.background_transport, 'ably_push_to_apns_generic_signal');

  assert.equal(policy.implementation_status.legacy_tencent_ios_adapter_source_present, true);
  assert.equal(policy.implementation_status.legacy_stack_conforms_to_selected_architecture, false);
  assert.equal(policy.implementation_status.ably_adapter_source_implemented, false);
  assert.equal(policy.implementation_status.cloudflare_worker_source_implemented, false);
  assert.equal(policy.implementation_status.testflight_carrier_build_evidence_exists, true);
  assert.equal(policy.implementation_status.testflight_product_qualification_completed, false);
  assert.equal(policy.implementation_status.release_ready_claim_allowed, false);
  assert.equal(
    policy.delivery_governance.process_correction.product_acceptance_value_of_existing_testflight_build,
    'none_for_opl_link_usability; carrier_build_and_signing_evidence_only',
  );
});

test('OPL Link validator rejects old target defaults and premature release claims', () => {
  const policy = readPolicy();
  const mutations = [
    (candidate: Record<string, any>) => { candidate.transport.provider_strategy.selected_provider = 'tencent_cloud_im'; },
    (candidate: Record<string, any>) => { candidate.transport.provider_strategy.conditional_alternative_status = 'active'; },
    (candidate: Record<string, any>) => { candidate.transport.provider_strategy.runtime_dual_write = true; },
    (candidate: Record<string, any>) => { candidate.transport.provider_strategy.automatic_provider_fallback = true; },
    (candidate: Record<string, any>) => { candidate.service_boundary.target_runtime.always_on_server_required = true; },
    (candidate: Record<string, any>) => { candidate.service_boundary.target_runtime.cloudflare_tunnel_required = true; },
    (candidate: Record<string, any>) => { candidate.optional_cloud_host.release_dependency_for_opl_link = true; },
    (candidate: Record<string, any>) => { candidate.transport.authentication.ably_api_key_in_client = true; },
    (candidate: Record<string, any>) => { candidate.transport.message_policy.provider_history_used_for_business_reads = true; },
    (candidate: Record<string, any>) => { candidate.transport.usage_guardrails.fixed_pair_limit_in_ios_or_testflight = 40; },
    (candidate: Record<string, any>) => {
      candidate.distribution_and_access.testflight_is_capacity_or_entitlement_authority = true;
    },
    (candidate: Record<string, any>) => {
      candidate.pairing.control_plane_persistence.allowed.push('plaintext_qr_claim_secret');
    },
    (candidate: Record<string, any>) => {
      candidate.pairing.admission_lifecycle.client_must_not_allocate_reclaim_or_infer_capacity = false;
    },
    (candidate: Record<string, any>) => { candidate.implementation_status.legacy_stack_conforms_to_selected_architecture = true; },
    (candidate: Record<string, any>) => { candidate.implementation_status.release_ready_claim_allowed = true; },
    (candidate: Record<string, any>) => { candidate.delivery_governance.process_correction.must_not_repeat = false; },
  ];

  for (const mutate of mutations) {
    const candidate = structuredClone(policy);
    mutate(candidate);
    assert.throws(() => validateRemoteCompanionContract(candidate));
  }
});
