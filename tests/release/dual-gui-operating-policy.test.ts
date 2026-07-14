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

test('Codex parity adapters reject duplicate Git stores and false cross-host success', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  const invalid = structuredClone(runtimeBridge);
  invalid.codex_local_worktree_handoff_policy.duplicate_git_store_allowed = true;
  invalid.codex_local_worktree_handoff_policy.cross_host.success_projection_allowed = true;

  assert.throws(
    () => validateRuntimeBridgeContract(invalid, activeAdapter),
    /Codex Local and Worktree handoff policy/,
  );
});

test('Codex parity adapters require durable snapshot receipts before managed Worktree cleanup', () => {
  const runtimeBridge = readJson<any>('contracts/app-runtime-bridge.json');
  const activeAdapter = readJson<any>('contracts/app-shell-adapter.json');
  const invalid = structuredClone(runtimeBridge);
  invalid.codex_local_worktree_handoff_policy.snapshot_restore.receipt_schema = 'shell_local_snapshot.v1';
  invalid.codex_local_worktree_handoff_policy.cleanup.snapshot_precondition = 'remove_before_snapshot';

  assert.throws(
    () => validateRuntimeBridgeContract(invalid, activeAdapter),
    /Codex Local and Worktree handoff policy/,
  );

  const incompleteSnapshot = structuredClone(runtimeBridge);
  incompleteSnapshot.codex_local_worktree_handoff_policy.snapshot_restore.snapshot_scope =
    incompleteSnapshot.codex_local_worktree_handoff_policy.snapshot_restore.snapshot_scope.filter(
      (entry: string) => entry !== 'ignored',
    );
  assert.throws(
    () => validateRuntimeBridgeContract(incompleteSnapshot, activeAdapter),
    /Codex Local and Worktree handoff policy/,
  );
});
