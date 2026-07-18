import { assertDeepEqualJson, assertIncludesAll } from "./assertions.ts";
import {
  appOwnedAgentModuleStatusPanel,
  appOwnedPrimaryGroupingPolicy,
  appOwnedProjectGroupExpansionPolicy,
  appOwnedQueueStatusPolicy,
  appOwnedRuntimeMentalModel,
  appOwnedRunningStatePolicy,
  runtimeAutomationStateValues,
  runtimeFirstPartyAgents,
  runtimePrimaryStateValues,
  runtimeScopeRequiredFields,
  actionEnvelopeKinds,
  actionOwnerKinds,
  domainDetailViewAvailabilityValues,
  domainDetailViewDescriptorFields,
  domainDetailViewDescriptorOptionalFields,
  domainDetailViewReadAvailabilityValues,
  scientificReasoningEdgeKinds,
  scientificReasoningCompatibleSchemaVersions,
  scientificReasoningCurrentBranchMembershipBySchema,
  scientificReasoningMedicalProsePolicy,
  scientificReasoningNodeKinds,
  scientificReasoningNodeStatuses,
  scientificReasoningSnapshotFieldsBySchema,
  scientificReasoningSummaryFields,
  scientificReasoningV2SnapshotFields,
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
function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function assertNonEmptyStringArray(value, label) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new Error(`${label} must be a non-empty string array`);
  }
  return value;
}

export function assertFirstRunProgressModelShape(progressModel, label) {
  if (!progressModel || typeof progressModel !== "object") {
    throw new Error(`${label} must declare a progress model`);
  }
  assertNonEmptyString(progressModel.source_command, `${label} source_command`);
  assertNonEmptyString(progressModel.source_path, `${label} source_path`);
  assertNonEmptyString(progressModel.renderer_truth_policy, `${label} renderer_truth_policy`);
  assertNonEmptyStringArray(
    progressModel.required_setup_flow_fields,
    `${label} required_setup_flow_fields`,
  );
  assertNonEmptyStringArray(
    progressModel.required_progress_fields,
    `${label} required_progress_fields`,
  );
  assertNonEmptyStringArray(
    progressModel.required_checklist_fields,
    `${label} required_checklist_fields`,
  );
  assertNonEmptyStringArray(
    progressModel.required_visible_elements,
    `${label} required_visible_elements`,
  );
}

export function assertFirstRunProgressModelMatches(actual, expected, label) {
  assertFirstRunProgressModelShape(expected, `${label} expected model`);
  if (actual?.source_command !== expected.source_command) {
    throw new Error(`${label} progress model must use ${expected.source_command}`);
  }
  if (actual?.source_path !== expected.source_path) {
    throw new Error(`${label} progress model must read ${expected.source_path}`);
  }
  if (actual?.renderer_truth_policy !== expected.renderer_truth_policy) {
    throw new Error(`${label} progress model must keep renderers as display-only consumers`);
  }
  assertIncludesAll(
    actual?.required_setup_flow_fields,
    expected.required_setup_flow_fields,
    `${label} progress setup_flow fields`,
  );
  assertIncludesAll(
    actual?.required_progress_fields,
    expected.required_progress_fields,
    `${label} progress fields`,
  );
  assertIncludesAll(
    actual?.required_checklist_fields,
    expected.required_checklist_fields,
    `${label} progress checklist fields`,
  );
  assertIncludesAll(
    actual?.required_visible_elements,
    expected.required_visible_elements,
    `${label} progress visible elements`,
  );
}

export function assertSharedFirstRunProgressModelMatches(actual, expected, label) {
  assertFirstRunProgressModelShape(expected, `${label} expected model`);
  if (actual?.source_command !== expected.source_command) {
    throw new Error(`${label} shared progress model must use ${expected.source_command}`);
  }
  if (actual?.source_path !== expected.source_path) {
    throw new Error(`${label} shared progress model must read ${expected.source_path}`);
  }
  assertIncludesAll(
    actual?.required_setup_flow_fields,
    expected.required_setup_flow_fields,
    `${label} shared progress setup_flow fields`,
  );
  assertIncludesAll(
    actual?.required_progress_fields,
    expected.required_progress_fields,
    `${label} shared progress fields`,
  );
  assertIncludesAll(
    actual?.required_checklist_fields,
    expected.required_checklist_fields,
    `${label} shared progress checklist fields`,
  );
}

const resourceContextOptionalTaskRefs = [
  "resource_source_refs",
  "gateway_status_ref",
  "environment_ref",
  "storage_ref",
  "resource_plan_ref",
  "resource_approval_ref",
  "resource_execute_ref",
  "resource_monitor_ref",
  "resource_collect_ref",
  "resource_usage_ref",
  "console_policy_ref",
  "quota_ref",
  "billing_ref",
  "permission_ref",
  "environment_template_ref",
  "environment_version_ref",
  "environment_source_ref",
  "environment_task_refs",
  "resource_receipt_ref",
  "cost_estimate_ref",
];

function assertNoForbiddenKeys(value, forbiddenKeys, label, objectPath = label) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoForbiddenKeys(item, forbiddenKeys, label, `${objectPath}[${index}]`),
    );
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenKeys.includes(key)) {
      throw new Error(`${label} must not project ${key} at ${objectPath}.${key}`);
    }
    assertNoForbiddenKeys(nested, forbiddenKeys, label, `${objectPath}.${key}`);
  }
}

export function validateTaskAwarenessProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: "app_state.operator.workbench.task_drilldowns",
    authority: "opl_framework_refs_only_task_awareness_projection",
    display_policy: "conversation_and_inspector_task_awareness_refs_no_runtime_dashboard",
    global_surface: "none_runtime_uses_work_item_projection_v2",
    app_role: "display_only_task_awareness_consumer",
    shell_role: "thin_renderer_no_runtime_store",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.current_task_surfaces,
    ["ordinary_conversation", "right_context_inspector"],
    `${label} current_task_surfaces`,
  );
  validateTaskRunProjectionV2Contract(projection, label);
  assertIncludesAll(
    projection.required_task_ref_fields,
    taskRunProjectionV2RequiredFields,
    `${label} required_task_ref_fields`,
  );
  assertIncludesAll(
    projection.optional_task_ref_fields,
    [
      "capability_health_refs",
      "workflow_refs",
      "export_bundle_action_ref",
      "connector_readiness_refs",
      "openscience_console_projection_ref",
      "diagnostic_substrate_refs",
      "structured_result_panel",
      "artifact_provenance_card",
      "ref_level_follow_up_refs",
      "workflow_skill_candidate_refs",
      ...resourceContextOptionalTaskRefs,
    ],
    `${label} optional_task_ref_fields`,
  );
  for (const [field, expected] of Object.entries({
    artifact_or_blocker_policy: "summary_ref_only_no_artifact_body",
    review_receipt_policy: "receipt_ref_only_no_quality_or_readiness_verdict",
    action_receipt_policy: "dry_run_plan_and_execute_receipt_refs_only_via_opl_app_action",
    workflow_ref_policy: "capability_workflow_refs_only_no_app_skill_body_write",
    export_bundle_policy: "framework_domain_action_ref_only_app_displays_dry_run_execute_receipt",
    temporal_policy: "diagnostics_only_never_user_task_model",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  validateSettingsCapabilitiesTaskAwarenessSurface(
    projection.settings_capabilities_surface,
    `${label} settings_capabilities_surface`,
  );
  if (projection.resource_context_policy) {
    validateResourceContextPolicy(
      projection.resource_context_policy,
      `${label} resource_context_policy`,
    );
  } else if (
    projection.resource_context_policy_ref !==
    "contracts/app-runtime-bridge.json#task_awareness_projection.resource_context_policy"
  ) {
    throw new Error(`${label} must declare resource_context_policy or resource_context_policy_ref`);
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      "new_task_dashboard",
      "shell_runtime_truth",
      "temporal_as_user_task_model",
      "artifact_body",
      "owner_receipt_authority",
      "domain_quality_verdict",
      "domain_readiness",
      "app_release_readiness",
      "family_production_readiness",
    ],
    `${label} forbidden_claims`,
  );
}

export function validateRuntimeScopeProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: "app_state.operator.workbench.runtime_scope",
    authority: "opl_framework_runtime_scope_projection",
    display_policy:
      "two_level_agent_then_project_cascade_work_items_stay_in_list",
    default_scope_identity_policy:
      "project_scope_uses_canonical_project_registry_for_selected_agent",
    user_facing_state_policy:
      "primary_state_is_framework_projected_from_work_item_v2_axes_shell_never_derives_it",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.required_fields,
    runtimeScopeRequiredFields,
    `${label} required_fields`,
  );
  assertDeepEqualJson(
    projection.default_scope_levels,
    ["agent", "project"],
    `${label} default_scope_levels`,
  );
  assertDeepEqualJson(
    projection.agent_scope?.first_party_options,
    runtimeFirstPartyAgents,
    `${label} agent_scope.first_party_options`,
  );
  if (
    projection.agent_scope?.all_option !== "all_agents" ||
    projection.agent_scope?.full_display_names_required !== true ||
    projection.project_scope?.all_option !== "all_projects" ||
    projection.project_scope?.source !== "canonical_project_registry_for_selected_agent" ||
    projection.project_scope?.display_name_source !== "canonical_workspace_path_basename" ||
    projection.project_scope?.display_name_must_equal_workspace_path_basename !== true ||
    projection.project_scope?.work_item_options_allowed !== false ||
    projection.work_item_scope_allowed !== false ||
    projection.visibility_axis_outside_scope !== true ||
    projection.archived_library_reuses_agent_project_scope !== true
  ) {
    throw new Error(`${label} must use Agent -> Project basename scope and keep work items and visibility out of scope`);
  }
  if (
    projection.saved_views?.dimension !== "primary_state_only" ||
    projection.saved_views?.agent_or_project_views_allowed !== false ||
    projection.saved_views?.visibility_views_allowed !== false ||
    projection.saved_views?.forbidden_ids?.some((value) =>
      ["mas", "med-autoscience", "med_auto_science"].includes(value)
    ) !== true
  ) {
    throw new Error(`${label} saved views must be status-only and explicitly forbid MAS views`);
  }
  assertDeepEqualJson(
    projection.scope_source_values,
    ["default_global", "user_selected", "inferred"],
    `${label} scope_source_values`,
  );
}

export function validateWorkItemRowIdentityFixture(
  items,
  label,
  { requireCrossProjectLocalIdCollision = false } = {},
) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`${label} must include work-item rows`);
  }
  const itemIds = new Set();
  const mutationTuples = new Set();
  const projectsByLocalWorkItemId = new Map();
  for (const [index, item] of items.entries()) {
    const itemLabel = `${label}[${index}]`;
    assertNonEmptyString(item?.item_id, `${itemLabel}.item_id`);
    assertNonEmptyString(item?.identity?.agent_id, `${itemLabel}.identity.agent_id`);
    assertNonEmptyString(item?.identity?.project_id, `${itemLabel}.identity.project_id`);
    assertNonEmptyString(item?.identity?.work_item_id, `${itemLabel}.identity.work_item_id`);
    if (itemIds.has(item.item_id)) {
      throw new Error(`${label} item_id must be globally unique`);
    }
    itemIds.add(item.item_id);
    const mutationTuple = [
      item.identity.agent_id,
      item.identity.project_id,
      item.identity.work_item_id,
    ].join("\u0000");
    if (mutationTuples.has(mutationTuple)) {
      throw new Error(`${label} mutation identity tuple must be unique`);
    }
    mutationTuples.add(mutationTuple);
    const projectIds = projectsByLocalWorkItemId.get(item.identity.work_item_id) ?? new Set();
    projectIds.add(item.identity.project_id);
    projectsByLocalWorkItemId.set(item.identity.work_item_id, projectIds);
  }
  if (
    requireCrossProjectLocalIdCollision
    && ![...projectsByLocalWorkItemId.values()].some((projectIds) => projectIds.size > 1)
  ) {
    throw new Error(`${label} must exercise a project-local work_item_id collision`);
  }
}

export function validateWorkItemProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    surface_kind: "opl_work_item_projection",
    schema_version: "work-item-projection.v2",
    authority: "one_person_lab_canonical_work_item_projection",
    display_policy: "canonical_work_item_axes_default_decision_fields_diagnostics_on_demand",
    app_role: "display_only_work_item_projection_consumer",
    shell_role: "thin_renderer_no_projection_inference",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.model_chain,
    ["Agent", "Project", "Work Item", "Visibility", "Stage", "Action", "Evidence"],
    `${label} model_chain`,
  );
  assertDeepEqualJson(
    projection.required_fields,
    workItemProjectionRequiredFields,
    `${label} required_fields`,
  );
  for (const [field, requiredFields] of Object.entries(workItemProjectionFieldContracts)) {
    assertDeepEqualJson(
      projection.field_contracts?.[field]?.required_fields,
      requiredFields,
      `${label} field_contracts.${field}.required_fields`,
    );
  }
  assertDeepEqualJson(
    projection.field_contracts?.lifecycle?.primary_state_labels_by_locale,
    workItemPrimaryStateLabelsByLocale,
    `${label} lifecycle primary state labels`,
  );
  const identity = projection.field_contracts?.identity;
  for (const [field, expected] of Object.entries({
    project_display_name_source: "canonical_workspace_path_basename",
    project_display_name_must_equal_workspace_path_basename: true,
    project_id_source: "canonical_workspace_path_hash",
    workspace_directory_rename_changes_display_name: true,
    workspace_directory_rename_changes_project_id: true,
    binding_label_may_override_project_display_name: false,
    spoken_name_may_override_project_display_name: false,
    runtime_history_may_override_project_display_name: false,
    execution_fallback_allowed: false,
  })) {
    if (identity?.[field] !== expected) {
      throw new Error(`${label} identity.${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.field_contracts?.lifecycle?.business_states,
    workItemBusinessStates,
    `${label} lifecycle business_states`,
  );
  for (const [field, expected] of Object.entries({
    primary_state_projection_owner: "opl_framework",
    primary_state_label_render_owner: "shell_current_app_locale",
    shell_state_derivation_allowed: false,
    projected_primary_state_label_role: "compatibility_fallback_only",
    cross_locale_projected_label_allowed: false,
  })) {
    if (projection.field_contracts?.lifecycle?.[field] !== expected) {
      throw new Error(`${label} lifecycle.${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.field_contracts?.attention?.system_responsibility_required_fields,
    systemAttentionResponsibilityFields,
    `${label} system attention responsibility fields`,
  );
  if (
    projection.field_contracts?.attention?.system_attention_requires_current_generation !== true ||
    projection.field_contracts?.attention?.system_attention_requires_current_blocker !== true ||
    projection.field_contracts?.attention?.incomplete_system_responsibility_policy !==
      "do_not_emit_system_attention_keep_lifecycle_state_and_defer_diagnostics"
  ) {
    throw new Error(`${label} system attention must require a complete current responsibility envelope`);
  }
  assertDeepEqualJson(
    projection.field_contracts?.telemetry?.states,
    ["observed", "partial", "missing", "stale"],
    `${label} telemetry states`,
  );
  assertDeepEqualJson(
    projection.field_contracts?.telemetry?.token_observation?.states,
    tokenObservationStates,
    `${label} token observation states`,
  );
  assertDeepEqualJson(
    projection.field_contracts?.telemetry?.token_observation?.observed_required_fields,
    tokenObservationObservedFields,
    `${label} observed token fields`,
  );
  if (
    projection.field_contracts?.telemetry?.token_observation?.missing_required_fields?.[0] !== "reason" ||
    projection.field_contracts?.telemetry?.missing_may_render_as_zero !== false ||
    projection.field_contracts?.telemetry?.zero_requires_observed_zero !== true ||
    projection.field_contracts?.telemetry?.token_limit_configured !== false ||
    projection.field_contracts?.telemetry?.token_progress_bar_allowed !== false
  ) {
    throw new Error(`${label} token telemetry must be observed-only with no fabricated zero or limit bar`);
  }
  const visibility = projection.field_contracts?.visibility;
  assertDeepEqualJson(visibility?.states, workItemVisibilityStates, `${label} visibility states`);
  for (const [field, expected] of Object.entries({
    authority: "opl_framework_work_item_visibility",
    lifecycle_independent: true,
    generation_is_concurrency_token: true,
    mutation_requires_expected_generation_when_available: true,
    local_storage_truth_allowed: false,
  })) {
    if (visibility?.[field] !== expected) {
      throw new Error(`${label} visibility.${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    visibility?.source_values,
    ["default", "work_item_control_ledger"],
    `${label} visibility source_values`,
  );
  const action = projection.field_contracts?.action;
  assertDeepEqualJson(action?.owner_kinds, actionOwnerKinds, `${label} action owner_kinds`);
  assertDeepEqualJson(
    action?.compatibility_fallback_fields,
    ["title", "summary"],
    `${label} action compatibility_fallback_fields`,
  );
  for (const [field, expected] of Object.entries({
    message_args_policy: "single_structured_values_object_not_prelocalized_sentences",
    render_owner: "shell_current_app_locale",
    compatibility_fallback_only: true,
    cross_locale_raw_fallback_allowed: false,
    raw_owner_default_render_allowed: false,
  })) {
    if (action?.[field] !== expected) {
      throw new Error(`${label} action.${field} must be ${expected}`);
    }
  }
  const domainDetailViews = projection.field_contracts?.domain_detail_views;
  assertDeepEqualJson(
    domainDetailViews?.required_fields,
    domainDetailViewDescriptorFields,
    `${label} domain detail descriptor fields`,
  );
  assertDeepEqualJson(
    domainDetailViews?.availability_values,
    domainDetailViewAvailabilityValues,
    `${label} domain detail availability values`,
  );
  assertDeepEqualJson(
    domainDetailViews?.optional_fields,
    domainDetailViewDescriptorOptionalFields,
    `${label} domain detail optional descriptor fields`,
  );
  assertDeepEqualJson(
    domainDetailViews?.machine_only_fields,
    ["revision", "digest"],
    `${label} domain detail machine-only fields`,
  );
  for (const [field, expected] of Object.entries({
    optional: true,
    collection_kind: "typed_agent_owned_item_detail_descriptors",
    fast_profile_role: "declaration_derived_locator_and_transport_state_only",
    full_payload_in_fast_state_allowed: false,
    app_agent_id_branching_allowed: false,
    renderer_selection_field: "view_kind",
    machine_fields_default_visible: false,
  })) {
    if (domainDetailViews?.[field] !== expected) {
      throw new Error(`${label} domain detail views ${field} must be ${expected}`);
    }
  }
  const scientificDescriptor = domainDetailViews?.registered_view_kinds?.scientific_reasoning_map;
  assertDeepEqualJson(
    scientificDescriptor,
    {
      schema_version: "scientific-reasoning-map.v2",
      compatible_schema_versions: scientificReasoningCompatibleSchemaVersions,
      view_id: "scientific-reasoning",
    },
    `${label} scientific reasoning descriptor`,
  );
  assertDeepEqualJson(
    projection.row_identity_contract,
    {
      canonical_row_key: "item_id",
      detail_selection_key: "item_id",
      item_id_scope: "globally_canonical",
      item_id_derivation: "project_id_plus_encoded_work_item_id",
      identity_work_item_id_scope: "project_local",
      duplicate_local_work_item_id_across_projects_allowed: true,
      mutation_identity_fields: ["agent_id", "project_id", "work_item_id"],
      readback_identity_fields: [
        "identity.agent_id",
        "identity.project_id",
        "identity.work_item_id",
      ],
    },
    `${label} row_identity_contract`,
  );
  for (const [field, expected] of Object.entries({
    diagnostics_items_field_required: true,
    fast_profile_detail_policy: "summary_only",
    fast_profile_nonzero_count_with_empty_items_is_valid: true,
    fast_profile_embedded_item_count_must_not_exceed_count: true,
    full_profile_detail_policy: "included",
    included_count_must_equal_embedded_item_count: true,
    valid_summary_only_preserves_projects_and_work_items: true,
  })) {
    if (projection.diagnostic_envelope_contract?.[field] !== expected) {
      throw new Error(`${label} diagnostic_envelope_contract.${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.default_display_fields,
    [
      "identity.project_display_name",
      "identity.work_item_display_name",
      "identity.agent_display_name",
      "lifecycle.primary_state",
      "visibility.state",
      "execution.current_stage_display_name",
      "execution.next_stage_display_name",
      "telemetry.elapsed",
      "telemetry.current_stage_tokens",
      "telemetry.task_total_tokens",
      "action.title_key",
      "action.message_args",
      "action.owner",
      "action.owner_kind",
    ],
    `${label} default_display_fields`,
  );
  assertDeepEqualJson(
    projection.condition_contract?.required_fields,
    workItemConditionFields,
    `${label} condition required_fields`,
  );
  assertDeepEqualJson(
    projection.action_envelope_contract?.action_kinds,
    actionEnvelopeKinds,
    `${label} action envelope kinds`,
  );
  assertDeepEqualJson(
    projection.action_envelope_contract?.required_fields,
    workItemProjectionFieldContracts.action,
    `${label} action envelope required_fields`,
  );
  assertDeepEqualJson(
    projection.action_envelope_contract?.owner_kinds,
    actionOwnerKinds,
    `${label} action envelope owner_kinds`,
  );
  assertDeepEqualJson(
    projection.action_envelope_contract?.default_row_fields,
    ["kind", "title_key", "message_args", "owner", "owner_kind"],
    `${label} action envelope default_row_fields`,
  );
  assertDeepEqualJson(
    projection.action_envelope_contract?.compatibility_fallback_fields,
    ["title", "summary"],
    `${label} action envelope compatibility_fallback_fields`,
  );
  if (
    projection.action_envelope_contract?.default_action_source !==
      "current_owner_delta_or_task_action_cards" ||
    projection.action_envelope_contract?.localization_owner !== "shell_current_app_locale" ||
    projection.action_envelope_contract?.compatibility_fallback_only !== true ||
    projection.action_envelope_contract?.cross_locale_raw_fallback_allowed !== false ||
    projection.action_envelope_contract?.raw_owner_default_render_allowed !== false ||
    projection.action_envelope_contract?.mutating_actions_require_app_action_route !== true
  ) {
    throw new Error(`${label} action envelope must use semantic locale rendering and the App action route`);
  }
  const visibilityMutation = projection.visibility_mutation_contract;
  assertDeepEqualJson(
    visibilityMutation?.payload_required_fields,
    ["agent_id", "project_id", "work_item_id", "visibility_state"],
    `${label} visibility mutation payload_required_fields`,
  );
  assertDeepEqualJson(
    visibilityMutation?.payload_optional_fields,
    ["reason", "expected_generation"],
    `${label} visibility mutation payload_optional_fields`,
  );
  assertDeepEqualJson(
    visibilityMutation?.visibility_values,
    workItemVisibilityStates,
    `${label} visibility mutation values`,
  );
  for (const [field, expected] of Object.entries({
    action_id: "work_item_visibility_set",
    action_route: "opl app action execute --action work_item_visibility_set --payload <json> --json",
    expected_generation_source: "item.visibility.generation",
    expected_generation_required_when_available: true,
    concurrency_token_readback_source: "item.visibility.generation",
    optimistic_local_truth_commit_allowed: false,
    local_storage_truth_allowed: false,
    success_refresh_command: "opl app state --profile fast --json",
    success_readback_selector:
      "work_item_projection_v2.items[identity.agent_id=payload.agent_id && identity.project_id=payload.project_id && identity.work_item_id=payload.work_item_id]",
    success_requires_requested_visibility: true,
    generation_conflict_error: "work_item_control_generation_conflict",
    generation_conflict_policy: "refresh_authoritative_projection_then_prompt_retry",
    failure_preserves_authoritative_projection: true,
    visibility_mutation_may_change_lifecycle: false,
    visibility_mutation_may_stop_execution: false,
    visibility_mutation_may_delete_evidence: false,
    stop_requires_separate_framework_action: true,
  })) {
    if (visibilityMutation?.[field] !== expected) {
      throw new Error(`${label} visibility mutation ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    visibilityMutation?.success_readback_identity_fields,
    ["identity.agent_id", "identity.project_id", "identity.work_item_id"],
    `${label} visibility mutation success_readback_identity_fields`,
  );
  assertDeepEqualJson(
    visibilityMutation?.success_readback_required_fields,
    [
      "item_id",
      "identity.agent_id",
      "identity.project_id",
      "identity.work_item_id",
      "visibility.state",
      "visibility.source",
      "visibility.updated_at",
      "visibility.control_ref",
      "visibility.generation",
      "lifecycle",
      "execution",
      "telemetry",
    ],
    `${label} visibility mutation success_readback_required_fields`,
  );
  assertIncludesAll(
    projection.stage_catalog_contract?.required_fields,
    ["stage_id", "display_name", "description", "owner_kind", "next_action_template"],
    `${label} stage catalog required_fields`,
  );
  assertDeepEqualJson(
    projection.detail_layer_contract?.primary_sections,
    workItemDetailPrimarySections,
    `${label} detail primary sections`,
  );
  assertDeepEqualJson(
    projection.detail_layer_contract?.secondary_sections,
    runtimeWorkItemDetailSecondarySections,
    `${label} detail secondary sections`,
  );
  assertDeepEqualJson(
    projection.detail_layer_contract?.domain_detail_view_summary_fields,
    scientificReasoningSummaryFields,
    `${label} domain detail summary fields`,
  );
  assertDeepEqualJson(
    projection.detail_layer_contract?.diagnostic_sections,
    [],
    `${label} detail diagnostic sections`,
  );
  assertIncludesAll(
    projection.detail_layer_contract?.stage_map_fields,
    ["stage_id", "display_name", "state", "owner", "elapsed", "usage", "next_action"],
    `${label} stage map fields`,
  );
  for (const forbidden of ["timeline_event_fields", "timeline_event_types"]) {
    if (Object.hasOwn(projection.detail_layer_contract ?? {}, forbidden)) {
      throw new Error(`${label} detail layer must not expose ${forbidden} in Runtime`);
    }
  }
  if (projection.detail_layer_contract?.default_visibility !== "on_selected_work_item_only") {
    throw new Error(`${label} detail layer must be opened only after selecting a work item`);
  }
  if (projection.detail_layer_contract?.selection_key !== "item_id") {
    throw new Error(`${label} detail layer must select globally canonical item_id`);
  }
  const detailRead = projection.domain_detail_view_read_contract;
  assertDeepEqualJson(
    detailRead?.availability_values,
    domainDetailViewReadAvailabilityValues,
    `${label} domain detail read availability values`,
  );
  assertDeepEqualJson(
    detailRead?.response_required_fields,
    [
      "schema_version",
      "surface_kind",
      "item_id",
      "view_id",
      "view_kind",
      "availability",
      "revision",
      "not_modified",
      "payload_schema",
      "payload",
      "conditions",
    ],
    `${label} domain detail response fields`,
  );
  assertDeepEqualJson(
    detailRead?.response_optional_fields,
    ["digest", "generation"],
    `${label} domain detail optional response fields`,
  );
  for (const [field, expected] of Object.entries({
    surface_kind: "opl_domain_detail_view",
    schema_version: "opl_domain_detail_view.v1",
    descriptor_path: "items[].domain_detail_views[]",
    command: "opl app view read --item-id <canonical-item-id> --view-id <view-id> [--if-revision <revision>] --json",
    scientific_reasoning_command: "opl app view read --item-id <canonical-item-id> --view-id scientific-reasoning [--if-revision <revision>] --json",
    optional_revision_argument: "--if-revision <revision>",
    compatibility_generation_policy: "deprecated_optional_alias_must_equal_revision",
    resolver_owner: "opl_framework_standard_agent_descriptor",
    app_may_submit_ref_or_path: false,
    arbitrary_path_read_allowed: false,
    workspace_containment_required: true,
    symlink_escape_allowed: false,
    schema_validation_required: true,
    size_limit_fail_closed: true,
    digest_validation_required_when_present: true,
    availability_is_transport_state_only: true,
    transport_state_may_be_interpreted_as_scientific_outcome: false,
    owner_projection_body_kind: "typed_domain_read_model_not_artifact_body",
    app_role: "typed_display_consumer",
    shell_renderer_registry: "view_kind_keyed_no_agent_id_branching",
  })) {
    if (detailRead?.[field] !== expected) {
      throw new Error(`${label} domain detail read ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    detailRead?.selection_fields,
    ["item_id", "view_id"],
    `${label} domain detail read selection fields`,
  );
  if (detailRead?.unchanged_response?.not_modified !== true || detailRead?.unchanged_response?.payload !== null) {
    throw new Error(`${label} domain detail read must preserve the prior view on not_modified`);
  }
  const reasoningPayload = detailRead?.payload_contracts?.scientific_reasoning_map;
  if (reasoningPayload?.payload_schema !== "scientific-reasoning-map.v2") {
    throw new Error(`${label} scientific reasoning payload must use v2`);
  }
  assertDeepEqualJson(
    reasoningPayload?.compatible_payload_schemas,
    scientificReasoningCompatibleSchemaVersions,
    `${label} scientific reasoning compatible payload schemas`,
  );
  assertDeepEqualJson(
    reasoningPayload?.snapshot_fields,
    scientificReasoningV2SnapshotFields,
    `${label} scientific reasoning v2 snapshot fields`,
  );
  assertDeepEqualJson(
    reasoningPayload?.snapshot_fields_by_schema,
    scientificReasoningSnapshotFieldsBySchema,
    `${label} scientific reasoning snapshot fields by schema`,
  );
  assertDeepEqualJson(
    reasoningPayload?.v2_machine_only_fields,
    ["surface_kind", "version", "study_id", "study_ref", "revision", "source_refs", "conditions"],
    `${label} scientific reasoning v2 machine-only fields`,
  );
  assertDeepEqualJson(
    reasoningPayload?.v2_identity_binding,
    {
      study_id_source: "selected_work_item.identity.work_item_id",
      study_ref_kind: "mas_study",
      study_ref_template: "mas-study:<study_id>",
      app_validation_role: "shape_and_item_binding_only_no_domain_judgment",
    },
    `${label} scientific reasoning v2 identity binding`,
  );
  assertDeepEqualJson(
    reasoningPayload?.medical_prose_policy,
    scientificReasoningMedicalProsePolicy,
    `${label} scientific reasoning medical prose policy`,
  );
  assertDeepEqualJson(
    reasoningPayload?.summary_required_fields,
    scientificReasoningSummaryFields,
    `${label} scientific reasoning summary fields`,
  );
  assertDeepEqualJson(
    reasoningPayload?.node_kinds,
    scientificReasoningNodeKinds,
    `${label} scientific reasoning node kinds`,
  );
  assertDeepEqualJson(
    reasoningPayload?.node_status_values,
    scientificReasoningNodeStatuses,
    `${label} scientific reasoning node statuses`,
  );
  assertDeepEqualJson(
    reasoningPayload?.edge_kinds,
    scientificReasoningEdgeKinds,
    `${label} scientific reasoning edge kinds`,
  );
  assertDeepEqualJson(
    reasoningPayload?.current_branch_membership_source_by_schema,
    scientificReasoningCurrentBranchMembershipBySchema,
    `${label} scientific reasoning current branch membership source`,
  );
  if (
    reasoningPayload?.v1_compatibility_mode !== "read_only_no_write_upgrade_or_domain_inference" ||
    reasoningPayload?.v2_surface_kind !== "mas_research_trajectory_snapshot" ||
    reasoningPayload?.v2_version !== "mas-research-trajectory-snapshot.v2" ||
    reasoningPayload?.v2_additional_properties_allowed !== false ||
    reasoningPayload?.snapshot_authority !== "mas_authored_lightweight_runtime_reference" ||
    reasoningPayload?.snapshot_update_model !== "single_mas_authored_snapshot" ||
    reasoningPayload?.app_validation_proves_medical_copy_quality_or_scientific_validity !== false ||
    reasoningPayload?.node_status_display_policy !== "domain_authored_layout_cue_only_medical_explanation_from_exact_prose" ||
    reasoningPayload?.execution_failed_and_not_assessed_remain_distinct !== true ||
    reasoningPayload?.sources_and_basis_source !== "medical_narrative.sources_and_basis" ||
    reasoningPayload?.sources_and_basis_default_surface !== "collapsed_sources_and_basis" ||
    reasoningPayload?.machine_source_refs_default_visible !== false ||
    reasoningPayload?.v2_current_branch_membership_inference_allowed !== false
  ) {
    throw new Error(`${label} scientific reasoning must remain a lightweight MAS-authored snapshot and display-only App view`);
  }
  assertDeepEqualJson(
    reasoningPayload?.app_validation_scope,
    ["schema_shape", "node_edge_drawability", "machine_field_visibility"],
    `${label} scientific reasoning App validation scope`,
  );
  if (reasoningPayload?.edge_kinds?.includes("refutes")) {
    throw new Error(`${label} scientific reasoning must not overstate a result as refutation`);
  }
  if (
    projection.refs_only !== true ||
    projection.artifact_body_access !== false ||
    projection.owner_receipt_write_access !== false
  ) {
    throw new Error(`${label} must remain refs-only and non-authoritative`);
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      "shell_runtime_truth",
      "domain_truth",
      "owner_receipt_authority",
      "artifact_body",
      "release_currentness",
      "live_runtime_readiness",
    ],
    `${label} forbidden_claims`,
  );
}

export function validateAgentAvailabilityProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    surface_kind: "opl_agent_availability_projection",
    schema_version: "agent-availability-projection.v1",
    authority: "one_person_lab_agent_catalog_and_package_readiness_projection",
    app_role: "display_only_agent_availability_consumer",
    independent_from_work_item_state: true,
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.required_fields,
    ["agent_id", "display_name", "availability", "reason", "last_checked_at"],
    `${label} required_fields`,
  );
  assertDeepEqualJson(
    projection.first_party_agents,
    runtimeFirstPartyAgents,
    `${label} first_party_agents`,
  );
  assertDeepEqualJson(
    projection.availability_states,
    ["available", "attention_required", "unavailable"],
    `${label} availability_states`,
  );
  if (
    projection.all_healthy_panel_state !== "collapsed_summary" ||
    projection.bare_count_or_fraction_allowed !== false ||
    projection.task_count_is_availability !== false ||
    projection.mas_scholar_skills_role !== "med_autoscience_dependency_not_agent"
  ) {
    throw new Error(`${label} must express availability only, collapse healthy agents, and reject bare counts`);
  }
}

function validateTaskRunProjectionV2Contract(projection, label) {
  for (const [field, expected] of Object.entries({
    schema_name: "TaskRunProjection",
    schema_version: 2,
    projection_kind: "task_run_projection_v2",
    model_policy:
      "Runtime uses WorkItemProjection v2; ordinary conversation and right inspector consume filtered TaskRunProjection v2 refs.",
    slice_policy:
      "conversation_and_inspector_filtered_slices_runtime_uses_separate_work_item_projection_v2",
    domain_authority_policy: "refs_only_no_domain_authority_no_artifact_body_no_domain_verdict",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  for (const [group, fields] of Object.entries(taskRunProjectionV2FieldGroups)) {
    assertDeepEqualJson(
      projection.v2_field_groups?.[group],
      fields,
      `${label} v2_field_groups.${group}`,
    );
  }
}

export function validateTaskRunProjectionV2Fixture(task, label) {
  if (!task || typeof task !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const field of taskRunProjectionV2RequiredFields) {
    if (!Object.hasOwn(task, field)) {
      throw new Error(`${label} must include ${field}`);
    }
  }
  for (const [group, fields] of Object.entries(taskRunProjectionV2FieldGroups)) {
    if (group === "diagnostics_ref") {
      if (typeof task.diagnostics_ref !== "string" || task.diagnostics_ref.length === 0) {
        throw new Error(`${label} diagnostics_ref must be a non-empty ref`);
      }
      continue;
    }
    const value = group === "conditions" ? task.conditions?.[0] : task[group];
    if (["evidence_cards", "action_cards", "resource_cards"].includes(group)) {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`${label} ${group} must include at least one card`);
      }
      for (const field of fields) {
        if (!Object.hasOwn(value[0], field)) {
          throw new Error(`${label} ${group}[0] must include ${field}`);
        }
      }
      if (
        ["evidence_cards", "action_cards", "resource_cards"].includes(group) &&
        (!value[0].open_action || typeof value[0].open_action !== "object")
      ) {
        throw new Error(`${label} ${group}[0] must include open_action object`);
      }
    } else {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label} ${group} must be an object`);
      }
      for (const field of fields) {
        if (!Object.hasOwn(value, field)) {
          throw new Error(`${label} ${group} must include ${field}`);
        }
      }
    }
  }
  const status = task.status;
  if (status?.primary_state && !runtimePrimaryStateValues.includes(status.primary_state)) {
    throw new Error(
      `${label} status.primary_state must be one of ${runtimePrimaryStateValues.join(", ")}`,
    );
  }
  if (status?.automation_state && !runtimeAutomationStateValues.includes(status.automation_state)) {
    throw new Error(
      `${label} status.automation_state must be one of ${runtimeAutomationStateValues.join(", ")}`,
    );
  }
  for (const forbidden of [
    "artifact_body",
    "artifact_body_preview",
    "domain_artifact_body",
    "domain_truth",
    "owner_receipt_body",
    "domain_quality_verdict",
    "quality_verdict",
    "domain_readiness",
    "domain_ready",
    "app_release_readiness",
    "production_readiness",
  ]) {
    if (Object.hasOwn(task, forbidden)) {
      throw new Error(`${label} must not project ${forbidden}`);
    }
  }
}

function validateResourceContextPolicy(policy, label) {
  if (!policy || typeof policy !== "object") {
    throw new Error(`${label} must be declared`);
  }
  assertIncludesAll(
    policy.optional_ref_fields,
    resourceContextOptionalTaskRefs,
    `${label} optional_ref_fields`,
  );
  assertDeepEqualJson(
    policy.plan_approve_execute_collect_flow,
    [
      "resource_plan_ref",
      "resource_approval_ref",
      "resource_execute_ref",
      "resource_monitor_ref",
      "resource_collect_ref",
      "resource_receipt_ref",
    ],
    `${label} plan approve execute collect flow`,
  );
  assertDeepEqualJson(
    policy.console_management_ref_fields,
    ["console_policy_ref", "quota_ref", "billing_ref", "permission_ref"],
    `${label} console management ref fields`,
  );
  assertDeepEqualJson(
    policy.environment_catalog_policy?.ref_fields,
    [
      "environment_ref",
      "environment_template_ref",
      "environment_version_ref",
      "environment_source_ref",
      "environment_task_refs",
    ],
    `${label} environment catalog ref fields`,
  );
  if (
    policy.environment_catalog_policy?.environment_body_access !== false ||
    policy.environment_catalog_policy?.package_lock_body_access !== false
  ) {
    throw new Error(`${label} environment catalog must remain refs-only`);
  }
}

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

export function validateStateIndexSidecarProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: "app_state.operator.workbench.task_drilldowns.state_index_sidecar_projection",
    detail_source: "opl runtime app-operator-drilldown --task <task_id> --json",
    authority: "opl_framework_state_index_kernel_sqlite_sidecar_projection",
    kernel_owner: "one-person-lab",
    storage_kind: "sqlite_sidecar_read_model_cache",
    app_access_mode: "read_only_projection_consumer",
    display_policy: "maintenance_diagnostics_state_index_refs_only_no_sqlite_write_no_domain_truth_claims",
    settings_owner_surface: "/settings/environment?section=diagnostics",
    consumer_surface: "/settings/environment?section=diagnostics",
    runtime_page_visible: false,
    drilldown_target_policy: "refs_drill_down_to_stage_folder_not_domain_body",
    app_role: "display_only_state_index_read_model_consumer",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.allowed_input_surfaces,
    [
      "opl app state --profile fast --json",
      "opl app state --profile full --json",
      "opl runtime app-operator-drilldown --task <task_id> --json",
    ],
    `${label} allowed_input_surfaces`,
  );
  assertDeepEqualJson(
    projection.required_ref_fields,
    ["state_index_ref", "stage_folder_ref", "task_ref", "owner_ref", "updated_at"],
    `${label} required_ref_fields`,
  );
  assertDeepEqualJson(
    projection.optional_ref_fields,
    [
      "artifact_index_refs",
      "receipt_index_refs",
      "blocker_index_refs",
      "readiness_false_flag_refs",
      "cache_generation_ref",
    ],
    `${label} optional_ref_fields`,
  );
  for (const field of [
    "sqlite_direct_read_access",
    "sqlite_write_access",
    "sidecar_mutation_access",
    "domain_truth_write_access",
    "owner_receipt_write_access",
    "artifact_body_access",
    "readiness_authority",
    "artifact_authority",
    "quality_verdict_authority",
  ]) {
    if (projection[field] !== false) {
      throw new Error(`${label} ${field} must be false`);
    }
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      "sqlite_truth_owner",
      "sqlite_sidecar_writer",
      "state_index_kernel_owner",
      "domain_truth",
      "owner_receipt_authority",
      "artifact_body",
      "artifact_authority",
      "domain_readiness",
      "quality_verdict",
      "export_readiness",
      "app_release_readiness",
      "family_production_readiness",
    ],
    `${label} forbidden_claims`,
  );
}

export function validateStateIndexSidecarFixture(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  if (projection.surface_kind !== "opl_state_index_kernel_sidecar_read_model") {
    throw new Error(`${label} surface_kind must be opl_state_index_kernel_sidecar_read_model`);
  }
  for (const field of [
    "state_index_ref",
    "stage_folder_ref",
    "task_ref",
    "owner_ref",
    "updated_at",
  ]) {
    if (!Object.hasOwn(projection, field)) {
      throw new Error(`${label} must include ${field}`);
    }
  }
  for (const field of [
    "artifact_index_refs",
    "receipt_index_refs",
    "blocker_index_refs",
    "readiness_false_flag_refs",
    "cache_generation_ref",
  ]) {
    if (!Object.hasOwn(projection, field)) {
      throw new Error(`${label} must include ${field} as refs or an empty refs list`);
    }
  }
  for (const field of [
    "sqlite_direct_read_access",
    "sqlite_write_access",
    "sidecar_mutation_access",
    "domain_truth_write_access",
    "owner_receipt_write_access",
    "artifact_body_access",
    "readiness_authority",
    "artifact_authority",
    "quality_verdict_authority",
  ]) {
    if (projection[field] !== false) {
      throw new Error(`${label} ${field} must be false`);
    }
  }
  for (const forbidden of [
    "sqlite_path",
    "sqlite_connection_string",
    "sqlite_write_query",
    "state_index_kernel_mutation",
    "domain_truth",
    "owner_receipt_body",
    "artifact_body",
    "domain_artifact_body",
    "domain_quality_verdict",
    "quality_verdict",
    "domain_export_readiness",
    "export_readiness",
    "domain_readiness",
    "domain_ready",
    "app_release_readiness",
    "production_readiness",
  ]) {
    if (Object.hasOwn(projection, forbidden)) {
      throw new Error(`${label} must not project ${forbidden}`);
    }
  }
}

export function validateArtifactNativeDrilldownProjectionContract(projection, label, options = {}) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: "app_state.operator.workbench.task_drilldowns.artifact_native_drilldown",
    detail_source: "opl runtime app-operator-drilldown --task <task_id> --json",
    authority: "opl_framework_stage_artifact_kernel_refs_projection",
    framework_contract_ref:
      "one-person-lab/contracts/opl-framework/stage-artifact-runtime-contract.json",
    surface_kind: "opl_stage_artifact_runtime_workbench",
    display_policy:
      "right_inspector_artifact_provenance_with_maintenance_diagnostics_technical_refs_no_body_no_domain_readiness_claims",
    consumer_surface: "right_context_inspector",
    technical_details_owner_surface: "/settings/environment?section=diagnostics",
    runtime_page_visible: false,
    full_detail_policy: "on_demand_task_drilldown_only",
    app_role: "display_only_stage_artifact_kernel_refs_consumer",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.required_ref_fields,
    [
      "current_pointer_ref",
      "canonical_artifact_refs",
      "export_artifact_refs",
      "lineage_refs",
      "retention_policy_ref",
      "conformance_summary_ref",
    ],
    `${label} required_ref_fields`,
  );
  const optionalRefFields = [
    "content_hash_refs",
    "attempt_manifest_refs",
    "owner_receipt_refs",
    "typed_blocker_refs",
    "decision_receipt_refs",
  ];
  if (options.requireProvenanceBundle) {
    optionalRefFields.push(
      "provenance_bundle_refs",
      "provenance_index_ref",
      "ro_crate_metadata_ref",
      "replay_status_ref",
      "agent_trace_refs",
      "review_refs",
      "typed_issues",
    );
  }
  assertDeepEqualJson(
    projection.optional_ref_fields,
    optionalRefFields,
    `${label} optional_ref_fields`,
  );
  if (options.requireProvenanceBundle) {
    if (
      projection.provenance_projection_ref !==
      "contracts/app-runtime-bridge.json#artifact_provenance_bundle_projection"
    ) {
      throw new Error(
        `${label} provenance_projection_ref must point at artifact provenance bundle projection`,
      );
    }
  }
  if (
    projection.quality_verdict_authority !== undefined &&
    projection.quality_verdict_authority !== false
  ) {
    throw new Error(`${label} quality_verdict_authority must be false`);
  }
  if (projection.readiness_authority !== undefined && projection.readiness_authority !== false) {
    throw new Error(`${label} readiness_authority must be false`);
  }
  if (projection.artifact_body_access !== false) {
    throw new Error(`${label} artifact_body_access must be false`);
  }
  if (projection.domain_verdict_authority !== false) {
    throw new Error(`${label} domain_verdict_authority must be false`);
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      "artifact_body",
      "domain_artifact_body",
      "domain_artifact_authority",
      "domain_quality_verdict",
      "domain_export_readiness",
      "domain_readiness",
      "app_release_readiness",
      "family_production_readiness",
    ],
    `${label} forbidden_claims`,
  );
  if (options.requireProvenanceBundle) {
    assertIncludesAll(
      projection.forbidden_claims,
      ["quality_verdict", "readiness_authority"],
      `${label} provenance forbidden_claims`,
    );
  }
}

export function validateArtifactNativeDrilldownFixture(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  if (projection.surface_kind !== "opl_stage_artifact_runtime_workbench") {
    throw new Error(`${label} surface_kind must be opl_stage_artifact_runtime_workbench`);
  }
  for (const field of [
    "current_pointer_ref",
    "canonical_artifact_refs",
    "export_artifact_refs",
    "lineage_refs",
    "retention_policy_ref",
    "conformance_summary_ref",
  ]) {
    if (!Object.hasOwn(projection, field)) {
      throw new Error(`${label} must include ${field}`);
    }
  }
  for (const field of [
    "content_hash_refs",
    "attempt_manifest_refs",
    "owner_receipt_refs",
    "typed_blocker_refs",
    "decision_receipt_refs",
    "provenance_bundle_refs",
    "provenance_index_ref",
    "ro_crate_metadata_ref",
    "replay_status_ref",
    "agent_trace_refs",
    "review_refs",
    "typed_issues",
  ]) {
    if (!Object.hasOwn(projection, field)) {
      throw new Error(`${label} must include ${field} as refs or a typed empty value`);
    }
  }
  if (projection.provenance_projection_kind !== "artifact_provenance_bundle_projection") {
    throw new Error(
      `${label} provenance_projection_kind must be artifact_provenance_bundle_projection`,
    );
  }
  if (
    projection.provenance_projection_ref !==
    "contracts/app-runtime-bridge.json#artifact_provenance_bundle_projection"
  ) {
    throw new Error(
      `${label} provenance_projection_ref must point at app-runtime-bridge artifact provenance bundle projection`,
    );
  }
  for (const field of [
    "provenance_bundle_refs",
    "agent_trace_refs",
    "review_refs",
    "typed_issues",
  ]) {
    if (!Array.isArray(projection[field]) || projection[field].length === 0) {
      throw new Error(`${label} ${field} must include at least one refs-only example`);
    }
  }
  if (typeof projection.provenance_index_ref !== "string" || !projection.provenance_index_ref) {
    throw new Error(`${label} provenance_index_ref must be a non-empty ref`);
  }
  if (typeof projection.ro_crate_metadata_ref !== "string" || !projection.ro_crate_metadata_ref) {
    throw new Error(`${label} ro_crate_metadata_ref must be a non-empty ref`);
  }
  if (typeof projection.replay_status_ref !== "string" || !projection.replay_status_ref) {
    throw new Error(`${label} replay_status_ref must be a non-empty ref`);
  }
  if (
    projection.provenance_drawer?.projection_ref !==
    "contracts/app-runtime-bridge.json#artifact_provenance_bundle_projection"
  ) {
    throw new Error(
      `${label} provenance_drawer must reference artifact provenance bundle projection`,
    );
  }
  if (projection.provenance_drawer?.open_action?.required_mode !== "read_only") {
    throw new Error(`${label} provenance_drawer open_action must be read_only`);
  }
  if (
    projection.provenance_drawer?.shell_implementation_status !==
    "aionui_refs_only_drawer_implemented"
  ) {
    throw new Error(
      `${label} provenance_drawer must declare AionUI refs-only drawer implementation`,
    );
  }
  if (projection.artifact_body_access !== false) {
    throw new Error(`${label} artifact_body_access must be false`);
  }
  if (projection.domain_verdict_authority !== false) {
    throw new Error(`${label} domain_verdict_authority must be false`);
  }
  if (projection.quality_verdict_authority !== false) {
    throw new Error(`${label} quality_verdict_authority must be false`);
  }
  if (projection.readiness_authority !== false) {
    throw new Error(`${label} readiness_authority must be false`);
  }
  for (const forbidden of [
    "artifact_body",
    "artifact_body_preview",
    "domain_artifact_body",
    "domain_quality_verdict",
    "quality_verdict",
    "domain_export_readiness",
    "export_readiness",
    "domain_readiness",
    "domain_ready",
    "app_release_readiness",
    "production_readiness",
  ]) {
    if (Object.hasOwn(projection, forbidden)) {
      throw new Error(`${label} must not project ${forbidden}`);
    }
  }
  assertNoForbiddenKeys(
    projection,
    [
      "artifact_body",
      "artifact_body_preview",
      "domain_artifact_body",
      "domain_quality_verdict",
      "quality_verdict",
      "domain_export_readiness",
      "export_readiness",
      "domain_readiness",
      "domain_ready",
      "app_release_readiness",
      "production_readiness",
    ],
    label,
  );
}

export function validateArtifactProvenanceBundleProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source:
      "app_state.operator.workbench.task_drilldowns.artifact_native_drilldown.provenance_bundle_refs",
    detail_source: "opl runtime app-operator-drilldown --task <task_id> --json",
    ledger_source: "OPL Ledger artifact provenance bundle record",
    authority: "opl_ledger_artifact_provenance_bundle_refs_projection",
    projection_kind: "artifact_provenance_bundle_projection",
    surface_kind: "artifact_provenance_bundle_projection",
    display_policy:
      "provenance_drawer_refs_only_no_artifact_body_no_domain_verdict_no_readiness_authority",
    full_detail_policy: "on_demand_task_drilldown_or_ledger_inspect_only",
    typed_issue_policy:
      "typed_issues_are_refs_or_issue_summaries_not_owner_receipts_or_domain_verdicts",
    drawer_surface: "right_context_inspector.artifacts.provenance_drawer",
    drawer_route_policy:
      "may_open_aionui_refs_only_drawer_or_AI_readback_from_refs_only_projection_no_artifact_body_no_domain_verdict",
    card_surface: "right_context_inspector.artifacts.provenance_card",
    card_route_policy: "shows_refs_only_summary_and_opens_refs_only_drawer_no_body_read",
    drawer_or_card_policy:
      "drawer_and_card_are_refs_only_projection_surfaces_not_artifact_body_or_quality_verdict_surfaces",
    app_role: "display_only_artifact_provenance_bundle_refs_consumer",
    shell_implementation_status: "aionui_refs_only_drawer_implemented",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.input_sources,
    [
      "opl app state --profile fast --json",
      "opl runtime app-operator-drilldown --task <task_id> --json",
      "OPL Ledger artifact provenance bundle record",
    ],
    `${label} input_sources`,
  );
  assertDeepEqualJson(
    projection.required_ref_fields,
    [
      "provenance_bundle_refs",
      "provenance_index_ref",
      "ro_crate_metadata_ref",
      "replay_status_ref",
      "agent_trace_refs",
      "review_refs",
      "typed_issues",
    ],
    `${label} required_ref_fields`,
  );
  assertIncludesAll(
    projection.optional_ref_fields,
    [
      "ledger_record_refs",
      "code_refs",
      "input_refs",
      "output_refs",
      "environment_refs",
      "content_hash_refs",
      "visual_review_refs",
      "turn_summary_refs",
      "redacted_transcript_export_refs",
    ],
    `${label} optional_ref_fields`,
  );
  for (const [field, expected] of Object.entries({
    refs_only: true,
    artifact_body_access: false,
    memory_body_access: false,
    domain_truth_write_access: false,
    owner_receipt_write_access: false,
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
      "artifact_body",
      "domain_artifact_body",
      "domain_artifact_authority",
      "domain_quality_verdict",
      "quality_verdict",
      "domain_export_readiness",
      "domain_readiness",
      "owner_receipt_authority",
      "app_release_readiness",
      "family_production_readiness",
    ],
    `${label} forbidden_claims`,
  );
}

export function validateOpenScienceAcceptedItemsFixture(task, label) {
  if (!task || typeof task !== "object") {
    throw new Error(`${label} task must be declared`);
  }
  const panel = task.structured_result_panel;
  if (panel?.surface_kind !== "structured_result_panel") {
    throw new Error(`${label} must include structured_result_panel`);
  }
  if (
    panel.projection_ref !== "contracts/app-runtime-bridge.json#structured_result_panel_projection"
  ) {
    throw new Error(`${label} structured_result_panel projection_ref must point at runtime bridge`);
  }
  assertDeepEqualJson(
    panel.display_surfaces,
    ["ordinary_conversation", "current_task_slice", "right_context_inspector"],
    `${label} structured_result_panel display_surfaces`,
  );
  for (const field of [
    "result_summary_ref",
    "status_ref",
    "evidence_card_refs",
    "action_card_refs",
    "artifact_provenance_ref",
    "follow_up_refs",
  ]) {
    if (!Object.hasOwn(panel, field)) {
      throw new Error(`${label} structured_result_panel must include ${field}`);
    }
  }
  if (
    panel.new_dashboard_allowed !== false ||
    panel.content_policy !== "refs_only_no_artifact_body_no_domain_verdict"
  ) {
    throw new Error(
      `${label} structured_result_panel must stay inside existing refs-only task surfaces`,
    );
  }

  const provenanceCard = task.artifact_provenance_card;
  if (provenanceCard?.surface_kind !== "artifact_provenance_card") {
    throw new Error(`${label} must include artifact_provenance_card`);
  }
  if (
    provenanceCard.projection_ref !==
      "contracts/app-runtime-bridge.json#artifact_provenance_bundle_projection" ||
    provenanceCard.artifact_body_access !== false ||
    provenanceCard.readiness_authority !== false ||
    provenanceCard.quality_verdict_authority !== false
  ) {
    throw new Error(`${label} artifact_provenance_card must be refs-only and non-authoritative`);
  }

  const followUps = task.ref_level_follow_up_refs;
  if (!Array.isArray(followUps) || followUps.length === 0) {
    throw new Error(`${label} must include ref_level_follow_up_refs`);
  }
  assertIncludesAll(
    Object.keys(followUps[0]),
    [
      "target_ref",
      "source_ref",
      "comment_ref",
      "prompt_ref",
      "action_ref",
      "owner",
      "content_policy",
    ],
    `${label} ref_level_follow_up_refs[0] fields`,
  );
  if (
    followUps[0].app_annotation_store_write !== false ||
    followUps[0].owner_receipt_write_access !== false ||
    followUps[0].content_policy !== "refs_only_no_comment_body_no_app_annotation_store"
  ) {
    throw new Error(`${label} ref_level_follow_up_refs must not create an App annotation store`);
  }

  const candidates = task.workflow_skill_candidate_refs;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error(`${label} must include workflow_skill_candidate_refs`);
  }
  assertIncludesAll(
    Object.keys(candidates[0]),
    [
      "candidate_ref",
      "source_report_ref",
      "candidate_kind",
      "status",
      "available_actions",
      "content_policy",
    ],
    `${label} workflow_skill_candidate_refs[0] fields`,
  );
  assertDeepEqualJson(
    candidates[0].available_actions,
    ["review", "needs_changes", "continue_in_conversation"],
    `${label} candidate actions`,
  );
  if (
    candidates[0].display_surface !== "settings_capabilities" ||
    candidates[0].report_first !== true ||
    candidates[0].auto_enable !== false ||
    candidates[0].skill_body_write_access !== false ||
    candidates[0].workflow_body_access !== false
  ) {
    throw new Error(
      `${label} workflow_skill_candidate_refs must stay report-first and no-auto-enable`,
    );
  }
  assertNoForbiddenKeys(
    task,
    [
      "artifact_body",
      "domain_artifact_body",
      "review_body",
      "skill_body",
      "workflow_body",
      "app_annotation_store",
    ],
    label,
  );
}

export function validateOpenScienceConsoleProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: "app_state.operator.workbench.task_drilldowns.openscience_console_projection",
    detail_source: "opl runtime app-operator-drilldown --task <task_id> --json",
    authority: "opl_framework_refs_only_console_projection",
    projection_kind: "openscience_console_watch_projection",
    surface_kind: "opl_console_watch_only_drilldown_projection",
    display_policy: "console_drilldown_only_watch_cards_no_readiness_or_verdict_claims",
    inspiration: "OpenScience product pattern",
    full_detail_policy: "on_demand_task_drilldown_only",
    native_viewer_preview_policy: "preview_refs_only_no_artifact_body_no_storage_truth",
    app_role: "display_only_openscience_console_projection_consumer",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.mode_label_policy?.adapted_source_modes,
    ["Science", "Medical Evidence", "Goal", "Knowledge Distillation"],
    `${label} mode_label_policy.adapted_source_modes`,
  );
  assertDeepEqualJson(
    projection.mode_label_policy?.app_display_terms,
    ["Science workspace", "Medical evidence", "Goal tracking", "Knowledge distillation"],
    `${label} mode_label_policy.app_display_terms`,
  );
  for (const [field, expected] of Object.entries({
    "mode_label_policy.mode_labels_are_navigation_only": true,
    "mode_label_policy.medical_evidence_authority_owner": "domain_agent",
    "mode_label_policy.can_authorize_medical_advice": false,
    "mode_label_policy.can_authorize_medical_evidence_verdict": false,
    "mode_label_policy.can_override_domain_mode": false,
  })) {
    const actual = field.split(".").reduce((value, key) => value?.[key], projection);
    if (actual !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.required_projection_cards,
    ["artifact_graph", "claim_warning", "project_local_ledger_pointer", "native_viewer_preview"],
    `${label} required_projection_cards`,
  );
  assertDeepEqualJson(
    projection.required_ref_fields,
    [
      "artifact_graph_refs",
      "claim_warning_refs",
      "project_local_ledger_ref",
      "native_viewer_preview_ref",
    ],
    `${label} required_ref_fields`,
  );
  assertIncludesAll(
    projection.optional_ref_fields,
    [
      "artifact_node_refs",
      "artifact_edge_refs",
      "claim_source_refs",
      "claim_severity_refs",
      "ledger_record_refs",
      "viewer_renderer_ref",
      "preview_thumbnail_ref",
      "open_in_native_viewer_action_ref",
    ],
    `${label} optional_ref_fields`,
  );
  for (const [field, expected] of Object.entries({
    "card_policies.artifact_graph": "graph_refs_only_no_artifact_body_no_storage_truth",
    "card_policies.claim_warning": "warning_refs_only_no_publication_or_quality_verdict",
    "card_policies.project_local_ledger_pointer":
      "ledger_pointer_only_no_ledger_writer_no_owner_receipt",
    "card_policies.native_viewer_preview":
      "native_preview_ref_only_no_source_readiness_or_release_claim",
  })) {
    const actual = field.split(".").reduce((value, key) => value?.[key], projection);
    if (actual !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  for (const [field, expected] of Object.entries({
    refs_only: true,
    watch_only: true,
    artifact_body_access: false,
    memory_body_access: false,
    domain_truth_write_access: false,
    owner_receipt_write_access: false,
    storage_truth_authority: false,
    compute_policy_authority: false,
    source_readiness_authority: false,
    publication_verdict_authority: false,
    release_readiness_authority: false,
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      "release_readiness",
      "source_readiness",
      "publication_verdict",
      "owner_receipt_authority",
      "storage_truth",
      "compute_policy",
      "artifact_body",
      "domain_truth",
      "domain_quality_verdict",
      "app_release_readiness",
      "family_production_readiness",
    ],
    `${label} forbidden_claims`,
  );
}

export function validateStageRunCockpitProjectionContract(projection, label) {
  if (!projection || typeof projection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source:
      "app_state.operator.workbench.task_drilldowns.stage_run_cockpit + app_state.operator.workbench.task_drilldowns.stage_run_cockpit_summary",
    equivalent_source: "app_state.operator.workbench.task_drilldowns.stage_run_current_owner_delta",
    derived_from: "current_owner_delta",
    authority: "opl_framework_current_owner_delta_refs_projection",
    display_policy: "refs_only_stage_run_cockpit_display_guard_no_runtime_truth_claims",
    app_role: "display_only_stage_run_cockpit_consumer",
  })) {
    if (projection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    projection.accepted_fast_state_fields,
    ["stage_run_cockpit", "stage_run_cockpit_summary", "stage_run_current_owner_delta"],
    `${label} accepted_fast_state_fields`,
  );
  assertIncludesAll(
    projection.required_ref_fields,
    [
      "task_id",
      "stage_id",
      "owner",
      "next_visible_step",
      "accepted_return_shapes",
      "readiness_false_flag_refs",
    ],
    `${label} required_ref_fields`,
  );
  assertDeepEqualJson(
    projection.optional_ref_fields,
    [
      "elapsed_seconds",
      "last_heartbeat_at",
      "running_proof_ref",
      "stage_usage",
      "task_total_usage",
      "typed_blocker_summary",
      "typed_blocker_owner",
      "typed_blocker_resolution_ref",
    ],
    `${label} optional_ref_fields`,
  );
  assertIncludesAll(
    projection.summary_fields,
    ["current_owner", "required_delta", "next_safe_action_ref", "artifact_or_blocker_refs"],
    `${label} summary_fields`,
  );
  assertNonEmptyStringArray(projection.preferred_panel_fields, `${label} preferred_panel_fields`);
  assertNonEmptyString(projection.telemetry_missing_policy, `${label} telemetry_missing_policy`);
  if (projection.refs_only !== true) {
    throw new Error(`${label} refs_only must be true`);
  }
  assertIncludesAll(
    projection.forbidden_claims,
    [
      "runtime_truth",
      "domain_truth",
      "owner_receipt_authority",
      "typed_blocker_authority",
      "artifact_authority",
      "domain_readiness",
      "app_release_readiness",
      "family_production_readiness",
    ],
    `${label} forbidden_claims`,
  );
}

export function validateStageRunCockpitFixture(task, label) {
  if (!task || typeof task !== "object") {
    throw new Error(`${label} task must be declared`);
  }
  const cockpit = task.stage_run_cockpit ?? task.stage_run_current_owner_delta;
  if (!cockpit || typeof cockpit !== "object") {
    throw new Error(`${label} must include stage_run_cockpit or stage_run_current_owner_delta`);
  }
  if (!task.stage_run_cockpit_summary || typeof task.stage_run_cockpit_summary !== "object") {
    throw new Error(`${label} must include stage_run_cockpit_summary`);
  }
  if (cockpit.derived_from !== "current_owner_delta") {
    throw new Error(`${label} must derive from current_owner_delta`);
  }
  for (const field of [
    "task_id",
    "stage_id",
    "owner",
    "next_visible_step",
    "accepted_return_shapes",
    "readiness_false_flag_refs",
  ]) {
    if (!Object.hasOwn(cockpit, field)) {
      throw new Error(`${label} cockpit must include ${field}`);
    }
  }
  for (const field of [
    "current_owner",
    "required_delta",
    "next_safe_action_ref",
    "artifact_or_blocker_refs",
  ]) {
    if (!Object.hasOwn(task.stage_run_cockpit_summary, field)) {
      throw new Error(`${label} summary must include ${field}`);
    }
  }
  if (cockpit.refs_only !== true) {
    throw new Error(`${label} cockpit refs_only must be true`);
  }
  for (const forbidden of [
    "runtime_truth",
    "domain_truth",
    "owner_receipt_body",
    "owner_receipt_authority",
    "typed_blocker_body",
    "typed_blocker_authority",
    "artifact_body",
    "artifact_authority",
    "domain_ready",
    "domain_readiness",
    "app_release_ready",
    "app_release_readiness",
    "production_ready",
    "production_readiness",
  ]) {
    if (
      Object.hasOwn(cockpit, forbidden) ||
      Object.hasOwn(task.stage_run_cockpit_summary, forbidden)
    ) {
      throw new Error(`${label} must not project ${forbidden}`);
    }
  }
}

function validateActiveProjectLineProjectionContract(
  activeProjectLineProjection,
  label,
  options = {},
) {
  if (!activeProjectLineProjection || typeof activeProjectLineProjection !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source:
      "app_state.operator.workbench.activity_center.active_projects + app_state.operator.visual_ref_groups.active_project_refs",
    authority: "opl_framework_refs_only_project_line_projection",
    display_policy:
      "active_project_line_count_can_include_queued_or_escalated_owner_handled_lines_without_active_worker_run",
  })) {
    if (activeProjectLineProjection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  if (activeProjectLineProjection.status_preservation_required !== true) {
    throw new Error(`${label} must preserve status, active_run_id, and next_visible_step`);
  }
  assertDeepEqualJson(
    activeProjectLineProjection.primary_grouping_policy,
    appOwnedPrimaryGroupingPolicy,
    `${label} primary_grouping_policy`,
  );
  assertDeepEqualJson(
    activeProjectLineProjection.project_group_expansion_policy,
    appOwnedProjectGroupExpansionPolicy,
    `${label} project_group_expansion_policy`,
  );
  if (options.requireFields !== false) {
    assertIncludesAll(
      activeProjectLineProjection.required_fields,
      ["task_id", "title", "state", "status", "study_id", "active_run_id", "next_visible_step"],
      `${label} required_fields`,
    );
  }
  assertIncludesAll(
    activeProjectLineProjection.must_not_claim,
    ["active_worker_run", "provider_execution_running", "domain_ready", "paper_quality_ready"],
    `${label} must_not_claim`,
  );
}

export function validateProjectProgressDisplayContract(projectProgress, label) {
  if (!projectProgress || typeof projectProgress !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: "app_state.operator.workbench.task_drilldowns",
    authority: "opl_framework_shared_project_progress_projection",
    display_policy: "project_progress_refs_secondary_no_module_runtime_dirty_as_project",
    consumer_surface: "/settings/environment?section=diagnostics",
    runtime_page_visible: false,
    diagnostics_treatment: "maintenance_diagnostics_only",
    safe_actions_treatment: "maintenance_diagnostics_only",
  })) {
    if (projectProgress[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    projectProgress.required_fields,
    [
      "task_id",
      "title",
      "domain_id",
      "state",
      "active_stage_id",
      "progress_delta_classification",
      "deliverable_progress_delta",
      "platform_repair_delta",
      "blocker_ref_count",
      "next_visible_step",
      "next_owner",
    ],
    `${label} required_fields`,
  );
  assertIncludesAll(
    projectProgress.optional_user_fields,
    ["domain_label", "active_stage_label", "next_visible_step", "next_owner", "last_progress_at"],
    `${label} optional_user_fields`,
  );
  assertIncludesAll(
    projectProgress.forbidden_running_task_sources,
    [
      "module_runtime dirty state",
      "domain lane active_task_count",
      "assistant purpose cards",
      "module readiness diagnostics",
    ],
    `${label} forbidden_running_task_sources`,
  );
  validateActiveProjectLineProjectionContract(
    projectProgress.active_project_line_projection,
    `${label} active project line projection`,
  );
}

export function validateUserTaskStatusProjectionContract(
  userTaskStatus,
  label,
  stageRunCockpitProjection,
) {
  if (!userTaskStatus || typeof userTaskStatus !== "object") {
    throw new Error(`${label} must be declared`);
  }
  if (!stageRunCockpitProjection || typeof stageRunCockpitProjection !== "object") {
    throw new Error(
      `${label} must receive Runtime bridge StageRun cockpit projection expectations`,
    );
  }
  if (userTaskStatus === stageRunCockpitProjection) {
    throw new Error(
      `${label} must compare against the Runtime bridge StageRun cockpit projection, not itself`,
    );
  }
  for (const [field, expected] of Object.entries({
    source:
      "app_state.operator.workbench.summary_cards + app_state.operator.workbench.activity_center + app_state.operator.workbench.task_drilldowns + app_state.operator.visual_ref_groups.active_project_refs",
    authority: "opl_framework_refs_only_user_task_projection",
    display_policy: "scope_switchable_user_task_status_first_provider_projection_diagnostic_only",
    default_user_question:
      "Within the selected scope, which projects are moving, which are paused, which need a user decision, which need system handling, and what is each task's current stage, liveness, and token usage?",
    progress_label_policy:
      "render framework progress classification and stage labels as human task progress labels without exposing raw projection or ledger names",
    diagnostic_source_policy:
      "provider/projection/ref/ledger/current_control_state details stay secondary and are not the default page language",
  })) {
    if (userTaskStatus[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    userTaskStatus.scope_fields,
    runtimeScopeRequiredFields,
    `${label} scope_fields`,
  );
  assertDeepEqualJson(
    userTaskStatus.summary_fields,
    ["running_task_count", "active_project_count", "queued_project_count", "attention_count"],
    `${label} summary_fields`,
  );
  assertDeepEqualJson(
    userTaskStatus.primary_state_summary_fields,
    [
      "in_progress_count",
      "delivered_auto_paused_count",
      "paused_count",
      "owner_decision_count",
      "system_attention_count",
      "automation_running_count",
    ],
    `${label} primary_state_summary_fields`,
  );
  assertDeepEqualJson(
    userTaskStatus.primary_state_fields,
    ["primary_state", "primary_state_label", "primary_state_reason"],
    `${label} primary_state_fields`,
  );
  assertDeepEqualJson(
    userTaskStatus.automation_state_fields,
    ["automation_state", "automation_state_label", "automation_state_reason"],
    `${label} automation_state_fields`,
  );
  assertDeepEqualJson(
    userTaskStatus.primary_state_values,
    runtimePrimaryStateValues,
    `${label} primary_state_values`,
  );
  assertDeepEqualJson(
    userTaskStatus.automation_state_values,
    runtimeAutomationStateValues,
    `${label} automation_state_values`,
  );
  assertDeepEqualJson(
    userTaskStatus.mental_model_layers,
    appOwnedRuntimeMentalModel,
    `${label} mental_model_layers`,
  );
  assertIncludesAll(
    userTaskStatus.task_fields,
    [
      "task_id",
      "title",
      "status",
      "stage",
      "progress_label",
      "next_step",
      "owner",
      "last_progress",
      "next_owner",
      "stage_run_cockpit",
      "stage_run_cockpit_summary",
      "stage_run_current_owner_delta",
      "artifact_or_blocker",
      "review_receipt",
      "action_receipt",
      "workflow_refs",
      "export_bundle_action_ref",
      "gateway_status_ref",
      "resource_source_refs",
      "environment_ref",
      "storage_ref",
      "resource_plan_ref",
      "resource_approval_ref",
      "resource_execute_ref",
      "resource_monitor_ref",
      "resource_collect_ref",
      "resource_usage_ref",
      "console_policy_ref",
      "quota_ref",
      "billing_ref",
      "permission_ref",
      "environment_template_ref",
      "environment_version_ref",
      "environment_source_ref",
      "environment_task_refs",
      "resource_receipt_ref",
      "cost_estimate_ref",
      "connector_readiness_refs",
      "diagnostic_substrate_refs",
    ],
    `${label} task_fields`,
  );
  for (const [field, expected] of Object.entries({
    running_task_count:
      "count user tasks projected as actively running or advancing, never raw provider attempts",
    active_project_count:
      "count active user-visible project lines from the framework project-line projection",
    queued_project_count:
      "count queued or waiting user-visible project/task lines without claiming active worker runs",
    attention_count:
      "count user-visible blockers, human gates, failed safe actions, or owner attention states",
  })) {
    if (userTaskStatus.count_policies?.[field] !== expected) {
      throw new Error(`${label} count_policies.${field} must be ${expected}`);
    }
  }
  if (userTaskStatus.running_state_policy !== appOwnedRunningStatePolicy) {
    throw new Error(`${label} running_state_policy must be ${appOwnedRunningStatePolicy}`);
  }
  if (userTaskStatus.queue_status_policy !== appOwnedQueueStatusPolicy) {
    throw new Error(`${label} queue_status_policy must be ${appOwnedQueueStatusPolicy}`);
  }
  if (
    userTaskStatus.stage_run_projection_ref !==
    "contracts/app-runtime-bridge.json#stage_run_cockpit_projection"
  ) {
    throw new Error(
      `${label} stage_run_projection_ref must point to the Runtime bridge StageRun cockpit projection`,
    );
  }
  assertDeepEqualJson(
    userTaskStatus.default_stage_run_panel_fields,
    stageRunCockpitProjection.preferred_panel_fields,
    `${label} default_stage_run_panel_fields`,
  );
  if (
    userTaskStatus.telemetry_missing_policy !== stageRunCockpitProjection.telemetry_missing_policy
  ) {
    throw new Error(
      `${label} telemetry_missing_policy must match Runtime bridge StageRun cockpit projection`,
    );
  }
  assertDeepEqualJson(
    userTaskStatus.agent_module_status_panel,
    appOwnedAgentModuleStatusPanel,
    `${label} agent_module_status_panel`,
  );
  assertDeepEqualJson(
    userTaskStatus.work_item_visibility,
    {
      projection_path: "work_item_projection_v2.items[].visibility",
      axis_values: ["visible", "archived"],
      default_projection: "visible_only",
      archived_surface: "archived_tasks_library",
      archived_surface_scope: "same_agent_then_project_scope",
      saved_status_view_allowed: false,
      status_filter_may_include_visibility: false,
      archive_action_id: "work_item_visibility_set",
      restore_action_id: "work_item_visibility_set",
      archive_payload: { visibility_state: "archived" },
      restore_payload: { visibility_state: "visible" },
      expected_generation_source: "item.visibility.generation",
      expected_generation_required_when_available: true,
      concurrency_token_source: "item.visibility.generation",
      refresh_after_mutation: "opl app state --profile fast --json",
      readback_required: true,
      generation_conflict_policy: "refresh_authoritative_projection_then_prompt_retry",
      local_storage_truth_allowed: false,
      archive_changes_business_lifecycle: false,
      archive_stops_execution: false,
      archive_deletes_evidence: false,
      archived_item_preserves_status_stage_usage: true,
      restore_returns_to_main_surface: true,
      stop_requires_separate_action: true,
      confirmation_required: true,
      confirmation_must_explain_archive_does_not_stop_work: true,
    },
    `${label} work_item_visibility`,
  );
  assertDeepEqualJson(
    userTaskStatus.must_not_default_display_terms,
    [
      "Temporal",
      "provider",
      "projection",
      "ref",
      "stage attempt",
      "ledger",
      "current_control_state",
    ],
    `${label} must_not_default_display_terms`,
  );
  if (userTaskStatus.refs_only !== true) {
    throw new Error(`${label} must be refs-only`);
  }
}

export function validateBeginnerFirstRunPresentation(presentation, label, expectedCoreItems) {
  if (presentation?.audience !== "beginner_non_technical_users") {
    throw new Error(`${label} must target beginner_non_technical_users`);
  }
  if (presentation.presentation_mode !== "simplified_first_run") {
    throw new Error(`${label} must use simplified_first_run presentation`);
  }
  if (presentation.primary_user_goal !== "enter_guid_now_or_complete_guided_setup_first") {
    throw new Error(`${label} must keep /guid explicitly available before readiness while preserving guided setup`);
  }
  assertIncludesAll(presentation.primary_steps, expectedCoreItems, `${label} primary steps`);
  for (const [field, expected] of Object.entries({
    advanced_progress_disclosure: "collapsed_or_secondary",
    background_maintenance_presentation: "collapsed_technical_non_blocking",
    technical_detail_policy: "hidden_until_expanded_or_error",
  })) {
    if (presentation[field] !== expected) {
      throw new Error(`${label}.${field} must be ${expected}`);
    }
  }
  const selfCheck = presentation.post_install_ai_self_check_entry;
  if (!selfCheck || typeof selfCheck !== "object") {
    throw new Error(`${label} must define post_install_ai_self_check_entry`);
  }
  for (const [field, expected] of Object.entries({
    trigger: "explicit ready entry after ready_to_launch first-run completion",
    target_route: "/guid",
    route_state: "postInstallSelfCheck",
    prompt_policy:
      "localized Codex CLI post-install self-check prompt describing target OPL working mode and repair path",
    mutation_policy: "diagnose_first_no_file_mutation_without_user_confirmation",
    release_gate_policy: "user_visible_entry_complements_non_blocking_codex_ai_self_check_receipt",
  })) {
    if (selfCheck[field] !== expected) {
      throw new Error(`${label}.post_install_ai_self_check_entry.${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    selfCheck.target_state_checks,
    [
      "codex_cli_callable",
      "ui_language_policy",
      "session_scoped_opl_app_context",
      "user_agents_md_respected_no_overwrite",
      "mas_mag_rca_routes_visible",
      "opl_meta_agent_capability_visible",
      "codex_skills_plugins_visible",
      "module_update_skill_plugin_continuity",
    ],
    `${label}.post_install_ai_self_check_entry target_state_checks`,
  );
}

export function validateOplFlowContext(context, label) {
  if (!context || typeof context !== "object") {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    flow_id: "opl-flow",
    source: "opl-flow-package-policy",
    policy_source_ref: "gaofeng21cn/opl-flow:contracts/workflow-policy.json",
    delivery: "package_installed_user_profile_only",
    user_agents_policy: "respect_user_agents_no_overwrite_detect_conflicts",
    language_policy: "follow_ui_locale_zh_only_when_ui_zh",
    app_role: "install_sync_diagnose_user_profile_only",
    dependency_policy: "full_bundles_opl_flow_requires_and_recommends_closure",
    migration_policy: "framework_executes_conflict_retirement_with_backup_receipt_and_rollback",
  })) {
    if (context[field] !== expected) {
      throw new Error(`${label}.${field} must be ${expected}`);
    }
  }
  for (const retiredField of ["ponytail_mode_routing", "optional_user_modes"]) {
    if (retiredField in context) throw new Error(`${label} must not retain ${retiredField}`);
  }
}
