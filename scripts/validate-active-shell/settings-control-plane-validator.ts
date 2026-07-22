import { assertDeepEqualJson, assertIncludesAll } from "./assertions.ts";
import {
  appActionRoute,
  appOwnedSecondarySettingsPages,
  appOwnedSettingsResourcesBrowserEntry,
  appOwnedSettingsCompatibilityRedirects,
  appOwnedSettingsCardFields,
  appOwnedSettingsCapabilitiesTabContract,
  appOwnedSettingsConfirmationFields,
  appOwnedSettingsIaGroupIds,
  appOwnedSettingsIssueStatuses,
  appOwnedSettingsAboutUpdaterStatePolicy,
  appOwnedSettingsAppUpdateStatePolicy,
  appOwnedSettingsAppUpdateStatePolicyRef,
  appOwnedSettingsMakeUsableAllowedSteps,
  appOwnedSettingsMakeUsableForbiddenSteps,
  appOwnedSettingsManagedDependencySummary,
  appOwnedSettingsManagedUpdateRepairPolicy,
  appOwnedSettingsManagedUpdateRepairPolicyRef,
  appOwnedSettingsNavigationDestinationIds,
  appOwnedSettingsNavigationDestinationOwners,
  appOwnedSettingsNavigationGroupLabels,
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
  appOwnedStorageCarrierBehavior,
  appOwnedWebuiDataVolumeHostActionAbiRef,
  appOwnedWebuiDataVolumeHostActionCapabilityId,
  appOwnedSettingsRouteScopes,
  appOwnedSettingsSearchEntryFields,
  appOwnedSettingsSearchProtocol,
  appOwnedSettingsTabs,
  appOwnedSettingsTaskEntryMetadataFields,
  appOwnedSettingsTechnicalDetailsDefault,
  appOwnedSettingsTopLevelEntryIds,
  appOwnedSettingsTopLevelLabels,
  appOwnedSettingsUpstreamIntakeClassifications,
  appOwnedSettingsTaskEntryIds,
  appOwnedSettingsVisualQaTargets,
  appOwnedSettingsVisualSystem,
  legacySettingsRouteRedirects,
} from "./app-contract-constants.ts";
import { validateSettingsCapabilitiesTaskAwarenessSurface } from "./shared-contract-validators.ts";

const settingsIaRef =
  "contracts/app-gui-product-contract.json#settings_navigation.settings_ia";
const settingsControlPlaneContractRef =
  "contracts/app-settings-control-plane.json";
const expectedAgentsStateSource =
  "opl app state --profile fast --json#app_state.agent_packages.directory.entries + app_state.agent_packages.status_index + app_state.runtime_source_carriers.items[] + home_agent_shortcuts";
const expectedCapabilitiesStateSource =
  "opl update status --json#managed_update.components[component_id=opl_base].current.dependency_catalog.flow_dependencies + Codex and shell skill/plugin registries";
const expectedStartupPerformancePolicy = {
  schema: "settings_startup_performance.v1",
  first_window_state_source:
    "renderer_localStorage_allowlisted_fast_state_snapshot_or_loading_shell",
  background_state_source: "opl app state --profile fast --json",
  first_window_blocking_policy:
    "never_wait_for_complete_fast_state_or_page_drilldowns",
  first_window_failure_policy:
    "render_recoverable_nonblank_shell_never_fatal_or_blank_candidate_window",
  cold_budget_ms: 1500,
  warm_budget_ms: 1500,
  budget_scope:
    "stable_shell_first_paint_and_interactive_settings_shell_only_background_hydration_reported_separately",
  ordinary_guid_interactive_target_ms: 1500,
  ordinary_guid_target_scope:
    "OS_launch_request_to_Guid_composer_visible_enabled_and_focusable",
  ordinary_guid_target_status:
    "required_unverified_installed_target_not_current_measurement_or_SLA",
  background_hydration_in_guid_target: false,
  timing_milestones: [
    "stable_shell_first_paint",
    "background_hydration_complete",
  ],
  startup_projection_payload_budget_bytes: 262144,
  lazy_drilldown_routes: ["agents", "capabilities", "storage", "about"],
  single_flight_background_refresh: true,
  global_refresh_on_route_mount: false,
  persisted_snapshot: {
    schema: "opl_settings_startup_snapshot.v1",
    source: "renderer_localStorage_allowlisted_fast_state_cache",
    version: 1,
    freshness_policy: "stale_while_revalidate_with_observed_at_and_stale_fields",
    invalidation: [
      "schema_or_version_mismatch",
      "App_release_identity_change",
      "explicit_sign_out_or_cache_clear",
    ],
    secret_boundary: "allowlisted_read_models_only_no_tokens_passwords_raw_receipts_or_unredacted_errors",
  },
  background_hydration_retry: {
    max_attempts: 2,
    retry_delay_ms: 250,
    clear_single_flight_marker_after_failure: true,
    remount_or_manual_retry_after_exhaustion: true,
  },
  framework_projection_claim:
    "not_proven_by_ui_contract_or_shell_gate",
  live_measurement_gate:
    "installed_App_launch_to_first_window_and_settings_readiness_after_owner_absorption",
};

const expectedLegacyRedirects = {
  ...legacySettingsRouteRedirects,
};

const expectedOptionalResourceProjectionPolicy = {
  source: "settings_control_center.app_settings_read_model.resource_sources",
  record_eligibility:
    "canonical_record_exists_and_contains_at_least_one_resource_source_owner_or_route_ref",
  group_visibility:
    "render_each_resource_category_only_when_that_category_has_at_least_one_eligible_record",
  empty_projection_policy:
    "render_no_external_resource_group_anchor_or_placeholder",
  excluded_builtin_ids: ["opl_gateway", "gateway"],
  ordinary_display_fields: [
    "status",
    "management_mode",
    "resource_source_refs",
    "owner_ref",
    "route_ref",
    "projected_action_refs",
  ],
  forbidden_app_authority: [
    "resource_scheduling",
    "resource_billing",
    "credential_ownership",
    "storage_execution",
    "provider_truth",
  ],
};

const expectedConditionalResourceGroup = {
  id: "conditional_external_resource_refs",
  when:
    "at_least_one_canonical_owner_projected_resource_record_has_a_resource_or_route_ref",
  empty_policy: "omit_group_anchor_and_placeholder",
};

const expectedConditionalResourceSection = {
  ...expectedConditionalResourceGroup,
  empty_policy: "omit_section_anchor_and_placeholder",
};

const expectedAnchorRemap = Object.fromEntries(
  Object.entries(expectedLegacyRedirects).map(([id, target]) => [
    id,
    String(target).split(/[?#]/)[0],
  ]),
);

const expectedSlotKeys = [
  "settings_general",
  "settings_gateway",
  "settings_access",
  "settings_agents",
  "settings_capabilities",
  "settings_environment",
  "settings_storage",
  "settings_theme",
  "settings_personalization",
  "about",
  "update",
  "workspace",
  "local_services",
  "settings_resources",
];

const expectedSettingsAdapterEvidence = [
  "SettingsHost renders ordinary routes from the hydrated App settings registry",
  "SettingsShellAdapterSlot mounts App-owned route slots without shell-owned product IA",
  "legacy route redirects and extension anchor remaps are resolved before shell rendering",
  "AionUI upstream settings intake is classified as accepted/adapt/redirect/reject before registry or slot changes",
];

const expectedPageAdapterEntries = {
  general: "packages/desktop/src/renderer/pages/settings/sections/OverviewSettings.tsx",
  gateway: "packages/desktop/src/renderer/pages/settings/accessProjection.ts",
  access: "packages/desktop/src/renderer/pages/settings/accessProjection.ts",
  workspace: "packages/desktop/src/renderer/pages/settings/sections/WorkspaceSettings.tsx",
  agents: "packages/desktop/src/renderer/pages/settings/agentPackagesProjection.ts",
  capabilities:
    "packages/desktop/src/renderer/pages/settings/capabilitiesProjection.ts",
  resources: "packages/desktop/src/renderer/pages/settings/sections/ResourcesSettings.tsx",
  environment:
    "packages/desktop/src/renderer/pages/settings/RuntimeSettings/runtimeSettingsViewModel.ts",
  storage: "packages/desktop/src/renderer/pages/settings/storageProjection.ts",
  appearance: "packages/desktop/src/renderer/pages/settings/sections/AppearanceSettings.tsx",
  about: "packages/desktop/src/renderer/components/settings/SettingsModal/contents/AboutModalContent.tsx",
};

const expectedVisualQaRoutes = [
  "/settings/general",
  "/settings/gateway",
  "/settings/access",
  "/settings/workspace",
  "/settings/agents",
  "/settings/capabilities",
  "/settings/resources",
  "/settings/environment",
  "/settings/storage",
  "/settings/appearance",
];
const expectedVisualQaSecondaryRoutes = ["/settings/about"];
const expectedVisualQaCompatibilityRedirects = [
  "update->environment#updates",
  "theme->appearance#themes",
  "local-services->environment#services",
  "personalization->workspace#personalization",
];
const expectedVisualQaStatusAnchors = [
  "single_global_search",
  "diagnostics_collapsed_by_default",
  "single_primary_action_max",
  "exception_only_emphasis",
  "bounded_card_hierarchy_baseline_comparison",
  "legacy_or_compatibility_redirect_landing",
];
const expectedVisualQaManifestFields = [
  "command",
  "commit",
  "viewport",
  "route",
  "screenshot_path",
  "status_anchors",
  "baseline_ref",
  "hierarchy_comparison_result",
];

const matrixRouteScopes = {
  settings_general: appOwnedSettingsRouteScopes.settings_general,
  gateway: appOwnedSettingsRouteScopes.gateway,
  access: appOwnedSettingsRouteScopes.access,
  agents: appOwnedSettingsRouteScopes.agents,
  capabilities: appOwnedSettingsRouteScopes.capabilities,
  settings_resources: appOwnedSettingsRouteScopes.resources,
  environment: appOwnedSettingsRouteScopes.environment,
  settings_local_services: appOwnedSettingsRouteScopes.local_services,
  storage: appOwnedSettingsRouteScopes.storage,
  about: appOwnedSettingsRouteScopes.about,
  update: appOwnedSettingsRouteScopes.update,
  settings_theme: appOwnedSettingsRouteScopes.settings_theme,
  settings_personalization:
    appOwnedSettingsRouteScopes.settings_personalization,
  settings_workspace: appOwnedSettingsRouteScopes.workspace,
};

const expectedIaGroupByMatrixPageId = {
  settings_general: "overview",
  gateway: "account_models",
  access: "account_models",
  agents: "agents_capabilities",
  capabilities: "agents_capabilities",
  settings_resources: "connections_deployment",
  environment: "runtime_maintenance",
  settings_local_services: "runtime_maintenance",
  storage: "workspace",
  about: "auxiliary",
  update: "runtime_maintenance",
  settings_theme: "preferences",
  settings_personalization: "agents_capabilities",
  settings_workspace: "workspace",
};

const expectedDestinationByMatrixPageId = {
  settings_general: "overview_status",
  gateway: "account_access",
  access: "models",
  agents: "agents",
  capabilities: "capabilities",
  settings_resources: "resources_connections",
  environment: "runtime_services",
  settings_local_services: "runtime_services",
  storage: "data_storage",
  about: "about",
  update: "updates_repairs",
  settings_theme: "preferences",
  settings_personalization: "instructions_context",
  settings_workspace: "working_directory",
};

export function validateSettingsControlPlane(
  controlPlane,
  guiContract,
  pageStateMatrix,
  productProfile,
  adapterContract,
) {
  validateSettingsAppUpdateAuthority({
    controlPlane,
    guiContract,
    pageStateMatrix,
    productProfile,
  });
  if (controlPlane?.purpose !== "app_owned_settings_control_plane") {
    throw new Error(
      "Settings control plane purpose must be app_owned_settings_control_plane",
    );
  }
  if (
    controlPlane.owner !== "one-person-lab-app" ||
    controlPlane.state !== "active"
  ) {
    throw new Error("Settings control plane must be active and App-owned");
  }
  if (
    controlPlane.source_contract_ref !==
    "contracts/app-gui-product-contract.json#settings_navigation"
  ) {
    throw new Error(
      "Settings control plane must point at the App GUI settings navigation source contract",
    );
  }
  if (
    controlPlane.product_profile_projection_target !== "settings.control_plane"
  ) {
    throw new Error(
      "Settings control plane must project to settings.control_plane",
    );
  }
  if (
    productProfile?.settings?.control_plane?.machine_boundary !==
    controlPlane.machine_boundary
  ) {
    throw new Error(
      "Product profile Settings control plane machine boundary must match the source contract",
    );
  }
  const configurationProjection =
    controlPlane.configuration_catalog_projection;
  if (
    configurationProjection?.schema !==
      "opl_app_settings_configuration_catalog_projection.v1" ||
    configurationProjection.framework_source_ref !==
      "app_state.settings_control_center.configuration_catalog.items + app_state.settings_control_center.configuration_catalog.host_owned_configuration_surfaces" ||
    configurationProjection.connection_source_ref !==
      "app_state.settings_control_center.connection_registry"
  ) {
    throw new Error(
      "Settings configuration catalog projection must consume the Framework and connection owner read models",
    );
  }
  assertDeepEqualJson(
    productProfile?.settings?.control_plane
      ?.configuration_catalog_projection,
    configurationProjection,
    "Product profile Settings configuration catalog projection",
  );
  const configurationItems = configurationProjection.items ?? [];
  const requiredConfigurationFields =
    configurationProjection.required_fields ?? [];
  const allowedOwnerClasses = new Set(
    configurationProjection.owner_classes ?? [],
  );
  if (
    configurationItems.length === 0 ||
    new Set(configurationItems.map((item) => item.stable_id)).size !==
      configurationItems.length ||
    new Set(configurationItems.map((item) => item.configuration_id)).size !==
      configurationItems.length
  ) {
    throw new Error(
      "Settings configuration catalog projection requires unique stable and configuration ids",
    );
  }
  const pageContracts =
    controlPlane.experience_contract?.page_contracts ?? {};
  const forbiddenCredentialKeys = new Set([
    "api_key",
    "token",
    "secret",
    "password",
    "current_value",
  ]);
  for (const item of configurationItems) {
    if (
      !requiredConfigurationFields.every((field) =>
        Object.prototype.hasOwnProperty.call(item, field),
      )
    ) {
      throw new Error(
        `Settings configuration item ${item.stable_id ?? "unknown"} is missing required fields`,
      );
    }
    if (!allowedOwnerClasses.has(item.owner_class)) {
      throw new Error(
        `Settings configuration item ${item.stable_id} has an unknown owner class`,
      );
    }
    const owningPage = pageContracts[item.page_id];
    if (!owningPage?.required_anchors?.includes(item.anchor)) {
      throw new Error(
        `Settings configuration item ${item.stable_id} must reference an existing page anchor`,
      );
    }
    if (
      item.owner_class === "framework" &&
      (!String(item.current_value_source_ref).startsWith("app_state.") ||
        Object.prototype.hasOwnProperty.call(item, "action_id") ||
        Object.prototype.hasOwnProperty.call(item, "current_value"))
    ) {
      throw new Error(
        `Framework configuration item ${item.stable_id} must delegate current values and action metadata`,
      );
    }
    if (
      item.owner_class === "app_local" &&
      (!item.persistence_target_ref || !item.write_route)
    ) {
      throw new Error(
        `App-local configuration item ${item.stable_id} requires an existing persistence and write route`,
      );
    }
    if (item.owner_class === "credential_connection") {
      if (![
        "secret_ref_only",
        "redacted_status",
      ].includes(item.sensitivity)) {
        throw new Error(
          `Credential configuration item ${item.stable_id} must be secret-ref-only or redacted status`,
        );
      }
      if (Object.keys(item).some((key) => forbiddenCredentialKeys.has(key))) {
        throw new Error(
          `Credential configuration item ${item.stable_id} must not contain secret or current-value fields`,
        );
      }
    }
  }
  const workspaceRootConfiguration = configurationItems.find(
    (item) => item.configuration_id === "workspace_root",
  );
  assertDeepEqualJson(
    workspaceRootConfiguration?.carrier_policy,
    {
      desktop: "editable_through_owner_projected_action",
      webui:
        "read_only_owner_projected_logical_root_no_workspace_root_set_execution",
      docker_webui:
        "read_only_/projects_from_OPL_WORKSPACE_ROOT_no_workspace_root_set_execution",
      host_mount_mutation_allowed: false,
    },
    "Settings workspace root carrier policy",
  );
  const logDirectoryConfiguration = configurationItems.find(
    (item) => item.configuration_id === "log_directory",
  );
  if (
    logDirectoryConfiguration?.page_id !== "maintenance" ||
    logDirectoryConfiguration?.anchor !== "diagnostics"
  ) {
    throw new Error(
      "Settings log directory configuration must be owned by Logs & Diagnostics",
    );
  }
  assertDeepEqualJson(
    logDirectoryConfiguration?.carrier_policy,
    {
      desktop: "editable_through_application.setLogDirectory",
      webui:
        "read_only_application.systemInfo.logDir_no_log_directory_mutation",
      docker_webui: "read_only_/data/logs_no_log_directory_mutation",
      host_mount_mutation_allowed: false,
    },
    "Settings log directory carrier policy",
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.model_reasoning_policy_source,
    controlPlane.model_reasoning_policy_source,
    "Product profile Settings model/reasoning policy projection",
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.product_system_checklist,
    controlPlane.product_system_checklist,
    "Product profile Settings checklist projection",
  );
  assertDeepEqualJson(
    controlPlane.ordinary_visible_tabs,
    appOwnedSettingsTabs,
    "Settings control plane ordinary tabs",
  );
  assertDeepEqualJson(
    controlPlane.ordinary_routes?.map((route) => route.id),
    appOwnedSettingsTabs,
    "Settings control plane ordinary route ids",
  );
  assertDeepEqualJson(
    controlPlane.ordinary_routes?.map((route) => route.product_page_id),
    appOwnedSettingsTopLevelEntryIds,
    "Settings control plane ordinary product page ids",
  );
  assertDeepEqualJson(
    Object.fromEntries(
      (controlPlane.ordinary_routes ?? []).map((route) => [
        route.product_page_id,
        { label_zh: route.default_label_zh, label_en: route.default_label_en },
      ]),
    ),
    appOwnedSettingsTopLevelLabels,
    "Settings control plane top-level product labels",
  );
  assertDeepEqualJson(
    controlPlane.secondary_pages?.map((page) => page.id),
    appOwnedSecondarySettingsPages,
    "Settings control plane secondary page ids",
  );
  assertDeepEqualJson(
    [...new Set(controlPlane.ordinary_routes?.map((route) => route.ia_group))].sort(),
    [...appOwnedSettingsIaGroupIds].sort(),
    "Settings control plane IA groups",
  );
  assertDeepEqualJson(
    controlPlane.ordinary_routes?.map((route) => route.slot_id),
    [
      "settings_general",
      "settings_gateway",
      "settings_access",
      "workspace",
      "settings_agents",
      "settings_capabilities",
      "settings_resources",
      "settings_environment",
      "settings_storage",
      "settings_theme",
    ],
    "Settings control plane ordinary slot ids",
  );
  assertDeepEqualJson(
    controlPlane.legacy_route_redirects,
    expectedLegacyRedirects,
    "Settings control plane legacy redirects",
  );
  assertDeepEqualJson(
    controlPlane.extension_anchor_remap,
    expectedAnchorRemap,
    "Settings control plane extension anchor remap",
  );
  assertDeepEqualJson(
    controlPlane.compatibility_redirects,
    appOwnedSettingsCompatibilityRedirects,
    "Settings control plane compatibility redirects",
  );
  if (
    controlPlane.legacy_route_redirects?.about ||
    controlPlane.extension_anchor_remap?.about
  ) {
    throw new Error(
      "Settings About must remain an independent /settings/about page",
    );
  }
  assertDeepEqualJson(
    Object.keys(controlPlane.slot_registry ?? {}),
    expectedSlotKeys,
    "Settings control plane slot registry keys",
  );
  assertEveryRouteHasSlot(controlPlane);
  validateCustomAssistantDataBoundary(controlPlane);
  validateHydratedSettingsRegistry(controlPlane);
  validateSettingsShellAdapterSlotContract(controlPlane);
  validateSettingsModelReasoningPolicy(
    controlPlane,
    guiContract,
    productProfile,
  );
  validateSettingsProjection(controlPlane.settings_projection);
  validateSettingsExperienceContract(controlPlane.experience_contract);
  validateSettingsPageAdapterPolicy(controlPlane, productProfile);
  validateSettingsVisualQaPolicy(controlPlane);
  validateSettingsProductSystemChecklist(controlPlane);
  validateSettingsUpstreamIntake(controlPlane);
  if (controlPlane.default_route !== "/settings/general") {
    throw new Error(
      "Settings control plane default route must be /settings/general",
    );
  }
  const agentsRoute = (controlPlane.ordinary_routes ?? []).find(
    (route) => route.id === "agents",
  );
  if (agentsRoute?.state_source !== expectedAgentsStateSource) {
    throw new Error(
      "Settings Agents route must read from canonical agent_packages plus Home shortcut projections",
    );
  }
  const capabilityOwnership = controlPlane.agents_capabilities_ownership?.capabilities;
  const externalUpdates = controlPlane.external_tool_update_policy;
  if (
    guiContract?.interaction_baseline?.capability_selection
      ?.management_surface !== "settings_agents"
  ) {
    throw new Error(
      "Settings Agents must own Agent package and Home shortcut management",
    );
  }
  assertDeepEqualJson(
    capabilityOwnership?.entity_kinds,
    ["skill", "plugin", "mcp_server", "image_generation", "voice_input"],
    "Settings capability entity kinds",
  );
  if (
    capabilityOwnership?.groups?.opl_flow_managed?.source !== "opl_base_typed_flow_dependency_catalog" ||
    capabilityOwnership?.groups?.opl_flow_managed?.source_ref !==
      "opl update status --json#managed_update.components[component_id=opl_base].current.dependency_catalog.flow_dependencies" ||
    capabilityOwnership?.groups?.opl_flow_managed?.membership_policy !==
      "derive_from_typed_opl_base_flow_dependencies_never_from_app_hardcoded_skill_list" ||
    capabilityOwnership?.groups?.opl_flow_managed?.lifecycle_owner !== "opl_packages" ||
    capabilityOwnership?.groups?.opl_flow_managed?.cli_currentness_owner !== "opl_base" ||
    capabilityOwnership?.groups?.manual_and_third_party?.source !==
      "codex_and_shell_skill_plugin_registries_plus_aionui_mcp_image_voice_configuration" ||
    capabilityOwnership?.groups?.manual_and_third_party?.label_zh !== "手工添加" ||
    capabilityOwnership?.groups?.manual_and_third_party?.label_en !== "Manually added" ||
    capabilityOwnership?.groups?.manual_and_third_party?.membership_policy !==
      "show_user_managed_and_third_party_skills_plugins_MCP_image_and_voice_controls_without_reclassifying_them_as_opl_flow_managed; manual skill counts and empty states describe only the shell import directory" ||
    capabilityOwnership?.groups?.manual_and_third_party?.aionui_native_policy !==
      "keep_AionUI_native_skills_tools_assistants_MCP_helpers_image_controls_and_voice_input_controls_in_local_or_third_party_ownership_never_OPL_Flow_managed" ||
    capabilityOwnership?.groups?.manual_and_third_party?.mutation_policy !== "explicit_user_action_only"
  ) {
    throw new Error("Settings Capabilities must separate OPL Flow dependency closure from manual and third-party Skills/Plugins");
  }
  assertDeepEqualJson(
    externalUpdates?.modes,
    ["silent_managed", "explicit_owner_delegated", "detect_only_guidance"],
    "Settings external tool update modes",
  );
  if (
    externalUpdates?.silent_managed?.allowed_for !== "opl_managed_install_roots_only" ||
    externalUpdates?.explicit_owner_delegated?.user_confirmation_required !== true ||
    externalUpdates?.detect_only_guidance?.mutation_allowed !== false
  ) {
    throw new Error("Settings external updates must keep silent managed, explicit owner-delegated, and guidance-only boundaries");
  }
  if (
    controlPlane.extension_tab_policy?.legacy_anchor_remap_required !== true ||
    controlPlane.extension_tab_policy?.default_visibility !==
      "hidden_until_app_classified" ||
    !Array.isArray(controlPlane.extension_tab_policy?.mount_allowlist) ||
    Object.prototype.hasOwnProperty.call(
      controlPlane.extension_tab_policy ?? {},
      "unknown_anchor",
    ) ||
    Object.prototype.hasOwnProperty.call(
      controlPlane.extension_tab_policy ?? {},
      "anchored_tabs",
    ) ||
    Object.prototype.hasOwnProperty.call(
      controlPlane.extension_tab_policy ?? {},
      "unanchored_tabs",
    ) ||
    controlPlane.extension_tab_policy?.unclassified_or_unknown_anchor !==
      "hide_and_report_in_intake_diagnostics" ||
    controlPlane.extension_tab_policy?.extension_data_deletion_policy !==
      "never_delete_extension_data_when_hiding_or_redirecting_an_entry"
  ) {
    throw new Error(
      "Settings control plane must hide unclassified extension entries, preserve their data, and require legacy anchor remapping",
    );
  }
  if (controlPlane.state_action_policy?.action_route !== appActionRoute) {
    throw new Error(
      "Settings control plane must route mutations through opl app action execute",
    );
  }
  if (
    controlPlane.state_action_policy?.request_exclusivity_policy !==
      "single_inflight_read_or_action_per_settings_surface" ||
    controlPlane.state_action_policy?.result_binding_policy !==
      "visible_progress_and_result_remain_bound_to_the_triggering_operation"
  ) {
    throw new Error(
      "Settings control plane must keep reads and actions single-flight with operation-bound results",
    );
  }
  assertDeepEqualJson(
    controlPlane.state_action_policy?.startup_performance_policy,
    expectedStartupPerformancePolicy,
    "Settings startup performance policy",
  );
  assertDeepEqualJson(
    guiContract?.settings_navigation?.settings_ia?.protocols
      ?.startup_performance,
    expectedStartupPerformancePolicy,
    "Settings GUI startup performance protocol",
  );
  assertDeepEqualJson(
    pageStateMatrix?.settings_startup_performance_policy,
    expectedStartupPerformancePolicy,
    "Settings page-state startup performance policy",
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.state_action_policy
      ?.startup_performance_policy,
    expectedStartupPerformancePolicy,
    "Settings product-profile startup performance projection",
  );
  if (
    controlPlane.state_action_policy?.configuration_action_policy !==
      "framework_owned_persistent_controls_consume_configuration_catalog_action_ids_and_verify_refs_without_shell_hardcoding" ||
    controlPlane.state_action_policy?.one_time_action_policy !==
      "maintenance_resource_storage_and_capability_commands_consume_action_catalog_entries_without_becoming_configuration" ||
    controlPlane.state_action_policy?.diagnostic_policy !==
      "diagnostic_surfaces_are_read_only_and_must_not_mount_apply_repair_rollback_install_uninstall_or_persistent_setting_controls" ||
    controlPlane.state_action_policy?.unknown_status_policy !==
      "unknown_is_reserved_for_malformed_or_unsupported_projection_and_is_never_used_for_loading_or_not_checked"
  ) {
    throw new Error(
      "Settings control plane must separate persistent configuration, one-time actions, read-only diagnostics, and status vocabulary",
    );
  }
  assertDeepEqualJson(
    controlPlane.state_action_policy?.status_vocabulary,
    [
      "checking",
      "not_checked",
      "not_applicable",
      "ready",
      "needs_attention",
      "failed",
    ],
    "Settings state vocabulary",
  );
  assertDeepEqualJson(
    controlPlane.state_action_policy?.recommended_action_ids,
    { doctor: "doctor", repair: "repair" },
    "Settings control plane recommended action ids",
  );
  assertIncludesAll(
    controlPlane.state_action_policy?.shell_must_not_own,
    [
      "runtime truth",
      "provider implementation",
      "domain truth",
      "owner receipts",
      "release readiness",
    ],
    "Settings control plane shell_must_not_own",
  );
  validateCrossContractConsistency(
    controlPlane,
    guiContract,
    pageStateMatrix,
    productProfile,
  );
  validateSettingsOptionalResourceProjection(
    controlPlane,
    guiContract,
    pageStateMatrix,
    productProfile,
  );
  validateSettingsIa(guiContract?.settings_navigation?.settings_ia);
  validateSettingsUserNavigationProjection(
    controlPlane.user_navigation_projection,
    guiContract?.settings_navigation?.settings_ia,
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.user_navigation_projection,
    controlPlane.user_navigation_projection,
    "Product profile Settings user navigation projection",
  );
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
  validateSettingsAppUpdateAuthority({
    guiContract,
    pageStateMatrix,
    productProfile,
  });
  if (guiContract) {
    validateSettingsIa(guiContract?.settings_navigation?.settings_ia);
  }
  if (pageStateMatrix) {
    validateSettingsPageStateMatrix(pageStateMatrix);
  }
  if (productProfile) {
    assertDeepEqualJson(
      productProfile.settings?.visible_tabs,
      appOwnedSettingsTabs,
      "Product profile settings visible tabs",
    );
  }
  if (adapterContract) {
    validateSettingsShellAdapterSlot(adapterContract);
  }
}

function validateSettingsAppUpdateAuthority({
  controlPlane,
  guiContract,
  pageStateMatrix,
  productProfile,
}) {
  const assertPolicyRef = (actual, label) => {
    if (actual !== appOwnedSettingsAppUpdateStatePolicyRef) {
      throw new Error(
        `${label} must reference the shared App update state policy`,
      );
    }
  };
  const assertRepairPolicyRef = (actual, label) => {
    if (actual !== appOwnedSettingsManagedUpdateRepairPolicyRef) {
      throw new Error(
        `${label} must reference the current managed-update repair policy`,
      );
    }
  };
  const validateFooter = (footer, label) => {
    if (
      footer?.availability_source !==
        "single_main_process_updater_state_store" ||
      footer?.webui_fallback_source !==
        "opl app state --profile fast --json#managed_update.components[component_id=opl_app]" ||
      footer?.app_update_state_policy_ref !==
        appOwnedSettingsAppUpdateStatePolicyRef
    ) {
      throw new Error(
        `${label} must use the shared desktop updater store with the WebUI managed fallback`,
      );
    }
  };

  if (guiContract) {
    assertDeepEqualJson(
      guiContract.framework_surfaces?.managed_update_plane
        ?.app_update_state_policy,
      appOwnedSettingsAppUpdateStatePolicy,
      "App GUI shared App update state policy",
    );
    assertDeepEqualJson(
      guiContract.framework_surfaces?.managed_update_plane
        ?.repair_availability_policy,
      appOwnedSettingsManagedUpdateRepairPolicy,
      "App GUI managed-update repair availability policy",
    );
    assertDeepEqualJson(
      guiContract.pages?.about?.updater_state_policy,
      appOwnedSettingsAboutUpdaterStatePolicy,
      "App GUI About updater state policy",
    );
    assertPolicyRef(
      guiContract.pages?.settings_environment?.app_update_state_policy_ref,
      "App GUI Maintenance",
    );
    assertRepairPolicyRef(
      guiContract.pages?.settings_environment
        ?.managed_update_repair_availability_policy_ref,
      "App GUI Maintenance",
    );
    validateFooter(
      guiContract.settings_navigation?.footer_update_entry,
      "App GUI Settings footer",
    );
  }

  if (pageStateMatrix) {
    assertDeepEqualJson(
      pageById(pageStateMatrix, "about").updater_state_policy,
      appOwnedSettingsAboutUpdaterStatePolicy,
      "Page-state About updater state policy",
    );
    assertPolicyRef(
      pageById(pageStateMatrix, "environment").app_update_state_policy_ref,
      "Page-state Maintenance",
    );
    assertRepairPolicyRef(
      pageById(pageStateMatrix, "environment")
        .managed_update_repair_availability_policy_ref,
      "Page-state Maintenance",
    );
    validateFooter(
      pageStateMatrix.settings_shell_navigation?.footer_update_entry,
      "Page-state Settings footer",
    );
  }

  if (controlPlane) {
    assertDeepEqualJson(
      controlPlane.app_update_state_policy,
      appOwnedSettingsAppUpdateStatePolicy,
      "Settings control-plane App update state policy",
    );
    assertDeepEqualJson(
      controlPlane.managed_update_repair_availability_policy,
      appOwnedSettingsManagedUpdateRepairPolicy,
      "Settings control-plane managed-update repair availability policy",
    );
    assertPolicyRef(
      controlPlane.page_adapter_policy?.required_pages?.about
        ?.app_update_state_policy_ref,
      "Settings About adapter",
    );
    assertPolicyRef(
      controlPlane.page_adapter_policy?.required_pages?.environment
        ?.app_update_state_policy_ref,
      "Settings Maintenance adapter",
    );
    assertRepairPolicyRef(
      controlPlane.page_adapter_policy?.required_pages?.environment
        ?.managed_update_repair_availability_policy_ref,
      "Settings Maintenance adapter",
    );
    assertPolicyRef(
      controlPlane.experience_contract?.page_contracts?.about
        ?.app_update_state_policy_ref,
      "Settings About experience",
    );
    assertPolicyRef(
      controlPlane.experience_contract?.page_contracts?.maintenance
        ?.app_update_state_policy_ref,
      "Settings Maintenance experience",
    );
    assertRepairPolicyRef(
      controlPlane.experience_contract?.page_contracts?.maintenance
        ?.managed_update_repair_availability_policy_ref,
      "Settings Maintenance experience",
    );
  }

  const profileControlPlane = productProfile?.settings?.control_plane;
  if (profileControlPlane) {
    assertDeepEqualJson(
      profileControlPlane.app_update_state_policy,
      appOwnedSettingsAppUpdateStatePolicy,
      "Product profile App update state policy projection",
    );
    assertDeepEqualJson(
      profileControlPlane.managed_update_repair_availability_policy,
      appOwnedSettingsManagedUpdateRepairPolicy,
      "Product profile managed-update repair availability policy projection",
    );
    assertPolicyRef(
      profileControlPlane.page_adapter_policy?.required_pages?.about
        ?.app_update_state_policy_ref,
      "Product profile About adapter",
    );
    assertPolicyRef(
      profileControlPlane.page_adapter_policy?.required_pages?.environment
        ?.app_update_state_policy_ref,
      "Product profile Maintenance adapter",
    );
    assertRepairPolicyRef(
      profileControlPlane.page_adapter_policy?.required_pages?.environment
        ?.managed_update_repair_availability_policy_ref,
      "Product profile Maintenance adapter",
    );
    assertPolicyRef(
      profileControlPlane.experience_contract?.page_contracts?.about
        ?.app_update_state_policy_ref,
      "Product profile About experience",
    );
    assertPolicyRef(
      profileControlPlane.experience_contract?.page_contracts?.maintenance
        ?.app_update_state_policy_ref,
      "Product profile Maintenance experience",
    );
    assertRepairPolicyRef(
      profileControlPlane.experience_contract?.page_contracts?.maintenance
        ?.managed_update_repair_availability_policy_ref,
      "Product profile Maintenance experience",
    );
  }
}

function buildHydratedSettingsRegistry(controlPlane) {
  return {
    ordinary_routes: (controlPlane.ordinary_routes ?? []).map((route) => {
      const slot = controlPlane.slot_registry?.[route.slot_id];
      return {
        id: route.id,
        path: route.path,
        route_scope: "ordinary",
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
  const ordinaryRoute = registry.ordinary_routes.find(
    (route) => route.id === routeId,
  );
  if (ordinaryRoute) {
    return settingsRouteResolution(
      routeId,
      ordinaryRoute.id,
      ordinaryRoute,
      "ordinary",
    );
  }
  const secondaryRoute = registry.secondary_pages.find(
    (route) => route.id === routeId,
  );
  if (secondaryRoute) {
    return settingsRouteResolution(
      routeId,
      secondaryRoute.id,
      secondaryRoute,
      "secondary_or_deep_link",
    );
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
      "compatibility_redirect",
      compatibilityRedirect.anchor,
      compatibilityRedirect.anchor_query_param,
    );
  }
  const redirectTarget = registry.legacy_route_redirects[routeId];
  if (redirectTarget) {
    const [targetWithQuery, anchor] = String(redirectTarget).split("#");
    const [targetId, query] = targetWithQuery.split("?");
    const targetRoute =
      registry.ordinary_routes.find((route) => route.id === targetId) ??
      registry.secondary_pages.find((route) => route.id === targetId);
    if (!targetRoute) {
      throw new Error(
        `Settings legacy route ${routeId} redirects to unknown Settings route ${targetId}`,
      );
    }
    return settingsRouteResolution(
      routeId,
      targetRoute.id,
      {
        ...targetRoute,
        path: buildSettingsRoutePath(targetRoute.path, query, anchor),
      },
      "legacy_redirect",
      anchor ?? null,
      anchor ? "section" : null,
    );
  }
  return settingsRouteResolution(
    routeId,
    "general",
    registry.ordinary_routes.find((route) => route.id === "general"),
    "unknown_redirect",
  );
}

function buildSettingsRoutePath(path, query, anchor) {
  const parameters = [
    query,
    anchor ? `section=${encodeURIComponent(anchor)}` : null,
  ].filter(Boolean);
  return parameters.length > 0 ? `${path}?${parameters.join("&")}` : path;
}

function remapSettingsExtensionAnchor(controlPlane, anchorId) {
  const remapped = controlPlane.extension_anchor_remap?.[anchorId];
  if (remapped) {
    return remapped;
  }
  throw new Error(`Settings extension anchor ${anchorId} is unknown`);
}

function validateCrossContractConsistency(
  controlPlane,
  guiContract,
  pageStateMatrix,
  productProfile,
) {
  const settingsNavigation = guiContract?.settings_navigation;
  assertDeepEqualJson(
    settingsNavigation?.ordinary_visible_tabs,
    controlPlane.ordinary_visible_tabs,
    "Settings control plane ordinary tabs vs GUI contract",
  );
  assertDeepEqualJson(
    settingsNavigation?.settings_ia?.ordinary_route_ids,
    controlPlane.ordinary_routes.map((route) => route.id),
    "Settings control plane route ids vs GUI contract settings IA",
  );
  assertDeepEqualJson(
    settingsNavigation?.settings_ia?.secondary_or_deep_link_route_ids,
    controlPlane.secondary_pages.map((page) => page.id),
    "Settings control plane secondary pages vs GUI contract settings IA",
  );
  assertDeepEqualJson(
    settingsNavigation?.compatibility_redirects,
    controlPlane.compatibility_redirects,
    "Settings control plane compatibility redirects vs GUI contract",
  );
  assertDeepEqualJson(
    guiContract?.pages?.settings_resources?.browser_access_entry,
    controlPlane.experience_contract?.page_contracts?.resources
      ?.browser_access_entry,
    "Settings Resources browser entry vs GUI contract",
  );
  assertDeepEqualJson(
    guiContract?.pages?.settings_agents?.codex_plugin_directory_target
      ?.tab_contract,
    controlPlane.experience_contract?.page_contracts?.agents
      ?.tab_contract,
    "Settings Agents compatibility tab contract vs GUI contract",
  );
  assertDeepEqualJson(
    guiContract?.pages?.settings_resources?.action_behavior,
    controlPlane.experience_contract?.page_contracts?.resources
      ?.action_behavior,
    "Settings Resources action behavior vs GUI contract",
  );
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(controlPlane.legacy_route_redirects)
        .filter(([id]) => id !== "about")
        .map(([id, target]) => [
          id,
          id === "assistants" ? target : String(target).split("?")[0],
        ]),
    ),
    settingsNavigation?.legacy_route_redirects,
    "Settings control plane legacy redirects vs GUI contract",
  );
  const pageIds = new Set(
    (pageStateMatrix?.pages ?? []).map((page) => page.id),
  );
  for (const route of controlPlane.ordinary_routes) {
    if (
      !pageIds.has(route.id) &&
      !pageIds.has(route.slot_id) &&
      !pageIds.has(`settings_${route.id}`)
    ) {
      throw new Error(
        `Settings control plane route ${route.id} must have a page-state matrix entry`,
      );
    }
  }
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.ordinary_visible_tabs,
    controlPlane.ordinary_visible_tabs,
    "Product profile settings.control_plane ordinary tabs",
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.ordinary_routes?.map(
      (route) => route.id,
    ),
    controlPlane.ordinary_routes.map((route) => route.id),
    "Product profile settings.control_plane ordinary route ids",
  );
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(
        productProfile?.settings?.control_plane?.legacy_route_redirects ?? {},
      ).filter(([id]) => id !== "about" && id !== "assistants"),
    ),
    Object.fromEntries(
      Object.entries(controlPlane.legacy_route_redirects).filter(
        ([id]) => id !== "assistants",
      ),
    ),
    "Product profile settings.control_plane legacy redirects",
  );
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(
        productProfile?.settings?.control_plane?.extension_anchor_remap ?? {},
      ).filter(([id]) => id !== "about"),
    ),
    controlPlane.extension_anchor_remap,
    "Product profile settings.control_plane extension anchors",
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.slot_registry,
    controlPlane.slot_registry,
    "Product profile settings.control_plane slot registry",
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.state_action_policy
      ?.recommended_action_ids,
    controlPlane.state_action_policy?.recommended_action_ids,
    "Product profile settings.control_plane recommended action ids",
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.experience_contract?.visual_system,
    controlPlane.experience_contract?.visual_system,
    "Product profile Settings visual system vs control plane",
  );
}

function assertEveryRouteHasSlot(controlPlane) {
  const slotRegistry = controlPlane.slot_registry ?? {};
  for (const route of [
    ...(controlPlane.ordinary_routes ?? []),
    ...(controlPlane.secondary_pages ?? []),
  ]) {
    if (!slotRegistry[route.slot_id]) {
      throw new Error(
        `Settings control plane slot registry must declare ${route.slot_id}`,
      );
    }
  }
}

function validateCustomAssistantDataBoundary(controlPlane) {
  assertDeepEqualJson(
    controlPlane.aionui_custom_assistant_boundary,
    {
      opl_app_product_surface: false,
      ordinary_navigation_entry_allowed: false,
      entry_may_be_hidden: true,
      legacy_assistants_target: "capabilities#third-party",
      underlying_user_data_owner: "aionui",
      underlying_user_data_deletion_policy:
        "forbidden_without_explicit_app_contract_and_migration_or_deletion_evidence",
      route_or_entry_removal_proves_data_migration: false,
    },
    "Settings AionUI custom-assistant product and data boundary",
  );
}

function validateSettingsUserNavigationProjection(projection, settingsIa) {
  if (
    projection?.schema !== "opl_app_settings_user_navigation.v2" ||
    projection.source_ref !== settingsIaRef ||
    projection.carrier_route_policy !==
      "ten_stable_ordinary_route_ids_paths_slots_and_anchors_remain_addressable_but_are_not_rendered_as_ten_primary_navigation_items"
  ) {
    throw new Error(
      "Settings user navigation projection must separate seven visible groups from ten stable carrier routes",
    );
  }
  assertDeepEqualJson(
    projection.primary_group_order,
    appOwnedSettingsIaGroupIds,
    "Settings user navigation primary group order",
  );
  assertDeepEqualJson(
    (projection.primary_groups ?? []).map((group) => group.id),
    appOwnedSettingsIaGroupIds,
    "Settings user navigation primary group ids",
  );
  assertDeepEqualJson(
    Object.fromEntries(
      (projection.primary_groups ?? []).map((group) => [
        group.id,
        { label_zh: group.label_zh, label_en: group.label_en },
      ]),
    ),
    appOwnedSettingsNavigationGroupLabels,
    "Settings user navigation primary group labels",
  );
  const destinationIds = (projection.destinations ?? []).map(
    (destination) => destination.id,
  );
  assertDeepEqualJson(
    destinationIds,
    appOwnedSettingsNavigationDestinationIds,
    "Settings user navigation destination ids",
  );
  for (const group of projection.primary_groups ?? []) {
    if (
      !Array.isArray(group.destination_ids) ||
      !group.destination_ids.includes(group.default_destination_id)
    ) {
      throw new Error(
        `Settings user navigation group ${group.id} must own its default destination`,
      );
    }
  }
  assertDeepEqualJson(
    (projection.primary_groups ?? []).flatMap((group) => group.destination_ids),
    appOwnedSettingsNavigationDestinationIds,
    "Settings user navigation group destination order",
  );
  for (const destination of projection.destinations ?? []) {
    const expected = appOwnedSettingsNavigationDestinationOwners[destination.id];
    if (
      !expected ||
      destination.owner_group_id !== expected.owner_group_id ||
      destination.route_id !== expected.route_id ||
      (destination.anchor ?? null) !== (expected.anchor ?? null)
    ) {
      throw new Error(
        `Settings user navigation destination ${destination.id} must preserve its user owner and carrier route`,
      );
    }
    assertKnownSettingsRoute(
      destination.route_id,
      `Settings user navigation destination ${destination.id}`,
    );
  }
  assertDeepEqualJson(
    projection.secondary_owner_bindings,
    [
      {
        content_id: "codex_user_instructions",
        user_destination_id: "instructions_context",
        transport_route_id: "workspace",
        anchor: "system-agents",
      },
      {
        content_id: "opl_app_session_context",
        user_destination_id: "instructions_context",
        transport_route_id: "workspace",
        anchor: "opl-app-context",
      },
      {
        content_id: "app_log_directory",
        user_destination_id: "logs_diagnostics",
        transport_route_id: "environment",
        anchor: "diagnostics",
        transport_owner_policy:
          "reuse_the_existing_typed_application.setLogDirectory_action_without_presenting_logs_under_Workspace",
      },
    ],
    "Settings user navigation secondary owner bindings",
  );
  assertDeepEqualJson(
    projection.auxiliary_entries,
    [
      {
        id: "about",
        route_id: "about",
        placement: "sidebar_bottom",
        label_zh: "关于",
        label_en: "About",
      },
    ],
    "Settings user navigation auxiliary entries",
  );
  for (const [field, expected] of Object.entries({
    desktop:
      "seven_primary_groups_with_the_active_group_expanded_to_second_level_destinations",
    mobile:
      "category_list_then_second_level_destination_with_a_visible_back_control",
    mobile_horizontal_tab_strip_allowed: false,
    mobile_navigation_scroll_axis: "vertical",
    keyboard_policy:
      "all_primary_groups_second_level_destinations_back_and_about_are_reachable_in_logical_order",
  })) {
    if (projection.responsive_navigation?.[field] !== expected) {
      throw new Error(
        `Settings user navigation responsive_navigation.${field} must be ${expected}`,
      );
    }
  }
  assertDeepEqualJson(
    projection.responsive_navigation?.minimum_viewport_px,
    { width: 400, height: 600 },
    "Settings user navigation minimum viewport",
  );
  if (
    projection.global_search_policy !==
      "preserve_one_bilingual_item_level_search_across_all_carrier_routes_and_owner_anchors" ||
    projection.footer_policy?.duplicate_settings_entry !==
      "forbidden_inside_settings" ||
    projection.footer_policy?.about_placement !==
      "sidebar_bottom_auxiliary_entry"
  ) {
    throw new Error(
      "Settings user navigation must preserve global search, bottom About, and forbid a duplicate Settings footer entry",
    );
  }
  assertDeepEqualJson(
    projection.primary_group_order,
    settingsIa?.group_ids,
    "Settings user navigation vs GUI group order",
  );
  assertDeepEqualJson(
    (projection.primary_groups ?? []).map((group) => ({
      id: group.id,
      label_zh: group.label_zh,
      label_en: group.label_en,
      default_child_id: group.default_destination_id,
    })),
    (settingsIa?.top_level_entries ?? []).map((entry) => ({
      id: entry.id,
      label_zh: entry.label_zh,
      label_en: entry.label_en,
      default_child_id: entry.default_child_id,
    })),
    "Settings user navigation vs GUI primary groups",
  );
  assertDeepEqualJson(
    (projection.destinations ?? []).map((entry) => ({
      id: entry.id,
      group_id: entry.owner_group_id,
      route_id: entry.route_id,
      anchor: entry.anchor ?? null,
      label_zh: entry.label_zh,
      label_en: entry.label_en,
    })),
    (settingsIa?.child_entries ?? []).map((entry) => ({
      id: entry.id,
      group_id: entry.group_id,
      route_id: entry.route_id,
      anchor: entry.anchor ?? null,
      label_zh: entry.label_zh,
      label_en: entry.label_en,
    })),
    "Settings user navigation vs GUI destinations",
  );
}

function validateSettingsIa(settingsIa) {
  if (settingsIa?.schema !== "settings_ia.v2") {
    throw new Error(
      "Settings control plane must expose settings_ia.v2 behavior",
    );
  }
  if (settingsIa.authority !== "one-person-lab-app") {
    throw new Error(
      "Settings control plane authority must stay in one-person-lab-app",
    );
  }
  if (
    settingsIa.source_ref !==
    "contracts/app-gui-product-contract.json#settings_navigation"
  ) {
    throw new Error(
      "Settings control plane must keep the App GUI settings navigation as its source ref",
    );
  }
  if (settingsIa.matrix_ref !== "contracts/app-page-state-matrix.json#pages") {
    throw new Error(
      "Settings control plane must keep the App page-state matrix as its matrix ref",
    );
  }
  assertDeepEqualJson(
    settingsIa.ordinary_route_ids,
    appOwnedSettingsTabs,
    "Settings control plane ordinary route ids",
  );
  assertDeepEqualJson(
    settingsIa.secondary_or_deep_link_route_ids,
    appOwnedSecondarySettingsPages,
    "Settings control plane secondary/deep-link route ids",
  );
  assertDeepEqualJson(
    settingsIa.compatibility_route_ids,
    Object.keys(appOwnedSettingsCompatibilityRedirects),
    "Settings control plane compatibility route ids",
  );
  if (
    settingsIa.experience_contract_ref !==
    "contracts/app-settings-control-plane.json#experience_contract"
  ) {
    throw new Error(
      "Settings IA must reference the Settings experience contract",
    );
  }
  assertDeepEqualJson(
    settingsIa.group_ids,
    appOwnedSettingsIaGroupIds,
    "Settings control plane IA group ids",
  );
  if (
    settingsIa.route_identity_policy !==
    "keep_current_shell_route_ids_distinct_from_user_facing_ia_groups"
  ) {
    throw new Error(
      "Settings control plane must keep shell route ids distinct from user-facing IA groups",
    );
  }
  if (
    settingsIa.route_promotion_policy !==
    "secondary_or_deep_link_routes_must_not_be_promoted_to_ordinary_routes_without_contract_matrix_validator_and_test_updates"
  ) {
    throw new Error(
      "Settings control plane must gate route promotion through contract, matrix, validator, and tests",
    );
  }
  validateSettingsTopLevelEntries(
    settingsIa.top_level_entries,
    settingsIa.top_level_navigation_policy,
  );
  assertDeepEqualJson(
    (settingsIa.child_entries ?? []).map((entry) => entry.id),
    appOwnedSettingsNavigationDestinationIds,
    "Settings IA second-level destination ids",
  );
  for (const entry of settingsIa.child_entries ?? []) {
    const expected = appOwnedSettingsNavigationDestinationOwners[entry.id];
    if (
      !expected ||
      entry.group_id !== expected.owner_group_id ||
      entry.route_id !== expected.route_id ||
      (entry.anchor ?? null) !== (expected.anchor ?? null)
    ) {
      throw new Error(
        `Settings IA destination ${entry.id} must retain its user owner and carrier route`,
      );
    }
  }
  assertDeepEqualJson(
    settingsIa.auxiliary_entries,
    [
      {
        id: "about",
        route_id: "about",
        route_scope: "secondary_or_deep_link",
        placement: "sidebar_bottom",
        label_zh: "关于",
        label_en: "About",
      },
    ],
    "Settings IA auxiliary entries",
  );
  assertDeepEqualJson(
    (settingsIa.user_task_entries ?? []).map((entry) => entry.id),
    appOwnedSettingsTaskEntryIds,
    "Settings control plane user task entries",
  );
  for (const entry of settingsIa.user_task_entries ?? []) {
    if (!appOwnedSettingsIaGroupIds.includes(entry.group_id)) {
      throw new Error(
        `Settings control plane task entry ${entry.id} has unknown group ${entry.group_id}`,
      );
    }
    assertIncludesAll(
      Object.keys(entry),
      appOwnedSettingsTaskEntryMetadataFields,
      `Settings control plane task entry ${entry.id} metadata fields`,
    );
    for (const field of appOwnedSettingsTaskEntryMetadataFields) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        throw new Error(
          `Settings control plane task entry ${entry.id} must declare ${field}`,
        );
      }
    }
    assertKnownSettingsRoute(
      entry.route_id,
      `Settings control plane task entry ${entry.id}`,
    );
    for (const routeId of entry.secondary_route_ids ?? []) {
      assertKnownSettingsRoute(
        routeId,
        `Settings control plane task entry ${entry.id} secondary route`,
      );
    }
  }
  validateSettingsProtocols(settingsIa.protocols);
}

function validateSettingsTopLevelEntries(entries, policy) {
  if (
    policy?.entry_model !==
      "seven_user_visible_primary_groups_expand_or_drill_into_second_level_destinations" ||
    policy?.workspace_visibility !==
      "workspace_is_user_visible_top_level_navigation_entry" ||
    policy?.resources_visibility !==
      "resources_is_the_sole_destination_under_connections_and_deployment" ||
    policy?.advanced_visibility !==
      "advanced_is_retired_and_redirects_to_maintenance_diagnostics" ||
    policy?.about_visibility !==
      "about_is_a_bottom_auxiliary_entry_outside_the_seven_primary_groups" ||
    policy?.compatibility_route_policy !==
      "update_theme_local_services_and_personalization_redirect_to_owner_route_and_anchor" ||
    policy?.shell_route_compatibility !==
      "carrier_route_ids_remain_stable_while_product_page_ids_are_canonical"
  ) {
    throw new Error(
      "Settings IA must declare seven primary groups, bottom auxiliary About, and compatibility carrier routes",
    );
  }
  assertDeepEqualJson(
    (entries ?? []).map((entry) => entry.id),
    appOwnedSettingsIaGroupIds,
    "Settings IA top-level user-visible entries",
  );
  const workspace = (entries ?? []).find((entry) => entry.id === "workspace");
  if (
    workspace?.route_id !== "workspace" ||
    workspace?.route_scope !== "ordinary" ||
    workspace?.visibility !== "top_level_navigation"
  ) {
    throw new Error(
      "Settings IA Workspace must be ordinary top-level navigation",
    );
  }
  assertDeepEqualJson(
    Object.fromEntries(
      (entries ?? []).map((entry) => [
        entry.id,
        {
          label_zh: entry.label_zh,
          label_en: entry.label_en,
        },
      ]),
    ),
    appOwnedSettingsNavigationGroupLabels,
    "Settings IA top-level product labels",
  );
  for (const entry of entries ?? []) {
    assertKnownSettingsRoute(
      entry.route_id,
      `Settings IA top-level entry ${entry.id}`,
    );
    assertIncludesAll(
      Object.keys(entry),
      appOwnedSettingsTaskEntryMetadataFields,
      `Settings IA top-level entry ${entry.id} metadata fields`,
    );
  }
}

function validateSettingsProtocols(protocols) {
  assertDeepEqualJson(
    protocols?.issue_queue?.statuses,
    appOwnedSettingsIssueStatuses,
    "Settings control plane issue statuses",
  );
  if (
    protocols?.issue_queue?.owner_policy !==
    "App renders issue refs and action routes without writing runtime/domain truth"
  ) {
    throw new Error(
      "Settings control plane issue queue must be render-only for runtime/domain truth",
    );
  }
  if (
    protocols?.action_catalog?.source !== "app_state.actions" ||
    protocols?.action_catalog?.action_route !== appActionRoute ||
    protocols?.action_catalog?.mutation_policy !==
      "all_mutating_settings_actions_go_through_App_action_routes"
  ) {
    throw new Error(
      "Settings control plane actions must route through app_state.actions and the App action route",
    );
  }
  assertDeepEqualJson(
    protocols.settings_search,
    appOwnedSettingsSearchProtocol,
    "Settings control plane search protocol",
  );
  assertDeepEqualJson(
    protocols.card_protocol?.required_fields,
    appOwnedSettingsCardFields,
    "Settings control plane card fields",
  );
  if (
    protocols.card_protocol?.first_screen_policy !==
    "summary_first_no_raw_ids_or_receipts_until_disclosed"
  ) {
    throw new Error(
      "Settings control plane cards must stay summary-first before raw refs",
    );
  }
  assertDeepEqualJson(
    protocols.confirmation_drawer?.required_fields,
    appOwnedSettingsConfirmationFields,
    "Settings control plane confirmation fields",
  );
  if (
    protocols.confirmation_drawer?.copy_policy !==
    "must_explain_what_changes_what_does_not_change_and_the_recovery_reference_before_mutation"
  ) {
    throw new Error(
      "Settings control plane confirmation must explain change boundaries and recovery references",
    );
  }
  assertDeepEqualJson(
    protocols.post_update_notice?.required_fields,
    appOwnedSettingsPostUpdateNoticeFields,
    "Settings control plane post-update notice fields",
  );
  if (
    protocols.post_update_notice?.visibility_policy !==
      "ordinary_layer_after_mutation_or_background_action_until_next_refresh" ||
    protocols.post_update_notice?.receipt_policy !==
      "show_receipt_ref_without_claiming_domain_or_release_readiness"
  ) {
    throw new Error(
      "Settings control plane post-update notices must not claim domain or release readiness",
    );
  }
  const makeUsableAction = protocols.make_usable_action;
  if (
    makeUsableAction?.placement !==
      "settings_environment.updates_repairs.primary_action" ||
    makeUsableAction?.orchestration_policy !==
      "shell_orchestrates_existing_app_and_managed_update_actions_only" ||
    makeUsableAction?.post_action_notice !==
      "show restart or reload guidance from managed update status/result without claiming domain, release, or production readiness"
  ) {
    throw new Error(
      "Settings control plane make-usable action must orchestrate existing App/updater actions only",
    );
  }
  assertDeepEqualJson(
    makeUsableAction.allowed_steps,
    appOwnedSettingsMakeUsableAllowedSteps,
    "Settings control plane make-usable allowed steps",
  );
  assertDeepEqualJson(
    makeUsableAction.must_not,
    appOwnedSettingsMakeUsableForbiddenSteps,
    "Settings control plane make-usable forbidden steps",
  );
  if (
    protocols.diagnostics?.default_visibility !== "collapsed_advanced_only" ||
    protocols.diagnostics?.raw_ref_policy !==
      "raw_paths_ids_receipts_json_and_component_ids_require_disclosure_or_advanced_route"
  ) {
    throw new Error(
      "Settings control plane diagnostics must be collapsed and advanced/disclosure-only",
    );
  }
  if (
    protocols.deep_link_policy?.unknown_route_policy !==
      "redirect_to_overview_default_route" ||
    protocols.deep_link_policy?.legacy_route_policy !==
      "redirect_using_settings_navigation.legacy_route_redirects" ||
    protocols.deep_link_policy?.secondary_route_policy !==
      "open_about_without_ordinary_tab_promotion_and_redirect_advanced_to_maintenance_diagnostics" ||
    protocols.deep_link_policy?.compatibility_route_policy !==
      "resolve_settings_navigation.compatibility_redirects_then_navigate_route_id_and_anchor"
  ) {
    throw new Error(
      "Settings control plane deep links must separate legacy, secondary, and compatibility routes",
    );
  }
  assertDeepEqualJson(
    protocols.visual_qa_expectations?.required_targets,
    appOwnedSettingsVisualQaTargets,
    "Settings control plane visual QA targets",
  );
  validateSettingsVisualQaExpectations(protocols.visual_qa_expectations);
}

function validateSettingsVisualQaExpectations(expectations) {
  assertDeepEqualJson(
    expectations?.visual_character,
    ["quiet", "dense", "scannable"],
    "Settings visual QA character",
  );
  assertDeepEqualJson(
    expectations?.surface_grouping,
    {
      allowed_bounded_group_kinds: ["repeated_entity", "confirmation"],
      bounded_group_nesting: "none",
      page_section_card_policy:
        "ordinary_page_sections_are_unframed_heading_plus_flat_rows_with_hairline_dividers",
      first_viewport_spatial_group_range: { min: 2, max: 4 },
      page_wide_bare_divider_layout:
        "section_scoped_hairlines_allowed_no_box_per_section",
      page_wide_list_wall: "forbidden",
    },
    "Settings visual QA surface grouping",
  );
  assertDeepEqualJson(
    expectations?.responsive_hierarchy,
    {
      desktop: "single_column_reading_lane",
      mobile: "single_column_stack",
      icon_slot_px: 20,
      page_title: "20/28/600",
      card_title: "14-16/20-24/600",
      description: "13/20/400",
      supporting: "12/18/400",
    },
    "Settings visual QA responsive hierarchy",
  );
  assertDeepEqualJson(
    expectations?.status_color_semantics,
    { normal: "muted", warning: "orange", error: "red", action: "brand" },
    "Settings visual QA status color semantics",
  );
  assertDeepEqualJson(
    expectations?.baseline_comparison,
    {
      shell_commit: "409dd0c3b693f1c7c93551654dfac8fb9420843d",
      comparison_scope: "same_route_spatial_typographic_and_status_hierarchy",
      acceptance: "preserve_or_improve",
    },
    "Settings visual QA baseline comparison",
  );
  assertDeepEqualJson(
    expectations?.footer_structure,
    {
      layout: "compact",
      controls: [
        "gateway_account_or_account_access_entry",
        "app_update_status_and_trigger",
      ],
      account_entry:
        "gateway_display_name_when_connected_else_account_access_entry_without_a_duplicate_settings_entry",
      update_entry:
        "show_confirmed_newer_app_update_as_account_row_trailing_action_and_reuse_existing_carrier_updater_without_owning_update_truth",
      theme_quick_toggle:
        "forbidden_theme_mode_lives_in_settings_preferences",
      help_navigation: "about_is_the_single_sidebar_bottom_auxiliary_entry",
      duplicate_settings_entry: "forbidden_inside_settings",
    },
    "Settings visual QA footer structure",
  );
  assertDeepEqualJson(
    expectations?.theme_gallery,
    {
      presentation: "not_exposed",
      legacy_user_data: "preserved_not_applied",
    },
    "Settings visual QA theme gallery",
  );
  assertDeepEqualJson(
    expectations?.assertion_focus,
    {
      required_structure: [
        "user_question_to_unframed_section_or_allowed_bounded_group",
        "two_to_four_first_viewport_spatial_groups",
        "single_column_reading_lane_to_mobile_stack",
        "monochrome_icon_typography_and_typed_status_hierarchy",
        "409dd0c3_same_route_non_regression",
        "flat_rows_without_section_card_frames",
        "compact_footer",
        "single_governed_visual_baseline",
      ],
      radius_and_spacing_only: "insufficient",
    },
    "Settings visual QA assertion focus",
  );
  assertDeepEqualJson(
    expectations?.sidebar_selection,
    {
      selected_item_count: 1,
      selection_source: "resolved_route_after_compatibility_redirect",
    },
    "Settings visual QA sidebar selection",
  );
  assertDeepEqualJson(
    expectations?.repeated_entity_layout,
    {
      column_header_policy: "one_shared_column_header_row_per_group",
      row_field_label_policy: "do_not_repeat_field_labels_in_each_row",
    },
    "Settings visual QA repeated entity layout",
  );
  assertDeepEqualJson(
    expectations?.primary_action_placement,
    {
      policy: "adjacent_to_owned_object_or_section",
      detached_page_toolbar_action: "forbidden",
    },
    "Settings visual QA primary action placement",
  );
  assertDeepEqualJson(
    expectations?.capture_preflight,
    {
      required_fields: [
        "requested_route",
        "resolved_route",
        "expected_page_title",
        "visible_page_title",
      ],
      route_policy:
        "resolved_route_must_match_requested_route_or_declared_compatibility_target",
      title_policy: "visible_page_title_must_match_expected_page_title",
      mismatch_policy: "fail_capture_and_do_not_record_visual_evidence",
    },
    "Settings visual QA capture preflight",
  );
  assertDeepEqualJson(
    expectations?.evidence_dimensions,
    {
      required_viewports: ["desktop", "mobile"],
      required_color_schemes: ["light"],
      coverage_policy: "desktop_and_mobile_light_require_fresh_visual_evidence",
    },
    "Settings visual QA evidence dimensions",
  );
  assertIncludesAll(
    expectations?.must_check,
    [
      "ordinary navigation shows seven primary groups with ten stable carrier routes reachable as second-level destinations",
      "About is the single sidebar-bottom auxiliary entry outside the seven primary groups",
      "mobile Settings uses a vertical category list then second-level navigation without a horizontal tab strip",
      "page sections use quiet white bounded groups with flat internal rows, nested cards are absent, radius is at most 8px, and spacing uses 12/16/24",
      "each user question is one quiet bounded section with flat internal rows; page-wide list walls and nested cards are absent",
      "each page first viewport contains two to four independent spatial groups",
      "desktop groups use a single reading lane and mobile groups stack without losing hierarchy",
      "20px monochrome visual anchors, compact typography levels, and muted/orange/red/brand status semantics remain visible",
      "same-route screenshots preserve or improve spatial and typographic hierarchy against shell baseline 409dd0c3",
      "Settings remains quiet, dense, and scannable without a sparse page-wide bare-divider layout",
      "bounded page-section cards do not become a decorative card wall",
      "the compact Settings footer keeps Gateway account or Account & Access reachable without a duplicate Settings entry, shows the existing App update trigger as a trailing account-row action only when a newer version is confirmed, and keeps About as the single bottom auxiliary entry",
      "Preferences exposes System, Light, and Dark appearance modes over one governed visual baseline",
      "the CSS theme preset gallery and custom theme editor are not exposed while legacy user theme data is preserved but not applied",
      "visual assertions verify grouping, the conditional account-row update action, and the single-baseline appearance structure; radius and spacing alone are insufficient",
      "the Settings sidebar has exactly one selected item",
      "repeated entities use shared column headers instead of per-row field labels",
      "the primary action stays adjacent to its owning object or section",
      "capture preflight verifies the resolved route and visible page title before recording a screenshot",
      "default desktop light evidence is present before visual acceptance",
    ],
    "Settings visual QA acceptance checks",
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
    "Page-state Settings compatibility redirects",
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
      throw new Error(
        `${pageId} ia_group must be ${expectedIaGroupByMatrixPageId[pageId]}`,
      );
    }
  }
  assertDeepEqualJson(
    pageById(pageStateMatrix, "update").compatibility_redirect,
    compatibilityRedirects.update,
    "Update compatibility redirect page state",
  );
  assertDeepEqualJson(
    pageById(pageStateMatrix, "settings_local_services").compatibility_redirect,
    compatibilityRedirects["local-services"],
    "Local Services compatibility redirect page state",
  );
  assertDeepEqualJson(
    pageById(pageStateMatrix, "settings_personalization").compatibility_redirect,
    compatibilityRedirects.personalization,
    "Personalization compatibility redirect page state",
  );
  if (!experienceContract) return;
  for (const [productPageId, contract] of Object.entries(
    experienceContract.page_contracts ?? {},
  )) {
    const page = pageById(pageStateMatrix, contract.matrix_page_id);
    const expectedTechnicalDetailsDefault =
      appOwnedSettingsTechnicalDetailsDefault[productPageId];
    if (
      page.product_page_id !== productPageId ||
      page.experience_contract_ref !==
        `contracts/app-settings-control-plane.json#experience_contract.page_contracts.${productPageId}` ||
      page.primary_action_id !== contract.primary_action.id ||
      page.technical_details_default !== expectedTechnicalDetailsDefault ||
      page.exception_emphasis !== "attention_only"
    ) {
      throw new Error(
        `Page-state ${contract.matrix_page_id} must mirror ${productPageId} experience semantics`,
      );
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
    if (productPageId === "capabilities") {
      assertDeepEqualJson(
        page.tab_contract,
        contract.tab_contract,
        "Page-state Capabilities source-group tab contract",
      );
    }
    if (productPageId === "resources") {
      assertDeepEqualJson(
        page.action_behavior,
        contract.action_behavior,
        "Page-state Resources action behavior",
      );
    }
    if (productPageId === "storage") {
      assertDeepEqualJson(
        page.storage_carrier_behavior,
        contract.surface_rules.storage_carrier_behavior,
        "Page-state Storage carrier behavior",
      );
    }
  }
  assertDeepEqualJson(
    pageById(pageStateMatrix, "about").updater_state_policy,
    appOwnedSettingsAboutUpdaterStatePolicy,
    "Page-state About updater state policy",
  );
}

function validateProductProfileSettings(productProfile, controlPlane) {
  assertDeepEqualJson(
    productProfile.settings?.visible_tabs,
    appOwnedSettingsTabs,
    "Product profile settings visible tabs",
  );
  assertDeepEqualJson(
    productProfile.settings?.legacy_route_redirects,
    Object.fromEntries(
      Object.entries(controlPlane.legacy_route_redirects)
        .filter(([id]) => id !== "about")
        .map(([id, target]) => [id, String(target).split("?")[0]]),
    ),
    "Product profile settings legacy redirects",
  );
}

function validateHydratedSettingsRegistry(controlPlane) {
  const registry = buildHydratedSettingsRegistry(controlPlane);
  assertDeepEqualJson(
    registry.ordinary_routes.map((route) => route.id),
    appOwnedSettingsTabs,
    "Hydrated Settings registry ordinary route ids",
  );
  assertDeepEqualJson(
    registry.ordinary_routes.map((route) => route.component_key),
    [
      "OverviewSettings",
      "GatewaySettingsContent",
      "AccessSettingsContent",
      "WorkspaceSettings",
      "AgentPackagesSettingsContent",
      "CapabilitiesSettingsContent",
      "ResourcesSettingsContent",
      "RuntimeSettings",
      "StorageSettings",
      "AppearanceModalContent",
    ],
    "Hydrated Settings registry ordinary component keys",
  );
  assertDeepEqualJson(
    registry.secondary_pages.map((route) => route.route_scope),
    appOwnedSecondarySettingsPages.map(() => "secondary_or_deep_link"),
    "Hydrated Settings registry secondary route scopes",
  );
  for (const routeId of [
    ...appOwnedSettingsTabs,
    ...appOwnedSecondarySettingsPages,
  ]) {
    const resolution = resolveSettingsControlPlaneRoute(controlPlane, routeId);
    if (
      !["ordinary", "secondary_or_deep_link"].includes(resolution.route_scope)
    ) {
      throw new Error(
        `Settings route ${routeId} must resolve as ordinary or secondary/deep-link`,
      );
    }
  }
  for (const [routeId, redirect] of Object.entries(
    appOwnedSettingsCompatibilityRedirects,
  )) {
    const resolution = resolveSettingsControlPlaneRoute(controlPlane, routeId);
    if (
      resolution.route_scope !== "compatibility_redirect" ||
      resolution.target_id !== redirect.target_route_id ||
      resolution.anchor !== redirect.anchor ||
      resolution.anchor_query_param !== "section"
    ) {
      throw new Error(
        `Settings compatibility route ${routeId} must resolve to its owner route and anchor`,
      );
    }
  }
  for (const legacyRoute of Object.keys(expectedLegacyRedirects)) {
    const redirectTarget = String(
      controlPlane.legacy_route_redirects[legacyRoute],
    ).split(/[?#]/)[0];
    const knownTargets = new Set([
      ...appOwnedSettingsTabs,
      ...appOwnedSecondarySettingsPages,
    ]);
    if (!knownTargets.has(redirectTarget)) {
      throw new Error(
        `Settings legacy route ${legacyRoute} must target a known Settings route`,
      );
    }
    if (
      !appOwnedSecondarySettingsPages.includes(legacyRoute) &&
      resolveSettingsControlPlaneRoute(controlPlane, legacyRoute)
        .route_scope !== "legacy_redirect"
    ) {
      throw new Error(
        `Settings legacy route ${legacyRoute} must resolve through the legacy redirect table`,
      );
    }
    if (
      !knownTargets.has(remapSettingsExtensionAnchor(controlPlane, legacyRoute))
    ) {
      throw new Error(
        `Settings extension anchor ${legacyRoute} must remap to a known Settings route`,
      );
    }
  }
  const assistantsResolution = resolveSettingsControlPlaneRoute(
    controlPlane,
    "assistants",
  );
  if (
    assistantsResolution.target_id !== "capabilities" ||
    assistantsResolution.path !== "/settings/capabilities?section=third-party" ||
    assistantsResolution.anchor !== "third-party"
  ) {
    throw new Error(
      "Settings legacy assistants route must open the OPL capability directory",
    );
  }
  const unknownResolution = resolveSettingsControlPlaneRoute(
    controlPlane,
    "unknown-settings-route",
  );
  if (
    unknownResolution.route_scope !== "unknown_redirect" ||
    unknownResolution.target_id !== "general" ||
    unknownResolution.path !== "/settings/general"
  ) {
    throw new Error(
      "Unknown Settings routes must fall back to the Overview default route",
    );
  }
}

function validateSettingsShellAdapterSlotContract(controlPlane) {
  const slot = controlPlane.shell_adapter_slot;
  if (slot?.host_component !== "SettingsHost") {
    throw new Error(
      "Settings control plane shell adapter slot must declare SettingsHost",
    );
  }
  if (slot?.adapter_slot !== "SettingsShellAdapterSlot") {
    throw new Error(
      "Settings control plane shell adapter slot must declare SettingsShellAdapterSlot",
    );
  }
  if (slot?.registry_source !== settingsControlPlaneContractRef) {
    throw new Error(
      "SettingsHost must consume the App Settings control plane contract",
    );
  }
  assertDeepEqualJson(
    slot?.shell_may_own,
    [
      "container layout",
      "tab switching",
      "extension tab mount/keep-alive",
      "route sync",
    ],
    "SettingsShellAdapterSlot shell_may_own",
  );
  assertDeepEqualJson(
    slot?.app_owns,
    [
      "tab order",
      "user semantics",
      "OPL page slots",
      "state/action sources",
      "upstream intake classification",
    ],
    "SettingsShellAdapterSlot app_owns",
  );
}

function validateSettingsModelReasoningPolicy(
  controlPlane,
  guiContract,
  productProfile,
) {
  const policy = controlPlane.model_reasoning_policy_source;
  if (policy?.owner !== "one-person-lab-app") {
    throw new Error("Settings model/reasoning policy must be App-owned");
  }
  assertIncludesAll(
    policy?.source_refs,
    [
      "contracts/app-product-profile.json#codex",
      "contracts/app-product-profile.json#codex.auto_model_policy",
      "contracts/app-product-profile.json#gui.home.codex_model_display_options",
      "contracts/app-gui-product-contract.json#executor_policy",
    ],
    "Settings model/reasoning policy source refs",
  );
  if (
    policy.default_model_ref !==
    "contracts/app-product-profile.json#codex.default_model"
  ) {
    throw new Error(
      "Settings default model must be derived from the App product profile",
    );
  }
  if (
    policy.default_reasoning_effort_ref !==
    "contracts/app-product-profile.json#codex.default_reasoning_effort"
  ) {
    throw new Error(
      "Settings default reasoning effort must be derived from the App product profile",
    );
  }
  if (
    policy.auto_model_policy_ref !==
    "contracts/app-product-profile.json#codex.auto_model_policy"
  ) {
    throw new Error(
      "Settings Auto model policy must be derived from the App product profile",
    );
  }
  if (policy.settings_surface !== "settings_access.model_access") {
    throw new Error(
      "Settings model/reasoning policy must surface through the Access model section",
    );
  }
  if (
    policy.adapter_policy !==
    "Aion/Hermes/shell render App-derived model and reasoning policy only"
  ) {
    throw new Error(
      "Settings model/reasoning policy must keep shells as adapters only",
    );
  }
  assertIncludesAll(
    policy.shell_must_not_own,
    [
      "default model",
      "frontier model preference order",
      "Auto model resolution and persistence policy",
      "reasoning effort options",
      "model access readiness truth",
      "provider selector as ordinary UI",
    ],
    "Settings model/reasoning shell_must_not_own",
  );
  if (
    guiContract?.executor_policy?.default_model !==
      productProfile?.codex?.default_model ||
    guiContract?.executor_policy?.default_reasoning_effort !==
      productProfile?.codex?.default_reasoning_effort
  ) {
    throw new Error(
      "Settings model/reasoning policy must match App product profile and GUI executor policy defaults",
    );
  }
  if (
    guiContract?.executor_policy?.model_display_options_policy?.source !==
    "contracts/app-product-profile.json#gui.home.codex_model_display_options"
  ) {
    throw new Error(
      "Settings model/reasoning display options must be derived from the App product profile",
    );
  }
  if (
    !String(policy.release_evidence_policy ?? "").includes(
      "does not prove release cohort",
    )
  ) {
    throw new Error(
      "Settings model/reasoning policy must keep release/live evidence separate",
    );
  }
}

function validateSettingsSurfaceModel(surfaceModel) {
  const surfaceTypes = ["configuration", "status", "action", "diagnostic"];
  assertDeepEqualJson(
    surfaceModel?.surface_types,
    surfaceTypes,
    "Settings surface types",
  );
  if (
    surfaceModel?.classification_policy !==
      "every_page_surface_has_exactly_one_type_and_one_page_owner" ||
    surfaceModel?.advanced_page_type !==
      "retired_redirect_to_maintenance_diagnostics"
  ) {
    throw new Error(
      "Settings surfaces must have exactly one of four types and retired Advanced must redirect to Maintenance diagnostics",
    );
  }
  assertDeepEqualJson(
    Object.keys(surfaceModel ?? {}),
    [
      "surface_types",
      "classification_policy",
      ...surfaceTypes,
      "advanced_page_type",
      "desktop_layout_policy",
      "default_layout_policy",
    ],
    "Settings strict four-surface model keys",
  );
  for (const surfaceType of surfaceTypes) {
    for (const field of [
      "presentation",
      "interaction",
      "visual_rule",
      "ownership_rule",
    ]) {
      if (
        typeof surfaceModel?.[surfaceType]?.[field] !== "string" ||
        surfaceModel[surfaceType][field].trim() === ""
      ) {
        throw new Error(
          `Settings ${surfaceType} surface must declare ${field}`,
        );
      }
    }
  }
  assertDeepEqualJson(
    surfaceModel?.configuration?.card_eligibility_any_of,
    [
      "two_or_more_related_controls",
      "one_consequential_persistent_setting",
      "exception_or_recovery_workflow",
      "independent_user_decision_boundary",
    ],
    "Settings configuration-group card eligibility",
  );
  if (
    surfaceModel?.configuration?.interaction !==
      "persistent_value_controls_only" ||
    surfaceModel?.configuration?.pure_state_card_allowed !== false ||
    surfaceModel?.configuration?.one_time_action_allowed !== false ||
    surfaceModel?.status?.standalone_card_allowed !== false ||
    surfaceModel?.status?.presentation !==
      "muted_row_inside_owning_page_section_or_configuration_group"
  ) {
    throw new Error(
      "Settings configuration must be persistent and pure status must remain a muted owning-page row",
    );
  }
  if (
    surfaceModel?.action?.interaction !==
      "explicit_one_time_command_with_confirmation_progress_and_receipt_as_required" ||
    surfaceModel?.action?.persistent_value_allowed !== false ||
    surfaceModel?.action?.maintenance_and_storage_are_settings !== false
  ) {
    throw new Error(
      "Settings one-time actions must be independent from persistent configuration",
    );
  }
  if (
    surfaceModel?.diagnostic?.ordinary_page_inline_allowed !== false ||
    surfaceModel?.diagnostic?.entry_presentation !==
      "explicit_diagnostics_action" ||
    surfaceModel?.diagnostic?.container !== "modal_or_drawer" ||
    surfaceModel?.diagnostic?.summary_first !== true ||
    surfaceModel?.diagnostic?.raw_details_secondary !== true
  ) {
    throw new Error(
      "Settings diagnostics must open explicitly in a summary-first modal or drawer",
    );
  }
  assertIncludesAll(
    surfaceModel?.diagnostic?.raw_fields,
    ["paths", "refs", "action_ids", "receipts", "runtime_enums", "payloads", "logs"],
    "Settings diagnostic raw fields",
  );
  if (
    surfaceModel?.desktop_layout_policy !==
      "use_columns_only_for_independent_groups_with_comparable_density" ||
    surfaceModel?.default_layout_policy !== "full_width_vertical_groups"
  ) {
    throw new Error(
      "Settings layout must default to full-width groups and use columns only for comparable independent decisions",
    );
  }
}

function validatePageSurfaceInventory(pageId, inventory) {
  const surfaceTypes = ["configuration", "status", "action", "diagnostic"];
  assertDeepEqualJson(
    Object.keys(inventory ?? {}),
    surfaceTypes,
    `Settings experience ${pageId} surface inventory types`,
  );

  const seenIds = new Set();
  for (const surfaceType of surfaceTypes) {
    const entries = inventory?.[surfaceType];
    if (!Array.isArray(entries)) {
      throw new Error(
        `Settings experience ${pageId} ${surfaceType} inventory must be an array`,
      );
    }
    for (const entry of entries) {
      if (
        Object.keys(entry ?? {}).length !== 2 ||
        typeof entry?.id !== "string" ||
        entry.id.trim() === "" ||
        entry.owner !== pageId
      ) {
        throw new Error(
          `Settings experience ${pageId} ${surfaceType} inventory must declare id and page ownership`,
        );
      }
      if (seenIds.has(entry.id)) {
        throw new Error(
          `Settings experience ${pageId} surface ${entry.id} cannot mix surface types`,
        );
      }
      seenIds.add(entry.id);
    }
  }

  if (pageId === "maintenance") {
    if (
      inventory.configuration.length !== 2 ||
      !["update_channel", "log_directory"].every((id) =>
        inventory.configuration.some((entry) => entry.id === id),
      ) ||
      inventory.action.length === 0
    ) {
      throw new Error(
        "Settings Maintenance may persist only the update channel and App log directory; maintenance operations remain actions",
      );
    }
  }
  if (pageId === "storage") {
    if (
      inventory.configuration.length !== 0 ||
      inventory.action.length === 0
    ) {
      throw new Error(
        "Settings Storage must not own configuration; usage, cleanup, archive, and restore remain status or actions",
      );
    }
  }
  if (pageId === "workspace") {
    assertIncludesAll(
      inventory.configuration.map((entry) => entry.id),
      [
        "workspace_selection",
        "codex_user_instructions",
        "opl_app_session_context",
      ],
      "Settings Workspace and Personalization configuration ownership",
    );
  }
  if (pageId === "preferences") {
    const preferenceConfigurationIds = inventory.configuration.map(
      (entry) => entry.id,
    );
    if (
      preferenceConfigurationIds.includes("log_directory") ||
      preferenceConfigurationIds.includes("codex_user_instructions") ||
      preferenceConfigurationIds.includes("opl_app_session_context")
    ) {
      throw new Error(
        "Settings Preferences must not duplicate Workspace paths or personalization",
      );
    }
  }
}

export function validateSettingsExperienceContract(experience) {
  if (
    experience?.schema !== "settings_codex_quiet_experience.v2" ||
    experience.owner !== "one-person-lab-app" ||
    experience.purpose !==
      "machine_verifiable_settings_visual_search_page_and_dom_contract"
  ) {
    throw new Error(
      "Settings experience contract must be active App-owned control-center behavior",
    );
  }
  if (
    experience.source_contract_ref !==
      "contracts/app-gui-product-contract.json#settings_navigation.settings_ia" ||
    experience.page_state_matrix_ref !==
      "contracts/app-page-state-matrix.json#pages"
  ) {
    throw new Error(
      "Settings experience contract must bind GUI authority and the page-state matrix",
    );
  }
  assertDeepEqualJson(
    experience.visual_system,
    appOwnedSettingsVisualSystem,
    "Settings experience visual system",
  );
  validateSettingsSurfaceModel(experience.surface_model);

  const search = experience.global_search;
  if (
    search?.global_entry_count !== 1 ||
    search.entry_testid !== "settings-search-input" ||
    search.results_testid !== "settings-search-results" ||
    search.result_item_testid !== "settings-search-result" ||
    search.empty_state_testid !== "settings-search-empty" ||
    search.index_granularity !== "item" ||
    search.result_label_format !== "{page_label} > {entry_label}" ||
    search.result_navigation !== "route_id_plus_anchor" ||
    search.keyboard_activation_policy !==
      "enter_activates_first_visible_result" ||
    search.destination_focus_policy !== "scroll_and_focus_declared_anchor" ||
    search.anchor_query_param !== "section" ||
    search.hash_router_policy !==
      "use_route_query_section_when_a_second_hash_fragment_is_not_supported" ||
    search.compatibility_index_policy !==
      "index_update_theme_local_services_and_personalization_under_their_owner_page_anchors"
  ) {
    throw new Error(
      "Settings search must be one bilingual item-level route-and-anchor search",
    );
  }
  assertDeepEqualJson(
    search.languages,
    ["zh-CN", "en"],
    "Settings search languages",
  );
  assertDeepEqualJson(
    search.forbidden_duplicate_entry_testids,
    ["settings-sider-search-input", "settings-route-search"],
    "Settings duplicate search entry testids",
  );

  const pageContracts = experience.page_contracts ?? {};
  assertDeepEqualJson(
    Object.keys(pageContracts).sort(),
    [...appOwnedSettingsProductPageIds].sort(),
    "Settings experience product page ids",
  );
  const routeByProductPage = new Map([
    ...appOwnedSettingsTopLevelEntryIds.map((pageId, index) => [
      pageId,
      appOwnedSettingsTabs[index],
    ]),
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
      typeof page.matrix_page_id !== "string" ||
      page.matrix_page_id.length === 0
    ) {
      throw new Error(
        `Settings experience ${pageId} must bind its product, route, and matrix ids`,
      );
    }
    validatePageSurfaceInventory(pageId, page.surface_inventory);
    for (const field of [
      "label_zh",
      "label_en",
      "exception_state",
      "technical_details_boundary",
    ]) {
      if (typeof page[field] !== "string" || page[field].trim() === "") {
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
    if (
      !Array.isArray(page.primary_information) ||
      page.primary_information.length === 0
    ) {
      throw new Error(
        `Settings experience ${pageId} must declare primary information`,
      );
    }
    if (
      !Array.isArray(page.first_viewport_groups) ||
      page.first_viewport_groups.length < 1 ||
      page.first_viewport_groups.length > 4 ||
      new Set(page.first_viewport_groups).size !==
        page.first_viewport_groups.length
    ) {
      throw new Error(
        `Settings experience ${pageId} must declare one to four distinct first-viewport groups`,
      );
    }
    if (
      typeof page.primary_action?.id !== "string" ||
      typeof page.primary_action?.availability !== "string" ||
      page.primary_action.max_visible !== 1
    ) {
      throw new Error(
        `Settings experience ${pageId} must declare at most one primary action`,
      );
    }
    const technicalDetailsTestId = `settings-${pageId}-technical-details`;
    const technicalDetailsOptional = [
      "overview",
      "gateway",
      "models",
      "workspace",
      "capabilities",
      "preferences",
    ].includes(pageId);
    const hasTechnicalDetailsSurface =
      page.required_dom.always.includes(technicalDetailsTestId) ||
      page.required_dom.conditional.some(
        (entry) =>
          entry.testid === technicalDetailsTestId &&
          entry.when === "diagnostics_open",
      );
    if (
      !Array.isArray(page.required_dom?.always) ||
      !page.required_dom.always.includes(`settings-page-${pageId}`) ||
      !page.required_dom.always.includes(`settings-${pageId}-primary`) ||
      !Array.isArray(page.required_dom?.conditional) ||
      (!technicalDetailsOptional && !hasTechnicalDetailsSurface)
    ) {
      throw new Error(
        `Settings experience ${pageId} must declare stable DOM testids`,
      );
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
    pageContracts.resources.browser_access_entry,
    appOwnedSettingsResourcesBrowserEntry,
    "Settings Resources browser entry",
  );
  if (
    pageContracts.resources.connection_filter_policy !==
    "exclude the built-in OPL Gateway connection and count; show only canonical owner-projected external connections with at least one resource or route ref"
  ) {
    throw new Error(
      "Settings Resources must exclude the built-in OPL Gateway connection and count",
    );
  }
  if (
    pageContracts.models.browser_access_entry !== undefined ||
    pageContracts.models.required_dom.always.includes(
      "settings-access-browser-access",
    ) ||
    !pageContracts.resources.required_dom.always.includes(
      "settings-resources-browser-access",
    )
  ) {
    throw new Error(
      "Settings browser access must be owned by Resources & Connections, not Models",
    );
  }
  assertDeepEqualJson(
    pageContracts.gateway.surface_rules,
    {
      content_group_presentation: "single_unframed_content_group",
      account_container_border_count: 0,
      metrics_container_border_count: 0,
      metric_cell_divider_count: 0,
      footer_border_count: 0,
      stale_error_presentation: "inline_status_text_without_banner_frame",
    },
    "Settings Gateway flat content rules",
  );
  if (
    pageContracts.workspace.readiness_precedence !==
    "filesystem_writability_and_health_override_executor_permission_mode"
  ) {
    throw new Error(
      "Settings Workspace readiness must follow filesystem writability and health before executor mode",
    );
  }
  const backgroundTasks = pageContracts.overview.background_services_summary;
  if (
    backgroundTasks?.overview_visible_unit !== "background_tasks" ||
    backgroundTasks?.overview_label_zh !== "后台任务" ||
    backgroundTasks?.overview_label_en !== "Background tasks" ||
    backgroundTasks?.component_detail_visibility !==
      "service_status_destination_only" ||
    !pageContracts.overview.required_dom.always.includes(
      "settings-overview-background-tasks",
    ) ||
    pageContracts.overview.required_dom.always.some((id) =>
      id.startsWith("settings-overview-temporal-"),
    )
  ) {
    throw new Error(
      "Settings Overview must keep one persistent Background tasks summary and leave Temporal component detail on Service Status",
    );
  }
  assertDeepEqualJson(
    pageContracts.workspace.surface_rules,
    {
      workspace_card_count: 0,
      location_presentation:
        "one unframed Working directory group with the resolved logical workspace root",
      permission_presentation:
        "one merged writability status inside the workspace row",
      responsive_row_policy:
        "container_width_below_620px_stacks_copy_status_and_actions_without_word_breaking_paths",
      personalization_presentation:
        "unframed_field_groups_with_section_hairlines_no_nested_cards",
      maintenance_action_visibility: "attention_only",
      diagnostics_entry: "explicit_modal_action",
      workspace_root_owner: "one-person-lab_Framework",
      workspace_root_desktop_policy:
        "editable_through_the_owner_projected_workspace_root_action_with_fresh_readback",
      workspace_root_webui_policy:
        "read_only_owner_projected_logical_root_and_never_execute_workspace_root_set",
      workspace_root_docker_webui_policy:
        "read_only_/projects_from_OPL_WORKSPACE_ROOT_and_never_execute_workspace_root_set",
      desktop_directory_mapping:
        "project_workspace_is_the_Framework_logical_workspace_root",
      docker_mapping:
        "host_projects_directory_is_bound_to_/projects_and_Settings_does_not_rewire_the_bind_mount",
      docker_volume_rewire_allowed: false,
      generated_base_context_editable: false,
      additional_instructions_editable: true,
      restore_default_confirmation_required: true,
      personalization_changes_apply_to: "next_new_conversation",
      deployment_boundary:
        "Settings_changes_only_the_desktop_logical_workspace_root;_standalone_WebUI_root_configuration_and_Docker_WebUI_host_bind_sources_change_only_outside_the_browser",
      path_instance_count: 1,
    },
    "Settings Workspace surface rules",
  );
  assertDeepEqualJson(
    pageContracts.agents.management_discoverability,
    {
      primary_row_controls: ["home_visibility", "recommended_action", "manage"],
      lifecycle_actions: [
        "install",
        "update",
        "repair",
        "enable",
        "disable",
        "hide",
        "unhide",
        "uninstall",
      ],
      catalog_search_is_settings_global_search: false,
      registry_refresh_visibility: "ordinary_visible_action",
      manifest_url_install_visibility: "advanced_only",
      projected_action_policy:
        "execute only Framework action_id and payload; never infer status, readiness, action ids, or payload fields in the Shell",
      raw_source_fallback_allowed: false,
      diagnostic_refs_location: "diagnostics_modal",
      home_preference_policy:
        "single_reactive_owner_with_success_commit_and_failure_rollback",
    },
    "Settings Agent package management discoverability",
  );
  assertDeepEqualJson(
    pageContracts.agents.first_viewport_groups,
    [
      "agent_package_catalog_controls",
      "agent_package_directory_entries",
      "agent_package_details",
    ],
    "Settings Agents first-viewport groups",
  );
  assertDeepEqualJson(
    pageContracts.agents.catalog_presentation,
    {
      policy_ref:
        "contracts/app-product-profile.json#gui.agent_package_registry.catalog_presentation_policy",
      section_order: [
        "professional_agents",
        "workflow_profiles",
        "shared_dependencies",
        "other_packages",
      ],
      role_label_policy:
        "localized_product_label_never_raw_package_role_enum",
      dependency_source:
        "app_state.agent_packages.status_index.packages[].dependent_guard.required_by_package_ids",
      dependency_policy:
        "single_parent_nested_multi_parent_or_missing_parent_shared_each_package_rendered_once",
      hardcoded_relationships_allowed: false,
    },
    "Settings Agents catalog presentation",
  );
  if (pageContracts.agents.developer_mode_surface?.default_disclosure !== "collapsed") {
    throw new Error(
      "Settings Agents developer source and repository maintenance configuration must be collapsed by default",
    );
  }
  if (
    pageContracts.agents.exception_state !==
    "highlight only genuinely failed blocked or dependency-broken Agent packages; installed exposed verification-deferred or scope-materialization-missing packages read as available with no preconfiguration action"
  ) {
    throw new Error(
      "Settings Agents exception state must use Agent package semantics",
    );
  }
  assertDeepEqualJson(
    pageContracts.preferences.surface_rules,
    {
      full_width_group_count: 3,
      two_plus_one_grid_allowed: false,
      builtin_theme_ids: [],
      extension_themes_default_visible: false,
      custom_theme_management:
        "not_exposed_user_data_preserved_for_compatibility",
      appearance_mode_values: ["system", "light", "dark"],
      visual_baseline: "single_governed_opl_codex_aligned_baseline",
      interactive_controls_inside_diagnostic_surface_allowed: false,
      performance_and_waiting_policy:
        "advanced_but_persistent_controls_use_a_named_configuration_group_not_a_technical_details_disclosure",
      voice_input_configuration_allowed: false,
      voice_input_configuration_owner: "capabilities",
    },
    "Settings Preferences surface rules",
  );
  assertDeepEqualJson(
    pageContracts.maintenance.surface_rules,
    {
      configuration_location:
        "update_channel_is_an_inline_persistent_control_in_the_updates_section",
      destination_visibility_policy:
        "render_exactly_one_of_service_status_updates_repairs_or_logs_diagnostics_as_the_selected_ordinary_purpose",
      daily_action_surface:
        "the_Maintenance_page_itself_owns_check_apply_repair_and_rollback_with_per_action_state_confirmation_and_fresh_readback",
      management_surface:
        "inline_page_rows_and_progressive_confirmation_never_a_second_large_management_modal",
      diagnostic_surface:
        "one_advanced_read_only_disclosure_for_localized_component_path_and_receipt_evidence",
      diagnostic_entry_count: 1,
      large_overlay_policy:
        "never_open_or_define_overlapping_management_and_diagnostics_modals",
      diagnostic_mutation_controls_allowed: false,
      raw_internal_status_key_policy:
        "never_render_raw_internal_status_keys_action_ids_or_payload_fields_as_user_facing_copy",
      unknown_state_copy:
        "distinguish_checking_not_checked_not_applicable_and_needs_attention",
      managed_dependency_primary_visibility:
        "managed_dependency_summary_is_visible_without_opening_diagnostics",
      working_path_owner:
        "Framework and raw paths live only in Maintenance diagnostics",
      log_directory_owner:
        "Logs_and_Diagnostics_owns_the_Desktop_application.setLogDirectory_action_standalone_WebUI_read_only_systemInfo_projection_and_Docker_WebUI_read_only_/data/logs_projection",
      webui_log_action_execution_allowed: false,
    },
    "Settings Maintenance surface rules",
  );
  const maintenanceDestinations =
    pageContracts.maintenance.destination_contracts ?? {};
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(maintenanceDestinations).map(
        ([id, destination]: [string, any]) => [
          id,
          {
            anchor: destination.anchor,
            label_zh: destination.label_zh,
            label_en: destination.label_en,
          },
        ],
      ),
    ),
    {
      runtime_services: {
        anchor: "services",
        label_zh: "服务状态",
        label_en: "Service Status",
      },
      updates_repairs: {
        anchor: "updates",
        label_zh: "更新与修复",
        label_en: "Updates & Repair",
      },
      logs_diagnostics: {
        anchor: "diagnostics",
        label_zh: "日志与诊断",
        label_en: "Logs & Diagnostics",
      },
    },
    "Settings Maintenance second-level destinations",
  );
  if (
    maintenanceDestinations.logs_diagnostics?.must_not_show?.includes(
      "WebUI log-directory mutation",
    ) !== true ||
    pageContracts.maintenance.destination_dom?.logs_diagnostics?.includes(
      "settings-maintenance-log-directory",
    ) !== true
  ) {
    throw new Error(
      "Settings Logs & Diagnostics must own the carrier-specific log directory surface",
    );
  }
  assertDeepEqualJson(
    pageContracts.storage.surface_rules,
    {
      total_usage_presentation: "status_row_in_page_header",
      pure_usage_summary_card_allowed: false,
      diagnostics_entry: "explicit_modal_action",
      zero_byte_policy: "show_nothing_to_clean_and_hide_actions",
      cleanup_action_policy: "single_progressive_action_preview_then_confirm",
      conversation_archive_policy:
        "archive_receipt_is_required_before_delete_and_the_same_archive_exposes_a_confirmed_restore_action",
      restore_collision_policy:
        "never_overwrite_an_existing_conversation_without_an_explicit_collision_decision",
      inventory_initial_state:
        "last_persisted_snapshot_or_loading_placeholder_never_synthetic_zero_bytes",
      inventory_refresh_policy:
        "startup_delayed_background_scan_with_300_second_ttl_manual_force_refresh_and_push_update_after_scan",
      inventory_cache_ttl_seconds: 300,
      inventory_freshness_fields: ["observed_at", "scan_duration_ms", "stale"],
      inventory_event: "local-data-lifecycle.inventory-updated",
      log_directory_reference: "read_only_link_to_environment#diagnostics",
      owner_storage_projection_source: "opl_app_state_fast_owner_projections",
      owner_storage_sections: [
        "agent_package_store",
        "webui_data_volume",
      ],
      owner_storage_required_fields: [
        "status",
        "observed_at",
        "stale",
        "bytes",
        "reclaimable_bytes",
        "owner_route",
        "projected_action",
      ],
      owner_storage_missing_policy: "fail_open_keep_shell_owned_categories_available",
      agent_package_storage_action_policy: "navigate_to_agents_reuse_owner_uninstall_no_duplicate_storage_lifecycle",
      webui_data_volume_mapping: "OnePersonLab/data -> /data",
      webui_cleanup_policy: "owner_projected_dry_run_exact_confirmation_fresh_terminal_readback_and_recovery",
      webui_host_action_abi_ref:
        "contracts/app-release-channel.json#local_data_lifecycle.owner_storage_projections.webui_data_volume.host_action_abi",
      generic_docker_prune_allowed: false,
      deployment_location_summary: {
        visibility: "docker_webui_only",
        interaction: "read_only_no_mount_or_environment_mutation",
        required_host_bind_count: 2,
        required_host_binds: [
          {
            id: "projects",
            container_path: "/projects",
            purpose_zh: "项目与任务产物",
            purpose_en: "Projects and task artifacts",
            container_environment: [
              "OPL_PROJECTS_DIR=/projects",
              "OPL_WORKSPACE_ROOT=/projects",
            ],
            settings_relation:
              "In Docker WebUI, Working Directory is fixed read-only at /projects and never executes workspace_root_set or rewires the host projects bind",
          },
          {
            id: "data",
            container_path: "/data",
            purpose_zh: "App 数据、Framework 状态、Codex Home 与会话、日志",
            purpose_en:
              "App data, Framework state, Codex Home and sessions, and logs",
            container_environment: [
              "HOME=/data",
              "AIONUI_DATA_DIR=/data",
              "OPL_DATA_DIR=/data",
            ],
            settings_relation:
              "Data and log locations are deployment-managed and Settings never rewires the host data bind",
          },
        ],
        container_recovery_surface: {
          container_path: "/recovery",
          environment: "OPL_WEBUI_RECOVERY_DIR=/recovery",
          purpose_zh: "清理前归档与恢复暂存",
          purpose_en: "Pre-cleanup archives and recovery staging",
          required_host_bind: false,
          host_persistence_policy:
            "optional_and_deployment_managed_not_a_third_required_bind",
        },
      },
      storage_carrier_behavior: appOwnedStorageCarrierBehavior,
    },
    "Settings Storage surface rules",
  );
  assertDeepEqualJson(
    pageContracts.about.surface_rules,
    {
      version_update_card_count: 1,
      version_channel_layout: "one compact row",
      update_action_placement: "dedicated row below version and channel",
      help_link_layout: "full_width_row_with_trailing_icon_at_container_edge",
      automatic_check_policy:
        "check once after App startup and publish the result to a shared updater state store",
      mount_policy:
        "About reads cached updater state and never starts a check on mount",
      manual_check_policy:
        "the Check for updates action refreshes the same shared updater state",
      state_source:
        "desktop_main_process_app_metadata + single_main_process_updater_state_store",
      framework_state_role: "diagnostic_supplement_only",
    },
    "Settings About surface rules",
  );
  assertDeepEqualJson(
    pageContracts.capabilities.tab_contract,
    appOwnedSettingsCapabilitiesTabContract,
    "Settings Capabilities tab contract",
  );
  assertDeepEqualJson(
    pageContracts.resources.action_behavior,
    appOwnedSettingsResourceActionBehavior,
    "Settings Resources action behavior",
  );

  if (
    experience.search_index?.schema !==
    "settings_bilingual_item_search_index.v1"
  ) {
    throw new Error(
      "Settings search index must use settings_bilingual_item_search_index.v1",
    );
  }
  const entries = experience.search_index?.entries ?? [];
  const entryIds = new Set();
  for (const entry of entries) {
    assertIncludesAll(
      Object.keys(entry),
      appOwnedSettingsSearchEntryFields,
      `Settings search entry ${entry?.id ?? "<missing id>"} fields`,
    );
    if (entryIds.has(entry.id)) {
      throw new Error(`Settings search entry ${entry.id} must be unique`);
    }
    entryIds.add(entry.id);
    const page = pageContracts[entry.page_id];
    if (!page || !page.required_anchors.includes(entry.anchor)) {
      throw new Error(
        `Settings search entry ${entry.id} must target a declared page anchor`,
      );
    }
    if (
      typeof entry.label_zh !== "string" ||
      entry.label_zh.trim() === "" ||
      typeof entry.label_en !== "string" ||
      entry.label_en.trim() === "" ||
      !Array.isArray(entry.keywords_zh) ||
      entry.keywords_zh.length === 0 ||
      !Array.isArray(entry.keywords_en) ||
      entry.keywords_en.length === 0
    ) {
      throw new Error(
        `Settings search entry ${entry.id} must be indexed in Chinese and English`,
      );
    }
  }
  for (const [pageId, page] of Object.entries(pageContracts)) {
    assertDeepEqualJson(
      page.search_entry_ids,
      entries
        .filter((entry) => entry.page_id === pageId)
        .map((entry) => entry.id),
      `Settings search entries for ${pageId}`,
    );
  }
  for (const redirect of Object.values(
    appOwnedSettingsCompatibilityRedirects,
  )) {
    const targetPage = pageContracts[redirect.product_page_id];
    if (!targetPage?.required_anchors.includes(redirect.anchor)) {
      throw new Error(
        `Settings compatibility route ${redirect.source_route_id} must target a declared owner-page anchor`,
      );
    }
  }
  if (
    experience.live_evidence_boundary !==
    "contract_matrix_validator_and_focused_tests_do_not_prove_running_shell_runtime_or_release_readiness"
  ) {
    throw new Error(
      "Settings experience contract must preserve the live evidence boundary",
    );
  }
}

function validateSettingsProjection(projection) {
  if (projection?.schema !== "settings_projection.v1") {
    throw new Error(
      "Settings control plane must declare settings_projection.v1",
    );
  }
  if (projection?.owner !== "one-person-lab-app") {
    throw new Error("Settings projection must stay App-owned");
  }
  if (
    projection?.source !==
    "opl app state --profile full --json#app_state.settings_control_center.settings_projection"
  ) {
    throw new Error(
      "Settings projection must consume the explicit full App settings drilldown projection",
    );
  }
  if (
    projection?.policy !==
    "summary_first_settings_items_with_scope_owner_risk_action_details_and_editability_reason"
  ) {
    throw new Error(
      "Settings projection must require summary-first item metadata",
    );
  }
  assertDeepEqualJson(
    projection?.section_ids,
    appOwnedSettingsProjectionSectionIds,
    "Settings projection section ids",
  );
  assertDeepEqualJson(
    projection?.item_required_fields,
    appOwnedSettingsProjectionItemFields,
    "Settings projection item required fields",
  );
  if (
    projection?.live_evidence_policy !==
    "contract_docs_tests_do_not_prove_live_installed_release_runtime_currentness_or_owner_acceptance"
  ) {
    throw new Error(
      "Settings projection must keep Live evidence outside contract/docs/tests completion",
    );
  }
  const sections = projection?.sections ?? {};
  assertDeepEqualJson(
    Object.keys(sections),
    appOwnedSettingsProjectionSectionIds,
    "Settings projection sections",
  );
  for (const [sectionId, section] of Object.entries(sections)) {
    if (section?.section_id !== sectionId) {
      throw new Error(
        `Settings projection section ${sectionId} must keep matching section_id`,
      );
    }
    if (!Array.isArray(section.items) || section.items.length === 0) {
      throw new Error(
        `Settings projection section ${sectionId} must declare at least one item`,
      );
    }
    for (const item of section.items) {
      assertIncludesAll(
        Object.keys(item),
        appOwnedSettingsProjectionItemFields,
        `Settings projection item ${sectionId}.${item?.item_id ?? "<missing id>"} fields`,
      );
      for (const field of appOwnedSettingsProjectionItemFields) {
        if (typeof item[field] !== "string" || item[field].trim() === "") {
          throw new Error(
            `Settings projection item ${sectionId}.${item?.item_id ?? "<missing id>"} must declare ${field}`,
          );
        }
      }
    }
  }
}

function validateSettingsPageAdapterPolicy(controlPlane, productProfile) {
  const policy = controlPlane.page_adapter_policy;
  if (
    policy?.policy !== "settings_pages_consume_explicit_view_model_adapters"
  ) {
    throw new Error(
      "Settings page adapter policy must require explicit view-model adapters",
    );
  }
  const requiredPages = policy.required_pages ?? {};
  assertDeepEqualJson(
    Object.keys(requiredPages).sort(),
    Object.keys(expectedPageAdapterEntries).sort(),
    "Settings page adapter required pages",
  );
  for (const [routeId, adapterEntry] of Object.entries(
    expectedPageAdapterEntries,
  )) {
    const page = requiredPages[routeId];
    if (!page) {
      throw new Error(`Settings page adapter policy is missing ${routeId}`);
    }
    if (page.route_id !== routeId) {
      throw new Error(
        `Settings page adapter policy ${routeId} must keep route_id ${routeId}`,
      );
    }
    if (page.adapter_entry !== adapterEntry) {
      throw new Error(
        `Settings page adapter policy ${routeId} must use ${adapterEntry}`,
      );
    }
    if (
      !String(page.renderer_entry ?? "").startsWith(
        "packages/desktop/src/renderer/",
      )
    ) {
      throw new Error(
        `Settings page adapter policy ${routeId} must declare a Settings renderer entry`,
      );
    }
    if (
      !Array.isArray(page.forbidden_sources) ||
      page.forbidden_sources.length === 0
    ) {
      throw new Error(
        `Settings page adapter policy ${routeId} must declare forbidden sources`,
      );
    }
  }
  validateSettingsAccessResourceBoundary(requiredPages.access);
  validateSettingsGatewayAccountBoundary(controlPlane, requiredPages.gateway);
  assertDeepEqualJson(
    requiredPages.environment?.managed_dependency_summary,
    appOwnedSettingsManagedDependencySummary,
    "Settings Maintenance managed dependency summary",
  );
  validateSettingsCapabilitiesTaskAwarenessSurface(
    requiredPages.capabilities?.task_awareness_surface,
    "Settings Capabilities page adapter task-awareness surface",
  );
  assertDeepEqualJson(
    requiredPages.capabilities?.entity_kinds,
    ["skill", "plugin", "mcp_server", "image_generation", "voice_input"],
    "Settings Capabilities page adapter entity kinds",
  );
  if (
    requiredPages.capabilities?.local_configuration_source !==
      "AionUI local configuration#MCP servers + image generation + voice input" ||
    requiredPages.capabilities?.third_party_projection_policy?.aionui_native_policy !==
      "keep_AionUI_native_skills_tools_assistants_MCP_helpers_image_controls_and_voice_input_controls_in_local_or_third_party_ownership_never_OPL_Flow_managed" ||
    !requiredPages.capabilities?.forbidden_sources?.includes("Preferences-owned voice input configuration")
  ) {
    throw new Error("Settings Capabilities adapter must own local MCP, image, and voice configuration");
  }
  validateSettingsAgentsDirectoryProjection(requiredPages.agents);
  validateWorkspaceAndStorageOwnership(
    requiredPages.workspace,
    requiredPages.environment,
    requiredPages.storage,
  );
  assertDeepEqualJson(
    productProfile?.settings?.control_plane?.page_adapter_policy,
    policy,
    "Product profile Settings page adapter policy projection",
  );
}

function validateWorkspaceAndStorageOwnership(
  workspacePage,
  environmentPage,
  storagePage,
) {
  assertDeepEqualJson(
    workspacePage?.workspace_root_carrier_policy,
    {
      desktop: {
        presentation: "editable",
        mutation_source: "owner_projected_workspace_root_action",
        fresh_readback_required: true,
      },
      webui: {
        presentation: "read_only_owner_projected_logical_root",
        authority_source: "owner_projected_logical_workspace_root",
        workspace_root_set_execution_allowed: false,
        host_projects_bind_rewire_allowed: false,
        docker: {
          presentation: "read_only_/projects",
          authority_source: "OPL_WORKSPACE_ROOT=/projects",
          host_projects_bind_rewire_allowed: false,
        },
      },
    },
    "Settings Workspace carrier-specific workspace root policy",
  );
  if (workspacePage?.log_directory !== undefined) {
    throw new Error(
      "Settings Workspace must not own the App log-directory control",
    );
  }
  const logDirectory = environmentPage?.log_directory;
  assertDeepEqualJson(
    logDirectory,
    {
      owner_page: "maintenance",
      owner_destination_id: "logs_diagnostics",
      typed_action: "application.setLogDirectory",
      typed_action_payload_fields: ["path"],
      typed_action_success_value_fields: ["hostLogDir"],
      typed_action_forbidden_success_value_fields: ["cacheDir", "workDir", "logDir"],
      mutation_sequence: [
        "persist_hostLogDir",
        "switch_live_log_writer",
        "rollback_persisted_hostLogDir_and_return_typed_failure_on_switch_failure",
      ],
      preserved_fields: ["cacheDir", "workDir"],
      host_projection: "application.systemInfo.logDir",
      persistence_target: "desktop_client_system_info.logDir",
      readback_ref: "application.setLogDirectory.hostLogDir plus application.systemInfo.logDir",
      desktop_change_supported: true,
      desktop_open_supported: true,
      webui_log_projection: "application.systemInfo.logDir",
      docker_webui_log_projection: "/data/logs",
      webui_change_supported: false,
      webui_action_execution_allowed: false,
      docker_volume_mapping: "host data directory -> /data",
      docker_volume_rewire_allowed: false,
    },
    "Settings Logs & Diagnostics typed host log-directory projection",
  );
  if (
    storagePage?.inventory_cache_policy?.ttl_seconds !== 300 ||
    storagePage?.log_directory_ref?.mode !== "read_only" ||
    storagePage?.log_directory_ref?.owner_route !== "environment#diagnostics" ||
    storagePage?.configuration_owner !== false
  ) {
    throw new Error(
      "Settings Storage must use the 300-second cache and keep the log directory as a read-only Logs & Diagnostics reference",
    );
  }
  assertDeepEqualJson(
    storagePage?.deployment_location_summary,
    {
      source_ref:
        "contracts/app-settings-control-plane.json#experience_contract.page_contracts.storage.surface_rules.deployment_location_summary",
      required_host_bind_paths: ["/projects", "/data"],
      container_recovery_path: "/recovery",
      container_recovery_is_required_host_bind: false,
      mutation_allowed: false,
    },
    "Settings Storage deployment location summary",
  );
  const ownerStorage = storagePage?.owner_storage_projections;
  if (
    ownerStorage?.projection_source !== "opl app state --profile fast --json" ||
    ownerStorage?.missing_projection_policy !== "fail_open_keep_shell_owned_categories_available" ||
    ownerStorage?.unknown_bytes_policy !== "unavailable_never_zero" ||
    ownerStorage?.agent_package_store?.owner_route !== "/settings/agents" ||
    ownerStorage?.agent_package_store?.ordinary_action !== "navigate_to_owner_route" ||
    ownerStorage?.agent_package_store?.direct_storage_mutation_allowed !== false ||
    ownerStorage?.webui_data_volume?.data_volume_mapping !== "OnePersonLab/data -> /data" ||
    ownerStorage?.webui_data_volume?.host_action_capability_id !==
      appOwnedWebuiDataVolumeHostActionCapabilityId ||
    ownerStorage?.webui_data_volume?.host_action_abi_ref !== appOwnedWebuiDataVolumeHostActionAbiRef ||
    ownerStorage?.webui_data_volume?.generic_docker_prune_allowed !== false ||
    ownerStorage?.webui_data_volume?.shell_direct_path_delete_allowed !== false
  ) {
    throw new Error(
      "Settings Storage must consume fail-open owner projections without direct Package or WebUI path mutation",
    );
  }
  assertDeepEqualJson(
    ownerStorage?.sections,
    ["agent_package_store", "webui_data_volume"],
    "Settings Storage owner projection sections",
  );
  assertIncludesAll(
    ownerStorage?.common_required_fields,
    [
      "status",
      "observed_at",
      "stale",
      "bytes",
      "reclaimable_bytes",
      "owner_route",
      "projected_action",
    ],
    "Settings Storage owner projection fields",
  );
  assertDeepEqualJson(
    storagePage?.storage_carrier_behavior,
    appOwnedStorageCarrierBehavior,
    "Settings Storage adapter carrier behavior",
  );
}

function validateSettingsGatewayAccountBoundary(controlPlane, gatewayAdapter) {
  const gatewaySource = 'app_state.settings_control_center.app_settings_read_model.opl_gateway_account';
  const gatewayRoute = (controlPlane.ordinary_routes ?? []).find((route) => route.id === 'gateway');
  if (!String(gatewayRoute?.state_source ?? '').includes(gatewaySource)) {
    throw new Error('Settings Gateway route must consume the canonical Gateway account read model path');
  }
  if (
    gatewayAdapter?.opl_gateway_account_source !== gatewaySource ||
    gatewayAdapter.opl_gateway_account_projection_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_projection' ||
    gatewayAdapter.opl_gateway_account_secret_bridge_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_secret_bridge' ||
    gatewayAdapter.secret_boundary !==
      'account_password_only_through_runtime_provider_and_dedicated_stdin_never_generic_action_payload' ||
    gatewayAdapter.webui_boundary !== 'gateway_account_and_manual_api_key_via_existing_runtime_http_proxy'
  ) {
    throw new Error('Settings Gateway adapter must preserve the Gateway account projection and secret bridge boundaries');
  }
  const surface = controlPlane.experience_contract?.page_contracts?.gateway?.gateway_account_surface;
  if (
    surface?.projection_path !== gatewaySource ||
    surface.projection_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_projection' ||
    surface.secret_bridge_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_secret_bridge' ||
    surface.account_card_visibility !== 'account_connection_only' ||
    surface.ttl_seconds !== 900 ||
    surface.webui_password_login_allowed !== true ||
    surface.generic_action_secret_payload_allowed !== false
  ) {
    throw new Error('Settings Gateway experience must keep account visibility, TTL, WebUI, and secret rules');
  }
  assertDeepEqualJson(surface.access_paths, ['account_login', 'manual_api_key'], 'Settings Gateway access paths');
  assertDeepEqualJson(
    surface.account_card_fields,
    [
      'account.display_name',
      'account.email',
      'account.balance',
      'usage.today_tokens',
      'usage.today_actual_cost',
      'usage.total_tokens',
      'usage.total_actual_cost',
      'managed_key.name',
      'managed_key.status',
      'freshness.observed_at',
      'freshness.stale',
    ],
    'Settings Gateway account card fields',
  );
}

function validateSettingsAgentsDirectoryProjection(agentsPage) {
  if (agentsPage?.state_source !== expectedAgentsStateSource) {
    throw new Error(
      "Settings Agents page adapter must read from canonical agent_packages, runtime source, and Home shortcut projections",
    );
  }
  const directory = agentsPage?.directory_projection_surface;
  if (!directory || typeof directory !== "object") {
    throw new Error(
      "Settings Agents page adapter must declare a directory projection surface",
    );
  }
  if (
    directory.surface !== "settings_agents" ||
    directory.primary_identity !== "public_agent_package_directory_entries" ||
    directory.purpose_role !== "secondary_tag_filter_only" ||
    directory.home_shortcut_integration !==
      "inline_visibility_and_order_controls_on_package_rows"
  ) {
    throw new Error(
      "Settings Agents directory projection must be package-directory first with inline Home shortcut management",
    );
  }
  if (
    directory.canonical_projection !==
      "opl app state --profile fast --json#app_state.agent_packages.directory.entries + app_state.agent_packages.status_index + app_state.runtime_source_carriers.items[]" ||
    directory.directory_collection_source !==
      "app_state.agent_packages.directory.entries" ||
    directory.directory_collection_policy !==
      "render every canonical entry including uninstalled, OMA, all first-party, framework capability, and workflow profile packages" ||
    directory.static_metadata_overlay_source !==
      "contracts/app-product-profile.json#gui.agent_package_registry.first_party_release_set_metadata" ||
    directory.static_metadata_overlay_policy !==
      "package_id keyed optional UI enrichment only; never collection membership, seed, status, readiness, or action authority" ||
    JSON.stringify(directory.static_metadata_overlay_fields) !==
      JSON.stringify(["display_name_i18n", "description_i18n"]) ||
    directory.runtime_source_projection !==
      "opl app state --profile fast --json#app_state.runtime_source_carriers.items[]" ||
    directory.source_semantics_policy !==
      "directory entries own catalog membership, installed, activated, installability, coarse readiness, recommended_action_ref, and exact available_actions; status_index adds canonical package-id-keyed dependency_readiness, repair_action, activation_action, dependent_guard, capability_exposure, materialization, runtime-source, currentness, receipt, and status-read diagnostics but cannot override directory lifecycle, readiness, or exact actions; package_dependency_readiness remains lower-level diagnostic enrichment; runtime source carriers and modules may enrich source diagnostics only; the shell infers none of them" ||
    directory.diagnostic_enrichment_projection !==
      "opl app state --profile fast --json#app_state.agent_packages.status_index + app_state.runtime_source_carriers.items[] + app_state.modules.items[]" ||
    Object.hasOwn(directory, "legacy_fallback_projection")
  ) {
    throw new Error(
      "Settings Agents directory projection must record canonical directory authority and diagnostic-only enrichment without a legacy collection fallback",
    );
  }
  if (
    directory.normalization_policy !==
      "shell uses directory.entries as the only manageable collection, joins optional diagnostics by canonical package_id, keeps directory lifecycle/readiness/actions authoritative on overlap, and may enrich UI metadata only from the static profile overlay" ||
    directory.canonical_directory_absent_policy !==
      "render loading, empty, last-good stale, or failed without synthesizing rows or actions from status_index, runtime_source_carriers, modules, Home shortcuts, or static metadata" ||
    directory.catalog_interaction_contract_ref !==
      "contracts/app-gui-product-contract.json#pages.settings_agents.agent_package_lifecycle_ux.directory_controls" ||
    directory.package_action_contract_ref !==
      "contracts/app-gui-product-contract.json#pages.settings_agents.agent_package_lifecycle_ux.canonical_action_contract" ||
    directory.stage_runtime_activation_contract_ref !==
      "contracts/app-gui-product-contract.json#pages.settings_agents.agent_package_lifecycle_ux.workspace_activation_contract" ||
    directory.settings_action_scope !== "owner_projected_non_activation_actions_only" ||
    directory.settings_activation_execution_allowed !== false ||
    directory.new_conversation_activation_execution_allowed !== false ||
    directory.ordinary_send_activation_execution_allowed !== false ||
    directory.settings_target_workspace_source !== null ||
    directory.global_workspace_root_activation_target_allowed !== false ||
    directory.selected_session_directory_activation_target_allowed !== false ||
    directory.scope_inference_allowed !== false ||
    directory.session_launch_authority !== false ||
    directory.stage_runtime_activation_owner !== "one-person-lab_family_runtime" ||
    directory.stage_runtime_workspace_locator_source !==
      "StageRun.workspace_locator_or_StageAttempt.workspace_locator"
  ) {
    throw new Error(
      "Settings Agents directory projection must keep activation out of Settings and reserve it for Framework Stage runtime",
    );
  }
  const statusModel = directory.status_model;
  if (
    statusModel?.policy !== "multi_axis_package_status_no_single_repair_bucket" ||
    statusModel?.user_facing_projection_ref !==
      "contracts/app-gui-product-contract.json#pages.settings_agents.agent_package_lifecycle_ux.user_facing_status_projection" ||
    statusModel?.localized_metadata_source_ref !==
      "contracts/app-product-profile.json#gui.agent_package_registry.first_party_release_set_metadata"
  ) {
    throw new Error(
      "Settings Agents must keep a multi-axis package status model",
    );
  }
  assertDeepEqualJson(
    statusModel?.axes,
    [
      "install_state",
      "activation_state",
      "activation_action",
      "update_state",
      "source_state",
      "trust_state",
      "codex_surface_state",
      "capability_exposure",
      "directory_readiness",
      "dependency_readiness",
      "dependent_guard",
      "materialization_readiness",
      "runtime_source_readiness",
      "operational_ready",
      "launch_allowed",
    ],
    "Settings Agents status axes",
  );
  if (
    statusModel?.developer_source_policy !==
    "active runtime developer checkout semantics must surface explicitly, remain distinct from package installation source, and must not collapse into a generic repair bucket"
  ) {
    throw new Error(
      "Settings Agents must preserve developer checkout semantics as their own axis",
    );
  }
  assertDeepEqualJson(
    statusModel?.must_not_collapse,
    [
      "developer_checkout",
      "dirty_checkout",
      "git_behind",
      "unknown",
      "needs_sync",
    ],
    "Settings Capabilities forbidden collapsed states",
  );
  const detailSurface = directory.detail_surface;
  if (
    detailSurface?.kind !== "desktop_right_side_panel_mobile_drawer" ||
    detailSurface?.first_screen_policy !==
      "directory_readiness_plus_canonical_dependency_readiness_activation_action_dependent_guard_exposure_and_launch_diagnostics_are_normal_detail_fields_while_raw_package_dependency_materialization_runtime_source_receipts_closure_digests_and_physical_surface_are_advanced_only_not_primary_row_density"
  ) {
    throw new Error(
      "Settings Agents detail surface must keep package diagnostics in side-panel/drawer density",
    );
  }
  assertIncludesAll(
    detailSurface?.detail_fields,
    [
      "receipt_refs",
      "rollback_ref",
      "action_receipt_ref",
      "directory_readiness",
      "dependency_readiness",
      "repair_action",
      "activation_action",
      "dependent_guard",
      "capability_exposure",
      "package_dependency_readiness",
      "materialization_readiness",
      "runtime_source_readiness",
      "operational_ready",
      "launch_allowed",
      "launch_blocked_reason",
      "allowed_when_blocked",
      "status_read_error",
      "dependency_closure",
      "physical_surface",
    ],
    "Settings Agents detail fields",
  );
  for (const forbiddenField of [
    "workflow_refs",
    "connector_readiness_refs",
    "resource_source_refs",
    "environment_refs",
  ]) {
    if (detailSurface?.detail_fields?.includes(forbiddenField)) {
      throw new Error(
        `Settings Agents detail surface must not own Capabilities field ${forbiddenField}`,
      );
    }
  }
  if (
    !String(directory.completion_boundary ?? "").includes(
      "canonical public directory entries",
    )
  ) {
    throw new Error(
      "Settings Agents directory projection must state the current implementation boundary",
    );
  }
}

function validateSettingsAccessResourceBoundary(accessPage) {
  if (
    accessPage?.model_access_source !==
    "app_state.core.codex.model_access_source"
  ) {
    throw new Error(
      "Settings Access must read the real Codex model_access_source",
    );
  }
  const presentation = accessPage?.normal_state_presentation;
  if (!presentation || typeof presentation !== "object") {
    throw new Error(
      "Settings Access page adapter must declare normal_state_presentation",
    );
  }
  assertDeepEqualJson(
    presentation.user_facing_groups,
    ["model_access", "model_preference"],
    "Settings Access normal-state groups",
  );
  assertDeepEqualJson(
    presentation.supporting_details,
    ["codex_cli", "gateway_navigation"],
    "Settings Access supporting details",
  );
  if (
    presentation.default_policy !==
    "real_provider_source_selected_and_default_model_and_codex_cli_first"
  ) {
    throw new Error(
      "Settings Models must show the real source, selected/default model, and Codex CLI first",
    );
  }
  if (
    presentation.details_policy !==
    "base_url_token_paths_cli_and_provider_internals_only_in_details_or_abnormal_state"
  ) {
    throw new Error(
      "Settings Access diagnostics must stay in details or abnormal states",
    );
  }
  if (
    presentation.resources_route !== "resources" ||
    presentation.resources_route_policy !==
      "local browser access, Docker WebUI, and owner-projected optional resource refs live on Resources & Connections; absent optional projections create no groups or placeholders"
  ) {
    throw new Error(
      "Settings Access must route browser and resource surfaces to Settings Resources",
    );
  }
  assertIncludesAll(
    presentation.hidden_normal_state_terms,
    [
      "repeated OPL Gateway summary lines",
      "action_available",
      "diagnose_with_doctor",
      "available",
      "CLI dry-run commands",
    ],
    "Settings Access hidden normal-state terms",
  );

  const boundary = accessPage?.resource_route_boundary;
  if (!boundary || typeof boundary !== "object") {
    throw new Error(
      "Settings Access page adapter must declare resource_route_boundary",
    );
  }
  assertDeepEqualJson(
    boundary.required_boundary_terms,
    [
      "Account & Access",
      "Resources & Connections",
      "owner-projected optional resource refs",
    ],
    "Settings Access resource route boundary terms",
  );
  if (
    boundary.display_policy !==
    "model selection stays on Models; Gateway credentials route to Account & Access; browser, resource, and deployment refs route to Settings Resources"
  ) {
    throw new Error(
      "Settings Models must route Gateway credentials and resource refs to their owning pages",
    );
  }
  if (
    boundary.optional_resource_policy !==
    "render only canonical owner-projected records with at least one resource or route ref; omit empty categories and placeholders"
  ) {
    throw new Error(
      "Settings Access resource route boundary must keep optional resources conditional",
    );
  }
  if (boundary.refs_only !== true) {
    throw new Error(
      "Settings Access resource route boundary refs_only must be true",
    );
  }
  assertIncludesAll(
    boundary.forbidden_claims,
    [
      "runtime_truth",
      "provider_implementation",
      "domain_truth",
      "domain_readiness",
      "app_release_readiness",
    ],
    "Settings Access resource route boundary forbidden claims",
  );
}

function validateSettingsOptionalResourceProjection(
  controlPlane,
  guiContract,
  pageStateMatrix,
  productProfile,
) {
  const experience =
    controlPlane?.experience_contract?.page_contracts?.resources;
  const guiPage = guiContract?.pages?.settings_resources;
  const matrixPage = pageById(pageStateMatrix, "settings_resources");
  const profileExperience =
    productProfile?.settings?.control_plane?.experience_contract?.page_contracts
      ?.resources;

  for (const [label, policy] of [
    ["Settings experience", experience?.external_resource_projection_policy],
    ["GUI Settings Resources", guiPage?.external_resource_projection_policy],
    [
      "Page-state Settings Resources",
      matrixPage?.external_resource_projection_policy,
    ],
    [
      "Product profile Settings Resources",
      profileExperience?.external_resource_projection_policy,
    ],
  ]) {
    assertDeepEqualJson(
      policy,
      expectedOptionalResourceProjectionPolicy,
      `${label} optional resource projection policy`,
    );
  }

  assertDeepEqualJson(
    experience?.conditional_groups,
    [expectedConditionalResourceGroup],
    "Settings Resources conditional groups",
  );
  assertDeepEqualJson(
    profileExperience?.conditional_groups,
    [expectedConditionalResourceGroup],
    "Product profile Settings Resources conditional groups",
  );
  assertDeepEqualJson(
    guiPage?.conditional_sections,
    [expectedConditionalResourceSection],
    "GUI Settings Resources conditional sections",
  );
  assertDeepEqualJson(
    matrixPage?.conditional_sections,
    [expectedConditionalResourceSection],
    "Page-state Settings Resources conditional sections",
  );

  const ordinaryResourceContract = JSON.stringify({
    access: controlPlane?.page_adapter_policy?.required_pages?.access,
    experience,
    guiPage,
    matrixPage,
    profileExperience,
  });
  for (const forbiddenLiteral of [
    "OPL Workspace",
    "Fabric",
    "HPC",
    "Console-managed",
  ]) {
    if (ordinaryResourceContract.includes(forbiddenLiteral)) {
      throw new Error(
        `Settings Resources must not hard-require optional platform literal ${forbiddenLiteral}`,
      );
    }
  }
}

function validateSettingsVisualQaPolicy(controlPlane) {
  const policy = controlPlane.visual_qa_policy;
  if (
    policy?.policy !==
    "settings_control_center_visual_qa_is_shell_behavior_evidence"
  ) {
    throw new Error(
      "Settings visual QA policy must describe shell behavior evidence",
    );
  }
  assertDeepEqualJson(
    policy.required_viewports,
    ["desktop", "mobile"],
    "Settings visual QA required viewports",
  );
  assertDeepEqualJson(
    policy.required_routes,
    expectedVisualQaRoutes,
    "Settings visual QA required routes",
  );
  assertDeepEqualJson(
    policy.required_secondary_routes,
    expectedVisualQaSecondaryRoutes,
    "Settings visual QA secondary routes",
  );
  assertDeepEqualJson(
    policy.required_compatibility_redirects,
    expectedVisualQaCompatibilityRedirects,
    "Settings visual QA compatibility redirects",
  );
  assertDeepEqualJson(
    policy.required_status_anchors,
    expectedVisualQaStatusAnchors,
    "Settings visual QA status anchors",
  );
  if (
    policy.evidence_manifest?.path !==
    "tests/e2e/screenshots/settings-control-center-manifest.json"
  ) {
    throw new Error(
      "Settings visual QA policy must declare the screenshot evidence manifest path",
    );
  }
  assertDeepEqualJson(
    policy.evidence_manifest?.required_fields,
    expectedVisualQaManifestFields,
    "Settings visual QA evidence manifest fields",
  );
  if (
    policy.evidence_manifest?.viewport_policy !==
      "each required route is checked at both the default desktop and narrow mobile viewports" ||
    policy.evidence_manifest?.secondary_route_policy !==
      "about is captured as the only independent secondary page" ||
    policy.evidence_manifest?.compatibility_route_policy !==
      "update, theme, local-services, and personalization are captured as redirect landing evidence on their owner route and anchor"
  ) {
    throw new Error(
      "Settings visual QA manifest must declare ordinary, secondary, and compatibility evidence policy",
    );
  }
  if (!String(policy.evidence_command ?? "").includes("E2E_SCREENSHOTS=1")) {
    throw new Error(
      "Settings visual QA policy must require screenshot evidence",
    );
  }
  if (
    policy.baseline_ref !==
      "opl-aion-shell@409dd0c3b693f1c7c93551654dfac8fb9420843d" ||
    policy.baseline_comparison_policy !==
      "same_route_final_screenshots_must_preserve_or_improve_spatial_and_typographic_hierarchy"
  ) {
    throw new Error(
      "Settings visual QA must bind same-route hierarchy comparison to the 409dd0c3 baseline",
    );
  }
  assertIncludesAll(
    policy.does_not_prove,
    [
      "release readiness",
      "packaged App readiness",
      "runtime currentness",
      "owner acceptance",
    ],
    "Settings visual QA non-release evidence boundary",
  );
}

function validateSettingsProductSystemChecklist(controlPlane) {
  const checklist = controlPlane.product_system_checklist;
  if (checklist?.schema !== "settings_product_system_checklist.v1") {
    throw new Error(
      "Settings product system checklist must use settings_product_system_checklist.v1",
    );
  }
  if (
    checklist?.purpose !==
    "plan_completion_audit_source_for_settings_control_center"
  ) {
    throw new Error(
      "Settings product system checklist must be the plan completion audit source",
    );
  }
  if (
    checklist?.completion_policy !==
    "each item is audited against fresh evidence; tests, docs, or contracts only prove the item slice they directly cover"
  ) {
    throw new Error(
      "Settings product system checklist must require fresh per-item evidence",
    );
  }
  if (
    checklist?.release_currentness_policy !==
    "installed app, notarization, running version, and release readiness remain release-owner gates and must not be inferred from Settings tests"
  ) {
    throw new Error(
      "Settings product system checklist must separate release/currentness gates from Settings tests",
    );
  }
  const items = checklist?.items ?? [];
  assertDeepEqualJson(
    items.map((item) => item.id),
    appOwnedSettingsProductSystemItemIds,
    "Settings product system checklist item ids",
  );
  const tracks = [...new Set(items.map((item) => item.track))];
  assertDeepEqualJson(
    tracks,
    appOwnedSettingsProductSystemTracks,
    "Settings product system checklist tracks",
  );
  for (const item of items) {
    if (!appOwnedSettingsProductSystemTracks.includes(item.track)) {
      throw new Error(
        `Settings product system checklist item ${item.id} has unknown track ${item.track}`,
      );
    }
    if (typeof item.goal !== "string" || item.goal.trim().length < 20) {
      throw new Error(
        `Settings product system checklist item ${item.id} must declare a concrete goal`,
      );
    }
    if (
      !Array.isArray(item.evidence_required) ||
      item.evidence_required.length < 3
    ) {
      throw new Error(
        `Settings product system checklist item ${item.id} must list at least three evidence requirements`,
      );
    }
  }
  const releaseItem = items.find(
    (item) => item.id === "installed_release_currentness",
  );
  if (releaseItem?.track !== "release_currentness") {
    throw new Error(
      "Settings installed/release currentness item must stay on the release_currentness track",
    );
  }
  assertIncludesAll(
    releaseItem?.evidence_required,
    [
      "release_currentness_policy separates this item from Settings tests",
      "visual QA and contract validators list what they do not prove",
      "release owner gate supplies any future installed or release evidence",
    ],
    "Settings release/currentness checklist evidence",
  );
  const screenshotItem = items.find((item) => item.id === "screenshot_qa");
  assertIncludesAll(
    screenshotItem?.evidence_required,
    [
      "visual_qa_policy lists ordinary and secondary routes",
      "compatibility redirects are captured as landing evidence",
      "visual QA does not prove release or currentness readiness",
    ],
    "Settings screenshot QA checklist evidence",
  );
}

function validateSettingsUpstreamIntake(controlPlane) {
  const checklist = controlPlane.upstream_intake_checklist;
  if (
    checklist?.policy !==
    "classify_aionui_settings_upstream_before_registry_or_slot_changes"
  ) {
    throw new Error(
      "Settings upstream intake checklist must classify AionUI settings upstream before registry or slot changes",
    );
  }
  assertDeepEqualJson(
    checklist?.allowed_classifications,
    appOwnedSettingsUpstreamIntakeClassifications,
    "Settings upstream intake classifications",
  );
  assertDeepEqualJson(
    Object.keys(controlPlane.upstream_intake_classification ?? {}),
    appOwnedSettingsUpstreamIntakeClassifications,
    "Settings upstream intake classification buckets",
  );
  for (const classification of appOwnedSettingsUpstreamIntakeClassifications) {
    if (
      !Array.isArray(
        controlPlane.upstream_intake_classification[classification],
      )
    ) {
      throw new Error(
        `Settings upstream intake classification ${classification} must be an array`,
      );
    }
  }
  const records = checklist?.records;
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(
      "Settings upstream intake records must be a non-empty array",
    );
  }
  const seenRecordIds = new Set();
  for (const record of records) {
    validateSettingsUpstreamIntakeRecord(record, seenRecordIds);
  }
}

function validateSettingsUpstreamIntakeRecord(record, seenRecordIds) {
  const label = `Settings upstream intake record ${record?.id ?? "<missing id>"}`;
  for (const field of [
    "id",
    "upstream_surface",
    "classification",
    "app_contract_ref",
    "route_or_slot_impact",
    "required_evidence",
    "decision_owner",
    "last_reviewed_at",
    "status",
  ]) {
    if (
      record?.[field] === undefined ||
      record?.[field] === null ||
      record?.[field] === ""
    ) {
      throw new Error(`${label} must declare ${field}`);
    }
  }
  if (seenRecordIds.has(record.id)) {
    throw new Error(`${label} id must be unique`);
  }
  seenRecordIds.add(record.id);
  if (
    !appOwnedSettingsUpstreamIntakeClassifications.includes(
      record.classification,
    )
  ) {
    throw new Error(
      `${label} classification must be accepted/adapt/redirect/reject`,
    );
  }
  if (!String(record.app_contract_ref).startsWith("contracts/")) {
    throw new Error(`${label} must bind to an App contract ref`);
  }
  if (
    !Array.isArray(record.required_evidence) ||
    record.required_evidence.length === 0
  ) {
    throw new Error(`${label} must declare required_evidence`);
  }
  if (record.decision_owner !== "one-person-lab-app") {
    throw new Error(`${label} decision_owner must be one-person-lab-app`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(record.last_reviewed_at))) {
    throw new Error(`${label} last_reviewed_at must be YYYY-MM-DD`);
  }
  if (!["active", "pending", "superseded"].includes(record.status)) {
    throw new Error(`${label} status must be active, pending, or superseded`);
  }
  const impact = record.route_or_slot_impact ?? {};
  if (["accepted", "adapt"].includes(record.classification)) {
    if (impact.host_component && impact.host_component !== "SettingsHost") {
      throw new Error(`${label} host_component must be SettingsHost`);
    }
    if (
      impact.adapter_slot &&
      impact.adapter_slot !== "SettingsShellAdapterSlot"
    ) {
      throw new Error(`${label} adapter_slot must be SettingsShellAdapterSlot`);
    }
    if (
      impact.host_component !== "SettingsHost" &&
      impact.adapter_slot !== "SettingsShellAdapterSlot" &&
      !impact.slot_id &&
      !impact.route_id
    ) {
      throw new Error(
        `${label} accepted/adapt records must bind to SettingsHost, SettingsShellAdapterSlot, route, or slot evidence`,
      );
    }
    if (impact.route_id) {
      assertKnownSettingsRoute(impact.route_id, label);
    }
    if (impact.secondary_route) {
      assertKnownSettingsRoute(impact.secondary_route, label);
    }
    if (impact.slot_id && !expectedSlotKeys.includes(impact.slot_id)) {
      throw new Error(
        `${label} references unknown Settings slot ${impact.slot_id}`,
      );
    }
    return;
  }
  if (
    !impact.legacy_redirect &&
    !impact.anchor_remap &&
    !impact.forbidden_probe &&
    !String(record.app_contract_ref).includes("#")
  ) {
    throw new Error(
      `${label} redirect/reject records must bind to a legacy redirect, anchor remap, forbidden probe, or explicit app contract ref`,
    );
  }
  if (impact.route_id) {
    assertKnownSettingsRoute(impact.route_id, label);
  }
  if (
    impact.legacy_redirect &&
    !expectedLegacyRedirects[impact.legacy_redirect]
  ) {
    throw new Error(
      `${label} references unknown legacy redirect ${impact.legacy_redirect}`,
    );
  }
  if (impact.anchor_remap && !expectedAnchorRemap[impact.anchor_remap]) {
    throw new Error(
      `${label} references unknown extension anchor ${impact.anchor_remap}`,
    );
  }
}

function validateSettingsShellAdapterSlot(adapterContract) {
  const slot =
    adapterContract?.implementation_probes
      ?.settings_control_plane_shell_adapter_slot;
  if (!slot) {
    throw new Error(
      "Active shell adapter must declare settings_control_plane_shell_adapter_slot",
    );
  }
  if (
    slot.source_ref !== settingsIaRef &&
    slot.source_ref !== settingsControlPlaneContractRef
  ) {
    throw new Error(
      "Settings shell adapter slot must point to the Settings control plane or settings_ia contract",
    );
  }
  if (slot.policy !== "behavior_level_dom_or_registry_validation_preferred") {
    throw new Error(
      "Settings shell adapter slot must prefer behavior-level DOM or registry validation",
    );
  }
  if ((slot.source_probe_policy ?? "").includes("primary")) {
    throw new Error(
      "Settings shell adapter slot must not make source-string probes the primary validation strategy",
    );
  }
  if (slot.host_component !== "SettingsHost") {
    throw new Error("Settings shell adapter slot must declare SettingsHost");
  }
  if (!slot.slots?.SettingsShellAdapterSlot) {
    throw new Error(
      "Settings shell adapter slot must declare SettingsShellAdapterSlot",
    );
  }
  assertDeepEqualJson(
    slot.required_evidence,
    expectedSettingsAdapterEvidence,
    "Settings shell adapter slot required evidence",
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

function settingsRouteResolution(
  input,
  targetId,
  route,
  routeScope,
  anchor = null,
  anchorQueryParam = null,
) {
  return {
    input,
    id: input,
    target_id: targetId,
    path: route?.path ?? "/settings/about",
    route_scope: routeScope,
    slot_id: route?.slot_id ?? "about",
    component_key: route?.component_key ?? null,
    anchor,
    anchor_query_param: anchorQueryParam,
  };
}
