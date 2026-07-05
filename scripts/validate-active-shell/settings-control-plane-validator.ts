import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appOwnedSecondarySettingsPages,
  appOwnedSettingsCardFields,
  appOwnedSettingsConfirmationFields,
  appOwnedSettingsIaGroupIds,
  appOwnedSettingsIssueStatuses,
  appOwnedSettingsMakeUsableAllowedSteps,
  appOwnedSettingsMakeUsableForbiddenSteps,
  appOwnedSettingsProductSystemItemIds,
  appOwnedSettingsProductSystemTracks,
  appOwnedSettingsPostUpdateNoticeFields,
  appOwnedSettingsRouteScopes,
  appOwnedSettingsSearchProtocol,
  appOwnedSettingsTabs,
  appOwnedSettingsUpstreamIntakeClassifications,
  appOwnedSettingsTaskEntryIds,
  appOwnedSettingsVisualQaTargets,
} from './app-contract-constants.ts';
import { validateSettingsCapabilitiesResourceGrouping } from './shared-contract-validators.ts';

const settingsIaRef = 'contracts/app-gui-product-contract.json#settings_navigation.settings_ia';
const settingsControlPlaneContractRef = 'contracts/app-settings-control-plane.json';
const appActionRoute = 'opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json';

const expectedLegacyRedirects = {
  overview: 'general',
  runtime: 'environment',
  system: 'advanced',
  model: 'environment',
  agent: 'capabilities',
  assistants: 'capabilities',
  'skills-hub': 'capabilities?tab=skills',
  tools: 'capabilities?tab=tools',
  display: 'appearance',
  webui: 'access',
  pet: 'appearance',
  about: 'advanced',
};

const expectedAnchorRemap = {
  overview: 'general',
  runtime: 'environment',
  system: 'advanced',
  model: 'environment',
  agent: 'capabilities',
  assistants: 'capabilities',
  'skills-hub': 'capabilities',
  tools: 'capabilities',
  display: 'appearance',
  webui: 'access',
  pet: 'appearance',
  about: 'advanced',
};

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
  '/settings/capabilities',
  '/settings/environment',
  '/settings/storage',
  '/settings/appearance',
  '/settings/advanced',
];
const expectedVisualQaSecondaryRoutes = ['/settings/workspace', '/settings/local-services'];
const expectedVisualQaStatusAnchors = [
  'diagnostics_collapsed_by_default',
  'state_changing_action_confirmation',
  'post_action_recovery_notice',
  'legacy_redirect_landing',
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
    controlPlane.secondary_pages?.map((page) => page.id),
    appOwnedSecondarySettingsPages,
    'Settings control plane secondary page ids',
  );
  assertDeepEqualJson(
    [...new Set(controlPlane.ordinary_routes?.map((route) => route.ia_group))],
    appOwnedSettingsIaGroupIds,
    'Settings control plane IA groups',
  );
  assertDeepEqualJson(
    controlPlane.ordinary_routes?.map((route) => route.slot_id),
    [
      'settings_general',
      'settings_access',
      'settings_capabilities',
      'settings_environment',
      'settings_storage',
      'settings_theme',
      'settings_advanced',
    ],
    'Settings control plane ordinary slot ids',
  );
  assertDeepEqualJson(controlPlane.legacy_route_redirects, expectedLegacyRedirects, 'Settings control plane legacy redirects');
  assertDeepEqualJson(controlPlane.extension_anchor_remap, expectedAnchorRemap, 'Settings control plane extension anchor remap');
  assertDeepEqualJson(
    Object.keys(controlPlane.slot_registry ?? {}),
    expectedSlotKeys,
    'Settings control plane slot registry keys',
  );
  assertEveryRouteHasSlot(controlPlane);
  validateHydratedSettingsRegistry(controlPlane);
  validateSettingsShellAdapterSlotContract(controlPlane);
  validateSettingsModelReasoningPolicy(controlPlane, guiContract, productProfile);
  validateSettingsPageAdapterPolicy(controlPlane);
  validateSettingsVisualQaPolicy(controlPlane);
  validateSettingsProductSystemChecklist(controlPlane);
  validateSettingsUpstreamIntake(controlPlane);
  if (controlPlane.default_route !== '/settings/general') {
    throw new Error('Settings control plane default route must be /settings/general');
  }
  if (controlPlane.extension_tab_policy?.legacy_anchor_remap_required !== true) {
    throw new Error('Settings control plane must require extension legacy anchor remapping');
  }
  if (controlPlane.state_action_policy?.action_route !== 'opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json') {
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
  validateSettingsPageStateMatrix(pageStateMatrix);
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

export function buildHydratedSettingsRegistry(controlPlane) {
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
    legacy_route_redirects: controlPlane.legacy_route_redirects ?? {},
    extension_anchor_remap: controlPlane.extension_anchor_remap ?? {},
  };
}

export function resolveSettingsControlPlaneRoute(controlPlane, routeId) {
  const registry = buildHydratedSettingsRegistry(controlPlane);
  const ordinaryRoute = registry.ordinary_routes.find((route) => route.id === routeId);
  if (ordinaryRoute) {
    return settingsRouteResolution(routeId, ordinaryRoute.id, ordinaryRoute, 'ordinary');
  }
  const secondaryRoute = registry.secondary_pages.find((route) => route.id === routeId);
  if (secondaryRoute) {
    return settingsRouteResolution(routeId, secondaryRoute.id, secondaryRoute, 'secondary_or_deep_link');
  }
  const redirectTarget = registry.legacy_route_redirects[routeId];
  if (redirectTarget) {
    const [targetId, query] = String(redirectTarget).split('?');
    const targetRoute = registry.ordinary_routes.find((route) => route.id === targetId);
    if (!targetRoute) {
      throw new Error(`Settings legacy route ${routeId} redirects to unknown ordinary route ${targetId}`);
    }
    return settingsRouteResolution(
      routeId,
      targetRoute.id,
      {
        ...targetRoute,
        path: query ? `${targetRoute.path}?${query}` : targetRoute.path,
      },
      'legacy_redirect',
    );
  }
  return settingsRouteResolution(
    routeId,
    'advanced',
    registry.ordinary_routes.find((route) => route.id === 'advanced'),
    'unknown_redirect',
  );
}

export function remapSettingsExtensionAnchor(controlPlane, anchorId) {
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
    Object.fromEntries(
      Object.entries(controlPlane.legacy_route_redirects).filter(([id]) => id !== 'about').map(([id, target]) => [
        id,
        String(target).split('?')[0],
      ]),
    ),
    settingsNavigation?.legacy_route_redirects,
    'Settings control plane legacy redirects vs GUI contract',
  );
  const pageIds = new Set((pageStateMatrix?.pages ?? []).map((page) => page.id));
  for (const route of controlPlane.ordinary_routes) {
    if (!pageIds.has(route.id) && !pageIds.has(route.slot_id)) {
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
    productProfile?.settings?.control_plane?.legacy_route_redirects,
    controlPlane.legacy_route_redirects,
    'Product profile settings.control_plane legacy redirects',
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.extension_anchor_remap,
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
  assertDeepEqualJson(
    (settingsIa.user_task_entries ?? []).map((entry) => entry.id),
    appOwnedSettingsTaskEntryIds,
    'Settings control plane user task entries',
  );
  for (const entry of settingsIa.user_task_entries ?? []) {
    if (!appOwnedSettingsIaGroupIds.includes(entry.group_id)) {
      throw new Error(`Settings control plane task entry ${entry.id} has unknown group ${entry.group_id}`);
    }
    assertKnownSettingsRoute(entry.route_id, `Settings control plane task entry ${entry.id}`);
    for (const routeId of entry.secondary_route_ids ?? []) {
      assertKnownSettingsRoute(routeId, `Settings control plane task entry ${entry.id} secondary route`);
    }
  }
  validateSettingsProtocols(settingsIa.protocols);
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
    protocols.deep_link_policy?.secondary_route_policy !== 'open_as_secondary_or_deep_link_without_ordinary_tab_promotion'
  ) {
    throw new Error('Settings control plane deep links must use App-owned redirect and secondary-route policy');
  }
  assertDeepEqualJson(
    protocols.visual_qa_expectations?.required_targets,
    appOwnedSettingsVisualQaTargets,
    'Settings control plane visual QA targets',
  );
}

function validateSettingsPageStateMatrix(pageStateMatrix) {
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
      'CapabilitiesSettingsContent',
      'RuntimeSettings',
      'StorageSettings',
      'AppearanceModalContent',
      'SystemModalContent',
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
  for (const legacyRoute of Object.keys(expectedLegacyRedirects)) {
    const redirectTarget = String(controlPlane.legacy_route_redirects[legacyRoute]).split('?')[0];
    if (!appOwnedSettingsTabs.includes(redirectTarget)) {
      throw new Error(`Settings legacy route ${legacyRoute} must target an ordinary route`);
    }
    if (
      !appOwnedSecondarySettingsPages.includes(legacyRoute) &&
      resolveSettingsControlPlaneRoute(controlPlane, legacyRoute).route_scope !== 'legacy_redirect'
    ) {
      throw new Error(`Settings legacy route ${legacyRoute} must resolve through the legacy redirect table`);
    }
    if (!appOwnedSettingsTabs.includes(remapSettingsExtensionAnchor(controlPlane, legacyRoute))) {
      throw new Error(`Settings extension anchor ${legacyRoute} must remap to an ordinary route`);
    }
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
  if (policy.settings_surface !== 'settings_access.model_account') {
    throw new Error('Settings model/reasoning policy must surface through Settings Access Model & Account');
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
}

function validateSettingsAccessCloudBoundary(accessPage) {
  const boundary = accessPage?.cloud_remote_boundary;
  if (!boundary || typeof boundary !== 'object') {
    throw new Error('Settings Access page adapter must declare cloud_remote_boundary');
  }
  assertDeepEqualJson(
    boundary.required_boundary_terms,
    ['App', 'Workspace', 'Gateway', 'Fabric', 'Console'],
    'Settings Access cloud remote boundary terms',
  );
  if (boundary.display_policy !== 'explain_app_workspace_gateway_fabric_console_boundary_without_runtime_truth_claims') {
    throw new Error('Settings Access cloud remote boundary must explain the App/Workspace/Gateway/Fabric/Console boundary');
  }
  if (boundary.refs_only !== true) {
    throw new Error('Settings Access cloud remote boundary refs_only must be true');
  }
  const nativeRemoteAccessPolicy = boundary.native_remote_access_policy;
  if (!nativeRemoteAccessPolicy || typeof nativeRemoteAccessPolicy !== 'object') {
    throw new Error('Settings Access cloud remote boundary must declare native_remote_access_policy');
  }
  if (
    nativeRemoteAccessPolicy.display_policy !== 'preserve_aionui_native_remote_access_capabilities_and_add_opl_context' ||
    nativeRemoteAccessPolicy.additive_only !== true
  ) {
    throw new Error('Settings Access native remote access policy must stay additive-only over AionUI');
  }
  assertDeepEqualJson(
    nativeRemoteAccessPolicy.stable_entry_surfaces,
    ['settings_access', 'settings_search'],
    'Settings Access native remote access stable entry surfaces',
  );
  assertDeepEqualJson(
    nativeRemoteAccessPolicy.preserved_capabilities,
    ['remote access setup', 'Docker WebUI access', 'user-provided SSH/HPC access'],
    'Settings Access native remote access preserved capabilities',
  );
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
      'workspace and local-services are captured or explicitly marked route_unit_covered with no screenshot claim'
  ) {
    throw new Error('Settings visual QA manifest must declare viewport and secondary route evidence policy');
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
      'release owner gate supplies any future installed/release evidence',
    ],
    'Settings release/currentness checklist evidence',
  );
  const screenshotItem = items.find((item) => item.id === 'screenshot_qa');
  assertIncludesAll(
    screenshotItem?.evidence_required,
    [
      'visual_qa_policy declares required routes and anchors',
      'manifest includes command, commit, viewport, route, screenshot_path, and status_anchors',
      'visual QA does not claim release or currentness readiness',
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
  const knownRouteIds = new Set([...appOwnedSettingsTabs, ...appOwnedSecondarySettingsPages]);
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

function settingsRouteResolution(input, targetId, route, routeScope) {
  return {
    input,
    id: input,
    target_id: targetId,
    path: route?.path ?? '/settings/advanced',
    route_scope: routeScope,
    slot_id: route?.slot_id ?? 'settings_advanced',
    component_key: route?.component_key ?? null,
  };
}
