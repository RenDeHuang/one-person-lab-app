import { assertExpectedFields, assertStringArrayIncludes } from './value-assertions.ts';
import {
  appOwnedCodexSubagentActivityPolicy,
  appOwnedExplicitSessionInputPolicy,
  appOwnedRightContextInspectorForbiddenOwners,
  appOwnedRightContextInspectorPolicy,
  appOwnedSendFailureInputPolicy,
  appOwnedSessionWorkspaceModel,
  appOwnedTranscriptExport,
  appOwnedUnifiedContextMenu,
} from './validate-active-shell/app-contract-constants.ts';

type ProductProfileLike = {
  schema_version?: unknown;
  codex?: {
    default_model?: unknown;
    default_reasoning_effort?: unknown;
    auto_model_policy?: Record<string, unknown>;
  };
  gui?: {
    authority?: unknown;
    implementation_carrier?: unknown;
    appearance?: {
      default_css_theme_id?: unknown;
      codex_theme_default_enabled?: unknown;
    };
    home?: Record<string, unknown> & {
      codex_auto_model_selection?: Record<string, unknown>;
      codex_model_display_options?: Record<string, unknown> & {
        auto_option?: Record<string, unknown>;
        reasoning_labels?: Record<string, { zh?: unknown; en?: unknown }>;
        visible_models?: Array<Record<string, unknown>>;
      };
    };
    ordinary_conversation?: Record<string, unknown>;
    right_context_inspector?: Record<string, unknown>;
    builtin_assistant_route_receipt_policy?: Record<string, unknown>;
    agent_package_invocation_receipt_policy?: Record<string, unknown>;
  };
  settings?: {
    control_plane?: {
      experience_contract?: {
        visual_system?: Record<string, unknown>;
      };
    };
  };
};

type HomePolicyOptions = {
  requireEnglishStatusLabel?: boolean;
  requireSelectionPersistence?: boolean;
};

type ModelDisplayOptions = {
  requireAutoIdAndDescriptions?: boolean;
};

type RouteReceiptOptions = {
  requireExactAssistants?: boolean;
};

export const starterPackageIds = ['mas', 'mag', 'rca', 'obf'];
export const starterShortcutIds = ['research', 'grant', 'ppt', 'book'];
export const professionalAgentPackageIds = [...starterPackageIds, 'oma'];
export const managedShortcutIds = ['research', 'ppt', 'grant', 'book', 'oma'];
export const managedShortcutPackageIds = ['mas', 'rca', 'mag', 'obf', 'oma'];
export const defaultVisibleShortcutIds = ['research', 'ppt', 'grant', 'oma'];
export const defaultVisibleShortcutPackageIds = ['mas', 'rca', 'mag', 'oma'];
export const forbiddenExternalFirstPartyClaimPattern =
  '^\\s*[Ff][Ii][Rr][Ss][Tt][^A-Za-z0-9]*[Pp][Aa][Rr][Tt][Yy]';

export function isExternalFirstPartyClaim(value: unknown): boolean {
  return typeof value === 'string' && new RegExp(forbiddenExternalFirstPartyClaimPattern).test(value);
}

export const requiredSkillByPackageId = {
  mas: ['med-autoscience'],
  mag: ['med-autogrant'],
  rca: ['redcube-ai'],
  obf: ['opl-bookforge'],
  oma: ['opl-meta-agent'],
};
export const requiredSkillByAssistantId = {
  mas: 'med-autoscience',
  mag: 'med-autogrant',
  rca: 'redcube-ai',
  obf: 'opl-bookforge',
};

export const expectedHomeComposerStateContract = {
  contract_id: 'opl_home_composer_state.v1',
  executor: 'codex',
  shortcut_package_ids: [null, 'mas', 'mag', 'rca', 'obf', 'oma'],
  viewports: ['desktop', 'mobile'],
  availability_states: ['available', 'unavailable'],
  invariants: {
    model_reasoning_visible: true,
    permission_access_visible: true,
    executor_selector_visible: false,
    active_shortcut_changes_executor: false,
    default_visibility_governs_execution: false,
    single_home_root: true,
    single_composer_shell: true,
    single_footer_account_settings_entry: true,
  },
  semantic_probe: {
    root_test_id: 'opl-guid-entry',
    instance_counts: {
      'opl-guid-entry': 1,
      'guid-input-card-shell': 1,
    },
    instance_count_groups: {
      footer_account_or_settings: {
        test_ids: ['sider-footer-account', 'sider-footer-settings'],
        total: 1,
      },
    },
    state_attributes: {
      executor: 'data-opl-composer-executor',
      active_shortcut_id: 'data-opl-active-shortcut',
      model_reasoning_visible: 'data-opl-model-reasoning-visible',
      permission_access_visible: 'data-opl-permission-access-visible',
      executor_selector_visible: 'data-opl-executor-selector-visible',
    },
    desktop_required_controls: ['guid-model-selector', 'agent-mode-selector-*'],
    mobile_required_controls: [
      'mobile-action-sheet-model',
      'mobile-action-sheet-reasoning',
      'mobile-action-sheet-permission',
    ],
    forbidden_controls: ['agent-pill-*'],
    failure_field: 'missing_controls',
  },
};

export function assertHomeComposerStateContract(value: unknown, label: string): void {
  if (JSON.stringify(value) !== JSON.stringify(expectedHomeComposerStateContract)) {
    throw new Error(`${label} must preserve the fixed Codex executor controls for every Home shortcut state`);
  }
}
const codexEntryByPackageId = {
  mas: 'med-autoscience',
  mag: 'med-autogrant',
  rca: 'redcube-ai',
  obf: 'opl-bookforge',
  oma: 'opl-meta-agent',
};
const agentPackageReceiptRequiredFields = [
  'route_kind',
  'executor',
  'package_id',
  'shortcut_id',
  'codex_visible_entry',
  'required_skill_ids',
  'source',
];
const expectedCodexVisibleModels = [
  { id: 'gpt-5.6-sol', label_zh: '5.6 Sol', label_en: '5.6 Sol' },
  { id: 'gpt-5.6-terra', label_zh: '5.6 Terra', label_en: '5.6 Terra' },
  { id: 'gpt-5.6-luna', label_zh: '5.6 Luna', label_en: '5.6 Luna' },
  { id: 'gpt-5.5', label_zh: '5.5', label_en: '5.5' },
  { id: 'gpt-5.4', label_zh: '5.4', label_en: '5.4' },
  { id: 'gpt-5.4-mini', label_zh: '5.4 Mini', label_en: '5.4 Mini' },
  { id: 'gpt-5.2', label_zh: '5.2', label_en: '5.2' },
];
const expectedReasoningLabels = {
  low: { zh: '推理低', en: 'Low reasoning' },
  medium: { zh: '推理中', en: 'Medium reasoning' },
  high: { zh: '推理高', en: 'High reasoning' },
  xhigh: { zh: '推理超高', en: 'Extra high reasoning' },
  max: { zh: '推理最高', en: 'Maximum reasoning' },
  ultra: { zh: '推理极高', en: 'Ultra reasoning' },
};

type GuiLike = NonNullable<ProductProfileLike['gui']>;
type HomeLike = GuiLike['home'];
type CodexModelDisplayOptionsLike = NonNullable<NonNullable<HomeLike>['codex_model_display_options']>;
type ProfessionalAgentPackageLike = {
  package_id: string;
  agent_id?: unknown;
  installed_manageable?: unknown;
  codex_visible_entry?: unknown;
  required_skill_ids?: unknown;
  required_skill_policy?: unknown;
  optional_skill_policy?: unknown;
  skill_menu_policy?: unknown;
  package_kind?: unknown;
  default_home_visible?: unknown;
  home_shortcut_ids?: unknown[];
};
function assertExactStringArray(actual: unknown, expected: string[], label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}`);
  }
}

export function assertProfessionalAgentPackagePolicy(
  packages: ProfessionalAgentPackageLike[] | undefined,
  label: string,
): void {
  const entries = packages ?? [];
  assertExactStringArray(
    entries.map((entry) => entry.package_id),
    professionalAgentPackageIds,
    `${label} professional agent packages`,
  );
  for (const entry of entries) {
    const requiredSkills = requiredSkillByPackageId[entry.package_id as keyof typeof requiredSkillByPackageId];
    const codexEntry = codexEntryByPackageId[entry.package_id as keyof typeof codexEntryByPackageId];
    if (!requiredSkills || !codexEntry) {
      throw new Error(`${label} professional agent package ${entry.package_id} is not in the App package allowlist`);
    }
    if (
      entry.agent_id !== entry.package_id ||
      entry.installed_manageable !== true ||
      entry.codex_visible_entry !== codexEntry ||
      JSON.stringify(entry.required_skill_ids) !== JSON.stringify(requiredSkills) ||
      entry.required_skill_policy !== 'checked_locked' ||
      entry.optional_skill_policy !== 'unchecked_user_selectable' ||
      entry.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible'
    ) {
      throw new Error(`${label} professional agent package ${entry.package_id} has invalid shortcut or skill policy`);
    }
    if (starterPackageIds.includes(entry.package_id)) {
      const expectedDefaultVisible = defaultVisibleShortcutPackageIds.includes(entry.package_id);
      if (
        entry.package_kind !== 'starter_professional_agent_package' ||
        entry.default_home_visible !== expectedDefaultVisible ||
        entry.home_shortcut_ids.length !== 1
      ) {
        throw new Error(`${label} starter package ${entry.package_id} has invalid default Home visibility or shortcut policy`);
      }
    }
    if (entry.package_id === 'oma' && (
      entry.package_kind !== 'managed_professional_agent_package' ||
      entry.default_home_visible !== true ||
      JSON.stringify(entry.home_shortcut_ids) !== JSON.stringify(['oma'])
    )) {
      throw new Error(`${label} must keep OMA installed/manageable and visible through its configurable Home shortcut`);
    }
  }
}

export function assertAppProductProfileGuiAuthority(
  profile: ProductProfileLike,
  label = 'App product profile',
): void {
  if (profile.gui?.authority !== 'app_repo_owned_product_truth') {
    throw new Error(`${label} GUI authority must be App-owned`);
  }
  if (profile.gui?.implementation_carrier !== 'opl-aion-shell') {
    throw new Error(`${label} GUI implementation carrier must be opl-aion-shell`);
  }
  if (
    profile.gui.appearance?.default_css_theme_id !== 'default-theme' ||
    profile.gui.appearance?.codex_theme_default_enabled !== false
  ) {
    throw new Error(`${label} GUI appearance must default to the default theme`);
  }
}

export function assertAppProductProfileHomeCodexPolicy(
  profile: ProductProfileLike,
  label = 'App product profile',
  options: HomePolicyOptions = {},
): void {
  const home = profile.gui?.home;
  assertHomeCodexFixedExecutorFields(profile, home, label);
  assertHomeCodexEnglishStatusLabel(home, label, options);
  assertHomeCodexAutoSelectionPolicy(profile, home, label, options);
}

function assertHomeCodexFixedExecutorFields(
  profile: ProductProfileLike,
  home: HomeLike,
  label: string,
): void {
  assertExpectedFields(
    [
      { actual: home?.primary_input_surface, expected: 'single_card' },
      { actual: home?.nested_input_card_frames_allowed, expected: false },
      { actual: home?.codex_cli_fixed_executor, expected: true },
      { actual: home?.home_executor_selector_visible, expected: false },
      { actual: home?.codex_model_selector_visible, expected: true },
      { actual: home?.codex_model_list_visible, expected: true },
      { actual: home?.codex_model_policy, expected: 'codex_cli_latest_strongest_model_selector_visible' },
      { actual: home?.codex_model_auto_option_visible, expected: true },
      { actual: home?.codex_default_model, expected: profile.codex?.default_model },
      { actual: home?.codex_default_reasoning_effort, expected: profile.codex?.default_reasoning_effort },
      { actual: home?.codex_default_permission_mode, expected: 'full-access' },
      { actual: home?.permission_mode_selector_visible, expected: true },
      { actual: home?.conversation_backend_selector_visible, expected: false },
      { actual: home?.conversation_model_selector_visible, expected: true },
      { actual: home?.conversation_permission_mode_selector_visible, expected: true },
      { actual: home?.codex_home_model_status_label, expected: '5.6 Sol' },
      {
        actual: home?.codex_precise_model_display_policy,
        expected: 'friendly_model_primary_reasoning_primary_model_secondary_menu',
      },
    ],
    `${label} GUI home must keep Codex CLI fixed while exposing App-owned model selectors`,
  );
}

export function assertAppProductProfileGuiInteractionBaseline(
  profile: ProductProfileLike,
  label = 'App product profile',
): void {
  if (profile.schema_version !== 2) {
    throw new Error(`${label} schema_version must be 2`);
  }
  const homeLayout = profile.gui?.home?.home_layout as Record<string, unknown> | undefined;
  const conversation = profile.gui?.ordinary_conversation;
  const inspector = profile.gui?.right_context_inspector;
  assertExpectedFields(
    [
      { actual: homeLayout?.composer_position, expected: 'floating_bottom_with_safe_inset' },
      { actual: homeLayout?.desktop_composer_max_width_px, expected: 736 },
      { actual: homeLayout?.desktop_composer_min_height_px, expected: 98 },
      { actual: homeLayout?.desktop_composer_corner_radius_px, expected: 22 },
      { actual: homeLayout?.desktop_context_bar_height_px, expected: 52 },
      { actual: homeLayout?.desktop_context_bar_overlap_px, expected: 13 },
      { actual: homeLayout?.desktop_context_bar_horizontal_inset_px, expected: 12 },
      { actual: homeLayout?.workspace_selector_visible, expected: true },
      {
        actual: homeLayout?.workspace_selector_entry,
        expected: 'home.new_session_context_bar',
      },
      { actual: homeLayout?.unselected_workspace_control_visible, expected: true },
      {
        actual: homeLayout?.unselected_workspace_control_policy,
        expected: 'localized_choose_project_directory_action_not_projectless_status_placeholder',
      },
      {
        actual: homeLayout?.selected_working_directory_visual_policy,
        expected: 'independent_new_session_context_bar_control_with_selected_directory_and_clear_action',
      },
      { actual: homeLayout?.workspace_session_rail_default_state, expected: 'visible_wide_drawer_narrow' },
      { actual: homeLayout?.right_context_inspector_default_state, expected: 'collapsed' },
      {
        actual: conversation?.entry_source,
        expected: 'home_starter_workspace_initialized_or_projectless_new_session',
      },
      { actual: conversation?.composer_position, expected: 'floating_bottom_with_safe_inset' },
      { actual: conversation?.permission_mode_selector_visible, expected: true },
      {
        actual: conversation?.composer_placeholder_policy,
        expected: 'opl_owned_localized_task_prompt_without_backend_name_interpolation',
      },
      { actual: inspector?.default_third_column_visible, expected: false },
      { actual: inspector?.runtime_duplicate_allowed, expected: false },
      { actual: inspector?.equal_weight_tool_taxonomy_allowed, expected: false },
    ],
    `${label} GUI interaction profile must match the Codex baseline`,
  );
  assertExactStringArray(
    conversation?.composer_bottom_action_row,
    ['unified_context_menu', 'permission_access_mode', 'model_reasoning', 'send_stop'],
    `${label} GUI composer bottom action row`,
  );
  assertExactStringArray(
    conversation?.composer_context_strip,
    ['active_capability'],
    `${label} GUI composer persistent context`,
  );
  assertExactStringArray(
    conversation?.composer_send_scoped_inputs,
    ['attachments'],
    `${label} GUI composer send-scoped inputs`,
  );
  if (
    JSON.stringify(conversation?.send_failure_input_policy) !==
    JSON.stringify(appOwnedSendFailureInputPolicy)
  ) {
    throw new Error(
      `${label} GUI conversation must preserve prompt and attachments across creation, initial-send, and in-conversation send failures`,
    );
  }
  assertExactStringArray(
    conversation?.composer_forbidden_persistent_context,
    ['project', 'workspace', 'locality', 'branch', 'attachments', 'workspace_context_refs'],
    `${label} GUI composer forbidden persistent context`,
  );
  if (
    JSON.stringify(conversation?.session_workspace_model) !== JSON.stringify(appOwnedSessionWorkspaceModel) ||
    JSON.stringify(conversation?.explicit_session_input_policy) !== JSON.stringify(appOwnedExplicitSessionInputPolicy) ||
    'project_context_inputs' in (conversation ?? {}) ||
    'projectless_input_policy' in (conversation ?? {})
  ) {
    throw new Error(`${label} GUI conversation must keep session identity primary and accept only explicit current-session inputs`);
  }
  if (
    JSON.stringify(conversation?.codex_subagent_activity) !==
    JSON.stringify(appOwnedCodexSubagentActivityPolicy)
  ) {
    throw new Error(`${label} GUI Codex subagent activity must remain a read-only projection without private orchestration`);
  }
  if (
    JSON.stringify(conversation?.transcript_export) !== JSON.stringify(appOwnedTranscriptExport)
  ) {
    throw new Error(`${label} GUI transcript export must remain shareable transcript only`);
  }
  if (
    JSON.stringify(
      Object.fromEntries(
        Object.entries(inspector ?? {}).filter(([key]) => key !== 'must_not_own'),
      ),
    ) !== JSON.stringify(appOwnedRightContextInspectorPolicy)
  ) {
    throw new Error(`${label} GUI advanced workspace surfaces must match the 41301 policy`);
  }
  for (const legacyField of ['tabs', 'primary_tools', 'secondary_sections']) {
    if (legacyField in (inspector ?? {})) {
      throw new Error(`${label} GUI must not restore legacy inspector taxonomy field ${legacyField}`);
    }
  }
  assertExactStringArray(
    inspector?.must_not_own,
    appOwnedRightContextInspectorForbiddenOwners,
    `${label} GUI advanced workspace forbidden owners`,
  );
  const mobileActionSheet = conversation?.mobile_action_sheet as Record<string, unknown> | undefined;
  assertExactStringArray(
    mobileActionSheet?.allowed_actions,
    ['unified_context_menu', 'permission_access_mode', 'model_reasoning', 'active_capability'],
    `${label} GUI mobile action sheet allowed actions`,
  );
  assertExactStringArray(
    mobileActionSheet?.forbidden_actions,
    ['backend', 'provider', 'team', 'raw_mcp', 'arbitrary_skills'],
    `${label} GUI mobile action sheet forbidden actions`,
  );
  if (mobileActionSheet?.send_stop_location !== 'composer_primary_action_outside_sheet') {
    throw new Error(`${label} GUI mobile send/stop must remain the composer primary action`);
  }
  if (JSON.stringify(conversation?.unified_context_menu) !== JSON.stringify(appOwnedUnifiedContextMenu)) {
    throw new Error(`${label} GUI unified context menu must expose only real App-authorized context actions`);
  }
}

export function assertAppProductProfileSettingsVisualSystem(
  profile: ProductProfileLike,
  label = 'App product profile',
): void {
  const visualSystem = profile.settings?.control_plane?.experience_contract?.visual_system;
  assertExpectedFields(
    [
      { actual: visualSystem?.style, expected: 'codex_quiet_control_center_with_opl_information_architecture' },
      { actual: visualSystem?.style_exclusion, expected: 'multi_hue_card_dashboard' },
      {
        actual: visualSystem?.card_policy,
        expected: 'unframed_sections_with_bounded_groups_only_for_repeated_entities_or_confirmation',
      },
      { actual: visualSystem?.nested_cards_allowed, expected: false },
      { actual: visualSystem?.page_wide_list_wall_allowed, expected: false },
      { actual: visualSystem?.page_sections_as_floating_cards_allowed, expected: false },
      { actual: visualSystem?.footer_layout, expected: 'compact' },
      {
        actual: visualSystem?.footer_account_entry_policy,
        expected:
          'show_gateway_display_name_when_connected_else_settings_on_all_routes_and_open_account_gateway_or_overview',
      },
      {
        actual: visualSystem?.footer_update_entry_policy,
        expected:
          'show_confirmed_newer_app_update_as_account_row_trailing_action_and_reuse_existing_carrier_updater_without_owning_update_truth',
      },
      { actual: visualSystem?.footer_theme_quick_toggle_allowed, expected: false },
      { actual: visualSystem?.footer_secondary_navigation_allowed, expected: false },
      { actual: visualSystem?.appearance_mode_presentation, expected: 'three_visual_preview_cards' },
      { actual: visualSystem?.appearance_mode_preserves_theme_preset, expected: false },
      { actual: visualSystem?.theme_gallery_presentation, expected: 'not_exposed' },
      { actual: visualSystem?.theme_swatch_list_allowed, expected: false },
      { actual: visualSystem?.max_border_radius_px, expected: 8 },
    ],
    `${label} Settings visual system must preserve the Codex quiet baseline with OPL information architecture`,
  );
  if (
    JSON.stringify(visualSystem?.footer_controls) !==
      JSON.stringify(['gateway_account_or_settings_entry', 'app_update_status_and_trigger']) ||
    JSON.stringify(visualSystem?.appearance_mode_values) !== JSON.stringify(['system', 'light', 'dark'])
  ) {
    throw new Error(
      `${label} footer must reserve a conditional account-row update action and keep System, Light, and Dark in Settings`,
    );
  }
}

function assertHomeCodexEnglishStatusLabel(
  home: HomeLike,
  label: string,
  options: HomePolicyOptions,
): void {
  if (options.requireEnglishStatusLabel && home?.codex_home_model_status_label_en !== '5.6 Sol') {
    throw new Error(`${label} GUI home must expose the English 5.6 Sol status label without repeated reasoning`);
  }
}

function assertHomeCodexAutoSelectionPolicy(
  profile: ProductProfileLike,
  home: HomeLike,
  label: string,
  options: HomePolicyOptions,
): void {
  const autoSelection = home?.codex_auto_model_selection;
  assertExpectedFields(
    [
      { actual: autoSelection?.policy_source_ref, expected: 'contracts/app-product-profile.json#codex.auto_model_policy' },
      { actual: autoSelection?.user_can_override_model, expected: true },
      { actual: autoSelection?.user_can_override_reasoning_effort, expected: true },
      { actual: autoSelection?.user_can_restore_auto, expected: true },
    ],
    `${label} GUI home must expose the OPL Flow model projection and user override on the home path`,
  );
  if (options.requireSelectionPersistence && autoSelection?.selection_persists_into_conversation !== true) {
    throw new Error(`${label} GUI home Codex model selection must persist into conversation`);
  }
  assertCodexAutoModelPolicy(profile.codex?.auto_model_policy, profile, label);
}

function assertCodexAutoModelPolicy(
  policy: Record<string, unknown> | undefined,
  profile: ProductProfileLike,
  label: string,
): void {
  const configuredDefault = policy?.configured_default as Record<string, unknown> | undefined;
  if (
    typeof configuredDefault?.model !== 'string' ||
    !configuredDefault.model.trim() ||
    typeof configuredDefault?.reasoning_effort !== 'string' ||
    !configuredDefault.reasoning_effort.trim()
  ) {
    throw new Error(`${label} Codex Auto model policy must define one configured default model and reasoning effort`);
  }
  assertExpectedFields(
    [
      { actual: policy?.authority, expected: 'one-person-lab-app' },
      { actual: policy?.recommendation_authority, expected: 'opl-flow' },
      { actual: policy?.policy_source_ref, expected: 'gaofeng21cn/opl-flow:contracts/workflow-policy.json#codex_model_policy' },
      { actual: policy?.app_role, expected: 'display_live_catalog_and_submit_user_override' },
      { actual: policy?.mode_default, expected: 'auto' },
      { actual: policy?.model_catalog_source, expected: 'codex_cli_model_list' },
      { actual: policy?.catalog_response_models_field, expected: 'data' },
      { actual: policy?.catalog_default_model_field, expected: 'isDefault' },
      { actual: policy?.catalog_supported_reasoning_efforts_field, expected: 'supportedReasoningEfforts' },
      { actual: policy?.catalog_supported_reasoning_effort_option_value_field, expected: 'reasoningEffort' },
      { actual: policy?.catalog_reasoning_effort_order_policy, expected: 'last_advertised_supported_reasoning_effort_is_highest' },
      { actual: policy?.catalog_pagination_request_cursor_field, expected: 'cursor' },
      { actual: policy?.catalog_pagination_response_cursor_field, expected: 'nextCursor' },
      { actual: policy?.catalog_pagination_completion_policy, expected: 'exhaust_pages_until_next_cursor_is_null' },
      { actual: policy?.catalog_hidden_model_field, expected: 'hidden' },
      { actual: policy?.catalog_hidden_model_policy, expected: 'exclude_hidden_models_from_auto_and_fixed_options' },
      { actual: policy?.frontier_model_preference_order_role, expected: 'known_model_fallback_and_fixed_option_preference_not_allowlist' },
      { actual: policy?.unknown_default_model_policy, expected: 'accept_catalog_default_even_when_not_in_frontier_model_preference_order' },
      { actual: policy?.unknown_model_reasoning_effort_policy, expected: 'highest_supported_reasoning_effort_from_catalog' },
      { actual: policy?.catalog_without_default_policy, expected: 'first_available_known_model_then_first_catalog_model' },
    ],
    `${label} Codex Auto model policy must follow the Codex CLI catalog`,
  );
  const visibleModelIds = profile.gui?.home?.codex_model_display_options?.visible_models?.map((model) => model.id);
  assertExactStringArray(
    policy?.frontier_model_preference_order,
    visibleModelIds as string[],
    `${label} Codex known model preference order`,
  );
  const overrides = policy?.known_model_reasoning_effort_overrides as Record<string, unknown> | undefined;
  if (overrides?.[configuredDefault.model] !== configuredDefault.reasoning_effort) {
    throw new Error(`${label} Codex configured default reasoning must project into known model overrides`);
  }
  if (JSON.stringify(policy?.catalog_unavailable_fallback) !== JSON.stringify(configuredDefault)) {
    throw new Error(`${label} Codex catalog fallback must derive from the configured default`);
  }
  if (JSON.stringify(policy?.persistence_policy) !== JSON.stringify({
    auto: 'persist_auto_mode_only_resolve_model_and_reasoning_from_fresh_catalog',
    fixed: 'persist_selected_model_and_reasoning_effort',
    state_encoding: 'auto_has_no_model_snapshot_fixed_has_model_and_reasoning',
    reasoning_override_from_auto: 'pin_current_resolved_model_and_exit_auto',
    stale_fixed_model: 'preserve_fixed_selection_as_unavailable_until_user_restores_auto_or_selects_available_model',
  })) {
    throw new Error(`${label} Codex persistence must keep Auto dynamic and fixed overrides durable`);
  }
}

export function assertAppProductProfileCodexModelDisplayOptions(
  profile: ProductProfileLike,
  label = 'App product profile',
  options: ModelDisplayOptions = {},
): void {
  const displayOptions = profile.gui?.home?.codex_model_display_options;
  const frontierOrder = profile.codex?.auto_model_policy?.frontier_model_preference_order;
  assertCodexModelDisplayShape(profile, displayOptions, frontierOrder, label);
  assertCodexAutoModelOptionDescription(displayOptions?.auto_option, label, options);
  assertVisibleCodexModelsUseFriendlyDefaults(displayOptions?.visible_models ?? [], label);
}

function assertCodexModelDisplayShape(
  profile: ProductProfileLike,
  displayOptions: CodexModelDisplayOptionsLike | undefined,
  frontierOrder: unknown,
  label: string,
): void {
  const auto = displayOptions?.auto_option;
  const visibleModels = displayOptions?.visible_models ?? [];
  assertExpectedFields(
    [
      {
        actual: displayOptions?.display_policy,
        expected: 'friendly_model_name_primary_reasoning_primary_model_secondary_menu',
      },
      {
        actual: displayOptions?.button_label_policy,
        expected: 'resolved_model_compact_label_with_selected_reasoning_effort_no_auto_prefix',
      },
      { actual: displayOptions?.raw_model_id_visible_in_ordinary_ui, expected: false },
      { actual: displayOptions?.reasoning_effort_visible_for_every_option, expected: false },
      { actual: displayOptions?.reasoning_effort_menu_visible, expected: true },
      { actual: displayOptions?.reasoning_menu_title_zh, expected: '推理' },
      { actual: displayOptions?.reasoning_menu_title_en, expected: 'Reasoning' },
      { actual: displayOptions?.reasoning_effort_override_surface, expected: 'model_selector_primary_menu' },
      { actual: displayOptions?.reasoning_effort_options_source, expected: 'acp_codex_config_options_enum' },
      { actual: displayOptions?.default_reasoning_effort, expected: profile.codex?.default_reasoning_effort },
      { actual: displayOptions?.auto_option_current_resolution_visible, expected: true },
      { actual: displayOptions?.model_menu_policy, expected: 'current_model_secondary_submenu' },
      { actual: auto?.label_zh, expected: '自动（推荐）' },
      { actual: auto?.label_en, expected: 'Auto (recommended)' },
      { actual: auto?.catalog_unavailable_fallback_model, expected: profile.codex?.default_model },
      {
        actual: auto?.catalog_unavailable_fallback_reasoning_effort,
        expected: profile.codex?.default_reasoning_effort,
      },
      { actual: auto?.follows_latest_strongest, expected: true },
      { actual: displayOptions?.fixed_model_description_zh, expected: '固定此模型' },
      { actual: displayOptions?.fixed_model_description_en, expected: 'Use this model' },
      {
        actual: JSON.stringify(frontierOrder),
        expected: JSON.stringify(expectedCodexVisibleModels.map((model) => model.id)),
      },
      {
        actual: JSON.stringify(visibleModels.map((model) => model.id)),
        expected: JSON.stringify(expectedCodexVisibleModels.map((model) => model.id)),
      },
    ],
    `${label} GUI home must expose friendly Codex model display options with reasoning labels`,
  );
  assertReasoningOptions(displayOptions, profile, label);
  assertRetiredCodexModelsHidden(visibleModels, label);
}

function assertReasoningOptions(
  displayOptions: CodexModelDisplayOptionsLike | undefined,
  profile: ProductProfileLike,
  label: string,
): void {
  const options = displayOptions?.user_reasoning_effort_options;
  if (!Array.isArray(options) || !options.every((effort) => typeof effort === 'string' && effort.trim())) {
    throw new Error(`${label} Codex reasoning effort options must be non-empty strings`);
  }
  if (!options.includes(profile.codex?.default_reasoning_effort)) {
    throw new Error(`${label} Codex reasoning effort options must include the configured default`);
  }
  for (const effort of Object.keys(expectedReasoningLabels)) {
    const labels = displayOptions?.reasoning_labels?.[effort];
    const expectedLabels = expectedReasoningLabels[effort as keyof typeof expectedReasoningLabels];
    if (labels?.zh !== expectedLabels.zh || labels?.en !== expectedLabels.en) {
      throw new Error(`${label} Codex reasoning effort option ${effort} must use Codex App labels`);
    }
  }
}

function assertCodexAutoModelOptionDescription(
  auto: CodexModelDisplayOptionsLike['auto_option'] | undefined,
  label: string,
  options: ModelDisplayOptions,
): void {
  if (
    options.requireAutoIdAndDescriptions &&
    (
      auto!.id !== '__auto' ||
      typeof auto!.description_zh !== 'string' ||
      !auto!.description_zh.includes('Codex CLI') ||
      !auto!.description_zh.includes('App 推理策略') ||
      typeof auto!.description_en !== 'string' ||
      !auto!.description_en.includes('Codex CLI') ||
      !auto!.description_en.includes('App reasoning policy')
    )
  ) {
    throw new Error(`${label} Codex auto model option must describe dynamic catalog resolution without a static snapshot`);
  }
}

function assertVisibleCodexModelsUseFriendlyDefaults(
  visibleModels: NonNullable<CodexModelDisplayOptionsLike['visible_models']>,
  label: string,
): void {
  for (const expected of expectedCodexVisibleModels) {
    const actual = visibleModels.find((model) => model.id === expected.id);
    if (actual?.label_zh !== expected.label_zh || actual?.label_en !== expected.label_en) {
      throw new Error(`${label} GUI home known Codex model ${expected.id} must keep its App label`);
    }
  }
  for (const model of visibleModels) {
    if (
      typeof model.label_zh !== 'string' ||
      typeof model.label_en !== 'string' ||
      model.label_zh === model.id ||
      model.label_en === model.id ||
      'reasoning_effort' in model
    ) {
      throw new Error(`${label} GUI home Codex model ${model.id} must use friendly labels without repeating reasoning`);
    }
  }
}

function assertRetiredCodexModelsHidden(
  visibleModels: NonNullable<CodexModelDisplayOptionsLike['visible_models']>,
  label: string,
): void {
  const forbidden = new Set([
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex',
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ]);
  for (const model of visibleModels) {
    if (typeof model.id === 'string' && forbidden.has(model.id)) {
      throw new Error(`${label} GUI home must not expose retired Codex model ${model.id} as an ordinary visible model`);
    }
  }
}

export function assertAppProductProfileRouteReceiptPolicy(
  profile: ProductProfileLike,
  label = 'App product profile',
  options: RouteReceiptOptions = {},
): void {
  const policy = profile.gui?.agent_package_invocation_receipt_policy;
  if (
    policy?.scope !== 'package_shortcut_launch_to_codex_conversation' ||
    policy.route_kind !== 'agent_package_shortcut' ||
    policy.executor !== 'codex_cli' ||
    policy.source !== 'opl_app_home' ||
    policy.receipt_authority !== 'launch_fact_only_no_session_behavior_domain_workflow_or_readiness' ||
    policy.must_not_depend_on_visible_backend_selection !== true
  ) {
    throw new Error(`${label} must require agent package shortcut Codex CLI launch receipts`);
  }
  if (options.requireExactAssistants) {
    assertExactStringArray(policy.required_for_package_shortcuts, managedShortcutIds, `${label} package shortcut receipt ids`);
  } else {
    assertStringArrayIncludes(policy.required_for_package_shortcuts, managedShortcutIds, `${label} package shortcut receipt ids`);
  }
  assertStringArrayIncludes(
    policy.required_fields,
    agentPackageReceiptRequiredFields,
    `${label} package shortcut receipt fields`,
  );
  assertStringArrayIncludes(
    policy.must_not_govern,
    ['session_behavior', 'domain_workflow', 'domain_readiness'],
    `${label} package shortcut receipt non-authority fields`,
  );

  const legacyPolicy = profile.gui?.builtin_assistant_route_receipt_policy;
  if (
    legacyPolicy &&
    (
      legacyPolicy.migration_alias_for !== 'agent_package_invocation_receipt_policy' ||
      legacyPolicy.scope !== 'home_purpose_entry_to_conversation' ||
      legacyPolicy.route_kind !== 'builtin_capability' ||
      legacyPolicy.executor !== 'codex_cli' ||
      legacyPolicy.source !== 'opl_app_home' ||
      legacyPolicy.must_not_depend_on_visible_backend_selection !== true
    )
  ) {
    throw new Error(`${label} legacy built-in assistant route receipt policy must stay a migration alias`);
  }
  if (!legacyPolicy) {
    return;
  }
  if (options.requireExactAssistants) {
    assertExactStringArray(legacyPolicy.required_for_assistants, starterPackageIds, `${label} route receipt assistants`);
  } else {
    assertStringArrayIncludes(legacyPolicy.required_for_assistants, starterPackageIds, `${label} route receipt assistants`);
  }
  assertStringArrayIncludes(
    legacyPolicy.required_fields,
    ['route_kind', 'executor', 'assistant_id', 'assistant_short_name', 'source'],
    `${label} route receipt fields`,
  );
}
