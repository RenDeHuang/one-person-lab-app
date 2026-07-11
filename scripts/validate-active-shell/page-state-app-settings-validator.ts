import { assertDeepEqualJson, assertIncludesAll, readJson } from './assertions.ts';
import {
  appOwnedSettingsResourcesBrowserEntry,
  appOwnedSettingsCapabilitiesTabContract,
  appOwnedSettingsCompatibilityRedirects,
  appOwnedSettingsResourceActionBehavior,
  appOwnedTaskAwarenessRefFields,
} from './app-contract-constants.ts';
import {
  validateEnvironmentModuleMaintenanceEntry,
} from './managed-update-plane-validator.ts';
import { settingsControlPlanePath } from './validation-config.ts';
import { validateSettingsControlPlaneBehavior } from './settings-control-plane-validator.ts';

const guiSettingsPageToMatrixPage = {
  settings_general: 'settings_general',
  settings_access: 'access',
  settings_workspace: 'settings_workspace',
  settings_capabilities: 'capabilities',
  settings_resources: 'settings_resources',
  settings_environment: 'environment',
  settings_storage: 'storage',
  settings_theme: 'settings_theme',
  settings_advanced: 'advanced',
  about: 'about',
};

const settingsControlPlane = readJson(settingsControlPlanePath);

export function validateAppSettingsPages(matrix, guiContract) {
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

  for (const [contractPageId, matrixPageId] of Object.entries(guiSettingsPageToMatrixPage)) {
    const expected = guiContract?.pages?.[contractPageId];
    if (!expected) {
      throw new Error(`App GUI contract is missing ${contractPageId}`);
    }
    const page = pageById(matrix, matrixPageId);
    if (page.page_contract !== contractPageId) {
      throw new Error(`${matrixPageId} page_contract must be ${contractPageId}`);
    }
    assertDeepEqualJson(page.sections, expected.sections, `${matrixPageId} sections`);
    assertIncludesAll(page.must_show, expected.must_show, `${matrixPageId} must_show`);
    assertIncludesAll(page.must_not_show, expected.must_not_show, `${matrixPageId} must_not_show`);
  }

  const accessPage = pageById(matrix, 'access');
  if (
    accessPage.provider_source !== 'app_state.core.codex.model_access_source' ||
    !accessPage.state_sections?.includes('core.codex.model_access_source')
  ) {
    throw new Error('Access page must use the real Codex model_access_source');
  }
  if (
    accessPage.browser_access_entry !== undefined ||
    accessPage.required_dom?.always?.includes('settings-access-browser-access')
  ) {
    throw new Error('Models & Access must not own browser access to this computer');
  }

  const resourcesPage = pageById(matrix, 'settings_resources');
  assertDeepEqualJson(
    resourcesPage.browser_access_entry,
    appOwnedSettingsResourcesBrowserEntry,
    'Resources page browser entry',
  );
  if (!resourcesPage.required_dom?.always?.includes('settings-resources-browser-access')) {
    throw new Error('Resources & Connections must preserve browser access to this computer');
  }

  validateCapabilitiesPage(matrix, guiContract);
  validateResourcesPage(matrix, guiContract);
  validateEnvironmentPage(matrix);
  validateAdvancedPage(matrix);
  validateAboutPage(matrix);
  validateCompatibilityRedirectPages(matrix, guiContract);
  validateSettingsThemePage(matrix);
  validateSettingsPageExperience(matrix);
}
function pageById(matrix, id) {
  const page = (matrix.pages ?? []).find((entry) => entry.id === id);
  if (!page) {
    throw new Error(`Page-state matrix is missing ${id}`);
  }
  return page;
}

function validateCapabilitiesPage(matrix, guiContract) {
  const capabilitiesPage = pageById(matrix, 'capabilities');
  if (capabilitiesPage.refresh_source !== 'opl app state --profile fast --json') {
    throw new Error('Capabilities page must refresh through opl app state --profile fast --json');
  }
  assertDeepEqualJson(
    capabilitiesPage.codex_plugin_directory_target?.tab_contract,
    appOwnedSettingsCapabilitiesTabContract,
    'Capabilities page AssistantSettings tab contract',
  );
  assertDeepEqualJson(
    guiContract.pages?.settings_capabilities?.codex_plugin_directory_target?.tab_contract,
    appOwnedSettingsCapabilitiesTabContract,
    'App GUI Capabilities AssistantSettings tab contract',
  );
  if (
    capabilitiesPage.machine_source !==
    'opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index + home_agent_shortcuts + operator.workbench.task_drilldowns'
  ) {
    throw new Error('Capabilities page must read package-directory rows from canonical agent_packages, Home shortcuts, and task-awareness refs');
  }
  assertIncludesAll(
    capabilitiesPage.state_sections,
    ['agent_packages.directory', 'agent_packages.status_index', 'modules.items', 'home_agent_shortcuts', 'operator.workbench.task_drilldowns'],
    'Capabilities page task awareness state sections',
  );
  if (capabilitiesPage.task_awareness_refs_source !== 'contracts/app-runtime-bridge.json#task_awareness_projection.settings_capabilities_surface') {
    throw new Error('Capabilities page must consume the App runtime bridge task-awareness Settings surface');
  }
  assertDeepEqualJson(
    capabilitiesPage.task_awareness_ref_fields,
    appOwnedTaskAwarenessRefFields,
    'Capabilities page task awareness ref fields',
  );
  if (
    capabilitiesPage.task_awareness_ref_policy !== 'thin_renderer_refs_only_no_skill_body_no_artifact_body_no_domain_verdict' ||
    capabilitiesPage.export_bundle_action_policy !== 'show_export_bundle_action_ref_and_dry_run_receipt_without_claiming_domain_export_readiness'
  ) {
    throw new Error('Capabilities page must keep task awareness refs display-only and export bundle actions dry-run/receipt bounded');
  }
  if (
    capabilitiesPage.workflow_skill_candidate_policy?.display_policy !==
      'settings_capabilities_report_first_candidate_refs_review_needs_changes_continue_in_conversation_no_auto_enable' ||
    capabilitiesPage.workflow_skill_candidate_policy?.auto_enable_allowed !== false ||
    capabilitiesPage.workflow_skill_candidate_policy?.skill_body_write_access !== false
  ) {
    throw new Error('Capabilities page must keep workflow/skill candidates report-first without auto-enabling or writing skill bodies');
  }
  assertDeepEqualJson(
    capabilitiesPage.package_directory_policy,
    {
      surface: 'installed_package_directory',
      package_identity_fields: ['package_id', 'display_name', 'package_short_name'],
      purpose_role: 'secondary_tag_filter_only',
      home_shortcut_integration: 'inline_visibility_and_order_controls_on_package_rows',
      supporting_surfaces: ['skills', 'tools', 'external_tools_voice', 'custom_assistants'],
    },
    'Capabilities page package directory policy',
  );
  assertDeepEqualJson(
    capabilitiesPage.current_runtime_projection_boundary,
    {
      canonical_projection:
        'opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index',
      legacy_fallback_projection:
        'opl app state --profile fast --json#app_state.modules.items[] + home_agent_shortcuts + app_state.operator.workbench.task_drilldowns',
      normalization_policy:
        'shell must prefer canonical agent_packages projection and only fall back to modules.items when older runtime payloads or partial projections are still in circulation',
      developer_source_examples: [
        'health_status=dirty',
        'source_policy.effective_install_update_source=git_checkout',
        'source_policy.configured_by=developer_mode',
        'git.sync_status=behind',
        'git.dirty=true',
        'health_status=ready + recommended_action=update',
      ],
      completion_boundary:
        'this page-state target requires canonical agent_packages projection and allows modules.items fallback only as rollout compatibility',
    },
    'Capabilities page current runtime projection boundary',
  );
  assertDeepEqualJson(
    capabilitiesPage.agent_package_lifecycle_ux,
    expectedAgentPackageLifecycleUx(),
    'Capabilities page Agent Package lifecycle UX',
  );
  assertDeepEqualJson(
    capabilitiesPage.agent_package_lifecycle_ux,
    guiContract.pages.settings_capabilities.agent_package_lifecycle_ux,
    'Capabilities page Agent Package lifecycle UX mirror of App GUI contract',
  );
  assertDeepEqualJson(
    capabilitiesPage.status_model,
    {
      policy: 'multi_axis_package_status_no_single_repair_bucket',
      axes: ['install_state', 'update_state', 'source_state', 'trust_state', 'codex_surface_state'],
      source_inputs: [
        'app_state.agent_packages.directory.installed_packages[]',
        'app_state.agent_packages.status_index.packages[]',
        'app_state.agent_packages.status_index.home_shortcut_preferences[]',
        'modules.items[].health_status',
        'modules.items[].recommended_action',
        'modules.items[].source_policy.effective_install_update_source',
        'modules.items[].source_policy.configured_by',
        'modules.items[].git.sync_status',
        'modules.items[].git.dirty',
        'managed_update_plane.capability_packages',
        'managed_update_plane.codex_surface',
      ],
      developer_source_policy:
        'developer checkout semantics must surface explicitly and must not be collapsed into a generic repair bucket',
      must_not_collapse: ['developer_checkout', 'dirty_checkout', 'git_behind', 'unknown', 'needs_sync'],
    },
    'Capabilities page status model',
  );
  assertDeepEqualJson(
    capabilitiesPage.list_density_policy,
    {
      row_identity_key: 'package_id',
      primary_row_fields: [
        'display_name',
        'package_short_name',
        'purpose_tags',
        'home_shortcut_visible',
        'home_shortcut_order',
        'install_state',
        'update_state',
        'source_state',
        'trust_state',
        'codex_surface_state',
        'recommended_action',
      ],
      detail_surface: 'desktop_right_side_panel_mobile_drawer',
      default_detail_fields: [
        'purpose',
        'status',
        'codex_availability',
        'home_shortcut',
        'version',
        'source_label',
        'last_synced_at',
        'failure_reason_when_failed',
      ],
      content_block_policy:
        'show_connectors_workflows_environment_resources_and_reproducibility_export_only_when_real_projection_data_or_action_refs_exist',
      advanced_diagnostic_fields: [
        'package_id',
        'codex_visible_entry',
        'receipt_refs',
        'rollback_ref',
        'action_receipt_ref',
        'physical_surface',
        'paths',
        'manifest_ref',
        'cache_config',
        'marketplace_config',
        'raw_refs_json',
      ],
      first_screen_policy:
        'default detail shows user-decision fields only; raw package_id, codex_visible_entry, receipt refs, paths, manifest, cache, and marketplace config stay collapsed in Advanced diagnostics',
      empty_field_policy:
        'hide empty, unknown, unavailable, not_applicable, null, or unreported fields; never render 未报告 or Not reported as default user detail text',
    },
    'Capabilities page list density policy',
  );
  assertDeepEqualJson(
    capabilitiesPage.capability_detail_presentation_policy,
    expectedCapabilityDetailPresentationPolicy(),
    'Capabilities page detail presentation policy',
  );
}

function validateResourcesPage(matrix, guiContract) {
  const resourcesPage = pageById(matrix, 'settings_resources');
  assertDeepEqualJson(
    resourcesPage.action_behavior,
    appOwnedSettingsResourceActionBehavior,
    'Resources page action behavior',
  );
  assertDeepEqualJson(
    guiContract.pages?.settings_resources?.action_behavior,
    appOwnedSettingsResourceActionBehavior,
    'App GUI Resources action behavior',
  );
}

function expectedAgentPackageLifecycleUx() {
  return {
    requirement_scope: 'product_requirement_not_runtime_authority',
    primary_state_surface: 'app_state.agent_packages.directory + app_state.agent_packages.status_index',
    fallback_state_surface: 'app_state.modules.items[]',
    fallback_policy:
      'modules.items fallback is compatibility-only for older or partial payloads and cannot claim package currentness, execution readiness, or mutation authority',
    shell_consumers: ['aionui', 'opl_native_workbench'],
    action_ref_source: 'app_state.actions',
    action_route: 'opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json',
    field_behavior_checklist: [
      'search_by_package_name_short_name_tag_source_or_description',
      'filter_by_install_update_source_trust_codex_surface_and_home_visibility_state',
      'explain_install_source_in_user_language',
      'show_failure_reason_only_when_failed_blocked_or_needs_user_action',
      'show_receipt_and_physical_surface_in_details_or_advanced_only',
      'use_consistent_confirmation_and_receipt_pattern_for_hide_disable_update_repair_uninstall_install_and_launch',
      'display_rollback_ref_as_recovery_reference_only_no_app_rollback_verb',
    ],
    directory_controls: {
      top_controls: ['refresh_registry', 'search_by_package_name_tag_or_description', 'status_filter', 'manifest_url_install'],
      filters: ['status', 'source', 'trust', 'codex_surface', 'home_visibility', 'purpose_tag'],
      row_actions: ['hide', 'unhide', 'disable', 'enable', 'update', 'repair', 'uninstall', 'launch', 'open_details'],
    },
    source_explanation_fields: [
      'source_label',
      'source_kind',
      'trust_tier',
      'manifest_url',
      'distribution_ref',
      'developer_source_warning',
    ],
    failure_reason_fields: ['failure_reason', 'blocker_summary', 'last_action_receipt_ref', 'recommended_action'],
    receipt_physical_surface_detail_policy: {
      surface: 'details_panel_or_advanced_diagnostics',
      default_primary_row_visible: false,
      receipt_fields: ['receipt_refs', 'package_lock_ref', 'action_receipt_ref', 'rollback_ref'],
      physical_surface_fields: [
        'status',
        'plugin_id',
        'marketplace_id',
        'codex_plugin_cache_path',
        'marketplace_path',
        'codex_config_path',
        'required_skill_ids',
        'required_skill_paths',
        'reload_required',
      ],
    },
    consistent_action_interaction: {
      exposure_actions: ['hide', 'unhide', 'disable', 'enable'],
      lifecycle_actions: ['install', 'update', 'repair', 'uninstall'],
      launch_action: 'launch',
      required_confirmation_fields: ['what_changes', 'what_does_not_change', 'receipt_or_recovery_ref', 'post_action_refresh'],
      dry_run_or_confirmation_required: true,
    },
    rollback_verb_allowed: false,
    session_contract_allowed: false,
    runtime_authority_allowed: false,
    package_execution_authority_allowed: false,
    live_codex_surface_reload_completion_policy: 'deferred_release_runtime_evidence_not_product_contract_completion',
    must_not_own: [
      'package_lifecycle_execution',
      'package_execution_runtime',
      'package_currentness_truth',
      'live_codex_surface_reload_truth',
      'domain_truth',
      'domain_readiness',
      'owner_receipt_authority',
    ],
  };
}

function expectedCapabilityDetailPresentationPolicy() {
  return {
    default_layer: 'user_decision_detail',
    default_surface: 'desktop_right_side_panel_mobile_drawer',
    default_visible_fields: [
      'purpose',
      'status',
      'codex_availability',
      'home_shortcut',
      'version',
      'source_label',
      'last_synced_at',
      'failure_reason_when_failed',
    ],
    source_label_policy:
      'render source in user language such as OPL Packages, local developer checkout, organization registry, or user registry; do not show raw source ids by default',
    failure_reason_policy: 'show failure reason only when the capability is failed, blocked, or needs user action',
    empty_field_policy:
      'hide empty, unknown, unavailable, not_applicable, null, or unreported fields; never render 未报告 or Not reported as default user detail text',
    content_blocks: [
      {
        id: 'connectors',
        label: 'connectors',
        source_ref: 'connector_readiness_refs',
        default_visibility: 'visible_only_when_non_empty',
      },
      {
        id: 'reusable_workflows',
        label: 'reusable workflows',
        source_ref: 'workflow_refs',
        default_visibility: 'visible_only_when_non_empty',
      },
      {
        id: 'environment_resources',
        label: 'environment resources',
        source_ref: 'environment_ref + resource_source_refs',
        default_visibility: 'visible_only_when_non_empty',
      },
      {
        id: 'reproducibility_export_action',
        label: 'reproducibility export action',
        source_ref: 'export_bundle_action_ref',
        default_visibility: 'visible_only_when_action_available',
      },
    ],
    advanced_diagnostics: {
      default_visibility: 'collapsed',
      surface: 'advanced_diagnostics_disclosure_or_advanced_route',
      fields: [
        'package_id',
        'codex_visible_entry',
        'receipt_refs',
        'rollback_ref',
        'action_receipt_ref',
        'physical_surface',
        'paths',
        'manifest_ref',
        'cache_config',
        'marketplace_config',
        'raw_refs_json',
      ],
    },
  };
}

function validateEnvironmentPage(matrix) {
  const environmentPage = pageById(matrix, 'environment');
  if (environmentPage.module_path_source_policy_ref !== 'contracts/app-gui-product-contract.json#module_path_source_policy') {
    throw new Error('Environment page must reference the App GUI module path source policy');
  }
  if (!environmentPage.must_show?.includes('module path source explanation in technical details')) {
    throw new Error('Maintenance page must keep module path source explanation in technical details');
  }
  validateEnvironmentModuleMaintenanceEntry(environmentPage.module_maintenance_entry, 'Environment page');
  if (!environmentPage.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Environment page must keep MDS out of default module display');
  }
  if (environmentPage.managed_update_plane_ref !== 'contracts/app-release-channel.json#managed_update_plane') {
    throw new Error('Environment page must reference the App release managed update plane');
  }
}

function validateAdvancedPage(matrix) {
  const advancedPage = pageById(matrix, 'advanced');
  if (
    !advancedPage.state_sections?.includes('paths') ||
    advancedPage.state_sections?.includes('opl_flow_context') ||
    !advancedPage.must_show?.includes('read-only working directories from app_state.paths') ||
    !advancedPage.must_not_show?.includes('Developer Mode or Developer Profile controls')
  ) {
    throw new Error('Advanced page must be read-only working directories');
  }
}

function validateAboutPage(matrix) {
  const aboutPage = pageById(matrix, 'about');
  if (!aboutPage.must_show?.includes('Stable or Nightly channel')) {
    throw new Error('About page must show Stable or Nightly channel');
  }
  if (
    aboutPage.route_id !== 'about' ||
    aboutPage.route_scope !== 'secondary_or_deep_link' ||
    !aboutPage.must_show?.includes('update status') ||
    !aboutPage.must_show?.includes('one Check for updates action') ||
    !aboutPage.must_not_show?.includes('about redirected to Advanced')
  ) {
    throw new Error('About page must remain independent with version, channel, and update status');
  }
}

function validateCompatibilityRedirectPages(matrix, guiContract) {
  const updatePage = pageById(matrix, 'update');
  const localServicesPage = pageById(matrix, 'settings_local_services');
  assertDeepEqualJson(
    updatePage.compatibility_redirect,
    appOwnedSettingsCompatibilityRedirects.update,
    'Update compatibility redirect',
  );
  assertDeepEqualJson(
    localServicesPage.compatibility_redirect,
    appOwnedSettingsCompatibilityRedirects['local-services'],
    'Local Services compatibility redirect',
  );
  assertDeepEqualJson(
    matrix.settings_compatibility_redirects,
    appOwnedSettingsCompatibilityRedirects,
    'Page-state compatibility redirect map',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation.compatibility_redirects,
    appOwnedSettingsCompatibilityRedirects,
    'GUI compatibility redirect map',
  );
}

function validateSettingsThemePage(matrix) {
  const settingsThemePage = pageById(matrix, 'settings_theme');
  if (
    settingsThemePage.route_id !== 'appearance' ||
    settingsThemePage.route_scope !== 'ordinary' ||
    settingsThemePage.product_page_id !== 'preferences'
  ) {
    throw new Error('Settings Preferences must use the ordinary appearance carrier route');
  }
  for (const signal of [
    'reply waiting time in human units',
    'tray and close-window behavior',
    'hardware acceleration in user language',
    'Default and Codex theme choices under the themes anchor',
  ]) {
    if (!settingsThemePage.must_show?.includes(signal)) {
      throw new Error(`Settings Preferences page must show ${signal}`);
    }
  }
}

function validateSettingsPageExperience(matrix) {
  const experience = settingsControlPlane.experience_contract;
  for (const [productPageId, contract] of Object.entries(experience.page_contracts ?? {})) {
    const page = pageById(matrix, contract.matrix_page_id);
    if (
      page.product_page_id !== productPageId ||
      page.experience_contract_ref !==
        `contracts/app-settings-control-plane.json#experience_contract.page_contracts.${productPageId}` ||
      page.primary_action_id !== contract.primary_action.id ||
      page.technical_details_default !== 'collapsed' ||
      page.exception_emphasis !== 'attention_only'
    ) {
      throw new Error(`${contract.matrix_page_id} must mirror the ${productPageId} experience contract`);
    }
    assertDeepEqualJson(page.required_dom, contract.required_dom, `${productPageId} required DOM`);
    assertDeepEqualJson(page.required_anchors, contract.required_anchors, `${productPageId} required anchors`);
    assertDeepEqualJson(page.search_entry_ids, contract.search_entry_ids, `${productPageId} search entries`);
  }
}
