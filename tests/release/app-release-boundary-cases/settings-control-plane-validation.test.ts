import { appRoot, assert, fs, path, test } from "./helpers.ts";
import { validateAppGuiProductContract } from "../../../scripts/validate-active-shell/gui-product-contract-validator.ts";
import { validatePageStateMatrix } from "../../../scripts/validate-active-shell/page-state-matrix-validator.ts";
import { validateSettingsControlPlane } from "../../../scripts/validate-active-shell/settings-control-plane-validator.ts";

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), "utf8"));
}

function contracts() {
  return {
    controlPlane: readJson("contracts/app-settings-control-plane.json"),
    guiContract: readJson("contracts/app-gui-product-contract.json"),
    pageStateMatrix: readJson("contracts/app-page-state-matrix.json"),
    productProfile: readJson("contracts/app-product-profile.json"),
    adapterContract: readJson("contracts/app-shell-adapter.json"),
  };
}

function validate(values = contracts()) {
  validateSettingsControlPlane(
    values.controlPlane,
    values.guiContract,
    values.pageStateMatrix,
    values.productProfile,
    values.adapterContract,
  );
}

function validateGui(guiContract) {
  validateAppGuiProductContract(
    guiContract,
    readJson("contracts/app-release-channel.json"),
    readJson("contracts/app-install-exposure-policy.json"),
  );
}

test("Settings product profile mirrors the control-plane page adapter claims", () => {
  const values = contracts();

  assert.deepStrictEqual(
    values.productProfile.settings.control_plane.page_adapter_policy,
    values.controlPlane.page_adapter_policy,
  );

  values.productProfile.settings.control_plane.page_adapter_policy.required_pages.gateway.renderer_entry =
    "packages/desktop/src/renderer/pages/settings/sections/GatewaySettings.tsx";
  assert.throws(
    () => validate(values),
    /Product profile Settings page adapter policy projection/,
  );
});

test("Settings optional resource groups stay owner-projected and absent by default", () => {
  const values = contracts();
  const fastFixture = readJson(
    "contracts/fixtures/opl-app-state-fast.fixture.json",
  );
  const runtimeBridge = readJson("contracts/app-runtime-bridge.json");

  assert.doesNotThrow(() => validate(values));
  assert.deepStrictEqual(
    fastFixture.app_state.settings_control_center.app_settings_read_model
      .resource_sources,
    {},
  );
  assert.equal(
    runtimeBridge.task_awareness_projection.resource_context_policy.app_role,
    "display_only_resource_context_consumer",
  );
  assert.ok(
    runtimeBridge.task_awareness_projection.resource_context_policy.optional_ref_fields.includes(
      "resource_source_refs",
    ),
  );

  const legacyLiteral = contracts();
  legacyLiteral.controlPlane.experience_contract.page_contracts.resources.primary_information.push(
    "OPL Workspace",
  );
  assert.throws(
    () => validate(legacyLiteral),
    /must not hard-require optional platform literal OPL Workspace/,
  );

  const emptyPlaceholder = contracts();
  emptyPlaceholder.guiContract.pages.settings_resources.external_resource_projection_policy.empty_projection_policy =
    "render_empty_placeholder";
  assert.throws(
    () => validate(emptyPlaceholder),
    /optional resource projection policy/,
  );

  const unconditionalGroup = contracts();
  unconditionalGroup.controlPlane.experience_contract.page_contracts.resources.conditional_groups =
    [];
  assert.throws(
    () => validate(unconditionalGroup),
    /conditional groups/,
  );
});

test("Settings contract keeps ten product pages, About as the only secondary page, and anchored compatibility routes", () => {
  const values = contracts();

  assert.doesNotThrow(() => validate(values));
  assert.deepStrictEqual(
    values.controlPlane.ordinary_routes.map((route) => route.product_page_id),
    [
      "overview",
      "gateway",
      "models",
      "workspace",
      "agents",
      "capabilities",
      "resources",
      "maintenance",
      "storage",
      "preferences",
    ],
  );
  assert.deepStrictEqual(
    values.controlPlane.ordinary_routes.map((route) => route.default_label_zh),
    [
      "概览",
      "账户与访问",
      "模型",
      "工作区",
      "智能体",
      "能力",
      "资源与连接",
      "维护",
      "数据与存储",
      "偏好",
    ],
  );
  assert.deepStrictEqual(
    values.controlPlane.secondary_pages.map((page) => page.id),
    ["about"],
  );
  assert.deepStrictEqual(
    Object.fromEntries(
      Object.entries(values.controlPlane.compatibility_redirects).map(
        ([id, redirect]) => [
          id,
          `${redirect.target_route_id}#${redirect.anchor}`,
        ],
      ),
    ),
    {
      update: "environment#updates",
      theme: "appearance#themes",
      "local-services": "environment#services",
      personalization: "workspace#personalization",
    },
  );
  assert.equal(values.controlPlane.legacy_route_redirects.about, undefined);
  assert.equal(
    values.controlPlane.legacy_route_redirects.advanced,
    "environment#diagnostics",
  );
  assert.equal(
    values.controlPlane.legacy_route_redirects.assistants,
    "capabilities#third-party",
  );
  assert.equal(
    values.guiContract.settings_navigation.settings_ia.protocols.deep_link_policy
      .unknown_route_policy,
    "redirect_to_overview_default_route",
  );
  assert.deepStrictEqual(
    values.controlPlane.aionui_custom_assistant_boundary,
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
  );
});

test("Settings validator keeps runnable package lifecycle on Agents", () => {
  const values = contracts();
  assert.doesNotThrow(() => validate(values));
  assert.doesNotThrow(() => validateGui(values.guiContract));
  assert.equal(
    values.guiContract.interaction_baseline.capability_selection
      .management_surface,
    "settings_agents",
  );

  const staleProfileRef = contracts();
  staleProfileRef.controlPlane.page_adapter_policy.required_pages.agents
    .directory_projection_surface.activation_action_contract_ref =
    "contracts/app-gui-product-contract.json#pages.settings_capabilities.agent_package_lifecycle_ux.package_projection_contract.activation_preparation_policy";
  assert.throws(
    () => validate(staleProfileRef),
    /Settings Agents directory projection.*package activation action/,
  );

  const packageManagementOnCapabilities = contracts();
  packageManagementOnCapabilities.guiContract.interaction_baseline.capability_selection.management_surface =
    "settings_capabilities";
  assert.throws(
    () => validate(packageManagementOnCapabilities),
    /Settings Agents must own Agent package and Home shortcut management/,
  );

  const missingActivationAxis = contracts();
  const agentsStatusModel =
    missingActivationAxis.controlPlane.page_adapter_policy.required_pages.agents
      .directory_projection_surface.status_model;
  agentsStatusModel.axes = agentsStatusModel.axes.filter(
    (axis) => axis !== "activation_action",
  );
  assert.throws(
    () => validate(missingActivationAxis),
    /Settings Agents status axes/,
  );
});

test("Settings Agents treats the canonical directory as discovery truth and exposes the complete ordinary-user catalog path", () => {
  const values = contracts();
  assert.doesNotThrow(() => validate(values));

  const lifecycle =
    values.guiContract.pages.settings_agents.agent_package_lifecycle_ux;
  assert.equal(
    lifecycle.directory_collection_contract.source,
    "app_state.agent_packages.directory.entries",
  );
  assert.deepStrictEqual(lifecycle.directory_collection_contract.required_entry_fields, [
    "package_id",
    "display_name",
    "publisher",
    "description",
    "tags",
    "package_role",
    "role_state",
    "trust_tier",
    "source_explanation",
    "manifest_url",
    "selected_version",
    "stable_version",
    "installed_version",
    "installed",
    "activated",
    "installability",
    "readiness",
    "exposure",
    "recommended_action",
    "recommended_action_ref",
    "available_actions",
    "authority_boundary",
  ]);
  assert.deepStrictEqual(lifecycle.canonical_action_contract.source_fields, [
    "directory.entries[].available_actions[]",
    "directory.entries[].recommended_action_ref",
  ]);
  assert.deepStrictEqual(lifecycle.canonical_action_contract.required_action_fields, [
    "action_id",
    "action_ref",
    "payload",
    "required_payload_fields",
    "confirmation_required",
  ]);
  assert.equal(
    lifecycle.canonical_action_contract.action_ref_policy,
    "action_ref must equal app_state.actions#${action_id}",
  );
  assert.equal(
    lifecycle.canonical_action_contract.required_payload_alternative_policy,
    "a required_payload_fields item containing ' or ' is satisfied when at least one named payload field is present",
  );
  assert.equal(
    lifecycle.canonical_action_contract.recommended_action_id_field,
    "directory.entries[].recommended_action",
  );
  assert.deepStrictEqual(lifecycle.readiness_profile_policy.fast_activated, {
    status: "verification_deferred",
    operational_ready: false,
    launch_allowed: false,
    verification_deferred: true,
    reason: "live_verification_deferred",
    session_launch_disposition: "degraded_JIT_activation_allowed",
  });
  assert.deepStrictEqual(lifecycle.readiness_profile_policy.full_verified, {
    status: "ready",
    operational_ready: true,
    launch_allowed: true,
    verification_deferred: false,
    reason: null,
    session_launch_disposition: "ready",
  });
  assert.deepStrictEqual(lifecycle.directory_controls.filters, [
    "package_role",
    "install_or_activation_status",
    "source",
  ]);
  assert.equal(lifecycle.directory_controls.catalog_search_is_settings_global_search, false);
  assert.ok(lifecycle.directory_controls.top_controls.includes("refresh_registry"));
  assert.ok(lifecycle.directory_controls.row_actions.includes("install"));
  assert.ok(lifecycle.directory_controls.row_actions.includes("activate"));
  assert.deepStrictEqual(lifecycle.advanced_manifest_install_contract, {
    action_id: "install_from_manifest_url",
    visibility: "advanced_only",
    payload_fields: ["manifest_url", "trust_tier"],
    trust_tier_required: true,
    default_trust_tier: null,
    missing_trust_tier_policy: "disable_submit_and_show_validation",
    registry_selected_install_affected: false,
  });
  assert.equal(
    lifecycle.workspace_activation_contract.required_payload_fields_source,
    "directory.entries[].available_actions[action_id=agent_package_activate].required_payload_fields",
  );
  assert.equal(lifecycle.workspace_activation_contract.scope_inference_allowed, false);
  assert.equal(lifecycle.workspace_activation_contract.package_id_only_payload_allowed, true);
  assert.equal(lifecycle.workspace_activation_contract.surface_scope, "settings_global_package_management_only");
  assert.equal(lifecycle.workspace_activation_contract.session_launch_authority, false);
  assert.equal(
    lifecycle.workspace_activation_contract.session_launch_contract_ref,
    "contracts/app-gui-product-contract.json#agent_package_activation_policy",
  );
  assert.deepStrictEqual(lifecycle.workspace_activation_contract.missing_workspace_policy, {
    applies_when: "unresolved_required_payload_fields_contains_target_workspace",
    enabled: false,
    reason_code: "workspace_root_not_configured",
    route: "/settings/workspace",
    anchor: "workspace",
  });
  assert.deepStrictEqual(
    lifecycle.package_projection_contract.dependent_guard_missing_policy,
    {
      disable_enabled_only_when: "dependent_guard.disable.allowed === true",
      uninstall_enabled_only_when: "dependent_guard.uninstall.allowed === true",
      missing_or_invalid_reason_code: "dependent_guard_unavailable",
      unaffected_actions: ["hide", "unhide", "enable"],
    },
  );
  assert.deepStrictEqual(
    lifecycle.package_projection_contract.launch_pretransition_reason_codes,
    ["package_activation_required", "live_verification_deferred", "use_boundary_reconciliation_ready"],
  );
  assert.equal(
    lifecycle.package_projection_contract.degraded_reason_codes.includes("live_verification_deferred"),
    true,
  );
  assert.equal(
    lifecycle.package_projection_contract.package_unavailable_reason_codes.includes("live_verification_deferred"),
    false,
  );
  assert.deepStrictEqual(lifecycle.exposure_state_contract.state_fields, ["enabled", "visibility"]);

  const directory =
    values.controlPlane.page_adapter_policy.required_pages.agents
      .directory_projection_surface;
  assert.equal(directory.directory_collection_source, "app_state.agent_packages.directory.entries");
  assert.equal(
    directory.static_metadata_overlay_source,
    "contracts/app-product-profile.json#gui.professional_agent_packages",
  );
  assert.equal(directory.workspace_path_source, "app_state.paths.workspace_root_path");
  assert.equal(directory.workspace_path_scope, "only_when_projected_activation_requires_target_workspace");
  assert.equal(directory.scope_inference_allowed, false);
  assert.equal(directory.session_launch_authority, false);

  const collectionRegression = contracts();
  collectionRegression.guiContract.pages.settings_agents.agent_package_lifecycle_ux
    .directory_collection_contract.source = "professional_agent_packages";
  assert.throws(() => validateGui(collectionRegression.guiContract), /directory entry fields|collection truth|lifecycle UX/);

  const fallbackRegression = contracts();
  fallbackRegression.guiContract.pages.settings_agents.agent_package_lifecycle_ux
    .fallback_state_surface = "app_state.modules.items[]";
  assert.throws(
    () => validateGui(fallbackRegression.guiContract),
    /must not substitute modules or static metadata/,
  );

  const scalarActionRegression = contracts();
  scalarActionRegression.guiContract.pages.settings_agents.agent_package_lifecycle_ux
    .canonical_action_contract.source_fields[1] = "directory.entries[].recommended_action";
  assert.throws(() => validateGui(scalarActionRegression.guiContract), /canonical actions|lifecycle UX/);

  const globalSearchRegression = contracts();
  globalSearchRegression.guiContract.pages.settings_agents.agent_package_lifecycle_ux
    .directory_controls.catalog_search_is_settings_global_search = true;
  assert.throws(() => validateGui(globalSearchRegression.guiContract), /catalog search|lifecycle UX/);

  const workspaceRegression = contracts();
  workspaceRegression.guiContract.pages.settings_agents.agent_package_lifecycle_ux
    .workspace_activation_contract.missing_workspace_policy.enabled = true;
  assert.throws(() => validateGui(workspaceRegression.guiContract), /workspace activation|lifecycle UX/);

  const packageIdOnlyRegression = contracts();
  packageIdOnlyRegression.guiContract.pages.settings_agents.agent_package_lifecycle_ux
    .workspace_activation_contract.package_id_only_payload_allowed = false;
  assert.throws(() => validateGui(packageIdOnlyRegression.guiContract), /workspace activation|lifecycle UX/);

  const inferredScopeRegression = contracts();
  inferredScopeRegression.controlPlane.page_adapter_policy.required_pages.agents
    .directory_projection_surface.scope_inference_allowed = true;
  assert.throws(
    () => validate(inferredScopeRegression),
    /Settings Agents directory projection.*package activation action/,
  );

  const inferredPageStatePayloadRegression = contracts();
  const agentsPage = inferredPageStatePayloadRegression.pageStateMatrix.pages.find(
    (page) => page.id === "agents",
  );
  agentsPage.must_show = agentsPage.must_show.filter(
    (item) => !item.includes("exact owner-projected activation payload"),
  );
  assert.throws(
    () => validatePageStateMatrix(
      inferredPageStatePayloadRegression.pageStateMatrix,
      inferredPageStatePayloadRegression.adapterContract,
      inferredPageStatePayloadRegression.guiContract,
    ),
    /agents must_show must include the exact owner-projected activation payload/,
  );

  const implicitTrustRegression = contracts();
  implicitTrustRegression.guiContract.pages.settings_agents.agent_package_lifecycle_ux
    .advanced_manifest_install_contract.default_trust_tier = "third_party_verified";
  assert.throws(
    () => validateGui(implicitTrustRegression.guiContract),
    /advanced manifest install trust assignment|lifecycle UX/,
  );

  const permissiveGuardRegression = contracts();
  permissiveGuardRegression.guiContract.pages.settings_agents.agent_package_lifecycle_ux
    .package_projection_contract.dependent_guard_missing_policy.disable_enabled_only_when =
    "dependent_guard.disable.allowed !== false";
  assert.throws(
    () => validateGui(permissiveGuardRegression.guiContract),
    /dependency closure readiness|lifecycle UX/,
  );

});

test("Settings Capabilities owns local MCP, image, and voice controls without Preferences duplication", () => {
  const values = contracts();
  assert.doesNotThrow(() => validate(values));
  assert.doesNotThrow(() => validateGui(values.guiContract));
  assert.deepStrictEqual(values.guiContract.pages.settings_capabilities.entity_kinds, [
    "skill",
    "plugin",
    "mcp_server",
    "image_generation",
    "voice_input",
  ]);
  assert.ok(
    values.pageStateMatrix.pages.find((page) => page.id === "capabilities")
      .required_dom.always.includes("settings-capabilities-voice-input"),
  );
  assert.equal(
    values.controlPlane.experience_contract.page_contracts.preferences.surface_rules
      .voice_input_configuration_allowed,
    false,
  );

  const missingVoiceDom = contracts();
  const capabilitiesPage = missingVoiceDom.pageStateMatrix.pages.find(
    (page) => page.id === "capabilities",
  );
  capabilitiesPage.required_dom.always = capabilitiesPage.required_dom.always.filter(
    (testid) => testid !== "settings-capabilities-voice-input",
  );
  assert.throws(() => validate(missingVoiceDom), /capabilities required DOM|Capabilities page must own local MCP, image, and voice/i);

  const preferencesVoiceOwner = contracts();
  preferencesVoiceOwner.controlPlane.experience_contract.page_contracts.preferences
    .surface_rules.voice_input_configuration_allowed = true;
  assert.throws(() => validate(preferencesVoiceOwner), /Settings Preferences surface rules/);
});

test("Settings validator rejects secondary-page and compatibility-route regressions", () => {
  const secondaryRegression = contracts();
  secondaryRegression.controlPlane.secondary_pages.push({
    id: "update",
    path: "/settings/update",
    ia_group: "maintenance",
    slot_id: "update",
    visibility: "secondary_or_deep_link",
  });
  assert.throws(() => validate(secondaryRegression), /secondary page ids/);

  const aboutRegression = contracts();
  aboutRegression.controlPlane.legacy_route_redirects.about = "advanced";
  assert.throws(
    () => validate(aboutRegression),
    /legacy redirects|independent \/settings\/about/,
  );

  const anchorRegression = contracts();
  anchorRegression.controlPlane.compatibility_redirects.theme.anchor = "theme";
  assert.throws(() => validate(anchorRegression), /compatibility redirects/);

  const assistantsRegression = contracts();
  assistantsRegression.controlPlane.legacy_route_redirects.assistants =
    "capabilities?tab=assistants#custom-assistants";
  assert.throws(
    () => validate(assistantsRegression),
    /legacy redirects|legacy assistants/,
  );

  const destructiveAssistantCleanup = contracts();
  destructiveAssistantCleanup.controlPlane.aionui_custom_assistant_boundary.underlying_user_data_deletion_policy =
    "delete_when_entry_hidden";
  assert.throws(
    () => validate(destructiveAssistantCleanup),
    /custom-assistant product and data boundary/,
  );
});

test("Settings hides unclassified extension entries without deleting extension data", () => {
  const values = contracts();

  assert.doesNotThrow(() => validate(values));
  assert.equal(
    values.controlPlane.extension_tab_policy.default_visibility,
    "hidden_until_app_classified",
  );
  assert.deepStrictEqual(
    values.controlPlane.extension_tab_policy.mount_allowlist,
    [],
  );
  assert.equal(
    values.controlPlane.extension_tab_policy.extension_data_deletion_policy,
    "never_delete_extension_data_when_hiding_or_redirecting_an_entry",
  );

  const legacyUnknownFallback = contracts();
  legacyUnknownFallback.controlPlane.extension_tab_policy.unknown_anchor =
    "treat_as_unanchored";
  assert.throws(
    () => validate(legacyUnknownFallback),
    /hide unclassified extension entries/,
  );

  const destructiveHide = contracts();
  destructiveHide.controlPlane.extension_tab_policy.extension_data_deletion_policy =
    "delete_hidden_extension_data";
  assert.throws(
    () => validate(destructiveHide),
    /preserve their data/,
  );
});

test("Settings validator rejects duplicate search, missing bilingual index data, and invalid anchors", () => {
  const duplicateSearch = contracts();
  duplicateSearch.controlPlane.experience_contract.global_search.global_entry_count = 2;
  assert.throws(() => validate(duplicateSearch), /one bilingual item-level/);

  const keyboardSearch = contracts();
  keyboardSearch.controlPlane.experience_contract.global_search.keyboard_activation_policy =
    "pointer_only";
  assert.throws(() => validate(keyboardSearch), /one bilingual item-level/);

  const missingEnglish = contracts();
  missingEnglish.controlPlane.experience_contract.search_index.entries[0].keywords_en =
    [];
  assert.throws(
    () => validate(missingEnglish),
    /indexed in Chinese and English/,
  );

  const invalidAnchor = contracts();
  invalidAnchor.controlPlane.experience_contract.search_index.entries[0].anchor =
    "missing-anchor";
  assert.throws(() => validate(invalidAnchor), /declared page anchor/);

  const changedAnchorContract = contracts();
  changedAnchorContract.controlPlane.experience_contract.page_contracts.models.required_anchors =
    ["provider-source", "model"];
  assert.throws(
    () => validate(changedAnchorContract),
    /models anchors|existing page anchor/i,
  );
});

test("Settings validator preserves workspace truth precedence and single-flight actions", () => {
  const workspaceTruth = contracts();
  workspaceTruth.controlPlane.experience_contract.page_contracts.workspace.readiness_precedence =
    "executor_mode_overrides_filesystem";
  assert.throws(
    () => validate(workspaceTruth),
    /filesystem writability and health/,
  );

  const concurrentActions = contracts();
  concurrentActions.controlPlane.state_action_policy.request_exclusivity_policy =
    "parallel_actions_allowed";
  assert.throws(() => validate(concurrentActions), /single-flight/);
});

test("Settings configuration catalog projection preserves owner, page, persistence, and secret boundaries", () => {
  const values = contracts();
  const projection =
    values.controlPlane.configuration_catalog_projection;

  assert.doesNotThrow(() => validate(values));
  assert.deepStrictEqual(projection.owner_classes, [
    "framework",
    "app_local",
    "credential_connection",
  ]);
  assert.equal(
    projection.items.some(
      (item) => item.configuration_id === "resource_connections",
    ),
    true,
  );
  assert.deepStrictEqual(
    values.productProfile.settings.control_plane
      .configuration_catalog_projection,
    projection,
  );
  const logDirectoryItem = projection.items.find(
    (item) => item.configuration_id === "log_directory",
  );
  assert.equal(
    logDirectoryItem.write_route,
    "application.setLogDirectory { path } typed IPC; the success directory value is hostLogDir, persistence happens before the live writer switch, and a switch failure rolls persistence back with a typed failure",
  );
  assert.equal(
    logDirectoryItem.verify_ref,
    "application.setLogDirectory.hostLogDir success value plus application.systemInfo.logDir readback",
  );
  assert.deepStrictEqual(
    values.controlPlane.page_adapter_policy.required_pages.workspace.log_directory,
    {
      owner_page: "workspace",
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
      webui_log_projection: "/data/logs",
      docker_volume_mapping: "OnePersonLab/data -> /data",
      docker_volume_rewire_allowed: false,
    },
  );

  const duplicateId = contracts();
  duplicateId.controlPlane.configuration_catalog_projection.items[1].stable_id =
    duplicateId.controlPlane.configuration_catalog_projection.items[0].stable_id;
  duplicateId.productProfile.settings.control_plane.configuration_catalog_projection =
    structuredClone(duplicateId.controlPlane.configuration_catalog_projection);
  assert.throws(
    () => validate(duplicateId),
    /unique stable and configuration ids/,
  );

  const copiedFrameworkValue = contracts();
  copiedFrameworkValue.controlPlane.configuration_catalog_projection.items[0].current_value =
    "/tmp/copied-runtime-truth";
  copiedFrameworkValue.productProfile.settings.control_plane.configuration_catalog_projection =
    structuredClone(
      copiedFrameworkValue.controlPlane.configuration_catalog_projection,
    );
  assert.throws(
    () => validate(copiedFrameworkValue),
    /delegate current values and action metadata/,
  );

  const credentialSecret = contracts();
  const credentialItem =
    credentialSecret.controlPlane.configuration_catalog_projection.items.find(
      (item) => item.configuration_id === "model_access_credential",
    );
  credentialItem.token = "must-not-enter-the-contract";
  credentialSecret.productProfile.settings.control_plane.configuration_catalog_projection =
    structuredClone(
      credentialSecret.controlPlane.configuration_catalog_projection,
    );
  assert.throws(
    () => validate(credentialSecret),
    /must not contain secret or current-value fields/,
  );
});

test("Settings visual QA enforces Codex quiet grouping, compact footer, and monochrome utility hierarchy", () => {
  const values = contracts();
  const visualSystem = values.controlPlane.experience_contract.visual_system;
  const visualQa =
    values.guiContract.settings_navigation.settings_ia.protocols
      .visual_qa_expectations;

  assert.doesNotThrow(() => validate(values));
  assert.deepStrictEqual(visualSystem, {
    style: "codex_quiet_control_center_with_opl_information_architecture",
    style_exclusion: "multi_hue_card_dashboard",
    baseline_shell_commit: "409dd0c3b693f1c7c93551654dfac8fb9420843d",
    baseline_comparison_policy:
      "fresh_same_route_screenshots_must_preserve_or_improve_information_hierarchy",
    card_policy: "unframed_sections_with_bounded_groups_only_for_repeated_entities_or_confirmation",
    first_viewport_spatial_group_range: { min: 2, max: 4 },
    nested_cards_allowed: false,
    page_wide_list_wall_allowed: false,
    page_sections_as_floating_cards_allowed: false,
    desktop_group_layout: "single_column_reading_lane",
    mobile_group_layout: "single_column_stack",
    icon_slot_px: 20,
    typography: {
      page_title: "20/28/600",
      card_title: "14-16/20-24/600",
      description: "13/20/400",
      supporting: "12/18/400",
    },
    status_color_semantics: {
      normal: "muted",
      warning: "orange",
      error: "red",
      action: "brand",
    },
    object_accent_policy:
      "use monochrome utility navigation icons and reserve color for typed warning error success and brand actions",
    footer_layout: "compact",
    footer_controls: [
      "gateway_account_or_settings_entry",
      "app_update_status_and_trigger",
    ],
    footer_account_entry_policy:
      "show_gateway_display_name_when_connected_else_settings_on_all_routes_and_open_account_gateway_or_overview",
    footer_update_entry_policy:
      "show_confirmed_newer_app_update_as_account_row_trailing_action_and_reuse_existing_carrier_updater_without_owning_update_truth",
    footer_theme_quick_toggle_allowed: false,
    footer_secondary_navigation_allowed: false,
    appearance_mode_values: ["system", "light", "dark"],
    appearance_mode_presentation: "three_visual_preview_cards",
    appearance_mode_preserves_theme_preset: false,
    theme_gallery_presentation: "not_exposed",
    theme_swatch_list_allowed: false,
    max_border_radius_px: 8,
    spacing_scale_px: [12, 16, 24],
    heading_density: "compact",
    primary_action_per_page_max: 1,
    normal_state_emphasis: "muted",
    exception_state_emphasis: "accent_only_when_attention_required",
    technical_details_default: "collapsed",
    letter_spacing_px: 0,
  });
  assert.deepStrictEqual(
    values.productProfile.settings.control_plane.experience_contract
      .visual_system,
    visualSystem,
  );
  assert.deepStrictEqual(visualQa.visual_character, [
    "quiet",
    "dense",
    "scannable",
  ]);
  assert.deepStrictEqual(visualQa.surface_grouping, {
    allowed_bounded_group_kinds: ["repeated_entity", "confirmation"],
    bounded_group_nesting: "none",
    page_section_card_policy:
      "ordinary_page_sections_are_unframed_heading_plus_flat_rows_with_hairline_dividers",
    first_viewport_spatial_group_range: { min: 2, max: 4 },
    page_wide_bare_divider_layout:
      "section_scoped_hairlines_allowed_no_box_per_section",
    page_wide_list_wall: "forbidden",
  });
  assert.deepStrictEqual(visualQa.footer_structure, {
    layout: "compact",
    controls: [
      "gateway_account_or_settings_entry",
      "app_update_status_and_trigger",
    ],
    account_entry:
      "gateway_display_name_when_connected_else_settings_visible_on_all_routes",
    update_entry:
      "show_confirmed_newer_app_update_as_account_row_trailing_action_and_reuse_existing_carrier_updater_without_owning_update_truth",
    theme_quick_toggle:
      "forbidden_theme_mode_lives_in_settings_preferences",
    help_navigation: "forbidden",
  });
  assert.deepStrictEqual(visualQa.theme_gallery, {
    presentation: "not_exposed",
    legacy_user_data: "preserved_not_applied",
  });
  assert.deepStrictEqual(visualQa.assertion_focus, {
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
  });
  assert.deepStrictEqual(visualQa.evidence_dimensions.required_viewports, [
    "desktop",
    "mobile",
  ]);
  assert.deepStrictEqual(visualQa.evidence_dimensions.required_color_schemes, [
    "light",
  ]);

  const sparseLayout = contracts();
  sparseLayout.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.surface_grouping.page_wide_bare_divider_layout =
    "allowed";
  assert.throws(() => validate(sparseLayout), /surface grouping/);

  const missingPageSectionCards = contracts();
  missingPageSectionCards.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.surface_grouping.page_section_card_policy =
    "forbidden";
  assert.throws(() => validate(missingPageSectionCards), /surface grouping/);

  const listWall = contracts();
  listWall.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.surface_grouping.page_wide_list_wall =
    "allowed";
  assert.throws(() => validate(listWall), /surface grouping/);

  const secondaryFooterNavigation = contracts();
  secondaryFooterNavigation.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.footer_structure.help_navigation =
    "allowed";
  assert.throws(() => validate(secondaryFooterNavigation), /footer structure/);

  const swatchList = contracts();
  swatchList.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.theme_gallery.presentation =
    "flat_swatch_list";
  assert.throws(() => validate(swatchList), /theme gallery/);

  const metricsOnly = contracts();
  metricsOnly.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.assertion_focus.radius_and_spacing_only =
    "sufficient";
  assert.throws(() => validate(metricsOnly), /assertion focus/);

  const multiHueDashboard = contracts();
  multiHueDashboard.controlPlane.experience_contract.visual_system.style_exclusion =
    "multi_hue_icons_allowed";
  assert.throws(() => validate(multiHueDashboard), /visual system/);

  const staleProfileVisualSystem = contracts();
  staleProfileVisualSystem.productProfile.settings.control_plane.experience_contract.visual_system.theme_swatch_list_allowed = true;
  assert.throws(() => validate(staleProfileVisualSystem), /visual system/);

  const multipleSelectedItems = contracts();
  multipleSelectedItems.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.sidebar_selection.selected_item_count = 2;
  assert.throws(() => validate(multipleSelectedItems), /sidebar selection/);

  const repeatedLabels = contracts();
  repeatedLabels.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.repeated_entity_layout.row_field_label_policy =
    "repeat_labels_per_row";
  assert.throws(() => validate(repeatedLabels), /repeated entity layout/);

  const uncheckedCapture = contracts();
  uncheckedCapture.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.capture_preflight.mismatch_policy =
    "capture_anyway";
  assert.throws(() => validate(uncheckedCapture), /capture preflight/);

  const staleDarkMatrix = contracts();
  staleDarkMatrix.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.evidence_dimensions.required_color_schemes =
    ["light", "dark"];
  assert.throws(() => validate(staleDarkMatrix), /evidence dimensions/);
});

test("Settings strictly separates configuration, status, action, and diagnostic surfaces", () => {
  const values = contracts();
  const experience = values.controlPlane.experience_contract;

  assert.doesNotThrow(() => validate(values));
  assert.deepStrictEqual(experience.surface_model.surface_types, [
    "configuration",
    "status",
    "action",
    "diagnostic",
  ]);
  assert.equal(
    experience.surface_model.configuration.pure_state_card_allowed,
    false,
  );
  assert.equal(
    experience.surface_model.configuration.one_time_action_allowed,
    false,
  );
  assert.equal(experience.surface_model.status.standalone_card_allowed, false);
  assert.equal(experience.surface_model.action.persistent_value_allowed, false);
  assert.equal(
    experience.surface_model.diagnostic.ordinary_page_inline_allowed,
    false,
  );
  assert.equal(
    values.controlPlane.state_action_policy.diagnostic_policy,
    "diagnostic_surfaces_are_read_only_and_must_not_mount_apply_repair_rollback_install_uninstall_or_persistent_setting_controls",
  );
  assert.deepStrictEqual(
    values.controlPlane.state_action_policy.status_vocabulary,
    [
      "checking",
      "not_checked",
      "not_applicable",
      "ready",
      "needs_attention",
      "failed",
    ],
  );
  for (const page of Object.values(experience.page_contracts)) {
    assert.deepStrictEqual(Object.keys(page.surface_inventory), [
      "configuration",
      "status",
      "action",
      "diagnostic",
    ]);
  }
  assert.equal(
    experience.page_contracts.maintenance.surface_inventory.configuration.length,
    1,
  );
  assert.equal(
    experience.page_contracts.maintenance.surface_inventory.configuration[0]
      .id,
    "update_channel",
  );
  assert.ok(
    experience.page_contracts.maintenance.surface_inventory.action.length > 0,
  );
  assert.equal(
    experience.page_contracts.storage.surface_inventory.configuration.length,
    0,
  );
  assert.ok(
    experience.page_contracts.workspace.surface_inventory.configuration.some(
      (surface) => surface.id === "log_directory",
    ),
  );
  assert.ok(experience.page_contracts.storage.surface_inventory.action.length > 0);
  assert.ok(
    experience.page_contracts.storage.surface_inventory.diagnostic.some(
      (surface) => surface.id === "storage_restore_probe",
    ),
  );
  assert.equal(experience.page_contracts.advanced, undefined);
  assert.equal(
    experience.page_contracts.maintenance.surface_rules.working_path_owner,
    "Framework and raw paths live only in Maintenance diagnostics",
  );
  assert.deepStrictEqual(experience.page_contracts.gateway.surface_rules, {
    content_group_presentation: "single_unframed_content_group",
    account_container_border_count: 0,
    metrics_container_border_count: 0,
    metric_cell_divider_count: 0,
    footer_border_count: 0,
    stale_error_presentation: "inline_status_text_without_banner_frame",
  });
  assert.equal(
    experience.page_contracts.workspace.surface_rules.workspace_card_count,
    0,
  );
  assert.equal(
    experience.page_contracts.workspace.surface_rules.location_presentation,
    "one unframed File locations group with two equal rows for workspace and desktop logs",
  );
  assert.equal(
    experience.page_contracts.workspace.surface_rules.responsive_row_policy,
    "container_width_below_620px_stacks_copy_status_and_actions_without_word_breaking_paths",
  );
  assert.equal(
    experience.page_contracts.workspace.surface_rules.personalization_presentation,
    "unframed_field_groups_with_section_hairlines_no_nested_cards",
  );
  assert.deepStrictEqual(
    experience.page_contracts.preferences.surface_rules.builtin_theme_ids,
    [],
  );
  assert.deepStrictEqual(
    experience.page_contracts.preferences.surface_rules.appearance_mode_values,
    ["system", "light", "dark"],
  );
  assert.equal(
    experience.page_contracts.preferences.surface_rules.full_width_group_count,
    3,
  );
  assert.equal(
    experience.page_contracts.preferences.surface_inventory.diagnostic.length,
    0,
  );
  assert.equal(
    experience.page_contracts.workspace.first_viewport_groups.includes(
      "personalization",
    ),
    true,
  );
  assert.equal(
    experience.page_contracts.preferences.first_viewport_groups.includes(
      "personalization",
    ),
    false,
  );
  assert.equal(
    experience.page_contracts.workspace.surface_rules
      .personalization_changes_apply_to,
    "next_new_conversation",
  );
  assert.equal(
    experience.page_contracts.storage.surface_rules
      .pure_usage_summary_card_allowed,
    false,
  );
  assert.equal(
    experience.page_contracts.storage.surface_rules.zero_byte_policy,
    "show_nothing_to_clean_and_hide_actions",
  );
  assert.equal(
    experience.page_contracts.storage.surface_rules.cleanup_action_policy,
    "single_progressive_action_preview_then_confirm",
  );
  assert.equal(
    experience.page_contracts.storage.surface_rules.conversation_archive_policy,
    "archive_receipt_is_required_before_delete_and_the_same_archive_exposes_a_confirmed_restore_action",
  );
  assert.equal(
    experience.page_contracts.storage.surface_rules.restore_collision_policy,
    "never_overwrite_an_existing_conversation_without_an_explicit_collision_decision",
  );
  assert.equal(
    experience.page_contracts.agents.management_discoverability
      .raw_source_fallback_allowed,
    false,
  );

  const standaloneStatus = contracts();
  standaloneStatus.controlPlane.experience_contract.surface_model.status.standalone_card_allowed =
    true;
  assert.throws(() => validate(standaloneStatus), /pure status/);

  const inlineDiagnostics = contracts();
  inlineDiagnostics.controlPlane.experience_contract.surface_model.diagnostic.ordinary_page_inline_allowed =
    true;
  assert.throws(() => validate(inlineDiagnostics), /diagnostics must open explicitly/);

  const legacySurfaceType = contracts();
  legacySurfaceType.controlPlane.experience_contract.surface_model.status_row = {};
  assert.throws(() => validate(legacySurfaceType), /strict four-surface model/);

  const missingInventoryType = contracts();
  delete missingInventoryType.controlPlane.experience_contract.page_contracts.models
    .surface_inventory.action;
  assert.throws(() => validate(missingInventoryType), /surface inventory types/);

  const mixedSurface = contracts();
  mixedSurface.controlPlane.experience_contract.page_contracts.workspace
    .surface_inventory.status.push({ id: "workspace_selection", owner: "workspace" });
  assert.throws(() => validate(mixedSurface), /cannot mix surface types/);

  const wrongOwner = contracts();
  wrongOwner.controlPlane.experience_contract.page_contracts.about.surface_inventory.status[0].owner =
    "maintenance";
  assert.throws(() => validate(wrongOwner), /page ownership/);

  const maintenanceAsSetting = contracts();
  maintenanceAsSetting.controlPlane.experience_contract.page_contracts.maintenance.surface_inventory.configuration.push(
    {
      id: "run_repair_as_setting",
      owner: "maintenance",
    },
  );
  assert.throws(
    () => validate(maintenanceAsSetting),
    /update channel|maintenance operations remain actions/,
  );

  const writableDiagnostics = contracts();
  writableDiagnostics.controlPlane.experience_contract.page_contracts.maintenance.surface_rules.diagnostic_mutation_controls_allowed =
    true;
  assert.throws(() => validate(writableDiagnostics), /Maintenance surface rules/);
});

test("Settings rejects a framed Gateway account surface", () => {
  const framedGateway = contracts();
  framedGateway.controlPlane.experience_contract.page_contracts.gateway.surface_rules.footer_border_count = 1;
  assert.throws(() => validate(framedGateway), /Gateway flat content rules/);
});

test("Settings keeps Gateway ownership, cached storage freshness, managed dependencies, and non-blocking startup checks", () => {
  const values = contracts();
  const pages = values.controlPlane.experience_contract.page_contracts;
  const aboutPage = values.pageStateMatrix.pages.find((page) => page.id === "about");
  const startup = values.controlPlane.state_action_policy.startup_performance_policy;

  assert.doesNotThrow(() => validate(values));
  assert.equal(
    pages.resources.connection_filter_policy,
    "exclude the built-in OPL Gateway connection and count; show only canonical owner-projected external connections with at least one resource or route ref",
  );
  assert.equal(
    pages.storage.surface_rules.inventory_initial_state,
    "last_persisted_snapshot_or_loading_placeholder_never_synthetic_zero_bytes",
  );
  assert.deepStrictEqual(pages.storage.surface_rules.inventory_freshness_fields, [
    "observed_at",
    "scan_duration_ms",
    "stale",
  ]);
  assert.equal(
    pages.storage.surface_rules.inventory_event,
    "local-data-lifecycle.inventory-updated",
  );
  assert.equal(
    pages.maintenance.surface_rules.managed_dependency_primary_visibility,
    "managed_dependency_summary_is_visible_without_opening_diagnostics",
  );
  const managedDependencies =
    values.controlPlane.page_adapter_policy.required_pages.environment
      .managed_dependency_summary;
  assert.equal(
    managedDependencies.source_ref,
    "opl update status --json#managed_update.components[component_id=opl_base].current.dependency_catalog.dependencies[]",
  );
  assert.deepStrictEqual(managedDependencies.required_ids, [
    "codex-cli",
    "temporal-runtime",
    "temporal-system-cli",
  ]);
  assert.deepStrictEqual(managedDependencies.required_fields, [
    "dependency_id",
    "dependency_kind",
    "installed",
    "version",
    "latest_version",
    "currentness",
    "ownership",
    "update_policy",
    "update_mode",
    "update_action",
    "activation_policy",
    "binary_path",
    "status",
  ]);
  assert.deepStrictEqual(managedDependencies.optional_fields, ["real_path"]);
  assert.deepStrictEqual(managedDependencies.path_identity_precedence, [
    "real_path",
    "binary_path",
  ]);
  assert.deepStrictEqual(
    managedDependencies.external_installations_policy.optional_fields,
    ["real_path"],
  );
  assert.equal(aboutPage.updater_state_policy.mount_check, false);
  assert.equal(startup.cold_budget_ms, 1500);
  assert.equal(startup.warm_budget_ms, 1500);
  assert.equal(
    startup.first_window_failure_policy,
    "render_recoverable_nonblank_shell_never_fatal_or_blank_candidate_window",
  );
  assert.deepStrictEqual(startup.timing_milestones, [
    "stable_shell_first_paint",
    "background_hydration_complete",
  ]);
  assert.equal(
    startup.framework_projection_claim,
    "not_proven_by_ui_contract_or_shell_gate",
  );
  assert.equal(startup.startup_projection_payload_budget_bytes, 262144);
  assert.deepStrictEqual(startup.lazy_drilldown_routes, [
    "agents",
    "capabilities",
    "storage",
    "about",
  ]);
  assert.equal(startup.single_flight_background_refresh, true);
  assert.equal(startup.global_refresh_on_route_mount, false);

  const gatewayCountRegression = contracts();
  gatewayCountRegression.controlPlane.experience_contract.page_contracts.resources.connection_filter_policy =
    "show_all_connections_and_count";
  assert.throws(
    () => validate(gatewayCountRegression),
    /exclude the built-in OPL Gateway connection and count/,
  );

  const syntheticZero = contracts();
  syntheticZero.controlPlane.experience_contract.page_contracts.storage.surface_rules.inventory_initial_state =
    "zero_bytes_until_scan_completes";
  assert.throws(() => validate(syntheticZero), /Storage surface rules/);

  const missingFreshness = contracts();
  missingFreshness.controlPlane.experience_contract.page_contracts.storage.surface_rules.inventory_freshness_fields =
    ["observed_at", "stale"];
  assert.throws(() => validate(missingFreshness), /Storage surface rules/);

  const missingPushEvent = contracts();
  missingPushEvent.controlPlane.experience_contract.page_contracts.storage.surface_rules.inventory_event =
    "none";
  assert.throws(() => validate(missingPushEvent), /Storage surface rules/);

  const hiddenManagedDependencies = contracts();
  hiddenManagedDependencies.controlPlane.experience_contract.page_contracts.maintenance.surface_rules.managed_dependency_primary_visibility =
    "diagnostics_only";
  assert.throws(
    () => validate(hiddenManagedDependencies),
    /Maintenance surface rules/,
  );

  const checkOnAboutMount = contracts();
  checkOnAboutMount.pageStateMatrix.pages.find(
    (page) => page.id === "about",
  ).updater_state_policy.mount_check = true;
  assert.throws(
    () => validate(checkOnAboutMount),
    /About updater state policy/,
  );

  const blockingStartup = contracts();
  blockingStartup.controlPlane.state_action_policy.startup_performance_policy.first_window_blocking_policy =
    "wait_for_complete_fast_state";
  assert.throws(
    () => validate(blockingStartup),
    /Settings startup performance policy/,
  );

  const oversizedStartup = contracts();
  oversizedStartup.pageStateMatrix.settings_startup_performance_policy.startup_projection_payload_budget_bytes =
    2097152;
  assert.throws(
    () => validate(oversizedStartup),
    /Settings page-state startup performance policy/,
  );
});

test("Settings keeps one desktop App updater source, WebUI fallback, independent attention, and current-only repair", () => {
  const values = contracts();
  assert.doesNotThrow(() => validate(values));

  const updaterPolicy =
    values.guiContract.framework_surfaces.managed_update_plane
      .app_update_state_policy;
  const repairPolicy =
    values.guiContract.framework_surfaces.managed_update_plane
      .repair_availability_policy;
  const policyRef =
    "contracts/app-gui-product-contract.json#framework_surfaces.managed_update_plane.app_update_state_policy";
  const repairPolicyRef =
    "contracts/app-gui-product-contract.json#framework_surfaces.managed_update_plane.repair_availability_policy";
  const webuiFallback =
    "opl app state --profile fast --json#managed_update.components[component_id=opl_app]";

  assert.deepStrictEqual(updaterPolicy.desktop.consumers, [
    "about",
    "maintenance",
    "settings_footer",
  ]);
  assert.equal(updaterPolicy.desktop.mount_check, false);
  assert.deepStrictEqual(updaterPolicy.desktop.status_values, [
    "not_checked",
    "checking",
    "not-available",
    "available",
    "downloading",
    "downloaded",
    "error",
    "cancelled",
  ]);
  assert.deepStrictEqual(updaterPolicy.desktop.attention_states, [
    "available",
    "downloading",
    "downloaded",
    "error",
  ]);
  assert.equal(updaterPolicy.webui.fallback_source, webuiFallback);
  assert.equal(updaterPolicy.attention_accounting.independent, true);
  assert.equal(
    updaterPolicy.attention_accounting.aggregation,
    "runtime_service_attention_count_plus_one_when_app_update_attention_is_true",
  );
  assert.deepStrictEqual(
    values.controlPlane.app_update_state_policy,
    updaterPolicy,
  );
  assert.deepStrictEqual(
    values.productProfile.settings.control_plane.app_update_state_policy,
    updaterPolicy,
  );

  const guiFooter = values.guiContract.settings_navigation.footer_update_entry;
  const matrixFooter =
    values.pageStateMatrix.settings_shell_navigation.footer_update_entry;
  for (const footer of [guiFooter, matrixFooter]) {
    assert.equal(
      footer.availability_source,
      "single_main_process_updater_state_store",
    );
    assert.equal(footer.webui_fallback_source, webuiFallback);
    assert.equal(footer.app_update_state_policy_ref, policyRef);
  }
  assert.equal(
    values.guiContract.pages.settings_environment.app_update_state_policy_ref,
    policyRef,
  );
  assert.equal(
    values.pageStateMatrix.pages.find((page) => page.id === "environment")
      .app_update_state_policy_ref,
    policyRef,
  );

  assert.deepStrictEqual(
    values.controlPlane.managed_update_repair_availability_policy,
    repairPolicy,
  );
  assert.equal(repairPolicy.historical_receipt_role, "diagnostics_only");
  assert.equal(
    repairPolicy.historical_receipt_may_activate_current_repair,
    false,
  );
  assert.equal(
    values.controlPlane.experience_contract.page_contracts.maintenance
      .managed_update_repair_availability_policy_ref,
    repairPolicyRef,
  );

  const managedFooterRegression = contracts();
  managedFooterRegression.guiContract.settings_navigation.footer_update_entry.availability_source =
    "managed_update_plane.components[component_id=opl_app]";
  assert.throws(
    () => validate(managedFooterRegression),
    /Settings footer.*shared desktop updater store/,
  );

  const missingUpdaterState = contracts();
  missingUpdaterState.guiContract.framework_surfaces.managed_update_plane.app_update_state_policy.desktop.status_values =
    ["not_checked", "checking", "not-available", "available"];
  assert.throws(
    () => validate(missingUpdaterState),
    /shared App update state policy/,
  );

  const coupledAttention = contracts();
  coupledAttention.controlPlane.app_update_state_policy.attention_accounting.independent = false;
  assert.throws(() => validate(coupledAttention), /App update state policy/);

  const mountCheck = contracts();
  mountCheck.productProfile.settings.control_plane.app_update_state_policy.desktop.mount_check = true;
  assert.throws(
    () => validate(mountCheck),
    /Product profile App update state policy projection/,
  );

  const historicalReceiptRepair = contracts();
  historicalReceiptRepair.guiContract.framework_surfaces.managed_update_plane.repair_availability_policy.historical_receipt_may_activate_current_repair = true;
  assert.throws(
    () => validate(historicalReceiptRepair),
    /managed-update repair availability policy/,
  );

  const binaryPathFirst = contracts();
  binaryPathFirst.controlPlane.page_adapter_policy.required_pages.environment.managed_dependency_summary.path_identity_precedence =
    ["binary_path", "real_path"];
  assert.throws(() => validate(binaryPathFirst), /managed dependency summary/);
});

test("Settings validator rejects page-state DOM and search-entry drift", () => {
  const values = contracts();
  const overview = values.pageStateMatrix.pages.find(
    (page) => page.id === "settings_general",
  );
  overview.required_dom.always = ["settings-page-overview"];
  assert.throws(() => validate(values), /required DOM/);

  const searchValues = contracts();
  const access = searchValues.pageStateMatrix.pages.find(
    (page) => page.id === "access",
  );
  access.search_entry_ids = ["models.model"];
  assert.throws(() => validate(searchValues), /search entries/);

  const resourceValues = contracts();
  resourceValues.guiContract.pages.settings_resources.action_behavior.dry_run_boundary.role =
    "completion";
  assert.throws(() => validate(resourceValues), /Resources action behavior/);

  const browserValues = contracts();
  browserValues.controlPlane.experience_contract.page_contracts.resources.browser_access_entry.visibility =
    "hidden";
  assert.throws(() => validate(browserValues), /Resources browser entry/);

  const flatFirstViewport = contracts();
  flatFirstViewport.controlPlane.experience_contract.page_contracts.overview.first_viewport_groups =
    [];
  assert.throws(
    () => validate(flatFirstViewport),
    /one to four distinct first-viewport groups/,
  );

  const assistantValues = contracts();
  assistantValues.pageStateMatrix.pages
    .find((page) => page.id === "capabilities")
    .tab_contract.tab_order.push("assistants");
  assert.throws(
    () => validate(assistantValues),
    /Capabilities source-group tab contract/,
  );
});

test("Settings binds flat visual repair and complete Temporal maintenance to all App authority layers", () => {
  const values = contracts();
  assert.doesNotThrow(() => validate(values));

  const guiPages = values.guiContract.pages;
  const experiencePages = values.controlPlane.experience_contract.page_contracts;
  const pageById = (id: string) =>
    values.pageStateMatrix.pages.find((page) => page.id === id);

  assert.equal(
    guiPages.settings_general.background_services_summary.dependency_role,
    "required_for_complete_opl_durable_workflow",
  );
  const expectedTemporalComponents = [
    "temporal_server",
    "temporal_worker",
    "temporal_scheduler",
  ];
  assert.deepStrictEqual(
    guiPages.settings_general.background_services_summary.visible_components,
    expectedTemporalComponents,
  );
  assert.deepStrictEqual(
    experiencePages.overview.background_services_summary.visible_components,
    expectedTemporalComponents,
  );
  assert.match(
    experiencePages.overview.background_services_summary.projection_policy,
    /must_never_be_inferred_from_provider_ready/,
  );
  assert.match(
    experiencePages.overview.background_services_summary.projection_policy,
    /take_precedence_over_aggregate_provider_status/,
  );
  assert.ok(
    guiPages.settings_general.must_not_show.some((item: string) =>
      item.includes("raw attention_needed"),
    ),
  );
  assert.equal(
    pageById("settings_general").background_services_summary.attention_route,
    "/settings/environment#services",
  );
  assert.deepStrictEqual(
    pageById("settings_general").required_dom.always.filter((id: string) =>
      id.startsWith("settings-overview-temporal-"),
    ),
    [
      "settings-overview-temporal-server",
      "settings-overview-temporal-worker",
      "settings-overview-temporal-scheduler",
    ],
  );

  const guiTemporal = guiPages.settings_environment.temporal_maintenance_contract;
  const controlTemporal = experiencePages.maintenance.temporal_service_management;
  const pageTemporal = pageById("environment").temporal_maintenance_contract;
  assert.deepStrictEqual(guiTemporal.visible_components, expectedTemporalComponents);
  assert.deepStrictEqual(controlTemporal.visible_components, expectedTemporalComponents);
  assert.deepStrictEqual(pageTemporal.visible_components, expectedTemporalComponents);
  assert.deepStrictEqual(guiTemporal.post_action_readback.success_requires, [
    "service_ready_true",
    "service_supervisor_ready_true_when_required",
    "worker_ready_true",
    "scheduler_ready_true",
    "no_error",
    "fresh_observation",
  ]);
  assert.match(guiTemporal.scheduler_status_source, /details\.scheduler/);
  assert.match(guiTemporal.component_projection_policy, /explicit_component_fields/);
  assert.match(guiTemporal.component_projection_policy, /take_precedence_over_aggregate_provider_status/);
  assert.equal(
    guiTemporal.service_supervisor_policy.state_source,
    "app_state.provider.temporal.details.worker_readiness.temporal_service_lifecycle.supervisor",
  );
  assert.deepStrictEqual(guiTemporal.service_supervisor_policy.required_summary_fields, [
    "supported",
    "applicable",
    "required",
    "installed",
    "loaded",
    "ready",
    "observed_at",
    "error",
  ]);
  assert.deepStrictEqual(guiTemporal.service_supervisor_policy.login_reconciliation_order, [
    "temporal_service_supervisor",
    "temporal_worker_supervisor",
    "temporal_scheduler",
  ]);
  assert.deepStrictEqual(guiTemporal.service_supervisor_policy.platform_scope.required_on, [
    "desktop_macos_local_managed_service",
  ]);
  assert.equal(
    guiTemporal.service_supervisor_policy.persistent_store_policy.default_database_path,
    "${HOME}/Library/Application Support/OPL/state/family-runtime/temporal-server/temporal.sqlite",
  );
  assert.equal(
    controlTemporal.success_policy,
    "service_ready_and_required_platform_supervisor_ready_and_worker_ready_and_scheduler_ready_and_fresh_no_error_readback_only",
  );
  assert.equal(pageTemporal.success_policy, controlTemporal.success_policy);
  const expectedActionIds = {
    detect: [
      "provider_service_status",
      "provider_scheduler_status",
      "provider_worker_status",
    ],
    install_or_configure: [
      "provider_service_start",
      "provider_scheduler_install",
    ],
    start: ["provider_service_start", "provider_worker_start"],
    restart: ["provider_service_restart", "provider_worker_restart"],
    run_now: ["provider_scheduler_trigger"],
  };
  assert.deepStrictEqual(controlTemporal.action_ids, expectedActionIds);
  assert.deepStrictEqual(pageTemporal.action_ids, expectedActionIds);
  assert.deepStrictEqual(guiTemporal.action_roles.detect.action_ids, expectedActionIds.detect);
  assert.deepStrictEqual(guiTemporal.action_roles.start.action_ids, expectedActionIds.start);
  assert.deepStrictEqual(guiTemporal.action_roles.restart.action_ids, expectedActionIds.restart);
  assert.deepStrictEqual(guiTemporal.action_roles.run_now.action_ids, expectedActionIds.run_now);
  assert.equal(
    guiTemporal.post_action_readback.execution,
    "single_force_fresh_fast_app_state_load",
  );
  assert.match(
    guiTemporal.post_action_readback.component_readback_semantics,
    /explicit_temporal_server_worker_scheduler_component_readback/,
  );
  assert.deepStrictEqual(guiTemporal.post_action_readback.component_field_paths, {
    server: "app_state.provider.temporal.details.worker_readiness.service_ready",
    server_supervisor:
      "app_state.provider.temporal.details.worker_readiness.temporal_service_lifecycle.supervisor.ready",
    worker: "app_state.provider.temporal.details.worker_readiness.worker_ready",
    scheduler: "app_state.provider.temporal.details.scheduler.ready",
  });
  assert.equal(guiTemporal.post_action_readback.ordinary_and_post_action_readback_command_count, 1);
  assert.equal(guiTemporal.post_action_readback.shell_must_not_fan_out_delegated_status_cli, true);
  assert.equal(
    guiTemporal.post_action_readback.manual_component_check_policy,
    "explicit_user_diagnostic_only_not_final_state_source",
  );
  assert.match(guiTemporal.post_action_readback.legacy_or_aggregate_ready_policy, /must_not_infer_component_ready/);
  assert.deepStrictEqual(guiTemporal.post_action_readback.manual_component_check_action_ids, [
    "provider_service_status",
    "provider_scheduler_status",
    "provider_worker_status",
  ]);
  assert.equal(
    controlTemporal.mutation_readback,
    "single_force_fresh_fast_app_state_executes_and_projects_temporal_server_worker_scheduler_component_readback",
  );
  assert.equal(pageTemporal.mutation_readback, controlTemporal.mutation_readback);
  assert.equal(guiTemporal.post_action_readback.freshness_required, true);
  assert.match(guiTemporal.failure_semantics, /never_route_to_settings_sync_capabilities/);
  assert.equal(
    guiTemporal.worker_mutation_guard_policy.environment_bypass_guidance_allowed,
    false,
  );
  assert.deepStrictEqual(
    guiTemporal.worker_mutation_guard_policy.allowed_next_steps,
    [
      "switch_to_managed_runtime",
      "explicitly_enable_authorized_developer_maintenance",
    ],
  );
  assert.ok(
    experiencePages.maintenance.required_dom.always.includes(
      "settings-maintenance-temporal-server",
    ),
  );
  assert.ok(
    experiencePages.maintenance.required_dom.always.includes(
      "settings-maintenance-temporal-worker",
    ),
  );
  assert.ok(
    experiencePages.maintenance.required_dom.always.includes(
      "settings-maintenance-temporal-scheduler",
    ),
  );

  assert.equal(
    guiPages.settings_gateway.opl_gateway_account.disconnect_placement,
    "identity_row_trailing_adjacent_to_display_name_email_and_connection_status",
  );
  assert.equal(
    experiencePages.gateway.gateway_account_surface
      .disconnect_detached_footer_or_page_edge_allowed,
    false,
  );
  assert.equal(
    pageById("gateway").opl_gateway_account.disconnect_placement,
    "identity_row_trailing_adjacent_to_display_name_email_and_connection_status",
  );

  assert.equal(
    guiPages.settings_capabilities.surface_layout_contract
      .nested_card_or_gray_block_allowed,
    false,
  );
  assert.equal(
    experiencePages.resources.layout_policy.nested_card_or_border_wall_allowed,
    false,
  );
  assert.equal(
    pageById("environment").ordinary_layout_policy
      .nested_card_or_border_wall_allowed,
    false,
  );

  const storageVisual = {
    icon_size_px: 16,
    icon_slot_px: 20,
    icon_color: "currentColor",
    icon_background: "transparent_none",
    icon_label_gap_px: 8,
    alignment: "icon_slot_and_label_share_one_vertical_centerline",
    contrast_policy: "button_foreground_color_applies_to_icon_and_label_together",
  };
  assert.deepStrictEqual(experiencePages.storage.action_visual_policy, storageVisual);
  assert.deepStrictEqual(pageById("storage").action_visual_policy, storageVisual);
  assert.deepStrictEqual(
    Object.fromEntries(
      Object.entries(guiPages.settings_storage.action_visual_policy).filter(
        ([key]) => key !== "applies_to",
      ),
    ),
    storageVisual,
  );
  const ownerStorage = guiPages.settings_storage.owner_storage_projections;
  assert.deepStrictEqual(ownerStorage.sections, ['agent_package_store', 'webui_data_volume']);
  assert.equal(ownerStorage.missing_projection_policy, 'fail_open_keep_shell_owned_categories_available');
  assert.equal(ownerStorage.agent_package_store.owner_route, '/settings/agents');
  assert.equal(ownerStorage.agent_package_store.direct_storage_mutation_allowed, false);
  assert.equal(ownerStorage.webui_data_volume.generic_docker_prune_allowed, false);
  assert.equal(ownerStorage.webui_data_volume.shell_direct_path_delete_allowed, false);
  assert.equal(
    values.controlPlane.product_system_checklist.items.some((entry) => entry.id === 'docker_storage_projection'),
    false,
  );
  assert.equal(
    values.controlPlane.product_system_checklist.items.some((entry) => entry.id === 'owner_storage_projection'),
    true,
  );

  const componentAudit = values.controlPlane.visual_qa_policy.component_audit;
  assert.deepStrictEqual(componentAudit.required_color_schemes, ["light", "dark"]);
  assert.ok(componentAudit.required_checks.includes("no_nested_card_or_border_wall"));
  assert.equal(
    componentAudit.acceptance,
    "fresh_same_cohort_source_DOM_and_installed_pixel_review",
  );
});
