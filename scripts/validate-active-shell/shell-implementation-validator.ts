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

export function validateShellVisualTokenBindings({
  layout,
  productBaseline,
  unoConfig,
}: {
  layout: string;
  productBaseline: string;
  unoConfig: string;
}): void {
  for (const expected of [
    '--opl-sidebar-bg: #fcfcfc;',
    '--opl-sidebar-bg: #1b1c1e;',
    '--text-primary: var(--color-text-1);',
  ]) {
    if (!productBaseline.includes(expected)) {
      throw new Error(`Active shell OPL product visual baseline must include ${expected}`);
    }
  }
  const railBlock = productBaseline.match(/\.layout-sider\.arco-layout-sider\s*\{([^}]*)\}/)?.[1] ?? '';
  if (!railBlock.includes('background: var(--opl-sidebar-bg);')) {
    throw new Error('Active shell navigation rail must consume --opl-sidebar-bg directly');
  }
  const bodyBlock = productBaseline.match(/body\s*\{([^}]*)\}/)?.[1] ?? '';
  if (!bodyBlock.includes('color: var(--text-primary);')) {
    throw new Error('Active shell body text must consume the --text-primary semantic bridge');
  }
  for (const expected of [
    "'t-primary': 'var(--text-primary)'",
    "'t-tertiary': 'var(--color-text-3)'",
  ]) {
    if (!unoConfig.includes(expected)) {
      throw new Error(`Active shell Uno semantic text colors must include ${expected}`);
    }
  }
  const siderStart = layout.indexOf('<ArcoLayout.Sider');
  const siderEnd = layout.indexOf('<ArcoLayout.Header', siderStart);
  const siderDeclaration = siderStart >= 0 && siderEnd > siderStart ? layout.slice(siderStart, siderEnd) : '';
  if (/(?:^|[\s'"`])!?bg-(?:\[[^\]]+\]|[^\s'"`}]+)/m.test(siderDeclaration)) {
    throw new Error('Active shell Layout navigation rail must not override --opl-sidebar-bg with a background utility');
  }
  if (!siderDeclaration.includes("className={classNames('layout-sider', {")) {
    throw new Error('Active shell Layout navigation rail must keep layout-sider as its unstyled structural class');
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

  validateShellVisibleBranding(shellPaths, requiresLocale);

  validateShellSubstrateImplementation(shellPaths, requiresLocale);
  validateStandardUpdaterImplementation(shellPaths);
  validateFirstRunImplementation(shellPaths);
  validateShellOrdinaryExperienceImplementation(shellPaths);
  validateShellSettingsAndTeamImplementation(shellPaths);

  const builtinThemes = readShellText(shellPaths, 'packages/desktop/src/renderer/theme/builtinThemes.ts');
  for (const forbidden of ['CODEX_THEME_ID', 'opl-codex.css?raw', "'Codex'"]) {
    if (builtinThemes.includes(forbidden)) {
      throw new Error(`Active shell must not expose the retired Codex theme preset marker ${forbidden}`);
    }
  }
  const themeIndex = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/styles/themes/index.css',
  );
  if (!themeIndex.includes("@import './opl-product-baseline.css'")) {
    throw new Error('Active shell theme index must load the always-on OPL product visual baseline.');
  }
  const productBaseline = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/styles/themes/opl-product-baseline.css',
  );
  const layout = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/Layout.tsx');
  const unoConfig = readShellText(shellPaths, 'uno.config.ts');
  validateShellVisualTokenBindings({ layout, productBaseline, unoConfig });
  for (const expected of ['--opl-sidebar-bg', '--opl-main-bg', '--opl-focus-ring']) {
    if (!productBaseline.includes(expected)) {
      throw new Error(`Active shell OPL product visual baseline must include ${expected}`);
    }
  }
  for (const forbidden of ['!important', 'url(', 'data:image']) {
    if (productBaseline.includes(forbidden)) {
      throw new Error(`Active shell OPL product visual baseline must not include brittle marker ${forbidden}`);
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
    'resolveUpdaterReleaseChannel',
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
