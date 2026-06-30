import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { assertExpectedFields } from '../expected-field-assertions.ts';

export function validateReleaseHomebrewDistribution(releaseChannel, managedUpdatePlane) {
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
  validateReleaseHomebrewCaskInstallPolicy(homebrew);
  validateReleaseHomebrewTapUpdatePolicy(homebrew);
  validateReleaseHomebrewVmGate(releaseChannel);
  validateReleaseHomebrewAgentPackPolicy(homebrew, managedUpdatePlane);
  validateReleaseHomebrewCodexTemporalPolicy(homebrew);
}

function validateReleaseHomebrewCaskInstallPolicy(homebrew) {
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
}

function validateReleaseHomebrewTapUpdatePolicy(homebrew) {
  const tapUpdate = homebrew.tap_update_policy;
  assertExpectedFields(
    [
      {
        actual: tapUpdate?.discovery_model,
        expected: 'user_taps_github_homebrew_tap_repo_then_homebrew_reads_formula_or_cask',
      },
      { actual: tapUpdate?.download_source, expected: 'app_owned_github_release_asset_url' },
      {
        actual: tapUpdate?.default_remote_write_path,
        expected: 'tap_repo_github_actions_self_sync_direct_commit_after_tap_check',
      },
      { actual: tapUpdate?.default_workflow_repo, expected: 'gaofeng21cn/homebrew-one-person-lab' },
      { actual: tapUpdate?.default_workflow, expected: '.github/workflows/sync-from-app-releases.yml' },
      { actual: tapUpdate?.tap_sync_script, expected: 'scripts/sync-cask-from-release.mjs' },
      { actual: tapUpdate?.app_release_direct_workflow, expected: '.github/workflows/homebrew-tap-update.yml' },
      { actual: tapUpdate?.app_release_direct_token, expected: 'OPL_HOMEBREW_TAP_TOKEN' },
      { actual: tapUpdate?.app_release_pull_request_allowed, expected: false },
      {
        actual: tapUpdate?.app_release_workflow_write_mode,
        expected: 'direct_commit_only_with_same_version_channel_serialization_and_fetch_rebase_retry',
      },
      {
        actual: tapUpdate?.stable_release_workflow_write_mode,
        expected:
          'new_release_promote_direct_commit_after_publish_readback_before_homebrew_vm_gate; refresh_existing_published_release_direct_commit_after_remote_verification_before_homebrew_vm_gate; refresh_existing_draft_release_defer_to_promote_after_publish_readback',
      },
      {
        actual: tapUpdate?.direct_commit_conflict_policy,
        expected:
          'serialize same channel/version tap writes across package kinds; on non-fast-forward push, fetch origin main, rebase the local tap commit, and retry before failing',
      },
      { actual: tapUpdate?.planner_script, expected: 'scripts/update-homebrew-tap.ts' },
      { actual: tapUpdate?.nightly?.mode, expected: 'tap_repo_scheduled_self_sync_to_nightly_cask' },
      { actual: tapUpdate?.nightly?.may_update_stable, expected: false },
      {
        actual: tapUpdate?.stable?.mode,
        expected:
          'new_release_desktop_promote_direct_commit_after_publish_readback_before_homebrew_vm_gate; refresh_existing_published_release_desktop_release_direct_commit_after_remote_verification_before_homebrew_vm_gate; refresh_existing_draft_release_desktop_promote_after_publish_readback_before_homebrew_vm_gate',
      },
      { actual: tapUpdate?.stable?.may_consume_nightly_directly, expected: false },
      { actual: tapUpdate?.full?.mode, expected: 'stable_full_first_install_cask_after_full_release_gates' },
      { actual: tapUpdate?.full?.may_update_standard_cask, expected: false },
      { actual: tapUpdate?.full?.may_update_nightly_cask, expected: false },
      { actual: tapUpdate?.full?.manifest, expected: 'full-package-manifest.json' },
      { actual: tapUpdate?.full?.standard_updater_visible, expected: false },
    ],
    'Release channel Homebrew tap update policy must use tap self-sync and separate nightly automation from stable promotion',
  );
  assertIncludesAll(
    tapUpdate?.required_manifest_fields,
    ['channel', 'artifact', 'sha256', 'manifest_url', 'local_authorization_policy_asset'],
    'Release channel Homebrew cohort manifest fields',
  );
}

function validateReleaseHomebrewVmGate(releaseChannel) {
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
}

function validateReleaseHomebrewAgentPackPolicy(homebrew, managedUpdatePlane) {
  const agentPack = homebrew.agent_pack_policy;
  assertExpectedFields(
    [
      { actual: agentPack?.package_kind, expected: 'app_cli_managed_opl_packages' },
      { actual: agentPack?.semantic_authority, expected: 'one-person-lab_and_domain_repositories' },
      { actual: agentPack?.homebrew_role, expected: 'not_a_distribution_target' },
      { actual: agentPack?.activation_owner, expected: 'app_cli_managed_background_maintenance' },
      { actual: agentPack?.default_update_mode, expected: 'silent_background' },
      { actual: agentPack?.default_manifest_tag, expected: 'latest' },
      { actual: agentPack?.homebrew_distribution_allowed, expected: false },
      { actual: agentPack?.homebrew_formula_allowed, expected: false },
      { actual: agentPack?.must_not_write_user_codex_state, expected: true },
      { actual: agentPack?.must_not_define_agent_semantics, expected: true },
      {
        actual: homebrew.full_first_install_policy,
        expected: 'stable_full_cask_or_github_release_first_install_asset; never standard updater metadata',
      },
    ],
    'Release channel Homebrew agent-pack policy must keep agent packs outside Homebrew distribution',
  );
  assertExpectedFields(
    [
      { actual: agentPack?.managed_update_plane, expected: 'agent_package_channel' },
      { actual: agentPack?.kernel, expected: 'opl_managed_updater_kernel' },
      { actual: agentPack?.source_role, expected: 'ordinary_user_non_development_opl_package_update_source' },
      { actual: agentPack?.registry, expected: 'ghcr.io' },
      { actual: agentPack?.adapter, expected: 'agent_package_channel_adapter' },
      { actual: agentPack?.policy, expected: 'ordinary_user_non_development_silent_background' },
      {
        actual: agentPack?.post_apply,
        expected: 'sync_plugin_registry_plugin_packaged_skills_generated_surfaces_and_capability_exposure_readiness',
      },
      {
        actual: agentPack?.developer_checkout_override_policy,
        expected: 'explicit_developer_profile_source_channel_only',
      },
    ],
    'Release channel OPL Packages policy must bind GHCR OPL Packages to the managed update plane',
  );
  assertDeepEqualJson(
    agentPack?.managed_agent_ids,
    ['mas', 'mag', 'rca', 'oma', 'obf', 'scholarskills'],
    'Release channel managed update agent ids',
  );
  assertIncludesAll(
    agentPack?.forbidden_silent_overwrite_scope,
    managedUpdatePlane.forbidden_silent_overwrite_scope,
    'Release channel agent-pack forbidden silent overwrite scope',
  );
  assertIncludesAll(
    agentPack?.post_update_sync_required,
    ['codex_plugin_registry', 'plugin_packaged_skills', 'opl_generated_plugin_surface'],
    'Release channel Homebrew agent-pack post-update sync requirements',
  );
  assertIncludesAll(
    agentPack?.activation_commands,
    ['opl connect reconcile-modules', 'opl connect sync-skills'],
    'Release channel Homebrew agent-pack activation commands',
  );
  assertDeepEqualJson(
    agentPack?.forbidden_formulae,
    ['one-person-lab-modules', 'one-person-lab-modules-nightly'],
    'Release channel agent-pack forbidden formulae',
  );
}

function validateReleaseHomebrewCodexTemporalPolicy(homebrew) {
  if (
    homebrew.codex_temporal_policy?.compatibility_mode !== 'minimum_version_plus_capability_smoke' ||
    homebrew.codex_temporal_policy?.prefer_valid_newer_system_tool !== true ||
    homebrew.codex_temporal_policy?.bundled_fallback_allowed !== true
  ) {
    throw new Error('Release channel Codex/Temporal policy must prefer compatible newer user tools with bundled fallback');
  }
}
