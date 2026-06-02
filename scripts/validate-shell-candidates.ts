#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type ValidationCommand = {
  id: string;
  cwd: string;
  command: string;
};

type ShellCandidate = {
  id: string;
  state: string;
  candidate_root: string;
  adapter_contract: string;
  source_topology: string;
  release_participation: string;
  implementation_basis: string[];
  codex_app_like_chat_target?: {
    scope: string;
    primary_user_flow: string;
    capability_inventory: string[];
  };
  webui_transport?: {
    shared_renderer: boolean;
    electron_surface: string;
    web_surface: string;
    web_bridge: string;
    event_stream: string;
    gateway: string;
    native_picker_policy: string;
  };
  pilotdeck_information_architecture_target?: {
    source_usage: string;
    license: string;
    copied_source_allowed: boolean;
    runtime_authority_transfer_allowed: boolean;
    required_surfaces: string[];
    required_testids: string[];
  };
  target_product_shape: {
    codex_cli_fixed_executor: boolean;
    home_executor_selector_visible: boolean;
    home_backend_selector_visible: boolean;
    home_model_selector_visible: boolean;
    permission_mode_selector_visible: boolean;
    workspace_session_rail_default_visible: boolean;
    inspector_default_visible: boolean;
    purpose_entries: string[];
    runtime_page_policy: string;
    settings_policy: string;
  };
  technical_verification?: {
    minimum_acceptance?: string[];
  };
  framework_surfaces: Record<string, string>;
  foundry_agent_series_display_contract?: {
    authority: string;
    display_policy: string;
    required_shared_progress_fields: string[];
    forbidden_domain_fields: string[];
  };
  required_capabilities: string[];
  must_not_own: string[];
  forbidden_home_controls: string[];
  validation_commands: ValidationCommand[];
  non_goals: string[];
};

type ShellCandidateRegistry = {
  schema_version: number;
  owner: string;
  purpose: string;
  state: string;
  active_shell_unchanged: string;
  release_shell_contract: string;
  gui_product_contract: string;
  runtime_bridge_contract: string;
  product_profile_contract: string;
  page_state_matrix: string;
  first_run_matrix: string;
  candidate_policy: {
    candidate_root_pattern: string;
    candidate_state: string;
    release_participation_until_adopted: string;
    authority_transfer_allowed: boolean;
    release_scripts_must_use_active_shell_adapter: boolean;
    candidate_validation_script: string;
    adoption_gate: string[];
  };
  design_reference_policy?: {
    purpose: string;
    source_code_use: string;
    runtime_authority_transfer_allowed: boolean;
    license_gate_required_before_code_reuse: boolean;
    candidate_promotion_route: string;
  };
  design_references?: Array<{
    id: string;
    source_repo: string;
    evaluated_ref: string;
    evaluated_at: string;
    license: string;
    source_usage: string;
    reference_value: string[];
    opl_mapping: string[];
    forbidden_reuse: string[];
  }>;
  candidates: ShellCandidate[];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'contracts', 'app-shell-candidates.json');
const activeAdapterPath = path.join(root, 'contracts', 'app-shell-adapter.json');
const guiContractPath = path.join(root, 'contracts', 'app-gui-product-contract.json');
const runtimeBridgePath = path.join(root, 'contracts', 'app-runtime-bridge.json');
const productProfilePath = path.join(root, 'contracts', 'app-product-profile.json');
const pageStateMatrixPath = path.join(root, 'contracts', 'app-page-state-matrix.json');
const firstRunMatrixPath = path.join(root, 'contracts', 'app-first-run-test-matrix.json');
const requiredHomeEntries = ['research', 'grant', 'ppt'];
const requiredCapabilities = [
  'codex_cli_fixed_executor_home',
  'codex_app_server_thread_turn_backend',
  'copilotkit_visible_ui_runtime_layer',
  'agui_internal_protocol_not_user_visible',
  'purpose_first_home_entries',
  'agui_event_contract_map',
  'app_server_event_to_agui_stream_mapping',
  'workspace_directory_picker',
  'new_conversation_thread_reset',
  'pixel_visible_ui_smoke',
  'source_renderer_build',
  'source_ui_smoke',
  'packaged_ui_smoke',
  'webui_shared_renderer',
  'web_transport_bridge',
  'webui_smoke',
  'chat_first_codex_app_surface',
  'default_context_collapsed_chat_first_home',
  'lightweight_workspace_session_rail',
  'collapsible_contextual_tabs',
  'app_product_profile_mapping',
  'opl_app_state_bridge',
  'opl_app_action_bridge',
  'page_state_matrix_mapping',
  'first_run_matrix_mapping',
  'runtime_summary_detail_action_bridge',
  'foundry_agent_series_shared_progress_display',
  'app_owned_settings_information_architecture',
  'secondary_runtime_context_refs',
  'conversation_event_ref_rendering',
  'webui_renderer_parity',
  'release_isolation',
  'candidate_app_bundle_package',
];
const requiredSettingsTabs = ['general', 'access', 'capabilities', 'environment', 'appearance', 'advanced', 'about'];
const forbiddenLegacySettingsTabs = [
  'overview',
  'runtime',
  'system',
  'model',
  'agent',
  'assistants',
  'skills-hub',
  'tools',
  'display',
  'webui',
  'pet',
];
const requiredActivityGroups = ['needs_attention', 'active_projects', 'recent_projects'];
const requiredConversationEventKinds = ['tool', 'process', 'diff', 'file', 'receipt', 'user_input', 'permission'];
const requiredContextSurfaces = [
  'chat-first main canvas',
  'lightweight workspace/session rail',
  'right-side collapsible inspector tabs',
  'Files context tab',
  'Skills context tab',
  'Routing context tab',
  'Memory context tab',
  'Always-On context tab',
];
const requiredContextTestIds = [
  'opl-workspace-rail',
  'opl-session-list',
  'opl-context-tabs',
  'opl-files-panel',
  'opl-skills-panel',
  'opl-routing-panel',
  'opl-memory-panel',
  'opl-always-on-panel',
  'opl-web-transport',
];
const forbiddenAuthority = [
  'App GUI product truth',
  'App model-selection policy',
  'App release gate policy',
  'OPL runtime truth',
  'provider implementation',
  'domain truth',
  'domain quality verdict',
  'memory body',
  'artifact body',
  'artifact authority',
];
const expectedFrameworkSurfaces: Record<string, string> = {
  state: 'opl app state --profile fast --json',
  refresh: 'opl app state --profile fast --json',
  full_state: 'opl app state --profile full --json',
  full_drilldown: 'opl runtime app-operator-drilldown --detail full --json',
  action: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
};
const requiredSeriesProgressFields = [
  'progress_delta_classification',
  'deliverable_progress_delta',
  'platform_repair_delta',
  'next_forced_delta',
];
const forbiddenSeriesDomainFields = [
  'domain_body',
  'artifact_body',
  'memory_body',
  'quality_verdict',
  'export_verdict',
];

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function assertFile(filePath: string, label: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${path.relative(root, filePath)}`);
  }
}

function assertDirectory(filePath: string, label: string): void {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isDirectory()) {
    throw new Error(`Missing ${label} directory: ${path.relative(root, filePath)}`);
  }
}

function assertRelativePath(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  if (path.isAbsolute(value) || value.split(/[\\/]+/).includes('..')) {
    throw new Error(`${label} must stay relative to the candidate shell root`);
  }
}

function findMacAppExecutable(macOsDir: string, candidateId: string): string {
  const executable = fs.readdirSync(macOsDir).find((entry) => {
    const filePath = path.join(macOsDir, entry);
    const stat = fs.statSync(filePath);
    return stat.isFile() && (stat.mode & 0o111) !== 0;
  });
  if (!executable) {
    throw new Error(`${candidateId} .app bundle must include an executable under Contents/MacOS`);
  }
  return executable;
}

function assertNoAbsoluteSymlinks(directoryPath: string, candidateId: string): void {
  for (const entry of fs.readdirSync(directoryPath)) {
    const filePath = path.join(directoryPath, entry);
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(filePath);
      if (path.isAbsolute(target)) {
        throw new Error(`${candidateId} .app bundle must not contain absolute symlink ${path.relative(root, filePath)} -> ${target}`);
      }
      continue;
    }
    if (stat.isDirectory()) {
      assertNoAbsoluteSymlinks(filePath, candidateId);
    }
  }
}

function assertStringArrayIncludes(actual: string[], expected: string[], label: string): void {
  if (!Array.isArray(actual)) {
    throw new Error(`${label} must be an array`);
  }
  for (const item of expected) {
    if (!actual.includes(item)) {
      throw new Error(`${label} must include ${item}`);
    }
  }
}

function parseArgs(argv: string[]): { candidate?: string; runCandidateCommands: boolean } {
  const parsed = { candidate: undefined as string | undefined, runCandidateCommands: false };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--candidate') {
      const value = argv[++index];
      if (!value) throw new Error('Missing value for --candidate');
      parsed.candidate = value;
      continue;
    }
    if (token === '--run-candidate-commands') {
      parsed.runCandidateCommands = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return parsed;
}

function validateRegistryShape(registry: ShellCandidateRegistry): void {
  if (registry.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected candidate registry owner: ${registry.owner}`);
  }
  if (registry.purpose !== 'app_shell_candidate_registry') {
    throw new Error(`Unexpected candidate registry purpose: ${registry.purpose}`);
  }
  if (registry.state !== 'active_experimental') {
    throw new Error(`Unexpected candidate registry state: ${registry.state}`);
  }
  if (registry.active_shell_unchanged !== 'aionui') {
    throw new Error('candidate registry must not change active shell away from aionui');
  }
  for (const [label, expected] of Object.entries({
    release_shell_contract: 'contracts/app-shell-adapter.json',
    gui_product_contract: 'contracts/app-gui-product-contract.json',
    runtime_bridge_contract: 'contracts/app-runtime-bridge.json',
    product_profile_contract: 'contracts/app-product-profile.json',
    page_state_matrix: 'contracts/app-page-state-matrix.json',
    first_run_matrix: 'contracts/app-first-run-test-matrix.json',
  })) {
    if (registry[label as keyof ShellCandidateRegistry] !== expected) {
      throw new Error(`candidate registry ${label} must be ${expected}`);
    }
    assertFile(path.join(root, expected), label);
  }
  const policy = registry.candidate_policy;
  if (policy.candidate_root_pattern !== 'shells/<candidate>') {
    throw new Error('candidate roots must stay under shells/<candidate>');
  }
  if (policy.candidate_state !== 'candidate_until_contracts_and_tests_complete') {
    throw new Error(`Unexpected candidate policy state: ${policy.candidate_state}`);
  }
  if (policy.release_participation_until_adopted !== 'explicit_candidate_build_only') {
    throw new Error('candidate release participation must stay explicit_candidate_build_only until adopted');
  }
  if (policy.authority_transfer_allowed !== false) {
    throw new Error('candidate policy must not transfer App authority');
  }
  if (policy.release_scripts_must_use_active_shell_adapter !== true) {
    throw new Error('release scripts must continue using the active shell adapter');
  }
  if (policy.candidate_validation_script !== 'scripts/validate-shell-candidates.ts') {
    throw new Error('candidate registry must point at scripts/validate-shell-candidates.ts');
  }
  assertStringArrayIncludes(policy.adoption_gate, [
    'candidate is declared in contracts/app-shell-candidates.json',
    'candidate implements contracts/app-gui-product-contract.json',
    'candidate uses one shared React/CopilotKit renderer for Electron and WebUI surfaces',
    'candidate provides a Web transport bridge that exposes the same App-owned window.oplCandidate API without taking runtime authority',
    'candidate passes WebUI smoke in addition to source Electron and packaged Electron smoke',
    'candidate re-expresses PilotDeck information organization as a Codex App-style chat-first UI with a lightweight workspace/session rail and right-side collapsible contextual tabs without copying PilotDeck code or runtime',
    'candidate compiles a launchable .app bundle through the App wrapper when OPL_APP_SHELL_ADAPTER_CONTRACT selects its adapter contract',
    'candidate passes App-root candidate validation',
    'contracts/app-shell-adapter.json is changed only when candidate becomes active release shell',
  ], 'candidate_policy.adoption_gate');
  validateDesignReferences(registry);
}

function validateDesignReferences(registry: ShellCandidateRegistry): void {
  const policy = registry.design_reference_policy;
  if (!policy) {
    throw new Error('candidate registry must declare design_reference_policy');
  }
  if (policy.source_code_use !== 'reference_only_no_vendoring_or_copying_without_license_decision') {
    throw new Error('design references must stay reference-only until a license decision');
  }
  if (policy.runtime_authority_transfer_allowed !== false) {
    throw new Error('design references must not transfer runtime authority');
  }
  if (policy.license_gate_required_before_code_reuse !== true) {
    throw new Error('design references must require a license gate before code reuse');
  }
  if (policy.candidate_promotion_route !== 'external_checkout_under_shells/<candidate>_with_adapter_contract_and_App_owned_gates') {
    throw new Error('design reference candidate promotion must use the normal external-checkout adapter route');
  }

  const references = registry.design_references ?? [];
  const pilotdeck = references.find((reference) => reference.id === 'pilotdeck');
  if (!pilotdeck) {
    throw new Error('candidate registry must record PilotDeck as a design reference');
  }
  if (pilotdeck.source_repo !== 'https://github.com/OpenBMB/PilotDeck') {
    throw new Error('PilotDeck design reference must point at OpenBMB/PilotDeck');
  }
  if (pilotdeck.evaluated_ref !== '33394d1069c3528052c3f12eb1d905060b34cc2f') {
    throw new Error('PilotDeck design reference must record the evaluated ref');
  }
  if (pilotdeck.license !== 'AGPL-3.0') {
    throw new Error('PilotDeck design reference must record AGPL-3.0 license');
  }
  if (pilotdeck.source_usage !== 'design_reference_only') {
    throw new Error('PilotDeck source usage must stay design_reference_only');
  }
  assertStringArrayIncludes(pilotdeck.reference_value, [
    'workspace/project sidebar pattern for lightweight rail organization',
    'chat-first main pane with persistent composer',
    'information grouping for Agent, Files, Skills, Routing, Memory, and Always-On',
    'file, memory, routing, and always-on context surfaces',
  ], 'PilotDeck reference_value');
  assertStringArrayIncludes(pilotdeck.opl_mapping, [
    'OPL lightweight workspace rail should group work by workspace and conversation without exposing backend selection',
    'OPL main surface should stay chat-first with MAS/MAG/RCA purpose tags in the composer',
    'OPL right-side collapsible contextual tabs should map to Files, Runtime, Capabilities, Memory refs, Automations, and Settings using App-owned state/action surfaces',
    'OPL runtime and memory panels must consume OPL Framework/domain projections rather than PilotDeck state stores',
  ], 'PilotDeck opl_mapping');
  assertStringArrayIncludes(pilotdeck.forbidden_reuse, [
    'do not copy or vendor PilotDeck AGPL source into the Apache-2.0 App repo',
    'do not adopt PilotDeck gateway, agent runtime, memory, router, or always-on stores as OPL authority',
    'do not expose PilotDeck provider/model/backend selection as ordinary OPL App controls',
    'do not treat PilotDeck screenshots, demo data, or WorkSpace model as App product truth',
  ], 'PilotDeck forbidden_reuse');
}

function assertCandidateFileContains(candidate: ShellCandidate, relativePath: string, snippets: string[], label: string): void {
  const filePath = path.join(root, candidate.candidate_root, relativePath);
  assertFile(filePath, `${candidate.id} ${label}`);
  const source = fs.readFileSync(filePath, 'utf8');
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      throw new Error(`${candidate.id} ${label} must include ${snippet}`);
    }
  }
}

function validateActiveShellUnaffected(): void {
  const activeAdapter = readJson<{
    active_shell: string;
    shell_root: string;
    shell_source: { owner_repo: string };
    release_role: string;
  }>(activeAdapterPath);
  const runtimeBridge = readJson<{
    active_adapter: string;
    default_adapter_repo: string;
    default_adapter_path: string;
  }>(runtimeBridgePath);
  const guiContract = readJson<{ active_shell: string; implementation_carrier: string }>(guiContractPath);

  if (activeAdapter.active_shell !== 'aionui' || activeAdapter.shell_root !== 'shells/aionui') {
    throw new Error('active shell adapter must remain aionui at shells/aionui');
  }
  if (activeAdapter.shell_source.owner_repo !== 'gaofeng21cn/opl-aion-shell') {
    throw new Error('active release shell source must remain gaofeng21cn/opl-aion-shell');
  }
  if (activeAdapter.release_role !== 'stable_app_shell') {
    throw new Error('active shell release role must remain stable_app_shell');
  }
  if (
    runtimeBridge.active_adapter !== activeAdapter.active_shell ||
    runtimeBridge.default_adapter_repo !== activeAdapter.shell_source.owner_repo ||
    runtimeBridge.default_adapter_path !== activeAdapter.shell_root
  ) {
    throw new Error('runtime bridge default adapter must continue matching the active shell adapter');
  }
  if (guiContract.active_shell !== activeAdapter.active_shell || guiContract.implementation_carrier !== 'opl-aion-shell') {
    throw new Error('GUI product contract must still point at the active AionUI implementation carrier');
  }
}

function validateCandidate(candidate: ShellCandidate): void {
  if (!candidate.id || !candidate.candidate_root) {
    throw new Error(`Invalid candidate entry: ${JSON.stringify(candidate)}`);
  }
  if (candidate.state !== 'technical_verification') {
    throw new Error(`${candidate.id} must stay in technical_verification until adopted`);
  }
  if (!candidate.candidate_root.startsWith('shells/') || candidate.candidate_root.split(/[\\/]+/).includes('..')) {
    throw new Error(`${candidate.id} candidate_root must be under shells/<candidate>`);
  }
  if (candidate.release_participation !== 'selectable_for_explicit_candidate_build') {
    throw new Error(`${candidate.id} must only participate in explicit candidate builds`);
  }
  if (candidate.source_topology !== 'external_checkout_linked_shell_repo') {
    throw new Error(`${candidate.id} must declare external_checkout_linked_shell_repo topology`);
  }
  assertFile(path.join(root, candidate.adapter_contract), `${candidate.id} adapter contract`);
  const adapterContract = readJson<{
    active_shell: string;
    shell_root: string;
    shell_source: { owner_repo: string; history_policy: string; checkout_path: string };
    release_role: string;
    shell_contract: { source_topology: string; capabilities: string[] };
    validation_commands: ValidationCommand[];
  }>(path.join(root, candidate.adapter_contract));
  if (adapterContract.active_shell !== candidate.id || adapterContract.shell_root !== candidate.candidate_root) {
    throw new Error(`${candidate.id} adapter contract must point at ${candidate.candidate_root}`);
  }
  if (adapterContract.shell_source.checkout_path !== candidate.candidate_root) {
    throw new Error(`${candidate.id} adapter checkout_path must match candidate_root`);
  }
  if (adapterContract.shell_source.history_policy !== 'external_checkout_not_merged_into_app_default_branch') {
    throw new Error(`${candidate.id} adapter must keep external checkout history policy`);
  }
  if (adapterContract.release_role !== 'experimental_candidate_shell') {
    throw new Error(`${candidate.id} adapter release_role must be experimental_candidate_shell`);
  }
  if (adapterContract.shell_contract.source_topology !== candidate.source_topology) {
    throw new Error(`${candidate.id} adapter source_topology must match candidate registry`);
  }
  if (!adapterContract.shell_contract.capabilities.includes('candidate_app_bundle_package')) {
    throw new Error(`${candidate.id} adapter must declare candidate_app_bundle_package capability`);
  }
  if (!adapterContract.validation_commands.some((entry) => entry.id === 'candidate_app_bundle_build')) {
    throw new Error(`${candidate.id} adapter validation_commands must include candidate_app_bundle_build`);
  }
  assertStringArrayIncludes(candidate.implementation_basis, [
    'AG-UI event model',
    'shared React/CopilotKit renderer for Electron and WebUI',
    'OPL App-owned product profile',
    'OPL Framework app state/action CLI protocol',
  ], `${candidate.id}.implementation_basis`);
  validateCandidateChatTarget(candidate);
  validateCandidateWebUiTransport(candidate);
  if (
    candidate.target_product_shape.codex_cli_fixed_executor !== true ||
    candidate.target_product_shape.home_executor_selector_visible !== false ||
    candidate.target_product_shape.home_backend_selector_visible !== false ||
    candidate.target_product_shape.home_model_selector_visible !== false ||
    candidate.target_product_shape.permission_mode_selector_visible !== false ||
    candidate.target_product_shape.workspace_session_rail_default_visible !== false ||
    candidate.target_product_shape.inspector_default_visible !== false
  ) {
    throw new Error(`${candidate.id} must preserve Codex fixed-executor chat-first home without selectors or default side context`);
  }
  assertStringArrayIncludes(candidate.target_product_shape.purpose_entries, requiredHomeEntries, `${candidate.id}.target_product_shape.purpose_entries`);
  if (candidate.target_product_shape.settings_policy !== 'app_state_refs_only') {
    throw new Error(`${candidate.id}.target_product_shape.settings_policy must keep Settings App-owned and refs-only`);
  }
  assertStringArrayIncludes(candidate.technical_verification?.minimum_acceptance ?? [], [
    'ordinary Settings uses General, Access, Agents & Capabilities, Local Environment, Appearance, Advanced, and About & Updates',
    'ordinary home does not expose runtime activity, continue-work, per-agent running badges, or footer quick icons; Runtime and secondary context surfaces carry refs-only activity details',
    'tool/process/diff/file/receipt/user-input/permission events render as compact conversation events or expandable refs',
    'WebUI parity evidence proves the same React/CopilotKit renderer and product semantics as Electron',
  ], `${candidate.id}.technical_verification.minimum_acceptance`);
  for (const [surface, expected] of Object.entries(expectedFrameworkSurfaces)) {
    if (candidate.framework_surfaces[surface] !== expected) {
      throw new Error(`${candidate.id}.framework_surfaces.${surface} must be ${expected}`);
    }
  }
  const seriesDisplay = candidate.foundry_agent_series_display_contract;
  if (!seriesDisplay) {
    throw new Error(`${candidate.id} must declare foundry_agent_series_display_contract`);
  }
  if (seriesDisplay.authority !== 'opl_framework_shared_progress_projection') {
    throw new Error(`${candidate.id}.foundry_agent_series_display_contract.authority must be opl_framework_shared_progress_projection`);
  }
  if (seriesDisplay.display_policy !== 'classification_only_no_domain_artifact_body') {
    throw new Error(`${candidate.id}.foundry_agent_series_display_contract.display_policy must forbid domain artifact body display`);
  }
  assertStringArrayIncludes(
    seriesDisplay.required_shared_progress_fields,
    requiredSeriesProgressFields,
    `${candidate.id}.foundry_agent_series_display_contract.required_shared_progress_fields`,
  );
  assertStringArrayIncludes(
    seriesDisplay.forbidden_domain_fields,
    forbiddenSeriesDomainFields,
    `${candidate.id}.foundry_agent_series_display_contract.forbidden_domain_fields`,
  );
  assertStringArrayIncludes(candidate.required_capabilities, requiredCapabilities, `${candidate.id}.required_capabilities`);
  assertStringArrayIncludes(candidate.must_not_own, forbiddenAuthority, `${candidate.id}.must_not_own`);
  assertStringArrayIncludes(candidate.forbidden_home_controls, [
    'Aion CLI backend choice',
    'Claude Code backend choice',
    'generic backend selector',
    'Codex model override selector',
    'permission mode selector',
  ], `${candidate.id}.forbidden_home_controls`);
  assertStringArrayIncludes(candidate.non_goals, [
    'do not switch active_shell away from aionui',
    'do not enter default stable or nightly release packaging',
    'do not introduce runtime or domain truth into the App repo',
  ], `${candidate.id}.non_goals`);
  for (const entry of candidate.validation_commands) {
    if (!entry.id || !entry.cwd || !entry.command) {
      throw new Error(`${candidate.id} has invalid validation command ${JSON.stringify(entry)}`);
    }
    assertFile(path.join(root, entry.cwd), `${candidate.id} validation cwd ${entry.id}`);
  }
  const bundleCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_app_bundle_build');
  if (!bundleCommand) {
    throw new Error(`${candidate.id} validation_commands must include candidate_app_bundle_build`);
  }
  const webUiSmokeCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_webui_smoke');
  if (!webUiSmokeCommand) {
    throw new Error(`${candidate.id} validation_commands must include candidate_webui_smoke`);
  }
  if (webUiSmokeCommand.cwd !== candidate.candidate_root || !webUiSmokeCommand.command.includes('npm run smoke:webui')) {
    throw new Error(`${candidate.id} candidate_webui_smoke must run npm run smoke:webui from ${candidate.candidate_root}`);
  }
  if (
    bundleCommand.cwd !== '.'
    || !bundleCommand.command.includes(`OPL_APP_SHELL_ADAPTER_CONTRACT=${candidate.adapter_contract} npm run package`)
  ) {
    throw new Error(`${candidate.id} candidate_app_bundle_build must run App-root npm package with the candidate adapter contract`);
  }
  assertFile(path.join(root, candidate.candidate_root, 'scripts', 'validate-agui-codex-candidate.ts'), `${candidate.id} self-check`);
  assertCandidateFileContains(candidate, 'package.json', [
    '"build:webui"',
    '"webui"',
    '"smoke:webui"',
  ], 'package scripts for WebUI');
}

function validateCandidateImplementationFiles(candidate: ShellCandidate): void {
  assertCandidateFileContains(candidate, 'src/renderer/App.jsx', [
    'data-testid="opl-workspace-rail"',
    'data-testid="opl-session-list"',
    'data-testid="opl-context-tabs"',
    'data-testid="opl-files-panel"',
    'data-testid="opl-skills-panel"',
    'data-testid="opl-routing-panel"',
    'data-testid="opl-memory-panel"',
    'data-testid="opl-always-on-panel"',
  ], 'chat-first contextual renderer');
  assertCandidateFileContains(candidate, 'src/renderer/web-bridge.js', [
    'window.oplCandidate',
    'EventSource',
    '/api/codex-events',
  ], 'Web transport bridge');
  assertCandidateFileContains(candidate, 'scripts/dev-webui-server.js', [
    '/api/shell-data',
    '/api/send-message',
    '/api/codex-events',
  ], 'WebUI gateway');
}

function validateCandidateChatTarget(candidate: ShellCandidate): void {
  const target = candidate.codex_app_like_chat_target;
  if (!target) {
    throw new Error(`${candidate.id} must declare codex_app_like_chat_target`);
  }
  if (target.scope !== 'Codex App-style chat-first desktop and WebUI target, not a full workbench first screen or AionUI modification list') {
    throw new Error(`${candidate.id} target must stay Codex App-style chat-first, not a full workbench first screen`);
  }
  assertStringArrayIncludes(target.capability_inventory, [
    'workspace directory picker',
    'new conversation and lightweight thread history rail',
    'Codex app-server backed chat turns',
    'shared React/CopilotKit renderer for Electron and WebUI',
    'Web transport bridge with HTTP actions and SSE Codex events',
    'PilotDeck-informed information organization as reference-only',
    'chat-first main canvas with pinned composer',
    'right-side collapsible Files, Skills, Routing, Memory, and Always-On context tabs',
    'candidate .app package through the App wrapper',
  ], `${candidate.id}.codex_app_like_chat_target.capability_inventory`);

  const pilotdeckTarget = candidate.pilotdeck_information_architecture_target;
  if (!pilotdeckTarget) {
    throw new Error(`${candidate.id} must declare pilotdeck_information_architecture_target`);
  }
  if (pilotdeckTarget.source_usage !== 'design_reference_only' || pilotdeckTarget.license !== 'AGPL-3.0') {
    throw new Error(`${candidate.id} PilotDeck target must remain AGPL design_reference_only`);
  }
  if (pilotdeckTarget.copied_source_allowed !== false || pilotdeckTarget.runtime_authority_transfer_allowed !== false) {
    throw new Error(`${candidate.id} must not copy PilotDeck source or transfer PilotDeck runtime authority`);
  }
  assertStringArrayIncludes(pilotdeckTarget.required_surfaces, requiredContextSurfaces, `${candidate.id}.pilotdeck_information_architecture_target.required_surfaces`);
  assertStringArrayIncludes(pilotdeckTarget.required_testids, requiredContextTestIds, `${candidate.id}.pilotdeck_information_architecture_target.required_testids`);
}

function validateCandidateWebUiTransport(candidate: ShellCandidate): void {
  const transport = candidate.webui_transport;
  if (!transport) {
    throw new Error(`${candidate.id} must declare webui_transport`);
  }
  if (transport.shared_renderer !== true) {
    throw new Error(`${candidate.id} webui_transport.shared_renderer must be true`);
  }
  if (transport.electron_surface !== 'Electron preload/IPC window.oplCandidate') {
    throw new Error(`${candidate.id} electron WebUI transport must preserve preload/IPC window.oplCandidate`);
  }
  if (transport.web_surface !== 'browser window.oplCandidate compatibility bridge') {
    throw new Error(`${candidate.id} web surface must be the browser window.oplCandidate compatibility bridge`);
  }
  if (transport.web_bridge !== 'src/renderer/web-bridge.js') {
    throw new Error(`${candidate.id} web bridge must be src/renderer/web-bridge.js`);
  }
  if (transport.gateway !== 'scripts/dev-webui-server.js') {
    throw new Error(`${candidate.id} WebUI gateway must be scripts/dev-webui-server.js`);
  }
  if (transport.event_stream !== 'SSE /api/codex-events') {
    throw new Error(`${candidate.id} WebUI event stream must be SSE /api/codex-events`);
  }
  if (transport.native_picker_policy !== 'Electron may use native directory picker; WebUI uses an explicit workspace path/action bridge without changing App product truth') {
    throw new Error(`${candidate.id} WebUI native picker policy must preserve App product truth`);
  }
}

function runCandidateCommands(candidate: ShellCandidate): void {
  for (const entry of candidate.validation_commands) {
    const result = spawnSync(entry.command, {
      cwd: path.join(root, entry.cwd),
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });
    if (result.status !== 0) {
      throw new Error(`${candidate.id} validation command failed: ${entry.id}`);
    }
    if (entry.id === 'candidate_app_bundle_build') {
      validateCandidatePackageManifest(candidate, { requireSmoke: false });
    }
  }
  validateCandidateImplementationFiles(candidate);
  validateCandidateImplementationEvidence(candidate);
}

function validateCandidatePackageManifest(candidate: ShellCandidate, options: { requireSmoke?: boolean } = { requireSmoke: true }): void {
  const manifestPath = path.join(root, candidate.candidate_root, 'out', 'agui-codex-candidate-manifest.json');
  assertFile(manifestPath, `${candidate.id} package manifest`);
  const manifest = readJson<{
    status: string;
    package_kind: string;
    app_bundle_path: string;
    product_profile_owner: string;
    home_purpose_entries: string[];
  }>(manifestPath);
  if (manifest.status !== 'candidate_app_bundle_ready') {
    throw new Error(`${candidate.id} package manifest must declare candidate_app_bundle_ready`);
  }
  if (manifest.package_kind !== 'explicit_candidate_app_bundle') {
    throw new Error(`${candidate.id} package manifest must declare explicit_candidate_app_bundle`);
  }
  if (!manifest.app_bundle_path || !manifest.app_bundle_path.endsWith('.app')) {
    throw new Error(`${candidate.id} package manifest must point at a .app bundle`);
  }
  assertRelativePath(manifest.app_bundle_path, `${candidate.id} package manifest app_bundle_path`);
  const appBundleRoot = path.join(root, candidate.candidate_root, manifest.app_bundle_path);
  assertDirectory(appBundleRoot, `${candidate.id} .app bundle`);
  assertFile(path.join(appBundleRoot, 'Contents', 'Info.plist'), `${candidate.id} .app Info.plist`);
  const macOsDir = path.join(appBundleRoot, 'Contents', 'MacOS');
  assertDirectory(macOsDir, `${candidate.id} .app Contents/MacOS`);
  findMacAppExecutable(macOsDir, candidate.id);
  assertNoAbsoluteSymlinks(appBundleRoot, candidate.id);
  if (manifest.product_profile_owner !== 'one-person-lab-app') {
    throw new Error(`${candidate.id} package manifest must prove App-owned product profile input`);
  }
  assertStringArrayIncludes(manifest.home_purpose_entries, requiredHomeEntries, `${candidate.id} package manifest purpose entries`);
  for (const [field, expected] of Object.entries({
    page_state_matrix_mapping_status: 'passed',
    first_run_matrix_mapping_status: 'passed',
	    runtime_summary_detail_action_bridge_status: 'passed',
	    default_home_layout_status: 'passed',
	    settings_ia_status: 'passed',
	    secondary_runtime_context_refs_status: 'passed',
	    bilingual_ui_status: 'passed',
	    chat_event_rendering_status: 'passed',
	    webui_parity_status: 'passed',
	  })) {
    if ((manifest as Record<string, unknown>)[field] !== expected) {
      throw new Error(`${candidate.id} package manifest ${field} must be ${expected}`);
    }
  }
  assertStringArrayIncludes(
    (manifest as { settings_tabs?: string[] }).settings_tabs ?? [],
    requiredSettingsTabs,
    `${candidate.id} package manifest settings tabs`,
  );
  for (const legacyTab of forbiddenLegacySettingsTabs) {
    if (((manifest as { settings_tabs?: string[] }).settings_tabs ?? []).includes(legacyTab)) {
      throw new Error(`${candidate.id} package manifest must not expose legacy Settings tab ${legacyTab}`);
    }
  }
  assertStringArrayIncludes(
    (manifest as { secondary_runtime_context_groups?: string[] }).secondary_runtime_context_groups ?? [],
    requiredActivityGroups,
    `${candidate.id} package manifest secondary runtime context groups`,
  );
  for (const [field, expected] of Object.entries({
    home_runtime_activity_visible: false,
    home_continue_work_visible: false,
    home_footer_quick_icons_visible: false,
  })) {
    if ((manifest as Record<string, unknown>)[field] !== expected) {
      throw new Error(`${candidate.id} package manifest ${field} must be ${String(expected)}`);
    }
  }
  assertStringArrayIncludes(
    (manifest as { conversation_event_kinds?: string[] }).conversation_event_kinds ?? [],
    requiredConversationEventKinds,
    `${candidate.id} package manifest conversation event kinds`,
  );
  if (options.requireSmoke !== false) {
    for (const [field, expected] of Object.entries({
      copilotkit_ui_smoke_status: 'passed',
      codex_app_server_turn_status: 'passed',
      source_ui_smoke_status: 'passed',
      packaged_ui_smoke_status: 'passed',
      webui_smoke_status: 'passed',
      action_dry_run_status: 'passed',
    })) {
      if ((manifest as Record<string, unknown>)[field] !== expected) {
        throw new Error(`${candidate.id} package manifest ${field} must be ${expected}`);
      }
    }
    if (Number((manifest as Record<string, unknown>).runtime_safe_action_count ?? 0) < 1) {
      throw new Error(`${candidate.id} package manifest must prove at least one runtime safe action route`);
    }
  }
  if ((manifest as Record<string, unknown>).agui_user_visible !== false) {
    throw new Error(`${candidate.id} package manifest must prove AG-UI protocol copy is not ordinary user-visible UI`);
  }
  assertStringArrayIncludes(
    (manifest as { implemented_capabilities?: string[] }).implemented_capabilities ?? [],
    requiredCapabilities,
    `${candidate.id} package manifest implemented capabilities`,
  );
}

function validateCandidateImplementationEvidence(candidate: ShellCandidate): void {
  const evidencePath = path.join(root, candidate.candidate_root, 'src', 'candidateContractEvidence.json');
  assertFile(evidencePath, `${candidate.id} contract evidence`);
  const evidence = readJson<{
    owner: string;
    shell: string;
    capabilities: string[];
    framework_surfaces: Record<string, string>;
    user_visible_protocol_copy: { copilotkit_surface: boolean; agui: boolean };
    default_home_layout?: {
      policy: string;
      stage_classes: string[];
      workspace_rail_default_open: boolean;
      inspector_default_open: boolean;
    };
    webui_transport: { renderer: string; electron_transport: string; web_transport: string; gateway: string; shared_surface: boolean; events: string };
    pilotdeck_reference: { source_usage: string; license: string; copied_source: boolean; runtime_authority_transfer: boolean; mapped_surfaces: string[] };
    page_state_matrix_mapping: { page_ids: string[]; runtime_testids: string[]; settings_testids: string[] };
    first_run_matrix_mapping: { required_shell_testids: string[] };
    runtime_summary_detail_action_bridge: { renderer_testids: string[]; full_detail_policy: string; action_policy: string };
    settings_information_architecture?: { visible_tabs: string[]; labels_en: string[]; legacy_tabs_hidden: string[] };
    bilingual_ui?: {
      default_locale: string;
      supported_locales: string[];
      ordinary_ui_policy: string;
      language_toggle_testid: string;
      zh_purpose_labels: string[];
      en_purpose_labels: string[];
      secondary_detail_allowed_technical_tags: string[];
      ordinary_user_chrome_scope?: string[];
      ordinary_user_chrome_forbidden_technical_tags?: string[];
      ordinary_home_forbidden_language_mix: string[];
    };
    secondary_runtime_context_refs?: { authority: string; source: string; display_groups: string[]; default_placement: string; home_surface_policy: string; empty_state_policy: string; forbidden_body_display: string[]; renderer_testids: string[] };
    conversation_event_rendering?: { event_kinds: string[]; display_policy: string; forbidden_visible_protocol_copy: string[]; renderer_testids: string[] };
    webui_parity?: { shared_renderer: boolean; bridge_shape: string; product_profile: string; desktop_and_webui_default_home: string; evidence_status_field: string };
    foundry_agent_series_display_contract?: {
      authority: string;
      display_policy: string;
      required_shared_progress_fields: string[];
      forbidden_domain_fields: string[];
    };
  }>(evidencePath);
  if (evidence.owner !== 'one-person-lab-app' || evidence.shell !== candidate.id) {
    throw new Error(`${candidate.id} evidence must be App-owned and match the candidate id`);
  }
  assertStringArrayIncludes(evidence.capabilities, requiredCapabilities, `${candidate.id} evidence capabilities`);
  assertStringArrayIncludes(
    evidence.settings_information_architecture?.visible_tabs ?? [],
    requiredSettingsTabs,
    `${candidate.id} evidence settings_information_architecture.visible_tabs`,
  );
  assertStringArrayIncludes(
    evidence.settings_information_architecture?.legacy_tabs_hidden ?? [],
    forbiddenLegacySettingsTabs,
    `${candidate.id} evidence settings_information_architecture.legacy_tabs_hidden`,
  );
  if (
    evidence.bilingual_ui?.default_locale !== 'zh'
    || evidence.bilingual_ui?.ordinary_ui_policy !== 'same_screen_single_language_for_user_visible_chrome'
    || evidence.bilingual_ui?.language_toggle_testid !== 'opl-locale-toggle'
  ) {
    throw new Error(`${candidate.id} evidence must define bilingual UI as same-screen single-language user-visible chrome`);
  }
  assertStringArrayIncludes(
    evidence.bilingual_ui?.supported_locales ?? [],
    ['zh', 'en'],
    `${candidate.id} evidence bilingual_ui.supported_locales`,
  );
  assertStringArrayIncludes(
    evidence.bilingual_ui?.zh_purpose_labels ?? [],
    ['科研', '基金', 'PPT'],
    `${candidate.id} evidence bilingual_ui.zh_purpose_labels`,
  );
  assertStringArrayIncludes(
    evidence.bilingual_ui?.en_purpose_labels ?? [],
    ['Research', 'Grant', 'Presentation'],
    `${candidate.id} evidence bilingual_ui.en_purpose_labels`,
  );
  assertStringArrayIncludes(
    evidence.bilingual_ui?.ordinary_user_chrome_scope ?? [],
    [
      'ordinary home topbar',
      'chat composer',
      'workspace/session rail',
      'context inspector',
      'context tabs',
      'routing tab summaries',
    ],
    `${candidate.id} evidence bilingual_ui.ordinary_user_chrome_scope`,
  );
  assertStringArrayIncludes(
    evidence.bilingual_ui?.ordinary_user_chrome_forbidden_technical_tags ?? [],
    ['Codex CLI', 'MAS', 'MAG', 'RCA', '@MAS', '@MAG', '@RCA', 'app_state.actions', 'opl_app_state.v1'],
    `${candidate.id} evidence bilingual_ui.ordinary_user_chrome_forbidden_technical_tags`,
  );
  assertStringArrayIncludes(
    evidence.bilingual_ui?.ordinary_home_forbidden_language_mix ?? [],
    ['Med Auto Science', 'Med Auto Grant', 'RedCube AI', 'Codex CLI', 'Local assistant'],
    `${candidate.id} evidence bilingual_ui.ordinary_home_forbidden_language_mix`,
  );
  if (
    evidence.secondary_runtime_context_refs?.authority !== 'opl_framework_refs_only_projection' ||
    evidence.secondary_runtime_context_refs?.source !== 'Runtime page and secondary context surfaces only' ||
    evidence.secondary_runtime_context_refs?.default_placement !== 'runtime_page_or_secondary_context_not_home' ||
    evidence.secondary_runtime_context_refs?.home_surface_policy !== 'ordinary_home_must_not_render_runtime_activity_or_continue_work' ||
    evidence.secondary_runtime_context_refs?.empty_state_policy !== 'stable_empty_state_without_page_wide_spinner'
  ) {
    throw new Error(`${candidate.id} evidence must keep refs-only activity out of ordinary Home and in Runtime/secondary context`);
  }
  assertStringArrayIncludes(
    evidence.secondary_runtime_context_refs.display_groups,
    requiredActivityGroups,
    `${candidate.id} evidence secondary_runtime_context_refs.display_groups`,
  );
  assertStringArrayIncludes(
    evidence.secondary_runtime_context_refs.forbidden_body_display,
    ['domain artifact body', 'memory body', 'quality verdict body', 'provider implementation details'],
    `${candidate.id} evidence secondary_runtime_context_refs.forbidden_body_display`,
  );
  assertStringArrayIncludes(
    evidence.secondary_runtime_context_refs.renderer_testids,
    ['opl-runtime-summary', 'opl-secondary-runtime-context', 'opl-runtime-context-group', 'opl-runtime-context-item'],
    `${candidate.id} evidence secondary_runtime_context_refs.renderer_testids`,
  );
  if (evidence.conversation_event_rendering?.display_policy !== 'summary_first_compact_conversation_events_or_expandable_refs') {
    throw new Error(`${candidate.id} evidence must render runtime events as compact conversation events or expandable refs`);
  }
  assertStringArrayIncludes(
    evidence.conversation_event_rendering.event_kinds,
    requiredConversationEventKinds,
    `${candidate.id} evidence conversation_event_rendering.event_kinds`,
  );
  assertStringArrayIncludes(
    evidence.conversation_event_rendering.forbidden_visible_protocol_copy,
    ['AG-UI event name', 'ACP wire detail', 'app-server raw frame'],
    `${candidate.id} evidence conversation_event_rendering.forbidden_visible_protocol_copy`,
  );
  assertStringArrayIncludes(
    evidence.conversation_event_rendering.renderer_testids,
    ['opl-conversation-event', 'opl-event-feed'],
    `${candidate.id} evidence conversation_event_rendering.renderer_testids`,
  );
  if (
    evidence.webui_parity?.shared_renderer !== true ||
    evidence.webui_parity?.bridge_shape !== 'window.oplCandidate' ||
    evidence.webui_parity?.product_profile !== 'src/generated/oplProductProfile.generated.json' ||
    evidence.webui_parity?.desktop_and_webui_default_home !== 'chat_first_default_collapsed'
  ) {
    throw new Error(`${candidate.id} evidence must prove WebUI uses the same renderer, bridge shape, product profile, and default home semantics as Electron`);
  }
  const evidenceSeriesDisplay = evidence.foundry_agent_series_display_contract;
  if (evidenceSeriesDisplay?.authority !== 'opl_framework_shared_progress_projection') {
    throw new Error(`${candidate.id} evidence must bind Foundry series display to the shared OPL progress projection`);
  }
  assertStringArrayIncludes(
    evidenceSeriesDisplay.required_shared_progress_fields,
    requiredSeriesProgressFields,
    `${candidate.id} evidence foundry_agent_series_display_contract.required_shared_progress_fields`,
  );
  assertStringArrayIncludes(
    evidenceSeriesDisplay.forbidden_domain_fields,
    forbiddenSeriesDomainFields,
    `${candidate.id} evidence foundry_agent_series_display_contract.forbidden_domain_fields`,
  );
  if (evidence.user_visible_protocol_copy?.copilotkit_surface !== true) {
    throw new Error(`${candidate.id} evidence must prove CopilotKit is the visible UI runtime surface`);
  }
  if (evidence.user_visible_protocol_copy?.agui !== false) {
    throw new Error(`${candidate.id} evidence must keep AG-UI protocol copy hidden from ordinary UI`);
  }
  if (
    evidence.default_home_layout?.policy !== 'ordinary home opens on the chat canvas only; workspace/session rail and inspector stay collapsed until the user explicitly opens them'
    || evidence.default_home_layout?.workspace_rail_default_open !== false
    || evidence.default_home_layout?.inspector_default_open !== false
  ) {
    throw new Error(`${candidate.id} evidence must prove ordinary home defaults to collapsed side context`);
  }
  assertStringArrayIncludes(
    evidence.default_home_layout?.stage_classes ?? [],
    ['without-rail', 'without-inspector'],
    `${candidate.id} evidence default_home_layout.stage_classes`,
  );
  if (
    evidence.webui_transport?.renderer !== 'src/renderer/App.jsx'
    || evidence.webui_transport?.electron_transport !== 'src/main/preload.cjs'
    || evidence.webui_transport?.web_transport !== 'src/renderer/web-bridge.js'
    || evidence.webui_transport?.gateway !== 'scripts/dev-webui-server.js'
    || evidence.webui_transport?.shared_surface !== true
    || evidence.webui_transport?.events !== 'GET /api/codex-events uses SSE for Codex app-server events'
  ) {
    throw new Error(`${candidate.id} evidence must prove shared Electron/WebUI renderer transport`);
  }
  if (
    evidence.pilotdeck_reference?.source_usage !== 'design_reference_only'
    || evidence.pilotdeck_reference?.license !== 'AGPL-3.0'
    || evidence.pilotdeck_reference?.copied_source !== false
    || evidence.pilotdeck_reference?.runtime_authority_transfer !== false
  ) {
    throw new Error(`${candidate.id} evidence must keep PilotDeck reference-only with no copied source or runtime authority transfer`);
  }
  assertStringArrayIncludes(
    evidence.pilotdeck_reference?.mapped_surfaces ?? [],
    [
      'lightweight workspace/session rail',
      'chat-first main canvas',
      'workspace/session rail and inspector collapsed by default on ordinary home',
      'Files, Skills, Routing, Memory, Always-On as right-side collapsible inspector tabs',
      'runtime and event receipts in secondary context',
    ],
    `${candidate.id} evidence PilotDeck mapped surfaces`,
  );
  for (const [surface, expected] of Object.entries({
    state: expectedFrameworkSurfaces.state,
    refresh: expectedFrameworkSurfaces.refresh,
    full_state: expectedFrameworkSurfaces.full_state,
    initialize: 'opl system initialize --json',
    full_drilldown: expectedFrameworkSurfaces.full_drilldown,
    action: expectedFrameworkSurfaces.action,
  })) {
    if (evidence.framework_surfaces?.[surface] !== expected) {
      throw new Error(`${candidate.id} evidence framework_surfaces.${surface} must be ${expected}`);
    }
  }
  const pageStateMatrix = readJson<{ pages: Array<{ id: string }> }>(pageStateMatrixPath);
  assertStringArrayIncludes(
    evidence.page_state_matrix_mapping?.page_ids ?? [],
    pageStateMatrix.pages.map((page) => page.id),
    `${candidate.id} evidence page-state mapped pages`,
  );
  assertStringArrayIncludes(evidence.page_state_matrix_mapping?.runtime_testids ?? [], [
    ...requiredContextTestIds,
    'opl-runtime-summary',
    'opl-runtime-full-detail-button',
    'opl-runtime-action-dry-run',
    'opl-runtime-action-receipt',
  ], `${candidate.id} evidence runtime testids`);
  assertStringArrayIncludes(evidence.page_state_matrix_mapping?.settings_testids ?? [], [
    'opl-settings-overview',
  ], `${candidate.id} evidence settings testids`);
  const firstRunMatrix = readJson<{
    scenarios: Array<{ id: string; required_shell_testids?: string[] }>;
  }>(firstRunMatrixPath);
  const beginnerScenario = firstRunMatrix.scenarios.find((scenario) => scenario.id === 'beginner_simplified_first_run_clean_machine');
  assertStringArrayIncludes(
    evidence.first_run_matrix_mapping?.required_shell_testids ?? [],
    beginnerScenario?.required_shell_testids ?? [],
    `${candidate.id} evidence first-run required testids`,
  );
  if (evidence.runtime_summary_detail_action_bridge?.full_detail_policy !== 'on_demand_only') {
    throw new Error(`${candidate.id} evidence must keep full detail on demand only`);
  }
  if (evidence.runtime_summary_detail_action_bridge?.action_policy !== 'dry_run_first_operator_selected_safe_app_action_route') {
    throw new Error(`${candidate.id} evidence must use dry-run-first safe app action route policy`);
  }
}

function main(): void {
  const args = parseArgs(process.argv);
  const registry = readJson<ShellCandidateRegistry>(registryPath);
  validateRegistryShape(registry);
  validateActiveShellUnaffected();

  const candidates = args.candidate
    ? registry.candidates.filter((candidate) => candidate.id === args.candidate)
    : registry.candidates;
  if (candidates.length === 0) {
    throw new Error(`No shell candidate matched ${args.candidate}`);
  }
  for (const candidate of candidates) {
    validateCandidate(candidate);
    if (args.runCandidateCommands) {
      runCandidateCommands(candidate);
    }
  }
  console.log(JSON.stringify({
    status: 'shell_candidates_valid',
    active_shell_unchanged: registry.active_shell_unchanged,
    candidate_count: candidates.length,
    candidates: candidates.map((candidate) => candidate.id),
    release_participation: 'explicit_candidate_build_only_until_adopted',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
