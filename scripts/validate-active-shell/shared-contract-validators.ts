import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appOwnedProjectGroupExpansionPolicy,
  appOwnedRunningStatePolicy,
  firstRunCoreItems,
} from './app-contract-constants.ts';

const resourceContextOptionalTaskRefs = [
  'resource_source_refs',
  'gateway_status_ref',
  'environment_ref',
  'storage_ref',
  'resource_plan_ref',
  'resource_approval_ref',
  'resource_execute_ref',
  'resource_monitor_ref',
  'resource_collect_ref',
  'resource_usage_ref',
  'console_policy_ref',
  'quota_ref',
  'billing_ref',
  'permission_ref',
  'environment_template_ref',
  'environment_version_ref',
  'environment_source_ref',
  'environment_task_refs',
  'resource_receipt_ref',
  'cost_estimate_ref',
];

export function validateTaskAwarenessProjectionContract(projection, label) {
  if (!projection || typeof projection !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.task_drilldowns',
    authority: 'opl_framework_refs_only_task_awareness_projection',
    display_policy: 'runtime_global_task_awareness_with_current_task_slices_no_new_dashboard',
    global_surface: 'runtime_page',
    app_role: 'display_only_task_awareness_consumer',
    shell_role: 'thin_renderer_no_runtime_store',
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    projection.required_task_ref_fields,
    ['task_id', 'stage', 'progress_label', 'next_owner', 'artifact_or_blocker', 'review_receipt', 'action_receipt'],
    `${label} required_task_ref_fields`,
  );
  assertIncludesAll(
    projection.optional_task_ref_fields,
    [
      'capability_health_refs',
      'workflow_refs',
      'export_bundle_action_ref',
      'connector_readiness_refs',
      'diagnostic_substrate_refs',
      ...resourceContextOptionalTaskRefs,
    ],
    `${label} optional_task_ref_fields`,
  );
  for (const [field, expected] of Object.entries({
    artifact_or_blocker_policy: 'summary_ref_only_no_artifact_body',
    review_receipt_policy: 'receipt_ref_only_no_quality_or_readiness_verdict',
    action_receipt_policy: 'dry_run_plan_and_execute_receipt_refs_only_via_opl_app_action',
    workflow_ref_policy: 'capability_workflow_refs_only_no_app_skill_body_write',
    export_bundle_policy: 'framework_domain_action_ref_only_app_displays_dry_run_execute_receipt',
    temporal_policy: 'diagnostics_only_never_user_task_model',
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  validateSettingsCapabilitiesResourceGrouping(
    projection.settings_capabilities_surface,
    `${label} settings_capabilities_surface`,
  );
  validateResourceContextPolicy(projection.resource_context_policy, `${label} resource_context_policy`);
  assertIncludesAll(
    projection.forbidden_claims,
    [
      'new_task_dashboard',
      'shell_runtime_truth',
      'temporal_as_user_task_model',
      'artifact_body',
      'owner_receipt_authority',
      'domain_quality_verdict',
      'domain_readiness',
      'app_release_readiness',
      'family_production_readiness',
    ],
    `${label} forbidden_claims`,
  );
}

export function validateResourceContextPolicy(policy, label) {
  if (!policy || typeof policy !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  assertIncludesAll(policy.optional_ref_fields, resourceContextOptionalTaskRefs, `${label} optional_ref_fields`);
  assertDeepEqualJson(
    policy.plan_approve_execute_collect_flow,
    [
      'resource_plan_ref',
      'resource_approval_ref',
      'resource_execute_ref',
      'resource_monitor_ref',
      'resource_collect_ref',
      'resource_receipt_ref',
    ],
    `${label} plan approve execute collect flow`,
  );
  assertDeepEqualJson(
    policy.console_management_ref_fields,
    ['console_policy_ref', 'quota_ref', 'billing_ref', 'permission_ref'],
    `${label} console management ref fields`,
  );
  assertDeepEqualJson(
    policy.environment_catalog_policy?.ref_fields,
    ['environment_ref', 'environment_template_ref', 'environment_version_ref', 'environment_source_ref', 'environment_task_refs'],
    `${label} environment catalog ref fields`,
  );
  if (
    policy.environment_catalog_policy?.environment_body_access !== false ||
    policy.environment_catalog_policy?.package_lock_body_access !== false
  ) {
    throw new Error(`${label} environment catalog must remain refs-only`);
  }
}

export function validateSettingsCapabilitiesResourceGrouping(surface, label) {
  if (!surface || typeof surface !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    surface: 'settings_capabilities',
    source: 'same_task_awareness_projection_refs_aggregated_for_capabilities',
    display_policy: 'capability_health_connector_workflow_and_export_refs_only_no_skill_body_no_domain_verdict',
    action_policy: 'export_bundle_action_ref_may_open_app_action_dry_run_receipt_only_until_domain_owner_execute_exists',
  })) {
    if (surface[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    surface.required_ref_fields,
    [
      'capability_health_refs',
      'connector_readiness_refs',
      'workflow_refs',
      'export_bundle_action_ref',
      'resource_source_refs',
      'gateway_status_ref',
      'environment_ref',
      'environment_template_ref',
      'environment_version_ref',
      'environment_source_ref',
      'environment_task_refs',
      'console_policy_ref',
      'storage_ref',
      'resource_receipt_ref',
      'cost_estimate_ref',
    ],
    `${label} required_ref_fields`,
  );
  if (surface.resource_grouping_policy?.grouping_source !== 'OPL Connect/Fabric resource refs') {
    throw new Error(`${label} resource grouping must use OPL Connect/Fabric resource refs`);
  }
  assertIncludesAll(
    surface.resource_grouping_policy?.allowed_groups,
    ['OPL Connect', 'Fabric resources'],
    `${label} resource grouping allowed groups`,
  );
  for (const [field, expected] of Object.entries({
    refs_only: true,
    skill_body_access: false,
    workflow_body_access: false,
    artifact_body_access: false,
    owner_receipt_write_access: false,
    domain_verdict_authority: false,
  })) {
    if (surface[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
}

export function validateProgressDeltaDisplayContract(progressDelta, label) {
  if (!progressDelta || typeof progressDelta !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.task_drilldowns.progress_delta_classification',
    authority: 'opl_framework_shared_progress_projection',
    display_policy: 'classification_only_no_domain_artifact_body',
    platform_repair_display_treatment: 'separate_infrastructure_repair_not_deliverable_progress',
  })) {
    if (progressDelta[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    progressDelta.required_fields,
    ['deliverable_progress_delta', 'platform_repair_delta', 'progress_delta_classification'],
    `${label} required_fields`,
  );
  if (progressDelta.forbidden_delivery_claim_for_platform_repair !== true) {
    throw new Error(`${label} must forbid platform repair from being shown as deliverable progress`);
  }
}

export function validateProviderReadinessRepairProjectionContract(projection, label, options = {}) {
  if (!projection || typeof projection !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.provider + app_state.actions + app_state.operator.default_read_surface_policy',
    authority: 'opl_framework_provider_readiness_refs_projection',
    display_policy: 'provider_readiness_repair_secondary_without_current_owner_delta_override',
    provider_kind: 'temporal',
    current_owner_delta_policy: 'never_replace_default_operator_payload_or_owner_delta_show_as_provider_readiness_repair_only',
    app_role: 'display_only_provider_repair_path_consumer',
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  if (options.requireProjectionRef && projection.projection_ref !== 'contracts/app-runtime-bridge.json#provider_readiness_repair_projection') {
    throw new Error(`${label} projection_ref must point at app-runtime-bridge provider readiness repair projection`);
  }
  if (projection.domain_readiness_authority !== false) {
    throw new Error(`${label} domain_readiness_authority must be false`);
  }
  if (projection.provider_readiness_authority !== false) {
    throw new Error(`${label} provider_readiness_authority must be false`);
  }
  const cases = projection.repair_cases ?? [];
  const workerNotReady = cases.find((repairCase) => repairCase?.blocker === 'worker_not_ready');
  if (!workerNotReady) {
    throw new Error(`${label} must declare worker_not_ready repair case`);
  }
  for (const [field, expected] of Object.entries({
    source_status: 'temporal_worker_readiness.readiness_status=worker_not_ready',
    display_state: 'provider_worker_not_ready',
    next_repair_command: 'opl family-runtime worker start --provider temporal',
    safe_action_id: 'provider_worker_start',
    runtime_action_id: 'provider-worker:temporal:start',
    command_role: 'provider_liveness_repair_only',
  })) {
    if (workerNotReady[field] !== expected) {
      throw new Error(`${label} worker_not_ready.${field} must be ${expected}`);
    }
  }
  const searchAttributesMissing = cases.find((repairCase) => repairCase?.blocker === 'missing_search_attributes');
  if (!searchAttributesMissing) {
    throw new Error(`${label} must declare missing_search_attributes repair case`);
  }
  for (const [field, expected] of Object.entries({
    source_status: 'temporal_visibility_readiness.readiness_status=missing_search_attributes',
    display_state: 'temporal_search_attributes_missing',
    next_repair_command: 'opl family-runtime provider repair --provider temporal',
    command_role: 'provider_visibility_repair_only',
  })) {
    if (searchAttributesMissing[field] !== expected) {
      throw new Error(`${label} missing_search_attributes.${field} must be ${expected}`);
    }
  }
  if (searchAttributesMissing.safe_action_id !== null || searchAttributesMissing.runtime_action_id !== null) {
    throw new Error(`${label} missing_search_attributes must be surfaced as a repair command, not a shell-owned safe action`);
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      'domain_ready',
      'domain_readiness',
      'owner_receipt_authority',
      'typed_blocker_authority',
      'current_owner_delta_override',
      'app_release_readiness',
      'family_production_readiness',
    ],
    `${label} forbidden_claims`,
  );
}

export function validateStateIndexSidecarProjectionContract(projection, label) {
  if (!projection || typeof projection !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.task_drilldowns.state_index_sidecar_projection',
    detail_source: 'opl runtime app-operator-drilldown --task <task_id> --json',
    authority: 'opl_framework_state_index_kernel_sqlite_sidecar_projection',
    kernel_owner: 'one-person-lab',
    storage_kind: 'sqlite_sidecar_read_model_cache',
    app_access_mode: 'read_only_projection_consumer',
    display_policy: 'state_index_refs_only_no_sqlite_write_no_domain_truth_claims',
    drilldown_target_policy: 'refs_drill_down_to_stage_folder_not_domain_body',
    app_role: 'display_only_state_index_read_model_consumer',
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.allowed_input_surfaces,
    [
      'opl app state --profile fast --json',
      'opl app state --profile full --json',
      'opl runtime app-operator-drilldown --task <task_id> --json',
    ],
    `${label} allowed_input_surfaces`,
  );
  assertDeepEqualJson(
    projection.required_ref_fields,
    ['state_index_ref', 'stage_folder_ref', 'task_ref', 'owner_ref', 'updated_at'],
    `${label} required_ref_fields`,
  );
  assertDeepEqualJson(
    projection.optional_ref_fields,
    [
      'artifact_index_refs',
      'receipt_index_refs',
      'blocker_index_refs',
      'readiness_false_flag_refs',
      'cache_generation_ref',
    ],
    `${label} optional_ref_fields`,
  );
  for (const field of [
    'sqlite_direct_read_access',
    'sqlite_write_access',
    'sidecar_mutation_access',
    'domain_truth_write_access',
    'owner_receipt_write_access',
    'artifact_body_access',
    'readiness_authority',
    'artifact_authority',
    'quality_verdict_authority',
  ]) {
    if (projection[field] !== false) {
      throw new Error(`${label} ${field} must be false`);
    }
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      'sqlite_truth_owner',
      'sqlite_sidecar_writer',
      'state_index_kernel_owner',
      'domain_truth',
      'owner_receipt_authority',
      'artifact_body',
      'artifact_authority',
      'domain_readiness',
      'quality_verdict',
      'export_readiness',
      'app_release_readiness',
      'family_production_readiness',
    ],
    `${label} forbidden_claims`,
  );
}

export function validateStateIndexSidecarFixture(projection, label) {
  if (!projection || typeof projection !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  if (projection.surface_kind !== 'opl_state_index_kernel_sidecar_read_model') {
    throw new Error(`${label} surface_kind must be opl_state_index_kernel_sidecar_read_model`);
  }
  for (const field of ['state_index_ref', 'stage_folder_ref', 'task_ref', 'owner_ref', 'updated_at']) {
    if (!Object.hasOwn(projection, field)) {
      throw new Error(`${label} must include ${field}`);
    }
  }
  for (const field of [
    'artifact_index_refs',
    'receipt_index_refs',
    'blocker_index_refs',
    'readiness_false_flag_refs',
    'cache_generation_ref',
  ]) {
    if (!Object.hasOwn(projection, field)) {
      throw new Error(`${label} must include ${field} as refs or an empty refs list`);
    }
  }
  for (const field of [
    'sqlite_direct_read_access',
    'sqlite_write_access',
    'sidecar_mutation_access',
    'domain_truth_write_access',
    'owner_receipt_write_access',
    'artifact_body_access',
    'readiness_authority',
    'artifact_authority',
    'quality_verdict_authority',
  ]) {
    if (projection[field] !== false) {
      throw new Error(`${label} ${field} must be false`);
    }
  }
  for (const forbidden of [
    'sqlite_path',
    'sqlite_connection_string',
    'sqlite_write_query',
    'state_index_kernel_mutation',
    'domain_truth',
    'owner_receipt_body',
    'artifact_body',
    'domain_artifact_body',
    'domain_quality_verdict',
    'quality_verdict',
    'domain_export_readiness',
    'export_readiness',
    'domain_readiness',
    'domain_ready',
    'app_release_readiness',
    'production_readiness',
  ]) {
    if (Object.hasOwn(projection, forbidden)) {
      throw new Error(`${label} must not project ${forbidden}`);
    }
  }
}

export function validateArtifactNativeDrilldownProjectionContract(projection, label) {
  if (!projection || typeof projection !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.task_drilldowns.artifact_native_drilldown',
    detail_source: 'opl runtime app-operator-drilldown --task <task_id> --json',
    authority: 'opl_framework_stage_artifact_kernel_refs_projection',
    framework_contract_ref: 'one-person-lab/contracts/opl-framework/stage-artifact-runtime-contract.json',
    surface_kind: 'opl_stage_artifact_runtime_workbench',
    display_policy: 'artifact_kernel_refs_only_no_body_no_domain_readiness_claims',
    full_detail_policy: 'on_demand_task_drilldown_only',
    app_role: 'display_only_stage_artifact_kernel_refs_consumer',
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.required_ref_fields,
    [
      'current_pointer_ref',
      'canonical_artifact_refs',
      'export_artifact_refs',
      'lineage_refs',
      'retention_policy_ref',
      'conformance_summary_ref',
    ],
    `${label} required_ref_fields`,
  );
  assertDeepEqualJson(
    projection.optional_ref_fields,
    [
      'content_hash_refs',
      'attempt_manifest_refs',
      'owner_receipt_refs',
      'typed_blocker_refs',
      'decision_receipt_refs',
    ],
    `${label} optional_ref_fields`,
  );
  if (projection.artifact_body_access !== false) {
    throw new Error(`${label} artifact_body_access must be false`);
  }
  if (projection.domain_verdict_authority !== false) {
    throw new Error(`${label} domain_verdict_authority must be false`);
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      'artifact_body',
      'domain_artifact_body',
      'domain_artifact_authority',
      'domain_quality_verdict',
      'domain_export_readiness',
      'domain_readiness',
      'app_release_readiness',
      'family_production_readiness',
    ],
    `${label} forbidden_claims`,
  );
}

export function validateArtifactNativeDrilldownFixture(projection, label) {
  if (!projection || typeof projection !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  if (projection.surface_kind !== 'opl_stage_artifact_runtime_workbench') {
    throw new Error(`${label} surface_kind must be opl_stage_artifact_runtime_workbench`);
  }
  for (const field of [
    'current_pointer_ref',
    'canonical_artifact_refs',
    'export_artifact_refs',
    'lineage_refs',
    'retention_policy_ref',
    'conformance_summary_ref',
  ]) {
    if (!Object.hasOwn(projection, field)) {
      throw new Error(`${label} must include ${field}`);
    }
  }
  for (const field of [
    'content_hash_refs',
    'attempt_manifest_refs',
    'owner_receipt_refs',
    'typed_blocker_refs',
    'decision_receipt_refs',
  ]) {
    if (!Object.hasOwn(projection, field)) {
      throw new Error(`${label} must include ${field} as refs or an empty refs list`);
    }
  }
  if (projection.artifact_body_access !== false) {
    throw new Error(`${label} artifact_body_access must be false`);
  }
  if (projection.domain_verdict_authority !== false) {
    throw new Error(`${label} domain_verdict_authority must be false`);
  }
  for (const forbidden of [
    'artifact_body',
    'artifact_body_preview',
    'domain_artifact_body',
    'domain_quality_verdict',
    'quality_verdict',
    'domain_export_readiness',
    'export_readiness',
    'domain_readiness',
    'domain_ready',
    'app_release_readiness',
    'production_readiness',
  ]) {
    if (Object.hasOwn(projection, forbidden)) {
      throw new Error(`${label} must not project ${forbidden}`);
    }
  }
}

export function validateStageRunCockpitProjectionContract(projection, label) {
  if (!projection || typeof projection !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.task_drilldowns.stage_run_cockpit + app_state.operator.workbench.task_drilldowns.stage_run_cockpit_summary',
    equivalent_source: 'app_state.operator.workbench.task_drilldowns.stage_run_current_owner_delta',
    derived_from: 'current_owner_delta',
    authority: 'opl_framework_current_owner_delta_refs_projection',
    display_policy: 'refs_only_stage_run_cockpit_display_guard_no_runtime_truth_claims',
    app_role: 'display_only_stage_run_cockpit_consumer',
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.accepted_fast_state_fields,
    ['stage_run_cockpit', 'stage_run_cockpit_summary', 'stage_run_current_owner_delta'],
    `${label} accepted_fast_state_fields`,
  );
  assertIncludesAll(
    projection.required_ref_fields,
    ['task_id', 'stage_id', 'owner', 'next_visible_step', 'accepted_return_shapes', 'readiness_false_flag_refs'],
    `${label} required_ref_fields`,
  );
  assertIncludesAll(
    projection.summary_fields,
    ['current_owner', 'required_delta', 'next_safe_action_ref', 'artifact_or_blocker_refs'],
    `${label} summary_fields`,
  );
  if (projection.refs_only !== true) {
    throw new Error(`${label} refs_only must be true`);
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      'runtime_truth',
      'domain_truth',
      'owner_receipt_authority',
      'typed_blocker_authority',
      'artifact_authority',
      'domain_readiness',
      'app_release_readiness',
      'family_production_readiness',
    ],
    `${label} forbidden_claims`,
  );
}

export function validateStageRunCockpitFixture(task, label) {
  if (!task || typeof task !== 'object') {
    throw new Error(`${label} task must be declared`);
  }
  const cockpit = task.stage_run_cockpit ?? task.stage_run_current_owner_delta;
  if (!cockpit || typeof cockpit !== 'object') {
    throw new Error(`${label} must include stage_run_cockpit or stage_run_current_owner_delta`);
  }
  if (!task.stage_run_cockpit_summary || typeof task.stage_run_cockpit_summary !== 'object') {
    throw new Error(`${label} must include stage_run_cockpit_summary`);
  }
  if (cockpit.derived_from !== 'current_owner_delta') {
    throw new Error(`${label} must derive from current_owner_delta`);
  }
  for (const field of ['task_id', 'stage_id', 'owner', 'next_visible_step', 'accepted_return_shapes', 'readiness_false_flag_refs']) {
    if (!Object.hasOwn(cockpit, field)) {
      throw new Error(`${label} cockpit must include ${field}`);
    }
  }
  for (const field of ['current_owner', 'required_delta', 'next_safe_action_ref', 'artifact_or_blocker_refs']) {
    if (!Object.hasOwn(task.stage_run_cockpit_summary, field)) {
      throw new Error(`${label} summary must include ${field}`);
    }
  }
  if (cockpit.refs_only !== true) {
    throw new Error(`${label} cockpit refs_only must be true`);
  }
  for (const forbidden of [
    'runtime_truth',
    'domain_truth',
    'owner_receipt_body',
    'owner_receipt_authority',
    'typed_blocker_body',
    'typed_blocker_authority',
    'artifact_body',
    'artifact_authority',
    'domain_ready',
    'domain_readiness',
    'app_release_ready',
    'app_release_readiness',
    'production_ready',
    'production_readiness',
  ]) {
    if (Object.hasOwn(cockpit, forbidden) || Object.hasOwn(task.stage_run_cockpit_summary, forbidden)) {
      throw new Error(`${label} must not project ${forbidden}`);
    }
  }
}

export function validateActiveProjectLineProjectionContract(activeProjectLineProjection, label, options = {}) {
  if (!activeProjectLineProjection || typeof activeProjectLineProjection !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.activity_center.active_projects + app_state.operator.visual_ref_groups.active_project_refs',
    authority: 'opl_framework_refs_only_project_line_projection',
    display_policy: 'active_project_line_count_can_include_queued_or_escalated_owner_handled_lines_without_active_worker_run',
  })) {
    if (activeProjectLineProjection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  if (activeProjectLineProjection.status_preservation_required !== true) {
    throw new Error(`${label} must preserve status, active_run_id, and next_visible_step`);
  }
  assertDeepEqualJson(
    activeProjectLineProjection.project_group_expansion_policy,
    appOwnedProjectGroupExpansionPolicy,
    `${label} project_group_expansion_policy`,
  );
  if (options.requireFields !== false) {
    assertIncludesAll(
      activeProjectLineProjection.required_fields,
      ['task_id', 'title', 'state', 'status', 'study_id', 'active_run_id', 'next_visible_step'],
      `${label} required_fields`,
    );
  }
  assertIncludesAll(
    activeProjectLineProjection.must_not_claim,
    ['active_worker_run', 'provider_execution_running', 'domain_ready', 'paper_quality_ready'],
    `${label} must_not_claim`,
  );
}

export function validateProjectProgressDisplayContract(projectProgress, label) {
  if (!projectProgress || typeof projectProgress !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.task_drilldowns',
    authority: 'opl_framework_shared_project_progress_projection',
    display_policy: 'project_progress_refs_secondary_no_module_runtime_dirty_as_project',
    diagnostics_treatment: 'secondary_disclosure',
    safe_actions_treatment: 'secondary_operator_disclosure',
  })) {
    if (projectProgress[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    projectProgress.required_fields,
    [
      'task_id',
      'title',
      'domain_id',
      'state',
      'active_stage_id',
      'progress_delta_classification',
      'deliverable_progress_delta',
      'platform_repair_delta',
      'blocker_ref_count',
      'next_visible_step',
      'next_owner',
    ],
    `${label} required_fields`,
  );
  assertIncludesAll(
    projectProgress.optional_user_fields,
    ['domain_label', 'active_stage_label', 'next_visible_step', 'next_owner', 'last_progress_at'],
    `${label} optional_user_fields`,
  );
  assertIncludesAll(
    projectProgress.forbidden_running_task_sources,
    [
      'module_runtime dirty state',
      'domain lane active_task_count',
      'assistant purpose cards',
      'module readiness diagnostics',
    ],
    `${label} forbidden_running_task_sources`,
  );
  validateActiveProjectLineProjectionContract(
    projectProgress.active_project_line_projection,
    `${label} active project line projection`,
  );
}

export function validateUserTaskStatusProjectionContract(userTaskStatus, label) {
  if (!userTaskStatus || typeof userTaskStatus !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.summary_cards + app_state.operator.workbench.activity_center + app_state.operator.workbench.task_drilldowns + app_state.operator.visual_ref_groups.active_project_refs',
    authority: 'opl_framework_refs_only_user_task_projection',
    display_policy: 'user_task_status_first_provider_projection_diagnostic_only',
    default_user_question: "How many tasks are running, how many projects or tasks are active or queued, how many need attention, and what is each task's current step?",
    progress_label_policy: 'render framework progress classification and stage labels as human task progress labels without exposing raw projection or ledger names',
    diagnostic_source_policy: 'provider/projection/ref/ledger/current_control_state details stay secondary and are not the default page language',
  })) {
    if (userTaskStatus[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    userTaskStatus.summary_fields,
    ['running_task_count', 'active_project_count', 'queued_project_count', 'attention_count'],
    `${label} summary_fields`,
  );
  assertDeepEqualJson(
    userTaskStatus.task_fields,
    [
      'task_id',
      'title',
      'status',
      'stage',
      'progress_label',
      'next_step',
      'owner',
      'last_progress',
      'next_owner',
      'artifact_or_blocker',
      'review_receipt',
      'action_receipt',
      'workflow_refs',
      'export_bundle_action_ref',
      'gateway_status_ref',
      'resource_source_refs',
      'environment_ref',
      'storage_ref',
      'resource_receipt_ref',
      'cost_estimate_ref',
    ],
    `${label} task_fields`,
  );
  for (const [field, expected] of Object.entries({
    running_task_count: 'count user tasks projected as actively running or advancing, never raw provider attempts',
    active_project_count: 'count active user-visible project lines from the framework project-line projection',
    queued_project_count: 'count queued or waiting user-visible project/task lines without claiming active worker runs',
    attention_count: 'count user-visible blockers, human gates, failed safe actions, or owner attention states',
  })) {
    if (userTaskStatus.count_policies?.[field] !== expected) {
      throw new Error(`${label} count_policies.${field} must be ${expected}`);
    }
  }
  if (userTaskStatus.running_state_policy !== appOwnedRunningStatePolicy) {
    throw new Error(`${label} running_state_policy must be ${appOwnedRunningStatePolicy}`);
  }
  assertDeepEqualJson(
    userTaskStatus.must_not_default_display_terms,
    ['Temporal', 'provider', 'projection', 'ref', 'stage attempt', 'ledger', 'current_control_state'],
    `${label} must_not_default_display_terms`,
  );
  if (userTaskStatus.refs_only !== true) {
    throw new Error(`${label} must be refs-only`);
  }
}

export function validateBeginnerFirstRunPresentation(presentation, label) {
  if (presentation?.audience !== 'beginner_non_technical_users') {
    throw new Error(`${label} must target beginner_non_technical_users`);
  }
  if (presentation.presentation_mode !== 'simplified_first_run') {
    throw new Error(`${label} must use simplified_first_run presentation`);
  }
  if (presentation.primary_user_goal !== 'reach_guid_with_codex_ready') {
    throw new Error(`${label} must focus on reaching /guid with Codex ready`);
  }
  assertIncludesAll(presentation.primary_steps, firstRunCoreItems, `${label} primary steps`);
  for (const [field, expected] of Object.entries({
    advanced_progress_disclosure: 'collapsed_or_secondary',
    background_maintenance_presentation: 'collapsed_technical_non_blocking',
    technical_detail_policy: 'hidden_until_expanded_or_error',
  })) {
    if (presentation[field] !== expected) {
      throw new Error(`${label}.${field} must be ${expected}`);
    }
  }
  const selfCheck = presentation.post_install_ai_self_check_entry;
  if (!selfCheck || typeof selfCheck !== 'object') {
    throw new Error(`${label} must define post_install_ai_self_check_entry`);
  }
  for (const [field, expected] of Object.entries({
    target_route: '/guid',
    route_state: 'postInstallSelfCheck',
    prompt_policy: 'localized Codex CLI post-install self-check prompt describing target OPL working mode and repair path',
    mutation_policy: 'diagnose_first_no_file_mutation_without_user_confirmation',
    release_gate_policy: 'user_visible_entry_complements_non_blocking_codex_ai_self_check_receipt',
  })) {
    if (selfCheck[field] !== expected) {
      throw new Error(`${label}.post_install_ai_self_check_entry.${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    selfCheck.target_state_checks,
    [
      'codex_cli_callable',
      'ui_language_policy',
      'session_scoped_opl_flow_context',
      'user_agents_md_respected_no_overwrite',
      'mas_mag_rca_routes_visible',
      'opl_meta_agent_capability_visible',
      'codex_skills_plugins_visible',
      'module_update_skill_plugin_continuity',
    ],
    `${label}.post_install_ai_self_check_entry target_state_checks`,
  );
}

export function validateOplFlowContext(context, label) {
  if (!context || typeof context !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    flow_id: 'opl-flow',
    delivery: 'session_scoped_preset_context',
    user_agents_policy: 'respect_user_agents_no_overwrite_detect_conflicts',
    language_policy: 'follow_ui_locale_zh_only_when_ui_zh',
  })) {
    if (context[field] !== expected) {
      throw new Error(`${label}.${field} must be ${expected}`);
    }
  }
}
