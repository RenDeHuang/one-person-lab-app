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
  'GuidModelSelector',
  'selectedAgentLabelOverride',
  'onClear={() =>',
  'fileContextEnabled={!fileAccessBlocked && Boolean(guidInput.dir)}',
  'useCoreLaunchPrerequisites',
  'GuidSetupNotice',
];

const guidHomeSelectionForbidden = ['AssistantSelectionArea', 'MentionSelectorBadge'];

export function assertCurrentGuidHomeSelectionSources({
  guidPage,
  homeStarters,
  capabilitiesPage,
}: {
  guidPage: string;
  homeStarters: string;
  capabilitiesPage: string;
}): void {
  assertTextIncludesAll(
    guidPage,
    [
      'HomeStarters',
      'activeCapabilityId={activeShortcut?.package_id}',
      'handleSelectShortcut(assistantId)',
      'onSelect={(assistantId) =>',
      'onClear={() =>',
    ],
    'Active shell Guid Home starter selection',
  );
  assertTextIncludesAll(
    homeStarters,
    [
      "data-testid='opl-home-starters'",
      'aria-pressed={active}',
      'active && onClear ? onClear() : onSelect(assistant.id)',
    ],
    'Active shell Guid Home starter component',
  );
  assertTextIncludesAll(
    capabilitiesPage,
    [
      'useCustomAgentsLoader',
      "navigate('/guid', {",
      'state: { selectedCapabilityId: capability.id }',
    ],
    'Active shell Capabilities selection route',
  );
  assertTextExcludesAll(guidPage, guidHomeSelectionForbidden, 'Active shell retired Guid selector surfaces');
}

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
  '"configured_default": {',
  '"codex_cli_fixed_executor": true',
  '"home_executor_selector_visible": false',
  '"codex_model_selector_visible": true',
  '"codex_model_list_visible": true',
  '"codex_model_policy": "codex_cli_latest_strongest_model_selector_visible"',
  '"codex_model_auto_option_visible": true',
  '"codex_home_model_status_label": "5.6 Sol"',
  '"codex_precise_model_display_policy": "friendly_model_primary_reasoning_primary_model_secondary_menu"',
  '"button_label_policy": "resolved_model_compact_label_with_selected_reasoning_effort_no_auto_prefix"',
  '"policy_source_ref": "contracts/app-product-profile.json#codex.auto_model_policy"',
  '"model_catalog_source": "codex_cli_model_list"',
  '"catalog_response_models_field": "data"',
  '"catalog_default_model_field": "isDefault"',
  '"catalog_supported_reasoning_efforts_field": "supportedReasoningEfforts"',
  '"catalog_supported_reasoning_effort_option_value_field": "reasoningEffort"',
  '"catalog_pagination_request_cursor_field": "cursor"',
  '"catalog_pagination_response_cursor_field": "nextCursor"',
  '"catalog_pagination_completion_policy": "exhaust_pages_until_next_cursor_is_null"',
  '"catalog_hidden_model_policy": "exclude_hidden_models_from_auto_and_fixed_options"',
  '"frontier_model_preference_order_role": "known_model_fallback_and_fixed_option_preference_not_allowlist"',
  '"unknown_default_model_policy": "accept_catalog_default_even_when_not_in_frontier_model_preference_order"',
  '"unknown_model_reasoning_effort_policy": "highest_supported_reasoning_effort_from_catalog"',
  '"auto": "persist_auto_mode_only_resolve_model_and_reasoning_from_fresh_catalog"',
  '"fixed": "persist_selected_model_and_reasoning_effort"',
  '"reasoning_override_from_auto": "pin_current_resolved_model_and_exit_auto"',
  '"user_can_override_model": true',
  '"user_can_restore_auto": true',
  '"display_policy": "friendly_model_name_primary_reasoning_primary_model_secondary_menu"',
  '"raw_model_id_visible_in_ordinary_ui": false',
  '"reasoning_effort_visible_for_every_option": false',
  '"reasoning_effort_menu_visible": true',
  '"model_menu_policy": "current_model_secondary_submenu"',
  '"reasoning_effort_options_source": "acp_codex_config_options_enum"',
  '"label_zh": "自动（推荐）"',
  '"description_zh": "跟随 Codex CLI 当前默认模型与 App 推理策略"',
  '"zh": "推理超高"',
  '"en": "Extra high reasoning"',
  '"zh": "推理极高"',
  '"en": "Ultra reasoning"',
  '"label_zh": "5.6 Sol"',
  '"label_zh": "5.6 Terra"',
  '"label_zh": "5.6 Luna"',
  '"label_zh": "5.5"',
  '"label_zh": "5.4"',
  '"label_zh": "5.4 Mini"',
  '"label_zh": "5.2"',
  '"assistant_skill_profiles"',
  '"required_skills"',
  '"skill_menu_policy": "assistant_scoped_required_checked_optional_visible"',
  '"default_packaged_codex_skill_ids"',
];

const codexModelsExpected = [
  'getOplCodexAutoModelPolicy',
  'resolveOplCodexAutoSelection',
  'frontier_model_preference_order',
  'unknown_default_model_policy',
  'known_model_reasoning_effort_overrides',
  'catalog_unavailable_fallback',
  'model.hidden === true',
  'DEFAULT_CODEX_MODELS',
  'handshakeModels == null',
  'normalizeCodexModelInfo(handshakeModels)',
  'normalized?.available_models',
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
  'shouldShowOplConversationModelSelector',
  'shouldShowOplConversationPermissionModeSelector',
  "backend === 'codex'",
  'const showConversationModelSelector',
  'const showModeSelector',
  "data-testid='acp-sendbox-decision-controls'",
  '<AcpModelSelector conversation_id={conversation_id} backend={backend} waitForWarmup />',
  '(showConversationModelSelector || showModeSelector) ?',
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
  const homeStarters = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/HomeStarters.tsx');
  const capabilitiesPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/CapabilitiesPage.tsx');
  assertCurrentGuidHomeSelectionSources({ guidPage, homeStarters, capabilitiesPage });
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
      'assistantRuntimeKey',
      'const runtimeKey = assistantRuntimeKey(assistant) || getOplDefaultExecutorAgentKey()',
      "agent_type: assistant.agent?.type || 'acp'",
      'backend: runtimeKey',
      'useState<string>(CODEX_MODE_NATIVE_FULL_ACCESS)',
    ],
    'Active shell Guid agent selection App-owned default',
  );
}

function assertProductProfileFrontierModelPreferenceOrder(productProfileJson) {
  const actual = productProfileJson?.codex?.auto_model_policy?.frontier_model_preference_order;
  const expected = [
    'gpt-5.6-sol',
    'gpt-5.6-terra',
    'gpt-5.6-luna',
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.2',
  ];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Active shell product profile must carry App Codex known frontier_model_preference_order=${JSON.stringify(expected)}`,
    );
  }
}

function validateProductProfileDefaults(shellPaths) {
  const productProfilePath = 'packages/desktop/src/common/config/oplProductProfile/oplProductProfile.generated.json';
  const productProfile = readShellText(shellPaths, productProfilePath);
  const productProfileJson = readShellJson(shellPaths, productProfilePath, 'product profile');
  const professionalAgentIds = productProfileJson?.gui?.professional_agent_packages
    ?.map((entry: { package_id?: unknown }) => entry.package_id);
  if (JSON.stringify(professionalAgentIds) !== JSON.stringify(['mas', 'mag', 'rca', 'obf', 'oma'])) {
    throw new Error('Active shell product profile must carry the five canonical professional Agent package ids');
  }
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
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts', ['activeShortcut', 'buildOplShortcutRouteReceipt', 'buildOplShortcutInvocationReceipt', 'opl_assistant_route', 'preset_enabled_skills'], 'Active shell Guid send App shortcut route/skill signal');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/activeShortcut.ts', ['OplActiveShortcut', 'resolveOplActiveShortcut', 'required_skill_ids', 'buildOplShortcutInvocationReceipt'], 'Active shell Guid shortcut identity and receipt signal');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/common/utils/buildAgentConversationParams.ts', ['preset_enabled_skills'], 'Active shell create conversation App assistant route/skill signal');
}

function validateGuidAssistantsAndSkills(shellPaths, guidPage) {
  validateGuidAssistantRegistry(shellPaths);
  validateGuidSkillRules(shellPaths, guidPage);
}

function validateCodexModelControls(shellPaths) {
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/composerSurface.ts', ['resolveOplHomeComposerSurface', "executor: 'codex'", 'model_reasoning_visible', 'permission_access_visible', 'executor_selector_visible: false'], 'Active shell Home composer fixed Codex decision surface');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx', ['useAcpModelInfo', 'canSwitch', 'if (!canSwitch)', 'selectAutoModel()', 'onClick={handleAutoSelect}'], 'Active shell ACP model selector fixed Codex model guard');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/hooks/agent/useAcpModelInfo.ts', ['isOplCodexCliFixedExecutor', 'shouldShowOplCodexModelList', "backend === 'codex'", 'shouldShowOplCodexModelList()', "backend === 'codex' ? normalizeCodexModelInfo(nextModelInfo) : nextModelInfo", 'reportedCodexCurrentModelIdRef', 'reportedCodexCurrentModelIdRef.current ?? model_info.current_model_id', 'updateModelInfo(info)', 'updateModelInfo(incoming)', 'updateModelInfo(confirmedModelInfo)', 'selectAutoModel', 'selectReasoningEffort', 'savePreferredCodexSelection(backend, null, null)', 'savePreferredCodexSelection(backend, currentModelId, value)', 'canSwitch'], 'Active shell ACP model hook App-owned Codex model controls');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/utils/model/oplCodexModelDisplay.ts', ['resolveOplCodexAutoSelection'], 'Active shell Codex Auto option resolved target display');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx', ['useAcpModelInfo', 'selectAutoModel', 'handleSheetAutoSelect', 'onClick: handleSheetAutoSelect'], 'Active shell mobile ACP model selector shared Auto resolver');
}

function validateCodexConversationSurfaces(shellPaths) {
  const chatConversation = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx',
  );
  assertTextExcludesAll(
    chatConversation,
    ['shouldShowOplConversationModelSelector', 'AcpModelSelector'],
    'Active shell ordinary Codex conversation duplicate header model selector',
  );
  const acpSendBox = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx',
    acpSendBoxExpected,
    'Active shell ordinary Codex conversation composer model and permission selectors',
  );
  assertTextExcludesAll(acpSendBox, ['getOplModelStatusDisplayText', "data-testid='opl-conversation-model-status'"], 'Active shell ordinary Codex conversation duplicate model status pill');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/conversation/platforms/acp/useAcpInitialMessage.ts', ["import { warmupConversation } from '../../utils/warmupConversation'", 'await warmupConversation(conversation_id)', 'ipcBridge.acpConversation.sendMessage.invoke'], 'Active shell ACP initial-message flow warm up before first send');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/components/chat/ThoughtDisplay.tsx', ['formatElapsedTime', "t('conversation.chat.processing')", 'elapsedTime'], 'Active shell ThoughtDisplay elapsed processing feedback');
}

function validateCodexConversationImplementation(shellPaths) {
  validateCodexModelControls(shellPaths);
  validateCodexConversationSurfaces(shellPaths);
}

function validateRuntimePageImplementation(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/SiderNav/SiderPrimaryNav.tsx',
    [
      "key: 'runtime'",
      "t('common.runtime.sidebarEntry')",
      "active: pathname.startsWith('/runtime')",
      'onClick: onRuntimeClick',
    ],
    'Active shell cross-project Runtime primary navigation entry',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/index.tsx',
    ["handlePrimaryNavigate = (path: '/runtime'", "onRuntimeClick={() => handlePrimaryNavigate('/runtime')}"],
    'Active shell cross-project Runtime navigation route',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Router.tsx',
    ["path='/runtime'", 'element={withRouteFallback(RuntimePage)}'],
    'Active shell cross-project Runtime page route',
  );
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
