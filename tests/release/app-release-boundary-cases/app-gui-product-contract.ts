import {
  assert,
  fs,
  path,
  test,
  appRoot,
  expectedAionuiTeamProbeIds,
  expectedOrdinaryCockpitForbiddenTerms,
  expectedOrdinaryForbiddenCapabilityPolicy,
  expectedOrdinaryRequiredScrubTargets,
  expectedSettingsPageSections,
  readProductProfile,
} from './helpers.ts';
import { taskRunProjectionV2FieldGroups } from '../../../scripts/validate-active-shell/app-contract-constants.ts';

test('App GUI product contract owns GUI requirements and unified OPL state/action boundaries', () => {
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.equal(guiContract.owner, 'one-person-lab-app');
  assert.equal(guiContract.purpose, 'app_owned_gui_product_contract');
  assert.equal(guiContract.product_authority.source_of_truth, 'one-person-lab-app');
  assert.equal(guiContract.product_authority.active_shell_role, 'implementation_carrier');
  assert.equal(guiContract.product_authority.upstream_gui_role, 'implementation_material_only');
  assert.equal(
    guiContract.product_authority.upstream_behavior_acceptance_policy,
    'must_match_app_owned_gui_product_contract_before_release',
  );
  assert.equal(guiContract.product_authority.shell_upgrade_policy.role, 'replaceable_implementation_carrier');
  assert.ok(guiContract.product_authority.shell_upgrade_policy.app_repo_controls.includes('settings information architecture'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.app_repo_controls.includes('home command center requirements'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.app_repo_controls.includes('page-state acceptance matrix'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.shell_repo_controls.includes('renderer implementation details'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.shell_repo_controls.includes('upstream AionUI intake patches'));
  assert.match(guiContract.product_authority.shell_upgrade_policy.upgrade_rule, /App-owned contracts/);
  assert.match(guiContract.product_authority.shell_upgrade_policy.replacement_rule, /active-shell validation/);
  assert.equal(guiContract.framework_surfaces.canonical_state.default_command, 'opl app state --profile fast --json');
  assert.equal(guiContract.framework_surfaces.canonical_state.refresh_command, 'opl app state --profile fast --json');
  assert.equal(guiContract.framework_surfaces.canonical_state.default_operator_payload, 'current_owner_delta');
  assert.equal('compatibility_operator_payload' in guiContract.framework_surfaces.canonical_state, false);
  assert.equal(guiContract.framework_surfaces.canonical_state.default_profile, 'fast');
  assert.equal(guiContract.framework_surfaces.canonical_state.manual_refresh_profile, 'fast');
  assert.equal(guiContract.framework_surfaces.canonical_state.full_profile_policy, 'diagnostic_or_release_evidence_only');
  assert.deepEqual(guiContract.framework_surfaces.canonical_state.default_read_surface_policy, {
    default_projection: 'opl_current_owner_delta',
    source_path: 'app_state.operator.default_read_surface_policy',
    foundry_agent_os_cockpit_policy: 'first_screen_current_owner_delta_only_raw_worklist_evidence_provider_trace_drilldown_only',
    default_next_action_source: 'current_owner_delta',
    raw_worklist_generates_default_next_action: false,
    release_evidence_counts_as_release_ready: false,
    stage_run_cockpit_projection_ref: 'contracts/app-runtime-bridge.json#stage_run_cockpit_projection',
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
  assert.equal(
    guiContract.framework_surfaces.canonical_action.command,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  );
  assert.equal(
    guiContract.framework_surfaces.runtime_full_drilldown.command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(guiContract.framework_surfaces.runtime_full_drilldown.policy, 'on_demand_only');
  assert.equal(
    guiContract.framework_surfaces.canonical_state_display_action_map.source_ref,
    'contracts/app-runtime-bridge.json#canonical_state_display_action_map',
  );
  assert.deepEqual(guiContract.framework_surfaces.canonical_state_display_action_map.required_semantic_areas, [
    'runtime',
    'task',
    'package',
  ]);
  assert.equal(
    pageStateMatrix.canonical_state_display_action_map_ref,
    'contracts/app-runtime-bridge.json#canonical_state_display_action_map',
  );
  assert.deepEqual(pageStateMatrix.canonical_state_display_action_map_required_semantic_areas, [
    'runtime',
    'task',
    'package',
  ]);
  assert.deepEqual(guiContract.framework_surfaces.task_awareness.v2_field_groups.evidence_cards, taskRunProjectionV2FieldGroups.evidence_cards);
  assert.deepEqual(guiContract.framework_surfaces.task_awareness.v2_field_groups.action_cards, taskRunProjectionV2FieldGroups.action_cards);
  assert.deepEqual(guiContract.framework_surfaces.task_awareness.v2_field_groups.resource_cards, taskRunProjectionV2FieldGroups.resource_cards);
  assert.deepEqual(guiContract.framework_surfaces.stage_run_cockpit, {
    projection_ref: 'contracts/app-runtime-bridge.json#stage_run_cockpit_projection',
    source: 'app_state.operator.workbench.task_drilldowns.stage_run_cockpit + app_state.operator.workbench.task_drilldowns.stage_run_cockpit_summary',
    equivalent_source: 'app_state.operator.workbench.task_drilldowns.stage_run_current_owner_delta',
    derived_from: 'current_owner_delta',
    display_policy: 'refs_only_stage_run_cockpit_display_guard_no_runtime_truth_claims',
    ordinary_fast_state_required: true,
    app_role: 'display_only_stage_run_cockpit_consumer',
  });
  assert.deepEqual(guiContract.framework_surfaces.runtime_default_attention.active_project_line_fields, [
    'app_state.operator.workbench.summary_cards[active_projects]',
    'app_state.operator.workbench.activity_center.active_projects',
    'app_state.operator.visual_ref_groups.active_project_refs',
  ]);
  assert.equal(
    guiContract.framework_surfaces.runtime_default_attention.active_project_line_policy,
    'queued_or_escalated_owner_handled_project_lines_count_as_user_visible_active_projects_without_claiming_active_worker_run',
  );
  assert.deepEqual(guiContract.framework_surfaces.runtime_default_attention.project_group_expansion_policy, {
    running_group_default: 'expanded',
    attention_group_default: 'visible_when_nonempty',
    inactive_group_default: 'collapsed',
    inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
    inactive_summary_fields: [
      'count',
      'status',
      'next_visible_step',
      'runtime_closeout_observed',
      'runtime_closeout_ref',
      'mas_owner_consumption_status',
      'mas_owner_consumed_stage_attempt_id',
      'mas_owner_consumption_matches_runtime_closeout',
    ],
  });
  assert.deepEqual(
    guiContract.framework_surfaces.runtime_default_attention.must_not_default_display_terms,
    [
      'Temporal',
      'provider',
      'projection',
      'ref',
      'stage attempt',
      'ledger',
      'current_control_state',
      'AionUI',
      'backend selector',
      'shell candidate',
      'runtime implementation selector',
    ],
  );
  assert.deepEqual(guiContract.ordinary_cockpit_surface_budget, {
    surface_id: 'ordinary_app_cockpit_surface_budget',
    purpose: 'keep Home, Runtime, and Settings focused on purpose, task status, next owner, artifact/blocker, and release facts',
    stage_run_cockpit_projection_ref: 'contracts/app-runtime-bridge.json#stage_run_cockpit_projection',
    stage_run_consumption_policy: 'ordinary fast App state must consume refs-only stage_run_cockpit, stage_run_cockpit_summary, or equivalent stage_run_current_owner_delta derived from current_owner_delta as display guard only',
    foundry_agent_os_cockpit_policy: 'first_screen_current_owner_delta_only_raw_worklist_evidence_provider_trace_drilldown_only',
    default_next_action_source: 'current_owner_delta',
    raw_worklist_generates_default_next_action: false,
    release_evidence_counts_as_release_ready: false,
    applies_to_pages: [
      'guid_home',
      'runtime',
      'settings_general',
      'access',
      'capabilities',
      'environment',
      'settings_theme',
      'advanced',
      'about',
      'update',
      'settings_resources',
    ],
    ordinary_allowed_answer_shapes: [
      'purpose_entry',
      'task_status',
      'next_owner',
      'accepted_answer_shape',
      'artifact_or_blocker',
      'release_fact',
      'app_profile',
      'access_status',
      'agent_capability',
      'local_environment_status',
      'appearance_preference',
      'advanced_diagnostic_link',
      'about_update_fact',
      'provider_readiness_repair',
    ],
    ordinary_must_not_default_display_terms: expectedOrdinaryCockpitForbiddenTerms,
    diagnostics_escape_hatch: 'Advanced, release evidence, developer detail, or explicit full-detail drilldown only',
    source_policy: 'ordinary views consume opl app state --profile fast --json and must not derive first-screen layout from raw runtime drilldown',
  });
  assert.equal(guiContract.executor_policy.default_executor, 'codex_cli');
  assert.equal(guiContract.executor_policy.codex_cli_fixed_executor, true);
  assert.equal(guiContract.executor_policy.codex_only_default, true);
  assert.equal(guiContract.executor_policy.home_executor_selector_visible, false);
  assert.equal(guiContract.executor_policy.executor_tab_visible_when_single_executor, false);
  assert.equal(guiContract.executor_policy.default_model_strategy, 'codex_cli_auto_latest_available_frontier');
  assert.equal(guiContract.executor_policy.default_model_display_value, 'GPT-5.5');
  assert.equal(guiContract.executor_policy.home_model_status_label, 'GPT-5.5');
  assert.equal(
    guiContract.executor_policy.home_model_status_policy,
    'display_default_model_with_reasoning_configurable_in_model_menu',
  );
  assert.equal(
    guiContract.executor_policy.conversation_model_status_policy,
    'display_same_model_selector_with_reasoning_configurable_in_model_menu',
  );
  assert.equal(
    guiContract.executor_policy.conversation_pending_feedback_policy,
    'display_elapsed_seconds_while_ai_processing_or_backend_running',
  );
  assert.equal(guiContract.executor_policy.precise_model_display_policy, 'friendly_model_primary_reasoning_configurable_in_model_menu');
  assert.equal(
    guiContract.executor_policy.model_display_options_policy.button_label_policy,
    'auto_or_fixed_model_compact_label_with_selected_reasoning_effort',
  );
  assert.equal(guiContract.executor_policy.model_display_options_policy.reasoning_menu_title_zh, '推理');
  assert.equal(guiContract.executor_policy.model_display_options_policy.reasoning_menu_title_en, 'Reasoning');
  assert.equal(guiContract.executor_policy.model_display_options_policy.auto_option_current_resolution_visible, true);
  assert.equal(
    guiContract.executor_policy.model_display_options_policy.model_menu_policy,
    'last_submenu_collapsed_by_default',
  );
  assert.equal(guiContract.executor_policy.permission_mode_selector_visible_on_home, false);
  assert.equal(guiContract.executor_policy.model_selector_visible_on_new_conversation, true);
  assert.equal(guiContract.executor_policy.model_selector_visible_in_conversation, true);
  assert.equal(guiContract.executor_policy.backend_selector_visible_in_conversation, false);
  assert.equal(guiContract.executor_policy.permission_mode_selector_visible_in_conversation, false);
  assert.equal(guiContract.executor_policy.user_model_override_allowed, true);
  assert.equal(guiContract.executor_policy.model_list_source, 'codex_cli_handshake_available_models');
  assert.equal(
    guiContract.executor_policy.frontier_model_preference_order_role,
    'fallback_when_codex_cli_model_list_unavailable',
  );
  assert.equal(guiContract.executor_policy.restore_auto_model_selection_allowed, true);
  assert.deepEqual(guiContract.executor_policy.frontier_model_preference_order, [
    'gpt-5.5',
    'gpt-5.4',
  ]);
  assert.deepEqual(guiContract.professional_agent_packages.map((pkg) => pkg.package_id), ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge', 'opl-meta-agent']);
  assert.deepEqual(
    Object.fromEntries(guiContract.professional_agent_packages.map((pkg) => [pkg.package_id, pkg.required_skill_ids])),
    { 'med-autoscience': ['med-autoscience'], 'med-autogrant': ['med-autogrant'], 'redcube-ai': ['redcube-ai'], 'opl-bookforge': ['opl-bookforge'], 'opl-meta-agent': ['opl-meta-agent'] },
  );
  assert.deepEqual(
    Object.fromEntries(guiContract.professional_agent_packages.map((pkg) => [pkg.package_id, pkg.codex_visible_entry])),
    { 'med-autoscience': 'med-autoscience', 'med-autogrant': 'med-autogrant', 'redcube-ai': 'redcube-ai', 'opl-bookforge': 'opl-bookforge', 'opl-meta-agent': 'opl-meta-agent' },
  );
  assert.ok(guiContract.professional_agent_packages.filter((pkg) => pkg.package_id !== 'opl-meta-agent').every((pkg) => pkg.default_home_visible === true));
  assert.equal(guiContract.professional_agent_packages.find((pkg) => pkg.package_id === 'opl-meta-agent').default_home_visible, false);
  assert.deepEqual(guiContract.default_assistants.map((assistant) => assistant.id), ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge']);
  assert.ok(guiContract.default_assistants.every((assistant) => assistant.home_entry_policy === 'purpose_entry_target'));
  assert.deepEqual(guiContract.assistant_skill_profiles.map((profile) => profile.assistant_id), ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge']);
  assert.deepEqual(
    Object.fromEntries(guiContract.assistant_skill_profiles.map((profile) => [profile.assistant_id, profile.required_skills])),
    { 'med-autoscience': ['med-autoscience'], 'med-autogrant': ['med-autogrant'], 'redcube-ai': ['redcube-ai'], 'opl-bookforge': ['opl-bookforge'] },
  );
  assert.ok(
    guiContract.assistant_skill_profiles.every(
      (profile) => profile.skill_menu_policy === 'assistant_scoped_required_checked_optional_visible',
    ),
  );
  const guiContractPackagedSkillIds = new Set(productProfile.companion_payloads.default_packaged_codex_skill_ids);
  assert.ok(
    guiContract.assistant_skill_profiles.every((profile) =>
      [...profile.required_skills, ...profile.optional_skills].every((skill) => guiContractPackagedSkillIds.has(skill)),
    ),
  );
  assert.ok(guiContract.assistant_skill_profiles.every((profile) => !('hidden_home_skill_names' in profile)));
  assert.ok(guiContract.assistant_skill_profiles.every((profile) => !profile.optional_skills.includes('morph-ppt')));
  assert.equal(guiContract.agent_package_invocation_receipt_policy.scope, 'package_shortcut_launch_to_codex_conversation');
  assert.deepEqual(guiContract.agent_package_invocation_receipt_policy.required_for_package_shortcuts, ['research', 'grant', 'ppt', 'book', 'oma']);
  assert.equal(guiContract.agent_package_invocation_receipt_policy.route_kind, 'agent_package_shortcut');
  assert.equal(guiContract.agent_package_invocation_receipt_policy.executor, 'codex_cli');
  assert.equal(guiContract.agent_package_invocation_receipt_policy.source, 'opl_app_home');
  assert.deepEqual(guiContract.agent_package_invocation_receipt_policy.required_fields, [
    'route_kind',
    'executor',
    'package_id',
    'shortcut_id',
    'codex_visible_entry',
    'required_skill_ids',
    'source',
  ]);
  assert.deepEqual(guiContract.agent_package_invocation_receipt_policy.must_not_govern, [
    'session_behavior',
    'domain_workflow',
    'domain_readiness',
  ]);
  assert.equal(
    guiContract.agent_package_invocation_receipt_policy.receipt_authority,
    'launch_fact_only_no_session_behavior_domain_workflow_or_readiness',
  );
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.migration_alias_for, 'agent_package_invocation_receipt_policy');
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.scope, 'home_purpose_entry_to_conversation');
  assert.deepEqual(guiContract.builtin_assistant_route_receipt_policy.required_for_assistants, ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge']);
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.route_kind, 'builtin_capability');
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.executor, 'codex_cli');
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.source, 'opl_app_home');
  assert.deepEqual(guiContract.builtin_assistant_route_receipt_policy.required_fields, [
    'route_kind',
    'executor',
    'assistant_id',
    'assistant_short_name',
    'source',
  ]);
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.must_not_depend_on_visible_backend_selection, true);
  assert.deepEqual(guiContract.ordinary_capability_selector_policy, {
    scope: 'home_composer_and_ordinary_conversation',
    authority: 'app_owned_opl_allowlist',
    skill_source_ref: 'assistant_skill_profiles.required_skills + optional_skills',
    package_skill_source_ref: 'professional_agent_packages.required_skill_ids + optional_skill_ids',
    skill_menu_policy: 'assistant_scoped_required_checked_optional_visible',
    conversation_loaded_skill_display_policy: 'filter_to_ordinary_skill_allowlist',
    mcp_server_source_ref: 'contracts/app-product-profile.json#gui.ordinary_capability_selector_policy.visible_mcp_server_ids',
    mcp_menu_policy: 'empty_until_app_explicitly_whitelists_opl_mcp_servers',
    visible_mcp_server_ids: [],
    conversation_loaded_mcp_display_policy: 'filter_to_visible_mcp_server_ids',
    forbidden_skill_examples: ['aionui-skills', 'aionui-webui-setup', 'skill-creator', 'cron'],
    forbidden_mcp_policy: 'do_not_surface_user_or_aionui_mcp_servers_in_ordinary_home_without_app_profile_allowlist',
    forbidden_mcp_examples: ['aionui-team', 'team_*', 'mcp__aionui-team*', 'team_mcp_stdio_config', 'team_id/teamId'],
    ...expectedOrdinaryForbiddenCapabilityPolicy,
    required_scrub_targets: expectedOrdinaryRequiredScrubTargets,
    conversation_snapshot_policy: 'scrub_disabled_team_mcp_and_team_metadata_before_rendering_or_inheriting_ordinary_conversations',
  });
  assert.deepEqual(
    guiContract.ordinary_capability_selector_policy.required_scrub_targets,
    expectedOrdinaryRequiredScrubTargets,
  );
  const expectedKDenseByokLearningSurface = {
    surface_id: 'k_dense_byok_learning_surface',
    external_source: {
      repo: 'https://github.com/K-Dense-AI/k-dense-byok',
      commit: 'dccc7ec4d034a00d7662eaabb3f5916bc3d00602',
      latest_verified_tag: 'v0.6.0',
    },
    ordinary_user_labels: {
      primary_label_zh: '外部工具',
      primary_label_en: 'External Tools',
      primary_product_label: 'OPL Connect',
      mcp_primary_ui_name_allowed: false,
      mcp_sdk_role: 'connector_transport_implementation_preference',
    },
    reuse_first_policy: {
      implementation_preference: 'reuse_existing_open_source_modules_and_existing_dependencies_first',
      preferred_existing_modules: [
        '@modelcontextprotocol/sdk',
        'CodeMirror/Monaco',
        'streamdown/react-markdown',
        'mermaid',
        'katex',
        'zod',
      ],
      must_not_introduce_dependencies: [
        '@earendil-works/pi-* / Pi SDK',
        'Fastify/Next application runtime',
        'modal compute SDK as an App dependency',
      ],
      modal_policy: 'future_opl_fabric_provider_watch_only_or_adapter_candidate_only',
    },
    workflow_starter_policy: {
      role: 'assistant_scoped_route_prompt_seed_ref',
      allowed_refs: ['assistant_route_ref', 'prompt_seed_ref', 'workflow_ref'],
      creates_second_skill_truth: false,
      creates_second_runtime_truth: false,
    },
    ambiguous_high_risk_task_policy: {
      confirmation_surface: 'existing_app_action_dry_run_confirmation_drawer_or_card',
      app_action_route: 'opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json',
      shell_private_modal_tool_allowed: false,
      required_before_mutation: [
        'dry_run_receipt',
        'confirmation_drawer_or_card',
        'will_change',
        'will_not_change',
        'rollback_or_receipt',
      ],
    },
  };
  assert.deepEqual(guiContract.k_dense_byok_learning_surface, expectedKDenseByokLearningSurface);
  assert.deepEqual(productProfile.gui.k_dense_byok_learning_surface, expectedKDenseByokLearningSurface);
  assert.deepEqual(guiContract.settings_navigation.team_surface_policy.required_probes, expectedAionuiTeamProbeIds);
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.id), ['research', 'grant', 'ppt', 'book']);
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.primary_label), ['科研', '基金', '演示', '写书']);
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.target_assistant_id), ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge']);
  assert.ok(guiContract.home_purpose_entries.every((entry) => entry.display_policy === 'purpose_first'));
  assert.deepEqual(guiContract.home_agent_shortcuts.map((entry) => entry.shortcut_id), ['research', 'grant', 'ppt', 'book', 'oma']);
  assert.deepEqual(guiContract.home_agent_shortcuts.map((entry) => entry.package_id), ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge', 'opl-meta-agent']);
  assert.ok(guiContract.home_agent_shortcuts.every((entry) => entry.executor === 'codex_cli' && entry.source === 'opl_app_home'));
  assert.ok(guiContract.home_agent_shortcuts.filter((entry) => entry.shortcut_id !== 'oma').every((entry) => entry.default_visible === true && entry.user_configurable === true));
  assert.equal(guiContract.home_agent_shortcuts.find((entry) => entry.shortcut_id === 'oma').default_visible, false);
  assert.equal(guiContract.home_agent_shortcuts.find((entry) => entry.shortcut_id === 'oma').user_configurable, true);
  assert.equal(guiContract.non_default_assistants.find((assistant) => assistant.id === 'opl-meta-agent').home_default_visible, false);
  assert.equal(guiContract.retired_domain_agents.find((agent) => agent.id === 'mds').default_display_allowed, false);
  assert.equal(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.policy,
    'app_contract_first_thin_shell_delta',
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.preferred_optimization_path.includes(
      'encode product behavior in App contracts and product profile',
    ),
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.allowed_shell_delta.includes(
      'thin renderer components for App-owned pages',
    ),
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.requires_app_contract_before_shell_change.includes(
      'new visible model/provider/permission control',
    ),
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.forbidden_shell_delta.includes(
      'shell-owned product IA',
    ),
  );
  assert.equal(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.replacement_rule,
    'a candidate shell should implement the same App contracts by swapping adapters/profile consumers, not by inheriting AionUI-specific product logic',
  );
  assert.equal(guiContract.pages.guid_home.hero_prompt, '把研究、基金、汇报和写书交给 One Person Lab 自动推进');
  assert.equal(guiContract.pages.guid_home.model_status.display_value, 'GPT-5.5');
  assert.equal(guiContract.pages.guid_home.model_status.selector_visible, true);
  assert.equal(
    guiContract.pages.guid_home.conversation_feedback_policy.pending_indicator,
    'visible elapsed seconds while request is pending or backend is running',
  );
  assert.equal(
    guiContract.pages.guid_home.conversation_feedback_policy.model_status,
    'same model selector appears in Codex conversation composer; reasoning is configurable in the model menu',
  );
  assert.equal(guiContract.pages.guid_home.conversation_feedback_policy.raw_trace_visible, false);
  assert.ok(guiContract.pages.guid_home.must_show.includes('single composer-first home input'));
  assert.ok(guiContract.pages.guid_home.must_show.includes('runtime/task progress available from Runtime page, not Home activity grid'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('expanded workbench or activity refs grid on ordinary home'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('compact continue-work entry near the home input'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('Home footer feedback icon'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('Home footer favorite/star icon'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('Home footer web/access globe icon'));
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.source,
    'runtime page only; Home does not query running task lists',
  );
  assert.equal(guiContract.pages.guid_home.activity_center_policy.authority, 'app_owned_home_minimal_command_surface');
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.role,
    'home_runtime_activity_suppressed_to_keep_composer_first',
  );
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.default_placement,
    'not_rendered_on_ordinary_home',
  );
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.home_surface_policy,
    'ordinary_home_must_not_render_activity_center_or_continue_work_grid',
  );
  assert.deepEqual(guiContract.pages.guid_home.activity_center_policy.allowed_home_runtime_context, []);
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('expanded continue-work center'));
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('needs attention / active / recent activity groups'));
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('domain artifact body'));
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('memory body'));
  assert.ok(guiContract.pages.settings_advanced.must_show.includes('OPL Flow Context'));
  assert.ok(!guiContract.pages.settings_advanced.sections.includes('opl_agent_codex_context'));
  assert.ok(!('legacy_state_sections' in guiContract.pages.settings_advanced));
  assert.equal(guiContract.pages.settings_workspace.ia_group, 'overview');
  assert.ok(
    guiContract.pages.settings_workspace.must_show.includes(
      'workspace page reachable as a top-level Settings entry and from Overview task links',
    ),
  );
  assert.ok(
    guiContract.pages.settings_workspace.must_not_show.includes(
      'workspace buried only inside Local Environment or Advanced diagnostics',
    ),
  );
  assert.equal(guiContract.pages.settings_local_services.ia_group, 'maintenance');
  assert.ok(
    guiContract.pages.settings_local_services.must_show.includes(
      'Local Services page reachable as a secondary deep link from Maintenance & Updates',
    ),
  );
  assert.ok(
    guiContract.pages.settings_local_services.must_not_show.includes(
      'updates, package maintenance, storage cleanup, or rollback controls as the primary Local Services task',
    ),
  );
  for (const pageId of guiContract.ordinary_cockpit_surface_budget.applies_to_pages) {
    const matrixPage = pageStateMatrix.pages.find((page) => page.id === pageId);
    assert.equal(
      matrixPage.ordinary_cockpit_surface_budget_ref,
      'contracts/app-gui-product-contract.json#ordinary_cockpit_surface_budget',
      `${pageId} must consume the ordinary cockpit surface budget`,
    );
  }
  assert.deepEqual(guiContract.settings_navigation.ordinary_visible_tabs, [
    'general',
    'access',
    'workspace',
    'capabilities',
    'resources',
    'environment',
    'storage',
    'appearance',
  ]);
  assert.deepEqual(guiContract.settings_navigation.legacy_route_redirects, {
    overview: 'general',
    runtime: 'environment',
    system: 'advanced',
    model: 'environment',
    agent: 'capabilities',
    assistants: 'capabilities',
    'skills-hub': 'capabilities',
    tools: 'capabilities',
    display: 'appearance',
    webui: 'resources',
    pet: 'appearance',
  });
  assert.deepEqual(guiContract.settings_navigation.ordinary_hidden_legacy_tabs, [
    'overview',
    'runtime',
    'system',
    'model',
    'agent',
    'assistants',
    'skills-hub',
    'tools',
    'display',
    'webui',
    'pet',
  ]);
  assert.deepEqual(guiContract.settings_navigation.required_sections, [
    'general',
    'access',
    'workspace',
    'capabilities',
    'resources',
    'environment',
    'storage',
    'appearance',
    'advanced',
    'about',
    'update',
    'theme',
  ]);
  assert.deepEqual(guiContract.settings_navigation.ordinary_hidden_upstream_surfaces, [
    'AionUI Team',
    'Team nav entry',
    'Team leader configuration',
    'team deep link navigation',
  ]);
  assert.deepEqual(guiContract.settings_navigation.team_surface_policy, {
    ordinary_visible: false,
    route_policy: 'disabled_or_redirect_to_app_owned_home',
    deep_link_policy: 'not_whitelisted',
    rationale: 'upstream AionUI Team is configured around shell-local agents and is not an OPL ordinary-user capability',
    required_probes: expectedAionuiTeamProbeIds,
  });
  assert.equal(guiContract.settings_navigation.source, 'opl app state --profile fast --json');
  assert.equal(guiContract.settings_navigation.refresh_source, 'opl app state --profile fast --json');
  assert.equal(guiContract.settings_navigation.primary_tabs.general.label_zh, '总览');
  assert.equal(guiContract.settings_navigation.primary_tabs.environment.label_en, 'Maintenance & Updates');
  assert.deepEqual(guiContract.settings_navigation.secondary_page_ids, [
    'advanced',
    'about',
    'update',
    'theme',
    'local-services',
  ]);
  assert.deepEqual(guiContract.settings_navigation.ordinary_groups.map((group) => group.id), [
    'overview',
    'setup_access',
    'capabilities',
    'resources',
    'maintenance',
    'data_storage',
    'preferences',
    'advanced',
  ]);
  assert.equal(guiContract.settings_navigation.settings_ia.schema, 'settings_ia.v1');
  assert.equal(guiContract.settings_navigation.settings_ia.authority, 'one-person-lab-app');
  assert.deepEqual(guiContract.settings_navigation.settings_ia.ordinary_route_ids, [
    'general',
    'access',
    'workspace',
    'capabilities',
    'resources',
    'environment',
    'storage',
    'appearance',
  ]);
  assert.deepEqual(guiContract.settings_navigation.settings_ia.secondary_or_deep_link_route_ids, [
    'advanced',
    'about',
    'update',
    'theme',
    'local-services',
  ]);
  assert.deepEqual(guiContract.settings_navigation.settings_ia.group_ids, [
    'overview',
    'setup_access',
    'capabilities',
    'resources',
    'maintenance',
    'data_storage',
    'preferences',
    'advanced',
  ]);
  assert.equal(
    guiContract.settings_navigation.settings_ia.route_identity_policy,
    'keep_current_shell_route_ids_distinct_from_user_facing_ia_groups',
  );
  assert.equal(
    guiContract.settings_navigation.settings_ia.route_promotion_policy,
    'secondary_or_deep_link_routes_must_not_be_promoted_to_ordinary_routes_without_contract_matrix_validator_and_test_updates',
  );
  assert.deepEqual(guiContract.settings_navigation.settings_ia.user_task_entries.map((entry) => entry.id), [
    'model_access',
    'local_runtime_ability',
    'workspace',
    'maintenance_hub',
    'capability_status',
    'remote_access',
    'advanced_deployment',
    'developer_profile_status',
    'external_tools_voice',
    'custom_assistant',
  ]);
  assert.equal(
    guiContract.settings_navigation.settings_ia.user_task_entries.find((entry) => entry.id === 'workspace')
      .route_id,
    'workspace',
  );
  assert.deepEqual(
    guiContract.settings_navigation.settings_ia.user_task_entries.find((entry) => entry.id === 'maintenance_hub')
      .secondary_route_ids,
    ['local-services', 'update'],
  );
  assert.deepEqual(guiContract.settings_navigation.settings_ia.protocols.issue_queue.statuses, [
    'needs_action',
    'in_progress',
    'resolved',
    'blocked',
    'dismissed',
  ]);
  assert.equal(
    guiContract.settings_navigation.settings_ia.protocols.action_catalog.action_route,
    'opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json',
  );
  assert.deepEqual(guiContract.settings_navigation.settings_ia.protocols.settings_search, {
    scope: 'ordinary_route_labels_user_task_entries_and_action_keywords',
    result_policy: 'filter_settings_navigation_without_changing_current_page_until_user_selects_a_result',
    empty_state: 'show_no_matching_settings_without_exposing_internal_route_ids',
  });
  assert.deepEqual(guiContract.settings_navigation.settings_ia.protocols.card_protocol.required_fields, [
    'id',
    'title',
    'state',
    'summary',
    'recommended_action',
    'last_checked_at',
    'details_disclosure',
  ]);
  assert.deepEqual(guiContract.settings_navigation.settings_ia.protocols.confirmation_drawer.required_fields, [
    'action_id',
    'summary',
    'will_change',
    'will_not_change',
    'rollback_or_receipt',
    'requires_preview_or_proof',
  ]);
  assert.equal(
    guiContract.settings_navigation.settings_ia.protocols.confirmation_drawer.copy_policy,
    'must_explain_what_changes_what_does_not_change_and_the_recovery_reference_before_mutation',
  );
  assert.deepEqual(guiContract.settings_navigation.settings_ia.protocols.post_update_notice.required_fields, [
    'component_id',
    'result',
    'receipt_ref',
    'next_check',
    'restart_or_reload_guidance',
  ]);
  assert.equal(
    guiContract.settings_navigation.settings_ia.protocols.post_update_notice.visibility_policy,
    'ordinary_layer_after_mutation_or_background_action_until_next_refresh',
  );
  assert.equal(
    guiContract.settings_navigation.settings_ia.protocols.post_update_notice.receipt_policy,
    'show_receipt_ref_without_claiming_domain_or_release_readiness',
  );
  assert.deepEqual(guiContract.settings_navigation.settings_ia.protocols.make_usable_action, {
    label_en: 'Make OPL usable',
    label_zh: '让 OPL 可用',
    placement: 'settings_environment.maintenance_hub.primary_action',
    orchestration_policy: 'shell_orchestrates_existing_app_and_managed_update_actions_only',
    allowed_steps: [
      'run existing repair prep',
      'check managed update status',
      'repair components with explicit repair receipt',
      'apply safe non-restart package or Codex Surface sync actions',
      'refresh fast App state',
    ],
    must_not: [
      'implement a second updater kernel',
      'write runtime truth, domain truth, owner receipts, or typed blockers',
      'silently apply OPL Runtime Fabric changes that require restart',
      'silently update dirty or developer checkouts',
      'rollback automatically without explicit per-component user confirmation',
    ],
    post_action_notice:
      'show restart or reload guidance from managed update status/result without claiming domain, release, or production readiness',
  });
  assert.equal(
    guiContract.settings_navigation.settings_ia.protocols.diagnostics.default_visibility,
    'collapsed_advanced_only',
  );
  assert.equal(
    guiContract.settings_navigation.settings_ia.protocols.deep_link_policy.unknown_route_policy,
    'redirect_to_nearest_app_owned_settings_group',
  );
  assert.deepEqual(guiContract.settings_navigation.settings_ia.protocols.visual_qa_expectations.required_targets, [
    'desktop_settings_overview',
    'desktop_settings_access',
    'desktop_settings_workspace',
    'desktop_settings_capabilities',
    'desktop_settings_resources',
    'desktop_settings_maintenance',
    'desktop_settings_storage',
    'desktop_settings_preferences',
    'mobile_settings_section_nav',
    'mobile_settings_preferences',
  ]);
  assert.deepEqual(
    Object.fromEntries(
      pageStateMatrix.pages
        .filter((page) => page.settings_ia_ref === 'contracts/app-gui-product-contract.json#settings_navigation.settings_ia')
        .map((page) => [page.id, { route_id: page.route_id, route_scope: page.route_scope, ia_group: page.ia_group }]),
    ),
    {
      settings_general: { route_id: 'general', route_scope: 'ordinary', ia_group: 'overview' },
      access: { route_id: 'access', route_scope: 'ordinary', ia_group: 'setup_access' },
      capabilities: { route_id: 'capabilities', route_scope: 'ordinary', ia_group: 'capabilities' },
      settings_resources: { route_id: 'resources', route_scope: 'ordinary', ia_group: 'resources' },
      environment: { route_id: 'environment', route_scope: 'ordinary', ia_group: 'maintenance' },
      settings_local_services: {
        route_id: 'local-services',
        route_scope: 'secondary_or_deep_link',
        ia_group: 'maintenance',
      },
      storage: { route_id: 'storage', route_scope: 'ordinary', ia_group: 'data_storage' },
      about: { route_id: 'about', route_scope: 'secondary_or_deep_link', ia_group: 'advanced' },
      update: { route_id: 'update', route_scope: 'secondary_or_deep_link', ia_group: 'maintenance' },
      settings_theme: { route_id: 'theme', route_scope: 'secondary_or_deep_link', ia_group: 'preferences' },
      advanced: { route_id: 'advanced', route_scope: 'secondary_or_deep_link', ia_group: 'advanced' },
      settings_workspace: { route_id: 'workspace', route_scope: 'ordinary', ia_group: 'overview' },
    },
  );
  assert.deepEqual(guiContract.settings_navigation.primary_tabs.storage, {
    label_zh: '存储',
    label_en: 'Data & Storage',
    role: 'safe_local_data_lifecycle_inventory_and_cleanup',
    primary_question: 'Which local data roots are using space, and which cleanup actions are safe after preview or proof?',
    ia_group: 'data_storage',
    ordinary_entry_policy: 'top_level_control_center_group_entry',
  });
  assert.deepEqual(guiContract.settings_navigation.primary_tabs.capabilities, {
    label_zh: '能力',
    label_en: 'Capabilities',
    role: 'installed_package_directory_and_home_shortcut_management',
    primary_question: 'Which packages are installed, how are they exposed on Home, and what can OPL help me do?',
    ia_group: 'capabilities',
    ordinary_entry_policy: 'top_level_control_center_route',
  });
  assert.equal(
    guiContract.pages.settings_storage.release_contract_ref,
    'contracts/app-release-channel.json#local_data_lifecycle',
  );
  assert.equal(
    guiContract.pages.settings_storage.state_source,
    'active shell local data lifecycle service + contracts/app-release-channel.json#local_data_lifecycle',
  );
  for (const [pageId, expected] of Object.entries(expectedSettingsPageSections)) {
    assert.deepEqual(guiContract.pages[pageId].sections, expected.sections);
    for (const item of expected.mustShow) {
      assert.ok(guiContract.pages[pageId].must_show.includes(item), `${pageId} must show ${item}`);
    }
    for (const item of expected.mustNotShow) {
      assert.ok(guiContract.pages[pageId].must_not_show.includes(item), `${pageId} must not show ${item}`);
    }
  }
  assert.equal(
    guiContract.pages.settings_capabilities.builtin_skill_catalog_policy.allowed_set_ref,
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids + packaged_not_default_visible_codex_skill_ids',
  );
  assert.ok(
    guiContract.pages.settings_capabilities.builtin_skill_catalog_policy.forbidden_examples.includes('aionui-skills'),
  );
  assert.equal(
    guiContract.pages.settings_capabilities.auto_injected_skills_policy.allowed_set_ref,
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids',
  );
  assert.equal(
    guiContract.pages.settings_capabilities.task_awareness_refs_source,
    'contracts/app-runtime-bridge.json#task_awareness_projection.settings_capabilities_surface',
  );
  assert.deepEqual(guiContract.pages.settings_capabilities.task_awareness_ref_fields, [
    'capability_health_refs',
    'connector_readiness_refs',
    'workflow_refs',
    'export_bundle_action_ref',
    'resource_source_refs',
    'gateway_status_ref',
    'environment_ref',
    'environment_template_ref',
    'environment_version_ref',
    'environment_source_ref',
    'environment_task_refs',
    'console_policy_ref',
    'storage_ref',
    'resource_receipt_ref',
    'cost_estimate_ref',
    'candidate_report_refs',
    'workflow_skill_candidate_refs',
  ]);
  assert.equal(
    guiContract.pages.settings_capabilities.task_awareness_ref_policy,
    'thin_renderer_refs_only_no_skill_body_no_artifact_body_no_domain_verdict',
  );
  assert.equal(
    guiContract.pages.settings_capabilities.export_bundle_action_policy,
    'show_export_bundle_action_ref_and_dry_run_receipt_without_claiming_domain_export_readiness',
  );
  assert.deepEqual(guiContract.pages.settings_capabilities.primary_identity_policy, {
    surface: 'installed_package_directory',
    package_identity_fields: ['package_id', 'display_name', 'package_short_name'],
    purpose_role: 'secondary_tag_filter_only',
    home_shortcut_integration: 'inline_visibility_and_order_controls_on_package_rows',
    supporting_surfaces: ['skills', 'tools', 'external_tools_voice', 'custom_assistants'],
  });
  assert.deepEqual(guiContract.pages.settings_capabilities.current_runtime_projection_boundary, {
    canonical_projection:
      'opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index',
    legacy_fallback_projection:
      'opl app state --profile fast --json#app_state.modules.items[] + home_agent_shortcuts + app_state.operator.workbench.task_drilldowns',
    normalization_policy:
      'shell must prefer canonical agent_packages projection and only fall back to modules.items when older runtime payloads or partial projections are still in circulation',
    developer_source_examples: [
      'health_status=dirty',
      'source_policy.effective_install_update_source=git_checkout',
      'source_policy.configured_by=developer_mode',
      'git.sync_status=behind',
      'git.dirty=true',
      'health_status=ready + recommended_action=update',
    ],
    completion_boundary:
      'this contract requires canonical agent_packages projection and allows modules.items fallback only as rollout compatibility',
  });
  assert.deepEqual(guiContract.pages.settings_capabilities.status_model, {
    policy: 'multi_axis_package_status_no_single_repair_bucket',
    axes: ['install_state', 'update_state', 'source_state', 'trust_state', 'codex_surface_state'],
    source_inputs: [
      'app_state.agent_packages.directory.installed_packages[]',
      'app_state.agent_packages.status_index.packages[]',
      'app_state.agent_packages.status_index.home_shortcut_preferences[]',
      'modules.items[].health_status',
      'modules.items[].recommended_action',
      'modules.items[].source_policy.effective_install_update_source',
      'modules.items[].source_policy.configured_by',
      'modules.items[].git.sync_status',
      'modules.items[].git.dirty',
      'managed_update_plane.capability_packages',
      'managed_update_plane.codex_surface',
    ],
    developer_source_policy:
      'developer checkout semantics must surface explicitly and must not be collapsed into a generic repair bucket',
    must_not_collapse: ['developer_checkout', 'dirty_checkout', 'git_behind', 'unknown', 'needs_sync'],
  });
  assert.deepEqual(guiContract.pages.settings_capabilities.list_density_policy, {
    row_identity_key: 'package_id',
    primary_row_fields: [
      'display_name',
      'package_short_name',
      'purpose_tags',
      'home_shortcut_visible',
      'home_shortcut_order',
      'install_state',
      'update_state',
      'source_state',
      'trust_state',
      'codex_surface_state',
      'recommended_action',
    ],
    detail_surface: 'desktop_right_side_panel_mobile_drawer',
    default_detail_fields: [
      'purpose',
      'status',
      'codex_availability',
      'home_shortcut',
      'version',
      'source_label',
      'last_synced_at',
      'failure_reason_when_failed',
    ],
    content_block_policy:
      'show_connectors_workflows_environment_resources_and_reproducibility_export_only_when_real_projection_data_or_action_refs_exist',
    advanced_diagnostic_fields: [
      'package_id',
      'codex_visible_entry',
      'receipt_refs',
      'rollback_ref',
      'action_receipt_ref',
      'physical_surface',
      'paths',
      'manifest_ref',
      'cache_config',
      'marketplace_config',
      'raw_refs_json',
    ],
    first_screen_policy:
      'default detail shows user-decision fields only; raw package_id, codex_visible_entry, receipt refs, paths, manifest, cache, and marketplace config stay collapsed in Advanced diagnostics',
    empty_field_policy:
      'hide empty, unknown, unavailable, not_applicable, null, or unreported fields; never render 未报告 or Not reported as default user detail text',
  });
  assert.deepEqual(guiContract.pages.settings_capabilities.capability_detail_presentation_policy, {
    default_layer: 'user_decision_detail',
    default_surface: 'desktop_right_side_panel_mobile_drawer',
    default_visible_fields: [
      'purpose',
      'status',
      'codex_availability',
      'home_shortcut',
      'version',
      'source_label',
      'last_synced_at',
      'failure_reason_when_failed',
    ],
    source_label_policy:
      'render source in user language such as OPL Packages, local developer checkout, organization registry, or user registry; do not show raw source ids by default',
    failure_reason_policy: 'show failure reason only when the capability is failed, blocked, or needs user action',
    empty_field_policy:
      'hide empty, unknown, unavailable, not_applicable, null, or unreported fields; never render 未报告 or Not reported as default user detail text',
    content_blocks: [
      {
        id: 'connectors',
        label: 'connectors',
        source_ref: 'connector_readiness_refs',
        default_visibility: 'visible_only_when_non_empty',
      },
      {
        id: 'reusable_workflows',
        label: 'reusable workflows',
        source_ref: 'workflow_refs',
        default_visibility: 'visible_only_when_non_empty',
      },
      {
        id: 'environment_resources',
        label: 'environment resources',
        source_ref: 'environment_ref + resource_source_refs',
        default_visibility: 'visible_only_when_non_empty',
      },
      {
        id: 'reproducibility_export_action',
        label: 'reproducibility export action',
        source_ref: 'export_bundle_action_ref',
        default_visibility: 'visible_only_when_action_available',
      },
    ],
    advanced_diagnostics: {
      default_visibility: 'collapsed',
      surface: 'advanced_diagnostics_disclosure_or_advanced_route',
      fields: [
        'package_id',
        'codex_visible_entry',
        'receipt_refs',
        'rollback_ref',
        'action_receipt_ref',
        'physical_surface',
        'paths',
        'manifest_ref',
        'cache_config',
        'marketplace_config',
        'raw_refs_json',
      ],
    },
  });
  assert.ok(
    guiContract.pages.settings_capabilities.must_show.includes(
      'builtin skill catalog and auto-injected skills filtered to App packaged skill ids',
    ),
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_show.includes(
      'capability health and connector readiness refs from OPL App state',
    ),
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_show.includes('reusable workflow refs without skill bodies'),
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_show.includes(
      'reproducibility export bundle action ref with dry-run receipt boundary',
    ),
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_show.includes(
      'workflow and skill candidate report-first refs with review, needs changes, and continue in conversation actions',
    ),
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_not_show.includes(
      'AionUI implementation skills such as aionui-skills',
    ),
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_not_show.includes(
      'artifact body, workflow body, connector body, credential body, owner receipt write, or domain export readiness verdict from Settings Capabilities',
    ),
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_not_show.includes(
      'auto-enabled skills, skill body writes, or workflow body writes from Settings Capabilities candidate refs',
    ),
  );
  assert.equal(guiContract.pages.settings_capabilities.workflow_skill_candidate_policy.report_first, true);
  assert.equal(guiContract.pages.settings_capabilities.workflow_skill_candidate_policy.auto_enable_allowed, false);
  assert.equal(guiContract.pages.settings_capabilities.workflow_skill_candidate_policy.skill_body_write_access, false);
  assert.ok(guiContract.pages.settings_capabilities.auto_injected_skills_policy.forbidden_examples.includes('aionui-skills'));
  assert.equal(guiContract.desktop_tray_policy.default_visible, true);
  assert.equal(guiContract.desktop_tray_policy.desktop_startup_behavior, 'create_tray_by_default');
  assert.equal(guiContract.desktop_tray_policy.e2e_startup_behavior, 'destroy_tray_and_disable_close_to_tray');
  assert.equal(guiContract.desktop_tray_policy.close_to_tray_role, 'window_close_behavior_only');
  assert.equal(guiContract.desktop_tray_policy.settings_key, 'system.closeToTray');
  assert.equal(guiContract.desktop_tray_policy.must_not_gate_tray_visibility_on_close_to_tray, true);
  assert.equal(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.target_route,
    '/guid',
  );
  assert.equal(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.route_state,
    'postInstallSelfCheck',
  );
  assert.deepEqual(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.target_state_checks,
    [
      'codex_cli_callable',
      'ui_language_policy',
      'session_scoped_opl_flow_context',
      'user_agents_md_respected_no_overwrite',
      'mas_mag_rca_routes_visible',
      'opl_meta_agent_capability_visible',
      'codex_skills_plugins_visible',
      'module_update_skill_plugin_continuity',
    ],
  );
  assert.equal(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.mutation_policy,
    'diagnose_first_no_file_mutation_without_user_confirmation',
  );
  assert.equal(
    guiContract.module_path_source_policy.source,
    'app_state.modules[].source + app_state.modules[].path + app_state.paths',
  );
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from the bundled Full runtime payload'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from the App/CLI-managed GHCR OCI Agent Packages latest channel'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from the App/CLI-managed GHCR OCI Agent Packages rolling latest channel'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from a local domain repository checkout'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether Developer Profile source_channel uses a GitHub repo or local checkout'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module is managed by App/CLI maintenance'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('that module path display is refs-only and not domain truth authority'));
  assert.equal(guiContract.module_path_source_policy.ordinary_user_source, 'app_cli_managed_ghcr_oci_agent_packages_latest_channel');
  assert.equal(guiContract.module_path_source_policy.ordinary_user_transport, 'app_cli_managed');
  assert.equal(guiContract.module_path_source_policy.developer_override_surface, 'Developer Profile source_channel capability');
  assert.equal(guiContract.module_path_source_policy.developer_override_policy, 'explicit_opt_in_only');
  assert.equal(guiContract.module_path_source_policy.developer_profile_ref, 'developer_profile.capabilities.source_channel');
  assert.deepEqual(guiContract.developer_profile.capability_axes, [
    'source_channel',
    'workspace_trust',
    'github_authority',
    'agent_automation',
    'runtime_mutation_scope',
  ]);
  assert.equal(guiContract.developer_profile.default_profile, 'standard_user');
  assert.equal(guiContract.developer_profile.opt_in_policy, 'explicit_opt_in_only');
  assert.equal(guiContract.developer_profile.ordinary_user_defaults.source_channel, 'agent_rolling_latest_package_channel');
  assert.equal(guiContract.developer_profile.ordinary_user_defaults.agent_automation, 'automatic_clean_managed_agent_package_updates');
  assert.equal(guiContract.developer_profile.capabilities.source_channel.developer_opt_in, 'github_repo_or_local_checkout');
  assert.equal(guiContract.developer_profile.capabilities.workspace_trust.standard_default, 'selected_workspace_only');
  assert.equal(guiContract.developer_profile.capabilities.github_authority.developer_opt_in, 'repo_checkout_and_remote_intent_visible');
  assert.equal(guiContract.developer_profile.capabilities.agent_automation.standard_default, 'automatic_clean_managed_agent_package_updates');
  assert.equal(guiContract.developer_profile.capabilities.runtime_mutation_scope.standard_default, 'app_action_route_only');
  assert.equal('legacy_developer_mode_alias' in guiContract.developer_profile, false);
  assert.ok(guiContract.module_path_source_policy.must_not_use.includes('raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI'));
  assert.equal(guiContract.pages.settings_environment.module_path_source_policy_ref, 'module_path_source_policy');
  assert.ok(guiContract.pages.about.must_show.includes('OPL Framework revision'));
  assert.equal(guiContract.theme_and_branding.default_theme_id, 'default-theme');
  assert.deepEqual(guiContract.theme_and_branding.allowed_theme_ids, ['default-theme', 'codex']);
  assert.ok(guiContract.pages.settings_theme.must_show.includes('Default theme option'));
  assert.ok(guiContract.pages.settings_theme.must_show.includes('Codex theme option'));
  assert.deepEqual(
    guiContract.release_channel_policy.stable.must_gate,
    releaseContract.release_validation_profiles.stable.required_lanes,
  );
  assert.deepEqual(
    guiContract.release_channel_policy.stable.diagnostic_gate,
    releaseContract.release_validation_profiles.stable.diagnostic_lanes,
  );
  assert.equal(
    releaseContract.release_validation_profiles.stable.required_lanes.includes('operator_evidence_bundle'),
    false,
  );
  assert.deepEqual(
    releaseContract.release_validation_profiles.stable.diagnostic_lanes,
    ['operator_evidence_bundle'],
  );
  assert.deepEqual(
    guiContract.release_channel_policy.nightly.must_gate,
    releaseContract.release_validation_profiles.nightly_standard.required_lanes,
  );
  assert.deepEqual(
    guiContract.release_channel_policy.nightly.must_not_gate,
    releaseContract.release_validation_profiles.nightly_standard.forbidden_lanes,
  );
  assert.equal(
    releaseContract.operator_evidence_bundle.release_owner_verdict.release_ready_claim_allowed,
    false,
  );
  assert.equal(
    releaseContract.operator_evidence_bundle.release_owner_verdict.stable_latest_promotion_claim_allowed,
    false,
  );
  assert.equal(
    releaseContract.operator_evidence_bundle.release_owner_verdict.authority_boundary.can_claim_app_release_ready_from_evidence,
    false,
  );
  assert.equal(
    releaseContract.operator_evidence_bundle.release_owner_verdict.authority_boundary.can_claim_stable_latest_from_evidence,
    false,
  );
  assert.equal(
    productProfile.boundary.release_evidence_scope.classification,
    'cohort_bound_app_user_path_evidence',
  );
  assert.ok(productProfile.boundary.release_evidence_scope.must_not_imply.includes('stable_latest_promotion'));
  assert.ok(productProfile.boundary.release_evidence_scope.must_not_imply.includes('App release-ready without promotion decision'));
  assert.ok(!('docker_webui' in guiContract));
  assert.doesNotMatch(JSON.stringify(guiContract), /username input gate|must_skip_username_input|manifest_name|logo_policy/);
});
