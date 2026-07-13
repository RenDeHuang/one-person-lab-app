import fs from 'node:fs';
import path from 'node:path';
import type {
  NativeCrossTopLevelThreadAuthority,
  NativeLocalP0P1ImplementationEvidence,
  ShellCandidate,
  ShellCandidateRegistry,
  ValidationCommand,
} from './types.ts';
import {
  assertFile,
  assertStringArrayIncludes,
  expectedFrameworkSurfaces,
  forbiddenAuthority,
  requiredCapabilities,
  requiredContextSurfaces,
  requiredContextTestIds,
  requiredHomeEntries,
  requiredSeriesProgressFields,
  forbiddenSeriesDomainFields,
  readJson,
  requiredNativeCapabilities,
  root,
  validateActiveProjectLineStateModel,
} from './shared.ts';

function assertCandidateFileContains(candidate: ShellCandidate, relativePath: string, snippets: string[], label: string): void {
  const filePath = path.join(root, candidate.candidate_root, relativePath);
  assertFile(filePath, `${candidate.id} ${label}`);
  const source = fs.readFileSync(filePath, 'utf8');
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      throw new Error(`${candidate.id} ${label} must include ${snippet}`);
    }
  }
}

function missingCandidateCheckoutCanBeBlocked(candidate: ShellCandidate): boolean {
  return Boolean(
    !fs.existsSync(path.join(root, candidate.candidate_root))
    && candidate.checkout_policy?.missing_checkout_status === 'blocked_missing_checkout'
    && candidate.build_wrapper?.missing_checkout_blocker_allowed === true
  );
}

type CandidateAdapterContract = {
  purpose?: string;
  state?: string;
  adapter_id?: string;
  candidate_shell?: string;
  adapter_role?: string;
  active_shell?: string;
  candidate_stage?: string;
  shell_root: string;
  shell_source: { owner_repo: string; history_policy: string; checkout_path: string };
  release_role: string;
  gui_authority?: { implementation_role?: string };
  shell_contract: { source_topology: string; capabilities: string[] };
  validation_commands: ValidationCommand[];
  manual_verification_commands?: ValidationCommand[];
  app_server_adapter_contract?: ShellCandidate['app_server_adapter_contract'];
  model_access_policy?: ShellCandidate['model_access_policy'];
  agent_route_contract?: ShellCandidate['agent_route_contract'];
  settings_information_architecture?: ShellCandidate['settings_information_architecture'];
  visual_parity_contract?: ShellCandidate['visual_parity_contract'];
  cross_top_level_thread_authority?: NativeCrossTopLevelThreadAuthority;
};

type NativeVisualParityContract = NonNullable<ShellCandidate['visual_parity_contract']> & {
  regression_floor?: string;
  source_usage?: string;
  current_reference_status?: string;
  superseded_observations?: string[];
  model_policy_source?: string;
  default_model?: string;
  default_reasoning_effort?: string;
  required_surfaces?: string[];
};

export const requiredNativeVisualParitySurfaces = [
  'persistent_project_rail',
  'single_conversation_timeline',
  'composer_model_and_reasoning_controls',
  'floating_on_demand_environment',
  'settings_locale_surface',
];

const requiredCrossThreadProtocolMethods = [
  'thread/list',
  'thread/read',
  'thread/resume',
  'thread/fork',
  'thread/archive',
  'thread/unarchive',
  'turn/start',
  'turn/steer',
];

const requiredNativeCrossThreadCapabilities = [
  'typed_cross_top_level_thread_host_bridge',
  'client_executed_dynamic_tools_coordination_bridge',
  'local_cross_thread_p0_p1',
  'thread_list_read_resume_fork_archive_unarchive',
  'turn_start_steer_with_host_queue',
  'cross_thread_safety_gates',
  'bilateral_coordination_receipts',
  'desktop_webui_coordination_parity',
  'remote_host_aggregation_p2_deferred',
];

const requiredCrossThreadSafetyGates = [
  'permission_check',
  'idempotency_key_and_duplicate_message_check',
  'delegation_cycle_check',
  'project_and_workspace_scope_check',
  'concurrent_write_set_conflict_check',
  'delegation_hop_budget_check',
  'host_scope_check',
  'no_target_permission_escalation',
  'source_target_identity_must_differ',
];

const requiredFalseReadyFields = [
  'contract_or_docs_prove_implementation_complete',
  'focused_tests_prove_packaged_capability',
  'candidate_validation_proves_active_shell_adopted',
  'candidate_validation_proves_release_ready',
  'candidate_validation_proves_production_ready',
  'candidate_validation_proves_clean_vm_ready',
  'candidate_validation_proves_remote_ready',
  'active_shell_adopted',
  'release_ready',
  'production_ready',
  'clean_vm_ready',
  'remote_ready',
];

const nativeEvidenceSourceSha = '52a99697a44823824b37c73c3f92d8dd517eec4b';
const nativeEvidenceAppProductAuthoritySha = 'e96621b7d6bcfc502859c419e72d4a93fc51e4f8';

function validateNativeLocalP0P1ImplementationEvidence(
  evidence: NativeLocalP0P1ImplementationEvidence | undefined,
): void {
  const source = evidence?.source_and_package_gates ?? {};
  const dynamicTools = evidence?.dynamic_tools_live ?? {};
  const coordination = evidence?.coordination_live ?? {};
  const packaged = evidence?.packaged_native_live ?? {};
  const boundary = evidence?.claim_boundary ?? {};
  if (
    !evidence ||
    evidence.status !== 'verified_local_candidate_only' ||
    evidence.observed_at !== '2026-07-13' ||
    evidence.app_product_authority_sha !== nativeEvidenceAppProductAuthoritySha ||
    evidence.native_source_sha !== nativeEvidenceSourceSha ||
    evidence.native_source_ref !== 'origin/main' ||
    evidence.codex_cli_version !== '0.144.1' ||
    evidence.fixed_cohort !== true ||
    source.native_test_suite !== 'passed' ||
    source.coordination_security_cases !== 10 ||
    source.webui_host_tests !== 9 ||
    source.fast_gui_projection_bytes !== 132753 ||
    dynamicTools.thread_id !== '019f599c-ea66-7523-bc3f-85106d15540c' ||
    dynamicTools.request_id_preserved !== true ||
    dynamicTools.turn_completed !== true ||
    coordination.source_thread_id !== '019f599d-399d-7ec1-9274-433e7481c630' ||
    coordination.target_thread_id !== '019f599d-4557-7351-a74d-c8f41c697fbc' ||
    coordination.forked_thread_id !== '019f599d-f0c4-7933-9487-9cab6d18d140' ||
    coordination.list_terminal_cursor !== null ||
    coordination.direct_turn_start !== 'completed' ||
    coordination.host_queue_then_turn_start !== 'completed' ||
    coordination.urgent_turn_steer !== 'completed' ||
    packaged.bundle_id !== 'cn.gflab.opl.native-workbench.candidate' ||
    packaged.window_evidence !== 'core_graphics_fallback_after_ax_denied_-25211' ||
    packaged.window_id !== 111241 ||
    packaged.renderer_sha256 !== 'd7349bb5de3d6d1ec936a789b9c71e84ebd557971a5fbb37f9cfc848616a554a' ||
    packaged.package_manifest_sha256 !== '315cf2a344650cf044a7e110948e506738907ebc5aec80242094124a5e49be4d' ||
    packaged.screenshot_sha256 !== '510e269e5e29e4ea941b4d237008c686ac2a4c0937e553115ccd38d47ef116c9' ||
    packaged.process_cleanup !== true ||
    boundary.local_p0_p1_implemented !== true ||
    boundary.candidate_only !== true ||
    boundary.active_shell_adopted !== false ||
    boundary.release_ready !== false ||
    boundary.production_ready !== false ||
    boundary.clean_vm_ready !== false ||
    boundary.remote_ready !== false
  ) {
    throw new Error('native candidate local P0 plus P1 evidence must bind the exact verified local cohort without changing adoption, release, clean-VM, or remote readiness');
  }
  assertStringArrayIncludes(packaged.screenshot_markers, ['Codex', '5.6 Sol'], 'native candidate packaged screenshot markers');
}

const appProductProfile = readJson<{
  codex: { default_model: string; default_reasoning_effort: string };
}>(path.join(root, 'contracts', 'app-product-profile.json'));
const configuredDefaultModel = appProductProfile.codex.default_model;
const configuredDefaultReasoningEffort = appProductProfile.codex.default_reasoning_effort;

export type CandidateValidationPolicy = {
  onlyForegroundAlternative: string;
  defaultCandidateValidationScope: string[];
  archivedTechnicalProofs: string[];
  archivedProofUpdatePolicy: string;
  referenceOnlyCandidates: string[];
  referenceCandidatePolicy?: string;
};

export function candidateValidationPolicyFromRegistry(registry: ShellCandidateRegistry): CandidateValidationPolicy {
  const alternative = registry.alternative_gui_policy;
  if (!alternative) {
    throw new Error('candidate registry must declare alternative_gui_policy before candidate validation');
  }
  return {
    onlyForegroundAlternative: alternative.only_foreground_alternative,
    defaultCandidateValidationScope: alternative.default_candidate_validation_scope,
    archivedTechnicalProofs: alternative.archived_technical_proofs,
    archivedProofUpdatePolicy: alternative.archived_proof_policy,
    referenceOnlyCandidates: alternative.reference_only_candidates ?? [],
    referenceCandidatePolicy: alternative.reference_candidate_policy,
  };
}

function validateCandidateRegistryEntry(candidate: ShellCandidate, policy: CandidateValidationPolicy): void {
  if (!candidate.id || !candidate.candidate_root) {
    throw new Error(`Invalid candidate entry: ${JSON.stringify(candidate)}`);
  }
  const isArchivedProof = policy.archivedTechnicalProofs.includes(candidate.id);
  const isForegroundAlternative = candidate.id === policy.onlyForegroundAlternative;
  const isDefaultCandidate = policy.defaultCandidateValidationScope.includes(candidate.id);
  const isReferenceCandidate = policy.referenceOnlyCandidates.includes(candidate.id);
  const expectedState = isArchivedProof
    ? 'archived_technical_proof'
    : isReferenceCandidate
      ? 'technical_reference'
      : 'technical_verification';
  if (candidate.state !== expectedState) {
    throw new Error(`${candidate.id} must stay in ${expectedState} according to app-shell-candidates alternative_gui_policy`);
  }
  if (!isArchivedProof && !isForegroundAlternative && !isReferenceCandidate) {
    throw new Error(`${candidate.id} must be the foreground alternative, a reference candidate, or an archived technical proof`);
  }
  if (isArchivedProof && isDefaultCandidate) {
    throw new Error(`${candidate.id} archived technical proof must not enter default candidate validation scope`);
  }
  if (isReferenceCandidate && isDefaultCandidate) {
    throw new Error(`${candidate.id} reference candidate must not enter default candidate validation scope`);
  }
  if (isForegroundAlternative && !isDefaultCandidate) {
    throw new Error(`${candidate.id} foreground alternative must be included in default candidate validation scope`);
  }
  if (isArchivedProof) {
    if (!candidate.archived_reason?.includes('AG-UI/CopilotKit work served its technical verification purpose')) {
      throw new Error(`${candidate.id} archived technical proof must record why it is no longer a foreground alternative`);
    }
    if (candidate.default_update_policy !== policy.archivedProofUpdatePolicy) {
      throw new Error(`${candidate.id} archived proof update policy must match alternative_gui_policy.archived_proof_policy`);
    }
  }
  if (!candidate.candidate_root.startsWith('shells/') || candidate.candidate_root.split(/[\\/]+/).includes('..')) {
    throw new Error(`${candidate.id} candidate_root must be under shells/<candidate>`);
  }
  const expectedReleaseParticipation = isArchivedProof
    ? 'explicit_user_requested_technical_replay_only'
    : 'selectable_for_explicit_candidate_build';
  if (candidate.release_participation !== expectedReleaseParticipation) {
    throw new Error(`${candidate.id} must only participate in explicit candidate builds`);
  }
  if (candidate.source_topology !== 'external_checkout_linked_shell_repo') {
    throw new Error(`${candidate.id} must declare external_checkout_linked_shell_repo topology`);
  }
}

function readCandidateAdapterContract(candidate: ShellCandidate): CandidateAdapterContract {
  assertFile(path.join(root, candidate.adapter_contract), `${candidate.id} adapter contract`);
  return readJson<CandidateAdapterContract>(path.join(root, candidate.adapter_contract));
}

export function validateNativeCrossTopLevelThreadAuthority(
  authority: NativeCrossTopLevelThreadAuthority | undefined,
): void {
  if (
    !authority ||
    authority.authority_model !== 'three_layer_thread_coordination_authority' ||
    authority.implementation_status !== 'local_p0_p1_implemented_verified_candidate_only' ||
    authority.product_role !== 'opl_host_cross_top_level_codex_thread_coordination' ||
    authority.entry_surface !== 'navigation_rail_thread_actions_and_on_demand_coordination_drawer' ||
    authority.default_state !== 'closed' ||
    authority.model_role !== 'decide_when_and_why_to_coordinate' ||
    authority.protocol_owner !== 'codex_core_app_server' ||
    authority.app_host_owner !== 'opl_app_host' ||
    authority.coordination_owner !== 'opl_app_typed_host_bridge' ||
    authority.renderer_role !== 'typed_projection_and_intent_consumer_only' ||
    authority.thread_store_owner !== 'codex_core_app_server' ||
    authority.thread_id_policy !== 'opaque_app_server_returned_key_never_model_or_shell_generated'
  ) {
    throw new Error('opl-native-workbench cross-thread authority must preserve Codex protocol ownership, typed OPL host gates, opaque thread ids, and verified candidate-only status');
  }
  validateNativeLocalP0P1ImplementationEvidence(authority.local_p0_p1_implementation_evidence);

  const sameTree = authority.authority_layers.same_agent_tree ?? {};
  const local = authority.authority_layers.local_cross_top_level ?? {};
  const remote = authority.authority_layers.remote_cross_machine ?? {};
  if (
    sameTree.level !== 'L0' ||
    sameTree.scope !== 'same_agent_tree_only' ||
    sameTree.owner !== 'codex_runtime_agent_registry' ||
    sameTree.cross_top_level_use_forbidden !== true
  ) {
    throw new Error('same-agent-tree tools must remain L0 runtime tools and must not become a cross-top-level message bus');
  }
  assertStringArrayIncludes(sameTree.methods, ['spawn_agent', 'send_input', 'wait_agent'], 'cross-thread authority L0 methods');
  if (
    local.level !== 'L1' ||
    local.phase !== 'P0_plus_P1' ||
    local.acceptance_status !== 'required_for_candidate_acceptance' ||
    local.owner !== 'opl_app_typed_host_bridge_over_local_codex_app_server'
  ) {
    throw new Error('local independent top-level threads must be the required L1 P0 plus P1 candidate target');
  }
  if (
    remote.level !== 'L2' ||
    remote.phase !== 'P2' ||
    remote.acceptance_status !== 'deferred_not_required_for_local_candidate_acceptance' ||
    remote.ready !== false
  ) {
    throw new Error('remote cross-machine coordination must remain deferred L2 P2 and false-ready');
  }

  const host = authority.typed_host_bridge;
  if (
    host.required !== true ||
    host.transport_contract !== 'typed_request_response_event_and_receipt_envelopes' ||
    host.renderer_direct_app_server_json_rpc_forbidden !== true ||
    host.shell_owned_thread_store_forbidden !== true ||
    host.shell_owned_permission_model_forbidden !== true ||
    host.required_status_event !== 'thread/status/changed' ||
    host.optional_relationship_fields_policy !== 'capability_detect_parent_and_ancestor_fields_and_degrade_without_blocking_list_read_or_dispatch'
  ) {
    throw new Error('native candidate must use a typed host bridge without renderer protocol access or shell-owned thread and permission stores');
  }
  assertStringArrayIncludes(host.required_protocol_methods, requiredCrossThreadProtocolMethods, 'cross-thread typed host protocol methods');
  const hostLedger = host.host_owned_minimal_coordination_ledger;
  if (
    hostLedger.allowed !== true ||
    hostLedger.storage_policy !== 'append_only_queue_and_bilateral_receipt_metadata' ||
    hostLedger.thread_history_allowed !== false ||
    hostLedger.thread_truth_authority !== false
  ) {
    throw new Error('typed host may own only a minimal append-only queue and receipt ledger without thread history or thread truth authority');
  }

  const modelTools = authority.p1_model_tool_bridge;
  const generatedSchema = modelTools.codex_cli_schema_observation;
  const liveProbe = modelTools.ephemeral_live_probe_observation;
  if (
    modelTools.current_transport !== 'client_executed_dynamic_tools' ||
    modelTools.bridge_must_reuse_typed_host_gate !== true ||
    modelTools.direct_app_server_or_ledger_bypass_forbidden !== true ||
    modelTools.tool_calls_must_apply_same_safety_gates_and_receipts_as_gui !== true ||
    generatedSchema.version !== '0.144.1' ||
    generatedSchema.generator !== 'generate-ts' ||
    generatedSchema.dynamic_tools_field_present !== false ||
    liveProbe.dynamic_tools_registration_accepted !== true ||
    liveProbe.received_event !== 'item/tool/call' ||
    liveProbe.turn_completed !== true ||
    modelTools.schema_drift_record_required !== true ||
    modelTools.runtime_capability_probe_required !== true ||
    modelTools.probe_policy !== 'probe_runtime_behavior_instead_of_inferring_support_from_generate_ts' ||
    modelTools.fallback_policy !== 'typed_model_tool_unavailable_with_user_driven_host_coordination_preserved' ||
    modelTools.fallback_must_not_claim_p1_model_tool_ready !== true
  ) {
    throw new Error('P1 model tools must use client-executed dynamicTools with runtime probing, schema-drift recording, shared host gates, and a non-ready fallback');
  }
  assertStringArrayIncludes(modelTools.required_high_level_tools, [
    'list_threads',
    'read_thread',
    'send_message_to_thread',
    'fork_thread',
    'archive_thread',
    'unarchive_thread',
    'wait_thread',
  ], 'P1 client-executed dynamicTools');

  const localAcceptance = authority.local_p0_p1_acceptance;
  const directory = localAcceptance.thread_directory;
  const dispatch = localAcceptance.dispatch_policy;
  const receipt = localAcceptance.bilateral_receipt;
  if (
    localAcceptance.scope !== 'local_machine_only' ||
    directory.list_protocol !== 'thread/list' ||
    directory.read_protocol !== 'thread/read' ||
    directory.default_scope !== 'current_project' ||
    directory.archived_scope_requires_explicit_filter !== true
  ) {
    throw new Error('local P0 plus P1 must provide a current-project thread directory with explicit archived scope');
  }
  assertStringArrayIncludes(directory.required_fields, [
    'thread_id', 'status', 'summary', 'project', 'workspace', 'host', 'owner', 'goal',
    'archived', 'parent_thread_id', 'ancestor_thread_ids', 'active_turn_id', 'write_set',
  ], 'local thread directory fields');
  assertStringArrayIncludes(localAcceptance.lifecycle_actions, ['read', 'resume', 'fork', 'archive', 'unarchive'], 'local thread lifecycle actions');
  if (
    dispatch.persisted_unloaded_thread !== 'thread/resume_then_turn/start' ||
    dispatch.loaded_idle_thread !== 'turn/start' ||
    dispatch.running_urgent_message !== 'turn/steer_with_explicit_realtime_label' ||
    dispatch.running_nonurgent_message !== 'host_queue_then_turn/start_when_idle' ||
    dispatch.unknown_or_stale_status !== 'refresh_then_fail_closed' ||
    dispatch.explicit_user_confirmation_when_scope_or_permission_changes !== true ||
    dispatch.archived_thread !== 'explicit_unarchive_or_typed_failure_no_silent_replacement' ||
    dispatch.queue_owner !== 'opl_app_typed_host_bridge' ||
    dispatch.queue_must_not_copy_or_own_thread_history !== true
  ) {
    throw new Error('local dispatch must route resume/start/steer through the host queue and fail closed on stale or archived targets');
  }
  assertStringArrayIncludes(localAcceptance.safety_gates, requiredCrossThreadSafetyGates, 'cross-thread safety gates');
  if (
    receipt.required !== true ||
    receipt.source_timeline_projection !== true ||
    receipt.target_timeline_projection !== true ||
    receipt.rail_or_thread_detail_readback !== true ||
    receipt.full_thread_history_copy_forbidden !== true
  ) {
    throw new Error('cross-thread dispatch must produce bilateral source and target receipt projections without copying thread history');
  }
  assertStringArrayIncludes(receipt.statuses, [
    'created', 'accepted', 'queued', 'delivered', 'running', 'completed', 'failed', 'cancelled', 'rejected',
  ], 'bilateral receipt statuses');
  assertStringArrayIncludes(receipt.required_fields, [
    'delivery_id', 'coordination_id', 'source_thread_id', 'target_thread_id', 'source_host_id', 'target_host_id',
    'project_key', 'sender', 'intent', 'reason', 'message_summary', 'protocol_method', 'queue_decision',
    'permission_decision', 'write_set_decision', 'status', 'result_summary_or_ref', 'created_at', 'completed_at',
  ], 'bilateral receipt fields');
  assertStringArrayIncludes(localAcceptance.required_typed_failure_states, [
    'offline', 'permission_denied', 'duplicate_rejected', 'loop_rejected', 'scope_mismatch',
    'write_set_conflict', 'stale_status', 'archived_target', 'protocol_incompatible', 'dispatch_failed', 'wait_timeout',
  ], 'cross-thread typed failure states');
  if (
    localAcceptance.user_visibility_policy !== 'sender_target_reason_message_result_and_safety_decisions_visible_and_auditable'
  ) {
    throw new Error('cross-thread receipt and safety decisions must remain user-visible and auditable');
  }
  assertStringArrayIncludes(localAcceptance.forbidden_implementations, [
    'send_input_as_cross_top_level_message_bus',
    'shell_owned_duplicate_thread_store',
    'model_generated_thread_id',
    'silent_cross_project_dispatch',
    'dispatch_without_write_set_check',
    'unbounded_delegation_loop',
  ], 'cross-thread forbidden implementations');

  const parity = authority.desktop_webui_parity;
  if (
    parity.required !== true ||
    parity.same_typed_host_bridge_contract !== true ||
    parity.same_thread_actions !== true ||
    parity.same_queue_and_safety_semantics !== true ||
    parity.same_bilateral_receipt_and_failure_visibility !== true ||
    parity.delivery_transport_may_differ !== true ||
    parity.desktop_only_coordination_capability_allowed !== false ||
    parity.webui_browser_renderer_direct_app_server_access_allowed !== false ||
    parity.webui_node_host_typed_app_server_adapter_allowed !== true
  ) {
    throw new Error('Desktop and WebUI must preserve equivalent coordination actions, gates, queue decisions, receipts, and failures');
  }
  const remoteP2 = authority.remote_p2;
  if (
    remoteP2.status !== 'deferred' ||
    remoteP2.local_p0_p1_must_not_depend_on_remote_host_aggregation !== true ||
    remoteP2.remote_ready_claim_allowed !== false ||
    remoteP2.local_focused_tests_prove_remote_ready !== false
  ) {
    throw new Error('remote host P2 must remain deferred and must not be inferred from local focused evidence');
  }
  assertStringArrayIncludes(remoteP2.future_scope, [
    'authenticated_saved_app_server_connections',
    'host_scoped_thread_directory_and_health',
    'cross_host_permission_and_route_policy',
    'disconnect_recovery_and_bilateral_receipt',
  ], 'remote P2 future scope');

  for (const field of requiredFalseReadyFields) {
    if (authority.false_ready_boundary[field] !== false) {
      throw new Error(`native candidate false-ready boundary ${field} must remain false`);
    }
  }
}

function validateCandidateAdapterContract(
  candidate: ShellCandidate,
  adapterContract: CandidateAdapterContract,
  policy: CandidateValidationPolicy,
): void {
  const isForegroundCandidate = candidate.id === policy.onlyForegroundAlternative;
  if (isForegroundCandidate) {
    if ('active_shell' in adapterContract) {
      throw new Error(`${candidate.id} foreground candidate adapter must use candidate_shell, not active_shell; active release shell remains contracts/app-shell-adapter.json`);
    }
    if (
      adapterContract.adapter_id !== candidate.id ||
      adapterContract.candidate_shell !== candidate.id ||
      adapterContract.adapter_role !== 'foreground_alternative_candidate_adapter'
    ) {
      throw new Error(`${candidate.id} foreground candidate adapter must declare candidate_shell adapter identity`);
    }
    if (
      adapterContract.purpose !== 'active_shell_adapter' ||
      adapterContract.state !== 'active' ||
      adapterContract.candidate_stage !== 'opl_native_workbench_local_p0_p1_implemented_verified_candidate_only' ||
      adapterContract.gui_authority?.implementation_role !== 'active_shell_implementation_carrier'
    ) {
      throw new Error(`${candidate.id} adapter must preserve the shared adapter schema while candidate_stage records verified local candidate-only implementation`);
    }
  } else if (adapterContract.active_shell !== candidate.id) {
    throw new Error(`${candidate.id} adapter contract must identify ${candidate.id}`);
  }
  if (adapterContract.shell_root !== candidate.candidate_root) {
    throw new Error(`${candidate.id} adapter contract must point at ${candidate.candidate_root}`);
  }
  if (adapterContract.shell_source.checkout_path !== candidate.candidate_root) {
    throw new Error(`${candidate.id} adapter checkout_path must match candidate_root`);
  }
  if (adapterContract.shell_source.history_policy !== 'external_checkout_not_merged_into_app_default_branch') {
    throw new Error(`${candidate.id} adapter must keep external checkout history policy`);
  }
  const expectedRole = policy.archivedTechnicalProofs.includes(candidate.id)
    ? 'archived_technical_verification_shell'
    : 'experimental_candidate_shell';
  if (adapterContract.release_role !== expectedRole) {
    throw new Error(`${candidate.id} adapter release_role must be ${expectedRole}`);
  }
  if (adapterContract.shell_contract.source_topology !== candidate.source_topology) {
    throw new Error(`${candidate.id} adapter source_topology must match candidate registry`);
  }
  if (!adapterContract.shell_contract.capabilities.includes('candidate_app_bundle_package')) {
    throw new Error(`${candidate.id} adapter must declare candidate_app_bundle_package capability`);
  }
  if (candidate.id === 'opl-native-workbench') {
    assertStringArrayIncludes(
      adapterContract.shell_contract.capabilities,
      requiredNativeCrossThreadCapabilities,
      `${candidate.id} adapter shell capabilities`,
    );
    validateNativeCrossTopLevelThreadAuthority(adapterContract.cross_top_level_thread_authority);
    if (
      JSON.stringify(candidate.local_p0_p1_implementation_evidence)
      !== JSON.stringify(adapterContract.cross_top_level_thread_authority?.local_p0_p1_implementation_evidence)
    ) {
      throw new Error(`${candidate.id} registry and adapter must bind the same local P0 plus P1 evidence cohort`);
    }
  }
  if (!adapterContract.validation_commands.some((entry) => entry.id === 'candidate_app_bundle_build')) {
    throw new Error(`${candidate.id} adapter validation_commands must include candidate_app_bundle_build`);
  }
  if (candidate.id === 'hermes-codex') {
    if (adapterContract.validation_commands.some((entry) => entry.id === 'candidate_packaged_settings_visual_smoke')) {
      throw new Error(`${candidate.id} adapter validation_commands must keep Settings visual smoke out of the default active-shell command chain`);
    }
    const adapterVisualCommand = adapterContract.manual_verification_commands?.find((entry) => entry.id === 'candidate_packaged_settings_visual_smoke');
    if (
      !adapterVisualCommand ||
      adapterVisualCommand.command !== 'npm --prefix shells/hermes run smoke:settings-visual -- --allow-foreground --out out/smoke-settings-visual'
    ) {
      throw new Error(`${candidate.id} adapter manual_verification_commands must include explicit Settings visual smoke with --allow-foreground`);
    }
    validateHermesTargetStateContracts(candidate, adapterContract);
  }
}

function validateCandidateImplementationBasis(candidate: ShellCandidate): void {
  if (candidate.id === 'opl-native-workbench') {
    assertStringArrayIncludes(candidate.implementation_basis, [
      'OPL-native React/Electron shared renderer',
      'OPL App state/action contract first',
      'K-Dense delivery workspace patterns adapted without runtime authority transfer',
      'Open Science artifact/provenance/review affordances adapted as secondary context without default split-screen workbench assumptions',
      'results and artifact delivery-first presentation',
      'independent shell repo mounted under shells/opl-native-workbench',
    ], `${candidate.id}.implementation_basis`);
    return;
  }
  if (candidate.id === 'hermes-codex') {
    assertStringArrayIncludes(candidate.implementation_basis, [
      'Codex-like chat-first desktop target',
      'NousResearch/hermes-agent apps/desktop',
      'MIT licensed implementation basis',
      'Upstream Hermes Desktop feature baseline',
      'minimal OPL branding and official Hermes backend defaults seed',
    ], `${candidate.id}.implementation_basis`);
    return;
  }
  assertStringArrayIncludes(candidate.implementation_basis, [
    'AG-UI event model',
    'shared React/CopilotKit renderer for Electron and WebUI',
    'OPL App-owned product profile',
    'OPL Framework app state/action CLI protocol',
  ], `${candidate.id}.implementation_basis`);
}

function validateCandidateTargetProductShape(candidate: ShellCandidate): void {
  const expectedWorkspaceRail = candidate.id === 'opl-native-workbench';
  if (
    candidate.target_product_shape.codex_cli_fixed_executor !== true ||
    candidate.target_product_shape.home_executor_selector_visible !== false ||
    candidate.target_product_shape.home_backend_selector_visible !== false ||
    candidate.target_product_shape.home_model_selector_visible !== true ||
    candidate.target_product_shape.permission_mode_selector_visible !== false ||
    candidate.target_product_shape.workspace_session_rail_default_visible !== expectedWorkspaceRail ||
    candidate.target_product_shape.inspector_default_visible !== false
  ) {
    throw new Error(`${candidate.id} must preserve Codex fixed-executor chat-first home with App-owned model selector, the candidate-specific project rail default, and no backend/permission/default inspector`);
  }
  assertStringArrayIncludes(candidate.target_product_shape.purpose_entries, requiredHomeEntries, `${candidate.id}.target_product_shape.purpose_entries`);
  if (candidate.target_product_shape.settings_policy !== 'app_state_refs_only') {
    throw new Error(`${candidate.id}.target_product_shape.settings_policy must keep Settings App-owned and refs-only`);
  }
  if (candidate.id === 'opl-native-workbench') {
    if (
      candidate.target_product_shape.default_visual_basis !== 'codex_app_composer_first' ||
      candidate.target_product_shape.right_context_user_request_only !== true ||
      candidate.target_product_shape.co_scientist_split_screen_default !== false ||
      candidate.target_product_shape.mas_autonomous_research_default !== true
    ) {
      throw new Error(`${candidate.id}.target_product_shape must encode AI-first Codex App defaults and MAS autonomous research interaction`);
    }
    validateCandidateAiFirstInteractionModel(candidate);
  }
}

function validateCandidateAiFirstInteractionModel(candidate: ShellCandidate): void {
  const model = candidate.ai_first_interaction_model;
  if (
    !model ||
    model.default_visual_basis !== 'codex_app_composer_first' ||
    model.primary_policy !== 'maximize_direct_ai_interaction_on_the_chat_canvas' ||
    model.right_context_policy !== 'collapsed_user_requested_secondary_layer' ||
    model.mas_autonomy_policy !== 'MAS_runs_as_autonomous_research_execution_not_co_scientist_pair_work'
  ) {
    throw new Error(`${candidate.id}.ai_first_interaction_model must preserve composer-first interaction and collapsed secondary context`);
  }
  assertStringArrayIncludes(model.open_science_adoption, [
    'artifact_provenance_review_refs_as_secondary_context',
    'plain_language_data_flow_and_safety_copy',
    'workflow_starters_as_purpose_entries_or_app_actions',
    'scientific_preview_affordances_on_demand',
  ], `${candidate.id}.ai_first_interaction_model.open_science_adoption`);
  assertStringArrayIncludes(model.must_not, [
    'default_three_column_scientific_workbench',
    'default_open_artifact_inspector',
    'co_scientist_side_by_side_monitoring_assumption',
    'foreign_runtime_or_domain_authority_transfer',
  ], `${candidate.id}.ai_first_interaction_model.must_not`);
}

function validateCandidateMinimumAcceptance(candidate: ShellCandidate): void {
  if (candidate.id === 'opl-native-workbench') {
    assertStringArrayIncludes(candidate.technical_verification?.minimum_acceptance ?? [], [
      'default App release adapter still validates as aionui',
      'candidate registry validates without changing release_shell_contract',
      'candidate adapter can be selected only through OPL_APP_SHELL_ADAPTER_CONTRACT',
      'candidate consumes OPL App state/action contracts without owning runtime or domain truth',
      'candidate state-model validation proves active project line projection consumption from opl app state without domain-ready, production-ready, clean-VM-ready, Full-release-ready, or active-shell-adopted claims',
      'Electron and WebUI use the same native React renderer and App-owned bridge shape',
      'ordinary UI stays chat-first while prioritizing results, files, receipts, and delivery refs',
      'WebUI parity evidence proves the same renderer and product semantics as Electron',
    ], `${candidate.id}.technical_verification.minimum_acceptance`);
    return;
  }
  assertStringArrayIncludes(candidate.technical_verification?.minimum_acceptance ?? [], [
    'candidate state-model validation proves active project line projection consumption from opl app state without domain-ready, production-ready, clean-VM-ready, Full-release-ready, or active-shell-adopted claims',
    'ordinary Settings uses Overview, Setup & Access, Capabilities, Maintenance & Updates, Data & Storage, Preferences, and Advanced, with About/Update/Theme secondary',
    'ordinary home does not expose runtime activity, continue-work, per-agent running badges, or footer quick icons; Runtime and secondary context surfaces carry refs-only activity details',
    'tool/process/diff/file/receipt/user-input/permission events render as compact conversation events or expandable refs',
    'WebUI parity evidence proves the same React/CopilotKit renderer and product semantics as Electron',
  ], `${candidate.id}.technical_verification.minimum_acceptance`);
}

function validateCandidateFrameworkSurfaces(candidate: ShellCandidate): void {
  for (const [surface, expected] of Object.entries(expectedFrameworkSurfaces)) {
    if (candidate.framework_surfaces[surface] !== expected) {
      throw new Error(`${candidate.id}.framework_surfaces.${surface} must be ${expected}`);
    }
  }
}

function validateCandidateStateModelCommand(candidate: ShellCandidate): void {
  validateActiveProjectLineStateModel(candidate.active_project_line_state_model, `${candidate.id}.active_project_line_state_model`);
  const stateModelTechnicalCommand = candidate.technical_verification?.candidate_shell_commands?.find((entry) => entry.id === 'state_model');
  if (
    !stateModelTechnicalCommand ||
    stateModelTechnicalCommand.cwd !== candidate.candidate_root ||
    stateModelTechnicalCommand.command !== 'npm run validate:state-model'
  ) {
    throw new Error(`${candidate.id}.technical_verification.candidate_shell_commands must include state_model running npm run validate:state-model from ${candidate.candidate_root}`);
  }
}

function validateCandidateSeriesDisplayContract(candidate: ShellCandidate): void {
  const seriesDisplay = candidate.foundry_agent_series_display_contract;
  if (!seriesDisplay) {
    throw new Error(`${candidate.id} must declare foundry_agent_series_display_contract`);
  }
  if (seriesDisplay.authority !== 'opl_framework_shared_progress_projection') {
    throw new Error(`${candidate.id}.foundry_agent_series_display_contract.authority must be opl_framework_shared_progress_projection`);
  }
  if (seriesDisplay.display_policy !== 'classification_only_no_domain_artifact_body') {
    throw new Error(`${candidate.id}.foundry_agent_series_display_contract.display_policy must forbid domain artifact body display`);
  }
  assertStringArrayIncludes(
    seriesDisplay.required_shared_progress_fields,
    requiredSeriesProgressFields,
    `${candidate.id}.foundry_agent_series_display_contract.required_shared_progress_fields`,
  );
  assertStringArrayIncludes(
    seriesDisplay.forbidden_domain_fields,
    forbiddenSeriesDomainFields,
    `${candidate.id}.foundry_agent_series_display_contract.forbidden_domain_fields`,
  );
}

function validateCandidateAuthorityBoundaries(candidate: ShellCandidate): void {
  if (candidate.id === 'opl-native-workbench') {
    assertStringArrayIncludes(candidate.required_capabilities, requiredNativeCapabilities, `${candidate.id}.required_capabilities`);
    assertStringArrayIncludes(candidate.must_not_own, forbiddenAuthority, `${candidate.id}.must_not_own`);
    assertStringArrayIncludes(candidate.forbidden_home_controls, [
      'Aion CLI backend choice',
      'Claude Code backend choice',
      'generic backend selector',
      'non-App-owned model override selector',
      'permission mode selector',
      'provider marketplace',
    ], `${candidate.id}.forbidden_home_controls`);
    assertStringArrayIncludes(candidate.non_goals, [
      'do not switch active_shell away from aionui',
      'do not enter default stable or nightly release packaging',
      'do not introduce runtime or domain truth into the App repo',
      'do not continue AGUI/CopilotKit implementation as the native workbench route',
      'do not claim release-ready from contract-only evidence',
    ], `${candidate.id}.non_goals`);
    return;
  }
  if (candidate.id === 'hermes-codex') {
    assertStringArrayIncludes(candidate.required_capabilities, [
      'upstream_hermes_desktop_feature_baseline_preserved',
      'opl_branding_and_icon_replaced',
      'official_hermes_backend_preserved',
      'opl_defaults_seed_for_codex_runtime_and_domain_skills',
      'codex_app_server_backed_hermes_gateway_adapter',
      'chat_first_codex_app_surface',
      'release_isolation',
      'candidate_app_bundle_package',
      'renderer_safe_profile_config_bootstrap_routes',
    ], `${candidate.id}.required_capabilities`);
    assertStringArrayIncludes(candidate.deferred_until_feature_comparison ?? [], [
      'app_product_profile_mapping',
      'opl_app_state_bridge',
      'opl_app_action_bridge',
      'page_state_matrix_mapping',
      'first_run_matrix_mapping',
      'packaged_full_runtime',
      'standard_release_asset_normalization',
      'webui_parity',
    ], `${candidate.id}.deferred_until_feature_comparison`);
    assertStringArrayIncludes(candidate.must_not_own, forbiddenAuthority, `${candidate.id}.must_not_own`);
    assertStringArrayIncludes(candidate.forbidden_home_controls, [
      'generic backend selector',
      'non-App-owned model override selector',
      'permission mode selector',
    ], `${candidate.id}.forbidden_home_controls`);
    assertStringArrayIncludes(candidate.non_goals, [
      'do not switch active_shell away from aionui',
      'do not enter default stable or nightly release packaging',
      'do not introduce runtime or domain truth into the App repo',
      'do not claim release-ready from contract-only evidence',
    ], `${candidate.id}.non_goals`);
    return;
  }
  assertStringArrayIncludes(candidate.required_capabilities, requiredCapabilities, `${candidate.id}.required_capabilities`);
  assertStringArrayIncludes(candidate.must_not_own, forbiddenAuthority, `${candidate.id}.must_not_own`);
  assertStringArrayIncludes(candidate.forbidden_home_controls, [
    'Aion CLI backend choice',
    'Claude Code backend choice',
    'generic backend selector',
    'non-App-owned model override selector',
    'permission mode selector',
  ], `${candidate.id}.forbidden_home_controls`);
  assertStringArrayIncludes(candidate.non_goals, [
    'do not switch active_shell away from aionui',
    'do not enter default stable or nightly release packaging',
    'do not introduce runtime or domain truth into the App repo',
  ], `${candidate.id}.non_goals`);
}

function validateCandidateValidationCommands(candidate: ShellCandidate): void {
  for (const entry of [
    ...candidate.validation_commands,
    ...(candidate.technical_verification?.manual_verification_commands ?? []),
  ]) {
    if (!entry.id || !entry.cwd || !entry.command) {
      throw new Error(`${candidate.id} has invalid validation command ${JSON.stringify(entry)}`);
    }
    const cwdPath = path.join(root, entry.cwd);
    if (!fs.existsSync(cwdPath)) {
      if (missingCandidateCheckoutCanBeBlocked(candidate) && entry.cwd === candidate.candidate_root) {
        continue;
      }
      assertFile(cwdPath, `${candidate.id} validation cwd ${entry.id}`);
    }
  }
  const bundleCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_app_bundle_build');
  if (!bundleCommand) {
    throw new Error(`${candidate.id} validation_commands must include candidate_app_bundle_build`);
  }
  if (candidate.id === 'hermes-codex') {
    if (
      bundleCommand.cwd !== '.'
      || !bundleCommand.command.includes(`OPL_APP_SHELL_ADAPTER_CONTRACT=${candidate.adapter_contract} npm run package`)
    ) {
      throw new Error(`${candidate.id} candidate_app_bundle_build must run App-root npm package with the Hermes adapter contract`);
    }
    const contractCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_contract');
    if (
      !contractCommand
      || contractCommand.cwd !== '.'
      || contractCommand.command !== 'node --experimental-strip-types scripts/validate-hermes-candidate.ts'
    ) {
      throw new Error(`${candidate.id} validation_commands must include candidate_contract running scripts/validate-hermes-candidate.ts`);
    }
    const packagedSmokeCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_packaged_first_run_smoke');
    if (
      !packagedSmokeCommand
      || packagedSmokeCommand.cwd !== '.'
      || packagedSmokeCommand.command !== 'npm --prefix shells/hermes run smoke:opl-first-run'
    ) {
      throw new Error(`${candidate.id} validation_commands must include packaged first-run smoke for the primary Hermes checkout`);
    }
    if (candidate.validation_commands.some((entry) => entry.id === 'candidate_packaged_settings_visual_smoke')) {
      throw new Error(`${candidate.id} validation_commands must keep Settings visual smoke out of the default local command chain`);
    }
    if (candidate.technical_verification?.app_root_commands?.some((entry) => entry.id === 'candidate_packaged_settings_visual_smoke')) {
      throw new Error(`${candidate.id}.technical_verification.app_root_commands must keep Settings visual smoke out of the default local command list`);
    }
    const settingsVisualCommand = candidate.technical_verification?.manual_verification_commands?.find((entry) => entry.id === 'candidate_packaged_settings_visual_smoke');
    if (
      !settingsVisualCommand ||
      settingsVisualCommand.cwd !== '.' ||
      settingsVisualCommand.command !== 'npm --prefix shells/hermes run smoke:settings-visual -- --allow-foreground --out out/smoke-settings-visual'
    ) {
      throw new Error(`${candidate.id}.technical_verification.manual_verification_commands must include the explicit packaged Settings visual smoke with --allow-foreground`);
    }
    const tartSmokeCommand = candidate.technical_verification?.manual_verification_commands?.find((entry) => entry.id === 'candidate_tart_clean_vm_smoke');
    if (
      !tartSmokeCommand ||
      tartSmokeCommand.cwd !== '.' ||
      tartSmokeCommand.command !== 'npm run smoke:hermes-candidate:tart -- --no-graphics'
    ) {
      throw new Error(`${candidate.id}.technical_verification.manual_verification_commands must include the explicit Tart clean-VM smoke`);
    }
    return;
  }
  const webUiSmokeCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_webui_smoke');
  if (!webUiSmokeCommand) {
    throw new Error(`${candidate.id} validation_commands must include candidate_webui_smoke`);
  }
  const stateModelCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_state_model');
  if (!stateModelCommand) {
    throw new Error(`${candidate.id} validation_commands must include candidate_state_model`);
  }
  if (stateModelCommand.cwd !== candidate.candidate_root || stateModelCommand.command !== 'npm run validate:state-model') {
    throw new Error(`${candidate.id} candidate_state_model must run npm run validate:state-model from ${candidate.candidate_root}`);
  }
  if (webUiSmokeCommand.cwd !== candidate.candidate_root || !webUiSmokeCommand.command.includes('npm run smoke:webui')) {
    throw new Error(`${candidate.id} candidate_webui_smoke must run npm run smoke:webui from ${candidate.candidate_root}`);
  }
  if (
    bundleCommand.cwd !== '.'
    || !bundleCommand.command.includes(`OPL_APP_SHELL_ADAPTER_CONTRACT=${candidate.adapter_contract} npm run package`)
  ) {
    throw new Error(`${candidate.id} candidate_app_bundle_build must run App-root npm package with the candidate adapter contract`);
  }
}

function validateCandidatePackageScriptSurfaces(candidate: ShellCandidate): void {
  if (candidate.id === 'hermes-codex') {
    return;
  }
  if (candidate.id === 'opl-native-workbench') {
    if (missingCandidateCheckoutCanBeBlocked(candidate)) {
      return;
    }
    assertFile(path.join(root, candidate.candidate_root, 'scripts', 'validate-native-workbench-candidate.mjs'), `${candidate.id} self-check`);
    assertCandidateFileContains(candidate, 'package.json', [
      '"build:webui"',
      '"webui"',
      '"smoke:webui"',
      '"validate:state-model"',
    ], 'package scripts for shared Electron/WebUI renderer');
    return;
  }
  assertFile(path.join(root, candidate.candidate_root, 'scripts', 'validate-agui-codex-candidate.ts'), `${candidate.id} self-check`);
  assertCandidateFileContains(candidate, 'package.json', [
    '"build:webui"',
    '"webui"',
    '"smoke:webui"',
    '"validate:state-model"',
  ], 'package scripts for WebUI');
}

export function validateCandidate(candidate: ShellCandidate, policy: CandidateValidationPolicy): void {
  validateCandidateRegistryEntry(candidate, policy);
  const adapterContract = readCandidateAdapterContract(candidate);
  validateCandidateAdapterContract(candidate, adapterContract, policy);
  validateCandidateImplementationBasis(candidate);
  if (candidate.id === 'hermes-codex') {
    validateHermesCandidateContract(candidate);
    validateCandidateFrameworkSurfaces(candidate);
    validateCandidateAuthorityBoundaries(candidate);
    validateCandidateValidationCommands(candidate);
    return;
  }
  if (candidate.id === 'opl-native-workbench') {
    validateNativeWorkbenchCandidateContract(candidate);
    validateCandidateChatTarget(candidate);
    validateCandidateWebUiTransport(candidate);
    validateCandidateTargetProductShape(candidate);
    validateCandidateMinimumAcceptance(candidate);
    validateCandidateFrameworkSurfaces(candidate);
    validateCandidateStateModelCommand(candidate);
    validateCandidateSeriesDisplayContract(candidate);
    validateCandidateAuthorityBoundaries(candidate);
    validateCandidateValidationCommands(candidate);
    validateCandidatePackageScriptSurfaces(candidate);
    return;
  }
  validateCandidateChatTarget(candidate);
  validateCandidateWebUiTransport(candidate);
  validateCandidateTargetProductShape(candidate);
  validateCandidateMinimumAcceptance(candidate);
  validateCandidateFrameworkSurfaces(candidate);
  validateCandidateStateModelCommand(candidate);
  validateCandidateSeriesDisplayContract(candidate);
  validateCandidateAuthorityBoundaries(candidate);
  validateCandidateValidationCommands(candidate);
  validateCandidatePackageScriptSurfaces(candidate);
}

function validateNativeWorkbenchCandidateContract(candidate: ShellCandidate): void {
  if (candidate.foreground_alternative_role !== 'only_foreground_alternative') {
    throw new Error(`${candidate.id}.foreground_alternative_role must be only_foreground_alternative`);
  }
  if (
    candidate.source_upstream?.repo !== 'gaofeng21cn/opl-native-workbench' ||
    candidate.source_upstream.app_path !== '.' ||
    candidate.source_upstream.license !== 'Apache-2.0'
  ) {
    throw new Error(`${candidate.id}.source_upstream must point to gaofeng21cn/opl-native-workbench under Apache-2.0`);
  }
  if (candidate.candidate_stage !== 'opl_native_workbench_local_p0_p1_implemented_verified_candidate_only') {
    throw new Error(`${candidate.id}.candidate_stage must record verified local P0 plus P1 candidate-only implementation`);
  }
  validateNativeLocalP0P1ImplementationEvidence(candidate.local_p0_p1_implementation_evidence);
  if (
    candidate.checkout_policy?.primary_path !== 'shells/opl-native-workbench' ||
    candidate.checkout_policy.accepted_alternate_path !== '../opl-native-workbench' ||
    candidate.checkout_policy.missing_checkout_status !== 'blocked_missing_checkout'
  ) {
    throw new Error(`${candidate.id}.checkout_policy must accept shells/opl-native-workbench or ../opl-native-workbench and report blocked_missing_checkout`);
  }
  if (
    candidate.build_wrapper?.adapter_contract !== candidate.adapter_contract ||
    candidate.build_wrapper.app_root_command !== `OPL_APP_SHELL_ADAPTER_CONTRACT=${candidate.adapter_contract} npm run package` ||
    candidate.build_wrapper.missing_checkout_blocker_allowed !== true
  ) {
    throw new Error(`${candidate.id}.build_wrapper must route through the App-root explicit adapter and allow missing-checkout blocker reporting`);
  }
  const visual = candidate.visual_parity_contract as NativeVisualParityContract | undefined;
  if (
    visual?.comparison_baseline !== 'ChatGPT Codex macOS 26.707.41301 (2026-07-11)' ||
    visual.current_reference_status !== 'current_app_reference_candidate_conformance_pending' ||
    visual.regression_floor !== 'AionUI active release shell' ||
    visual.source_usage !== 'visual_and_interaction_reference_only_no_code_or_brand_copy' ||
    visual.minimum_bar !== 'one_to_one_codex_layout_density_typography_composer_timeline_project_rail_settings_and_floating_environment_details' ||
    visual.model_policy_source !== 'contracts/app-product-profile.json#gui.home.codex_model_display_options' ||
    visual.default_model !== configuredDefaultModel ||
    visual.default_reasoning_effort !== configuredDefaultReasoningEffort ||
    visual.docs_or_contract_only_completion_allowed !== false
  ) {
    throw new Error(`${candidate.id}.visual_parity_contract must consume the App-owned configured model policy, preserve the AionUI regression floor, and forbid docs-only completion`);
  }
  assertStringArrayIncludes(
    visual.superseded_observations ?? [],
    [
      'ChatGPT Codex macOS 26.707.31428 (2026-07-10)',
      'ChatGPT Codex macOS 26.707.31123 (2026-07-10)',
    ],
    `${candidate.id}.visual_parity_contract.superseded_observations`,
  );
  assertStringArrayIncludes(
    visual.required_surfaces ?? [],
    requiredNativeVisualParitySurfaces,
    `${candidate.id}.visual_parity_contract.required_surfaces`,
  );
  assertStringArrayIncludes(visual.required_evidence, [
    'desktop screenshot comparison against ChatGPT Codex macOS 26.707.41301',
    'persistent project rail and single conversation timeline screenshot comparison',
    'composer model and reasoning controls screenshot comparison',
    'floating on-demand environment screenshot comparison',
    'Settings locale surface screenshot comparison',
    'webui screenshot comparison against desktop renderer',
    'packaged app screenshot or VM smoke artifact',
  ], `${candidate.id}.visual_parity_contract.required_evidence`);
}

function validateHermesCandidateContract(candidate: ShellCandidate): void {
  if (!['only_foreground_alternative', 'superseded_foreground_alternative_reference'].includes(candidate.foreground_alternative_role ?? '')) {
    throw new Error(`${candidate.id}.foreground_alternative_role must be only_foreground_alternative or superseded_foreground_alternative_reference`);
  }
  if (
    candidate.source_upstream?.repo !== 'NousResearch/hermes-agent'
    || candidate.source_upstream.app_path !== 'apps/desktop'
    || candidate.source_upstream.license !== 'MIT'
  ) {
    throw new Error(`${candidate.id}.source_upstream must point to NousResearch/hermes-agent apps/desktop under MIT`);
  }
  assertStringArrayIncludes(candidate.required_replacements ?? [], [
    'replace upstream Hermes branding with One Person Lab App candidate branding',
    'seed Codex app-server and OPL domain skill defaults without taking Hermes or OPL runtime authority',
    'use explicit candidate packaging without entering stable release packaging',
    'keep Simplified Chinese and English copy in the Hermes i18n catalog instead of shell-local mixed-language labels',
  ], `${candidate.id}.required_replacements`);
  assertStringArrayIncludes(candidate.architecture_policy?.minimal_delta ?? [], [
    'macOS Dock-safe icon margin',
    'OPL App-managed first-run initialization',
    'model access API key configuration',
  ], `${candidate.id}.architecture_policy.minimal_delta`);
  if (candidate.candidate_stage !== 'upstream_feature_comparison_minimal_opl_adapter') {
    throw new Error(`${candidate.id}.candidate_stage must stay upstream_feature_comparison_minimal_opl_adapter`);
  }
  if (
    candidate.checkout_policy?.primary_path !== 'shells/hermes'
    || candidate.checkout_policy.accepted_alternate_path !== '../opl-hermes-shell'
    || candidate.checkout_policy.missing_checkout_status !== 'blocked_missing_checkout'
  ) {
    throw new Error(`${candidate.id}.checkout_policy must accept shells/hermes or ../opl-hermes-shell and report blocked_missing_checkout`);
  }
  if (
    candidate.build_wrapper?.adapter_contract !== candidate.adapter_contract
    || candidate.build_wrapper.app_root_command !== `OPL_APP_SHELL_ADAPTER_CONTRACT=${candidate.adapter_contract} npm run package`
    || candidate.build_wrapper.missing_checkout_blocker_allowed !== true
  ) {
    throw new Error(`${candidate.id}.build_wrapper must route through the App-root explicit adapter and allow missing-checkout blocker reporting`);
  }
  validateHermesFirstRunContract(candidate);
  validateHermesTargetStateContracts(candidate, candidate);
  validateHermesIconContract(candidate);
}

function validateHermesTargetStateContracts(
  candidate: ShellCandidate,
  target: Pick<ShellCandidate, 'app_server_adapter_contract' | 'model_access_policy' | 'agent_route_contract' | 'settings_information_architecture' | 'visual_parity_contract'>,
): void {
  const appServer = target.app_server_adapter_contract;
  if (!appServer) {
    throw new Error(`${candidate.id}.app_server_adapter_contract must be declared`);
  }
  if (
    appServer.owner !== 'one-person-lab-app'
    || appServer.gateway_route !== 'codex app-server --listen stdio://'
    || appServer.ordinary_chat_route !== 'Hermes chat turn -> OPL Codex gateway -> Codex app-server thread/start turn/start event stream'
  ) {
    throw new Error(`${candidate.id}.app_server_adapter_contract must route ordinary chat through the Codex app-server gateway`);
  }
  assertStringArrayIncludes(appServer.required_events, [
    'thread/start',
    'turn/start',
    'item/agentMessage/delta',
    'turn/completed',
  ], `${candidate.id}.app_server_adapter_contract.required_events`);
  assertStringArrayIncludes(appServer.forbidden_backends, [
    'Hermes Agent installer as ordinary executor',
    'provider-selected backend',
    'AionUI release shell backend',
  ], `${candidate.id}.app_server_adapter_contract.forbidden_backends`);

  const modelAccess = target.model_access_policy;
  if (!modelAccess) {
    throw new Error(`${candidate.id}.model_access_policy must be declared`);
  }
  if (
    modelAccess.ordinary_provider !== 'gflabtoken'
    || modelAccess.api_key_env !== 'OPENAI_API_KEY'
    || modelAccess.provider_base_url !== 'https://gflabtoken.cn/v1'
    || modelAccess.default_model !== configuredDefaultModel
    || modelAccess.reasoning_effort !== configuredDefaultReasoningEffort
  ) {
    throw new Error(`${candidate.id}.model_access_policy must define gflabtoken-only App-configured model access`);
  }
  assertStringArrayIncludes(modelAccess.ordinary_ui_surfaces, [
    'model access wizard',
    'Settings Access tab',
  ], `${candidate.id}.model_access_policy.ordinary_ui_surfaces`);
  assertStringArrayIncludes(modelAccess.forbidden_ordinary_controls, [
    'OPENAI_BASE_URL',
    'provider marketplace',
    'OAuth provider accounts',
    'custom provider key',
    'second Auto model id',
  ], `${candidate.id}.model_access_policy.forbidden_ordinary_controls`);

  const routes = target.agent_route_contract;
  if (!routes) {
    throw new Error(`${candidate.id}.agent_route_contract must be declared`);
  }
  if (
    routes.owner !== 'one-person-lab-app'
    || routes.route_authority !== 'App-owned Codex Skill declaration only; Codex remains the invocation authority and runtime/domain truth remain in OPL Framework and domain repos'
    || routes.required_surface !== 'composer Codex Skill entries plus structured Codex skill input plus Settings Agents & Capabilities summaries'
  ) {
    throw new Error(`${candidate.id}.agent_route_contract must keep Codex Skill declaration App-owned without taking invocation, runtime, or domain authority`);
  }
  for (const [id, route, codexVisibleEntry, domainAuthorityRepo] of [
    ['mas', 'codex-skill:med-autoscience', 'med-autoscience', 'med-autoscience'],
    ['mag', 'codex-skill:med-autogrant', 'med-autogrant', 'med-autogrant'],
    ['rca', 'codex-skill:redcube-ai', 'redcube-ai', 'redcube-ai'],
  ] as const) {
    const entry = routes.ordinary_entries.find((candidateRoute) => candidateRoute.id === id);
    if (!entry || entry.package_id !== id || entry.agent_id !== id || entry.codex_visible_entry !== codexVisibleEntry || entry.route !== route || entry.domain_authority_repo !== domainAuthorityRepo) {
      throw new Error(`${candidate.id}.agent_route_contract.ordinary_entries must declare ${id} -> ${route}`);
    }
  }
  assertStringArrayIncludes(routes.forbidden_claims, [
    'domain_ready',
    'agent_runtime_authority',
    'artifact_authority',
    'quality_verdict',
  ], `${candidate.id}.agent_route_contract.forbidden_claims`);

  const settings = target.settings_information_architecture;
  if (!settings) {
    throw new Error(`${candidate.id}.settings_information_architecture must be declared`);
  }
  assertStringArrayIncludes(settings.ordinary_tabs, [
    'General',
    'Access',
    'Agents & Capabilities',
    'Local Environment',
    'Storage',
    'Appearance',
    'Advanced',
    'About & Updates',
  ], `${candidate.id}.settings_information_architecture.ordinary_tabs`);
  assertStringArrayIncludes(settings.opl_semantics, [
    '模型策略',
    '模型访问',
    '智能体与能力',
    '本机环境',
    '存储',
    '外观与语言',
    '高级与诊断',
    '关于与更新',
  ], `${candidate.id}.settings_information_architecture.opl_semantics`);
  assertStringArrayIncludes(settings.hidden_or_advanced, [
    'Hermes backend selection',
    'provider marketplace',
    'OAuth provider accounts',
    'custom Base URL',
    'remote terminal backend',
    'Hermes memory provider',
    'raw JSON-RPC gateway state',
  ], `${candidate.id}.settings_information_architecture.hidden_or_advanced`);
  if (settings.ordinary_access_policy !== 'show_only_gflabtoken_api_key_and_current_codex_model_access_status') {
    throw new Error(`${candidate.id}.settings_information_architecture.ordinary_access_policy must be gflabtoken-only`);
  }

  const visual = target.visual_parity_contract;
  if (!visual) {
    throw new Error(`${candidate.id}.visual_parity_contract must be declared`);
  }
  if (
    visual.comparison_baseline !== 'AionUI active release shell'
    || visual.minimum_bar !== 'not_lower_than_aionui_for_chat_first_reading_composer_settings_and_packaged_smoke_visual_quality'
    || visual.docs_or_contract_only_completion_allowed !== false
  ) {
    throw new Error(`${candidate.id}.visual_parity_contract must require AionUI-or-better visual evidence and forbid docs-only completion`);
  }
  assertStringArrayIncludes(visual.required_evidence, [
    'desktop screenshot comparison against AionUI baseline',
    'settings screenshot comparison against AionUI baseline',
    'packaged app screenshot or VM smoke artifact',
  ], `${candidate.id}.visual_parity_contract.required_evidence`);
}

function validateHermesFirstRunContract(candidate: ShellCandidate): void {
  const contract = candidate.first_run_contract;
  if (!contract) {
    throw new Error(`${candidate.id}.first_run_contract must be declared`);
  }
  if (contract.owner !== 'opl_app_cli') {
    throw new Error(`${candidate.id}.first_run_contract.owner must be opl_app_cli`);
  }
  if (contract.ui_reuse_policy !== 'reuse_hermes_onboarding_module_and_progress_ui_only') {
    throw new Error(`${candidate.id}.first_run_contract.ui_reuse_policy must reuse only the Hermes onboarding UI`);
  }
  if (contract.forbidden_default_action !== 'download_or_execute_hermes_agent_installer') {
    throw new Error(`${candidate.id}.first_run_contract.forbidden_default_action must forbid Hermes Agent installer execution`);
  }
  if (contract.startup_model !== 'lightweight_startup_check_then_chat_first') {
    throw new Error(`${candidate.id}.first_run_contract.startup_model must be lightweight_startup_check_then_chat_first`);
  }
  assertStringArrayIncludes(contract.startup_check_sequence, [
    'check-opl-app-initialization-marker',
    'check-one-person-lab-cli',
    'check-codex-cli',
    'check-opl-app-state-fast-readiness',
    'check-gflabtoken-model-access',
    'check-codex-adapter-startup',
  ], `${candidate.id}.first_run_contract.startup_check_sequence`);
  assertStringArrayIncludes(contract.one_time_initialization_trigger, [
    'failed-lightweight-readiness-probe-after-missing-or-stale-marker',
    'missing-one-person-lab-core-components',
  ], `${candidate.id}.first_run_contract.one_time_initialization_trigger`);
  assertStringArrayIncludes(contract.one_time_initialization_sequence, [
    'opl-cli-check',
    'codex-cli-check',
    'prepare-local-directories-and-config',
    'opl-core-readiness-check',
    'opl-core-install-or-repair-when-needed',
    'write-opl-app-initialization-marker',
  ], `${candidate.id}.first_run_contract.one_time_initialization_sequence`);
  assertStringArrayIncludes(contract.background_refresh_sequence, [
    'opl system initialize --json',
    'opl system startup-maintenance --json',
    'opl packages update --json',
    'mas_mag_rca_status_refresh',
    'contracts_diagnostics_refresh',
  ], `${candidate.id}.first_run_contract.background_refresh_sequence`);
  if (
    contract.model_access_wizard?.trigger !== 'missing_or_invalid_gflabtoken_api_key_or_model_access_unavailable'
    || contract.model_access_wizard.api_key_provider !== 'gflabtoken'
    || contract.model_access_wizard.api_key_command !== 'opl system configure-codex --api-key-stdin --json'
    || contract.model_access_wizard.provider_base_url !== 'https://gflabtoken.cn/v1'
    || contract.model_access_wizard.default_model !== configuredDefaultModel
    || contract.model_access_wizard.api_key_env !== 'OPENAI_API_KEY'
    || contract.model_access_wizard.ordinary_ui_policy !== 'show_only_model_access_api_key_no_base_url_provider_marketplace_or_oauth_accounts'
  ) {
    throw new Error(`${candidate.id}.first_run_contract.model_access_wizard must define gflabtoken-only Codex model access`);
  }
  if (contract.blocking_policy !== 'full_opl_initialize_and_module_refresh_must_not_block_hot_launch_or_chat_after_light_check_passes') {
    throw new Error(`${candidate.id}.first_run_contract.blocking_policy must keep full initialize and module refresh out of hot-launch blocking path`);
  }
  if (
    contract.skip_to_chat_policy?.trigger !== 'user_may_skip_non_core_or_slow_first_run_preparation_when_codex_adapter_can_start'
    || contract.skip_to_chat_policy.marker_state !== 'user_deferred'
  ) {
    throw new Error(`${candidate.id}.first_run_contract.skip_to_chat_policy must define the user_deferred skip-to-chat route`);
  }
  assertStringArrayIncludes(contract.skip_to_chat_policy.must_not_claim, [
    'gflabtoken_api_key_configured',
    'module_reconcile_complete',
    'mas_mag_rca_domain_ready',
    'full_opl_readiness',
  ], `${candidate.id}.first_run_contract.skip_to_chat_policy.must_not_claim`);
  if (contract.api_key_present_behavior !== 'auto_continue_to_opl_codex_adapter_without_waiting_for_setup_runtime_check_or_api_key_form') {
    throw new Error(`${candidate.id}.first_run_contract.api_key_present_behavior must auto-skip onboarding when Codex model access already exists`);
  }
  if (contract.ready_check !== 'lightweight startup check: CLI available, fast app state proves Codex installed and model access status, core components discoverable when required, Codex adapter startable; missing or stale marker alone refreshes marker after successful fast probe and does not trigger full initialize') {
    throw new Error(`${candidate.id}.first_run_contract.ready_check must describe the lightweight startup check`);
  }
  assertStringArrayIncludes(contract.packaged_smoke_must_prove, [
    'no install.sh or install.ps1 fetch or execution',
    'hot launch with fresh marker and model access does not run blocking full opl system initialize',
    'first launch with missing marker and usable fast app state does not run blocking full opl system initialize or show installation checklist',
    'missing or stale marker routes to the OPL one-time initialization checklist only when lightweight fast state probe cannot prove readiness',
    'one-time initialization writes or refreshes the OPL App initialization marker',
    'missing API key routes to model access wizard without showing the installation checklist',
    'user skip on first-run checklist closes the overlay and starts the Codex adapter',
    'user-deferred setup.status reports onboarding_deferred without marking gflabtoken API key configured',
    'background OPL status refresh starts only after the main chat surface is visible',
    'OPL Codex adapter starts',
    'existing Codex model access configuration auto-skips onboarding',
    'official Hermes OAuth provider route returns an empty renderer-safe provider list',
  ], `${candidate.id}.first_run_contract.packaged_smoke_must_prove`);
}

function validateHermesIconContract(candidate: ShellCandidate): void {
  const contract = candidate.icon_contract;
  if (!contract) {
    throw new Error(`${candidate.id}.icon_contract must be declared`);
  }
  if (contract.source !== 'OPL/AionUI official icon asset family') {
    throw new Error(`${candidate.id}.icon_contract.source must use the OPL/AionUI official icon asset family`);
  }
  if (contract.macos_safe_margin_required !== true) {
    throw new Error(`${candidate.id}.icon_contract.macos_safe_margin_required must be true`);
  }
  if (contract.max_alpha_bounds_px !== 900 || contract.current_expected_alpha_bounds_px !== '840x840+92+92') {
    throw new Error(`${candidate.id}.icon_contract must require 840x840+92+92 current alpha bounds and max 900px`);
  }
  assertStringArrayIncludes(contract.applies_to, [
    'assets/icon.png',
    'assets/icon.icns',
    'public/apple-touch-icon.png',
    'packaged .app Contents/Resources icon',
  ], `${candidate.id}.icon_contract.applies_to`);
}

export function validateCandidateImplementationFiles(candidate: ShellCandidate): void {
  if (candidate.id === 'hermes-codex') {
    assertCandidateFileContains(candidate, 'src/app/desktop-controller.tsx', [
      'DesktopOnboardingOverlay',
      'useMessageStream',
      "navigate(`${SETTINGS_ROUTE}?tab=providers`)",
    ], 'official Hermes desktop controller reuse with OPL model access entry');
    assertCandidateFileContains(candidate, 'src/app/settings/index.tsx', [
      'AgentsCapabilitiesSettings',
      "'providers'",
      "'agents'",
      "'mcp'",
    ], 'OPL ordinary Settings navigation');
    assertCandidateFileContains(candidate, 'src/app/settings/agents-capabilities-settings.tsx', [
      'getOplCodexSkills',
      'chatInvocation',
      'executionDesc',
      'slashAvailable',
      'noDomainTruth',
      'available',
    ], 'OPL agents and capabilities Settings page');
    assertCandidateFileContains(candidate, 'src/lib/desktop-slash-commands.ts', [
      "'/mas'",
      "'/mag'",
      "'/rca'",
      "action('opl-skill')",
    ], 'OPL Skill slash shortcuts');
    assertCandidateFileContains(candidate, 'src/app/session/hooks/use-prompt-actions.ts', [
      "'opl-skill': async",
      'const prompt = `$${skill}',
      'submitPromptText(prompt)',
    ], 'OPL Skill slash action handler');
    assertCandidateFileContains(candidate, 'src/components/desktop-onboarding-overlay.tsx', [
      'One Person Lab 模型访问',
      'OPENAI_API_KEY',
      'return API_KEY_OPTIONS',
    ], 'gflabtoken-only onboarding model access');
    assertCandidateFileContains(candidate, 'electron/opl-codex-gateway.cjs', [
      "'app-server', '--listen', 'stdio://'",
      "'/api/opl/codex-skills'",
      'codex.skills',
      'requestedCodexSkillIds',
      "type: 'skill'",
      'tool.event',
      'approval.event',
    ], 'Codex app-server backed Hermes gateway');
    assertCandidateFileContains(candidate, 'scripts/validate-hermes-codex-candidate.cjs', [
      'codex.skills',
      "'/api/opl/codex-skills'",
      '!oplCodexGateway.includes("purpose.route.resolve")',
      "tab: 'agents'",
      'src/app/settings/agents-capabilities-settings.tsx',
    ], 'Hermes candidate self-validator');
    return;
  }
  if (candidate.id === 'opl-native-workbench') {
    assertCandidateFileContains(candidate, 'src/workbench/App.tsx', [
      'data-testid="opl-workspace-rail"',
      'data-testid="opl-session-list"',
      'data-testid="opl-context-tabs"',
      'data-testid="opl-files-panel"',
      'data-testid="opl-skills-panel"',
      'data-testid="opl-routing-panel"',
      'data-testid="opl-memory-panel"',
      'data-testid="opl-always-on-panel"',
      'data-testid="opl-web-transport"',
      'data-testid="opl-locale-toggle"',
    ], 'native chat-first contextual renderer');
    assertCandidateFileContains(candidate, 'src/bridge/oplBridge.ts', [
      'opl app state --profile fast --json',
      'opl app state --profile full --json',
      'opl runtime app-operator-drilldown --detail full --json',
      'opl app action execute --action',
    ], 'OPL App state/action bridge');
    assertCandidateFileContains(candidate, 'src/workbench/workbenchModel.ts', [
      'results',
      'deliverables',
      'receipts',
      'activeProjectLines',
    ], 'results and delivery workbench model');
    assertCandidateFileContains(candidate, 'scripts/validate-native-workbench-candidate.mjs', [
      'src/candidateContractEvidence.json',
      'opl-workspace-rail',
      'opl-native-workbench',
    ], 'native workbench self-validator');
    return;
  }

  assertCandidateFileContains(candidate, 'src/renderer/App.jsx', [
    'data-testid="opl-workspace-rail"',
    'data-testid="opl-session-list"',
    'data-testid="opl-context-tabs"',
    'data-testid="opl-files-panel"',
    'data-testid="opl-skills-panel"',
    'data-testid="opl-routing-panel"',
    'data-testid="opl-memory-panel"',
    'data-testid="opl-always-on-panel"',
  ], 'chat-first contextual renderer');
  assertCandidateFileContains(candidate, 'src/renderer/web-bridge.js', [
    'window.oplCandidate',
    'EventSource',
    '/api/codex-events',
  ], 'Web transport bridge');
  assertCandidateFileContains(candidate, 'scripts/dev-webui-server.js', [
    '/api/shell-data',
    '/api/send-message',
    '/api/codex-events',
  ], 'WebUI gateway');
}

function validateCandidateChatTarget(candidate: ShellCandidate): void {
  const target = candidate.codex_app_like_chat_target;
  if (!target) {
    throw new Error(`${candidate.id} must declare codex_app_like_chat_target`);
  }
  if (candidate.id === 'opl-native-workbench') {
    if (target.scope !== 'OPL-native chat-first desktop and WebUI target optimized for results, deliverables, and artifact refs') {
      throw new Error(`${candidate.id} target must be the OPL-native results/delivery workbench`);
    }
    assertStringArrayIncludes(target.capability_inventory, [
      'workspace directory picker',
      'new conversation and lightweight thread history rail',
      'Codex app-server backed chat turns',
      'shared native React renderer for Electron and WebUI',
      'Web transport bridge with HTTP actions and SSE Codex events',
      'K-Dense-informed project sandbox and delivery artifact organization as reference-only',
      'Open Science-informed artifact, provenance, and review affordances as collapsed secondary context',
      'chat-first main canvas with pinned composer',
      'results, files, receipts, and delivery refs as first-class context',
      'right-side collapsible Files, Skills, Routing, Memory, Always-On, Runtime, and Settings context tabs',
      'candidate .app package through the App wrapper',
    ], `${candidate.id}.codex_app_like_chat_target.capability_inventory`);
  } else {
  if (target.scope !== 'Codex App-style chat-first desktop and WebUI target, not a full workbench first screen or AionUI modification list') {
    throw new Error(`${candidate.id} target must stay Codex App-style chat-first, not a full workbench first screen`);
  }
  assertStringArrayIncludes(target.capability_inventory, [
    'workspace directory picker',
    'new conversation and lightweight thread history rail',
    'Codex app-server backed chat turns',
    'shared React/CopilotKit renderer for Electron and WebUI',
    'Web transport bridge with HTTP actions and SSE Codex events',
    'PilotDeck-informed information organization as reference-only',
    'chat-first main canvas with pinned composer',
    'right-side collapsible Files, Skills, Routing, Memory, and Always-On context tabs',
    'candidate .app package through the App wrapper',
  ], `${candidate.id}.codex_app_like_chat_target.capability_inventory`);
  }

  const pilotdeckTarget = candidate.pilotdeck_information_architecture_target;
  if (!pilotdeckTarget) {
    throw new Error(`${candidate.id} must declare pilotdeck_information_architecture_target`);
  }
  if (pilotdeckTarget.source_usage !== 'design_reference_only' || pilotdeckTarget.license !== 'AGPL-3.0') {
    throw new Error(`${candidate.id} PilotDeck target must remain AGPL design_reference_only`);
  }
  if (pilotdeckTarget.copied_source_allowed !== false || pilotdeckTarget.runtime_authority_transfer_allowed !== false) {
    throw new Error(`${candidate.id} must not copy PilotDeck source or transfer PilotDeck runtime authority`);
  }
  assertStringArrayIncludes(pilotdeckTarget.required_surfaces, requiredContextSurfaces, `${candidate.id}.pilotdeck_information_architecture_target.required_surfaces`);
  assertStringArrayIncludes(pilotdeckTarget.required_testids, requiredContextTestIds, `${candidate.id}.pilotdeck_information_architecture_target.required_testids`);
}

function validateCandidateWebUiTransport(candidate: ShellCandidate): void {
  const transport = candidate.webui_transport;
  if (!transport) {
    throw new Error(`${candidate.id} must declare webui_transport`);
  }
  if (transport.shared_renderer !== true) {
    throw new Error(`${candidate.id} webui_transport.shared_renderer must be true`);
  }
  if (candidate.id === 'opl-native-workbench') {
    if (transport.electron_surface !== 'Electron preload/IPC window.oplNativeWorkbench') {
      throw new Error(`${candidate.id} electron transport must expose window.oplNativeWorkbench`);
    }
    if (transport.web_surface !== 'browser window.oplNativeWorkbench compatibility bridge') {
      throw new Error(`${candidate.id} web surface must expose the browser window.oplNativeWorkbench bridge`);
    }
    if (transport.web_bridge !== 'src/bridge/webTransport.ts') {
      throw new Error(`${candidate.id} web bridge must be src/bridge/webTransport.ts`);
    }
    if (transport.gateway !== 'scripts/dev-webui-server.mjs') {
      throw new Error(`${candidate.id} WebUI gateway must be scripts/dev-webui-server.mjs`);
    }
    if (transport.event_stream !== 'SSE /api/opl-events') {
      throw new Error(`${candidate.id} WebUI event stream must be SSE /api/opl-events`);
    }
    if (transport.native_picker_policy !== 'Electron may use native directory picker; WebUI uses an explicit workspace path/action bridge without changing App product truth') {
      throw new Error(`${candidate.id} WebUI native picker policy must preserve App product truth`);
    }
    return;
  }
  if (transport.electron_surface !== 'Electron preload/IPC window.oplCandidate') {
    throw new Error(`${candidate.id} electron WebUI transport must preserve preload/IPC window.oplCandidate`);
  }
  if (transport.web_surface !== 'browser window.oplCandidate compatibility bridge') {
    throw new Error(`${candidate.id} web surface must be the browser window.oplCandidate compatibility bridge`);
  }
  if (transport.web_bridge !== 'src/renderer/web-bridge.js') {
    throw new Error(`${candidate.id} web bridge must be src/renderer/web-bridge.js`);
  }
  if (transport.gateway !== 'scripts/dev-webui-server.js') {
    throw new Error(`${candidate.id} WebUI gateway must be scripts/dev-webui-server.js`);
  }
  if (transport.event_stream !== 'SSE /api/codex-events') {
    throw new Error(`${candidate.id} WebUI event stream must be SSE /api/codex-events`);
  }
  if (transport.native_picker_policy !== 'Electron may use native directory picker; WebUI uses an explicit workspace path/action bridge without changing App product truth') {
    throw new Error(`${candidate.id} WebUI native picker policy must preserve App product truth`);
  }
}
