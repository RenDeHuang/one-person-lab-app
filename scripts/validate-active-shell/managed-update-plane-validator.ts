import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import {
  managedKernelComponentReceiptIdentityFields,
  managedKernelComponentReceiptRequiredFields,
  managedKernelLifecycle,
  managedKernelOperationModes,
  managedKernelPublicCliSurfaces,
  managedKernelReceiptWritePolicy,
  managedKernelRunnerResultRequiredFields,
  managedKernelStateVocabulary,
  managedKernelStatusProjectionRequiredFields,
  managedUpdateActionSource,
  managedUpdateBackgroundFields,
  managedUpdateDisplayPlanes,
  managedUpdateIpcSurfaces,
  managedUpdateMustNotShow,
  managedUpdateMustShow,
  managedUpdateScheduler,
  managedUpdateSections,
  managedUpdateStateSources,
  managedUpdateStatusConsumptionPolicy,
  managedUpdateUiActions,
} from './managed-update-plane-policy.ts';

export { managedUpdateIpcSurfaces } from './managed-update-plane-policy.ts';

export function validateReleaseManagedUpdateKernelSurface(managedUpdatePlane) {
  const managedKernel = managedUpdatePlane?.managed_kernel;

  validateManagedKernelLifecycle(managedKernel);
  validateManagedKernelIdempotencyLock(managedKernel);
  validateManagedKernelShellIntegration(managedUpdatePlane, managedKernel);
  validateManagedKernelCommandAndReceiptPolicy(managedKernel);
  validateManagedKernelProjectionAndResultFields(managedKernel);
  validateManagedKernelReceiptAndConditionShapes(managedKernel);
}

export function validateReleaseManagedUpdatePlaneLanes(managedUpdatePlane) {
  const planeById = new Map((managedUpdatePlane?.planes ?? []).map((plane) => [plane.id, plane]));

  validateManagedUpdateInstallationCarrierLane(planeById.get('installation_carrier'));
  validateManagedUpdateRuntimeAndAgentLanes(
    planeById.get('runtime_substrate'),
    planeById.get('capability_packages'),
    planeById.get('codex_surface'),
    managedUpdatePlane?.capability_packages,
  );
  validateManagedUpdateCompanionToolsLane(planeById.get('companion_tools'), managedUpdatePlane?.companion_tools);
  validateManagedUpdateCapabilityLane(planeById.get('codex_surface'));
  validateManagedUpdateWorkflowProfileLane(planeById.get('workflow_profile'), managedUpdatePlane?.workflow_profile);
  validateManagedUpdateStandardUpdaterBoundary(managedUpdatePlane?.standard_updater_boundary);
}

export function validateReleaseRuntimeSubstrateUpdater(runtimeUpdater, managedUpdatePlane) {
  validateReleaseRuntimeToolchainChannelPolicy(runtimeUpdater);
  validateReleaseRuntimeToolchainManagedComponents(runtimeUpdater);
  validateReleaseRuntimeToolchainLayering(runtimeUpdater);
  validateReleaseRuntimeToolchainSystemPolicy(runtimeUpdater);
  validateReleaseRuntimeToolchainVerification(runtimeUpdater);
  validateReleaseRuntimeToolchainPlaneBinding(runtimeUpdater, managedUpdatePlane);
}

export function validateReleaseCompanionToolsUpdater(companionUpdater, managedUpdatePlane) {
  if (
    companionUpdater?.owner !== 'one-person-lab-app' ||
    companionUpdater?.producer_owner !== 'one-person-lab' ||
    companionUpdater?.class !== 'companion_tools' ||
    companionUpdater?.managed_update_plane !== 'companion_tools' ||
    companionUpdater?.kernel !== 'opl_managed_updater_kernel' ||
    companionUpdater?.adapter !== 'companion_tools_adapter' ||
    companionUpdater?.shared_kernel_lifecycle_allowed !== true ||
    companionUpdater?.standard_updater_metadata_allowed !== false ||
    companionUpdater?.standard_updater_latest_yml_allowed !== false ||
    companionUpdater?.homebrew_tap_write_allowed !== false ||
    companionUpdater?.app_role !== 'status_conditions_repair_actions_consumer_only'
  ) {
    throw new Error('Release channel companion tools updater must be a separate managed class that shares the kernel lifecycle without becoming runtime substrate');
  }
  assertDeepEqualJson(companionUpdater?.managed_tools, ['officecli', 'mineru_open_api'], 'Release channel companion tools');
  assertIncludesAll(
    companionUpdater?.forbidden_silent_overwrite_scope,
    managedUpdatePlane?.forbidden_silent_overwrite_scope,
    'Release channel companion tools forbidden silent overwrite scope',
  );
}

function validateReleaseRuntimeToolchainChannelPolicy(runtimeUpdater) {
  if (
    runtimeUpdater?.owner !== 'one-person-lab-app' ||
    runtimeUpdater?.role !== 'app_owned_runtime_substrate_layer_updates' ||
    runtimeUpdater?.brand_name !== 'OPL Runtime Fabric' ||
    runtimeUpdater?.brand_role !== 'shared runtime fabric for OPL capability modules, not a MAS/MAG/RCA/OMA/OBF/ScholarSkills brand module' ||
    runtimeUpdater?.channel_manifest_asset !== 'app-runtime-update-channel.json' ||
    runtimeUpdater?.transport !== 'app_owned_github_release_assets' ||
    runtimeUpdater?.standard_updater_metadata_allowed !== false ||
    runtimeUpdater?.standard_updater_latest_yml_allowed !== false ||
    runtimeUpdater?.homebrew_tap_write_allowed !== false ||
    runtimeUpdater?.default_policy?.auto_check !== true ||
    runtimeUpdater?.default_policy?.download !== 'silent_background' ||
    runtimeUpdater?.default_policy?.apply !== 'stage_verified_payload_and_apply_on_next_app_restart' ||
    runtimeUpdater?.default_policy?.restart_prompt !== 'none_until_user_restarts_app' ||
    runtimeUpdater?.default_policy?.user_blocking !== false
  ) {
    throw new Error('Release channel runtime substrate updater must be a silent App-owned runtime fallback channel separate from standard updater and Homebrew');
  }
}

function validateReleaseRuntimeToolchainManagedComponents(runtimeUpdater) {
  assertIncludesAll(
    runtimeUpdater?.managed_components,
    [
      'embedded_codex_executor',
      'temporal_cli_archive',
      'node_runtime',
      'python_runtime',
      'uv_runtime',
      'native_helper',
      'opl_framework_runtime',
    ],
    'Release channel runtime substrate updater managed components',
  );
  for (const forbidden of ['domain_module_payloads', 'officecli', 'mineru_open_api', 'companion_skills', 'codex_cli_fallback']) {
    if (runtimeUpdater?.managed_components?.includes(forbidden)) {
      throw new Error(`Release channel runtime substrate updater must not own ${forbidden}`);
    }
  }
  assertDeepEqualJson(
    runtimeUpdater?.managed_subsystems,
    {
      agent_execution_core: ['embedded_codex_executor', 'temporal_cli_archive', 'opl_framework_runtime'],
      environment_materializer: {
        role: 'materialize module-declared sandbox-like runtime environments from managed App-owned materials',
        language_runtimes: ['node_runtime', 'python_runtime'],
        package_and_env_resolvers: ['uv_runtime'],
        optional_resolver_slots: ['pixi_for_scientific_native_stack_when_declared'],
        env_cache_and_isolated_prefix: 'module-specific managed env roots and package cache under the App-owned runtime/state root',
        receipt_fields: [
          'language_runtime_versions',
          'resolver_versions',
          'lock_refs',
          'materialized_env_root',
          'cache_root',
          'sha256',
          'rollback_ref',
        ],
      },
      opl_system_bridge: ['native_helper'],
    },
    'Release channel OPL Runtime Fabric managed subsystems',
  );
}

function validateReleaseRuntimeToolchainLayering(runtimeUpdater) {
  if (
    runtimeUpdater?.layering?.runtime_root !== '~/Library/Application Support/OPL/runtime' ||
    runtimeUpdater?.layering?.current_pointer !== '~/Library/Application Support/OPL/runtime/current.json' ||
    runtimeUpdater?.layering?.activation !== 'swap_current_pointer_on_app_restart_after_startup_smoke' ||
    runtimeUpdater?.layering?.rollback !== 'restore_previous_pointer_when_startup_smoke_fails'
  ) {
    throw new Error('Release channel runtime substrate updater must stage runtime layers and atomically activate through the runtime current pointer');
  }
}

function validateReleaseRuntimeToolchainPlaneBinding(runtimeUpdater, managedUpdatePlane) {
  if (
    runtimeUpdater?.managed_update_plane !== 'runtime_substrate' ||
    runtimeUpdater?.kernel !== 'opl_managed_updater_kernel' ||
    runtimeUpdater?.adapter !== 'runtime_substrate_adapter' ||
    runtimeUpdater?.policy !== 'silent_background_verified_stage_apply_on_next_restart' ||
    runtimeUpdater?.post_apply !== 'startup_smoke_then_swap_runtime_current_pointer_with_rollback' ||
    runtimeUpdater?.app_role !== 'status_conditions_repair_actions_consumer_only'
  ) {
    throw new Error('Release channel runtime substrate updater must bind to the managed update plane runtime substrate lane');
  }
  assertDeepEqualJson(
    runtimeUpdater?.status_sources,
    [
      'opl app state --profile fast --json#managed_update_plane.runtime_substrate',
      'opl update status --json#runtime_substrate',
    ],
    'Release channel runtime updater status sources',
  );
  assertIncludesAll(
    runtimeUpdater?.forbidden_silent_overwrite_scope,
    managedUpdatePlane?.forbidden_silent_overwrite_scope,
    'Release channel runtime updater forbidden silent overwrite scope',
  );
}

function validateReleaseRuntimeToolchainSystemPolicy(runtimeUpdater) {
  assertDeepEqualJson(
    runtimeUpdater.system_tool_policy?.preferred_sources,
    ['app_owned_runtime', 'explicit_expert_unmanaged_source'],
    'Release channel OPL Runtime Fabric updater preferred sources',
  );
  if (
    runtimeUpdater.system_tool_policy?.prefer_valid_newer_system_tool !== false ||
    runtimeUpdater.system_tool_policy?.system_sources_default_used !== false ||
    runtimeUpdater.system_tool_policy?.system_sources_visible_as_diagnostics !== true ||
    runtimeUpdater.system_tool_policy?.system_sources_require_expert_opt_in !== true ||
    runtimeUpdater.system_tool_policy?.silent_global_mutation_allowed !== false ||
    runtimeUpdater.system_tool_policy?.homebrew_upgrade_allowed_by_default !== false ||
    runtimeUpdater.system_tool_policy?.user_opt_in_global_upgrade_allowed !== true
  ) {
    throw new Error('Release channel OPL Runtime Fabric updater must default to App-owned runtime and keep system tools diagnostic or explicit expert opt-in only');
  }
  assertIncludesAll(
    runtimeUpdater.manifest_required_fields,
    [
      'schema_version',
      'channel',
      'runtime_version',
      'components',
      'assets',
      'sha256',
      'minimum_versions',
      'apply_policy',
      'rollback_policy',
    ],
    'Release channel runtime substrate updater manifest fields',
  );
}

function validateReleaseRuntimeToolchainVerification(runtimeUpdater) {
  assertIncludesAll(
    runtimeUpdater.verification?.required_before_stage,
    ['manifest_schema', 'asset_sha256', 'minimum_version', 'component_capability_smoke'],
    'Release channel runtime substrate updater stage checks',
  );
  assertIncludesAll(
    runtimeUpdater.verification?.required_before_release,
    [
      'standard_dmg_clean_vm_smoke',
      'full_dmg_clean_vm_smoke',
      'homebrew_standard_cask_clean_vm_smoke',
      'remote_release_verification',
      'framework_artifact_channel_readback',
      'framework_artifact_checksum_readback',
      'framework_artifact_rollback_evidence',
    ],
    'Release channel runtime substrate updater release checks',
  );
  if (
    runtimeUpdater.verification?.clean_machine_installability_must_not_regress !== true ||
    runtimeUpdater.rollback_policy?.keep_previous_runtime !== true ||
    runtimeUpdater.rollback_policy?.rollback_on_startup_smoke_failure !== true ||
    runtimeUpdater.rollback_policy?.rollback_must_not_mutate_user_global_tools !== true ||
    !/silent download and verified staging/.test(runtimeUpdater.rule ?? '')
  ) {
    throw new Error('Release channel runtime substrate updater must preserve clean-machine installability and rollback without global tool mutation');
  }
  validateOplBodyPolicy(runtimeUpdater.linux_docker_opl_body_policy, {
    label: 'Release channel OPL Runtime Fabric Linux/Docker OPL body policy',
    expectManagedUpdatePlane: true,
  });
  validateFrameworkArtifactGate(runtimeUpdater.framework_artifact_gate);
}

function validateFrameworkArtifactGate(gate) {
  if (
    gate?.owner !== 'one-person-lab' ||
    gate?.component_id !== 'opl_framework_runtime' ||
    gate?.release_gate !== true ||
    gate?.channel_manifest_ref !== 'app-runtime-update-channel.json#components.opl_framework_runtime' ||
    gate?.artifact_channel_id !== 'framework_artifact_channel' ||
    gate?.status_source !== 'opl update status --json#runtime_substrate.components[opl_framework_runtime]' ||
    gate?.app_consumption_policy !== 'refs_and_checksums_only_no_artifact_body' ||
    gate?.docker_image_update_allowed !== false
  ) {
    throw new Error('Release channel OPL Framework artifact gate must require channel/readback/checksum/rollback evidence without authorizing Docker image updates');
  }
  assertDeepEqualJson(
    gate?.required_release_evidence,
    [
      'framework_artifact_channel_readback',
      'framework_artifact_readback',
      'framework_artifact_sha256',
      'framework_artifact_rollback_ref',
    ],
    'Release channel OPL Framework artifact release evidence',
  );
  assertIncludesAll(
    gate?.required_receipt_fields,
    ['source_manifest_ref', 'artifact_ref', 'artifact_channel', 'artifact_sha256', 'git_head_sha', 'rollback_ref'],
    'Release channel OPL Framework artifact receipt fields',
  );
}

function validateManagedUpdateInstallationCarrierLane(carrierPlane) {
  if (
    carrierPlane?.updater_kind !== 'carrier_specific_status' ||
    carrierPlane?.adapter !== 'installation_carrier_status_adapter' ||
    carrierPlane?.policy !== 'carrier_specific_status_with_host_update_route' ||
    carrierPlane?.post_apply !== 'carrier_specific_restart_host_executor_or_manual_readback' ||
    carrierPlane?.managed_kernel_apply_allowed !== false ||
    carrierPlane?.opl_update_apply_must_not_claim_carrier_update_complete !== true ||
    carrierPlane?.repair_action_scope !== 'carrier_specific_check_download_host_route_or_manual_recovery_only'
  ) {
    throw new Error('Managed update plane installation carrier lane must be carrier-specific and outside the managed kernel apply path');
  }
  assertDeepEqualJson(
    carrierPlane?.status_fields,
    [
      'carrier_type',
      'installed_version',
      'available_version',
      'channel',
      'carrier_status',
      'host_update_route',
      'host_executor_required',
      'manual_required',
      'downloaded_version',
      'download_progress',
      'restart_required',
      'apply_started',
      'applied_version',
      'running_version_switched',
      'install_not_applied_reason',
      'cached_update_path',
      'image_ref',
      'image_digest',
      'remote_image_digest',
      'image_currentness_status',
      'image_currentness_evidence_source',
      'container_id',
      'compose_file',
      'package_manager',
      'package_name',
      'detected_package_managers',
      'data_volume_preservation',
      'repair_actions',
    ],
    'Managed update plane installation carrier lane status fields',
  );
  const variants = new Map((carrierPlane?.carrier_variants ?? []).map((variant) => [variant.id, variant]));
  validateInstallationCarrierMacosVariant(variants.get('macos_app'));
  validateInstallationCarrierDockerWebuiVariant(variants.get('docker_webui_image'));
  validateInstallationCarrierLinuxVariant(variants.get('linux_package_carrier'));
}

function validateInstallationCarrierMacosVariant(variant) {
  if (
    variant?.legacy_alias !== 'app_binary' ||
    variant?.adapter !== 'electron_standard_updater' ||
    variant?.host_update_route !== 'electron_standard_updater_or_homebrew_cask' ||
    variant?.data_volume_preservation_proof_required !== false ||
    variant?.repair_action_scope !== 'app_release_check_download_retry_or_install_downloaded_update_only'
  ) {
    throw new Error('Installation carrier macOS App variant must bind the legacy macOS updater alias to carrier semantics');
  }
  assertIncludesAll(
    variant?.status_values,
    ['current', 'update_available', 'downloaded', 'restart_required', 'install_not_applied', 'failed_with_repair'],
    'Installation carrier macOS App status values',
  );
}

function validateInstallationCarrierDockerWebuiVariant(variant) {
  if (
    variant?.host_update_route !== 'host_executor_runs_documented_installer_or_compose_pull_and_up' ||
    variant?.managed_kernel_apply_allowed !== false ||
    variant?.data_volume_preservation_proof_required !== true ||
    variant?.image_currentness_status_source !== 'optional GHCR remote digest readback compared with the local compose/container image digest' ||
    variant?.image_currentness_claim_policy !==
      'remote digest comparison is status-only and must not be used as release-ready, live-current, or applied-update proof' ||
    variant?.repair_action_scope !== 'docker_webui_host_route_diagnostics_and_data_volume_preservation_only' ||
    !String(variant?.opl_update_apply_boundary ?? '').includes('must not report Docker/WebUI image replacement as applied') ||
    String(variant?.opl_update_apply_boundary ?? '').includes('codex_surface')
  ) {
    throw new Error('Installation carrier Docker/WebUI image variant must require host update route and forbid opl update apply from claiming image replacement');
  }
  assertIncludesAll(
    variant?.status_values,
    ['current', 'update_available', 'host_executor_required', 'manual_required', 'failed_with_repair'],
    'Installation carrier Docker/WebUI status values',
  );
  assertIncludesAll(
    variant?.host_update_route_examples,
    ['install-docker-webui.sh --yes --update', 'install-docker-webui.ps1 -Yes -Update', 'docker compose pull && docker compose up -d'],
    'Installation carrier Docker/WebUI host update route examples',
  );
  assertIncludesAll(
    variant?.preserved_mounts,
    ['OnePersonLab/data -> /data', 'OnePersonLab/projects -> /projects'],
    'Installation carrier Docker/WebUI preserved mounts',
  );
  assertIncludesAll(
    variant?.required_preservation_evidence,
    [
      'compose.yaml volume mapping readback',
      'data-preservation.txt',
      'pre_data_inventory',
      'post_data_inventory',
      'install_manifest_readback',
      'projects_mount_readback',
    ],
    'Installation carrier Docker/WebUI data preservation evidence',
  );
  validateOplBodyPolicy(variant?.opl_body_update_policy, {
    label: 'Installation carrier Docker/WebUI OPL body policy',
    expectHostCarrierUpdateAllowed: false,
  });
}

function validateInstallationCarrierLinuxVariant(variant) {
  if (
    variant?.host_update_route !== 'host_package_manager_or_documented_host_executor' ||
    variant?.host_executor_required !== true ||
    variant?.managed_kernel_apply_allowed !== false ||
    variant?.repair_action_scope !== 'linux_package_carrier_host_route_only'
  ) {
    throw new Error('Installation carrier Linux package variant must require host/package-manager routing outside the managed kernel apply path');
  }
  assertIncludesAll(
    variant?.status_values,
    ['current', 'update_available', 'host_executor_required', 'manual_required', 'failed_with_repair'],
    'Installation carrier Linux package status values',
  );
  assertIncludesAll(
    variant?.host_update_route_examples,
    [
      'sudo apt update && sudo apt install --only-upgrade one-person-lab',
      'sudo dnf upgrade one-person-lab',
      'sudo zypper update one-person-lab',
    ],
    'Installation carrier Linux host update route examples',
  );
  assertIncludesAll(
    variant?.status_readback_fields,
    ['package_manager', 'package_name', 'installed_version', 'detected_package_managers'],
    'Installation carrier Linux status readback fields',
  );
  assertIncludesAll(
    variant?.manual_required_when,
    [
      'package_manager_requires_sudo_or_root',
      'host_policy_disallows_app_executor',
      'repository_or_signature_configuration_required',
    ],
    'Installation carrier Linux manual-required reasons',
  );
  validateOplBodyPolicy(variant?.opl_body_update_policy, {
    label: 'Installation carrier Linux OPL body policy',
    expectHostCarrierUpdateAllowed: false,
  });
}

function validateManagedUpdateRuntimeAndAgentLanes(runtimePlane, agentPlane, capabilityPlane, agentPackageChannel) {
  if (
    runtimePlane?.updater_kind !== 'managed_updater_kernel' ||
    runtimePlane?.adapter !== 'runtime_substrate_adapter' ||
    runtimePlane?.policy !== 'silent_background_verified_stage_apply_on_next_restart' ||
    runtimePlane?.post_apply !== 'startup_smoke_then_swap_runtime_current_pointer_with_rollback' ||
    agentPlane?.updater_kind !== 'managed_updater_kernel' ||
    agentPlane?.adapter !== 'capability_packages_adapter' ||
    agentPlane?.policy !== 'ordinary_user_non_development_silent_background' ||
    agentPlane?.post_apply !==
      'sync_plugin_registry_plugin_packaged_skills_generated_surfaces_and_codex_surface_readiness'
  ) {
    throw new Error('Managed update plane runtime substrate and capability package lanes must share the managed kernel but differ by adapter/policy/post_apply');
  }
  validateManagedUpdateRuntimeLane(runtimePlane);
  validateManagedUpdateAgentPackageLane(agentPlane, capabilityPlane, agentPackageChannel);
}

function validateManagedUpdateRuntimeLane(runtimePlane) {
  if (
    runtimePlane?.display_group !== 'OPL Runtime Fabric' ||
    runtimePlane?.display_label_en !== 'OPL Runtime Fabric' ||
    runtimePlane?.display_label_zh !== 'OPL 运行基座' ||
    runtimePlane?.brand_name !== 'OPL Runtime Fabric' ||
    runtimePlane?.brand_role !== 'shared runtime fabric for OPL capability modules, not a user-facing brand module'
  ) {
    throw new Error('Managed update plane runtime lane must expose OPL Runtime Fabric as the user-facing runtime foundation');
  }
  assertDeepEqualJson(
    runtimePlane?.managed_subsystems,
    {
      agent_execution_core: ['embedded_codex_executor', 'temporal_cli_archive', 'opl_framework_runtime'],
      environment_materializer: {
        role: 'materialize module-declared sandbox-like runtime environments from managed App-owned materials',
        language_runtimes: ['node_runtime', 'python_runtime'],
        package_and_env_resolvers: ['uv_runtime'],
        optional_resolver_slots: ['pixi_for_scientific_native_stack_when_declared'],
        env_cache_and_isolated_prefix: 'module-specific managed env roots and package cache under the App-owned runtime/state root',
        receipt_fields: [
          'language_runtime_versions',
          'resolver_versions',
          'lock_refs',
          'materialized_env_root',
          'cache_root',
          'sha256',
          'rollback_ref',
        ],
      },
      opl_system_bridge: ['native_helper'],
    },
    'Managed update plane OPL Runtime Fabric subsystems',
  );
  assertDeepEqualJson(
    runtimePlane?.source_preference_policy,
    {
      default_source: 'app_owned_runtime',
      system_sources_default_used: false,
      system_sources_visible_as_diagnostics: true,
      system_sources_require_expert_opt_in: true,
      developer_checkout_default_used: false,
      expert_opt_in_surface: 'Developer Profile explicit maintenance action',
      standard_download_policy: 'minimal_runtime_fabric_then_on_demand_payloads',
      full_download_policy: 'preload_runtime_fabric_common_tools_and_capability_caches',
    },
    'Managed update plane OPL Runtime Fabric source preference policy',
  );
  validateOplBodyPolicy(runtimePlane?.linux_docker_opl_body_policy, {
    label: 'Managed update plane Linux/Docker OPL body policy',
    expectInstallationCarrierExclusion: true,
  });
  assertDeepEqualJson(
    runtimePlane?.status_fields,
    [
      'runtime_version',
      'components',
      'conditions',
      'staged_version',
      'restart_required',
      'repair_actions',
      'idempotency_lock.status',
      'execution.status',
      'components[].receipt.last_receipt_ref',
      'components[].receipt.rollback_ref',
      'components[].receipt.repair_action',
    ],
    'Managed update plane runtime lane status fields',
  );
  assertDeepEqualJson(
    runtimePlane?.component_receipt_identity_fields,
    ['runtime_version', 'current_pointer', 'staged_root', 'sha256'],
    'Managed update plane runtime lane receipt identity fields',
  );
  if (
    runtimePlane?.rollback_status_source !== 'opl update rollback --component runtime_substrate --json#managed_update.execution.status' ||
    runtimePlane?.repair_status_source !== 'opl update repair --receipt <receipt_id> --json#managed_update.execution.status'
  ) {
    throw new Error('Managed update plane runtime lane must consume Framework rollback and repair runner status fields');
  }
}

function validateOplBodyPolicy(policy, options) {
  if (
    policy?.user_intent_label !== 'Update OPL body' ||
    policy?.managed_update_plane !== 'runtime_substrate' ||
    policy?.runtime_fabric_label !== 'OPL Runtime Fabric'
  ) {
    throw new Error(`${options.label} must route Update OPL body to runtime_substrate / OPL Runtime Fabric`);
  }
  if (options.expectManagedUpdatePlane) {
    assertIncludesAll(
      policy?.applies_to,
      ['docker_webui_managed_root', 'linux_package_managed_root'],
      `${options.label} applies-to roots`,
    );
    assertIncludesAll(
      policy?.forbidden_host_targets,
      ['docker_webui_image', 'linux_package_carrier'],
      `${options.label} forbidden host targets`,
    );
  }
  if (options.expectInstallationCarrierExclusion) {
    if (policy?.not_installation_carrier_update !== true) {
      throw new Error(`${options.label} must mark OPL body updates as not installation carrier updates`);
    }
    assertIncludesAll(
      policy?.forbidden_host_targets,
      ['docker_webui_image', 'linux_package_carrier'],
      `${options.label} forbidden host targets`,
    );
  }
  if (options.expectHostCarrierUpdateAllowed === false && policy?.host_carrier_update_allowed !== false) {
    throw new Error(`${options.label} must forbid host carrier update when user intent is Update OPL body`);
  }
}

function validateManagedUpdateAgentPackageLane(agentPlane, capabilityPlane, agentPackageChannel) {
  assertDeepEqualJson(
    agentPlane?.status_fields,
    [
      'agent_id',
      'package_tag',
      'version',
      'source',
      'conditions',
      'repair_actions',
      'components[].receipt.post_apply_hooks',
      'post_apply_sync.codex_surface',
      'readiness.codex_surface',
      'idempotency_lock.status',
      'execution.status',
      'components[].receipt.last_receipt_ref',
      'components[].receipt.repair_action',
    ],
    'Managed update plane agent package lane status fields',
  );
  assertDeepEqualJson(
    agentPlane?.post_apply_sync,
    {
      status_field: 'components[].receipt.post_apply_hooks',
      required_hooks: [
        'reconcile_modules',
        'sync_skills',
        'sync_plugin_registry',
        'sync_plugin_packaged_skills',
        'sync_oma_generated_plugin_surface',
        'sync_bookforge_generated_plugin_surface',
        'sync_scholarskills_package_surface',
        'codex_surface_readiness',
      ],
      reload_guidance: 'reload_app_and_codex_plugin_cache_when_post_apply_sync_changes_visible_plugin_or_skill_surface',
      auto_apply_eligibility: 'clean_managed_module_roots_only',
      auto_apply_denial_reasons: [
        'dirty_checkout',
        'developer_profile_checkout',
        'manual_required_condition',
        'idempotency_lock_in_progress',
        'verification_failed',
      ],
    },
    'Managed update plane agent package post-apply sync guidance',
  );
  assertDeepEqualJson(
    agentPlane?.package_agent_ids,
    ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-meta-agent', 'opl-bookforge', 'scholarskills'],
    'Managed update plane agent package ids',
  );
  if (
    agentPlane?.display_group !== 'OPL Packages' ||
    agentPlane?.display_label_en !== 'OPL Packages' ||
    agentPlane?.display_label_zh !== 'OPL 能力包' ||
    agentPlane?.codex_surface_substatus_source !== 'managed_update_plane.codex_surface'
  ) {
    throw new Error('Managed update plane capability package lane must be displayed as OPL Packages with Codex surface as a substatus');
  }
  if (capabilityPlane?.display_group !== 'OPL Packages' || capabilityPlane?.user_visible_channel !== false) {
    throw new Error('Managed update plane Codex surface must stay under OPL Packages instead of a user-visible channel');
  }
  if (
    agentPackageChannel?.background_apply_policy !==
    'apply_after_check_or_plan_when_all_opl_package_components_are_clean_managed_and_update_available'
  ) {
    throw new Error('Managed update plane OPL Packages channel must declare clean managed background auto-apply policy');
  }
  assertDeepEqualJson(
    agentPackageChannel?.background_apply_must_record,
    [
      'last_auto_apply_at',
      'last_auto_apply_component_ids',
      'last_auto_apply_receipt_refs',
      'last_auto_apply_post_apply_hooks',
      'last_auto_apply_skip_reasons',
      'reload_guidance',
    ],
    'Managed update plane OPL Packages background auto-apply receipt projection',
  );
  assertDeepEqualJson(
    agentPackageChannel?.package_agent_ids,
    ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-meta-agent', 'opl-bookforge', 'scholarskills'],
    'Managed update plane OPL Packages package ids',
  );
}

function validateManagedUpdateCompanionToolsLane(companionPlane, companionTools) {
  if (
    companionPlane?.updater_kind !== 'managed_updater_kernel' ||
    companionPlane?.adapter !== 'companion_tools_adapter' ||
    companionPlane?.policy !== 'silent_background_verified_stage_apply_on_next_restart' ||
    companionPlane?.display_group !== 'Companion tools' ||
    companionTools?.must_not_be_grouped_under_runtime_substrate !== true ||
    companionTools?.shared_kernel_lifecycle_allowed !== true
  ) {
    throw new Error('Managed update plane companion tools must be a separate class that may share the managed updater kernel lifecycle');
  }
  assertDeepEqualJson(companionPlane?.managed_tools, ['officecli', 'mineru_open_api'], 'Managed update plane companion tools');
}

function validateManagedUpdateCapabilityLane(capabilityPlane) {
  if (
    capabilityPlane?.updater_kind !== 'managed_visibility_projection' ||
    capabilityPlane?.adapter !== 'codex_surface_status_adapter' ||
    capabilityPlane?.policy !== 'display_codex_surface_visibility_and_repair_actions_without_duplicate_semantics'
  ) {
    throw new Error('Managed update plane Codex surface lane must be a status projection only');
  }
  assertDeepEqualJson(
    capabilityPlane?.status_fields,
    [
      'codex_plugin_registry',
      'plugin_packaged_skills',
      'opl_generated_plugin_surface',
      'conditions',
      'repair_actions',
      'components[].receipt.post_apply_hooks',
      'reload_required',
      'reload_guidance',
    ],
    'Managed update plane Codex surface status fields',
  );
  if (
    capabilityPlane?.reload_guidance !==
    'manual_reload_only_after_framework_reports_needs_reload_or_post_apply_sync_changed_cached_capability_surface'
  ) {
    throw new Error('Managed update plane Codex surface lane must declare post-apply reload guidance');
  }
}

function validateManagedUpdateWorkflowProfileLane(workflowPlane, workflowProfile) {
  if (
    workflowPlane?.updater_kind !== 'semantic_merge_required_profile_sync' ||
    workflowPlane?.adapter !== 'workflow_profile_adapter' ||
    workflowPlane?.policy !== 'semantic_merge_required_no_silent_overwrite' ||
    workflowPlane?.default_update_mode !== 'manual_semantic_merge_when_changed' ||
    workflowProfile?.semantic_merge_required !== true ||
    workflowProfile?.silent_overwrite_allowed !== false
  ) {
    throw new Error('Managed update plane workflow profile updates must require semantic merge');
  }
  assertDeepEqualJson(workflowPlane?.managed_profile_parts, ['AGENTS.md', 'TASTE.md', 'prompts'], 'Managed update plane workflow profile parts');
}

function validateManagedUpdateStandardUpdaterBoundary(standardUpdaterBoundary) {
  assertIncludesAll(
    standardUpdaterBoundary?.forbidden_targets,
    [
      'runtime_substrate',
      'capability_packages',
      'codex_surface',
      'companion_tools',
      'workflow_profile',
      'developer_checkout_selection',
      'homebrew_or_global_tool_upgrade',
      'domain_truth',
    ],
    'Managed update plane standard updater forbidden targets',
  );
  if (
    standardUpdaterBoundary?.plane !== 'installation_carrier.macos_app' ||
    standardUpdaterBoundary?.scope !== 'desktop_app_assets_only' ||
    standardUpdaterBoundary?.updater !== 'electron_standard_updater' ||
    standardUpdaterBoundary?.apply_lifecycle?.downloaded_state_is_not_success !== true ||
    standardUpdaterBoundary?.apply_lifecycle?.apply_started_receipt !== 'auto-update-diagnostics.json#quit-and-install' ||
    standardUpdaterBoundary?.apply_lifecycle?.post_restart_version_gate !== 'running_app_version_must_be_gte_downloaded_target_version' ||
    standardUpdaterBoundary?.apply_lifecycle?.failure_state !== 'install-not-applied' ||
    standardUpdaterBoundary?.apply_lifecycle?.recovery_action !== 'install_downloaded_update_now'
  ) {
    throw new Error('Managed update plane standard updater boundary must verify apply after restart and expose recovery');
  }
}

function validateManagedKernelLifecycle(managedKernel) {
  assertDeepEqualJson(managedKernel?.lifecycle, managedKernelLifecycle, 'Managed update plane lifecycle');
  assertDeepEqualJson(
    managedKernel?.state_vocabulary,
    managedKernelStateVocabulary,
    'Managed update plane state vocabulary',
  );
}

function validateManagedKernelIdempotencyLock(managedKernel) {
  if (
    managedKernel?.idempotency_lock?.lock_id !== 'opl_managed_updater_kernel.global' ||
    managedKernel?.idempotency_lock?.lock_scope !==
      'single_writer_for_fetch_verify_stage_activate_post_apply_write_receipt' ||
    managedKernel?.idempotency_lock?.stale_after_seconds !== 1800 ||
    managedKernel?.idempotency_lock?.contention_policy !==
      'report_in_progress_or_skip_without_parallel_stage_or_plugin_sync'
  ) {
    throw new Error('Managed update plane must declare the Framework updater idempotency lock contract');
  }
  assertDeepEqualJson(
    managedKernel?.idempotency_lock?.exclusive_operations,
    ['apply', 'repair', 'rollback'],
    'Managed update plane exclusive lock operations',
  );
}

function validateManagedKernelShellIntegration(managedUpdatePlane, managedKernel) {
  const shellIntegration = managedUpdatePlane?.shell_integration;

  assertDeepEqualJson(
    shellIntegration?.required_ipc_surfaces,
    managedUpdateIpcSurfaces,
    'Managed update plane shell IPC surfaces',
  );
  assertDeepEqualJson(
    shellIntegration?.allowed_cli_commands,
    managedKernel?.public_cli_surfaces,
    'Managed update plane shell allowed CLI commands',
  );
  assertDeepEqualJson(
    shellIntegration?.background_scheduler,
    managedUpdateScheduler,
    'Managed update plane shell background scheduler',
  );
  assertDeepEqualJson(shellIntegration?.ui_actions, managedUpdateUiActions, 'Managed update plane shell UI actions');
  assertDeepEqualJson(
    shellIntegration?.forbidden_shell_behaviors,
    [
      'read_artifact_body',
      'read_or_write_domain_truth',
      'write_owner_receipt',
      'mutate_dirty_or_developer_checkout',
      'mutate_homebrew_or_system_tools',
      'bypass_framework_update_kernel',
    ],
    'Managed update plane forbidden shell behaviors',
  );
}

function validateManagedKernelCommandAndReceiptPolicy(managedKernel) {
  if (managedKernel?.component_receipt_shape?.schema_version !== 'opl_managed_update_component_receipt.v1') {
    throw new Error('Managed update plane must declare the component receipt schema version');
  }
  assertDeepEqualJson(
    managedKernel?.public_cli_surfaces,
    managedKernelPublicCliSurfaces,
    'Managed update plane public CLI surfaces',
  );
  assertDeepEqualJson(managedKernel?.operation_modes, managedKernelOperationModes, 'Managed update plane operation modes');
  assertDeepEqualJson(
    managedKernel?.receipt_write_policy,
    managedKernelReceiptWritePolicy,
    'Managed update plane receipt write policy',
  );
}

function validateManagedKernelProjectionAndResultFields(managedKernel) {
  assertDeepEqualJson(
    managedKernel?.status_projection_required_fields,
    managedKernelStatusProjectionRequiredFields,
    'Managed update plane status projection required fields',
  );
  assertDeepEqualJson(
    managedKernel?.runner_result_required_fields,
    managedKernelRunnerResultRequiredFields,
    'Managed update plane runner result required fields',
  );
}

function validateManagedKernelReceiptAndConditionShapes(managedKernel) {
  assertDeepEqualJson(
    managedKernel?.component_receipt_shape?.required_fields,
    managedKernelComponentReceiptRequiredFields,
    'Managed update plane component receipt required fields',
  );
  assertDeepEqualJson(
    managedKernel?.component_receipt_shape?.identity_fields,
    managedKernelComponentReceiptIdentityFields,
    'Managed update plane component receipt identity fields',
  );
  assertDeepEqualJson(
    managedKernel?.condition_shape?.required_fields,
    ['type', 'status', 'reason', 'message', 'observed_generation'],
    'Managed update plane condition required fields',
  );
  assertDeepEqualJson(
    managedKernel?.condition_shape?.status_values,
    ['True', 'False', 'Unknown'],
    'Managed update plane condition status values',
  );
  if (managedKernel?.condition_shape?.style !== 'kubernetes_status_conditions') {
    throw new Error('Managed update plane condition shape must use Kubernetes-style status conditions');
  }
}

export function validateManagedUpdatePageBasics(page, label, options = {}) {
  if (options.requirePageContract && page?.page_contract !== 'updates_and_maintenance') {
    throw new Error(`${label} page_contract must be updates_and_maintenance`);
  }
  if (page?.status_source !== 'opl update status --json') {
    throw new Error(`${label} must expose opl update status --json as the explicit status source`);
  }
  if (page?.action_source !== managedUpdateActionSource) {
    throw new Error(options.actionSourceError ?? `${label} must expose managed update actions through shell IPC`);
  }
  assertDeepEqualJson(
    page?.background_maintenance_status_fields,
    managedUpdateBackgroundFields,
    `${label} background maintenance status fields`,
  );
  assertDeepEqualJson(page?.sections, managedUpdateSections, `${label} sections`);
  assertIncludesAll(page?.must_show, managedUpdateMustShow, `${label} must_show`);
  assertIncludesAll(page?.must_not_show, managedUpdateMustNotShow, `${label} must_not_show`);
}

export function validateManagedUpdatePlaneBinding(plane, label, options = {}) {
  if (
    (options.requirePageId && plane?.page_id !== 'updates_and_maintenance') ||
    plane?.source_ref !== 'contracts/app-release-channel.json#managed_update_plane' ||
    plane?.app_role !== 'status_conditions_repair_actions_consumer_only' ||
    plane?.framework_role !== 'managed_update_kernel_owner' ||
    (options.requireStatusConsumptionPolicy && plane?.status_consumption_policy !== managedUpdateStatusConsumptionPolicy)
  ) {
    throw new Error(options.bindingError ?? `${label} must bind to the App managed update plane`);
  }
  if (options.requireStateSources) {
    assertDeepEqualJson(plane?.state_sources, managedUpdateStateSources, `${label} state sources`);
  }
  assertDeepEqualJson(plane?.display_planes, managedUpdateDisplayPlanes, `${label} display planes`);
  assertDeepEqualJson(plane?.background_scheduler, managedUpdateScheduler, `${label} background scheduler`);
  assertDeepEqualJson(plane?.ui_actions, managedUpdateUiActions, `${label} UI actions`);
  assertDeepEqualJson(plane?.ipc_bridge_required, managedUpdateIpcSurfaces, `${label} IPC bridge`);
}
