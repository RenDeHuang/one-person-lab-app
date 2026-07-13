import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRuntimeBridgeContract } from '../../scripts/validate-active-shell/runtime-bridge-validator.ts';
import { validateRegistryShape } from '../../scripts/validate-shell-candidates/registry.ts';
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
