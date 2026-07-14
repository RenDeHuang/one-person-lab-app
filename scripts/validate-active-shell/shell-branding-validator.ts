import { assertShellFileHash, readShellText } from './shell-implementation-helpers.ts';

export function validateShellVisibleBranding(shellPaths, requiresLocale) {
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

  const layout = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/Layout.tsx');
  for (const expected of [
    'getOplOrdinaryChromeName',
    "data-testid='app-navigation-brand'",
  ]) {
    if (!layout.includes(expected)) {
      throw new Error(`Active shell ordinary navigation branding must include ${expected}`);
    }
  }
  if (layout.includes("assets/logos/brand/app.png") || layout.includes('<img src={appLogo}')) {
    throw new Error('Active shell ordinary navigation branding must be text-only without the App logo');
  }

  const titlebar = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/Titlebar/index.tsx');
  if (!titlebar.includes('getOplOrdinaryChromeName') || titlebar.includes("'One Person Lab App'")) {
    throw new Error('Active shell ordinary titlebar fallback must use the profile-owned chrome name');
  }
  for (const expected of [
    'getOplGlobalFeedbackIssueUrl',
    'buildOplAppIssueUrl',
    'openExternalUrl',
    "faCircleQuestion } from '@fortawesome/free-regular-svg-icons'",
    "FontAwesomeIcon } from '@fortawesome/react-fontawesome'",
    "data-testid='app-titlebar-help-icon'",
  ]) {
    if (!titlebar.includes(expected)) {
      throw new Error(`Active shell titlebar feedback must include ${expected}`);
    }
  }
  if (titlebar.includes('<Comment')) {
    throw new Error('Active shell titlebar feedback must not retain the AionUI comment icon');
  }
  if (titlebar.includes('https://github.com/gaofeng21cn/one-person-lab-app/issues/new')) {
    throw new Error('Active shell titlebar feedback target must come from the App product profile');
  }
  const productProfileConsumer = readShellText(
    shellPaths,
    'packages/desktop/src/common/config/oplProductProfile/index.ts',
  );
  for (const expected of [
    "icon: 'circle_question'",
    "icon_style: 'regular_outline'",
    "background: 'semantic_success_green'",
    "han_name_initials: 'first_han_character_only'",
  ]) {
    if (!productProfileConsumer.includes(expected)) {
      throw new Error(`Active shell product profile consumer must include ${expected}`);
    }
  }
  if (productProfileConsumer.includes("icon: 'comment'")) {
    throw new Error('Active shell product profile consumer must not accept the retired comment icon');
  }
}

export function validateShellBrandingAssets(shellPaths) {
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
