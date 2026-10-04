import {
  assertShellTextIncludesAll,
  assertTextDoesNotMatch,
  readShellJson,
  readShellText,
} from '../shell-implementation-helpers.ts';

export const codexModelsExpected = [
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


export function validateCodexSessionConfigurationMenuImplementation(
  shellPaths,
  dshVisualSourceImplemented,
) {
  const sessionMenu = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/agent/OplCodexSessionMenu.tsx',
    [
      "type SessionMenuGroup = 'model' | 'reasoning'",
      "data-testid='opl-codex-session-menu'",
      "data-testid='opl-codex-session-menu-reset'",
      "renderSummaryItem('model'",
      "'reasoning'",
      "role='separator'",
      'onReset();',
      dshVisualSourceImplemented
        ? "<OplIcon name='refresh'"
        : '<Refresh {...OPL_CHROME_ICON_PROPS} size={16}',
      "event.key === 'ArrowLeft'",
      "event.key === 'Escape'",
      "['ArrowDown', 'ArrowUp', 'Home', 'End']",
    ],
    'Active shell shared Codex session configuration menu',
  );
  const guidModelSelector = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidModelSelector.tsx',
    ['OplCodexSessionMenu', '<OplCodexSessionMenu', 'onReset={restoreCodexAutoSelection}'],
    'Active shell Home Codex session configuration menu',
  );
  const acpModelSelector = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx',
    ['OplCodexSessionMenu', '<OplCodexSessionMenu', 'onReset={handleAutoSelect}'],
    'Active shell conversation Codex session configuration menu',
  );
  const guidActionRow = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
    ["key: 'reset-session-defaults'", "t('agent.sessionConfiguration.resetDefaults')", 'onChange(null, null)'],
    'Active shell mobile Home Codex reset action',
  );
  const acpSendBox = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx',
    ["key: 'reset-session-defaults'", "t('agent.sessionConfiguration.resetDefaults')", 'handleSheetAutoSelect'],
    'Active shell mobile conversation Codex reset action',
  );
  const i18nKeys = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/services/i18n/i18n-keys.d.ts',
    [
      'agent.sessionConfiguration.menuLabel',
      'agent.sessionConfiguration.model',
      'agent.sessionConfiguration.reasoning',
      'agent.sessionConfiguration.resetDefaults',
    ],
    'Active shell Codex session configuration i18n keys',
  );
  const modelMenuSources = [
    sessionMenu,
    guidModelSelector,
    acpModelSelector,
    guidActionRow,
    acpSendBox,
    i18nKeys,
  ].join('\n');
  assertTextDoesNotMatch(
    modelMenuSources,
    /sessionConfiguration\.speed|\bspeed(?:Fast|Standard|SwitchSuccess)?\b|速度/i,
    'Active shell Codex session configuration must not retain speed controls or copy',
  );
  const expectedLocales = {
    'zh-CN': {
      menuLabel: '模型与推理设置',
      model: '模型',
      reasoning: '推理强度',
      resetDefaults: '重置为默认设置',
    },
    'en-US': {
      menuLabel: 'Model and reasoning settings',
      model: 'Model',
      reasoning: 'Reasoning',
      resetDefaults: 'Reset to defaults',
    },
  };
  for (const [locale, expected] of Object.entries(expectedLocales)) {
    const agentLocale = readShellJson(
      shellPaths,
      `packages/desktop/src/renderer/services/i18n/locales/${locale}/agent.json`,
      `${locale} agent locale`,
    );
    if (JSON.stringify(agentLocale?.sessionConfiguration) !== JSON.stringify(expected)) {
      throw new Error(`Active shell ${locale} Codex session configuration copy must match App authority exactly`);
    }
  }
}
export function validateCodexModelControls(shellPaths, dshVisualSourceImplemented) {
  validateCodexSessionConfigurationMenuImplementation(shellPaths, dshVisualSourceImplemented);
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/composerSurface.ts', ['getOplHomeComposerStateContract', 'resolveOplHomeComposerSurface', 'contract.executor', 'contract.invariants.model_reasoning_visible', 'contract.invariants.permission_access_visible', 'contract.invariants.executor_selector_visible'], 'Active shell Home composer App-contract decision surface');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx', ['useAcpModelInfo', 'canSwitch', 'if (!canSwitch)', 'selectAutoModel()', 'onSelect: handleAutoSelect'], 'Active shell ACP model selector fixed Codex model guard');
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
    ["OplIcon } from './OplVisualProvider'", "name='refreshSmall'", 'aria-label={label}', '<Tooltip content={label}>'],
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
