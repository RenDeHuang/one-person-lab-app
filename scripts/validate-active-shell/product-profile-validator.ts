import path from 'node:path';
import { assertDeepEqualJson, assertForbiddenCapabilityPolicy, assertIncludesAll, readJson } from './assertions.ts';
import {
  appOwnedHomeLayout,
  firstRunModelAccessSetupPolicy,
  forbiddenAuthorityOwners,
  focusedFirstRunPresentationPolicy,
  progressiveFirstRunRecoveryPolicy,
} from './app-contract-constants.ts';
import {
  defaultActiveShellContractPath,
  firstRunMatrixPath,
  installExposurePolicyPath,
  pageStateMatrixPath,
  root,
  settingsControlPlanePath,
  assertFile,
} from './validation-config.ts';
import {
  assertNonEmptyStringArray,
  assertFirstRunProgressModelShape,
  validateBeginnerFirstRunPresentation,
  validateOplFlowContext,
} from './shared-contract-validators.ts';
import { validateScheduledTasksProfileProjection } from './scheduled-tasks-policy-validator.ts';
import { validateSettingsControlPlaneBehavior } from './settings-control-plane-validator.ts';
import { assertDefaultCodexSessionProfile } from '../app-product-profile-default-session.ts';
import { assertAppProductProfileIdentity } from '../app-product-profile-identity.ts';
import {
  assertAgentReferenceAdmissionPolicy,
  assertAppProductProfileCodexModelDisplayOptions,
  assertAppProductProfileGuiAuthority,
  assertAppProductProfileGuiInteractionBaseline,
  assertAppProductProfileHomeCodexPolicy,
  assertAppProductProfileSettingsVisualSystem,
  assertCapabilityReferenceListShape,
  assertHomeComposerStateContract,
  assertOfficialProfileShape,
} from '../app-product-profile-shared-validators.ts';

const ordinaryForbiddenCapabilityPolicy = {
  forbidden_mcp_matchers: {
    exact: ['aionui-team'],
    prefixes: ['team_', 'mcp__aionui-team'],
    contains: ['aionui-team'],
  },
  scrub_extra_keys: [
    'team_mcp_stdio_config',
    'team_id',
    'teamId',
    'team_lead_team_id',
    'team_lead_team_slot_id',
    'team_lead_conversation_id',
    'tl',
  ],
};

const dynamicHomeComposerAuthority = {
  shortcut_package_membership_source_ref:
    'app_state.agent_packages.directory.entries[package_role=standard_agent,installed=true]',
  shortcut_preference_source_ref:
    'app_state.agent_packages.status_index.home_shortcut_preferences[]',
  shortcut_availability_source_ref:
    'app_state.agent_packages.directory.entries + app_state.agent_packages.status_index.packages[].presence',
  unknown_standard_agent_allowed: true,
};

function validateDynamicHomeComposerStateContract(value, label) {
  const {
    shortcut_package_membership_source_ref,
    shortcut_preference_source_ref,
    shortcut_availability_source_ref,
    unknown_standard_agent_allowed,
  } = value ?? {};
  assertDeepEqualJson(
    {
      shortcut_package_membership_source_ref,
      shortcut_preference_source_ref,
      shortcut_availability_source_ref,
      unknown_standard_agent_allowed,
    },
    dynamicHomeComposerAuthority,
    `${label} dynamic authority`,
  );
  assertHomeComposerStateContract(value, label);
}

const requiredHostTools = [
  'command_line_tools',
  'homebrew',
  'node',
  'git',
];
const fullReadinessItems = [
  'domain_modules',
  'family_runtime_provider',
  'recommended_skills',
  'native_helpers',
  'repo_sync',
  'command_line_tools_install',
  'ecosystem_module_updates',
];
const deferredMaintenanceItems = [
  'repo_sync',
  'module_reconcile',
  'command_line_tools_install',
  'native_helpers',
  'companion_skills_install',
  'ecosystem_module_updates',
];
function validateProductProfileIdentity(profile) {
  assertAppProductProfileIdentity(profile, 'product profile');
}

function validateProductProfileContractRefs(profile) {
  for (const [label, expected] of Object.entries({
    active_shell: defaultActiveShellContractPath,
    page_state: pageStateMatrixPath,
    first_run: firstRunMatrixPath,
    install_exposure: installExposurePolicyPath,
    settings_control_plane: settingsControlPlanePath,
  })) {
    const value = profile.contract_refs?.[label];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Product profile missing contract_refs.${label}`);
    }
    assertFile(path.join(root, value), `product profile ${label} contract ref`);
    if (path.resolve(root, value) !== path.resolve(expected)) {
      throw new Error(`Unexpected product profile contract_refs.${label}: ${value}`);
    }
  }
}

function validateProductProfileCodexDefaults(profile) {
  if (
    profile.codex?.app_runtime_home?.default_path !== '~/.codex' ||
    profile.codex.app_runtime_home.override_env !== 'CODEX_HOME' ||
    profile.codex.app_runtime_home.resolution_policy !== 'preserve_existing_env_else_codex_system_default' ||
    profile.codex.app_runtime_home.app_env_injection !== 'forbidden' ||
    profile.codex.app_runtime_home.startup_and_recheck_mutation !== 'forbidden' ||
    profile.codex.app_runtime_home.explicit_model_access_mutation !==
      'framework_action_atomic_merge_with_backup_and_restore'
  ) {
    throw new Error('Product profile must preserve the system Codex home without App environment injection');
  }
  if (
    profile.codex.auto_model_policy?.recommendation_authority !== 'opl-flow' ||
    profile.codex.auto_model_policy.policy_source_ref !==
      'app_state.agent_packages.status_index.packages.opl-flow.model_projection' ||
    profile.codex.auto_model_policy.projection_surface_kind !== 'opl_codex_model_policy_projection.v1' ||
    profile.codex.auto_model_policy.projection_presence_rule !==
      'consume_only_when_fresh_opl_flow_presence_installed_true_and_projection_is_valid' ||
    JSON.stringify(profile.codex.auto_model_policy.resolution_precedence) !== JSON.stringify([
      'explicit_user_selection',
      'installed_opl_flow_recommendation',
      'fresh_codex_live_default',
      'app_fallback_when_flow_unavailable',
    ]) ||
    profile.codex.auto_model_policy.app_fallback_role !==
      'configured_default_is_used_only_when_flow_projection_is_absent_invalid_or_unavailable_and_catalog_cannot_resolve' ||
    profile.codex.auto_model_policy.configured_default_role !==
      'app_fallback_not_flow_recommendation_authority'
  ) {
    throw new Error('Product profile model policy must use user, installed Flow, live Codex, then App fallback precedence');
  }
  validateOplFlowContext(profile.codex?.opl_flow_context, 'Product profile OPL Flow Context');
  const additionalInstructions = profile.codex?.new_conversation_additional_instructions;
  if (
    additionalInstructions?.content_owner !== 'user' ||
    additionalInstructions.delivery !== 'new_conversation_additional_instructions_only' ||
    additionalInstructions.storage_key !== 'codex.oplAppSessionContextAdditional' ||
    additionalInstructions.storage_key_status !== 'legacy_compatibility_storage_key' ||
    additionalInstructions.generated_base_context_allowed !== false ||
    additionalInstructions.agent_route_fallback_allowed !== false ||
    additionalInstructions.empty_value_policy !== 'inject_nothing' ||
    additionalInstructions.reset_behavior !== 'clear_additional_instructions' ||
    additionalInstructions.effect !== 'next_new_conversation'
  ) {
    throw new Error('Product profile must limit new-conversation additions to optional user-authored text');
  }
  for (const field of [
    'opl_app_session_context',
    'default_visible_skills',
    'skill_priority',
    'session_context_lines',
    'session_context_i18n',
  ]) {
    if (field in profile.codex) {
      throw new Error(`Product profile must not restore legacy Codex authority codex.${field}`);
    }
  }
  assertDefaultCodexSessionProfile(profile, { label: 'product profile', requireLiteralDefaults: true });
  assertAppProductProfileGuiAuthority(profile, 'Product profile');
  assertAppProductProfileGuiInteractionBaseline(profile, 'Product profile');
  assertAppProductProfileSettingsVisualSystem(profile, 'Product profile');
  assertAppProductProfileHomeCodexPolicy(profile, 'Product profile');
  assertAppProductProfileCodexModelDisplayOptions(profile, 'Product profile');
  validateDynamicHomeComposerStateContract(profile.gui?.home?.home_composer_state_contract, 'Product profile Home composer state contract');
  validateUiLocalePolicy(profile);
  validateHomeAssistantDefaults(profile);
  validateProductProfileSettings(profile);
  validateProductProfileCodexSkills(profile);
  validateInstallUpdateTaxonomy(profile);
  validateOrdinaryCapabilitySelectorPolicy(profile);
}

function validateUiLocalePolicy(profile) {
  const policy = profile.gui?.ui_locale_policy;
  if (
    policy?.explicit_user_preference !== 'preserve_across_launches' ||
    policy?.first_launch_without_preference !== 'detect_system_locale_before_first_render' ||
    policy?.supported_normalization !== 'zh_to_zh-CN_else_en-US' ||
    policy?.startup_must_not_overwrite_explicit_preference !== true
  ) {
    throw new Error('Product profile locale policy must detect the system language before first render while preserving explicit preferences');
  }
}

function validateHomeAssistantDefaults(profile) {
  const homeLayout = profile.gui.home.home_layout;
  if (
    homeLayout?.default_active_shortcut !== null ||
    homeLayout?.shortcut_selection_policy !==
      'explicit_user_or_navigation_selection_only_no_saved_preset_restore_and_never_disabled_by_launch_readiness' ||
    homeLayout?.starter_item_width_policy !== 'content_sized' ||
    homeLayout?.starter_count_layout_policy !== 'center_actual_visible_count_and_wrap_without_navigation_chevrons' ||
    homeLayout?.desktop_composer_max_width_px !== 736 ||
    homeLayout?.desktop_composer_min_height_px !== 98 ||
    homeLayout?.desktop_composer_corner_radius_px !== 22 ||
    homeLayout?.desktop_context_bar_height_px !== 52 ||
    homeLayout?.desktop_context_bar_overlap_px !== 13 ||
    homeLayout?.desktop_context_bar_horizontal_inset_px !== 12 ||
    homeLayout?.workspace_selector_visible !== true ||
    homeLayout?.workspace_selector_entry !== 'home.new_session_context_bar' ||
    homeLayout?.unselected_workspace_control_visible !== true ||
    homeLayout?.unselected_workspace_control_policy !==
      'localized_choose_project_directory_action_not_projectless_status_placeholder' ||
    homeLayout?.selected_working_directory_visual_policy !==
      'independent_new_session_context_bar_control_with_selected_directory_and_clear_action' ||
    homeLayout?.selected_starter_visual_policy !==
      'quiet_fill_with_aria_pressed_without_trailing_selection_glyph' ||
    homeLayout?.selected_starter_accessibility_state !== 'aria_pressed_reflects_active_shortcut'
  ) {
    throw new Error('Product profile Home must default to the base executor and require explicit professional-agent selection');
  }
  assertDeepEqualJson(
    homeLayout.workspace_selector_policy,
    appOwnedHomeLayout.workspace_selector_policy,
    'Product profile Home workspace selector session ownership policy',
  );
  const iconPolicy = profile.gui.home.utility_icon_policy;
  if (
    iconPolicy?.library !== 'icon_park_react_for_opl_owned_utility_icons' ||
    iconPolicy?.opl_owned_settings_navigation_and_overview !== 'icon_park_react_outline_16px_monochrome' ||
    iconPolicy?.settings_icon_geometry !==
      'stable_16px_slot_1_5_to_1_75px_visual_stroke_no_colored_tile_or_letter_avatar' ||
    JSON.stringify(iconPolicy?.icon_text_action_geometry) !==
      JSON.stringify({
        icon_size_px: 16,
        icon_slot_px: 20,
        icon_color: 'currentColor',
        icon_background: 'transparent_none',
        icon_label_gap_px: 8,
        alignment: 'icon_slot_and_label_share_one_vertical_centerline',
        contrast_policy: 'button_foreground_color_applies_to_icon_and_label_together',
        disabled_policy: 'apply_disabled_opacity_to_the_whole_control_never_hide_only_the_icon',
      }) ||
    iconPolicy?.upstream_fork_body_bulk_icon_rewrite !== 'forbidden' ||
    iconPolicy?.refresh_actions !== 'icon_only_with_tooltip_and_accessible_name' ||
    iconPolicy?.model_reasoning_control !== 'text_and_disclosure_without_brain_icon' ||
    JSON.stringify(iconPolicy?.account_identity_avatar) !==
      JSON.stringify({
        shape: 'circle',
        background: 'semantic_success_green',
        foreground: 'inverse',
        han_name_initials: 'first_han_character_only',
        non_han_name_initials: 'first_letters_of_first_two_words_uppercase_else_first_two_codepoints',
        email_fallback_initials: 'first_two_local_part_codepoints_uppercase',
        empty_fallback: 'OP',
      }) ||
    iconPolicy?.global_feedback_action?.placement !== 'titlebar_trailing_utility' ||
    iconPolicy?.global_feedback_action?.icon !== 'circle_question' ||
    iconPolicy?.global_feedback_action?.icon_style !== 'regular_outline' ||
    iconPolicy?.global_feedback_action?.target_url !==
      'https://github.com/gaofeng21cn/one-person-lab-app/issues/new' ||
    iconPolicy?.global_feedback_action?.open_mode !== 'external_browser_user_review_and_submit' ||
    JSON.stringify(iconPolicy?.global_feedback_action?.prefill_fields) !==
      JSON.stringify(['localized_title', 'localized_body', 'current_route', 'app_release_version']) ||
    JSON.stringify(iconPolicy?.global_feedback_action?.startup_failure_action) !==
      JSON.stringify({
        placement: 'blocking_startup_failure_dialog',
        delivery_channel: 'electron_main_process_native_open_external_via_preload_ipc',
        backend_dependency: 'none',
        submission_policy: 'external_browser_user_review_and_submit',
        automatic_submission: false,
        prefill_fields: [
          'localized_title',
          'localized_body',
          'app_release_version',
          'platform',
          'architecture',
          'startup_failure_reason',
          'backend_boundary_code',
          'backend_boundary_stage',
        ],
        automatic_attachment_policy: 'forbidden_no_logs_paths_credentials_or_user_content',
      }) ||
    iconPolicy?.global_feedback_action?.shell_local_delivery_forbidden !== true
  ) {
    throw new Error('Product profile OPL utility icons must include the App-owned GitHub feedback action');
  }
  if ('home_agent_shortcuts' in profile.gui.home) {
    throw new Error('Product profile must not restore an App-owned Home shortcut list');
  }
  for (const field of [
    'default_assistants',
    'non_default_assistants',
    'professional_agent_packages',
    'professional_agent_packages_metadata_policy',
  ]) {
    if (field in profile.gui) {
      throw new Error(`Product profile must not restore fixed Agent/Home presentation field gui.${field}`);
    }
  }
  if ('home_purpose_entries' in profile.gui.home) {
    throw new Error('Product profile must not restore fixed Agent/Home presentation field gui.home.home_purpose_entries');
  }
  if (
    homeLayout?.home_presentation_source_ref !==
    'app_state.agent_packages.directory.entries[package_role=standard_agent,installed=true] + app_state.agent_packages.status_index.home_shortcut_preferences[]'
  ) {
    throw new Error('Product profile Home presentation must come from the dynamic Agent directory and shortcut compatibility metadata');
  }
  for (const retiredModel of [
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex',
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ]) {
    if (!profile.gui.home?.retired_codex_models_must_not_be_exposed?.includes(retiredModel)) {
      throw new Error(`Product profile GUI home must ban retired Codex model ${retiredModel}`);
    }
  }
}

function validateAgentPackageRegistryProjection(profile) {
  const projection = profile.gui?.agent_package_registry;
  if (
    projection?.directory_projection_authority !== 'app_state.agent_packages.directory.entries' ||
    projection?.status_projection_authority !== 'app_state.agent_packages.status_index' ||
    projection?.action_projection_authority !==
      'app_state.agent_packages.directory.entries[].available_actions[] + app_state.actions' ||
    projection?.presentation_source !== 'app_state.agent_packages.directory.entries' ||
    projection?.unknown_package_policy !== 'render_without_app_package_id_branch' ||
    projection?.manifest_lock_receipt_parser_allowed !== false ||
    projection?.action_id_allowlist_allowed !== false ||
    projection?.shell_consumption_policy !== 'generated_product_profile_only_no_renderer_literal'
  ) {
    throw new Error('Product profile must consume generic Framework Package projections without private metadata or lifecycle parsers');
  }
  for (const forbiddenField of [
    'starter_package_metadata',
    'first_party_manifest_fixture_dir',
    'external_registry_policy_ref',
    'directory_lifecycle_authority',
  ]) {
    if (forbiddenField in projection) {
      throw new Error(`Product profile must not restore private Package consumer field ${forbiddenField}`);
    }
  }
  const presentation = projection.catalog_presentation_policy;
  assertDeepEqualJson(
    presentation?.section_order,
    ['professional_agents', 'capability_packages', 'workflow_profiles', 'other_packages'],
    'Product profile Agent catalog section order',
  );
  if (
    presentation?.professional_agent_order_source !==
      'app_state.agent_packages.status_index.home_shortcut_preferences[]' ||
    presentation?.professional_agent_order_policy !==
      'sort_standard_agent_directory_entries_by_user_sort_order_then_localized_display_name' ||
    presentation?.workflow_profile_policy !==
      'render_in_a_separate_workflow_section_not_mixed_with_runnable_agents' ||
    JSON.stringify(presentation?.package_role_labels_i18n) !==
      JSON.stringify({
        standard_agent: { 'zh-CN': '专业智能体', 'en-US': 'Professional agent' },
        capability_package: { 'zh-CN': '能力包', 'en-US': 'Capability package' },
        workflow_profile: { 'zh-CN': '工作流配置', 'en-US': 'Workflow profile' },
      }) ||
    presentation?.raw_package_role_visible !== false ||
    presentation?.dependency_hierarchy?.source !==
      'app_state.agent_packages.status_index.packages[].dependent_guard.required_by_package_ids' ||
    presentation?.dependency_hierarchy?.direction !==
      'a_package_with_one_visible_required_by_package_id_is_nested_under_that_parent_package' ||
    presentation?.dependency_hierarchy?.single_parent_policy !==
      'render_once_as_a_compact_child_row_under_the_visible_parent' ||
    presentation?.dependency_hierarchy?.multiple_parent_policy !==
      'render_once_in_capability_packages_with_localized_parent_labels' ||
    presentation?.dependency_hierarchy?.missing_or_invisible_parent_policy !==
      'render_once_in_capability_packages' ||
    presentation?.dependency_hierarchy?.hardcoded_package_relationships_allowed !== false ||
    presentation?.dependency_hierarchy?.duplicate_rows_allowed !== false ||
    presentation?.dependency_hierarchy?.status_and_actions_source !==
      'unchanged_Framework_directory_and_status_index_projection' ||
    presentation?.developer_controls_disclosure?.default_state !== 'collapsed' ||
    JSON.stringify(presentation?.developer_controls_disclosure?.contains) !==
      JSON.stringify([
        'global_runtime_source',
        'authorized_repository_maintenance',
        'workspace_and_repository_protection_summary',
      ]) ||
    presentation?.developer_controls_disclosure?.ordinary_catalog_remains_visible_when_collapsed !== true
  ) {
    throw new Error('Product profile Agent catalog must use localized product ordering and projected dependency hierarchy');
  }
}

function validateProductProfileSettings(profile) {
  validateSettingsControlPlaneBehavior({ productProfile: profile });
  const queryFreeControlPlaneRedirects = Object.fromEntries(
    Object.entries(profile.settings.control_plane.legacy_route_redirects ?? {})
      .filter(([id]) => id !== 'about')
      .map(([id, target]) => [id, String(target).split('?')[0]]),
  );
  assertDeepEqualJson(
    profile.settings?.visible_tabs,
    profile.settings.control_plane.ordinary_visible_tabs,
    'Product profile ordinary settings visible tabs',
  );
  assertDeepEqualJson(
    profile.settings?.legacy_route_redirects,
    queryFreeControlPlaneRedirects,
    'Product profile legacy settings route redirects',
  );
  if (
    profile.settings?.control_plane?.source_contract_ref !==
    'contracts/app-gui-product-contract.json#settings_navigation'
  ) {
    throw new Error('Product profile settings.control_plane must project the App Settings control plane');
  }
  assertDeepEqualJson(
    profile.settings.control_plane.ordinary_visible_tabs,
    profile.settings?.visible_tabs,
    'Product profile settings.control_plane ordinary tabs',
  );
  assertDeepEqualJson(
    profile.settings.control_plane.ordinary_routes?.map((route) => route.id),
    profile.settings.control_plane.ordinary_visible_tabs,
    'Product profile settings.control_plane ordinary route ids',
  );
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(profile.settings.control_plane.legacy_route_redirects ?? {})
        .filter(([id]) => id !== 'about')
        .map(([id, target]) => [id, String(target).split('?')[0]]),
    ),
    profile.settings?.legacy_route_redirects,
    'Product profile settings.control_plane legacy redirects',
  );
}

function validateProductProfileCodexSkills(profile) {
  for (const forbidden of [
    'tools',
    'ecosystem_modules',
    'management_authority',
    'upstream_packages',
    'official_codex_runtime_capabilities',
    'default_packaged_codex_skill_ids',
    'additional_package_skill_ids',
    'domain_plugin_skill_ids',
  ]) {
    if (forbidden in (profile.companion_payloads ?? {})) {
      throw new Error(`Product profile must not own capability inventory through companion_payloads.${forbidden}`);
    }
  }
}

function validateInstallUpdateTaxonomy(profile) {
  assertDeepEqualJson(
    profile.install_update_taxonomy?.public_software_objects,
    ['opl_base', 'opl_app', 'opl_packages'],
    'Product profile public software objects',
  );
  assertDeepEqualJson(
    profile.install_update_taxonomy?.managed_update_component_keys,
    ['opl_base', 'opl_app', 'opl_packages'],
    'Product profile managed update component keys',
  );
  assertDeepEqualJson(
    profile.install_update_taxonomy?.transaction_internal_state_ids,
    ['runtime_substrate', 'capability_packages', 'companion_tools', 'codex_surface', 'workflow_profile'],
    'Product profile transaction internal state ids',
  );
  assertDeepEqualJson(
    profile.install_update_taxonomy?.ordinary_ui_must_not_expose_as_peer_objects,
    [
      'app_binary',
      'runtime_toolchain',
      'agent_package_channel',
      'capability_exposure',
      'codex_cli_fallback',
      'runtime_substrate',
      'capability_packages',
      'companion_tools',
      'codex_surface',
      'workflow_profile',
    ],
    'Product profile forbidden peer software objects',
  );
  assertDeepEqualJson(
    profile.install_update_taxonomy?.internal_detail_fields,
    {
      opl_base: ['dependency_status', 'integration_status'],
      opl_app: ['host_update_route', 'host_executor_required'],
      opl_packages: ['projection_status', 'profile_migration_status'],
    },
    'Product profile managed update internal detail fields',
  );
  if (profile.install_update_taxonomy?.ordinary_component_picker_allowed !== false) {
    throw new Error('Product profile ordinary component picker must be disabled');
  }
  if (
    profile.companion_payloads?.class !== 'opl_base_integrations' ||
    profile.companion_payloads?.opl_packages_projection_ref !== 'contracts/app-install-exposure-policy.json#exposure_classes.codex_surface' ||
    profile.companion_payloads?.opl_packages_lifecycle_ref !==
      'contracts/app-install-exposure-policy.json#agent_installation_contract.managed_package_distribution'
  ) {
    throw new Error('Product profile payloads must map Base integrations and Packages projection/lifecycle without peer updater classes');
  }
}

function validateOrdinaryCapabilitySelectorPolicy(profile) {
  const policy = profile.gui?.ordinary_capability_selector_policy;
  if (
    policy?.scope !== 'home_composer_and_ordinary_conversation' ||
    policy?.authority !== 'owner_or_carrier_skill_projection_and_mcp_negative_filter' ||
    policy?.palette_agent_catalog_source_ref !==
      'app_state.agent_packages.directory.entries[package_role=standard_agent]' ||
    policy?.palette_agent_status_source_ref !== 'app_state.agent_packages.status_index.packages[]' ||
    policy?.palette_agent_availability_policy !==
      'join_by_package_id_and_use_fresh_directory_installed_plus_status_index_presence.present_and_presence.callable' ||
    policy?.palette_agent_action_policy !== 'directory_available_actions_and_recommended_action_ref_only' ||
    policy?.palette_unknown_standard_agent_policy !== 'include_without_app_package_id_branch' ||
    policy?.palette_required_agent_package_ids !== undefined ||
    JSON.stringify(policy?.palette_agent_group_label_i18n) !==
      JSON.stringify({ 'zh-CN': '专业智能体', 'en-US': 'Professional agents' }) ||
    policy?.palette_home_shortcut_independence_policy !==
      'complete_professional_agent_catalog_independent_of_home_shortcut_visibility_and_order' ||
    policy?.agent_owned_skill_deduplication_policy !==
      'exclude_rendered_professional_agent_required_skill_ids_from_home_new_session_standalone_skills' ||
    policy?.skill_source_ref !== 'owner_or_carrier_projected_capability_metadata_for_the_selected_package' ||
    policy?.conversation_loaded_skill_display_policy !==
      'preserve_owner_or_carrier_projected_loaded_skills' ||
    policy?.mcp_server_source_ref !== 'configured_user_and_third_party_mcp_servers' ||
    policy?.mcp_menu_policy !==
      'preserve_configured_user_and_third_party_servers_except_explicit_forbidden_matchers' ||
    policy?.conversation_loaded_mcp_display_policy !== 'preserve_non_forbidden_configured_servers' ||
    policy?.unmatched_mcp_policy !== 'preserve_end_to_end_without_app_allowlist_membership' ||
    Object.prototype.hasOwnProperty.call(policy, 'forbidden_skill_examples')
  ) {
    throw new Error('Product profile ordinary selector must use owner/carrier Skill projection and the MCP negative filter');
  }
  assertAgentReferenceAdmissionPolicy(
    policy.agent_reference_admission_policy,
    'Product profile Agent reference admission policy',
  );
  assertForbiddenCapabilityPolicy(
    policy,
    ordinaryForbiddenCapabilityPolicy,
    'Product profile ordinary forbidden MCP policy',
  );
  assertDeepEqualJson(
    policy.required_scrub_targets,
    [
      'mcp_servers entries matching forbidden_mcp_matchers',
      'mcp_statuses entries matching forbidden_mcp_matchers',
      'session_mcp_servers entries matching forbidden_mcp_matchers',
      'scrub_extra_keys',
    ],
    'Product profile ordinary Team scrub targets',
  );
  assertDeepEqualJson(
    policy.required_preservation_targets,
    [
      'mcp directory entries not matching forbidden_mcp_matchers',
      'mcp status entries not matching forbidden_mcp_matchers',
      'new conversation create payload mcp_servers not matching forbidden_mcp_matchers',
      'conversation snapshot mcp_servers and mcp_statuses not matching forbidden_mcp_matchers',
    ],
    'Product profile ordinary MCP preservation targets',
  );
  if (policy.conversation_snapshot_policy !== 'scrub_disabled_team_mcp_and_team_metadata_before_rendering_or_inheriting_ordinary_conversations') {
    throw new Error('Product profile ordinary selector must scrub disabled Team MCP snapshots');
  }
}

function validateFullFirstInstallCoreReadyPolicy(profile) {
  if (JSON.stringify(profile.first_run?.readiness_layers) !== JSON.stringify(['core'])) {
    throw new Error('Product profile ready_to_launch readiness_layers must contain only core');
  }
  const firstRunCoreItems = assertNonEmptyStringArray(
    profile.first_run?.ready_to_launch_gate?.required_core_items,
    'Product profile ready_to_launch required_core_items',
  );
  validateBeginnerFirstRunPresentation(
    profile.first_run?.beginner_presentation,
    'Product profile first-run beginner presentation',
    firstRunCoreItems,
  );
  for (const [field, expected] of Object.entries(focusedFirstRunPresentationPolicy)) {
    if (profile.first_run?.beginner_presentation?.[field] !== expected) {
      throw new Error(
        `Product profile first-run beginner presentation ${field} must be ${expected}`,
      );
    }
  }
  assertDeepEqualJson(
    profile.first_run?.beginner_presentation?.model_access_setup,
    firstRunModelAccessSetupPolicy,
    'Product profile first-run model access setup policy',
  );
  validateReadyToLaunchGate(profile, firstRunCoreItems);
  validateOfficialProfileFirstInstallPolicy(profile);
  validateFirstConversationPolicy(profile);
  validateFullFirstInstallBackgroundPolicy(profile);
  validateFirstRunProgressModel(profile);
}

function validateOfficialProfileFirstInstallPolicy(profile) {
  const execution = profile.official_profile?.first_install_execution;
  if (
    execution?.mode !== 'background_after_core_ready'
    || execution?.guid_navigation_blocking !== false
    || execution?.failure_scope !== 'package_local_nonblocking'
    || execution?.unknown_or_timeout_policy !== 'keep_guid_entry_available_and_report_background_attention'
    || execution?.retry_policy !== 'explicit_first_run_retry_or_settings_agents'
  ) {
    throw new Error('Product profile Official Profile first-install execution must remain background and non-blocking after Core ready');
  }
}

function validateReadyToLaunchGate(profile, firstRunCoreItems) {
  const launchGate = profile.first_run?.ready_to_launch_gate;
  if (
    launchGate?.id !== 'ready_to_launch' ||
    launchGate?.ui_order !== 'before_first_conversation_not_before_guid' ||
    launchGate?.guid_navigation_blocking !== false
  ) {
    throw new Error('Product profile ready_to_launch must gate first conversation without blocking /guid navigation');
  }
  for (const item of firstRunCoreItems) {
    if (!launchGate?.required_core_items?.includes(item)) {
      throw new Error(`Product profile ready_to_launch gate must require Core item ${item}`);
    }
  }
  for (const item of fullReadinessItems) {
    if (!launchGate?.must_not_require?.includes(item)) {
      throw new Error(`Product profile ready_to_launch gate must not require ${item}`);
    }
    if (!profile.first_run?.full_readiness_layers?.includes(item)) {
      throw new Error(`Product profile full readiness layers must include ${item}`);
    }
  }
  if (
    profile.first_run?.runtime_provider?.full_readiness_provider !== 'temporal'
    || profile.first_run.runtime_provider.ready_to_launch_blocking !== false
  ) {
    throw new Error('Product profile full runtime provider must stay Temporal and non-blocking for ready_to_launch');
  }
}

function validateFirstConversationPolicy(profile) {
  const firstConversation = profile.first_run?.first_conversation;
  const progressModel = profile.first_run?.progress_model;
  const firstConversationMustWaitFor = assertNonEmptyStringArray(
    firstConversation?.must_wait_for,
    'Product profile first conversation must_wait_for',
  );
  const requiredBeforePlainSend = assertNonEmptyStringArray(
    firstConversation?.required_before_plain_send,
    'Product profile first conversation required_before_plain_send',
  );
  const requiredBeforeSendWithLocalInputs = assertNonEmptyStringArray(
    firstConversation?.required_before_send_with_local_inputs,
    'Product profile first conversation required_before_send_with_local_inputs',
  );
  const requiredBeforeWorkspaceControls = assertNonEmptyStringArray(
    firstConversation?.required_before_workspace_controls,
    'Product profile first conversation required_before_workspace_controls',
  );
  if (typeof firstConversation?.failure_policy !== 'string' || !firstConversation.failure_policy.trim()) {
    throw new Error('Product profile first conversation must define a failure_policy');
  }
  assertFirstRunProgressModelShape(progressModel, 'Product profile first-run progress model');
  if (
    firstConversation?.gate !== 'capability_prerequisites_then_acp_warmup_before_initial_send' ||
    firstConversation?.runtime_readiness_method !== 'POST' ||
    firstConversation?.runtime_readiness_route !== '/api/conversations/<id>/runtime/ensure' ||
    firstConversation?.retired_route !== '/api/conversations/<id>/warmup' ||
    firstConversation?.route_failure_policy !== 'http_404_or_500_is_retryable_error_never_ready' ||
    firstConversation?.source_command !== progressModel.source_command ||
    firstConversation?.ready_to_launch_must_be_true !== false ||
    firstConversation?.unknown_readiness_policy !== 'allow_attempt_without_mutating_readiness' ||
    firstConversation?.blocked_feedback !== 'localized_inline_non_modal_setup_notice_preserves_prompt'
  ) {
    throw new Error('Product profile first conversation must apply granular prerequisites before ACP warmup');
  }
  const fullRuntimeQualification = profile.first_run?.full_runtime_package_qualification;
  if (
    fullRuntimeQualification?.source !== 'framework_resolved_selected_package_set' ||
    fullRuntimeQualification.reconciliation !== 'idempotent_selected_capability_reconciliation' ||
    fullRuntimeQualification.composition_policy !== 'open_composition_no_fixed_package_set' ||
    fullRuntimeQualification.readiness_policy !==
      'selected_capabilities_gate_only_their_dependent_features' ||
    fullRuntimeQualification.workspace_scoped_materialization_policy !==
      'package_cache_without_global_marketplace_registration_until_mas_workspace_binding' ||
    fullRuntimeQualification.global_workspace_scoped_exposure !== 'forbidden'
  ) {
    throw new Error('Product profile must enforce the Full runtime package qualification boundary');
  }
  assertDeepEqualJson(requiredBeforePlainSend, ['codex_cli', 'codex_config'], 'Product profile plain send prerequisites');
  assertDeepEqualJson(
    requiredBeforeSendWithLocalInputs,
    ['codex_cli', 'codex_config'],
    'Product profile send with local inputs prerequisites',
  );
  assertDeepEqualJson(
    requiredBeforeWorkspaceControls,
    ['workspace_root'],
    'Product profile workspace control prerequisites',
  );
  const ordinaryRecovery = profile.first_run?.ordinary_shell_recovery;
  const postLoginSetupCheck = ordinaryRecovery?.fresh_webui_login_setup_check;
  if (
    postLoginSetupCheck?.trigger !== 'successful_authenticated_webui_login_only' ||
    postLoginSetupCheck?.route_intent !== progressiveFirstRunRecoveryPolicy.fresh_webui_login_setup_check_intent ||
    postLoginSetupCheck?.state_source !== 'shared_opl_app_fast_state' ||
    postLoginSetupCheck?.known_incomplete_behavior !== 'replace_guid_with_first_run' ||
    postLoginSetupCheck?.ready_behavior !== 'keep_guid' ||
    postLoginSetupCheck?.unknown_timeout_or_read_failure_behavior !==
      progressiveFirstRunRecoveryPolicy.fresh_webui_login_unknown_policy ||
    postLoginSetupCheck?.ui_timeout_ms !== progressiveFirstRunRecoveryPolicy.fresh_webui_login_ui_timeout_ms ||
    postLoginSetupCheck?.ordinary_startup_refresh_and_deep_link_behavior !==
      'keep_guid_without_automatic_first_run' ||
    postLoginSetupCheck?.consumption_policy !== 'one_shot' ||
    ordinaryRecovery?.persistent_setup_entry?.target_route !== '/first-run' ||
    ordinaryRecovery?.persistent_setup_entry?.surface !== 'ordinary_sidebar_non_modal_entry' ||
    ordinaryRecovery?.persistent_home_composer_runtime_alert !==
      'forbidden_use_sidebar_and_send_scoped_inline_recovery_only' ||
    ordinaryRecovery?.plain_conversation?.workspace_root_required !== false ||
    ordinaryRecovery?.plain_conversation?.must_preserve_prompt !== true ||
    ordinaryRecovery?.send_scoped_local_inputs?.workspace_root_required !== false ||
    ordinaryRecovery?.workspace_controls?.plain_conversation_remains_available !== true ||
    ordinaryRecovery?.workspace_controls?.send_scoped_local_inputs_remain_available !== true ||
    ordinaryRecovery?.unknown_readiness_policy !== 'do_not_synthesize_failure_or_mutate_readiness'
  ) {
    throw new Error('Product profile ordinary shell recovery policy is invalid');
  }
  assertDeepEqualJson(
    ordinaryRecovery.plain_conversation.required_items,
    ['codex_cli', 'codex_config'],
    'Product profile ordinary plain conversation prerequisites',
  );
  assertDeepEqualJson(
    ordinaryRecovery.send_scoped_local_inputs.required_items,
    ['codex_cli', 'codex_config'],
    'Product profile ordinary send-scoped local input prerequisites',
  );
  assertDeepEqualJson(
    ordinaryRecovery.send_scoped_local_inputs.supported_inputs,
    progressiveFirstRunRecoveryPolicy.send_scoped_local_input_surfaces,
    'Product profile ordinary send-scoped local input surfaces',
  );
  assertDeepEqualJson(
    ordinaryRecovery.workspace_controls.required_items,
    ['workspace_root'],
    'Product profile ordinary workspace control prerequisites',
  );
  assertDeepEqualJson(
    ordinaryRecovery.workspace_controls.restricted_capabilities,
    progressiveFirstRunRecoveryPolicy.workspace_restricted_capabilities,
    'Product profile ordinary workspace-restricted capabilities',
  );
  assertIncludesAll(
    firstConversation.must_wait_for,
    firstConversationMustWaitFor,
    'Product profile first conversation wait-for items',
  );
  assertIncludesAll(
    firstConversation.must_not_wait_for,
    fullReadinessItems,
    'Product profile first conversation non-blocking readiness items',
  );
}

function validateFullFirstInstallBackgroundPolicy(profile) {
  const fullFirstInstall = profile.first_run?.core_ready_policy?.full_first_install_clean_machine;
  for (const tool of requiredHostTools) {
    if (!fullFirstInstall?.missing_host_tools_allowed?.includes(tool)) {
      throw new Error(`Product profile Full first-install policy must allow missing ${tool}`);
    }
  }
  if (fullFirstInstall?.initial_runtime_source !== 'bundled_runtime' || fullFirstInstall?.core_ready_without_host_tools !== true) {
    throw new Error('Product profile Full first-install must reach Core ready through bundled_runtime without host tools');
  }
  for (const blocker of deferredMaintenanceItems) {
    if (!fullFirstInstall?.must_not_block_core_ready?.includes(blocker)) {
      throw new Error(`Product profile Full first-install must not block Core ready on ${blocker}`);
    }
    if (!profile.first_run?.background_maintenance?.items?.includes(blocker)) {
      throw new Error(`Product profile background maintenance must include ${blocker}`);
    }
  }
  if (profile.first_run?.background_maintenance?.blocks_core_ready !== false) {
    throw new Error('Product profile background maintenance must not block Core ready');
  }
  if (
    profile.first_run?.background_maintenance?.mode !== 'best_effort_after_core_ready'
    || profile.first_run?.background_maintenance?.continues_after_core_ready !== true
  ) {
    throw new Error('Product profile background maintenance must continue best-effort after Core ready');
  }
  if (
    fullFirstInstall?.post_core_ready_background_policy?.mode !== 'best_effort_non_blocking'
    || fullFirstInstall?.post_core_ready_background_policy?.continues_after_core_ready !== true
  ) {
    throw new Error('Product profile Full first-install must continue best-effort maintenance after Core ready');
  }
  for (const blocker of deferredMaintenanceItems) {
    if (!fullFirstInstall?.post_core_ready_background_policy?.managed_items?.includes(blocker)) {
      throw new Error(`Product profile Full first-install post-Core maintenance must manage ${blocker}`);
    }
  }
}

function validateFirstRunProgressModel(profile) {
  assertFirstRunProgressModelShape(profile.first_run?.progress_model, 'Product profile first-run progress model');
}

function validateStandardPackagePolicy(profile) {
  const standardPackage = profile.first_run?.core_ready_policy?.standard_package;
  if (
    standardPackage?.bootstrap_owner !== 'app_managed'
    || standardPackage?.maintenance_owner !== 'app_managed'
    || standardPackage?.user_first_screen_terminal_instruction_allowed !== false
    || standardPackage?.manual_host_tool_install_terminal_state_allowed !== false
    || standardPackage?.maintenance_resolution_policy !== 'app_or_cli_managed_best_effort_until_ready'
  ) {
    throw new Error('Product profile standard package must use App-managed bootstrap/maintenance without terminal-install end states');
  }
  for (const forbidden of ['install_homebrew_first', 'install_node_first', 'install_git_first']) {
    if (!standardPackage?.forbidden_terminal_instruction_end_states?.includes(forbidden)) {
      throw new Error(`Product profile standard bootstrap must forbid ${forbidden}`);
    }
  }
}

function validateCommandLineToolsPolicy(profile) {
  if (profile.first_run?.command_line_tools?.installer_command !== 'xcode-select --install') {
    throw new Error('Product profile CLT installer command must be xcode-select --install');
  }
  if (profile.first_run?.command_line_tools?.system_installer_only !== true) {
    throw new Error('Product profile CLT installer must use the macOS system installer path');
  }
  if (profile.first_run?.command_line_tools?.waits_for_user_confirmation !== true) {
    throw new Error('Product profile CLT installer must wait for user confirmation');
  }
}

function validateStandardUpdatePolicy(profile) {
  assertDeepEqualJson(
    profile.first_run?.updates?.standard_channel?.metadata_scope,
    ['latest-mac.yml', 'latest-arm64-mac.yml'],
    'Product profile Standard updater metadata bridge',
  );
  if (
    profile.first_run?.updates?.standard_channel?.implementation_reference !== 'electron_autoUpdater_background_download_update_downloaded_restart_prompt'
    || profile.first_run?.updates?.standard_channel?.ready_prompt !== 'prompt_restart_after_download_ready'
    || profile.first_run?.updates?.standard_channel?.full_first_install_metadata_allowed !== false
    || profile.first_run?.updates?.standard_channel?.download_policy !== 'background_download'
    || profile.first_run?.updates?.standard_channel?.apply_policy !== 'restart_when_ready'
    || profile.first_run?.updates?.standard_channel?.blocks_core_ready !== false
  ) {
    throw new Error('Product profile standard updates must download in background, prompt restart after ready, exclude Full metadata, and not block Core ready');
  }
}

function validateCompanionPayloadAuthority(profile, installExposurePolicy) {
  if (profile.companion_payloads?.install_exposure_policy_ref !== 'contracts/app-install-exposure-policy.json') {
    throw new Error('Product profile companion payloads must reference app-install-exposure-policy.json');
  }
  if (profile.companion_payloads?.exposure_classes_ref !== 'contracts/app-install-exposure-policy.json#exposure_classes') {
    throw new Error('Product profile companion payloads must reference install exposure classes');
  }
  if (profile.companion_payloads?.public_abi?.primary_semantic_entry !== installExposurePolicy.public_abi?.primary_semantic_entry) {
    throw new Error('Product profile companion payload public ABI must match install exposure primary semantic entry');
  }
  if (profile.companion_payloads.public_abi.preferred_app_distribution !== 'plugin_packaged_skill') {
    throw new Error('Product profile companion payloads must prefer plugin-packaged skills for the App path');
  }
  if (profile.companion_payloads.public_abi.plugin_must_not_create_second_semantics !== true) {
    throw new Error('Product profile companion payloads must forbid second semantics from plugin packaging');
  }
  if (profile.companion_payloads.public_abi.cli_and_app_share_skill_semantics !== true) {
    throw new Error('Product profile companion payloads must keep CLI and App on shared skill semantics');
  }
  const strategy = profile.companion_payloads?.capability_strategy_consumer;
  if (
    strategy?.strategy_authority !== 'opl-flow'
    || strategy.compiler_authority !== 'opl-framework'
    || strategy.runtime_projection_ref !==
      'app_state.agent_packages.status_index.packages.opl-flow.capability_strategy'
    || strategy.full_build_lock_kind !== 'opl_flow_capability_build_lock.v1'
    || strategy.app_policy_inventory_allowed !== false
    || strategy.app_direct_workflow_policy_parse_allowed !== false
  ) {
    throw new Error('Product profile must consume the Framework-compiled OPL Flow capability strategy');
  }
  assertIncludesAll(
    profile.companion_payloads?.domain_modules,
    ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-meta-agent', 'opl-bookforge'],
    'Product profile domain module composition',
  );
  if (profile.companion_payloads.domain_plugin_skills_must_not_be_companion_mirrors !== true) {
    throw new Error('Product profile domain plugin skills must not be companion skill mirrors');
  }
}

function validateProductProfileBoundary(profile) {
  for (const forbidden of forbiddenAuthorityOwners) {
    if (!profile.boundary?.app_does_not_own?.includes(forbidden)) {
      throw new Error(`Product profile boundary must exclude ${forbidden}`);
    }
  }
}

export function validateProductProfile(
  profile,
  installExposurePolicy,
) {
  validateProductProfileIdentity(profile);
  validateProductProfileContractRefs(profile);
  validateProductProfileCodexDefaults(profile);
  assertOfficialProfileShape(profile.official_profile, 'Product profile Official Profile');
  validateAgentPackageRegistryProjection(profile);
  validateFullFirstInstallCoreReadyPolicy(profile);
  validateStandardPackagePolicy(profile);
  validateCommandLineToolsPolicy(profile);
  validateStandardUpdatePolicy(profile);
  validateCompanionPayloadAuthority(profile, installExposurePolicy);
  validateScheduledTasksProfileProjection(profile.companion_payloads?.native_automation);
  validateProductProfileBoundary(profile);
}
