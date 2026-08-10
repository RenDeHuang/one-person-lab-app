import { validateProductProfile } from '../../../scripts/validate-active-shell/product-profile-validator.ts';
import { assert, fs, path, test, appRoot } from './helpers.ts';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

test('App approves its lightweight Codex-only renderer for native macOS and OPL Workspace', () => {
  const profile = readJson('contracts/app-product-profile.json');
  const release = readJson('contracts/app-release-channel.json');
  const candidates = readJson('contracts/app-shell-candidates.json');

  assert.deepEqual(profile.product.supported_release_platforms, ['macos-arm64']);
  assert.equal(profile.delivery_topology.shared_renderer.product_owner, 'one-person-lab-app');
  assert.equal(profile.delivery_topology.shared_renderer.implementation_status, 'approved_direction_candidate_evidence_only');
  assert.equal(profile.delivery_topology.runtime.supported_backend_scope, 'codex_cli_only');
  assert.equal(profile.delivery_topology.runtime.aioncore_allowed, false);
  assert.equal(profile.delivery_topology.macos_desktop.host_technology, 'swift_appkit_wkwebview');
  assert.equal(profile.delivery_topology.macos_desktop.electron_required, false);
  assert.equal(profile.delivery_topology.workspace.product_name, 'OPL Workspace');
  assert.equal(profile.delivery_topology.workspace.electron_in_container_allowed, false);
  assert.equal(profile.delivery_topology.workspace.aioncore_in_container_allowed, false);
  assert.equal(profile.delivery_topology.workspace.same_renderer_and_bridge_shape_required, true);
  assert.equal(profile.delivery_topology.cross_platform_desktop.decision_status, 'wrapper_selection_deferred');
  assert.equal(profile.delivery_topology.cross_platform_desktop.implementation_owner_status, 'unassigned');
  assert.equal(profile.delivery_topology.cross_platform_desktop.mainline_implementation_assigned, false);
  assert.equal(profile.delivery_topology.cross_platform_desktop.support_claim_allowed, false);
  assert.equal(profile.delivery_topology.native_candidate.mainline_development_required, false);
  assert.equal(profile.delivery_topology.native_candidate.completion_or_feature_parity_obligation, false);
  assert.equal(profile.delivery_topology.aionui_reference.target_renderer_owner, false);
  assert.equal(candidates.active_shell_unchanged, 'aionui');
  assert.equal(
    release.distribution_semantics.cohort_policy.approved_production_target.model,
    'one_app_product_multiple_independently_versioned_carriers',
  );
  assert.deepEqual(
    release.distribution_semantics.cohort_policy.approved_production_target.runtime_forms,
    ['desktop', 'container_webui'],
  );
  assert.doesNotThrow(() =>
    validateProductProfile(profile, readJson('contracts/app-install-exposure-policy.json')),
  );
});

test('delivery topology validator rejects AionCore coupling, a second product path, or premature platform promotion', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const mutations = [
    {
      error: /shared renderer topology/,
      mutate: (profile) => { profile.delivery_topology.shared_renderer.carrier_specific_product_forks_allowed = true; },
    },
    {
      error: /Codex-only runtime topology/,
      mutate: (profile) => { profile.delivery_topology.runtime.aioncore_allowed = true; },
    },
    {
      error: /OPL Workspace topology/,
      mutate: (profile) => { profile.delivery_topology.workspace.electron_in_container_allowed = true; },
    },
    {
      error: /native macOS topology/,
      mutate: (profile) => { profile.delivery_topology.macos_desktop.electron_required = true; },
    },
    {
      error: /future cross-platform desktop topology/,
      mutate: (profile) => { profile.delivery_topology.cross_platform_desktop.support_claim_allowed = true; },
    },
    {
      error: /Native evaluation policy/,
      mutate: (profile) => { profile.delivery_topology.native_candidate.mainline_development_required = true; },
    },
    {
      error: /AionUI reference boundary/,
      mutate: (profile) => { profile.delivery_topology.aionui_reference.target_renderer_owner = true; },
    },
  ];

  for (const { error, mutate } of mutations) {
    const profile = readJson('contracts/app-product-profile.json');
    mutate(profile);
    assert.throws(() => validateProductProfile(profile, installExposure), error);
  }
});
