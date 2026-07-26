export const managedUpdateMustShow = [
  'OPL Base status and one-click install action when missing',
  'OPL App version, carrier status, and host update route when required',
  'OPL Packages lifecycle status and Framework-owned actions',
  'OPL Base dependency_status and integration_status only as collapsed transaction detail',
  'OPL Packages projection_status and profile_migration_status only as collapsed transaction detail',
  'conditions and repair actions from App state or opl update status',
  'user-facing OPL Packages maintenance entry under Local Environment',
  'manual check/apply/repair/rollback action mapping for OPL Packages',
  'carrier-neutral reconciliation status after App install or version change',
  'Framework receipt-derived current, background update, restart, reload, or attention guidance',
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
  'runtime substrate, companion tools, Codex surface, or workflow profile as peer products or updaters',
  'ordinary component picker',
  'public action that passes --component',
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
  triggers: [
    'app_startup_after_core_ready',
    'running_app_version_checkpoint_missing_or_changed',
    'daily_background_maintenance',
    'manual_check_updates',
  ],
  lock_source: 'managed_update.idempotency_lock.status',
  backoff_policy: 'bounded_retry_with_last_failure_projection',
  user_blocking: false,
  must_project_last_run_and_next_run: true,
  auto_apply_policy: 'execute_only_framework_plan_items_with_auto_apply.eligible_and_app_background_safe_using_command_ref',
  auto_apply_software_objects: ['opl_base', 'opl_packages'],
  auto_apply_eligibility_owner: 'one-person-lab',
  attention_only_source_classes: ['developer_checkout', 'dirty', 'user_managed', 'global_homebrew_or_npm_or_path'],
  app_owned_auto_apply_software_objects: [],
  never_app_mutate_software_objects: ['opl_base', 'opl_packages'],
  must_project_recent_actions_and_skip_reasons: true,
};

export const managedUpdateUiActions = {
  refresh: 'opl update status --json',
  check: 'opl update check --json',
  plan: 'opl update plan --json',
  apply_eligible_updates: 'opl update apply --json',
  bootstrap_missing_opl_base: 'opl-install.sh --headless --skip-packages',
  update_opl_app: 'standard_updater_or_carrier_host_update_route',
  install_opl_package: 'opl packages install ... --json',
  update_opl_package: 'opl packages update ... --json',
  repair_opl_package: 'opl packages repair --package-id <package_id> --json',
  uninstall_opl_package: 'opl packages uninstall --package-id <package_id> --json',
  ordinary_component_picker_allowed: false,
  app_mutation_scope: ['opl_app'],
  framework_mutation_scope: ['opl_base', 'opl_packages'],
};

export const managedUpdateActionSource =
  'OPL Base bootstrap through opl-install.sh, OPL App through its standard updater or carrier host route, and OPL Packages through canonical opl packages lifecycle commands';

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
  'opl update apply --json',
  'opl-install.sh --headless --skip-packages',
  'opl packages install ... --json',
  'opl packages update ... --json',
  'opl packages repair --package-id <package_id> --json',
  'opl packages uninstall --package-id <package_id> --json',
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

export const managedUpdateSoftwareObjectIds = ['opl_base', 'opl_app', 'opl_packages'];

export const managedUpdateCarrierAdapters = [
  'homebrew_formula',
  'framework_installer',
  'homebrew_cask',
  'signed_installer_or_dmg',
];

export const managedKernelRunnerResultRequiredFields = [
  'operation',
  'operation_mode',
  'execution.status',
  'idempotency_lock.status',
  'software_object_id',
  'components[software_object_id].receipt.last_receipt_ref',
  'components[software_object_id].receipt.repair_action',
  'components[software_object_id].receipt.rollback_ref',
  'components[software_object_id].receipt.post_apply_hooks',
  'execution.receipt_record.receipt_refs',
  'reload_guidance',
  'recent_actions',
  'skipped_reasons',
];

export const managedUpdateSections = ['opl_base', 'opl_app', 'opl_packages'];
export const managedUpdateDisplayPlanes = ['opl_base', 'opl_app', 'opl_packages'];
export const managedUpdateStateSources = ['opl app state --profile fast --json#managed_update', 'opl update status --json#managed_update'];
export const managedUpdateStatusConsumptionPolicy =
  'show three-object status, conditions, progress refs, and owner routes without reading artifact bodies or mutating OPL Base, OPL Packages, runtime, or domain truth';
