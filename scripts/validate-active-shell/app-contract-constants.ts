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
  "agent_scope_options",
  "selected_agent_scope",
  "project_scope_options",
  "selected_project_scope",
  "scope_source",
  "inferred_scope_hint",
];

export const runtimeFirstPartyAgents = [
  { agent_id: "mas", display_name: "Med Auto Science" },
  { agent_id: "mag", display_name: "Med Auto Grant" },
  { agent_id: "rca", display_name: "RedCube AI" },
  { agent_id: "oma", display_name: "OPL Meta Agent" },
  { agent_id: "obf", display_name: "OPL Book Forge" },
];

export const workItemPrimaryStateLabelsByLocale = {
  "en-US": {
    automatically_advancing: "Automatically advancing",
    awaiting_user_decision: "Waiting for your decision",
    system_attention: "System handling",
    delivered_auto_paused: "Delivered and auto-paused",
    paused: "Paused",
    stopped: "Stopped",
    sync_pending: "Sync pending",
  },
  "zh-CN": {
    automatically_advancing: "自动推进中",
    awaiting_user_decision: "等待你决定",
    system_attention: "系统处理中",
    delivered_auto_paused: "已交付自动暂停",
    paused: "已暂停",
    stopped: "已停止",
    sync_pending: "状态待同步",
  },
};

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
  "item_id",
  "identity",
  "lifecycle",
  "execution",
  "attention",
  "telemetry",
  "conditions",
  "freshness",
  "visibility",
  "action",
];

export const workItemProjectionFieldContracts = {
  identity: [
    "agent_id",
    "agent_display_name",
    "project_id",
    "workspace_path",
    "project_display_name",
    "work_item_id",
    "work_item_display_name",
  ],
  lifecycle: [
    "business_state",
    "primary_state",
    "primary_state_label",
    "reason",
    "last_transition_at",
  ],
  execution: [
    "state",
    "current_stage_id",
    "current_stage_display_name",
    "next_stage_id",
    "next_stage_display_name",
    "started_at",
    "last_heartbeat_at",
  ],
  attention: ["kind", "summary", "owner_display_name", "responsibility"],
  telemetry: ["state", "elapsed", "current_stage_tokens", "task_total_tokens"],
  freshness: ["state", "observed_at", "last_progress_at", "reason"],
  visibility: ["state", "source", "updated_at", "control_ref", "generation"],
  action: [
    "kind",
    "title",
    "title_key",
    "summary",
    "summary_key",
    "message_args",
    "owner",
    "owner_kind",
    "action_ref",
    "dry_run_required",
  ],
};

export const workItemConditionFields = [
  "type",
  "status",
  "reason",
  "message",
  "owner",
  "last_transition_time",
  "observed_generation",
];

export const systemAttentionResponsibilityFields = [
  "responsible_component",
  "issue",
  "repair_action",
  "impact",
  "expected_outcome",
];

export const tokenObservationStates = ["observed", "missing", "stale"];

export const tokenObservationObservedFields = [
  "input_tokens",
  "output_tokens",
  "total_tokens",
  "source",
  "observed_at",
];

export const actionEnvelopeKinds = [
  "user_action",
  "system_action",
  "agent_action",
  "safe_action",
  "blocked_no_action",
];

export const actionOwnerKinds = ["user", "system", "agent", "other"];

export const workItemVisibilityStates = ["visible", "archived"];

export const workItemBusinessStates = [
  "active",
  "delivered_paused",
  "paused",
  "stopped",
  "archived",
  "unknown",
];

export const runtimeVisibilityPageStateIds = [
  "active_empty",
  "archived_empty",
  "archiving",
  "restoring",
  "archive_failed",
  "restore_failed",
  "stale_generation_conflict",
  "locale_en_us",
  "locale_zh_cn",
];

export const workItemDetailPrimarySections = [
  "stage_map",
  "current_and_next_stage",
  "running_and_heartbeat",
  "stage_and_total_tokens",
  "action",
];

export const workItemDetailSecondarySections = ["artifacts", "timeline", "evidence"];

export const workItemDetailDiagnosticSections = [
  "raw_refs",
  "raw_ids",
  "logs",
  "provider_diagnostics",
];

export const appOwnedQueueStatusPolicy =
  "queued, pending, and waiting require explicit projected status; blocked or attention_needed stay blocked/attention states; stopped, parked, and checkpointed stay inactive; non-running must never be inferred as queued";

export const appOwnedAgentModuleStatusPanel = {
  source: "task capability/module refs separated from task liveness",
  display_policy:
    "render agent, capability, connector, and module status in a dedicated panel instead of mixing them into stage/run telemetry; explain dirty or missing states in plain language and suppress zero-workload/no-activity filler",
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
  "opl-first-run-focused-workspace",
  "opl-first-run-step-rail",
  "opl-first-run-task-panel",
  "opl-first-run-access-methods",
  "opl-first-run-gateway-account-method",
  "opl-first-run-gateway-key-method",
  "opl-first-run-gateway-email-input",
  "opl-first-run-gateway-password-input",
  "opl-first-run-gateway-login-button",
  "opl-first-run-codex-api-key-input",
  "opl-first-run-configure-codex-button",
  "opl-first-run-recheck-existing",
  "opl-first-run-enter-app",
  "opl-first-run-ready-entry",
  "opl-first-run-window-actions",
  "opl-first-run-step-workspace_root",
  "opl-first-run-step-codex",
  "opl-first-run-step-codex_config",
];
export const focusedFirstRunPresentationPolicy = {
  layout_mode: "focused_setup_workspace",
  ordinary_navigation_policy: "hidden_until_user_enters_guid",
  step_navigation_policy: "fixed_three_step_rail",
  current_task_policy: "one_current_task_panel",
  current_task_selection_policy:
    "first_unready_core_item_in_fixed_step_order_then_completion",
  progress_display_policy: "completed_step_count_no_percentage",
  model_access_choice_policy:
    "desktop_gateway_account_default_with_api_key_compatibility_and_secondary_existing_codex_recheck",
  model_access_inflight_policy:
    "disable_method_switch_and_alternate_action_until_current_request_settles",
  completion_transition_policy: "replace_current_task_in_place",
  completion_navigation_policy:
    "manual_guid_entry_available_before_or_after_ready_no_automatic_route",
  defer_navigation_policy:
    "explicit_enter_guid_available_before_ready_without_mutating_readiness",
  technical_detail_navigation_policy:
    "in_place_no_ordinary_settings_route_before_guid",
  request_exclusivity_policy:
    "single_inflight_initialize_or_action_across_first_run_controls",
  pending_state_policy:
    "no_ready_or_no_blocker_claim_before_initialize_payload",
  core_readiness_status_policy:
    "required_core_items_never_treat_disabled_as_ready",
  minimum_window_primary_action_policy:
    "400x600_keeps_current_primary_action_visible",
  background_shell_interaction_policy:
    "inert_and_aria_hidden_until_user_enters_guid",
  window_control_policy:
    "preserve_mac_traffic_light_safe_area_and_render_non_mac_desktop_controls",
  raw_error_policy:
    "localized_inline_current_task_and_technical_details_only_no_beginner_toast",
  secret_diagnostic_policy:
    "never_persist_or_render_gateway_password_and_redact_submitted_api_key_from_renderer_diagnostics",
  accessible_name_policy:
    "localized_visible_label_or_aria_labelledby_no_testid_names",
};
export const firstRunModelAccessSetupPolicy = {
  desktop_default_method: "gateway_account",
  desktop_method_order: ["gateway_account", "api_key"],
  gateway_account: {
    credentials: ["email", "password"],
    device_label_policy: "framework_default_not_rendered",
    secret_bridge_ref: "contracts/app-runtime-bridge.json#opl_gateway_account_secret_bridge",
    post_login_state_source: "opl app state --profile fast --json",
    unique_group_action: "gateway_account_complete_setup",
    unresolved_group_error: "group_selection_required",
    ready_claim_policy: "only_after_initialize_confirms_codex_config_ready",
    password_clear_policy: "success_failure_or_method_switch",
    diagnostic_policy:
      "no_password_in_state_action_stdout_stderr_receipt_or_renderer_diagnostics",
  },
  api_key: {
    role: "compatibility",
    bridge: "configureCodex",
    transport: "stdin",
    redaction_policy: "redact_before_renderer_diagnostics",
  },
  existing_codex_recheck: {
    role: "secondary_action_outside_method_switch",
    bridge: "getInitialize",
    mutates_configuration: false,
  },
  webui: {
    allowed_methods: ["api_key"],
    gateway_password_login: false,
  },
};
export const progressiveFirstRunRecoveryTestIds = [
  "opl-first-run-resume-entry",
  "opl-guid-setup-notice",
  "opl-guid-setup-notice-action",
  "opl-guid-workspace-access-disabled",
];
export const progressiveFirstRunRecoveryPolicy = {
  persistent_setup_entry_route: "/first-run",
  plain_conversation_required_items: ["codex_cli", "codex_config"],
  send_scoped_local_input_required_items: ["codex_cli", "codex_config"],
  send_scoped_local_input_surfaces: [
    "file_dialog_attachment",
    "directory_dialog_attachment",
    "file_paste_attachment",
    "file_drag_attachment",
    "slash_open_absolute_path",
  ],
  workspace_control_required_items: ["workspace_root"],
  workspace_restricted_capabilities: [
    "project_workspace_selection",
    "worktree_creation",
    "opl_workspace_controls",
  ],
  unknown_readiness_policy: "do_not_synthesize_failure_or_mutate_readiness",
};
export const appOwnedSettingsTabs = [
  "general",
  "gateway",
  "access",
  "workspace",
  "agents",
  "capabilities",
  "resources",
  "environment",
  "storage",
  "appearance",
];
export const appOwnedSettingsManagedDependencySummary = {
  source_ref:
    "opl update status --json#managed_update.components[component_id=opl_base].current.dependency_catalog.dependencies[]",
  required_ids: ["codex-cli", "temporal-runtime", "temporal-system-cli"],
  required_fields: [
    "dependency_id",
    "dependency_kind",
    "installed",
    "version",
    "latest_version",
    "currentness",
    "ownership",
    "update_policy",
    "update_mode",
    "update_action",
    "activation_policy",
    "binary_path",
    "status",
  ],
  optional_fields_by_dependency_id: {
    "codex-cli": ["external_installations"],
    "temporal-runtime": [],
    "temporal-system-cli": ["note"],
  },
  localized_display_names: {
    "codex-cli": { label_zh: "Codex CLI", label_en: "Codex CLI" },
    "temporal-runtime": {
      label_zh: "OPL 托管 Temporal 运行时",
      label_en: "OPL-managed Temporal Runtime",
    },
    "temporal-system-cli": {
      label_zh: "系统 Temporal CLI",
      label_en: "System Temporal CLI",
    },
  },
  currentness_values: ["current", "update_available", "unknown", "missing"],
  update_mode_values: [
    "silent_managed",
    "explicit_owner_delegated",
    "detect_only_guidance",
  ],
  display_policy:
    "show active Codex CLI, OPL-managed Temporal Runtime, and optional system Temporal CLI directly on Maintenance with version, source, currentness, and owner-specific update guidance",
  path_deduplication_policy:
    "deduplicate Codex PATH candidates by realpath and retain shadowed candidates in diagnostics",
  external_update_policy:
    "OPL-managed roots use the existing OPL Base update route; identified external owners require confirmation; unknown owners receive guidance only",
  manual_operation_policy: {
    silent_managed:
      "route to the existing OPL Base update or repair action and never synthesize a per-dependency action",
    explicit_owner_delegated:
      "render the Framework update_action only after explicit confirmation",
    detect_only_guidance:
      "show owner guidance without a fake update action",
  },
  unknown_value_policy:
    "show not checked or unknown and never synthesize current, missing, or zero values",
  diagnostics_boundary:
    "binary paths, shadowed installations, raw actions, and raw catalog records stay in technical details",
  external_installations_policy: {
    row_key: "dependency_id_plus_normalized_realpath_with_stable_index_suffix_only_for_duplicate_paths",
    required_fields: [
      "dependency_id",
      "binary_path",
      "ownership",
      "installed",
      "version",
      "latest_version",
      "currentness",
      "update_mode",
      "update_action",
      "guidance",
    ],
    path_policy: "normalize_realpath_before_deduplication_and_keep_shadowed_rows_in_diagnostics",
  },
  temporal_component_version_policy: {
    runtime_component_id: "temporal-runtime",
    cli_component_id: "temporal-system-cli",
    normalization: "normalize_semver_without_v_prefix_and_never_compare_runtime_bundle_version_to_system_cli_version",
  },
};
export const appOwnedTaskAwarenessRefFields = [
  "capability_health_refs",
  "workflow_refs",
  "export_bundle_action_ref",
  "candidate_report_refs",
  "workflow_skill_candidate_refs",
];
export const appOwnedSecondarySettingsPages = ["about"];
export const appOwnedSettingsCompatibilityRedirects = {
  update: {
    source_route_id: "update",
    source_path: "/settings/update",
    target_route_id: "environment",
    target_path: "/settings/environment",
    product_page_id: "maintenance",
    anchor: "updates",
    anchor_query_param: "section",
    navigation_encoding: "route_id_plus_anchor_field",
    shell_transport_hint: "hash_router_uses_query_param_section",
  },
  theme: {
    source_route_id: "theme",
    source_path: "/settings/theme",
    target_route_id: "appearance",
    target_path: "/settings/appearance",
    product_page_id: "preferences",
    anchor: "themes",
    anchor_query_param: "section",
    navigation_encoding: "route_id_plus_anchor_field",
    shell_transport_hint: "hash_router_uses_query_param_section",
  },
  "local-services": {
    source_route_id: "local-services",
    source_path: "/settings/local-services",
    target_route_id: "environment",
    target_path: "/settings/environment",
    product_page_id: "maintenance",
    anchor: "services",
    anchor_query_param: "section",
    navigation_encoding: "route_id_plus_anchor_field",
    shell_transport_hint: "hash_router_uses_query_param_section",
  },
  personalization: {
    source_route_id: "personalization",
    source_path: "/settings/personalization",
    target_route_id: "workspace",
    target_path: "/settings/workspace",
    product_page_id: "workspace",
    anchor: "personalization",
    anchor_query_param: "section",
    navigation_encoding: "route_id_plus_anchor_field",
    shell_transport_hint: "hash_router_uses_query_param_section",
  },
};
export const appActionRoute =
  "opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json";
export const appOwnedSettingsIaGroupIds = [
  "overview",
  "gateway",
  "models",
  "workspace",
  "agents",
  "capabilities",
  "resources",
  "maintenance",
  "storage",
  "preferences",
];
export const appOwnedSettingsRouteScopes = {
  settings_general: { route_id: "general", route_scope: "ordinary" },
  gateway: { route_id: "gateway", route_scope: "ordinary" },
  access: { route_id: "access", route_scope: "ordinary" },
  agents: { route_id: "agents", route_scope: "ordinary" },
  capabilities: { route_id: "capabilities", route_scope: "ordinary" },
  resources: { route_id: "resources", route_scope: "ordinary" },
  environment: { route_id: "environment", route_scope: "ordinary" },
  storage: { route_id: "storage", route_scope: "ordinary" },
  settings_theme: { route_id: "appearance", route_scope: "ordinary" },
  settings_personalization: {
    route_id: "personalization",
    route_scope: "compatibility_redirect",
  },
  about: { route_id: "about", route_scope: "secondary_or_deep_link" },
  update: { route_id: "update", route_scope: "compatibility_redirect" },
  workspace: { route_id: "workspace", route_scope: "ordinary" },
  local_services: {
    route_id: "local-services",
    route_scope: "compatibility_redirect",
  },
};
export const appOwnedSettingsTaskEntryIds = [
  "gateway_account",
  "model_access",
  "local_runtime_ability",
  "workspace",
  "maintenance_hub",
  "capability_status",
  "remote_access",
  "advanced_deployment",
  "developer_source_control",
  "external_tools_voice",
];
export const appOwnedSettingsTaskEntryMetadataFields = [
  "scope",
  "intent",
  "risk",
  "frequency",
];
export const appOwnedSettingsTopLevelEntryIds = [
  "overview",
  "gateway",
  "models",
  "workspace",
  "agents",
  "capabilities",
  "resources",
  "maintenance",
  "storage",
  "preferences",
];
export const appOwnedSettingsTopLevelLabels = {
  overview: { label_zh: "概览", label_en: "Overview" },
  gateway: { label_zh: "账户与访问", label_en: "Account & Access" },
  models: { label_zh: "模型", label_en: "Models" },
  workspace: {
    label_zh: "工作区",
    label_en: "Workspace",
  },
  agents: { label_zh: "智能体", label_en: "Agents" },
  capabilities: { label_zh: "能力", label_en: "Capabilities" },
  resources: { label_zh: "资源与连接", label_en: "Resources & Connections" },
  maintenance: { label_zh: "维护", label_en: "Maintenance" },
  storage: { label_zh: "数据与存储", label_en: "Data & Storage" },
  preferences: { label_zh: "偏好", label_en: "Preferences" },
};
export const appOwnedSettingsProductPageIds = [
  ...appOwnedSettingsTopLevelEntryIds,
  ...appOwnedSecondarySettingsPages,
];
export const appOwnedSettingsTechnicalDetailsDefault = {
  overview: "not_applicable",
  gateway: "not_applicable",
  models: "not_applicable",
  workspace: "explicit_action_modal",
  agents: "collapsed",
  capabilities: "collapsed",
  resources: "explicit_action_modal",
  maintenance: "explicit_action_modal",
  storage: "explicit_action_modal",
  preferences: "not_applicable",
  about: "explicit_action_modal",
};
export const appOwnedSettingsPageAnchors = {
  overview: ["status", "attention", "next-action", "codex", "gateway"],
  gateway: ["connection", "account", "usage", "access"],
  models: ["provider-source", "model", "codex-cli"],
  workspace: [
    "current-workspace",
    "permissions",
    "artifacts",
    "logs",
    "personalization",
    "system-agents",
    "opl-app-context",
  ],
  agents: ["catalog", "package-role", "availability", "source", "home-visibility"],
  capabilities: ["opl-flow-managed", "third-party"],
  resources: [
    "local-browser-access",
    "web-access",
    "resource-readiness",
    "action-readiness",
    "external-resources",
  ],
  maintenance: ["health", "managed-dependencies", "updates", "services", "diagnostics"],
  storage: [
    "storage-categories",
    "archives",
    "cleanup-preview",
    "cleanup-history",
  ],
  preferences: [
    "behavior",
    "notifications",
    "models-performance",
    "display-fonts",
    "themes",
  ],
  about: ["version", "channel", "updates", "help-feedback"],
};
export const appOwnedSettingsPageSearchEntryIds = {
  overview: [
    "overview.status",
    "overview.attention",
    "overview.next_action",
    "overview.codex",
    "overview.gateway",
  ],
  gateway: ["gateway.connection", "gateway.account", "gateway.usage", "gateway.access"],
  models: ["models.provider_source", "models.model", "models.codex_cli"],
  workspace: [
    "workspace.current",
    "workspace.permissions",
    "workspace.artifacts",
    "workspace.logs",
    "personalization.system_agents",
    "personalization.opl_app_context",
  ],
  agents: [
    "agents.catalog",
    "agents.availability",
    "agents.source",
    "agents.home_visibility",
  ],
  capabilities: [
    "capabilities.opl_flow_managed",
    "capabilities.third_party",
  ],
  resources: [
    "resources.local_browser_access",
    "resources.web_access",
    "resources.readiness",
    "resources.executable",
    "resources.external",
  ],
  maintenance: [
    "maintenance.health",
    "maintenance.managed_dependencies",
    "maintenance.updates",
    "maintenance.services",
    "maintenance.diagnostics",
  ],
  storage: [
    "storage.categories",
    "storage.archives",
    "storage.preview",
    "storage.history",
  ],
  preferences: [
    "preferences.behavior",
    "preferences.notifications",
    "preferences.performance",
    "preferences.display_fonts",
    "preferences.themes",
  ],
  about: [
    "about.version",
    "about.channel",
    "about.help_feedback",
    "about.updates",
  ],
};
export const appOwnedSettingsCapabilitiesTabContract = {
  surface_label_zh: "能力",
  surface_label_en: "Capabilities",
  tab_order: ["opl_flow_managed", "manual_and_third_party"],
  default_tab: "opl_flow_managed",
  on_demand_tab_ids: [],
};
export const appOwnedSettingsResourcesBrowserEntry = {
  label_zh: "这台电脑的浏览器访问",
  label_en: "Browser access to this computer",
  placement: "resources_primary_information",
  visibility: "always",
  action_policy: "open_existing_local_browser_access_settings",
  implementation_provenance_visibility: "technical_details_only",
};
export const appOwnedSettingsResourceActionBehavior = {
  read_only_actions: {
    open: {
      execution_policy: "navigate_shell_to_projected_browser_url",
      required_projection_field: "browser_url",
      completion_evidence: "shell_navigation_dispatched_to_exact_browser_url",
    },
    diagnose: {
      execution_policy: "invoke_projected_diagnose_action_and_render_result",
      completion_evidence: "diagnose_result_or_action_receipt_visible",
    },
  },
  mutating_actions: {
    precheck_required: true,
    explicit_confirmation_required: true,
    execution_policy:
      "execute_projected_mutation_only_after_successful_precheck_and_explicit_confirmation",
    completion_evidence: "mutation_result_or_action_receipt_visible",
  },
  dry_run_boundary: {
    role: "precheck_only",
    allowed_claim: "precheck_passed",
    forbidden_completion_claims: [
      "resource_opened",
      "diagnosis_completed_without_diagnose_execution",
      "deployment_completed",
      "mutation_completed",
    ],
  },
};
export const appOwnedSettingsProjectionSectionIds = [
  "overview",
  "gateway",
  "models",
  "workspace",
  "agents",
  "capabilities",
  "resources",
  "maintenance",
  "storage",
  "preferences",
];
export const appOwnedSettingsProjectionItemFields = [
  "item_id",
  "surface_class",
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
  global_entry_count: 1,
  entry_testid: "settings-search-input",
  scope: "bilingual_item_level_index",
  languages: ["zh-CN", "en"],
  result_label_format: "{page_label} > {entry_label}",
  result_policy: "select_result_navigates_to_owner_route_and_anchor",
  anchor_transport: "route_id_plus_anchor_field_with_section_query_fallback",
  compatibility_index_policy:
    "index_update_theme_local_services_and_personalization_under_owner_page_anchors",
  empty_state: "show_no_matching_settings_without_exposing_internal_route_ids",
};
export const appOwnedSettingsVisualSystem = {
  style: "codex_quiet_control_center_with_opl_information_architecture",
  style_exclusion: "multi_hue_card_dashboard",
  baseline_shell_commit: "409dd0c3b693f1c7c93551654dfac8fb9420843d",
  baseline_comparison_policy:
    "fresh_same_route_screenshots_must_preserve_or_improve_information_hierarchy",
  card_policy: "one_quiet_bounded_section_per_user_question_with_flat_internal_rows",
  first_viewport_spatial_group_range: { min: 2, max: 4 },
  nested_cards_allowed: false,
  page_wide_list_wall_allowed: false,
  page_sections_as_floating_cards_allowed: false,
  desktop_group_layout: "single_column_reading_lane",
  mobile_group_layout: "single_column_stack",
  icon_slot_px: 20,
  typography: {
    page_title: "20/28/600",
    card_title: "14-16/20-24/600",
    description: "13/20/400",
    supporting: "12/18/400",
  },
  status_color_semantics: {
    normal: "muted",
    warning: "orange",
    error: "red",
    action: "brand",
  },
  object_accent_policy:
    "use monochrome utility navigation icons and reserve color for typed warning error success and brand actions",
  footer_layout: "compact",
  footer_controls: [
    "gateway_account_or_settings_entry",
    "app_update_status_and_trigger",
  ],
  footer_account_entry_policy:
    "show_gateway_display_name_when_connected_else_settings_on_all_routes_and_open_account_gateway_or_overview",
  footer_update_entry_policy:
    "show_confirmed_newer_app_update_as_account_row_trailing_action_and_reuse_existing_carrier_updater_without_owning_update_truth",
  footer_theme_quick_toggle_allowed: false,
  footer_secondary_navigation_allowed: false,
  appearance_mode_values: ["system", "light", "dark"],
  appearance_mode_presentation: "three_visual_preview_cards",
  appearance_mode_preserves_theme_preset: false,
  theme_gallery_presentation: "not_exposed",
  theme_swatch_list_allowed: false,
  max_border_radius_px: 8,
  spacing_scale_px: [12, 16, 24],
  heading_density: "compact",
  primary_action_per_page_max: 1,
  normal_state_emphasis: "muted",
  exception_state_emphasis: "accent_only_when_attention_required",
  technical_details_default: "collapsed",
  letter_spacing_px: 0,
};
export const appOwnedSettingsPageExperienceFields = [
  "product_page_id",
  "route_id",
  "matrix_page_id",
  "label_zh",
  "label_en",
  "primary_information",
  "first_viewport_groups",
  "primary_action",
  "exception_state",
  "technical_details_boundary",
  "required_dom",
  "required_anchors",
  "search_entry_ids",
];
export const appOwnedSettingsSearchEntryFields = [
  "id",
  "page_id",
  "anchor",
  "label_zh",
  "label_en",
  "keywords_zh",
  "keywords_en",
];
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
  "desktop_settings_gateway",
  "desktop_settings_models",
  "desktop_settings_workspace",
  "desktop_settings_agents",
  "desktop_settings_capabilities",
  "desktop_settings_resources",
  "desktop_settings_maintenance",
  "desktop_settings_storage",
  "desktop_settings_preferences",
];
export const appOwnedSettingsUpstreamIntakeClassifications = [
  "accepted",
  "adapt",
  "redirect",
  "reject",
];
export const appOwnedSettingsProductSystemItemIds = [
  "control_center_positioning",
  "ten_entry_ia",
  "secondary_route_strategy",
  "compatibility_anchor_routes",
  "single_control_plane",
  "host_adapter_slot",
  "per_page_experience_contracts",
  "view_model_layer",
  "issue_action_protocol",
  "maintenance_noise_reduction",
  "workspace_normal_state",
  "workspace_personalization_owner",
  "gateway_single_owner",
  "model_access_source",
  "capabilities_experience",
  "resources_readiness_boundary",
  "data_storage_safety",
  "docker_storage_projection",
  "preferences_user_language",
  "maintenance_diagnostics",
  "about_update_summary",
  "startup_cache_hydration",
  "managed_dependency_currentness",
  "ownership_no_duplicates",
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
  system: "environment#diagnostics",
  advanced: "environment#diagnostics",
  model: "access",
  agent: "agents",
  assistants: "capabilities#third-party",
  "skills-hub": "capabilities#third-party",
  tools: "capabilities#third-party",
  display: "appearance",
  webui: "resources",
  pet: "appearance",
};
export const homeActivityCenterForbiddenDisplays = [
  "domain artifact body",
  "memory body",
  "quality verdict body",
  "provider implementation details",
];
export const appOwnedHomeLayout = {
  default_mode: "composer_first_chat_canvas",
  default_active_shortcut: null,
  shortcut_selection_policy:
    "explicit_user_or_navigation_selection_only_no_saved_preset_restore_and_never_disabled_by_launch_readiness",
  first_screen_policy: "chat_first_single_reading_lane_no_dashboard_landing_or_agent_portal",
  composer_position: "floating_bottom_with_safe_inset",
  composer_primary: true,
  workspace_selector_visible: true,
  purpose_entries_visible: ["research", "grant", "ppt", "book"],
  purpose_entry_placement:
    "compact_shortcuts_immediately_above_composer_with_management_in_settings_agents_not_persistent_composer_selector",
  dynamic_question_title: true,
  starter_limit: null,
  starter_visibility_policy: "all_user_visible_configured_shortcuts",
  starter_order_policy: "stable_configured_order",
  starter_layout_policy: "compact_inline_wrap",
  starter_item_width_policy: "content_sized",
  starter_count_layout_policy: "center_actual_visible_count_and_wrap_without_navigation_chevrons",
  desktop_composer_max_width_px: 736,
  desktop_composer_min_height_px: 98,
  desktop_composer_corner_radius_px: 22,
  desktop_context_bar_height_px: 0,
  desktop_context_bar_overlap_px: 0,
  desktop_context_bar_horizontal_inset_px: 0,
  starter_truncation_allowed: false,
  selected_starter_visual_policy: "quiet_fill_and_check_indicator_not_color_alone",
  workspace_selector_policy: {
    primary_scope: "active_workspace_only",
    inactive_recent_directories_visible: false,
    management_entry: "registered_directories_modal",
    management_scope: "registered_workspaces",
    selection_effect: "set_new_session_initial_cwd_only",
    unregister_effect: "remove_registration_only",
    filesystem_delete_allowed: false,
    active_conversation_change_on_unregister: false,
    session_ownership_effect: "none",
    cascade_session_delete_allowed: false,
  },
  home_shortcut_mutation_policy: {
    pending_scope: "single_shortcut",
    pending_key: "shortcut_id",
    other_shortcuts_remain_interactive: true,
    readback_mode: "background_no_page_loading",
  },
  projectless_conversation_supported: true,
  text_chat_without_workspace: "available",
  workspace_session_rail_default_state: "visible_wide_drawer_narrow",
  right_context_inspector_default_state: "collapsed",
  must_not_show: [
    "dashboard-first home",
    "explanatory landing page",
    "backend settings panel in composer",
    "full-width agent category navigation or chevron trail",
    "separate framed context cap above the composer",
    "launch-blocked professional-agent shortcut disabled before selection",
    "Sites entry without an OPL product capability",
    "Chat entry without an OPL product capability",
    "AionUI Team nav entry",
    "AionUI Team page as ordinary App surface",
  ],
};
export const appOwnedPageStateHomeLayout = {
  ...appOwnedHomeLayout,
  must_not_show: [
    "dashboard-first home",
    "explanatory landing page",
    "backend settings panel in composer",
    "AionUI Team nav entry",
    "AionUI Team page as ordinary App surface",
  ],
};
export const appOwnedSessionWorkspaceModel = {
  primary_unit: "session_backed_by_codex_thread_id",
  identity_authority: "codex_core_app_server_thread_id",
  workspace_binding_role:
    "new_session_initial_cwd_mutable_default_working_directory_and_sidebar_grouping_metadata_only",
  workspace_owns_session: false,
  workspace_owns_context: false,
  workspace_owns_artifacts: false,
  workspace_group_cascade_session_delete_allowed: false,
  workspace_change_preserves: [
    "thread_id",
    "transcript",
    "turn_history",
    "title",
    "task_state",
  ],
  workspace_change_forbids: [
    "fork_thread",
    "copy_history",
    "create_replacement_session",
    "change_session_owner",
  ],
};
export const appOwnedDirectoryGroupPolicy = {
  source: "canonical_session_cwd_projection",
  role: "presentation_and_new_session_cwd_shortcut_only",
  owns_sessions: false,
  owns_context: false,
  owns_artifacts: false,
  group_delete_action_allowed: false,
  cascade_session_delete_allowed: false,
  new_session_action_language: "use_this_working_directory_not_create_project_child",
};
export const appOwnedExplicitSessionInputPolicy = {
  scope: "current_session_composer",
  surfaces: [
    "attachments",
    "local_file_picker",
    "local_directory_picker",
    "paste",
    "drop",
    "/open",
  ],
  selection_scope: "any_user_selected_local_file_or_directory",
  workspace_required: false,
  access_authority: "codex_permission_approval_and_sandbox_only",
  shell_extra_path_authorization_allowed: false,
  user_initiated_only: true,
  workspace_preload_allowed: false,
  workspace_scoped_persistence_allowed: false,
  implicit_workspace_context_injection_allowed: false,
  composer_consumption: "current_send_only",
  composer_persistence_after_send: "none",
  workspace_readiness_boundary: {
    gates: ["project_selection", "worktree_creation", "opl_workspace_controls"],
    plain_local_conversation_requires_workspace_root: false,
    send_scoped_local_file_inputs_require_workspace_root: false,
    worktree_requires_git_repository: true,
    codex_and_model_prerequisites_unchanged: true,
  },
};
export const appOwnedRuntimeBridgeLocalWorktreeHandoffPolicy = {
  contract_ref:
    "contracts/app-gui-product-contract.json#interaction_baseline.conversation_scope.local_worktree_lifecycle",
  bridge_role: "transport_only",
  state_authority: "codex_core_app_server_and_existing_git_integration",
};
export const appOwnedNewTaskLocality = {
  contract_ref:
    "contracts/app-gui-product-contract.json#interaction_baseline.conversation_scope.local_worktree_lifecycle",
};
export const appOwnedGuiContractEnvironmentWorkspaceHandoff = {
  contract_ref:
    "interaction_baseline.conversation_scope.local_worktree_lifecycle",
};
export const appOwnedPageStateEnvironmentWorkspaceHandoff = {
  contract_ref:
    "contracts/app-gui-product-contract.json#interaction_baseline.conversation_scope.local_worktree_lifecycle",
};
const appOwnedOrdinaryConversation = {
  path_id: "ordinary_codex_conversation",
  entry_source:
    "home_starter_workspace_initialized_or_projectless_new_session",
  executor: "codex_cli",
  composer_position: "floating_bottom_with_safe_inset",
  active_capability_chip_visible: true,
  persistent_purpose_selector_visible: false,
  assistant_route_receipt_required: true,
  backend_selector_visible: false,
  model_selector_visible: true,
  permission_mode_selector_visible: true,
  permission_mode_language_policy:
    "automation_and_file_access_in_user_language",
  provider_selector_visible: false,
  model_status_surface: "executor_policy.default_model_display_value",
  technical_details_policy:
    "single_compact_model_reasoning_menu_without_backend_or_provider",
  composer_context_strip: ["active_capability"],
  composer_send_scoped_inputs: ["attachments"],
  composer_send_scoped_consumption_policy:
    "consumed_by_current_send_not_persisted_in_context_strip",
  composer_forbidden_persistent_context: [
    "project",
    "workspace",
    "locality",
    "branch",
    "attachments",
    "workspace_context_refs",
  ],
  composer_bottom_action_row: [
    "attach",
    "permission_access_mode",
    "model_reasoning",
    "send_stop",
  ],
  composer_optional_actions: ["voice"],
  mobile_action_sheet: {
    trigger: "+",
    allowed_actions: [
      "attach",
      "permission_access_mode",
      "model_reasoning",
      "active_capability",
    ],
    send_stop_location: "composer_primary_action_outside_sheet",
    forbidden_actions: [
      "backend",
      "provider",
      "team",
      "raw_mcp",
      "arbitrary_skills",
    ],
  },
  projectless_conversation_supported: true,
  session_workspace_model: appOwnedSessionWorkspaceModel,
  explicit_session_input_policy: appOwnedExplicitSessionInputPolicy,
  environment_workspace_handoff:
    appOwnedGuiContractEnvironmentWorkspaceHandoff,
};
export const appOwnedTranscriptExport = {
  scope: "current_conversation_transcript_only",
  history_loading_policy: "load_all_pages_before_export",
  incomplete_history_policy: "explicit_error_no_partial_export",
  silent_truncation_allowed: false,
  shareable_roles: ["user", "assistant"],
  shareable_message_types: ["text"],
  excluded_content: [
    "system_messages",
    "hidden_messages",
    "tool_calls",
    "runtime_events",
    "provider_payloads",
    "receipts",
  ],
  default_format: "markdown",
  allowed_formats: ["markdown", "json"],
  strict_json_document_fields: ["title", "exported_at", "messages", "redacted"],
  strict_json_message_fields: ["role", "content"],
  redaction_required: true,
  explicit_directory_required: true,
  explicit_filename_required: true,
  filename_extension_follows_format: true,
  errors_visible: true,
  workspace_bundle_authorized: false,
};
export const appOwnedArtifactPreview = {
  surface: "existing_aionui_preview_context_and_panel",
  entry_sources: [
    "session_attachment_ref",
    "conversation_result_ref",
    "explicit_absolute_local_path",
  ],
  supported_content_types: ["markdown", "pdf", "code", "image", "html", "diff"],
  markdown_embedded_renderers: ["mermaid", "katex", "code"],
  ref_resolution_policy:
    "explicit_session_attachment_or_conversation_result_ref_or_user_selected_legal_absolute_local_path_without_copying_artifact_body",
  session_reference_policy: {
    attachment_ref_scope: "current_session_explicit_attachment_only",
    conversation_result_ref_scope: "current_session_visible_result_only",
    workspace_membership_required: false,
    implicit_workspace_ref_allowed: false,
  },
  explicit_local_path_policy: {
    user_initiated_only: true,
    path_form: "legal_absolute_local_file_path",
    workspace_membership_required: false,
    access_authority: "codex_permission_approval_and_sandbox",
    automatic_silent_read_allowed: false,
  },
  forbidden_inputs: [
    "relative_parent_traversal",
    "illegal_or_unsupported_scheme",
    "automatic_silent_read",
    "implicit_workspace_context_ref",
  ],
  artifact_body_authority: "external_owner_ref_only",
  keyboard_reachable_open_action: true,
  failure_policy: "keep_ref_visible_and_fail_closed_with_reason",
  unsafe_or_unsupported_ref_policy: "do_not_open_or_guess_content",
};
export const appOwnedGuiContractOrdinaryConversation = {
  ...appOwnedOrdinaryConversation,
  model_status_surface: "executor_policy.default_model_display_value",
  transcript_export: appOwnedTranscriptExport,
  artifact_preview: appOwnedArtifactPreview,
};
export const appOwnedCurrentTaskSlice = {
  source: "contracts/app-runtime-bridge.json#current_task_slice_projection",
  state_source: "opl app state --profile fast --json",
  scope: "current_conversation_or_selected_task",
  placement: "message_timeline",
  single_instance: true,
  default_visibility: "inline_unpinned_when_task_active",
  ordinary_task_sticky: false,
  sticky_when: ["user_pinned", "long_running_true"],
  long_running_signal_field: "long_running",
  duplicate_surface_allowed: false,
  summary_fields: ["status", "elapsed", "progress", "next_action", "stop"],
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
    "source_material_refs",
    "source_material_receipt_refs",
    "reference_design_packet_refs",
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
    Object.entries(appOwnedOrdinaryConversation).map(([key, value]) =>
      key === "model_status_surface"
        ? [
            "model_status_surface_ref",
            "contracts/app-gui-product-contract.json#executor_policy.default_model_display_value",
          ]
        : [key, value],
    ),
  ),
  conversation_rendering_ref:
    "contracts/app-gui-product-contract.json#interaction_baseline.visual_target.conversation_rendering",
  environment_workspace_handoff:
    appOwnedPageStateEnvironmentWorkspaceHandoff,
  transcript_export: appOwnedTranscriptExport,
  current_task_slice: appOwnedCurrentTaskSlice,
  artifact_preview: appOwnedArtifactPreview,
};
export const appOwnedRightContextInspectorPolicy = {
  compatibility_name: "right_context_inspector",
  product_role: "on_demand_advanced_workspace_and_task_evidence_host",
  placement: "right_or_mobile_overlay",
  surface_kind: "on_demand_workspace_surface",
  default_state: "closed",
  default_third_column_visible: false,
  opens_on_user_or_task_request_only: true,
  chat_canvas_remains_primary: true,
  scope: "selected_workspace_and_conversation",
  workspace_surface: {
    id: "files_changes",
    label: "Files / Changes",
    default_state: "closed",
    opens_when: [
      "user_requests_files_or_changes",
      "task_requires_workspace_inspection",
    ],
  },
  preview_surface: {
    id: "preview",
    independent: true,
    default_state: "closed",
    opens_for: ["artifact", "file", "url", "result"],
  },
  review_surface: {
    host_surface: "existing_files_changes_diff_surface",
    default_state: "closed",
    opens_on_user_request: true,
    review_targets: ["uncommitted", "base_branch", "commit", "custom"],
    delivery_modes: ["inline", "detached"],
    default_section: "unstaged",
    sections: ["unstaged", "staged", "commit", "branch", "last_turn"],
    capabilities: [
      "pull_request_context",
      "inline_comments",
      "stage",
      "commit",
      "push",
    ],
    pull_request_context_dependency: "gh",
    pull_request_context_unavailable_policy: "show_explicit_unavailable_state",
    git_authority: "existing_codex_git_integration",
    shell_role: "thin_adapter_only",
    duplicate_git_store_allowed: false,
    legacy_equal_weight_review_tab_allowed: false,
  },
  on_demand_task_tools: {
    terminal: {
      entry_points: ["environment", "task_need"],
      default_state: "closed",
    },
    browser: {
      entry_points: ["environment", "task_need"],
      default_state: "closed",
    },
  },
  equal_weight_tool_taxonomy_allowed: false,
  legacy_taxonomy_ids_forbidden: [
    "review",
    "terminal",
    "browser",
    "files",
    "artifacts",
    "runtime",
    "actions",
    "memory",
  ],
  runtime_duplicate_allowed: false,
  environment_popover_ref:
    "interaction_baseline.context_surfaces.environment_popover",
};
export const appOwnedReviewSurfaceSourceEvidence = {
  source_status:
    "partial_last_turn_and_custom_target_instructions_implemented_review_focus_and_inline_comments_protocol_blocked",
  source_capability_status: {
    last_turn: "source_implemented_existing_message_store",
    review_focus_context: "source_blocked_missing_public_review_focus_protocol",
    inline_comments: "source_blocked_missing_typed_codex_protocol",
  },
  last_turn_source_policy:
    "latest_visible_user_message_then_completed_workspace_edit_tool_calls",
  review_focus_delivery_policy:
    "custom_target_instructions_via_review_start_target_custom_only_non_custom_focus_not_exposed",
  review_focus_failure_policy:
    "non_custom_focus_protocol_unavailable_before_review_start_without_turn_steer_fallback_fake_success_audit_or_side_effects",
  inline_comment_protocol_requirement:
    "typed_codex_app_server_file_line_comment_request_location_and_failure_semantics",
  inline_comment_forbidden_fallbacks: ["shell_local_annotation_store", "fake_success"],
};
export const appOwnedRightContextInspectorForbiddenOwners = [
  "runtime truth",
  "domain truth",
  "artifact body",
  "memory body",
  "backend selection authority",
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
