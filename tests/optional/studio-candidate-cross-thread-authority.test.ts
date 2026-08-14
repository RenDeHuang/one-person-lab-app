import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  candidateValidationPolicyFromRegistry,
  validateCandidate,
  validateNativeThreadAdapterBoundary,
} from '../../scripts/validate-shell-candidates/candidate-contract.ts';
import {
  validateDeepSeekHarnessCompositionEvidence,
  validateDeepSeekHarnessProductLayoutContract,
} from '../../scripts/validate-shell-candidates/candidate-evidence.ts';
import type {
  NativeThreadAdapterBoundary,
  ShellCandidateRegistry,
} from '../../scripts/validate-shell-candidates/types.ts';

const readJson = <T>(relativePath: string): T =>
  JSON.parse(fs.readFileSync(relativePath, 'utf8')) as T;

const readAdapter = (): Record<string, unknown> & {
  thread_adapter_boundary: NativeThreadAdapterBoundary;
} => readJson('contracts/shell-adapters/opl-studio.json');

test('OPL Studio candidate keeps one App Server thread adapter and Codex subagent projection', () => {
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

test('OPL Studio candidate rejects an incomplete thread lifecycle protocol', () => {
  const boundary = structuredClone(readAdapter().thread_adapter_boundary);
  boundary.supported_protocols = boundary.supported_protocols.filter(
    (method) => method !== 'thread/start',
  );

  assert.throws(
    () => validateNativeThreadAdapterBoundary(boundary),
    /single user-initiated Codex App Server adapter/,
  );
});

test('OPL Studio candidate rejects a private coordination layer', () => {
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

test('OPL Studio candidate rejects removal of Codex subagent projections', () => {
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

test('OPL Studio candidate machine contract removes retired private capabilities', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const policy = candidateValidationPolicyFromRegistry(registry);
  const candidate = registry.candidates.find((entry) => entry.id === 'opl-studio');
  assert.ok(candidate);
  assert.doesNotThrow(() => validateCandidate(candidate, policy));
  assert.equal(candidate.candidate_stage, 'opl_studio_single_app_server_adapter_candidate_only');
  assert.deepEqual(candidate.maintenance_policy, {
    mode: 'manual_on_demand_non_periodic_technical_evaluation',
    automatic_or_scheduled_work_allowed: false,
    mainline_development_required: false,
    completion_or_parity_obligation: false,
    release_blocking: false,
  });
  assert.equal(candidate.runtime_dependency_policy?.aioncore_required, false);
  assert.equal(candidate.runtime_dependency_policy?.aionui_required, false);
  assert.equal(candidate.runtime_dependency_policy?.multi_backend_abstraction_required, false);
  assert.equal(candidate.runtime_dependency_policy?.thread_store_owner, 'codex_core_app_server');
  assert.equal(candidate.release_participation, 'manual_on_demand_technical_evaluation_build_only');
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

test('OPL Studio candidate binds its visual baseline to pinned DSH source plus App product constraints', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const policy = candidateValidationPolicyFromRegistry(registry);
  const candidate = registry.candidates.find((entry) => entry.id === 'opl-studio');
  assert.ok(candidate);
  assert.doesNotThrow(() => validateCandidate(candidate, policy));
  assert.equal(
    candidate.visual_parity_contract?.visual_style_baseline,
    'DeepSeek Harness selected MIT GUI source plus One Person Lab App-owned product constraints',
  );
  assert.equal(
    candidate.visual_parity_contract?.font_asset_policy,
    'reuse_deepseek_harness_system_font_behavior_without_copying_unrelated_assets',
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

test('OPL Studio candidate evidence binds layout and interaction semantics to pinned DSH source', () => {
  const alignment = {
    reference_product: 'DeepSeek Harness Web client',
    project_rail: 'persistent',
    timeline: 'single_conversation_timeline',
    model_controls: 'composer_bottom_row',
    reasoning_controls: 'composer_bottom_row',
    details: 'dsh_resizable_column_on_desktop_fullscreen_overlay_on_mobile',
    left_rail_items: ['projects', 'conversations', 'search', 'settings'],
    right_context_modules: ['run_status', 'files_results', 'agents_capabilities'],
    runtime_status_sources: [
      'codex_app_server_current_thread',
      'opl_app_state_active_project_lines',
    ],
    runtime_detail_slot: 'ui_contributions.runtime.detail',
    files_input_policy: 'user_selected_files_and_directories_only',
    results_policy: 'owner_projected_artifacts_only_no_action_json',
    package_lifecycle_surface: 'settings',
    product_identity: {
      visible_text: ['OPL Studio', 'One Person Lab'],
      logo_visible: false,
      bundle_icon_allowed: true,
    },
    settings_locale_surface: 'settings',
    model_policy_source:
      'one-person-lab-app/contracts/app-product-profile.json#gui.home.codex_model_display_options',
    model_policy_consumption: 'dynamic_build_injection_with_minimal_offline_fallback',
    required_surfaces: [
      'persistent_project_rail',
      'single_conversation_timeline',
      'composer_model_and_reasoning_controls',
      'on_demand_dsh_details_column',
      'settings_locale_surface',
      'text_only_opl_product_identity',
    ],
  };

  assert.doesNotThrow(() =>
    validateDeepSeekHarnessCompositionEvidence('opl-studio', {
      product_layout_contract: alignment,
      primary_visual_reference: {
        reference_product: 'DeepSeek Harness',
        reference_version: '47f943859bef60e4160492346772ded9b24f765a',
        source_usage: 'direct_mit_gui_source_reuse',
        left_side: 'persistent project and conversation rail with search and Settings only',
        center: 'single dominant conversation timeline with bottom composer',
        right_side: 'on-demand DSH details column for run status, files and results, and agents and capabilities',
      },
      visual_style_reference: {
        reference_product: 'DeepSeek Harness',
        reference_version: '47f943859bef60e4160492346772ded9b24f765a',
        scope: 'six_pinned_gui_package_source_trees_with_vendor_external_opl_adapters',
        token_source: 'src/vendor/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css',
        font_asset_policy: 'system_font_stack_no_foreign_font_binary_redistribution',
      },
    }),
  );

  const missingTimeline = structuredClone(alignment);
  missingTimeline.timeline = 'split_conversation_timeline';
  assert.throws(
    () => validateDeepSeekHarnessProductLayoutContract('opl-studio', missingTimeline),
    /DeepSeek Harness Web client composition/,
  );

  assert.throws(
    () =>
      validateDeepSeekHarnessCompositionEvidence('opl-studio', {
        codex_design_reference_alignment: alignment,
      }),
    /must not retain Codex visual-alignment contracts/,
  );
});

test('OPL Studio keeps runtime work in the three-module on-demand context instead of a separate core route', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const policy = candidateValidationPolicyFromRegistry(registry);
  const candidate = registry.candidates.find((entry) => entry.id === 'opl-studio');
  assert.ok(candidate);
  assert.equal(Object.hasOwn(candidate.target_product_shape, 'runtime_page_policy'), false);
  assert.deepEqual(candidate.target_product_shape.left_rail_items, ['projects', 'conversations', 'search', 'settings']);
  assert.deepEqual(candidate.target_product_shape.right_context_modules, ['run_status', 'files_results', 'agents_capabilities']);
  assert.equal(candidate.target_product_shape.runtime_detail_slot, 'ui_contributions.runtime.detail');
  assert.equal(candidate.target_product_shape.package_lifecycle_surface, 'settings');
  assert.equal(candidate.target_product_shape.product_identity.logo_visible, false);
  assert.equal(candidate.framework_surfaces.full_drilldown, 'opl runtime app-operator-drilldown --detail full --json');
  assert.doesNotThrow(() => validateCandidate(candidate, policy));

  const extraLeftRailPage = structuredClone(candidate);
  extraLeftRailPage.target_product_shape.left_rail_items.push('environment');
  assert.throws(
    () => validateCandidate(extraLeftRailPage, policy),
    /left_rail_items must be exactly/,
  );

  const extraRightModule = structuredClone(candidate);
  extraRightModule.target_product_shape.right_context_modules.push('project_context');
  assert.throws(
    () => validateCandidate(extraRightModule, policy),
    /right_context_modules must be exactly/,
  );

  const visibleLogo = structuredClone(candidate);
  visibleLogo.target_product_shape.product_identity.logo_visible = true;
  assert.throws(
    () => validateCandidate(visibleLogo, policy),
    /without an in-app Logo/,
  );
});

test('OPL Studio candidate account footer consumes only the canonical Gateway display name', () => {
  const registry = readJson<ShellCandidateRegistry>('contracts/app-shell-candidates.json');
  const candidate = registry.candidates.find((entry) => entry.id === 'opl-studio');
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
