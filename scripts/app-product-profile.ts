import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readAppShellAdapterContract, resolveActiveShellPaths } from './app-shell-adapter.ts';

export type AppProductProfile = {
  schema_version: number;
  owner: string;
  purpose: string;
  state: string;
  machine_boundary: string;
  app_repo: string;
  product: {
    id: string;
    display_name: string;
    primary_surface: string;
    supported_release_platforms: string[];
  };
  contract_refs: Record<string, string>;
  default_session_profile: {
    provider: string;
    base_url: string;
    executor: string;
    model: string;
    reasoning_effort: string;
    applies_after: string;
    authority: string;
  };
  gui: {
    authority: string;
    implementation_carrier: string;
    appearance: {
      default_css_theme_id: string;
      default_css_theme_name: string;
      codex_theme_default_enabled: boolean;
    };
    home: {
      primary_input_surface: string;
      nested_input_card_frames_allowed: boolean;
      codex_cli_fixed_executor: boolean;
      home_executor_selector_visible: boolean;
      codex_model_selector_visible: boolean;
      codex_model_list_visible: boolean;
      codex_model_policy: string;
      codex_model_auto_option_visible: boolean;
      codex_default_model: string;
      codex_default_reasoning_effort: string;
      codex_default_permission_mode: string;
      permission_mode_selector_visible: boolean;
      conversation_backend_selector_visible: boolean;
      conversation_model_selector_visible: boolean;
      conversation_permission_mode_selector_visible: boolean;
      codex_home_model_status_label: string;
      codex_home_model_status_label_en: string;
      codex_precise_model_display_policy: string;
      codex_auto_model_selection: {
        strategy: string;
        user_can_override_model: boolean;
        user_can_restore_auto: boolean;
        selection_persists_into_conversation: boolean;
        frontier_model_preference_order: string[];
      };
      home_purpose_entries: Array<{
        id: string;
        primary_label: string;
        target_assistant_id: string;
        target_assistant_short_name: string;
        display_policy: string;
        home_entry_policy: string;
      }>;
      retired_codex_models_must_not_be_exposed: string[];
      activity_center_policy: {
        source: string;
        authority: string;
        role: string;
        default_placement: string;
        home_surface_policy: string;
        allowed_home_runtime_context: string[];
        must_not_display: string[];
        footer_quick_actions_policy: string;
      };
    };
    builtin_assistant_route_receipt_policy: {
      scope: string;
      required_for_assistants: string[];
      route_kind: string;
      executor: string;
      source: string;
      required_fields: string[];
      must_not_depend_on_visible_backend_selection: boolean;
    };
    ordinary_capability_selector_policy: {
      scope: string;
      authority: string;
      skill_source_ref: string;
      skill_menu_policy: string;
      conversation_loaded_skill_display_policy: string;
      mcp_server_source_ref: string;
      mcp_menu_policy: string;
      visible_mcp_server_ids: string[];
      conversation_loaded_mcp_display_policy: string;
      forbidden_skill_examples: string[];
      forbidden_mcp_policy: string;
    };
    default_assistants: Array<{
      id: string;
      display_name: string;
      short_name: string;
      home_purpose_label: string;
      home_entry_display_policy: string;
      role: string;
      home_entry_policy: string;
      avatar: string;
      description_i18n: Record<string, string>;
      prompts_i18n: Record<string, string[]>;
    }>;
    assistant_skill_profiles: Array<{
      assistant_id: string;
      required_skills: string[];
      optional_skills: string[];
      required_skill_policy: string;
      optional_skill_policy: string;
      skill_menu_policy: string;
    }>;
    non_default_assistants: Array<{
      id: string;
      display_name: string;
      short_name: string;
      role: string;
      home_entry_policy: string;
      home_default_visible: boolean;
      avatar: string;
      description_i18n: Record<string, string>;
      prompts_i18n: Record<string, string[]>;
    }>;
  };
  codex: {
    default_model: string;
    default_model_description: string;
    default_reasoning_effort: string;
    opl_flow_context: {
      flow_id: string;
      source: string;
      delivery: string;
      user_agents_policy: string;
      language_policy: string;
    };
    default_visible_skills: string[];
    skill_priority: string[];
    session_context_lines: string[];
    session_context_i18n?: Record<'zh-CN' | 'en-US', string[]>;
  };
  first_run: {
    readiness_layers: string[];
    ready_to_launch_gate: {
      id: string;
      ui_order: string;
      required_core_items: string[];
      must_not_require: string[];
    };
    full_readiness_layers: string[];
    deferred_blockers: string[];
    runtime_provider: {
      full_readiness_provider: string;
      ready_to_launch_blocking: boolean;
    };
    first_conversation: {
      gate: string;
      source_command: string;
      ready_to_launch_must_be_true: boolean;
      must_wait_for: string[];
      must_not_wait_for: string[];
      failure_policy: string;
    };
    progress_model: {
      source_command: string;
      source_path: string;
      renderer_truth_policy: string;
      required_setup_flow_fields: string[];
      required_progress_fields: string[];
      required_checklist_fields: string[];
      required_visible_elements: string[];
    };
    command_line_tools: {
      auto_request_installer: boolean;
      blocks_full_first_launch: boolean;
      messages: string[];
    };
    beginner_presentation: {
      audience: string;
      presentation_mode: string;
      primary_user_goal: string;
      primary_steps: string[];
      primary_progress_signal: string;
      advanced_progress_disclosure: string;
      background_maintenance_presentation: string;
      technical_detail_policy: string;
      post_install_ai_self_check_entry: {
        trigger: string;
        target_route: string;
        route_state: string;
        prompt_policy: string;
        target_state_checks: string[];
        mutation_policy: string;
        release_gate_policy: string;
      };
    };
  };
  settings: {
    visible_tabs: string[];
    legacy_route_redirects: Record<string, string>;
    settings_information_architecture?: Record<string, {
      label_zh: string;
      label_en: string;
      role: string;
      primary_question: string;
    }>;
    environment_items: string[];
    developer_profile: {
      label_key: string;
      description_key: string;
      hide_machine_status: boolean;
      source: string;
      default_profile: string;
      opt_in_policy: string;
      capability_axes: string[];
      capabilities: Record<string, {
        standard_default: string;
        developer_opt_in: string;
        display_policy: string;
      }>;
      legacy_developer_mode_alias: {
        state_source: string;
        display_policy: string;
        must_not_display_as: string;
      };
      state_keys: Record<string, string>;
    };
  };
  companion_payloads: {
    install_exposure_policy_ref: string;
    exposure_classes_ref: string;
    public_abi: {
      primary_semantic_entry: string;
      preferred_app_distribution: string;
      plugin_must_not_create_second_semantics: boolean;
      cli_and_app_share_skill_semantics: boolean;
    };
    tools: string[];
    domain_modules: string[];
    default_packaged_codex_skill_ids: string[];
    packaged_not_default_visible_codex_skill_ids: string[];
    companion_skill_sync_default_ids: string[];
    domain_plugin_skill_ids: string[];
    domain_plugin_skills_must_not_be_companion_mirrors: boolean;
    domain_exposure: Array<{
      domain_id: string;
      codex_visible_entry: string;
      preferred_app_distribution: string;
      direct_skill_semantics_required: boolean;
    }>;
  };
  boundary: {
    app_owns: string[];
    app_consumes: string[];
    app_does_not_own: string[];
  };
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appProductProfilePath = path.join(appRoot, 'contracts', 'app-product-profile.json');
const requiredDefaultPackagedSkillIds = [
  'mas',
  'mag',
  'rca',
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
const requiredCompanionSkillSyncIds = requiredDefaultPackagedSkillIds.filter((skillId) => (
  !['mas', 'mag', 'rca'].includes(skillId)
));
const appOwnedSettingsTabs = ['general', 'access', 'capabilities', 'environment', 'appearance', 'advanced', 'about'];
const developerProfileCapabilityAxes = [
  'source_channel',
  'workspace_trust',
  'github_authority',
  'agent_automation',
  'runtime_mutation_scope',
];
const legacySettingsRouteRedirects = {
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

function assertStringArray(value: unknown, label: string, options: { allowBlank?: boolean } = {}): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((entry) => (
    typeof entry === 'string' && (options.allowBlank || entry.trim())
  ))) {
    throw new Error(`Invalid App product profile ${label}: expected a non-empty string array`);
  }
}

function assertIncludesAll(actual: string[], expected: string[], label: string): void {
  for (const item of expected) {
    if (!actual.includes(item)) {
      throw new Error(`Invalid App product profile ${label}: missing ${item}`);
    }
  }
}

function assertPostInstallAiSelfCheckEntry(
  entry: AppProductProfile['first_run']['beginner_presentation']['post_install_ai_self_check_entry'],
): void {
  if (
    entry?.target_route !== '/guid' ||
    entry.route_state !== 'postInstallSelfCheck' ||
    entry.prompt_policy !== 'localized Codex CLI read-only diagnosis prompt describing target OPL working mode' ||
    entry.mutation_policy !== 'diagnose_first_no_file_mutation_without_user_confirmation' ||
    entry.release_gate_policy !== 'user_visible_entry_complements_non_blocking_codex_ai_self_check_receipt'
  ) {
    throw new Error('App product profile first_run.beginner_presentation.post_install_ai_self_check_entry has invalid route or policy');
  }
  assertIncludesAll(
    entry.target_state_checks,
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
    'first_run.beginner_presentation.post_install_ai_self_check_entry.target_state_checks',
  );
}

function assertProfileShape(profile: AppProductProfile): void {
  if (profile.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected App product profile owner: ${profile.owner}`);
  }
  if (profile.purpose !== 'app_owned_product_profile') {
    throw new Error(`Unexpected App product profile purpose: ${profile.purpose}`);
  }
  if (profile.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected App product profile repo: ${profile.app_repo}`);
  }
  if (profile.default_session_profile.executor !== 'codex_cli') {
    throw new Error(`Unexpected App product profile executor: ${profile.default_session_profile.executor}`);
  }
  if (profile.default_session_profile.provider !== 'gflab') {
    throw new Error(`Unexpected App product profile provider: ${profile.default_session_profile.provider}`);
  }
  if (profile.default_session_profile.base_url !== 'https://gflabtoken.cn/v1') {
    throw new Error(`Unexpected App product profile base URL: ${profile.default_session_profile.base_url}`);
  }
  if (profile.default_session_profile.model !== profile.codex.default_model) {
    throw new Error('App product profile Codex default model is inconsistent');
  }
  if (profile.default_session_profile.reasoning_effort !== profile.codex.default_reasoning_effort) {
    throw new Error('App product profile Codex reasoning effort is inconsistent');
  }
  if (
    profile.codex.opl_flow_context?.flow_id !== 'opl-flow' ||
    profile.codex.opl_flow_context.delivery !== 'session_scoped_preset_context' ||
    profile.codex.opl_flow_context.user_agents_policy !== 'respect_user_agents_no_overwrite_detect_conflicts' ||
    profile.codex.opl_flow_context.language_policy !== 'follow_ui_locale_zh_only_when_ui_zh'
  ) {
    throw new Error('App product profile must declare App-managed OPL Flow Context policy');
  }
  if (
    !Array.isArray(profile.codex.session_context_i18n?.['zh-CN']) ||
    !profile.codex.session_context_i18n['zh-CN'].some((line) => line.includes('你正在 One Person Lab App')) ||
    !Array.isArray(profile.codex.session_context_i18n?.['en-US']) ||
    !profile.codex.session_context_i18n['en-US'].some((line) => line.includes('You are working inside a Codex session'))
  ) {
    throw new Error('App product profile must declare localized OPL Flow session context');
  }
  if (profile.gui?.authority !== 'app_repo_owned_product_truth') {
    throw new Error('App product profile must declare App-owned GUI authority');
  }
  if (profile.gui?.implementation_carrier !== 'opl-aion-shell') {
    throw new Error('App product profile GUI implementation carrier must be opl-aion-shell');
  }
  if (profile.gui.appearance?.default_css_theme_id !== 'default-theme') {
    throw new Error('App product profile GUI must default to the default CSS theme');
  }
  if (profile.gui.appearance?.codex_theme_default_enabled !== false) {
    throw new Error('App product profile GUI must not default to the Codex CSS theme');
  }
  if (
    profile.gui.home?.primary_input_surface !== 'single_card' ||
    profile.gui.home?.nested_input_card_frames_allowed !== false ||
    profile.gui.home?.codex_cli_fixed_executor !== true ||
    profile.gui.home?.home_executor_selector_visible !== false ||
    profile.gui.home?.codex_model_selector_visible !== true ||
    profile.gui.home?.codex_model_list_visible !== true ||
    profile.gui.home?.codex_model_policy !== 'codex_cli_latest_strongest_model_selector_visible' ||
    profile.gui.home?.codex_model_auto_option_visible !== true ||
    profile.gui.home?.permission_mode_selector_visible !== false ||
    profile.gui.home?.conversation_backend_selector_visible !== false ||
    profile.gui.home?.conversation_model_selector_visible !== true ||
    profile.gui.home?.conversation_permission_mode_selector_visible !== false
  ) {
    throw new Error('App product profile GUI home contract must keep Codex CLI fixed while exposing App-owned model selectors');
  }
  if (
    profile.gui.home.codex_default_model !== profile.codex.default_model ||
    profile.gui.home.codex_default_reasoning_effort !== profile.codex.default_reasoning_effort ||
    profile.gui.home.codex_default_permission_mode !== 'full-access' ||
    profile.gui.home.codex_home_model_status_label !== 'GPT-5.5（超高）' ||
    profile.gui.home.codex_home_model_status_label_en !== 'GPT-5.5 (Ultra)' ||
    profile.gui.home.codex_precise_model_display_policy !== 'friendly_default_model_and_reasoning_visible'
  ) {
    throw new Error('App product profile GUI home Codex defaults must show GPT-5.5 ultra status and full-access mode');
  }
  if (
    profile.gui.home.codex_auto_model_selection?.strategy !== 'codex_cli_auto_latest_available_frontier' ||
    profile.gui.home.codex_auto_model_selection.user_can_override_model !== true ||
    profile.gui.home.codex_auto_model_selection.user_can_restore_auto !== true ||
    profile.gui.home.codex_auto_model_selection.selection_persists_into_conversation !== true
  ) {
    throw new Error('App product profile GUI home Codex model policy must expose App-owned model selection');
  }
  assertStringArray(
    profile.gui.home.codex_auto_model_selection.frontier_model_preference_order,
    'gui.home.codex_auto_model_selection.frontier_model_preference_order',
  );
  const purposeEntries = profile.gui.home.home_purpose_entries ?? [];
  if (JSON.stringify(purposeEntries.map((entry) => entry.id)) !== JSON.stringify(['research', 'grant', 'ppt'])) {
    throw new Error('App product profile GUI home must expose exactly research, grant, and ppt purpose entries');
  }
  if (JSON.stringify(purposeEntries.map((entry) => entry.primary_label)) !== JSON.stringify(['科研', '基金', '演示'])) {
    throw new Error('App product profile GUI home purpose labels must be 科研, 基金, 演示');
  }
  if (JSON.stringify(purposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('App product profile GUI home purpose entries must route to MAS, MAG, and RCA');
  }
  for (const entry of purposeEntries) {
    if (entry.display_policy !== 'purpose_first' || entry.home_entry_policy !== 'visible_click_to_start') {
      throw new Error(`App product profile GUI home purpose entry ${entry.id} must be purpose-first and click-to-start`);
    }
  }
  assertStringArray(
    profile.gui.home.retired_codex_models_must_not_be_exposed,
    'gui.home.retired_codex_models_must_not_be_exposed',
  );
  if (
    profile.gui.home.activity_center_policy?.source !== 'not_rendered_on_ordinary_home' ||
    profile.gui.home.activity_center_policy.authority !== 'app_owned_home_minimal_command_surface' ||
    profile.gui.home.activity_center_policy.role !== 'home_runtime_activity_suppressed_to_keep_composer_first' ||
    profile.gui.home.activity_center_policy.default_placement !== 'not_rendered_on_ordinary_home' ||
    profile.gui.home.activity_center_policy.home_surface_policy !== 'ordinary_home_must_not_render_activity_center_or_continue_work_grid' ||
    profile.gui.home.activity_center_policy.footer_quick_actions_policy !== 'do_not_render_feedback_star_web_icons_on_home'
  ) {
    throw new Error('App product profile GUI home must keep runtime activity off ordinary Home');
  }
  if (profile.gui.home.activity_center_policy.allowed_home_runtime_context.length !== 0) {
    throw new Error('App product profile GUI home must not allow runtime context on ordinary Home');
  }
  assertIncludesAll(
    profile.gui.home.activity_center_policy.must_not_display,
    [
      'expanded continue-work center',
      'needs attention / active / recent activity groups',
      'per-assistant running badges',
      'module_runtime dirty state as task',
      'domain artifact body',
      'memory body',
      'quality verdict body',
      'provider implementation details',
    ],
    'gui.home.activity_center_policy.must_not_display',
  );
  if (
    profile.gui.builtin_assistant_route_receipt_policy?.scope !== 'home_purpose_entry_to_conversation' ||
    profile.gui.builtin_assistant_route_receipt_policy.route_kind !== 'builtin_capability' ||
    profile.gui.builtin_assistant_route_receipt_policy.executor !== 'codex_cli' ||
    profile.gui.builtin_assistant_route_receipt_policy.source !== 'opl_app_home' ||
    profile.gui.builtin_assistant_route_receipt_policy.must_not_depend_on_visible_backend_selection !== true
  ) {
    throw new Error('App product profile built-in assistant routes must emit Codex CLI route receipts without visible backend selection');
  }
  if (
    JSON.stringify(profile.gui.builtin_assistant_route_receipt_policy.required_for_assistants) !==
    JSON.stringify(['mas', 'mag', 'rca'])
  ) {
    throw new Error('App product profile route receipt policy must cover MAS, MAG, and RCA');
  }
  assertIncludesAll(
    profile.gui.builtin_assistant_route_receipt_policy.required_fields,
    ['route_kind', 'executor', 'assistant_id', 'assistant_short_name', 'source'],
    'gui.builtin_assistant_route_receipt_policy.required_fields',
  );
  const defaultAssistantIds = profile.gui.default_assistants?.map((assistant) => assistant.id) ?? [];
  if (JSON.stringify(defaultAssistantIds) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('App product profile default home assistants must be MAS, MAG, and RCA only');
  }
  const purposeLabels = profile.gui.default_assistants?.map((assistant) => assistant.home_purpose_label) ?? [];
  if (JSON.stringify(purposeLabels) !== JSON.stringify(['科研', '基金', '演示'])) {
    throw new Error('App product profile default assistants must expose purpose-first home labels');
  }
  for (const assistantId of ['mas', 'mag', 'rca']) {
    if (!defaultAssistantIds.includes(assistantId)) {
      throw new Error(`App product profile missing default assistant ${assistantId}`);
    }
  }
  if (defaultAssistantIds.includes('mds') || defaultAssistantIds.includes('oma')) {
    throw new Error('App product profile must not include MDS or OMA as a default home assistant');
  }
  for (const assistant of profile.gui.default_assistants ?? []) {
    if (assistant.home_entry_policy !== 'purpose_entry_target' || assistant.home_entry_display_policy !== 'purpose_first') {
      throw new Error(`Default assistant ${assistant.id} must use purpose-first home display`);
    }
    assertStringArray(Object.keys(assistant.description_i18n ?? {}), `gui.default_assistants.${assistant.id}.description_i18n`);
    assertStringArray(Object.keys(assistant.prompts_i18n ?? {}), `gui.default_assistants.${assistant.id}.prompts_i18n`);
  }
  const skillProfiles = profile.gui.assistant_skill_profiles ?? [];
  if (JSON.stringify(skillProfiles.map((entry) => entry.assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('App product profile assistant skill profiles must target MAS, MAG, and RCA');
  }
  const ordinarySelector = profile.gui.ordinary_capability_selector_policy;
  if (!ordinarySelector || typeof ordinarySelector !== 'object') {
    throw new Error('App product profile must declare ordinary_capability_selector_policy');
  }
  if (
    ordinarySelector.scope !== 'home_composer_and_ordinary_conversation' ||
    ordinarySelector.authority !== 'app_owned_opl_allowlist' ||
    ordinarySelector.skill_source_ref !== 'gui.assistant_skill_profiles.required_skills + optional_skills' ||
    ordinarySelector.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible' ||
    ordinarySelector.conversation_loaded_skill_display_policy !== 'filter_to_ordinary_skill_allowlist' ||
    ordinarySelector.mcp_server_source_ref !== 'gui.ordinary_capability_selector_policy.visible_mcp_server_ids' ||
    ordinarySelector.mcp_menu_policy !== 'empty_until_app_explicitly_whitelists_opl_mcp_servers' ||
    ordinarySelector.conversation_loaded_mcp_display_policy !== 'filter_to_visible_mcp_server_ids' ||
    ordinarySelector.forbidden_mcp_policy !==
      'do_not_surface_user_or_aionui_mcp_servers_in_ordinary_home_without_app_profile_allowlist'
  ) {
    throw new Error('App product profile ordinary capability selector policy must preserve OPL allowlist behavior');
  }
  assertStringArray(
    ordinarySelector.forbidden_skill_examples,
    'gui.ordinary_capability_selector_policy.forbidden_skill_examples',
  );
  assertIncludesAll(
    ordinarySelector.forbidden_skill_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator', 'cron'],
    'gui.ordinary_capability_selector_policy.forbidden_skill_examples',
  );
  if (!Array.isArray(ordinarySelector.visible_mcp_server_ids) || ordinarySelector.visible_mcp_server_ids.length !== 0) {
    throw new Error('App product profile ordinary MCP selector must default to an empty App allowlist');
  }
  const requiredByAssistant = new Map(skillProfiles.map((entry) => [entry.assistant_id, entry.required_skills]));
  for (const assistantId of ['mas', 'mag', 'rca']) {
    const requiredSkills = requiredByAssistant.get(assistantId);
    if (JSON.stringify(requiredSkills) !== JSON.stringify([assistantId])) {
      throw new Error(`App product profile assistant ${assistantId} must require its matching Codex skill`);
    }
  }
  for (const entry of skillProfiles) {
    assertStringArray(entry.required_skills, `gui.assistant_skill_profiles.${entry.assistant_id}.required_skills`);
    assertStringArray(entry.optional_skills, `gui.assistant_skill_profiles.${entry.assistant_id}.optional_skills`);
    if ('hidden_home_skill_names' in entry) {
      throw new Error(`App product profile assistant ${entry.assistant_id} must not carry UI hiding policy`);
    }
    if (entry.optional_skills.includes('morph-ppt')) {
      throw new Error(`App product profile assistant ${entry.assistant_id} must not expose retired morph-ppt skill wiring`);
    }
    if (
      entry.required_skill_policy !== 'checked_locked' ||
      entry.optional_skill_policy !== 'unchecked_user_selectable' ||
      entry.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible'
    ) {
      throw new Error(`App product profile assistant ${entry.assistant_id} has invalid skill menu policy`);
    }
  }
  const oma = profile.gui.non_default_assistants?.find((assistant) => assistant.id === 'oma');
  if (!oma || oma.home_default_visible !== false || oma.home_entry_policy !== 'explicit_or_settings_only') {
    throw new Error('App product profile must keep OMA available but out of default home entries');
  }
  assertStringArray(profile.codex.default_visible_skills, 'codex.default_visible_skills');
  assertStringArray(profile.codex.skill_priority, 'codex.skill_priority');
  assertStringArray(profile.codex.session_context_lines, 'codex.session_context_lines', { allowBlank: true });
  assertStringArray(profile.first_run.readiness_layers, 'first_run.readiness_layers');
  assertStringArray(profile.first_run.ready_to_launch_gate.required_core_items, 'first_run.ready_to_launch_gate.required_core_items');
  assertStringArray(profile.first_run.ready_to_launch_gate.must_not_require, 'first_run.ready_to_launch_gate.must_not_require');
  assertStringArray(profile.first_run.full_readiness_layers, 'first_run.full_readiness_layers');
  assertStringArray(profile.first_run.deferred_blockers, 'first_run.deferred_blockers');
  assertStringArray(profile.first_run.first_conversation.must_wait_for, 'first_run.first_conversation.must_wait_for');
  assertStringArray(profile.first_run.first_conversation.must_not_wait_for, 'first_run.first_conversation.must_not_wait_for');
  assertStringArray(profile.first_run.beginner_presentation.primary_steps, 'first_run.beginner_presentation.primary_steps');
  assertPostInstallAiSelfCheckEntry(profile.first_run.beginner_presentation.post_install_ai_self_check_entry);
  if (
    profile.first_run.first_conversation.gate !== 'acp_warmup_before_initial_send' ||
    profile.first_run.first_conversation.source_command !== 'opl system initialize --json' ||
    profile.first_run.first_conversation.ready_to_launch_must_be_true !== true ||
    profile.first_run.first_conversation.failure_policy !== 'show_retryable_initial_message_error_without_losing_user_prompt'
  ) {
    throw new Error('App product profile first_run.first_conversation must gate initial send on ready_to_launch and ACP warmup');
  }
  assertIncludesAll(
    profile.first_run.first_conversation.must_wait_for,
    ['conversation_record_ready', 'acp_warmup_complete'],
    'first_run.first_conversation.must_wait_for',
  );
  assertIncludesAll(
    profile.first_run.first_conversation.must_not_wait_for,
    [
      'domain_modules',
      'family_runtime_provider',
      'recommended_skills',
      'native_helpers',
      'repo_sync',
      'command_line_tools_install',
      'ecosystem_module_updates',
    ],
    'first_run.first_conversation.must_not_wait_for',
  );
  if (profile.first_run.progress_model.source_command !== 'opl system initialize --json') {
    throw new Error('App product profile first_run.progress_model.source_command must be opl system initialize --json');
  }
  if (profile.first_run.progress_model.source_path !== 'system_initialize.setup_flow') {
    throw new Error('App product profile first_run.progress_model.source_path must be system_initialize.setup_flow');
  }
  if (profile.first_run.progress_model.renderer_truth_policy !== 'render_only_no_shell_private_progress_truth') {
    throw new Error('App product profile first_run.progress_model must keep renderers display-only');
  }
  assertStringArray(profile.first_run.progress_model.required_setup_flow_fields, 'first_run.progress_model.required_setup_flow_fields');
  assertStringArray(profile.first_run.progress_model.required_progress_fields, 'first_run.progress_model.required_progress_fields');
  assertStringArray(profile.first_run.progress_model.required_checklist_fields, 'first_run.progress_model.required_checklist_fields');
  assertStringArray(profile.first_run.progress_model.required_visible_elements, 'first_run.progress_model.required_visible_elements');
  assertStringArray(profile.first_run.command_line_tools.messages, 'first_run.command_line_tools.messages');
  assertStringArray(profile.settings.visible_tabs, 'settings.visible_tabs');
  if (
    JSON.stringify(profile.settings.visible_tabs) !==
    JSON.stringify(appOwnedSettingsTabs)
  ) {
    throw new Error('App product profile settings.visible_tabs must keep ordinary settings on OPL App-owned pages');
  }
  if (
    JSON.stringify(profile.settings.legacy_route_redirects) !==
    JSON.stringify(legacySettingsRouteRedirects)
  ) {
    throw new Error('App product profile settings.legacy_route_redirects must route legacy AionUI settings to App-owned pages');
  }
  const settingsIaKeys = Object.keys(profile.settings.settings_information_architecture ?? {});
  if (JSON.stringify(settingsIaKeys) !== JSON.stringify(appOwnedSettingsTabs)) {
    throw new Error('App product profile settings_information_architecture must describe every ordinary App settings tab');
  }
  assertStringArray(profile.settings.environment_items, 'settings.environment_items');
  const developerProfile = profile.settings.developer_profile;
  if (!developerProfile || typeof developerProfile !== 'object') {
    throw new Error('App product profile settings.developer_profile must be declared');
  }
  if (
    developerProfile.source !== 'app_state.developer_profile + app_state.developer_mode compatibility field + app_state.modules[].source_policy' ||
    developerProfile.default_profile !== 'standard_user' ||
    developerProfile.opt_in_policy !== 'explicit_opt_in_only' ||
    developerProfile.hide_machine_status !== true
  ) {
    throw new Error('App product profile Developer Profile must preserve standard defaults and explicit opt-in policy');
  }
  if (JSON.stringify(developerProfile.capability_axes) !== JSON.stringify(developerProfileCapabilityAxes)) {
    throw new Error('App product profile Developer Profile must declare the required capability axes');
  }
  for (const axis of developerProfileCapabilityAxes) {
    const capability = developerProfile.capabilities?.[axis];
    if (!capability || typeof capability !== 'object') {
      throw new Error(`App product profile Developer Profile capability ${axis} must be declared`);
    }
    for (const field of ['standard_default', 'developer_opt_in', 'display_policy'] as const) {
      if (typeof capability[field] !== 'string' || !capability[field].trim()) {
        throw new Error(`App product profile Developer Profile capability ${axis}.${field} must be a non-empty string`);
      }
    }
  }
  if (
    developerProfile.capabilities.source_channel.standard_default !== 'stable_package_channel' ||
    developerProfile.capabilities.source_channel.developer_opt_in !== 'github_repo_or_local_checkout' ||
    developerProfile.capabilities.runtime_mutation_scope.standard_default !== 'app_action_route_only' ||
    developerProfile.legacy_developer_mode_alias?.state_source !== 'app_state.developer_mode' ||
    developerProfile.legacy_developer_mode_alias.display_policy !== 'show_as_profile_summary_not_primary_switch' ||
    developerProfile.legacy_developer_mode_alias.must_not_display_as !== 'single_global_toggle'
  ) {
    throw new Error('App product profile Developer Profile must replace the single Developer Mode switch with capability display');
  }
  assertStringArray(profile.companion_payloads.tools, 'companion_payloads.tools');
  assertStringArray(profile.companion_payloads.domain_modules, 'companion_payloads.domain_modules');
  assertStringArray(
    profile.companion_payloads.default_packaged_codex_skill_ids,
    'companion_payloads.default_packaged_codex_skill_ids',
  );
  assertStringArray(
    profile.companion_payloads.packaged_not_default_visible_codex_skill_ids,
    'companion_payloads.packaged_not_default_visible_codex_skill_ids',
  );
  assertStringArray(profile.companion_payloads.companion_skill_sync_default_ids, 'companion_payloads.companion_skill_sync_default_ids');
  assertStringArray(profile.companion_payloads.domain_plugin_skill_ids, 'companion_payloads.domain_plugin_skill_ids');
  const visibleSkills = new Set(profile.codex.default_visible_skills);
  const defaultPackagedSkills = new Set(profile.companion_payloads.default_packaged_codex_skill_ids);
  const packagedExplicitSkills = new Set(profile.companion_payloads.packaged_not_default_visible_codex_skill_ids);
  for (const entry of skillProfiles) {
    const unpackagedProfileSkills = [...entry.required_skills, ...entry.optional_skills]
      .filter((skill) => !defaultPackagedSkills.has(skill));
    if (unpackagedProfileSkills.length > 0) {
      throw new Error(
        `App product profile assistant ${entry.assistant_id} references skills outside the App packaged set: ${unpackagedProfileSkills.join(', ')}`,
      );
    }
  }
  const missingPackagedVisibleSkills = profile.codex.default_visible_skills
    .filter((skill) => !defaultPackagedSkills.has(skill));
  if (missingPackagedVisibleSkills.length > 0) {
    throw new Error(`App product profile default visible skills must be packaged: ${missingPackagedVisibleSkills.join(', ')}`);
  }
  const hiddenDefaultPackagedSkills = profile.companion_payloads.default_packaged_codex_skill_ids
    .filter((skill) => !visibleSkills.has(skill));
  if (hiddenDefaultPackagedSkills.length > 0) {
    throw new Error(
      `App product profile default packaged skills must be default visible: ${hiddenDefaultPackagedSkills.join(', ')}`,
    );
  }
  const missingPrioritySkills = profile.codex.default_visible_skills
    .filter((skill) => !profile.codex.skill_priority.includes(skill));
  if (missingPrioritySkills.length > 0) {
    throw new Error(`App product profile skill_priority is missing default visible skills: ${missingPrioritySkills.join(', ')}`);
  }
  const overlappingExplicitSkills = [...packagedExplicitSkills].filter((skill) => visibleSkills.has(skill));
  if (overlappingExplicitSkills.length > 0) {
    throw new Error(
      `App product profile packaged_not_default_visible skills must stay out of default_visible_skills: ${overlappingExplicitSkills.join(', ')}`,
    );
  }
  if (!defaultPackagedSkills.has('superpowers')) {
    throw new Error('App product profile must package superpowers when it is default visible');
  }
  assertIncludesAll(
    profile.companion_payloads.default_packaged_codex_skill_ids,
    requiredDefaultPackagedSkillIds,
    'companion_payloads.default_packaged_codex_skill_ids',
  );
  assertIncludesAll(
    profile.companion_payloads.companion_skill_sync_default_ids,
    requiredCompanionSkillSyncIds,
    'companion_payloads.companion_skill_sync_default_ids',
  );
  if (!packagedExplicitSkills.has('opl-meta-agent')) {
    throw new Error('App product profile must mark opl-meta-agent as packaged but not default visible');
  }
  if (profile.codex.skill_priority.includes('morph-ppt') || defaultPackagedSkills.has('morph-ppt') || packagedExplicitSkills.has('morph-ppt')) {
    throw new Error('App product profile must not include retired morph-ppt skill wiring');
  }
  if (profile.companion_payloads.install_exposure_policy_ref !== 'contracts/app-install-exposure-policy.json') {
    throw new Error('App product profile companion payloads must reference app-install-exposure-policy.json');
  }
  if (profile.companion_payloads.public_abi?.primary_semantic_entry !== 'skill') {
    throw new Error('App product profile companion payloads must keep skill as the primary semantic entry');
  }
  if (profile.companion_payloads.public_abi.plugin_must_not_create_second_semantics !== true) {
    throw new Error('App product profile companion payloads must forbid second semantics from plugin packaging');
  }
  if (profile.companion_payloads.domain_plugin_skills_must_not_be_companion_mirrors !== true) {
    throw new Error('App product profile domain plugin skills must not be companion mirrors');
  }
  for (const domainPluginId of profile.companion_payloads.domain_plugin_skill_ids) {
    if (profile.companion_payloads.companion_skill_sync_default_ids.includes(domainPluginId)) {
      throw new Error(`App product profile companion sync defaults must not include domain plugin ${domainPluginId}`);
    }
  }
  assertStringArray(profile.boundary.app_does_not_own, 'boundary.app_does_not_own');
}

export function readAppProductProfile(profilePath = appProductProfilePath): AppProductProfile {
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8')) as AppProductProfile;
  assertProfileShape(profile);
  return profile;
}

export function formatCodexProfileLabel(profile = readAppProductProfile()): string {
  return `${profile.codex.default_model} / ${profile.codex.default_reasoning_effort}`;
}

export function formatCodexProfilePhrase(profile = readAppProductProfile()): string {
  return `${profile.codex.default_model} with ${profile.codex.default_reasoning_effort} reasoning`;
}

export function formatRecommendedCompanionSkills(profile = readAppProductProfile()): string {
  return profile.companion_payloads.default_packaged_codex_skill_ids.join(', ');
}

export function syncAppProductProfileToShell(
  shellRoot: string,
  options: { optional?: boolean } = {},
): { synced: boolean; targetPath: string } {
  const shellPaths = resolveActiveShellPaths({ contract: readAppShellAdapterContract(), shellRoot });
  const targetPath = shellPaths.productProfileTargetPath;
  if (!fs.existsSync(shellPaths.packageManifestPath)) {
    if (options.optional) return { synced: false, targetPath };
    throw new Error(`Missing active shell checkout: ${shellRoot}`);
  }

  const profile = readAppProductProfile();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  const localOxfmt = path.join(shellRoot, 'node_modules', '.bin', 'oxfmt');
  if (fs.existsSync(localOxfmt)) {
    spawnSync(localOxfmt, [targetPath], { cwd: shellRoot, stdio: 'ignore' });
  }
  return { synced: true, targetPath };
}

function main(): void {
  const profile = readAppProductProfile();
  const shellPaths = resolveActiveShellPaths();
  const result = syncAppProductProfileToShell(shellPaths.shellRoot);
  console.log(JSON.stringify({
    status: result.synced ? 'synced' : 'skipped',
    owner: profile.owner,
    source: path.relative(appRoot, appProductProfilePath),
    target: result.targetPath,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
