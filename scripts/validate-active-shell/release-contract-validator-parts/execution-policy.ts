import { assertDeepEqualJson, assertIncludesAll } from '../assertions.ts';
import { assertShellTextIncludesAll } from '../shell-implementation-helpers.ts';
import { sameStringSet } from './string-set.ts';
import type { ReleaseValidationProfile } from '../../validate-release-boundary/release-checks.ts';

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
  hosted_publication_floor_schema: 'opl_standard_hosted_publication_floor.v1',
  source_contract_build_preflight_required: 'passed',
  remote_digest_readback_required: 'passed',
  current_latest_readback_required: true,
  updater_predecessor_receipts_allowed: false,
  optional_certification_receipts_allowed: false,
  publication_ancestor_counts: { self_hosted: 0, vm: 0, tart: 0 },
  required_exact_identity_fields: [
    'bundle_digest',
    'candidate.zip.sha256',
    'candidate.zip.size_bytes',
    'candidate.dmg.sha256',
    'candidate.dmg.size_bytes',
  ],
  homebrew_follower: {
    workflow: '.github/workflows/release-stable-post-success-followups.yml',
    operation: 'reconcile_homebrew_standard',
    latest_receipt_value: null,
    consumed_by_latest_admission: false,
    failure_blocks_core_release_or_latest: false,
  },
  failure_mode: 'fail_closed_before_latest_patch',
};
const standardPrePublicationAdmissionContract = {
  validator: 'scripts/validate-standard-publication-input.ts',
  receipt_schema: 'opl_standard_pre_publication_admission_receipt.v1',
  required_status: 'passed',
  runs_before: 'publish-standard-nonlatest',
  checks: [
    'exact_component_manifest_identity_and_self_digest',
    'exact_staged_standard_asset_set',
    'staged_asset_digest_and_size_binding',
    'regular_local_asset_presence_and_digest_readback',
  ],
  public_mutation_allowed: false,
  does_not_replace: [
    'remote_digest_readback',
    'latest_admission',
  ],
  failure_mode: 'fail_closed_before_public_release_creation',
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
const frameworkReleaseAbiSha = '97510b268300b1996f308e7a4110205cd703b95e';
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
  'events',
  'consumer envelope',
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
  'opl release events --bundle <sha256:digest> [--after-event <sha256:event>] [--store <directory>]',
  'opl release consumer envelope --bundle <sha256:digest> --track <standard|full> [--source-checkpoint-run-id <run-id>] [--store <directory>]',
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
const stableBusinessStageIds = [
  'admission_and_circuit_breaker',
  'source_contract_preflight',
  'credential_runner_and_custody_preflight',
  'standard_signed_notarized_build_and_seal',
  'clean_vm_exact_artifact_qualification',
  'updater_exact_artifact_qualification',
  'standard_publication',
  'homebrew_exact_artifact_install',
  'latest_pointer_activation',
  'remote_digest_and_clean_user_installed_readback',
  'terminal_fold_and_idempotent_cleanup',
];
const stableStageAxes = ['qualification_product', 'evidence', 'transport', 'cleanup'];
const stableFailureFingerprintFields = [
  'cohort',
  'stage_id',
  'reason_code',
  'artifact_digest_or_input_digest',
  'environment_receipt_digest',
];
const validationCanaryContract = {
  workflow: '.github/workflows/release-bundle-canary.yml',
  mode: 'validation_only',
  triggers: ['daily_schedule', 'workflow_dispatch'],
  local_contract_checks: [
    'framework_checkpoint_roundtrip',
    'release_bundle_workflow_cutover',
    'release_control_plane_boundary',
  ],
  reusable_release_workflow_jobs_allowed: false,
  permissions: { contents: 'read', actions: 'read' },
  secrets_allowed: false,
  build_or_vm_execution_allowed: false,
  external_write_allowed: false,
  stable_mutation_allowed: false,
  publication_allowed: false,
  uses_stable_mutation_mutex: false,
  synthetic_identity_may_authorize_release: false,
};
function validateReleaseExecutionPolicy(releaseChannel, shellPaths, validationProfile) {
  const control = releaseChannel?.release_bundle_control_plane;
  const framework = control?.framework_authority;
  const live = control?.live_authority;
  const checkpoint = control?.checkpoint_transport;
  const operations = control?.operation_control;
  const markerPolicy = checkpoint?.active_unknown_markers;
  const fullMaterializationCheckpoint = checkpoint?.full_materialization_checkpoint;
  const standardOperation = operations?.stable_operations?.standard;
  const resumeStandardOperation = operations?.stable_operations?.resume_standard;
  const appendFullOperation = operations?.stable_operations?.append_full;
  const standardArtifactRecoveryVerification = operations?.standard_artifact_recovery_verification;
  const resilience = control?.resilience_policy;
  const publication = control?.publication;
  const publisher = control?.publisher_idempotency;
  const legacy = control?.legacy_compatibility;
  const validationCanary = control?.validation_canary;
  const acceleration = releaseChannel?.release_acceleration;
  const preflight = releaseChannel?.release_preflight;
  const localFirst = preflight?.local_first;
  const stableStageResult = preflight?.stable_stage_result;
  const failureFingerprint = preflight?.dispatch_guard?.failure_fingerprint_circuit_breaker;
  const settingsReadiness = acceleration?.settings_page_readiness_policy;
  const settingsRuntimeRefresh = acceleration?.settings_runtime_refresh_evidence_policy;
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
    framework?.operation_event_schema !== 'opl_release_bundle_operation_event.v1' ||
    framework?.consumer_envelope_schema !== 'opl_release_bundle_consumer_envelope.v1' ||
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
    live?.stable_operator_entry !== 'npm run release:stable-dispatch' ||
    live?.stable_workflow_mutation_sink !== '.github/workflows/release-stable.yml' ||
    live?.direct_stable_workflow_dispatch_allowed !== false ||
    live?.attempt_identity_separate_from_release_version !== true ||
    live?.validation_canary_entry !== '.github/workflows/release-bundle-canary.yml_schedule' ||
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
    fullMaterializationCheckpoint?.required_after_materialization !== true ||
    JSON.stringify(fullMaterializationCheckpoint?.terminal_stages) !== JSON.stringify(['full_built', 'full_qualified']) ||
    fullMaterializationCheckpoint?.qualification_failure_preserves_stage !== 'full_built' ||
    fullMaterializationCheckpoint?.recovery_preference !== 'framework_checkpoint_before_actions_artifact_selection' ||
    fullMaterializationCheckpoint?.prior_full_artifact_run_id_scope !== 'legacy_runs_without_full_built_checkpoint' ||
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
    operations?.stable_mutation_mutex !== 'opl-release-bundle-global' ||
    operations?.stable_mutation_mutex_scope !== 'public_mutation_jobs_only' ||
    JSON.stringify(operations?.stable_mutation_mutex_jobs) !== JSON.stringify([
      '_release-bundle.yml#publish-standard',
      'release-stable.yml#resume-standard',
      '_release-full-addon.yml#publish-full',
      '_release-desktop-platform-addon.yml#append-platform',
      'release-stable-post-success-followups.yml#repair-additive',
      'release-manual-preview.yml#resume-preview',
      'release-manual-preview.yml#move-latest-pointer',
      'release-manual-full-preview.yml#mutate',
    ]) ||
    operations?.operator_entry !== 'npm run release:stable-dispatch' ||
    operations?.dispatch_plan_schema !== 'opl_app_stable_dispatch_plan.v1' ||
    operations?.dispatch_attempt_schema !== 'opl_app_stable_dispatch_attempt.v1' ||
    operations?.maximum_workflow_mutations_per_attempt !== 1 ||
    operations?.mutation_retry_allowed !== false ||
    operations?.unknown_dispatch_outcome !== 'read_only_reconcile_never_redispatch' ||
    operations?.version_input_policy?.standard !== 'forbidden_controller_delegates_single_allocation_to_workflow' ||
    operations?.version_input_policy?.resume_standard !== 'forbidden_preserve_source_checkpoint_tag' ||
    operations?.version_input_policy?.append_full !== 'forbidden_preserve_source_checkpoint_tag' ||
    operations?.full_recovery_identity_roles?.source_checkpoint_run_id !== 'portable_framework_checkpoint_owner' ||
    operations?.full_recovery_identity_roles?.artifact_producer_run_id !== 'full_cohort_actions_run_id' ||
    operations?.full_recovery_identity_roles?.qualification_run_id !== 'failed_qualification_receipt_run_id' ||
    operations?.full_recovery_identity_roles?.smoke_harness_ref !== 'qualification_scope_proof_shell_head_sha_or_explicit_exact_override' ||
    operations?.full_recovery_identity_roles?.roles_must_not_be_inferred_as_equal !== true ||
    standardArtifactRecoveryVerification?.operation_fingerprint !== 'opl-desktop-stable-release:smoke-harness:<exact_shell_sha>' ||
    standardArtifactRecoveryVerification?.source_gate_reuse !== 'exact_operation_fingerprint_only' ||
    standardOperation?.source !== 'new_framework_bundle' ||
    standardOperation?.control !== 'new_immutable_standard_control' ||
    standardOperation?.deadline_minutes !== 90 ||
    resumeStandardOperation?.source !== 'portable_framework_checkpoint' ||
    resumeStandardOperation?.control !== 'reuse_exact_standard_identity_with_bounded_expired_window_rotation' ||
    resumeStandardOperation?.deadline_minutes !== 30 ||
    resumeStandardOperation?.new_operation_id_allowed !== false ||
    resumeStandardOperation?.active_window_rotation_allowed !== false ||
    resumeStandardOperation?.expired_window_rotation_allowed !== true ||
    resumeStandardOperation?.rotation_requires_no_active_unknown_marker !== true ||
    resumeStandardOperation?.rotation_started_at_source !== 'current_github_actions_run_created_at' ||
    resumeStandardOperation?.framework_source_cohort_change_allowed !== false ||
    resumeStandardOperation?.framework_executor_may_advance_to_canonical_compatible_sha !== true ||
    resumeStandardOperation?.rebuild_allowed !== false ||
    appendFullOperation?.source !== 'portable_framework_checkpoint_at_or_after_standard_built' ||
    appendFullOperation?.control !== 'new_independent_append_full_control' ||
    appendFullOperation?.deadline_minutes !== 120 ||
    appendFullOperation?.standard_built_required !== true ||
    appendFullOperation?.standard_rebuild_allowed !== false ||
    appendFullOperation?.standard_operation_id_reuse_allowed !== false ||
    appendFullOperation?.standard_deadline_inheritance_allowed !== false ||
    operations?.job_admission !== 'every_mutating_job_checks_exact_operation_and_absolute_deadline_before_first_remote_api' ||
    operations?.deadline_clock !== 'github_actions_created_at_resolved_once_by_controller' ||
    operations?.deadline_source_field !== 'github.created_at' ||
    operations?.deadline_frozen_at_controller_admission !== true ||
    operations?.deadline_may_be_rebased_on_queue_start_resume_or_rerun !== 'resume_standard_only_after_exact_reconcile_and_expiry' ||
    JSON.stringify(operations?.operation_admission_identity_fields) !== JSON.stringify([
      'operation', 'operation_id', 'operation_started_at', 'operation_deadline_at',
    ]) ||
    operations?.operation_id_required_for_admit_build_verify_publish_and_reconcile !== true ||
    operations?.same_operation_jobs_and_mutations_share_exact_deadline !== true ||
    operations?.each_external_mutation_rechecks_remaining_deadline !== true ||
    operations?.append_full_uses_new_operation_admission !== true ||
    operations?.append_full_may_inherit_standard_deadline !== false ||
    operations?.deadline_refresh_allowed !== 'resume_standard_expired_window_only' ||
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
    throw new Error('Release operations must keep Standard identity immutable, rotate only an expired reconciled resume window, keep append independent, and keep late reconcile evidence-only');
  }
  assertDeepEqualJson(
    resumeStandardOperation.reused_identity_fields,
    immutableOperationControlFields.filter((field) => !['control_digest', 'operation_started_at', 'operation_deadline_at'].includes(field)),
    'resume_standard immutable identity fields',
  );
  if (
    stableStageResult?.schema !== 'opl_app_stable_stage_result.v1' ||
    stableStageResult?.json_schema !== 'contracts/app-stable-stage-result.schema.json' ||
    stableStageResult?.script !== 'scripts/stable-stage-result.ts' ||
    stableStageResult?.authority !== 'attempt_observation_only_no_framework_state_projection' ||
    stableStageResult?.business_stage_count !== 11 ||
    stableStageResult?.primary_failure_rule !== 'lowest_stage_index_failed_qualification_product_axis' ||
    stableStageResult?.secondary_failure_rule !==
      'evidence_transport_cleanup_and_later_product_failures_do_not_overwrite_primary' ||
    stableStageResult?.cleanup_normalization?.condition !==
      'command_nonzero_and_final_inspection_absent' ||
    stableStageResult?.cleanup_normalization?.status !== 'cleanup_idempotent_success' ||
    stableStageResult?.cleanup_normalization?.records_command_anomaly !== true ||
    stableStageResult?.cleanup_normalization?.eligible_for_primary_failure !== false ||
    stableStageResult?.release_state_authority !== false ||
    stableStageResult?.framework_status_authority !== false ||
    stableStageResult?.mutation_authority !== false ||
    stableStageResult?.framework_checkpoint_projection_allowed !== false ||
    stableStageResult?.placeholder_or_inferred_success_allowed !== false ||
    stableStageResult?.workflow_binding?.workflow !== '.github/workflows/release-stable.yml' ||
    stableStageResult?.workflow_binding?.schema_env !== 'OPL_APP_STABLE_STAGE_RESULT_SCHEMA' ||
    stableStageResult?.workflow_binding?.authority_env !== 'OPL_APP_STABLE_STAGE_RESULT_AUTHORITY' ||
    stableStageResult?.workflow_binding?.stage_inputs_require_real_attempt_evidence !== true
  ) {
    throw new Error('Stable stage results must remain non-authoritative App attempt observations over real evidence');
  }
  assertDeepEqualJson(stableStageResult.stage_ids, stableBusinessStageIds, 'Stable business stage ids');
  assertDeepEqualJson(stableStageResult.axes, stableStageAxes, 'Stable stage result axes');
  if (
    failureFingerprint?.schema !== 'opl_app_stable_failure_fingerprint.v1' ||
    failureFingerprint?.stage_result_schema !== 'opl_app_stable_stage_result.v1' ||
    failureFingerprint?.attempt_included_in_identity !== false ||
    failureFingerprint?.prior_and_current_required_together !== true ||
    failureFingerprint?.unchanged_status !== 'blocked_unchanged' ||
    failureFingerprint?.unchanged_failure_code !== 'unchanged_failure_fingerprint' ||
    failureFingerprint?.unchanged_dispatch_allowed !== false ||
    failureFingerprint?.unchanged_dispatch_count !== 0 ||
    failureFingerprint?.unchanged_mutation_invocation_count !== 0 ||
    failureFingerprint?.evaluated_before_git_wire_or_owner_api !== true ||
    failureFingerprint?.changed_fingerprint_only_continues_read_only_pre_nonce_gates !== true
  ) {
    throw new Error('Stable dispatch must fail closed on one unchanged exact failure fingerprint before transport');
  }
  assertDeepEqualJson(
    failureFingerprint.identity_fields,
    stableFailureFingerprintFields,
    'Stable failure fingerprint fields',
  );
  if (
    publication?.stable?.primary_release_manual_dispatch_workflow !== '.github/workflows/release-stable.yml' ||
    publication?.stable?.additive_repair_manual_dispatch_workflow !==
      '.github/workflows/release-stable-post-success-followups.yml' ||
    publication?.stable?.trigger !== 'workflow_dispatch' ||
    publication?.stable?.lower_level_workflows !==
      'workflow_call_only_except_protected_same_tag_installer_repair'
  ) {
    throw new Error('Stable primary publication and protected same-tag installer repair must remain separate bounded manual entries');
  }
  if (
    publication?.nightly?.status !== 'implemented' ||
    publication?.nightly?.publication_available !== true ||
    publication?.nightly?.mutation_available !== true ||
    publication?.nightly?.historical_readback_allowed !== true ||
    publication?.nightly?.workflow !== '.github/workflows/release-nightly.yml' ||
    publication?.nightly?.default_trigger !== 'daily_schedule' ||
    JSON.stringify(publication?.nightly?.development_validation_trigger) !== JSON.stringify({
      event: 'workflow_dispatch',
      authority: 'user_explicit',
      confirmation: 'publish_nonlatest_nightly',
      execution_path: 'same_as_scheduled_nightly',
    }) ||
    publication?.nightly?.scheduled_latest_allowed !== false ||
    publication?.nightly?.explicit_user_override_may_move_latest !== true ||
    publication?.nightly?.include_full !== false ||
    publication?.nightly?.stable_bundle_authority_used !== false ||
    publication?.nightly?.stable_mutation_mutex_used !== false ||
    publication?.nightly?.heavy_vm_blocking !== false ||
    publication?.nightly?.post_publication_followers_block_github_prerelease !== false ||
    publication?.nightly?.followup_workflow !== '.github/workflows/release-nightly-followups.yml' ||
    !sameStringSet(publication?.nightly?.followup_operations, ['reconcile_homebrew', 'run_sampled_vm'])
  ) {
    throw new Error('Nightly must default to the daily schedule and keep user-explicit development validation on the same Standard-only non-Latest path');
  }
  assertDeepEqualJson(
    publication?.stable?.latest_admission,
    standardLatestAdmissionContract,
    'Standard Latest admission',
  );
  assertDeepEqualJson(
    publication?.stable?.pre_publication_admission,
    standardPrePublicationAdmissionContract,
    'Standard pre-publication admission',
  );
  if (
    localFirst?.entrypoint !== 'scripts/verify.sh release-preflight'
    || localFirst?.reuses_existing_orchestrator !== true
    || localFirst?.public_mutation_allowed !== false
  ) {
    throw new Error('Local-first release preflight must reuse verify.sh without public mutation');
  }
  assertDeepEqualJson(
    localFirst.local_checks,
    ['actionlint', 'typecheck', 'active_shell', 'release_boundary', 'candidate_shell', 'standard_package_build'],
    'Local-first release checks',
  );
  assertDeepEqualJson(
    localFirst.remote_only,
    [
      'github_hosted_required_macos_linux_matrix',
      'github_hosted_desktop_artifacts_matrix_required',
      'protected_signing_and_notarization_credentials',
      'public_mutation',
      'owner_authoritative_remote_readback',
    ],
    'Local-first remote-only checks',
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
    resilience?.updater_candidate_identity_required_before_publication !== true ||
    resilience?.updater_predecessor_to_candidate_vm_required_before_publication !== false ||
    resilience?.updater_clean_install_qualification !== 'exact_candidate_standard_clean_install_and_runtime_version_readback' ||
    resilience?.updater_zip_digest_source !== 'sha256_of_actual_candidate_zip_bytes' ||
    JSON.stringify(resilience?.updater_zip_identity_fields) !== JSON.stringify(['size_bytes', 'sha256']) ||
    resilience?.updater_metadata_declared_digest_is_not_sufficient !== true ||
    resilience?.homebrew_single_writer !== true ||
    resilience?.homebrew_unknown_outcome !== 'follower_fails_independently_then_fresh_cas_readback_before_optional_rerun' ||
    resilience?.homebrew_reconcile_owner !== '.github/workflows/release-stable-post-success-followups.yml#reconcile_homebrew_standard' ||
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
    legacy?.retired_scripts_may_parse_historical_receipts !== false ||
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
    throw new Error('Legacy release broker, session, and operator implementations must remain absent while retained Bundle status commands read historical evidence');
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
    settingsRuntimeRefresh,
    {
      schema: 'opl_settings_runtime_refresh_evidence_policy.v1',
      production_default_targets_required: true,
      synthetic_target_injection_allowed: false,
      required_routes: [
        {
          id: 'runtime-settings-alias',
          requested_hash: '#/settings/runtime',
          allowed_resolved_hash_prefixes: ['#/settings/environment'],
        },
        {
          id: 'runtime-status',
          requested_hash: '#/runtime',
          allowed_resolved_hash_prefixes: ['#/runtime'],
        },
      ],
      required_evidence_fields: [
        'id',
        'requested_hash',
        'resolved_hash',
        'interactions.runtimeRefresh.requested_hash',
        'interactions.runtimeRefresh.resolved_hash',
        'interactions.runtimeRefresh.readiness.hash',
        'interactions.runtimeRefresh.readiness.state',
        'interactions.runtimeRefresh.readiness.pageReady',
        'interactions.runtimeRefresh.refresh.before_click.buttonReady',
        'interactions.runtimeRefresh.refresh.after_click.buttonReady',
      ],
      allowed_readiness_states: ['ready', 'empty'],
      distinct_entry_per_route_required: true,
      default_timeout_ms: 30000,
      phase_timeout_binding: 'min_timeout_ms_and_codex_readiness_phase_timeout_ms_or_timeout_ms',
      validator: 'scripts/validate-settings-smoke-runtime-evidence.ts',
      workflow: '.github/workflows/opl-first-run-vm.yml',
      verification_artifact: 'artifacts/opl-first-run-vm/artifacts/settings-runtime-refresh-verification.json',
      source_implementation_failure_mode: 'fail_closed_before_expensive_build_or_vm',
      runtime_evidence_failure_mode: 'fail_closed_before_qualification_receipt_or_publication',
      rule: 'Production Settings smoke must exercise both the legacy Settings Runtime alias and the standalone Runtime route with independent requested/resolved route identity, structural readiness, and pre/post refresh idle evidence. Synthetic target injection may support unit tests but cannot satisfy the production release gate.',
    },
    'Settings Runtime refresh production evidence policy',
  );
  if (shellPaths?.contract.active_shell === 'aionui') {
    assertShellTextIncludesAll(
      shellPaths,
      'scripts/opl-first-run-vm-smoke.mjs',
      [
        'function buildRuntimeRefreshProbePlan(requestedHash, timeoutMs = DEFAULT_RUNTIME_REFRESH_TIMEOUT_MS)',
        "requestedHash === '#/settings/runtime'",
        "mode: 'settings-maintenance-updates'",
        "aliasResolvedHash: '#/settings/environment'",
        "refreshHash: '#/settings/environment?section=updates'",
        'function settingsRuntimeAliasResolutionExpression(requestedHash, aliasResolvedHash)',
        'function settingsMaintenanceUpdatesReadinessExpression(refreshHash)',
        'function settingsUpdatesRefreshButtonIdleExpression()',
        'function settingsUpdatesRefreshClickExpression()',
        "const selector = '[data-testid=\"opl-managed-update-refresh\"]'",
        "requestedHash === '#/runtime'",
        "mode: 'runtime-v2'",
        "resolvedHashPrefixes: ['#/runtime']",
        'async function exerciseRuntimeRefresh(client, targetHash, timeoutMs = DEFAULT_RUNTIME_REFRESH_TIMEOUT_MS)',
        'settingsRuntimeAliasResolutionExpression(probePlan.requestedHash, probePlan.aliasResolvedHash)',
        'settingsMaintenanceUpdatesReadinessExpression(probePlan.refreshHash)',
        'settingsUpdatesRefreshClickExpression()',
        'requested_hash: targetHash',
        'alias_resolved_hash: aliasResolution.aliasResolvedHash ?? aliasResolution.hash',
        'resolved_hash: resolvedHash',
        'const runtimeRefreshTimeoutMs = Math.min(',
        'options.codexReadinessPhaseTimeoutMs ?? options.timeoutMs',
        "const settingsRuntimeRefresh = await (hooks.exerciseRuntimeRefresh ?? exerciseRuntimeRefresh)(",
        "'#/settings/runtime',",
        "id: 'runtime-settings-alias'",
        "const standaloneRuntimeRefresh = await (hooks.exerciseRuntimeRefresh ?? exerciseRuntimeRefresh)(",
        "'#/runtime',",
        "id: 'runtime-status'",
      ],
      'production Settings Runtime dual-route refresh evidence',
    );
  }
  assertDeepEqualJson(
    assistantRouteSmoke?.standard?.required,
    [
      'compiled_release_qualification_targets_visible',
      'projection_state_observed_per_target',
      'projected_targets_selectable',
      'available_projected_targets_launch_admitted_without_send',
      'unavailable_projected_targets_send_blocked_with_typed_repair_guidance',
    ],
    'Standard assistant state-aware launch-admission requirements',
  );
  assertIncludesAll(
    assistantRouteSmoke?.full?.required,
    [
      'compiled_release_qualification_targets_visible',
      'projected_targets_launchable',
      'selected_project_directory_applied_to_session_and_domain_workspace_identity',
      'real_guid_composer_send_without_shell_package_activation_per_target',
      'conversation_get_readback_per_target',
      'Framework_stage_runtime_activation_uses_Stage_workspace_locator_per_target',
      'Framework_stage_runtime_activation_evidence_per_target',
      'release_evidence_route_receipt_per_target',
    ],
    'Full assistant production launch-path requirements',
  );
  assertIncludesAll(
    assistantRouteSmoke?.full?.forbidden,
    [
      'direct_conversation_post',
      'Shell_agent_package_activation_before_or_during_send',
      'synthetic_Framework_stage_runtime_activation_evidence',
      'synthetic_release_evidence_route_receipt',
    ],
    'Full assistant synthetic launch-path prohibitions',
  );
  if (
    assistantRouteSmoke?.standard?.verification_mode !== 'state_aware_launch_admission' ||
    assistantRouteSmoke?.full?.verification_mode !== 'route_receipt' ||
    assistantRouteSmoke?.target_fixture_ref !==
      'contracts/app-first-run-test-matrix.json#release_qualification_agent_target_fixture' ||
    assistantRouteSmoke?.target_fixture_boundary !==
      'release_qualification_probe_input_only_without_runtime_catalog_visibility_action_or_install_authority' ||
    assistantRouteSmoke?.runtime_target_resolution !==
      'resolve every fixture target from fresh app_state.agent_packages.directory.entries and status_index.home_shortcut_preferences before probing' ||
    !assistantRouteSmoke?.standard?.forbidden?.includes('claim_full_route_receipt_from_standard_launch_admission') ||
    !assistantRouteSmoke?.full?.required?.includes('release_evidence_route_receipt_per_target')
  ) {
    throw new Error(
      'Release assistant smoke must resolve a non-authoritative target fixture and separate Standard state-aware launch admission from Full route receipts',
    );
  }

  const vmGates = Array.isArray(acceleration?.vm_gates) ? acceleration.vm_gates : [];
  const hostedLinux = acceleration?.hosted_linux_certification;
  assertDeepEqualJson(
    vmGates.map((gate) => gate?.id),
    [
      'standard_dmg_clean_vm_smoke',
      'homebrew_standard_cask_clean_vm_smoke',
      'full_dmg_clean_vm_smoke',
    ],
    'Physical VM qualification gates',
  );
  const requiredVmGates = vmGates.filter((gate) =>
    ['standard_dmg_clean_vm_smoke', 'full_dmg_clean_vm_smoke'].includes(gate?.id),
  );
  for (const gate of requiredVmGates) {
    if (
      gate?.diagnostic_scope !== 'release_gate' ||
      gate?.gate_policy !== 'required_prepublication_same_candidate' ||
      !Array.isArray(gate?.certification_readiness) ||
      gate.certification_readiness.length === 0 ||
      !sameStringSet(gate?.release_blocking_readiness, [
        'gateway_account_login',
        'official_profile_first_install',
        'fresh_framework_agent_projection',
      ])
    ) {
      throw new Error('Standard and Full physical VM qualification must fail closed on the exact same candidate');
    }
  }
  const optionalVmGate = vmGates.find((gate) => gate?.id === 'homebrew_standard_cask_clean_vm_smoke');
  if (
    optionalVmGate?.diagnostic_scope !== 'post_publication_optional_certification' ||
    optionalVmGate?.gate_policy !== 'optional_non_blocking_same_published_artifact' ||
    'release_blocking_readiness' in (optionalVmGate ?? {})
  ) {
    throw new Error('Homebrew physical VM qualification must remain post-publication optional certification');
  }
  const fullVmGate = vmGates.find((gate) => gate?.id === 'full_dmg_clean_vm_smoke');
  const legacyVmGate = acceleration?.vm_gate;
  for (const field of [
    'source',
    'artifact',
    'smoke_profile',
    'display',
    'settings_smoke',
    'diagnostic_scope',
    'runtime_profile',
    'codex_config_wizard',
    'gate_policy',
    'certification_readiness',
    'release_blocking_readiness',
    'post_core_ready_background_policy',
  ]) {
    assertDeepEqualJson(
      legacyVmGate?.[field],
      fullVmGate?.[field],
      `Legacy Full VM required qualification mirror ${field}`,
    );
  }
  assertDeepEqualJson(
    hostedLinux,
    {
      id: 'linux_x64_same_artifact_install_smoke',
      workflow: '.github/workflows/release-post-publication-certification.yml',
      runner: 'ubuntu-latest',
      platform: 'linux-x64',
      artifact: 'One-Person-Lab-<version>-linux-x64.deb',
      installer: 'opl-install.sh',
      installer_arguments: ['--desktop', '--release-tag', '<exact-tag>', '--no-open'],
      app_release_single_tag_asset_binding_required: true,
      same_release_tag_required: true,
      desktop_manifest_cohort_binding_required: true,
      same_deb_artifact_identity_required: true,
      cross_component_version_sha_or_cohort_equality_required: false,
      dependency_compatibility_contract_ref:
        'contracts/app-install-exposure-policy.json#component_interoperability.compatibility_admission',
      typed_admission_schema: 'opl_app_stable_desktop_asset_append.v1',
      typed_execution_evidence_schema: 'opl_app_linux_same_tag_desktop_install.v1',
      clean_machine_preinstall_absence_required: true,
      installed_executable_byte_parity_required: true,
      failed_download_evidence_truthful_required: true,
      terminal_statuses: ['passed', 'failed'],
      unavailable_allowed: false,
      downloaded_from_published_release_required: true,
      rebuilt_allowed: false,
      failure_receipt_uploaded_before_job_failure: true,
      gate_policy: 'optional_non_blocking_same_published_artifact',
      required_for_publication_or_latest: false,
    },
    'GitHub-hosted Linux x64 same-artifact optional certification',
  );

  const stableValidation = releaseChannel?.release_validation_profiles?.stable;
  const nightlyValidation = releaseChannel?.release_validation_profiles?.nightly_standard;
  assertDeepEqualJson(
    stableValidation?.post_publication_optional_certification_surfaces,
    [
      'stable_shell_upgrade_routes',
      'homebrew_standard_cask_clean_vm_smoke',
      'one_shot_app_installer_fresh_install_smoke',
    ],
    'Stable post-publication optional certification surfaces',
  );
  assertDeepEqualJson(
    stableValidation?.same_candidate_prepublication_clean_install_gates,
    ['standard_dmg_clean_vm_smoke', 'full_dmg_clean_vm_smoke'],
    'Stable same-candidate clean-install gates',
  );
  assertDeepEqualJson(
    stableValidation?.hosted_post_publication_optional_certification_surfaces,
    ['linux_x64_same_artifact_install_smoke'],
    'Stable hosted post-publication optional certification surfaces',
  );
  if (
    stableValidation?.addon_gate_blocking_standard_terminal !== false ||
    !stableValidation?.addon_lanes?.includes('full_dmg_clean_vm_smoke') ||
    stableValidation?.diagnostic_lanes?.includes('full_dmg_clean_vm_smoke') ||
    !stableValidation?.required_lanes?.includes('standard_macos_arm64_build') ||
    !stableValidation?.required_lanes?.includes('standard_dmg_clean_vm_smoke') ||
    stableValidation?.required_lanes?.includes('standard_linux_x64_build') ||
    !nightlyValidation?.required_lanes?.includes('standard_macos_arm64_build') ||
    nightlyValidation?.required_lanes?.includes('standard_dmg_clean_vm_smoke') ||
    nightlyValidation?.required_lanes?.includes('standard_linux_x64_build')
  ) {
    throw new Error(
      'Standard and Full clean-install gates must protect only their respective Stable track; '
      + 'Stable and Nightly core validation must remain macOS ARM64-only',
    );
  }
  const platformMatrix = releaseChannel?.release_platform_matrix;
  const capabilities = platformMatrix?.capabilities;
  const policies = platformMatrix?.policies;
  const capabilityIds = [
    'macos-arm64',
    'macos-x64',
    'macos-universal',
    'linux-x64',
    'linux-arm64',
    'windows-x64',
    'windows-arm64',
  ];
  const developmentValidationOnlyCapabilityIds = [
    'macos-x64',
    'macos-universal',
    'linux-arm64',
    'windows-arm64',
  ];
  assertDeepEqualJson(
    Object.keys(capabilities ?? {}).sort(),
    capabilityIds.slice().sort(),
    'Release platform capabilities',
  );
  assertDeepEqualJson(
    policies?.stable_required?.platforms,
    ['macos-arm64'],
    'Stable required platform policy',
  );
  assertDeepEqualJson(
    policies?.nightly_standard?.platforms,
    ['macos-arm64'],
    'Nightly required platform policy',
  );
  assertDeepEqualJson(
    policies?.preview_standard?.platforms,
    ['macos-arm64', 'linux-x64'],
    'Preview required platform policy',
  );
  assertDeepEqualJson(
    policies?.stable_desktop_additional?.platforms,
    ['linux-x64', 'windows-x64'],
    'Stable additional Desktop platform policy',
  );
  if (validationProfile !== 'stable') {
    assertDeepEqualJson(
      platformMatrix?.validation_ownership?.windows?.owned_test_paths,
      [
        'tests/release/docker-webui-clean-windows-dispatch.test.ts',
        'tests/release/docker-webui-native-windows-smoke.test.ts',
        'tests/release/docker-webui-windows-installer.test.ts',
        'tests/release/docker-webui-windows-validation-fixtures.test.ts',
        'tests/release/windows-platform-factory-contract.test.ts',
        'tests/release/windows-stable-surface.test.ts',
        'tests/release/windows-updater-upgrade-vm.test.ts',
        'tests/release/windows-wsl2-validation-fixtures.test.ts',
      ],
      'Windows validation ownership',
    );
  }
  const publicationCapabilityIds = validationProfile === 'stable'
    ? ['macos-arm64', 'linux-x64', 'windows-x64']
    : validationProfile === 'windows'
      ? ['windows-x64', 'windows-arm64']
      : capabilityIds;
  if (
    platformMatrix?.schema !== 'opl_app_release_platform_matrix.v1'
    || platformMatrix?.resolver !== 'scripts/resolve-release-platform-matrix.ts'
    || platformMatrix?.release_tiers?.primary?.carrier !== 'desktop_macos_arm64'
    || JSON.stringify(platformMatrix?.release_tiers?.primary?.platforms) !== JSON.stringify(['macos-arm64'])
    || platformMatrix?.release_tiers?.primary?.blocks_base_terminal !== true
    || JSON.stringify(platformMatrix?.release_tiers?.additional_nonblocking?.desktop_platforms) !==
      JSON.stringify(['linux-x64', 'windows-x64'])
    || JSON.stringify(platformMatrix?.release_tiers?.additional_nonblocking?.container_webui?.platforms) !==
      JSON.stringify(['linux/amd64', 'linux/arm64'])
    || platformMatrix?.release_tiers?.additional_nonblocking?.container_webui?.single_multi_arch_manifest_required !== true
    || platformMatrix?.release_tiers?.additional_nonblocking?.container_webui?.native_runner_qualification_required !== true
    || platformMatrix?.release_tiers?.additional_nonblocking?.container_webui?.qualification_trigger !== 'stable_standard_or_manual_non_public_qualification_or_protected_repair'
    || platformMatrix?.release_tiers?.additional_nonblocking?.container_webui?.included_in_pr_or_main_ci !== false
    || platformMatrix?.release_tiers?.additional_nonblocking?.container_webui?.blocks_desktop_macos_arm64 !== false
    || platformMatrix?.release_tiers?.additional_nonblocking?.container_webui?.required_for_stable_terminal !== true
    || capabilities?.['macos-arm64']?.default_enabled !== true
    || capabilities?.['macos-arm64']?.blocks_stable !== true
    || capabilities?.['linux-x64']?.default_enabled !== true
    || capabilities?.['linux-x64']?.stable_allowed !== true
    || capabilities?.['linux-x64']?.blocks_stable !== false
    || !capabilities?.['linux-x64']?.quality_channels?.includes('stable')
    || capabilities?.['windows-x64']?.default_enabled !== true
    || capabilities?.['windows-x64']?.stable_allowed !== true
    || capabilities?.['windows-x64']?.blocks_stable !== false
    || !capabilities?.['windows-x64']?.quality_channels?.includes('stable')
    || capabilities?.['windows-x64']?.publication_status !== 'same_app_release'
    || capabilities?.['windows-x64']?.publication_route !== '.github/workflows/build-manual.yml'
    || capabilities?.['windows-arm64']?.default_enabled !== false
    || capabilities?.['windows-arm64']?.stable_allowed !== false
    || capabilities?.['windows-arm64']?.blocks_stable !== false
    || developmentValidationOnlyCapabilityIds.some((capabilityId) =>
      capabilities?.[capabilityId]?.stable_allowed !== false
      || capabilities?.[capabilityId]?.publication_status !== 'development_validation_only'
      || capabilities?.[capabilityId]?.publication_route !== null
      || !capabilities?.[capabilityId]?.quality_channels?.includes('development_validation')
    )
    || publicationCapabilityIds.some((capabilityId) =>
      !(
        typeof capabilities?.[capabilityId]?.publication_route === 'string'
        || (
          developmentValidationOnlyCapabilityIds.includes(capabilityId)
          && capabilities?.[capabilityId]?.publication_route === null
        )
      )
      || capabilities?.[capabilityId]?.publication_status?.includes('unavailable')
    )
    || policies?.stable_desktop_additional?.selection_mode !== 'capability_default_enabled_only'
    || JSON.stringify(platformMatrix?.stable_desktop_additional_selection?.default) !==
      JSON.stringify(['linux-x64', 'windows-x64'])
    || platformMatrix?.validation_ownership?.stable?.excluded_profile !== 'windows'
    || platformMatrix?.stable_desktop_additional_selection?.authority_field !==
      'opl_app_stable_operation_authority.v1#desktop_additional_platforms'
    || platformMatrix?.stable_desktop_additional_selection?.control_field !==
      'opl_app_stable_operation_control.v1#desktop_additional_platforms'
    || platformMatrix?.stable_desktop_additional_selection?.arbitrary_command_or_os_input_allowed !== false
    || platformMatrix?.desktop_platform_additive_follower?.carrier !==
      'same_mutable_stable_release_assets'
    || platformMatrix?.desktop_platform_additive_follower?.workflow !==
      '.github/workflows/release-stable-post-success-followups.yml'
    || platformMatrix?.desktop_platform_additive_follower?.platform_workflow !==
      '.github/workflows/_release-desktop-platform-addon.yml'
    || platformMatrix?.desktop_platform_additive_follower?.builder !==
      '.github/workflows/build-manual.yml'
    || platformMatrix?.desktop_platform_additive_follower?.base_release_must_be_published_mutable !== true
    || platformMatrix?.desktop_platform_additive_follower?.new_release_or_tag_allowed !== false
    || platformMatrix?.desktop_platform_additive_follower?.same_name_different_digest !== 'fail_closed'
    || platformMatrix?.desktop_platform_additive_follower?.platform_manifest_schema !==
      'opl_app_desktop_platform_manifest.v1'
    || platformMatrix?.desktop_platform_additive_follower?.aggregate_manifest_schema !==
      'opl_app_desktop_artifact_manifest.v1'
    || platformMatrix?.desktop_platform_additive_follower?.execution !==
      'one_independent_fail_fast_false_matrix_lane_per_platform'
    || platformMatrix?.desktop_platform_additive_follower?.build_mutex !== null
    || platformMatrix?.desktop_platform_additive_follower?.public_append_mutex !== 'opl-release-bundle-global'
    || platformMatrix?.desktop_platform_additive_follower?.aggregate_manifest_replacement !==
      'staged_exact_asset_id_size_digest_compare_and_swap_then_rename'
    || platformMatrix?.desktop_platform_additive_follower?.asset_upload_order !==
      'platform_assets_before_aggregate_manifest'
    || platformMatrix?.desktop_platform_additive_follower?.same_platform_same_digest !== 'already_complete'
    || platformMatrix?.desktop_platform_additive_follower?.manual_reconcile?.operation !==
      'reconcile_desktop_platform'
    || JSON.stringify(platformMatrix?.desktop_platform_additive_follower?.manual_reconcile?.inputs) !==
      JSON.stringify(['source_run_id', 'desktop_platform'])
    || platformMatrix?.desktop_platform_additive_follower?.manual_reconcile?.failed_run_or_generation_input_allowed !== false
    || platformMatrix?.desktop_platform_additive_follower?.manual_reconcile?.new_tag_allowed !== false
    || platformMatrix?.desktop_platform_additive_follower?.base_release_asset_append_allowed !== true
    || platformMatrix?.desktop_platform_additive_follower?.make_latest !== false
    || platformMatrix?.desktop_platform_additive_follower?.stable_additive_repair?.operation !==
      'repair_additive'
    || JSON.stringify(platformMatrix?.desktop_platform_additive_follower?.stable_additive_repair?.allowed_asset_names) !==
      JSON.stringify(['opl-install.sh'])
    || platformMatrix?.desktop_platform_additive_follower?.stable_additive_repair?.new_release_or_tag_allowed !== false
    || platformMatrix?.desktop_platform_additive_follower?.stable_additive_repair?.version_allocator_used !== false
    || platformMatrix?.desktop_platform_additive_follower?.stable_additive_repair?.macos_primary_assets_frozen !== true
    || platformMatrix?.desktop_platform_additive_follower?.stable_additive_repair?.updater_metadata_frozen !== true
    || platformMatrix?.desktop_platform_additive_follower?.stable_additive_repair?.release_body_frozen !== true
    || platformMatrix?.desktop_platform_additive_follower?.stable_additive_repair?.tag_target_frozen !== true
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.build_validator !==
      'scripts/validate-windows-updater-assets.ts'
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.updater_version_source !==
      'exact_standard_bundle_release_updater_version'
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.authenticode_required_for_publication !== false
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.authenticode_receipt !==
      'opl-windows-authenticode-receipt.json'
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.unsigned_publication_allowed !== true
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.code_signing_status_must_be_explicit !== true
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.runtime_resolver !==
      'opl-studio/desktop/updater.mjs'
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.base_stable_asset_append_allowed !== true
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.latest_pointer_mutation_allowed !== false
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.workflow !==
      '.github/workflows/windows-updater-upgrade-vm-preflight.yml'
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.admission_validator !==
      'scripts/validate-windows-updater-upgrade-vm-admission.ts'
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.host_dry_run_harness !==
      'scripts/Test-OPLWindowsUpdaterUpgradeVM.ps1'
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.cross_component_exact_cohort_required !== false
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.compatibility_receipt_schema !==
      'opl_component_compatibility_receipt.v1'
    || JSON.stringify(platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.compatibility_requirement_kinds) !==
      JSON.stringify(['capability_id_with_versioned_schema', 'minimum_version', 'semver_range'])
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.runner_offline_or_busy !==
      'typed_not_ready_without_queue'
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.factory_authority !==
      'existing_opl_windows_vm_lease_v2_and_clean_vm_attestation_v2_only'
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.current_execute_available !== false
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.publication_or_install_authority_granted_by_preflight !== false
    || platformMatrix?.desktop_platform_additive_follower?.windows_x64_updater_assets?.upgrade_vm_qualification?.blocks_stable_or_latest !== false
    || platformMatrix?.full_macos_additive_follower?.workflow !==
      '.github/workflows/release-stable-post-success-followups.yml'
    || platformMatrix?.full_macos_additive_follower?.trigger !==
      'successful_standard_publication_or_manual_target_state_reconcile'
    || platformMatrix?.full_macos_additive_follower?.source_policy !==
      'full_artifact_self_identity_plus_exact_mutable_standard_asset_set_cas'
    || platformMatrix?.full_macos_additive_follower?.standard_release_prerequisite_required !== true
    || platformMatrix?.full_macos_additive_follower?.cross_component_exact_version_sha_or_cohort_binding_allowed !== false
    || platformMatrix?.full_macos_additive_follower?.compatibility_contract_ref !==
      'contracts/app-install-exposure-policy.json#component_interoperability.compatibility_admission'
    || platformMatrix?.full_macos_additive_follower?.carrier !== 'same_standard_release_assets'
    || platformMatrix?.full_macos_additive_follower?.tag_derivation !== 'none_use_exact_standard_tag'
    || platformMatrix?.full_macos_additive_follower?.new_release_or_tag_allowed !== false
    || platformMatrix?.full_macos_additive_follower?.target_release_must_be_mutable !== true
    || JSON.stringify(platformMatrix?.full_macos_additive_follower?.target_standard_reference?.required_fields) !==
      JSON.stringify(['repository', 'release_id', 'tag', 'target_commitish', 'immutable', 'standard_asset_set', 'standard_attestation'])
    || platformMatrix?.full_macos_additive_follower?.target_standard_reference?.purpose !==
      'same_release_append_target_and_standard_asset_cas'
    || platformMatrix?.full_macos_additive_follower?.target_standard_reference?.cross_component_compatibility_gate_allowed !== false
    || platformMatrix?.full_macos_additive_follower?.target_standard_reference?.base_assets_mutation_allowed !== false
    || platformMatrix?.full_macos_additive_follower?.standard_asset_or_latest_mutation_allowed !== false
    || platformMatrix?.full_macos_additive_follower?.blocks_stable_base_terminal !== false
    || platformMatrix?.full_macos_additive_follower?.blocks_latest_activation !== false
    || platformMatrix?.full_macos_additive_follower?.recovery !==
      'target_state_reconcile_with_current_canonical_executor_and_no_failed_run_inputs'
    || platformMatrix?.full_macos_additive_follower?.automatic_checkpoint_reuse !==
      'latest_nonexpired_full_or_append_operation_checkpoint_with_exact_full_content_cohort_in_the_standard_recovery_chain'
    || platformMatrix?.full_macos_additive_follower?.one_active_owner_per_recovery_chain !== true
  ) {
    throw new Error('Release platform matrix must keep only macOS ARM64 Stable-blocking while platform followers and the same-tag Full module remain non-blocking');
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

export { validateReleaseExecutionPolicy };
