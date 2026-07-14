import {
  readShellText,
} from './shell-implementation-helpers.ts';
import {
  validateShellBrandingAssets,
  validateShellVisibleBranding,
} from './shell-branding-validator.ts';
import { validateFirstRunImplementation } from './shell-first-run-validator.ts';
import { validateShellOrdinaryExperienceImplementation } from './shell-ordinary-experience-validator.ts';
import { validateShellSettingsAndTeamImplementation } from './shell-settings-and-team-validator.ts';
import { validateShellSubstrateImplementation } from './shell-substrate-validator.ts';
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

  validateShellVisibleBranding(shellPaths, requiresLocale);

  validateShellSubstrateImplementation(shellPaths, requiresLocale);
  validateStandardUpdaterImplementation(shellPaths);
  validateFirstRunImplementation(shellPaths);
  validateShellOrdinaryExperienceImplementation(shellPaths);
  validateShellSettingsAndTeamImplementation(shellPaths);

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
  for (const expected of [
    'useOplAppState',
    'guiVersion',
    'frameworkRevision',
    'resolveUpdaterChannel',
    "useOplAppState('fast', { autoLoad: false })",
  ]) {
    if (!about.includes(expected)) {
      throw new Error(`Active shell About page must implement ${expected}`);
    }
  }
  if (/AionUI version|Aion UI version/.test(about)) {
    throw new Error('Active shell About page must not present AionUI as the App version.');
  }

  validateShellBrandingAssets(shellPaths);
}
