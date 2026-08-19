import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

test('OPL Connect connector settings are dynamically projected through one Framework Host', () => {
  const gui = readJson('contracts/app-gui-product-contract.json');
  const contract = gui.framework_surfaces.package_app_contributions.opl_connect_connector_settings;

  assert.equal(contract.destination, 'settings.resources.messages_and_connections');
  assert.equal(contract.section_labels.zh_cn, '消息与连接');
  assert.equal(contract.runtime_membership_source, 'app_state.ui_contributions.slots.settings.section');
  assert.equal(
    contract.runtime_membership_policy,
    'dynamic_framework_host_projection_only_no_fixed_package_or_brand_allowlist',
  );
  assert.equal(contract.top_level_settings_navigation_allowed, false);
  assert.match(contract.page_model, /app_owned_standard_renderer/);
  assert.match(contract.visible_disconnected_state, /show_the_connector/);
  assert.match(contract.unready_policy, /omit_the_connector_row_route_and_placeholder/);

  const weixin = contract.currently_defined_product_classifications.find(
    ({ package_id_example }: { package_id_example?: string }) => package_id_example === 'opl-channel-weixin',
  );
  assert.equal(weixin.connector_kind, 'message_channel_connector');
  assert.equal(weixin.classification_role, 'product_documentation_example_not_runtime_membership');

  const link = contract.currently_defined_product_classifications.find(
    ({ target_package_id }: { target_package_id?: string }) =>
      target_package_id === 'opl-link-desktop-connector',
  );
  assert.equal(link.connector_kind, 'remote_companion_connector');
  assert.equal(link.target_package_implemented, false);
  assert.equal(link.legacy_shell_connector_migration_required, true);
});

test('OPL Link keeps product ownership while its desktop connector moves to OPL Connect', () => {
  const gui = readJson('contracts/app-gui-product-contract.json');
  const remote = readJson('contracts/app-remote-companion.json');
  const connector = remote.desktop_connector_boundary;

  assert.equal('desktop_connector' in gui.remote_companion, false);
  assert.equal(connector.opl_module_classification, 'opl_connect.remote_companion_connector');
  assert.equal(connector.target_path, 'packages/opl-link-desktop-connector');
  assert.equal(connector.package_owner, 'opl-link');
  assert.equal(connector.runtime_host_owner, 'one-person-lab-framework');
  assert.match(connector.cordis_host_policy, /single_framework_host/);
  assert.match(connector.product_boundary, /ios_app_and_opl_link_service_remain_independent/);
  assert.equal(remote.implementation_status.desktop_connector_target_package_implemented, false);
  assert.equal(remote.implementation_status.legacy_shell_connector_migration_required, true);
});
