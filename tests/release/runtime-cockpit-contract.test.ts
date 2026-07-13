import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateAppGuiProductContract } from '../../scripts/validate-active-shell/gui-product-contract-validator.ts';
import { validatePageStateMatrix } from '../../scripts/validate-active-shell/page-state-matrix-validator.ts';
import {
  validateAgentAvailabilityProjectionContract,
  validateRuntimeScopeProjectionContract,
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
  assert.doesNotThrow(() => validateRuntimeScopeProjectionContract(bridge.runtime_scope_projection, 'test scope'));
  assert.doesNotThrow(() => validateAgentAvailabilityProjectionContract(bridge.agent_availability_projection, 'test agents'));
});

test('WorkItemProjection V2 requires all eight axes and observed-only Token semantics', () => {
  for (const mutate of [
    (projection: any) => { projection.schema_version = 'work-item-projection.v1'; },
    (projection: any) => { projection.required_fields = projection.required_fields.filter((field: string) => field !== 'attention'); },
    (projection: any) => { projection.field_contracts.attention.system_responsibility_required_fields = ['issue']; },
    (projection: any) => { projection.field_contracts.attention.system_attention_requires_current_generation = false; },
    (projection: any) => { projection.field_contracts.telemetry.missing_may_render_as_zero = true; },
    (projection: any) => { projection.field_contracts.telemetry.token_progress_bar_allowed = true; },
  ]) {
    const projection = structuredClone(runtimeBridge().work_item_projection);
    mutate(projection);
    assert.throws(() => validateWorkItemProjectionContract(projection, 'mutated projection'));
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
    (contract: any) => { contract.primary_state_language.labels_zh_cn.system_attention = '需要系统处理'; },
    (contract: any) => { contract.system_attention.required_fields = ['issue']; },
    (contract: any) => { contract.token_usage.missing_value_may_render_as_zero = true; },
    (contract: any) => { contract.token_usage.progress_bar_allowed = true; },
    (contract: any) => { contract.work_item_detail.primary_sections = ['timeline']; },
    (contract: any) => { contract.work_item_detail.secondary_sections = ['artifacts', 'timeline']; },
    (contract: any) => { contract.agent_availability_panel.task_counts_allowed = true; },
    (contract: any) => { contract.renderer_policy.status_derivation_allowed = true; },
    (contract: any) => { contract.renderer_policy.technical_execution_stage_may_replace_business_stage = true; },
    (contract: any) => { contract.progressive_disclosure.raw_technical_fields_default_visible = true; },
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
  ]) {
    const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
    mutate(matrix);
    assert.throws(() => validatePageState(matrix));
  }
});
