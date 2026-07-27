import { assertDeepEqualJson, assertIncludesAll, readJson } from './assertions.ts';
import {
  forbiddenAuthorityOwners,
} from './app-contract-constants.ts';
import { validateInstallExposureRuntimeAndDistribution } from './install-exposure-runtime-distribution-validator.ts';
import { assertFirstRunProgressModelShape, assertNonEmptyStringArray } from './shared-contract-validators.ts';
import { productProfilePath } from './validation-config.ts';

const productProfile = readJson(productProfilePath);
const expectedFirstRunProgressModel = productProfile.first_run?.progress_model;
const expectedFirstRunCoreItems = assertNonEmptyStringArray(
  productProfile.first_run?.ready_to_launch_gate?.required_core_items,
  'Product profile ready_to_launch required_core_items',
);
const expectedFirstConversation = productProfile.first_run?.first_conversation;
const expectedFirstConversationMustWaitFor = assertNonEmptyStringArray(
  expectedFirstConversation?.must_wait_for,
  'Product profile first conversation must_wait_for',
);
const expectedFirstConversationFailurePolicy = expectedFirstConversation?.failure_policy;
const expectedFullReadinessItems = (productProfile.first_run?.full_readiness_layers ?? [])
  .filter((item) => item !== 'core');
assertFirstRunProgressModelShape(expectedFirstRunProgressModel, 'Product profile first-run progress model');

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

function validateCapabilityGovernance(governance) {
  if (
    governance?.lifecycle_authority !== 'configured_carrier' ||
    governance?.lifecycle_surface !== 'configured_carrier_install_update_remove' ||
    governance?.app_role !== 'gui_and_framework_projection_consumer_only'
  ) {
    throw new Error('Install exposure capability governance must preserve the carrier -> Framework -> App projection boundary');
  }
  if (
    governance.managed_inventory?.source !== 'framework_unified_capability_projection' ||
    governance.managed_inventory?.app_second_inventory_allowed !== false ||
    governance.managed_inventory?.app_presentational_metadata_allowed !== true ||
    governance.managed_inventory?.unknown_user_and_third_party_surfaces !== 'preserve'
  ) {
    throw new Error('Install exposure capability governance must forbid an App-owned managed capability inventory');
  }
  if (
    governance.credential_policy?.credential_values_owner !== 'user_or_provider' ||
    governance.credential_policy?.full_may_bundle_secrets !== false ||
    governance.credential_policy?.migration_may_copy_credentials !== false ||
    governance.credential_policy?.flow_may_declare_requirements_only !== true ||
    governance.credential_policy?.existing_codex_config_detection !==
      'selected_provider_access_from_resolved_codex_config_toml' ||
    governance.credential_policy?.existing_usable_access_policy !==
      'reuse_without_reconfiguration_or_manual_key_input' ||
    governance.credential_policy?.explicit_api_key_command_role !==
      'new_or_rotated_provider_credential_only' ||
    governance.credential_policy?.configure_codex_package_lifecycle_mutation_allowed !== false ||
    governance.credential_policy?.package_reconciliation_requires_provider_configuration !== false ||
    governance.credential_policy?.package_reconciliation_surface !== 'configured_carrier_projected_actions'
  ) {
    throw new Error(
      'Install exposure capability governance must reuse existing Codex access and keep provider configuration separate from package lifecycle',
    );
  }
  if (
    governance.mcp_policy?.flow_managed_projection_group !== 'opl_flow_managed' ||
    governance.mcp_policy?.manual_and_third_party_projection_group !== 'user_or_third_party_managed' ||
    governance.mcp_policy?.undeclared_user_server_policy !== 'preserve' ||
    governance.mcp_policy?.undeclared_user_server_delete_or_overwrite_allowed !== false ||
    governance.mcp_policy?.default_managed_server_requires_owner_or_carrier_projection !== true
  ) {
    throw new Error('Install exposure MCP governance must preserve user surfaces and require owner or carrier projection');
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
  const domainPluginClass = exposureClassById.get('codex_surface');
  if (
    domainPluginClass?.sync_target !== 'framework_projected_configured_carrier' ||
    domainPluginClass?.software_object !== 'opl_packages' ||
    domainPluginClass?.visibility_scope !== 'package_capability_visibility_only_not_software_object' ||
    domainPluginClass?.member_source !== 'app_state.agent_packages.directory.entries[].capabilities[]' ||
    domainPluginClass?.presentation_source !== 'owner_package_presentation_descriptor' ||
    'members' in domainPluginClass
  ) {
    throw new Error('Install exposure Package capabilities must come from the dynamic Framework directory');
  }
  assertIncludesAll(
    domainPluginClass?.must_not_sync_to,
    ['app_owned_package_member_registry', 'duplicate_bare_skill_mirror', 'default_home_assistant_entry'],
    'Install exposure Package capability mirror prohibitions',
  );
  if (exposureClassById.has('opl_generated_plugin_surfaces')) {
    throw new Error('Install exposure policy must not restore a fixed OPL-generated Package registry');
  }
  if (exposureClassById.has('companion_tools_codex_skills')) {
    throw new Error('Install exposure policy must not duplicate the Framework managed Skill inventory');
  }
  const packagedRuntimeClass = exposureClassById.get('opl_base_payloads');
  if (
    packagedRuntimeClass?.owner !== 'one-person-lab' ||
    packagedRuntimeClass?.software_object !== 'opl_base' ||
    packagedRuntimeClass?.visibility_scope !== 'base_dependency_status_only_not_software_object'
  ) {
    throw new Error('Install exposure packaged runtime payloads must remain OPL Base dependency details');
  }
  assertIncludesAll(
    packagedRuntimeClass?.members,
    ['embedded_codex_executor', 'temporal_cli_archive', 'opl_framework_runtime', 'officecli', 'mineru_open_api'],
    'Install exposure OPL Base payload members',
  );
  if (!packagedRuntimeClass?.must_not_sync_to?.includes('implicit_user_codex_skill_install_without_managed_sync')) {
    throw new Error('Install exposure packaged Full runtime payloads must not imply user skill install without managed sync');
  }
}

function validateInstallerSurfaces(policy) {
  const installerSurfaces = new Map((policy.installer_surfaces ?? []).map((entry) => [entry.surface, entry]));
  const reconcileRef = 'contracts/app-release-channel.json#managed_update_plane.carrier_reconciliation';
  for (const entry of installerSurfaces.values()) {
    if (typeof entry.app_runtime_carrier !== 'boolean') {
      throw new Error(`Install exposure surface ${entry.surface} must classify whether it launches an App runtime carrier`);
    }
    if (entry.app_runtime_carrier && entry.post_launch_reconcile_ref !== reconcileRef) {
      throw new Error(`Install exposure App runtime surface ${entry.surface} must use carrier-neutral Framework reconciliation`);
    }
    if (!entry.app_runtime_carrier && entry.post_launch_reconcile_ref) {
      throw new Error(`Install exposure non-App surface ${entry.surface} must not declare App carrier reconciliation`);
    }
  }
  for (const surface of ['app_first_run', 'full_first_install_dmg', 'standard_dmg', 'one_shot_cli_installer', 'docker_webui']) {
    const entry = installerSurfaces.get(surface);
    if (!entry) {
      throw new Error(`Install exposure policy missing installer surface ${surface}`);
    }
    if (entry.progress_source !== expectedFirstRunProgressModel.source_command) {
      throw new Error(`Install exposure surface ${surface} must use ${expectedFirstRunProgressModel.source_command}`);
    }
  }
  if (installerSurfaces.get('app_first_run')?.exposure_policy !== 'hide_skill_plugin_packaging_mechanics_by_default') {
    throw new Error('App first-run install exposure must hide skill/plugin packaging mechanics by default');
  }
  const directMacos = installerSurfaces.get('stable_local_authorized_macos_install');
  if (
    directMacos?.entrypoint !== 'install.sh --stable-macos-install --yes'
    || directMacos?.release_quality_source !== 'exact_component_manifest'
    || directMacos?.latest_pointer_is_quality_independent !== true
    || directMacos?.non_stable_disclosure_before_target_mutation !== true
    || JSON.stringify(directMacos?.compatibility_entrypoints) !== JSON.stringify([])
    || JSON.stringify(directMacos?.retired_entrypoints) !== JSON.stringify(['install-stable.sh'])
    || Object.hasOwn(directMacos ?? {}, 'stable_release_path')
  ) {
    throw new Error('Direct macOS install exposure must bind the exact component manifest without treating Latest as Stable.');
  }
  if (
    policy.distribution_install_model?.installer_convergence?.stable_macos_helper?.artifact_integrity
      ?.legacy_component_manifest_policy !==
    'allow_only_published_non_prerelease_pre_v3_manifest_with_quality_unasserted_disclosure'
  ) {
    throw new Error('Direct macOS install exposure must disclose its bounded legacy component-manifest policy.');
  }
  const forbiddenDependencyFields = [
    'capability_target_closure',
    'capability_source',
    'capability_projection',
    'resolution_policy',
    'optional_payload_policy',
    'missing_optional_payload_blocks_install_or_readiness',
  ];
  for (const surface of installerSurfaces.values()) {
    if (forbiddenDependencyFields.some((field) => field in surface)) {
      throw new Error('App installer surfaces must not own Package dependency or payload policy');
    }
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
  if (
    dockerWebui.installer_model?.windows_online_command !==
      'download install-docker-webui.ps1 from raw.githubusercontent.com and run with -EnableAutoUpdate -Yes'
  ) {
    throw new Error('Docker/WebUI install exposure must declare the Windows online one-click command model');
  }
  if (dockerWebui.installer_model?.windows_prerequisite_mode !== 'explicit_install_prerequisites_switch_requires_administrator') {
    throw new Error('Docker/WebUI install exposure must keep Windows Docker/WSL2 installation behind an explicit administrator prerequisite switch');
  }
  if (
    dockerWebui.installer_model?.default_image_ref !==
      'ghcr.io/gaofeng21cn/one-person-lab-webui:latest' ||
    dockerWebui.installer_model?.compatibility_alias_ref !==
      'ghcr.io/gaofeng21cn/one-person-lab-webui:stable'
  ) {
    throw new Error('Docker/WebUI install exposure must consume Latest and retain Stable only as its compatibility alias');
  }
  const windowsAutoUpdate = dockerWebui.installer_model?.windows_auto_update;
  if (
    windowsAutoUpdate?.mechanism !== 'user_scoped_windows_scheduled_task' ||
    windowsAutoUpdate?.task_name !== 'One Person Lab WebUI Latest Update' ||
    windowsAutoUpdate?.enable_entrypoint !== 'install-docker-webui.ps1 -EnableAutoUpdate' ||
    windowsAutoUpdate?.disable_entrypoint !== 'install-docker-webui.ps1 -DisableAutoUpdate' ||
    windowsAutoUpdate?.schedule !== 'daily_at_03_00_and_current_user_logon_start_when_available' ||
    windowsAutoUpdate?.execution_context !== 'limited_current_user_run_only_when_logged_on' ||
    windowsAutoUpdate?.channel_policy !== 'default_latest_only_custom_image_tag_or_digest_requires_manual_update' ||
    windowsAutoUpdate?.follows_ref !== 'ghcr.io/gaofeng21cn/one-person-lab-webui:latest' ||
    !String(windowsAutoUpdate?.security_boundary ?? '').includes('without_Docker_socket_mount')
  ) {
    throw new Error('Docker/WebUI Windows automatic updates must remain a limited user host task for the default latest channel');
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
  if (dockerWebui.installer_model?.api_key_entry_surface !== 'browser_webui_first_run_access_panel_or_settings_gateway') {
    throw new Error('Docker/WebUI install exposure must make WebUI the first API key entry surface');
  }
  if (
    dockerWebui.installer_model?.gateway_account_credential_policy !==
      'never_pass_gateway_account_credentials_to_installer_cli_or_environment_for_beginner_path' ||
    dockerWebui.installer_model?.gateway_account_entry_surface !==
      'browser_webui_first_run_or_settings_gateway_via_existing_runtime_provider'
  ) {
    throw new Error(
      'Docker/WebUI install exposure must keep Gateway account credentials out of installer inputs and reuse the browser runtime provider',
    );
  }
  const cloudDeployment = dockerWebui.installer_model?.cloud_deployment_model;
  if (cloudDeployment?.template_dir !== 'deploy/docker-webui/cloud') {
    throw new Error('Docker/WebUI cloud deployment must declare the deploy/docker-webui/cloud template directory');
  }
  if (cloudDeployment?.installer_entrypoint !== 'install-docker-webui.sh --cloud-template') {
    throw new Error('Docker/WebUI cloud deployment must be generated through the explicit --cloud-template entrypoint');
  }
  assertIncludesAll(
    cloudDeployment?.compose_files,
    ['compose.yaml', 'compose.gateway-key.yaml'],
    'Docker/WebUI cloud compose files',
  );
  if (
    cloudDeployment?.webui_auth?.default_username !== 'opl' ||
    cloudDeployment?.webui_auth?.required_password_secret !== 'OPL_WEBUI_PASSWORD_FILE' ||
    cloudDeployment?.webui_auth?.auth_mode_env !== 'OPL_WEBUI_AUTH_MODE=password' ||
    !String(cloudDeployment?.webui_auth?.auto_login ?? '').includes('disabled')
  ) {
    throw new Error('Docker/WebUI cloud deployment must require password auth and disable auto-login');
  }
  if (
    cloudDeployment?.gateway_api_key?.optional_secret !== 'OPL_GATEWAY_API_KEY_FILE' ||
    cloudDeployment?.gateway_api_key?.does_not_replace_webui_password !== true ||
    !String(cloudDeployment?.gateway_api_key?.transport ?? '').includes('stdin_only')
  ) {
    throw new Error('Docker/WebUI cloud deployment must keep Gateway API key optional, stdin-only, and separate from WebUI password');
  }
  assertIncludesAll(
    cloudDeployment?.fail_closed_rules,
    [
      'cloud_or_password_mode_requires_OPL_WEBUI_PASSWORD_FILE_or_OPL_WEBUI_PASSWORD',
      'gateway_api_key_secret_without_webui_password_secret_must_refuse_start',
      'secret_files_must_be_readable_and_non_empty',
      'configured_password_and_gateway_key_must_not_be_logged_or_written_to_diagnostics',
    ],
    'Docker/WebUI cloud fail-closed rules',
  );
  if (
    dockerWebui.installer_model?.runtime_proxy_smoke?.mode !== 'webui_proxy_configure_codex' ||
    dockerWebui.installer_model?.runtime_proxy_smoke?.endpoint !== '/api/opl-runtime/configure-codex' ||
    dockerWebui.installer_model?.runtime_proxy_smoke?.command !== 'opl system configure-codex --api-key-stdin --json' ||
    dockerWebui.installer_model?.runtime_proxy_smoke?.secret_transport !== 'stdin_only' ||
    dockerWebui.installer_model?.runtime_proxy_smoke?.key_material_recorded !== false
  ) {
    throw new Error('Docker/WebUI runtime proxy smoke must validate configure-codex stdin transport without key material');
  }
  const ordinaryUserStatus = dockerWebui.installer_model?.ordinary_user_status;
  if (ordinaryUserStatus?.path_id !== 'ordinary_docker_webui_user_path') {
    throw new Error('Docker/WebUI ordinary user status must use the ordinary Docker/WebUI user path id');
  }
  if (ordinaryUserStatus?.priority !== 'ordinary_user_path_before_evidence_bundle_language') {
    throw new Error('Docker/WebUI ordinary user status must prioritize ordinary user path language');
  }
  assertIncludesAll(
    ordinaryUserStatus?.display_order,
    ['one_click_install', 'browser_webui', 'access_key_settings', 'runtime_proxy', 'startup_recovery', 'data_preservation', 'host_update'],
    'Docker/WebUI ordinary user status rows',
  );
  if (ordinaryUserStatus?.settings_entry !== 'Settings -> Account & Access') {
    throw new Error('Docker/WebUI ordinary user status must route Gateway account and API Key changes through Settings -> Account & Access');
  }
  if (
    !String(ordinaryUserStatus?.rows?.access_key_settings ?? '').includes('Sign in to OPL Gateway') ||
    !String(ordinaryUserStatus?.rows?.access_key_settings ?? '').includes('API Key') ||
    !String(ordinaryUserStatus?.rows?.runtime_proxy ?? '').includes('reuse the existing OPL runtime provider')
  ) {
    throw new Error('Docker/WebUI ordinary user status must describe account-first model access on the shared runtime provider');
  }
  if (!String(ordinaryUserStatus?.image_seed_selection ?? '').includes('Default latest image')) {
    throw new Error('Docker/WebUI ordinary user status must declare the default WebUI full seed image path');
  }
  assertIncludesAll(
    ordinaryUserStatus?.must_prefer_over,
    ['release_evidence_bundle', 'operator_evidence_bundle', 'preflight_gate_summary'],
    'Docker/WebUI ordinary user status language precedence',
  );
  assertIncludesAll(
    ordinaryUserStatus?.must_not_claim,
    ['desktop_release_ready', 'real_install_ready', 'clean_windows_vm_pass_without_clean_windows_evidence', 'release_ready'],
    'Docker/WebUI ordinary user status false-ready boundary',
  );
  if (dockerWebui.installer_model?.startup_doctor?.validator !== 'scripts/validate-docker-webui-diagnostics.ts') {
    throw new Error('Docker/WebUI startup diagnostics must use validate-docker-webui-diagnostics.ts');
  }
  assertIncludesAll(
    dockerWebui.installer_model?.startup_doctor?.required_files,
    [
      'metadata.txt',
      'diagnostics-manifest.json',
      'compose.yaml',
      'docker-version.txt',
      'docker-compose-version.txt',
      'docker-compose-ps.txt',
      'docker-compose-logs.txt',
      'docker-image.txt',
      'http-probe.txt',
      'directories.txt',
      'data-preservation.txt',
    ],
    'Docker/WebUI startup diagnostics required files',
  );
  assertIncludesAll(
    dockerWebui.installer_model?.ordinary_user_progress?.must_not_claim,
    ['release readiness', 'clean VM pass', 'domain readiness', 'production readiness'],
    'Docker/WebUI ordinary user progress false-ready boundary',
  );
  assertIncludesAll(
    dockerWebui.installer_model?.ordinary_user_progress?.status_surfaces,
    [
      'HTTP health readback',
      'api_key_flow_evidence',
      'data-preservation verdict',
      'compose volume mapping readback',
      'image digest readback',
      'remote image digest readback',
      'image currentness status readback',
      'OPL maintenance status after WebUI opens',
    ],
    'Docker/WebUI ordinary user progress status surfaces',
  );
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
  if (
    dockerWebui.runtime_distribution_model?.stable_channel_policy !==
      'latest_and_stable_alias_must_match_and_point_to_webui_full_not_metadata_only_slim'
  ) {
    throw new Error('Docker/WebUI install exposure must keep Latest/Stable aligned on the full image');
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
  if (
    dockerWebui.runtime_distribution_model?.image_update_model?.currentness_status_model !==
      'local_image_digest_and_optional_remote_image_digest_compare_only' ||
    dockerWebui.runtime_distribution_model?.image_update_model?.currentness_claim_policy !==
      'remote digest comparison is status-only; it does not prove release readiness, live latest, or that a host update was applied'
  ) {
    throw new Error('Docker/WebUI image currentness must remain status-only and separate from release-ready or applied-update proof');
  }
  if (
    dockerWebui.runtime_distribution_model?.image_update_model?.windows_auto_update_entrypoint !==
      'install-docker-webui.ps1 -EnableAutoUpdate' ||
    dockerWebui.runtime_distribution_model?.image_update_model?.windows_auto_update_mechanism !==
      'limited_current_user_scheduled_task_running_host_installer_daily_and_at_logon_for_default_latest_only'
  ) {
    throw new Error('Docker/WebUI image automatic updates must reuse the bounded Windows host installer route');
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
  if (
    contract.workflow_import?.live_release_import !== 'none' ||
    contract.workflow_import?.authority !== 'standalone_diagnostic_only_non_authoritative_for_stable_mutation'
  ) {
    throw new Error('Docker/WebUI smoke evidence must not import retired desktop release authority');
  }
  if (contract.workflow_import?.linux_default_producer !== 'standalone_clean_linux_vm_workflow') {
    throw new Error('Docker/WebUI clean Linux VM gate must declare the standalone producer');
  }
  if (contract.workflow_import?.linux_manual_producer_workflow !== '.github/workflows/docker-webui-clean-linux-vm.yml') {
    throw new Error('Docker/WebUI clean Linux VM gate must declare the standalone manual producer workflow');
  }
  if (contract.workflow_import?.windows_manual_producer_workflow !== '.github/workflows/docker-webui-clean-windows-vm.yml') {
    throw new Error('Docker/WebUI clean Windows VM gate must declare the standalone manual producer workflow');
  }
  assertIncludesAll(
    contract.diagnostic_bundle_artifacts,
    [
      'compose.yaml',
      'docker ps',
      'docker logs',
      'image_digest_readback',
      'remote_image_digest_readback_optional',
      'image_currentness_status_readback',
      'compose_volume_mapping_readback',
      'http_health_readback',
      'api_key_flow_evidence',
      'auth_user_readback',
      'data_preservation_inventory',
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
  const gateById = new Map([
    ...(contract.required_gates ?? []),
    ...(contract.optional_gates ?? []),
    ...(contract.diagnostic_gates ?? []),
  ].map((gate) => [gate.id, gate]));
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
      [
        'compose_yaml',
        'image_digest_readback',
        'compose_volume_mapping_readback',
        'container_logs',
        'http_health_readback',
        'api_key_flow_evidence',
        'data_preservation_inventory',
        'install_manifest_readback',
      ],
      `Docker/WebUI smoke gate ${gateId} evidence`,
    );
  }
  if (gateById.get('clean_linux_vm')?.entrypoint !== 'install-docker-webui.sh --yes') {
    throw new Error('Docker/WebUI clean Linux VM gate must use the shell one-click installer');
  }
  if (gateById.get('clean_linux_vm')?.execution_mode !== 'desktop_release_same_job_ubuntu_clean_vm_smoke_or_manual_vm_smoke') {
    throw new Error('Docker/WebUI clean Linux VM gate must default to the desktop release same-job Ubuntu smoke');
  }
  if (!Array.isArray(contract.required_gates) || contract.required_gates.map((gate) => gate.id).join(',') !== 'clean_linux_vm') {
    throw new Error('Docker/WebUI release-blocking smoke gates must only require clean_linux_vm');
  }
  if (!Array.isArray(contract.optional_gates) || !contract.optional_gates.some((gate) => gate.id === 'clean_windows_vm')) {
    throw new Error('Docker/WebUI clean Windows VM gate must be optional diagnostic evidence');
  }
  if (gateById.get('clean_windows_vm')?.entrypoint !== 'install-docker-webui.ps1 -Yes') {
    throw new Error('Docker/WebUI clean Windows VM gate must use the PowerShell one-click installer');
  }
  if (gateById.get('clean_windows_vm')?.execution_mode !== 'self_hosted_clean_windows_runner_or_manual_vm_smoke') {
    throw new Error('Docker/WebUI clean Windows VM gate must use a self-hosted clean Windows runner or manual VM smoke');
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
    contract.false_ready_boundary?.remote_digest_match_can_claim_release_ready !== false ||
    contract.false_ready_boundary?.image_digest_readback_can_claim_live_currentness !== false ||
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
    expectedFirstRunCoreItems,
    'Install exposure first-run primary steps',
  );
  assertIncludesAll(
    presentation.secondary_steps,
    expectedFullReadinessItems,
    'Install exposure first-run secondary steps',
  );
  if (presentation.technical_detail_policy !== 'hidden_until_expanded_or_error') {
    throw new Error('Install exposure technical details must be hidden until expanded or error');
  }
}

function validateSetupFlowContract(setupFlow) {
  if (setupFlow?.source_command !== expectedFirstRunProgressModel.source_command) {
    throw new Error(`Install exposure setup flow must use ${expectedFirstRunProgressModel.source_command}`);
  }
  if (setupFlow?.source_path !== expectedFirstRunProgressModel.source_path) {
    throw new Error(`Install exposure setup flow must read ${expectedFirstRunProgressModel.source_path}`);
  }
  if (setupFlow?.truth_policy !== 'all_installers_and_renderers_derive_progress_from_the_shared_initialize_model') {
    throw new Error('Install exposure setup flow must forbid separate installer progress truth');
  }
  if (setupFlow.ready_to_launch_gate !== 'ready_to_launch') {
    throw new Error('Install exposure setup flow must use ready_to_launch gate');
  }
  assertIncludesAll(
    setupFlow.ready_to_launch_required_core_items,
    expectedFirstRunCoreItems,
    'Install exposure ready_to_launch core items',
  );
  assertIncludesAll(
    setupFlow.full_readiness_non_blocking_items,
    expectedFullReadinessItems,
    'Install exposure full readiness non-blocking items',
  );
  const firstConversation = setupFlow.first_conversation_readiness;
  if (
    firstConversation?.gate !== expectedFirstConversation.gate ||
    firstConversation?.source_command !== expectedFirstRunProgressModel.source_command ||
    firstConversation?.ready_to_launch_must_be_true !== false ||
    firstConversation?.unknown_readiness_policy !== expectedFirstConversation.unknown_readiness_policy ||
    firstConversation?.blocked_feedback !== expectedFirstConversation.blocked_feedback ||
    firstConversation?.failure_policy !== expectedFirstConversationFailurePolicy
  ) {
    throw new Error('Install exposure first conversation readiness must apply granular prerequisites before ACP warmup');
  }
  assertDeepEqualJson(
    firstConversation.required_before_plain_send,
    expectedFirstConversation.required_before_plain_send,
    'Install exposure plain send prerequisites',
  );
  assertDeepEqualJson(
    firstConversation.required_before_send_with_local_inputs,
    expectedFirstConversation.required_before_send_with_local_inputs,
    'Install exposure send with local inputs prerequisites',
  );
  assertDeepEqualJson(
    firstConversation.required_before_workspace_controls,
    expectedFirstConversation.required_before_workspace_controls,
    'Install exposure workspace control prerequisites',
  );
  assertIncludesAll(
    firstConversation.must_wait_for,
    expectedFirstConversationMustWaitFor,
    'Install exposure first conversation wait-for items',
  );
  assertIncludesAll(
    firstConversation.must_not_wait_for,
    expectedFullReadinessItems,
    'Install exposure first conversation non-blocking readiness items',
  );
}

export function validateInstallExposurePolicy(policy) {
  validateInstallExposureHeader(policy);
  validateCapabilityGovernance(policy.capability_governance);
  validateCanonicalMetadataSources(policy.canonical_metadata_sources);
  validatePublicAbi(policy.public_abi);
  validateExposureClasses(policy);
  validateInstallerSurfaces(policy);
  validateFirstRunUserPresentation(policy.first_run_user_presentation);
  validateSetupFlowContract(policy.setup_flow_contract);

  validateInstallExposureRuntimeAndDistribution(policy);
}
