import fs from 'node:fs';
import path from 'node:path';
import { validateReleaseBrokerAuthority } from '../release-broker-authority.ts';

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
      warning: 'inspect_current_step_progress',
      timeout: 'reconcile_stable_session',
      diagnostic: 'retry_qualification_same_artifact',
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
      warning: 'inspect_current_step_progress',
      timeout: 'reconcile_stable_session',
      diagnostic: 'inspect_primary_blocker',
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
      warning: 'inspect_current_step_progress',
      timeout: 'reconcile_stable_session',
      diagnostic: 'inspect_primary_blocker',
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
      warning: 'inspect_current_step_progress',
      timeout: 'reconcile_stable_session',
      diagnostic: 'repair_webui_runtime_image',
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
    webuiClassification?.recommended_next_action !== 'repair_webui_runtime_image'
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
  const calendarGuard = releaseName?.calendar_guard;
  if (
    releaseName?.format !== 'One Person Lab v<version>' ||
    releaseName?.stable_example !== 'One Person Lab v26.6.5' ||
    releaseName?.nightly_example !== 'One Person Lab v26.6.5-nightly' ||
    releaseName?.stable_version_pattern !== '^[0-9]{2}\\.(?:[1-9]|1[0-2])\\.(?:[1-9]|[12][0-9]|3[01])$' ||
    releaseName?.nightly_version_pattern !== '^[0-9]{2}\\.(?:[1-9]|1[0-2])\\.(?:[1-9]|[12][0-9]|3[01])-nightly(?:\\.r[1-9])?$' ||
    releaseName?.tag_pattern !== 'v<version>' ||
    calendarGuard?.time_zone !== 'Asia/Shanghai' ||
    calendarGuard?.future_dated_versions_allowed !== false ||
    calendarGuard?.failure_mode !== 'fail_closed_before_build_remote_lookup_or_mutation' ||
    JSON.stringify(calendarGuard?.required_entrypoints) !== JSON.stringify([
      'release_version_validation',
      'release_candidate_plan',
      'release_cohort_plan_and_stable_controller',
      'standard_publish',
      'full_first_install_build',
      'full_addon_publish',
      'stable_promotion',
    ])
  ) {
    console.error('FAIL github_release_name: release names must use canonical versions and reject future dates at every build and publish entrypoint');
    return 1;
  }
  return 0;
}

function validateReleaseImmutability(releaseContract: Record<string, any>): number {
  const standardDraft = releaseContract.standard_updater?.draft_refresh;
  const fullDraft = releaseContract.full_first_install?.draft_refresh;
  const fullAddon = releaseContract.full_first_install?.published_addon;
  const nightly = releaseContract.nightly_standard;
  const sameDayRebuild = nightly?.same_day_rebuild;
  if (
    standardDraft?.allowed !== true ||
    standardDraft?.published_release_mutation_allowed !== false ||
    standardDraft?.mode !== 'unpublished_draft_prebuilt_assets_upload_clobber' ||
    fullDraft?.allowed !== true ||
    fullDraft?.published_release_mutation_allowed !== false ||
    fullDraft?.mode !== 'unpublished_draft_release_upload_clobber' ||
    fullAddon?.workflow !== '.github/workflows/desktop-release-full-addon.yml' ||
    fullAddon?.receipt_schema !== 'opl_app_full_addon_receipt.v1' ||
    fullAddon?.mode !== 'same_cohort_additive_only' ||
    !sameStringSet(fullAddon?.allowed_assets, [
      'One-Person-Lab-Full-<version>-mac-arm64.dmg',
      'opl-release-manifest.json',
    ]) ||
    fullAddon?.same_name_same_digest !== 'idempotent_reuse' ||
    fullAddon?.same_name_different_digest !== 'fail_and_require_new_version' ||
    fullAddon?.standard_assets_modified !== false ||
    fullAddon?.updater_metadata_modified !== false ||
    fullAddon?.release_notes_modified !== false ||
    fullAddon?.latest_modified !== false ||
    fullAddon?.source_or_bom_change_requires_new_version !== true ||
    nightly?.tag_pattern !== 'v<YY.M.D>-nightly[.r<1-9>]' ||
    sameDayRebuild?.first_release_suffix !== null ||
    sameDayRebuild?.suffix_pattern !== '.r<revision>' ||
    sameDayRebuild?.first_revision !== 1 ||
    sameDayRebuild?.maximum_revision !== 9 ||
    sameDayRebuild?.allocation !== 'highest_existing_same_day_tag_or_release_plus_one' ||
    sameDayRebuild?.legacy_run_identity_counts_as_existing_release !== true ||
    sameDayRebuild?.github_actions_run_identity_in_version !== false ||
    sameDayRebuild?.exhaustion_policy !== 'fail_closed' ||
    nightly?.prerelease !== true ||
    nightly?.latest_release_allowed !== false
  ) {
    console.error('FAIL release_immutability: drafts may refresh, published Full may only append same-cohort digest-idempotent assets, and Nightly uses bounded immutable date identities');
    return 1;
  }
  return 0;
}

function validateLocalInstallReleaseProfile(releaseContract: Record<string, any>): number {
  const profile = releaseContract.release_profiles?.local_install;
  const expectedRequiredLanes = [
    'release_source_gate',
    'release_boundary',
    'standard_build',
    'local_install_handoff',
    'installed_app_readback',
  ];
  const expectedForbiddenLanes = [
    'publish_standard',
    'publish_full_assets',
    'remote_verify_standard_and_full',
    'standard_dmg_clean_vm_smoke',
    'full_dmg_clean_vm_smoke',
    'homebrew_standard_cask_clean_vm_smoke',
    'docker_webui_smoke',
    'webui_ghcr_publish',
    'release_evidence_bundle',
    'release_readiness_summary',
    'release_candidate_record',
    'promote_stable_release',
    'stable_homebrew_tap_update',
    'full_homebrew_tap_update',
    'release_promotion_record',
    'post_release_user_guide_screenshots',
  ];
  const expectedForbiddenRequirements = [
    'github_release_publish',
    'ghcr_publish',
    'clean_vm',
    'attestation',
    'notarization',
    'homebrew_distribution',
    'stable_promotion',
  ];
  let failures = 0;

  if (
    releaseContract.release_profiles?.default !== 'stable' ||
    !sameStringSet(releaseContract.release_profiles?.allowed, ['stable', 'local-install']) ||
    releaseContract.release_profiles?.unavailable?.nightly?.status !== 'retired_pending_brokered_replacement' ||
    releaseContract.release_profiles?.unavailable?.nightly?.mutation_available !== false ||
    profile?.plan_profile !== 'local_install' ||
    profile?.version_channel !== 'stable' ||
    profile?.distribution_scope !== 'local_machine_only'
  ) {
    console.error('FAIL local_install_release_profile: release profiles must expose local-install as a local-machine-only Stable-version plan');
    failures += 1;
  }
  if (
    profile?.build_command !== 'npm run build-mac:arm64' ||
    profile?.build_app_path !== '$SHELL_ROOT/out/mac-arm64/One Person Lab.app' ||
    profile?.installed_app_path !== '/Applications/One Person Lab.app' ||
    profile?.second_qa_authorization_required !== false
  ) {
    console.error('FAIL local_install_release_profile: local build, installed App path, and direct QA handoff must be canonical');
    failures += 1;
  }
  if (!sameStringSet(profile?.required_lanes, expectedRequiredLanes)) {
    console.error('FAIL local_install_release_profile: local-install must require only source, boundary, build, install handoff, and installed readback lanes');
    failures += 1;
  }
  if (!sameStringSet(profile?.forbidden_lanes, expectedForbiddenLanes)) {
    console.error('FAIL local_install_release_profile: every public-distribution and promotion lane must remain forbidden');
    failures += 1;
  }
  if (!sameStringSet(profile?.forbidden_external_requirements, expectedForbiddenRequirements)) {
    console.error('FAIL local_install_release_profile: public publish, GHCR, VM, attestation, notarization, Homebrew, and promotion must stay outside local-install');
    failures += 1;
  }
  if (
    !Array.isArray(profile?.installed_readback) ||
    !stringArrayIncludesAll(profile.installed_readback, [
      'bundle_version',
      'codesign_diagnostic',
      'installed_app_asar_sha256_matches_build',
      'startup_and_runtime_bridge_logs',
    ]) ||
    typeof profile?.authority_boundary !== 'string' ||
    !profile.authority_boundary.includes('cannot publish or promote a release') ||
    !profile.authority_boundary.includes('cannot claim clean-VM or attestation evidence')
  ) {
    console.error('FAIL local_install_release_profile: installed readback and non-public authority boundary are incomplete');
    failures += 1;
  }

  return failures;
}

function validateReleaseExecutionTracks(releaseContract: Record<string, any>): number {
  const policy = releaseContract.release_execution_tracks;
  const local = policy?.tracks?.local;
  const remote = policy?.tracks?.remote;
  const parity = policy?.artifact_parity;
  const isolation = policy?.development_isolation;
  const standardLatestRequirements = [
    'One-Person-Lab-<version>-mac-arm64.dmg',
    'One-Person-Lab-<version>-mac-arm64.zip',
    'One-Person-Lab-<version>-mac-arm64.zip.blockmap',
    'latest-arm64-mac.yml',
    'opl-app-component-manifest.json',
    'standard-local-authorization-policy.json',
    'prepared_ai_release_notes',
  ];
  const fullRequirements = [
    'One-Person-Lab-Full-<version>-mac-arm64.dmg',
    'opl-release-manifest.json',
  ];
  const fullForbiddenMutations = [
    'standard_assets',
    'latest-arm64-mac.yml',
    'release_notes',
    'latest_selection',
  ];

  if (
    policy?.orthogonal_to_release_profiles !== true ||
    policy?.local_install_profile_is_not_local_publish_track !== true ||
    !sameStringSet(policy?.default_sequence, [
      'local_development_debug_build_and_same_artifact_qualification',
      'remote_routine_release_and_continuous_reproducibility_proof',
    ]) ||
    local?.routine_during_development !== true ||
    local?.publication_requires_explicit_authorization !== true ||
    local?.may_publish_canonical_release_assets !== true ||
    local?.must_use_frozen_release_worktree !== true ||
    local?.must_not_block_canonical_main_or_unrelated_worktrees !== true ||
    remote?.default_publication_track !== true ||
    remote?.must_consume_or_produce_the_same_artifact_contract !== true ||
    remote?.must_not_create_track_specific_public_assets !== true
  ) {
    console.error('FAIL release_execution_tracks: local must accelerate development and authorized fallback publication while remote remains the routine equivalent publication path');
    return 1;
  }

  if (
    parity?.canonical_public_asset_set_per_version !== 1 ||
    parity?.same_frozen_cohort_required !== true ||
    parity?.track_handoff_requires_exact_asset_digests !== true ||
    parity?.same_public_names_roles_and_install_behavior_required !== true ||
    parity?.same_standard_updater_metadata_contract_required !== true ||
    parity?.same_prepared_ai_release_notes_required !== true ||
    parity?.track_specific_user_visible_assets_allowed !== false ||
    !sameStringSet(parity?.standard_latest_activation_requires, standardLatestRequirements) ||
    parity?.full_addon_may_follow_latest_asynchronously !== true ||
    !sameStringSet(parity?.full_addon_requires, fullRequirements) ||
    parity?.full_is_standard_updater_target !== false ||
    !sameStringSet(parity?.adding_full_must_not_modify, fullForbiddenMutations)
  ) {
    console.error('FAIL release_execution_tracks: both tracks must publish one equivalent Standard release; AI notes and six Standard surfaces gate Latest while Full remains an updater-invisible asynchronous add-on');
    return 1;
  }

  if (
    isolation?.release_source !== 'immutable detached checkout or release-owned worktree' ||
    isolation?.canonical_main_write_lock_required_during_build_or_qualification !== false ||
    isolation?.normal_development_may_continue !== true ||
    typeof isolation?.rule !== 'string' ||
    !isolation.rule.includes('must never reserve the development root')
  ) {
    console.error('FAIL release_execution_tracks: release work must read a frozen checkout without blocking canonical main or unrelated development');
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
    preflight?.failure_budget !== 'fail Standard admission before Standard build; evaluate Full-specific failures only in the independent Full add-on attempt'
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
    !preflight.rule.includes('Standard preflight and the standard-source gate validate only the Standard terminal path') ||
    !preflight.rule.includes('Full and WebUI implementation checks run in their independent add-on scopes after Standard terminal')
  ) {
    console.error('FAIL release_source_gate_contract: release preflight must keep Standard admission separate from independent Full and WebUI add-on checks');
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

export type ReleaseBrokerAuthorityReadiness = {
  current_release_admission_readiness: {
    status: 'ready' | 'blocked';
    mode: 'admin_one_shot_controller';
    blockers: string[];
  };
  isolated_broker_hardening: {
    status: 'ready' | 'blocked';
    disposition: 'post_release_hardening';
    blockers: string[];
  };
};

export function evaluateReleaseBrokerAuthorityReadiness(
  authority: unknown,
): ReleaseBrokerAuthorityReadiness {
  const structuralBlockers = validateReleaseBrokerAuthority(authority, { capability: 'contract_read' });
  const candidate = authority as Record<string, any> | null;
  const admission = candidate?.current_release_admission;
  const admissionBlockers = [...structuralBlockers];
  if (
    admission?.mode !== 'admin_one_shot_controller' ||
    admission?.requires_canonical_main !== true ||
    admission?.requires_durable_planned_and_dispatching !== true ||
    admission?.requires_exact_payload_digest !== true ||
    admission?.requires_run_attempt_one !== true ||
    admission?.redispatch_after_unknown_outcome !== false ||
    admission?.rerun_allowed !== false ||
    admission?.cancel_allowed !== false ||
    admission?.isolated_broker_is_current_release_prerequisite !== false
  ) admissionBlockers.push('current admin one-shot admission contract is incomplete');
  const hardeningBlockers = validateReleaseBrokerAuthority(authority, {
    capability: 'mutation_submit',
    requireCredentialReceipt: false,
  });
  return {
    current_release_admission_readiness: {
      status: admissionBlockers.length === 0 ? 'ready' : 'blocked',
      mode: 'admin_one_shot_controller',
      blockers: admissionBlockers,
    },
    isolated_broker_hardening: {
      status: hardeningBlockers.length === 0 ? 'ready' : 'blocked',
      disposition: 'post_release_hardening',
      blockers: hardeningBlockers,
    },
  };
}

export function validateReleaseAccelerationPolicy(
  releaseContract: Record<string, any>,
  brokerAuthority: unknown,
): number {
  let failures = 0;
  const acceleration = releaseContract.release_acceleration;
  const stableReleaseStateMachine = acceleration?.stable_release_state_machine;
  const cohortPrepare = acceleration?.cohort_prepare;
  const releaseOperator = acceleration?.release_operator;
  const releaseMonitor = acceleration?.release_monitor;
  const gateReuse = acceleration?.gate_reuse;
  const tartBasePrebake = acceleration?.tart_base_prebake;
  const githubActions = acceleration?.github_actions;
  const actionsCachePolicy = githubActions?.cache_policy;
  const expensiveFullBuildAdmission = githubActions?.expensive_full_build_admission;
  const readinessAdmission = githubActions?.release_readiness_admission;
  const diagnosticsWorkflowPolicy = githubActions?.diagnostics_workflow_policy;
  const firstRunVmConcurrency = githubActions?.first_run_vm_concurrency;
  const scheduledVmGuard = firstRunVmConcurrency?.scheduled_desktop_release_activity_guard;
  const vmGates = Array.isArray(acceleration?.vm_gates) ? acceleration.vm_gates : [];
  const assistantRouteSmoke = acceleration?.assistant_route_smoke_policy;
  const tapStandardVmEvidenceTransport = stableReleaseStateMachine?.promotion_saga?.tap_standard_vm_evidence_transport;
  const latestMonotonicityPolicy = stableReleaseStateMachine?.latest_monotonicity_policy;
  const standardDeadlinePolicy = stableReleaseStateMachine?.standard_deadline_policy;
  const fullAddonDeadlinePolicy = stableReleaseStateMachine?.full_addon_deadline_policy;
  const coordinationBoundary = stableReleaseStateMachine?.coordination_boundary;
  const brokerAuthorityGate = readinessAdmission?.broker_authority_gate;

  if (
    stableReleaseStateMachine?.package_script !== 'release:stable' ||
    stableReleaseStateMachine?.script !== 'scripts/run-stable-release.ts' ||
    stableReleaseStateMachine?.schema !== 'opl_app_stable_release_session.v3' ||
    stableReleaseStateMachine?.default_mode !== 'dry_run' ||
    stableReleaseStateMachine?.execute_flag !== '--execute' ||
    !sameStringSet(stableReleaseStateMachine?.canonical_commands, [
      'start', 'retry-qualification', 'reconcile', 'resume', 'promote', 'dispatch-full-addon',
      'disposition-addon-debt', 'cancel', 'recover-stale-lock', 'complete-local',
    ]) ||
    !sameStringSet(stableReleaseStateMachine?.phases, [
      'candidate_frozen', 'source_gates_passed', 'source_gate_failed', 'standard_deadline_blocked', 'artifact_build_running',
      'artifact_build_failed', 'release_train_failed', 'qualification_failed',
      'retry_failed_gate_same_artifact', 'artifacts_qualified', 'owner_approved',
      'promotion_running', 'promotion_failed', 'release_published_not_latest',
      'distribution_synced', 'homebrew_verified', 'latest_activated',
      'awaiting_local_activation', 'standard_stable_terminal', 'addon_train_terminal',
    ]) ||
    stableReleaseStateMachine?.cohort_binding?.desktop_release_dispatch_limit_per_cohort !== 1 ||
    stableReleaseStateMachine?.cohort_binding?.cross_cohort_artifact_reuse_allowed !== false ||
    stableReleaseStateMachine?.cohort_binding?.controller_ref_is_canonical_and_separate_from_frozen_artifact_app_sha !== true ||
    stableReleaseStateMachine?.execution_policy?.deduplicate_cheap_source_gates !== true ||
    stableReleaseStateMachine?.execution_policy?.stable_complete_requires_addon_gates !== false ||
    stableReleaseStateMachine?.execution_policy?.monitor_transport_retry_limit !== 3 ||
    stableReleaseStateMachine?.execution_policy?.monitor_nonterminal_exit_preserves_running_state !== true ||
    stableReleaseStateMachine?.execution_policy?.monitor_readback_failure_preserves_running_state !== true ||
    stableReleaseStateMachine?.execution_policy?.promotion_reuses_source_release_run_id !== true ||
    stableReleaseStateMachine?.execution_policy?.promotion_requires_release_owner_receipt !== true ||
    stableReleaseStateMachine?.execution_policy?.promotion_dispatch_limit_per_cohort !== 1 ||
    stableReleaseStateMachine?.execution_policy?.promotion_minimum_remaining_budget_seconds !== 900 ||
    stableReleaseStateMachine?.execution_policy?.promotion_failure_absorbing_for_mutation !== true ||
    stableReleaseStateMachine?.execution_policy?.promotion_same_session_successor_allowed !== false ||
    stableReleaseStateMachine?.execution_policy?.promotion_retry !== 'new_stable_session_required_after_read_only_reconcile' ||
    stableReleaseStateMachine?.execution_policy?.promotion_retry_reuses_original_run_id_and_owner_receipt !== false ||
    latestMonotonicityPolicy?.target_must_be_newer_than_current_latest !== true ||
    latestMonotonicityPolicy?.equal_target_dispatch_allowed !== false ||
    latestMonotonicityPolicy?.downgrade_dispatch_allowed !== false ||
    latestMonotonicityPolicy?.same_version_action !== 'read_only_reconcile_existing_public_truth' ||
    latestMonotonicityPolicy?.older_version_action !== 'fail_closed' ||
    !sameStringSet(latestMonotonicityPolicy?.checks, [
      'controller_pre_dispatch', 'workflow_prepare', 'before_public_nonlatest', 'before_latest_activation',
    ]) ||
    stableReleaseStateMachine?.recovery_policy?.harness_mechanics_only_change_rebuilds_existing_artifact !== false ||
    stableReleaseStateMachine?.recovery_policy?.harness_mechanics_only_retry_may_use_separately_pinned_verification_harness !== false ||
    stableReleaseStateMachine?.recovery_policy?.separate_verification_harness_requires_changed_path_scope_proof !== true ||
    stableReleaseStateMachine?.recovery_policy?.verification_harness_must_not_replace_artifact_cohort_identity !== true ||
    stableReleaseStateMachine?.recovery_policy?.verification_harness_identity_must_be_recorded_in_qualification_receipt !== true ||
    stableReleaseStateMachine?.recovery_policy?.artifact_build_failed_can_reconcile_original_run_without_redispatch !== true ||
    stableReleaseStateMachine?.recovery_policy?.qualification_retry_reuses_exact_artifact_bytes !== true ||
    stableReleaseStateMachine?.artifact_cohort?.schema !== 'opl_app_build_artifact_cohort.v2' ||
    stableReleaseStateMachine?.artifact_cohort?.artifact_build_limit_per_artifact_kind_per_cohort !== 1 ||
    stableReleaseStateMachine?.qualification_receipt?.schema !== 'opl_app_artifact_qualification_receipt.v1' ||
    stableReleaseStateMachine?.recovery_policy?.bounded_qualification_attempts_per_artifact_kind !== 2 ||
    stableReleaseStateMachine?.recovery_policy?.standard_and_full_artifact_tracks_recover_independently !== true ||
    stableReleaseStateMachine?.attempt_ledger?.workflow_attempt_receipt_is_remote_evidence_not_ledger_precondition !== true ||
    stableReleaseStateMachine?.attempt_ledger?.monotonic_session_revision_required !== true ||
    stableReleaseStateMachine?.attempt_ledger?.atomic_write_requires_exclusive_lock_and_expected_revision_cas !== true ||
    stableReleaseStateMachine?.attempt_ledger?.stale_broker_revision_write_fails_closed !== true ||
    !sameStringSet(stableReleaseStateMachine?.attempt_ledger?.terminal_states, ['passed', 'failed', 'cancelled']) ||
    !sameStringSet(stableReleaseStateMachine?.attempt_ledger?.reconcile_only_states, [
      'runner_lost', 'dispatch_lost', 'reconcile_pending',
    ]) ||
    !sameStringSet(stableReleaseStateMachine?.attempt_ledger?.reconcile_inputs, [
      'github_run_readback', 'optional_typed_attempt_receipt', 'signed_exact_attempt_broker_lookup_v2',
    ]) ||
    stableReleaseStateMachine?.signed_mutation_authority?.lease_schema !== 'opl_app_release_session_lease.v2' ||
    stableReleaseStateMachine?.signed_mutation_authority?.signature_algorithm !== 'Ed25519' ||
    stableReleaseStateMachine?.signed_mutation_authority?.default_ttl_minutes !== 15 ||
    stableReleaseStateMachine?.signed_mutation_authority?.one_ticket_per_attempt_and_mutation !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.ticket_issuance_requires_latest_attempt_event_planned !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.duplicate_ticket_for_attempt_rejected !== true ||
    !sameStringSet(stableReleaseStateMachine?.signed_mutation_authority?.payload_bindings, [
      'stable_session_id', 'release_cohort_ref', 'actor', 'issuer', 'attempt_id', 'workflow', 'artifact_kind',
      'controller_workflow_sha', 'artifact_app_sha', 'mutation_payload_sha256', 'planned_session_revision',
      'target_attempt_id', 'target_run_id', 'nonce', 'expires_at', 'allowed_mutations',
    ]) ||
    stableReleaseStateMachine?.signed_mutation_authority?.allowed_mutations_cardinality !== 1 ||
    stableReleaseStateMachine?.signed_mutation_authority?.cancel_requires_separate_emergency_ticket !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.cancel_requires_target_attempt_and_run_binding !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.lease_intrinsically_enforces_nonce_single_use !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.broker_durable_nonce_consumption_required !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.nonce_single_use_enforced !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.nonce_consumed_durably_before_api_and_atomically_with_fence !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.same_attempt_replay_returns_original_receipt !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.different_attempt_nonce_reuse_rejected !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.nonce_ownership_survives_lease_expiry !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.ttl_scope !== 'first_pre_api_admission_only' ||
    stableReleaseStateMachine?.signed_mutation_authority?.historical_acceptance_validation_expires !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.historical_validation_requires_exact_run_attempt_workflow_sha_and_payload_digest !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.historical_authority_epoch_registry !== 'append_only_verify_only' ||
    stableReleaseStateMachine?.signed_mutation_authority?.retired_authority_epoch_can_authorize_new_admission !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.pre_api_admission_receipt_schema !== 'opl_app_release_mutation_pre_api_fence.v1' ||
    stableReleaseStateMachine?.signed_mutation_authority?.pre_api_admission_receipt_binds_authority_epoch !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.workflow_dispatch_input !== 'pre_api_admission_receipt_base64' ||
    stableReleaseStateMachine?.signed_mutation_authority?.post_api_acceptance_must_be_obtained_by_broker_lookup !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.workflow_lookup_response_schema !== 'opl_app_release_mutation_broker_ledger_lookup_result.v2' ||
    stableReleaseStateMachine?.signed_mutation_authority?.workflow_lookup_transport !== 'https_with_github_oidc_caller_admission' ||
    stableReleaseStateMachine?.signed_mutation_authority?.workflow_lookup_transport_failure_is_authoritative_not_found !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.workflow_lookup_random_challenge_required !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.signed_complete_version_aggregate_required !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.version_aggregate_partition_complete_from_sequence_one !== true ||
    !sameStringSet(stableReleaseStateMachine?.signed_mutation_authority?.global_latest_mutex_applies_to, [
      'promotion_dispatch',
    ]) ||
    !sameStringSet(stableReleaseStateMachine?.signed_mutation_authority?.version_scoped_mutations, [
      'desktop_release_dispatch', 'qualification_dispatch', 'full_addon_dispatch', 'release_draft_cleanup',
    ]) ||
    stableReleaseStateMachine?.signed_mutation_authority?.promotion_cancel_is_owner_child_and_does_not_advance_head !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.cancel_api_success_does_not_release_latest_mutex !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.latest_mutex_release_requires_target_terminal_readback_and_cas !== true ||
    !sameStringSet(stableReleaseStateMachine?.signed_mutation_authority?.standard_admission_deadline_required_for, [
      'desktop_release_dispatch', 'qualification_dispatch', 'promotion_dispatch',
    ]) ||
    !sameStringSet(stableReleaseStateMachine?.signed_mutation_authority?.full_addon_admission_deadline_required_for, [
      'full_addon_dispatch',
    ]) ||
    stableReleaseStateMachine?.signed_mutation_authority?.approved_controller_workflow_sha_allowlist_required !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.stable_dag_third_party_action_reference_policy !== 'exact_40_hex_commit_sha' ||
    stableReleaseStateMachine?.signed_mutation_authority?.stable_dag_moving_action_tags_allowed !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.stable_dag_bun_version !== '1.3.14' ||
    stableReleaseStateMachine?.signed_mutation_authority?.controller_sha_alone_freezes_moving_action_tags !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.normal_codex_credential_actions_write_allowed !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.normal_codex_protected_main_push_allowed !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.normal_codex_release_control_plane_write_allowed !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.normal_codex_ruleset_bypass_allowed !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.normal_codex_required_review_bypass_allowed !== false ||
    stableReleaseStateMachine?.signed_mutation_authority?.isolated_release_broker_actions_write_token_required !== true ||
    stableReleaseStateMachine?.signed_mutation_authority?.repo_local_lease_prevents_same_identity_direct_api_bypass !== false ||
    stableReleaseStateMachine?.qualification_receipt?.separate_verification_harness_allowed_only_for !== 'exact_artifact_cohort' ||
    !sameStringSet(stableReleaseStateMachine?.qualification_receipt?.verification_harness_required_fields, [
      'app_sha', 'shell_sha', 'smoke_harness_sha256', 'differs_from_artifact_cohort', 'change_scope', 'scope_proof',
    ]) ||
    stableReleaseStateMachine?.qualification_receipt?.full_temporal_service_supervisor_proof?.receipt_path !== 'smoke_summary.temporal_service_supervisor_proof' ||
    stableReleaseStateMachine?.qualification_receipt?.full_temporal_service_supervisor_proof?.schema !== 'opl_temporal_service_supervisor_proof.v1' ||
    !sameStringSet(
      stableReleaseStateMachine?.qualification_receipt?.full_temporal_service_supervisor_proof?.required_for_passed_package_profiles,
      ['full', 'homebrew-full'],
    ) ||
    !sameStringSet(
      stableReleaseStateMachine?.qualification_receipt?.full_temporal_service_supervisor_proof?.not_applicable_package_profiles,
      ['standard', 'homebrew-standard'],
    ) ||
    !sameStringSet(
      stableReleaseStateMachine?.qualification_receipt?.full_temporal_service_supervisor_proof?.mandatory_evidence,
      [
        'provider_service_start_live_action',
        'sigterm_keep_alive_fresh_pid',
        'provider_service_restart_live_action_fresh_pid',
        'launchd_bootout_bootstrap_fresh_pid',
        'fresh_fast_state_ready_after_each_transition',
        'plist_label_program_arguments_run_at_load_keep_alive',
        'persistent_sqlite_exact_default_app_support_path_header_and_file_identity',
      ],
    ) ||
    stableReleaseStateMachine?.qualification_receipt?.full_temporal_service_supervisor_proof_pass_policy !== 'passed Full or homebrew-full receipts require a bound smoke summary path and sha plus validator-clean supervisor proof; missing or invalid proof cannot produce or validate a passed receipt, override the Full VM gate, or authorize promotion' ||
    stableReleaseStateMachine?.qualification_receipt?.artifact_cohort_fields_remain_product_identity !== true ||
    stableReleaseStateMachine?.qualification_receipt?.cross_artifact_or_cross_cohort_override_allowed !== false ||
    stableReleaseStateMachine?.promotion_saga?.owner_workflow !== '.github/workflows/desktop-release-promote.yml' ||
    stableReleaseStateMachine?.promotion_saga?.framework_owner_workflow !== 'gaofeng21cn/one-person-lab/.github/workflows/release-package-channel.yml' ||
    stableReleaseStateMachine?.promotion_saga?.framework_receipt_schema !== 'opl_release_set_promotion_receipt.v1' ||
    stableReleaseStateMachine?.promotion_saga?.webui_stable_writer !== 'independent_webui_release_lane' ||
    stableReleaseStateMachine?.promotion_saga?.webui_stable_writer_count_in_app_promotion !== 0 ||
    stableReleaseStateMachine?.promotion_saga?.source_desktop_release_mutates_stable_or_full_tap !== false ||
    stableReleaseStateMachine?.promotion_saga?.redispatch_after_partial_failure_allowed !== false ||
    stableReleaseStateMachine?.promotion_saga?.full_addon_dispatch?.workflow !== '.github/workflows/desktop-release-full-addon.yml' ||
    stableReleaseStateMachine?.promotion_saga?.full_addon_dispatch?.timing !== 'after_app_latest_activation' ||
    stableReleaseStateMachine?.promotion_saga?.full_addon_dispatch?.wait_for_completion !== false ||
    stableReleaseStateMachine?.promotion_saga?.full_addon_dispatch?.dispatch_failure_blocks_standard !== false ||
    stableReleaseStateMachine?.promotion_saga?.full_addon_dispatch?.manual_same_cohort_retry_allowed !== false ||
    tapStandardVmEvidenceTransport?.source !== 'validated_artifact_qualification_receipt_raw_bytes' ||
    tapStandardVmEvidenceTransport?.encoding !== 'canonical_single_line_base64' ||
    tapStandardVmEvidenceTransport?.dispatch_field !== 'standard_vm_evidence_base64' ||
    tapStandardVmEvidenceTransport?.required !== true ||
    tapStandardVmEvidenceTransport?.tap_cross_repository_artifact_download_allowed !== false ||
    !sameStringSet(tapStandardVmEvidenceTransport?.integrity_bindings, [
      'stable_session_id', 'release_cohort_ref', 'app_sha', 'shell_sha', 'framework_sha',
      'source_release_run_id', 'standard_vm_run_id', 'standard_vm_evidence_sha256',
      'artifact.sha256', 'build_manifest.smoke_harness_sha256',
    ]) ||
    stableReleaseStateMachine?.receipts?.framework_promotion !== 'opl_release_set_promotion_receipt.v1' ||
    stableReleaseStateMachine?.receipts?.distribution !== 'opl_stable_distribution_receipt.v3' ||
    stableReleaseStateMachine?.receipts?.homebrew_activation !== 'opl_app_homebrew_activation_receipt.v2' ||
    stableReleaseStateMachine?.receipts?.promotion !== 'opl_app_promotion_saga_receipt.v2' ||
    stableReleaseStateMachine?.receipts?.full_addon !== 'opl_app_full_addon_receipt.v1' ||
    stableReleaseStateMachine?.receipts?.local_activation !== 'opl_app_local_activation_receipt.v1' ||
    stableReleaseStateMachine?.profiling?.warning_after_minutes !== 60 ||
    stableReleaseStateMachine?.profiling?.new_release_train_circuit_breaker_after_minutes !== 90 ||
    !sameStringSet(stableReleaseStateMachine?.profiling?.circuit_breaker_allows_only, [
      'read_only_reconcile', 'emergency_cancel',
    ]) ||
    stableReleaseStateMachine?.profiling?.deadline_is_absorbing !== true ||
    stableReleaseStateMachine?.profiling?.late_success_upgrades_terminal !== false ||
    typeof stableReleaseStateMachine?.authority_boundary !== 'string' ||
    !stableReleaseStateMachine.authority_boundary.includes('is not release truth')
  ) {
    console.error('FAIL stable_release_state_machine_policy: Stable must use one dry-run-first, exact-cohort state machine from source gates through promotion');
    failures += 1;
  }

  if (
    standardDeadlinePolicy?.clock_start !== 'session_created_at_equals_cohort_plan_generated_at_before_any_external_mutation' ||
    standardDeadlinePolicy?.warning_after_seconds !== 3600 ||
    standardDeadlinePolicy?.warning_event !== 'standard_release_elapsed_60m' ||
    standardDeadlinePolicy?.deadline_after_seconds !== 5400 ||
    standardDeadlinePolicy?.deadline_boundary !== 'at_or_after_90_minutes' ||
    standardDeadlinePolicy?.deadline_phase !== 'standard_deadline_blocked' ||
    standardDeadlinePolicy?.deadline_blocker !== 'standard_admission_deadline_elapsed' ||
    standardDeadlinePolicy?.blocker_persisted_before_network_read !== true ||
    standardDeadlinePolicy?.absorbing !== true ||
    standardDeadlinePolicy?.late_success_policy !== 'historical_evidence_only_no_phase_or_terminal_upgrade' ||
    !sameStringSet(standardDeadlinePolicy?.legal_after_deadline, ['read_only_reconcile', 'emergency_cancel']) ||
    standardDeadlinePolicy?.read_only_reconcile?.mutation_allowed !== false ||
    standardDeadlinePolicy?.read_only_reconcile?.exact_attempt_and_run_only !== true ||
    standardDeadlinePolicy?.read_only_reconcile?.transport_timeout_cap_seconds !== 30 ||
    standardDeadlinePolicy?.read_only_reconcile?.transport_retry_limit !== 3 ||
    standardDeadlinePolicy?.emergency_cancel?.separate_signed_ticket_required !== true ||
    standardDeadlinePolicy?.emergency_cancel?.exact_attempt_and_run_binding_required !== true ||
    standardDeadlinePolicy?.emergency_cancel?.can_release_or_reopen_deadline_blocker !== false ||
    !stringArrayIncludesAll(standardDeadlinePolicy?.forbidden_after_deadline, [
      'new_dispatch', 'same_artifact_targeted_recovery', 'promotion', 'local_activation_success',
      'success_transition', 'clock_reset',
    ])
  ) {
    console.error('FAIL stable_standard_deadline_policy: 60m warning and inclusive 90:00 durable blocker must be absorbing, bounded, and immune to late success');
    failures += 1;
  }

  if (
    fullAddonDeadlinePolicy?.clock_start !== 'signed_broker_acceptance.accepted_at' ||
    fullAddonDeadlinePolicy?.deadline_after_seconds !== 3000 ||
    fullAddonDeadlinePolicy?.deadline_source !== 'signed_broker_acceptance.full_addon_deadline_at' ||
    fullAddonDeadlinePolicy?.deadline_signed_in_pre_api_fence !== true ||
    fullAddonDeadlinePolicy?.deadline_signed_in_acceptance !== true ||
    fullAddonDeadlinePolicy?.deadline_boundary !== 'at_or_after_50_minutes' ||
    fullAddonDeadlinePolicy?.deadline_blocker !== 'full_addon_deadline_elapsed' ||
    fullAddonDeadlinePolicy?.terminal_status !== 'blocked_with_debt' ||
    fullAddonDeadlinePolicy?.absorbing !== true ||
    fullAddonDeadlinePolicy?.late_success_policy !== 'historical_evidence_only_no_addon_status_upgrade' ||
    fullAddonDeadlinePolicy?.standard_terminal_reopened !== false ||
    !sameStringSet(fullAddonDeadlinePolicy?.legal_after_deadline, ['read_only_reconcile', 'emergency_cancel'])
  ) {
    console.error('FAIL full_addon_deadline_policy: Full must use one signed 50m absorbing debt deadline independent of Standard');
    failures += 1;
  }

  if (
    coordinationBoundary?.conversation_or_agent_tree_can_schedule !== false ||
    coordinationBoundary?.conversation_or_agent_tree_can_watch !== false ||
    coordinationBoundary?.conversation_or_agent_tree_can_store_state !== false ||
    coordinationBoundary?.recursive_monitor_or_audit_agent_trees_allowed !== false ||
    coordinationBoundary?.repeated_wait_agent_polling_allowed !== false ||
    !sameStringSet(coordinationBoundary?.canonical_state_stores, [
      'opl_app_stable_release_session.v3', 'durable_release_mutation_broker_ledger', 'exact_signed_receipts',
    ]) ||
    coordinationBoundary?.handoff_policy !== 'read_canonical_session_once_then_run_one_typed_reconcile_then_take_the_unique_legal_action_or_stop'
  ) {
    console.error('FAIL release_coordination_boundary: conversations and agent trees must never schedule, watch, or store release state');
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
    !assistantRouteSmoke?.full?.required?.includes('selected_project_directory_applied_to_session_and_domain_workspace_identity') ||
    !assistantRouteSmoke?.full?.required?.includes('real_guid_composer_send_without_shell_package_activation_per_starter') ||
    !assistantRouteSmoke?.full?.required?.includes('conversation_get_readback_per_starter') ||
    !assistantRouteSmoke?.full?.required?.includes('Framework_stage_runtime_activation_uses_Stage_workspace_locator_per_starter') ||
    !assistantRouteSmoke?.full?.required?.includes('Framework_stage_runtime_activation_evidence_per_starter') ||
    !assistantRouteSmoke?.full?.required?.includes('agent_package_shortcut_route_receipt_per_starter') ||
    !assistantRouteSmoke?.full?.forbidden?.includes('direct_conversation_post') ||
    !assistantRouteSmoke?.full?.forbidden?.includes('Shell_agent_package_activation_before_or_during_send') ||
    !assistantRouteSmoke?.full?.forbidden?.includes('synthetic_Framework_stage_runtime_activation_evidence') ||
    !assistantRouteSmoke?.full?.forbidden?.includes('synthetic_agent_package_route_receipt')
  ) {
    console.error('FAIL assistant_route_smoke_policy: Full evidence must separate real Guid send without Shell activation from Framework Stage runtime activation');
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
    stableCandidateFreeze?.next_action !== 'reconcile_then_continue_frozen_session_or_plan_new_frozen_cohort' ||
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
  const fullAddonTerminal = intentPolicy?.full_addon_terminal_policy;
  const nextActionPolicy = cohortPrepare?.next_action_policy;
  const operatorPlanPolicy = cohortPrepare?.operator_plan_policy;
  if (
    !sameStringSet(intentPolicy?.allowed_values, ['stable_complete', 'standard_hotfix']) ||
    intentPolicy?.stable_complete?.standard_terminal_independent !== true ||
    intentPolicy?.stable_complete?.run_vm_smoke !== true ||
    intentPolicy?.stable_complete?.include_full_package_required !== false ||
    intentPolicy?.stable_complete?.include_full_package_role !== 'optional_same_cohort_nonblocking_addon_intent' ||
    intentPolicy?.standard_hotfix?.include_full_package !== false ||
    intentPolicy?.standard_hotfix?.full_omission_reason_required !== true ||
    intentPolicy?.standard_hotfix?.standard_terminal_independent !== true ||
    fullAddonTerminal?.intent_input !== 'include_full_package' ||
    fullAddonTerminal?.intent_role !== 'same_cohort_nonblocking_addon_intent' ||
    fullAddonTerminal?.dispatch_after !== 'standard_stable_terminal' ||
    fullAddonTerminal?.completion_required_for_standard_terminal !== false ||
    fullAddonTerminal?.independent_receipt_required !== true ||
    nextActionPolicy?.canonical_command_prefix !== 'npm run release:stable -- start' ||
    nextActionPolicy?.default_mode !== 'dry_run' ||
    nextActionPolicy?.execute_flag_required_for_broker_submission !== true ||
    nextActionPolicy?.direct_workflow_dispatch_allowed !== false ||
    operatorPlanPolicy?.required !== true ||
    operatorPlanPolicy?.workflow_input !== 'release_operator_plan_ref'
  ) {
    console.error('FAIL release_intent_policy: Standard terminal must stay independent, Full must remain a non-blocking add-on intent, and cohort plans must route through dry-run release:stable start');
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
    activeMonitor?.command !== 'npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha>' ||
    activeMonitor?.poll_interval_seconds !== null ||
    activeMonitor?.single_monitor_process !== false ||
    activeMonitor?.terminal_handoff !== 'release_stable_reconcile_once' ||
    !stringArrayIncludesAll(activeMonitor?.forbidden_patterns, [
      'direct_gh_run_watch',
      'conversation_or_agent_tree_as_scheduler',
      'conversation_or_agent_tree_as_watcher',
      'conversation_or_agent_tree_as_state_store',
      'recursive_monitor_or_audit_agent_tree',
      'repeated_wait_agent_polling',
    ])
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
    !blockerPolicy.rule.includes('instead of continuing to wait or issuing a low-level dispatch')
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
    attemptSwitch?.timeout_is_absorbing_blocker !== true ||
    attemptSwitch?.strategy !== 'same_cohort_evidence_reuse_or_targeted_gate_rerun_before_deadline_only' ||
    !sameStringSet(attemptSwitch?.after_deadline_legal_actions, ['read_only_reconcile', 'emergency_cancel'])
  ) {
    console.error('FAIL release_gate_reuse_policy: gate reuse must stop at the absorbing 90:00 deadline');
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
  if (!sameStringSet(blockerPolicy?.failed_gate_next_actions, ['repair_source_gate', 'reconcile_stable_session'])) {
    console.error('FAIL release_operator_primary_blocker_policy: failed gate next actions must repair source gate or reconcile the stable session');
    failures += 1;
  }
  for (const action of [
    'follow_cohort_plan',
    'retry_qualification_same_artifact',
    'reconcile_stable_session',
    'repair_source_gate',
    'repair_webui_runtime_image',
    'repair_ghcr_publish_access',
    'inspect_primary_blocker',
    'inspect_current_step_progress',
    'wait_for_release_run_completion',
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
    actionsCachePolicy?.schema !== 'opl_github_actions_cache_policy.v1' ||
    actionsCachePolicy?.catalog_contract !== 'contracts/app-actions-cache-catalog.json' ||
    actionsCachePolicy?.purpose !== 'bounded_reusable_acceleration_not_per_run_transport' ||
    actionsCachePolicy?.reusable_key_identity !== 'platform_tool_version_and_content_or_dependency_digest' ||
    actionsCachePolicy?.explicit_save_policy !== 'save_only_on_cache_miss_or_explicit_forced_rebuild' ||
    actionsCachePolicy?.large_cache_action_policy !== 'restore_then_explicit_main_only_save' ||
    actionsCachePolicy?.combined_actions_cache_allowed !== false ||
    actionsCachePolicy?.dynamic_key_class_env !== 'OPL_ACTIONS_CACHE_CLASS' ||
    actionsCachePolicy?.per_run_data_transport !== 'github_actions_artifacts'
  ) {
    console.error('FAIL actions_cache_contract: Actions caches must be bounded reusable acceleration with content/dependency identity and miss-only saves');
    failures += 1;
  }
  if (!sameStringSet(actionsCachePolicy?.forbidden_volatile_key_fields, [
    'github.run_id',
    'github.run_attempt',
    'github.run_number',
    'timestamp',
    'random_nonce',
  ])) {
    console.error('FAIL actions_cache_contract: reusable cache keys must forbid run, attempt, timestamp, and random identities');
    failures += 1;
  }
  const firstRunCache = actionsCachePolicy?.first_run_codex_install_asset_cache;
  if (
    actionsCachePolicy?.write_scope?.codex_install_asset_cache !== 'refs/heads/main_only' ||
    actionsCachePolicy?.write_scope?.all_large_cache_writers !== 'refs/heads/main_only' ||
    actionsCachePolicy?.write_scope?.non_main_release_or_diagnostic_refs !== 'restore_allowed_save_forbidden_for_all_large_caches' ||
    actionsCachePolicy?.write_scope?.managed_action_small_download_caches !== 'cataloged_exception' ||
    firstRunCache?.key_schema !== 'opl-first-run-codex-install-assets-<runner_os>-<runner_arch>-<codex_version>-<codex_tarball_sha256>-<platform_tarball_sha256>' ||
    firstRunCache?.digest_policy !== 'full_sha256' ||
    firstRunCache?.legacy_restore_prefix_allowed !== true ||
    firstRunCache?.save_condition !== 'resolved_key_nonempty_and_no_exact_matched_key' ||
    firstRunCache?.volatile_run_identity_allowed !== false
  ) {
    console.error('FAIL actions_cache_contract: first-run Codex install assets must use full content identity, main-only writes, and exact-match save suppression');
    failures += 1;
  }
  const fullRuntimeCache = actionsCachePolicy?.full_runtime_cache;
  if (
    fullRuntimeCache?.plan_schema !== 'opl_actions_cache_plan.v1' ||
    fullRuntimeCache?.receipt_schema !== 'opl_actions_cache_receipt.v1' ||
    !sameStringSet(fullRuntimeCache?.layer_ids, ['toolchain', 'domain-runtime', 'opl-runtime', 'skills']) ||
    fullRuntimeCache?.restore_policy !== 'exact_only' ||
    fullRuntimeCache?.writer_ref !== 'refs/heads/main' ||
    fullRuntimeCache?.cache_only_warmup?.workflow !== '.github/workflows/full-runtime-cache-warmup.yml' ||
    fullRuntimeCache?.cache_only_warmup?.scheduling !== 'ahead_of_time_for_current_main_or_planned_exact_cohort' ||
    fullRuntimeCache?.cache_only_warmup?.release_gate !== false ||
    fullRuntimeCache?.cache_only_warmup?.miss_fallback !== 'full_package_build_materializes_validates_and_main_saves_missing_layers' ||
    fullRuntimeCache?.cache_only_warmup?.requires_exact_app_shell_framework_shas !== true ||
    fullRuntimeCache?.cache_only_warmup?.build_cli_flag !== '--warm-runtime-cache-only' ||
    fullRuntimeCache?.cache_only_warmup?.forbids_release_dmg !== true ||
    fullRuntimeCache?.cache_only_warmup?.forbids_release_mutation !== true
  ) {
    console.error('FAIL actions_cache_contract: Full runtime caches must emit exact-cohort plans and receipts through a DMG-free cache-only warmup');
    failures += 1;
  }
  const obsoleteCacheCleanup = actionsCachePolicy?.obsolete_ref_cleanup;
  if (
    obsoleteCacheCleanup?.trigger !== 'after_terminal_release_closeout_or_capacity_review' ||
    obsoleteCacheCleanup?.inventory_credentials !== 'actions_read_only' ||
    obsoleteCacheCleanup?.mutation_authority !== 'isolated_cleanup_broker_required' ||
    obsoleteCacheCleanup?.unprovisioned_behavior !== 'plan_only_no_delete' ||
    !sameStringSet(obsoleteCacheCleanup?.protect, [
      'keys_reachable_from_current_main',
      'active_or_queued_workflow_keys',
      'current_frozen_cohort_keys',
      'latest_stable_rollback_keys',
    ]) ||
    obsoleteCacheCleanup?.delete !== 'exact_cache_ids_outside_protected_generations_including_stale_main_generations' ||
    obsoleteCacheCleanup?.blind_delete_all_allowed !== false ||
    typeof actionsCachePolicy?.truth_boundary !== 'string' ||
    !actionsCachePolicy.truth_boundary.includes('cannot claim artifact identity, release readiness')
  ) {
    console.error('FAIL actions_cache_contract: cache cleanup must protect reachable main, active cohort, and rollback keys while removing exact stale generations');
    failures += 1;
  }

  if (
    readinessAdmission?.workflow_job !== 'release-readiness-admission' ||
    readinessAdmission?.preflight_dependency !== 'release-preflight' ||
    readinessAdmission?.addon_requirement_input !== 'legacy_record_only_no_promotion_effect' ||
    readinessAdmission?.addon_gate_blocking_default !== false ||
    readinessAdmission?.addon_status_artifact !== 'release-addon-readiness-summary-<version>' ||
    !Array.isArray(readinessAdmission?.homebrew_source_run_gate_ids) ||
    readinessAdmission.homebrew_source_run_gate_ids.length !== 0 ||
    readinessAdmission?.homebrew_deferred_to_promotion_saga !== true ||
    readinessAdmission?.homebrew_allowed_in_source_readiness !== 'deferred_to_promotion_saga' ||
    !readinessAdmission?.rule?.includes('must not force Full, Docker/WebUI, or Homebrew add-on gates before Standard promotion') ||
    !readinessAdmission?.rule?.includes('legacy requirement input is audit-only and has no promotion effect') ||
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
    brokerAuthorityGate?.authority_contract !== 'contracts/app-release-broker-authority.json' ||
    brokerAuthorityGate?.validator !== 'scripts/release-broker-authority.ts#validateReleaseBrokerAuthority' ||
    brokerAuthorityGate?.current_admission_mode !== 'admin_one_shot_controller' ||
    brokerAuthorityGate?.validator_capability !== 'contract_read' ||
    brokerAuthorityGate?.required_before_positive_readiness !== false ||
    brokerAuthorityGate?.required_status !== 'structurally_valid' ||
    brokerAuthorityGate?.fresh_credential_isolation_receipt_required !== false ||
    brokerAuthorityGate?.unprovisioned_or_invalid_result !== 'post_release_hardening_debt' ||
    brokerAuthorityGate?.current_release_admission_readiness_field !== 'current_release_admission_readiness' ||
    brokerAuthorityGate?.isolated_broker_hardening_readiness_field !== 'isolated_broker_hardening' ||
    typeof brokerAuthorityGate?.rule !== 'string' ||
    !brokerAuthorityGate.rule.includes('administrator one-shot controller') ||
    !brokerAuthorityGate.rule.includes('post-release hardening') ||
    (brokerAuthority as Record<string, any>)?.current_release_admission?.mode !== 'admin_one_shot_controller' ||
    (brokerAuthority as Record<string, any>)?.current_release_admission?.isolated_broker_is_current_release_prerequisite !== false ||
    (brokerAuthority as Record<string, any>)?.current_release_admission?.rerun_allowed !== false ||
    (brokerAuthority as Record<string, any>)?.current_release_admission?.cancel_allowed !== false
  ) {
    console.error('FAIL release_broker_authority_readiness: current admin one-shot admission must remain separate from post-release broker hardening');
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
  const brokerAuthority = readJson(appRoot, 'contracts/app-release-broker-authority.json');
  const firstRunMatrix = readJson(appRoot, 'contracts/app-first-run-test-matrix.json');
  let failures = 0;

  failures += validateGithubReleaseName(releaseContract);
  failures += validateReleaseImmutability(releaseContract);
  failures += validateLocalInstallReleaseProfile(releaseContract);
  failures += validateReleaseExecutionTracks(releaseContract);
  failures += validateStandardUpdaterCompressionPolicy(appRoot, releaseContract);
  failures += validateReleasePreflightContract(releaseContract);
  failures += validateHomebrewVmGateStaticPolicy(appRoot, releaseContract, firstRunMatrix);
  failures += validateWebuiPackagePolicy(releaseContract);
  failures += validateReleaseAccelerationPolicy(releaseContract, brokerAuthority);
  failures += validateSourceMaterialRouteContract(appRoot);

  return failures;
}
