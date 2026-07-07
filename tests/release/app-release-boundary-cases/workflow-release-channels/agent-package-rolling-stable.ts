import {
  assert,
  fs,
  path,
  test,
  appRoot,
} from '../helpers.ts';

function readReleaseContract() {
  return JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
}

function readInstallExposurePolicy() {
  return JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-install-exposure-policy.json'), 'utf8'),
  );
}

function readAgentPackageRegistry() {
  return JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'agent-package-registry.json'), 'utf8'),
  );
}

const expectedAgentIds = [
  'med-autoscience',
  'med-autogrant',
  'redcube-ai',
  'opl-meta-agent',
  'opl-bookforge',
  'scholarskills',
];
const expectedPackageIds = [...expectedAgentIds, 'opl-flow'];

test('OPL Packages ordinary-user channel is rolling latest, not stable or nightly', () => {
  const releaseContract = readReleaseContract();
  const packagePolicy = releaseContract.homebrew_tap_distribution.agent_pack_policy;
  const planePolicy = releaseContract.managed_update_plane.capability_packages;
  const planeEntry = releaseContract.managed_update_plane.planes.find((entry) => entry.id === 'capability_packages');
  const installDistribution = readInstallExposurePolicy().agent_installation_contract.managed_agent_pack_distribution;
  const registry = readAgentPackageRegistry();

  for (const policy of [packagePolicy, planePolicy]) {
    assert.equal(policy.registry, 'ghcr.io');
  }
  assert.equal(planeEntry.source, 'GHCR OCI OPL Packages');

  for (const policy of [packagePolicy, planePolicy, planeEntry]) {
    assert.equal(policy.distribution_format, 'ghcr_oci_artifact');
    assert.equal(policy.ordinary_user_channel_model, 'rolling_latest_only');
    assert.deepEqual(policy.user_visible_channels, ['latest']);
    assert.equal(policy.default_manifest_tag, 'latest');
    assert.equal(policy.stable_or_nightly_user_channels_allowed, false);
    assert.equal(policy.internal_candidate_channel, 'candidate_ci_only_not_user_visible');
  }

  assert.equal(installDistribution.default_manifest_tag, 'latest');
  assert.equal(installDistribution.distribution_format, 'ghcr_oci_artifact');
  assert.equal(installDistribution.registry, 'ghcr.io');
  assert.equal(installDistribution.ordinary_user_channel_model, 'rolling_latest_only');
  assert.deepEqual(installDistribution.user_visible_channels, ['latest']);
  assert.equal(installDistribution.stable_or_nightly_user_channels_allowed, false);
  assert.equal(installDistribution.must_not_depend_on_fixed_version_tag_by_default, true);
  assert.deepEqual(installDistribution.package_agent_ids, expectedAgentIds);
  assert.deepEqual(installDistribution.package_ids, expectedPackageIds);
  assert.deepEqual(packagePolicy.managed_agent_ids, expectedAgentIds);
  assert.deepEqual(packagePolicy.package_ids, expectedPackageIds);
  assert.equal(packagePolicy.package_kinds['opl-flow'], 'workflow_plugin_package');
  assert.deepEqual(packagePolicy.opl_flow_package, installDistribution.opl_flow_package);
  assert.deepEqual(planePolicy.package_agent_ids, expectedAgentIds);
  assert.deepEqual(planePolicy.package_ids, expectedPackageIds);
  assert.equal(planePolicy.package_kinds['opl-flow'], 'workflow_plugin_package');
  assert.deepEqual(planePolicy.opl_flow_package, installDistribution.opl_flow_package);

  const visibleChannels = new Set([
    ...packagePolicy.user_visible_channels,
    ...planePolicy.user_visible_channels,
    ...planeEntry.user_visible_channels,
  ]);
  assert.deepEqual([...visibleChannels].sort(), ['latest']);
  assert.equal(visibleChannels.has('stable'), false);
  assert.equal(visibleChannels.has('nightly'), false);

  assert.equal(registry.ordinary_user_source_policy.source_kind, 'ghcr_oci_artifact_rolling_latest');
  assert.equal(registry.ordinary_user_source_policy.latest_channel_role, 'only_ordinary_user_channel');
  assert.equal(registry.ordinary_user_source_policy.latest_is_install_truth, false);
  for (const entry of registry.entries) {
    assert.equal(entry.ordinary_user_source.kind, 'ghcr_oci_artifact_rolling_latest');
    assert.equal(entry.ordinary_user_source.ordinary_user_ref.endsWith(':latest'), true);
    assert.equal(entry.ordinary_user_source.latest_is_only_ordinary_user_channel, true);
    assert.deepEqual(entry.ordinary_user_source.install_truth, ['immutable_version_tag', 'oci_digest', 'package_lock_receipt']);
  }
});

test('GHCR Agent Package publication uses immutable OCI tags, moving latest, and digest locks', () => {
  const releaseContract = readReleaseContract();
  const installDistribution = readInstallExposurePolicy().agent_installation_contract.managed_agent_pack_distribution;
  const packagePolicy = releaseContract.homebrew_tap_distribution.agent_pack_policy;
  const planePolicy = releaseContract.managed_update_plane.capability_packages;
  const planeEntry = releaseContract.managed_update_plane.planes.find((entry) => entry.id === 'capability_packages');

  for (const policy of [packagePolicy, planePolicy]) {
    assert.equal(policy.registry, 'ghcr.io');
  }
  assert.equal(planeEntry.source, 'GHCR OCI OPL Packages');

  for (const policy of [packagePolicy, planePolicy, planeEntry]) {
    assert.equal(policy.distribution_format, 'ghcr_oci_artifact');
    assert.equal(policy.immutable_tag_required, true);
    assert.equal(policy.digest_lock_required, true);
    assert.equal(policy.default_manifest_tag, 'latest');
    assert.equal(policy.publication_cadence, 'daily_when_source_digest_changes');
    assert.match(policy.promotion_policy, /promote_latest/);
  }

  assert.ok(planeEntry.status_fields.includes('oci_ref'));
  assert.ok(planeEntry.status_fields.includes('resolved_digest'));
  assert.ok(planeEntry.status_fields.includes('installed_digest'));
  assert.ok(planeEntry.status_fields.includes('latest_digest'));
  assert.ok(planeEntry.status_fields.includes('auto_apply.skip_reasons'));
  assert.deepEqual(installDistribution.first_party_distribution_payload_required_fields, [
    'cohort_manifest_ref',
    'distribution_payload_ref',
    'payload_digest_ref',
    'required_skill_pack_lock_refs',
    'rollback_ref',
    'oci_ref',
    'oci_media_type',
    'immutable_tag',
    'rolling_tag',
    'promotion_policy',
    'install_truth',
  ]);
});

test('clean managed Agent Package roots can auto apply while developer or dirty roots fail closed', () => {
  const releaseContract = readReleaseContract();
  const installPolicy = readInstallExposurePolicy().agent_installation_contract;
  const scheduler = releaseContract.managed_update_plane.shell_integration.background_scheduler;
  const packagePolicy = releaseContract.homebrew_tap_distribution.agent_pack_policy;
  const planePolicy = releaseContract.managed_update_plane.capability_packages;
  const planeEntry = releaseContract.managed_update_plane.planes.find((entry) => entry.id === 'capability_packages');

  assert.equal(scheduler.auto_apply_policy, 'auto_apply_capability_packages_only_when_clean_managed_and_latest_digest_changed');
  assert.deepEqual(scheduler.auto_apply_components, ['capability_packages']);
  assert.equal(scheduler.never_auto_apply_components.includes('capability_packages'), false);
  assert.equal(planeEntry.default_update_mode, 'automatic_apply_for_clean_managed_roots');
  assert.equal(planePolicy.default_update_mode, 'automatic_apply_for_clean_managed_roots');
  assert.equal(packagePolicy.default_update_mode, 'automatic_apply_for_clean_managed_roots');
  assert.equal(
    planePolicy.background_apply_policy,
    'apply_after_daily_or_startup_digest_check_when_all_opl_package_components_are_clean_managed_and_update_available',
  );
  assert.equal(planeEntry.post_apply_sync.auto_apply_eligibility, 'clean_managed_module_roots_only');

  for (const reason of ['developer_checkout_override', 'dirty_checkout', 'verification_failed', 'idempotency_lock_in_progress']) {
    assert.ok(planePolicy.auto_apply_skip_reasons.includes(reason));
  }
  assert.ok(planeEntry.post_apply_sync.auto_apply_denial_reasons.includes('dirty_checkout'));
  assert.ok(planeEntry.post_apply_sync.auto_apply_denial_reasons.includes('developer_profile_checkout'));
  assert.ok(installPolicy.fail_closed_states.includes('dirty_managed_checkout'));
  assert.equal(installPolicy.may_use_developer_checkout_by_default, false);
  assert.equal(installPolicy.developer_checkout_override_policy, 'explicit_opt_in_only');
  assert.ok(packagePolicy.forbidden_silent_overwrite_scope.includes('Developer Profile checkout'));
  assert.ok(packagePolicy.forbidden_silent_overwrite_scope.includes('dirty checkout'));
});
