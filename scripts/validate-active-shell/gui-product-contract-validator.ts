import { assertDeepEqualJson, assertForbiddenCapabilityPolicy, assertIncludesAll, readJson } from './assertions.ts';
import {
  appActionRoute,
  appOwnedSettingsAboutUpdaterStatePolicy,
  appOwnedAgentPackageOrdinaryStatusInputMapping,
  appOwnedAgentPackageUserStatusProjection,
  appOwnedSettingsResourcesBrowserEntry,
  appOwnedSettingsCapabilitiesTabContract,
  appOwnedSettingsManagedDependencySummary,
  appOwnedSettingsResourceActionBehavior,
  appOwnedStorageCarrierBehavior,
  appOwnedWebuiDataVolumeHostActionAbiRef,
  appOwnedWebuiDataVolumeHostActionCapabilityId,
  appOwnedTaskAwarenessRefFields,
  firstRunModelAccessSetupPolicy,
  focusedFirstRunPresentationPolicy,
  homeActivityCenterForbiddenDisplays,
  progressiveFirstRunRecoveryPolicy,
  progressiveFirstRunRecoveryTestIds,
} from './app-contract-constants.ts';
import { validateGuiFrameworkSurfaces } from './gui-framework-surfaces-validator.ts';
import { validateGuiProductHomeContract } from './gui-product-home-validator.ts';
import { assertCommandSurface } from './value-helpers.ts';
import {
  assertAgentReferenceAdmissionPolicy,
  assertHomeComposerStateContract,
} from '../app-product-profile-shared-validators.ts';
import {
  validateEnvironmentModuleMaintenanceEntry,
} from './managed-update-plane-validator.ts';
import { productProfilePath, settingsControlPlanePath } from './validation-config.ts';
import { validateSettingsControlPlaneBehavior } from './settings-control-plane-validator.ts';
import {
  validateRuntimeCockpitPreservationPolicy,
} from './runtime-cockpit-product-validator.ts';
import {
  assertNonEmptyStringArray,
  validateBeginnerFirstRunPresentation,
  validateOplFlowContext,
  validateRefLevelFollowUpProjectionContract,
  validateStructuredResultPanelProjectionContract,
  validateTaskAwarenessProjectionContract,
  validateWorkflowSkillCandidateProjectionContract,
  assertFirstRunProgressModelMatches,
} from './shared-contract-validators.ts';
import {
  validateScheduledTasksPageContract,
  validateScheduledTasksProductPolicy,
} from './scheduled-tasks-policy-validator.ts';

const ordinaryForbiddenCapabilityPolicy = {
  forbidden_mcp_matchers: {
    exact: ['aionui-team'],
    prefixes: ['team_', 'mcp__aionui-team'],
    contains: ['aionui-team'],
  },
  scrub_extra_keys: [
    'team_mcp_stdio_config',
    'team_id',
    'teamId',
    'team_lead_team_id',
    'team_lead_team_slot_id',
    'team_lead_conversation_id',
    'tl',
  ],
};

const aionuiTeamProbeIds = [
  'team_mode_disabled',
  'team_route_redirect',
  'team_sidebar_gate',
  'team_created_redirect_noop',
  'ordinary_conversation_team_snapshot_scrub',
  'agent_switching_drops_team_mcp',
  'team_deep_link_not_whitelisted',
  'team_bridge_mutation_gate',
];
const productProfile = readJson(productProfilePath);
const settingsControlPlane = readJson(settingsControlPlanePath);
const expectedFirstRunProgressModel = productProfile.first_run?.progress_model;
const expectedFirstRunCoreItems = assertNonEmptyStringArray(
  productProfile.first_run?.ready_to_launch_gate?.required_core_items,
  'Product profile ready_to_launch required_core_items',
);
const expectedFullReadinessItems = (productProfile.first_run?.full_readiness_layers ?? [])
  .filter((item) => item !== 'core');

function validateCodexModelPolicy(guiContract) {
  const executorPolicy = guiContract.executor_policy ?? {};
  const productHome = productProfile.gui?.home ?? {};
  assertDeepEqualJson(
    {
      default_model: executorPolicy.default_model,
      default_reasoning_effort: executorPolicy.default_reasoning_effort,
      default_model_display_value: executorPolicy.default_model_display_value,
      home_model_status_label: executorPolicy.home_model_status_label,
      home_model_status_label_en: executorPolicy.home_model_status_label_en,
      auto_model_policy_source_ref: executorPolicy.auto_model_policy_source_ref,
      button_label_policy: executorPolicy.model_display_options_policy?.button_label_policy,
      user_reasoning_effort_options: executorPolicy.model_display_options_policy?.user_reasoning_effort_options,
      known_visible_models_follow_frontier_preference_order:
        executorPolicy.model_display_options_policy?.known_visible_models_follow_frontier_preference_order,
      unknown_catalog_default_must_remain_visible_in_auto:
        executorPolicy.model_display_options_policy?.unknown_catalog_default_must_remain_visible_in_auto,
    },
    {
      default_model: productProfile.codex?.default_model,
      default_reasoning_effort: productProfile.codex?.default_reasoning_effort,
      default_model_display_value: productHome.codex_home_model_status_label,
      home_model_status_label: productHome.codex_home_model_status_label,
      home_model_status_label_en: productHome.codex_home_model_status_label_en,
      auto_model_policy_source_ref: productHome.codex_auto_model_selection?.policy_source_ref,
      button_label_policy: productHome.codex_model_display_options?.button_label_policy,
      user_reasoning_effort_options: productHome.codex_model_display_options?.user_reasoning_effort_options,
      known_visible_models_follow_frontier_preference_order: true,
      unknown_catalog_default_must_remain_visible_in_auto: true,
    },
    'App GUI Codex model policy',
  );
}
function validateManagedUpdatePageSurface(page, label) {
  validateManagedUpdatePageBasics(page, label, {
    actionSourceError: `${label} must expose managed update actions through the shell IPC bridge`,
  });
  validateManagedUpdatePlaneBinding(page?.managed_update_plane, label, {
    requirePageId: true,
    requireStateSources: true,
    requireStatusConsumptionPolicy: true,
    bindingError: `${label} must bind to the App managed update plane as a status/action consumer`,
  });
}

function validateReadOnlyStorageLifecycleSurface(surface, label) {
  if (
    surface?.role !== 'read_only_storage_lifecycle_product_surface' ||
    surface.app_role !== 'display_only_consumer_of_opl_mas_read_model_refs' ||
    surface.source_policy !== 'consume_opl_mas_read_model_refs_from_app_state_or_framework_projection_only'
  ) {
    throw new Error(`${label} must be a read-only OPL/MAS read-model consumer`);
  }
  assertIncludesAll(
    surface.source_refs,
    [
      'OPL App state storage lifecycle refs',
      'MAS read-model lifecycle refs when a study/workspace exposes them',
      'runtime compact dry-run refs from OPL Framework projections',
      'completed-project closeout refs from OPL/MAS projections',
    ],
    `${label} source refs`,
  );
  assertIncludesAll(
    surface.display_planes,
    [
      'data_lifecycle_planes',
      'large_body_refs',
      'small_file_pressure_refs',
      'runtime_compact_dry_run_refs',
      'completed_project_closeout_refs',
      'forbidden_generic_cleanup_boundary',
    ],
    `${label} display planes`,
  );
  assertIncludesAll(
    surface.required_ref_fields,
    [
      'plane_id',
      'label',
      'summary',
      'size_or_pressure_ref',
      'recommended_action_ref',
      'dry_run_ref',
      'closeout_ref',
      'authority_boundary',
    ],
    `${label} required ref fields`,
  );
  for (const [field, expected] of Object.entries({
    sqlite_access: 'forbidden',
    file_delete: 'forbidden',
    data_authority_owner: 'OPL Framework and domain owners',
    app_authority: 'read_model_display_only',
    generic_cleanup_policy: 'forbidden_without_owner_ref_and_dry_run_or_closeout_ref',
  })) {
    if (surface.authority_boundary?.[field] !== expected) {
      throw new Error(`${label} authority_boundary.${field} must be ${expected}`);
    }
  }
  assertIncludesAll(
    surface.must_not_read,
    [
      'SQLite files directly',
      'domain artifact bodies',
      'raw runtime private ledgers',
      'workspace filesystem trees to infer cleanup candidates',
    ],
    `${label} must_not_read`,
  );
  assertIncludesAll(
    surface.must_not_write,
    [
      'SQLite files',
      'runtime or domain truth',
      'owner receipts',
      'typed blockers',
      'filesystem deletes or cleanup execution',
    ],
    `${label} must_not_write`,
  );
}

function validateMinimalAgentPackageActivationPolicy(policy) {
  if (
    policy?.release_scope !== 'framework_stage_runtime_only'
    || policy.activation_owner !== 'one-person-lab_family_runtime'
    || policy.framework_entrypoint !== 'ensureFamilyRuntimePackageLaunchReady'
    || policy.framework_entrypoint_ref !==
      'one-person-lab/src/modules/runway/family-runtime-package-readiness.ts#ensureFamilyRuntimePackageLaunchReady'
    || policy.internal_action_id !== 'agent_package_activate'
    || policy.internal_action_ref !== 'app_state.actions#agent_package_activate'
    || policy.internal_action_route !== 'opl app action execute --action agent_package_activate --payload <json> --json'
    || policy.trigger !== 'immediately_before_a_real_domain_StageRun_or_StageAttempt_launch'
    || policy.framework_component?.cohort_commit !== '90518c5ae87a67bd1b4cf81c08560f6cb2c315c5'
  ) {
    throw new Error('App GUI Agent Package activation authority must remain Framework Stage runtime-only');
  }
  assertDeepEqualJson(
    policy.workspace_locator_sources,
    ['StageRun.workspace_locator', 'StageAttempt.workspace_locator'],
    'App GUI Agent Package Stage workspace locator sources',
  );
  assertDeepEqualJson(
    policy.workspace_scope_resolution_fields,
    ['workspace_root', 'repo_root', 'workspace_path', 'target_workspace'],
    'App GUI Agent Package Stage workspace scope fields',
  );
  assertDeepEqualJson(
    policy.shell_execution_policy,
    {
      settings_execution_allowed: false,
      new_conversation_execution_allowed: false,
      ordinary_composer_send_execution_allowed: false,
      shell_projected_activation_action_execution_allowed: false,
      framework_stage_runtime_execution_allowed: true,
    },
    'App GUI Agent Package Shell activation prohibition',
  );
  assertDeepEqualJson(
    policy.stage_runtime_contract,
    {
      package_id_source: 'domainId',
      workspace_locator_source: 'current_StageRun_or_StageAttempt.workspace_locator',
      scope_activation_owner: 'Framework_package_readiness_port.ensureScopeActivation',
      shell_payload_construction_allowed: false,
      shell_session_cwd_substitution_allowed: false,
      activation_result_owner: 'one-person-lab_family_runtime',
      activation_failure_scope: 'block_only_the_corresponding_domain_stage_progression',
      ordinary_conversation_affected: false,
      existing_sessions_affected: false,
    },
    'App GUI Agent Package Framework Stage activation contract',
  );
  assertDeepEqualJson(
    policy.runtime_activation_result_compatibility,
    {
      schema_ref: 'contracts/agent-package-surfaces.schema.json#/$defs/agent_package_activation_result',
      scope: 'Framework_stage_runtime_and_advanced_diagnostics_only',
      ordinary_shell_send_gate_allowed: false,
      required_fields: ['launch_state', 'launch_allowed', 'package_id', 'launch_state_reason'],
      optional_evidence_fields: ['package_version', 'package_lock', 'use_receipt_ref', 'use_binding', 'package_use_binding'],
    },
    'App GUI Agent Package activation result compatibility',
  );
  assertDeepEqualJson(
    policy.home_shortcut_interaction,
    {
      configured_shortcut_visible: true,
      configured_shortcut_selectable_before_selection: true,
      directory_entry_ordinary_discovery_visible_is_separate: true,
      ordinary_composer_activation_required: false,
      ordinary_composer_activation_allowed: false,
      installed_exposed_deferred_status_send_allowed: true,
      uninstalled_or_disabled_selected_package_send_policy:
        'block_only_that_send_with_specific_install_or_enable_guidance',
      domain_readiness_enforcement_phase: 'domain_stage_launch',
      typed_reason_required: true,
      draft_preserved: true,
      owner_repair_guidance_required_for_genuine_unavailability: true,
    },
    'App GUI Home shortcut activation boundary',
  );
  if (
    policy.failure_policy?.stage_activation_failure_scope !== 'corresponding_domain_stage_only'
    || policy.failure_policy?.ordinary_conversation_send_blocked !== false
    || policy.failure_policy?.plain_conversation_create_allowed !== true
    || policy.failure_policy?.other_agent_conversation_allowed !== true
    || policy.failure_policy?.existing_sessions_remain_available !== true
    || policy.failure_policy?.draft_preserved !== true
    || policy.workspace_policy?.session_is_primary_unit !== true
    || policy.workspace_policy?.project_owns_session !== false
    || policy.workspace_policy?.project_affinity_cardinality !== 'zero_or_one'
    || policy.workspace_policy?.bound_project_reassignment_allowed !== false
    || policy.workspace_policy?.runtime_pwd_changes_project_affinity !== false
    || policy.workspace_policy?.project_affinity_changes_writable_roots !== false
    || policy.workspace_policy?.workspace_is_not_a_universal_agent_launch_precondition !== true
    || policy.workspace_policy?.selected_project_directory_role !==
      'session_cwd_and_future_domain_workspace_identity_only'
    || policy.workspace_policy?.selected_project_directory_is_activation_target !== false
    || policy.workspace_policy?.global_workspace_root_is_activation_target !== false
    || policy.workspace_policy?.stage_workspace_locator_is_only_activation_target_source !== true
    || policy.workspace_policy?.plain_conversation_policy !== 'unchanged'
  ) {
    throw new Error('App GUI Agent Package activation must not run from Settings, new conversation, or ordinary send');
  }
}

function validateAgentPackageLifecycleUx(surface, label) {
  if (
    surface?.requirement_scope !== 'product_requirement_not_runtime_authority' ||
    surface.primary_state_surface !== 'app_state.agent_packages.directory.entries + app_state.agent_packages.status_index' ||
    surface.runtime_source_surface !== 'app_state.runtime_source_carriers.items[]' ||
    surface.source_semantics_policy !==
      'directory entries own package discovery plus installed, activated, installability, coarse readiness, orthogonal exposure, and lifecycle actions; status_index contributes canonical diagnostics but cannot override directory lifecycle or action availability' ||
    surface.action_ref_source !== 'app_state.actions' ||
    surface.action_route !== appActionRoute
  ) {
    throw new Error(`${label} must define package-directory lifecycle UX as App product truth over App state/action refs`);
  }
  if ('fallback_state_surface' in surface || 'fallback_policy' in surface) {
    throw new Error(`${label} must not substitute modules or static metadata when the canonical directory is unavailable`);
  }
  const directory = surface.directory_collection_contract;
  if (
    directory?.source !== 'app_state.agent_packages.directory.entries' ||
    directory.collection_owner !== 'one-person-lab' ||
    directory.consumer_policy !==
      'render every projected entry without a shell allowlist, first-party seed, or installed-only filter' ||
    directory.static_metadata_overlay_source !==
      'contracts/app-product-profile.json#gui.agent_package_registry.first_party_release_set_metadata' ||
    directory.static_metadata_overlay_policy !==
      'package_id keyed optional UI metadata only; it cannot define collection membership, availability, status, actions, or OMA and first-party seeds' ||
    directory.first_party_policy !==
      'OMA and every first-party package use the same directory entries and action contract as every other package'
  ) {
    throw new Error(`${label} must keep directory.entries canonical and first-party release metadata presentation-only`);
  }
  assertDeepEqualJson(
    directory.static_metadata_overlay_fields,
    ['display_name_i18n', 'description_i18n'],
    `${label} localized metadata overlay fields`,
  );
  assertDeepEqualJson(surface.shell_consumers, ['aionui', 'opl_native_workbench'], `${label} shell consumers`);
  assertDeepEqualJson(
    directory.required_entry_fields,
    [
      'package_id',
      'display_name',
      'publisher',
      'description',
      'tags',
      'package_role',
      'role_state',
      'trust_tier',
      'source_explanation',
      'manifest_url',
      'selected_version',
      'stable_version',
      'installed_version',
      'installed',
      'activated',
      'installability',
      'readiness',
      'exposure',
      'recommended_action',
      'recommended_action_ref',
      'available_actions',
      'authority_boundary',
    ],
    `${label} exact directory entry fields`,
  );
  assertIncludesAll(
    surface.field_behavior_checklist,
    [
      'render_every_directory_entry_including_uninstalled_packages_OMA_and_all_first_party_packages',
      'keep_catalog_search_distinct_from_Settings_global_search',
      'filter_by_package_role_availability_status_and_source',
      'search_by_package_name_short_name_tag_source_or_description',
      'filter_by_install_update_source_trust_codex_surface_and_home_visibility_state',
      'distinguish_package_install_source_from_active_runtime_source_in_user_language',
      'show_failure_reason_only_when_failed_blocked_or_needs_user_action',
      'operational_ready_false_or_dependency_repair_required_must_never_render_ready',
      'operational_ready_false_must_render_degraded_or_package_unavailable_by_owner_signals_and_must_not_alone_disable_launch',
      'package_unavailable_allows_only_owner_projected_status_doctor_repair_or_workspace_selection_actions_for_that_package',
      'show_dependency_readiness_activation_preparation_and_dependent_guard_in_normal_details',
      'keep_package_dependency_materialization_and_runtime_source_readiness_as_lower_level_diagnostics',
      'execute_repair_only_from_a_complete_directory_projected_action_while_using_status_index_repair_action_for_availability_and_reason',
      'show_receipt_and_physical_surface_in_details_or_advanced_only',
      'execute_only_projected_Settings_action_id_and_payload_without_shell_status_or_payload_inference',
      'never_execute_agent_package_activate_from_Settings_new_conversation_or_ordinary_composer_send',
      'show_installed_exposed_verification_deferred_or_scope_materialization_missing_as_available_without_preconfiguration',
      'never_require_complete_receipt_binding_or_dependency_closure_as_a_universal_launch_precondition',
      'keep_enabled_execution_authority_orthogonal_to_visible_or_hidden_discovery_authority',
      'keep_fast_list_status_and_all_dry_run_reads_pure_when_typed_recovery_state_is_projected',
      'refresh_fast_state_after_successful_install_without_exposing_stage_internal_activation_in_Settings',
      'use_selected_project_only_as_session_cwd_and_future_domain_workspace_identity',
      'leave_scope_activation_to_Framework_StageRun_or_StageAttempt_workspace_locator',
      'keep_registry_refresh_ordinary_and_visible_while_manifest_URL_install_stays_advanced',
      'use_consistent_confirmation_and_receipt_pattern_for_hide_disable_update_repair_uninstall_install_and_launch',
      'display_rollback_ref_as_recovery_reference_only_no_app_rollback_verb',
    ],
    `${label} checklist`,
  );
  assertDeepEqualJson(
    surface.directory_controls?.top_controls,
    ['refresh_registry', 'catalog_search', 'package_role_filter', 'package_status_filter', 'package_source_filter', 'manifest_url_install_advanced'],
    `${label} top controls`,
  );
  assertDeepEqualJson(
    surface.directory_controls?.filters,
    ['package_role', 'availability_status', 'source'],
    `${label} filters`,
  );
  assertIncludesAll(
    surface.directory_controls?.row_actions,
    ['install', 'hide', 'unhide', 'disable', 'enable', 'update', 'repair', 'uninstall', 'launch', 'open_details'],
    `${label} row actions`,
  );
  assertDeepEqualJson(
    surface.directory_controls?.catalog_search_scope,
    ['display_name', 'package_id', 'description', 'tags', 'publisher'],
    `${label} catalog search scope`,
  );
  assertDeepEqualJson(
    surface.directory_controls?.catalog_states,
    ['loading', 'ready', 'refreshing', 'empty', 'stale', 'failed'],
    `${label} catalog states`,
  );
  if (surface.directory_controls?.catalog_search_is_settings_global_search !== false) {
    throw new Error(`${label} catalog search must be distinct from Settings global search`);
  }
  assertDeepEqualJson(
    surface.advanced_manifest_install_contract,
    {
      action_id: 'install_from_manifest_url',
      visibility: 'advanced_only',
      payload_fields: ['manifest_url', 'trust_tier'],
      trust_tier_required: true,
      default_trust_tier: null,
      missing_trust_tier_policy: 'disable_submit_and_show_validation',
      registry_selected_install_affected: false,
    },
    `${label} advanced manifest install trust assignment`,
  );
  assertDeepEqualJson(
    surface.canonical_action_contract,
    {
      source_fields: ['directory.entries[].available_actions[]', 'directory.entries[].recommended_action_ref'],
      required_action_fields: ['action_id', 'action_ref', 'payload', 'required_payload_fields', 'confirmation_required'],
      exact_object_field_policy: 'reject missing or additional fields; accept exactly action_id, action_ref, payload, required_payload_fields, confirmation_required',
      action_ref_policy: 'action_ref must equal app_state.actions#${action_id}',
      required_payload_alternative_policy: "a required_payload_fields item containing ' or ' is satisfied when at least one named payload field is present",
      recommended_action_id_field: 'directory.entries[].recommended_action',
      recommended_action_ref_match_policy: 'recommended_action_ref is null when recommended_action is null; otherwise it exactly equals the available_actions item with the same action_id',
      action_availability_policy: 'an action is available only when Framework projects its complete action object; action objects do not carry shell-inferred enabled, reason_code, or failure_reason fields',
      shell_action_inference_allowed: false,
      post_success_policy: 'refresh opl app state --profile fast --json and render the next projected recommended_action_ref',
      failure_policy: 'preserve the directory row and show the Framework error or readiness.reason/status_read_error without synthesizing ready, synced, or available',
    },
    `${label} canonical actions`,
  );
  assertDeepEqualJson(
    surface.workspace_activation_contract,
    {
      action_id: 'agent_package_activate',
      surface_scope: 'Framework_stage_runtime_only',
      activation_owner: 'one-person-lab_family_runtime',
      framework_entrypoint: 'ensureFamilyRuntimePackageLaunchReady',
      workspace_locator_source: 'StageRun.workspace_locator_or_StageAttempt.workspace_locator',
      settings_execution_allowed: false,
      new_conversation_shell_execution_allowed: false,
      ordinary_send_shell_execution_allowed: false,
      settings_target_workspace_source: null,
      global_workspace_root_activation_target_allowed: false,
      selected_session_directory_activation_target_allowed: false,
      scope_inference_allowed: false,
      scope_materialization_missing_settings_policy: 'show_available_with_no_preflight_action_or_activation_CTA',
      stage_activation_failure_policy: 'block_only_the_corresponding_domain_stage_progression',
    },
    `${label} workspace activation`,
  );
  assertDeepEqualJson(
    surface.source_explanation_fields,
    [
      'kind',
      'source',
      'summary',
      'catalog_ref',
      'registry_url',
      'registry_source_ref',
      'version_source_ref',
    ],
    `${label} source explanation fields`,
  );
  assertDeepEqualJson(
    surface.role_state_fields,
    ['status', 'source', 'discovered_role', 'installed_role', 'diagnostic'],
    `${label} role state fields`,
  );
  assertDeepEqualJson(surface.installability_fields, ['status', 'installable'], `${label} installability fields`);
  assertDeepEqualJson(
    surface.readiness_fields,
    ['status', 'operational_ready', 'launch_allowed', 'verification_deferred', 'reason', 'detail_surface', 'status_read_error'],
    `${label} readiness fields`,
  );
  assertDeepEqualJson(
    surface.readiness_profile_policy,
    {
      fast_activated: {
        status: 'verification_deferred',
        operational_ready: false,
        launch_allowed: false,
        verification_deferred: true,
        reason: 'live_verification_deferred',
        session_launch_disposition: 'conversation_available_without_shell_activation',
      },
      full_verified: {
        status: 'ready',
        operational_ready: true,
        launch_allowed: true,
        verification_deferred: false,
        reason: null,
        session_launch_disposition: 'ready',
      },
      presentation_policy: 'fast verification_deferred remains truthful owner state while ordinary Settings projects available copy with no preconfiguration action; domain StageRun readiness remains Framework-owned',
    },
    `${label} fast and full readiness policy`,
  );
  assertDeepEqualJson(
    surface.ordinary_user_status_input_mapping,
    appOwnedAgentPackageOrdinaryStatusInputMapping,
    `${label} ordinary status input mapping`,
  );
  assertDeepEqualJson(
    surface.user_facing_status_projection,
    appOwnedAgentPackageUserStatusProjection,
    `${label} localized user-facing status projection`,
  );
  assertIncludesAll(
    surface.failure_reason_fields,
    ['readiness.status', 'readiness.reason', 'readiness.status_read_error', 'blocker_summary', 'last_action_receipt_ref', 'recommended_action', 'dependency_readiness.status', 'dependency_readiness.checks[].failure_reasons', 'activation_action.reason_code', 'dependent_guard.disable.reason_code', 'dependent_guard.uninstall.reason_code', 'capability_exposure.enabled', 'capability_exposure.visibility', 'package_dependency_readiness.status', 'package_dependency_readiness.dependencies[].reasons', 'materialization_readiness.status', 'runtime_source_readiness.reason', 'status_read_error', 'operational_ready', 'launch_allowed', 'launch_blocked_reason', 'allowed_when_blocked'],
    `${label} failure reason fields`,
  );
  const detail = surface.receipt_physical_surface_detail_policy;
  if (detail?.surface !== 'details_panel_or_advanced_diagnostics' || detail.default_primary_row_visible !== false) {
    throw new Error(`${label} must keep receipts and physical_surface out of primary row density`);
  }
  assertIncludesAll(
    detail.receipt_fields,
    ['receipt_refs', 'package_lock_ref', 'action_receipt_ref', 'rollback_ref', 'dependency_closure.transaction_id', 'dependency_closure.closure_digest', 'dependency_closure.last_known_good_transaction_id', 'dependency_closure.last_known_good_closure_digest'],
    `${label} receipt fields`,
  );
  const projection = surface.package_projection_contract;
  assertDeepEqualJson(
    projection?.directory_fast_nested_fields?.exposure,
    ['enabled', 'visibility', 'codex_visible'],
    `${label} directory exposure fields`,
  );
  assertIncludesAll(
    projection?.directory_lifecycle_fields,
    ['exposure', 'available_actions'],
    `${label} directory launch lifecycle fields`,
  );
  assertDeepEqualJson(
    projection?.status_index_package_fields?.dependency_readiness_status_values,
    ['ready', 'repair_required', 'blocked'],
    `${label} dependency readiness values`,
  );
  assertIncludesAll(
    projection?.status_index_package_fields?.repair_action,
    ['action_id', 'command_ref', 'enabled', 'reason_code'],
    `${label} repair action fields`,
  );
  assertIncludesAll(
    projection?.status_index_package_fields?.activation_action,
    ['action_id', 'command_ref', 'enabled', 'preparation_status', 'reason_code'],
    `${label} activation action fields`,
  );
  assertIncludesAll(
    projection?.status_index_package_fields?.dependent_guard,
    ['required_by_package_ids', 'disable.allowed', 'disable.reason_code', 'uninstall.allowed', 'uninstall.reason_code'],
    `${label} dependent guard fields`,
  );
  if (
    projection?.status_index_join_policy !==
      'required_package_id_keyed_lifecycle_diagnostics_directory_lifecycle_readiness_and_exact_actions_win_on_overlap' ||
    projection?.status_index_package_fields?.action_receipt_ref !== 'null_or_string' ||
    projection?.status_index_package_fields?.rollback_ref !== 'null_or_string' ||
    projection?.status_index_package_fields?.operational_ready !== 'boolean' ||
    projection?.status_index_package_fields?.launch_allowed !== 'boolean' ||
    projection?.status_index_package_fields?.launch_blocked_reason !== 'null_or_string' ||
    projection?.status_index_repair_action_id !== 'agent_package_repair' ||
    projection?.status_index_action_execution_policy !==
      'status-index repair_action and activation_action are diagnostics only; Settings may execute complete non-activation directory actions while scope activation remains Framework Stage runtime-owned' ||
    JSON.stringify(projection?.dependent_guard_missing_policy) !== JSON.stringify({
      disable_enabled_only_when: 'dependent_guard.disable.allowed === true',
      uninstall_enabled_only_when: 'dependent_guard.uninstall.allowed === true',
      missing_or_invalid_reason_code: 'dependent_guard_unavailable',
      unaffected_actions: ['hide', 'unhide', 'enable'],
    }) ||
    projection?.launch_gate_policy !==
      'verification_deferred or scope_materialization_missing does not block ordinary conversation creation and never triggers Shell activation; genuine package installation enablement or integrity failures may block only that selected package' ||
    projection?.closure_diagnostics_surface !== 'advanced_diagnostics_only'
  ) {
    throw new Error(`${label} must define generic dependency closure readiness and repair projection`);
  }
  assertDeepEqualJson(
    projection?.status_index_package_fields?.allowed_when_blocked,
    ['status', 'doctor', 'repair'],
    `${label} blocked package allowed actions`,
  );
  assertDeepEqualJson(
    projection?.launch_pretransition_reason_codes,
    ['package_activation_required', 'live_verification_deferred', 'use_boundary_reconciliation_ready'],
    `${label} launch pretransition reasons`,
  );
  assertDeepEqualJson(
    projection?.package_unavailable_reason_codes,
    ['package_not_installed', 'package_disabled', 'package_dependency_incompatible', 'package_identity_mismatch', 'package_version_mismatch', 'package_entrypoint_missing', 'unsafe_managed_target', 'permission_or_authorization_denied', 'package_lock_corrupt', 'package_ledger_corrupt', 'package_recovery_in_progress', 'package_recovery_required'],
    `${label} package unavailable reasons`,
  );
  assertDeepEqualJson(
    projection?.degraded_reason_codes,
    ['package_status_read_failed', 'package_dependency_missing', 'physical_surface_not_ready', 'runtime_source_missing', 'runtime_source_incompatible', 'carrier_authority_invalid', 'live_verification_deferred', 'update_available', 'optional_dependency_missing'],
    `${label} degraded launch reasons`,
  );
  assertDeepEqualJson(
    projection?.recovery_read_policy,
    {
      framework_vocabulary: {
        owner: 'one-person-lab',
        surface_kind: 'opl_agent_package_recovery_readback',
        vocabulary_version: 'opl-agent-package-recovery.v1',
        status_envelope_version: 'g2',
        directory_surface_kind: 'opl_agent_package_directory.v1',
        private_alias_normalization_allowed: false,
      },
      read_surfaces: ['fast', 'list', 'status', 'all_dry_run'],
      writes_performed: false,
      states: {
        recovery_in_progress: 'live_exact_global_lock_owner_wait_without_shell_recovery',
        recovery_required: 'orphan_or_pending_markers_recoverable_by_the_next_non_dry_Framework_mutation',
      },
      launch_blocked_reason_by_status: {
        recovery_in_progress: 'package_recovery_in_progress',
        recovery_required: 'package_recovery_required',
      },
      action_projection_fields: ['recovery_action_state', 'recovery_action_executable', 'recovery_action_ref'],
      action_availability_policy: 'consume_the_Framework_projection_without_deriving_action_availability_from_bare_status_or_private_aliases',
      repair_action_policy: {
        recovery_in_progress: {
          launch_blocked_reason: 'package_recovery_in_progress',
          required_recovery_action_state: 'wait_only',
          required_recovery_action_executable: false,
          required_recovery_action_ref: null,
          status_index_repair_enabled: false,
          status_index_reason_code: 'recovery_in_progress',
        },
        recovery_required_executable: {
          readback_status: 'recovery_required',
          launch_blocked_reason: 'package_recovery_required',
          required_recovery_action_state: 'executable',
          required_recovery_action_executable: true,
          required_recovery_action_ref: 'app_state.actions#agent_package_repair',
          status_index_repair_enabled: true,
          status_index_reason_code: 'recovery_required',
          execution_policy: 'execute_only_the_exact_Framework_directory_projected_agent_package_repair_action',
        },
        recovery_required_manual_owner_intervention: {
          readback_status: 'recovery_required',
          managed_update_lock_statuses: ['stale_live_owner', 'invalid'],
          launch_blocked_reason: 'package_recovery_required',
          required_recovery_action_state: 'manual_owner_intervention_required',
          required_recovery_action_executable: false,
          required_recovery_action_ref: null,
          status_index_repair_enabled: false,
          status_index_reason_code: 'recovery_owner_intervention_required',
        },
      },
    },
    `${label} recovery read policy`,
  );
  assertDeepEqualJson(
    projection?.role_launch_matrix,
    {
      installed_standard_agent: 'ordinary_conversation_available_and_domain_stage_activation_Framework_owned',
      uninstalled_standard_agent: 'package_not_installed_and_launch_blocked',
      framework_capability_package: 'no_Agent_launch_entry',
      workflow_profile: 'no_Agent_launch_entry',
    },
    `${label} package role launch matrix`,
  );
  assertDeepEqualJson(
    surface.exposure_state_contract,
    {
      state_fields: ['enabled', 'visibility'],
      visibility_values: ['visible', 'hidden'],
      execution_authority: 'enabled',
      discovery_and_home_authority: 'visibility',
      codex_visible_derivation: "enabled === true && visibility === 'visible'",
      transition_matrix: {
        hide: { enabled: 'preserve', visibility: 'hidden' },
        unhide: { enabled: 'preserve', visibility: 'visible' },
        disable: { enabled: false, visibility: 'preserve' },
        enable: { enabled: true, visibility: 'preserve' },
      },
      receipt_post_state_fields: ['enabled', 'visibility'],
      receipt_binding_policy: 'result_package_lock_and_lifecycle_receipt_must_agree_on_both_post_state_axes',
      disabled_stage_boundary_policy: 'Framework_stage_runtime_activation_returns_package_disabled_without_activation_side_effects',
      hidden_enabled_conversation_policy: 'ordinary discovery and Home default hide the package while an explicit retained shortcut may still start a conversation without Shell activation',
    },
    `${label} orthogonal exposure state`,
  );
  assertDeepEqualJson(projection?.forbidden_private_fields, ['staging_path', 'journal_path'], `${label} private fields`);
  assertDeepEqualJson(
    projection?.stage_runtime_activation_contract_ref,
    'contracts/app-gui-product-contract.json#agent_package_activation_policy',
    `${label} Stage runtime activation authority`,
  );
  assertIncludesAll(
    detail.physical_surface_fields,
    [
      'surface_kind',
      'status',
      'package_id',
      'plugin_id',
      'marketplace_id',
      'codex_home',
      'codex_plugin_cache_path',
      'marketplace_path',
      'codex_config_path',
      'materialized_required_skill_ids',
      'materialized_required_skill_paths',
      'reload_required',
    ],
    `${label} physical surface fields`,
  );
  assertDeepEqualJson(
    surface.consistent_action_interaction?.exposure_actions,
    ['hide', 'unhide', 'disable', 'enable'],
    `${label} exposure actions`,
  );
  assertDeepEqualJson(
    surface.consistent_action_interaction?.lifecycle_actions,
    ['install', 'update', 'repair', 'uninstall'],
    `${label} lifecycle actions`,
  );
  assertIncludesAll(
    surface.consistent_action_interaction?.required_confirmation_fields,
    ['what_changes', 'what_does_not_change', 'receipt_or_recovery_ref', 'post_action_refresh'],
    `${label} confirmation fields`,
  );
  if (
    surface.consistent_action_interaction?.dry_run_or_confirmation_required !== true ||
    surface.rollback_verb_allowed !== false ||
    surface.session_contract_allowed !== false ||
    surface.runtime_authority_allowed !== false ||
    surface.package_execution_authority_allowed !== false ||
    surface.live_codex_surface_reload_completion_policy !== 'deferred_release_runtime_evidence_not_product_contract_completion'
  ) {
    throw new Error(`${label} must not own rollback verbs, sessions, runtime authority, execution authority, or live reload completion`);
  }
  assertIncludesAll(
    surface.must_not_own,
    [
      'package_lifecycle_execution',
      'package_execution_runtime',
      'package_currentness_truth',
      'live_codex_surface_reload_truth',
      'domain_truth',
      'domain_readiness',
      'owner_receipt_authority',
    ],
    `${label} forbidden authority`,
  );
}

function validateDesktopTrayPolicy(guiContract) {
  const trayPolicy = guiContract.desktop_tray_policy;
  const iconPolicy = trayPolicy?.icon_policy;
  assertDeepEqualJson(
    iconPolicy,
    {
      macos_asset_role: 'dedicated_monochrome_geometric_template_image',
      macos_brand_motif: 'opl_segmented_workflow_orbit_with_single_person_core',
      macos_base_point_size: 16,
      macos_scale_factors: [1, 2],
      macos_template_image_required: true,
      macos_transparency_required: true,
      macos_color_policy: 'black_alpha_mask_only',
      macos_forbidden_source: 'scaled_full_color_application_icon',
      other_platforms: 'retain_application_icon_unless_platform_specific_asset_is_defined',
    },
    'App GUI desktop tray icon policy',
  );
}

function validateDesktopApplicationIconPolicy(guiContract) {
  assertDeepEqualJson(
    guiContract.theme_and_branding?.desktop_app_icon_policy,
    {
      source_asset: 'active_shell/resources/icon.png',
      source_artwork_unchanged: true,
      macos_canvas_px: 1024,
      macos_alpha_threshold_percent: 50,
      macos_expected_alpha_bounds: '824x824+100+100',
      macos_safe_margin_required: true,
      macos_derived_assets: [
        'active_shell/resources/app.png',
        'active_shell/resources/app_dev.png',
        'active_shell/resources/app.icns',
        'packaged .app Contents/Resources/icon.icns',
      ],
      pwa_and_in_app_brand_assets_unchanged: true,
    },
    'App GUI desktop application icon policy',
  );
}

export function validateBrandedDeepLinkPolicy(policy) {
  assertDeepEqualJson(
    policy,
    {
      schema: 'opl_app_branded_deep_link.v1',
      carrier_scope: 'desktop_shell_only',
      scheme: 'opl',
      accepted_schemes: ['opl'],
      legacy_scheme_policy:
        'reject_unless_an_explicit_compatibility_contract_and_live_evidence_are_added',
      action_authority: 'url_hostname_only_with_empty_path',
      allowed_actions: ['navigate'],
      action_schemas: {
        navigate: {
          required_params: ['route'],
          optional_params: [],
          additional_params_allowed: false,
          duplicate_params_allowed: false,
          route_value_policy: 'single_url_decoded_absolute_app_path',
        },
      },
      forbidden_credential_actions: ['add-provider', 'provider/add'],
      forbidden_parameter_names: [
        'data',
        'api_key',
        'apikey',
        'authorization',
        'credential',
        'key',
        'password',
        'secret',
        'token',
      ],
      secret_like_value_prefixes: ['Bearer ', 'eyJ', 'ghp_', 'github_pat_', 'sk-'],
      opaque_payload_policy: 'base64_json_and_other_encoded_payloads_are_forbidden',
      validation_layers: {
        main_process:
          'validate_scheme_action_path_query_cardinality_and_secret_policy_before_queue_or_emit',
        renderer: 'validate_route_against_app_owned_exact_route_registry_before_navigation',
      },
      route_registry: {
        static_exact_routes: ['/guid', '/archived', '/scheduled'],
        settings_route_source_ref:
          'contracts/app-settings-control-plane.json#ordinary_routes+secondary_pages',
        settings_route_fields: ['ordinary_routes[].path', 'secondary_pages[].path'],
        match_policy: 'exact_path_only_no_query_hash_or_dynamic_segments',
        forbidden_route_classes: [
          'conversation_id',
          'runtime',
          'first_run',
          'authentication',
          'extension',
          'test_or_developer',
        ],
      },
      delivery_paths: [
        'cold_start_argv',
        'warm_macos_open_url',
        'second_instance_additional_data_or_argv',
      ],
      delivery_policy: 'all_delivery_paths_use_the_same_parser_and_validation_result',
      invalid_input_policy: {
        interaction: 'drop_only_the_invalid_link_and_keep_the_app_current_route_and_input_usable',
        logging: 'warn_with_reason_code_and_redacted_structure_only',
        raw_url_logging_allowed: false,
        parameter_value_logging_allowed: false,
        pending_invalid_state_allowed: false,
        global_startup_block_allowed: false,
      },
    },
    'App GUI branded deep-link policy',
  );

  const settingsRoutes = [
    ...(settingsControlPlane.ordinary_routes ?? []),
    ...(settingsControlPlane.secondary_pages ?? []),
  ].map((route) => route.path);
  if (
    settingsRoutes.length === 0 ||
    new Set(settingsRoutes).size !== settingsRoutes.length ||
    settingsRoutes.some(
      (route) =>
        typeof route !== 'string' ||
        !route.startsWith('/settings/') ||
        /[?#:]/.test(route),
    )
  ) {
    throw new Error('App Settings deep-link registry must contain unique exact /settings/* paths');
  }
}

export function validateAppGuiProductContract(guiContract, releaseChannel, installExposurePolicy) {
  validateMinimalAgentPackageActivationPolicy(guiContract.agent_package_activation_policy);
  validateBrandedDeepLinkPolicy(guiContract.branded_deep_link_policy);
  validateScheduledTasksProductPolicy(guiContract.scheduled_tasks_policy);
  validateScheduledTasksPageContract(guiContract.pages?.scheduled_tasks, guiContract.scheduled_tasks_policy);
  validateGuiProductHomeContract(guiContract);
  validateCodexModelPolicy(guiContract);
  validateGuiFrameworkSurfaces(guiContract, releaseChannel, installExposurePolicy);
  validateSettingsControlPlaneBehavior({ guiContract });
  validateDesktopTrayPolicy(guiContract);
  validateDesktopApplicationIconPolicy(guiContract);

  const startupReadModelPolicy = guiContract.framework_surfaces?.canonical_state?.startup_read_model_policy;
  if (
    startupReadModelPolicy?.blocking_policy !==
    'ordinary_startup_and_guid_navigation_are_non_blocking_core_failures_only_restrict_dependent_capabilities'
  ) {
    throw new Error('App GUI startup read model must keep Guid navigation non-blocking');
  }
  if (
    startupReadModelPolicy?.soft_deadline_ms !== 1500 ||
    startupReadModelPolicy?.soft_deadline_behavior !== 'enter_guid_and_continue_state_refresh_in_background'
  ) {
    throw new Error('App GUI startup read model must enter Guid after the 1500 ms soft deadline');
  }

  if (guiContract.theme_and_branding?.default_theme_id !== 'default-theme') {
    throw new Error('App GUI default theme must be default-theme');
  }
  if (
    guiContract.theme_and_branding?.ordinary_chrome_product_name !== productProfile.product?.ordinary_chrome_name ||
    guiContract.theme_and_branding?.ordinary_navigation_brand_presentation?.identity !== 'text_only' ||
    guiContract.theme_and_branding?.ordinary_navigation_brand_presentation?.logo_visible !== false ||
    guiContract.theme_and_branding?.ordinary_navigation_brand_presentation?.theme_variant_asset_required !== false
  ) {
    throw new Error('App GUI ordinary navigation branding must use the profile-owned text-only product name');
  }
  if (!guiContract.theme_and_branding?.visible_branding_surfaces?.includes('navigation_rail_brand')) {
    throw new Error('App GUI visible branding surfaces must include navigation_rail_brand');
  }
  if (
    !Array.isArray(guiContract.theme_and_branding?.allowed_theme_ids) ||
    guiContract.theme_and_branding.allowed_theme_ids.length !== 1 ||
    guiContract.theme_and_branding.allowed_theme_ids[0] !== 'default-theme'
  ) {
    throw new Error('App GUI theme list must expose only default-theme');
  }
  for (const section of [
    'general',
    'gateway',
    'access',
    'workspace',
    'agents',
    'capabilities',
    'resources',
    'environment',
    'storage',
    'appearance',
    'about',
  ]) {
    if (!guiContract.settings_navigation?.required_sections?.includes(section)) {
      throw new Error(`App GUI settings navigation must include ${section}`);
    }
  }
  assertDeepEqualJson(
    guiContract.settings_navigation?.ordinary_visible_tabs,
    settingsControlPlane.ordinary_visible_tabs,
    'App GUI settings navigation ordinary visible tabs',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation?.secondary_page_ids,
    settingsControlPlane.secondary_pages?.map((route) => route.id),
    'App GUI settings navigation secondary page ids',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation?.compatibility_redirects,
    settingsControlPlane.compatibility_redirects,
    'App GUI settings compatibility redirects',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation?.ordinary_hidden_compatibility_routes,
    ['update', 'theme', 'local-services', 'personalization'],
    'App GUI hidden compatibility routes',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation?.legacy_route_redirects,
    Object.fromEntries(
      Object.entries(settingsControlPlane.legacy_route_redirects ?? {})
        .filter(([id]) => id !== 'about')
        .map(([id, target]) => [id, target]),
    ),
    'App GUI settings navigation legacy route redirects',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation?.ordinary_hidden_legacy_tabs,
    Object.keys(guiContract.settings_navigation?.legacy_route_redirects ?? {}),
    'App GUI settings navigation ordinary hidden legacy tabs',
  );
  if (
    guiContract.settings_navigation?.legacy_route_redirects?.about ||
    settingsControlPlane.legacy_route_redirects?.about
  ) {
    throw new Error('App GUI About must remain an independent /settings/about page');
  }
  if (
    guiContract.settings_navigation?.legacy_route_redirects?.assistants !==
    'capabilities#third-party'
  ) {
    throw new Error('App GUI legacy assistants route must target the OPL capability directory');
  }
  assertIncludesAll(
    guiContract.settings_navigation?.ordinary_hidden_upstream_surfaces,
    ['AionUI Team', 'Team nav entry', 'Team leader configuration', 'team deep link navigation'],
    'App GUI settings hidden upstream surfaces',
  );
  for (const [field, expected] of Object.entries({
    ordinary_visible: false,
    route_policy: 'disabled_or_redirect_to_app_owned_home',
    deep_link_policy: 'not_whitelisted',
    rationale: 'upstream AionUI Team is configured around shell-local agents and is not an OPL ordinary-user capability',
  })) {
    if (guiContract.settings_navigation?.team_surface_policy?.[field] !== expected) {
      throw new Error(`App GUI settings team_surface_policy.${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    guiContract.settings_navigation.team_surface_policy.required_probes,
    aionuiTeamProbeIds,
    'App GUI Team surface required probes',
  );
  if (
    guiContract.settings_navigation.source !==
      'persisted_narrow_settings_snapshot_then_opl_app_state_fast_background_refresh_and_full_explicit_detail'
  ) {
    throw new Error('App GUI settings navigation must render persisted narrow state before background fast App state hydration');
  }
  if (guiContract.settings_navigation.refresh_source !== 'opl app state --profile fast --json') {
    throw new Error('App GUI settings navigation refresh must use fast App state');
  }
  const firstLaunchPolicy = guiContract.first_launch_readiness_policy;
  if (
    firstLaunchPolicy?.launch_gate !== 'ready_to_launch' ||
    firstLaunchPolicy?.ui_order !== 'before_first_conversation_not_before_guid' ||
    firstLaunchPolicy?.guid_navigation_blocking !== false
  ) {
    throw new Error('App GUI first-launch readiness must gate first conversation without blocking /guid navigation');
  }
  for (const item of expectedFirstRunCoreItems) {
    if (!firstLaunchPolicy?.core_required_items?.includes(item)) {
      throw new Error(`App GUI first-launch readiness must require Core item ${item}`);
    }
  }
  for (const item of expectedFullReadinessItems) {
    if (!firstLaunchPolicy?.full_readiness_items?.includes(item)) {
      throw new Error(`App GUI first-launch readiness must keep ${item} in full readiness`);
    }
  }
  for (const [field, expected] of Object.entries({
    full_readiness_blocks_launch: false,
    default_provider: 'gflab',
    default_provider_name: 'OPL Gateway',
    existing_provider_name_policy: 'preserve_existing_provider_name_no_migration',
    default_base_url: 'https://gflabtoken.cn/v1',
    default_model: productProfile.codex.default_model,
    default_reasoning_effort: productProfile.codex.default_reasoning_effort,
    default_executor: 'codex_cli',
    full_runtime_provider: 'temporal',
  })) {
    if (firstLaunchPolicy?.[field] !== expected) {
      throw new Error(`App GUI first-launch readiness ${field} must be ${expected}`);
    }
  }
  validateBeginnerFirstRunPresentation(
    firstLaunchPolicy?.beginner_presentation,
    'App GUI first-launch beginner presentation',
    expectedFirstRunCoreItems,
  );
  for (const [field, expected] of Object.entries(focusedFirstRunPresentationPolicy)) {
    if (firstLaunchPolicy?.beginner_presentation?.[field] !== expected) {
      throw new Error(`App GUI first-launch beginner presentation ${field} must be ${expected}`);
    }
  }
  assertDeepEqualJson(
    firstLaunchPolicy?.beginner_presentation?.model_access_setup,
    firstRunModelAccessSetupPolicy,
    'App GUI first-launch model access setup policy',
  );
  assertDeepEqualJson(
    firstLaunchPolicy?.beginner_presentation?.primary_steps,
    expectedFirstRunCoreItems,
    "App GUI first-launch beginner presentation primary steps",
  );
  assertFirstRunProgressModelMatches(
    firstLaunchPolicy?.progress_model,
    expectedFirstRunProgressModel,
    'App GUI first-launch',
  );
  for (const [field, expected] of Object.entries({
    first_run_route_policy: 'authenticated_standalone_route_outside_ordinary_product_layout',
    unknown_readiness_escape_policy: 'startup_skip_enters_guid_without_mutating_readiness',
    guid_navigation_blocked_by_readiness: false,
    core_capability_use_blocked_when_prerequisites_fail: true,
  })) {
    if (firstLaunchPolicy?.startup_runtime_policy?.[field] !== expected) {
      throw new Error('App GUI first-launch startup runtime ' + field + ' must be ' + expected);
    }
  }
  const ordinaryRecovery = firstLaunchPolicy?.ordinary_shell_recovery_policy;
  if (
    ordinaryRecovery?.persistent_setup_entry?.target_route !==
      progressiveFirstRunRecoveryPolicy.persistent_setup_entry_route ||
    ordinaryRecovery?.persistent_setup_entry?.surface !== 'ordinary_sidebar_non_modal_entry' ||
    ordinaryRecovery?.persistent_setup_entry?.must_preserve_current_route_until_clicked !== true ||
    ordinaryRecovery?.plain_conversation?.workspace_root_required !== false ||
    ordinaryRecovery?.plain_conversation?.must_preserve_prompt !== true ||
    ordinaryRecovery?.send_scoped_local_inputs?.workspace_root_required !== false ||
    ordinaryRecovery?.workspace_controls?.plain_conversation_remains_available !== true ||
    ordinaryRecovery?.workspace_controls?.send_scoped_local_inputs_remain_available !== true ||
    ordinaryRecovery?.unknown_readiness_policy !== progressiveFirstRunRecoveryPolicy.unknown_readiness_policy
  ) {
    throw new Error('App GUI first-launch ordinary shell recovery policy is invalid');
  }
  assertDeepEqualJson(
    ordinaryRecovery.plain_conversation.required_items,
    progressiveFirstRunRecoveryPolicy.plain_conversation_required_items,
    'App GUI first-launch plain conversation prerequisites',
  );
  assertDeepEqualJson(
    ordinaryRecovery.send_scoped_local_inputs.required_items,
    progressiveFirstRunRecoveryPolicy.send_scoped_local_input_required_items,
    'App GUI first-launch send-scoped local input prerequisites',
  );
  assertDeepEqualJson(
    ordinaryRecovery.send_scoped_local_inputs.supported_inputs,
    progressiveFirstRunRecoveryPolicy.send_scoped_local_input_surfaces,
    'App GUI first-launch send-scoped local input surfaces',
  );
  assertDeepEqualJson(
    ordinaryRecovery.workspace_controls.required_items,
    progressiveFirstRunRecoveryPolicy.workspace_control_required_items,
    'App GUI first-launch workspace control prerequisites',
  );
  assertDeepEqualJson(
    ordinaryRecovery.workspace_controls.restricted_capabilities,
    progressiveFirstRunRecoveryPolicy.workspace_restricted_capabilities,
    'App GUI first-launch workspace-restricted capabilities',
  );
  assertIncludesAll(
    ordinaryRecovery.required_shell_testids,
    progressiveFirstRunRecoveryTestIds,
    'App GUI first-launch progressive recovery shell test ids',
  );

  const modulePathPolicy = guiContract.module_path_source_policy;
  if (modulePathPolicy?.source !== 'app_state.modules[].source + app_state.modules[].path + app_state.paths') {
    throw new Error('App GUI module path explanation must come from App state module/path refs');
  }
  for (const explanation of [
    'whether a module comes from the bundled Full runtime payload',
    'whether a module comes from the App/CLI-managed GHCR OCI OPL Packages latest channel',
    'whether a package comes from the Framework-managed GHCR OCI OPL Packages latest-stable channel',
    'whether a module comes from a local domain repository checkout',
    'whether Developer Profile source_channel uses a GitHub repo or local checkout',
    'whether a module is managed by App/CLI maintenance',
    'that module path display is refs-only and not domain truth authority',
  ]) {
    if (!modulePathPolicy.must_explain?.includes(explanation)) {
      throw new Error(`App GUI module path source policy must explain ${explanation}`);
    }
  }
  if (
    modulePathPolicy.ordinary_user_source !== 'app_cli_managed_ghcr_oci_agent_packages_latest_channel' ||
    modulePathPolicy.ordinary_user_transport !== 'app_cli_managed'
  ) {
    throw new Error('App GUI module path source policy must keep ordinary users on App/CLI-managed package maintenance');
  }
  if (modulePathPolicy.developer_override_surface !== 'Developer Profile source_channel capability') {
    throw new Error('App GUI module path source policy must route repo/checkout override through Developer Profile source_channel');
  }
  if (modulePathPolicy.developer_override_policy !== 'explicit_opt_in_only') {
    throw new Error('App GUI module path source policy must require explicit opt-in for Developer Profile checkout override');
  }
  if (modulePathPolicy.developer_profile_ref !== 'developer_profile.capabilities.source_channel') {
    throw new Error('App GUI module path source policy must link to Developer Profile source_channel');
  }
  if (!modulePathPolicy.must_not_use?.includes('raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI')) {
    throw new Error('App GUI module path source policy must not expose raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI');
  }

  const developerProfile = guiContract.developer_profile;
  if (!developerProfile || typeof developerProfile !== 'object') {
    throw new Error('App GUI contract must declare Developer Profile capabilities');
  }
  const developerProfileCapabilityAxes = developerProfile.capability_axes;
  if (!Array.isArray(developerProfileCapabilityAxes) || developerProfileCapabilityAxes.length === 0) {
    throw new Error('App GUI Developer Profile must declare capability axes');
  }
  assertDeepEqualJson(
    Object.keys(developerProfile.capabilities ?? {}),
    developerProfileCapabilityAxes,
    'App GUI Developer Profile capability axes and capability map keys',
  );
  if (
    developerProfile.default_profile !== 'standard_user' ||
    developerProfile.opt_in_policy !== 'automatic_for_matching_identity_and_authorized_repositories_with_explicit_off' ||
    developerProfile.ordinary_user_defaults?.source_channel !== 'agent_rolling_latest_package_channel' ||
    developerProfile.ordinary_user_defaults?.agent_automation !== 'automatic_clean_managed_agent_package_updates'
  ) {
    throw new Error('App GUI Developer Profile must preserve standard user defaults and explicit opt-in');
  }
  for (const axis of developerProfileCapabilityAxes) {
    const capability = developerProfile.capabilities?.[axis];
    if (!capability?.standard_default || !capability.developer_opt_in || !capability.display_policy) {
      throw new Error(`App GUI Developer Profile capability ${axis} must declare defaults, opt-in, and display policy`);
    }
  }
  if (
    developerProfile.capabilities.source_channel.developer_opt_in !== 'github_repo_or_local_checkout' ||
    developerProfile.capabilities.agent_automation.standard_default !== 'automatic_clean_managed_agent_package_updates' ||
    developerProfile.capabilities.runtime_mutation_scope.standard_default !== 'app_action_route_only' ||
    developerProfile.settings_pages?.length !== 1 ||
    developerProfile.settings_pages[0] !== 'settings_agents' ||
    developerProfile.control_model?.source_mode?.control !== 'three_state_segmented_control' ||
    JSON.stringify(developerProfile.control_model?.source_mode?.values) !== JSON.stringify(['auto', 'managed', 'developer']) ||
    JSON.stringify(developerProfile.control_model?.source_mode?.labels) !==
      JSON.stringify(['automatic', 'managed', 'developer']) ||
    developerProfile.control_model?.safe_maintenance?.control !== 'auto_or_off_control_with_effective_state_readback' ||
    developerProfile.control_model.safe_maintenance.default !== 'auto' ||
    JSON.stringify(developerProfile.control_model.safe_maintenance.values) !== JSON.stringify(['auto', 'off']) ||
    developerProfile.control_model.safe_maintenance.off_value !== 'external_observe' ||
    developerProfile.control_model.safe_maintenance.effective_value !== 'developer_apply_safe' ||
    developerProfile.control_model.safe_maintenance.fast_profile_policy !==
      'show inspection pending without claiming identity mismatch' ||
    developerProfile.control_model.safe_maintenance.shared_runtime_mutation_boundary !==
      'enabled=on + mode=developer_apply_safe + source=user_config' ||
    developerProfile.control_model?.safe_maintenance?.independent_from_source_selection !== true ||
    developerProfile.control_model?.package_source?.control !== 'segmented_control_in_package_details' ||
    !developerProfile.must_show?.includes(
      'Maintain authorized development repositories auto/off control with effective state',
    ) ||
    !developerProfile.must_show?.includes('per-package auto managed developer source control') ||
    !developerProfile.must_not_show?.includes('five equal capability-axis cards')
  ) {
    throw new Error('App GUI Developer Profile must keep source controls and automatic safe-maintenance readback on Agents');
  }

  for (const lane of releaseChannel.release_validation_profiles.stable.required_lanes) {
    if (!guiContract.release_channel_policy?.stable?.must_gate?.includes(lane)) {
      throw new Error(`App GUI stable release policy must gate ${lane}`);
    }
  }
  for (const lane of releaseChannel.release_validation_profiles.nightly_standard.required_lanes) {
    if (!guiContract.release_channel_policy?.nightly?.must_gate?.includes(lane)) {
      throw new Error(`App GUI nightly release policy must gate ${lane}`);
    }
  }
  for (const lane of releaseChannel.release_validation_profiles.nightly_standard.forbidden_lanes) {
    if (!guiContract.release_channel_policy?.nightly?.must_not_gate?.includes(lane)) {
      throw new Error(`App GUI nightly release policy must exclude ${lane}`);
    }
  }

  const pages = guiContract.pages ?? {};
  for (const pageId of [
    'guid_home',
    'settings_general',
    'settings_gateway',
    'settings_access',
    'settings_workspace',
    'settings_agents',
    'settings_capabilities',
    'settings_resources',
    'settings_environment',
    'settings_storage',
    'about',
    'update',
    'settings_theme',
    'settings_local_services',
    'settings_personalization',
  ]) {
    if (!pages[pageId]) {
      throw new Error(`App GUI contract missing page ${pageId}`);
    }
  }
  for (const pageId of [
    'guid_home',
    'settings_general',
    'settings_gateway',
    'settings_access',
    'settings_agents',
    'settings_environment',
    'about',
    'update',
    'settings_theme',
  ]) {
    const expectedStateSource = pageId === 'settings_environment'
      ? 'opl app state --profile fast --json + application.systemInfo.logDir when the carrier exposes systemInfo'
      : 'opl app state --profile fast --json';
    assertCommandSurface(pages[pageId].state_source, expectedStateSource, `App GUI ${pageId} state source`);
    const expectedRefreshSource = pageId === 'settings_general'
      ? 'background opl app state --profile fast --json with bounded retry'
      : pageId === 'about'
        ? 'startup check once or explicit manual check updates the same shared store'
        : 'opl app state --profile fast --json';
    assertCommandSurface(pages[pageId].refresh_source, expectedRefreshSource, `App GUI ${pageId} refresh source`);
  }
  const capabilitiesStateSource =
    'opl update status --json#managed_update.components[component_id=opl_base].current.dependency_catalog.flow_dependencies + Codex and shell skill/plugin registries';
  assertCommandSurface(
    pages.settings_capabilities.state_source,
    capabilitiesStateSource,
    'App GUI settings_capabilities state source',
  );
  assertCommandSurface(
    pages.settings_capabilities.refresh_source,
    capabilitiesStateSource,
    'App GUI settings_capabilities refresh source',
  );
  assertDeepEqualJson(
    pages.settings_capabilities.entity_kinds,
    ['skill', 'plugin', 'mcp_server', 'image_generation', 'voice_input'],
    'App GUI Settings Capabilities entity kinds',
  );
  if (
    pages.settings_capabilities.local_capability_configuration_source !==
      'AionUI local configuration#MCP servers + image generation + voice input' ||
    !pages.settings_capabilities.must_show?.includes(
      'AionUI-native Skills, Plugins, MCP helpers, image generation, and voice input inside local or third-party ownership instead of OPL Flow',
    ) ||
    !pages.settings_capabilities.must_not_show?.includes('voice input configuration on Preferences or Advanced') ||
    !pages.settings_theme.must_not_show?.includes('voice input provider configuration')
  ) {
    throw new Error('App GUI Settings Capabilities must own local MCP, image, and voice configuration without Preferences duplication');
  }
  if (
    !pages.guid_home.must_show?.includes(
      'all user-visible configured OPL starters in stable order without silent truncation',
    )
  ) {
    throw new Error('App GUI home must show every user-visible configured OPL starter without silent truncation');
  }
  if (
    !pages.guid_home.must_show?.includes(
      'all visible professional-agent shortcuts remain selectable while launch readiness is enforced on send with typed guidance',
    ) ||
    !pages.guid_home.must_show?.includes('prompt, compact shortcuts, and composer share one bottom reading lane') ||
    !pages.guid_home.must_show?.includes(
      'active capability shown by a quiet selected shortcut state without a second composer label',
    )
  ) {
    throw new Error('App GUI home must keep agent shortcuts selectable and subordinate to the chat-first composer');
  }
  assertIncludesAll(
    pages.guid_home.must_not_show,
    [
      'full-width professional-agent navigation row or inactive-item chevrons',
      'working directory selector inside the composer capability palette',
      'professional-agent selection disabled only because package launch is not ready',
    ],
    'App GUI Home retired agent-portal and context-cap signals',
  );
  assertIncludesAll(
    pages.guid_home.must_show,
    [
      'exactly one Home root, composer shell, and footer account or Settings entry at every viewport',
      'each canonical thread ID rendered as at most one conversation row regardless of title',
      'canonical App Server thread overview overrides Codex ACP cache rows while preserving non-Codex local rows',
      'directory groups derived from canonical session cwd as presentation and new-session cwd shortcuts only',
      'active AionUI primary navigation shows 运行状态 after New task and before Scheduled tasks in expanded, collapsed, and narrow drawer modes',
    ],
    'App GUI Home session-first identity signals',
  );
  assertIncludesAll(
    pages.guid_home.must_not_show,
    [
      'workspace-scoped Add context action in a directory group',
      'directory-group delete action or cascade deletion of grouped sessions',
      'title-based conversation deduplication',
      'stale Codex ACP cache rows absent from an available canonical App Server overview',
    ],
    'App GUI Home forbidden directory ownership signals',
  );
  assertHomeComposerStateContract(
    guiContract.interaction_baseline?.home?.home_composer_state_contract,
    'App GUI Home composer state contract',
  );
  assertHomeComposerStateContract(
    productProfile.gui?.home?.home_composer_state_contract,
    'App product profile Home composer state contract',
  );
  assertDeepEqualJson(
    productProfile.gui?.home?.home_composer_state_contract,
    guiContract.interaction_baseline?.home?.home_composer_state_contract,
    'App product profile Home composer state projection',
  );
  if (pages.guid_home.model_status?.display_value !== '5.6 Sol') {
    throw new Error('App GUI home model selector must keep the friendly default model without repeating reasoning');
  }
  if (
    pages.guid_home.model_status?.value_source !==
    'default_session_profile.model on Home; normalized active ACP model_info in conversation'
  ) {
    throw new Error('App GUI model selector must use the default profile on Home and active ACP model info in conversation');
  }
  if (pages.guid_home.model_status?.placement !== 'inside the Home and ordinary Codex conversation model selector buttons only') {
    throw new Error('App GUI model status must stay inside the Home and conversation selector buttons');
  }
  if (pages.guid_home.model_status?.standalone_home_subtitle_visible !== false) {
    throw new Error('App GUI home must not show a standalone model subtitle');
  }
  if (pages.guid_home.model_status?.selector_visible !== true) {
    throw new Error('App GUI home must expose the App-owned model selector');
  }
  if (
    pages.guid_home.conversation_feedback_policy?.pending_indicator !==
    'visible elapsed seconds while request is pending or backend is running'
  ) {
    throw new Error('App GUI conversation must show elapsed seconds while Codex is working');
  }
  if (
    pages.guid_home.conversation_feedback_policy?.model_status !==
    'single model selector appears in Codex conversation composer with no separate status pill; reasoning is a primary menu and model is a secondary menu'
  ) {
    throw new Error('App GUI conversation must use one model selector with no separate status pill');
  }
  const invocationReceiptPolicy = guiContract.agent_package_invocation_receipt_policy;
  if (
    invocationReceiptPolicy?.scope !== 'package_shortcut_launch_to_codex_conversation' ||
    invocationReceiptPolicy.route_kind !== 'agent_package_shortcut' ||
    invocationReceiptPolicy.executor !== 'codex_cli' ||
    invocationReceiptPolicy.source !== 'opl_app_home' ||
    invocationReceiptPolicy.receipt_authority !== 'launch_fact_only_no_session_behavior_domain_workflow_or_readiness' ||
    invocationReceiptPolicy.must_not_depend_on_visible_backend_selection !== true
  ) {
    throw new Error('App GUI contract must require launch-only agent package shortcut invocation receipts');
  }
  assertDeepEqualJson(
    invocationReceiptPolicy.required_for_package_shortcuts,
    ['research', 'ppt', 'grant', 'book', 'oma'],
    'App GUI agent package shortcut receipt ids',
  );
  assertIncludesAll(
    invocationReceiptPolicy.required_fields,
    ['route_kind', 'executor', 'package_id', 'shortcut_id', 'codex_visible_entry', 'required_skill_ids', 'source'],
    'App GUI agent package shortcut receipt fields',
  );
  assertIncludesAll(
    invocationReceiptPolicy.must_not_govern,
    ['session_behavior', 'domain_workflow', 'domain_readiness'],
    'App GUI agent package shortcut receipt non-authority fields',
  );
  if (guiContract.builtin_assistant_route_receipt_policy?.migration_alias_for !== 'agent_package_invocation_receipt_policy') {
    throw new Error('App GUI built-in assistant route receipt policy must be a migration alias');
  }
  if (
    guiContract.ordinary_capability_selector_policy?.scope !== 'home_composer_and_ordinary_conversation' ||
    guiContract.ordinary_capability_selector_policy?.authority !== 'app_owned_opl_allowlist' ||
    guiContract.ordinary_capability_selector_policy?.palette_agent_catalog_source_ref !== 'professional_agent_packages' ||
    JSON.stringify(guiContract.ordinary_capability_selector_policy?.palette_required_agent_package_ids) !==
      JSON.stringify(['mas', 'mag', 'rca', 'obf', 'oma']) ||
    JSON.stringify(guiContract.ordinary_capability_selector_policy?.palette_agent_group_label_i18n) !==
      JSON.stringify({ 'zh-CN': '专业智能体', 'en-US': 'Professional agents' }) ||
    guiContract.ordinary_capability_selector_policy?.palette_home_shortcut_independence_policy !==
      'complete_professional_agent_catalog_independent_of_home_shortcut_visibility_and_order' ||
    guiContract.ordinary_capability_selector_policy?.agent_owned_skill_deduplication_policy !==
      'exclude_rendered_professional_agent_required_skill_ids_from_home_new_session_standalone_skills' ||
    guiContract.ordinary_capability_selector_policy?.skill_source_ref !==
      'assistant_skill_profiles.required_skills + optional_skills' ||
    guiContract.ordinary_capability_selector_policy?.package_skill_source_ref !==
      'professional_agent_packages.required_skill_ids + optional_skill_ids' ||
    guiContract.ordinary_capability_selector_policy?.mcp_menu_policy !==
      'empty_until_app_explicitly_whitelists_opl_mcp_servers' ||
    guiContract.ordinary_capability_selector_policy?.conversation_loaded_skill_display_policy !==
      'filter_to_ordinary_skill_allowlist' ||
    guiContract.ordinary_capability_selector_policy?.conversation_loaded_mcp_display_policy !==
      'filter_to_visible_mcp_server_ids'
  ) {
    throw new Error('App GUI ordinary capability selector must be an App-owned OPL allowlist');
  }
  assertAgentReferenceAdmissionPolicy(
    guiContract.ordinary_capability_selector_policy.agent_reference_admission_policy,
    'App GUI Agent reference admission policy',
  );
  if (
    guiContract.interaction_baseline?.capability_selection?.agent_reference_admission_policy_ref !==
    'ordinary_capability_selector_policy.agent_reference_admission_policy'
  ) {
    throw new Error('App GUI capability selection must reference the canonical Agent admission policy');
  }
  assertDeepEqualJson(
    guiContract.ordinary_capability_selector_policy.visible_mcp_server_ids,
    [],
    'App GUI ordinary MCP allowlist',
  );
  assertIncludesAll(
    guiContract.ordinary_capability_selector_policy.forbidden_skill_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator', 'cron'],
    'App GUI ordinary selector forbidden skills',
  );
  assertIncludesAll(
    guiContract.ordinary_capability_selector_policy.forbidden_mcp_examples,
    ['aionui-team', 'team_*', 'mcp__aionui-team*', 'team_mcp_stdio_config', 'team_id/teamId'],
    'App GUI ordinary selector forbidden MCP examples',
  );
  assertForbiddenCapabilityPolicy(
    guiContract.ordinary_capability_selector_policy,
    ordinaryForbiddenCapabilityPolicy,
    'App GUI ordinary selector forbidden MCP policy',
  );
  assertDeepEqualJson(
    guiContract.ordinary_capability_selector_policy.required_scrub_targets,
    [
      'mcp_servers entries matching forbidden_mcp_matchers',
      'mcp_statuses entries matching forbidden_mcp_matchers',
      'session_mcp_servers entries matching forbidden_mcp_matchers',
      'scrub_extra_keys',
    ],
    'App GUI ordinary selector Team scrub targets',
  );
  if (
    guiContract.ordinary_capability_selector_policy.conversation_snapshot_policy !==
    'scrub_disabled_team_mcp_and_team_metadata_before_rendering_or_inheriting_ordinary_conversations'
  ) {
    throw new Error('App GUI ordinary selector must scrub disabled Team MCP snapshots from ordinary conversations');
  }
  assertIncludesAll(
    pages.guid_home.must_show,
    ['ordinary skill selector filtered to App-owned assistant profile skill allowlist'],
    'App GUI home ordinary selector must_show',
  );
  assertIncludesAll(
    pages.guid_home.must_not_show,
    [
      'AionUI implementation skills such as aionui-skills',
      'unknown MCP servers without an App profile allowlist entry',
      'AionUI Team MCP tools such as team_members, team_list_models, and team_spawn_agent',
    ],
    'App GUI home ordinary selector must_not_show',
  );
  if (pages.guid_home.activity_center_policy?.source !== 'runtime page only; Home does not query running task lists') {
    throw new Error('App GUI home activity center must be suppressed on ordinary Home and routed to Runtime/secondary context');
  }
  if (pages.guid_home.activity_center_policy?.authority !== 'app_owned_home_minimal_command_surface') {
    throw new Error('App GUI home activity center policy must be App-owned minimal command surface');
  }
  if (pages.guid_home.activity_center_policy?.default_placement !== 'not_rendered_on_ordinary_home') {
    throw new Error('App GUI home must not render the expanded activity center on ordinary Home');
  }
  if (pages.guid_home.activity_center_policy?.home_surface_policy !== 'ordinary_home_must_not_render_activity_center_or_continue_work_grid') {
    throw new Error('App GUI home must forbid ordinary Home activity center / continue-work grid rendering');
  }
  assertDeepEqualJson(
    pages.guid_home.activity_center_policy.allowed_home_runtime_context,
    [],
    'App GUI home allowed runtime context',
  );
  assertIncludesAll(
    pages.guid_home.activity_center_policy.must_not_display,
    homeActivityCenterForbiddenDisplays,
    'App GUI home activity center forbidden displays',
  );
  for (const hiddenSignal of [
    'compact continue-work entry near the home input',
    'needs attention, active, and recent refs on Home',
    'Home footer feedback icon',
    'Home footer favorite/star icon',
    'Home footer web/access globe icon',
    'per-assistant running badges derived from module or domain lane diagnostics',
  ]) {
    if (!pages.guid_home.must_not_show?.includes(hiddenSignal)) {
      throw new Error(`App GUI home must not show ${hiddenSignal}`);
    }
  }
  for (const [pageId, page] of Object.entries(pages).filter(([id]) => id === 'about' || id === 'update' || id.startsWith('settings_'))) {
    assertNonEmptyStringArray(page.sections, `App GUI ${pageId} sections`);
    assertNonEmptyStringArray(page.must_show, `App GUI ${pageId} must_show`);
    assertNonEmptyStringArray(page.must_not_show, `App GUI ${pageId} must_not_show`);
  }
  const settingsExperiencePages = {
    settings_general: 'overview',
    settings_gateway: 'gateway',
    settings_access: 'models',
    settings_workspace: 'workspace',
    settings_agents: 'agents',
    settings_capabilities: 'capabilities',
    settings_resources: 'resources',
    settings_environment: 'maintenance',
    settings_storage: 'storage',
    settings_theme: 'preferences',
    about: 'about',
  };
  for (const [pageId, productPageId] of Object.entries(settingsExperiencePages)) {
    if (
      pages[pageId]?.product_page_id !== productPageId ||
      pages[pageId]?.experience_contract_ref !==
        `contracts/app-settings-control-plane.json#experience_contract.page_contracts.${productPageId}`
    ) {
      throw new Error(`App GUI ${pageId} must reference the ${productPageId} experience contract`);
    }
  }
  assertDeepEqualJson(
    pages.settings_environment.managed_dependency_summary,
    appOwnedSettingsManagedDependencySummary,
    'App GUI Maintenance managed dependency summary',
  );
  if (pages.settings_access.model_access_source !== 'app_state.core.codex.model_access_source') {
    throw new Error('Settings Access must use app_state.core.codex.model_access_source');
  }
  const gatewayAccount = pages.settings_gateway.opl_gateway_account;
  if (
    gatewayAccount?.projection_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_projection' ||
    gatewayAccount.projection_path !== 'app_state.settings_control_center.app_settings_read_model.opl_gateway_account' ||
    gatewayAccount.secret_bridge_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_secret_bridge' ||
    gatewayAccount.account_card_visibility !== 'account_connection_only' ||
    gatewayAccount.manual_api_key_card_policy !== 'model_access_status_only_no_account_balance_or_account_usage' ||
    gatewayAccount.cache_ttl_seconds !== 900 ||
    gatewayAccount.stale_policy !== 'show_cached_values_with_stale_marker_and_manual_refresh' ||
    gatewayAccount.first_run_scope !== 'desktop_account_default_webui_manual_api_key_only' ||
    gatewayAccount.personal_profile_navigation !== 'not_added'
  ) {
    throw new Error('Settings Account & Access must declare the canonical OPL Gateway account product contract');
  }
  assertDeepEqualJson(gatewayAccount.access_paths, ['account_login', 'manual_api_key'], 'Settings Gateway access paths');
  assertDeepEqualJson(
    gatewayAccount.error_states,
    ['auth_expired', 'managed_key_missing', 'managed_key_conflict', 'managed_key_identity_drift', 'disconnect_pending'],
    'Settings Gateway visible repair states',
  );
  assertIncludesAll(
    pages.settings_gateway.must_not_show,
    [
      'Gateway password login in browser WebUI',
      'password, access token, refresh token, API Key material, remote Key id, credential path, raw response, or raw error',
      'Gateway account card in manual API-key mode or when no Gateway account is connected',
    ],
    'Settings Gateway privacy and visibility boundaries',
  );
  assertIncludesAll(
    pages.settings_access.must_show,
    ['page label Models or 模型', 'selected and default model', 'one route to Account & Access when credentials need attention'],
    'Settings Models user entry contract',
  );
  assertIncludesAll(
    pages.settings_access.must_not_show,
    ['Gateway account card, balance, usage, login form, managed Key lifecycle, or manual API-key form'],
    'Settings Models Gateway deduplication boundary',
  );
  if (pages.settings_access.browser_access_entry !== undefined) {
    throw new Error('Settings Models must not own browser access');
  }
  assertDeepEqualJson(
    pages.settings_resources.browser_access_entry,
    appOwnedSettingsResourcesBrowserEntry,
    'Settings Resources browser entry',
  );
  assertIncludesAll(
    pages.settings_resources.must_show,
    [
      'browser access to this computer with port, account, and password management entry',
      'resource readiness and action executability as separate states',
    ],
    'Settings Resources readiness boundary',
  );
  assertIncludesAll(
    pages.settings_resources.must_not_show,
    [
      'selected local workspace path, change-workspace controls, or permission summary duplicated from Workspace',
      'built-in OPL Gateway connection or Gateway count owned by Account & Access',
      'dry-run success presented as resource opened, diagnosis completed, deployment completed, or mutation completed',
    ],
    'Settings Resources Workspace deduplication',
  );
  assertDeepEqualJson(
    pages.settings_resources.action_behavior,
    appOwnedSettingsResourceActionBehavior,
    'Settings Resources action behavior',
  );
  assertDeepEqualJson(
    pages.settings_capabilities.tab_contract,
    appOwnedSettingsCapabilitiesTabContract,
    'Settings Capabilities source-group tab contract',
  );
  assertDeepEqualJson(
    pages.settings_capabilities.entity_kinds,
    ['skill', 'plugin', 'mcp_server', 'image_generation', 'voice_input'],
    'Settings Capabilities entity kinds',
  );
  if (
    pages.settings_capabilities.lifecycle_policy?.hardcoded_app_skill_list_allowed !== false ||
    pages.settings_capabilities.lifecycle_policy?.cli_currentness_owner !== 'opl_base' ||
    pages.settings_capabilities.lifecycle_policy?.flow_role !== 'dependency_and_profile_intent_only_not_a_second_updater'
  ) {
    throw new Error('Settings Capabilities must derive Flow membership from package closure and leave CLI currentness to OPL Base');
  }
  const agentDirectoryTarget = pages.settings_agents.codex_plugin_directory_target;
  const agentStatusModel = pages.settings_agents.status_model;
  if (
    agentDirectoryTarget?.primary_layout !==
      'compact_grouped_package_list_with_inline_dependency_children_and_right_details_panel' ||
    agentDirectoryTarget?.catalog_presentation_policy_ref !==
      'contracts/app-product-profile.json#gui.agent_package_registry.catalog_presentation_policy' ||
    agentDirectoryTarget?.developer_configuration_disclosure !==
      'collapsed_by_default_above_the_catalog' ||
    pages.settings_agents.list_density_policy?.grouping_policy_ref !==
      'contracts/app-product-profile.json#gui.agent_package_registry.catalog_presentation_policy' ||
    pages.settings_agents.list_density_policy?.row_hierarchy_policy !==
      'one_projected_package_one_row_with_single_parent_dependencies_nested_and_shared_dependencies_grouped' ||
    agentStatusModel?.user_facing_projection_ref !==
      'contracts/app-gui-product-contract.json#pages.settings_agents.agent_package_lifecycle_ux.user_facing_status_projection' ||
    agentStatusModel?.localized_metadata_source_ref !==
      'contracts/app-product-profile.json#gui.agent_package_registry.first_party_release_set_metadata' ||
    pages.settings_agents.developer_mode_control?.default_disclosure !== 'collapsed'
  ) {
    throw new Error('Settings Agents must use the App-owned grouped catalog presentation with collapsed developer controls');
  }
  assertIncludesAll(
    pages.settings_agents.must_show,
    [
      'localized package role labels with no raw internal enum on the ordinary row',
      'professional Agents ordered by App product metadata, workflow profiles separated, and dependency packages grouped from dependent_guard.required_by_package_ids',
      'runtime source and authorized repository maintenance controls collapsed as advanced configuration by default',
      'localized names and descriptions for every current first-party directory item, including OPL Meta Agent, MAS Scholar Skills, and OPL Flow',
      'verification deferred or scope materialization missing on an installed exposed Agent shown as 可用 with no preflight Settings action; domain StageRun readiness stays Framework-owned',
      'one localized status, one concrete explanation, and at most one most relevant action per package with technical status axes confined to details',
    ],
    'Settings Agents grouped catalog signals',
  );
  assertIncludesAll(
    pages.settings_agents.must_not_show,
    [
      'hardcoded package parent-child relationships or duplicate dependency rows',
      'raw setup_required, local_check_not_completed, verification_deferred, scope_materialization_missing, 待验证, 需关注, 不可使用, or contradictory availability labels on ordinary Agent rows',
      'global workspace root used as a target_workspace activation value from Settings',
      'scope materialization missing presented as a Settings attention state or preflight action',
      'agent_package_activate shown or executed as a Settings, new-conversation, or ordinary-send action',
      'aggregate ready or unavailable counts used as the status of every package',
    ],
    'Settings Agents forbidden dependency synthesis',
  );
  validateAgentPackageLifecycleUx(
    pages.settings_agents.agent_package_lifecycle_ux,
    'Settings Agents Agent Package lifecycle UX',
  );
  validateOplFlowContext(guiContract.opl_flow_context, 'App GUI OPL Flow Context');
  if (
    pages.settings_workspace?.ia_group !== 'workspace' ||
    !pages.settings_workspace.sections?.includes('system_agents') ||
    !pages.settings_workspace.sections?.includes('opl_app_context') ||
    !pages.settings_workspace.must_show?.includes(
      'Workspace as a top-level Settings group with Working Directory and Data & Storage destinations',
    ) ||
    !pages.settings_workspace.must_show?.includes(
      'content-width responsive single-column rows when the Settings reading lane is narrow',
    ) ||
    !pages.settings_workspace.must_show?.includes('Codex instruction editors use unframed field groups without nested cards') ||
    !pages.settings_workspace.must_not_show?.includes('App log directory controls owned by Logs & Diagnostics') ||
    !pages.settings_workspace.must_not_show?.includes('System AGENTS.md or new-conversation context presented as Workspace children') ||
    !pages.settings_workspace.must_not_show?.includes('App log directory presented as a Workspace child') ||
    !pages.settings_workspace.must_not_show?.includes('Framework and raw paths duplicated from Maintenance diagnostics')
  ) {
    throw new Error('Settings Workspace must retain carrier transport while exposing only working directory and data storage as Workspace children');
  }
  if (
    pages.settings_storage.sections?.includes('log_directory') ||
    !pages.settings_storage.must_show?.includes(
      'read-only Logs & Diagnostics-owned log path reference',
    ) ||
    !pages.settings_storage.must_not_show?.includes('log directory edit control') ||
    pages.settings_theme.sections?.includes('personalization')
  ) {
    throw new Error('Settings Storage may reference App logs read-only and Preferences must not duplicate Workspace personalization');
  }
  if (
    pages.settings_local_services?.page_kind !== 'compatibility_redirect' ||
    pages.settings_local_services.compatibility_redirect?.target_route_id !== 'environment' ||
    pages.settings_local_services.compatibility_redirect?.anchor !== 'services'
  ) {
    throw new Error('Settings Local Services must redirect to Maintenance#services');
  }
  if (pages.settings_environment.module_path_source_policy_ref !== 'module_path_source_policy') {
    throw new Error('Settings Environment must reference the App GUI module path source policy');
  }
  if (
    !pages.settings_environment.must_show?.includes(
      'check, apply, repair, rollback, and package maintenance directly on the daily Maintenance page with progressive confirmation and fresh readback',
    ) ||
    !pages.settings_environment.must_show?.includes(
      'one advanced read-only diagnostics disclosure for localized component, path, and receipt evidence',
    ) ||
    !pages.settings_environment.must_not_show?.includes(
      'a separate large management modal overlapping the advanced diagnostics disclosure',
    ) ||
    !pages.settings_environment.must_not_show?.includes(
      'raw internal status keys, action ids, command mappings, or payload field names anywhere in user-facing Maintenance UI',
    )
  ) {
    throw new Error('Settings Maintenance must own daily actions and one read-only diagnostics disclosure without overlapping modals or raw keys');
  }
  const maintenanceActionPolicy = pages.settings_environment.maintenance_action_policy;
  assertDeepEqualJson(
    maintenanceActionPolicy?.required_action_roles,
    [
      'refresh_status',
      'check_updates',
      'apply_update',
      'repair_component',
      'rollback_component',
      'bootstrap_missing_opl_base',
      'update_opl_app',
      'install_or_update_opl_package',
      'repair_or_uninstall_opl_package',
    ],
    'Settings Maintenance daily action roles',
  );
  if (
    maintenanceActionPolicy?.advanced_actions_policy !==
      'nonrecommended actions stay in the same page action area or progressive confirmation and never move into diagnostics or a second large management modal' ||
    maintenanceActionPolicy?.surface_owner_policy !==
      'daily_Maintenance_page_owns_check_apply_repair_and_rollback'
  ) {
    throw new Error('Settings Maintenance actions must stay on the page and outside the read-only diagnostics disclosure');
  }
  validateEnvironmentModuleMaintenanceEntry(pages.settings_environment.module_maintenance_entry, 'Settings Environment');
  if (!pages.settings_environment.must_not_show?.includes('Med Deep Scientist as a default module')) {
    throw new Error('Settings Environment must keep MDS out of default module display');
  }
  if (
    pages.settings_environment.software_lifecycle_ref !==
    'contracts/app-release-channel.json#managed_update_plane.software_lifecycle'
  ) {
    throw new Error('Settings Environment must reference the canonical three-object software lifecycle');
  }
  validateFrameworkModuleMaintenanceEntry(guiContract.framework_surfaces?.managed_update_plane?.ordinary_module_maintenance_entry);
  const carrierReconcile = guiContract.framework_surfaces?.managed_update_plane?.carrier_reconciliation;
  if (
    carrierReconcile?.contract_ref !== 'contracts/app-release-channel.json#managed_update_plane.carrier_reconciliation' ||
    carrierReconcile?.trigger !== 'app_startup_after_core_ready_when_running_app_version_checkpoint_is_missing_or_changed' ||
    carrierReconcile?.installation_source_scope !== 'all_supported_app_carriers' ||
    carrierReconcile?.installation_source_registry_ref !==
      'contracts/app-install-exposure-policy.json#installer_surfaces+distribution_channels' ||
    carrierReconcile?.execution_owner !== 'one-person-lab' ||
    carrierReconcile?.catalog_source !== 'framework_managed_update_plan' ||
    carrierReconcile?.app_catalog_allowed !== false ||
    carrierReconcile?.app_role !== 'request_and_project_framework_terminal_readback_and_apply_receipts_only' ||
    carrierReconcile?.idempotency !== 'once_per_running_app_version_or_image_digest_and_carrier_identity' ||
    carrierReconcile?.readback !== 'opl app state --profile fast --json#managed_update' ||
    carrierReconcile?.silent_apply_source !== 'framework_plan_auto_apply.eligible_and_app_background_safe_with_command_ref' ||
    carrierReconcile?.direct_skill_delete_allowed !== false ||
    carrierReconcile?.direct_agents_write_allowed !== false
  ) {
    throw new Error('App GUI must request carrier-neutral Framework reconciliation and project terminal readback plus apply receipts without a second catalog');
  }
  assertDeepEqualJson(
    carrierReconcile?.projection_prefetch,
    {
      command: 'opl update status --json',
      publish_when: 'valid_typed_status_readback_available',
      purpose: 'make_framework_typed_state_available_before_network_check_and_plan_complete',
      failure_policy: 'continue_reconciliation_without_clearing_last_valid_projection',
    },
    'App GUI carrier reconciliation projection prefetch',
  );
  assertDeepEqualJson(
    carrierReconcile?.command_sequence,
    [
      'opl update check --json',
      'opl update plan --json',
      'opl update apply --json',
      'opl update status --json',
    ],
    'App GUI carrier reconciliation command sequence',
  );
  assertDeepEqualJson(carrierReconcile?.software_object_scope, ['opl_base', 'opl_packages'], 'App GUI carrier reconciliation scope');
  if (pages.settings_storage.release_contract_ref !== 'contracts/app-release-channel.json#local_data_lifecycle') {
    throw new Error('Settings Storage must reference the App local data lifecycle contract');
  }
  if (
    pages.settings_storage.state_source !==
      'active shell local data lifecycle service + Framework and carrier-host owner projections from opl app state --profile fast --json + contracts/app-release-channel.json#local_data_lifecycle'
  ) {
    throw new Error('Settings Storage must merge Shell lifecycle state with Framework and carrier-host owner projections');
  }
  const ownerStorage = pages.settings_storage.owner_storage_projections;
  assertDeepEqualJson(
    ownerStorage?.sections,
    ['agent_package_store', 'webui_data_volume'],
    'Settings Storage owner projection sections',
  );
  assertDeepEqualJson(
    ownerStorage?.common_required_fields,
    ['status', 'observed_at', 'stale', 'bytes', 'reclaimable_bytes', 'owner_route', 'projected_action'],
    'Settings Storage owner projection fields',
  );
  if (
    ownerStorage?.projection_source !== 'opl app state --profile fast --json' ||
    ownerStorage?.missing_projection_policy !== 'fail_open_keep_shell_owned_categories_available' ||
    ownerStorage?.unknown_bytes_policy !== 'unavailable_never_zero' ||
    ownerStorage?.agent_package_store?.owner_route !== '/settings/agents' ||
    ownerStorage?.agent_package_store?.direct_storage_mutation_allowed !== false ||
    ownerStorage?.webui_data_volume?.data_volume_mapping !== 'OnePersonLab/data -> /data' ||
    ownerStorage?.webui_data_volume?.host_action_capability_id !== appOwnedWebuiDataVolumeHostActionCapabilityId ||
    ownerStorage?.webui_data_volume?.host_action_abi_ref !== appOwnedWebuiDataVolumeHostActionAbiRef ||
    ownerStorage?.webui_data_volume?.generic_docker_prune_allowed !== false ||
    ownerStorage?.webui_data_volume?.shell_direct_path_delete_allowed !== false
  ) {
    throw new Error('Settings Storage owner projections must remain fail-open and owner-routed without direct Shell cleanup');
  }
  assertDeepEqualJson(
    pages.settings_storage.storage_carrier_behavior,
    appOwnedStorageCarrierBehavior,
    'Settings Storage carrier behavior',
  );
  validateReadOnlyStorageLifecycleSurface(
    pages.settings_storage.read_only_lifecycle_surface,
    'Settings Storage read-only lifecycle surface',
  );
  if (!pages.about.must_show?.includes('Stable or Nightly channel')) {
    throw new Error('About page must show Stable or Nightly channel');
  }
  if (
    !pages.about.must_show?.includes('cached update status from the one startup check or last manual check') ||
    !pages.about.must_show?.includes('one Check for updates action') ||
    !pages.about.must_not_show?.includes('about redirected to Advanced') ||
    pages.about.product_page_id !== 'about'
  ) {
    throw new Error('About must remain independent with version, channel, and update status');
  }
  assertDeepEqualJson(
    pages.about.updater_state_policy,
    appOwnedSettingsAboutUpdaterStatePolicy,
    'About updater state policy',
  );
  if (
    pages.update?.page_kind !== 'compatibility_redirect' ||
    pages.update.compatibility_redirect?.target_route_id !== 'environment' ||
    pages.update.compatibility_redirect?.anchor !== 'updates'
  ) {
    throw new Error('Update must redirect to Maintenance#updates');
  }
  if (
    pages.settings_theme.product_page_id !== 'preferences' ||
    !pages.settings_theme.must_show?.includes('application behavior and notifications in a full-width group') ||
    !pages.settings_theme.must_show?.includes(
      'reply waiting time, idle-assistant release, and hardware acceleration in a named performance and background activity group',
    ) ||
    !pages.settings_theme.must_show?.includes('System, Light, and Dark appearance choices under the display anchor') ||
    !pages.settings_theme.must_not_show?.includes('CSS theme preset gallery or Codex preset selector') ||
    !pages.settings_theme.must_not_show?.includes('custom theme editor in the ordinary Preferences surface')
  ) {
    throw new Error('Settings Preferences must expose behavior, performance, and governed appearance configuration');
  }
  if (
    pages.settings_personalization?.page_kind !== 'compatibility_redirect' ||
    pages.settings_personalization.compatibility_redirect?.target_route_id !== 'workspace' ||
    pages.settings_personalization.compatibility_redirect?.anchor !== 'personalization'
  ) {
    throw new Error('Personalization must redirect to Workspace#personalization');
  }
  validateRuntimeCockpitPreservationPolicy(
    guiContract.interaction_baseline?.feature_preservation_policy?.runtime_preservation_gate,
    'App GUI Runtime cockpit preservation gate',
  );
  const runtimeStatus = pages.runtime_status;
  if (
    runtimeStatus &&
    (runtimeStatus.route_classification !== 'retained_optional_x0_owner_route' ||
      runtimeStatus.default_product_requirement !== false ||
      runtimeStatus.default_release_gate !== false ||
      runtimeStatus.native_phase_one_requirement !== false ||
      runtimeStatus.explicit_validation_command !== 'npm run validate:runtime-route')
  ) {
    throw new Error('Optional Runtime route must stay outside the default product, release, and Native phase-one gates');
  }
  validateTaskAwarenessProjectionContract(
    guiContract.framework_surfaces?.task_awareness,
    'App GUI framework task awareness',
  );
  validateStructuredResultPanelProjectionContract(
    guiContract.framework_surfaces?.structured_result_panel,
    'App GUI framework structured result panel',
  );
  validateRefLevelFollowUpProjectionContract(
    guiContract.framework_surfaces?.ref_level_follow_up,
    'App GUI framework ref-level follow-up',
  );
  validateWorkflowSkillCandidateProjectionContract(
    guiContract.framework_surfaces?.workflow_skill_candidate,
    'App GUI framework workflow/skill candidate',
  );
  if ('docker_webui' in guiContract) {
    throw new Error('App GUI contract must not include withdrawn Docker/WebUI username, title, logo, or branding requirements');
  }
}

function validateFrameworkModuleMaintenanceEntry(entry) {
  if (
    entry?.settings_page !== 'settings_environment' ||
    entry?.display_role !== 'user_facing_module_maintenance_entry' ||
    entry?.app_role !== 'managed_update_status_action_consumer_only' ||
    entry?.kernel_implementation_allowed !== false ||
    entry?.domain_truth_write_allowed !== false ||
    entry?.developer_checkout_silent_update_allowed !== false ||
    entry?.dirty_checkout_silent_update_allowed !== false
  ) {
    throw new Error('App GUI managed update plane must expose module maintenance under Local Environment without owning the update kernel');
  }
  assertIncludesAll(
    entry?.must_include_modules,
    ['MAS', 'MAG', 'RCA', 'OMA', 'OBF', 'MAS Scholar Skills'],
    'App GUI framework module maintenance modules',
  );
  assertDeepEqualJson(
    entry?.status_sources,
    ['opl app state --profile fast --json#managed_update', 'opl update status --json#managed_update'],
    'App GUI framework module maintenance status sources',
  );
  assertDeepEqualJson(
    entry?.manual_action_mapping,
    {
      refresh: 'opl update status --json',
      check: 'opl update check --json',
      plan: 'opl update plan --json',
      apply_eligible_updates: 'opl update apply --json',
      bootstrap_missing_opl_base: 'opl-install.sh --headless --skip-packages',
      update_opl_app: 'standard_updater_or_carrier_host_update_route',
      install_opl_package: 'opl packages install ... --json',
      update_opl_package: 'opl packages update ... --json',
      repair_opl_package: 'opl packages repair --package-id <package_id> --json',
      uninstall_opl_package: 'opl packages uninstall --package-id <package_id> --json',
    },
    'App GUI framework module maintenance action mapping',
  );
}
