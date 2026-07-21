import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { validateReleaseFullFirstInstallPayloads } from './release-full-first-install-payload-validator.ts';
import { managedUpdateCarrierAdapters, managedUpdateSoftwareObjectIds } from './managed-update-plane-policy.ts';
import { assertShellTextIncludesAll } from './shell-implementation-helpers.ts';
import {
  appOwnedStorageCarrierBehavior,
  appOwnedWebuiDataVolumeHostActionCapabilityId,
} from './app-contract-constants.ts';

const retiredReleasePackageScripts = [
  'release:stable',
  'release:operator',
  'release:publish',
  'release:bundle',
  'release:plan',
  'release:preflight',
  'release:cohort-lock',
  'release:cohort-plan',
  'release:closeout',
  'release:cleanup-drafts',
  'release:gate-reuse-plan',
  'release:cohort-manifest',
  'release:candidate-record',
  'release:candidate-record:resolve-owner',
  'release:candidate-record:validate',
  'release:candidate-record:status',
  'release:owner-candidate-record:verify',
];
const standardLatestAdmissionContract = {
  validator: 'scripts/validate-standard-latest-admission.ts',
  receipt_schema: 'opl_standard_latest_admission_receipt.v1',
  required_status: 'passed',
  latest_activation_admitted_required: true,
  framework_latest_eligible_alone_is_sufficient: false,
  required_predecessor_display_versions: ['v26.7.20', 'v26.7.21'],
  required_predecessor_receipt_count: 2,
  predecessor_receipt_schema: 'opl_updater_upgrade_qualification_receipt.v1',
  predecessor_receipts_must_be_real_updater_vm_evidence: true,
  synthetic_or_canary_predecessor_receipts_allowed: false,
  predecessor_receipt_digest_fields: [
    'updater_receipts[].operation_input_digest',
    'updater_receipts[].updater_receipt_sha256',
    'updater_receipts[].candidate_identity_sha256',
  ],
  required_exact_identity_fields: [
    'bundle_digest',
    'candidate.app_sha',
    'candidate.shell_sha',
    'candidate.framework_sha',
  ],
  same_candidate_zip_required_for_all_predecessors: true,
  candidate_zip_identity_fields: ['candidate.zip.sha256', 'candidate.zip.size_bytes'],
  homebrew_evidence: {
    publication_schema: 'opl_bundle_homebrew_publication_receipt.v1',
    clean_vm_surface_id: 'opl_tart_gui_first_run_smoke',
    readback_schema: 'opl_bundle_homebrew_readback_receipt.v1',
    required_digest_fields: [
      'homebrew.publication_receipt_sha256',
      'homebrew.clean_vm_receipt_sha256',
      'homebrew.readback_receipt_sha256',
    ],
    readback_must_bind_publication_and_clean_vm_actual_file_digests: true,
  },
  failure_mode: 'fail_closed_before_latest_patch',
};
const publisherReconcileAdmissionContract = {
  persistent_unknown_framework_receipt_required: true,
  unknown_marker_schema: 'opl_release_bundle_unknown_outcome.v1',
  fresh_framework_status_required: true,
  framework_status_surface: 'release_bundle_status',
  framework_status_marker_field: 'active_unknown_markers',
  framework_status_reconcile_field: 'tracks.<track>.reconcile_required',
  framework_status_reconcile_required_value: true,
  exact_marker_match_fields: [
    'bundle_digest',
    'operation_id',
    'operation_kind',
    'stage_operation',
    'publication_scope',
    'track',
    'remote_target',
    'prior_mutation_attempt_id',
  ],
  app_may_infer_reconcile_required: false,
  required_sequence: [
    'persist_framework_unknown_outcome_marker',
    'read_fresh_framework_status',
    'require_exact_active_unknown_marker',
    'bounded_read_only_remote_inspect',
    'framework_exact_reconcile',
  ],
  active_marker_ordinary_mutation_allowed: false,
  app_local_reconcile_loop_allowed: false,
  deadline_elapsed_allows_bounded_read_only_inspect: true,
  deadline_elapsed_allows_framework_reconcile: true,
  deadline_elapsed_reconcile_result: 'late_observation',
  deadline_elapsed_reconcile_may_advance_stage: false,
  create_upload_latest_or_homebrew_retry_allowed: false,
};
const frameworkReleaseAbiSha = '27d87877518bdf70b474b648d46a8c573f43bf40';
const frameworkReleaseCommands = [
  'freeze',
  'operation admit',
  'build',
  'checkpoint export',
  'checkpoint import',
  'verify',
  'publish',
  'reconcile',
  'status',
];
const frameworkReleaseCommandForms = [
  'opl release freeze --request <request.json> [--source-root <directory>] [--store <directory>]',
  'opl release operation admit --bundle <sha256:digest> --operation <standard|resume_standard|append_full> --operation-id <id> --operation-started-at <timestamp> --operation-deadline-at <timestamp> [--store <directory>]',
  'opl release build --bundle <sha256:digest> --executor-receipt <receipt.json> --operation <standard|resume_standard|append_full> --operation-id <id> --operation-started-at <timestamp> --operation-deadline-at <timestamp> [--store <directory>]',
  'opl release checkpoint export --bundle <sha256:digest> --output <directory> [--store <directory>]',
  'opl release checkpoint import --checkpoint <checkpoint.json> [--store <directory>]',
  'opl release verify --bundle <sha256:digest> --qualification-receipt <receipt.json> --operation <standard|resume_standard|append_full> --operation-id <id> --operation-started-at <timestamp> --operation-deadline-at <timestamp> [--track standard|full] [--store <directory>]',
  'opl release publish --bundle <sha256:digest> --executor-receipt <remote-inspect.json> --operation <standard|resume_standard|append_full> --operation-id <id> --operation-started-at <timestamp> --operation-deadline-at <timestamp> [--store <directory>]',
  'opl release reconcile --bundle <sha256:digest> --executor-receipt <receipt.json> --operation <standard|resume_standard|append_full> --operation-id <id> --operation-started-at <timestamp> --operation-deadline-at <timestamp> [--store <directory>]',
  'opl release status --bundle <sha256:digest> [--store <directory>]',
];
const immutableOperationControlFields = [
  'control_digest',
  'bundle_digest',
  'operation_id',
  'operation_kind',
  'track',
  'operation_started_at',
  'operation_deadline_at',
];
const exactUnknownMarkerFields = [
  'bundle_digest',
  'operation_id',
  'operation_kind',
  'stage_operation',
  'publication_scope',
  'track',
  'remote_target',
  'prior_mutation_attempt_id',
];
const validationCanaryContract = {
  workflow: '.github/workflows/release-bundle-canary.yml',
  mode: 'validation_only',
  triggers: ['push_main', 'pull_request'],
  starts_reusable_topology: [
    '_release-bundle.yml',
    '_release-standard-publish.yml',
    '_release-full-addon.yml',
    '_build-reusable.yml',
    'opl-first-run-vm.yml',
    'opl-updater-upgrade-vm.yml',
    'full-first-install-release.yml',
  ],
  permissions: { contents: 'read', actions: 'read' },
  secrets_allowed: false,
  build_or_vm_execution_allowed: false,
  external_write_allowed: false,
  stable_mutation_allowed: false,
  synthetic_identity_may_authorize_release: false,
};

export function validateReleaseChannelContract(releaseChannel, shellPaths = null) {
  validateReleaseCalendarGuard(releaseChannel.github_release_name);
  const managedUpdatePlane = releaseChannel.managed_update_plane;
  validateStandardUpdater(releaseChannel.standard_updater);
  validateLocalDataLifecycle(releaseChannel.local_data_lifecycle, shellPaths);
  validateWebuiGhcrImage(releaseChannel.webui_ghcr_image);
  validateManagedUpdatePlane(managedUpdatePlane);
  validateReleaseExecutionPolicy(releaseChannel);
  validateTerminalReleaseHomebrewDistribution(releaseChannel);
  validateReleaseFullFirstInstallPayloads(releaseChannel);
}

function validateReleaseCalendarGuard(releaseName) {
  const guard = releaseName?.calendar_guard;
  assertDeepEqualJson(
    guard?.required_entrypoints,
    [
      'release_version_validation',
      'framework_release_freeze',
      'framework_release_checkpoint_export_import',
      'standard_operation',
      'resume_standard_operation',
      'append_full_operation',
      'latest_activation',
    ],
    'Release calendar guard entrypoints',
  );
  if (
    guard?.time_zone !== 'Asia/Shanghai'
    || guard?.future_dated_versions_allowed !== false
    || guard?.failure_mode !== 'fail_closed_before_build_remote_lookup_or_mutation'
  ) {
    throw new Error('Release calendar guard must reject future-dated versions before build, lookup, or mutation');
  }
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

function validateTerminalReleaseHomebrewDistribution(releaseChannel) {
  const homebrew = releaseChannel?.homebrew_tap_distribution;
  if (
    homebrew?.owner !== 'one-person-lab-app' ||
    homebrew?.tap_repo !== 'gaofeng21cn/homebrew-one-person-lab' ||
    homebrew?.role !== 'downstream_opl_base_formula_and_app_cask_index' ||
    homebrew?.cohort_manifest_required !== true
  ) {
    throw new Error('Release channel Homebrew distribution must remain an App-owned cask index');
  }
  assertDeepEqualJson(homebrew.formulae, [], 'Release channel Homebrew formulae');
  assertDeepEqualJson(homebrew.allowed_formulae, ['opl'], 'Release channel allowed Homebrew formulae');
  assertDeepEqualJson(
    homebrew.allowed_casks,
    ['one-person-lab', 'one-person-lab-nightly'],
    'Release channel allowed Homebrew casks',
  );
  assertDeepEqualJson(homebrew.casks, ['one-person-lab'], 'Release channel live Stable Homebrew casks');
  assertDeepEqualJson(
    homebrew.initial_live_targets,
    ['Casks/one-person-lab.rb', 'Casks/one-person-lab-nightly.rb'],
    'Release channel Homebrew live targets',
  );
  assertDeepEqualJson(homebrew.excluded_casks, ['one-person-lab-full'], 'Release channel retired Homebrew casks');
  assertDeepEqualJson(homebrew.full_casks, [], 'Release channel Full Homebrew casks');
  assertDeepEqualJson(homebrew.nightly_formulae, [], 'Release channel nightly formulae');
  assertDeepEqualJson(homebrew.nightly_casks, ['one-person-lab-nightly'], 'Release channel nightly casks');
  assertDeepEqualJson(homebrew.carrier_adapter_semantics, {
    formula: {
      software_object: 'opl_base',
      formula: 'opl',
      lifecycle_owner: 'one-person-lab',
      app_tap_manages_formula: false,
      opl_packages_allowed: false,
    },
    cask: {
      software_object: 'opl_app',
      lifecycle_owner: 'one-person-lab-app',
      base_or_packages_mutation_allowed: false,
    },
    equivalent_direct_carriers: {
      opl_base: 'framework_installer',
      opl_app: 'signed_installer_or_dmg',
    },
    carrier_choice_changes_lifecycle_owner: false,
  }, 'Release channel Homebrew carrier adapter semantics');
  if (
    homebrew.cask_install_policy?.standard_cask !== 'one-person-lab' ||
    homebrew.cask_install_policy?.standard_cask_install_ref !== 'gaofeng21cn/one-person-lab/one-person-lab' ||
    homebrew.cask_install_policy?.fully_qualified_cask_install !== true ||
    homebrew.cask_install_policy?.trust_scope !== 'explicit_standard_and_conflicting_cask_refs_not_whole_tap'
  ) {
    throw new Error('Release channel Homebrew installs must use the fully qualified Standard cask');
  }
  assertDeepEqualJson(
    homebrew.cask_install_policy.standard_install_trusted_cask_refs,
    [
      'gaofeng21cn/one-person-lab/one-person-lab',
      'gaofeng21cn/one-person-lab/one-person-lab-full',
      'gaofeng21cn/one-person-lab/one-person-lab-nightly',
    ],
    'Release channel Homebrew trusted current and historical conflicting casks',
  );
  const tap = homebrew.tap_update_policy;
  if (
    tap?.default_remote_write_path !== 'release_bundle_protected_job_digest_bound_direct_commit' ||
    tap?.default_workflow !== '.github/workflows/_release-bundle.yml' ||
    tap?.app_release_promotion_workflow !== '.github/workflows/release-stable.yml' ||
    tap?.app_release_direct_token !== 'release-stable.OPL_HOMEBREW_TAP_TOKEN' ||
    tap?.app_release_pull_request_allowed !== false ||
    tap?.app_release_workflow_write_mode !== 'protected_environment_single_attempt_digest_bound_direct_commit' ||
    tap?.stable_release_workflow_write_mode !== 'release_bundle_standard_before_latest_only' ||
    tap?.planner_script !== 'scripts/update-homebrew-tap.ts' ||
    tap?.stable?.mode !== 'release_bundle_publishes_standard_cask_then_clean_vm_readback_before_latest' ||
    tap?.full?.mode !== 'github_release_assets_only_no_homebrew_target' ||
    tap?.full?.homebrew_publish_allowed !== false ||
    tap?.full?.homebrew_clean_vm_gate_required !== false ||
    tap?.full?.may_update_standard_cask !== false ||
    tap?.full?.may_update_nightly_cask !== false ||
    tap?.full?.standard_updater_visible !== false ||
    tap?.full?.standard_assets_notes_updater_or_latest_may_change !== false
  ) {
    throw new Error('Release channel Full must remain GitHub-assets-only with no live Homebrew target');
  }
  if (homebrew.full_first_install_policy !== 'github_release_full_dmg_only; never Homebrew cask or standard updater metadata') {
    throw new Error('Release channel Full first install must use the GitHub Release DMG, not Homebrew');
  }
  assertDeepEqualJson(
    homebrew.opl_packages_boundary?.allowed_homebrew_casks,
    ['one-person-lab', 'one-person-lab-nightly'],
    'Release channel Homebrew OPL Packages cask boundary',
  );
  if (
    homebrew.opl_packages_boundary?.homebrew_distribution_allowed !== false ||
    homebrew.opl_packages_boundary?.homebrew_formula_allowed !== false ||
    homebrew.opl_packages_boundary?.homebrew_cask_allowed !== false ||
    homebrew.codex_temporal_policy?.compatibility_mode !== 'minimum_version_plus_capability_smoke' ||
    homebrew.codex_temporal_policy?.prefer_valid_newer_system_tool !== true ||
    homebrew.codex_temporal_policy?.bundled_fallback_allowed !== true
  ) {
    throw new Error('Release channel Homebrew must not own OPL Packages and must retain compatible tool fallback');
  }
}

function validateReleaseExecutionPolicy(releaseChannel) {
  const control = releaseChannel?.release_bundle_control_plane;
  const framework = control?.framework_authority;
  const live = control?.live_authority;
  const checkpoint = control?.checkpoint_transport;
  const operations = control?.operation_control;
  const markerPolicy = checkpoint?.active_unknown_markers;
  const standardOperation = operations?.stable_operations?.standard;
  const resumeStandardOperation = operations?.stable_operations?.resume_standard;
  const appendFullOperation = operations?.stable_operations?.append_full;
  const resilience = control?.resilience_policy;
  const publication = control?.publication;
  const publisher = control?.publisher_idempotency;
  const legacy = control?.legacy_compatibility;
  const validationCanary = control?.validation_canary;
  const acceleration = releaseChannel?.release_acceleration;
  const settingsReadiness = acceleration?.settings_page_readiness_policy;
  const assistantRouteSmoke = acceleration?.assistant_route_smoke_policy;

  assertRetiredReleaseControlPlaneAbsent(releaseChannel);

  if (
    control?.schema !== 'opl_app_release_bundle_control_plane.v1' ||
    control?.contract_status !== 'active' ||
    framework?.owner !== 'gaofeng21cn/one-person-lab' ||
    framework?.cli !== 'opl release' ||
    framework?.bundle_schema !== 'opl_release_bundle.v1' ||
    framework?.checkpoint_schema !== 'opl_release_bundle_checkpoint.v1' ||
    framework?.operation_control_schema !== 'opl_release_bundle_operation_control.v1' ||
    framework?.unknown_outcome_schema !== 'opl_release_bundle_unknown_outcome.v1' ||
    framework?.portable_checkpoint_authority_first_landed_sha !== 'f785cda96' ||
    framework?.consumed_abi_sha !== frameworkReleaseAbiSha ||
    framework?.live_mutation_authority !== 'framework_release_bundle_executor' ||
    framework?.checkpoint_and_receipt_state_authority_exclusive !== true ||
    framework?.app_may_define_checkpoint_or_receipt_schema !== false ||
    framework?.app_may_derive_or_project_release_stage_state !== false
  ) {
    throw new Error('Release control plane must use the Framework Release Bundle and checkpoint executor authority');
  }
  assertDeepEqualJson(
    framework.commands,
    frameworkReleaseCommands,
    'Framework release commands',
  );
  assertDeepEqualJson(
    framework.receipt_schemas,
    [
      'opl_release_bundle_executor_receipt.v1',
      'opl_release_bundle_operation_receipt.v1',
      'opl_release_bundle_qualification_receipt.v1',
    ],
    'Framework release receipt schemas',
  );
  assertDeepEqualJson(
    framework.command_forms,
    frameworkReleaseCommandForms,
    'Framework release command forms',
  );
  if (
    live?.single_live_mutation_authority !== true ||
    live?.state_owner !== 'OPL Framework opl release' ||
    live?.state_surface !== 'opl_release_bundle_checkpoint.v1' ||
    live?.mutation_executor_owner !== 'one-person-lab-app' ||
    live?.state_authority_ref !== 'release_bundle_control_plane.framework_authority' ||
    live?.app_executor_consumes_framework_cli_results_without_state_projection !== true ||
    live?.stable_manual_entry !== '.github/workflows/release-stable.yml' ||
    live?.nightly_entry !== '.github/workflows/release-nightly.yml_schedule_only' ||
    live?.app_session_broker_or_operator_may_authorize_mutation !== false ||
    live?.framework_checkpoint_required_for_resume_or_executor_switch !== true
  ) {
    throw new Error('Release control plane must have one Framework checkpoint and App executor mutation authority');
  }
  assertDeepEqualJson(
    live.stable_operations,
    ['standard', 'resume_standard', 'append_full'],
    'Stable release operations',
  );
  assertDeepEqualJson(
    checkpoint?.stages,
    ['frozen', 'standard_built', 'standard_qualified', 'full_built', 'full_qualified'],
    'Framework checkpoint stages',
  );
  if (
    checkpoint?.schema !== 'opl_release_bundle_checkpoint.v1' ||
    checkpoint?.portable_between_executors !== true ||
    checkpoint?.import_never_rebuilds !== true ||
    checkpoint?.completed_stage_behavior !== 'skip_with_rebuild_performed_false' ||
    checkpoint?.asset_and_receipt_digest_revalidation_required !== true ||
    checkpoint?.transport_must_not_replace_source_build_provenance !== true ||
    checkpoint?.operation_controls_preserved_exactly !== true ||
    checkpoint?.same_output_idempotency_requires_complete_store_state_unchanged !== true ||
    checkpoint?.state_change_at_existing_output_fails_stale !== true ||
    checkpoint?.unknown_build_or_publish_outcome_export_allowed !== true ||
    checkpoint?.unknown_outcome_required_action !== 'status_then_exact_reconcile' ||
    markerPolicy?.schema !== 'opl_release_bundle_unknown_outcome.v1' ||
    markerPolicy?.maximum_count !== 1 ||
    markerPolicy?.checkpoint_export_preserves_exact_marker !== true ||
    markerPolicy?.checkpoint_import_preserves_exact_marker !== true ||
    markerPolicy?.checkpoint_import_required_next_action !== 'status_then_exact_reconcile' ||
    markerPolicy?.ordinary_mutations_allowed !== false ||
    markerPolicy?.resolved_marker_reimport_behavior !== 'must_not_resurrect' ||
    markerPolicy?.different_marker_overwrite_or_omission_allowed !== false ||
    checkpoint?.publish_or_promotion_state_imported !== false ||
    checkpoint?.recipient_remote_readback !== 'fresh_remote_inspect_before_any_upload_or_promotion'
  ) {
    throw new Error('Release checkpoint transport must preserve exact controls and unknown markers without rebuilding or resurrecting outcomes');
  }
  assertDeepEqualJson(
    checkpoint.source_build_provenance_fields,
    ['source_build_executor', 'source_build_run_id'],
    'Release source build provenance fields',
  );
  assertDeepEqualJson(
    checkpoint.transport_provenance_fields,
    ['checkpoint_transport_executor', 'transport_run_id'],
    'Release checkpoint transport provenance fields',
  );
  assertDeepEqualJson(
    markerPolicy.checkpoint_import_result_fields,
    ['unknown_outcomes_imported', 'active_unknown_marker_count', 'reconcile_required'],
    'Release checkpoint unknown import result fields',
  );
  assertDeepEqualJson(
    markerPolicy.allowed_commands,
    ['status', 'exact_reconcile'],
    'Release checkpoint active unknown allowed commands',
  );
  assertDeepEqualJson(
    markerPolicy.exact_reconcile_match_fields,
    exactUnknownMarkerFields,
    'Release checkpoint exact reconcile marker fields',
  );
  if (
    operations?.schema !== 'opl_release_bundle_operation_control.v1' ||
    operations?.all_channel_mutation_mutex !== 'one_repository_release_mutation_group_for_stable_and_nightly' ||
    standardOperation?.source !== 'new_framework_bundle' ||
    standardOperation?.control !== 'new_immutable_standard_control' ||
    standardOperation?.deadline_minutes !== 90 ||
    resumeStandardOperation?.source !== 'portable_framework_checkpoint' ||
    resumeStandardOperation?.control !== 'reuse_exact_standard_control' ||
    resumeStandardOperation?.deadline_minutes !== undefined ||
    resumeStandardOperation?.new_operation_id_allowed !== false ||
    resumeStandardOperation?.start_refresh_allowed !== false ||
    resumeStandardOperation?.deadline_refresh_allowed !== false ||
    resumeStandardOperation?.rebuild_allowed !== false ||
    appendFullOperation?.source !== 'portable_framework_checkpoint_at_or_after_standard_qualified' ||
    appendFullOperation?.control !== 'new_independent_append_full_control' ||
    appendFullOperation?.deadline_minutes !== 50 ||
    appendFullOperation?.standard_qualified_required !== true ||
    appendFullOperation?.standard_rebuild_allowed !== false ||
    appendFullOperation?.standard_operation_id_reuse_allowed !== false ||
    appendFullOperation?.standard_deadline_inheritance_allowed !== false ||
    operations?.job_admission !== 'every_mutating_job_checks_exact_operation_and_absolute_deadline_before_first_remote_api' ||
    operations?.deadline_clock !== 'github_actions_created_at_resolved_once_by_controller' ||
    operations?.deadline_source_field !== 'github.created_at' ||
    operations?.deadline_frozen_at_controller_admission !== true ||
    operations?.deadline_may_be_rebased_on_queue_start_resume_or_rerun !== false ||
    JSON.stringify(operations?.operation_admission_identity_fields) !== JSON.stringify([
      'operation', 'operation_id', 'operation_started_at', 'operation_deadline_at',
    ]) ||
    operations?.operation_id_required_for_admit_build_verify_publish_and_reconcile !== true ||
    operations?.same_operation_jobs_and_mutations_share_exact_deadline !== true ||
    operations?.each_external_mutation_rechecks_remaining_deadline !== true ||
    operations?.append_full_uses_new_operation_admission !== true ||
    operations?.append_full_may_inherit_standard_deadline !== false ||
    operations?.deadline_refresh_allowed !== false ||
    operations?.partial_workflow_rerun_allowed !== false ||
    operations?.github_run_attempt_required !== 1 ||
    operations?.recovery_entry !== 'status_then_exact_reconcile_for_active_unknown_else_resume_exact_standard_or_admit_independent_append_full' ||
    operations?.elapsed_deadline?.ordinary_mutation_allowed !== false ||
    operations?.elapsed_deadline?.status_allowed !== true ||
    operations?.elapsed_deadline?.exact_reconcile_allowed !== true ||
    operations?.elapsed_deadline?.exact_reconcile_result !== 'late_observation' ||
    operations?.elapsed_deadline?.stage_advanced !== false ||
    operations?.elapsed_deadline?.evidence_only !== true ||
    operations?.typed_failure_evidence_required !== true ||
    operations?.typed_failure_evidence_persisted_before_job_exit_or_cleanup !== true ||
    operations?.typed_failure_evidence_uploaded_on_failure !== true
  ) {
    throw new Error('Release operations must keep Standard immutable, resume exact, append independent, and late reconcile evidence-only');
  }
  assertDeepEqualJson(
    resumeStandardOperation.reused_control_fields,
    immutableOperationControlFields,
    'resume_standard immutable control fields',
  );
  if (
    publication?.stable?.only_manual_dispatch_workflow !== '.github/workflows/release-stable.yml' ||
    publication?.stable?.trigger !== 'workflow_dispatch' ||
    publication?.stable?.lower_level_workflows !== 'workflow_call_only'
  ) {
    throw new Error('Stable must have one manual dispatch entry and workflow_call-only lower-level topology');
  }
  assertDeepEqualJson(
    publication?.stable?.latest_admission,
    standardLatestAdmissionContract,
    'Standard Latest admission',
  );
  if (
    publisher?.missing_asset !== 'upload' ||
    publisher?.same_name_same_digest !== 'already_complete' ||
    publisher?.same_name_different_digest !== 'fail_closed_require_new_bundle_or_version' ||
    publisher?.unknown_api_result !== 'reconcile_only' ||
    publisher?.redispatch_on_unknown_allowed !== false ||
    publisher?.rerun_on_unknown_allowed !== false ||
    publisher?.cancel_on_unknown_allowed !== false
  ) {
    throw new Error('Release publisher must be digest-idempotent and reconcile-only after an unknown result');
  }
  assertDeepEqualJson(
    publisher?.reconcile_admission,
    publisherReconcileAdmissionContract,
    'Release publisher reconcile admission',
  );
  if (
    resilience?.same_day_revision_allocation_ref !== 'github_release_name.stable_revision' ||
    resilience?.machine_version_monotonicity_ref !== 'github_release_name.machine_version' ||
    resilience?.stable_version_comparison_scope !== 'all_public_stable_releases_not_latest_only' ||
    resilience?.display_and_machine_versions_both_must_increase !== true ||
    resilience?.source_and_remote_version_checks_required_before_build !== true ||
    JSON.stringify(resilience?.updater_baseline_sources) !== JSON.stringify(['current_latest', 'highest_public_stable']) ||
    resilience?.updater_qualification_order !== 'exact_previous_latest_to_candidate_zip_upgrade_before_first_public_release_mutation' ||
    resilience?.updater_zip_digest_source !== 'sha256_of_actual_candidate_zip_bytes' ||
    JSON.stringify(resilience?.updater_zip_identity_fields) !== JSON.stringify(['size_bytes', 'sha256']) ||
    resilience?.updater_metadata_declared_digest_is_not_sufficient !== true ||
    resilience?.homebrew_single_writer !== true ||
    resilience?.homebrew_unknown_outcome !== 'framework_durable_marker_status_then_exact_reconcile' ||
    resilience?.homebrew_reconcile_owner !== 'OPL Framework opl release' ||
    resilience?.homebrew_app_local_reconcile_loop_allowed !== false ||
    resilience?.homebrew_reconcile_max_attempts !== undefined ||
    resilience?.homebrew_retry_push_on_unknown_allowed !== false ||
    resilience?.homebrew_success_requires_exact_remote_commit_and_cask_digest_readback !== true ||
    resilience?.partial_publication_unknown_result !== 'framework_reconcile_before_any_new_mutation'
  ) {
    throw new Error('Release resilience must prove monotonic versions, pre-public updater bytes, and Framework-owned exact Homebrew reconcile');
  }
  if (
    !control?.cutover?.permanently_rejected_bundle_digests?.includes(
      'sha256:91d5ea069757fca6bb9aa2280615dc952caeff55b6b4bc13e08e40df32378f49',
    )
  ) {
    throw new Error('Release control plane must permanently reject the known failed Bundle digest');
  }
  if (
    legacy?.lifecycle !== 'retired_historical_receipt_compatibility' ||
    legacy?.authority_class !== 'historical_read_only' ||
    legacy?.broker_session_operator_authority !== 'historical_read_only' ||
    legacy?.access !== 'read_only' ||
    legacy?.authoritative !== false ||
    legacy?.mode !== 'read_only_receipt_parser' ||
    legacy?.new_state_creation_allowed !== false ||
    legacy?.legacy_broker_and_stable_state_machine_live_mutation_authority !== false ||
    legacy?.historical_receipts_remain_readable !== true ||
    legacy?.new_legacy_dispatch_publish_or_rebuild_allowed !== false ||
    JSON.stringify(legacy?.accepted_read_only_commands) !== JSON.stringify(['verify', 'status']) ||
    legacy?.retired_scripts_may_parse_historical_receipts !== true ||
    legacy?.retired_scripts_may_be_package_or_workflow_mutation_entrypoints !== false ||
    legacy?.legacy_contract_role !== 'historical_receipt_verification_only' ||
    acceleration?.scope !== 'product_build_qualification_vm_and_cache_policy_only' ||
    acceleration?.product_policy_only !== true ||
    acceleration?.live_state_authority !== false ||
    acceleration?.live_mutation_authority !== false ||
    acceleration?.new_session_or_dispatch_allowed !== false ||
    acceleration?.state_authority_ref !== 'release_bundle_control_plane.framework_authority' ||
    acceleration?.github_actions?.live_release_mutation_authority !== false
  ) {
    throw new Error('Legacy release broker, session, and operator surfaces must remain historical receipt readers only');
  }
  assertIncludesAll(
    legacy.parser_forbidden_capabilities,
    [
      'create_release_state',
      'authorize_mutation',
      'dispatch',
      'rerun',
      'cancel',
      'build',
      'qualify',
      'publish',
      'promote',
      'reconcile_live_state',
    ],
    'Legacy parser forbidden capabilities',
  );
  assertDeepEqualJson(
    legacy.retired_package_scripts,
    retiredReleasePackageScripts,
    'Retired release package scripts',
  );
  assertDeepEqualJson(
    validationCanary,
    validationCanaryContract,
    'Release validation-only Canary contract',
  );
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
      'selected_project_directory_applied_to_session_and_domain_workspace_identity',
      'real_guid_composer_send_without_shell_package_activation_per_starter',
      'conversation_get_readback_per_starter',
      'Framework_stage_runtime_activation_uses_Stage_workspace_locator_per_starter',
      'Framework_stage_runtime_activation_evidence_per_starter',
      'agent_package_shortcut_route_receipt_per_starter',
    ],
    'Full assistant production launch-path requirements',
  );
  assertIncludesAll(
    assistantRouteSmoke?.full?.forbidden,
    [
      'direct_conversation_post',
      'Shell_agent_package_activation_before_or_during_send',
      'synthetic_Framework_stage_runtime_activation_evidence',
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

function assertRetiredReleaseControlPlaneAbsent(releaseChannel) {
  const forbiddenKeys = new Set([
    'stable_release_state_machine',
    'cohort_prepare',
    'release_operator',
    'release_monitor',
    'gate_reuse',
    'publish_resume',
    'post_owner_receipt_fast_path',
    'broker_authority_gate',
    'promotion_saga',
    'attempt_ledger',
    'signed_mutation_authority',
  ]);
  const forbiddenWorkflowValues = new Set([
    '.github/workflows/desktop-release.yml',
    '.github/workflows/desktop-release-promote.yml',
    '.github/workflows/desktop-release-full-addon.yml',
  ]);

  const visit = (value, path = 'release_channel') => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      const entryPath = `${path}.${key}`;
      if (forbiddenKeys.has(key)) {
        throw new Error(`Retired release control-plane field remains live at ${entryPath}`);
      }
      if (typeof entry === 'string' && forbiddenWorkflowValues.has(entry)) {
        throw new Error(`Retired release writer workflow remains live at ${entryPath}`);
      }
      if (entry === 'release_operator_plan') {
        throw new Error(`Retired release operator admission remains live at ${entryPath}`);
      }
      visit(entry, entryPath);
    }
  };

  visit(releaseChannel);
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
    webuiImage?.publication_route !== 'independent_webui_lane_outside_desktop_release_bundle' ||
    webuiImage?.desktop_release_bundle_may_publish_or_move_tags !== false ||
    webuiImage?.current_writer_declared_by_desktop_release_contract !== false
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
  const ownerStorage = lifecycle.owner_storage_projections;
  assertDeepEqualJson(
    ownerStorage?.sections,
    ['agent_package_store', 'webui_data_volume'],
    'Local data lifecycle owner storage sections',
  );
  assertDeepEqualJson(
    ownerStorage?.common_required_fields,
    ['status', 'observed_at', 'stale', 'bytes', 'reclaimable_bytes', 'owner_route', 'projected_action'],
    'Local data lifecycle owner storage fields',
  );
  validateWebuiDataVolumeHostActionAbi(
    ownerStorage?.webui_data_volume?.host_action_abi,
  );
  if (
    lifecycle.storage_inventory?.surface !== 'Settings / Storage' ||
    lifecycle.storage_inventory?.execution_mode !== 'scan_dry_run_first' ||
    lifecycle.storage_inventory?.implementation !==
      'shells/aionui/packages/desktop/src/process/services/localDataLifecycle/index.ts' ||
    ownerStorage?.projection_source !== 'opl app state --profile fast --json' ||
    ownerStorage?.missing_projection_policy !== 'fail_open_keep_shell_owned_categories_available' ||
    ownerStorage?.unknown_bytes_policy !== 'unavailable_never_zero' ||
    ownerStorage?.agent_package_store?.owner !== 'one-person-lab' ||
    ownerStorage?.agent_package_store?.ordinary_action !== 'navigate_to_/settings/agents' ||
    ownerStorage?.agent_package_store?.storage_direct_uninstall_allowed !== false ||
    ownerStorage?.webui_data_volume?.inventory_owner !== 'one-person-lab' ||
    ownerStorage?.webui_data_volume?.execution_owner !== 'carrier_host' ||
    ownerStorage?.webui_data_volume?.webui_container_execution !== 'host_action_required_without_docker_socket' ||
    ownerStorage?.webui_data_volume?.generic_docker_prune_allowed !== false ||
    ownerStorage?.webui_data_volume?.shell_direct_path_delete_allowed !== false ||
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
    lifecycle.storage_carrier_behavior,
    appOwnedStorageCarrierBehavior,
    'Local data lifecycle Storage carrier behavior',
  );
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

function validateWebuiDataVolumeHostActionAbi(abi) {
  const endpoints = {
    capability: '/api/opl-storage/webui-data-volume/capability',
    plan: '/api/opl-storage/webui-data-volume/plan',
    execute: '/api/opl-storage/webui-data-volume/execute',
    restore: '/api/opl-storage/webui-data-volume/restore',
  };
  const actionIds = {
    plan_action_id: 'settings_plan_webui_data_volume_cleanup',
    execute_action_id: 'settings_execute_webui_data_volume_cleanup',
    restore_action_id: 'settings_restore_webui_data_volume_cleanup',
  };
  const exactFields = (actual, expected) =>
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((field) => actual.includes(field));
  const includesFields = (actual, expected) =>
    Array.isArray(actual) && expected.every((field) => actual.includes(field));

  if (
    !abi ||
    abi.capability_id !== appOwnedWebuiDataVolumeHostActionCapabilityId ||
    abi.endpoint_availability !== 'host_owner_injected' ||
    !includesFields(abi.endpoint_status_values, ['available', 'host_action_required']) ||
    !includesFields(abi.projection_required_fields, [
      'capability_id',
      'endpoint_status',
      'endpoint_availability',
      'plan_action_id',
      'execute_action_id',
      'restore_action_id',
    ]) ||
    Object.entries(endpoints).some(
      ([id, path]) => abi.endpoints?.[id]?.method !== 'POST' || abi.endpoints?.[id]?.path !== path,
    ) ||
    Object.entries(actionIds).some(([field, value]) => abi.action_ids?.[field] !== value) ||
    abi.unavailable_projection_policy !==
      'host_action_required_with_null_action_ids_is_status_only_and_keeps_storage_usable' ||
    abi.available_cta_gate !== 'endpoint_status_available_and_all_three_exact_action_ids_present' ||
    !includesFields(abi.plan_result_required_fields, [
      'plan_id',
      'plan_hash',
      'exact_confirmation',
      'estimated_reclaimable_bytes',
      'candidate_count',
      'restore_supported',
      'observed_at',
      'expires_at',
    ]) ||
    !exactFields(abi.execute_request_required_fields, ['plan_id', 'plan_hash', 'exact_confirmation']) ||
    !includesFields(abi.execute_receipt_required_fields, [
      'receipt_id',
      'action_id',
      'status',
      'plan_id',
      'plan_hash',
      'receipt_ref',
      'restore_action_ref',
      'archive_ref',
      'archive_manifest_ref',
      'archive_sha256',
      'archived_bytes',
      'deleted_bytes',
      'readback',
    ]) ||
    !exactFields(abi.restore_request_required_fields, ['receipt_ref']) ||
    !includesFields(abi.restore_result_required_fields, [
      'status',
      'receipt_ref',
      'restore_receipt_ref',
      'readback',
    ]) ||
    abi.terminal_readback_ref !==
      'app_state.settings_control_center.app_settings_read_model.storage_lifecycle.webui_data_volume' ||
    !includesFields(abi.terminal_readback_required_fields, [
      'status',
      'terminal',
      'observed_at',
      'bytes',
      'reclaimable_bytes',
      'receipt_ref',
      'restore_status',
    ]) ||
    !exactFields(abi.renderer_payload_allowlist, [
      'plan_id',
      'plan_hash',
      'exact_confirmation',
      'receipt_ref',
    ]) ||
    abi.renderer_raw_path_allowed !== false ||
    abi.security?.authenticated_principal !== 'current_backend_authenticated_user_required' ||
    !exactFields(abi.security?.allowed_methods, ['POST']) ||
    abi.security?.content_type !== 'application/json' ||
    abi.security?.max_body_bytes !== 65536 ||
    abi.security?.origin_policy !== 'same_origin_or_csrf_equivalent_required' ||
    abi.security?.execute_restore_serialization !== 'one_in_flight_mutation_per_data_volume' ||
    abi.security?.plan_policy !== 'ttl_bound_single_use' ||
    abi.security?.duplicate_submission_policy !== 'idempotent_terminal_readback_or_typed_conflict_only' ||
    abi.security?.error_disclosure_policy !== 'typed_reason_without_raw_path'
  ) {
    throw new Error(
      'Local data lifecycle WebUI carrier-host action ABI must preserve its endpoint, action, payload, readback, restore, and security boundaries',
    );
  }
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
