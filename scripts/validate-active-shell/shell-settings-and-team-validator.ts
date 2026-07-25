import {
  assertShellTextIncludesAll,
  assertTextExcludesAll,
  assertTextIncludesAll,
  readShellText,
} from './shell-implementation-helpers.ts';

const brandedDeepLinkProbeIds = [
  'opl_scheme_only',
  'navigate_schema_and_secret_rejection',
  'app_owned_exact_route_registry',
  'shared_cold_warm_second_instance_parser',
  'invalid_link_fail_open_and_redacted',
];

export function validateBrandedDeepLinkProbeContract(adapterContract) {
  const surface = adapterContract?.implementation_probes?.branded_deep_link_surface;
  if (
    surface?.source !== 'app_branded_deep_link_policy' ||
    surface?.source_ref !== 'contracts/app-gui-product-contract.json#branded_deep_link_policy' ||
    surface?.policy !== 'behavior_tests_plus_narrow_source_guards'
  ) {
    throw new Error('Active shell branded deep-link probe must consume the App-owned policy');
  }
  const probes = Array.isArray(surface.probes) ? surface.probes : [];
  const ids = probes.map((probe) => probe?.id);
  if (JSON.stringify(ids) !== JSON.stringify(brandedDeepLinkProbeIds)) {
    throw new Error('Active shell branded deep-link probe ids must match the App-owned policy');
  }
  if (
    probes.some(
      (probe) =>
        probe?.required !== true ||
        !Array.isArray(probe.required_evidence) ||
        probe.required_evidence.length < 2 ||
        probe.required_evidence.some((entry) => typeof entry !== 'string' || !entry.trim()),
    )
  ) {
    throw new Error('Active shell branded deep-link probes must require concrete evidence');
  }
}

function validateBrandedDeepLinkImplementation(shellPaths) {
  const processDeepLink = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/utils/deepLink.ts',
    [
      "export const PROTOCOL_SCHEME = 'opl';",
      "parsed.hostname !== 'navigate' || parsed.pathname !== ''",
      'parameterEntries.some(([key, value]) => containsSensitiveData(key) || containsSensitiveData(value))',
      "parameterKeys.some((key) => key !== 'route')",
      "const routes = parsed.searchParams.getAll('route');",
      "if (routes.length !== 1) return reject('duplicate_parameter');",
      'isOplAppDeepLinkRoute(route)',
      'validateDeepLinkPayload(additionalData.deepLinkPayload)',
      'ipcBridge.deepLink.takePending.provider(async () => activateDeepLinkConsumer())',
      'console.warn(`[DeepLink] rejected: ${reason}`)',
      'bearer\\s+',
      'sk-',
      'eyj',
      'ghp_',
      'github_pat_',
    ],
    'Active shell OPL deep-link parser, secret rejection, and pending delivery',
  );
  assertTextExcludesAll(
    processDeepLink,
    ['aionui://', 'Buffer.from(', 'api_key', 'add-provider', 'provider/add'],
    'Active shell retired credential-bearing deep-link parser',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/config/oplProductProfile/index.ts',
    [
      'export function getOplAppDeepLinkRoutes(): string[]',
      "'/guid'",
      "'/archived'",
      "'/scheduled'",
      '...controlPlane.ordinary_routes.map((route) => route.path)',
      '...controlPlane.secondary_pages.map((page) => page.path)',
      'return getOplAppDeepLinkRoutes().includes(route)',
    ],
    'Active shell App-owned exact deep-link route registry',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/index.ts',
    [
      'registerDeepLinkBridge()',
      'extractDeepLinkPayloadFromArgv(process.argv)',
      'app.requestSingleInstanceLock(deepLinkFromArgv ? { deepLinkPayload: deepLinkFromArgv } : {})',
      'extractSecondInstanceDeepLinkPayload(argv, additionalData)',
      'app.setAsDefaultProtocolClient(PROTOCOL_SCHEME)',
      "app.on('open-url', (event, url) => {",
      'const result = handleDeepLinkUrl(url)',
    ],
    'Active shell shared cold, second-instance, and macOS deep-link delivery',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/hooks/system/useDeepLink.ts',
    [
      'isOplAppDeepLinkRoute(payload.params.route)',
      'ipcBridge.deepLink.received.on(handler)',
      'ipcBridge.deepLink.takePending',
      'pendingPayloads.forEach(handler)',
    ],
    'Active shell renderer exact-route validation and ready-state pending pull',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/adapter/ipcBridge.ts',
    [
      "action: 'navigate'",
      'route: string',
      "bridge.buildEmitter<DeepLinkNavigatePayload>('deep-link.received')",
      "bridge.buildProvider<DeepLinkNavigatePayload[], void>('deep-link.take-pending')",
    ],
    'Active shell secret-free branded deep-link IPC payload',
  );

  const builder = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/electron-builder.yml',
    ['protocols:', 'schemes:', '      - opl'],
    'Active shell packaged OPL protocol registration',
  );
  assertTextExcludesAll(builder, ['      - aionui'], 'Active shell retired packaged AionUI protocol registration');
  const ubuntuInstaller = assertShellTextIncludesAll(
    shellPaths,
    'scripts/install-ubuntu.sh',
    ['x-scheme-handler/opl'],
    'Active shell Ubuntu OPL protocol registration',
  );
  assertTextExcludesAll(
    ubuntuInstaller,
    ['x-scheme-handler/aionui'],
    'Active shell retired Ubuntu AionUI protocol registration',
  );

  const addPlatformModal = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/components/AddPlatformModal.tsx',
  );
  assertTextExcludesAll(
    addPlatformModal,
    ['aionui://', 'add-provider', 'provider/add'],
    'Active shell retired provider credential deep-link instructions',
  );
}

const settingsNavExpected = [
  "from '../registry/settingsRegistry'",
  'buildSettingsNavItems',
  'getBuiltinSettingsNavItems',
];

const settingsRegistryExpected = [
  "from '@icon-park/react'",
  'getOplGuiSettingsControlPlane',
  'getOplGuiSettingsVisibleTabs',
  'getOplGuiLegacySettingsRouteRedirects',
  'settingsControlPlane?.default_route',
  'settingsControlPlane?.ordinary_routes',
  'settingsControlPlane?.extension_anchor_remap',
  'LEGACY_SETTINGS_ROUTE_REDIRECTS',
  'LEGACY_ANCHOR_REMAP',
  'buildSettingsItemsWithExtensions',
  '{icon(16)}',
];

const oplChromeIconExpected = [
  'export const OPL_CHROME_ICON_SIZE = 16',
  'export const OPL_CHROME_ICON_STROKE_WIDTH = 4.5',
  "theme: 'outline'",
  "fill: 'currentColor'",
];

const conversationMarkdownExpected = [
  'line-height: 1.4667;',
  'font-size: var(--chat-font-size, 15px);',
  'margin-block-start: 10px;',
  'margin-block-start: 2px;',
  'font-size: 12px;',
  'line-height: 18px;',
];

const conversationMessageExpected = [
  "classNames('h-20px flex items-center mt-2px gap-6px'",
  "data-testid='message-hover-actions'",
];

const conversationMessageStylesExpected = [
  '.message-item .whitespace-pre-wrap',
  'font-size: var(--chat-font-size, 15px);',
  'line-height: 1.4667;',
];

const conversationToolSummaryExpected = [
  "from '@icon-park/react'",
  'useTranslation',
  "type='button'",
  'aria-expanded={showMore}',
  'messages.toolSteps.completed',
  'messages.toolSteps.input',
  'messages.toolSteps.output',
];

const conversationFileChangesExpected = [
  "variant?: 'panel' | 'conversation'",
  "variant = 'panel'",
  'data-variant={variant}',
  "compact ? 'py-2px'",
];

const conversationSkeletonExpected = ["data-testid='message-list-skeleton-lines'"];

const settingsModalExpected = [
  'SettingsHost',
  "defaultTab = 'general'",
];

const settingsHostExpected = [
  'buildSettingsModalMenuItems',
  'getSettingsSearchEntries',
  'getSettingsRenderSlot',
  'resolveSettingsRenderTarget',
  'ExtensionSettingsTabContent',
  'SettingsShellAdapterSlot',
  'data-testid=\'settings-host\'',
];

const settingsShellAdapterSlotExpected = [
  'SettingsShellRenderSlot',
  'OverviewSettings',
  'WorkspaceSettings',
  'LocalServicesSettings',
  'RuntimeSettings',
  'CapabilitiesSettingsContent',
  'GatewaySettingsContent',
  'AccessSettingsContent',
  'ResourcesSettingsContent',
  'AppearanceModalContent',
  'AboutModalContent',
  'StorageSettings',
  'withWrapper={false}',
];

const officialProfileRestoreCallerExpected = [
  'const restoreOfficialProfile = () => {',
  'Modal.confirm({',
  "beginPackageAction('restore_official_profile')",
  "ipcBridge.oplRuntime.applyOfficialProfile.invoke({ intent: 'explicit_restore' })",
  "appStateQuery.load('fast', { showRefreshing: true, forceFresh: true })",
  "data-testid='settings-agents-restore-official-profile'",
];

const officialProfileRestoreIpcExpected = [
  'export type IOplOfficialProfileApplyRequest = {',
  "intent: 'first_install' | 'explicit_restore';",
  'applyOfficialProfile: runtimeProvider<IOplRuntimeCommandResult, IOplOfficialProfileApplyRequest>(',
  "'opl-runtime.apply-official-profile'",
  "'/api/opl-runtime/official-profile/apply'",
];

const officialProfileRestoreProcessExpected = [
  'function buildOfficialProfileApplyCommand(',
  "request.intent !== 'first_install' && request.intent !== 'explicit_restore'",
  "path.join(resolvedResourcesPath, 'official-profile-package-apply.ts')",
  'OPL_PRODUCT_PROFILE.official_profile.desired_root_package_ids',
  'ipcBridge.oplRuntime.applyOfficialProfile.provider((request) =>',
  'runSpawnJsonCommand(buildOfficialProfileApplyCommand(request))',
];

const officialProfileRestoreHelperExpected = [
  "export type OfficialProfileApplyIntent = 'first_install' | 'explicit_restore';",
  "input.intent !== 'first_install' && input.intent !== 'explicit_restore'",
  'desired_state_saved: false',
  'startup_maintenance_registered: false',
  'automatic_reapply_allowed: false',
];

const settingsModalForbidden = [
  'ModelModalContent',
  'AgentModalContent',
  "label: t('settings.model')",
  "label: t('settings.tools')",
  "label: t('settings.webui')",
];

const settingsFooterExpected = [
  "data-testid={account ? 'sider-footer-account' : 'sider-footer-settings'}",
  "onSettingsClick(account ? 'gateway' : 'general')",
  "data-testid='sider-footer-account-avatar'",
  'bg-success',
  'text-inverse',
  'updateAvailable &&',
  'onClick={onUpdateClick}',
  "data-testid='sider-footer-update'",
  "data-update-available='true'",
];

const settingsFooterForbidden = [
  "t('common.back'",
  'sider-footer-back',
  'sider-footer-help',
  'showThemeToggle',
  'sider-footer-theme',
  'sider-footer-update-row',
  "t('settings.checkForUpdates')",
  'isSettings',
];

const settingsAppearanceExpected = [
  "const APPEARANCE_MODES: ThemeAppearanceMode[] = ['system', 'light', 'dark']",
  'appearanceMode, setAppearanceMode',
  "role='radiogroup'",
  "data-testid='appearance-mode-selector'",
  'data-testid={`appearance-mode-${mode}`}',
  'aria-checked={selected}',
];

const settingsAppearanceForbidden = ['CssThemeSettings', "data-testid='preferences-theme-section'", 'CODEX_THEME_ID'];

const settingsSiderReturnExpected = [
  'resolveSettingsReturnPath',
  'navigate(resolveSettingsReturnPath())',
  "data-testid='settings-back-to-app'",
  "t('settings.backToApp')",
];

const settingsTitlebarReturnExpected = [
  'resolveSettingsReturnPath',
  'navigate(resolveSettingsReturnPath())',
  "data-testid='settings-titlebar-back-to-app'",
];

const settingsDesktopTitlebarReturnForbidden = ["'settings-titlebar-history-back'"];

const ordinaryCapabilityFilterExpected = [
  'REQUIRED_ORDINARY_FORBIDDEN_CAPABILITY_POLICY',
  'getOplOrdinaryForbiddenCapabilityPolicy',
  'isOplForbiddenTeamMcpName',
  "exact: ['aionui-team']",
  "prefixes: ['team_', 'mcp__aionui-team']",
  "contains: ['aionui-team']",
  "'team_mcp_stdio_config'",
  "'team_lead_conversation_id'",
  'sanitizeOplOrdinaryConversationExtra',
  'for (const key of getOplOrdinaryForbiddenCapabilityPolicy().extra_keys)',
  'filterOplOrdinarySessionMcpServers',
  'required_preservation_targets: [...policy.required_preservation_targets]',
  '!isOplForbiddenTeamMcpName(server.id)',
  '!isOplForbiddenTeamMcpName(server.name)',
  '!isOplForbiddenTeamMcpName(status.id)',
  '!isOplForbiddenTeamMcpName(status.name)',
];

const teamIpcBridgeExpected = [
  'import { TEAM_MODE_ENABLED }',
  'function disabledTeamMutation',
  'Team mode is disabled for ordinary OPL App',
  'create: disabledTeamMutation(',
  'remove: disabledTeamMutation(',
  'addAgent: disabledTeamMutation(',
  'removeAgent: disabledTeamMutation(',
  'stop: disabledTeamMutation(',
  'ensureSession: disabledTeamMutation(',
  'renameAgent: disabledTeamMutation(',
  'renameTeam: disabledTeamMutation(',
  'setSessionMode: disabledTeamMutation(',
];

const teamSurfaceExpected = ['{TEAM_MODE_ENABLED && (', '<TeamSiderSection'];
const teamCreatedRedirectExpected = ['if (!TEAM_MODE_ENABLED)', 'return undefined'];

function validateSettingsPartitionImplementation(shellPaths) {
  const settingsAppearance = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/registry/settingsRegistry.tsx',
    settingsRegistryExpected,
    'Active shell settings registry App-owned control-plane slot',
  );
  assertTextIncludesAll(
    settingsAppearance,
    ["from '@/renderer/components/opl/oplChromeIcon'", '...OPL_CHROME_ICON_PROPS'],
    'Active shell settings registry shared OPL chrome icon contract',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/opl/oplChromeIcon.ts',
    oplChromeIconExpected,
    'Active shell OPL-owned chrome icon contract',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/sections/settingsNav.tsx',
    settingsNavExpected,
    'Active shell settings navigation App-owned control-plane slot',
  );
  const settingsModal = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/index.tsx',
    settingsModalExpected,
    'Active shell settings modal App-owned control-plane slot',
  );
  assertTextExcludesAll(settingsModal, settingsModalForbidden, 'Active shell settings modal legacy ordinary settings entry');
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/SettingsHost.tsx',
    settingsHostExpected,
    'Active shell SettingsHost App-owned registry consumer',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/SettingsShellAdapterSlot.tsx',
    settingsShellAdapterSlotExpected,
    'Active shell SettingsShellAdapterSlot App-owned slot renderer',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/CapabilitiesSettings.tsx',
    officialProfileRestoreCallerExpected,
    'Active shell Settings Official Profile explicit restore caller',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/adapter/ipcBridge.ts',
    officialProfileRestoreIpcExpected,
    'Active shell Official Profile IPC contract',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/bridge/oplRuntimeBridge.ts',
    officialProfileRestoreProcessExpected,
    'Active shell Official Profile process bridge',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'resources/official-profile-package-apply.ts',
    officialProfileRestoreHelperExpected,
    'Active shell packaged Official Profile helper',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/electron-builder.yml',
    ['from: resources/official-profile-package-apply.ts', 'to: official-profile-package-apply.ts'],
    'Active shell Official Profile helper packaging',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/settings/CapabilitiesSettings.dom.test.tsx',
    [
      'restores the Official Profile only after explicit Settings confirmation',
      "fireEvent.click(screen.getByTestId('settings-agents-restore-official-profile'))",
      "toHaveBeenCalledWith({ intent: 'explicit_restore' })",
      "loadAppState).toHaveBeenCalledWith('fast', {",
      'forceFresh: true',
    ],
    'Active shell Settings Official Profile restore behavior test',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/opl-runtime/oplRuntimeBridge.test.ts',
    [
      'builds an explicit user-authorized Official Profile restore command',
      "{ intent: 'explicit_restore' }",
      "--intent explicit_restore --root-package-id <profile-roots>",
    ],
    'Active shell Official Profile restore bridge test',
  );
  const firstRun = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/FirstRun/index.tsx',
    ["ipcBridge.oplRuntime.applyOfficialProfile", ".invoke({ intent: 'first_install' })"],
    'Active shell Official Profile first-install caller',
  );
  assertTextExcludesAll(firstRun, ["intent: 'explicit_restore'"], 'Active shell first-run explicit restore isolation');
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/opl-runtime/FirstRun.dom.test.tsx',
    [
      'keeps the completion state in place even when initialize reports a non-first-run ready install',
      'is_first_run: false',
      'expect(bridgeMocks.applyOfficialProfileInvoke).not.toHaveBeenCalled()',
    ],
    'Active shell restart does not reapply Official Profile test',
  );
  for (const [relativePath, label] of [
    ['packages/desktop/src/renderer/services/managedUpdateMaintenance.ts', 'daily maintenance'],
    ['packages/desktop/src/renderer/services/desktopAutoUpdateProjection.ts', 'App update projection'],
    ['packages/desktop/src/renderer/components/settings/UpdateModal.tsx', 'App update UI'],
    ['packages/desktop/src/process/bridge/updateBridge.ts', 'App carrier update bridge'],
  ]) {
    assertTextExcludesAll(
      readShellText(shellPaths, relativePath),
      ['applyOfficialProfile'],
      `Active shell ${label} Official Profile automatic reapply isolation`,
    );
  }
  const settingsFooter = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/SiderFooter.tsx',
    settingsFooterExpected,
    'Active shell Settings footer account and App update controls',
  );
  assertTextExcludesAll(
    settingsFooter,
    settingsFooterForbidden,
    'Active shell Settings footer secondary navigation and retired theme control',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/contents/AppearanceModalContent.tsx',
    settingsAppearanceExpected,
    'Active shell Settings three-state appearance controls',
  );
  assertTextExcludesAll(
    settingsAppearance,
    settingsAppearanceForbidden,
    'Active shell Settings retired CSS theme preset surface',
  );
  assertTextExcludesAll(
    settingsAppearance,
    ['@fortawesome', "size='18'"],
    'Active shell Settings navigation icon library and geometry',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/components/SettingsSider.tsx',
    settingsSiderReturnExpected,
    'Active shell Settings sider Back to app control above search',
  );
  const titlebar = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Titlebar/index.tsx',
    settingsTitlebarReturnExpected,
    'Active shell narrow Settings titlebar Back to app resolver',
  );
  assertTextExcludesAll(
    titlebar,
    settingsDesktopTitlebarReturnForbidden,
    'Active shell duplicate desktop Settings titlebar Back to app control',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/accessProjection.ts',
    ['const hanCharacter = name.match(/\\p{Script=Han}/u)?.[0]', 'if (hanCharacter) return hanCharacter'],
    'Active shell account identity initials policy',
  );
}

function validateConversationVisualImplementation(shellPaths) {
  const markdown = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/Markdown/ShadowView.tsx',
    conversationMarkdownExpected,
    'Active shell Codex-aligned conversation Markdown typography',
  );
  assertTextExcludesAll(
    markdown,
    ["isMobile ? '19.6px'", "isMobile ? 'var(--chat-font-size, 14px)'"],
    'Active shell viewport-independent conversation typography',
  );
  const messageText = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/components/MessageText.tsx',
    conversationMessageExpected,
    'Active shell compact hover-only message actions',
  );
  assertTextExcludesAll(messageText, ["classNames('h-32px"], 'Active shell retired 32px message action spacer');
  const messageStyles = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/messages.css',
    conversationMessageStylesExpected,
    'Active shell viewport-independent plain-text message typography',
  );
  assertTextExcludesAll(
    messageStyles,
    ['font-size: 14px !important;', 'line-height: 1.4 !important;'],
    'Active shell retired narrow-window message typography override',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolGroupSummary.tsx',
    conversationToolSummaryExpected,
    'Active shell localized tool disclosure row',
  );
  const toolStyles = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolGroupSummary.css',
    ['padding: 6px 0 0;', 'margin-left: 20px;'],
    'Active shell unframed tool disclosure body',
  );
  assertTextExcludesAll(
    toolStyles,
    ['background: color-mix(in srgb, var(--aou-1)', "[data-theme='dark'] .tool-group-summary__body"],
    'Active shell retired tool disclosure card background',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/base/FileChangesPanel.tsx',
    conversationFileChangesExpected,
    'Active shell compact file-change disclosure variant',
  );
  const thinkingStyles = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/components/MessageThinking.module.css',
    ['border-left: 2px solid var(--color-border-2);'],
    'Active shell unframed process disclosure body',
  );
  assertTextExcludesAll(
    thinkingStyles,
    ['background: color-mix(in srgb, var(--aou-1)'],
    'Active shell retired process disclosure card background',
  );
  const messageList = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/Messages/MessageList.tsx',
    conversationSkeletonExpected,
    'Active shell unframed conversation loading skeleton',
  );
  assertTextExcludesAll(
    messageList,
    ["border: '1px solid var(--color-border-2)'"],
    'Active shell retired bordered message skeleton',
  );
}

function validateTeamRouteDisablement(shellPaths) {
  const router = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/Router.tsx');
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/config/constants.ts',
    ['export const TEAM_MODE_ENABLED = false'],
    'Active shell ordinary GUI upstream AionUI Team mode default',
  );
  if (!router.includes('TEAM_MODE_ENABLED ? withRouteFallback(TeamIndex) : <Navigate to=\'/guid\' replace />')) {
    throw new Error('Active shell router must redirect /team routes when Team mode is disabled');
  }
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Router.tsx',
    [
      'LEGACY_SETTINGS_ROUTE_REDIRECTS',
      'Object.entries(LEGACY_SETTINGS_ROUTE_REDIRECTS)',
      "targetPath !== `/settings/${legacyId}`",
      'renderSettingsRedirect',
      'const path = `/settings/${legacyId}`',
      'path={path}',
      'element={<Navigate to={targetPath} replace />}',
    ],
    'Active shell router registry-driven legacy settings redirects',
  );
}

function validateTeamSurfaceDisablement(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/index.tsx',
    teamSurfaceExpected,
    'Active shell Sider TeamSiderSection gate behind TEAM_MODE_ENABLED',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/team/hooks/useTeamCreatedRedirect.ts',
    teamCreatedRedirectExpected,
    'Active shell Team created redirect hook disabled Team mode no-op',
  );
  const deepLink = readShellText(shellPaths, 'packages/desktop/src/renderer/hooks/system/useDeepLink.ts');
  if (deepLink.includes('/^\\/team\\/[^/]+$/')) {
    throw new Error('Active shell deep links must not whitelist Team routes for ordinary OPL App');
  }
}

function validateOrdinaryCapabilityScrub(shellPaths) {
  const productProfile = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/config/oplProductProfile/index.ts',
    ordinaryCapabilityFilterExpected,
    'Active shell ordinary capability filter disabled Team MCP state',
  );
  assertTextExcludesAll(
    productProfile,
    [
      'getOplOrdinaryMcpServerAllowlist',
      'visible_mcp_server_ids',
      'allowlist.has(server.id)',
      'allowlist.has(server.name)',
      'allowlist.has(status.id)',
      'allowlist.has(status.name)',
    ],
    'Active shell ordinary MCP negative filter must preserve every unmatched configured server',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/adapter/ipcBridge.ts',
    teamIpcBridgeExpected,
    'Active shell Team IPC bridge disabled Team mutations before HTTP',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx',
    [
      'sanitizeOplOrdinaryConversationExtra',
      'extra: sanitizeOplOrdinaryConversationExtra(sourceExtra)',
      'loadedMcpServers={(ordinaryExtra as { mcp_servers?: string[] } | undefined)?.mcp_servers}',
      'loadedMcpStatuses={(ordinaryExtra as { mcp_statuses?: IConversationMcpStatus[] } | undefined)?.mcp_statuses}',
    ],
    'Active shell ordinary conversations Team MCP snapshots',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/common-config/oplProductProfile.test.ts',
    [
      'preserves user and third-party MCP state while scrubbing AionUI Team state',
      'sanitizeOplOrdinaryConversationExtra',
      "team_lead_conversation_id: 'conversation-1'",
      "mcp_servers: ['unknown-mcp']",
      "id: 'unknown-mcp'",
    ],
    'Active shell ordinary conversation MCP preservation and Team scrub regression',
  );
}

export function validateShellSettingsAndTeamImplementation(shellPaths) {
  validateBrandedDeepLinkProbeContract(shellPaths.contract);
  validateBrandedDeepLinkImplementation(shellPaths);
  validateSettingsPartitionImplementation(shellPaths);
  validateConversationVisualImplementation(shellPaths);
  validateTeamRouteDisablement(shellPaths);
  validateTeamSurfaceDisablement(shellPaths);
  validateOrdinaryCapabilityScrub(shellPaths);
}
