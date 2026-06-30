import {
  assert,
  fs,
  path,
  test,
  appRoot,
} from '../helpers.ts';

function readReleaseContract() {
  return JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
}

function readGuiContract() {
  return JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
}

function readPageStateMatrix() {
  return JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
}

test('runtime substrate and companion tools are separate App-owned managed channels', () => {
  const releaseContract = readReleaseContract();
  const runtimeUpdater = releaseContract.runtime_substrate_updater;
  const companionUpdater = releaseContract.companion_tools_updater;

  assert.equal(runtimeUpdater.owner, 'one-person-lab-app');
  assert.equal(runtimeUpdater.role, 'app_owned_runtime_substrate_layer_updates');
  assert.equal(runtimeUpdater.channel_manifest_asset, 'app-runtime-update-channel.json');
  assert.equal(runtimeUpdater.standard_updater_metadata_allowed, false);
  assert.equal(runtimeUpdater.standard_updater_latest_yml_allowed, false);
  assert.equal(runtimeUpdater.homebrew_tap_write_allowed, false);
  assert.equal(runtimeUpdater.managed_update_plane, 'runtime_substrate');
  assert.equal(runtimeUpdater.adapter, 'runtime_substrate_adapter');
  assert.equal(runtimeUpdater.legacy_alias, 'runtime_toolchain_updater');
  assert.deepEqual(runtimeUpdater.managed_components, [
    'embedded_codex_executor',
    'temporal_cli_archive',
    'node_runtime',
    'python_runtime',
    'uv_runtime',
    'native_helper',
    'opl_framework_runtime',
  ]);
  for (const forbidden of ['codex_cli_fallback', 'officecli', 'mineru_open_api', 'companion_skills']) {
    assert.equal(runtimeUpdater.managed_components.includes(forbidden), false);
  }

  assert.equal(companionUpdater.owner, 'one-person-lab-app');
  assert.equal(companionUpdater.producer_owner, 'one-person-lab');
  assert.equal(companionUpdater.class, 'companion_tools');
  assert.equal(companionUpdater.managed_update_plane, 'companion_tools');
  assert.equal(companionUpdater.adapter, 'companion_tools_adapter');
  assert.equal(companionUpdater.standard_updater_metadata_allowed, false);
  assert.equal(companionUpdater.standard_updater_latest_yml_allowed, false);
  assert.equal(companionUpdater.homebrew_tap_write_allowed, false);
  assert.deepEqual(companionUpdater.managed_tools, ['officecli', 'mineru_open_api']);
  assert.deepEqual(companionUpdater.forbidden_silent_overwrite_scope, runtimeUpdater.forbidden_silent_overwrite_scope);
});

test('local data lifecycle uses neutral user data and runtime substrate sections', () => {
  const lifecycle = readReleaseContract().local_data_lifecycle;

  assert.equal(lifecycle.owner, 'one-person-lab-app');
  assert.equal(lifecycle.policy_surface, 'Settings / Storage and Settings / Updates & Maintenance');
  assert.equal(lifecycle.user_data_silent_delete_allowed, false);
  assert.deepEqual(lifecycle.storage_inventory.sections, [
    'updater_cache',
    'user_data_artifacts',
    'runtime_substrate',
    'logs',
  ]);
  assert.equal(
    lifecycle.user_data_artifacts.default_policy,
    'retain_conversations_workspaces_and_artifacts_until_user_cleanup_or_archive',
  );
  assert.equal(lifecycle.user_data_artifacts.silent_delete_allowed, false);
  assert.equal(lifecycle.user_data_artifacts.cleanup_execution, 'archive_then_explicit_user_confirmed_delete');
  assert.equal(lifecycle.user_data_artifacts.archive_required_before_cleanup, true);
  assert.equal(lifecycle.user_data_artifacts.restore_proof_required, true);
  assert.equal(lifecycle.user_data_artifacts.legacy_alias, 'conversation_artifacts');
  assert.equal(lifecycle.runtime_substrate.default_policy, 'retain_current_and_declared_rollback_runtime');
  assert.equal(lifecycle.runtime_substrate.owner_ref, 'contracts/app-release-channel.json#runtime_substrate_updater');
  assert.equal(lifecycle.runtime_substrate.cleanup_execution, 'pointer_based_dry_run_first_explicit_execute_required');
  assert.equal(lifecycle.runtime_substrate.prune_candidate_policy, 'unreferenced_runtime_roots_only');
  assert.equal(lifecycle.runtime_substrate.dry_run_receipt_required, true);
  assert.equal(lifecycle.runtime_substrate.legacy_alias, 'runtime_toolchain');
  assert.deepEqual(lifecycle.runtime_substrate.execute_receipt_required_fields, [
    'runtime_root',
    'dry_run_plan_id',
    'protected_paths',
    'deleted_paths',
    'deleted_bytes',
    'created_at',
  ]);
});

test('managed update plane exposes the v2 install/update taxonomy and legacy aliases only as aliases', () => {
  const releaseContract = readReleaseContract();
  const plane = releaseContract.managed_update_plane;
  const lanes = new Map(plane.planes.map((entry) => [entry.id, entry]));
  const expectedPlaneIds = [
    'installation_carrier',
    'runtime_substrate',
    'capability_packages',
    'companion_tools',
    'codex_surface',
    'workflow_profile',
  ];

  assert.equal(plane.owner, 'one-person-lab-app');
  assert.equal(plane.producer_owner, 'one-person-lab');
  assert.equal(plane.taxonomy.model_version, 'app_install_update_taxonomy.v2');
  assert.deepEqual(plane.taxonomy.user_semantic_classes, [
    'installation_carrier',
    'runtime_substrate',
    'capability_packages',
    'companion_tools',
    'codex_surface',
    'workflow_profile',
    'user_data_artifacts',
  ]);
  assert.deepEqual(plane.taxonomy.legacy_aliases, {
    app_binary: 'installation_carrier.macos_app',
    runtime_toolchain: 'runtime_substrate',
    runtime_toolchain_updater: 'runtime_substrate_updater',
    codex_cli_fallback: 'embedded_codex_executor',
    agent_package_channel: 'capability_packages',
    capability_exposure: 'codex_surface',
    conversation_artifacts: 'user_data_artifacts',
  });
  assert.deepEqual(plane.taxonomy.installation_carrier_variants, [
    'macos_app',
    'docker_webui_image',
    'linux_package_carrier',
  ]);
  assert.deepEqual([...lanes.keys()], expectedPlaneIds);
  for (const oldId of ['app_binary', 'runtime_toolchain', 'agent_package_channel', 'capability_exposure', 'codex_cli_fallback']) {
    assert.equal(lanes.has(oldId), false);
  }

  const carrier = lanes.get('installation_carrier');
  const carrierVariants = new Map(carrier.carrier_variants.map((entry) => [entry.id, entry]));
  assert.equal(carrier.updater_kind, 'carrier_specific_status');
  assert.equal(carrier.adapter, 'installation_carrier_status_adapter');
  assert.equal(carrier.managed_kernel_apply_allowed, false);
  assert.equal(carrier.opl_update_apply_must_not_claim_carrier_update_complete, true);
  assert.ok(carrier.status_fields.includes('carrier_status'));
  assert.ok(carrier.status_fields.includes('host_update_route'));
  assert.ok(carrier.status_fields.includes('host_executor_required'));
  assert.ok(carrier.status_fields.includes('manual_required'));
  assert.ok(carrier.status_fields.includes('data_volume_preservation'));
  assert.equal(carrierVariants.get('macos_app').legacy_alias, 'app_binary');
  assert.equal(carrierVariants.get('macos_app').adapter, 'electron_standard_updater');
  assert.equal(carrierVariants.get('docker_webui_image').managed_kernel_apply_allowed, false);
  assert.ok(carrierVariants.get('docker_webui_image').status_values.includes('host_executor_required'));
  assert.ok(carrierVariants.get('docker_webui_image').status_values.includes('manual_required'));
  assert.equal(carrierVariants.get('docker_webui_image').data_volume_preservation_proof_required, true);
  assert.equal(
    carrierVariants.get('docker_webui_image').host_update_route,
    'host_executor_runs_documented_installer_or_compose_pull_and_up',
  );
  assert.deepEqual(carrierVariants.get('docker_webui_image').preserved_mounts, [
    'OnePersonLab/data -> /data',
    'OnePersonLab/projects -> /projects',
  ]);
  assert.ok(
    carrierVariants.get('docker_webui_image').required_preservation_evidence.includes('data-preservation.txt'),
  );
  assert.match(
    carrierVariants.get('docker_webui_image').opl_update_apply_boundary,
    /must not report Docker\/WebUI image replacement as applied/,
  );
  assert.doesNotMatch(
    carrierVariants.get('docker_webui_image').opl_update_apply_boundary,
    /codex_surface/,
  );
  assert.equal(carrierVariants.get('linux_package_carrier').host_executor_required, true);
  assert.equal(carrierVariants.get('linux_package_carrier').managed_kernel_apply_allowed, false);

  assert.equal(lanes.get('runtime_substrate').adapter, 'runtime_substrate_adapter');
  assert.equal(
    lanes.get('runtime_substrate').rollback_status_source,
    'opl update rollback --component runtime_substrate --json#managed_update.execution.status',
  );
  assert.equal(lanes.get('capability_packages').adapter, 'capability_packages_adapter');
  assert.equal(
    lanes.get('capability_packages').post_apply,
    'sync_plugin_registry_plugin_packaged_skills_generated_surfaces_and_codex_surface_readiness',
  );
  assert.deepEqual(lanes.get('capability_packages').status_fields, [
    'agent_id',
    'package_tag',
    'version',
    'source',
    'conditions',
    'repair_actions',
    'components[].receipt.post_apply_hooks',
    'post_apply_sync.codex_surface',
    'readiness.codex_surface',
    'idempotency_lock.status',
    'execution.status',
    'components[].receipt.last_receipt_ref',
    'components[].receipt.repair_action',
  ]);
  assert.equal(lanes.get('capability_packages').codex_surface_substatus_source, 'managed_update_plane.codex_surface');
  assert.equal(lanes.get('codex_surface').adapter, 'codex_surface_status_adapter');
  assert.equal(lanes.get('codex_surface').parent_display_plane, 'capability_packages');
  assert.equal(lanes.get('codex_surface').user_visible_channel, false);
  assert.equal(lanes.get('workflow_profile').adapter, 'workflow_profile_adapter');
  assert.equal(lanes.get('workflow_profile').policy, 'semantic_merge_required_no_silent_overwrite');
  assert.deepEqual(lanes.get('workflow_profile').managed_profile_parts, ['AGENTS.md', 'TASTE.md', 'prompts']);
});

test('scheduler and UI surfaces consume new primary ids', () => {
  const releaseContract = readReleaseContract();
  const guiContract = readGuiContract();
  const pageStateMatrix = readPageStateMatrix();
  const plane = releaseContract.managed_update_plane;
  const updatePage = pageStateMatrix.pages.find((page) => page.id === 'update');
  const environmentPage = pageStateMatrix.pages.find((page) => page.id === 'environment');
  const aboutPage = pageStateMatrix.pages.find((page) => page.id === 'about');

  assert.deepEqual(plane.shell_integration.background_scheduler, {
    triggers: ['app_startup_after_core_ready', 'daily_background_maintenance', 'manual_check_updates'],
    lock_source: 'managed_update.idempotency_lock.status',
    backoff_policy: 'bounded_retry_with_last_failure_projection',
    user_blocking: false,
    must_project_last_run_and_next_run: true,
    auto_apply_policy: 'auto_apply_clean_opl_packages_only_with_codex_surface_as_post_apply_substatus',
    auto_apply_components: ['capability_packages'],
    never_auto_apply_components: ['installation_carrier', 'runtime_substrate', 'companion_tools', 'workflow_profile'],
    must_project_recent_actions_and_skip_reasons: true,
  });
  assert.deepEqual(plane.shell_integration.ui_actions, {
    refresh: 'opl update status --json',
    check: 'opl update check --json',
    plan: 'opl update plan --json',
    apply_managed_component: 'opl update apply --component <component_id> --json',
    apply_allowed_components: ['runtime_substrate', 'capability_packages', 'companion_tools'],
    apply_forbidden_components: ['installation_carrier', 'codex_surface', 'workflow_profile'],
    carrier_host_update_route:
      'carrier-specific host update route from installation_carrier.carrier_variants; Docker/WebUI image replacement requires host executor or manual route plus data volume preservation proof',
    repair_receipt: 'opl update repair --receipt <receipt_id> --json',
    rollback_component: 'opl update rollback --component <component_id> --json',
  });
  assert.deepEqual(releaseContract.standard_updater.forbidden_managed_update_targets, [
    'runtime_substrate',
    'capability_packages',
    'codex_surface',
    'companion_tools',
    'workflow_profile',
    'developer_checkout_selection',
    'homebrew_or_global_tool_upgrade',
  ]);
  for (const forbidden of [
    'runtime_substrate',
    'capability_packages',
    'codex_surface',
    'companion_tools',
    'workflow_profile',
    'developer_checkout_selection',
    'homebrew_or_global_tool_upgrade',
    'domain_truth',
  ]) {
    assert.ok(plane.standard_updater_boundary.forbidden_targets.includes(forbidden));
  }

  assert.deepEqual(guiContract.pages.update.sections, [
    'installation_carrier',
    'runtime_substrate',
    'companion_tools',
    'opl_packages',
    'workflow_profile',
  ]);
  assert.deepEqual(guiContract.pages.update.managed_update_plane.display_planes, [
    'installation_carrier',
    'runtime_substrate',
    'companion_tools',
    'capability_packages',
  ]);
  assert.deepEqual(updatePage.sections, guiContract.pages.update.sections);
  assert.deepEqual(updatePage.managed_update_plane.display_planes, guiContract.pages.update.managed_update_plane.display_planes);
  assert.ok(updatePage.must_show.includes('Runtime substrate managed updater status'));
  assert.ok(updatePage.must_show.includes('Companion tools managed updater status'));
  assert.ok(updatePage.must_show.includes('OPL Packages Codex Surface readiness and sync substatus'));
  assert.ok(updatePage.must_show.includes('Workflow profile semantic merge status when profile changes are available'));
  assert.equal(environmentPage.managed_update_plane_ref, 'contracts/app-release-channel.json#managed_update_plane');
  assert.equal(aboutPage.managed_update_plane_ref, undefined);
});

test('OPL Packages stay the capability package layer with Codex Surface as substatus', () => {
  const releaseContract = readReleaseContract();
  const plane = releaseContract.managed_update_plane;
  const packagePolicy = releaseContract.homebrew_tap_distribution.agent_pack_policy;

  assert.equal(packagePolicy.managed_update_plane, 'capability_packages');
  assert.equal(packagePolicy.adapter, 'capability_packages_adapter');
  assert.equal(packagePolicy.legacy_alias, 'agent_package_channel');
  assert.deepEqual(packagePolicy.managed_agent_ids, ['mas', 'mag', 'rca', 'oma', 'obf', 'scholarskills']);
  assert.equal(packagePolicy.default_update_mode, 'silent_background');
  assert.equal(packagePolicy.must_not_define_agent_semantics, true);
  assert.deepEqual(plane.capability_packages.post_update_sync_required, [
    'codex_plugin_registry',
    'plugin_packaged_skills',
    'opl_generated_plugin_surface',
    'codex_surface',
  ]);
  assert.deepEqual(plane.capability_packages.activation_commands, [
    'opl connect reconcile-modules',
    'opl connect sync-skills',
  ]);
  assert.deepEqual(packagePolicy.post_update_sync_required, plane.capability_packages.post_update_sync_required);
});
