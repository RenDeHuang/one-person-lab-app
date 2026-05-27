#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readAppShellAdapterContract, resolveActiveShellPaths } from './app-shell-adapter.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = path.join(root, 'contracts', 'app-shell-adapter.json');
const guiProductContractPath = path.join(root, 'contracts', 'app-gui-product-contract.json');
const runtimeBridgePath = path.join(root, 'contracts', 'app-runtime-bridge.json');
const pageStateMatrixPath = path.join(root, 'contracts', 'app-page-state-matrix.json');
const firstRunMatrixPath = path.join(root, 'contracts', 'app-first-run-test-matrix.json');
const productProfilePath = path.join(root, 'contracts', 'app-product-profile.json');
const releaseChannelPath = path.join(root, 'contracts', 'app-release-channel.json');
const commandMaxBuffer = 128 * 1024 * 1024;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
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

function validateContractShape(contract) {
  if (contract.app_repo !== 'gaofeng21cn/one-person-lab-app') {
    throw new Error(`Unexpected app_repo: ${contract.app_repo}`);
  }
  if (contract.shell_source?.owner_repo !== 'gaofeng21cn/opl-aion-shell') {
    throw new Error(`Unexpected shell_source owner: ${contract.shell_source?.owner_repo}`);
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
  for (const allowed of [
    'concrete renderer implementation',
    'process and preload implementation',
    'shell package metadata',
    'shell tests and release hooks',
    'upstream AionUI intake',
  ]) {
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
    'declare candidate in contracts/app-shell-adapter.json',
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
  if (contract.gui_product_contract_policy.aionui_upstream_must_not_override_app_truth !== true) {
    throw new Error('Active shell must declare that AionUI upstream cannot override App truth');
  }
  const stateSurface = contract.state_surface_contract;
  for (const [field, expected] of Object.entries({
    primary_read_command: 'opl app state --profile fast --json',
    refresh_read_command: 'opl app state --profile full --json',
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
  for (const [pathName, label] of Object.entries({
    'app_state.operator.workbench.summary_cards': 'summary cards',
    'app_state.operator.workbench.sections': 'sections',
    'app_state.operator.workbench.action_queue.items': 'action queue items',
    'app_state.operator.workbench.domain_lane_map.lanes': 'domain lanes',
    'app_state.operator.workbench.task_drilldowns': 'task drilldowns',
    'app_state.operator.workbench.safe_action_routes': 'safe action routes',
    'app_state.operator.workbench.lazy_refs': 'lazy refs',
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
  if (runtimeBridge.active_adapter !== contract.active_shell) {
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
  if (runtimeBridge.default_adapter_repo !== contract.shell_source?.owner_repo) {
    throw new Error(`Runtime bridge adapter repo must match active shell source: ${runtimeBridge.default_adapter_repo}`);
  }
  if (runtimeBridge.default_adapter_path !== contract.shell_root) {
    throw new Error(`Runtime bridge adapter path must match active shell root: ${runtimeBridge.default_adapter_path}`);
  }
  for (const [field, expected] of Object.entries({
    summary_command: 'opl app state --profile fast --json',
    refresh_command: 'opl app state --profile full --json',
    full_detail_command: 'opl runtime app-operator-drilldown --detail full --json',
    action_command: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
    'projection_sources.primary': 'app_state.operator.summary',
    'projection_sources.provider': 'app_state.provider',
    'projection_sources.actions': 'app_state.actions',
    'projection_sources.full_detail': 'runtime_tray_snapshot.app_operator_drilldown',
    'projection_sources.policy': 'summary_first_full_detail_on_demand',
  })) {
    const actual = field.split('.').reduce((value, key) => value?.[key], runtimeBridge);
    if (actual !== expected) {
      throw new Error(`Runtime bridge ${field} must be ${expected}`);
    }
  }
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

function validateAppGuiProductContract(guiContract, releaseChannel) {
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

  assertCommandSurface(guiContract.framework_surfaces?.canonical_state?.default_command, 'opl app state --profile fast --json', 'App GUI default state command');
  assertCommandSurface(guiContract.framework_surfaces.canonical_state.refresh_command, 'opl app state --profile full --json', 'App GUI refresh state command');
  if (guiContract.framework_surfaces.canonical_state.default_profile !== 'fast') {
    throw new Error('App GUI default state profile must be fast');
  }
  if (guiContract.framework_surfaces.canonical_state.manual_refresh_profile !== 'full') {
    throw new Error('App GUI manual refresh profile must be full');
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
  const assistants = new Map((guiContract.default_assistants ?? []).map((assistant) => [assistant.id, assistant]));
  for (const assistantId of ['mas', 'mag', 'rca', 'oma']) {
    const assistant = assistants.get(assistantId);
    if (!assistant) {
      throw new Error(`App GUI contract missing default assistant ${assistantId}`);
    }
    if (assistant.home_entry_policy !== 'visible_click_to_start') {
      throw new Error(`Default assistant ${assistantId} must be visible click-to-start`);
    }
  }
  if (assistants.has('mds')) {
    throw new Error('MDS must not be a default App GUI assistant');
  }
  const retiredMds = (guiContract.retired_domain_agents ?? []).find((agent) => agent.id === 'mds');
  if (retiredMds?.default_display_allowed !== false) {
    throw new Error('App GUI contract must mark MDS as not default-displayed');
  }

  if (guiContract.theme_and_branding?.default_theme_id !== 'codex') {
    throw new Error('App GUI default theme must be codex');
  }
  for (const themeId of ['codex', 'default-theme']) {
    if (!guiContract.theme_and_branding.allowed_theme_ids?.includes(themeId)) {
      throw new Error(`App GUI theme list must include ${themeId}`);
    }
  }
  for (const section of ['system', 'runtime', 'about', 'update', 'theme']) {
    if (!guiContract.settings_navigation?.required_sections?.includes(section)) {
      throw new Error(`App GUI settings navigation must include ${section}`);
    }
  }
  if (guiContract.settings_navigation.source !== 'opl app state --profile fast --json') {
    throw new Error('App GUI settings navigation must default to fast App state');
  }
  if (guiContract.settings_navigation.refresh_source !== 'opl app state --profile full --json') {
    throw new Error('App GUI settings navigation refresh must use full App state');
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

  const modulePathPolicy = guiContract.module_path_source_policy;
  if (modulePathPolicy?.source !== 'app_state.modules[].source + app_state.modules[].path + app_state.paths') {
    throw new Error('App GUI module path explanation must come from App state module/path refs');
  }
  for (const explanation of [
    'whether a module comes from the bundled Full runtime payload',
    'whether a module comes from a local domain repository checkout',
    'whether a module is managed by App/CLI maintenance',
    'that module path display is refs-only and not domain truth authority',
  ]) {
    if (!modulePathPolicy.must_explain?.includes(explanation)) {
      throw new Error(`App GUI module path source policy must explain ${explanation}`);
    }
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
  for (const pageId of ['guid_home', 'settings_system', 'settings_runtime', 'about', 'update', 'settings_theme', 'runtime_status']) {
    if (!pages[pageId]) {
      throw new Error(`App GUI contract missing page ${pageId}`);
    }
  }
  for (const pageId of ['guid_home', 'settings_system', 'settings_runtime', 'about', 'update', 'settings_theme']) {
    assertCommandSurface(pages[pageId].state_source, 'opl app state --profile fast --json', `App GUI ${pageId} state source`);
    assertCommandSurface(pages[pageId].refresh_source, 'opl app state --profile full --json', `App GUI ${pageId} refresh source`);
  }
  if (!pages.guid_home.must_show?.includes('default assistants MAS/MAG/RCA/OMA as click-to-start entries')) {
    throw new Error('App GUI home must show MAS/MAG/RCA/OMA default assistants');
  }
  if (!pages.settings_system.must_show?.includes('OPL Agent Codex context')) {
    throw new Error('Settings system must show OPL Agent Codex context');
  }
  if (pages.settings_runtime.module_path_source_policy_ref !== 'module_path_source_policy') {
    throw new Error('Settings runtime must reference the App GUI module path source policy');
  }
  if (!pages.settings_runtime.must_show?.includes('module path source explanation')) {
    throw new Error('Settings runtime must show module path source explanation');
  }
  if (!pages.settings_runtime.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Settings runtime must keep MDS out of default module display');
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
  if ('docker_webui' in guiContract) {
    throw new Error('App GUI contract must not include withdrawn Docker/WebUI username, title, logo, or branding requirements');
  }
}

function validatePageStateMatrix(matrix, contract) {
  if (matrix.active_shell !== contract.active_shell || matrix.shell_root !== contract.shell_root) {
    throw new Error('Page-state matrix must target the active shell contract');
  }

  const requiredPages = new Set([
    'guid_home',
    'runtime',
    'settings_overview',
    'environment',
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
    refresh_source: 'opl app state --profile full --json',
    executor_policy_ref: 'contracts/app-gui-product-contract.json#executor_policy',
    assistant_source_ref: 'contracts/app-gui-product-contract.json#default_assistants',
    codex_only_default: true,
    executor_tab_visible_when_single_executor: false,
    primary_input_surface: 'single_card',
    nested_input_card_frames_allowed: false,
    codex_model_selector_visible: false,
    codex_model_list_visible: false,
    codex_default_model: 'gpt-5.5',
    codex_default_reasoning_effort: 'xhigh',
    codex_default_permission_mode: 'full-access',
  })) {
    if (homeViewModel[field] !== expected) {
      throw new Error(`Guid home page ${field} must be ${expected}`);
    }
  }
  for (const assistant of ['mas', 'mag', 'rca', 'oma']) {
    if (!homeViewModel.default_assistants?.includes(assistant)) {
      throw new Error(`Guid home page must include default assistant ${assistant}`);
    }
  }
  for (const visibleSignal of [
    'Codex-only default executor experience',
    'default Codex model state without a visible model tab',
    'default assistants MAS/MAG/RCA/OMA as click-to-start entries',
    'workspace selector',
    'file attachment control',
    'permission mode control',
    'send action',
  ]) {
    if (!guidHomePage.must_show.includes(visibleSignal)) {
      throw new Error(`Guid home page must show ${visibleSignal}`);
    }
  }
  for (const hiddenSignal of [
    'executor tab when Codex CLI is the only executor',
    'Codex model dropdown on new conversation',
    'retired Codex model choices',
    'nested input card frames',
  ]) {
    if (!guidHomePage.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`Guid home page must not show ${hiddenSignal}`);
    }
  }

  const appStatePages = ['settings_overview', 'environment', 'about', 'update', 'settings_theme'];
  for (const pageId of appStatePages) {
    const page = (matrix.pages ?? []).find((entry) => entry.id === pageId);
    if (!page) {
      throw new Error(`Page-state matrix is missing ${pageId}`);
    }
    if (page.machine_source !== 'opl app state --profile fast --json') {
      throw new Error(`${pageId} must default to opl app state --profile fast --json`);
    }
    if (page.refresh_source !== 'opl app state --profile full --json') {
      throw new Error(`${pageId} must refresh through opl app state --profile full --json`);
    }
  }
  const settingsOverview = (matrix.pages ?? []).find((page) => page.id === 'settings_overview');
  if (!settingsOverview?.must_show?.includes('OPL Agent Codex context')) {
    throw new Error('Settings overview must show OPL Agent Codex context');
  }
  const environmentPage = (matrix.pages ?? []).find((page) => page.id === 'environment');
  if (environmentPage?.module_path_source_policy_ref !== 'contracts/app-gui-product-contract.json#module_path_source_policy') {
    throw new Error('Environment page must reference the App GUI module path source policy');
  }
  if (!environmentPage.must_show?.includes('module path source explanation')) {
    throw new Error('Environment page must show module path source explanation');
  }
  if (!environmentPage.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Environment page must keep MDS out of default module display');
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
  ]) {
    if (!firstLaunchPage.must_show?.includes(signal)) {
      throw new Error(`First-launch readiness page must show ${signal}`);
    }
  }

  const runtimePage = (matrix.pages ?? []).find((page) => page.id === 'runtime');
  if (!runtimePage) {
    throw new Error('Page-state matrix is missing runtime page');
  }
  if (runtimePage.machine_source !== 'opl app state --profile fast --json') {
    throw new Error(`Runtime page must consume OPL App state as the summary source, got: ${runtimePage.machine_source}`);
  }
  if (runtimePage.primary_projection !== 'app_state.operator.summary') {
    throw new Error(`Runtime page primary_projection must be app_state.operator.summary, got: ${runtimePage.primary_projection}`);
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
    refresh_state_command: 'opl app state --profile full --json',
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
  if (runtimeViewModel?.role !== 'opl_runtime_status_summary') {
    throw new Error('Runtime page must declare OPL runtime status summary view model');
  }
  if (runtimeViewModel.bridge_contract !== 'contracts/app-runtime-bridge.json') {
    throw new Error(`Runtime page view model must reference app-runtime-bridge.json, got: ${runtimeViewModel.bridge_contract}`);
  }
  if (runtimeViewModel.default_mode !== 'app_state_summary_first') {
    throw new Error('Runtime page view model must default to app_state_summary_first');
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
    primary_state_source: 'opl app state --profile fast --json',
    refresh_state_source: 'opl app state --profile full --json',
    summary_source: 'app_state.operator.summary',
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
  if (runtimeViewModel.authority_boundary?.refs_only !== true) {
    throw new Error('Runtime page view model must be refs-only');
  }
  if (runtimeViewModel.authority_boundary?.non_authority_display_only !== true) {
    throw new Error('Runtime page view model must be display-only for non-authority domain refs');
  }
  const requiredEvidencePath = [
    'summary-first OPL App state read model',
    'full App state refresh',
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
    'summary-first OPL runtime status',
    'provider readiness from app_state.provider',
    'operator summary from app_state.operator',
    'safe action refs from app_state.actions',
    'summary-first OPL App state read model',
    'full detail lazy load',
    'safe app action dry-run/execute controls',
    'receipt/count refresh after execute',
    'refs-only non-authority boundary',
  ];
  for (const signal of requiredRuntimeSignals) {
    if (!runtimePage.must_show.includes(signal)) {
      throw new Error(`Runtime page must show ${signal}`);
    }
  }
  const forbiddenRuntimeOwners = [
    'runtime truth',
    'provider implementation',
    'domain truth',
    'memory body',
    'artifact body',
    'quality/readiness/export verdict',
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
  if (matrix.canonical_state_surface.refresh_command !== 'opl app state --profile full --json') {
    throw new Error('Page-state matrix canonical refresh state command must be full App state');
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
  if (bundle.missing_evidence_policy?.packaged_app_evidence_requires !== 'all_required_artifacts_present_and_verified') {
    throw new Error('Operator evidence bundle must require all artifacts before claiming packaged App evidence');
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

  const runtimePage = (pageStateMatrix.pages ?? []).find((page) => page.id === 'runtime');
  if (runtimePage?.operator_evidence_acceptance_path?.summary_state_command !== requiredArtifacts.app_state_summary.producer) {
    throw new Error('Runtime page summary state command must match release evidence bundle producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.refresh_state_command !== requiredArtifacts.app_state_full.producer) {
    throw new Error('Runtime page refresh state command must match release evidence bundle producer');
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
  for (const artifactPath of ['tart-smoke-summary.json', 'artifacts/smoke-summary.json', 'artifacts/settings-smoke-summary.json']) {
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
  ) {
    throw new Error('Standard updater scenario must download in background, prompt for restart when ready, and exclude Full metadata');
  }
}

function validateFirstRunMatrix(matrix, contract) {
  if (matrix.active_shell !== contract.active_shell || matrix.shell_root !== contract.shell_root) {
    throw new Error('First-run matrix must target the active shell contract');
  }
  const scenarioById = buildScenarioMap(matrix);
  validateFullFirstInstallScenario(scenarioById.get('full_first_install_clean_machine'));
  validateStandardBootstrapScenario(scenarioById.get('standard_app_managed_bootstrap'));
  validateCommandLineToolsScenario(scenarioById.get('macos_clt_system_installer'));
  validateEcosystemModuleScenario(scenarioById.get('ecosystem_modules_app_cli_managed'));
  validateUpdaterScenario(scenarioById.get('updater_standard_channel'));
}

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
const forbiddenAuthorityOwners = [
  'runtime_truth',
  'provider_implementation',
  'domain_truth',
  'domain_quality_verdict',
  'domain_artifact_authority',
];

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
    active_shell: contractPath,
    page_state: pageStateMatrixPath,
    first_run: firstRunMatrixPath,
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
    profile.gui.appearance?.default_css_theme_id !== 'codex' ||
    profile.gui.appearance?.codex_theme_default_enabled !== true
  ) {
    throw new Error('Product profile GUI appearance must default to the Codex theme');
  }
  if (
    profile.gui.home?.primary_input_surface !== 'single_card' ||
    profile.gui.home?.nested_input_card_frames_allowed !== false ||
    profile.gui.home?.codex_model_selector_visible !== false ||
    profile.gui.home?.codex_model_list_visible !== false ||
    profile.gui.home?.codex_default_model !== profile.codex?.default_model ||
    profile.gui.home?.codex_default_reasoning_effort !== profile.codex?.default_reasoning_effort ||
    profile.gui.home?.codex_default_permission_mode !== 'full-access'
  ) {
    throw new Error('Product profile GUI home must hide Codex model selection and match App Codex defaults');
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
}

function validateFullFirstInstallCoreReadyPolicy(profile) {
  if (JSON.stringify(profile.first_run?.readiness_layers) !== JSON.stringify(['core'])) {
    throw new Error('Product profile ready_to_launch readiness_layers must contain only core');
  }
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

function validateCompanionPayloadAuthority(profile) {
  for (const moduleId of ecosystemModuleIds) {
    if (!profile.companion_payloads?.ecosystem_modules?.includes(moduleId)) {
      throw new Error(`Product profile must list ${moduleId} as ecosystem module`);
    }
    if (profile.companion_payloads?.management_authority?.[moduleId] !== 'app_or_cli_managed') {
      throw new Error(`Product profile must mark ${moduleId} as App/CLI managed`);
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

function validateProductProfile(profile) {
  validateProductProfileIdentity(profile);
  validateProductProfileContractRefs(profile);
  validateProductProfileCodexDefaults(profile);
  validateFullFirstInstallCoreReadyPolicy(profile);
  validateStandardPackagePolicy(profile);
  validateCommandLineToolsPolicy(profile);
  validateStandardUpdatePolicy(profile);
  validateCompanionPayloadAuthority(profile);
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
const contract = readAppShellAdapterContract(contractPath);
const shellPaths = resolveActiveShellPaths({ contract });
const guiProductContract = readJson(guiProductContractPath);
const runtimeBridge = readJson(runtimeBridgePath);
const pageStateMatrix = readJson(pageStateMatrixPath);
const firstRunMatrix = readJson(firstRunMatrixPath);
const releaseChannel = readJson(releaseChannelPath);
validateContractShape(contract);
validateRuntimeBridgeContract(runtimeBridge, contract);
validateAppGuiProductContract(guiProductContract, releaseChannel);
validatePageStateMatrix(pageStateMatrix, contract);
validateFirstRunMatrix(firstRunMatrix, contract);
validateProductProfile(readJson(productProfilePath));
validateReleaseEvidenceBundle(releaseChannel, pageStateMatrix, firstRunMatrix);
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
