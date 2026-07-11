import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appOwnedPageStateHomeLayout,
  appOwnedPageStateOrdinaryConversation,
  appOwnedRightContextInspectorPrimaryToolIds,
  appOwnedRightContextInspectorSecondarySectionIds,
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
  validateGuidHomePageSource(guidHomePage);
  const homeViewModel = guidHomePage.home_view_model;
  validateGuidHomeViewModelFields(homeViewModel);
  validateGuidHomeLayout(homeViewModel);
  validateGuidHomeDefaultAssistants(homeViewModel);
  validateGuidHomeRouteAndPurpose(homeViewModel);
  validateGuidHomeVisibleSignals(guidHomePage);
  validateGuidHomeHiddenSignals(guidHomePage);
  validateGuidHomeActivityCenter(homeViewModel);
}

function validateGuidHomePageSource(guidHomePage) {
  if (guidHomePage.machine_source !== 'contracts/app-gui-product-contract.json#pages.guid_home + opl app state --profile fast --json') {
    throw new Error(`Guid home page must consume the App GUI product contract and OPL App state, got: ${guidHomePage.machine_source}`);
  }
}

function validateGuidHomeViewModelFields(homeViewModel) {
  const expectedFields = {
    authority: 'app_repo_owned_product_truth',
    implementation_carrier: 'opl-aion-shell',
    state_source: 'opl app state --profile fast --json',
    refresh_source: 'opl app state --profile fast --json',
    executor_policy_ref: 'contracts/app-gui-product-contract.json#executor_policy',
    agent_package_source_ref: 'contracts/app-gui-product-contract.json#professional_agent_packages',
    home_agent_shortcut_source_ref: 'contracts/app-gui-product-contract.json#home_agent_shortcuts',
    agent_package_skill_source_ref: 'contracts/app-gui-product-contract.json#professional_agent_packages.required_skill_ids + optional_skill_ids',
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
    codex_default_model: 'gpt-5.6-sol',
    codex_default_reasoning_effort: 'max',
    codex_default_display_label: '5.6 Sol',
    codex_default_model_display_value: '5.6 Sol',
    conversation_model_status_display_policy:
      'single_model_selector_in_codex_conversation_composer_no_separate_status_pill',
    codex_auto_model_policy_ref: 'contracts/app-product-profile.json#codex.auto_model_policy',
    codex_precise_model_display_policy: 'friendly_model_primary_reasoning_primary_model_and_intelligence_secondary_menus',
    codex_default_permission_mode: 'full-access',
    permission_mode_selector_visible: true,
    conversation_backend_selector_visible: false,
    conversation_model_selector_visible: true,
    conversation_permission_mode_selector_visible: true,
  };
  assertDeepEqualJson(fieldsFrom(homeViewModel, expectedFields), expectedFields, 'Guid home page view model fields');
}

function validateGuidHomeLayout(homeViewModel) {
  assertDeepEqualJson(
    homeViewModel.home_layout,
    appOwnedPageStateHomeLayout,
    'Guid home page layout',
  );
  assertDeepEqualJson(homeViewModel.ordinary_visible_mcp_server_ids, [], 'Guid home ordinary MCP allowlist');
}

function validateGuidHomeDefaultAssistants(homeViewModel) {
  assertIncludesAll(homeViewModel.default_assistants, ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'], 'Guid home page default assistants');
  if (homeViewModel.default_assistants?.includes('opl-meta-agent')) {
    throw new Error('Guid home page must not include OMA as a default assistant');
  }
  assertIncludesAll(
    homeViewModel.professional_agent_packages,
    ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge', 'opl-meta-agent'],
    'Guid home page professional agent packages',
  );
  assertDeepEqualJson(
    homeViewModel.default_home_agent_packages,
    ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'],
    'Guid home page default home agent packages',
  );
  const requiredSkills = homeViewModel.default_assistant_required_skills ?? {};
  assertDeepEqualJson(
    ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'].map((assistant) => requiredSkills[assistant]),
    [['med-autoscience'], ['med-autogrant'], ['redcube-ai'], ['opl-bookforge']],
    'Guid home page required assistant skills',
  );
  const packageRequiredSkills = homeViewModel.default_agent_package_required_skills ?? {};
  assertDeepEqualJson(
    ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'].map((packageId) => packageRequiredSkills[packageId]),
    [['med-autoscience'], ['med-autogrant'], ['redcube-ai'], ['opl-bookforge']],
    'Guid home page required package skills',
  );
}

function validateGuidHomeRouteAndPurpose(homeViewModel) {
  assertDeepEqualJson(
    fieldsFrom(homeViewModel, {
      purpose_entry_source_ref: 'contracts/app-gui-product-contract.json#home_purpose_entries',
      route_receipt_source_ref: 'contracts/app-gui-product-contract.json#agent_package_invocation_receipt_policy',
      legacy_route_receipt_alias_source_ref: 'contracts/app-gui-product-contract.json#builtin_assistant_route_receipt_policy',
    }),
    {
      purpose_entry_source_ref: 'contracts/app-gui-product-contract.json#home_purpose_entries',
      route_receipt_source_ref: 'contracts/app-gui-product-contract.json#agent_package_invocation_receipt_policy',
      legacy_route_receipt_alias_source_ref: 'contracts/app-gui-product-contract.json#builtin_assistant_route_receipt_policy',
    },
    'Guid home page route and purpose source refs',
  );
  assertIncludesAll(
    homeViewModel.route_receipt_required_fields,
    ['route_kind', 'executor', 'package_id', 'shortcut_id', 'codex_visible_entry', 'required_skill_ids', 'source'],
    'Guid home page route receipt fields',
  );
  assertIncludesAll(
    homeViewModel.route_receipt_must_not_govern,
    ['session_behavior', 'domain_workflow', 'domain_readiness'],
    'Guid home page route receipt non-authority fields',
  );
  const homeAgentShortcuts = homeViewModel.home_agent_shortcuts ?? [];
  if (JSON.stringify(homeAgentShortcuts.map((entry) => entry.shortcut_id)) !== JSON.stringify(['research', 'grant', 'ppt', 'book', 'oma'])) {
    throw new Error('Guid home page must expose MAS, MAG, RCA, OBF, and OMA package shortcuts');
  }
  if (JSON.stringify(homeAgentShortcuts.map((entry) => entry.package_id)) !== JSON.stringify(['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge', 'opl-meta-agent'])) {
    throw new Error('Guid home page package shortcuts must target MAS, MAG, RCA, OBF, and OMA');
  }
  const homePurposeEntries = homeViewModel.home_purpose_entries ?? [];
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.id)) !== JSON.stringify(['research', 'grant', 'ppt', 'book'])) {
    throw new Error('Guid home page must expose research, grant, ppt, and book purpose entries');
  }
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'])) {
    throw new Error('Guid home page purpose entries must target MAS, MAG, RCA, and OBF');
  }
}

function validateGuidHomeVisibleSignals(guidHomePage) {
  assertIncludesAll(guidHomePage.must_show, [
    'Codex CLI fixed executor experience',
    'Codex model selector defaulting to 5.6 Sol',
    'reasoning effort configurable inside the Codex model menu',
    'conversation pending elapsed seconds while Codex is working',
    'purpose-first entries 科研/MAS, 基金/MAG, 演示/RCA, 写书/OBF',
    'active capability shown as a compact chip',
    'at most four lightweight OPL starters outside the composer',
    'assistant-scoped skill menu with required skill checked',
    'ordinary skill selector filtered to App-owned assistant profile skill allowlist',
    'workspace selector',
    'file attachment control',
    'send action',
    'single composer-first home input with context strip and bottom action row',
    'permission and access mode in user language',
    'workspace/session rail visible on wide desktop and drawer on narrow windows',
    'right context inspector collapsed by default',
    'runtime/task progress available from Runtime page, not Home activity grid',
  ], 'Guid home page visible signals');
}

function validateGuidHomeHiddenSignals(guidHomePage) {
  assertIncludesAll(guidHomePage.must_not_show, [
    'executor selector on the home input',
    'Aion CLI or Claude Code backend choices on the home input',
    'retired Codex model choices on the home input',
    'provider or backend terms in the permission and access mode',
    'persistent variable purpose selector in the composer',
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
  ], 'Guid home page hidden signals');
}

function validateGuidHomeActivityCenter(homeViewModel) {
  const expectedFields = {
    authority: 'app_owned_home_minimal_command_surface',
    source: 'not_rendered_on_ordinary_home',
    default_placement: 'not_rendered_on_ordinary_home',
    home_surface_policy: 'ordinary_home_must_not_render_activity_center_or_continue_work_grid',
  };
  assertDeepEqualJson(
    fieldsFrom(homeViewModel.activity_center, expectedFields),
    expectedFields,
    'Guid home page activity center',
  );
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

function fieldsFrom(record, expectedFields) {
  return Object.fromEntries(Object.keys(expectedFields).map((field) => [field, record?.[field]]));
}

function validateOrdinaryConversationPage(matrix) {
  const ordinaryConversationPage = pageById(matrix, 'ordinary_conversation', 'ordinary_conversation');
  if (ordinaryConversationPage.page_contract !== 'ordinary_codex_conversation') {
    throw new Error('Ordinary conversation page contract must be ordinary_codex_conversation');
  }
  assertDeepEqualJson(
    {
      ...Object.fromEntries(
        Object.entries(ordinaryConversationPage.conversation_view_model ?? {}).filter(
          ([key]) => key !== 'agent_package_invocation_receipt_required',
        ),
      ),
      current_task_slice: Object.fromEntries(
        Object.entries(ordinaryConversationPage.conversation_view_model?.current_task_slice ?? {}).filter(
          ([key]) => key !== 'fields',
        ),
      ),
    },
    {
      ...appOwnedPageStateOrdinaryConversation,
      current_task_slice: Object.fromEntries(
        Object.entries(appOwnedPageStateOrdinaryConversation.current_task_slice).filter(([key]) => key !== 'fields'),
      ),
    },
    'Ordinary conversation view model shell policy',
  );
  if (ordinaryConversationPage.conversation_view_model?.agent_package_invocation_receipt_required !== true) {
    throw new Error('Ordinary conversation view model must require agent package invocation receipts');
  }
  assertIncludesAll(
    ordinaryConversationPage.conversation_view_model?.current_task_slice?.fields,
    [
      ...appOwnedPageStateOrdinaryConversation.current_task_slice.fields,
      'resource_plan_ref',
      'resource_approval_ref',
      'resource_usage_ref',
      'console_policy_ref',
      'environment_template_ref',
      'environment_version_ref',
    ],
    'Ordinary conversation current task fields',
  );
  assertIncludesAll(ordinaryConversationPage.must_show, [
    'Codex CLI ordinary conversation',
    'floating bottom composer with safe inset',
    'compact active capability chip',
    'permission and access mode in user language',
    'projectless text conversation when no workspace is selected',
    'assistant route receipt',
    'Codex default model and reasoning status',
  ], 'Ordinary conversation page visible signals');
  assertIncludesAll(ordinaryConversationPage.must_not_show, [
    'backend selector as normal conversation control',
    'provider selector as normal conversation control',
    'provider or backend language inside permission and access mode',
    'persistent variable purpose selector in the composer',
  ], 'Ordinary conversation page hidden signals');
}

function validateRightContextInspectorPage(matrix) {
  const rightContextInspectorPage = pageById(matrix, 'right_context_inspector', 'right_context_inspector');
  const inspectorViewModel = rightContextInspectorPage.inspector_view_model;
  assertDeepEqualJson(
    (inspectorViewModel?.primary_tools ?? []).map((tool) => tool.id),
    appOwnedRightContextInspectorPrimaryToolIds,
    'Right context inspector primary tools',
  );
  assertDeepEqualJson(
    (inspectorViewModel?.secondary_sections ?? []).map((section) => section.id),
    appOwnedRightContextInspectorSecondarySectionIds,
    'Right context inspector secondary sections',
  );
  if (Array.isArray(inspectorViewModel?.tabs)) {
    throw new Error('Right context inspector must not restore equal-weight tabs');
  }
  const expectedFields = {
    placement: 'right',
    surface_kind: 'resizable_side_panel',
    default_state: 'collapsed',
    opens_on_user_request_only: true,
    chat_canvas_remains_primary: true,
    scope: 'selected_workspace_and_conversation',
    wide_desktop_mode: 'resizable_split',
    secondary_presentation: 'sections_or_disclosures_not_equal_weight_tabs',
    environment_popover_ref: 'contracts/app-gui-product-contract.json#interaction_baseline.context_surfaces.environment_popover',
  };
  assertDeepEqualJson(
    fieldsFrom(inspectorViewModel, expectedFields),
    expectedFields,
    'Right context inspector fields',
  );
  assertIncludesAll(rightContextInspectorPage.must_show, [
    'right-side resizable split panel closed by default',
    'Review, Terminal, Browser, and Files primary tools',
    'Artifacts, Runtime, Actions, and Memory secondary sections or disclosures',
    'environment popover kept distinct from the side panel',
  ], 'Right context inspector page visible signals');
  assertIncludesAll(rightContextInspectorPage.must_not_show, [
    'nine equal-weight side-panel tabs',
    'advanced work surfaces open by default',
  ], 'Right context inspector page hidden signals');
  assertIncludesAll(
    rightContextInspectorPage.must_not_own,
    ['runtime truth', 'domain truth', 'artifact body', 'memory body', 'backend selection authority'],
    'Right context inspector forbidden owners',
  );
}
