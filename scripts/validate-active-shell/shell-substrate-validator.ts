import {
  assertShellTextIncludes,
  assertShellTextIncludesAll,
  assertTextDoesNotMatch,
  assertTextExcludesAll,
  assertTextIncludesAll,
  readShellText,
} from './shell-implementation-helpers.ts';

const runtimeBridgeExpected = [
  "args: ['app', 'state', '--profile', profile, '--json']",
  "args: ['runtime', 'app-operator-drilldown', '--json']",
  "args: ['runtime', 'app-operator-drilldown', '--detail', 'full', '--json']",
  "['app', 'action', 'execute', '--action', assertActionId(request.actionId)]",
];

const systemSettingsExpected = [
  "useOplAppState('fast')",
  "actionId: 'workspace_root_set'",
  'workspace_root_path',
  'selected_path',
  'logs_dir',
  'opl_flow_context',
  'settings.oplFlowContext',
];

const systemSettingsPathExpected = [
  'const appPaths = oplRecord(appState.paths)',
  'oplString(appPaths.workspace_root_path)',
  'oplPathString(appPaths.workspace_root)',
  'oplString(appPaths.logs_dir)',
];

const systemSettingsForbidden = [
  'application.updateSystemInfo.invoke',
  'shell.runOplCommand.invoke',
];

const firstRunLocaleExpected = ['"firstRun"', 'One Person Lab', 'Codex'];
const firstRunLocaleForbidden = [
  '"title": "Prepare One Person Lab"',
  '"wizardTitle": "Prepare One Person Lab"',
  'Checking the essentials',
  'Ready to start',
  'Codex API 配置',
  'Codex API Key',
  'Codex API Configuration',
  'Needs setup',
];

const updateLocaleForbidden = [
  'GitHub API request failed',
  'GitHub API response was not a release list',
  'Update check returned no result',
];

const runtimeSettingsExpected = [
  "useOplAppState('fast')",
  'executeManagedUpdateRead',
  'executeManagedUpdateMutation',
  'runSettingsControlPlaneAction',
  'RuntimeMaintenanceHub',
  'RuntimeReadinessGrid',
];

const trayStartupExpected = [
  'export async function initializeTrayForDesktopMode',
  'deps.createOrUpdateTray()',
  'deps.destroyTray()',
  'deps.setCloseToTrayEnabled(false)',
];

const desktopMainExpected = [
  'initializeTrayForDesktopMode',
  'readCloseToTray: readCloseToTraySetting',
  'createOrUpdateTray',
  'destroyTray',
];

const closeToTraySettingExpected = [
  "const CLOSE_TO_TRAY_CONFIG_KEY = 'system.closeToTray'",
  'await ProcessConfig.get(CLOSE_TO_TRAY_CONFIG_KEY)',
  'await ProcessConfig.set(CLOSE_TO_TRAY_CONFIG_KEY, enabled)',
];

function validateAppStateHook(shellPaths) {
  const appStateHook = assertShellTextIncludes(
    shellPaths,
    'packages/desktop/src/renderer/hooks/system/useOplAppState.ts',
    'ipcBridge.oplRuntime.getAppState.invoke({ profile })',
    'OPL App state hook',
  );
  assertTextExcludesAll(appStateHook, ['shell.runOplCommand', 'application.systemInfo'], 'Active shell OPL App state hook');
}

function validateRuntimeBridgeSurface(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/bridge/oplRuntimeBridge.ts',
    runtimeBridgeExpected,
    'Active shell runtime bridge canonical surface',
  );
}

function validateSystemSettings(shellPaths) {
  const systemSettings = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/contents/SystemModalContent/index.tsx',
    systemSettingsExpected,
    'Active shell System settings',
  );
  assertTextExcludesAll(systemSettings, systemSettingsForbidden, 'Active shell System settings legacy OPL truth/action source');
  assertTextIncludesAll(systemSettings, systemSettingsPathExpected, 'Active shell System settings visible OPL paths from app_state.paths');
}

function enabledLocales(requiresLocale) {
  return ['zh-CN', ...(requiresLocale('zh-TW') ? ['zh-TW'] : [])];
}

function validateFirstRunLocale(shellPaths, locale) {
  const text = readShellText(shellPaths, `packages/desktop/src/renderer/services/i18n/locales/${locale}/settings.json`);
  assertTextIncludesAll(text, firstRunLocaleExpected, `Active shell ${locale} first-run locale`);
  const settingsLocale = JSON.parse(text);
  const firstRunSetupText = `${JSON.stringify(settingsLocale.firstRun ?? {})}\n${JSON.stringify(settingsLocale.oplFirstLaunch ?? {})}`;
  assertTextExcludesAll(firstRunSetupText, firstRunLocaleForbidden, `Active shell ${locale} first-run locale English fallback`);
}

function validateUpdateLocale(shellPaths, locale) {
  const text = readShellText(shellPaths, `packages/desktop/src/renderer/services/i18n/locales/${locale}/update.json`);
  assertTextIncludesAll(text, ['GitHub API'], `Active shell ${locale} update locale GitHub API error context`);
  assertTextExcludesAll(text, updateLocaleForbidden, `Active shell ${locale} update locale English update fallback`);
}

function validateShellLocalizedRuntimeText(shellPaths, requiresLocale) {
  for (const locale of enabledLocales(requiresLocale)) {
    validateFirstRunLocale(shellPaths, locale);
    validateUpdateLocale(shellPaths, locale);
  }
}

function validateRuntimeSettings(shellPaths) {
  const runtimeSettings = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/sections/RuntimeSettings.tsx',
    runtimeSettingsExpected,
    'Active shell Runtime settings',
  );
  assertTextDoesNotMatch(
    runtimeSettings,
    /med[-_ ]?deep[-_ ]?scientist|module_id['"]?\s*:\s*['"]mds['"]/i,
    'Active shell Runtime settings must not default-display Med Deep Scientist/MDS.',
  );
}

function validateTrayStartup(shellPaths) {
  const trayStartup = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/startup/trayStartup.ts',
    trayStartupExpected,
    'Active shell desktop tray startup App-owned tray policy',
  );
  assertTextExcludesAll(
    trayStartup,
    ['if (deps.getCloseToTrayEnabled())', 'if (getCloseToTrayEnabled())'],
    'Active shell desktop tray visibility close-to-tray gate',
  );
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/index.ts', desktopMainExpected, 'Active shell desktop startup App-owned tray policy');
  assertShellTextIncludesAll(shellPaths, 'packages/desktop/src/process/utils/closeToTraySetting.ts', closeToTraySettingExpected, 'Active shell close-to-tray settings bridge App-owned tray preference key');
}

export function validateShellSubstrateImplementation(shellPaths, requiresLocale) {
  validateAppStateHook(shellPaths);
  validateRuntimeBridgeSurface(shellPaths);
  validateSystemSettings(shellPaths);
  validateShellLocalizedRuntimeText(shellPaths, requiresLocale);
  validateRuntimeSettings(shellPaths);
  validateTrayStartup(shellPaths);
}
