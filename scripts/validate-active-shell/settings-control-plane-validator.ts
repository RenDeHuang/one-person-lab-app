import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appActionRoute,
  appOwnedSecondarySettingsPages,
  appOwnedSettingsAccessBrowserEntry,
  appOwnedSettingsCompatibilityRedirects,
  appOwnedSettingsCardFields,
  appOwnedSettingsCapabilitiesTabContract,
  appOwnedSettingsConfirmationFields,
  appOwnedSettingsIaGroupIds,
  appOwnedSettingsIssueStatuses,
  appOwnedSettingsMakeUsableAllowedSteps,
  appOwnedSettingsMakeUsableForbiddenSteps,
  appOwnedSettingsProductSystemItemIds,
  appOwnedSettingsProductSystemTracks,
  appOwnedSettingsProjectionItemFields,
  appOwnedSettingsProjectionSectionIds,
  appOwnedSettingsPostUpdateNoticeFields,
  appOwnedSettingsPageExperienceFields,
  appOwnedSettingsPageAnchors,
  appOwnedSettingsPageSearchEntryIds,
  appOwnedSettingsProductPageIds,
  appOwnedSettingsResourceActionBehavior,
  appOwnedSettingsRouteScopes,
  appOwnedSettingsSearchEntryFields,
  appOwnedSettingsSearchProtocol,
  appOwnedSettingsTabs,
  appOwnedSettingsTaskEntryMetadataFields,
  appOwnedSettingsTopLevelEntryIds,
  appOwnedSettingsTopLevelLabels,
  appOwnedSettingsUpstreamIntakeClassifications,
  appOwnedSettingsTaskEntryIds,
  appOwnedSettingsVisualQaTargets,
  appOwnedSettingsVisualSystem,
  legacySettingsRouteRedirects,
} from './app-contract-constants.ts';
import { validateSettingsCapabilitiesResourceGrouping } from './shared-contract-validators.ts';

const settingsIaRef = 'contracts/app-gui-product-contract.json#settings_navigation.settings_ia';
const settingsControlPlaneContractRef = 'contracts/app-settings-control-plane.json';
const expectedCapabilitiesStateSource =
  'opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index + home_agent_shortcuts + app_state.operator.workbench.task_drilldowns';

const expectedLegacyRedirects = {
  ...legacySettingsRouteRedirects,
  'skills-hub': 'capabilities?tab=skills',
  tools: 'capabilities?tab=tools',
};

const expectedAnchorRemap = Object.fromEntries(
  Object.entries(expectedLegacyRedirects).map(([id, target]) => [id, String(target).split('?')[0]]),
);

const expectedSlotKeys = [
  'settings_general',
  'settings_access',
  'settings_capabilities',
  'settings_environment',
  'settings_storage',
  'settings_theme',
  'settings_advanced',
  'about',
  'update',
  'workspace',
  'local_services',
  'settings_resources',
];

const expectedSettingsAdapterEvidence = [
  'SettingsHost renders ordinary routes from the hydrated App settings registry',
  'SettingsShellAdapterSlot mounts App-owned route slots without shell-owned product IA',
  'legacy route redirects and extension anchor remaps are resolved before shell rendering',
  'AionUI upstream settings intake is classified as accepted/adapt/redirect/reject before registry or slot changes',
];

const expectedPageAdapterEntries = {
  access: 'packages/desktop/src/renderer/pages/settings/accessProjection.ts',
  environment: 'packages/desktop/src/renderer/pages/settings/RuntimeSettings/runtimeSettingsViewModel.ts',
  storage: 'packages/desktop/src/renderer/pages/settings/storageProjection.ts',
  capabilities: 'packages/desktop/src/renderer/pages/settings/capabilitiesProjection.ts',
};

const expectedVisualQaRoutes = [
  '/settings/general',
  '/settings/access',
  '/settings/workspace',
  '/settings/capabilities',
  '/settings/resources',
  '/settings/environment',
  '/settings/storage',
  '/settings/appearance',
];
const expectedVisualQaSecondaryRoutes = [
  '/settings/advanced',
  '/settings/about',
];
const expectedVisualQaCompatibilityRedirects = [
  'update->environment#updates',
  'theme->appearance#themes',
  'local-services->environment#services',
];
const expectedVisualQaStatusAnchors = [
  'single_global_search',
  'diagnostics_collapsed_by_default',
  'single_primary_action_max',
  'exception_only_emphasis',
  'legacy_or_compatibility_redirect_landing',
];
const expectedVisualQaManifestFields = [
  'command',
  'commit',
  'viewport',
  'route',
  'screenshot_path',
  'status_anchors',
];

const matrixRouteScopes = {
  settings_general: appOwnedSettingsRouteScopes.settings_general,
  access: appOwnedSettingsRouteScopes.access,
  capabilities: appOwnedSettingsRouteScopes.capabilities,
  settings_resources: appOwnedSettingsRouteScopes.resources,
  environment: appOwnedSettingsRouteScopes.environment,
  settings_local_services: appOwnedSettingsRouteScopes.local_services,
  storage: appOwnedSettingsRouteScopes.storage,
  about: appOwnedSettingsRouteScopes.about,
  update: appOwnedSettingsRouteScopes.update,
  settings_theme: appOwnedSettingsRouteScopes.settings_theme,
  advanced: appOwnedSettingsRouteScopes.advanced,
  settings_workspace: appOwnedSettingsRouteScopes.workspace,
};

const expectedIaGroupByMatrixPageId = {
  settings_general: 'overview',
  access: 'setup_access',
  capabilities: 'capabilities',
  settings_resources: 'resources',
  environment: 'maintenance',
  settings_local_services: 'maintenance',
  storage: 'data_storage',
  about: 'advanced',
  update: 'maintenance',
  settings_theme: 'preferences',
  advanced: 'advanced',
  settings_workspace: 'overview',
};

export function validateSettingsControlPlane(controlPlane, guiContract, pageStateMatrix, productProfile, adapterContract) {
  if (controlPlane?.purpose !== 'app_owned_settings_control_plane') {
    throw new Error('Settings control plane purpose must be app_owned_settings_control_plane');
  }
  if (controlPlane.owner !== 'one-person-lab-app' || controlPlane.state !== 'active') {
    throw new Error('Settings control plane must be active and App-owned');
  }
  if (controlPlane.source_contract_ref !== 'contracts/app-gui-product-contract.json#settings_navigation') {
    throw new Error('Settings control plane must point at the App GUI settings navigation source contract');
  }
  if (controlPlane.product_profile_projection_target !== 'settings.control_plane') {
    throw new Error('Settings control plane must project to settings.control_plane');
  }
  assertDeepEqualJson(controlPlane.ordinary_visible_tabs, appOwnedSettingsTabs, 'Settings control plane ordinary tabs');
  assertDeepEqualJson(
    controlPlane.ordinary_routes?.map((route) => route.id),
    appOwnedSettingsTabs,
    'Settings control plane ordinary route ids',
  );
  assertDeepEqualJson(
    controlPlane.ordinary_routes?.map((route) => route.product_page_id),
    appOwnedSettingsTopLevelEntryIds,
    'Settings control plane ordinary product page ids',
  );
  assertDeepEqualJson(
    Object.fromEntries(
      (controlPlane.ordinary_routes ?? []).map((route) => [
        route.product_page_id,
        { label_zh: route.default_label_zh, label_en: route.default_label_en },
      ]),
    ),
    appOwnedSettingsTopLevelLabels,
    'Settings control plane top-level product labels',
  );
  assertDeepEqualJson(
    controlPlane.secondary_pages?.map((page) => page.id),
    appOwnedSecondarySettingsPages,
    'Settings control plane secondary page ids',
  );
  assertDeepEqualJson(
    [...new Set(controlPlane.ordinary_routes?.map((route) => route.ia_group))],
    appOwnedSettingsIaGroupIds.filter((groupId) => groupId !== 'advanced'),
    'Settings control plane IA groups',
  );
  assertDeepEqualJson(
    controlPlane.ordinary_routes?.map((route) => route.slot_id),
    [
      'settings_general',
      'settings_access',
      'workspace',
      'settings_capabilities',
      'settings_resources',
      'settings_environment',
      'settings_storage',
      'settings_theme',
    ],
    'Settings control plane ordinary slot ids',
  );
  assertDeepEqualJson(controlPlane.legacy_route_redirects, expectedLegacyRedirects, 'Settings control plane legacy redirects');
  assertDeepEqualJson(controlPlane.extension_anchor_remap, expectedAnchorRemap, 'Settings control plane extension anchor remap');
  assertDeepEqualJson(
    controlPlane.compatibility_redirects,
    appOwnedSettingsCompatibilityRedirects,
    'Settings control plane compatibility redirects',
  );
  if (controlPlane.legacy_route_redirects?.about || controlPlane.extension_anchor_remap?.about) {
    throw new Error('Settings About must remain an independent /settings/about page');
  }
  assertDeepEqualJson(
    Object.keys(controlPlane.slot_registry ?? {}),
    expectedSlotKeys,
    'Settings control plane slot registry keys',
  );
  assertEveryRouteHasSlot(controlPlane);
  validateHydratedSettingsRegistry(controlPlane);
  validateSettingsShellAdapterSlotContract(controlPlane);
  validateSettingsModelReasoningPolicy(controlPlane, guiContract, productProfile);
  validateSettingsProjection(controlPlane.settings_projection);
  validateSettingsExperienceContract(controlPlane.experience_contract);
  validateSettingsPageAdapterPolicy(controlPlane);
  validateSettingsVisualQaPolicy(controlPlane);
  validateSettingsProductSystemChecklist(controlPlane);
  validateSettingsUpstreamIntake(controlPlane);
  if (controlPlane.default_route !== '/settings/general') {
    throw new Error('Settings control plane default route must be /settings/general');
  }
  const capabilitiesRoute = (controlPlane.ordinary_routes ?? []).find((route) => route.id === 'capabilities');
  if (capabilitiesRoute?.state_source !== expectedCapabilitiesStateSource) {
    throw new Error('Settings capabilities route must read from canonical agent_packages plus Home shortcut and task-awareness projections');
  }
  if (controlPlane.extension_tab_policy?.legacy_anchor_remap_required !== true) {
    throw new Error('Settings control plane must require extension legacy anchor remapping');
  }
  if (controlPlane.state_action_policy?.action_route !== appActionRoute) {
    throw new Error('Settings control plane must route mutations through opl app action execute');
  }
  assertDeepEqualJson(
    controlPlane.state_action_policy?.recommended_action_ids,
    { doctor: 'doctor', repair: 'repair' },
    'Settings control plane recommended action ids',
  );
  assertIncludesAll(
    controlPlane.state_action_policy?.shell_must_not_own,
    ['runtime truth', 'provider implementation', 'domain truth', 'owner receipts', 'release readiness'],
    'Settings control plane shell_must_not_own',
  );
  validateCrossContractConsistency(controlPlane, guiContract, pageStateMatrix, productProfile);
  validateSettingsIa(guiContract?.settings_navigation?.settings_ia);
  validateSettingsPageStateMatrix(
    pageStateMatrix,
    controlPlane.experience_contract,
    controlPlane.compatibility_redirects,
  );
  validateProductProfileSettings(productProfile, controlPlane);
  validateSettingsShellAdapterSlot(adapterContract);
}

export function validateSettingsControlPlaneBehavior({
  guiContract,
  pageStateMatrix,
  productProfile,
  adapterContract,
}) {
  if (guiContract) {
    validateSettingsIa(guiContract?.settings_navigation?.settings_ia);
  }
  if (pageStateMatrix) {
    validateSettingsPageStateMatrix(pageStateMatrix);
  }
  if (productProfile) {
    assertDeepEqualJson(productProfile.settings?.visible_tabs, appOwnedSettingsTabs, 'Product profile settings visible tabs');
  }
  if (adapterContract) {
    validateSettingsShellAdapterSlot(adapterContract);
  }
}

function buildHydratedSettingsRegistry(controlPlane) {
  return {
    ordinary_routes: (controlPlane.ordinary_routes ?? []).map((route) => {
      const slot = controlPlane.slot_registry?.[route.slot_id];
      return {
        id: route.id,
        path: route.path,
        route_scope: 'ordinary',
        ia_group: route.ia_group,
        slot_id: route.slot_id,
        component_key: slot?.component_key ?? null,
        wrapper_policy: slot?.wrapper_policy ?? null,
      };
    }),
    secondary_pages: (controlPlane.secondary_pages ?? []).map((page) => {
      const slot = controlPlane.slot_registry?.[page.slot_id];
      return {
        id: page.id,
        path: page.path,
        route_scope: page.visibility,
        ia_group: page.ia_group,
        slot_id: page.slot_id,
        component_key: slot?.component_key ?? null,
      };
    }),
    compatibility_redirects: controlPlane.compatibility_redirects ?? {},
    legacy_route_redirects: controlPlane.legacy_route_redirects ?? {},
    extension_anchor_remap: controlPlane.extension_anchor_remap ?? {},
  };
}

function resolveSettingsControlPlaneRoute(controlPlane, routeId) {
  const registry = buildHydratedSettingsRegistry(controlPlane);
  const ordinaryRoute = registry.ordinary_routes.find((route) => route.id === routeId);
  if (ordinaryRoute) {
    return settingsRouteResolution(routeId, ordinaryRoute.id, ordinaryRoute, 'ordinary');
  }
  const secondaryRoute = registry.secondary_pages.find((route) => route.id === routeId);
  if (secondaryRoute) {
    return settingsRouteResolution(routeId, secondaryRoute.id, secondaryRoute, 'secondary_or_deep_link');
  }
  const compatibilityRedirect = registry.compatibility_redirects[routeId];
  if (compatibilityRedirect) {
    const targetRoute = registry.ordinary_routes.find(
      (route) => route.id === compatibilityRedirect.target_route_id,
    );
    if (!targetRoute) {
      throw new Error(
        `Settings compatibility route ${routeId} redirects to unknown Settings route ${compatibilityRedirect.target_route_id}`,
      );
    }
    return settingsRouteResolution(
      routeId,
      targetRoute.id,
      targetRoute,
      'compatibility_redirect',
      compatibilityRedirect.anchor,
      compatibilityRedirect.anchor_query_param,
    );
  }
  const redirectTarget = registry.legacy_route_redirects[routeId];
  if (redirectTarget) {
    const [targetWithQuery, anchor] = String(redirectTarget).split('#');
    const [targetId, query] = targetWithQuery.split('?');
    const targetRoute =
      registry.ordinary_routes.find((route) => route.id === targetId) ??
      registry.secondary_pages.find((route) => route.id === targetId);
    if (!targetRoute) {
      throw new Error(`Settings legacy route ${routeId} redirects to unknown Settings route ${targetId}`);
    }
    return settingsRouteResolution(
      routeId,
      targetRoute.id,
      {
        ...targetRoute,
        path: buildSettingsRoutePath(targetRoute.path, query, anchor),
      },
      'legacy_redirect',
      anchor ?? null,
      anchor ? 'section' : null,
    );
  }
  return settingsRouteResolution(
    routeId,
    'advanced',
    registry.secondary_pages.find((route) => route.id === 'advanced'),
    'unknown_redirect',
  );
}

function buildSettingsRoutePath(path, query, anchor) {
  const parameters = [query, anchor ? `section=${encodeURIComponent(anchor)}` : null].filter(Boolean);
  return parameters.length > 0 ? `${path}?${parameters.join('&')}` : path;
}

function remapSettingsExtensionAnchor(controlPlane, anchorId) {
  const remapped = controlPlane.extension_anchor_remap?.[anchorId];
  if (remapped) {
    return remapped;
  }
  if (controlPlane.extension_tab_policy?.unknown_anchor === 'treat_as_unanchored') {
    return 'advanced';
  }
  throw new Error(`Settings extension anchor ${anchorId} is unknown`);
}

function validateCrossContractConsistency(controlPlane, guiContract, pageStateMatrix, productProfile) {
  const settingsNavigation = guiContract?.settings_navigation;
  assertDeepEqualJson(
    settingsNavigation?.ordinary_visible_tabs,
    controlPlane.ordinary_visible_tabs,
    'Settings control plane ordinary tabs vs GUI contract',
  );
  assertDeepEqualJson(
    settingsNavigation?.settings_ia?.ordinary_route_ids,
    controlPlane.ordinary_routes.map((route) => route.id),
    'Settings control plane route ids vs GUI contract settings IA',
  );
  assertDeepEqualJson(
    settingsNavigation?.settings_ia?.secondary_or_deep_link_route_ids,
    controlPlane.secondary_pages.map((page) => page.id),
    'Settings control plane secondary pages vs GUI contract settings IA',
  );
  assertDeepEqualJson(
    settingsNavigation?.compatibility_redirects,
    controlPlane.compatibility_redirects,
    'Settings control plane compatibility redirects vs GUI contract',
  );
  assertDeepEqualJson(
    guiContract?.pages?.settings_access?.browser_access_entry,
    controlPlane.experience_contract?.page_contracts?.access?.browser_access_entry,
    'Settings Access browser entry vs GUI contract',
  );
  assertDeepEqualJson(
    guiContract?.pages?.settings_capabilities?.codex_plugin_directory_target?.tab_contract,
    controlPlane.experience_contract?.page_contracts?.capabilities?.tab_contract,
    'Settings Agents & Capabilities tab contract vs GUI contract',
  );
  assertDeepEqualJson(
    guiContract?.pages?.settings_resources?.action_behavior,
    controlPlane.experience_contract?.page_contracts?.resources?.action_behavior,
    'Settings Resources action behavior vs GUI contract',
  );
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(controlPlane.legacy_route_redirects).filter(([id]) => id !== 'about').map(([id, target]) => [
        id,
        id === 'assistants' ? target : String(target).split('?')[0],
      ]),
    ),
    settingsNavigation?.legacy_route_redirects,
    'Settings control plane legacy redirects vs GUI contract',
  );
  const pageIds = new Set((pageStateMatrix?.pages ?? []).map((page) => page.id));
  for (const route of controlPlane.ordinary_routes) {
    if (!pageIds.has(route.id) && !pageIds.has(route.slot_id) && !pageIds.has(`settings_${route.id}`)) {
      throw new Error(`Settings control plane route ${route.id} must have a page-state matrix entry`);
    }
  }
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.ordinary_visible_tabs,
    controlPlane.ordinary_visible_tabs,
    'Product profile settings.control_plane ordinary tabs',
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.ordinary_routes?.map((route) => route.id),
    controlPlane.ordinary_routes.map((route) => route.id),
    'Product profile settings.control_plane ordinary route ids',
  );
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(productProfile?.settings?.control_plane?.legacy_route_redirects ?? {})
        .filter(([id]) => id !== 'about' && id !== 'assistants'),
    ),
    Object.fromEntries(
      Object.entries(controlPlane.legacy_route_redirects).filter(([id]) => id !== 'assistants'),
    ),
    'Product profile settings.control_plane legacy redirects',
  );
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(productProfile?.settings?.control_plane?.extension_anchor_remap ?? {})
        .filter(([id]) => id !== 'about'),
    ),
    controlPlane.extension_anchor_remap,
    'Product profile settings.control_plane extension anchors',
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.slot_registry,
    controlPlane.slot_registry,
    'Product profile settings.control_plane slot registry',
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.state_action_policy?.recommended_action_ids,
    controlPlane.state_action_policy?.recommended_action_ids,
    'Product profile settings.control_plane recommended action ids',
  );
}

function assertEveryRouteHasSlot(controlPlane) {
  const slotRegistry = controlPlane.slot_registry ?? {};
  for (const route of [...(controlPlane.ordinary_routes ?? []), ...(controlPlane.secondary_pages ?? [])]) {
    if (!slotRegistry[route.slot_id]) {
      throw new Error(`Settings control plane slot registry must declare ${route.slot_id}`);
    }
  }
}

function validateSettingsIa(settingsIa) {
  if (settingsIa?.schema !== 'settings_ia.v1') {
    throw new Error('Settings control plane must expose settings_ia.v1 behavior');
  }
  if (settingsIa.authority !== 'one-person-lab-app') {
    throw new Error('Settings control plane authority must stay in one-person-lab-app');
  }
  if (settingsIa.source_ref !== 'contracts/app-gui-product-contract.json#settings_navigation') {
    throw new Error('Settings control plane must keep the App GUI settings navigation as its source ref');
  }
  if (settingsIa.matrix_ref !== 'contracts/app-page-state-matrix.json#pages') {
    throw new Error('Settings control plane must keep the App page-state matrix as its matrix ref');
  }
  assertDeepEqualJson(settingsIa.ordinary_route_ids, appOwnedSettingsTabs, 'Settings control plane ordinary route ids');
  assertDeepEqualJson(
    settingsIa.secondary_or_deep_link_route_ids,
    appOwnedSecondarySettingsPages,
    'Settings control plane secondary/deep-link route ids',
  );
  assertDeepEqualJson(
    settingsIa.compatibility_route_ids,
    Object.keys(appOwnedSettingsCompatibilityRedirects),
    'Settings control plane compatibility route ids',
  );
  if (settingsIa.experience_contract_ref !== 'contracts/app-settings-control-plane.json#experience_contract') {
    throw new Error('Settings IA must reference the Settings experience contract');
  }
  assertDeepEqualJson(settingsIa.group_ids, appOwnedSettingsIaGroupIds, 'Settings control plane IA group ids');
  if (settingsIa.route_identity_policy !== 'keep_current_shell_route_ids_distinct_from_user_facing_ia_groups') {
    throw new Error('Settings control plane must keep shell route ids distinct from user-facing IA groups');
  }
  if (
    settingsIa.route_promotion_policy !==
    'secondary_or_deep_link_routes_must_not_be_promoted_to_ordinary_routes_without_contract_matrix_validator_and_test_updates'
  ) {
    throw new Error('Settings control plane must gate route promotion through contract, matrix, validator, and tests');
  }
  validateSettingsTopLevelEntries(settingsIa.top_level_entries, settingsIa.top_level_navigation_policy);
  assertDeepEqualJson(
    (settingsIa.user_task_entries ?? []).map((entry) => entry.id),
    appOwnedSettingsTaskEntryIds,
    'Settings control plane user task entries',
  );
  for (const entry of settingsIa.user_task_entries ?? []) {
    if (!appOwnedSettingsIaGroupIds.includes(entry.group_id)) {
      throw new Error(`Settings control plane task entry ${entry.id} has unknown group ${entry.group_id}`);
    }
    assertIncludesAll(
      Object.keys(entry),
      appOwnedSettingsTaskEntryMetadataFields,
      `Settings control plane task entry ${entry.id} metadata fields`,
    );
    for (const field of appOwnedSettingsTaskEntryMetadataFields) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
        throw new Error(`Settings control plane task entry ${entry.id} must declare ${field}`);
      }
    }
    assertKnownSettingsRoute(entry.route_id, `Settings control plane task entry ${entry.id}`);
    for (const routeId of entry.secondary_route_ids ?? []) {
      assertKnownSettingsRoute(routeId, `Settings control plane task entry ${entry.id} secondary route`);
    }
  }
  const customAssistantEntry = (settingsIa.user_task_entries ?? []).find((entry) => entry.id === 'custom_assistant');
  if (
    customAssistantEntry?.route_id !== 'capabilities' ||
    customAssistantEntry.tab_id !== 'assistants' ||
    customAssistantEntry.anchor_id !== 'custom-assistants' ||
    customAssistantEntry.component_key !== 'AssistantSettings' ||
    customAssistantEntry.entry_policy !== 'open_assistant_creation_or_management_not_package_repair'
  ) {
    throw new Error('Settings custom assistant entry must mount AssistantSettings in the on-demand assistants tab');
  }
  validateSettingsProtocols(settingsIa.protocols);
}

function validateSettingsTopLevelEntries(entries, policy) {
  if (
    policy?.entry_model !== 'user_visible_top_level_entries_match_ordinary_navigation_entries' ||
    policy?.workspace_visibility !== 'workspace_is_user_visible_top_level_navigation_entry' ||
    policy?.resources_visibility !== 'resources_is_user_visible_top_level_navigation_entry' ||
    policy?.advanced_visibility !== 'advanced_is_secondary_or_deep_link_not_ordinary_navigation' ||
    policy?.about_visibility !== 'about_is_independent_secondary_page' ||
    policy?.compatibility_route_policy !==
      'update_theme_and_local_services_redirect_to_owner_route_and_anchor' ||
    policy?.shell_route_compatibility !==
      'carrier_route_ids_remain_stable_while_product_page_ids_are_canonical'
  ) {
    throw new Error('Settings IA must declare eight product pages, independent About, and compatibility anchor routes');
  }
  assertDeepEqualJson(
    (entries ?? []).map((entry) => entry.id),
    appOwnedSettingsTopLevelEntryIds,
    'Settings IA top-level user-visible entries',
  );
  const workspace = (entries ?? []).find((entry) => entry.id === 'workspace');
  if (
    workspace?.route_id !== 'workspace' ||
    workspace?.route_scope !== 'ordinary' ||
    workspace?.visibility !== 'top_level_navigation'
  ) {
    throw new Error('Settings IA Workspace must be ordinary top-level navigation');
  }
  const resources = (entries ?? []).find((entry) => entry.id === 'resources');
  if (
    resources?.route_id !== 'resources' ||
    resources?.route_scope !== 'ordinary' ||
    resources?.visibility !== 'top_level_navigation'
  ) {
    throw new Error('Settings IA Resources must be ordinary top-level navigation');
  }
  assertDeepEqualJson(
    Object.fromEntries((entries ?? []).map((entry) => [entry.id, {
      label_zh: entry.label_zh,
      label_en: entry.label_en,
    }])),
    appOwnedSettingsTopLevelLabels,
    'Settings IA top-level product labels',
  );
  for (const entry of entries ?? []) {
    assertKnownSettingsRoute(entry.route_id, `Settings IA top-level entry ${entry.id}`);
    assertIncludesAll(
      Object.keys(entry),
      appOwnedSettingsTaskEntryMetadataFields,
      `Settings IA top-level entry ${entry.id} metadata fields`,
    );
  }
}

function validateSettingsProtocols(protocols) {
  assertDeepEqualJson(protocols?.issue_queue?.statuses, appOwnedSettingsIssueStatuses, 'Settings control plane issue statuses');
  if (protocols?.issue_queue?.owner_policy !== 'App renders issue refs and action routes without writing runtime/domain truth') {
    throw new Error('Settings control plane issue queue must be render-only for runtime/domain truth');
  }
  if (
    protocols?.action_catalog?.source !== 'app_state.actions' ||
    protocols?.action_catalog?.action_route !== appActionRoute ||
    protocols?.action_catalog?.mutation_policy !== 'all_mutating_settings_actions_go_through_App_action_routes'
  ) {
    throw new Error('Settings control plane actions must route through app_state.actions and the App action route');
  }
  assertDeepEqualJson(protocols.settings_search, appOwnedSettingsSearchProtocol, 'Settings control plane search protocol');
  assertDeepEqualJson(
    protocols.card_protocol?.required_fields,
    appOwnedSettingsCardFields,
    'Settings control plane card fields',
  );
  if (protocols.card_protocol?.first_screen_policy !== 'summary_first_no_raw_ids_or_receipts_until_disclosed') {
    throw new Error('Settings control plane cards must stay summary-first before raw refs');
  }
  assertDeepEqualJson(
    protocols.confirmation_drawer?.required_fields,
    appOwnedSettingsConfirmationFields,
    'Settings control plane confirmation fields',
  );
  if (
    protocols.confirmation_drawer?.copy_policy !==
    'must_explain_what_changes_what_does_not_change_and_the_recovery_reference_before_mutation'
  ) {
    throw new Error('Settings control plane confirmation must explain change boundaries and recovery references');
  }
  assertDeepEqualJson(
    protocols.post_update_notice?.required_fields,
    appOwnedSettingsPostUpdateNoticeFields,
    'Settings control plane post-update notice fields',
  );
  if (
    protocols.post_update_notice?.visibility_policy !== 'ordinary_layer_after_mutation_or_background_action_until_next_refresh' ||
    protocols.post_update_notice?.receipt_policy !== 'show_receipt_ref_without_claiming_domain_or_release_readiness'
  ) {
    throw new Error('Settings control plane post-update notices must not claim domain or release readiness');
  }
  const makeUsableAction = protocols.make_usable_action;
  if (
    makeUsableAction?.placement !== 'settings_environment.maintenance_hub.primary_action' ||
    makeUsableAction?.orchestration_policy !== 'shell_orchestrates_existing_app_and_managed_update_actions_only' ||
    makeUsableAction?.post_action_notice !==
      'show restart or reload guidance from managed update status/result without claiming domain, release, or production readiness'
  ) {
    throw new Error('Settings control plane make-usable action must orchestrate existing App/updater actions only');
  }
  assertDeepEqualJson(
    makeUsableAction.allowed_steps,
    appOwnedSettingsMakeUsableAllowedSteps,
    'Settings control plane make-usable allowed steps',
  );
  assertDeepEqualJson(
    makeUsableAction.must_not,
    appOwnedSettingsMakeUsableForbiddenSteps,
    'Settings control plane make-usable forbidden steps',
  );
  if (
    protocols.diagnostics?.default_visibility !== 'collapsed_advanced_only' ||
    protocols.diagnostics?.raw_ref_policy !== 'raw_paths_ids_receipts_json_and_component_ids_require_disclosure_or_advanced_route'
  ) {
    throw new Error('Settings control plane diagnostics must be collapsed and advanced/disclosure-only');
  }
  if (
    protocols.deep_link_policy?.unknown_route_policy !== 'redirect_to_nearest_app_owned_settings_group' ||
    protocols.deep_link_policy?.legacy_route_policy !== 'redirect_using_settings_navigation.legacy_route_redirects' ||
    protocols.deep_link_policy?.secondary_route_policy !==
      'open_advanced_or_about_without_ordinary_tab_promotion' ||
    protocols.deep_link_policy?.compatibility_route_policy !==
      'resolve_settings_navigation.compatibility_redirects_then_navigate_route_id_and_anchor'
  ) {
    throw new Error('Settings control plane deep links must separate legacy, secondary, and compatibility routes');
  }
  assertDeepEqualJson(
    protocols.visual_qa_expectations?.required_targets,
    appOwnedSettingsVisualQaTargets,
    'Settings control plane visual QA targets',
  );
}

function validateSettingsPageStateMatrix(
  pageStateMatrix,
  experienceContract = null,
  compatibilityRedirects = appOwnedSettingsCompatibilityRedirects,
) {
  assertDeepEqualJson(
    pageStateMatrix?.settings_compatibility_redirects,
    compatibilityRedirects,
    'Page-state Settings compatibility redirects',
  );
  for (const [pageId, expected] of Object.entries(matrixRouteScopes)) {
    const page = pageById(pageStateMatrix, pageId);
    if (page.settings_ia_ref !== settingsIaRef) {
      throw new Error(`${pageId} must reference ${settingsIaRef}`);
    }
    if (page.route_id !== expected.route_id) {
      throw new Error(`${pageId} route_id must be ${expected.route_id}`);
    }
    if (page.route_scope !== expected.route_scope) {
      throw new Error(`${pageId} route_scope must be ${expected.route_scope}`);
    }
    if (page.ia_group !== expectedIaGroupByMatrixPageId[pageId]) {
      throw new Error(`${pageId} ia_group must be ${expectedIaGroupByMatrixPageId[pageId]}`);
    }
  }
  assertDeepEqualJson(
    pageById(pageStateMatrix, 'update').compatibility_redirect,
    compatibilityRedirects.update,
    'Update compatibility redirect page state',
  );
  assertDeepEqualJson(
    pageById(pageStateMatrix, 'settings_local_services').compatibility_redirect,
    compatibilityRedirects['local-services'],
    'Local Services compatibility redirect page state',
  );
  if (!experienceContract) return;
  for (const [productPageId, contract] of Object.entries(experienceContract.page_contracts ?? {})) {
    const page = pageById(pageStateMatrix, contract.matrix_page_id);
    if (
      page.product_page_id !== productPageId ||
      page.experience_contract_ref !==
        `contracts/app-settings-control-plane.json#experience_contract.page_contracts.${productPageId}` ||
      page.primary_action_id !== contract.primary_action.id ||
      page.technical_details_default !== 'collapsed' ||
      page.exception_emphasis !== 'attention_only'
    ) {
      throw new Error(`Page-state ${contract.matrix_page_id} must mirror ${productPageId} experience semantics`);
    }
    assertDeepEqualJson(
      page.required_dom,
      contract.required_dom,
      `Page-state ${productPageId} required DOM`,
    );
    assertDeepEqualJson(
      page.required_anchors,
      contract.required_anchors,
      `Page-state ${productPageId} required anchors`,
    );
    assertDeepEqualJson(
      page.search_entry_ids,
      contract.search_entry_ids,
      `Page-state ${productPageId} search entries`,
    );
    if (productPageId === 'access') {
      assertDeepEqualJson(
        page.browser_access_entry,
        contract.browser_access_entry,
        'Page-state Access browser entry',
      );
    }
    if (productPageId === 'capabilities') {
      assertDeepEqualJson(
        page.codex_plugin_directory_target?.tab_contract,
        contract.tab_contract,
        'Page-state Agents & Capabilities tab contract',
      );
    }
    if (productPageId === 'resources') {
      assertDeepEqualJson(
        page.action_behavior,
        contract.action_behavior,
        'Page-state Resources action behavior',
      );
    }
  }
}

function validateProductProfileSettings(productProfile, controlPlane) {
  assertDeepEqualJson(productProfile.settings?.visible_tabs, appOwnedSettingsTabs, 'Product profile settings visible tabs');
  assertDeepEqualJson(
    productProfile.settings?.legacy_route_redirects,
    Object.fromEntries(
      Object.entries(controlPlane.legacy_route_redirects)
        .filter(([id]) => id !== 'about')
        .map(([id, target]) => [id, String(target).split('?')[0]]),
    ),
    'Product profile settings legacy redirects',
  );
}

function validateHydratedSettingsRegistry(controlPlane) {
  const registry = buildHydratedSettingsRegistry(controlPlane);
  assertDeepEqualJson(
    registry.ordinary_routes.map((route) => route.id),
    appOwnedSettingsTabs,
    'Hydrated Settings registry ordinary route ids',
  );
  assertDeepEqualJson(
    registry.ordinary_routes.map((route) => route.component_key),
    [
      'OverviewSettings',
      'AccessSettingsContent',
      'WorkspaceSettings',
      'CapabilitiesSettingsContent',
      'ResourcesSettingsContent',
      'RuntimeSettings',
      'StorageSettings',
      'AppearanceModalContent',
    ],
    'Hydrated Settings registry ordinary component keys',
  );
  assertDeepEqualJson(
    registry.secondary_pages.map((route) => route.route_scope),
    appOwnedSecondarySettingsPages.map(() => 'secondary_or_deep_link'),
    'Hydrated Settings registry secondary route scopes',
  );
  for (const routeId of [...appOwnedSettingsTabs, ...appOwnedSecondarySettingsPages]) {
    const resolution = resolveSettingsControlPlaneRoute(controlPlane, routeId);
    if (!['ordinary', 'secondary_or_deep_link'].includes(resolution.route_scope)) {
      throw new Error(`Settings route ${routeId} must resolve as ordinary or secondary/deep-link`);
    }
  }
  for (const [routeId, redirect] of Object.entries(appOwnedSettingsCompatibilityRedirects)) {
    const resolution = resolveSettingsControlPlaneRoute(controlPlane, routeId);
    if (
      resolution.route_scope !== 'compatibility_redirect' ||
      resolution.target_id !== redirect.target_route_id ||
      resolution.anchor !== redirect.anchor ||
      resolution.anchor_query_param !== 'section'
    ) {
      throw new Error(`Settings compatibility route ${routeId} must resolve to its owner route and anchor`);
    }
  }
  for (const legacyRoute of Object.keys(expectedLegacyRedirects)) {
    const redirectTarget = String(controlPlane.legacy_route_redirects[legacyRoute]).split('?')[0];
    const knownTargets = new Set([...appOwnedSettingsTabs, ...appOwnedSecondarySettingsPages]);
    if (!knownTargets.has(redirectTarget)) {
      throw new Error(`Settings legacy route ${legacyRoute} must target a known Settings route`);
    }
    if (
      !appOwnedSecondarySettingsPages.includes(legacyRoute) &&
      resolveSettingsControlPlaneRoute(controlPlane, legacyRoute).route_scope !== 'legacy_redirect'
    ) {
      throw new Error(`Settings legacy route ${legacyRoute} must resolve through the legacy redirect table`);
    }
    if (!knownTargets.has(remapSettingsExtensionAnchor(controlPlane, legacyRoute))) {
      throw new Error(`Settings extension anchor ${legacyRoute} must remap to a known Settings route`);
    }
  }
  const assistantsResolution = resolveSettingsControlPlaneRoute(controlPlane, 'assistants');
  if (
    assistantsResolution.target_id !== 'capabilities' ||
    assistantsResolution.path !== '/settings/capabilities?tab=assistants&section=custom-assistants' ||
    assistantsResolution.anchor !== 'custom-assistants' ||
    assistantsResolution.anchor_query_param !== 'section'
  ) {
    throw new Error('Settings legacy assistants route must open AssistantSettings at custom-assistants');
  }
}

function validateSettingsShellAdapterSlotContract(controlPlane) {
  const slot = controlPlane.shell_adapter_slot;
  if (slot?.host_component !== 'SettingsHost') {
    throw new Error('Settings control plane shell adapter slot must declare SettingsHost');
  }
  if (slot?.adapter_slot !== 'SettingsShellAdapterSlot') {
    throw new Error('Settings control plane shell adapter slot must declare SettingsShellAdapterSlot');
  }
  if (slot?.registry_source !== settingsControlPlaneContractRef) {
    throw new Error('SettingsHost must consume the App Settings control plane contract');
  }
  assertDeepEqualJson(
    slot?.shell_may_own,
    ['container layout', 'tab switching', 'extension tab mount/keep-alive', 'route sync'],
    'SettingsShellAdapterSlot shell_may_own',
  );
  assertDeepEqualJson(
    slot?.app_owns,
    ['tab order', 'user semantics', 'OPL page slots', 'state/action sources', 'upstream intake classification'],
    'SettingsShellAdapterSlot app_owns',
  );
}

function validateSettingsModelReasoningPolicy(controlPlane, guiContract, productProfile) {
  const policy = controlPlane.model_reasoning_policy_source;
  if (policy?.owner !== 'one-person-lab-app') {
    throw new Error('Settings model/reasoning policy must be App-owned');
  }
  assertIncludesAll(
    policy?.source_refs,
    [
      'contracts/app-product-profile.json#codex',
      'contracts/app-product-profile.json#gui.home.codex_model_display_options',
      'contracts/app-gui-product-contract.json#executor_policy',
    ],
    'Settings model/reasoning policy source refs',
  );
  if (policy.default_model_ref !== 'contracts/app-product-profile.json#codex.default_model') {
    throw new Error('Settings default model must be derived from the App product profile');
  }
  if (policy.default_reasoning_effort_ref !== 'contracts/app-product-profile.json#codex.default_reasoning_effort') {
    throw new Error('Settings default reasoning effort must be derived from the App product profile');
  }
  if (policy.settings_surface !== 'settings_access.model_access') {
    throw new Error('Settings model/reasoning policy must surface through the Access model section');
  }
  if (policy.adapter_policy !== 'Aion/Hermes/shell render App-derived model and reasoning policy only') {
    throw new Error('Settings model/reasoning policy must keep shells as adapters only');
  }
  assertIncludesAll(
    policy.shell_must_not_own,
    [
      'default model',
      'frontier model preference order',
      'reasoning effort options',
      'model access readiness truth',
      'provider selector as ordinary UI',
    ],
    'Settings model/reasoning shell_must_not_own',
  );
  if (
    guiContract?.executor_policy?.default_model !== productProfile?.codex?.default_model ||
    guiContract?.executor_policy?.default_reasoning_effort !== productProfile?.codex?.default_reasoning_effort
  ) {
    throw new Error('Settings model/reasoning policy must match App product profile and GUI executor policy defaults');
  }
  if (
    guiContract?.executor_policy?.model_display_options_policy?.source !==
    'contracts/app-product-profile.json#gui.home.codex_model_display_options'
  ) {
    throw new Error('Settings model/reasoning display options must be derived from the App product profile');
  }
  if (!String(policy.release_evidence_policy ?? '').includes('does not prove release cohort')) {
    throw new Error('Settings model/reasoning policy must keep release/live evidence separate');
  }
}

export function validateSettingsExperienceContract(experience) {
  if (
    experience?.schema !== 'settings_codex_style_experience.v1' ||
    experience.owner !== 'one-person-lab-app' ||
    experience.purpose !== 'machine_verifiable_settings_visual_search_page_and_dom_contract'
  ) {
    throw new Error('Settings experience contract must be active App-owned Codex-style behavior');
  }
  if (
    experience.source_contract_ref !==
      'contracts/app-gui-product-contract.json#settings_navigation.settings_ia' ||
    experience.page_state_matrix_ref !== 'contracts/app-page-state-matrix.json#pages'
  ) {
    throw new Error('Settings experience contract must bind GUI authority and the page-state matrix');
  }
  assertDeepEqualJson(
    experience.visual_system,
    appOwnedSettingsVisualSystem,
    'Settings experience visual system',
  );

  const search = experience.global_search;
  if (
    search?.global_entry_count !== 1 ||
    search.entry_testid !== 'settings-search-input' ||
    search.results_testid !== 'settings-search-results' ||
    search.result_item_testid !== 'settings-search-result' ||
    search.empty_state_testid !== 'settings-search-empty' ||
    search.index_granularity !== 'item' ||
    search.result_label_format !== '{page_label} > {entry_label}' ||
    search.result_navigation !== 'route_id_plus_anchor' ||
    search.anchor_query_param !== 'section' ||
    search.hash_router_policy !==
      'use_route_query_section_when_a_second_hash_fragment_is_not_supported' ||
    search.compatibility_index_policy !==
      'index_update_theme_and_local_services_under_their_owner_page_anchors'
  ) {
    throw new Error('Settings search must be one bilingual item-level route-and-anchor search');
  }
  assertDeepEqualJson(search.languages, ['zh-CN', 'en'], 'Settings search languages');
  assertDeepEqualJson(
    search.forbidden_duplicate_entry_testids,
    ['settings-sider-search-input', 'settings-route-search'],
    'Settings duplicate search entry testids',
  );

  const pageContracts = experience.page_contracts ?? {};
  assertDeepEqualJson(
    Object.keys(pageContracts),
    appOwnedSettingsProductPageIds,
    'Settings experience product page ids',
  );
  const routeByProductPage = new Map([
    ...appOwnedSettingsTopLevelEntryIds.map((pageId, index) => [pageId, appOwnedSettingsTabs[index]]),
    ...appOwnedSecondarySettingsPages.map((pageId) => [pageId, pageId]),
  ]);
  for (const [pageId, page] of Object.entries(pageContracts)) {
    assertIncludesAll(
      Object.keys(page),
      appOwnedSettingsPageExperienceFields,
      `Settings experience ${pageId} fields`,
    );
    if (
      page.product_page_id !== pageId ||
      page.route_id !== routeByProductPage.get(pageId) ||
      typeof page.matrix_page_id !== 'string' ||
      page.matrix_page_id.length === 0
    ) {
      throw new Error(`Settings experience ${pageId} must bind its product, route, and matrix ids`);
    }
    for (const field of ['label_zh', 'label_en', 'exception_state', 'technical_details_boundary']) {
      if (typeof page[field] !== 'string' || page[field].trim() === '') {
        throw new Error(`Settings experience ${pageId} must declare ${field}`);
      }
    }
    if (appOwnedSettingsTopLevelLabels[pageId]) {
      assertDeepEqualJson(
        { label_zh: page.label_zh, label_en: page.label_en },
        appOwnedSettingsTopLevelLabels[pageId],
        `Settings experience ${pageId} product label`,
      );
    }
    if (!Array.isArray(page.primary_information) || page.primary_information.length === 0) {
      throw new Error(`Settings experience ${pageId} must declare primary information`);
    }
    if (
      typeof page.primary_action?.id !== 'string' ||
      typeof page.primary_action?.availability !== 'string' ||
      page.primary_action.max_visible !== 1
    ) {
      throw new Error(`Settings experience ${pageId} must declare at most one primary action`);
    }
    if (
      !Array.isArray(page.required_dom?.always) ||
      !page.required_dom.always.includes(`settings-page-${pageId}`) ||
      !page.required_dom.always.includes(`settings-${pageId}-primary`) ||
      !page.required_dom.always.includes(`settings-${pageId}-technical-details`) ||
      !Array.isArray(page.required_dom?.conditional)
    ) {
      throw new Error(`Settings experience ${pageId} must declare stable DOM testids`);
    }
    assertDeepEqualJson(
      page.required_anchors,
      appOwnedSettingsPageAnchors[pageId],
      `Settings experience ${pageId} anchors`,
    );
    assertDeepEqualJson(
      page.search_entry_ids,
      appOwnedSettingsPageSearchEntryIds[pageId],
      `Settings experience ${pageId} search entry ids`,
    );
  }
  assertDeepEqualJson(
    pageContracts.access.browser_access_entry,
    appOwnedSettingsAccessBrowserEntry,
    'Settings Access browser entry',
  );
  if (!pageContracts.access.required_dom.always.includes('settings-access-browser-access')) {
    throw new Error('Settings Access must keep browser access to this computer in the required DOM');
  }
  assertDeepEqualJson(
    pageContracts.capabilities.tab_contract,
    appOwnedSettingsCapabilitiesTabContract,
    'Settings Agents & Capabilities tab contract',
  );
  assertDeepEqualJson(
    pageContracts.resources.action_behavior,
    appOwnedSettingsResourceActionBehavior,
    'Settings Resources action behavior',
  );

  if (experience.search_index?.schema !== 'settings_bilingual_item_search_index.v1') {
    throw new Error('Settings search index must use settings_bilingual_item_search_index.v1');
  }
  const entries = experience.search_index?.entries ?? [];
  const entryIds = new Set();
  for (const entry of entries) {
    assertIncludesAll(
      Object.keys(entry),
      appOwnedSettingsSearchEntryFields,
      `Settings search entry ${entry?.id ?? '<missing id>'} fields`,
    );
    if (entryIds.has(entry.id)) {
      throw new Error(`Settings search entry ${entry.id} must be unique`);
    }
    entryIds.add(entry.id);
    const page = pageContracts[entry.page_id];
    if (!page || !page.required_anchors.includes(entry.anchor)) {
      throw new Error(`Settings search entry ${entry.id} must target a declared page anchor`);
    }
    if (
      typeof entry.label_zh !== 'string' ||
      entry.label_zh.trim() === '' ||
      typeof entry.label_en !== 'string' ||
      entry.label_en.trim() === '' ||
      !Array.isArray(entry.keywords_zh) ||
      entry.keywords_zh.length === 0 ||
      !Array.isArray(entry.keywords_en) ||
      entry.keywords_en.length === 0
    ) {
      throw new Error(`Settings search entry ${entry.id} must be indexed in Chinese and English`);
    }
  }
  for (const [pageId, page] of Object.entries(pageContracts)) {
    assertDeepEqualJson(
      page.search_entry_ids,
      entries.filter((entry) => entry.page_id === pageId).map((entry) => entry.id),
      `Settings search entries for ${pageId}`,
    );
  }
  for (const redirect of Object.values(appOwnedSettingsCompatibilityRedirects)) {
    const targetPage = pageContracts[redirect.product_page_id];
    if (!targetPage?.required_anchors.includes(redirect.anchor)) {
      throw new Error(
        `Settings compatibility route ${redirect.source_route_id} must target a declared owner-page anchor`,
      );
    }
  }
  if (
    experience.live_evidence_boundary !==
    'contract_matrix_validator_and_focused_tests_do_not_prove_running_shell_runtime_or_release_readiness'
  ) {
    throw new Error('Settings experience contract must preserve the live evidence boundary');
  }
}

function validateSettingsProjection(projection) {
  if (projection?.schema !== 'settings_projection.v1') {
    throw new Error('Settings control plane must declare settings_projection.v1');
  }
  if (projection?.owner !== 'one-person-lab-app') {
    throw new Error('Settings projection must stay App-owned');
  }
  if (projection?.source !== 'opl app state --profile fast --json#settings') {
    throw new Error('Settings projection must consume the fast App settings projection');
  }
  if (
    projection?.policy !==
    'summary_first_settings_items_with_scope_owner_risk_action_details_and_editability_reason'
  ) {
    throw new Error('Settings projection must require summary-first item metadata');
  }
  assertDeepEqualJson(
    projection?.section_ids,
    appOwnedSettingsProjectionSectionIds,
    'Settings projection section ids',
  );
  assertDeepEqualJson(
    projection?.item_required_fields,
    appOwnedSettingsProjectionItemFields,
    'Settings projection item required fields',
  );
  if (
    projection?.live_evidence_policy !==
    'contract_docs_tests_do_not_prove_live_installed_release_runtime_currentness_or_owner_acceptance'
  ) {
    throw new Error('Settings projection must keep Live evidence outside contract/docs/tests completion');
  }
  const sections = projection?.sections ?? {};
  assertDeepEqualJson(Object.keys(sections), appOwnedSettingsProjectionSectionIds, 'Settings projection sections');
  for (const [sectionId, section] of Object.entries(sections)) {
    if (section?.id !== sectionId) {
      throw new Error(`Settings projection section ${sectionId} must keep matching id`);
    }
    if (!Array.isArray(section.items) || section.items.length === 0) {
      throw new Error(`Settings projection section ${sectionId} must declare at least one item`);
    }
    for (const item of section.items) {
      assertIncludesAll(
        Object.keys(item),
        appOwnedSettingsProjectionItemFields,
        `Settings projection item ${sectionId}.${item?.id ?? '<missing id>'} fields`,
      );
      for (const field of appOwnedSettingsProjectionItemFields) {
        if (typeof item[field] !== 'string' || item[field].trim() === '') {
          throw new Error(`Settings projection item ${sectionId}.${item?.id ?? '<missing id>'} must declare ${field}`);
        }
      }
    }
  }
}

function validateSettingsPageAdapterPolicy(controlPlane) {
  const policy = controlPlane.page_adapter_policy;
  if (policy?.policy !== 'settings_pages_consume_explicit_view_model_adapters') {
    throw new Error('Settings page adapter policy must require explicit view-model adapters');
  }
  const requiredPages = policy.required_pages ?? {};
  assertDeepEqualJson(
    Object.keys(requiredPages),
    Object.keys(expectedPageAdapterEntries),
    'Settings page adapter required pages',
  );
  for (const [routeId, adapterEntry] of Object.entries(expectedPageAdapterEntries)) {
    const page = requiredPages[routeId];
    if (!page) {
      throw new Error(`Settings page adapter policy is missing ${routeId}`);
    }
    if (page.route_id !== routeId) {
      throw new Error(`Settings page adapter policy ${routeId} must keep route_id ${routeId}`);
    }
    if (page.adapter_entry !== adapterEntry) {
      throw new Error(`Settings page adapter policy ${routeId} must use ${adapterEntry}`);
    }
    if (!String(page.renderer_entry ?? '').startsWith('packages/desktop/src/renderer/pages/settings/')) {
      throw new Error(`Settings page adapter policy ${routeId} must declare a Settings renderer entry`);
    }
    if (!Array.isArray(page.forbidden_sources) || page.forbidden_sources.length === 0) {
      throw new Error(`Settings page adapter policy ${routeId} must declare forbidden sources`);
    }
  }
  validateSettingsAccessCloudBoundary(requiredPages.access);
  validateSettingsCapabilitiesResourceGrouping(
    requiredPages.capabilities?.resource_grouping_surface,
    'Settings Capabilities page adapter resource grouping surface',
  );
  validateSettingsCapabilitiesDirectoryProjection(requiredPages.capabilities);
}

function validateSettingsCapabilitiesDirectoryProjection(capabilitiesPage) {
  if (capabilitiesPage?.state_source !== expectedCapabilitiesStateSource) {
    throw new Error('Settings Capabilities page adapter must read from canonical agent_packages plus Home shortcut and task-awareness projections');
  }
  const directory = capabilitiesPage?.directory_projection_surface;
  if (!directory || typeof directory !== 'object') {
    throw new Error('Settings Capabilities page adapter must declare a directory projection surface');
  }
  if (
    directory.surface !== 'settings_capabilities' ||
    directory.primary_identity !== 'installed_package_directory' ||
    directory.purpose_role !== 'secondary_tag_filter_only' ||
    directory.home_shortcut_integration !== 'inline_visibility_and_order_controls_on_package_rows'
  ) {
    throw new Error('Settings Capabilities directory projection must be package-directory first with inline Home shortcut management');
  }
  if (
    directory.canonical_projection !==
      'opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index' ||
    directory.legacy_fallback_projection !==
      'opl app state --profile fast --json#app_state.modules.items[] + home_agent_shortcuts + app_state.operator.workbench.task_drilldowns'
  ) {
    throw new Error('Settings Capabilities directory projection must record canonical and legacy fallback runtime projections');
  }
  if (
    directory.normalization_policy !==
    'shell must prefer canonical agent_packages projection and only fall back to modules.items when older runtime payloads or partial projections are still in circulation'
  ) {
    throw new Error('Settings Capabilities directory projection must explain canonical projection preference and legacy fallback');
  }
  const statusModel = directory.status_model;
  if (statusModel?.policy !== 'multi_axis_package_status_no_single_repair_bucket') {
    throw new Error('Settings Capabilities must keep a multi-axis package status model');
  }
  assertDeepEqualJson(
    statusModel?.axes,
    ['install_state', 'update_state', 'source_state', 'trust_state', 'codex_surface_state'],
    'Settings Capabilities status axes',
  );
  if (
    statusModel?.developer_source_policy !==
    'developer checkout semantics must surface explicitly and must not collapse into a generic repair bucket'
  ) {
    throw new Error('Settings Capabilities must preserve developer checkout semantics as their own axis');
  }
  assertDeepEqualJson(
    statusModel?.must_not_collapse,
    ['developer_checkout', 'dirty_checkout', 'git_behind', 'unknown', 'needs_sync'],
    'Settings Capabilities forbidden collapsed states',
  );
  const detailSurface = directory.detail_surface;
  if (
    detailSurface?.kind !== 'desktop_right_side_panel_mobile_drawer' ||
    detailSurface?.first_screen_policy !==
      'receipt_refs_physical_surface_and_workflow_connector_resource_refs_are_detail_only_not_primary_row_density'
  ) {
    throw new Error('Settings Capabilities detail surface must keep refs in side-panel/drawer density');
  }
  assertIncludesAll(
    detailSurface?.detail_fields,
    ['receipt_refs', 'physical_surface', 'workflow_refs', 'connector_readiness_refs', 'resource_source_refs'],
    'Settings Capabilities detail fields',
  );
  if (!String(directory.completion_boundary ?? '').includes('allows modules.items fallback')) {
    throw new Error('Settings Capabilities directory projection must state the current implementation boundary');
  }
}

function validateSettingsAccessCloudBoundary(accessPage) {
  if (accessPage?.model_access_source !== 'app_state.core.codex.model_access_source') {
    throw new Error('Settings Access must read the real Codex model_access_source');
  }
  assertDeepEqualJson(
    accessPage.browser_access_entry,
    appOwnedSettingsAccessBrowserEntry,
    'Settings Access browser entry',
  );
  const presentation = accessPage?.normal_state_presentation;
  if (!presentation || typeof presentation !== 'object') {
    throw new Error('Settings Access page adapter must declare normal_state_presentation');
  }
  assertDeepEqualJson(
    presentation.user_facing_groups,
    ['model_access', 'local_browser_access'],
    'Settings Access normal-state groups',
  );
  assertDeepEqualJson(
    presentation.supporting_details,
    ['codex_cli'],
    'Settings Access supporting details',
  );
  if (presentation.default_policy !== 'real_provider_source_browser_access_and_necessary_action_first') {
    throw new Error('Settings Access must show the real model source, browser access, and necessary action first');
  }
  if (
    presentation.details_policy !==
    'base_url_token_paths_cli_and_provider_internals_only_in_details_or_abnormal_state'
  ) {
    throw new Error('Settings Access diagnostics must stay in details or abnormal states');
  }
  if (
    presentation.resources_route !== 'resources' ||
    presentation.resources_route_policy !==
      'Docker WebUI, OPL Workspace, SSH/HPC, cloud, Fabric, and Console-managed refs live on Resources & Connections' ||
    presentation.local_browser_access_route !== 'access' ||
    presentation.local_browser_access_policy !==
      'preserve_local_browser_access_to_this_computer_without_exposing_shell_provenance'
  ) {
    throw new Error('Settings Access must keep local browser access and route resource surfaces to Settings Resources');
  }
  assertIncludesAll(
    presentation.hidden_normal_state_terms,
    ['repeated OPL Gateway summary lines', 'action_available', 'diagnose_with_doctor', 'available', 'CLI dry-run commands'],
    'Settings Access hidden normal-state terms',
  );

  const boundary = accessPage?.cloud_remote_boundary;
  if (!boundary || typeof boundary !== 'object') {
    throw new Error('Settings Access page adapter must declare cloud_remote_boundary');
  }
  assertDeepEqualJson(
    boundary.required_boundary_terms,
    ['App', 'Workspace', 'Gateway', 'Fabric', 'Console'],
    'Settings Access cloud remote boundary terms',
  );
  if (
    boundary.display_policy !==
    'preserve local browser access to this computer on Access; resource and deployment refs route to Settings Resources'
  ) {
    throw new Error('Settings Access must preserve local browser access while routing resource refs to Settings Resources');
  }
  if (boundary.refs_only !== true) {
    throw new Error('Settings Access cloud remote boundary refs_only must be true');
  }
  assertIncludesAll(
    boundary.forbidden_claims,
    ['runtime_truth', 'provider_implementation', 'domain_truth', 'domain_readiness', 'app_release_readiness'],
    'Settings Access cloud remote boundary forbidden claims',
  );
}

function validateSettingsVisualQaPolicy(controlPlane) {
  const policy = controlPlane.visual_qa_policy;
  if (policy?.policy !== 'settings_control_center_visual_qa_is_shell_behavior_evidence') {
    throw new Error('Settings visual QA policy must describe shell behavior evidence');
  }
  assertDeepEqualJson(policy.required_viewports, ['desktop', 'mobile'], 'Settings visual QA required viewports');
  assertDeepEqualJson(policy.required_routes, expectedVisualQaRoutes, 'Settings visual QA required routes');
  assertDeepEqualJson(
    policy.required_secondary_routes,
    expectedVisualQaSecondaryRoutes,
    'Settings visual QA secondary routes',
  );
  assertDeepEqualJson(
    policy.required_compatibility_redirects,
    expectedVisualQaCompatibilityRedirects,
    'Settings visual QA compatibility redirects',
  );
  assertDeepEqualJson(
    policy.required_status_anchors,
    expectedVisualQaStatusAnchors,
    'Settings visual QA status anchors',
  );
  if (policy.evidence_manifest?.path !== 'tests/e2e/screenshots/settings-control-center-manifest.json') {
    throw new Error('Settings visual QA policy must declare the screenshot evidence manifest path');
  }
  assertDeepEqualJson(
    policy.evidence_manifest?.required_fields,
    expectedVisualQaManifestFields,
    'Settings visual QA evidence manifest fields',
  );
  if (
    policy.evidence_manifest?.viewport_policy !== 'each required route is captured for desktop and mobile viewports' ||
    policy.evidence_manifest?.secondary_route_policy !==
      'advanced and about are captured as independent secondary pages' ||
    policy.evidence_manifest?.compatibility_route_policy !==
      'update, theme, and local-services are captured as redirect landing evidence on their owner route and anchor'
  ) {
    throw new Error('Settings visual QA manifest must declare ordinary, secondary, and compatibility evidence policy');
  }
  if (!String(policy.evidence_command ?? '').includes('E2E_SCREENSHOTS=1')) {
    throw new Error('Settings visual QA policy must require screenshot evidence');
  }
  assertIncludesAll(
    policy.does_not_prove,
    ['release readiness', 'packaged App readiness', 'runtime currentness', 'owner acceptance'],
    'Settings visual QA non-release evidence boundary',
  );
}

function validateSettingsProductSystemChecklist(controlPlane) {
  const checklist = controlPlane.product_system_checklist;
  if (checklist?.schema !== 'settings_product_system_checklist.v1') {
    throw new Error('Settings product system checklist must use settings_product_system_checklist.v1');
  }
  if (checklist?.purpose !== 'plan_completion_audit_source_for_settings_control_center') {
    throw new Error('Settings product system checklist must be the plan completion audit source');
  }
  if (
    checklist?.completion_policy !==
    'each item is audited against fresh evidence; tests, docs, or contracts only prove the item slice they directly cover'
  ) {
    throw new Error('Settings product system checklist must require fresh per-item evidence');
  }
  if (
    checklist?.release_currentness_policy !==
    'installed app, notarization, running version, and release readiness remain release-owner gates and must not be inferred from Settings tests'
  ) {
    throw new Error('Settings product system checklist must separate release/currentness gates from Settings tests');
  }
  const items = checklist?.items ?? [];
  assertDeepEqualJson(
    items.map((item) => item.id),
    appOwnedSettingsProductSystemItemIds,
    'Settings product system checklist item ids',
  );
  const tracks = [...new Set(items.map((item) => item.track))];
  assertDeepEqualJson(tracks, appOwnedSettingsProductSystemTracks, 'Settings product system checklist tracks');
  for (const item of items) {
    if (!appOwnedSettingsProductSystemTracks.includes(item.track)) {
      throw new Error(`Settings product system checklist item ${item.id} has unknown track ${item.track}`);
    }
    if (typeof item.goal !== 'string' || item.goal.trim().length < 20) {
      throw new Error(`Settings product system checklist item ${item.id} must declare a concrete goal`);
    }
    if (!Array.isArray(item.evidence_required) || item.evidence_required.length < 3) {
      throw new Error(`Settings product system checklist item ${item.id} must list at least three evidence requirements`);
    }
  }
  const releaseItem = items.find((item) => item.id === 'installed_release_currentness');
  if (releaseItem?.track !== 'release_currentness') {
    throw new Error('Settings installed/release currentness item must stay on the release_currentness track');
  }
  assertIncludesAll(
    releaseItem?.evidence_required,
    [
      'release_currentness_policy separates this item from Settings tests',
      'visual QA and contract validators list what they do not prove',
      'release owner gate supplies any future installed or release evidence',
    ],
    'Settings release/currentness checklist evidence',
  );
  const screenshotItem = items.find((item) => item.id === 'screenshot_qa');
  assertIncludesAll(
    screenshotItem?.evidence_required,
    [
      'visual_qa_policy lists ordinary and secondary routes',
      'compatibility redirects are captured as landing evidence',
      'visual QA does not prove release or currentness readiness',
    ],
    'Settings screenshot QA checklist evidence',
  );
}

function validateSettingsUpstreamIntake(controlPlane) {
  const checklist = controlPlane.upstream_intake_checklist;
  if (checklist?.policy !== 'classify_aionui_settings_upstream_before_registry_or_slot_changes') {
    throw new Error('Settings upstream intake checklist must classify AionUI settings upstream before registry or slot changes');
  }
  assertDeepEqualJson(
    checklist?.allowed_classifications,
    appOwnedSettingsUpstreamIntakeClassifications,
    'Settings upstream intake classifications',
  );
  assertDeepEqualJson(
    Object.keys(controlPlane.upstream_intake_classification ?? {}),
    appOwnedSettingsUpstreamIntakeClassifications,
    'Settings upstream intake classification buckets',
  );
  for (const classification of appOwnedSettingsUpstreamIntakeClassifications) {
    if (!Array.isArray(controlPlane.upstream_intake_classification[classification])) {
      throw new Error(`Settings upstream intake classification ${classification} must be an array`);
    }
  }
  const records = checklist?.records;
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Settings upstream intake records must be a non-empty array');
  }
  const seenRecordIds = new Set();
  for (const record of records) {
    validateSettingsUpstreamIntakeRecord(record, seenRecordIds);
  }
}

function validateSettingsUpstreamIntakeRecord(record, seenRecordIds) {
  const label = `Settings upstream intake record ${record?.id ?? '<missing id>'}`;
  for (const field of [
    'id',
    'upstream_surface',
    'classification',
    'app_contract_ref',
    'route_or_slot_impact',
    'required_evidence',
    'decision_owner',
    'last_reviewed_at',
    'status',
  ]) {
    if (record?.[field] === undefined || record?.[field] === null || record?.[field] === '') {
      throw new Error(`${label} must declare ${field}`);
    }
  }
  if (seenRecordIds.has(record.id)) {
    throw new Error(`${label} id must be unique`);
  }
  seenRecordIds.add(record.id);
  if (!appOwnedSettingsUpstreamIntakeClassifications.includes(record.classification)) {
    throw new Error(`${label} classification must be accepted/adapt/redirect/reject`);
  }
  if (!String(record.app_contract_ref).startsWith('contracts/')) {
    throw new Error(`${label} must bind to an App contract ref`);
  }
  if (!Array.isArray(record.required_evidence) || record.required_evidence.length === 0) {
    throw new Error(`${label} must declare required_evidence`);
  }
  if (record.decision_owner !== 'one-person-lab-app') {
    throw new Error(`${label} decision_owner must be one-person-lab-app`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(record.last_reviewed_at))) {
    throw new Error(`${label} last_reviewed_at must be YYYY-MM-DD`);
  }
  if (!['active', 'pending', 'superseded'].includes(record.status)) {
    throw new Error(`${label} status must be active, pending, or superseded`);
  }
  const impact = record.route_or_slot_impact ?? {};
  if (['accepted', 'adapt'].includes(record.classification)) {
    if (impact.host_component && impact.host_component !== 'SettingsHost') {
      throw new Error(`${label} host_component must be SettingsHost`);
    }
    if (impact.adapter_slot && impact.adapter_slot !== 'SettingsShellAdapterSlot') {
      throw new Error(`${label} adapter_slot must be SettingsShellAdapterSlot`);
    }
    if (impact.host_component !== 'SettingsHost' && impact.adapter_slot !== 'SettingsShellAdapterSlot' && !impact.slot_id && !impact.route_id) {
      throw new Error(`${label} accepted/adapt records must bind to SettingsHost, SettingsShellAdapterSlot, route, or slot evidence`);
    }
    if (impact.route_id) {
      assertKnownSettingsRoute(impact.route_id, label);
    }
    if (impact.secondary_route) {
      assertKnownSettingsRoute(impact.secondary_route, label);
    }
    if (impact.slot_id && !expectedSlotKeys.includes(impact.slot_id)) {
      throw new Error(`${label} references unknown Settings slot ${impact.slot_id}`);
    }
    return;
  }
  if (!impact.legacy_redirect && !impact.anchor_remap && !impact.forbidden_probe && !String(record.app_contract_ref).includes('#')) {
    throw new Error(`${label} redirect/reject records must bind to a legacy redirect, anchor remap, forbidden probe, or explicit app contract ref`);
  }
  if (impact.route_id) {
    assertKnownSettingsRoute(impact.route_id, label);
  }
  if (impact.legacy_redirect && !expectedLegacyRedirects[impact.legacy_redirect]) {
    throw new Error(`${label} references unknown legacy redirect ${impact.legacy_redirect}`);
  }
  if (impact.anchor_remap && !expectedAnchorRemap[impact.anchor_remap]) {
    throw new Error(`${label} references unknown extension anchor ${impact.anchor_remap}`);
  }
}

function validateSettingsShellAdapterSlot(adapterContract) {
  const slot = adapterContract?.implementation_probes?.settings_control_plane_shell_adapter_slot;
  if (!slot) {
    throw new Error('Active shell adapter must declare settings_control_plane_shell_adapter_slot');
  }
  if (slot.source_ref !== settingsIaRef && slot.source_ref !== settingsControlPlaneContractRef) {
    throw new Error('Settings shell adapter slot must point to the Settings control plane or settings_ia contract');
  }
  if (slot.policy !== 'behavior_level_dom_or_registry_validation_preferred') {
    throw new Error('Settings shell adapter slot must prefer behavior-level DOM or registry validation');
  }
  if ((slot.source_probe_policy ?? '').includes('primary')) {
    throw new Error('Settings shell adapter slot must not make source-string probes the primary validation strategy');
  }
  if (slot.host_component !== 'SettingsHost') {
    throw new Error('Settings shell adapter slot must declare SettingsHost');
  }
  if (!slot.slots?.SettingsShellAdapterSlot) {
    throw new Error('Settings shell adapter slot must declare SettingsShellAdapterSlot');
  }
  assertDeepEqualJson(
    slot.required_evidence,
    expectedSettingsAdapterEvidence,
    'Settings shell adapter slot required evidence',
  );
}

function assertKnownSettingsRoute(routeId, label) {
  const knownRouteIds = new Set([
    ...appOwnedSettingsTabs,
    ...appOwnedSecondarySettingsPages,
    ...Object.keys(appOwnedSettingsCompatibilityRedirects),
  ]);
  if (!knownRouteIds.has(routeId)) {
    throw new Error(`${label} references unknown Settings route ${routeId}`);
  }
}

function pageById(matrix, id) {
  const page = (matrix.pages ?? []).find((entry) => entry.id === id);
  if (!page) {
    throw new Error(`Page-state matrix is missing ${id}`);
  }
  return page;
}

function settingsRouteResolution(input, targetId, route, routeScope, anchor = null, anchorQueryParam = null) {
  return {
    input,
    id: input,
    target_id: targetId,
    path: route?.path ?? '/settings/advanced',
    route_scope: routeScope,
    slot_id: route?.slot_id ?? 'settings_advanced',
    component_key: route?.component_key ?? null,
    anchor,
    anchor_query_param: anchorQueryParam,
  };
}
