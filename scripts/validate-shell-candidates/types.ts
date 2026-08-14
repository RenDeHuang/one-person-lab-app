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

export type NativeThreadAdapterBoundary = {
  source_ref: string;
  adapter: string;
  protocol_owner: string;
  thread_store_owner: string;
  user_initiated_only: boolean;
  supported_protocols: string[];
  codex_subagent_projection: {
    mode: string;
    thread_source_kinds: string[];
    thread_item_types: string[];
    metadata_fields: string[];
  };
  private_coordination_layer_allowed: boolean;
};

export type NativeP1BaselineBridge = {
  contract_ref: string;
  agent_launch_transport: string;
  active_turn_transport: string;
  gateway_projection_ref: string;
  gateway_secret_bridge_ref: string;
  package_action_source: string;
  managed_update_ref: string;
  app_updater_ref: string;
  required_host_capabilities: string[];
  shell_owned_action_bus_allowed: boolean;
  shell_owned_package_registry_allowed: boolean;
  shell_owned_persistent_queue_allowed: boolean;
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
  minimum_complete_contract_ref?: string;
  maintenance_policy?: {
    mode: string;
    automatic_or_scheduled_work_allowed: boolean;
    product_development_required: boolean;
    current_mainline: boolean;
    minimum_complete_product_obligation: boolean;
    aionui_feature_parity_obligation: boolean;
    release_blocking: boolean;
  };
  runtime_dependency_policy?: {
    aioncore_required: boolean;
    aionui_required: boolean;
    codex_app_server_source: string;
    opl_integration: string;
    multi_backend_abstraction_required: boolean;
    thread_store_owner: string;
    forbidden_dependencies: string[];
  };
  p1_baseline_contract?: {
    runtime_bridge_ref: string;
    adapter_binding_ref: string;
    required_user_outcomes: string[];
    forbidden_parallel_control_planes: string[];
  };
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
    on_demand_context_policy: string[];
    must_not: string[];
  };
  webui_transport?: {
    shared_renderer: boolean;
    native_surface: string;
    web_surface: string;
    web_bridge: string;
    event_stream: string;
    gateway: string;
    native_picker_policy: string;
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
    left_rail_items: string[];
    right_context_modules: string[];
    right_context_default: string;
    runtime_status_sources: string[];
    runtime_detail_slot: string;
    files_input_policy: string;
    results_policy: string;
    package_lifecycle_surface: string;
    product_identity: {
      visible_text: string[];
      logo_visible: boolean;
      bundle_icon_allowed: boolean;
    };
    purpose_entries: string[];
    runtime_page_policy?: string;
    settings_policy: string;
    account_footer_policy?: {
      source_ref: string;
      projection_path: string;
      connected_identity_source: string;
      connected_visibility: string;
      connected_statuses: string[];
      connected_secondary_label: string;
      fallback_display_name: string;
      fallback_secondary_label: string;
      interaction: string;
      forbidden_identity_sources: string[];
    };
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

export type ShellCandidateRoleTombstone = {
  id: string;
  state: 'archived_technical_proof';
  archived_reason?: string;
  default_update_policy?: string;
  candidate_root: string;
  adapter_contract: string;
  source_topology: 'external_checkout_linked_shell_repo';
  release_participation: 'explicit_user_requested_technical_replay_only';
  role_tombstone: true;
  checkout_policy?: {
    primary_path: string;
    accepted_alternate_path: string;
    missing_checkout_status: string;
  };
  replay: {
    mode: 'explicit_user_request_only';
    validator_command: string;
    runbook_ref: string;
    source_checkout_policy: 'optional_until_explicit_replay';
  };
};

export type ShellCandidateEntry = ShellCandidate | ShellCandidateRoleTombstone;

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
    explicit_candidate_validation_scope: string[];
    archived_technical_proofs: string[];
    archived_proof_policy: string;
    archived_proof_execution_policy: {
      scope: string;
      trigger: string;
      automatic_build_allowed: boolean;
      default_validation_includes_build: boolean;
      release_channel_participation: string[];
      candidate_command_chain_opt_in: string;
      forbidden_automatic_triggers: string[];
    };
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
    default_validation_contract?: string;
    archived_technical_proof_policy?: string;
    role_tombstone_contract?: {
      applies_to_states: string[];
      required_fields: string[];
      detail_owner: string;
      forbidden_detailed_fields: string[];
    };
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
    evaluated_version?: string;
    license: string;
    source_usage: string;
    adopted_packages?: Record<string, string>;
    adopted_source?: {
      root: string;
      ref: string;
      path_policy?: string;
      byte_policy?: string;
      package_roots?: string[];
      files: string[];
    };
    adopted_surface?: string[];
    upstream_intake?: {
      mode: string;
      vendor_source_policy: string;
      opl_delta_policy: string;
      update_policy: string;
      floating_ref_allowed: boolean;
      automatic_promotion_allowed: boolean;
      stop_condition: string;
    };
    reference_value: string[];
    opl_mapping: string[];
    forbidden_reuse: string[];
  }>;
  candidates: ShellCandidateEntry[];
};
