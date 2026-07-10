import {
  appRoot,
  assert,
  fs,
  path,
  test,
} from './helpers.ts';
import { validateSettingsControlPlane } from '../../../scripts/validate-active-shell/settings-control-plane-validator.ts';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

function contracts() {
  return {
    controlPlane: readJson('contracts/app-settings-control-plane.json'),
    guiContract: readJson('contracts/app-gui-product-contract.json'),
    pageStateMatrix: readJson('contracts/app-page-state-matrix.json'),
    productProfile: readJson('contracts/app-product-profile.json'),
    adapterContract: readJson('contracts/app-shell-adapter.json'),
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

test('Settings contract keeps eight product pages, two secondary pages, and anchored compatibility routes', () => {
  const values = contracts();

  assert.doesNotThrow(() => validate(values));
  assert.deepStrictEqual(
    values.controlPlane.ordinary_routes.map((route) => route.product_page_id),
    ['overview', 'access', 'workspace', 'capabilities', 'resources', 'maintenance', 'storage', 'preferences'],
  );
  assert.deepStrictEqual(
    values.controlPlane.ordinary_routes.map((route) => route.default_label_zh),
    ['概览', '访问方式', '工作区', '智能体与能力', '资源与连接', '维护', '数据与存储', '偏好'],
  );
  assert.deepStrictEqual(values.controlPlane.secondary_pages.map((page) => page.id), ['advanced', 'about']);
  assert.deepStrictEqual(
    Object.fromEntries(
      Object.entries(values.controlPlane.compatibility_redirects).map(([id, redirect]) => [
        id,
        `${redirect.target_route_id}#${redirect.anchor}`,
      ]),
    ),
    {
      update: 'environment#updates',
      theme: 'appearance#themes',
      'local-services': 'environment#services',
    },
  );
  assert.equal(values.controlPlane.legacy_route_redirects.about, undefined);
  assert.equal(
    values.controlPlane.legacy_route_redirects.assistants,
    'capabilities?tab=assistants#custom-assistants',
  );
});

test('Settings validator rejects secondary-page and compatibility-route regressions', () => {
  const secondaryRegression = contracts();
  secondaryRegression.controlPlane.secondary_pages.push({
    id: 'update',
    path: '/settings/update',
    ia_group: 'maintenance',
    slot_id: 'update',
    visibility: 'secondary_or_deep_link',
  });
  assert.throws(() => validate(secondaryRegression), /secondary page ids/);

  const aboutRegression = contracts();
  aboutRegression.controlPlane.legacy_route_redirects.about = 'advanced';
  assert.throws(() => validate(aboutRegression), /legacy redirects|independent \/settings\/about/);

  const anchorRegression = contracts();
  anchorRegression.controlPlane.compatibility_redirects.theme.anchor = 'theme';
  assert.throws(() => validate(anchorRegression), /compatibility redirects/);

  const assistantsRegression = contracts();
  assistantsRegression.controlPlane.legacy_route_redirects.assistants = 'capabilities';
  assert.throws(() => validate(assistantsRegression), /legacy redirects|legacy assistants/);
});

test('Settings validator rejects duplicate search, missing bilingual index data, and invalid anchors', () => {
  const duplicateSearch = contracts();
  duplicateSearch.controlPlane.experience_contract.global_search.global_entry_count = 2;
  assert.throws(() => validate(duplicateSearch), /one bilingual item-level/);

  const keyboardSearch = contracts();
  keyboardSearch.controlPlane.experience_contract.global_search.keyboard_activation_policy = 'pointer_only';
  assert.throws(() => validate(keyboardSearch), /one bilingual item-level/);

  const missingEnglish = contracts();
  missingEnglish.controlPlane.experience_contract.search_index.entries[0].keywords_en = [];
  assert.throws(() => validate(missingEnglish), /indexed in Chinese and English/);

  const invalidAnchor = contracts();
  invalidAnchor.controlPlane.experience_contract.search_index.entries[0].anchor = 'missing-anchor';
  assert.throws(() => validate(invalidAnchor), /declared page anchor/);

  const changedAnchorContract = contracts();
  changedAnchorContract.controlPlane.experience_contract.page_contracts.access.required_anchors = [
    'provider-source',
    'model',
  ];
  assert.throws(() => validate(changedAnchorContract), /Access anchors|access anchors/);
});

test('Settings validator preserves workspace truth precedence and single-flight actions', () => {
  const workspaceTruth = contracts();
  workspaceTruth.controlPlane.experience_contract.page_contracts.workspace.readiness_precedence =
    'executor_mode_overrides_filesystem';
  assert.throws(() => validate(workspaceTruth), /filesystem writability and health/);

  const concurrentActions = contracts();
  concurrentActions.controlPlane.state_action_policy.request_exclusivity_policy = 'parallel_actions_allowed';
  assert.throws(() => validate(concurrentActions), /single-flight/);
});

test('Settings visual QA enforces dense grouping, route-title preflight, and responsive color evidence', () => {
  const values = contracts();
  const visualQa = values.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations;

  assert.doesNotThrow(() => validate(values));
  assert.deepStrictEqual(visualQa.visual_character, ['quiet', 'dense', 'scannable']);
  assert.deepStrictEqual(visualQa.surface_grouping, {
    allowed_bounded_group_kinds: ['page_section', 'summary', 'repeated_entity'],
    bounded_group_nesting: 'single_layer_only',
    page_section_card_policy: 'bounded_required_with_flat_internal_rows',
    page_wide_bare_divider_layout: 'forbidden',
  });
  assert.deepStrictEqual(visualQa.evidence_dimensions.required_viewports, ['desktop', 'narrow']);
  assert.deepStrictEqual(visualQa.evidence_dimensions.required_color_schemes, ['light', 'dark']);

  const sparseLayout = contracts();
  sparseLayout.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations
    .surface_grouping.page_wide_bare_divider_layout = 'allowed';
  assert.throws(() => validate(sparseLayout), /surface grouping/);

  const missingPageSectionCards = contracts();
  missingPageSectionCards.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations
    .surface_grouping.page_section_card_policy = 'forbidden';
  assert.throws(() => validate(missingPageSectionCards), /surface grouping/);

  const multipleSelectedItems = contracts();
  multipleSelectedItems.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations
    .sidebar_selection.selected_item_count = 2;
  assert.throws(() => validate(multipleSelectedItems), /sidebar selection/);

  const repeatedLabels = contracts();
  repeatedLabels.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations
    .repeated_entity_layout.row_field_label_policy = 'repeat_labels_per_row';
  assert.throws(() => validate(repeatedLabels), /repeated entity layout/);

  const uncheckedCapture = contracts();
  uncheckedCapture.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations
    .capture_preflight.mismatch_policy = 'capture_anyway';
  assert.throws(() => validate(uncheckedCapture), /capture preflight/);

  const lightOnly = contracts();
  lightOnly.guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations
    .evidence_dimensions.required_color_schemes = ['light'];
  assert.throws(() => validate(lightOnly), /evidence dimensions/);
});

test('Settings validator rejects page-state DOM and search-entry drift', () => {
  const values = contracts();
  const overview = values.pageStateMatrix.pages.find((page) => page.id === 'settings_general');
  overview.required_dom.always = ['settings-page-overview'];
  assert.throws(() => validate(values), /required DOM/);

  const searchValues = contracts();
  const access = searchValues.pageStateMatrix.pages.find((page) => page.id === 'access');
  access.search_entry_ids = ['access.model'];
  assert.throws(() => validate(searchValues), /search entries/);

  const resourceValues = contracts();
  resourceValues.guiContract.pages.settings_resources.action_behavior.dry_run_boundary.role = 'completion';
  assert.throws(() => validate(resourceValues), /Resources action behavior/);

  const browserValues = contracts();
  browserValues.controlPlane.experience_contract.page_contracts.access.browser_access_entry.visibility = 'hidden';
  assert.throws(() => validate(browserValues), /Access browser entry/);

  const assistantValues = contracts();
  assistantValues.pageStateMatrix.pages
    .find((page) => page.id === 'capabilities')
    .codex_plugin_directory_target.tab_contract.assistants.component_key = 'EmptyState';
  assert.throws(() => validate(assistantValues), /Capabilities tab contract|AssistantSettings tab contract/);
});
