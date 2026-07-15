#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  forbiddenExternalFirstPartyClaimPattern,
  isExternalFirstPartyClaim,
} from "./app-product-profile-shared-validators.ts";

type AgentRootMap = Map<string, string>;

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = path.join(appRoot, "contracts", "app-install-exposure-policy.json");
const profilePath = path.join(appRoot, "contracts", "app-product-profile.json");
const registryPath = path.join(appRoot, "contracts", "agent-package-registry.json");
const agentPackageSurfaceSchemaPath = path.join(
  appRoot,
  "contracts",
  "agent-package-surfaces.schema.json",
);
const agentPackageManifestFixtureDir = path.join(
  appRoot,
  "contracts",
  "fixtures",
  "agent-package-manifests",
);
const agentPackageActivationResultsFixturePath = path.join(
  appRoot,
  "contracts",
  "fixtures",
  "agent-package-activation-results.fixture.json",
);
const agentPackageLaunchStateMatrixFixturePath = path.join(
  appRoot,
  "contracts",
  "fixtures",
  "agent-package-launch-state-matrix.fixture.json",
);
const packageJsonPath = path.join(appRoot, "package.json");
const activeShellRoot = path.resolve(
  process.env.OPL_AION_SHELL_ROOT || path.join(appRoot, "shells", "aionui"),
);
const activeShellInstallConsumers = [
  "packages/desktop/src/process/bridge/oplRuntimeBridge.ts",
  "packages/web-host/src/opl-runtime-proxy.ts",
  "scripts/opl-first-run-vm-smoke.mjs",
  "resources/opl-install.sh",
];
const expectedDefaultPluginAgentIds = ["mas", "mag", "rca", "obf"];
const expectedRepoPackagedPluginAgentIds = ["mas", "mag", "rca"];
const expectedGeneratedAgentIds = ["oma", "obf"];
const expectedRequiredAgentIds = ["mas", "mag", "rca", "oma", "obf"];
const expectedProfessionalPackageIds = ["mas", "mag", "rca", "obf", "oma"];
const expectedRegistryPackageIds = [
  "mas",
  "mag",
  "rca",
  "oma",
  "obf",
  "mas-scholar-skills",
  "opl-flow",
];
const expectedPackageKinds: Record<string, string> = {
  mas: "domain_agent_package",
  mag: "domain_agent_package",
  rca: "domain_agent_package",
  oma: "domain_agent_package",
  obf: "domain_agent_package",
  "mas-scholar-skills": "framework_capability_package",
  "opl-flow": "workflow_plugin_package",
};
const carrierIdByAgentId: Record<string, string> = {
  mas: "med-autoscience",
  mag: "med-autogrant",
  rca: "redcube-ai",
  oma: "opl-meta-agent",
  obf: "opl-bookforge",
};
const expectedDefaultVisibleDomainSkillIds = [
  "med-autoscience",
  "med-autogrant",
  "redcube-ai",
  "opl-bookforge",
];
const expectedGeneratedPluginSkillIds = ["opl-meta-agent", "opl-bookforge"];
const expectedSkillPackSources: Record<string, string> = {
  mas: "github:gaofeng21cn/med-autoscience/plugins/med-autoscience/skills/med-autoscience",
  mag: "github:gaofeng21cn/med-autogrant/plugins/med-autogrant/skills/med-autogrant",
  rca: "github:gaofeng21cn/redcube-ai/plugins/redcube-ai/skills/redcube-ai",
  obf: "github:gaofeng21cn/opl-bookforge/contracts/pack_compiler_input.json",
  oma: "github:gaofeng21cn/opl-meta-agent/contracts/pack_compiler_input.json",
  "mas-scholar-skills": "github:gaofeng21cn/opl-scholarskills/skills/mas-scholar-skills",
  "opl-flow": "github:gaofeng21cn/opl-flow/skills/opl-flow",
};
const expectedSkillPackIds: Record<string, string> = {
  mas: "med-autoscience-professional-skill-pack",
  mag: "med-autogrant-professional-skill-pack",
  rca: "redcube-ai-professional-skill-pack",
  oma: "opl-meta-agent-professional-skill-pack",
  obf: "opl-bookforge-professional-skill-pack",
  "mas-scholar-skills": "mas-scholar-skills-capability-pack",
  "opl-flow": "opl-flow-workflow-pack",
};
const expectedGeneratedPluginSourceRefs: Record<string, string> = {
  obf: "opl_generated:gaofeng21cn/opl-bookforge/contracts/pack_compiler_input.json",
  oma: "opl_generated:gaofeng21cn/opl-meta-agent/contracts/pack_compiler_input.json",
};
const expectedGeneratedSemanticPackRoots: Record<string, string> = {
  obf: "github:gaofeng21cn/opl-bookforge/agent",
  oma: "github:gaofeng21cn/opl-meta-agent/agent",
};
const expectedFailClosedStates = [
  "dirty_managed_checkout",
  "ahead_or_diverged_managed_checkout",
  "missing_plugin_manifest",
  "missing_skill_entry",
  "duplicate_codex_visible_domain_skill",
  "unavailable_managed_package_channel",
  "invalid_package_manifest",
  "missing_package_lock_receipt",
  "package_source_validation_failed",
  "atomic_package_unit_incomplete",
];
const expectedPackageLifecycleActions = [
  "refresh_registry",
  "install_from_manifest_url",
  "agent_package_update",
  "agent_package_repair",
  "agent_package_activate",
  "agent_package_uninstall",
  "agent_package_preferences_set",
];
const expectedRegistrySourceKinds = [
  "default_external_registry",
  "organization_registry_url",
  "user_registry_url",
];
const expectedRegistryManagementActions = ["refresh_registry", "install_from_manifest_url"];
const expectedRegistryPolicyEntryFields = [
  "package_id",
  "package_kind",
  "display_name",
  "publisher",
  "source",
  "manifest_url",
  "version_source_ref",
  "trust_tier",
];
const expectedRegistryEntryFields = [
  "package_id",
  "package_kind",
  "display_name",
  "publisher",
  "description",
  "tags",
  "package_role",
  "source",
  "manifest_url",
  "version_source_ref",
  "selected_version",
  "stable_version",
  "manifest_validation",
  "trust_tier",
];
const expectedRegistryRoles = [
  "standard_agent",
  "framework_capability_package",
  "workflow_profile",
];
const expectedRegistryRoleByPackageId: Record<string, string> = {
  mas: "standard_agent",
  mag: "standard_agent",
  rca: "standard_agent",
  oma: "standard_agent",
  obf: "standard_agent",
  "mas-scholar-skills": "framework_capability_package",
  "opl-flow": "workflow_profile",
};
const expectedRegistryManifestValidationStates = [
  "deferred",
  "fetched_manifest",
  "catalog_inline_manifest",
];
const expectedManifestRequiredFields = [
  "package_id",
  "package_kind",
  "display_name",
  "publisher",
  "version",
  "source",
  "codex_surface",
  "skill_packs",
  "entrypoints",
  "health_check",
  "permissions",
  "update_channel",
  "rollback_ref",
];
const expectedDistributionPayloadFields = [
  "payload_kind",
  "payload_ref",
  "payload_digest_ref",
  "required_skill_pack_lock_refs",
  "proof_status",
  "live_download_proof",
  "installed_reload_proof",
  "oci_ref",
  "oci_media_type",
  "immutable_tag",
  "moving_tag",
  "promotion_policy",
  "install_truth",
];
const expectedHomeShortcutRequiredFields = [
  "shortcut_id",
  "package_id",
  "primary_label",
  "codex_visible_entry",
  "required_skill_ids",
  "source",
  "executor",
  "display_policy",
  "default_visible",
  "user_configurable",
];
const expectedInvocationReceiptRequiredFields = [
  "receipt_type",
  "executor",
  "package_id",
  "agent_id",
  "skill_ids",
  "source",
  "launched_from",
  "display_policy",
];
const expectedRegistryExcludedFields = [
  "session_contract_ref",
  "domain_workflow_schema",
  "prompt_body",
  "artifact_schema",
  "readiness_verdict_rule",
  "quality_verdict_rule",
  "owner_receipt_authority",
];
const expectedManualThirdPartySourceKinds = [
  "local_manifest_file",
  "manifest_url",
  "manifest_import",
];
const expectedManualThirdPartyRequires = [
  "explicit_user_action",
  "manifest_validation",
  "trust_tier_assignment",
  "package_lock_receipt",
  "rollback_ref",
];
const expectedRemoteDistributionPayloadFields = [
  "remote_manifest_url",
  "distribution_payload_ref",
  "source_digest_ref",
  "trust_tier",
  "package_lock_receipt",
  "rollback_ref",
  "oci_ref",
  "oci_digest",
];
const expectedFirstPartyDistributionPayloadFields = [
  "cohort_manifest_ref",
  "distribution_payload_ref",
  "payload_digest_ref",
  "required_skill_pack_lock_refs",
  "rollback_ref",
  "oci_ref",
  "oci_media_type",
  "immutable_tag",
  "moving_tag",
  "promotion_policy",
  "install_truth",
];
const expectedPackageSourceKinds = [
  "first_party_managed_cohort",
  "bundled_full_runtime_modules",
  "local_manifest_file",
  "manifest_url",
  "manifest_import",
  "developer_checkout_override",
];
const expectedPackageLockReceiptFields = [
  "package_id",
  "version_or_source_digest",
  "installed_at",
  "updated_at",
  "codex_visible_entry",
  "bundled_required_skill_ids",
  "optional_skill_refs",
  "source_kind",
  "trust_tier",
  "action_receipt_id",
  "rollback_ref",
  "physical_surface",
];
const expectedAtomicPackageUnitIncludes = [
  "plugin_manifest",
  "bundled_required_skill_entries",
  "optional_companion_skill_refs",
];
const expectedRecoveryStatePolicy = {
  framework_vocabulary: {
    owner: "one-person-lab",
    surface_kind: "opl_agent_package_recovery_readback",
    vocabulary_version: "opl-agent-package-recovery.v1",
    status_envelope_version: "g2",
    directory_surface_kind: "opl_agent_package_directory.v1",
    private_alias_normalization_allowed: false,
  },
  read_surfaces: ["fast", "list", "status", "all_dry_run"],
  writes_performed: false,
  owner_token_exposed: false,
  states: {
    recovery_in_progress: "live_exact_global_lock_owner_wait_without_shell_recovery",
    recovery_required:
      "orphan_or_pending_markers_recoverable_by_the_next_non_dry_Framework_mutation",
  },
  launch_blocked_reason_by_status: {
    recovery_in_progress: "package_recovery_in_progress",
    recovery_required: "package_recovery_required",
  },
  action_projection_fields: [
    "recovery_action_state",
    "recovery_action_executable",
    "recovery_action_ref",
  ],
  action_availability_policy:
    "consume_the_Framework_projection_without_deriving_action_availability_from_bare_status_or_private_aliases",
  repair_action_policy: {
    recovery_in_progress: {
      launch_blocked_reason: "package_recovery_in_progress",
      required_recovery_action_state: "wait_only",
      required_recovery_action_executable: false,
      required_recovery_action_ref: null,
      status_index_repair_enabled: false,
      status_index_reason_code: "recovery_in_progress",
    },
    recovery_required_executable: {
      readback_status: "recovery_required",
      launch_blocked_reason: "package_recovery_required",
      required_recovery_action_state: "executable",
      required_recovery_action_executable: true,
      required_recovery_action_ref: "app_state.actions#agent_package_repair",
      status_index_repair_enabled: true,
      status_index_reason_code: "recovery_required",
      execution_policy:
        "execute_only_the_exact_Framework_directory_projected_agent_package_repair_action",
    },
    recovery_required_manual_owner_intervention: {
      readback_status: "recovery_required",
      managed_update_lock_statuses: ["stale_live_owner", "invalid"],
      launch_blocked_reason: "package_recovery_required",
      required_recovery_action_state: "manual_owner_intervention_required",
      required_recovery_action_executable: false,
      required_recovery_action_ref: null,
      status_index_repair_enabled: false,
      status_index_reason_code: "recovery_owner_intervention_required",
    },
  },
};
const expectedActivationPolicy = {
  projection_source: "app_state.agent_packages.directory.entries[].use_boundary_action",
  projection_scope: "installed_standard_agent_only",
  projection_independence:
    "independent_from_lifecycle_available_actions_recommended_action_and_status_index_activation_action",
  request_scoped_projection_policy: {
    authority: "one-person-lab",
    result_surface_kind: "opl_agent_package_session_launch_projection.v1",
    result_schema_ref:
      "contracts/agent-package-surfaces.schema.json#/$defs/agent_package_session_launch_projection",
    producer_cli_route: null,
    producer_cli_route_policy: "Framework_owned_and_not_App_authority_until_published",
    applies_to: ["guid_home_launch", "package_backed_session_workspace_transition"],
    settings_global_status_source: "app_state.paths.workspace_root_path_allowed",
    session_target_source: "normalized_selected_local_directory",
    request_fields: ["package_id", "target_workspace"],
    projectless_policy: "fail_closed_without_projection_or_activation",
    projectless_reason_code: "agent_package_target_workspace_required",
    global_workspace_root_policy: "read_only_unchanged_and_never_call_workspace_root_set",
    projection_read_policy: "request_scoped_fast_or_prepare_and_zero_write",
    result_required_fields: [
      "surface_kind",
      "package_id",
      "normalized_target_workspace",
      "directory",
      "directory_entry_ref",
      "readiness_ref",
      "use_boundary_action",
      "projection_currentness_ref",
      "writes_performed",
      "global_workspace_root_unchanged",
    ],
    action_source: "result.directory.entries[package_id].use_boundary_action",
    action_execution_policy: "execute_exact_projected_action_id_and_payload_byte_for_byte",
    cache_and_inflight_identity_fields: [
      "surface_kind",
      "package_id",
      "normalized_target_workspace",
    ],
    stale_response_policy:
      "discard_response_when_any_cache_or_inflight_identity_field_no_longer_matches_current_selection",
    workspace_transition_policy:
      "B_to_C_requires_fresh_C_projection_before_warmup_runtime_ensure_or_send",
    host_target_policy:
      "validate_the_same_normalized_target_and_use_binding.target_root_before_any_conversation_message_turn_or_runtime_task_write",
  },
  action_id: "agent_package_activate",
  action_route: "opl app action execute --action agent_package_activate --payload <json> --json",
  trigger: "before_every_installed_package_workspace_or_quest_launch",
  payload_fields: ["package_id", "scope", "target_workspace", "target_quest", "use_boundary_id"],
  scope_values: ["workspace", "quest"],
  scope_target_policy: {
    workspace: "target_workspace_required_target_quest_forbidden",
    quest: "target_quest_required_target_workspace_forbidden",
  },
  result_fields: ["launch_allowed", "launch_blocked_reason", "use_boundary_id", "use_receipt_ref", "use_binding"],
  launch_policy:
    "launch_only_when_launch_allowed_true_and_use_receipt_ref_and_use_binding_are_present",
  result_contract: {
    launch_allowed_true: "requires_nonempty_use_receipt_ref_and_canonical_use_binding",
    launch_allowed_false:
      "requires_typed_launch_blocked_reason_and_allows_use_receipt_ref_and_use_binding_only_as_null_or_absent",
    canonical_binding_field: "use_binding",
    temporary_compatibility_alias: "package_use_binding",
    temporary_alias_policy:
      "read_only_during_bounded_migration_only_when_canonical_use_binding_is_also_present_and_identical; alias_only_never_satisfies_the_App_contract",
  },
  transition_policy: {
    prelaunch_transition_reason_codes: [
      "scope_reconciliation_required",
      "live_verification_deferred",
      "use_boundary_reconciliation_ready",
    ],
    hard_block_reason_codes: [
      "package_not_installed",
      "package_disabled",
      "package_status_read_failed",
      "status_unavailable",
      "package_dependency_missing",
      "package_dependency_incompatible",
      "physical_surface_not_ready",
      "runtime_source_missing",
      "runtime_source_incompatible",
      "carrier_authority_invalid",
      "package_lock_corrupt",
      "package_ledger_corrupt",
      "package_recovery_in_progress",
      "package_recovery_required",
    ],
    hard_block_policy:
      "do_not_execute_use_boundary_action_and_preserve_typed_reason_source_ref_and_recovery_action",
    blocked_result_write_policy:
      "every_non_scope_hard_block_has_zero_scope_use_and_activation_receipt_delta; partial_success_is_forbidden",
    success_policy:
      "create_or_launch_only_after_live_result_has_launch_allowed_true_complete_use_receipt_ref_and_deeply_consistent_use_binding",
  },
  recovery_state_policy: expectedRecoveryStatePolicy,
  role_policy: {
    standard_agent: "installed_entries_require_use_boundary_action_even_when_blocked",
    framework_capability_package:
      "use_boundary_action_must_be_null_and_no_Agent_launch_entry_is_allowed",
    workflow_profile: "use_boundary_action_must_be_null_and_no_Agent_launch_entry_is_allowed",
  },
  exposure_policy: {
    execution_authority: "directory.entries[].exposure.enabled",
    discovery_authority: "directory.entries[].exposure.visibility",
    disabled: "package_disabled_launch_allowed_false_and_no_activation_or_use_execution",
    hidden_enabled:
      "removed_from_ordinary_discovery_and_Home_default_but_explicit_direct_or_retained_shortcut_launch_remains_eligible",
    enable: "restore_execution_without_changing_visibility",
  },
  action_identity_policy:
    "execute_the_Framework_projected_action_id_and_payload_byte_for_byte_including_use_boundary_id",
  single_use_policy: {
    token_scope: "globally_unique_within_agent_package_use_ledger",
    first_execution_policy:
      "under_the_Framework_package_mutation_lock_check_use_boundary_id_before_any_currentness_scope_use_or_activation_write",
    identity_fields: [
      "package_id",
      "scope",
      "target_workspace_or_target_quest",
      "directory_entry_ref",
      "readiness_ref",
      "root_package.package_id",
      "root_package.package_lock_ref",
      "root_package.package_version",
      "root_package.manifest_sha256",
      "root_package.content_digest",
      "dependency_closure_digest",
      "provider_packages",
    ],
    exact_retry_policy:
      "same_token_and_exact_identity_returns_the_original_canonical_use_receipt_and_use_binding_with_zero_new_writes",
    conflict_reason_codes: [
      "agent_package_use_boundary_replay_conflict",
      "agent_package_use_boundary_replay_stale",
    ],
    conflict_policy:
      "same_token_with_request_identity_drift_is_replay_conflict; same_token_after_current_lock_or_closure_drift_is_replay_stale; both_are_zero_write",
    concurrency_policy:
      "two_concurrent_exact_invocations_commit_one_receipt_and_the_other_returns_the_same_idempotent_readback",
    receipt_index_policy:
      "canonical_use_ledger_is_directly_indexed_by_use_boundary_id_and_never_guessed_by_receipt_ref_scan",
    refresh_policy:
      "every_terminal_attempt_refreshes_canonical_fast_state; a_new_launch_uses_a_fresh_projected_token",
    consumed_action_policy:
      "a_consumed_projected_action_cannot_authorize_a_new_conversation; exact_IPC_retry_may_only_recover_the_original_result",
  },
  workspace_transition_policy: {
    applies_to: "package_backed_canonical_sessions",
    stale_on: [
      "workspace_root_change",
      "local_to_worktree",
      "worktree_to_local",
      "workspace_cleanup",
      "workspace_restore",
    ],
    old_binding_policy:
      "immediately_mark_stale_or_pending_and_never_authorize_warmup_runtime_ensure_turn_or_message_for_the_new_target_root",
    reactivation_trigger: "before_any_warmup_runtime_ensure_turn_or_message_send_after_the_transition",
    reactivation_source:
      "fresh_canonical_fast_state_use_boundary_action_projected_for_the_new_target_root",
    success_policy:
      "persist_the_canonical_activation_and_use_binding_with_target_root_equal_to_the_new_workspace_before_warmup_runtime_ensure_or_send",
    failure_policy:
      "zero_warmup_zero_runtime_task_zero_turn_zero_message_and_preserve_a_recoverable_consistent_session_state",
    handoff_transaction_policy:
      "if_activation_runs_inside_handoff_then_later_thread_or_projection_failure_requires_typed_compensation_or_an_explicit_noncurrent_orphan_receipt; never_display_the_old_binding_as_current",
    plain_conversation_policy: "unchanged",
  },
  host_launch_authorization_policy: {
    enforcement_owner: "opl_aion_shell_OPL_adapter_or_OPL_owned_local_gateway",
    aioncore_write_policy: "forbid_OPL_domain_semantics_ledger_DB_migration_or_launch_gate_changes",
    current_p0_scope: "normal_OPL_shell_package_launch_path",
    renderer_extra_role:
      "persistence_and_transport_only_after_deep_validation_not_independent_authority",
    protected_boundaries: [
      "conversation_create",
      "conversation_warmup",
      "runtime_ensure",
      "turn_or_message_send_build",
    ],
    required_validation: [
      "canonical_use_receipt_and_use_binding",
      "normalized_request_scoped_projection_target_and_use_binding.target_root_match_current_conversation_workspace",
      "root_lock_manifest_content_and_dependency_provider_closure_identity",
      "use_boundary_action_is_the_exact_fresh_Framework_projected_action_for_this_package_and_target",
    ],
    normal_path_failure_policy:
      "block_before_calling_create_warmup_runtime_ensure_or_send_and_preserve_zero_downstream_write",
    persistence_policy:
      "persist_and_forward_canonical_use_receipt_ref_and_use_binding_only_after_deep_validation",
    plain_conversation_policy: "unchanged",
    deferred_hardening: {
      release_blocking_for_26_7_14: false,
      preferred_future_owner:
        "OPL_owned_local_gateway_or_Electron_main_adapter_or_upstream_generic_authorization_hook",
      aioncore_domain_semantics_allowed: false,
      items: [
        "direct_renderer_or_main_process_bypass",
        "same_token_cross_conversation_atomic_binding",
        "exact_create_retry",
        "conversation_clone_authorization",
        "AionCore_internal_cron_team_or_channel_launch_gate",
      ],
    },
  },
  currentness_policy:
    "framework_reconciles_latest_stable_compatible_package_closure_once_at_use_boundary_and_pins_use_binding_for_the_session",
  package_identity_policy: "generic_package_id_no_hardcoded_agent_or_capability_package_ids",
  app_role:
    "prepare_then_launch_using_framework_readback_without_owning_package_currentness_or_materialization",
};
const expectedActivationRequestRequiredFields = ["package_id", "scope", "use_boundary_id"];
const expectedActivationResultRequiredFields = ["launch_allowed", "use_boundary_id"];
const expectedRecoveryReadbackRequiredFields = [
  "surface_kind",
  "vocabulary_version",
  "status",
  "launch_blocked_reason",
  "managed_update_lock",
  "recovery_action",
  "recovery_action_state",
  "recovery_action_executable",
  "recovery_action_ref",
];
const expectedUseBindingRequiredFields = [
  "surface_kind",
  "use_boundary_id",
  "use_receipt_ref",
  "root_package",
  "provider_packages",
  "dependency_closure_digest",
  "freshness_mode",
  "latest_verified",
  "checked_at",
  "refresh_outcome",
  "channel_ref",
  "channel_digest",
  "scope",
  "target_root",
  "core_skill_tree_digest",
  "skill_tree_digest",
  "core_readiness",
  "specialty_exposure",
];
const expectedUseBindingPackageRequiredFields = [
  "package_id",
  "package_version",
  "owner_language_version",
  "package_lock_ref",
  "manifest_sha256",
  "content_digest",
  "source_artifact_ref",
  "artifact_digest",
  "owner_source_commit",
  "carrier_authority",
];
const expectedSessionLaunchProjectionRequiredFields = [
  "surface_kind",
  "package_id",
  "normalized_target_workspace",
  "directory",
  "directory_entry_ref",
  "readiness_ref",
  "use_boundary_action",
  "projection_currentness_ref",
  "writes_performed",
  "global_workspace_root_unchanged",
];
const expectedActivationActionRequiredFields = [
  "action_id",
  "command_ref",
  "enabled",
  "preparation_status",
  "reason_code",
];
const expectedActivationPreparationStatuses = ["not_installed", "prepare_required", "ready"];
const expectedUseBoundaryActionRequiredFields = [
  "surface_kind",
  "action_id",
  "action_ref",
  "payload",
  "required_payload_fields",
  "confirmation_required",
  "use_boundary_id",
  "directory_entry_ref",
  "readiness_ref",
  "enabled",
  "preparation_status",
  "reason_code",
  "blocker",
];
const expectedUseBoundaryPreparationStatuses = [
  "activation_required",
  "verification_deferred",
  "ready",
  "blocked",
];

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    fail(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertJsonEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertArrayEqual(actual: unknown, expected: string[], label: string): void {
  if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludesAll(actual: unknown, expected: string[], label: string): void {
  if (!Array.isArray(actual)) {
    fail(`${label} must be an array`);
  }
  const missing = expected.filter((item) => !actual.includes(item));
  if (missing.length > 0) {
    fail(`${label} missing ${missing.join(", ")}`);
  }
}

function assertFieldsEqual(
  actual: any,
  expectedFields: Record<string, unknown>,
  label: string,
): void {
  for (const [field, expected] of Object.entries(expectedFields)) {
    assertEqual(actual?.[field], expected, `${label}.${field}`);
  }
}

function assertArrayFieldsEqual(
  actual: any,
  expectedFields: Record<string, string[]>,
  label: string,
): void {
  for (const [field, expected] of Object.entries(expectedFields)) {
    assertArrayEqual(actual?.[field], expected, `${label}.${field}`);
  }
}

function assertArrayFieldsInclude(
  actual: any,
  expectedFields: Record<string, string[]>,
  label: string,
): void {
  for (const [field, expected] of Object.entries(expectedFields)) {
    assertIncludesAll(actual?.[field], expected, `${label}.${field}`);
  }
}

function assertFixtureDigestRef(value: unknown, label: string, suffixAllowed = false): void {
  const suffix = suffixAllowed ? "(?:/.+)?" : "";
  const pattern = new RegExp(`^oci-digest-lock://.+@sha256:[0-9a-f]{64}${suffix}$`);
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(`${label} must contain a syntactically valid 64-hex non-live fixture digest`);
  }
}

function validateCanonicalPackageConsumers(policy: any, profile: any, registry: any): void {
  const legacyIdentityIds = new Set([
    "med-autoscience",
    "med-autogrant",
    "redcube-ai",
    "opl-meta-agent",
    "opl-bookforge",
  ]);
  const identityFields = new Set(["package_id", "agent_id", "assistant_id", "target_assistant_id"]);
  const visitIdentityFields = (value: unknown, pathParts: string[] = []): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visitIdentityFields(item, [...pathParts, String(index)]));
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = [...pathParts, key];
      if (identityFields.has(key) && typeof child === "string" && legacyIdentityIds.has(child)) {
        fail(
          `legacy carrier id ${child} must not be used as package/agent identity at ${childPath.join(".")}`,
        );
      }
      visitIdentityFields(child, childPath);
    }
  };
  visitIdentityFields(policy, ["policy"]);
  visitIdentityFields(profile, ["profile"]);
  visitIdentityFields(registry, ["registry"]);

  const installSurface = JSON.stringify({
    software_lifecycle: policy.software_lifecycle,
    sync_and_install_contract: policy.sync_and_install_contract,
    distribution_channels: policy.distribution_channels,
    package_distribution: policy.agent_installation_contract?.managed_package_distribution,
  });
  for (const forbidden of ["--skip-modules", "reconcile-modules"]) {
    if (installSurface.includes(forbidden)) {
      fail(`active install/package maintenance surfaces must not expose ${forbidden}`);
    }
  }

  for (const entry of registry.entries ?? []) {
    const ordinarySurface = JSON.stringify({
      manifest_url: entry.manifest_url,
      ordinary_user_source: entry.ordinary_user_source,
    });
    for (const forbidden of [
      "/agent-packages/",
      "/opl-agent-",
      "/opl-package-",
      "/one-person-lab-modules/",
    ]) {
      if (ordinarySurface.includes(forbidden)) {
        fail(
          `registry entry ${entry.package_id} ordinary install surface contains legacy namespace ${forbidden}`,
        );
      }
    }
    if (/:latest(?:[\"/?#]|$)/.test(ordinarySurface)) {
      fail(`registry entry ${entry.package_id} must use latest-stable, never the plain latest tag`);
    }
    if (/:candidate-|:(?:stable|nightly)(?:[\"/?#]|$)/.test(ordinarySurface)) {
      fail(
        `registry entry ${entry.package_id} must expose only candidate and latest-stable moving channels`,
      );
    }
  }
}

function validateActiveShellInstallConsumers(): void {
  for (const relativePath of activeShellInstallConsumers) {
    const sourcePath = path.join(activeShellRoot, relativePath);
    if (!fs.existsSync(sourcePath)) {
      fail(`active shell install consumer is missing: ${sourcePath}`);
    }
    const source = fs.readFileSync(sourcePath, "utf8");
    if (source.includes("--skip-modules")) {
      fail(`active shell install consumer still uses retired --skip-modules: ${relativePath}`);
    }
    if (!source.includes("--skip-packages")) {
      fail(`active shell install consumer must use --skip-packages: ${relativePath}`);
    }
  }
}

function isGeneratedAgent(agentId: string): boolean {
  return expectedGeneratedAgentIds.includes(agentId);
}

function localWorkspaceRoots(): string[] {
  const configured = process.env.OPL_AGENT_SOURCE_ROOTS?.trim();
  const roots = configured ? configured.split(path.delimiter) : ["/Users/gaofeng/workspace"];
  return roots.map((root) => root.trim()).filter(Boolean);
}

function parseGithubSource(source: string): { repo: string; repoPath: string } | null {
  const match = source.match(/^github:[^/]+\/([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }
  return { repo: match[1], repoPath: match[2] };
}

function validateGithubSourcePathIfAvailable(source: string, label: string): string | null {
  const parsed = parseGithubSource(source);
  if (!parsed) {
    fail(`${label} must be a github:<owner>/<repo>/<path> ref`);
  }
  for (const root of localWorkspaceRoots()) {
    const repoRoot = path.join(root, parsed.repo);
    if (!fs.existsSync(repoRoot)) {
      continue;
    }
    const localPath = path.join(repoRoot, parsed.repoPath);
    if (!fs.existsSync(localPath)) {
      fail(`${label} does not resolve in local sibling checkout: ${localPath}`);
    }
    return localPath;
  }
  return null;
}

function frontmatterName(skillPath: string): string | null {
  const content = fs.readFileSync(skillPath, "utf8");
  if (!content.startsWith("---\n")) {
    return null;
  }
  const end = content.indexOf("\n---", 4);
  if (end < 0) {
    return null;
  }
  const match = content.slice(4, end).match(/^name:\s*(.+?)\s*$/m);
  return match?.[1]?.replace(/^['"]|['"]$/g, "") ?? null;
}

function validateSkillFrontmatterName(
  skillPath: string,
  expectedName: string,
  label: string,
): void {
  if (!fs.existsSync(skillPath)) {
    fail(`${label} is missing SKILL.md: ${skillPath}`);
  }
  assertEqual(frontmatterName(skillPath), expectedName, `${label} frontmatter name`);
}

function validateRepoPluginSkillSource(skillDir: string, pluginName: string, label: string): void {
  const pluginRoot = path.dirname(path.dirname(skillDir));
  const pluginManifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
  if (!fs.existsSync(pluginManifestPath)) {
    fail(`${label} is missing .codex-plugin/plugin.json: ${pluginRoot}`);
  }
  const pluginManifest = readJson(pluginManifestPath);
  assertEqual(pluginManifest.name, pluginName, `${label} plugin manifest name`);
  assertEqual(pluginManifest.skills, "./skills/", `${label} plugin manifest skills path`);
  validateSkillFrontmatterName(path.join(skillDir, "SKILL.md"), pluginName, label);
}

type ParsedArgs = {
  agentRoots: AgentRootMap;
  codexSkillsRoot: string | null;
  policyPath: string;
  registryPath: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const roots = new Map<string, string>();
  let codexSkillsRoot: string | null = null;
  let selectedPolicyPath = policyPath;
  let selectedRegistryPath = registryPath;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--policy-path") {
      const policyOverride = argv[index + 1]?.trim();
      if (!policyOverride) {
        fail("--policy-path requires <path>");
      }
      index += 1;
      selectedPolicyPath = path.resolve(policyOverride);
      continue;
    }
    if (token === "--registry-path") {
      const registryOverride = argv[index + 1]?.trim();
      if (!registryOverride) {
        fail("--registry-path requires <path>");
      }
      index += 1;
      selectedRegistryPath = path.resolve(registryOverride);
      continue;
    }
    if (token === "--codex-skills-root") {
      const root = argv[index + 1]?.trim();
      if (!root) {
        fail("--codex-skills-root requires <path>");
      }
      index += 1;
      codexSkillsRoot = path.resolve(root);
      continue;
    }
    if (token !== "--agent-root") {
      fail(`Unknown argument: ${token}`);
    }
    const spec = argv[index + 1];
    if (!spec || !spec.includes("=")) {
      fail("--agent-root requires <agent_id>=<path>");
    }
    index += 1;
    const [agentId, ...pathParts] = spec.split("=");
    const root = pathParts.join("=").trim();
    if (!expectedRequiredAgentIds.includes(agentId) || !root) {
      fail(`Invalid --agent-root value: ${spec}`);
    }
    roots.set(agentId, path.resolve(root));
  }
  return {
    agentRoots: roots,
    codexSkillsRoot,
    policyPath: selectedPolicyPath,
    registryPath: selectedRegistryPath,
  };
}

function findExposureClass(policy: any, id: string): any {
  const entry = policy.exposure_classes?.find((item: any) => item.id === id);
  if (!entry) {
    fail(`missing exposure class ${id}`);
  }
  return entry;
}

function findDomainExposure(policy: any, domainId: string): any {
  const entry = policy.domain_exposure?.find((item: any) => item.domain_id === domainId);
  if (!entry) {
    fail(`missing domain exposure ${domainId}`);
  }
  return entry;
}

function findInstallAgent(contract: any, agentId: string): any {
  const entry = contract.agents?.find((item: any) => item.agent_id === agentId);
  if (!entry) {
    fail(`missing agent installation entry ${agentId}`);
  }
  return entry;
}

function validatePluginRoot(agentId: string, root: string, installAgent: any): void {
  const pluginName = installAgent.codex_visible_entry;
  if (typeof pluginName !== "string" || !pluginName.trim()) {
    fail(`${agentId} installation entry is missing codex_visible_entry`);
  }
  const pluginManifestPath = path.join(root, ".codex-plugin", "plugin.json");
  const skillPath = path.join(root, "skills", pluginName, "SKILL.md");
  if (!fs.existsSync(pluginManifestPath)) {
    fail(`${agentId} plugin root is missing .codex-plugin/plugin.json: ${root}`);
  }
  if (!fs.existsSync(skillPath)) {
    fail(`${agentId} plugin root is missing skills/${pluginName}/SKILL.md: ${root}`);
  }
  const pluginManifest = readJson(pluginManifestPath);
  assertEqual(pluginManifest.name, pluginName, `${agentId} plugin manifest name`);
  assertEqual(pluginManifest.skills, "./skills/", `${agentId} plugin manifest skills path`);
  validateSkillFrontmatterName(skillPath, pluginName, `${agentId} plugin skill`);
}

function validateNoDuplicateBareDomainSkills(root: string | null): string | null {
  if (!root) {
    return null;
  }
  if (!fs.existsSync(root)) {
    fail(`Codex skills root does not exist: ${root}`);
  }
  for (const skillId of expectedDefaultVisibleDomainSkillIds) {
    const skillPath = path.join(root, skillId, "SKILL.md");
    if (fs.existsSync(skillPath)) {
      fail(`${skillId} must not be mirrored as a bare Codex skill at ${skillPath}`);
    }
  }
  return root;
}

function validateContract(
  policy: any,
  profile: any,
  registry: any,
  agentPackageSurfaceSchema: any,
  packageJson: any,
  agentRoots: AgentRootMap,
): void {
  validatePublicAbi(policy, packageJson);
  const contract = validateAgentInstallationContract(policy);
  validateAgentPackageSurfaceSchema(contract, registry, agentPackageSurfaceSchema);
  validateLaunchAuthorityFixtures(agentPackageSurfaceSchema);
  assertJsonEqual(
    profile.gui?.agent_package_activation_policy,
    expectedActivationPolicy,
    "profile package activation policy",
  );
  validateAgentRegistryPolicy(contract, profile, registry);
  validateCanonicalPackageConsumers(policy, profile, registry);
  validateFirstPartyManifestFixtures(profile, agentPackageSurfaceSchema);
  validateManagedPackageDistribution(contract);
  validatePluginRegistrationInputs(contract);
  validateExposureClasses(policy, contract);
  validateProfileCompanionPayloads(profile);
  validateAgentInstallEntries(policy, contract, agentRoots);
}

function validatePublicAbi(policy: any, packageJson: any): void {
  assertFieldsEqual(
    policy,
    {
      owner: "one-person-lab-app",
      producer_owner: "one-person-lab",
    },
    "policy",
  );
  assertFieldsEqual(
    policy.public_abi,
    {
      primary_semantic_entry: "skill",
      plugin_role: "codex_app_distribution_and_capability_bundle",
      direct_skill_compatibility_required: true,
      plugin_must_not_create_second_semantics: true,
      app_must_not_mirror_plugin_skill_as_duplicate_bare_skill: true,
    },
    "public ABI",
  );
  assertEqual(
    packageJson.scripts?.["validate:agent-installation"],
    "node --experimental-strip-types scripts/validate-agent-installation-contract.ts",
    "package validate:agent-installation script",
  );
}

function validateAgentInstallationContract(policy: any): any {
  const contract = policy.agent_installation_contract;
  if (!contract) {
    fail("missing agent_installation_contract");
  }
  assertFieldsEqual(
    contract,
    {
      owner: "one-person-lab-app",
      producer_owner: "one-person-lab",
      unified_sync_command: "opl connect sync-skills",
      managed_install_source: "opl_managed_packages",
      user_agent_installation_mode: "consume_shared_skill_action_stage_metadata",
      codex_plugin_registry_target: "codex_plugin_registry",
      direct_skill_target: "codex_user_skill_discovery_path",
      product_entry_target: "family-product-entry-manifest-v2",
      may_use_developer_checkout_by_default: false,
      developer_checkout_override_policy: "explicit_opt_in_only",
      developer_checkout_override_surface: "Developer Profile source_channel capability",
      ordinary_user_package_source: "framework_managed_ghcr_oci_opl_packages_latest_stable_channel",
      duplicate_bare_skill_policy: "forbid_domain_plugin_skill_mirrors",
    },
    "agent contract",
  );
  assertArrayEqual(contract.required_agent_ids, expectedRequiredAgentIds, "required agent ids");
  assertArrayEqual(
    contract.required_package_ids,
    expectedRegistryPackageIds,
    "required package ids",
  );
  assertArrayEqual(
    contract.default_plugin_agent_ids,
    expectedDefaultPluginAgentIds,
    "default plugin agent ids",
  );
  assertArrayEqual(
    contract.generated_plugin_agent_ids,
    expectedGeneratedAgentIds,
    "generated plugin agent ids",
  );
  assertArrayEqual(
    contract.fail_closed_states,
    expectedFailClosedStates,
    "agent contract fail closed states",
  );
  assertArrayEqual(
    policy.sync_and_install_contract?.fail_closed_states,
    expectedFailClosedStates,
    "sync fail closed states",
  );
  assertArrayEqual(
    contract.fail_closed_states,
    policy.sync_and_install_contract.fail_closed_states,
    "shared fail closed states",
  );
  assertArrayEqual(contract.managed_package_ids, expectedRegistryPackageIds, "managed package ids");
  validatePackageManagerLifecycle(contract);
  validateRegistryPolicyShape(contract);
  validateThirdPartyManualSourcePolicy(contract);
  validatePackageLockReceiptContract(contract);
  validateAtomicBundlePolicy(contract);
  return contract;
}

function validateRegistryPolicyShape(contract: any): void {
  const registryPolicy = contract.agent_registry_policy;
  assertFieldsEqual(
    registryPolicy,
    {
      policy_surface:
        "Settings Capabilities registry discovery, manifest URL install entry, and package receipt display",
      default_registry_ref: "contracts/agent-package-registry.json",
      default_registry_source_kind: "default_external_registry",
      default_registry_url:
        "https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/contracts/agent-package-registry.json",
      default_registry_scope: "external_discovery_only",
      empty_default_registry_allowed: true,
      first_party_release_set_runtime_authority:
        "one-person-lab-framework#built_in_release_set",
      canonical_first_party_package_ids_source_ref:
        "contracts/app-product-profile.json#gui.agent_package_registry.canonical_first_party_package_ids",
      external_first_party_identity_claims_allowed: false,
      external_first_party_trust_claims_allowed: false,
      external_first_party_collision_failure_code:
        "agent_package_registry_first_party_identity_collision",
      manifest_schema_ref:
        "contracts/agent-package-surfaces.schema.json#/$defs/opl_package_manifest",
      home_shortcut_schema_ref:
        "contracts/agent-package-surfaces.schema.json#/$defs/home_shortcut_metadata",
      invocation_receipt_schema_ref:
        "contracts/agent-package-surfaces.schema.json#/$defs/invocation_receipt",
      package_lock_receipt_schema_ref:
        "contracts/agent-package-surfaces.schema.json#/$defs/package_lock_receipt",
      first_party_manifest_fixture_dir: "contracts/fixtures/agent-package-manifests",
      registry_is_discovery_only: true,
      registry_install_authority_allowed: false,
      manifest_url_required_for_install: true,
      manifest_validation_required_before_install: true,
      install_authority: "validated_opl_package_manifest_plus_framework_package_lock_receipt",
      mutating_actions_owner: "one-person-lab",
      app_role:
        "refresh_external_registry_display_external_candidates_and_route_selected_manifest_url_to_framework_without_owning_first_party_identity_or_agent_semantics",
      direct_manifest_url_install_allowed: true,
      third_party_registry_required_for_manual_install: false,
      third_party_entry_policy:
        "external_registry_entries_may_be_listed_for_discovery_but_must_not_claim_canonical_first_party_identity_or_trust_and_install_requires_explicit_user_action_trust_tier_assignment_manifest_validation_package_lock_receipt_and_rollback_ref",
      session_contract_allowed: false,
      app_hardcoded_agent_ids_required: false,
    },
    "agent registry policy",
  );
  assertArrayEqual(
    registryPolicy?.allowed_registry_source_kinds,
    expectedRegistrySourceKinds,
    "registry source kinds",
  );
  assertArrayEqual(
    registryPolicy?.registry_management_actions,
    expectedRegistryManagementActions,
    "registry management actions",
  );
  assertArrayEqual(
    registryPolicy?.entry_required_fields,
    expectedRegistryPolicyEntryFields,
    "registry entry fields",
  );
  assertArrayEqual(
    registryPolicy?.manifest_required_fields,
    expectedManifestRequiredFields,
    "manifest required fields",
  );
}

function schemaDef(schema: any, name: string): any {
  const def = schema?.$defs?.[name];
  if (!def || typeof def !== "object") {
    fail(`agent package surface schema missing $defs.${name}`);
  }
  return def;
}

function validateAgentPackageSurfaceSchema(contract: any, registry: any, schema: any): void {
  assertFieldsEqual(
    schema,
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://onepersonlab.dev/contracts/agent-package-surfaces.schema.json",
      title: "OPL Package Surfaces",
    },
    "agent package surface schema",
  );
  assertEqual(
    schema.properties?.external_agent_package_registry?.$ref,
    "#/$defs/external_agent_package_registry",
    "external agent package registry schema ref",
  );
  const externalRegistrySchema = schemaDef(schema, "external_agent_package_registry");
  assertEqual(
    externalRegistrySchema.properties?.registry_source_kind?.const,
    "default_external_registry",
    "default registry external source kind",
  );
  assertEqual(
    externalRegistrySchema.properties?.canonical_first_party_entries_allowed?.const,
    false,
    "external registry first-party identity policy",
  );
  assertEqual(
    externalRegistrySchema.properties?.first_party_trust_claims_allowed?.const,
    false,
    "external registry first-party trust policy",
  );
  assertEqual(
    externalRegistrySchema.properties?.empty_registry_allowed?.const,
    true,
    "empty external registry policy",
  );
  assertEqual(
    schema.properties?.agent_package_registry_entry?.$ref,
    "#/$defs/agent_package_registry_entry",
    "agent package registry entry schema ref",
  );
  const registryEntrySchema = schemaDef(schema, "agent_package_registry_entry");
  assertArrayEqual(
    registryEntrySchema.properties?.package_id?.not?.enum,
    expectedRegistryPackageIds,
    "external registry reserved first-party package ids",
  );
  assertEqual(
    registryEntrySchema.properties?.source?.not?.pattern,
    forbiddenExternalFirstPartyClaimPattern,
    "external registry forbidden first-party sources",
  );
  assertEqual(
    registryEntrySchema.properties?.trust_tier?.not?.pattern,
    forbiddenExternalFirstPartyClaimPattern,
    "external registry forbidden first-party trust tier",
  );
  assertArrayEqual(
    registryEntrySchema.required,
    expectedRegistryEntryFields,
    "agent package registry entry schema required fields",
  );
  assertArrayEqual(
    registryEntrySchema.properties?.package_role?.enum,
    expectedRegistryRoles,
    "agent package registry entry roles",
  );
  assertEqual(
    registryEntrySchema.properties?.description?.pattern,
    "\\S",
    "agent package registry entry non-empty description pattern",
  );
  assertEqual(
    registryEntrySchema.properties?.tags?.minItems,
    1,
    "agent package registry entry minimum tag count",
  );
  assertEqual(
    registryEntrySchema.properties?.tags?.uniqueItems,
    true,
    "agent package registry entry unique tags",
  );
  assertEqual(
    registryEntrySchema.properties?.tags?.items?.pattern,
    "\\S",
    "agent package registry entry non-empty tag pattern",
  );
  assertArrayEqual(
    registryEntrySchema.properties?.manifest_validation?.enum,
    expectedRegistryManifestValidationStates,
    "agent package registry entry manifest validation states",
  );
  assertEqual(
    registryEntrySchema.oneOf?.length,
    2,
    "agent package registry entry currentness modes",
  );
  assertArrayEqual(
    schemaDef(schema, "opl_package_manifest").required,
    expectedManifestRequiredFields,
    "agent package manifest schema required fields",
  );
  assertArrayEqual(
    schemaDef(schema, "opl_package_manifest").properties?.distribution_payload?.required,
    expectedDistributionPayloadFields,
    "agent package manifest distribution payload fields",
  );
  if (
    schemaDef(schema, "opl_package_manifest").properties?.codex_surface?.properties
      ?.plugin_payload_manifest_url?.type !== "string"
  ) {
    fail("agent package manifest codex_surface must allow plugin_payload_manifest_url");
  }
  const physicalSurfaceProperties = schemaDef(schema, "package_lock_receipt").properties
    ?.physical_surface?.properties;
  for (const field of [
    "plugin_payload_manifest_url",
    "plugin_payload_manifest_sha256",
    "plugin_payload_cache_path",
  ]) {
    if (physicalSurfaceProperties?.[field]?.type !== "string") {
      fail(`package lock physical_surface must allow ${field}`);
    }
  }
  assertArrayEqual(
    schemaDef(schema, "home_shortcut_metadata").required,
    expectedHomeShortcutRequiredFields,
    "home shortcut metadata schema required fields",
  );
  assertArrayEqual(
    schemaDef(schema, "invocation_receipt").required,
    expectedInvocationReceiptRequiredFields,
    "invocation receipt schema required fields",
  );
  assertArrayEqual(
    schemaDef(schema, "package_lock_receipt").required,
    expectedPackageLockReceiptFields,
    "package lock receipt schema required fields",
  );
  const activationRequest = schemaDef(schema, "agent_package_activation_request");
  assertArrayEqual(
    activationRequest.required,
    expectedActivationRequestRequiredFields,
    "agent package activation request required fields",
  );
  assertArrayEqual(
    activationRequest.properties?.scope?.enum,
    expectedActivationPolicy.scope_values,
    "agent package activation request scope values",
  );
  assertEqual(
    activationRequest.allOf?.length,
    2,
    "agent package activation request conditional target count",
  );
  assertJsonEqual(
    activationRequest.allOf?.map((condition: any) => ({
      scope: condition?.if?.properties?.scope?.const,
      required: condition?.then?.required,
      forbidden: condition?.then?.not?.required,
    })),
    [
      { scope: "workspace", required: ["target_workspace"], forbidden: ["target_quest"] },
      { scope: "quest", required: ["target_quest"], forbidden: ["target_workspace"] },
    ],
    "agent package activation request scope targets",
  );
  const activationResult = schemaDef(schema, "agent_package_activation_result");
  assertArrayEqual(
    activationResult.required,
    expectedActivationResultRequiredFields,
    "agent package activation result required fields",
  );
  assertEqual(
    activationResult.properties?.launch_allowed?.type,
    "boolean",
    "agent package activation result launch gate",
  );
  assertEqual(
    activationResult.properties?.use_boundary_id?.type,
    "string",
    "agent package activation result use-boundary identity",
  );
  assertEqual(
    schema.properties?.agent_package_use_binding?.$ref,
    "#/$defs/agent_package_use_binding",
    "agent package use binding schema ref",
  );
  const useBinding = schemaDef(schema, "agent_package_use_binding");
  assertArrayEqual(
    useBinding.required,
    expectedUseBindingRequiredFields,
    "agent package use binding required fields",
  );
  assertEqual(
    useBinding.properties?.surface_kind?.const,
    "opl_agent_package_use_binding.v1",
    "agent package use binding surface",
  );
  const useBindingPackage = schemaDef(schema, "agent_package_use_binding_package");
  assertArrayEqual(
    useBindingPackage.required,
    expectedUseBindingPackageRequiredFields,
    "agent package use binding package required fields",
  );
  assertJsonEqual(
    activationResult.properties?.use_binding?.oneOf,
    [
      { type: "null" },
      { $ref: "#/$defs/agent_package_use_binding" },
    ],
    "agent package activation result canonical use binding",
  );
  assertJsonEqual(
    activationResult.properties?.package_use_binding?.oneOf,
    [
      { type: "null" },
      { $ref: "#/$defs/agent_package_use_binding" },
    ],
    "agent package activation result compatibility use binding",
  );
  assertArrayEqual(
    activationResult.dependentRequired?.package_use_binding,
    ["use_binding"],
    "agent package activation result alias requires canonical binding",
  );
  assertJsonEqual(
    activationResult.properties?.launch_blocked_reason?.type,
    ["string", "null"],
    "agent package activation result blocked reason",
  );
  assertJsonEqual(
    activationResult.properties?.launch_blocked_reason?.not?.enum,
    ["recovery_in_progress", "recovery_required"],
    "agent package activation result rejects bare recovery launch aliases",
  );
  assertEqual(
    activationResult.oneOf?.length,
    2,
    "agent package activation result conditional branch count",
  );
  assertArrayEqual(
    activationResult.oneOf?.[0]?.required,
    ["use_receipt_ref", "use_binding"],
    "agent package activation success conditional fields",
  );
  assertArrayEqual(
    activationResult.oneOf?.[1]?.required,
    ["launch_blocked_reason"],
    "agent package activation blocked conditional fields",
  );
  assertEqual(
    schema.properties?.agent_package_recovery_readback?.$ref,
    "#/$defs/agent_package_recovery_readback",
    "agent package recovery readback schema ref",
  );
  const recoveryReadback = schemaDef(schema, "agent_package_recovery_readback");
  assertArrayEqual(
    recoveryReadback.required,
    expectedRecoveryReadbackRequiredFields,
    "agent package recovery readback required fields",
  );
  assertEqual(
    recoveryReadback.properties?.surface_kind?.const,
    "opl_agent_package_recovery_readback",
    "agent package recovery readback surface",
  );
  assertEqual(
    recoveryReadback.properties?.vocabulary_version?.const,
    "opl-agent-package-recovery.v1",
    "agent package recovery vocabulary version",
  );
  assertJsonEqual(
    recoveryReadback.properties?.status?.enum,
    ["not_required", "recovery_in_progress", "recovery_required", "recovered"],
    "agent package recovery readback status vocabulary",
  );
  assertEqual(
    recoveryReadback.oneOf?.length,
    4,
    "agent package recovery action availability branches",
  );
  const activationAction = schemaDef(schema, "agent_package_activation_action");
  assertArrayEqual(
    activationAction.required,
    expectedActivationActionRequiredFields,
    "agent package activation action required fields",
  );
  assertEqual(
    activationAction.properties?.action_id?.const,
    "agent_package_activate",
    "agent package activation action id",
  );
  assertArrayEqual(
    activationAction.properties?.preparation_status?.enum,
    expectedActivationPreparationStatuses,
    "agent package activation preparation statuses",
  );
  assertEqual(
    schema.properties?.agent_package_use_boundary_action?.$ref,
    "#/$defs/agent_package_use_boundary_action",
    "agent package use-boundary action schema ref",
  );
  const useBoundaryAction = schemaDef(schema, "agent_package_use_boundary_action");
  assertArrayEqual(
    useBoundaryAction.required,
    expectedUseBoundaryActionRequiredFields,
    "agent package use-boundary action required fields",
  );
  assertEqual(
    useBoundaryAction.properties?.surface_kind?.const,
    "opl_agent_package_use_boundary_action.v1",
    "agent package use-boundary action surface",
  );
  assertEqual(
    useBoundaryAction.properties?.action_id?.const,
    "agent_package_activate",
    "agent package use-boundary action id",
  );
  assertJsonEqual(
    useBoundaryAction.properties?.reason_code?.not?.enum,
    ["recovery_in_progress", "recovery_required"],
    "agent package use-boundary action rejects bare recovery aliases",
  );
  const blockerSchema = useBoundaryAction.properties?.blocker?.oneOf?.[1];
  assertJsonEqual(
    blockerSchema?.properties?.code?.not?.enum,
    ["recovery_in_progress", "recovery_required"],
    "agent package use-boundary blocker rejects bare recovery aliases",
  );
  assertJsonEqual(
    blockerSchema?.properties?.recovery_action_ref?.type,
    ["string", "null"],
    "agent package use-boundary blocker nullable recovery action ref",
  );
  assertArrayEqual(
    useBoundaryAction.properties?.preparation_status?.enum,
    expectedUseBoundaryPreparationStatuses,
    "agent package use-boundary preparation statuses",
  );
  assertEqual(
    useBoundaryAction.oneOf?.length,
    2,
    "agent package use-boundary executable and blocked branches",
  );
  assertEqual(
    schema.properties?.agent_package_session_launch_projection?.$ref,
    "#/$defs/agent_package_session_launch_projection",
    "agent package session launch projection schema ref",
  );
  const sessionLaunchProjection = schemaDef(schema, "agent_package_session_launch_projection");
  assertArrayEqual(
    sessionLaunchProjection.required,
    expectedSessionLaunchProjectionRequiredFields,
    "agent package session launch projection required fields",
  );
  assertEqual(
    sessionLaunchProjection.properties?.surface_kind?.const,
    "opl_agent_package_session_launch_projection.v1",
    "agent package session launch projection surface",
  );
  assertEqual(
    sessionLaunchProjection.properties?.writes_performed?.const,
    false,
    "agent package session launch projection is read only",
  );
  assertEqual(
    sessionLaunchProjection.properties?.global_workspace_root_unchanged?.const,
    true,
    "agent package session launch projection preserves global root",
  );
  assertEqual(
    contract.agent_registry_policy.manifest_schema_ref,
    registry.manifest_schema_ref,
    "registry manifest schema ref",
  );
  assertEqual(
    registry.registry_schema_ref,
    "contracts/agent-package-surfaces.schema.json#/$defs/external_agent_package_registry",
    "external registry schema ref",
  );
}

function hasExactFields(value: any, expected: string[]): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  return JSON.stringify(actual) === JSON.stringify([...expected].sort());
}

function frameworkUseBindingConforms(binding: any, result: any): boolean {
  if (
    !hasExactFields(binding, expectedUseBindingRequiredFields)
    || binding.surface_kind !== "opl_agent_package_use_binding.v1"
    || binding.use_boundary_id !== result.use_boundary_id
    || binding.use_receipt_ref !== result.use_receipt_ref
    || binding.root_package?.package_id !== result.package_id
    || !hasExactFields(binding.root_package, expectedUseBindingPackageRequiredFields)
    || !Array.isArray(binding.provider_packages)
    || binding.provider_packages.some(
      (entry: any) => !hasExactFields(entry, expectedUseBindingPackageRequiredFields),
    )
    || !["workspace", "quest"].includes(binding.scope)
    || typeof binding.target_root !== "string"
    || binding.target_root.length === 0
    || !["channel_verified", "offline_lkg"].includes(binding.freshness_mode)
    || typeof binding.latest_verified !== "boolean"
    || typeof binding.checked_at !== "string"
    || !["updated", "current", "recovered_last_known_good"].includes(binding.refresh_outcome)
    || !hasExactFields(binding.core_readiness, ["status", "required_skill_ids", "materialized_skill_ids"])
    || !hasExactFields(binding.specialty_exposure, [
      "status",
      "declared_skill_ids",
      "materialized_skill_ids",
      "missing_skill_ids",
    ])
  ) {
    return false;
  }
  return true;
}

function activationResultConforms(result: any): boolean {
  if (
    typeof result?.launch_allowed !== "boolean"
    || typeof result?.use_boundary_id !== "string"
    || result.use_boundary_id.length === 0
    || ["recovery_in_progress", "recovery_required"].includes(result.launch_blocked_reason)
  ) {
    return false;
  }
  if (result.launch_allowed) {
    if (
      typeof result.use_receipt_ref !== "string"
      || result.use_receipt_ref.length === 0
      || !frameworkUseBindingConforms(result.use_binding, result)
    ) {
      return false;
    }
    return result.package_use_binding === undefined
      || JSON.stringify(result.package_use_binding) === JSON.stringify(result.use_binding);
  }
  return typeof result.launch_blocked_reason === "string"
    && result.launch_blocked_reason.length > 0
    && (result.use_receipt_ref === null || result.use_receipt_ref === undefined)
    && (result.use_binding === null || result.use_binding === undefined)
    && (result.package_use_binding === null || result.package_use_binding === undefined);
}

function validateLaunchAuthorityFixtures(schema: any): void {
  const activationResults = readJson(agentPackageActivationResultsFixturePath);
  const launchMatrix = readJson(agentPackageLaunchStateMatrixFixturePath);
  assertJsonEqual(
    activationResults.framework_binding_admission,
    {
      status: "pending_exact_Framework_producer_checkpoint",
      producer_repository: "gaofeng21cn/one-person-lab",
      producer_commit: null,
      source_type_ref:
        "src/modules/connect/agent-package-registry-parts/types.ts#AgentPackageUseBinding",
      surface_kind: "opl_agent_package_use_binding.v1",
      canonical_case_id: "ready_live",
      fixture_role: "App_design_authority_only_not_cross_repo_admission_evidence",
      cross_repo_admission_satisfied: false,
      required_admission_consumers: ["App_schema", "App_validator", "Shell_parser"],
      admission_policy:
        "regenerate_from_the_exact_future_Framework_activation_producer_and_pass_the_bytes_unchanged_through_App_schema_validator_and_Shell_parser",
    },
    "pending Framework use binding admission",
  );
  for (const example of activationResults.cases ?? []) {
    if (!activationResultConforms(example.result)) {
      fail(`activation result fixture ${example.case_id} does not satisfy the public App contract`);
    }
  }
  const activationCases = new Map(
    activationResults.cases.map((entry: any) => [entry.case_id, entry]),
  );
  const canonicalSuccess = structuredClone((activationCases.get("ready_live") as any).result);
  const aliasCompatible = structuredClone(canonicalSuccess);
  aliasCompatible.package_use_binding = structuredClone(aliasCompatible.use_binding);
  assertEqual(activationResultConforms(aliasCompatible), true, "deep-identical binding alias");
  const aliasOnly = structuredClone(aliasCompatible);
  delete aliasOnly.use_binding;
  assertEqual(activationResultConforms(aliasOnly), false, "alias-only binding rejection");
  const aliasRootDrift = structuredClone(aliasCompatible);
  aliasRootDrift.package_use_binding.root_package.package_lock_ref = "opl://drift/root-lock";
  assertEqual(activationResultConforms(aliasRootDrift), false, "binding alias root drift rejection");
  const aliasProviderDrift = structuredClone(aliasCompatible);
  aliasProviderDrift.package_use_binding.provider_packages[0].package_version = "9.9.9";
  assertEqual(activationResultConforms(aliasProviderDrift), false, "binding alias provider drift rejection");
  const invalidSurface = structuredClone(canonicalSuccess);
  invalidSurface.use_binding.surface_kind = "opl_agent_package_use_binding";
  assertEqual(activationResultConforms(invalidSurface), false, "unversioned binding surface rejection");
  const flatBinding = structuredClone(canonicalSuccess);
  flatBinding.use_binding = {
    surface_kind: "opl_agent_package_use_binding.v1",
    package_id: canonicalSuccess.package_id,
    use_boundary_id: canonicalSuccess.use_boundary_id,
    use_receipt_ref: canonicalSuccess.use_receipt_ref,
  };
  assertEqual(activationResultConforms(flatBinding), false, "flat binding rejection");

  const projectionContract = launchMatrix.request_scoped_projection_contract;
  assertEqual(
    projectionContract.schema_ref,
    "contracts/agent-package-surfaces.schema.json#/$defs/agent_package_session_launch_projection",
    "session launch projection fixture schema ref",
  );
  assertEqual(projectionContract.producer_cli_route, null, "session launch producer route remains Framework-owned");
  const projectionCases = new Map(
    projectionContract.cases.map((entry: any) => [entry.case_id, entry]),
  );
  const globalAndSession = projectionCases.get("global_A_session_B_zero_write") as any;
  const projection = globalAndSession.projection_result;
  assertIncludesAll(
    Object.keys(projection),
    schemaDef(schema, "agent_package_session_launch_projection").required,
    "session launch projection fixture fields",
  );
  assertEqual(projection.surface_kind, "opl_agent_package_session_launch_projection.v1", "session launch projection surface");
  assertEqual(projection.writes_performed, false, "session launch projection write policy");
  assertEqual(projection.global_workspace_root_unchanged, true, "session launch global root policy");
  assertEqual(globalAndSession.workspace_root_set_called, false, "session launch workspace_root_set policy");
  assertEqual(
    globalAndSession.settings_global_workspace_root_before,
    globalAndSession.settings_global_workspace_root_after,
    "session launch preserves global Settings root",
  );
  assertEqual(
    projection.normalized_target_workspace,
    globalAndSession.selected_session_target_workspace,
    "session launch selected target",
  );
  const selectedEntry = projection.directory.entries.find(
    (entry: any) => entry.package_id === projection.package_id,
  );
  assertJsonEqual(projection.use_boundary_action, selectedEntry?.use_boundary_action, "session launch exact directory action");
  assertEqual(
    projection.use_boundary_action.payload.target_workspace,
    projection.normalized_target_workspace,
    "session launch action target",
  );
  const rapidSwitch = projectionCases.get("rapid_A_to_B_discards_late_A") as any;
  assertEqual(rapidSwitch.late_A_response_discarded, true, "rapid target switch stale response");
  assertEqual(rapidSwitch.cache_and_inflight_key_includes_normalized_target, true, "target-scoped cache identity");
  const projectless = projectionCases.get("projectless_package_launch") as any;
  assertFieldsEqual(
    projectless,
    {
      projection_requested: false,
      activation_executed: false,
      launch_allowed: false,
      reason_code: "agent_package_target_workspace_required",
    },
    "projectless package launch",
  );
  const transition = projectionCases.get("session_B_to_C_transition") as any;
  assertEqual(
    transition.fresh_projection_target_workspace,
    transition.new_target_workspace,
    "workspace transition fresh target projection",
  );
  assertArrayEqual(
    transition.fresh_projection_required_before,
    ["conversation_warmup", "runtime_ensure", "turn_or_message_send_build"],
    "workspace transition protected boundaries",
  );
  const drift = projectionCases.get("projection_target_drift") as any;
  assertEqual(drift.accepted, false, "projection target drift admission");
  assertJsonEqual(
    drift.write_delta,
    { conversation: 0, message: 0, turn: 0, runtime_task: 0 },
    "projection target drift write delta",
  );

  const hostContract = launchMatrix.host_launch_authorization_contract;
  assertFieldsEqual(
    hostContract,
    {
      renderer_extra_is_authority: false,
      enforcement_owner: "opl_aion_shell_OPL_adapter_or_OPL_owned_local_gateway",
      aioncore_write_policy: "forbid_OPL_domain_semantics_ledger_DB_migration_or_launch_gate_changes",
    },
    "current P0 package launch owner boundary",
  );
  assertArrayEqual(
    hostContract.current_p0_case_ids,
    [
      "normal_shell_create_missing_or_invalid_activation",
      "warmup_or_send_stale_workspace",
      "normal_shell_valid_activation",
      "plain_conversation",
    ],
    "current P0 package launch cases",
  );
  assertFieldsEqual(
    hostContract.deferred_hardening,
    {
      release_blocking_for_26_7_14: false,
      preferred_future_owner:
        "OPL_owned_local_gateway_or_Electron_main_adapter_or_upstream_generic_authorization_hook",
    },
    "deferred package launch hardening boundary",
  );
  assertArrayEqual(
    hostContract.deferred_hardening.case_ids,
    [
      "direct_create_missing_or_forged_binding",
      "same_token_two_conversations",
      "clone_reuses_source_extra",
      "exact_create_retry_same_conversation",
    ],
    "deferred package launch hardening cases",
  );
  const hostCases = new Map(
    hostContract.cases.map((entry: any) => [entry.case_id, entry]),
  );
  for (const caseId of hostContract.current_p0_case_ids) {
    assertEqual((hostCases.get(caseId) as any)?.scope, "current_p0", `${caseId} release scope`);
  }
  for (const caseId of hostContract.deferred_hardening.case_ids) {
    assertEqual((hostCases.get(caseId) as any)?.scope, "deferred_hardening", `${caseId} release scope`);
  }
  const invalidNormalCreate = hostCases.get("normal_shell_create_missing_or_invalid_activation") as any;
  assertFieldsEqual(
    invalidNormalCreate,
    { accepted: false, downstream_create_called: false },
    "normal Shell invalid activation admission",
  );
  assertJsonEqual(
    invalidNormalCreate.write_delta,
    { conversation: 0, message: 0, turn: 0, runtime_task: 0 },
    "normal Shell invalid activation write delta",
  );
  const stalePreRuntime = hostCases.get("warmup_or_send_stale_workspace") as any;
  assertArrayEqual(
    stalePreRuntime.protected_boundaries,
    ["conversation_warmup", "runtime_ensure", "turn_or_message_send_build"],
    "normal Shell stale activation boundaries",
  );
  assertJsonEqual(
    stalePreRuntime.write_delta,
    { message: 0, turn: 0, runtime_task: 0 },
    "normal Shell stale activation write delta",
  );
  const validNormalActivation = hostCases.get("normal_shell_valid_activation") as any;
  assertFieldsEqual(
    validNormalActivation,
    {
      accepted: true,
      deep_validation_passed: true,
      canonical_use_receipt_ref_forwarded: true,
      canonical_use_binding_persisted: true,
      downstream_create_called: true,
    },
    "normal Shell valid activation admission",
  );
  assertFieldsEqual(
    hostCases.get("plain_conversation"),
    { accepted: true, activation_required: false },
    "plain conversation launch admission",
  );
}

function validateRegistryEntryMetadata(entry: any): void {
  const packageId = String(entry.package_id ?? "<unknown>");
  if (typeof entry.description !== "string" || entry.description.trim().length === 0) {
    fail(`registry entry ${packageId} description must be non-empty`);
  }
  if (!Array.isArray(entry.tags) || entry.tags.length === 0) {
    fail(`registry entry ${packageId} tags must contain at least one non-empty tag`);
  }
  const normalizedTags = entry.tags.map((tag: unknown, index: number) => {
    if (typeof tag !== "string" || tag.trim().length === 0) {
      fail(`registry entry ${packageId} tag ${index} must be non-empty`);
    }
    if (tag !== tag.trim()) {
      fail(`registry entry ${packageId} tag ${index} must not contain surrounding whitespace`);
    }
    return tag;
  });
  if (new Set(normalizedTags).size !== normalizedTags.length) {
    fail(`registry entry ${packageId} tags must not contain duplicates`);
  }

  if (!expectedRegistryRoles.includes(entry.package_role)) {
    fail(
      `registry entry ${packageId} package_role must be one of ${expectedRegistryRoles.join(", ")}`,
    );
  }
  const expectedVersionSourceRef = `${entry.manifest_url}#/version`;
  assertEqual(
    entry.version_source_ref,
    expectedVersionSourceRef,
    `registry entry ${packageId} version source`,
  );
  const selectedVersion = entry.selected_version;
  const stableVersion = entry.stable_version;
  const validVersionValue = (value: unknown) =>
    value === null ||
    (typeof value === "string" && value.trim().length > 0 && value === value.trim());
  if (!validVersionValue(selectedVersion) || !validVersionValue(stableVersion)) {
    fail(`registry entry ${packageId} selected/stable versions must be null or non-empty strings`);
  }
  const selectedResolved = typeof selectedVersion === "string";
  const stableResolved = typeof stableVersion === "string";
  if (selectedResolved !== stableResolved) {
    fail(`registry entry ${packageId} selected_version and stable_version must resolve together`);
  }
  if (selectedResolved && selectedVersion !== stableVersion) {
    fail(`registry entry ${packageId} selected_version must equal stable_version`);
  }
  if (!expectedRegistryManifestValidationStates.includes(entry.manifest_validation)) {
    fail(
      `registry entry ${packageId} manifest_validation must be one of ${expectedRegistryManifestValidationStates.join(", ")}`,
    );
  }
  if (entry.manifest_validation === "deferred" && (selectedResolved || stableResolved)) {
    fail(`registry entry ${packageId} deferred manifest validation requires null versions`);
  }
  if (entry.manifest_validation !== "deferred" && (!selectedResolved || !stableResolved)) {
    fail(`registry entry ${packageId} resolved manifest validation requires selected/stable versions`);
  }
}

function validateAgentRegistryPolicy(contract: any, profile: any, registry: any): void {
  const registryPolicy = contract.agent_registry_policy;
  assertFieldsEqual(
    registry,
    {
      owner: "one-person-lab-app",
      purpose: "external_agent_package_registry_catalog_contract",
      state: "active_external_discovery_contract",
      version: 2,
      policy_ref:
        "contracts/app-install-exposure-policy.json#agent_installation_contract.agent_registry_policy",
      manifest_schema_ref:
        "contracts/agent-package-surfaces.schema.json#/$defs/opl_package_manifest",
      registry_schema_ref:
        "contracts/agent-package-surfaces.schema.json#/$defs/external_agent_package_registry",
      registry_id: "opl-default-external-agent-registry",
      registry_name: "OPL External Agent Registry",
      registry_source_kind: "default_external_registry",
      registry_url: registryPolicy.default_registry_url,
      discovery_only: true,
      install_authority_allowed: false,
      empty_registry_allowed: true,
      canonical_first_party_entries_allowed: false,
      first_party_trust_claims_allowed: false,
      reserved_identity_source_ref:
        "contracts/app-product-profile.json#gui.agent_package_registry.canonical_first_party_package_ids",
      reserved_identity_collision_failure_code:
        "agent_package_registry_first_party_identity_collision",
    },
    "external agent registry catalog",
  );
  if (
    !registry.machine_boundary?.includes("external discovery registry") ||
    !registry.machine_boundary?.includes("Framework built-in Release Set")
  ) {
    fail(
      "default registry must state that Framework owns canonical first-party identity and external discovery cannot claim it",
    );
  }
  assertArrayEqual(
    registry.entry_required_fields,
    expectedRegistryEntryFields,
    "registry catalog entry fields",
  );
  assertArrayEqual(
    registry.manifest_required_fields,
    expectedManifestRequiredFields,
    "registry catalog manifest fields",
  );
  assertArrayEqual(
    registry.excluded_registry_fields,
    expectedRegistryExcludedFields,
    "registry catalog excluded fields",
  );

  const profilePackages = profile.gui?.professional_agent_packages ?? [];
  assertArrayEqual(
    profilePackages.map((entry: any) => entry.package_id),
    expectedProfessionalPackageIds,
    "profile professional package ids",
  );
  const registryProjection = profile.gui?.agent_package_registry;
  assertArrayEqual(
    registryProjection?.canonical_first_party_package_ids,
    expectedRegistryPackageIds,
    "profile canonical first-party package ids",
  );
  assertEqual(
    registryProjection?.first_party_runtime_authority,
    "one-person-lab-framework#built_in_release_set",
    "profile first-party runtime authority",
  );
  assertEqual(
    registryProjection?.registry_scope,
    "external_discovery_only",
    "profile registry scope",
  );
  assertEqual(
    registryProjection?.external_first_party_identity_claims_allowed,
    false,
    "profile external first-party identity policy",
  );
  assertEqual(
    registryProjection?.external_first_party_trust_claims_allowed,
    false,
    "profile external first-party trust policy",
  );
  const firstPartyMetadata = registryProjection?.first_party_release_set_metadata ?? [];
  assertArrayEqual(
    firstPartyMetadata.map((entry: any) => entry.package_id),
    expectedRegistryPackageIds,
    "profile first-party release metadata ids",
  );
  const profileById = new Map(profilePackages.map((entry: any) => [entry.package_id, entry]));
  for (const entry of firstPartyMetadata) {
    validateRegistryEntryMetadata({
      ...entry,
      manifest_url: `fixture://${entry.package_id}`,
      version_source_ref: `fixture://${entry.package_id}#/version`,
      selected_version: null,
      stable_version: null,
      manifest_validation: "deferred",
    });
    assertEqual(
      entry.package_kind,
      expectedPackageKinds[entry.package_id],
      `first-party metadata ${entry.package_id} package kind`,
    );
    assertEqual(
      entry.package_role,
      expectedRegistryRoleByPackageId[entry.package_id],
      `first-party metadata ${entry.package_id} package role`,
    );
    assertEqual(entry.source, "first_party", `first-party metadata ${entry.package_id} source`);
    assertEqual(entry.trust_tier, "first_party", `first-party metadata ${entry.package_id} trust tier`);
    assertEqual(
      entry.manifest_fixture_ref,
      `contracts/fixtures/agent-package-manifests/${entry.package_id}.json`,
      `first-party metadata ${entry.package_id} manifest fixture`,
    );
    if (entry.package_kind === "domain_agent_package" && !profileById.has(entry.package_id)) {
      fail(`domain-agent metadata ${entry.package_id} has no professional profile metadata`);
    }
    if (entry.package_kind !== "domain_agent_package" && profileById.has(entry.package_id)) {
      fail(`non-agent metadata ${entry.package_id} must not be a professional agent profile`);
    }
  }

  const entries = registry.entries ?? [];
  const reservedIds = new Set(expectedRegistryPackageIds);
  for (const entry of entries) {
    for (const field of expectedRegistryEntryFields) {
      const nullableVersionField = field === "selected_version" || field === "stable_version";
      if (
        entry[field] === undefined ||
        (!nullableVersionField && (entry[field] === null || entry[field] === ""))
      ) {
        fail(`registry entry ${entry.package_id} missing ${field}`);
      }
    }
    validateRegistryEntryMetadata(entry);
    if (reservedIds.has(entry.package_id)) {
      fail(
        `external registry entry ${entry.package_id} collides with Framework first-party identity (${registry.reserved_identity_collision_failure_code})`,
      );
    }
    if (isExternalFirstPartyClaim(entry.source)) {
      fail(`external registry entry ${entry.package_id} must not claim first-party source`);
    }
    if (isExternalFirstPartyClaim(entry.trust_tier)) {
      fail(`external registry entry ${entry.package_id} must not claim first-party trust`);
    }
    for (const excludedField of expectedRegistryExcludedFields) {
      if (entry[excludedField] !== undefined) {
        fail(`registry entry ${entry.package_id} must not define ${excludedField}`);
      }
    }
  }
}

function validateFirstPartyManifestFixtures(profile: any, schema: any): void {
  if (!fs.existsSync(agentPackageManifestFixtureDir)) {
    fail(
      `missing first-party agent package manifest fixture dir: ${agentPackageManifestFixtureDir}`,
    );
  }
  const manifestSchema = schemaDef(schema, "opl_package_manifest");
  const profilePackages = new Map(
    (profile.gui?.professional_agent_packages ?? []).map((entry: any) => [entry.package_id, entry]),
  );
  const releaseSetMetadata = profile.gui?.agent_package_registry?.first_party_release_set_metadata ?? [];
  assertArrayEqual(
    fs
      .readdirSync(agentPackageManifestFixtureDir)
      .filter((entry) => entry.endsWith(".json"))
      .sort(),
    expectedRegistryPackageIds.map((packageId) => `${packageId}.json`).sort(),
    "agent package manifest fixture files",
  );
  for (const releaseSetEntry of releaseSetMetadata) {
    const fixturePath = path.join(appRoot, releaseSetEntry.manifest_fixture_ref);
    const manifest = readJson(fixturePath);
    const profileEntry = profilePackages.get(releaseSetEntry.package_id);
    const registryEntry = {
      ...releaseSetEntry,
      codex_visible_entry:
        profileEntry?.codex_visible_entry ?? manifest.codex_surface?.plugin_ids?.[0],
      required_skill_ids:
        profileEntry?.required_skill_ids ?? manifest.codex_surface?.required_skill_ids ?? [],
      optional_skill_ids:
        profileEntry?.optional_skill_ids ?? manifest.codex_surface?.optional_skill_ids ?? [],
      home_shortcut_ids:
        profileEntry?.home_shortcut_ids ??
        (manifest.entrypoints ?? []).map((entry: any) => entry.shortcut_id),
    };
    const fixtureDistributionSurface = JSON.stringify(manifest.distribution_payload ?? {});
    for (const forbidden of ["/opl-agent-", "/opl-package-", "/one-person-lab-modules/"]) {
      if (fixtureDistributionSurface.includes(forbidden)) {
        fail(
          `manifest fixture ${registryEntry.package_id} distribution contains legacy namespace ${forbidden}`,
        );
      }
    }
    if (/:latest(?:[\"/?#]|$)/.test(fixtureDistributionSurface)) {
      fail(
        `manifest fixture ${registryEntry.package_id} must use latest-stable, never the plain latest tag`,
      );
    }
    const missing = expectedManifestRequiredFields.filter(
      (field) =>
        manifest[field] === undefined || manifest[field] === null || manifest[field] === "",
    );
    if (missing.length > 0) {
      fail(`manifest fixture ${registryEntry.package_id} missing ${missing.join(", ")}`);
    }
    for (const forbiddenField of expectedRegistryExcludedFields) {
      if (manifest[forbiddenField] !== undefined) {
        fail(`manifest fixture ${registryEntry.package_id} must not define ${forbiddenField}`);
      }
    }
    if (!manifestSchema?.not?.anyOf || !Array.isArray(manifestSchema.not.anyOf)) {
      fail("OPL package manifest schema must forbid session/domain authority fields");
    }
    assertEqual(
      manifest.package_id,
      registryEntry.package_id,
      `${registryEntry.package_id} manifest package id`,
    );
    assertEqual(
      manifest.package_kind,
      registryEntry.package_kind,
      `${registryEntry.package_id} manifest package kind`,
    );
    if (manifest.package_kind === "domain_agent_package") {
      assertEqual(
        manifest.agent_id,
        manifest.package_id,
        `${registryEntry.package_id} manifest canonical agent id`,
      );
      if (!profileEntry) {
        fail(
          `domain-agent manifest fixture ${registryEntry.package_id} has no matching profile package`,
        );
      }
    } else if (manifest.agent_id !== undefined || profileEntry) {
      fail(
        `non-agent manifest fixture ${registryEntry.package_id} must not define agent identity or a professional profile`,
      );
    }
    assertEqual(
      manifest.display_name,
      registryEntry.display_name,
      `${registryEntry.package_id} manifest display name`,
    );
    assertEqual(
      manifest.publisher,
      registryEntry.publisher,
      `${registryEntry.package_id} manifest publisher`,
    );
    assertEqual(
      manifest.source,
      registryEntry.source,
      `${registryEntry.package_id} manifest source`,
    );
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(manifest.version))) {
      fail(`manifest fixture ${registryEntry.package_id} version must be SemVer test data`);
    }
    assertEqual(
      manifest.update_channel,
      "managed_opl_packages",
      `${registryEntry.package_id} manifest update channel`,
    );
    assertEqual(
      manifest.health_check?.kind,
      "opl_package_receipt",
      `${registryEntry.package_id} manifest health check kind`,
    );
    assertArrayEqual(
      Object.keys(manifest.distribution_payload ?? {}),
      expectedDistributionPayloadFields,
      `${registryEntry.package_id} manifest distribution payload fields`,
    );
    assertFieldsEqual(
      manifest.distribution_payload,
      {
        payload_kind: "ghcr_oci_opl_package",
        proof_status: "contract_fixture_non_live",
        live_download_proof: false,
        installed_reload_proof: false,
        oci_media_type: "application/vnd.onepersonlab.package.v1+tar",
        moving_tag: "latest-stable",
        promotion_policy: "daily_candidate_gates_then_promote_latest_stable",
        install_truth: "resolved_digest_lock",
      },
      `${registryEntry.package_id} manifest distribution payload`,
    );
    assertEqual(
      manifest.distribution_payload.oci_ref,
      `ghcr.io/gaofeng21cn/one-person-lab-packages/${registryEntry.package_id}:latest-stable`,
      `${registryEntry.package_id} manifest latest OCI ref`,
    );
    assertEqual(
      manifest.distribution_payload.payload_ref,
      `ghcr.io/gaofeng21cn/one-person-lab-packages/${registryEntry.package_id}:${manifest.version}`,
      `${registryEntry.package_id} manifest immutable OCI ref`,
    );
    assertEqual(
      manifest.distribution_payload.immutable_tag,
      manifest.version,
      `${registryEntry.package_id} manifest immutable OCI tag`,
    );
    assertFixtureDigestRef(
      manifest.distribution_payload.payload_digest_ref,
      `${registryEntry.package_id} manifest payload digest ref`,
    );
    for (const lockRef of manifest.distribution_payload.required_skill_pack_lock_refs) {
      assertFixtureDigestRef(
        lockRef,
        `${registryEntry.package_id} manifest required skill pack lock ref`,
        true,
      );
    }
    assertArrayEqual(
      manifest.codex_surface?.plugin_ids,
      [registryEntry.codex_visible_entry],
      `${registryEntry.package_id} manifest plugin ids`,
    );
    assertArrayEqual(
      manifest.codex_surface?.required_skill_ids,
      registryEntry.required_skill_ids,
      `${registryEntry.package_id} manifest required skill ids`,
    );
    assertArrayEqual(
      manifest.codex_surface?.optional_skill_ids,
      registryEntry.optional_skill_ids,
      `${registryEntry.package_id} manifest optional skill ids`,
    );
    if (profileEntry) {
      assertArrayEqual(
        manifest.codex_surface?.required_skill_ids,
        profileEntry.required_skill_ids,
        `${registryEntry.package_id} manifest profile required skill ids`,
      );
    }
    if (!Array.isArray(manifest.skill_packs) || manifest.skill_packs.length !== 1) {
      fail(
        `manifest fixture ${registryEntry.package_id} must declare one bundled required skill pack`,
      );
    }
    const skillPack = manifest.skill_packs[0];
    assertFixtureDigestRef(
      skillPack.lock_ref,
      `${registryEntry.package_id} manifest skill pack lock ref`,
      true,
    );
    assertEqual(
      skillPack.id,
      expectedSkillPackIds[registryEntry.package_id],
      `${registryEntry.package_id} manifest required skill pack id`,
    );
    assertEqual(
      skillPack.install_mode,
      "bundled_required",
      `${registryEntry.package_id} manifest required skill pack install mode`,
    );
    if (skillPack.lock_ref === "registry.version_source_ref") {
      fail(
        `manifest fixture ${registryEntry.package_id} required skill pack lock_ref must not use registry.version_source_ref`,
      );
    }
    assertArrayEqual(
      manifest.distribution_payload.required_skill_pack_lock_refs,
      [skillPack.lock_ref],
      `${registryEntry.package_id} manifest distribution payload skill pack locks`,
    );
    const expectedSource = expectedSkillPackSources[registryEntry.package_id];
    if (!expectedSource) {
      fail(`manifest fixture ${registryEntry.package_id} has no expected skill pack source`);
    }
    assertEqual(
      skillPack.source,
      expectedSource,
      `${registryEntry.package_id} manifest required skill pack source`,
    );
    if (!String(skillPack.source ?? "").startsWith("github:")) {
      fail(
        `manifest fixture ${registryEntry.package_id} required skill pack source must be a github ref`,
      );
    }
    const localSourcePath = validateGithubSourcePathIfAvailable(
      skillPack.source,
      `${registryEntry.package_id} manifest required skill pack source`,
    );
    if (isGeneratedAgent(registryEntry.package_id)) {
      assertEqual(
        skillPack.source_kind,
        "opl_generated_plugin_surface",
        `${registryEntry.package_id} manifest skill pack source kind`,
      );
      assertEqual(
        skillPack.generated_surface_owner,
        "one-person-lab",
        `${registryEntry.package_id} manifest skill pack generated owner`,
      );
      assertEqual(
        skillPack.semantic_pack_root,
        expectedGeneratedSemanticPackRoots[registryEntry.package_id],
        `${registryEntry.package_id} manifest semantic pack root`,
      );
      assertEqual(
        manifest.codex_surface?.plugin_source_ref,
        expectedGeneratedPluginSourceRefs[registryEntry.package_id],
        `${registryEntry.package_id} manifest generated plugin source ref`,
      );
      assertEqual(
        manifest.codex_surface?.generated_surface_owner,
        "one-person-lab",
        `${registryEntry.package_id} manifest generated plugin owner`,
      );
      validateGithubSourcePathIfAvailable(
        skillPack.semantic_pack_root,
        `${registryEntry.package_id} manifest semantic pack root`,
      );
    } else {
      assertEqual(
        skillPack.source_kind,
        "repo_plugin_skill",
        `${registryEntry.package_id} manifest skill pack source kind`,
      );
      if (localSourcePath) {
        validateRepoPluginSkillSource(
          localSourcePath,
          registryEntry.codex_visible_entry,
          `${registryEntry.package_id} manifest source skill`,
        );
      }
    }
    const expectedShortcutIds = registryEntry.home_shortcut_ids ?? [];
    assertArrayEqual(
      manifest.entrypoints.map((entry: any) => entry.shortcut_id),
      expectedShortcutIds,
      `${registryEntry.package_id} manifest entrypoint shortcuts`,
    );
    for (const entrypoint of manifest.entrypoints) {
      assertArrayEqual(
        entrypoint.required_skill_ids,
        registryEntry.required_skill_ids,
        `${registryEntry.package_id} manifest entrypoint required skills`,
      );
      assertEqual(
        entrypoint.shortcut_eligible,
        true,
        `${registryEntry.package_id} manifest entrypoint eligibility`,
      );
    }
  }
}

function validatePackageManagerLifecycle(contract: any): void {
  const lifecycle = contract.package_manager_lifecycle;
  assertFieldsEqual(
    lifecycle,
    {
      policy_surface: "Settings Capabilities package manager and app/cli action receipts",
      manual_check_policy: "automatic_daily_check_plus_explicit_user_refresh",
      apply_selected_policy:
        "automatic_apply_for_clean_managed_roots_explicit_apply_for_selected_packages",
      mutating_actions_require_action_receipt: true,
      rollback_ref_required_for_mutating_actions: true,
      package_lock_required: true,
      domain_truth_authority_allowed: false,
      home_shortcut_preferences_owner: "one-person-lab",
      home_shortcut_preferences_action: "agent_package_preferences_set",
      home_shortcut_preferences_readback: "opl packages list/status#home_shortcut_preferences",
    },
    "package manager lifecycle",
  );
  assertArrayEqual(
    lifecycle?.actions,
    expectedPackageLifecycleActions,
    "package manager lifecycle actions",
  );
  assertJsonEqual(
    lifecycle?.activation_contract,
    expectedActivationPolicy,
    "package manager lifecycle activation contract",
  );
  const activationContractJson = JSON.stringify(lifecycle?.activation_contract);
  for (const agentId of expectedRequiredAgentIds) {
    const explicitAgentIdentity = new RegExp(`(^|[^A-Za-z0-9_-])${agentId}($|[^A-Za-z0-9_-])`);
    if (explicitAgentIdentity.test(activationContractJson)) {
      fail(`package manager lifecycle activation contract must remain generic, found ${agentId}`);
    }
  }
  assertFieldsEqual(
    lifecycle?.automatic_apply_policy,
    {
      cadence: "daily_after_core_ready_and_app_startup_check",
      user_visible_channel: "latest-stable",
      receipt_required: true,
    },
    "package manager lifecycle automatic apply policy",
  );
  assertArrayEqual(
    lifecycle?.automatic_apply_policy?.apply_when,
    [
      "latest_stable_digest_changed",
      "managed_root_clean",
      "manifest_permissions_unchanged",
      "compatibility_gate_passed",
    ],
    "package manager lifecycle automatic apply conditions",
  );
  assertArrayEqual(
    lifecycle?.automatic_apply_policy?.require_user_action_when,
    [
      "developer_checkout",
      "dirty_checkout",
      "permission_scope_changed",
      "major_compatibility_break",
      "verification_failed",
    ],
    "package manager lifecycle manual action conditions",
  );
}

function validateThirdPartyManualSourcePolicy(contract: any): void {
  const sourcePolicy = contract.third_party_manual_source_policy;
  assertArrayEqual(
    sourcePolicy?.ordinary_user_default_source_kinds,
    ["first_party_managed_cohort", "bundled_full_runtime_modules"],
    "manual source ordinary defaults",
  );
  assertArrayEqual(
    sourcePolicy?.manual_third_party_allowed_source_kinds,
    expectedManualThirdPartySourceKinds,
    "manual third-party source kinds",
  );
  assertArrayEqual(
    sourcePolicy?.manual_third_party_requires,
    expectedManualThirdPartyRequires,
    "manual third-party source requirements",
  );
  assertFieldsEqual(
    sourcePolicy,
    {
      developer_override_source_kind: "developer_checkout_override",
      app_hardcoded_repo_path_allowed: false,
      duplicate_bare_skill_mirrors_allowed: false,
      homebrew_package_formula_allowed: false,
      third_party_catalog_required: false,
    },
    "manual source policy",
  );
  assertArrayEqual(
    sourcePolicy?.remote_distribution_payload_contract?.required_fields,
    expectedRemoteDistributionPayloadFields,
    "manual source remote distribution payload fields",
  );
  assertFieldsEqual(
    sourcePolicy?.remote_distribution_payload_contract,
    {
      download_execution_owner: "one-person-lab",
      app_contract_claim:
        "validate_and_route_refs_only_without_claiming_live_download_or_installed_reload",
      live_download_proof_claim_allowed: false,
      installed_reload_proof_claim_allowed: false,
    },
    "manual source remote distribution payload contract",
  );
  if (
    !sourcePolicy?.validation_scope?.includes("without hardcoding exact third-party package ids")
  ) {
    fail(
      "manual source policy must validate shape without hardcoding exact third-party package ids",
    );
  }
}

function validatePackageLockReceiptContract(contract: any): void {
  const receiptContract = contract.package_lock_receipt_contract;
  assertFieldsEqual(
    receiptContract,
    {
      lock_owner: "one-person-lab",
      app_role: "require_and_display_package_lock_refs_without_owning_domain_semantics",
      trust_tier_required: true,
      rollback_ref_required: true,
      codex_visible_entry_required: true,
      optional_skill_refs_are_refs_only: true,
    },
    "package lock receipt contract",
  );
  assertArrayEqual(
    receiptContract?.required_fields,
    expectedPackageLockReceiptFields,
    "package lock receipt fields",
  );
  assertArrayEqual(
    receiptContract?.source_kind_allowed_values,
    expectedPackageSourceKinds,
    "package lock source kinds",
  );
}

function validateAtomicBundlePolicy(contract: any): void {
  const atomicPolicy = contract.atomic_bundle_policy;
  assertArrayEqual(
    atomicPolicy?.managed_package_unit_ids,
    expectedRegistryPackageIds,
    "atomic package unit ids",
  );
  assertArrayEqual(
    atomicPolicy?.package_unit_includes,
    expectedAtomicPackageUnitIncludes,
    "atomic package unit includes",
  );
  assertFieldsEqual(
    atomicPolicy,
    {
      framework_local_payload_validation:
        "repo_plugin_skill sources must resolve to .codex-plugin/plugin.json plus skills/<required_skill_id>/SKILL.md; opl_generated_plugin_surface sources must resolve to the domain pack compiler input and generated_surface_owner=one-person-lab",
      required_skill_pack_lock_policy:
        "skill_packs[].lock_ref must be a release or digest lock and must not equal registry.version_source_ref or a moving tag",
      reconcile_update_uninstall_as_unit: true,
      domain_repo_remains_semantic_owner: true,
      app_package_manager_scope:
        "install_exposure_package_lock_action_receipts_and_codex_visible_entries_only",
      release_payload_proof_live_claim_allowed: false,
      installed_codex_reload_proof_deferred: true,
    },
    "atomic bundle policy",
  );
  assertArrayEqual(
    atomicPolicy?.release_payload_proof_required_fields,
    expectedDistributionPayloadFields,
    "atomic bundle release payload proof fields",
  );
  assertArrayEqual(
    atomicPolicy?.physical_surface_required_skill_readback_fields,
    ["materialized_required_skill_ids", "materialized_required_skill_paths"],
    "atomic bundle physical surface required skill readback fields",
  );
  assertFieldsEqual(
    atomicPolicy?.med_autoscience_professional_skill_pack_unit,
    {
      package_id: "mas",
      agent_id: "mas",
      required_skill_pack_id: "med-autoscience-professional-skill-pack",
      atomic_with_agent_package: true,
      domain_repo_remains_semantic_owner: true,
    },
    "MAS professional skill pack unit",
  );
  assertArrayEqual(
    atomicPolicy?.med_autoscience_professional_skill_pack_unit?.lifecycle_actions,
    ["install", "update", "repair", "uninstall"],
    "MAS professional skill pack lifecycle actions",
  );
}

function validateManagedPackageDistribution(contract: any): void {
  const distribution = contract.managed_package_distribution;
  assertFieldsEqual(
    distribution,
    {
      software_object: "opl_packages",
      lifecycle_owner: "one-person-lab",
      app_role: "request_status_progress_and_receipt_projection_only",
      transaction_visibility:
        "package_lifecycle_with_internal_projection_and_profile_migration_status",
      channel_id: "opl_packages_latest_stable",
      default_transport: "framework_package_lifecycle",
      default_update_mode: "automatic_apply_for_clean_managed_roots",
      default_manifest_tag: "latest-stable",
      distribution_format: "ghcr_oci_artifact",
      registry: "ghcr.io",
      ordinary_user_channel_model: "latest_stable_only",
      internal_candidate_channel: "candidate_ci_only_not_user_visible",
      publication_cadence: "daily_when_source_digest_changes",
      promotion_policy:
        "build_candidate_validate_manifest_skill_plugin_surface_install_smoke_sign_then_promote_latest_stable",
      immutable_tag_required: true,
      digest_lock_required: true,
      latest_stable_is_moving_channel: true,
      stable_or_nightly_user_channels_allowed: false,
      first_party_distribution_payload_status:
        "contract_required_non_live_until_release_owner_publishes_payload",
      must_not_depend_on_fixed_version_tag_by_default: true,
      github_packages_unavailable_policy:
        "fail_closed_with_actionable_background_maintenance_error",
      homebrew_distribution_allowed: false,
      homebrew_formula_allowed: false,
      must_not_write_user_codex_state: true,
      must_not_define_agent_semantics: true,
      cohort_manifest_required: true,
    },
    "agent-pack distribution",
  );
  assertArrayFieldsEqual(
    distribution,
    {
      post_update_sync_required: [
        "codex_plugin_registry",
        "plugin_packaged_skills",
        "opl_generated_plugin_surface",
        "codex_surface",
      ],
      user_visible_channels: ["latest-stable"],
      agent_ids: expectedRequiredAgentIds,
      package_ids: expectedRegistryPackageIds,
      activation_commands: [
        "opl packages activate <package_id> --scope workspace --target-workspace <path>",
        "opl packages activate <package_id> --scope quest --target-quest <path>",
      ],
      first_party_distribution_payload_required_fields: expectedFirstPartyDistributionPayloadFields,
      fallback_source_order: [
        "bundled_full_runtime_modules",
        "framework_managed_ghcr_oci_opl_packages_latest_stable_channel",
        "explicit_developer_checkout_override",
      ],
      forbidden_homebrew_formulae: ["one-person-lab-modules", "one-person-lab-modules-nightly"],
    },
    "agent-pack distribution",
  );
  assertEqual(
    distribution?.package_kinds?.["opl-flow"],
    "workflow_plugin_package",
    "OPL Flow package kind",
  );
  assertFieldsEqual(
    distribution?.opl_flow_package,
    {
      package_id: "opl-flow",
      package_kind: "workflow_plugin_package",
      consumer: "standard_and_full_workflow_baseline",
      install_command: "opl packages install opl-flow",
      update_command: "opl packages update opl-flow",
      app_direct_profile_mutation_allowed: false,
      framework_profile_transaction_allowed: true,
      framework_profile_migration_hook: "opl_packages_post_apply",
      profile_sync_policy:
        "codex_semantic_merge_with_marker_cleanup_hash_backup_receipt_rollback_and_packet_fallback",
      carrier_reconcile_special_case_allowed: false,
      workflow_profile_semantic_merge_ref:
        "managed_update_plane.software_lifecycle.objects.opl_packages.optional_internal_fields#profile_migration_status",
      standard_updater_allowed: false,
    },
    "OPL Flow package policy",
  );
  assertFieldsEqual(
    distribution?.auto_apply,
    {
      enabled_for: "clean_managed_roots_only",
      trigger: "daily_or_startup_latest_stable_digest_check",
      receipt_required: true,
    },
    "agent-pack distribution auto apply",
  );
  assertArrayEqual(
    distribution?.auto_apply?.skip_when,
    [
      "developer_checkout_override",
      "dirty_checkout",
      "permission_scope_changed",
      "major_compatibility_break",
      "verification_failed",
      "idempotency_lock_in_progress",
    ],
    "agent-pack distribution auto apply skips",
  );
}

function validatePluginRegistrationInputs(contract: any): void {
  assertEqual(
    contract.plugin_registration_validation_command,
    "npm run validate:agent-installation",
    "agent validation command",
  );
  assertFieldsEqual(
    contract.plugin_registration_validation_inputs,
    {
      plugin_root_flag: "--agent-root <agent_id>=<path>",
      codex_skills_root_flag: "--codex-skills-root <path>",
      default_live_codex_skills_root: "~/.codex/skills",
      codex_skills_root_validation_scope:
        "fail if med-autoscience, med-autogrant, redcube-ai, or opl-bookforge exists as a bare Codex skill mirror at <codex_skills_root>/<codex_visible_entry>/SKILL.md",
    },
    "agent validation inputs",
  );
  assertArrayEqual(
    contract.plugin_registration_validation_inputs?.validated_output_fields,
    ["validated_plugin_roots", "validated_codex_skills_root"],
    "agent validation output fields",
  );
}

function validateExposureClasses(policy: any, contract: any): void {
  const domainPluginClass = findExposureClass(policy, "codex_surface");
  assertArrayEqual(
    domainPluginClass.members,
    expectedDefaultVisibleDomainSkillIds,
    "domain plugin exposure members",
  );
  assertEqual(
    domainPluginClass.sync_target,
    contract.codex_plugin_registry_target,
    "domain plugin sync target",
  );
  assertEqual(
    domainPluginClass.software_object,
    "opl_packages",
    "domain plugin exposure software object",
  );
  assertEqual(
    domainPluginClass.visibility_scope,
    "package_capability_visibility_only_not_software_object",
    "domain plugin visibility scope",
  );
  assertArrayEqual(
    domainPluginClass.must_not_sync_to,
    [
      "~/.codex/skills/med-autoscience",
      "~/.codex/skills/med-autogrant",
      "~/.codex/skills/redcube-ai",
      "~/.codex/skills/opl-bookforge",
    ],
    "domain plugin forbidden sync targets",
  );

  const generatedClass = findExposureClass(policy, "opl_generated_plugin_surfaces");
  assertArrayEqual(
    generatedClass.members,
    expectedGeneratedPluginSkillIds,
    "generated plugin exposure members",
  );
  assertEqual(
    generatedClass.sync_target,
    "opl_generated_codex_plugin_surface",
    "generated plugin sync target",
  );

  const companionClass = findExposureClass(policy, "companion_tools_codex_skills");
  assertEqual(
    companionClass.members_source_ref,
    "gaofeng21cn/opl-flow:contracts/workflow-policy.json#recommends",
    "companion skill policy owner",
  );
  assertEqual(companionClass.software_object, "opl_base", "companion integration software object");
  assertEqual(
    companionClass.visibility_scope,
    "base_integration_projection_only_not_software_object",
    "companion integration visibility scope",
  );
}

function validateProfileCompanionPayloads(profile: any): void {
  const companionPayloads = profile.companion_payloads;
  assertArrayFieldsEqual(
    companionPayloads,
    {
      domain_plugin_skill_ids: expectedDefaultVisibleDomainSkillIds,
    },
    "profile companion payloads",
  );
  assertEqual(
    companionPayloads?.domain_plugin_skills_must_not_be_companion_mirrors,
    true,
    "profile domain plugin mirror guard",
  );
  assertArrayFieldsInclude(
    companionPayloads,
    {
      default_packaged_codex_skill_ids: expectedDefaultVisibleDomainSkillIds,
      additional_package_skill_ids: ["opl-meta-agent"],
    },
    "profile companion payloads",
  );
}

function validateAgentInstallEntries(policy: any, contract: any, agentRoots: AgentRootMap): void {
  for (const agentId of expectedRepoPackagedPluginAgentIds) {
    const exposure = findDomainExposure(policy, carrierIdByAgentId[agentId]);
    const installAgent = findInstallAgent(contract, agentId);
    assertEqual(
      exposure.preferred_app_distribution,
      "plugin_packaged_skill",
      `${agentId} exposure distribution`,
    );
    assertEqual(
      exposure.direct_skill_semantics_required,
      true,
      `${agentId} direct skill semantics`,
    );
    assertEqual(
      installAgent.preferred_distribution,
      exposure.preferred_app_distribution,
      `${agentId} install distribution`,
    );
    assertEqual(
      installAgent.codex_visible_entry,
      exposure.codex_visible_entry,
      `${agentId} codex visible entry`,
    );
    assertEqual(installAgent.plugin_registry_required, true, `${agentId} plugin registry required`);
    assertEqual(
      installAgent.direct_skill_compatibility_required,
      true,
      `${agentId} direct skill required`,
    );
    assertEqual(installAgent.plugin_must_package_skill, true, `${agentId} plugin packages skill`);
    assertEqual(
      installAgent.must_not_create_second_semantics,
      true,
      `${agentId} second semantics guard`,
    );
    assertEqual(
      installAgent.sync_command,
      contract.unified_sync_command,
      `${agentId} sync command`,
    );
    assertEqual(
      installAgent.product_entry_manifest,
      contract.product_entry_target,
      `${agentId} product entry manifest`,
    );
    assertEqual(
      installAgent.canonical_metadata_source,
      "domain_action_catalog_and_stage_control_plane",
      `${agentId} canonical metadata source`,
    );
  }

  const bookforgeExposure = findDomainExposure(policy, "opl-bookforge");
  const bookforgeInstallAgent = findInstallAgent(contract, "obf");
  assertEqual(bookforgeExposure.default_home_visible, false, "BookForge default visibility");
  assertEqual(
    bookforgeExposure.preferred_app_distribution,
    "opl_generated_codex_plugin_surface",
    "BookForge exposure distribution",
  );
  assertEqual(
    bookforgeExposure.codex_visible_entry,
    "opl-bookforge",
    "BookForge Codex visible entry",
  );
  assertEqual(
    bookforgeInstallAgent.preferred_distribution,
    "opl_generated_codex_plugin_surface",
    "BookForge install distribution",
  );
  assertEqual(bookforgeInstallAgent.default_home_visible, false, "BookForge install default visibility");
  assertEqual(bookforgeInstallAgent.module_id, "oplbookforge", "BookForge module id");
  assertEqual(
    bookforgeInstallAgent.plugin_registry_required,
    true,
    "BookForge plugin registry policy",
  );
  assertEqual(
    bookforgeInstallAgent.plugin_must_package_skill,
    false,
    "BookForge plugin packaging policy",
  );
  assertEqual(
    bookforgeInstallAgent.codex_visible_entry,
    "opl-bookforge",
    "BookForge Codex visible entry",
  );
  assertEqual(
    bookforgeInstallAgent.canonical_metadata_source,
    "opl_generated_interface_contract_pack",
    "BookForge canonical metadata source",
  );

  const omaExposure = findDomainExposure(policy, "opl-meta-agent");
  const omaInstallAgent = findInstallAgent(contract, "oma");
  assertEqual(
    omaExposure.preferred_app_distribution,
    "opl_generated_codex_plugin_surface",
    "OMA exposure distribution",
  );
  assertEqual(omaInstallAgent.plugin_registry_required, true, "OMA plugin registry policy");
  assertEqual(omaInstallAgent.plugin_must_package_skill, false, "OMA plugin packaging policy");
  assertEqual(omaInstallAgent.codex_visible_entry, "opl-meta-agent", "OMA Codex visible entry");
  assertEqual(
    omaInstallAgent.canonical_metadata_source,
    "opl_generated_interface_contract_pack",
    "OMA canonical metadata source",
  );

  for (const [agentId, root] of agentRoots.entries()) {
    validatePluginRoot(agentId, root, findInstallAgent(contract, agentId));
  }
}

const {
  agentRoots,
  codexSkillsRoot,
  policyPath: selectedPolicyPath,
  registryPath: selectedRegistryPath,
} = parseArgs(
  process.argv.slice(2),
);
validateActiveShellInstallConsumers();
validateContract(
  readJson(selectedPolicyPath),
  readJson(profilePath),
  readJson(selectedRegistryPath),
  readJson(agentPackageSurfaceSchemaPath),
  readJson(packageJsonPath),
  agentRoots,
);
const validatedCodexSkillsRoot = validateNoDuplicateBareDomainSkills(codexSkillsRoot);

console.log(
  JSON.stringify(
    {
      status: "passed",
      surface_id: "opl_app_agent_installation_contract_validation",
      checked_agents: expectedRequiredAgentIds,
      plugin_agents: expectedDefaultPluginAgentIds,
      default_visible_domain_skills: expectedDefaultVisibleDomainSkillIds,
      generated_plugin_agents: expectedGeneratedAgentIds,
      generated_plugin_skills: expectedGeneratedPluginSkillIds,
      first_party_release_set_packages: expectedRegistryPackageIds,
      registry_source_kinds: expectedRegistrySourceKinds,
      package_lifecycle_actions: expectedPackageLifecycleActions,
      package_activation_action: expectedActivationPolicy.action_id,
      package_lock_receipt_fields: expectedPackageLockReceiptFields,
      agent_package_surface_schema: path.relative(appRoot, agentPackageSurfaceSchemaPath),
      agent_package_manifest_fixture_dir: path.relative(appRoot, agentPackageManifestFixtureDir),
      validated_plugin_roots: Object.fromEntries(agentRoots),
      validated_codex_skills_root: validatedCodexSkillsRoot,
      validated_active_shell_install_consumers: activeShellInstallConsumers,
    },
    null,
    2,
  ),
);
console.log("PASS: App agent installation contract is consistent.");
