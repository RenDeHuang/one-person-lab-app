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
export const appOwnedSettingsTabs = ['general', 'access', 'capabilities', 'environment', 'storage', 'appearance', 'advanced', 'about'];
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
  technical_details_policy: 'friendly_default_model_and_reasoning_visible',
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
    sections: ['workspace', 'startup', 'tray', 'language'],
    must_show: [
      'workspace root from app_state.paths',
      'startup and tray preferences as App product preferences',
      'language preference',
      'short links to Access, Agents & Capabilities, Local Environment, and Project Progress',
    ],
    must_not_show: [
      'raw OPL internal state files',
      'provider implementation internals as ordinary General settings',
    ],
  },
  settings_access: {
    matrix_id: 'access',
    sections: ['codex_cli', 'provider_readiness', 'api_keys', 'webui_compatibility'],
    must_show: [
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
    ],
  },
  settings_capabilities: {
    matrix_id: 'capabilities',
    sections: ['research', 'grant', 'ppt', 'opl_meta_agent', 'skills_detail', 'tools_detail'],
    must_show: [
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
    ],
  },
  settings_environment: {
    matrix_id: 'environment',
    sections: ['core.codex', 'provider.temporal', 'modules', 'paths', 'release', 'managed_update_plane'],
    must_show: [
      'Codex CLI version and default profile from app_state.core',
      'Temporal status from app_state.provider.temporal',
      'MAS/MAG/RCA/OMA module version and source from app_state.modules',
      'module path source explanation',
      'Developer Profile source_channel capability and managed GHCR agent package channel default',
      'section-level refresh state',
      'environment page named Local Environment, distinct from Project Progress',
      'runtime/toolchain managed updater status from App state or opl update status',
      'agent package channel status and post-update sync status',
      'capability exposure sync status',
    ],
    must_not_show: [
      'Med Deep Scientist as a default module',
      'page-wide spinner while one section refreshes',
      'GUI-owned Temporal restart judgment',
      'project progress as a settings runtime page',
      'Developer Profile checkout as a silent update target',
      'dirty checkout overwrite as a repair action',
      'Homebrew/global tool silent upgrade controls',
    ],
  },
  settings_storage: {
    matrix_id: 'storage',
    sections: ['updater_cache', 'conversation_artifacts', 'runtime_toolchain', 'logs'],
    must_show: [
      'storage inventory for updater cache, conversation artifacts, runtime/toolchain, and logs',
      'path, exists, bytes, cleanup_mode, and silent_delete_allowed for each local data root',
      'conversation archive/export receipt and restore proof before delete can execute',
      'runtime pointer-prune dry-run plan before execute can remove unreferenced runtime roots',
      'log rotation dry-run candidates by age, count, and size before execute can remove logs',
      'updater cache cleanup scoped to stale installer packages only',
    ],
    must_not_show: [
      'silent conversation workdir deletion',
      'runtime/toolchain cleanup without current or rollback pointer protection',
      'log cleanup as proof that user artifacts were archived or deleted',
      'Homebrew/global tool silent cleanup controls',
      'domain artifact bodies',
    ],
  },
  settings_advanced: {
    matrix_id: 'advanced',
    sections: ['developer_profile', 'paths', 'logs', 'opl_flow_context', 'diagnostics'],
    must_show: [
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
