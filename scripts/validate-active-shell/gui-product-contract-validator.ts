import { assertDeepEqualJson, assertForbiddenCapabilityPolicy, assertIncludesAll } from './assertions.ts';
import {
  appOwnedDeveloperProfileCapabilityAxes,
  appOwnedSettingsTabs,
  beginnerFirstRunTestIds,
  firstRunChecklistFields,
  firstRunCoreItems,
  firstRunProgressFields,
  firstRunProgressSourceCommand,
  firstRunProgressSourcePath,
  firstRunProgressVisibleElements,
  firstRunRendererTruthPolicy,
  firstRunSetupFlowFields,
  fullReadinessItems,
  homeActivityCenterForbiddenDisplays,
  legacySettingsRouteRedirects,
  ordinaryHiddenLegacySettingsTabs,
  settingsPageExpectations,
} from './app-contract-constants.ts';
import { validateGuiFrameworkSurfaces } from './gui-framework-surfaces-validator.ts';
import { validateGuiProductHomeContract } from './gui-product-home-validator.ts';
import { assertCommandSurface } from './value-helpers.ts';
import {
  validateManagedUpdatePageBasics,
  validateManagedUpdatePlaneBinding,
} from './managed-update-plane-validator.ts';
import {
  validateArtifactNativeDrilldownProjectionContract,
  validateBeginnerFirstRunPresentation,
  validateOplFlowContext,
  validateProviderReadinessRepairProjectionContract,
  validateProgressDeltaDisplayContract,
  validateStateIndexSidecarProjectionContract,
  validateUserTaskStatusProjectionContract,
} from './shared-contract-validators.ts';

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

const aionuiTeamProbeIds = [
  'team_mode_disabled',
  'team_route_redirect',
  'team_sidebar_gate',
  'team_created_redirect_noop',
  'ordinary_conversation_team_snapshot_scrub',
  'agent_switching_drops_team_mcp',
  'team_deep_link_not_whitelisted',
  'team_bridge_mutation_gate',
];

function validateManagedUpdatePageSurface(page, label) {
  validateManagedUpdatePageBasics(page, label, {
    actionSourceError: `${label} must expose managed update actions through the shell IPC bridge`,
  });
  validateManagedUpdatePlaneBinding(page?.managed_update_plane, label, {
    requirePageId: true,
    requireStateSources: true,
    requireStatusConsumptionPolicy: true,
    bindingError: `${label} must bind to the App managed update plane as a status/action consumer`,
  });
}

export function validateAppGuiProductContract(guiContract, releaseChannel, installExposurePolicy) {
  validateGuiProductHomeContract(guiContract);
  validateGuiFrameworkSurfaces(guiContract, releaseChannel, installExposurePolicy);

  if (guiContract.theme_and_branding?.default_theme_id !== 'default-theme') {
    throw new Error('App GUI default theme must be default-theme');
  }
  for (const themeId of ['codex', 'default-theme']) {
    if (!guiContract.theme_and_branding.allowed_theme_ids?.includes(themeId)) {
      throw new Error(`App GUI theme list must include ${themeId}`);
    }
  }
  for (const section of ['general', 'access', 'capabilities', 'environment', 'appearance', 'advanced', 'about', 'update', 'theme']) {
    if (!guiContract.settings_navigation?.required_sections?.includes(section)) {
      throw new Error(`App GUI settings navigation must include ${section}`);
    }
  }
  assertDeepEqualJson(
    guiContract.settings_navigation?.ordinary_visible_tabs,
    appOwnedSettingsTabs,
    'App GUI settings navigation ordinary visible tabs',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation?.legacy_route_redirects,
    legacySettingsRouteRedirects,
    'App GUI settings navigation legacy route redirects',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation?.ordinary_hidden_legacy_tabs,
    ordinaryHiddenLegacySettingsTabs,
    'App GUI settings navigation ordinary hidden legacy tabs',
  );
  assertIncludesAll(
    guiContract.settings_navigation?.ordinary_hidden_upstream_surfaces,
    ['AionUI Team', 'Team nav entry', 'Team leader configuration', 'team deep link navigation'],
    'App GUI settings hidden upstream surfaces',
  );
  for (const [field, expected] of Object.entries({
    ordinary_visible: false,
    route_policy: 'disabled_or_redirect_to_app_owned_home',
    deep_link_policy: 'not_whitelisted',
    rationale: 'upstream AionUI Team is configured around shell-local agents and is not an OPL ordinary-user capability',
  })) {
    if (guiContract.settings_navigation?.team_surface_policy?.[field] !== expected) {
      throw new Error(`App GUI settings team_surface_policy.${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    guiContract.settings_navigation.team_surface_policy.required_probes,
    aionuiTeamProbeIds,
    'App GUI Team surface required probes',
  );
  if (guiContract.settings_navigation.source !== 'opl app state --profile fast --json') {
    throw new Error('App GUI settings navigation must default to fast App state');
  }
  if (guiContract.settings_navigation.refresh_source !== 'opl app state --profile fast --json') {
    throw new Error('App GUI settings navigation refresh must use fast App state');
  }
  const firstLaunchPolicy = guiContract.first_launch_readiness_policy;
  if (firstLaunchPolicy?.launch_gate !== 'ready_to_launch' || firstLaunchPolicy?.ui_order !== 'before_guid') {
    throw new Error('App GUI first-launch readiness must gate ready_to_launch before /guid');
  }
  for (const item of firstRunCoreItems) {
    if (!firstLaunchPolicy?.core_required_items?.includes(item)) {
      throw new Error(`App GUI first-launch readiness must require Core item ${item}`);
    }
  }
  for (const item of fullReadinessItems) {
    if (!firstLaunchPolicy?.full_readiness_items?.includes(item)) {
      throw new Error(`App GUI first-launch readiness must keep ${item} in full readiness`);
    }
  }
  for (const [field, expected] of Object.entries({
    full_readiness_blocks_launch: false,
    default_provider: 'gflab',
    default_base_url: 'https://gflabtoken.cn/v1',
    default_model: 'gpt-5.5',
    default_reasoning_effort: 'xhigh',
    default_executor: 'codex_cli',
    full_runtime_provider: 'temporal',
  })) {
    if (firstLaunchPolicy?.[field] !== expected) {
      throw new Error(`App GUI first-launch readiness ${field} must be ${expected}`);
    }
  }
  validateBeginnerFirstRunPresentation(
    firstLaunchPolicy?.beginner_presentation,
    'App GUI first-launch beginner presentation',
  );
  const firstLaunchProgressModel = firstLaunchPolicy?.progress_model;
  if (firstLaunchProgressModel?.source_command !== firstRunProgressSourceCommand) {
    throw new Error('App GUI first-launch progress model must use opl system initialize --json');
  }
  if (firstLaunchProgressModel?.source_path !== firstRunProgressSourcePath) {
    throw new Error('App GUI first-launch progress model must read system_initialize.setup_flow');
  }
  if (firstLaunchProgressModel?.renderer_truth_policy !== firstRunRendererTruthPolicy) {
    throw new Error('App GUI first-launch progress model must keep the shell as render-only');
  }
  assertIncludesAll(
    firstLaunchProgressModel?.required_setup_flow_fields,
    firstRunSetupFlowFields,
    'App GUI first-launch progress setup_flow fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_progress_fields,
    firstRunProgressFields,
    'App GUI first-launch progress fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_checklist_fields,
    firstRunChecklistFields,
    'App GUI first-launch progress checklist fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_visible_elements,
    firstRunProgressVisibleElements,
    'App GUI first-launch progress visible elements',
  );

  const modulePathPolicy = guiContract.module_path_source_policy;
  if (modulePathPolicy?.source !== 'app_state.modules[].source + app_state.modules[].path + app_state.paths') {
    throw new Error('App GUI module path explanation must come from App state module/path refs');
  }
  for (const explanation of [
    'whether a module comes from the bundled Full runtime payload',
    'whether a module comes from the App/CLI-managed GHCR agent package channel',
    'whether a module comes from the App/CLI-managed GHCR agent package channel moving tags',
    'whether a module comes from a local domain repository checkout',
    'whether Developer Profile source_channel uses a GitHub repo or local checkout',
    'whether a module is managed by App/CLI maintenance',
    'that module path display is refs-only and not domain truth authority',
  ]) {
    if (!modulePathPolicy.must_explain?.includes(explanation)) {
      throw new Error(`App GUI module path source policy must explain ${explanation}`);
    }
  }
  if (
    modulePathPolicy.ordinary_user_source !== 'app_cli_managed_ghcr_agent_package_channel' ||
    modulePathPolicy.ordinary_user_transport !== 'app_cli_managed'
  ) {
    throw new Error('App GUI module path source policy must keep ordinary users on App/CLI-managed package maintenance');
  }
  if (modulePathPolicy.developer_override_surface !== 'Developer Profile source_channel capability') {
    throw new Error('App GUI module path source policy must route repo/checkout override through Developer Profile source_channel');
  }
  if (modulePathPolicy.developer_override_policy !== 'explicit_opt_in_only') {
    throw new Error('App GUI module path source policy must require explicit opt-in for Developer Profile checkout override');
  }
  if (modulePathPolicy.developer_profile_ref !== 'developer_profile.capabilities.source_channel') {
    throw new Error('App GUI module path source policy must link to Developer Profile source_channel');
  }
  if (!modulePathPolicy.must_not_use?.includes('raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI')) {
    throw new Error('App GUI module path source policy must not expose raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI');
  }

  const developerProfile = guiContract.developer_profile;
  if (!developerProfile || typeof developerProfile !== 'object') {
    throw new Error('App GUI contract must declare Developer Profile capabilities');
  }
  assertDeepEqualJson(
    developerProfile.capability_axes,
    appOwnedDeveloperProfileCapabilityAxes,
    'App GUI Developer Profile capability axes',
  );
  if (
    developerProfile.default_profile !== 'standard_user' ||
    developerProfile.opt_in_policy !== 'explicit_opt_in_only' ||
    developerProfile.ordinary_user_defaults?.source_channel !== 'agent_latest_package_channel' ||
    developerProfile.ordinary_user_defaults?.agent_automation !== 'silent_background_agent_package_updates'
  ) {
    throw new Error('App GUI Developer Profile must preserve standard user defaults and explicit opt-in');
  }
  for (const axis of appOwnedDeveloperProfileCapabilityAxes) {
    const capability = developerProfile.capabilities?.[axis];
    if (!capability?.standard_default || !capability.developer_opt_in || !capability.display_policy) {
      throw new Error(`App GUI Developer Profile capability ${axis} must declare defaults, opt-in, and display policy`);
    }
  }
  if (
    developerProfile.capabilities.source_channel.developer_opt_in !== 'github_repo_or_local_checkout' ||
    developerProfile.capabilities.agent_automation.standard_default !== 'silent_background_agent_package_updates' ||
    developerProfile.capabilities.runtime_mutation_scope.standard_default !== 'app_action_route_only' ||
    'legacy_developer_mode_alias' in developerProfile ||
    !developerProfile.must_not_show?.includes('single Developer Mode switch as the only capability expression')
  ) {
    throw new Error('App GUI Developer Profile must display capabilities without legacy Developer Mode aliases');
  }

  for (const lane of releaseChannel.release_validation_profiles.stable.required_lanes) {
    if (!guiContract.release_channel_policy?.stable?.must_gate?.includes(lane)) {
      throw new Error(`App GUI stable release policy must gate ${lane}`);
    }
  }
  for (const lane of releaseChannel.release_validation_profiles.nightly_standard.required_lanes) {
    if (!guiContract.release_channel_policy?.nightly?.must_gate?.includes(lane)) {
      throw new Error(`App GUI nightly release policy must gate ${lane}`);
    }
  }
  for (const lane of releaseChannel.release_validation_profiles.nightly_standard.forbidden_lanes) {
    if (!guiContract.release_channel_policy?.nightly?.must_not_gate?.includes(lane)) {
      throw new Error(`App GUI nightly release policy must exclude ${lane}`);
    }
  }

  const pages = guiContract.pages ?? {};
  for (const pageId of [
    'guid_home',
    'settings_general',
    'settings_access',
    'settings_capabilities',
    'settings_environment',
    'settings_advanced',
    'about',
    'update',
    'settings_theme',
    'runtime_status',
  ]) {
    if (!pages[pageId]) {
      throw new Error(`App GUI contract missing page ${pageId}`);
    }
  }
  for (const pageId of [
    'guid_home',
    'settings_general',
    'settings_access',
    'settings_capabilities',
    'settings_environment',
    'settings_advanced',
    'about',
    'update',
    'settings_theme',
  ]) {
    assertCommandSurface(pages[pageId].state_source, 'opl app state --profile fast --json', `App GUI ${pageId} state source`);
    assertCommandSurface(pages[pageId].refresh_source, 'opl app state --profile fast --json', `App GUI ${pageId} refresh source`);
  }
  if (!pages.guid_home.must_show?.includes('purpose-first assistants Research/Grant/Presentation/Book as click-to-start entries')) {
    throw new Error('App GUI home must show purpose-first Research/Grant/Presentation/Book entries');
  }
  if (!pages.guid_home.must_show?.includes('selected assistant shown as a compact @ purpose tag')) {
    throw new Error('App GUI home must show selected assistant as a compact @ purpose tag');
  }
  if (pages.guid_home.model_status?.display_value !== 'GPT-5.5（超高）') {
    throw new Error('App GUI home must display the friendly default model and reasoning status');
  }
  if (pages.guid_home.model_status?.selector_visible !== true) {
    throw new Error('App GUI home model status must expose the App-owned model selector');
  }
  if (
    pages.guid_home.conversation_feedback_policy?.pending_indicator !==
    'visible elapsed seconds while request is pending or backend is running'
  ) {
    throw new Error('App GUI conversation must show elapsed seconds while Codex is working');
  }
  if (
    pages.guid_home.conversation_feedback_policy?.model_status !==
    'same model status and selector appear in Codex conversation composer'
  ) {
    throw new Error('App GUI conversation must show the same model status and selector');
  }
  if (!pages.guid_home.must_not_show?.includes('OPL Meta Agent as a default home assistant')) {
    throw new Error('App GUI home must keep OMA out of default home entries');
  }
  if (
    guiContract.ordinary_capability_selector_policy?.scope !== 'home_composer_and_ordinary_conversation' ||
    guiContract.ordinary_capability_selector_policy?.authority !== 'app_owned_opl_allowlist' ||
    guiContract.ordinary_capability_selector_policy?.skill_source_ref !==
      'assistant_skill_profiles.required_skills + optional_skills' ||
    guiContract.ordinary_capability_selector_policy?.mcp_menu_policy !==
      'empty_until_app_explicitly_whitelists_opl_mcp_servers' ||
    guiContract.ordinary_capability_selector_policy?.conversation_loaded_skill_display_policy !==
      'filter_to_ordinary_skill_allowlist' ||
    guiContract.ordinary_capability_selector_policy?.conversation_loaded_mcp_display_policy !==
      'filter_to_visible_mcp_server_ids'
  ) {
    throw new Error('App GUI ordinary capability selector must be an App-owned OPL allowlist');
  }
  assertDeepEqualJson(
    guiContract.ordinary_capability_selector_policy.visible_mcp_server_ids,
    [],
    'App GUI ordinary MCP allowlist',
  );
  assertIncludesAll(
    guiContract.ordinary_capability_selector_policy.forbidden_skill_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator', 'cron'],
    'App GUI ordinary selector forbidden skills',
  );
  assertIncludesAll(
    guiContract.ordinary_capability_selector_policy.forbidden_mcp_examples,
    ['aionui-team', 'team_*', 'mcp__aionui-team*', 'team_mcp_stdio_config', 'team_id/teamId'],
    'App GUI ordinary selector forbidden MCP examples',
  );
  assertForbiddenCapabilityPolicy(
    guiContract.ordinary_capability_selector_policy,
    ordinaryForbiddenCapabilityPolicy,
    'App GUI ordinary selector forbidden MCP policy',
  );
  assertDeepEqualJson(
    guiContract.ordinary_capability_selector_policy.required_scrub_targets,
    [
      'mcp_servers entries matching forbidden_mcp_matchers',
      'mcp_statuses entries matching forbidden_mcp_matchers',
      'session_mcp_servers entries matching forbidden_mcp_matchers',
      'scrub_extra_keys',
    ],
    'App GUI ordinary selector Team scrub targets',
  );
  if (
    guiContract.ordinary_capability_selector_policy.conversation_snapshot_policy !==
    'scrub_disabled_team_mcp_and_team_metadata_before_rendering_or_inheriting_ordinary_conversations'
  ) {
    throw new Error('App GUI ordinary selector must scrub disabled Team MCP snapshots from ordinary conversations');
  }
  assertIncludesAll(
    pages.guid_home.must_show,
    ['ordinary skill selector filtered to App-owned assistant profile skill allowlist'],
    'App GUI home ordinary selector must_show',
  );
  assertIncludesAll(
    pages.guid_home.must_not_show,
    [
      'AionUI implementation skills such as aionui-skills',
      'unknown MCP servers without an App profile allowlist entry',
      'AionUI Team MCP tools such as team_members, team_list_models, and team_spawn_agent',
    ],
    'App GUI home ordinary selector must_not_show',
  );
  if (pages.guid_home.activity_center_policy?.source !== 'runtime page only; Home does not query running task lists') {
    throw new Error('App GUI home activity center must be suppressed on ordinary Home and routed to Runtime/secondary context');
  }
  if (pages.guid_home.activity_center_policy?.authority !== 'app_owned_home_minimal_command_surface') {
    throw new Error('App GUI home activity center policy must be App-owned minimal command surface');
  }
  if (pages.guid_home.activity_center_policy?.default_placement !== 'not_rendered_on_ordinary_home') {
    throw new Error('App GUI home must not render the expanded activity center on ordinary Home');
  }
  if (pages.guid_home.activity_center_policy?.home_surface_policy !== 'ordinary_home_must_not_render_activity_center_or_continue_work_grid') {
    throw new Error('App GUI home must forbid ordinary Home activity center / continue-work grid rendering');
  }
  assertDeepEqualJson(
    pages.guid_home.activity_center_policy.allowed_home_runtime_context,
    [],
    'App GUI home allowed runtime context',
  );
  assertIncludesAll(
    pages.guid_home.activity_center_policy.must_not_display,
    homeActivityCenterForbiddenDisplays,
    'App GUI home activity center forbidden displays',
  );
  for (const hiddenSignal of [
    'compact continue-work entry near the home input',
    'needs attention, active, and recent refs on Home',
    'Home footer feedback icon',
    'Home footer favorite/star icon',
    'Home footer web/access globe icon',
    'per-assistant running badges derived from module or domain lane diagnostics',
  ]) {
    if (!pages.guid_home.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`App GUI home must not show ${hiddenSignal}`);
    }
  }
  for (const [pageId, expected] of Object.entries(settingsPageExpectations)) {
    const page = pages[pageId];
    assertDeepEqualJson(page.sections, expected.sections, `App GUI ${pageId} sections`);
    assertIncludesAll(page.must_show, expected.must_show, `App GUI ${pageId} must_show`);
    assertIncludesAll(page.must_not_show, expected.must_not_show, `App GUI ${pageId} must_not_show`);
  }
  if (
    pages.settings_capabilities.builtin_skill_catalog_policy?.allowed_set_ref !==
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids + packaged_not_default_visible_codex_skill_ids'
  ) {
    throw new Error('Settings Capabilities must filter builtin skill catalog through the App packaged skill set');
  }
  assertIncludesAll(
    pages.settings_capabilities.builtin_skill_catalog_policy?.forbidden_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator'],
    'Settings Capabilities forbidden upstream builtin skills',
  );
  if (
    pages.settings_capabilities.auto_injected_skills_policy?.allowed_set_ref !==
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids'
  ) {
    throw new Error('Settings Capabilities must filter auto-injected skills through the App packaged skill set');
  }
  assertIncludesAll(
    pages.settings_capabilities.auto_injected_skills_policy?.forbidden_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator'],
    'Settings Capabilities forbidden upstream auto skills',
  );
  validateOplFlowContext(guiContract.opl_flow_context, 'App GUI OPL Flow Context');
  if (!pages.settings_advanced.sections?.includes('opl_flow_context')) {
    throw new Error('Settings Advanced sections must include opl_flow_context');
  }
  if (pages.settings_advanced.sections?.includes('opl_agent_codex_context')) {
    throw new Error('Settings Advanced must not retain legacy opl_agent_codex_context as an active section');
  }
  if ((pages.settings_advanced.legacy_state_sections ?? []).length > 0) {
    throw new Error('Settings Advanced legacy state sections must be retired');
  }
  if (!pages.settings_advanced.must_show?.includes('OPL Flow Context')) {
    throw new Error('Settings Advanced must show OPL Flow Context');
  }
  if (pages.settings_environment.module_path_source_policy_ref !== 'module_path_source_policy') {
    throw new Error('Settings Environment must reference the App GUI module path source policy');
  }
  if (!pages.settings_environment.must_show?.includes('module path source explanation')) {
    throw new Error('Settings Environment must show module path source explanation');
  }
  if (!pages.settings_environment.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Settings Environment must keep MDS out of default module display');
  }
  if (pages.settings_environment.managed_update_plane_ref !== 'managed_update_plane') {
    throw new Error('Settings Environment must reference the managed update plane');
  }
  if (!pages.about.must_show?.includes('Stable or Nightly channel')) {
    throw new Error('About page must show Stable or Nightly channel');
  }
  if (!pages.about.must_show?.includes('Updates & Maintenance entry on About & Updates')) {
    throw new Error('About page must link to Updates & Maintenance');
  }
  if (pages.about.managed_update_plane_ref !== 'managed_update_plane') {
    throw new Error('About page must reference the managed update plane');
  }
  validateManagedUpdatePageSurface(pages.update, 'App GUI Updates & Maintenance page');
  if (!pages.settings_theme.must_show?.includes('Default theme option') || !pages.settings_theme.must_show?.includes('Codex theme option')) {
    throw new Error('Settings theme page must show default and Codex theme options');
  }
  validateProgressDeltaDisplayContract(
    pages.runtime_status.progress_delta_policy,
    'App GUI runtime status progress delta policy',
  );
  validateStateIndexSidecarProjectionContract(
    pages.runtime_status.state_index_sidecar_policy,
    'App GUI runtime status State Index sidecar policy',
  );
  validateArtifactNativeDrilldownProjectionContract(
    pages.runtime_status.artifact_native_drilldown_policy,
    'App GUI runtime status Stage Artifact drilldown policy',
  );
  if (pages.runtime_status.primary_projection !== 'app_state.operator user task status projection') {
    throw new Error('App GUI runtime status must default to the user task status projection');
  }
  if (pages.runtime_status.default_state_source !== 'opl app state --profile fast --json') {
    throw new Error('App GUI runtime status default source must be fast App state');
  }
  if (pages.runtime_status.diagnostic_source !== 'opl runtime app-operator-drilldown --json') {
    throw new Error('App GUI runtime status diagnostic source must be operator drilldown');
  }
  validateUserTaskStatusProjectionContract(
    pages.runtime_status.user_task_status_policy,
    'App GUI runtime status user task status policy',
  );
  for (const signal of [
    'user task status first OPL runtime status',
    'running task count',
    'active project count',
    'queued project count',
    'attention count',
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'non-running waiting or stopped projects collapsed by default',
    'deliverable progress delta classification',
    'platform repair delta as separate infrastructure repair',
  ]) {
    if (!pages.runtime_status.must_show?.includes(signal)) {
      throw new Error(`App GUI runtime status must show ${signal}`);
    }
  }
  assertDeepEqualJson(
    pages.runtime_status.must_not_default_show,
    ['Temporal', 'provider', 'projection', 'ref', 'stage attempt', 'ledger', 'current_control_state'],
    'App GUI runtime status forbidden default terms',
  );
  for (const owner of ['deliverable progress truth', 'platform repair truth']) {
    if (!pages.runtime_status.must_not_own?.includes(owner)) {
      throw new Error(`App GUI runtime status must not own ${owner}`);
    }
  }
  if ('docker_webui' in guiContract) {
    throw new Error('App GUI contract must not include withdrawn Docker/WebUI username, title, logo, or branding requirements');
  }
}
