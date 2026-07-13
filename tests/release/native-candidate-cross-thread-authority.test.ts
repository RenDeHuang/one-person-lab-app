import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  candidateValidationPolicyFromRegistry,
  validateCandidate,
  validateNativeCrossTopLevelThreadAuthority,
} from '../../scripts/validate-shell-candidates/candidate-contract.ts';
import type {
  NativeCrossTopLevelThreadAuthority,
  ShellCandidateRegistry,
} from '../../scripts/validate-shell-candidates/types.ts';

const readJson = <T>(relativePath: string): T => JSON.parse(fs.readFileSync(relativePath, 'utf8')) as T;

const readAuthority = (): NativeCrossTopLevelThreadAuthority => {
  const adapter = readJson<{ cross_top_level_thread_authority: NativeCrossTopLevelThreadAuthority }>(
    'contracts/shell-adapters/opl-native-workbench.json',
  );
  return adapter.cross_top_level_thread_authority;
};

test('native candidate accepts the exact verified local P0 plus P1 cohort while remote P2 stays deferred', () => {
  const authority = readAuthority();
  assert.equal(authority.implementation_status, 'local_p0_p1_implemented_verified_candidate_only');
  assert.equal(authority.primary_composer_control_visible, false);
  assert.equal(authority.thread_detail_context_action_visible, true);
  assert.equal(authority.local_p0_p1_implementation_evidence.native_source_sha, 'c1d9dbda821d95137722e5ff0e40e984486226c5');
  assert.equal(authority.local_p0_p1_implementation_evidence.packaged_native_live.display_name, 'One Person Lab Native');
  assert.equal(
    authority.local_p0_p1_implementation_evidence.installed_native_app.app_path,
    '/Applications/One Person Lab Native.app',
  );
  assert.equal(authority.local_p0_p1_implementation_evidence.installed_native_app.candidate_actions, 'dry_run_only');
  assert.equal(authority.local_p0_p1_implementation_evidence.claim_boundary.active_shell_adopted, false);
  assert.equal(authority.local_p0_p1_implementation_evidence.claim_boundary.release_ready, false);
  assert.doesNotThrow(() => validateNativeCrossTopLevelThreadAuthority(authority));
});

test('native candidate keeps coordination out of the primary composer without removing the contextual entry', () => {
  const primaryComposerEntry = structuredClone(readAuthority());
  primaryComposerEntry.primary_composer_control_visible = true;
  assert.throws(
    () => validateNativeCrossTopLevelThreadAuthority(primaryComposerEntry),
    /cross-thread authority must preserve/,
  );

  const missingContextEntry = structuredClone(readAuthority());
  missingContextEntry.thread_detail_context_action_visible = false;
  assert.throws(
    () => validateNativeCrossTopLevelThreadAuthority(missingContextEntry),
    /cross-thread authority must preserve/,
  );
});

test('native candidate rejects an implementation claim detached from the exact evidence cohort', () => {
  const authority = structuredClone(readAuthority());
  authority.local_p0_p1_implementation_evidence.native_source_sha = '0'.repeat(40);

  assert.throws(
    () => validateNativeCrossTopLevelThreadAuthority(authority),
    /exact verified local cohort/,
  );
});

test('native candidate rejects generated-schema inference in place of a dynamicTools runtime probe', () => {
  const authority = structuredClone(readAuthority());
  authority.p1_model_tool_bridge.runtime_capability_probe_required = false;

  assert.throws(
    () => validateNativeCrossTopLevelThreadAuthority(authority),
    /client-executed dynamicTools with runtime probing/,
  );
});

test('native candidate rejects Desktop-only cross-thread coordination', () => {
  const authority = structuredClone(readAuthority());
  authority.desktop_webui_parity.desktop_only_coordination_capability_allowed = true;

  assert.throws(
    () => validateNativeCrossTopLevelThreadAuthority(authority),
    /Desktop and WebUI must preserve equivalent coordination actions/,
  );
});

test('native candidate rejects missing lifecycle protocol, queue routing, or bilateral target receipt', () => {
  const missingUnarchive = structuredClone(readAuthority());
  missingUnarchive.typed_host_bridge.required_protocol_methods =
    missingUnarchive.typed_host_bridge.required_protocol_methods.filter((method) => method !== 'thread/unarchive');
  assert.throws(
    () => validateNativeCrossTopLevelThreadAuthority(missingUnarchive),
    /must include thread\/unarchive/,
  );

  const bypassedQueue = structuredClone(readAuthority());
  bypassedQueue.local_p0_p1_acceptance.dispatch_policy.running_nonurgent_message = 'turn/steer';
  assert.throws(
    () => validateNativeCrossTopLevelThreadAuthority(bypassedQueue),
    /route resume\/start\/steer through the host queue/,
  );

  const unilateralReceipt = structuredClone(readAuthority());
  unilateralReceipt.local_p0_p1_acceptance.bilateral_receipt.target_timeline_projection = false;
  assert.throws(
    () => validateNativeCrossTopLevelThreadAuthority(unilateralReceipt),
    /bilateral source and target receipt projections/,
  );
});

test('native candidate rejects release, adoption, packaged, or remote readiness inferred from focused authority gates', () => {
  for (const field of [
    'contract_or_docs_prove_implementation_complete',
    'focused_tests_prove_packaged_capability',
    'active_shell_adopted',
    'release_ready',
    'remote_ready',
  ]) {
    const authority = structuredClone(readAuthority());
    authority.false_ready_boundary[field] = true;
    assert.throws(
      () => validateNativeCrossTopLevelThreadAuthority(authority),
      new RegExp(`${field} must remain false`),
    );
  }
});

test('native candidate registry pins 41301 and rejects a superseded Codex visual baseline', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const policy = candidateValidationPolicyFromRegistry(registry);
  const candidate = registry.candidates.find((entry) => entry.id === 'opl-native-workbench');
  assert.ok(candidate);
  assert.doesNotThrow(() => validateCandidate(candidate, policy));

  const staleCandidate = structuredClone(candidate);
  assert.ok(staleCandidate.visual_parity_contract);
  staleCandidate.visual_parity_contract.comparison_baseline = 'ChatGPT Codex macOS 26.707.31123 (2026-07-10)';
  assert.throws(
    () => validateCandidate(staleCandidate, policy),
    /visual_parity_contract must consume the App-owned configured model policy/,
  );
});
