import {
  assert,
  fs,
  path,
  test,
  appRoot,
  expectedDefaultCompanionSkillSyncIds,
  expectedDefaultPackagedSkillIds,
  expectedOrdinaryForbiddenCapabilityPolicy,
  expectedOrdinaryRequiredScrubTargets,
  readProductProfile,
  readInstallExposurePolicy,
} from './helpers.ts';

test('App product profile owns user-facing defaults without runtime authority', () => {
  const profile = readProductProfile();
  const installExposurePolicy = readInstallExposurePolicy();
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );

  assert.equal(profile.owner, 'one-person-lab-app');
  assert.equal(profile.purpose, 'app_owned_product_profile');
  assert.equal(profile.app_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(profile.default_session_profile.executor, 'codex_cli');
  assert.equal(profile.default_session_profile.model, profile.codex.default_model);
  assert.equal(profile.default_session_profile.reasoning_effort, profile.codex.default_reasoning_effort);
  assert.equal(profile.gui.authority, 'app_repo_owned_product_truth');
  assert.equal(profile.gui.implementation_carrier, 'opl-aion-shell');
  assert.equal(profile.gui.appearance.default_css_theme_id, 'default-theme');
  assert.equal(profile.gui.appearance.codex_theme_default_enabled, false);
  assert.equal(profile.gui.home.primary_input_surface, 'single_card');
  assert.equal(profile.gui.home.nested_input_card_frames_allowed, false);
  assert.equal(profile.gui.home.codex_cli_fixed_executor, true);
  assert.equal(profile.gui.home.home_executor_selector_visible, false);
  assert.equal(profile.gui.home.codex_model_selector_visible, true);
  assert.equal(profile.gui.home.codex_model_list_visible, true);
  assert.equal(profile.gui.home.codex_model_policy, 'codex_cli_latest_strongest_model_selector_visible');
  assert.equal(profile.gui.home.codex_default_model, 'gpt-5.5');
  assert.equal(profile.gui.home.codex_default_reasoning_effort, profile.codex.default_reasoning_effort);
  assert.equal(profile.gui.home.codex_default_permission_mode, 'full-access');
  assert.equal(profile.gui.home.permission_mode_selector_visible, false);
  assert.equal(profile.gui.home.conversation_backend_selector_visible, false);
  assert.equal(profile.gui.home.conversation_model_selector_visible, true);
  assert.equal(profile.gui.home.conversation_permission_mode_selector_visible, false);
  assert.equal(profile.gui.home.codex_home_model_status_label, 'GPT-5.5');
  assert.equal(profile.gui.home.codex_home_model_status_label_en, 'GPT-5.5');
  assert.equal(profile.gui.home.codex_precise_model_display_policy, 'friendly_model_primary_reasoning_configurable_in_model_menu');
  assert.deepEqual(profile.gui.home.home_layout, {
    default_mode: 'composer_first_chat_canvas',
    first_screen_policy: 'chat_first_no_dashboard_or_landing_copy',
    composer_position: 'pinned_bottom',
    composer_primary: true,
    workspace_selector_visible: true,
    purpose_entries_visible: ['research', 'grant', 'ppt', 'book'],
    workspace_session_rail_default_state: 'collapsed',
    right_context_inspector_default_state: 'collapsed',
    must_not_show: [
      'dashboard-first home',
      'explanatory landing page',
      'backend settings panel in composer',
      'AionUI Team nav entry',
      'AionUI Team page as ordinary App surface',
    ],
  });
  assert.deepEqual(profile.gui.ordinary_conversation, {
    path_id: 'ordinary_codex_conversation',
    entry_source: 'home_purpose_entry_or_new_conversation',
    executor: 'codex_cli',
    composer_position: 'pinned_bottom',
    purpose_tag_visible: true,
    assistant_route_receipt_required: true,
    backend_selector_visible: false,
    model_selector_visible: true,
    permission_mode_selector_visible: false,
    provider_selector_visible: false,
    model_status_surface: 'gui.home.codex_home_model_status_label',
    technical_details_policy: 'friendly_model_primary_reasoning_configurable_in_model_menu',
  });
  assert.deepEqual(
    profile.gui.right_context_inspector.tabs.map((tab) => tab.id),
    ['files', 'capabilities', 'runtime', 'memory', 'automations', 'settings'],
  );
  assert.equal(profile.gui.right_context_inspector.placement, 'right');
  assert.equal(profile.gui.right_context_inspector.default_state, 'collapsed');
  assert.equal(profile.gui.right_context_inspector.opens_on_user_request_only, true);
  assert.equal(profile.gui.right_context_inspector.chat_canvas_remains_primary, true);
  assert.equal(profile.gui.home.codex_auto_model_selection.strategy, 'codex_cli_auto_latest_available_frontier');
  assert.equal(profile.gui.home.codex_auto_model_selection.model_list_source, 'codex_cli_handshake_available_models');
  assert.equal(
    profile.gui.home.codex_auto_model_selection.frontier_model_preference_order_role,
    'fallback_when_codex_cli_model_list_unavailable',
  );
  assert.equal(profile.gui.home.codex_auto_model_selection.user_can_override_model, true);
  assert.equal(profile.gui.home.codex_auto_model_selection.user_can_override_reasoning_effort, true);
  assert.equal(profile.gui.home.codex_auto_model_selection.user_can_restore_auto, true);
  assert.equal(profile.gui.home.codex_auto_model_selection.selection_persists_into_conversation, true);
  assert.deepEqual(
    profile.gui.home.codex_auto_model_selection.frontier_model_preference_order,
    ['gpt-5.5', 'gpt-5.4'],
  );
  assert.deepEqual(profile.gui.home.retired_codex_models_must_not_be_exposed, [
    'gpt-5.3-codex',
    'gpt-5.2',
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ]);
  assert.equal(guiContract.executor_policy.default_model, profile.codex.default_model);
  assert.equal(guiContract.executor_policy.default_reasoning_effort, profile.codex.default_reasoning_effort);
  assert.equal(
    guiContract.executor_policy.user_reasoning_effort_override_allowed,
    profile.gui.home.codex_auto_model_selection.user_can_override_reasoning_effort,
  );
  assert.deepEqual(
    guiContract.executor_policy.model_display_options_policy.user_reasoning_effort_options,
    profile.gui.home.codex_model_display_options.user_reasoning_effort_options,
  );
  assert.equal(
    guiContract.executor_policy.model_display_options_policy.reasoning_effort_menu_visible,
    true,
  );
  assert.equal(
    guiContract.executor_policy.model_display_options_policy.reasoning_effort_visible_for_every_option,
    false,
  );
  assert.equal(
    guiContract.executor_policy.model_display_options_policy.reasoning_effort_options_source,
    'acp_codex_config_options_enum',
  );
  assert.deepEqual(profile.gui.home.home_purpose_entries.map((entry) => entry.id), ['research', 'grant', 'ppt', 'book']);
  assert.deepEqual(profile.gui.home.home_purpose_entries.map((entry) => entry.primary_label), ['科研', '基金', '演示', '写书']);
  assert.deepEqual(profile.gui.home.home_purpose_entries.map((entry) => entry.target_assistant_id), ['mas', 'mag', 'rca', 'bookforge']);
  assert.ok(profile.gui.home.home_purpose_entries.every((entry) => entry.display_policy === 'purpose_first'));
  assert.deepEqual(profile.gui.default_assistants.map((assistant) => assistant.id), ['mas', 'mag', 'rca', 'bookforge']);
  assert.ok(profile.gui.default_assistants.every((assistant) => assistant.home_entry_policy === 'purpose_entry_target'));
  assert.deepEqual(profile.gui.assistant_skill_profiles.map((profile) => profile.assistant_id), ['mas', 'mag', 'rca', 'bookforge']);
  assert.deepEqual(
    Object.fromEntries(profile.gui.assistant_skill_profiles.map((profile) => [profile.assistant_id, profile.required_skills])),
    { mas: ['mas'], mag: ['mag'], rca: ['rca'], bookforge: ['opl-bookforge'] },
  );
  assert.ok(
    profile.gui.assistant_skill_profiles.every(
      (profile) => profile.skill_menu_policy === 'assistant_scoped_required_checked_optional_visible',
    ),
  );
  const appPackagedSkillIds = new Set(profile.companion_payloads.default_packaged_codex_skill_ids);
  assert.ok(
    profile.gui.assistant_skill_profiles.every((profile) =>
      [...profile.required_skills, ...profile.optional_skills].every((skill) => appPackagedSkillIds.has(skill)),
    ),
  );
  assert.ok(profile.gui.assistant_skill_profiles.every((profile) => !('hidden_home_skill_names' in profile)));
  assert.ok(profile.gui.assistant_skill_profiles.every((profile) => !profile.optional_skills.includes('morph-ppt')));
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.scope, 'home_purpose_entry_to_conversation');
  assert.deepEqual(profile.gui.builtin_assistant_route_receipt_policy.required_for_assistants, ['mas', 'mag', 'rca', 'bookforge']);
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.route_kind, 'builtin_capability');
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.executor, 'codex_cli');
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.source, 'opl_app_home');
  assert.deepEqual(profile.gui.builtin_assistant_route_receipt_policy.required_fields, [
    'route_kind',
    'executor',
    'assistant_id',
    'assistant_short_name',
    'source',
  ]);
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.must_not_depend_on_visible_backend_selection, true);
  assert.deepEqual(profile.gui.ordinary_capability_selector_policy, {
    scope: 'home_composer_and_ordinary_conversation',
    authority: 'app_owned_opl_allowlist',
    skill_source_ref: 'gui.assistant_skill_profiles.required_skills + optional_skills',
    skill_menu_policy: 'assistant_scoped_required_checked_optional_visible',
    conversation_loaded_skill_display_policy: 'filter_to_ordinary_skill_allowlist',
    mcp_server_source_ref: 'gui.ordinary_capability_selector_policy.visible_mcp_server_ids',
    mcp_menu_policy: 'empty_until_app_explicitly_whitelists_opl_mcp_servers',
    visible_mcp_server_ids: [],
    conversation_loaded_mcp_display_policy: 'filter_to_visible_mcp_server_ids',
    forbidden_skill_examples: ['aionui-skills', 'aionui-webui-setup', 'skill-creator', 'cron'],
    forbidden_mcp_policy: 'do_not_surface_user_or_aionui_mcp_servers_in_ordinary_home_without_app_profile_allowlist',
    forbidden_mcp_examples: ['aionui-team', 'team_*', 'mcp__aionui-team*', 'team_mcp_stdio_config', 'team_id/teamId'],
    ...expectedOrdinaryForbiddenCapabilityPolicy,
    required_scrub_targets: expectedOrdinaryRequiredScrubTargets,
    conversation_snapshot_policy: 'scrub_disabled_team_mcp_and_team_metadata_before_rendering_or_inheriting_ordinary_conversations',
  });
  assert.deepEqual(profile.settings.visible_tabs, [
    'general',
    'access',
    'capabilities',
    'environment',
    'storage',
    'appearance',
    'advanced',
  ]);
  assert.deepEqual(profile.settings.legacy_route_redirects, {
    overview: 'general',
    runtime: 'environment',
    system: 'advanced',
    model: 'environment',
    agent: 'capabilities',
    assistants: 'capabilities',
    'skills-hub': 'capabilities',
    tools: 'capabilities',
    display: 'appearance',
    webui: 'access',
    pet: 'appearance',
  });
  assert.deepEqual(profile.settings.settings_information_architecture.ordinary_groups.map((group) => group.id), [
    'overview',
    'setup_access',
    'capabilities',
    'maintenance',
    'data_storage',
    'preferences',
    'advanced',
  ]);
  assert.deepEqual(Object.keys(profile.settings.settings_information_architecture.primary_tabs), [
    'general',
    'access',
    'capabilities',
    'environment',
    'storage',
    'appearance',
    'advanced',
    'about',
  ]);
  assert.deepEqual(profile.settings.settings_information_architecture.primary_tabs.storage, {
    label_zh: '存储',
    label_en: 'Data & Storage',
    role: 'safe_local_data_lifecycle_inventory_and_cleanup',
    primary_question: 'Which local data roots are using space, and which cleanup actions are safe after preview or proof?',
    ia_group: 'data_storage',
    ordinary_entry_policy: 'top_level_control_center_group_entry',
  });
  assert.deepEqual(profile.settings.developer_profile.capability_axes, [
    'source_channel',
    'workspace_trust',
    'github_authority',
    'agent_automation',
    'runtime_mutation_scope',
  ]);
  assert.equal(profile.settings.developer_profile.default_profile, 'standard_user');
  assert.equal(profile.settings.developer_profile.opt_in_policy, 'explicit_opt_in_only');
  assert.equal(
    profile.settings.developer_profile.capabilities.source_channel.standard_default,
    'agent_latest_package_channel',
  );
  assert.equal(
    profile.settings.developer_profile.capabilities.source_channel.developer_opt_in,
    'github_repo_or_local_checkout',
  );
  assert.equal(
    profile.settings.developer_profile.capabilities.runtime_mutation_scope.standard_default,
    'app_action_route_only',
  );
  assert.equal('legacy_developer_mode_alias' in profile.settings.developer_profile, false);
  assert.equal(profile.gui.non_default_assistants.find((assistant) => assistant.id === 'oma').home_default_visible, false);
  assert.ok(profile.codex.default_visible_skills.includes('superpowers'));
  assert.ok(profile.codex.default_visible_skills.includes('cron'));
  assert.ok(profile.codex.default_visible_skills.includes('pdf'));
  assert.ok(profile.codex.default_visible_skills.includes('mineru-document-extractor'));
  assert.ok(profile.codex.default_visible_skills.includes('ui-ux-pro-max'));
  assert.ok(profile.companion_payloads.default_packaged_codex_skill_ids.includes('superpowers'));
  assert.deepEqual(profile.companion_payloads.default_packaged_codex_skill_ids, expectedDefaultPackagedSkillIds);
  assert.ok(profile.companion_payloads.packaged_not_default_visible_codex_skill_ids.includes('opl-meta-agent'));
  assert.ok(!profile.codex.skill_priority.includes('morph-ppt'));
  assert.ok(!profile.companion_payloads.default_packaged_codex_skill_ids.includes('morph-ppt'));
  assert.ok(profile.first_run.deferred_blockers.includes('domain_modules'));
  assert.deepEqual(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.missing_host_tools_allowed,
    ['command_line_tools', 'homebrew', 'node', 'git'],
  );
  assert.equal(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.initial_runtime_source,
    'bundled_runtime',
  );
  assert.equal(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.core_ready_without_host_tools,
    true,
  );
  assert.deepEqual(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.must_not_block_core_ready,
    [
      'repo_sync',
      'module_reconcile',
      'command_line_tools_install',
      'native_helpers',
      'companion_skills_install',
      'ecosystem_module_updates',
    ],
  );
  assert.deepEqual(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.post_core_ready_background_policy,
    {
      mode: 'best_effort_non_blocking',
      continues_after_core_ready: true,
      managed_items: [
        'repo_sync',
        'module_reconcile',
        'command_line_tools_install',
        'native_helpers',
        'companion_skills_install',
        'ecosystem_module_updates',
      ],
      user_confirmation_items: ['command_line_tools_install'],
    },
  );
  assert.equal(profile.first_run.background_maintenance.blocks_core_ready, false);
  assert.equal(profile.first_run.background_maintenance.mode, 'best_effort_after_core_ready');
  assert.equal(profile.first_run.background_maintenance.continues_after_core_ready, true);
  assert.deepEqual(
    profile.first_run.background_maintenance.items,
    [
      'repo_sync',
      'module_reconcile',
      'command_line_tools_install',
      'native_helpers',
      'companion_skills_install',
      'ecosystem_module_updates',
    ],
  );
  assert.equal(profile.first_run.core_ready_policy.standard_package.bootstrap_owner, 'app_managed');
  assert.equal(profile.first_run.core_ready_policy.standard_package.maintenance_owner, 'app_managed');
  assert.equal(
    profile.first_run.core_ready_policy.standard_package.user_first_screen_terminal_instruction_allowed,
    false,
  );
  assert.equal(
    profile.first_run.core_ready_policy.standard_package.manual_host_tool_install_terminal_state_allowed,
    false,
  );
  assert.equal(
    profile.first_run.core_ready_policy.standard_package.maintenance_resolution_policy,
    'app_or_cli_managed_best_effort_until_ready',
  );
  assert.deepEqual(
    profile.first_run.core_ready_policy.standard_package.forbidden_terminal_instruction_end_states,
    ['install_homebrew_first', 'install_node_first', 'install_git_first'],
  );
  assert.equal(profile.first_run.command_line_tools.auto_request_installer, true);
  assert.equal(profile.first_run.command_line_tools.installer_command, 'xcode-select --install');
  assert.equal(profile.first_run.command_line_tools.system_installer_only, true);
  assert.equal(profile.first_run.command_line_tools.waits_for_user_confirmation, true);
  assert.equal(profile.first_run.command_line_tools.blocks_full_first_launch, false);
  assert.match(
    profile.first_run.command_line_tools.messages.join('\n'),
    /keep using One Person Lab while that Apple installer runs/,
  );
  assert.doesNotMatch(profile.first_run.command_line_tools.messages.join('\n'), /retry setup/i);
  assert.equal(
    profile.first_run.updates.standard_channel.implementation_reference,
    'electron_autoUpdater_background_download_update_downloaded_restart_prompt',
  );
  assert.deepEqual(profile.first_run.updates.standard_channel.metadata_scope, [
    'latest-mac.yml',
    'latest-arm64-mac.yml',
  ]);
  assert.equal(profile.first_run.updates.standard_channel.download_policy, 'background_download');
  assert.equal(profile.first_run.updates.standard_channel.apply_policy, 'restart_when_ready');
  assert.equal(profile.first_run.updates.standard_channel.ready_prompt, 'prompt_restart_after_download_ready');
  assert.equal(profile.first_run.updates.standard_channel.full_first_install_metadata_allowed, false);
  assert.equal(profile.first_run.updates.standard_channel.blocks_core_ready, false);
  assert.deepEqual(profile.companion_payloads.ecosystem_modules, ['officecli', 'mineru', 'opl-meta-agent', 'opl-bookforge']);
  assert.equal(profile.companion_payloads.management_authority.officecli, 'app_or_cli_managed');
  assert.equal(profile.companion_payloads.management_authority.mineru, 'app_or_cli_managed');
  assert.equal(profile.companion_payloads.management_authority['opl-meta-agent'], 'app_or_cli_managed');
  assert.equal(profile.companion_payloads.management_authority['opl-bookforge'], 'app_or_cli_managed');
  assert.ok(profile.companion_payloads.domain_modules.includes('opl-meta-agent'));
  assert.equal(profile.companion_payloads.install_exposure_policy_ref, 'contracts/app-install-exposure-policy.json');
  assert.equal(profile.companion_payloads.public_abi.primary_semantic_entry, 'skill');
  assert.equal(profile.companion_payloads.public_abi.plugin_must_not_create_second_semantics, true);
  assert.equal(profile.companion_payloads.domain_plugin_skills_must_not_be_companion_mirrors, true);
  assert.deepEqual(profile.companion_payloads.domain_plugin_skill_ids, ['mas', 'mag', 'rca', 'opl-bookforge']);
  assert.deepEqual(profile.companion_payloads.companion_skill_sync_default_ids, expectedDefaultCompanionSkillSyncIds);
  for (const domainPluginId of profile.companion_payloads.domain_plugin_skill_ids) {
    assert.equal(profile.companion_payloads.companion_skill_sync_default_ids.includes(domainPluginId), false);
  }
  assert.equal(installExposurePolicy.public_abi.primary_semantic_entry, profile.companion_payloads.public_abi.primary_semantic_entry);
  for (const forbiddenOwner of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    assert.ok(profile.boundary.app_does_not_own.includes(forbiddenOwner), forbiddenOwner);
  }
});

test('App install exposure policy keeps skill ABI and plugin distribution separate', () => {
  const policy = readInstallExposurePolicy();
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));

  assert.equal(policy.owner, 'one-person-lab-app');
  assert.equal(policy.purpose, 'app_install_exposure_policy');
  assert.equal(policy.producer_owner, 'one-person-lab');
  assert.deepEqual(policy.canonical_metadata_sources.sources, [
    'family_action_catalog',
    'family_stage_control_plane',
    'family-product-entry-manifest-v2',
  ]);
  assert.equal(policy.public_abi.primary_semantic_entry, 'skill');
  assert.equal(policy.public_abi.plugin_role, 'codex_app_distribution_and_capability_bundle');
  assert.equal(policy.public_abi.direct_skill_compatibility_required, true);
  assert.equal(policy.public_abi.plugin_must_not_create_second_semantics, true);
  assert.equal(policy.public_abi.app_must_not_mirror_plugin_skill_as_duplicate_bare_skill, true);

  const exposureClassById = new Map(policy.exposure_classes.map((entry) => [entry.id, entry]));
  assert.deepEqual(exposureClassById.get('family_domain_plugin_surfaces').members, ['mas', 'mag', 'rca', 'opl-bookforge']);
  assert.equal(exposureClassById.get('family_domain_plugin_surfaces').sync_target, 'codex_plugin_registry');
  assert.deepEqual(exposureClassById.get('family_domain_plugin_surfaces').must_not_sync_to, [
    '~/.codex/skills/mas',
    '~/.codex/skills/mag',
    '~/.codex/skills/rca',
    '~/.codex/skills/opl-bookforge',
  ]);
  assert.equal(exposureClassById.get('opl_generated_plugin_surfaces').sync_target, 'opl_generated_codex_plugin_surface');
  assert.deepEqual(exposureClassById.get('opl_generated_plugin_surfaces').members, ['opl-meta-agent', 'opl-bookforge']);
  assert.deepEqual(exposureClassById.get('companion_skill_sync').members, expectedDefaultCompanionSkillSyncIds);
  assert.equal(exposureClassById.get('companion_skill_sync').members.includes('mas'), false);
  assert.equal(exposureClassById.get('companion_skill_sync').members.includes('mag'), false);
  assert.equal(exposureClassById.get('companion_skill_sync').members.includes('rca'), false);

  const domainById = new Map(policy.domain_exposure.map((entry) => [entry.domain_id, entry]));
  assert.equal(domainById.get('mas').preferred_app_distribution, 'plugin_packaged_skill');
  assert.equal(domainById.get('mag').preferred_app_distribution, 'plugin_packaged_skill');
  assert.equal(domainById.get('rca').preferred_app_distribution, 'plugin_packaged_skill');
  assert.equal(domainById.get('oma').preferred_app_distribution, 'opl_generated_codex_plugin_surface');
  assert.equal(domainById.get('oma').default_home_visible, false);

  const installerSurfaceById = new Map(policy.installer_surfaces.map((surface) => [surface.surface, surface]));
  for (const surface of policy.installer_surfaces.filter((entry) => entry.surface !== 'unsigned_local_app_authorization')) {
    if (surface.surface !== 'stable_local_authorized_macos_install') {
      assert.equal(surface.progress_source, 'opl system initialize --json');
    }
  }
  const stableMacosInstall = installerSurfaceById.get('stable_local_authorized_macos_install');
  assert.equal(stableMacosInstall.entrypoint, 'install.sh --stable-macos-install --yes');
  assert.deepEqual(stableMacosInstall.compatibility_entrypoints, ['install-stable.sh']);
  assert.equal(stableMacosInstall.backing_entrypoint, undefined);
  assert.equal(stableMacosInstall.compatibility_backing_entrypoint, undefined);
  assert.equal(stableMacosInstall.progress_source, 'github_release_dmg_copy_and_local_quarantine_diagnostics');
  assert.equal(
    stableMacosInstall.exposure_policy,
    'one_terminal_command_download_copy_authorize_and_open_as_stable_release_path',
  );
  assert.equal(stableMacosInstall.stable_release_path, true);
  assert.equal(stableMacosInstall.default_package_profile, 'full');
  assert.deepEqual(stableMacosInstall.required_commands, [
    'curl',
    'hdiutil attach -nobrowse -readonly',
    'ditto',
    'xattr -dr com.apple.quarantine',
    'codesign --verify --deep --strict --verbose=2',
    'spctl --assess --type execute --verbose=4',
    'open',
  ]);
  const unsignedLocalAuthorization = installerSurfaceById.get('unsigned_local_app_authorization');
  assert.equal(unsignedLocalAuthorization.entrypoint, 'install.sh --authorize-local-app-only');
  assert.equal(unsignedLocalAuthorization.progress_source, 'local_quarantine_and_gatekeeper_diagnostics');
  assert.equal(
    unsignedLocalAuthorization.exposure_policy,
    'explicit_user_confirmed_quarantine_removal_for_existing_local_app',
  );
  assert.equal(unsignedLocalAuthorization.stable_release_replacement_allowed, false);
  assert.deepEqual(unsignedLocalAuthorization.required_commands, [
    'xattr -dr com.apple.quarantine',
    'codesign --verify --deep --strict --verbose=2',
    'spctl --assess --type execute --verbose=4',
  ]);
  const dockerWebui = installerSurfaceById.get('docker_webui');
  assert.equal(dockerWebui.entrypoint, 'Docker/WebUI one-click installer');
  assert.equal(
    dockerWebui.exposure_policy,
    'one_click_installer_is_beginner_default_with_manual_docker_as_advanced_troubleshooting_path',
  );
  assert.equal(dockerWebui.installer_model.primary_user_path, 'one_click_installer');
  assert.equal(dockerWebui.installer_model.linux_macos_shell_script, 'install-docker-webui.sh');
  assert.equal(dockerWebui.installer_model.windows_powershell_script, 'install-docker-webui.ps1');
  assert.match(
    dockerWebui.installer_model.linux_macos_online_command,
    /raw\.githubusercontent\.com\/gaofeng21cn\/one-person-lab-app\/main\/scripts\/install-docker-webui\.sh/,
  );
  assert.equal(
    dockerWebui.installer_model.windows_online_command,
    'download install-docker-webui.ps1 from raw.githubusercontent.com and run with -Yes',
  );
  assert.equal(
    dockerWebui.installer_model.windows_prerequisite_mode,
    'explicit_install_prerequisites_switch_requires_administrator',
  );
  assert.equal(dockerWebui.installer_model.compose_file, 'compose.yaml');
  assert.deepEqual(dockerWebui.installer_model.persistent_host_dirs, [
    'OnePersonLab/data',
    'OnePersonLab/projects',
  ]);
  assert.deepEqual(dockerWebui.installer_model.container_mounts, {
    data: '/data',
    projects: '/projects',
  });
  assert.equal(dockerWebui.installer_model.api_key_policy, 'never_pass_api_key_on_cli_or_environment_for_beginner_path');
  assert.equal(
    dockerWebui.installer_model.api_key_entry_surface,
    'browser_webui_first_run_access_panel_or_settings_access',
  );
  assert.deepEqual(dockerWebui.installer_model.runtime_proxy_smoke, {
    mode: 'webui_proxy_configure_codex',
    endpoint: '/api/opl-runtime/configure-codex',
    command: 'opl system configure-codex --api-key-stdin --json',
    secret_transport: 'stdin_only',
    receipt_schema: 'opl_docker_webui_api_key_flow_evidence.v1',
    key_material_recorded: false,
  });
  assert.equal(
    dockerWebui.installer_model.startup_doctor.validator,
    'scripts/validate-docker-webui-diagnostics.ts',
  );
  assert.deepEqual(dockerWebui.installer_model.startup_doctor.required_files, [
    'metadata.txt',
    'diagnostics-manifest.json',
    'compose.yaml',
    'docker-version.txt',
    'docker-compose-version.txt',
    'docker-compose-ps.txt',
    'docker-compose-logs.txt',
    'docker-image.txt',
    'http-probe.txt',
    'directories.txt',
    'data-preservation.txt',
  ]);
  assert.equal(
    dockerWebui.installer_model.failure_recovery.health_timeout,
    'collect_diagnostics_then_retry_after_Docker_port_or_container_fix',
  );
  assert.deepEqual(dockerWebui.installer_model.operator_progress.status_surfaces, [
    'HTTP health readback',
    'api_key_flow_evidence',
    'data-preservation verdict',
    'OPL maintenance status after WebUI opens',
  ]);
  assert.deepEqual(dockerWebui.installer_model.operator_progress.must_not_claim, [
    'release readiness',
    'clean VM pass',
    'domain readiness',
    'production readiness',
  ]);
  assert.equal(dockerWebui.installer_model.manual_docker_fallback, 'advanced_troubleshooting_path_only');
  assert.deepEqual(dockerWebui.installer_model.manual_fallback_forms, ['docker run', 'docker compose']);
  assert.equal(
    dockerWebui.installer_model.online_availability_claim_policy,
    'repo_contract_and_artifacts_only_until_release_or_publish_receipt_exists',
  );
  assert.equal(dockerWebui.smoke_gate_contract.status, 'required_manual_or_workflow_gate_not_live_evidence');
  assert.equal(
    dockerWebui.smoke_gate_contract.release_readiness_policy,
    'must_not_claim_release_ready_until_required_smoke_gates_have_fresh_artifacts_or_typed_blockers',
  );
  assert.equal(dockerWebui.smoke_gate_contract.workflow_artifact, 'docker-webui-smoke-gate-contract.json');
  assert.deepEqual(dockerWebui.smoke_gate_contract.workflow_import, {
    desktop_release_workflow: '.github/workflows/desktop-release.yml',
    validation_job: 'docker-webui-clean-vm-evidence',
    linux_input: 'docker_webui_clean_linux_evidence_artifact',
    windows_input: 'docker_webui_clean_windows_evidence_artifact',
    validation_artifact: 'docker-webui-clean-vm-evidence-<version>',
    aggregate_summary: 'docker-webui-clean-vm-evidence-validation.json',
    linux_summary: 'clean_linux_vm-validation-summary.json',
    windows_summary: 'clean_windows_vm-validation-summary.json',
    accepted_result_file: 'docker-webui-smoke-gate-result.json',
    linux_default_producer: 'desktop_release_same_job_ubuntu_clean_vm_generated',
    linux_manual_producer_workflow: '.github/workflows/docker-webui-clean-linux-vm.yml',
    windows_manual_producer_workflow: '.github/workflows/docker-webui-clean-windows-vm.yml',
    windows_import_manifest: 'windows-smoke-evidence.json',
    missing_artifact_status: 'typed_blocker',
    missing_artifact_blocker_codes: [
      'missing_clean_linux_vm_docker_webui_evidence_artifact',
      'missing_clean_windows_vm_docker_webui_evidence_artifact',
    ],
    readiness_admission_requires_passed_validation: true,
  });
  assert.deepEqual(
    dockerWebui.smoke_gate_contract.required_gates.map((gate) => gate.id),
    ['clean_linux_vm', 'clean_windows_vm', 'existing_docker', 'existing_old_onepersonlab_data_dir'],
  );
  assert.equal(
    dockerWebui.smoke_gate_contract.required_gates.find((gate) => gate.id === 'clean_linux_vm').entrypoint,
    'install-docker-webui.sh --yes',
  );
  assert.equal(
    dockerWebui.smoke_gate_contract.required_gates.find((gate) => gate.id === 'clean_linux_vm').execution_mode,
    'desktop_release_same_job_ubuntu_clean_vm_smoke_or_manual_vm_smoke',
  );
  assert.equal(
    dockerWebui.smoke_gate_contract.required_gates.find((gate) => gate.id === 'clean_windows_vm').entrypoint,
    'install-docker-webui.ps1 -Yes',
  );
  assert.equal(
    dockerWebui.smoke_gate_contract.required_gates.find((gate) => gate.id === 'clean_windows_vm').execution_mode,
    'self_hosted_clean_windows_runner_or_manual_vm_smoke',
  );
  assert.equal(
    dockerWebui.smoke_gate_contract.required_gates.find((gate) => gate.id === 'existing_docker').docker_state,
    'existing_docker_must_be_reused_not_reinstalled',
  );
  assert.equal(
    dockerWebui.smoke_gate_contract.required_gates.find((gate) => gate.id === 'existing_old_onepersonlab_data_dir').data_state,
    'existing_OnePersonLab_data_dir_must_be_preserved_or_migrated_without_delete',
  );
  for (const gate of dockerWebui.smoke_gate_contract.required_gates) {
    assert.ok(gate.required_evidence.includes('compose_yaml'), `${gate.id} must require compose evidence`);
    assert.ok(gate.required_evidence.includes('container_logs'), `${gate.id} must require container logs`);
    assert.ok(gate.required_evidence.includes('http_health_readback'), `${gate.id} must require HTTP health readback`);
    assert.ok(gate.required_evidence.includes('api_key_flow_evidence'), `${gate.id} must require API key UI flow evidence`);
    assert.ok(gate.required_evidence.includes('install_manifest_readback'), `${gate.id} must require install manifest readback`);
  }
  assert.deepEqual(dockerWebui.smoke_gate_contract.false_ready_boundary, {
    docs_or_contract_only_can_claim_release_ready: false,
    local_container_smoke_can_replace_clean_vm_smoke: false,
    missing_gate_must_be_typed_blocker: true,
  });
  assert.equal(policy.first_run_user_presentation.skill_plugin_distinction_visible_by_default, false);
  assert.deepEqual(policy.setup_flow_contract.ready_to_launch_required_core_items, [
    'workspace_root',
    'codex_cli',
    'codex_config',
  ]);

  assert.equal(
    packageJson.scripts['validate:agent-installation'],
    'node --experimental-strip-types scripts/validate-agent-installation-contract.ts',
  );

  assert.equal(policy.agent_installation_contract.owner, 'one-person-lab-app');
  assert.equal(policy.agent_installation_contract.producer_owner, 'one-person-lab');
  assert.equal(policy.agent_installation_contract.unified_sync_command, 'opl connect sync-skills');
  assert.equal(policy.agent_installation_contract.managed_install_source, 'opl_managed_modules');
  assert.equal(policy.agent_installation_contract.user_agent_installation_mode, 'consume_shared_skill_action_stage_metadata');
  assert.equal(policy.agent_installation_contract.codex_plugin_registry_target, 'codex_plugin_registry');
  assert.equal(policy.agent_installation_contract.direct_skill_target, 'codex_user_skill_discovery_path');
  assert.equal(policy.agent_installation_contract.product_entry_target, 'family-product-entry-manifest-v2');
  assert.deepEqual(policy.agent_installation_contract.required_agent_ids, [
    'mas',
    'mag',
    'rca',
    'oma',
    'bookforge',
    'scholarskills',
  ]);
  assert.deepEqual(policy.agent_installation_contract.default_plugin_agent_ids, ['mas', 'mag', 'rca', 'bookforge']);
  assert.deepEqual(policy.agent_installation_contract.generated_plugin_agent_ids, ['oma', 'bookforge']);
  assert.deepEqual(policy.agent_installation_contract.fail_closed_states, policy.sync_and_install_contract.fail_closed_states);
  assert.equal(policy.agent_installation_contract.may_use_developer_checkout_by_default, false);
  assert.equal(policy.agent_installation_contract.developer_checkout_override_policy, 'explicit_opt_in_only');
  assert.equal(
    policy.agent_installation_contract.developer_checkout_override_surface,
    'Developer Profile source_channel capability',
  );
  assert.equal(policy.agent_installation_contract.ordinary_user_module_source, 'app_cli_managed_ghcr_opl_packages_channel');
  assert.deepEqual(policy.agent_installation_contract.module_package_channel_agent_ids, [
    'mas',
    'mag',
    'rca',
    'oma',
    'bookforge',
    'scholarskills',
  ]);
  assert.deepEqual(policy.agent_installation_contract.non_module_workflow_plugin_ids, ['opl-flow']);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.channel_id, 'opl_distribution_cohort');
  assert.equal(
    policy.agent_installation_contract.managed_agent_pack_distribution.default_transport,
    'app_cli_managed_background_maintenance',
  );
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.default_update_mode, 'silent_background');
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.default_manifest_tag, 'latest');
  assert.deepEqual(policy.agent_installation_contract.managed_agent_pack_distribution.post_update_sync_required, [
    'codex_plugin_registry',
    'plugin_packaged_skills',
    'opl_generated_plugin_surface',
  ]);
  assert.deepEqual(policy.agent_installation_contract.managed_agent_pack_distribution.package_agent_ids, [
    'mas',
    'mag',
    'rca',
    'oma',
    'bookforge',
    'scholarskills',
  ]);
  assert.deepEqual(policy.agent_installation_contract.managed_agent_pack_distribution.activation_commands, [
    'opl connect reconcile-modules',
    'opl connect sync-skills',
  ]);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.homebrew_distribution_allowed, false);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.homebrew_formula_allowed, false);
  assert.deepEqual(policy.agent_installation_contract.managed_agent_pack_distribution.forbidden_homebrew_formulae, [
    'one-person-lab-modules',
    'one-person-lab-modules-nightly',
  ]);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.must_not_write_user_codex_state, true);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.must_not_define_agent_semantics, true);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.cohort_manifest_required, true);
  assert.equal(policy.agent_installation_contract.duplicate_bare_skill_policy, 'forbid_domain_plugin_skill_mirrors');
  assert.equal(policy.agent_installation_contract.plugin_registration_validation_command, 'npm run validate:agent-installation');
  assert.equal(policy.agent_installation_contract.plugin_registration_validation_inputs.plugin_root_flag, '--agent-root <agent_id>=<path>');
  assert.equal(policy.agent_installation_contract.plugin_registration_validation_inputs.codex_skills_root_flag, '--codex-skills-root <path>');
  assert.equal(policy.agent_installation_contract.plugin_registration_validation_inputs.default_live_codex_skills_root, '~/.codex/skills');
  assert.deepEqual(policy.agent_installation_contract.plugin_registration_validation_inputs.validated_output_fields, [
    'validated_plugin_roots',
    'validated_codex_skills_root',
  ]);
  assert.deepEqual(policy.agent_installation_contract.managed_agent_pack_distribution.fallback_source_order, [
    'bundled_full_runtime_modules',
    'app_cli_managed_ghcr_opl_packages_channel',
    'explicit_developer_checkout_override',
  ]);
  assert.equal(policy.agent_installation_contract.managed_agent_pack_distribution.must_not_depend_on_fixed_version_tag_by_default, true);
  assert.equal(
    policy.agent_installation_contract.managed_agent_pack_distribution.github_packages_unavailable_policy,
    'fail_closed_with_actionable_background_maintenance_error',
  );

  const installAgentById = new Map(policy.agent_installation_contract.agents.map((entry) => [entry.agent_id, entry]));
  for (const agentId of ['mas', 'mag', 'rca']) {
    const entry = installAgentById.get(agentId);
    assert.equal(entry.plugin_registry_required, true);
    assert.equal(entry.direct_skill_compatibility_required, true);
    assert.equal(entry.plugin_must_package_skill, true);
    assert.equal(entry.must_not_create_second_semantics, true);
    assert.equal(entry.sync_command, 'opl connect sync-skills');
    assert.equal(entry.product_entry_manifest, 'family-product-entry-manifest-v2');
    assert.equal(entry.canonical_metadata_source, 'domain_action_catalog_and_stage_control_plane');
    assert.equal(entry.codex_visible_entry, agentId);
  }
  assert.equal(installAgentById.get('oma').plugin_registry_required, true);
  assert.equal(installAgentById.get('oma').preferred_distribution, 'opl_generated_codex_plugin_surface');
  assert.equal(installAgentById.get('oma').canonical_metadata_source, 'opl_generated_interface_contract_pack');
  assert.equal(installAgentById.get('bookforge').plugin_registry_required, true);
  assert.equal(installAgentById.get('bookforge').preferred_distribution, 'opl_generated_codex_plugin_surface');
  assert.equal(installAgentById.get('bookforge').canonical_metadata_source, 'opl_generated_interface_contract_pack');
  assert.equal(policy.temporal_auto_configuration.provider_env_default, 'OPL_FAMILY_RUNTIME_PROVIDER=temporal');
  assert.deepEqual(policy.temporal_auto_configuration.local_service_defaults, {
    address_env: 'OPL_TEMPORAL_ADDRESS',
    default_address: '127.0.0.1:7233',
    namespace_env: 'OPL_TEMPORAL_NAMESPACE',
    default_namespace: 'default',
    task_queue_env: 'OPL_TEMPORAL_TASK_QUEUE',
    default_task_queue: 'opl-stage-attempts',
  });
  assert.deepEqual(policy.temporal_auto_configuration.managed_commands, [
    'opl family-runtime service start --provider temporal',
    'opl family-runtime worker status --provider temporal',
    'opl family-runtime worker start --provider temporal',
    'opl family-runtime residency proof --provider temporal --production',
  ]);
  assert.deepEqual(policy.temporal_auto_configuration.auto_configuration_entrypoints, [
    'opl install',
    'opl system initialize --json',
    'opl system startup-maintenance',
  ]);
  assert.deepEqual(policy.temporal_auto_configuration.startup_maintenance_policy, {
    must_export_local_defaults_before_provider_checks: true,
    must_surface_service_worker_and_dependency_diagnostics: true,
    must_not_block_ready_to_launch_on_worker_residency: true,
    must_fail_closed_when_packaged_temporal_payload_is_missing: true,
  });
  assert.equal(policy.temporal_auto_configuration.first_run_policy.ready_to_launch_blocking, false);
  assert.equal(policy.setup_flow_contract.first_conversation_readiness.gate, 'acp_warmup_before_initial_send');
  assert.deepEqual(policy.setup_flow_contract.first_conversation_readiness.must_wait_for, [
    'conversation_record_ready',
    'acp_warmup_complete',
  ]);
});

test('runtime toolchain auto-update stays silent and does not mutate global tools', () => {
  const policy = readInstallExposurePolicy();
  const runtimeUpdate = policy.runtime_toolchain_auto_update;

  assert.equal(runtimeUpdate.owner, 'one-person-lab-app');
  assert.equal(runtimeUpdate.producer_owner, 'one-person-lab');
  assert.equal(runtimeUpdate.framework_role, 'apply_verified_staged_runtime_during_startup_maintenance');
  assert.equal(runtimeUpdate.entrypoint, 'opl system startup-maintenance');
  assert.equal(runtimeUpdate.ready_to_launch_blocking, false);
  assert.deepEqual(runtimeUpdate.default_policy, {
    auto_check: true,
    download: 'silent_background',
    stage: 'verify_then_stage_app_owned_runtime',
    apply: 'next_app_restart',
    rollback: 'previous_runtime_pointer_on_startup_smoke_failure',
  });
  assert.deepEqual(runtimeUpdate.managed_components, [
    'codex_cli_fallback',
    'temporal_cli_archive',
    'node_runtime',
    'python_runtime',
    'uv_runtime',
    'officecli',
    'mineru_open_api',
    'companion_skills',
    'native_helper',
    'opl_framework_runtime',
  ]);
  assert.deepEqual(runtimeUpdate.user_global_tool_policy, {
    prefer_compatible_newer_system_tool: true,
    silent_homebrew_upgrade_allowed: false,
    silent_system_tool_mutation_allowed: false,
    opt_in_global_upgrade_surface: 'Developer Profile explicit maintenance action',
  });
  assert.deepEqual(runtimeUpdate.clean_machine_requirement, {
    full_first_install_must_remain_self_contained: true,
    required_release_smoke: 'full_dmg_clean_vm_smoke',
    standard_core_ready_must_not_require_homebrew_node_git_or_clt: true,
  });
  assert.deepEqual(runtimeUpdate.fail_closed_states, [
    'runtime_update_manifest_invalid',
    'runtime_update_asset_sha256_mismatch',
    'runtime_update_capability_smoke_failed',
    'runtime_update_startup_smoke_failed',
  ]);
});

test('Homebrew distribution channel is transport-only and keeps OPL activation authoritative', () => {
  const policy = readInstallExposurePolicy();
  const homebrew = policy.distribution_channels.homebrew;

  assert.equal(homebrew.role, 'app_cask_transport_and_install_index_only');
  assert.equal(homebrew.tap, 'gaofeng21cn/one-person-lab');
  assert.equal(homebrew.cask_install_policy.fully_qualified_cask_install, true);
  assert.equal(homebrew.must_not_own_agent_semantics, true);
  assert.equal(homebrew.must_not_write_user_codex_state, true);
  assert.equal(homebrew.user_state_activation_owner, 'opl_framework');
  assert.deepEqual(homebrew.activation_commands, ['opl connect reconcile-modules', 'opl connect sync-skills']);
  assert.deepEqual(homebrew.formulae, {});
  assert.deepEqual(homebrew.casks, {
    standard_app: 'one-person-lab',
    nightly_standard_app: 'one-person-lab-nightly',
    full_first_install_app: 'one-person-lab-full',
  });
  assert.deepEqual(homebrew.allowed_user_targets, [
    'Casks/one-person-lab.rb',
    'Casks/one-person-lab-nightly.rb',
    'Casks/one-person-lab-full.rb',
  ]);
  assert.deepEqual(homebrew.initial_live_targets, [
    'Casks/one-person-lab.rb',
    'Casks/one-person-lab-nightly.rb',
    'Casks/one-person-lab-full.rb',
  ]);
  assert.deepEqual(homebrew.forbidden_formulae, ['one-person-lab-modules', 'one-person-lab-modules-nightly']);
  assert.deepEqual(homebrew.full_first_install_cask, {
    name: 'one-person-lab-full',
    target: 'Casks/one-person-lab-full.rb',
    asset: 'One-Person-Lab-Full-<version>-mac-arm64.dmg',
    manifest: 'full-package-manifest.json',
    standard_updater_visible: false,
    stable_only: true,
  });
  assert.equal(homebrew.agent_pack_policy.package_kind, 'app_cli_managed_opl_packages');
  assert.deepEqual(homebrew.agent_pack_policy.managed_agent_ids, ['mas', 'mag', 'rca', 'oma', 'obf', 'scholarskills']);
  assert.equal(homebrew.agent_pack_policy.homebrew_distribution_allowed, false);
  assert.equal(homebrew.agent_pack_policy.user_visible_formula_allowed, false);
  assert.equal(homebrew.agent_pack_policy.activation_policy, 'app_cli_managed_background_maintenance');
  assert.deepEqual(homebrew.agent_pack_policy.maintenance_commands, ['opl connect reconcile-modules', 'opl connect sync-skills']);
});
