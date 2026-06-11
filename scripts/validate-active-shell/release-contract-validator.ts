import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { temporalLocalServiceDefaults, temporalManagedCommands } from './app-contract-constants.ts';
import { validateAppReleaseL5ReadoutContract } from '../app-release-l5-readout.ts';

export function validateReleaseChannelContract(releaseChannel) {
  const managedUpdatePlane = releaseChannel.managed_update_plane;
  if (
    managedUpdatePlane?.owner !== 'one-person-lab-app' ||
    managedUpdatePlane?.producer_owner !== 'one-person-lab' ||
    managedUpdatePlane?.ui_page !== 'Updates & Maintenance' ||
    managedUpdatePlane?.framework_role !== 'own_managed_update_kernel_status_conditions_repair_actions_and_apply_execution' ||
    managedUpdatePlane?.managed_kernel?.id !== 'opl_managed_updater_kernel' ||
    managedUpdatePlane?.managed_kernel?.owner !== 'one-person-lab' ||
    managedUpdatePlane?.managed_kernel?.app_role !== 'status_action_projection_consumer' ||
    managedUpdatePlane?.managed_kernel?.app_must_not_implement_kernel !== true ||
    managedUpdatePlane?.managed_kernel?.app_must_not_bypass_action_route !== true ||
    managedUpdatePlane?.status_consumption_policy !==
      'App consumes status, conditions, progress refs, and repair action refs only; App does not read artifact bodies, write domain truth, or implement the Framework update kernel.'
  ) {
    throw new Error('Release channel must declare the App-owned managed update plane as a Framework-kernel status/action consumer');
  }
  assertDeepEqualJson(
    managedUpdatePlane.status_source_priority,
    ['opl app state --profile fast --json#managed_update_plane', 'opl update status --json'],
    'Managed update plane status source priority',
  );
  assertIncludesAll(
    managedUpdatePlane.managed_kernel?.channels_share,
    ['status_schema', 'condition_model', 'download_verify_stage_apply_lifecycle', 'repair_action_refs', 'rollback_receipts'],
    'Managed update plane shared kernel contract',
  );
  assertDeepEqualJson(
    managedUpdatePlane.managed_kernel?.lifecycle,
    [
      'read_manifest',
      'read_current_state',
      'diff_plan',
      'fetch_artifacts',
      'verify',
      'stage',
      'activate',
      'post_apply',
      'write_receipt',
      'report_status_or_repair',
    ],
    'Managed update plane lifecycle',
  );
  assertDeepEqualJson(
    managedUpdatePlane.managed_kernel?.state_vocabulary,
    [
      'current',
      'update_available',
      'staged',
      'needs_restart',
      'needs_reload',
      'failed_with_repair',
      'skipped_manual_required',
    ],
    'Managed update plane state vocabulary',
  );
  if (
    managedUpdatePlane.managed_kernel?.idempotency_lock?.lock_id !== 'opl_managed_updater_kernel.global' ||
    managedUpdatePlane.managed_kernel?.idempotency_lock?.lock_scope !==
      'single_writer_for_fetch_verify_stage_activate_post_apply_write_receipt' ||
    managedUpdatePlane.managed_kernel?.idempotency_lock?.stale_after_seconds !== 1800 ||
    managedUpdatePlane.managed_kernel?.idempotency_lock?.contention_policy !==
      'report_in_progress_or_skip_without_parallel_stage_or_plugin_sync'
  ) {
    throw new Error('Managed update plane must declare the Framework updater idempotency lock contract');
  }
  assertDeepEqualJson(
    managedUpdatePlane.managed_kernel?.idempotency_lock?.exclusive_operations,
    ['apply', 'repair', 'rollback'],
    'Managed update plane exclusive lock operations',
  );
  if (managedUpdatePlane.managed_kernel?.component_receipt_shape?.schema_version !== 'opl_managed_update_component_receipt.v1') {
    throw new Error('Managed update plane must declare the component receipt schema version');
  }
  assertDeepEqualJson(
    managedUpdatePlane.managed_kernel?.component_receipt_shape?.required_fields,
    [
      'source_manifest_ref',
      'from_version',
      'from_digest',
      'to_version',
      'to_digest',
      'verify_result',
      'activated_at',
      'post_apply_hooks',
      'rollback_ref',
      'repair_action',
    ],
    'Managed update plane component receipt required fields',
  );
  assertIncludesAll(
    managedUpdatePlane.forbidden_silent_overwrite_scope,
    [
      'Developer Profile checkout',
      'dirty checkout',
      'domain truth',
      'owner receipt',
      'quality verdict',
      'export verdict',
      'Homebrew/global tools',
    ],
    'Managed update plane forbidden silent overwrite scope',
  );
  assertIncludesAll(
    managedUpdatePlane.forbidden_app_authority,
    [
      'framework_update_kernel_implementation',
      'runtime_truth',
      'domain_truth',
      'owner_receipt_authority',
      'domain_quality_verdict',
      'domain_export_verdict',
      'artifact_body',
      'homebrew_global_tool_mutation',
      'developer_checkout_mutation',
    ],
    'Managed update plane forbidden App authority',
  );
  assertIncludesAll(
    managedUpdatePlane.release_boundary_required_cases,
    [
      'standard_updater_desktop_assets_only',
      'runtime_toolchain_uses_managed_kernel_not_standard_updater',
      'agent_package_channel_uses_managed_kernel_and_post_update_sync',
      'capability_exposure_status_is_projection_only',
      'forbidden_silent_overwrite_scope_fail_closed',
    ],
    'Managed update plane release-boundary cases',
  );

  const planeById = new Map((managedUpdatePlane.planes ?? []).map((plane) => [plane.id, plane]));
  const appBinaryPlane = planeById.get('app_binary');
  if (
    appBinaryPlane?.updater_kind !== 'standard_updater' ||
    appBinaryPlane?.adapter !== 'electron_standard_updater' ||
    appBinaryPlane?.source !== 'GitHub Release standard macOS arm64 updater assets' ||
    appBinaryPlane?.repair_action_scope !== 'app_release_check_or_download_retry_only'
  ) {
    throw new Error('Managed update plane App binary lane must remain the standard desktop updater only');
  }
  const runtimePlane = planeById.get('runtime_toolchain');
  const agentPlane = planeById.get('agent_package_channel');
  if (
    runtimePlane?.updater_kind !== 'managed_updater_kernel' ||
    runtimePlane?.adapter !== 'runtime_toolchain_adapter' ||
    runtimePlane?.policy !== 'silent_background_verified_stage_apply_on_next_restart' ||
    runtimePlane?.post_apply !== 'startup_smoke_then_swap_runtime_current_pointer_with_rollback' ||
    agentPlane?.updater_kind !== 'managed_updater_kernel' ||
    agentPlane?.adapter !== 'agent_package_channel_adapter' ||
    agentPlane?.policy !== 'ordinary_user_non_development_silent_background' ||
    agentPlane?.post_apply !== 'sync_plugin_registry_plugin_packaged_skills_and_oma_generated_plugin_surface'
  ) {
    throw new Error('Managed update plane runtime/toolchain and agent package lanes must share the managed kernel but differ by adapter/policy/post_apply');
  }
  assertDeepEqualJson(
    agentPlane.package_agent_ids,
    ['mas', 'mag', 'rca', 'oma'],
    'Managed update plane agent package ids',
  );
  const capabilityPlane = planeById.get('capability_exposure');
  if (
    capabilityPlane?.updater_kind !== 'managed_visibility_projection' ||
    capabilityPlane?.adapter !== 'codex_exposure_status_adapter' ||
    capabilityPlane?.policy !== 'display_visibility_and_repair_actions_without_duplicate_semantics'
  ) {
    throw new Error('Managed update plane capability exposure lane must be a status projection only');
  }
  assertIncludesAll(
    managedUpdatePlane.standard_updater_boundary?.forbidden_targets,
    [
      'runtime_toolchain',
      'agent_package_channel',
      'capability_exposure',
      'developer_checkout_selection',
      'homebrew_or_global_tool_upgrade',
      'domain_truth',
    ],
    'Managed update plane standard updater forbidden targets',
  );
  if (
    managedUpdatePlane.standard_updater_boundary?.scope !== 'desktop_app_assets_only' ||
    managedUpdatePlane.standard_updater_boundary?.updater !== 'electron_standard_updater'
  ) {
    throw new Error('Managed update plane standard updater boundary must remain desktop App assets only');
  }

  const runtimeUpdater = releaseChannel.runtime_toolchain_updater;
  if (
    runtimeUpdater?.owner !== 'one-person-lab-app' ||
    runtimeUpdater?.role !== 'app_owned_runtime_fallback_and_toolchain_layer_updates' ||
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
    throw new Error('Release channel runtime/toolchain updater must be a silent App-owned runtime fallback channel separate from standard updater and Homebrew');
  }
  assertIncludesAll(
    runtimeUpdater.managed_components,
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
    'Release channel runtime/toolchain updater managed components',
  );
  if (
    runtimeUpdater.layering?.runtime_root !== '~/Library/Application Support/OPL/runtime' ||
    runtimeUpdater.layering?.current_pointer !== '~/Library/Application Support/OPL/runtime/current.json' ||
    runtimeUpdater.layering?.activation !== 'swap_current_pointer_on_app_restart_after_startup_smoke' ||
    runtimeUpdater.layering?.rollback !== 'restore_previous_pointer_when_startup_smoke_fails'
  ) {
    throw new Error('Release channel runtime/toolchain updater must stage runtime layers and atomically activate through the runtime current pointer');
  }
  assertDeepEqualJson(
    runtimeUpdater.system_tool_policy?.preferred_sources,
    ['explicit_user_path', 'system_path', 'homebrew_formula', 'app_owned_runtime_fallback'],
    'Release channel runtime/toolchain updater preferred sources',
  );
  if (
    runtimeUpdater.system_tool_policy?.prefer_valid_newer_system_tool !== true ||
    runtimeUpdater.system_tool_policy?.silent_global_mutation_allowed !== false ||
    runtimeUpdater.system_tool_policy?.homebrew_upgrade_allowed_by_default !== false ||
    runtimeUpdater.system_tool_policy?.user_opt_in_global_upgrade_allowed !== true
  ) {
    throw new Error('Release channel runtime/toolchain updater must detect compatible system tools without silently mutating global Homebrew or system installs');
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
    'Release channel runtime/toolchain updater manifest fields',
  );
  assertIncludesAll(
    runtimeUpdater.verification?.required_before_stage,
    ['manifest_schema', 'asset_sha256', 'minimum_version', 'component_capability_smoke'],
    'Release channel runtime/toolchain updater stage checks',
  );
  assertIncludesAll(
    runtimeUpdater.verification?.required_before_release,
    [
      'standard_dmg_clean_vm_smoke',
      'full_dmg_clean_vm_smoke',
      'homebrew_standard_cask_clean_vm_smoke',
      'remote_release_verification',
    ],
    'Release channel runtime/toolchain updater release checks',
  );
  if (
    runtimeUpdater.verification?.clean_machine_installability_must_not_regress !== true ||
    runtimeUpdater.rollback_policy?.keep_previous_runtime !== true ||
    runtimeUpdater.rollback_policy?.rollback_on_startup_smoke_failure !== true ||
    runtimeUpdater.rollback_policy?.rollback_must_not_mutate_user_global_tools !== true ||
    !/silent download and verified staging/.test(runtimeUpdater.rule ?? '')
  ) {
    throw new Error('Release channel runtime/toolchain updater must preserve clean-machine installability and rollback without global tool mutation');
  }
  if (
    runtimeUpdater.managed_update_plane !== 'runtime_toolchain' ||
    runtimeUpdater.kernel !== 'opl_managed_updater_kernel' ||
    runtimeUpdater.adapter !== 'runtime_toolchain_adapter' ||
    runtimeUpdater.policy !== 'silent_background_verified_stage_apply_on_next_restart' ||
    runtimeUpdater.post_apply !== 'startup_smoke_then_swap_runtime_current_pointer_with_rollback' ||
    runtimeUpdater.app_role !== 'status_conditions_repair_actions_consumer_only'
  ) {
    throw new Error('Release channel runtime/toolchain updater must bind to the managed update plane runtime lane');
  }
  assertDeepEqualJson(
    runtimeUpdater.status_sources,
    [
      'opl app state --profile fast --json#managed_update_plane.runtime_toolchain',
      'opl update status --json#runtime_toolchain',
    ],
    'Release channel runtime updater status sources',
  );
  assertIncludesAll(
    runtimeUpdater.forbidden_silent_overwrite_scope,
    managedUpdatePlane.forbidden_silent_overwrite_scope,
    'Release channel runtime updater forbidden silent overwrite scope',
  );

  const homebrew = releaseChannel.homebrew_tap_distribution;
  if (
    homebrew?.owner !== 'one-person-lab-app' ||
    homebrew?.tap_repo !== 'gaofeng21cn/homebrew-one-person-lab' ||
    homebrew?.role !== 'external_app_cask_index_for_distribution_cohorts' ||
    homebrew?.cohort_manifest_required !== true
  ) {
    throw new Error('Release channel Homebrew tap distribution must be an App-owned cask cohort install index');
  }
  assertDeepEqualJson(homebrew.formulae, [], 'Release channel Homebrew formulae');
  assertDeepEqualJson(homebrew.casks, ['one-person-lab', 'one-person-lab-full'], 'Release channel Homebrew casks');
  assertDeepEqualJson(
    homebrew.initial_live_targets,
    ['Casks/one-person-lab.rb', 'Casks/one-person-lab-nightly.rb', 'Casks/one-person-lab-full.rb'],
    'Release channel Homebrew initial live targets',
  );
  assertDeepEqualJson(
    homebrew.forbidden_formulae,
    ['one-person-lab-modules', 'one-person-lab-modules-nightly'],
    'Release channel forbidden Homebrew formulae',
  );
  assertDeepEqualJson(homebrew.excluded_casks, [], 'Release channel excluded Homebrew casks');
  assertDeepEqualJson(homebrew.full_casks, ['one-person-lab-full'], 'Release channel Full Homebrew casks');
  assertDeepEqualJson(homebrew.nightly_formulae, [], 'Release channel Homebrew nightly formulae');
  assertDeepEqualJson(homebrew.nightly_casks, ['one-person-lab-nightly'], 'Release channel Homebrew nightly casks');
  if (
    homebrew.tap_update_policy?.discovery_model !== 'user_taps_github_homebrew_tap_repo_then_homebrew_reads_formula_or_cask' ||
    homebrew.tap_update_policy?.download_source !== 'app_owned_github_release_asset_url' ||
    homebrew.tap_update_policy?.default_remote_write_path !== 'tap_repo_github_actions_self_sync_direct_commit_after_tap_check' ||
    homebrew.tap_update_policy?.default_workflow_repo !== 'gaofeng21cn/homebrew-one-person-lab' ||
    homebrew.tap_update_policy?.default_workflow !== '.github/workflows/sync-from-app-releases.yml' ||
    homebrew.tap_update_policy?.tap_sync_script !== 'scripts/sync-cask-from-release.mjs' ||
    homebrew.tap_update_policy?.app_release_direct_workflow !== '.github/workflows/homebrew-tap-update.yml' ||
    homebrew.tap_update_policy?.app_release_direct_token !== 'OPL_HOMEBREW_TAP_TOKEN' ||
    homebrew.tap_update_policy?.app_release_pull_request_allowed !== false ||
    homebrew.tap_update_policy?.app_release_workflow_write_mode !== 'direct_commit_only' ||
    homebrew.tap_update_policy?.stable_release_workflow_write_mode !== 'new_release_promote_direct_commit_after_publish_before_homebrew_vm_gate; refresh_existing_published_release_direct_commit_after_remote_verification_before_homebrew_vm_gate; refresh_existing_draft_release_defer_to_promote_after_publish' ||
    homebrew.tap_update_policy?.planner_script !== 'scripts/update-homebrew-tap.ts' ||
    homebrew.tap_update_policy?.nightly?.mode !== 'tap_repo_scheduled_self_sync_to_nightly_cask' ||
    homebrew.tap_update_policy?.nightly?.may_update_stable !== false ||
    homebrew.tap_update_policy?.stable?.mode !== 'new_release_desktop_promote_direct_commit_after_published_release_before_homebrew_vm_gate; refresh_existing_published_release_desktop_release_direct_commit_after_remote_verification_before_homebrew_vm_gate; refresh_existing_draft_release_desktop_promote_after_publish_before_homebrew_vm_gate' ||
    homebrew.tap_update_policy?.stable?.may_consume_nightly_directly !== false ||
    homebrew.tap_update_policy?.full?.mode !== 'stable_full_first_install_cask_after_full_release_gates' ||
    homebrew.tap_update_policy?.full?.may_update_standard_cask !== false ||
    homebrew.tap_update_policy?.full?.may_update_nightly_cask !== false ||
    homebrew.tap_update_policy?.full?.manifest !== 'full-package-manifest.json' ||
    homebrew.tap_update_policy?.full?.standard_updater_visible !== false
  ) {
    throw new Error('Release channel Homebrew tap update policy must use tap self-sync and separate nightly automation from stable promotion');
  }
  const homebrewVmGate = releaseChannel.release_acceleration?.vm_gates?.find(
    (gate: { id?: string }) => gate.id === 'homebrew_standard_cask_clean_vm_smoke',
  );
  if (
    homebrewVmGate?.install_mode !== 'homebrew-cask' ||
    homebrewVmGate?.source_vm_variable !== 'OPL_FIRST_RUN_HOMEBREW_TART_SOURCE'
  ) {
    throw new Error('Release channel Homebrew VM smoke must use the dedicated Homebrew-ready Tart source variable');
  }
  assertIncludesAll(
    homebrew.tap_update_policy?.required_manifest_fields,
    ['channel', 'artifact', 'sha256', 'manifest_url', 'local_authorization_policy_asset'],
    'Release channel Homebrew cohort manifest fields',
  );
  if (
    homebrew.agent_pack_policy?.package_kind !== 'app_cli_managed_agent_packs' ||
    homebrew.agent_pack_policy?.semantic_authority !== 'one-person-lab_and_domain_repositories' ||
    homebrew.agent_pack_policy?.homebrew_role !== 'not_a_distribution_target' ||
    homebrew.agent_pack_policy?.activation_owner !== 'app_cli_managed_background_maintenance' ||
    homebrew.agent_pack_policy?.default_update_mode !== 'silent_background' ||
    homebrew.agent_pack_policy?.default_manifest_tag !== 'latest' ||
    homebrew.agent_pack_policy?.homebrew_distribution_allowed !== false ||
    homebrew.agent_pack_policy?.homebrew_formula_allowed !== false ||
    homebrew.agent_pack_policy?.must_not_write_user_codex_state !== true ||
    homebrew.agent_pack_policy?.must_not_define_agent_semantics !== true ||
    homebrew.full_first_install_policy !== 'stable_full_cask_or_github_release_first_install_asset; never standard updater metadata'
  ) {
    throw new Error('Release channel Homebrew agent-pack policy must keep agent packs outside Homebrew distribution');
  }
  if (
    homebrew.agent_pack_policy?.managed_update_plane !== 'agent_package_channel' ||
    homebrew.agent_pack_policy?.kernel !== 'opl_managed_updater_kernel' ||
    homebrew.agent_pack_policy?.source_role !== 'ordinary_user_non_development_agent_update_source' ||
    homebrew.agent_pack_policy?.registry !== 'ghcr.io' ||
    homebrew.agent_pack_policy?.adapter !== 'agent_package_channel_adapter' ||
    homebrew.agent_pack_policy?.policy !== 'ordinary_user_non_development_silent_background' ||
    homebrew.agent_pack_policy?.post_apply !== 'sync_plugin_registry_plugin_packaged_skills_and_oma_generated_plugin_surface' ||
    homebrew.agent_pack_policy?.developer_checkout_override_policy !== 'explicit_developer_profile_source_channel_only'
  ) {
    throw new Error('Release channel agent-pack policy must bind GHCR agent packages to the managed update plane');
  }
  assertDeepEqualJson(
    homebrew.agent_pack_policy?.managed_agent_ids,
    ['mas', 'mag', 'rca', 'oma'],
    'Release channel managed update agent ids',
  );
  assertIncludesAll(
    homebrew.agent_pack_policy?.forbidden_silent_overwrite_scope,
    managedUpdatePlane.forbidden_silent_overwrite_scope,
    'Release channel agent-pack forbidden silent overwrite scope',
  );
  assertIncludesAll(
    homebrew.agent_pack_policy?.post_update_sync_required,
    ['codex_plugin_registry', 'plugin_packaged_skills', 'opl_generated_plugin_surface'],
    'Release channel Homebrew agent-pack post-update sync requirements',
  );
  assertIncludesAll(
    homebrew.agent_pack_policy?.activation_commands,
    ['opl connect reconcile-modules', 'opl connect sync-skills'],
    'Release channel Homebrew agent-pack activation commands',
  );
  assertDeepEqualJson(
    homebrew.agent_pack_policy?.forbidden_formulae,
    ['one-person-lab-modules', 'one-person-lab-modules-nightly'],
    'Release channel agent-pack forbidden formulae',
  );
  if (
    homebrew.codex_temporal_policy?.compatibility_mode !== 'minimum_version_plus_capability_smoke' ||
    homebrew.codex_temporal_policy?.prefer_valid_newer_system_tool !== true ||
    homebrew.codex_temporal_policy?.bundled_fallback_allowed !== true
  ) {
    throw new Error('Release channel Codex/Temporal policy must prefer compatible newer user tools with bundled fallback');
  }

  const codexCli = releaseChannel.full_first_install?.required_payloads?.codex_cli;
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

  const temporalCli = releaseChannel.full_first_install?.required_payloads?.temporal_cli;
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

  const temporalRuntimeProvider = releaseChannel.full_first_install?.required_payloads?.temporal_runtime_provider;
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

export function validateReleaseEvidenceBundle(releaseChannel, pageStateMatrix, firstRunMatrix) {
  const bundle = releaseChannel.operator_evidence_bundle;
  if (bundle?.purpose !== 'runtime_page_operator_evidence_acceptance') {
    throw new Error('Release channel must declare operator_evidence_bundle purpose');
  }
  if (bundle.acceptance_path !== 'Runtime page') {
    throw new Error(`Unexpected operator evidence acceptance path: ${bundle.acceptance_path}`);
  }
  if (bundle.runtime_page_contract !== 'contracts/app-page-state-matrix.json#runtime') {
    throw new Error(`Unexpected runtime page contract ref: ${bundle.runtime_page_contract}`);
  }
  if (bundle.refs_only !== true) {
    throw new Error('Operator evidence bundle must be refs-only');
  }
  if (bundle.manifest_path !== 'evidence-manifest.json') {
    throw new Error(`Unexpected operator evidence manifest path: ${bundle.manifest_path}`);
  }
  if (bundle.missing_evidence_policy?.default_validation !== 'fail_closed') {
    throw new Error('Operator evidence bundle missing evidence policy must fail closed by default');
  }
  if (bundle.missing_evidence_policy?.allow_missing_evidence_flag !== '--allow-missing-evidence') {
    throw new Error('Operator evidence bundle missing evidence policy must declare --allow-missing-evidence');
  }
  if (bundle.missing_evidence_policy?.missing_status !== 'missing_evidence') {
    throw new Error('Operator evidence bundle missing evidence policy must declare missing_evidence status');
  }
  if (
    !Array.isArray(bundle.missing_evidence_policy?.allowed_artifact_statuses) ||
    !['present', 'missing', 'typed_blocker', 'not_applicable'].every((status) =>
      bundle.missing_evidence_policy.allowed_artifact_statuses.includes(status)
    )
  ) {
    throw new Error('Operator evidence bundle must declare present, missing, typed_blocker, and not_applicable statuses');
  }
  if (
    !Array.isArray(bundle.missing_evidence_policy?.typed_blocker_status_requires) ||
    !['reason', 'typed_blocker_ref'].every((field) =>
      bundle.missing_evidence_policy.typed_blocker_status_requires.includes(field)
    )
  ) {
    throw new Error('Operator evidence bundle typed_blocker status must require reason and typed_blocker_ref');
  }
  if (bundle.missing_evidence_policy?.typed_blocker_path_pattern !== 'typed-blockers/<artifact_id>.json') {
    throw new Error('Operator evidence bundle typed_blocker path pattern must be typed-blockers/<artifact_id>.json');
  }
  if (
    !Array.isArray(bundle.missing_evidence_policy?.not_applicable_status_requires) ||
    !['reason', 'not_applicable_reason'].every((field) =>
      bundle.missing_evidence_policy.not_applicable_status_requires.includes(field)
    )
  ) {
    throw new Error('Operator evidence bundle not_applicable status must require reason and not_applicable_reason');
  }
  if (bundle.missing_evidence_policy?.packaged_app_evidence_requires !== 'all_required_artifacts_present_and_verified') {
    throw new Error('Operator evidence bundle must require all artifacts before claiming packaged App evidence');
  }
  if (
    bundle.image_evidence_policy?.applies_to_kind !== 'image'
    || bundle.image_evidence_policy?.minimum_width_px !== 640
    || bundle.image_evidence_policy?.minimum_height_px !== 360
    || bundle.image_evidence_policy?.minimum_file_size_bytes !== 4096
    || bundle.image_evidence_policy?.placeholder_screenshot_allowed !== false
  ) {
    throw new Error('Operator evidence bundle image policy must reject placeholder screenshots');
  }
  validateAppReleaseL5ReadoutContract(bundle.l5_evidence_readout);

  const artifactById = new Map((bundle.required_artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const requiredArtifacts = {
    app_state_summary: {
      path: 'app-state-summary.json',
      producer: 'opl app state --profile fast --json',
      kind: 'json',
      source_kind: 'opl_app_state_summary',
    },
    app_state_full: {
      path: 'app-state-full.json',
      producer: 'opl app state --profile full --json',
      kind: 'json',
      source_kind: 'opl_app_state_full',
    },
    drilldown_full: {
      path: 'drilldown-full.json',
      producer: 'opl runtime app-operator-drilldown --detail full --json',
      kind: 'json',
      source_kind: 'opl_app_operator_drilldown_full',
    },
    action_dry_run_result: {
      path: 'action-dry-run-result.json',
      producer: 'opl app action execute --action <action_id> --dry-run --json',
      kind: 'json',
      source_kind: 'opl_app_action_dry_run',
    },
    action_execute_result: {
      path: 'action-execute-result.json',
      producer: 'opl app action execute --action <action_id> --json',
      kind: 'json',
      source_kind: 'opl_app_action_execute',
    },
    runtime_screenshot: {
      path: 'screenshots/runtime.png',
      producer: 'Runtime page screenshot',
      kind: 'image',
      source_kind: 'app_runtime_page_screenshot',
    },
    full_screenshot: {
      path: 'screenshots/full.png',
      producer: 'Full first-install release screenshot',
      kind: 'image',
      source_kind: 'full_first_install_release_screenshot',
    },
    action_screenshot: {
      path: 'screenshots/action.png',
      producer: 'Runtime action confirmation/result screenshot',
      kind: 'image',
      source_kind: 'app_runtime_action_screenshot',
    },
    first_run_vm_summary: {
      path: 'tart-smoke-summary.json',
      producer: 'clean first-run VM smoke',
      kind: 'json',
      source_kind: 'clean_first_run_vm_smoke',
    },
    guest_smoke_summary: {
      path: 'artifacts/smoke-summary.json',
      producer: 'packaged GUI first-run guest smoke',
      kind: 'json',
      source_kind: 'packaged_gui_first_run_smoke',
    },
    codex_functional_check_summary: {
      path: 'artifacts/codex-functional-check-summary.json',
      producer: 'packaged GUI Codex post-install functional check',
      kind: 'json',
      source_kind: 'packaged_gui_codex_functional_check',
    },
    remote_release_verification: {
      path: 'remote-release-verification.json',
      producer: 'npm run verify-remote-release -- --version <version> --include-full-package --summary-path remote-release-verification.json',
      kind: 'json',
      source_kind: 'remote_release_verification',
    },
  };
  for (const [id, expected] of Object.entries(requiredArtifacts)) {
    const artifact = artifactById.get(id);
    if (!artifact) {
      throw new Error(`Operator evidence bundle missing artifact ${id}`);
    }
    for (const [field, expectedValue] of Object.entries(expected)) {
      if (artifact[field] !== expectedValue) {
        throw new Error(`Operator evidence bundle artifact ${id}.${field} must be ${expectedValue}`);
      }
    }
  }
  const optionalArtifactById = new Map((bundle.optional_diagnostic_artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const codexAiSelfCheck = optionalArtifactById.get('codex_ai_self_check_summary');
  if (!codexAiSelfCheck) {
    throw new Error('Operator evidence bundle missing optional diagnostic artifact codex_ai_self_check_summary');
  }
  for (const [field, expectedValue] of Object.entries({
    path: 'artifacts/codex-ai-self-check-summary.json',
    producer: 'packaged GUI Codex AI-first post-install self-check',
    kind: 'json',
    source_kind: 'packaged_gui_codex_ai_self_check',
  })) {
    if (codexAiSelfCheck[field] !== expectedValue) {
      throw new Error(`Operator evidence bundle optional diagnostic codex_ai_self_check_summary.${field} must be ${expectedValue}`);
    }
  }

  const runtimePage = (pageStateMatrix.pages ?? []).find((page) => page.id === 'runtime');
  if (runtimePage?.operator_evidence_acceptance_path?.summary_state_command !== requiredArtifacts.app_state_summary.producer) {
    throw new Error('Runtime page summary state command must match release evidence bundle producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.refresh_state_command !== requiredArtifacts.app_state_summary.producer) {
    throw new Error('Runtime page refresh state command must match the fast App state summary producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.full_drilldown_command !== requiredArtifacts.drilldown_full.producer) {
    throw new Error('Runtime page full drilldown command must match release evidence bundle producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.action_dry_run_command !== requiredArtifacts.action_dry_run_result.producer) {
    throw new Error('Runtime page dry-run command must match release evidence bundle producer');
  }
  if (runtimePage?.operator_evidence_acceptance_path?.action_execute_command !== requiredArtifacts.action_execute_result.producer) {
    throw new Error('Runtime page execute command must match release evidence bundle producer');
  }

  const fullFirstInstall = (firstRunMatrix.scenarios ?? []).find((scenario) => scenario.id === 'full_first_install_clean_machine');
  for (const artifactPath of [
    'tart-smoke-summary.json',
    'artifacts/smoke-summary.json',
    'artifacts/settings-smoke-summary.json',
    'artifacts/codex-functional-check-summary.json',
  ]) {
    if (!fullFirstInstall?.release_evidence_artifacts?.includes(artifactPath)) {
      throw new Error(`Full first-install first-run scenario must list release evidence artifact ${artifactPath}`);
    }
  }

  for (const forbidden of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    if (!bundle.forbidden_authority?.includes(forbidden)) {
      throw new Error(`Operator evidence bundle must exclude ${forbidden}`);
    }
  }
}
