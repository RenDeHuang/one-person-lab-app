import fs from 'node:fs';
import { assertDefaultCodexSessionProfile } from '../app-product-profile-default-session.ts';
import { assertAppProductProfileIdentity } from '../app-product-profile-identity.ts';
import {
  assertAppProductProfileCodexModelDisplayOptions,
  assertAppProductProfileGuiAuthority,
  assertAppProductProfileHomeCodexPolicy,
  assertAppProductProfileRouteReceiptPolicy,
} from '../app-product-profile-shared-validators.ts';
import { appProductProfilePath } from './paths.ts';
import type { AppProductProfile } from './types.ts';

const requiredDefaultPackagedSkillIds = [
  'med-autoscience',
  'med-autogrant',
  'redcube-ai',
  'opl-bookforge',
  'superpowers',
  'cron',
  'officecli',
  'officecli-docx',
  'officecli-pptx',
  'officecli-xlsx',
  'officecli-academic-paper',
  'officecli-data-dashboard',
  'officecli-financial-model',
  'officecli-pitch-deck',
  'pdf',
  'mineru-document-extractor',
  'ui-ux-pro-max',
];
const requiredCompanionSkillSyncIds = requiredDefaultPackagedSkillIds.filter((skillId) => (
  !['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'].includes(skillId)
));
const appOwnedSettingsTabs = ['general', 'access', 'capabilities', 'environment', 'storage', 'appearance', 'advanced'];
const appOwnedSecondarySettingsPages = ['about', 'update', 'theme', 'workspace', 'local-services'];
const appOwnedSettingsIaGroups = ['overview', 'setup_access', 'capabilities', 'maintenance', 'data_storage', 'preferences', 'advanced'];
const appOwnedSettingsPrimaryTabIds = ['general', 'access', 'capabilities', 'environment', 'storage', 'appearance', 'advanced', 'about'];
const developerProfileCapabilityAxes = [
  'source_channel',
  'workspace_trust',
  'github_authority',
  'agent_automation',
  'runtime_mutation_scope',
];
const starterPackageIds = ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'];
const starterShortcutIds = ['research', 'grant', 'ppt', 'book'];
const requiredSkillByPackageId = {
  'med-autoscience': ['med-autoscience'],
  'med-autogrant': ['med-autogrant'],
  'redcube-ai': ['redcube-ai'],
  'opl-bookforge': ['opl-bookforge'],
  'opl-meta-agent': ['opl-meta-agent'],
};
const codexEntryByPackageId = {
  'med-autoscience': 'med-autoscience',
  'med-autogrant': 'med-autogrant',
  'redcube-ai': 'redcube-ai',
  'opl-bookforge': 'opl-bookforge',
  'opl-meta-agent': 'opl-meta-agent',
};
const legacySettingsRouteRedirects = {
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
};

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

function assertPostInstallAiSelfCheckEntry(
  entry: AppProductProfile['first_run']['beginner_presentation']['post_install_ai_self_check_entry'],
): void {
  if (
    entry?.target_route !== '/guid' ||
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
      'session_scoped_opl_flow_context',
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
  assertStringArray(profile.first_run.full_readiness_layers, 'first_run.full_readiness_layers');
  assertStringArray(profile.first_run.deferred_blockers, 'first_run.deferred_blockers');
  assertStringArray(profile.first_run.first_conversation.must_wait_for, 'first_run.first_conversation.must_wait_for');
  assertStringArray(profile.first_run.first_conversation.must_not_wait_for, 'first_run.first_conversation.must_not_wait_for');
  assertStringArray(profile.first_run.beginner_presentation.primary_steps, 'first_run.beginner_presentation.primary_steps');
  assertPostInstallAiSelfCheckEntry(profile.first_run.beginner_presentation.post_install_ai_self_check_entry);
  if (
    profile.first_run.first_conversation.gate !== 'acp_warmup_before_initial_send' ||
    profile.first_run.first_conversation.source_command !== 'opl system initialize --json' ||
    profile.first_run.first_conversation.ready_to_launch_must_be_true !== true ||
    profile.first_run.first_conversation.failure_policy !== 'show_retryable_initial_message_error_without_losing_user_prompt'
  ) {
    throw new Error('App product profile first_run.first_conversation must gate initial send on ready_to_launch and ACP warmup');
  }
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
  if (
    JSON.stringify(profile.settings.visible_tabs) !==
    JSON.stringify(appOwnedSettingsTabs)
  ) {
    throw new Error('App product profile settings.visible_tabs must keep ordinary settings on OPL App-owned pages');
  }
  if (
    JSON.stringify(profile.settings.legacy_route_redirects) !==
    JSON.stringify(legacySettingsRouteRedirects)
  ) {
    throw new Error('App product profile settings.legacy_route_redirects must route legacy AionUI settings to App-owned pages');
  }
  const controlPlane = profile.settings.control_plane;
  if (!controlPlane || controlPlane.source_contract_ref !== 'contracts/app-settings-control-plane.json') {
    throw new Error('App product profile settings.control_plane must project contracts/app-settings-control-plane.json');
  }
  if (JSON.stringify(controlPlane.ordinary_visible_tabs) !== JSON.stringify(appOwnedSettingsTabs)) {
    throw new Error('App product profile settings.control_plane must keep ordinary settings tabs on App-owned pages');
  }
  if (JSON.stringify(controlPlane.ordinary_routes?.map((route) => route.id)) !== JSON.stringify(appOwnedSettingsTabs)) {
    throw new Error('App product profile settings.control_plane.ordinary_routes must describe every ordinary App settings route');
  }
  const controlPlaneRedirects = Object.fromEntries(
    Object.entries(controlPlane.legacy_route_redirects ?? {})
      .filter(([id]) => id !== 'about')
      .map(([id, target]) => [id, String(target).split('?')[0]]),
  );
  if (JSON.stringify(controlPlaneRedirects) !== JSON.stringify(legacySettingsRouteRedirects)) {
    throw new Error('App product profile settings.control_plane legacy redirects must match App-owned legacy redirects');
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
  if (JSON.stringify(groupIds) !== JSON.stringify(appOwnedSettingsIaGroups)) {
    throw new Error('App product profile settings_information_architecture must describe every Control Center IA group');
  }
  const primaryTabIds = Object.keys(settingsIa.primary_tabs ?? {});
  if (JSON.stringify(primaryTabIds) !== JSON.stringify(appOwnedSettingsPrimaryTabIds)) {
    throw new Error('App product profile settings_information_architecture.primary_tabs must describe every App settings page id');
  }
  if (JSON.stringify(settingsIa.secondary_page_ids ?? []) !== JSON.stringify(appOwnedSecondarySettingsPages)) {
    throw new Error('App product profile settings_information_architecture.secondary_page_ids must declare secondary settings pages');
  }
  const taskEntryPolicy = settingsIa.task_entry_policy;
  if (!taskEntryPolicy || typeof taskEntryPolicy !== 'object') {
    throw new Error('App product profile settings_information_architecture.task_entry_policy must be declared');
  }
  if (taskEntryPolicy.ordinary_entry_model !== 'user_task_first_sections_inside_the_seven_OPL_Control_Center_groups') {
    throw new Error('App product profile task_entry_policy must keep task entries inside the seven OPL Control Center groups');
  }
  assertIncludesAll(
    taskEntryPolicy.p0_entries ?? [],
    ['model_access', 'local_runtime_ability', 'workspace_entry', 'maintenance_hub', 'capability_status'],
    'settings_information_architecture.task_entry_policy.p0_entries',
  );
  assertIncludesAll(
    taskEntryPolicy.p1_entries ?? [],
    ['remote_access', 'advanced_deployment', 'developer_profile_status', 'external_tools_voice', 'custom_assistants'],
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
    developerProfile.opt_in_policy !== 'explicit_opt_in_only' ||
    developerProfile.hide_machine_status !== true
  ) {
    throw new Error('App product profile Developer Profile must preserve standard defaults and explicit opt-in policy');
  }
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
    developerProfile.capabilities.source_channel.standard_default !== 'agent_latest_package_channel' ||
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
  assertStringArray(
    profile.companion_payloads.packaged_not_default_visible_codex_skill_ids,
    'companion_payloads.packaged_not_default_visible_codex_skill_ids',
  );
  assertStringArray(profile.companion_payloads.companion_skill_sync_default_ids, 'companion_payloads.companion_skill_sync_default_ids');
  assertStringArray(profile.companion_payloads.domain_plugin_skill_ids, 'companion_payloads.domain_plugin_skill_ids');
  const visibleSkills = new Set(profile.codex.default_visible_skills);
  const defaultPackagedSkills = new Set(profile.companion_payloads.default_packaged_codex_skill_ids);
  const packagedExplicitSkills = new Set(profile.companion_payloads.packaged_not_default_visible_codex_skill_ids);
  for (const entry of skillProfiles) {
    const unpackagedProfileSkills = [...entry.required_skills, ...entry.optional_skills]
      .filter((skill) => !defaultPackagedSkills.has(skill));
    if (unpackagedProfileSkills.length > 0) {
      throw new Error(
        `App product profile assistant ${entry.assistant_id} references skills outside the App packaged set: ${unpackagedProfileSkills.join(', ')}`,
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
  const overlappingExplicitSkills = [...packagedExplicitSkills].filter((skill) => visibleSkills.has(skill));
  if (overlappingExplicitSkills.length > 0) {
    throw new Error(
      `App product profile packaged_not_default_visible skills must stay out of default_visible_skills: ${overlappingExplicitSkills.join(', ')}`,
    );
  }
  if (!defaultPackagedSkills.has('superpowers')) {
    throw new Error('App product profile must package superpowers when it is default visible');
  }
  assertIncludesAll(
    profile.companion_payloads.default_packaged_codex_skill_ids,
    requiredDefaultPackagedSkillIds,
    'companion_payloads.default_packaged_codex_skill_ids',
  );
  assertIncludesAll(
    profile.companion_payloads.companion_skill_sync_default_ids,
    requiredCompanionSkillSyncIds,
    'companion_payloads.companion_skill_sync_default_ids',
  );
  if (!packagedExplicitSkills.has('opl-meta-agent')) {
    throw new Error('App product profile must mark opl-meta-agent as packaged but not default visible');
  }
  if (profile.codex.skill_priority.includes('morph-ppt') || defaultPackagedSkills.has('morph-ppt') || packagedExplicitSkills.has('morph-ppt')) {
    throw new Error('App product profile must not include retired morph-ppt skill wiring');
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
  for (const domainPluginId of profile.companion_payloads.domain_plugin_skill_ids) {
    if (profile.companion_payloads.companion_skill_sync_default_ids.includes(domainPluginId)) {
      throw new Error(`App product profile companion sync defaults must not include domain plugin ${domainPluginId}`);
    }
  }
}

function assertCodexOplFlowContext(profile: AppProductProfile): void {
  if (
    profile.codex.opl_flow_context?.flow_id !== 'opl-flow' ||
    profile.codex.opl_flow_context.delivery !== 'session_scoped_preset_context' ||
    profile.codex.opl_flow_context.user_agents_policy !== 'respect_user_agents_no_overwrite_detect_conflicts' ||
    profile.codex.opl_flow_context.language_policy !== 'follow_ui_locale_zh_only_when_ui_zh'
  ) {
    throw new Error('App product profile must declare App-managed OPL Flow Context policy');
  }
  if (
    !Array.isArray(profile.codex.session_context_i18n?.['zh-CN']) ||
    !profile.codex.session_context_i18n['zh-CN'].some((line) => line.includes('你正在 One Person Lab App')) ||
    !Array.isArray(profile.codex.session_context_i18n?.['en-US']) ||
    !profile.codex.session_context_i18n['en-US'].some((line) => line.includes('You are working inside a Codex session'))
  ) {
    throw new Error('App product profile must declare localized OPL Flow session context');
  }
  const headDownMode = profile.codex.opl_flow_context.optional_user_modes?.head_down;
  if (
    !headDownMode ||
    headDownMode.id !== 'head_down' ||
    headDownMode.settings_key !== 'codex.oplFlowHeadDownMode' ||
    headDownMode.label_key !== 'settings.oplFlowHeadDownMode' ||
    headDownMode.description_key !== 'settings.oplFlowHeadDownModeDesc' ||
    headDownMode.prompt_line !== 'DO NOT send optional commentary' ||
    headDownMode.quick_action_label_key !== 'conversation.headDownQuickAction' ||
    headDownMode.quick_action_prompt !==
      'Spend time on thinking; you do not need to use the commentary channel to report progress to me.' ||
    headDownMode.quick_action_policy !== 'send_as_current_conversation_user_message_when_mode_enabled' ||
    headDownMode.injection_policy !== 'prepend_before_opl_flow_context'
  ) {
    throw new Error('App product profile must declare OPL Flow head_down prompt mode');
  }
}

function assertHomeCodexProfileShape(profile: AppProductProfile): void {
  assertAppProductProfileGuiAuthority(profile);
  assertAppProductProfileHomeCodexPolicy(profile, 'App product profile', {
    requireEnglishStatusLabel: true,
    requireSelectionPersistence: true,
  });
  assertStringArray(
    profile.gui.home.codex_auto_model_selection.frontier_model_preference_order,
    'gui.home.codex_auto_model_selection.frontier_model_preference_order',
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
  if (JSON.stringify(purposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'])) {
    throw new Error('App product profile GUI home purpose entries must route to MAS, MAG, RCA, and BookForge');
  }
  for (const entry of purposeEntries) {
    if (entry.display_policy !== 'purpose_first' || entry.home_entry_policy !== 'visible_click_to_start') {
      throw new Error(`App product profile GUI home purpose entry ${entry.id} must be purpose-first and click-to-start`);
    }
  }
  const shortcuts = profile.gui.home.home_agent_shortcuts ?? [];
  if (JSON.stringify(shortcuts.map((entry) => entry.shortcut_id)) !== JSON.stringify(starterShortcutIds)) {
    throw new Error('App product profile GUI home must expose configurable research, grant, ppt, and book package shortcuts');
  }
  if (JSON.stringify(shortcuts.map((entry) => entry.package_id)) !== JSON.stringify(starterPackageIds)) {
    throw new Error('App product profile GUI home shortcuts must target MAS, MAG, RCA, and BookForge packages');
  }
  for (const shortcut of shortcuts) {
    const expectedSkills = requiredSkillByPackageId[shortcut.package_id as keyof typeof requiredSkillByPackageId];
    if (
      shortcut.executor !== 'codex_cli' ||
      shortcut.source !== 'opl_app_home' ||
      shortcut.display_policy !== 'purpose_first' ||
      shortcut.home_entry_policy !== 'visible_click_to_start' ||
      shortcut.default_visible !== true ||
      shortcut.user_configurable !== true ||
      JSON.stringify(shortcut.required_skill_ids) !== JSON.stringify(expectedSkills)
    ) {
      throw new Error(`App product profile GUI home shortcut ${shortcut.shortcut_id} must be a configurable Codex package launch shortcut`);
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

function assertDefaultAssistantProfileShape(profile: AppProductProfile): void {
  const defaultAssistantIds = profile.gui.default_assistants?.map((assistant) => assistant.id) ?? [];
  if (JSON.stringify(defaultAssistantIds) !== JSON.stringify(['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'])) {
    throw new Error('App product profile default home assistants must be MAS, MAG, RCA, and BookForge');
  }
  const purposeLabels = profile.gui.default_assistants?.map((assistant) => assistant.home_purpose_label) ?? [];
  if (JSON.stringify(purposeLabels) !== JSON.stringify(['科研', '基金', '演示', '写书'])) {
    throw new Error('App product profile default assistants must expose purpose-first home labels');
  }
  for (const assistantId of ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge']) {
    if (!defaultAssistantIds.includes(assistantId)) {
      throw new Error(`App product profile missing default assistant ${assistantId}`);
    }
  }
  if (defaultAssistantIds.includes('mds') || defaultAssistantIds.includes('opl-meta-agent')) {
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
  const packages = profile.gui.professional_agent_packages ?? [];
  if (JSON.stringify(packages.map((entry) => entry.package_id)) !== JSON.stringify([...starterPackageIds, 'opl-meta-agent'])) {
    throw new Error('App product profile professional agent packages must declare MAS, MAG, RCA, BookForge, and OMA');
  }
  for (const entry of packages) {
    const requiredSkills = requiredSkillByPackageId[entry.package_id as keyof typeof requiredSkillByPackageId];
    const codexEntry = codexEntryByPackageId[entry.package_id as keyof typeof codexEntryByPackageId];
    if (!requiredSkills || !codexEntry) {
      throw new Error(`App product profile professional agent package ${entry.package_id} is not in the App package allowlist`);
    }
    if (
      entry.installed_manageable !== true ||
      entry.codex_visible_entry !== codexEntry ||
      JSON.stringify(entry.required_skill_ids) !== JSON.stringify(requiredSkills) ||
      entry.required_skill_policy !== 'checked_locked' ||
      entry.optional_skill_policy !== 'unchecked_user_selectable' ||
      entry.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible'
    ) {
      throw new Error(`App product profile professional agent package ${entry.package_id} has invalid shortcut or skill policy`);
    }
    if (starterPackageIds.includes(entry.package_id)) {
      if (entry.package_kind !== 'starter_professional_agent_package' || entry.default_home_visible !== true || entry.home_shortcut_ids.length !== 1) {
        throw new Error(`App product profile starter package ${entry.package_id} must be default home visible through one shortcut`);
      }
    }
    if (entry.package_id === 'opl-meta-agent' && (
      entry.package_kind !== 'managed_professional_agent_package' ||
      entry.default_home_visible !== false ||
      entry.home_shortcut_ids.length !== 0
    )) {
      throw new Error('App product profile must keep OMA installed/manageable but out of default home shortcuts');
    }
  }
}

function assertAssistantSkillProfiles(
  profile: AppProductProfile,
): AppProductProfile['gui']['assistant_skill_profiles'] {
  const skillProfiles = profile.gui.assistant_skill_profiles ?? [];
  if (JSON.stringify(skillProfiles.map((entry) => entry.assistant_id)) !== JSON.stringify(['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'])) {
    throw new Error('App product profile assistant skill profiles must target MAS, MAG, RCA, and BookForge');
  }
  const requiredByAssistant = new Map(skillProfiles.map((entry) => [entry.assistant_id, entry.required_skills]));
  for (const assistantId of ['med-autoscience', 'med-autogrant', 'redcube-ai']) {
    const requiredSkills = requiredByAssistant.get(assistantId);
    if (JSON.stringify(requiredSkills) !== JSON.stringify(requiredSkillByPackageId[assistantId as keyof typeof requiredSkillByPackageId])) {
      throw new Error(`App product profile assistant ${assistantId} must require its matching Codex skill`);
    }
  }
  if (JSON.stringify(requiredByAssistant.get('opl-bookforge')) !== JSON.stringify(['opl-bookforge'])) {
    throw new Error('App product profile assistant opl-bookforge must require the opl-bookforge Codex skill');
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
  const oma = profile.gui.non_default_assistants?.find((assistant) => assistant.id === 'opl-meta-agent');
  if (!oma || oma.home_default_visible !== false || oma.home_entry_policy !== 'explicit_or_settings_only') {
    throw new Error('App product profile must keep OMA available but out of default home entries');
  }
}

function assertProfileShape(profile: AppProductProfile): void {
  assertAppProductProfileIdentity(profile);
  assertDefaultCodexSessionProfile(profile);
  assertCodexOplFlowContext(profile);
  assertHomeCodexProfileShape(profile);
  assertHomePurposeEntries(profile);
  assertHomeActivityCenterPolicy(profile);
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
  return profile;
}
