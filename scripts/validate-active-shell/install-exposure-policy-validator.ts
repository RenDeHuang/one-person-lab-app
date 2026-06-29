import { assertIncludesAll } from './assertions.ts';
import {
  defaultCompanionSkillSyncIds,
  firstConversationFailurePolicy,
  firstConversationMustWaitFor,
  firstRunCoreItems,
  firstRunProgressSourceCommand,
  firstRunProgressSourcePath,
  forbiddenAuthorityOwners,
  fullReadinessItems,
} from './app-contract-constants.ts';
import { expectedDomainExposureEntryMap } from './domain-exposure-validator.ts';
import { validateInstallExposureRuntimeAndDistribution } from './install-exposure-runtime-distribution-validator.ts';

function validateInstallExposureHeader(policy) {
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
}

function validateCanonicalMetadataSources(canonical) {
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
}

function validatePublicAbi(abi) {
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
}

function validateExposureClasses(policy) {
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
}

function validateDomainExposure(policy) {
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
}

function validateInstallerSurfaces(policy) {
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
  const dockerWebui = installerSurfaces.get('docker_webui');
  if (dockerWebui?.runtime_distribution_model?.container_role !== 'preheated_webui_runtime_image') {
    throw new Error('Docker/WebUI install exposure must declare the preheated WebUI runtime image model');
  }
  if (dockerWebui.runtime_distribution_model?.persistent_data_dir !== '/data') {
    throw new Error('Docker/WebUI install exposure must keep /data as the persistent data directory');
  }
  if (dockerWebui.runtime_distribution_model?.persistent_projects_dir !== '/projects') {
    throw new Error('Docker/WebUI install exposure must keep /projects as the persistent projects directory');
  }
  for (const surface of ['opl system startup-maintenance --json', 'opl update status --json']) {
    if (!dockerWebui.runtime_distribution_model?.status_surfaces?.includes(surface)) {
      throw new Error(`Docker/WebUI install exposure must include status surface ${surface}`);
    }
  }
}

function validateFirstRunUserPresentation(presentation) {
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
}

function validateSetupFlowContract(setupFlow) {
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
}

export function validateInstallExposurePolicy(policy) {
  validateInstallExposureHeader(policy);
  validateCanonicalMetadataSources(policy.canonical_metadata_sources);
  validatePublicAbi(policy.public_abi);
  validateExposureClasses(policy);
  validateDomainExposure(policy);
  validateInstallerSurfaces(policy);
  validateFirstRunUserPresentation(policy.first_run_user_presentation);
  validateSetupFlowContract(policy.setup_flow_contract);

  validateInstallExposureRuntimeAndDistribution(policy);
}
