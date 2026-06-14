import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appOwnedHomeLayout,
  appOwnedPageStateOrdinaryConversation,
  appOwnedRightContextInspectorTabIds,
  homeActivityCenterForbiddenDisplays,
} from './app-contract-constants.ts';

export function validatePrimaryInteractionPages(matrix) {
  validateGuidHomePage(matrix);
  validateOrdinaryConversationPage(matrix);
  validateRightContextInspectorPage(matrix);
}

function pageById(matrix, id, label) {
  const page = (matrix.pages ?? []).find((entry) => entry.id === id);
  if (!page) {
    throw new Error(`Page-state matrix is missing ${label} page`);
  }
  return page;
}

function validateGuidHomePage(matrix) {
  const guidHomePage = pageById(matrix, 'guid_home', 'guid_home');
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
    'AionUI Team MCP tools such as team_members, team_list_models, and team_spawn_agent',
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
}

function validateOrdinaryConversationPage(matrix) {
  const ordinaryConversationPage = pageById(matrix, 'ordinary_conversation', 'ordinary_conversation');
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
}

function validateRightContextInspectorPage(matrix) {
  const rightContextInspectorPage = pageById(matrix, 'right_context_inspector', 'right_context_inspector');
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
}
