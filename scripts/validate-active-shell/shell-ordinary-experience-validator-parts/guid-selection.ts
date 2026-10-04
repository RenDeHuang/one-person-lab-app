import {
  assertShellTextIncludesAll,
  assertTextExcludesAll,
  assertTextIncludesAll,
  readShellText,
} from '../shell-implementation-helpers.ts';

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
      'activeShortcutId={activeShortcut?.shortcut_id}',
      "const { appState } = useOplAppState('fast')",
      'handleSelectShortcut(assistantId)',
      'onSelect={(assistantId) =>',
      'onClear={() =>',
      'sameActiveShortcut',
      'setActiveShortcut((current) => {',
      'const next = resolveOplActiveShortcut(navState.selectedCapabilityId, appState)',
      'return sameActiveShortcut(current, next) ? current : next',
      'agentSelection.setSelectedAgentKey(agentSelection.defaultAgentKey)',
    ],
    'Active shell Guid Home starter selection',
  );
  assertTextExcludesAll(
    guidPage,
    [
      'setActiveShortcut(resolveOplActiveShortcut(navState.selectedCapabilityId))',
      'setActiveShortcut(resolveOplActiveShortcut(navState.selectedCapabilityId, appState))',
    ],
    'Active shell retired static Guid Home shortcut resolution',
  );
  assertTextIncludesAll(
    homeStarters,
    [
      "data-testid='opl-home-starters'",
      'assistant.opl_package_id === activeCapabilityId && assistant.opl_shortcut_id === activeShortcutId',
      'aria-pressed={active}',
      'data-opl-active={String(active)}',
      'resolveOplPackageLaunchGate(appState, assistant.opl_package_id)',
      "const launchReady = launchGate.state !== 'package_unavailable'",
      'data-opl-launch-ready={String(launchReady)}',
      'active && styles.homeStarterActive',
      'starterIcon()',
      'active && onClear ? onClear() : onSelect(assistant.opl_shortcut_id)',
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
      'const active = assistant.id === activeCapabilityId',
      'resolveOplPackageLaunchGate(appState, assistant.id)',
      'starterIcon(assistant.opl_package_id)',
      'starterIcon(assistant.id)',
      'active && onClear ? onClear() : onSelect(assistant.id)',
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
      'align-items: center',
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
      "from '@/renderer/components/opl/OplVisualProvider'",
      'getOplVisualPrimitiveProps(',
      "'composer',",
      '${styles.guidInputInner} ${isInputActive',
      "isInputActive ? 'opl-codex-composer--focused' : ''",
      "fileDraggingActive ? 'opl-codex-composer--dragging' : ''",
      "data-composer-palette-boundary='true'",
      'activeBorderColor',
      'inactiveBorderColor',
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
  'zh-CN': [
    '安装后智能自检',
    '首次设置的核心阶段已经完成',
    'opl app state --profile fast --json',
    'App 核心可用',
    'presence-only',
    '用户主动卸载',
    'opl packages status --package-id <id> --json',
    'OPL Flow 缺失或被用户卸载时不得阻断 App 核心功能',
    '本轮只诊断',
  ],
  'en-US': [
    'Post-install intelligent self-check',
    'The core first-run setup stage has completed',
    'opl app state --profile fast --json',
    'App core usable',
    'presence-only',
    'Packages explicitly removed by the user are not failures',
    'opl packages status --package-id <id> --json',
    'Missing or user-uninstalled OPL Flow must not block App core functionality',
    'This turn is diagnostic only',
  ],
};

const guidHomeRuntimeForbidden = [
  "data-testid='opl-home-model-status'",
  'homeModelStatusRow',
  'homeModelStatus',
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

const guidAssistantsExpected = [
  'parseOplStandardAgentDirectoryEntries',
  'getOplHomeAgentShortcutsFromAppState',
  'agentPackageDirectoryEntries',
  'resolveOplProfessionalAgentAssistants',
  'resolveOplHomeAssistants',
  'opl_package_id',
  'opl_shortcut_id',
  'enabled_skills',
  'custom_skill_names',
  'disabled_builtin_skills',
];

const guidPageSkillExpected = [
  'getOplDirectorySkillIds(appState)',
  'parseOplStandardAgentDirectoryEntries(appState)',
  'resolveOplStandardAgentCapabilityMetadata(appState, activeShortcut?.package_id)',
  'const selectedAllowedSkillIds = new Set',
  'const visibleSkillCatalog = activeShortcut',
  'const effectiveGuidEnabledSkills = mergeRequiredSkills(',
  'selectedCapabilityMetadata?.requiredSkillIds ?? []',
  '(guidEnabledSkills ?? []).filter((name) => selectedAllowedSkillIds.has(name))',
  'buildAssistantScopedSkillMenuItems(visibleSkillCatalog, selectedSkillProfile)',
  'guidEnabledSkills: effectiveGuidEnabledSkills',
];

export function validateGuidHomeImplementation(shellPaths) {
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

export function validateGuidAgentSelection(shellPaths) {
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
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidMention.ts',
    [
      'setSelectedAgentKey(key)',
      'setInput((prev) => stripMentionToken(prev))',
      'setMentionSelectorVisible(true)',
    ],
    'Active shell explicit @Agent single-owner selection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/guid/useGuidAgentSelection.dom.test.ts',
    [
      'selects an explicit Agent mention as the single session owner',
      'selectionEnabled: true',
      "selectMentionAgent('custom:oma')",
      "toHaveBeenCalledWith('custom:oma')",
    ],
    'Active shell explicit @Agent selection regression',
  );
}

export function validateGuidAssistantRegistry(shellPaths) {
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/common/types/codex/codexModels.ts', codexModelsExpected, 'Active shell Codex model policy App-owned default options before ACP handshake');
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/types/opl/appState.ts',
    ['parseOplStandardAgentDirectoryEntries', "value.package_role !== 'standard_agent'"],
    'Active shell shared standard-Agent directory parser',
  );
  const guidAssistants = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/utils/oplHomeAssistants.ts',
    guidAssistantsExpected,
    'Active shell Guid assistants dynamic directory and exact backend binding',
  );
  assertTextDoesNotMatch(
    guidAssistants,
    /getOplDefaultHomeAssistants|getOplDefaultExecutorAgentKey|DEFAULT_PRESET_AGENT_TYPE|preset_agent_type:/,
    'Active shell Guid Agent directory must not restore fixed Profile membership or guessed executor identity.',
  );
}

export function validateGuidSkillRules(shellPaths, guidPage) {
  assertTextIncludesAll(guidPage, guidPageSkillExpected, 'Active shell Guid page App assistant skill profile rule');
  assertTextExcludesAll(
    guidPage,
    ['const effectiveGuidEnabledSkills = guidEnabledSkills', 'buildAssistantScopedSkillMenuItems(allSkills, undefined)'],
    'Active shell retired static App assistant skill profile rule',
  );
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/assistantSkillMenu.ts', ['buildAssistantScopedSkillMenuItems', 'mergeRequiredSkills', 'required_skills', 'locked: isRequired'], 'Active shell Guid skill menu App assistant skill profile rule');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx', ['GuidSkillMenuItem', 'isGuidSkillChecked', 'skill.locked', 'disabled: skill.locked'], 'Active shell Guid action row required assistant skills');
  const guidSend = assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts', ['activeShortcut', 'preset_enabled_skills'], 'Active shell Guid send App shortcut route/skill signal');
  assertTextExcludesAll(
    guidSend,
    ['buildOplShortcutRouteReceipt', 'opl_assistant_route'],
    'Active shell retired duplicate Guid shortcut route receipt',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/guid/useGuidSend.oplWhitelist.dom.test.tsx',
    [
      'preserves configured MCP servers while filtering forbidden Team MCP servers',
      "expect(payload.extra.selected_mcp_server_ids).toEqual(['unknown-mcp', 'cron'])",
    ],
    'Active shell Guid MCP negative-filter send regression',
  );
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/activeShortcut.ts', ['OplActiveShortcut', 'resolveOplActiveShortcut', 'required_skill_ids'], 'Active shell Guid shortcut identity signal');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/common/utils/buildAgentConversationParams.ts', ['preset_enabled_skills'], 'Active shell create conversation App assistant route/skill signal');
}

export function validateGuidAssistantsAndSkills(shellPaths, guidPage) {
  validateGuidAssistantRegistry(shellPaths);
  validateGuidSkillRules(shellPaths, guidPage);
}
