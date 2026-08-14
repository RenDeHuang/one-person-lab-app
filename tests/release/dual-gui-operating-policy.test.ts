import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { readAppShellAdapterContract } from '../../scripts/app-shell-adapter.ts';
import { appOwnedOplStandardAgentMembershipPolicy } from '../../scripts/validate-active-shell/app-contract-constants.ts';
import { validateRuntimeBridgeContract } from '../../scripts/validate-active-shell/runtime-bridge-validator.ts';
import {
  assertArchivedProofCommandExecutionAllowed,
  validateRegistryShape,
} from '../../scripts/validate-shell-candidates/registry.ts';
import type { ShellCandidateRegistry } from '../../scripts/validate-shell-candidates/types.ts';

const readJson = <T>(relativePath: string): T => JSON.parse(fs.readFileSync(relativePath, 'utf8')) as T;

test('dual GUI launcher selection stays separate from release adoption', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  assert.doesNotThrow(() => validateRegistryShape(registry));

  const invalid = structuredClone(registry);
  invalid.interactive_launcher_policy.selection_mutates_release_adoption = true;
  assert.throws(
    () => validateRegistryShape(invalid),
    /selection_mutates_release_adoption must remain false/,
  );

  const archivedTarget = structuredClone(registry);
  archivedTarget.interactive_launcher_policy.selectable_shells.push('agui-codex');
  assert.throws(
    () => validateRegistryShape(archivedTarget),
    /selectable_shells must be exactly the active mainline and foreground alternative/,
  );

  const candidateDetailDrift = structuredClone(registry);
  const native = candidateDetailDrift.candidates.find((candidate) => candidate.id === 'opl-studio');
  assert.ok(native && !('role_tombstone' in native));
  native.required_capabilities = [];
  native.visual_parity_contract!.default_model = 'candidate-only-drift';
  assert.doesNotThrow(() => validateRegistryShape(candidateDetailDrift));
});

test('explicit Studio adapter keeps its candidate implementation role', () => {
  assert.doesNotThrow(() =>
    readAppShellAdapterContract('contracts/shell-adapters/opl-studio.json'),
  );

  const adapter = readJson<any>('contracts/shell-adapters/opl-studio.json');
  assert.equal(
    adapter.gui_authority.implementation_role,
    'foreground_alternative_candidate_implementation_carrier',
  );
});

test('archived Hermes replay requires an explicit user-requested historical replay', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const hermes = registry.candidates.find((candidate) => candidate.id === 'hermes-codex');
  assert.equal(hermes?.state, 'archived_technical_proof');
  assert.equal(hermes?.release_participation, 'explicit_user_requested_technical_replay_only');
  assert.throws(
    () => assertArchivedProofCommandExecutionAllowed(registry, ['hermes-codex'], false),
    /add --archived-proof-replay only when the user explicitly requests that exact archived proof/,
  );
  assert.doesNotThrow(
    () => assertArchivedProofCommandExecutionAllowed(registry, ['hermes-codex'], true),
  );
  assert.doesNotThrow(
    () => assertArchivedProofCommandExecutionAllowed(registry, ['opl-studio'], false),
  );

  const automaticBuild = structuredClone(registry);
  automaticBuild.alternative_gui_policy!.archived_proof_execution_policy.automatic_build_allowed = true;
  assert.throws(
    () => validateRegistryShape(automaticBuild),
    /archived proof replay must stay explicit, historical, and outside release channels/,
  );

  const restoredSnapshot = structuredClone(registry);
  const restoredHermes = restoredSnapshot.candidates.find((candidate) => candidate.id === 'hermes-codex') as any;
  restoredHermes.first_run_contract = { duplicated: true };
  assert.throws(
    () => validateRegistryShape(restoredSnapshot),
    /role tombstone must not duplicate detailed field first_run_contract/,
  );
});

test('DeepSeek Harness code reuse stays Studio-only while the OPL contribution ABI remains shell-neutral', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const reference = registry.design_references?.find(({ id }) => id === 'deepseek-harness');

  assert.equal(reference?.evaluated_ref, '47f943859bef60e4160492346772ded9b24f765a');
  assert.equal(reference?.license, 'MIT');
  assert.equal(reference?.source_usage, 'approved_bounded_source_and_package_reuse');
  assert.equal(reference?.adopted_packages['@deepseek-ai/dsh-client-ui-slots'], '0.1.0-rc.6');
  assert.equal(reference?.adopted_source?.root, 'src/vendor/deepseek-harness');
  assert.equal(reference?.adopted_source?.path_policy, 'preserve_upstream_package_relative_paths');
  assert.ok(reference?.adopted_source?.files.includes('packages/client/ui-layout/src/client/AppFrame.tsx'));
  assert.ok(reference?.adopted_source?.files.includes('packages/client/ui-sidebar/src/client/SidebarRoot.tsx'));
  assert.ok(reference?.adopted_source?.files.includes('packages/client/ui-conversation/src/client/skeleton/InputBar.tsx'));
  assert.ok(reference?.adopted_source?.files.includes('packages/client/ui-settings-general/src/client/SettingsRoot.tsx'));
  assert.ok(reference?.adopted_source?.files.includes('packages/client/ui-theme/src/styles/design-platform.css'));
  assert.equal(reference?.upstream_intake?.floating_ref_allowed, false);
  assert.equal(reference?.upstream_intake?.automatic_promotion_allowed, false);
  assert.doesNotThrow(() => validateRegistryShape(registry));

  const privateFork = structuredClone(registry);
  const privateForkReference = privateFork.design_references?.find(({ id }) => id === 'deepseek-harness');
  assert.ok(privateForkReference?.upstream_intake);
  privateForkReference.upstream_intake.opl_delta_policy = 'edit_vendor_files_in_place';
  assert.throws(
    () => validateRegistryShape(privateFork),
    /DeepSeek Harness upstream_intake/,
  );

  const secondShell = structuredClone(registry);
  const driftedReference = secondShell.design_references?.find(({ id }) => id === 'deepseek-harness');
  assert.ok(driftedReference);
  driftedReference.opl_mapping = driftedReference.opl_mapping.filter(
    (item) => !item.startsWith('OPL Studio is the only GUI route allowed to import'),
  );
  assert.throws(
    () => validateRegistryShape(secondShell),
    /DeepSeek Harness opl_mapping must include OPL Studio is the only GUI route allowed to import DeepSeek Harness renderer runtime or GUI source/,
  );

  const runtimeTakeover = structuredClone(registry);
  const takeoverReference = runtimeTakeover.design_references?.find(({ id }) => id === 'deepseek-harness');
  assert.ok(takeoverReference);
  takeoverReference.forbidden_reuse = takeoverReference.forbidden_reuse.filter(
    (item) => !item.startsWith('do not create a second OPL Package registry'),
  );
  assert.throws(
    () => validateRegistryShape(runtimeTakeover),
    /DeepSeek Harness forbidden_reuse must include do not create a second OPL Package registry/,
  );
});

test('dual GUI runtime parity admits compatible capabilities and treats exact source identity as provenance', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  const target = runtimeBridge.command_resolution_policy.shared_gui_target;
  const policy = runtimeBridge.shared_gui_runtime_resolution_policy;
  const nativeAgentLaunch = runtimeBridge.native_minimum_product_bridge.agent_conversation_launch;

  assert.doesNotThrow(() => validateRuntimeBridgeContract(runtimeBridge, activeAdapter));
  assert.equal(nativeAgentLaunch.catalog_source, 'app_state.agent_packages.directory.entries');
  assert.deepEqual(
    nativeAgentLaunch.opl_standard_agent_membership_policy,
    appOwnedOplStandardAgentMembershipPolicy,
  );
  const sourceMarkerMembershipDrift = structuredClone(runtimeBridge);
  sourceMarkerMembershipDrift.native_minimum_product_bridge.agent_conversation_launch
    .opl_standard_agent_membership_policy.ownership_match_policy =
      'source_explanation.kind_equals_first_party_framework_projection';
  assert.throws(
    () => validateRuntimeBridgeContract(sourceMarkerMembershipDrift, activeAdapter),
    /Native standard Agent membership policy/,
  );
  assert.equal('same_cohort_runtime_identity_required_for_parity' in policy, false);
  assert.equal(policy.parity_admission_basis, 'compatible_runtime_capability_and_versioned_schema_range');
  assert.equal(policy.exact_runtime_identity_equality_may_gate_install_or_runtime, false);
  assert.equal(policy.runtime_identity_owner, 'gaofeng21cn/opl-aion-shell');
  assert.equal(policy.same_physical_runtime_currently_claimed, true);
  assert.equal(
    policy.implementation_status,
    'source_identity_binding_and_full_standard_finder_evidence_complete',
  );
  assert.deepEqual(
    policy.runtime_identity_contract.required_fields,
    [
      'path',
      'realpath',
      'version',
      'sha256',
      'codex_home',
      'runtime_key',
      'runtime_cohort_ref',
      'carrier.producer_manifest_sha256',
      'carrier.projection_manifest_sha256',
    ],
  );
  assert.deepEqual(
    policy.packaged_evidence_contract.required_run_ids,
    ['full_clean_install_finder', 'standard_update_after_full_finder'],
  );
  assert.equal(policy.runtime_identity_contract.aioncore_modification_required, false);
  assert.equal(policy.runtime_identity_contract.aioncore_native_readback_required, false);
  assert.equal(policy.runtime_identity_contract.aioncore_native_readback_claim_allowed, false);
  assert.equal(policy.packaged_evidence_contract.referenced_file_sha256_required, true);
  assert.equal(policy.packaged_evidence_contract.artifact_trigger_status, 'complete');
  assert.equal(
    policy.packaged_evidence_contract.evidence_receipt,
    'docs/delivery/release-evidence/issue-122-codex-runtime-identity-v26.8.1-r5.json',
  );
  assert.deepEqual(
    target.compatibility_requirements.map(({ component_id, capability_id, schema_range }: any) => ({
      component_id,
      capability_id,
      schema_range,
    })),
    [
      { component_id: 'opl_framework', capability_id: 'opl_app_state_fast', schema_range: '>=1 <2' },
      { component_id: 'opl_framework', capability_id: 'opl_app_action_execute', schema_range: '>=1 <2' },
      { component_id: 'codex_cli', capability_id: 'codex_app_server', schema_range: '>=1 <2' },
    ],
  );
  assert.deepEqual(
    target.observational_build_provenance.fields,
    ['opl_path', 'opl_version', 'codex_path', 'codex_version', 'runtime_cohort_ref'],
  );
  assert.equal(target.observational_build_provenance.may_gate_install_or_runtime, false);

  const hostPathOnly = structuredClone(runtimeBridge);
  hostPathOnly.shared_gui_runtime_resolution_policy.host_path_only_resolution_can_prove_parity = true;
  assert.throws(
    () => validateRuntimeBridgeContract(hostPathOnly, activeAdapter),
    /host_path_only_resolution_can_prove_parity must be false/,
  );

  const sameCohortGate = structuredClone(runtimeBridge);
  sameCohortGate.shared_gui_runtime_resolution_policy.same_cohort_runtime_identity_required_for_parity = true;
  assert.throws(
    () => validateRuntimeBridgeContract(sameCohortGate, activeAdapter),
    /must not retain the same_cohort_runtime_identity_required_for_parity gate/,
  );

  const exactIdentityGate = structuredClone(runtimeBridge);
  exactIdentityGate.shared_gui_runtime_resolution_policy.exact_runtime_identity_equality_may_gate_install_or_runtime =
    true;
  assert.throws(
    () => validateRuntimeBridgeContract(exactIdentityGate, activeAdapter),
    /exact_runtime_identity_equality_may_gate_install_or_runtime must be false/,
  );

  const unknownRequirement = structuredClone(runtimeBridge);
  unknownRequirement.command_resolution_policy.shared_gui_target.compatibility_requirements[0].kind =
    'exact_component_identity';
  assert.throws(
    () => validateRuntimeBridgeContract(unknownRequirement, activeAdapter),
    /compatibility requirement kind exact_component_identity is unsupported/,
  );

  const provenanceGate = structuredClone(runtimeBridge);
  provenanceGate.command_resolution_policy.shared_gui_target.observational_build_provenance.may_gate_install_or_runtime =
    true;
  assert.throws(
    () => validateRuntimeBridgeContract(provenanceGate, activeAdapter),
    /observational build provenance may_gate_install_or_runtime must be false/,
  );

  const inventedAionCoreReadback = structuredClone(runtimeBridge);
  inventedAionCoreReadback.shared_gui_runtime_resolution_policy.runtime_identity_contract
    .aioncore_native_readback_claim_allowed = true;
  assert.throws(
    () => validateRuntimeBridgeContract(inventedAionCoreReadback, activeAdapter),
    /aioncore_native_readback_claim_allowed must be false/,
  );

  const missingArtifactRun = structuredClone(runtimeBridge);
  missingArtifactRun.shared_gui_runtime_resolution_policy.packaged_evidence_contract.required_run_ids = [
    'full_clean_install_finder',
  ];
  assert.throws(
    () => validateRuntimeBridgeContract(missingArtifactRun, activeAdapter),
    /packaged evidence runs/,
  );
});

test('Runtime keeps its Framework producer and is required for every adopted shell', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  const runtimeRow = runtimeBridge.canonical_state_display_action_map.rows.find(
    (row: any) => row.semantic_area === 'runtime',
  );

  assert.equal(runtimeRow.route_classification, 'core_dynamic_agent_runtime');
  assert.equal(runtimeRow.producer_required, true);
  assert.equal(runtimeRow.aionui_route_required, true);
  assert.equal(runtimeRow.adopted_shell_route_required, true);
  assert.equal(
    runtimeBridge.canonical_state_display_action_map.shells.opl_studio.role,
    'foreground_candidate_must_implement_core_runtime_before_adoption',
  );
  assert.doesNotThrow(() => validateRuntimeBridgeContract(runtimeBridge, activeAdapter));

  const weakenedProducer = structuredClone(runtimeBridge);
  weakenedProducer.canonical_state_display_action_map.rows.find(
    (row: any) => row.semantic_area === 'runtime',
  ).producer_required = false;
  assert.throws(
    () => validateRuntimeBridgeContract(weakenedProducer, activeAdapter),
    /preserve the Framework producer/,
  );
});

test('dual GUI conversation continuity rejects shell-owned thread history', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  const invalid = structuredClone(runtimeBridge);
  invalid.canonical_conversation_continuity_policy.shell_can_own_thread_history = true;

  assert.throws(
    () => validateRuntimeBridgeContract(invalid, activeAdapter),
    /shell_can_own_thread_history must be false/,
  );
});

test('dual GUI conversation continuity accepts only explicit projectless one-time affinity assignment', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  assert.doesNotThrow(() => validateRuntimeBridgeContract(runtimeBridge, activeAdapter));

  const policy = runtimeBridge.canonical_conversation_continuity_policy.directory_group_policy
    .project_adoption_policy;
  assert.equal(policy.canonical_project_id_assignment_allowed, true);
  assert.equal(policy.canonical_project_id_exact_readback_required, true);
  assert.equal(policy.recorded_runtime_cwd_preservation_required, true);
  assert.equal(policy.recorded_runtime_cwd_blocks_assignment, false);
  assert.equal(policy.runtime_workspace_roots_mutation_allowed, false);
  assert.equal(policy.private_pending_deferred_revision_state_allowed, false);
  assert.equal(
    policy.core_workspace_application,
    'assign_project_affinity_then_thread_read_exact_project_id_and_recorded_cwd_readback_then_local_projection',
  );
  assert.equal(
    policy.turn_or_command_pwd_requirement,
    'never_used_for_project_affinity_eligibility_or_readback',
  );
  assert.equal(policy.transport, 'single_active_codex_app_server_adapter_typed_assign_project_affinity_ipc');
  assert.ok(
    runtimeBridge.canonical_conversation_continuity_policy.required_operations.includes(
      'thread/settings/update',
    ),
  );

  const invalid = structuredClone(runtimeBridge);
  invalid.canonical_conversation_continuity_policy.directory_group_policy
    .project_adoption_policy.bound_session_reassignment_allowed = true;

  assert.throws(
    () => validateRuntimeBridgeContract(invalid, activeAdapter),
    /Canonical conversation directory group policy/,
  );

  const missingProjectIdReadback = structuredClone(runtimeBridge);
  missingProjectIdReadback.canonical_conversation_continuity_policy.directory_group_policy
    .project_adoption_policy.canonical_project_id_exact_readback_required = false;

  assert.throws(
    () => validateRuntimeBridgeContract(missingProjectIdReadback, activeAdapter),
    /Canonical conversation directory group policy/,
  );

  const mutatesRecordedCwd = structuredClone(runtimeBridge);
  mutatesRecordedCwd.canonical_conversation_continuity_policy.directory_group_policy
    .project_adoption_policy.recorded_runtime_cwd_preservation_required = false;

  assert.throws(
    () => validateRuntimeBridgeContract(mutatesRecordedCwd, activeAdapter),
    /Canonical conversation directory group policy/,
  );

  const missingCanonicalUpdate = structuredClone(runtimeBridge);
  missingCanonicalUpdate.canonical_conversation_continuity_policy.required_operations =
    missingCanonicalUpdate.canonical_conversation_continuity_policy.required_operations.filter(
      (operation: string) => operation !== 'thread/settings/update',
    );

  assert.throws(
    () => validateRuntimeBridgeContract(missingCanonicalUpdate, activeAdapter),
    /Canonical conversation continuity operations/,
  );
});

test('runtime bridge rejects a reintroduced managed Worktree handoff policy', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  const invalid = structuredClone(runtimeBridge);
  invalid.codex_local_worktree_handoff_policy = {
    bridge_role: 'state_authority',
    state_authority: 'shell_owned_git_and_thread_store',
  };

  assert.throws(
    () => validateRuntimeBridgeContract(invalid, activeAdapter),
    /must not own a Local or Worktree handoff policy/,
  );
});
