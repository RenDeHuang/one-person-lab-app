import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { appOwnedSettingsRouteScopes, settingsPageExpectations } from './app-contract-constants.ts';
import {
  validateManagedUpdatePageBasics,
  validateManagedUpdatePlaneBinding,
} from './managed-update-plane-validator.ts';
import { validateSettingsControlPlaneBehavior } from './settings-control-plane-validator.ts';

export function validateAppSettingsPages(matrix) {
  validateSettingsControlPlaneBehavior({ pageStateMatrix: matrix });

  const appStatePages = ['settings_general', 'access', 'environment', 'advanced', 'about', 'settings_theme'];
  for (const pageId of appStatePages) {
    const page = pageById(matrix, pageId);
    if (page.machine_source !== 'opl app state --profile fast --json') {
      throw new Error(`${pageId} must default to opl app state --profile fast --json`);
    }
    if (page.refresh_source !== 'opl app state --profile fast --json') {
      throw new Error(`${pageId} must refresh through opl app state --profile fast --json`);
    }
  }

  for (const [contractPageId, expected] of Object.entries(settingsPageExpectations)) {
    const page = pageById(matrix, expected.matrix_id);
    if (page.page_contract !== contractPageId) {
      throw new Error(`${expected.matrix_id} page_contract must be ${contractPageId}`);
    }
    assertDeepEqualJson(page.sections, expected.sections, `${expected.matrix_id} sections`);
    assertIncludesAll(page.must_show, expected.must_show, `${expected.matrix_id} must_show`);
    assertIncludesAll(page.must_not_show, expected.must_not_show, `${expected.matrix_id} must_not_show`);
    validateSettingsRouteIdentity(page, expected.matrix_id);
  }

  validateCapabilitiesPage(matrix);
  validateEnvironmentPage(matrix);
  validateAdvancedPage(matrix);
  validateAboutPage(matrix);
  validateUpdatePage(matrix);
  validateSettingsThemePage(matrix);
}

function validateSettingsRouteIdentity(page, pageId) {
  const expected = appOwnedSettingsRouteScopes[pageId];
  if (!expected) {
    return;
  }
  if (page.route_id !== expected.route_id) {
    throw new Error(`${pageId} route_id must remain ${expected.route_id}`);
  }
  if (page.route_scope !== expected.route_scope) {
    throw new Error(`${pageId} route_scope must remain ${expected.route_scope}`);
  }
  if (page.settings_ia_ref !== 'contracts/app-gui-product-contract.json#settings_navigation.settings_ia') {
    throw new Error(`${pageId} must reference the App-owned settings_ia.v1 contract`);
  }
}

function pageById(matrix, id) {
  const page = (matrix.pages ?? []).find((entry) => entry.id === id);
  if (!page) {
    throw new Error(`Page-state matrix is missing ${id}`);
  }
  return page;
}

function validateCapabilitiesPage(matrix) {
  const capabilitiesPage = pageById(matrix, 'capabilities');
  if (capabilitiesPage.refresh_source !== 'opl app state --profile fast --json') {
    throw new Error('Capabilities page must refresh through opl app state --profile fast --json');
  }
  if (capabilitiesPage.machine_source !== 'contracts/app-gui-product-contract.json#default_assistants + opl app state --profile fast --json') {
    throw new Error('Capabilities page must combine App-owned assistant profile truth with OPL App state readiness refs');
  }
}

function validateEnvironmentPage(matrix) {
  const environmentPage = pageById(matrix, 'environment');
  if (environmentPage.module_path_source_policy_ref !== 'contracts/app-gui-product-contract.json#module_path_source_policy') {
    throw new Error('Environment page must reference the App GUI module path source policy');
  }
  if (!environmentPage.must_show?.includes('module path source explanation')) {
    throw new Error('Environment page must show module path source explanation');
  }
  validateEnvironmentModuleMaintenanceEntry(environmentPage.module_maintenance_entry, 'Environment page');
  if (!environmentPage.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Environment page must keep MDS out of default module display');
  }
  if (environmentPage.managed_update_plane_ref !== 'contracts/app-release-channel.json#managed_update_plane') {
    throw new Error('Environment page must reference the App release managed update plane');
  }
}

function validateEnvironmentModuleMaintenanceEntry(entry, label) {
  if (
    entry?.placement !== 'Local Environment' ||
    entry?.app_role !== 'managed_update_status_action_consumer_only' ||
    entry?.kernel_implementation_allowed !== false ||
    entry?.domain_truth_write_allowed !== false ||
    entry?.owner_receipt_write_allowed !== false ||
    entry?.developer_checkout_silent_update_allowed !== false ||
    entry?.dirty_checkout_silent_update_allowed !== false
  ) {
    throw new Error(`${label} module maintenance entry must stay under Local Environment as a consumer-only managed update surface`);
  }
  assertIncludesAll(
    entry?.required_modules,
    ['MAS', 'MAG', 'RCA', 'OMA', 'BookForge', 'ScholarSkills'],
    `${label} module maintenance modules`,
  );
  assertIncludesAll(
    entry?.required_status,
    [
      'OPL Packages state and capability exposure substatus',
      'recommended action',
      'post-update sync status',
      'repair and rollback refs',
    ],
    `${label} module maintenance status`,
  );
  assertDeepEqualJson(
    entry?.manual_action_mapping,
    {
      refresh: 'opl update status --json',
      check: 'opl update check --json',
      apply: 'opl update apply --component <component_id> --json',
      repair: 'opl update repair --receipt <receipt_id> --json',
      rollback: 'opl update rollback --component <component_id> --json',
      app_action_route: 'opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json',
    },
    `${label} module maintenance action mapping`,
  );
}

function validateAdvancedPage(matrix) {
  const advancedPage = pageById(matrix, 'advanced');
  if (!advancedPage.state_sections?.includes('opl_flow_context')) {
    throw new Error('Advanced page state_sections must include opl_flow_context');
  }
  if (advancedPage.state_sections?.includes('opl_agent_codex_context')) {
    throw new Error('Advanced page state_sections must not retain opl_agent_codex_context');
  }
  if ((advancedPage.legacy_state_sections ?? []).length > 0) {
    throw new Error('Advanced page legacy_state_sections must be retired');
  }
  if (!advancedPage.must_show?.includes('OPL Flow Context')) {
    throw new Error('Advanced page must show OPL Flow Context');
  }
}

function validateAboutPage(matrix) {
  const aboutPage = pageById(matrix, 'about');
  if (!aboutPage.must_show?.includes('Stable or Nightly channel')) {
    throw new Error('About page must show Stable or Nightly channel');
  }
  if (!aboutPage.must_show?.includes('Maintenance link that routes update and repair actions to Control Center Maintenance')) {
    throw new Error('About page must link update and repair actions to Control Center Maintenance');
  }
  if (aboutPage.managed_update_plane_ref) {
    throw new Error('About page must not own the App release managed update plane');
  }
  if (!aboutPage.must_not_show?.includes('update, repair, rollback, package maintenance, or storage cleanup controls on About')) {
    throw new Error('About page must keep update, repair, rollback, package maintenance, and cleanup controls out of About');
  }
}

function validateUpdatePage(matrix) {
  const updatePage = pageById(matrix, 'update');
  validateManagedUpdatePageBasics(updatePage, 'Update page', { requirePageContract: true });
  validateManagedUpdatePlaneBinding(updatePage.managed_update_plane, 'Update page');
}

function validateSettingsThemePage(matrix) {
  const settingsThemePage = pageById(matrix, 'settings_theme');
  for (const signal of [
    'Default theme option',
    'Codex theme option',
    'current theme from app_state.settings.theme',
    'theme choice as App product preference',
  ]) {
    if (!settingsThemePage.must_show?.includes(signal)) {
      throw new Error(`Settings theme page must show ${signal}`);
    }
  }
}
