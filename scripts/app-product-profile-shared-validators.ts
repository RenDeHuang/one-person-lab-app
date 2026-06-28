import { assertExpectedFields } from './expected-field-assertions.ts';
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

type GuiLike = NonNullable<ProductProfileLike['gui']>;
type HomeLike = GuiLike['home'];
type CodexModelDisplayOptionsLike = NonNullable<NonNullable<HomeLike>['codex_model_display_options']>;

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
      { actual: home?.codex_home_model_status_label, expected: 'GPT-5.5（超高）' },
      { actual: home?.codex_precise_model_display_policy, expected: 'friendly_default_model_and_reasoning_visible' },
    ],
    `${label} GUI home must keep Codex CLI fixed while exposing App-owned model selectors`,
  );
}

function assertHomeCodexEnglishStatusLabel(
  home: HomeLike,
  label: string,
  options: HomePolicyOptions,
): void {
  if (options.requireEnglishStatusLabel && home?.codex_home_model_status_label_en !== 'GPT-5.5 (Ultra)') {
    throw new Error(`${label} GUI home must expose the English GPT-5.5 ultra status label`);
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
      { actual: autoSelection?.user_can_override_model, expected: true },
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
      { actual: displayOptions?.display_policy, expected: 'friendly_model_name_and_reasoning_for_every_visible_option' },
      { actual: displayOptions?.raw_model_id_visible_in_ordinary_ui, expected: false },
      { actual: displayOptions?.reasoning_effort_visible_for_every_option, expected: true },
      { actual: displayOptions?.default_reasoning_effort, expected: profile.codex?.default_reasoning_effort },
      { actual: auto?.label_zh, expected: '自动（推荐）' },
      { actual: auto?.label_en, expected: 'Auto (recommended)' },
      { actual: auto?.resolved_model, expected: profile.codex?.default_model },
      { actual: auto?.resolved_reasoning_effort, expected: profile.codex?.default_reasoning_effort },
      { actual: auto?.follows_latest_strongest, expected: true },
      { actual: displayOptions?.fixed_model_description_zh, expected: '固定此模型' },
      { actual: displayOptions?.fixed_model_description_en, expected: 'Use this model' },
      { actual: displayOptions?.reasoning_labels?.high?.zh, expected: '推理高' },
      { actual: displayOptions?.reasoning_labels?.high?.en, expected: 'High reasoning' },
      { actual: displayOptions?.reasoning_labels?.xhigh?.zh, expected: '推理超高' },
      { actual: displayOptions?.reasoning_labels?.xhigh?.en, expected: 'Ultra reasoning' },
      {
        actual: JSON.stringify(displayOptions?.user_reasoning_effort_options),
        expected: JSON.stringify(['high', 'xhigh']),
      },
      { actual: JSON.stringify(visibleModels.map((model) => model.id)), expected: JSON.stringify(frontierOrder) },
    ],
    `${label} GUI home must expose friendly Codex model display options with reasoning labels`,
  );
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
    assertExactStringArray(policy.required_for_assistants, ['mas', 'mag', 'rca', 'bookforge'], `${label} route receipt assistants`);
  } else {
    assertStringArrayIncludes(policy.required_for_assistants, ['mas', 'mag', 'rca', 'bookforge'], `${label} route receipt assistants`);
  }
  assertStringArrayIncludes(
    policy.required_fields,
    ['route_kind', 'executor', 'assistant_id', 'assistant_short_name', 'source'],
    `${label} route receipt fields`,
  );
}
