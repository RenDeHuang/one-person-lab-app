import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appOwnedPageStateHomeLayout,
  appOwnedPageStateOrdinaryConversation,
  appOwnedNewTaskLocality,
  appOwnedReviewSurfaceSourceEvidence,
  appOwnedRightContextInspectorForbiddenOwners,
  appOwnedRightContextInspectorPolicy,
  homeActivityCenterForbiddenDisplays,
} from './app-contract-constants.ts';
import { assertHomeComposerStateContract } from '../app-product-profile-shared-validators.ts';

export function validatePrimaryInteractionPages(matrix) {
  if (matrix.schema_version !== 2) {
    throw new Error('App page-state matrix schema_version must be 2');
  }
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
  assertHomeComposerStateContract(
    homeViewModel.home_composer_state_contract,
    'Guid Home page-state composer state contract',
  );
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
    local_worktree_lifecycle_ref:
      'contracts/app-gui-product-contract.json#interaction_baseline.conversation_scope.local_worktree_lifecycle',
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
    conversation_model_status_display_policy:
      'single_model_selector_in_codex_conversation_composer_no_separate_status_pill',
    codex_auto_model_policy_ref: 'contracts/app-product-profile.json#codex.auto_model_policy',
    codex_precise_model_display_policy: 'friendly_model_primary_reasoning_primary_model_secondary_menu',
    codex_default_permission_mode: 'full-access',
    permission_mode_selector_visible: true,
    conversation_backend_selector_visible: false,
    conversation_model_selector_visible: true,
    conversation_permission_mode_selector_visible: true,
  };
  assertDeepEqualJson(fieldsFrom(homeViewModel, expectedFields), expectedFields, 'Guid home page view model fields');
  assertDeepEqualJson(
    homeViewModel.new_task_locality,
    appOwnedNewTaskLocality,
    'Guid Home new-task Local or Worktree boundary',
  );
  for (const field of [
    'codex_default_model',
    'codex_default_reasoning_effort',
    'codex_default_display_label',
    'codex_default_model_display_value',
  ]) {
    if (typeof homeViewModel[field] !== 'string' || !homeViewModel[field].trim()) {
      throw new Error(`Guid home page view model ${field} must be a non-empty App projection`);
    }
  }
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
  assertIncludesAll(homeViewModel.default_assistants, ['mas', 'mag', 'rca', 'obf'], 'Guid home page default assistants');
  if (homeViewModel.default_assistants?.includes('oma')) {
    throw new Error('Guid home page must not include OMA as a default assistant');
  }
  assertIncludesAll(
    homeViewModel.professional_agent_packages,
    ['mas', 'mag', 'rca', 'obf', 'oma'],
    'Guid home page professional agent packages',
  );
  assertDeepEqualJson(
    homeViewModel.default_home_agent_packages,
    ['mas', 'mag', 'rca', 'obf', 'oma'],
    'Guid home page default home agent packages',
  );
  const requiredSkills = homeViewModel.default_assistant_required_skills ?? {};
  assertDeepEqualJson(
    ['mas', 'mag', 'rca', 'obf'].map((assistant) => requiredSkills[assistant]),
    [['med-autoscience'], ['med-autogrant'], ['redcube-ai'], ['opl-bookforge']],
    'Guid home page required assistant skills',
  );
  const packageRequiredSkills = homeViewModel.default_agent_package_required_skills ?? {};
  assertDeepEqualJson(
    ['mas', 'mag', 'rca', 'obf', 'oma'].map((packageId) => packageRequiredSkills[packageId]),
    [['med-autoscience'], ['med-autogrant'], ['redcube-ai'], ['opl-bookforge'], ['opl-meta-agent']],
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
  if (JSON.stringify(homeAgentShortcuts.map((entry) => entry.package_id)) !== JSON.stringify(['mas', 'mag', 'rca', 'obf', 'oma'])) {
    throw new Error('Guid home page package shortcuts must target MAS, MAG, RCA, OBF, and OMA');
  }
  if (
    JSON.stringify(homeAgentShortcuts.filter((entry) => entry.default_visible).map((entry) => entry.shortcut_id)) !==
    JSON.stringify(['research', 'grant', 'ppt', 'oma'])
  ) {
    throw new Error('Guid home page must default to Research, Grant, Presentation, and Meta Agent shortcuts');
  }
  if (homeAgentShortcuts.some((entry) => entry.user_configurable !== true)) {
    throw new Error('Guid home page package shortcuts must remain user configurable');
  }
  const homePurposeEntries = homeViewModel.home_purpose_entries ?? [];
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.id)) !== JSON.stringify(['research', 'grant', 'ppt', 'book'])) {
    throw new Error('Guid home page must expose research, grant, ppt, and book purpose entries');
  }
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca', 'obf'])) {
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
    'all user-visible configured OPL starters in stable order without silent truncation',
    'assistant-scoped skill menu with required skill checked',
    'ordinary skill selector filtered to App-owned assistant profile skill allowlist',
    'workspace selector',
    'file attachment control',
    'projectless attachments, arbitrary local file or directory selection, paste, drop, and /open subject only to Codex permissions',
    'New task Local or Worktree selection with optional starting branch and create or reuse managed worktree behavior',
    'send action',
    'single composer-first home input with context strip and bottom action row',
    'permission and access mode in user language',
    'workspace/session rail visible on wide desktop and drawer on narrow windows',
    'advanced work surfaces closed by default with no third column',
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
    'existing-task Local or Worktree handoff controls on Home',
    'snapshot, restore, or worktree cleanup controls claimed as available on Home',
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
    'desktop attach, permission and access, model and reasoning, and send or stop controls in the composer',
    'mobile plus sheet limited to OPL attach, project refs, access, model and reasoning, and active capability actions',
    'attachments and project refs consumed by the current send only',
    'permission and access mode in user language',
    'projectless text conversation when no workspace is selected',
    'projectless attachments, arbitrary local file or directory selection, paste, drop, and /open subject only to Codex permissions',
    'same-host Local or Worktree handoff for an existing not-loaded or idle task from Conversation Environment',
    'running, archived, or system-error task handoff shown unavailable without silent fallback',
    'Codex thread cwd updated before AionUI projection with best-effort cwd rollback on projection failure',
    'durable snapshot-before-remove and receipt restore for deterministic managed worktrees in Conversation Environment',
    'assistant route receipt',
    'Codex default model and reasoning status',
    'single current task instance in the message timeline, inline and unpinned for ordinary tasks',
    'current task becomes sticky only after user pin or a true long_running signal',
    'complete paginated redacted transcript export with Markdown default, strict JSON, explicit directory and filename',
  ], 'Ordinary conversation page visible signals');
  assertIncludesAll(ordinaryConversationPage.must_not_show, [
    'backend selector as normal conversation control',
    'provider selector as normal conversation control',
    'provider or backend language inside permission and access mode',
    'persistent variable purpose selector in the composer',
    'persistent project, workspace, locality, branch, attachment, or project-ref context strip',
    'backend, provider, Team, raw MCP, or arbitrary skills in the mobile plus sheet',
    'Local or Worktree handoff control inside the primary composer',
    'snapshot or worktree cleanup controls outside Conversation Environment or without a durable receipt',
    'automatic or remove-before-snapshot managed worktree deletion',
    'cross-host handoff shown as successful or available',
    'duplicate current task or Runtime summary outside the message timeline',
    'workspace bundle export authorization',
  ], 'Ordinary conversation page hidden signals');
}

function validateRightContextInspectorPage(matrix) {
  const rightContextInspectorPage = pageById(matrix, 'right_context_inspector', 'right_context_inspector');
  const inspectorViewModel = rightContextInspectorPage.inspector_view_model;
  const reviewSurface = inspectorViewModel?.review_surface ?? {};
  const sourceEvidenceFields = Object.keys(appOwnedReviewSurfaceSourceEvidence);
  const productPolicy = {
    ...inspectorViewModel,
    review_surface: Object.fromEntries(
      Object.entries(reviewSurface).filter(([key]) => !sourceEvidenceFields.includes(key)),
    ),
  };
  const expectedPolicy = {
    ...appOwnedRightContextInspectorPolicy,
    environment_popover_ref:
      'contracts/app-gui-product-contract.json#interaction_baseline.context_surfaces.environment_popover',
  };
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(productPolicy).filter(
        ([key]) => !['current_task_evidence', 'must_not_own'].includes(key),
      ),
    ),
    expectedPolicy,
    'On-demand advanced workspace surface policy',
  );
  assertDeepEqualJson(
    Object.fromEntries(sourceEvidenceFields.map((key) => [key, reviewSurface[key]])),
    appOwnedReviewSurfaceSourceEvidence,
    'On-demand Review source evidence',
  );
  for (const legacyField of ['tabs', 'primary_tools', 'secondary_sections']) {
    if (legacyField in (inspectorViewModel ?? {})) {
      throw new Error(`Page state must not restore legacy inspector taxonomy field ${legacyField}`);
    }
  }
  assertIncludesAll(rightContextInspectorPage.must_show, [
    'no third column mounted by default',
    'Files and Changes workspace surface opened only by user or task need',
    'Preview opened as an independent surface for artifact, file, URL, or result',
    'Review defaults to Unstaged, exposes Staged, Commit, Branch, and Last turn, supports uncommitted, base branch, commit, and custom targets with inline or detached delivery, and shows PR context unavailable when gh is missing',
    'Terminal and Browser opened from Environment or task need',
    'environment popover kept distinct from advanced work surfaces',
  ], 'Advanced workspace surface page visible signals');
  assertIncludesAll(rightContextInspectorPage.must_not_show, [
    'legacy equal-weight Review, Terminal, Browser, Files, Artifacts, Runtime, Actions, and Memory taxonomy',
    'Runtime duplicate outside the message timeline current task instance',
    'advanced work surfaces open by default',
  ], 'Advanced workspace surface page hidden signals');
  assertIncludesAll(
    rightContextInspectorPage.must_not_own,
    appOwnedRightContextInspectorForbiddenOwners,
    'Advanced workspace surface forbidden owners',
  );
}
