import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

test('App owns runtime bridge contract while active shell remains replaceable adapter', () => {
  const adapter = readJson('contracts/app-shell-adapter.json');
  const runtimeBridge = readJson('contracts/app-runtime-bridge.json');
  const pageMatrix = readJson('contracts/app-page-state-matrix.json');
  const runtimePage = pageMatrix.pages.find((page) => page.id === 'runtime');

  assert.equal(runtimeBridge.owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.purpose, 'runtime_bridge_abstraction');
  assert.equal(runtimeBridge.active_adapter, adapter.active_shell);
  assert.equal(runtimeBridge.adapter_role, 'replaceable_gui_shell_adapter');
  assert.equal(runtimeBridge.protocol_owner, 'one-person-lab');
  assert.equal(runtimeBridge.ui_contract_owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.default_adapter_repo, adapter.shell_source.owner_repo);
  assert.equal(runtimeBridge.default_adapter_path, adapter.shell_root);
  assert.equal(runtimeBridge.summary_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.refresh_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.default_operator_payload, 'compact_owner_delta_projection');
  assert.equal(runtimeBridge.full_state_command, 'opl app state --profile full --json');
  assert.equal(runtimeBridge.full_state_policy, 'diagnostic_or_release_evidence_only');
  assert.equal(runtimeBridge.full_detail_command, 'opl runtime app-operator-drilldown --detail full --json');
  assert.deepEqual(runtimeBridge.default_read_surface_policy, {
    default_projection: 'opl_compact_owner_delta_projection',
    source_path: 'app_state.operator.default_read_surface_policy',
    first_screen_answers: [
      'next_safe_action_or_none',
      'current_owner',
      'required_delta',
      'accepted_return_shapes',
      'readiness_false_flags',
      'count_summary',
    ],
    full_detail_policy: 'explicit_full_detail_or_lazy_diagnostic_only',
    raw_refs_policy: 'raw_refs_require_explicit_full_detail',
    full_detail_auto_poll: false,
    shell_must_not_use_full_drilldown_as_normal_state: true,
    shell_must_not_derive_layout_from_raw_runtime_projection: true,
    forbidden_default_state_fields: [
      'runtime_tray_snapshot',
      'raw_evidence_envelope',
      'stage_replay_packet_body',
      'private_residue_inventory_body',
      'provider_internal_ledger_body',
    ],
  });
  assert.equal(runtimeBridge.action_command, 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json');
  assert.deepEqual(runtimeBridge.command_resolution_policy, {
    owner: 'one-person-lab-app',
    adapter_responsibility: 'resolve_healthy_opl_cli_before_running_declared_surfaces',
    managed_opl_priority: 'prefer_only_when_shim_targets_existing_cli_payload',
    broken_managed_shim_policy: 'skip_and_fall_through_to_system_opl',
    system_opl_fallback_paths: [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ],
    must_not: [
      'let stale managed Node opl shims shadow a healthy system opl',
      'rewrite App runtime truth from shell-private state',
      'treat missing managed bootstrap artifacts as first-run UI truth',
    ],
    regression:
      'packaged first-run must expose the /guid ready entry when opl system initialize --json reports ready_to_launch=true even if a stale managed opl shim exists',
  });
  assert.deepEqual(runtimeBridge.live_conformance_gate, {
    owner: 'one-person-lab-app',
    producer_owner: 'one-person-lab',
    mode: 'explicit_env_opt_in',
    default_enforcement: 'disabled',
    enable_env: 'OPL_APP_LIVE_CONFORMANCE',
    opl_root_env: 'OPL_APP_LIVE_OPL_ROOT',
    action_fixture_env: 'OPL_APP_LIVE_ACTION_FIXTURE',
    opl_bin: './bin/opl',
    fast_state_command: './bin/opl app state --profile fast --json',
    full_state_command: './bin/opl app state --profile full --json',
    action_dry_run_command: './bin/opl app action execute --action <fixture> --dry-run --json',
    fast_state_max_bytes: 500000,
    required_state_schema: 'opl_app_state.v1',
    golden_fast_state_fixture: 'contracts/fixtures/opl-app-state-fast.fixture.json',
    state_schema_paths: [
      'app_state.schema_version',
      'app_state.surface_kind',
      'app_state.schema',
      'app_state.surface',
      'schema',
      'surface',
    ],
    app_role: 'protocol_conformance_consumer',
    assertions: [
      'fast App state command returns JSON',
      'full App state command returns JSON',
      'dry-run App action command returns JSON',
      'fast App state output stays below 500KB',
      'fast App state declares opl_app_state.v1 schema or surface',
    ],
    forbidden_authority: [
      'runtime_truth',
      'provider_implementation',
      'domain_truth',
      'domain_quality_verdict',
      'domain_artifact_authority',
    ],
  });
  assert.equal(runtimeBridge.projection_sources.primary, 'app_state.operator user task status projection');
  assert.equal(runtimeBridge.projection_sources.provider, 'runtime_tray_snapshot.app_operator_drilldown.current_control_state.states.provider_run');
  assert.equal(runtimeBridge.projection_sources.actions, 'app_state.actions');
  assert.equal(runtimeBridge.projection_sources.full_detail, 'runtime_tray_snapshot.app_operator_drilldown');
  assert.equal(runtimeBridge.projection_sources.policy, 'user_task_status_from_app_state_project_refs_provider_projection_diagnostic_only');
  assert.deepEqual(runtimeBridge.user_task_status_projection, {
    source: 'app_state.operator.workbench.summary_cards + app_state.operator.workbench.activity_center + app_state.operator.workbench.task_drilldowns + app_state.operator.visual_ref_groups.active_project_refs',
    authority: 'opl_framework_refs_only_user_task_projection',
    display_policy: 'user_task_status_first_provider_projection_diagnostic_only',
    default_user_question:
      'How many tasks are running, how many projects or tasks are active or queued, how many need attention, and what is each task\'s current step?',
    summary_fields: [
      'running_task_count',
      'active_project_count',
      'queued_project_count',
      'attention_count',
    ],
    task_fields: [
      'task_id',
      'title',
      'status',
      'stage',
      'progress_label',
      'next_step',
      'owner',
      'last_progress',
    ],
    count_policies: {
      running_task_count: 'count user tasks projected as actively running or advancing, never raw provider attempts',
      active_project_count: 'count active user-visible project lines from the framework project-line projection',
      queued_project_count: 'count queued or waiting user-visible project/task lines without claiming active worker runs',
      attention_count: 'count user-visible blockers, human gates, failed safe actions, or owner attention states',
    },
    running_state_policy:
      'only explicit running, in_progress, or advancing status/state counts as running; active_run_id alone is context, not liveness proof',
    progress_label_policy:
      'render framework progress classification and stage labels as human task progress labels without exposing raw projection or ledger names',
    diagnostic_source_policy: 'provider/projection/ref/ledger/current_control_state details stay secondary and are not the default page language',
    must_not_default_display_terms: [
      'Temporal',
      'provider',
      'projection',
      'ref',
      'stage attempt',
      'ledger',
      'current_control_state',
    ],
    refs_only: true,
    app_role: 'display_only_user_task_status_consumer',
  });
  assert.equal(runtimeBridge.operator_summary_drilldown_command, 'opl runtime app-operator-drilldown --json');
  assert.deepEqual(runtimeBridge.running_task_projection, {
    source: 'runtime_tray_snapshot.app_operator_drilldown.current_control_state.summary + current_control_state.states',
    command: 'opl runtime app-operator-drilldown --json',
    authority: 'opl_framework_provider_attempt_projection',
    display_policy: 'diagnostic_only_no_provider_attempt_count_as_user_running_task_count',
    user_visible_grain: 'domain_and_active_execution_summary_until_domain_project_projection_is_available',
    active_execution_filter:
      'states where running_provider_attempt is true and provider_run.provider_status or current_attempt_state is running',
    diagnostic_provider_ref_policy:
      'running_provider_attempt_count may include checkpointed provider refs and must not be displayed as the user-visible running task count',
    required_fields: [
      'current_control_state.states[].running_provider_attempt',
      'current_control_state.states[].provider_run.provider_status',
      'current_control_state.states[].current_attempt_state',
      'running_provider_attempt_count',
      'running_provider_attempt_domain_ids',
      'running_provider_attempt_task_kinds',
      'latest_running_provider_heartbeat_at',
      'running_provider_attempt_summary_policy',
    ],
    allowed_derivation_sources: [
      'family_runtime_queue_task',
      'stage_attempt_ledger',
      'provider_run_projection',
    ],
    forbidden_sources: [
      'app_state.operator.workbench.domain_lane_map',
      'app_state.operator.workbench.task_drilldowns when active_stage_id is module_runtime',
      'app_state.modules',
      'module_runtime dirty state',
      'repo/worktree diagnostics',
      'assistant cards',
      'domain lane card counts',
    ],
    app_role: 'secondary_diagnostic_running_activity_consumer',
  });
  assert.deepEqual(runtimeBridge.project_progress_projection.active_project_line_projection, {
    source: 'app_state.operator.workbench.activity_center.active_projects + app_state.operator.visual_ref_groups.active_project_refs',
    authority: 'opl_framework_refs_only_project_line_projection',
    display_policy: 'active_project_line_count_can_include_queued_or_escalated_owner_handled_lines_without_active_worker_run',
    status_preservation_required: true,
    project_group_expansion_policy: {
      running_group_default: 'expanded',
      attention_group_default: 'visible_when_nonempty',
      inactive_group_default: 'collapsed',
      inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
      inactive_summary_fields: ['count', 'status', 'next_visible_step'],
    },
    required_fields: [
      'task_id',
      'title',
      'state',
      'status',
      'study_id',
      'active_run_id',
      'next_visible_step',
    ],
    must_not_claim: [
      'active_worker_run',
      'provider_execution_running',
      'domain_ready',
      'paper_quality_ready',
    ],
  });
  assert.equal(runtimeBridge.authority_boundary.shell_adapter_can_own_runtime_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_own_runtime_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_write_domain_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_read_artifact_body, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_read_memory_body, false);
  assert.equal(runtimeBridge.replacement_policy.runtime_protocol_stable_across_shell_replacement, true);
  assert.equal(runtimePage.runtime_view_model.bridge_contract, 'contracts/app-runtime-bridge.json');
  assert.equal(adapter.runtime_bridge_contract, 'contracts/app-runtime-bridge.json');
});

test('Runtime page classifies deliverable progress separately from platform repair deltas', () => {
  const runtimeBridge = readJson('contracts/app-runtime-bridge.json');
  const pageMatrix = readJson('contracts/app-page-state-matrix.json');
  const fixture = readJson('contracts/fixtures/opl-app-state-fast.fixture.json');
  const runtimePage = pageMatrix.pages.find((page) => page.id === 'runtime');
  const projectProgress = runtimePage.runtime_view_model.project_progress;
  const bridgeProjectProgress = runtimeBridge.project_progress_projection;
  const progressDelta = runtimePage.runtime_view_model.progress_delta;
  const bridgeProgressDelta = runtimeBridge.progress_delta_projection;
  const taskDrilldown = fixture.app_state.operator.workbench.task_drilldowns.find(
    (task) => task.task_id === 'medautoscience',
  );

  assert.ok(projectProgress, 'runtime page must declare project progress display contract');
  assert.ok(bridgeProjectProgress, 'runtime bridge must declare project_progress_projection');
  assert.ok(progressDelta, 'runtime page must declare progress_delta display contract');
  assert.ok(bridgeProgressDelta, 'runtime bridge must declare progress_delta_projection');
  assert.ok(taskDrilldown, 'fixture must include medautoscience task drilldown');
  assert.deepEqual(bridgeProjectProgress, {
    source: 'app_state.operator.workbench.task_drilldowns',
    authority: 'opl_framework_shared_project_progress_projection',
    display_policy: 'project_progress_refs_secondary_no_module_runtime_dirty_as_project',
    required_fields: [
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
    optional_user_fields: [
      'domain_label',
      'active_stage_label',
      'next_visible_step',
      'next_owner',
      'last_progress_at',
    ],
    diagnostics_treatment: 'secondary_disclosure',
    safe_actions_treatment: 'secondary_operator_disclosure',
    active_project_line_projection: {
      source: 'app_state.operator.workbench.activity_center.active_projects + app_state.operator.visual_ref_groups.active_project_refs',
      authority: 'opl_framework_refs_only_project_line_projection',
      display_policy: 'active_project_line_count_can_include_queued_or_escalated_owner_handled_lines_without_active_worker_run',
      status_preservation_required: true,
      project_group_expansion_policy: {
        running_group_default: 'expanded',
        attention_group_default: 'visible_when_nonempty',
        inactive_group_default: 'collapsed',
        inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
        inactive_summary_fields: ['count', 'status', 'next_visible_step'],
      },
      required_fields: [
        'task_id',
        'title',
        'state',
        'status',
        'study_id',
        'active_run_id',
        'next_visible_step',
      ],
      must_not_claim: [
        'active_worker_run',
        'provider_execution_running',
        'domain_ready',
        'paper_quality_ready',
      ],
    },
    app_role: 'display_only_project_progress_consumer',
    forbidden_running_task_sources: [
      'module_runtime dirty state',
      'domain lane active_task_count',
      'assistant purpose cards',
      'module readiness diagnostics',
    ],
  });
  assert.equal(projectProgress.source, bridgeProjectProgress.source);
  assert.equal(projectProgress.authority, bridgeProjectProgress.authority);
  assert.equal(projectProgress.display_policy, bridgeProjectProgress.display_policy);
  assert.deepEqual(projectProgress.required_fields, bridgeProjectProgress.required_fields);
  assert.deepEqual(projectProgress.optional_user_fields, bridgeProjectProgress.optional_user_fields);
  assert.equal(projectProgress.diagnostics_treatment, bridgeProjectProgress.diagnostics_treatment);
  assert.equal(projectProgress.safe_actions_treatment, bridgeProjectProgress.safe_actions_treatment);
  assert.deepEqual(projectProgress.active_project_line_projection, bridgeProjectProgress.active_project_line_projection);
  assert.deepEqual(bridgeProgressDelta, {
    source: 'app_state.operator.workbench.task_drilldowns.progress_delta_classification',
    authority: 'opl_framework_shared_progress_projection',
    display_policy: 'classification_only_no_domain_artifact_body',
    required_fields: [
      'deliverable_progress_delta',
      'platform_repair_delta',
      'progress_delta_classification',
    ],
    deliverable_progress_source: 'deliverable_progress_delta',
    platform_repair_source: 'platform_repair_delta',
    classification_source: 'progress_delta_classification',
    platform_repair_display_treatment: 'separate_infrastructure_repair_not_deliverable_progress',
    forbidden_delivery_claim_for_platform_repair: true,
    app_role: 'display_only_projection_consumer',
  });
  assert.equal(progressDelta.source, 'app_state.operator.workbench.task_drilldowns.progress_delta_classification');
  assert.equal(progressDelta.authority, 'opl_framework_shared_progress_projection');
  assert.equal(progressDelta.display_policy, 'classification_only_no_domain_artifact_body');
  assert.deepEqual(progressDelta.required_fields, [
    'deliverable_progress_delta',
    'platform_repair_delta',
    'progress_delta_classification',
  ]);
  assert.deepEqual(progressDelta.visible_classes, [
    'deliverable_progress',
    'platform_repair',
    'mixed',
    'typed_blocker',
    'human_gate',
    'stop_loss',
  ]);
  assert.equal(progressDelta.platform_repair_display_treatment, 'separate_infrastructure_repair_not_deliverable_progress');
  assert.equal(progressDelta.deliverable_progress_source, 'deliverable_progress_delta');
  assert.equal(progressDelta.platform_repair_source, 'platform_repair_delta');
  assert.equal(progressDelta.classification_source, 'progress_delta_classification');
  assert.equal(progressDelta.forbidden_delivery_claim_for_platform_repair, true);
  assert.equal(progressDelta.source, bridgeProgressDelta.source);
  assert.equal(progressDelta.authority, bridgeProgressDelta.authority);
  assert.equal(progressDelta.display_policy, bridgeProgressDelta.display_policy);
  assert.deepEqual(progressDelta.required_fields, bridgeProgressDelta.required_fields);
  assert.equal(progressDelta.deliverable_progress_source, bridgeProgressDelta.deliverable_progress_source);
  assert.equal(progressDelta.platform_repair_source, bridgeProgressDelta.platform_repair_source);
  assert.equal(progressDelta.classification_source, bridgeProgressDelta.classification_source);
  assert.equal(progressDelta.platform_repair_display_treatment, bridgeProgressDelta.platform_repair_display_treatment);
  assert.equal(
    progressDelta.forbidden_delivery_claim_for_platform_repair,
    bridgeProgressDelta.forbidden_delivery_claim_for_platform_repair,
  );

  assert.equal(taskDrilldown.progress_delta_classification, 'platform_repair');
  assert.deepEqual(taskDrilldown.deliverable_progress_delta, {
    count: 0,
    refs: [],
    domain_alias: 'task_deliverable_delta',
  });
  assert.deepEqual(taskDrilldown.platform_repair_delta, {
    count: 1,
    refs: ['/workspace/med-autoscience'],
    domain_alias: 'platform_repair_delta',
  });
  assert.equal(taskDrilldown.user_facing_progress_claim_allowed, false);
  assert.equal(taskDrilldown.progress_display_bucket, 'platform_repair');
  assert.equal(taskDrilldown.progress_display_label, 'Platform repair');
  assert.doesNotMatch(taskDrilldown.progress_display_label, /deliverable|paper|manuscript|submission/i);
});

test('Runtime page separates user-visible active project lines from active worker runs', () => {
  const pageMatrix = readJson('contracts/app-page-state-matrix.json');
  const runtimeBridge = readJson('contracts/app-runtime-bridge.json');
  const fixture = readJson('contracts/fixtures/opl-app-state-fast.fixture.json');
  const runtimePage = pageMatrix.pages.find((page) => page.id === 'runtime');
  const activeLineProjection = runtimePage.runtime_view_model.project_progress.active_project_line_projection;
  const activeProjectSummaryCard = fixture.app_state.operator.workbench.summary_cards.find(
    (card) => card.card_id === 'active_projects',
  );
  const activeProjects = fixture.app_state.operator.workbench.activity_center.active_projects;
  const visualActiveProjectRefs = fixture.app_state.operator.visual_ref_groups.active_project_refs;
  const ownerHandledProject = activeProjects.find((project) => ['queued', 'escalated'].includes(project.status));

  assert.deepEqual(activeLineProjection, runtimeBridge.project_progress_projection.active_project_line_projection);
  assert.deepEqual(runtimePage.runtime_view_model.default_attention.active_project_line_fields, [
    'app_state.operator.workbench.summary_cards[active_projects]',
    'app_state.operator.workbench.activity_center.active_projects',
    'app_state.operator.visual_ref_groups.active_project_refs',
  ]);
  assert.equal(
    runtimePage.runtime_view_model.default_attention.active_project_line_policy,
    'queued_or_escalated_owner_handled_project_lines_count_as_user_visible_active_projects_without_claiming_active_worker_run',
  );
  assert.deepEqual(runtimePage.runtime_view_model.default_attention.project_group_expansion_policy, {
    running_group_default: 'expanded',
    attention_group_default: 'visible_when_nonempty',
    inactive_group_default: 'collapsed',
    inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
    inactive_summary_fields: ['count', 'status', 'next_visible_step'],
  });
  assert.equal(
    runtimePage.runtime_view_model.user_task_status_projection.running_state_policy,
    'only explicit running, in_progress, or advancing status/state counts as running; active_run_id alone is context, not liveness proof',
  );
  assert.ok(activeProjectSummaryCard, 'fixture must carry an active_projects summary card');
  assert.ok(ownerHandledProject, 'fixture must carry a queued or escalated active project line');
  assert.ok(visualActiveProjectRefs.some((ref) => ref.task_id === ownerHandledProject.task_id));
  assert.equal(ownerHandledProject.status, 'queued');
  assert.equal(ownerHandledProject.active_run_id, null);
  assert.equal(ownerHandledProject.active_worker_run, false);
  assert.equal(ownerHandledProject.provider_execution_running, false);
  assert.equal(ownerHandledProject.domain_ready, false);
  assert.equal(ownerHandledProject.paper_quality_ready, false);
  assert.ok(ownerHandledProject.next_visible_step);
  assert.ok(activeLineProjection.required_fields.every((field) => Object.hasOwn(ownerHandledProject, field)));
});
