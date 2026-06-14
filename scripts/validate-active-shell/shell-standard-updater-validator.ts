import { readShellText } from './shell-implementation-helpers.ts';

export function validateStandardUpdaterImplementation(shellPaths) {
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
}
