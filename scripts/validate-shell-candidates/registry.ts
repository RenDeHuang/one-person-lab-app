import path from 'node:path';
import { assertDeepEqualJson } from '../validate-active-shell/assertions.ts';
import type {
  ShellCandidateEntry,
  ShellCandidateRegistry,
  ShellCandidateRoleTombstone,
} from './types.ts';
import {
  activeAdapterPath,
  assertFile,
  assertStringArrayIncludes,
  guiContractPath,
  readJson,
  root,
  runtimeBridgePath,
} from './shared.ts';

export function validateRegistryShape(registry: ShellCandidateRegistry): void {
  if (registry.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected candidate registry owner: ${registry.owner}`);
  }
  if (registry.purpose !== 'app_shell_candidate_registry') {
    throw new Error(`Unexpected candidate registry purpose: ${registry.purpose}`);
  }
  if (registry.state !== 'active_gui_route_policy') {
    throw new Error(`Unexpected candidate registry state: ${registry.state}`);
  }
  if (registry.active_shell_unchanged !== 'aionui') {
    throw new Error('candidate registry must not change active shell away from aionui');
  }
  const mainline = registry.active_gui_mainline;
  if (
    mainline?.shell !== 'aionui' ||
    mainline.shell_root !== 'shells/aionui' ||
    mainline.source_repo !== 'gaofeng21cn/opl-aion-shell' ||
    mainline.role !== 'stable_app_gui_mainline' ||
    mainline.product_truth_owner !== 'one-person-lab-app'
  ) {
    throw new Error('candidate registry must declare AionUI as the stable App GUI mainline');
  }
  const alternative = registry.alternative_gui_policy;
  if (
    alternative?.only_foreground_alternative !== 'opl-studio' ||
    alternative.basis !== 'OPL Studio DSH-derived composition workbench' ||
    alternative.archived_proof_policy !== 'do_not_update_or_improve_unless_user_explicitly_requests_archived_proof_replay' ||
    alternative.active_shell_switch_policy !== 'only_contracts/app-shell-adapter.json_can_switch_default_release_shell'
  ) {
    throw new Error('candidate registry must keep OPL Studio as the only foreground alternative and Hermes/AGUI as explicit-only archived proofs');
  }
  if (alternative.default_candidate_validation_scope.length !== 0) {
    throw new Error('default candidate validation scope must stay empty; default gates validate role registry only');
  }
  assertStringArrayIncludes(
    alternative.explicit_candidate_validation_scope,
    ['opl-studio', 'hermes-codex', 'agui-codex'],
    'alternative_gui_policy.explicit_candidate_validation_scope',
  );
  if (alternative.explicit_candidate_validation_scope.length !== 3) {
    throw new Error('explicit candidate validation scope must contain exactly Native, Hermes, and AGUI');
  }
  const archivedExecution = alternative.archived_proof_execution_policy;
  if (
    archivedExecution?.scope !== 'historical_technical_replay_only' ||
    archivedExecution.trigger !== 'explicit_user_request_only' ||
    archivedExecution.automatic_build_allowed !== false ||
    archivedExecution.default_validation_includes_build !== false ||
    archivedExecution.release_channel_participation.length !== 0 ||
    archivedExecution.candidate_command_chain_opt_in !== '--archived-proof-replay'
  ) {
    throw new Error('archived proof replay must stay explicit, historical, and outside release channels');
  }
  assertStringArrayIncludes(archivedExecution.forbidden_automatic_triggers, [
    'push',
    'pull_request',
    'schedule',
    'watch_or_on_save',
    'daily_patrol',
    'routine_validation',
  ], 'alternative_gui_policy.archived_proof_execution_policy.forbidden_automatic_triggers');
  assertStringArrayIncludes(alternative.archived_technical_proofs, ['hermes-codex', 'agui-codex'], 'alternative_gui_policy.archived_technical_proofs');
  const nativeCandidate = registry.candidates.find((candidate) => candidate.id === 'opl-studio');
  const oplAgentPaletteOutcome = 'the separate OPL standard Agent composer group includes only producer-declared first-party OPL professional Agents with package_role=standard_agent, selectable readiness, and a real Codex route; generic Skills and plugins remain separate even when a descriptor defaults to standard_agent, without a package-id allowlist';
  if (
    !nativeCandidate
    || !('p1_baseline_contract' in nativeCandidate)
    || !nativeCandidate.p1_baseline_contract?.required_user_outcomes.includes(oplAgentPaletteOutcome)
  ) {
    throw new Error('foreground Native candidate must keep OPL standard Agents separate from generic Skills and plugins using producer-owned identity without a package-id allowlist');
  }
  validateInteractiveLauncherPolicy(registry);
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
  if (policy.candidate_state !== 'foreground_alternative_or_role_tombstone') {
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
    'candidate is the foreground alternative declared by alternative_gui_policy.only_foreground_alternative',
    'candidate implements contracts/app-gui-product-contract.json',
    'candidate uses one App-owned product renderer across claimed delivery surfaces without making the renderer a product truth owner',
    'candidate provides delivery-surface bridges that expose the same App-owned API shape without taking runtime authority',
    'candidate passes WebUI smoke only when it explicitly claims WebUI delivery; otherwise WebUI remains explicitly deferred and non-claiming',
    'candidate directly reuses the pinned DeepSeek Harness GUI source cohort and keeps OPL custom functions outside the vendor snapshot',
    'candidate keeps only projects, conversations, search, and Settings in the left rail and exposes run status, files and results, and agents and capabilities as user-requested right context',
    'candidate passes state-model validation proving active project line projection consumption without taking runtime or domain authority',
    'candidate compiles a launchable .app bundle through the App wrapper when OPL_APP_SHELL_ADAPTER_CONTRACT selects its adapter contract',
    'candidate passes App-root candidate validation',
    'contracts/app-shell-adapter.json is changed only when candidate becomes active release shell',
  ], 'candidate_policy.adoption_gate');
  if (
    policy.default_validation_scope !== 'role_registry_only' ||
    policy.default_validation_contract !== 'minimal_role_registry_only'
  ) {
    throw new Error('candidate policy default validation must stay minimal role registry only');
  }
  if (policy.archived_technical_proof_policy !== 'explicit_user_request_only') {
    throw new Error('candidate policy archived technical proof validation must be explicit_user_request_only');
  }
  validateCandidateNoResurrectionPolicy(registry);
  validateCandidateRoleEntries(registry);
  validateDesignReferences(registry);
}

function validateCandidateRoleEntries(registry: ShellCandidateRegistry): void {
  const entries = registry.candidates;
  const ids = entries.map((entry) => entry.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(['agui-codex', 'hermes-codex', 'opl-studio'])) {
    throw new Error('candidate role registry must contain exactly Native, Hermes, and AGUI');
  }

  const native = entries.find((entry) => entry.id === 'opl-studio');
  if (
    !native ||
    'role_tombstone' in native ||
    native.state !== 'active_product_development' ||
    native.foreground_alternative_role !== 'only_foreground_alternative' ||
    native.adapter_contract !== 'contracts/shell-adapters/opl-studio.json' ||
    native.release_participation !== 'pre_adoption_explicit_build_only'
  ) {
    throw new Error('Native must remain the explicit foreground candidate and must not collapse into a role tombstone');
  }

  validateRoleTombstone(
    entries.find((entry) => entry.id === 'hermes-codex'),
    {
      state: 'archived_technical_proof',
      releaseParticipation: 'explicit_user_requested_technical_replay_only',
      adapterContract: 'contracts/shell-adapters/hermes-codex.json',
      replayMode: 'explicit_user_request_only',
      validatorCommand: 'npm run validate:candidate:hermes',
      runbookRef: 'docs/product/shell-alternatives/hermes-first-run-flow.md',
    },
  );
  validateRoleTombstone(
    entries.find((entry) => entry.id === 'agui-codex'),
    {
      state: 'archived_technical_proof',
      releaseParticipation: 'explicit_user_requested_technical_replay_only',
      adapterContract: 'contracts/shell-adapters/agui-codex.json',
      replayMode: 'explicit_user_request_only',
      validatorCommand: 'npm run validate:candidate:agui',
      runbookRef: 'docs/history/shell-candidates/agui-codex-candidate-verification.md',
    },
  );

  const tombstoneContract = registry.candidate_policy.role_tombstone_contract;
  if (
    !tombstoneContract ||
    tombstoneContract.detail_owner !== 'candidate_adapter_contract_and_replay_runbook' ||
    JSON.stringify(tombstoneContract.applies_to_states) !==
      JSON.stringify(['archived_technical_proof'])
  ) {
    throw new Error('candidate policy must keep archived detail in adapters and replay runbooks');
  }
  const requiredFields = [
    'id',
    'state',
    'candidate_root',
    'adapter_contract',
    'source_topology',
    'release_participation',
    'role_tombstone',
    'replay',
  ];
  assertStringArrayIncludes(
    tombstoneContract.required_fields,
    requiredFields,
    'candidate_policy.role_tombstone_contract.required_fields',
  );
  const forbiddenDetailedFields = [
    'target_product_shape',
    'framework_surfaces',
    'required_capabilities',
    'technical_verification',
    'validation_commands',
    'visual_parity_contract',
    'first_run_contract',
    'icon_contract',
    'implementation_evidence',
  ];
  assertStringArrayIncludes(
    tombstoneContract.forbidden_detailed_fields,
    forbiddenDetailedFields,
    'candidate_policy.role_tombstone_contract.forbidden_detailed_fields',
  );
}

function validateRoleTombstone(
  entry: ShellCandidateEntry | undefined,
  expected: {
    state: ShellCandidateRoleTombstone['state'];
    releaseParticipation: ShellCandidateRoleTombstone['release_participation'];
    adapterContract: string;
    replayMode: ShellCandidateRoleTombstone['replay']['mode'];
    validatorCommand: string;
    runbookRef: string;
  },
): void {
  if (!entry || !('role_tombstone' in entry) || entry.role_tombstone !== true) {
    throw new Error('archived candidates must be role tombstones');
  }
  if (
    entry.state !== expected.state ||
    entry.release_participation !== expected.releaseParticipation ||
    entry.adapter_contract !== expected.adapterContract ||
    entry.replay.mode !== expected.replayMode ||
    entry.replay.validator_command !== expected.validatorCommand ||
    entry.replay.runbook_ref !== expected.runbookRef ||
    entry.replay.source_checkout_policy !== 'optional_until_explicit_replay'
  ) {
    throw new Error(`${entry.id} role tombstone must preserve its adapter and explicit replay route`);
  }
  if (!entry.candidate_root.startsWith('shells/') || entry.candidate_root.split(/[\\/]+/).includes('..')) {
    throw new Error(`${entry.id} candidate_root must stay under shells/<candidate>`);
  }
  assertFile(path.join(root, entry.adapter_contract), `${entry.id} adapter contract`);
  assertFile(path.join(root, entry.replay.runbook_ref), `${entry.id} replay runbook`);

  const forbiddenFields = [
    'target_product_shape',
    'framework_surfaces',
    'required_capabilities',
    'technical_verification',
    'validation_commands',
    'visual_parity_contract',
    'first_run_contract',
    'icon_contract',
    'local_p0_p1_implementation_evidence',
  ];
  for (const field of forbiddenFields) {
    if (field in entry) {
      throw new Error(`${entry.id} role tombstone must not duplicate detailed field ${field}`);
    }
  }
}

export function assertArchivedProofCommandExecutionAllowed(
  registry: ShellCandidateRegistry,
  candidateIds: string[],
  archivedProofReplay: boolean,
): void {
  const alternative = registry.alternative_gui_policy;
  const archivedProofs = alternative?.archived_technical_proofs ?? [];
  const selectedArchivedProofs = candidateIds.filter((id) => archivedProofs.includes(id));
  if (selectedArchivedProofs.length === 0) {
    return;
  }
  if (
    archivedProofReplay !== true ||
    alternative?.archived_proof_execution_policy.candidate_command_chain_opt_in !== '--archived-proof-replay'
  ) {
    throw new Error(
      `${selectedArchivedProofs.join(', ')} command execution is historical replay only; add --archived-proof-replay only when the user explicitly requests that exact archived proof`,
    );
  }
}

function validateInteractiveLauncherPolicy(registry: ShellCandidateRegistry): void {
  const launcher = registry.interactive_launcher_policy;
  for (const [field, expected] of Object.entries({
    state: 'active_local_launcher_policy',
    topology: 'single_control_plane_multiple_independent_gui_clients',
    selection_scope: 'per_local_launch_only',
    default_target_source: 'contracts/app-shell-adapter.json#active_shell',
    target_interface: 'app_root_gui_launcher_with_shell_and_mode',
    target_command: 'npm run gui -- --shell <shell_id> [--mode dev|packaged]',
    release_adoption_contract: 'contracts/app-shell-adapter.json',
    concurrent_mainline_policy: 'side_by_side_bundle_launch_allowed_candidate_actions_dry_run_by_default',
    candidate_default_mutation_policy: 'dry_run_only_unless_explicit_allow_actions',
    missing_target_policy: 'fail_closed_with_actionable_blocker',
    implementation_status: 'implemented',
  })) {
    if (launcher?.[field as keyof typeof launcher] !== expected) {
      throw new Error(`interactive launcher policy ${field} must be ${expected}`);
    }
  }
  const activeShell = registry.active_gui_mainline?.shell;
  const foregroundShell = registry.alternative_gui_policy?.only_foreground_alternative;
  const expectedShells = [activeShell, foregroundShell];
  const selectableShells = launcher?.selectable_shells ?? [];
  if (
    !activeShell ||
    !foregroundShell ||
    selectableShells.length !== expectedShells.length ||
    !selectableShells.includes(activeShell) ||
    !selectableShells.includes(foregroundShell)
  ) {
    throw new Error('interactive launcher selectable_shells must be exactly the active mainline and foreground alternative');
  }
  for (const field of [
    'selection_mutates_release_adoption',
    'candidate_launch_implies_adoption',
    'selection_changes_updater_channel',
    'simultaneous_same_workspace_write_safety_claimed',
  ] as const) {
    if (launcher?.[field] !== false) {
      throw new Error(`interactive launcher policy ${field} must remain false`);
    }
  }
  if (launcher?.side_by_side_bundle_identity_required !== true) {
    throw new Error('interactive launcher policy must require separate side-by-side bundle identities');
  }
  const profiles = launcher?.launch_profiles ?? {};
  const profileIds = Object.keys(profiles).sort();
  if (profileIds.join(',') !== ['aionui', 'opl-studio'].sort().join(',')) {
    throw new Error('interactive launcher launch_profiles must be exactly aionui and opl-studio');
  }
  const aionui = profiles.aionui;
  if (
    aionui?.adapter_contract !== 'contracts/app-shell-adapter.json' ||
    aionui.default_mode !== 'packaged' ||
    aionui.bundle_id !== 'cn.onepersonlab.opl' ||
    aionui.packaged_app_path !== '/Applications/One Person Lab.app' ||
    aionui.supported_modes?.join(',') !== 'packaged,dev' ||
    aionui.dev_command?.join(' ') !== 'bun run start'
  ) {
    throw new Error('interactive launcher AionUI profile must preserve the installed mainline and existing dev command');
  }
  const successor = profiles['opl-studio'];
  if (
    successor?.adapter_contract !== 'contracts/shell-adapters/opl-studio.json' ||
    successor.default_mode !== 'packaged' ||
    successor.bundle_id !== 'cn.onepersonlab.opl.studio.preview' ||
    successor.packaged_app_path !== '/Applications/One Person Lab Preview.app' ||
    successor.bundle_relative_path !== 'out/mac-arm64/One Person Lab Preview.app' ||
    successor.supported_modes?.join(',') !== 'packaged' ||
    successor.package_command?.join(' ') !== 'npm run package' ||
    successor.launcher_env_abi?.join(',') !==
      'OPL_CODEX_BIN,OPL_APP_OPL_BIN,OPL_NATIVE_WORKBENCH_CODEX_CWD,OPL_NATIVE_WORKBENCH_READ_ONLY'
  ) {
    throw new Error('interactive launcher successor profile must preserve the formal local install, host ABI, isolated bundle, and package command');
  }
  if (aionui.bundle_id === successor.bundle_id) {
    throw new Error('interactive launcher mainline and candidate bundle identities must differ');
  }
}

function validateCandidateNoResurrectionPolicy(registry: ShellCandidateRegistry): void {
  const policy = registry.candidate_policy;
  const noResurrection = policy.no_resurrection_policy;
  const alternative = registry.alternative_gui_policy;
  if (!noResurrection || !alternative) {
    throw new Error('candidate registry must declare candidate_policy.no_resurrection_policy and alternative_gui_policy');
  }
  if (noResurrection.policy_id !== 'app.shell_candidate.no_resurrection.v1') {
    throw new Error(`unexpected shell candidate no-resurrection policy id: ${noResurrection.policy_id}`);
  }
  if (noResurrection.default_validation_scope_must_exclude_archived_proofs !== true) {
    throw new Error('candidate no-resurrection policy must exclude archived proofs from default validation scope');
  }
  if (noResurrection.candidate_label_does_not_imply_foreground_status !== true) {
    throw new Error('candidate label must not imply foreground candidate status');
  }
  if (noResurrection.archived_proof_update_requires_explicit_user_request !== true) {
    throw new Error('archived proof updates must require explicit user request');
  }
  if (noResurrection.archived_proof_release_participation !== 'explicit_user_requested_technical_replay_only') {
    throw new Error('archived proof release participation must stay explicit replay only');
  }
  if (noResurrection.archived_proof_must_not_appear_in_adoption_gate !== true) {
    throw new Error('archived proofs must not appear in foreground adoption gates');
  }
  if (noResurrection.foreground_adoption_gate_must_be_shell_agnostic !== true) {
    throw new Error('foreground adoption gates must stay shell agnostic');
  }
  if (noResurrection.active_shell_switch_contract !== 'contracts/app-shell-adapter.json') {
    throw new Error('active shell switch contract must stay contracts/app-shell-adapter.json');
  }
  assertStringArrayIncludes(noResurrection.forbidden_default_routes, [
    'agui-codex in alternative_gui_policy.default_candidate_validation_scope',
    'agui-codex in candidate_policy.adoption_gate',
    'candidate filename label treated as foreground alternative',
    'archived proof validation run by default',
    'candidate implementation detail validated without explicit --candidate',
    'reference or archived snapshot copied into default App gates',
    'release wrapper default switched without contracts/app-shell-adapter.json',
  ], 'candidate_policy.no_resurrection_policy.forbidden_default_routes');

  const archivedProofs = new Set(alternative.archived_technical_proofs);
  const defaultScopeArchivedProofs = alternative.default_candidate_validation_scope.filter((id) => (
    archivedProofs.has(id)
  ));
  if (defaultScopeArchivedProofs.length > 0) {
    throw new Error(`default candidate validation scope must not include archived proofs: ${defaultScopeArchivedProofs.join(', ')}`);
  }
  const adoptionGateText = policy.adoption_gate.join('\n');
  for (const archivedProof of archivedProofs) {
    if (adoptionGateText.includes(archivedProof)) {
      throw new Error(`${archivedProof} must not appear in foreground adoption gates`);
    }
  }
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

  const kdense = references.find((reference) => reference.id === 'kdense-byok');
  if (!kdense) {
    throw new Error('candidate registry must record K-Dense BYOK as an experience reference for opl-studio');
  }
  if (kdense.source_repo !== 'https://github.com/K-Dense-AI/k-dense-byok') {
    throw new Error('K-Dense design reference must point at K-Dense-AI/k-dense-byok');
  }
  if (kdense.source_usage !== 'experience_reference_only') {
    throw new Error('K-Dense source usage must stay experience_reference_only');
  }
  assertStringArrayIncludes(kdense.reference_value, [
    'project sandbox organization',
    'result and artifact delivery panel',
    'structured confirmation forms',
    'rich file preview affordances',
  ], 'K-Dense reference_value');
  assertStringArrayIncludes(kdense.forbidden_reuse, [
    'do not adopt K-Dense runtime, agent authority, provider routing, or remote compute as OPL authority',
    'do not copy source until a separate license and code-reuse decision is recorded',
  ], 'K-Dense forbidden_reuse');

  const openClaudeScience = references.find((reference) => reference.id === 'openclaudescience');
  if (!openClaudeScience) {
    throw new Error('candidate registry must record OpenClaudeScience as an experience reference for scientific workflow display');
  }
  if (openClaudeScience.source_repo !== 'https://github.com/qzzqzzb/OpenClaudeScience') {
    throw new Error('OpenClaudeScience design reference must point at qzzqzzb/OpenClaudeScience');
  }
  if (openClaudeScience.source_usage !== 'experience_reference_only') {
    throw new Error('OpenClaudeScience source usage must stay experience_reference_only');
  }
  assertStringArrayIncludes(openClaudeScience.forbidden_reuse, [
    'do not adopt OpenClaudeScience runtime, domain verdicts, or research authority as OPL authority',
    'do not copy source until a separate license and code-reuse decision is recorded',
  ], 'OpenClaudeScience forbidden_reuse');

  const openScience = references.find((reference) => reference.id === 'open-science');
  if (!openScience) {
    throw new Error('candidate registry must record ai4s-research/open-science as a design reference');
  }
  if (openScience.source_repo !== 'https://github.com/ai4s-research/open-science') {
    throw new Error('Open Science design reference must point at ai4s-research/open-science');
  }
  if (openScience.evaluated_ref !== '2200ad2ec4e2ac7c7ff59c5dcdfaeb0b9a5fda66') {
    throw new Error('Open Science design reference must record the evaluated ref');
  }
  if (openScience.license !== 'MIT') {
    throw new Error('Open Science design reference must record MIT license');
  }
  if (openScience.source_usage !== 'design_reference_only') {
    throw new Error('Open Science source usage must stay design_reference_only');
  }
  assertStringArrayIncludes(openScience.reference_value, [
    'artifact, provenance, and review surfaces kept close to the conversation',
    'plain-language data-flow and safety presentation',
    'workflow starters that turn broad research intents into concrete starts',
    'scientific report, figure, notebook, and table preview affordances',
  ], 'Open Science reference_value');
  assertStringArrayIncludes(openScience.opl_mapping, [
    "OPL Studio should keep the DeepSeek Harness chat-first source-reuse basis, not Open Science's three-column workbench default",
    'OPL right context stays collapsed by default and opens only when the user asks to inspect files, artifacts, review refs, actions, runtime refs, memory refs, automations, or settings',
    'MAS is autonomous research execution, not a co-scientist pair-work surface; the UI must not assume users monitor results beside chat while work runs',
    'Open Science artifact/provenance/review ideas map to secondary refs, Runtime/delivery pages, and explicit inspector tabs without taking artifact body, domain verdict, or runtime authority',
  ], 'Open Science opl_mapping');
  assertStringArrayIncludes(openScience.forbidden_reuse, [
    "do not adopt Open Science's OpenCode sidecar, runtime manager, provider model, or auth flow as OPL authority",
    'do not copy or vendor Open Science source without a separate license and code-reuse decision',
    'do not make a three-column scientific workbench, artifact inspector, or activity cockpit the ordinary default Home layout',
    'do not convert MAS into a co-scientist monitor UI; MAS progress and results are inspect-on-demand refs',
  ], 'Open Science forbidden_reuse');

  const deepseekHarness = references.find((reference) => reference.id === 'deepseek-harness');
  if (!deepseekHarness) {
    throw new Error('candidate registry must record DeepSeek Harness as the bounded Native composition reuse reference');
  }
  if (
    deepseekHarness.source_repo !== 'https://github.com/deepseek-ai/deepseek-harness' ||
    deepseekHarness.evaluated_ref !== '47f943859bef60e4160492346772ded9b24f765a' ||
    deepseekHarness.evaluated_at !== '2026-08-14' ||
    deepseekHarness.evaluated_version !== '0.1.0-rc.5 source; 0.1.0-rc.6 installable entry observed' ||
    deepseekHarness.license !== 'MIT' ||
    deepseekHarness.source_usage !== 'approved_bounded_source_and_package_reuse'
  ) {
    throw new Error('DeepSeek Harness reference must stay pinned to the evaluated preview source, version, date, license, and bounded reuse status');
  }
  assertDeepEqualJson(deepseekHarness.adopted_packages, {
    '@deepseek-ai/dsh-client-ui-slots': '0.1.0-rc.6',
    '@deepseek-ai/dsh-client-web-react': '0.1.0-rc.6',
    '@deepseek-ai/cordis': '4.0.1',
    '@deepseek-ai/dsh-invariants': '0.1.0-rc.6',
  }, 'DeepSeek Harness adopted_packages');
  assertDeepEqualJson(deepseekHarness.adopted_source, {
    root: 'src/vendor/deepseek-harness',
    ref: '47f943859bef60e4160492346772ded9b24f765a',
    path_policy: 'preserve_upstream_package_relative_paths',
    byte_policy: 'byte_identical_to_pinned_ref',
    package_roots: [
      'packages/client/ui-layout/src',
      'packages/client/ui-sidebar/src',
      'packages/client/ui-conversation/src',
      'packages/client/ui-settings-general/src',
      'packages/client/ui-theme/src',
      'packages/client/ui-primitives/src',
    ],
    files: [
      'packages/client/ui-layout/src/client/AppFrame.tsx',
      'packages/client/ui-layout/src/client/AppFrame.module.css',
      'packages/client/ui-layout/src/client/columns.ts',
      'packages/client/ui-sidebar/src/client/SidebarRoot.tsx',
      'packages/client/ui-sidebar/src/client/SidebarRoot.module.css',
      'packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx',
      'packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css',
      'packages/client/ui-conversation/src/client/skeleton/InputBar.tsx',
      'packages/client/ui-conversation/src/client/skeleton/InputBar.module.css',
      'packages/client/ui-conversation/src/client/skeleton/EmptyHero.tsx',
      'packages/client/ui-conversation/src/client/skeleton/HeroShell.module.css',
      'packages/client/ui-settings-general/src/client/SettingsRoot.tsx',
      'packages/client/ui-settings-general/src/client/SettingsRoot.module.css',
      'packages/client/ui-theme/src/styles/design-platform.css',
      'packages/client/ui-theme/src/styles/base.css',
      'packages/client/ui-theme/src/styles/scrollbar.css',
      'packages/client/ui-theme/src/styles/gradient-shadow-text.css',
      'packages/client/ui-primitives/src/Button.tsx',
      'packages/client/ui-primitives/src/Button.module.css',
      'packages/client/ui-primitives/src/Pill.tsx',
      'packages/client/ui-primitives/src/Pill.module.css',
      'packages/client/ui-primitives/src/Input.tsx',
      'packages/client/ui-primitives/src/Input.module.css',
      'packages/client/ui-primitives/src/StateDot.tsx',
      'packages/client/ui-primitives/src/StateDot.module.css',
      'packages/client/ui-primitives/src/Tooltip.tsx',
      'packages/client/ui-primitives/src/Tooltip.module.css',
      'packages/client/ui-primitives/src/markdown/MessageText.tsx',
      'packages/client/ui-primitives/src/markdown/MessageText.module.css',
    ],
  }, 'DeepSeek Harness adopted_source');
  assertStringArrayIncludes(deepseekHarness.adopted_surface, [
    'SlotCore registration lifecycle',
    'createSlotRenderer React composition and error isolation',
    'AppFrame three-column composition and responsive column solver',
    'SidebarRoot workspace and session rail composition',
    'ConversationRoot InputBar EmptyHero and persistent composer composition',
    'SettingsRoot navigation and modal composition',
    'ui-theme design platform base scrollbar and gradient shadow styles',
    'complete ui-primitives source tree with OPL brand overrides outside the vendor root',
  ], 'DeepSeek Harness adopted_surface');
  assertDeepEqualJson(deepseekHarness.upstream_intake, {
    mode: 'pinned_vendor_snapshot_with_external_opl_adapters',
    vendor_source_policy: 'byte_identical_to_recorded_upstream_path_and_ref',
    opl_delta_policy: 'branding_bridge_state_and_custom_functions_live_outside_vendor_tree_as_adapters_and_slot_plugins',
    update_policy: 'fetch_review_exact_source_diff_update_one_pinned_ref_then_run_source_interaction_desktop_webui_pixel_notice_and_package_gates',
    floating_ref_allowed: false,
    automatic_promotion_allowed: false,
    stop_condition: 'large_private_vendor_delta_or_required_dsh_authority_runtime',
  }, 'DeepSeek Harness upstream_intake');
  assertStringArrayIncludes(deepseekHarness.reference_value, [
    'quiet chat-first Web UI with workspace/session rail and persistent composer',
    'typed UI slot registry with single, list, keyed, and chain composition kinds',
    'client plugins discovered from package manifests and unloaded on the same lifecycle axis as registration',
    'profile and bundle composition with explicit ordered layers and user patches',
    'capability seams separating service definitions, providers, and consumers',
    'dynamic plugin inventory and configuration rendered from installed deployment state',
  ], 'DeepSeek Harness reference_value');
  assertStringArrayIncludes(deepseekHarness.opl_mapping, [
    'OPL Studio is the only GUI route allowed to import DeepSeek Harness renderer runtime or GUI source; AionUI may consume only the OPL-owned contribution ABI without a DeepSeek Harness dependency',
    'OPL App keeps product truth and slot policy while Framework projections and App actions remain the only runtime state and mutation ABI',
    'Agent Package descriptors may contribute typed view and slot declarations without owning runtime, domain truth, artifacts, credentials, or release state',
    'slot contributions must be capability-gated, scope-bound, reversible, and absent without leaving placeholder navigation',
    'OPL should reuse the smallest independently testable GUI packages and vendor selected source only when the published package boundary is broken or insufficient while preserving the exact ref and notices',
    'Framework remains the only authoritative Package Host graph; each GUI Client Cordis graph is derived from that Host projection plus the App product profile and slot policy',
  ], 'DeepSeek Harness opl_mapping');
  assertStringArrayIncludes(deepseekHarness.forbidden_reuse, [
    'do not adopt DeepSeek Harness session log, agent loop, provider routing, credential store, plugin manager, or profile home as OPL authority',
    'do not create a second OPL Package registry, runtime, settings store, action bus, or currentness plane',
    'do not add DeepSeek Harness as a second foreground shell beside opl-studio',
    'do not import DeepSeek Harness runtime or GUI source into the AionUI mainline',
    'do not depend on floating npm latest tags while upstream is a developer preview with compatibility-breaking changes',
    'do not assume the repository root license covers every selected package or third-party payload without per-package notices review',
    'do not expose generic provider, backend, or arbitrary-code plugin controls as ordinary OPL App product surfaces',
  ], 'DeepSeek Harness forbidden_reuse');
}

export function validateActiveShellUnaffected(): void {
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
