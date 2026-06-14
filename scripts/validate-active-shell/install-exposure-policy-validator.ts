import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  defaultCompanionSkillSyncIds,
  firstConversationFailurePolicy,
  firstConversationMustWaitFor,
  firstRunCoreItems,
  firstRunProgressSourceCommand,
  firstRunProgressSourcePath,
  forbiddenAuthorityOwners,
  fullReadinessItems,
  temporalLocalServiceDefaults,
  temporalManagedCommands,
} from './app-contract-constants.ts';
import { expectedDomainExposureEntryMap } from './domain-exposure-validator.ts';

export function validateInstallExposurePolicy(policy) {
  if (policy.owner !== 'one-person-lab-app') {
    throw new Error(`Unexpected install exposure policy owner: ${policy.owner}`);
  }
  if (policy.purpose !== 'app_install_exposure_policy') {
    throw new Error(`Unexpected install exposure policy purpose: ${policy.purpose}`);
  }
  if (policy.state !== 'active') {
    throw new Error(`Unexpected install exposure policy state: ${policy.state}`);
  }
  if (policy.producer_owner !== 'one-person-lab') {
    throw new Error(`Unexpected install exposure producer owner: ${policy.producer_owner}`);
  }
  if (policy.product_authority?.source_of_truth !== 'one-person-lab-app') {
    throw new Error('Install exposure policy source of truth must be one-person-lab-app');
  }
  for (const forbidden of forbiddenAuthorityOwners) {
    if (!policy.product_authority?.forbidden_authority?.includes(forbidden)) {
      throw new Error(`Install exposure policy must exclude ${forbidden}`);
    }
  }

  const canonical = policy.canonical_metadata_sources;
  if (canonical?.owner !== 'one-person-lab') {
    throw new Error('Install exposure canonical metadata owner must be one-person-lab');
  }
  if (canonical.domain_owner !== 'foundry_agent_repositories') {
    throw new Error('Install exposure canonical metadata domain owner must be foundry_agent_repositories');
  }
  for (const source of ['family_action_catalog', 'family_stage_control_plane', 'family-product-entry-manifest-v2']) {
    if (!canonical.sources?.includes(source)) {
      throw new Error(`Install exposure canonical metadata sources must include ${source}`);
    }
  }
  for (const surface of ['cli', 'mcp', 'skill', 'product_entry', 'product_status', 'product_session', 'domain_action_adapter', 'workbench']) {
    if (!canonical.derived_surfaces?.includes(surface)) {
      throw new Error(`Install exposure canonical metadata derived surfaces must include ${surface}`);
    }
  }

  const abi = policy.public_abi;
  for (const [field, expected] of Object.entries({
    primary_semantic_entry: 'skill',
    skill_role: 'public_codex_semantic_entry_and_prompt_contract',
    plugin_role: 'codex_app_distribution_and_capability_bundle',
    command_contract_role: 'machine_readable_action_and_stage_contract_under_the_skill',
    product_entry_role: 'domain_owned_product_entry_manifest_and_session_surface',
  })) {
    if (abi?.[field] !== expected) {
      throw new Error(`Install exposure public_abi.${field} must be ${expected}`);
    }
  }
  for (const [field, expected] of Object.entries({
    direct_skill_compatibility_required: true,
    plugin_may_package_skill: true,
    plugin_must_not_create_second_semantics: true,
    app_must_not_require_plugin_for_cli_semantics: true,
    app_must_not_mirror_plugin_skill_as_duplicate_bare_skill: true,
  })) {
    if (abi?.[field] !== expected) {
      throw new Error(`Install exposure public_abi.${field} must be ${expected}`);
    }
  }

  const exposureClassById = new Map((policy.exposure_classes ?? []).map((entry) => [entry.id, entry]));
  const domainPluginClass = exposureClassById.get('family_domain_plugin_surfaces');
  if (domainPluginClass?.sync_target !== 'codex_plugin_registry') {
    throw new Error('Install exposure domain plugin class must sync to codex_plugin_registry');
  }
  assertIncludesAll(
    domainPluginClass?.members,
    ['mas', 'mag', 'rca'],
    'Install exposure domain plugin members',
  );
  for (const forbiddenMirror of ['~/.codex/skills/mas', '~/.codex/skills/mag', '~/.codex/skills/rca']) {
    if (!domainPluginClass.must_not_sync_to?.includes(forbiddenMirror)) {
      throw new Error(`Install exposure domain plugin class must forbid ${forbiddenMirror}`);
    }
  }
  const generatedClass = exposureClassById.get('opl_generated_plugin_surfaces');
  if (generatedClass?.sync_target !== 'opl_generated_codex_plugin_surface' || !generatedClass?.members?.includes('opl-meta-agent')) {
    throw new Error('Install exposure generated class must route OPL Meta Agent through OPL-generated local Codex plugin surface');
  }
  const companionClass = exposureClassById.get('companion_skill_sync');
  if (companionClass?.sync_target !== 'codex_user_skill_discovery_path') {
    throw new Error('Install exposure companion skill class must sync to Codex user skill discovery path');
  }
  assertIncludesAll(
    companionClass?.members,
    defaultCompanionSkillSyncIds,
    'Install exposure companion skill members',
  );
  for (const forbiddenDomain of ['mas', 'mag', 'rca']) {
    if (companionClass.members?.includes(forbiddenDomain)) {
      throw new Error(`Install exposure companion skill class must not include domain plugin ${forbiddenDomain}`);
    }
  }
  const packagedRuntimeClass = exposureClassById.get('packaged_full_runtime_payloads');
  if (packagedRuntimeClass?.owner !== 'one-person-lab-app') {
    throw new Error('Install exposure packaged Full runtime payloads must stay App-owned');
  }
  if (!packagedRuntimeClass?.must_not_sync_to?.includes('implicit_user_codex_skill_install_without_managed_sync')) {
    throw new Error('Install exposure packaged Full runtime payloads must not imply user skill install without managed sync');
  }

  const expectedDomainExposures = expectedDomainExposureEntryMap(
    policy.domain_exposure,
    (domainId) => `Install exposure policy missing domain ${domainId}`,
  );
  for (const { expected, entry } of expectedDomainExposures) {
    for (const [field, expectedValue] of Object.entries(expected)) {
      if (entry[field] !== expectedValue) {
        throw new Error(`Install exposure domain ${expected.domain_id}.${field} must be ${expectedValue}`);
      }
    }
    if (entry.direct_skill_semantics_required !== true) {
      throw new Error(`Install exposure domain ${expected.domain_id} must require direct skill semantics`);
    }
  }
  for (const domainId of ['mas', 'mag', 'rca']) {
    if (expectedDomainExposures.find(({ expected }) => expected.domain_id === domainId)?.entry.default_home_visible !== true) {
      throw new Error(`Install exposure domain ${domainId} must be visible on the default home path`);
    }
  }
  if (expectedDomainExposures.find(({ expected }) => expected.domain_id === 'oma')?.entry.default_home_visible !== false) {
    throw new Error('Install exposure policy must keep OMA out of the default home path');
  }

  const installerSurfaces = new Map((policy.installer_surfaces ?? []).map((entry) => [entry.surface, entry]));
  for (const surface of ['app_first_run', 'full_first_install_dmg', 'standard_dmg', 'one_shot_cli_installer', 'docker_webui']) {
    const entry = installerSurfaces.get(surface);
    if (!entry) {
      throw new Error(`Install exposure policy missing installer surface ${surface}`);
    }
    if (entry.progress_source !== firstRunProgressSourceCommand) {
      throw new Error(`Install exposure surface ${surface} must use ${firstRunProgressSourceCommand}`);
    }
  }
  if (installerSurfaces.get('app_first_run')?.exposure_policy !== 'hide_skill_plugin_packaging_mechanics_by_default') {
    throw new Error('App first-run install exposure must hide skill/plugin packaging mechanics by default');
  }

  const presentation = policy.first_run_user_presentation;
  if (presentation?.default_mode !== 'beginner_first') {
    throw new Error('Install exposure first-run presentation must be beginner_first');
  }
  if (presentation.skill_plugin_distinction_visible_by_default !== false) {
    throw new Error('Install exposure first-run presentation must hide skill/plugin distinction by default');
  }
  assertIncludesAll(
    presentation.primary_steps,
    firstRunCoreItems,
    'Install exposure first-run primary steps',
  );
  assertIncludesAll(
    presentation.secondary_steps,
    fullReadinessItems,
    'Install exposure first-run secondary steps',
  );
  if (presentation.technical_detail_policy !== 'hidden_until_expanded_or_error') {
    throw new Error('Install exposure technical details must be hidden until expanded or error');
  }

  const setupFlow = policy.setup_flow_contract;
  if (setupFlow?.source_command !== firstRunProgressSourceCommand) {
    throw new Error('Install exposure setup flow must use opl system initialize --json');
  }
  if (setupFlow?.source_path !== firstRunProgressSourcePath) {
    throw new Error('Install exposure setup flow must read system_initialize.setup_flow');
  }
  if (setupFlow?.truth_policy !== 'all_installers_and_renderers_derive_progress_from_the_shared_initialize_model') {
    throw new Error('Install exposure setup flow must forbid separate installer progress truth');
  }
  if (setupFlow.ready_to_launch_gate !== 'ready_to_launch') {
    throw new Error('Install exposure setup flow must use ready_to_launch gate');
  }
  assertIncludesAll(
    setupFlow.ready_to_launch_required_core_items,
    firstRunCoreItems,
    'Install exposure ready_to_launch core items',
  );
  assertIncludesAll(
    setupFlow.full_readiness_non_blocking_items,
    fullReadinessItems,
    'Install exposure full readiness non-blocking items',
  );
  const firstConversation = setupFlow.first_conversation_readiness;
  if (
    firstConversation?.gate !== 'acp_warmup_before_initial_send' ||
    firstConversation?.source_command !== firstRunProgressSourceCommand ||
    firstConversation?.ready_to_launch_must_be_true !== true ||
    firstConversation?.failure_policy !== firstConversationFailurePolicy
  ) {
    throw new Error('Install exposure first conversation readiness must gate initial send on ready_to_launch and ACP warmup');
  }
  assertIncludesAll(
    firstConversation.must_wait_for,
    firstConversationMustWaitFor,
    'Install exposure first conversation wait-for items',
  );
  assertIncludesAll(
    firstConversation.must_not_wait_for,
    fullReadinessItems,
    'Install exposure first conversation non-blocking readiness items',
  );

  const temporalAutoConfig = policy.temporal_auto_configuration;
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

  const sync = policy.sync_and_install_contract;
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

  const runtimeUpdate = policy.runtime_toolchain_auto_update;
  if (
    runtimeUpdate?.owner !== 'one-person-lab-app' ||
    runtimeUpdate?.producer_owner !== 'one-person-lab' ||
    runtimeUpdate?.framework_role !== 'apply_verified_staged_runtime_during_startup_maintenance' ||
    runtimeUpdate?.entrypoint !== 'opl system startup-maintenance' ||
    runtimeUpdate?.ready_to_launch_blocking !== false ||
    runtimeUpdate?.default_policy?.auto_check !== true ||
    runtimeUpdate?.default_policy?.download !== 'silent_background' ||
    runtimeUpdate?.default_policy?.stage !== 'verify_then_stage_app_owned_runtime' ||
    runtimeUpdate?.default_policy?.apply !== 'next_app_restart' ||
    runtimeUpdate?.default_policy?.rollback !== 'previous_runtime_pointer_on_startup_smoke_failure'
  ) {
    throw new Error('Install exposure runtime/toolchain auto update must be App-owned, silent, staged, and applied through startup maintenance');
  }
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
  if (
    runtimeUpdate.user_global_tool_policy?.prefer_compatible_newer_system_tool !== true ||
    runtimeUpdate.user_global_tool_policy?.silent_homebrew_upgrade_allowed !== false ||
    runtimeUpdate.user_global_tool_policy?.silent_system_tool_mutation_allowed !== false ||
    runtimeUpdate.user_global_tool_policy?.opt_in_global_upgrade_surface !== 'Developer Profile explicit maintenance action'
  ) {
    throw new Error('Install exposure runtime/toolchain auto update must not silently mutate Homebrew or system tools');
  }
  if (
    runtimeUpdate.clean_machine_requirement?.full_first_install_must_remain_self_contained !== true ||
    runtimeUpdate.clean_machine_requirement?.required_release_smoke !== 'full_dmg_clean_vm_smoke' ||
    runtimeUpdate.clean_machine_requirement?.standard_core_ready_must_not_require_homebrew_node_git_or_clt !== true
  ) {
    throw new Error('Install exposure runtime/toolchain auto update must preserve clean-machine installability');
  }
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

  const homebrew = policy.distribution_channels?.homebrew;
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

  const modulePackageDistribution = policy.agent_installation_contract?.managed_agent_pack_distribution;
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

  const validation = policy.release_validation;
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
