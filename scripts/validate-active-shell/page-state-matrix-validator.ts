import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { isDefaultReleaseAdapter } from './active-shell-contract.ts';
import {
  appOwnedHomeLayout,
  appOwnedPageStateOrdinaryConversation,
  appOwnedProjectGroupExpansionPolicy,
  appOwnedRightContextInspectorTabIds,
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
  settingsPageExpectations,
} from './app-contract-constants.ts';
import {
  validateArtifactNativeDrilldownProjectionContract,
  validateBeginnerFirstRunPresentation,
  validateProviderReadinessRepairProjectionContract,
  validateProgressDeltaDisplayContract,
  validateProjectProgressDisplayContract,
  validateStateIndexSidecarProjectionContract,
  validateUserTaskStatusProjectionContract,
} from './shared-contract-validators.ts';

const managedUpdateMustShow = [
  'App binary standard updater status',
  'runtime/toolchain managed updater status',
  'agent package channel managed updater status',
  'capability exposure sync status',
  'conditions and repair actions from App state or opl update status',
];

const managedUpdateMustNotShow = [
  'Full first-install asset as a standard updater target',
  'Developer Profile checkout as a silent update target',
  'dirty checkout overwrite as a repair action',
  'domain truth write controls',
  'owner receipt mutation controls',
  'quality/export verdict controls',
  'Homebrew/global tool silent upgrade controls',
  'artifact bodies',
];

const managedUpdateIpcSurfaces = [
  'opl-runtime.get-managed-update-status',
  'opl-runtime.get-managed-update-check',
  'opl-runtime.get-managed-update-plan',
  'opl-runtime.run-managed-update-apply',
  'opl-runtime.run-managed-update-repair',
  'opl-runtime.run-managed-update-rollback',
];

const managedUpdateBackgroundFields = [
  'last_run_at',
  'next_run_at',
  'last_failure',
  'idempotency_lock.status',
  'execution.status',
];

const managedUpdateScheduler = {
  triggers: ['app_startup_after_core_ready', 'daily_background_maintenance', 'manual_check_updates'],
  lock_source: 'managed_update.idempotency_lock.status',
  backoff_policy: 'bounded_retry_with_last_failure_projection',
  user_blocking: false,
  must_project_last_run_and_next_run: true,
};

const managedUpdateUiActions = {
  refresh: 'opl update status --json',
  check: 'opl update check --json',
  plan: 'opl update plan --json',
  apply_component: 'opl update apply --component <component_id> --json',
  repair_receipt: 'opl update repair --receipt <receipt_id> --json',
  rollback_component: 'opl update rollback --component <component_id> --json',
};

function validateManagedUpdatePageState(page, label) {
  if (page?.page_contract !== 'updates_and_maintenance') {
    throw new Error(`${label} page_contract must be updates_and_maintenance`);
  }
  if (page?.status_source !== 'opl update status --json') {
    throw new Error(`${label} must expose opl update status --json as the explicit status source`);
  }
  if (page?.action_source !== 'opl update apply/repair/rollback --json through shell IPC') {
    throw new Error(`${label} must expose managed update actions through shell IPC`);
  }
  assertDeepEqualJson(
    page?.background_maintenance_status_fields,
    managedUpdateBackgroundFields,
    `${label} background maintenance status fields`,
  );
  assertDeepEqualJson(
    page?.sections,
    ['app_binary', 'runtime_toolchain', 'agent_packages', 'capability_exposure'],
    `${label} sections`,
  );
  assertIncludesAll(page?.must_show, managedUpdateMustShow, `${label} must_show`);
  assertIncludesAll(page?.must_not_show, managedUpdateMustNotShow, `${label} must_not_show`);
  const plane = page?.managed_update_plane;
  if (
    plane?.source_ref !== 'contracts/app-release-channel.json#managed_update_plane' ||
    plane?.app_role !== 'status_conditions_repair_actions_consumer_only' ||
    plane?.framework_role !== 'managed_update_kernel_owner'
  ) {
    throw new Error(`${label} must bind to the App managed update plane`);
  }
  assertDeepEqualJson(
    plane?.display_planes,
    ['app_binary', 'runtime_toolchain', 'agent_package_channel', 'capability_exposure'],
    `${label} display planes`,
  );
  assertDeepEqualJson(plane?.background_scheduler, managedUpdateScheduler, `${label} background scheduler`);
  assertDeepEqualJson(plane?.ui_actions, managedUpdateUiActions, `${label} UI actions`);
  assertDeepEqualJson(plane?.ipc_bridge_required, managedUpdateIpcSurfaces, `${label} IPC bridge`);
}

export function validatePageStateMatrix(matrix, contract) {
  if (isDefaultReleaseAdapter(contract) && (matrix.active_shell !== contract.active_shell || matrix.shell_root !== contract.shell_root)) {
    throw new Error('Page-state matrix must target the active shell contract');
  }

  const requiredPages = new Set([
    'guid_home',
    'runtime',
    'settings_general',
    'access',
    'capabilities',
    'environment',
    'advanced',
    'about',
    'update',
    'settings_theme',
    'first_launch_readiness',
  ]);
  for (const page of matrix.pages ?? []) {
    requiredPages.delete(page.id);
    if (!page.expected_source || !Array.isArray(page.must_show) || page.must_show.length === 0) {
      throw new Error(`Invalid page-state entry: ${JSON.stringify(page)}`);
    }
  }
  if (requiredPages.size > 0) {
    throw new Error(`Page-state matrix is missing required page(s): ${[...requiredPages].join(', ')}`);
  }
  if ((matrix.pages ?? []).some((page) => page.id === 'docker_webui')) {
    throw new Error('Page-state matrix must not include withdrawn Docker/WebUI username, title, logo, or branding requirements');
  }

  const guidHomePage = (matrix.pages ?? []).find((page) => page.id === 'guid_home');
  if (!guidHomePage) {
    throw new Error('Page-state matrix is missing guid_home page');
  }
  if (guidHomePage.machine_source !== 'contracts/app-gui-product-contract.json#pages.guid_home + opl app state --profile fast --json') {
    throw new Error(`Guid home page must consume the App GUI product contract and OPL App state, got: ${guidHomePage.machine_source}`);
  }
  const homeViewModel = guidHomePage.home_view_model;
  if (homeViewModel?.authority !== 'app_repo_owned_product_truth') {
    throw new Error('Guid home page must declare App-owned GUI authority');
  }
  if (homeViewModel.implementation_carrier !== 'opl-aion-shell') {
    throw new Error('Guid home page implementation carrier must be opl-aion-shell');
  }
  for (const [field, expected] of Object.entries({
    state_source: 'opl app state --profile fast --json',
    refresh_source: 'opl app state --profile fast --json',
    executor_policy_ref: 'contracts/app-gui-product-contract.json#executor_policy',
    assistant_source_ref: 'contracts/app-gui-product-contract.json#default_assistants',
    assistant_skill_profile_source_ref: 'contracts/app-gui-product-contract.json#assistant_skill_profiles',
    ordinary_capability_selector_policy_ref: 'contracts/app-product-profile.json#gui.ordinary_capability_selector_policy',
    codex_only_default: true,
    codex_cli_fixed_executor: true,
    home_executor_selector_visible: false,
    executor_tab_visible_when_single_executor: false,
    primary_input_surface: 'single_card',
    nested_input_card_frames_allowed: false,
    codex_model_selector_visible: true,
    codex_model_list_visible: true,
    codex_model_policy: 'codex_cli_latest_strongest_model_selector_visible',
    codex_model_auto_option_visible: true,
    codex_default_model: 'gpt-5.5',
    codex_default_reasoning_effort: 'xhigh',
    codex_default_display_label: 'GPT-5.5（超高）',
    codex_precise_model_display_policy: 'friendly_default_model_and_reasoning_visible',
    codex_default_permission_mode: 'full-access',
    permission_mode_selector_visible: false,
    conversation_backend_selector_visible: false,
    conversation_model_selector_visible: true,
    conversation_permission_mode_selector_visible: false,
  })) {
    if (homeViewModel[field] !== expected) {
      throw new Error(`Guid home page ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    homeViewModel.home_layout,
    appOwnedHomeLayout,
    'Guid home page layout',
  );
  assertDeepEqualJson(homeViewModel.ordinary_visible_mcp_server_ids, [], 'Guid home ordinary MCP allowlist');
  for (const assistant of ['mas', 'mag', 'rca']) {
    if (!homeViewModel.default_assistants?.includes(assistant)) {
      throw new Error(`Guid home page must include default assistant ${assistant}`);
    }
  }
  if (homeViewModel.default_assistants?.includes('oma')) {
    throw new Error('Guid home page must not include OMA as a default assistant');
  }
  const requiredSkills = homeViewModel.default_assistant_required_skills ?? {};
  for (const assistant of ['mas', 'mag', 'rca']) {
    if (JSON.stringify(requiredSkills[assistant]) !== JSON.stringify([assistant])) {
      throw new Error(`Guid home page must require ${assistant} skill for ${assistant}`);
    }
  }
  if (homeViewModel.purpose_entry_source_ref !== 'contracts/app-gui-product-contract.json#home_purpose_entries') {
    throw new Error('Guid home page must reference App-owned purpose entries');
  }
  if (homeViewModel.route_receipt_source_ref !== 'contracts/app-gui-product-contract.json#builtin_assistant_route_receipt_policy') {
    throw new Error('Guid home page must reference App-owned built-in assistant route receipt policy');
  }
  assertIncludesAll(
    homeViewModel.route_receipt_required_fields,
    ['route_kind', 'executor', 'assistant_id', 'assistant_short_name', 'source'],
    'Guid home page route receipt fields',
  );
  const homePurposeEntries = homeViewModel.home_purpose_entries ?? [];
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.id)) !== JSON.stringify(['research', 'grant', 'ppt'])) {
    throw new Error('Guid home page must expose research, grant, and ppt purpose entries');
  }
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('Guid home page purpose entries must target MAS, MAG, and RCA');
  }
  for (const visibleSignal of [
    'Codex CLI fixed executor experience',
    'Codex model selector defaulting to GPT-5.5（超高）',
    'default model and reasoning status GPT-5.5（超高）',
    'purpose-first entries 科研/MAS, 基金/MAG, 演示/RCA',
    'selected assistant keeps purpose entry switcher visible',
    'assistant-scoped skill menu with required skill checked',
    'ordinary skill selector filtered to App-owned assistant profile skill allowlist',
    'workspace selector',
    'file attachment control',
    'send action',
    'single composer-first home input',
    'workspace/session rail collapsed by default',
    'right context inspector collapsed by default',
    'runtime/task progress available from Runtime page, not Home activity grid',
  ]) {
    if (!guidHomePage.must_show.includes(visibleSignal)) {
      throw new Error(`Guid home page must show ${visibleSignal}`);
    }
  }
  for (const hiddenSignal of [
    'executor selector on the home input',
    'Aion CLI or Claude Code backend choices on the home input',
    'retired Codex model choices on the home input',
    'permission mode selector on the home input',
    'backend or permission selectors after entering an ordinary Codex conversation',
    'full assistant names as default home entry labels',
    'skills outside the App packaged skill set in home skill menu',
    'AionUI implementation skills such as aionui-skills',
    'unknown MCP servers without an App profile allowlist entry',
    'OPL Meta Agent as a default home assistant',
    'retired Codex model choices',
    'nested input card frames',
    'dashboard-first home',
    'explanatory landing page',
    'backend settings panel in composer',
    'expanded workbench or activity refs grid on ordinary home',
    'domain artifact body in Home activity center',
    'memory body in Home activity center',
    'compact continue-work entry near the home input',
    'Home footer feedback icon',
    'Home footer favorite/star icon',
    'Home footer web/access globe icon',
    'per-assistant running badges derived from module or domain lane diagnostics',
  ]) {
    if (!guidHomePage.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`Guid home page must not show ${hiddenSignal}`);
    }
  }
  if (
    homeViewModel.activity_center?.authority !== 'app_owned_home_minimal_command_surface' ||
    homeViewModel.activity_center?.source !== 'not_rendered_on_ordinary_home' ||
    homeViewModel.activity_center?.default_placement !== 'not_rendered_on_ordinary_home' ||
    homeViewModel.activity_center?.home_surface_policy !== 'ordinary_home_must_not_render_activity_center_or_continue_work_grid'
  ) {
    throw new Error('Guid home page activity center must be suppressed on ordinary Home and routed to Runtime/secondary context');
  }
  assertDeepEqualJson(
    homeViewModel.activity_center.allowed_home_runtime_context,
    [],
    'Guid home page allowed runtime context',
  );
  assertIncludesAll(
    homeViewModel.activity_center.must_not_display,
    homeActivityCenterForbiddenDisplays,
    'Guid home page activity center forbidden displays',
  );

  const ordinaryConversationPage = (matrix.pages ?? []).find((page) => page.id === 'ordinary_conversation');
  if (!ordinaryConversationPage) {
    throw new Error('Page-state matrix is missing ordinary_conversation page');
  }
  if (ordinaryConversationPage.page_contract !== 'ordinary_codex_conversation') {
    throw new Error('Ordinary conversation page contract must be ordinary_codex_conversation');
  }
  assertDeepEqualJson(
    ordinaryConversationPage.conversation_view_model,
    appOwnedPageStateOrdinaryConversation,
    'Ordinary conversation view model',
  );
  for (const visibleSignal of [
    'Codex CLI ordinary conversation',
    'pinned composer',
    'compact purpose tag',
    'assistant route receipt',
    'Codex default model and reasoning status',
  ]) {
    if (!ordinaryConversationPage.must_show?.includes(visibleSignal)) {
      throw new Error(`Ordinary conversation page must show ${visibleSignal}`);
    }
  }
  for (const hiddenSignal of [
    'backend selector as normal conversation control',
    'permission mode selector as normal conversation control',
    'provider selector as normal conversation control',
  ]) {
    if (!ordinaryConversationPage.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`Ordinary conversation page must not show ${hiddenSignal}`);
    }
  }

  const rightContextInspectorPage = (matrix.pages ?? []).find((page) => page.id === 'right_context_inspector');
  if (!rightContextInspectorPage) {
    throw new Error('Page-state matrix is missing right_context_inspector page');
  }
  const inspectorViewModel = rightContextInspectorPage.inspector_view_model;
  assertDeepEqualJson(
    (inspectorViewModel?.tabs ?? []).map((tab) => tab.id),
    appOwnedRightContextInspectorTabIds,
    'Right context inspector tabs',
  );
  for (const [field, expected] of Object.entries({
    placement: 'right',
    default_state: 'collapsed',
    opens_on_user_request_only: true,
    chat_canvas_remains_primary: true,
    scope: 'selected_workspace_and_conversation',
  })) {
    if (inspectorViewModel?.[field] !== expected) {
      throw new Error(`Right context inspector ${field} must be ${expected}`);
    }
  }
  for (const visibleSignal of [
    'right-side collapsible inspector',
    'Files refs tab',
    'Capabilities tab',
    'Routing/runtime refs tab',
    'Memory refs tab',
    'Always-On/Automations tab',
    'Settings tab',
  ]) {
    if (!rightContextInspectorPage.must_show?.includes(visibleSignal)) {
      throw new Error(`Right context inspector page must show ${visibleSignal}`);
    }
  }
  for (const forbiddenOwner of ['runtime truth', 'domain truth', 'artifact body', 'memory body', 'backend selection authority']) {
    if (!rightContextInspectorPage.must_not_own?.includes(forbiddenOwner)) {
      throw new Error(`Right context inspector page must not own ${forbiddenOwner}`);
    }
  }

  const appStatePages = ['settings_general', 'access', 'environment', 'advanced', 'about', 'settings_theme'];
  for (const pageId of appStatePages) {
    const page = (matrix.pages ?? []).find((entry) => entry.id === pageId);
    if (!page) {
      throw new Error(`Page-state matrix is missing ${pageId}`);
    }
    if (page.machine_source !== 'opl app state --profile fast --json') {
      throw new Error(`${pageId} must default to opl app state --profile fast --json`);
    }
    if (page.refresh_source !== 'opl app state --profile fast --json') {
      throw new Error(`${pageId} must refresh through opl app state --profile fast --json`);
    }
  }
  for (const [contractPageId, expected] of Object.entries(settingsPageExpectations)) {
    const page = (matrix.pages ?? []).find((entry) => entry.id === expected.matrix_id);
    if (!page) {
      throw new Error(`Page-state matrix is missing ${expected.matrix_id}`);
    }
    if (page.page_contract !== contractPageId) {
      throw new Error(`${expected.matrix_id} page_contract must be ${contractPageId}`);
    }
    assertDeepEqualJson(page.sections, expected.sections, `${expected.matrix_id} sections`);
    assertIncludesAll(page.must_show, expected.must_show, `${expected.matrix_id} must_show`);
    assertIncludesAll(page.must_not_show, expected.must_not_show, `${expected.matrix_id} must_not_show`);
  }
  const capabilitiesPage = (matrix.pages ?? []).find((page) => page.id === 'capabilities');
  if (capabilitiesPage?.refresh_source !== 'opl app state --profile fast --json') {
    throw new Error('Capabilities page must refresh through opl app state --profile fast --json');
  }
  if (capabilitiesPage?.machine_source !== 'contracts/app-gui-product-contract.json#default_assistants + opl app state --profile fast --json') {
    throw new Error('Capabilities page must combine App-owned assistant profile truth with OPL App state readiness refs');
  }
  const environmentPage = (matrix.pages ?? []).find((page) => page.id === 'environment');
  if (environmentPage?.module_path_source_policy_ref !== 'contracts/app-gui-product-contract.json#module_path_source_policy') {
    throw new Error('Environment page must reference the App GUI module path source policy');
  }
  if (!environmentPage.must_show?.includes('module path source explanation')) {
    throw new Error('Environment page must show module path source explanation');
  }
  const advancedPage = (matrix.pages ?? []).find((page) => page.id === 'advanced');
  if (!advancedPage?.state_sections?.includes('opl_flow_context')) {
    throw new Error('Advanced page state_sections must include opl_flow_context');
  }
  if (advancedPage?.state_sections?.includes('opl_agent_codex_context')) {
    throw new Error('Advanced page state_sections must not retain opl_agent_codex_context');
  }
  if ((advancedPage?.legacy_state_sections ?? []).length > 0) {
    throw new Error('Advanced page legacy_state_sections must be retired');
  }
  if (!advancedPage?.must_show?.includes('OPL Flow Context')) {
    throw new Error('Advanced page must show OPL Flow Context');
  }
  if (!environmentPage.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Environment page must keep MDS out of default module display');
  }
  if (environmentPage?.managed_update_plane_ref !== 'contracts/app-release-channel.json#managed_update_plane') {
    throw new Error('Environment page must reference the App release managed update plane');
  }
  const aboutPage = (matrix.pages ?? []).find((page) => page.id === 'about');
  if (!aboutPage?.must_show?.includes('Stable or Nightly channel')) {
    throw new Error('About page must show Stable or Nightly channel');
  }
  if (!aboutPage?.must_show?.includes('Updates & Maintenance entry on About & Updates')) {
    throw new Error('About page must link to Updates & Maintenance');
  }
  if (aboutPage?.managed_update_plane_ref !== 'contracts/app-release-channel.json#managed_update_plane') {
    throw new Error('About page must reference the App release managed update plane');
  }
  const updatePage = (matrix.pages ?? []).find((page) => page.id === 'update');
  validateManagedUpdatePageState(updatePage, 'Update page');
  const settingsThemePage = (matrix.pages ?? []).find((page) => page.id === 'settings_theme');
  for (const signal of [
    'Default theme option',
    'Codex theme option',
    'current theme from app_state.settings.theme',
    'theme choice as App product preference',
  ]) {
    if (!settingsThemePage?.must_show?.includes(signal)) {
      throw new Error(`Settings theme page must show ${signal}`);
    }
  }

  const firstLaunchPage = (matrix.pages ?? []).find((page) => page.id === 'first_launch_readiness');
  if (!firstLaunchPage) {
    throw new Error('Page-state matrix is missing first_launch_readiness page');
  }
  if (firstLaunchPage.launch_gate?.id !== 'ready_to_launch' || firstLaunchPage.launch_gate?.ui_order !== 'before_guid') {
    throw new Error('First-launch readiness page must gate ready_to_launch before /guid');
  }
  if (firstLaunchPage.launch_gate?.full_readiness_blocks_ready_to_launch !== false) {
    throw new Error('First-launch readiness page must keep full readiness non-blocking for ready_to_launch');
  }
  validateBeginnerFirstRunPresentation(
    firstLaunchPage.beginner_view_model,
    'First-launch readiness beginner view model',
  );
  assertIncludesAll(
    firstLaunchPage.beginner_view_model?.required_shell_testids,
    beginnerFirstRunTestIds,
    'First-launch readiness beginner shell test ids',
  );
  for (const item of firstRunCoreItems) {
    if (!firstLaunchPage.launch_gate?.required_core_items?.includes(item)) {
      throw new Error(`First-launch readiness page must require Core item ${item}`);
    }
  }
  for (const item of fullReadinessItems) {
    if (!firstLaunchPage.launch_gate?.full_readiness_items?.includes(item)) {
      throw new Error(`First-launch readiness page must list ${item} as full readiness`);
    }
  }
  for (const signal of [
    'workspace root readiness',
    'Codex CLI readiness',
    'Codex config readiness',
    'ready_to_launch before /guid',
    'full readiness and background maintenance state',
    'current initialization phase',
    'Core completed and total count',
    'Full readiness completed and total count',
    'background maintenance completed and total count',
    'next visible step',
    'beginner-facing readiness summary',
    'primary start action',
    'background maintenance collapsed technical disclosure',
    'technical details toggle',
  ]) {
    if (!firstLaunchPage.must_show?.includes(signal)) {
      throw new Error(`First-launch readiness page must show ${signal}`);
    }
  }
  for (const hiddenSignal of [
    'Homebrew, Node, Git, CLT, module, provider, or runtime maintenance as primary first-screen terminal goals',
    'Full readiness progress as the dominant first-screen message',
    'raw command output in the beginner primary area',
    'English runtime checklist labels in the Chinese beginner primary area',
    'Codex API Configuration, Unknown, or Needs setup in the Chinese beginner primary area',
    'background maintenance counters or labels in the beginner primary area',
  ]) {
    if (!firstLaunchPage.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`First-launch readiness page must not show ${hiddenSignal}`);
    }
  }
  const localizationPolicy = firstLaunchPage.beginner_view_model?.localization_policy;
  assertIncludesAll(
    localizationPolicy?.chinese_primary_labels,
    ['工作目录', '本机助手', '访问权限'],
    'First-launch readiness beginner localization labels',
  );
  assertIncludesAll(
    localizationPolicy?.forbidden_primary_area_text,
    ['Codex API Configuration', 'Unknown', 'Needs setup', 'setup_flow', 'opl system'],
    'First-launch readiness beginner forbidden primary text',
  );
  if (
    localizationPolicy?.technical_label_policy !==
    'map_initialize_item_ids_to_app_owned_beginner_labels_before_rendering_primary_area'
  ) {
    throw new Error('First-launch readiness beginner localization must map initialize item ids before rendering');
  }
  const firstLaunchProgressModel = firstLaunchPage.progress_model;
  if (firstLaunchProgressModel?.source_command !== firstRunProgressSourceCommand) {
    throw new Error('First-launch readiness page progress model must use opl system initialize --json');
  }
  if (firstLaunchProgressModel?.source_path !== firstRunProgressSourcePath) {
    throw new Error('First-launch readiness page progress model must read system_initialize.setup_flow');
  }
  if (firstLaunchProgressModel?.renderer_truth_policy !== firstRunRendererTruthPolicy) {
    throw new Error('First-launch readiness page progress model must keep the shell as render-only');
  }
  assertIncludesAll(
    firstLaunchProgressModel?.required_setup_flow_fields,
    firstRunSetupFlowFields,
    'First-launch readiness page progress setup_flow fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_progress_fields,
    firstRunProgressFields,
    'First-launch readiness page progress fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_checklist_fields,
    firstRunChecklistFields,
    'First-launch readiness page progress checklist fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_visible_elements,
    firstRunProgressVisibleElements,
    'First-launch readiness page progress visible elements',
  );

  const runtimePage = (matrix.pages ?? []).find((page) => page.id === 'runtime');
  if (!runtimePage) {
    throw new Error('Page-state matrix is missing runtime page');
  }
  if (runtimePage.machine_source !== 'opl app state --profile fast --json') {
    throw new Error(`Runtime page machine_source must be fast App state, got: ${runtimePage.machine_source}`);
  }
  if (runtimePage.default_state_source !== 'opl app state --profile fast --json') {
    throw new Error(`Runtime page default_state_source must be fast App state, got: ${runtimePage.default_state_source}`);
  }
  if (runtimePage.diagnostic_source !== 'opl runtime app-operator-drilldown --json') {
    throw new Error(`Runtime page diagnostic_source must be operator summary drilldown, got: ${runtimePage.diagnostic_source}`);
  }
  if (runtimePage.primary_projection !== 'app_state.operator user task status projection') {
    throw new Error(`Runtime page primary_projection must be user task status, got: ${runtimePage.primary_projection}`);
  }
  if (runtimePage.framework_command !== 'opl app state --profile fast --json') {
    throw new Error(`Runtime page must use the OPL App state command, got: ${runtimePage.framework_command}`);
  }
  if (runtimePage.framework_full_detail_command !== 'opl runtime app-operator-drilldown --detail full --json') {
    throw new Error(`Runtime page must lazy-load full App/operator drilldown only on demand, got: ${runtimePage.framework_full_detail_command}`);
  }
  if (runtimePage.framework_action_command !== 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json') {
    throw new Error(`Runtime page must expose only the whitelisted OPL App action command, got: ${runtimePage.framework_action_command}`);
  }
  const acceptancePath = runtimePage.operator_evidence_acceptance_path;
  if (acceptancePath?.role !== 'runtime_page_operator_evidence_acceptance') {
    throw new Error('Runtime page must declare operator evidence acceptance path');
  }
  if (acceptancePath.accepts_refs_only_json !== true) {
    throw new Error('Runtime page operator evidence acceptance must be refs-only JSON');
  }
  for (const [field, expected] of Object.entries({
    summary_state_command: 'opl app state --profile fast --json',
    refresh_state_command: 'opl app state --profile fast --json',
    full_drilldown_command: 'opl runtime app-operator-drilldown --detail full --json',
    action_dry_run_command: 'opl app action execute --action <action_id> --dry-run --json',
    action_execute_command: 'opl app action execute --action <action_id> --json',
    action_route_source: 'app_state.actions',
    action_execution_policy: 'operator_selected_safe_app_action_route_only',
  })) {
    if (acceptancePath[field] !== expected) {
      throw new Error(`Runtime page operator evidence acceptance ${field} must be ${expected}`);
    }
  }
  const runtimeViewModel = runtimePage.runtime_view_model;
  if (runtimeViewModel?.role !== 'opl_runtime_user_task_status') {
    throw new Error('Runtime page must declare OPL runtime user task status view model');
  }
  if (runtimeViewModel.bridge_contract !== 'contracts/app-runtime-bridge.json') {
    throw new Error(`Runtime page view model must reference app-runtime-bridge.json, got: ${runtimeViewModel.bridge_contract}`);
  }
  if (runtimeViewModel.default_mode !== 'user_task_status_first') {
    throw new Error('Runtime page view model must default to user_task_status_first');
  }
  if (runtimeViewModel.full_detail_policy !== 'on_demand_only') {
    throw new Error('Runtime page full detail must be on-demand only');
  }
  if (
    runtimeViewModel.polling_fallback?.interval_seconds_min !== 5
    || runtimeViewModel.polling_fallback?.interval_seconds_max !== 10
    || runtimeViewModel.polling_fallback?.policy !== 'lightweight_polling_until_push_projection_available'
  ) {
    throw new Error('Runtime page polling fallback must be lightweight 5-10 second polling');
  }
  for (const [field, expected] of Object.entries({
    'action_queue.source': 'app_state.actions',
    'action_queue.fallback_source': 'app_state.operator.actions',
    'action_queue.authority': 'framework_refs_only',
    'progress_delta.source': 'app_state.operator.workbench.task_drilldowns.progress_delta_classification',
    'progress_delta.authority': 'opl_framework_shared_progress_projection',
    'progress_delta.display_policy': 'classification_only_no_domain_artifact_body',
    'progress_delta.deliverable_progress_source': 'deliverable_progress_delta',
    'progress_delta.platform_repair_source': 'platform_repair_delta',
    'progress_delta.classification_source': 'progress_delta_classification',
    'progress_delta.platform_repair_display_treatment': 'separate_infrastructure_repair_not_deliverable_progress',
    primary_state_source: 'opl app state --profile fast --json',
    refresh_state_source: 'opl app state --profile fast --json',
    summary_source: 'opl runtime app-operator-drilldown --json',
    full_detail_source: 'opl runtime app-operator-drilldown --detail full --json',
    'provider_status.source': 'app_state.provider',
    'provider_status.authority': 'opl_framework',
    'authority_boundary.action_execution_owner': 'opl_framework',
    'authority_boundary.domain_verdict_owner': 'domain_agent',
  })) {
    const actual = field.split('.').reduce((value, key) => value?.[key], runtimeViewModel);
    if (actual !== expected) {
      throw new Error(`Runtime page view model ${field} must be ${expected}`);
    }
  }
  validateUserTaskStatusProjectionContract(
    runtimeViewModel.user_task_status_projection,
    'Runtime page user task status projection',
  );
  validateProjectProgressDisplayContract(runtimeViewModel.project_progress, 'Runtime page project progress display contract');
  validateStateIndexSidecarProjectionContract(
    runtimeViewModel.state_index_sidecar,
    'Runtime page State Index sidecar projection',
  );
  validateArtifactNativeDrilldownProjectionContract(
    runtimeViewModel.artifact_native_drilldown,
    'Runtime page Stage Artifact drilldown projection',
  );
  validateProviderReadinessRepairProjectionContract(
    runtimeViewModel.provider_readiness_repair,
    'Runtime page provider readiness repair projection',
  );
  const pageDefaultAttention = runtimeViewModel.default_attention;
  if (pageDefaultAttention?.mode !== 'user_task_status_first') {
    throw new Error('Runtime page default attention must be user_task_status_first');
  }
  assertDeepEqualJson(
    pageDefaultAttention?.primary_fields,
    ['running_task_count', 'active_project_count', 'queued_project_count', 'attention_count'],
    'Runtime page default attention primary fields',
  );
  assertIncludesAll(
    pageDefaultAttention?.active_project_line_fields,
    [
      'app_state.operator.workbench.summary_cards[active_projects]',
      'app_state.operator.workbench.activity_center.active_projects',
      'app_state.operator.visual_ref_groups.active_project_refs',
    ],
    'Runtime page default attention active_project_line_fields',
  );
  if (
    pageDefaultAttention?.active_project_line_policy
    !== 'queued_or_escalated_owner_handled_project_lines_count_as_user_visible_active_projects_without_claiming_active_worker_run'
  ) {
    throw new Error('Runtime page default attention must keep active project lines separate from active worker runs');
  }
  assertDeepEqualJson(
    pageDefaultAttention?.project_group_expansion_policy,
    appOwnedProjectGroupExpansionPolicy,
    'Runtime page default attention project_group_expansion_policy',
  );
  if (runtimeViewModel.diagnostics?.default_visibility !== 'secondary_disclosure') {
    throw new Error('Runtime page diagnostics must be secondary disclosure, not a primary daily surface');
  }
  assertIncludesAll(
    runtimeViewModel.diagnostics?.sections,
    ['operator summary', 'safe actions', 'evidence refs', 'full detail digest'],
    'Runtime page diagnostics sections',
  );
  if (runtimeViewModel.authority_boundary?.refs_only !== true) {
    throw new Error('Runtime page view model must be refs-only');
  }
  if (runtimeViewModel.authority_boundary?.non_authority_display_only !== true) {
    throw new Error('Runtime page view model must be display-only for non-authority domain refs');
  }
  validateProgressDeltaDisplayContract(runtimeViewModel.progress_delta, 'Runtime page progress delta display contract');
  const runningTaskProjection = runtimeViewModel.running_task_projection;
  if (
    runningTaskProjection?.source !== 'app_operator_drilldown.current_control_state.summary + current_control_state.states' ||
    runningTaskProjection.authority !== 'opl_framework_provider_attempt_projection' ||
    runningTaskProjection.display_policy !== 'diagnostic_only_no_provider_attempt_count_as_user_running_task_count' ||
    runningTaskProjection.active_execution_filter !==
      'states where running_provider_attempt is true and provider_run.provider_status or current_attempt_state is running' ||
    runningTaskProjection.diagnostic_provider_ref_policy !==
      'running_provider_attempt_count may include checkpointed provider refs and must not be displayed as the user-visible running task count'
  ) {
    throw new Error('Runtime page must keep provider running activity as diagnostic projection');
  }
  assertIncludesAll(
    runningTaskProjection.required_user_fields,
    [
      'current_control_state.states[].running_provider_attempt',
      'current_control_state.states[].provider_run.provider_status',
      'current_control_state.states[].current_attempt_state',
      'running_provider_attempt_count',
      'running_provider_attempt_domain_ids',
      'running_provider_attempt_task_kinds',
      'latest_running_provider_heartbeat_at',
      'running_provider_attempt_summary_policy',
    ],
    'Runtime page running task required user fields',
  );
  assertIncludesAll(
    runningTaskProjection.forbidden_sources,
    [
      'domain_lane_map active_task_count',
      'app_state.operator.workbench.task_drilldowns where active_stage_id is module_runtime',
      'app_state.modules',
      'module_runtime dirty state',
      'repo/worktree diagnostics',
      'assistant cards',
    ],
    'Runtime page running task forbidden sources',
  );
  const requiredEvidencePath = [
    'user task status first OPL runtime status',
    'running task count from framework user task projection',
    'active project count from framework project-line projection',
    'queued project count from framework project-line projection',
    'attention count from framework blocker and owner-attention projection',
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'provider/current_control_state details as diagnostics only',
    'summary OPL operator drilldown read model',
    'fast App state refresh',
    'app_state.operator.workbench.task_drilldowns project progress refs',
    'app_state.operator.workbench.task_drilldowns State Index sidecar refs',
    'app_state.operator.workbench.task_drilldowns artifact-native refs',
    'app_state.operator.workbench.activity_center.active_projects active project lines',
    'app_state.operator.visual_ref_groups.active_project_refs',
    'non-running waiting or stopped projects collapsed by default',
    'full detail lazy load',
    'app_state.operator.summary refs',
    'app_state.provider readiness refs',
    'provider readiness repair path for worker_not_ready and missing Temporal Search Attributes',
    'current_owner_delta remains the default owner action while provider repair stays infrastructure-only',
    'app_state.actions safe action refs',
    'refs-only non-authority boundary',
    'safe app action dry-run',
    'safe app action execute',
    'receipt/count refresh after execute',
    'authority boundary fields',
  ];
  for (const signal of requiredEvidencePath) {
    if (!runtimePage.operator_evidence_path?.includes(signal)) {
      throw new Error(`Runtime page operator evidence path must include ${signal}`);
    }
  }
  const requiredRuntimeSignals = [
    'user task status first OPL runtime status',
    'running task count',
    'active project count',
    'queued project count',
    'attention count',
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'project progress from app_state.operator.workbench.task_drilldowns',
    'active project line count from app_state.operator.workbench.activity_center.active_projects',
    'project title/domain/current state/current stage',
    'next visible step when projected',
    'blocker count and user attention status',
    'progress delta rendered as user-facing labels',
    'State Index Kernel / SQLite sidecar read-model refs',
    'artifact-native current/canonical/export/lineage/retention/conformance refs',
    'runtime diagnostics as secondary disclosure',
    'provider readiness from app_state.provider',
    'repair command for provider worker not ready',
    'repair command for missing Temporal Search Attributes',
    'provider readiness repair does not override current_owner_delta',
    'operator summary from app_state.operator',
    'safe action refs from app_state.actions',
    'non-running waiting or stopped projects collapsed by default',
    'summary OPL operator drilldown read model',
    'full detail lazy load',
    'safe app action dry-run/execute controls',
    'deliverable progress delta classification',
    'platform repair delta as separate infrastructure repair',
    'Stage Artifact Kernel refs-only drilldown',
    'State Index sidecar refs-only drilldown to Stage Folder',
    'receipt/count refresh after execute',
    'refs-only non-authority boundary',
  ];
  for (const signal of requiredRuntimeSignals) {
    if (!runtimePage.must_show.includes(signal)) {
      throw new Error(`Runtime page must show ${signal}`);
    }
  }
  assertDeepEqualJson(
    runtimePage.must_not_default_show,
    ['Temporal', 'provider', 'projection', 'ref', 'stage attempt', 'ledger', 'current_control_state'],
    'Runtime page forbidden default display terms',
  );
  const forbiddenRuntimeOwners = [
    'runtime truth',
    'provider implementation',
    'domain truth',
    'memory body',
    'artifact body',
    'domain artifact body',
    'artifact authority',
    'SQLite sidecar write authority',
    'State Index Kernel mutation authority',
    'quality/readiness/export verdict',
    'deliverable progress truth',
    'platform repair truth',
    'action route authority',
    'domain action approval override',
    'owner receipt authority',
    'family production readiness',
  ];
  for (const owner of forbiddenRuntimeOwners) {
    if (!runtimePage.must_not_own?.includes(owner)) {
      throw new Error(`Runtime page must not own ${owner}`);
    }
  }
  if (matrix.canonical_state_surface?.default_command !== 'opl app state --profile fast --json') {
    throw new Error('Page-state matrix canonical default state command must be fast App state');
  }
  if (matrix.canonical_state_surface.refresh_command !== 'opl app state --profile fast --json') {
    throw new Error('Page-state matrix canonical refresh state command must be fast App state');
  }
  if (matrix.canonical_action_surface?.command !== 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json') {
    throw new Error('Page-state matrix canonical action command must be the OPL App action execute boundary');
  }
  if (matrix.full_detail_exception?.command !== 'opl runtime app-operator-drilldown --detail full --json') {
    throw new Error('Page-state matrix full detail exception must be OPL runtime app-operator-drilldown');
  }
}
