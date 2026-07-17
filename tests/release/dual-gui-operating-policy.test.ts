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
});

test('Hermes first-run contracts keep module reconciliation out of the hot-launch path', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const hermes = registry.candidates.find((candidate) => candidate.id === 'hermes-codex');
  const adapter = readJson<{
    first_run_contract: ShellCandidateRegistry['candidates'][number]['first_run_contract'];
  }>(
    'contracts/shell-adapters/hermes-codex.json',
  );

  assert.ok(hermes?.first_run_contract);
  assert.deepEqual(adapter.first_run_contract, hermes.first_run_contract);

  const firstRun = hermes.first_run_contract;
  assert.ok(firstRun.background_refresh_sequence.includes('opl system reconcile-modules --json'));
  assert.equal(firstRun.background_refresh_sequence.includes('opl packages update --json'), false);
  assert.equal(
    firstRun.blocking_policy,
    'full_opl_initialize_and_module_refresh_must_not_block_hot_launch_or_chat_after_light_check_passes',
  );
  assert.ok(firstRun.skip_to_chat_policy.must_not_claim.includes('module_reconcile_complete'));
  assert.equal(firstRun.skip_to_chat_policy.must_not_claim.includes('package_reconcile_complete'), false);
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

test('Runtime keeps its Framework producer while remaining optional for AionUI and Native phase one', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  const runtimeRow = runtimeBridge.canonical_state_display_action_map.rows.find(
    (row: any) => row.semantic_area === 'runtime',
  );

  assert.equal(runtimeRow.route_classification, 'retained_optional_x0_owner_route');
  assert.equal(runtimeRow.producer_required, true);
  assert.equal(runtimeRow.aionui_optional_route, true);
  assert.equal(runtimeRow.native_phase_one_required, false);
  assert.equal(
    runtimeBridge.canonical_state_display_action_map.shells.opl_native_workbench.role,
    'foreground_candidate_optional_runtime_consumer_not_phase_one_parity',
  );
  assert.doesNotThrow(() => validateRuntimeBridgeContract(runtimeBridge, activeAdapter));

  const weakenedProducer = structuredClone(runtimeBridge);
  weakenedProducer.canonical_state_display_action_map.rows.find(
    (row: any) => row.semantic_area === 'runtime',
  ).producer_required = false;
  assert.throws(
    () => validateRuntimeBridgeContract(weakenedProducer, activeAdapter),
    /preserve the required Framework producer/,
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
