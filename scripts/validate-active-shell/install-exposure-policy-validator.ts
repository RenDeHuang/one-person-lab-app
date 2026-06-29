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
  if (dockerWebui?.entrypoint !== 'Docker/WebUI one-click installer') {
    throw new Error('Docker/WebUI install exposure must make the one-click installer the entrypoint');
  }
  if (dockerWebui.exposure_policy !== 'one_click_installer_is_beginner_default_with_manual_docker_as_advanced_troubleshooting_path') {
    throw new Error('Docker/WebUI install exposure must keep manual Docker commands as the advanced troubleshooting path');
  }
  if (dockerWebui.installer_model?.primary_user_path !== 'one_click_installer') {
    throw new Error('Docker/WebUI install exposure must declare one-click installer as the primary user path');
  }
  if (dockerWebui.installer_model?.linux_macos_shell_script !== 'install-docker-webui.sh') {
    throw new Error('Docker/WebUI install exposure must declare the Linux/macOS shell installer script artifact');
  }
  if (dockerWebui.installer_model?.windows_powershell_script !== 'install-docker-webui.ps1') {
    throw new Error('Docker/WebUI install exposure must declare the Windows PowerShell installer script artifact');
  }
  if (!dockerWebui.installer_model?.linux_macos_online_command?.includes('raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/scripts/install-docker-webui.sh')) {
    throw new Error('Docker/WebUI install exposure must declare the Linux/macOS online one-click command');
  }
  if (dockerWebui.installer_model?.windows_online_command !== 'download install-docker-webui.ps1 from raw.githubusercontent.com and run with -Yes') {
    throw new Error('Docker/WebUI install exposure must declare the Windows online one-click command model');
  }
  if (dockerWebui.installer_model?.windows_prerequisite_mode !== 'explicit_install_prerequisites_switch_requires_administrator') {
    throw new Error('Docker/WebUI install exposure must keep Windows Docker/WSL2 installation behind an explicit administrator prerequisite switch');
  }
  if (dockerWebui.installer_model?.compose_file !== 'compose.yaml') {
    throw new Error('Docker/WebUI install exposure must declare compose.yaml as the one-click installer compose artifact');
  }
  assertIncludesAll(
    dockerWebui.installer_model?.persistent_host_dirs,
    ['OnePersonLab/data', 'OnePersonLab/projects'],
    'Docker/WebUI persistent host dirs',
  );
  if (dockerWebui.installer_model?.container_mounts?.data !== '/data') {
    throw new Error('Docker/WebUI install exposure must map host data dir to /data');
  }
  if (dockerWebui.installer_model?.container_mounts?.projects !== '/projects') {
    throw new Error('Docker/WebUI install exposure must map host projects dir to /projects');
  }
  if (dockerWebui.installer_model?.api_key_policy !== 'never_pass_api_key_on_cli_or_environment_for_beginner_path') {
    throw new Error('Docker/WebUI install exposure must forbid API keys in beginner CLI/env installer inputs');
  }
  if (dockerWebui.installer_model?.api_key_entry_surface !== 'browser_webui_first_run_access_panel_or_settings_access') {
    throw new Error('Docker/WebUI install exposure must make WebUI the first API key entry surface');
  }
  if (dockerWebui.installer_model?.manual_docker_fallback !== 'advanced_troubleshooting_path_only') {
    throw new Error('Docker/WebUI install exposure must keep manual Docker as an advanced fallback only');
  }
  assertIncludesAll(
    dockerWebui.installer_model?.manual_fallback_forms,
    ['docker run', 'docker compose'],
    'Docker/WebUI manual fallback forms',
  );
  if (dockerWebui?.runtime_distribution_model?.container_role !== 'preheated_webui_runtime_image') {
    throw new Error('Docker/WebUI install exposure must declare the preheated WebUI runtime image model');
  }
  if (dockerWebui.runtime_distribution_model?.persistent_data_dir !== '/data') {
    throw new Error('Docker/WebUI install exposure must keep /data as the persistent data directory');
  }
  if (dockerWebui.runtime_distribution_model?.persistent_projects_dir !== '/projects') {
    throw new Error('Docker/WebUI install exposure must keep /projects as the persistent projects directory');
  }
  if (dockerWebui.runtime_distribution_model?.default_profile !== 'webui_full') {
    throw new Error('Docker/WebUI install exposure must make webui_full the beginner default profile');
  }
  if (dockerWebui.runtime_distribution_model?.stable_latest_policy !== 'latest_and_stable_must_point_to_webui_full_not_metadata_only_slim') {
    throw new Error('Docker/WebUI install exposure must forbid metadata-only slim images for stable/latest');
  }
  if (dockerWebui.runtime_distribution_model?.required_image_manifest !== '/opt/opl/image-manifest.json') {
    throw new Error('Docker/WebUI install exposure must require the canonical /opt/opl image manifest');
  }
  if (dockerWebui.runtime_distribution_model?.required_seed_metadata !== '/opt/opl/seed/metadata.json') {
    throw new Error('Docker/WebUI install exposure must require the canonical /opt/opl seed metadata');
  }
  assertIncludesAll(
    dockerWebui.runtime_distribution_model?.required_full_seed_components,
    ['opl_framework', 'codex_cli', 'companion_skills', 'domain_modules'],
    'Docker/WebUI full seed components',
  );
  for (const surface of ['opl system startup-maintenance --json', 'opl update status --json']) {
    if (!dockerWebui.runtime_distribution_model?.status_surfaces?.includes(surface)) {
      throw new Error(`Docker/WebUI install exposure must include status surface ${surface}`);
    }
  }
  validateDockerWebuiSmokeGateContract(dockerWebui.smoke_gate_contract);
}

function validateDockerWebuiSmokeGateContract(contract) {
  if (contract?.status !== 'required_manual_or_workflow_gate_not_live_evidence') {
    throw new Error('Docker/WebUI smoke gate contract must not claim live evidence from docs/contracts alone');
  }
  if (contract.release_readiness_policy !== 'must_not_claim_release_ready_until_required_smoke_gates_have_fresh_artifacts_or_typed_blockers') {
    throw new Error('Docker/WebUI smoke gate contract must block release-ready claims until required smoke evidence or typed blockers exist');
  }
  if (contract.workflow_artifact !== 'docker-webui-smoke-gate-contract.json') {
    throw new Error('Docker/WebUI smoke gate contract must declare the workflow contract artifact');
  }
  assertIncludesAll(
    contract.diagnostic_bundle_artifacts,
    [
      'compose.yaml',
      'docker ps',
      'docker logs',
      'http_health_readback',
      'auth_user_readback',
      'install_manifest_readback',
      'projects_mount_readback',
    ],
    'Docker/WebUI smoke diagnostic bundle artifacts',
  );
  assertIncludesAll(
    contract.health_check_surfaces,
    [
      'http://localhost:3000/',
      'http://localhost:3000/manifest.webmanifest',
      'http://localhost:3000/api/auth/user',
      'OnePersonLab/data/opl/state/install-manifest.json',
      'OnePersonLab/projects',
    ],
    'Docker/WebUI smoke health check surfaces',
  );
  const gateById = new Map((contract.required_gates ?? []).map((gate) => [gate.id, gate]));
  for (const gateId of ['clean_linux_vm', 'clean_windows_vm', 'existing_docker', 'existing_old_onepersonlab_data_dir']) {
    const gate = gateById.get(gateId);
    if (!gate) {
      throw new Error(`Docker/WebUI smoke gate contract missing required gate ${gateId}`);
    }
    if (!String(gate.execution_mode ?? '').includes('smoke')) {
      throw new Error(`Docker/WebUI smoke gate ${gateId} must declare a smoke execution mode`);
    }
    assertIncludesAll(
      gate.required_evidence,
      ['compose_yaml', 'container_logs', 'http_health_readback', 'install_manifest_readback'],
      `Docker/WebUI smoke gate ${gateId} evidence`,
    );
  }
  if (gateById.get('clean_linux_vm')?.entrypoint !== 'install-docker-webui.sh --yes') {
    throw new Error('Docker/WebUI clean Linux VM gate must use the shell one-click installer');
  }
  if (gateById.get('clean_windows_vm')?.entrypoint !== 'install-docker-webui.ps1 -Yes') {
    throw new Error('Docker/WebUI clean Windows VM gate must use the PowerShell one-click installer');
  }
  if (gateById.get('existing_docker')?.docker_state !== 'existing_docker_must_be_reused_not_reinstalled') {
    throw new Error('Docker/WebUI existing Docker gate must require reusing existing Docker');
  }
  if (gateById.get('existing_old_onepersonlab_data_dir')?.data_state !== 'existing_OnePersonLab_data_dir_must_be_preserved_or_migrated_without_delete') {
    throw new Error('Docker/WebUI old data dir gate must require preserve-or-migrate behavior');
  }
  if (
    contract.false_ready_boundary?.docs_or_contract_only_can_claim_release_ready !== false ||
    contract.false_ready_boundary?.local_container_smoke_can_replace_clean_vm_smoke !== false ||
    contract.false_ready_boundary?.missing_gate_must_be_typed_blocker !== true
  ) {
    throw new Error('Docker/WebUI smoke gate false-ready boundary must forbid release-ready claims without fresh gate evidence');
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
