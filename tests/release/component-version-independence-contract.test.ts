import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  validateInstallExposurePolicy,
} from '../../scripts/validate-active-shell/install-exposure-policy-validator.ts';

const readJson = (relativePath: string) =>
  JSON.parse(fs.readFileSync(relativePath, 'utf8')) as Record<string, any>;

test('component interoperability consumes a canonical Framework receipt without cross-component lockstep', () => {
  const policy = readJson('contracts/app-install-exposure-policy.json');
  const interoperability = policy.component_interoperability;
  const admission = interoperability.compatibility_admission;
  const profile = interoperability.compatibility_profiles.gui_installed_acceptance;

  assert.doesNotThrow(() => validateInstallExposurePolicy(policy));
  assert.equal(interoperability.model, 'independently_versioned_open_composition');
  assert.equal(interoperability.combination_policy.exact_cross_component_version_or_commit_lockstep_required, false);
  assert.equal(interoperability.provenance.may_gate_install_or_runtime, false);
  assert.equal(admission.current_framework_producer_status, 'canonical_owner_cli_and_receipt_producer');
  assert.equal(
    admission.producer_contract_ref,
    'contracts/opl-framework/app-component-compatibility-receipt-contract.json',
  );
  assert.deepEqual(profile.requirements, [
    {
      requirement_id: 'framework_compatibility_receipt_schema',
      kind: 'capability_id_with_versioned_schema',
      component_id: 'opl_framework',
      capability_id: 'opl_component_compatibility_receipt',
      schema_range: '>=1.0.0 <2.0.0',
    },
  ]);
  assert.deepEqual(admission.required_receipt_coverage, {
    requirement_ids: 'exactly_once',
    component_ids: 'exactly_the_components_targeted_by_requirements',
    satisfied_requirements_require_framework_owner_observation: true,
    package_inventory_complete: 'required_only_when_requirements_target_packages',
  });
});

test('self-artifact identity remains strict while compatible component versions remain independent', () => {
  const policy = readJson('contracts/app-install-exposure-policy.json');
  const interoperability = policy.component_interoperability;
  const artifact = interoperability.artifact_self_integrity;

  assert.deepEqual(artifact.required_identity_fields, [
    'owner_authority',
    'immutable_release_tag',
    'asset_url',
    'asset_name',
    'byte_size',
    'sha256',
  ]);
  assert.equal(artifact.same_release_asset_anonymous_authenticated_byte_parity_required, true);
  assert.equal(artifact.installed_bytes_must_match_selected_carrier_artifact, true);
  assert.deepEqual(interoperability.forbidden_install_or_runtime_gates, [
    'exact_cross_component_version_equality',
    'exact_cross_component_sha_equality',
    'same_app_shell_framework_base_package_cohort',
    'bundle_or_bom_digest_equality_across_components',
    'app_owned_package_bom_or_lock',
    'carrier_projection_defines_package_currentness',
  ]);
  assert.deepEqual(interoperability.negative_matrix.must_accept, [
    'compatible_components_with_different_versions_and_commits',
    'standard_and_full_independent_publication_and_installation_with_self_identity_and_compatibility',
  ]);
});

test('updater contract makes Stable reclaim a published Nightly only with a higher App updaterVersion', () => {
  const release = readJson('contracts/app-release-channel.json');
  const selection = release.standard_updater.candidate_selection;

  assert.equal(selection.latest_pointer_is_not_candidate_sort_authority, true);
  assert.equal(selection.nightly_is_not_an_independent_user_channel, true);
  assert.deepEqual(selection.monotonicity, {
    comparison: 'semver',
    machine_version_contract_ref: 'github_release_name.machine_version',
    candidate_lower_than_installed: 'reject',
    candidate_equal_to_installed: 'no_op',
    candidate_higher_than_installed: 'update',
    invalid_or_missing_updater_version: 'reject',
    superseding_stable_must_exceed_published_nightly: true,
    published_nightly_baseline_sources: [
      'durable_publication_record',
      'candidate_metadata',
    ],
    superseding_comparison: 'strictly_greater_updater_version_semver',
    lower_or_equal_superseding_stable: 'reject',
  });
});

test('security remediation projection preserves self-artifact integrity without reintroducing component lockstep', () => {
  const correction = readJson(
    'docs/security/audits/2026-07-30-codex-security-app/remediation-correction.json',
  );
  const dispositions = correction.dispositions as Array<Record<string, any>>;

  assert.deepEqual(correction.sealed_scan, {
    scan_id: '22ac28a3-c239-4497-a440-4f4437adb4df',
    revision: '329f84f7163323936166f03765eca2f6622d3096',
    scan_manifest_sha256: '3d40e6d124343042f0393d4307a6e90a9d36a2c179253e8cb32733d9eef450ef',
    findings_sha256: '4a3f2d0ea53e46d9ac369e40f1a23e6be51a30469592bb891786591a43225991',
    report_sha256: '1f834325c1295b9704bebab3818fd11ea99156f417440bc78557763c8f88a1a2',
    sealed_scan_modified: false,
    finding_count: 11,
  });
  assert.equal(dispositions.length, 11);
  assert.equal(
    dispositions.filter(({ disposition }) => disposition === 'retain_self_artifact_integrity').length,
    8,
  );
  assert.equal(
    dispositions.filter(({ disposition }) => disposition === 'retain_independent_security_finding').length,
    3,
  );
  assert.equal(
    correction.product_contract.cross_component_exact_version_sha_or_cohort_lock_allowed,
    false,
  );
  assert.equal(correction.product_contract.component_refs_may_gate_install_or_runtime, false);
  assert.equal(
    correction.acceptance_boundary
      .capability_minimum_or_semver_range_is_the_only_cross_component_compatibility_language,
    true,
  );
  for (const disposition of dispositions.filter(
    ({ disposition }) => disposition === 'retain_self_artifact_integrity',
  )) {
    assert.equal(disposition.independent_component_versions_must_remain_acceptable, true);
    assert.match(disposition.forbidden_remediation, /Do not/);
  }
});
