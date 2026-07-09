export const appOwnedProjectGroupExpansionPolicy = {
  running_group_default: "expanded",
  attention_group_default: "visible_when_nonempty",
  inactive_group_default: "collapsed",
  inactive_states: [
    "queued",
    "pending",
    "waiting",
    "stopped",
    "parked",
    "checkpointed",
    "blocked",
    "attention_needed",
  ],
  inactive_summary_fields: [
    "count",
    "status",
    "next_visible_step",
    "runtime_closeout_observed",
    "runtime_closeout_ref",
    "mas_owner_consumption_status",
    "mas_owner_consumed_stage_attempt_id",
    "mas_owner_consumption_matches_runtime_closeout",
  ],
};

export const appOwnedPrimaryGroupingPolicy = {
  default_order: [
    "in_progress",
    "delivered_auto_paused",
    "paused_waiting_for_direction",
    "owner_decision_required",
    "system_attention_required",
  ],
  collapsed_groups: ["delivered_auto_paused", "paused_waiting_for_direction"],
  secondary_badge_fields: [
    "automation_state_label",
    "active_stage_label",
    "last_progress_at",
  ],
};

export const appOwnedRunningStatePolicy =
  "only explicit running, in_progress, or advancing status/state counts as running; active_run_id alone is context, not liveness proof; queued, pending, and waiting require explicit projected status; blocked or attention_needed stay blocked/attention states; stopped, parked, and checkpointed stay inactive and must not be relabeled queued";

export const appOwnedRuntimeMentalModel = [
  "agent/capability: which agent, capability package, or module is responsible",
  "project: which project line, study, or deliverable track this work belongs to",
  "task/work item: the user-visible unit that is advancing, waiting, or blocked",
  "execution run: the current stage run, heartbeat, usage, and blocker route for this task",
];

export const runtimeScopeRequiredFields = [
  "scope_options",
  "current_scope",
  "scope_source",
  "inferred_scope_hint",
];

export const runtimePrimaryStateValues = [
  "in_progress",
  "delivered_auto_paused",
  "paused_waiting_for_direction",
  "owner_decision_required",
  "system_attention_required",
];

export const runtimeAutomationStateValues = [
  "automation_running",
  "automation_idle",
  "result_pending_terminalization",
  "automation_failed",
];

export const workItemProjectionRequiredFields = [
  "work_item_id",
  "work_item_ref",
  "project_ref",
  "agent",
  "stage",
  "attempt",
  "status",
  "conditions",
  "next_action",
  "evidence",
];

export const workItemConditionFields = [
  "type",
  "status",
  "reason",
  "message",
  "owner",
  "last_transition_time",
  "observed_generation",
];

export const actionEnvelopeKinds = [
  "user_action",
  "system_action",
  "agent_action",
  "safe_action",
  "blocked_no_action",
];

export const workItemDetailTabs = [
  "stage_map",
  "timeline",
  "evidence",
  "actions",
  "resources",
  "diagnostics",
];

export const appOwnedQueueStatusPolicy =
  "queued, pending, and waiting require explicit projected status; blocked or attention_needed stay blocked/attention states; stopped, parked, and checkpointed stay inactive; non-running must never be inferred as queued";

export const appOwnedAgentModuleStatusPanel = {
  source: "task capability/module refs separated from task liveness",
  display_policy:
    "render agent, capability, connector, and module status in a dedicated panel instead of mixing them into stage/run telemetry",
  required_ref_fields: [
    "connector_readiness_refs",
    "diagnostic_substrate_refs",
    "gateway_status_ref",
  ],
  optional_ref_fields: ["capability_health_refs"],
  telemetry_missing_copy: "module status unavailable",
};

export const taskRunProjectionV2RequiredFields = [
  "task_identity",
  "status",
  "progress",
  "conditions",
  "evidence_cards",
  "action_cards",
  "resource_cards",
  "diagnostics_ref",
];

export const taskRunProjectionV2FieldGroups = {
  task_identity: [
    "task_id",
    "title",
    "domain_id",
    "domain_label",
    "study_id",
    "task_ref",
    "agent_display_name",
    "project_display_name",
    "work_item_display_name",
    "execution_run_label",
  ],
  status: [
    "state",
    "status",
    "status_label",
    "priority_bucket",
    "primary_state",
    "primary_state_label",
    "primary_state_reason",
    "automation_state",
    "automation_state_label",
    "automation_state_reason",
    "active_stage_id",
    "active_stage_label",
    "active_run_ref",
  ],
  progress: [
    "progress_label",
    "current_step",
    "last_progress_at",
    "progress_ref",
    "stage_ref",
  ],
  conditions: [
    "type",
    "status",
    "reason",
    "message",
    "severity",
    "owner",
    "last_transition_time",
    "ref",
  ],
  evidence_cards: [
    "card_id",
    "kind",
    "owner",
    "updated_at",
    "title",
    "summary",
    "ref",
    "why_it_matters",
    "open_action",
    "content_policy",
  ],
  action_cards: [
    "card_id",
    "risk",
    "write_targets",
    "expected_output",
    "rollback_ref",
    "verify_ref",
    "title",
    "summary",
    "ref",
    "action_ref",
    "open_action",
    "dry_run_required",
    "content_policy",
  ],
  resource_cards: [
    "card_id",
    "resource_kind",
    "owner",
    "title",
    "summary",
    "ref",
    "status_ref",
    "usage_ref",
    "quota_ref",
    "permission_ref",
    "cost_estimate_ref",
    "open_action",
    "content_policy",
  ],
  diagnostics_ref: ["diagnostics_ref"],
};

export const forbiddenAuthorityOwners = [
  "runtime_truth",
  "provider_implementation",
  "domain_truth",
  "domain_quality_verdict",
  "domain_artifact_authority",
];
export const beginnerFirstRunTestIds = [
  "opl-startup-preflight",
  "opl-first-run-beginner-summary",
  "opl-first-run-initialize-pending",
  "opl-first-run-primary-action",
  "opl-first-run-technical-details-toggle",
];
export const appOwnedSettingsTabs = [
  "general",
  "access",
  "workspace",
  "capabilities",
  "resources",
  "environment",
  "storage",
  "appearance",
];
export const appOwnedTaskAwarenessRefFields = [
  "capability_health_refs",
  "connector_readiness_refs",
  "workflow_refs",
  "export_bundle_action_ref",
  "resource_source_refs",
  "gateway_status_ref",
  "environment_ref",
  "environment_template_ref",
  "environment_version_ref",
  "environment_source_ref",
  "environment_task_refs",
  "console_policy_ref",
  "storage_ref",
  "resource_receipt_ref",
  "cost_estimate_ref",
  "candidate_report_refs",
  "workflow_skill_candidate_refs",
];
export const appOwnedSecondarySettingsPages = [
  "advanced",
  "about",
  "update",
  "theme",
  "local-services",
];
export const appActionRoute =
  "opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json";
export const appOwnedSettingsIaGroupIds = [
  "overview",
  "setup_access",
  "capabilities",
  "resources",
  "maintenance",
  "data_storage",
  "preferences",
  "advanced",
];
export const appOwnedSettingsRouteScopes = {
  settings_general: { route_id: "general", route_scope: "ordinary" },
  access: { route_id: "access", route_scope: "ordinary" },
  capabilities: { route_id: "capabilities", route_scope: "ordinary" },
  resources: { route_id: "resources", route_scope: "ordinary" },
  environment: { route_id: "environment", route_scope: "ordinary" },
  storage: { route_id: "storage", route_scope: "ordinary" },
  settings_theme: { route_id: "theme", route_scope: "secondary_or_deep_link" },
  advanced: { route_id: "advanced", route_scope: "secondary_or_deep_link" },
  about: { route_id: "about", route_scope: "secondary_or_deep_link" },
  update: { route_id: "update", route_scope: "secondary_or_deep_link" },
  workspace: { route_id: "workspace", route_scope: "ordinary" },
  local_services: {
    route_id: "local-services",
    route_scope: "secondary_or_deep_link",
  },
};
export const appOwnedSettingsTaskEntryIds = [
  "model_access",
  "local_runtime_ability",
  "workspace",
  "maintenance_hub",
  "capability_status",
  "remote_access",
  "advanced_deployment",
  "developer_profile_status",
  "external_tools_voice",
  "custom_assistant",
];
export const appOwnedSettingsTaskEntryMetadataFields = [
  "scope",
  "intent",
  "risk",
  "frequency",
];
export const appOwnedSettingsTopLevelEntryIds = [
  "overview",
  "access",
  "workspace",
  "capabilities",
  "resources",
  "maintenance",
  "storage",
  "preferences",
];
export const appOwnedSettingsProjectionSectionIds = [
  "summary",
  "access",
  "workspace",
  "capabilities",
  "resources",
  "maintenance",
  "storage",
  "diagnostics",
];
export const appOwnedSettingsProjectionItemFields = [
  "scope",
  "owner",
  "risk",
  "normal_summary",
  "next_action",
  "details_ref",
  "editable_reason",
];
export const appOwnedSettingsIssueStatuses = [
  "needs_action",
  "in_progress",
  "resolved",
  "blocked",
  "dismissed",
];
export const appOwnedSettingsSearchProtocol = {
  scope: "ordinary_route_labels_user_task_entries_and_action_keywords",
  result_policy:
    "filter_settings_navigation_without_changing_current_page_until_user_selects_a_result",
  empty_state: "show_no_matching_settings_without_exposing_internal_route_ids",
};
export const appOwnedSettingsCardFields = [
  "id",
  "title",
  "state",
  "summary",
  "recommended_action",
  "last_checked_at",
  "details_disclosure",
];
export const appOwnedSettingsConfirmationFields = [
  "action_id",
  "summary",
  "will_change",
  "will_not_change",
  "rollback_or_receipt",
  "requires_preview_or_proof",
];
export const appOwnedSettingsPostUpdateNoticeFields = [
  "component_id",
  "result",
  "receipt_ref",
  "next_check",
  "restart_or_reload_guidance",
];
export const appOwnedSettingsMakeUsableAllowedSteps = [
  "run existing repair prep",
  "check managed update status",
  "repair components with explicit repair receipt",
  "apply safe non-restart package or Codex Surface sync actions",
  "refresh fast App state",
];
export const appOwnedSettingsMakeUsableForbiddenSteps = [
  "implement a second updater kernel",
  "write runtime truth, domain truth, owner receipts, or typed blockers",
  "silently apply OPL Runtime Fabric changes that require restart",
  "silently update dirty or developer checkouts",
  "rollback automatically without explicit per-component user confirmation",
];
export const appOwnedSettingsVisualQaTargets = [
  "desktop_settings_overview",
  "desktop_settings_access",
  "desktop_settings_workspace",
  "desktop_settings_capabilities",
  "desktop_settings_resources",
  "desktop_settings_maintenance",
  "desktop_settings_storage",
  "desktop_settings_preferences",
  "mobile_settings_section_nav",
  "mobile_settings_preferences",
];
export const appOwnedSettingsUpstreamIntakeClassifications = [
  "accepted",
  "adapt",
  "redirect",
  "reject",
];
export const appOwnedSettingsProductSystemItemIds = [
  "control_center_positioning",
  "eight_entry_ia",
  "secondary_route_strategy",
  "single_control_plane",
  "host_adapter_slot",
  "view_model_layer",
  "issue_action_protocol",
  "make_opl_usable_reconcile",
  "maintenance_noise_reduction",
  "update_rollback_ux",
  "workspace_task_page",
  "local_services_page",
  "access_information_architecture",
  "capabilities_experience",
  "data_storage_safety",
  "preferences_purity",
  "advanced_diagnostics",
  "developer_profile_warning",
  "user_copy_system",
  "settings_search",
  "visual_system",
  "screenshot_qa",
  "contract_validators",
  "worktree_lane_hygiene",
  "installed_release_currentness",
];
export const appOwnedSettingsProductSystemTracks = [
  "product_positioning",
  "ia_routes",
  "control_plane",
  "shell_adapter",
  "state_action_protocol",
  "user_task_ux",
  "visual_qa",
  "ops_hygiene",
  "release_currentness",
];
export const legacySettingsRouteRedirects = {
  overview: "general",
  runtime: "environment",
  system: "advanced",
  model: "environment",
  agent: "capabilities",
  assistants: "capabilities",
  "skills-hub": "capabilities",
  tools: "capabilities",
  display: "appearance",
  webui: "resources",
  pet: "appearance",
};
const homeActivityCenterItemFields = [
  "task_id",
  "title",
  "domain_label",
  "state",
  "active_stage_label",
  "next_visible_step",
  "blocker_ref_count",
  "last_progress_at",
];
export const homeActivityCenterForbiddenDisplays = [
  "domain artifact body",
  "memory body",
  "quality verdict body",
  "provider implementation details",
];
export const appOwnedHomeLayout = {
  default_mode: "composer_first_chat_canvas",
  first_screen_policy: "chat_first_no_dashboard_or_landing_copy",
  composer_position: "pinned_bottom",
  composer_primary: true,
  workspace_selector_visible: true,
  purpose_entries_visible: ["research", "grant", "ppt", "book"],
  workspace_session_rail_default_state: "collapsed",
  right_context_inspector_default_state: "collapsed",
  must_not_show: [
    "dashboard-first home",
    "explanatory landing page",
    "backend settings panel in composer",
    "AionUI Team nav entry",
    "AionUI Team page as ordinary App surface",
  ],
};
const appOwnedOrdinaryConversation = {
  path_id: "ordinary_codex_conversation",
  entry_source: "home_purpose_entry_or_new_conversation",
  executor: "codex_cli",
  composer_position: "pinned_bottom",
  purpose_tag_visible: true,
  assistant_route_receipt_required: true,
  backend_selector_visible: false,
  model_selector_visible: true,
  permission_mode_selector_visible: false,
  provider_selector_visible: false,
  model_status_surface: "gui.home.codex_home_model_status_label",
  technical_details_policy:
    "friendly_model_primary_reasoning_primary_model_and_intelligence_secondary_menus",
};
export const appOwnedGuiContractOrdinaryConversation = {
  ...appOwnedOrdinaryConversation,
  model_status_surface: "executor_policy.default_model_display_value",
};
export const appOwnedCurrentTaskSlice = {
  source: "contracts/app-runtime-bridge.json#current_task_slice_projection",
  state_source: "opl app state --profile fast --json",
  scope: "current_conversation_or_selected_task",
  default_visibility: "inline_compact_when_task_active",
  fields: [
    "task_id",
    "status",
    "stage",
    "progress_label",
    "elapsed_seconds",
    "plan_ref",
    "latest_receipt_ref",
    "latest_artifact_ref",
    "task_identity",
    "status",
    "progress",
    "conditions",
    "evidence_cards",
    "action_cards",
    "resource_cards",
    "diagnostics_ref",
    "gateway_status_ref",
    "resource_source_refs",
    "environment_ref",
    "storage_ref",
    "resource_plan_ref",
    "resource_approval_ref",
    "resource_usage_ref",
    "console_policy_ref",
    "environment_template_ref",
    "environment_version_ref",
    "structured_result_panel",
    "artifact_provenance_card",
    "ref_level_follow_up_refs",
  ],
  independent_task_store_allowed: false,
  model_ref: "contracts/app-runtime-bridge.json#task_awareness_projection",
  slice_policy:
    "same_task_run_projection_v2_filtered_by_current_conversation_or_selected_task",
};
export const appOwnedPageStateOrdinaryConversation = {
  ...Object.fromEntries(
    Object.entries(appOwnedOrdinaryConversation).filter(
      ([key]) =>
        key !== "model_status_surface" && key !== "technical_details_policy",
    ),
  ),
  model_status_surface_ref:
    "contracts/app-gui-product-contract.json#executor_policy.default_model_display_value",
  technical_details_policy:
    appOwnedOrdinaryConversation.technical_details_policy,
  current_task_slice: appOwnedCurrentTaskSlice,
};
export const appOwnedRightContextInspectorTabIds = [
  "files",
  "artifacts",
  "review",
  "actions",
  "capabilities",
  "runtime",
  "memory",
  "automations",
  "settings",
];
export const firstRunEcosystemModules = [
  "officecli",
  "mineru",
  "opl-meta-agent",
];
export const temporalLocalServiceDefaults = {
  address_env: "OPL_TEMPORAL_ADDRESS",
  default_address: "127.0.0.1:7233",
  namespace_env: "OPL_TEMPORAL_NAMESPACE",
  default_namespace: "default",
  task_queue_env: "OPL_TEMPORAL_TASK_QUEUE",
  default_task_queue: "opl-stage-attempts",
};
export const temporalManagedCommands = [
  "opl family-runtime service start --provider temporal",
  "opl family-runtime worker status --provider temporal",
  "opl family-runtime worker start --provider temporal",
  "opl family-runtime residency proof --provider temporal --production",
];
