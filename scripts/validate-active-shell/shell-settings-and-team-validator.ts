import {
  assertShellTextIncludesAll,
  assertTextExcludesAll,
  readShellText,
} from './shell-implementation-helpers.ts';

const settingsNavExpected = [
  "from '../registry/settingsRegistry'",
  'buildSettingsNavItems',
  'getBuiltinSettingsNavItems',
];

const settingsRegistryExpected = [
  "from '@icon-park/react'",
  'getOplGuiSettingsControlPlane',
  'getOplGuiSettingsVisibleTabs',
  'getOplGuiLegacySettingsRouteRedirects',
  'settingsControlPlane?.default_route',
  'settingsControlPlane?.ordinary_routes',
  'settingsControlPlane?.extension_anchor_remap',
  'LEGACY_SETTINGS_ROUTE_REDIRECTS',
  'LEGACY_ANCHOR_REMAP',
  'buildSettingsItemsWithExtensions',
  "theme='outline'",
  '{icon(16)}',
];

const conversationMarkdownExpected = [
  'line-height: 1.4667;',
  'font-size: var(--chat-font-size, 15px);',
  'margin-block-start: 10px;',
  'margin-block-start: 2px;',
  'font-size: 12px;',
  'line-height: 18px;',
];

const conversationMessageExpected = [
  "classNames('h-20px flex items-center mt-2px gap-6px'",
  "data-testid='message-hover-actions'",
];

const conversationMessageStylesExpected = [
  '.message-item .whitespace-pre-wrap',
  'font-size: var(--chat-font-size, 15px);',
  'line-height: 1.4667;',
];

const conversationToolSummaryExpected = [
  "from '@icon-park/react'",
  'useTranslation',
  "type='button'",
  'aria-expanded={showMore}',
  'messages.toolSteps.completed',
  'messages.toolSteps.input',
  'messages.toolSteps.output',
];

const conversationFileChangesExpected = [
  "variant?: 'panel' | 'conversation'",
  "variant = 'panel'",
  'data-variant={variant}',
  "compact ? 'py-2px'",
];

const conversationSkeletonExpected = ["data-testid='message-list-skeleton-lines'"];

const settingsModalExpected = [
  'SettingsHost',
  "defaultTab = 'general'",
];

const settingsHostExpected = [
  'buildSettingsModalMenuItems',
  'getSettingsSearchEntries',
  'getSettingsRenderSlot',
  'resolveSettingsRenderTarget',
  'ExtensionSettingsTabContent',
  'SettingsShellAdapterSlot',
  'data-testid=\'settings-host\'',
];

const settingsShellAdapterSlotExpected = [
  'SettingsShellRenderSlot',
  'OverviewSettings',
  'WorkspaceSettings',
  'LocalServicesSettings',
  'RuntimeSettings',
  'CapabilitiesSettingsContent',
  'GatewaySettingsContent',
  'AccessSettingsContent',
  'ResourcesSettingsContent',
  'AppearanceModalContent',
  'AboutModalContent',
  'StorageSettings',
  'withWrapper={false}',
];

const settingsModalForbidden = [
  'ModelModalContent',
  'AgentModalContent',
  "label: t('settings.model')",
  "label: t('settings.tools')",
  "label: t('settings.webui')",
];

const settingsFooterExpected = [
  "data-testid={account ? 'sider-footer-account' : 'sider-footer-settings'}",
  "onSettingsClick(account ? 'gateway' : 'general')",
  "data-testid='sider-footer-account-avatar'",
  'bg-success',
  'text-inverse',
  'updateAvailable &&',
  'onClick={onUpdateClick}',
  "data-testid='sider-footer-update'",
  "data-update-available='true'",
];

const settingsFooterForbidden = [
  "t('common.back'",
  'sider-footer-back',
  'sider-footer-help',
  'showThemeToggle',
  'sider-footer-theme',
  'sider-footer-update-row',
  "t('settings.checkForUpdates')",
  'isSettings',
];

const settingsAppearanceExpected = [
  "const APPEARANCE_MODES: ThemeAppearanceMode[] = ['system', 'light', 'dark']",
  'appearanceMode, setAppearanceMode',
  "role='radiogroup'",
  "data-testid='appearance-mode-selector'",
  'data-testid={`appearance-mode-${mode}`}',
  'aria-checked={selected}',
];

const settingsAppearanceForbidden = ['CssThemeSettings', "data-testid='preferences-theme-section'", 'CODEX_THEME_ID'];

const settingsSiderReturnForbidden = [
  'resolveSettingsReturnPath',
  'navigate(resolveSettingsReturnPath())',
  "data-testid='settings-back-to-app'",
  "t('settings.backToApp')",
];

const settingsTitlebarReturnExpected = [
  'resolveSettingsReturnPath',
  'navigate(resolveSettingsReturnPath())',
  "data-testid='settings-titlebar-back-to-app'",
  "'settings-titlebar-history-back'",
];

const ordinaryCapabilityFilterExpected = [
  'REQUIRED_ORDINARY_FORBIDDEN_CAPABILITY_POLICY',
  'getOplOrdinaryForbiddenCapabilityPolicy',
  'isOplForbiddenTeamMcpName',
  "exact: ['aionui-team']",
  "prefixes: ['team_', 'mcp__aionui-team']",
  "contains: ['aionui-team']",
  "'team_mcp_stdio_config'",
  "'team_lead_conversation_id'",
  'sanitizeOplOrdinaryConversationExtra',
  'for (const key of getOplOrdinaryForbiddenCapabilityPolicy().extra_keys)',
  'filterOplOrdinarySessionMcpServers',
];

const teamIpcBridgeExpected = [
  'import { TEAM_MODE_ENABLED }',
  'function disabledTeamMutation',
  'Team mode is disabled for ordinary OPL App',
  'create: disabledTeamMutation(',
  'remove: disabledTeamMutation(',
  'addAgent: disabledTeamMutation(',
  'removeAgent: disabledTeamMutation(',
  'stop: disabledTeamMutation(',
  'ensureSession: disabledTeamMutation(',
  'renameAgent: disabledTeamMutation(',
  'renameTeam: disabledTeamMutation(',
  'setSessionMode: disabledTeamMutation(',
];

const teamSurfaceExpected = ['{TEAM_MODE_ENABLED && (', '<TeamSiderSection'];
const teamCreatedRedirectExpected = ['if (!TEAM_MODE_ENABLED)', 'return undefined'];

function validateSettingsPartitionImplementation(shellPaths) {
  const settingsAppearance = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/registry/settingsRegistry.tsx',
    settingsRegistryExpected,
    'Active shell settings registry App-owned control-plane slot',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/sections/settingsNav.tsx',
    settingsNavExpected,
    'Active shell settings navigation App-owned control-plane slot',
  );
  const settingsModal = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/index.tsx',
    settingsModalExpected,
    'Active shell settings modal App-owned control-plane slot',
  );
  assertTextExcludesAll(settingsModal, settingsModalForbidden, 'Active shell settings modal legacy ordinary settings entry');
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/SettingsHost.tsx',
    settingsHostExpected,
    'Active shell SettingsHost App-owned registry consumer',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/SettingsShellAdapterSlot.tsx',
    settingsShellAdapterSlotExpected,
    'Active shell SettingsShellAdapterSlot App-owned slot renderer',
  );
  const settingsFooter = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/SiderFooter.tsx',
    settingsFooterExpected,
    'Active shell Settings footer account and App update controls',
  );
  assertTextExcludesAll(
    settingsFooter,
    settingsFooterForbidden,
    'Active shell Settings footer secondary navigation and retired theme control',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/contents/AppearanceModalContent.tsx',
    settingsAppearanceExpected,
    'Active shell Settings three-state appearance controls',
  );
  assertTextExcludesAll(
    settingsAppearance,
    settingsAppearanceForbidden,
    'Active shell Settings retired CSS theme preset surface',
  );
  assertTextExcludesAll(
    settingsAppearance,
    ['@fortawesome', "size='18'"],
    'Active shell Settings navigation icon library and geometry',
  );
  const settingsSider = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/components/SettingsSider.tsx',
  );
  assertTextExcludesAll(
    settingsSider,
    settingsSiderReturnForbidden,
    'Active shell retired Settings sider Back to app control',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Titlebar/index.tsx',
    settingsTitlebarReturnExpected,
    'Active shell narrow Settings titlebar Back to app resolver',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/accessProjection.ts',
    ['const hanCharacter = name.match(/\\p{Script=Han}/u)?.[0]', 'if (hanCharacter) return hanCharacter'],
    'Active shell account identity initials policy',
  );
}

function validateConversationVisualImplementation(shellPaths) {
  const markdown = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/Markdown/ShadowView.tsx',
    conversationMarkdownExpected,
    'Active shell Codex-aligned conversation Markdown typography',
  );
  assertTextExcludesAll(
    markdown,
    ["isMobile ? '19.6px'", "isMobile ? 'var(--chat-font-size, 14px)'"],
    'Active shell viewport-independent conversation typography',
  );
  const messageText = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/components/MessageText.tsx',
    conversationMessageExpected,
    'Active shell compact hover-only message actions',
  );
  assertTextExcludesAll(messageText, ["classNames('h-32px"], 'Active shell retired 32px message action spacer');
  const messageStyles = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/messages.css',
    conversationMessageStylesExpected,
    'Active shell viewport-independent plain-text message typography',
  );
  assertTextExcludesAll(
    messageStyles,
    ['font-size: 14px !important;', 'line-height: 1.4 !important;'],
    'Active shell retired narrow-window message typography override',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolGroupSummary.tsx',
    conversationToolSummaryExpected,
    'Active shell localized tool disclosure row',
  );
  const toolStyles = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolGroupSummary.css',
    ['padding: 6px 0 0;', 'margin-left: 20px;'],
    'Active shell unframed tool disclosure body',
  );
  assertTextExcludesAll(
    toolStyles,
    ['background: color-mix(in srgb, var(--aou-1)', "[data-theme='dark'] .tool-group-summary__body"],
    'Active shell retired tool disclosure card background',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/base/FileChangesPanel.tsx',
    conversationFileChangesExpected,
    'Active shell compact file-change disclosure variant',
  );
  const thinkingStyles = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/components/MessageThinking.module.css',
    ['border-left: 2px solid var(--color-border-2);'],
    'Active shell unframed process disclosure body',
  );
  assertTextExcludesAll(
    thinkingStyles,
    ['background: color-mix(in srgb, var(--aou-1)'],
    'Active shell retired process disclosure card background',
  );
  const messageList = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/MessageList.tsx',
    conversationSkeletonExpected,
    'Active shell unframed conversation loading skeleton',
  );
  assertTextExcludesAll(
    messageList,
    ["border: '1px solid var(--color-border-2)'"],
    'Active shell retired bordered message skeleton',
  );
}

function validateTeamRouteDisablement(shellPaths) {
  const router = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/Router.tsx');
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/config/constants.ts',
    ['export const TEAM_MODE_ENABLED = false'],
    'Active shell ordinary GUI upstream AionUI Team mode default',
  );
  if (!router.includes('TEAM_MODE_ENABLED ? withRouteFallback(TeamIndex) : <Navigate to=\'/guid\' replace />')) {
    throw new Error('Active shell router must redirect /team routes when Team mode is disabled');
  }
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Router.tsx',
    [
      'LEGACY_SETTINGS_ROUTE_REDIRECTS',
      'Object.entries(LEGACY_SETTINGS_ROUTE_REDIRECTS)',
      "targetPath !== `/settings/${legacyId}`",
      'renderSettingsRedirect',
      'const path = `/settings/${legacyId}`',
      'path={path}',
      'element={<Navigate to={targetPath} replace />}',
    ],
    'Active shell router registry-driven legacy settings redirects',
  );
}

function validateTeamSurfaceDisablement(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/index.tsx',
    teamSurfaceExpected,
    'Active shell Sider TeamSiderSection gate behind TEAM_MODE_ENABLED',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/team/hooks/useTeamCreatedRedirect.ts',
    teamCreatedRedirectExpected,
    'Active shell Team created redirect hook disabled Team mode no-op',
  );
  const deepLink = readShellText(shellPaths, 'packages/desktop/src/renderer/hooks/system/useDeepLink.ts');
  if (deepLink.includes('/^\\/team\\/[^/]+$/')) {
    throw new Error('Active shell deep links must not whitelist Team routes for ordinary OPL App');
  }
}

function validateOrdinaryCapabilityScrub(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/config/oplProductProfile/index.ts',
    ordinaryCapabilityFilterExpected,
    'Active shell ordinary capability filter disabled Team MCP state',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/adapter/ipcBridge.ts',
    teamIpcBridgeExpected,
    'Active shell Team IPC bridge disabled Team mutations before HTTP',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx',
    [
      'sanitizeOplOrdinaryConversationExtra',
      'extra: sanitizeOplOrdinaryConversationExtra(sourceExtra)',
      'loadedMcpServers={(ordinaryExtra as { mcp_servers?: string[] } | undefined)?.mcp_servers}',
      'loadedMcpStatuses={(ordinaryExtra as { mcp_statuses?: IConversationMcpStatus[] } | undefined)?.mcp_statuses}',
    ],
    'Active shell ordinary conversations Team MCP snapshots',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/common-config/oplProductProfile.test.ts',
    [
      'scrubs AionUI Team MCP state from ordinary OPL conversation snapshots',
      'sanitizeOplOrdinaryConversationExtra',
      "team_lead_conversation_id: 'conversation-1'",
      'session_mcp_servers: []',
    ],
    'Active shell ordinary conversation Team MCP scrub regression',
  );
}

export function validateShellSettingsAndTeamImplementation(shellPaths) {
  validateSettingsPartitionImplementation(shellPaths);
  validateConversationVisualImplementation(shellPaths);
  validateTeamRouteDisablement(shellPaths);
  validateTeamSurfaceDisablement(shellPaths);
  validateOrdinaryCapabilityScrub(shellPaths);
}
