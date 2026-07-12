export const managedUpdateMustShow = [
  'OPL Base status and one-click install action when missing',
  'OPL App version, carrier status, and host update route when required',
  'OPL Packages lifecycle status and Framework-owned actions',
  'OPL Base dependency_status and integration_status only as collapsed transaction detail',
  'OPL Packages projection_status and profile_migration_status only as collapsed transaction detail',
  'conditions and repair actions from App state or opl update status',
  'user-facing OPL Packages maintenance entry under Local Environment',
  'manual check/apply/repair/rollback action mapping for OPL Packages',
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
  triggers: ['app_startup_after_core_ready', 'daily_background_maintenance', 'manual_check_updates'],
  lock_source: 'managed_update.idempotency_lock.status',
  backoff_policy: 'bounded_retry_with_last_failure_projection',
  user_blocking: false,
  must_project_last_run_and_next_run: true,
  auto_apply_policy: 'framework_owned_opl_packages_transaction_only_when_clean_managed_and_latest_stable_digest_changed',
  auto_apply_software_objects: ['opl_packages'],
  app_owned_auto_apply_software_objects: [],
  never_app_mutate_software_objects: ['opl_base', 'opl_packages'],
  must_project_recent_actions_and_skip_reasons: true,
};

export const managedUpdateUiActions = {
  refresh: 'opl update status --json',
  check: 'opl update check --json',
  plan: 'opl update plan --json',
  bootstrap_missing_opl_base: 'opl-install.sh --headless --skip-packages',
  update_opl_app: 'standard_updater_or_carrier_host_update_route',
  install_opl_package: 'opl packages install ... --json',
  update_opl_package: 'opl packages update ... --json',
  optimize_opl_flow: 'opl packages optimize opl-flow --json',
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

export const managedUpdateSections = ['opl_base', 'opl_app', 'opl_packages'];
export const managedUpdateDisplayPlanes = ['opl_base', 'opl_app', 'opl_packages'];
export const managedUpdateStateSources = ['opl app state --profile fast --json#managed_update', 'opl update status --json#managed_update'];
export const managedUpdateStatusConsumptionPolicy =
  'show three-object status, conditions, progress refs, and owner routes without reading artifact bodies or mutating OPL Base, OPL Packages, runtime, or domain truth';

export const managedOplPackageIds = [
  'mas',
  'mag',
  'rca',
  'oma',
  'obf',
  'mas-scholar-skills',
  'opl-flow',
];

export const managedOplPackageKinds = {
  mas: 'domain_agent_package',
  mag: 'domain_agent_package',
  rca: 'domain_agent_package',
  oma: 'domain_agent_package',
  obf: 'domain_agent_package',
  'mas-scholar-skills': 'framework_capability_package',
  'opl-flow': 'workflow_plugin_package',
};

export const oplFlowPackagePolicy = {
  package_id: 'opl-flow',
  package_kind: 'workflow_plugin_package',
  consumer: 'standard_and_full_workflow_baseline',
  install_command: 'opl packages install opl-flow',
  update_command: 'opl packages update opl-flow',
  optimize_command: 'opl packages optimize opl-flow',
  app_direct_profile_mutation_allowed: false,
  framework_profile_transaction_allowed: true,
  profile_sync_policy: 'codex_semantic_merge_with_marker_cleanup_hash_backup_receipt_rollback_and_packet_fallback',
  post_app_update_reconcile_trigger: 'running_version_switched_only',
  workflow_profile_semantic_merge_ref:
    'managed_update_plane.software_lifecycle.objects.opl_packages.optional_internal_fields#profile_migration_status',
  standard_updater_allowed: false,
};
