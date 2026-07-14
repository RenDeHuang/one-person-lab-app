import { assertDeepEqualJson, assertIncludesAll, readJson } from './assertions.ts';
import {
  appOwnedSettingsResourcesBrowserEntry,
  appOwnedSettingsCompatibilityRedirects,
  appOwnedSettingsManagedDependencySummary,
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
  settings_gateway: 'gateway',
  settings_access: 'access',
  settings_workspace: 'settings_workspace',
  settings_agents: 'agents',
  settings_capabilities: 'capabilities',
  settings_resources: 'settings_resources',
  settings_environment: 'environment',
  settings_storage: 'storage',
  settings_theme: 'settings_theme',
  about: 'about',
};

const settingsControlPlane = readJson(settingsControlPlanePath);

export function validateAppSettingsPages(matrix, guiContract) {
  validateSettingsControlPlaneBehavior({ pageStateMatrix: matrix });

  for (const [contractPageId, matrixPageId] of Object.entries(guiSettingsPageToMatrixPage)) {
    const expected = guiContract?.pages?.[contractPageId];
    if (!expected) {
      throw new Error(`App GUI contract is missing ${contractPageId}`);
    }
    const page = pageById(matrix, matrixPageId);
    if (page.page_contract !== contractPageId) {
      throw new Error(`${matrixPageId} page_contract must be ${contractPageId}`);
    }
    if (
      (typeof expected.machine_source === 'string' &&
        page.machine_source !== expected.machine_source) ||
      (typeof expected.refresh_source === 'string' &&
        page.refresh_source !== expected.refresh_source)
    ) {
      throw new Error(
        `${matrixPageId} must use the App-owned page machine and refresh sources`,
      );
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
    throw new Error('Models must not own browser access to this computer');
  }
  if (accessPage.opl_gateway_account !== undefined) {
    throw new Error('Models must not own Gateway account state or controls');
  }
  const gatewayPage = pageById(matrix, 'gateway');
  const gatewayAccount = gatewayPage.opl_gateway_account;
  if (
    gatewayAccount?.projection_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_projection' ||
    gatewayAccount.projection_path !== 'app_state.settings_control_center.app_settings_read_model.opl_gateway_account' ||
    gatewayAccount.secret_bridge_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_secret_bridge' ||
    gatewayAccount.account_card_visibility !== 'account_connection_only' ||
    gatewayAccount.manual_api_key_card_policy !== 'model_access_status_only_no_account_balance_or_account_usage' ||
    gatewayAccount.cache_ttl_seconds !== 900 ||
    gatewayAccount.stale_policy !== 'show_cached_values_with_stale_marker_and_manual_refresh' ||
    gatewayAccount.managed_key_setup_policy !==
      'auto_complete_exposed_setup_action_for_unique_codex_group_without_user_control' ||
    gatewayAccount.first_run_scope !== 'unchanged' ||
    gatewayAccount.personal_profile_navigation !== 'not_added'
  ) {
    throw new Error('Account & Gateway must consume the canonical Gateway account projection and preserve its product boundaries');
  }
  assertDeepEqualJson(gatewayAccount.access_paths, ['account_login', 'manual_api_key'], 'Gateway access paths');
  assertDeepEqualJson(
    gatewayAccount.error_states,
    ['auth_expired', 'managed_key_missing', 'managed_key_conflict', 'managed_key_identity_drift', 'disconnect_pending'],
    'Gateway account visible repair states',
  );
  assertDeepEqualJson(
    gatewayAccount,
    guiContract.pages?.settings_gateway?.opl_gateway_account,
    'Gateway account page product contract',
  );
  assertIncludesAll(
    gatewayPage.required_dom?.always,
    ['settings-gateway-access', 'settings-gateway-manual-key'],
    'Gateway access always-present DOM',
  );
  const gatewayConditionalDom = new Map(
    (gatewayPage.required_dom?.conditional ?? []).map((entry) => [entry.testid, entry.when]),
  );
  for (const [testid, when] of Object.entries({
    'settings-gateway-setup': 'desktop_account_login_selected',
    'settings-gateway-account': 'gateway_account_connected',
    'settings-gateway-stale': 'gateway_account_projection_stale',
    'settings-gateway-disconnect-confirm': 'gateway_account_disconnect_requested',
  })) {
    if (gatewayConditionalDom.get(testid) !== when) {
      throw new Error(`Account & Gateway DOM ${testid} must be conditional on ${when}`);
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
  validateEnvironmentPage(matrix, guiContract);
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
  const agentsPage = pageById(matrix, 'agents');
  const capabilitiesPage = pageById(matrix, 'capabilities');
  const guiAgentsPage = guiContract.pages?.settings_agents;
  const guiCapabilitiesPage = guiContract.pages?.settings_capabilities;

  if (
    capabilitiesPage.ownership_ref !== 'contracts/app-settings-control-plane.json#agents_capabilities_ownership.capabilities' ||
    !capabilitiesPage.must_show?.includes('OPL Flow managed and recommended Skills and Plugins from package dependency closure') ||
    !capabilitiesPage.must_show?.includes(
      'AionUI-native Skills, Plugins, MCP helpers, image generation, and voice input inside local or third-party ownership instead of OPL Flow',
    ) ||
    !capabilitiesPage.must_not_show?.includes('silent mutation of manual or third-party Skills and Plugins') ||
    !capabilitiesPage.must_not_show?.includes('voice input configuration on Preferences or Advanced')
  ) {
    throw new Error('Capabilities page must separate OPL Flow dependency-closure capabilities from manual and third-party Skills/Plugins');
  }
  if (agentsPage.refresh_source !== 'opl app state --profile fast --json') {
    throw new Error('Agents page must refresh through opl app state --profile fast --json');
  }
  assertDeepEqualJson(
    agentsPage.developer_mode_control,
    guiAgentsPage?.developer_mode_control,
    'Agents Developer Mode control',
  );
  assertDeepEqualJson(
    agentsPage.codex_plugin_directory_target?.tab_contract,
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
    agentsPage.codex_plugin_directory_target,
    guiAgentsPage?.codex_plugin_directory_target,
    'Agents package directory mirror of App GUI contract',
  );
  if (
    agentsPage.machine_source !==
    'opl app state --profile fast --json#app_state.agent_packages.directory.entries + app_state.agent_packages.status_index + app_state.runtime_source_carriers.items[] + app_state.paths.workspace_root_path + home_agent_shortcuts'
  ) {
    throw new Error('Agents page must read package installation truth, active runtime sources, and Home shortcuts only');
  }
  assertIncludesAll(
    agentsPage.state_sections,
    ['agent_packages.directory', 'agent_packages.status_index', 'runtime_source_carriers.items', 'modules.items', 'home_agent_shortcuts'],
    'Agents page package state sections',
  );
  for (const forbiddenSection of ['modules', 'tools', 'operator.workbench.task_drilldowns']) {
    if (agentsPage.state_sections?.includes(forbiddenSection)) {
      throw new Error(`Agents page must not own redundant or Capabilities state section ${forbiddenSection}`);
    }
  }
  for (const forbiddenField of [
    'task_awareness_refs_source',
    'task_awareness_ref_fields',
    'task_awareness_ref_policy',
    'export_bundle_action_policy',
    'workflow_skill_candidate_policy',
    'builtin_skill_catalog_policy',
    'auto_injected_skills_policy',
    'capability_detail_presentation_policy',
    'package_directory_policy',
  ]) {
    if (Object.hasOwn(agentsPage, forbiddenField)) {
      throw new Error(`Agents page must not own Capabilities field ${forbiddenField}`);
    }
  }
  assertDeepEqualJson(
    agentsPage.current_runtime_projection_boundary,
    guiAgentsPage?.current_runtime_projection_boundary,
    'Agents page current runtime projection boundary',
  );
  if (
    agentsPage.current_runtime_projection_boundary?.legacy_fallback_projection !==
      'opl app state --profile fast --json#app_state.modules.items[] + home_agent_shortcuts'
  ) {
    throw new Error('Agents legacy fallback must exclude Capabilities task-awareness drilldowns');
  }
  assertDeepEqualJson(
    agentsPage.agent_package_lifecycle_ux,
    expectedAgentPackageLifecycleUx(),
    'Agents page Agent Package lifecycle UX',
  );
  assertDeepEqualJson(
    agentsPage.agent_package_lifecycle_ux,
    guiAgentsPage?.agent_package_lifecycle_ux,
    'Agents page Agent Package lifecycle UX mirror of App GUI contract',
  );
  assertDeepEqualJson(
    agentsPage.status_model,
    guiAgentsPage?.status_model,
    'Agents page status model',
  );
  if (agentsPage.status_model?.policy !== 'multi_axis_package_status_no_single_repair_bucket') {
    throw new Error('Agents page must preserve multi-axis package status');
  }
  assertDeepEqualJson(
    agentsPage.list_density_policy,
    guiAgentsPage?.list_density_policy,
    'Agents page list density policy',
  );
  if (agentsPage.list_density_policy?.row_identity_key !== 'package_id') {
    throw new Error('Agents rows must remain keyed by package identity');
  }

  if (
    capabilitiesPage.machine_source !== guiCapabilitiesPage?.state_source ||
    capabilitiesPage.refresh_source !== guiCapabilitiesPage?.refresh_source
  ) {
    throw new Error('Capabilities page must use the canonical lazy Skill and Plugin projection');
  }
  assertIncludesAll(
    capabilitiesPage.state_sections,
    [
      'agent_packages.status_index',
      'codex_skills',
      'codex_plugins',
      'shell_skill_plugin_registry',
      'shell_local_mcp_image_voice_configuration',
      'operator.workbench.task_drilldowns',
    ],
    'Capabilities page state sections',
  );
  if (
    capabilitiesPage.local_capability_configuration_source !==
      'AionUI local configuration#MCP servers + image generation + voice input' ||
    !capabilitiesPage.required_dom?.always?.includes('settings-capabilities-voice-input') ||
    !guiCapabilitiesPage?.entity_kinds?.includes('voice_input')
  ) {
    throw new Error('Capabilities page must own local MCP, image, and voice configuration with stable DOM');
  }
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
    capabilitiesPage.builtin_skill_catalog_policy,
    guiCapabilitiesPage?.builtin_skill_catalog_policy,
    'Capabilities page built-in Skill catalog policy',
  );
  assertDeepEqualJson(
    capabilitiesPage.auto_injected_skills_policy,
    guiCapabilitiesPage?.auto_injected_skills_policy,
    'Capabilities page auto-injected Skill policy',
  );
  assertDeepEqualJson(
    capabilitiesPage.capability_detail_presentation_policy,
    expectedCapabilityDetailPresentationPolicy(),
    'Capabilities page detail presentation policy',
  );
  assertDeepEqualJson(
    capabilitiesPage.capability_detail_presentation_policy,
    guiCapabilitiesPage?.capability_detail_presentation_policy,
    'Capabilities page detail presentation mirror of App GUI contract',
  );
  for (const forbiddenField of [
    'developer_mode_control',
    'codex_plugin_directory_target',
    'current_runtime_projection_boundary',
    'agent_package_lifecycle_ux',
    'status_model',
    'list_density_policy',
  ]) {
    if (Object.hasOwn(capabilitiesPage, forbiddenField)) {
      throw new Error(`Capabilities page must not own Agents field ${forbiddenField}`);
    }
  }
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
    primary_state_surface: 'app_state.agent_packages.directory.entries + app_state.agent_packages.status_index',
    directory_collection_contract: {
      source: 'app_state.agent_packages.directory.entries',
      collection_owner: 'one-person-lab',
      consumer_policy: 'render every projected entry without a shell allowlist, first-party seed, or installed-only filter',
      required_entry_fields: [
        'package_id',
        'display_name',
        'publisher',
        'description',
        'tags',
        'package_role',
        'role_state',
        'trust_tier',
        'source_explanation',
        'manifest_url',
        'selected_version',
        'stable_version',
        'installed_version',
        'installed',
        'activated',
        'installability',
        'readiness',
        'recommended_action',
        'recommended_action_ref',
        'available_actions',
        'authority_boundary',
      ],
      static_metadata_overlay_source: 'contracts/app-product-profile.json#gui.professional_agent_packages',
      static_metadata_overlay_policy: 'package_id keyed optional UI metadata only; it cannot define collection membership, availability, status, actions, or OMA and first-party seeds',
      unavailable_policy: 'show loading, empty, stale, or failed canonical directory state; never substitute static professional_agent_packages as directory truth',
      first_party_policy: 'OMA and every first-party package use the same directory entries and action contract as every other package',
    },
    runtime_source_surface: 'app_state.runtime_source_carriers.items[]',
    source_semantics_policy:
      'package state is installation truth; runtime source carrier is active run source; never infer installation from checkout presence',
    shell_consumers: ['aionui', 'opl_native_workbench'],
    action_ref_source: 'app_state.actions',
    action_route: 'opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json',
    field_behavior_checklist: [
      'render_every_directory_entry_including_uninstalled_packages_OMA_and_all_first_party_packages',
      'keep_catalog_search_distinct_from_Settings_global_search',
      'filter_by_package_role_install_or_activation_status_and_source',
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
      'execute_only_projected_action_id_and_payload_without_shell_status_or_payload_inference',
      'refresh_fast_state_after_successful_install_then_show_projected_activate_when_recommended',
      'disable_workspace_activation_with_a_workspace_route_and_reason_when_workspace_root_is_missing',
      'keep_registry_refresh_ordinary_and_visible_while_manifest_URL_install_stays_advanced',
      'use_consistent_confirmation_and_receipt_pattern_for_hide_disable_update_repair_uninstall_install_and_launch',
      'display_rollback_ref_as_recovery_reference_only_no_app_rollback_verb',
    ],
    directory_controls: {
      top_controls: ['refresh_registry', 'catalog_search', 'package_role_filter', 'package_status_filter', 'package_source_filter', 'manifest_url_install_advanced'],
      filters: ['package_role', 'install_or_activation_status', 'source'],
      row_actions: ['install', 'activate', 'hide', 'unhide', 'disable', 'enable', 'update', 'repair', 'uninstall', 'launch', 'open_details'],
      catalog_search_scope: ['display_name', 'package_id', 'description', 'tags', 'publisher'],
      catalog_search_is_settings_global_search: false,
      catalog_states: ['loading', 'ready', 'refreshing', 'empty', 'stale', 'failed'],
    },
    canonical_action_contract: {
      source_fields: ['directory.entries[].available_actions[]', 'directory.entries[].recommended_action_ref'],
      required_action_fields: ['action_id', 'action_ref', 'payload', 'required_payload_fields', 'confirmation_required'],
      recommended_action_id_field: 'directory.entries[].recommended_action',
      recommended_action_ref_match_policy: 'recommended_action_ref is null when recommended_action is null; otherwise it exactly equals the available_actions item with the same action_id',
      action_availability_policy: 'an action is available only when Framework projects its complete action object; action objects do not carry shell-inferred enabled, reason_code, or failure_reason fields',
      shell_action_inference_allowed: false,
      post_success_policy: 'refresh opl app state --profile fast --json and render the next projected recommended_action_ref',
      failure_policy: 'preserve the directory row and show the Framework error or readiness.reason/status_read_error without synthesizing ready, synced, or available',
    },
    workspace_activation_contract: {
      action_id: 'agent_package_activate',
      workspace_path_source: 'app_state.paths.workspace_root_path',
      payload_template: {
        package_id: 'directory.entries[].package_id',
        scope: 'workspace',
        target_workspace: 'app_state.paths.workspace_root_path',
      },
      compatibility_path_policy: 'legacy workspace paths may be normalized only inside the shell adapter and never become product truth',
      missing_workspace_policy: {
        enabled: false,
        reason_code: 'workspace_root_not_configured',
        route: '/settings/workspace',
        anchor: 'workspace',
      },
      package_id_only_payload_allowed: false,
    },
    source_explanation_fields: [
      'kind',
      'source',
      'summary',
      'catalog_ref',
      'registry_url',
      'registry_source_ref',
      'version_source_ref',
    ],
    role_state_fields: [
      'status',
      'source',
      'discovered_role',
      'installed_role',
      'diagnostic',
    ],
    installability_fields: ['status', 'installable'],
    readiness_fields: [
      'status',
      'operational_ready',
      'launch_allowed',
      'verification_deferred',
      'reason',
      'detail_surface',
      'status_read_error',
    ],
    readiness_profile_policy: {
      fast_activated: {
        status: 'verification_deferred',
        operational_ready: false,
        launch_allowed: false,
        verification_deferred: true,
        reason: 'live_verification_deferred',
      },
      full_verified: {
        status: 'ready',
        operational_ready: true,
        launch_allowed: true,
        verification_deferred: false,
        reason: null,
      },
      presentation_policy: 'fast verification_deferred is fail-closed until full verification and must not be relabeled ready or repair',
    },
    failure_reason_fields: [
      'readiness.status',
      'readiness.reason',
      'readiness.status_read_error',
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
      directory_fast_nested_fields: {
        role_state: ['status', 'source', 'discovered_role', 'installed_role', 'diagnostic'],
        source_explanation: ['kind', 'source', 'summary', 'catalog_ref', 'registry_url', 'registry_source_ref', 'version_source_ref'],
        installability: ['status', 'installable'],
        readiness: ['status', 'operational_ready', 'launch_allowed', 'verification_deferred', 'reason', 'detail_surface', 'status_read_error'],
        'available_actions[]': ['action_id', 'action_ref', 'payload', 'required_payload_fields', 'confirmation_required'],
      },
      directory_full_only_fields: ['lifecycle_ux', 'lock_ref', 'scope_materialization_count'],
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
      lifecycle_actions: ['install', 'activate', 'update', 'repair', 'uninstall'],
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
    default_surface: 'desktop_right_side_panel_mobile_drawer',
    default_visible_fields: [
      'display_name',
      'entity_kind',
      'ownership_group',
      'source_label',
      'owner',
      'version',
      'currentness',
      'available_actions',
    ],
    source_label_policy:
      'render product-profile display names and user-language owners; raw provider ids stay in diagnostics',
    empty_field_policy:
      'hide empty unknown or unavailable values and explain a genuinely unavailable canonical source',
    advanced_diagnostics: {
      default_visibility: 'collapsed',
      fields: [
        'provider_id',
        'registry_path',
        'dependency_ref',
        'receipt_refs',
        'raw_refs_json',
      ],
    },
  };
}

function validateEnvironmentPage(matrix, guiContract) {
  const environmentPage = pageById(matrix, 'environment');
  if (environmentPage.module_path_source_policy_ref !== 'contracts/app-gui-product-contract.json#module_path_source_policy') {
    throw new Error('Environment page must reference the App GUI module path source policy');
  }
  if (!environmentPage.must_show?.includes('module path source explanation in technical details')) {
    throw new Error('Maintenance page must keep module path source explanation in technical details');
  }
  validateEnvironmentModuleMaintenanceEntry(environmentPage.module_maintenance_entry, 'Environment page');
  assertDeepEqualJson(
    environmentPage.managed_dependency_summary,
    appOwnedSettingsManagedDependencySummary,
    'Maintenance managed dependency summary',
  );
  assertDeepEqualJson(
    guiContract.pages?.settings_environment?.managed_dependency_summary,
    appOwnedSettingsManagedDependencySummary,
    'App GUI Maintenance managed dependency summary',
  );
  if (!environmentPage.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Environment page must keep MDS out of default module display');
  }
  if (
    environmentPage.software_lifecycle_ref !==
    'contracts/app-release-channel.json#managed_update_plane.software_lifecycle'
  ) {
    throw new Error('Environment page must reference the App release three-object software lifecycle');
  }
  if (
    !environmentPage.must_show?.includes(
      'active Codex CLI, OPL-managed Temporal Runtime, and optional system Temporal CLI with version, source, currentness, and update guidance on the main Maintenance surface',
    ) ||
    !environmentPage.must_show?.includes(
      'Framework and raw working paths inside read-only Maintenance diagnostics',
    ) ||
    environmentPage.managed_dependency_summary?.required_ids?.some((id) => id.includes('_'))
  ) {
    throw new Error('Maintenance must own managed dependency currentness and retired Advanced diagnostics');
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
    !aboutPage.must_show?.includes('cached update status from the one startup check or last manual check') ||
    !aboutPage.must_show?.includes('one Check for updates action') ||
    !aboutPage.must_not_show?.includes('about redirected to Advanced') ||
    aboutPage.updater_state_policy?.startup_check !== 'once_after_App_startup' ||
    aboutPage.updater_state_policy?.mount_check !== false ||
    aboutPage.updater_state_policy?.shared_state !== 'single_main_process_updater_state_store' ||
    aboutPage.updater_state_policy?.manual_check !== 'refresh_the_same_shared_state'
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
