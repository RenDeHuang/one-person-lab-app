import { assertDeepEqualJson } from './assertions.ts';

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`);
  }
}

export function validateDistributionInstallSsot(releaseChannel, installExposurePolicy) {
  const release = releaseChannel?.distribution_semantics;
  const install = installExposurePolicy?.distribution_install_model;
  const humanSsot = 'docs/delivery/distribution-and-install-ssot.md';

  requireEqual(release?.schema, 'opl_app_distribution_semantics.v1', 'Distribution release schema');
  requireEqual(install?.schema, 'opl_app_distribution_install_model.v1', 'Distribution install schema');
  requireEqual(release?.human_ssot, humanSsot, 'Distribution release human SSOT');
  requireEqual(install?.human_ssot, humanSsot, 'Distribution install human SSOT');
  requireEqual(
    install?.release_semantics_ref,
    'contracts/app-release-channel.json#distribution_semantics',
    'Distribution install release semantics ref',
  );

  assertDeepEqualJson(
    release.orthogonal_dimensions,
    {
      quality: ['stable', 'nightly', 'preview'],
      recommended_pointer: ['latest'],
      payload_density: ['standard', 'full'],
      runtime_form: ['desktop', 'native_webui', 'container_webui'],
      build_origin: ['automated', 'manual'],
      task_mode: ['development_validation', 'production_release'],
    },
    'Distribution orthogonal dimensions',
  );

  requireEqual(release.terms?.stable?.is_pointer, false, 'Stable pointer classification');
  requireEqual(release.terms?.stable?.build_origin_independent, true, 'Stable build-origin independence');
  requireEqual(release.terms?.latest?.default_target, 'newest_production_stable', 'Latest default target');
  requireEqual(release.terms?.nightly?.default_payload_density, 'standard', 'Nightly payload density');
  requireEqual(release.terms?.nightly?.full_by_default, false, 'Nightly Full default');
  requireEqual(release.terms?.nightly?.latest_allowed, false, 'Nightly Latest eligibility');
  requireEqual(release.terms?.preview?.latest_allowed, false, 'Preview Latest eligibility');
  requireEqual(release.terms?.full?.independent_long_term_update_channel, false, 'Full channel classification');

  const latest = release.latest_policy;
  requireEqual(latest?.current_admission, 'framework_bundle_stable_only', 'Latest current admission');
  requireEqual(
    latest?.manual_build_may_become_stable_after_same_production_gates,
    true,
    'Manual Stable-equivalent admission',
  );
  requireEqual(
    latest?.manual_ungated_or_preview_build_may_become_latest,
    false,
    'Ungated manual Latest admission',
  );
  requireEqual(latest?.nightly_may_become_latest, false, 'Nightly Latest admission');
  requireEqual(latest?.next_qualified_stable_reclaims_pointer, true, 'Next Stable Latest behavior');

  const currentCohort = release.cohort_policy?.current_development_state;
  const targetCohort = release.cohort_policy?.approved_production_target;
  requireEqual(currentCohort?.desktop_and_webui, 'dual_track', 'Current Desktop/WebUI cohort');
  requireEqual(currentCohort?.independent_version_and_cadence_allowed, true, 'Development dual-track version policy');
  requireEqual(currentCohort?.same_production_cohort_claim_allowed, false, 'Development production-cohort claim');
  requireEqual(targetCohort?.model, 'one_app_version_multiple_runtime_forms', 'Production cohort target');
  requireEqual(targetCohort?.same_app_version_and_official_profile_required, true, 'Production version convergence');
  requireEqual(targetCohort?.physical_artifact_bytes_must_match, false, 'Cross-carrier byte identity');
  requireEqual(
    targetCohort?.framework_reconciliation_and_product_behavior_must_converge,
    true,
    'Cross-carrier behavior convergence',
  );

  requireEqual(
    releaseChannel.nightly_standard?.status,
    'publication_retired_historical_compatibility',
    'Current Nightly publication state',
  );
  requireEqual(releaseChannel.nightly_standard?.full_first_install_allowed, false, 'Current Nightly Full policy');
  requireEqual(releaseChannel.nightly_standard?.latest_release_allowed, false, 'Current Nightly Latest policy');
  requireEqual(
    release.implementation_state?.desktop_nightly,
    'retired_historical_read_compatibility',
    'Distribution Nightly implementation state',
  );
  requireEqual(
    release.retired_compatibility?.desktop_nightly?.historical_payload_density,
    'standard',
    'Nightly historical payload density',
  );
  requireEqual(
    release.retired_compatibility?.desktop_nightly?.historical_full_by_default,
    false,
    'Nightly historical Full default',
  );
  requireEqual(
    release.retired_compatibility?.desktop_nightly?.historical_latest_allowed,
    false,
    'Nightly historical Latest policy',
  );
  requireEqual(
    release.retired_compatibility?.desktop_nightly?.new_publication_status,
    'not_approved_requires_new_product_decision',
    'Nightly new publication status',
  );
  requireEqual(release.approved_targets?.desktop_nightly, undefined, 'Nightly approved target');

  const releaseHomebrew = releaseChannel.homebrew_tap_distribution;
  requireEqual(
    release.implementation_state?.homebrew_full,
    'legacy_cask_exists_not_managed_by_current_release_pipeline',
    'Full Cask current release state',
  );
  requireEqual(releaseHomebrew?.excluded_casks?.includes('one-person-lab-full'), false, 'Approved Full Cask exclusion');
  requireEqual(releaseHomebrew?.full_casks?.includes('one-person-lab-full'), true, 'Approved Full Cask target');
  requireEqual(releaseHomebrew?.tap_update_policy?.full?.homebrew_publish_allowed, false, 'Current Full Cask publication');
  requireEqual(
    releaseHomebrew?.tap_update_policy?.nightly?.mutation_allowed,
    false,
    'Retired Nightly Cask mutation',
  );
  requireEqual(
    release.approved_targets?.homebrew_full?.formula_dependency_target,
    false,
    'Full Cask target Formula dependency',
  );
  requireEqual(
    release.approved_targets?.homebrew_full?.generation_status,
    'implemented_unpublished',
    'Full Cask target generator status',
  );
  requireEqual(
    release.approved_targets?.homebrew_full?.generator,
    'scripts/update-homebrew-tap.ts',
    'Full Cask target generator',
  );
  requireEqual(
    release.approved_targets?.homebrew_full?.package_kind,
    'app_full_first_install',
    'Full Cask target package kind',
  );
  requireEqual(
    release.approved_targets?.homebrew_full?.framework_carrier_target,
    'full_dmg_embedded_opl_base',
    'Full Cask target Framework carrier',
  );
  requireEqual(
    release.approved_targets?.homebrew_full?.active_framework_count_target,
    1,
    'Full Cask target active Framework count',
  );
  assertDeepEqualJson(
    release.approved_targets?.homebrew_full?.cask_conflicts_required,
    ['one-person-lab', 'one-person-lab-nightly'],
    'Full Cask target conflicts',
  );
  requireEqual(
    release.approved_targets?.homebrew_full?.digest_cas_required,
    true,
    'Full Cask target digest CAS',
  );
  requireEqual(
    release.approved_targets?.homebrew_full?.public_promotion_status,
    'not_approved_until_promotion_requirements_pass',
    'Full Cask target public promotion status',
  );

  const consistency = install.consistency_target;
  requireEqual(consistency?.name, 'official_profile_converged', 'Install consistency target');
  requireEqual(consistency?.physical_byte_identity_required, false, 'Install physical byte identity');
  requireEqual(consistency?.base_app_and_packages_version_lockstep_required, false, 'Install version lockstep');
  requireEqual(consistency?.same_product_behavior_contract_required, true, 'Install behavior convergence');
  requireEqual(consistency?.same_official_profile_intent_required, true, 'Install Official Profile convergence');
  requireEqual(
    consistency?.configured_carrier_terminal_readback_required,
    true,
    'Install carrier terminal readback',
  );
  requireEqual(consistency?.active_framework_count, 1, 'Install active Framework count');
  requireEqual(
    consistency?.package_published_current_stable_authority,
    'package_owner_per_package_ghcr_latest_stable',
    'Package published current stable authority',
  );
  requireEqual(
    consistency?.package_installed_callable_authority,
    'configured_carrier_readback_aggregated_by_framework',
    'Package installed callable authority',
  );

  const nativeWebui = install.runtime_forms?.native_webui;
  requireEqual(nativeWebui?.source_runtime_status, 'active_development_capability', 'Native WebUI source status');
  requireEqual(nativeWebui?.public_install_status, 'not_published', 'Native WebUI public status');
  requireEqual(nativeWebui?.opl_support_status, 'approved_target_not_supported', 'Native WebUI support status');
  requireEqual(nativeWebui?.electron_required, false, 'Native WebUI Electron requirement');
  requireEqual(nativeWebui?.docker_required, false, 'Native WebUI Docker requirement');
  requireEqual(
    nativeWebui?.upstream_aionui_tarballs_are_opl_release_evidence,
    false,
    'Native WebUI upstream artifact authority',
  );
  requireEqual(
    install.runtime_forms?.container_webui?.target,
    'container_adapter_over_same_frozen_webui_runtime_as_native',
    'Container WebUI target',
  );
  requireEqual(
    (installExposurePolicy.installer_surfaces ?? []).some((entry) => entry.surface === 'native_webui'),
    false,
    'Native WebUI active installer surface',
  );

  const installer = install.installer_convergence;
  assertDeepEqualJson(
    installer?.current_default_app_script?.framework_arguments,
    ['--with-app', '--skip-packages'],
    'Current App installer Framework arguments',
  );
  requireEqual(
    installer?.current_default_app_script?.official_profile_converged_by_installer,
    false,
    'Current App installer convergence',
  );
  requireEqual(installer?.approved_universal_target?.macos_default, 'desktop', 'Universal macOS target');
  requireEqual(installer?.approved_universal_target?.linux_personal_default, 'native_webui', 'Universal Linux target');
  requireEqual(
    installer?.approved_universal_target?.server_or_isolated_explicit,
    'container_webui',
    'Universal server target',
  );
  requireEqual(installer?.approved_universal_target?.headless_explicit, 'opl_base_only', 'Universal headless target');
  requireEqual(installer?.approved_universal_target?.result, 'official_profile_converged', 'Universal result');
  requireEqual(
    installer?.stable_macos_helper?.current_status,
    'live_compatibility_path',
    'Stable macOS helper current state',
  );
  requireEqual(
    installer?.stable_macos_helper?.new_public_documentation_priority,
    false,
    'Stable macOS helper documentation priority',
  );

  const installHomebrew = install.homebrew_carriers;
  requireEqual(installHomebrew?.standard?.formula_dependency_current, true, 'Standard Cask current Formula dependency');
  requireEqual(installHomebrew?.standard?.formula_dependency_target, true, 'Standard Cask target Formula dependency');
  requireEqual(installHomebrew?.nightly?.dmg_profile, 'standard_nightly', 'Nightly Cask DMG profile');
  requireEqual(installHomebrew?.nightly?.full_by_default, false, 'Nightly Cask Full default');
  requireEqual(
    installHomebrew?.nightly?.new_publication_status,
    'not_approved_requires_new_product_decision',
    'Nightly Cask new publication status',
  );
  requireEqual(
    installHomebrew?.nightly?.formula_dependency_if_reactivated,
    true,
    'Nightly Cask historical Formula relationship',
  );
  requireEqual(installHomebrew?.full?.dmg_embeds_opl_base, true, 'Full Cask embedded Base');
  requireEqual(installHomebrew?.full?.formula_dependency_current, true, 'Full Cask current Formula dependency');
  requireEqual(installHomebrew?.full?.duplicate_base_carrier_risk_current, true, 'Full Cask current duplicate risk');
  requireEqual(installHomebrew?.full?.formula_dependency_target, false, 'Full Cask target Formula dependency');
  requireEqual(
    installHomebrew?.full?.target_generation_status,
    'implemented_unpublished',
    'Full Cask install target generator status',
  );
  requireEqual(
    installHomebrew?.full?.target_generator_ref,
    'scripts/update-homebrew-tap.ts',
    'Full Cask install target generator',
  );
  requireEqual(
    installHomebrew?.full?.target_framework_carrier,
    'full_dmg_embedded_opl_base',
    'Full Cask install target Framework carrier',
  );
  requireEqual(
    installHomebrew?.full?.target_digest_cas_required,
    true,
    'Full Cask install target digest CAS',
  );
  requireEqual(installHomebrew?.full?.target_requires_active_framework_count, 1, 'Full Cask target Framework count');
  requireEqual(
    installHomebrew?.quarantine?.homebrew_cask_automatically_clears_quarantine_current,
    false,
    'Homebrew quarantine behavior',
  );
  requireEqual(
    installHomebrew?.quarantine?.current_clean_vm_harness_clears_quarantine_outside_homebrew,
    true,
    'Homebrew smoke quarantine boundary',
  );

  const installChannel = installExposurePolicy.distribution_channels?.homebrew;
  requireEqual(installChannel?.casks?.standard_app, installHomebrew.standard.cask, 'Standard Cask cross-contract name');
  requireEqual(installChannel?.casks?.nightly_standard_app, installHomebrew.nightly.cask, 'Nightly Cask cross-contract name');
  requireEqual(installChannel?.casks?.full_first_install_app, installHomebrew.full.cask, 'Full Cask cross-contract name');
}
