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
    policy?.schema !== 'opl_app_remote_companion.v2' ||
    policy.owner !== 'one-person-lab-app' ||
    policy.state !== 'approved_product_plan_client_repository_initialized_source_not_implemented'
  ) {
    throw new Error('OPL Link contract identity or implementation state is invalid');
  }

  const identity = policy.product_identity;
  assertDeepEqualJson(
    {
      app_store_name: identity?.app_store_name,
      home_screen_name: identity?.home_screen_name,
      in_app_brand_name: identity?.in_app_brand_name,
      internal_surface_id: identity?.internal_surface_id,
      product_role: identity?.product_role,
      local_ios_runtime: identity?.local_ios_runtime,
      local_ios_task_history_authority: identity?.local_ios_task_history_authority,
      local_ios_provider_or_model_authority: identity?.local_ios_provider_or_model_authority,
      local_ios_agent_package_authority: identity?.local_ios_agent_package_authority,
    },
    {
      app_store_name: 'OPL Link',
      home_screen_name: 'OPL Link',
      in_app_brand_name: 'One Person Lab',
      internal_surface_id: 'remote_companion',
      product_role: 'remote_companion_channel_not_a_runtime_or_third_workbench',
      local_ios_runtime: false,
      local_ios_task_history_authority: false,
      local_ios_provider_or_model_authority: false,
      local_ios_agent_package_authority: false,
    },
    'OPL Link product identity',
  );

  const transport = policy.transport;
  const strategy = transport?.provider_strategy;
  if (
    transport?.protocol !== 'opl_remote_transport.v1' ||
    strategy?.active_provider !== 'tencent_cloud_im' ||
    strategy.active_edition !== 'trial' ||
    strategy.selection_status !== 'approved_for_mvp' ||
    strategy.client_adapter_owner !== 'opl-link' ||
    strategy.single_provider_per_release_cohort !== true ||
    strategy.runtime_dual_write !== false ||
    strategy.automatic_provider_fallback !== false ||
    strategy.replacement_candidate !== 'ably' ||
    strategy.replacement_candidate_implemented !== false ||
    transport.public_desktop_address_required !== false ||
    transport.lan_or_vpn_configuration_required !== false ||
    transport.provider_secret_embedded_in_client !== false
  ) {
    throw new Error('OPL Link must use one Tencent Cloud IM MVP adapter behind the provider-neutral protocol');
  }

  const authentication = transport.authentication;
  if (
    authentication?.mode !== 'pair_specific_user_id_with_short_lived_usersig' ||
    authentication.credential_issuer !== 'opl_cloud_remote_companion_broker' ||
    authentication.usersig_ttl_minutes > 60 ||
    authentication.automatic_refresh !== true ||
    authentication.tencent_sdkapp_secret_in_client !== false ||
    authentication.credential_reuse_across_pairs !== false
  ) {
    throw new Error('OPL Link authentication must use pair-specific identities and short-lived broker-issued UserSig');
  }

  const messagePolicy = transport.message_policy;
  if (
    messagePolicy?.route !== 'pair_specific_c2c_custom_messages' ||
    messagePolicy.group_or_public_channel_used !== false ||
    messagePolicy.command_delivery !== 'online_only_without_cloud_command_queue' ||
    messagePolicy.provider_history_used_for_business_reads !== false ||
    messagePolicy.ids_must_be_opaque !== true ||
    messagePolicy.user_text_or_workspace_path_in_provider_route !== false ||
    transport.presence_policy?.source !== 'encrypted_pair_heartbeat_and_timeout' ||
    transport.presence_policy?.provider_presence_required !== false ||
    transport.presence_policy?.transport_connected_is_product_ready !== false
  ) {
    throw new Error('OPL Link transport routing must remain pair-scoped, online-only, and independent of provider history');
  }

  const confidentiality = transport.payload_confidentiality;
  if (
    confidentiality?.required !== true ||
    confidentiality.scheme !== 'x25519_key_agreement_hkdf_sha256_two_directional_aes_256_gcm_keys' ||
    confidentiality.provider_plaintext_task_content !== false ||
    confidentiality.cloud_plaintext_task_content !== false ||
    confidentiality.aead_associated_data !==
      'protocol_version_pair_id_device_id_key_epoch_and_channel_direction' ||
    confidentiality.nonce_policy !==
      'cryptographically_random_96_bit_nonce_with_duplicate_rejection_per_directional_key' ||
    confidentiality.replay_protection !==
      'pair_key_epoch_plus_per_sender_monotonic_sequence_and_request_id'
  ) {
    throw new Error('OPL Link encryption must keep task content opaque and reject nonce or sequence reuse');
  }

  const guardrails = transport.usage_guardrails;
  if (
    guardrails?.provider !== 'tencent_cloud_im' ||
    guardrails.edition !== 'trial' ||
    guardrails.registered_user_id_limit !== 100 ||
    guardrails.peak_dau_limit !== 100 ||
    guardrails.user_ids_per_active_pair_seat !== 2 ||
    guardrails.active_pair_seat_limit !== 40 ||
    guardrails.pair_seat_warning_threshold !== 35 ||
    guardrails.reserved_user_id_headroom !==
      guardrails.registered_user_id_limit -
        guardrails.user_ids_per_active_pair_seat * guardrails.active_pair_seat_limit ||
    guardrails.new_pairing_stops_at_seat_limit !== true ||
    guardrails.limits_must_be_rechecked_before_beta_and_public_release !== true
  ) {
    throw new Error('OPL Link trial capacity must reserve provider headroom and gate new pairings at 40 seats');
  }

  if (
    policy.distribution_and_access?.beta_carrier !== 'testflight' ||
    policy.distribution_and_access?.public_carrier !== 'apple_app_store' ||
    policy.distribution_and_access?.invitation_required_for_pairing !== true ||
    policy.distribution_and_access?.testflight_is_capacity_or_entitlement_authority !== false ||
    policy.distribution_and_access?.install_launch_or_invite_entry_consumes_provider_identity !== false ||
    policy.distribution_and_access?.successful_pairing_consumes_one_active_pair_seat !== true
  ) {
    throw new Error('OPL Link distribution must separate Apple carrier access from invitation and pair capacity');
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
    'OPL Link QR payload',
  );
  if (
    policy.pairing?.account_required !== false ||
    policy.pairing?.manual_code_policy !==
      '12_character_crockford_base32_random_code_server_keyed_hmac_sha256_storage_5_minute_expiry_max_5_attempts_then_atomic_pairing_invalidation' ||
    !policy.pairing?.claim_protocol?.includes(
      'broker_validates_one_time_invitation_and_atomically_reserves_one_pair_seat_with_a_5_minute_ttl',
    ) ||
    !policy.pairing?.claim_protocol?.includes(
      'desktop_reads_the_claim_and_both_devices_display_the_same_short_authentication_string_derived_from_pairing_id_and_both_public_keys',
    ) ||
    !policy.pairing?.claim_protocol?.includes(
      'broker_issues_separate_one_time_pair_specific_device_credentials_and_persists_only_their_sha256_hashes_for_future_usersig_requests',
    ) ||
    !policy.pairing?.broker_persistence?.allowed?.includes('provider_user_id_bindings') ||
    policy.pairing?.broker_persistence?.allowed?.includes('plaintext_qr_claim_secret') ||
    policy.pairing?.capacity_lifecycle?.owner !== 'one-person-lab-cloud' ||
    policy.pairing?.capacity_lifecycle?.reservation_ttl_minutes > 5 ||
    policy.pairing?.capacity_lifecycle?.seat_release_condition !==
      'both_tencent_user_ids_deleted_and_provider_owner_readback_confirms_absence' ||
    policy.pairing?.capacity_lifecycle?.client_must_not_allocate_reclaim_or_infer_seats !== true ||
    policy.pairing?.device_lifecycle?.provider_account_delete_and_absence_readback_required_for_seat_reclaim !== true
  ) {
    throw new Error('OPL Link pairing must be invitation-gated, atomic, and release seats only after provider absence readback');
  }

  assertIncludesAll(policy.action_policy?.mvp_allowed_actions, requiredActions, 'OPL Link allowed actions');
  assertIncludesAll(policy.action_policy?.forbidden_actions, forbiddenActions, 'OPL Link forbidden actions');
  assertDeepEqualJson(
    policy.action_policy?.request_required_fields,
    ['protocol_version', 'pair_id', 'device_id', 'key_epoch', 'nonce', 'encrypted_payload'],
    'OPL Link outer request envelope',
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
    'OPL Link encrypted request body',
  );
  if (
    policy.action_policy?.action_authority !== 'desktop_canonical_app_action_bridge' ||
    policy.action_policy?.idempotency?.send_and_start_requests_require_request_id !== true ||
    policy.action_policy?.idempotency?.desktop_deduplicates_within_pair_key_epoch !== true ||
    policy.action_policy?.idempotency?.offline_command_queue !== false
  ) {
    throw new Error('OPL Link actions must be desktop-authoritative, idempotent, and online-only');
  }

  if (
    policy.state_sync?.canonical_state_owner !== 'codex_core_app_server_and_desktop_opl_app_projection' ||
    policy.state_sync?.history_policy !== 'do_not_use_provider_history_as_business_truth' ||
    policy.notifications?.background_behavior !==
      'reconnect_and_resync_on_next_foreground; do_not_keep_a_permanent_background_socket'
  ) {
    throw new Error('OPL Link state and background behavior must remain canonical-desktop-first');
  }

  if (
    policy.ownership?.ios_native_carrier_client_state_and_transport_adapter !== 'opl-link' ||
    policy.ownership?.invitation_pair_seat_usersig_and_provider_account_lifecycle !== 'one-person-lab-cloud' ||
    policy.ownership?.realtime_service !== 'tencent_cloud_im'
  ) {
    throw new Error('OPL Link ownership must keep iOS, Cloud, desktop, and provider authority separate');
  }

  assertIncludesAll(policy.acceptance?.must_prove_before_beta, [
    'no_public_desktop_address_is_needed_for_pairing_or_reconnect',
    'atomic_pair_seat_reservation_prevents_capacity_oversubscription',
    'duplicate_send_does_not_create_duplicate_turns',
    'both_provider_user_ids_are_absent_before_pair_seat_reclaim',
  ], 'OPL Link beta acceptance');
  if (
    policy.implementation_status?.product_name_decided !== true ||
    policy.implementation_status?.transport_decided !== true ||
    policy.implementation_status?.ios_repository_initialized !== true ||
    policy.implementation_status?.ios_source_implemented !== false ||
    policy.implementation_status?.release_ready_claim_allowed !== false
  ) {
    throw new Error('OPL Link implementation status must distinguish repository design from delivered source');
  }
}
