export type AppProductProfile = {
  schema_version: number;
  owner: string;
  purpose: string;
  state: string;
  machine_boundary: string;
  app_repo: string;
  product: {
    id: string;
    display_name: string;
    primary_surface: string;
    supported_release_platforms: string[];
  };
  contract_refs: Record<string, string>;
  default_session_profile: {
    provider: string;
    base_url: string;
    executor: string;
    model: string;
    reasoning_effort: string;
    applies_after: string;
    authority: string;
  };
  gui: {
    authority: string;
    implementation_carrier: string;
    appearance: {
      default_css_theme_id: string;
      default_css_theme_name: string;
      codex_theme_default_enabled: boolean;
    };
    home: {
      primary_input_surface: string;
      nested_input_card_frames_allowed: boolean;
      codex_cli_fixed_executor: boolean;
      home_executor_selector_visible: boolean;
      codex_model_selector_visible: boolean;
      codex_model_list_visible: boolean;
      codex_model_policy: string;
      codex_model_auto_option_visible: boolean;
      codex_default_model: string;
      codex_default_reasoning_effort: string;
      codex_default_permission_mode: string;
      permission_mode_selector_visible: boolean;
      conversation_backend_selector_visible: boolean;
      conversation_model_selector_visible: boolean;
      conversation_permission_mode_selector_visible: boolean;
      codex_home_model_status_label: string;
      codex_home_model_status_label_en: string;
      codex_precise_model_display_policy: string;
      codex_auto_model_selection: {
        strategy: string;
        model_list_source: string;
        frontier_model_preference_order_role: string;
        user_can_override_model: boolean;
        user_can_override_reasoning_effort: boolean;
        user_can_restore_auto: boolean;
        selection_persists_into_conversation: boolean;
        frontier_model_preference_order: string[];
      };
      codex_model_display_options: {
        display_policy: string;
        button_label_policy: string;
        raw_model_id_visible_in_ordinary_ui: boolean;
        reasoning_effort_visible_for_every_option: boolean;
        reasoning_effort_menu_visible: boolean;
        reasoning_menu_title_zh: string;
        reasoning_menu_title_en: string;
        reasoning_effort_override_surface: string;
        reasoning_effort_options_source: string;
        default_reasoning_effort: string;
        auto_option_current_resolution_visible: boolean;
        model_menu_policy: string;
        intelligence_enhancement_menu_policy: string;
        intelligence_enhancement_default_enabled: boolean;
        auto_option: {
          id: string;
          label_zh: string;
          label_en: string;
          description_zh: string;
          description_en: string;
          resolved_model: string;
          resolved_model_label_zh: string;
          resolved_model_label_en: string;
          resolved_reasoning_effort: string;
          follows_latest_strongest: boolean;
        };
        fixed_model_description_zh: string;
        fixed_model_description_en: string;
        reasoning_labels: Record<string, { zh: string; en: string }>;
        user_reasoning_effort_options: string[];
        visible_models: Array<{
          id: string;
          label_zh: string;
          label_en: string;
        }>;
      };
      home_purpose_entries: Array<{
        id: string;
        primary_label: string;
        target_assistant_id: string;
        target_assistant_short_name: string;
        display_policy: string;
        home_entry_policy: string;
      }>;
      home_agent_shortcuts: Array<{
        shortcut_id: string;
        package_id: string;
        primary_label: string;
        package_short_name: string;
        codex_visible_entry: string;
        required_skill_ids: string[];
        source: string;
        executor: string;
        display_policy: string;
        home_entry_policy: string;
        default_visible: boolean;
        user_configurable: boolean;
      }>;
      retired_codex_models_must_not_be_exposed: string[];
      activity_center_policy: {
        source: string;
        authority: string;
        role: string;
        default_placement: string;
        home_surface_policy: string;
        allowed_home_runtime_context: string[];
        must_not_display: string[];
        footer_quick_actions_policy: string;
      };
    };
    agent_package_invocation_receipt_policy: {
      scope: string;
      required_for_package_shortcuts: string[];
      route_kind: string;
      executor: string;
      source: string;
      required_fields: string[];
      receipt_authority: string;
      must_not_govern: string[];
      must_not_depend_on_visible_backend_selection: boolean;
    };
    builtin_assistant_route_receipt_policy: {
      migration_alias_for: string;
      scope: string;
      required_for_assistants: string[];
      route_kind: string;
      executor: string;
      source: string;
      required_fields: string[];
      must_not_depend_on_visible_backend_selection: boolean;
    };
    ordinary_capability_selector_policy: {
      scope: string;
      authority: string;
      skill_source_ref: string;
      skill_menu_policy: string;
      conversation_loaded_skill_display_policy: string;
      package_skill_source_ref?: string;
      mcp_server_source_ref: string;
      mcp_menu_policy: string;
      visible_mcp_server_ids: string[];
      conversation_loaded_mcp_display_policy: string;
      forbidden_skill_examples: string[];
      forbidden_mcp_policy: string;
      forbidden_mcp_examples: string[];
      conversation_snapshot_policy: string;
      forbidden_mcp_matchers: {
        exact: string[];
        prefixes: string[];
        contains: string[];
      };
      scrub_extra_keys: string[];
      required_scrub_targets: string[];
    };
    professional_agent_packages: Array<{
      package_id: string;
      display_name: string;
      short_name: string;
      role: string;
      package_kind: string;
      installed_manageable: boolean;
      default_home_visible: boolean;
      codex_visible_entry: string;
      home_shortcut_ids: string[];
      required_skill_ids: string[];
      optional_skill_ids: string[];
      required_skill_policy: string;
      optional_skill_policy: string;
      skill_menu_policy: string;
    }>;
    default_assistants: Array<{
      id: string;
      display_name: string;
      short_name: string;
      home_purpose_label: string;
      home_entry_display_policy: string;
      role: string;
      home_entry_policy: string;
      avatar: string;
      description_i18n: Record<string, string>;
      prompts_i18n: Record<string, string[]>;
    }>;
    assistant_skill_profiles: Array<{
      assistant_id: string;
      required_skills: string[];
      optional_skills: string[];
      required_skill_policy: string;
      optional_skill_policy: string;
      skill_menu_policy: string;
    }>;
    non_default_assistants: Array<{
      id: string;
      display_name: string;
      short_name: string;
      role: string;
      home_entry_policy: string;
      home_default_visible: boolean;
      avatar: string;
      description_i18n: Record<string, string>;
      prompts_i18n: Record<string, string[]>;
    }>;
  };
  codex: {
    default_model: string;
    default_model_description: string;
    default_reasoning_effort: string;
    opl_flow_context: {
      flow_id: string;
      source: string;
      delivery: string;
      user_agents_policy: string;
      language_policy: string;
      optional_user_modes?: {
        intelligence_enhancement?: {
          id: string;
          settings_key: string;
          label_key: string;
          description_key: string;
          provider: string;
          local_proxy_base_url: string;
          upstream_policy: string;
          behavior_policy: string;
          service_policy: string;
          required_opl_package_id: string;
          required_opl_package_kind: string;
          required_opl_package_preflight_actions: string[];
          required_opl_package_install_command: string;
          profile_mutation_policy: string;
          default_enabled: boolean;
          status_action_id: string;
          enable_action_id: string;
          disable_action_id: string;
          repair_action_id: string;
          uninstall_action_id: string;
        };
      };
    };
    default_visible_skills: string[];
    skill_priority: string[];
    session_context_lines: string[];
    session_context_i18n?: Record<'zh-CN' | 'en-US', string[]>;
  };
  first_run: {
    readiness_layers: string[];
    ready_to_launch_gate: {
      id: string;
      ui_order: string;
      guid_navigation_blocking: boolean;
      required_core_items: string[];
      must_not_require: string[];
    };
    full_readiness_layers: string[];
    deferred_blockers: string[];
    runtime_provider: {
      full_readiness_provider: string;
      ready_to_launch_blocking: boolean;
    };
    first_conversation: {
      gate: string;
      source_command: string;
      ready_to_launch_must_be_true: boolean;
      must_wait_for: string[];
      must_not_wait_for: string[];
      failure_policy: string;
    };
    progress_model: {
      source_command: string;
      source_path: string;
      renderer_truth_policy: string;
      required_setup_flow_fields: string[];
      required_progress_fields: string[];
      required_checklist_fields: string[];
      required_visible_elements: string[];
    };
    command_line_tools: {
      auto_request_installer: boolean;
      blocks_full_first_launch: boolean;
      messages: string[];
    };
    beginner_presentation: {
      audience: string;
      presentation_mode: string;
      primary_user_goal: string;
      primary_steps: string[];
      primary_progress_signal: string;
      advanced_progress_disclosure: string;
      background_maintenance_presentation: string;
      technical_detail_policy: string;
      layout_mode: string;
      ordinary_navigation_policy: string;
      step_navigation_policy: string;
      current_task_policy: string;
      current_task_selection_policy: string;
      progress_display_policy: string;
      model_access_choice_policy: string;
      model_access_inflight_policy: string;
      completion_transition_policy: string;
      completion_navigation_policy: string;
      defer_navigation_policy: string;
      technical_detail_navigation_policy: string;
      request_exclusivity_policy: string;
      pending_state_policy: string;
      core_readiness_status_policy: string;
      minimum_window_primary_action_policy: string;
      background_shell_interaction_policy: string;
      window_control_policy: string;
      raw_error_policy: string;
      secret_diagnostic_policy: string;
      accessible_name_policy: string;
      post_install_ai_self_check_entry: {
        trigger: string;
        target_route: string;
        route_state: string;
        prompt_policy: string;
        target_state_checks: string[];
        mutation_policy: string;
        release_gate_policy: string;
      };
    };
  };
  settings: {
    visible_tabs: string[];
    legacy_route_redirects: Record<string, string>;
    control_plane?: {
      source_contract_ref: string;
      default_route: string;
      route_identity_policy: string;
      ordinary_visible_tabs: string[];
      ordinary_routes: Array<{
        id: string;
        path: string;
        label_key: string;
        default_label_en: string;
        default_label_zh: string;
        icon_token: string;
        ia_group: string;
        slot_id: string;
        state_source: string;
        refresh_source: string;
      }>;
      secondary_pages: Array<{
        id: string;
        path: string;
        ia_group: string;
        slot_id: string;
        visibility: string;
      }>;
      legacy_route_redirects: Record<string, string>;
      extension_anchor_remap: Record<string, string>;
      extension_tab_policy: Record<string, unknown>;
      slot_registry: Record<string, {
        component_key: string;
        wrapper_policy: string;
        subroute_query_param?: string;
        legacy_subroutes?: Record<string, string>;
      }>;
      state_action_policy: Record<string, unknown>;
    };
    settings_information_architecture?: Record<string, {
      label_zh: string;
      label_en: string;
      role: string;
      primary_question: string;
    }>;
    environment_items: string[];
    developer_profile: {
      label_key: string;
      description_key: string;
      hide_machine_status: boolean;
      source: string;
      default_profile: string;
      opt_in_policy: string;
      capability_axes: string[];
      capabilities: Record<string, {
        standard_default: string;
        developer_opt_in: string;
        display_policy: string;
      }>;
      state_keys: Record<string, string>;
    };
  };
  companion_payloads: {
    install_exposure_policy_ref: string;
    exposure_classes_ref: string;
    public_abi: {
      primary_semantic_entry: string;
      preferred_app_distribution: string;
      plugin_must_not_create_second_semantics: boolean;
      cli_and_app_share_skill_semantics: boolean;
    };
    tools: string[];
    domain_modules: string[];
    default_packaged_codex_skill_ids: string[];
    packaged_not_default_visible_codex_skill_ids: string[];
    companion_skill_sync_default_ids: string[];
    domain_plugin_skill_ids: string[];
    domain_plugin_skills_must_not_be_companion_mirrors: boolean;
    domain_exposure: Array<{
      domain_id: string;
      codex_visible_entry: string;
      preferred_app_distribution: string;
      direct_skill_semantics_required: boolean;
    }>;
  };
  boundary: {
    app_owns: string[];
    app_consumes: string[];
    app_does_not_own: string[];
  };
};
