import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';
import { temporalLocalServiceDefaults, temporalManagedCommands } from './app-contract-constants.ts';

export function validateReleaseChannelContract(releaseChannel) {
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
    homebrew.agent_pack_policy?.homebrew_distribution_allowed !== false ||
    homebrew.agent_pack_policy?.homebrew_formula_allowed !== false ||
    homebrew.agent_pack_policy?.must_not_write_user_codex_state !== true ||
    homebrew.agent_pack_policy?.must_not_define_agent_semantics !== true ||
    homebrew.full_first_install_policy !== 'stable_full_cask_or_github_release_first_install_asset; never standard updater metadata'
  ) {
    throw new Error('Release channel Homebrew agent-pack policy must keep agent packs outside Homebrew distribution');
  }
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
    codexCli?.must_prefer_valid_newer_user_version !== true
  ) {
    throw new Error('Release channel Full Codex CLI payload must be compatibility-gated with a bundled fallback');
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
