import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { temporalLocalServiceDefaults, temporalManagedCommands } from './app-contract-constants.ts';

export function validateReleaseFullFirstInstallPayloads(releaseChannel) {
  validateReleaseFullCodexCliPayload(releaseChannel.full_first_install?.required_payloads?.codex_cli);
  validateReleaseFullTemporalCliPayload(releaseChannel.full_first_install?.required_payloads?.temporal_cli);
  validateReleaseFullTemporalRuntimeProvider(
    releaseChannel.full_first_install?.required_payloads?.temporal_runtime_provider,
  );
}

function validateReleaseFullCodexCliPayload(codexCli) {
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
}

function validateReleaseFullTemporalCliPayload(temporalCli) {
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
  if (!/wrapper must export local Temporal defaults/.test(temporalRuntimeProvider?.verification ?? '')) {
    throw new Error('Release channel Full Temporal provider verification must include wrapper default exports');
  }
}
