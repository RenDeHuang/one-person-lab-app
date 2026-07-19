import { existsSync } from 'node:fs';
import path from 'node:path';
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
  'const workspaceAccessBlocked = coreReadiness.known && !coreReadiness.workspaceRootReady;',
  'workspaceAccessDisabled={workspaceAccessBlocked}',
  'const guidInput = useGuidInput({',
  'onFilesUploaded={guidInput.handleFilesUploaded}',
  'onPaste={guidInput.onPaste}',
  'dragHandlers={guidInput.dragHandlers}',
  'useCoreLaunchPrerequisites',
  'GuidSetupNotice',
];

const guidHomeSelectionForbidden = ['AssistantSelectionArea', 'MentionSelectorBadge'];

export function assertCanonicalThreadAffinityConvergenceSources({
  canonicalThreadLifecycle,
  conversationListSync,
  focusedTests,
  threadAdapter,
}: {
  canonicalThreadLifecycle: string;
  conversationListSync: string;
  focusedTests: string;
  threadAdapter: string;
}): void {
  for (const [label, source] of [
    ['canonical thread lifecycle', canonicalThreadLifecycle],
    ['canonical directory merge', conversationListSync],
  ] as const) {
    assertTextIncludesAll(
      source,
      [
        'const hasCanonicalRecordedCwd = Boolean(thread.workspace.trim())',
        'workspace: thread.workspace',
        'custom_workspace: hasCanonicalRecordedCwd',
      ],
      `Active shell ${label} cwd projection`,
    );
    assertTextExcludesAll(
      source,
      [
        'cached?.extra.custom_workspace === false ? false : hasCanonicalRecordedCwd',
        'cached?.extra.custom_workspace === true',
        'workspace: projectAffinityWorkspace',
        'custom_workspace: customWorkspace',
      ],
      `Active shell ${label} cache authority boundary`,
    );
  }
  assertTextIncludesAll(
    threadAdapter,
    [
      'function recordedCwd(value: unknown): string',
      "if (value === undefined || value === null) return ''",
      "if (typeof value !== 'string') throw new Error('Invalid Codex app-server thread cwd.')",
      'workspace: recordedCwd(raw.cwd)',
    ],
    'Active shell canonical cwd parser fail-closed boundary',
  );
  assertTextExcludesAll(
    threadAdapter,
    ["workspace: optionalString(raw.cwd) ?? ''"],
    'Active shell canonical cwd parser must not treat malformed values as projectless',
  );
  assertTextIncludesAll(
    focusedTests,
    [
      'rebuilds a stale projectless cache row from the canonical recorded cwd',
      'replaces stale bound shell affinity with the canonical recorded cwd',
      'keeps canonical adoption successful when the rebuildable local projection update fails',
      'keeps canonical adoption successful when a stub projection cannot be materialized',
      'requires an exact canonical cwd readback instead of path-normalized equivalence',
      'rejects malformed canonical cwd instead of treating it as projectless',
      'rejects a malformed cwd returned by canonical thread read',
    ],
    'Active shell canonical cwd convergence focused regressions',
  );
}

export function assertProjectlessGuidFileAccessSources(guidPage: string): void {
  assertTextIncludesAll(
    guidPage,
    [
      'const workspaceAccessBlocked = coreReadiness.known && !coreReadiness.workspaceRootReady;',
      'workspaceAccessDisabled={workspaceAccessBlocked}',
      'const guidInput = useGuidInput({',
      'locationState: navState',
      'onFilesUploaded={guidInput.handleFilesUploaded}',
      'onPaste={guidInput.onPaste}',
      'dragHandlers={guidInput.dragHandlers}',
      "name: 'open'",
    ],
    'Active shell explicit session file access',
  );

  const assignments = Array.from(
    guidPage.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g),
    (match) => ({ name: match[1], expression: match[2] }),
  );
  const workspaceDerivedIdentifiers = new Set<string>();
  const hasWorkspaceSource = (expression: string): boolean =>
    /\bworkspaceRootReady\b|\bworkspaceAccessBlocked\b|\bguidInput\.dir\b|\blocationState\??\.workspace\b/.test(
      expression,
    ) ||
    Array.from(workspaceDerivedIdentifiers).some((identifier) =>
      new RegExp(`\\b${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(expression),
    );

  let discoveredWorkspaceAlias = true;
  while (discoveredWorkspaceAlias) {
    discoveredWorkspaceAlias = false;
    for (const assignment of assignments) {
      if (!workspaceDerivedIdentifiers.has(assignment.name) && hasWorkspaceSource(assignment.expression)) {
        workspaceDerivedIdentifiers.add(assignment.name);
        discoveredWorkspaceAlias = true;
      }
    }
  }

  const fileGateName = /(?:files?|attachments?|paste|drop).*(?:access|enabled?|disabled?|blocked?|allowed?|available)|(?:access|enabled?|disabled?|blocked?|allowed?|available).*(?:files?|attachments?|paste|drop)/i;
  const workspaceDerivedFileGate = assignments.find(
    (assignment) => fileGateName.test(assignment.name) && hasWorkspaceSource(assignment.expression),
  );
  if (workspaceDerivedFileGate) {
    throw new Error(
      `Active shell explicit session input must not derive ${workspaceDerivedFileGate.name} from workspace readiness or membership`,
    );
  }

  const fileAccessExpressions = Array.from(
    guidPage.matchAll(/\b(?:fileAccessEnabled|fileAccessDisabled|fileContextEnabled)\s*(?::|=)\s*(?:\{([^}\n]*)\}|([^,\n]+))/g),
    (match) => (match[1] ?? match[2] ?? '').trim(),
  );
  if (fileAccessExpressions.some((expression) => hasWorkspaceSource(expression))) {
    throw new Error(
      'Active shell explicit session input file-access props must not depend on workspace readiness or membership',
    );
  }
}

export function assertCurrentGuidHomeSelectionSources({
  guidPage,
  guidInputCard,
  homeStarters,
  guidStyles,
  capabilitiesPage,
}: {
  guidPage: string;
  guidInputCard: string;
  homeStarters: string;
  guidStyles: string;
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
      'setActiveShortcut(resolveOplActiveShortcut(navState.selectedCapabilityId))',
      'agentSelection.setSelectedAgentKey(agentSelection.defaultAgentKey)',
    ],
    'Active shell Guid Home starter selection',
  );
  assertTextIncludesAll(
    homeStarters,
    [
      "data-testid='opl-home-starters'",
      'aria-pressed={active}',
      'data-opl-active={String(active)}',
      "const launchReady = launchGate.state !== 'package_unavailable'",
      'data-opl-launch-ready={String(launchReady)}',
      'active && styles.homeStarterActive',
      'starterIcon(assistant.id)',
      'active && onClear ? onClear() : onSelect(assistant.id)',
    ],
    'Active shell Guid Home starter component',
  );
  assertTextExcludesAll(
    homeStarters,
    [
      'FontAwesomeIcon',
      'CheckOne',
      "data-testid='starter-active-check'",
      'faChevronRight',
      "!border-primary-5 !bg-primary-1 !text-primary-6",
      '<Right',
      'disabled={launchBlocked}',
    ],
    'Active shell retired Guid Home starter styling',
  );
  assertTextIncludesAll(
    guidStyles,
    [
      '.guidComposerDock',
      'width: min(100%, 736px)',
      '.guidInputInner',
      'min-height: 98px',
      'border-radius: 22px',
      '.actionRow',
      'align-items: flex-end',
      'width: 100%',
      '.workspaceContextBar',
      'height: 52px',
      'margin: 0 12px -13px',
      'padding: 0 12px',
      '.homeStarterGrid',
      'display: flex',
      'flex-wrap: wrap',
      'justify-content: center',
      'width: auto !important',
      'height: 34px !important',
    ],
    'Active shell integrated Guid Home reading lane',
  );
  assertTextExcludesAll(
    guidStyles,
    ['grid-template-columns: repeat(4', 'grid-template-columns: repeat(5'],
    'Active shell fixed-count Guid Home starter layout',
  );
  assertTextIncludesAll(
    guidInputCard,
    [
      'const DESKTOP_TEXTAREA_AUTO_SIZE = { minRows: 1, maxRows: 12 }',
      'className={`${styles.guidInputInner} relative z-1 flex flex-col bg-dialog-fill-0`}',
      '!pl-5px',
    ],
    'Active shell compact Guid Home composer',
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
  '"default_active_shortcut": null',
  '"shortcut_selection_policy": "explicit_user_or_navigation_selection_only_no_saved_preset_restore_and_never_disabled_by_launch_readiness"',
  '"selected_starter_visual_policy": "quiet_fill_with_aria_pressed_without_trailing_selection_glyph"',
  '"selected_starter_accessibility_state": "aria_pressed_reflects_active_shortcut"',
  '"zh": "推理最高"',
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
  "placeholder={t('conversation.chat.oplPlaceholder')}",
];

const runtimePageExpected = [
  "const appStateQuery = useOplAppState('fast')",
  'readRuntimeWorkItemProjectionV2(appStateQuery.appState)',
  'const [selectedAgentId, setSelectedAgentId]',
  'const [selectedProjectId, setSelectedProjectId]',
  'const [selectedStatusView, setSelectedStatusView]',
  'projection.projects.filter((project) => project.agentId === selectedAgentId)',
  'scopedVisibleItems.filter((item) => matchesStatusView(item, selectedStatusView))',
  'i18n.resolvedLanguage ?? i18n.language',
  '<RuntimeScopeBar',
  '<RuntimeStatusBar',
  '<RuntimeWorkItemList',
  '<RuntimeDetailDrawer',
  "data-testid='runtime-v2-page'",
];

const runtimeProjectionExpected = [
  'workbench?.work_item_projection_v2',
  'const itemEnvelopeId = requiredString(value.item_id)',
  'const workItemId = requiredString(identity.work_item_id)',
  'const projectedPrimaryStatus = enumValue(lifecycle.primary_state, PRIMARY_STATUSES)',
  'const stageMap = parseStageMap(value.stage_map)',
  'const projectedAction = parseAction(value.action)',
  'const currentStageId = optionalString(execution.current_stage_id) ?? optionalString(lifecycle.current_stage_id)',
  'const nextStageId = optionalString(execution.next_stage_id)',
  'const attemptId = optionalString(execution.attempt_id)',
  'attemptId,',
  'id: itemEnvelopeId',
];

const runtimeStagePopoverExpected = [
  "data-testid='runtime-stage-popover'",
  "data-testid='runtime-stage-attempt'",
  "data-testid='runtime-stage-trigger'",
  'item.execution.attemptId',
  'item.stageMap.map',
  'event.stopPropagation()',
];

const runtimeFocusedTestsExpected = [
  'keeps platform maintenance actions and operator drilldown out of the project Runtime page',
  'opens a stage popup with the complete stage list and current attempt',
  'shows all nine visible items and keeps repeated work item ids distinct by canonical item id',
  'rejects an item envelope that does not match its canonical identity',
  'preserves projected stages and actions for the detail view',
  'never promotes a telemetry verification attempt to the business stage of a delivered item',
];

const runtimePageForbidden = [
  'normalizeRuntimeProjection',
  'dedupeTaskItems',
  'runtimeTaskItem(',
  'appStateToRuntimeProjection(',
  'compactCurrentControlState(',
  'controlStateFallbackForTask(',
  'record(controlState?.provider_run)',
  'getDrilldown.invoke',
  'RuntimeCockpitPanel',
  'AgentAvailability',
];

export function assertRuntimePageSourceBoundary(runtimePage: string): void {
  assertTextExcludesAll(runtimePage, runtimePageForbidden, 'Active shell Runtime page provider/run fallbacks');
}

function validateGuidHomeImplementation(shellPaths) {
  const guidPage = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/GuidPage.tsx',
    guidHomeExpected,
    'Active shell Guid home',
  );
  const guidInputCard = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx');
  const homeStarters = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/HomeStarters.tsx');
  const guidStyles = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/index.module.css');
  const capabilitiesPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/CapabilitiesPage.tsx');
  assertCurrentGuidHomeSelectionSources({ guidPage, guidInputCard, homeStarters, guidStyles, capabilitiesPage });
  assertProjectlessGuidFileAccessSources(guidPage);
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
      'preselectAgentKey && availableAgents.some((a) => getAgentKey(a) === preselectAgentKey)',
      'const savedAgent = availableAgents.find((agent) => getAgentKey(agent) === savedKey)',
      'if (savedAgent && !savedAgent.is_preset)',
      '_setSelectedAgentKey(getDefaultAgentKey(availableAgents))',
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
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx', ['GuidSkillMenuItem', 'isGuidSkillChecked', 'skill.locked', 'disabled: skill.locked'], 'Active shell Guid action row required assistant skills');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts', ['activeShortcut', 'buildOplShortcutRouteReceipt', 'buildOplShortcutInvocationReceipt', 'opl_assistant_route', 'preset_enabled_skills'], 'Active shell Guid send App shortcut route/skill signal');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/activeShortcut.ts', ['OplActiveShortcut', 'resolveOplActiveShortcut', 'required_skill_ids', 'buildOplShortcutInvocationReceipt'], 'Active shell Guid shortcut identity and receipt signal');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/common/utils/buildAgentConversationParams.ts', ['preset_enabled_skills'], 'Active shell create conversation App assistant route/skill signal');
}

function validateGuidAssistantsAndSkills(shellPaths, guidPage) {
  validateGuidAssistantRegistry(shellPaths);
  validateGuidSkillRules(shellPaths, guidPage);
}

function validateCodexModelControls(shellPaths) {
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/composerSurface.ts', ['getOplHomeComposerStateContract', 'resolveOplHomeComposerSurface', 'contract.executor', 'contract.invariants.model_reasoning_visible', 'contract.invariants.permission_access_visible', 'contract.invariants.executor_selector_visible'], 'Active shell Home composer App-contract decision surface');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx', ['useAcpModelInfo', 'canSwitch', 'if (!canSwitch)', 'selectAutoModel()', 'onClick={handleAutoSelect}'], 'Active shell ACP model selector fixed Codex model guard');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/hooks/agent/useAcpModelInfo.ts', ['isOplCodexCliFixedExecutor', 'shouldShowOplCodexModelList', "backend === 'codex'", 'shouldShowOplCodexModelList()', "backend === 'codex' ? normalizeCodexModelInfo(nextModelInfo) : nextModelInfo", 'reportedCodexCurrentModelIdRef', 'reportedCodexCurrentModelIdRef.current ?? model_info.current_model_id', 'updateModelInfo(info)', 'updateModelInfo(incoming)', 'updateModelInfo(confirmedModelInfo)', 'selectAutoModel', 'selectReasoningEffort', 'savePreferredCodexSelection(backend, null, null)', 'savePreferredCodexSelection(backend, currentModelId, value)', 'canSwitch'], 'Active shell ACP model hook App-owned Codex model controls');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/utils/model/oplCodexModelDisplay.ts', ['resolveOplCodexAutoSelection'], 'Active shell Codex Auto option resolved target display');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx', ['useAcpModelInfo', 'selectAutoModel', 'handleSheetAutoSelect', 'onClick: handleSheetAutoSelect'], 'Active shell mobile ACP model selector shared Auto resolver');
  const modelControls = [
    readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/GuidModelSelector.tsx'),
    readShellText(shellPaths, 'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx'),
  ].join('\n');
  assertTextDoesNotMatch(modelControls, /\bBrain\b/, 'Active shell ordinary model/reasoning controls must not render brain icons');
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/opl/OplRefreshIconButton.tsx',
    ["Refresh } from '@icon-park/react'", "theme='outline'", "fill='currentColor'", 'aria-label={label}', '<Tooltip content={label}>'],
    'Active shell OPL refresh icon button',
  );
  for (const settingsSurface of [
    'packages/desktop/src/renderer/pages/settings/sections/LocalServicesSettings.tsx',
    'packages/desktop/src/renderer/pages/settings/StorageSettings/index.tsx',
    'packages/desktop/src/renderer/pages/settings/CapabilitiesSettings.tsx',
    'packages/desktop/src/renderer/pages/settings/sections/AccessSettings.tsx',
    'packages/desktop/src/renderer/pages/settings/sections/RuntimeSettings.tsx',
  ]) {
    assertShellTextIncludesAll(shellPaths, settingsSurface, ['OplRefreshIconButton'], 'Active shell OPL icon-only refresh surface');
  }
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
  assertTextExcludesAll(
    acpSendBox,
    [
      'getOplModelStatusDisplayText',
      "data-testid='opl-conversation-model-status'",
      "t('acp.sendbox.placeholder'",
    ],
    'Active shell ordinary Codex conversation duplicate model status or backend-owned placeholder',
  );
  const aionrsSendBox = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/aionrs/AionrsSendBox.tsx',
    ["placeholder={t('conversation.chat.oplPlaceholder')}"],
    'Active shell ordinary AionRS conversation OPL-owned placeholder',
  );
  assertTextExcludesAll(
    aionrsSendBox,
    ["t('acp.sendbox.placeholder'"],
    'Active shell ordinary AionRS conversation backend-owned placeholder',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/services/i18n/locales/zh-CN/conversation.json',
    ['"oplPlaceholder": "向 One Person Lab 提问或安排任务..."'],
    'Active shell zh-CN OPL conversation placeholder',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/services/i18n/locales/en-US/conversation.json',
    ['"oplPlaceholder": "Ask One Person Lab anything..."'],
    'Active shell en-US OPL conversation placeholder',
  );
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/conversation/platforms/acp/useAcpInitialMessage.ts', ["import { warmupConversation } from '../../utils/warmupConversation'", 'await warmupConversation(conversation_id)', 'ipcBridge.acpConversation.sendMessage.invoke'], 'Active shell ACP initial-message flow warm up before first send');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/components/chat/ThoughtDisplay.tsx', ['formatElapsedTime', "t('conversation.chat.processing')", 'elapsedTime'], 'Active shell ThoughtDisplay elapsed processing feedback');
}

function validateSendFailureDraftPreservation(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/hooks/chat/useSendBoxDraft.ts',
    [
      'export const mergeFailedSendContent',
      'export const mergeFailedSendDraft',
      'currentContent.startsWith(`${failedContent}\\n\\n`)',
      'new Set([...failedFiles.filter(Boolean), ...currentDraft.uploadFile.filter(Boolean)])',
    ],
    'Active shell failed-send draft merge helper',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts',
    [
      'handleSend: () => Promise<boolean>',
      '.then((accepted) =>',
      'if (!accepted) return',
      "setInput((currentInput) => (currentInput === sentInput ? '' : currentInput))",
      'setFiles((currentFiles) => currentFiles.filter((file) => !sentFiles.has(file)))',
    ],
    'Active shell Home conversation-creation draft preservation',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx',
    [
      'mergeFailedSendDraft',
      'restoreFailedSend(message, allFiles)',
      'restoreFailedSend,',
    ],
    'Active shell ACP failed-send draft restoration',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/acp/useAcpInitialMessage.ts',
    [
      'restoreFailedSend: (input: string, files: string[]) => void',
      'restoreFailedSend(input, files)',
    ],
    'Active shell ACP initial-message draft restoration',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/aionrs/AionrsSendBox.tsx',
    [
      'mergeFailedSendDraft',
      'restoreFailedSend(input, initialFiles)',
      'restoreFailedSend(message, filesToSend)',
    ],
    'Active shell AionRS initial and in-conversation draft restoration',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/guid/useGuidSend.oplWhitelist.dom.test.tsx',
    [
      'preserves the Home draft when conversation creation returns no conversation',
      'preserves the Home draft when conversation creation rejects',
      'consumes only the accepted Home snapshot and keeps post-submit input',
    ],
    'Active shell Home failed-create regressions',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/renderer/useAcpInitialMessage.dom.test.ts',
    [
      'restores the GUID initial prompt and attachments when the first send fails',
      'merges a failed snapshot ahead of new input and deduplicates attachments by path',
    ],
    'Active shell initial-message and shared draft-merge regressions',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/renderer/AcpSendBox.dom.test.tsx',
    ['restores the failed prompt and attachments without overwriting input typed while waiting'],
    'Active shell ACP in-conversation failed-send regression',
  );
}

function validateCodexConversationImplementation(shellPaths) {
  validateCodexModelControls(shellPaths);
  validateCodexConversationSurfaces(shellPaths);
  validateSendFailureDraftPreservation(shellPaths);
}

function validateComposerCapabilityPaletteImplementation(shellPaths) {
  const palette = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/chat/composer/ComposerCapabilityPalette/ComposerCapabilityPalette.tsx',
    [
      'export type ComposerCapabilityPaletteItem',
      'export type ComposerCapabilityPaletteGroup',
      'verticalOffset: Math.max(8, triggerRect.top - composerRect.top + 8)',
      'item.description',
      'item.keywords',
      "role='dialog'",
      "data-capability-palette-scroll-region='true'",
      "event.key === 'ArrowDown'",
      "event.key === 'ArrowUp'",
      "event.key === 'Home'",
      "event.key === 'End'",
      "event.key === 'Escape'",
      'searchRef.current?.focus()',
      'focusTrigger()',
      'data-capability-palette-vertical-offset',
      'geometry?.verticalOffset ?? 8',
    ],
    'Active shell shared composer capability palette behavior',
  );
  assertTextExcludesAll(
    palette,
    ['openFileSelector', 'openDirectorySelector', 'workspaceDir'],
    'Active shell shared composer capability palette product-action isolation',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/chat/composer/ComposerCapabilityPalette/ComposerCapabilityPalette.module.css',
    [
      'width: min(736px, calc(100vw - 32px))',
      'box-sizing: border-box',
      'overflow: hidden',
      'overflow-y: auto',
      'scrollbar-gutter: stable',
      'grid-template-columns: 20px minmax(0, 1fr) auto',
    ],
    'Active shell composer-width palette geometry and internal scrolling',
  );

  const guidPalette = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
    [
      'ComposerCapabilityPalette',
      "id: 'local_inputs'",
      "id: 'agent_packages'",
      "id: 'skills'",
      "id: 'session_modes'",
      "id: 'apps_and_connections'",
      'filterNonPermissionAccessModes',
      'getOplHomePurposeAssistantIds',
      'isGuidSkillChecked',
      'horizontalOffset={-8}',
    ],
    'Active shell Home capability palette machine groups',
  );
  assertTextExcludesAll(
    guidPalette,
    ["key='workspace'", "id: 'working_directory'", '<Dropdown trigger=', 'openWorkspacePicker'],
    'Active shell Home capability palette forbidden working-directory and legacy dropdown entries',
  );

  const conversationPalette = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/media/FileAttachButton.tsx',
    [
      'ComposerCapabilityPalette',
      "id: 'local_inputs'",
      "id: 'agent_packages'",
      "id: 'skills'",
      "id: 'session_modes'",
      "id: 'apps_and_connections'",
      'loadedSkills',
      'loadedMcpStatuses',
      'filterOplOrdinarySkillNames',
      'filterOplOrdinaryMcpStatuses',
      'horizontalOffset={-16}',
    ],
    'Active shell existing-conversation capability palette machine groups',
  );
  assertTextExcludesAll(
    conversationPalette,
    [
      'if (isDesktop && !hasSkills && !hasMcpServers)',
      'onClick={openFileSelector}',
      "id: 'add'",
      "id: 'capabilities'",
      "id: 'controls'",
      'controlItems',
      "id: 'working_directory'",
    ],
    'Active shell existing-conversation palette fallback and legacy grouping',
  );

  const paletteTests = [
    readShellText(shellPaths, 'tests/unit/chat/ComposerCapabilityPalette.dom.test.tsx'),
    readShellText(shellPaths, 'tests/unit/media/FileAttachButton.oplWhitelist.dom.test.tsx'),
  ].join('\n');
  assertTextIncludesAll(
    paletteTests,
    [
      'one internal scroll region',
      'keeps the palette above the composer instead of the trigger button',
      'native Enter activation, Escape, and focus return',
      'explicit empty capability state instead of invoking the file picker',
      'openFileSelector).not.toHaveBeenCalled()',
      "id: 'local_inputs'",
      "id: 'agent_packages'",
      "id: 'skills'",
      "id: 'session_modes'",
      "id: 'apps_and_connections'",
    ],
    'Active shell capability palette regressions',
  );
}

function validateSessionFirstDirectoryImplementation(shellPaths) {
  const guidPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/GuidPage.tsx');
  for (const retiredPath of [
    'packages/desktop/src/renderer/components/layout/Sider/ProjectContextSection.tsx',
    'packages/desktop/src/renderer/utils/workspace/projectContext.ts',
    'packages/desktop/src/renderer/pages/guid/components/GuidWorkspaceFootnote.tsx',
  ]) {
    if (existsSync(path.join(shellPaths.shellRoot, retiredPath))) {
      throw new Error(`Active shell session-first directory must remove retired workspace context surface ${retiredPath}`);
    }
  }

  for (const sourcePath of [
    'packages/desktop/src/common/config/configKeys.ts',
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/index.tsx',
    'packages/desktop/src/renderer/pages/guid/GuidPage.tsx',
    'packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx',
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts',
  ]) {
    assertTextExcludesAll(
      readShellText(shellPaths, sourcePath),
      ['ProjectContext', 'projectContext', 'project_context_refs', 'workspace.projectContextInputs'],
      `Active shell session-first input surface in ${sourcePath}`,
    );
  }

  const workspaceContextBar = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidWorkspaceContextBar.tsx',
    [
      "data-testid='guid-workspace-context-bar'",
      "data-testid='guid-workspace-select'",
      "data-testid='guid-workspace-clear'",
      "properties: ['openDirectory', 'createDirectory']",
      'onSelectWorkspace(selectedDirectory)',
      'onClearWorkspace',
    ],
    'Active shell independent new-session working-directory context bar',
  );
  assertTextExcludesAll(
    workspaceContextBar,
    ['ComposerCapabilityPalette', "key='workspace'", 'workspace.projectContextInputs'],
    'Active shell working-directory context bar palette isolation',
  );
  assertTextIncludesAll(
    guidPage,
    [
      "import GuidWorkspaceContextBar from './components/GuidWorkspaceContextBar'",
      '<GuidWorkspaceContextBar',
      'workspaceDir={guidInput.dir}',
      'onSelectWorkspace={handleWorkspaceSelect}',
      'onClearWorkspace={handleWorkspaceClear}',
    ],
    'Active shell Home working-directory context bar placement',
  );
  const guidActionRow = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
  );
  assertTextExcludesAll(
    guidActionRow,
    [
      "key='workspace'",
      "data-testid='guid-workspace-chip'",
      "data-testid='guid-workspace-clear'",
      'openWorkspacePicker',
    ],
    'Active shell Home capability palette working-directory isolation',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts',
    ['const initialFiles = Array.from(new Set(files))', 'default_files: initialFiles', 'files: initialFiles.length > 0'],
    'Active shell explicit current-session input projection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/guid/useGuidSend.oplWhitelist.dom.test.tsx',
    ['sends only explicit session attachments and deduplicates them in insertion order'],
    'Active shell explicit current-session input regression',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync.ts',
    [
      'export const mergeCanonicalThreadDirectory',
      'if (!directory) return localConversations',
      'const returnedThreadIds = new Set(directory.threads.map((thread) => thread.id))',
      'const threadId = canonicalCodexThreadId(conversation)',
      "return conversation.type !== 'acp' || conversation.extra.backend !== 'codex'",
      '...directory.threads.map((thread) => projectCanonicalCodexThread(thread, cachedByThreadId.get(thread.id)))',
    ],
    'Active shell canonical App Server session directory projection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/conversation/runtime/conversationListSyncGuard.test.ts',
    [
      'drops unmatched stale Codex cache rows when the complete App Server overview is available',
      'retains unmatched non-Codex local rows without title or workspace deduplication',
      'deduplicates local canonical rows only when the App Server returns',
      'falls back to shell cache when the canonical directory is unavailable',
    ],
    'Active shell canonical session directory regressions',
  );

  const threadAdapter = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/services/codexAppServer/adapter.ts',
    [
      'function recordedCwd(value: unknown): string',
      "if (typeof value !== 'string') throw new Error('Invalid Codex app-server thread cwd.')",
      'workspace: recordedCwd(raw.cwd)',
      "result = await this.rpc.request('thread/read', { threadId, includeTurns: true })",
      "await this.rpc.request('thread/resume', { threadId, excludeTurns: false })",
      "await this.rpc.request('thread/settings/update'",
      'async updateThreadSettings(',
    ],
    'Active shell single canonical App Server thread adapter',
  );
  assertTextExcludesAll(
    threadAdapter,
    [
      'gitInfo?.originUrl',
      'runtimeWorkspaceRoots',
      'workspace_handoff',
      'adoptProjectlessThread',
    ],
    'Active shell Project identity and adoption adapter private-layer boundary',
  );
  assertTextExcludesAll(
    [
      readShellText(shellPaths, 'packages/desktop/src/common/types/codex/appServerThreads.ts'),
      readShellText(shellPaths, 'packages/desktop/src/common/adapter/ipcBridge.ts'),
      readShellText(shellPaths, 'packages/desktop/src/process/bridge/codexAppServerBridge.ts'),
    ].join('\n'),
    ['CodexThreadProjectAdoptionRequest', 'codex-threads.adopt-project', 'adoptProject'],
    'Active shell has no private project-adoption RPC or IPC surface',
  );
  assertTextIncludesAll(
    [
      readShellText(shellPaths, 'packages/desktop/src/common/types/codex/appServerThreads.ts'),
      readShellText(shellPaths, 'packages/desktop/src/common/adapter/ipcBridge.ts'),
      readShellText(shellPaths, 'packages/desktop/src/process/bridge/codexAppServerBridge.ts'),
    ].join('\n'),
    [
      'CodexThreadSettingsUpdateRequest',
      'codex-threads.update-settings',
      'codexThreads.updateSettings',
      'adapter.updateThreadSettings',
    ],
    'Active shell existing Codex App Server thread settings transport',
  );
  const projectAffinityLifecycle = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/hooks/canonicalThreadLifecycle.ts',
    [
      'conversation?.extra.custom_workspace === false',
      '!conversation?.extra.workspace?.trim()',
      'const selectedWorkspace = workspace.trim()',
      'ipcBridge.codexThreads.updateSettings.invoke',
      'ipcBridge.codexThreads.read.invoke',
      'canonicalReadback.thread.workspace !== selectedWorkspace',
      'ipcBridge.conversation.update.invoke',
      'ipcBridge.conversation.get.invoke',
      'Canonical thread cwd readback did not match the selected project',
      'custom_workspace: true',
      'return false',
    ],
    'Active shell explicit unbound project adoption lifecycle',
  );
  assertTextExcludesAll(
    projectAffinityLifecycle,
    [
      'conversation?.extra.custom_workspace !== true',
      'conversation.extra.custom_workspace !== true',
      'Boolean(conversation.extra.workspace?.trim())',
      'runtimeWorkspaceRoots',
      'workspace_handoff',
      'codexThreads.adoptProject',
    ],
    'Active shell explicit projectless marker and affinity isolation',
  );
  const conversationListSync = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync.ts',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/ConversationRow.tsx',
    ["key='move-to-project'", "t('conversation.history.moveToProject')", 'onMoveToProject?.(conversation)'],
    'Active shell keyboard-reachable project adoption menu action',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/GroupedHistory/index.tsx',
    [
      'draggable={draggable}',
      'handleProjectAdoptionDrop(group.workspace)',
      'isProjectlessCanonicalConversation(conversation)',
      'onMoveToProject:',
    ],
    'Active shell native drag and menu project adoption paths',
  );
  const projectAffinityTests = [
    readShellText(shellPaths, 'tests/unit/codex-app-server/adapter.test.ts'),
    readShellText(shellPaths, 'tests/unit/conversation/runtime/conversationListSyncGuard.test.ts'),
    readShellText(shellPaths, 'tests/unit/conversation/useConversationActions.dom.test.tsx'),
    readShellText(shellPaths, 'tests/unit/conversation/export/GroupedHistoryExportEntry.dom.test.tsx'),
  ].join('\n');
  assertCanonicalThreadAffinityConvergenceSources({
    canonicalThreadLifecycle: projectAffinityLifecycle,
    conversationListSync,
    focusedTests: projectAffinityTests,
    threadAdapter,
  });
  assertTextIncludesAll(
    projectAffinityTests,
    [
      'keeps directories distinct even when threads share one Git origin',
      'hydrates a legacy missing affinity marker from the canonical recorded cwd',
      'adopts an explicitly projectless canonical conversation without a cached workspace',
      'updates the App Server cwd before committing the local affinity projection',
      'keeps the conversation projectless when canonical cwd readback does not match',
      'blocks reassignment after a canonical cwd is recorded',
      'does not change turn pwd or sandbox writable roots during adoption',
      'moves an eligible projectless row through native drag and drop',
    ],
    'Active shell project affinity focused regressions',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/chat/normalizeToolCall.ts',
    [
      'export function normalizeSubagentActivities',
      "const ACTIVE_SUBAGENT_STATES = new Set(['pendingInit', 'running'])",
      "const DONE_SUBAGENT_STATES = new Set(['interrupted', 'completed', 'errored', 'shutdown', 'notFound'])",
      'const collaboration = asRecord(codex?.collaboration)',
      'const subagent = asRecord(codex?.subagent)',
      'byThreadId.set(threadId, mergeSubagentActivity(byThreadId.get(threadId), candidate))',
    ],
    'Active shell read-only Codex subagent metadata projection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolGroupSummary.tsx',
    [
      'normalizeSubagentActivities(messages)',
      "subagents.filter((item) => item.status === 'active')",
      "subagents.filter((item) => item.status === 'done')",
      'projectCanonicalCodexThread(detail.thread, undefined, { materialized: true })',
      "Message.error(t('messages.subagents.openFailed'))",
    ],
    'Active shell Codex subagent Active/Done detail and canonical task projection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/renderer/messageToolGroupSummary.dom.test.tsx',
    [
      'groups Codex subagents as Active and Done and materializes a canonical task on open',
      'keeps the current conversation usable when a canonical subagent task cannot be opened',
      'reuses a migrated local projection instead of creating a duplicate canonical task',
    ],
    'Active shell Codex subagent read-only UI regressions',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx',
    ["data-testid='guid-input-card-shell'"],
    'Active shell single Home composer marker',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/SiderFooter.tsx',
    ["data-testid={account ? 'sider-footer-account' : 'sider-footer-settings'}"],
    'Active shell single account or Settings footer marker',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/index.module.css',
    ['.guidContainer {', 'background: var(--bg-base);'],
    'Active shell Home repaint background',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/e2e/features/visual-evidence/gui-baseline.e2e.ts',
    [
      'const GUI_BASELINE_FIXTURE_MARKER',
      'async function removeFixtureConversations',
      'await expect(homeEntry).toHaveCount(1)',
      "page.locator('[data-testid=\"guid-input-card-shell\"]')",
      "page.locator('[data-testid=\"sider-footer-account\"], [data-testid=\"sider-footer-settings\"]')",
      'await waitForStablePaint(page)',
    ],
    'Active shell single-instance Home visual regression',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/utils/utils.ts',
    ['AIONUI_E2E_TEST', 'AIONUI_E2E_STORAGE_ROOT', 'path.isAbsolute(root)', "path.join(e2eStorageRoot, 'data')"],
    'Active shell E2E storage isolation',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/opl-runtime/oplStoragePaths.test.ts',
    [
      'keeps E2E data and config inside the explicit test storage root',
      'fails closed when E2E mode has no isolated storage root',
      'fails closed when the E2E storage root is relative',
      'ignores the E2E storage root outside E2E mode',
    ],
    'Active shell E2E storage isolation regressions',
  );
}

function validateReadOnlySessionEnvironmentImplementation(shellPaths) {
  const retiredHandoffControl =
    'packages/desktop/src/renderer/pages/conversation/components/ChatLayout/WorkspaceHandoffControl.tsx';
  if (existsSync(path.join(shellPaths.shellRoot, retiredHandoffControl))) {
    throw new Error(`Active shell must remove retired workspace handoff control ${retiredHandoffControl}`);
  }

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/components/ChatLayout/ConversationEnvironmentPopover.tsx',
    ['ipcBridge.gitWorkspace.inspect.invoke({ cwd: summary.workspace })'],
    'Active shell read-only conversation environment Git inspection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/conversation/context/ConversationEnvironmentPopover.dom.test.tsx',
    ['renders the recorded workspace and live Git context without mutation controls'],
    'Active shell read-only conversation environment regression',
  );

  for (const sourcePath of [
    'packages/desktop/src/renderer/pages/conversation/components/ChatLayout/ConversationEnvironmentPopover.tsx',
    'packages/desktop/src/renderer/pages/guid/GuidPage.tsx',
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts',
  ]) {
    assertTextExcludesAll(
      readShellText(shellPaths, sourcePath),
      ['ensureManagedWorktree', 'workspace_handoff', 'thread/settings/update'],
      `Active shell simplified workspace surface in ${sourcePath}`,
    );
  }
}

export function validateRuntimePageImplementation(shellPaths) {
  const primaryNav = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/SiderNav/SiderPrimaryNav.tsx',
    ["key: 'runtime'", "t('common.runtime.sidebarEntry')", "active: pathname.startsWith('/runtime')"],
    'Active AionUI primary navigation Runtime status entry',
  );
  const runtimeIndex = primaryNav.indexOf("key: 'runtime'");
  const scheduledIndex = primaryNav.indexOf("key: 'scheduled'");
  const archivedIndex = primaryNav.indexOf("key: 'archived'");
  if (!(runtimeIndex < scheduledIndex && scheduledIndex < archivedIndex)) {
    throw new Error('Active AionUI primary navigation must order Runtime before Scheduled tasks and Archived');
  }
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/layout/SiderNavigation.dom.test.tsx',
    [
      'orders primary actions before history utilities and keeps the footer compact',
      "['New task', 'Runtime', 'Scheduled Tasks', 'Archived', 'Settings']",
      "getByRole('button', { name: 'Runtime' })",
    ],
    'Active AionUI Runtime navigation visibility and order regression',
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
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/projection.ts',
    runtimeProjectionExpected,
    'Active shell Runtime v2 canonical work-item projection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeStagePopover.tsx',
    runtimeStagePopoverExpected,
    'Active shell Runtime Stage popover',
  );
  const runtimeStatusBar = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeStatusBar.tsx',
    [
      "data-testid='runtime-status-view-select'",
      "data-testid='runtime-open-archive'",
      '<Select',
    ],
    'Active shell Runtime compact task toolbar',
  );
  assertTextExcludesAll(
    runtimeStatusBar,
    ['runtime-status-metrics', '<Radio.Group', 'metricGrid'],
    'Active shell Runtime metric-card and duplicate-filter surfaces',
  );
  const runtimeFocusedTests = [
    readShellText(shellPaths, 'tests/unit/opl-runtime/runtime-v2/RuntimePageV2.dom.test.tsx'),
    readShellText(shellPaths, 'tests/unit/opl-runtime/runtime-v2/projection.test.ts'),
  ].join('\n');
  assertTextIncludesAll(runtimeFocusedTests, runtimeFocusedTestsExpected, 'Active shell Runtime v2 focused regressions');
  assertRuntimePageSourceBoundary(runtimePage);

  const projection = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/projection.ts',
    [
      'const PRIMARY_STATUSES = new Set<RuntimePrimaryStatus>',
      'enumValue(lifecycle.primary_state, PRIMARY_STATUSES)',
      "projectedPrimaryStatus ?? 'sync_pending'",
      'const projectedAction = parseAction(value.action)',
      'const stageMap = parseStageMap(value.stage_map)',
    ],
    'Active shell Runtime V2 thin projection reader',
  );
  assertTextExcludesAll(
    projection,
    ['function primaryStatus(', 'statusByBusinessState'],
    'Active shell Runtime V2 status inference',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeScopeBar.tsx',
    [
      "data-testid='runtime-agent-selector'",
      "data-testid='runtime-project-selector'",
      'disabled={selectedAgentId === ALL_RUNTIME_SCOPES}',
      "t('common.runtime.scope.viewing')",
    ],
    'Active shell Runtime Agent then Project scope',
  );
  const statusBar = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeStatusBar.tsx',
    [
      "id: 'all'",
      "id: 'automatically_advancing'",
      "id: 'awaiting_user_decision'",
      "id: 'system_attention'",
      "id: 'delivered_or_paused'",
      "id: 'stopped'",
      "id: 'sync_pending'",
      "data-testid='runtime-status-view-select'",
    ],
    'Active shell Runtime seven status-only saved views',
  );
  assertTextExcludesAll(statusBar, ["id: 'mas'", "id: 'med-autoscience'"], 'Active shell Runtime agent saved views');

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeWorkItemList.tsx',
    [
      "data-testid='runtime-task-row'",
      "data-responsive-columns='4'",
      '<RuntimeStagePopover item={item} locale={locale} t={t} />',
      'nextStageLabel(item, locale, t)',
      "t('common.runtime.stageUsageShort')",
      "t('common.runtime.totalUsageShort')",
    ],
    'Active shell Runtime one-row work item list',
  );
  const runtimeDetailDrawer = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeDetailDrawer.tsx',
    [
      "data-testid='runtime-stage-map'",
      'currentStageLabel(item, locale, t)',
      'nextStageLabel(item, locale, t)',
      'stageDisplayName(stage, locale)',
      'item.execution.attemptId',
      'item.execution.lastHeartbeatAt',
      'formatTokenObservation(item.stageUsage',
      'formatTokenObservation(item.taskUsage',
      "data-testid='runtime-next-action'",
      "data-testid='runtime-system-attention'",
      "data-testid={archived ? 'runtime-restore-work-item' : 'runtime-archive-work-item'}",
    ],
    'Active shell Runtime minimal selected-work-item detail',
  );
  assertTextExcludesAll(
    runtimeDetailDrawer,
    [
      'Collapse',
      "runtime-detail-disclosure",
      "name='artifacts'",
      "name='timeline'",
      "name='evidence'",
      "name='diagnostics'",
      'ConditionList',
      'SourceRefList',
    ],
    'Active shell Runtime advanced detail surfaces',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/RuntimePage.module.css',
    [
      'overflow-x: hidden',
      'box-sizing: border-box',
      '@container (max-width: 720px)',
      '@container (max-width: 360px)',
      '@media (max-width: 1180px)',
      'grid-template-columns: repeat(2, minmax(0, 1fr))',
      'grid-template-columns: minmax(0, 1fr)',
    ],
    'Active shell Runtime responsive semantic reflow',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/e2e/runtime-v2/runtime-v2.e2e.ts',
    [
      '{ width: 1440, height: 960, columns: 4 }',
      '{ width: 1024, height: 900, columns: 2 }',
      '{ width: 768, height: 900, columns: 2 }',
      '{ width: 375, height: 812, columns: 1 }',
      'assertNoHorizontalOverflow(page)',
      'assertElementsWithinViewport(page',
      'toHaveCount(9',
      'runtime-v2-${locale.id}-${viewport.width}.png',
      'runtime-v2-${locale.id}-${viewport.width}-stage-popover.png',
      'runtime-v2-${locale.id}-action-detail.png',
      'runtime-v2-1440-stage-popover.png',
      'runtime-v2-1440-minimal-detail.png',
      "keeps task details minimal without evidence or diagnostic surfaces",
      "toHaveCount(0)",
    ],
    'Active shell Runtime deterministic viewport evidence',
  );
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

function validateStorageCarrierImplementation(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/StorageSettings/index.tsx',
    [
      "import { isElectronDesktop } from '@/renderer/utils/platform'",
      'const desktopCarrier = isElectronDesktop()',
      'const ownerInventoryRefresh = Promise.allSettled',
      'if (!desktopCarrier)',
      'desktopCarrier &&',
    ],
    'Active shell Storage carrier split',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/settings/StorageSettings.dom.test.tsx',
    [
      'keeps the WebUI Storage core route fail-open without invoking desktop local lifecycle',
      'expect(bridgeMocks.getInventorySnapshot).not.toHaveBeenCalled()',
      'expect(bridgeMocks.refreshInventory).not.toHaveBeenCalled()',
    ],
    'Active shell WebUI Storage carrier regression',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/web-host/src/static-server.unit.test.ts',
    ["'/settings/storage'", 'SPA fallback: %s returns index.html'],
    'Active shell Web host Storage core-route regression',
  );
}

export function validateShellOrdinaryExperienceImplementation(shellPaths) {
  const guidPage = validateGuidHomeImplementation(shellPaths);
  validateGuidAgentSelection(shellPaths);
  validateProductProfileDefaults(shellPaths);
  validateGuidAssistantsAndSkills(shellPaths, guidPage);
  validateCodexConversationImplementation(shellPaths);
  validateComposerCapabilityPaletteImplementation(shellPaths);
  validateSessionFirstDirectoryImplementation(shellPaths);
  validateReadOnlySessionEnvironmentImplementation(shellPaths);
  validateRuntimePageImplementation(shellPaths);
  validateSkillsHubImplementation(shellPaths);
  validateStorageCarrierImplementation(shellPaths);
}
