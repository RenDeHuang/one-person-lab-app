import { assertDeepEqualJson, assertForbiddenCapabilityPolicy, assertIncludesAll, readJson } from './assertions.ts';
import {
  appActionRoute,
  appOwnedSettingsResourcesBrowserEntry,
  appOwnedSettingsCapabilitiesTabContract,
  appOwnedSettingsResourceActionBehavior,
  appOwnedTaskAwarenessRefFields,
  focusedFirstRunPresentationPolicy,
  homeActivityCenterForbiddenDisplays,
  progressiveFirstRunRecoveryPolicy,
  progressiveFirstRunRecoveryTestIds,
} from './app-contract-constants.ts';
import { validateGuiFrameworkSurfaces } from './gui-framework-surfaces-validator.ts';
import { validateGuiProductHomeContract } from './gui-product-home-validator.ts';
import { assertCommandSurface } from './value-helpers.ts';
import {
  validateEnvironmentModuleMaintenanceEntry,
} from './managed-update-plane-validator.ts';
import { productProfilePath, runtimeBridgePath, settingsControlPlanePath } from './validation-config.ts';
import { validateSettingsControlPlaneBehavior } from './settings-control-plane-validator.ts';
import {
  assertNonEmptyStringArray,
  validateArtifactNativeDrilldownProjectionContract,
  validateBeginnerFirstRunPresentation,
  validateOplFlowContext,
  validateProgressDeltaDisplayContract,
  validateRefLevelFollowUpProjectionContract,
  validateStateIndexSidecarProjectionContract,
  validateStructuredResultPanelProjectionContract,
  validateTaskAwarenessProjectionContract,
  validateWorkflowSkillCandidateProjectionContract,
  validateUserTaskStatusProjectionContract,
  assertFirstRunProgressModelMatches,
} from './shared-contract-validators.ts';

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
const runtimeBridge = readJson(runtimeBridgePath);
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

function validateAgentPackageLifecycleUx(surface, label) {
  if (
    surface?.requirement_scope !== 'product_requirement_not_runtime_authority' ||
    surface.primary_state_surface !== 'app_state.agent_packages.directory + app_state.agent_packages.status_index' ||
    surface.fallback_state_surface !== 'app_state.modules.items[]' ||
    surface.action_ref_source !== 'app_state.actions' ||
    surface.action_route !== appActionRoute
  ) {
    throw new Error(`${label} must define package-directory lifecycle UX as App product truth over App state/action refs`);
  }
  assertDeepEqualJson(surface.shell_consumers, ['aionui', 'opl_native_workbench'], `${label} shell consumers`);
  assertIncludesAll(
    surface.field_behavior_checklist,
    [
      'search_by_package_name_short_name_tag_source_or_description',
      'filter_by_install_update_source_trust_codex_surface_and_home_visibility_state',
      'explain_install_source_in_user_language',
      'show_failure_reason_only_when_failed_blocked_or_needs_user_action',
      'operational_ready_false_or_dependency_repair_required_must_never_render_ready',
      'show_dependency_readiness_and_dependent_guard_in_normal_details',
      'trigger_only_projected_repair_action_when_enabled',
      'show_receipt_and_physical_surface_in_details_or_advanced_only',
      'use_consistent_confirmation_and_receipt_pattern_for_hide_disable_update_repair_uninstall_install_and_launch',
      'display_rollback_ref_as_recovery_reference_only_no_app_rollback_verb',
    ],
    `${label} checklist`,
  );
  assertIncludesAll(
    surface.directory_controls?.top_controls,
    ['refresh_registry', 'search_by_package_name_tag_or_description', 'status_filter', 'manifest_url_install'],
    `${label} top controls`,
  );
  assertIncludesAll(
    surface.directory_controls?.filters,
    ['status', 'source', 'trust', 'codex_surface', 'home_visibility', 'purpose_tag'],
    `${label} filters`,
  );
  assertIncludesAll(
    surface.directory_controls?.row_actions,
    ['hide', 'unhide', 'disable', 'enable', 'update', 'repair', 'uninstall', 'launch', 'open_details'],
    `${label} row actions`,
  );
  assertIncludesAll(
    surface.source_explanation_fields,
    ['source_label', 'source_kind', 'trust_tier', 'manifest_url', 'distribution_ref', 'developer_source_warning'],
    `${label} source explanation fields`,
  );
  assertIncludesAll(
    surface.failure_reason_fields,
    ['failure_reason', 'blocker_summary', 'last_action_receipt_ref', 'recommended_action', 'dependency_readiness.status', 'dependency_readiness.checks[].failure_reasons', 'operational_ready', 'dependent_guard.disable.reason_code', 'dependent_guard.uninstall.reason_code'],
    `${label} failure reason fields`,
  );
  const detail = surface.receipt_physical_surface_detail_policy;
  if (detail?.surface !== 'details_panel_or_advanced_diagnostics' || detail.default_primary_row_visible !== false) {
    throw new Error(`${label} must keep receipts and physical_surface out of primary row density`);
  }
  assertIncludesAll(
    detail.receipt_fields,
    ['receipt_refs', 'package_lock_ref', 'action_receipt_ref', 'rollback_ref', 'dependency_closure.transaction_id', 'dependency_closure.generation_id', 'dependency_closure.closure_digest', 'dependency_closure.last_known_good_generation_id', 'dependency_closure.last_known_good_closure_digest'],
    `${label} receipt fields`,
  );
  const projection = surface.package_projection_contract;
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
  if (
    projection?.status_index_package_fields?.operational_ready !== 'boolean' ||
    projection?.repair_action_id !== 'repair_dependency_closure' ||
    projection?.closure_diagnostics_surface !== 'advanced_diagnostics_only'
  ) {
    throw new Error(`${label} must define generic dependency closure readiness and repair projection`);
  }
  assertDeepEqualJson(projection?.forbidden_private_fields, ['staging_path', 'journal_path'], `${label} private fields`);
  assertIncludesAll(
    detail.physical_surface_fields,
    [
      'status',
      'plugin_id',
      'marketplace_id',
      'codex_plugin_cache_path',
      'marketplace_path',
      'codex_config_path',
      'required_skill_ids',
      'required_skill_paths',
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

export function validateAppGuiProductContract(guiContract, releaseChannel, installExposurePolicy) {
  validateGuiProductHomeContract(guiContract);
  validateCodexModelPolicy(guiContract);
  validateGuiFrameworkSurfaces(guiContract, releaseChannel, installExposurePolicy);
  validateSettingsControlPlaneBehavior({ guiContract });

  const startupReadModelPolicy = guiContract.framework_surfaces?.canonical_state?.startup_read_model_policy;
  if (
    startupReadModelPolicy?.blocking_policy !==
    'ordinary_startup_and_guid_navigation_are_non_blocking_core_failures_only_restrict_dependent_capabilities'
  ) {
    throw new Error('App GUI startup read model must keep Guid navigation non-blocking');
  }

  if (guiContract.theme_and_branding?.default_theme_id !== 'default-theme') {
    throw new Error('App GUI default theme must be default-theme');
  }
  for (const themeId of ['codex', 'default-theme']) {
    if (!guiContract.theme_and_branding.allowed_theme_ids?.includes(themeId)) {
      throw new Error(`App GUI theme list must include ${themeId}`);
    }
  }
  for (const section of [
    'general',
    'access',
    'workspace',
    'capabilities',
    'resources',
    'environment',
    'storage',
    'appearance',
    'advanced',
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
    ['update', 'theme', 'local-services'],
    'App GUI hidden compatibility routes',
  );
  assertDeepEqualJson(
    guiContract.settings_navigation?.legacy_route_redirects,
    Object.fromEntries(
      Object.entries(settingsControlPlane.legacy_route_redirects ?? {})
        .filter(([id]) => id !== 'about')
        .map(([id, target]) => [id, id === 'assistants' ? target : String(target).split('?')[0]]),
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
    'capabilities?tab=skills'
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
  if (guiContract.settings_navigation.source !== 'opl app state --profile fast --json') {
    throw new Error('App GUI settings navigation must default to fast App state');
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
    ordinaryRecovery?.file_and_project_context?.plain_conversation_remains_available !== true ||
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
    ordinaryRecovery.file_and_project_context.required_items,
    progressiveFirstRunRecoveryPolicy.file_and_project_required_items,
    'App GUI first-launch file and project prerequisites',
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
    'whether a module comes from the App/CLI-managed GHCR OCI OPL Packages rolling latest channel',
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
    developerProfile.opt_in_policy !== 'explicit_opt_in_only' ||
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
    developerProfile.settings_pages[0] !== 'settings_capabilities' ||
    developerProfile.control_model?.global_mode?.control !== 'three_state_segmented_control' ||
    developerProfile.control_model?.safe_maintenance?.independent_from_source_selection !== true ||
    developerProfile.control_model?.package_source?.control !== 'segmented_control_in_package_details' ||
    !developerProfile.must_show?.includes('per-package auto managed developer source control') ||
    !developerProfile.must_not_show?.includes('five equal capability-axis cards')
  ) {
    throw new Error('App GUI Developer Profile must provide direct global and per-package source controls on Capabilities');
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
    'settings_access',
    'settings_workspace',
    'settings_capabilities',
    'settings_resources',
    'settings_environment',
    'settings_advanced',
    'about',
    'update',
    'settings_theme',
    'settings_local_services',
    'runtime_status',
  ]) {
    if (!pages[pageId]) {
      throw new Error(`App GUI contract missing page ${pageId}`);
    }
  }
  for (const pageId of [
    'guid_home',
    'settings_general',
    'settings_access',
    'settings_capabilities',
    'settings_environment',
    'settings_advanced',
    'about',
    'update',
    'settings_theme',
  ]) {
    assertCommandSurface(pages[pageId].state_source, 'opl app state --profile fast --json', `App GUI ${pageId} state source`);
    assertCommandSurface(pages[pageId].refresh_source, 'opl app state --profile fast --json', `App GUI ${pageId} refresh source`);
  }
  if (
    !pages.guid_home.must_show?.includes(
      'all user-visible configured OPL starters in stable order without silent truncation',
    )
  ) {
    throw new Error('App GUI home must show every user-visible configured OPL starter without silent truncation');
  }
  if (!pages.guid_home.must_show?.includes('active capability shown as a compact chip')) {
    throw new Error('App GUI home must show the active capability as a compact chip');
  }
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
  if (!pages.guid_home.must_not_show?.includes('OPL Meta Agent as a default home assistant')) {
    throw new Error('App GUI home must keep OMA out of default home entries');
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
    ['research', 'grant', 'ppt', 'book', 'oma'],
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
    settings_access: 'access',
    settings_workspace: 'workspace',
    settings_capabilities: 'capabilities',
    settings_resources: 'resources',
    settings_environment: 'maintenance',
    settings_storage: 'storage',
    settings_theme: 'preferences',
    settings_advanced: 'advanced',
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
  if (pages.settings_access.model_access_source !== 'app_state.core.codex.model_access_source') {
    throw new Error('Settings Access must use app_state.core.codex.model_access_source');
  }
  assertIncludesAll(
    pages.settings_access.must_show,
    ['page label Models & Access or 模型与访问', 'selected and default model'],
    'Settings Access user entry contract',
  );
  if (pages.settings_access.browser_access_entry !== undefined) {
    throw new Error('Settings Models & Access must not own browser access');
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
    pages.settings_capabilities.codex_plugin_directory_target?.tab_contract,
    appOwnedSettingsCapabilitiesTabContract,
    'Settings Agents & Capabilities tab contract',
  );
  assertIncludesAll(
    pages.settings_capabilities.must_not_show,
    ['AionUI AssistantSettings or custom assistant catalogs exposed from OPL Settings'],
    'Settings Agents & Capabilities OPL-only surface',
  );
  if (
    pages.settings_capabilities.builtin_skill_catalog_policy?.allowed_set_ref !==
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids + additional_package_skill_ids + opl_flow_dependency_policy_ref'
  ) {
    throw new Error('Settings Capabilities must filter builtin skill catalog through the App packaged skill set');
  }
  assertIncludesAll(
    pages.settings_capabilities.builtin_skill_catalog_policy?.forbidden_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator'],
    'Settings Capabilities forbidden upstream builtin skills',
  );
  if (
    pages.settings_capabilities.auto_injected_skills_policy?.allowed_set_ref !==
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids'
  ) {
    throw new Error('Settings Capabilities must filter auto-injected skills through the App packaged skill set');
  }
  assertIncludesAll(
    pages.settings_capabilities.auto_injected_skills_policy?.forbidden_examples,
    ['aionui-skills', 'aionui-webui-setup', 'skill-creator'],
    'Settings Capabilities forbidden upstream auto skills',
  );
  if (
    pages.settings_capabilities.task_awareness_refs_source !==
      'contracts/app-runtime-bridge.json#task_awareness_projection.settings_capabilities_surface' ||
    pages.settings_capabilities.task_awareness_ref_policy !==
      'thin_renderer_refs_only_no_skill_body_no_artifact_body_no_domain_verdict' ||
    pages.settings_capabilities.export_bundle_action_policy !==
      'show_export_bundle_action_ref_and_dry_run_receipt_without_claiming_domain_export_readiness'
  ) {
    throw new Error('Settings Capabilities must consume task awareness refs as display-only App state refs');
  }
  assertDeepEqualJson(
    pages.settings_capabilities.task_awareness_ref_fields,
    appOwnedTaskAwarenessRefFields,
    'Settings Capabilities task awareness ref fields',
  );
  assertIncludesAll(
    pages.settings_capabilities.must_show,
    [
      'capability health and connector readiness refs from OPL App state',
      'OPL Connect connector readiness grouped by literature, database, storage, tools/API, internal system, and compute scheduler refs',
      'OPL Fabric environment and resource-source refs when capability tasks need managed or user-provided resources',
      'Environment Catalog refs grouped with OPL Fabric resource readiness when capability tasks declare runtime requirements',
      'reusable workflow refs without skill bodies',
      'reproducibility export bundle action ref with dry-run receipt boundary',
      'workflow and skill candidate report-first refs with review, needs changes, and continue in conversation actions',
    ],
    'Settings Capabilities task awareness must_show',
  );
  assertIncludesAll(
    pages.settings_capabilities.must_not_show,
    [
      'artifact body, workflow body, connector body, credential body, owner receipt write, or domain export readiness verdict from Settings Capabilities',
      'auto-enabled skills, skill body writes, or workflow body writes from Settings Capabilities candidate refs',
    ],
    'Settings Capabilities task awareness must_not_show',
  );
  validateWorkflowSkillCandidateProjectionContract(
    pages.settings_capabilities.workflow_skill_candidate_policy,
    'Settings Capabilities workflow/skill candidate policy',
  );
  validateAgentPackageLifecycleUx(
    pages.settings_capabilities.agent_package_lifecycle_ux,
    'Settings Capabilities Agent Package lifecycle UX',
  );
  validateOplFlowContext(guiContract.opl_flow_context, 'App GUI OPL Flow Context');
  if (
    !pages.settings_advanced.sections?.includes('working_directories') ||
    pages.settings_advanced.sections?.includes('opl_flow_context') ||
    !pages.settings_advanced.must_show?.includes('read-only working directories from app_state.paths') ||
    !pages.settings_advanced.must_not_show?.includes('Developer Mode or Developer Profile controls')
  ) {
    throw new Error('Settings Advanced must be a read-only working-directories page');
  }
  if (
    pages.settings_workspace?.ia_group !== 'overview' ||
    !pages.settings_workspace.must_show?.includes('workspace page reachable as a top-level Settings entry') ||
    !pages.settings_workspace.must_not_show?.includes('workspace buried inside Maintenance or Advanced')
  ) {
    throw new Error('Settings Workspace must be an independent top-level page under Overview');
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
  if (!pages.settings_environment.must_show?.includes('module path source explanation in technical details')) {
    throw new Error('Settings Maintenance must keep module path source explanation in technical details');
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
  if (pages.settings_storage.release_contract_ref !== 'contracts/app-release-channel.json#local_data_lifecycle') {
    throw new Error('Settings Storage must reference the App local data lifecycle contract');
  }
  if (
    pages.settings_storage.state_source !==
      'active shell local data lifecycle service + contracts/app-release-channel.json#local_data_lifecycle'
  ) {
    throw new Error('Settings Storage must consume the active shell local data lifecycle service and App release lifecycle contract');
  }
  validateReadOnlyStorageLifecycleSurface(
    pages.settings_storage.read_only_lifecycle_surface,
    'Settings Storage read-only lifecycle surface',
  );
  if (!pages.about.must_show?.includes('Stable or Nightly channel')) {
    throw new Error('About page must show Stable or Nightly channel');
  }
  if (
    !pages.about.must_show?.includes('update status') ||
    !pages.about.must_show?.includes('one Check for updates action') ||
    !pages.about.must_not_show?.includes('about redirected to Advanced') ||
    pages.about.product_page_id !== 'about'
  ) {
    throw new Error('About must remain independent with version, channel, and update status');
  }
  if (
    pages.update?.page_kind !== 'compatibility_redirect' ||
    pages.update.compatibility_redirect?.target_route_id !== 'environment' ||
    pages.update.compatibility_redirect?.anchor !== 'updates'
  ) {
    throw new Error('Update must redirect to Maintenance#updates');
  }
  if (
    pages.settings_theme.product_page_id !== 'preferences' ||
    !pages.settings_theme.must_show?.includes('reply waiting time in human units') ||
    !pages.settings_theme.must_show?.includes('hardware acceleration in user language') ||
    !pages.settings_theme.must_show?.includes('Default and Codex theme choices under the themes anchor')
  ) {
    throw new Error('Settings Preferences must use user language for timeout, tray, hardware, and themes');
  }
  validateProgressDeltaDisplayContract(
    pages.runtime_status.progress_delta_policy,
    'App GUI runtime status progress delta policy',
  );
  validateStateIndexSidecarProjectionContract(
    pages.runtime_status.state_index_sidecar_policy,
    'App GUI runtime status State Index sidecar policy',
  );
  validateArtifactNativeDrilldownProjectionContract(
    pages.runtime_status.artifact_native_drilldown_policy,
    'App GUI runtime status Stage Artifact drilldown policy',
  );
  if (pages.runtime_status.primary_projection !== 'app_state.operator user task status projection') {
    throw new Error('App GUI runtime status must default to the user task status projection');
  }
  if (pages.runtime_status.default_state_source !== 'opl app state --profile fast --json') {
    throw new Error('App GUI runtime status default source must be fast App state');
  }
  if (pages.runtime_status.diagnostic_source !== 'opl runtime app-operator-drilldown --json') {
    throw new Error('App GUI runtime status diagnostic source must be operator drilldown');
  }
  validateUserTaskStatusProjectionContract(
    pages.runtime_status.user_task_status_policy,
    'App GUI runtime status user task status policy',
    runtimeBridge.stage_run_cockpit_projection,
  );
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
  for (const signal of [
    'user task status first OPL runtime status',
    'running task count',
    'active project count',
    'queued project count',
    'attention count',
    'task title/status/stage/progress label/next step/next owner/owner/accepted answer shape/artifact or blocker/last progress',
    'four-layer mental model: agent/capability, project, task/work item, execution run',
    'current stage and stage elapsed or telemetry missing',
    'last heartbeat or running proof or telemetry missing',
    'current stage usage and task total usage or telemetry missing',
    'typed blocker summary, owner, and resolution route',
    'agent/module status as a separate panel',
    'non-running waiting or stopped projects collapsed by default',
    'blocked stays blocked; queued or waiting require explicit projected status and are not inferred from non-running',
    'deliverable progress delta classification',
    'platform repair delta as separate infrastructure repair',
  ]) {
    if (!pages.runtime_status.must_show?.includes(signal)) {
      throw new Error(`App GUI runtime status must show ${signal}`);
    }
  }
  assertDeepEqualJson(
    pages.runtime_status.must_not_default_show,
    ['Temporal', 'provider', 'projection', 'ref', 'stage attempt', 'ledger', 'current_control_state'],
    'App GUI runtime status forbidden default terms',
  );
  for (const owner of ['deliverable progress truth', 'platform repair truth']) {
    if (!pages.runtime_status.must_not_own?.includes(owner)) {
      throw new Error(`App GUI runtime status must not own ${owner}`);
    }
  }
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
      bootstrap_missing_opl_base: 'opl-install.sh --headless --skip-modules',
      update_opl_app: 'standard_updater_or_carrier_host_update_route',
      install_opl_package: 'opl packages install ... --json',
      update_opl_package: 'opl packages update ... --json',
      repair_opl_package: 'opl packages repair --package-id <package_id> --json',
      uninstall_opl_package: 'opl packages uninstall --package-id <package_id> --json',
    },
    'App GUI framework module maintenance action mapping',
  );
}
