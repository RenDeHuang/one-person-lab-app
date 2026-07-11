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

test("Settings contract keeps eight product pages, two secondary pages, and anchored compatibility routes", () => {
  const values = contracts();

  assert.doesNotThrow(() => validate(values));
  assert.deepStrictEqual(
    values.controlPlane.ordinary_routes.map((route) => route.product_page_id),
    [
      "overview",
      "access",
      "workspace",
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
      "工作区",
      "智能体与能力",
      "资源与连接",
      "维护",
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
    },
  );
  assert.equal(values.controlPlane.legacy_route_redirects.about, undefined);
  assert.equal(
    values.controlPlane.legacy_route_redirects.assistants,
    "capabilities?tab=assistants#custom-assistants",
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
    "capabilities";
  assert.throws(
    () => validate(assistantsRegression),
    /legacy redirects|legacy assistants/,
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
    /Access anchors|access anchors/,
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
    footer_layout: "compact",
    footer_controls: ["return_to_chat", "theme_switcher"],
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
    controls: ["return_to_chat", "theme_switcher"],
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
    "narrow",
  ]);
  assert.deepStrictEqual(visualQa.evidence_dimensions.required_color_schemes, [
    "light",
    "dark",
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

  const lightOnly = contracts();
  lightOnly.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.evidence_dimensions.required_color_schemes =
    ["light"];
  assert.throws(() => validate(lightOnly), /evidence dimensions/);
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
    ["status"];
  assert.throws(
    () => validate(flatFirstViewport),
    /two to four distinct first-viewport groups/,
  );

  const assistantValues = contracts();
  assistantValues.pageStateMatrix.pages.find(
    (page) => page.id === "capabilities",
  ).codex_plugin_directory_target.tab_contract.assistants.component_key =
    "EmptyState";
  assert.throws(
    () => validate(assistantValues),
    /Capabilities tab contract|AssistantSettings tab contract/,
  );
});
