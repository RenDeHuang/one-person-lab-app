#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readAppShellAdapterContract, resolveActiveShellPaths } from './app-shell-adapter.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guiProductContractPath = path.join(root, 'contracts', 'app-gui-product-contract.json');
const runtimeBridgePath = path.join(root, 'contracts', 'app-runtime-bridge.json');
const pageStateMatrixPath = path.join(root, 'contracts', 'app-page-state-matrix.json');
const firstRunMatrixPath = path.join(root, 'contracts', 'app-first-run-test-matrix.json');
const productProfilePath = path.join(root, 'contracts', 'app-product-profile.json');
const installExposurePolicyPath = path.join(root, 'contracts', 'app-install-exposure-policy.json');
const releaseChannelPath = path.join(root, 'contracts', 'app-release-channel.json');
const defaultActiveShellContractPath = path.join(root, 'contracts', 'app-shell-adapter.json');
const commandMaxBuffer = 128 * 1024 * 1024;
const requiredHostTools = ['command_line_tools', 'homebrew', 'node', 'git'];
const firstRunCoreItems = ['workspace_root', 'codex_cli', 'codex_config'];
const fullReadinessItems = [
  'domain_modules',
  'family_runtime_provider',
  'recommended_skills',
  'native_helpers',
  'repo_sync',
  'command_line_tools_install',
  'ecosystem_module_updates',
];
const deferredMaintenanceItems = [
  'repo_sync',
  'module_reconcile',
  'command_line_tools_install',
  'native_helpers',
  'companion_skills_install',
  'ecosystem_module_updates',
];
const ecosystemModuleIds = ['officecli', 'mineru', 'opl-meta-agent'];
const defaultCompanionSkillSyncIds = [
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
const domainExposureEntries = [
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
    domain_id: 'oma',
    home_purpose_entry: null,
    codex_visible_entry: 'opl-meta-agent',
    preferred_app_distribution: 'opl_generated_skill_surface',
  },
];
const forbiddenAuthorityOwners = [
  'runtime_truth',
  'provider_implementation',
  'domain_truth',
  'domain_quality_verdict',
  'domain_artifact_authority',
];
const beginnerFirstRunTestIds = [
  'opl-first-run-beginner-summary',
  'opl-first-run-primary-action',
  'opl-first-run-technical-details-toggle',
];
const appOwnedSettingsTabs = ['general', 'access', 'capabilities', 'environment', 'appearance', 'advanced', 'about'];
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
const ordinaryHiddenLegacySettingsTabs = Object.keys(legacySettingsRouteRedirects);
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
const homeActivityCenterForbiddenDisplays = [
  'domain artifact body',
  'memory body',
  'quality verdict body',
  'provider implementation details',
];
const appOwnedHomeLayout = {
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
const appOwnedGuiContractOrdinaryConversation = {
  ...appOwnedOrdinaryConversation,
  model_status_surface: 'executor_policy.default_model_display_value',
};
const appOwnedPageStateOrdinaryConversation = {
  ...Object.fromEntries(
    Object.entries(appOwnedOrdinaryConversation).filter(
      ([key]) => key !== 'model_status_surface' && key !== 'technical_details_policy',
    ),
  ),
  model_status_surface_ref: 'contracts/app-gui-product-contract.json#executor_policy.default_model_display_value',
  technical_details_policy: appOwnedOrdinaryConversation.technical_details_policy,
};
const appOwnedRightContextInspectorTabIds = ['files', 'capabilities', 'runtime', 'memory', 'automations', 'settings'];
const settingsPageExpectations = {
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
    sections: ['core.codex', 'provider.temporal', 'modules', 'paths', 'release'],
    must_show: [
      'Codex CLI version and default profile from app_state.core',
      'Temporal status from app_state.provider.temporal',
      'MAS/MAG/RCA/OMA module version and source from app_state.modules',
      'module path source explanation',
      'section-level refresh state',
      'environment page named Local Environment, distinct from Project Progress',
    ],
    must_not_show: [
      'Med Deep Scientist as a default module',
      'page-wide spinner while one section refreshes',
      'GUI-owned Temporal restart judgment',
      'project progress as a settings runtime page',
    ],
  },
  settings_advanced: {
    matrix_id: 'advanced',
    sections: ['developer_mode', 'paths', 'logs', 'opl_flow_context', 'opl_agent_codex_context', 'diagnostics'],
    must_show: [
      'Developer Mode effective state from app_state.developer_mode',
      'workspace path from app_state.paths',
      'logs path from app_state.paths',
      'OPL Flow Context',
      'diagnostics and raw refs behind Advanced navigation',
    ],
    must_not_show: [
      'delayed developer mode flip from a shell-local cache',
      'AionUI local directory as OPL path truth',
      'Developer Mode as ordinary first-level user setup',
    ],
  },
};

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function assertIncludesAll(actual, expected, label) {
  if (!Array.isArray(actual)) {
    throw new Error(`${label} must be an array`);
  }
  for (const item of expected) {
    if (!actual.includes(item)) {
      throw new Error(`${label} must include ${item}`);
    }
  }
}

function assertDeepEqualJson(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`);
  }
}

function validateProgressDeltaDisplayContract(progressDelta, label) {
  if (!progressDelta || typeof progressDelta !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.task_drilldowns.progress_delta_classification',
    authority: 'opl_framework_shared_progress_projection',
    display_policy: 'classification_only_no_domain_artifact_body',
    platform_repair_display_treatment: 'separate_infrastructure_repair_not_deliverable_progress',
  })) {
    if (progressDelta[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    progressDelta.required_fields,
    ['deliverable_progress_delta', 'platform_repair_delta', 'progress_delta_classification'],
    `${label} required_fields`,
  );
  if (progressDelta.forbidden_delivery_claim_for_platform_repair !== true) {
    throw new Error(`${label} must forbid platform repair from being shown as deliverable progress`);
  }
}

function validateActiveProjectLineProjectionContract(activeProjectLineProjection, label, options = {}) {
  if (!activeProjectLineProjection || typeof activeProjectLineProjection !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.activity_center.active_projects + app_state.operator.visual_ref_groups.active_project_refs',
    authority: 'opl_framework_refs_only_project_line_projection',
    display_policy: 'active_project_line_count_can_include_queued_or_escalated_owner_handled_lines_without_active_worker_run',
  })) {
    if (activeProjectLineProjection[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  if (activeProjectLineProjection.status_preservation_required !== true) {
    throw new Error(`${label} must preserve status, active_run_id, and next_visible_step`);
  }
  if (options.requireFields !== false) {
    assertIncludesAll(
      activeProjectLineProjection.required_fields,
      ['task_id', 'title', 'state', 'status', 'study_id', 'active_run_id', 'next_visible_step'],
      `${label} required_fields`,
    );
  }
  assertIncludesAll(
    activeProjectLineProjection.must_not_claim,
    ['active_worker_run', 'provider_execution_running', 'domain_ready', 'paper_quality_ready'],
    `${label} must_not_claim`,
  );
}

function validateProjectProgressDisplayContract(projectProgress, label) {
  if (!projectProgress || typeof projectProgress !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.task_drilldowns',
    authority: 'opl_framework_shared_project_progress_projection',
    display_policy: 'project_progress_refs_secondary_no_module_runtime_dirty_as_project',
    diagnostics_treatment: 'secondary_disclosure',
    safe_actions_treatment: 'secondary_operator_disclosure',
  })) {
    if (projectProgress[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    projectProgress.required_fields,
    [
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
    `${label} required_fields`,
  );
  assertIncludesAll(
    projectProgress.optional_user_fields,
    ['domain_label', 'active_stage_label', 'next_visible_step', 'next_owner', 'last_progress_at'],
    `${label} optional_user_fields`,
  );
  assertIncludesAll(
    projectProgress.forbidden_running_task_sources,
    [
      'module_runtime dirty state',
      'domain lane active_task_count',
      'assistant purpose cards',
      'module readiness diagnostics',
    ],
    `${label} forbidden_running_task_sources`,
  );
  validateActiveProjectLineProjectionContract(
    projectProgress.active_project_line_projection,
    `${label} active project line projection`,
  );
}

function validateUserTaskStatusProjectionContract(userTaskStatus, label) {
  if (!userTaskStatus || typeof userTaskStatus !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    source: 'app_state.operator.workbench.summary_cards + app_state.operator.workbench.activity_center + app_state.operator.workbench.task_drilldowns + app_state.operator.visual_ref_groups.active_project_refs',
    authority: 'opl_framework_refs_only_user_task_projection',
    display_policy: 'user_task_status_first_provider_projection_diagnostic_only',
    default_user_question: "How many tasks are running, how many projects or tasks are active or queued, how many need attention, and what is each task's current step?",
    progress_label_policy: 'render framework progress classification and stage labels as human task progress labels without exposing raw projection or ledger names',
    diagnostic_source_policy: 'provider/projection/ref/ledger/current_control_state details stay secondary and are not the default page language',
  })) {
    if (userTaskStatus[field] !== expected) {
      throw new Error(`${label} ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    userTaskStatus.summary_fields,
    ['running_task_count', 'active_project_count', 'queued_project_count', 'attention_count'],
    `${label} summary_fields`,
  );
  assertDeepEqualJson(
    userTaskStatus.task_fields,
    ['task_id', 'title', 'status', 'stage', 'progress_label', 'next_step', 'owner', 'last_progress'],
    `${label} task_fields`,
  );
  for (const [field, expected] of Object.entries({
    running_task_count: 'count user tasks projected as actively running or advancing, never raw provider attempts',
    active_project_count: 'count active user-visible project lines from the framework project-line projection',
    queued_project_count: 'count queued or waiting user-visible project/task lines without claiming active worker runs',
    attention_count: 'count user-visible blockers, human gates, failed safe actions, or owner attention states',
  })) {
    if (userTaskStatus.count_policies?.[field] !== expected) {
      throw new Error(`${label} count_policies.${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    userTaskStatus.must_not_default_display_terms,
    ['Temporal', 'provider', 'projection', 'ref', 'stage attempt', 'ledger', 'current_control_state'],
    `${label} must_not_default_display_terms`,
  );
  if (userTaskStatus.refs_only !== true) {
    throw new Error(`${label} must be refs-only`);
  }
}

function validateBeginnerFirstRunPresentation(presentation, label) {
  if (presentation?.audience !== 'beginner_non_technical_users') {
    throw new Error(`${label} must target beginner_non_technical_users`);
  }
  if (presentation.presentation_mode !== 'simplified_first_run') {
    throw new Error(`${label} must use simplified_first_run presentation`);
  }
  if (presentation.primary_user_goal !== 'reach_guid_with_codex_ready') {
    throw new Error(`${label} must focus on reaching /guid with Codex ready`);
  }
  assertIncludesAll(presentation.primary_steps, firstRunCoreItems, `${label} primary steps`);
  for (const [field, expected] of Object.entries({
    advanced_progress_disclosure: 'collapsed_or_secondary',
    background_maintenance_presentation: 'collapsed_technical_non_blocking',
    technical_detail_policy: 'hidden_until_expanded_or_error',
  })) {
    if (presentation[field] !== expected) {
      throw new Error(`${label}.${field} must be ${expected}`);
    }
  }
  const selfCheck = presentation.post_install_ai_self_check_entry;
  if (!selfCheck || typeof selfCheck !== 'object') {
    throw new Error(`${label} must define post_install_ai_self_check_entry`);
  }
  for (const [field, expected] of Object.entries({
    target_route: '/guid',
    route_state: 'postInstallSelfCheck',
    prompt_policy: 'localized Codex CLI read-only diagnosis prompt describing target OPL working mode',
    mutation_policy: 'diagnose_first_no_file_mutation_without_user_confirmation',
    release_gate_policy: 'user_visible_entry_complements_non_blocking_codex_ai_self_check_receipt',
  })) {
    if (selfCheck[field] !== expected) {
      throw new Error(`${label}.post_install_ai_self_check_entry.${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    selfCheck.target_state_checks,
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
    `${label}.post_install_ai_self_check_entry target_state_checks`,
  );
}

function validateOplFlowContext(context, label) {
  if (!context || typeof context !== 'object') {
    throw new Error(`${label} must be declared`);
  }
  for (const [field, expected] of Object.entries({
    flow_id: 'opl-flow',
    delivery: 'session_scoped_preset_context',
    user_agents_policy: 'respect_user_agents_no_overwrite_detect_conflicts',
    language_policy: 'follow_ui_locale_zh_only_when_ui_zh',
  })) {
    if (context[field] !== expected) {
      throw new Error(`${label}.${field} must be ${expected}`);
    }
  }
}

function parseArgs(argv) {
  const parsed = { quick: false, only: new Set() };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--quick') {
      parsed.quick = true;
      continue;
    }
    if (arg === '--only') {
      const value = argv[++index];
      if (!value) throw new Error('Missing value for --only');
      for (const id of value.split(',').map((entry) => entry.trim()).filter(Boolean)) {
        parsed.only.add(id);
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function assertFile(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${path.relative(root, filePath)}`);
  }
}

function resolveValidationCwd(entry, contract, shellPaths) {
  if (entry.cwd === contract.shell_root) {
    return shellPaths.shellRoot;
  }
  return path.join(root, entry.cwd);
}

function isDefaultReleaseAdapter(contract) {
  return contract.active_shell === 'aionui' && contract.shell_root === 'shells/aionui';
}

function validateContractShape(contract) {
  if (contract.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected app_repo: ${contract.app_repo}`);
  }
  if (contract.active_shell === 'aionui' && contract.shell_source?.owner_repo !== 'gaofeng21cn/opl-aion-shell') {
    throw new Error(`Unexpected AionUI shell_source owner: ${contract.shell_source?.owner_repo}`);
  }
  if (contract.shell_source?.history_policy !== 'external_checkout_not_merged_into_app_default_branch') {
    throw new Error(`Unexpected shell history policy: ${contract.shell_source?.history_policy}`);
  }
  if (contract.runtime_bridge_contract !== 'contracts/app-runtime-bridge.json') {
    throw new Error(`Unexpected runtime bridge contract ref: ${contract.runtime_bridge_contract}`);
  }
  if (contract.gui_authority?.source_of_truth !== 'one-person-lab-app') {
    throw new Error('Active shell GUI authority must stay in one-person-lab-app');
  }
  if (contract.gui_authority.implementation_role !== 'active_shell_implementation_carrier') {
    throw new Error('Active shell GUI implementation role must be active_shell_implementation_carrier');
  }
  const requiredProductContracts = [
    'contracts/app-gui-product-contract.json',
    'contracts/app-runtime-bridge.json',
    'contracts/app-product-profile.json',
    'contracts/app-install-exposure-policy.json',
    'contracts/app-page-state-matrix.json',
    'contracts/app-first-run-test-matrix.json',
    'contracts/app-release-channel.json',
  ];
  for (const contractRef of requiredProductContracts) {
    if (!contract.gui_authority.product_contracts?.includes(contractRef)) {
      throw new Error(`Active shell GUI authority must include product contract ${contractRef}`);
    }
    assertFile(path.join(root, contractRef), `GUI authority contract ${contractRef}`);
  }
  const requiredShellOwnedSurface = [
    'concrete renderer implementation',
    'process and preload implementation',
    'shell package metadata',
    'shell tests and release hooks',
  ];
  if (isDefaultReleaseAdapter(contract)) {
    requiredShellOwnedSurface.push('upstream AionUI intake');
  }
  for (const allowed of requiredShellOwnedSurface) {
    if (!contract.gui_authority.shell_may_own?.includes(allowed)) {
      throw new Error(`Active shell GUI authority must declare shell-owned surface ${allowed}`);
    }
  }
  for (const forbidden of [
    'App GUI product truth',
    'App user-facing page-state authority',
    'App model-selection policy',
    'App onboarding policy',
    'App release/user documentation authority',
    'OPL runtime truth',
    'domain truth',
    'provider implementation',
  ]) {
    if (!contract.gui_authority.shell_must_not_own?.includes(forbidden)) {
      throw new Error(`Active shell GUI authority must exclude shell ownership of ${forbidden}`);
    }
  }
  if (contract.gui_authority.upstream_intake_policy !== 'check_against_app_owned_gui_contracts_before_acceptance') {
    throw new Error(`Unexpected GUI upstream intake policy: ${contract.gui_authority.upstream_intake_policy}`);
  }
  if (contract.shell_replacement_policy?.candidate_root_pattern !== 'shells/<candidate>') {
    throw new Error('Shell replacement policy must keep candidates under shells/<candidate>');
  }
  if (contract.shell_replacement_policy.candidate_state !== 'candidate_until_contracts_and_tests_complete') {
    throw new Error(`Unexpected shell candidate state: ${contract.shell_replacement_policy.candidate_state}`);
  }
  if (contract.shell_replacement_policy.authority_transfer_allowed !== false) {
    throw new Error('Shell replacement must not transfer App GUI authority');
  }
  for (const gate of [
    'declare candidate in contracts/app-shell-candidates.json',
    'implement contracts/app-gui-product-contract.json',
    'sync App product profile into the candidate shell target',
    'pass App page-state and first-run matrices',
    'pass App-root active shell validation',
    'pass GUI package compile through App wrapper',
    'preserve external checkout history policy',
  ]) {
    if (!contract.shell_replacement_policy.adoption_gate?.includes(gate)) {
      throw new Error(`Shell replacement policy missing adoption gate ${gate}`);
    }
  }
  if (contract.shell_replacement_policy.adoption_gate.includes('declare candidate in contracts/app-shell-adapter.json')) {
    throw new Error('Shell replacement policy must not declare candidates inside contracts/app-shell-adapter.json');
  }
  for (const capability of [
    'app_owned_gui_product_contract',
    'app_owned_runtime_bridge_contract',
    'opl_app_state_bridge',
    'opl_app_action_bridge',
    'app_gui_release_channel_gating',
  ]) {
    if (!contract.shell_contract.capabilities?.includes(capability)) {
      throw new Error(`Active shell capability missing ${capability}`);
    }
  }
  if (contract.gui_product_contract !== 'contracts/app-gui-product-contract.json') {
    throw new Error(`Unexpected active shell gui_product_contract: ${contract.gui_product_contract}`);
  }
  if (contract.gui_product_contract_policy?.must_implement !== true) {
    throw new Error('Active shell must implement the App GUI product contract');
  }
  if (contract.gui_product_contract_policy.source_of_truth !== 'one-person-lab-app') {
    throw new Error('Active shell GUI product contract source of truth must stay in one-person-lab-app');
  }
  if (contract.gui_product_contract_policy.upstream_override_allowed !== false) {
    throw new Error('AionUI upstream must not override App GUI product truth');
  }
  if (contract.gui_product_contract_policy.upstream_family_role !== 'implementation_material_only') {
    throw new Error(`Unexpected upstream GUI role: ${contract.gui_product_contract_policy.upstream_family_role}`);
  }
  if (
    contract.gui_product_contract_policy.upstream_must_not_override_app_truth !== true
    && contract.gui_product_contract_policy.aionui_upstream_must_not_override_app_truth !== true
  ) {
    throw new Error('Active shell must declare that upstream GUI behavior cannot override App truth');
  }
  const stateSurface = contract.state_surface_contract;
  for (const [field, expected] of Object.entries({
    primary_read_command: 'opl app state --profile fast --json',
    refresh_read_command: 'opl app state --profile fast --json',
    full_state_read_command: 'opl app state --profile full --json',
    full_state_policy: 'diagnostic_or_release_evidence_only',
    action_command: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
    full_drilldown_exception: 'opl runtime app-operator-drilldown --detail full --json',
  })) {
    if (stateSurface?.[field] !== expected) {
      throw new Error(`Active shell state_surface_contract.${field} must be ${expected}`);
    }
  }
  for (const forbiddenSource of [
    'direct opl modules --json page aggregation',
    'direct opl system developer-supervisor page aggregation',
    'direct opl family-runtime worker status page aggregation',
    'application.systemInfo as OPL path truth',
    'application.appVersions as OPL release truth',
    'direct reads of OPL internal state files',
  ]) {
    if (!stateSurface?.forbidden_gui_truth_sources?.includes(forbiddenSource)) {
      throw new Error(`Active shell state surface must forbid ${forbiddenSource}`);
    }
  }

  const shellPaths = resolveActiveShellPaths({ contract });
  assertFile(shellPaths.shellRoot, 'active shell root');
  assertFile(shellPaths.packageManifestPath, 'active shell package.json');
  assertFile(shellPaths.agentsGuidePath, 'active shell AGENTS.md');
  assertFile(shellPaths.vitestConfigPath, 'active shell vitest config');
  assertFile(shellPaths.electronBuilderConfigPath, 'active shell electron-builder config');

  if (!Array.isArray(contract.validation_commands) || contract.validation_commands.length === 0) {
    throw new Error('validation_commands must be a non-empty array');
  }

  for (const entry of contract.validation_commands) {
    if (!entry.id || !entry.cwd || !entry.command) {
      throw new Error(`Invalid validation command entry: ${JSON.stringify(entry)}`);
    }
    assertFile(resolveValidationCwd(entry, contract, shellPaths), `validation cwd for ${entry.id}`);
  }
}

function readShellText(shellPaths, relativePath) {
  const filePath = path.join(shellPaths.shellRoot, relativePath);
  assertFile(filePath, `active shell implementation file ${relativePath}`);
  return readFileSync(filePath, 'utf8');
}

function assertShellTextIncludes(shellPaths, relativePath, expected, label) {
  const text = readShellText(shellPaths, relativePath);
  if (!text.includes(expected)) {
    throw new Error(`Active shell ${label} must include ${expected} in ${relativePath}`);
  }
  return text;
}

function assertShellTextExcludes(shellPaths, relativePath, forbidden, label) {
  const text = readShellText(shellPaths, relativePath);
  if (text.includes(forbidden)) {
    throw new Error(`Active shell ${label} must not include ${forbidden} in ${relativePath}`);
  }
  return text;
}

function assertShellFileHash(shellPaths, relativePath, expectedHash, label) {
  const filePath = path.join(shellPaths.shellRoot, relativePath);
  assertFile(filePath, label);
  const result = spawnSync('shasum', ['-a', '256', filePath], {
    encoding: 'utf8',
    maxBuffer: commandMaxBuffer,
  });
  if (result.error) {
    throw new Error(`Failed to hash ${label}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Failed to hash ${label}: ${result.stderr.trim()}`);
  }
  const actualHash = result.stdout.trim().split(/\s+/)[0];
  if (actualHash !== expectedHash) {
    throw new Error(`Active shell ${label} hash must be ${expectedHash}; got ${actualHash}`);
  }
}

function validateActiveShellImplementation(shellPaths) {
  if (shellPaths.contract.shell_contract?.implementation_validation === 'contract_paths_only') {
    return;
  }

  const i18nConfig = JSON.parse(
    readShellText(shellPaths, 'packages/desktop/src/common/config/i18n-config.json'),
  );
  const supportedLanguages = Array.isArray(i18nConfig.supportedLanguages)
    ? i18nConfig.supportedLanguages.filter((language) => typeof language === 'string')
    : [];
  const requiresLocale = (language) => supportedLanguages.includes(language);
  const appStateHook = assertShellTextIncludes(
    shellPaths,
    'packages/desktop/src/renderer/hooks/system/useOplAppState.ts',
    'ipcBridge.oplRuntime.getAppState.invoke({ profile })',
    'OPL App state hook',
  );
  for (const forbidden of ['shell.runOplCommand', 'application.systemInfo']) {
    if (appStateHook.includes(forbidden)) {
      throw new Error(`Active shell OPL App state hook must not use ${forbidden}`);
    }
  }

  const runtimeBridge = readShellText(shellPaths, 'packages/desktop/src/process/bridge/oplRuntimeBridge.ts');
  for (const expected of [
    "args: ['app', 'state', '--profile', profile, '--json']",
    "args: ['runtime', 'app-operator-drilldown', '--json']",
    "args: ['runtime', 'app-operator-drilldown', '--detail', 'full', '--json']",
    "['app', 'action', 'execute', '--action', assertActionId(request.actionId)]",
  ]) {
    if (!runtimeBridge.includes(expected)) {
      throw new Error(`Active shell runtime bridge must implement canonical surface: ${expected}`);
    }
  }

  const systemSettings = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/contents/SystemModalContent/index.tsx',
  );
  for (const expected of [
    "useOplAppState('fast')",
    "actionId: 'workspace_root_set'",
    'workspace_root_path',
    'selected_path',
    'logs_dir',
    'opl_flow_context',
    'opl_agent_codex_context',
    'settings.oplFlowContext',
  ]) {
    if (!systemSettings.includes(expected)) {
      throw new Error(`Active shell System settings must implement ${expected}`);
    }
  }
  for (const forbidden of [
    'application.updateSystemInfo.invoke',
    'shell.runOplCommand.invoke',
  ]) {
    if (systemSettings.includes(forbidden)) {
      throw new Error(`Active shell System settings must not use legacy OPL truth/action source ${forbidden}`);
    }
  }
  for (const expected of [
    'const appPaths = oplRecord(appState.paths)',
    'oplString(appPaths.workspace_root_path)',
    'oplPathString(appPaths.workspace_root)',
    'oplString(appPaths.logs_dir)',
  ]) {
    if (!systemSettings.includes(expected)) {
      throw new Error(`Active shell System settings must derive visible OPL paths from app_state.paths: ${expected}`);
    }
  }

  for (const [relativePath, forbidden] of [
    ['packages/desktop/src/renderer/services/i18n/locales/en-US/login.json', '"brand": "AionUi"'],
    ['packages/desktop/src/renderer/services/i18n/locales/zh-CN/login.json', '"brand": "AionUi"'],
    ['packages/desktop/src/common/api/ClientFactory.ts', "'X-Title': 'AionUi'"],
    ['packages/desktop/src/common/utils/appConfig.ts', "|| 'AionUi'"],
    ['packages/desktop/src/common/platform/index.ts', 'AionUi-Dev'],
    ...(requiresLocale('zh-TW')
      ? [['packages/desktop/src/renderer/services/i18n/locales/zh-TW/login.json', '"brand": "AionUi"']]
      : []),
  ]) {
    const text = readShellText(shellPaths, relativePath);
    if (text.includes(forbidden)) {
      throw new Error(`Active shell visible OPL branding must not expose ${forbidden} in ${relativePath}`);
    }
  }

  for (const [relativePath, expected] of [
    ['packages/desktop/src/renderer/services/i18n/locales/en-US/login.json', '"brand": "One Person Lab"'],
    ['packages/desktop/src/renderer/services/i18n/locales/zh-CN/login.json', '"brand": "One Person Lab"'],
    ['packages/desktop/src/common/api/ClientFactory.ts', "'X-Title': 'One Person Lab App'"],
    ['packages/desktop/src/common/utils/appConfig.ts', "|| 'One Person Lab App'"],
    ['packages/desktop/src/common/platform/index.ts', 'OnePersonLab-Dev'],
    ...(requiresLocale('zh-TW')
      ? [['packages/desktop/src/renderer/services/i18n/locales/zh-TW/login.json', '"brand": "One Person Lab"']]
      : []),
  ]) {
    const text = readShellText(shellPaths, relativePath);
    if (!text.includes(expected)) {
      throw new Error(`Active shell visible OPL branding must include ${expected} in ${relativePath}`);
    }
  }

  const zhCnFirstRun = readShellText(shellPaths, 'packages/desktop/src/renderer/services/i18n/locales/zh-CN/settings.json');
  for (const [locale, text] of [
    ['zh-CN', zhCnFirstRun],
    ...(requiresLocale('zh-TW')
      ? [
          [
            'zh-TW',
            readShellText(shellPaths, 'packages/desktop/src/renderer/services/i18n/locales/zh-TW/settings.json'),
          ],
        ]
      : []),
  ]) {
    for (const expected of ['"firstRun"', 'One Person Lab', 'Codex']) {
      if (!text.includes(expected)) {
        throw new Error(`Active shell ${locale} first-run locale must include ${expected}`);
      }
    }
    const settingsLocale = JSON.parse(text);
    const firstRunLocaleText = JSON.stringify(settingsLocale.firstRun ?? {});
    const firstLaunchLocaleText = JSON.stringify(settingsLocale.oplFirstLaunch ?? {});
    const firstRunSetupText = `${firstRunLocaleText}\n${firstLaunchLocaleText}`;
    for (const forbidden of [
      '"title": "Prepare One Person Lab"',
      '"wizardTitle": "Prepare One Person Lab"',
      'Checking the essentials',
      'Ready to start',
      'Codex API 配置',
      'Codex API Key',
      'Codex API Configuration',
      'Needs setup',
    ]) {
      if (firstRunSetupText.includes(forbidden)) {
        throw new Error(`Active shell ${locale} first-run locale must not expose English fallback ${forbidden}`);
      }
    }
  }

  const zhCnUpdate = readShellText(shellPaths, 'packages/desktop/src/renderer/services/i18n/locales/zh-CN/update.json');
  for (const [locale, text] of [
    ['zh-CN', zhCnUpdate],
    ...(requiresLocale('zh-TW')
      ? [
          [
            'zh-TW',
            readShellText(shellPaths, 'packages/desktop/src/renderer/services/i18n/locales/zh-TW/update.json'),
          ],
        ]
      : []),
  ]) {
    if (!text.includes('GitHub API')) {
      throw new Error(`Active shell ${locale} update locale must keep GitHub API error context localized.`);
    }
    for (const forbidden of [
      'GitHub API request failed',
      'GitHub API response was not a release list',
      'Update check returned no result',
    ]) {
      if (text.includes(forbidden)) {
        throw new Error(`Active shell ${locale} update locale must not expose English update fallback ${forbidden}`);
      }
    }
  }

  const runtimeSettings = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/settings/RuntimeSettings/index.tsx');
  for (const expected of [
    "ipcBridge.oplRuntime.getAppState.invoke({ profile: 'fast' })",
    "ipcBridge.oplRuntime.getAppState.invoke({ profile: 'full' })",
    "ipcBridge.oplRuntime.getDrilldown.invoke({ detail: 'full' })",
    'normalizeRuntimeProjection',
    'payloadRefsOnlyJson',
  ]) {
    if (!runtimeSettings.includes(expected)) {
      throw new Error(`Active shell Runtime settings must implement ${expected}`);
    }
  }
  if (/med[-_ ]?deep[-_ ]?scientist|module_id['"]?\s*:\s*['"]mds['"]/i.test(runtimeSettings)) {
    throw new Error('Active shell Runtime settings must not default-display Med Deep Scientist/MDS.');
  }

  const trayStartup = readShellText(shellPaths, 'packages/desktop/src/process/startup/trayStartup.ts');
  for (const expected of [
    'export async function initializeTrayForDesktopMode',
    'deps.createOrUpdateTray()',
    'deps.destroyTray()',
    'deps.setCloseToTrayEnabled(false)',
  ]) {
    if (!trayStartup.includes(expected)) {
      throw new Error(`Active shell desktop tray startup must implement App-owned tray policy: ${expected}`);
    }
  }
  if (trayStartup.includes('if (deps.getCloseToTrayEnabled())') || trayStartup.includes('if (getCloseToTrayEnabled())')) {
    throw new Error('Active shell desktop tray visibility must not be gated on close-to-tray setting.');
  }

  const desktopMain = readShellText(shellPaths, 'packages/desktop/src/index.ts');
  for (const expected of [
    'initializeTrayForDesktopMode',
    'readCloseToTray: readCloseToTraySetting',
    'createOrUpdateTray',
    'destroyTray',
  ]) {
    if (!desktopMain.includes(expected)) {
      throw new Error(`Active shell desktop startup must wire App-owned tray policy: ${expected}`);
    }
  }
  const closeToTraySetting = readShellText(shellPaths, 'packages/desktop/src/process/utils/closeToTraySetting.ts');
  for (const expected of [
    "const CLOSE_TO_TRAY_CONFIG_KEY = 'system.closeToTray'",
    'await ProcessConfig.get(CLOSE_TO_TRAY_CONFIG_KEY)',
    'await ProcessConfig.set(CLOSE_TO_TRAY_CONFIG_KEY, enabled)',
  ]) {
    if (!closeToTraySetting.includes(expected)) {
      throw new Error(`Active shell close-to-tray settings bridge must preserve App-owned tray preference key: ${expected}`);
    }
  }

  const settingsNav = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/settings/sections/settingsNav.tsx');
  for (const expected of [
    'getOplGuiSettingsVisibleTabs',
    'getOplGuiLegacySettingsRouteRedirects',
    'SETTINGS_DEFAULT_ROUTE = \'/settings/general\'',
    "if (legacyId === 'skills-hub') return '/settings/capabilities?tab=skills'",
    "if (legacyId === 'tools') return '/settings/capabilities?tab=tools'",
    'LEGACY_SETTINGS_ROUTE_REDIRECTS',
    'LEGACY_ANCHOR_REMAP',
  ]) {
    if (!settingsNav.includes(expected)) {
      throw new Error(`Active shell settings navigation must derive App-owned settings partition: ${expected}`);
    }
  }

  const settingsModal = readShellText(shellPaths, 'packages/desktop/src/renderer/components/settings/SettingsModal/index.tsx');
  for (const expected of [
    'getOplGuiSettingsVisibleTabs',
    'getOplGuiLegacySettingsRouteRedirects',
    "defaultTab = 'general'",
    '<OverviewSettings withWrapper={false} />',
    '<RuntimeSettings withWrapper={false} />',
    '<CapabilitiesSettingsContent activeTab={capabilitiesTab} onTabChange={setCapabilitiesTab} />',
    '<AccessSettingsContent />',
    '<DisplayModalContent />',
  ]) {
    if (!settingsModal.includes(expected)) {
      throw new Error(`Active shell settings modal must implement App-owned settings partition: ${expected}`);
    }
  }
  for (const forbidden of [
    'ModelModalContent',
    'AgentModalContent',
    "label: t('settings.model')",
    "label: t('settings.tools')",
    "label: t('settings.webui')",
  ]) {
    if (settingsModal.includes(forbidden)) {
      throw new Error(`Active shell settings modal must not expose legacy ordinary settings entry ${forbidden}`);
    }
  }

  const router = readShellText(shellPaths, 'packages/desktop/src/renderer/components/layout/Router.tsx');
  for (const [legacyId, targetId] of Object.entries(legacySettingsRouteRedirects)) {
    const expectedTarget =
      legacyId === 'skills-hub'
        ? '/settings/capabilities?tab=skills'
        : legacyId === 'tools'
          ? '/settings/capabilities?tab=tools'
          : `/settings/${targetId}`;
    const expectedRoute = `path='/settings/${legacyId}' element={<Navigate to='${expectedTarget}' replace />}`;
    if (!router.includes(expectedRoute)) {
      throw new Error(`Active shell router must redirect legacy settings route ${legacyId} to ${expectedTarget}`);
    }
  }

  const firstRunPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/index.tsx');
  for (const expected of [
    "ipcBridge.oplRuntime.getAppState.invoke({ profile: 'fast' })",
    'isCoreLaunchReadyFromAppState',
    "navigate('/guid',",
    'postInstallSelfCheck',
    'shouldOfferPostInstallSelfCheck',
    "document.title = 'One Person Lab App'",
    'formatFullReadinessProgressText',
    'formatMaintenanceProgressText',
    'findNextVisibleStep',
    "data-testid='opl-first-run-stage'",
    "data-testid='opl-first-run-core-progress'",
    "data-testid='opl-first-run-full-readiness-progress'",
    "data-testid='opl-first-run-maintenance-progress'",
    "data-testid='opl-first-run-next-step'",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun page must render shared initialize progress: ${expected}`);
    }
  }
  for (const expected of beginnerFirstRunTestIds.map((id) => `data-testid='${id}'`)) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun page must implement beginner first-run surface ${expected}`);
    }
  }
  if (!firstRunPage.includes("data-testid='opl-first-run-background-maintenance-secondary'")) {
    throw new Error('Active shell FirstRun page must keep background maintenance available in technical details');
  }
  const firstRunProgressStart = firstRunPage.indexOf("data-testid='opl-first-run-progress'");
  const technicalDetailsStart = firstRunPage.indexOf('<Collapse', firstRunProgressStart);
  const backgroundMaintenanceIndex = firstRunPage.indexOf("data-testid='opl-first-run-background-maintenance-secondary'");
  if (
    firstRunProgressStart < 0 ||
    technicalDetailsStart < 0 ||
    backgroundMaintenanceIndex < 0 ||
    (backgroundMaintenanceIndex > firstRunProgressStart && backgroundMaintenanceIndex < technicalDetailsStart)
  ) {
    throw new Error('Active shell FirstRun page must keep background maintenance out of the beginner primary area');
  }
  for (const expected of [
    'formatItemLabel',
    'formatItemSummary',
    'formatNextVisibleStep',
    'ITEM_LABEL_KEYS',
    'ITEM_SUMMARY_KEYS',
    'NEXT_STEP_KEYS',
    "t('settings.firstRun.nextSteps.generic')",
  ]) {
    if (!firstRunPage.includes(expected)) {
      throw new Error(`Active shell FirstRun page must map technical initialize text to App-owned beginner copy: ${expected}`);
    }
  }
  for (const forbidden of ['item?.label ?? label', 'item?.detail_summary ?? item?.next_visible_step']) {
    if (firstRunPage.includes(forbidden)) {
      throw new Error(`Active shell FirstRun beginner primary area must not directly render initialize fallback text: ${forbidden}`);
    }
  }

  const firstRunModel = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/FirstRun/initializeModel.ts');
  for (const expected of [
    'isCoreLaunchReadyFromAppState',
    'api_key_present',
    'workspace_root',
    'version_status',
    'ready_full_readiness_count',
    'total_full_readiness_count',
    'ready_optional_count',
    'total_optional_count',
    'next_visible_step',
  ]) {
    if (!firstRunModel.includes(expected)) {
      throw new Error(`Active shell FirstRun model must consume App state and initialize progress field ${expected}`);
    }
  }

  const guidPage = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/GuidPage.tsx');
  const guidInputCard = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx');
  for (const expected of [
    "document.title = 'One Person Lab App'",
    "t('conversation.welcome.placeholder')",
    'getOplModelStatusDisplayText',
    "data-testid='opl-home-model-status'",
    "t('guid.postInstallSelfCheck.prompt'",
    'POST_INSTALL_SELF_CHECK_PROMPT_DEFAULTS',
    'postInstallSelfCheckRequested',
    "navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null })",
    'AssistantSelectionArea',
    'GuidModelSelector',
    'MentionSelectorBadge',
    'selectedAgentLabelOverride',
    'onClear={() =>',
  ]) {
    if (!guidPage.includes(expected)) {
      throw new Error(`Active shell Guid home must implement ${expected}`);
    }
  }
  for (const [locale, expectedStrings] of Object.entries({
    'zh-CN': ['安装后智能自检', '程序化初始化已经完成', '不要覆盖用户已有的 AGENTS.md', '模块自动更新'],
    'en-US': ['Post-install intelligent self-check', 'Programmatic initialization has completed', "Do not overwrite the user's AGENTS.md", 'module auto-update'],
  })) {
    const localeText = readShellText(shellPaths, `packages/desktop/src/renderer/services/i18n/locales/${locale}/guid.json`);
    for (const expected of expectedStrings) {
      if (!localeText.includes(expected)) {
        throw new Error(`Active shell ${locale} Guid locale must include post-install self-check copy: ${expected}`);
      }
    }
  }
  for (const forbidden of [
    "useOplAppState('fast')",
    'normalizeGuidActivityCenter',
    'activityCenter={activityCenter}',
    "data-testid='opl-continue-context-entry'",
    'guid.activity.continuationPrompt',
    'guid.activity.continueAction',
    'guid.activity.attentionCount',
    'guid.activity.activeCount',
    'activityCenter.hasItems',
    'QuickActionButtons',
  ]) {
    if (guidPage.includes(forbidden) || guidInputCard.includes(forbidden)) {
      throw new Error(`Active shell ordinary Home must not render or query runtime activity: ${forbidden}`);
    }
  }
  for (const forbidden of ["data-testid='guid-activity-center'", 'guid.activity.needsAttention', 'guid.activity.recentProjects']) {
    if (guidInputCard.includes(forbidden)) {
      throw new Error(`Active shell ordinary Home must not render expanded activity groups near input: ${forbidden}`);
    }
  }
  for (const forbidden of ['artifact_body', 'memory_body', 'domain_artifact_body']) {
    if (guidInputCard.includes(forbidden)) {
      throw new Error(`Active shell Guid composer must not render domain artifact or memory bodies: ${forbidden}`);
    }
  }

  const guidAgentSelection = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/hooks/useGuidAgentSelection.ts',
  );
  for (const expected of [
    'getOplDefaultExecutorAgentKey',
    'resolveOplDefaultAgentKey(undefined)',
    "agent_type: assistant.preset_agent_type || getOplDefaultExecutorAgentKey()",
    'useState<string>(CODEX_MODE_NATIVE_FULL_ACCESS)',
  ]) {
    if (!guidAgentSelection.includes(expected)) {
      throw new Error(`Active shell Guid agent selection must implement App-owned default ${expected}`);
    }
  }

  const productProfile = readShellText(
    shellPaths,
    'packages/desktop/src/common/config/oplProductProfile/oplProductProfile.generated.json',
  );
  for (const expected of [
    '"default_model": "gpt-5.5"',
    '"default_reasoning_effort": "xhigh"',
    '"codex_cli_fixed_executor": true',
    '"home_executor_selector_visible": false',
    '"codex_model_selector_visible": true',
    '"codex_model_list_visible": true',
    '"codex_model_policy": "codex_cli_latest_strongest_model_selector_visible"',
    '"codex_model_auto_option_visible": true',
    '"codex_default_model": "gpt-5.5"',
    '"codex_home_model_status_label": "GPT-5.5（超高）"',
    '"codex_precise_model_display_policy": "friendly_default_model_and_reasoning_visible"',
    '"strategy": "codex_cli_auto_latest_available_frontier"',
    '"user_can_override_model": true',
    '"user_can_restore_auto": true',
    '"frontier_model_preference_order": ["gpt-5.5", "gpt-5.4", "gpt-5.3-codex", "gpt-5.2"]',
    '"id": "mas"',
    '"id": "mag"',
    '"id": "rca"',
    '"id": "oma"',
    '"assistant_skill_profiles"',
    '"required_skills"',
    '"skill_menu_policy": "assistant_scoped_required_checked_optional_visible"',
    '"default_packaged_codex_skill_ids"',
  ]) {
    if (!productProfile.includes(expected)) {
      throw new Error(`Active shell product profile must carry App Codex default ${expected}`);
    }
  }

  const codexModels = readShellText(shellPaths, 'packages/desktop/src/common/types/codex/codexModels.ts');
  for (const expected of [
    'getOplCodexFrontierModelPreferenceOrder',
    'DEFAULT_CODEX_MODELS',
    'availableModels.length > 0',
    'DEFAULT_CODEX_MODELS.map',
    'available_models: visibleModels',
  ]) {
    if (!codexModels.includes(expected)) {
      throw new Error(`Active shell Codex model policy must expose App-owned default options before ACP handshake: ${expected}`);
    }
  }

  const guidAssistants = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/utils/oplHomeAssistants.ts');
  for (const expected of [
    'getOplDefaultExecutorAgentKey',
    'getOplDefaultHomeAssistants',
    'getOplAssistantSkillProfile',
    'resolveOplHomeAssistants',
    'const DEFAULT_PRESET_AGENT_TYPE = getOplDefaultExecutorAgentKey()',
    'preset_agent_type: DEFAULT_PRESET_AGENT_TYPE',
    'enabled_skills',
    'custom_skill_names',
    'disabled_builtin_skills',
  ]) {
    if (!guidAssistants.includes(expected)) {
      throw new Error(`Active shell Guid assistants must consume App-owned assistant/default signal ${expected}`);
    }
  }
  if (/mds|Med Deep Scientist/.test(guidAssistants)) {
    throw new Error('Active shell Guid profile must not include MDS as a default home assistant.');
  }

  for (const expected of [
    'selectedAssistantRequiredSkills',
    'selectedAssistantSkillProfile',
    'effectiveGuidEnabledSkills',
    'mergeRequiredSkills',
    'buildAssistantScopedSkillMenuItems',
    'guidEnabledSkills: effectiveGuidEnabledSkills',
  ]) {
    if (!guidPage.includes(expected)) {
      throw new Error(`Active shell Guid page must enforce App assistant skill profile rule ${expected}`);
    }
  }

  const guidSkillMenu = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/utils/assistantSkillMenu.ts',
  );
  for (const expected of [
    'buildAssistantScopedSkillMenuItems',
    'mergeRequiredSkills',
    'required_skills',
    'locked: isRequired',
  ]) {
    if (!guidSkillMenu.includes(expected)) {
      throw new Error(`Active shell Guid skill menu must enforce App assistant skill profile rule ${expected}`);
    }
  }

  const guidActionRow = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx',
  );
  for (const expected of [
    'GuidSkillMenuItem',
    'isGuidSkillChecked',
    'skill.locked',
    'disabled={skill.locked}',
  ]) {
    if (!guidActionRow.includes(expected)) {
      throw new Error(`Active shell Guid action row must lock required assistant skills ${expected}`);
    }
  }

  const guidSend = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/guid/hooks/useGuidSend.ts');
  for (const expected of [
    'getOplBuiltinAssistantRouteReceiptPolicy',
    'buildOplAssistantRouteReceipt',
    'opl_assistant_route',
    'preset_enabled_skills',
  ]) {
    if (!guidSend.includes(expected)) {
      throw new Error(`Active shell Guid send must persist App assistant route/skill signal ${expected}`);
    }
  }

  const createConversationParams = readShellText(
    shellPaths,
    'packages/desktop/src/common/utils/buildAgentConversationParams.ts',
  );
  for (const expected of [
    'preset_enabled_skills',
  ]) {
    if (!createConversationParams.includes(expected)) {
      throw new Error(`Active shell create conversation must persist App assistant route/skill signal ${expected}`);
    }
  }

  const acpModelSelector = readShellText(shellPaths, 'packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx');
  for (const expected of [
    'useAcpModelInfo',
    'canSwitch',
    'if (!canSwitch)',
  ]) {
    if (!acpModelSelector.includes(expected)) {
      throw new Error(`Active shell ACP model selector must consume fixed Codex model guard ${expected}`);
    }
  }

  const acpModelInfoHook = readShellText(shellPaths, 'packages/desktop/src/renderer/hooks/agent/useAcpModelInfo.ts');
  for (const expected of [
    'isOplCodexCliFixedExecutor',
    'shouldShowOplCodexModelList',
    "backend === 'codex'",
    'shouldShowOplCodexModelList()',
    'canSwitch',
  ]) {
    if (!acpModelInfoHook.includes(expected)) {
      throw new Error(`Active shell ACP model hook must expose App-owned Codex model controls ${expected}`);
    }
  }

  const chatConversation = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx',
  );
  for (const expected of [
    'shouldShowOplConversationModelSelector',
    "extra.backend === 'codex'",
    'AcpModelSelector',
  ]) {
    if (!chatConversation.includes(expected)) {
      throw new Error(`Active shell ordinary Codex conversation must hide model selector ${expected}`);
    }
  }

  const acpSendBox = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx');
  for (const expected of [
    'isOplCodexCliFixedExecutor',
    'getOplModelStatusDisplayText',
    "data-testid='opl-conversation-model-status'",
    'shouldShowOplConversationPermissionModeSelector',
    "backend === 'codex'",
    'const showModeSelector',
    'showModeSelector ?',
    '<ThoughtDisplay running={isBusy}',
  ]) {
    if (!acpSendBox.includes(expected)) {
      throw new Error(`Active shell ordinary Codex conversation must hide permission selector ${expected}`);
    }
  }

  const thoughtDisplay = readShellText(shellPaths, 'packages/desktop/src/renderer/components/chat/ThoughtDisplay.tsx');
  for (const expected of ['formatElapsedTime', "t('conversation.chat.processing')", 'elapsedTime']) {
    if (!thoughtDisplay.includes(expected)) {
      throw new Error(`Active shell ThoughtDisplay must expose elapsed processing feedback ${expected}`);
    }
  }

  const skillsHubSettings = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/settings/SkillsHubSettings.tsx');
  for (const expected of [
    'getOplDefaultPackagedCodexSkills',
    'getOplPackagedCodexSkills',
    'appVisibleSkills',
    "skills.filter((skill) => skill.source !== 'builtin' || appVisibleSkills.has(skill.name))",
    'appPackagedSkills',
    'autoSkills.filter((skill) => appPackagedSkills.has(skill.name))',
  ]) {
    if (!skillsHubSettings.includes(expected)) {
      throw new Error(`Active shell SkillsHubSettings must filter upstream builtin skills through App packaged policy ${expected}`);
    }
  }

  const presets = readShellText(shellPaths, 'packages/desktop/src/renderer/pages/settings/DisplaySettings/presets.ts');
  if (!presets.includes("export const CODEX_THEME_ID = 'codex'")) {
    throw new Error('Active shell theme presets must expose CODEX_THEME_ID=codex.');
  }
  if (!presets.includes("opl-codex.css?raw")) {
    throw new Error('Active shell theme presets must load the current App-owned Codex CSS payload.');
  }
  const codexCss = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/DisplaySettings/presets/opl-codex.css',
  );
  for (const expected of ['--opl-codex-sidebar-bg', '--opl-codex-surface', '--opl-codex-focus-ring']) {
    if (!codexCss.includes(expected)) {
      throw new Error(`Active shell OPL Codex CSS must include ${expected}`);
    }
  }
  for (const forbidden of ['Retroma', 'aurora', 'Palatino']) {
    if (codexCss.includes(forbidden)) {
      throw new Error(`Active shell OPL Codex CSS must not include legacy theme marker ${forbidden}`);
    }
  }

  const about = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/contents/AboutModalContent.tsx',
  );
  for (const expected of ['useOplAppState', 'guiVersion', 'frameworkRevision', 'includeNightlyUpdates']) {
    if (!about.includes(expected)) {
      throw new Error(`Active shell About page must implement ${expected}`);
    }
  }
  if (/AionUI version|Aion UI version/.test(about)) {
    throw new Error('Active shell About page must not present AionUI as the App version.');
  }

  const indexHtml = readShellText(shellPaths, 'packages/desktop/src/renderer/index.html');
  for (const expected of [
    '<meta name="application-name" content="One Person Lab App" />',
    '<meta name="apple-mobile-web-app-title" content="One Person Lab App" />',
    '<title>One Person Lab App</title>',
  ]) {
    if (!indexHtml.includes(expected)) {
      throw new Error(`Active shell HTML branding must include ${expected}`);
    }
  }
  for (const forbidden of ['content="AionUi"', '<title>AionUi</title>']) {
    if (indexHtml.includes(forbidden)) {
      throw new Error(`Active shell HTML branding must not expose ${forbidden}`);
    }
  }

  const webManifest = readShellText(shellPaths, 'public/manifest.webmanifest');
  for (const expected of [
    '"name": "One Person Lab App"',
    '"short_name": "OPL"',
    '"description": "One Person Lab App for Codex-first OPL workflows."',
  ]) {
    if (!webManifest.includes(expected)) {
      throw new Error(`Active shell web manifest branding must include ${expected}`);
    }
  }
  if (webManifest.includes('"name": "AionUi"') || webManifest.includes('"short_name": "AionUi"')) {
    throw new Error('Active shell web manifest must not expose upstream AionUi branding.');
  }

  for (const relativePath of ['resources/app.png', 'resources/icon.png', 'resources/app_dev.png']) {
    assertShellFileHash(
      shellPaths,
      relativePath,
      '540a7a393e26ab84c9ab9a4ccae121bc41d8963b19febcef5cf7acc685d5786c',
      `${relativePath} OPL icon`,
    );
  }
  assertShellFileHash(
    shellPaths,
    'resources/app.icns',
    'cafe7b133ef70027332b97d5a25ddf1223e870a137814cb86ec3f0e51ca73216',
    'resources/app.icns OPL icon',
  );
  assertShellFileHash(
    shellPaths,
    'resources/app.ico',
    'ddf1071a56ff912b39c77543b158592b8b87f72382a11e1779e6b69b608e0ef7',
    'resources/app.ico OPL icon',
  );
  for (const [relativePath, expectedHash] of [
    ['public/pwa/icon-180.png', '028e831b65057e3f1cc906f75e37a80de75e050cc8842561d05ee3c015899a90'],
    ['public/pwa/icon-192.png', 'c873622198071e0f04dae6d279d3e861b80a87c6e4a12f4fc68a8bf4e868adaf'],
    ['public/pwa/icon-512.png', 'fb8cddda7b12e53ced77571c5576bd4d68463da673b0316b1f0e7ce481a5d559'],
  ]) {
    assertShellFileHash(shellPaths, relativePath, expectedHash, `${relativePath} OPL PWA icon`);
  }
}

function assertCommandSurface(value, expected, label) {
  if (value !== expected) {
    throw new Error(`${label} must be ${expected}`);
  }
}

function lookupPath(value, dotPath) {
  return dotPath.split('.').reduce((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    return current[key];
  }, value);
}

function resolveLiveGateEnabled(gate) {
  const envName = gate?.enable_env;
  return typeof envName === 'string' && process.env[envName]?.trim() === '1';
}

function runLiveJsonCommand(oplRoot, args, label, maxStdoutBytes = commandMaxBuffer) {
  const result = spawnSync('./bin/opl', args, {
    cwd: oplRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: Math.max(commandMaxBuffer, maxStdoutBytes),
  });
  if (result.error) {
    throw new Error(`Live OPL ${label} failed to launch: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error([
      `Live OPL ${label} failed: ./bin/opl ${args.join(' ')}`,
      result.stderr.trim(),
      result.stdout.trim(),
    ].filter(Boolean).join('\n'));
  }
  const stdoutBytes = Buffer.byteLength(result.stdout, 'utf8');
  if (stdoutBytes > maxStdoutBytes) {
    throw new Error(`Live OPL ${label} exceeded ${maxStdoutBytes} bytes: ${stdoutBytes}`);
  }
  try {
    return {
      payload: JSON.parse(result.stdout),
      stdoutBytes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Live OPL ${label} returned invalid JSON: ${message}`);
  }
}

function validateLiveConformanceContract(gate) {
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)) {
    throw new Error('Runtime bridge must declare live_conformance_gate');
  }
  if (gate.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected live conformance owner: ${gate.owner}`);
  }
  if (gate.producer_owner !== 'one-person-lab') {
    throw new Error(`Unexpected live conformance producer owner: ${gate.producer_owner}`);
  }
  if (gate.mode !== 'explicit_env_opt_in') {
    throw new Error(`Unexpected live conformance mode: ${gate.mode}`);
  }
  if (gate.default_enforcement !== 'disabled') {
    throw new Error(`Unexpected live conformance default enforcement: ${gate.default_enforcement}`);
  }
  for (const [field, expected] of Object.entries({
    enable_env: 'OPL_APP_LIVE_CONFORMANCE',
    opl_root_env: 'OPL_APP_LIVE_OPL_ROOT',
    action_fixture_env: 'OPL_APP_LIVE_ACTION_FIXTURE',
    opl_bin: './bin/opl',
    fast_state_command: './bin/opl app state --profile fast --json',
    full_state_command: './bin/opl app state --profile full --json',
    action_dry_run_command: './bin/opl app action execute --action <fixture> --dry-run --json',
    required_state_schema: 'opl_app_state.v1',
    golden_fast_state_fixture: 'contracts/fixtures/opl-app-state-fast.fixture.json',
    app_role: 'protocol_conformance_consumer',
  })) {
    if (gate[field] !== expected) {
      throw new Error(`Runtime bridge live_conformance_gate.${field} must be ${expected}`);
    }
  }
  if (gate.fast_state_max_bytes !== 500000) {
    throw new Error('Runtime bridge live_conformance_gate.fast_state_max_bytes must be 500000');
  }
  for (const schemaPath of ['app_state.schema_version', 'app_state.surface_kind', 'app_state.schema', 'app_state.surface', 'schema', 'surface']) {
    if (!gate.state_schema_paths?.includes(schemaPath)) {
      throw new Error(`Runtime bridge live conformance schema paths must include ${schemaPath}`);
    }
  }
  for (const assertion of [
    'fast App state command returns JSON',
    'full App state command returns JSON',
    'dry-run App action command returns JSON',
    'fast App state output stays below 500KB',
    'fast App state declares opl_app_state.v1 schema or surface',
  ]) {
    if (!gate.assertions?.includes(assertion)) {
      throw new Error(`Runtime bridge live conformance assertions must include ${assertion}`);
    }
  }
  for (const forbidden of forbiddenAuthorityOwners) {
    if (!gate.forbidden_authority?.includes(forbidden)) {
      throw new Error(`Runtime bridge live conformance must exclude ${forbidden}`);
    }
  }
  validateGoldenAppStateFixture(gate);
}

function validateGoldenAppStateFixture(gate) {
  const fixturePath = path.join(root, gate.golden_fast_state_fixture);
  assertFile(fixturePath, 'OPL App state golden fixture');
  const fixtureText = readFileSync(fixturePath, 'utf8');
  const fixture = JSON.parse(fixtureText);
  if (Buffer.byteLength(fixtureText, 'utf8') >= gate.fast_state_max_bytes) {
    throw new Error(`OPL App state golden fixture must stay below ${gate.fast_state_max_bytes} bytes.`);
  }
  if (lookupPath(fixture, 'app_state.schema_version') !== gate.required_state_schema) {
    throw new Error('OPL App state golden fixture must declare app_state.schema_version.');
  }
  if (lookupPath(fixture, 'app_state.surface_kind') !== gate.required_state_schema) {
    throw new Error('OPL App state golden fixture must declare app_state.surface_kind.');
  }
  if (lookupPath(fixture, 'app_state.meta.profile') !== 'fast') {
    throw new Error('OPL App state golden fixture must use the fast profile.');
  }
  if (lookupPath(fixture, 'app_state.operator.workbench.view_model_schema') !== 'opl_app_operator_workbench.v1') {
    throw new Error('OPL App state golden fixture must include typed operator workbench.');
  }
  if (lookupPath(fixture, 'app_state.operator.workbench.performance_policy.fast_json_max_bytes') !== gate.fast_state_max_bytes) {
    throw new Error('OPL App state golden fixture must carry the App fast JSON max budget.');
  }
  if (lookupPath(fixture, 'app_state.operator.workbench.performance_policy.shell_must_not_derive_layout_from_raw_runtime_projection') !== true) {
    throw new Error('OPL App state golden fixture must forbid shell-side layout derivation from raw runtime projection.');
  }
  const taskDrilldowns = lookupPath(fixture, 'app_state.operator.workbench.task_drilldowns') ?? [];
  const platformRepairExample = taskDrilldowns.find(
    (task) => task?.progress_delta_classification === 'platform_repair',
  );
  if (!platformRepairExample) {
    throw new Error('OPL App state golden fixture must include a platform_repair task example.');
  }
  if (
    platformRepairExample.deliverable_progress_delta?.count !== 0
    || !(platformRepairExample.platform_repair_delta?.count > 0)
    || platformRepairExample.user_facing_progress_claim_allowed !== false
    || platformRepairExample.progress_display_bucket !== 'platform_repair'
  ) {
    throw new Error('OPL App state platform repair example must not claim deliverable progress.');
  }
  if (/deliverable|paper|manuscript|submission/i.test(platformRepairExample.progress_display_label ?? '')) {
    throw new Error('OPL App state platform repair label must not present repair as deliverable progress.');
  }
  const activeProjectSummaryCard = (lookupPath(fixture, 'app_state.operator.workbench.summary_cards') ?? []).find(
    (card) => card?.card_id === 'active_projects',
  );
  if (!activeProjectSummaryCard) {
    throw new Error('OPL App state golden fixture must include an active_projects summary card.');
  }
  const activeProjects = lookupPath(fixture, 'app_state.operator.workbench.activity_center.active_projects');
  if (!Array.isArray(activeProjects) || activeProjects.length === 0) {
    throw new Error('OPL App state golden fixture must include activity_center.active_projects.');
  }
  const visualActiveProjectRefs = lookupPath(fixture, 'app_state.operator.visual_ref_groups.active_project_refs');
  if (!Array.isArray(visualActiveProjectRefs) || visualActiveProjectRefs.length === 0) {
    throw new Error('OPL App state golden fixture must include visual_ref_groups.active_project_refs.');
  }
  const queuedOrEscalatedProject = activeProjects.find((project) => ['queued', 'escalated'].includes(project?.status));
  if (!queuedOrEscalatedProject) {
    throw new Error('OPL App state golden fixture must include a queued or escalated active project line.');
  }
  for (const field of ['task_id', 'title', 'state', 'status', 'study_id', 'active_run_id', 'next_visible_step']) {
    if (!(field in queuedOrEscalatedProject)) {
      throw new Error(`OPL App state active project line must preserve ${field}.`);
    }
  }
  if (queuedOrEscalatedProject.active_worker_run === true || queuedOrEscalatedProject.provider_execution_running === true) {
    throw new Error('OPL App state active project line must not claim an active worker run.');
  }
  for (const [pathName, label] of Object.entries({
    'app_state.operator.workbench.summary_cards': 'summary cards',
    'app_state.operator.workbench.sections': 'sections',
    'app_state.operator.workbench.activity_center.active_projects': 'active project lines',
    'app_state.operator.workbench.action_queue.items': 'action queue items',
    'app_state.operator.workbench.domain_lane_map.lanes': 'domain lanes',
    'app_state.operator.workbench.task_drilldowns': 'task drilldowns',
    'app_state.operator.workbench.safe_action_routes': 'safe action routes',
    'app_state.operator.workbench.lazy_refs': 'lazy refs',
    'app_state.operator.visual_ref_groups.active_project_refs': 'visual active project refs',
  })) {
    const value = lookupPath(fixture, pathName);
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`OPL App state golden fixture must include ${label}.`);
    }
  }
}

function validateLiveOplConformance(runtimeBridge) {
  const gate = runtimeBridge.live_conformance_gate;
  validateLiveConformanceContract(gate);
  if (!resolveLiveGateEnabled(gate)) {
    return;
  }

  const oplRoot = process.env[gate.opl_root_env]?.trim();
  if (!oplRoot) {
    throw new Error(`Set ${gate.opl_root_env} to the local OPL Framework root when ${gate.enable_env}=1.`);
  }
  const resolvedOplRoot = path.resolve(oplRoot);
  assertFile(path.join(resolvedOplRoot, 'bin', 'opl'), 'live OPL ./bin/opl');

  const actionFixture = process.env[gate.action_fixture_env]?.trim();
  if (!actionFixture) {
    throw new Error(`Set ${gate.action_fixture_env} to a safe OPL App action id when ${gate.enable_env}=1.`);
  }

  const fast = runLiveJsonCommand(
    resolvedOplRoot,
    ['app', 'state', '--profile', 'fast', '--json'],
    'fast App state',
    gate.fast_state_max_bytes,
  );
  const full = runLiveJsonCommand(resolvedOplRoot, ['app', 'state', '--profile', 'full', '--json'], 'full App state');
  const action = runLiveJsonCommand(
    resolvedOplRoot,
    ['app', 'action', 'execute', '--action', actionFixture, '--dry-run', '--json'],
    'App action dry-run',
  );

  if (fast.stdoutBytes >= gate.fast_state_max_bytes) {
    throw new Error(`Live OPL fast App state must stay below ${gate.fast_state_max_bytes} bytes.`);
  }
  const declaredSchema = gate.state_schema_paths
    .map((schemaPath) => lookupPath(fast.payload, schemaPath))
    .find((value) => typeof value === 'string' && value.trim());
  if (declaredSchema !== gate.required_state_schema) {
    throw new Error(`Live OPL fast App state must declare ${gate.required_state_schema} schema/surface.`);
  }
  if (lookupPath(fast.payload, 'app_state.meta.profile') !== 'fast') {
    throw new Error('Live OPL fast App state must declare app_state.meta.profile=fast.');
  }
  if (lookupPath(full.payload, 'app_state.meta.profile') !== 'full') {
    throw new Error('Live OPL full App state must declare app_state.meta.profile=full.');
  }
  if (lookupPath(action.payload, 'app_action_execution.surface_kind') !== 'opl_app_action_execution.v1') {
    throw new Error('Live OPL App action dry-run must declare opl_app_action_execution.v1.');
  }
  if (lookupPath(action.payload, 'app_action_execution.dry_run') !== true) {
    throw new Error('Live OPL App action dry-run must return dry_run=true.');
  }

  console.log('Live OPL App state/action conformance passed.');
}

function validateRuntimeBridgeContract(runtimeBridge, contract) {
  if (runtimeBridge.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected runtime bridge owner: ${runtimeBridge.owner}`);
  }
  if (runtimeBridge.purpose !== 'runtime_bridge_abstraction') {
    throw new Error(`Unexpected runtime bridge purpose: ${runtimeBridge.purpose}`);
  }
  if (runtimeBridge.state !== 'active') {
    throw new Error(`Unexpected runtime bridge state: ${runtimeBridge.state}`);
  }
  if (isDefaultReleaseAdapter(contract) && runtimeBridge.active_adapter !== contract.active_shell) {
    throw new Error(`Runtime bridge active adapter must match active shell: ${runtimeBridge.active_adapter}`);
  }
  if (runtimeBridge.adapter_role !== 'replaceable_gui_shell_adapter') {
    throw new Error(`Unexpected runtime bridge adapter role: ${runtimeBridge.adapter_role}`);
  }
  if (runtimeBridge.protocol_owner !== 'one-person-lab') {
    throw new Error(`Unexpected runtime bridge protocol owner: ${runtimeBridge.protocol_owner}`);
  }
  if (runtimeBridge.ui_contract_owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected runtime bridge UI contract owner: ${runtimeBridge.ui_contract_owner}`);
  }
  if (isDefaultReleaseAdapter(contract) && runtimeBridge.default_adapter_repo !== contract.shell_source?.owner_repo) {
    throw new Error(`Runtime bridge adapter repo must match active shell source: ${runtimeBridge.default_adapter_repo}`);
  }
  if (isDefaultReleaseAdapter(contract) && runtimeBridge.default_adapter_path !== contract.shell_root) {
    throw new Error(`Runtime bridge adapter path must match active shell root: ${runtimeBridge.default_adapter_path}`);
  }
  for (const [field, expected] of Object.entries({
    summary_command: 'opl app state --profile fast --json',
    refresh_command: 'opl app state --profile fast --json',
    full_state_command: 'opl app state --profile full --json',
    full_state_policy: 'diagnostic_or_release_evidence_only',
    full_detail_command: 'opl runtime app-operator-drilldown --detail full --json',
    action_command: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
    'projection_sources.primary': 'app_state.operator user task status projection',
    'projection_sources.provider': 'runtime_tray_snapshot.app_operator_drilldown.current_control_state.states.provider_run',
    'projection_sources.actions': 'app_state.actions',
    'projection_sources.full_detail': 'runtime_tray_snapshot.app_operator_drilldown',
    'projection_sources.policy': 'user_task_status_from_app_state_project_refs_provider_projection_diagnostic_only',
  })) {
    const actual = field.split('.').reduce((value, key) => value?.[key], runtimeBridge);
    if (actual !== expected) {
      throw new Error(`Runtime bridge ${field} must be ${expected}`);
    }
  }
  validateUserTaskStatusProjectionContract(
    runtimeBridge.user_task_status_projection,
    'Runtime bridge user task status projection',
  );
  if (runtimeBridge.user_task_status_projection?.app_role !== 'display_only_user_task_status_consumer') {
    throw new Error('Runtime bridge user task status projection must be a display-only consumer');
  }
  const commandResolutionPolicy = runtimeBridge.command_resolution_policy;
  if (commandResolutionPolicy?.owner !== 'one-person-lab-app') {
    throw new Error('Runtime bridge command resolution policy must be App-owned');
  }
  if (commandResolutionPolicy?.adapter_responsibility !== 'resolve_healthy_opl_cli_before_running_declared_surfaces') {
    throw new Error('Runtime bridge command resolution policy must require healthy OPL CLI resolution');
  }
  if (commandResolutionPolicy?.managed_opl_priority !== 'prefer_only_when_shim_targets_existing_cli_payload') {
    throw new Error('Runtime bridge must prefer managed OPL only when its shim targets an existing CLI payload');
  }
  if (commandResolutionPolicy?.broken_managed_shim_policy !== 'skip_and_fall_through_to_system_opl') {
    throw new Error('Runtime bridge must skip broken managed OPL shims and fall through to system OPL');
  }
  for (const fallbackPath of ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']) {
    if (!commandResolutionPolicy?.system_opl_fallback_paths?.includes(fallbackPath)) {
      throw new Error(`Runtime bridge command resolution policy must include fallback path ${fallbackPath}`);
    }
  }
  for (const forbidden of [
    'let stale managed Node opl shims shadow a healthy system opl',
    'rewrite App runtime truth from shell-private state',
    'treat missing managed bootstrap artifacts as first-run UI truth',
  ]) {
    if (!commandResolutionPolicy?.must_not?.includes(forbidden)) {
      throw new Error(`Runtime bridge command resolution policy must forbid: ${forbidden}`);
    }
  }
  validateProjectProgressDisplayContract(runtimeBridge.project_progress_projection, 'Runtime bridge project progress projection');
  for (const [field, expected] of Object.entries({
    shell_adapter_can_own_runtime_truth: false,
    app_can_own_runtime_truth: false,
    app_can_write_domain_truth: false,
    app_can_read_artifact_body: false,
    app_can_read_memory_body: false,
    app_can_authorize_quality_verdict: false,
    app_can_authorize_export_verdict: false,
    provider_completion_is_domain_ready: false,
  })) {
    if (runtimeBridge.authority_boundary?.[field] !== expected) {
      throw new Error(`Runtime bridge authority_boundary.${field} must be ${expected}`);
    }
  }
  for (const [field, expected] of Object.entries({
    runtime_protocol_stable_across_shell_replacement: true,
    shell_adapter_must_call_declared_opl_cli_surfaces: true,
    new_shell_adapter_must_pass_active_shell_validation: true,
    direct_domain_repo_reads_are_forbidden: true,
    direct_runtime_state_file_reads_are_forbidden: true,
  })) {
    if (runtimeBridge.replacement_policy?.[field] !== expected) {
      throw new Error(`Runtime bridge replacement_policy.${field} must be ${expected}`);
    }
  }
  for (const forbidden of [
    'direct_domain_repo_reads',
    'direct_runtime_state_file_reads',
    'direct_opl_internal_state_file_reads',
    'domain_artifact_body_reads',
    'domain_memory_body_reads',
    'shell_private_runtime_status',
  ]) {
    if (!runtimeBridge.forbidden_truth_sources?.includes(forbidden)) {
      throw new Error(`Runtime bridge must forbid ${forbidden}`);
    }
  }
  validateLiveConformanceContract(runtimeBridge.live_conformance_gate);
}

function validateInstallExposurePolicy(policy) {
  if (policy.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected install exposure policy owner: ${policy.owner}`);
  }
  if (policy.purpose !== 'app_install_exposure_policy') {
    throw new Error(`Unexpected install exposure policy purpose: ${policy.purpose}`);
  }
  if (policy.state !== 'active') {
    throw new Error(`Unexpected install exposure policy state: ${policy.state}`);
  }
  if (policy.producer_owner !== 'one-person-lab') {
    throw new Error(`Unexpected install exposure producer owner: ${policy.producer_owner}`);
  }
  if (policy.product_authority?.source_of_truth !== 'one-person-lab-app') {
    throw new Error('Install exposure policy source of truth must be one-person-lab-app');
  }
  for (const forbidden of forbiddenAuthorityOwners) {
    if (!policy.product_authority?.forbidden_authority?.includes(forbidden)) {
      throw new Error(`Install exposure policy must exclude ${forbidden}`);
    }
  }

  const canonical = policy.canonical_metadata_sources;
  if (canonical?.owner !== 'one-person-lab') {
    throw new Error('Install exposure canonical metadata owner must be one-person-lab');
  }
  if (canonical.domain_owner !== 'foundry_agent_repositories') {
    throw new Error('Install exposure canonical metadata domain owner must be foundry_agent_repositories');
  }
  for (const source of ['family_action_catalog', 'family_stage_control_plane', 'family-product-entry-manifest-v2']) {
    if (!canonical.sources?.includes(source)) {
      throw new Error(`Install exposure canonical metadata sources must include ${source}`);
    }
  }
  for (const surface of ['cli', 'mcp', 'skill', 'product_entry', 'product_status', 'product_session', 'domain_action_adapter', 'workbench']) {
    if (!canonical.derived_surfaces?.includes(surface)) {
      throw new Error(`Install exposure canonical metadata derived surfaces must include ${surface}`);
    }
  }

  const abi = policy.public_abi;
  for (const [field, expected] of Object.entries({
    primary_semantic_entry: 'skill',
    skill_role: 'public_codex_semantic_entry_and_prompt_contract',
    plugin_role: 'codex_app_distribution_and_capability_bundle',
    command_contract_role: 'machine_readable_action_and_stage_contract_under_the_skill',
    product_entry_role: 'domain_owned_product_entry_manifest_and_session_surface',
  })) {
    if (abi?.[field] !== expected) {
      throw new Error(`Install exposure public_abi.${field} must be ${expected}`);
    }
  }
  for (const [field, expected] of Object.entries({
    direct_skill_compatibility_required: true,
    plugin_may_package_skill: true,
    plugin_must_not_create_second_semantics: true,
    app_must_not_require_plugin_for_cli_semantics: true,
    app_must_not_mirror_plugin_skill_as_duplicate_bare_skill: true,
  })) {
    if (abi?.[field] !== expected) {
      throw new Error(`Install exposure public_abi.${field} must be ${expected}`);
    }
  }

  const exposureClassById = new Map((policy.exposure_classes ?? []).map((entry) => [entry.id, entry]));
  const domainPluginClass = exposureClassById.get('family_domain_plugin_surfaces');
  if (domainPluginClass?.sync_target !== 'codex_plugin_registry') {
    throw new Error('Install exposure domain plugin class must sync to codex_plugin_registry');
  }
  assertIncludesAll(
    domainPluginClass?.members,
    ['mas', 'mag', 'rca'],
    'Install exposure domain plugin members',
  );
  for (const forbiddenMirror of ['~/.codex/skills/mas', '~/.codex/skills/mag', '~/.codex/skills/rca']) {
    if (!domainPluginClass.must_not_sync_to?.includes(forbiddenMirror)) {
      throw new Error(`Install exposure domain plugin class must forbid ${forbiddenMirror}`);
    }
  }
  const generatedClass = exposureClassById.get('opl_generated_skill_surfaces');
  if (generatedClass?.sync_target !== 'opl_generated_codex_surface' || !generatedClass?.members?.includes('opl-meta-agent')) {
    throw new Error('Install exposure generated class must route OPL Meta Agent through OPL-generated Codex surface');
  }
  const companionClass = exposureClassById.get('companion_skill_sync');
  if (companionClass?.sync_target !== 'codex_user_skill_discovery_path') {
    throw new Error('Install exposure companion skill class must sync to Codex user skill discovery path');
  }
  assertIncludesAll(
    companionClass?.members,
    defaultCompanionSkillSyncIds,
    'Install exposure companion skill members',
  );
  for (const forbiddenDomain of ['mas', 'mag', 'rca']) {
    if (companionClass.members?.includes(forbiddenDomain)) {
      throw new Error(`Install exposure companion skill class must not include domain plugin ${forbiddenDomain}`);
    }
  }
  const packagedRuntimeClass = exposureClassById.get('packaged_full_runtime_payloads');
  if (packagedRuntimeClass?.owner !== 'one-person-lab-app') {
    throw new Error('Install exposure packaged Full runtime payloads must stay App-owned');
  }
  if (!packagedRuntimeClass?.must_not_sync_to?.includes('implicit_user_codex_skill_install_without_managed_sync')) {
    throw new Error('Install exposure packaged Full runtime payloads must not imply user skill install without managed sync');
  }

  const exposureById = new Map((policy.domain_exposure ?? []).map((entry) => [entry.domain_id, entry]));
  for (const expected of domainExposureEntries) {
    const entry = exposureById.get(expected.domain_id);
    if (!entry) {
      throw new Error(`Install exposure policy missing domain ${expected.domain_id}`);
    }
    for (const [field, expectedValue] of Object.entries(expected)) {
      if (entry[field] !== expectedValue) {
        throw new Error(`Install exposure domain ${expected.domain_id}.${field} must be ${expectedValue}`);
      }
    }
    if (entry.direct_skill_semantics_required !== true) {
      throw new Error(`Install exposure domain ${expected.domain_id} must require direct skill semantics`);
    }
  }
  for (const domainId of ['mas', 'mag', 'rca']) {
    if (exposureById.get(domainId)?.default_home_visible !== true) {
      throw new Error(`Install exposure domain ${domainId} must be visible on the default home path`);
    }
  }
  if (exposureById.get('oma')?.default_home_visible !== false) {
    throw new Error('Install exposure policy must keep OMA out of the default home path');
  }

  const installerSurfaces = new Map((policy.installer_surfaces ?? []).map((entry) => [entry.surface, entry]));
  for (const surface of ['app_first_run', 'full_first_install_dmg', 'standard_dmg', 'one_shot_cli_installer', 'docker_webui']) {
    const entry = installerSurfaces.get(surface);
    if (!entry) {
      throw new Error(`Install exposure policy missing installer surface ${surface}`);
    }
    if (entry.progress_source !== firstRunProgressSourceCommand) {
      throw new Error(`Install exposure surface ${surface} must use ${firstRunProgressSourceCommand}`);
    }
  }
  if (installerSurfaces.get('app_first_run')?.exposure_policy !== 'hide_skill_plugin_packaging_mechanics_by_default') {
    throw new Error('App first-run install exposure must hide skill/plugin packaging mechanics by default');
  }

  const presentation = policy.first_run_user_presentation;
  if (presentation?.default_mode !== 'beginner_first') {
    throw new Error('Install exposure first-run presentation must be beginner_first');
  }
  if (presentation.skill_plugin_distinction_visible_by_default !== false) {
    throw new Error('Install exposure first-run presentation must hide skill/plugin distinction by default');
  }
  assertIncludesAll(
    presentation.primary_steps,
    firstRunCoreItems,
    'Install exposure first-run primary steps',
  );
  assertIncludesAll(
    presentation.secondary_steps,
    fullReadinessItems,
    'Install exposure first-run secondary steps',
  );
  if (presentation.technical_detail_policy !== 'hidden_until_expanded_or_error') {
    throw new Error('Install exposure technical details must be hidden until expanded or error');
  }

  const setupFlow = policy.setup_flow_contract;
  if (setupFlow?.source_command !== firstRunProgressSourceCommand) {
    throw new Error('Install exposure setup flow must use opl system initialize --json');
  }
  if (setupFlow?.source_path !== firstRunProgressSourcePath) {
    throw new Error('Install exposure setup flow must read system_initialize.setup_flow');
  }
  if (setupFlow?.truth_policy !== 'all_installers_and_renderers_derive_progress_from_the_shared_initialize_model') {
    throw new Error('Install exposure setup flow must forbid separate installer progress truth');
  }
  if (setupFlow.ready_to_launch_gate !== 'ready_to_launch') {
    throw new Error('Install exposure setup flow must use ready_to_launch gate');
  }
  assertIncludesAll(
    setupFlow.ready_to_launch_required_core_items,
    firstRunCoreItems,
    'Install exposure ready_to_launch core items',
  );
  assertIncludesAll(
    setupFlow.full_readiness_non_blocking_items,
    fullReadinessItems,
    'Install exposure full readiness non-blocking items',
  );

  const sync = policy.sync_and_install_contract;
  for (const command of ['opl install', 'opl system initialize --json', 'opl system startup-maintenance', 'opl skill sync']) {
    if (!sync?.framework_commands?.includes(command)) {
      throw new Error(`Install exposure sync contract must include ${command}`);
    }
  }
  if (sync.codex_plugin_registry_owner !== 'one-person-lab') {
    throw new Error('Install exposure sync contract must keep Codex plugin registry owner in one-person-lab');
  }
  if (sync.app_release_payload_owner !== 'one-person-lab-app') {
    throw new Error('Install exposure sync contract must keep App release payload owner in one-person-lab-app');
  }
  for (const prevention of [
    'plugin-packaged MAS/MAG/RCA skills must not be mirrored into duplicate bare skill directories',
    'OPL Meta Agent is surfaced as an OPL-generated skill surface',
    'App visible companion skill defaults must be product profile configuration, not shell-local hardcoding',
  ]) {
    if (!sync.duplicate_prevention?.includes(prevention)) {
      throw new Error(`Install exposure duplicate prevention must include ${prevention}`);
    }
  }
  for (const state of [
    'dirty_managed_checkout',
    'ahead_or_diverged_managed_checkout',
    'missing_plugin_manifest',
    'missing_skill_entry',
    'duplicate_codex_visible_domain_skill',
  ]) {
    if (!sync.fail_closed_states?.includes(state)) {
      throw new Error(`Install exposure fail-closed states must include ${state}`);
    }
  }

  const validation = policy.release_validation;
  if (validation?.structural_gate !== 'node --experimental-strip-types scripts/validate-active-shell.ts --quick') {
    throw new Error('Install exposure release validation structural gate must be validate-active-shell --quick');
  }
  for (const gate of ['standard_dmg_clean_vm_smoke', 'full_dmg_clean_vm_smoke', 'one_shot_app_installer_fresh_install_smoke', 'docker_webui_smoke']) {
    if (!validation.stable_install_gates?.includes(gate)) {
      throw new Error(`Install exposure stable install gates must include ${gate}`);
    }
  }
}

function validateAppGuiProductContract(guiContract, releaseChannel, installExposurePolicy) {
  if (guiContract.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected App GUI product contract owner: ${guiContract.owner}`);
  }
  if (guiContract.purpose !== 'app_owned_gui_product_contract') {
    throw new Error(`Unexpected App GUI product contract purpose: ${guiContract.purpose}`);
  }
  if (guiContract.state !== 'active') {
    throw new Error(`Unexpected App GUI product contract state: ${guiContract.state}`);
  }
  if (guiContract.product_authority?.source_of_truth !== 'one-person-lab-app') {
    throw new Error('App GUI product contract source of truth must be one-person-lab-app');
  }
  if (guiContract.product_authority.active_shell_role !== 'implementation_carrier') {
    throw new Error('App GUI product contract must treat the active shell as implementation carrier');
  }
  if (guiContract.product_authority.upstream_gui_role !== 'implementation_material_only') {
    throw new Error('App GUI product contract must keep upstream GUI behavior as implementation material only');
  }
  if (guiContract.product_authority.upstream_behavior_acceptance_policy !== 'must_match_app_owned_gui_product_contract_before_release') {
    throw new Error('App GUI product contract must gate upstream behavior against App-owned GUI requirements');
  }
  const shellUpgradePolicy = guiContract.product_authority.shell_upgrade_policy;
  if (shellUpgradePolicy?.role !== 'replaceable_implementation_carrier') {
    throw new Error('App GUI product contract must treat shell upgrades as replaceable implementation carrier work');
  }
  assertIncludesAll(
    shellUpgradePolicy.app_repo_controls,
    [
      'settings information architecture',
      'home command center requirements',
      'page-state acceptance matrix',
      'release and screenshot evidence gates',
    ],
    'App GUI shell upgrade policy app repo controls',
  );
  assertIncludesAll(
    shellUpgradePolicy.shell_repo_controls,
    [
      'renderer implementation details',
      'upstream AionUI intake patches',
      'shell-local tests proving App contract implementation',
    ],
    'App GUI shell upgrade policy shell repo controls',
  );
  const forkDeltaBudget = shellUpgradePolicy.fork_delta_budget;
  if (forkDeltaBudget?.policy !== 'app_contract_first_thin_shell_delta') {
    throw new Error('App GUI shell upgrade policy must keep fork delta App-contract-first and thin');
  }
  assertIncludesAll(
    forkDeltaBudget.preferred_optimization_path,
    [
      'encode product behavior in App contracts and product profile',
      'project App state/action refs through adapter bridge',
      'compose existing shell components before introducing new shell-owned flows',
      'keep upstream route compatibility as redirects instead of ordinary tabs',
      'prove behavior with App-root validation and shell-local focused tests',
    ],
    'App GUI fork delta preferred optimization path',
  );
  assertIncludesAll(
    forkDeltaBudget.allowed_shell_delta,
    [
      'generated product profile reader',
      'route and tab compatibility redirects',
      'thin renderer components for App-owned pages',
      'App state/action bridge calls',
      'shell-local styling and i18n needed to render App contract',
      'package and smoke hooks',
    ],
    'App GUI fork delta allowed shell changes',
  );
  assertIncludesAll(
    forkDeltaBudget.requires_app_contract_before_shell_change,
    [
      'new ordinary Settings tab',
      'new Home surface',
      'new capability or purpose entry',
      'new runtime/action truth source',
      'new visible model/provider/permission control',
      'new first-run gate',
    ],
    'App GUI fork delta App-contract-before-shell-change rules',
  );
  assertIncludesAll(
    forkDeltaBudget.forbidden_shell_delta,
    [
      'shell-owned product IA',
      'shell-owned runtime/domain truth',
      'fork-local model/provider policy',
      'deep rewrites of upstream shell core without App contract and adoption gate',
      'copying external UI source into shell without license and candidate decision',
    ],
    'App GUI fork delta forbidden shell changes',
  );
  if (
    forkDeltaBudget.replacement_rule !==
    'a candidate shell should implement the same App contracts by swapping adapters/profile consumers, not by inheriting AionUI-specific product logic'
  ) {
    throw new Error('App GUI fork delta budget must keep shell replacement adapter/profile driven');
  }
  if (
    shellUpgradePolicy.upgrade_rule !==
    'follow upstream AionUI only after checking the delta against App-owned contracts; upstream defaults can be implementation material but never product authority'
  ) {
    throw new Error('App GUI shell upgrade policy must keep upstream defaults out of product authority');
  }
  if (
    shellUpgradePolicy.replacement_rule !==
    'new shells remain candidate implementations until App-owned contracts, page-state matrix, first-run matrix, active-shell validation, and package compile pass'
  ) {
    throw new Error('App GUI shell replacement rule must require App-owned gates before adoption');
  }

  const installExposure = guiContract.framework_surfaces?.install_exposure_policy;
  if (installExposure?.contract !== 'contracts/app-install-exposure-policy.json') {
    throw new Error('App GUI contract must reference app-install-exposure-policy.json');
  }
  if (installExposure.skill_role !== installExposurePolicy.public_abi?.skill_role) {
    throw new Error('App GUI install exposure skill role must match install exposure policy');
  }
  if (installExposure.plugin_role !== installExposurePolicy.public_abi?.plugin_role) {
    throw new Error('App GUI install exposure plugin role must match install exposure policy');
  }
  if (installExposure.default_presentation !== 'hide_skill_plugin_packaging_mechanics_by_default') {
    throw new Error('App GUI install exposure must hide skill/plugin mechanics by default');
  }
  if (installExposure.duplicate_skill_policy !== 'plugin_packaged_domain_skills_must_not_be_mirrored_as_duplicate_bare_skills') {
    throw new Error('App GUI install exposure must reject duplicate bare skill mirrors');
  }

  assertCommandSurface(guiContract.framework_surfaces?.canonical_state?.default_command, 'opl app state --profile fast --json', 'App GUI default state command');
  assertCommandSurface(guiContract.framework_surfaces.canonical_state.refresh_command, 'opl app state --profile fast --json', 'App GUI refresh state command');
  if (guiContract.framework_surfaces.canonical_state.default_profile !== 'fast') {
    throw new Error('App GUI default state profile must be fast');
  }
  if (guiContract.framework_surfaces.canonical_state.manual_refresh_profile !== 'fast') {
    throw new Error('App GUI manual refresh profile must be fast');
  }
  if (guiContract.framework_surfaces.canonical_state.full_profile_policy !== 'diagnostic_or_release_evidence_only') {
    throw new Error('App GUI full state profile must be reserved for diagnostics or release evidence');
  }
  assertCommandSurface(
    guiContract.framework_surfaces.canonical_action?.command,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
    'App GUI action command',
  );
  assertCommandSurface(
    guiContract.framework_surfaces.runtime_full_drilldown?.command,
    'opl runtime app-operator-drilldown --detail full --json',
    'App GUI runtime full drilldown exception',
  );
  if (guiContract.framework_surfaces.runtime_full_drilldown.policy !== 'on_demand_only') {
    throw new Error('App GUI runtime full drilldown must be on-demand only');
  }
  const runtimeDefaultAttention = guiContract.framework_surfaces.runtime_default_attention;
  if (runtimeDefaultAttention?.default_mode !== 'user_task_status_first') {
    throw new Error('App GUI runtime default attention must be user_task_status_first');
  }
  assertDeepEqualJson(
    runtimeDefaultAttention?.primary_fields,
    ['running_task_count', 'active_project_count', 'queued_project_count', 'attention_count'],
    'App GUI runtime default attention primary fields',
  );
  assertDeepEqualJson(
    runtimeDefaultAttention?.owner_action_fields,
    ['task title', 'task status', 'task stage', 'progress label', 'next step', 'owner', 'last progress'],
    'App GUI runtime default attention owner action fields',
  );
  assertIncludesAll(
    runtimeDefaultAttention?.active_project_line_fields,
    [
      'app_state.operator.workbench.summary_cards[active_projects]',
      'app_state.operator.workbench.activity_center.active_projects',
      'app_state.operator.visual_ref_groups.active_project_refs',
    ],
    'App GUI runtime default attention active_project_line_fields',
  );
  if (
    runtimeDefaultAttention?.active_project_line_policy
    !== 'queued_or_escalated_owner_handled_project_lines_count_as_user_visible_active_projects_without_claiming_active_worker_run'
  ) {
    throw new Error('App GUI runtime default attention must separate active project lines from active worker runs');
  }
  assertDeepEqualJson(
    runtimeDefaultAttention?.must_not_default_display_terms,
    ['Temporal', 'provider', 'projection', 'ref', 'stage attempt', 'ledger', 'current_control_state'],
    'App GUI runtime default attention forbidden default terms',
  );
  for (const forbiddenSource of [
    'direct opl modules --json page aggregation',
    'direct opl system developer-supervisor page aggregation',
    'direct opl family-runtime worker status page aggregation',
    'application.systemInfo as OPL path truth',
    'application.appVersions as OPL release truth',
    'direct reads of OPL internal state files',
  ]) {
    if (!guiContract.framework_surfaces.forbidden_gui_truth_sources?.includes(forbiddenSource)) {
      throw new Error(`App GUI contract must forbid ${forbiddenSource}`);
    }
  }

  if (guiContract.executor_policy?.default_executor !== 'codex_cli') {
    throw new Error('App GUI default executor must be Codex CLI');
  }
  if (guiContract.executor_policy.codex_only_default !== true) {
    throw new Error('App GUI default executor policy must be Codex-only');
  }
  if (guiContract.executor_policy.executor_tab_visible_when_single_executor !== false) {
    throw new Error('App GUI must hide executor tab when Codex CLI is the only executor');
  }
  assertDeepEqualJson(
    guiContract.home_layout,
    appOwnedHomeLayout,
    'App GUI home layout',
  );
  assertDeepEqualJson(
    guiContract.ordinary_conversation,
    appOwnedGuiContractOrdinaryConversation,
    'App GUI ordinary conversation contract',
  );
  assertDeepEqualJson(
    (guiContract.right_context_inspector?.tabs ?? []).map((tab) => tab.id),
    appOwnedRightContextInspectorTabIds,
    'App GUI right context inspector tabs',
  );
  for (const [field, expected] of Object.entries({
    placement: 'right',
    default_state: 'collapsed',
    opens_on_user_request_only: true,
    chat_canvas_remains_primary: true,
    scope: 'selected_workspace_and_conversation',
  })) {
    if (guiContract.right_context_inspector?.[field] !== expected) {
      throw new Error(`App GUI right context inspector ${field} must be ${expected}`);
    }
  }
  for (const forbiddenOwner of ['runtime truth', 'domain truth', 'artifact body', 'memory body', 'backend selection authority']) {
    if (!guiContract.right_context_inspector?.must_not_own?.includes(forbiddenOwner)) {
      throw new Error(`App GUI right context inspector must not own ${forbiddenOwner}`);
    }
  }
  const assistants = new Map((guiContract.default_assistants ?? []).map((assistant) => [assistant.id, assistant]));
  for (const assistantId of ['mas', 'mag', 'rca']) {
    const assistant = assistants.get(assistantId);
    if (!assistant) {
      throw new Error(`App GUI contract missing default assistant ${assistantId}`);
    }
    if (assistant.home_entry_policy !== 'purpose_entry_target' || assistant.home_entry_display_policy !== 'purpose_first') {
      throw new Error(`Default assistant ${assistantId} must be a purpose-first entry target`);
    }
  }
  const skillProfiles = guiContract.assistant_skill_profiles ?? [];
  if (JSON.stringify(skillProfiles.map((profile) => profile.assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('App GUI contract assistant skill profiles must target MAS, MAG, and RCA');
  }
  for (const profile of skillProfiles) {
    if (JSON.stringify(profile.required_skills) !== JSON.stringify([profile.assistant_id])) {
      throw new Error(`App GUI assistant ${profile.assistant_id} must require its matching skill`);
    }
    if (
      profile.required_skill_policy !== 'checked_locked' ||
      profile.optional_skill_policy !== 'unchecked_user_selectable' ||
      profile.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible'
    ) {
      throw new Error(`App GUI assistant ${profile.assistant_id} has invalid home skill policy`);
    }
    if ('hidden_home_skill_names' in profile) {
      throw new Error(`App GUI assistant ${profile.assistant_id} must not carry UI hiding policy`);
    }
  }
  const purposeEntries = guiContract.home_purpose_entries ?? [];
  if (JSON.stringify(purposeEntries.map((entry) => entry.id)) !== JSON.stringify(['research', 'grant', 'ppt'])) {
    throw new Error('App GUI contract must expose research, grant, and ppt purpose entries');
  }
  if (JSON.stringify(purposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('App GUI contract purpose entries must target MAS, MAG, and RCA');
  }
  for (const entry of purposeEntries) {
    if (entry.display_policy !== 'purpose_first' || entry.home_entry_policy !== 'visible_click_to_start') {
      throw new Error(`App GUI purpose entry ${entry.id} must be purpose-first and click-to-start`);
    }
  }
  const oma = (guiContract.non_default_assistants ?? []).find((assistant) => assistant.id === 'oma');
  if (!oma || oma.home_default_visible !== false || oma.home_entry_policy !== 'explicit_or_settings_only') {
    throw new Error('App GUI contract must keep OMA available but out of default home entries');
  }
  if (assistants.has('oma')) {
    throw new Error('OMA must not be a default App GUI assistant');
  }
  if (assistants.has('mds')) {
    throw new Error('MDS must not be a default App GUI assistant');
  }
  const retiredMds = (guiContract.retired_domain_agents ?? []).find((agent) => agent.id === 'mds');
  if (retiredMds?.default_display_allowed !== false) {
    throw new Error('App GUI contract must mark MDS as not default-displayed');
  }

  if (guiContract.theme_and_branding?.default_theme_id !== 'default-theme') {
    throw new Error('App GUI default theme must be default-theme');
  }
  for (const themeId of ['codex', 'default-theme']) {
    if (!guiContract.theme_and_branding.allowed_theme_ids?.includes(themeId)) {
      throw new Error(`App GUI theme list must include ${themeId}`);
    }
  }
  for (const section of ['general', 'access', 'capabilities', 'environment', 'appearance', 'advanced', 'about', 'update', 'theme']) {
    if (!guiContract.settings_navigation?.required_sections?.includes(section)) {
      throw new Error(`App GUI settings navigation must include ${section}`);
    }
  }
  assertDeepEqualJson(
    guiContract.settings_navigation?.ordinary_visible_tabs,
    appOwnedSettingsTabs,
    'App GUI settings navigation ordinary visible tabs',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation?.legacy_route_redirects,
    legacySettingsRouteRedirects,
    'App GUI settings navigation legacy route redirects',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation?.ordinary_hidden_legacy_tabs,
    ordinaryHiddenLegacySettingsTabs,
    'App GUI settings navigation ordinary hidden legacy tabs',
  );
  if (guiContract.settings_navigation.source !== 'opl app state --profile fast --json') {
    throw new Error('App GUI settings navigation must default to fast App state');
  }
  if (guiContract.settings_navigation.refresh_source !== 'opl app state --profile fast --json') {
    throw new Error('App GUI settings navigation refresh must use fast App state');
  }
  const firstLaunchPolicy = guiContract.first_launch_readiness_policy;
  if (firstLaunchPolicy?.launch_gate !== 'ready_to_launch' || firstLaunchPolicy?.ui_order !== 'before_guid') {
    throw new Error('App GUI first-launch readiness must gate ready_to_launch before /guid');
  }
  for (const item of firstRunCoreItems) {
    if (!firstLaunchPolicy?.core_required_items?.includes(item)) {
      throw new Error(`App GUI first-launch readiness must require Core item ${item}`);
    }
  }
  for (const item of fullReadinessItems) {
    if (!firstLaunchPolicy?.full_readiness_items?.includes(item)) {
      throw new Error(`App GUI first-launch readiness must keep ${item} in full readiness`);
    }
  }
  for (const [field, expected] of Object.entries({
    full_readiness_blocks_launch: false,
    default_provider: 'gflab',
    default_base_url: 'https://gflabtoken.cn/v1',
    default_model: 'gpt-5.5',
    default_reasoning_effort: 'xhigh',
    default_executor: 'codex_cli',
    full_runtime_provider: 'temporal',
  })) {
    if (firstLaunchPolicy?.[field] !== expected) {
      throw new Error(`App GUI first-launch readiness ${field} must be ${expected}`);
    }
  }
  validateBeginnerFirstRunPresentation(
    firstLaunchPolicy?.beginner_presentation,
    'App GUI first-launch beginner presentation',
  );
  const firstLaunchProgressModel = firstLaunchPolicy?.progress_model;
  if (firstLaunchProgressModel?.source_command !== firstRunProgressSourceCommand) {
    throw new Error('App GUI first-launch progress model must use opl system initialize --json');
  }
  if (firstLaunchProgressModel?.source_path !== firstRunProgressSourcePath) {
    throw new Error('App GUI first-launch progress model must read system_initialize.setup_flow');
  }
  if (firstLaunchProgressModel?.renderer_truth_policy !== firstRunRendererTruthPolicy) {
    throw new Error('App GUI first-launch progress model must keep the shell as render-only');
  }
  assertIncludesAll(
    firstLaunchProgressModel?.required_setup_flow_fields,
    firstRunSetupFlowFields,
    'App GUI first-launch progress setup_flow fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_progress_fields,
    firstRunProgressFields,
    'App GUI first-launch progress fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_checklist_fields,
    firstRunChecklistFields,
    'App GUI first-launch progress checklist fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_visible_elements,
    firstRunProgressVisibleElements,
    'App GUI first-launch progress visible elements',
  );

  const modulePathPolicy = guiContract.module_path_source_policy;
  if (modulePathPolicy?.source !== 'app_state.modules[].source + app_state.modules[].path + app_state.paths') {
    throw new Error('App GUI module path explanation must come from App state module/path refs');
  }
  for (const explanation of [
    'whether a module comes from the bundled Full runtime payload',
    'whether a module comes from the stable GHCR package channel',
    'whether a module comes from a local domain repository checkout',
    'whether a GitHub repo or checkout source is enabled by Developer Mode',
    'whether a module is managed by App/CLI maintenance',
    'that module path display is refs-only and not domain truth authority',
  ]) {
    if (!modulePathPolicy.must_explain?.includes(explanation)) {
      throw new Error(`App GUI module path source policy must explain ${explanation}`);
    }
  }
  if (modulePathPolicy.ordinary_user_source !== 'stable_ghcr_package_channel') {
    throw new Error('App GUI module path source policy must keep ordinary users on stable GHCR package channel');
  }
  if (modulePathPolicy.developer_override_surface !== 'Developer Mode') {
    throw new Error('App GUI module path source policy must route repo/checkout override through Developer Mode');
  }
  if (modulePathPolicy.developer_override_policy !== 'explicit_opt_in_only') {
    throw new Error('App GUI module path source policy must require explicit opt-in for Developer Mode checkout override');
  }
  if (!modulePathPolicy.must_not_use?.includes('raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI')) {
    throw new Error('App GUI module path source policy must not expose raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI');
  }

  for (const lane of releaseChannel.release_validation_profiles.stable.required_lanes) {
    if (!guiContract.release_channel_policy?.stable?.must_gate?.includes(lane)) {
      throw new Error(`App GUI stable release policy must gate ${lane}`);
    }
  }
  for (const lane of releaseChannel.release_validation_profiles.nightly_standard.required_lanes) {
    if (!guiContract.release_channel_policy?.nightly?.must_gate?.includes(lane)) {
      throw new Error(`App GUI nightly release policy must gate ${lane}`);
    }
  }
  for (const lane of releaseChannel.release_validation_profiles.nightly_standard.forbidden_lanes) {
    if (!guiContract.release_channel_policy?.nightly?.must_not_gate?.includes(lane)) {
      throw new Error(`App GUI nightly release policy must exclude ${lane}`);
    }
  }

  const pages = guiContract.pages ?? {};
  for (const pageId of [
    'guid_home',
    'settings_general',
    'settings_access',
    'settings_capabilities',
    'settings_environment',
    'settings_advanced',
    'about',
    'update',
    'settings_theme',
    'runtime_status',
  ]) {
    if (!pages[pageId]) {
      throw new Error(`App GUI contract missing page ${pageId}`);
    }
  }
  for (const pageId of [
    'guid_home',
    'settings_general',
    'settings_access',
    'settings_capabilities',
    'settings_environment',
    'settings_advanced',
    'about',
    'update',
    'settings_theme',
  ]) {
    assertCommandSurface(pages[pageId].state_source, 'opl app state --profile fast --json', `App GUI ${pageId} state source`);
    assertCommandSurface(pages[pageId].refresh_source, 'opl app state --profile fast --json', `App GUI ${pageId} refresh source`);
  }
  if (!pages.guid_home.must_show?.includes('purpose-first assistants Research/Grant/Presentation as click-to-start entries')) {
    throw new Error('App GUI home must show purpose-first Research/Grant/Presentation entries');
  }
  if (!pages.guid_home.must_show?.includes('selected assistant shown as a compact @ purpose tag')) {
    throw new Error('App GUI home must show selected assistant as a compact @ purpose tag');
  }
  if (pages.guid_home.model_status?.display_value !== 'GPT-5.5（超高）') {
    throw new Error('App GUI home must display the friendly default model and reasoning status');
  }
  if (pages.guid_home.model_status?.selector_visible !== true) {
    throw new Error('App GUI home model status must expose the App-owned model selector');
  }
  if (
    pages.guid_home.conversation_feedback_policy?.pending_indicator !==
    'visible elapsed seconds while request is pending or backend is running'
  ) {
    throw new Error('App GUI conversation must show elapsed seconds while Codex is working');
  }
  if (
    pages.guid_home.conversation_feedback_policy?.model_status !==
    'same model status and selector appear in Codex conversation composer'
  ) {
    throw new Error('App GUI conversation must show the same model status and selector');
  }
  if (!pages.guid_home.must_not_show?.includes('OPL Meta Agent as a default home assistant')) {
    throw new Error('App GUI home must keep OMA out of default home entries');
  }
  if (pages.guid_home.activity_center_policy?.source !== 'runtime page only; Home does not query running task lists') {
    throw new Error('App GUI home activity center must be suppressed on ordinary Home and routed to Runtime/secondary context');
  }
  if (pages.guid_home.activity_center_policy?.authority !== 'app_owned_home_minimal_command_surface') {
    throw new Error('App GUI home activity center policy must be App-owned minimal command surface');
  }
  if (pages.guid_home.activity_center_policy?.default_placement !== 'not_rendered_on_ordinary_home') {
    throw new Error('App GUI home must not render the expanded activity center on ordinary Home');
  }
  if (pages.guid_home.activity_center_policy?.home_surface_policy !== 'ordinary_home_must_not_render_activity_center_or_continue_work_grid') {
    throw new Error('App GUI home must forbid ordinary Home activity center / continue-work grid rendering');
  }
  assertDeepEqualJson(
    pages.guid_home.activity_center_policy.allowed_home_runtime_context,
    [],
    'App GUI home allowed runtime context',
  );
  assertIncludesAll(
    pages.guid_home.activity_center_policy.must_not_display,
    homeActivityCenterForbiddenDisplays,
    'App GUI home activity center forbidden displays',
  );
  for (const hiddenSignal of [
    'compact continue-work entry near the home input',
    'needs attention, active, and recent refs on Home',
    'Home footer feedback icon',
    'Home footer favorite/star icon',
    'Home footer web/access globe icon',
    'per-assistant running badges derived from module or domain lane diagnostics',
  ]) {
    if (!pages.guid_home.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`App GUI home must not show ${hiddenSignal}`);
    }
  }
  for (const [pageId, expected] of Object.entries(settingsPageExpectations)) {
    const page = pages[pageId];
    assertDeepEqualJson(page.sections, expected.sections, `App GUI ${pageId} sections`);
    assertIncludesAll(page.must_show, expected.must_show, `App GUI ${pageId} must_show`);
    assertIncludesAll(page.must_not_show, expected.must_not_show, `App GUI ${pageId} must_not_show`);
  }
  if (
    pages.settings_capabilities.builtin_skill_catalog_policy?.allowed_set_ref !==
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids + packaged_not_default_visible_codex_skill_ids'
  ) {
    throw new Error('Settings Capabilities must filter builtin skill catalog through the App packaged skill set');
  }
  assertIncludesAll(
    pages.settings_capabilities.builtin_skill_catalog_policy?.forbidden_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator'],
    'Settings Capabilities forbidden upstream builtin skills',
  );
  if (
    pages.settings_capabilities.auto_injected_skills_policy?.allowed_set_ref !==
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids'
  ) {
    throw new Error('Settings Capabilities must filter auto-injected skills through the App packaged skill set');
  }
  assertIncludesAll(
    pages.settings_capabilities.auto_injected_skills_policy?.forbidden_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator'],
    'Settings Capabilities forbidden upstream auto skills',
  );
  validateOplFlowContext(guiContract.opl_flow_context, 'App GUI OPL Flow Context');
  if (!pages.settings_advanced.sections?.includes('opl_flow_context')) {
    throw new Error('Settings Advanced sections must include opl_flow_context');
  }
  if (!pages.settings_advanced.legacy_state_sections?.includes('opl_agent_codex_context')) {
    throw new Error('Settings Advanced must retain legacy opl_agent_codex_context compatibility');
  }
  if (!pages.settings_advanced.must_show?.includes('OPL Flow Context')) {
    throw new Error('Settings Advanced must show OPL Flow Context');
  }
  if (pages.settings_environment.module_path_source_policy_ref !== 'module_path_source_policy') {
    throw new Error('Settings Environment must reference the App GUI module path source policy');
  }
  if (!pages.settings_environment.must_show?.includes('module path source explanation')) {
    throw new Error('Settings Environment must show module path source explanation');
  }
  if (!pages.settings_environment.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Settings Environment must keep MDS out of default module display');
  }
  if (!pages.about.must_show?.includes('Stable or Nightly channel')) {
    throw new Error('About page must show Stable or Nightly channel');
  }
  if (!pages.update.must_show?.includes('Stable channel update state') || !pages.update.must_show?.includes('Nightly opt-in update state when enabled')) {
    throw new Error('Update page must show stable and nightly update states');
  }
  if (!pages.settings_theme.must_show?.includes('Default theme option') || !pages.settings_theme.must_show?.includes('Codex theme option')) {
    throw new Error('Settings theme page must show default and Codex theme options');
  }
  validateProgressDeltaDisplayContract(
    pages.runtime_status.progress_delta_policy,
    'App GUI runtime status progress delta policy',
  );
  if (pages.runtime_status.primary_projection !== 'app_state.operator user task status projection') {
    throw new Error('App GUI runtime status must default to the user task status projection');
  }
  validateUserTaskStatusProjectionContract(
    pages.runtime_status.user_task_status_policy,
    'App GUI runtime status user task status policy',
  );
  for (const signal of [
    'user task status first OPL runtime status',
    'running task count',
    'active project count',
    'queued project count',
    'attention count',
    'task title/status/stage/progress label/next step/owner/last progress',
    'deliverable progress delta classification',
    'platform repair delta as separate infrastructure repair',
  ]) {
    if (!pages.runtime_status.must_show?.includes(signal)) {
      throw new Error(`App GUI runtime status must show ${signal}`);
    }
  }
  assertDeepEqualJson(
    pages.runtime_status.must_not_default_show,
    ['Temporal', 'provider', 'projection', 'ref', 'stage attempt', 'ledger', 'current_control_state'],
    'App GUI runtime status forbidden default terms',
  );
  for (const owner of ['deliverable progress truth', 'platform repair truth']) {
    if (!pages.runtime_status.must_not_own?.includes(owner)) {
      throw new Error(`App GUI runtime status must not own ${owner}`);
    }
  }
  if ('docker_webui' in guiContract) {
    throw new Error('App GUI contract must not include withdrawn Docker/WebUI username, title, logo, or branding requirements');
  }
}

function validatePageStateMatrix(matrix, contract) {
  if (isDefaultReleaseAdapter(contract) && (matrix.active_shell !== contract.active_shell || matrix.shell_root !== contract.shell_root)) {
    throw new Error('Page-state matrix must target the active shell contract');
  }

  const requiredPages = new Set([
    'guid_home',
    'runtime',
    'settings_general',
    'access',
    'capabilities',
    'environment',
    'advanced',
    'about',
    'update',
    'settings_theme',
    'first_launch_readiness',
  ]);
  for (const page of matrix.pages ?? []) {
    requiredPages.delete(page.id);
    if (!page.expected_source || !Array.isArray(page.must_show) || page.must_show.length === 0) {
      throw new Error(`Invalid page-state entry: ${JSON.stringify(page)}`);
    }
  }
  if (requiredPages.size > 0) {
    throw new Error(`Page-state matrix is missing required page(s): ${[...requiredPages].join(', ')}`);
  }
  if ((matrix.pages ?? []).some((page) => page.id === 'docker_webui')) {
    throw new Error('Page-state matrix must not include withdrawn Docker/WebUI username, title, logo, or branding requirements');
  }

  const guidHomePage = (matrix.pages ?? []).find((page) => page.id === 'guid_home');
  if (!guidHomePage) {
    throw new Error('Page-state matrix is missing guid_home page');
  }
  if (guidHomePage.machine_source !== 'contracts/app-gui-product-contract.json#pages.guid_home + opl app state --profile fast --json') {
    throw new Error(`Guid home page must consume the App GUI product contract and OPL App state, got: ${guidHomePage.machine_source}`);
  }
  const homeViewModel = guidHomePage.home_view_model;
  if (homeViewModel?.authority !== 'app_repo_owned_product_truth') {
    throw new Error('Guid home page must declare App-owned GUI authority');
  }
  if (homeViewModel.implementation_carrier !== 'opl-aion-shell') {
    throw new Error('Guid home page implementation carrier must be opl-aion-shell');
  }
  for (const [field, expected] of Object.entries({
    state_source: 'opl app state --profile fast --json',
    refresh_source: 'opl app state --profile fast --json',
    executor_policy_ref: 'contracts/app-gui-product-contract.json#executor_policy',
    assistant_source_ref: 'contracts/app-gui-product-contract.json#default_assistants',
    assistant_skill_profile_source_ref: 'contracts/app-gui-product-contract.json#assistant_skill_profiles',
    codex_only_default: true,
    codex_cli_fixed_executor: true,
    home_executor_selector_visible: false,
    executor_tab_visible_when_single_executor: false,
    primary_input_surface: 'single_card',
    nested_input_card_frames_allowed: false,
    codex_model_selector_visible: true,
    codex_model_list_visible: true,
    codex_model_policy: 'codex_cli_latest_strongest_model_selector_visible',
    codex_model_auto_option_visible: true,
    codex_default_model: 'gpt-5.5',
    codex_default_reasoning_effort: 'xhigh',
    codex_default_display_label: 'GPT-5.5（超高）',
    codex_precise_model_display_policy: 'friendly_default_model_and_reasoning_visible',
    codex_default_permission_mode: 'full-access',
    permission_mode_selector_visible: false,
    conversation_backend_selector_visible: false,
    conversation_model_selector_visible: true,
    conversation_permission_mode_selector_visible: false,
  })) {
    if (homeViewModel[field] !== expected) {
      throw new Error(`Guid home page ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    homeViewModel.home_layout,
    appOwnedHomeLayout,
    'Guid home page layout',
  );
  for (const assistant of ['mas', 'mag', 'rca']) {
    if (!homeViewModel.default_assistants?.includes(assistant)) {
      throw new Error(`Guid home page must include default assistant ${assistant}`);
    }
  }
  if (homeViewModel.default_assistants?.includes('oma')) {
    throw new Error('Guid home page must not include OMA as a default assistant');
  }
  const requiredSkills = homeViewModel.default_assistant_required_skills ?? {};
  for (const assistant of ['mas', 'mag', 'rca']) {
    if (JSON.stringify(requiredSkills[assistant]) !== JSON.stringify([assistant])) {
      throw new Error(`Guid home page must require ${assistant} skill for ${assistant}`);
    }
  }
  if (homeViewModel.purpose_entry_source_ref !== 'contracts/app-gui-product-contract.json#home_purpose_entries') {
    throw new Error('Guid home page must reference App-owned purpose entries');
  }
  if (homeViewModel.route_receipt_source_ref !== 'contracts/app-gui-product-contract.json#builtin_assistant_route_receipt_policy') {
    throw new Error('Guid home page must reference App-owned built-in assistant route receipt policy');
  }
  assertIncludesAll(
    homeViewModel.route_receipt_required_fields,
    ['route_kind', 'executor', 'assistant_id', 'assistant_short_name', 'source'],
    'Guid home page route receipt fields',
  );
  const homePurposeEntries = homeViewModel.home_purpose_entries ?? [];
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.id)) !== JSON.stringify(['research', 'grant', 'ppt'])) {
    throw new Error('Guid home page must expose research, grant, and ppt purpose entries');
  }
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('Guid home page purpose entries must target MAS, MAG, and RCA');
  }
  for (const visibleSignal of [
    'Codex CLI fixed executor experience',
    'Codex model selector defaulting to GPT-5.5（超高）',
    'default model and reasoning status GPT-5.5（超高）',
    'purpose-first entries 科研/MAS, 基金/MAG, 演示/RCA',
    'selected assistant keeps purpose entry switcher visible',
    'assistant-scoped skill menu with required skill checked',
    'workspace selector',
    'file attachment control',
    'send action',
    'single composer-first home input',
    'workspace/session rail collapsed by default',
    'right context inspector collapsed by default',
    'runtime/task progress available from Runtime page, not Home activity grid',
  ]) {
    if (!guidHomePage.must_show.includes(visibleSignal)) {
      throw new Error(`Guid home page must show ${visibleSignal}`);
    }
  }
  for (const hiddenSignal of [
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
    'expanded workbench or activity refs grid on ordinary home',
    'domain artifact body in Home activity center',
    'memory body in Home activity center',
    'compact continue-work entry near the home input',
    'Home footer feedback icon',
    'Home footer favorite/star icon',
    'Home footer web/access globe icon',
    'per-assistant running badges derived from module or domain lane diagnostics',
  ]) {
    if (!guidHomePage.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`Guid home page must not show ${hiddenSignal}`);
    }
  }
  if (
    homeViewModel.activity_center?.authority !== 'app_owned_home_minimal_command_surface' ||
    homeViewModel.activity_center?.source !== 'not_rendered_on_ordinary_home' ||
    homeViewModel.activity_center?.default_placement !== 'not_rendered_on_ordinary_home' ||
    homeViewModel.activity_center?.home_surface_policy !== 'ordinary_home_must_not_render_activity_center_or_continue_work_grid'
  ) {
    throw new Error('Guid home page activity center must be suppressed on ordinary Home and routed to Runtime/secondary context');
  }
  assertDeepEqualJson(
    homeViewModel.activity_center.allowed_home_runtime_context,
    [],
    'Guid home page allowed runtime context',
  );
  assertIncludesAll(
    homeViewModel.activity_center.must_not_display,
    homeActivityCenterForbiddenDisplays,
    'Guid home page activity center forbidden displays',
  );

  const ordinaryConversationPage = (matrix.pages ?? []).find((page) => page.id === 'ordinary_conversation');
  if (!ordinaryConversationPage) {
    throw new Error('Page-state matrix is missing ordinary_conversation page');
  }
  if (ordinaryConversationPage.page_contract !== 'ordinary_codex_conversation') {
    throw new Error('Ordinary conversation page contract must be ordinary_codex_conversation');
  }
  assertDeepEqualJson(
    ordinaryConversationPage.conversation_view_model,
    appOwnedPageStateOrdinaryConversation,
    'Ordinary conversation view model',
  );
  for (const visibleSignal of [
    'Codex CLI ordinary conversation',
    'pinned composer',
    'compact purpose tag',
    'assistant route receipt',
    'Codex default model and reasoning status',
  ]) {
    if (!ordinaryConversationPage.must_show?.includes(visibleSignal)) {
      throw new Error(`Ordinary conversation page must show ${visibleSignal}`);
    }
  }
  for (const hiddenSignal of [
    'backend selector as normal conversation control',
    'permission mode selector as normal conversation control',
    'provider selector as normal conversation control',
  ]) {
    if (!ordinaryConversationPage.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`Ordinary conversation page must not show ${hiddenSignal}`);
    }
  }

  const rightContextInspectorPage = (matrix.pages ?? []).find((page) => page.id === 'right_context_inspector');
  if (!rightContextInspectorPage) {
    throw new Error('Page-state matrix is missing right_context_inspector page');
  }
  const inspectorViewModel = rightContextInspectorPage.inspector_view_model;
  assertDeepEqualJson(
    (inspectorViewModel?.tabs ?? []).map((tab) => tab.id),
    appOwnedRightContextInspectorTabIds,
    'Right context inspector tabs',
  );
  for (const [field, expected] of Object.entries({
    placement: 'right',
    default_state: 'collapsed',
    opens_on_user_request_only: true,
    chat_canvas_remains_primary: true,
    scope: 'selected_workspace_and_conversation',
  })) {
    if (inspectorViewModel?.[field] !== expected) {
      throw new Error(`Right context inspector ${field} must be ${expected}`);
    }
  }
  for (const visibleSignal of [
    'right-side collapsible inspector',
    'Files refs tab',
    'Capabilities tab',
    'Routing/runtime refs tab',
    'Memory refs tab',
    'Always-On/Automations tab',
    'Settings tab',
  ]) {
    if (!rightContextInspectorPage.must_show?.includes(visibleSignal)) {
      throw new Error(`Right context inspector page must show ${visibleSignal}`);
    }
  }
  for (const forbiddenOwner of ['runtime truth', 'domain truth', 'artifact body', 'memory body', 'backend selection authority']) {
    if (!rightContextInspectorPage.must_not_own?.includes(forbiddenOwner)) {
      throw new Error(`Right context inspector page must not own ${forbiddenOwner}`);
    }
  }

  const appStatePages = ['settings_general', 'access', 'environment', 'advanced', 'about', 'update', 'settings_theme'];
  for (const pageId of appStatePages) {
    const page = (matrix.pages ?? []).find((entry) => entry.id === pageId);
    if (!page) {
      throw new Error(`Page-state matrix is missing ${pageId}`);
    }
    if (page.machine_source !== 'opl app state --profile fast --json') {
      throw new Error(`${pageId} must default to opl app state --profile fast --json`);
    }
    if (page.refresh_source !== 'opl app state --profile fast --json') {
      throw new Error(`${pageId} must refresh through opl app state --profile fast --json`);
    }
  }
  for (const [contractPageId, expected] of Object.entries(settingsPageExpectations)) {
    const page = (matrix.pages ?? []).find((entry) => entry.id === expected.matrix_id);
    if (!page) {
      throw new Error(`Page-state matrix is missing ${expected.matrix_id}`);
    }
    if (page.page_contract !== contractPageId) {
      throw new Error(`${expected.matrix_id} page_contract must be ${contractPageId}`);
    }
    assertDeepEqualJson(page.sections, expected.sections, `${expected.matrix_id} sections`);
    assertIncludesAll(page.must_show, expected.must_show, `${expected.matrix_id} must_show`);
    assertIncludesAll(page.must_not_show, expected.must_not_show, `${expected.matrix_id} must_not_show`);
  }
  const capabilitiesPage = (matrix.pages ?? []).find((page) => page.id === 'capabilities');
  if (capabilitiesPage?.refresh_source !== 'opl app state --profile fast --json') {
    throw new Error('Capabilities page must refresh through opl app state --profile fast --json');
  }
  if (capabilitiesPage?.machine_source !== 'contracts/app-gui-product-contract.json#default_assistants + opl app state --profile fast --json') {
    throw new Error('Capabilities page must combine App-owned assistant profile truth with OPL App state readiness refs');
  }
  const environmentPage = (matrix.pages ?? []).find((page) => page.id === 'environment');
  if (environmentPage?.module_path_source_policy_ref !== 'contracts/app-gui-product-contract.json#module_path_source_policy') {
    throw new Error('Environment page must reference the App GUI module path source policy');
  }
  if (!environmentPage.must_show?.includes('module path source explanation')) {
    throw new Error('Environment page must show module path source explanation');
  }
  const advancedPage = (matrix.pages ?? []).find((page) => page.id === 'advanced');
  if (!advancedPage?.state_sections?.includes('opl_flow_context')) {
    throw new Error('Advanced page state_sections must include opl_flow_context');
  }
  if (!advancedPage?.legacy_state_sections?.includes('opl_agent_codex_context')) {
    throw new Error('Advanced page must retain legacy opl_agent_codex_context compatibility');
  }
  if (!advancedPage?.must_show?.includes('OPL Flow Context')) {
    throw new Error('Advanced page must show OPL Flow Context');
  }
  if (!environmentPage.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Environment page must keep MDS out of default module display');
  }
  if (!advancedPage?.state_sections?.includes('opl_agent_codex_context')) {
    throw new Error('Advanced page state_sections must retain opl_agent_codex_context');
  }
  const aboutPage = (matrix.pages ?? []).find((page) => page.id === 'about');
  if (!aboutPage?.must_show?.includes('Stable or Nightly channel')) {
    throw new Error('About page must show Stable or Nightly channel');
  }
  const updatePage = (matrix.pages ?? []).find((page) => page.id === 'update');
  if (!updatePage?.must_show?.includes('Stable channel update state') || !updatePage.must_show.includes('Nightly opt-in update state when enabled')) {
    throw new Error('Update page must show stable and nightly update states');
  }
  const settingsThemePage = (matrix.pages ?? []).find((page) => page.id === 'settings_theme');
  for (const signal of [
    'Default theme option',
    'Codex theme option',
    'current theme from app_state.settings.theme',
    'theme choice as App product preference',
  ]) {
    if (!settingsThemePage?.must_show?.includes(signal)) {
      throw new Error(`Settings theme page must show ${signal}`);
    }
  }

  const firstLaunchPage = (matrix.pages ?? []).find((page) => page.id === 'first_launch_readiness');
  if (!firstLaunchPage) {
    throw new Error('Page-state matrix is missing first_launch_readiness page');
  }
  if (firstLaunchPage.launch_gate?.id !== 'ready_to_launch' || firstLaunchPage.launch_gate?.ui_order !== 'before_guid') {
    throw new Error('First-launch readiness page must gate ready_to_launch before /guid');
  }
  if (firstLaunchPage.launch_gate?.full_readiness_blocks_ready_to_launch !== false) {
    throw new Error('First-launch readiness page must keep full readiness non-blocking for ready_to_launch');
  }
  validateBeginnerFirstRunPresentation(
    firstLaunchPage.beginner_view_model,
    'First-launch readiness beginner view model',
  );
  assertIncludesAll(
    firstLaunchPage.beginner_view_model?.required_shell_testids,
    beginnerFirstRunTestIds,
    'First-launch readiness beginner shell test ids',
  );
  for (const item of firstRunCoreItems) {
    if (!firstLaunchPage.launch_gate?.required_core_items?.includes(item)) {
      throw new Error(`First-launch readiness page must require Core item ${item}`);
    }
  }
  for (const item of fullReadinessItems) {
    if (!firstLaunchPage.launch_gate?.full_readiness_items?.includes(item)) {
      throw new Error(`First-launch readiness page must list ${item} as full readiness`);
    }
  }
  for (const signal of [
    'workspace root readiness',
    'Codex CLI readiness',
    'Codex config readiness',
    'ready_to_launch before /guid',
    'full readiness and background maintenance state',
    'current initialization phase',
    'Core completed and total count',
    'Full readiness completed and total count',
    'background maintenance completed and total count',
    'next visible step',
    'beginner-facing readiness summary',
    'primary start action',
    'background maintenance collapsed technical disclosure',
    'technical details toggle',
  ]) {
    if (!firstLaunchPage.must_show?.includes(signal)) {
      throw new Error(`First-launch readiness page must show ${signal}`);
    }
  }
  for (const hiddenSignal of [
    'Homebrew, Node, Git, CLT, module, provider, or runtime maintenance as primary first-screen terminal goals',
    'Full readiness progress as the dominant first-screen message',
    'raw command output in the beginner primary area',
    'English runtime checklist labels in the Chinese beginner primary area',
    'Codex API Configuration, Unknown, or Needs setup in the Chinese beginner primary area',
    'background maintenance counters or labels in the beginner primary area',
  ]) {
    if (!firstLaunchPage.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`First-launch readiness page must not show ${hiddenSignal}`);
    }
  }
  const localizationPolicy = firstLaunchPage.beginner_view_model?.localization_policy;
  assertIncludesAll(
    localizationPolicy?.chinese_primary_labels,
    ['工作目录', '本机助手', '访问权限'],
    'First-launch readiness beginner localization labels',
  );
  assertIncludesAll(
    localizationPolicy?.forbidden_primary_area_text,
    ['Codex API Configuration', 'Unknown', 'Needs setup', 'setup_flow', 'opl system'],
    'First-launch readiness beginner forbidden primary text',
  );
  if (
    localizationPolicy?.technical_label_policy !==
    'map_initialize_item_ids_to_app_owned_beginner_labels_before_rendering_primary_area'
  ) {
    throw new Error('First-launch readiness beginner localization must map initialize item ids before rendering');
  }
  const firstLaunchProgressModel = firstLaunchPage.progress_model;
  if (firstLaunchProgressModel?.source_command !== firstRunProgressSourceCommand) {
    throw new Error('First-launch readiness page progress model must use opl system initialize --json');
  }
  if (firstLaunchProgressModel?.source_path !== firstRunProgressSourcePath) {
    throw new Error('First-launch readiness page progress model must read system_initialize.setup_flow');
  }
  if (firstLaunchProgressModel?.renderer_truth_policy !== firstRunRendererTruthPolicy) {
    throw new Error('First-launch readiness page progress model must keep the shell as render-only');
  }
  assertIncludesAll(
    firstLaunchProgressModel?.required_setup_flow_fields,
    firstRunSetupFlowFields,
    'First-launch readiness page progress setup_flow fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_progress_fields,
    firstRunProgressFields,
    'First-launch readiness page progress fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_checklist_fields,
    firstRunChecklistFields,
    'First-launch readiness page progress checklist fields',
  );
  assertIncludesAll(
    firstLaunchProgressModel?.required_visible_elements,
    firstRunProgressVisibleElements,
    'First-launch readiness page progress visible elements',
  );

  const runtimePage = (matrix.pages ?? []).find((page) => page.id === 'runtime');
  if (!runtimePage) {
    throw new Error('Page-state matrix is missing runtime page');
  }
  if (runtimePage.machine_source !== 'opl app state --profile fast --json + opl runtime app-operator-drilldown --json') {
    throw new Error(`Runtime page must consume OPL App state plus operator drilldown as the summary source, got: ${runtimePage.machine_source}`);
  }
  if (runtimePage.primary_projection !== 'app_state.operator user task status projection') {
    throw new Error(`Runtime page primary_projection must be user task status, got: ${runtimePage.primary_projection}`);
  }
  if (runtimePage.framework_command !== 'opl app state --profile fast --json') {
    throw new Error(`Runtime page must use the OPL App state command, got: ${runtimePage.framework_command}`);
  }
  if (runtimePage.framework_full_detail_command !== 'opl runtime app-operator-drilldown --detail full --json') {
    throw new Error(`Runtime page must lazy-load full App/operator drilldown only on demand, got: ${runtimePage.framework_full_detail_command}`);
  }
  if (runtimePage.framework_action_command !== 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json') {
    throw new Error(`Runtime page must expose only the whitelisted OPL App action command, got: ${runtimePage.framework_action_command}`);
  }
  const acceptancePath = runtimePage.operator_evidence_acceptance_path;
  if (acceptancePath?.role !== 'runtime_page_operator_evidence_acceptance') {
    throw new Error('Runtime page must declare operator evidence acceptance path');
  }
  if (acceptancePath.accepts_refs_only_json !== true) {
    throw new Error('Runtime page operator evidence acceptance must be refs-only JSON');
  }
  for (const [field, expected] of Object.entries({
    summary_state_command: 'opl app state --profile fast --json',
    refresh_state_command: 'opl app state --profile fast --json',
    full_drilldown_command: 'opl runtime app-operator-drilldown --detail full --json',
    action_dry_run_command: 'opl app action execute --action <action_id> --dry-run --json',
    action_execute_command: 'opl app action execute --action <action_id> --json',
    action_route_source: 'app_state.actions',
    action_execution_policy: 'operator_selected_safe_app_action_route_only',
  })) {
    if (acceptancePath[field] !== expected) {
      throw new Error(`Runtime page operator evidence acceptance ${field} must be ${expected}`);
    }
  }
  const runtimeViewModel = runtimePage.runtime_view_model;
  if (runtimeViewModel?.role !== 'opl_runtime_user_task_status') {
    throw new Error('Runtime page must declare OPL runtime user task status view model');
  }
  if (runtimeViewModel.bridge_contract !== 'contracts/app-runtime-bridge.json') {
    throw new Error(`Runtime page view model must reference app-runtime-bridge.json, got: ${runtimeViewModel.bridge_contract}`);
  }
  if (runtimeViewModel.default_mode !== 'user_task_status_first') {
    throw new Error('Runtime page view model must default to user_task_status_first');
  }
  if (runtimeViewModel.full_detail_policy !== 'on_demand_only') {
    throw new Error('Runtime page full detail must be on-demand only');
  }
  if (
    runtimeViewModel.polling_fallback?.interval_seconds_min !== 5
    || runtimeViewModel.polling_fallback?.interval_seconds_max !== 10
    || runtimeViewModel.polling_fallback?.policy !== 'lightweight_polling_until_push_projection_available'
  ) {
    throw new Error('Runtime page polling fallback must be lightweight 5-10 second polling');
  }
  for (const [field, expected] of Object.entries({
    'action_queue.source': 'app_state.actions',
    'action_queue.fallback_source': 'app_state.operator.actions',
    'action_queue.authority': 'framework_refs_only',
    'progress_delta.source': 'app_state.operator.workbench.task_drilldowns.progress_delta_classification',
    'progress_delta.authority': 'opl_framework_shared_progress_projection',
    'progress_delta.display_policy': 'classification_only_no_domain_artifact_body',
    'progress_delta.deliverable_progress_source': 'deliverable_progress_delta',
    'progress_delta.platform_repair_source': 'platform_repair_delta',
    'progress_delta.classification_source': 'progress_delta_classification',
    'progress_delta.platform_repair_display_treatment': 'separate_infrastructure_repair_not_deliverable_progress',
    primary_state_source: 'opl app state --profile fast --json',
    refresh_state_source: 'opl app state --profile fast --json',
    summary_source: 'opl runtime app-operator-drilldown --json',
    full_detail_source: 'opl runtime app-operator-drilldown --detail full --json',
    'provider_status.source': 'app_state.provider',
    'provider_status.authority': 'opl_framework',
    'authority_boundary.action_execution_owner': 'opl_framework',
    'authority_boundary.domain_verdict_owner': 'domain_agent',
  })) {
    const actual = field.split('.').reduce((value, key) => value?.[key], runtimeViewModel);
    if (actual !== expected) {
      throw new Error(`Runtime page view model ${field} must be ${expected}`);
    }
  }
  validateUserTaskStatusProjectionContract(
    runtimeViewModel.user_task_status_projection,
    'Runtime page user task status projection',
  );
  validateProjectProgressDisplayContract(runtimeViewModel.project_progress, 'Runtime page project progress display contract');
  const pageDefaultAttention = runtimeViewModel.default_attention;
  if (pageDefaultAttention?.mode !== 'user_task_status_first') {
    throw new Error('Runtime page default attention must be user_task_status_first');
  }
  assertDeepEqualJson(
    pageDefaultAttention?.primary_fields,
    ['running_task_count', 'active_project_count', 'queued_project_count', 'attention_count'],
    'Runtime page default attention primary fields',
  );
  assertIncludesAll(
    pageDefaultAttention?.active_project_line_fields,
    [
      'app_state.operator.workbench.summary_cards[active_projects]',
      'app_state.operator.workbench.activity_center.active_projects',
      'app_state.operator.visual_ref_groups.active_project_refs',
    ],
    'Runtime page default attention active_project_line_fields',
  );
  if (
    pageDefaultAttention?.active_project_line_policy
    !== 'queued_or_escalated_owner_handled_project_lines_count_as_user_visible_active_projects_without_claiming_active_worker_run'
  ) {
    throw new Error('Runtime page default attention must keep active project lines separate from active worker runs');
  }
  if (runtimeViewModel.diagnostics?.default_visibility !== 'secondary_disclosure') {
    throw new Error('Runtime page diagnostics must be secondary disclosure, not a primary daily surface');
  }
  assertIncludesAll(
    runtimeViewModel.diagnostics?.sections,
    ['operator summary', 'safe actions', 'evidence refs', 'full detail digest'],
    'Runtime page diagnostics sections',
  );
  if (runtimeViewModel.authority_boundary?.refs_only !== true) {
    throw new Error('Runtime page view model must be refs-only');
  }
  if (runtimeViewModel.authority_boundary?.non_authority_display_only !== true) {
    throw new Error('Runtime page view model must be display-only for non-authority domain refs');
  }
  validateProgressDeltaDisplayContract(runtimeViewModel.progress_delta, 'Runtime page progress delta display contract');
  const runningTaskProjection = runtimeViewModel.running_task_projection;
  if (
    runningTaskProjection?.source !== 'app_operator_drilldown.current_control_state.summary + current_control_state.states' ||
    runningTaskProjection.authority !== 'opl_framework_provider_attempt_projection' ||
    runningTaskProjection.display_policy !== 'diagnostic_only_no_provider_attempt_count_as_user_running_task_count' ||
    runningTaskProjection.active_execution_filter !==
      'states where running_provider_attempt is true and provider_run.provider_status or current_attempt_state is running' ||
    runningTaskProjection.diagnostic_provider_ref_policy !==
      'running_provider_attempt_count may include checkpointed provider refs and must not be displayed as the user-visible running task count'
  ) {
    throw new Error('Runtime page must keep provider running activity as diagnostic projection');
  }
  assertIncludesAll(
    runningTaskProjection.required_user_fields,
    [
      'current_control_state.states[].running_provider_attempt',
      'current_control_state.states[].provider_run.provider_status',
      'current_control_state.states[].current_attempt_state',
      'running_provider_attempt_count',
      'running_provider_attempt_domain_ids',
      'running_provider_attempt_task_kinds',
      'latest_running_provider_heartbeat_at',
      'running_provider_attempt_summary_policy',
    ],
    'Runtime page running task required user fields',
  );
  assertIncludesAll(
    runningTaskProjection.forbidden_sources,
    [
      'domain_lane_map active_task_count',
      'app_state.operator.workbench.task_drilldowns where active_stage_id is module_runtime',
      'app_state.modules',
      'module_runtime dirty state',
      'repo/worktree diagnostics',
      'assistant cards',
    ],
    'Runtime page running task forbidden sources',
  );
  const requiredEvidencePath = [
    'user task status first OPL runtime status',
    'running task count from framework user task projection',
    'active project count from framework project-line projection',
    'queued project count from framework project-line projection',
    'attention count from framework blocker and owner-attention projection',
    'task title/status/stage/progress label/next step/owner/last progress',
    'provider/current_control_state details as diagnostics only',
    'summary OPL operator drilldown read model',
    'fast App state refresh',
    'app_state.operator.workbench.task_drilldowns project progress refs',
    'app_state.operator.workbench.activity_center.active_projects active project lines',
    'app_state.operator.visual_ref_groups.active_project_refs',
    'full detail lazy load',
    'app_state.operator.summary refs',
    'app_state.provider readiness refs',
    'app_state.actions safe action refs',
    'refs-only non-authority boundary',
    'safe app action dry-run',
    'safe app action execute',
    'receipt/count refresh after execute',
    'authority boundary fields',
  ];
  for (const signal of requiredEvidencePath) {
    if (!runtimePage.operator_evidence_path?.includes(signal)) {
      throw new Error(`Runtime page operator evidence path must include ${signal}`);
    }
  }
  const requiredRuntimeSignals = [
    'user task status first OPL runtime status',
    'running task count',
    'active project count',
    'queued project count',
    'attention count',
    'task title/status/stage/progress label/next step/owner/last progress',
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
    'summary OPL operator drilldown read model',
    'full detail lazy load',
    'safe app action dry-run/execute controls',
    'deliverable progress delta classification',
    'platform repair delta as separate infrastructure repair',
    'receipt/count refresh after execute',
    'refs-only non-authority boundary',
  ];
  for (const signal of requiredRuntimeSignals) {
    if (!runtimePage.must_show.includes(signal)) {
      throw new Error(`Runtime page must show ${signal}`);
    }
  }
  assertDeepEqualJson(
    runtimePage.must_not_default_show,
    ['Temporal', 'provider', 'projection', 'ref', 'stage attempt', 'ledger', 'current_control_state'],
    'Runtime page forbidden default display terms',
  );
  const forbiddenRuntimeOwners = [
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
  ];
  for (const owner of forbiddenRuntimeOwners) {
    if (!runtimePage.must_not_own?.includes(owner)) {
      throw new Error(`Runtime page must not own ${owner}`);
    }
  }
  if (matrix.canonical_state_surface?.default_command !== 'opl app state --profile fast --json') {
    throw new Error('Page-state matrix canonical default state command must be fast App state');
  }
  if (matrix.canonical_state_surface.refresh_command !== 'opl app state --profile fast --json') {
    throw new Error('Page-state matrix canonical refresh state command must be fast App state');
  }
  if (matrix.canonical_action_surface?.command !== 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json') {
    throw new Error('Page-state matrix canonical action command must be the OPL App action execute boundary');
  }
  if (matrix.full_detail_exception?.command !== 'opl runtime app-operator-drilldown --detail full --json') {
    throw new Error('Page-state matrix full detail exception must be OPL runtime app-operator-drilldown');
  }
}

function validateReleaseEvidenceBundle(releaseChannel, pageStateMatrix, firstRunMatrix) {
  const bundle = releaseChannel.operator_evidence_bundle;
  if (bundle?.purpose !== 'runtime_page_operator_evidence_acceptance') {
    throw new Error('Release channel must declare operator_evidence_bundle purpose');
  }
  if (bundle.acceptance_path !== 'Runtime page') {
    throw new Error(`Unexpected operator evidence acceptance path: ${bundle.acceptance_path}`);
  }
  if (bundle.runtime_page_contract !== 'contracts/app-page-state-matrix.json#runtime') {
    throw new Error(`Unexpected runtime page contract ref: ${bundle.runtime_page_contract}`);
  }
  if (bundle.refs_only !== true) {
    throw new Error('Operator evidence bundle must be refs-only');
  }
  if (bundle.manifest_path !== 'evidence-manifest.json') {
    throw new Error(`Unexpected operator evidence manifest path: ${bundle.manifest_path}`);
  }
  if (bundle.missing_evidence_policy?.default_validation !== 'fail_closed') {
    throw new Error('Operator evidence bundle missing evidence policy must fail closed by default');
  }
  if (bundle.missing_evidence_policy?.allow_missing_evidence_flag !== '--allow-missing-evidence') {
    throw new Error('Operator evidence bundle missing evidence policy must declare --allow-missing-evidence');
  }
  if (bundle.missing_evidence_policy?.missing_status !== 'missing_evidence') {
    throw new Error('Operator evidence bundle missing evidence policy must declare missing_evidence status');
  }
  if (
    !Array.isArray(bundle.missing_evidence_policy?.allowed_artifact_statuses) ||
    !['present', 'missing', 'typed_blocker', 'not_applicable'].every((status) =>
      bundle.missing_evidence_policy.allowed_artifact_statuses.includes(status)
    )
  ) {
    throw new Error('Operator evidence bundle must declare present, missing, typed_blocker, and not_applicable statuses');
  }
  if (
    !Array.isArray(bundle.missing_evidence_policy?.typed_blocker_status_requires) ||
    !['reason', 'typed_blocker_ref'].every((field) =>
      bundle.missing_evidence_policy.typed_blocker_status_requires.includes(field)
    )
  ) {
    throw new Error('Operator evidence bundle typed_blocker status must require reason and typed_blocker_ref');
  }
  if (
    !Array.isArray(bundle.missing_evidence_policy?.not_applicable_status_requires) ||
    !['reason', 'not_applicable_reason'].every((field) =>
      bundle.missing_evidence_policy.not_applicable_status_requires.includes(field)
    )
  ) {
    throw new Error('Operator evidence bundle not_applicable status must require reason and not_applicable_reason');
  }
  if (bundle.missing_evidence_policy?.packaged_app_evidence_requires !== 'all_required_artifacts_present_and_verified') {
    throw new Error('Operator evidence bundle must require all artifacts before claiming packaged App evidence');
  }
  if (
    bundle.image_evidence_policy?.applies_to_kind !== 'image'
    || bundle.image_evidence_policy?.minimum_width_px !== 640
    || bundle.image_evidence_policy?.minimum_height_px !== 360
    || bundle.image_evidence_policy?.minimum_file_size_bytes !== 4096
    || bundle.image_evidence_policy?.placeholder_screenshot_allowed !== false
  ) {
    throw new Error('Operator evidence bundle image policy must reject placeholder screenshots');
  }

  const artifactById = new Map((bundle.required_artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const requiredArtifacts = {
    app_state_summary: {
      path: 'app-state-summary.json',
      producer: 'opl app state --profile fast --json',
      kind: 'json',
      source_kind: 'opl_app_state_summary',
    },
    app_state_full: {
      path: 'app-state-full.json',
      producer: 'opl app state --profile full --json',
      kind: 'json',
      source_kind: 'opl_app_state_full',
    },
    drilldown_full: {
      path: 'drilldown-full.json',
      producer: 'opl runtime app-operator-drilldown --detail full --json',
      kind: 'json',
      source_kind: 'opl_app_operator_drilldown_full',
    },
    action_dry_run_result: {
      path: 'action-dry-run-result.json',
      producer: 'opl app action execute --action <action_id> --dry-run --json',
      kind: 'json',
      source_kind: 'opl_app_action_dry_run',
    },
    action_execute_result: {
      path: 'action-execute-result.json',
      producer: 'opl app action execute --action <action_id> --json',
      kind: 'json',
      source_kind: 'opl_app_action_execute',
    },
    runtime_screenshot: {
      path: 'screenshots/runtime.png',
      producer: 'Runtime page screenshot',
      kind: 'image',
      source_kind: 'app_runtime_page_screenshot',
    },
    full_screenshot: {
      path: 'screenshots/full.png',
      producer: 'Full first-install release screenshot',
      kind: 'image',
      source_kind: 'full_first_install_release_screenshot',
    },
    action_screenshot: {
      path: 'screenshots/action.png',
      producer: 'Runtime action confirmation/result screenshot',
      kind: 'image',
      source_kind: 'app_runtime_action_screenshot',
    },
    first_run_vm_summary: {
      path: 'tart-smoke-summary.json',
      producer: 'clean first-run VM smoke',
      kind: 'json',
      source_kind: 'clean_first_run_vm_smoke',
    },
    guest_smoke_summary: {
      path: 'artifacts/smoke-summary.json',
      producer: 'packaged GUI first-run guest smoke',
      kind: 'json',
      source_kind: 'packaged_gui_first_run_smoke',
    },
    codex_functional_check_summary: {
      path: 'artifacts/codex-functional-check-summary.json',
      producer: 'packaged GUI Codex post-install functional check',
      kind: 'json',
      source_kind: 'packaged_gui_codex_functional_check',
    },
    remote_release_verification: {
      path: 'remote-release-verification.json',
      producer: 'npm run verify-remote-release -- --version <version> --include-full-package --summary-path remote-release-verification.json',
      kind: 'json',
      source_kind: 'remote_release_verification',
    },
  };
  for (const [id, expected] of Object.entries(requiredArtifacts)) {
    const artifact = artifactById.get(id);
    if (!artifact) {
      throw new Error(`Operator evidence bundle missing artifact ${id}`);
    }
    for (const [field, expectedValue] of Object.entries(expected)) {
      if (artifact[field] !== expectedValue) {
        throw new Error(`Operator evidence bundle artifact ${id}.${field} must be ${expectedValue}`);
      }
    }
  }
  const optionalArtifactById = new Map((bundle.optional_diagnostic_artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const codexAiSelfCheck = optionalArtifactById.get('codex_ai_self_check_summary');
  if (!codexAiSelfCheck) {
    throw new Error('Operator evidence bundle missing optional diagnostic artifact codex_ai_self_check_summary');
  }
  for (const [field, expectedValue] of Object.entries({
    path: 'artifacts/codex-ai-self-check-summary.json',
    producer: 'packaged GUI Codex AI-first post-install self-check',
    kind: 'json',
    source_kind: 'packaged_gui_codex_ai_self_check',
  })) {
    if (codexAiSelfCheck[field] !== expectedValue) {
      throw new Error(`Operator evidence bundle optional diagnostic codex_ai_self_check_summary.${field} must be ${expectedValue}`);
    }
  }

  const runtimePage = (pageStateMatrix.pages ?? []).find((page) => page.id === 'runtime');
  if (runtimePage?.operator_evidence_acceptance_path?.summary_state_command !== requiredArtifacts.app_state_summary.producer) {
    throw new Error('Runtime page summary state command must match release evidence bundle producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.refresh_state_command !== requiredArtifacts.app_state_summary.producer) {
    throw new Error('Runtime page refresh state command must match the fast App state summary producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.full_drilldown_command !== requiredArtifacts.drilldown_full.producer) {
    throw new Error('Runtime page full drilldown command must match release evidence bundle producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.action_dry_run_command !== requiredArtifacts.action_dry_run_result.producer) {
    throw new Error('Runtime page dry-run command must match release evidence bundle producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.action_execute_command !== requiredArtifacts.action_execute_result.producer) {
    throw new Error('Runtime page execute command must match release evidence bundle producer');
  }

  const fullFirstInstall = (firstRunMatrix.scenarios ?? []).find((scenario) => scenario.id === 'full_first_install_clean_machine');
  for (const artifactPath of [
    'tart-smoke-summary.json',
    'artifacts/smoke-summary.json',
    'artifacts/settings-smoke-summary.json',
    'artifacts/codex-functional-check-summary.json',
  ]) {
    if (!fullFirstInstall?.release_evidence_artifacts?.includes(artifactPath)) {
      throw new Error(`Full first-install first-run scenario must list release evidence artifact ${artifactPath}`);
    }
  }

  for (const forbidden of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    if (!bundle.forbidden_authority?.includes(forbidden)) {
      throw new Error(`Operator evidence bundle must exclude ${forbidden}`);
    }
  }
}

const firstRunRequiredHostTools = ['command_line_tools', 'homebrew', 'node', 'git'];
const firstRunDeferredMaintenanceItems = [
  'repo_sync',
  'module_reconcile',
  'command_line_tools_install',
  'native_helpers',
  'companion_skills_install',
  'ecosystem_module_updates',
];
const firstRunEcosystemModules = ['officecli', 'mineru', 'opl-meta-agent'];
const firstRunProgressSourceCommand = 'opl system initialize --json';
const firstRunProgressSourcePath = 'system_initialize.setup_flow';
const firstRunRendererTruthPolicy = 'render_only_no_shell_private_progress_truth';
const firstRunSetupFlowFields = ['phase', 'ready_to_launch', 'progress', 'blocking_items', 'maintenance_items'];
const firstRunProgressFields = [
  'ready_required_count',
  'total_required_count',
  'ready_full_readiness_count',
  'total_full_readiness_count',
  'ready_optional_count',
  'total_optional_count',
];
const firstRunChecklistFields = [
  'item_id',
  'label',
  'status',
  'readiness_layer',
  'blocking',
  'severity',
  'next_visible_step',
  'detail_summary',
];
const firstRunProgressVisibleElements = [
  'current initialization phase',
  'Core completed and total count',
  'Full readiness completed and total count',
  'background maintenance completed and total count',
  'blocking item list',
  'next visible step',
];
const firstRunProgressConsumerPackageTypes = ['full', 'standard', 'source_installer', 'docker_webui'];

function buildScenarioMap(matrix) {
  if (!Array.isArray(matrix.scenarios) || matrix.scenarios.length === 0) {
    throw new Error('First-run matrix must declare scenarios');
  }
  return new Map(matrix.scenarios.map((scenario) => {
    if (!scenario.id || !scenario.package_type || !Array.isArray(scenario.expects) || scenario.expects.length === 0) {
      throw new Error(`Invalid first-run scenario: ${JSON.stringify(scenario)}`);
    }
    return [scenario.id, scenario];
  }));
}

function validateFullFirstInstallScenario(fullClean) {
  for (const tool of firstRunRequiredHostTools) {
    if (!fullClean?.clean_machine_missing_tools?.includes(tool)) {
      throw new Error(`Full first-install clean-machine scenario must allow missing ${tool}`);
    }
  }
  if (fullClean?.core_ready_source !== 'bundled_runtime') {
    throw new Error('Full first-install clean-machine scenario must reach Core ready from bundled_runtime');
  }
  if (fullClean?.ready_to_launch_gate?.ui_order !== 'before_guid') {
    throw new Error('Full first-install clean-machine scenario must gate ready_to_launch before /guid');
  }
  if (fullClean?.ready_to_launch_gate?.blocks_on_full_readiness !== false) {
    throw new Error('Full first-install ready_to_launch must not block on full readiness');
  }
  for (const item of firstRunCoreItems) {
    if (!fullClean?.ready_to_launch_gate?.required_core_items?.includes(item)) {
      throw new Error(`Full first-install ready_to_launch must require Core item ${item}`);
    }
  }
  for (const item of firstRunDeferredMaintenanceItems) {
    if (!fullClean?.background_maintenance?.includes(item)) {
      throw new Error(`Full first-install clean-machine scenario must defer ${item} to background maintenance`);
    }
  }
  if (fullClean?.post_core_ready_background_policy?.mode !== 'best_effort_non_blocking') {
    throw new Error('Full first-install clean-machine scenario must continue background maintenance as best-effort non-blocking work');
  }
  if (fullClean?.post_core_ready_background_policy?.continues_after_core_ready !== true) {
    throw new Error('Full first-install clean-machine scenario must continue maintenance after Core ready');
  }
  for (const item of firstRunDeferredMaintenanceItems) {
    if (!fullClean?.post_core_ready_background_policy?.managed_items?.includes(item)) {
      throw new Error(`Full first-install post-Core maintenance must manage ${item}`);
    }
  }
}

function validateStandardBootstrapScenario(standardBootstrap) {
  if (standardBootstrap?.bootstrap_owner !== 'app_managed') {
    throw new Error('Standard bootstrap scenario must declare App-managed bootstrap ownership');
  }
  if (standardBootstrap?.maintenance_resolution_policy !== 'app_or_cli_managed_best_effort_until_ready') {
    throw new Error('Standard bootstrap scenario must keep App/CLI-managed maintenance responsible until host tools are ready');
  }
  if (!standardBootstrap?.expects?.some((entry) => /App-managed bootstrap/.test(entry))) {
    throw new Error('First-run matrix must declare standard App-managed bootstrap');
  }
  if (!standardBootstrap?.expects?.some((entry) => /does not end.*Homebrew, Node, or Git/i.test(entry))) {
    throw new Error('Standard bootstrap must not make Homebrew/Node/Git installation the first-screen end state');
  }
}

function validateCommandLineToolsScenario(cltInstaller) {
  if (cltInstaller?.command !== 'xcode-select --install') {
    throw new Error('CLT first-run scenario must use xcode-select --install');
  }
  if (!cltInstaller?.expects?.some((entry) => /user confirmation/.test(entry))) {
    throw new Error('CLT first-run scenario must wait for user confirmation in the system installer');
  }
}

function validateEcosystemModuleScenario(ecosystem) {
  for (const moduleId of firstRunEcosystemModules) {
    if (!ecosystem?.modules?.includes(moduleId)) {
      throw new Error(`First-run matrix must mark ${moduleId} as App/CLI managed ecosystem module`);
    }
  }
}

function validateUpdaterScenario(updater) {
  if (
    updater?.update_policy?.download !== 'background'
    || updater?.update_policy?.apply !== 'restart_when_ready'
    || updater?.update_policy?.ready_prompt !== 'prompt_restart_after_download_ready'
    || updater?.update_policy?.full_first_install_metadata_allowed !== false
    || updater?.update_policy?.scope !== 'desktop_app_assets_only'
    || updater?.update_policy?.module_package_update_allowed !== false
    || updater?.update_policy?.developer_checkout_selection_allowed !== false
    || updater?.update_policy?.opl_flow_install_allowed !== false
  ) {
    throw new Error('Standard updater scenario must update desktop App assets only and exclude Full metadata, module packages, Developer checkouts, and opl-flow install');
  }
  for (const expected of [
    'standard updater does not update domain module packages',
    'standard updater does not select Developer Mode checkouts',
    'standard updater does not install opl-flow',
  ]) {
    if (!updater.expects?.includes(expected)) {
      throw new Error(`Standard updater scenario must require: ${expected}`);
    }
  }
}

function validateSharedProgressModel(progressModel) {
  if (progressModel?.producer !== 'one-person-lab') {
    throw new Error('First-run shared progress model producer must be one-person-lab');
  }
  if (progressModel?.source_command !== firstRunProgressSourceCommand) {
    throw new Error('First-run shared progress model must use opl system initialize --json');
  }
  if (progressModel?.source_path !== firstRunProgressSourcePath) {
    throw new Error('First-run shared progress model must read system_initialize.setup_flow');
  }
  if (progressModel?.truth_policy !== 'all_installers_and_renderers_derive_progress_from_the_shared_initialize_model') {
    throw new Error('First-run shared progress model must forbid parallel installer progress truth');
  }
  assertIncludesAll(
    progressModel?.required_setup_flow_fields,
    firstRunSetupFlowFields,
    'First-run shared progress model setup_flow fields',
  );
  assertIncludesAll(
    progressModel?.required_progress_fields,
    firstRunProgressFields,
    'First-run shared progress model progress fields',
  );
  assertIncludesAll(
    progressModel?.required_checklist_fields,
    firstRunChecklistFields,
    'First-run shared progress model checklist fields',
  );
  const packageTypes = (progressModel?.consumers ?? []).map((consumer) => consumer.package_type);
  assertIncludesAll(packageTypes, firstRunProgressConsumerPackageTypes, 'First-run shared progress model consumers');
}

function validateFirstRunMatrix(matrix, contract) {
  if (isDefaultReleaseAdapter(contract) && (matrix.active_shell !== contract.active_shell || matrix.shell_root !== contract.shell_root)) {
    throw new Error('First-run matrix must target the active shell contract');
  }
  validateSharedProgressModel(matrix.shared_progress_model);
  const scenarioById = buildScenarioMap(matrix);
  validateFullFirstInstallScenario(scenarioById.get('full_first_install_clean_machine'));
  const beginnerScenario = scenarioById.get('beginner_simplified_first_run_clean_machine');
  if (!beginnerScenario) {
    throw new Error('First-run matrix is missing beginner_simplified_first_run_clean_machine');
  }
  if (beginnerScenario.audience !== 'beginner_non_technical_users') {
    throw new Error('Beginner first-run scenario must target beginner_non_technical_users');
  }
  if (beginnerScenario.view_model !== 'simplified_first_run') {
    throw new Error('Beginner first-run scenario must use simplified_first_run');
  }
  assertIncludesAll(
    beginnerScenario.required_shell_testids,
    beginnerFirstRunTestIds,
    'Beginner first-run scenario shell test ids',
  );
  for (const expected of [
    'Chinese locale first-run primary area uses beginner labels such as 工作目录, 本机助手, and 访问权限 even when initialize checklist labels are English',
    'Chinese locale first-run primary area does not expose Codex API Configuration, Unknown, Needs setup, raw setup_flow fields, or opl system commands',
    'access key entry uses beginner-facing 访问密钥 copy while keeping the narrow Codex configuration bridge underneath',
  ]) {
    if (!beginnerScenario.expects?.includes(expected)) {
      throw new Error(`Beginner first-run scenario must require localized beginner setup UX: ${expected}`);
    }
  }
  validateStandardBootstrapScenario(scenarioById.get('standard_app_managed_bootstrap'));
  validateCommandLineToolsScenario(scenarioById.get('macos_clt_system_installer'));
  validateEcosystemModuleScenario(scenarioById.get('ecosystem_modules_app_cli_managed'));
  validateUpdaterScenario(scenarioById.get('updater_standard_channel'));
}

function validateProductProfileIdentity(profile) {
  if (profile.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected product profile owner: ${profile.owner}`);
  }
  if (profile.purpose !== 'app_owned_product_profile') {
    throw new Error(`Unexpected product profile purpose: ${profile.purpose}`);
  }
  if (profile.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected product profile repo: ${profile.app_repo}`);
  }
}

function validateProductProfileContractRefs(profile) {
  for (const [label, expected] of Object.entries({
    active_shell: defaultActiveShellContractPath,
    page_state: pageStateMatrixPath,
    first_run: firstRunMatrixPath,
    install_exposure: installExposurePolicyPath,
  })) {
    const value = profile.contract_refs?.[label];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Product profile missing contract_refs.${label}`);
    }
    assertFile(path.join(root, value), `product profile ${label} contract ref`);
    if (path.resolve(root, value) !== path.resolve(expected)) {
      throw new Error(`Unexpected product profile contract_refs.${label}: ${value}`);
    }
  }
}

function validateProductProfileCodexDefaults(profile) {
  validateOplFlowContext(profile.codex?.opl_flow_context, 'Product profile OPL Flow Context');
  const sessionContextI18n = profile.codex?.session_context_i18n;
  if (
    !Array.isArray(sessionContextI18n?.['zh-CN']) ||
    !sessionContextI18n['zh-CN'].some((line) => typeof line === 'string' && line.includes('你正在 One Person Lab App')) ||
    !Array.isArray(sessionContextI18n?.['en-US']) ||
    !sessionContextI18n['en-US'].some((line) => typeof line === 'string' && line.includes('You are working inside a Codex session'))
  ) {
    throw new Error('Product profile must declare localized OPL Flow session context');
  }
  if (profile.default_session_profile?.provider !== 'gflab') {
    throw new Error(`Unexpected product profile provider: ${profile.default_session_profile?.provider}`);
  }
  if (profile.default_session_profile?.base_url !== 'https://gflabtoken.cn/v1') {
    throw new Error(`Unexpected product profile base URL: ${profile.default_session_profile?.base_url}`);
  }
  if (profile.default_session_profile?.executor !== 'codex_cli') {
    throw new Error(`Unexpected product profile executor: ${profile.default_session_profile?.executor}`);
  }
  if (profile.default_session_profile?.model !== 'gpt-5.5') {
    throw new Error(`Unexpected product profile model: ${profile.default_session_profile?.model}`);
  }
  if (profile.default_session_profile?.reasoning_effort !== 'xhigh') {
    throw new Error(`Unexpected product profile reasoning effort: ${profile.default_session_profile?.reasoning_effort}`);
  }
  if (profile.default_session_profile?.model !== profile.codex?.default_model) {
    throw new Error('Product profile default_session_profile.model must match codex.default_model');
  }
  if (profile.default_session_profile?.reasoning_effort !== profile.codex?.default_reasoning_effort) {
    throw new Error('Product profile default_session_profile.reasoning_effort must match codex.default_reasoning_effort');
  }
  if (profile.gui?.authority !== 'app_repo_owned_product_truth') {
    throw new Error('Product profile GUI authority must be App-owned');
  }
  if (profile.gui?.implementation_carrier !== 'opl-aion-shell') {
    throw new Error('Product profile GUI implementation carrier must be opl-aion-shell');
  }
  if (
    profile.gui.appearance?.default_css_theme_id !== 'default-theme' ||
    profile.gui.appearance?.codex_theme_default_enabled !== false
  ) {
    throw new Error('Product profile GUI appearance must default to the default theme');
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
    profile.gui.home?.codex_default_model !== profile.codex?.default_model ||
    profile.gui.home?.codex_default_reasoning_effort !== profile.codex?.default_reasoning_effort ||
    profile.gui.home?.codex_default_permission_mode !== 'full-access' ||
    profile.gui.home?.permission_mode_selector_visible !== false ||
    profile.gui.home?.conversation_backend_selector_visible !== false ||
    profile.gui.home?.conversation_model_selector_visible !== true ||
    profile.gui.home?.conversation_permission_mode_selector_visible !== false ||
    profile.gui.home?.codex_home_model_status_label !== 'GPT-5.5（超高）' ||
    profile.gui.home?.codex_precise_model_display_policy !== 'friendly_default_model_and_reasoning_visible'
  ) {
    throw new Error('Product profile GUI home must keep Codex CLI fixed while exposing App-owned model selectors');
  }
  if (
    profile.gui.home.codex_auto_model_selection?.strategy !== 'codex_cli_auto_latest_available_frontier' ||
    profile.gui.home.codex_auto_model_selection.user_can_override_model !== true ||
    profile.gui.home.codex_auto_model_selection.user_can_restore_auto !== true
  ) {
    throw new Error('Product profile GUI home must expose App-owned Codex model selection on the home path');
  }
  if (
    profile.gui.builtin_assistant_route_receipt_policy?.scope !== 'home_purpose_entry_to_conversation' ||
    profile.gui.builtin_assistant_route_receipt_policy.route_kind !== 'builtin_capability' ||
    profile.gui.builtin_assistant_route_receipt_policy.executor !== 'codex_cli' ||
    profile.gui.builtin_assistant_route_receipt_policy.source !== 'opl_app_home' ||
    profile.gui.builtin_assistant_route_receipt_policy.must_not_depend_on_visible_backend_selection !== true
  ) {
    throw new Error('Product profile must require built-in assistant Codex CLI route receipts');
  }
  assertIncludesAll(
    profile.gui.builtin_assistant_route_receipt_policy.required_for_assistants,
    ['mas', 'mag', 'rca'],
    'Product profile route receipt assistants',
  );
  assertIncludesAll(
    profile.gui.builtin_assistant_route_receipt_policy.required_fields,
    ['route_kind', 'executor', 'assistant_id', 'assistant_short_name', 'source'],
    'Product profile route receipt fields',
  );
  const homePurposeEntries = profile.gui.home.home_purpose_entries ?? [];
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.id)) !== JSON.stringify(['research', 'grant', 'ppt'])) {
    throw new Error('Product profile GUI home must expose research, grant, and ppt purpose entries');
  }
  if (JSON.stringify(homePurposeEntries.map((entry) => entry.target_assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('Product profile GUI home purpose entries must target MAS, MAG, and RCA');
  }
  if (JSON.stringify((profile.gui.default_assistants ?? []).map((assistant) => assistant.id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('Product profile default assistants must be MAS, MAG, and RCA only');
  }
  assertDeepEqualJson(
    profile.settings?.visible_tabs,
    appOwnedSettingsTabs,
    'Product profile ordinary settings visible tabs',
  );
  assertDeepEqualJson(
    profile.settings?.legacy_route_redirects,
    legacySettingsRouteRedirects,
    'Product profile legacy settings route redirects',
  );
  const productSkillProfiles = profile.gui.assistant_skill_profiles ?? [];
  if (JSON.stringify(productSkillProfiles.map((entry) => entry.assistant_id)) !== JSON.stringify(['mas', 'mag', 'rca'])) {
    throw new Error('Product profile assistant skill profiles must target MAS, MAG, and RCA');
  }
  const defaultPackagedSkillIds = new Set(profile.companion_payloads?.default_packaged_codex_skill_ids ?? []);
  for (const entry of productSkillProfiles) {
    if (JSON.stringify(entry.required_skills) !== JSON.stringify([entry.assistant_id])) {
      throw new Error(`Product profile assistant ${entry.assistant_id} must require its matching skill`);
    }
    if (entry.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible') {
      throw new Error(`Product profile assistant ${entry.assistant_id} has invalid home skill menu policy`);
    }
    if (entry.optional_skills?.includes('morph-ppt')) {
      throw new Error(`Product profile assistant ${entry.assistant_id} must not expose retired morph-ppt skill wiring`);
    }
    if ('hidden_home_skill_names' in entry) {
      throw new Error(`Product profile assistant ${entry.assistant_id} must not carry UI hiding policy`);
    }
    const unpackagedProfileSkills = [...(entry.required_skills ?? []), ...(entry.optional_skills ?? [])]
      .filter((skill) => !defaultPackagedSkillIds.has(skill));
    if (unpackagedProfileSkills.length > 0) {
      throw new Error(
        `Product profile assistant ${entry.assistant_id} references skills outside the App packaged set: ${unpackagedProfileSkills.join(', ')}`,
      );
    }
  }
  for (const assistant of profile.gui.default_assistants ?? []) {
    if (assistant.home_entry_policy !== 'purpose_entry_target' || assistant.home_entry_display_policy !== 'purpose_first') {
      throw new Error(`Product profile default assistant ${assistant.id} must be a purpose-first entry target`);
    }
  }
  const oma = (profile.gui.non_default_assistants ?? []).find((assistant) => assistant.id === 'oma');
  if (!oma || oma.home_default_visible !== false || oma.home_entry_policy !== 'explicit_or_settings_only') {
    throw new Error('Product profile must keep OMA available but out of default home entries');
  }
  for (const retiredModel of ['gpt-5.2-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini']) {
    if (!profile.gui.home?.retired_codex_models_must_not_be_exposed?.includes(retiredModel)) {
      throw new Error(`Product profile GUI home must ban retired Codex model ${retiredModel}`);
    }
  }
  if (!Array.isArray(profile.codex?.default_visible_skills) || !profile.codex.default_visible_skills.includes('mineru-document-extractor')) {
    throw new Error('Product profile must include mineru-document-extractor as a default visible skill');
  }
  if (!Array.isArray(profile.codex?.default_visible_skills) || !profile.codex.default_visible_skills.includes('ui-ux-pro-max')) {
    throw new Error('Product profile must include ui-ux-pro-max as a default visible skill');
  }
  if (!Array.isArray(profile.codex?.default_visible_skills) || !profile.codex.default_visible_skills.includes('superpowers')) {
    throw new Error('Product profile must include superpowers as a default visible packaged skill');
  }
  for (const skillId of defaultCompanionSkillSyncIds) {
    if (!profile.codex.default_visible_skills.includes(skillId)) {
      throw new Error(`Product profile must include ${skillId} as a default visible skill`);
    }
  }
  if (!Array.isArray(profile.companion_payloads?.default_packaged_codex_skill_ids) || !profile.companion_payloads.default_packaged_codex_skill_ids.includes('superpowers')) {
    throw new Error('Product profile must include superpowers in default packaged Codex skills');
  }
  for (const skillId of defaultCompanionSkillSyncIds) {
    if (!profile.companion_payloads.default_packaged_codex_skill_ids.includes(skillId)) {
      throw new Error(`Product profile must include ${skillId} in default packaged Codex skills`);
    }
  }
  if (
    !Array.isArray(profile.companion_payloads?.packaged_not_default_visible_codex_skill_ids) ||
    !profile.companion_payloads.packaged_not_default_visible_codex_skill_ids.includes('opl-meta-agent')
  ) {
    throw new Error('Product profile must mark OPL Meta Agent as packaged but not default visible');
  }
  if (
    profile.codex.skill_priority.includes('morph-ppt') ||
    profile.companion_payloads.default_packaged_codex_skill_ids.includes('morph-ppt') ||
    profile.companion_payloads.packaged_not_default_visible_codex_skill_ids.includes('morph-ppt')
  ) {
    throw new Error('Product profile must not include retired morph-ppt skill wiring');
  }
}

function validateFullFirstInstallCoreReadyPolicy(profile) {
  if (JSON.stringify(profile.first_run?.readiness_layers) !== JSON.stringify(['core'])) {
    throw new Error('Product profile ready_to_launch readiness_layers must contain only core');
  }
  validateBeginnerFirstRunPresentation(
    profile.first_run?.beginner_presentation,
    'Product profile first-run beginner presentation',
  );
  const launchGate = profile.first_run?.ready_to_launch_gate;
  if (launchGate?.id !== 'ready_to_launch' || launchGate?.ui_order !== 'before_guid') {
    throw new Error('Product profile ready_to_launch gate must run before /guid');
  }
  for (const item of firstRunCoreItems) {
    if (!launchGate?.required_core_items?.includes(item)) {
      throw new Error(`Product profile ready_to_launch gate must require Core item ${item}`);
    }
  }
  for (const item of fullReadinessItems) {
    if (!launchGate?.must_not_require?.includes(item)) {
      throw new Error(`Product profile ready_to_launch gate must not require ${item}`);
    }
    if (!profile.first_run?.full_readiness_layers?.includes(item)) {
      throw new Error(`Product profile full readiness layers must include ${item}`);
    }
  }
  if (
    profile.first_run?.runtime_provider?.full_readiness_provider !== 'temporal'
    || profile.first_run.runtime_provider.ready_to_launch_blocking !== false
  ) {
    throw new Error('Product profile full runtime provider must stay Temporal and non-blocking for ready_to_launch');
  }
  const fullFirstInstall = profile.first_run?.core_ready_policy?.full_first_install_clean_machine;
  for (const tool of requiredHostTools) {
    if (!fullFirstInstall?.missing_host_tools_allowed?.includes(tool)) {
      throw new Error(`Product profile Full first-install policy must allow missing ${tool}`);
    }
  }
  if (fullFirstInstall?.initial_runtime_source !== 'bundled_runtime' || fullFirstInstall?.core_ready_without_host_tools !== true) {
    throw new Error('Product profile Full first-install must reach Core ready through bundled_runtime without host tools');
  }
  for (const blocker of deferredMaintenanceItems) {
    if (!fullFirstInstall?.must_not_block_core_ready?.includes(blocker)) {
      throw new Error(`Product profile Full first-install must not block Core ready on ${blocker}`);
    }
    if (!profile.first_run?.background_maintenance?.items?.includes(blocker)) {
      throw new Error(`Product profile background maintenance must include ${blocker}`);
    }
  }
  if (profile.first_run?.background_maintenance?.blocks_core_ready !== false) {
    throw new Error('Product profile background maintenance must not block Core ready');
  }
  if (
    profile.first_run?.background_maintenance?.mode !== 'best_effort_after_core_ready'
    || profile.first_run?.background_maintenance?.continues_after_core_ready !== true
  ) {
    throw new Error('Product profile background maintenance must continue best-effort after Core ready');
  }
  if (
    fullFirstInstall?.post_core_ready_background_policy?.mode !== 'best_effort_non_blocking'
    || fullFirstInstall?.post_core_ready_background_policy?.continues_after_core_ready !== true
  ) {
    throw new Error('Product profile Full first-install must continue best-effort maintenance after Core ready');
  }
  for (const blocker of deferredMaintenanceItems) {
    if (!fullFirstInstall?.post_core_ready_background_policy?.managed_items?.includes(blocker)) {
      throw new Error(`Product profile Full first-install post-Core maintenance must manage ${blocker}`);
    }
  }
  const progressModel = profile.first_run?.progress_model;
  if (progressModel?.source_command !== firstRunProgressSourceCommand) {
    throw new Error('Product profile first-run progress model must use opl system initialize --json');
  }
  if (progressModel?.source_path !== firstRunProgressSourcePath) {
    throw new Error('Product profile first-run progress model must read system_initialize.setup_flow');
  }
  if (progressModel?.renderer_truth_policy !== firstRunRendererTruthPolicy) {
    throw new Error('Product profile first-run progress model must keep renderers as display-only consumers');
  }
  assertIncludesAll(
    progressModel?.required_setup_flow_fields,
    firstRunSetupFlowFields,
    'Product profile first-run progress setup_flow fields',
  );
  assertIncludesAll(
    progressModel?.required_progress_fields,
    firstRunProgressFields,
    'Product profile first-run progress fields',
  );
  assertIncludesAll(
    progressModel?.required_checklist_fields,
    firstRunChecklistFields,
    'Product profile first-run progress checklist fields',
  );
  assertIncludesAll(
    progressModel?.required_visible_elements,
    firstRunProgressVisibleElements,
    'Product profile first-run progress visible elements',
  );
}

function validateStandardPackagePolicy(profile) {
  const standardPackage = profile.first_run?.core_ready_policy?.standard_package;
  if (
    standardPackage?.bootstrap_owner !== 'app_managed'
    || standardPackage?.maintenance_owner !== 'app_managed'
    || standardPackage?.user_first_screen_terminal_instruction_allowed !== false
    || standardPackage?.manual_host_tool_install_terminal_state_allowed !== false
    || standardPackage?.maintenance_resolution_policy !== 'app_or_cli_managed_best_effort_until_ready'
  ) {
    throw new Error('Product profile standard package must use App-managed bootstrap/maintenance without terminal-install end states');
  }
  for (const forbidden of ['install_homebrew_first', 'install_node_first', 'install_git_first']) {
    if (!standardPackage?.forbidden_terminal_instruction_end_states?.includes(forbidden)) {
      throw new Error(`Product profile standard bootstrap must forbid ${forbidden}`);
    }
  }
}

function validateCommandLineToolsPolicy(profile) {
  if (profile.first_run?.command_line_tools?.installer_command !== 'xcode-select --install') {
    throw new Error('Product profile CLT installer command must be xcode-select --install');
  }
  if (profile.first_run?.command_line_tools?.system_installer_only !== true) {
    throw new Error('Product profile CLT installer must use the macOS system installer path');
  }
  if (profile.first_run?.command_line_tools?.waits_for_user_confirmation !== true) {
    throw new Error('Product profile CLT installer must wait for user confirmation');
  }
}

function validateStandardUpdatePolicy(profile) {
  if (
    profile.first_run?.updates?.standard_channel?.implementation_reference !== 'electron_autoUpdater_background_download_update_downloaded_restart_prompt'
    || profile.first_run?.updates?.standard_channel?.ready_prompt !== 'prompt_restart_after_download_ready'
    || profile.first_run?.updates?.standard_channel?.full_first_install_metadata_allowed !== false
    || profile.first_run?.updates?.standard_channel?.download_policy !== 'background_download'
    || profile.first_run?.updates?.standard_channel?.apply_policy !== 'restart_when_ready'
    || profile.first_run?.updates?.standard_channel?.blocks_core_ready !== false
  ) {
    throw new Error('Product profile standard updates must download in background, prompt restart after ready, exclude Full metadata, and not block Core ready');
  }
}

function validateCompanionPayloadAuthority(profile, installExposurePolicy) {
  if (profile.companion_payloads?.install_exposure_policy_ref !== 'contracts/app-install-exposure-policy.json') {
    throw new Error('Product profile companion payloads must reference app-install-exposure-policy.json');
  }
  if (profile.companion_payloads?.exposure_classes_ref !== 'contracts/app-install-exposure-policy.json#exposure_classes') {
    throw new Error('Product profile companion payloads must reference install exposure classes');
  }
  if (profile.companion_payloads?.public_abi?.primary_semantic_entry !== installExposurePolicy.public_abi?.primary_semantic_entry) {
    throw new Error('Product profile companion payload public ABI must match install exposure primary semantic entry');
  }
  if (profile.companion_payloads.public_abi.preferred_app_distribution !== 'plugin_packaged_skill') {
    throw new Error('Product profile companion payloads must prefer plugin-packaged skills for the App path');
  }
  if (profile.companion_payloads.public_abi.plugin_must_not_create_second_semantics !== true) {
    throw new Error('Product profile companion payloads must forbid second semantics from plugin packaging');
  }
  if (profile.companion_payloads.public_abi.cli_and_app_share_skill_semantics !== true) {
    throw new Error('Product profile companion payloads must keep CLI and App on shared skill semantics');
  }
  for (const moduleId of ecosystemModuleIds) {
    if (!profile.companion_payloads?.ecosystem_modules?.includes(moduleId)) {
      throw new Error(`Product profile must list ${moduleId} as ecosystem module`);
    }
    if (profile.companion_payloads?.management_authority?.[moduleId] !== 'app_or_cli_managed') {
      throw new Error(`Product profile must mark ${moduleId} as App/CLI managed`);
    }
  }
  assertIncludesAll(
    profile.companion_payloads?.domain_plugin_skill_ids,
    ['mas', 'mag', 'rca'],
    'Product profile domain plugin skill ids',
  );
  assertIncludesAll(
    profile.companion_payloads?.companion_skill_sync_default_ids,
    defaultCompanionSkillSyncIds,
    'Product profile companion skill sync default ids',
  );
  if (profile.companion_payloads.domain_plugin_skills_must_not_be_companion_mirrors !== true) {
    throw new Error('Product profile domain plugin skills must not be companion skill mirrors');
  }
  for (const domainPluginId of profile.companion_payloads.domain_plugin_skill_ids ?? []) {
    if (profile.companion_payloads.companion_skill_sync_default_ids?.includes(domainPluginId)) {
      throw new Error(`Product profile companion skill sync defaults must not include domain plugin ${domainPluginId}`);
    }
  }
  const exposureById = new Map((profile.companion_payloads?.domain_exposure ?? []).map((entry) => [entry.domain_id, entry]));
  for (const expected of domainExposureEntries) {
    const entry = exposureById.get(expected.domain_id);
    if (!entry) {
      throw new Error(`Product profile companion payloads missing domain exposure ${expected.domain_id}`);
    }
    if (entry.codex_visible_entry !== expected.codex_visible_entry) {
      throw new Error(`Product profile domain exposure ${expected.domain_id}.codex_visible_entry must be ${expected.codex_visible_entry}`);
    }
    if (entry.preferred_app_distribution !== expected.preferred_app_distribution) {
      throw new Error(`Product profile domain exposure ${expected.domain_id}.preferred_app_distribution must be ${expected.preferred_app_distribution}`);
    }
    if (entry.direct_skill_semantics_required !== true) {
      throw new Error(`Product profile domain exposure ${expected.domain_id} must require direct skill semantics`);
    }
  }
}

function validateProductProfileBoundary(profile) {
  for (const forbidden of forbiddenAuthorityOwners) {
    if (!profile.boundary?.app_does_not_own?.includes(forbidden)) {
      throw new Error(`Product profile boundary must exclude ${forbidden}`);
    }
  }
}

function validateProductProfile(profile, installExposurePolicy) {
  validateProductProfileIdentity(profile);
  validateProductProfileContractRefs(profile);
  validateProductProfileCodexDefaults(profile);
  validateFullFirstInstallCoreReadyPolicy(profile);
  validateStandardPackagePolicy(profile);
  validateCommandLineToolsPolicy(profile);
  validateStandardUpdatePolicy(profile);
  validateCompanionPayloadAuthority(profile, installExposurePolicy);
  validateProductProfileBoundary(profile);
}

function runCommand(entry, contract, shellPaths) {
  const cwd = resolveValidationCwd(entry, contract, shellPaths);
  console.log(`\n==> ${entry.id}: ${entry.command}`);
  const result = spawnSync(entry.command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Validation command failed: ${entry.id}`);
  }
}

const args = parseArgs(process.argv);
const contract = readAppShellAdapterContract();
const shellPaths = resolveActiveShellPaths({ contract });
const guiProductContract = readJson(guiProductContractPath);
const runtimeBridge = readJson(runtimeBridgePath);
const pageStateMatrix = readJson(pageStateMatrixPath);
const firstRunMatrix = readJson(firstRunMatrixPath);
const releaseChannel = readJson(releaseChannelPath);
const installExposurePolicy = readJson(installExposurePolicyPath);
validateContractShape(contract);
validateRuntimeBridgeContract(runtimeBridge, contract);
validateInstallExposurePolicy(installExposurePolicy);
validateAppGuiProductContract(guiProductContract, releaseChannel, installExposurePolicy);
validatePageStateMatrix(pageStateMatrix, contract);
validateFirstRunMatrix(firstRunMatrix, contract);
validateProductProfile(readJson(productProfilePath), installExposurePolicy);
validateReleaseEvidenceBundle(releaseChannel, pageStateMatrix, firstRunMatrix);
validateActiveShellImplementation(shellPaths);
validateLiveOplConformance(runtimeBridge);

if (args.quick) {
  console.log('Active shell contract is structurally valid.');
  process.exit(0);
}

const commands = contract.validation_commands.filter((entry) => args.only.size === 0 || args.only.has(entry.id));
if (commands.length === 0) {
  throw new Error(`No validation commands selected by --only=${[...args.only].join(',')}`);
}

for (const command of commands) {
  runCommand(command, contract, shellPaths);
}

console.log('\nActive shell validation passed.');
