import fs from 'node:fs';
import path from 'node:path';
import { assertDefaultCodexSessionProfile } from '../app-product-profile-default-session.ts';
import { assertAppProductProfileIdentity } from '../app-product-profile-identity.ts';
import {
  assertAppProductProfileCodexModelDisplayOptions,
  assertAppProductProfileGuiAuthority,
  assertAppProductProfileGuiInteractionBaseline,
  assertAppProductProfileHomeCodexPolicy,
  assertAppProductProfileRouteReceiptPolicy,
  assertAppProductProfileSettingsVisualSystem,
  assertHomeComposerStateContract,
  assertProfessionalAgentPackagePolicy,
  isExternalFirstPartyClaim,
  managedShortcutIds,
  managedShortcutPackageIds,
  defaultVisibleShortcutIds,
  requiredSkillByPackageId,
} from '../app-product-profile-shared-validators.ts';
import { appProductProfilePath } from './paths.ts';
import type { AppProductProfile } from './types.ts';

const requiredDefaultPackagedSkillIds = [
  'med-autoscience',
  'med-autogrant',
  'redcube-ai',
  'opl-bookforge',
];
const developerProfileCapabilityAxes = [
  'source_channel',
  'workspace_trust',
  'github_authority',
  'agent_automation',
  'runtime_mutation_scope',
];
function assertStringArray(value: unknown, label: string, options: { allowBlank?: boolean } = {}): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((entry) => (
    typeof entry === 'string' && (options.allowBlank || entry.trim())
  ))) {
    throw new Error(`Invalid App product profile ${label}: expected a non-empty string array`);
  }
}

function assertIncludesAll(actual: string[], expected: string[], label: string): void {
  for (const item of expected) {
    if (!actual.includes(item)) {
      throw new Error(`Invalid App product profile ${label}: missing ${item}`);
    }
  }
}

function assertDeepEqualJson(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must equal ${JSON.stringify(expected)}`);
  }
}

function assertPostInstallAiSelfCheckEntry(
  entry: AppProductProfile['first_run']['beginner_presentation']['post_install_ai_self_check_entry'],
): void {
  if (
    entry?.trigger !== 'explicit ready entry after ready_to_launch first-run completion' ||
    entry.target_route !== '/guid' ||
    entry.route_state !== 'postInstallSelfCheck' ||
    entry.prompt_policy !==
      'localized Codex CLI post-install self-check prompt describing target OPL working mode and repair path' ||
    entry.mutation_policy !== 'diagnose_first_no_file_mutation_without_user_confirmation' ||
    entry.release_gate_policy !== 'user_visible_entry_complements_non_blocking_codex_ai_self_check_receipt'
  ) {
    throw new Error('App product profile first_run.beginner_presentation.post_install_ai_self_check_entry has invalid route or policy');
  }
  assertIncludesAll(
    entry.target_state_checks,
    [
      'codex_cli_callable',
      'ui_language_policy',
      'session_scoped_opl_app_context',
      'user_agents_md_respected_no_overwrite',
      'mas_mag_rca_routes_visible',
      'opl_meta_agent_capability_visible',
      'codex_skills_plugins_visible',
      'module_update_skill_plugin_continuity',
    ],
    'first_run.beginner_presentation.post_install_ai_self_check_entry.target_state_checks',
  );
}

function assertFirstRunProfileShape(profile: AppProductProfile): void {
  assertStringArray(profile.first_run.readiness_layers, 'first_run.readiness_layers');
  assertStringArray(profile.first_run.ready_to_launch_gate.required_core_items, 'first_run.ready_to_launch_gate.required_core_items');
  assertStringArray(profile.first_run.ready_to_launch_gate.must_not_require, 'first_run.ready_to_launch_gate.must_not_require');
  if (
    profile.first_run.ready_to_launch_gate.ui_order !== 'before_first_conversation_not_before_guid' ||
    profile.first_run.ready_to_launch_gate.guid_navigation_blocking !== false
  ) {
    throw new Error('App product profile ready_to_launch must gate first conversation without blocking /guid navigation');
  }
  assertStringArray(profile.first_run.full_readiness_layers, 'first_run.full_readiness_layers');
  assertStringArray(profile.first_run.deferred_blockers, 'first_run.deferred_blockers');
  assertStringArray(profile.first_run.first_conversation.must_wait_for, 'first_run.first_conversation.must_wait_for');
  assertStringArray(profile.first_run.first_conversation.must_not_wait_for, 'first_run.first_conversation.must_not_wait_for');
  assertStringArray(
    profile.first_run.first_conversation.required_before_plain_send,
    'first_run.first_conversation.required_before_plain_send',
  );
  assertStringArray(
    profile.first_run.first_conversation.required_before_send_with_local_inputs,
    'first_run.first_conversation.required_before_send_with_local_inputs',
  );
  assertStringArray(
    profile.first_run.first_conversation.required_before_workspace_controls,
    'first_run.first_conversation.required_before_workspace_controls',
  );
  assertStringArray(profile.first_run.beginner_presentation.primary_steps, 'first_run.beginner_presentation.primary_steps');
  const beginnerPresentation = profile.first_run.beginner_presentation;
  if (
    beginnerPresentation.layout_mode !== 'focused_setup_workspace' ||
    beginnerPresentation.ordinary_navigation_policy !== 'hidden_until_user_enters_guid' ||
    beginnerPresentation.completion_navigation_policy !== 'manual_guid_entry_available_before_or_after_ready_no_automatic_route' ||
    beginnerPresentation.defer_navigation_policy !== 'explicit_enter_guid_available_before_ready_without_mutating_readiness' ||
    beginnerPresentation.core_readiness_status_policy !== 'required_core_items_never_treat_disabled_as_ready' ||
    beginnerPresentation.minimum_window_primary_action_policy !== '400x600_keeps_current_primary_action_visible'
  ) {
    throw new Error('Invalid App product profile first_run.beginner_presentation focused setup policy');
  }
  assertPostInstallAiSelfCheckEntry(profile.first_run.beginner_presentation.post_install_ai_self_check_entry);
  if (
    profile.first_run.first_conversation.gate !== 'capability_prerequisites_then_acp_warmup_before_initial_send' ||
    profile.first_run.first_conversation.source_command !== 'opl system initialize --json' ||
    profile.first_run.first_conversation.ready_to_launch_must_be_true !== false ||
    profile.first_run.first_conversation.unknown_readiness_policy !== 'allow_attempt_without_mutating_readiness' ||
    profile.first_run.first_conversation.blocked_feedback !==
      'localized_inline_non_modal_setup_notice_preserves_prompt' ||
    profile.first_run.first_conversation.failure_policy !== 'show_retryable_initial_message_error_without_losing_user_prompt'
  ) {
    throw new Error('App product profile first_run.first_conversation must apply granular prerequisites before ACP warmup');
  }
  assertDeepEqualJson(
    profile.first_run.first_conversation.required_before_plain_send,
    ['codex_cli', 'codex_config'],
    'first_run.first_conversation.required_before_plain_send',
  );
  assertDeepEqualJson(
    profile.first_run.first_conversation.required_before_send_with_local_inputs,
    ['codex_cli', 'codex_config'],
    'first_run.first_conversation.required_before_send_with_local_inputs',
  );
  assertDeepEqualJson(
    profile.first_run.first_conversation.required_before_workspace_controls,
    ['workspace_root'],
    'first_run.first_conversation.required_before_workspace_controls',
  );
  const ordinaryRecovery = profile.first_run.ordinary_shell_recovery;
  if (
    ordinaryRecovery.persistent_setup_entry.target_route !== '/first-run' ||
    ordinaryRecovery.persistent_setup_entry.surface !== 'ordinary_sidebar_non_modal_entry' ||
    ordinaryRecovery.plain_conversation.workspace_root_required !== false ||
    ordinaryRecovery.plain_conversation.must_preserve_prompt !== true ||
    ordinaryRecovery.send_scoped_local_inputs.workspace_root_required !== false ||
    ordinaryRecovery.workspace_controls.plain_conversation_remains_available !== true ||
    ordinaryRecovery.workspace_controls.send_scoped_local_inputs_remain_available !== true ||
    ordinaryRecovery.unknown_readiness_policy !== 'do_not_synthesize_failure_or_mutate_readiness'
  ) {
    throw new Error('Invalid App product profile first_run.ordinary_shell_recovery policy');
  }
  assertDeepEqualJson(
    ordinaryRecovery.plain_conversation.required_items,
    ['codex_cli', 'codex_config'],
    'first_run.ordinary_shell_recovery.plain_conversation.required_items',
  );
  assertDeepEqualJson(
    ordinaryRecovery.send_scoped_local_inputs.required_items,
    ['codex_cli', 'codex_config'],
    'first_run.ordinary_shell_recovery.send_scoped_local_inputs.required_items',
  );
  assertDeepEqualJson(
    ordinaryRecovery.send_scoped_local_inputs.supported_inputs,
    [
      'file_dialog_attachment',
      'directory_dialog_attachment',
      'file_paste_attachment',
      'file_drag_attachment',
      'slash_open_absolute_path',
    ],
    'first_run.ordinary_shell_recovery.send_scoped_local_inputs.supported_inputs',
  );
  assertDeepEqualJson(
    ordinaryRecovery.workspace_controls.required_items,
    ['workspace_root'],
    'first_run.ordinary_shell_recovery.workspace_controls.required_items',
  );
  assertDeepEqualJson(
    ordinaryRecovery.workspace_controls.restricted_capabilities,
    ['project_workspace_selection', 'opl_workspace_controls'],
    'first_run.ordinary_shell_recovery.workspace_controls.restricted_capabilities',
  );
  assertIncludesAll(
    profile.first_run.first_conversation.must_wait_for,
    ['conversation_record_ready', 'acp_warmup_complete'],
    'first_run.first_conversation.must_wait_for',
  );
  assertIncludesAll(
    profile.first_run.first_conversation.must_not_wait_for,
    [
      'domain_modules',
      'family_runtime_provider',
      'recommended_skills',
      'native_helpers',
      'repo_sync',
      'command_line_tools_install',
      'ecosystem_module_updates',
    ],
    'first_run.first_conversation.must_not_wait_for',
  );
  if (profile.first_run.progress_model.source_command !== 'opl system initialize --json') {
    throw new Error('App product profile first_run.progress_model.source_command must be opl system initialize --json');
  }
  if (profile.first_run.progress_model.source_path !== 'system_initialize.setup_flow') {
    throw new Error('App product profile first_run.progress_model.source_path must be system_initialize.setup_flow');
  }
  if (profile.first_run.progress_model.renderer_truth_policy !== 'render_only_no_shell_private_progress_truth') {
    throw new Error('App product profile first_run.progress_model must keep renderers display-only');
  }
  assertStringArray(profile.first_run.progress_model.required_setup_flow_fields, 'first_run.progress_model.required_setup_flow_fields');
  assertStringArray(profile.first_run.progress_model.required_progress_fields, 'first_run.progress_model.required_progress_fields');
  assertStringArray(profile.first_run.progress_model.required_checklist_fields, 'first_run.progress_model.required_checklist_fields');
  assertStringArray(profile.first_run.progress_model.required_visible_elements, 'first_run.progress_model.required_visible_elements');
  assertStringArray(profile.first_run.command_line_tools.messages, 'first_run.command_line_tools.messages');
}

function assertSettingsProfileShape(profile: AppProductProfile): void {
  assertStringArray(profile.settings.visible_tabs, 'settings.visible_tabs');
  const controlPlane = profile.settings.control_plane;
  if (
    !controlPlane ||
    controlPlane.source_contract_ref !== 'contracts/app-gui-product-contract.json#settings_navigation'
  ) {
    throw new Error(
      'App product profile settings.control_plane must project contracts/app-gui-product-contract.json#settings_navigation'
    );
  }
  const ordinaryRoutes = Array.isArray(controlPlane.ordinary_routes) ? controlPlane.ordinary_routes : [];
  const secondaryPages = Array.isArray(controlPlane.secondary_pages) ? controlPlane.secondary_pages : [];
  const ordinaryRouteIds = ordinaryRoutes.map((route) => route.id);
  const secondaryPageIds = secondaryPages.map((page) => page.id);
  assertStringArray(controlPlane.ordinary_visible_tabs, 'settings.control_plane.ordinary_visible_tabs');
  assertStringArray(ordinaryRouteIds, 'settings.control_plane.ordinary_routes ids');
  assertStringArray(secondaryPageIds, 'settings.control_plane.secondary_pages ids');
  const controlPlaneRedirects = Object.fromEntries(
    Object.entries(controlPlane.legacy_route_redirects ?? {})
      .filter(([id]) => id !== 'about')
      .map(([id, target]) => [id, String(target).split('?')[0]]),
  );
  if (JSON.stringify(profile.settings.visible_tabs) !== JSON.stringify(controlPlane.ordinary_visible_tabs)) {
    throw new Error('App product profile settings.visible_tabs must match the projected Settings control plane ordinary tabs');
  }
  if (JSON.stringify(profile.settings.legacy_route_redirects) !== JSON.stringify(controlPlaneRedirects)) {
    throw new Error('App product profile settings.legacy_route_redirects must match query-free Settings control plane redirects');
  }
  if (JSON.stringify(controlPlane.ordinary_visible_tabs) !== JSON.stringify(ordinaryRouteIds)) {
    throw new Error('App product profile settings.control_plane must keep ordinary settings tabs on App-owned pages');
  }
  if (controlPlane.extension_tab_policy?.legacy_anchor_remap_required !== true) {
    throw new Error('App product profile settings.control_plane must require legacy extension anchor remapping');
  }
  const recommendedActionIds = controlPlane.state_action_policy?.recommended_action_ids;
  if (
    !recommendedActionIds ||
    typeof recommendedActionIds !== 'object' ||
    Array.isArray(recommendedActionIds) ||
    recommendedActionIds.doctor !== 'doctor' ||
    recommendedActionIds.repair !== 'repair'
  ) {
    throw new Error('App product profile settings.control_plane.state_action_policy.recommended_action_ids must expose doctor and repair action ids');
  }
  const declaredSlotIds = new Set(Object.keys(controlPlane.slot_registry ?? {}));
  for (const route of [...controlPlane.ordinary_routes, ...controlPlane.secondary_pages]) {
    if (!declaredSlotIds.has(route.slot_id)) {
      throw new Error(`App product profile settings.control_plane.slot_registry must declare ${route.slot_id}`);
    }
  }
  const settingsIa = profile.settings.settings_information_architecture ?? {};
  const groupIds = Array.isArray(settingsIa.ordinary_groups)
    ? settingsIa.ordinary_groups.map((group) => group.id)
    : [];
  const routeGroupIds = ordinaryRoutes
    .map((route) => route.ia_group)
    .filter((groupId, index, groups) => typeof groupId === 'string' && groups.indexOf(groupId) === index);
  if (JSON.stringify(groupIds) !== JSON.stringify(routeGroupIds)) {
    throw new Error('App product profile settings_information_architecture must describe every Control Center IA group');
  }
  const primaryTabIds = Object.keys(settingsIa.primary_tabs ?? {});
  assertIncludesAll(primaryTabIds, ordinaryRouteIds, 'settings_information_architecture.primary_tabs');
  for (const tabId of primaryTabIds) {
    if (![...ordinaryRouteIds, ...secondaryPageIds].includes(tabId)) {
      throw new Error(`App product profile settings_information_architecture.primary_tabs contains unknown settings route ${tabId}`);
    }
  }
  if (JSON.stringify(settingsIa.secondary_page_ids ?? []) !== JSON.stringify(secondaryPageIds)) {
    throw new Error('App product profile settings_information_architecture.secondary_page_ids must declare secondary settings pages');
  }
  const taskEntryPolicy = settingsIa.task_entry_policy;
  if (!taskEntryPolicy || typeof taskEntryPolicy !== 'object') {
    throw new Error('App product profile settings_information_architecture.task_entry_policy must be declared');
  }
  if (taskEntryPolicy.ordinary_entry_model !== 'user_task_first_sections_inside_the_ten_OPL_Control_Center_entries') {
    throw new Error('App product profile task_entry_policy must keep task entries inside the ten OPL Control Center entries');
  }
  assertIncludesAll(
    taskEntryPolicy.p0_entries ?? [],
    ['gateway_account', 'model_access', 'local_runtime_ability', 'workspace', 'maintenance_hub', 'capability_status'],
    'settings_information_architecture.task_entry_policy.p0_entries',
  );
  assertIncludesAll(
    taskEntryPolicy.p1_entries ?? [],
    ['remote_access', 'advanced_deployment', 'developer_source_control', 'external_tools_voice'],
    'settings_information_architecture.task_entry_policy.p1_entries',
  );
  assertIncludesAll(
    taskEntryPolicy.hidden_as_ordinary_ui ?? [],
    ['AionUI Team', 'backend/provider raw selector', 'AG-UI implementation surface', 'AionUI implementation skills', 'raw runtime/provider internals'],
    'settings_information_architecture.task_entry_policy.hidden_as_ordinary_ui',
  );
  assertStringArray(profile.settings.environment_items, 'settings.environment_items');
  const developerProfile = profile.settings.developer_profile;
  if (!developerProfile || typeof developerProfile !== 'object') {
    throw new Error('App product profile settings.developer_profile must be declared');
  }
  if (
    developerProfile.source !== 'app_state.developer_profile + app_state.modules[].source_policy' ||
    developerProfile.default_profile !== 'standard_user' ||
    developerProfile.opt_in_policy !== 'automatic_for_matching_identity_and_authorized_repositories_with_explicit_off' ||
    developerProfile.settings_page !== 'settings_agents' ||
    developerProfile.global_control !== 'automatic_managed_developer_source_segmented_control' ||
    developerProfile.safe_maintenance_control !== 'auto_or_off_control_with_effective_state_readback' ||
    developerProfile.safe_maintenance_label_zh !== '允许维护已授权的开发仓库' ||
    developerProfile.safe_maintenance_label_en !== 'Maintain authorized development repositories' ||
    developerProfile.safe_maintenance_default !== 'auto' ||
    developerProfile.safe_maintenance_auto_policy !== 'matching developer identity plus successful full repository authority inspection activates developer_apply_safe for authorized repositories' ||
    developerProfile.safe_maintenance_fast_policy !== 'show inspection pending without claiming identity mismatch' ||
    developerProfile.shared_runtime_mutation_boundary !== 'enabled=on + mode=developer_apply_safe + source=user_config' ||
    developerProfile.safe_maintenance_independent_from_source_selection !== true ||
    developerProfile.package_source_control !== 'auto_managed_developer_segmented_control_in_package_details' ||
    developerProfile.fallback_policy !== 'developer_checkout_missing_falls_back_to_managed_with_visible_reason' ||
    developerProfile.hide_machine_status !== true
  ) {
    throw new Error('App product profile Developer Profile must preserve automatic authorized-repository maintenance with an explicit off choice');
  }
  assertIncludesAll(
    developerProfile.safe_maintenance_required_readback ?? [],
    ['effective_state', 'configuration_source', 'github_login', 'authorized_repository_scope', 'dirty_worktree_and_branch_protection', 'inactive_reason'],
    'settings.developer_profile.safe_maintenance_required_readback',
  );
  if (JSON.stringify(developerProfile.capability_axes) !== JSON.stringify(developerProfileCapabilityAxes)) {
    throw new Error('App product profile Developer Profile must declare the required capability axes');
  }
  for (const axis of developerProfileCapabilityAxes) {
    const capability = developerProfile.capabilities?.[axis];
    if (!capability || typeof capability !== 'object') {
      throw new Error(`App product profile Developer Profile capability ${axis} must be declared`);
    }
    for (const field of ['standard_default', 'developer_opt_in', 'display_policy'] as const) {
      if (typeof capability[field] !== 'string' || !capability[field].trim()) {
        throw new Error(`App product profile Developer Profile capability ${axis}.${field} must be a non-empty string`);
      }
    }
  }
  if (
    developerProfile.capabilities.source_channel.standard_default !== 'agent_rolling_latest_package_channel' ||
    developerProfile.capabilities.source_channel.developer_opt_in !== 'github_repo_or_local_checkout' ||
    developerProfile.capabilities.runtime_mutation_scope.standard_default !== 'app_action_route_only' ||
    'legacy_developer_mode_alias' in developerProfile
  ) {
    throw new Error('App product profile Developer Profile must use capability display without legacy Developer Mode aliases');
  }
}

function assertCompanionPayloadProfileShape(
  profile: AppProductProfile,
  skillProfiles: AppProductProfile['gui']['assistant_skill_profiles'],
): void {
  assertStringArray(profile.companion_payloads.tools, 'companion_payloads.tools');
  assertStringArray(profile.companion_payloads.domain_modules, 'companion_payloads.domain_modules');
  assertStringArray(
    profile.companion_payloads.default_packaged_codex_skill_ids,
    'companion_payloads.default_packaged_codex_skill_ids',
  );
  assertStringArray(profile.companion_payloads.additional_package_skill_ids, 'companion_payloads.additional_package_skill_ids');
  assertStringArray(profile.companion_payloads.domain_plugin_skill_ids, 'companion_payloads.domain_plugin_skill_ids');
  const visibleSkills = new Set(profile.codex.default_visible_skills);
  const defaultPackagedSkills = new Set(profile.companion_payloads.default_packaged_codex_skill_ids);
  const additionalPackageSkills = new Set(profile.companion_payloads.additional_package_skill_ids);
  for (const entry of skillProfiles) {
    const missingRequiredSkills = entry.required_skills.filter((skill) => (
      !defaultPackagedSkills.has(skill) && !additionalPackageSkills.has(skill)
    ));
    if (missingRequiredSkills.length > 0) {
      throw new Error(
        `App product profile assistant ${entry.assistant_id} has unpackaged required skills: ${missingRequiredSkills.join(', ')}`,
      );
    }
  }
  const missingPackagedVisibleSkills = profile.codex.default_visible_skills
    .filter((skill) => !defaultPackagedSkills.has(skill));
  if (missingPackagedVisibleSkills.length > 0) {
    throw new Error(`App product profile default visible skills must be packaged: ${missingPackagedVisibleSkills.join(', ')}`);
  }
  const hiddenDefaultPackagedSkills = profile.companion_payloads.default_packaged_codex_skill_ids
    .filter((skill) => !visibleSkills.has(skill));
  if (hiddenDefaultPackagedSkills.length > 0) {
    throw new Error(
      `App product profile default packaged skills must be default visible: ${hiddenDefaultPackagedSkills.join(', ')}`,
    );
  }
  const missingPrioritySkills = profile.codex.default_visible_skills
    .filter((skill) => !profile.codex.skill_priority.includes(skill));
  if (missingPrioritySkills.length > 0) {
    throw new Error(`App product profile skill_priority is missing default visible skills: ${missingPrioritySkills.join(', ')}`);
  }
  const overlappingExplicitSkills = [...additionalPackageSkills].filter((skill) => visibleSkills.has(skill));
  if (overlappingExplicitSkills.length > 0) {
    throw new Error(
      `App product profile additional package skills must stay out of default_visible_skills: ${overlappingExplicitSkills.join(', ')}`,
    );
  }
  if (!additionalPackageSkills.has('opl-meta-agent')) {
    throw new Error('App product profile must mark opl-meta-agent as packaged but not default visible');
  }
  if (profile.codex.skill_priority.includes('morph-ppt') || defaultPackagedSkills.has('morph-ppt') || additionalPackageSkills.has('morph-ppt')) {
    throw new Error('App product profile must not include retired morph-ppt skill wiring');
  }
  if (
    profile.companion_payloads.opl_flow_dependency_policy_ref !==
      'gaofeng21cn/opl-flow:contracts/workflow-policy.json#requires+recommends' ||
    profile.companion_payloads.full_dependency_closure_policy !==
      'bundle_requires_and_recommends_with_offline_bundle_full'
  ) {
    throw new Error('App product profile must delegate companion dependency policy to OPL Flow');
  }
  if (profile.companion_payloads.install_exposure_policy_ref !== 'contracts/app-install-exposure-policy.json') {
    throw new Error('App product profile companion payloads must reference app-install-exposure-policy.json');
  }
  if (profile.companion_payloads.public_abi?.primary_semantic_entry !== 'skill') {
    throw new Error('App product profile companion payloads must keep skill as the primary semantic entry');
  }
  if (profile.companion_payloads.public_abi.plugin_must_not_create_second_semantics !== true) {
    throw new Error('App product profile companion payloads must forbid second semantics from plugin packaging');
  }
  if (profile.companion_payloads.domain_plugin_skills_must_not_be_companion_mirrors !== true) {
    throw new Error('App product profile domain plugin skills must not be companion mirrors');
  }
}

function assertCodexOplFlowContext(profile: AppProductProfile): void {
  if (
    profile.codex.auto_model_policy.authority !== 'one-person-lab-app' ||
    profile.codex.auto_model_policy.recommendation_authority !== 'opl-flow' ||
    profile.codex.auto_model_policy.policy_source_ref !==
      'gaofeng21cn/opl-flow:contracts/workflow-policy.json#codex_model_policy' ||
    profile.codex.auto_model_policy.app_role !== 'display_live_catalog_and_submit_user_override'
  ) {
    throw new Error('App product profile must consume the OPL Flow model policy projection');
  }
  if (
    profile.codex.opl_flow_context?.flow_id !== 'opl-flow' ||
    profile.codex.opl_flow_context.source !== 'opl-flow-package-policy' ||
    profile.codex.opl_flow_context.policy_source_ref !== 'gaofeng21cn/opl-flow:contracts/workflow-policy.json' ||
    profile.codex.opl_flow_context.delivery !== 'package_installed_user_profile_only' ||
    profile.codex.opl_flow_context.user_agents_policy !== 'respect_user_agents_no_overwrite_detect_conflicts' ||
    profile.codex.opl_flow_context.language_policy !== 'follow_ui_locale_zh_only_when_ui_zh' ||
    profile.codex.opl_flow_context.app_role !== 'install_sync_diagnose_user_profile_only'
  ) {
    throw new Error('App product profile must consume the OPL Flow package context policy');
  }
  if (
    profile.codex.opl_app_session_context?.owner !== 'one-person-lab-app' ||
    profile.codex.opl_app_session_context.source !== 'gui.professional_agent_packages.session_routing_summary_i18n' ||
    profile.codex.opl_app_session_context.delivery !== 'new_codex_conversation_preset_context' ||
    profile.codex.opl_app_session_context.customization.additional_instructions_key !==
      'codex.oplAppSessionContextAdditional' ||
    profile.codex.opl_app_session_context.customization.base_context_edit_policy !== 'generated_read_only' ||
    profile.codex.opl_app_session_context.customization.user_edit_policy !== 'append_additional_instructions_only' ||
    profile.codex.opl_app_session_context.customization.reset_behavior !== 'clear_additional_instructions'
  ) {
    throw new Error('App product profile must own the editable OPL App session context');
  }
  if (
    !Array.isArray(profile.codex.session_context_i18n?.['zh-CN']) ||
    !profile.codex.session_context_i18n['zh-CN'].some((line) => line.includes('你正在 One Person Lab App')) ||
    !Array.isArray(profile.codex.session_context_i18n?.['en-US']) ||
    !profile.codex.session_context_i18n['en-US'].some((line) => line.includes('You are in a Codex session'))
  ) {
    throw new Error('App product profile must declare localized OPL App session context');
  }
  for (const agent of profile.gui.professional_agent_packages) {
    if (!agent.session_routing_summary_i18n?.['zh-CN'] || !agent.session_routing_summary_i18n?.['en-US']) {
      throw new Error(`App product profile agent ${agent.package_id} must declare localized session routing summaries`);
    }
  }
}

function assertHomeCodexProfileShape(profile: AppProductProfile): void {
  assertAppProductProfileGuiAuthority(profile);
  assertAppProductProfileGuiInteractionBaseline(profile);
  assertAppProductProfileSettingsVisualSystem(profile);
  assertAppProductProfileHomeCodexPolicy(profile, 'App product profile', {
    requireEnglishStatusLabel: true,
    requireSelectionPersistence: true,
  });
  assertHomeComposerStateContract(profile.gui.home.home_composer_state_contract, 'App product profile Home composer state contract');
  assertStringArray(
    profile.codex.auto_model_policy.frontier_model_preference_order,
    'codex.auto_model_policy.frontier_model_preference_order',
  );
  assertAppProductProfileCodexModelDisplayOptions(profile, 'App product profile', {
    requireAutoIdAndDescriptions: true,
  });
}

function assertHomePurposeEntries(profile: AppProductProfile): void {
  const purposeEntries = profile.gui.home.home_purpose_entries ?? [];
  if (JSON.stringify(purposeEntries.map((entry) => entry.id)) !== JSON.stringify(['research', 'grant', 'ppt', 'book'])) {
    throw new Error('App product profile GUI home must expose exactly research, grant, ppt, and book purpose entries');
  }
  if (JSON.stringify(purposeEntries.map((entry) => entry.primary_label)) !== JSON.stringify(['科研', '基金', '演示', '写书'])) {
    throw new Error('App product profile GUI home purpose labels must be 科研, 基金, 演示, 写书');
  }
  if (JSON.stringify(purposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca', 'obf'])) {
    throw new Error('App product profile GUI home purpose entries must route to MAS, MAG, RCA, and BookForge');
  }
  for (const entry of purposeEntries) {
    if (entry.display_policy !== 'purpose_first' || entry.home_entry_policy !== 'visible_click_to_start') {
      throw new Error(`App product profile GUI home purpose entry ${entry.id} must be purpose-first and click-to-start`);
    }
  }
  const shortcuts = profile.gui.home.home_agent_shortcuts ?? [];
  if (JSON.stringify(shortcuts.map((entry) => entry.shortcut_id)) !== JSON.stringify(managedShortcutIds)) {
    throw new Error('App product profile GUI home must expose configurable MAS, MAG, RCA, OBF, and OMA package shortcuts');
  }
  if (JSON.stringify(shortcuts.map((entry) => entry.package_id)) !== JSON.stringify(managedShortcutPackageIds)) {
    throw new Error('App product profile GUI home shortcuts must target MAS, MAG, RCA, OBF, and OMA packages');
  }
  for (const shortcut of shortcuts) {
    const expectedSkills = requiredSkillByPackageId[shortcut.package_id as keyof typeof requiredSkillByPackageId];
    if (
      shortcut.executor !== 'codex_cli' ||
      shortcut.source !== 'opl_app_home' ||
      shortcut.display_policy !== 'purpose_first' ||
      shortcut.home_entry_policy !== 'visible_click_to_start' ||
      shortcut.user_configurable !== true ||
      JSON.stringify(shortcut.required_skill_ids) !== JSON.stringify(expectedSkills)
    ) {
      throw new Error(`App product profile GUI home shortcut ${shortcut.shortcut_id} must be a configurable Codex package launch shortcut`);
    }
    if (shortcut.package_id === 'oma' && shortcut.shortcut_id !== 'oma') {
      throw new Error('App product profile OMA shortcut id must remain oma');
    }
    if (shortcut.default_visible !== defaultVisibleShortcutIds.includes(shortcut.shortcut_id)) {
      throw new Error(`App product profile shortcut ${shortcut.shortcut_id} has invalid default visibility`);
    }
  }
  assertStringArray(
    profile.gui.home.retired_codex_models_must_not_be_exposed,
    'gui.home.retired_codex_models_must_not_be_exposed',
  );
}

function assertHomeActivityCenterPolicy(profile: AppProductProfile): void {
  if (
    profile.gui.home.activity_center_policy?.source !== 'not_rendered_on_ordinary_home' ||
    profile.gui.home.activity_center_policy.authority !== 'app_owned_home_minimal_command_surface' ||
    profile.gui.home.activity_center_policy.role !== 'home_runtime_activity_suppressed_to_keep_composer_first' ||
    profile.gui.home.activity_center_policy.default_placement !== 'not_rendered_on_ordinary_home' ||
    profile.gui.home.activity_center_policy.home_surface_policy !== 'ordinary_home_must_not_render_activity_center_or_continue_work_grid' ||
    profile.gui.home.activity_center_policy.footer_quick_actions_policy !== 'do_not_render_feedback_star_web_icons_on_home'
  ) {
    throw new Error('App product profile GUI home must keep runtime activity off ordinary Home');
  }
  if (profile.gui.home.activity_center_policy.allowed_home_runtime_context.length !== 0) {
    throw new Error('App product profile GUI home must not allow runtime context on ordinary Home');
  }
  assertIncludesAll(
    profile.gui.home.activity_center_policy.must_not_display,
    [
      'expanded continue-work center',
      'needs attention / active / recent activity groups',
      'per-assistant running badges',
      'module_runtime dirty state as task',
      'domain artifact body',
      'memory body',
      'quality verdict body',
      'provider implementation details',
    ],
    'gui.home.activity_center_policy.must_not_display',
  );
}

function assertHomeSelectionAndIconPolicy(profile: AppProductProfile): void {
  const homeLayout = profile.gui.home.home_layout;
  const iconPolicy = profile.gui.home.utility_icon_policy;
  if (
    homeLayout.default_active_shortcut !== null ||
    homeLayout.shortcut_selection_policy !==
      'explicit_user_or_navigation_selection_only_no_saved_preset_restore_and_never_disabled_by_launch_readiness' ||
    homeLayout.starter_item_width_policy !== 'content_sized' ||
    homeLayout.starter_count_layout_policy !== 'center_actual_visible_count_and_wrap_without_navigation_chevrons' ||
    homeLayout.desktop_composer_max_width_px !== 736 ||
    homeLayout.desktop_composer_min_height_px !== 98 ||
    homeLayout.desktop_composer_corner_radius_px !== 22 ||
    homeLayout.desktop_context_bar_height_px !== 0 ||
    homeLayout.desktop_context_bar_overlap_px !== 0 ||
    homeLayout.desktop_context_bar_horizontal_inset_px !== 0 ||
    homeLayout.selected_starter_visual_policy !== 'quiet_fill_and_check_indicator_not_color_alone'
  ) {
    throw new Error('App product profile Home must require explicit professional-agent selection with a visible selected state');
  }
  if (
    iconPolicy.library !== 'font_awesome_free_for_opl_owned_utility_icons' ||
    iconPolicy.opl_owned_settings_navigation_and_overview !== 'font_awesome_free' ||
    iconPolicy.upstream_fork_body_bulk_icon_rewrite !== 'forbidden' ||
    iconPolicy.refresh_actions !== 'icon_only_with_tooltip_and_accessible_name' ||
    iconPolicy.model_reasoning_control !== 'text_and_disclosure_without_brain_icon' ||
    JSON.stringify(iconPolicy.account_identity_avatar) !==
      JSON.stringify({
        shape: 'circle',
        background: 'semantic_success_green',
        foreground: 'inverse',
        han_name_initials: 'first_han_character_only',
        non_han_name_initials: 'first_letters_of_first_two_words_uppercase_else_first_two_codepoints',
        email_fallback_initials: 'first_two_local_part_codepoints_uppercase',
        empty_fallback: 'OP',
      }) ||
    iconPolicy.global_feedback_action?.placement !== 'titlebar_trailing_utility' ||
    iconPolicy.global_feedback_action?.icon !== 'circle_question' ||
    iconPolicy.global_feedback_action?.icon_style !== 'regular_outline' ||
    iconPolicy.global_feedback_action?.target_url !==
      'https://github.com/gaofeng21cn/one-person-lab-app/issues/new' ||
    iconPolicy.global_feedback_action?.open_mode !== 'external_browser_user_review_and_submit' ||
    JSON.stringify(iconPolicy.global_feedback_action?.prefill_fields) !==
      JSON.stringify(['localized_title', 'localized_body', 'current_route', 'app_release_version']) ||
    iconPolicy.global_feedback_action?.shell_local_delivery_forbidden !== true ||
    iconPolicy.scope !== 'opl_owned_overlay_surfaces_not_upstream_fork_body'
  ) {
    throw new Error('App product profile utility icon policy must preserve OPL-owned icons and GitHub issue routing');
  }
}

function assertUiLocalePolicy(profile: AppProductProfile): void {
  const policy = profile.gui.ui_locale_policy;
  if (
    policy.explicit_user_preference !== 'preserve_across_launches' ||
    policy.first_launch_without_preference !== 'detect_system_locale_before_first_render' ||
    policy.supported_normalization !== 'zh_to_zh-CN_else_en-US' ||
    policy.startup_must_not_overwrite_explicit_preference !== true
  ) {
    throw new Error('App product profile locale policy must detect the system language before first render while preserving explicit preferences');
  }
}

function assertDefaultAssistantProfileShape(profile: AppProductProfile): void {
  const defaultAssistantIds = profile.gui.default_assistants?.map((assistant) => assistant.id) ?? [];
  if (JSON.stringify(defaultAssistantIds) !== JSON.stringify(['mas', 'mag', 'rca', 'obf'])) {
    throw new Error('App product profile default home assistants must be MAS, MAG, RCA, and BookForge');
  }
  const purposeLabels = profile.gui.default_assistants?.map((assistant) => assistant.home_purpose_label) ?? [];
  if (JSON.stringify(purposeLabels) !== JSON.stringify(['科研', '基金', '演示', '写书'])) {
    throw new Error('App product profile default assistants must expose purpose-first home labels');
  }
  for (const assistantId of ['mas', 'mag', 'rca', 'obf']) {
    if (!defaultAssistantIds.includes(assistantId)) {
      throw new Error(`App product profile missing default assistant ${assistantId}`);
    }
  }
  if (defaultAssistantIds.includes('mds') || defaultAssistantIds.includes('oma')) {
    throw new Error('App product profile must not include MDS or OMA as a default home assistant');
  }
  for (const assistant of profile.gui.default_assistants ?? []) {
    if (assistant.home_entry_policy !== 'purpose_entry_target' || assistant.home_entry_display_policy !== 'purpose_first') {
      throw new Error(`Default assistant ${assistant.id} must use purpose-first home display`);
    }
    assertStringArray(Object.keys(assistant.description_i18n ?? {}), `gui.default_assistants.${assistant.id}.description_i18n`);
    assertStringArray(Object.keys(assistant.prompts_i18n ?? {}), `gui.default_assistants.${assistant.id}.prompts_i18n`);
  }
}

function assertOrdinaryCapabilitySelectorPolicy(profile: AppProductProfile): void {
  const ordinarySelector = profile.gui.ordinary_capability_selector_policy;
  if (!ordinarySelector || typeof ordinarySelector !== 'object') {
    throw new Error('App product profile must declare ordinary_capability_selector_policy');
  }
  if (
    ordinarySelector.scope !== 'home_composer_and_ordinary_conversation' ||
    ordinarySelector.authority !== 'app_owned_opl_allowlist' ||
    ordinarySelector.skill_source_ref !== 'gui.professional_agent_packages.required_skill_ids + optional_skill_ids' ||
    ordinarySelector.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible' ||
    ordinarySelector.conversation_loaded_skill_display_policy !== 'filter_to_ordinary_skill_allowlist' ||
    ordinarySelector.mcp_server_source_ref !== 'gui.ordinary_capability_selector_policy.visible_mcp_server_ids' ||
    ordinarySelector.mcp_menu_policy !== 'empty_until_app_explicitly_whitelists_opl_mcp_servers' ||
    ordinarySelector.conversation_loaded_mcp_display_policy !== 'filter_to_visible_mcp_server_ids' ||
    ordinarySelector.forbidden_mcp_policy !==
      'do_not_surface_user_or_aionui_mcp_servers_in_ordinary_home_without_app_profile_allowlist'
  ) {
    throw new Error('App product profile ordinary capability selector policy must preserve OPL allowlist behavior');
  }
  assertStringArray(
    ordinarySelector.forbidden_skill_examples,
    'gui.ordinary_capability_selector_policy.forbidden_skill_examples',
  );
  assertIncludesAll(
    ordinarySelector.forbidden_skill_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator', 'cron'],
    'gui.ordinary_capability_selector_policy.forbidden_skill_examples',
  );
  assertIncludesAll(
    ordinarySelector.forbidden_mcp_examples,
    ['aionui-team', 'team_*', 'mcp__aionui-team*', 'team_mcp_stdio_config', 'team_id/teamId'],
    'gui.ordinary_capability_selector_policy.forbidden_mcp_examples',
  );
  if (
    JSON.stringify(ordinarySelector.forbidden_mcp_matchers) !==
    JSON.stringify({
      exact: ['aionui-team'],
      prefixes: ['team_', 'mcp__aionui-team'],
      contains: ['aionui-team'],
    })
  ) {
    throw new Error('App product profile ordinary selector must carry Team MCP forbidden matchers');
  }
  if (
    JSON.stringify(ordinarySelector.scrub_extra_keys) !==
    JSON.stringify([
      'team_mcp_stdio_config',
      'team_id',
      'teamId',
      'team_lead_team_id',
      'team_lead_team_slot_id',
      'team_lead_conversation_id',
      'tl',
    ])
  ) {
    throw new Error('App product profile ordinary selector must carry Team extra scrub keys');
  }
  if (
    JSON.stringify(ordinarySelector.required_scrub_targets) !==
    JSON.stringify([
      'mcp_servers entries matching forbidden_mcp_matchers',
      'mcp_statuses entries matching forbidden_mcp_matchers',
      'session_mcp_servers entries matching forbidden_mcp_matchers',
      'scrub_extra_keys',
    ])
  ) {
    throw new Error('App product profile ordinary selector must carry executable Team scrub targets');
  }
  if (
    ordinarySelector.conversation_snapshot_policy !==
    'scrub_disabled_team_mcp_and_team_metadata_before_rendering_or_inheriting_ordinary_conversations'
  ) {
    throw new Error('App product profile ordinary capability selector must scrub disabled Team MCP snapshots');
  }
  if (!Array.isArray(ordinarySelector.visible_mcp_server_ids) || ordinarySelector.visible_mcp_server_ids.length !== 0) {
    throw new Error('App product profile ordinary MCP selector must default to an empty App allowlist');
  }
}

function assertProfessionalAgentPackages(profile: AppProductProfile): void {
  assertProfessionalAgentPackagePolicy(profile.gui.professional_agent_packages, 'App product profile');
}

function assertAssistantSkillProfiles(
  profile: AppProductProfile,
): AppProductProfile['gui']['assistant_skill_profiles'] {
  const skillProfiles = profile.gui.assistant_skill_profiles ?? [];
  if (JSON.stringify(skillProfiles.map((entry) => entry.assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca', 'obf'])) {
    throw new Error('App product profile assistant skill profiles must target MAS, MAG, RCA, and BookForge');
  }
  const requiredByAssistant = new Map(skillProfiles.map((entry) => [entry.assistant_id, entry.required_skills]));
  for (const assistantId of ['mas', 'mag', 'rca']) {
    const requiredSkills = requiredByAssistant.get(assistantId);
    if (JSON.stringify(requiredSkills) !== JSON.stringify(requiredSkillByPackageId[assistantId as keyof typeof requiredSkillByPackageId])) {
      throw new Error(`App product profile assistant ${assistantId} must require its matching Codex skill`);
    }
  }
  if (JSON.stringify(requiredByAssistant.get('obf')) !== JSON.stringify(['opl-bookforge'])) {
    throw new Error('App product profile assistant obf must require the opl-bookforge Codex skill');
  }
  for (const entry of skillProfiles) {
    assertStringArray(entry.required_skills, `gui.assistant_skill_profiles.${entry.assistant_id}.required_skills`);
    assertStringArray(entry.optional_skills, `gui.assistant_skill_profiles.${entry.assistant_id}.optional_skills`);
    if ('hidden_home_skill_names' in entry) {
      throw new Error(`App product profile assistant ${entry.assistant_id} must not carry UI hiding policy`);
    }
    if (entry.optional_skills.includes('morph-ppt')) {
      throw new Error(`App product profile assistant ${entry.assistant_id} must not expose retired morph-ppt skill wiring`);
    }
    if (
      entry.required_skill_policy !== 'checked_locked' ||
      entry.optional_skill_policy !== 'unchecked_user_selectable' ||
      entry.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible'
    ) {
      throw new Error(`App product profile assistant ${entry.assistant_id} has invalid skill menu policy`);
    }
  }
  return skillProfiles;
}

function assertNonDefaultAssistantProfileShape(profile: AppProductProfile): void {
  const oma = profile.gui.non_default_assistants?.find((assistant) => assistant.id === 'oma');
  if (!oma || oma.home_default_visible !== true || oma.home_entry_policy !== 'settings_managed_home_shortcut') {
    throw new Error('App product profile must expose OMA through its default settings-managed Home shortcut');
  }
}

function assertAgentPackageRegistryProjection(profile: AppProductProfile, profilePath: string): void {
  const registryPath = path.join(path.dirname(profilePath), 'agent-package-registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as {
    registry_url?: unknown;
    entries?: Array<{ package_id?: unknown; source?: unknown; trust_tier?: unknown }>;
  };
  const projection = profile.gui.agent_package_registry;
  const expectedFirstPartyPackageIds = [
    'mas',
    'mag',
    'rca',
    'oma',
    'obf',
    'mas-scholar-skills',
    'opl-flow',
  ];
  if (
    typeof registry.registry_url !== 'string' ||
    !registry.registry_url.trim() ||
    projection?.default_registry_url !== registry.registry_url ||
    projection?.source_ref !== 'contracts/agent-package-registry.json#registry_url' ||
    projection?.registry_scope !== 'external_discovery_only' ||
    projection?.empty_default_registry_allowed !== true ||
    projection?.first_party_runtime_authority !== 'one-person-lab-framework#built_in_release_set' ||
    projection?.external_first_party_identity_claims_allowed !== false ||
    projection?.external_first_party_trust_claims_allowed !== false ||
    projection?.collision_failure_code !== 'agent_package_registry_first_party_identity_collision' ||
    projection?.first_party_manifest_fixture_dir !== 'contracts/fixtures/agent-package-manifests' ||
    projection?.shell_consumption_policy !== 'generated_product_profile_only_no_renderer_literal'
  ) {
    throw new Error('App product profile must separate the external Agent Package registry from the Framework first-party Release Set');
  }
  if (JSON.stringify(projection.canonical_first_party_package_ids) !== JSON.stringify(expectedFirstPartyPackageIds)) {
    throw new Error('App product profile must list the canonical Framework first-party Release Set package ids');
  }
  const metadata = projection.first_party_release_set_metadata ?? [];
  if (JSON.stringify(metadata.map((entry) => entry.package_id)) !== JSON.stringify(expectedFirstPartyPackageIds)) {
    throw new Error('App product profile must provide product metadata for every canonical first-party package');
  }
  for (const entry of metadata) {
    if (
      !entry.package_kind ||
      !entry.display_name ||
      entry.publisher !== 'one-person-lab' ||
      entry.source !== 'first_party' ||
      entry.trust_tier !== 'first_party' ||
      !entry.description?.trim() ||
      !Array.isArray(entry.tags) ||
      entry.tags.length === 0 ||
      entry.manifest_fixture_ref !== `contracts/fixtures/agent-package-manifests/${entry.package_id}.json`
    ) {
      throw new Error(`App product profile first-party metadata is incomplete for ${entry.package_id}`);
    }
  }
  const reservedIds = new Set(expectedFirstPartyPackageIds);
  const externalEntries = registry.entries ?? [];
  const collision = externalEntries.find((entry) =>
    (typeof entry.package_id === 'string' && reservedIds.has(entry.package_id)) ||
    isExternalFirstPartyClaim(entry.source) ||
    isExternalFirstPartyClaim(entry.trust_tier));
  if (collision) {
    throw new Error('Default external Agent Package registry must have zero canonical first-party identity or trust collisions');
  }
}

function assertProfileShape(profile: AppProductProfile): void {
  assertAppProductProfileIdentity(profile);
  if (profile.product?.ordinary_chrome_name !== 'One Person Lab') {
    throw new Error('App product profile product.ordinary_chrome_name must be One Person Lab');
  }
  assertDefaultCodexSessionProfile(profile);
  assertCodexOplFlowContext(profile);
  assertHomeCodexProfileShape(profile);
  assertHomePurposeEntries(profile);
  assertHomeActivityCenterPolicy(profile);
  assertHomeSelectionAndIconPolicy(profile);
  assertUiLocalePolicy(profile);
  assertAppProductProfileRouteReceiptPolicy(profile, 'App product profile', {
    requireExactAssistants: true,
  });
  assertProfessionalAgentPackages(profile);
  assertDefaultAssistantProfileShape(profile);
  assertOrdinaryCapabilitySelectorPolicy(profile);
  const skillProfiles = assertAssistantSkillProfiles(profile);
  assertNonDefaultAssistantProfileShape(profile);
  assertStringArray(profile.codex.default_visible_skills, 'codex.default_visible_skills');
  assertStringArray(profile.codex.skill_priority, 'codex.skill_priority');
  assertStringArray(profile.codex.session_context_lines, 'codex.session_context_lines', { allowBlank: true });
  assertFirstRunProfileShape(profile);
  assertSettingsProfileShape(profile);
  assertCompanionPayloadProfileShape(profile, skillProfiles);
  assertStringArray(profile.boundary.app_does_not_own, 'boundary.app_does_not_own');
}

export function readAppProductProfile(profilePath = appProductProfilePath): AppProductProfile {
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8')) as AppProductProfile;
  assertProfileShape(profile);
  assertAgentPackageRegistryProjection(profile, profilePath);
  return profile;
}
