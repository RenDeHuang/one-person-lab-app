import { validateRuntimeSettings } from '../../../scripts/validate-active-shell/shell-substrate-validator.ts';
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
