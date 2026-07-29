import {
  validateRuntimeSettings,
  validateTrayStartup,
} from '../../../scripts/validate-active-shell/shell-substrate-validator.ts';
import { assert, fs, os, path, test } from './helpers.ts';

const runtimeSettingsMarkers = [
  "useOplAppState('fast')",
  'executeManagedUpdateRead',
  'executeManagedUpdateMutation',
  'runSettingsControlPlaneAction',
  'maintenanceHubItems',
  "data-testid='opl-maintenance-hub'",
  'settings.uiOptimization.maintenance.summaryTitle',
  'settings.oplEnvironmentPage.maintenanceHub.description',
  "data-testid='settings-maintenance-daily-actions'",
  "data-testid='settings-maintenance-managed-dependencies'",
  "data-testid='settings-maintenance-inline-updates'",
  "data-testid='settings-maintenance-diagnostics-action'",
  "data-testid='settings-maintenance-technical-details'",
  'open={diagnosticsVisible}',
  "className='opl-settings-details opl-settings-surface--diagnostic'",
];

const runtimeSettingsViewModelMarkers = [
  'const maintenanceHubItems',
  "key: 'appUpdates'",
  "key: 'runtimeEnvironment'",
  "key: 'capabilitySurfaceSync'",
  "key: 'localServicesRepair'",
  'settings.oplEnvironmentPage.maintenanceHub.items.appUpdates.title',
  'settings.oplEnvironmentPage.maintenanceHub.items.runtimeEnvironment.title',
  'settings.oplEnvironmentPage.maintenanceHub.actions.repairRuntimeEnvironment',
  'settings.oplEnvironmentPage.maintenanceHub.items.capabilitySurfaceSync.title',
  'settings.oplEnvironmentPage.maintenanceHub.actions.syncCapabilityPacks',
  'settings.oplEnvironmentPage.maintenanceHub.items.localServicesRepair.title',
];

function runtimeSettingsFixture(t, markers = runtimeSettingsMarkers) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-maintenance-settings-shell-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const runtimeSettingsPath = path.join(
    root,
    'packages/desktop/src/renderer/pages/settings/sections/RuntimeSettings.tsx',
  );
  fs.mkdirSync(path.dirname(runtimeSettingsPath), { recursive: true });
  fs.writeFileSync(runtimeSettingsPath, markers.join('\n'), 'utf8');

  const viewModelPath = path.join(
    root,
    'packages/desktop/src/renderer/pages/settings/RuntimeSettings/runtimeSettingsViewModel.tsx',
  );
  fs.mkdirSync(path.dirname(viewModelPath), { recursive: true });
  fs.writeFileSync(viewModelPath, runtimeSettingsViewModelMarkers.join('\n'), 'utf8');

  return { shellRoot: root };
}

test('Maintenance validator accepts the collapsed-summary product key and retained hub structure', (t) => {
  assert.doesNotThrow(() => validateRuntimeSettings(runtimeSettingsFixture(t)));
});

test('Maintenance validator rejects the legacy title key as a substitute for the collapsed summary', (t) => {
  const legacyMarkers = runtimeSettingsMarkers.map((marker) =>
    marker === 'settings.uiOptimization.maintenance.summaryTitle'
      ? 'settings.oplEnvironmentPage.maintenanceHub.title'
      : marker,
  );

  assert.throws(
    () => validateRuntimeSettings(runtimeSettingsFixture(t, legacyMarkers)),
    /settings\.uiOptimization\.maintenance\.summaryTitle/,
  );
});

test('Maintenance validator continues to require the hub description', (t) => {
  const missingDescription = runtimeSettingsMarkers.filter(
    (marker) => marker !== 'settings.oplEnvironmentPage.maintenanceHub.description',
  );

  assert.throws(
    () => validateRuntimeSettings(runtimeSettingsFixture(t, missingDescription)),
    /settings\.oplEnvironmentPage\.maintenanceHub\.description/,
  );
});

function trayStartupFixture(t, { legacyPath = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-tray-startup-shell-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const write = (relativePath, content) => {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  };
  const trayStartupPath = legacyPath
    ? 'packages/desktop/src/process/startup/trayStartup.ts'
    : 'packages/desktop/src/process/startup/runtime/trayStartup.ts';
  write(
    trayStartupPath,
    [
      'export async function initializeTrayForDesktopMode() {}',
      'deps.createOrUpdateTray()',
      'deps.destroyTray()',
      'deps.setCloseToTrayEnabled(false)',
    ].join('\n'),
  );
  write(
    'packages/desktop/src/index.ts',
    [
      "import { initializeTrayForDesktopMode } from './process/startup/runtime/trayStartup';",
      'initializeTrayForDesktopMode',
      'readCloseToTray: readCloseToTraySetting',
      'createOrUpdateTray',
      'destroyTray',
    ].join('\n'),
  );
  write(
    'packages/desktop/src/process/utils/closeToTraySetting.ts',
    [
      "const CLOSE_TO_TRAY_CONFIG_KEY = 'system.closeToTray'",
      'await ProcessConfig.get(CLOSE_TO_TRAY_CONFIG_KEY)',
      'await ProcessConfig.set(CLOSE_TO_TRAY_CONFIG_KEY, enabled)',
    ].join('\n'),
  );
  write(
    'packages/desktop/src/process/utils/tray.ts',
    [
      "platform === 'darwin' ? 'trayTemplate.png' : 'app.png'",
      "path.join(resourcesPath, 'opl-branding', iconFilename)",
      'path.join(resourcesPath, iconFilename)',
      'icon.setTemplateImage(true)',
      'if (icon.isEmpty())',
    ].join('\n'),
  );
  write('packages/desktop/electron-builder.yml', 'from: resources/opl-branding\nto: opl-branding\n');
  write('resources/opl-branding/trayTemplate.png', 'fixture');
  write('resources/opl-branding/trayTemplate@2x.png', 'fixture');
  return { shellRoot: root };
}

test('Tray substrate validator consumes the current runtime startup module path', (t) => {
  assert.doesNotThrow(() => validateTrayStartup(trayStartupFixture(t)));
});

test('Tray substrate validator rejects the retired startup module path', (t) => {
  assert.throws(
    () => validateTrayStartup(trayStartupFixture(t, { legacyPath: true })),
    /packages\/desktop\/src\/process\/startup\/runtime\/trayStartup\.ts/,
  );
});
