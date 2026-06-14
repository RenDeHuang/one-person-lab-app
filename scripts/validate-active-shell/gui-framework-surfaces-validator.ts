import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { appOwnedProjectGroupExpansionPolicy } from './app-contract-constants.ts';
import { managedUpdateIpcSurfaces } from './managed-update-plane-validator.ts';
import {
  validateArtifactNativeDrilldownProjectionContract,
  validateProviderReadinessRepairProjectionContract,
  validateStateIndexSidecarProjectionContract,
} from './shared-contract-validators.ts';
import { assertCommandSurface } from './value-helpers.ts';

export function validateGuiFrameworkSurfaces(guiContract, releaseChannel, installExposurePolicy) {
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
}
