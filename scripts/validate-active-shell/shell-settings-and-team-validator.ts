import { legacySettingsRouteRedirects } from './app-contract-constants.ts';
import {
  assertShellTextIncludesAll,
  assertTextExcludesAll,
  readShellText,
} from './shell-implementation-helpers.ts';

const settingsNavExpected = [
  'getOplGuiSettingsVisibleTabs',
  'getOplGuiLegacySettingsRouteRedirects',
  'SETTINGS_DEFAULT_ROUTE = \'/settings/general\'',
  "if (legacyId === 'skills-hub') return '/settings/capabilities?tab=skills'",
  "if (legacyId === 'tools') return '/settings/capabilities?tab=tools'",
  'LEGACY_SETTINGS_ROUTE_REDIRECTS',
  'LEGACY_ANCHOR_REMAP',
];

const settingsModalExpected = [
  'getOplGuiSettingsVisibleTabs',
  'getOplGuiLegacySettingsRouteRedirects',
  "defaultTab = 'general'",
  '<OverviewSettings withWrapper={false} />',
  '<RuntimeSettings withWrapper={false} />',
  '<CapabilitiesSettingsContent activeTab={capabilitiesTab} onTabChange={setCapabilitiesTab} />',
  '<AccessSettingsContent />',
  '<AppearanceModalContent />',
];

const settingsModalForbidden = [
  'ModelModalContent',
  'AgentModalContent',
  "label: t('settings.model')",
  "label: t('settings.tools')",
  "label: t('settings.webui')",
];

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
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/sections/settingsNav.tsx',
    settingsNavExpected,
    'Active shell settings navigation App-owned settings partition',
  );
  const settingsModal = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/index.tsx',
    settingsModalExpected,
    'Active shell settings modal App-owned settings partition',
  );
  assertTextExcludesAll(settingsModal, settingsModalForbidden, 'Active shell settings modal legacy ordinary settings entry');
}

function legacySettingsRouteTarget(legacyId, targetId) {
  if (legacyId === 'skills-hub') {
    return '/settings/capabilities?tab=skills';
  }
  if (legacyId === 'tools') {
    return '/settings/capabilities?tab=tools';
  }
  return `/settings/${targetId}`;
}

function assertLegacySettingsRoutes(router) {
  for (const [legacyId, targetId] of Object.entries(legacySettingsRouteRedirects)) {
    const expectedTarget = legacySettingsRouteTarget(legacyId, targetId);
    const expectedRoute = `path='/settings/${legacyId}' element={<Navigate to='${expectedTarget}' replace />}`;
    if (!router.includes(expectedRoute)) {
      throw new Error(`Active shell router must redirect legacy settings route ${legacyId} to ${expectedTarget}`);
    }
  }
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
  assertLegacySettingsRoutes(router);
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
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/common/config/oplProductProfile/index.ts',
    ordinaryCapabilityFilterExpected,
    'Active shell ordinary capability filter disabled Team MCP state',
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
    'packages/desktop/src/renderer/components/agent/AgentSetupCard.tsx',
    [
      'sanitizeOplOrdinaryConversationExtra',
      'filterOplOrdinarySessionMcpServers',
      'selected_mcp_server_ids: undefined',
      'selected_session_mcp_servers: sessionMcpServers?.length ? sessionMcpServers : undefined',
    ],
    'Active shell agent switching disabled Team MCP state',
  );
}

export function validateShellSettingsAndTeamImplementation(shellPaths) {
  validateSettingsPartitionImplementation(shellPaths);
  validateTeamRouteDisablement(shellPaths);
  validateTeamSurfaceDisablement(shellPaths);
  validateOrdinaryCapabilityScrub(shellPaths);
}
