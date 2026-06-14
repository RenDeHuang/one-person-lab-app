import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { commandMaxBuffer, assertFile } from './validation-config.ts';
import {
  beginnerFirstRunTestIds,
  legacySettingsRouteRedirects,
} from './app-contract-constants.ts';

function readShellText(shellPaths, relativePath) {
  const filePath = path.join(shellPaths.shellRoot, relativePath);
  assertFile(filePath, `active shell implementation file ${relativePath}`);
  return readFileSync(filePath, 'utf8');
}

function readShellJson(shellPaths, relativePath, label) {
  const text = readShellText(shellPaths, relativePath);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Active shell ${label} must be valid JSON: ${error.message}`);
  }
}

function assertShellTextIncludes(shellPaths, relativePath, expected, label) {
  const text = readShellText(shellPaths, relativePath);
  if (!text.includes(expected)) {
    throw new Error(`Active shell ${label} must include ${expected} in ${relativePath}`);
  }
  return text;
}

function assertShellTextExcludes(shellPaths, relativePath, forbidden, label) {
  const text = readShellText(shellPaths, relativePath);
  if (text.includes(forbidden)) {
    throw new Error(`Active shell ${label} must not include ${forbidden} in ${relativePath}`);
  }
  return text;
}

function assertShellFileHash(shellPaths, relativePath, expectedHash, label) {
  const filePath = path.join(shellPaths.shellRoot, relativePath);
  assertFile(filePath, label);
  const result = spawnSync('shasum', ['-a', '256', filePath], {
    encoding: 'utf8',
    maxBuffer: commandMaxBuffer,
  });
  if (result.error) {
    throw new Error(`Failed to hash ${label}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Failed to hash ${label}: ${result.stderr.trim()}`);
  }
  const actualHash = result.stdout.trim().split(/\s+/)[0];
  if (actualHash !== expectedHash) {
    throw new Error(`Active shell ${label} hash must be ${expectedHash}; got ${actualHash}`);
  }
}

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

  for (const [relativePath, forbidden] of [
    ['packages/desktop/src/renderer/services/i18n/locales/en-US/login.json', '"brand": "AionUi"'],
    ['packages/desktop/src/renderer/services/i18n/locales/zh-CN/login.json', '"brand": "AionUi"'],
    ['packages/desktop/src/common/api/ClientFactory.ts', "'X-Title': 'AionUi'"],
    ['packages/desktop/src/common/utils/appConfig.ts', "|| 'AionUi'"],
    ['packages/desktop/src/common/platform/index.ts', 'AionUi-Dev'],
    ...(requiresLocale('zh-TW')
      ? [['packages/desktop/src/renderer/services/i18n/locales/zh-TW/login.json', '"brand": "AionUi"']]
      : []),
  ]) {
    const text = readShellText(shellPaths, relativePath);
    if (text.includes(forbidden)) {
      throw new Error(`Active shell visible OPL branding must not expose ${forbidden} in ${relativePath}`);
    }
  }

  for (const [relativePath, expected] of [
    ['packages/desktop/src/renderer/services/i18n/locales/en-US/login.json', '"brand": "One Person Lab"'],
    ['packages/desktop/src/renderer/services/i18n/locales/zh-CN/login.json', '"brand": "One Person Lab"'],
    ['packages/desktop/src/common/api/ClientFactory.ts', "'X-Title': 'One Person Lab App'"],
    ['packages/desktop/src/common/utils/appConfig.ts', "|| 'One Person Lab App'"],
    ['packages/desktop/src/common/platform/index.ts', 'OnePersonLab-Dev'],
    ...(requiresLocale('zh-TW')
      ? [['packages/desktop/src/renderer/services/i18n/locales/zh-TW/login.json', '"brand": "One Person Lab"']]
      : []),
  ]) {
    const text = readShellText(shellPaths, relativePath);
    if (!text.includes(expected)) {
      throw new Error(`Active shell visible OPL branding must include ${expected} in ${relativePath}`);
    }
  }

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

  const autoUpdaterService = readShellText(shellPaths, 'packages/desktop/src/process/services/autoUpdaterService.ts');
  for (const expected of [
    'recordAutoUpdateInstallNotAppliedIfNeeded',
    'recordAutoUpdateQuitAndInstall',
    'recordAutoUpdateStatus',
    'resolveLocalAuthorizedMacosUpdatePlan',
    'launchLocalAuthorizedMacosInstaller(plan)',
    'params?.file_path',
    'autoUpdater.quitAndInstall(true, true)',
  ]) {
    if (!autoUpdaterService.includes(expected)) {
      throw new Error(`Active shell standard updater must distinguish downloaded/apply/applied states: ${expected}`);
    }
  }
  const autoUpdateDiagnostics = readShellText(shellPaths, 'packages/desktop/src/process/services/autoUpdateDiagnostics.ts');
  for (const expected of [
    "'quit-and-install'",
    "'install-not-applied'",
    'current_version_lower_than_downloaded_after_quit_and_install',
    'semver.gte(normalizedCurrent, normalizedTarget)',
  ]) {
    if (!autoUpdateDiagnostics.includes(expected)) {
      throw new Error(`Active shell updater diagnostics must detect failed post-restart version switch: ${expected}`);
    }
  }
  const localAuthorizedUpdater = readShellText(
    shellPaths,
    'packages/desktop/src/process/services/localAuthorizedMacosUpdater.ts',
  );
  for (const expected of [
    'local-authorized-updater',
    'local-authorized-updater-diagnostics.json',
    'unzip -q "$update_zip_path"',
    'find "$staging_root" -maxdepth 3 -type d -name "One Person Lab.app"',
    'ditto "$source_app" "$app_path"',
    'xattr -dr com.apple.quarantine "$app_path"',
    'write_diagnostics "installed"',
    'open "$app_path"',
  ]) {
    if (!localAuthorizedUpdater.includes(expected)) {
      throw new Error(`Active shell macOS updater recovery must use the downloaded ZIP to replace the App bundle: ${expected}`);
    }
  }

  const firstRunPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/index.tsx');
  for (const expected of [
    'ipcBridge.oplRuntime.getInitialize.invoke()',
    'readInitializePayload',
    'shouldEnterGuidAutomatically',
    "initialize?.setup_flow?.is_first_run !== false",
    'initialize.setup_flow.ready_to_launch === true',
    'initialize.readiness?.launch_ready === true',
    "navigate('/guid',",
    'postInstallSelfCheck',
    'POST_INSTALL_SELF_CHECK_STATE',
    "navigate('/guid', { state: POST_INSTALL_SELF_CHECK_STATE })",
    "document.title = 'One Person Lab App'",
    'formatFullReadinessProgressText',
    'formatMaintenanceProgressText',
    'findNextVisibleStep',
    "data-testid='opl-first-run-stage'",
    "data-testid='opl-first-run-core-progress'",
    "data-testid='opl-first-run-full-readiness-progress'",
    "data-testid='opl-first-run-maintenance-progress'",
    "data-testid='opl-first-run-next-step'",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun page must render shared initialize progress: ${expected}`);
    }
  }
  if (firstRunPage.includes("ipcBridge.oplRuntime.getAppState.invoke({ profile: 'fast' })")) {
    throw new Error('Active shell FirstRun page must not auto-enter /guid from fast App state; use opl system initialize first-run setup_flow');
  }
  for (const expected of beginnerFirstRunTestIds.map((id) => `data-testid='${id}'`)) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun page must implement beginner first-run surface ${expected}`);
    }
  }
  if (!firstRunPage.includes("data-testid='opl-first-run-background-maintenance-secondary'")) {
    throw new Error('Active shell FirstRun page must keep background maintenance available in technical details');
  }
  const firstRunProgressStart = firstRunPage.indexOf("data-testid='opl-first-run-progress'");
  const technicalDetailsStart = firstRunPage.indexOf('<Collapse', firstRunProgressStart);
  const backgroundMaintenanceIndex = firstRunPage.indexOf("data-testid='opl-first-run-background-maintenance-secondary'");
  if (
    firstRunProgressStart < 0 ||
    technicalDetailsStart < 0 ||
    backgroundMaintenanceIndex < 0 ||
    (backgroundMaintenanceIndex > firstRunProgressStart && backgroundMaintenanceIndex < technicalDetailsStart)
  ) {
    throw new Error('Active shell FirstRun page must keep background maintenance out of the beginner primary area');
  }
  for (const expected of [
    'formatItemLabel',
    'formatItemSummary',
    'formatNextVisibleStep',
    'ITEM_LABEL_KEYS',
    'ITEM_SUMMARY_KEYS',
    'NEXT_STEP_KEYS',
    "t('settings.firstRun.nextSteps.generic')",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun page must map technical initialize text to App-owned beginner copy: ${expected}`);
    }
  }
  for (const forbidden of ['item?.label ?? label', 'item?.detail_summary ?? item?.next_visible_step']) {
    if (firstRunPage.includes(forbidden)) {
      throw new Error(`Active shell FirstRun beginner primary area must not directly render initialize fallback text: ${forbidden}`);
    }
  }

  const firstRunModel = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/initializeModel.ts');
  for (const expected of [
    'ready_full_readiness_count',
    'total_full_readiness_count',
    'ready_optional_count',
    'total_optional_count',
    'next_visible_step',
  ]) {
    if (!firstRunModel.includes(expected)) {
      throw new Error(`Active shell FirstRun model must consume shared initialize progress field ${expected}`);
    }
  }

  const guidPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/GuidPage.tsx');
  const guidInputCard = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx');
  for (const expected of [
    "document.title = 'One Person Lab App'",
    "t('conversation.welcome.placeholder')",
    'getOplModelStatusDisplayText',
    "data-testid='opl-home-model-status'",
    "t('guid.postInstallSelfCheck.prompt'",
    'POST_INSTALL_SELF_CHECK_PROMPT_DEFAULTS',
    'postInstallSelfCheckRequested',
    "navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null })",
    'AssistantSelectionArea',
    'GuidModelSelector',
    'MentionSelectorBadge',
    'selectedAgentLabelOverride',
    'onClear={() =>',
  ]) {
    if (!guidPage.includes(expected)) {
      throw new Error(`Active shell Guid home must implement ${expected}`);
    }
  }
  for (const [locale, expectedStrings] of Object.entries({
    'zh-CN': ['安装后智能自检', '程序化初始化已经完成', '不要覆盖用户已有的 AGENTS.md', '模块自动更新'],
    'en-US': ['Post-install intelligent self-check', 'Programmatic initialization has completed', "Do not overwrite the user's AGENTS.md", 'module auto-update'],
  })) {
    const localeText = readShellText(shellPaths, `packages/desktop/src/renderer/services/i18n/locales/${locale}/guid.json`);
    for (const expected of expectedStrings) {
      if (!localeText.includes(expected)) {
        throw new Error(`Active shell ${locale} Guid locale must include post-install self-check copy: ${expected}`);
      }
    }
  }
  for (const forbidden of [
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
  ]) {
    if (guidPage.includes(forbidden) || guidInputCard.includes(forbidden)) {
      throw new Error(`Active shell ordinary Home must not render or query runtime activity: ${forbidden}`);
    }
  }
  for (const forbidden of ["data-testid='guid-activity-center'", 'guid.activity.needsAttention', 'guid.activity.recentProjects']) {
    if (guidInputCard.includes(forbidden)) {
      throw new Error(`Active shell ordinary Home must not render expanded activity groups near input: ${forbidden}`);
    }
  }
  for (const forbidden of ['artifact_body', 'memory_body', 'domain_artifact_body']) {
    if (guidInputCard.includes(forbidden)) {
      throw new Error(`Active shell Guid composer must not render domain artifact or memory bodies: ${forbidden}`);
    }
  }

  const guidAgentSelection = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidAgentSelection.ts',
  );
  for (const expected of [
    'getOplDefaultExecutorAgentKey',
    'resolveOplDefaultAgentKey(undefined)',
    "agent_type: assistant.preset_agent_type || getOplDefaultExecutorAgentKey()",
    'useState<string>(CODEX_MODE_NATIVE_FULL_ACCESS)',
  ]) {
    if (!guidAgentSelection.includes(expected)) {
      throw new Error(`Active shell Guid agent selection must implement App-owned default ${expected}`);
    }
  }

  const productProfile = readShellText(
    shellPaths,
    'packages/desktop/src/common/config/oplProductProfile/oplProductProfile.generated.json',
  );
  const productProfileJson = readShellJson(
    shellPaths,
    'packages/desktop/src/common/config/oplProductProfile/oplProductProfile.generated.json',
    'product profile',
  );
  const frontierModelPreferenceOrder =
    productProfileJson?.gui?.home?.codex_auto_model_selection?.frontier_model_preference_order;
  const expectedFrontierModelPreferenceOrder = ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2'];
  if (
    JSON.stringify(frontierModelPreferenceOrder) !==
      JSON.stringify(expectedFrontierModelPreferenceOrder)
  ) {
    throw new Error(
      `Active shell product profile must carry App Codex default frontier_model_preference_order=${JSON.stringify(expectedFrontierModelPreferenceOrder)}`,
    );
  }
  for (const expected of [
    '"default_model": "gpt-5.5"',
    '"default_reasoning_effort": "xhigh"',
    '"codex_cli_fixed_executor": true',
    '"home_executor_selector_visible": false',
    '"codex_model_selector_visible": true',
    '"codex_model_list_visible": true',
    '"codex_model_policy": "codex_cli_latest_strongest_model_selector_visible"',
    '"codex_model_auto_option_visible": true',
    '"codex_default_model": "gpt-5.5"',
    '"codex_home_model_status_label": "GPT-5.5（超高）"',
    '"codex_precise_model_display_policy": "friendly_default_model_and_reasoning_visible"',
    '"strategy": "codex_cli_auto_latest_available_frontier"',
    '"user_can_override_model": true',
    '"user_can_restore_auto": true',
    '"display_policy": "friendly_model_name_and_reasoning_for_every_visible_option"',
    '"raw_model_id_visible_in_ordinary_ui": false',
    '"reasoning_effort_visible_for_every_option": true',
    '"label_zh": "自动（推荐）"',
    '"description_zh": "当前 GPT-5.5 · 推理超高 · 跟随最新最强"',
    '"label_zh": "GPT-5.3 Codex"',
    '"id": "mas"',
    '"id": "mag"',
    '"id": "rca"',
    '"id": "oma"',
    '"assistant_skill_profiles"',
    '"required_skills"',
    '"skill_menu_policy": "assistant_scoped_required_checked_optional_visible"',
    '"default_packaged_codex_skill_ids"',
  ]) {
    if (!productProfile.includes(expected)) {
      throw new Error(`Active shell product profile must carry App Codex default ${expected}`);
    }
  }

  const codexModels = readShellText(shellPaths, 'packages/desktop/src/common/types/codex/codexModels.ts');
  for (const expected of [
    'getOplCodexFrontierModelPreferenceOrder',
    'DEFAULT_CODEX_MODELS',
    'availableModels.length > 0',
    'DEFAULT_CODEX_MODELS.map',
    'available_models: visibleModels',
  ]) {
    if (!codexModels.includes(expected)) {
      throw new Error(`Active shell Codex model policy must expose App-owned default options before ACP handshake: ${expected}`);
    }
  }

  const guidAssistants = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/oplHomeAssistants.ts');
  for (const expected of [
    'getOplDefaultExecutorAgentKey',
    'getOplDefaultHomeAssistants',
    'getOplAssistantSkillProfile',
    'resolveOplHomeAssistants',
    'const DEFAULT_PRESET_AGENT_TYPE = getOplDefaultExecutorAgentKey()',
    'preset_agent_type: DEFAULT_PRESET_AGENT_TYPE',
    'enabled_skills',
    'custom_skill_names',
    'disabled_builtin_skills',
  ]) {
    if (!guidAssistants.includes(expected)) {
      throw new Error(`Active shell Guid assistants must consume App-owned assistant/default signal ${expected}`);
    }
  }
  if (/mds|Med Deep Scientist/.test(guidAssistants)) {
    throw new Error('Active shell Guid profile must not include MDS as a default home assistant.');
  }

  for (const expected of [
    'selectedAssistantRequiredSkills',
    'selectedAssistantSkillProfile',
    'effectiveGuidEnabledSkills',
    'mergeRequiredSkills',
    'buildAssistantScopedSkillMenuItems',
    'guidEnabledSkills: effectiveGuidEnabledSkills',
  ]) {
    if (!guidPage.includes(expected)) {
      throw new Error(`Active shell Guid page must enforce App assistant skill profile rule ${expected}`);
    }
  }

  const guidSkillMenu = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/utils/assistantSkillMenu.ts',
  );
  for (const expected of [
    'buildAssistantScopedSkillMenuItems',
    'mergeRequiredSkills',
    'required_skills',
    'locked: isRequired',
  ]) {
    if (!guidSkillMenu.includes(expected)) {
      throw new Error(`Active shell Guid skill menu must enforce App assistant skill profile rule ${expected}`);
    }
  }

  const guidActionRow = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
  );
  for (const expected of [
    'GuidSkillMenuItem',
    'isGuidSkillChecked',
    'skill.locked',
    'disabled={skill.locked}',
  ]) {
    if (!guidActionRow.includes(expected)) {
      throw new Error(`Active shell Guid action row must lock required assistant skills ${expected}`);
    }
  }

  const guidSend = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts');
  for (const expected of [
    'getOplBuiltinAssistantRouteReceiptPolicy',
    'buildOplAssistantRouteReceipt',
    'opl_assistant_route',
    'preset_enabled_skills',
  ]) {
    if (!guidSend.includes(expected)) {
      throw new Error(`Active shell Guid send must persist App assistant route/skill signal ${expected}`);
    }
  }

  const createConversationParams = readShellText(
    shellPaths,
    'packages/desktop/src/common/utils/buildAgentConversationParams.ts',
  );
  for (const expected of [
    'preset_enabled_skills',
  ]) {
    if (!createConversationParams.includes(expected)) {
      throw new Error(`Active shell create conversation must persist App assistant route/skill signal ${expected}`);
    }
  }

  const acpModelSelector = readShellText(shellPaths, 'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx');
  for (const expected of [
    'useAcpModelInfo',
    'canSwitch',
    'if (!canSwitch)',
  ]) {
    if (!acpModelSelector.includes(expected)) {
      throw new Error(`Active shell ACP model selector must consume fixed Codex model guard ${expected}`);
    }
  }

  const acpModelInfoHook = readShellText(shellPaths, 'packages/desktop/src/renderer/hooks/agent/useAcpModelInfo.ts');
  for (const expected of [
    'isOplCodexCliFixedExecutor',
    'shouldShowOplCodexModelList',
    "backend === 'codex'",
    'shouldShowOplCodexModelList()',
    'canSwitch',
  ]) {
    if (!acpModelInfoHook.includes(expected)) {
      throw new Error(`Active shell ACP model hook must expose App-owned Codex model controls ${expected}`);
    }
  }

  const chatConversation = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx',
  );
  for (const expected of [
    'shouldShowOplConversationModelSelector',
    "extra.backend === 'codex'",
    'AcpModelSelector',
  ]) {
    if (!chatConversation.includes(expected)) {
      throw new Error(`Active shell ordinary Codex conversation must hide model selector ${expected}`);
    }
  }

  const acpSendBox = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx');
  for (const expected of [
    'isOplCodexCliFixedExecutor',
    'getOplModelStatusDisplayText',
    "data-testid='opl-conversation-model-status'",
    'shouldShowOplConversationPermissionModeSelector',
    "backend === 'codex'",
    'const showModeSelector',
    'showModeSelector ?',
    '<ThoughtDisplay running={isBusy}',
  ]) {
    if (!acpSendBox.includes(expected)) {
      throw new Error(`Active shell ordinary Codex conversation must hide permission selector ${expected}`);
    }
  }

  const acpInitialMessage = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/platforms/acp/useAcpInitialMessage.ts',
  );
  for (const expected of [
    "import { warmupConversation } from '../../utils/warmupConversation'",
    'await warmupConversation(conversation_id)',
    'ipcBridge.acpConversation.sendMessage.invoke',
  ]) {
    if (!acpInitialMessage.includes(expected)) {
      throw new Error(`Active shell ACP initial-message flow must warm up before first send: ${expected}`);
    }
  }

  const thoughtDisplay = readShellText(shellPaths, 'packages/desktop/src/renderer/components/chat/ThoughtDisplay.tsx');
  for (const expected of ['formatElapsedTime', "t('conversation.chat.processing')", 'elapsedTime']) {
    if (!thoughtDisplay.includes(expected)) {
      throw new Error(`Active shell ThoughtDisplay must expose elapsed processing feedback ${expected}`);
    }
  }

  const runtimePage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/runtime/index.tsx');
  for (const expected of [
    'const userTaskDrilldown = appStateProjection',
    'workbenchActiveProjectLines(userTaskDrilldown ?? {})',
    'workbenchTaskDrilldowns(userTaskDrilldown ?? {})',
    'const runningTaskCount = runningTasks.length',
    'taskOverview.inactiveTasks.length > 0',
    "t('common.runtime.inactiveTasks')",
  ]) {
    if (!runtimePage.includes(expected)) {
      throw new Error(`Active shell Runtime page must implement user-task-first grouped display: ${expected}`);
    }
  }
  for (const forbidden of [
    '|| activity.activeExecutionCount',
    'fallbackRunningTasks',
    'runtimeActivityProjection',
    '|| project.activeRunId',
  ]) {
    if (runtimePage.includes(forbidden)) {
      throw new Error(`Active shell Runtime page must not derive user running tasks from provider/run fallbacks: ${forbidden}`);
    }
  }

  const skillsHubSettings = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/settings/SkillsHubSettings.tsx');
  for (const expected of [
    'getOplDefaultPackagedCodexSkills',
    'getOplPackagedCodexSkills',
    'appVisibleSkills',
    "skills.filter((skill) => skill.source !== 'builtin' || appVisibleSkills.has(skill.name))",
    'appPackagedSkills',
    'autoSkills.filter((skill) => appPackagedSkills.has(skill.name))',
  ]) {
    if (!skillsHubSettings.includes(expected)) {
      throw new Error(`Active shell SkillsHubSettings must filter upstream builtin skills through App packaged policy ${expected}`);
    }
  }

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

  const indexHtml = readShellText(shellPaths, 'packages/desktop/src/renderer/index.html');
  for (const expected of [
    '<meta name="application-name" content="One Person Lab App" />',
    '<meta name="apple-mobile-web-app-title" content="One Person Lab App" />',
    '<title>One Person Lab App</title>',
  ]) {
    if (!indexHtml.includes(expected)) {
      throw new Error(`Active shell HTML branding must include ${expected}`);
    }
  }
  for (const forbidden of ['content="AionUi"', '<title>AionUi</title>']) {
    if (indexHtml.includes(forbidden)) {
      throw new Error(`Active shell HTML branding must not expose ${forbidden}`);
    }
  }

  const webManifest = readShellText(shellPaths, 'public/manifest.webmanifest');
  for (const expected of [
    '"name": "One Person Lab App"',
    '"short_name": "OPL"',
    '"description": "One Person Lab App for Codex-first OPL workflows."',
  ]) {
    if (!webManifest.includes(expected)) {
      throw new Error(`Active shell web manifest branding must include ${expected}`);
    }
  }
  if (webManifest.includes('"name": "AionUi"') || webManifest.includes('"short_name": "AionUi"')) {
    throw new Error('Active shell web manifest must not expose upstream AionUi branding.');
  }

  for (const relativePath of ['resources/app.png', 'resources/icon.png', 'resources/app_dev.png']) {
    assertShellFileHash(
      shellPaths,
      relativePath,
      '540a7a393e26ab84c9ab9a4ccae121bc41d8963b19febcef5cf7acc685d5786c',
      `${relativePath} OPL icon`,
    );
  }
  assertShellFileHash(
    shellPaths,
    'resources/app.icns',
    'cafe7b133ef70027332b97d5a25ddf1223e870a137814cb86ec3f0e51ca73216',
    'resources/app.icns OPL icon',
  );
  assertShellFileHash(
    shellPaths,
    'resources/app.ico',
    'ddf1071a56ff912b39c77543b158592b8b87f72382a11e1779e6b69b608e0ef7',
    'resources/app.ico OPL icon',
  );
  for (const [relativePath, expectedHash] of [
    ['public/pwa/icon-180.png', '028e831b65057e3f1cc906f75e37a80de75e050cc8842561d05ee3c015899a90'],
    ['public/pwa/icon-192.png', 'c873622198071e0f04dae6d279d3e861b80a87c6e4a12f4fc68a8bf4e868adaf'],
    ['public/pwa/icon-512.png', 'fb8cddda7b12e53ced77571c5576bd4d68463da673b0316b1f0e7ce481a5d559'],
  ]) {
    assertShellFileHash(shellPaths, relativePath, expectedHash, `${relativePath} OPL PWA icon`);
  }
}
