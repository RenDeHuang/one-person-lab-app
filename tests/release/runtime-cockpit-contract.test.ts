import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateAppGuiProductContract } from '../../scripts/validate-active-shell/gui-product-contract-validator.ts';
import { validatePageStateMatrix } from '../../scripts/validate-active-shell/page-state-matrix-validator.ts';
import { validateRuntimeProgressPageDisplayPolicy } from '../../scripts/validate-active-shell/runtime-bridge-validator.ts';
import {
  validateAgentAvailabilityProjectionContract,
  validateRuntimeScopeProjectionContract,
  validateWorkItemRowIdentityFixture,
  validateWorkItemProjectionContract,
} from '../../scripts/validate-active-shell/shared-contract-validators.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

const validateGuiContract = (guiContract: any) => validateAppGuiProductContract(
  guiContract,
  readJson('contracts/app-release-channel.json'),
  readJson('contracts/app-install-exposure-policy.json'),
);

const validatePageState = (matrix: any, guiContract = readJson('contracts/app-gui-product-contract.json')) =>
  validatePageStateMatrix(matrix, readJson('contracts/app-shell-adapter.json'), guiContract);

const runtimeContract = () => readJson('contracts/app-gui-product-contract.json');
const runtimeBridge = () => readJson('contracts/app-runtime-bridge.json');

test('Runtime V2 product, projection, scope, availability, and page-state contracts are active', () => {
  const bridge = runtimeBridge();
  assert.doesNotThrow(() => validateGuiContract(runtimeContract()));
  assert.doesNotThrow(() => validatePageState(readJson('contracts/app-page-state-matrix.json')));
  assert.doesNotThrow(() => validateWorkItemProjectionContract(bridge.work_item_projection, 'test projection'));
  assert.doesNotThrow(() => validateRuntimeProgressPageDisplayPolicy(bridge));
  assert.doesNotThrow(() => validateRuntimeScopeProjectionContract(bridge.runtime_scope_projection, 'test scope'));
  assert.doesNotThrow(() => validateAgentAvailabilityProjectionContract(bridge.agent_availability_projection, 'test agents'));
});

test('WorkItemProjection V2 requires global item identity, all nine axes, and observed-only Token semantics', () => {
  for (const mutate of [
    (projection: any) => { projection.schema_version = 'work-item-projection.v1'; },
    (projection: any) => { projection.required_fields = projection.required_fields.filter((field: string) => field !== 'item_id'); },
    (projection: any) => { projection.required_fields = projection.required_fields.filter((field: string) => field !== 'attention'); },
    (projection: any) => { projection.field_contracts.attention.system_responsibility_required_fields = ['issue']; },
    (projection: any) => { projection.field_contracts.attention.system_attention_requires_current_generation = false; },
    (projection: any) => { projection.field_contracts.telemetry.missing_may_render_as_zero = true; },
    (projection: any) => { projection.field_contracts.telemetry.token_progress_bar_allowed = true; },
    (projection: any) => { projection.diagnostic_envelope_contract.diagnostics_items_field_required = false; },
    (projection: any) => { projection.diagnostic_envelope_contract.fast_profile_nonzero_count_with_empty_items_is_valid = false; },
    (projection: any) => { projection.diagnostic_envelope_contract.fast_profile_embedded_item_count_must_not_exceed_count = false; },
    (projection: any) => { projection.diagnostic_envelope_contract.valid_summary_only_preserves_projects_and_work_items = false; },
    (projection: any) => { projection.field_contracts.domain_detail_views.full_payload_in_fast_state_allowed = true; },
    (projection: any) => { projection.field_contracts.domain_detail_views.app_agent_id_branching_allowed = true; },
    (projection: any) => { projection.domain_detail_view_read_contract.app_may_submit_ref_or_path = true; },
    (projection: any) => { projection.domain_detail_view_read_contract.unchanged_response.not_modified = false; },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.edge_kinds.push('refutes'); },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.working_checkpoint_content_in_accepted_fields_allowed = true; },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.working_checkpoint_machine_only_fields = ['checkpoint_id']; },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.working_checkpoint_sources_and_basis_source = 'source_refs'; },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.machine_source_refs_default_visible = true; },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.v2_accepted_route_membership_fields = ['active_branch_node_refs']; },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.required_fields = projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.required_fields.filter((field: string) => field !== 'active_branch_node_refs'); },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.accepted_trajectory_fields = projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.accepted_trajectory_fields.filter((field: string) => field !== 'active_branch_node_refs'); },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.required_fields_by_schema['scientific-reasoning-map.v2'] = projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.required_fields_by_schema['scientific-reasoning-map.v2'].filter((field: string) => field !== 'active_branch_node_refs'); },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.required_fields_by_schema['scientific-reasoning-map.v1'].push('active_branch_node_refs'); },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.accepted_trajectory_fields_by_schema['scientific-reasoning-map.v2'] = projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.accepted_trajectory_fields_by_schema['scientific-reasoning-map.v2'].filter((field: string) => field !== 'active_branch_node_refs'); },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.medical_prose_policy.shell_may_translate = true; },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.current_branch_membership_source_by_schema['scientific-reasoning-map.v2'] = 'node.branch_id'; },
    (projection: any) => { projection.domain_detail_view_read_contract.payload_contracts.scientific_reasoning_map.v2_current_branch_membership_inference_allowed = true; },
  ]) {
    const projection = structuredClone(runtimeBridge().work_item_projection);
    mutate(projection);
    assert.throws(() => validateWorkItemProjectionContract(projection, 'mutated projection'));
  }
});

test('Runtime identity uses global item_id while mutation and readback use the full project tuple', () => {
  const rows = [
    {
      item_id: 'project-a:paper-001',
      identity: { agent_id: 'mas', project_id: 'project-a', work_item_id: 'paper-001' },
    },
    {
      item_id: 'project-b:paper-001',
      identity: { agent_id: 'mas', project_id: 'project-b', work_item_id: 'paper-001' },
    },
  ];
  assert.doesNotThrow(() => validateWorkItemRowIdentityFixture(
    rows,
    'cross-project local-id collision',
    { requireCrossProjectLocalIdCollision: true },
  ));

  const duplicateGlobalId = structuredClone(rows);
  duplicateGlobalId[1].item_id = duplicateGlobalId[0].item_id;
  assert.throws(() => validateWorkItemRowIdentityFixture(
    duplicateGlobalId,
    'duplicate global item id',
    { requireCrossProjectLocalIdCollision: true },
  ));

  const projectionMutations = [
    (projection: any) => { projection.field_contracts.identity.required_fields.push('generation'); },
    (projection: any) => { projection.field_contracts.identity.workspace_directory_rename_changes_project_id = false; },
    (projection: any) => { projection.row_identity_contract.canonical_row_key = 'identity.work_item_id'; },
    (projection: any) => { projection.row_identity_contract.detail_selection_key = 'identity.work_item_id'; },
    (projection: any) => { projection.row_identity_contract.duplicate_local_work_item_id_across_projects_allowed = false; },
    (projection: any) => { projection.visibility_mutation_contract.payload_required_fields = ['work_item_id', 'visibility']; },
    (projection: any) => { projection.visibility_mutation_contract.success_readback_selector = 'work_item_projection_v2.items[identity.work_item_id=payload.work_item_id]'; },
    (projection: any) => { projection.visibility_mutation_contract.success_readback_identity_fields = ['identity.work_item_id']; },
    (projection: any) => { projection.detail_layer_contract.selection_key = 'identity.work_item_id'; },
  ];
  for (const mutate of projectionMutations) {
    const projection = structuredClone(runtimeBridge().work_item_projection);
    mutate(projection);
    assert.throws(() => validateWorkItemProjectionContract(projection, 'mutated identity projection'));
  }
});

test('Runtime action localization uses semantic keys, one message_args object, owner, and concrete owner kinds', () => {
  for (const mutate of [
    (projection: any) => { projection.field_contracts.action.required_fields.push('title_args'); },
    (projection: any) => { projection.field_contracts.action.required_fields.push('summary_args'); },
    (projection: any) => { projection.field_contracts.action.required_fields = projection.field_contracts.action.required_fields.filter((field: string) => field !== 'message_args'); },
    (projection: any) => { projection.field_contracts.action.owner_kinds = ['user', 'framework', 'agent', 'system', 'none']; },
    (projection: any) => { projection.field_contracts.action.compatibility_fallback_fields.push('copy_locale'); },
    (projection: any) => { projection.action_envelope_contract.default_row_fields = ['kind', 'title_key', 'title_args', 'owner_kind']; },
  ]) {
    const projection = structuredClone(runtimeBridge().work_item_projection);
    mutate(projection);
    assert.throws(() => validateWorkItemProjectionContract(projection, 'mutated action projection'));
  }
});

test('Runtime bridge display policy uses global row identity and one semantic args object', () => {
  for (const mutate of [
    (bridge: any) => { bridge.runtime_progress_page_display_policy.task_deduplication_policy.canonical_row_key = 'identity.work_item_id'; },
    (bridge: any) => { bridge.runtime_progress_page_display_policy.task_deduplication_policy.duplicate_local_work_item_id_across_projects_allowed = false; },
    (bridge: any) => { bridge.runtime_progress_page_display_policy.default_field_allowlist.push('action.title_args'); },
    (bridge: any) => { bridge.runtime_progress_page_display_policy.next_step_copy_policy.source_priority = ['action.title_key + action.title_args']; },
    (bridge: any) => { bridge.runtime_progress_page_display_policy.next_step_copy_policy.compatibility_fallback_fields.push('action.copy_locale'); },
  ]) {
    const bridge = runtimeBridge();
    mutate(bridge);
    assert.throws(() => validateRuntimeProgressPageDisplayPolicy(bridge));
  }
});

test('Manual archive is Framework visibility with generation concurrency and preserved lifecycle', () => {
  for (const mutate of [
    (projection: any) => { projection.field_contracts.lifecycle.business_states = ['active', 'paused', 'stopped']; },
    (projection: any) => { projection.field_contracts.visibility.required_fields = ['state', 'generation', 'token']; },
    (projection: any) => { projection.field_contracts.visibility.generation_is_concurrency_token = false; },
    (projection: any) => { projection.visibility_mutation_contract.payload_optional_fields = ['expected_generation']; },
    (projection: any) => { projection.visibility_mutation_contract.concurrency_token_readback_source = 'item.visibility.token'; },
    (projection: any) => { projection.visibility_mutation_contract.visibility_mutation_may_change_lifecycle = true; },
    (projection: any) => { projection.visibility_mutation_contract.visibility_mutation_may_stop_execution = true; },
    (projection: any) => { projection.visibility_mutation_contract.local_storage_truth_allowed = true; },
  ]) {
    const projection = structuredClone(runtimeBridge().work_item_projection);
    mutate(projection);
    assert.throws(() => validateWorkItemProjectionContract(projection, 'mutated visibility projection'));
  }
});

test('Runtime scope is Agent then Project and saved views cannot duplicate MAS', () => {
  for (const mutate of [
    (scope: any) => { scope.agent_scope.first_party_options[0].agent_id = 'med-autoscience'; },
    (scope: any) => { scope.default_scope_levels.push('work_item'); },
    (scope: any) => { scope.project_scope.work_item_options_allowed = true; },
    (scope: any) => { scope.work_item_scope_allowed = true; },
    (scope: any) => { scope.saved_views.dimension = 'agent_and_status'; },
    (scope: any) => { scope.saved_views.forbidden_ids = []; },
  ]) {
    const scope = structuredClone(runtimeBridge().runtime_scope_projection);
    mutate(scope);
    assert.throws(() => validateRuntimeScopeProjectionContract(scope, 'mutated scope'));
  }
});

test('Runtime product rejects list, status, Stage popover, surface-boundary, and renderer regressions', () => {
  for (const mutate of [
    (contract: any) => { contract.default_list.columns.push('agent'); },
    (contract: any) => { contract.default_list.one_row_per_work_item = false; },
    (contract: any) => { contract.default_list.shell_heuristic_deduplication_allowed = true; },
    (contract: any) => { contract.default_list.responsive_acceptance.horizontal_page_overflow_allowed = true; },
    (contract: any) => { contract.default_list.responsive_acceptance.layout_by_viewport['1024'] = 'four_columns'; },
    (contract: any) => { contract.default_list.responsive_acceptance.screenshot_per_viewport_required = false; },
    (contract: any) => { contract.primary_state_language.labels_by_locale['zh-CN'].system_attention = '需要系统处理'; },
    (contract: any) => { contract.default_list.canonical_row_key = 'identity.work_item_id'; },
    (contract: any) => { contract.project_identity.workspace_directory_rename_changes_project_id = false; },
    (contract: any) => { contract.action_localization.required_semantic_fields.push('title_args'); },
    (contract: any) => { contract.work_item_visibility.visibility_required_fields = ['state', 'generation', 'token']; },
    (contract: any) => { contract.work_item_detail.selection_key = 'identity.work_item_id'; },
    (contract: any) => { contract.system_attention.required_fields = ['issue']; },
    (contract: any) => { contract.token_usage.missing_value_may_render_as_zero = true; },
    (contract: any) => { contract.token_usage.progress_bar_allowed = true; },
    (contract: any) => { contract.work_item_detail.primary_sections = ['timeline']; },
    (contract: any) => { contract.work_item_detail.secondary_sections = ['artifacts', 'timeline']; },
    (contract: any) => { contract.work_item_detail.diagnostic_sections = ['logs']; },
    (contract: any) => { contract.work_item_detail.delivered_stage_map_terminal_boundary.visible_stage_states.push('pending'); },
    (contract: any) => { contract.work_item_detail.delivered_stage_map_terminal_boundary.post_delivery_next_step_source = 'stage_map.next_action'; },
    (contract: any) => { contract.text_wrapping.ordinary_user_text_policy = 'arbitrary_character_boundaries'; },
    (contract: any) => { contract.text_wrapping.unbroken_technical_string_policy = 'always_break_anywhere'; },
    (contract: any) => { contract.agent_availability_routing.runtime_page_visible = true; },
    (contract: any) => { contract.stage_popover.current_attempt_default_row_visible = true; },
    (contract: any) => { contract.stage_popover.trigger_does_not_open_task_drawer = false; },
    (contract: any) => { contract.runtime_surface_exclusions.forbidden = []; },
    (contract: any) => { contract.renderer_policy.status_derivation_allowed = true; },
    (contract: any) => { contract.renderer_policy.technical_execution_stage_may_replace_business_stage = true; },
    (contract: any) => { contract.progressive_disclosure.raw_technical_fields_default_visible = true; },
    (contract: any) => { contract.progressive_disclosure.excluded_technical_detail_owner = '/runtime'; },
    (contract: any) => { contract.domain_detail_views.agent_id_branching_allowed = true; },
    (contract: any) => { contract.domain_detail_views.full_payload_in_fast_state_allowed = true; },
    (contract: any) => { contract.domain_detail_views.drawer_presentation.machine_fields_visible = true; },
    (contract: any) => { contract.domain_detail_views.full_canvas.horizontal_page_overflow_allowed = true; },
    (contract: any) => { contract.domain_detail_views.trajectory_layers.working_checkpoints.may_change_accepted_graph = true; },
    (contract: any) => { delete contract.domain_detail_views.full_canvas.working_checkpoint_status_copy.rejected; },
    (contract: any) => { contract.domain_detail_views.full_canvas.working_checkpoint_status_copy.rejected['zh-CN'] = '科学假设被否定'; },
    (contract: any) => { contract.domain_detail_views.trajectory_layers.working_checkpoints.rejected_status_semantics = 'scientific_hypothesis_refuted'; },
    (contract: any) => { contract.domain_detail_views.full_canvas.sources_and_basis_source = 'source_refs'; },
    (contract: any) => { contract.domain_detail_views.full_canvas.machine_source_refs_visible = true; },
    (contract: any) => { contract.domain_detail_views.trajectory_layers.accepted_trajectory.source_fields = ['nodes']; },
    (contract: any) => { contract.domain_detail_views.full_canvas.current_branch_membership_source_by_schema['scientific-reasoning-map.v2'] = 'node.branch_id'; },
    (contract: any) => { contract.domain_detail_views.full_canvas.v2_current_branch_membership_inference_allowed = true; },
    (contract: any) => { contract.domain_detail_views.full_canvas.content_order.reverse(); },
    (contract: any) => { contract.domain_detail_views.full_canvas.working_checkpoints_may_precede_accepted_map = true; },
    (contract: any) => { contract.domain_detail_views.medical_prose_policy.shell_may_rewrite = true; },
    (contract: any) => { contract.domain_detail_views.medical_prose_policy.app_may_summarize = true; },
  ]) {
    const gui = runtimeContract();
    mutate(gui.pages.runtime_status.runtime_cockpit_product_contract);
    assert.throws(() => validateGuiContract(gui));
  }
});

test('Agent availability stays independent, full-name, healthy-collapsed, and excludes Scholar Skills as an agent', () => {
  for (const mutate of [
    (projection: any) => { projection.first_party_agents[0].agent_id = 'med-autoscience'; },
    (projection: any) => { projection.first_party_agents[0].display_name = 'MAS'; },
    (projection: any) => { projection.first_party_agents.push({ agent_id: 'mas-scholar-skills', display_name: 'MAS Scholar Skills' }); },
    (projection: any) => { projection.all_healthy_panel_state = 'expanded'; },
    (projection: any) => { projection.bare_count_or_fraction_allowed = true; },
    (projection: any) => { projection.task_count_is_availability = true; },
  ]) {
    const projection = structuredClone(runtimeBridge().agent_availability_projection);
    mutate(projection);
    assert.throws(() => validateAgentAvailabilityProjectionContract(projection, 'mutated agents'));
  }
});

test('Runtime completion accounting cannot promote contract work into producer, Shell, or live completion', () => {
  for (const mutate of [
    (contract: any) => { contract.evidence_accounting.contract_completion_implies_framework_producer = true; },
    (contract: any) => { contract.evidence_accounting.contract_completion_implies_shell_consumer = true; },
    (contract: any) => { contract.evidence_accounting.contract_completion_implies_live_evidence = true; },
    (contract: any) => { contract.evidence_accounting.focused_tests_imply_live_readiness = true; },
  ]) {
    const gui = runtimeContract();
    mutate(gui.pages.runtime_status.runtime_cockpit_product_contract);
    assert.throws(() => validateGuiContract(gui));
  }
});

test('Runtime page-state rejects removal or weakening of V2 acceptance', () => {
  for (const mutate of [
    (matrix: any) => { matrix.acceptance_boundary.runtime_contract_implies_live_evidence_complete = true; },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.runtime_cockpit_acceptance.required_invariants = [];
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.runtime_cockpit_acceptance.one_row_per_work_item = false;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.runtime_cockpit_acceptance.raw_ids_default_visible = true;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.runtime_cockpit_acceptance.horizontal_page_overflow_allowed = true;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.runtime_cockpit_acceptance.responsive_layout_by_width['375'] = 'two_columns';
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.runtime_cockpit_acceptance.viewport_screenshots_required = false;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.runtime_cockpit_acceptance.stage_popover_trigger_opens_drawer = true;
    },
    (matrix: any) => {
      const acceptance = matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.runtime_cockpit_acceptance;
      acceptance.required_invariants = acceptance.required_invariants.filter((value: string) => value !== 'delivered_stage_map_completed_history_only_action_envelope_next_step');
    },
    (matrix: any) => {
      const acceptance = matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.runtime_cockpit_acceptance;
      acceptance.required_invariants = acceptance.required_invariants.filter((value: string) => value !== 'ordinary_text_normal_word_boundary_technical_tokens_emergency_break_only');
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.work_item_visibility_state_matrix.mutation.payload_required_fields = ['work_item_id', 'visibility'];
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.work_item_visibility_state_matrix.mutation.readback_identity_fields = ['identity.work_item_id'];
    },
    (matrix: any) => {
      const states = matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.work_item_visibility_state_matrix.page_states;
      states.find((state: any) => state.id === 'stale_generation_conflict').when = 'generation_conflict';
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.domain_detail_view.agent_id_branching_allowed = true;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.domain_detail_view.states = [];
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.domain_detail_view.scientific_reasoning.working_checkpoints_may_change_accepted_graph = true;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.domain_detail_view.scientific_reasoning.rejected_checkpoint_may_imply_scientific_refutation = true;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.domain_detail_view.scientific_reasoning.sources_and_basis_source = 'source_refs';
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.domain_detail_view.scientific_reasoning.machine_source_refs_visible = true;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.domain_detail_view.scientific_reasoning.current_branch_membership_source_by_schema['scientific-reasoning-map.v2'] = 'node.branch_id';
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.domain_detail_view.scientific_reasoning.v2_current_branch_membership_inference_allowed = true;
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.domain_detail_view.scientific_reasoning.content_order.reverse();
    },
    (matrix: any) => {
      matrix.pages.find((page: any) => page.id === 'runtime').runtime_view_model.domain_detail_view.scientific_reasoning.working_checkpoints_may_precede_accepted_map = true;
    },
  ]) {
    const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
    mutate(matrix);
    assert.throws(() => validatePageState(matrix));
  }
});
