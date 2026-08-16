import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';

const requiredActions = [
  'canonical_task.list',
  'canonical_task.read',
  'canonical_task.refresh',
  'canonical_task.start',
  'canonical_task.send_text',
  'canonical_turn.stop',
  'canonical_approval.respond',
  'pair.revoke',
];

const forbiddenActions = [
  'shell.exec',
  'arbitrary_file.read',
  'arbitrary_file.write',
  'provider.update',
  'model.update',
  'permission_policy.update',
  'package.install',
  'package.remove',
  'cloud_workspace.create',
  'cloud_workspace.migrate',
];

export function validateRemoteCompanionContract(policy: Record<string, any>): void {
  if (
    policy?.schema !== 'opl_app_remote_companion.v1' ||
    policy.owner !== 'one-person-lab-app' ||
    policy.state !== 'approved_product_plan_source_not_implemented'
  ) {
    throw new Error('Remote companion contract identity or implementation state is invalid');
  }

  const identity = policy.product_identity;
  assertDeepEqualJson(
    {
      app_store_name: identity?.app_store_name,
      home_screen_name: identity?.home_screen_name,
      internal_surface_id: identity?.internal_surface_id,
      product_role: identity?.product_role,
      local_ios_runtime: identity?.local_ios_runtime,
      local_ios_task_history_authority: identity?.local_ios_task_history_authority,
      local_ios_provider_or_model_authority: identity?.local_ios_provider_or_model_authority,
      local_ios_agent_package_authority: identity?.local_ios_agent_package_authority,
    },
    {
      app_store_name: 'One Person Lab: AI Companion',
      home_screen_name: 'OPL',
      internal_surface_id: 'remote_companion',
      product_role: 'remote_companion_channel_not_a_runtime_or_third_workbench',
      local_ios_runtime: false,
      local_ios_task_history_authority: false,
      local_ios_provider_or_model_authority: false,
      local_ios_agent_package_authority: false,
    },
    'Remote companion product identity',
  );

  const transport = policy.transport;
  if (
    transport?.provider !== 'ably' ||
    transport.selection_status !== 'approved_for_mvp' ||
    transport.public_desktop_address_required !== false ||
    transport.lan_or_vpn_configuration_required !== false ||
    transport.client_api_key_embedded !== false ||
    transport.token_broker_runtime !== 'cloudflare_workers' ||
    transport.pairing_registry !== 'cloudflare_d1'
  ) {
    throw new Error('Remote companion must use outbound Ably transport with Cloudflare token brokering');
  }
  if (
    transport.authentication?.mode !== 'short_lived_token_auth' ||
    transport.authentication.token_ttl_minutes > 15 ||
    transport.authentication.history_capability !== false ||
    transport.authentication.channel_metadata_capability !== false ||
    transport.authentication.stats_capability !== false ||
    transport.authentication.push_admin_capability !== false
  ) {
    throw new Error('Remote companion token authentication must be short-lived and least-privilege');
  }
  assertDeepEqualJson(
    transport.authentication.requested_capabilities,
    {
      ios: {
        'opl:v1:pair:<opaque_pair_id>:command': ['publish'],
        'opl:v1:pair:<opaque_pair_id>:event': ['subscribe'],
        'opl:v1:pair:<opaque_pair_id>:presence': ['presence', 'subscribe'],
      },
      desktop: {
        'opl:v1:pair:<opaque_pair_id>:command': ['subscribe'],
        'opl:v1:pair:<opaque_pair_id>:event': ['publish'],
        'opl:v1:pair:<opaque_pair_id>:presence': ['presence', 'subscribe'],
      },
      ios_notifications_optional: {
        'opl:v1:pair:<opaque_pair_id>:event': ['push-subscribe'],
      },
    },
    'Remote companion directional capabilities',
  );
  if (
    transport.channel_policy?.namespace !== 'opl:v1:pair:<opaque_pair_id>' ||
    transport.channel_policy.ios_command_channel !== 'opl:v1:pair:<opaque_pair_id>:command' ||
    transport.channel_policy.desktop_event_channel !== 'opl:v1:pair:<opaque_pair_id>:event' ||
    transport.channel_policy.presence_channel !== 'opl:v1:pair:<opaque_pair_id>:presence' ||
    transport.channel_policy.wildcard_segments_use_ably_colon_delimiter !== true ||
    transport.channel_policy.client_token_wildcard_capability !== false ||
    transport.channel_policy.directional_publish_roles_enforced !== true ||
    transport.channel_policy.ids_must_be_opaque !== true ||
    transport.channel_policy.history !== 'disabled_for_business_reads' ||
    transport.channel_policy.cloud_queueing_of_commands !== false ||
    transport.payload_confidentiality?.required !== true ||
    transport.payload_confidentiality.ably_plaintext_task_content !== false ||
    transport.payload_confidentiality.cloud_plaintext_task_content !== false
  ) {
    throw new Error('Remote companion transport must keep task content encrypted and cloud history disabled');
  }
  if (
    transport.payload_confidentiality?.scheme !==
      'x25519_key_agreement_hkdf_sha256_two_directional_aes_256_gcm_keys' ||
    transport.payload_confidentiality?.aead_associated_data !==
      'protocol_version_pair_id_device_id_key_epoch_and_channel_direction' ||
    transport.payload_confidentiality?.nonce_policy !==
      'cryptographically_random_96_bit_nonce_with_duplicate_rejection_per_directional_key' ||
    transport.payload_confidentiality?.replay_protection !==
      'pair_key_epoch_plus_per_sender_monotonic_sequence_and_request_id'
  ) {
    throw new Error('Remote companion encryption must separate directions and prevent nonce or sequence reuse');
  }

  if (
    policy.pairing?.device_lifecycle?.revoke_effect !==
      'atomically_mark_pair_revoked_deny_future_tokens_detach_desktop_from_pair_channels_delete_desktop_pair_key_and_require_new_qr_pairing' ||
    policy.pairing?.device_lifecycle?.existing_token_policy !==
      'an_already_issued_token_may_remain_transport_valid_until_its_15_minute_expiry_but_the_desktop_must_no_longer_publish_subscribe_or_execute_for_that_pair_after_terminal_revoke_readback'
  ) {
    throw new Error('Remote companion revocation must terminate desktop application access without overclaiming provider token invalidation');
  }
  assertDeepEqualJson(
    policy.pairing?.qr_payload,
    [
      'broker_route',
      'opaque_pairing_id',
      'one_time_random_256_bit_qr_claim_secret',
      'desktop_pair_specific_public_key',
      'short_lived_pairing_expiry',
    ],
    'Remote companion QR payload',
  );
  if (
    policy.pairing?.qr_payload_must_not_include?.includes('displayed_confirmation_code') ||
    !policy.pairing?.claim_protocol?.includes(
      'desktop_reads_the_claim_and_both_devices_display_the_same_short_authentication_string_derived_from_pairing_id_and_both_public_keys',
    ) ||
    !policy.pairing?.broker_persistence?.allowed?.includes('salted_single_use_claim_secret_or_manual_code_hash') ||
    policy.pairing?.broker_persistence?.allowed?.includes('plaintext_qr_claim_secret')
  ) {
    throw new Error('Remote companion pairing must derive the confirmation string only after both public keys exist');
  }
  if (
    policy.pairing?.manual_code_policy !==
      '12_character_crockford_base32_random_code_server_keyed_hmac_sha256_storage_5_minute_expiry_max_5_attempts_then_atomic_pairing_invalidation'
  ) {
    throw new Error('Remote companion manual pairing must use high-entropy short-lived rate-limited codes');
  }

  assertIncludesAll(policy.action_policy?.mvp_allowed_actions, requiredActions, 'Remote companion allowed actions');
  assertIncludesAll(policy.action_policy?.forbidden_actions, forbiddenActions, 'Remote companion forbidden actions');
  assertDeepEqualJson(
    policy.action_policy?.request_required_fields,
    ['protocol_version', 'pair_id', 'device_id', 'key_epoch', 'nonce', 'encrypted_payload'],
    'Remote companion outer request envelope',
  );
  assertDeepEqualJson(
    policy.action_policy?.encrypted_request_fields,
    [
      'request_id',
      'canonical_thread_id_or_new_task_intent',
      'client_sequence',
      'action_id',
      'action_payload',
    ],
    'Remote companion encrypted request body',
  );
  if (
    policy.action_policy?.action_authority !== 'desktop_canonical_app_action_bridge' ||
    policy.action_policy?.idempotency?.send_and_start_requests_require_request_id !== true ||
    policy.action_policy?.idempotency?.desktop_deduplicates_within_pair_key_epoch !== true ||
    policy.action_policy?.idempotency?.offline_command_queue !== false
  ) {
    throw new Error('Remote companion actions must be desktop-authoritative, idempotent, and online-only');
  }

  if (
    policy.state_sync?.canonical_state_owner !== 'codex_core_app_server_and_desktop_opl_app_projection' ||
    policy.state_sync?.history_policy !== 'do_not_use_ably_history_as_business_truth' ||
    policy.notifications?.background_behavior !==
      'reconnect_and_resync_on_next_foreground; do_not_keep_a_permanent_background_websocket'
  ) {
    throw new Error('Remote companion state and background behavior must remain canonical-desktop-first');
  }

  assertIncludesAll(policy.acceptance?.must_prove_before_beta, [
    'no_public_desktop_address_is_needed_for_pairing_or_reconnect',
    'duplicate_send_does_not_create_duplicate_turns',
    'revoked_device_cannot_reestablish_desktop_application_access',
  ], 'Remote companion beta acceptance');
  if (
    policy.implementation_status?.product_name_decided !== true ||
    policy.implementation_status?.transport_decided !== true ||
    policy.implementation_status?.release_ready_claim_allowed !== false
  ) {
    throw new Error('Remote companion implementation status must distinguish decision from delivery');
  }
}
