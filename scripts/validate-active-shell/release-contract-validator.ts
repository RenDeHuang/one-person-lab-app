import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { validateReleaseFullFirstInstallPayloads } from './release-full-first-install-payload-validator.ts';
import { validateReleaseHomebrewDistribution } from './release-homebrew-distribution-validator.ts';
import {
  validateReleaseManagedUpdateKernelSurface,
  validateReleaseManagedUpdatePlaneLanes,
  validateReleaseRuntimeToolchainUpdater,
} from './managed-update-plane-validator.ts';

export function validateReleaseChannelContract(releaseChannel) {
  const managedUpdatePlane = releaseChannel.managed_update_plane;
  validateLocalDataLifecycle(releaseChannel.local_data_lifecycle);
  validateManagedUpdatePlane(managedUpdatePlane);
  validateReleaseRuntimeToolchainUpdater(releaseChannel.runtime_toolchain_updater, managedUpdatePlane);
  validateReleaseHomebrewDistribution(releaseChannel, managedUpdatePlane);
  validateReleaseFullFirstInstallPayloads(releaseChannel);
}

function validateLocalDataLifecycle(lifecycle) {
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
    ['updater_cache', 'conversation_artifacts', 'runtime_toolchain', 'logs'],
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
    lifecycle.conversation_artifacts?.default_policy !== 'retain_until_user_cleanup_or_archive' ||
    lifecycle.conversation_artifacts?.silent_delete_allowed !== false ||
    lifecycle.conversation_artifacts?.cleanup_execution !== 'archive_then_explicit_user_confirmed_delete' ||
    lifecycle.conversation_artifacts?.archive_required_before_cleanup !== true ||
    lifecycle.conversation_artifacts?.restore_proof_required !== true ||
    lifecycle.conversation_artifacts?.cleanup_surface !== 'Settings / Storage' ||
    lifecycle.runtime_toolchain?.default_policy !== 'retain_current_and_declared_rollback_runtime' ||
    lifecycle.runtime_toolchain?.owner_ref !== 'contracts/app-release-channel.json#runtime_toolchain_updater' ||
    lifecycle.runtime_toolchain?.cleanup_execution !== 'pointer_based_dry_run_first_explicit_execute_required' ||
    lifecycle.runtime_toolchain?.protected_refs?.current_pointer !==
      '~/Library/Application Support/OPL/runtime/current.json' ||
    lifecycle.runtime_toolchain?.protected_refs?.current_root !==
      '~/Library/Application Support/OPL/runtime/current' ||
    lifecycle.runtime_toolchain?.prune_candidate_policy !== 'unreferenced_runtime_roots_only' ||
    lifecycle.runtime_toolchain?.dry_run_receipt_required !== true ||
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
    lifecycle.conversation_artifacts?.archive_receipt_required_fields,
    ['conversation_id', 'source_paths', 'archive_path', 'archive_sha256', 'manifest_path', 'restore_probe_path', 'created_at'],
    'Local data lifecycle conversation archive receipt fields',
  );
  assertDeepEqualJson(
    lifecycle.conversation_artifacts?.delete_receipt_required_fields,
    ['conversation_id', 'deleted_paths', 'archive_receipt_path', 'confirmed_at', 'created_at'],
    'Local data lifecycle conversation delete receipt fields',
  );
  assertDeepEqualJson(
    lifecycle.runtime_toolchain?.execute_receipt_required_fields,
    ['runtime_root', 'dry_run_plan_id', 'protected_paths', 'deleted_paths', 'deleted_bytes', 'created_at'],
    'Local data lifecycle runtime prune execute receipt fields',
  );
  assertDeepEqualJson(
    lifecycle.logs?.execute_receipt_required_fields,
    ['logs_root', 'dry_run_plan_id', 'deleted_paths', 'deleted_bytes', 'created_at'],
    'Local data lifecycle log rotation execute receipt fields',
  );
}

function validateManagedUpdatePlane(managedUpdatePlane) {
  if (
    managedUpdatePlane?.owner !== 'one-person-lab-app' ||
    managedUpdatePlane?.producer_owner !== 'one-person-lab' ||
    managedUpdatePlane?.ui_page !== 'Updates & Maintenance' ||
    managedUpdatePlane?.framework_role !== 'own_managed_update_kernel_status_conditions_repair_actions_and_apply_execution' ||
    managedUpdatePlane?.managed_kernel?.id !== 'opl_managed_updater_kernel' ||
    managedUpdatePlane?.managed_kernel?.owner !== 'one-person-lab' ||
    managedUpdatePlane?.managed_kernel?.app_role !== 'status_action_projection_consumer' ||
    managedUpdatePlane?.managed_kernel?.app_must_not_implement_kernel !== true ||
    managedUpdatePlane?.managed_kernel?.app_must_not_bypass_action_route !== true ||
    managedUpdatePlane?.status_consumption_policy !==
      'App consumes status, conditions, progress refs, and repair action refs only; App does not read artifact bodies, write domain truth, or implement the Framework update kernel.'
  ) {
    throw new Error('Release channel must declare the App-owned managed update plane as a Framework-kernel status/action consumer');
  }
  assertDeepEqualJson(
    managedUpdatePlane.status_source_priority,
    ['opl app state --profile fast --json#managed_update_plane', 'opl update status --json'],
    'Managed update plane status source priority',
  );
  assertIncludesAll(
    managedUpdatePlane.managed_kernel?.channels_share,
    ['status_schema', 'condition_model', 'download_verify_stage_apply_lifecycle', 'repair_action_refs', 'rollback_receipts'],
    'Managed update plane shared kernel contract',
  );
  validateReleaseManagedUpdateKernelSurface(managedUpdatePlane);
  assertIncludesAll(
    managedUpdatePlane.forbidden_silent_overwrite_scope,
    [
      'Developer Profile checkout',
      'dirty checkout',
      'domain truth',
      'owner receipt',
      'quality verdict',
      'export verdict',
      'Homebrew/global tools',
    ],
    'Managed update plane forbidden silent overwrite scope',
  );
  assertIncludesAll(
    managedUpdatePlane.forbidden_app_authority,
    [
      'framework_update_kernel_implementation',
      'runtime_truth',
      'domain_truth',
      'owner_receipt_authority',
      'domain_quality_verdict',
      'domain_export_verdict',
      'artifact_body',
      'homebrew_global_tool_mutation',
      'developer_checkout_mutation',
    ],
    'Managed update plane forbidden App authority',
  );
  assertIncludesAll(
    managedUpdatePlane.release_boundary_required_cases,
    [
      'standard_updater_desktop_assets_only',
      'runtime_toolchain_uses_managed_kernel_not_standard_updater',
      'agent_package_channel_uses_managed_kernel_and_post_update_sync',
      'capability_exposure_status_is_projection_only',
      'forbidden_silent_overwrite_scope_fail_closed',
    ],
    'Managed update plane release-boundary cases',
  );
  validateReleaseManagedUpdatePlaneLanes(managedUpdatePlane);
}
