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
    alternative?.only_foreground_alternative !== 'hermes-codex' ||
    alternative.basis !== 'Hermes Desktop' ||
    alternative.archived_proof_policy !== 'do_not_update_or_improve_unless_user_explicitly_requests_agui' ||
    alternative.active_shell_switch_policy !== 'only_contracts/app-shell-adapter.json_can_switch_default_release_shell'
  ) {
    throw new Error('candidate registry must keep Hermes Desktop as the only foreground alternative and AGUI as explicit-only archived proof');
  }
  assertStringArrayIncludes(alternative.default_candidate_validation_scope, ['hermes-codex'], 'alternative_gui_policy.default_candidate_validation_scope');
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
