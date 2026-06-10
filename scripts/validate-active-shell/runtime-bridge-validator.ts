import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { forbiddenAuthorityOwners } from './app-contract-constants.ts';
import { isDefaultReleaseAdapter } from './active-shell-contract.ts';
import { assertFile, commandMaxBuffer, root } from './validation-config.ts';
import { assertCommandSurface, lookupPath } from './value-helpers.ts';
import {
  validateActiveProjectLineProjectionContract,
  validateArtifactNativeDrilldownFixture,
  validateArtifactNativeDrilldownProjectionContract,
  validateProviderReadinessRepairProjectionContract,
  validateProjectProgressDisplayContract,
  validateStageRunCockpitFixture,
  validateStageRunCockpitProjectionContract,
  validateStateIndexSidecarFixture,
  validateStateIndexSidecarProjectionContract,
  validateUserTaskStatusProjectionContract,
} from './shared-contract-validators.ts';

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
  validateCurrentOwnerDeltaCockpitFixture(fixture);
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
  const stateIndexSidecarExample = taskDrilldowns.find((task) => task?.state_index_sidecar_projection);
  if (!stateIndexSidecarExample) {
    throw new Error('OPL App state golden fixture must include a State Index sidecar read-model projection example.');
  }
  validateStateIndexSidecarFixture(
    stateIndexSidecarExample.state_index_sidecar_projection,
    'OPL App state golden fixture State Index sidecar projection',
  );
  const artifactNativeDrilldownExample = taskDrilldowns.find((task) => task?.artifact_native_drilldown);
  if (!artifactNativeDrilldownExample) {
    throw new Error('OPL App state golden fixture must include a Stage Artifact refs-only drilldown example.');
  }
  validateArtifactNativeDrilldownFixture(
    artifactNativeDrilldownExample.artifact_native_drilldown,
    'OPL App state golden fixture Stage Artifact drilldown',
  );
  const stageRunCockpitExample = taskDrilldowns.find(
    (task) => task?.stage_run_cockpit || task?.stage_run_current_owner_delta,
  );
  if (!stageRunCockpitExample) {
    throw new Error('OPL App state golden fixture must include a refs-only StageRun cockpit projection example.');
  }
  validateStageRunCockpitFixture(
    stageRunCockpitExample,
    'OPL App state golden fixture StageRun cockpit projection',
  );
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

function validateCurrentOwnerDeltaCockpitFixture(fixture) {
  const label = 'OPL App state golden fixture current_owner_delta cockpit';
  const defaultReadSurfacePolicy = lookupPath(fixture, 'app_state.operator.default_read_surface_policy');
  const currentOwnerDelta = lookupPath(fixture, 'app_state.operator.current_owner_delta');
  const currentOwnerDeltaNextAction = lookupPath(fixture, 'app_state.operator.current_owner_delta_next_action');
  const ordinaryCockpit = lookupPath(fixture, 'app_state.operator.ordinary_cockpit');

  if (!defaultReadSurfacePolicy || typeof defaultReadSurfacePolicy !== 'object') {
    throw new Error(`${label} must include app_state.operator.default_read_surface_policy`);
  }
  if (!currentOwnerDelta || typeof currentOwnerDelta !== 'object') {
    throw new Error(`${label} must include app_state.operator.current_owner_delta`);
  }
  if (!currentOwnerDeltaNextAction || typeof currentOwnerDeltaNextAction !== 'object') {
    throw new Error(`${label} must include app_state.operator.current_owner_delta_next_action`);
  }
  if (!ordinaryCockpit || typeof ordinaryCockpit !== 'object') {
    throw new Error(`${label} must include app_state.operator.ordinary_cockpit`);
  }

  for (const [pathName, expected] of Object.entries({
    'app_state.operator.operator_next_action_source': 'current_owner_delta',
    'app_state.operator.default_read_surface_policy.default_operator_payload': 'ordinary_cockpit',
    'app_state.operator.default_read_surface_policy.default_planning_root': 'current_owner_delta',
    'app_state.operator.default_read_surface_policy.authority_boundary.raw_worklist_can_generate_default_next_action': false,
    'app_state.operator.default_read_surface_policy.authority_boundary.raw_evidence_can_generate_default_next_action': false,
    'app_state.operator.default_read_surface_policy.authority_boundary.can_claim_app_release_ready': false,
    'app_state.operator.default_read_surface_policy.authority_boundary.can_claim_production_ready': false,
    'app_state.operator.current_owner_delta.default_planning_root': 'current_owner_delta',
    'app_state.operator.current_owner_delta.ordinary_progress_spine.default_next_action_derives_from': 'current_owner_delta',
    'app_state.operator.current_owner_delta.ordinary_progress_spine.raw_worklist_can_generate_default_next_action': false,
    'app_state.operator.current_owner_delta.authority_boundary.raw_worklist_can_drive_default_planning': false,
    'app_state.operator.current_owner_delta.authority_boundary.can_claim_production_ready': false,
    'app_state.operator.current_owner_delta_next_action.derivation_source': 'current_owner_delta',
    'app_state.operator.current_owner_delta_next_action.default_planning_root': 'current_owner_delta',
    'app_state.operator.current_owner_delta_next_action.raw_worklist_can_drive_default_planning': false,
    'app_state.operator.current_owner_delta_next_action.can_claim_domain_ready': false,
    'app_state.operator.current_owner_delta_next_action.can_claim_production_ready': false,
    'app_state.operator.current_owner_delta_next_action.worklist_item_is_completion_claim': false,
    'app_state.operator.ordinary_cockpit.surface_kind': 'opl_app_ordinary_cockpit',
    'app_state.operator.ordinary_cockpit.display_payload_policy': 'purpose_task_current_owner_next_action_artifact_or_blocker_only',
    'app_state.operator.ordinary_cockpit.ordinary_progress_spine.default_next_action_derives_from': 'current_owner_delta',
    'app_state.operator.ordinary_cockpit.ordinary_progress_spine.raw_worklist_can_generate_default_next_action': false,
    'app_state.operator.ordinary_cockpit.display_payload.next_action.source_ref': 'app_state.operator.current_owner_delta',
    'app_state.operator.ordinary_cockpit.display_payload.artifact_or_blocker.content_policy': 'refs_only_no_artifact_or_receipt_body',
    'app_state.operator.ordinary_cockpit.authority_boundary.default_planning_root': 'current_owner_delta',
    'app_state.operator.ordinary_cockpit.authority_boundary.default_next_action_derives_from': 'derive_default_next_action_only_from_current_owner_delta',
    'app_state.operator.ordinary_cockpit.authority_boundary.can_claim_app_release_ready': false,
    'app_state.operator.ordinary_cockpit.authority_boundary.can_claim_production_ready': false,
  })) {
    const actual = lookupPath(fixture, pathName);
    if (actual !== expected) {
      throw new Error(`${label} ${pathName} must be ${expected}`);
    }
  }

  assertIncludesAll(
    currentOwnerDelta.ordinary_progress_spine?.default_next_action_must_not_derive_from,
    ['raw_worklist', 'raw_evidence', 'provider_trace', 'replay_packet', 'typed_blocker_group', 'private_residue_inventory', 'audit_sidecar'],
    `${label} current owner delta forbidden next-action sources`,
  );
  assertIncludesAll(
    ordinaryCockpit.display_payload_fields,
    ['purpose', 'task', 'current_owner', 'next_action', 'artifact_or_blocker'],
    `${label} ordinary cockpit display payload fields`,
  );
  assertIncludesAll(
    ordinaryCockpit.developer_full_drilldown_only,
    ['provider', 'ledger', 'worklist', 'mcp_tool_catalog', 'raw_receipts', 'release_evidence'],
    `${label} ordinary cockpit drilldown-only fields`,
  );
  for (const forbidden of [
    'raw_worklist',
    'raw_evidence',
    'provider_trace',
    'release_evidence',
    'app_release_ready',
    'production_ready',
    'domain_ready',
  ]) {
    if (Object.hasOwn(ordinaryCockpit.display_payload ?? {}, forbidden)) {
      throw new Error(`${label} ordinary cockpit display_payload must not include ${forbidden}`);
    }
  }
}

export function validateLiveOplConformance(runtimeBridge) {
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

export function validateRuntimeBridgeContract(runtimeBridge, contract) {
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
    default_operator_payload: 'current_owner_delta',
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
  if ('compatibility_operator_payload' in runtimeBridge) {
    throw new Error('Runtime bridge must not declare compatibility_operator_payload');
  }
  const defaultReadSurfacePolicy = runtimeBridge.default_read_surface_policy;
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
    if (defaultReadSurfacePolicy?.[field] !== expected) {
      throw new Error(`Runtime bridge default_read_surface_policy.${field} must be ${expected}`);
    }
  }
  if (defaultReadSurfacePolicy && 'compatibility_projection' in defaultReadSurfacePolicy) {
    throw new Error('Runtime bridge default_read_surface_policy must not declare compatibility_projection');
  }
  for (const field of [
    'next_safe_action_or_none',
    'current_owner',
    'required_delta',
    'accepted_return_shapes',
    'readiness_false_flags',
    'count_summary',
  ]) {
    if (!defaultReadSurfacePolicy?.first_screen_answers?.includes(field)) {
      throw new Error(`Runtime bridge default_read_surface_policy.first_screen_answers must include ${field}`);
    }
  }
  for (const field of [
    'runtime_tray_snapshot',
    'raw_evidence_envelope',
    'stage_replay_packet_body',
    'private_residue_inventory_body',
    'provider_internal_ledger_body',
  ]) {
    if (!defaultReadSurfacePolicy?.forbidden_default_state_fields?.includes(field)) {
      throw new Error(`Runtime bridge default_read_surface_policy.forbidden_default_state_fields must include ${field}`);
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
  validateProviderReadinessRepairProjectionContract(
    runtimeBridge.provider_readiness_repair_projection,
    'Runtime bridge provider readiness repair projection',
  );
  validateStateIndexSidecarProjectionContract(
    runtimeBridge.state_index_sidecar_projection,
    'Runtime bridge State Index sidecar projection',
  );
  validateArtifactNativeDrilldownProjectionContract(
    runtimeBridge.artifact_native_drilldown_projection,
    'Runtime bridge Stage Artifact drilldown projection',
  );
  validateStageRunCockpitProjectionContract(
    runtimeBridge.stage_run_cockpit_projection,
    'Runtime bridge StageRun cockpit projection',
  );
  for (const [field, expected] of Object.entries({
    shell_adapter_can_own_runtime_truth: false,
    app_can_own_runtime_truth: false,
    app_can_write_domain_truth: false,
    app_can_read_artifact_body: false,
    app_can_read_memory_body: false,
    app_can_authorize_quality_verdict: false,
    app_can_authorize_export_verdict: false,
    app_can_write_sqlite_sidecar: false,
    app_can_mutate_state_index_kernel: false,
    app_can_write_owner_receipt: false,
    app_can_authorize_readiness: false,
    app_can_authorize_artifact_authority: false,
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
    direct_sqlite_sidecar_reads_are_forbidden: true,
    direct_state_index_kernel_writes_are_forbidden: true,
  })) {
    if (runtimeBridge.replacement_policy?.[field] !== expected) {
      throw new Error(`Runtime bridge replacement_policy.${field} must be ${expected}`);
    }
  }
  for (const forbidden of [
    'direct_domain_repo_reads',
    'direct_runtime_state_file_reads',
    'direct_opl_internal_state_file_reads',
    'direct_opl_sqlite_sidecar_reads',
    'direct_state_index_kernel_file_reads',
    'direct_state_index_kernel_writes',
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
