export type ValidationCommand = {
  id: string;
  cwd: string;
  command: string;
  optional?: boolean;
};

export type ActiveProjectLineStateModel = {
  authority: string;
  validation_command: string;
  consumed_projection: string;
  required_fields: string[];
  forbidden_claims: string[];
};

export type HermesAppServerAdapterContract = {
  owner: string;
  gateway_route: string;
  ordinary_chat_route: string;
  required_events: string[];
  forbidden_backends: string[];
};

export type HermesModelAccessPolicy = {
  ordinary_provider: string;
  api_key_env: string;
  provider_base_url: string;
  default_model: string;
  reasoning_effort: string;
  ordinary_ui_surfaces: string[];
  forbidden_ordinary_controls: string[];
};

export type HermesAgentRouteContract = {
  owner: string;
  route_authority: string;
  ordinary_entries: Array<{
    id: string;
    label: string;
    route: string;
    authority: string;
  }>;
  required_surface: string;
  forbidden_claims: string[];
};

export type HermesSettingsInformationArchitecture = {
  ordinary_tabs: string[];
  opl_semantics: string[];
  hidden_or_advanced: string[];
  ordinary_access_policy: string;
};

export type HermesVisualParityContract = {
  comparison_baseline: string;
  minimum_bar: string;
  required_evidence: string[];
  docs_or_contract_only_completion_allowed: boolean;
};

export type ShellCandidate = {
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
  app_server_adapter_contract?: HermesAppServerAdapterContract;
  model_access_policy?: HermesModelAccessPolicy;
  agent_route_contract?: HermesAgentRouteContract;
  settings_information_architecture?: HermesSettingsInformationArchitecture;
  visual_parity_contract?: HermesVisualParityContract;
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
  first_run_contract?: {
    owner: string;
    ui_reuse_policy: string;
    forbidden_default_action: string;
    startup_model: string;
    startup_check_sequence: string[];
    one_time_initialization_trigger: string[];
    one_time_initialization_sequence: string[];
    model_access_wizard: {
      trigger: string;
      api_key_provider: string;
      api_key_command: string;
      provider_base_url: string;
      default_model: string;
      api_key_env: string;
      ordinary_ui_policy: string;
    };
    background_refresh_sequence: string[];
    blocking_policy: string;
    skip_to_chat_policy?: {
      trigger: string;
      marker_state: string;
      must_not_claim: string[];
    };
    api_key_missing_behavior: string;
    api_key_present_behavior: string;
    ready_check: string;
    packaged_smoke_must_prove: string[];
  };
  icon_contract?: {
    source: string;
    macos_safe_margin_required: boolean;
    max_alpha_bounds_px: number;
    current_expected_alpha_bounds_px: string;
    applies_to: string[];
  };
  deferred_until_feature_comparison?: string[];
  codex_app_like_chat_target?: {
    scope: string;
    primary_user_flow: string;
    capability_inventory: string[];
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
    archived_technical_proofs: string[];
    archived_proof_policy: string;
    active_shell_switch_policy: string;
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
