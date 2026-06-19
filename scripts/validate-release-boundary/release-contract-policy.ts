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
const requiredTartPrebakeReceiptFields = [
  'source_vm',
  'image_id_or_digest',
  'created_at',
  'profile',
  'prebaked_layers',
  'truth_boundary',
  'validation_command',
];

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

function validateGithubReleaseName(releaseContract: Record<string, any>): number {
  const releaseName = releaseContract.github_release_name;
  if (
    releaseName?.format !== 'One Person Lab v<version>' ||
    releaseName?.stable_example !== 'One Person Lab v26.6.5' ||
    releaseName?.nightly_example !== 'One Person Lab v26.6.5-nightly' ||
    releaseName?.tag_pattern !== 'v<version>'
  ) {
    console.error('FAIL github_release_name: release names must use One Person Lab v<version> for Stable and Nightly while tags stay v<version>');
    return 1;
  }
  return 0;
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
    'release_mode',
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
  const gateReuse = acceleration?.gate_reuse;
  const tartBasePrebake = acceleration?.tart_base_prebake;

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

  return failures;
}

export function validateReleaseContractPolicies(appRoot: string): number {
  const releaseContract = readJson(appRoot, 'contracts/app-release-channel.json');
  const firstRunMatrix = readJson(appRoot, 'contracts/app-first-run-test-matrix.json');
  let failures = 0;

  failures += validateGithubReleaseName(releaseContract);
  failures += validateReleasePreflightContract(releaseContract);
  failures += validateHomebrewVmGateStaticPolicy(appRoot, releaseContract, firstRunMatrix);
  failures += validateWebuiPackagePolicy(releaseContract);
  failures += validateReleaseAccelerationPolicy(releaseContract);

  return failures;
}
