import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { validateReleaseFullFirstInstallPayloads } from './release-full-first-install-payload-validator.ts';
import { validateReleaseHomebrewDistribution } from './release-homebrew-distribution-validator.ts';
import { managedUpdateCarrierAdapters, managedUpdateSoftwareObjectIds } from './managed-update-plane-policy.ts';
import { assertShellTextIncludesAll } from './shell-implementation-helpers.ts';

export function validateReleaseChannelContract(releaseChannel, shellPaths = null) {
  const managedUpdatePlane = releaseChannel.managed_update_plane;
  validateStandardUpdater(releaseChannel.standard_updater);
  validateLocalDataLifecycle(releaseChannel.local_data_lifecycle, shellPaths);
  validateWebuiGhcrImage(releaseChannel.webui_ghcr_image);
  validateManagedUpdatePlane(managedUpdatePlane);
  validateReleaseExecutionPolicy(releaseChannel.release_acceleration);
  validateReleaseHomebrewDistribution(releaseChannel);
  validateReleaseFullFirstInstallPayloads(releaseChannel);
}

function validateStandardUpdater(updater) {
  if (
    updater?.scope !== 'desktop_app_assets_only' ||
    updater?.module_package_update_allowed !== false ||
    updater?.opl_flow_install_allowed !== false ||
    updater?.post_update_reconcile_ref !== 'managed_update_plane.carrier_reconciliation'
  ) {
    throw new Error('Standard updater must remain App-binary-only and join the carrier-neutral Framework reconciliation path');
  }
}

function validateReleaseExecutionPolicy(acceleration) {
  const prepare = acceleration?.cohort_prepare;
  const intent = prepare?.release_intent_policy;
  const fullAddonTerminal = intent?.full_addon_terminal_policy;
  const nextAction = prepare?.next_action_policy;
  const operatorPlan = prepare?.operator_plan_policy;
  const attemptSwitch = acceleration?.gate_reuse?.attempt_strategy_switch;
  const monitor = acceleration?.release_operator?.active_monitor_policy;
  const settingsReadiness = acceleration?.settings_page_readiness_policy;
  const assistantRouteSmoke = acceleration?.assistant_route_smoke_policy;
  const publishResume = acceleration?.publish_resume;
  const publishRecovery = publishResume?.release_upload_failure_recovery;
  const draftCleanup = publishResume?.draft_candidate_cleanup;
  assertDeepEqualJson(intent?.allowed_values, ['stable_complete', 'standard_hotfix'], 'Release intent allowed values');
  if (
    intent?.workflow_input !== 'release_intent' ||
    intent?.stable_complete?.standard_terminal_independent !== true ||
    intent?.stable_complete?.run_vm_smoke !== true ||
    intent?.stable_complete?.include_full_package_required !== false ||
    intent?.stable_complete?.include_full_package_role !== 'optional_same_cohort_nonblocking_addon_intent' ||
    intent?.standard_hotfix?.include_full_package !== false ||
    intent?.standard_hotfix?.full_omission_reason_required !== true ||
    intent?.standard_hotfix?.standard_terminal_independent !== true ||
    fullAddonTerminal?.intent_input !== 'include_full_package' ||
    fullAddonTerminal?.intent_role !== 'same_cohort_nonblocking_addon_intent' ||
    fullAddonTerminal?.dispatch_after !== 'standard_stable_terminal' ||
    fullAddonTerminal?.completion_required_for_standard_terminal !== false ||
    fullAddonTerminal?.independent_receipt_required !== true
  ) {
    throw new Error('Release intent must keep Standard terminal independent and treat Full only as a same-cohort non-blocking add-on intent');
  }
  if (
    nextAction?.canonical_command_prefix !== 'npm run release:stable -- start' ||
    nextAction?.default_mode !== 'dry_run' ||
    nextAction?.execute_flag_required_for_broker_submission !== true ||
    nextAction?.direct_workflow_dispatch_allowed !== false
  ) {
    throw new Error('Release cohort planning must route only through the dry-run canonical Stable controller');
  }
  if (
    operatorPlan?.workflow_input !== 'release_operator_plan_ref' ||
    operatorPlan?.required !== true ||
    operatorPlan?.format !== 'sha256:<64-lowercase-hex>'
  ) {
    throw new Error('Release dispatch must require a cohort-bound release operator plan ref');
  }
  assertIncludesAll(
    operatorPlan.binds,
    ['release_intent', 'full_omission_reason', 'app_sha', 'shell_sha', 'framework_sha'],
    'Release operator plan binding fields',
  );
  if (
    attemptSwitch?.window_minutes !== 90 ||
    attemptSwitch?.prior_attempt_threshold !== 3 ||
    attemptSwitch?.workflow_input !== 'gate_reuse_plan_ref' ||
    attemptSwitch?.required_before_next_full_train !== true ||
    attemptSwitch?.timeout_is_abandonment_condition !== false
  ) {
    throw new Error('Repeated release attempts must switch to same-cohort reuse after the 90-minute threshold');
  }
  if (
    publishResume?.new_release_upload_failure_cleanup !== undefined ||
    publishRecovery?.remote_state !== 'typed_incomplete_draft_retained' ||
    publishRecovery?.receipt_schema !== 'opl_app_release_publish_recovery_receipt.v1' ||
    publishRecovery?.receipt_default_path !== 'release-publish-recovery-receipt.json' ||
    publishRecovery?.resume_strategy !== 'read_back_then_resume_same_draft_same_cohort' ||
    publishRecovery?.automatic_release_delete_allowed !== false ||
    publishRecovery?.automatic_tag_cleanup_allowed !== false ||
    publishRecovery?.ordinary_release_workflow_delete_allowed !== false
  ) {
    throw new Error('Release upload failure must retain a typed incomplete draft and write a recovery receipt without implicit deletion');
  }
  assertIncludesAll(
    publishRecovery.receipt_required_fields,
    [
      'repository',
      'version',
      'tag',
      'failure.stage',
      'draft.origin',
      'draft.readback',
      'draft.automatic_release_delete_attempted',
      'draft.automatic_tag_cleanup_attempted',
      'upload.planned_assets',
      'upload.uploaded_assets',
      'upload.remaining_assets',
      'recovery.strategy',
      'recovery.destructive_cleanup_authority',
    ],
    'Release publish recovery receipt required fields',
  );
  if (
    draftCleanup?.workflow !== '.github/workflows/desktop-release-cleanup-drafts.yml' ||
    draftCleanup?.summary_schema !== 'opl_release_draft_candidate_cleanup.v2' ||
    draftCleanup?.discovery_mode !== 'read_only' ||
    draftCleanup?.execution_authority !== 'independent_isolated_release_mutation_broker' ||
    draftCleanup?.required_broker_mutation !== 'release_draft_cleanup' ||
    draftCleanup?.broker_mutation !== null ||
    draftCleanup?.availability !== 'unavailable_until_broker_cleanup_mutation_is_provisioned' ||
    draftCleanup?.broker_acceptance_receipt_required !== true ||
    draftCleanup?.command !== undefined ||
    draftCleanup?.direct_github_release_delete_allowed !== false ||
    draftCleanup?.direct_tag_cleanup_allowed !== false ||
    draftCleanup?.ordinary_release_workflow_cleanup_allowed !== false
  ) {
    throw new Error('Draft cleanup must fail closed until an independent signed broker mutation is provisioned');
  }
  if (
    monitor?.command !== 'npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha>' ||
    monitor?.poll_interval_seconds !== null ||
    monitor?.single_monitor_process !== false ||
    monitor?.terminal_handoff !== 'release_stable_reconcile_once' ||
    !monitor?.forbidden_patterns?.includes('direct_gh_run_watch')
  ) {
    throw new Error('Release monitoring must use read-only operator status followed by one typed Stable reconcile');
  }
  assertIncludesAll(
    settingsReadiness?.required_signals,
    ['expected_route_hash', 'stable_page_data_testid', 'nonempty_page_text', 'app_loader_not_visible'],
    'Settings VM semantic readiness signals',
  );
  assertIncludesAll(
    settingsReadiness?.forbidden_release_gate_signals,
    ['localized_button_copy', 'localized_heading_copy', 'retired_runtime_status_label'],
    'Settings VM forbidden copy gates',
  );
  assertDeepEqualJson(
    assistantRouteSmoke?.standard?.required,
    [
      'MAS_MAG_RCA_home_starters_visible',
      'package_not_installed_starters_selectable',
      'launch_allowed_false_at_send',
      'readiness_and_repair_hint_visible',
    ],
    'Standard assistant launch-gate requirements',
  );
  assertIncludesAll(
    assistantRouteSmoke?.full?.required,
    [
      'owner_projected_required_payload_fields_satisfied_before_send',
      'agent_package_activate_action_per_starter',
      'real_guid_composer_send_per_starter',
      'conversation_get_readback_per_starter',
      'agent_package_activation_receipt_per_starter',
      'agent_package_shortcut_route_receipt_per_starter',
    ],
    'Full assistant production launch-path requirements',
  );
  assertIncludesAll(
    assistantRouteSmoke?.full?.forbidden,
    [
      'direct_conversation_post',
      'synthetic_agent_package_activation_receipt',
      'synthetic_agent_package_route_receipt',
    ],
    'Full assistant synthetic launch-path prohibitions',
  );
  if (
    assistantRouteSmoke?.standard?.verification_mode !== 'launch_gate' ||
    assistantRouteSmoke?.full?.verification_mode !== 'route_receipt' ||
    !assistantRouteSmoke?.standard?.forbidden?.includes('claim_agent_package_shortcut_route_receipt') ||
    !assistantRouteSmoke?.full?.required?.includes('agent_package_shortcut_route_receipt_per_starter')
  ) {
    throw new Error('Release assistant smoke must separate Standard launch gates from Full route receipts');
  }
}

function validateWebuiGhcrImage(webuiImage) {
  const contract = webuiImage?.runtime_image_contract;
  if (
    webuiImage?.owner !== 'one-person-lab-app' ||
    webuiImage?.distribution_role !== 'preheated_webui_runtime_image_not_desktop_app_gui_shell' ||
    contract?.image_role !== 'browser_entrypoint_for_opl_on_linux_container' ||
    contract?.profiles?.webui_full?.default_for_beginner_and_stable_channel !== true ||
    contract?.profiles?.webui_full?.metadata_only_allowed !== false ||
    contract?.profiles?.webui_slim?.version_tag !== '<app_or_opl_version>-slim' ||
    contract?.profiles?.webui_slim?.stable_channel_allowed !== false ||
    contract?.profiles?.webui_slim?.moving_tags_allowed !== false ||
    webuiImage?.immutable_version_writer !== '.github/workflows/desktop-release.yml' ||
    webuiImage?.stable_promotion_workflow !== '.github/workflows/desktop-release-promote.yml' ||
    webuiImage?.stable_writer_count !== 1
  ) {
    throw new Error('Release channel must declare Docker/WebUI full and slim image profile boundaries');
  }
  assertIncludesAll(
    contract.required_runtime_contents,
    [
      'webui_static_assets',
      'aionui_web_standalone_launcher',
      'bundled_aioncore',
      'opl_bootstrap_installer',
      'image_manifest',
      'opl_seed_metadata',
      'preheated_seed_payload',
    ],
    'Docker/WebUI runtime image required contents',
  );
  assertIncludesAll(
    contract.profiles.webui_full?.required_seed_components,
    ['opl_framework', 'codex_cli', 'companion_skills', 'domain_modules'],
    'Docker/WebUI full image seed components',
  );
  assertDeepEqualJson(
    contract.profiles.webui_full?.seed_strategy,
    ['payload_manifest', 'payload_preheated'],
    'Docker/WebUI full image seed strategy',
  );
  assertDeepEqualJson(
    contract.profiles.webui_slim?.seed_strategy,
    ['metadata_only'],
    'Docker/WebUI slim image seed strategy',
  );
  if (
    contract.image_manifest?.canonical_path !== '/opt/opl/image-manifest.json' ||
    contract.seed_metadata?.canonical_path !== '/opt/opl/seed/metadata.json' ||
    contract.publish_gate?.script !== 'scripts/validate-webui-runtime-image.ts' ||
    contract.publish_gate?.stable_channel_expected_profile !== 'webui-full' ||
    contract.publish_gate?.forbidden_success_state !== 'metadata_only_seed_promoted_to_stable'
  ) {
    throw new Error('Docker/WebUI GHCR publishing must validate canonical manifest, seed metadata, and full profile before stable tags');
  }
  assertIncludesAll(
    contract.publish_gate?.must_read_back,
    [
      'docker_image_inspect',
      'image_manifest',
      'seed_metadata',
      'runtime_cli_shims',
      'preheated_payload_files',
      'declared_volumes',
      'runtime_env',
      'projects_mount_readback',
      'install_manifest_receipt',
      'startup_maintenance_log',
      'auto_login_smoke',
    ],
    'Docker/WebUI publish gate readback',
  );
}

function validateLocalDataLifecycle(lifecycle, shellPaths) {
  if (
    lifecycle?.owner !== 'one-person-lab-app' ||
    lifecycle?.policy_surface !== 'Settings / Storage and Settings / Updates & Maintenance' ||
    lifecycle?.user_data_silent_delete_allowed !== false
  ) {
    throw new Error('Release channel must declare App-owned local data lifecycle without silent user-data deletion');
  }
  assertDeepEqualJson(
    lifecycle.external_practice_basis,
    {
      docker_system_prune: 'unused_only_prompted_and_volume_opt_in',
      pnpm_store_prune: 'unreferenced_packages_only',
      hugging_face_cache: 'scan_dry_run_delete_unreferenced_revisions',
      electron_app_paths: 'separate_userData_cache_sessionData_logs_paths',
    },
    'Local data lifecycle external practice basis',
  );
  if (
    lifecycle.updater_cache?.owner !== 'active_shell' ||
    lifecycle.updater_cache?.implementation !==
      'shells/aionui/packages/desktop/src/process/services/autoUpdateCacheCleanup.ts' ||
    lifecycle.updater_cache?.cache_dir !== '~/Library/Caches/one-person-lab-aion-shell-updater' ||
    lifecycle.updater_cache?.auto_cleanup !== 'startup_and_before_install'
  ) {
    throw new Error('Local data lifecycle must bind updater cache cleanup to the active shell implementation');
  }
  assertDeepEqualJson(
    lifecycle.updater_cache?.keep,
    ['pending/update-info.json', 'currently_selected_update_package'],
    'Local data lifecycle updater cache keep set',
  );
  assertDeepEqualJson(
    lifecycle.updater_cache?.delete,
    ['stale update.zip', 'stale pending/*.zip', 'stale platform installer packages'],
    'Local data lifecycle updater cache delete set',
  );
  assertDeepEqualJson(
    lifecycle.updater_cache?.retired_cache_dirs,
    ['~/Library/Caches/aionui-updater'],
    'Local data lifecycle retired updater cache roots',
  );
  assertIncludesAll(
    lifecycle.storage_inventory?.sections,
    ['updater_cache', 'user_data_artifacts', 'runtime_substrate', 'logs'],
    'Local data lifecycle storage inventory sections',
  );
  assertIncludesAll(
    lifecycle.storage_inventory?.required_fields,
    ['path', 'exists', 'bytes', 'cleanup_mode', 'silent_delete_allowed'],
    'Local data lifecycle storage inventory required fields',
  );
  if (
    lifecycle.storage_inventory?.surface !== 'Settings / Storage' ||
    lifecycle.storage_inventory?.execution_mode !== 'scan_dry_run_first' ||
    lifecycle.storage_inventory?.implementation !==
      'shells/aionui/packages/desktop/src/process/services/localDataLifecycle/index.ts' ||
    lifecycle.updater_cache?.receipt_required !== true ||
    lifecycle.user_data_artifacts?.default_policy !== 'retain_conversations_workspaces_and_artifacts_until_user_cleanup_or_archive' ||
    lifecycle.user_data_artifacts?.silent_delete_allowed !== false ||
    lifecycle.user_data_artifacts?.cleanup_execution !== 'archive_then_explicit_user_confirmed_delete' ||
    lifecycle.user_data_artifacts?.archive_required_before_cleanup !== true ||
    lifecycle.user_data_artifacts?.restore_proof_required !== true ||
    lifecycle.user_data_artifacts?.cleanup_surface !== 'Settings / Storage' ||
    lifecycle.runtime_substrate?.default_policy !== 'retain_current_and_declared_rollback_runtime' ||
    lifecycle.runtime_substrate?.owner_ref !== 'contracts/app-release-channel.json#managed_update_plane.software_lifecycle.objects.opl_base' ||
    lifecycle.runtime_substrate?.cleanup_execution !== 'pointer_based_dry_run_first_explicit_execute_required' ||
    lifecycle.runtime_substrate?.protected_refs?.current_pointer !==
      '~/Library/Application Support/OPL/runtime/current.json' ||
    lifecycle.runtime_substrate?.protected_refs?.current_root !==
      '~/Library/Application Support/OPL/runtime/current' ||
    lifecycle.runtime_substrate?.prune_candidate_policy !== 'unreferenced_marker_backed_runtime_generations_only' ||
    lifecycle.runtime_substrate?.dry_run_receipt_required !== true ||
    lifecycle.logs?.default_policy !== 'bounded_rotation_or_user_cleanup' ||
    lifecycle.logs?.silent_delete_allowed !== false ||
    lifecycle.logs?.cleanup_execution !== 'bounded_rotation_dry_run_first' ||
    lifecycle.logs?.dry_run_receipt_required !== true ||
    lifecycle.logs?.retention?.retain_days !== 30 ||
    lifecycle.logs?.retention?.retain_files_minimum !== 7 ||
    lifecycle.logs?.retention?.max_file_bytes !== 10485760
  ) {
    throw new Error('Local data lifecycle must retain user artifacts and bind runtime/log cleanup to explicit policy surfaces');
  }
  assertDeepEqualJson(
    lifecycle.user_data_artifacts?.archive_receipt_required_fields,
    ['conversation_id', 'source_paths', 'archive_path', 'archive_sha256', 'manifest_path', 'restore_probe_path', 'created_at'],
    'Local data lifecycle conversation archive receipt fields',
  );
  assertDeepEqualJson(
    lifecycle.user_data_artifacts?.delete_receipt_required_fields,
    ['conversation_id', 'deleted_paths', 'archive_receipt_path', 'confirmed_at', 'created_at'],
    'Local data lifecycle conversation delete receipt fields',
  );
  const deleteBoundary = lifecycle.user_data_artifacts?.delete_execution_boundary;
  assertDeepEqualJson(
    deleteBoundary?.required_inputs,
    ['archiveReceiptPath', 'archiveRoot', 'receiptRoot', 'allowedSourcePaths'],
    'Local data lifecycle conversation delete verifier inputs',
  );
  if (
    deleteBoundary?.canonical_verifier !== 'verifyConversationArchiveReceipt' ||
    deleteBoundary?.receipt_path_must_be_inside_receipt_root !== true ||
    deleteBoundary?.archive_path_must_be_inside_archive_root !== true ||
    deleteBoundary?.manifest_source_paths_must_equal_current_conversation_roots !== true ||
    deleteBoundary?.symlink_or_root_escape_allowed !== false
  ) {
    throw new Error('Local data lifecycle conversation delete must reuse the canonical archive verifier');
  }
  assertDeepEqualJson(
    lifecycle.runtime_substrate?.inventory_roots,
    [
      {
        id: 'shell_toolchain_runtime',
        owner: 'active_shell',
        derivation: 'getSystemDir().workDir/runtime',
        cleanup_authority: 'inventory_only_no_pointer_prune',
      },
      {
        id: 'managed_opl_runtime',
        owner: 'one-person-lab',
        derivation: "OPL_RUNTIME_TOOLCHAIN_ROOT_or_darwin_app.getPath('home')/Library/Application Support/OPL/runtime",
        configured_override: 'OPL_RUNTIME_TOOLCHAIN_ROOT',
        default_platform: 'darwin',
        non_darwin_without_override: 'blocked',
        cleanup_authority: 'pointer_prune_owner',
      },
    ],
    'Local data lifecycle runtime inventory roots',
  );
  assertDeepEqualJson(
    lifecycle.runtime_substrate?.protected_root_names,
    ['current', 'previous', 'toolcache', 'generations', 'staged'],
    'Local data lifecycle protected runtime roots',
  );
  const runtimeAuthority = lifecycle.runtime_substrate?.authority_gate;
  if (
    lifecycle.runtime_substrate?.prune_authority_root !== 'managed_opl_runtime' ||
    lifecycle.runtime_substrate?.protected_refs?.previous_root !==
      '~/Library/Application Support/OPL/runtime/previous' ||
    lifecycle.runtime_substrate?.candidate_marker !== '.opl-full-runtime-installed.json' ||
    lifecycle.runtime_substrate?.prune_candidate_policy !==
      'unreferenced_marker_backed_runtime_generations_only' ||
    lifecycle.runtime_substrate?.staged_candidate_policy !==
      'marker_backed_runtime_generation_only_non_runtime_staged_lanes_protected' ||
    lifecycle.runtime_substrate?.symlink_or_root_escape_allowed !== false ||
    runtimeAuthority?.required_pointer !== 'current.json' ||
    runtimeAuthority?.pointer_target_must_be_inside_runtime_root !== true ||
    runtimeAuthority?.current_target_marker !== '.opl-full-runtime-installed.json' ||
    runtimeAuthority?.missing_or_invalid_authority !== 'blocked_no_candidates_no_execute' ||
    runtimeAuthority?.execute_must_revalidate_pointer_and_protected_paths !== true
  ) {
    throw new Error('Local data lifecycle runtime prune must fail closed on managed OPL authority and marker checks');
  }
  assertDeepEqualJson(
    lifecycle.runtime_substrate?.execute_receipt_required_fields,
    ['runtime_root', 'dry_run_plan_id', 'protected_paths', 'deleted_paths', 'deleted_bytes', 'created_at'],
    'Local data lifecycle runtime prune execute receipt fields',
  );
  assertDeepEqualJson(
    lifecycle.logs?.execute_receipt_required_fields,
    ['logs_root', 'dry_run_plan_id', 'deleted_paths', 'deleted_bytes', 'created_at'],
    'Local data lifecycle log rotation execute receipt fields',
  );
  if (shellPaths) validateLocalDataLifecycleImplementation(shellPaths);
}

function validateLocalDataLifecycleImplementation(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/bridge/localDataLifecycleBridge.ts',
    [
      'function shellToolchainRuntimeRoot(): string',
      "path.join(getSystemDir().workDir, 'runtime')",
      'function managedOplRuntimeRoot(): string',
      'const configuredRoot = process.env.OPL_RUNTIME_TOOLCHAIN_ROOT?.trim();',
      "if (process.platform !== 'darwin')",
      'OPL_RUNTIME_TOOLCHAIN_ROOT is required outside the macOS desktop release.',
      "path.join(app.getPath('home'), 'Library', 'Application Support', 'OPL', 'runtime')",
      'runtimeRoots: [shellToolchainRuntimeRoot(), managedOplRuntimeRoot()]',
      'runtimeRoot: managedOplRuntimeRoot()',
      'archiveRoot: archiveRoot()',
      'receiptRoot: receiptRoot()',
      'allowedSourcePaths: [conversationRoot()]',
    ],
    'local data lifecycle bridge split-root and delete boundary',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/process/services/localDataLifecycle/index.ts',
    [
      'const archiveReceipt = verifyConversationArchiveReceipt(input);',
      "requirePathInsidePlainRoot(normalizedReceiptRoot, archiveReceiptPath, 'Archive receipt')",
      "requirePathInsidePlainRoot(normalizedArchiveRoot, archivePath, 'Archive path')",
      'Conversation source path is invalid or symlinked',
      "const RUNTIME_INSTALL_MARKER = '.opl-full-runtime-installed.json'",
      'resolveRuntimePruneAuthority',
      "authority_state?: 'ready' | 'blocked'",
      'authority_state: authority.state',
      'isRuntimeGenerationRoot(resolvedCandidate)',
      'Runtime prune authority changed after the dry-run plan',
    ],
    'local data lifecycle canonical verifier and runtime authority gate',
  );
}

function validateManagedUpdatePlane(managedUpdatePlane) {
  const lifecycle = managedUpdatePlane?.software_lifecycle;
  const kernel = managedUpdatePlane?.managed_kernel;
  if (
    managedUpdatePlane?.owner !== 'one-person-lab-app' ||
    managedUpdatePlane?.producer_owner !== 'one-person-lab' ||
    managedUpdatePlane?.framework_role !== 'own_opl_base_and_opl_packages_lifecycle_execution_truth_and_receipts' ||
    managedUpdatePlane?.action_route !== 'opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json' ||
    kernel?.id !== 'opl_managed_updater_kernel' ||
    kernel?.owner !== 'one-person-lab' ||
    kernel?.app_role !== 'status_action_projection_consumer' ||
    kernel?.app_must_not_implement_kernel !== true ||
    kernel?.app_must_not_bypass_action_route !== true
  ) {
    throw new Error('Release channel managed update must keep the App as a Framework lifecycle consumer');
  }
  assertDeepEqualJson(
    managedUpdatePlane.status_source_priority,
    ['opl app state --profile fast --json#managed_update', 'opl update status --json#managed_update'],
    'Managed update status source priority',
  );
  validateSoftwareLifecycle(lifecycle);
  validateCarrierReconciliation(managedUpdatePlane?.carrier_reconciliation);
  assertIncludesAll(
    managedUpdatePlane.forbidden_app_authority,
    [
      'opl_base_mutation',
      'opl_packages_mutation',
      'framework_update_kernel_implementation',
      'runtime_truth',
      'domain_truth',
      'owner_receipt_authority',
      'homebrew_formula_or_global_tool_mutation',
    ],
    'Managed update forbidden App authority',
  );
  assertDeepEqualJson(
    managedUpdatePlane.release_boundary_required_cases,
    [
      'only_opl_base_opl_app_and_opl_packages_are_public_components',
      'opl_base_bootstrap_is_framework_owned_and_app_requested',
      'opl_packages_use_framework_package_lifecycle_only',
      'carrier_adapters_preserve_software_object_and_lifecycle_owner',
      'internal_transaction_states_are_not_peer_products_or_updaters',
      'ordinary_component_picker_and_public_component_flag_are_forbidden',
      'standard_updater_targets_opl_app_only',
      'all_app_carriers_request_the_same_framework_base_and_packages_reconciliation',
      'app_projects_framework_terminal_readback_and_apply_receipts_without_a_second_update_catalog',
      'clean_managed_targets_may_update_silently_and_dirty_or_user_managed_targets_require_attention',
      'packages_activate_after_receipt_while_base_runtime_and_app_switch_on_restart',
    ],
    'Managed update release-boundary cases',
  );
}

function validateSoftwareLifecycle(lifecycle) {
  assertDeepEqualJson(lifecycle?.public_component_keys, managedUpdateSoftwareObjectIds, 'Managed update public component keys');
  if (
    lifecycle?.schema !== 'opl_software_lifecycle.v1' ||
    lifecycle?.public_component_path !== 'managed_update.components' ||
    lifecycle?.additional_component_keys_allowed !== false ||
    lifecycle?.ordinary_component_picker_allowed !== false ||
    lifecycle?.legacy_component_mapping_allowed !== false ||
    lifecycle?.public_action_component_flag_allowed !== false
  ) {
    throw new Error('Managed update must expose exactly three software components without legacy mappings or a component flag');
  }
  const objects = lifecycle?.objects ?? {};
  if (
    objects.opl_base?.lifecycle_owner !== 'one-person-lab' ||
    objects.opl_base?.provider_id !== 'runtime_substrate' ||
    objects.opl_base?.app_mutation_allowed !== false ||
    objects.opl_base?.mutation_route !== 'framework_lifecycle_only' ||
    objects.opl_app?.lifecycle_owner !== 'one-person-lab-app' ||
    objects.opl_app?.provider_id !== 'installation_carrier' ||
    objects.opl_app?.app_mutation_allowed !== true ||
    objects.opl_packages?.lifecycle_owner !== 'one-person-lab' ||
    objects.opl_packages?.provider_id !== 'capability_packages' ||
    objects.opl_packages?.app_mutation_allowed !== false ||
    objects.opl_packages?.mutation_route !== 'framework_package_lifecycle_only' ||
    objects.opl_packages?.homebrew_distribution_allowed !== false
  ) {
    throw new Error('Managed update software-object lifecycle ownership is invalid');
  }
  assertDeepEqualJson(objects.opl_base.optional_internal_fields, ['dependency_status', 'integration_status'], 'OPL Base internal fields');
  assertDeepEqualJson(objects.opl_app.required_fields, ['host_update_route', 'host_executor_required'], 'OPL App route fields');
  assertDeepEqualJson(objects.opl_packages.optional_internal_fields, ['projection_status', 'profile_migration_status'], 'OPL Packages internal fields');
  if (
    objects.opl_base.dependency_catalog_source !== 'opl update plan --json#managed_update.components.opl_base' ||
    objects.opl_base.app_dependency_catalog_allowed !== false ||
    objects.opl_packages.package_catalog_source !== 'opl update plan --json#managed_update.components.opl_packages' ||
    objects.opl_packages.app_package_update_catalog_allowed !== false
  ) {
    throw new Error('Managed update catalogs must come from the Framework plan rather than App-maintained lists');
  }
  assertDeepEqualJson(Object.keys(lifecycle.carrier_adapters ?? {}), managedUpdateCarrierAdapters, 'Managed update carrier adapters');
  if (
    lifecycle.public_actions?.bootstrap_missing_opl_base !== 'opl-install.sh --headless --skip-packages' ||
    lifecycle.public_actions?.update_opl_app !== 'standard_updater_or_carrier_host_update_route' ||
    lifecycle.public_actions?.apply_eligible_updates !== 'opl update apply --json' ||
    !String(lifecycle.public_actions?.install_opl_package).startsWith('opl packages install ') ||
    !String(lifecycle.public_actions?.update_opl_package).startsWith('opl packages update ') ||
    !String(lifecycle.public_actions?.repair_opl_package).startsWith('opl packages repair ') ||
    !String(lifecycle.public_actions?.uninstall_opl_package).startsWith('opl packages uninstall ')
  ) {
    throw new Error('Managed update public actions must use real Base/App carrier routes and the canonical OPL Packages CLI');
  }
  for (const action of Object.values(lifecycle.public_actions ?? {})) {
    if (String(action).includes('--component')) {
      throw new Error('Managed update public actions must not pass --component');
    }
  }
}

function validateCarrierReconciliation(reconcile) {
  if (
    reconcile?.contract !== 'opl_app_carrier_reconciliation.v1' ||
    reconcile?.trigger !== 'app_startup_after_core_ready_when_running_app_version_checkpoint_is_missing_or_changed' ||
    reconcile?.carrier_neutral !== true ||
    reconcile?.installation_source_scope !== 'all_supported_app_carriers' ||
    reconcile?.installation_source_registry_ref !==
      'contracts/app-install-exposure-policy.json#installer_surfaces+distribution_channels' ||
    reconcile?.installation_source_role !== 'provide_candidate_app_or_seed_bytes_only' ||
    reconcile?.framework_execution?.owner !== 'one-person-lab' ||
    reconcile?.framework_execution?.catalog_source !== 'framework_managed_update_plan' ||
    reconcile?.framework_execution?.app_catalog_allowed !== false ||
    reconcile?.framework_execution?.single_writer_required !== true ||
    reconcile?.framework_execution?.terminal_readback_required !== true ||
    reconcile?.framework_execution?.lifecycle_receipt_required_when_apply_executed !== true ||
    reconcile?.app_role !==
      'request_framework_reconciliation_and_project_terminal_readback_and_apply_receipts_only' ||
    reconcile?.app_direct_base_or_package_mutation_allowed !== false ||
    reconcile?.idempotency !== 'once_per_running_app_version_or_image_digest_and_carrier_identity'
  ) {
    throw new Error('App carrier reconciliation must be carrier-neutral and Framework-executed without an App catalog');
  }
  assertDeepEqualJson(
    reconcile.framework_execution.auto_apply_gate,
    {
      eligibility_field: 'auto_apply.eligible',
      background_safety_field: 'app_background_safe',
      command_field: 'command_ref',
      required_boolean_value: true,
    },
    'App carrier reconciliation Framework auto-apply gate',
  );
  assertDeepEqualJson(
    reconcile.framework_execution.projection_prefetch,
    {
      command: 'opl update status --json',
      publish_when: 'valid_typed_status_readback_available',
      purpose: 'make_framework_typed_state_available_before_network_check_and_plan_complete',
      failure_policy: 'continue_reconciliation_without_clearing_last_valid_projection',
    },
    'App carrier reconciliation projection prefetch',
  );
  assertDeepEqualJson(
    reconcile.framework_execution.command_sequence,
    [
      'opl update check --json',
      'opl update plan --json',
      'opl update apply --json',
      'opl update status --json',
    ],
    'App carrier reconciliation command sequence',
  );
  assertDeepEqualJson(
    reconcile.framework_execution.software_object_scope,
    ['opl_base', 'opl_packages'],
    'App carrier reconciliation Framework scope',
  );
  assertDeepEqualJson(
    reconcile.user_experience.summary_states,
    ['current', 'updating_in_background', 'restart_to_finish', 'refresh_codex_recommended', 'attention_required'],
    'App carrier reconciliation user states',
  );
  assertDeepEqualJson(
    reconcile.attention_only_source_classes,
    ['developer_checkout', 'dirty', 'user_managed', 'global_homebrew_or_npm_or_path'],
    'App carrier reconciliation attention-only source classes',
  );
  if (
    reconcile.version_checkpoint?.key !== 'running_app_version_or_image_digest_and_carrier_identity' ||
    reconcile.version_checkpoint?.write_gate !== 'framework_reconciliation_terminal_readback_projected' ||
    reconcile.version_checkpoint?.missing_checkpoint_means_first_launch !== true ||
    reconcile.version_checkpoint?.downloaded_or_copied_version_is_not_running_version !== true
  ) {
    throw new Error('App carrier reconciliation checkpoint must commit only after terminal Framework readback');
  }
}
