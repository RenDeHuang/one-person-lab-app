import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { temporalLocalServiceDefaults, temporalManagedCommands } from './app-contract-constants.ts';
import {
  validateReleaseManagedUpdateKernelSurface,
  validateReleaseManagedUpdatePlaneLanes,
  validateReleaseRuntimeToolchainUpdater,
} from './managed-update-plane-validator.ts';

export function validateReleaseChannelContract(releaseChannel) {
  const managedUpdatePlane = releaseChannel.managed_update_plane;
  if (
    managedUpdatePlane?.owner !== 'one-person-lab-app' ||
    managedUpdatePlane?.producer_owner !== 'one-person-lab' ||
    managedUpdatePlane?.ui_page !== 'Updates & Maintenance' ||
    managedUpdatePlane?.framework_role !== 'own_managed_update_kernel_status_conditions_repair_actions_and_apply_execution' ||
    managedUpdatePlane?.managed_kernel?.id !== 'opl_managed_updater_kernel' ||
    managedUpdatePlane?.managed_kernel?.owner !== 'one-person-lab' ||
    managedUpdatePlane?.managed_kernel?.app_role !== 'status_action_projection_consumer' ||
    managedUpdatePlane?.managed_kernel?.app_must_not_implement_kernel !== true ||
    managedUpdatePlane?.managed_kernel?.app_must_not_bypass_action_route !== true ||
    managedUpdatePlane?.status_consumption_policy !==
      'App consumes status, conditions, progress refs, and repair action refs only; App does not read artifact bodies, write domain truth, or implement the Framework update kernel.'
  ) {
    throw new Error('Release channel must declare the App-owned managed update plane as a Framework-kernel status/action consumer');
  }
  assertDeepEqualJson(
    managedUpdatePlane.status_source_priority,
    ['opl app state --profile fast --json#managed_update_plane', 'opl update status --json'],
    'Managed update plane status source priority',
  );
  assertIncludesAll(
    managedUpdatePlane.managed_kernel?.channels_share,
    ['status_schema', 'condition_model', 'download_verify_stage_apply_lifecycle', 'repair_action_refs', 'rollback_receipts'],
    'Managed update plane shared kernel contract',
  );
  validateReleaseManagedUpdateKernelSurface(managedUpdatePlane);
  assertIncludesAll(
    managedUpdatePlane.forbidden_silent_overwrite_scope,
    [
      'Developer Profile checkout',
      'dirty checkout',
      'domain truth',
      'owner receipt',
      'quality verdict',
      'export verdict',
      'Homebrew/global tools',
    ],
    'Managed update plane forbidden silent overwrite scope',
  );
  assertIncludesAll(
    managedUpdatePlane.forbidden_app_authority,
    [
      'framework_update_kernel_implementation',
      'runtime_truth',
      'domain_truth',
      'owner_receipt_authority',
      'domain_quality_verdict',
      'domain_export_verdict',
      'artifact_body',
      'homebrew_global_tool_mutation',
      'developer_checkout_mutation',
    ],
    'Managed update plane forbidden App authority',
  );
  assertIncludesAll(
    managedUpdatePlane.release_boundary_required_cases,
    [
      'standard_updater_desktop_assets_only',
      'runtime_toolchain_uses_managed_kernel_not_standard_updater',
      'agent_package_channel_uses_managed_kernel_and_post_update_sync',
      'capability_exposure_status_is_projection_only',
      'forbidden_silent_overwrite_scope_fail_closed',
    ],
    'Managed update plane release-boundary cases',
  );

  validateReleaseManagedUpdatePlaneLanes(managedUpdatePlane);

  validateReleaseRuntimeToolchainUpdater(releaseChannel.runtime_toolchain_updater, managedUpdatePlane);

  const homebrew = releaseChannel.homebrew_tap_distribution;
  if (
    homebrew?.owner !== 'one-person-lab-app' ||
    homebrew?.tap_repo !== 'gaofeng21cn/homebrew-one-person-lab' ||
    homebrew?.role !== 'external_app_cask_index_for_distribution_cohorts' ||
    homebrew?.cohort_manifest_required !== true
  ) {
    throw new Error('Release channel Homebrew tap distribution must be an App-owned cask cohort install index');
  }
  assertDeepEqualJson(homebrew.formulae, [], 'Release channel Homebrew formulae');
  assertDeepEqualJson(homebrew.casks, ['one-person-lab', 'one-person-lab-full'], 'Release channel Homebrew casks');
  if (
    homebrew.cask_install_policy?.standard_cask !== 'one-person-lab' ||
    homebrew.cask_install_policy?.standard_cask_install_ref !== 'gaofeng21cn/one-person-lab/one-person-lab' ||
    homebrew.cask_install_policy?.fully_qualified_cask_install !== true ||
    homebrew.cask_install_policy?.trust_scope !== 'explicit_standard_and_conflicting_cask_refs_not_whole_tap'
  ) {
    throw new Error('Release channel Homebrew installs must use fully qualified cask refs without broadly trusting the tap');
  }
  assertDeepEqualJson(
    homebrew.cask_install_policy?.standard_install_trusted_cask_refs,
    [
      'gaofeng21cn/one-person-lab/one-person-lab',
      'gaofeng21cn/one-person-lab/one-person-lab-full',
      'gaofeng21cn/one-person-lab/one-person-lab-nightly',
    ],
    'Release channel Homebrew trusted cask refs',
  );
  assertDeepEqualJson(
    homebrew.initial_live_targets,
    ['Casks/one-person-lab.rb', 'Casks/one-person-lab-nightly.rb', 'Casks/one-person-lab-full.rb'],
    'Release channel Homebrew initial live targets',
  );
  assertDeepEqualJson(
    homebrew.forbidden_formulae,
    ['one-person-lab-modules', 'one-person-lab-modules-nightly'],
    'Release channel forbidden Homebrew formulae',
  );
  assertDeepEqualJson(homebrew.excluded_casks, [], 'Release channel excluded Homebrew casks');
  assertDeepEqualJson(homebrew.full_casks, ['one-person-lab-full'], 'Release channel Full Homebrew casks');
  assertDeepEqualJson(homebrew.nightly_formulae, [], 'Release channel Homebrew nightly formulae');
  assertDeepEqualJson(homebrew.nightly_casks, ['one-person-lab-nightly'], 'Release channel Homebrew nightly casks');
  if (
    homebrew.tap_update_policy?.discovery_model !== 'user_taps_github_homebrew_tap_repo_then_homebrew_reads_formula_or_cask' ||
    homebrew.tap_update_policy?.download_source !== 'app_owned_github_release_asset_url' ||
    homebrew.tap_update_policy?.default_remote_write_path !== 'tap_repo_github_actions_self_sync_direct_commit_after_tap_check' ||
    homebrew.tap_update_policy?.default_workflow_repo !== 'gaofeng21cn/homebrew-one-person-lab' ||
    homebrew.tap_update_policy?.default_workflow !== '.github/workflows/sync-from-app-releases.yml' ||
    homebrew.tap_update_policy?.tap_sync_script !== 'scripts/sync-cask-from-release.mjs' ||
    homebrew.tap_update_policy?.app_release_direct_workflow !== '.github/workflows/homebrew-tap-update.yml' ||
    homebrew.tap_update_policy?.app_release_direct_token !== 'OPL_HOMEBREW_TAP_TOKEN' ||
    homebrew.tap_update_policy?.app_release_pull_request_allowed !== false ||
    homebrew.tap_update_policy?.app_release_workflow_write_mode !== 'direct_commit_only' ||
    homebrew.tap_update_policy?.stable_release_workflow_write_mode !== 'new_release_promote_direct_commit_after_publish_before_homebrew_vm_gate; refresh_existing_published_release_direct_commit_after_remote_verification_before_homebrew_vm_gate; refresh_existing_draft_release_defer_to_promote_after_publish' ||
    homebrew.tap_update_policy?.planner_script !== 'scripts/update-homebrew-tap.ts' ||
    homebrew.tap_update_policy?.nightly?.mode !== 'tap_repo_scheduled_self_sync_to_nightly_cask' ||
    homebrew.tap_update_policy?.nightly?.may_update_stable !== false ||
    homebrew.tap_update_policy?.stable?.mode !== 'new_release_desktop_promote_direct_commit_after_published_release_before_homebrew_vm_gate; refresh_existing_published_release_desktop_release_direct_commit_after_remote_verification_before_homebrew_vm_gate; refresh_existing_draft_release_desktop_promote_after_publish_before_homebrew_vm_gate' ||
    homebrew.tap_update_policy?.stable?.may_consume_nightly_directly !== false ||
    homebrew.tap_update_policy?.full?.mode !== 'stable_full_first_install_cask_after_full_release_gates' ||
    homebrew.tap_update_policy?.full?.may_update_standard_cask !== false ||
    homebrew.tap_update_policy?.full?.may_update_nightly_cask !== false ||
    homebrew.tap_update_policy?.full?.manifest !== 'full-package-manifest.json' ||
    homebrew.tap_update_policy?.full?.standard_updater_visible !== false
  ) {
    throw new Error('Release channel Homebrew tap update policy must use tap self-sync and separate nightly automation from stable promotion');
  }
  const homebrewVmGate = releaseChannel.release_acceleration?.vm_gates?.find(
    (gate: { id?: string }) => gate.id === 'homebrew_standard_cask_clean_vm_smoke',
  );
  if (
    homebrewVmGate?.install_mode !== 'homebrew-cask' ||
    homebrewVmGate?.homebrew_cask_install_ref !== 'gaofeng21cn/one-person-lab/one-person-lab' ||
    homebrewVmGate?.homebrew_trust_scope !== 'explicit_standard_and_conflicting_cask_refs_not_whole_tap' ||
    homebrewVmGate?.source_vm_variable !== 'OPL_FIRST_RUN_HOMEBREW_TART_SOURCE'
  ) {
    throw new Error('Release channel Homebrew VM smoke must use explicit cask trust refs and the dedicated Homebrew-ready Tart source variable');
  }
  assertDeepEqualJson(
    homebrewVmGate?.homebrew_trusted_cask_refs,
    [
      'gaofeng21cn/one-person-lab/one-person-lab',
      'gaofeng21cn/one-person-lab/one-person-lab-full',
      'gaofeng21cn/one-person-lab/one-person-lab-nightly',
    ],
    'Release channel Homebrew VM trusted cask refs',
  );
  assertIncludesAll(
    homebrew.tap_update_policy?.required_manifest_fields,
    ['channel', 'artifact', 'sha256', 'manifest_url', 'local_authorization_policy_asset'],
    'Release channel Homebrew cohort manifest fields',
  );
  if (
    homebrew.agent_pack_policy?.package_kind !== 'app_cli_managed_agent_packs' ||
    homebrew.agent_pack_policy?.semantic_authority !== 'one-person-lab_and_domain_repositories' ||
    homebrew.agent_pack_policy?.homebrew_role !== 'not_a_distribution_target' ||
    homebrew.agent_pack_policy?.activation_owner !== 'app_cli_managed_background_maintenance' ||
    homebrew.agent_pack_policy?.default_update_mode !== 'silent_background' ||
    homebrew.agent_pack_policy?.default_manifest_tag !== 'latest' ||
    homebrew.agent_pack_policy?.homebrew_distribution_allowed !== false ||
    homebrew.agent_pack_policy?.homebrew_formula_allowed !== false ||
    homebrew.agent_pack_policy?.must_not_write_user_codex_state !== true ||
    homebrew.agent_pack_policy?.must_not_define_agent_semantics !== true ||
    homebrew.full_first_install_policy !== 'stable_full_cask_or_github_release_first_install_asset; never standard updater metadata'
  ) {
    throw new Error('Release channel Homebrew agent-pack policy must keep agent packs outside Homebrew distribution');
  }
  if (
    homebrew.agent_pack_policy?.managed_update_plane !== 'agent_package_channel' ||
    homebrew.agent_pack_policy?.kernel !== 'opl_managed_updater_kernel' ||
    homebrew.agent_pack_policy?.source_role !== 'ordinary_user_non_development_agent_update_source' ||
    homebrew.agent_pack_policy?.registry !== 'ghcr.io' ||
    homebrew.agent_pack_policy?.adapter !== 'agent_package_channel_adapter' ||
    homebrew.agent_pack_policy?.policy !== 'ordinary_user_non_development_silent_background' ||
    homebrew.agent_pack_policy?.post_apply !== 'sync_plugin_registry_plugin_packaged_skills_and_oma_generated_plugin_surface' ||
    homebrew.agent_pack_policy?.developer_checkout_override_policy !== 'explicit_developer_profile_source_channel_only'
  ) {
    throw new Error('Release channel agent-pack policy must bind GHCR agent packages to the managed update plane');
  }
  assertDeepEqualJson(
    homebrew.agent_pack_policy?.managed_agent_ids,
    ['mas', 'mag', 'rca', 'oma'],
    'Release channel managed update agent ids',
  );
  assertIncludesAll(
    homebrew.agent_pack_policy?.forbidden_silent_overwrite_scope,
    managedUpdatePlane.forbidden_silent_overwrite_scope,
    'Release channel agent-pack forbidden silent overwrite scope',
  );
  assertIncludesAll(
    homebrew.agent_pack_policy?.post_update_sync_required,
    ['codex_plugin_registry', 'plugin_packaged_skills', 'opl_generated_plugin_surface'],
    'Release channel Homebrew agent-pack post-update sync requirements',
  );
  assertIncludesAll(
    homebrew.agent_pack_policy?.activation_commands,
    ['opl connect reconcile-modules', 'opl connect sync-skills'],
    'Release channel Homebrew agent-pack activation commands',
  );
  assertDeepEqualJson(
    homebrew.agent_pack_policy?.forbidden_formulae,
    ['one-person-lab-modules', 'one-person-lab-modules-nightly'],
    'Release channel agent-pack forbidden formulae',
  );
  if (
    homebrew.codex_temporal_policy?.compatibility_mode !== 'minimum_version_plus_capability_smoke' ||
    homebrew.codex_temporal_policy?.prefer_valid_newer_system_tool !== true ||
    homebrew.codex_temporal_policy?.bundled_fallback_allowed !== true
  ) {
    throw new Error('Release channel Codex/Temporal policy must prefer compatible newer user tools with bundled fallback');
  }

  const codexCli = releaseChannel.full_first_install?.required_payloads?.codex_cli;
  if (
    codexCli?.compatibility_mode !== 'minimum_version_plus_capability_smoke' ||
    codexCli?.minimum_version_source !== 'distribution cohort manifest components.codex_cli.minimum_version' ||
    codexCli?.fallback_version_source !== 'distribution cohort manifest components.codex_cli.fallback_version' ||
    codexCli?.fallback_runtime_path !== 'runtime/current/bin/codex' ||
    codexCli?.fallback_payload_path !== 'runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz' ||
    codexCli?.must_prefer_valid_newer_user_version !== true ||
    !/offline from the packaged archive wrapper/.test(codexCli?.verification ?? '')
  ) {
    throw new Error('Release channel Full Codex CLI payload must be compatibility-gated with an offline archive-wrapper fallback');
  }
  assertDeepEqualJson(
    codexCli.preferred_sources,
    ['explicit_user_path', 'system_path', 'homebrew_formula'],
    'Release channel Codex CLI preferred sources',
  );

  const temporalCli = releaseChannel.full_first_install?.required_payloads?.temporal_cli;
  if (
    temporalCli?.compatibility_mode !== 'minimum_version_plus_capability_smoke' ||
    temporalCli?.minimum_version_source !== 'distribution cohort manifest components.temporal_cli.minimum_version' ||
    temporalCli?.fallback_version_source !== 'distribution cohort manifest components.temporal_cli.fallback_version' ||
    temporalCli?.fallback_runtime_path !== 'runtime/current/bin/temporal' ||
    temporalCli?.fallback_payload_path !== 'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz' ||
    temporalCli?.must_prefer_valid_newer_user_version !== true ||
    !/offline from the packaged archive wrapper/.test(temporalCli?.verification ?? '')
  ) {
    throw new Error('Release channel Full Temporal CLI payload must be compatibility-gated with an offline archive-wrapper fallback');
  }
  assertDeepEqualJson(
    temporalCli.preferred_sources,
    ['explicit_user_path', 'system_path', 'homebrew_formula'],
    'Release channel Temporal CLI preferred sources',
  );

  const temporalRuntimeProvider = releaseChannel.full_first_install?.required_payloads?.temporal_runtime_provider;
  if (
    temporalRuntimeProvider?.provider_env_default !== 'OPL_FAMILY_RUNTIME_PROVIDER=temporal' ||
    temporalRuntimeProvider?.must_prefer_valid_newer_user_version === true
  ) {
    throw new Error('Release channel Full Temporal runtime provider must declare the Temporal provider env default');
  }
  assertDeepEqualJson(
    temporalRuntimeProvider?.local_service_defaults,
    temporalLocalServiceDefaults,
    'Release channel Full Temporal local service defaults',
  );
  assertDeepEqualJson(
    temporalRuntimeProvider?.managed_commands,
    temporalManagedCommands,
    'Release channel Full Temporal managed commands',
  );
  assertIncludesAll(
    temporalRuntimeProvider?.required_packages,
    ['@temporalio/activity', '@temporalio/client', '@temporalio/common', '@temporalio/worker', '@temporalio/workflow'],
    'Release channel Full Temporal runtime packages',
  );
  assertDeepEqualJson(
    temporalRuntimeProvider?.forbidden_packages,
    ['@temporalio/testing'],
    'Release channel Full Temporal forbidden packages',
  );
  assertDeepEqualJson(
    temporalRuntimeProvider?.native_core_bridge_releases,
    ['aarch64-apple-darwin'],
    'Release channel Full Temporal core bridge target',
  );
  if (!/wrapper must export local Temporal defaults/.test(temporalRuntimeProvider?.verification ?? '')) {
    throw new Error('Release channel Full Temporal provider verification must include wrapper default exports');
  }
}
