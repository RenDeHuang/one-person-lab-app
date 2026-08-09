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

type NativeWorkbenchPackageManifest = Record<string, unknown> & {
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

const nativeWorkbenchPackageFields = {
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
  if (candidate.id !== 'opl-native-workbench') {
    throw new Error(`Only the foreground Native candidate may own full candidate evidence: ${candidate.id}`);
  }

  for (const entry of candidate.validation_commands) {
    if (entry.optional) continue;
    runRequiredCommand(candidate.id, 'validation', entry);
    if (entry.id === 'candidate_app_bundle_build') {
      validateNativeWorkbenchPackageManifest(candidate, { requireSmoke: false });
    }
    if (entry.id === 'candidate_packaged_first_run_smoke') {
      validateNativeWorkbenchPackageManifest(candidate, { requireSmoke: true });
    }
  }

  validateCandidateImplementationFiles(candidate);
  validateNativeWorkbenchImplementationEvidenceFile(candidate);
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

function validateNativeWorkbenchPackageManifest(
  candidate: ShellCandidate,
  options: { requireSmoke?: boolean } = { requireSmoke: true },
): void {
  const manifestPath = path.join(
    root,
    candidate.candidate_root,
    'out',
    'opl-native-workbench-candidate-manifest.json',
  );
  assertFile(manifestPath, `${candidate.id} package manifest`);
  const manifest = readJson<NativeWorkbenchPackageManifest>(manifestPath);

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
    manifest.app_bundle_executable !== 'One Person Lab Native'
    || findMacAppExecutable(macOsDir, candidate.id) !== 'One Person Lab Native'
  ) {
    throw new Error(`${candidate.id} .app bundle must use the OPL native workbench executable name`);
  }
  assertNoAbsoluteSymlinks(appBundleRoot, candidate.id);
  if (manifest.product_profile_owner !== 'one-person-lab-app') {
    throw new Error(`${candidate.id} package manifest must prove App-owned product profile input`);
  }

  assertManifestFieldValues(candidate, manifest, nativeWorkbenchPackageFields);
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

function validateNativeWorkbenchImplementationEvidenceFile(candidate: ShellCandidate): void {
  const evidencePath = path.join(root, candidate.candidate_root, 'src', 'candidateContractEvidence.json');
  assertFile(evidencePath, `${candidate.id} contract evidence`);
  const evidence = readJson<Record<string, any>>(evidencePath);
  if (evidence.owner !== 'one-person-lab-app' || evidence.shell !== candidate.id) {
    throw new Error(`${candidate.id} evidence must be App-owned and match the candidate id`);
  }
  validateNativeWorkbenchImplementationEvidence(candidate, evidence);
}

function validateNativeWorkbenchImplementationEvidence(
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
    evidence.default_home_layout?.policy !== 'ordinary home opens with the Codex project and conversation rail visible, the chat canvas dominant, model and reasoning controls in the composer, and the inspector closed until explicitly requested'
    || evidence.default_home_layout?.workspace_rail_default_open !== true
    || evidence.default_home_layout?.inspector_default_open !== false
  ) {
    throw new Error(`${candidate.id} evidence must prove the Codex project rail is visible and the environment inspector is closed by default`);
  }

  validateCodexDesignReferenceEvidence(
    candidate.id,
    evidence.default_home_layout,
  );

  if (
    evidence.webui_transport?.renderer !== 'src/workbench/App.tsx'
    || evidence.webui_transport?.native_host !== 'scripts/native-workbench-app.swift'
    || evidence.webui_transport?.native_transport !== 'src/main.tsx#installNativeTransport'
    || evidence.webui_transport?.web_transport !== 'src/bridge/webTransport.ts'
    || evidence.webui_transport?.gateway !== 'scripts/dev-webui-server.mjs'
    || evidence.webui_transport?.shared_surface !== true
    || evidence.webui_transport?.events !== 'GET /api/opl-events uses SSE for Codex App Server and typed host events'
  ) {
    throw new Error(`${candidate.id} evidence must prove shared Swift packaged macOS/WebUI renderer transport`);
  }
  if (
    evidence.reuse_policy?.kdense_source_usage !== 'experience_reference_only'
    || evidence.reuse_policy?.openclaudescience_source_usage !== 'experience_reference_only'
    || evidence.reuse_policy?.copied_source !== false
    || evidence.reuse_policy?.runtime_authority_transfer !== false
  ) {
    throw new Error(`${candidate.id} evidence must keep K-Dense/OpenClaudeScience as experience references without copied source or runtime authority transfer`);
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
    ['opl-native-workbench-root', 'opl-model-access-entry', 'opl-skip-to-chat'],
    `${candidate.id} evidence first-run testids`,
  );
  if (
    evidence.webui_parity?.shared_renderer !== true
    || evidence.webui_parity?.bridge_shape !== 'window.oplNativeWorkbench'
    || evidence.webui_parity?.product_profile !== 'src/generated/oplProductProfile.generated.json'
    || evidence.webui_parity?.desktop_and_webui_default_home !== 'chat_first_default_collapsed'
  ) {
    throw new Error(`${candidate.id} evidence must prove WebUI uses the same native renderer, bridge shape, product profile, and default home semantics as the packaged macOS host`);
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

export function validateCodexDesignReferenceAlignment(
  candidateId: string,
  alignment: Record<string, any> | undefined,
): void {
  const fixedExternalIdentityFields = [
    'reference_version',
    'reference_build',
    'reference_observed_at',
    'observed_on',
    'current_reference_status',
  ];
  if (
    alignment?.project_rail !== 'persistent'
    || alignment?.timeline !== 'single_conversation_timeline'
    || alignment?.model_controls !== 'composer_bottom_row'
    || alignment?.reasoning_controls !== 'composer_bottom_row'
    || alignment?.environment_details !== 'floating_on_demand'
    || alignment?.settings_locale_surface !== 'settings'
    || alignment?.model_policy_source !== 'one-person-lab-app/contracts/app-product-profile.json#gui.home.codex_model_display_options'
    || alignment?.model_policy_consumption !== 'dynamic_build_injection_with_minimal_offline_fallback'
    || fixedExternalIdentityFields.some((field) => field in alignment)
  ) {
    throw new Error(`${candidateId} evidence must prove stable Codex-style interaction semantics without pinning current conformance to an external product build`);
  }
  assertStringArrayIncludes(
    alignment.required_surfaces ?? [],
    requiredNativeVisualParitySurfaces,
    `${candidateId} evidence default_home_layout Codex design reference required_surfaces`,
  );
}

export function validateCodexDesignReferenceEvidence(
  candidateId: string,
  defaultHomeLayout: Record<string, any> | undefined,
): void {
  if (defaultHomeLayout?.codex_2026_07_11_alignment !== undefined) {
    throw new Error(
      `${candidateId} evidence legacy codex_2026_07_11_alignment is historical provenance and cannot satisfy current conformance`,
    );
  }
  validateCodexDesignReferenceAlignment(
    candidateId,
    defaultHomeLayout?.codex_design_reference_alignment,
  );
}
