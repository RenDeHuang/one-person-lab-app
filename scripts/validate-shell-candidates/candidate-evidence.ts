import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { ActiveProjectLineStateModel, ShellCandidate } from './types.ts';
import { validateCandidateImplementationFiles } from './candidate-contract.ts';
import {
  assertDirectory,
  assertFile,
  assertNoAbsoluteSymlinks,
  assertRelativePath,
  assertStringArrayIncludes,
  expectedFrameworkSurfaces,
  findMacAppExecutable,
  firstRunMatrixPath,
  forbiddenLegacySettingsTabs,
  forbiddenSeriesDomainFields,
  pageStateMatrixPath,
  readJson,
  requiredActivityGroups,
  requiredCapabilities,
  requiredContextTestIds,
  requiredConversationEventKinds,
  requiredHomeEntries,
  requiredSeriesProgressFields,
  requiredSettingsTabs,
  root,
  validateActiveProjectLineStateModel,
} from './shared.ts';

export function runCandidateCommands(candidate: ShellCandidate): void {
  for (const entry of candidate.validation_commands) {
    if (entry.optional) {
      continue;
    }
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
    if (entry.id === 'candidate_packaged_first_run_smoke') {
      validateCandidatePackageManifest(candidate, { requireSmoke: true });
    }
  }
  validateCandidateImplementationFiles(candidate);
  if (candidate.id === 'hermes-codex') {
    validateHermesCandidateSourceReceipt(candidate);
  } else {
    validateCandidateImplementationEvidence(candidate);
  }
}

function validateCandidatePackageManifest(candidate: ShellCandidate, options: { requireSmoke?: boolean } = { requireSmoke: true }): void {
  if (candidate.id === 'hermes-codex') {
    validateHermesCandidatePackageManifest(candidate, options);
    return;
  }

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
      responsive_context_layer_status: 'passed',
    })) {
      if ((manifest as Record<string, unknown>)[field] !== expected) {
        throw new Error(`${candidate.id} package manifest ${field} must be ${expected}`);
      }
    }
    if (
      Number((manifest as Record<string, unknown>).responsive_context_layer_width ?? 9999) > 1020 ||
      (manifest as Record<string, unknown>).responsive_inspector_visible !== true ||
      (manifest as Record<string, unknown>).responsive_context_tabs_visible !== true ||
      (manifest as Record<string, unknown>).responsive_routing_tab_visible !== true
    ) {
      throw new Error(`${candidate.id} package manifest must prove narrow desktop/WebUI context layers are visibly usable`);
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

function validateHermesCandidatePackageManifest(candidate: ShellCandidate, options: { requireSmoke?: boolean } = { requireSmoke: true }): void {
  const manifestPath = path.join(root, candidate.candidate_root, 'out', 'hermes-codex-candidate-manifest.json');
  assertFile(manifestPath, `${candidate.id} package manifest`);
  const manifest = readJson<{
    status: string;
    package_kind: string;
    app_bundle_path: string;
    app_bundle_executable?: string;
    default_release_shell_unchanged: boolean;
    active_shell_adopted: boolean;
    hermes_runtime_authority_transfer: boolean;
    official_hermes_backend_preserved: boolean;
    official_hermes_desktop_ui_reused: boolean;
    backend_bridge?: {
      codex_runtime_reference?: string;
      protocol_mapping?: Record<string, string>;
    };
    implemented_capabilities?: string[];
    deferred_until_feature_comparison?: string[];
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
  const executable = findMacAppExecutable(macOsDir, candidate.id);
  if (manifest.app_bundle_executable !== 'One Person Lab Hermes Candidate' || executable !== manifest.app_bundle_executable) {
    throw new Error(`${candidate.id} .app bundle must use the OPL branded executable name`);
  }
  if (fs.existsSync(path.join(macOsDir, 'Electron'))) {
    throw new Error(`${candidate.id} .app bundle must not expose the legacy Electron executable name`);
  }
  assertNoAbsoluteSymlinks(appBundleRoot, candidate.id);
  if (options.requireSmoke !== false) {
    validateHermesPackagedSmoke(candidate);
  }
  for (const [field, expected] of Object.entries({
    default_release_shell_unchanged: true,
    active_shell_adopted: false,
    hermes_runtime_authority_transfer: false,
    official_hermes_backend_preserved: true,
    official_hermes_desktop_ui_reused: true,
  })) {
    if ((manifest as Record<string, unknown>)[field] !== expected) {
      throw new Error(`${candidate.id} package manifest ${field} must be ${String(expected)}`);
    }
  }
  if (manifest.backend_bridge?.codex_runtime_reference !== 'codex app-server --listen stdio://') {
    throw new Error(`${candidate.id} package manifest must prove the Codex app-server runtime reference`);
  }
  for (const [hermesMethod, codexEvent] of Object.entries({
    'session.create': 'thread/start',
    'prompt.submit': 'turn/start',
    'item/agentMessage/delta': 'message.delta',
    'turn/completed': 'message.complete',
  })) {
    if (manifest.backend_bridge?.protocol_mapping?.[hermesMethod] !== codexEvent) {
      throw new Error(`${candidate.id} package manifest protocol_mapping.${hermesMethod} must be ${codexEvent}`);
    }
  }
  assertStringArrayIncludes(
    manifest.implemented_capabilities ?? [],
    [
      'official_hermes_desktop_ui_reused',
      'official_hermes_backend_preserved',
      'opl_defaults_seed_for_codex_runtime_and_domain_skills',
      'codex_app_server_backed_hermes_gateway_adapter',
      'opl_branding_and_icon_replaced',
      'candidate_app_bundle_package',
    ],
    `${candidate.id} package manifest implemented capabilities`,
  );
  assertStringArrayIncludes(
    manifest.deferred_until_feature_comparison ?? [],
    [
      'opl_app_state_action_bridge',
      'app_product_profile_mapping',
      'page_state_matrix_mapping',
      'first_run_matrix_mapping',
      'packaged_full_runtime',
      'stable_release_asset_normalization',
    ],
    `${candidate.id} package manifest deferred_until_feature_comparison`,
  );
}

function validateHermesPackagedSmoke(candidate: ShellCandidate): void {
  const summaryPath = path.join(root, candidate.candidate_root, 'out', 'smoke-opl-first-run', 'summary.json');
  assertFile(summaryPath, `${candidate.id} packaged first-run smoke summary`);
  const summary = readJson<{
    status: string;
    executable_path: string;
    cases?: Record<string, {
      calls?: string[];
      copiedLogPath?: string;
      copiedCallsPath?: string;
      gateway?: {
        purpose_route_count?: number;
        status?: {
          backend?: string;
          provider_configured?: boolean;
        };
      };
      chatEvidence?: {
        message_complete?: boolean;
        assistant_delta?: string;
        route_event_type?: string | null;
        route_status?: string | null;
      } | null;
    }>;
  }>(summaryPath);
  if (summary.status !== 'opl_hermes_packaged_first_run_smoke_passed') {
    throw new Error(`${candidate.id} packaged first-run smoke summary must pass`);
  }
  if (!summary.executable_path?.endsWith('/Contents/MacOS/One Person Lab Hermes Candidate')) {
    throw new Error(`${candidate.id} packaged smoke must run the OPL branded executable`);
  }
  const requiredCases = [
    'missing_key',
    'missing_key_hot_launch',
    'configured_key',
    'configured_key_hot_launch',
    'fast_probe_not_ready_first_run',
  ];
  for (const caseId of requiredCases) {
    const smokeCase = summary.cases?.[caseId];
    if (!smokeCase) {
      throw new Error(`${candidate.id} packaged smoke missing case ${caseId}`);
    }
    if (smokeCase.gateway?.status?.backend !== 'codex-app-server-adapter') {
      throw new Error(`${candidate.id} packaged smoke ${caseId} must prove Codex app-server adapter backend`);
    }
    if (Number(smokeCase.gateway?.purpose_route_count ?? 0) < 4) {
      throw new Error(`${candidate.id} packaged smoke ${caseId} must expose MAS/MAG/RCA/OPL purpose routes`);
    }
    if (smokeCase.copiedLogPath) {
      assertFile(resolveHermesSmokePath(candidate, smokeCase.copiedLogPath), `${candidate.id} packaged smoke ${caseId} copied log`);
    }
  }
  const configured = summary.cases?.configured_key;
  if (configured?.gateway?.status?.provider_configured !== true) {
    throw new Error(`${candidate.id} configured packaged smoke must prove model access is configured`);
  }
  if (
    configured?.chatEvidence?.message_complete !== true ||
    !configured.chatEvidence.assistant_delta?.includes('fixture codex response') ||
    configured.chatEvidence.route_event_type !== 'route.receipt' ||
    configured.chatEvidence.route_status !== 'route_readback_ready'
  ) {
    throw new Error(`${candidate.id} configured packaged smoke must prove Codex turn plus MAS route receipt`);
  }
  const missing = summary.cases?.missing_key;
  if (missing?.gateway?.status?.provider_configured !== false) {
    throw new Error(`${candidate.id} missing-key packaged smoke must prove model access is not configured`);
  }
  const configuredCalls = summary.cases?.configured_key_hot_launch?.calls ?? [];
  if (configuredCalls.includes('system initialize --json')) {
    const logPath = summary.cases?.configured_key_hot_launch?.copiedLogPath;
    const log = logPath && fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    const adapterReadyIndex = log.indexOf('OPL Codex adapter is ready. Finalizing desktop startup');
    const backgroundIndex = log.indexOf('starting deferred OPL startup maintenance after adapter readiness');
    if (adapterReadyIndex < 0 || backgroundIndex <= adapterReadyIndex) {
      throw new Error(`${candidate.id} hot-launch full initialize must be deferred until after adapter readiness`);
    }
  }
}

function resolveHermesSmokePath(candidate: ShellCandidate, filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(root, candidate.candidate_root, filePath);
}

function validateHermesCandidateSourceReceipt(candidate: ShellCandidate): void {
  const receiptPath = path.join(root, candidate.candidate_root, 'out', 'hermes-codex-source-receipt.json');
  assertFile(receiptPath, `${candidate.id} source receipt`);
  const receipt = readJson<{
    shell: string;
    source_repo: string;
    source_path: string;
    license: string;
    active_shell_adopted: boolean;
    hermes_runtime_authority_transfer: boolean;
    backend_bridge?: { codex_runtime_reference?: string };
  }>(receiptPath);
  if (receipt.shell !== candidate.id) {
    throw new Error(`${candidate.id} source receipt must match the candidate id`);
  }
  if (
    receipt.source_repo !== 'https://github.com/NousResearch/hermes-agent' ||
    receipt.source_path !== 'apps/desktop' ||
    receipt.license !== 'MIT'
  ) {
    throw new Error(`${candidate.id} source receipt must prove the MIT Hermes Desktop source basis`);
  }
  if (receipt.active_shell_adopted !== false || receipt.hermes_runtime_authority_transfer !== false) {
    throw new Error(`${candidate.id} source receipt must keep Hermes as a non-adopted candidate without runtime authority transfer`);
  }
  if (receipt.backend_bridge?.codex_runtime_reference !== 'codex app-server --listen stdio://') {
    throw new Error(`${candidate.id} source receipt must prove Codex app-server adapter intent`);
  }
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
    responsive_context_layers?: {
      policy: string;
      narrow_desktop_width_px: number;
      home_default: string;
      opened_context: string;
      required_visible_testids_when_open: string[];
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
    active_project_line_state_model?: ActiveProjectLineStateModel;
  }>(evidencePath);
  if (evidence.owner !== 'one-person-lab-app' || evidence.shell !== candidate.id) {
    throw new Error(`${candidate.id} evidence must be App-owned and match the candidate id`);
  }
  assertStringArrayIncludes(evidence.capabilities, requiredCapabilities, `${candidate.id} evidence capabilities`);
  validateActiveProjectLineStateModel(evidence.active_project_line_state_model, `${candidate.id} evidence active_project_line_state_model`);
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
    ['科研', '基金', '演示'],
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
    ['Med Auto Science', 'Med Auto Grant', 'RedCube AI', 'Codex CLI', 'PPT', 'Local assistant'],
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
    evidence.responsive_context_layers?.policy !== 'workspace rail and inspector remain secondary layers, but explicit toggles must make them visibly usable on narrow desktop and WebUI widths' ||
    evidence.responsive_context_layers?.narrow_desktop_width_px !== 998 ||
    evidence.responsive_context_layers?.home_default !== 'chat_first_collapsed' ||
    evidence.responsive_context_layers?.opened_context !== 'right_inspector_overlay_with_visible_tabs'
  ) {
    throw new Error(`${candidate.id} evidence must define narrow desktop/WebUI context layer behavior`);
  }
  assertStringArrayIncludes(
    evidence.responsive_context_layers?.required_visible_testids_when_open ?? [],
    ['opl-workspace-rail', 'opl-context-tabs', 'opl-routing-panel'],
    `${candidate.id} evidence responsive_context_layers.required_visible_testids_when_open`,
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
