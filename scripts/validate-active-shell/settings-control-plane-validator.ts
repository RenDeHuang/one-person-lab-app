import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appOwnedSecondarySettingsPages,
  appOwnedSettingsCardFields,
  appOwnedSettingsConfirmationFields,
  appOwnedSettingsIaGroupIds,
  appOwnedSettingsIssueStatuses,
  appOwnedSettingsMakeUsableAllowedSteps,
  appOwnedSettingsMakeUsableForbiddenSteps,
  appOwnedSettingsPostUpdateNoticeFields,
  appOwnedSettingsRouteScopes,
  appOwnedSettingsSearchProtocol,
  appOwnedSettingsTabs,
  appOwnedSettingsTaskEntryIds,
  appOwnedSettingsVisualQaTargets,
} from './app-contract-constants.ts';

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
  if (controlPlane.default_route !== '/settings/general') {
    throw new Error('Settings control plane default route must be /settings/general');
  }
  if (controlPlane.extension_tab_policy?.legacy_anchor_remap_required !== true) {
    throw new Error('Settings control plane must require extension legacy anchor remapping');
  }
  if (controlPlane.state_action_policy?.action_route !== 'opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json') {
    throw new Error('Settings control plane must route mutations through opl app action execute');
  }
  assertIncludesAll(
    controlPlane.state_action_policy?.shell_must_not_own,
    ['runtime truth', 'provider implementation', 'domain truth', 'owner receipts', 'release readiness'],
    'Settings control plane shell_must_not_own',
  );
  validateCrossContractConsistency(controlPlane, guiContract, pageStateMatrix, productProfile);
  validateSettingsIa(guiContract?.settings_navigation?.settings_ia);
  validateSettingsPageStateMatrix(pageStateMatrix);
  validateProductProfileSettings(productProfile, controlPlane);
  validateOptionalSettingsShellAdapterSlot(adapterContract);
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
    validateOptionalSettingsShellAdapterSlot(adapterContract);
  }
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

function validateOptionalSettingsShellAdapterSlot(adapterContract) {
  const slot = adapterContract?.implementation_probes?.settings_control_plane_shell_adapter_slot;
  if (!slot) {
    return;
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
