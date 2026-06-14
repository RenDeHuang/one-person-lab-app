import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { temporalLocalServiceDefaults, temporalManagedCommands } from './app-contract-constants.ts';

export function validateInstallExposureRuntimeAndDistribution(policy) {
  validateTemporalAutoConfiguration(policy.temporal_auto_configuration);
  validateSyncAndInstallContract(policy.sync_and_install_contract);
  validateRuntimeToolchainAutoUpdate(policy.runtime_toolchain_auto_update);
  validateHomebrewDistribution(policy.distribution_channels?.homebrew);
  validateManagedAgentPackDistribution(policy.agent_installation_contract?.managed_agent_pack_distribution);
  validateReleaseValidation(policy.release_validation);
}

function validateTemporalAutoConfiguration(temporalAutoConfig) {
  if (
    temporalAutoConfig?.owner !== 'one-person-lab' ||
    temporalAutoConfig?.app_role !== 'configure_defaults_and_surface_readiness_not_provider_implementation' ||
    temporalAutoConfig?.provider_env_default !== 'OPL_FAMILY_RUNTIME_PROVIDER=temporal'
  ) {
    throw new Error('Install exposure Temporal auto-configuration must keep OPL owner and App default configuration role');
  }
  assertDeepEqualJson(
    temporalAutoConfig.local_service_defaults,
    temporalLocalServiceDefaults,
    'Install exposure Temporal local service defaults',
  );
  assertDeepEqualJson(
    temporalAutoConfig.managed_commands,
    temporalManagedCommands,
    'Install exposure Temporal managed commands',
  );
  if (
    temporalAutoConfig.first_run_policy?.ready_to_launch_blocking !== false ||
    temporalAutoConfig.first_run_policy?.full_readiness_item !== 'family_runtime_provider' ||
    temporalAutoConfig.first_run_policy?.background_maintenance_owner !== 'app_or_cli_managed_background_maintenance'
  ) {
    throw new Error('Install exposure Temporal first-run policy must keep provider readiness non-blocking and background-managed');
  }
  assertIncludesAll(
    temporalAutoConfig.first_run_policy?.required_diagnostics,
    ['temporal_cli_version', 'temporal_service_lifecycle', 'temporal_worker_lifecycle_status', 'worker_dependency_health'],
    'Install exposure Temporal diagnostics',
  );
  if (
    temporalAutoConfig.packaged_runtime_policy?.full_wrapper_must_export_defaults !== true ||
    temporalAutoConfig.packaged_runtime_policy?.must_include_temporal_cli_wrapper !== true ||
    temporalAutoConfig.packaged_runtime_policy?.temporal_cli_wrapper_must_execute_offline_archive !== true ||
    temporalAutoConfig.packaged_runtime_policy?.must_include_temporal_node_runtime_packages !== true ||
    temporalAutoConfig.packaged_runtime_policy?.must_exclude_temporal_testing_package !== true ||
    temporalAutoConfig.packaged_runtime_policy?.native_core_bridge_target !== 'aarch64-apple-darwin'
  ) {
    throw new Error('Install exposure Temporal packaged runtime policy must require wrapper defaults and macOS arm64 runtime payloads');
  }
  assertIncludesAll(
    temporalAutoConfig.fail_closed_states,
    [
      'missing_temporal_cli_wrapper',
      'missing_temporal_node_runtime_package',
      'temporal_worker_dependency_unavailable',
      'temporal_local_service_stale_state',
      'temporal_worker_process_exited',
      'temporal_worker_source_stale',
    ],
    'Install exposure Temporal fail-closed states',
  );
}

function validateSyncAndInstallContract(sync) {
  for (const command of ['opl install', 'opl system initialize --json', 'opl system startup-maintenance', 'opl connect reconcile-modules', 'opl connect sync-skills']) {
    if (!sync?.framework_commands?.includes(command)) {
      throw new Error(`Install exposure sync contract must include ${command}`);
    }
  }
  if (sync.codex_plugin_registry_owner !== 'one-person-lab') {
    throw new Error('Install exposure sync contract must keep Codex plugin registry owner in one-person-lab');
  }
  if (sync.app_release_payload_owner !== 'one-person-lab-app') {
    throw new Error('Install exposure sync contract must keep App release payload owner in one-person-lab-app');
  }
  for (const prevention of [
    'plugin-packaged MAS/MAG/RCA skills must not be mirrored into duplicate bare skill directories',
    'OPL Meta Agent is surfaced as an OPL-generated local Codex plugin surface',
    'App visible companion skill defaults must be product profile configuration, not shell-local hardcoding',
  ]) {
    if (!sync.duplicate_prevention?.includes(prevention)) {
      throw new Error(`Install exposure duplicate prevention must include ${prevention}`);
    }
  }
  for (const state of [
    'dirty_managed_checkout',
    'ahead_or_diverged_managed_checkout',
    'missing_plugin_manifest',
    'missing_skill_entry',
    'duplicate_codex_visible_domain_skill',
    'unavailable_managed_agent_pack_channel',
  ]) {
    if (!sync.fail_closed_states?.includes(state)) {
      throw new Error(`Install exposure fail-closed states must include ${state}`);
    }
  }
}

function validateRuntimeToolchainAutoUpdate(runtimeUpdate) {
  if (
    runtimeUpdate?.owner !== 'one-person-lab-app' ||
    runtimeUpdate?.producer_owner !== 'one-person-lab' ||
    runtimeUpdate?.framework_role !== 'apply_verified_staged_runtime_during_startup_maintenance' ||
    runtimeUpdate?.entrypoint !== 'opl system startup-maintenance' ||
    runtimeUpdate?.ready_to_launch_blocking !== false
  ) {
    throw new Error('Install exposure runtime/toolchain auto update must be App-owned, silent, staged, and applied through startup maintenance');
  }
  validateRuntimeToolchainDefaultPolicy(runtimeUpdate.default_policy);
  assertIncludesAll(
    runtimeUpdate.managed_components,
    [
      'codex_cli_fallback',
      'temporal_cli_archive',
      'node_runtime',
      'python_runtime',
      'uv_runtime',
      'officecli',
      'mineru_open_api',
      'companion_skills',
      'opl_framework_runtime',
      'domain_module_payloads',
    ],
    'Install exposure runtime/toolchain managed components',
  );
  validateRuntimeToolchainUserGlobalPolicy(runtimeUpdate.user_global_tool_policy);
  validateRuntimeToolchainCleanMachineRequirement(runtimeUpdate.clean_machine_requirement);
  assertIncludesAll(
    runtimeUpdate.fail_closed_states,
    [
      'runtime_update_manifest_invalid',
      'runtime_update_asset_sha256_mismatch',
      'runtime_update_capability_smoke_failed',
      'runtime_update_startup_smoke_failed',
    ],
    'Install exposure runtime/toolchain fail-closed states',
  );
}

function validateRuntimeToolchainDefaultPolicy(defaultPolicy) {
  if (
    defaultPolicy?.auto_check !== true ||
    defaultPolicy?.download !== 'silent_background' ||
    defaultPolicy?.stage !== 'verify_then_stage_app_owned_runtime' ||
    defaultPolicy?.apply !== 'next_app_restart' ||
    defaultPolicy?.rollback !== 'previous_runtime_pointer_on_startup_smoke_failure'
  ) {
    throw new Error('Install exposure runtime/toolchain auto update must be App-owned, silent, staged, and applied through startup maintenance');
  }
}

function validateRuntimeToolchainUserGlobalPolicy(userGlobalToolPolicy) {
  if (
    userGlobalToolPolicy?.prefer_compatible_newer_system_tool !== true ||
    userGlobalToolPolicy?.silent_homebrew_upgrade_allowed !== false ||
    userGlobalToolPolicy?.silent_system_tool_mutation_allowed !== false ||
    userGlobalToolPolicy?.opt_in_global_upgrade_surface !== 'Developer Profile explicit maintenance action'
  ) {
    throw new Error('Install exposure runtime/toolchain auto update must not silently mutate Homebrew or system tools');
  }
}

function validateRuntimeToolchainCleanMachineRequirement(cleanMachineRequirement) {
  if (
    cleanMachineRequirement?.full_first_install_must_remain_self_contained !== true ||
    cleanMachineRequirement?.required_release_smoke !== 'full_dmg_clean_vm_smoke' ||
    cleanMachineRequirement?.standard_core_ready_must_not_require_homebrew_node_git_or_clt !== true
  ) {
    throw new Error('Install exposure runtime/toolchain auto update must preserve clean-machine installability');
  }
}

function validateHomebrewDistribution(homebrew) {
  if (
    homebrew?.role !== 'app_cask_transport_and_install_index_only' ||
    homebrew?.tap !== 'gaofeng21cn/one-person-lab' ||
    homebrew?.must_not_own_agent_semantics !== true ||
    homebrew?.must_not_write_user_codex_state !== true ||
    homebrew?.user_state_activation_owner !== 'opl_framework'
  ) {
    throw new Error('Install exposure Homebrew distribution must stay transport-only and delegate activation to OPL Framework');
  }
  assertIncludesAll(
    homebrew.activation_commands,
    ['opl connect reconcile-modules', 'opl connect sync-skills'],
    'Install exposure Homebrew activation commands',
  );
  if (
    JSON.stringify(homebrew.formulae) !== JSON.stringify({}) ||
    homebrew.casks?.standard_app !== 'one-person-lab' ||
    homebrew.casks?.nightly_standard_app !== 'one-person-lab-nightly' ||
    homebrew.casks?.full_first_install_app !== 'one-person-lab-full' ||
    homebrew.full_first_install_cask?.name !== 'one-person-lab-full' ||
    homebrew.full_first_install_cask?.standard_updater_visible !== false
  ) {
    throw new Error('Install exposure Homebrew cask names must match the App-only distribution channel contract');
  }
  assertDeepEqualJson(
    homebrew.allowed_user_targets,
    ['Casks/one-person-lab.rb', 'Casks/one-person-lab-nightly.rb', 'Casks/one-person-lab-full.rb'],
    'Install exposure Homebrew allowed user targets',
  );
  assertDeepEqualJson(
    homebrew.initial_live_targets,
    ['Casks/one-person-lab.rb', 'Casks/one-person-lab-nightly.rb', 'Casks/one-person-lab-full.rb'],
    'Install exposure Homebrew initial live targets',
  );
  assertDeepEqualJson(
    homebrew.forbidden_formulae,
    ['one-person-lab-modules', 'one-person-lab-modules-nightly'],
    'Install exposure Homebrew forbidden formulae',
  );
  if (
    homebrew.agent_pack_policy?.homebrew_distribution_allowed !== false ||
    homebrew.agent_pack_policy?.user_visible_formula_allowed !== false ||
    homebrew.agent_pack_policy?.activation_policy !== 'app_cli_managed_background_maintenance'
  ) {
    throw new Error('Install exposure Homebrew agent-pack policy must keep agent packs under App/CLI maintenance');
  }
  assertIncludesAll(
    homebrew.agent_pack_policy?.managed_agent_ids,
    ['mas', 'mag', 'rca', 'oma'],
    'Install exposure Homebrew managed agent ids',
  );
  assertIncludesAll(
    homebrew.agent_pack_policy?.maintenance_commands,
    ['opl connect reconcile-modules', 'opl connect sync-skills'],
    'Install exposure Homebrew agent maintenance commands',
  );
}

function validateManagedAgentPackDistribution(modulePackageDistribution) {
  if (
    modulePackageDistribution?.channel_id !== 'opl_distribution_cohort' ||
    modulePackageDistribution?.default_transport !== 'app_cli_managed_background_maintenance' ||
    modulePackageDistribution?.default_update_mode !== 'silent_background' ||
    modulePackageDistribution?.default_manifest_tag !== 'latest' ||
    modulePackageDistribution?.homebrew_distribution_allowed !== false ||
    modulePackageDistribution?.homebrew_formula_allowed !== false ||
    modulePackageDistribution?.must_not_write_user_codex_state !== true ||
    modulePackageDistribution?.must_not_define_agent_semantics !== true ||
    modulePackageDistribution?.cohort_manifest_required !== true
  ) {
    throw new Error('Install exposure managed agent-pack distribution must use an App/CLI-managed OPL distribution cohort');
  }
  assertIncludesAll(
    modulePackageDistribution.post_update_sync_required,
    ['codex_plugin_registry', 'plugin_packaged_skills', 'opl_generated_plugin_surface'],
    'Install exposure module package distribution post-update sync requirements',
  );
  assertIncludesAll(
    modulePackageDistribution.package_agent_ids,
    ['mas', 'mag', 'rca', 'oma'],
    'Install exposure module package distribution agent ids',
  );
  assertIncludesAll(
    modulePackageDistribution.activation_commands,
    ['opl connect reconcile-modules', 'opl connect sync-skills'],
    'Install exposure module package distribution activation commands',
  );
  assertDeepEqualJson(
    modulePackageDistribution.fallback_source_order,
    [
      'bundled_full_runtime_modules',
      'app_cli_managed_ghcr_agent_package_channel',
      'explicit_developer_checkout_override',
    ],
    'Install exposure module package distribution fallback source order',
  );
  if (
    modulePackageDistribution.must_not_depend_on_fixed_version_tag_by_default !== true ||
    modulePackageDistribution.github_packages_unavailable_policy !== 'fail_closed_with_actionable_background_maintenance_error'
  ) {
    throw new Error('Install exposure managed agent-pack distribution must fail closed when GitHub Packages is unavailable');
  }
  assertDeepEqualJson(
    modulePackageDistribution.forbidden_homebrew_formulae,
    ['one-person-lab-modules', 'one-person-lab-modules-nightly'],
    'Install exposure managed agent-pack forbidden Homebrew formulae',
  );
}

function validateReleaseValidation(validation) {
  if (validation?.structural_gate !== 'node --experimental-strip-types scripts/validate-active-shell.ts --quick') {
    throw new Error('Install exposure release validation structural gate must be validate-active-shell --quick');
  }
  for (const gate of [
    'standard_dmg_clean_vm_smoke',
    'homebrew_standard_cask_clean_vm_smoke',
    'full_dmg_clean_vm_smoke',
    'one_shot_app_installer_fresh_install_smoke',
    'docker_webui_smoke',
  ]) {
    if (!validation.stable_install_gates?.includes(gate)) {
      throw new Error(`Install exposure stable install gates must include ${gate}`);
    }
  }
}
