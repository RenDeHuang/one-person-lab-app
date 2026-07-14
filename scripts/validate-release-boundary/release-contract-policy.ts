import fs from 'node:fs';
import path from 'node:path';

const requiredHomebrewStandardCaskRef = 'gaofeng21cn/one-person-lab/one-person-lab';
const requiredHomebrewTrustedCaskRefs = [
  'gaofeng21cn/one-person-lab/one-person-lab',
  'gaofeng21cn/one-person-lab/one-person-lab-full',
  'gaofeng21cn/one-person-lab/one-person-lab-nightly',
];
const requiredHomebrewTrustScope = 'explicit_standard_and_conflicting_cask_refs_not_whole_tap';
const requiredReusableGateIds = [
  'remote_release_verification',
  'standard_dmg_clean_vm',
  'stable_homebrew_tap_update',
  'full_homebrew_tap_update',
  'homebrew_standard_cask_clean_vm',
  'full_dmg_clean_vm',
  'one_shot_app_installer',
  'docker_webui',
  'webui_ghcr_publish',
  'full_size_cache_timing',
  'operator_evidence_bundle',
];
const requiredGateReuseMatchFields = [
  'cohort',
  'version',
  'release_mode',
  'include_full_package',
  'run_vm_smoke',
  'app_commit',
  'shell_ref',
  'framework_ref',
  'resolved_ref_sha',
  'remote_asset_name_size_sha256',
  'previous_gate_status_passed',
  'previous_candidate_status_ready_to_promote',
  'reuse_digest',
];
const requiredSourceGateChecks = [
  'release_source_gate_contract',
  'app_sha',
  'shell_ref_format',
  'shell_ref_resolves_to_sha',
  'framework_ref_resolves_to_sha',
];
const requiredSourceGateScopes = [
  'App release-boundary contract',
  'shell format',
  'shell type',
  'active shell node/dom tests',
  'shell ref resolution',
  'framework ref resolution',
];
const requiredSourceGatePrecedes = [
  'standard_macos_arm64_build',
  'full_first_install_build',
  'standard_dmg_clean_vm_smoke',
  'homebrew_standard_cask_clean_vm_smoke',
  'full_dmg_clean_vm_smoke',
  'webui_ghcr_publish',
];
const requiredTartPrebakeReceiptFields = [
  'source_vm',
  'image_id_or_digest',
  'created_at',
  'profile',
  'prebaked_layers',
  'truth_boundary',
  'validation_command',
];
const requiredReleaseMonitorStatusFields = [
  'phase',
  'state',
  'current_job',
  'current_step',
  'elapsed_seconds',
  'warning_after_seconds',
  'timeout_after_seconds',
  'primary_blocker',
  'recommended_next_action',
];
const requiredReleaseMonitorPhaseBudgets = {
  vm_smoke: {
    jobs: [
      'standard-first-run-vm-smoke-after-standard-only',
      'standard-first-run-vm-smoke-after-full',
      'full-first-run-vm-smoke',
    ],
    warning_after_seconds: 2700,
    timeout_after_seconds: 4500,
    primary_blocker: 'vm_smoke_timeout_or_failure',
    recommended_next_actions: {
      warning: 'wait_for_runner_capacity',
      timeout: 'rerun_diagnostic_same_artifact',
      diagnostic: 'rerun_diagnostic_same_artifact',
    },
  },
  full_build: {
    jobs: [
      'full-first-install',
      'publish-full-assets',
    ],
    warning_after_seconds: 3600,
    timeout_after_seconds: 5400,
    primary_blocker: 'full_build_timeout_or_failure',
    recommended_next_actions: {
      warning: 'inspect_full_build_diagnostics',
      timeout: 'rerun_full_build_same_cohort',
      diagnostic: 'inspect_full_build_diagnostics',
    },
  },
  homebrew: {
    jobs: [
      'stable-distribution',
      'homebrew-standard-vm',
      'homebrew-full-vm',
      'homebrew-activation',
    ],
    warning_after_seconds: 1800,
    timeout_after_seconds: 3600,
    primary_blocker: 'homebrew_tap_or_cask_gate_failure',
    recommended_next_actions: {
      warning: 'inspect_homebrew_tap_diagnostics',
      timeout: 'inspect_homebrew_tap_diagnostics',
      diagnostic: 'inspect_homebrew_tap_diagnostics',
    },
  },
  webui_ghcr: {
    jobs: [
      'docker-webui-smoke',
      'webui-ghcr-publish',
    ],
    warning_after_seconds: 1800,
    timeout_after_seconds: 3600,
    primary_blocker: 'webui_runtime_image_or_ghcr_publish_failure',
    recommended_next_actions: {
      warning: 'inspect_webui_runtime_image_diagnostics',
      timeout: 'inspect_webui_runtime_image_diagnostics',
      diagnostic: 'inspect_webui_runtime_image_diagnostics',
    },
  },
};

function readJson(appRoot: string, relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

function sameStringSet(actual: unknown, expected: string[]) {
  return (
    Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((entry) => actual.includes(entry))
  );
}

function stringArrayIncludesAll(actual: unknown, expected: string[]) {
  return Array.isArray(actual) && expected.every((entry) => actual.includes(entry));
}

function validateReleaseMonitorPolicy(releaseMonitor: Record<string, any>, typedNextActions: unknown): number {
  let failures = 0;
  if (
    releaseMonitor?.schema !== 'opl_app_release_monitor.v1' ||
    releaseMonitor?.mode !== 'no_watch' ||
    releaseMonitor?.surface !== 'release_operator_status' ||
    releaseMonitor?.status_command !== 'npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha>'
  ) {
    console.error('FAIL release_monitor_policy: release monitor must expose the no-watch operator status surface and command');
    failures += 1;
  }
  if (!sameStringSet(releaseMonitor?.required_status_fields, requiredReleaseMonitorStatusFields)) {
    console.error('FAIL release_monitor_policy: release monitor must require phase, state, job, step, elapsed, budget, blocker, and next action fields');
    failures += 1;
  }
  for (const [phase, expectedBudget] of Object.entries(requiredReleaseMonitorPhaseBudgets)) {
    const budget = releaseMonitor?.phase_budgets?.[phase];
    if (
      budget?.phase !== phase ||
      budget?.warning_after_seconds !== expectedBudget.warning_after_seconds ||
      budget?.timeout_after_seconds !== expectedBudget.timeout_after_seconds ||
      budget?.primary_blocker !== expectedBudget.primary_blocker ||
      !sameStringSet(budget?.jobs, expectedBudget.jobs) ||
      budget?.recommended_next_actions?.warning !== expectedBudget.recommended_next_actions.warning ||
      budget?.recommended_next_actions?.timeout !== expectedBudget.recommended_next_actions.timeout ||
      budget?.recommended_next_actions?.diagnostic !== expectedBudget.recommended_next_actions.diagnostic
    ) {
      console.error(`FAIL release_monitor_policy: phase budget ${phase} must define jobs, warning/timeout seconds, blocker, and typed next actions`);
      failures += 1;
    }
    for (const action of Object.values(expectedBudget.recommended_next_actions)) {
      if (!Array.isArray(typedNextActions) || !typedNextActions.includes(action)) {
        console.error(`FAIL release_monitor_policy: typed next actions must include ${action} for phase ${phase}`);
        failures += 1;
      }
    }
  }
  const webuiClassification = releaseMonitor?.failure_classification?.webui_docker_runtime_image_failure;
  if (
    webuiClassification?.classification !== 'runtime_image_publish_gate_failure' ||
    webuiClassification?.source_gate_failure !== false ||
    webuiClassification?.primary_blocker !== 'webui_runtime_image_invalid' ||
    webuiClassification?.recommended_next_action !== 'inspect_webui_runtime_image_diagnostics'
  ) {
    console.error('FAIL release_monitor_policy: WebUI Docker runtime image failures must be runtime image publish gate failures, not source gate failures');
    failures += 1;
  }
  if (
    typeof releaseMonitor?.authority_boundary !== 'string' ||
    !releaseMonitor.authority_boundary.includes('not release truth') ||
    !releaseMonitor.authority_boundary.includes('cannot publish a release') ||
    !releaseMonitor.authority_boundary.includes('cannot write runtime truth') ||
    !releaseMonitor.authority_boundary.includes('cannot claim release-ready') ||
    !releaseMonitor.authority_boundary.includes('same-cohort evidence') ||
    !releaseMonitor.authority_boundary.includes('release candidate record') ||
    !releaseMonitor.authority_boundary.includes('owner receipt')
  ) {
    console.error('FAIL release_monitor_policy: monitor authority boundary must keep release truth on same-cohort evidence, candidate, and owner receipt');
    failures += 1;
  }
  return failures;
}

function validateGithubReleaseName(releaseContract: Record<string, any>): number {
  const releaseName = releaseContract.github_release_name;
  if (
    releaseName?.format !== 'One Person Lab v<version>' ||
    releaseName?.stable_example !== 'One Person Lab v26.6.5' ||
    releaseName?.nightly_example !== 'One Person Lab v26.6.5-nightly.123456789.1' ||
    releaseName?.stable_version_pattern !== '^[0-9]{2}\\.(?:[1-9]|1[0-2])\\.(?:[1-9]|[12][0-9]|3[01])$' ||
    releaseName?.nightly_version_pattern !== '^[0-9]{2}\\.(?:[1-9]|1[0-2])\\.(?:[1-9]|[12][0-9]|3[01])-nightly\\.[1-9][0-9]*\\.[1-9][0-9]*$' ||
    releaseName?.tag_pattern !== 'v<version>'
  ) {
    console.error('FAIL github_release_name: release names must use One Person Lab v<version> for Stable and Nightly while tags stay v<version>');
    return 1;
  }
  return 0;
}

function validateReleaseImmutability(releaseContract: Record<string, any>): number {
  const standardDraft = releaseContract.standard_updater?.draft_refresh;
  const fullDraft = releaseContract.full_first_install?.draft_refresh;
  const nightly = releaseContract.nightly_standard;
  if (
    standardDraft?.allowed !== true ||
    standardDraft?.published_release_mutation_allowed !== false ||
    standardDraft?.mode !== 'unpublished_draft_prebuilt_assets_upload_clobber' ||
    fullDraft?.allowed !== true ||
    fullDraft?.published_release_mutation_allowed !== false ||
    fullDraft?.mode !== 'unpublished_draft_release_upload_clobber' ||
    nightly?.tag_pattern !== 'v<YY.M.D>-nightly.<github_run_id>.<github_run_attempt>' ||
    nightly?.prerelease !== true ||
    nightly?.latest_release_allowed !== false
  ) {
    console.error('FAIL release_immutability: only unpublished drafts may refresh and every Nightly attempt must have a unique immutable version');
    return 1;
  }
  return 0;
}

function validateStandardUpdaterCompressionPolicy(appRoot: string, releaseContract: Record<string, any>): number {
  let failures = 0;
  const compression = releaseContract.standard_updater?.dmg_compression;
  const activeShellRoot = process.env.OPL_APP_SHELL_ROOT || process.env.OPL_AION_SHELL_ROOT || path.join(appRoot, 'shells/aionui');
  const electronBuilderConfig = fs.readFileSync(
    path.join(activeShellRoot, 'packages/desktop/electron-builder.yml'),
    'utf8',
  );

  if (
    compression?.default_format !== 'ULFO' ||
    compression?.format_owner !== 'shells/aionui/packages/desktop/electron-builder.yml#dmg.format' ||
    compression?.electron_builder_version !== '26.8.1' ||
    compression?.ulmo_standard_default_allowed !== false ||
    compression?.ulmo_postprocess_status !== 'separate_experiment_required' ||
    !sameStringSet(compression?.electron_builder_supported_formats, ['UDBZ', 'UDCO', 'UDRO', 'UDRW', 'UDZO', 'ULFO'])
  ) {
    console.error('FAIL standard_updater_dmg_compression: standard DMG compression must default to electron-builder-supported ULFO and keep ULMO as a separate experiment');
    failures += 1;
  }
  if (!/dmg:[\s\S]*format:\s+ULFO/.test(electronBuilderConfig)) {
    console.error('FAIL standard_updater_dmg_compression: active shell electron-builder.yml must use ULFO for standard DMGs');
    failures += 1;
  }
  if (
    typeof compression?.metadata_blockmap_gate !== 'string' ||
    !compression.metadata_blockmap_gate.includes('validate-release.ts') ||
    !compression.metadata_blockmap_gate.includes('hdiutil imageinfo/verify') ||
    typeof compression?.rule !== 'string' ||
    !compression.rule.includes('does not accept ULMO') ||
    !compression.rule.includes('ZIP blockmap') ||
    !compression.rule.includes('latest-arm64-mac.yml')
  ) {
    console.error('FAIL standard_updater_dmg_compression: compression policy must preserve updater metadata and blockmap verification boundaries');
    failures += 1;
  }

  return failures;
}

function validateReleasePreflightContract(releaseContract: Record<string, any>): number {
  let failures = 0;
  const preflight = releaseContract.release_preflight;
  if (
    preflight?.script !== 'scripts/validate-release-preflight.ts' ||
    preflight?.package_script !== 'release:preflight' ||
    preflight?.workflow_job !== 'release-preflight' ||
    preflight?.failure_budget !== 'fail before standard or Full builds start'
  ) {
    console.error('FAIL release_preflight_contract: release_preflight must define script, package script, workflow job, and fast failure budget');
    failures += 1;
  }
  for (const checkId of [
    'version',
    'release_date',
    'release_mode',
    'release_intent',
    'release_operator_plan',
    'release_preflight_contract',
    'workflow_preflight_shape',
    'release_plan',
    'release_refs',
    'codex_package_metadata',
    'homebrew_vm_gate_static_policy',
    'homebrew_tap_token',
    'macos_local_authorization',
    'remote_target',
  ]) {
    if (!preflight?.required_fast_checks?.includes(checkId)) {
      console.error(`FAIL release_preflight_contract: missing required fast check ${checkId}`);
      failures += 1;
    }
  }
  for (const artifact of ['release-preflight-summary.json', 'release-preflight-summary.md']) {
    if (!preflight?.summary_artifacts?.includes(artifact)) {
      console.error(`FAIL release_preflight_contract: missing summary artifact ${artifact}`);
      failures += 1;
    }
  }
  for (const checkId of requiredSourceGateChecks) {
    if (!preflight?.required_fast_checks?.includes(checkId)) {
      console.error(`FAIL release_source_gate_contract: missing source gate fast check ${checkId}`);
      failures += 1;
    }
  }
  const sourceGate = preflight?.source_gate;
  if (
    sourceGate?.package_script !== 'release:source-gate' ||
    sourceGate?.status !== 'implemented_enforced_before_expensive_release_jobs' ||
    sourceGate?.failure_next_action !== 'repair_source_gate' ||
    typeof sourceGate?.rule !== 'string' ||
    !sourceGate.rule.includes('fail before expensive build, VM, Full, Homebrew, or WebUI work')
  ) {
    console.error('FAIL release_source_gate_contract: source gate must be a contracted fail-fast pre-expensive-gate boundary');
    failures += 1;
  }
  if (!sameStringSet(sourceGate?.scope, requiredSourceGateScopes)) {
    console.error('FAIL release_source_gate_contract: source gate scope must cover release-boundary, shell format/type/tests/ref, and framework ref');
    failures += 1;
  }
  if (!sameStringSet(sourceGate?.must_run_before, requiredSourceGatePrecedes)) {
    console.error('FAIL release_source_gate_contract: source gate must precede build, VM, Full, Homebrew, and WebUI work');
    failures += 1;
  }
  if (
    typeof preflight?.rule !== 'string' ||
    !preflight.rule.includes('preflight and the source gate before starting expensive standard, Full, VM, Homebrew, WebUI, or publish jobs')
  ) {
    console.error('FAIL release_source_gate_contract: release preflight rule must require source gate before expensive jobs');
    failures += 1;
  }
  return failures;
}

function validateHomebrewVmGateStaticPolicy(
  appRoot: string,
  releaseContract: Record<string, any>,
  firstRunMatrix: Record<string, any>,
): number {
  let failures = 0;
  const homebrewVmScenario = Array.isArray(firstRunMatrix.scenarios)
    ? firstRunMatrix.scenarios.find((scenario) => scenario.id === 'homebrew_standard_cask_clean_vm_smoke')
    : null;
  const homebrewVm = homebrewVmScenario?.vm;
  const homebrewPolicy = releaseContract.homebrew_tap_distribution?.cask_install_policy;
  const workflowVmText = fs.readFileSync(path.join(appRoot, '.github/workflows/opl-first-run-vm.yml'), 'utf8');
  const releasePlanText = fs.readFileSync(path.join(appRoot, 'scripts/plan-release-candidate.ts'), 'utf8');
  const preflightText = fs.readFileSync(path.join(appRoot, 'scripts/validate-release-preflight.ts'), 'utf8');

  if (
    homebrewVm?.homebrew_cask_install_ref !== requiredHomebrewStandardCaskRef ||
    homebrewPolicy?.standard_cask_install_ref !== requiredHomebrewStandardCaskRef ||
    !workflowVmText.includes(`homebrew_cask=${requiredHomebrewStandardCaskRef}`) ||
    !releasePlanText.includes(`--homebrew-cask ${requiredHomebrewStandardCaskRef}`) ||
    !preflightText.includes(`const requiredHomebrewStandardCaskRef = '${requiredHomebrewStandardCaskRef}'`)
  ) {
    console.error('FAIL homebrew_vm_gate_static_policy: standard Homebrew VM gate must install the fully qualified App cask ref');
    failures += 1;
  }
  if (
    !sameStringSet(homebrewVm?.homebrew_trusted_cask_refs, requiredHomebrewTrustedCaskRefs) ||
    !sameStringSet(homebrewPolicy?.standard_install_trusted_cask_refs, requiredHomebrewTrustedCaskRefs) ||
    !preflightText.includes('const requiredHomebrewTrustedCaskRefs = [')
  ) {
    console.error('FAIL homebrew_vm_gate_static_policy: trusted refs must cover explicit standard/full/nightly cask refs');
    failures += 1;
  }
  if (
    homebrewVm?.homebrew_trust_scope !== requiredHomebrewTrustScope ||
    homebrewPolicy?.trust_scope !== requiredHomebrewTrustScope ||
    !preflightText.includes(`const requiredHomebrewTrustScope = '${requiredHomebrewTrustScope}'`)
  ) {
    console.error('FAIL homebrew_vm_gate_static_policy: trust scope must stay explicit cask refs, not whole tap');
    failures += 1;
  }
  if (
    homebrewVm?.homebrew_trusted_cask_refs?.includes('gaofeng21cn/one-person-lab') ||
    homebrewPolicy?.standard_install_trusted_cask_refs?.includes('gaofeng21cn/one-person-lab')
  ) {
    console.error('FAIL homebrew_vm_gate_static_policy: whole tap trust is not allowed');
    failures += 1;
  }

  return failures;
}

function validateWebuiPackagePolicy(releaseContract: Record<string, any>): number {
  let failures = 0;
  const webuiPackage = releaseContract.webui_ghcr_image;
  if (webuiPackage?.github_package_access?.target_repository_association !== 'gaofeng21cn/one-person-lab-app') {
    console.error('FAIL webui_package_association: target repository association must be gaofeng21cn/one-person-lab-app');
    failures += 1;
  }
  if (webuiPackage?.github_package_access?.current_historical_association_allowed_until_ui_migration !== 'gaofeng21cn/one-person-lab') {
    console.error('FAIL webui_package_association: historical association allowance must name gaofeng21cn/one-person-lab');
    failures += 1;
  }
  if (webuiPackage?.retention_policy?.cleanup_execution_mode !== 'dry_run_first_explicit_execute_required') {
    console.error('FAIL webui_retention_policy: cleanup must be dry-run first with explicit execute');
    failures += 1;
  }
  if (!webuiPackage?.retention_policy?.protected_tags?.includes('nightly')) {
    console.error('FAIL webui_retention_policy: protected tags must include nightly');
    failures += 1;
  }
  return failures;
}

function validateReleaseAccelerationPolicy(releaseContract: Record<string, any>): number {
  let failures = 0;
  const acceleration = releaseContract.release_acceleration;
  const stableReleaseStateMachine = acceleration?.stable_release_state_machine;
  const cohortPrepare = acceleration?.cohort_prepare;
  const releaseOperator = acceleration?.release_operator;
  const releaseMonitor = acceleration?.release_monitor;
  const gateReuse = acceleration?.gate_reuse;
  const tartBasePrebake = acceleration?.tart_base_prebake;
  const githubActions = acceleration?.github_actions;
  const expensiveFullBuildAdmission = githubActions?.expensive_full_build_admission;
  const readinessAdmission = githubActions?.release_readiness_admission;
  const diagnosticsWorkflowPolicy = githubActions?.diagnostics_workflow_policy;
  const firstRunVmConcurrency = githubActions?.first_run_vm_concurrency;
  const scheduledVmGuard = firstRunVmConcurrency?.scheduled_desktop_release_activity_guard;
  const vmGates = Array.isArray(acceleration?.vm_gates) ? acceleration.vm_gates : [];
  const assistantRouteSmoke = acceleration?.assistant_route_smoke_policy;

  if (
    stableReleaseStateMachine?.package_script !== 'release:stable' ||
    stableReleaseStateMachine?.script !== 'scripts/run-stable-release.ts' ||
    stableReleaseStateMachine?.schema !== 'opl_app_stable_release_session.v2' ||
    stableReleaseStateMachine?.default_mode !== 'dry_run' ||
    stableReleaseStateMachine?.execute_flag !== '--execute' ||
    !sameStringSet(stableReleaseStateMachine?.canonical_commands, ['start', 'retry-qualification', 'resume', 'promote', 'complete-local']) ||
    !sameStringSet(stableReleaseStateMachine?.phases, [
      'candidate_frozen', 'source_gates_passed', 'source_gate_failed', 'artifact_build_running',
      'artifact_build_failed', 'release_train_failed', 'qualification_failed',
      'retry_failed_gate_same_artifact', 'artifacts_qualified', 'owner_approved',
      'promotion_running', 'promotion_failed', 'release_published_not_latest',
      'distribution_synced', 'homebrew_verified', 'latest_activated',
      'awaiting_local_activation', 'complete',
    ]) ||
    stableReleaseStateMachine?.cohort_binding?.desktop_release_dispatch_limit_per_cohort !== 1 ||
    stableReleaseStateMachine?.cohort_binding?.cross_cohort_artifact_reuse_allowed !== false ||
    stableReleaseStateMachine?.cohort_binding?.remote_dispatch_ref_must_match_frozen_app_sha !== true ||
    stableReleaseStateMachine?.execution_policy?.deduplicate_cheap_source_gates !== true ||
    stableReleaseStateMachine?.execution_policy?.stable_complete_requires_addon_gates !== true ||
    stableReleaseStateMachine?.execution_policy?.monitor_transport_retry_limit !== 3 ||
    stableReleaseStateMachine?.execution_policy?.monitor_nonterminal_exit_preserves_running_state !== true ||
    stableReleaseStateMachine?.execution_policy?.monitor_readback_failure_preserves_running_state !== true ||
    stableReleaseStateMachine?.execution_policy?.promotion_reuses_source_release_run_id !== true ||
    stableReleaseStateMachine?.execution_policy?.promotion_requires_release_owner_receipt !== true ||
    stableReleaseStateMachine?.execution_policy?.promotion_dispatch_limit_per_cohort !== 1 ||
    stableReleaseStateMachine?.execution_policy?.promotion_retry_reuses_original_run_id_and_owner_receipt !== true ||
    stableReleaseStateMachine?.recovery_policy?.smoke_or_validator_only_change_rebuilds_existing_artifact !== false ||
    stableReleaseStateMachine?.recovery_policy?.smoke_or_validator_only_retry_may_use_separately_pinned_verification_harness !== true ||
    stableReleaseStateMachine?.recovery_policy?.separate_verification_harness_requires_changed_path_scope_proof !== true ||
    stableReleaseStateMachine?.recovery_policy?.verification_harness_must_not_replace_artifact_cohort_identity !== true ||
    stableReleaseStateMachine?.recovery_policy?.verification_harness_identity_must_be_recorded_in_qualification_receipt !== true ||
    stableReleaseStateMachine?.recovery_policy?.artifact_build_failed_can_reconcile_original_run_without_redispatch !== true ||
    stableReleaseStateMachine?.recovery_policy?.qualification_retry_reuses_exact_artifact_bytes !== true ||
    stableReleaseStateMachine?.artifact_cohort?.schema !== 'opl_app_build_artifact_cohort.v2' ||
    stableReleaseStateMachine?.artifact_cohort?.artifact_build_limit_per_cohort !== 1 ||
    stableReleaseStateMachine?.qualification_receipt?.schema !== 'opl_app_artifact_qualification_receipt.v1' ||
    stableReleaseStateMachine?.qualification_receipt?.separate_verification_harness_allowed_only_for !== 'smoke_or_validator_only_change' ||
    !sameStringSet(stableReleaseStateMachine?.qualification_receipt?.verification_harness_required_fields, [
      'app_sha', 'shell_sha', 'smoke_harness_sha256', 'differs_from_artifact_cohort', 'change_scope', 'scope_proof',
    ]) ||
    stableReleaseStateMachine?.qualification_receipt?.artifact_cohort_fields_remain_product_identity !== true ||
    stableReleaseStateMachine?.qualification_receipt?.cross_artifact_or_cross_cohort_override_allowed !== false ||
    stableReleaseStateMachine?.promotion_saga?.owner_workflow !== '.github/workflows/desktop-release-promote.yml' ||
    stableReleaseStateMachine?.promotion_saga?.framework_owner_workflow !== 'gaofeng21cn/one-person-lab/.github/workflows/release-package-channel.yml' ||
    stableReleaseStateMachine?.promotion_saga?.framework_receipt_schema !== 'opl_release_set_promotion_receipt.v1' ||
    stableReleaseStateMachine?.promotion_saga?.webui_stable_writer !== '.github/workflows/desktop-release-promote.yml' ||
    stableReleaseStateMachine?.promotion_saga?.webui_stable_writer_count !== 1 ||
    stableReleaseStateMachine?.promotion_saga?.source_desktop_release_mutates_stable_or_full_tap !== false ||
    stableReleaseStateMachine?.promotion_saga?.redispatch_after_partial_failure_allowed !== false ||
    stableReleaseStateMachine?.receipts?.framework_promotion !== 'opl_release_set_promotion_receipt.v1' ||
    stableReleaseStateMachine?.receipts?.distribution !== 'opl_stable_distribution_receipt.v2' ||
    stableReleaseStateMachine?.receipts?.webui_stable_activation !== 'opl_webui_stable_activation_receipt.v1' ||
    stableReleaseStateMachine?.receipts?.homebrew_activation !== 'opl_app_homebrew_activation_receipt.v1' ||
    stableReleaseStateMachine?.receipts?.local_activation !== 'opl_app_local_activation_receipt.v1' ||
    stableReleaseStateMachine?.profiling?.efficiency_advisory_after_minutes !== 90 ||
    stableReleaseStateMachine?.profiling?.efficiency_advisory_is_stop_condition !== false ||
    typeof stableReleaseStateMachine?.authority_boundary !== 'string' ||
    !stableReleaseStateMachine.authority_boundary.includes('is not release truth')
  ) {
    console.error('FAIL stable_release_state_machine_policy: Stable must use one dry-run-first, exact-cohort state machine from source gates through promotion');
    failures += 1;
  }

  if (
    expensiveFullBuildAdmission?.workflow_job !== 'full-first-install' ||
    expensiveFullBuildAdmission?.required_predecessor !== 'standard-build' ||
    typeof expensiveFullBuildAdmission?.rule !== 'string' ||
    !expensiveFullBuildAdmission.rule.includes('cheap or Standard failure must stop Full work')
  ) {
    console.error('FAIL expensive_full_build_admission: Full assembly must wait for Standard build gates');
    failures += 1;
  }

  if (
    assistantRouteSmoke?.standard?.verification_mode !== 'launch_gate' ||
    assistantRouteSmoke?.full?.verification_mode !== 'route_receipt' ||
    !assistantRouteSmoke?.standard?.forbidden?.includes('claim_agent_package_shortcut_route_receipt') ||
    !assistantRouteSmoke?.full?.required?.includes('workspace_scope_selected_before_send') ||
    !assistantRouteSmoke?.full?.required?.includes('agent_package_activate_action_per_starter') ||
    !assistantRouteSmoke?.full?.required?.includes('real_guid_composer_send_per_starter') ||
    !assistantRouteSmoke?.full?.required?.includes('conversation_get_readback_per_starter') ||
    !assistantRouteSmoke?.full?.required?.includes('agent_package_activation_receipt_per_starter') ||
    !assistantRouteSmoke?.full?.required?.includes('agent_package_shortcut_route_receipt_per_starter') ||
    !assistantRouteSmoke?.full?.forbidden?.includes('direct_conversation_post') ||
    !assistantRouteSmoke?.full?.forbidden?.includes('synthetic_agent_package_activation_receipt') ||
    !assistantRouteSmoke?.full?.forbidden?.includes('synthetic_agent_package_route_receipt')
  ) {
    console.error('FAIL assistant_route_smoke_policy: Full receipts must come from a real workspace-scoped Guid activation and send path');
    failures += 1;
  }

  if (
    cohortPrepare?.package_script !== 'release:cohort-plan' ||
    cohortPrepare?.script !== 'scripts/plan-release-cohort.ts' ||
    cohortPrepare?.schema !== 'opl_app_release_cohort_plan.v1' ||
    typeof cohortPrepare?.purpose !== 'string' ||
    !cohortPrepare.purpose.includes('pinned cohort refs') ||
    typeof cohortPrepare?.authority_boundary !== 'string' ||
    !cohortPrepare.authority_boundary.includes('operator planning artifact only') ||
    !cohortPrepare.authority_boundary.includes('cannot publish a release') ||
    !cohortPrepare.authority_boundary.includes('replace same-cohort release evidence')
  ) {
    console.error('FAIL release_cohort_prepare_policy: cohort prepare must expose a pinned-ref planning script without release authority');
    failures += 1;
  }
  const stableCandidateFreeze = cohortPrepare?.stable_candidate_freeze;
  if (
    stableCandidateFreeze?.required !== true ||
    stableCandidateFreeze?.next_action !== 'owner_receipt_then_promote_or_dispatch_new_cohort' ||
    stableCandidateFreeze?.dispatch_input_source !== 'cohort_plan_with_operator_plan_ref' ||
    !sameStringSet(stableCandidateFreeze?.pinned_sha_fields, ['app_sha', 'shell_sha', 'framework_sha']) ||
    !sameStringSet(stableCandidateFreeze?.obsolete_candidate_statuses, ['obsolete_candidate', 'stale_candidate']) ||
    typeof stableCandidateFreeze?.currentness_rule !== 'string' ||
    !stableCandidateFreeze.currentness_rule.includes('pinned App SHA, shell SHA, and framework SHA cohort') ||
    !stableCandidateFreeze.currentness_rule.includes('post-freeze drift') ||
    !stableCandidateFreeze.currentness_rule.includes('same frozen cohort only needs owner receipt and promote')
  ) {
    console.error('FAIL stable_candidate_freeze_policy: stable candidates must be pinned to App/Shell/Framework SHAs and handle post-freeze drift through owner receipt or a new cohort');
    failures += 1;
  }
  for (const field of [
    'version',
    'tag',
    'release_mode',
    'release_intent',
    'full_omission_reason',
    'operator_plan_ref',
    'gate_reuse_plan_ref',
    'app_commit',
    'shell_ref',
    'framework_ref',
    'include_full_package',
    'run_vm_smoke',
    'publish_docker_webui',
    'cheap_source_gates',
    'next_action',
  ]) {
    if (!cohortPrepare?.records?.includes(field)) {
      console.error(`FAIL release_cohort_prepare_policy: missing cohort plan record field ${field}`);
      failures += 1;
    }
  }
  const intentPolicy = cohortPrepare?.release_intent_policy;
  const operatorPlanPolicy = cohortPrepare?.operator_plan_policy;
  if (
    !sameStringSet(intentPolicy?.allowed_values, ['stable_complete', 'standard_hotfix']) ||
    intentPolicy?.stable_complete?.include_full_package !== true ||
    intentPolicy?.stable_complete?.run_vm_smoke !== true ||
    intentPolicy?.standard_hotfix?.include_full_package !== false ||
    intentPolicy?.standard_hotfix?.full_omission_reason_required !== true ||
    operatorPlanPolicy?.required !== true ||
    operatorPlanPolicy?.workflow_input !== 'release_operator_plan_ref'
  ) {
    console.error('FAIL release_intent_policy: release intent and operator plan ref must gate every Stable dispatch');
    failures += 1;
  }

  if (
    releaseOperator?.package_script !== 'release:operator' ||
    releaseOperator?.script !== 'scripts/release-operator.ts' ||
    releaseOperator?.state_schema !== 'opl_app_release_operator_state.v1' ||
    typeof releaseOperator?.authority_boundary !== 'string' ||
    !releaseOperator.authority_boundary.includes('thin controller') ||
    !releaseOperator.authority_boundary.includes('must not become release truth') ||
    !releaseOperator.authority_boundary.includes('claim release-ready')
  ) {
    console.error('FAIL release_operator_policy: release operator must stay a thin non-authoritative controller');
    failures += 1;
  }
  const activeMonitor = releaseOperator?.active_monitor_policy;
  if (
    activeMonitor?.command !== 'gh run watch <run-id> --repo gaofeng21cn/one-person-lab-app --interval 60 --exit-status' ||
    activeMonitor?.poll_interval_seconds !== 60 ||
    activeMonitor?.single_monitor_process !== true ||
    activeMonitor?.terminal_handoff !== 'release_operator_status_once'
  ) {
    console.error('FAIL release_operator_policy: active monitoring must use one 60-second gh run watch process');
    failures += 1;
  }
  for (const artifact of ['release-operator-state.json', 'release-operator-state.md']) {
    if (!releaseOperator?.state_artifacts?.includes(artifact)) {
      console.error(`FAIL release_operator_policy: missing operator state artifact ${artifact}`);
      failures += 1;
    }
  }
  for (const command of ['plan', 'status', 'diagnose-vm']) {
    if (!releaseOperator?.commands?.includes(command)) {
      console.error(`FAIL release_operator_policy: missing operator command ${command}`);
      failures += 1;
    }
  }
  const blockerPolicy = releaseOperator?.primary_blocker_policy;
  if (
    blockerPolicy?.monitor_mode !== 'no_watch' ||
    blockerPolicy?.status_command !== 'npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha>' ||
    blockerPolicy?.forbidden_wait_strategy !== 'continue_waiting_on_gh_run_watch_after_primary_gate_failure' ||
    typeof blockerPolicy?.rule !== 'string' ||
    !blockerPolicy.rule.includes('terminal blocker state') ||
    !blockerPolicy.rule.includes('cancelled') ||
    !blockerPolicy.rule.includes('superseded') ||
    !blockerPolicy.rule.includes('instead of continuing to wait on gh run watch')
  ) {
    console.error('FAIL release_operator_primary_blocker_policy: operator status must be no-watch and stop on primary gate failures');
    failures += 1;
  }
  const attemptSwitch = gateReuse?.attempt_strategy_switch;
  if (
    attemptSwitch?.window_minutes !== 90 ||
    attemptSwitch?.prior_attempt_threshold !== 3 ||
    attemptSwitch?.workflow_input !== 'gate_reuse_plan_ref' ||
    attemptSwitch?.required_before_next_full_train !== true ||
    attemptSwitch?.timeout_is_abandonment_condition !== false
  ) {
    console.error('FAIL release_gate_reuse_policy: repeated attempts must require a same-cohort reuse plan without abandoning the release goal');
    failures += 1;
  }
  if (!sameStringSet(blockerPolicy?.failed_gate_states, ['failed_gate_draining', 'failed'])) {
    console.error('FAIL release_operator_primary_blocker_policy: failed gate states must be failed_gate_draining and failed');
    failures += 1;
  }
  if (!sameStringSet(blockerPolicy?.terminal_blocker_states, [
    'failed_gate_draining',
    'failed',
    'stale_candidate',
    'cancelled',
    'superseded',
  ])) {
    console.error('FAIL release_operator_primary_blocker_policy: terminal blocker states must include failed, stale, cancelled, and superseded states');
    failures += 1;
  }
  if (!sameStringSet(blockerPolicy?.failed_gate_next_actions, ['repair_source_gate', 'dispatch_new_cohort'])) {
    console.error('FAIL release_operator_primary_blocker_policy: failed gate next actions must repair source gate or dispatch a new cohort');
    failures += 1;
  }
  for (const action of [
    'repair_source_gate',
    'repair_webui_runtime_image',
    'repair_ghcr_publish_access',
    'dispatch_new_cohort',
    'rerun_diagnostic_same_artifact',
    'inspect_full_build_diagnostics',
    'rerun_full_build_same_cohort',
    'inspect_homebrew_tap_diagnostics',
    'inspect_webui_runtime_image_diagnostics',
    'provide_owner_receipt',
    'wait_for_runner_capacity',
    'retry_transient_upload',
    'promote_candidate',
  ]) {
    if (!releaseOperator?.typed_next_actions?.includes(action)) {
      console.error(`FAIL release_operator_policy: missing typed next action ${action}`);
      failures += 1;
    }
  }
  failures += validateReleaseMonitorPolicy(releaseMonitor, releaseOperator?.typed_next_actions);

  if (
    gateReuse?.plan_command !== 'npm run release:gate-reuse-plan -- --version <version> --release-mode <mode> --include-full-package true --run-vm-smoke true' ||
    gateReuse?.schema !== 'opl_release_gate_reuse_plan.v1' ||
    gateReuse?.digest_field !== 'reuse_digest' ||
    gateReuse?.workflow_consumption_status !== 'artifact_available_not_consumed_for_gate_skip'
  ) {
    console.error('FAIL release_gate_reuse_policy: gate reuse must expose the script, schema, digest field, and non-consumed workflow status');
    failures += 1;
  }
  if (!sameStringSet(gateReuse?.eligible_gate_ids, requiredReusableGateIds)) {
    console.error('FAIL release_gate_reuse_policy: eligible gates must match the reusable release gate list');
    failures += 1;
  }
  if (!sameStringSet(gateReuse?.required_match_fields, requiredGateReuseMatchFields)) {
    console.error('FAIL release_gate_reuse_policy: required match fields must include cohort, refs, remote asset digests, previous statuses, and reuse_digest');
    failures += 1;
  }
  if (
    typeof gateReuse?.authority_boundary !== 'string' ||
    !gateReuse.authority_boundary.includes('cannot claim release-ready') ||
    !gateReuse.authority_boundary.includes('skip a workflow gate unless a workflow explicitly consumes a reuse_allowed decision')
  ) {
    console.error('FAIL release_gate_reuse_policy: authority boundary must prevent implicit release-ready or gate-skip claims');
    failures += 1;
  }

  if (
    tartBasePrebake?.status !== 'contracted_not_claimed_current' ||
    tartBasePrebake?.standard_source_vm_variable !== 'OPL_FIRST_RUN_TART_SOURCE' ||
    tartBasePrebake?.homebrew_source_vm_variable !== 'OPL_FIRST_RUN_HOMEBREW_TART_SOURCE'
  ) {
    console.error('FAIL tart_base_prebake_policy: prebake must be contracted but not claimed current and must name source VM variables');
    failures += 1;
  }
  for (const layer of ['macos_gui_session_ready', 'homebrew_for_homebrew_profile', 'node_runtime_prerequisites', 'codex_install_asset_cache_seed']) {
    if (!tartBasePrebake?.allowed_prebaked_layers?.includes(layer)) {
      console.error(`FAIL tart_base_prebake_policy: missing allowed prebaked layer ${layer}`);
      failures += 1;
    }
  }
  for (const layer of ['One Person Lab.app', 'release_dmg', 'release_homebrew_cask', 'runtime_truth', 'domain_artifact_truth', 'owner_receipt']) {
    if (!tartBasePrebake?.forbidden_prebaked_layers?.includes(layer)) {
      console.error(`FAIL tart_base_prebake_policy: missing forbidden prebaked layer ${layer}`);
      failures += 1;
    }
  }
  if (!sameStringSet(tartBasePrebake?.required_receipt_fields, requiredTartPrebakeReceiptFields)) {
    console.error('FAIL tart_base_prebake_policy: prebake receipt fields must identify source image, layers, boundary, and validation command');
    failures += 1;
  }
  if (
    typeof tartBasePrebake?.truth_boundary !== 'string' ||
    !tartBasePrebake.truth_boundary.includes('prebaked Tart base can reduce host setup latency only') ||
    !tartBasePrebake.truth_boundary.includes('VM smoke artifact')
  ) {
    console.error('FAIL tart_base_prebake_policy: truth boundary must keep App readiness in VM smoke artifacts');
    failures += 1;
  }

  if (
    readinessAdmission?.workflow_job !== 'release-readiness-admission' ||
    readinessAdmission?.preflight_dependency !== 'release-preflight' ||
    readinessAdmission?.addon_requirement_input !== 'require_addon_gates_for_stable_readiness' ||
    readinessAdmission?.addon_gate_blocking_default !== false ||
    readinessAdmission?.addon_status_artifact !== 'release-addon-readiness-summary-<version>' ||
    !Array.isArray(readinessAdmission?.homebrew_source_run_gate_ids) ||
    readinessAdmission.homebrew_source_run_gate_ids.length !== 0 ||
    readinessAdmission?.homebrew_deferred_to_promotion_saga !== true ||
    readinessAdmission?.homebrew_allowed_in_source_readiness !== 'deferred_to_promotion_saga' ||
    !readinessAdmission?.rule?.includes('must not force Full, Docker/WebUI, or Homebrew add-on gates before writing the Standard readiness record') ||
    !readinessAdmission?.rule?.includes('Diagnostic gates such as operator evidence bundle validation must feed the add-on summary when present, but they must not prevent Standard readiness aggregation from running')
  ) {
    console.error('FAIL release_readiness_admission_policy: readiness admission must keep Standard readiness separate from same-cohort add-on status');
    failures += 1;
  }
  if (!readinessAdmission?.diagnostic_gates?.includes('operator-evidence-bundle-validation')) {
    console.error('FAIL release_readiness_admission_policy: operator evidence bundle validation must be a diagnostic gate');
    failures += 1;
  }
  if (
    diagnosticsWorkflowPolicy?.default_diagnostic_scope !== 'bootstrap_only' ||
    diagnosticsWorkflowPolicy?.diagnostic_scopes?.bootstrap_only?.authority_boundary !==
      'diagnostic_only_not_release_ready_owner_receipt_or_runtime_truth' ||
    diagnosticsWorkflowPolicy?.diagnostic_scopes?.release_gate?.authority_boundary !==
      'release_gate_evidence_only_when_same_cohort_workflow_requires_it'
  ) {
    console.error('FAIL release_diagnostics_scope_policy: diagnostics workflow must default to bootstrap_only without release-ready authority');
    failures += 1;
  }
  for (const kept of [
    'same-run or supplied DMG resolution',
    'packaged main bootstrap marker verification',
    'App install',
    'Gatekeeper/local authorization diagnostics',
    'App launch',
    'wrapper preflight diagnostics',
    'wrapper smoke command and log artifacts',
    'Tart smoke summary artifact',
  ]) {
    if (!diagnosticsWorkflowPolicy?.diagnostic_scopes?.bootstrap_only?.keeps?.includes(kept)) {
      console.error(`FAIL release_diagnostics_scope_policy: bootstrap_only must keep ${kept}`);
      failures += 1;
    }
  }
  for (const skipped of [
    'Codex install asset cache restore',
    'Codex install asset prefetch',
    'Codex install asset cache save',
    'Settings page sweep',
    'assistant route smoke',
    'Codex functional check',
    'Codex AI self-check',
  ]) {
    if (!diagnosticsWorkflowPolicy?.diagnostic_scopes?.bootstrap_only?.skips?.includes(skipped)) {
      console.error(`FAIL release_diagnostics_scope_policy: bootstrap_only must skip ${skipped}`);
      failures += 1;
    }
  }
  const releaseGateScope = diagnosticsWorkflowPolicy?.diagnostic_scopes?.release_gate;
  for (const artifact of [
    'app-wrapper-diagnostics.json',
    'app-wrapper-preflight.log',
    'app-wrapper-smoke-command-preview.txt',
    'app-wrapper-smoke.stdout.log',
    'app-wrapper-smoke.stderr.log',
    'vm-gate-failure-summary.json',
    'vm-gate-failure-summary.md',
    'tart-smoke-summary.json',
  ]) {
    if (
      !diagnosticsWorkflowPolicy?.diagnostic_scopes?.bootstrap_only?.wrapper_diagnostic_artifacts?.includes(artifact) ||
      !releaseGateScope?.wrapper_diagnostic_artifacts?.includes(artifact)
    ) {
      console.error(`FAIL release_diagnostics_scope_policy: VM scopes must retain wrapper diagnostic artifact ${artifact}`);
      failures += 1;
    }
  }
  if (
    typeof releaseGateScope?.critical_failure_artifact_policy !== 'string' ||
    !releaseGateScope.critical_failure_artifact_policy.includes('vm-gate-failure-summary.json/md') ||
    !releaseGateScope.critical_failure_artifact_policy.includes('diagnostic_artifact_missing') ||
    !releaseGateScope.critical_failure_artifact_policy.includes('rerun_diagnostic_same_artifact')
  ) {
    console.error('FAIL release_diagnostics_scope_policy: release_gate must preserve small VM failure summaries and same-artifact rerun guidance');
    failures += 1;
  }
  if (
    typeof releaseGateScope?.wrapper_diagnostic_policy !== 'string' ||
    !releaseGateScope.wrapper_diagnostic_policy.includes('host_wrapper_preflight_and_smoke_logs_are_supporting_evidence') ||
    !releaseGateScope.wrapper_diagnostic_policy.includes('deterministic VM readiness/settings/route/codex checks')
  ) {
    console.error('FAIL release_diagnostics_scope_policy: release_gate wrapper diagnostics must preserve deterministic release gates');
    failures += 1;
  }
  if (
    githubActions?.first_run_vm_artifact_handoff?.same_artifact_diagnostic_next_action !== 'rerun_diagnostic_same_artifact' ||
    githubActions?.first_run_vm_artifact_handoff?.diagnostic_missing_status !== 'diagnostic_artifact_missing'
  ) {
    console.error('FAIL first_run_vm_artifact_handoff_policy: source-run handoff must name same-artifact rerun and diagnostic-missing status');
    failures += 1;
  }
  if (
    firstRunVmConcurrency?.scheduled_default_package_profile !== 'standard' ||
    firstRunVmConcurrency?.scheduled_default_diagnostic_scope !== 'bootstrap_only' ||
    scheduledVmGuard?.workflow !== 'OPL Desktop Release' ||
    !sameStringSet(scheduledVmGuard?.checked_statuses, ['in_progress', 'queued']) ||
    scheduledVmGuard?.skip_reason !== 'desktop_release_active_or_queued' ||
    scheduledVmGuard?.guard_unavailable_skip_reason !== 'desktop_release_guard_unavailable' ||
    scheduledVmGuard?.runner_boundary !== 'github_hosted_preflight_before_self_hosted_vm'
  ) {
    console.error('FAIL scheduled_first_run_vm_policy: scheduled VM maintenance must default to standard/bootstrap_only and skip before self-hosted VM when desktop release activity is active or unknown');
    failures += 1;
  }
  if (
    typeof firstRunVmConcurrency?.rule !== 'string' ||
    !firstRunVmConcurrency.rule.includes('focused bootstrap-launch diagnostic') ||
    typeof scheduledVmGuard?.rule !== 'string' ||
    !scheduledVmGuard.rule.includes('self-hosted first-run VM runner')
  ) {
    console.error('FAIL scheduled_first_run_vm_policy: scheduled VM policy must explain focused bootstrap-launch diagnostics and VM runner protection');
    failures += 1;
  }
  for (const gate of vmGates) {
    if (gate?.diagnostic_scope !== 'release_gate') {
      console.error(`FAIL release_vm_gate_scope_policy: VM gate ${gate?.id || '<unknown>'} must use diagnostic_scope=release_gate`);
      failures += 1;
    }
  }
  if (acceleration?.vm_gate?.diagnostic_scope !== 'release_gate') {
    console.error('FAIL release_vm_gate_scope_policy: legacy vm_gate summary must use diagnostic_scope=release_gate');
    failures += 1;
  }

  return failures;
}

function validateSourceMaterialRouteContract(appRoot: string): number {
  const runtimeBridge = readJson(appRoot, 'contracts/app-runtime-bridge.json');
  const guiContract = readJson(appRoot, 'contracts/app-gui-product-contract.json');
  const pageStateMatrix = readJson(appRoot, 'contracts/app-page-state-matrix.json');
  const sourceMaterial = runtimeBridge.source_material_projection;
  const guiRoute = guiContract.source_material_user_path;
  const ordinaryPage = Array.isArray(pageStateMatrix.pages)
    ? pageStateMatrix.pages.find((page) => page.id === 'ordinary_conversation')
    : null;
  const inspectorPage = Array.isArray(pageStateMatrix.pages)
    ? pageStateMatrix.pages.find((page) => page.id === 'right_context_inspector')
    : null;
  const requiredRefs = [
    'source_material_refs',
    'source_material_receipt_refs',
    'reference_design_packet_refs',
  ];
  let failures = 0;

  if (
    sourceMaterial?.ingest_command !== 'opl workspace source ingest --workspace <workspace_ref> --files <file_refs> --goal <user_goal> --json' ||
    sourceMaterial?.authority !== 'opl_framework_source_material_refs_projection' ||
    sourceMaterial?.producer_owner !== 'one-person-lab' ||
    sourceMaterial?.reference_design_consumer !== 'opl-meta-agent'
  ) {
    console.error('FAIL source_material_route_contract: source material must route through Framework ingest and OMA reference design consumption');
    failures += 1;
  }
  if (
    !stringArrayIncludesAll(sourceMaterial?.required_ref_fields, requiredRefs) ||
    !stringArrayIncludesAll(sourceMaterial?.domain_consumers, [
      'med-autoscience',
      'med-autogrant',
      'redcube-ai',
      'opl-bookforge',
      'opl-meta-agent',
    ])
  ) {
    console.error('FAIL source_material_route_contract: source material projection must require source/receipt/reference-design refs and domain consumers');
    failures += 1;
  }
  if (
    sourceMaterial?.refs_only !== true ||
    sourceMaterial?.source_body_access !== false ||
    sourceMaterial?.pdf_parse_access !== false ||
    sourceMaterial?.artifact_body_access !== false ||
    sourceMaterial?.domain_truth_write_access !== false ||
    sourceMaterial?.owner_receipt_write_access !== false ||
    sourceMaterial?.domain_verdict_authority !== false ||
    sourceMaterial?.readiness_authority !== false ||
    sourceMaterial?.source_readiness_authority !== false
  ) {
    console.error('FAIL source_material_route_contract: App must remain refs-only with no source/PDF body, domain truth, owner receipt, or readiness authority');
    failures += 1;
  }
  if (
    !stringArrayIncludesAll(sourceMaterial?.forbidden_claims, [
      'source_body',
      'pdf_parse_quality',
      'reference_design_quality_verdict',
      'domain_truth',
      'owner_receipt_authority',
      'app_release_readiness',
    ])
  ) {
    console.error('FAIL source_material_route_contract: forbidden claims must block body parsing quality, domain truth, owner receipt, and release readiness claims');
    failures += 1;
  }
  if (
    guiRoute?.route_contract_ref !== 'contracts/app-runtime-bridge.json#source_material_projection' ||
    guiRoute?.source_material_projection_ref !== 'contracts/app-runtime-bridge.json#source_material_projection' ||
    guiRoute?.framework_ingest_command !== sourceMaterial?.ingest_command ||
    guiRoute?.ui_implementation_status !== 'route_contract_landed_no_live_drag_drop_ui_evidence' ||
    guiRoute?.refs_only !== true ||
    guiRoute?.source_body_access !== false ||
    guiRoute?.pdf_parse_access !== false ||
    guiRoute?.artifact_body_access !== false ||
    guiRoute?.domain_verdict_authority !== false ||
    guiRoute?.owner_receipt_write_access !== false ||
    guiRoute?.release_readiness_authority !== false ||
    !stringArrayIncludesAll(guiRoute?.machine_ref_fields, requiredRefs)
  ) {
    console.error('FAIL source_material_route_contract: GUI source-material user path must mirror refs-only Framework route without live UI/readiness claims');
    failures += 1;
  }

  const guiConversationFields = guiContract.ordinary_conversation?.current_task_slice?.fields;
  const guiInspectorEvidence = guiContract.right_context_inspector?.current_task_evidence;
  const pageConversationSlice = ordinaryPage?.conversation_view_model?.current_task_slice;
  const pageInspectorEvidence = inspectorPage?.inspector_view_model?.current_task_evidence;
  for (const [surface, fields] of [
    ['gui ordinary conversation', guiConversationFields],
    ['gui right inspector', guiInspectorEvidence?.fields],
    ['page-state ordinary conversation', pageConversationSlice?.fields],
    ['page-state right inspector', pageInspectorEvidence?.fields],
  ] as const) {
    if (!stringArrayIncludesAll(fields, requiredRefs)) {
      console.error(`FAIL source_material_route_contract: ${surface} must expose source material refs, receipt refs, and reference design packet refs`);
      failures += 1;
    }
  }
  for (const [surface, evidence] of [
    ['gui right inspector', guiInspectorEvidence],
    ['page-state right inspector', pageInspectorEvidence],
  ] as const) {
    if (evidence?.source_material_projection_ref !== 'contracts/app-runtime-bridge.json#source_material_projection') {
      console.error(`FAIL source_material_route_contract: ${surface} must point to source material projection`);
      failures += 1;
    }
  }

  return failures;
}

export function validateReleaseContractPolicies(appRoot: string): number {
  const releaseContract = readJson(appRoot, 'contracts/app-release-channel.json');
  const firstRunMatrix = readJson(appRoot, 'contracts/app-first-run-test-matrix.json');
  let failures = 0;

  failures += validateGithubReleaseName(releaseContract);
  failures += validateReleaseImmutability(releaseContract);
  failures += validateStandardUpdaterCompressionPolicy(appRoot, releaseContract);
  failures += validateReleasePreflightContract(releaseContract);
  failures += validateHomebrewVmGateStaticPolicy(appRoot, releaseContract, firstRunMatrix);
  failures += validateWebuiPackagePolicy(releaseContract);
  failures += validateReleaseAccelerationPolicy(releaseContract);
  failures += validateSourceMaterialRouteContract(appRoot);

  return failures;
}
