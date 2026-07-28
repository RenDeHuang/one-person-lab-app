import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRuntimeBridgeContract } from '../../scripts/validate-active-shell/runtime-bridge-validator.ts';
import {
  assertReferenceCandidateCommandExecutionAllowed,
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
  const native = candidateDetailDrift.candidates.find((candidate) => candidate.id === 'opl-native-workbench');
  assert.ok(native && !('role_tombstone' in native));
  native.required_capabilities = [];
  native.visual_parity_contract!.default_model = 'candidate-only-drift';
  assert.doesNotThrow(() => validateRegistryShape(candidateDetailDrift));
});

test('Hermes builds require an explicit manual technical-verification replay', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const hermes = registry.candidates.find((candidate) => candidate.id === 'hermes-codex');
  assert.equal(hermes?.release_participation, 'manual_on_demand_technical_verification_build_only');
  assert.throws(
    () => assertReferenceCandidateCommandExecutionAllowed(registry, ['hermes-codex'], false),
    /add --manual-reference-replay only when actual Hermes development requires packaged evidence/,
  );
  assert.doesNotThrow(
    () => assertReferenceCandidateCommandExecutionAllowed(registry, ['hermes-codex'], true),
  );
  assert.doesNotThrow(
    () => assertReferenceCandidateCommandExecutionAllowed(registry, ['opl-native-workbench'], false),
  );

  const automaticBuild = structuredClone(registry);
  automaticBuild.alternative_gui_policy!.reference_candidate_execution_policy.automatic_build_allowed = true;
  assert.throws(
    () => validateRegistryShape(automaticBuild),
    /Hermes reference candidate builds must stay manual, on-demand, technical-verification-only/,
  );

  const restoredSnapshot = structuredClone(registry);
  const restoredHermes = restoredSnapshot.candidates.find((candidate) => candidate.id === 'hermes-codex') as any;
  restoredHermes.first_run_contract = { duplicated: true };
  assert.throws(
    () => validateRegistryShape(restoredSnapshot),
    /role tombstone must not duplicate detailed field first_run_contract/,
  );
});

test('dual GUI runtime parity rejects host PATH-only resolution as shared physical runtime proof', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  assert.doesNotThrow(() => validateRuntimeBridgeContract(runtimeBridge, activeAdapter));

  const invalid = structuredClone(runtimeBridge);
  invalid.shared_gui_runtime_resolution_policy.host_path_only_resolution_can_prove_parity = true;
  assert.throws(
    () => validateRuntimeBridgeContract(invalid, activeAdapter),
    /host_path_only_resolution_can_prove_parity must be false/,
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
    runtimeBridge.canonical_state_display_action_map.shells.opl_native_workbench.role,
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

test('dual GUI conversation continuity preserves Codex ownership of canonical thread history', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  const invalid = structuredClone(runtimeBridge);
  invalid.canonical_conversation_continuity_policy.codex_core_owns_canonical_thread_history = false;

  assert.throws(
    () => validateRuntimeBridgeContract(invalid, activeAdapter),
    /codex_core_owns_canonical_thread_history must be true/,
  );
});

test('ordinary OPL history excludes the canonical Codex directory', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  const policy = runtimeBridge.canonical_conversation_continuity_policy;

  assert.equal(policy.ordinary_rail_authority, 'opl_conversation_store_only');
  assert.equal(policy.opl_conversation_store_owns_ordinary_history, true);
  assert.equal(policy.canonical_codex_scope, 'explicit_known_conversation_open_and_lifecycle_only');
  assert.equal(policy.canonical_directory_enumeration_allowed_for_ordinary_rail, false);
  assert.equal(policy.row_identity, 'opl_conversation_id');
  assert.equal(
    policy.directory_group_policy.legacy_missing_marker_policy,
    'legacy_unknown_visible_unclassified_never_infer_from_workspace_cwd_canonical_cwd_git_origin_title_or_time',
  );
  assert.doesNotThrow(() => validateRuntimeBridgeContract(runtimeBridge, activeAdapter));

  const invalid = structuredClone(runtimeBridge);
  invalid.canonical_conversation_continuity_policy.canonical_directory_enumeration_allowed_for_ordinary_rail =
    true;
  assert.throws(
    () => validateRuntimeBridgeContract(invalid, activeAdapter),
    /canonical_directory_enumeration_allowed_for_ordinary_rail must be false/,
  );
});

test('dual GUI conversation continuity accepts only projectless one-time adoption', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  assert.doesNotThrow(() => validateRuntimeBridgeContract(runtimeBridge, activeAdapter));

  const policy = runtimeBridge.canonical_conversation_continuity_policy.directory_group_policy
    .project_adoption_policy;
  assert.equal(policy.canonical_thread_cwd_initialization_allowed, true);
  assert.equal(policy.canonical_thread_cwd_exact_readback_required, true);
  assert.equal(policy.existing_canonical_thread_cwd_blocks_reassignment, true);
  assert.equal(policy.runtime_workspace_roots_mutation_allowed, false);
  assert.equal(policy.private_pending_deferred_revision_state_allowed, false);
  assert.equal(
    policy.core_workspace_application,
    'thread_settings_update_cwd_then_thread_read_exact_readback_then_local_projection_custom_workspace_true',
  );
  assert.equal(
    policy.turn_or_command_pwd_requirement,
    'never_used_for_adoption_eligibility_or_readback',
  );
  assert.equal(policy.transport, 'codex_app_server_thread_settings_update_cwd');
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

  const missingCwdReadback = structuredClone(runtimeBridge);
  missingCwdReadback.canonical_conversation_continuity_policy.directory_group_policy
    .project_adoption_policy.canonical_thread_cwd_exact_readback_required = false;

  assert.throws(
    () => validateRuntimeBridgeContract(missingCwdReadback, activeAdapter),
    /Canonical conversation directory group policy/,
  );

  const reassignsExistingCwd = structuredClone(runtimeBridge);
  reassignsExistingCwd.canonical_conversation_continuity_policy.directory_group_policy
    .project_adoption_policy.existing_canonical_thread_cwd_blocks_reassignment = false;

  assert.throws(
    () => validateRuntimeBridgeContract(reassignsExistingCwd, activeAdapter),
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
