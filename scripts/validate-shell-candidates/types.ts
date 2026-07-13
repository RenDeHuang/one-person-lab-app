import type {
  FirstRunContract,
  HermesTargetStateContract,
  IconContract,
  ValidationCommand,
} from '../app-shell-adapter.ts';

export type { ValidationCommand };

export type ActiveProjectLineStateModel = {
  authority: string;
  validation_command: string;
  consumed_projection: string;
  required_fields: string[];
  forbidden_claims: string[];
};

export type NativeLocalP0P1ImplementationEvidence = {
  status: string;
  observed_at: string;
  app_product_authority_sha: string;
  native_source_sha: string;
  native_source_ref: string;
  codex_cli_version: string;
  fixed_cohort: boolean;
  source_and_package_gates: Record<string, unknown>;
  dynamic_tools_live: Record<string, unknown>;
  coordination_live: Record<string, unknown>;
  packaged_native_live: Record<string, unknown>;
  claim_boundary: Record<string, unknown>;
};

export type NativeCrossTopLevelThreadAuthority = {
  authority_model: string;
  implementation_status: string;
  local_p0_p1_implementation_evidence: NativeLocalP0P1ImplementationEvidence;
  product_role: string;
  entry_surface: string;
  default_state: string;
  model_role: string;
  protocol_owner: string;
  app_host_owner: string;
  coordination_owner: string;
  renderer_role: string;
  thread_store_owner: string;
  thread_id_policy: string;
  authority_layers: Record<string, Record<string, unknown>>;
  typed_host_bridge: {
    required: boolean;
    transport_contract: string;
    renderer_direct_app_server_json_rpc_forbidden: boolean;
    shell_owned_thread_store_forbidden: boolean;
    shell_owned_permission_model_forbidden: boolean;
    required_protocol_methods: string[];
    required_status_event: string;
    optional_relationship_fields_policy: string;
    host_owned_minimal_coordination_ledger: Record<string, unknown>;
  };
  p1_model_tool_bridge: {
    current_transport: string;
    bridge_must_reuse_typed_host_gate: boolean;
    direct_app_server_or_ledger_bypass_forbidden: boolean;
    required_high_level_tools: string[];
    tool_calls_must_apply_same_safety_gates_and_receipts_as_gui: boolean;
    codex_cli_schema_observation: Record<string, unknown>;
    ephemeral_live_probe_observation: Record<string, unknown>;
    schema_drift_record_required: boolean;
    runtime_capability_probe_required: boolean;
    probe_policy: string;
    fallback_policy: string;
    fallback_must_not_claim_p1_model_tool_ready: boolean;
  };
  local_p0_p1_acceptance: {
    scope: string;
    thread_directory: Record<string, unknown>;
    lifecycle_actions: string[];
    dispatch_policy: Record<string, unknown>;
    safety_gates: string[];
    bilateral_receipt: Record<string, unknown>;
    required_typed_failure_states: string[];
    user_visibility_policy: string;
    forbidden_implementations: string[];
  };
  desktop_webui_parity: Record<string, unknown>;
  remote_p2: Record<string, unknown>;
  false_ready_boundary: Record<string, unknown>;
};

export type ShellCandidate = HermesTargetStateContract & {
  id: string;
  state: string;
  archived_reason?: string;
  default_update_policy?: string;
  candidate_root: string;
  adapter_contract: string;
  source_topology: string;
  release_participation: string;
  implementation_basis: string[];
  source_upstream?: {
    repo: string;
    app_path: string;
    license: string;
  };
  foreground_alternative_role?: string;
  required_replacements?: string[];
  architecture_policy?: {
    baseline_order: string[];
    minimal_delta: string[];
    extension_points: Record<string, string>;
    ordinary_user_experience: string;
    webui_strategy: string;
  };
  checkout_policy?: {
    primary_path: string;
    accepted_alternate_path: string;
    missing_checkout_status: string;
  };
  build_wrapper?: {
    adapter_contract: string;
    app_root_command: string;
    missing_checkout_blocker_allowed: boolean;
  };
  candidate_stage?: string;
  local_p0_p1_implementation_evidence?: NativeLocalP0P1ImplementationEvidence;
  first_run_contract?: FirstRunContract;
  icon_contract?: IconContract;
  deferred_until_feature_comparison?: string[];
  codex_app_like_chat_target?: {
    scope: string;
    primary_user_flow: string;
    capability_inventory: string[];
  };
  ai_first_interaction_model?: {
    default_visual_basis: string;
    primary_policy: string;
    right_context_policy: string;
    mas_autonomy_policy: string;
    open_science_adoption: string[];
    must_not: string[];
  };
  webui_transport?: {
    shared_renderer: boolean;
    electron_surface: string;
    web_surface: string;
    web_bridge: string;
    event_stream: string;
    gateway: string;
    native_picker_policy: string;
  };
  pilotdeck_information_architecture_target?: {
    source_usage: string;
    license: string;
    copied_source_allowed: boolean;
    runtime_authority_transfer_allowed: boolean;
    required_surfaces: string[];
    required_testids: string[];
  };
  target_product_shape: {
    codex_cli_fixed_executor: boolean;
    home_executor_selector_visible: boolean;
    home_backend_selector_visible: boolean;
    home_model_selector_visible: boolean;
    permission_mode_selector_visible: boolean;
    workspace_session_rail_default_visible: boolean;
    inspector_default_visible: boolean;
    default_visual_basis?: string;
    right_context_user_request_only?: boolean;
    co_scientist_split_screen_default?: boolean;
    mas_autonomous_research_default?: boolean;
    purpose_entries: string[];
    runtime_page_policy: string;
    settings_policy: string;
  };
  technical_verification?: {
    app_root_commands?: ValidationCommand[];
    candidate_shell_commands?: ValidationCommand[];
    manual_verification_commands?: ValidationCommand[];
    minimum_acceptance?: string[];
  };
  framework_surfaces: Record<string, string>;
  active_project_line_state_model?: ActiveProjectLineStateModel;
  foundry_agent_series_display_contract?: {
    authority: string;
    display_policy: string;
    required_shared_progress_fields: string[];
    forbidden_domain_fields: string[];
  };
  required_capabilities: string[];
  must_not_own: string[];
  forbidden_home_controls: string[];
  validation_commands: ValidationCommand[];
  non_goals: string[];
};

export type ShellCandidateRegistry = {
  schema_version: number;
  owner: string;
  purpose: string;
  state: string;
  active_shell_unchanged: string;
  active_gui_mainline?: {
    shell: string;
    shell_root: string;
    source_repo: string;
    role: string;
    product_truth_owner: string;
  };
  alternative_gui_policy?: {
    only_foreground_alternative: string;
    basis: string;
    default_candidate_validation_scope: string[];
    reference_only_candidates?: string[];
    reference_candidate_policy?: string;
    archived_technical_proofs: string[];
    archived_proof_policy: string;
    active_shell_switch_policy: string;
  };
  interactive_launcher_policy: {
    state: string;
    topology: string;
    selectable_shells: string[];
    selection_scope: string;
    default_target_source: string;
    target_interface: string;
    target_command: string;
    release_adoption_contract: string;
    selection_mutates_release_adoption: boolean;
    candidate_launch_implies_adoption: boolean;
    selection_changes_updater_channel: boolean;
    side_by_side_bundle_identity_required: boolean;
    simultaneous_same_workspace_write_safety_claimed: boolean;
    concurrent_mainline_policy: string;
    candidate_default_mutation_policy: string;
    missing_target_policy: string;
    implementation_status: string;
    launch_profiles: Record<string, {
      adapter_contract: string;
      default_mode: string;
      supported_modes: string[];
      bundle_id: string;
      packaged_app_path?: string;
      bundle_relative_path?: string;
      dev_command?: string[];
      package_command?: string[];
    }>;
  };
  release_shell_contract: string;
  gui_product_contract: string;
  runtime_bridge_contract: string;
  product_profile_contract: string;
  page_state_matrix: string;
  first_run_matrix: string;
  candidate_policy: {
    candidate_root_pattern: string;
    candidate_state: string;
    release_participation_until_adopted: string;
    authority_transfer_allowed: boolean;
    release_scripts_must_use_active_shell_adapter: boolean;
    candidate_validation_script: string;
    adoption_gate: string[];
    default_validation_scope?: string;
    archived_technical_proof_policy?: string;
    no_resurrection_policy?: {
      policy_id: string;
      default_validation_scope_must_exclude_archived_proofs: boolean;
      candidate_label_does_not_imply_foreground_status: boolean;
      archived_proof_update_requires_explicit_user_request: boolean;
      archived_proof_release_participation: string;
      archived_proof_must_not_appear_in_adoption_gate: boolean;
      foreground_adoption_gate_must_be_shell_agnostic: boolean;
      active_shell_switch_contract: string;
      forbidden_default_routes: string[];
    };
  };
  design_reference_policy?: {
    purpose: string;
    source_code_use: string;
    runtime_authority_transfer_allowed: boolean;
    license_gate_required_before_code_reuse: boolean;
    candidate_promotion_route: string;
  };
  design_references?: Array<{
    id: string;
    source_repo: string;
    evaluated_ref: string;
    evaluated_at: string;
    license: string;
    source_usage: string;
    reference_value: string[];
    opl_mapping: string[];
    forbidden_reuse: string[];
  }>;
  candidates: ShellCandidate[];
};
