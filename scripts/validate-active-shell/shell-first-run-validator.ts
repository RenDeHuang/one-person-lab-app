import { beginnerFirstRunTestIds } from './app-contract-constants.ts';
import { readShellText } from './shell-implementation-helpers.ts';

export function validateFirstRunImplementation(shellPaths) {
  const rendererMain = readShellText(shellPaths, 'packages/desktop/src/renderer/main.tsx');
  const appLoader = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/AppLoader.tsx');
  const firstRunPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/index.tsx');
  const firstRunStyles = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/FirstRun.module.css');
  const firstRunModel = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/initializeModel.ts');
  const firstRunBridge = readShellText(shellPaths, 'packages/desktop/src/process/bridge/oplRuntimeBridge.ts');
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
    'initialize?.setup_flow?.ready_to_launch === true',
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
  for (const forbidden of [
    "shouldEnterGuidAutomatically",
    "navigate('/guid', { replace: true })",
    "resolveLegacySettingsRoute",
    "data-testid='opl-settings-environment'",
  ]) {
    if (firstRunPage.includes(forbidden)) {
      throw new Error(
        `Active shell FirstRun must remain in place until the user activates the ready entry: ${forbidden}`,
      );
    }
  }
  for (const expected of beginnerFirstRunTestIds
    .filter((id) => id !== 'opl-startup-preflight')
    .map((id) =>
      id.startsWith('opl-first-run-step-')
        ? 'data-testid={`opl-first-run-step-${id}`}'
        : `data-testid='${id}'`,
    )) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun page must implement beginner first-run surface ${expected}`);
    }
  }
  for (const expected of [
    "className={styles.firstRunPage}",
    "className={styles.firstRunWorkspace}",
    "className={styles.firstRunStepRail}",
    "className={styles.firstRunTaskPanel}",
    "const PRIMARY_FIRST_RUN_ITEM_IDS: FirstRunItemId[] = ['workspace_root', 'codex', 'codex_config'];",
    "data-testid={`opl-first-run-step-${id}`}",
    "showModelAccessTask = codexConfigBlocked && activePrimaryStepId === 'codex_config'",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun focused task binding must include ${expected}`);
    }
  }
  for (const expected of [
    "setAttribute('inert', '')",
    "setAttribute('aria-hidden', 'true')",
    "removeAttribute('inert')",
    "removeAttribute('aria-hidden')",
    "page.focus({ preventScroll: true })",
    "readyEntryRef.current?.focus({ preventScroll: true })",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(
        `Active shell FirstRun must isolate and restore the background shell: ${expected}`,
      );
    }
  }
  for (const expected of [
    "WindowControls",
    "isElectronDesktop",
    "isMacOS",
    "showWindowControls",
    "styles.firstRunBrandBarMac",
    "<WindowControls />",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun must preserve desktop window controls: ${expected}`);
    }
  }
  const firstRunPageStyleBlock = firstRunStyles.match(/\.firstRunPage\s*\{[^}]*\}/)?.[0] ?? "";
  for (const expected of ["position: fixed;", "inset: 0;", "z-index: 120;"]) {
    if (!firstRunPageStyleBlock.includes(expected)) {
      throw new Error(`Active shell FirstRun page overlay must include ${expected}`);
    }
  }
  for (const expected of [".firstRunWorkspace {", ".firstRunStepRail {", ".firstRunTaskPanel {"]) {
    if (!firstRunStyles.includes(expected)) {
      throw new Error(`Active shell FirstRun focus layout must include ${expected}`);
    }
  }
  const macBrandBarStyleBlock =
    firstRunStyles.match(/\.firstRunBrandBarMac\s*\{[^}]*\}/)?.[0] ?? "";
  if (!macBrandBarStyleBlock.includes("padding-left: 84px;")) {
    throw new Error("Active shell FirstRun must preserve the macOS traffic-light safe area");
  }
  if (firstRunStyles.includes("--text-tertiary") || !firstRunStyles.includes("min-height: 44px;")) {
    throw new Error("Active shell FirstRun must use defined text tokens and 44px touch targets");
  }
  for (const forbidden of ["coreProgressPercent", "<Progress", "firstRunProgressPercent"]) {
    if (
      firstRunPage.includes(forbidden) ||
      firstRunStyles.includes(forbidden) ||
      firstRunModel.includes(forbidden)
    ) {
      throw new Error(
        `Active shell FirstRun must use completed-step progress without percentage UI: ${forbidden}`,
      );
    }
  }
  for (const expected of [
    "data-testid='opl-first-run-gateway-method'",
    "data-testid='opl-first-run-existing-codex-method'",
    "data-testid='opl-first-run-recheck-existing'",
    "data-testid='opl-first-run-codex-api-key-input'",
    "data-testid='opl-first-run-configure-codex-button'",
    "data-testid='opl-first-run-ready-entry'",
    "ipcBridge.oplRuntime.configureCodex.invoke({ apiKey: trimmed })",
    "onClick={() => void refreshInitialize()}",
    "disabled={requestInFlight}",
    "aria-label={t('settings.firstRun.modelAccess.methodLabel')}",
    "t('settings.firstRun.checking.itemsPending')",
    "t('settings.firstRun.checking.nextStepPending')",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun model access choice must implement ${expected}`);
    }
  }
  for (const expected of [
    "const initializeUnresolved = initialize === null;",
    "const requestInFlight = initializeLoading || actionLoading !== null;",
    "disabled={requestInFlight}",
    "redactSensitiveValue(message, trimmed)",
    "redactCommandResult(result, trimmed)",
    "throw new Error('OPL initialize payload is missing or invalid.')",
    "aria-labelledby='opl-first-run-setup-title'",
    "id='opl-first-run-setup-title'",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(
        `Active shell FirstRun must implement safe in-place setup behavior: ${expected}`,
      );
    }
  }
  if (/aria-label=['"]opl-(?:first-run|settings)/.test(firstRunPage)) {
    throw new Error("Active shell FirstRun accessible names must not expose test ids");
  }
  if (firstRunPage.includes("Message.")) {
    throw new Error(
      "Active shell FirstRun errors and completion must stay inline without global Message toasts",
    );
  }
  for (const expected of [
    "args: ['system', 'initialize', '--events', '--json']",
    "runInitializeEventsCommand",
    "buildInitializeFallbackCommand",
  ]) {
    if (!firstRunBridge.includes(expected)) {
      throw new Error(
        `Active shell FirstRun bridge must stream initialize events with a JSON fallback: ${expected}`,
      );
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
