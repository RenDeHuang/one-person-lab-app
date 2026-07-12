import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { temporalLocalServiceDefaults, temporalManagedCommands } from './app-contract-constants.ts';
import { managedOplPackageIds, managedOplPackageKinds, oplFlowPackagePolicy } from './managed-update-plane-policy.ts';

export function validateInstallExposureRuntimeAndDistribution(policy) {
  validateSoftwareLifecycle(policy.software_lifecycle);
  validateTemporalAutoConfiguration(policy.temporal_auto_configuration);
  validateSyncAndInstallContract(policy.sync_and_install_contract);
  validateHomebrewDistribution(policy.distribution_channels?.homebrew);
  validateManagedAgentPackDistribution(policy.agent_installation_contract?.managed_agent_pack_distribution);
  validateReleaseValidation(policy.release_validation);
}

function validateSoftwareLifecycle(lifecycle) {
  assertDeepEqualJson(lifecycle?.public_objects, ['opl_base', 'opl_app', 'opl_packages'], 'Install exposure public software objects');
  assertDeepEqualJson(lifecycle?.lifecycle_owners, {
    opl_base: 'one-person-lab',
    opl_app: 'one-person-lab-app',
    opl_packages: 'one-person-lab',
  }, 'Install exposure lifecycle owners');
  assertDeepEqualJson(lifecycle?.app_mutation_scope, ['opl_app'], 'Install exposure App mutation scope');
  assertDeepEqualJson(lifecycle?.app_projection_scope, ['opl_base', 'opl_packages'], 'Install exposure App projection scope');
  assertDeepEqualJson(lifecycle?.transaction_internal_states, {
    opl_base: ['runtime_substrate', 'companion_tools'],
    opl_packages: ['capability_packages', 'codex_surface', 'workflow_profile'],
  }, 'Install exposure transaction internal states');
  if (
    lifecycle?.schema !== 'opl_software_lifecycle.v1' ||
    lifecycle?.ordinary_component_picker_allowed !== false ||
    lifecycle?.legacy_component_mapping_allowed !== false ||
    lifecycle?.packages_carrier_allowed !== false
  ) {
    throw new Error('Install exposure must use the three-object software lifecycle without legacy mappings or a component picker');
  }
  if (
    lifecycle?.base_bootstrap?.bootstrap_route !== 'opl-install.sh --headless --skip-modules' ||
    lifecycle?.base_bootstrap?.executor_owner !== 'one-person-lab' ||
    lifecycle?.base_bootstrap?.mutation_owner !== 'one-person-lab' ||
    lifecycle?.base_bootstrap?.receipt_owner !== 'one-person-lab' ||
    lifecycle?.base_bootstrap?.app_role !== 'request_progress_and_receipt_projection_only' ||
    lifecycle?.base_bootstrap?.app_must_not_implement_installer !== true
  ) {
    throw new Error('Install exposure missing OPL Base bootstrap must stay Framework-owned and App-requested');
  }
  const adapters = lifecycle?.carrier_adapters ?? {};
  for (const id of ['homebrew_formula', 'framework_installer']) {
    if (adapters[id]?.carries !== 'opl_base' || adapters[id]?.lifecycle_owner !== 'one-person-lab') {
      throw new Error(`Install exposure ${id} must be a Framework-owned OPL Base carrier`);
    }
  }
  for (const id of ['homebrew_cask', 'signed_installer_or_dmg']) {
    if (adapters[id]?.carries !== 'opl_app' || adapters[id]?.lifecycle_owner !== 'one-person-lab-app') {
      throw new Error(`Install exposure ${id} must be an App-owned OPL App carrier`);
    }
  }
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
  if (
    sync.base_and_package_mutation_owner !== 'one-person-lab' ||
    sync.app_role !== 'request_status_progress_and_receipt_projection_only' ||
    sync.companion_skill_management !== 'framework_transaction_internal_post_apply_state' ||
    sync.codex_surface_management !== 'framework_package_transaction_internal_post_apply_state' ||
    sync.workflow_profile_management !== 'framework_package_transaction_internal_semantic_merge_state'
  ) {
    throw new Error('Install exposure sync contract must keep Base and Packages mutation in Framework transactions');
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

function validateHomebrewDistribution(homebrew) {
  validateHomebrewTransportBoundary(homebrew);
  validateFrameworkCoreCarrier(homebrew);
  validateHomebrewCaskNames(homebrew);
  validateHomebrewUserTargets(homebrew);
  validateHomebrewAgentPackPolicy(homebrew);
}

function validateFrameworkCoreCarrier(homebrew) {
  const carrier = homebrew?.framework_core_carrier;
  if (
    carrier?.component !== 'opl_framework' ||
    carrier?.selection_policy !== 'developer_mode_then_install_origin_and_formula_availability_then_compatibility_handshake'
  ) {
    throw new Error('Install exposure OPL Framework carrier must select developer mode or install-origin carrier before compatibility handshake');
  }
  assertDeepEqualJson(
    homebrew.formulae,
    { framework_core: 'opl' },
    'Install exposure Homebrew Framework formula carrier',
  );
  assertDeepEqualJson(
    carrier.locator_precedence,
    [
      {
        install_origin: 'explicit_developer_mode',
        carrier: 'developer_checkout',
        locator: '<selected-workspace>/one-person-lab',
      },
      {
        install_origin: 'homebrew_cask',
        carrier: 'system_homebrew_formula',
        formula: 'opl',
        locator: '/opt/homebrew/bin/opl or /usr/local/bin/opl',
        origin_evidence: 'Homebrew Caskroom receipt',
      },
      {
        install_origin: 'dmg_or_direct_download',
        carrier: 'framework_managed_install',
        locator: '~/.opl/one-person-lab',
        installer: 'opl-install.sh --headless --skip-modules',
      },
    ],
    'Install exposure OPL Framework locator precedence',
  );
  assertDeepEqualJson(
    carrier.pre_formula_transition,
    {
      allowed: true,
      condition: 'homebrew_cask_receipt_present_and_formula_absent',
      carrier: 'framework_managed_install',
      locator: '~/.opl/one-person-lab',
      installer: 'opl-install.sh --headless --skip-modules',
      selection_status: 'pre_formula_transition',
      must_end_when_formula_available: true,
      incompatible_formula_must_not_fallback: true,
      creates_second_framework_semantics: false,
    },
    'Install exposure OPL Framework pre-Formula transition',
  );
  assertDeepEqualJson(
    carrier.compatibility_handshake,
    {
      required_before_activation: true,
      producer_owner: 'one-person-lab',
      app_requirement_owner: 'one-person-lab-app',
      required_package_name: 'opl-framework',
      fail_closed_on_missing_or_incompatible: true,
      receipt_fields: [
        'selected_carrier',
        'framework_version',
        'framework_api_version',
        'app_required_api_range',
        'compatibility_status',
        'selection_status',
        'active_framework_count',
      ],
    },
    'Install exposure OPL Framework compatibility handshake',
  );
  assertDeepEqualJson(
    carrier.activation_invariants,
    {
      active_framework_count: 1,
      dual_runtime_allowed: false,
      split_brain_allowed: false,
      second_framework_fallback_may_activate: false,
    },
    'Install exposure OPL Framework activation invariants',
  );
  assertDeepEqualJson(
    carrier.release_authority,
    {
      app_carrier_release_truth_owner: 'one-person-lab-app',
      opl_base_release_truth_owner: 'one-person-lab',
      app_release_must_not_publish_or_promote_opl_base: true,
    },
    'Install exposure OPL Framework release authority',
  );
}

function validateHomebrewTransportBoundary(homebrew) {
  if (
    homebrew?.role !== 'app_cask_and_framework_formula_install_index' ||
    homebrew?.tap !== 'gaofeng21cn/one-person-lab' ||
    homebrew?.must_not_own_agent_semantics !== true ||
    homebrew?.must_not_write_user_codex_state !== true ||
    homebrew?.user_state_activation_owner !== 'opl_framework'
  ) {
    throw new Error('Install exposure Homebrew distribution must index only App casks and the Framework formula, and delegate activation to OPL Framework');
  }
  assertDeepEqualJson(homebrew.carrier_adapter_semantics, {
    formula: {
      object: 'opl_base',
      formula: 'opl',
      lifecycle_owner: 'one-person-lab',
      packages_allowed: false,
    },
    cask: {
      object: 'opl_app',
      lifecycle_owner: 'one-person-lab-app',
      base_or_packages_mutation_allowed: false,
    },
    equivalent_direct_carriers: {
      opl_base: 'framework_installer',
      opl_app: 'signed_installer_or_dmg',
    },
  }, 'Install exposure Homebrew carrier adapter semantics');
  assertIncludesAll(
    homebrew.activation_commands,
    ['opl connect reconcile-modules', 'opl connect sync-skills'],
    'Install exposure Homebrew activation commands',
  );
}

function validateHomebrewCaskNames(homebrew) {
  if (
    homebrew.casks?.standard_app !== 'one-person-lab' ||
    homebrew.casks?.nightly_standard_app !== 'one-person-lab-nightly' ||
    homebrew.casks?.full_first_install_app !== 'one-person-lab-full' ||
    homebrew.full_first_install_cask?.name !== 'one-person-lab-full' ||
    homebrew.full_first_install_cask?.standard_updater_visible !== false
  ) {
    throw new Error('Install exposure Homebrew cask names must match the App-only distribution channel contract');
  }
}

function validateHomebrewUserTargets(homebrew) {
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
}

function validateHomebrewAgentPackPolicy(homebrew) {
  assertDeepEqualJson(homebrew.opl_packages_boundary, {
    lifecycle_owner: 'one-person-lab',
    app_role: 'status_action_and_receipt_projection_only',
    canonical_lifecycle: 'opl packages',
    homebrew_distribution_allowed: false,
    homebrew_formula_allowed: false,
    ordinary_component_picker_allowed: false,
  }, 'Install exposure Homebrew OPL Packages boundary');
}

function validateManagedAgentPackDistribution(modulePackageDistribution) {
  if (
    modulePackageDistribution?.software_object !== 'opl_packages' ||
    modulePackageDistribution?.lifecycle_owner !== 'one-person-lab' ||
    modulePackageDistribution?.app_role !== 'request_status_progress_and_receipt_projection_only' ||
    modulePackageDistribution?.class !== 'capability_packages' ||
    modulePackageDistribution?.channel_id !== 'opl_agent_packages_rolling_latest' ||
    modulePackageDistribution?.default_transport !== 'framework_package_lifecycle' ||
    modulePackageDistribution?.default_update_mode !== 'automatic_apply_for_clean_managed_roots' ||
    modulePackageDistribution?.default_manifest_tag !== 'latest' ||
    modulePackageDistribution?.distribution_format !== 'ghcr_oci_artifact' ||
    modulePackageDistribution?.ordinary_user_channel_model !== 'rolling_latest_only' ||
    modulePackageDistribution?.publication_cadence !== 'daily_when_source_digest_changes' ||
    modulePackageDistribution?.digest_lock_required !== true ||
    modulePackageDistribution?.stable_or_nightly_user_channels_allowed !== false ||
    modulePackageDistribution?.homebrew_distribution_allowed !== false ||
    modulePackageDistribution?.homebrew_formula_allowed !== false ||
    modulePackageDistribution?.must_not_write_user_codex_state !== true ||
    modulePackageDistribution?.must_not_define_agent_semantics !== true ||
    modulePackageDistribution?.cohort_manifest_required !== true
  ) {
    throw new Error('Install exposure capability package internals must use the Framework-owned OPL Packages lifecycle');
  }
  assertIncludesAll(
    modulePackageDistribution.post_update_sync_required,
    ['codex_plugin_registry', 'plugin_packaged_skills', 'opl_generated_plugin_surface', 'codex_surface'],
    'Install exposure capability package distribution post-update sync requirements',
  );
  assertIncludesAll(
    modulePackageDistribution.package_agent_ids,
    ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-meta-agent', 'opl-bookforge', 'mas-scholar-skills'],
    'Install exposure capability package distribution agent ids',
  );
  assertDeepEqualJson(
    modulePackageDistribution.package_ids,
    managedOplPackageIds,
    'Install exposure capability package distribution package ids',
  );
  assertDeepEqualJson(
    modulePackageDistribution.package_kinds,
    managedOplPackageKinds,
    'Install exposure capability package distribution package kinds',
  );
  assertDeepEqualJson(
    modulePackageDistribution.opl_flow_package,
    oplFlowPackagePolicy,
    'Install exposure OPL Flow package policy',
  );
  assertIncludesAll(
    modulePackageDistribution.activation_commands,
    ['opl connect reconcile-modules', 'opl connect sync-skills'],
    'Install exposure capability package distribution activation commands',
  );
  assertDeepEqualJson(
    modulePackageDistribution.fallback_source_order,
    [
      'bundled_full_runtime_modules',
      'framework_managed_ghcr_oci_opl_packages_latest_channel',
      'explicit_developer_checkout_override',
    ],
    'Install exposure capability package distribution fallback source order',
  );
  if (
    modulePackageDistribution.must_not_depend_on_fixed_version_tag_by_default !== true ||
    modulePackageDistribution.github_packages_unavailable_policy !== 'fail_closed_with_actionable_background_maintenance_error'
  ) {
    throw new Error('Install exposure capability packages distribution must fail closed when GitHub Packages is unavailable');
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
