import { assertStringArrayIncludes } from './string-array-assertions.ts';

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

function assertExactStringArray(actual: unknown, expected: string[], label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}`);
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
  if (
    home?.primary_input_surface !== 'single_card' ||
    home?.nested_input_card_frames_allowed !== false ||
    home?.codex_cli_fixed_executor !== true ||
    home?.home_executor_selector_visible !== false ||
    home?.codex_model_selector_visible !== true ||
    home?.codex_model_list_visible !== true ||
    home?.codex_model_policy !== 'codex_cli_latest_strongest_model_selector_visible' ||
    home?.codex_model_auto_option_visible !== true ||
    home?.codex_default_model !== profile.codex?.default_model ||
    home?.codex_default_reasoning_effort !== profile.codex?.default_reasoning_effort ||
    home?.codex_default_permission_mode !== 'full-access' ||
    home?.permission_mode_selector_visible !== false ||
    home?.conversation_backend_selector_visible !== false ||
    home?.conversation_model_selector_visible !== true ||
    home?.conversation_permission_mode_selector_visible !== false ||
    home?.codex_home_model_status_label !== 'GPT-5.5（超高）' ||
    home?.codex_precise_model_display_policy !== 'friendly_default_model_and_reasoning_visible'
  ) {
    throw new Error(`${label} GUI home must keep Codex CLI fixed while exposing App-owned model selectors`);
  }
  if (options.requireEnglishStatusLabel && home?.codex_home_model_status_label_en !== 'GPT-5.5 (Ultra)') {
    throw new Error(`${label} GUI home must expose the English GPT-5.5 ultra status label`);
  }

  const autoSelection = home.codex_auto_model_selection;
  if (
    autoSelection?.strategy !== 'codex_cli_auto_latest_available_frontier' ||
    autoSelection.user_can_override_model !== true ||
    autoSelection.user_can_restore_auto !== true
  ) {
    throw new Error(`${label} GUI home must expose App-owned Codex model selection on the home path`);
  }
  if (options.requireSelectionPersistence && autoSelection.selection_persists_into_conversation !== true) {
    throw new Error(`${label} GUI home Codex model selection must persist into conversation`);
  }
}

export function assertAppProductProfileCodexModelDisplayOptions(
  profile: ProductProfileLike,
  label = 'App product profile',
  options: ModelDisplayOptions = {},
): void {
  const displayOptions = profile.gui?.home?.codex_model_display_options;
  const auto = displayOptions?.auto_option;
  const visibleModels = displayOptions?.visible_models ?? [];
  const frontierOrder = profile.gui?.home?.codex_auto_model_selection?.frontier_model_preference_order;
  if (
    displayOptions?.display_policy !== 'friendly_model_name_and_reasoning_for_every_visible_option' ||
    displayOptions.raw_model_id_visible_in_ordinary_ui !== false ||
    displayOptions.reasoning_effort_visible_for_every_option !== true ||
    displayOptions.default_reasoning_effort !== profile.codex?.default_reasoning_effort ||
    auto?.label_zh !== '自动（推荐）' ||
    auto?.label_en !== 'Auto (recommended)' ||
    auto?.resolved_model !== profile.codex?.default_model ||
    auto?.resolved_reasoning_effort !== profile.codex?.default_reasoning_effort ||
    auto?.follows_latest_strongest !== true ||
    displayOptions.fixed_model_description_zh !== '固定此模型' ||
    displayOptions.fixed_model_description_en !== 'Use this model' ||
    displayOptions.reasoning_labels?.xhigh?.zh !== '推理超高' ||
    displayOptions.reasoning_labels?.xhigh?.en !== 'Ultra reasoning' ||
    JSON.stringify(visibleModels.map((model) => model.id)) !== JSON.stringify(frontierOrder)
  ) {
    throw new Error(`${label} GUI home must expose friendly Codex model display options with reasoning labels`);
  }
  if (
    options.requireAutoIdAndDescriptions &&
    (
      auto.id !== '__auto' ||
      typeof auto.description_zh !== 'string' ||
      !auto.description_zh.includes('推理超高') ||
      typeof auto.description_en !== 'string' ||
      !auto.description_en.includes('Ultra reasoning')
    )
  ) {
    throw new Error(`${label} Codex auto model option must describe latest strongest default reasoning`);
  }
  for (const model of visibleModels) {
    if (
      typeof model.label_zh !== 'string' ||
      typeof model.label_en !== 'string' ||
      model.label_zh === model.id ||
      model.label_en === model.id ||
      model.reasoning_effort !== profile.codex?.default_reasoning_effort
    ) {
      throw new Error(`${label} GUI home Codex model ${model.id} must use friendly labels and default reasoning`);
    }
  }
}

export function assertAppProductProfileRouteReceiptPolicy(
  profile: ProductProfileLike,
  label = 'App product profile',
  options: RouteReceiptOptions = {},
): void {
  const policy = profile.gui?.builtin_assistant_route_receipt_policy;
  if (
    policy?.scope !== 'home_purpose_entry_to_conversation' ||
    policy.route_kind !== 'builtin_capability' ||
    policy.executor !== 'codex_cli' ||
    policy.source !== 'opl_app_home' ||
    policy.must_not_depend_on_visible_backend_selection !== true
  ) {
    throw new Error(`${label} must require built-in assistant Codex CLI route receipts`);
  }
  if (options.requireExactAssistants) {
    assertExactStringArray(policy.required_for_assistants, ['mas', 'mag', 'rca'], `${label} route receipt assistants`);
  } else {
    assertStringArrayIncludes(policy.required_for_assistants, ['mas', 'mag', 'rca'], `${label} route receipt assistants`);
  }
  assertStringArrayIncludes(
    policy.required_fields,
    ['route_kind', 'executor', 'assistant_id', 'assistant_short_name', 'source'],
    `${label} route receipt fields`,
  );
}
