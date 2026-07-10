import {
  appRoot,
  assert,
  fs,
  path,
  readProductProfile,
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
    productProfile: readProductProfile(),
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
