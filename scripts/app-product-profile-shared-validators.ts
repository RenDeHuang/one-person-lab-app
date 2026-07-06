import { assertExpectedFields, assertStringArrayIncludes } from './value-assertions.ts';

type ProductProfileLike = {
  codex?: {
    default_model?: unknown;
    default_reasoning_effort?: unknown;
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
    builtin_assistant_route_receipt_policy?: Record<string, unknown>;
    agent_package_invocation_receipt_policy?: Record<string, unknown>;
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

export const starterPackageIds = ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'];
export const starterShortcutIds = ['research', 'grant', 'ppt', 'book'];
export const managedShortcutIds = [...starterShortcutIds, 'oma'];
export const managedShortcutPackageIds = [...starterPackageIds, 'opl-meta-agent'];
export const requiredSkillByPackageId = {
  'med-autoscience': ['med-autoscience'],
  'med-autogrant': ['med-autogrant'],
  'redcube-ai': ['redcube-ai'],
  'opl-bookforge': ['opl-bookforge'],
  'opl-meta-agent': ['opl-meta-agent'],
};
export const requiredSkillByAssistantId = {
  'med-autoscience': 'med-autoscience',
  'med-autogrant': 'med-autogrant',
  'redcube-ai': 'redcube-ai',
  'opl-bookforge': 'opl-bookforge',
};
export const codexEntryByPackageId = {
  'med-autoscience': 'med-autoscience',
  'med-autogrant': 'med-autogrant',
  'redcube-ai': 'redcube-ai',
  'opl-bookforge': 'opl-bookforge',
  'opl-meta-agent': 'opl-meta-agent',
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

type GuiLike = NonNullable<ProductProfileLike['gui']>;
type HomeLike = GuiLike['home'];
type CodexModelDisplayOptionsLike = NonNullable<NonNullable<HomeLike>['codex_model_display_options']>;
type ProfessionalAgentPackageLike = {
  package_id: string;
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
type OplFlowIntelligenceEnhancementModeLike = Record<string, unknown> | undefined;

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
    managedShortcutPackageIds,
    `${label} professional agent packages`,
  );
  for (const entry of entries) {
    const requiredSkills = requiredSkillByPackageId[entry.package_id as keyof typeof requiredSkillByPackageId];
    const codexEntry = codexEntryByPackageId[entry.package_id as keyof typeof codexEntryByPackageId];
    if (!requiredSkills || !codexEntry) {
      throw new Error(`${label} professional agent package ${entry.package_id} is not in the App package allowlist`);
    }
    if (
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
      if (entry.package_kind !== 'starter_professional_agent_package' || entry.default_home_visible !== true || entry.home_shortcut_ids.length !== 1) {
        throw new Error(`${label} starter package ${entry.package_id} must be default home visible through one shortcut`);
      }
    }
    if (entry.package_id === 'opl-meta-agent' && (
      entry.package_kind !== 'managed_professional_agent_package' ||
      entry.default_home_visible !== false ||
      JSON.stringify(entry.home_shortcut_ids) !== JSON.stringify(['oma'])
    )) {
      throw new Error(`${label} must keep OMA installed/manageable, hidden by default, and configurable from Home shortcuts`);
    }
  }
}

export function assertOplFlowIntelligenceEnhancementMode(
  mode: OplFlowIntelligenceEnhancementModeLike,
  label: string,
): void {
  if (
    mode?.id !== 'intelligence_enhancement' ||
    mode.settings_key !== 'codex.oplFlowIntelligenceEnhancementMode' ||
    mode.label_key !== 'settings.oplFlowIntelligenceEnhancementMode' ||
    mode.description_key !== 'settings.oplFlowIntelligenceEnhancementModeDesc' ||
    mode.provider !== 'codexcont' ||
    mode.local_proxy_base_url !== 'http://127.0.0.1:8787/v1' ||
    mode.upstream_policy !== 'preserve_current_codex_provider_via_local_responses_proxy' ||
    mode.behavior_policy !== 'local_proxy_reasoning_continuation_no_prompt_injection_no_quick_action' ||
    mode.service_policy !== 'opl_flow_managed_persistent_service_macos_launch_agent_linux_systemd_user_docker_startup_repair' ||
    mode.status_action_id !== 'intelligence_enhancement_status' ||
    mode.enable_action_id !== 'intelligence_enhancement_enable' ||
    mode.disable_action_id !== 'intelligence_enhancement_disable' ||
    mode.repair_action_id !== 'intelligence_enhancement_repair' ||
    mode.uninstall_action_id !== 'intelligence_enhancement_uninstall'
  ) {
    throw new Error(`${label} must declare the OPL Flow intelligence enhancement mode`);
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
  assertHomeCodexAutoSelectionPolicy(home, label, options);
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
      { actual: home?.permission_mode_selector_visible, expected: false },
      { actual: home?.conversation_backend_selector_visible, expected: false },
      { actual: home?.conversation_model_selector_visible, expected: true },
      { actual: home?.conversation_permission_mode_selector_visible, expected: false },
      { actual: home?.codex_home_model_status_label, expected: 'GPT-5.5' },
      { actual: home?.codex_precise_model_display_policy, expected: 'friendly_model_primary_reasoning_configurable_in_model_menu' },
    ],
    `${label} GUI home must keep Codex CLI fixed while exposing App-owned model selectors`,
  );
}

function assertHomeCodexEnglishStatusLabel(
  home: HomeLike,
  label: string,
  options: HomePolicyOptions,
): void {
  if (options.requireEnglishStatusLabel && home?.codex_home_model_status_label_en !== 'GPT-5.5') {
    throw new Error(`${label} GUI home must expose the English GPT-5.5 status label without repeated reasoning`);
  }
}

function assertHomeCodexAutoSelectionPolicy(
  home: HomeLike,
  label: string,
  options: HomePolicyOptions,
): void {
  const autoSelection = home?.codex_auto_model_selection;
  assertExpectedFields(
    [
      { actual: autoSelection?.strategy, expected: 'codex_cli_auto_latest_available_frontier' },
      { actual: autoSelection?.model_list_source, expected: 'codex_cli_handshake_available_models' },
      {
        actual: autoSelection?.frontier_model_preference_order_role,
        expected: 'fallback_when_codex_cli_model_list_unavailable',
      },
      { actual: autoSelection?.user_can_override_model, expected: true },
      { actual: autoSelection?.user_can_override_reasoning_effort, expected: true },
      { actual: autoSelection?.user_can_restore_auto, expected: true },
    ],
    `${label} GUI home must expose App-owned Codex model selection on the home path`,
  );
  if (options.requireSelectionPersistence && autoSelection?.selection_persists_into_conversation !== true) {
    throw new Error(`${label} GUI home Codex model selection must persist into conversation`);
  }
}

export function assertAppProductProfileCodexModelDisplayOptions(
  profile: ProductProfileLike,
  label = 'App product profile',
  options: ModelDisplayOptions = {},
): void {
  const displayOptions = profile.gui?.home?.codex_model_display_options;
  const frontierOrder = profile.gui?.home?.codex_auto_model_selection?.frontier_model_preference_order;
  assertCodexModelDisplayShape(profile, displayOptions, frontierOrder, label);
  assertCodexAutoModelOptionDescription(displayOptions?.auto_option, label, options);
  assertVisibleCodexModelsUseFriendlyDefaults(displayOptions?.visible_models ?? [], profile, label);
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
      { actual: displayOptions?.display_policy, expected: 'friendly_model_name_primary_reasoning_configurable_in_model_menu' },
      {
        actual: displayOptions?.button_label_policy,
        expected: 'auto_or_fixed_model_compact_label_with_selected_reasoning_effort',
      },
      { actual: displayOptions?.raw_model_id_visible_in_ordinary_ui, expected: false },
      { actual: displayOptions?.reasoning_effort_visible_for_every_option, expected: false },
      { actual: displayOptions?.reasoning_effort_menu_visible, expected: true },
      { actual: displayOptions?.reasoning_menu_title_zh, expected: '推理' },
      { actual: displayOptions?.reasoning_menu_title_en, expected: 'Reasoning' },
      { actual: displayOptions?.reasoning_effort_override_surface, expected: 'model_configuration_menu' },
      { actual: displayOptions?.reasoning_effort_options_source, expected: 'acp_codex_config_options_enum' },
      { actual: displayOptions?.default_reasoning_effort, expected: profile.codex?.default_reasoning_effort },
      { actual: displayOptions?.auto_option_current_resolution_visible, expected: true },
      { actual: displayOptions?.model_menu_policy, expected: 'last_submenu_collapsed_by_default' },
      { actual: auto?.label_zh, expected: '自动（推荐）' },
      { actual: auto?.label_en, expected: 'Auto (recommended)' },
      { actual: auto?.resolved_model, expected: profile.codex?.default_model },
      { actual: auto?.resolved_reasoning_effort, expected: profile.codex?.default_reasoning_effort },
      { actual: auto?.follows_latest_strongest, expected: true },
      { actual: displayOptions?.fixed_model_description_zh, expected: '固定此模型' },
      { actual: displayOptions?.fixed_model_description_en, expected: 'Use this model' },
      { actual: JSON.stringify(visibleModels.map((model) => model.id)), expected: JSON.stringify(frontierOrder) },
    ],
    `${label} GUI home must expose friendly Codex model display options with reasoning labels`,
  );
  assertReasoningOptions(displayOptions, profile, label);
  assertNoPreGpt54VisibleModels(visibleModels, label);
}

function assertReasoningOptions(
  displayOptions: CodexModelDisplayOptionsLike | undefined,
  profile: ProductProfileLike,
  label: string,
): void {
  const expectedOptions = ['low', 'medium', 'high', 'xhigh'];
  const options = displayOptions?.user_reasoning_effort_options;
  if (JSON.stringify(options) !== JSON.stringify(expectedOptions)) {
    throw new Error(`${label} Codex reasoning effort options must be ${JSON.stringify(expectedOptions)}`);
  }
  if (profile.codex?.default_reasoning_effort !== 'xhigh') {
    throw new Error(`${label} Codex default reasoning effort must be xhigh`);
  }
  for (const effort of expectedOptions) {
    const labels = displayOptions?.reasoning_labels?.[effort];
    if (typeof labels?.zh !== 'string' || !labels.zh.trim() || typeof labels?.en !== 'string' || !labels.en.trim()) {
      throw new Error(`${label} Codex reasoning effort option ${effort} must have friendly labels`);
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
      !auto!.description_zh.includes('推理超高') ||
      typeof auto!.description_en !== 'string' ||
      !auto!.description_en.includes('Ultra reasoning')
    )
  ) {
    throw new Error(`${label} Codex auto model option must describe latest strongest default reasoning`);
  }
}

function assertVisibleCodexModelsUseFriendlyDefaults(
  visibleModels: NonNullable<CodexModelDisplayOptionsLike['visible_models']>,
  profile: ProductProfileLike,
  label: string,
): void {
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

function assertNoPreGpt54VisibleModels(
  visibleModels: NonNullable<CodexModelDisplayOptionsLike['visible_models']>,
  label: string,
): void {
  const forbidden = new Set(['gpt-5.3-codex', 'gpt-5.2', 'gpt-5.2-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini']);
  for (const model of visibleModels) {
    if (typeof model.id === 'string' && forbidden.has(model.id)) {
      throw new Error(`${label} GUI home must not expose pre-GPT-5.4 model ${model.id} as an ordinary visible model`);
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
