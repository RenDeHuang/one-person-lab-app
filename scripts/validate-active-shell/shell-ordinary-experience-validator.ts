import {
  assertShellTextIncludesAll,
  assertTextDoesNotMatch,
  assertTextExcludesAll,
  assertTextIncludesAll,
  readShellJson,
  readShellText,
} from './shell-implementation-helpers.ts';

const guidHomeExpected = [
  "document.title = 'One Person Lab App'",
  "t('conversation.welcome.placeholder')",
  "t('guid.postInstallSelfCheck.prompt'",
  'POST_INSTALL_SELF_CHECK_PROMPT_DEFAULTS',
  'postInstallSelfCheckRequested',
  "navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null })",
  'AssistantSelectionArea',
  'GuidModelSelector',
  'MentionSelectorBadge',
  'selectedAgentLabelOverride',
  'onClear={() =>',
];

const guidLocaleExpected = {
  'zh-CN': ['安装后智能自检', '程序化初始化已经完成', 'OPL Flow 与用户已有工作区规则可以共存', 'MAS/MAG/RCA/OMA/OBF', '后台维护'],
  'en-US': ['Post-install intelligent self-check', 'Programmatic initialization has completed', "OPL Flow can coexist with the user's existing workspace rules", 'MAS/MAG/RCA/OMA/OBF', 'background maintenance'],
};

const guidHomeRuntimeForbidden = [
  "data-testid='opl-home-model-status'",
  'homeModelStatusRow',
  'homeModelStatus',
  "useOplAppState('fast')",
  'normalizeGuidActivityCenter',
  'activityCenter={activityCenter}',
  "data-testid='opl-continue-context-entry'",
  'guid.activity.continuationPrompt',
  'guid.activity.continueAction',
  'guid.activity.attentionCount',
  'guid.activity.activeCount',
  'activityCenter.hasItems',
  'QuickActionButtons',
];

const productProfileDefaultsExpected = [
  '"default_model": "gpt-5.5"',
  '"default_reasoning_effort": "xhigh"',
  '"codex_cli_fixed_executor": true',
  '"home_executor_selector_visible": false',
  '"codex_model_selector_visible": true',
  '"codex_model_list_visible": true',
  '"codex_model_policy": "codex_cli_latest_strongest_model_selector_visible"',
  '"codex_model_auto_option_visible": true',
  '"codex_default_model": "gpt-5.5"',
  '"codex_home_model_status_label": "GPT-5.5"',
  '"codex_precise_model_display_policy": "friendly_model_primary_reasoning_configurable_in_model_menu"',
  '"strategy": "codex_cli_auto_latest_available_frontier"',
  '"user_can_override_model": true',
  '"user_can_restore_auto": true',
  '"display_policy": "friendly_model_name_primary_reasoning_configurable_in_model_menu"',
  '"raw_model_id_visible_in_ordinary_ui": false',
  '"reasoning_effort_visible_for_every_option": false',
  '"reasoning_effort_menu_visible": true',
  '"reasoning_effort_options_source": "acp_codex_config_options_enum"',
  '"label_zh": "自动（推荐）"',
  '"description_zh": "当前 GPT-5.5 · 推理超高 · 跟随最新最强"',
  '"label_zh": "GPT-5.4"',
  '"id": "med-autoscience"',
  '"id": "med-autogrant"',
  '"id": "redcube-ai"',
  '"id": "opl-meta-agent"',
  '"assistant_skill_profiles"',
  '"required_skills"',
  '"skill_menu_policy": "assistant_scoped_required_checked_optional_visible"',
  '"default_packaged_codex_skill_ids"',
];

const codexModelsExpected = [
  'getOplCodexFrontierModelPreferenceOrder',
  'DEFAULT_CODEX_MODELS',
  'availableModels.length > 0',
  'DEFAULT_CODEX_MODELS.map',
  'available_models: visibleModels',
];

const guidAssistantsExpected = [
  'getOplDefaultExecutorAgentKey',
  'getOplDefaultHomeAssistants',
  'getOplAssistantSkillProfile',
  'resolveOplHomeAssistants',
  'const DEFAULT_PRESET_AGENT_TYPE = getOplDefaultExecutorAgentKey()',
  'preset_agent_type: DEFAULT_PRESET_AGENT_TYPE',
  'enabled_skills',
  'custom_skill_names',
  'disabled_builtin_skills',
];

const guidPageSkillExpected = [
  'selectedAssistantRequiredSkills',
  'selectedAssistantSkillProfile',
  'effectiveGuidEnabledSkills',
  'mergeRequiredSkills',
  'buildAssistantScopedSkillMenuItems',
  'guidEnabledSkills: effectiveGuidEnabledSkills',
];

const acpSendBoxExpected = [
  'isOplCodexCliFixedExecutor',
  'getOplModelStatusDisplayText',
  "data-testid='opl-conversation-model-status'",
  'shouldShowOplConversationPermissionModeSelector',
  "backend === 'codex'",
  'const showModeSelector',
  'showModeSelector ?',
  '<ThoughtDisplay running={isBusy}',
];

const runtimePageExpected = [
  'const userTaskDrilldown = appStateProjection',
  'const runtimeModel = useMemo(() => normalizeRuntimeProjection(appStateQuery.appState), [appStateQuery.appState])',
  'const runtimeScope = runtimeModel.scope',
  'buildOverviewSections(',
  'i18n.resolvedLanguage ?? i18n.language',
  "t('common.runtime.scopeSelector')",
  "t('common.runtime.primaryStates.inProgress')",
  'const [selectedSavedViewId',
  'const scopedTasks = tasks.filter((task) => scopeMatchesTask(task, scope) && !isModuleRuntimeTask(task))',
  'dedupeTaskItems(scopedTasks.map((task) => runtimeTaskItem(task, controlStates, t, language))).filter(',
  '(item) => savedViewMatchesItem(item, savedView)',
  'parseModuleStatusItems(',
  'overview.sections.flatMap((section) => section.tasks)',
  "t('common.runtime.moduleWorkloadText'",
  "data-testid={`runtime-module-status-${item.id}`}",
  'moduleStatusItems.map((item) =>',
];

const runtimePageForbidden = [
  '|| activity.activeExecutionCount',
  'fallbackRunningTasks',
  'runtimeActivityProjection',
  '|| project.activeRunId',
];

function validateGuidHomeImplementation(shellPaths) {
  const guidPage = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/GuidPage.tsx',
    guidHomeExpected,
    'Active shell Guid home',
  );
  const guidInputCard = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx');
  for (const [locale, expectedStrings] of Object.entries(guidLocaleExpected)) {
    const localeText = readShellText(shellPaths, `packages/desktop/src/renderer/services/i18n/locales/${locale}/guid.json`);
    assertTextIncludesAll(localeText, expectedStrings, `Active shell ${locale} Guid locale post-install self-check copy`);
  }
  assertTextExcludesAll(`${guidPage}\n${guidInputCard}`, guidHomeRuntimeForbidden, 'Active shell ordinary Home runtime activity');
  assertTextExcludesAll(guidInputCard, ["data-testid='guid-activity-center'", 'guid.activity.needsAttention', 'guid.activity.recentProjects'], 'Active shell ordinary Home expanded activity groups near input');
  assertTextExcludesAll(guidInputCard, ['artifact_body', 'memory_body', 'domain_artifact_body'], 'Active shell Guid composer domain artifact or memory bodies');
  return guidPage;
}

function validateGuidAgentSelection(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidAgentSelection.ts',
    [
      'getOplDefaultExecutorAgentKey',
      'resolveOplDefaultAgentKey(undefined)',
      "agent_type: assistant.preset_agent_type || getOplDefaultExecutorAgentKey()",
      'useState<string>(CODEX_MODE_NATIVE_FULL_ACCESS)',
    ],
    'Active shell Guid agent selection App-owned default',
  );
}

function assertProductProfileFrontierModelPreferenceOrder(productProfileJson) {
  const actual = productProfileJson?.gui?.home?.codex_auto_model_selection?.frontier_model_preference_order;
  const expected = ['gpt-5.5', 'gpt-5.4'];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Active shell product profile must carry App Codex default frontier_model_preference_order=${JSON.stringify(expected)}`,
    );
  }
}

function validateProductProfileDefaults(shellPaths) {
  const productProfilePath = 'packages/desktop/src/common/config/oplProductProfile/oplProductProfile.generated.json';
  const productProfile = readShellText(shellPaths, productProfilePath);
  const productProfileJson = readShellJson(shellPaths, productProfilePath, 'product profile');
  assertProductProfileFrontierModelPreferenceOrder(productProfileJson);
  assertTextIncludesAll(productProfile, productProfileDefaultsExpected, 'Active shell product profile App Codex default');
}

function validateGuidAssistantRegistry(shellPaths) {
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/common/types/codex/codexModels.ts', codexModelsExpected, 'Active shell Codex model policy App-owned default options before ACP handshake');
  const guidAssistants = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/utils/oplHomeAssistants.ts',
    guidAssistantsExpected,
    'Active shell Guid assistants App-owned assistant/default signal',
  );
  assertTextDoesNotMatch(guidAssistants, /mds|Med Deep Scientist/, 'Active shell Guid profile must not include MDS as a default home assistant.');
}

function validateGuidSkillRules(shellPaths, guidPage) {
  assertTextIncludesAll(guidPage, guidPageSkillExpected, 'Active shell Guid page App assistant skill profile rule');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/assistantSkillMenu.ts', ['buildAssistantScopedSkillMenuItems', 'mergeRequiredSkills', 'required_skills', 'locked: isRequired'], 'Active shell Guid skill menu App assistant skill profile rule');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx', ['GuidSkillMenuItem', 'isGuidSkillChecked', 'skill.locked', 'disabled={skill.locked}'], 'Active shell Guid action row required assistant skills');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts', ['getOplBuiltinAssistantRouteReceiptPolicy', 'buildOplAssistantRouteReceipt', 'opl_assistant_route', 'preset_enabled_skills'], 'Active shell Guid send App assistant route/skill signal');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/common/utils/buildAgentConversationParams.ts', ['preset_enabled_skills'], 'Active shell create conversation App assistant route/skill signal');
}

function validateGuidAssistantsAndSkills(shellPaths, guidPage) {
  validateGuidAssistantRegistry(shellPaths);
  validateGuidSkillRules(shellPaths, guidPage);
}

function validateCodexModelControls(shellPaths) {
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx', ['useAcpModelInfo', 'canSwitch', 'if (!canSwitch)'], 'Active shell ACP model selector fixed Codex model guard');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/hooks/agent/useAcpModelInfo.ts', ['isOplCodexCliFixedExecutor', 'shouldShowOplCodexModelList', "backend === 'codex'", 'shouldShowOplCodexModelList()', 'canSwitch'], 'Active shell ACP model hook App-owned Codex model controls');
}

function validateCodexConversationSurfaces(shellPaths) {
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx', ['shouldShowOplConversationModelSelector', "extra.backend === 'codex'", 'AcpModelSelector'], 'Active shell ordinary Codex conversation model selector');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx', acpSendBoxExpected, 'Active shell ordinary Codex conversation permission selector');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/conversation/platforms/acp/useAcpInitialMessage.ts', ["import { warmupConversation } from '../../utils/warmupConversation'", 'await warmupConversation(conversation_id)', 'ipcBridge.acpConversation.sendMessage.invoke'], 'Active shell ACP initial-message flow warm up before first send');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/components/chat/ThoughtDisplay.tsx', ['formatElapsedTime', "t('conversation.chat.processing')", 'elapsedTime'], 'Active shell ThoughtDisplay elapsed processing feedback');
}

function validateCodexConversationImplementation(shellPaths) {
  validateCodexModelControls(shellPaths);
  validateCodexConversationSurfaces(shellPaths);
}

function validateRuntimePageImplementation(shellPaths) {
  const runtimePage = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/index.tsx',
    runtimePageExpected,
    'Active shell Runtime page user-task-first grouped display',
  );
  assertTextExcludesAll(runtimePage, runtimePageForbidden, 'Active shell Runtime page provider/run fallbacks');
}

function validateSkillsHubImplementation(shellPaths) {
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/settings/SkillsHubSettings.tsx', [
    'getOplDefaultPackagedCodexSkills',
    'getOplPackagedCodexSkills',
    'appVisibleSkills',
    "skills.filter((skill) => skill.source !== 'builtin' || appVisibleSkills.has(skill.name))",
    'appPackagedSkills',
    'autoSkills.filter((skill) => appPackagedSkills.has(skill.name))',
  ], 'Active shell SkillsHubSettings App packaged policy');
}

export function validateShellOrdinaryExperienceImplementation(shellPaths) {
  const guidPage = validateGuidHomeImplementation(shellPaths);
  validateGuidAgentSelection(shellPaths);
  validateProductProfileDefaults(shellPaths);
  validateGuidAssistantsAndSkills(shellPaths, guidPage);
  validateCodexConversationImplementation(shellPaths);
  validateRuntimePageImplementation(shellPaths);
  validateSkillsHubImplementation(shellPaths);
}
