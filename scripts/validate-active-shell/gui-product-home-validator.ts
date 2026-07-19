import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  appOwnedCurrentTaskSlice,
  appOwnedDirectoryGroupPolicy,
  appOwnedExplicitSessionInputPolicy,
  appOwnedGuiContractOrdinaryConversation,
  appOwnedHomeLayout,
  appOwnedReviewSurfaceSourceEvidence,
  appOwnedRightContextInspectorForbiddenOwners,
  appOwnedRightContextInspectorPolicy,
  appOwnedSessionWorkspaceModel,
} from './app-contract-constants.ts';
import {
  assertProfessionalAgentPackagePolicy,
  managedShortcutIds,
  managedShortcutPackageIds,
  defaultVisibleShortcutIds,
  requiredSkillByAssistantId,
  requiredSkillByPackageId,
  starterPackageIds as defaultAssistantIds,
  starterShortcutIds as purposeEntryIds,
} from '../app-product-profile-shared-validators.ts';
import { validateGuiProductAuthority } from './gui-product-authority-validator.ts';

function validateGuiProductIdentity(guiContract) {
  if (guiContract.schema_version !== 2) {
    throw new Error('App GUI product contract schema_version must be 2');
  }
  if (guiContract.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected App GUI product contract owner: ${guiContract.owner}`);
  }
  if (guiContract.purpose !== 'app_owned_gui_product_contract') {
    throw new Error(`Unexpected App GUI product contract purpose: ${guiContract.purpose}`);
  }
  if (guiContract.state !== 'active') {
    throw new Error(`Unexpected App GUI product contract state: ${guiContract.state}`);
  }
  if (guiContract.product_authority?.source_of_truth !== 'one-person-lab-app') {
    throw new Error('App GUI product contract source of truth must be one-person-lab-app');
  }
  if (guiContract.product_authority.active_shell_role !== 'implementation_carrier') {
    throw new Error('App GUI product contract must treat the active shell as implementation carrier');
  }
  if (guiContract.product_authority.upstream_gui_role !== 'implementation_material_only') {
    throw new Error('App GUI product contract must keep upstream GUI behavior as implementation material only');
  }
  if (guiContract.product_authority.upstream_behavior_acceptance_policy !== 'must_match_app_owned_gui_product_contract_before_release') {
    throw new Error('App GUI product contract must gate upstream behavior against App-owned GUI requirements');
  }
  validateGuiProductAuthority(guiContract.product_authority);
}

function validateExecutorPolicy(guiContract) {
  if (guiContract.executor_policy?.default_executor !== 'codex_cli') {
    throw new Error('App GUI default executor must be Codex CLI');
  }
  if (guiContract.executor_policy.codex_only_default !== true) {
    throw new Error('App GUI default executor policy must be Codex-only');
  }
  if (guiContract.executor_policy.executor_tab_visible_when_single_executor !== false) {
    throw new Error('App GUI must hide executor tab when Codex CLI is the only executor');
  }
}

function validateHomeLayout(guiContract) {
  assertDeepEqualJson(guiContract.home_layout, appOwnedHomeLayout, 'App GUI home layout');
  assertDeepEqualJson(
    guiContract.interaction_baseline?.conversation_scope?.session_workspace_model,
    appOwnedSessionWorkspaceModel,
    'App GUI interaction session workspace model',
  );
  assertDeepEqualJson(
    guiContract.interaction_baseline?.conversation_scope?.explicit_session_input_policy,
    appOwnedExplicitSessionInputPolicy,
    'App GUI interaction explicit session input policy',
  );
  if (
    guiContract.utility_icon_policy?.library !== 'icon_park_react_for_opl_owned_utility_icons' ||
    guiContract.utility_icon_policy?.opl_owned_settings_navigation_and_overview !==
      'icon_park_react_outline_16px_monochrome' ||
    guiContract.utility_icon_policy?.settings_icon_geometry !==
      'stable_16px_slot_1_5_to_1_75px_visual_stroke_no_colored_tile_or_letter_avatar' ||
    guiContract.utility_icon_policy?.upstream_fork_body_bulk_icon_rewrite !== 'forbidden' ||
    guiContract.utility_icon_policy?.refresh_actions !== 'icon_only_with_tooltip_and_accessible_name' ||
    guiContract.utility_icon_policy?.model_reasoning_control !== 'text_and_disclosure_without_brain_icon' ||
    JSON.stringify(guiContract.utility_icon_policy?.account_identity_avatar) !==
      JSON.stringify({
        shape: 'circle',
        background: 'semantic_success_green',
        foreground: 'inverse',
        han_name_initials: 'first_han_character_only',
        non_han_name_initials: 'first_letters_of_first_two_words_uppercase_else_first_two_codepoints',
        email_fallback_initials: 'first_two_local_part_codepoints_uppercase',
        empty_fallback: 'OP',
      }) ||
    guiContract.utility_icon_policy?.global_feedback_action?.placement !== 'titlebar_trailing_utility' ||
    guiContract.utility_icon_policy?.global_feedback_action?.icon !== 'circle_question' ||
    guiContract.utility_icon_policy?.global_feedback_action?.icon_style !== 'regular_outline' ||
    guiContract.utility_icon_policy?.global_feedback_action?.target_url !==
      'https://github.com/gaofeng21cn/one-person-lab-app/issues/new' ||
    guiContract.utility_icon_policy?.global_feedback_action?.open_mode !==
      'external_browser_user_review_and_submit' ||
    JSON.stringify(guiContract.utility_icon_policy?.global_feedback_action?.prefill_fields) !==
      JSON.stringify(['localized_title', 'localized_body', 'current_route', 'app_release_version']) ||
    guiContract.utility_icon_policy?.global_feedback_action?.shell_local_delivery_forbidden !== true
  ) {
    throw new Error('App GUI utility icon policy must bind the global feedback action to OPL App GitHub issues');
  }
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(guiContract.ordinary_conversation ?? {}).filter(
        ([key]) => !['current_task_slice', 'agent_package_invocation_receipt_required'].includes(key),
      ),
    ),
    appOwnedGuiContractOrdinaryConversation,
    'App GUI ordinary conversation contract',
  );
  if (guiContract.ordinary_conversation?.agent_package_invocation_receipt_required !== true) {
    throw new Error('App GUI ordinary conversation must require agent package invocation receipts');
  }
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(guiContract.ordinary_conversation?.current_task_slice ?? {}).filter(([key]) => key !== 'fields'),
    ),
    Object.fromEntries(Object.entries(appOwnedCurrentTaskSlice).filter(([key]) => key !== 'fields')),
    'App GUI ordinary conversation current task slice shell policy',
  );
  assertIncludesAll(
    guiContract.ordinary_conversation?.current_task_slice?.fields,
    [
      ...appOwnedCurrentTaskSlice.fields,
      'resource_plan_ref',
      'resource_approval_ref',
      'resource_usage_ref',
      'console_policy_ref',
      'environment_template_ref',
      'environment_version_ref',
    ],
    'App GUI ordinary conversation current task slice fields',
  );
  assertIncludesAll(guiContract.pages?.ordinary_conversation?.must_show, [
    'desktop unified plus menu, permission and access, model and reasoning, and send or stop controls in the composer',
    'mobile plus sheet reusing the unified context menu with access, model and reasoning, and active capability actions',
    'composer-width searchable grouped plus palette for files, folders, real allowlisted loaded capabilities, adapter-reported nonduplicate modes, and available App connections without workspace selection',
    'explicit attachments, file or directory selection, paste, drop, and /open consumed by the current session send only',
    'failed conversation creation, initial send, or in-conversation send restores prompt and attachments without overwriting post-submit input',
    'workspace readiness gates project selection and OPL workspace controls only, never plain local conversation or send-scoped local file inputs',
    'read-only Conversation Environment showing the recorded workspace and live Git context when available',
    'single current task instance in the message timeline, inline and unpinned for ordinary tasks',
    'current task becomes sticky only after user pin or a true long_running signal',
    'read-only Codex subagent activity grouped as Active and Done with detail, result, and open canonical task',
    'complete paginated redacted transcript export with Markdown default, strict JSON, explicit directory and filename',
    'Preview accepts only explicit session attachments, visible conversation results, or user-selected legal absolute local paths',
  ], 'App GUI ordinary conversation visible 41301 signals');
  assertIncludesAll(guiContract.pages?.ordinary_conversation?.must_not_show, [
    'persistent project, workspace, locality, branch, attachment, or workspace-context-ref context strip',
    'workspace-scoped project context inputs or an Add context action in the directory rail',
    'workspaceRootReady or workspace membership used as a file-access gate',
    'backend, provider, Team, raw MCP, or arbitrary skills in the mobile plus sheet',
    'bound-session arbitrary project or working-directory reassignment controls',
    'Local or Worktree launch modes, starting branch, managed worktree, handoff, snapshot, restore, cleanup, or deletion controls',
    'cross-host task handoff controls',
    'duplicate current task or Runtime summary outside the message timeline',
    'AionUI Team, second App Server client, background polling, Team store, subagent scheduler, Shell execution authority, or direct subagent control buttons',
    'workspace bundle export authorization',
    'standalone projectless or no working directory placeholder row',
  ], 'App GUI ordinary conversation forbidden 41301 signals');
}

function validateSessionDirectoryPolicy(guiContract) {
  const policy = guiContract.interaction_baseline?.navigation_rail?.thread_directory_policy;
  if (
    policy?.canonical_authority !== 'codex_app_server_thread_list_read_resume' ||
    policy.codex_session_directory_authority !== 'canonical_app_server_thread_overview_when_available' ||
    policy.canonical_overview_unavailable_policy !==
      'fallback_to_shell_cache_without_reclassifying_cache_as_authority' ||
    policy.stale_codex_acp_cache_row_policy !==
      'exclude_from_ordinary_projection_when_absent_from_available_canonical_overview' ||
    policy.non_codex_local_row_policy !== 'preserve' ||
    policy.shell_local_storage_role !== 'drafts_preferences_and_rebuildable_cache_only' ||
    policy.shell_thread_history_authority !== false ||
    policy.workspace_directory_role !==
      'new_session_initial_cwd_projectless_adoption_grouping_and_visible_metadata_only' ||
    policy.row_identity !== 'canonical_thread_id' ||
    policy.duplicate_row_per_canonical_thread_allowed !== false ||
    policy.title_based_deduplication_allowed !== false
  ) {
    throw new Error('App GUI thread directory must prefer canonical App Server sessions and use Shell rows as cache only');
  }
  assertDeepEqualJson(
    policy.directory_group_policy,
    appOwnedDirectoryGroupPolicy,
    'App GUI directory group ownership policy',
  );
  if ('local_worktree_lifecycle' in (guiContract.interaction_baseline?.conversation_scope ?? {})) {
    throw new Error('App GUI conversation scope must not expose a managed Worktree lifecycle');
  }
}

function validateUiLocalePolicy(guiContract) {
  const policy = guiContract.ui_locale_policy;
  if (
    policy?.explicit_user_preference !== 'preserve_across_launches' ||
    policy?.first_launch_without_preference !== 'detect_system_locale_before_first_render' ||
    policy?.supported_normalization !== 'zh_to_zh-CN_else_en-US' ||
    policy?.startup_must_not_overwrite_explicit_preference !== true
  ) {
    throw new Error('App GUI locale policy must detect the system language before first render while preserving explicit preferences');
  }
}

function validateAiFirstInteractionModel(guiContract) {
  const model = guiContract.ai_first_interaction_model;
  if (
    !model ||
    model.default_visual_basis !== 'codex_app_composer_first' ||
    model.primary_policy !== 'maximize_direct_ai_interaction_on_the_chat_canvas' ||
    model.default_failure_semantics !==
      'fail_open_with_bounded_self_repair_jit_preparation_degradation_or_fallback' ||
    model.progress_policy !== 'preserve_user_momentum_and_attempt_safe_progress_before_requesting_manual_repair' ||
    model.fault_isolation_policy !==
      'a_selected_capability_failure_may_block_only_that_capability_while_plain_Codex_other_Agents_drafts_and_existing_sessions_remain_available' ||
    model.error_visibility_policy !==
      'never_swallow_or_relabel_a_real_failure_and_always_keep_a_user_comprehensible_reason_and_next_action' ||
    model.right_context_policy !== 'on_demand_advanced_surfaces_no_default_third_column' ||
    model.mas_autonomy_policy !== 'MAS_runs_as_autonomous_research_execution_not_co_scientist_pair_work' ||
    model.open_science_learning_policy !== 'adopt_artifact_provenance_review_and_plain_language_data_flow_patterns_as_secondary_context_only'
  ) {
    throw new Error('App GUI AI-first interaction model must keep Codex App composer-first defaults and collapsed secondary context');
  }
  assertIncludesAll(
    model.recovery_order,
    [
      'consume_owner_projected_action_or_self_repair',
      'prepare_missing_use_boundary_state_just_in_time',
      'continue_in_degraded_mode_or_use_a_safe_fallback',
      'preserve_draft_and_offer_an_owner_route_when_the_selected_capability_is_unavailable',
    ],
    'App GUI AI-first recovery order',
  );
  assertIncludesAll(
    model.must_not_preemptively_block_on,
    [
      'stale_or_verification_deferred_status',
      'update_available',
      'optional_dependency_missing',
      'optional_receipt_or_binding_absent',
      'workspace_absent_when_the_owner_projected_action_does_not_require_target_workspace',
    ],
    'App GUI AI-first fail-open signals',
  );
  assertIncludesAll(
    model.localized_fail_closed_boundaries,
    [
      'selected_package_identity_or_incompatible_version_mismatch',
      'selected_package_entrypoint_missing',
      'unsafe_managed_target_or_path_traversal',
      'permission_sandbox_or_account_authorization_denial',
      'unconfirmed_irreversible_external_mutation',
      'success_or_authority_claim_cannot_be_truthfully_supported',
    ],
    'App GUI AI-first localized fail-closed boundaries',
  );
  assertIncludesAll(
    model.allowed_adoptions,
    [
      'artifact_provenance_review_refs_in_on_demand_preview_or_timeline_disclosure',
      'plain_language_data_flow_and_safety_copy',
      'workflow_starters_as_purpose_entries_or_app_actions',
      'scientific_preview_affordances_on_demand',
    ],
    'App GUI AI-first allowed external learning adoptions',
  );
  assertIncludesAll(
    model.must_not_default_to,
    [
      'three-column scientific workbench',
      'open artifact inspector',
      'side-by-side co-scientist monitoring',
      'Home activity cockpit',
      'foreign runtime or domain authority',
    ],
    'App GUI AI-first forbidden defaults',
  );
}

function reviewSurfaceProductPolicy(reviewSurface) {
  const sourceEvidenceFields = Object.keys(appOwnedReviewSurfaceSourceEvidence);
  return Object.fromEntries(
    Object.entries(reviewSurface).filter(([key]) => !sourceEvidenceFields.includes(key)),
  );
}

function validateReviewSurface(reviewSurface, label) {
  const sourceEvidenceFields = Object.keys(appOwnedReviewSurfaceSourceEvidence);
  assertDeepEqualJson(
    reviewSurfaceProductPolicy(reviewSurface),
    appOwnedRightContextInspectorPolicy.review_surface,
    `${label} product policy`,
  );
  assertDeepEqualJson(
    Object.fromEntries(sourceEvidenceFields.map((key) => [key, reviewSurface[key]])),
    appOwnedReviewSurfaceSourceEvidence,
    `${label} source evidence`,
  );
}

function validateRightContextInspector(guiContract) {
  const inspector = guiContract.right_context_inspector ?? {};
  const reviewSurface = inspector.review_surface ?? {};
  const interactionReviewSurface = guiContract.interaction_baseline?.context_surfaces?.review_pane ?? {};
  const productPolicy = {
    ...inspector,
    review_surface: reviewSurfaceProductPolicy(reviewSurface),
  };
  assertDeepEqualJson(
    Object.fromEntries(
      Object.entries(productPolicy).filter(([key]) => !['current_task_evidence', 'must_not_own'].includes(key)),
    ),
    appOwnedRightContextInspectorPolicy,
    'App GUI on-demand advanced workspace surface policy',
  );
  validateReviewSurface(reviewSurface, 'App GUI right-context Review');
  validateReviewSurface(interactionReviewSurface, 'App GUI interaction-baseline Review');
  for (const legacyField of ['tabs', 'primary_tools', 'secondary_sections']) {
    if (legacyField in inspector) {
      throw new Error(`App GUI must not restore legacy equal-weight inspector taxonomy field ${legacyField}`);
    }
  }
  if (inspector.runtime_duplicate_allowed !== false) {
    throw new Error('App GUI advanced workspace surfaces must not duplicate Runtime');
  }
  for (const forbiddenOwner of appOwnedRightContextInspectorForbiddenOwners) {
    if (!inspector.must_not_own?.includes(forbiddenOwner)) {
      throw new Error(`App GUI right context inspector must not own ${forbiddenOwner}`);
    }
  }
  assertIncludesAll(guiContract.pages?.right_context_inspector?.must_show, [
    'no third column mounted by default',
    'Files and Changes workspace surface opened only by user or task need',
    'Preview opened as an independent surface for artifact, file, URL, or result',
    'Terminal and Browser opened from Environment or task need',
  ], 'App GUI advanced workspace visible signals');
  assertIncludesAll(guiContract.pages?.right_context_inspector?.must_not_show, [
    'legacy equal-weight Review, Terminal, Browser, Files, Artifacts, Runtime, Actions, and Memory taxonomy',
    'Runtime duplicate outside the message timeline current task instance',
    'advanced work surfaces open by default',
  ], 'App GUI advanced workspace forbidden signals');
}

function validateDefaultAssistants(guiContract) {
  const assistants = new Map((guiContract.default_assistants ?? []).map((assistant) => [assistant.id, assistant]));
  for (const assistantId of defaultAssistantIds) {
    const assistant = assistants.get(assistantId);
    if (!assistant) {
      throw new Error(`App GUI contract missing default assistant ${assistantId}`);
    }
    if (assistant.home_entry_policy !== 'purpose_entry_target' || assistant.home_entry_display_policy !== 'purpose_first') {
      throw new Error(`Default assistant ${assistantId} must be a purpose-first entry target`);
    }
  }
  if (assistants.has('oma')) {
    throw new Error('OMA must not be a default App GUI assistant');
  }
  if (assistants.has('mds')) {
    throw new Error('MDS must not be a default App GUI assistant');
  }
}

function validateProfessionalAgentPackages(guiContract) {
  assertProfessionalAgentPackagePolicy(guiContract.professional_agent_packages, 'App GUI contract');
}

function validateAssistantSkillProfiles(guiContract) {
  const skillProfiles = guiContract.assistant_skill_profiles ?? [];
  assertDeepEqualJson(
    skillProfiles.map((profile) => profile.assistant_id),
    defaultAssistantIds,
    'App GUI contract assistant skill profiles',
  );
  for (const profile of skillProfiles) {
    const requiredSkill = requiredSkillByAssistantId[profile.assistant_id];
    if (!requiredSkill || JSON.stringify(profile.required_skills) !== JSON.stringify([requiredSkill])) {
      throw new Error(`App GUI assistant ${profile.assistant_id} must require its App-declared matching skill`);
    }
    if (
      profile.required_skill_policy !== 'checked_locked' ||
      profile.optional_skill_policy !== 'unchecked_user_selectable' ||
      profile.skill_menu_policy !== 'assistant_scoped_required_checked_optional_visible'
    ) {
      throw new Error(`App GUI assistant ${profile.assistant_id} has invalid home skill policy`);
    }
    if ('hidden_home_skill_names' in profile) {
      throw new Error(`App GUI assistant ${profile.assistant_id} must not carry UI hiding policy`);
    }
  }
}

function validatePurposeEntries(guiContract) {
  const purposeEntries = guiContract.home_purpose_entries ?? [];
  assertDeepEqualJson(
    purposeEntries.map((entry) => entry.id),
    purposeEntryIds,
    'App GUI contract purpose entries',
  );
  assertDeepEqualJson(
    purposeEntries.map((entry) => entry.target_assistant_id),
    defaultAssistantIds,
    'App GUI contract purpose entry targets',
  );
  for (const entry of purposeEntries) {
    if (entry.display_policy !== 'purpose_first' || entry.home_entry_policy !== 'visible_click_to_start') {
      throw new Error(`App GUI purpose entry ${entry.id} must be purpose-first and click-to-start`);
    }
  }
  const shortcuts = guiContract.home_agent_shortcuts ?? [];
  assertDeepEqualJson(
    shortcuts.map((entry) => entry.shortcut_id),
    managedShortcutIds,
    'App GUI contract home agent shortcuts',
  );
  assertDeepEqualJson(
    shortcuts.map((entry) => entry.package_id),
    managedShortcutPackageIds,
    'App GUI contract home agent shortcut package targets',
  );
  for (const entry of shortcuts) {
    if (
      entry.executor !== 'codex_cli' ||
      entry.source !== 'opl_app_home' ||
      entry.display_policy !== 'purpose_first' ||
      entry.home_entry_policy !== 'visible_click_to_start' ||
      entry.user_configurable !== true ||
      JSON.stringify(entry.required_skill_ids) !== JSON.stringify(requiredSkillByPackageId[entry.package_id])
    ) {
      throw new Error(`App GUI home agent shortcut ${entry.shortcut_id} must be a configurable Codex package launch shortcut`);
    }
    if (entry.package_id === 'oma' && entry.shortcut_id !== 'oma') {
      throw new Error('App GUI OMA shortcut id must remain oma');
    }
    if (entry.default_visible !== defaultVisibleShortcutIds.includes(entry.shortcut_id)) {
      throw new Error(`App GUI home agent shortcut ${entry.shortcut_id} has invalid default visibility`);
    }
  }
}

function validateNonDefaultAndRetiredAssistants(guiContract) {
  const oma = (guiContract.non_default_assistants ?? []).find((assistant) => assistant.id === 'oma');
  if (!oma || oma.home_default_visible !== true || oma.home_entry_policy !== 'settings_managed_home_shortcut') {
    throw new Error('App GUI contract must expose OMA through its default settings-managed Home shortcut');
  }
  const retiredMds = (guiContract.retired_domain_agents ?? []).find((agent) => agent.id === 'mds');
  if (retiredMds?.default_display_allowed !== false) {
    throw new Error('App GUI contract must mark MDS as not default-displayed');
  }
}

export function validateGuiProductHomeContract(guiContract) {
  validateGuiProductIdentity(guiContract);
  validateExecutorPolicy(guiContract);
  validateUiLocalePolicy(guiContract);
  validateHomeLayout(guiContract);
  validateSessionDirectoryPolicy(guiContract);
  validateAiFirstInteractionModel(guiContract);
  validateRightContextInspector(guiContract);
  validateProfessionalAgentPackages(guiContract);
  validateDefaultAssistants(guiContract);
  validateAssistantSkillProfiles(guiContract);
  validatePurposeEntries(guiContract);
  validateNonDefaultAndRetiredAssistants(guiContract);
}
