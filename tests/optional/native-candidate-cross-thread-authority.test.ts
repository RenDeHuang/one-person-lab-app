import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  candidateValidationPolicyFromRegistry,
  validateCandidate,
  validateNativeThreadAdapterBoundary,
} from '../../scripts/validate-shell-candidates/candidate-contract.ts';
import {
  validateCodexDesignReferenceAlignment,
  validateCodexDesignReferenceEvidence,
} from '../../scripts/validate-shell-candidates/candidate-evidence.ts';
import type {
  NativeThreadAdapterBoundary,
  ShellCandidateRegistry,
} from '../../scripts/validate-shell-candidates/types.ts';

const readJson = <T>(relativePath: string): T =>
  JSON.parse(fs.readFileSync(relativePath, 'utf8')) as T;

const readAdapter = (): Record<string, unknown> & {
  thread_adapter_boundary: NativeThreadAdapterBoundary;
} => readJson('contracts/shell-adapters/opl-native-workbench.json');

test('native candidate keeps one App Server thread adapter and Codex subagent projection', () => {
  const adapter = readAdapter();
  const boundary = adapter.thread_adapter_boundary;

  assert.doesNotThrow(() => validateNativeThreadAdapterBoundary(boundary));
  assert.deepEqual(boundary.supported_protocols, [
    'thread/list',
    'thread/read',
    'thread/start',
    'thread/resume',
    'thread/fork',
    'thread/archive',
    'thread/unarchive',
    'turn/start',
    'turn/steer',
  ]);
  assert.deepEqual(boundary.codex_subagent_projection, {
    mode: 'read_only_thread_metadata_and_items',
    thread_source_kinds: [
      'subAgent',
      'subAgentReview',
      'subAgentCompact',
      'subAgentThreadSpawn',
      'subAgentOther',
    ],
    thread_item_types: ['collabAgentToolCall', 'subAgentActivity'],
    metadata_fields: ['parentThreadId', 'agentRole', 'agentNickname'],
  });
  assert.equal('cross_top_level_thread_authority' in adapter, false);
});

test('native candidate rejects an incomplete thread lifecycle protocol', () => {
  const boundary = structuredClone(readAdapter().thread_adapter_boundary);
  boundary.supported_protocols = boundary.supported_protocols.filter(
    (method) => method !== 'thread/start',
  );

  assert.throws(
    () => validateNativeThreadAdapterBoundary(boundary),
    /single user-initiated Codex App Server adapter/,
  );
});

test('native candidate rejects a private coordination layer', () => {
  const enabled = structuredClone(readAdapter().thread_adapter_boundary);
  enabled.private_coordination_layer_allowed = true;
  assert.throws(
    () => validateNativeThreadAdapterBoundary(enabled),
    /no private coordination layer/,
  );

  const extraPrivateState = {
    ...readAdapter().thread_adapter_boundary,
    host_queue: { enabled: true },
  } as unknown as NativeThreadAdapterBoundary;
  assert.throws(
    () => validateNativeThreadAdapterBoundary(extraPrivateState),
    /no private coordination layer/,
  );
});

test('native candidate rejects removal of Codex subagent projections', () => {
  const missingMetadata = structuredClone(readAdapter().thread_adapter_boundary);
  missingMetadata.codex_subagent_projection.metadata_fields = ['parentThreadId'];

  const missingSourceKind = structuredClone(readAdapter().thread_adapter_boundary);
  missingSourceKind.codex_subagent_projection.thread_source_kinds = ['subAgent'];

  const missingThreadItem = structuredClone(readAdapter().thread_adapter_boundary);
  missingThreadItem.codex_subagent_projection.thread_item_types = ['subAgentActivity'];

  for (const boundary of [missingMetadata, missingSourceKind, missingThreadItem]) {
    assert.throws(
      () => validateNativeThreadAdapterBoundary(boundary),
      /preserve Codex subagent metadata, source kinds, and thread items/,
    );
  }
});

test('native candidate machine contract removes retired private capabilities', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const policy = candidateValidationPolicyFromRegistry(registry);
  const candidate = registry.candidates.find((entry) => entry.id === 'opl-native-workbench');
  assert.ok(candidate);
  assert.doesNotThrow(() => validateCandidate(candidate, policy));
  assert.equal(candidate.candidate_stage, 'opl_native_workbench_single_app_server_adapter_candidate_only');
  assert.equal('local_p0_p1_implementation_evidence' in candidate, false);
  assert.ok(candidate.required_capabilities.includes('single_codex_app_server_thread_adapter'));
  assert.ok(candidate.required_capabilities.includes('codex_subagent_event_projection'));
  for (const retired of [
    'typed_cross_top_level_thread_host_bridge',
    'client_executed_dynamic_tools_coordination_bridge',
    'local_cross_thread_p0_p1',
    'turn_start_steer_with_host_queue',
    'bilateral_coordination_receipts',
    'remote_host_aggregation_p2_deferred',
  ]) {
    assert.equal(candidate.required_capabilities.includes(retired), false);
  }
});

test('native candidate uses rolling external design observations and an App-owned pixel baseline', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const policy = candidateValidationPolicyFromRegistry(registry);
  const candidate = registry.candidates.find((entry) => entry.id === 'opl-native-workbench');
  assert.ok(candidate);
  assert.doesNotThrow(() => validateCandidate(candidate, policy));
  assert.equal(
    candidate.visual_parity_contract?.visual_style_baseline,
    'One Person Lab App-owned visual system and approved pixel baseline',
  );
  assert.equal(
    candidate.visual_parity_contract?.font_asset_policy,
    'match_the_current_codex_workbench_system_font_stack_without_copying_or_redistributing_openai_sans_font_binaries',
  );

  const staleCandidate = structuredClone(candidate);
  assert.ok(staleCandidate.visual_parity_contract);
  staleCandidate.visual_parity_contract.comparison_baseline =
    'ChatGPT Codex macOS 26.707.41301 (2026-07-11)';
  assert.throws(
    () => validateCandidate(staleCandidate, policy),
    /visual_parity_contract must consume the App-owned configured model policy/,
  );
});

test('native candidate evidence validates stable interaction semantics without an external build pin', () => {
  const alignment = {
    project_rail: 'persistent',
    timeline: 'single_conversation_timeline',
    model_controls: 'composer_bottom_row',
    reasoning_controls: 'composer_bottom_row',
    environment_details: 'floating_on_demand',
    settings_locale_surface: 'settings',
    model_policy_source:
      'one-person-lab-app/contracts/app-product-profile.json#gui.home.codex_model_display_options',
    model_policy_consumption: 'dynamic_build_injection_with_minimal_offline_fallback',
    required_surfaces: [
      'persistent_project_rail',
      'single_conversation_timeline',
      'composer_model_and_reasoning_controls',
      'floating_on_demand_environment',
      'settings_locale_surface',
    ],
  };

  assert.doesNotThrow(() =>
    validateCodexDesignReferenceEvidence('opl-native-workbench', {
      codex_design_reference_alignment: alignment,
    }),
  );

  const missingTimeline = structuredClone(alignment);
  missingTimeline.timeline = 'split_conversation_timeline';
  assert.throws(
    () => validateCodexDesignReferenceAlignment('opl-native-workbench', missingTimeline),
    /stable Codex-style interaction semantics/,
  );

  const pinnedExternalBuild = {
    ...alignment,
    reference_version: '26.707.41301',
  };
  assert.throws(
    () =>
      validateCodexDesignReferenceAlignment(
        'opl-native-workbench',
        pinnedExternalBuild,
      ),
    /without pinning current conformance to an external product build/,
  );

  assert.throws(
    () =>
      validateCodexDesignReferenceEvidence('opl-native-workbench', {
        codex_2026_07_11_alignment: alignment,
      }),
    /historical provenance and cannot satisfy current conformance/,
  );
});

test('native phase one keeps the optional Runtime owner route out of required parity', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const policy = candidateValidationPolicyFromRegistry(registry);
  const candidate = registry.candidates.find((entry) => entry.id === 'opl-native-workbench');
  assert.ok(candidate);
  assert.equal(Object.hasOwn(candidate.target_product_shape, 'runtime_page_policy'), false);
  assert.equal(Object.hasOwn(candidate.framework_surfaces, 'full_drilldown'), false);
  assert.equal(candidate.required_capabilities.includes('runtime_summary_detail_action_bridge'), false);
  assert.equal(
    candidate.codex_app_like_chat_target?.capability_inventory.includes(
      'right-side collapsible Files, Skills, Routing, Memory, Always-On, Runtime, and Settings context tabs',
    ),
    false,
  );
  assert.doesNotThrow(() => validateCandidate(candidate, policy));

  const resurrectedPolicy = structuredClone(candidate);
  resurrectedPolicy.target_product_shape.runtime_page_policy =
    'minimal_work_item_list_stage_popover_selected_detail_only';
  assert.throws(
    () => validateCandidate(resurrectedPolicy, policy),
    /must not make the optional Runtime route part of Native phase-one parity/,
  );

  const resurrectedDrilldown = structuredClone(candidate);
  resurrectedDrilldown.framework_surfaces.full_drilldown =
    'opl runtime app-operator-drilldown --detail full --json';
  assert.throws(
    () => validateCandidate(resurrectedDrilldown, policy),
    /must not require optional Runtime full drilldown in Native phase one/,
  );

  const resurrectedCapability = structuredClone(candidate);
  resurrectedCapability.required_capabilities.push('runtime_summary_detail_action_bridge');
  assert.throws(
    () => validateCandidate(resurrectedCapability, policy),
    /must keep the optional Runtime route outside Native phase one/,
  );

  const resurrectedTab = structuredClone(candidate);
  assert.ok(resurrectedTab.codex_app_like_chat_target);
  resurrectedTab.codex_app_like_chat_target.capability_inventory.push(
    'right-side collapsible Files, Skills, Routing, Memory, Always-On, Runtime, and Settings context tabs',
  );
  assert.throws(
    () => validateCandidate(resurrectedTab, policy),
    /must keep the optional Runtime route outside Native phase-one context tabs/,
  );
});

test('native candidate account footer consumes only the canonical Gateway display name', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const candidate = registry.candidates.find((entry) => entry.id === 'opl-native-workbench');
  assert.ok(candidate);
  const footer = candidate.target_product_shape.account_footer_policy;
  assert.equal(footer?.source_ref, 'contracts/app-runtime-bridge.json#opl_gateway_account_projection');
  assert.equal(
    footer?.projection_path,
    'app_state.settings_control_center.app_settings_read_model.opl_gateway_account',
  );
  assert.equal(footer?.connected_identity_source, 'account.display_name');
  assert.equal(footer?.connected_secondary_label, 'OPL Gateway');
  assert.equal(footer?.fallback_display_name, 'One Person Lab');
  assert.equal(footer?.interaction, 'open_settings');
  assert.deepEqual(footer?.connected_statuses, [
    'connected',
    'setup_required',
    'reauth_required',
    'attention_needed',
    'disconnect_pending',
  ]);
  assert.ok(footer?.forbidden_identity_sources.includes('masked_email'));
  assert.ok(footer?.forbidden_identity_sources.includes('api_key'));
  assert.ok(candidate.required_capabilities.includes('opl_gateway_account_footer_projection'));
});
