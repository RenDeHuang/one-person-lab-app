export const managedUpdateMustShow = [
  'App binary standard updater status',
  'runtime/toolchain managed updater status',
  'agent package channel managed updater status',
  'capability exposure sync status',
  'conditions and repair actions from App state or opl update status',
  'user-facing module maintenance entry under Local Environment',
  'manual check/apply/repair/rollback action mapping for managed agent packages and capability exposure',
];

export const managedUpdateMustNotShow = [
  'Full first-install asset as a standard updater target',
  'Developer Profile checkout as a silent update target',
  'dirty checkout overwrite as a repair action',
  'developer checkout/dirty checkout as a silent update target',
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

export const managedUpdateBackgroundFields = [
  'last_run_at',
  'next_run_at',
  'last_failure',
  'idempotency_lock.status',
  'execution.status',
  'recent_actions',
  'skipped_reasons',
  'reload_guidance',
];

export const managedUpdateScheduler = {
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

export const managedUpdateUiActions = {
  refresh: 'opl update status --json',
  check: 'opl update check --json',
  plan: 'opl update plan --json',
  apply_component: 'opl update apply --component <component_id> --json',
  repair_receipt: 'opl update repair --receipt <receipt_id> --json',
  rollback_component: 'opl update rollback --component <component_id> --json',
};

export const managedKernelLifecycle = [
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

export const managedKernelStateVocabulary = [
  'current',
  'update_available',
  'staged',
  'needs_restart',
  'needs_reload',
  'failed_with_repair',
  'skipped_manual_required',
];

export const managedKernelPublicCliSurfaces = [
  'opl update status --json',
  'opl update check --json',
  'opl update plan --json',
  'opl update apply --component <component_id> --json',
  'opl update repair --receipt <receipt_id> --json',
  'opl update rollback --component <component_id> --json',
];

export const managedKernelOperationModes = {
  status: 'read_only_projection',
  check: 'read_only_projection',
  plan: 'read_only_projection',
  apply: 'controlled_apply',
  repair: 'controlled_repair',
  rollback: 'controlled_rollback',
};

export const managedKernelReceiptWritePolicy = {
  status: 'read_only',
  check: 'read_only',
  plan: 'read_only',
  apply: 'recorded_component_receipt',
  repair: 'recorded_component_receipt',
  rollback: 'recorded_component_receipt',
};

export const managedKernelStatusProjectionRequiredFields = [
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

export const managedKernelRunnerResultRequiredFields = [
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

export const managedKernelComponentReceiptRequiredFields = [
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

export const managedKernelComponentReceiptIdentityFields = [
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

export const managedUpdateSections = ['app_binary', 'runtime_toolchain', 'agent_packages', 'capability_exposure'];
export const managedUpdateDisplayPlanes = ['app_binary', 'runtime_toolchain', 'agent_package_channel', 'capability_exposure'];
export const managedUpdateStateSources = ['opl app state --profile fast --json#managed_update_plane', 'opl update status --json'];
export const managedUpdateStatusConsumptionPolicy =
  'show status, conditions, progress refs, and repair action refs without reading artifact bodies or writing runtime/domain truth';
