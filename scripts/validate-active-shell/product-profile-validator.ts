import path from 'node:path';
import { assertDeepEqualJson, assertForbiddenCapabilityPolicy, assertIncludesAll } from './assertions.ts';
import {
  appOwnedSettingsTabs,
  defaultCompanionSkillSyncIds,
  deferredMaintenanceItems,
  domainExposureEntries,
  ecosystemModuleIds,
  firstConversationFailurePolicy,
  firstConversationMustWaitFor,
  firstRunChecklistFields,
  firstRunCoreItems,
  firstRunProgressFields,
  firstRunProgressSourceCommand,
  firstRunProgressSourcePath,
  firstRunProgressVisibleElements,
  firstRunRendererTruthPolicy,
  firstRunSetupFlowFields,
  forbiddenAuthorityOwners,
  fullReadinessItems,
  legacySettingsRouteRedirects,
  requiredHostTools,
} from './app-contract-constants.ts';
import {
  defaultActiveShellContractPath,
  firstRunMatrixPath,
  installExposurePolicyPath,
  pageStateMatrixPath,
  root,
  assertFile,
} from './validation-config.ts';
import { validateBeginnerFirstRunPresentation, validateOplFlowContext } from './shared-contract-validators.ts';

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

function validateProductProfileIdentity(profile) {
  if (profile.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected product profile owner: ${profile.owner}`);
  }
  if (profile.purpose !== 'app_owned_product_profile') {
    throw new Error(`Unexpected product profile purpose: ${profile.purpose}`);
  }
  if (profile.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected product profile repo: ${profile.app_repo}`);
  }
}

function validateProductProfileContractRefs(profile) {
  for (const [label, expected] of Object.entries({
    active_shell: defaultActiveShellContractPath,
    page_state: pageStateMatrixPath,
    first_run: firstRunMatrixPath,
    install_exposure: installExposurePolicyPath,
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
  validateOplFlowContext(profile.codex?.opl_flow_context, 'Product profile OPL Flow Context');
  const sessionContextI18n = profile.codex?.session_context_i18n;
  if (
    !Array.isArray(sessionContextI18n?.['zh-CN']) ||
    !sessionContextI18n['zh-CN'].some((line) => typeof line === 'string' && line.includes('你正在 One Person Lab App')) ||
    !Array.isArray(sessionContextI18n?.['en-US']) ||
    !sessionContextI18n['en-US'].some((line) => typeof line === 'string' && line.includes('You are working inside a Codex session'))
  ) {
    throw new Error('Product profile must declare localized OPL Flow session context');
  }
  if (profile.default_session_profile?.provider !== 'gflab') {
    throw new Error(`Unexpected product profile provider: ${profile.default_session_profile?.provider}`);
  }
  if (profile.default_session_profile?.base_url !== 'https://gflabtoken.cn/v1') {
    throw new Error(`Unexpected product profile base URL: ${profile.default_session_profile?.base_url}`);
  }
  if (profile.default_session_profile?.executor !== 'codex_cli') {
    throw new Error(`Unexpected product profile executor: ${profile.default_session_profile?.executor}`);
  }
  if (profile.default_session_profile?.model !== 'gpt-5.5') {
    throw new Error(`Unexpected product profile model: ${profile.default_session_profile?.model}`);
  }
  if (profile.default_session_profile?.reasoning_effort !== 'xhigh') {
    throw new Error(`Unexpected product profile reasoning effort: ${profile.default_session_profile?.reasoning_effort}`);
  }
  if (profile.default_session_profile?.model !== profile.codex?.default_model) {
    throw new Error('Product profile default_session_profile.model must match codex.default_model');
  }
  if (profile.default_session_profile?.reasoning_effort !== profile.codex?.default_reasoning_effort) {
    throw new Error('Product profile default_session_profile.reasoning_effort must match codex.default_reasoning_effort');
  }
  if (profile.gui?.authority !== 'app_repo_owned_product_truth') {
    throw new Error('Product profile GUI authority must be App-owned');
  }
  if (profile.gui?.implementation_carrier !== 'opl-aion-shell') {
    throw new Error('Product profile GUI implementation carrier must be opl-aion-shell');
  }
  if (
    profile.gui.appearance?.default_css_theme_id !== 'default-theme' ||
    profile.gui.appearance?.codex_theme_default_enabled !== false
  ) {
    throw new Error('Product profile GUI appearance must default to the default theme');
  }
  if (
    profile.gui.home?.primary_input_surface !== 'single_card' ||
    profile.gui.home?.nested_input_card_frames_allowed !== false ||
    profile.gui.home?.codex_cli_fixed_executor !== true ||
    profile.gui.home?.home_executor_selector_visible !== false ||
    profile.gui.home?.codex_model_selector_visible !== true ||
    profile.gui.home?.codex_model_list_visible !== true ||
    profile.gui.home?.codex_model_policy !== 'codex_cli_latest_strongest_model_selector_visible' ||
    profile.gui.home?.codex_model_auto_option_visible !== true ||
    profile.gui.home?.codex_default_model !== profile.codex?.default_model ||
    profile.gui.home?.codex_default_reasoning_effort !== profile.codex?.default_reasoning_effort ||
    profile.gui.home?.codex_default_permission_mode !== 'full-access' ||
    profile.gui.home?.permission_mode_selector_visible !== false ||
    profile.gui.home?.conversation_backend_selector_visible !== false ||
    profile.gui.home?.conversation_model_selector_visible !== true ||
    profile.gui.home?.conversation_permission_mode_selector_visible !== false ||
    profile.gui.home?.codex_home_model_status_label !== 'GPT-5.5（超高）' ||
    profile.gui.home?.codex_precise_model_display_policy !== 'friendly_default_model_and_reasoning_visible'
  ) {
    throw new Error('Product profile GUI home must keep Codex CLI fixed while exposing App-owned model selectors');
  }
  if (
    profile.gui.home.codex_auto_model_selection?.strategy !== 'codex_cli_auto_latest_available_frontier' ||
    profile.gui.home.codex_auto_model_selection.user_can_override_model !== true ||
    profile.gui.home.codex_auto_model_selection.user_can_restore_auto !== true
  ) {
    throw new Error('Product profile GUI home must expose App-owned Codex model selection on the home path');
  }
  const modelDisplayOptions = profile.gui.home.codex_model_display_options;
  const frontierModelPreferenceOrder = profile.gui.home.codex_auto_model_selection.frontier_model_preference_order;
  if (
    modelDisplayOptions?.display_policy !== 'friendly_model_name_and_reasoning_for_every_visible_option' ||
    modelDisplayOptions.raw_model_id_visible_in_ordinary_ui !== false ||
    modelDisplayOptions.reasoning_effort_visible_for_every_option !== true ||
    modelDisplayOptions.default_reasoning_effort !== profile.codex.default_reasoning_effort ||
    modelDisplayOptions.auto_option?.label_zh !== '自动（推荐）' ||
    modelDisplayOptions.auto_option?.label_en !== 'Auto (recommended)' ||
    modelDisplayOptions.auto_option?.resolved_model !== profile.codex.default_model ||
    modelDisplayOptions.auto_option?.resolved_reasoning_effort !== profile.codex.default_reasoning_effort ||
    modelDisplayOptions.auto_option?.follows_latest_strongest !== true ||
    modelDisplayOptions.fixed_model_description_zh !== '固定此模型' ||
    modelDisplayOptions.fixed_model_description_en !== 'Use this model' ||
    modelDisplayOptions.reasoning_labels?.xhigh?.zh !== '推理超高' ||
    modelDisplayOptions.reasoning_labels?.xhigh?.en !== 'Ultra reasoning' ||
    JSON.stringify((modelDisplayOptions.visible_models ?? []).map((model) => model.id)) !== JSON.stringify(frontierModelPreferenceOrder)
  ) {
    throw new Error('Product profile GUI home must expose friendly Codex model display options with reasoning labels');
  }
  for (const model of modelDisplayOptions.visible_models ?? []) {
    if (
      typeof model.label_zh !== 'string' ||
      typeof model.label_en !== 'string' ||
      model.label_zh === model.id ||
      model.label_en === model.id ||
      model.reasoning_effort !== profile.codex.default_reasoning_effort
    ) {
      throw new Error(`Product profile GUI home Codex model ${model.id} must use friendly labels and default reasoning`);
    }
  }
  if (
    profile.gui.builtin_assistant_route_receipt_policy?.scope !== 'home_purpose_entry_to_conversation' ||
    profile.gui.builtin_assistant_route_receipt_policy.route_kind !== 'builtin_capability' ||
    profile.gui.builtin_assistant_route_receipt_policy.executor !== 'codex_cli' ||
    profile.gui.builtin_assistant_route_receipt_policy.source !== 'opl_app_home' ||
    profile.gui.builtin_assistant_route_receipt_policy.must_not_depend_on_visible_backend_selection !== true
  ) {
    throw new Error('Product profile must require built-in assistant Codex CLI route receipts');
  }
  assertIncludesAll(
    profile.gui.builtin_assistant_route_receipt_policy.required_for_assistants,
    ['mas', 'mag', 'rca'],
    'Product profile route receipt assistants',
  );
  assertIncludesAll(
    profile.gui.builtin_assistant_route_receipt_policy.required_fields,
    ['route_kind', 'executor', 'assistant_id', 'assistant_short_name', 'source'],
    'Product profile route receipt fields',
  );
  const homePurposeEntries = profile.gui.home.home_purpose_entries ?? [];
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.id)) !== JSON.stringify(['research', 'grant', 'ppt'])) {
    throw new Error('Product profile GUI home must expose research, grant, and ppt purpose entries');
  }
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('Product profile GUI home purpose entries must target MAS, MAG, and RCA');
  }
  if (JSON.stringify((profile.gui.default_assistants ?? []).map((assistant) => assistant.id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('Product profile default assistants must be MAS, MAG, and RCA only');
  }
  assertDeepEqualJson(
    profile.settings?.visible_tabs,
    appOwnedSettingsTabs,
    'Product profile ordinary settings visible tabs',
  );
  assertDeepEqualJson(
    profile.settings?.legacy_route_redirects,
    legacySettingsRouteRedirects,
    'Product profile legacy settings route redirects',
  );
  const productSkillProfiles = profile.gui.assistant_skill_profiles ?? [];
  if (JSON.stringify(productSkillProfiles.map((entry) => entry.assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('Product profile assistant skill profiles must target MAS, MAG, and RCA');
  }
  const defaultPackagedSkillIds = new Set(profile.companion_payloads?.default_packaged_codex_skill_ids ?? []);
  for (const entry of productSkillProfiles) {
    if (JSON.stringify(entry.required_skills) !== JSON.stringify([entry.assistant_id])) {
      throw new Error(`Product profile assistant ${entry.assistant_id} must require its matching skill`);
    }
    if (entry.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible') {
      throw new Error(`Product profile assistant ${entry.assistant_id} has invalid home skill menu policy`);
    }
    if (entry.optional_skills?.includes('morph-ppt')) {
      throw new Error(`Product profile assistant ${entry.assistant_id} must not expose retired morph-ppt skill wiring`);
    }
    if ('hidden_home_skill_names' in entry) {
      throw new Error(`Product profile assistant ${entry.assistant_id} must not carry UI hiding policy`);
    }
    const unpackagedProfileSkills = [...(entry.required_skills ?? []), ...(entry.optional_skills ?? [])]
      .filter((skill) => !defaultPackagedSkillIds.has(skill));
    if (unpackagedProfileSkills.length > 0) {
      throw new Error(
        `Product profile assistant ${entry.assistant_id} references skills outside the App packaged set: ${unpackagedProfileSkills.join(', ')}`,
      );
    }
  }
  for (const assistant of profile.gui.default_assistants ?? []) {
    if (assistant.home_entry_policy !== 'purpose_entry_target' || assistant.home_entry_display_policy !== 'purpose_first') {
      throw new Error(`Product profile default assistant ${assistant.id} must be a purpose-first entry target`);
    }
  }
  const oma = (profile.gui.non_default_assistants ?? []).find((assistant) => assistant.id === 'oma');
  if (!oma || oma.home_default_visible !== false || oma.home_entry_policy !== 'explicit_or_settings_only') {
    throw new Error('Product profile must keep OMA available but out of default home entries');
  }
  for (const retiredModel of ['gpt-5.2-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini']) {
    if (!profile.gui.home?.retired_codex_models_must_not_be_exposed?.includes(retiredModel)) {
      throw new Error(`Product profile GUI home must ban retired Codex model ${retiredModel}`);
    }
  }
  if (!Array.isArray(profile.codex?.default_visible_skills) || !profile.codex.default_visible_skills.includes('mineru-document-extractor')) {
    throw new Error('Product profile must include mineru-document-extractor as a default visible skill');
  }
  if (!Array.isArray(profile.codex?.default_visible_skills) || !profile.codex.default_visible_skills.includes('ui-ux-pro-max')) {
    throw new Error('Product profile must include ui-ux-pro-max as a default visible skill');
  }
  if (!Array.isArray(profile.codex?.default_visible_skills) || !profile.codex.default_visible_skills.includes('superpowers')) {
    throw new Error('Product profile must include superpowers as a default visible packaged skill');
  }
  for (const skillId of defaultCompanionSkillSyncIds) {
    if (!profile.codex.default_visible_skills.includes(skillId)) {
      throw new Error(`Product profile must include ${skillId} as a default visible skill`);
    }
  }
  if (!Array.isArray(profile.companion_payloads?.default_packaged_codex_skill_ids) || !profile.companion_payloads.default_packaged_codex_skill_ids.includes('superpowers')) {
    throw new Error('Product profile must include superpowers in default packaged Codex skills');
  }
  for (const skillId of defaultCompanionSkillSyncIds) {
    if (!profile.companion_payloads.default_packaged_codex_skill_ids.includes(skillId)) {
      throw new Error(`Product profile must include ${skillId} in default packaged Codex skills`);
    }
  }
  if (
    !Array.isArray(profile.companion_payloads?.packaged_not_default_visible_codex_skill_ids) ||
    !profile.companion_payloads.packaged_not_default_visible_codex_skill_ids.includes('opl-meta-agent')
  ) {
    throw new Error('Product profile must mark OPL Meta Agent as packaged but not default visible');
  }
  if (
    profile.codex.skill_priority.includes('morph-ppt') ||
    profile.companion_payloads.default_packaged_codex_skill_ids.includes('morph-ppt') ||
    profile.companion_payloads.packaged_not_default_visible_codex_skill_ids.includes('morph-ppt')
  ) {
    throw new Error('Product profile must not include retired morph-ppt skill wiring');
  }
  validateOrdinaryCapabilitySelectorPolicy(profile);
}

function validateOrdinaryCapabilitySelectorPolicy(profile) {
  const policy = profile.gui?.ordinary_capability_selector_policy;
  if (
    policy?.scope !== 'home_composer_and_ordinary_conversation' ||
    policy?.authority !== 'app_owned_opl_allowlist' ||
    policy?.skill_source_ref !== 'gui.assistant_skill_profiles.required_skills + optional_skills' ||
    policy?.mcp_server_source_ref !== 'gui.ordinary_capability_selector_policy.visible_mcp_server_ids' ||
    policy?.mcp_menu_policy !== 'empty_until_app_explicitly_whitelists_opl_mcp_servers' ||
    policy?.conversation_loaded_mcp_display_policy !== 'filter_to_visible_mcp_server_ids'
  ) {
    throw new Error('Product profile ordinary capability selector must be an App-owned OPL allowlist');
  }
  assertDeepEqualJson(policy.visible_mcp_server_ids, [], 'Product profile ordinary MCP allowlist');
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
  if (policy.conversation_snapshot_policy !== 'scrub_disabled_team_mcp_and_team_metadata_before_rendering_or_inheriting_ordinary_conversations') {
    throw new Error('Product profile ordinary selector must scrub disabled Team MCP snapshots');
  }
}

function validateFullFirstInstallCoreReadyPolicy(profile) {
  if (JSON.stringify(profile.first_run?.readiness_layers) !== JSON.stringify(['core'])) {
    throw new Error('Product profile ready_to_launch readiness_layers must contain only core');
  }
  validateBeginnerFirstRunPresentation(
    profile.first_run?.beginner_presentation,
    'Product profile first-run beginner presentation',
  );
  const launchGate = profile.first_run?.ready_to_launch_gate;
  if (launchGate?.id !== 'ready_to_launch' || launchGate?.ui_order !== 'before_guid') {
    throw new Error('Product profile ready_to_launch gate must run before /guid');
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
  const firstConversation = profile.first_run?.first_conversation;
  if (
    firstConversation?.gate !== 'acp_warmup_before_initial_send' ||
    firstConversation?.source_command !== firstRunProgressSourceCommand ||
    firstConversation?.ready_to_launch_must_be_true !== true ||
    firstConversation?.failure_policy !== firstConversationFailurePolicy
  ) {
    throw new Error('Product profile first conversation must gate initial send on ready_to_launch and ACP warmup');
  }
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
  const progressModel = profile.first_run?.progress_model;
  if (progressModel?.source_command !== firstRunProgressSourceCommand) {
    throw new Error('Product profile first-run progress model must use opl system initialize --json');
  }
  if (progressModel?.source_path !== firstRunProgressSourcePath) {
    throw new Error('Product profile first-run progress model must read system_initialize.setup_flow');
  }
  if (progressModel?.renderer_truth_policy !== firstRunRendererTruthPolicy) {
    throw new Error('Product profile first-run progress model must keep renderers as display-only consumers');
  }
  assertIncludesAll(
    progressModel?.required_setup_flow_fields,
    firstRunSetupFlowFields,
    'Product profile first-run progress setup_flow fields',
  );
  assertIncludesAll(
    progressModel?.required_progress_fields,
    firstRunProgressFields,
    'Product profile first-run progress fields',
  );
  assertIncludesAll(
    progressModel?.required_checklist_fields,
    firstRunChecklistFields,
    'Product profile first-run progress checklist fields',
  );
  assertIncludesAll(
    progressModel?.required_visible_elements,
    firstRunProgressVisibleElements,
    'Product profile first-run progress visible elements',
  );
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
  for (const moduleId of ecosystemModuleIds) {
    if (!profile.companion_payloads?.ecosystem_modules?.includes(moduleId)) {
      throw new Error(`Product profile must list ${moduleId} as ecosystem module`);
    }
    if (profile.companion_payloads?.management_authority?.[moduleId] !== 'app_or_cli_managed') {
      throw new Error(`Product profile must mark ${moduleId} as App/CLI managed`);
    }
  }
  assertIncludesAll(
    profile.companion_payloads?.domain_plugin_skill_ids,
    ['mas', 'mag', 'rca'],
    'Product profile domain plugin skill ids',
  );
  assertIncludesAll(
    profile.companion_payloads?.companion_skill_sync_default_ids,
    defaultCompanionSkillSyncIds,
    'Product profile companion skill sync default ids',
  );
  if (profile.companion_payloads.domain_plugin_skills_must_not_be_companion_mirrors !== true) {
    throw new Error('Product profile domain plugin skills must not be companion skill mirrors');
  }
  for (const domainPluginId of profile.companion_payloads.domain_plugin_skill_ids ?? []) {
    if (profile.companion_payloads.companion_skill_sync_default_ids?.includes(domainPluginId)) {
      throw new Error(`Product profile companion skill sync defaults must not include domain plugin ${domainPluginId}`);
    }
  }
  const exposureById = new Map((profile.companion_payloads?.domain_exposure ?? []).map((entry) => [entry.domain_id, entry]));
  for (const expected of domainExposureEntries) {
    const entry = exposureById.get(expected.domain_id);
    if (!entry) {
      throw new Error(`Product profile companion payloads missing domain exposure ${expected.domain_id}`);
    }
    if (entry.codex_visible_entry !== expected.codex_visible_entry) {
      throw new Error(`Product profile domain exposure ${expected.domain_id}.codex_visible_entry must be ${expected.codex_visible_entry}`);
    }
    if (entry.preferred_app_distribution !== expected.preferred_app_distribution) {
      throw new Error(`Product profile domain exposure ${expected.domain_id}.preferred_app_distribution must be ${expected.preferred_app_distribution}`);
    }
    if (entry.direct_skill_semantics_required !== true) {
      throw new Error(`Product profile domain exposure ${expected.domain_id} must require direct skill semantics`);
    }
  }
}

function validateProductProfileBoundary(profile) {
  for (const forbidden of forbiddenAuthorityOwners) {
    if (!profile.boundary?.app_does_not_own?.includes(forbidden)) {
      throw new Error(`Product profile boundary must exclude ${forbidden}`);
    }
  }
}

export function validateProductProfile(profile, installExposurePolicy) {
  validateProductProfileIdentity(profile);
  validateProductProfileContractRefs(profile);
  validateProductProfileCodexDefaults(profile);
  validateFullFirstInstallCoreReadyPolicy(profile);
  validateStandardPackagePolicy(profile);
  validateCommandLineToolsPolicy(profile);
  validateStandardUpdatePolicy(profile);
  validateCompanionPayloadAuthority(profile, installExposurePolicy);
  validateProductProfileBoundary(profile);
}
