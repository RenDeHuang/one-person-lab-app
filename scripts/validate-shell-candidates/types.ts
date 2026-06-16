export type ValidationCommand = {
  id: string;
  cwd: string;
  command: string;
};

export type ActiveProjectLineStateModel = {
  authority: string;
  validation_command: string;
  consumed_projection: string;
  required_fields: string[];
  forbidden_claims: string[];
};

export type ShellCandidate = {
  id: string;
  state: string;
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
  priority?: string;
  required_replacements?: string[];
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
