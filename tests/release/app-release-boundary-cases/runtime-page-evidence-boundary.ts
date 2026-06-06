import {
  assert,
  fs,
  path,
  test,
  appRoot,
  expectedRuntimeProjectProgressUserFields,
  expectedOrdinaryCockpitForbiddenTerms,
  expectedHomeActivityCenterForbiddenDisplays,
  expectedSettingsPageSections,
} from './helpers.ts';

test('runtime page consumes OPL App/operator drilldown instead of App-owned runtime truth', () => {
  const activeShellContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const runtimeBridge = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-runtime-bridge.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const guidHomePage = pageStateMatrix.pages.find((page) => page.id === 'guid_home');
  const runtimePage = pageStateMatrix.pages.find((page) => page.id === 'runtime');
  const environmentPage = pageStateMatrix.pages.find((page) => page.id === 'environment');
  const settingsThemePage = pageStateMatrix.pages.find((page) => page.id === 'settings_theme');
  const pageById = new Map(pageStateMatrix.pages.map((page) => [page.id, page]));

  assert.equal(activeShellContract.runtime_bridge_contract, 'contracts/app-runtime-bridge.json');
  assert.equal(runtimeBridge.owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.purpose, 'runtime_bridge_abstraction');
  assert.equal(runtimeBridge.active_adapter, activeShellContract.active_shell);
  assert.equal(runtimeBridge.adapter_role, 'replaceable_gui_shell_adapter');
  assert.equal(runtimeBridge.protocol_owner, 'one-person-lab');
  assert.equal(runtimeBridge.ui_contract_owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.default_adapter_repo, activeShellContract.shell_source.owner_repo);
  assert.equal(runtimeBridge.default_adapter_path, activeShellContract.shell_root);
  assert.equal(runtimeBridge.summary_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.refresh_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.default_operator_payload, 'current_owner_delta');
  assert.equal('compatibility_operator_payload' in runtimeBridge, false);
  assert.equal(runtimeBridge.full_state_command, 'opl app state --profile full --json');
  assert.equal(runtimeBridge.full_state_policy, 'diagnostic_or_release_evidence_only');
  assert.equal(runtimeBridge.full_detail_command, 'opl runtime app-operator-drilldown --detail full --json');
  assert.deepEqual(runtimeBridge.default_read_surface_policy, {
    default_projection: 'opl_current_owner_delta',
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
  assert.equal(runtimeBridge.live_conformance_gate.mode, 'explicit_env_opt_in');
  assert.equal(runtimeBridge.live_conformance_gate.default_enforcement, 'disabled');
  assert.equal(runtimeBridge.live_conformance_gate.enable_env, 'OPL_APP_LIVE_CONFORMANCE');
  assert.equal(runtimeBridge.live_conformance_gate.opl_root_env, 'OPL_APP_LIVE_OPL_ROOT');
  assert.equal(runtimeBridge.live_conformance_gate.action_fixture_env, 'OPL_APP_LIVE_ACTION_FIXTURE');
  assert.equal(runtimeBridge.live_conformance_gate.fast_state_max_bytes, 500000);
  assert.equal(runtimeBridge.live_conformance_gate.required_state_schema, 'opl_app_state.v1');
  assert.equal(runtimeBridge.live_conformance_gate.golden_fast_state_fixture, 'contracts/fixtures/opl-app-state-fast.fixture.json');
  assert.equal(runtimeBridge.projection_sources.primary, 'app_state.operator user task status projection');
  assert.equal(runtimeBridge.projection_sources.provider, 'runtime_tray_snapshot.app_operator_drilldown.current_control_state.states.provider_run');
  assert.equal(runtimeBridge.projection_sources.actions, 'app_state.actions');
  assert.equal(
    runtimeBridge.projection_sources.policy,
    'user_task_status_from_app_state_project_refs_provider_projection_diagnostic_only',
  );
  assert.deepEqual(runtimeBridge.user_task_status_projection, {
    source: 'app_state.operator.workbench.summary_cards + app_state.operator.workbench.activity_center + app_state.operator.workbench.task_drilldowns + app_state.operator.visual_ref_groups.active_project_refs',
    authority: 'opl_framework_refs_only_user_task_projection',
    display_policy: 'user_task_status_first_provider_projection_diagnostic_only',
    default_user_question:
      "How many tasks are running, how many projects or tasks are active or queued, how many need attention, and what is each task's current step?",
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
    diagnostic_source_policy:
      'provider/projection/ref/ledger/current_control_state details stay secondary and are not the default page language',
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
  assert.deepEqual(runtimePage.runtime_view_model.must_not_default_display_terms, expectedOrdinaryCockpitForbiddenTerms);
  assert.equal(
    runtimePage.runtime_view_model.ordinary_cockpit_surface_budget_ref,
    'contracts/app-gui-product-contract.json#ordinary_cockpit_surface_budget',
  );
  assert.deepEqual(runtimeBridge.project_progress_projection, {
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
  assert.deepEqual(runtimeBridge.stage_run_cockpit_projection, {
    source: 'app_state.operator.workbench.task_drilldowns.stage_run_cockpit + app_state.operator.workbench.task_drilldowns.stage_run_cockpit_summary',
    equivalent_source: 'app_state.operator.workbench.task_drilldowns.stage_run_current_owner_delta',
    derived_from: 'current_owner_delta',
    authority: 'opl_framework_current_owner_delta_refs_projection',
    display_policy: 'refs_only_stage_run_cockpit_display_guard_no_runtime_truth_claims',
    accepted_fast_state_fields: [
      'stage_run_cockpit',
      'stage_run_cockpit_summary',
      'stage_run_current_owner_delta',
    ],
    required_ref_fields: [
      'task_id',
      'stage_id',
      'owner',
      'next_visible_step',
      'accepted_return_shapes',
      'readiness_false_flag_refs',
    ],
    summary_fields: [
      'current_owner',
      'required_delta',
      'next_safe_action_ref',
      'artifact_or_blocker_refs',
    ],
    refs_only: true,
    app_role: 'display_only_stage_run_cockpit_consumer',
    forbidden_claims: [
      'runtime_truth',
      'domain_truth',
      'owner_receipt_authority',
      'typed_blocker_authority',
      'artifact_authority',
      'domain_readiness',
      'app_release_readiness',
      'family_production_readiness',
    ],
  });
  assert.deepEqual(runtimePage.runtime_view_model.project_progress.user_display_fields, expectedRuntimeProjectProgressUserFields);
  assert.equal(runtimeBridge.authority_boundary.shell_adapter_can_own_runtime_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_own_runtime_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_write_domain_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_read_artifact_body, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_read_memory_body, false);
  assert.equal(runtimeBridge.replacement_policy.runtime_protocol_stable_across_shell_replacement, true);

  assert.equal(
    guidHomePage.machine_source,
    'contracts/app-gui-product-contract.json#pages.guid_home + opl app state --profile fast --json',
  );
  assert.equal(guidHomePage.page_contract, 'guid_home_entry');
  assert.equal(guidHomePage.home_view_model.authority, 'app_repo_owned_product_truth');
  assert.equal(guidHomePage.home_view_model.implementation_carrier, 'opl-aion-shell');
  assert.equal(guidHomePage.home_view_model.primary_input_surface, 'single_card');
  assert.equal(guidHomePage.home_view_model.nested_input_card_frames_allowed, false);
  assert.equal(guidHomePage.home_view_model.appearance_default_css_theme_id, 'default-theme');
  assert.equal(guidHomePage.home_view_model.codex_cli_fixed_executor, true);
  assert.equal(guidHomePage.home_view_model.home_executor_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.codex_model_selector_visible, true);
  assert.equal(guidHomePage.home_view_model.codex_model_list_visible, true);
  assert.equal(guidHomePage.home_view_model.codex_model_policy, 'codex_cli_latest_strongest_model_selector_visible');
  assert.equal(guidHomePage.home_view_model.codex_default_model, 'gpt-5.5');
  assert.equal(guidHomePage.home_view_model.codex_default_reasoning_effort, 'xhigh');
  assert.equal(guidHomePage.home_view_model.codex_default_display_label, 'GPT-5.5（超高）');
  assert.equal(guidHomePage.home_view_model.codex_default_model_display_value, 'GPT-5.5（超高）');
  assert.equal(
    guidHomePage.home_view_model.codex_model_status_display_policy,
    'default_model_and_reasoning_status_with_visible_selector',
  );
  assert.equal(guidHomePage.home_view_model.codex_default_permission_mode, 'full-access');
  assert.equal(guidHomePage.home_view_model.permission_mode_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.conversation_backend_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.conversation_model_selector_visible, true);
  assert.equal(guidHomePage.home_view_model.conversation_permission_mode_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.codex_precise_model_display_policy, 'friendly_default_model_and_reasoning_visible');
  assert.deepEqual(guidHomePage.home_view_model.codex_frontier_model_preference_order, [
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.3-codex',
    'gpt-5.2',
  ]);
  assert.equal(guidHomePage.home_view_model.codex_user_can_override_model, true);
  assert.equal(guidHomePage.home_view_model.codex_user_can_restore_auto, true);
  assert.deepEqual(guidHomePage.home_view_model.home_layout, {
    default_mode: 'composer_first_chat_canvas',
    first_screen_policy: 'chat_first_no_dashboard_or_landing_copy',
    composer_position: 'pinned_bottom',
    composer_primary: true,
    workspace_selector_visible: true,
    purpose_entries_visible: ['research', 'grant', 'ppt'],
    workspace_session_rail_default_state: 'collapsed',
    right_context_inspector_default_state: 'collapsed',
    must_not_show: [
      'dashboard-first home',
      'explanatory landing page',
      'backend settings panel in composer',
      'AionUI Team nav entry',
      'AionUI Team page as ordinary App surface',
    ],
  });
  assert.deepEqual(guidHomePage.home_view_model.retired_codex_models_must_not_be_exposed, [
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ]);
  assert.equal(guidHomePage.home_view_model.state_source, 'opl app state --profile fast --json');
  assert.equal(guidHomePage.home_view_model.refresh_source, 'opl app state --profile fast --json');
  assert.equal(guidHomePage.home_view_model.executor_policy_ref, 'contracts/app-gui-product-contract.json#executor_policy');
  assert.equal(guidHomePage.home_view_model.assistant_source_ref, 'contracts/app-gui-product-contract.json#default_assistants');
  assert.equal(guidHomePage.home_view_model.codex_only_default, true);
  assert.equal(guidHomePage.home_view_model.executor_tab_visible_when_single_executor, false);
  assert.equal(guidHomePage.home_view_model.purpose_entry_source_ref, 'contracts/app-gui-product-contract.json#home_purpose_entries');
  assert.equal(
    guidHomePage.home_view_model.assistant_skill_profile_source_ref,
    'contracts/app-gui-product-contract.json#assistant_skill_profiles',
  );
  assert.equal(
    guidHomePage.home_view_model.conversation_pending_feedback_policy,
    'elapsed_seconds_visible_while_ai_processing_or_backend_running',
  );
  assert.equal(
    guidHomePage.home_view_model.conversation_model_status_display_policy,
    'same_model_status_and_selector_in_codex_conversation_composer',
  );
  assert.equal(
    guidHomePage.home_view_model.route_receipt_source_ref,
    'contracts/app-gui-product-contract.json#builtin_assistant_route_receipt_policy',
  );
  assert.deepEqual(guidHomePage.home_view_model.route_receipt_required_fields, [
    'route_kind',
    'executor',
    'assistant_id',
    'assistant_short_name',
    'source',
  ]);
  assert.deepEqual(guidHomePage.home_view_model.default_assistants, ['mas', 'mag', 'rca']);
  assert.deepEqual(guidHomePage.home_view_model.default_assistant_required_skills, {
    mas: ['mas'],
    mag: ['mag'],
    rca: ['rca'],
  });
  assert.deepEqual(guidHomePage.home_view_model.home_purpose_entries.map((entry) => entry.id), ['research', 'grant', 'ppt']);
  assert.deepEqual(guidHomePage.home_view_model.home_purpose_entries.map((entry) => entry.primary_label), ['科研', '基金', '演示']);
  assert.deepEqual(guidHomePage.home_view_model.home_purpose_entries.map((entry) => entry.target_assistant_id), ['mas', 'mag', 'rca']);
  assert.ok(guidHomePage.home_view_model.home_purpose_entries.every((entry) => entry.display_policy === 'purpose_first'));
  assert.equal(guidHomePage.home_view_model.activity_center.authority, 'app_owned_home_minimal_command_surface');
  assert.equal(guidHomePage.home_view_model.activity_center.source, 'not_rendered_on_ordinary_home');
  assert.equal(guidHomePage.home_view_model.activity_center.default_placement, 'not_rendered_on_ordinary_home');
  assert.equal(
    guidHomePage.home_view_model.activity_center.home_surface_policy,
    'ordinary_home_must_not_render_activity_center_or_continue_work_grid',
  );
  assert.deepEqual(guidHomePage.home_view_model.activity_center.allowed_home_runtime_context, []);
  assert.deepEqual(guidHomePage.home_view_model.activity_center.must_not_display, expectedHomeActivityCenterForbiddenDisplays);
  assert.equal(
    guidHomePage.home_view_model.activity_center.footer_quick_actions_policy,
    'do_not_render_feedback_star_web_icons_on_home',
  );
  for (const expected of [
    'Codex CLI fixed executor experience',
    'Codex model selector defaulting to GPT-5.5（超高）',
    'default model and reasoning status GPT-5.5（超高）',
    'conversation pending elapsed seconds while Codex is working',
    'purpose-first entries 科研/MAS, 基金/MAG, 演示/RCA',
    'selected assistant keeps purpose entry switcher visible',
    'assistant-scoped skill menu with required skill checked',
    'workspace selector',
    'file attachment control',
    'send action',
    'workspace/session rail collapsed by default',
    'right context inspector collapsed by default',
  ]) {
    assert.ok(guidHomePage.must_show.includes(expected), expected);
  }
  for (const forbidden of [
    'executor selector on the home input',
    'Aion CLI or Claude Code backend choices on the home input',
    'retired Codex model choices on the home input',
    'permission mode selector on the home input',
    'backend or permission selectors after entering an ordinary Codex conversation',
    'full assistant names as default home entry labels',
    'skills outside the App packaged skill set in home skill menu',
    'OPL Meta Agent as a default home assistant',
    'retired Codex model choices',
    'nested input card frames',
    'dashboard-first home',
    'explanatory landing page',
    'backend settings panel in composer',
    'domain artifact body in Home activity center',
    'memory body in Home activity center',
  ]) {
    assert.ok(guidHomePage.must_not_show.includes(forbidden), forbidden);
  }

  const ordinaryConversationPage = pageStateMatrix.pages.find((page) => page.id === 'ordinary_conversation');
  const rightContextInspectorPage = pageStateMatrix.pages.find((page) => page.id === 'right_context_inspector');
  assert.equal(ordinaryConversationPage.page_contract, 'ordinary_codex_conversation');
  assert.deepEqual(ordinaryConversationPage.conversation_view_model, {
    path_id: 'ordinary_codex_conversation',
    entry_source: 'home_purpose_entry_or_new_conversation',
    executor: 'codex_cli',
    composer_position: 'pinned_bottom',
    purpose_tag_visible: true,
    assistant_route_receipt_required: true,
    backend_selector_visible: false,
    model_selector_visible: true,
    permission_mode_selector_visible: false,
    provider_selector_visible: false,
    model_status_surface_ref: 'contracts/app-gui-product-contract.json#executor_policy.default_model_display_value',
    technical_details_policy: 'friendly_default_model_and_reasoning_visible',
  });
  assert.deepEqual(
    rightContextInspectorPage.inspector_view_model.tabs.map((tab) => tab.id),
    ['files', 'capabilities', 'runtime', 'memory', 'automations', 'settings'],
  );
  assert.equal(rightContextInspectorPage.inspector_view_model.placement, 'right');
  assert.equal(rightContextInspectorPage.inspector_view_model.default_state, 'collapsed');
  assert.equal(rightContextInspectorPage.inspector_view_model.chat_canvas_remains_primary, true);
  assert.equal(rightContextInspectorPage.inspector_view_model.opens_on_user_request_only, true);

  for (const [pageContract, expected] of Object.entries(expectedSettingsPageSections)) {
    const page = pageById.get(expected.matrixId);
    assert.equal(page.page_contract, pageContract);
    assert.deepEqual(page.sections, expected.sections);
    for (const item of expected.mustShow) {
      assert.ok(page.must_show.includes(item), `${expected.matrixId} must show ${item}`);
    }
    for (const item of expected.mustNotShow) {
      assert.ok(page.must_not_show.includes(item), `${expected.matrixId} must not show ${item}`);
    }
  }

  assert.equal(
    runtimePage.machine_source,
    'opl app state --profile fast --json',
  );
  assert.equal(runtimePage.default_state_source, 'opl app state --profile fast --json');
  assert.equal(runtimePage.diagnostic_source, 'opl runtime app-operator-drilldown --json');
  assert.equal(
    runtimePage.primary_projection,
    'app_state.operator user task status projection',
  );
  assert.equal(runtimePage.fallback_projection, 'fast App state only for availability/actions; full drilldown only for explicit detail');
  assert.equal(runtimePage.framework_command, 'opl app state --profile fast --json');
  assert.equal(runtimePage.framework_full_detail_command, 'opl runtime app-operator-drilldown --detail full --json');
  assert.equal(runtimePage.framework_action_command, 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json');
  assert.equal(runtimePage.page_contract, 'runtime_user_task_status_first');
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.role,
    'runtime_page_operator_evidence_acceptance',
  );
  assert.equal(runtimePage.operator_evidence_acceptance_path.accepts_refs_only_json, true);
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.summary_state_command,
    'opl app state --profile fast --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.refresh_state_command,
    'opl app state --profile fast --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.full_drilldown_command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_dry_run_command,
    'opl app action execute --action <action_id> --dry-run --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_execute_command,
    'opl app action execute --action <action_id> --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_route_source,
    'app_state.actions',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_execution_policy,
    'operator_selected_safe_app_action_route_only',
  );
  assert.equal(runtimePage.runtime_view_model.role, 'opl_runtime_user_task_status');
  assert.equal(runtimePage.runtime_view_model.bridge_contract, 'contracts/app-runtime-bridge.json');
  assert.equal(runtimePage.runtime_view_model.default_mode, 'user_task_status_first');
  assert.equal(runtimePage.runtime_view_model.full_detail_policy, 'on_demand_only');
  assert.equal(runtimePage.runtime_view_model.polling_fallback.interval_seconds_min, 5);
  assert.equal(runtimePage.runtime_view_model.polling_fallback.interval_seconds_max, 10);
  assert.equal(runtimePage.runtime_view_model.polling_fallback.policy, 'lightweight_polling_until_push_projection_available');
  assert.deepEqual(runtimePage.runtime_view_model.diagnostics, {
    default_visibility: 'secondary_disclosure',
    sections: ['operator summary', 'safe actions', 'evidence refs', 'full detail digest'],
  });
  assert.equal(runtimePage.runtime_view_model.action_queue.source, 'app_state.actions');
  assert.equal(runtimePage.runtime_view_model.action_queue.fallback_source, 'app_state.operator.actions');
  assert.equal(runtimePage.runtime_view_model.action_queue.authority, 'framework_refs_only');
  assert.deepEqual(runtimePage.runtime_view_model.user_task_status_projection, {
    source: 'app_state.operator.workbench.summary_cards + app_state.operator.workbench.activity_center + app_state.operator.workbench.task_drilldowns + app_state.operator.visual_ref_groups.active_project_refs',
    authority: 'opl_framework_refs_only_user_task_projection',
    display_policy: 'user_task_status_first_provider_projection_diagnostic_only',
    default_user_question:
      "How many tasks are running, how many projects or tasks are active or queued, how many need attention, and what is each task's current step?",
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
    diagnostic_source_policy:
      'provider/projection/ref/ledger/current_control_state details stay secondary and are not the default page language',
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
  });
  assert.deepEqual(runtimePage.runtime_view_model.project_progress, {
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
    user_display_fields: expectedRuntimeProjectProgressUserFields,
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
    forbidden_running_task_sources: [
      'module_runtime dirty state',
      'domain lane active_task_count',
      'assistant purpose cards',
      'module readiness diagnostics',
    ],
  });
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
    runtimePage.runtime_view_model.progress_delta.source,
    'app_state.operator.workbench.task_drilldowns.progress_delta_classification',
  );
  assert.equal(runtimePage.runtime_view_model.progress_delta.authority, 'opl_framework_shared_progress_projection');
  assert.equal(runtimePage.runtime_view_model.progress_delta.display_policy, 'classification_only_no_domain_artifact_body');
  assert.deepEqual(runtimePage.runtime_view_model.progress_delta.required_fields, [
    'deliverable_progress_delta',
    'platform_repair_delta',
    'progress_delta_classification',
  ]);
  assert.deepEqual(runtimePage.runtime_view_model.progress_delta.visible_classes, [
    'deliverable_progress',
    'platform_repair',
    'mixed',
    'typed_blocker',
    'human_gate',
    'stop_loss',
  ]);
  assert.equal(runtimePage.runtime_view_model.progress_delta.deliverable_progress_source, 'deliverable_progress_delta');
  assert.equal(runtimePage.runtime_view_model.progress_delta.platform_repair_source, 'platform_repair_delta');
  assert.equal(runtimePage.runtime_view_model.progress_delta.classification_source, 'progress_delta_classification');
  assert.equal(
    runtimePage.runtime_view_model.progress_delta.platform_repair_display_treatment,
    'separate_infrastructure_repair_not_deliverable_progress',
  );
  assert.equal(runtimePage.runtime_view_model.progress_delta.forbidden_delivery_claim_for_platform_repair, true);
  assert.equal(runtimePage.runtime_view_model.primary_state_source, 'opl app state --profile fast --json');
  assert.equal(runtimePage.runtime_view_model.refresh_state_source, 'opl app state --profile fast --json');
  assert.equal(runtimePage.runtime_view_model.summary_source, 'opl runtime app-operator-drilldown --json');
  assert.equal(runtimePage.runtime_view_model.full_detail_source, 'opl runtime app-operator-drilldown --detail full --json');
  assert.deepEqual(runtimePage.runtime_view_model.running_task_projection, {
    source: 'app_operator_drilldown.current_control_state.summary + current_control_state.states',
    authority: 'opl_framework_provider_attempt_projection',
    display_policy: 'diagnostic_only_no_provider_attempt_count_as_user_running_task_count',
    user_visible_grain: 'domain_and_active_execution_summary_until_project_projection_available',
    active_execution_filter:
      'states where running_provider_attempt is true and provider_run.provider_status or current_attempt_state is running',
    diagnostic_provider_ref_policy:
      'running_provider_attempt_count may include checkpointed provider refs and must not be displayed as the user-visible running task count',
    forbidden_sources: [
      'domain_lane_map active_task_count',
      'app_state.operator.workbench.task_drilldowns where active_stage_id is module_runtime',
      'app_state.modules',
      'module_runtime dirty state',
      'repo/worktree diagnostics',
      'assistant cards',
    ],
    required_user_fields: [
      'current_control_state.states[].running_provider_attempt',
      'current_control_state.states[].provider_run.provider_status',
      'current_control_state.states[].current_attempt_state',
      'running_provider_attempt_count',
      'running_provider_attempt_domain_ids',
      'running_provider_attempt_task_kinds',
      'latest_running_provider_heartbeat_at',
      'running_provider_attempt_summary_policy',
    ],
  });
  assert.equal(runtimePage.runtime_view_model.provider_status.source, 'app_state.provider');
  assert.equal(runtimePage.runtime_view_model.provider_status.authority, 'opl_framework');
  assert.equal(runtimePage.runtime_view_model.authority_boundary.refs_only, true);
  assert.equal(runtimePage.runtime_view_model.authority_boundary.non_authority_display_only, true);
  assert.equal(runtimePage.runtime_view_model.authority_boundary.action_execution_owner, 'opl_framework');
  assert.equal(runtimePage.runtime_view_model.authority_boundary.domain_verdict_owner, 'domain_agent');
  for (const expected of [
    'user task status first OPL runtime status',
    'running task count from framework user task projection',
    'active project count from framework project-line projection',
    'queued project count from framework project-line projection',
    'attention count from framework blocker and owner-attention projection',
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'provider/current_control_state details as diagnostics only',
    'summary OPL operator drilldown read model',
    'fast App state refresh',
    'app_state.operator.workbench.task_drilldowns project progress refs',
    'app_state.operator.workbench.activity_center.active_projects active project lines',
    'app_state.operator.visual_ref_groups.active_project_refs',
    'non-running waiting or stopped projects collapsed by default',
    'full detail lazy load',
    'app_state.operator.summary refs',
    'app_state.provider readiness refs',
    'app_state.actions safe action refs',
    'refs-only non-authority boundary',
    'safe app action dry-run',
    'safe app action execute',
    'receipt/count refresh after execute',
    'authority boundary fields',
  ]) {
    assert.ok(runtimePage.operator_evidence_path.includes(expected), expected);
  }
  for (const expected of [
    'user task status first OPL runtime status',
    'running task count',
    'active project count',
    'queued project count',
    'attention count',
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'project progress from app_state.operator.workbench.task_drilldowns',
    'active project line count from app_state.operator.workbench.activity_center.active_projects',
    'project title/domain/current state/current stage',
    'next visible step when projected',
    'blocker count and user attention status',
    'progress delta rendered as user-facing labels',
    'runtime diagnostics as secondary disclosure',
    'provider readiness from app_state.provider',
    'operator summary from app_state.operator',
    'safe action refs from app_state.actions',
    'non-running waiting or stopped projects collapsed by default',
    'summary OPL operator drilldown read model',
    'full detail lazy load',
    'safe app action dry-run/execute controls',
    'deliverable progress delta classification',
    'platform repair delta as separate infrastructure repair',
    'receipt/count refresh after execute',
    'refs-only non-authority boundary',
    'next owner action before full evidence ledger',
    'full evidence ledger only as secondary on-demand diagnostic',
  ]) {
    assert.ok(runtimePage.must_show.includes(expected), expected);
  }
  for (const forbiddenOwner of [
    'runtime truth',
    'provider implementation',
    'domain truth',
    'memory body',
    'artifact body',
    'quality/readiness/export verdict',
    'deliverable progress truth',
    'platform repair truth',
    'action route authority',
    'domain action approval override',
  ]) {
    assert.ok(runtimePage.must_not_own.includes(forbiddenOwner), forbiddenOwner);
  }
  assert.equal(pageStateMatrix.canonical_state_surface.default_command, 'opl app state --profile fast --json');
  assert.equal(pageStateMatrix.canonical_state_surface.refresh_command, 'opl app state --profile fast --json');
  assert.equal(
    pageStateMatrix.canonical_action_surface.command,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  );
  assert.equal(
    pageStateMatrix.full_detail_exception.command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(environmentPage.machine_source, 'opl app state --profile fast --json');
  assert.equal(environmentPage.refresh_source, 'opl app state --profile fast --json');
  assert.equal(
    environmentPage.module_path_source_policy_ref,
    'contracts/app-gui-product-contract.json#module_path_source_policy',
  );
  assert.ok(environmentPage.must_show.includes('module path source explanation'));
  assert.ok(environmentPage.must_not_show.includes('Med Deep Scientist as a default module'));
  assert.equal(settingsThemePage.machine_source, 'opl app state --profile fast --json');
  assert.equal(settingsThemePage.refresh_source, 'opl app state --profile fast --json');
  assert.ok(settingsThemePage.must_show.includes('Default theme option'));
  assert.ok(settingsThemePage.must_show.includes('Codex theme option'));
  const aboutPage = pageStateMatrix.pages.find((page) => page.id === 'about');
  assert.ok(aboutPage.must_show.includes('OPL Framework revision'));
  assert.ok(pageStateMatrix.pages.every((page) => page.id !== 'docker_webui'));
});

test('release evidence bundle records Runtime page acceptance artifacts without App authority', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const firstRunMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const runtimePage = pageStateMatrix.pages.find((page) => page.id === 'runtime');
  const fullFirstRun = firstRunMatrix.scenarios.find((scenario) => scenario.id === 'full_first_install_clean_machine');
  const bundle = releaseContract.operator_evidence_bundle;
  const artifactById = new Map(bundle.required_artifacts.map((artifact) => [artifact.id, artifact]));
  const diagnosticById = new Map((bundle.optional_diagnostic_artifacts ?? []).map((artifact) => [artifact.id, artifact]));

  assert.equal(bundle.purpose, 'runtime_page_operator_evidence_acceptance');
  assert.equal(bundle.acceptance_path, 'Runtime page');
  assert.equal(bundle.runtime_page_contract, 'contracts/app-page-state-matrix.json#runtime');
  assert.equal(bundle.refs_only, true);
  assert.equal(bundle.bundle_root_pattern, 'release-evidence/<version>/');
  assert.equal(bundle.manifest_path, 'evidence-manifest.json');
  assert.deepEqual(bundle.missing_evidence_policy, {
    default_validation: 'fail_closed',
    allow_missing_evidence_flag: '--allow-missing-evidence',
    missing_status: 'missing_evidence',
    allowed_artifact_statuses: [
      'present',
      'missing',
      'typed_blocker',
      'not_applicable',
    ],
    typed_blocker_status_requires: [
      'reason',
      'typed_blocker_ref',
    ],
    typed_blocker_path_pattern: 'typed-blockers/<artifact_id>.json',
    not_applicable_status_requires: [
      'reason',
      'not_applicable_reason',
    ],
    packaged_app_evidence_requires: 'all_required_artifacts_present_and_verified',
  });
  assert.deepEqual(bundle.image_evidence_policy, {
    applies_to_kind: 'image',
    minimum_width_px: 640,
    minimum_height_px: 360,
    minimum_file_size_bytes: 4096,
    placeholder_screenshot_allowed: false,
  });
  assert.equal(
    artifactById.get('app_state_summary').producer,
    'opl app state --profile fast --json',
  );
  assert.equal(
    artifactById.get('app_state_full').producer,
    'opl app state --profile full --json',
  );
  assert.equal(
    artifactById.get('drilldown_full').producer,
    runtimePage.operator_evidence_acceptance_path.full_drilldown_command,
  );
  assert.equal(
    artifactById.get('action_dry_run_result').producer,
    runtimePage.operator_evidence_acceptance_path.action_dry_run_command,
  );
  assert.equal(
    artifactById.get('action_execute_result').producer,
    runtimePage.operator_evidence_acceptance_path.action_execute_command,
  );
  assert.deepEqual(
    [...artifactById.values()].map((artifact) => artifact.path),
    [
      'app-state-summary.json',
      'app-state-full.json',
      'drilldown-full.json',
      'action-dry-run-result.json',
      'action-execute-result.json',
      'screenshots/runtime.png',
      'screenshots/full.png',
      'screenshots/action.png',
      'tart-smoke-summary.json',
      'artifacts/smoke-summary.json',
      'artifacts/assistant-route-smoke-summary.json',
      'artifacts/codex-functional-check-summary.json',
      'artifacts/assistant-route-smoke/mas.png',
      'artifacts/assistant-route-smoke/mag.png',
      'artifacts/assistant-route-smoke/rca.png',
      'remote-release-verification.json',
    ],
  );
  assert.deepEqual(diagnosticById.get('codex_ai_self_check_summary'), {
    id: 'codex_ai_self_check_summary',
    path: 'artifacts/codex-ai-self-check-summary.json',
    kind: 'json',
    producer: 'packaged GUI Codex AI-first post-install self-check',
    source_kind: 'packaged_gui_codex_ai_self_check',
  });
  assert.deepEqual(
    [...artifactById.values()].map((artifact) => artifact.source_kind),
    [
      'opl_app_state_summary',
      'opl_app_state_full',
      'opl_app_operator_drilldown_full',
      'opl_app_action_dry_run',
      'opl_app_action_execute',
      'app_runtime_page_screenshot',
      'full_first_install_release_screenshot',
      'app_runtime_action_screenshot',
      'clean_first_run_vm_smoke',
      'packaged_gui_first_run_smoke',
      'packaged_gui_assistant_route_smoke',
      'packaged_gui_codex_functional_check',
      'packaged_gui_assistant_route_smoke_screenshot',
      'packaged_gui_assistant_route_smoke_screenshot',
      'packaged_gui_assistant_route_smoke_screenshot',
      'remote_release_verification',
    ],
  );
  assert.deepEqual(fullFirstRun.release_evidence_artifacts, [
    'tart-smoke-summary.json',
    'artifacts/smoke-summary.json',
    'artifacts/system-initialize.json',
    'artifacts/settings-smoke-summary.json',
    'artifacts/assistant-route-smoke-summary.json',
    'artifacts/codex-functional-check-summary.json',
    'artifacts/assistant-route-smoke/mas.png',
    'artifacts/assistant-route-smoke/mag.png',
    'artifacts/assistant-route-smoke/rca.png',
  ]);
  for (const forbiddenAuthority of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    assert.ok(bundle.forbidden_authority.includes(forbiddenAuthority), forbiddenAuthority);
  }
  assert.match(bundle.acceptance_rule, /does not reinterpret the bundle as runtime truth/);
});
