import { validateProductProfile } from '../../../scripts/validate-active-shell/product-profile-validator.ts';
import { assert, fs, path, test, appRoot } from './helpers.ts';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

test('App approves one DSH-derived renderer and Node host core across desktop, headless, and Docker', () => {
  const profile = readJson('contracts/app-product-profile.json');
  const release = readJson('contracts/app-release-channel.json');
  const candidates = readJson('contracts/app-shell-candidates.json');
  const gui = readJson('contracts/app-gui-product-contract.json');

  assert.deepEqual(profile.product.target_desktop_platforms, ['macos', 'windows', 'linux']);
  assert.deepEqual(profile.product.target_runtime_forms, [
    'electron_desktop',
    'standalone_headless_webui',
    'docker_webui',
  ]);
  assert.equal('supported_release_platforms' in profile.product, false);
  assert.deepEqual(profile.release_roles.current.admitted_product_platforms, ['macos-arm64']);
  assert.equal(profile.release_roles.successor.active_release_carrier, false);
  assert.equal(profile.delivery_topology.role, 'successor_target_only');
  assert.equal(profile.delivery_topology.shared_renderer.product_owner, 'one-person-lab-app');
  assert.equal(profile.delivery_topology.shared_renderer.technology, 'deepseek_harness_derived_react');
  assert.equal(profile.delivery_topology.shared_renderer.implementation_status, 'approved_active_product_development_release_admission_separate');
  assert.equal(profile.delivery_topology.shared_host_core.technology, 'node');
  assert.equal(profile.delivery_topology.shared_host_core.same_core_required_across_carriers, true);
  assert.equal(profile.delivery_topology.runtime.supported_backend_scope, 'codex_cli_only');
  assert.equal(profile.delivery_topology.runtime.aioncore_allowed, false);
  assert.equal(profile.delivery_topology.bridge.abi, 'opl_app_host_bridge.v1');
  assert.equal(profile.delivery_topology.desktop.host_technology, 'electron_thin_shell');
  assert.deepEqual(profile.delivery_topology.desktop.target_platforms, ['macos', 'windows', 'linux']);
  assert.equal(profile.delivery_topology.desktop.windows_native_or_wsl_placement_predecided, false);
  assert.equal(profile.delivery_topology.desktop.swift_appkit_wkwebview_product_host_allowed, false);
  assert.equal(profile.delivery_topology.desktop.platform_support_claim_allowed_before_platform_admission, false);
  assert.equal(profile.delivery_topology.headless_webui.host_technology, 'shared_node_host_core');
  assert.equal(profile.delivery_topology.headless_webui.electron_required, false);
  assert.equal(profile.delivery_topology.headless_webui.legacy_headless_flag_semantics, 'base_only_unchanged_until_separate_migration');
  assert.equal(profile.delivery_topology.headless_webui.existing_packaged_desktop_webui_counts_as_standalone_host, false);
  assert.equal(profile.delivery_topology.docker_webui.electron_in_container_allowed, false);
  assert.equal(profile.delivery_topology.docker_webui.aioncore_in_container_allowed, false);
  assert.equal(profile.delivery_topology.docker_webui.same_renderer_host_core_and_bridge_abi_required, true);
  assert.equal(profile.delivery_topology.docker_webui.existing_aionui_container_counts_as_successor_implementation, false);
  assert.equal(profile.delivery_topology.successor_product.product_development_required, true);
  assert.equal(profile.delivery_topology.successor_product.current_mainline, false);
  assert.equal(profile.delivery_topology.successor_product.minimum_complete_product_obligation, true);
  assert.equal(profile.delivery_topology.successor_product.aionui_feature_parity_obligation, false);
  assert.equal(gui.successor_delivery_policy.renderer, 'single_deepseek_harness_derived_react_renderer');
  assert.equal(gui.successor_delivery_policy.topology_authority, false);
  assert.equal(gui.successor_delivery_policy.carrier_and_bridge_shape_source, 'contracts/app-product-profile.json#delivery_topology');
  assert.equal(gui.successor_delivery_policy.swift_appkit_wkwebview_product_host_allowed, false);
  assert.equal(profile.delivery_topology.aionui_reference.target_renderer_owner, false);
  assert.equal(profile.delivery_topology.aionui_reference.target_feature_inventory_owner, false);
  assert.deepEqual(profile.delivery_topology.minimum_complete_product.composition_model.package_contribution_slots, [
    'settings.section',
    'runtime.detail',
    'composer.palette',
  ]);
  assert.equal(profile.delivery_topology.minimum_complete_product.update_ownership.agent_packages, 'part_of_opl_packages_never_a_fourth_updater');
  assert.equal(profile.delivery_topology.minimum_complete_product.cutover_policy.strategy, 'establish_then_replace');
  assert.equal(profile.delivery_topology.minimum_complete_product.cutover_policy.aionui_remains_only_mainline_until_cutover, true);
  assert.equal(candidates.active_shell_unchanged, 'aionui');
  assert.equal(release.successor_delivery_target.role, 'target_only_not_current_release_authority');
  assert.equal(release.successor_delivery_target.topology_authority, false);
  assert.equal(release.successor_delivery_target.current_release_platform_matrix_is_successor_admission_evidence, false);
  assert.equal(
    release.distribution_semantics.cohort_policy.approved_production_target.model,
    'one_app_product_multiple_independently_versioned_carriers',
  );
  assert.deepEqual(
    release.distribution_semantics.cohort_policy.approved_production_target.runtime_forms,
    ['desktop', 'container_webui'],
  );
  assert.doesNotThrow(() =>
    validateProductProfile(profile, readJson('contracts/app-install-exposure-policy.json')),
  );
});

test('delivery topology validator rejects runtime duplication, host drift, or premature platform promotion', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const mutations = [
    {
      error: /shared renderer topology/,
      mutate: (profile) => { profile.delivery_topology.shared_renderer.carrier_specific_product_forks_allowed = true; },
    },
    {
      error: /Codex-only runtime topology/,
      mutate: (profile) => { profile.delivery_topology.runtime.aioncore_allowed = true; },
    },
    {
      error: /shared Node host core topology/,
      mutate: (profile) => { profile.delivery_topology.shared_host_core.same_core_required_across_carriers = false; },
    },
    {
      error: /Electron desktop topology/,
      mutate: (profile) => { profile.delivery_topology.desktop.swift_appkit_wkwebview_product_host_allowed = true; },
    },
    {
      error: /Docker WebUI topology/,
      mutate: (profile) => { profile.delivery_topology.docker_webui.electron_in_container_allowed = true; },
    },
    {
      error: /successor product policy/,
      mutate: (profile) => { profile.delivery_topology.successor_product.product_development_required = false; },
    },
    {
      error: /AionUI reference boundary/,
      mutate: (profile) => { profile.delivery_topology.aionui_reference.target_renderer_owner = true; },
    },
  ];

  for (const { error, mutate } of mutations) {
    const profile = readJson('contracts/app-product-profile.json');
    mutate(profile);
    assert.throws(() => validateProductProfile(profile, installExposure), error);
  }
});
