import fs from 'node:fs';
import path from 'node:path';
import type { ShellCandidate } from './types.ts';
import {
  activeAdapterPath,
  assertFile,
  assertStringArrayIncludes,
  expectedFrameworkSurfaces,
  firstRunMatrixPath,
  forbiddenAuthority,
  requiredCapabilities,
  requiredContextSurfaces,
  requiredContextTestIds,
  requiredHomeEntries,
  requiredSeriesProgressFields,
  forbiddenSeriesDomainFields,
  readJson,
  root,
  validateActiveProjectLineStateModel,
} from './shared.ts';

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

export function validateCandidate(candidate: ShellCandidate): void {
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
    candidate.target_product_shape.home_model_selector_visible !== true ||
    candidate.target_product_shape.permission_mode_selector_visible !== false ||
    candidate.target_product_shape.workspace_session_rail_default_visible !== false ||
    candidate.target_product_shape.inspector_default_visible !== false
  ) {
    throw new Error(`${candidate.id} must preserve Codex fixed-executor chat-first home with App-owned model selector and without backend/permission/default side context`);
  }
  assertStringArrayIncludes(candidate.target_product_shape.purpose_entries, requiredHomeEntries, `${candidate.id}.target_product_shape.purpose_entries`);
  if (candidate.target_product_shape.settings_policy !== 'app_state_refs_only') {
    throw new Error(`${candidate.id}.target_product_shape.settings_policy must keep Settings App-owned and refs-only`);
  }
  assertStringArrayIncludes(candidate.technical_verification?.minimum_acceptance ?? [], [
    'candidate state-model validation proves active project line projection consumption from opl app state without domain-ready, production-ready, clean-VM-ready, Full-release-ready, or active-shell-adopted claims',
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
  validateActiveProjectLineStateModel(candidate.active_project_line_state_model, `${candidate.id}.active_project_line_state_model`);
  const stateModelTechnicalCommand = candidate.technical_verification?.candidate_shell_commands?.find((entry) => entry.id === 'state_model');
  if (
    !stateModelTechnicalCommand ||
    stateModelTechnicalCommand.cwd !== candidate.candidate_root ||
    stateModelTechnicalCommand.command !== 'npm run validate:state-model'
  ) {
    throw new Error(`${candidate.id}.technical_verification.candidate_shell_commands must include state_model running npm run validate:state-model from ${candidate.candidate_root}`);
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
    'non-App-owned model override selector',
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
  const stateModelCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_state_model');
  if (!stateModelCommand) {
    throw new Error(`${candidate.id} validation_commands must include candidate_state_model`);
  }
  if (stateModelCommand.cwd !== candidate.candidate_root || stateModelCommand.command !== 'npm run validate:state-model') {
    throw new Error(`${candidate.id} candidate_state_model must run npm run validate:state-model from ${candidate.candidate_root}`);
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
    '"validate:state-model"',
  ], 'package scripts for WebUI');
}

export function validateCandidateImplementationFiles(candidate: ShellCandidate): void {
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
