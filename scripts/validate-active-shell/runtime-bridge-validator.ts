import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appOwnedGenericOwnerAcceptanceCurrentnessRefPolicy,
  appOwnedOplStandardAgentMembershipPolicy,
} from './app-contract-constants.ts';
import { isDefaultReleaseAdapter } from './active-shell-contract.ts';
import { lookupPath } from './value-helpers.ts';
import {
  validateArtifactNativeDrilldownProjectionContract,
  validateArtifactProvenanceBundleProjectionContract,
  validateAgentAvailabilityProjectionContract,
  validateOpenScienceConsoleProjectionContract,
  validateProviderReadinessRepairProjectionContract,
  validateProgressDeltaDisplayContract,
  validateProjectProgressDisplayContract,
  validateRefLevelFollowUpProjectionContract,
  validateStageRunCockpitProjectionContract,
  validateStateIndexSidecarProjectionContract,
  validateStructuredResultPanelProjectionContract,
  validateWorkflowSkillCandidateProjectionContract,
  validateWorkItemProjectionContract,
  validateUserTaskStatusProjectionContract,
} from './shared-contract-validators.ts';
import { validateOplGatewayAccountContract } from './runtime-bridge-validator-parts/gateway-account.ts';
import {
  runtimeBridgePackageDirectoryEntryFields,
  runtimeBridgeProjectedActionFields,
  validateLiveOplConformance,
  validateLiveConformanceContract,
  validateOplAppStateFastAgentPackageDirectoryFixture,
} from './runtime-bridge-validator-parts/app-state.ts';
import { validateCanonicalConversationContinuityPolicy } from './runtime-bridge-validator-parts/continuity.ts';
import { validateCodexParityAdapterPolicies } from './runtime-bridge-validator-parts/codex-parity.ts';

function validateRuntimeBridgeIdentity(runtimeBridge, contract) {
  if (runtimeBridge.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected runtime bridge owner: ${runtimeBridge.owner}`);
  }
  if (runtimeBridge.purpose !== 'runtime_bridge_abstraction') {
    throw new Error(`Unexpected runtime bridge purpose: ${runtimeBridge.purpose}`);
  }
  if (runtimeBridge.state !== 'active') {
    throw new Error(`Unexpected runtime bridge state: ${runtimeBridge.state}`);
  }
  if (isDefaultReleaseAdapter(contract) && runtimeBridge.active_adapter !== contract.active_shell) {
    throw new Error(`Runtime bridge active adapter must match active shell: ${runtimeBridge.active_adapter}`);
  }
  if (runtimeBridge.adapter_role !== 'replaceable_gui_shell_adapter') {
    throw new Error(`Unexpected runtime bridge adapter role: ${runtimeBridge.adapter_role}`);
  }
  if (runtimeBridge.protocol_owner !== 'one-person-lab') {
    throw new Error(`Unexpected runtime bridge protocol owner: ${runtimeBridge.protocol_owner}`);
  }
  if (runtimeBridge.ui_contract_owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected runtime bridge UI contract owner: ${runtimeBridge.ui_contract_owner}`);
  }
  if (isDefaultReleaseAdapter(contract) && runtimeBridge.default_adapter_repo !== contract.shell_source?.owner_repo) {
    throw new Error(`Runtime bridge adapter repo must match active shell source: ${runtimeBridge.default_adapter_repo}`);
  }
  if (isDefaultReleaseAdapter(contract) && runtimeBridge.default_adapter_path !== contract.shell_root) {
    throw new Error(`Runtime bridge adapter path must match active shell root: ${runtimeBridge.default_adapter_path}`);
  }
}

function validateRuntimeBridgeDeclaredSurfaces(runtimeBridge) {
  for (const [field, expected] of Object.entries({
    summary_command: 'opl app state --profile fast --json',
    refresh_command: 'opl app state --profile fast --json',
    default_operator_payload: 'current_owner_delta',
    full_state_command: 'opl app state --profile full --json',
    full_state_policy: 'diagnostic_or_release_evidence_only',
    full_detail_command: 'opl runtime app-operator-drilldown --detail full --json',
    runtime_page_full_detail_allowed: false,
    action_command: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
    'projection_sources.primary': 'app_state.operator.workbench.work_item_projection_v2',
    'projection_sources.provider': 'runtime_tray_snapshot.app_operator_drilldown.current_control_state.states.provider_run',
    'projection_sources.actions': 'app_state.actions',
    'projection_sources.full_detail': 'runtime_tray_snapshot.app_operator_drilldown',
    'projection_sources.policy': 'work_item_projection_v2_primary_provider_projection_diagnostic_only',
  })) {
    const actual = field.split('.').reduce((value, key) => value?.[key], runtimeBridge);
    if (actual !== expected) {
      throw new Error(`Runtime bridge ${field} must be ${expected}`);
    }
  }
  if ('compatibility_operator_payload' in runtimeBridge) {
    throw new Error('Runtime bridge must not declare compatibility_operator_payload');
  }
  assertDeepEqualJson(
    runtimeBridge.full_detail_consumer_surfaces,
    ['/settings/environment?section=diagnostics', 'release_evidence_tooling'],
    'Runtime bridge full detail consumer surfaces',
  );
}

function validateRuntimeBridgeDefaultReadSurfacePolicy(runtimeBridge) {
  const defaultReadSurfacePolicy = runtimeBridge.default_read_surface_policy;
  for (const [field, expected] of Object.entries({
    default_projection: 'opl_current_owner_delta',
    source_path: 'app_state.operator.default_read_surface_policy',
    foundry_agent_os_cockpit_policy: 'first_screen_current_owner_delta_only_raw_worklist_evidence_provider_trace_drilldown_only',
    default_next_action_source: 'current_owner_delta',
    raw_worklist_generates_default_next_action: false,
    release_evidence_counts_as_release_ready: false,
    stage_run_cockpit_projection_ref: 'contracts/app-runtime-bridge.json#stage_run_cockpit_projection',
    full_detail_policy: 'explicit_full_detail_or_lazy_diagnostic_only',
    raw_refs_policy: 'raw_refs_require_explicit_full_detail',
    full_detail_auto_poll: false,
    shell_must_not_use_full_drilldown_as_normal_state: true,
    shell_must_not_derive_layout_from_raw_runtime_projection: true,
  })) {
    if (defaultReadSurfacePolicy?.[field] !== expected) {
      throw new Error(`Runtime bridge default_read_surface_policy.${field} must be ${expected}`);
    }
  }
  if (defaultReadSurfacePolicy && 'compatibility_projection' in defaultReadSurfacePolicy) {
    throw new Error('Runtime bridge default_read_surface_policy must not declare compatibility_projection');
  }
  for (const field of [
    'next_safe_action_or_none',
    'current_owner',
    'required_delta',
    'accepted_return_shapes',
    'readiness_false_flags',
    'count_summary',
  ]) {
    if (!defaultReadSurfacePolicy?.first_screen_answers?.includes(field)) {
      throw new Error(`Runtime bridge default_read_surface_policy.first_screen_answers must include ${field}`);
    }
  }
  for (const field of [
    'runtime_tray_snapshot',
    'raw_evidence_envelope',
    'stage_replay_packet_body',
    'private_residue_inventory_body',
    'provider_internal_ledger_body',
  ]) {
    if (!defaultReadSurfacePolicy?.forbidden_default_state_fields?.includes(field)) {
      throw new Error(`Runtime bridge default_read_surface_policy.forbidden_default_state_fields must include ${field}`);
    }
  }
}

function validateRuntimeBridgeUserTaskStatus(runtimeBridge) {
  validateUserTaskStatusProjectionContract(
    runtimeBridge.user_task_status_projection,
    'Runtime bridge user task status projection',
    runtimeBridge.stage_run_cockpit_projection,
  );
  if (runtimeBridge.user_task_status_projection?.app_role !== 'display_only_user_task_status_consumer') {
    throw new Error('Runtime bridge user task status projection must be a display-only consumer');
  }
}

export function validateRuntimeProgressPageDisplayPolicy(runtimeBridge) {
  const policy = runtimeBridge.runtime_progress_page_display_policy;
  assertDeepEqualJson(
    runtimeBridge.user_task_status_projection?.generic_owner_acceptance_currentness_ref_policy,
    appOwnedGenericOwnerAcceptanceCurrentnessRefPolicy,
    'Runtime generic owner acceptance/currentness ref policy',
  );
  if (policy?.owner !== 'one-person-lab-app') {
    throw new Error('Runtime progress page display policy must be App-owned');
  }
  if (policy?.default_surface !== 'work_item_projection_v2_list') {
    throw new Error('Runtime progress page default surface must be WorkItemProjection v2 list');
  }
  if (policy?.advanced_surface !== 'selected_work_item_stage_popover_or_detail_drawer') {
    throw new Error('Runtime progress page advanced surface must be selected work-item detail only');
  }
  if (policy?.page_role !== 'minimal_project_work_status_not_platform_operations') {
    throw new Error('Runtime progress page must be project work status, not platform operations');
  }
  if (policy?.work_item_projection_ref !== 'contracts/app-runtime-bridge.json#work_item_projection') {
    throw new Error('Runtime progress page must point at the canonical WorkItemProjection contract');
  }
  if (policy?.detail_layer_ref !== 'contracts/app-runtime-bridge.json#work_item_projection.detail_layer_contract') {
    throw new Error('Runtime progress page must point at the WorkItemProjection detail layer contract');
  }
  assertDeepEqualJson(policy?.default_task_row_spine, [
    'project_and_work_item',
    'status',
    'progress_and_next_step',
    'elapsed_and_tokens',
  ], 'Runtime progress page default task row spine');
  assertDeepEqualJson(policy?.default_page_sections, [
    'top_scope_and_refresh',
    'compact_status_filter',
    'archived_tasks_entry',
    'work_item_list',
  ], 'Runtime progress page default sections');
  assertDeepEqualJson(policy?.layout_regions, {
    top: ['top_scope_and_refresh', 'compact_status_filter', 'archived_tasks_entry'],
    main: ['work_item_list'],
  }, 'Runtime progress page layout regions');
  assertIncludesAll(policy?.default_field_allowlist ?? [], [
    'identity.project_display_name',
    'identity.work_item_display_name',
    'identity.agent_display_name',
    'lifecycle.primary_state',
    'visibility.state',
    'execution.state',
    'execution.current_stage_display_name',
    'execution.next_stage_display_name',
    'telemetry.elapsed',
    'telemetry.current_stage_tokens',
    'telemetry.task_total_tokens',
    'action.title_key',
    'action.message_args',
    'action.owner',
    'action.owner_kind',
  ], 'Runtime progress page default field allowlist');
  assertIncludesAll(policy?.default_visible_field_groups?.work_item_list ?? [], [
    'identity.project_display_name',
    'identity.work_item_display_name',
    'identity.agent_display_name',
    'lifecycle.primary_state',
    'visibility.state',
    'execution.state',
    'execution.current_stage_display_name',
    'execution.next_stage_display_name',
    'telemetry.elapsed',
    'telemetry.current_stage_tokens',
    'telemetry.task_total_tokens',
    'action.title_key',
    'action.message_args',
    'action.owner',
    'action.owner_kind',
  ], 'Runtime progress page work item list fields');
  for (const forbiddenField of [
    'action.title_args',
    'action.summary_args',
    'action.copy_locale',
    'visibility.token',
    'identity.generation',
  ]) {
    if (
      policy?.default_field_allowlist?.includes(forbiddenField)
      || Object.values(policy?.default_visible_field_groups ?? {}).some(
        (fields) => Array.isArray(fields) && fields.includes(forbiddenField),
      )
    ) {
      throw new Error(`Runtime progress page must not consume nonexistent field ${forbiddenField}`);
    }
  }
  const defaultFieldAllowlist = new Set(policy?.default_field_allowlist ?? []);
  for (const [groupName, fields] of Object.entries(policy?.default_visible_field_groups ?? {})) {
    if (!Array.isArray(fields)) {
      throw new Error(`Runtime progress page default visible field group ${groupName} must be an array`);
    }
    for (const field of fields) {
      if (!defaultFieldAllowlist.has(field)) {
        throw new Error(`Runtime progress page default field ${groupName}.${field} must be included in default_field_allowlist`);
      }
    }
  }
  if (
    policy?.default_label_policy?.primary_state_label_render_owner !== 'shell_current_app_locale' ||
    policy?.default_label_policy?.action_label_render_owner !== 'shell_current_app_locale' ||
    policy?.default_label_policy?.framework_hardcoded_locale_copy_default_allowed !== false
  ) {
    throw new Error('Runtime progress page labels must render from semantic state/action fields in the current App locale');
  }
  if (
    policy?.task_deduplication_policy?.canonical_row_key !== 'item_id' ||
    policy?.task_deduplication_policy?.detail_selection_key !== 'item_id' ||
    policy?.task_deduplication_policy?.identity_work_item_id_scope !== 'project_local' ||
    policy?.task_deduplication_policy?.duplicate_local_work_item_id_across_projects_allowed !== true ||
    policy?.task_deduplication_policy?.dedupe_owner !== 'opl_framework' ||
    policy?.task_deduplication_policy?.one_row_per_work_item !== true ||
    policy?.task_deduplication_policy?.shell_heuristic_deduplication_allowed !== false ||
    policy?.task_deduplication_policy?.module_runtime_rows_policy !==
    'module_runtime_and_module_health_never_enter_runtime_page_route_to_settings'
  ) {
    throw new Error('Runtime progress page must project one canonical row per work item and keep module runtime separate');
  }
  if (policy?.task_deduplication_policy?.raw_duplicate_refs_default_visible !== false) {
    throw new Error('Runtime progress page raw duplicate refs must stay hidden by default');
  }
  const visibilityPolicy = policy?.work_item_visibility_policy;
  assertDeepEqualJson(
    visibilityPolicy?.axis_values,
    ['visible', 'archived'],
    'Runtime progress page visibility axis values',
  );
  for (const [field, expected] of Object.entries({
    axis: 'work_item_projection.visibility.state',
    default_list_visibility: 'visible',
    archived_library_visibility: 'archived',
    archived_library_is_saved_status_view: false,
    archived_library_scope: 'same_agent_then_project_scope',
    status_filters_include_agent_project_or_visibility: false,
    restore_returns_item_to_default_list: true,
    local_storage_truth_allowed: false,
    mutation_contract_ref:
      'contracts/app-runtime-bridge.json#work_item_projection.visibility_mutation_contract',
  })) {
    if (visibilityPolicy?.[field] !== expected) {
      throw new Error(`Runtime progress page visibility ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    policy?.next_step_copy_policy?.source_priority,
    ['action.title_key + action.message_args', 'action.summary_key + action.message_args'],
    'Runtime progress page next-step semantic source priority',
  );
  assertDeepEqualJson(
    policy?.next_step_copy_policy?.compatibility_fallback_fields,
    ['action.title', 'action.summary'],
    'Runtime progress page next-step compatibility fallback fields',
  );
  if (
    policy?.next_step_copy_policy?.render_owner !== 'shell_current_app_locale' ||
    policy?.next_step_copy_policy?.long_text_policy !==
      'framework_projects_locale_independent_action_semantics_shell_renders_current_app_locale' ||
    policy?.next_step_copy_policy?.compatibility_fallback_only !== true ||
    policy?.next_step_copy_policy?.cross_locale_raw_fallback_allowed !== false ||
    policy?.next_step_copy_policy?.missing_semantics_policy !==
      'localized_generic_action_copy_from_action_kind'
  ) {
    throw new Error('Runtime progress page must render Framework action semantics in the current App locale');
  }
  if (policy?.next_step_copy_policy?.raw_route_or_command_default_visible !== false) {
    throw new Error('Runtime progress page raw route/command next steps must stay hidden by default');
  }
  assertDeepEqualJson(
    policy?.responsive_acceptance?.viewport_widths_px,
    [375, 768, 1024, 1440],
    'Runtime progress page responsive viewport matrix',
  );
  if (
    policy?.responsive_acceptance?.desktop_layout !== 'four_columns' ||
    policy?.responsive_acceptance?.narrow_layout !== 'semantic_row_reflow' ||
    policy?.responsive_acceptance?.horizontal_page_overflow_allowed !== false ||
    policy?.responsive_acceptance?.text_overlap_allowed !== false
  ) {
    throw new Error('Runtime progress page must reflow without horizontal page overflow or text overlap');
  }
  assertDeepEqualJson(policy?.advanced_only_fields, [
    'raw_proof_ref',
    'receipt_refs',
    'stage_attempt_ids',
    'run_id',
    'active_run_id',
    'workflow_id',
    'workflow_refs',
    'raw_blocker_route',
    'typed_blocker_resolution_ref',
    'raw_readback',
    'readback_ref',
    'readback_text',
    'runtime_readback_ref',
    'runtime_closeout_ref',
    'stage_run_current_owner_delta.accepted_return_shapes',
    'stage_run_current_owner_delta.artifact_or_blocker_refs',
    'stage_run_current_owner_delta.readiness_false_flag_refs',
    'provider',
    'projection',
    'ledger',
    'current_control_state',
    'full_drilldown',
  ], 'Runtime progress page advanced-only fields');
  assertDeepEqualJson(policy?.surface_exclusions?.runtime_page_forbidden, [
    'operator_summary',
    'safe_action_catalog',
    'software_install_or_update_actions',
    'platform_repair_actions',
    'module_health_panel',
    'provider_diagnostics',
    'raw_runtime_readback',
  ], 'Runtime progress page forbidden surfaces');
  assertDeepEqualJson(policy?.surface_exclusions?.settings_owner_routes, {
    software_updates: '/settings/environment?section=updates',
    platform_repair: '/settings/environment?section=services',
    agent_package_management: '/settings/agents',
    capability_management: '/settings/capabilities',
    diagnostics: '/settings/environment?section=diagnostics',
  }, 'Runtime progress page Settings routes');
  const stagePopover = runtimeBridge.work_item_projection?.stage_popover_contract;
  assertDeepEqualJson(stagePopover?.required_fields, [
    'stage_map',
    'stage_map[].display_names',
    'execution.current_stage_display_name',
    'execution.next_stage_display_name',
    'execution.attempt_id',
  ], 'Runtime Stage popover required fields');
  assertDeepEqualJson(stagePopover?.viewport_widths_px, [375, 768, 1024, 1440], 'Runtime Stage popover viewports');
  for (const [field, expected] of Object.entries({
    trigger_field: 'execution.current_stage_display_name',
    trigger_does_not_open_task_drawer: true,
    label_source: 'stage_map[].display_names[current_app_locale]',
    label_fallback: 'stage_map[].display_name',
    locale_owner: 'shell_current_app_locale',
    current_attempt_visible_here: true,
    current_attempt_default_row_visible: false,
    historical_attempt_ids_visible: false,
    horizontal_overflow_allowed: false,
  })) {
    if (stagePopover?.[field] !== expected) {
      throw new Error(`Runtime Stage popover ${field} must be ${expected}`);
    }
  }
  for (const claim of [
    'second_runtime_truth_source',
    'live_runtime_readiness',
    'release_currentness',
    'owner_receipt_authority',
    'shell_runtime_truth',
  ]) {
    if (!policy?.forbidden_claims?.includes(claim)) {
      throw new Error(`Runtime progress page display policy must forbid ${claim}`);
    }
  }
}

function validateRuntimeBridgeCommandResolutionPolicy(runtimeBridge) {
  const commandResolutionPolicy = runtimeBridge.command_resolution_policy;
  if (commandResolutionPolicy?.owner !== 'one-person-lab-app') {
    throw new Error('Runtime bridge command resolution policy must be App-owned');
  }
  if (commandResolutionPolicy?.adapter_responsibility !== 'resolve_healthy_opl_cli_before_running_declared_surfaces') {
    throw new Error('Runtime bridge command resolution policy must require healthy OPL CLI resolution');
  }
  if (commandResolutionPolicy?.managed_opl_priority !== 'prefer_only_when_shim_targets_existing_cli_payload') {
    throw new Error('Runtime bridge must prefer managed OPL only when its shim targets an existing CLI payload');
  }
  if (commandResolutionPolicy?.broken_managed_shim_policy !== 'skip_and_fall_through_to_system_opl') {
    throw new Error('Runtime bridge must skip broken managed OPL shims and fall through to system OPL');
  }
  for (const fallbackPath of ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']) {
    if (!commandResolutionPolicy?.system_opl_fallback_paths?.includes(fallbackPath)) {
      throw new Error(`Runtime bridge command resolution policy must include fallback path ${fallbackPath}`);
    }
  }
  for (const forbidden of [
    'let stale managed Node opl shims shadow a healthy system opl',
    'rewrite App runtime truth from shell-private state',
    'treat missing managed bootstrap artifacts as first-run UI truth',
  ]) {
    if (!commandResolutionPolicy?.must_not?.includes(forbidden)) {
      throw new Error(`Runtime bridge command resolution policy must forbid: ${forbidden}`);
    }
  }
  const sharedGuiTarget = commandResolutionPolicy?.shared_gui_target;
  for (const [field, expected] of Object.entries({
    implementation_status:
      'candidate_launcher_runtime_provenance_readback_implemented_compatibility_parity_not_proven',
    producer: 'app_host_runtime_resolver',
    producer_status: 'implemented_for_local_gui_launcher',
  })) {
    if (sharedGuiTarget?.[field] !== expected) {
      throw new Error(`Runtime bridge shared GUI command resolver target ${field} must be ${expected}`);
    }
  }
  assertIncludesAll(sharedGuiTarget?.required_executables, ['opl', 'codex'], 'Shared GUI runtime executables');
  const compatibilityRequirements = sharedGuiTarget?.compatibility_requirements;
  if (!Array.isArray(compatibilityRequirements)) {
    throw new Error('Shared GUI runtime compatibility requirements must be an array');
  }
  for (const requirement of compatibilityRequirements) {
    if (requirement?.kind !== 'capability_id_with_versioned_schema') {
      throw new Error(`Shared GUI runtime compatibility requirement kind ${requirement?.kind ?? '(missing)'} is unsupported`);
    }
  }
  assertDeepEqualJson(
    compatibilityRequirements,
    [
      {
        kind: 'capability_id_with_versioned_schema',
        component_id: 'opl_framework',
        capability_id: 'opl_app_state_fast',
        schema_range: '>=1 <2',
      },
      {
        kind: 'capability_id_with_versioned_schema',
        component_id: 'opl_framework',
        capability_id: 'opl_app_action_execute',
        schema_range: '>=1 <2',
      },
      {
        kind: 'capability_id_with_versioned_schema',
        component_id: 'codex_cli',
        capability_id: 'codex_app_server',
        schema_range: '>=1 <2',
      },
    ],
    'Shared GUI runtime compatibility requirements',
  );
  if (sharedGuiTarget?.observational_build_provenance?.may_gate_install_or_runtime !== false) {
    throw new Error('Shared GUI runtime observational build provenance may_gate_install_or_runtime must be false');
  }
  assertDeepEqualJson(
    sharedGuiTarget?.observational_build_provenance,
    {
      schema: 'app_runtime_executable_identity.v1',
      fields: ['opl_path', 'opl_version', 'codex_path', 'codex_version', 'runtime_cohort_ref'],
      role: 'per_gui_artifact_source_observation_only',
      may_gate_install_or_runtime: false,
    },
    'Shared GUI runtime observational build provenance',
  );
}

function validateSharedGuiRuntimeResolutionPolicy(runtimeBridge) {
  const policy = runtimeBridge.shared_gui_runtime_resolution_policy;
  if ('same_cohort_runtime_identity_required_for_parity' in (policy ?? {})) {
    throw new Error('Runtime parity must not retain the same_cohort_runtime_identity_required_for_parity gate');
  }
  for (const [field, expected] of Object.entries({
    state: 'source_binding_and_packaged_artifact_evidence_complete',
    policy_owner: 'one-person-lab-app',
    runtime_identity_owner: 'gaofeng21cn/opl-aion-shell',
    resolver_source: 'contracts/app-runtime-bridge.json#command_resolution_policy.shared_gui_target',
    logical_control_plane_shared: true,
    parity_admission_basis: 'compatible_runtime_capability_and_versioned_schema_range',
    exact_runtime_identity_equality_may_gate_install_or_runtime: false,
    host_path_only_resolution_can_prove_parity: false,
    active_aionui_status: 'aioncore_managed_identity_binding_packaged_full_standard_finder_replay_passed',
    opl_studio_status: 'launcher_explicit_runtime_resolution_implemented_direct_launch_host_path_fallback_remains',
    same_physical_runtime_currently_claimed: true,
    implementation_status: 'source_identity_binding_and_full_standard_finder_evidence_complete',
  })) {
    if (policy?.[field] !== expected) {
      throw new Error(`Runtime bridge shared GUI runtime resolution policy ${field} must be ${expected}`);
    }
  }

  const identityContract = policy?.runtime_identity_contract;
  for (const [field, expected] of Object.entries({
    schema: 'opl_codex_runtime_identity.v1',
    contract_owner: 'one-person-lab-app',
    producer_owner: 'gaofeng21cn/opl-aion-shell',
    carrier: 'aioncore_managed_resources_projection',
    direct_app_server_binding: 'identity_verified_before_exact_codex_app_server_spawn',
    aioncore_acp_binding:
      'unique_managed_candidate_plus_inherited_environment_plus_successful_conversation_handshake',
    aioncore_modification_required: false,
    aioncore_native_readback_required: false,
    aioncore_native_readback_currently_available: false,
    aioncore_native_readback_claim_allowed: false,
  })) {
    if (identityContract?.[field] !== expected) {
      throw new Error(`Runtime bridge Codex identity contract ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    identityContract?.required_fields,
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
    'Runtime bridge Codex identity fields',
  );
  assertDeepEqualJson(
    identityContract?.environment_binding_fields,
    [
      'OPL_CODEX_BIN',
      'CODEX_HOME',
      'OPL_CODEX_RUNTIME_IDENTITY_JSON',
      'OPL_CODEX_RUNTIME_COHORT_REF',
      'PATH',
    ],
    'Runtime bridge Codex identity environment binding',
  );
  assertDeepEqualJson(
    identityContract?.typed_error_codes,
    [
      'USER_AGENT_NOT_INSTALLED',
      'USER_AGENT_COMMAND_NOT_FOUND',
      'MANAGED_RUNTIME_UNAVAILABLE',
      'RUNTIME_ACTIVATION_REQUIRED',
      'RUNTIME_IDENTITY_MISMATCH',
    ],
    'Runtime bridge Codex identity typed errors',
  );

  const evidenceContract = policy?.packaged_evidence_contract;
  for (const [field, expected] of Object.entries({
    schema_ref: 'contracts/opl-codex-runtime-identity-evidence.schema.json',
    launch_entrypoint: 'finder',
    minimal_path: '/usr/bin:/bin',
    global_codex_required: false,
    referenced_file_sha256_required: true,
    claim_scope: 'opl_controlled_input_and_successful_handshake_without_aioncore_native_readback',
    artifact_trigger_status: 'complete',
    evidence_receipt: 'docs/delivery/release-evidence/issue-122-codex-runtime-identity-v26.8.1-r5.json',
  })) {
    if (evidenceContract?.[field] !== expected) {
      throw new Error(`Runtime bridge Codex packaged evidence ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    evidenceContract?.required_run_ids,
    ['full_clean_install_finder', 'standard_update_after_full_finder'],
    'Runtime bridge Codex packaged evidence runs',
  );
  assertDeepEqualJson(
    evidenceContract?.identity_comparison_fields,
    ['path', 'realpath', 'version', 'sha256', 'codex_home', 'runtime_cohort_ref'],
    'Runtime bridge Codex packaged identity comparison fields',
  );
  assertDeepEqualJson(
    evidenceContract?.required_handshakes,
    ['direct_app_server_initialize', 'aioncore_acp_ordinary_conversation_real_response'],
    'Runtime bridge Codex packaged handshakes',
  );
}

function validateRuntimeBridgeProjectionContracts(runtimeBridge) {
  validateWorkItemProjectionContract(
    runtimeBridge.work_item_projection,
    'Runtime bridge WorkItemProjection',
  );
  validateAgentAvailabilityProjectionContract(
    runtimeBridge.agent_availability_projection,
    'Runtime bridge agent availability projection',
  );
  validateProjectProgressDisplayContract(runtimeBridge.project_progress_projection, 'Runtime bridge project progress projection');
  validateProgressDeltaDisplayContract(
    runtimeBridge.progress_delta_projection,
    'Runtime bridge progress delta projection',
  );
  validateProviderReadinessRepairProjectionContract(
    runtimeBridge.provider_readiness_repair_projection,
    'Runtime bridge provider readiness repair projection',
  );
  validateStateIndexSidecarProjectionContract(
    runtimeBridge.state_index_sidecar_projection,
    'Runtime bridge State Index sidecar projection',
  );
  validateArtifactNativeDrilldownProjectionContract(
    runtimeBridge.artifact_native_drilldown_projection,
    'Runtime bridge Stage Artifact drilldown projection',
    { requireProvenanceBundle: true },
  );
  validateArtifactProvenanceBundleProjectionContract(
    runtimeBridge.artifact_provenance_bundle_projection,
    'Runtime bridge Artifact Provenance Bundle projection',
  );
  validateStructuredResultPanelProjectionContract(
    runtimeBridge.structured_result_panel_projection,
    'Runtime bridge structured result panel projection',
  );
  validateRefLevelFollowUpProjectionContract(
    runtimeBridge.ref_level_follow_up_projection,
    'Runtime bridge ref-level follow-up projection',
  );
  validateWorkflowSkillCandidateProjectionContract(
    runtimeBridge.workflow_skill_candidate_projection,
    'Runtime bridge workflow/skill candidate projection',
  );
  validateOpenScienceConsoleProjectionContract(
    runtimeBridge.openscience_console_projection,
    'Runtime bridge OpenScience Console projection',
  );
  validateStageRunCockpitProjectionContract(
    runtimeBridge.stage_run_cockpit_projection,
    'Runtime bridge StageRun cockpit projection',
  );
  const advancedOperator = runtimeBridge.advanced_operator_drilldown;
  if (
    advancedOperator?.command !== 'opl runtime app-operator-drilldown --json'
    || advancedOperator.runtime_page_allowed !== false
  ) {
    throw new Error('Runtime bridge operator drilldown must stay outside Runtime');
  }
  assertDeepEqualJson(
    advancedOperator.consumer_surfaces,
    ['/settings/environment?section=diagnostics', 'release_evidence_tooling'],
    'Runtime bridge operator drilldown consumer surfaces',
  );
  if (
    runtimeBridge.running_task_projection?.consumer_surface !== '/settings/environment?section=diagnostics'
    || runtimeBridge.running_task_projection.runtime_page_visible !== false
  ) {
    throw new Error('Runtime bridge provider-attempt projection must be Maintenance diagnostics only');
  }
}

function validatePackageReadinessProjection(runtimeBridge) {
  const rows = runtimeBridge.canonical_state_display_action_map?.rows;
  const runtimeRow = Array.isArray(rows) ? rows.find((row) => row?.semantic_area === 'runtime') : null;
  const packageRow = Array.isArray(rows) ? rows.find((row) => row?.semantic_area === 'package') : null;
  const nativeShellRole = runtimeBridge.canonical_state_display_action_map?.shells?.opl_studio?.role;
  if (
    runtimeRow?.route_classification !== 'core_dynamic_agent_runtime'
    || runtimeRow.producer_required !== true
    || runtimeRow.aionui_route_required !== true
    || runtimeRow.adopted_shell_route_required !== true
    || runtimeRow?.canonical_source !==
      'opl app state --profile fast --json#app_state.operator.workbench.work_item_projection_v2'
    || runtimeRow.aion_display_role !==
      'minimal WorkItem status, Stage, Attempt, Token, next action, and archive/restore'
    || runtimeRow.workbench_display_role !== 'core Runtime consumer required before shell adoption'
    || nativeShellRole !== 'active_release_shell_thin_display_consumer'
  ) {
    throw new Error('Runtime bridge canonical Runtime row must preserve the Framework producer and require the core route in every adopted shell');
  }
  assertDeepEqualJson(
    runtimeRow.allowed_action_refs,
    ['work_item_visibility_set'],
    'Runtime bridge canonical Runtime actions',
  );
  if (
    runtimeRow.fallback_policy?.allowed_fallback_source !== 'selected item from work_item_projection_v2'
    || runtimeRow.fallback_policy.allowed_when !== 'selected work item core detail only'
    || runtimeRow.fallback_policy.operator_drilldown_allowed !== false
  ) {
    throw new Error('Runtime bridge canonical Runtime fallback must remain selected-item-only');
  }
  const advancedDetail = runtimeBridge.canonical_state_display_action_map?.advanced_detail_surface;
  if (
    advancedDetail?.command !== 'opl runtime app-operator-drilldown --detail full --json'
    || advancedDetail.runtime_page_allowed !== false
  ) {
    throw new Error('Runtime bridge advanced detail must stay outside Runtime');
  }
  assertDeepEqualJson(
    advancedDetail.consumer_surfaces,
    ['/settings/environment?section=diagnostics', 'release_evidence_tooling'],
    'Runtime bridge advanced detail consumer surfaces',
  );
  if (
    packageRow?.canonical_source !==
    'opl app state --profile fast --json#app_state.agent_packages.directory.entries + app_state.agent_packages.status_index + app_state.runtime_source_carriers.items[]'
  ) {
    throw new Error('Runtime bridge package rows must use directory.entries as collection truth plus diagnostic enrichments');
  }
  assertDeepEqualJson(
    packageRow?.required_projection_fields?.['directory.entries[]'],
    runtimeBridgePackageDirectoryEntryFields,
    'Runtime bridge Package directory entry fields',
  );
  assertDeepEqualJson(
    packageRow?.required_projection_fields?.['directory.entries[].available_actions[]'],
    runtimeBridgeProjectedActionFields,
    'Runtime bridge projected Settings action fields',
  );
  assertDeepEqualJson(
    packageRow?.required_projection_fields?.['status_index.packages[package_id]'],
    ['presence', 'dependent_guard', 'capability_exposure', 'runtime_source_readiness', 'status_read_error'],
    'Runtime bridge Package diagnostic join fields',
  );
  assertDeepEqualJson(
    packageRow?.optional_enrichment_fields?.['runtime_source_carriers.items[package_id]'],
    ['source_origin', 'source_policy', 'git'],
    'Runtime bridge optional active source diagnostic fields',
  );
  if (
    packageRow?.settings_action_source !== 'app_state.agent_packages.directory.entries[].available_actions[]'
    || packageRow.action_id_allowlist_allowed !== false
    || packageRow.shell_action_inference_allowed !== false
    || Object.hasOwn(packageRow, 'allowed_action_refs')
    || Object.hasOwn(packageRow, 'framework_stage_runtime_internal_action_refs')
    || Object.hasOwn(packageRow, 'agent_package_activation_contract')
  ) {
    throw new Error('Runtime bridge Package rows must consume generic projected Settings actions without private action authority');
  }
  if (
    !packageRow?.projection_authority_policy?.includes('directory.entries owns catalog membership')
    || !packageRow.projection_authority_policy.includes('cannot override directory lifecycle, readiness, or action availability')
    || packageRow?.fallback_policy?.manageable_collection_fallback !== null
    || packageRow?.fallback_policy?.can_define_collection_membership !== false
    || packageRow?.fallback_policy?.can_define_actions !== false
    || packageRow?.fallback_policy?.canonical_directory_absent_policy !==
      'show loading, empty, last-good stale, or failed without synthesizing rows or actions'
  ) {
    throw new Error('Runtime bridge package projection must keep directory entries and actions authoritative without a fallback collection');
  }
  if (
    Object.hasOwn(packageRow?.required_projection_fields ?? {}, 'directory.installed_packages[]')
    || Object.hasOwn(packageRow?.optional_enrichment_fields ?? {}, 'status_index.packages[package_id]')
  ) {
    throw new Error('Runtime bridge package projection must not retain installed_packages or demote canonical status-index diagnostics to optional legacy enrichment');
  }
}

function validateNativeMinimumProductBridge(runtimeBridge) {
  const launch = runtimeBridge.native_minimum_product_bridge?.agent_conversation_launch;
  if (launch?.catalog_source !== 'app_state.agent_packages.directory.entries') {
    throw new Error('Native Agent launch catalog must read the raw Framework directory before applying App membership');
  }
  assertDeepEqualJson(
    launch?.opl_standard_agent_membership_policy,
    appOwnedOplStandardAgentMembershipPolicy,
    'Native standard Agent membership policy',
  );
}

function validateRuntimeSurfaceOwnerMatrix(runtimeBridge) {
  const matrix = runtimeBridge.runtime_surface_owner_matrix;
  for (const [field, expected] of Object.entries({
    purpose: 'keep_runtime_resource_task_data_lifecycle_refs_single_sourced',
    app_policy_owner: 'one-person-lab-app',
    family_projection_owner: 'one-person-lab',
    active_shell_role: 'thin_renderer_consumer',
    distribution_mirror_role: 'release_transport_only',
  })) {
    if (matrix?.[field] !== expected) {
      throw new Error(`Runtime surface owner matrix ${field} must be ${expected}`);
    }
  }
  const rows = matrix?.surface_rows;
  if (!Array.isArray(rows) || rows.length !== 5) {
    throw new Error('Runtime surface owner matrix must declare five surface rows');
  }
  const rowBySurface = new Map(rows.map((row) => [row?.surface, row]));
  for (const [surface, owner] of Object.entries({
    'OPL Runtime Fabric': 'one-person-lab-app',
    'Environment Materializer': 'one-person-lab',
    'TaskRunProjection v2': 'one-person-lab',
    'OPL Fabric resource refs': 'one-person-lab',
    'Local data lifecycle': 'one-person-lab-app',
  })) {
    const row = rowBySurface.get(surface);
    if (row?.source_owner !== owner) {
      throw new Error(`Runtime surface owner matrix ${surface} source_owner must be ${owner}`);
    }
    if (typeof row?.producer_owner !== 'string' || !row.producer_owner) {
      throw new Error(`Runtime surface owner matrix ${surface} must declare producer_owner`);
    }
    if (!Array.isArray(row?.forbidden_second_truth) || row.forbidden_second_truth.length === 0) {
      throw new Error(`Runtime surface owner matrix ${surface} must declare forbidden_second_truth`);
    }
  }
  if (!matrix?.homebrew_policy?.includes('must not decide runtime, task, resource, data lifecycle')) {
    throw new Error('Runtime surface owner matrix must keep Homebrew as release transport only');
  }
  for (const forbidden of [
    'second_resource_state_machine',
    'shell_owned_task_queue',
    'app_owned_domain_receipts',
    'homebrew_currentness_gate',
    'health_platform_runtime_authority',
  ]) {
    if (!matrix?.must_not_add_layers?.includes(forbidden)) {
      throw new Error(`Runtime surface owner matrix must forbid ${forbidden}`);
    }
  }
}

function validateRuntimeBridgeAuthorityBoundary(runtimeBridge) {
  for (const [field, expected] of Object.entries({
    shell_adapter_can_own_runtime_truth: false,
    app_can_own_runtime_truth: false,
    app_can_write_domain_truth: false,
    app_can_read_artifact_body: false,
    app_can_read_memory_body: false,
    app_can_authorize_quality_verdict: false,
    app_can_authorize_export_verdict: false,
    app_can_write_sqlite_sidecar: false,
    app_can_mutate_state_index_kernel: false,
    app_can_write_owner_receipt: false,
    app_can_authorize_readiness: false,
    app_can_authorize_artifact_authority: false,
    provider_completion_is_domain_ready: false,
  })) {
    if (runtimeBridge.authority_boundary?.[field] !== expected) {
      throw new Error(`Runtime bridge authority_boundary.${field} must be ${expected}`);
    }
  }
}

function validateRuntimeBridgeReplacementPolicy(runtimeBridge) {
  for (const [field, expected] of Object.entries({
    runtime_protocol_stable_across_shell_replacement: true,
    shell_adapter_must_call_declared_opl_cli_surfaces: true,
    new_shell_adapter_must_pass_active_shell_validation: true,
    direct_domain_repo_reads_are_forbidden: true,
    direct_runtime_state_file_reads_are_forbidden: true,
    direct_sqlite_sidecar_reads_are_forbidden: true,
    direct_state_index_kernel_writes_are_forbidden: true,
  })) {
    if (runtimeBridge.replacement_policy?.[field] !== expected) {
      throw new Error(`Runtime bridge replacement_policy.${field} must be ${expected}`);
    }
  }
}

function validateRuntimeBridgeForbiddenTruthSources(runtimeBridge) {
  for (const forbidden of [
    'direct_domain_repo_reads',
    'direct_runtime_state_file_reads',
    'direct_opl_internal_state_file_reads',
    'direct_opl_sqlite_sidecar_reads',
    'direct_state_index_kernel_file_reads',
    'direct_state_index_kernel_writes',
    'domain_artifact_body_reads',
    'domain_memory_body_reads',
    'shell_private_runtime_status',
    'shell_local_storage_work_item_visibility',
  ]) {
    if (!runtimeBridge.forbidden_truth_sources?.includes(forbidden)) {
      throw new Error(`Runtime bridge must forbid ${forbidden}`);
    }
  }
}

export function validateRuntimeBridgeContract(runtimeBridge, contract) {
  validateRuntimeBridgeIdentity(runtimeBridge, contract);
  validateRuntimeBridgeDeclaredSurfaces(runtimeBridge);
  validateOplGatewayAccountContract(runtimeBridge);
  validateRuntimeBridgeDefaultReadSurfacePolicy(runtimeBridge);
  validateRuntimeBridgeCommandResolutionPolicy(runtimeBridge);
  validateSharedGuiRuntimeResolutionPolicy(runtimeBridge);
  validateCanonicalConversationContinuityPolicy(runtimeBridge);
  validateCodexParityAdapterPolicies(runtimeBridge);
  validateRuntimeBridgeProjectionContracts(runtimeBridge);
  validatePackageReadinessProjection(runtimeBridge);
  validateNativeMinimumProductBridge(runtimeBridge);
  validateRuntimeBridgeUserTaskStatus(runtimeBridge);
  validateRuntimeSurfaceOwnerMatrix(runtimeBridge);
  validateRuntimeBridgeAuthorityBoundary(runtimeBridge);
  validateRuntimeBridgeReplacementPolicy(runtimeBridge);
  validateRuntimeBridgeForbiddenTruthSources(runtimeBridge);
  validateLiveConformanceContract(runtimeBridge.live_conformance_gate);
}

export {
  validateLiveOplConformance,
  validateOplAppStateFastAgentPackageDirectoryFixture,
  validateOplGatewayAccountContract,
};
