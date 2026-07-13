import { assertDeepEqualJson, assertIncludesAll, readJson } from './assertions.ts';
import {
  appOwnedSettingsResourcesBrowserEntry,
  appOwnedSettingsCompatibilityRedirects,
  appOwnedSettingsResourceActionBehavior,
  appOwnedSettingsTechnicalDetailsDefault,
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
  settings_agents: 'agents',
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
  const gatewayAccount = accessPage.opl_gateway_account;
  if (
    gatewayAccount?.projection_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_projection' ||
    gatewayAccount.projection_path !== 'app_state.settings_control_center.app_settings_read_model.opl_gateway_account' ||
    gatewayAccount.secret_bridge_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_secret_bridge' ||
    gatewayAccount.account_card_visibility !== 'account_connection_only' ||
    gatewayAccount.manual_api_key_card_policy !== 'model_access_status_only_no_account_balance_or_account_usage' ||
    gatewayAccount.cache_ttl_seconds !== 900 ||
    gatewayAccount.stale_policy !== 'show_cached_values_with_stale_marker_and_manual_refresh' ||
    gatewayAccount.setup_required_policy !== 'auto_complete_unique_codex_group_without_user_control' ||
    gatewayAccount.first_run_scope !== 'unchanged' ||
    gatewayAccount.personal_profile_navigation !== 'not_added'
  ) {
    throw new Error('Models & Access must consume the canonical Gateway account projection and preserve its product boundaries');
  }
  assertDeepEqualJson(gatewayAccount.access_paths, ['account_login', 'manual_api_key'], 'Gateway access paths');
  assertDeepEqualJson(
    gatewayAccount.error_states,
    ['auth_expired', 'managed_key_missing', 'managed_key_conflict', 'managed_key_identity_drift', 'disconnect_pending'],
    'Gateway account visible repair states',
  );
  assertDeepEqualJson(
    gatewayAccount,
    guiContract.pages?.settings_access?.opl_gateway_account,
    'Gateway account page product contract',
  );
  assertIncludesAll(
    accessPage.required_dom?.always,
    ['settings-access-gateway', 'settings-access-gateway-manual-key'],
    'Gateway access always-present DOM',
  );
  const gatewayConditionalDom = new Map(
    (accessPage.required_dom?.conditional ?? []).map((entry) => [entry.testid, entry.when]),
  );
  for (const [testid, when] of Object.entries({
    'settings-access-gateway-setup': 'desktop_account_login_selected',
    'settings-access-gateway-account': 'gateway_account_connected',
    'settings-access-gateway-stale': 'gateway_account_projection_stale',
    'settings-access-gateway-disconnect-confirm': 'gateway_account_disconnect_requested',
  })) {
    if (gatewayConditionalDom.get(testid) !== when) {
      throw new Error(`Models & Access Gateway DOM ${testid} must be conditional on ${when}`);
    }
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
  const capabilityPage = pageById(matrix, 'capabilities');
  if (
    capabilityPage.ownership_ref !== 'contracts/app-settings-control-plane.json#agents_capabilities_ownership.capabilities' ||
    !capabilityPage.must_show?.includes('OPL Flow managed and recommended Skills and Plugins from package dependency closure') ||
    !capabilityPage.must_not_show?.includes('silent mutation of manual or third-party Skills and Plugins')
  ) {
    throw new Error('Capabilities page must separate OPL Flow dependency-closure capabilities from manual and third-party Skills/Plugins');
  }
  const capabilitiesPage = pageById(matrix, 'agents');
  if (capabilitiesPage.refresh_source !== 'opl app state --profile fast --json') {
    throw new Error('Capabilities page must refresh through opl app state --profile fast --json');
  }
  assertDeepEqualJson(
    capabilitiesPage.codex_plugin_directory_target?.tab_contract,
    {
      surface_label_zh: '智能体',
      surface_label_en: 'Agents',
      tab_order: ['agents'],
      default_tab: 'agents',
      on_demand_tab_ids: [],
    },
    'Agents page package directory tab contract',
  );
  assertDeepEqualJson(
    guiContract.pages?.settings_agents?.codex_plugin_directory_target?.tab_contract,
    capabilitiesPage.codex_plugin_directory_target?.tab_contract,
    'App GUI Agents package directory tab contract',
  );
  if (
    capabilitiesPage.machine_source !==
    'opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index + app_state.runtime_source_carriers.items[] + home_agent_shortcuts + operator.workbench.task_drilldowns'
  ) {
    throw new Error('Agents page must read package installation truth, active runtime sources, Home shortcuts, and task-awareness refs');
  }
  assertIncludesAll(
    capabilitiesPage.state_sections,
    ['agent_packages.directory', 'agent_packages.status_index', 'runtime_source_carriers.items', 'modules.items', 'home_agent_shortcuts', 'operator.workbench.task_drilldowns'],
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
      supporting_surfaces: ['skills', 'tools', 'external_tools_voice'],
    },
    'Capabilities page package directory policy',
  );
  assertDeepEqualJson(
    capabilitiesPage.current_runtime_projection_boundary,
    {
      canonical_projection:
        'opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index + app_state.runtime_source_carriers.items[]',
      runtime_source_projection:
        'opl app state --profile fast --json#app_state.runtime_source_carriers.items[]',
      source_semantics_policy:
        'agent package state owns installation truth; runtime source carriers own active run source; runtime source presence alone is not package installation truth',
      legacy_fallback_projection:
        'opl app state --profile fast --json#app_state.modules.items[] + home_agent_shortcuts + app_state.operator.workbench.task_drilldowns',
      normalization_policy:
        'shell must use agent_packages for installation truth, overlay runtime_source_carriers for active run source, and only fall back to modules.items when older runtime payloads or partial projections are still in circulation',
      developer_source_examples: [
        'runtime_source_carriers.items[].source_origin=sibling_workspace',
        'runtime_source_carriers.items[].source_policy.effective_install_update_source=git_checkout',
        'runtime_source_carriers.items[].source_policy.configured_by=developer_mode',
        'runtime_source_carriers.items[].git.sync_status=behind',
        'runtime_source_carriers.items[].git.dirty=true',
      ],
      completion_boundary:
        'this page-state target requires canonical agent_packages installation truth plus runtime_source_carriers active run source and allows modules.items fallback only as rollout compatibility',
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
    guiContract.pages.settings_agents.agent_package_lifecycle_ux,
    'Capabilities page Agent Package lifecycle UX mirror of App GUI contract',
  );
  assertDeepEqualJson(
    capabilitiesPage.status_model,
    {
      policy: 'multi_axis_package_status_no_single_repair_bucket',
      axes: ['install_state', 'update_state', 'source_state', 'trust_state', 'codex_surface_state', 'dependency_readiness', 'operational_ready', 'launch_allowed', 'activation_action'],
      source_inputs: [
        'app_state.agent_packages.directory.installed_packages[]',
        'app_state.agent_packages.status_index.packages[]',
        'app_state.agent_packages.status_index.home_shortcut_preferences[]',
        'app_state.agent_packages.directory.installed_packages[].dependency_closure',
        'app_state.agent_packages.directory.installed_packages[].dependent_guard',
        'app_state.agent_packages.status_index.packages[].dependency_readiness',
        'app_state.agent_packages.status_index.packages[].operational_ready',
        'app_state.agent_packages.status_index.packages[].launch_allowed',
        'app_state.agent_packages.status_index.packages[].launch_blocked_reason',
        'app_state.agent_packages.status_index.packages[].allowed_when_blocked',
        'app_state.agent_packages.status_index.packages[].repair_action',
        'app_state.agent_packages.status_index.packages[].activation_action',
        'app_state.agent_packages.status_index.packages[].dependent_guard',
        'app_state.runtime_source_carriers.items[].source_origin',
        'app_state.runtime_source_carriers.items[].source_path',
        'app_state.runtime_source_carriers.items[].source_policy.effective_install_update_source',
        'app_state.runtime_source_carriers.items[].source_policy.configured_by',
        'app_state.runtime_source_carriers.items[].git.sync_status',
        'app_state.runtime_source_carriers.items[].git.dirty',
        'app_state.modules.items[] compatibility fallback',
        'managed_update.components[opl_packages].projection_status',
      ],
      developer_source_policy:
        'active runtime developer checkout semantics must surface explicitly, remain distinct from package installation source, and must not be collapsed into a generic repair bucket',
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
    runtime_source_surface: 'app_state.runtime_source_carriers.items[]',
    source_semantics_policy:
      'package state is installation truth; runtime source carrier is active run source; never infer installation from checkout presence',
    fallback_state_surface: 'app_state.modules.items[]',
    fallback_policy:
      'modules.items fallback is compatibility-only for older or partial payloads and cannot claim package currentness, execution readiness, or mutation authority',
    shell_consumers: ['aionui', 'opl_native_workbench'],
    action_ref_source: 'app_state.actions',
    action_route: 'opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json',
    field_behavior_checklist: [
      'search_by_package_name_short_name_tag_source_or_description',
      'filter_by_install_update_source_trust_codex_surface_and_home_visibility_state',
      'distinguish_package_install_source_from_active_runtime_source_in_user_language',
      'show_failure_reason_only_when_failed_blocked_or_needs_user_action',
      'operational_ready_false_or_dependency_repair_required_must_never_render_ready',
      'operational_ready_false_must_disable_ordinary_package_and_agent_launch',
      'blocked_packages_allow_only_status_doctor_and_repair_actions',
      'show_dependency_readiness_and_dependent_guard_in_normal_details',
      'trigger_only_projected_repair_action_when_enabled',
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
      'runtime_source_origin',
      'runtime_source_path',
      'runtime_source_policy',
    ],
    failure_reason_fields: [
      'failure_reason',
      'blocker_summary',
      'last_action_receipt_ref',
      'recommended_action',
      'dependency_readiness.status',
      'dependency_readiness.checks[].failure_reasons',
      'operational_ready',
      'launch_allowed',
      'launch_blocked_reason',
      'allowed_when_blocked',
      'activation_action.reason_code',
      'dependent_guard.disable.reason_code',
      'dependent_guard.uninstall.reason_code',
    ],
    package_projection_contract: {
      directory_installed_package_fields: {
        dependency_closure: ['root_package_id', 'transaction_id', 'generation_id', 'closure_digest', 'last_known_good_generation_id', 'last_known_good_closure_digest', 'required_package_ids'],
        dependent_guard: ['required_by_package_ids', 'disable.allowed', 'disable.reason_code', 'uninstall.allowed', 'uninstall.reason_code'],
      },
      status_index_package_fields: {
        dependency_readiness: ['status', 'required_count', 'ready_count', 'checks', 'closure'],
        dependency_readiness_status_values: ['ready', 'repair_required', 'blocked'],
        dependency_check_fields: ['package_id', 'required', 'installed', 'enabled', 'version_requirement', 'installed_version', 'version_satisfied', 'capability_abi', 'installed_capability_abi', 'abi_satisfied', 'required_export_ids', 'available_export_ids', 'exports_satisfied', 'content_lock_digest', 'physical_surface_status', 'ready', 'failure_reasons'],
        dependency_closure_receipt_fields: ['transaction_id', 'generation_id', 'closure_digest', 'last_known_good_generation_id', 'last_known_good_closure_digest'],
        operational_ready: 'boolean',
        launch_allowed: 'boolean',
        launch_blocked_reason: 'null_or_string',
        allowed_when_blocked: ['status', 'doctor', 'repair'],
        repair_action: ['action_id', 'command_ref', 'enabled', 'reason_code'],
        activation_action: ['action_id', 'command_ref', 'enabled', 'preparation_status', 'reason_code'],
        dependent_guard: ['required_by_package_ids', 'disable.allowed', 'disable.reason_code', 'uninstall.allowed', 'uninstall.reason_code'],
      },
      activation_preparation_status_values: ['not_installed', 'prepare_required', 'ready'],
      activation_preparation_policy: {
        package_not_installed: {
          preparation_status: 'not_installed',
          enabled: false,
          reason_code: 'package_not_installed',
        },
        installed_scope_stale: {
          preparation_status: 'prepare_required',
          enabled: true,
          reason_code: 'scope_reconciliation_required',
        },
        installed_scope_current: {
          preparation_status: 'ready',
          enabled: true,
          reason_code: 'use_boundary_reconciliation_ready',
        },
      },
      repair_action_id: 'repair_dependency_closure',
      launch_gate_policy: 'operational_ready_false_requires_launch_allowed_false_and_only_status_doctor_repair_remain_allowed',
      launch_fail_closed_reason_codes: ['package_not_installed'],
      closure_diagnostics_surface: 'advanced_diagnostics_only',
      forbidden_private_fields: ['staging_path', 'journal_path'],
    },
    receipt_physical_surface_detail_policy: {
      surface: 'details_panel_or_advanced_diagnostics',
      default_primary_row_visible: false,
      receipt_fields: [
        'receipt_refs',
        'package_lock_ref',
        'action_receipt_ref',
        'rollback_ref',
        'dependency_closure.transaction_id',
        'dependency_closure.generation_id',
        'dependency_closure.closure_digest',
        'dependency_closure.last_known_good_generation_id',
        'dependency_closure.last_known_good_closure_digest',
      ],
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
  if (
    environmentPage.software_lifecycle_ref !==
    'contracts/app-release-channel.json#managed_update_plane.software_lifecycle'
  ) {
    throw new Error('Environment page must reference the App release three-object software lifecycle');
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
  const personalizationPage = pageById(matrix, 'settings_personalization');
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
    personalizationPage.compatibility_redirect,
    appOwnedSettingsCompatibilityRedirects.personalization,
    'Personalization compatibility redirect',
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
    'application behavior and notifications in a full-width group',
    'reply waiting time, idle-assistant release, and hardware acceleration in a named performance and background activity group',
    'tray and close-window behavior',
    'Light, Dark, and Codex theme choices under the themes anchor',
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
    const expectedTechnicalDetailsDefault = appOwnedSettingsTechnicalDetailsDefault[productPageId];
    if (
      page.product_page_id !== productPageId ||
      page.experience_contract_ref !==
        `contracts/app-settings-control-plane.json#experience_contract.page_contracts.${productPageId}` ||
      page.primary_action_id !== contract.primary_action.id ||
      page.technical_details_default !== expectedTechnicalDetailsDefault ||
      page.exception_emphasis !== 'attention_only'
    ) {
      throw new Error(`${contract.matrix_page_id} must mirror the ${productPageId} experience contract`);
    }
    assertDeepEqualJson(page.required_dom, contract.required_dom, `${productPageId} required DOM`);
    assertDeepEqualJson(page.required_anchors, contract.required_anchors, `${productPageId} required anchors`);
    assertDeepEqualJson(page.search_entry_ids, contract.search_entry_ids, `${productPageId} search entries`);
  }
}
