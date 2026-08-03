import {
  appOwnedOfficialProfileRestoreAction,
  appOwnedStorageCarrierBehavior,
  appOwnedWebuiDataVolumeHostActionAbiRef,
  appOwnedWebuiDataVolumeHostActionCapabilityId,
  appRoot,
  assert,
  contracts,
  fs,
  path,
  readJson,
  test,
  validate,
  validateGui,
  validatePageStateMatrix,
} from "./fixtures.ts";

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
test("Settings keeps a compact background-task summary while Service Status owns Temporal detail", () => {
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
    guiPages.settings_general.background_services_summary.detail_components,
    expectedTemporalComponents,
  );
  assert.deepStrictEqual(
    experiencePages.overview.background_services_summary.detail_components,
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
      id === "settings-overview-background-tasks",
    ),
    ["settings-overview-background-tasks"],
  );
  assert.equal(
    experiencePages.overview.background_services_summary
      .component_detail_visibility,
    "service_status_destination_only",
  );

  const guiTemporal = guiPages.settings_environment.temporal_maintenance_contract;
  const controlTemporal = experiencePages.maintenance.temporal_service_management;
  const pageTemporal = pageById("environment").temporal_maintenance_contract;
  const temporalMentalModel = guiTemporal.user_mental_model;
  assert.deepStrictEqual(guiTemporal.visible_components, expectedTemporalComponents);
  assert.deepStrictEqual(controlTemporal.visible_components, expectedTemporalComponents);
  assert.deepStrictEqual(pageTemporal.visible_components, expectedTemporalComponents);
  assert.deepStrictEqual(controlTemporal.user_mental_model, temporalMentalModel);
  assert.equal(
    pageById("environment").temporal_service_user_mental_model_ref,
    "contracts/app-gui-product-contract.json#pages.settings_environment.temporal_maintenance_contract.user_mental_model",
  );
  assert.equal(
    temporalMentalModel.component_labels.temporal_server.label_zh,
    "Temporal 基础服务",
  );
  assert.equal(
    temporalMentalModel.component_labels.temporal_worker.label_zh,
    "OPL 任务执行器",
  );
  assert.equal(
    temporalMentalModel.component_labels.temporal_scheduler.label_zh,
    "周期计划",
  );
  assert.match(
    temporalMentalModel.component_labels.temporal_scheduler.role,
    /not_a_second_scheduler_service/,
  );
  assert.match(
    temporalMentalModel.causal_blocking_policy,
    /waiting_for_the_named_upstream_not_generic_attention/,
  );
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
  const genericAttention = contracts();
  genericAttention.controlPlane.experience_contract.page_contracts.maintenance.temporal_service_management.user_mental_model.causal_blocking_policy =
    "repeat_generic_attention_for_every_component";
  assert.throws(
    () => validate(genericAttention),
    /Temporal service user mental model/,
  );
  assert.ok(
    experiencePages.maintenance.destination_dom.runtime_services.includes(
      "settings-maintenance-temporal-server",
    ),
  );
  assert.ok(
    experiencePages.maintenance.destination_dom.runtime_services.includes(
      "settings-maintenance-temporal-worker",
    ),
  );
  assert.ok(
    experiencePages.maintenance.destination_dom.runtime_services.includes(
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
    presentation: "text_only_command_buttons",
    leading_or_trailing_decorative_icon: "forbidden",
    icon_only_exception:
      "compact_refresh_or_row_utility_with_accessible_name_and_tooltip",
  };
  assert.deepStrictEqual(experiencePages.storage.action_visual_policy, storageVisual);
  assert.deepStrictEqual(pageById("storage").action_visual_policy, storageVisual);
  assert.deepStrictEqual(guiPages.settings_storage.action_visual_policy, storageVisual);
  const cleanupPreviewInteraction = {
    presentation: 'modal_item_selector_before_confirmation',
    required_summary_fields: [
      'category_total_bytes',
      'candidate_count',
      'candidate_bytes',
      'selected_bytes',
      'retained_bytes',
      'retained_reason',
    ],
    candidate_presentation: {
      selection: 'checkbox_per_candidate_default_selected',
      visible_fields: ['friendly_name', 'bytes', 'localized_reason'],
      raw_path: 'collapsed_technical_detail_only',
    },
    inventory_composition_presentation: {
      source: 'same_inventory_snapshot_as_category_total',
      visible_fields: ['root_friendly_name', 'bytes', 'cleanup_boundary', 'localized_reason'],
      boundary_states: ['covered_by_this_cleanup', 'reported_only_not_cleanable_here'],
      raw_path: 'collapsed_technical_detail_only',
    },
    retained_presentation: 'always_explain_total_minus_candidates_and_why_it_is_not_selectable',
    execution_policy: {
      selection_scope: 'non_empty_subset_of_exact_dry_run_candidates_only',
      empty_selection: 'disabled',
      revalidation: 'full_plan_hash_live_authority_and_selected_subset_membership_before_delete',
    },
  };
  assert.deepStrictEqual(guiPages.settings_storage.cleanup_preview_interaction, cleanupPreviewInteraction);
  assert.deepStrictEqual(pageById("storage").cleanup_preview_interaction, cleanupPreviewInteraction);
  assert.deepStrictEqual(
    experiencePages.storage.surface_rules.cleanup_preview_interaction,
    cleanupPreviewInteraction,
  );
  assert.deepStrictEqual(
    values.productProfile.settings.control_plane.experience_contract.page_contracts.storage
      .surface_rules.cleanup_preview_interaction,
    cleanupPreviewInteraction,
  );
  const storageAvailabilityPresentationVariants = {
    web_statistics_not_connected: {
      condition: 'webui_has_no_valid_owner_storage_projection_and_no_explicit_error',
      severity: 'info',
      title_intent: 'current_web_version_cannot_display_storage_usage',
      required_explanation: [
        'browser_access_context',
        'deployment_not_connected_to_storage_statistics_service',
        'existing_data_and_other_features_unaffected',
      ],
      visible_action: {
        id: 'view_deployment_status',
        route: '/settings/environment?section=services',
      },
      retry_visible: false,
    },
    operational_failure: {
      condition: 'explicit_permission_service_ipc_or_unknown_error',
      severity: 'warning',
      localized_reason_required: true,
      recovery_action_required: true,
      retry_policy: 'show_only_when_action_rechecks_the_failed_source',
      technical_details_default: 'collapsed',
    },
  };
  const storageImplementationTerms = ['desktop storage carrier', 'owner projection', 'carrier host'];
  const storageExperience = values.guiContract.ui_experience_contract.settings_details.storage_unavailable;
  const storageUnavailableInformation = [
    'localized_reason',
    'user_visible_context_and_impact',
    'recovery_action',
  ];
  assert.deepStrictEqual(storageExperience.required_information, storageUnavailableInformation);
  assert.deepStrictEqual(storageExperience.presentation_variants, storageAvailabilityPresentationVariants);
  assert.deepStrictEqual(
    storageExperience.user_visible_implementation_terms_forbidden,
    storageImplementationTerms,
  );
  assert.deepStrictEqual(
    guiPages.settings_storage.unavailable_state.presentation_variants,
    storageAvailabilityPresentationVariants,
  );
  assert.deepStrictEqual(
    guiPages.settings_storage.unavailable_state.required_information,
    storageUnavailableInformation,
  );
  assert.deepStrictEqual(
    pageById("storage").unavailable_state.presentation_variants,
    storageAvailabilityPresentationVariants,
  );
  assert.deepStrictEqual(
    pageById("storage").unavailable_state.required_fields,
    storageUnavailableInformation,
  );
  assert.deepStrictEqual(
    pageById("storage").unavailable_state.user_visible_implementation_terms_forbidden,
    storageImplementationTerms,
  );
  const ownerStorage = guiPages.settings_storage.owner_storage_projections;
  assert.deepStrictEqual(ownerStorage.sections, ['agent_package_store', 'webui_data_volume']);
  assert.equal(ownerStorage.missing_projection_policy, 'fail_open_keep_shell_owned_categories_available');
  assert.deepStrictEqual(ownerStorage.status_presentation_policy, {
    never_observed:
      'not_inventoried_when_observed_at_null_and_inventory_cache_missing_or_invalid_never_out_of_date',
    observed_stale: 'out_of_date_only_when_observed_at_present_and_stale_true',
    not_configured: 'not_configured_without_out_of_date_or_zero_bytes',
    attention_required: 'usage_unavailable_with_localized_reason_never_raw_reason_code',
    unknown_bytes: 'awaiting_inventory_when_never_observed_else_usage_unavailable_never_zero',
  });
  assert.deepStrictEqual(
    pageById("storage").owner_storage_projections.status_presentation_policy,
    ownerStorage.status_presentation_policy,
  );
  assert.equal(ownerStorage.agent_package_store.owner_route, '/settings/agents');
  assert.equal(ownerStorage.agent_package_store.direct_storage_mutation_allowed, false);
  assert.equal(ownerStorage.webui_data_volume.generic_docker_prune_allowed, false);
  assert.equal(ownerStorage.webui_data_volume.shell_direct_path_delete_allowed, false);
  assert.equal(
    ownerStorage.webui_data_volume.host_action_capability_id,
    appOwnedWebuiDataVolumeHostActionCapabilityId,
  );
  assert.equal(
    ownerStorage.webui_data_volume.host_action_abi_ref,
    appOwnedWebuiDataVolumeHostActionAbiRef,
  );
  assert.deepStrictEqual(guiPages.settings_storage.storage_carrier_behavior, appOwnedStorageCarrierBehavior);
  assert.deepStrictEqual(pageById("storage").storage_carrier_behavior, appOwnedStorageCarrierBehavior);
  assert.deepStrictEqual(
    experiencePages.storage.surface_rules.storage_carrier_behavior,
    appOwnedStorageCarrierBehavior,
  );
  assert.deepStrictEqual(
    values.controlPlane.page_adapter_policy.required_pages.storage.storage_carrier_behavior,
    appOwnedStorageCarrierBehavior,
  );
  assert.equal(
    values.controlPlane.product_system_checklist.items.some((entry) => entry.id === 'docker_storage_projection'),
    false,
  );
  assert.equal(
    values.controlPlane.product_system_checklist.items.some((entry) => entry.id === 'owner_storage_projection'),
    true,
  );

  const webuiLocalBridge = contracts();
  webuiLocalBridge.controlPlane.experience_contract.page_contracts.storage.surface_rules
    .storage_carrier_behavior.webui.local_lifecycle_transport = "electron_ipc";
  assert.throws(() => validate(webuiLocalBridge), /Storage surface rules/);

  const pageStateLocalBridge = contracts();
  pageStateLocalBridge.pageStateMatrix.pages.find((page) => page.id === "storage")
    .storage_carrier_behavior.webui.local_lifecycle_transport = "electron_ipc";
  assert.throws(() => validate(pageStateLocalBridge), /Page-state Storage carrier behavior/);

  const adapterLocalBridge = contracts();
  adapterLocalBridge.controlPlane.page_adapter_policy.required_pages.storage
    .storage_carrier_behavior.webui.local_lifecycle_transport = "electron_ipc";
  assert.throws(() => validate(adapterLocalBridge), /adapter carrier behavior/);

  const guiLocalBridge = contracts();
  guiLocalBridge.guiContract.pages.settings_storage.storage_carrier_behavior.webui.local_lifecycle_transport =
    "electron_ipc";
  assert.throws(() => validateGui(guiLocalBridge.guiContract), /Storage carrier behavior/);

  const wrongHostCapability = contracts();
  wrongHostCapability.controlPlane.page_adapter_policy.required_pages.storage.owner_storage_projections
    .webui_data_volume.host_action_capability_id = "shell_owned.storage.cleanup";
  assert.throws(() => validate(wrongHostCapability), /fail-open owner projections/);

  const missingGuiHostAbi = contracts();
  missingGuiHostAbi.guiContract.pages.settings_storage.owner_storage_projections.webui_data_volume
    .host_action_abi_ref = null;
  assert.throws(() => validateGui(missingGuiHostAbi.guiContract), /owner projections/);

  const invalidWebStoragePresentation = contracts();
  invalidWebStoragePresentation.guiContract.pages.settings_storage.unavailable_state.presentation_variants
    .web_statistics_not_connected.retry_visible = true;
  assert.throws(() => validateGui(invalidWebStoragePresentation.guiContract), /availability presentation variants/);

  const componentAudit = values.controlPlane.visual_qa_policy.component_audit;
  assert.deepStrictEqual(componentAudit.required_color_schemes, ["light", "dark"]);
  assert.ok(componentAudit.required_checks.includes("no_nested_card_or_border_wall"));
  assert.equal(
    componentAudit.acceptance,
    "fresh_app_artifact_identity_framework_compatibility_receipt_active_shell_contract_and_installed_16_scene_DOM_pixel_accessibility_review",
  );
});
