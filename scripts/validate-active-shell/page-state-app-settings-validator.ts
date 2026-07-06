import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appActionRoute,
  appOwnedSettingsRouteScopes,
  settingsPageExpectations,
} from './app-contract-constants.ts';
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
    [
      'capability_health_refs',
      'connector_readiness_refs',
      'workflow_refs',
      'export_bundle_action_ref',
      'resource_source_refs',
      'gateway_status_ref',
      'environment_ref',
      'environment_template_ref',
      'environment_version_ref',
      'environment_source_ref',
      'environment_task_refs',
      'console_policy_ref',
      'storage_ref',
      'resource_receipt_ref',
      'cost_estimate_ref',
      'candidate_report_refs',
      'workflow_skill_candidate_refs',
    ],
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
    ['MAS', 'MAG', 'RCA', 'OMA', 'OBF', 'ScholarSkills'],
    `${label} module maintenance modules`,
  );
  assertIncludesAll(
    entry?.required_status,
    [
      'OPL Packages state and Codex Surface substatus',
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
      apply_managed_component: 'opl update apply --component <component_id> --json',
      apply_allowed_components: ['capability_packages'],
      apply_forbidden_components: [
        'installation_carrier',
        'runtime_substrate',
        'companion_tools',
        'codex_surface',
        'workflow_profile',
      ],
      repair: 'opl update repair --receipt <receipt_id> --json',
      rollback: 'opl update rollback --component <component_id> --json',
      app_action_route: appActionRoute,
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
