export const firstRunCoreItems = ['workspace_root', 'codex_cli', 'codex_config'];
export const appOwnedProjectGroupExpansionPolicy = {
  running_group_default: 'expanded',
  attention_group_default: 'visible_when_nonempty',
  inactive_group_default: 'collapsed',
  inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
  inactive_summary_fields: ['count', 'status', 'next_visible_step'],
};

export const appOwnedRunningStatePolicy =
  'only explicit running, in_progress, or advancing status/state counts as running; active_run_id alone is context, not liveness proof';

export const requiredHostTools = ['command_line_tools', 'homebrew', 'node', 'git'];
export const fullReadinessItems = [
  'domain_modules',
  'family_runtime_provider',
  'recommended_skills',
  'native_helpers',
  'repo_sync',
  'command_line_tools_install',
  'ecosystem_module_updates',
];
export const deferredMaintenanceItems = [
  'repo_sync',
  'module_reconcile',
  'command_line_tools_install',
  'native_helpers',
  'companion_skills_install',
  'ecosystem_module_updates',
];
export const ecosystemModuleIds = ['officecli', 'mineru', 'opl-meta-agent'];
export const defaultCompanionSkillSyncIds = [
  'superpowers',
  'cron',
  'officecli',
  'officecli-docx',
  'officecli-pptx',
  'officecli-xlsx',
  'officecli-academic-paper',
  'officecli-data-dashboard',
  'officecli-financial-model',
  'officecli-pitch-deck',
  'pdf',
  'mineru-document-extractor',
  'ui-ux-pro-max',
];
export const domainExposureEntries = [
  {
    domain_id: 'mas',
    home_purpose_entry: 'research',
    codex_visible_entry: 'mas',
    preferred_app_distribution: 'plugin_packaged_skill',
  },
  {
    domain_id: 'mag',
    home_purpose_entry: 'grant',
    codex_visible_entry: 'mag',
    preferred_app_distribution: 'plugin_packaged_skill',
  },
  {
    domain_id: 'rca',
    home_purpose_entry: 'ppt',
    codex_visible_entry: 'rca',
    preferred_app_distribution: 'plugin_packaged_skill',
  },
  {
    domain_id: 'bookforge',
    home_purpose_entry: 'book',
    codex_visible_entry: 'opl-bookforge',
    preferred_app_distribution: 'opl_generated_codex_plugin_surface',
  },
  {
    domain_id: 'oma',
    home_purpose_entry: null,
    codex_visible_entry: 'opl-meta-agent',
    preferred_app_distribution: 'opl_generated_codex_plugin_surface',
  },
];
export const forbiddenAuthorityOwners = [
  'runtime_truth',
  'provider_implementation',
  'domain_truth',
  'domain_quality_verdict',
  'domain_artifact_authority',
];
export const beginnerFirstRunTestIds = [
  'opl-startup-preflight',
  'opl-first-run-beginner-summary',
  'opl-first-run-initialize-pending',
  'opl-first-run-primary-action',
  'opl-first-run-technical-details-toggle',
];
export const appOwnedSettingsTabs = ['general', 'access', 'capabilities', 'environment', 'storage', 'appearance', 'advanced'];
export const appOwnedSecondarySettingsPages = ['about', 'update', 'theme'];
export const appOwnedSettingsIaGroupIds = ['overview', 'setup_access', 'capabilities', 'maintenance', 'data_storage', 'preferences', 'advanced'];
export const appOwnedSettingsIaLabelsZh = ['总览', '开始使用', '能力', '维护', '数据与存储', '偏好', '高级'];
export const appOwnedSettingsIaEntryMap = {
  overview: ['settings_general', 'workspace'],
  setup_access: ['settings_access', 'first_run_setup_center'],
  capabilities: ['settings_capabilities'],
  maintenance: ['settings_environment', 'update'],
  data_storage: ['settings_storage'],
  preferences: ['settings_theme', 'appearance', 'language', 'startup', 'tray'],
  advanced: ['settings_advanced', 'about'],
};
export const appOwnedSettingsRouteScopes = {
  settings_general: { route_id: 'general', route_scope: 'ordinary' },
  access: { route_id: 'access', route_scope: 'ordinary' },
  capabilities: { route_id: 'capabilities', route_scope: 'ordinary' },
  environment: { route_id: 'environment', route_scope: 'ordinary' },
  storage: { route_id: 'storage', route_scope: 'ordinary' },
  settings_theme: { route_id: 'theme', route_scope: 'secondary_or_deep_link' },
  advanced: { route_id: 'advanced', route_scope: 'ordinary' },
  about: { route_id: 'about', route_scope: 'secondary_or_deep_link' },
  update: { route_id: 'update', route_scope: 'secondary_or_deep_link' },
};
export const appOwnedSettingsTaskEntryIds = [
  'model_account',
  'workspace',
  'maintenance_hub',
  'capability_status',
  'web_remote_access',
  'developer_profile_status',
  'external_tools_voice',
  'custom_assistant',
];
export const appOwnedSettingsIssueStatuses = ['needs_action', 'in_progress', 'resolved', 'blocked', 'dismissed'];
export const appOwnedSettingsSearchProtocol = {
  scope: 'ordinary_route_labels_user_task_entries_and_action_keywords',
  result_policy: 'filter_settings_navigation_without_changing_current_page_until_user_selects_a_result',
  empty_state: 'show_no_matching_settings_without_exposing_internal_route_ids',
};
export const appOwnedSettingsCardFields = [
  'id',
  'title',
  'state',
  'summary',
  'recommended_action',
  'last_checked_at',
  'details_disclosure',
];
export const appOwnedSettingsConfirmationFields = [
  'action_id',
  'summary',
  'will_change',
  'will_not_change',
  'rollback_or_receipt',
  'requires_preview_or_proof',
];
export const appOwnedSettingsPostUpdateNoticeFields = [
  'component_id',
  'result',
  'receipt_ref',
  'next_check',
  'restart_or_reload_guidance',
];
export const appOwnedSettingsVisualQaTargets = [
  'desktop_settings_overview',
  'desktop_settings_access',
  'desktop_settings_capabilities',
  'desktop_settings_maintenance',
  'desktop_settings_storage',
  'desktop_settings_advanced',
  'mobile_settings_section_nav',
];
export const appOwnedDeveloperProfileCapabilityAxes = [
  'source_channel',
  'workspace_trust',
  'github_authority',
  'agent_automation',
  'runtime_mutation_scope',
];
export const legacySettingsRouteRedirects = {
  overview: 'general',
  runtime: 'environment',
  system: 'advanced',
  model: 'environment',
  agent: 'capabilities',
  assistants: 'capabilities',
  'skills-hub': 'capabilities',
  tools: 'capabilities',
  display: 'appearance',
  webui: 'access',
  pet: 'appearance',
};
export const ordinaryHiddenLegacySettingsTabs = Object.keys(legacySettingsRouteRedirects);
const homeActivityCenterItemFields = [
  'task_id',
  'title',
  'domain_label',
  'state',
  'active_stage_label',
  'next_visible_step',
  'blocker_ref_count',
  'last_progress_at',
];
export const homeActivityCenterForbiddenDisplays = [
  'domain artifact body',
  'memory body',
  'quality verdict body',
  'provider implementation details',
];
export const appOwnedHomeLayout = {
  default_mode: 'composer_first_chat_canvas',
  first_screen_policy: 'chat_first_no_dashboard_or_landing_copy',
  composer_position: 'pinned_bottom',
  composer_primary: true,
  workspace_selector_visible: true,
  purpose_entries_visible: ['research', 'grant', 'ppt', 'book'],
  workspace_session_rail_default_state: 'collapsed',
  right_context_inspector_default_state: 'collapsed',
  must_not_show: [
    'dashboard-first home',
    'explanatory landing page',
    'backend settings panel in composer',
    'AionUI Team nav entry',
    'AionUI Team page as ordinary App surface',
  ],
};
const appOwnedOrdinaryConversation = {
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
  model_status_surface: 'gui.home.codex_home_model_status_label',
  technical_details_policy: 'friendly_model_primary_reasoning_configurable_in_model_menu',
};
export const appOwnedGuiContractOrdinaryConversation = {
  ...appOwnedOrdinaryConversation,
  model_status_surface: 'executor_policy.default_model_display_value',
};
export const appOwnedPageStateOrdinaryConversation = {
  ...Object.fromEntries(
    Object.entries(appOwnedOrdinaryConversation).filter(
      ([key]) => key !== 'model_status_surface' && key !== 'technical_details_policy',
    ),
  ),
  model_status_surface_ref: 'contracts/app-gui-product-contract.json#executor_policy.default_model_display_value',
  technical_details_policy: appOwnedOrdinaryConversation.technical_details_policy,
};
export const appOwnedRightContextInspectorTabIds = ['files', 'capabilities', 'runtime', 'memory', 'automations', 'settings'];
export const settingsPageExpectations = {
  settings_general: {
    matrix_id: 'settings_general',
    ia_group: 'overview',
    sections: ['control_center_summary', 'workspace', 'task_entry_hub', 'workspace_entry', 'startup', 'tray', 'language'],
    must_show: [
      'task entry hub for Workspace, Model & Account, Maintenance, Capabilities, and Web / Remote Access',
      'workspace path, open/change/verify actions, and permission status as ordinary user-facing content',
      'Control Center Overview positioning',
      'workspace as an independent ordinary entry',
      'workspace root from app_state.paths',
      'startup and tray preferences as App product preferences',
      'language preference',
      'short links to Setup & Access, Capabilities, Maintenance & Updates, Data & Storage, Preferences, Advanced, and Project Progress',
    ],
    must_not_show: [
      'raw OPL internal state files',
      'provider implementation internals as ordinary General settings',
      'workspace buried only under Advanced diagnostics or raw paths',
    ],
  },
  settings_access: {
    matrix_id: 'access',
    ia_group: 'setup_access',
    sections: ['getting_started_summary', 'model_account', 'codex_cli', 'provider_readiness', 'api_keys', 'webui_compatibility', 'web_remote_access'],
    must_show: [
      'Model & Account section with current model, model access/API key readiness, connection check, and repair entry',
      'Web / Docker / Remote Access section with a direct user-facing entry to WebUI or remote access setup',
      'Setup & Access placed under OPL Control Center Setup & Access',
      'whether Codex CLI can run now',
      'whether configured provider access can work now',
      'current permission meaning in user-facing language',
      'API key and base URL controls behind advanced disclosure',
      'section-level refresh state',
    ],
    must_not_show: [
      'raw base URL and token paths as first-screen content',
      'backend selector as ordinary App configuration',
      'WebUI as the primary access mental model',
      'backend/provider raw selector as the Model & Account primary control',
    ],
  },
  settings_capabilities: {
    matrix_id: 'capabilities',
    ia_group: 'capabilities',
    sections: ['research', 'grant', 'ppt', 'opl_meta_agent', 'capability_status', 'skills_detail', 'tools_detail', 'external_tools_voice', 'custom_assistants'],
    must_show: [
      'capability status for Research, Grant, Presentation, Book or manuscript work, and OPL automation',
      'External Tools & Voice entry with MCP described as secondary technical detail',
      'Custom Assistant entry as a secondary or advanced capability when enabled by product policy',
      'purpose-grouped MAS research capability',
      'purpose-grouped MAG grant capability',
      'purpose-grouped RCA presentation capability',
      'OPL Meta Agent as explicit non-default capability',
      'required skills locked and optional skills selectable by assistant',
      'builtin skill catalog and auto-injected skills filtered to App packaged skill ids',
      'MCP and tool details as secondary support details',
    ],
    must_not_show: [
      'Skills and Tools as the only top-level mental model',
      'AG-UI as a user-visible capability concept',
      'AionUI implementation skills such as aionui-skills',
      'OPL Meta Agent as a default Home assistant',
      'AionUI Team as the ordinary multi-agent collaboration entry',
      'MCP as the primary user-facing name for external tools',
    ],
  },
  settings_environment: {
    matrix_id: 'environment',
    ia_group: 'maintenance',
    sections: ['health_summary', 'maintenance_hub', 'core.codex', 'provider.temporal', 'modules', 'module_maintenance', 'managed_update_plane', 'storage_cleanup_entry', 'repair_recommendations', 'diagnostics'],
    must_show: [
      'Maintenance hub for App updates, runtime/toolchain, OPL Packages, storage cleanup, and repair recommendations',
      'storage cleanup entry routed to Storage & Data without making cleanup a raw diagnostic card',
      'single recommended repair or maintenance action before advanced manual actions',
      'Codex CLI version and default profile from app_state.core',
      'Temporal status from app_state.provider.temporal',
      'MAS/MAG/RCA/OMA module version and source from app_state.modules',
      'module path source explanation',
      'Developer Profile source_channel capability and managed GHCR OPL Packages channel default',
      'section-level refresh state',
      'environment page named Local Environment, distinct from Project Progress',
      'runtime/toolchain managed updater status from App state or opl update status',
      'OPL Packages status and post-update sync status',
      'OPL Packages capability exposure sync substatus',
      'user-facing OPL Packages maintenance entry under Local Environment',
      'BookForge module maintenance status alongside MAS/MAG/RCA/OMA',
      'ScholarSkills module maintenance status alongside MAS/MAG/RCA/OMA/BookForge',
      'OPL Packages state, capability exposure substatus, and recommended action',
      'manual check/apply/repair/rollback mappings through opl update or App action routes',
      'health summary for whether the local App foundation can run now',
      'grouped Core, Runtime, Capabilities, and Maintenance sections',
      'user-facing action language for checks, repairs, updates, and rollback',
      'diagnostics collapsed by default with raw booleans, ids, paths, and receipts hidden',
      'environment page placed under OPL Control Center Maintenance & Updates',
      'Local Environment limited to service health rather than broad local runtime preferences',
    ],
    must_not_show: [
      'Med Deep Scientist as a default module',
      'page-wide spinner while one section refreshes',
      'GUI-owned Temporal restart judgment',
      'project progress as a settings runtime page',
      'new Settings top-level tab for module maintenance',
      'Developer Profile checkout as a silent update target',
      'dirty checkout overwrite as a repair action',
      'developer checkout/dirty checkout as a silent update target',
      'module maintenance writing runtime/domain truth or update receipts directly',
      'Homebrew/global tool silent upgrade controls',
      'raw booleans, ids, component ids, receipts, or payload details as ordinary first-screen Local Environment content',
      'three equal maintenance buttons with shared ambiguous loading state',
      'workspace directory as a buried Local Environment detail instead of an independent ordinary entry',
      'appearance, language, startup, or tray preferences as Local Environment runtime health',
      'update, repair, package maintenance, and storage cleanup scattered across unrelated pages without a Maintenance hub',
    ],
  },
  settings_storage: {
    matrix_id: 'storage',
    ia_group: 'data_storage',
    sections: ['updater_cache', 'conversation_artifacts', 'runtime_toolchain', 'logs'],
    must_show: [
      'safe cleanup language: preview, archive, restore proof, prune plan, or rotate logs',
      'Storage placed under OPL Control Center Data & Storage',
      'storage inventory for updater cache, conversation artifacts, runtime/toolchain, and logs',
      'path, exists, bytes, cleanup_mode, and silent_delete_allowed for each local data root',
      'conversation archive/export receipt and restore proof before delete can execute',
      'runtime pointer-prune dry-run plan before execute can remove unreferenced runtime roots',
      'log rotation dry-run candidates by age, count, and size before execute can remove logs',
      'updater cache cleanup scoped to stale installer packages only',
    ],
    must_not_show: [
      'dangerous cleanup wording such as wipe, purge, nuke, or force delete as ordinary Storage copy',
      'silent conversation workdir deletion',
      'runtime/toolchain cleanup without current or rollback pointer protection',
      'log cleanup as proof that user artifacts were archived or deleted',
      'Homebrew/global tool silent cleanup controls',
      'domain artifact bodies',
    ],
  },
  settings_advanced: {
    matrix_id: 'advanced',
    ia_group: 'advanced',
    sections: ['developer_profile', 'developer_profile_status', 'paths', 'logs', 'opl_flow_context', 'diagnostics'],
    must_show: [
      'Developer Profile status for local checkout source, auto-update impact, and dirty checkout risk',
      'Advanced placed under Control Center Advanced',
      'Developer Profile effective state and capabilities from app_state.developer_profile',
      'Developer Profile explicit opt-in state for repo or local checkout source_channel',
      'workspace path from app_state.paths',
      'logs path from app_state.paths',
      'OPL Flow Context',
      'diagnostics and raw refs behind Advanced navigation',
    ],
    must_not_show: [
      'delayed developer mode flip from a shell-local cache',
      'AionUI local directory as OPL path truth',
      'Developer Profile as ordinary first-level user setup',
      'single Developer Mode switch as the only capability expression',
      'Developer Profile as a one-click ordinary setup shortcut',
    ],
  },
};
export const firstRunRequiredHostTools = ['command_line_tools', 'homebrew', 'node', 'git'];
export const firstRunDeferredMaintenanceItems = [
  'repo_sync',
  'module_reconcile',
  'command_line_tools_install',
  'native_helpers',
  'companion_skills_install',
  'ecosystem_module_updates',
];
export const firstRunEcosystemModules = ['officecli', 'mineru', 'opl-meta-agent'];
export const firstRunProgressSourceCommand = 'opl system initialize --json';
export const firstRunProgressSourcePath = 'system_initialize.setup_flow';
export const firstRunRendererTruthPolicy = 'render_only_no_shell_private_progress_truth';
export const firstRunSetupFlowFields = ['phase', 'ready_to_launch', 'progress', 'blocking_items', 'maintenance_items'];
export const firstRunProgressFields = [
  'ready_required_count',
  'total_required_count',
  'ready_full_readiness_count',
  'total_full_readiness_count',
  'ready_optional_count',
  'total_optional_count',
];
export const firstRunChecklistFields = [
  'item_id',
  'label',
  'status',
  'readiness_layer',
  'blocking',
  'severity',
  'next_visible_step',
  'detail_summary',
];
export const firstRunProgressVisibleElements = [
  'current initialization phase',
  'Core completed and total count',
  'Full readiness completed and total count',
  'background maintenance completed and total count',
  'blocking item list',
  'next visible step',
];
export const firstRunProgressConsumerPackageTypes = ['full', 'standard', 'source_installer', 'docker_webui'];
export const temporalLocalServiceDefaults = {
  address_env: 'OPL_TEMPORAL_ADDRESS',
  default_address: '127.0.0.1:7233',
  namespace_env: 'OPL_TEMPORAL_NAMESPACE',
  default_namespace: 'default',
  task_queue_env: 'OPL_TEMPORAL_TASK_QUEUE',
  default_task_queue: 'opl-stage-attempts',
};
export const temporalManagedCommands = [
  'opl family-runtime service start --provider temporal',
  'opl family-runtime worker status --provider temporal',
  'opl family-runtime worker start --provider temporal',
  'opl family-runtime residency proof --provider temporal --production',
];
export const firstConversationMustWaitFor = ['conversation_record_ready', 'acp_warmup_complete'];
export const firstConversationFailurePolicy = 'show_retryable_initial_message_error_without_losing_user_prompt';
