import { beginnerFirstRunTestIds } from './app-contract-constants.ts';
import { readShellText } from './shell-implementation-helpers.ts';

export function validateFirstRunImplementation(shellPaths) {
  const rendererMain = readShellText(shellPaths, 'packages/desktop/src/renderer/main.tsx');
  const appLoader = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/AppLoader.tsx');
  const firstRunPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/index.tsx');
  for (const expected of [
    "testId='opl-startup-preflight'",
    'common.startupPreflight.steps.desktopSession',
    'common.startupPreflight.steps.appConfig',
    'common.startupPreflight.steps.firstRunStatus',
  ]) {
    if (!rendererMain.includes(expected)) {
      throw new Error(`Active shell startup preflight must render visible progress before FirstRun: ${expected}`);
    }
  }
  for (const expected of ['aria-live', 'steps.map', 'data-state']) {
    if (!appLoader.includes(expected)) {
      throw new Error(`Active shell AppLoader must expose progress steps without a blank startup window: ${expected}`);
    }
  }
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
    "data-testid='opl-first-run-initialize-pending'",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun page must render shared initialize progress: ${expected}`);
    }
  }
  if (firstRunPage.includes("ipcBridge.oplRuntime.getAppState.invoke({ profile: 'fast' })")) {
    throw new Error('Active shell FirstRun page must not auto-enter /guid from fast App state; use opl system initialize first-run setup_flow');
  }
  for (const expected of beginnerFirstRunTestIds
    .filter((id) => id !== 'opl-startup-preflight')
    .map((id) => `data-testid='${id}'`)) {
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
}
