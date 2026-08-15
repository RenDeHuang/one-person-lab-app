import { validateProductProfile } from '../../../scripts/validate-active-shell/product-profile-validator.ts';
import { assert, fs, path, test, appRoot } from './helpers.ts';
import { parse as parseYaml } from 'yaml';

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
  assert.equal(profile.delivery_topology.desktop.package_source_implemented, true);
  assert.equal(profile.delivery_topology.desktop.update_adapter_source_implemented, true);
  assert.equal(profile.delivery_topology.desktop.distribution_wiring_complete, false);
  assert.equal(profile.delivery_topology.desktop.update_command_wiring_complete, false);
  assert.equal(profile.delivery_topology.desktop.release_admission_complete, false);
  assert.equal(profile.delivery_topology.desktop.windows_native_or_wsl_placement_predecided, false);
  assert.equal(profile.delivery_topology.desktop.swift_appkit_wkwebview_product_host_allowed, false);
  assert.equal(profile.delivery_topology.desktop.platform_support_claim_allowed_before_platform_admission, false);
  assert.equal(profile.delivery_topology.headless_webui.host_technology, 'shared_node_host_core');
  assert.equal(profile.delivery_topology.headless_webui.electron_required, false);
  assert.equal(profile.delivery_topology.headless_webui.user_service_manager_source_implemented, true);
  assert.equal(profile.delivery_topology.headless_webui.installer_source_implemented, true);
  assert.equal(profile.delivery_topology.headless_webui.distribution_installer_wiring_complete, false);
  assert.equal(profile.delivery_topology.headless_webui.carrier_update_adapter_source_implemented, true);
  assert.equal(profile.delivery_topology.headless_webui.carrier_update_command_wiring_complete, false);
  assert.equal('background_service_source_implemented' in profile.delivery_topology.headless_webui, false);
  assert.equal('update_source_implemented' in profile.delivery_topology.headless_webui, false);
  assert.equal(profile.delivery_topology.headless_webui.legacy_headless_flag_semantics, 'base_only_unchanged_until_separate_migration');
  assert.equal(profile.delivery_topology.headless_webui.existing_packaged_desktop_webui_counts_as_standalone_host, false);
  assert.equal(profile.delivery_topology.docker_webui.electron_in_container_allowed, false);
  assert.equal(profile.delivery_topology.docker_webui.aioncore_in_container_allowed, false);
  assert.equal(profile.delivery_topology.docker_webui.distribution_manager_source_implemented, true);
  assert.equal(profile.delivery_topology.docker_webui.distribution_wiring_complete, false);
  assert.equal(profile.delivery_topology.docker_webui.image_update_adapter_source_implemented, true);
  assert.equal(profile.delivery_topology.docker_webui.image_update_command_wiring_complete, false);
  assert.equal(profile.delivery_topology.docker_webui.multi_arch_build_plan_source_implemented, true);
  assert.equal(profile.delivery_topology.docker_webui.multi_arch_qualification_complete, false);
  assert.equal(profile.delivery_topology.docker_webui.signature_verification_implemented, false);
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
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.app_client_contribution_abi, 'opl_app_client_contributions.v1');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.framework_host_projection_schema, 'opl_app_ui_contributions_projection.v1');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.host_projection_graph_policy, 'allowlisted_closed_graph_from_framework_projection_only');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.host_projection_allowlist_contract, 'contracts/opl-app-contributions.schema.json');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.typed_slot_policy, 'mount_only_app_product_profile_declared_slots');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.typed_action_policy, 'action_refs_only_via_canonical_app_action_bridge');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.framework_host_composition_authority, 'one-person-lab-framework');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.app_authority_policy, 'one-person-lab-app_owns_product_profile_gui_abi_active_shell_and_release');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.framework_projection_runtime_status, 'framework_host_projection_active');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.shared_transport_policy, 'framework_host_projected_typed_rpc_reads_typed_events_and_canonical_app_actions');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.shared_product_state_semantics, true);
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.package_gui_contribution_policy, 'app_schema_admitted_declarative_only_then_framework_host_projected');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.client_authority_policy, 'render_and_dispatch_only_no_plugin_discovery_install_registry_currentness_release_operation_task_package_or_product_truth');
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.client_cordis_graph, 'derived_from_framework_host_graph_and_app_product_profile_slot_policy');
  assert.deepEqual(profile.delivery_topology.minimum_complete_product.composition_model.shared_shell_consumers, ['opl-aion-shell', 'opl-studio']);
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.independent_host_truth_allowed, false);
  assert.equal(profile.delivery_topology.minimum_complete_product.composition_model.second_client_composition_graph_allowed, false);
  assert.equal(profile.delivery_topology.minimum_complete_product.update_ownership.agent_packages, 'part_of_opl_packages_never_a_fourth_updater');
  assert.equal(profile.delivery_topology.minimum_complete_product.cutover_policy.strategy, 'establish_then_replace');
  assert.equal(profile.delivery_topology.minimum_complete_product.cutover_policy.aionui_remains_only_mainline_until_cutover, true);
  assert.equal(candidates.active_shell_unchanged, 'aionui');
  const studio = candidates.candidates.find((entry) => entry.id === 'opl-studio');
  assert.ok(studio);
  assert.deepEqual(studio.carrier_evidence_contract.required_entries, [
    'electron_desktop',
    'standalone_headless_webui',
    'docker_webui',
  ]);
  assert.equal(studio.carrier_evidence_contract.candidate_only, true);
  assert.equal(studio.carrier_evidence_contract.release_authority, false);
  assert.equal(studio.carrier_evidence_contract.current_aionui_release_evidence_may_close_successor_entry, false);
  const studioAdapter = readJson('contracts/shell-adapters/opl-studio.json');
  assert.equal(studioAdapter.delivery_topology.carrier_evidence_manifest.candidate_only, true);
  assert.equal(studioAdapter.delivery_topology.carrier_evidence_manifest.release_authority, false);
  assert.deepEqual(Object.keys(studioAdapter.delivery_topology.carrier_entries), [
    'electron_desktop',
    'standalone_headless_webui',
    'docker_webui',
  ]);
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
      error: /standalone headless WebUI topology/,
      mutate: (profile) => { profile.delivery_topology.headless_webui.distribution_installer_wiring_complete = true; },
    },
    {
      error: /Docker WebUI topology/,
      mutate: (profile) => { profile.delivery_topology.docker_webui.multi_arch_qualification_complete = true; },
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

test('Studio carrier workflow creates candidate evidence without release or publication authority', () => {
  const workflowPath = path.join(appRoot, '.github/workflows/opl-studio-candidate-carriers.yml');
  const source = fs.readFileSync(workflowPath, 'utf8');
  const workflow = parseYaml(source);

  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), [
    'resolve-studio',
    'desktop-headless',
    'docker-webui',
    'validate-manifest',
  ]);
  assert.match(source, /opl-studio-carrier-evidence-manifest\.json/);
  assert.match(source, /standalone-headless-webui\.tgz/);
  assert.doesNotMatch(source, /headless-index\.html/);
  assert.match(source, /release_authority: false/);
  for (const forbidden of ['git push', 'docker push', 'gh release', 'npm publish', 'packages: write']) {
    assert.equal(source.includes(forbidden), false, `candidate workflow must not contain ${forbidden}`);
  }
});
