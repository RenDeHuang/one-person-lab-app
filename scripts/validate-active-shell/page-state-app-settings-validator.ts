import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { settingsPageExpectations } from './app-contract-constants.ts';
import {
  validateManagedUpdatePageBasics,
  validateManagedUpdatePlaneBinding,
} from './managed-update-plane-validator.ts';

export function validateAppSettingsPages(matrix) {
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
  }

  validateCapabilitiesPage(matrix);
  validateEnvironmentPage(matrix);
  validateAdvancedPage(matrix);
  validateAboutPage(matrix);
  validateUpdatePage(matrix);
  validateSettingsThemePage(matrix);
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
  if (!environmentPage.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Environment page must keep MDS out of default module display');
  }
  if (environmentPage.managed_update_plane_ref !== 'contracts/app-release-channel.json#managed_update_plane') {
    throw new Error('Environment page must reference the App release managed update plane');
  }
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
  if (!aboutPage.must_show?.includes('Updates & Maintenance entry on About & Updates')) {
    throw new Error('About page must link to Updates & Maintenance');
  }
  if (aboutPage.managed_update_plane_ref !== 'contracts/app-release-channel.json#managed_update_plane') {
    throw new Error('About page must reference the App release managed update plane');
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
