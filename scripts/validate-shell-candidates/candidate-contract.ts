import fs from 'node:fs';
import path from 'node:path';
import type {
  NativeThreadAdapterBoundary,
  ShellCandidate,
  ShellCandidateEntry,
  ShellCandidateRegistry,
  ShellCandidateRoleTombstone,
  ValidationCommand,
} from './types.ts';
import {
  assertFile,
  assertStringArrayIncludes,
  expectedFrameworkSurfaces,
  forbiddenAuthority,
  requiredContextSurfaces,
  requiredContextTestIds,
  requiredHomeEntries,
  requiredSeriesProgressFields,
  forbiddenSeriesDomainFields,
  readJson,
  requiredNativeCapabilities,
  requiredNativeThreadCapabilities,
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

function missingCandidateCheckoutCanBeBlocked(candidate: ShellCandidate): boolean {
  return Boolean(
    !fs.existsSync(path.join(root, candidate.candidate_root))
    && candidate.checkout_policy?.missing_checkout_status === 'blocked_missing_checkout'
    && candidate.build_wrapper?.missing_checkout_blocker_allowed === true
  );
}

type CandidateAdapterContract = {
  purpose?: string;
  state?: string;
  adapter_id?: string;
  candidate_shell?: string;
  adapter_role?: string;
  active_shell?: string;
  candidate_stage?: string;
  shell_root: string;
  shell_source: { owner_repo: string; history_policy: string; checkout_path: string };
  release_role: string;
  gui_authority?: { implementation_role?: string };
  codex_executable_contract?: {
    resolver_env?: string;
    carrier?: {
      kind?: string;
      manifest_parser_owner?: string | null;
      aioncore_required?: boolean;
    };
  };
  shell_contract: { source_topology: string; capabilities: string[] };
  validation_commands: ValidationCommand[];
  thread_adapter_boundary?: NativeThreadAdapterBoundary;
};

type NativeVisualParityContract = NonNullable<ShellCandidate['visual_parity_contract']> & {
  regression_floor?: string;
  source_usage?: string;
  current_reference_status?: string;
  visual_style_baseline?: string;
  visual_style_scope?: string;
  visual_token_source?: string;
  font_asset_policy?: string;
  superseded_observations?: string[];
  model_policy_source?: string;
  default_model?: string;
  default_reasoning_effort?: string;
  required_surfaces?: string[];
};

export const requiredNativeVisualParitySurfaces = [
  'persistent_project_rail',
  'single_conversation_timeline',
  'composer_model_and_reasoning_controls',
  'floating_on_demand_environment',
  'settings_locale_surface',
];

const requiredNativeThreadProtocols = [
  'thread/list',
  'thread/read',
  'thread/start',
  'thread/resume',
  'thread/fork',
  'thread/archive',
  'thread/unarchive',
  'turn/start',
  'turn/steer',
];

const forbiddenNativePrivateCapabilities = [
  'typed_cross_top_level_thread_host_bridge',
  'client_executed_dynamic_tools_coordination_bridge',
  'local_cross_thread_p0_p1',
  'thread_list_read_resume_fork_archive_unarchive',
  'turn_start_steer_with_host_queue',
  'cross_thread_codex_permission_and_advisory_audit',
  'bilateral_coordination_receipts',
  'desktop_webui_coordination_parity',
  'remote_host_aggregation_p2_deferred',
];

const requiredNativeSubagentMetadata = ['parentThreadId', 'agentRole', 'agentNickname'];
const requiredNativeSubagentSourceKinds = [
  'subAgent',
  'subAgentReview',
  'subAgentCompact',
  'subAgentThreadSpawn',
  'subAgentOther',
];
const requiredNativeSubagentItemTypes = ['collabAgentToolCall', 'subAgentActivity'];

const appProductProfile = readJson<{
  codex: { default_model: string; default_reasoning_effort: string };
}>(path.join(root, 'contracts', 'app-product-profile.json'));
const configuredDefaultModel = appProductProfile.codex.default_model;
const configuredDefaultReasoningEffort = appProductProfile.codex.default_reasoning_effort;

export type CandidateValidationPolicy = {
  onlyForegroundAlternative: string;
  defaultCandidateValidationScope: string[];
  explicitCandidateValidationScope: string[];
  archivedTechnicalProofs: string[];
  archivedProofUpdatePolicy: string;
  referenceOnlyCandidates: string[];
  referenceCandidatePolicy?: string;
};

export function candidateValidationPolicyFromRegistry(registry: ShellCandidateRegistry): CandidateValidationPolicy {
  const alternative = registry.alternative_gui_policy;
  if (!alternative) {
    throw new Error('candidate registry must declare alternative_gui_policy before candidate validation');
  }
  return {
    onlyForegroundAlternative: alternative.only_foreground_alternative,
    defaultCandidateValidationScope: alternative.default_candidate_validation_scope,
    explicitCandidateValidationScope: alternative.explicit_candidate_validation_scope,
    archivedTechnicalProofs: alternative.archived_technical_proofs,
    archivedProofUpdatePolicy: alternative.archived_proof_policy,
    referenceOnlyCandidates: alternative.reference_only_candidates ?? [],
    referenceCandidatePolicy: alternative.reference_candidate_policy,
  };
}

function validateCandidateRegistryEntry(candidate: ShellCandidateEntry, policy: CandidateValidationPolicy): void {
  if (!candidate.id || !candidate.candidate_root) {
    throw new Error(`Invalid candidate entry: ${JSON.stringify(candidate)}`);
  }
  const isArchivedProof = policy.archivedTechnicalProofs.includes(candidate.id);
  const isForegroundAlternative = candidate.id === policy.onlyForegroundAlternative;
  const isDefaultCandidate = policy.defaultCandidateValidationScope.includes(candidate.id);
  const isExplicitCandidate = policy.explicitCandidateValidationScope.includes(candidate.id);
  const isReferenceCandidate = policy.referenceOnlyCandidates.includes(candidate.id);
  const expectedState = isArchivedProof
    ? 'archived_technical_proof'
    : isReferenceCandidate
      ? 'technical_reference'
      : 'technical_verification';
  if (candidate.state !== expectedState) {
    throw new Error(`${candidate.id} must stay in ${expectedState} according to app-shell-candidates alternative_gui_policy`);
  }
  if (!isArchivedProof && !isForegroundAlternative && !isReferenceCandidate) {
    throw new Error(`${candidate.id} must be the foreground alternative, a reference candidate, or an archived technical proof`);
  }
  if (!isExplicitCandidate) {
    throw new Error(`${candidate.id} must be listed in explicit_candidate_validation_scope`);
  }
  if (isArchivedProof && isDefaultCandidate) {
    throw new Error(`${candidate.id} archived technical proof must not enter default candidate validation scope`);
  }
  if (isReferenceCandidate && isDefaultCandidate) {
    throw new Error(`${candidate.id} reference candidate must not enter default candidate validation scope`);
  }
  if (isForegroundAlternative && isDefaultCandidate) {
    throw new Error(`${candidate.id} foreground alternative detail must stay out of default candidate validation scope`);
  }
  if (isArchivedProof) {
    if (!candidate.archived_reason?.includes('AG-UI/CopilotKit work served its technical verification purpose')) {
      throw new Error(`${candidate.id} archived technical proof must record why it is no longer a foreground alternative`);
    }
    if (candidate.default_update_policy !== policy.archivedProofUpdatePolicy) {
      throw new Error(`${candidate.id} archived proof update policy must match alternative_gui_policy.archived_proof_policy`);
    }
  }
  if (!candidate.candidate_root.startsWith('shells/') || candidate.candidate_root.split(/[\\/]+/).includes('..')) {
    throw new Error(`${candidate.id} candidate_root must be under shells/<candidate>`);
  }
  const expectedReleaseParticipation = isArchivedProof
    ? 'explicit_user_requested_technical_replay_only'
    : isReferenceCandidate
      ? 'manual_on_demand_technical_verification_build_only'
      : 'manual_on_demand_technical_evaluation_build_only';
  if (candidate.release_participation !== expectedReleaseParticipation) {
    throw new Error(`${candidate.id} release participation must be ${expectedReleaseParticipation}`);
  }
  if (candidate.source_topology !== 'external_checkout_linked_shell_repo') {
    throw new Error(`${candidate.id} must declare external_checkout_linked_shell_repo topology`);
  }
}

export function isCandidateRoleTombstone(
  candidate: ShellCandidateEntry,
): candidate is ShellCandidateRoleTombstone {
  return 'role_tombstone' in candidate && candidate.role_tombstone === true;
}

function validateCandidateRoleTombstone(
  candidate: ShellCandidateRoleTombstone,
  policy: CandidateValidationPolicy,
): void {
  const expected = candidate.id === 'hermes-codex'
    ? {
        state: 'technical_reference',
        mode: 'manual_on_demand_only',
        command: 'npm run validate:candidate:hermes',
      }
    : candidate.id === 'agui-codex'
      ? {
          state: 'archived_technical_proof',
          mode: 'explicit_user_request_only',
          command: 'npm run validate:candidate:agui',
        }
      : undefined;
  if (!expected) {
    throw new Error(`${candidate.id} must not use the reference/archive role tombstone schema`);
  }
  if (
    candidate.state !== expected.state ||
    candidate.replay.mode !== expected.mode ||
    candidate.replay.validator_command !== expected.command ||
    candidate.replay.source_checkout_policy !== 'optional_until_explicit_replay'
  ) {
    throw new Error(`${candidate.id} role tombstone must preserve its explicit replay route`);
  }
  if (
    candidate.id === policy.onlyForegroundAlternative ||
    policy.defaultCandidateValidationScope.includes(candidate.id)
  ) {
    throw new Error(`${candidate.id} role tombstone must never enter foreground or default detail validation`);
  }
  assertFile(path.join(root, candidate.adapter_contract), `${candidate.id} adapter contract`);
  assertFile(path.join(root, candidate.replay.runbook_ref), `${candidate.id} replay runbook`);
}

function readCandidateAdapterContract(candidate: ShellCandidate): CandidateAdapterContract {
  assertFile(path.join(root, candidate.adapter_contract), `${candidate.id} adapter contract`);
  return readJson<CandidateAdapterContract>(path.join(root, candidate.adapter_contract));
}

export function validateNativeThreadAdapterBoundary(
  boundary: NativeThreadAdapterBoundary | undefined,
): void {
  const expectedBoundaryKeys = [
    'adapter',
    'codex_subagent_projection',
    'private_coordination_layer_allowed',
    'protocol_owner',
    'source_ref',
    'supported_protocols',
    'thread_store_owner',
    'user_initiated_only',
  ];
  if (
    !boundary ||
    JSON.stringify(Object.keys(boundary).sort()) !== JSON.stringify(expectedBoundaryKeys) ||
    boundary.source_ref !==
      'contracts/app-gui-product-contract.json#interaction_baseline.thread_coordination' ||
    boundary.adapter !== 'single_codex_app_server_adapter' ||
    boundary.protocol_owner !== 'codex_core_app_server' ||
    boundary.thread_store_owner !== 'codex_core_app_server' ||
    boundary.user_initiated_only !== true ||
    boundary.private_coordination_layer_allowed !== false ||
    JSON.stringify(boundary.supported_protocols) !==
      JSON.stringify(requiredNativeThreadProtocols)
  ) {
    throw new Error(
      'native candidate thread adapter must stay a single user-initiated Codex App Server adapter with no private coordination layer',
    );
  }

  const subagents = boundary.codex_subagent_projection;
  if (
    JSON.stringify(Object.keys(subagents).sort()) !==
      JSON.stringify(['metadata_fields', 'mode', 'thread_item_types', 'thread_source_kinds']) ||
    subagents.mode !== 'read_only_thread_metadata_and_items' ||
    JSON.stringify(subagents.thread_source_kinds) !==
      JSON.stringify(requiredNativeSubagentSourceKinds) ||
    JSON.stringify(subagents.thread_item_types) !==
      JSON.stringify(requiredNativeSubagentItemTypes) ||
    JSON.stringify(subagents.metadata_fields) !==
      JSON.stringify(requiredNativeSubagentMetadata)
  ) {
    throw new Error(
      'native candidate must preserve Codex subagent metadata, source kinds, and thread items as read-only App Server projections',
    );
  }
}
function validateCandidateAdapterContract(
  candidate: ShellCandidate,
  adapterContract: CandidateAdapterContract,
  policy: CandidateValidationPolicy,
): void {
  if (candidate.id !== policy.onlyForegroundAlternative) {
    throw new Error(`${candidate.id} detailed candidate contract must be the explicit foreground alternative`);
  }
  if ('active_shell' in adapterContract) {
    throw new Error(`${candidate.id} foreground candidate adapter must use candidate_shell, not active_shell; active release shell remains contracts/app-shell-adapter.json`);
  }
  if (
    adapterContract.adapter_id !== candidate.id ||
    adapterContract.candidate_shell !== candidate.id ||
    adapterContract.adapter_role !== 'foreground_alternative_candidate_adapter'
  ) {
    throw new Error(`${candidate.id} foreground candidate adapter must declare candidate_shell adapter identity`);
  }
  if (
    adapterContract.purpose !== 'active_shell_adapter' ||
    adapterContract.state !== 'active' ||
    adapterContract.candidate_stage !==
      'opl_native_workbench_single_app_server_adapter_candidate_only' ||
    adapterContract.gui_authority?.implementation_role !==
      'foreground_alternative_candidate_implementation_carrier'
  ) {
    throw new Error(`${candidate.id} adapter must preserve the shared adapter schema and single App Server adapter candidate stage`);
  }
  if (adapterContract.shell_root !== candidate.candidate_root) {
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
  if (
    adapterContract.codex_executable_contract?.resolver_env !== 'OPL_CODEX_BIN' ||
    adapterContract.codex_executable_contract.carrier?.kind !==
      'candidate_owned_or_exact_external_binary' ||
    adapterContract.codex_executable_contract.carrier.manifest_parser_owner !== null ||
    adapterContract.codex_executable_contract.carrier.aioncore_required !== false
  ) {
    throw new Error(`${candidate.id} adapter must resolve Codex directly without an AionCore runtime or manifest dependency`);
  }
  if (adapterContract.shell_contract.source_topology !== candidate.source_topology) {
    throw new Error(`${candidate.id} adapter source_topology must match candidate registry`);
  }
  if (!adapterContract.shell_contract.capabilities.includes('candidate_app_bundle_package')) {
    throw new Error(`${candidate.id} adapter must declare candidate_app_bundle_package capability`);
  }
  assertStringArrayIncludes(
    adapterContract.shell_contract.capabilities,
    requiredNativeThreadCapabilities,
    `${candidate.id} adapter thread capabilities`,
  );
  if (
    'cross_top_level_thread_authority' in adapterContract ||
    'local_p0_p1_implementation_evidence' in candidate ||
    forbiddenNativePrivateCapabilities.some(
      (capability) =>
        candidate.required_capabilities.includes(capability) ||
        adapterContract.shell_contract.capabilities.includes(capability),
    )
  ) {
    throw new Error(`${candidate.id} registry and adapter must not retain private cross-thread coordination contracts or capabilities`);
  }
  validateNativeThreadAdapterBoundary(adapterContract.thread_adapter_boundary);
  if (!adapterContract.validation_commands.some((entry) => entry.id === 'candidate_app_bundle_build')) {
    throw new Error(`${candidate.id} adapter validation_commands must include candidate_app_bundle_build`);
  }
}

function validateCandidateImplementationBasis(candidate: ShellCandidate): void {
  assertStringArrayIncludes(candidate.implementation_basis, [
    'OPL-native React renderer with Swift/AppKit WKWebView macOS host and Node WebUI host',
    'OPL App state/action contract first',
    'K-Dense delivery workspace patterns adapted without runtime authority transfer',
    'Open Science artifact/provenance/review affordances adapted as secondary context without default split-screen workbench assumptions',
    'results and artifact delivery-first presentation',
    'independent shell repo mounted under shells/opl-native-workbench',
  ], `${candidate.id}.implementation_basis`);
}

function validateCandidateTargetProductShape(candidate: ShellCandidate): void {
  if (
    candidate.target_product_shape.codex_cli_fixed_executor !== true ||
    candidate.target_product_shape.home_executor_selector_visible !== false ||
    candidate.target_product_shape.home_backend_selector_visible !== false ||
    candidate.target_product_shape.home_model_selector_visible !== true ||
    candidate.target_product_shape.permission_mode_selector_visible !== false ||
    candidate.target_product_shape.workspace_session_rail_default_visible !== true ||
    candidate.target_product_shape.inspector_default_visible !== false
  ) {
    throw new Error(`${candidate.id} must preserve Codex fixed-executor chat-first home with App-owned model selector, the candidate-specific project rail default, and no backend/permission/default inspector`);
  }
  assertStringArrayIncludes(candidate.target_product_shape.purpose_entries, requiredHomeEntries, `${candidate.id}.target_product_shape.purpose_entries`);
  if (candidate.target_product_shape.settings_policy !== 'app_state_refs_only') {
    throw new Error(`${candidate.id}.target_product_shape.settings_policy must keep Settings App-owned and refs-only`);
  }
  if (Object.hasOwn(candidate.target_product_shape, 'runtime_page_policy')) {
    throw new Error(`${candidate.id}.target_product_shape must omit the core Runtime route from Native phase-one candidate parity`);
  }
  if (
    candidate.target_product_shape.default_visual_basis !== 'codex_app_composer_first' ||
    candidate.target_product_shape.right_context_user_request_only !== true ||
    candidate.target_product_shape.co_scientist_split_screen_default !== false ||
    candidate.target_product_shape.mas_autonomous_research_default !== true
  ) {
    throw new Error(`${candidate.id}.target_product_shape must encode AI-first Codex App defaults and MAS autonomous research interaction`);
  }
  validateCandidateAiFirstInteractionModel(candidate);
}

function validateCandidateAiFirstInteractionModel(candidate: ShellCandidate): void {
  const model = candidate.ai_first_interaction_model;
  if (
    !model ||
    model.default_visual_basis !== 'codex_app_composer_first' ||
    model.primary_policy !== 'maximize_direct_ai_interaction_on_the_chat_canvas' ||
    model.right_context_policy !== 'collapsed_user_requested_secondary_layer' ||
    model.mas_autonomy_policy !== 'MAS_runs_as_autonomous_research_execution_not_co_scientist_pair_work'
  ) {
    throw new Error(`${candidate.id}.ai_first_interaction_model must preserve composer-first interaction and collapsed secondary context`);
  }
  assertStringArrayIncludes(model.open_science_adoption, [
    'artifact_provenance_review_refs_as_secondary_context',
    'plain_language_data_flow_and_safety_copy',
    'workflow_starters_as_purpose_entries_or_app_actions',
    'scientific_preview_affordances_on_demand',
  ], `${candidate.id}.ai_first_interaction_model.open_science_adoption`);
  assertStringArrayIncludes(model.must_not, [
    'default_three_column_scientific_workbench',
    'default_open_artifact_inspector',
    'co_scientist_side_by_side_monitoring_assumption',
    'foreign_runtime_or_domain_authority_transfer',
  ], `${candidate.id}.ai_first_interaction_model.must_not`);
}

function validateCandidateMinimumAcceptance(candidate: ShellCandidate): void {
  assertStringArrayIncludes(candidate.technical_verification?.minimum_acceptance ?? [], [
    'default App release adapter still validates as aionui',
    'candidate registry validates without changing release_shell_contract',
    'candidate adapter can be selected only through OPL_APP_SHELL_ADAPTER_CONTRACT',
    'candidate consumes OPL App state/action contracts without owning runtime or domain truth',
    'candidate state-model validation proves active project line projection consumption from opl app state without domain-ready, production-ready, clean-VM-ready, Full-release-ready, or active-shell-adopted claims',
    'Packaged macOS and WebUI use the same native React renderer and App-owned bridge shape',
    'ordinary UI stays chat-first while prioritizing results, files, receipts, and delivery refs',
    'WebUI parity evidence proves the same renderer and product semantics as the packaged macOS host',
    'one Codex App Server adapter exposes canonical thread list, read, start, resume, fork, archive, unarchive, and ordinary turn start and steer',
    'Codex subagent metadata, source kinds, and thread items remain read-only projections from Codex Core and App Server',
    'Native source acceptance requires no private coordination host, model-triggered cross-thread tools, OPL-owned host queue, JSONL coordination ledger, bilateral receipts, write-set advisory, coordination idempotency, or cross-host handoff layer',
  ], `${candidate.id}.technical_verification.minimum_acceptance`);
}

function validateCandidateFrameworkSurfaces(candidate: ShellCandidate): void {
  for (const [surface, expected] of Object.entries(expectedFrameworkSurfaces)) {
    if (candidate.framework_surfaces[surface] !== expected) {
      throw new Error(`${candidate.id}.framework_surfaces.${surface} must be ${expected}`);
    }
  }
  if (Object.hasOwn(candidate.framework_surfaces, 'full_drilldown')) {
    throw new Error(`${candidate.id}.framework_surfaces must omit Runtime full drilldown from Native phase-one candidate parity`);
  }
}

function validateCandidateStateModelCommand(candidate: ShellCandidate): void {
  validateActiveProjectLineStateModel(candidate.active_project_line_state_model, `${candidate.id}.active_project_line_state_model`);
  const stateModelTechnicalCommand = candidate.technical_verification?.candidate_shell_commands?.find((entry) => entry.id === 'state_model');
  if (
    !stateModelTechnicalCommand ||
    stateModelTechnicalCommand.cwd !== candidate.candidate_root ||
    stateModelTechnicalCommand.command !== 'npm run validate:state-model'
  ) {
    throw new Error(`${candidate.id}.technical_verification.candidate_shell_commands must include state_model running npm run validate:state-model from ${candidate.candidate_root}`);
  }
}

function validateCandidateSeriesDisplayContract(candidate: ShellCandidate): void {
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
}

function validateCandidateAuthorityBoundaries(candidate: ShellCandidate): void {
  assertStringArrayIncludes(candidate.required_capabilities, requiredNativeCapabilities, `${candidate.id}.required_capabilities`);
  if (candidate.required_capabilities.includes('runtime_summary_detail_action_bridge')) {
    throw new Error(`${candidate.id}.required_capabilities must omit the Runtime parity capability from Native phase one`);
  }
  assertStringArrayIncludes(candidate.must_not_own, forbiddenAuthority, `${candidate.id}.must_not_own`);
  assertStringArrayIncludes(candidate.forbidden_home_controls, [
    'Aion CLI backend choice',
    'Claude Code backend choice',
    'generic backend selector',
    'non-App-owned model override selector',
    'permission mode selector',
    'provider marketplace',
  ], `${candidate.id}.forbidden_home_controls`);
  assertStringArrayIncludes(candidate.non_goals, [
    'do not switch active_shell away from aionui',
    'do not enter default stable or nightly release packaging',
    'do not introduce runtime or domain truth into the App repo',
    'do not continue AGUI/CopilotKit implementation as the native workbench route',
    'do not add a private coordination host, model-triggered cross-thread tools, OPL-owned queue, coordination ledger, receipts, advisory, idempotency, or cross-host handoff layer',
    'do not claim release-ready from contract-only evidence',
  ], `${candidate.id}.non_goals`);
}

function validateCandidateValidationCommands(candidate: ShellCandidate): void {
  for (const entry of [
    ...candidate.validation_commands,
    ...(candidate.technical_verification?.manual_verification_commands ?? []),
  ]) {
    if (!entry.id || !entry.cwd || !entry.command) {
      throw new Error(`${candidate.id} has invalid validation command ${JSON.stringify(entry)}`);
    }
    const cwdPath = path.join(root, entry.cwd);
    if (!fs.existsSync(cwdPath)) {
      if (missingCandidateCheckoutCanBeBlocked(candidate) && entry.cwd === candidate.candidate_root) {
        continue;
      }
      assertFile(cwdPath, `${candidate.id} validation cwd ${entry.id}`);
    }
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
}

function validateCandidatePackageScriptSurfaces(candidate: ShellCandidate): void {
  if (missingCandidateCheckoutCanBeBlocked(candidate)) {
    return;
  }
  assertFile(path.join(root, candidate.candidate_root, 'scripts', 'validate-native-workbench-candidate.mjs'), `${candidate.id} self-check`);
  assertCandidateFileContains(candidate, 'package.json', [
    '"build:webui"',
    '"webui"',
    '"smoke:webui"',
    '"validate:state-model"',
  ], 'package scripts for shared packaged macOS/WebUI renderer');
}

export function validateCandidate(candidate: ShellCandidateEntry, policy: CandidateValidationPolicy): void {
  validateCandidateRegistryEntry(candidate, policy);
  if (isCandidateRoleTombstone(candidate)) {
    validateCandidateRoleTombstone(candidate, policy);
    return;
  }
  if (candidate.id !== policy.onlyForegroundAlternative) {
    throw new Error(`${candidate.id} detailed candidate entry must be the explicit foreground alternative`);
  }
  const adapterContract = readCandidateAdapterContract(candidate);
  validateCandidateAdapterContract(candidate, adapterContract, policy);
  validateCandidateImplementationBasis(candidate);
  validateNativeWorkbenchCandidateContract(candidate);
  validateCandidateChatTarget(candidate);
  validateCandidateWebUiTransport(candidate);
  validateCandidateTargetProductShape(candidate);
  validateCandidateMinimumAcceptance(candidate);
  validateCandidateFrameworkSurfaces(candidate);
  validateCandidateStateModelCommand(candidate);
  validateCandidateSeriesDisplayContract(candidate);
  validateCandidateAuthorityBoundaries(candidate);
  validateCandidateValidationCommands(candidate);
  validateCandidatePackageScriptSurfaces(candidate);
}

function validateNativeWorkbenchCandidateContract(candidate: ShellCandidate): void {
  if (candidate.foreground_alternative_role !== 'only_foreground_alternative') {
    throw new Error(`${candidate.id}.foreground_alternative_role must be only_foreground_alternative`);
  }
  if (
    candidate.source_upstream?.repo !== 'gaofeng21cn/opl-native-workbench' ||
    candidate.source_upstream.app_path !== '.' ||
    candidate.source_upstream.license !== 'Apache-2.0'
  ) {
    throw new Error(`${candidate.id}.source_upstream must point to gaofeng21cn/opl-native-workbench under Apache-2.0`);
  }
  if (
    candidate.candidate_stage !==
    'opl_native_workbench_single_app_server_adapter_candidate_only'
  ) {
    throw new Error(`${candidate.id}.candidate_stage must remain a single App Server adapter candidate only`);
  }
  const maintenance = candidate.maintenance_policy;
  if (
    maintenance?.mode !== 'manual_on_demand_non_periodic_technical_evaluation' ||
    maintenance.automatic_or_scheduled_work_allowed !== false ||
    maintenance.mainline_development_required !== false ||
    maintenance.completion_or_parity_obligation !== false ||
    maintenance.release_blocking !== false
  ) {
    throw new Error(`${candidate.id}.maintenance_policy must keep Native manual, non-periodic, non-blocking, and without a completion obligation`);
  }
  const runtimeDependency = candidate.runtime_dependency_policy;
  if (
    runtimeDependency?.aioncore_required !== false ||
    runtimeDependency.aionui_required !== false ||
    runtimeDependency.codex_app_server_source !== 'OPL_CODEX_BIN_or_exact_external_codex' ||
    runtimeDependency.opl_integration !== 'framework_app_state_action_contracts_only' ||
    runtimeDependency.multi_backend_abstraction_required !== false ||
    runtimeDependency.thread_store_owner !== 'codex_core_app_server' ||
    !runtimeDependency.forbidden_dependencies.includes('AionUI runtime') ||
    !runtimeDependency.forbidden_dependencies.includes('AionCore runtime') ||
    !runtimeDependency.forbidden_dependencies.includes('AionCore managed-resources manifest') ||
    !runtimeDependency.forbidden_dependencies.includes('AionCore session or database state')
  ) {
    throw new Error(`${candidate.id}.runtime_dependency_policy must keep Native independent from AionUI/AionCore and scoped to Codex App Server`);
  }
  if (
    candidate.checkout_policy?.primary_path !== 'shells/opl-native-workbench' ||
    candidate.checkout_policy.accepted_alternate_path !== '../opl-native-workbench' ||
    candidate.checkout_policy.missing_checkout_status !== 'blocked_missing_checkout'
  ) {
    throw new Error(`${candidate.id}.checkout_policy must accept shells/opl-native-workbench or ../opl-native-workbench and report blocked_missing_checkout`);
  }
  if (
    candidate.build_wrapper?.adapter_contract !== candidate.adapter_contract ||
    candidate.build_wrapper.app_root_command !== `OPL_APP_SHELL_ADAPTER_CONTRACT=${candidate.adapter_contract} npm run package` ||
    candidate.build_wrapper.missing_checkout_blocker_allowed !== true
  ) {
    throw new Error(`${candidate.id}.build_wrapper must route through the App-root explicit adapter and allow missing-checkout blocker reporting`);
  }
  const visual = candidate.visual_parity_contract as NativeVisualParityContract | undefined;
  if (
    visual?.comparison_baseline !== 'latest verified official ChatGPT Codex macOS observation' ||
    visual.visual_style_baseline !== 'One Person Lab App-owned visual system and approved pixel baseline' ||
    visual.visual_style_scope !== 'light_workbench_palette_system_font_stack_type_scale_weight_line_height_sidebar_density_and_composer_surface' ||
    visual.visual_token_source !== 'app_owned_visual_contracts_plus_optional_verified_official_observation_receipts' ||
    visual.font_asset_policy !== 'match_the_current_codex_workbench_system_font_stack_without_copying_or_redistributing_openai_sans_font_binaries' ||
    visual.current_reference_status !== 'rolling_external_design_reference_only' ||
    visual.regression_floor !== 'AionUI active release shell' ||
    visual.source_usage !== 'visual_and_interaction_reference_only_no_code_or_brand_copy' ||
    visual.minimum_bar !== 'one_to_one_codex_layout_density_typography_composer_timeline_project_rail_settings_and_floating_environment_details' ||
    visual.model_policy_source !== 'contracts/app-product-profile.json#gui.home.codex_model_display_options' ||
    visual.default_model !== configuredDefaultModel ||
    visual.default_reasoning_effort !== configuredDefaultReasoningEffort ||
    visual.docs_or_contract_only_completion_allowed !== false
  ) {
    throw new Error(`${candidate.id}.visual_parity_contract must consume the App-owned configured model policy, preserve the AionUI regression floor, and forbid docs-only completion`);
  }
  assertStringArrayIncludes(
    visual.superseded_observations ?? [],
    [
      'ChatGPT Codex macOS 26.707.31428 (2026-07-10)',
      'ChatGPT Codex macOS 26.707.31123 (2026-07-10)',
    ],
    `${candidate.id}.visual_parity_contract.superseded_observations`,
  );
  assertStringArrayIncludes(
    visual.required_surfaces ?? [],
    requiredNativeVisualParitySurfaces,
    `${candidate.id}.visual_parity_contract.required_surfaces`,
  );
  assertStringArrayIncludes(visual.required_evidence, [
    'desktop design review against the latest verified official ChatGPT Codex macOS observation',
    'desktop pixel regression against the App-owned approved visual baseline',
    'persistent project rail and single conversation timeline screenshot comparison',
    'composer model and reasoning controls screenshot comparison',
    'floating on-demand environment screenshot comparison',
    'Settings locale surface screenshot comparison',
    'webui screenshot comparison against desktop renderer',
    'packaged app screenshot or VM smoke artifact',
  ], `${candidate.id}.visual_parity_contract.required_evidence`);
}

export function validateCandidateImplementationFiles(candidate: ShellCandidate): void {
  assertCandidateFileContains(candidate, 'src/workbench/App.tsx', [
    'data-testid="opl-workspace-rail"',
    'data-testid="opl-session-list"',
    'data-testid="opl-context-tabs"',
    'data-testid="opl-files-panel"',
    'data-testid="opl-skills-panel"',
    'data-testid="opl-routing-panel"',
    'data-testid="opl-memory-panel"',
    'data-testid="opl-always-on-panel"',
    'data-testid="opl-web-transport"',
    'data-testid="opl-locale-toggle"',
  ], 'native chat-first contextual renderer');
  assertCandidateFileContains(candidate, 'src/bridge/oplBridge.ts', [
    'opl app state --profile fast --json',
    'opl app state --profile full --json',
    'opl app action execute --action',
  ], 'OPL App state/action bridge');
  assertCandidateFileContains(candidate, 'src/workbench/workbenchModel.ts', [
    'results',
    'deliverables',
    'receipts',
    'activeProjectLines',
  ], 'results and delivery workbench model');
  assertCandidateFileContains(candidate, 'scripts/validate-native-workbench-candidate.mjs', [
    'src/candidateContractEvidence.json',
    'opl-workspace-rail',
    'opl-native-workbench',
  ], 'native workbench self-validator');
}

function validateCandidateChatTarget(candidate: ShellCandidate): void {
  const target = candidate.codex_app_like_chat_target;
  if (!target) {
    throw new Error(`${candidate.id} must declare codex_app_like_chat_target`);
  }
  if (target.scope !== 'OPL-native chat-first desktop and WebUI target optimized for results, deliverables, and artifact refs') {
    throw new Error(`${candidate.id} target must be the OPL-native results/delivery workbench`);
  }
  assertStringArrayIncludes(target.capability_inventory, [
    'workspace directory picker',
    'new conversation and lightweight thread history rail',
    'Codex app-server backed chat turns',
    'shared native React renderer for packaged macOS and WebUI',
    'Web transport bridge with HTTP actions and SSE Codex events',
    'K-Dense-informed project sandbox and delivery artifact organization as reference-only',
    'Open Science-informed artifact, provenance, and review affordances as collapsed secondary context',
    'chat-first main canvas with pinned composer',
    'results, files, receipts, and delivery refs as first-class context',
    'right-side collapsible Files, Skills, Routing, Memory, Always-On, and Settings context tabs',
    'candidate .app package through the App wrapper',
  ], `${candidate.id}.codex_app_like_chat_target.capability_inventory`);
  if (target.capability_inventory.includes(
    'right-side collapsible Files, Skills, Routing, Memory, Always-On, Runtime, and Settings context tabs',
  )) {
    throw new Error(`${candidate.id} target must omit Runtime from Native phase-one context-tab parity`);
  }

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
  if (transport.native_surface !== 'Swift WKScriptMessageHandler window.oplNativeWorkbench') {
    throw new Error(`${candidate.id} packaged macOS transport must expose window.oplNativeWorkbench through WKScriptMessageHandler`);
  }
  if (transport.web_surface !== 'browser window.oplNativeWorkbench compatibility bridge') {
    throw new Error(`${candidate.id} web surface must expose the browser window.oplNativeWorkbench bridge`);
  }
  if (transport.web_bridge !== 'src/bridge/webTransport.ts') {
    throw new Error(`${candidate.id} web bridge must be src/bridge/webTransport.ts`);
  }
  if (transport.gateway !== 'scripts/dev-webui-server.mjs') {
    throw new Error(`${candidate.id} WebUI gateway must be scripts/dev-webui-server.mjs`);
  }
  if (transport.event_stream !== 'SSE /api/opl-events') {
    throw new Error(`${candidate.id} WebUI event stream must be SSE /api/opl-events`);
  }
  if (transport.native_picker_policy !== 'Packaged macOS may use a native directory picker; WebUI uses an explicit workspace path/action bridge without changing App product truth') {
    throw new Error(`${candidate.id} WebUI native picker policy must preserve App product truth`);
  }
}
