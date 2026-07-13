import { assertDeepEqualJson } from './assertions.ts';
import {
  runtimeFirstPartyAgents,
  systemAttentionResponsibilityFields,
  workItemDetailDiagnosticSections,
  workItemDetailPrimarySections,
  workItemDetailSecondarySections,
  workItemPrimaryStateLabels,
} from './app-contract-constants.ts';

const runtimeCockpitProductContractRef =
  'contracts/app-gui-product-contract.json#pages.runtime_status.runtime_cockpit_product_contract';
const runtimeCockpitPageStateRef =
  'contracts/app-page-state-matrix.json#pages[id=runtime].runtime_view_model.runtime_cockpit_acceptance';
const workItemProjectionRef = 'contracts/app-runtime-bridge.json#work_item_projection';
const agentAvailabilityProjectionRef = 'contracts/app-runtime-bridge.json#agent_availability_projection';

const defaultLayerRequiredAnswers = [
  'selected_agent_and_project_scope',
  'user_cognitive_work_item_status',
  'current_and_next_stage',
  'next_action_and_owner',
  'runtime_and_telemetry_credibility',
];

const defaultListColumns = [
  'project_and_work_item',
  'status',
  'progress_and_next_step',
  'elapsed_and_tokens',
];

const savedViewIds = [
  'all',
  'automatically_advancing',
  'awaiting_user_decision',
  'system_attention',
  'delivered_or_paused',
  'stopped',
  'sync_pending',
];

const responsiveViewportWidths = [375, 768, 1024, 1440];

const responsiveLayoutByWidth = {
  '375': 'one_column',
  '768': 'two_columns',
  '1024': 'two_columns',
  '1440': 'four_columns',
};

const responsiveRequiredAssertions = [
  'scope_cascade_visible',
  'one_row_per_work_item',
  'semantic_column_reflow',
  'no_horizontal_page_overflow',
  'detail_progressive_disclosure',
];

const runtimeCockpitRequiredInvariants = [
  'collaboration_console_not_observability_dashboard',
  'work_item_projection_v2_required_axes',
  'agent_then_project_scope_work_items_excluded',
  'saved_views_status_only_no_agent_or_mas_view',
  'four_column_default_list_agent_as_secondary_label',
  'one_row_per_canonical_work_item',
  'framework_projected_primary_state_language',
  'system_attention_requires_complete_current_responsibility',
  'observed_token_usage_missing_never_zero_no_limit_progress',
  'detail_primary_secondary_diagnostic_hierarchy',
  'agent_availability_separate_full_names_collapsed_when_healthy',
  'thin_renderer_no_raw_ids_or_projection_inference',
  'responsive_layout_has_no_horizontal_page_overflow',
  'contract_framework_shell_and_live_evidence_accounted_separately',
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
      work_item_projection_ref: workItemProjectionRef,
      agent_availability_projection_ref: agentAvailabilityProjectionRef,
    },
    label,
  );
  assertDeepEqualJson(
    contract.default_layer_required_answers,
    defaultLayerRequiredAnswers,
    `${label}.default_layer_required_answers`,
  );

  assertExpectedFields(
    contract.scope_hierarchy,
    {
      mode: 'two_level_agent_then_project_cascade',
      work_item_scope_allowed: false,
    },
    `${label}.scope_hierarchy`,
  );
  assertExpectedFields(
    contract.scope_hierarchy?.agent_level,
    {
      all_option: 'all_agents',
      full_display_names_required: true,
    },
    `${label}.scope_hierarchy.agent_level`,
  );
  assertDeepEqualJson(
    contract.scope_hierarchy?.agent_level?.first_party_options,
    runtimeFirstPartyAgents,
    `${label}.scope_hierarchy.agent_level.first_party_options`,
  );
  assertExpectedFields(
    contract.scope_hierarchy?.project_level,
    {
      all_option: 'all_projects',
      source: 'canonical_project_registry_for_selected_agent',
      depends_on_selected_agent: true,
      work_item_options_allowed: false,
    },
    `${label}.scope_hierarchy.project_level`,
  );
  assertExpectedFields(
    contract.scope_hierarchy?.saved_views,
    {
      dimension: 'primary_state_only',
      agent_or_project_views_allowed: false,
    },
    `${label}.scope_hierarchy.saved_views`,
  );
  assertDeepEqualJson(
    contract.scope_hierarchy?.saved_views?.required_ids,
    savedViewIds,
    `${label}.scope_hierarchy.saved_views.required_ids`,
  );
  for (const forbidden of ['mas', 'med-autoscience', 'med_auto_science']) {
    if (!contract.scope_hierarchy?.saved_views?.forbidden_ids?.includes(forbidden)) {
      throw new Error(`${label}.scope_hierarchy.saved_views must forbid ${forbidden}`);
    }
  }

  assertDeepEqualJson(contract.default_list?.columns, defaultListColumns, `${label}.default_list.columns`);
  assertExpectedFields(
    contract.default_list,
    {
      agent_placement: 'secondary_label_under_identity',
      one_row_per_work_item: true,
      canonical_row_key: 'identity.work_item_id',
      dedupe_owner: 'framework_projection',
      shell_heuristic_deduplication_allowed: false,
    },
    `${label}.default_list`,
  );
  assertDeepEqualJson(
    contract.default_list?.responsive_acceptance?.viewport_widths_px,
    responsiveViewportWidths,
    `${label}.default_list.responsive_acceptance.viewport_widths_px`,
  );
  assertDeepEqualJson(
    contract.default_list?.responsive_acceptance?.layout_by_viewport,
    responsiveLayoutByWidth,
    `${label}.default_list.responsive_acceptance.layout_by_viewport`,
  );
  assertDeepEqualJson(
    contract.default_list?.responsive_acceptance?.required_assertions,
    responsiveRequiredAssertions,
    `${label}.default_list.responsive_acceptance.required_assertions`,
  );
  assertExpectedFields(
    contract.default_list?.responsive_acceptance,
    {
      desktop_layout: 'four_columns',
      narrow_layout: 'semantic_row_reflow',
      horizontal_page_overflow_allowed: false,
      text_overlap_allowed: false,
      evidence_mode: 'deterministic_static_fixture_playwright',
      screenshot_per_viewport_required: true,
      detail_drawer_screenshot_required: true,
    },
    `${label}.default_list.responsive_acceptance`,
  );

  assertDeepEqualJson(
    contract.primary_state_language?.labels_zh_cn,
    workItemPrimaryStateLabels,
    `${label}.primary_state_language.labels_zh_cn`,
  );
  assertExpectedFields(
    contract.primary_state_language,
    {
      projection_owner: 'opl_framework',
      shell_derivation_allowed: false,
      fallback_when_current_state_unavailable: 'sync_pending',
    },
    `${label}.primary_state_language`,
  );

  assertExpectedFields(
    contract.state_separation,
    {
      lifecycle_axis: 'work_item_projection.lifecycle',
      execution_axis: 'work_item_projection.execution',
      attention_axis: 'work_item_projection.attention',
      telemetry_axis: 'work_item_projection.telemetry',
      agent_availability_axis: 'agent_availability_projection.availability',
      combined_source_state_allowed: false,
      availability_may_infer_work_item_state: false,
      work_item_state_may_infer_availability: false,
    },
    `${label}.state_separation`,
  );

  assertDeepEqualJson(
    contract.system_attention?.required_fields,
    systemAttentionResponsibilityFields,
    `${label}.system_attention.required_fields`,
  );
  assertExpectedFields(
    contract.system_attention,
    {
      primary_state: 'system_attention',
      complete_responsibility_envelope_required: true,
      current_generation_required: true,
      currently_blocks_execution_required: true,
      empty_or_generic_state_allowed: false,
      incomplete_envelope_policy: 'keep_lifecycle_state_and_defer_diagnostics',
    },
    `${label}.system_attention`,
  );

  assertExpectedFields(
    contract.project_identity,
    {
      source: 'canonical_registered_project_identity',
      execution_history_may_define_identity: false,
      provider_or_attempt_may_define_identity: false,
      shell_fallback_to_active_project_allowed: false,
    },
    `${label}.project_identity`,
  );
  assertExpectedFields(
    contract.work_item_inventory,
    {
      source: 'canonical_agent_work_item_inventory',
      temporal_history_required: false,
      provider_attempt_history_required: false,
      fast_profile_must_preserve_every_work_item: true,
      missing_detail_may_drop_row: false,
      row_without_attempt_history_allowed: true,
    },
    `${label}.work_item_inventory`,
  );

  assertDeepEqualJson(
    contract.token_usage?.default_fields,
    ['telemetry.current_stage_tokens', 'telemetry.task_total_tokens'],
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
      configured_limit_present: false,
      progress_bar_allowed: false,
    },
    `${label}.token_usage`,
  );

  assertDeepEqualJson(
    contract.work_item_detail?.primary_sections,
    workItemDetailPrimarySections,
    `${label}.work_item_detail.primary_sections`,
  );
  assertDeepEqualJson(
    contract.work_item_detail?.secondary_sections,
    workItemDetailSecondarySections,
    `${label}.work_item_detail.secondary_sections`,
  );
  assertDeepEqualJson(
    contract.work_item_detail?.diagnostic_sections,
    workItemDetailDiagnosticSections,
    `${label}.work_item_detail.diagnostic_sections`,
  );
  assertExpectedFields(
    contract.work_item_detail,
    {
      primary_sections_visible_on_open: true,
      secondary_sections_default_collapsed: true,
      diagnostic_sections_default_collapsed: true,
      equal_weight_tab_wall_allowed: false,
    },
    `${label}.work_item_detail`,
  );

  assertExpectedFields(
    contract.agent_availability_panel,
    {
      purpose: 'agent_availability_only',
      full_names_required: true,
      all_healthy_state: 'collapsed_summary',
      task_counts_allowed: false,
      bare_fraction_allowed: false,
      mas_scholar_skills_role: 'med_autoscience_dependency_not_sixth_agent',
    },
    `${label}.agent_availability_panel`,
  );

  assertDeepEqualJson(
    contract.progressive_disclosure?.diagnostic_only,
    ['raw_ids', 'raw_logs', 'raw_refs', 'receipt_refs', 'provider_diagnostics', 'workflow_and_attempt_ids'],
    `${label}.progressive_disclosure.diagnostic_only`,
  );
  assertExpectedFields(
    contract.progressive_disclosure,
    {
      default_layer: 'decision_and_action_fields_only',
      raw_technical_fields_default_visible: false,
    },
    `${label}.progressive_disclosure`,
  );

  assertExpectedFields(
    contract.renderer_policy,
    {
      shell_role: 'thin_renderer',
      projection_inference_allowed: false,
      identity_inference_allowed: false,
      status_derivation_allowed: false,
      technical_execution_stage_may_replace_business_stage: false,
      raw_id_default_visibility: false,
    },
    `${label}.renderer_policy`,
  );

  assertDeepEqualJson(
    contract.evidence_accounting?.independent_dimensions,
    ['product_contract', 'framework_producer', 'shell_consumer', 'live_evidence'],
    `${label}.evidence_accounting.independent_dimensions`,
  );
  assertExpectedFields(
    contract.evidence_accounting,
    {
      contract_completion_implies_framework_producer: false,
      contract_completion_implies_shell_consumer: false,
      contract_completion_implies_live_evidence: false,
      focused_tests_imply_live_readiness: false,
    },
    `${label}.evidence_accounting`,
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
      work_item_projection_ref: workItemProjectionRef,
      agent_availability_projection_ref: agentAvailabilityProjectionRef,
      page_role: productContract?.role,
      scope_hierarchy: 'agent_then_project_work_items_excluded',
      one_row_per_work_item: true,
      raw_ids_default_visible: false,
      horizontal_page_overflow_allowed: false,
      viewport_evidence_mode: 'deterministic_static_fixture_playwright',
      viewport_screenshots_required: true,
      detail_progressive_disclosure_evidence_required: true,
      source_or_upstream_parity_may_override: false,
      feature_removal_or_weakening_allowed: false,
      contract_page_state_validator_tests_update_required: true,
    },
    label,
  );
  assertDeepEqualJson(acceptance.default_list_columns, defaultListColumns, `${label}.default_list_columns`);
  assertDeepEqualJson(
    acceptance.responsive_viewport_widths_px,
    responsiveViewportWidths,
    `${label}.responsive_viewport_widths_px`,
  );
  assertDeepEqualJson(
    acceptance.responsive_layout_by_width,
    responsiveLayoutByWidth,
    `${label}.responsive_layout_by_width`,
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
      runtime_contract_implies_framework_producer_complete: false,
      runtime_contract_implies_shell_consumer_complete: false,
      runtime_contract_implies_live_evidence_complete: false,
    },
    label,
  );
}
