import path from 'node:path';
import type { ShellCandidateRegistry } from './types.ts';
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
    alternative?.only_foreground_alternative !== 'opl-native-workbench' ||
    alternative.basis !== 'OPL native workbench' ||
    alternative.archived_proof_policy !== 'do_not_update_or_improve_unless_user_explicitly_requests_agui' ||
    alternative.active_shell_switch_policy !== 'only_contracts/app-shell-adapter.json_can_switch_default_release_shell'
  ) {
    throw new Error('candidate registry must keep OPL native workbench as the foreground alternative, Hermes as a reference candidate, and AGUI as explicit-only archived proof');
  }
  assertStringArrayIncludes(alternative.default_candidate_validation_scope, ['opl-native-workbench'], 'alternative_gui_policy.default_candidate_validation_scope');
  assertStringArrayIncludes(alternative.reference_only_candidates ?? [], ['hermes-codex'], 'alternative_gui_policy.reference_only_candidates');
  if (alternative.reference_candidate_policy !== 'kept_for_explicit_reference_replay_not_default_foreground_scope') {
    throw new Error('Hermes reference candidate policy must keep Hermes out of default foreground scope');
  }
  assertStringArrayIncludes(alternative.archived_technical_proofs, ['agui-codex'], 'alternative_gui_policy.archived_technical_proofs');
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
  if (policy.candidate_state !== 'foreground_alternative_or_archived_technical_proof') {
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
    'candidate re-expresses PilotDeck information organization as a Codex App-style chat-first UI with a lightweight workspace/session rail and right-side collapsible contextual tabs without copying PilotDeck code or runtime',
    'candidate passes state-model validation proving active project line projection consumption without taking runtime or domain authority',
    'candidate compiles a launchable .app bundle through the App wrapper when OPL_APP_SHELL_ADAPTER_CONTRACT selects its adapter contract',
    'candidate passes App-root candidate validation',
    'contracts/app-shell-adapter.json is changed only when candidate becomes active release shell',
  ], 'candidate_policy.adoption_gate');
  if (policy.default_validation_scope !== 'foreground_alternative_only') {
    throw new Error('candidate policy default validation scope must stay foreground_alternative_only');
  }
  if (policy.archived_technical_proof_policy !== 'explicit_user_request_only') {
    throw new Error('candidate policy archived technical proof validation must be explicit_user_request_only');
  }
  validateCandidateNoResurrectionPolicy(registry);
  validateDesignReferences(registry);
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
    'release wrapper default switched without contracts/app-shell-adapter.json',
  ], 'candidate_policy.no_resurrection_policy.forbidden_default_routes');

  const archivedProofs = new Set(alternative.archived_technical_proofs);
  const referenceCandidates = new Set(alternative.reference_only_candidates ?? []);
  const defaultScopeArchivedProofs = alternative.default_candidate_validation_scope.filter((id) => (
    archivedProofs.has(id)
  ));
  if (defaultScopeArchivedProofs.length > 0) {
    throw new Error(`default candidate validation scope must not include archived proofs: ${defaultScopeArchivedProofs.join(', ')}`);
  }
  const defaultScopeReferences = alternative.default_candidate_validation_scope.filter((id) => (
    referenceCandidates.has(id)
  ));
  if (defaultScopeReferences.length > 0) {
    throw new Error(`default candidate validation scope must not include reference-only candidates: ${defaultScopeReferences.join(', ')}`);
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
    throw new Error('candidate registry must record K-Dense BYOK as an experience reference for opl-native-workbench');
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
    "OPL Native Workbench should keep the default visual basis Codex App composer-first, not Open Science's three-column workbench default",
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
