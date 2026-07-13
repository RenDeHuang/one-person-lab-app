import { assertDeepEqualJson } from './assertions.ts';

const runtimeCockpitProductContractRef =
  'contracts/app-gui-product-contract.json#pages.runtime_status.runtime_cockpit_product_contract';
const runtimeCockpitPageStateRef =
  'contracts/app-page-state-matrix.json#pages[id=runtime].runtime_view_model.runtime_cockpit_acceptance';

const defaultLayerRequiredAnswers = [
  'selected_scope',
  'user_cognitive_task_status',
  'responsible_agent_and_stage',
  'next_step_and_owner',
  'refresh_and_telemetry_credibility',
];

const systemAttentionRequiredFields = [
  'responsible_component',
  'issue',
  'repair_action',
  'impact',
  'expected_outcome',
];

const runtimeCockpitRequiredInvariants = [
  'collaboration_console_not_observability_dashboard',
  'default_layer_answers_scope_status_agent_stage_next_owner_and_credibility',
  'project_task_state_separate_from_agent_package_availability',
  'system_attention_is_actionable_and_complete',
  'canonical_workspace_identity_not_temporal_attempt_identity',
  'inventory_independent_of_temporal_history_and_fast_profile_complete',
  'observed_token_usage_missing_never_zero',
  'sidebar_full_names_availability_and_scoped_task_load',
  'raw_ids_logs_and_refs_advanced_or_detail_only',
];

function assertExpectedFields(actual, expected, label) {
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (actual?.[field] !== expectedValue) {
      throw new Error(`${label}.${field} must be ${expectedValue}`);
    }
  }
}

export function validateRuntimeCockpitProductContract(contract, label) {
  if (!contract || typeof contract !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  assertExpectedFields(
    contract,
    {
      owner: 'one-person-lab-app',
      role: 'user_agent_collaboration_control_console',
      observability_dashboard_allowed: false,
    },
    label,
  );
  assertDeepEqualJson(
    contract.default_layer_required_answers,
    defaultLayerRequiredAnswers,
    `${label}.default_layer_required_answers`,
  );

  assertExpectedFields(
    contract.state_separation,
    {
      project_task_state_axis: 'canonical_work_item_state',
      agent_package_availability_axis: 'canonical_agent_package_availability',
      combined_status_allowed: false,
      availability_may_infer_project_or_task_state: false,
      project_or_task_state_may_infer_availability: false,
    },
    `${label}.state_separation`,
  );

  assertDeepEqualJson(
    contract.system_attention?.required_fields,
    systemAttentionRequiredFields,
    `${label}.system_attention.required_fields`,
  );
  assertExpectedFields(
    contract.system_attention,
    {
      empty_or_generic_state_allowed: false,
      missing_field_policy: 'do_not_emit_system_attention_until_actionable_fields_are_projected',
      repair_action_policy: 'projected_repair_action_or_explicit_non_action_reason',
    },
    `${label}.system_attention`,
  );

  assertDeepEqualJson(
    contract.project_identity?.display_name_priority,
    [
      'registered_workspace_display_name',
      'canonical_workspace_name',
      'canonical_workspace_path_basename',
    ],
    `${label}.project_identity.display_name_priority`,
  );
  assertExpectedFields(
    contract.project_identity,
    {
      source: 'canonical_registered_workspace_or_path_identity',
      temporal_attempt_may_define_identity: false,
      provider_attempt_may_define_identity: false,
      stage_run_or_workflow_may_define_identity: false,
    },
    `${label}.project_identity`,
  );

  assertExpectedFields(
    contract.work_item_inventory,
    {
      source: 'canonical_work_item_inventory',
      temporal_history_required: false,
      provider_attempt_history_required: false,
      fast_profile_must_preserve_every_task_row: true,
      missing_detail_may_drop_task_row: false,
      row_without_attempt_history_allowed: true,
    },
    `${label}.work_item_inventory`,
  );

  assertDeepEqualJson(
    contract.token_usage?.default_fields,
    ['observed_current_stage_tokens', 'observed_task_total_tokens'],
    `${label}.token_usage.default_fields`,
  );
  assertExpectedFields(
    contract.token_usage,
    {
      observed_values_only: true,
      estimated_or_inferred_values_allowed: false,
      missing_value_requires_reason: true,
      missing_value_may_render_as_zero: false,
      zero_requires_observed_zero: true,
      budget_progress_without_observed_limit_allowed: false,
    },
    `${label}.token_usage`,
  );

  assertDeepEqualJson(
    contract.agent_package_sidebar?.availability_states,
    ['available', 'maintenance_required', 'not_installed'],
    `${label}.agent_package_sidebar.availability_states`,
  );
  assertDeepEqualJson(
    contract.agent_package_sidebar?.availability_labels_zh_cn,
    {
      available: '可用',
      maintenance_required: '需维护',
      not_installed: '未安装',
    },
    `${label}.agent_package_sidebar.availability_labels_zh_cn`,
  );
  assertDeepEqualJson(
    contract.agent_package_sidebar?.forbidden_bare_examples,
    ['0/2', '2/2'],
    `${label}.agent_package_sidebar.forbidden_bare_examples`,
  );
  assertExpectedFields(
    contract.agent_package_sidebar,
    {
      name_policy: 'full_human_readable_name',
      task_load_scope: 'current_selected_scope',
      task_load_label_zh_cn: '当前范围 {count} 个任务',
      bare_count_or_fraction_allowed: false,
    },
    `${label}.agent_package_sidebar`,
  );

  assertDeepEqualJson(
    contract.progressive_disclosure?.advanced_or_detail_only,
    [
      'raw_ids',
      'raw_logs',
      'raw_refs',
      'receipt_refs',
      'provider_diagnostics',
      'workflow_run_and_attempt_ids',
    ],
    `${label}.progressive_disclosure.advanced_or_detail_only`,
  );
  assertExpectedFields(
    contract.progressive_disclosure,
    {
      default_layer: 'decision_and_action_fields_only',
      raw_technical_fields_default_visible: false,
    },
    `${label}.progressive_disclosure`,
  );
}

export function validateRuntimeCockpitPageStateAcceptance(acceptance, productContract, label) {
  if (!acceptance || typeof acceptance !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  assertExpectedFields(
    acceptance,
    {
      product_contract_ref: runtimeCockpitProductContractRef,
      page_role: productContract?.role,
      source_or_upstream_parity_may_override: false,
      feature_removal_or_weakening_allowed: false,
      contract_page_state_validator_tests_update_required: true,
    },
    label,
  );
  assertDeepEqualJson(
    acceptance.required_invariants,
    runtimeCockpitRequiredInvariants,
    `${label}.required_invariants`,
  );
}

export function validateRuntimeCockpitPreservationPolicy(policy, label) {
  if (!policy || typeof policy !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  assertExpectedFields(
    policy,
    {
      product_contract_ref: runtimeCockpitProductContractRef,
      page_state_ref: runtimeCockpitPageStateRef,
      upstream_alignment_may_remove_or_weaken: false,
      replacement_must_preserve_required_answers: true,
    },
    label,
  );
  assertDeepEqualJson(
    policy.same_change_requirements,
    ['product_contract', 'page_state_acceptance', 'validators', 'tests'],
    `${label}.same_change_requirements`,
  );
}

export function validateRuntimeCockpitAcceptanceBoundary(boundary, label) {
  assertExpectedFields(
    boundary,
    {
      runtime_product_contract_ref: runtimeCockpitProductContractRef,
      runtime_upstream_alignment_may_remove_or_weaken: false,
      runtime_acceptance_requires_contract_page_state_validators_tests: true,
    },
    label,
  );
}
