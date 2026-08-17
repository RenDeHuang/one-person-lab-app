import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';

const requiredActions = [
  'conversation.list',
  'conversation.open',
  'conversation.refresh',
  'conversation.start',
  'conversation.send_text',
  'conversation.turn.stop',
  'conversation.approval.respond',
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
    policy?.schema !== 'opl_app_remote_companion.v3' ||
    policy.owner !== 'one-person-lab-app' ||
    policy.state !== 'approved_conversation_first_product_baseline_source_aligned_external_configuration_pending'
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
      local_ios_conversation_history_authority: identity?.local_ios_conversation_history_authority,
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
      local_ios_conversation_history_authority: false,
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
    authentication.active_credential_policy !==
      'existing_desktop_pair_token_or_ios_claim_token_becomes_active_device_credential_after_pair_activation_without_minting_a_second_bearer' ||
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
    confidentiality.provider_plaintext_conversation_content !== false ||
    confidentiality.cloud_plaintext_conversation_content !== false ||
    confidentiality.aead_associated_data !==
      'protocol_version_pair_id_sender_device_id_recipient_device_id_key_epoch_sender_sequence_and_channel_direction' ||
    confidentiality.nonce_policy !==
      'cryptographically_random_96_bit_nonce_with_duplicate_rejection_per_directional_key' ||
    confidentiality.replay_protection !==
      'pair_key_epoch_plus_per_sender_monotonic_sequence_and_request_id'
  ) {
    throw new Error('OPL Link encryption must keep conversation content opaque and reject nonce or sequence reuse');
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
    policy.pairing?.fallback_method !== 'paste_full_pairing_payload' ||
    policy.pairing?.fallback_payload_policy !==
      'reuse_the_same_single_use_short_lived_payload_as_the_qr_without_adding_a_second_pairing_secret' ||
    policy.pairing?.short_manual_code !== 'deferred_not_implemented' ||
    policy.pairing?.legacy_manual_code?.status !== 'compatibility_response_only' ||
    policy.pairing?.legacy_manual_code?.user_fallback !== false ||
    policy.pairing?.legacy_manual_code?.client_behavior !== 'use_claim_secret_from_full_pairing_payload' ||
    !policy.pairing?.claim_protocol?.includes(
      'broker_validates_one_time_invitation_and_atomically_reserves_one_pair_seat_with_a_5_minute_ttl',
    ) ||
    !policy.pairing?.claim_protocol?.includes(
      'desktop_reads_the_claim_and_both_devices_display_the_same_short_authentication_string_derived_from_pairing_id_and_both_public_keys',
    ) ||
    !policy.pairing?.claim_protocol?.includes(
      'desktop_pair_token_and_ios_claim_token_become_role_bound_active_device_credentials_after_activation_without_minting_second_bearers_and_the_broker_persists_only_their_sha256_hashes_for_future_usersig_requests',
    ) ||
    !policy.pairing?.broker_persistence?.allowed?.includes('provider_user_id_bindings') ||
    policy.pairing?.broker_persistence?.allowed?.includes('plaintext_qr_claim_secret') ||
    policy.pairing?.capacity_lifecycle?.owner !== 'one-person-lab-cloud' ||
    policy.pairing?.capacity_lifecycle?.reservation_ttl_minutes > 5 ||
    !policy.pairing?.capacity_lifecycle?.allocated_states?.includes('awaiting_desktop_confirmation') ||
    policy.pairing?.capacity_lifecycle?.seat_release_condition !==
      'both_tencent_user_ids_deleted_and_provider_owner_readback_confirms_absence' ||
    policy.pairing?.capacity_lifecycle?.client_must_not_allocate_reclaim_or_infer_seats !== true ||
    policy.pairing?.device_lifecycle?.provider_account_delete_and_absence_readback_required_for_seat_reclaim !== true
  ) {
    throw new Error('OPL Link pairing must be invitation-gated, atomic, and release seats only after provider absence readback');
  }

  const pendingPairing = policy.pairing?.ios_pending_pairing_persistence;
  assertIncludesAll(pendingPairing?.material, [
    'opaque_pairing_id',
    'broker_route',
    'ios_pair_specific_private_key',
    'desktop_pair_specific_public_key',
    'ios_claim_token',
    'short_lived_pairing_expiry',
  ], 'OPL Link pending pairing material');
  if (
    pendingPairing?.owner !== 'opl-link' ||
    pendingPairing.storage !== 'ios_keychain_when_unlocked_this_device_only_until_activation_expiry_or_local_reset' ||
    pendingPairing.resume !==
      'cold_start_restores_awaiting_desktop_confirmation_and_reads_broker_state_without_reclaiming_or_reminting_pair_credentials' ||
    pendingPairing.activation !==
      'persist_active_pair_material_with_the_existing_ios_claim_token_before_transport_connect_then_delete_the_pending_record' ||
    JSON.stringify(pendingPairing.clear_on) !== JSON.stringify([
      'active_pair_material_persisted_after_activation',
      'pairing_expiry',
      'failed_claim',
      'terminal_revocation',
    ])
  ) {
    throw new Error('OPL Link must persist pending pairing material for bounded cold-start recovery');
  }

  assertIncludesAll(policy.action_policy?.product_action_names, requiredActions, 'OPL Link product actions');
  assertIncludesAll(policy.action_policy?.forbidden_actions, forbiddenActions, 'OPL Link forbidden actions');
  assertDeepEqualJson(
    policy.surface_boundary?.conversation_model,
    {
      primary_object: 'canonical_codex_conversation',
      canonical_identity: 'canonical_thread_id',
      conversation_is: [
        'the_user_visible_unit_in_the_opl_link_list',
        'the_context_for_messages_streaming_output_and_turn_control',
        'the_unit_that_can_be_started_opened_continued_and_stopped',
      ],
      task_is: [
        'optional_desktop_metadata_or_grouping_label',
        'an_external_opl_flow_ledger_or_linear_reference_when_present',
      ],
      opl_link_does_not_manage: [
        'task_lifecycle',
        'task_owner_deadline_dependency_or_workflow',
        'ledger_receipts_or_linear_issue_state',
      ],
      task_management_authority:
        'opl_flow_via_opl_ledger_and_linear_when_enabled; otherwise_task_is_desktop_conversation_grouping_metadata_only',
    },
    'OPL Link conversation and task boundary',
  );
  assertIncludesAll(policy.surface_boundary?.primary_user_outcomes, [
    'filter_the_currently_loaded_conversation_directory_locally_without_claiming_canonical_search',
  ], 'OPL Link local conversation filtering');
  assertIncludesAll(policy.surface_boundary?.deferred_outcomes, [
    'canonical_conversation_search_archive_rename_or_delete_until_desktop_apis_are_admitted',
  ], 'OPL Link canonical conversation operations');
  assertDeepEqualJson(
    policy.action_policy?.wire_action_id_mapping,
    {
      'conversation.list': 'canonical_task.list',
      'conversation.open': 'canonical_task.read',
      'conversation.refresh': 'canonical_task.refresh',
      'conversation.start': 'canonical_task.start',
      'conversation.send_text': 'canonical_task.send_text',
      'conversation.turn.stop': 'canonical_turn.stop',
      'conversation.approval.respond': 'canonical_approval.respond',
      'pair.revoke': 'pair.revoke',
    },
    'OPL Link product-to-wire action aliases',
  );
  assertDeepEqualJson(
    policy.action_policy?.request_required_fields,
    ['protocol_version', 'pair_id', 'device_id', 'key_epoch', 'nonce', 'encrypted_payload'],
    'OPL Link outer request envelope',
  );
  assertDeepEqualJson(
    policy.action_policy?.encrypted_request_fields,
    [
      'request_id',
      'canonical_thread_id_or_new_conversation_intent',
      'client_sequence',
      'action_id',
      'action_payload',
    ],
    'OPL Link encrypted request body',
  );
  if (
    policy.action_policy?.action_authority !== 'desktop_canonical_app_action_bridge' ||
    policy.action_policy?.wire_action_ids_are_internal_aliases !== true ||
    policy.action_policy?.idempotency?.send_and_start_requests_require_request_id !== true ||
    policy.action_policy?.idempotency?.desktop_deduplicates_within_pair_key_epoch !== true ||
    policy.action_policy?.idempotency?.offline_command_queue !== false
  ) {
    throw new Error('OPL Link actions must be desktop-authoritative, idempotent, and online-only');
  }

  if (
    policy.state_sync?.canonical_state_owner !== 'codex_core_app_server_and_desktop_opl_app_projection' ||
    policy.state_sync?.history_policy !== 'do_not_use_provider_history_as_canonical_conversation_truth' ||
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
    policy.implementation_status?.protocol_source_implemented !== true ||
    policy.implementation_status?.desktop_connector_source_implemented !== true ||
    policy.implementation_status?.ios_source_implemented !== true ||
    policy.implementation_status?.ios_conversation_surface_implemented !== true ||
    policy.implementation_status?.desktop_conversation_projection_implemented !== true ||
    policy.implementation_status?.cloud_broker_source_implemented !== true ||
    policy.implementation_status?.tencent_cloud_application_configured !== false ||
    policy.implementation_status?.testflight_or_app_store_release !== false ||
    policy.implementation_status?.china_three_network_qualification !== false ||
    policy.implementation_status?.release_ready_claim_allowed !== false
  ) {
    throw new Error('OPL Link implementation status must distinguish delivered source from external release evidence');
  }
}
