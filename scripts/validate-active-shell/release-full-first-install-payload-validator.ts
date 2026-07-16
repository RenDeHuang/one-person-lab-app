import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { temporalLocalServiceDefaults, temporalManagedCommands } from './app-contract-constants.ts';

export function validateReleaseFullFirstInstallPayloads(releaseChannel) {
  validateReleaseFullCodexCliPayload(releaseChannel.full_first_install?.required_payloads?.codex_cli);
  validateReleaseFullTemporalCliPayload(releaseChannel.full_first_install?.required_payloads?.temporal_cli);
  validateReleaseFullTemporalRuntimeProvider(
    releaseChannel.full_first_install?.required_payloads?.temporal_runtime_provider,
  );
  validateReleaseFullSizeOptimizationPolicy(releaseChannel.full_first_install?.size_policy);
}

function validateReleaseFullCodexCliPayload(codexCli) {
  if (
    codexCli?.compatibility_mode !== 'minimum_version_plus_capability_smoke' ||
    codexCli?.minimum_version_source !== 'distribution cohort manifest components.codex_cli.minimum_version' ||
    codexCli?.fallback_version_source !== 'distribution cohort manifest components.codex_cli.fallback_version' ||
    codexCli?.fallback_runtime_path !== 'runtime/current/bin/codex' ||
    codexCli?.fallback_payload_path !== 'runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz' ||
    codexCli?.must_prefer_valid_newer_user_version !== false ||
    codexCli?.system_sources_visible_as_diagnostics !== true ||
    codexCli?.system_sources_require_expert_opt_in !== true ||
    !/offline from the packaged archive wrapper/.test(codexCli?.verification ?? '')
  ) {
    throw new Error('Release channel Full Codex CLI payload must default to the App-owned offline archive-wrapper runtime');
  }
  assertDeepEqualJson(
    codexCli.preferred_sources,
    ['app_owned_archive_wrapper'],
    'Release channel Codex CLI preferred sources',
  );
}

function validateReleaseFullTemporalCliPayload(temporalCli) {
  if (
    temporalCli?.compatibility_mode !== 'minimum_version_plus_capability_smoke' ||
    temporalCli?.minimum_version_source !== 'distribution cohort manifest components.temporal_cli.minimum_version' ||
    temporalCli?.fallback_version_source !== 'distribution cohort manifest components.temporal_cli.fallback_version' ||
    temporalCli?.fallback_runtime_path !== 'runtime/current/bin/temporal' ||
    temporalCli?.fallback_payload_path !== 'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz' ||
    temporalCli?.must_prefer_valid_newer_user_version !== false ||
    temporalCli?.system_sources_visible_as_diagnostics !== true ||
    temporalCli?.system_sources_require_expert_opt_in !== true ||
    !/offline from the packaged archive wrapper/.test(temporalCli?.verification ?? '')
  ) {
    throw new Error('Release channel Full Temporal CLI payload must default to the App-owned offline archive-wrapper runtime');
  }
  assertDeepEqualJson(
    temporalCli.preferred_sources,
    ['app_owned_archive_wrapper'],
    'Release channel Temporal CLI preferred sources',
  );
}

function validateReleaseFullTemporalRuntimeProvider(temporalRuntimeProvider) {
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
  if (
    temporalRuntimeProvider?.service_supervisor?.required !== true ||
    temporalRuntimeProvider?.service_supervisor?.platform_scope !== 'desktop_macos_local_managed_service' ||
    temporalRuntimeProvider?.service_supervisor?.login_resident !== true ||
    temporalRuntimeProvider?.service_supervisor?.run_at_load !== true ||
    temporalRuntimeProvider?.service_supervisor?.keep_alive !== true ||
    temporalRuntimeProvider?.service_supervisor?.launcher_policy !==
      'canonical_executable_realpath_or_packaged_runtime_path_never_repo_TypeScript_checkout' ||
    temporalRuntimeProvider?.service_supervisor?.persistent_database_path !==
      '${HOME}/Library/Application Support/OPL/state/family-runtime/temporal-server/temporal.sqlite' ||
    temporalRuntimeProvider?.service_supervisor?.persistent_database_argument !== '--db-filename' ||
    temporalRuntimeProvider?.service_supervisor?.configuration_current_required !== true
  ) {
    throw new Error('Release channel Full Temporal provider must require a stable login-resident service supervisor');
  }
  if (!/wrapper must export local Temporal defaults/.test(temporalRuntimeProvider?.verification ?? '')) {
    throw new Error('Release channel Full Temporal provider verification must include wrapper default exports');
  }
}

function validateReleaseFullSizeOptimizationPolicy(sizePolicy) {
  if (
    sizePolicy?.offline_first_install_completeness_must_not_regress !== true ||
    sizePolicy?.threshold_semantics?.review_full_dmg_bytes?.status !==
      'review_required_not_release_blocking_by_size_alone' ||
    !/not release-blocking by size alone/.test(sizePolicy?.threshold_semantics?.stable_release_coupling_rule ?? '')
  ) {
    throw new Error('Release channel Full size policy must decouple size review from stable release blocking while preserving offline first-install completeness');
  }
  const artifacts = sizePolicy.optimization_artifacts;
  if (
    artifacts?.schema !== 'opl_full_package_optimization.v1' ||
    artifacts?.manifest_section !== 'package_optimization' ||
    artifacts?.public_manifest !== 'opl-release-manifest.json' ||
    artifacts?.trim_report !== 'opl-release-manifest.json#evidence.app_bundle_trim_report' ||
    artifacts?.trim_report_schema !== 'opl_full_app_bundle_trim_report.v1' ||
    artifacts?.boundary_audit !== 'opl-release-manifest.json#evidence.package_boundary_audit' ||
    artifacts?.boundary_audit_schema !== 'opl_full_package_boundary_audit.v1' ||
    artifacts?.mode !== 'explicit_non_runtime_prune_only' ||
    artifacts?.required_manifest_flags?.offline_first_install_completeness_preserved !== true ||
    artifacts?.required_manifest_flags?.size_review_release_blocking_by_size_alone !== false
  ) {
    throw new Error('Release channel Full size policy must declare package optimization artifacts and manifest flags');
  }
  assertIncludesAll(
    artifacts.required_preserved_payloads,
    [
      'Contents/Resources/opl-full-runtime',
      'Contents/Resources/bundled-aioncore',
      'Contents/Resources/app.asar',
      'Contents/Resources/app.asar.unpacked',
      'Contents/Frameworks/Electron Framework.framework',
    ],
    'Release channel Full optimization preserved payloads',
  );
  assertIncludesAll(
    artifacts.required_remote_assets,
    ['opl-release-manifest.json'],
    'Release channel Full optimization remote assets',
  );
  assertIncludesAll(
    artifacts.transition_accepted_legacy_remote_assets,
    ['full-app-bundle-trim-report.json', 'full-package-boundary-audit.json'],
    'Release channel Full optimization transition legacy remote assets',
  );
}
