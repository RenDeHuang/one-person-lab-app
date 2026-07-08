import {
  assert,
  fs,
  path,
  test,
  appRoot,
  expectedOrdinaryCockpitForbiddenTerms,
  expectedHomeActivityCenterForbiddenDisplays,
  expectedSettingsPageSections,
} from './helpers.ts';
import {
  validateArtifactNativeDrilldownFixture,
  validateArtifactNativeDrilldownProjectionContract,
  validateArtifactProvenanceBundleProjectionContract,
  validateOpenScienceAcceptedItemsFixture,
  validateRuntimeScopeProjectionContract,
  validateRefLevelFollowUpProjectionContract,
  validateStructuredResultPanelProjectionContract,
  validateTaskAwarenessProjectionContract,
  validateWorkflowSkillCandidateProjectionContract,
  validateWorkItemProjectionContract,
} from '../../../scripts/validate-active-shell/shared-contract-validators.ts';
import { assertIncludesAll } from '../../../scripts/validate-active-shell/assertions.ts';
import {
  actionEnvelopeKinds,
  runtimeAutomationStateValues,
  runtimePrimaryStateValues,
  runtimeScopeRequiredFields,
  taskRunProjectionV2FieldGroups,
  taskRunProjectionV2RequiredFields,
  workItemConditionFields,
  workItemDetailTabs,
  workItemProjectionRequiredFields,
} from '../../../scripts/validate-active-shell/app-contract-constants.ts';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

function assertNoAuthority(record: Record<string, unknown>, label: string) {
  for (const field of [
    'artifact_body_access',
    'domain_verdict_authority',
    'quality_verdict_authority',
    'readiness_authority',
    'owner_receipt_write_access',
  ]) {
    if (field in record) {
      assert.equal(record[field], false, `${label}.${field}`);
    }
  }
}

test('runtime page consumes OPL App/operator drilldown instead of App-owned runtime truth', () => {
  const activeShellContract = readJson('contracts/app-shell-adapter.json');
  const runtimeBridge = readJson('contracts/app-runtime-bridge.json');
  const guiProductContract = readJson('contracts/app-gui-product-contract.json');
  const guiRuntimeStatus = guiProductContract.pages?.runtime_status;
  const pageStateMatrix = readJson('contracts/app-page-state-matrix.json');
  const fastStateFixture = readJson('contracts/fixtures/opl-app-state-fast.fixture.json');
  const pageById = new Map(pageStateMatrix.pages.map((page: { id: string }) => [page.id, page]));
  const guidHomePage = pageById.get('guid_home') as Record<string, any>;
  const runtimePage = pageById.get('runtime') as Record<string, any>;
  const environmentPage = pageById.get('environment') as Record<string, any>;
  const settingsThemePage = pageById.get('settings_theme') as Record<string, any>;

  assert.equal(activeShellContract.runtime_bridge_contract, 'contracts/app-runtime-bridge.json');
  assert.equal(runtimeBridge.owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.active_adapter, activeShellContract.active_shell);
  assert.equal(runtimeBridge.protocol_owner, 'one-person-lab');
  assert.equal(runtimeBridge.ui_contract_owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.summary_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.refresh_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.full_state_policy, 'diagnostic_or_release_evidence_only');
  assert.equal(runtimeBridge.default_operator_payload, 'current_owner_delta');
  assert.equal('compatibility_operator_payload' in runtimeBridge, false);
  assert.equal(runtimeBridge.default_read_surface_policy.default_projection, 'opl_current_owner_delta');
  assert.equal(runtimeBridge.default_read_surface_policy.release_evidence_counts_as_release_ready, false);
  assert.equal(runtimeBridge.default_read_surface_policy.shell_must_not_use_full_drilldown_as_normal_state, true);
  assert.deepEqual(
    guiProductContract.framework_surfaces.canonical_state.default_read_surface_policy,
    runtimeBridge.default_read_surface_policy,
  );

  validateRuntimeScopeProjectionContract(runtimeBridge.runtime_scope_projection, 'Runtime bridge runtime_scope_projection');
  validateRuntimeScopeProjectionContract(
    runtimePage.runtime_view_model.runtime_scope_projection,
    'Runtime page runtime_scope_projection',
  );
  validateRuntimeScopeProjectionContract(
    guiRuntimeStatus.runtime_scope_projection,
    'GUI contract runtime_scope_projection',
  );

  const fastOperator = fastStateFixture.app_state.operator;
  const fixtureTask = fastOperator.workbench.task_drilldowns[0];
  assert.equal(fastOperator.operator_next_action_source, 'current_owner_delta');
  assert.equal(fastOperator.current_owner_delta_next_action.raw_worklist_can_drive_default_planning, false);
  assert.equal(fastOperator.ordinary_cockpit.authority_boundary.can_claim_app_release_ready, false);
  assert.equal(fastOperator.ordinary_cockpit.authority_boundary.can_claim_production_ready, false);
  assert.ok(fastOperator.ordinary_cockpit.developer_full_drilldown_only.includes('release_evidence'));
  assertNoAuthority(fixtureTask.artifact_or_blocker, 'fixtureTask.artifact_or_blocker');
  assertNoAuthority(fixtureTask.review_receipt, 'fixtureTask.review_receipt');
  assertNoAuthority(fixtureTask.action_receipt, 'fixtureTask.action_receipt');
  assertIncludesAll(Object.keys(fixtureTask), [
    'task_id',
    'title',
    'state',
    'active_stage_id',
    'progress_label',
    'next_visible_step',
    'next_owner',
    'stage_run_cockpit',
    'artifact_or_blocker',
    'review_receipt',
    'action_receipt',
    'workflow_refs',
    'connector_readiness_refs',
    'diagnostic_substrate_refs',
    'structured_result_panel',
    'artifact_provenance_card',
  ], 'runtime fixture task fields');
  assert.ok(fixtureTask.connector_readiness_refs.some((entry: { id: string }) => entry.id === 'opl_connect_literature'));
  assert.ok(fixtureTask.connector_readiness_refs.some((entry: { id: string }) => entry.id === 'opl_fabric_compute'));
  assert.ok(fixtureTask.diagnostic_substrate_refs.includes('opl://diagnostics/provider/temporal'));

  const artifactDrilldown = fixtureTask.artifact_native_drilldown;
  assertNoAuthority(artifactDrilldown, 'artifactDrilldown');
  assert.doesNotThrow(() =>
    validateArtifactNativeDrilldownFixture(artifactDrilldown, 'Runtime boundary fixture artifact native drilldown'),
  );
  const invalidArtifactBodyDrilldown = structuredClone(artifactDrilldown);
  invalidArtifactBodyDrilldown.provenance_bundle_refs[0].artifact_body = {};
  assert.throws(
    () => validateArtifactNativeDrilldownFixture(invalidArtifactBodyDrilldown, 'Runtime boundary fixture artifact native drilldown'),
    /artifact_body/,
  );
  const invalidReadinessDrilldown = structuredClone(artifactDrilldown);
  invalidReadinessDrilldown.readiness_authority = true;
  assert.throws(
    () => validateArtifactNativeDrilldownFixture(invalidReadinessDrilldown, 'Runtime boundary fixture artifact native drilldown'),
    /readiness_authority/,
  );

  const taskRunProjectionV2 = fastOperator.workbench.task_run_projection_v2;
  assert.equal(taskRunProjectionV2.refs_only, true);
  assert.equal(taskRunProjectionV2.authority_boundary.can_write_domain_truth, false);
  assert.equal(taskRunProjectionV2.authority_boundary.can_read_artifact_body, false);
  assert.equal(taskRunProjectionV2.authority_boundary.can_create_owner_receipt, false);
  assert.deepEqual(Object.keys(taskRunProjectionV2.tasks[0].evidence_cards[0]), taskRunProjectionV2FieldGroups.evidence_cards);
  assert.deepEqual(Object.keys(taskRunProjectionV2.tasks[0].action_cards[0]), taskRunProjectionV2FieldGroups.action_cards);
  assert.deepEqual(Object.keys(taskRunProjectionV2.tasks[0].resource_cards[0]), taskRunProjectionV2FieldGroups.resource_cards);
  for (const card of [
    ...taskRunProjectionV2.tasks[0].evidence_cards,
    ...taskRunProjectionV2.tasks[0].action_cards,
    ...taskRunProjectionV2.tasks[0].resource_cards,
  ]) {
    assert.equal('body' in card, false);
    assert.equal('artifact_body' in card, false);
    assert.equal('domain_verdict' in card, false);
  }

  assert.equal(
    fastStateFixture.app_state.settings_control_center.capability_task_awareness_refs.content_policy,
    'refs_only_no_skill_body_no_workflow_body',
  );
  assert.equal(
    fastStateFixture.app_state.settings_control_center.capability_task_awareness_refs.authority_boundary.can_create_owner_receipt,
    false,
  );
  assert.ok(
    fastStateFixture.app_state.settings_control_center.capability_task_awareness_refs.connector_readiness_refs.some(
      (entry: { id: string }) => entry.id === 'temporal_provider',
    ),
  );
  assert.ok(fastStateFixture.app_state.actions.some((action: { action_id: string }) => action.action_id === 'task_action_receipt_preview'));
  assert.ok(fastStateFixture.app_state.actions.some((action: { action_id: string }) => action.action_id === 'task_export_bundle_preview'));

  assert.equal(runtimeBridge.action_command, 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json');
  assert.deepEqual(runtimeBridge.canonical_state_display_action_map.required_semantic_areas, ['runtime', 'task', 'package']);
  for (const row of runtimeBridge.canonical_state_display_action_map.rows) {
    assert.equal(row.fallback_policy.can_claim_currentness, false);
    assert.equal(row.fallback_policy.can_mutate_without_app_action, false);
    assert.ok(row.forbidden_overclaim.includes('domain_readiness'));
  }
  assert.equal(runtimeBridge.live_conformance_gate.mode, 'explicit_env_opt_in');
  assert.equal(runtimeBridge.live_conformance_gate.default_enforcement, 'disabled');

  const runtimeDisplayPolicy = runtimeBridge.runtime_progress_page_display_policy;
  assert.equal(runtimeDisplayPolicy.page_role, 'project_runtime_cockpit_not_runtime_diagnostics');
  assertIncludesAll(runtimeDisplayPolicy.default_page_sections, [
    'top_scope_and_refresh',
    'freshness_bar',
    'kpi_row',
    'main_task_grouped_list',
    'right_module_status',
    'right_advanced_information_disclosure',
  ], 'Runtime display default sections');
  assertIncludesAll(runtimeDisplayPolicy.default_field_allowlist, [
    'project_display_name',
    'work_item_display_name',
    'agent_display_name',
    'primary_state_label',
    'automation_state_label',
    'next_visible_step',
    'next_owner',
  ], 'Runtime display default field allowlist');
  assert.equal(runtimeDisplayPolicy.default_label_policy.raw_identifier_default_visible, false);
  assertIncludesAll(runtimeDisplayPolicy.advanced_only_fields, [
    'raw_proof_ref',
    'receipt_refs',
    'stage_attempt_id',
    'full_drilldown',
  ], 'Runtime display advanced-only fields');

  assert.doesNotThrow(() =>
    validateWorkItemProjectionContract(runtimeBridge.work_item_projection, 'Runtime bridge WorkItemProjection'),
  );
  assert.deepEqual(runtimeBridge.work_item_projection.required_fields, workItemProjectionRequiredFields);
  assert.deepEqual(runtimeBridge.work_item_projection.condition_contract.required_fields, workItemConditionFields);
  assert.deepEqual(runtimeBridge.work_item_projection.action_envelope_contract.action_kinds, actionEnvelopeKinds);
  assert.deepEqual(runtimeBridge.work_item_projection.detail_layer_contract.default_tabs, workItemDetailTabs);
  assertNoAuthority(runtimeBridge.work_item_projection, 'runtimeBridge.work_item_projection');

  assert.equal(runtimeBridge.user_task_status_projection.authority, 'opl_framework_refs_only_user_task_projection');
  assert.deepEqual(runtimeBridge.user_task_status_projection.scope_fields, runtimeScopeRequiredFields);
  assert.deepEqual(runtimeBridge.user_task_status_projection.primary_state_values, runtimePrimaryStateValues);
  assert.deepEqual(runtimeBridge.user_task_status_projection.automation_state_values, runtimeAutomationStateValues);
  assertIncludesAll(runtimeBridge.user_task_status_projection.task_fields, [
    'task_id',
    'status',
    'stage_run_cockpit',
    'mas_owner_consumption_status',
    'artifact_or_blocker',
    'connector_readiness_refs',
    'structured_result_panel',
    'workflow_skill_candidate_refs',
  ], 'Runtime task fields');
  assert.equal(runtimeBridge.user_task_status_projection.refs_only, true);

  assert.doesNotThrow(() =>
    validateTaskAwarenessProjectionContract(runtimeBridge.task_awareness_projection, 'Runtime bridge task awareness projection'),
  );
  assert.equal(runtimeBridge.task_awareness_projection.schema_version, 2);
  assert.deepEqual(runtimeBridge.task_awareness_projection.required_task_ref_fields, taskRunProjectionV2RequiredFields);
  assert.equal(runtimeBridge.task_awareness_projection.domain_authority_policy, 'refs_only_no_domain_authority_no_artifact_body_no_domain_verdict');
  assertIncludesAll(runtimeBridge.task_awareness_projection.forbidden_claims, [
    'artifact_body',
    'owner_receipt_authority',
    'domain_readiness',
    'app_release_readiness',
    'family_production_readiness',
  ], 'Runtime task-awareness forbidden claims');
  const missingTaskRunIdentity = structuredClone(runtimeBridge.task_awareness_projection);
  missingTaskRunIdentity.required_task_ref_fields = missingTaskRunIdentity.required_task_ref_fields.filter(
    (field: string) => field !== 'task_identity',
  );
  assert.throws(
    () => validateTaskAwarenessProjectionContract(missingTaskRunIdentity, 'Runtime bridge task awareness projection'),
    /required_task_ref_fields/,
  );

  assertIncludesAll(runtimeBridge.current_task_slice_projection.conversation_fields, [
    'task_id',
    'status',
    'stage',
    ...taskRunProjectionV2RequiredFields,
    'gateway_status_ref',
    'structured_result_panel',
  ], 'Current task conversation fields');
  assertIncludesAll(runtimeBridge.current_task_slice_projection.inspector_fields, [
    'artifact_or_blocker',
    'review_receipt',
    'action_receipt',
    'workflow_refs',
    ...taskRunProjectionV2RequiredFields,
    'gateway_status_ref',
    'resource_source_refs',
    'artifact_provenance_card',
    'workflow_skill_candidate_refs',
  ], 'Current task inspector fields');
  assert.equal(runtimeBridge.current_task_slice_projection.independent_task_store_allowed, false);
  assert.equal(runtimeBridge.current_task_slice_projection.artifact_body_access, false);

  assert.equal(runtimeBridge.project_progress_projection.authority, 'opl_framework_shared_project_progress_projection');
  assertIncludesAll(runtimeBridge.project_progress_projection.required_fields, [
    'task_id',
    'active_stage_id',
    'progress_delta_classification',
    'deliverable_progress_delta',
    'platform_repair_delta',
  ], 'Runtime project progress required fields');
  assertIncludesAll(runtimeBridge.project_progress_projection.active_project_line_projection.must_not_claim, [
    'active_worker_run',
    'provider_execution_running',
    'domain_ready',
  ], 'Runtime project line forbidden claims');
  assert.ok(runtimeBridge.project_progress_projection.forbidden_running_task_sources.includes('module readiness diagnostics'));

  assert.equal(runtimeBridge.stage_run_cockpit_projection.derived_from, 'current_owner_delta');
  assertIncludesAll(runtimeBridge.stage_run_cockpit_projection.required_ref_fields, [
    'task_id',
    'stage_id',
    'owner',
    'readiness_false_flag_refs',
  ], 'Stage run cockpit required refs');
  assertIncludesAll(runtimeBridge.stage_run_cockpit_projection.forbidden_claims, [
    'runtime_truth',
    'domain_truth',
    'owner_receipt_authority',
    'domain_readiness',
    'app_release_readiness',
  ], 'Stage run cockpit forbidden claims');

  assertNoAuthority(runtimeBridge.artifact_native_drilldown_projection, 'runtimeBridge.artifact_native_drilldown_projection');
  assert.doesNotThrow(() =>
    validateArtifactNativeDrilldownProjectionContract(
      runtimeBridge.artifact_native_drilldown_projection,
      'Runtime bridge Stage Artifact drilldown projection',
      { requireProvenanceBundle: true },
    ),
  );
  assertNoAuthority(runtimeBridge.artifact_provenance_bundle_projection, 'runtimeBridge.artifact_provenance_bundle_projection');
  assert.doesNotThrow(() =>
    validateArtifactProvenanceBundleProjectionContract(
      runtimeBridge.artifact_provenance_bundle_projection,
      'Runtime bridge Artifact Provenance Bundle projection',
    ),
  );
  assert.doesNotThrow(() =>
    validateStructuredResultPanelProjectionContract(
      runtimeBridge.structured_result_panel_projection,
      'Runtime bridge structured result panel projection',
    ),
  );
  assert.doesNotThrow(() =>
    validateRefLevelFollowUpProjectionContract(
      runtimeBridge.ref_level_follow_up_projection,
      'Runtime bridge ref-level follow-up projection',
    ),
  );
  assert.doesNotThrow(() =>
    validateWorkflowSkillCandidateProjectionContract(
      runtimeBridge.workflow_skill_candidate_projection,
      'Runtime bridge workflow/skill candidate projection',
    ),
  );
  assert.doesNotThrow(() =>
    validateOpenScienceAcceptedItemsFixture(
      taskRunProjectionV2.tasks[0],
      'Runtime boundary fixture OpenScience accepted item task',
    ),
  );

  assert.equal(runtimeBridge.provider_readiness_repair_projection.authority, 'opl_framework_provider_readiness_refs_projection');
  assert.equal(runtimeBridge.provider_readiness_repair_projection.domain_readiness_authority, false);
  assert.equal(runtimeBridge.provider_readiness_repair_projection.provider_readiness_authority, false);
  assertIncludesAll(runtimeBridge.provider_readiness_repair_projection.forbidden_claims, [
    'domain_readiness',
    'current_owner_delta_override',
    'app_release_readiness',
  ], 'Provider readiness repair forbidden claims');

  assert.equal(guidHomePage.machine_source, 'contracts/app-gui-product-contract.json#pages.guid_home + opl app state --profile fast --json');
  assert.equal(guidHomePage.home_view_model.authority, 'app_repo_owned_product_truth');
  assert.equal(guidHomePage.home_view_model.codex_cli_fixed_executor, true);
  assert.equal(guidHomePage.home_view_model.codex_default_model, 'gpt-5.5');
  assert.equal(guidHomePage.home_view_model.codex_default_reasoning_effort, 'xhigh');
  assert.equal(guidHomePage.home_view_model.permission_mode_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.conversation_backend_selector_visible, false);
  assert.deepEqual(guidHomePage.home_view_model.default_home_agent_packages, [
    'med-autoscience',
    'med-autogrant',
    'redcube-ai',
    'opl-bookforge',
  ]);
  assert.deepEqual(guidHomePage.home_view_model.activity_center.must_not_display, expectedHomeActivityCenterForbiddenDisplays);
  assertIncludesAll(guidHomePage.must_show, [
    'Codex CLI fixed executor experience',
    'Codex model selector defaulting to GPT-5.5',
    'workspace selector',
    'send action',
  ], 'Guid home must_show');
  assertIncludesAll(guidHomePage.must_not_show, [
    'executor selector on the home input',
    'retired Codex model choices',
    'nested input card frames',
    'domain artifact body in Home activity center',
  ], 'Guid home must_not_show');

  const ordinaryConversationPage = pageById.get('ordinary_conversation') as Record<string, any>;
  const rightContextInspectorPage = pageById.get('right_context_inspector') as Record<string, any>;
  assert.equal(ordinaryConversationPage.page_contract, 'ordinary_codex_conversation');
  assert.equal(ordinaryConversationPage.conversation_view_model.executor, 'codex_cli');
  assert.equal(ordinaryConversationPage.conversation_view_model.backend_selector_visible, false);
  assert.deepEqual(
    ordinaryConversationPage.conversation_view_model.current_task_slice.fields,
    runtimeBridge.current_task_slice_projection.conversation_fields,
  );
  assert.deepEqual(
    guiProductContract.ordinary_conversation.current_task_slice.fields,
    runtimeBridge.current_task_slice_projection.conversation_fields,
  );
  assert.deepEqual(
    rightContextInspectorPage.inspector_view_model.tabs.map((tab: { id: string }) => tab.id),
    ['files', 'artifacts', 'review', 'actions', 'capabilities', 'runtime', 'memory', 'automations', 'settings'],
  );
  assert.equal(rightContextInspectorPage.inspector_view_model.default_state, 'collapsed');
  assert.equal(rightContextInspectorPage.inspector_view_model.opens_on_user_request_only, true);
  assert.equal(rightContextInspectorPage.inspector_view_model.current_task_evidence.artifact_body_access, false);
  assert.equal(rightContextInspectorPage.inspector_view_model.current_task_evidence.domain_verdict_authority, false);

  for (const [pageContract, expected] of Object.entries(expectedSettingsPageSections)) {
    const page = pageById.get((expected as { matrixId: string }).matrixId) as Record<string, any>;
    assert.equal(page.page_contract, pageContract);
    assert.deepEqual(page.sections, (expected as { sections: string[] }).sections);
    assertIncludesAll(page.must_show, (expected as { mustShow: string[] }).mustShow, `${pageContract} must_show`);
    assertIncludesAll(page.must_not_show, (expected as { mustNotShow: string[] }).mustNotShow, `${pageContract} must_not_show`);
  }

  assert.equal(runtimePage.machine_source, 'opl app state --profile fast --json');
  assert.equal(runtimePage.diagnostic_source, 'opl runtime app-operator-drilldown --json');
  assert.equal(runtimePage.page_contract, 'runtime_user_task_status_first');
  assert.equal(runtimePage.runtime_view_model.default_mode, 'user_task_status_first');
  assert.equal(runtimePage.runtime_view_model.full_detail_policy, 'on_demand_only');
  assert.deepEqual(runtimePage.runtime_view_model.must_not_default_display_terms, expectedOrdinaryCockpitForbiddenTerms);
  assert.equal(runtimePage.runtime_view_model.action_queue.authority, 'framework_refs_only');
  assert.equal(runtimePage.runtime_view_model.user_task_status_projection.source, runtimeBridge.user_task_status_projection.source);
  assert.deepEqual(runtimePage.runtime_view_model.user_task_status_projection.task_fields, runtimeBridge.user_task_status_projection.task_fields);
  assert.equal(runtimePage.runtime_view_model.task_awareness_projection.source, 'contracts/app-runtime-bridge.json#task_awareness_projection');
  assert.equal(runtimePage.runtime_view_model.task_awareness_projection.refs_only, true);
  assert.equal(runtimePage.runtime_view_model.project_progress.authority, 'opl_framework_shared_project_progress_projection');
  assert.equal(runtimePage.runtime_view_model.progress_delta.authority, 'opl_framework_shared_progress_projection');
  assert.equal(runtimePage.runtime_view_model.provider_readiness_repair.domain_readiness_authority, false);
  assert.equal(runtimePage.runtime_view_model.authority_boundary.refs_only, true);
  assertIncludesAll(runtimePage.operator_evidence_path, [
    'user task status first OPL runtime status',
    'app_state.provider readiness refs',
    'provider readiness repair path for worker_not_ready and missing Temporal Search Attributes',
    'refs-only non-authority boundary',
  ], 'Runtime operator evidence path');
  assertIncludesAll(runtimePage.must_show, [
    'user task status first OPL runtime status',
    'running task count',
    'active project count',
    'safe app action dry-run/execute controls',
    'full evidence ledger only as secondary on-demand diagnostic',
  ], 'Runtime page must_show');
  assertIncludesAll(runtimePage.must_not_own, [
    'runtime truth',
    'provider implementation',
    'domain truth',
    'artifact body',
    'quality/readiness/export verdict',
    'action route authority',
  ], 'Runtime page must_not_own');

  assert.equal(pageStateMatrix.canonical_state_surface.default_command, 'opl app state --profile fast --json');
  assert.equal(pageStateMatrix.canonical_action_surface.command, 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json');
  assert.equal(pageStateMatrix.full_detail_exception.command, 'opl runtime app-operator-drilldown --detail full --json');
  assert.equal(environmentPage.machine_source, 'opl app state --profile fast --json');
  assert.ok(environmentPage.must_not_show.includes('Med Deep Scientist as a default module'));
  assert.equal(settingsThemePage.machine_source, 'opl app state --profile fast --json');
  assert.ok(settingsThemePage.must_show.includes('Default theme option'));
  assert.ok((pageById.get('about') as Record<string, any>).must_show.includes('OPL Framework revision'));
  assert.ok(pageStateMatrix.pages.every((page: { id: string }) => page.id !== 'docker_webui'));
});
