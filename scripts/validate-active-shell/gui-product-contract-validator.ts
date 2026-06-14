import { assertDeepEqualJson, assertForbiddenCapabilityPolicy, assertIncludesAll } from './assertions.ts';
import {
  appOwnedDeveloperProfileCapabilityAxes,
  appOwnedGuiContractOrdinaryConversation,
  appOwnedHomeLayout,
  appOwnedProjectGroupExpansionPolicy,
  appOwnedRightContextInspectorTabIds,
  appOwnedSettingsTabs,
  beginnerFirstRunTestIds,
  firstRunChecklistFields,
  firstRunCoreItems,
  firstRunProgressFields,
  firstRunProgressSourceCommand,
  firstRunProgressSourcePath,
  firstRunProgressVisibleElements,
  firstRunRendererTruthPolicy,
  firstRunSetupFlowFields,
  fullReadinessItems,
  homeActivityCenterForbiddenDisplays,
  legacySettingsRouteRedirects,
  ordinaryHiddenLegacySettingsTabs,
  settingsPageExpectations,
} from './app-contract-constants.ts';
import { assertCommandSurface } from './value-helpers.ts';
import {
  managedUpdateIpcSurfaces,
  validateManagedUpdatePageBasics,
  validateManagedUpdatePlaneBinding,
} from './managed-update-plane-validator.ts';
import {
  validateArtifactNativeDrilldownProjectionContract,
  validateBeginnerFirstRunPresentation,
  validateOplFlowContext,
  validateProviderReadinessRepairProjectionContract,
  validateProgressDeltaDisplayContract,
  validateStateIndexSidecarProjectionContract,
  validateUserTaskStatusProjectionContract,
} from './shared-contract-validators.ts';

const ordinaryForbiddenCapabilityPolicy = {
  forbidden_mcp_matchers: {
    exact: ['aionui-team'],
    prefixes: ['team_', 'mcp__aionui-team'],
    contains: ['aionui-team'],
  },
  scrub_extra_keys: [
    'team_mcp_stdio_config',
    'team_id',
    'teamId',
    'team_lead_team_id',
    'team_lead_team_slot_id',
    'team_lead_conversation_id',
    'tl',
  ],
};

const aionuiTeamProbeIds = [
  'team_mode_disabled',
  'team_route_redirect',
  'team_sidebar_gate',
  'team_created_redirect_noop',
  'ordinary_conversation_team_snapshot_scrub',
  'agent_switching_drops_team_mcp',
  'team_deep_link_not_whitelisted',
  'team_bridge_mutation_gate',
];

function validateManagedUpdatePageSurface(page, label) {
  validateManagedUpdatePageBasics(page, label, {
    actionSourceError: `${label} must expose managed update actions through the shell IPC bridge`,
  });
  validateManagedUpdatePlaneBinding(page?.managed_update_plane, label, {
    requirePageId: true,
    requireStateSources: true,
    requireStatusConsumptionPolicy: true,
    bindingError: `${label} must bind to the App managed update plane as a status/action consumer`,
  });
}

export function validateAppGuiProductContract(guiContract, releaseChannel, installExposurePolicy) {
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

  const managedUpdateSurface = guiContract.framework_surfaces?.managed_update_plane;
  if (
    managedUpdateSurface?.contract !== 'contracts/app-release-channel.json#managed_update_plane' ||
    managedUpdateSurface?.status_command !== 'opl update status --json' ||
    managedUpdateSurface?.app_state_source !== 'opl app state --profile fast --json#managed_update_plane' ||
    managedUpdateSurface?.app_role !== 'status_conditions_repair_actions_consumer_only' ||
    managedUpdateSurface?.framework_role !== 'managed_update_kernel_owner' ||
    managedUpdateSurface?.artifact_body_access !== false ||
    managedUpdateSurface?.domain_truth_write_access !== false ||
    managedUpdateSurface?.owner_receipt_write_access !== false ||
    managedUpdateSurface?.quality_verdict_authority !== false ||
    managedUpdateSurface?.export_verdict_authority !== false ||
    managedUpdateSurface?.global_tool_mutation_allowed !== false ||
    managedUpdateSurface?.developer_checkout_mutation_allowed !== false
  ) {
    throw new Error('App GUI contract must expose the managed update plane without kernel, artifact, domain, verdict, global tool, or checkout authority');
  }
  assertDeepEqualJson(
    managedUpdateSurface.ipc_bridge_required,
    managedUpdateIpcSurfaces,
    'App GUI managed update IPC bridge',
  );
  if (managedUpdateSurface.background_scheduler_required !== 'startup_daily_and_manual_check_with_lock_and_backoff') {
    throw new Error('App GUI managed update surface must require startup/daily/manual scheduling with lock/backoff');
  }
  assertDeepEqualJson(
    managedUpdateSurface.allowed_cli_commands,
    releaseChannel.managed_update_plane.shell_integration.allowed_cli_commands,
    'App GUI managed update allowed CLI commands',
  );
  assertDeepEqualJson(
    managedUpdateSurface.forbidden_shell_behaviors,
    releaseChannel.managed_update_plane.shell_integration.forbidden_shell_behaviors,
    'App GUI managed update forbidden shell behaviors',
  );

  assertCommandSurface(guiContract.framework_surfaces?.canonical_state?.default_command, 'opl app state --profile fast --json', 'App GUI default state command');
  assertCommandSurface(guiContract.framework_surfaces.canonical_state.refresh_command, 'opl app state --profile fast --json', 'App GUI refresh state command');
  if (guiContract.framework_surfaces.canonical_state.default_operator_payload !== 'current_owner_delta') {
    throw new Error('App GUI default operator payload must be current_owner_delta');
  }
  if ('compatibility_operator_payload' in guiContract.framework_surfaces.canonical_state) {
    throw new Error('App GUI canonical state must not declare compatibility_operator_payload');
  }
  if (guiContract.framework_surfaces.canonical_state.default_profile !== 'fast') {
    throw new Error('App GUI default state profile must be fast');
  }
  if (guiContract.framework_surfaces.canonical_state.manual_refresh_profile !== 'fast') {
    throw new Error('App GUI manual refresh profile must be fast');
  }
  if (guiContract.framework_surfaces.canonical_state.full_profile_policy !== 'diagnostic_or_release_evidence_only') {
    throw new Error('App GUI full state profile must be reserved for diagnostics or release evidence');
  }
  const guiDefaultReadPolicy = guiContract.framework_surfaces.canonical_state.default_read_surface_policy;
  for (const [field, expected] of Object.entries({
    default_projection: 'opl_current_owner_delta',
    source_path: 'app_state.operator.default_read_surface_policy',
    foundry_agent_os_cockpit_policy: 'first_screen_current_owner_delta_only_raw_worklist_evidence_provider_trace_drilldown_only',
    default_next_action_source: 'current_owner_delta',
    raw_worklist_generates_default_next_action: false,
    release_evidence_counts_as_release_ready: false,
    stage_run_cockpit_projection_ref: 'contracts/app-runtime-bridge.json#stage_run_cockpit_projection',
    full_detail_policy: 'explicit_full_detail_or_lazy_diagnostic_only',
    raw_refs_policy: 'raw_refs_require_explicit_full_detail',
    full_detail_auto_poll: false,
    shell_must_not_use_full_drilldown_as_normal_state: true,
    shell_must_not_derive_layout_from_raw_runtime_projection: true,
  })) {
    if (guiDefaultReadPolicy?.[field] !== expected) {
      throw new Error(`App GUI default_read_surface_policy.${field} must be ${expected}`);
    }
  }
  if (guiDefaultReadPolicy && 'compatibility_projection' in guiDefaultReadPolicy) {
    throw new Error('App GUI default_read_surface_policy must not declare compatibility_projection');
  }
  for (const field of [
    'next_safe_action_or_none',
    'current_owner',
    'required_delta',
    'accepted_return_shapes',
    'readiness_false_flags',
    'count_summary',
  ]) {
    if (!guiDefaultReadPolicy?.first_screen_answers?.includes(field)) {
      throw new Error(`App GUI default_read_surface_policy.first_screen_answers must include ${field}`);
    }
  }
  for (const field of [
    'runtime_tray_snapshot',
    'raw_evidence_envelope',
    'stage_replay_packet_body',
    'private_residue_inventory_body',
    'provider_internal_ledger_body',
  ]) {
    if (!guiDefaultReadPolicy?.forbidden_default_state_fields?.includes(field)) {
      throw new Error(`App GUI default_read_surface_policy.forbidden_default_state_fields must include ${field}`);
    }
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
  validateStateIndexSidecarProjectionContract(
    guiContract.framework_surfaces.state_index_sidecar,
    'App GUI State Index sidecar framework surface',
  );
  validateArtifactNativeDrilldownProjectionContract(
    guiContract.framework_surfaces.artifact_native_drilldown,
    'App GUI Stage Artifact drilldown framework surface',
  );
  const guiStageRunCockpit = guiContract.framework_surfaces.stage_run_cockpit;
  for (const [field, expected] of Object.entries({
    projection_ref: 'contracts/app-runtime-bridge.json#stage_run_cockpit_projection',
    source: 'app_state.operator.workbench.task_drilldowns.stage_run_cockpit + app_state.operator.workbench.task_drilldowns.stage_run_cockpit_summary',
    equivalent_source: 'app_state.operator.workbench.task_drilldowns.stage_run_current_owner_delta',
    derived_from: 'current_owner_delta',
    display_policy: 'refs_only_stage_run_cockpit_display_guard_no_runtime_truth_claims',
    ordinary_fast_state_required: true,
    app_role: 'display_only_stage_run_cockpit_consumer',
  })) {
    if (guiStageRunCockpit?.[field] !== expected) {
      throw new Error(`App GUI StageRun cockpit ${field} must be ${expected}`);
    }
  }
  validateProviderReadinessRepairProjectionContract(
    guiContract.framework_surfaces.provider_readiness_repair,
    'App GUI provider readiness repair framework surface',
    { requireProjectionRef: true },
  );
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
    [
      'task title',
      'task status',
      'task stage',
      'progress label',
      'next step',
      'next owner',
      'owner',
      'accepted answer shape',
      'artifact or blocker',
      'last progress',
    ],
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
    runtimeDefaultAttention?.project_group_expansion_policy,
    appOwnedProjectGroupExpansionPolicy,
    'App GUI runtime default attention project_group_expansion_policy',
  );
  assertDeepEqualJson(
    runtimeDefaultAttention?.must_not_default_display_terms,
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
    'App GUI runtime default attention forbidden default terms',
  );
  assertDeepEqualJson(
    guiContract.ordinary_cockpit_surface_budget,
    {
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
      ordinary_must_not_default_display_terms: [
        'Temporal',
        'provider',
        'ledger',
        'projection',
        'stage attempt',
        'AionUI',
        'backend selector',
        'shell candidate',
        'runtime implementation selector',
      ],
      diagnostics_escape_hatch: 'Advanced, release evidence, developer detail, or explicit full-detail drilldown only',
      source_policy: 'ordinary views consume opl app state --profile fast --json and must not derive first-screen layout from raw runtime drilldown',
    },
    'App GUI ordinary cockpit surface budget',
  );
  for (const forbiddenSource of [
    'direct opl connect modules --json page aggregation',
    'direct opl system developer-supervisor page aggregation',
    'direct opl family-runtime worker status page aggregation',
    'application.systemInfo as OPL path truth',
    'application.appVersions as OPL release truth',
    'direct reads of OPL internal state files',
    'direct reads of OPL SQLite sidecar files',
    'direct State Index Kernel writes',
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
  assertIncludesAll(
    guiContract.settings_navigation?.ordinary_hidden_upstream_surfaces,
    ['AionUI Team', 'Team nav entry', 'Team leader configuration', 'team deep link navigation'],
    'App GUI settings hidden upstream surfaces',
  );
  for (const [field, expected] of Object.entries({
    ordinary_visible: false,
    route_policy: 'disabled_or_redirect_to_app_owned_home',
    deep_link_policy: 'not_whitelisted',
    rationale: 'upstream AionUI Team is configured around shell-local agents and is not an OPL ordinary-user capability',
  })) {
    if (guiContract.settings_navigation?.team_surface_policy?.[field] !== expected) {
      throw new Error(`App GUI settings team_surface_policy.${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    guiContract.settings_navigation.team_surface_policy.required_probes,
    aionuiTeamProbeIds,
    'App GUI Team surface required probes',
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
    'whether a module comes from the App/CLI-managed GHCR agent package channel',
    'whether a module comes from the App/CLI-managed GHCR agent package channel moving tags',
    'whether a module comes from a local domain repository checkout',
    'whether Developer Profile source_channel uses a GitHub repo or local checkout',
    'whether a module is managed by App/CLI maintenance',
    'that module path display is refs-only and not domain truth authority',
  ]) {
    if (!modulePathPolicy.must_explain?.includes(explanation)) {
      throw new Error(`App GUI module path source policy must explain ${explanation}`);
    }
  }
  if (
    modulePathPolicy.ordinary_user_source !== 'app_cli_managed_ghcr_agent_package_channel' ||
    modulePathPolicy.ordinary_user_transport !== 'app_cli_managed'
  ) {
    throw new Error('App GUI module path source policy must keep ordinary users on App/CLI-managed package maintenance');
  }
  if (modulePathPolicy.developer_override_surface !== 'Developer Profile source_channel capability') {
    throw new Error('App GUI module path source policy must route repo/checkout override through Developer Profile source_channel');
  }
  if (modulePathPolicy.developer_override_policy !== 'explicit_opt_in_only') {
    throw new Error('App GUI module path source policy must require explicit opt-in for Developer Profile checkout override');
  }
  if (modulePathPolicy.developer_profile_ref !== 'developer_profile.capabilities.source_channel') {
    throw new Error('App GUI module path source policy must link to Developer Profile source_channel');
  }
  if (!modulePathPolicy.must_not_use?.includes('raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI')) {
    throw new Error('App GUI module path source policy must not expose raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI');
  }

  const developerProfile = guiContract.developer_profile;
  if (!developerProfile || typeof developerProfile !== 'object') {
    throw new Error('App GUI contract must declare Developer Profile capabilities');
  }
  assertDeepEqualJson(
    developerProfile.capability_axes,
    appOwnedDeveloperProfileCapabilityAxes,
    'App GUI Developer Profile capability axes',
  );
  if (
    developerProfile.default_profile !== 'standard_user' ||
    developerProfile.opt_in_policy !== 'explicit_opt_in_only' ||
    developerProfile.ordinary_user_defaults?.source_channel !== 'agent_latest_package_channel' ||
    developerProfile.ordinary_user_defaults?.agent_automation !== 'silent_background_agent_package_updates'
  ) {
    throw new Error('App GUI Developer Profile must preserve standard user defaults and explicit opt-in');
  }
  for (const axis of appOwnedDeveloperProfileCapabilityAxes) {
    const capability = developerProfile.capabilities?.[axis];
    if (!capability?.standard_default || !capability.developer_opt_in || !capability.display_policy) {
      throw new Error(`App GUI Developer Profile capability ${axis} must declare defaults, opt-in, and display policy`);
    }
  }
  if (
    developerProfile.capabilities.source_channel.developer_opt_in !== 'github_repo_or_local_checkout' ||
    developerProfile.capabilities.agent_automation.standard_default !== 'silent_background_agent_package_updates' ||
    developerProfile.capabilities.runtime_mutation_scope.standard_default !== 'app_action_route_only' ||
    'legacy_developer_mode_alias' in developerProfile ||
    !developerProfile.must_not_show?.includes('single Developer Mode switch as the only capability expression')
  ) {
    throw new Error('App GUI Developer Profile must display capabilities without legacy Developer Mode aliases');
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
  if (
    guiContract.ordinary_capability_selector_policy?.scope !== 'home_composer_and_ordinary_conversation' ||
    guiContract.ordinary_capability_selector_policy?.authority !== 'app_owned_opl_allowlist' ||
    guiContract.ordinary_capability_selector_policy?.skill_source_ref !==
      'assistant_skill_profiles.required_skills + optional_skills' ||
    guiContract.ordinary_capability_selector_policy?.mcp_menu_policy !==
      'empty_until_app_explicitly_whitelists_opl_mcp_servers' ||
    guiContract.ordinary_capability_selector_policy?.conversation_loaded_skill_display_policy !==
      'filter_to_ordinary_skill_allowlist' ||
    guiContract.ordinary_capability_selector_policy?.conversation_loaded_mcp_display_policy !==
      'filter_to_visible_mcp_server_ids'
  ) {
    throw new Error('App GUI ordinary capability selector must be an App-owned OPL allowlist');
  }
  assertDeepEqualJson(
    guiContract.ordinary_capability_selector_policy.visible_mcp_server_ids,
    [],
    'App GUI ordinary MCP allowlist',
  );
  assertIncludesAll(
    guiContract.ordinary_capability_selector_policy.forbidden_skill_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator', 'cron'],
    'App GUI ordinary selector forbidden skills',
  );
  assertIncludesAll(
    guiContract.ordinary_capability_selector_policy.forbidden_mcp_examples,
    ['aionui-team', 'team_*', 'mcp__aionui-team*', 'team_mcp_stdio_config', 'team_id/teamId'],
    'App GUI ordinary selector forbidden MCP examples',
  );
  assertForbiddenCapabilityPolicy(
    guiContract.ordinary_capability_selector_policy,
    ordinaryForbiddenCapabilityPolicy,
    'App GUI ordinary selector forbidden MCP policy',
  );
  assertDeepEqualJson(
    guiContract.ordinary_capability_selector_policy.required_scrub_targets,
    [
      'mcp_servers entries matching forbidden_mcp_matchers',
      'mcp_statuses entries matching forbidden_mcp_matchers',
      'session_mcp_servers entries matching forbidden_mcp_matchers',
      'scrub_extra_keys',
    ],
    'App GUI ordinary selector Team scrub targets',
  );
  if (
    guiContract.ordinary_capability_selector_policy.conversation_snapshot_policy !==
    'scrub_disabled_team_mcp_and_team_metadata_before_rendering_or_inheriting_ordinary_conversations'
  ) {
    throw new Error('App GUI ordinary selector must scrub disabled Team MCP snapshots from ordinary conversations');
  }
  assertIncludesAll(
    pages.guid_home.must_show,
    ['ordinary skill selector filtered to App-owned assistant profile skill allowlist'],
    'App GUI home ordinary selector must_show',
  );
  assertIncludesAll(
    pages.guid_home.must_not_show,
    [
      'AionUI implementation skills such as aionui-skills',
      'unknown MCP servers without an App profile allowlist entry',
      'AionUI Team MCP tools such as team_members, team_list_models, and team_spawn_agent',
    ],
    'App GUI home ordinary selector must_not_show',
  );
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
  if (pages.settings_advanced.sections?.includes('opl_agent_codex_context')) {
    throw new Error('Settings Advanced must not retain legacy opl_agent_codex_context as an active section');
  }
  if ((pages.settings_advanced.legacy_state_sections ?? []).length > 0) {
    throw new Error('Settings Advanced legacy state sections must be retired');
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
  if (pages.settings_environment.managed_update_plane_ref !== 'managed_update_plane') {
    throw new Error('Settings Environment must reference the managed update plane');
  }
  if (!pages.about.must_show?.includes('Stable or Nightly channel')) {
    throw new Error('About page must show Stable or Nightly channel');
  }
  if (!pages.about.must_show?.includes('Updates & Maintenance entry on About & Updates')) {
    throw new Error('About page must link to Updates & Maintenance');
  }
  if (pages.about.managed_update_plane_ref !== 'managed_update_plane') {
    throw new Error('About page must reference the managed update plane');
  }
  validateManagedUpdatePageSurface(pages.update, 'App GUI Updates & Maintenance page');
  if (!pages.settings_theme.must_show?.includes('Default theme option') || !pages.settings_theme.must_show?.includes('Codex theme option')) {
    throw new Error('Settings theme page must show default and Codex theme options');
  }
  validateProgressDeltaDisplayContract(
    pages.runtime_status.progress_delta_policy,
    'App GUI runtime status progress delta policy',
  );
  validateStateIndexSidecarProjectionContract(
    pages.runtime_status.state_index_sidecar_policy,
    'App GUI runtime status State Index sidecar policy',
  );
  validateArtifactNativeDrilldownProjectionContract(
    pages.runtime_status.artifact_native_drilldown_policy,
    'App GUI runtime status Stage Artifact drilldown policy',
  );
  if (pages.runtime_status.primary_projection !== 'app_state.operator user task status projection') {
    throw new Error('App GUI runtime status must default to the user task status projection');
  }
  if (pages.runtime_status.default_state_source !== 'opl app state --profile fast --json') {
    throw new Error('App GUI runtime status default source must be fast App state');
  }
  if (pages.runtime_status.diagnostic_source !== 'opl runtime app-operator-drilldown --json') {
    throw new Error('App GUI runtime status diagnostic source must be operator drilldown');
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
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'non-running waiting or stopped projects collapsed by default',
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
