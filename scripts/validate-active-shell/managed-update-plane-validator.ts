import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  managedKernelComponentReceiptIdentityFields,
  managedKernelComponentReceiptRequiredFields,
  managedKernelLifecycle,
  managedKernelOperationModes,
  managedKernelPublicCliSurfaces,
  managedKernelReceiptWritePolicy,
  managedKernelRunnerResultRequiredFields,
  managedKernelStateVocabulary,
  managedKernelStatusProjectionRequiredFields,
  managedUpdateBackgroundFields,
  managedUpdateDisplayPlanes,
  managedUpdateIpcSurfaces,
  managedUpdateMustNotShow,
  managedUpdateMustShow,
  managedUpdateScheduler,
  managedUpdateSections,
  managedUpdateStateSources,
  managedUpdateStatusConsumptionPolicy,
  managedUpdateUiActions,
} from './managed-update-plane-policy.ts';

export { managedUpdateIpcSurfaces } from './managed-update-plane-policy.ts';

export function validateReleaseManagedUpdateKernelSurface(managedUpdatePlane) {
  const managedKernel = managedUpdatePlane?.managed_kernel;

  validateManagedKernelLifecycle(managedKernel);
  validateManagedKernelIdempotencyLock(managedKernel);
  validateManagedKernelShellIntegration(managedUpdatePlane, managedKernel);
  validateManagedKernelCommandAndReceiptPolicy(managedKernel);
  validateManagedKernelProjectionAndResultFields(managedKernel);
  validateManagedKernelReceiptAndConditionShapes(managedKernel);
}

export function validateReleaseManagedUpdatePlaneLanes(managedUpdatePlane) {
  const planeById = new Map((managedUpdatePlane?.planes ?? []).map((plane) => [plane.id, plane]));

  validateManagedUpdateAppBinaryLane(planeById.get('app_binary'));
  validateManagedUpdateRuntimeAndAgentLanes(
    planeById.get('runtime_toolchain'),
    planeById.get('agent_package_channel'),
    managedUpdatePlane?.agent_package_channel,
  );
  validateManagedUpdateCapabilityLane(planeById.get('capability_exposure'));
  validateManagedUpdateStandardUpdaterBoundary(managedUpdatePlane?.standard_updater_boundary);
}

export function validateReleaseRuntimeToolchainUpdater(runtimeUpdater, managedUpdatePlane) {
  validateReleaseRuntimeToolchainChannelPolicy(runtimeUpdater);
  validateReleaseRuntimeToolchainManagedComponents(runtimeUpdater);
  validateReleaseRuntimeToolchainLayering(runtimeUpdater);
  validateReleaseRuntimeToolchainSystemPolicy(runtimeUpdater);
  validateReleaseRuntimeToolchainVerification(runtimeUpdater);
  validateReleaseRuntimeToolchainPlaneBinding(runtimeUpdater, managedUpdatePlane);
}

function validateReleaseRuntimeToolchainChannelPolicy(runtimeUpdater) {
  if (
    runtimeUpdater?.owner !== 'one-person-lab-app' ||
    runtimeUpdater?.role !== 'app_owned_runtime_fallback_and_toolchain_layer_updates' ||
    runtimeUpdater?.channel_manifest_asset !== 'app-runtime-update-channel.json' ||
    runtimeUpdater?.transport !== 'app_owned_github_release_assets' ||
    runtimeUpdater?.standard_updater_metadata_allowed !== false ||
    runtimeUpdater?.standard_updater_latest_yml_allowed !== false ||
    runtimeUpdater?.homebrew_tap_write_allowed !== false ||
    runtimeUpdater?.default_policy?.auto_check !== true ||
    runtimeUpdater?.default_policy?.download !== 'silent_background' ||
    runtimeUpdater?.default_policy?.apply !== 'stage_verified_payload_and_apply_on_next_app_restart' ||
    runtimeUpdater?.default_policy?.restart_prompt !== 'none_until_user_restarts_app' ||
    runtimeUpdater?.default_policy?.user_blocking !== false
  ) {
    throw new Error('Release channel runtime/toolchain updater must be a silent App-owned runtime fallback channel separate from standard updater and Homebrew');
  }
}

function validateReleaseRuntimeToolchainManagedComponents(runtimeUpdater) {
  assertIncludesAll(
    runtimeUpdater?.managed_components,
    [
      'codex_cli_fallback',
      'temporal_cli_archive',
      'node_runtime',
      'python_runtime',
      'uv_runtime',
      'officecli',
      'mineru_open_api',
      'companion_skills',
      'opl_framework_runtime',
      'domain_module_payloads',
    ],
    'Release channel runtime/toolchain updater managed components',
  );
}

function validateReleaseRuntimeToolchainLayering(runtimeUpdater) {
  if (
    runtimeUpdater?.layering?.runtime_root !== '~/Library/Application Support/OPL/runtime' ||
    runtimeUpdater?.layering?.current_pointer !== '~/Library/Application Support/OPL/runtime/current.json' ||
    runtimeUpdater?.layering?.activation !== 'swap_current_pointer_on_app_restart_after_startup_smoke' ||
    runtimeUpdater?.layering?.rollback !== 'restore_previous_pointer_when_startup_smoke_fails'
  ) {
    throw new Error('Release channel runtime/toolchain updater must stage runtime layers and atomically activate through the runtime current pointer');
  }
}

function validateReleaseRuntimeToolchainPlaneBinding(runtimeUpdater, managedUpdatePlane) {
  if (
    runtimeUpdater?.managed_update_plane !== 'runtime_toolchain' ||
    runtimeUpdater?.kernel !== 'opl_managed_updater_kernel' ||
    runtimeUpdater?.adapter !== 'runtime_toolchain_adapter' ||
    runtimeUpdater?.policy !== 'silent_background_verified_stage_apply_on_next_restart' ||
    runtimeUpdater?.post_apply !== 'startup_smoke_then_swap_runtime_current_pointer_with_rollback' ||
    runtimeUpdater?.app_role !== 'status_conditions_repair_actions_consumer_only'
  ) {
    throw new Error('Release channel runtime/toolchain updater must bind to the managed update plane runtime lane');
  }
  assertDeepEqualJson(
    runtimeUpdater?.status_sources,
    [
      'opl app state --profile fast --json#managed_update_plane.runtime_toolchain',
      'opl update status --json#runtime_toolchain',
    ],
    'Release channel runtime updater status sources',
  );
  assertIncludesAll(
    runtimeUpdater?.forbidden_silent_overwrite_scope,
    managedUpdatePlane?.forbidden_silent_overwrite_scope,
    'Release channel runtime updater forbidden silent overwrite scope',
  );
}

function validateReleaseRuntimeToolchainSystemPolicy(runtimeUpdater) {
  assertDeepEqualJson(
    runtimeUpdater.system_tool_policy?.preferred_sources,
    ['explicit_user_path', 'system_path', 'homebrew_formula', 'app_owned_runtime_fallback'],
    'Release channel runtime/toolchain updater preferred sources',
  );
  if (
    runtimeUpdater.system_tool_policy?.prefer_valid_newer_system_tool !== true ||
    runtimeUpdater.system_tool_policy?.silent_global_mutation_allowed !== false ||
    runtimeUpdater.system_tool_policy?.homebrew_upgrade_allowed_by_default !== false ||
    runtimeUpdater.system_tool_policy?.user_opt_in_global_upgrade_allowed !== true
  ) {
    throw new Error('Release channel runtime/toolchain updater must detect compatible system tools without silently mutating global Homebrew or system installs');
  }
  assertIncludesAll(
    runtimeUpdater.manifest_required_fields,
    [
      'schema_version',
      'channel',
      'runtime_version',
      'components',
      'assets',
      'sha256',
      'minimum_versions',
      'apply_policy',
      'rollback_policy',
    ],
    'Release channel runtime/toolchain updater manifest fields',
  );
}

function validateReleaseRuntimeToolchainVerification(runtimeUpdater) {
  assertIncludesAll(
    runtimeUpdater.verification?.required_before_stage,
    ['manifest_schema', 'asset_sha256', 'minimum_version', 'component_capability_smoke'],
    'Release channel runtime/toolchain updater stage checks',
  );
  assertIncludesAll(
    runtimeUpdater.verification?.required_before_release,
    [
      'standard_dmg_clean_vm_smoke',
      'full_dmg_clean_vm_smoke',
      'homebrew_standard_cask_clean_vm_smoke',
      'remote_release_verification',
    ],
    'Release channel runtime/toolchain updater release checks',
  );
  if (
    runtimeUpdater.verification?.clean_machine_installability_must_not_regress !== true ||
    runtimeUpdater.rollback_policy?.keep_previous_runtime !== true ||
    runtimeUpdater.rollback_policy?.rollback_on_startup_smoke_failure !== true ||
    runtimeUpdater.rollback_policy?.rollback_must_not_mutate_user_global_tools !== true ||
    !/silent download and verified staging/.test(runtimeUpdater.rule ?? '')
  ) {
    throw new Error('Release channel runtime/toolchain updater must preserve clean-machine installability and rollback without global tool mutation');
  }
}

function validateManagedUpdateAppBinaryLane(appBinaryPlane) {
  if (
    appBinaryPlane?.updater_kind !== 'standard_updater' ||
    appBinaryPlane?.adapter !== 'electron_standard_updater' ||
    appBinaryPlane?.source !== 'GitHub Release standard macOS arm64 updater assets' ||
    appBinaryPlane?.policy !== 'user_visible_release_channel_check' ||
    appBinaryPlane?.post_apply !== 'verify_running_version_after_restart_or_report_recovery' ||
    appBinaryPlane?.repair_action_scope !== 'app_release_check_download_retry_or_install_downloaded_update_only'
  ) {
    throw new Error('Managed update plane App binary lane must remain the standard desktop updater only');
  }
  assertDeepEqualJson(
    appBinaryPlane?.status_fields,
    [
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
    ],
    'Managed update plane App binary lane status fields',
  );
}

function validateManagedUpdateRuntimeAndAgentLanes(runtimePlane, agentPlane, agentPackageChannel) {
  if (
    runtimePlane?.updater_kind !== 'managed_updater_kernel' ||
    runtimePlane?.adapter !== 'runtime_toolchain_adapter' ||
    runtimePlane?.policy !== 'silent_background_verified_stage_apply_on_next_restart' ||
    runtimePlane?.post_apply !== 'startup_smoke_then_swap_runtime_current_pointer_with_rollback' ||
    agentPlane?.updater_kind !== 'managed_updater_kernel' ||
    agentPlane?.adapter !== 'agent_package_channel_adapter' ||
    agentPlane?.policy !== 'ordinary_user_non_development_silent_background' ||
    agentPlane?.post_apply !== 'sync_plugin_registry_plugin_packaged_skills_and_oma_generated_plugin_surface'
  ) {
    throw new Error('Managed update plane runtime/toolchain and agent package lanes must share the managed kernel but differ by adapter/policy/post_apply');
  }
  validateManagedUpdateRuntimeLane(runtimePlane);
  validateManagedUpdateAgentPackageLane(agentPlane, agentPackageChannel);
}

function validateManagedUpdateRuntimeLane(runtimePlane) {
  assertDeepEqualJson(
    runtimePlane?.status_fields,
    [
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
    ],
    'Managed update plane runtime lane status fields',
  );
  assertDeepEqualJson(
    runtimePlane?.component_receipt_identity_fields,
    ['runtime_version', 'current_pointer', 'staged_root', 'sha256'],
    'Managed update plane runtime lane receipt identity fields',
  );
  if (
    runtimePlane?.rollback_status_source !== 'opl update rollback --component runtime_toolchain --json#managed_update.execution.status' ||
    runtimePlane?.repair_status_source !== 'opl update repair --receipt <receipt_id> --json#managed_update.execution.status'
  ) {
    throw new Error('Managed update plane runtime lane must consume Framework rollback and repair runner status fields');
  }
}

function validateManagedUpdateAgentPackageLane(agentPlane, agentPackageChannel) {
  assertDeepEqualJson(
    agentPlane?.status_fields,
    [
      'agent_id',
      'package_tag',
      'version',
      'source',
      'conditions',
      'repair_actions',
      'components[].receipt.post_apply_hooks',
      'idempotency_lock.status',
      'execution.status',
      'components[].receipt.last_receipt_ref',
      'components[].receipt.repair_action',
    ],
    'Managed update plane agent package lane status fields',
  );
  assertDeepEqualJson(
    agentPlane?.post_apply_sync,
    {
      status_field: 'components[].receipt.post_apply_hooks',
      required_hooks: [
        'reconcile_modules',
        'sync_skills',
        'sync_plugin_registry',
        'sync_plugin_packaged_skills',
        'sync_oma_generated_plugin_surface',
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
    },
    'Managed update plane agent package post-apply sync guidance',
  );
  assertDeepEqualJson(agentPlane?.package_agent_ids, ['mas', 'mag', 'rca', 'oma'], 'Managed update plane agent package ids');
  if (
    agentPackageChannel?.background_apply_policy !==
    'apply_after_check_or_plan_when_all_agent_package_components_are_clean_managed_and_update_available'
  ) {
    throw new Error('Managed update plane agent package channel must declare clean managed background auto-apply policy');
  }
  assertDeepEqualJson(
    agentPackageChannel?.background_apply_must_record,
    [
      'last_auto_apply_at',
      'last_auto_apply_component_ids',
      'last_auto_apply_receipt_refs',
      'last_auto_apply_post_apply_hooks',
      'last_auto_apply_skip_reasons',
      'reload_guidance',
    ],
    'Managed update plane agent package channel background auto-apply receipt projection',
  );
}

function validateManagedUpdateCapabilityLane(capabilityPlane) {
  if (
    capabilityPlane?.updater_kind !== 'managed_visibility_projection' ||
    capabilityPlane?.adapter !== 'codex_exposure_status_adapter' ||
    capabilityPlane?.policy !== 'display_visibility_and_repair_actions_without_duplicate_semantics'
  ) {
    throw new Error('Managed update plane capability exposure lane must be a status projection only');
  }
  assertDeepEqualJson(
    capabilityPlane?.status_fields,
    [
      'codex_plugin_registry',
      'plugin_packaged_skills',
      'opl_generated_plugin_surface',
      'conditions',
      'repair_actions',
      'components[].receipt.post_apply_hooks',
      'reload_required',
      'reload_guidance',
    ],
    'Managed update plane capability exposure status fields',
  );
  if (
    capabilityPlane?.reload_guidance !==
    'manual_reload_only_after_framework_reports_needs_reload_or_post_apply_sync_changed_cached_capability_surface'
  ) {
    throw new Error('Managed update plane capability exposure lane must declare post-apply reload guidance');
  }
}

function validateManagedUpdateStandardUpdaterBoundary(standardUpdaterBoundary) {
  assertIncludesAll(
    standardUpdaterBoundary?.forbidden_targets,
    [
      'runtime_toolchain',
      'agent_package_channel',
      'capability_exposure',
      'developer_checkout_selection',
      'homebrew_or_global_tool_upgrade',
      'domain_truth',
    ],
    'Managed update plane standard updater forbidden targets',
  );
  if (
    standardUpdaterBoundary?.scope !== 'desktop_app_assets_only' ||
    standardUpdaterBoundary?.updater !== 'electron_standard_updater' ||
    standardUpdaterBoundary?.apply_lifecycle?.downloaded_state_is_not_success !== true ||
    standardUpdaterBoundary?.apply_lifecycle?.apply_started_receipt !== 'auto-update-diagnostics.json#quit-and-install' ||
    standardUpdaterBoundary?.apply_lifecycle?.post_restart_version_gate !== 'running_app_version_must_be_gte_downloaded_target_version' ||
    standardUpdaterBoundary?.apply_lifecycle?.failure_state !== 'install-not-applied' ||
    standardUpdaterBoundary?.apply_lifecycle?.recovery_action !== 'install_downloaded_update_now'
  ) {
    throw new Error('Managed update plane standard updater boundary must verify apply after restart and expose recovery');
  }
}

function validateManagedKernelLifecycle(managedKernel) {
  assertDeepEqualJson(managedKernel?.lifecycle, managedKernelLifecycle, 'Managed update plane lifecycle');
  assertDeepEqualJson(
    managedKernel?.state_vocabulary,
    managedKernelStateVocabulary,
    'Managed update plane state vocabulary',
  );
}

function validateManagedKernelIdempotencyLock(managedKernel) {
  if (
    managedKernel?.idempotency_lock?.lock_id !== 'opl_managed_updater_kernel.global' ||
    managedKernel?.idempotency_lock?.lock_scope !==
      'single_writer_for_fetch_verify_stage_activate_post_apply_write_receipt' ||
    managedKernel?.idempotency_lock?.stale_after_seconds !== 1800 ||
    managedKernel?.idempotency_lock?.contention_policy !==
      'report_in_progress_or_skip_without_parallel_stage_or_plugin_sync'
  ) {
    throw new Error('Managed update plane must declare the Framework updater idempotency lock contract');
  }
  assertDeepEqualJson(
    managedKernel?.idempotency_lock?.exclusive_operations,
    ['apply', 'repair', 'rollback'],
    'Managed update plane exclusive lock operations',
  );
}

function validateManagedKernelShellIntegration(managedUpdatePlane, managedKernel) {
  const shellIntegration = managedUpdatePlane?.shell_integration;

  assertDeepEqualJson(
    shellIntegration?.required_ipc_surfaces,
    managedUpdateIpcSurfaces,
    'Managed update plane shell IPC surfaces',
  );
  assertDeepEqualJson(
    shellIntegration?.allowed_cli_commands,
    managedKernel?.public_cli_surfaces,
    'Managed update plane shell allowed CLI commands',
  );
  assertDeepEqualJson(
    shellIntegration?.background_scheduler,
    managedUpdateScheduler,
    'Managed update plane shell background scheduler',
  );
  assertDeepEqualJson(shellIntegration?.ui_actions, managedUpdateUiActions, 'Managed update plane shell UI actions');
  assertDeepEqualJson(
    shellIntegration?.forbidden_shell_behaviors,
    [
      'read_artifact_body',
      'read_or_write_domain_truth',
      'write_owner_receipt',
      'mutate_dirty_or_developer_checkout',
      'mutate_homebrew_or_system_tools',
      'bypass_framework_update_kernel',
    ],
    'Managed update plane forbidden shell behaviors',
  );
}

function validateManagedKernelCommandAndReceiptPolicy(managedKernel) {
  if (managedKernel?.component_receipt_shape?.schema_version !== 'opl_managed_update_component_receipt.v1') {
    throw new Error('Managed update plane must declare the component receipt schema version');
  }
  assertDeepEqualJson(
    managedKernel?.public_cli_surfaces,
    managedKernelPublicCliSurfaces,
    'Managed update plane public CLI surfaces',
  );
  assertDeepEqualJson(managedKernel?.operation_modes, managedKernelOperationModes, 'Managed update plane operation modes');
  assertDeepEqualJson(
    managedKernel?.receipt_write_policy,
    managedKernelReceiptWritePolicy,
    'Managed update plane receipt write policy',
  );
}

function validateManagedKernelProjectionAndResultFields(managedKernel) {
  assertDeepEqualJson(
    managedKernel?.status_projection_required_fields,
    managedKernelStatusProjectionRequiredFields,
    'Managed update plane status projection required fields',
  );
  assertDeepEqualJson(
    managedKernel?.runner_result_required_fields,
    managedKernelRunnerResultRequiredFields,
    'Managed update plane runner result required fields',
  );
}

function validateManagedKernelReceiptAndConditionShapes(managedKernel) {
  assertDeepEqualJson(
    managedKernel?.component_receipt_shape?.required_fields,
    managedKernelComponentReceiptRequiredFields,
    'Managed update plane component receipt required fields',
  );
  assertDeepEqualJson(
    managedKernel?.component_receipt_shape?.identity_fields,
    managedKernelComponentReceiptIdentityFields,
    'Managed update plane component receipt identity fields',
  );
  assertDeepEqualJson(
    managedKernel?.condition_shape?.required_fields,
    ['type', 'status', 'reason', 'message', 'observed_generation'],
    'Managed update plane condition required fields',
  );
  assertDeepEqualJson(
    managedKernel?.condition_shape?.status_values,
    ['True', 'False', 'Unknown'],
    'Managed update plane condition status values',
  );
  if (managedKernel?.condition_shape?.style !== 'kubernetes_status_conditions') {
    throw new Error('Managed update plane condition shape must use Kubernetes-style status conditions');
  }
}

export function validateManagedUpdatePageBasics(page, label, options = {}) {
  if (options.requirePageContract && page?.page_contract !== 'updates_and_maintenance') {
    throw new Error(`${label} page_contract must be updates_and_maintenance`);
  }
  if (page?.status_source !== 'opl update status --json') {
    throw new Error(`${label} must expose opl update status --json as the explicit status source`);
  }
  if (page?.action_source !== 'opl update apply/repair/rollback --json through shell IPC') {
    throw new Error(options.actionSourceError ?? `${label} must expose managed update actions through shell IPC`);
  }
  assertDeepEqualJson(
    page?.background_maintenance_status_fields,
    managedUpdateBackgroundFields,
    `${label} background maintenance status fields`,
  );
  assertDeepEqualJson(page?.sections, managedUpdateSections, `${label} sections`);
  assertIncludesAll(page?.must_show, managedUpdateMustShow, `${label} must_show`);
  assertIncludesAll(page?.must_not_show, managedUpdateMustNotShow, `${label} must_not_show`);
}

export function validateManagedUpdatePlaneBinding(plane, label, options = {}) {
  if (
    (options.requirePageId && plane?.page_id !== 'updates_and_maintenance') ||
    plane?.source_ref !== 'contracts/app-release-channel.json#managed_update_plane' ||
    plane?.app_role !== 'status_conditions_repair_actions_consumer_only' ||
    plane?.framework_role !== 'managed_update_kernel_owner' ||
    (options.requireStatusConsumptionPolicy && plane?.status_consumption_policy !== managedUpdateStatusConsumptionPolicy)
  ) {
    throw new Error(options.bindingError ?? `${label} must bind to the App managed update plane`);
  }
  if (options.requireStateSources) {
    assertDeepEqualJson(plane?.state_sources, managedUpdateStateSources, `${label} state sources`);
  }
  assertDeepEqualJson(plane?.display_planes, managedUpdateDisplayPlanes, `${label} display planes`);
  assertDeepEqualJson(plane?.background_scheduler, managedUpdateScheduler, `${label} background scheduler`);
  assertDeepEqualJson(plane?.ui_actions, managedUpdateUiActions, `${label} UI actions`);
  assertDeepEqualJson(plane?.ipc_bridge_required, managedUpdateIpcSurfaces, `${label} IPC bridge`);
}
