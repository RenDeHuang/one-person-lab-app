import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';

const managedUpdateMustShow = [
  'App binary standard updater status',
  'runtime/toolchain managed updater status',
  'agent package channel managed updater status',
  'capability exposure sync status',
  'conditions and repair actions from App state or opl update status',
];

const managedUpdateMustNotShow = [
  'Full first-install asset as a standard updater target',
  'Developer Profile checkout as a silent update target',
  'dirty checkout overwrite as a repair action',
  'domain truth write controls',
  'owner receipt mutation controls',
  'quality/export verdict controls',
  'Homebrew/global tool silent upgrade controls',
  'artifact bodies',
];

export const managedUpdateIpcSurfaces = [
  'opl-runtime.get-managed-update-status',
  'opl-runtime.get-managed-update-check',
  'opl-runtime.get-managed-update-plan',
  'opl-runtime.run-managed-update-apply',
  'opl-runtime.run-managed-update-repair',
  'opl-runtime.run-managed-update-rollback',
];

const managedUpdateBackgroundFields = [
  'last_run_at',
  'next_run_at',
  'last_failure',
  'idempotency_lock.status',
  'execution.status',
  'recent_actions',
  'skipped_reasons',
  'reload_guidance',
];

const managedUpdateScheduler = {
  triggers: ['app_startup_after_core_ready', 'daily_background_maintenance', 'manual_check_updates'],
  lock_source: 'managed_update.idempotency_lock.status',
  backoff_policy: 'bounded_retry_with_last_failure_projection',
  user_blocking: false,
  must_project_last_run_and_next_run: true,
  auto_apply_policy: 'auto_apply_clean_managed_agent_package_and_capability_exposure_only',
  auto_apply_components: ['agent_package_channel', 'capability_exposure'],
  never_auto_apply_components: ['app_binary', 'runtime_toolchain'],
  must_project_recent_actions_and_skip_reasons: true,
};

const managedUpdateUiActions = {
  refresh: 'opl update status --json',
  check: 'opl update check --json',
  plan: 'opl update plan --json',
  apply_component: 'opl update apply --component <component_id> --json',
  repair_receipt: 'opl update repair --receipt <receipt_id> --json',
  rollback_component: 'opl update rollback --component <component_id> --json',
};

const managedKernelLifecycle = [
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
];

const managedKernelStateVocabulary = [
  'current',
  'update_available',
  'staged',
  'needs_restart',
  'needs_reload',
  'failed_with_repair',
  'skipped_manual_required',
];

const managedKernelPublicCliSurfaces = [
  'opl update status --json',
  'opl update check --json',
  'opl update plan --json',
  'opl update apply --component <component_id> --json',
  'opl update repair --receipt <receipt_id> --json',
  'opl update rollback --component <component_id> --json',
];

const managedKernelOperationModes = {
  status: 'read_only_projection',
  check: 'read_only_projection',
  plan: 'read_only_projection',
  apply: 'controlled_apply',
  repair: 'controlled_repair',
  rollback: 'controlled_rollback',
};

const managedKernelReceiptWritePolicy = {
  status: 'read_only',
  check: 'read_only',
  plan: 'read_only',
  apply: 'recorded_component_receipt',
  repair: 'recorded_component_receipt',
  rollback: 'recorded_component_receipt',
};

const managedKernelStatusProjectionRequiredFields = [
  'operation',
  'operation_mode',
  'update_channel',
  'idempotency_lock.status',
  'summary',
  'components',
  'repair_actions',
  'receipts.write_policy',
  'authority_boundary',
];

const managedKernelRunnerResultRequiredFields = [
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
];

const managedKernelComponentReceiptRequiredFields = [
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
];

const managedKernelComponentReceiptIdentityFields = [
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
];

const managedUpdateSections = ['app_binary', 'runtime_toolchain', 'agent_packages', 'capability_exposure'];
const managedUpdateDisplayPlanes = ['app_binary', 'runtime_toolchain', 'agent_package_channel', 'capability_exposure'];
const managedUpdateStateSources = ['opl app state --profile fast --json#managed_update_plane', 'opl update status --json'];
const managedUpdateStatusConsumptionPolicy =
  'show status, conditions, progress refs, and repair action refs without reading artifact bodies or writing runtime/domain truth';

export function validateReleaseManagedUpdateKernelSurface(managedUpdatePlane) {
  const managedKernel = managedUpdatePlane?.managed_kernel;

  validateManagedKernelLifecycle(managedKernel);
  validateManagedKernelIdempotencyLock(managedKernel);
  validateManagedKernelShellIntegration(managedUpdatePlane, managedKernel);
  validateManagedKernelCommandAndReceiptPolicy(managedKernel);
  validateManagedKernelProjectionAndResultFields(managedKernel);
  validateManagedKernelReceiptAndConditionShapes(managedKernel);
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
