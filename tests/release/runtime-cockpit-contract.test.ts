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

test('Runtime product rejects list, status, detail, availability, and renderer regressions', () => {
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
    (contract: any) => { contract.work_item_detail.delivered_stage_map_terminal_boundary.visible_stage_states.push('pending'); },
    (contract: any) => { contract.work_item_detail.delivered_stage_map_terminal_boundary.post_delivery_next_step_source = 'stage_map.next_action'; },
    (contract: any) => { contract.text_wrapping.ordinary_user_text_policy = 'arbitrary_character_boundaries'; },
    (contract: any) => { contract.text_wrapping.unbroken_technical_string_policy = 'always_break_anywhere'; },
    (contract: any) => { contract.agent_availability_panel.task_counts_allowed = true; },
    (contract: any) => { contract.renderer_policy.status_derivation_allowed = true; },
    (contract: any) => { contract.renderer_policy.technical_execution_stage_may_replace_business_stage = true; },
    (contract: any) => { contract.progressive_disclosure.raw_technical_fields_default_visible = true; },
    (contract: any) => { contract.diagnostic_projection.diagnostics_items_field_required = false; },
    (contract: any) => { contract.diagnostic_projection.fast_profile_nonzero_count_with_empty_items_is_valid = false; },
    (contract: any) => { contract.diagnostic_projection.fast_profile_embedded_item_count_must_not_exceed_count = false; },
    (contract: any) => { contract.diagnostic_projection.valid_summary_only_preserves_projects_and_work_items = false; },
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
  ]) {
    const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
    mutate(matrix);
    assert.throws(() => validatePageState(matrix));
  }
});
