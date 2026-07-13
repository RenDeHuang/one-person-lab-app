import { appRoot, assert, fs, path, test } from "./helpers.ts";
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

test("Settings contract keeps nine product pages, two secondary pages, and anchored compatibility routes", () => {
  const values = contracts();

  assert.doesNotThrow(() => validate(values));
  assert.deepStrictEqual(
    values.controlPlane.ordinary_routes.map((route) => route.product_page_id),
    [
      "overview",
      "access",
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
      "模型与访问",
      "工作区与个性化",
      "智能体",
      "能力",
      "资源与连接",
      "本机环境",
      "数据与存储",
      "偏好",
    ],
  );
  assert.deepStrictEqual(
    values.controlPlane.secondary_pages.map((page) => page.id),
    ["advanced", "about"],
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
    values.controlPlane.legacy_route_redirects.assistants,
    "capabilities?tab=skills",
  );
  assert.deepStrictEqual(
    values.controlPlane.aionui_custom_assistant_boundary,
    {
      opl_app_product_surface: false,
      ordinary_navigation_entry_allowed: false,
      entry_may_be_hidden: true,
      legacy_assistants_target: "capabilities?tab=skills",
      underlying_user_data_owner: "aionui",
      underlying_user_data_deletion_policy:
        "forbidden_without_explicit_app_contract_and_migration_or_deletion_evidence",
      route_or_entry_removal_proves_data_migration: false,
    },
  );
});

test("Settings validator keeps runnable package lifecycle on Agents", () => {
  const staleProfileRef = contracts();
  staleProfileRef.controlPlane.page_adapter_policy.required_pages.agents
    .directory_projection_surface.activation_action_contract_ref =
    "contracts/app-gui-product-contract.json#pages.settings_capabilities.agent_package_lifecycle_ux.package_projection_contract.activation_preparation_policy";
  assert.throws(
    () => validate(staleProfileRef),
    /Settings Agents directory projection.*package activation action/,
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
  changedAnchorContract.controlPlane.experience_contract.page_contracts.access.required_anchors =
    ["provider-source", "model"];
  assert.throws(
    () => validate(changedAnchorContract),
    /Access anchors|access anchors|existing page anchor/,
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

test("Settings visual QA enforces bounded-card grouping, compact footer, recognizable theme previews, and responsive color evidence", () => {
  const values = contracts();
  const visualSystem = values.controlPlane.experience_contract.visual_system;
  const visualQa =
    values.guiContract.settings_navigation.settings_ia.protocols
      .visual_qa_expectations;

  assert.doesNotThrow(() => validate(values));
  assert.deepStrictEqual(visualSystem, {
    style: "opl_baseline_card_control_center",
    style_exclusion: "codex_quiet_list",
    baseline_shell_commit: "409dd0c3b693f1c7c93551654dfac8fb9420843d",
    baseline_comparison_policy:
      "fresh_same_route_screenshots_must_preserve_or_improve_information_hierarchy",
    card_policy: "one_bounded_card_per_user_question_with_flat_internal_rows",
    first_viewport_spatial_group_range: { min: 2, max: 4 },
    nested_cards_allowed: false,
    page_wide_list_wall_allowed: false,
    page_sections_as_floating_cards_allowed: false,
    desktop_group_layout: "responsive_two_column_grid_where_space_allows",
    mobile_group_layout: "single_column_stack",
    icon_slot_px: 28,
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
      "use restrained multi-hue navigation icons and card-edge accents to distinguish access, workspace, capabilities, maintenance, and storage without tinting whole pages",
    footer_layout: "compact",
    footer_controls: ["theme_switcher"],
    footer_secondary_navigation_allowed: false,
    theme_gallery_presentation: "recognizable_preview_tiles",
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
    allowed_bounded_group_kinds: ["page_section", "summary", "repeated_entity"],
    bounded_group_nesting: "single_layer_only",
    page_section_card_policy:
      "one_bounded_card_per_user_question_with_flat_internal_rows",
    first_viewport_spatial_group_range: { min: 2, max: 4 },
    page_wide_bare_divider_layout: "forbidden",
    page_wide_list_wall: "forbidden",
  });
  assert.deepStrictEqual(visualQa.footer_structure, {
    layout: "compact",
    controls: ["theme_switcher"],
    account_help_navigation: "forbidden",
  });
  assert.deepStrictEqual(visualQa.theme_gallery, {
    presentation: "recognizable_preview_tiles",
    flat_swatch_list: "forbidden",
  });
  assert.deepStrictEqual(visualQa.assertion_focus, {
    required_structure: [
      "user_question_to_bounded_card",
      "two_to_four_first_viewport_spatial_groups",
      "responsive_grid_to_stack",
      "icon_typography_and_status_hierarchy",
      "409dd0c3_same_route_non_regression",
      "flat_rows_inside_card",
      "compact_footer",
      "recognizable_theme_preview_tiles",
    ],
    radius_and_spacing_only: "insufficient",
  });
  assert.deepStrictEqual(visualQa.evidence_dimensions.required_viewports, [
    "desktop",
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
  secondaryFooterNavigation.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.footer_structure.account_help_navigation =
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

  const quietList = contracts();
  quietList.controlPlane.experience_contract.visual_system.style_exclusion =
    "allowed";
  assert.throws(() => validate(quietList), /visual system/);

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
  assert.ok(experience.page_contracts.storage.surface_inventory.action.length > 0);
  assert.ok(
    experience.page_contracts.storage.surface_inventory.diagnostic.some(
      (surface) => surface.id === "storage_restore_probe",
    ),
  );
  assert.deepStrictEqual(
    Object.fromEntries(
      Object.entries(experience.page_contracts.advanced.surface_inventory).map(
        ([type, entries]) => [type, entries.length],
      ),
    ),
    { configuration: 0, status: 0, action: 0, diagnostic: 1 },
  );
  assert.equal(
    experience.page_contracts.workspace.surface_rules.workspace_card_count,
    1,
  );
  assert.deepStrictEqual(
    experience.page_contracts.preferences.surface_rules.builtin_theme_ids,
    ["light", "dark", "codex"],
  );
  assert.equal(
    experience.page_contracts.preferences.surface_rules.full_width_group_count,
    3,
  );
  assert.equal(
    experience.page_contracts.preferences.surface_inventory.diagnostic.length,
    0,
  );
  assert.ok(
    experience.page_contracts.workspace.first_viewport_groups.includes(
      "personalization",
    ),
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
  delete missingInventoryType.controlPlane.experience_contract.page_contracts.access
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

  const advancedConfiguration = contracts();
  advancedConfiguration.controlPlane.experience_contract.page_contracts.advanced
    .surface_inventory.configuration.push({
      id: "developer_mode",
      owner: "advanced",
    });
  assert.throws(() => validate(advancedConfiguration), /diagnostic-only page/);
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
  access.search_entry_ids = ["access.model"];
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
