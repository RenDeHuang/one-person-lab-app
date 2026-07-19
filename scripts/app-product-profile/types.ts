export type AppProductProfile = {
  schema_version: 2;
  owner: string;
  purpose: string;
  state: string;
  machine_boundary: string;
  app_repo: string;
  product: {
    id: string;
    display_name: string;
    ordinary_chrome_name: string;
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
    ui_locale_policy: {
      explicit_user_preference: string;
      first_launch_without_preference: string;
      supported_normalization: string;
      startup_must_not_overwrite_explicit_preference: boolean;
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
      home_composer_state_contract: {
        contract_id: 'opl_home_composer_state.v1';
        executor: 'codex';
        shortcut_package_ids: Array<string | null>;
        viewports: string[];
        availability_states: string[];
        invariants: {
          model_reasoning_visible: boolean;
          permission_access_visible: boolean;
          executor_selector_visible: boolean;
          active_shortcut_changes_executor: boolean;
          default_visibility_governs_execution: boolean;
          single_home_root: boolean;
          single_composer_shell: boolean;
          single_footer_account_settings_entry: boolean;
        };
        semantic_probe: {
          root_test_id: string;
          instance_counts: Record<string, number>;
          instance_count_groups: Record<string, { test_ids: string[]; total: number }>;
          state_attributes: Record<string, string>;
          desktop_required_controls: string[];
          mobile_required_controls: string[];
          forbidden_controls: string[];
          failure_field: string;
        };
      };
      conversation_backend_selector_visible: boolean;
      conversation_model_selector_visible: boolean;
      conversation_permission_mode_selector_visible: boolean;
      codex_home_model_status_label: string;
      codex_home_model_status_label_en: string;
      codex_precise_model_display_policy: string;
      codex_auto_model_selection: {
        policy_source_ref: string;
        user_can_override_model: boolean;
        user_can_override_reasoning_effort: boolean;
        user_can_restore_auto: boolean;
        selection_persists_into_conversation: boolean;
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
        auto_option: {
          id: string;
          label_zh: string;
          label_en: string;
          description_zh: string;
          description_en: string;
          catalog_unavailable_fallback_model: string;
          catalog_unavailable_fallback_reasoning_effort: string;
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
      home_layout: {
        default_mode: string;
        default_active_shortcut: null;
        shortcut_selection_policy: string;
        first_screen_policy: string;
        composer_position: string;
        composer_primary: boolean;
        workspace_selector_visible: boolean;
        workspace_selector_entry: string;
        unselected_workspace_control_visible: boolean;
        unselected_workspace_control_policy: string;
        purpose_entries_visible: string[];
        purpose_entry_placement: string;
        dynamic_question_title: boolean;
        starter_limit: number | null;
        starter_visibility_policy: string;
        starter_order_policy: string;
        starter_layout_policy: string;
        starter_item_width_policy: string;
        starter_count_layout_policy: string;
        desktop_composer_max_width_px: number;
        desktop_composer_min_height_px: number;
        desktop_composer_corner_radius_px: number;
        desktop_context_bar_height_px: number;
        desktop_context_bar_overlap_px: number;
        desktop_context_bar_horizontal_inset_px: number;
        starter_truncation_allowed: boolean;
        selected_starter_visual_policy: string;
        selected_starter_accessibility_state: string;
        selected_working_directory_visual_policy: string;
        workspace_selector_policy: {
          primary_scope: string;
          inactive_recent_directories_visible: boolean;
          management_entry: string;
          management_scope: string;
          selection_effect: string;
          unregister_effect: string;
          filesystem_delete_allowed: boolean;
          active_conversation_change_on_unregister: boolean;
          session_ownership_effect: string;
          cascade_session_delete_allowed: boolean;
        };
        home_shortcut_mutation_policy: {
          pending_scope: string;
          pending_key: string;
          other_shortcuts_remain_interactive: boolean;
          readback_mode: string;
        };
        projectless_conversation_supported: boolean;
        text_chat_without_workspace: string;
        workspace_session_rail_default_state: string;
        active_aionui_primary_navigation: {
          scope: string;
          ordered_entry_ids: string[];
          runtime_entry: {
            route: string;
            label_i18n: Record<'zh-CN' | 'en-US', string>;
            placement: string;
            visibility: string;
            expanded_behavior: string;
            collapsed_behavior: string;
            narrow_drawer_behavior: string;
            keyboard_reachable: boolean;
            home_content_effect: string;
            route_gate_boundary: string;
          };
        };
        right_context_inspector_default_state: string;
        must_not_show: string[];
      };
      utility_icon_policy: {
        library: string;
        opl_owned_settings_navigation_and_overview: string;
        settings_icon_geometry: string;
        icon_text_action_geometry: {
          icon_size_px: number;
          icon_slot_px: number;
          icon_color: string;
          icon_background: string;
          icon_label_gap_px: number;
          alignment: string;
          contrast_policy: string;
          disabled_policy: string;
        };
        upstream_fork_body_bulk_icon_rewrite: string;
        refresh_actions: string;
        model_reasoning_control: string;
        account_identity_avatar: {
          shape: string;
          background: string;
          foreground: string;
          han_name_initials: string;
          non_han_name_initials: string;
          email_fallback_initials: string;
          empty_fallback: string;
        };
        global_feedback_action: {
          placement: string;
          icon: string;
          icon_style: string;
          target_url: string;
          open_mode: string;
          prefill_fields: string[];
          shell_local_delivery_forbidden: boolean;
        };
        scope: string;
      };
    };
    ordinary_conversation: {
      path_id: string;
      entry_source: string;
      executor: string;
      composer_position: string;
      active_capability_chip_visible: boolean;
      persistent_purpose_selector_visible: boolean;
      agent_package_invocation_receipt_required: boolean;
      assistant_route_receipt_required: boolean;
      backend_selector_visible: boolean;
      model_selector_visible: boolean;
      permission_mode_selector_visible: boolean;
      permission_mode_language_policy: string;
      provider_selector_visible: boolean;
      model_status_surface: string;
      technical_details_policy: string;
      composer_placeholder_policy: string;
      composer_context_strip: string[];
      composer_send_scoped_inputs: string[];
      composer_send_scoped_consumption_policy: string;
      send_failure_input_policy: {
        must_preserve_send_scoped_local_inputs: boolean;
        failure_scopes: string[];
        preserved_inputs: string[];
        success_consumption_policy: string;
        failure_restore_policy: string;
        concurrent_edit_merge_policy: string;
        initial_message_handoff_policy: string;
      };
      composer_forbidden_persistent_context: string[];
      composer_bottom_action_row: string[];
      composer_optional_actions: string[];
      mobile_action_sheet: {
        trigger: string;
        allowed_actions: string[];
        send_stop_location: string;
        forbidden_actions: string[];
      };
      unified_context_menu: {
        trigger: string;
        placement: string;
        trigger_dispatch_policy: string;
        direct_file_picker_fallback_allowed: boolean;
        shared_desktop_mobile_content: boolean;
        presentation: string;
        searchable: boolean;
        search_field_policy: string;
        keyboard_navigation: boolean;
        keyboard_commands: string[];
        escape_focus_return: string;
        query_fields: string[];
        desktop_panel_width_policy: string;
        desktop_panel_max_width_px: number;
        desktop_panel_alignment: string;
        mobile_panel_policy: string;
        item_content_policy: string;
        group_heading_policy: string;
        viewport_policy: string;
        scroll_region_policy: string;
        empty_state_policy: string;
        capability_catalog_empty_policy: string;
        groups: Array<{
          id: string;
          scope: string;
          source?: string;
          source_ref?: string;
          label_i18n?: Record<'zh-CN' | 'en-US', string>;
          catalog_membership_source_ref?: string;
          required_package_ids?: string[];
          catalog_order_policy?: string;
          home_shortcut_independence_policy?: string;
          availability_policy?: string;
          agent_owned_skill_deduplication_policy?: string;
          label_policy?: string;
          mode_deduplication_policy?: string;
          existing_session_rebinding_allowed?: boolean;
          surface_actions: {
            home_new_session: string[];
            existing_conversation: string[];
          };
        }>;
        selected_context_presentation: {
          workspace_or_initial_cwd: string;
          attachments: string;
          agent_packages_skills_modes_and_connections: string;
        };
        surface_behavior: {
          home_new_session: string;
          existing_conversation: string;
          settings_route_policy: string;
        };
        authority_policy: string;
        forbidden_entries: string[];
      };
      projectless_conversation_supported: boolean;
      session_workspace_model: {
        primary_unit: string;
        identity_authority: string;
        project_affinity_states: string[];
        project_affinity_cardinality: string;
        projectless_session_semantics: string;
        projectless_detection: string;
        project_affinity_role: string;
        workspace_binding_role: string;
        runtime_pwd_role: string;
        turn_cwd_override_allowed: boolean;
        writable_roots_role: string;
        core_workspace_application: string;
        runtime_pwd_changes_project_affinity: boolean;
        project_affinity_changes_writable_roots: boolean;
        project_adoption_transition: string;
        bound_project_reassignment: string;
        workspace_owns_session: boolean;
        workspace_owns_context: boolean;
        workspace_owns_artifacts: boolean;
        workspace_group_cascade_session_delete_allowed: boolean;
      };
      explicit_session_input_policy: {
        scope: string;
        surfaces: string[];
        selection_scope: string;
        workspace_required: boolean;
        access_authority: string;
        shell_extra_path_authorization_allowed: boolean;
        user_initiated_only: boolean;
        workspace_preload_allowed: boolean;
        workspace_scoped_persistence_allowed: boolean;
        implicit_workspace_context_injection_allowed: boolean;
        composer_consumption: string;
        composer_persistence_after_send: string;
        workspace_readiness_boundary: {
          gates: string[];
          plain_local_conversation_requires_workspace_root: boolean;
          send_scoped_local_file_inputs_require_workspace_root: boolean;
          agent_package_workspace_requirement_policy: string;
          ordinary_codex_conversation_independent_of_agent_package_readiness: boolean;
          codex_and_model_prerequisites_unchanged: boolean;
        };
      };
      codex_subagent_activity: {
        feature_id: 'B0-11';
        product_role: string;
        source: string;
        metadata_authority: {
          collaboration: string;
          subagent: string;
        };
        state_mapping: {
          active_agent_states: string[];
          done_agent_states: string[];
          active_tool_call_statuses: string[];
          done_tool_call_statuses: string[];
          unknown_or_malformed: string;
          canonical_child_thread_status_not_loaded_is_not_activity_state: boolean;
        };
        display: {
          groups: string[];
          read_only: boolean;
          detail_fields: string[];
          open_thread_action: string;
          open_failure_policy: string;
        };
        forbidden_layers: string[];
      };
      transcript_export: {
        scope: string;
        history_loading_policy: string;
        incomplete_history_policy: string;
        silent_truncation_allowed: boolean;
        shareable_roles: string[];
        shareable_message_types: string[];
        excluded_content: string[];
        default_format: string;
        allowed_formats: string[];
        strict_json_document_fields: string[];
        strict_json_message_fields: string[];
        redaction_required: boolean;
        explicit_directory_required: boolean;
        explicit_filename_required: boolean;
        filename_extension_follows_format: boolean;
        errors_visible: boolean;
        workspace_bundle_authorized: boolean;
      };
    };
    right_context_inspector: {
      compatibility_name: string;
      product_role: string;
      placement: string;
      surface_kind: string;
      default_state: string;
      default_third_column_visible: boolean;
      opens_on_user_or_task_request_only: boolean;
      chat_canvas_remains_primary: boolean;
      scope: string;
      workspace_surface: Record<string, unknown>;
      preview_surface: Record<string, unknown>;
      review_surface: Record<string, unknown>;
      on_demand_task_tools: Record<string, unknown>;
      equal_weight_tool_taxonomy_allowed: boolean;
      legacy_taxonomy_ids_forbidden: string[];
      runtime_duplicate_allowed: boolean;
      environment_popover_ref: string;
      must_not_own: string[];
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
    agent_package_activation_policy: {
      action_id: string;
      action_route: string;
      trigger: string;
      payload_fields: string[];
      scope_values: string[];
      scope_target_policy: {
        workspace: string;
        quest: string;
      };
      result_fields: string[];
      launch_policy: string;
      currentness_policy: string;
      package_identity_policy: string;
      app_role: string;
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
      recommendation_authority: string;
      palette_agent_catalog_source_ref: string;
      palette_required_agent_package_ids: string[];
      palette_home_shortcut_independence_policy: string;
      palette_agent_group_label_i18n: Record<'zh-CN' | 'en-US', string>;
      agent_owned_skill_deduplication_policy: string;
      agent_reference_admission_policy: {
        active_agent_package_cardinality: string;
        selection_authority: string;
        at_mention_agent_selection_allowed: boolean;
        plain_text_agent_reference_changes_active_package: boolean;
        multiple_agent_reference_policy: string;
        cross_agent_semantic_admission_owner: string;
        deterministic_cross_agent_routing_allowed: boolean;
        oma_engineering_admission: string;
        deliverable_failure_policy: string;
        existing_conversation_rebinding_allowed: boolean;
      };
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
    agent_package_registry: {
      default_registry_url: string;
      source_ref: string;
      registry_scope: 'external_discovery_only';
      empty_default_registry_allowed: boolean;
      first_party_runtime_authority: string;
      canonical_first_party_package_ids: string[];
      external_first_party_identity_claims_allowed: boolean;
      external_first_party_trust_claims_allowed: boolean;
      collision_failure_code: string;
      first_party_manifest_fixture_dir: string;
      catalog_presentation_policy: {
        section_order: string[];
        professional_agent_order_source: string;
        professional_agent_order_policy: string;
        workflow_profile_policy: string;
        package_role_labels_i18n: Record<string, Record<'zh-CN' | 'en-US', string>>;
        raw_package_role_visible: boolean;
        dependency_hierarchy: {
          source: string;
          direction: string;
          single_parent_policy: string;
          multiple_parent_policy: string;
          missing_or_invisible_parent_policy: string;
          hardcoded_package_relationships_allowed: boolean;
          duplicate_rows_allowed: boolean;
          status_and_actions_source: string;
        };
        developer_controls_disclosure: {
          default_state: string;
          contains: string[];
          ordinary_catalog_remains_visible_when_collapsed: boolean;
        };
      };
      first_party_release_set_metadata: Array<{
        package_id: string;
        package_kind: string;
        display_name: string;
        display_name_i18n: Record<'zh-CN' | 'en-US', string>;
        publisher: string;
        source: 'first_party';
        trust_tier: 'first_party';
        description: string;
        description_i18n: Record<'zh-CN' | 'en-US', string>;
        tags: string[];
        package_role: 'standard_agent' | 'framework_capability_package' | 'workflow_profile';
        manifest_fixture_ref: string;
      }>;
      shell_consumption_policy: string;
    };
    professional_agent_packages: Array<{
      package_id: string;
      display_name: string;
      display_name_i18n: Record<'zh-CN' | 'en-US', string>;
      description_i18n: Record<'zh-CN' | 'en-US', string>;
      short_name: string;
      role: string;
      package_kind: string;
      installed_manageable: boolean;
      default_home_visible: boolean;
      codex_visible_entry: string;
      home_shortcut_ids: string[];
      required_skill_ids: string[];
      optional_skill_ids: string[];
      session_routing_summary_i18n: Record<'zh-CN' | 'en-US', string>;
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
    auto_model_policy: {
      authority: string;
      policy_source_ref: string;
      app_role: string;
      configured_default: {
        model: string;
        reasoning_effort: string;
      };
      mode_default: string;
      model_catalog_source: string;
      catalog_response_models_field: string;
      catalog_default_model_field: string;
      catalog_supported_reasoning_efforts_field: string;
      catalog_supported_reasoning_effort_option_value_field: string;
      catalog_reasoning_effort_order_policy: string;
      catalog_pagination_request_cursor_field: string;
      catalog_pagination_response_cursor_field: string;
      catalog_pagination_completion_policy: string;
      catalog_hidden_model_field: string;
      catalog_hidden_model_policy: string;
      frontier_model_preference_order_role: string;
      frontier_model_preference_order: string[];
      known_model_reasoning_effort_overrides: Record<string, string>;
      unknown_default_model_policy: string;
      unknown_model_reasoning_effort_policy: string;
      catalog_without_default_policy: string;
      catalog_unavailable_fallback: {
        model: string;
        reasoning_effort: string;
      };
      persistence_policy: {
        auto: string;
        fixed: string;
        state_encoding: string;
        reasoning_override_from_auto: string;
        stale_fixed_model: string;
      };
    };
    opl_flow_context: {
      flow_id: string;
      source: string;
      policy_source_ref: string;
      delivery: string;
      user_agents_policy: string;
      language_policy: string;
      app_role: string;
      dependency_policy: string;
      migration_policy: string;
    };
    opl_app_session_context: {
      owner: string;
      source: string;
      delivery: string;
      generation_policy: string;
      update_policy: string;
      user_agents_policy: string;
      customization: {
        additional_instructions_key: string;
        base_context_edit_policy: string;
        user_edit_policy: string;
        reset_behavior: string;
        effect: string;
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
      required_before_plain_send: string[];
      required_before_send_with_local_inputs: string[];
      required_before_workspace_controls: string[];
      unknown_readiness_policy: string;
      blocked_feedback: string;
      must_wait_for: string[];
      must_not_wait_for: string[];
      failure_policy: string;
    };
    ordinary_shell_recovery: {
      persistent_setup_entry: {
        visibility: string;
        surface: string;
        target_route: string;
        label_policy: string;
        must_preserve_current_route_until_clicked: boolean;
      };
      plain_conversation: {
        required_items: string[];
        workspace_root_required: boolean;
        blocked_feedback: string;
        must_preserve_prompt: boolean;
      };
      send_scoped_local_inputs: {
        required_items: string[];
        workspace_root_required: boolean;
        supported_inputs: string[];
      };
      workspace_controls: {
        required_items: string[];
        restricted_capabilities: string[];
        blocked_feedback: string;
        plain_conversation_remains_available: boolean;
        send_scoped_local_inputs_remain_available: boolean;
      };
      unknown_readiness_policy: string;
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
      model_access_setup: {
        desktop_default_method: string;
        desktop_method_order: string[];
        gateway_account: {
          credentials: string[];
          device_label_policy: string;
          secret_bridge_ref: string;
          post_login_state_source: string;
          unique_group_action: string;
          unresolved_group_error: string;
          ready_claim_policy: string;
          password_clear_policy: string;
          diagnostic_policy: string;
        };
        api_key: {
          role: string;
          bridge: string;
          transport: string;
          redaction_policy: string;
        };
        existing_codex_recheck: {
          role: string;
          bridge: string;
          mutates_configuration: boolean;
        };
        webui: {
          allowed_methods: string[];
          gateway_password_login: boolean;
        };
      };
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
      settings_page: string;
      global_control: string;
      safe_maintenance_control: string;
      safe_maintenance_label_zh: string;
      safe_maintenance_label_en: string;
      safe_maintenance_default: string;
      safe_maintenance_auto_policy: string;
      safe_maintenance_fast_policy: string;
      safe_maintenance_required_readback: string[];
      shared_runtime_mutation_boundary: string;
      safe_maintenance_independent_from_source_selection: boolean;
      package_source_control: string;
      fallback_policy: string;
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
    class: string;
    install_exposure_policy_ref: string;
    exposure_classes_ref: string;
    opl_packages_projection_ref: string;
    opl_packages_lifecycle_ref: string;
    public_abi: {
      primary_semantic_entry: string;
      preferred_app_distribution: string;
      plugin_must_not_create_second_semantics: boolean;
      cli_and_app_share_skill_semantics: boolean;
    };
    tools: string[];
    domain_modules: string[];
    upstream_packages: Record<string, {
      owner: string;
      source_policy: string;
      release_lock_policy: string;
      package_unit: string;
      skill_ids: string[];
      default_app_visible: boolean;
      codex_exposure: string;
      semantic_vendoring_allowed: boolean;
    }>;
    official_codex_runtime_capabilities: {
      owner: string;
      preferred_capability_ids: string[];
      distribution_policy: string;
      fallback_policy: string;
      default_app_visible: boolean;
    };
    native_automation: {
      owner: string;
      cron_skill_packaged: boolean;
      exposure: string;
      product_policy_ref: string;
      route: string;
      scheduler_authority: string;
      single_scheduler_store_required: boolean;
      ordinary_sider_entry_visible: boolean;
      executor: string;
      executor_selector_visible: boolean;
    };
    default_packaged_codex_skill_ids: string[];
    additional_package_skill_ids: string[];
    opl_flow_dependency_policy_ref: string;
    full_dependency_closure_policy: string;
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
  install_update_taxonomy: {
    source_refs: string[];
    public_software_objects: string[];
    managed_update_component_keys: string[];
    ordinary_component_picker_allowed: boolean;
    transaction_internal_state_ids: string[];
    ordinary_ui_must_not_expose_as_peer_objects: string[];
    internal_detail_fields: {
      opl_base: string[];
      opl_app: string[];
      opl_packages: string[];
    };
  };
};
