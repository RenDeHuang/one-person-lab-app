import { beginnerFirstRunTestIds, progressiveFirstRunRecoveryTestIds } from './app-contract-constants.ts';
import { readShellText } from './shell-implementation-helpers.ts';

export function validateFirstRunImplementation(shellPaths) {
  const rendererMain = readShellText(shellPaths, 'packages/desktop/src/renderer/main.tsx');
  const appLoader = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/AppLoader.tsx');
  const router = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/Router.tsx');
  const startupGate = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/StartupGate.tsx');
  const firstRunPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/index.tsx');
  const firstRunStyles = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/FirstRun.module.css');
  const firstRunModel = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/initializeModel.ts');
  const corePrerequisitesHook = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/hooks/system/useCoreLaunchPrerequisites.ts',
  );
  const firstRunSetupEntry = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/FirstRunSetupEntry.tsx',
  );
  const sider = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/Sider/index.tsx');
  const guidPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/GuidPage.tsx');
  const guidSetupNotice = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidSetupNotice.tsx',
  );
  const guidActionRow = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
  );
  const guidWorkspaceContextBar = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidWorkspaceContextBar.tsx',
  );
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
  const firstRunRouteIndex = router.indexOf("path='/first-run'");
  const ordinaryLayoutIndex = router.indexOf('element={<ProtectedLayout layout={layout} />}');
  const authenticatedFirstRunRoute =
    /<Route\s+path='\/first-run'\s+element=\{\s*<ProtectedRoute>\s*\{withRouteFallback\(FirstRun\)\}\s*<\/ProtectedRoute>\s*\}\s*\/>/.test(
      router,
    );
  if (
    !router.includes('const ProtectedRoute') ||
    !authenticatedFirstRunRoute ||
    firstRunRouteIndex < 0 ||
    ordinaryLayoutIndex < 0 ||
    firstRunRouteIndex > ordinaryLayoutIndex ||
    router.slice(ordinaryLayoutIndex).includes("path='/first-run'")
  ) {
    throw new Error('Active shell FirstRun must render as an authenticated standalone route outside the ordinary product layout');
  }
  const skipStartupCheck = startupGate.match(/const skipStartupCheck = \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
  if (
    !skipStartupCheck.includes("navigate('/guid', { replace: true })") ||
    skipStartupCheck.includes("navigate('/first-run'")
  ) {
    throw new Error('Active shell StartupGate skip must enter /guid without mutating unknown readiness');
  }
  for (const expected of [
    'STARTUP_STATE_SOFT_TIMEOUT_MS = 1500',
    "resolve({ kind: 'timeout' })",
    'readAuthoritativeInitializeReadiness',
    'setNeedsFirstRun(!isCoreLaunchReadyFromAppState(startupRead.value))',
    'setNeedsFirstRun(initializeReady !== true)',
    'setNeedsFirstRun(true)',
  ]) {
    if (!startupGate.includes(expected)) {
      throw new Error(`Active shell StartupGate must keep the bounded readiness fallback fail-closed: ${expected}`);
    }
  }
  if (startupGate.includes('setNeedsFirstRun(false)')) {
    throw new Error('Active shell StartupGate must not treat an unknown readiness result as ready');
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
  if (!firstRunPage.includes("ipcBridge.oplRuntime.getAppState.invoke({ profile: 'fast' })")) {
    throw new Error('Active shell FirstRun Gateway account login must read back fast App state before completing setup');
  }
  const deferredEntry = firstRunPage.match(/\{!readyToLaunch && \([\s\S]*?data-testid='opl-first-run-enter-app'[\s\S]*?\)\}/)?.[0] ?? '';
  if (
    !deferredEntry.includes("onClick={() => navigate('/guid')}") ||
    deferredEntry.includes('disabled=') ||
    deferredEntry.includes('loading=') ||
    deferredEntry.includes('POST_INSTALL_SELF_CHECK_STATE')
  ) {
    throw new Error('Active shell FirstRun must keep a pure, always-enabled /guid entry before readiness');
  }
  for (const expected of ['readCoreLaunchPrerequisiteState', "useOplAppState('fast')"]) {
    if (!corePrerequisitesHook.includes(expected)) {
      throw new Error(`Active shell progressive first-run readiness hook must include ${expected}`);
    }
  }
  for (const expected of [
    "void navigate('/first-run')",
    "data-testid='opl-first-run-resume-entry'",
    'if (!readiness.known || readiness.readyToLaunch) return null',
  ]) {
    if (!firstRunSetupEntry.includes(expected)) {
      throw new Error(`Active shell persistent first-run recovery entry must include ${expected}`);
    }
  }
  if (!sider.includes('<FirstRunSetupEntry collapsed={collapsed} isMobile={isMobile} onNavigate={onSessionClick} />')) {
    throw new Error('Active shell ordinary sidebar must mount the persistent FirstRun recovery entry');
  }
  for (const expected of [
    "setSetupNoticeKind('local_assistant')",
    "setSetupNoticeKind('model_access')",
    'sendWithPrerequisiteCheck',
    'fileAccessEnabled: true',
    'fileAccessDisabled={false}',
    'workspaceAccessDisabled={workspaceAccessBlocked}',
  ]) {
    if (!guidPage.includes(expected)) {
      throw new Error(`Active shell Guid progressive first-run recovery must include ${expected}`);
    }
  }
  if (!guidWorkspaceContextBar.includes("data-testid='opl-guid-workspace-access-disabled'")) {
    throw new Error('Active shell Guid project workspace control must expose the workspace prerequisite disabled state');
  }
  for (const expected of [
    "data-testid='opl-guid-setup-notice'",
    "data-testid='opl-guid-setup-notice-action'",
  ]) {
    if (!guidSetupNotice.includes(expected)) {
      throw new Error(`Active shell Guid setup notice must include ${expected}`);
    }
  }
  for (const testId of progressiveFirstRunRecoveryTestIds) {
    if (
      ![firstRunSetupEntry, guidPage, guidActionRow, guidWorkspaceContextBar, guidSetupNotice].some((source) =>
        source.includes(testId),
      )
    ) {
      throw new Error(`Active shell progressive first-run recovery must implement ${testId}`);
    }
  }
  for (const forbidden of [
    "shouldEnterGuidAutomatically",
    "navigate('/guid', { replace: true })",
    "resolveLegacySettingsRoute",
    "data-testid='opl-settings-environment'",
  ]) {
    if (firstRunPage.includes(forbidden)) {
      throw new Error(
        `Active shell FirstRun must not navigate automatically or bypass the explicit entry policies: ${forbidden}`,
      );
    }
  }
  for (const id of beginnerFirstRunTestIds.filter((candidate) => candidate !== 'opl-startup-preflight')) {
    const expectedExpressions = id.startsWith('opl-first-run-step-')
      ? ['data-testid={`opl-first-run-step-${id}`}']
      : id === 'opl-first-run-task-panel'
        ? [
            "data-testid='opl-first-run-task-panel'",
            "data-testid={readyToLaunch ? 'opl-first-run-completion' : 'opl-first-run-task-panel'}",
          ]
        : [`data-testid='${id}'`];
    if (!expectedExpressions.some((expected) => firstRunPage.includes(expected))) {
      throw new Error(
        `Active shell FirstRun page must implement beginner first-run surface ${expectedExpressions.join(' or ')}`,
      );
    }
  }
  for (const expected of [
    "className={styles.firstRunPage}",
    "className={`${styles.firstRunWorkspace} ${readyToLaunch ? styles.firstRunWorkspaceComplete : ''}`}",
    "className={styles.firstRunStepRail}",
    "className={`${styles.firstRunTaskPanel} ${readyToLaunch ? styles.firstRunTaskPanelComplete : ''}`}",
    "const PRIMARY_FIRST_RUN_ITEM_IDS: FirstRunItemId[] = ['workspace_root', 'codex', 'codex_config'];",
    "data-testid={`opl-first-run-step-${id}`}",
    "showModelAccessTask = codexConfigBlocked && activePrimaryStepId === 'codex_config'",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun focused task binding must include ${expected}`);
    }
  }
  const readyEntryButton = firstRunPage.match(/<Button\s+ref=\{readyEntryRef\}[\s\S]*?<\/Button>/)?.[0] ?? '';
  if (
    !readyEntryButton.includes("navigate('/guid', { state: POST_INSTALL_SELF_CHECK_STATE })") ||
    readyEntryButton.includes('disabled=')
  ) {
    throw new Error('Active shell ready entry must stay enabled and preserve post-install self-check state');
  }
  for (const expected of [
    "setAttribute('inert', '')",
    "setAttribute('aria-hidden', 'true')",
    "removeAttribute('inert')",
    "removeAttribute('aria-hidden')",
    "page.focus({ preventScroll: true })",
    "readyEntryRef.current?.focus({ preventScroll: true })",
    "taskPanelRef.current?.focus({ preventScroll: true })",
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
  if (!firstRunStyles.includes('grid-template-columns: repeat(3, minmax(0, 1fr));')) {
    throw new Error('Active shell FirstRun must keep a compact three-step rail on narrow screens');
  }
  if (!firstRunStyles.includes('.firstRunStep:not(:last-child)::after {\n    display: block;')) {
    throw new Error('Active shell FirstRun must render the compact narrow-screen step connector');
  }
  const shortWindowStyles = firstRunStyles.slice(
    firstRunStyles.indexOf('@media (max-width: 600px) and (max-height: 700px)'),
  );
  for (const expected of [
    '.firstRunStepRailHeader,',
    '.firstRunStepProgress,',
    '.firstRunStepCounter,',
    '.firstRunStateIcon,',
    '.firstRunAttentionStrip,',
    '.firstRunTaskContext {',
    'display: none;',
  ]) {
    if (!shortWindowStyles.includes(expected)) {
      throw new Error(`Active shell FirstRun must keep the primary action visible at 400x600: ${expected}`);
    }
  }
  const coreReadyStatusBlock =
    firstRunModel.match(/const CORE_READY_ITEM_STATUSES = new Set\(\[[^\]]*\]\);/)?.[0] ?? '';
  if (!coreReadyStatusBlock || coreReadyStatusBlock.includes("'disabled'")) {
    throw new Error('Active shell FirstRun must never treat disabled required Core items as ready');
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
    "data-testid='opl-first-run-gateway-account-method'",
    "data-testid='opl-first-run-gateway-key-method'",
    "data-testid='opl-first-run-gateway-email-input'",
    "data-testid='opl-first-run-gateway-password-input'",
    "data-testid='opl-first-run-gateway-login-button'",
    "data-testid='opl-first-run-recheck-existing'",
    "data-testid='opl-first-run-codex-api-key-input'",
    "data-testid='opl-first-run-configure-codex-button'",
    "data-testid='opl-first-run-ready-entry'",
    "isDesktopRuntime ? 'gateway_account' : 'api_key'",
    "ipcBridge.oplRuntime.loginGatewayAccount.invoke({",
    "ipcBridge.oplRuntime.getAppState.invoke({ profile: 'fast' })",
    "actionId: 'gateway_account_complete_setup'",
    "resolveDefaultGatewayGroup",
    "readGatewayAccountProjection",
    "ipcBridge.oplRuntime.configureCodex.invoke({ apiKey: trimmed })",
    "onClick={() => void refreshInitialize()}",
    "onChange={changeAccessMethod}",
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
    "setGatewayPassword('')",
    "redactSensitiveValue(message, trimmed)",
    "redactCommandResult(result, trimmed)",
    "throw new Error('OPL initialize payload is missing or invalid.')",
    "matchMedia?.('(prefers-reduced-motion: reduce)')",
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
    "typeof entry.required === 'boolean'",
    'declaredBlockingItems',
    'setupFlow.ready_to_launch === (readyCoreItems.length === CORE_ITEM_IDS.length)',
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
