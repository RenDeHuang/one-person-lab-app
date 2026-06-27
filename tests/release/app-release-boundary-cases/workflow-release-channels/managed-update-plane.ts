import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  activeShellRoot,
  sha256,
  workflowJobBlock,
  readFullPackageBuilderSource,
} from '../helpers.ts';

test('runtime toolchain updater is a separate silent App-owned channel', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const runtimeUpdater = releaseContract.runtime_toolchain_updater;

  assert.equal(runtimeUpdater.owner, 'one-person-lab-app');
  assert.equal(runtimeUpdater.role, 'app_owned_runtime_fallback_and_toolchain_layer_updates');
  assert.equal(runtimeUpdater.channel_manifest_asset, 'app-runtime-update-channel.json');
  assert.equal(runtimeUpdater.standard_updater_metadata_allowed, false);
  assert.equal(runtimeUpdater.standard_updater_latest_yml_allowed, false);
  assert.equal(runtimeUpdater.homebrew_tap_write_allowed, false);
  assert.equal(runtimeUpdater.default_policy.auto_check, true);
  assert.equal(runtimeUpdater.default_policy.download, 'silent_background');
  assert.equal(runtimeUpdater.default_policy.apply, 'stage_verified_payload_and_apply_on_next_app_restart');
  assert.equal(runtimeUpdater.default_policy.restart_prompt, 'none_until_user_restarts_app');
  assert.equal(runtimeUpdater.default_policy.user_blocking, false);
  assert.deepEqual(runtimeUpdater.system_tool_policy.preferred_sources, [
    'explicit_user_path',
    'system_path',
    'homebrew_formula',
    'app_owned_runtime_fallback',
  ]);
  assert.equal(runtimeUpdater.system_tool_policy.prefer_valid_newer_system_tool, true);
  assert.equal(runtimeUpdater.system_tool_policy.silent_global_mutation_allowed, false);
  assert.equal(runtimeUpdater.system_tool_policy.homebrew_upgrade_allowed_by_default, false);
  assert.deepEqual(runtimeUpdater.managed_components, [
    'codex_cli_fallback',
    'temporal_cli_archive',
    'node_runtime',
    'python_runtime',
    'uv_runtime',
    'officecli',
    'mineru_open_api',
    'companion_skills',
    'native_helper',
    'opl_framework_runtime',
  ]);
  assert.equal(runtimeUpdater.layering.activation, 'swap_current_pointer_on_app_restart_after_startup_smoke');
  assert.equal(runtimeUpdater.rollback_policy.rollback_on_startup_smoke_failure, true);
  assert.equal(runtimeUpdater.rollback_policy.rollback_must_not_mutate_user_global_tools, true);
  assert.ok(runtimeUpdater.verification.required_before_release.includes('full_dmg_clean_vm_smoke'));
  assert.ok(runtimeUpdater.verification.required_before_release.includes('homebrew_standard_cask_clean_vm_smoke'));
  assert.ok(runtimeUpdater.verification.clean_machine_installability_must_not_regress);
});

test('local data lifecycle separates updater cache cleanup from user artifact retention', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const lifecycle = releaseContract.local_data_lifecycle;

  assert.equal(lifecycle.owner, 'one-person-lab-app');
  assert.equal(lifecycle.policy_surface, 'Settings / Storage and Settings / Updates & Maintenance');
  assert.equal(lifecycle.user_data_silent_delete_allowed, false);
  assert.deepEqual(lifecycle.external_practice_basis, {
    docker_system_prune: 'unused_only_prompted_and_volume_opt_in',
    pnpm_store_prune: 'unreferenced_packages_only',
    hugging_face_cache: 'scan_dry_run_delete_unreferenced_revisions',
    electron_app_paths: 'separate_userData_cache_sessionData_logs_paths',
  });
  assert.equal(lifecycle.updater_cache.owner, 'active_shell');
  assert.equal(lifecycle.updater_cache.cache_dir, '~/Library/Caches/one-person-lab-aion-shell-updater');
  assert.deepEqual(lifecycle.updater_cache.retired_cache_dirs, ['~/Library/Caches/aionui-updater']);
  assert.equal(lifecycle.updater_cache.auto_cleanup, 'startup_and_before_install');
  assert.deepEqual(lifecycle.updater_cache.keep, [
    'pending/update-info.json',
    'currently_selected_update_package',
  ]);
  assert.deepEqual(lifecycle.updater_cache.delete, [
    'stale update.zip',
    'stale pending/*.zip',
    'stale platform installer packages',
  ]);
  assert.equal(lifecycle.updater_cache.receipt_required, true);
  assert.equal(lifecycle.storage_inventory.surface, 'Settings / Storage');
  assert.equal(
    lifecycle.storage_inventory.implementation,
    'shells/aionui/packages/desktop/src/process/services/localDataLifecycle/index.ts',
  );
  assert.equal(lifecycle.storage_inventory.execution_mode, 'scan_dry_run_first');
  assert.deepEqual(lifecycle.storage_inventory.sections, [
    'updater_cache',
    'conversation_artifacts',
    'runtime_toolchain',
    'logs',
  ]);
  assert.deepEqual(lifecycle.storage_inventory.required_fields, [
    'path',
    'exists',
    'bytes',
    'cleanup_mode',
    'silent_delete_allowed',
  ]);
  assert.equal(lifecycle.conversation_artifacts.default_policy, 'retain_until_user_cleanup_or_archive');
  assert.equal(lifecycle.conversation_artifacts.silent_delete_allowed, false);
  assert.equal(lifecycle.conversation_artifacts.cleanup_execution, 'archive_then_explicit_user_confirmed_delete');
  assert.equal(lifecycle.conversation_artifacts.archive_required_before_cleanup, true);
  assert.equal(lifecycle.conversation_artifacts.restore_proof_required, true);
  assert.equal(lifecycle.conversation_artifacts.cleanup_surface, 'Settings / Storage');
  assert.deepEqual(lifecycle.conversation_artifacts.archive_receipt_required_fields, [
    'conversation_id',
    'source_paths',
    'archive_path',
    'archive_sha256',
    'manifest_path',
    'restore_probe_path',
    'created_at',
  ]);
  assert.deepEqual(lifecycle.conversation_artifacts.delete_receipt_required_fields, [
    'conversation_id',
    'deleted_paths',
    'archive_receipt_path',
    'confirmed_at',
    'created_at',
  ]);
  assert.equal(lifecycle.runtime_toolchain.default_policy, 'retain_current_and_declared_rollback_runtime');
  assert.equal(lifecycle.runtime_toolchain.cleanup_execution, 'pointer_based_dry_run_first_explicit_execute_required');
  assert.equal(lifecycle.runtime_toolchain.prune_candidate_policy, 'unreferenced_runtime_roots_only');
  assert.equal(lifecycle.runtime_toolchain.dry_run_receipt_required, true);
  assert.deepEqual(lifecycle.runtime_toolchain.execute_receipt_required_fields, [
    'runtime_root',
    'dry_run_plan_id',
    'protected_paths',
    'deleted_paths',
    'deleted_bytes',
    'created_at',
  ]);
  assert.equal(lifecycle.logs.default_policy, 'bounded_rotation_or_user_cleanup');
  assert.equal(lifecycle.logs.cleanup_execution, 'bounded_rotation_dry_run_first');
  assert.equal(lifecycle.logs.dry_run_receipt_required, true);
  assert.equal(lifecycle.logs.retention.retain_days, 30);
  assert.deepEqual(lifecycle.logs.execute_receipt_required_fields, [
    'logs_root',
    'dry_run_plan_id',
    'deleted_paths',
    'deleted_bytes',
    'created_at',
  ]);
});

test('managed update plane unifies updater status while preserving adapter authority boundaries', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const plane = releaseContract.managed_update_plane;
  const lanes = new Map(plane.planes.map((entry) => [entry.id, entry]));
  const agentPolicy = releaseContract.homebrew_tap_distribution.agent_pack_policy;
  const updatePage = pageStateMatrix.pages.find((page) => page.id === 'update');
  const environmentPage = pageStateMatrix.pages.find((page) => page.id === 'environment');
  const aboutPage = pageStateMatrix.pages.find((page) => page.id === 'about');

  assert.equal(plane.owner, 'one-person-lab-app');
  assert.equal(plane.producer_owner, 'one-person-lab');
  assert.equal(plane.ui_page, 'Updates & Maintenance');
  assert.equal(plane.managed_kernel.id, 'opl_managed_updater_kernel');
  assert.equal(plane.managed_kernel.owner, 'one-person-lab');
  assert.equal(plane.managed_kernel.app_role, 'status_action_projection_consumer');
  assert.equal(plane.managed_kernel.app_must_not_implement_kernel, true);
  assert.equal(plane.managed_kernel.app_must_not_bypass_action_route, true);
  assert.deepEqual(plane.status_source_priority, [
    'opl app state --profile fast --json#managed_update_plane',
    'opl update status --json',
  ]);
  assert.deepEqual(plane.managed_kernel.channels_share, [
    'status_schema',
    'condition_model',
    'download_verify_stage_apply_lifecycle',
    'repair_action_refs',
    'rollback_receipts',
  ]);
  assert.deepEqual(plane.managed_kernel.lifecycle, [
    'read_manifest',
    'read_current_state',
    'diff_plan',
    'fetch_artifacts',
    'verify',
    'stage',
    'activate',
    'post_apply',
    'write_receipt',
    'report_status_or_repair',
  ]);
  assert.deepEqual(plane.managed_kernel.state_vocabulary, [
    'current',
    'update_available',
    'staged',
    'needs_restart',
    'needs_reload',
    'failed_with_repair',
    'skipped_manual_required',
  ]);
  assert.equal(plane.managed_kernel.idempotency_lock.lock_id, 'opl_managed_updater_kernel.global');
  assert.deepEqual(plane.managed_kernel.idempotency_lock.exclusive_operations, ['apply', 'repair', 'rollback']);
  assert.equal(
    plane.managed_kernel.idempotency_lock.contention_policy,
    'report_in_progress_or_skip_without_parallel_stage_or_plugin_sync',
  );
  assert.deepEqual(plane.shell_integration.required_ipc_surfaces, [
    'opl-runtime.get-managed-update-status',
    'opl-runtime.get-managed-update-check',
    'opl-runtime.get-managed-update-plan',
    'opl-runtime.run-managed-update-apply',
    'opl-runtime.run-managed-update-repair',
    'opl-runtime.run-managed-update-rollback',
  ]);
  assert.deepEqual(plane.shell_integration.allowed_cli_commands, [
    'opl update status --json',
    'opl update check --json',
    'opl update plan --json',
    'opl update apply --component <component_id> --json',
    'opl update repair --receipt <receipt_id> --json',
    'opl update rollback --component <component_id> --json',
  ]);
  assert.deepEqual(plane.shell_integration.background_scheduler, {
    triggers: ['app_startup_after_core_ready', 'daily_background_maintenance', 'manual_check_updates'],
    lock_source: 'managed_update.idempotency_lock.status',
    backoff_policy: 'bounded_retry_with_last_failure_projection',
    user_blocking: false,
    must_project_last_run_and_next_run: true,
    auto_apply_policy: 'auto_apply_clean_opl_packages_only_with_capability_exposure_as_post_apply_substatus',
    auto_apply_components: ['agent_package_channel'],
    never_auto_apply_components: ['app_binary', 'runtime_toolchain'],
    must_project_recent_actions_and_skip_reasons: true,
  });
  assert.deepEqual(plane.shell_integration.ui_actions, {
    refresh: 'opl update status --json',
    check: 'opl update check --json',
    plan: 'opl update plan --json',
    apply_component: 'opl update apply --component <component_id> --json',
    repair_receipt: 'opl update repair --receipt <receipt_id> --json',
    rollback_component: 'opl update rollback --component <component_id> --json',
  });
  assert.deepEqual(plane.shell_integration.forbidden_shell_behaviors, [
    'read_artifact_body',
    'read_or_write_domain_truth',
    'write_owner_receipt',
    'mutate_dirty_or_developer_checkout',
    'mutate_homebrew_or_system_tools',
    'bypass_framework_update_kernel',
  ]);
  assert.equal(
    plane.managed_kernel.component_receipt_shape.schema_version,
    'opl_managed_update_component_receipt.v1',
  );
  assert.deepEqual(plane.managed_kernel.public_cli_surfaces, [
    'opl update status --json',
    'opl update check --json',
    'opl update plan --json',
    'opl update apply --component <component_id> --json',
    'opl update repair --receipt <receipt_id> --json',
    'opl update rollback --component <component_id> --json',
  ]);
  assert.deepEqual(plane.managed_kernel.operation_modes, {
    status: 'read_only_projection',
    check: 'read_only_projection',
    plan: 'read_only_projection',
    apply: 'controlled_apply',
    repair: 'controlled_repair',
    rollback: 'controlled_rollback',
  });
  assert.deepEqual(plane.managed_kernel.receipt_write_policy, {
    status: 'read_only',
    check: 'read_only',
    plan: 'read_only',
    apply: 'recorded_component_receipt',
    repair: 'recorded_component_receipt',
    rollback: 'recorded_component_receipt',
  });
  assert.deepEqual(plane.managed_kernel.status_projection_required_fields, [
    'operation',
    'operation_mode',
    'update_channel',
    'idempotency_lock.status',
    'summary',
    'components',
    'repair_actions',
    'receipts.write_policy',
    'authority_boundary',
  ]);
  assert.deepEqual(plane.managed_kernel.runner_result_required_fields, [
    'operation',
    'operation_mode',
    'execution.status',
    'idempotency_lock.status',
    'component_id',
    'components[].receipt.last_receipt_ref',
    'components[].receipt.repair_action',
    'components[].receipt.rollback_ref',
    'components[].receipt.post_apply_hooks',
    'execution.receipt_record.receipt_refs',
    'reload_guidance',
    'recent_actions',
    'skipped_reasons',
  ]);
  assert.deepEqual(plane.managed_kernel.component_receipt_shape.required_fields, [
    'source_manifest_ref',
    'from_version',
    'from_digest',
    'to_version',
    'to_digest',
    'verify_result',
    'activated_at',
    'post_apply_hooks',
    'rollback_ref',
    'repair_action',
  ]);
  assert.deepEqual(plane.managed_kernel.component_receipt_shape.identity_fields, [
    'digest',
    'sha256',
    'source_fingerprint',
    'git_head_sha',
    'runtime_version',
    'current_pointer',
    'staged_root',
    'plugin_manifest_hash',
    'skill_pack_hash',
    'generated_surface_hash',
  ]);
  assert.deepEqual(plane.managed_kernel.condition_shape.required_fields, [
    'type',
    'status',
    'reason',
    'message',
    'observed_generation',
  ]);
  assert.deepEqual(plane.managed_kernel.condition_shape.status_values, ['True', 'False', 'Unknown']);

  assert.equal(lanes.get('app_binary').updater_kind, 'standard_updater');
  assert.equal(lanes.get('app_binary').adapter, 'electron_standard_updater');
  assert.equal(lanes.get('app_binary').post_apply, 'verify_running_version_after_restart_or_report_recovery');
  assert.deepEqual(lanes.get('app_binary').status_fields, [
    'installed_version',
    'available_version',
    'channel',
    'downloaded_version',
    'download_progress',
    'restart_required',
    'apply_started',
    'applied_version',
    'running_version_switched',
    'install_not_applied_reason',
    'cached_update_path',
    'repair_actions',
  ]);
  assert.equal(
    lanes.get('app_binary').repair_action_scope,
    'app_release_check_download_retry_or_install_downloaded_update_only',
  );
  assert.equal(releaseContract.standard_updater.scope, 'desktop_app_assets_only');
  assert.equal(releaseContract.standard_updater.managed_update_plane, 'app_binary_only');
  assert.equal(releaseContract.standard_updater.module_package_update_allowed, false);
  assert.equal(releaseContract.standard_updater.developer_checkout_selection_allowed, false);
  assert.deepEqual(releaseContract.standard_updater.forbidden_managed_update_targets, [
    'runtime_toolchain',
    'agent_package_channel',
    'capability_exposure',
    'developer_checkout_selection',
    'homebrew_or_global_tool_upgrade',
  ]);

  assert.equal(lanes.get('runtime_toolchain').updater_kind, 'managed_updater_kernel');
  assert.equal(lanes.get('runtime_toolchain').adapter, 'runtime_toolchain_adapter');
  assert.equal(lanes.get('runtime_toolchain').policy, 'silent_background_verified_stage_apply_on_next_restart');
  assert.equal(lanes.get('runtime_toolchain').post_apply, 'startup_smoke_then_swap_runtime_current_pointer_with_rollback');
  assert.deepEqual(lanes.get('runtime_toolchain').status_fields, [
    'runtime_version',
    'components',
    'conditions',
    'staged_version',
    'restart_required',
    'repair_actions',
    'idempotency_lock.status',
    'execution.status',
    'components[].receipt.last_receipt_ref',
    'components[].receipt.rollback_ref',
    'components[].receipt.repair_action',
  ]);
  assert.deepEqual(lanes.get('runtime_toolchain').component_receipt_identity_fields, [
    'runtime_version',
    'current_pointer',
    'staged_root',
    'sha256',
  ]);
  assert.equal(
    lanes.get('runtime_toolchain').rollback_status_source,
    'opl update rollback --component runtime_toolchain --json#managed_update.execution.status',
  );
  assert.equal(
    lanes.get('runtime_toolchain').repair_status_source,
    'opl update repair --receipt <receipt_id> --json#managed_update.execution.status',
  );
  assert.equal(releaseContract.runtime_toolchain_updater.kernel, 'opl_managed_updater_kernel');
  assert.equal(releaseContract.runtime_toolchain_updater.adapter, 'runtime_toolchain_adapter');
  assert.equal(releaseContract.runtime_toolchain_updater.standard_updater_metadata_allowed, false);
  assert.equal(releaseContract.runtime_toolchain_updater.standard_updater_latest_yml_allowed, false);
  assert.equal(releaseContract.runtime_toolchain_updater.homebrew_tap_write_allowed, false);

  assert.equal(lanes.get('agent_package_channel').updater_kind, 'managed_updater_kernel');
  assert.equal(lanes.get('agent_package_channel').adapter, 'agent_package_channel_adapter');
  assert.equal(lanes.get('agent_package_channel').policy, 'ordinary_user_non_development_silent_background');
  assert.equal(
    lanes.get('agent_package_channel').post_apply,
    'sync_plugin_registry_plugin_packaged_skills_generated_surfaces_and_capability_exposure_readiness',
  );
  assert.deepEqual(lanes.get('agent_package_channel').status_fields, [
    'agent_id',
    'package_tag',
    'version',
    'source',
    'conditions',
    'repair_actions',
    'components[].receipt.post_apply_hooks',
    'post_apply_sync.capability_exposure',
    'readiness.capability_exposure',
    'idempotency_lock.status',
    'execution.status',
    'components[].receipt.last_receipt_ref',
    'components[].receipt.repair_action',
  ]);
  assert.deepEqual(lanes.get('agent_package_channel').post_apply_sync, {
    status_field: 'components[].receipt.post_apply_hooks',
    required_hooks: [
      'reconcile_modules',
      'sync_skills',
      'sync_plugin_registry',
      'sync_plugin_packaged_skills',
      'sync_oma_generated_plugin_surface',
      'sync_bookforge_generated_plugin_surface',
      'sync_scholarskills_package_surface',
      'capability_exposure_readiness',
    ],
    reload_guidance: 'reload_app_and_codex_plugin_cache_when_post_apply_sync_changes_visible_plugin_or_skill_surface',
    auto_apply_eligibility: 'clean_managed_module_roots_only',
    auto_apply_denial_reasons: [
      'dirty_checkout',
      'developer_profile_checkout',
      'manual_required_condition',
      'idempotency_lock_in_progress',
      'verification_failed',
    ],
  });
  assert.equal(lanes.get('capability_exposure').updater_kind, 'managed_visibility_projection');
  assert.equal(lanes.get('capability_exposure').adapter, 'codex_exposure_status_adapter');
  assert.equal(
    lanes.get('capability_exposure').policy,
    'display_visibility_and_repair_actions_without_duplicate_semantics',
  );
  assert.deepEqual(lanes.get('capability_exposure').status_fields, [
    'codex_plugin_registry',
    'plugin_packaged_skills',
    'opl_generated_plugin_surface',
    'conditions',
    'repair_actions',
    'components[].receipt.post_apply_hooks',
    'reload_required',
    'reload_guidance',
  ]);
  assert.equal(
    lanes.get('capability_exposure').reload_guidance,
    'manual_reload_only_after_framework_reports_needs_reload_or_post_apply_sync_changed_cached_capability_surface',
  );

  assert.equal(lanes.get('agent_package_channel').display_group, 'OPL Packages');
  assert.equal(lanes.get('agent_package_channel').display_label_en, 'OPL Packages');
  assert.equal(lanes.get('agent_package_channel').display_label_zh, 'OPL 能力包');
  assert.equal(
    lanes.get('agent_package_channel').capability_exposure_substatus_source,
    'managed_update_plane.capability_exposure',
  );
  assert.equal(lanes.get('capability_exposure').display_group, 'OPL Packages');
  assert.equal(lanes.get('capability_exposure').user_visible_channel, false);
  assert.deepEqual(lanes.get('agent_package_channel').package_agent_ids, [
    'mas',
    'mag',
    'rca',
    'oma',
    'obf',
    'scholarskills',
  ]);
  assert.equal(agentPolicy.registry, 'ghcr.io');
  assert.equal(agentPolicy.source_role, 'ordinary_user_non_development_opl_package_update_source');
  assert.equal(agentPolicy.default_update_mode, 'silent_background');
  assert.deepEqual(agentPolicy.managed_agent_ids, ['mas', 'mag', 'rca', 'oma', 'obf', 'scholarskills']);
  assert.deepEqual(plane.agent_package_channel.post_update_sync_required, [
    'codex_plugin_registry',
    'plugin_packaged_skills',
    'opl_generated_plugin_surface',
  ]);
  assert.deepEqual(plane.agent_package_channel.activation_commands, [
    'opl connect reconcile-modules',
    'opl connect sync-skills',
  ]);
  assert.equal(
    plane.agent_package_channel.background_apply_policy,
    'apply_after_check_or_plan_when_all_opl_package_components_are_clean_managed_and_update_available',
  );
  assert.deepEqual(plane.agent_package_channel.background_apply_must_record, [
    'last_auto_apply_at',
    'last_auto_apply_component_ids',
    'last_auto_apply_receipt_refs',
    'last_auto_apply_post_apply_hooks',
    'last_auto_apply_skip_reasons',
    'reload_guidance',
  ]);
  assert.deepEqual(agentPolicy.post_update_sync_required, plane.agent_package_channel.post_update_sync_required);
  assert.equal(agentPolicy.developer_checkout_override_policy, 'explicit_developer_profile_source_channel_only');
  assert.equal(agentPolicy.homebrew_distribution_allowed, false);
  assert.equal(agentPolicy.homebrew_formula_allowed, false);
  assert.equal(agentPolicy.must_not_define_agent_semantics, true);

  for (const forbidden of [
    'runtime_toolchain',
    'agent_package_channel',
    'capability_exposure',
    'developer_checkout_selection',
    'homebrew_or_global_tool_upgrade',
    'domain_truth',
  ]) {
    assert.ok(plane.standard_updater_boundary.forbidden_targets.includes(forbidden));
  }
  assert.deepEqual(plane.standard_updater_boundary.apply_lifecycle, {
    downloaded_state_is_not_success: true,
    apply_started_receipt: 'auto-update-diagnostics.json#quit-and-install',
    post_restart_version_gate: 'running_app_version_must_be_gte_downloaded_target_version',
    failure_state: 'install-not-applied',
    recovery_action: 'install_downloaded_update_now',
  });
  for (const forbidden of [
    'Developer Profile checkout',
    'dirty checkout',
    'domain truth',
    'owner receipt',
    'quality verdict',
    'export verdict',
    'Homebrew/global tools',
  ]) {
    assert.ok(plane.forbidden_silent_overwrite_scope.includes(forbidden));
  }
  for (const forbidden of [
    'framework_update_kernel_implementation',
    'runtime_truth',
    'domain_truth',
    'owner_receipt_authority',
    'domain_quality_verdict',
    'domain_export_verdict',
    'artifact_body',
    'homebrew_global_tool_mutation',
    'developer_checkout_mutation',
  ]) {
    assert.ok(plane.forbidden_app_authority.includes(forbidden));
  }
  assert.deepEqual(agentPolicy.forbidden_silent_overwrite_scope, plane.forbidden_silent_overwrite_scope);
  assert.deepEqual(releaseContract.runtime_toolchain_updater.forbidden_silent_overwrite_scope, plane.forbidden_silent_overwrite_scope);

  assert.equal(guiContract.framework_surfaces.managed_update_plane.contract, 'contracts/app-release-channel.json#managed_update_plane');
  assert.equal(guiContract.framework_surfaces.managed_update_plane.status_command, 'opl update status --json');
  assert.deepEqual(guiContract.framework_surfaces.managed_update_plane.ipc_bridge_required, [
    'opl-runtime.get-managed-update-status',
    'opl-runtime.get-managed-update-check',
    'opl-runtime.get-managed-update-plan',
    'opl-runtime.run-managed-update-apply',
    'opl-runtime.run-managed-update-repair',
    'opl-runtime.run-managed-update-rollback',
  ]);
  assert.equal(
    guiContract.framework_surfaces.managed_update_plane.background_scheduler_required,
    'startup_daily_and_manual_check_with_lock_and_backoff',
  );
  assert.equal(guiContract.framework_surfaces.managed_update_plane.app_role, 'status_conditions_repair_actions_consumer_only');
  assert.equal(guiContract.framework_surfaces.managed_update_plane.artifact_body_access, false);
  assert.equal(guiContract.framework_surfaces.managed_update_plane.domain_truth_write_access, false);
  assert.equal(guiContract.framework_surfaces.managed_update_plane.owner_receipt_write_access, false);
  assert.equal(guiContract.framework_surfaces.managed_update_plane.quality_verdict_authority, false);
  assert.equal(guiContract.framework_surfaces.managed_update_plane.global_tool_mutation_allowed, false);
  assert.equal(guiContract.framework_surfaces.managed_update_plane.developer_checkout_mutation_allowed, false);

  assert.equal(guiContract.pages.update.status_source, 'opl update status --json');
  assert.equal(guiContract.pages.update.action_source, 'opl update apply/repair/rollback --json through shell IPC');
  assert.deepEqual(guiContract.pages.update.background_maintenance_status_fields, [
    'last_run_at',
    'next_run_at',
    'last_failure',
    'idempotency_lock.status',
    'execution.status',
    'recent_actions',
    'skipped_reasons',
    'reload_guidance',
  ]);
  assert.deepEqual(guiContract.pages.update.sections, [
    'app_binary',
    'runtime_toolchain',
    'opl_packages',
  ]);
  assert.deepEqual(guiContract.pages.update.managed_update_plane.display_planes, [
    'app_binary',
    'runtime_toolchain',
    'agent_package_channel',
  ]);
  assert.deepEqual(updatePage.sections, guiContract.pages.update.sections);
  assert.equal(updatePage.page_contract, 'updates_and_maintenance');
  assert.equal(updatePage.status_source, 'opl update status --json');
  assert.deepEqual(updatePage.background_maintenance_status_fields, [
    'last_run_at',
    'next_run_at',
    'last_failure',
    'idempotency_lock.status',
    'execution.status',
    'recent_actions',
    'skipped_reasons',
    'reload_guidance',
  ]);
  assert.ok(updatePage.must_show.includes('OPL Packages managed updater status'));
  assert.ok(updatePage.must_not_show.includes('dirty checkout overwrite as a repair action'));
  assert.ok(updatePage.must_not_show.includes('quality/export verdict controls'));
  assert.ok(updatePage.must_not_show.includes('Homebrew/global tool silent upgrade controls'));
  assert.equal(environmentPage.managed_update_plane_ref, 'contracts/app-release-channel.json#managed_update_plane');
  assert.ok(environmentPage.must_show.includes('OPL Packages status and post-update sync status'));
  assert.ok(environmentPage.must_not_show.includes('Developer Profile checkout as a silent update target'));
  assert.equal(aboutPage.managed_update_plane_ref, 'contracts/app-release-channel.json#managed_update_plane');
  assert.ok(aboutPage.must_show.includes('Updates & Maintenance entry on About & Updates'));
});
