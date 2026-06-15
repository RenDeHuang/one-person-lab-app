import { legacySettingsRouteRedirects } from './app-contract-constants.ts';
import {
  assertShellTextIncludes,
  readShellText,
} from './shell-implementation-helpers.ts';
import {
  validateShellBrandingAssets,
  validateShellVisibleBranding,
} from './shell-branding-validator.ts';
import { validateFirstRunImplementation } from './shell-first-run-validator.ts';
import { validateShellOrdinaryExperienceImplementation } from './shell-ordinary-experience-validator.ts';
import { validateStandardUpdaterImplementation } from './shell-standard-updater-validator.ts';

export function validateActiveShellImplementation(shellPaths) {
  if (shellPaths.contract.shell_contract?.implementation_validation === 'contract_paths_only') {
    return;
  }

  const i18nConfig = JSON.parse(
    readShellText(shellPaths, 'packages/desktop/src/common/config/i18n-config.json'),
  );
  const supportedLanguages = Array.isArray(i18nConfig.supportedLanguages)
    ? i18nConfig.supportedLanguages.filter((language) => typeof language === 'string')
    : [];
  const requiresLocale = (language) => supportedLanguages.includes(language);
  const appStateHook = assertShellTextIncludes(
    shellPaths,
    'packages/desktop/src/renderer/hooks/system/useOplAppState.ts',
    'ipcBridge.oplRuntime.getAppState.invoke({ profile })',
    'OPL App state hook',
  );
  for (const forbidden of ['shell.runOplCommand', 'application.systemInfo']) {
    if (appStateHook.includes(forbidden)) {
      throw new Error(`Active shell OPL App state hook must not use ${forbidden}`);
    }
  }

  const runtimeBridge = readShellText(shellPaths, 'packages/desktop/src/process/bridge/oplRuntimeBridge.ts');
  for (const expected of [
    "args: ['app', 'state', '--profile', profile, '--json']",
    "args: ['runtime', 'app-operator-drilldown', '--json']",
    "args: ['runtime', 'app-operator-drilldown', '--detail', 'full', '--json']",
    "['app', 'action', 'execute', '--action', assertActionId(request.actionId)]",
  ]) {
    if (!runtimeBridge.includes(expected)) {
      throw new Error(`Active shell runtime bridge must implement canonical surface: ${expected}`);
    }
  }

  const systemSettings = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/contents/SystemModalContent/index.tsx',
  );
  for (const expected of [
    "useOplAppState('fast')",
    "actionId: 'workspace_root_set'",
    'workspace_root_path',
    'selected_path',
    'logs_dir',
    'opl_flow_context',
    'settings.oplFlowContext',
  ]) {
    if (!systemSettings.includes(expected)) {
      throw new Error(`Active shell System settings must implement ${expected}`);
    }
  }
  for (const forbidden of [
    'application.updateSystemInfo.invoke',
    'shell.runOplCommand.invoke',
  ]) {
    if (systemSettings.includes(forbidden)) {
      throw new Error(`Active shell System settings must not use legacy OPL truth/action source ${forbidden}`);
    }
  }
  for (const expected of [
    'const appPaths = oplRecord(appState.paths)',
    'oplString(appPaths.workspace_root_path)',
    'oplPathString(appPaths.workspace_root)',
    'oplString(appPaths.logs_dir)',
  ]) {
    if (!systemSettings.includes(expected)) {
      throw new Error(`Active shell System settings must derive visible OPL paths from app_state.paths: ${expected}`);
    }
  }

  validateShellVisibleBranding(shellPaths, requiresLocale);

  const zhCnFirstRun = readShellText(shellPaths, 'packages/desktop/src/renderer/services/i18n/locales/zh-CN/settings.json');
  for (const [locale, text] of [
    ['zh-CN', zhCnFirstRun],
    ...(requiresLocale('zh-TW')
      ? [
          [
            'zh-TW',
            readShellText(shellPaths, 'packages/desktop/src/renderer/services/i18n/locales/zh-TW/settings.json'),
          ],
        ]
      : []),
  ]) {
    for (const expected of ['"firstRun"', 'One Person Lab', 'Codex']) {
      if (!text.includes(expected)) {
        throw new Error(`Active shell ${locale} first-run locale must include ${expected}`);
      }
    }
    const settingsLocale = JSON.parse(text);
    const firstRunLocaleText = JSON.stringify(settingsLocale.firstRun ?? {});
    const firstLaunchLocaleText = JSON.stringify(settingsLocale.oplFirstLaunch ?? {});
    const firstRunSetupText = `${firstRunLocaleText}\n${firstLaunchLocaleText}`;
    for (const forbidden of [
      '"title": "Prepare One Person Lab"',
      '"wizardTitle": "Prepare One Person Lab"',
      'Checking the essentials',
      'Ready to start',
      'Codex API 配置',
      'Codex API Key',
      'Codex API Configuration',
      'Needs setup',
    ]) {
      if (firstRunSetupText.includes(forbidden)) {
        throw new Error(`Active shell ${locale} first-run locale must not expose English fallback ${forbidden}`);
      }
    }
  }

  const zhCnUpdate = readShellText(shellPaths, 'packages/desktop/src/renderer/services/i18n/locales/zh-CN/update.json');
  for (const [locale, text] of [
    ['zh-CN', zhCnUpdate],
    ...(requiresLocale('zh-TW')
      ? [
          [
            'zh-TW',
            readShellText(shellPaths, 'packages/desktop/src/renderer/services/i18n/locales/zh-TW/update.json'),
          ],
        ]
      : []),
  ]) {
    if (!text.includes('GitHub API')) {
      throw new Error(`Active shell ${locale} update locale must keep GitHub API error context localized.`);
    }
    for (const forbidden of [
      'GitHub API request failed',
      'GitHub API response was not a release list',
      'Update check returned no result',
    ]) {
      if (text.includes(forbidden)) {
        throw new Error(`Active shell ${locale} update locale must not expose English update fallback ${forbidden}`);
      }
    }
  }

  const runtimeSettings = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/settings/RuntimeSettings/index.tsx');
  for (const expected of [
    "ipcBridge.oplRuntime.getAppState.invoke({ profile: 'fast' })",
    "ipcBridge.oplRuntime.getAppState.invoke({ profile: 'full' })",
    "ipcBridge.oplRuntime.getDrilldown.invoke({ detail: 'full' })",
    'normalizeRuntimeProjection',
    'payloadRefsOnlyJson',
  ]) {
    if (!runtimeSettings.includes(expected)) {
      throw new Error(`Active shell Runtime settings must implement ${expected}`);
    }
  }
  if (/med[-_ ]?deep[-_ ]?scientist|module_id['"]?\s*:\s*['"]mds['"]/i.test(runtimeSettings)) {
    throw new Error('Active shell Runtime settings must not default-display Med Deep Scientist/MDS.');
  }

  const trayStartup = readShellText(shellPaths, 'packages/desktop/src/process/startup/trayStartup.ts');
  for (const expected of [
    'export async function initializeTrayForDesktopMode',
    'deps.createOrUpdateTray()',
    'deps.destroyTray()',
    'deps.setCloseToTrayEnabled(false)',
  ]) {
    if (!trayStartup.includes(expected)) {
      throw new Error(`Active shell desktop tray startup must implement App-owned tray policy: ${expected}`);
    }
  }
  if (trayStartup.includes('if (deps.getCloseToTrayEnabled())') || trayStartup.includes('if (getCloseToTrayEnabled())')) {
    throw new Error('Active shell desktop tray visibility must not be gated on close-to-tray setting.');
  }

  const desktopMain = readShellText(shellPaths, 'packages/desktop/src/index.ts');
  for (const expected of [
    'initializeTrayForDesktopMode',
    'readCloseToTray: readCloseToTraySetting',
    'createOrUpdateTray',
    'destroyTray',
  ]) {
    if (!desktopMain.includes(expected)) {
      throw new Error(`Active shell desktop startup must wire App-owned tray policy: ${expected}`);
    }
  }
  const closeToTraySetting = readShellText(shellPaths, 'packages/desktop/src/process/utils/closeToTraySetting.ts');
  for (const expected of [
    "const CLOSE_TO_TRAY_CONFIG_KEY = 'system.closeToTray'",
    'await ProcessConfig.get(CLOSE_TO_TRAY_CONFIG_KEY)',
    'await ProcessConfig.set(CLOSE_TO_TRAY_CONFIG_KEY, enabled)',
  ]) {
    if (!closeToTraySetting.includes(expected)) {
      throw new Error(`Active shell close-to-tray settings bridge must preserve App-owned tray preference key: ${expected}`);
    }
  }

  const settingsNav = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/settings/sections/settingsNav.tsx');
  for (const expected of [
    'getOplGuiSettingsVisibleTabs',
    'getOplGuiLegacySettingsRouteRedirects',
    'SETTINGS_DEFAULT_ROUTE = \'/settings/general\'',
    "if (legacyId === 'skills-hub') return '/settings/capabilities?tab=skills'",
    "if (legacyId === 'tools') return '/settings/capabilities?tab=tools'",
    'LEGACY_SETTINGS_ROUTE_REDIRECTS',
    'LEGACY_ANCHOR_REMAP',
  ]) {
    if (!settingsNav.includes(expected)) {
      throw new Error(`Active shell settings navigation must derive App-owned settings partition: ${expected}`);
    }
  }

  const settingsModal = readShellText(shellPaths, 'packages/desktop/src/renderer/components/settings/SettingsModal/index.tsx');
  for (const expected of [
    'getOplGuiSettingsVisibleTabs',
    'getOplGuiLegacySettingsRouteRedirects',
    "defaultTab = 'general'",
    '<OverviewSettings withWrapper={false} />',
    '<RuntimeSettings withWrapper={false} />',
    '<CapabilitiesSettingsContent activeTab={capabilitiesTab} onTabChange={setCapabilitiesTab} />',
    '<AccessSettingsContent />',
    '<AppearanceModalContent />',
  ]) {
    if (!settingsModal.includes(expected)) {
      throw new Error(`Active shell settings modal must implement App-owned settings partition: ${expected}`);
    }
  }
  for (const forbidden of [
    'ModelModalContent',
    'AgentModalContent',
    "label: t('settings.model')",
    "label: t('settings.tools')",
    "label: t('settings.webui')",
  ]) {
    if (settingsModal.includes(forbidden)) {
      throw new Error(`Active shell settings modal must not expose legacy ordinary settings entry ${forbidden}`);
    }
  }

  const router = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/Router.tsx');
  const constants = readShellText(shellPaths, 'packages/desktop/src/common/config/constants.ts');
  if (!constants.includes('export const TEAM_MODE_ENABLED = false')) {
    throw new Error('Active shell ordinary GUI must disable upstream AionUI Team mode by default');
  }
  if (!router.includes('TEAM_MODE_ENABLED ? withRouteFallback(TeamIndex) : <Navigate to=\'/guid\' replace />')) {
    throw new Error('Active shell router must redirect /team routes when Team mode is disabled');
  }
  for (const [legacyId, targetId] of Object.entries(legacySettingsRouteRedirects)) {
    const expectedTarget =
      legacyId === 'skills-hub'
        ? '/settings/capabilities?tab=skills'
        : legacyId === 'tools'
          ? '/settings/capabilities?tab=tools'
          : `/settings/${targetId}`;
    const expectedRoute = `path='/settings/${legacyId}' element={<Navigate to='${expectedTarget}' replace />}`;
    if (!router.includes(expectedRoute)) {
      throw new Error(`Active shell router must redirect legacy settings route ${legacyId} to ${expectedTarget}`);
    }
  }
  const sider = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/Sider/index.tsx');
  if (!sider.includes('{TEAM_MODE_ENABLED && (') || !sider.includes('<TeamSiderSection')) {
    throw new Error('Active shell Sider must gate TeamSiderSection behind TEAM_MODE_ENABLED');
  }
  const teamRedirect = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/team/hooks/useTeamCreatedRedirect.ts');
  if (!teamRedirect.includes('if (!TEAM_MODE_ENABLED)') || !teamRedirect.includes('return undefined')) {
    throw new Error('Active shell Team created redirect hook must no-op when Team mode is disabled');
  }
  const oplProductProfile = readShellText(shellPaths, 'packages/desktop/src/common/config/oplProductProfile/index.ts');
  for (const expected of [
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
  ]) {
    if (!oplProductProfile.includes(expected)) {
      throw new Error(`Active shell ordinary capability filter must scrub disabled Team MCP state: ${expected}`);
    }
  }
  const ipcBridge = readShellText(shellPaths, 'packages/desktop/src/common/adapter/ipcBridge.ts');
  for (const expected of [
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
  ]) {
    if (!ipcBridge.includes(expected)) {
      throw new Error(`Active shell Team IPC bridge must reject disabled Team mutations before HTTP: ${expected}`);
    }
  }
  const ordinaryChatConversation = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx',
  );
  for (const expected of [
    'sanitizeOplOrdinaryConversationExtra',
    'extra: sanitizeOplOrdinaryConversationExtra(sourceExtra)',
    'loadedMcpServers={(ordinaryExtra as { mcp_servers?: string[] } | undefined)?.mcp_servers}',
    'loadedMcpStatuses={(ordinaryExtra as { mcp_statuses?: IConversationMcpStatus[] } | undefined)?.mcp_statuses}',
  ]) {
    if (!ordinaryChatConversation.includes(expected)) {
      throw new Error(`Active shell ordinary conversations must not pass Team MCP snapshots through: ${expected}`);
    }
  }
  const agentSetupCard = readShellText(shellPaths, 'packages/desktop/src/renderer/components/agent/AgentSetupCard.tsx');
  for (const expected of [
    'sanitizeOplOrdinaryConversationExtra',
    'filterOplOrdinarySessionMcpServers',
    'selected_mcp_server_ids: undefined',
    'selected_session_mcp_servers: sessionMcpServers?.length ? sessionMcpServers : undefined',
  ]) {
    if (!agentSetupCard.includes(expected)) {
      throw new Error(`Active shell agent switching must not inherit disabled Team MCP state: ${expected}`);
    }
  }
  const deepLink = readShellText(shellPaths, 'packages/desktop/src/renderer/hooks/system/useDeepLink.ts');
  if (deepLink.includes('/^\\/team\\/[^/]+$/')) {
    throw new Error('Active shell deep links must not whitelist Team routes for ordinary OPL App');
  }

  validateStandardUpdaterImplementation(shellPaths);
  validateFirstRunImplementation(shellPaths);
  validateShellOrdinaryExperienceImplementation(shellPaths);

  const presets = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets.ts');
  if (!presets.includes("export const CODEX_THEME_ID = 'codex'")) {
    throw new Error('Active shell theme presets must expose CODEX_THEME_ID=codex.');
  }
  if (!presets.includes("opl-codex.css?raw")) {
    throw new Error('Active shell theme presets must load the current App-owned Codex CSS payload.');
  }
  const codexCss = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/opl-codex.css',
  );
  for (const expected of ['--opl-codex-sidebar-bg', '--opl-codex-surface', '--opl-codex-focus-ring']) {
    if (!codexCss.includes(expected)) {
      throw new Error(`Active shell OPL Codex CSS must include ${expected}`);
    }
  }
  for (const forbidden of ['Retroma', 'aurora', 'Palatino']) {
    if (codexCss.includes(forbidden)) {
      throw new Error(`Active shell OPL Codex CSS must not include legacy theme marker ${forbidden}`);
    }
  }

  const about = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/contents/AboutModalContent.tsx',
  );
  for (const expected of ['useOplAppState', 'guiVersion', 'frameworkRevision', 'includeNightlyUpdates']) {
    if (!about.includes(expected)) {
      throw new Error(`Active shell About page must implement ${expected}`);
    }
  }
  if (/AionUI version|Aion UI version/.test(about)) {
    throw new Error('Active shell About page must not present AionUI as the App version.');
  }

  validateShellBrandingAssets(shellPaths);
}
