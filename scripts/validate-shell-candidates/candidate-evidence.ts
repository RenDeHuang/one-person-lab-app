import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type {
  ShellCandidate,
  ShellCandidateEntry,
  ShellCandidateRoleTombstone,
  ValidationCommand,
} from './types.ts';
import {
  isCandidateRoleTombstone,
  requiredNativeVisualParitySurfaces,
  validateCandidateImplementationFiles,
} from './candidate-contract.ts';
import {
  assertDirectory,
  assertFile,
  assertNoAbsoluteSymlinks,
  assertRelativePath,
  assertStringArrayIncludes,
  expectedFrameworkSurfaces,
  findMacAppExecutable,
  forbiddenLegacySettingsTabs,
  forbiddenSeriesDomainFields,
  readJson,
  requiredContextTestIds,
  requiredConversationEventKinds,
  requiredHomeEntries,
  requiredNativeCapabilities,
  requiredSeriesProgressFields,
  requiredSettingsTabs,
  root,
  validateActiveProjectLineStateModel,
} from './shared.ts';

type OPLStudioPackageManifest = Record<string, unknown> & {
  status: string;
  package_kind: string;
  app_bundle_path: string;
  app_bundle_executable?: string;
  product_profile_owner: string;
  default_release_shell_unchanged: boolean;
  active_shell_adopted: boolean;
  runtime_authority_transfer: boolean;
  domain_truth_owned: boolean;
  home_purpose_entries: string[];
  implemented_capabilities?: string[];
  context_testids?: string[];
};

const studioPackageFields = {
  default_release_shell_unchanged: true,
  active_shell_adopted: false,
  runtime_authority_transfer: false,
  domain_truth_owned: false,
};

export function runCandidateCommands(candidate: ShellCandidateEntry): void {
  if (isCandidateRoleTombstone(candidate)) {
    runRoleTombstoneReplayCommands(candidate);
    return;
  }
  if (candidate.id !== 'opl-studio') {
    throw new Error(`Only the foreground Native candidate may own full candidate evidence: ${candidate.id}`);
  }

  for (const entry of candidate.validation_commands) {
    if (entry.optional) continue;
    runRequiredCommand(candidate.id, 'validation', entry);
    if (entry.id === 'candidate_app_bundle_build') {
      validateOPLStudioPackageManifest(candidate, { requireSmoke: false });
    }
    if (entry.id === 'candidate_packaged_first_run_smoke') {
      validateOPLStudioPackageManifest(candidate, { requireSmoke: true });
    }
  }

  validateCandidateImplementationFiles(candidate);
  validateOPLStudioImplementationEvidenceFile(candidate);
}

function runRoleTombstoneReplayCommands(candidate: ShellCandidateRoleTombstone): void {
  const adapter = readJson<{ validation_commands?: ValidationCommand[] }>(
    path.join(root, candidate.adapter_contract),
  );
  const commands = adapter.validation_commands ?? [];
  if (commands.length === 0) {
    throw new Error(`${candidate.id} replay adapter must expose validation_commands`);
  }
  for (const entry of commands) {
    if (!entry.optional) runRequiredCommand(candidate.id, 'adapter replay', entry);
  }
}

function runRequiredCommand(candidateId: string, commandKind: string, entry: ValidationCommand): void {
  const result = spawnSync(entry.command, {
    cwd: path.join(root, entry.cwd),
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${candidateId} ${commandKind} command failed: ${entry.id}`);
  }
}

function validateOPLStudioPackageManifest(
  candidate: ShellCandidate,
  options: { requireSmoke?: boolean } = { requireSmoke: true },
): void {
  const manifestPath = path.join(
    root,
    candidate.candidate_root,
    'out',
    'opl-studio-candidate-manifest.json',
  );
  assertFile(manifestPath, `${candidate.id} package manifest`);
  const manifest = readJson<OPLStudioPackageManifest>(manifestPath);

  if (manifest.status !== 'candidate_app_bundle_built') {
    throw new Error(`${candidate.id} package manifest must declare candidate_app_bundle_built`);
  }
  if (manifest.package_kind !== 'explicit_candidate_app_bundle') {
    throw new Error(`${candidate.id} package manifest must declare explicit_candidate_app_bundle`);
  }
  if (!manifest.app_bundle_path?.endsWith('.app')) {
    throw new Error(`${candidate.id} package manifest must point at a .app bundle`);
  }
  assertRelativePath(manifest.app_bundle_path, `${candidate.id} package manifest app_bundle_path`);
  const appBundleRoot = path.join(root, candidate.candidate_root, manifest.app_bundle_path);
  assertDirectory(appBundleRoot, `${candidate.id} .app bundle`);
  assertFile(path.join(appBundleRoot, 'Contents', 'Info.plist'), `${candidate.id} .app Info.plist`);
  const macOsDir = path.join(appBundleRoot, 'Contents', 'MacOS');
  assertDirectory(macOsDir, `${candidate.id} .app Contents/MacOS`);
  if (
    manifest.app_bundle_executable !== 'One Person Lab Preview'
    || findMacAppExecutable(macOsDir, candidate.id) !== 'One Person Lab Preview'
  ) {
    throw new Error(`${candidate.id} .app bundle must use the One Person Lab Preview executable name`);
  }
  assertNoAbsoluteSymlinks(appBundleRoot, candidate.id);
  if (manifest.product_profile_owner !== 'one-person-lab-app') {
    throw new Error(`${candidate.id} package manifest must prove App-owned product profile input`);
  }

  assertManifestFieldValues(candidate, manifest, studioPackageFields);
  assertStringArrayIncludes(
    manifest.home_purpose_entries,
    requiredHomeEntries,
    `${candidate.id} package manifest purpose entries`,
  );
  assertStringArrayIncludes(
    manifest.implemented_capabilities ?? [],
    requiredNativeCapabilities,
    `${candidate.id} package manifest implemented capabilities`,
  );
  assertStringArrayIncludes(
    manifest.context_testids ?? [],
    requiredContextTestIds,
    `${candidate.id} package manifest context testids`,
  );
  if (options.requireSmoke !== false) {
    assertManifestFieldValues(candidate, manifest, {
      source_ui_smoke_status: 'passed',
      packaged_ui_smoke_status: 'passed',
      webui_smoke_status: 'passed',
      state_model_status: 'passed',
      action_dry_run_status: 'passed',
      webui_parity_status: 'passed',
    });
  }
}

function assertManifestFieldValues(
  candidate: ShellCandidate,
  manifest: Record<string, unknown>,
  expectedValues: Record<string, string | boolean>,
): void {
  for (const [field, expected] of Object.entries(expectedValues)) {
    if (manifest[field] !== expected) {
      throw new Error(`${candidate.id} package manifest ${field} must be ${String(expected)}`);
    }
  }
}

function validateOPLStudioImplementationEvidenceFile(candidate: ShellCandidate): void {
  const evidencePath = path.join(root, candidate.candidate_root, 'src', 'candidateContractEvidence.json');
  assertFile(evidencePath, `${candidate.id} contract evidence`);
  const evidence = readJson<Record<string, any>>(evidencePath);
  if (evidence.owner !== 'one-person-lab-app' || evidence.shell !== candidate.id) {
    throw new Error(`${candidate.id} evidence must be App-owned and match the candidate id`);
  }
  validateOPLStudioImplementationEvidence(candidate, evidence);
}

function validateOPLStudioImplementationEvidence(
  candidate: ShellCandidate,
  evidence: Record<string, any>,
): void {
  assertStringArrayIncludes(
    evidence.capabilities ?? [],
    requiredNativeCapabilities,
    `${candidate.id} evidence capabilities`,
  );
  validateActiveProjectLineStateModel(
    evidence.active_project_line_state_model,
    `${candidate.id} evidence active_project_line_state_model`,
  );
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
  if (
    evidence.default_home_layout?.policy !== 'ordinary home uses the directly reused DeepSeek Harness chat-first composition baseline: workspace rail visible, conversation dominant, composer persistent, and secondary context closed until requested'
    || evidence.default_home_layout?.workspace_rail_default_open !== true
    || evidence.default_home_layout?.inspector_default_open !== false
  ) {
    throw new Error(`${candidate.id} evidence must prove the DeepSeek Harness chat-first layout is the default and secondary context stays closed`);
  }

  validateDeepSeekHarnessCompositionEvidence(
    candidate.id,
    evidence.default_home_layout,
  );

  if (
    evidence.webui_transport?.renderer !== 'src/workbench/App.tsx'
    || evidence.webui_transport?.host_core !== 'scripts/webui-host/host-core.mjs'
    || evidence.webui_transport?.native_host !== 'desktop/main.mjs'
    || evidence.webui_transport?.native_transport !== 'desktop/preload.cjs#window.oplStudio'
    || evidence.webui_transport?.web_transport !== 'src/bridge/webTransport.ts'
    || evidence.webui_transport?.gateway !== 'scripts/dev-webui-server.mjs'
    || evidence.webui_transport?.shared_surface !== true
    || evidence.webui_transport?.events !== 'GET /api/opl-events uses SSE for Codex App Server and typed host events'
  ) {
    throw new Error(`${candidate.id} evidence must prove one renderer and shared Node host core across Electron desktop and WebUI adapters`);
  }
  if (
    evidence.reuse_policy?.deepseek_harness_source_usage !== 'direct_mit_package_and_selected_source_reuse'
    || evidence.reuse_policy?.deepseek_harness_source_ref !== '47f943859bef60e4160492346772ded9b24f765a'
    || evidence.reuse_policy?.deepseek_harness_selected_source_reused !== true
    || evidence.reuse_policy?.kdense_source_usage !== 'experience_reference_only'
    || evidence.reuse_policy?.openclaudescience_source_usage !== 'experience_reference_only'
    || evidence.reuse_policy?.other_external_gui_source_copied !== false
    || evidence.reuse_policy?.runtime_authority_transfer !== false
  ) {
    throw new Error(`${candidate.id} evidence must prove pinned DeepSeek Harness source reuse while keeping other GUI references non-copied and runtime authority unchanged`);
  }
  assertStringArrayIncludes(
    evidence.reuse_policy?.adopted_patterns ?? [],
    [
      'project sandbox organization',
      'result and artifact delivery panel',
      'structured confirmation forms',
      'rich file preview affordances',
    ],
    `${candidate.id} evidence reuse_policy.adopted_patterns`,
  );
  if (
    evidence.secondary_runtime_context_refs?.authority !== 'opl_framework_refs_only_projection'
    || evidence.secondary_runtime_context_refs?.home_surface_policy !== 'ordinary_home_must_not_render_runtime_activity_or_continue_work'
  ) {
    throw new Error(`${candidate.id} evidence must keep current-task refs Framework-owned and out of ordinary Home`);
  }
  assertStringArrayIncludes(
    evidence.conversation_event_rendering?.event_kinds ?? [],
    requiredConversationEventKinds,
    `${candidate.id} evidence conversation_event_rendering.event_kinds`,
  );
  assertStringArrayIncludes(
    evidence.first_run_matrix_mapping?.required_shell_testids ?? [],
    ['opl-studio-root', 'opl-model-access-entry', 'opl-skip-to-chat'],
    `${candidate.id} evidence first-run testids`,
  );
  if (
    evidence.webui_parity?.shared_renderer !== true
    || evidence.webui_parity?.bridge_shape !== 'window.oplStudio'
    || evidence.webui_parity?.product_profile !== 'src/generated/oplProductProfile.generated.json'
    || evidence.webui_parity?.desktop_and_webui_default_home !== 'chat_first_default_collapsed'
  ) {
    throw new Error(`${candidate.id} evidence must prove WebUI and Electron desktop use the same renderer, bridge shape, product profile, and default home semantics`);
  }

  const evidenceSeriesDisplay = evidence.foundry_agent_series_display_contract;
  if (evidenceSeriesDisplay?.authority !== 'opl_framework_shared_progress_projection') {
    throw new Error(`${candidate.id} evidence must bind Foundry series display to the shared OPL progress projection`);
  }
  assertStringArrayIncludes(
    evidenceSeriesDisplay?.required_shared_progress_fields ?? [],
    requiredSeriesProgressFields,
    `${candidate.id} evidence foundry_agent_series_display_contract.required_shared_progress_fields`,
  );
  assertStringArrayIncludes(
    evidenceSeriesDisplay?.forbidden_domain_fields ?? [],
    forbiddenSeriesDomainFields,
    `${candidate.id} evidence foundry_agent_series_display_contract.forbidden_domain_fields`,
  );
  if (
    evidence.user_visible_protocol_copy?.agui !== false
    || evidence.user_visible_protocol_copy?.copilotkit_surface !== false
  ) {
    throw new Error(`${candidate.id} evidence must not present AGUI/CopilotKit as the native ordinary UI surface`);
  }
  for (const [surface, expected] of Object.entries(expectedFrameworkSurfaces)) {
    if (evidence.framework_surfaces?.[surface] !== expected) {
      throw new Error(`${candidate.id} evidence framework_surfaces.${surface} must be ${expected}`);
    }
  }
}

export function validateDeepSeekHarnessProductLayoutContract(
  candidateId: string,
  alignment: Record<string, any> | undefined,
): void {
  if (
    alignment?.reference_product !== 'DeepSeek Harness Web client'
    || alignment?.project_rail !== 'persistent'
    || alignment?.timeline !== 'single_conversation_timeline'
    || alignment?.model_controls !== 'composer_bottom_row'
    || alignment?.reasoning_controls !== 'composer_bottom_row'
    || alignment?.details !== 'dsh_resizable_column_on_desktop_fullscreen_overlay_on_mobile'
    || alignment?.settings_locale_surface !== 'settings'
    || alignment?.model_policy_source !== 'one-person-lab-app/contracts/app-product-profile.json#gui.home.codex_model_display_options'
    || alignment?.model_policy_consumption !== 'dynamic_build_injection_with_minimal_offline_fallback'
  ) {
    throw new Error(`${candidateId} evidence must bind product layout and interaction semantics to the DeepSeek Harness Web client composition`);
  }
  assertStringArrayIncludes(
    alignment.required_surfaces ?? [],
    requiredNativeVisualParitySurfaces,
    `${candidateId} evidence default_home_layout DSH product layout required_surfaces`,
  );
  if (JSON.stringify(alignment.left_rail_items) !== JSON.stringify(['projects', 'conversations', 'search', 'settings'])) {
    throw new Error(`${candidateId} evidence left rail must contain only projects, conversations, search, and settings`);
  }
  if (JSON.stringify(alignment.right_context_modules) !== JSON.stringify(['run_status', 'files_results', 'agents_capabilities'])) {
    throw new Error(`${candidateId} evidence right context must contain only run status, files and results, and agents and capabilities`);
  }
  assertStringArrayIncludes(alignment.runtime_status_sources ?? [], [
    'codex_app_server_current_thread',
    'opl_app_state_active_project_lines',
  ], `${candidateId} evidence runtime_status_sources`);
  if (
    alignment.runtime_detail_slot !== 'ui_contributions.runtime.detail'
    || alignment.files_input_policy !== 'user_selected_files_and_directories_only'
    || alignment.results_policy !== 'owner_projected_artifacts_only_no_action_json'
    || alignment.package_lifecycle_surface !== 'settings'
    || JSON.stringify(alignment.product_identity?.visible_text) !== JSON.stringify(['One Person Lab'])
    || alignment.product_identity?.logo_visible !== false
    || alignment.product_identity?.bundle_icon_allowed !== true
  ) {
    throw new Error(`${candidateId} evidence must preserve runtime contribution, file/result, Settings lifecycle, and text-only identity boundaries`);
  }
}

export function validateDeepSeekHarnessCompositionEvidence(
  candidateId: string,
  defaultHomeLayout: Record<string, any> | undefined,
): void {
  if (
    defaultHomeLayout?.codex_2026_07_11_alignment !== undefined
    || defaultHomeLayout?.codex_design_reference_alignment !== undefined
  ) {
    throw new Error(
      `${candidateId} evidence must not retain Codex visual-alignment contracts after adopting DeepSeek Harness as the GUI source baseline`,
    );
  }
  validateDeepSeekHarnessProductLayoutContract(
    candidateId,
    defaultHomeLayout?.product_layout_contract,
  );
  const visual = defaultHomeLayout?.primary_visual_reference;
  if (
    visual?.reference_product !== 'DeepSeek Harness'
    || visual?.reference_version !== '47f943859bef60e4160492346772ded9b24f765a'
    || visual?.source_usage !== 'direct_mit_gui_source_reuse'
    || visual?.left_side !== 'persistent project and conversation rail with search and Settings only'
    || visual?.center !== 'single dominant conversation timeline with bottom composer'
    || visual?.right_side !== 'on-demand DSH details column for run status, files and results, and agents and capabilities'
  ) {
    throw new Error(`${candidateId} evidence must bind the visible shell to the pinned DeepSeek Harness GUI source cohort`);
  }
  const style = defaultHomeLayout?.visual_style_reference;
  if (
    style?.reference_product !== 'DeepSeek Harness'
    || style?.reference_version !== '47f943859bef60e4160492346772ded9b24f765a'
    || style?.scope !== 'six_pinned_gui_package_source_trees_with_vendor_external_opl_adapters'
    || style?.token_source !== 'src/vendor/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css'
    || style?.font_asset_policy !== 'system_font_stack_no_foreign_font_binary_redistribution'
  ) {
    throw new Error(`${candidateId} evidence must bind visual style to the pinned DeepSeek Harness theme source`);
  }
}
