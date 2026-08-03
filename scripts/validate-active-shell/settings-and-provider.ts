import { assertDeepEqualJson, assertIncludesAll } from "./assertions.ts";
import {
  appOwnedAgentModuleStatusPanel,
  appOwnedGenericOwnerAcceptanceCurrentnessRefPolicy,
  appOwnedPrimaryGroupingPolicy,
  appOwnedProjectGroupExpansionPolicy,
  appOwnedQueueStatusPolicy,
  appOwnedRuntimeMentalModel,
  appOwnedRunningStatePolicy,
  runtimeAutomationStateValues,
  runtimePrimaryStateValues,
  retiredMasOwnerAcceptanceMirrorFields,
  runtimeScopeRequiredFields,
  actionEnvelopeKinds,
  actionOwnerKinds,
  domainDetailViewAvailabilityValues,
  domainDetailViewDescriptorFields,
  domainDetailViewDescriptorOptionalFields,
  domainDetailViewReadAvailabilityValues,
  systemAttentionResponsibilityFields,
  taskRunProjectionV2FieldGroups,
  taskRunProjectionV2RequiredFields,
  tokenObservationObservedFields,
  tokenObservationStates,
  workItemConditionFields,
  workItemDetailPrimarySections,
  runtimeWorkItemDetailSecondarySections,
  workItemPrimaryStateLabelsByLocale,
  workItemBusinessStates,
  workItemProjectionFieldContracts,
  workItemProjectionRequiredFields,
  workItemVisibilityStates,
} from "./app-contract-constants.ts";

import {
  assertFirstRunProgressModelMatches,
  assertFirstRunProgressModelShape,
  assertNoForbiddenKeys,
  assertNonEmptyString,
  assertNonEmptyStringArray,
  assertSharedFirstRunProgressModelMatches,
  resourceContextOptionalTaskRefs,
} from "./validation-primitives.ts";

export function validateSettingsCapabilitiesTaskAwarenessSurface(surface, label) {
  if (!surface || typeof surface !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    surface: "settings_capabilities",
    source: "same_task_awareness_projection_capability_and_workflow_refs_only",
    display_policy:
      "capability_health_workflow_and_candidate_refs_only_no_agent_package_gateway_or_resource_fields",
    action_policy:
      "export_bundle_action_ref_may_open_app_action_dry_run_receipt_only_until_domain_owner_execute_exists",
  })) {
    if (surface[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    surface.required_ref_fields,
    [
      "capability_health_refs",
      "workflow_refs",
      "export_bundle_action_ref",
      "candidate_report_refs",
      "workflow_skill_candidate_refs",
    ],
    `${label} required_ref_fields`,
  );
  if (
    surface.candidate_policy !==
    "report_first_candidate_refs_review_needs_changes_continue_in_conversation_no_auto_enable_no_skill_body_write"
  ) {
    throw new Error(`${label} must keep workflow/skill candidates report-first and no-auto-enable`);
  }
  for (const forbiddenField of [
    "connector_readiness_refs",
    "resource_source_refs",
    "gateway_status_ref",
    "environment_ref",
    "storage_ref",
    "resource_receipt_ref",
    "cost_estimate_ref",
  ]) {
    if (surface.required_ref_fields?.includes(forbiddenField)) {
      throw new Error(`${label} must not own Gateway or Resources field ${forbiddenField}`);
    }
  }
  if ("resource_grouping_policy" in surface || "connector_grouping_policy" in surface) {
    throw new Error(`${label} must not aggregate Gateway, connector, or Fabric resource groups`);
  }
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

export function validateStructuredResultPanelProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: "app_state.operator.workbench.task_run_projection_v2.tasks[].structured_result_panel",
    authority: "opl_framework_refs_only_structured_result_projection",
    projection_kind: "structured_result_panel_projection",
    surface_kind: "structured_result_panel",
    display_policy: "conversation_current_task_right_inspector_panel_no_new_dashboard",
    panel_policy:
      "structured_result_panel_inside_existing_conversation_current_task_and_right_inspector_surfaces",
    content_policy: "refs_only_no_artifact_body_no_domain_verdict",
    app_role: "display_only_structured_result_panel_consumer",
    shell_role: "thin_renderer_existing_task_surfaces_only",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.surfaces,
    ["ordinary_conversation", "current_task_slice", "right_context_inspector"],
    `${label} surfaces`,
  );
  assertIncludesAll(
    projection.required_ref_fields,
    [
      "result_summary_ref",
      "status_ref",
      "evidence_card_refs",
      "action_card_refs",
      "artifact_provenance_ref",
      "follow_up_refs",
    ],
    `${label} required_ref_fields`,
  );
  for (const [field, expected] of Object.entries({
    new_dashboard_allowed: false,
    refs_only: true,
    artifact_body_access: false,
    domain_verdict_authority: false,
    quality_verdict_authority: false,
    readiness_authority: false,
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      "new_dashboard",
      "artifact_body",
      "domain_quality_verdict",
      "domain_readiness",
      "owner_receipt_authority",
    ],
    `${label} forbidden_claims`,
  );
}

export function validateRefLevelFollowUpProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: "app_state.operator.workbench.task_run_projection_v2.tasks[].ref_level_follow_up_refs",
    authority: "opl_framework_refs_only_ref_level_follow_up_projection",
    projection_kind: "ref_level_follow_up_projection",
    surface_kind: "ref_level_comment_and_follow_up_refs",
    display_policy:
      "review_request_change_follow_up_prompt_action_refs_only_no_app_annotation_store",
    app_role: "display_only_ref_level_follow_up_refs_consumer",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    projection.surfaces,
    [
      "right_context_inspector.review",
      "right_context_inspector.actions",
      "ordinary_conversation.current_task_slice",
    ],
    `${label} surfaces`,
  );
  assertDeepEqualJson(
    projection.action_kinds,
    ["review", "request_change", "follow_up_prompt"],
    `${label} action_kinds`,
  );
  assertIncludesAll(
    projection.required_ref_fields,
    [
      "target_ref",
      "source_ref",
      "comment_ref",
      "prompt_ref",
      "action_ref",
      "owner",
      "content_policy",
    ],
    `${label} required_ref_fields`,
  );
  for (const [field, expected] of Object.entries({
    app_annotation_store_allowed: false,
    refs_only: true,
    artifact_body_access: false,
    app_annotation_store_write: false,
    owner_receipt_write_access: false,
    domain_verdict_authority: false,
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      "app_annotation_store",
      "artifact_body",
      "review_body",
      "owner_receipt_authority",
      "domain_quality_verdict",
    ],
    `${label} forbidden_claims`,
  );
}

export function validateWorkflowSkillCandidateProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source:
      "app_state.operator.workbench.task_run_projection_v2.tasks[].workflow_skill_candidate_refs",
    authority: "opl_framework_refs_only_workflow_skill_candidate_projection",
    projection_kind: "workflow_skill_candidate_projection",
    surface_kind: "workflow_skill_candidate_report_first_refs",
    display_policy:
      "settings_capabilities_report_first_candidate_refs_review_needs_changes_continue_in_conversation_no_auto_enable",
    surface: "settings_capabilities",
    professional_agent_boundary:
      "professional_agents_are_codex_plugins_or_packaged_codex_skill_surfaces",
    app_role: "display_only_workflow_skill_candidate_refs_consumer",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    projection.required_ref_fields,
    [
      "candidate_ref",
      "source_report_ref",
      "candidate_kind",
      "status",
      "available_actions",
      "content_policy",
    ],
    `${label} required_ref_fields`,
  );
  assertDeepEqualJson(
    projection.allowed_actions,
    ["review", "needs_changes", "continue_in_conversation"],
    `${label} allowed_actions`,
  );
  for (const [field, expected] of Object.entries({
    report_first: true,
    auto_enable_allowed: false,
    refs_only: true,
    skill_body_access: false,
    skill_body_write_access: false,
    workflow_body_access: false,
    runtime_truth_write_access: false,
    domain_verdict_authority: false,
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      "auto_enable_skill",
      "skill_body_write",
      "workflow_body_write",
      "second_skill_truth",
      "runtime_truth",
    ],
    `${label} forbidden_claims`,
  );
}

export function validateProgressDeltaDisplayContract(progressDelta, label) {
  if (!progressDelta || typeof progressDelta !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: "app_state.operator.workbench.task_drilldowns.progress_delta_classification",
    authority: "opl_framework_shared_progress_projection",
    display_policy: "classification_only_no_domain_artifact_body",
    consumer_surface: "/settings/environment?section=diagnostics",
    runtime_page_visible: false,
    platform_repair_display_treatment: "separate_infrastructure_repair_not_deliverable_progress",
    platform_repair_owner_surface: "/settings/environment?section=services",
  })) {
    if (progressDelta[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    progressDelta.required_fields,
    ["deliverable_progress_delta", "platform_repair_delta", "progress_delta_classification"],
    `${label} required_fields`,
  );
  if (progressDelta.forbidden_delivery_claim_for_platform_repair !== true) {
    throw new Error(
      `${label} must forbid platform repair from being shown as deliverable progress`,
    );
  }
}

export function validateProviderReadinessRepairProjectionContract(projection, label, options = {}) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source:
      "app_state.provider + app_state.actions + app_state.operator.default_read_surface_policy",
    authority: "opl_framework_provider_readiness_refs_projection",
    display_policy: "settings_environment_provider_readiness_repair_without_current_owner_delta_override",
    settings_owner_surface: "/settings/environment?section=services",
    consumer_surface: "/settings/environment?section=services",
    runtime_page_visible: false,
    provider_kind: "temporal",
    current_owner_delta_policy:
      "never_replace_default_operator_payload_or_owner_delta_show_as_provider_readiness_repair_only",
    app_role: "display_only_provider_repair_path_consumer",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  if (
    options.requireProjectionRef &&
    projection.projection_ref !==
      "contracts/app-runtime-bridge.json#provider_readiness_repair_projection"
  ) {
    throw new Error(
      `${label} projection_ref must point at app-runtime-bridge provider readiness repair projection`,
    );
  }
  if (projection.domain_readiness_authority !== false) {
    throw new Error(`${label} domain_readiness_authority must be false`);
  }
  if (projection.provider_readiness_authority !== false) {
    throw new Error(`${label} provider_readiness_authority must be false`);
  }
  const cases = projection.repair_cases ?? [];
  const serviceSupervisorNotReady = cases.find(
    (repairCase) => repairCase?.blocker === "service_supervisor_not_ready",
  );
  if (!serviceSupervisorNotReady) {
    throw new Error(`${label} must declare service_supervisor_not_ready repair case`);
  }
  for (const [field, expected] of Object.entries({
    source_status:
      "app_state.provider.temporal.details.worker_readiness.temporal_service_lifecycle.supervisor.ready=false_or_error",
    display_state: "temporal_service_supervisor_not_ready",
    next_repair_command_source:
      "app_state.provider.temporal.details.worker_readiness.temporal_service_lifecycle.repair_action.next_command",
    safe_action_id: "provider_service_start",
    runtime_action_id: null,
    command_role: "provider_server_restart_self_healing_repair_only",
  })) {
    if (serviceSupervisorNotReady[field] !== expected) {
      throw new Error(`${label} service_supervisor_not_ready.${field} must be ${expected}`);
    }
  }
  const workerNotReady = cases.find((repairCase) => repairCase?.blocker === "worker_not_ready");
  if (!workerNotReady) {
    throw new Error(`${label} must declare worker_not_ready repair case`);
  }
  for (const [field, expected] of Object.entries({
    source_status: "temporal_worker_readiness.readiness_status=worker_not_ready",
    display_state: "provider_worker_not_ready",
    next_repair_command: "opl family-runtime worker start --provider temporal",
    safe_action_id: "provider_worker_start",
    runtime_action_id: "provider-worker:temporal:start",
    command_role: "provider_liveness_repair_only",
  })) {
    if (workerNotReady[field] !== expected) {
      throw new Error(`${label} worker_not_ready.${field} must be ${expected}`);
    }
  }
  const searchAttributesMissing = cases.find(
    (repairCase) => repairCase?.blocker === "missing_search_attributes",
  );
  if (!searchAttributesMissing) {
    throw new Error(`${label} must declare missing_search_attributes repair case`);
  }
  for (const [field, expected] of Object.entries({
    source_status: "temporal_visibility_readiness.readiness_status=missing_search_attributes",
    display_state: "temporal_search_attributes_missing",
    next_repair_command: "opl family-runtime provider repair --provider temporal",
    command_role: "provider_visibility_repair_only",
  })) {
    if (searchAttributesMissing[field] !== expected) {
      throw new Error(`${label} missing_search_attributes.${field} must be ${expected}`);
    }
  }
  if (
    searchAttributesMissing.safe_action_id !== null ||
    searchAttributesMissing.runtime_action_id !== null
  ) {
    throw new Error(
      `${label} missing_search_attributes must be surfaced as a repair command, not a shell-owned safe action`,
    );
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      "domain_ready",
      "domain_readiness",
      "owner_receipt_authority",
      "typed_blocker_authority",
      "current_owner_delta_override",
      "app_release_readiness",
      "family_production_readiness",
    ],
    `${label} forbidden_claims`,
  );
}
