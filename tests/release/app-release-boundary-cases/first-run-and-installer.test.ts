import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  runNode,
  writeExecutable,
  writeFile,
} from "./helpers.ts";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { validateFirstRunMatrix } from "../../../scripts/validate-active-shell/first-run-matrix-validator.ts";
import { validateReleaseChannelContract } from "../../../scripts/validate-active-shell/release-contract-validator.ts";
import { syncAppProductProfileToShell } from "../../../scripts/app-product-profile.ts";
import { releaseBoundaryChecks } from "../../../scripts/validate-release-boundary/release-checks.ts";

const readJson = (relativePath: string) =>
  JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), "utf8"));
const requireReleaseBoundaryCheck = (id: string) => {
  const check = releaseBoundaryChecks.find((entry) => entry.id === id);
  assert.ok(check, id);
  return check;
};

test("first-run matrix delegates policy shape to the active-shell validator", () => {
  const matrix = readJson("contracts/app-first-run-test-matrix.json");
  const adapter = readJson("contracts/app-shell-adapter.json");
  assert.doesNotThrow(() => validateFirstRunMatrix(matrix, adapter));
  const fullDmg = matrix.scenarios.find((entry) => entry.id === "full_dmg_clean_vm_smoke");
  assert.ok(fullDmg, "full_dmg_clean_vm_smoke");
  assert.equal(fullDmg.release_gate, false);
  assert.equal(fullDmg.post_publication_optional_certification, true);

  for (const scenario of matrix.scenarios.filter((entry) => entry.vm)) {
    assert.equal(scenario.release_gate, false, `${scenario.id} physical VM release gate`);
    assert.equal(
      scenario.post_publication_optional_certification,
      true,
      `${scenario.id} post-publication optional certification`,
    );
    assert.equal(
      scenario.vm.diagnostic_scope,
      "post_publication_optional_certification",
      `${scenario.id} diagnostic scope`,
    );
  }

  for (const id of [
    "standard_dmg_clean_vm_smoke",
    "homebrew_standard_cask_clean_vm_smoke",
    "one_shot_app_installer_fresh_install_smoke",
  ]) {
    const scenario = matrix.scenarios.find((entry) => entry.id === id);
    assert.ok(scenario, id);
    assert.equal(scenario.release_gate, false, id);
    assert.equal(scenario.post_publication_optional_certification, true, id);
  }
  const routeSmokeExpectations = matrix.scenarios
    .flatMap((scenario) => scenario.expects ?? [])
    .filter((expectation) =>
      expectation.includes("Packaged GUI route smoke resolves every release qualification target"),
    );
  assert.equal(routeSmokeExpectations.length, 2);
  for (const expectation of routeSmokeExpectations) {
    assert.match(expectation, /hides ordinary backend\/provider selectors/);
    assert.match(
      expectation,
      /shows the App-owned model\/reasoning and permission\/access controls/,
    );
    assert.doesNotMatch(expectation, /hides ordinary backend\/model\/permission selectors/);
  }
  assert.deepEqual(fullDmg.diagnostics_contract.home_composer_probe.required_summary_fields, [
    "missing_controls",
    "composer_state",
    "instance_counts",
  ]);
  const launchGateExpectations = matrix.scenarios
    .flatMap((scenario) => scenario.expects ?? [])
    .filter((expectation) =>
      expectation.includes("Packaged GUI launch-gate smoke keeps every release qualification target"),
    );
  assert.equal(launchGateExpectations.length, 2);
  for (const expectation of launchGateExpectations) {
    assert.match(expectation, /visible and selectable before selection/);
    assert.match(expectation, /blocks only that send with typed repair guidance/);
    assert.doesNotMatch(expectation, /visible but disabled/);
    assert.match(expectation, /does not claim a Full route receipt/);
  }
  assert.deepEqual(
    {
      role: matrix.release_qualification_agent_target_fixture.role,
      runtime_authority: matrix.release_qualification_agent_target_fixture.runtime_authority,
      catalog_membership_authority:
        matrix.release_qualification_agent_target_fixture.catalog_membership_authority,
      visibility_authority: matrix.release_qualification_agent_target_fixture.visibility_authority,
      action_authority: matrix.release_qualification_agent_target_fixture.action_authority,
    },
    {
      role: "release_qualification_probe_input_only",
      runtime_authority: false,
      catalog_membership_authority: false,
      visibility_authority: false,
      action_authority: false,
    },
  );
  assert.equal(
    matrix.scenarios.find((scenario) => scenario.id === 'standard_dmg_clean_vm_smoke').compiled_expectation_ref,
    'contracts/app-first-run-compiled-expectations.json#profiles.standard',
  );
  assert.equal(
    matrix.scenarios.find((scenario) => scenario.id === 'homebrew_standard_cask_clean_vm_smoke').compiled_expectation_ref,
    'contracts/app-first-run-compiled-expectations.json#profiles.standard',
  );
  assert.equal(
    fullDmg.compiled_expectation_ref,
    'contracts/app-first-run-compiled-expectations.json#profiles.full',
  );
  assert.equal(
    matrix.scenarios.find((scenario) => scenario.id === 'full_first_install_clean_machine').compiled_expectation_ref,
    'contracts/app-first-run-compiled-expectations.json#profiles.full',
  );

  const invalid = structuredClone(matrix);
  invalid.scenarios[0].aliases = ["legacy"];
  assert.throws(
    () => validateFirstRunMatrix(invalid, adapter),
    /must not declare compatibility aliases/,
  );

  const missingComposerProbe = structuredClone(matrix);
  const missingComposerProbeFullDmg = missingComposerProbe.scenarios.find(
    (scenario) => scenario.id === "full_dmg_clean_vm_smoke",
  );
  missingComposerProbeFullDmg.diagnostics_contract.home_composer_probe.required_summary_fields = [];
  assert.throws(
    () => validateFirstRunMatrix(missingComposerProbe, adapter),
    /must consume the App-owned Home composer state contract and fail within 60 seconds/,
  );
});

test("release qualification reuses host Codex credentials only for requested connected VM diagnostics", () => {
  const matrix = readJson("contracts/app-first-run-test-matrix.json");
  const release = readJson("contracts/app-release-channel.json");
  const adapter = readJson("contracts/app-shell-adapter.json");
  const qualification = matrix.provider_configuration_qualification;
  const boundary = release.provider_configuration_boundary;

  assert.equal(qualification.default_user_authentication, "opl_gateway_account_password");
  assert.equal(qualification.api_key_role, "explicit_compatibility_only");
  assert.equal(qualification.release_vm_default.provider_configuration_status, "not_requested");
  assert.equal(qualification.release_vm_default.synthetic_api_key_generation_allowed, false);
  assert.equal(qualification.connected_provider_diagnostic.credential_source, "developer_host_codex_selected_provider");
  assert.equal(qualification.connected_provider_diagnostic.base_url_must_match_opl_gateway, true);
  assert.equal(qualification.connected_provider_diagnostic.manual_user_input_required, false);
  assert.equal(boundary.release_vm_smoke.explicit_api_key_file_role, "optional_manual_override_only");
  assert.equal(boundary.artifact_and_package_independence.dmg_build_requires_provider_credential, false);
  assert.equal(boundary.artifact_and_package_independence.manual_full_m1_requires_provider_credential, false);
  assert.equal(
    boundary.artifact_and_package_independence.manual_full_preview_publication_requires_provider_credential,
    false,
  );
  assert.equal(boundary.artifact_and_package_independence.managed_package_currentness_requires_provider_credential, false);

  const syntheticCredentialMatrix = structuredClone(matrix);
  syntheticCredentialMatrix.provider_configuration_qualification.release_vm_default.synthetic_api_key_generation_allowed = true;
  assert.throws(
    () => validateFirstRunMatrix(syntheticCredentialMatrix, adapter),
    /must default to not_requested without synthetic credentials/,
  );

  const userPromptingMatrix = structuredClone(matrix);
  userPromptingMatrix.provider_configuration_qualification.connected_provider_diagnostic.manual_user_input_required = true;
  assert.throws(
    () => validateFirstRunMatrix(userPromptingMatrix, adapter),
    /must default to not_requested without synthetic credentials/,
  );

  const providerBoundRelease = structuredClone(release);
  providerBoundRelease.provider_configuration_boundary.artifact_and_package_independence.dmg_build_requires_provider_credential = true;
  assert.throws(
    () => validateReleaseChannelContract(providerBoundRelease),
    /must remain optional and credential-independent/,
  );
});

test("one-shot App installer boundary is enforced by release-boundary checks", () => {
  const oneShot = requireReleaseBoundaryCheck("one_shot_unsigned_local_authorization");
  const install = readJson("contracts/app-install-exposure-policy.json");

  assert.equal(oneShot.file, "install.sh");
  assert.ok(oneShot.required.includes("--stable-macos-install"));
  assert.ok(oneShot.required.includes("--authorize-local-app-only"));
  assert.deepEqual(install.distribution_install_model.installer_convergence.stable_macos_helper.artifact_integrity, {
    official_release_asset_authority: "exact_github_release_record_asset_digest",
    component_manifest_authority: "exact_github_release_record_component_manifest_asset_digest",
    custom_url_or_path_authority: "caller_supplied_sha256_quality_not_asserted",
    verification_order: "dmg_and_component_manifest_before_mount_copy_or_target_replacement",
    latest_pointer_does_not_imply_stable_qualification: true,
    non_stable_disclosure_before_target_mutation: true,
    legacy_component_manifest_policy: "allow_only_published_non_prerelease_pre_v3_manifest_with_quality_unasserted_disclosure",
  });
  assert.deepEqual(install.distribution_install_model.installer_convergence.stable_macos_helper.release_record_recovery, {
    primary_route: "anonymous_github_release_api",
    authenticated_fallback_dependency: "github_cli_gh",
    authenticated_fallback_prerequisite: "existing_authenticated_github.com_session",
    authenticated_fallback_trigger: "anonymous_release_api_request_failure_including_http_403",
    authenticated_fallback_behavior: "read_same_requested_latest_or_exact_tag_release_record_via_gh_api",
    missing_cli_or_authentication: "fail_closed_before_download_or_target_mutation",
  });
  const installGuide = fs.readFileSync(path.join(appRoot, "docs/delivery/install/README.md"), "utf8");
  assert.match(installGuide, /HTTP 403/);
  assert.match(installGuide, /gh auth/);
  assert.match(installGuide, /gh api/);
  assert.match(installGuide, /目标 App 修改前失败关闭/);
  assert.deepEqual(
    install.distribution_install_model.installer_convergence.stable_macos_helper.compatibility_entrypoints,
    [],
  );
  assert.deepEqual(
    install.distribution_install_model.installer_convergence.current_default_app_script.explicit_density_override,
    {
      macos_standard_or_full: "direct_exact_release_component_manifest_asset_selection",
      linux_standard: "exact_release_linux_x64_deb",
      linux_full: "fail_closed_before_release_asset_lookup",
    },
  );
  assert.deepEqual(
    install.distribution_install_model.installer_convergence.approved_universal_target.payload_density_routing,
    {
      macos: "explicit_standard_or_full_selects_the_matching_exact_release_asset",
      linux_x86_64: "standard_only_and_explicit_full_fails_closed_before_release_asset_lookup",
      frozen_macos_default: "prefer_full_and_fallback_to_standard_only_when_full_is_confirmed_absent",
      source_checkout_default_without_explicit_density: "framework_with_app_compatibility",
    },
  );
  assert.equal(
    install.distribution_install_model.installer_convergence.stable_macos_helper.compatibility_wrapper_status,
    "retired",
  );
  assert.equal(fs.existsSync(path.join(appRoot, "install-stable.sh")), false);
  assert.equal(fs.existsSync(path.join(appRoot, "install-free.sh")), false);
});

test("release boundary requires profile-aware Standard launch gates and Full route receipts", () => {
  const assistantSmoke = requireReleaseBoundaryCheck("first_run_vm_profile_aware_assistant_smoke");
  const release = readJson("contracts/app-release-channel.json");
  const fullPolicy = release.release_acceleration.assistant_route_smoke_policy.full;

  assert.ok(assistantSmoke.required.includes("homeAssistantStandardLaunchGateExpression"));
  assert.ok(assistantSmoke.required.includes("homeAssistantWorkspaceContextExpression"));
  assert.ok(assistantSmoke.required.includes("homeAssistantRouteSendWithoutActivationExpression"));
  assert.ok(assistantSmoke.required.includes("frameworkStageRuntimeActivationExpression"));
  assert.ok(assistantSmoke.required.includes("activeConversationRouteReceiptExpression"));
  assert.ok(
    assistantSmoke.required.includes(
      "workspace_guid_ui_send_without_shell_activation_then_conversation_get",
    ),
  );
  assert.ok(assistantSmoke.required.includes("data-opl-workspace-path"));
  assert.ok(assistantSmoke.required.includes("options.runtimeProfile !== 'full'"));
  assert.ok(assistantSmoke.required.includes("verification_mode: 'launch_gate'"));
  assert.ok(assistantSmoke.required.includes("verification_mode: 'route_receipt'"));
  assert.ok(assistantSmoke.required.includes("assistant_launch_gates_checked"));
  assert.ok(assistantSmoke.required.includes("not_applicable_standard"));
  assert.ok(assistantSmoke.forbidden.includes("createAssistantRouteReceiptConversationExpression"));
  assert.ok(assistantSmoke.forbidden.includes("POST /api/conversations"));
  assert.equal(
    release.release_acceleration.assistant_route_smoke_policy.target_fixture_ref,
    "contracts/app-first-run-test-matrix.json#release_qualification_agent_target_fixture",
  );
  assert.equal(
    release.release_acceleration.assistant_route_smoke_policy.target_fixture_boundary,
    "release_qualification_probe_input_only_without_runtime_catalog_visibility_action_or_install_authority",
  );
  assert.ok(fullPolicy.required.includes("real_guid_composer_send_without_shell_package_activation_per_target"));
  assert.ok(fullPolicy.required.includes("Framework_stage_runtime_activation_uses_Stage_workspace_locator_per_target"));
  assert.ok(fullPolicy.required.includes("Framework_stage_runtime_activation_evidence_per_target"));
  assert.ok(fullPolicy.required.includes("conversation_get_readback_per_target"));
  assert.ok(fullPolicy.forbidden.includes("direct_conversation_post"));

  const syntheticReceiptAllowed = structuredClone(release);
  syntheticReceiptAllowed.release_acceleration.assistant_route_smoke_policy.full.forbidden = [];
  assert.throws(
    () => validateReleaseChannelContract(syntheticReceiptAllowed),
    /Full assistant synthetic launch-path prohibitions/,
  );
});

test("release boundary requires production Runtime refresh evidence for both routes", () => {
  const policy = requireReleaseBoundaryCheck("first_run_vm_runtime_refresh_production_evidence");

  for (const token of [
    "function buildRuntimeRefreshProbePlan(requestedHash, timeoutMs = DEFAULT_RUNTIME_REFRESH_TIMEOUT_MS)",
    "requestedHash === '#/settings/runtime'",
    "mode: 'settings-maintenance-updates'",
    "aliasResolvedHash: '#/settings/environment'",
    "refreshHash: '#/settings/environment?section=updates'",
    "function settingsRuntimeAliasResolutionExpression(requestedHash, aliasResolvedHash)",
    "function settingsMaintenanceUpdatesReadinessExpression(refreshHash)",
    "function settingsUpdatesRefreshButtonIdleExpression()",
    "function settingsUpdatesRefreshClickExpression()",
    "const selector = '[data-testid=\"opl-managed-update-refresh\"]'",
    "requestedHash === '#/runtime'",
    "mode: 'runtime-v2'",
    "resolvedHashPrefixes: ['#/runtime']",
    "requested_hash: targetHash",
    "alias_resolved_hash: aliasResolution.aliasResolvedHash ?? aliasResolution.hash",
    "resolved_hash: resolvedHash",
    "const runtimeRefreshTimeoutMs = Math.min(",
    "options.codexReadinessPhaseTimeoutMs ?? options.timeoutMs",
    "settingsRuntimeAliasResolutionExpression(probePlan.requestedHash, probePlan.aliasResolvedHash)",
    "settingsMaintenanceUpdatesReadinessExpression(probePlan.refreshHash)",
    "settingsUpdatesRefreshClickExpression()",
    "const settingsRuntimeRefresh = await (hooks.exerciseRuntimeRefresh ?? exerciseRuntimeRefresh)(",
    "const standaloneRuntimeRefresh = await (hooks.exerciseRuntimeRefresh ?? exerciseRuntimeRefresh)(",
  ]) {
    assert.ok(policy.required.includes(token), `missing Runtime evidence source gate: ${token}`);
  }
  assert.deepEqual(policy.forbidden, []);
});

test("release boundary keeps production Gatekeeper policy profile-aware", () => {
  const policy = requireReleaseBoundaryCheck("first_run_vm_local_authorization_policy");

  assert.ok(policy.required.includes("gatekeeper_required: gatekeeperRequired"));
  assert.ok(policy.required.includes("quarantine_removal_required: !gatekeeperRequired"));
  assert.ok(
    policy.required.includes(
      "const gatekeeperRequired = hooks.requireGatekeeper === true || homebrewFullCask",
    ),
  );
  assert.ok(
    policy.required.includes(
      "(hooks.countQuarantineAttributes ?? countQuarantineAttributes)(appPath)",
    ),
  );
  assert.ok(
    policy.required.includes("if (!gatekeeperRequired && quarantineAttributeCount !== 0)"),
  );
  assert.ok(policy.required.includes("if (gatekeeperRequired && spctl.status !== 0)"));
  assert.ok(policy.required.includes("if (!options.requireGatekeeper)"));
  assert.ok(policy.required.includes("local_authorization_status: localAuthorizationStatus"));
  assert.ok(policy.required.includes("quarantine_attribute_count: quarantineAttributeCount"));
  assert.ok(policy.required.includes("xattr', ['-dr', 'com.apple.quarantine', targetApp]"));
  assert.equal(policy.required.includes("gatekeeper_required: false"), false);
  assert.equal(policy.required.includes("quarantine_removal_required: true"), false);
});

test("reusable build validates the Shell consumer after syncing the App product profile", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/_build-reusable.yml"),
    "utf8",
  );
  const syncStep = workflow.indexOf("- name: Prepare standard App payload");
  const consumerGate = workflow.indexOf("- name: Validate synced App product profile consumer");

  assert.ok(syncStep >= 0, "missing App product profile sync step");
  assert.ok(
    consumerGate > syncStep,
    "Shell profile consumer gate must run after App product profile sync",
  );
  assert.match(
    workflow.slice(consumerGate),
    /bunx vitest run tests\/unit\/common-config\/oplProductProfile\.test\.ts/,
  );
});

test("reusable build cohort selects the product App without counting nested Electron helpers", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/_build-reusable.yml"),
    "utf8",
  );
  const stepStart = workflow.indexOf("- name: Write build artifact cohort manifest");
  const stepEnd = workflow.indexOf("\n      - name:", stepStart + 1);
  const step = workflow.slice(stepStart, stepEnd);
  assert.ok(stepStart >= 0 && stepEnd > stepStart, "missing build cohort manifest step");
  assert.match(
    step,
    /if: success\(\) && startsWith\(matrix\.platform, 'macos'\)/,
    "DMG/App cohort generation must not run for Linux or Windows source preflight builds",
  );
  assert.match(
    step,
    /find out -maxdepth 2 -type d -name 'One Person Lab\.app' -print \| LC_ALL=C sort/,
  );
  assert.doesNotMatch(step, /find out -type d -name '\*\.app'/);
  assert.match(step, /if \[ "\$\{#dmg_paths\[@\]\}" -ne 1 \] \|\| \[ "\$\{#packaged_trees\[@\]\}" -ne 1 \]/);
  assert.match(step, /test -d "\$packaged_tree" && test ! -L "\$packaged_tree"/);

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-build-cohort-selector-"));
  const outRoot = path.join(fixtureRoot, "out");
  const productApp = path.join(outRoot, "mac-arm64", "One Person Lab.app");
  const helperRoot = path.join(productApp, "Contents", "Frameworks");
  const select = (args: string[]) => {
    const result = spawnSync("find", args, { cwd: fixtureRoot, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim().split("\n").filter(Boolean);
  };

  try {
    for (const name of [
      "One Person Lab Helper.app",
      "One Person Lab Helper (GPU).app",
      "One Person Lab Helper (Plugin).app",
      "One Person Lab Helper (Renderer).app",
    ]) {
      fs.mkdirSync(path.join(helperRoot, name), { recursive: true });
    }

    assert.equal(select(["out", "-type", "d", "-name", "*.app", "-print"]).length, 5);
    assert.deepEqual(
      select(["out", "-maxdepth", "2", "-type", "d", "-name", "One Person Lab.app", "-print"]),
      ["out/mac-arm64/One Person Lab.app"],
    );

    const duplicateApp = path.join(outRoot, "duplicate", "One Person Lab.app");
    fs.mkdirSync(duplicateApp, { recursive: true });
    assert.equal(
      select(["out", "-maxdepth", "2", "-type", "d", "-name", "One Person Lab.app", "-print"]).length,
      2,
    );

    fs.rmSync(productApp, { recursive: true, force: true });
    fs.rmSync(duplicateApp, { recursive: true, force: true });
    assert.equal(
      select(["out", "-maxdepth", "2", "-type", "d", "-name", "One Person Lab.app", "-print"]).length,
      0,
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("App product profile check verifies the deterministic compatibility projection without rewriting it", () => {
  const shellRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-profile-sync-"));
  const policyPath = path.join(shellRoot, "workflow-policy.json");
  const previousPolicy = process.env.OPL_FLOW_WORKFLOW_POLICY;
  try {
    const profile = readJson("contracts/app-product-profile.json");
    const productGroupOrder = profile.settings.settings_information_architecture.ordinary_groups.map(
      (group) => group.id,
    );
    const carrierFirstSeenGroupOrder = profile.settings.control_plane.ordinary_routes
      .map((route) => route.ia_group)
      .filter((groupId, index, groups) => groups.indexOf(groupId) === index);
    assert.notDeepStrictEqual(
      productGroupOrder,
      carrierFirstSeenGroupOrder,
      "product IA order must remain independent from stable carrier route order",
    );
    assert.deepStrictEqual(
      productGroupOrder,
      profile.settings.control_plane.user_navigation_projection.primary_group_order,
      "product IA order must follow the v2 user-navigation projection",
    );

    writeFile(path.join(shellRoot, "package.json"), "{}\n");
    writeFile(policyPath, JSON.stringify({
      schema: 'opl_flow_workflow_policy.v2',
      package: { id: 'opl-flow' },
      provides: [],
      requires: [],
      recommends: [],
      compatible_optional: [],
    }));
    process.env.OPL_FLOW_WORKFLOW_POLICY = policyPath;

    const written = syncAppProductProfileToShell(shellRoot);
    assert.equal(written.synced, true);
    assert.equal(
      fs.readFileSync(written.targetPath, 'utf8'),
      fs.readFileSync(path.join(appRoot, 'contracts/app-product-profile.json'), 'utf8'),
      'Shell must consume the exact App product profile bytes',
    );
    assert.equal(syncAppProductProfileToShell(shellRoot, { check: true }).verified, true);

    fs.appendFileSync(written.targetPath, '{"stale":true}\n');
    assert.throws(
      () => syncAppProductProfileToShell(shellRoot, { check: true }),
      /does not match the deterministic App profile/,
    );
  } finally {
    if (previousPolicy === undefined) delete process.env.OPL_FLOW_WORKFLOW_POLICY;
    else process.env.OPL_FLOW_WORKFLOW_POLICY = previousPolicy;
    fs.rmSync(shellRoot, { recursive: true, force: true });
  }
});

test("reusable release-boundary job validates the App projection without requiring OPL Flow source", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/_build-reusable.yml"),
    "utf8",
  );
  const jobStart = workflow.indexOf("  release-boundary:");
  const jobEnd = workflow.indexOf("\n  active-shell-tests:", jobStart);
  const job = workflow.slice(jobStart, jobEnd);

  assert.ok(jobStart >= 0 && jobEnd > jobStart, "missing reusable release-boundary job");
  assert.doesNotMatch(workflow, /opl_flow_ref:/);
  assert.doesNotMatch(
    job,
    /Checkout OPL Flow policy source|gaofeng21cn\/opl-flow|OPL_FLOW_WORKFLOW_POLICY|OPL_FULL_OPL_FLOW_ROOT|contracts\/workflow-policy\.json|codex:model-policy:check|npm run test:release-boundary/,
  );
  assert.match(job, /OPL_RELEASE_VALIDATION_PROFILE: \$\{\{ inputs\.release_validation_profile \}\}/);
  assert.match(job, /OPL_RELEASE_SKIP_MODEL_POLICY_CHECK: 'true'/);
  assert.match(job, /run: scripts\/verify\.sh release-boundary/);
});

test("fresh-runner release-boundary jobs install App root dependencies before validation", () => {
  const cases = [
    {
      path: ".github/workflows/non-release-validation.yml",
      start: "  release-boundary:",
      end: null,
      validation: "npm run test:release-boundary",
    },
    {
      path: ".github/workflows/_build-reusable.yml",
      start: "  release-boundary:",
      end: "\n  active-shell-tests:",
      validation: "scripts/verify.sh release-boundary",
    },
    {
      path: ".github/workflows/_release-bundle.yml",
      start: "  freeze:",
      end: "\n  standard-build:",
      validation: "npm run validate:release-boundary",
    },
  ];

  for (const candidate of cases) {
    const workflow = fs.readFileSync(path.join(appRoot, candidate.path), "utf8");
    const jobStart = workflow.indexOf(candidate.start);
    const jobEnd = candidate.end === null ? workflow.length : workflow.indexOf(candidate.end, jobStart);
    const job = workflow.slice(jobStart, jobEnd);
    const install = job.indexOf("npm ci --ignore-scripts");
    const validation = job.indexOf(candidate.validation);

    assert.ok(jobStart >= 0 && jobEnd > jobStart, `missing release-boundary job in ${candidate.path}`);
    assert.ok(install >= 0 && validation > install, `${candidate.path} must install App root dependencies before validation`);
  }
});

test("Bundle freeze gate installs frozen App and Framework dependencies before validation", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/_release-bundle.yml"),
    "utf8",
  );
  const jobStart = workflow.indexOf("  freeze:");
  const jobEnd = workflow.indexOf("\n  standard-build:", jobStart);
  const job = workflow.slice(jobStart, jobEnd);
  const setup = job.indexOf(
    "uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38",
  );
  const install = job.indexOf("npm ci --ignore-scripts");
  const installFramework = job.indexOf("npm --prefix framework-source ci --ignore-scripts");
  const validation = job.indexOf("- name: Validate Bundle contracts before paid work");

  assert.ok(jobStart >= 0 && jobEnd > jobStart, "missing Bundle freeze job");
  assert.ok(setup >= 0 && install > setup, "Bundle cold gate must install with pinned Node");
  assert.ok(
    installFramework > install && validation > installFramework,
    "Bundle cold gate must install frozen App and Framework dependencies before validation",
  );
});

test("reusable Standard build prepares the App projection without an OPL Flow carrier input", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/_build-reusable.yml"),
    "utf8",
  );
  const jobStart = workflow.indexOf("  build:");
  const job = workflow.slice(jobStart);
  const payload = job.indexOf("- name: Prepare standard App payload");

  assert.ok(jobStart >= 0, "missing reusable build job");
  assert.ok(payload >= 0, "missing standard payload preparation");
  assert.doesNotMatch(job, /Checkout OPL Flow policy source|repository: gaofeng21cn\/opl-flow/);
  assert.doesNotMatch(job.slice(payload), /OPL_FLOW_WORKFLOW_POLICY|OPL_FULL_OPL_FLOW_ROOT/);
});

test("one-shot App installer defaults to the shared base plus optional GUI without Agents", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-app-installer-args-"));
  const fakeCurl = path.join(tempRoot, "curl");
  const capturePath = path.join(tempRoot, "args.txt");
  writeExecutable(
    fakeCurl,
    `#!/bin/sh
cat <<'INNER'
#!/bin/bash
printf '%s\\n' "$*" > "$OPL_INSTALL_ARGS_CAPTURE"
INNER
`,
  );
  writeExecutable(
    path.join(tempRoot, "uname"),
    `#!/bin/sh
if [ "\${1:-}" = "-m" ]; then
  printf 'arm64\\n'
else
  printf 'Darwin\\n'
fi
`,
  );

  try {
    const result = spawnSync("/bin/bash", [path.join(appRoot, "install.sh")], {
      cwd: appRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        OPL_INSTALL_ARGS_CAPTURE: capturePath,
        PATH: `${tempRoot}:/usr/bin:/bin`,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.readFileSync(capturePath, "utf8").trim(), "--with-app");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Stable macOS installer binds exact release assets before mount and preserves profile selection", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-stable-installer-profile-"));
  const fakeBin = path.join(tempRoot, "bin");
  const curlArgsPath = path.join(tempRoot, "curl-args.txt");
  const ghArgsPath = path.join(tempRoot, "gh-args.txt");
  const hdiutilArgsPath = path.join(tempRoot, "hdiutil-args.txt");
  const releaseJsonPath = path.join(tempRoot, "release.json");
  const customDmgPath = path.join(tempRoot, "custom.dmg");
  const version = "26.7.20";
  const tag = `v${version}`;
  const fullName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const standardName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const componentManifestName = "opl-app-component-manifest.json";
  const fullBytes = "full-dmg-bytes\n";
  const standardBytes = "standard-dmg-bytes\n";
  const digest = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
  const asset = (name: string, bytes: string, digestOverride?: string) => ({
    name,
    digest: `sha256:${digestOverride ?? digest(bytes)}`,
    browser_download_url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/${tag}/${name}`,
  });
  const componentManifest = ({
    qualityStatus = "stable",
    buildTrigger = "manual",
    previewKind = null,
    stableQualified = true,
    nonStableNotice = false,
    skippedGates = [] as string[],
    primaryDigest,
    primaryName = standardName,
    legacyV3Manifest = false,
    legacyV3Fields = {} as Record<string, unknown>,
  }: {
    qualityStatus?: string;
    buildTrigger?: string;
    previewKind?: string | null;
    stableQualified?: boolean;
    nonStableNotice?: boolean;
    skippedGates?: string[];
    primaryDigest?: string;
    primaryName?: string;
    legacyV3Manifest?: boolean;
    legacyV3Fields?: Record<string, unknown>;
  } = {}) => JSON.stringify({
    surface_kind: "opl_app_component_manifest.v1",
    component_id: "opl-app",
    version,
    release_tag: tag,
    release_url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/tag/${tag}`,
    component_manifest_ref: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/${tag}/${componentManifestName}`,
    component_manifest_digest: `sha256:${"a".repeat(64)}`,
    primary_artifact: {
      name: primaryName,
      digest: `sha256:${primaryDigest ?? digest(standardBytes)}`,
    },
    artifacts: [{
      name: standardName,
      digest: `sha256:${primaryDigest ?? digest(standardBytes)}`,
      ref: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/${tag}/${standardName}`,
    }],
    ...(legacyV3Manifest ? legacyV3Fields : {
      release_version: version,
      quality_status: qualityStatus,
      build_trigger: buildTrigger,
      preview_kind: previewKind,
      qualification_disclosure: {
        stable_qualified: stableQualified,
        non_stable_notice: nonStableNotice,
        skipped_gates: skippedGates,
        failed_gates: [],
      },
    }),
  });
  const writeRelease = ({
    fullPresent = true,
    standardDigest,
    manifest,
    manifestAssetDigest,
    prerelease = false,
  }: {
    fullPresent?: boolean;
    standardDigest?: string;
    manifest?: Parameters<typeof componentManifest>[0];
    manifestAssetDigest?: string;
    prerelease?: boolean;
  } = {}) => {
    const manifestBytes = componentManifest({
      ...manifest,
      primaryDigest: manifest?.primaryDigest ?? standardDigest ?? digest(standardBytes),
    });
    fs.writeFileSync(
      releaseJsonPath,
      JSON.stringify({
        tag_name: tag,
        draft: false,
        prerelease,
        assets: [
          ...(fullPresent ? [asset(fullName, fullBytes)] : []),
          asset(standardName, standardBytes, standardDigest),
          asset(componentManifestName, manifestBytes, manifestAssetDigest),
        ],
      }),
    );
    fs.writeFileSync(path.join(tempRoot, componentManifestName), manifestBytes);
  };
  fs.mkdirSync(fakeBin, { recursive: true });
  fs.writeFileSync(customDmgPath, standardBytes);

  writeExecutable(
    path.join(fakeBin, "uname"),
    `#!/bin/sh
case "\${1:-}" in
  -m) printf 'arm64\\n' ;;
  *) printf 'Darwin\\n' ;;
esac
`,
  );
  writeExecutable(
    path.join(fakeBin, "curl"),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$OPL_CURL_ARGS_CAPTURE"
output=''
url=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      output="$2"
      shift 2
      ;;
    http://*|https://*)
      url="$1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done
case "$url" in
  https://api.github.com/*)
    if [ "$OPL_FAKE_RELEASE_API_HTTP" = "200" ]; then
      cp "$OPL_FAKE_RELEASE_JSON" "$output"
      exit 0
    fi
    printf 'release-api-status=%s\n' "$OPL_FAKE_RELEASE_API_HTTP" >&2
    exit 22
    ;;
  *One-Person-Lab-Full-*)
    if [ "$OPL_FAKE_FULL_HTTP" = "200" ]; then
      printf 'full-dmg-bytes\\n' > "$output"
      printf '200'
      exit 0
    fi
    printf '%s' "$OPL_FAKE_FULL_HTTP"
    exit 22
    ;;
  *One-Person-Lab-*)
    printf 'standard-dmg-bytes\\n' > "$output"
    printf '200'
    exit 0
    ;;
  *opl-app-component-manifest.json)
    cp "$OPL_FAKE_COMPONENT_MANIFEST" "$output"
    printf '200'
    exit 0
    ;;
  https://example.invalid/custom.dmg)
    printf 'standard-dmg-bytes\\n' > "$output"
    printf '200'
    exit 0
    ;;
  *)
    exit 22
    ;;
esac
`,
  );
  writeExecutable(
    path.join(fakeBin, "gh"),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$OPL_GH_ARGS_CAPTURE"
if [ "$1" = "api" ] && [ "$OPL_FAKE_GH_STATUS" = "0" ]; then
  cat "$OPL_FAKE_RELEASE_JSON"
  exit 0
fi
exit 1
`,
  );
  writeExecutable(
    path.join(fakeBin, "plutil"),
    `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] !== "-extract" || !["raw", "json"].includes(args[2]) || args[3] !== "-o" || args[4] !== "-") process.exit(2);
let value = JSON.parse(fs.readFileSync(args[5], "utf8"));
for (const part of args[1].split(".")) {
  if (value == null || !(part in value)) process.exit(1);
  value = value[part];
}
process.stdout.write(args[2] === "json" ? JSON.stringify(value) : String(value));
`,
  );
  writeExecutable(
    path.join(fakeBin, "hdiutil"),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$OPL_HDIUTIL_ARGS_CAPTURE"
exit 1
`,
  );
  for (const command of ["ditto", "find", "xattr"]) {
    writeExecutable(
      path.join(fakeBin, command),
      `#!/bin/sh
exit 1
`,
    );
  }

  try {
    const runInstaller = (
      profileArgs: string[],
      {
        fullHttp = "200",
        fullPresent = true,
        standardDigest,
        releaseTag = true,
        manifest,
        manifestAssetDigest,
        prerelease,
        releaseApiHttp = "200",
        ghStatus = "1",
        stableMacosInstall = true,
      }: {
        fullHttp?: string;
        fullPresent?: boolean;
        standardDigest?: string;
        releaseTag?: boolean;
        manifest?: Parameters<typeof componentManifest>[0];
        manifestAssetDigest?: string;
        prerelease?: boolean;
        releaseApiHttp?: string;
        ghStatus?: string;
        stableMacosInstall?: boolean;
      } = {},
    ) => {
      writeRelease({
        fullPresent,
        standardDigest,
        manifest,
        manifestAssetDigest,
        prerelease,
      });
      fs.writeFileSync(curlArgsPath, "");
      fs.writeFileSync(ghArgsPath, "");
      fs.writeFileSync(hdiutilArgsPath, "");
      return spawnSync(
        "/bin/bash",
        [
          path.join(appRoot, "install.sh"),
          ...(stableMacosInstall ? ["--stable-macos-install"] : []),
          ...profileArgs,
          ...(releaseTag ? ["--release-tag", tag] : []),
          "--yes",
          "--no-open",
        ],
        {
          cwd: appRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            OPL_CURL_ARGS_CAPTURE: curlArgsPath,
            OPL_GH_ARGS_CAPTURE: ghArgsPath,
            OPL_HDIUTIL_ARGS_CAPTURE: hdiutilArgsPath,
            OPL_FAKE_RELEASE_JSON: releaseJsonPath,
            OPL_FAKE_COMPONENT_MANIFEST: path.join(tempRoot, componentManifestName),
            OPL_FAKE_FULL_HTTP: fullHttp,
            OPL_FAKE_RELEASE_API_HTTP: releaseApiHttp,
            OPL_FAKE_GH_STATUS: ghStatus,
            PATH: `${fakeBin}:/usr/bin:/bin`,
          },
        },
      );
    };

    const availableFullResult = runInstaller([]);
    assert.notEqual(availableFullResult.status, 0, "fake hdiutil should stop after the Full download");
    const availableFullCurlArgs = fs.readFileSync(curlArgsPath, "utf8");
    assert.match(
      availableFullCurlArgs,
      /releases\/download\/v26\.7\.20\/One-Person-Lab-Full-26\.7\.20-mac-arm64\.dmg/,
    );
    assert.doesNotMatch(
      availableFullCurlArgs,
      /releases\/download\/v26\.7\.20\/One-Person-Lab-26\.7\.20-mac-arm64\.dmg/,
    );
    assert.match(
      fs.readFileSync(hdiutilArgsPath, "utf8"),
      /attach/,
      availableFullResult.stderr || availableFullResult.stdout,
    );

    const universalFullResult = runInstaller(["--full"], { stableMacosInstall: false });
    assert.notEqual(
      universalFullResult.status,
      0,
      "fake hdiutil should stop after the universal Desktop route selects Full",
    );
    assert.match(
      fs.readFileSync(curlArgsPath, "utf8"),
      /releases\/download\/v26\.7\.20\/One-Person-Lab-Full-26\.7\.20-mac-arm64\.dmg/,
    );
    assert.match(fs.readFileSync(hdiutilArgsPath, "utf8"), /attach/);

    const latestResult = runInstaller(["--standard"], { releaseTag: false });
    assert.notEqual(latestResult.status, 0, "fake hdiutil should stop after Latest DMG verification");
    assert.match(
      fs.readFileSync(curlArgsPath, "utf8"),
      /api\.github\.com\/repos\/gaofeng21cn\/one-person-lab-app\/releases\/latest/,
    );
    assert.match(latestResult.stdout, /Release quality: Stable/);
    assert.match(fs.readFileSync(hdiutilArgsPath, "utf8"), /attach/);

    const apiFallbackResult = runInstaller(["--standard"], {
      releaseApiHttp: "403",
      ghStatus: "0",
    });
    assert.notEqual(apiFallbackResult.status, 0, "fake hdiutil should stop after gh API fallback verification");
    assert.match(apiFallbackResult.stderr, /used authenticated gh fallback/);
    assert.match(
      fs.readFileSync(curlArgsPath, "utf8"),
      /api\.github\.com\/repos\/gaofeng21cn\/one-person-lab-app\/releases\/tags\/v26\.7\.20/,
    );
    assert.match(
      fs.readFileSync(ghArgsPath, "utf8"),
      /api --hostname github\.com .*repos\/gaofeng21cn\/one-person-lab-app\/releases\/tags\/v26\.7\.20/,
    );
    assert.match(fs.readFileSync(hdiutilArgsPath, "utf8"), /attach/);

    const legacyReleaseResult = runInstaller(["--standard"], {
      manifest: { legacyV3Manifest: true },
    });
    assert.notEqual(legacyReleaseResult.status, 0, "fake hdiutil should stop after a legacy release download");
    assert.match(
      legacyReleaseResult.stdout,
      /Release quality: unasserted legacy release \(V3 Stable\/Preview metadata unavailable\)/,
    );
    assert.match(legacyReleaseResult.stdout, /Legacy release manifest predates V3 qualification disclosure/);
    assert.doesNotMatch(legacyReleaseResult.stdout, /Release quality: Stable/);
    assert.match(fs.readFileSync(hdiutilArgsPath, "utf8"), /attach/);

    const partialLegacyReleaseResult = runInstaller(["--standard"], {
      manifest: {
        legacyV3Manifest: true,
        legacyV3Fields: { quality_status: "preview" },
      },
    });
    assert.notEqual(partialLegacyReleaseResult.status, 0);
    assert.match(
      partialLegacyReleaseResult.stderr,
      /must provide every V3 quality and qualification disclosure field/,
    );
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const devPreviewResult = runInstaller(["--standard"], {
      manifest: {
        qualityStatus: "preview",
        buildTrigger: "manual",
        previewKind: "dev",
        stableQualified: false,
        nonStableNotice: true,
        skippedGates: ["homebrew_clean_install"],
      },
    });
    assert.notEqual(devPreviewResult.status, 0, "fake hdiutil should stop after a disclosed Dev Preview download");
    assert.match(devPreviewResult.stdout, /Release quality: Preview \(Dev\)/);
    assert.match(
      devPreviewResult.stdout,
      /Latest pointer selects this exact release but does not change its declared quality/,
    );
    assert.match(devPreviewResult.stdout, /Non-Stable release/);
    assert.match(devPreviewResult.stdout, /homebrew_clean_install/);
    assert.doesNotMatch(devPreviewResult.stdout, /Release quality: Stable/);
    assert.match(fs.readFileSync(hdiutilArgsPath, "utf8"), /attach/);

    const nightlyPreviewResult = runInstaller(["--standard"], {
      prerelease: true,
      manifest: {
        qualityStatus: "preview",
        buildTrigger: "automated",
        previewKind: "nightly",
        stableQualified: false,
        nonStableNotice: true,
        skippedGates: ["stable_heavy_vm"],
      },
    });
    assert.notEqual(nightlyPreviewResult.status, 0, "fake hdiutil should stop after a disclosed Nightly Preview download");
    assert.match(nightlyPreviewResult.stdout, /Release quality: Preview \(Nightly\)/);
    assert.match(
      nightlyPreviewResult.stdout,
      /Latest pointer selects this exact release but does not change its declared quality/,
    );
    assert.match(nightlyPreviewResult.stdout, /Non-Stable release/);
    assert.match(nightlyPreviewResult.stdout, /stable_heavy_vm/);
    assert.doesNotMatch(nightlyPreviewResult.stdout, /Release quality: Stable/);
    assert.match(fs.readFileSync(hdiutilArgsPath, "utf8"), /attach/);

    const undisclosedPreviewResult = runInstaller(["--standard"], {
      manifest: {
        qualityStatus: "preview",
        buildTrigger: "manual",
        previewKind: "dev",
        stableQualified: false,
        nonStableNotice: true,
        skippedGates: [],
      },
    });
    assert.notEqual(undisclosedPreviewResult.status, 0);
    assert.match(undisclosedPreviewResult.stderr, /must disclose skipped qualification gates/);
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const fallbackResult = runInstaller([], { fullPresent: false });
    assert.notEqual(fallbackResult.status, 0, "fake Standard download should stop after the fallback");
    const fallbackCurlArgs = fs.readFileSync(curlArgsPath, "utf8");
    assert.match(
      fallbackCurlArgs,
      /releases\/download\/v26\.7\.20\/One-Person-Lab-26\.7\.20-mac-arm64\.dmg/,
    );
    assert.match(fallbackResult.stderr, /continuing with the Standard DMG/);
    assert.match(fs.readFileSync(hdiutilArgsPath, "utf8"), /attach/);

    const unavailableResult = runInstaller([], { fullHttp: "503" });
    assert.notEqual(unavailableResult.status, 0, "Full server failures must not select a different package");
    const unavailableCurlArgs = fs.readFileSync(curlArgsPath, "utf8");
    assert.match(unavailableCurlArgs, /One-Person-Lab-Full-26\.7\.20-mac-arm64\.dmg/);
    assert.doesNotMatch(
      unavailableCurlArgs,
      /releases\/download\/v26\.7\.20\/One-Person-Lab-26\.7\.20-mac-arm64\.dmg/,
    );
    assert.doesNotMatch(unavailableResult.stderr, /continuing with the Standard DMG/);
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const fullResult = runInstaller(["--full"], { fullPresent: false });
    assert.notEqual(fullResult.status, 0, "missing explicit Full must fail without fallback");
    const fullCurlArgs = fs.readFileSync(curlArgsPath, "utf8");
    assert.match(
      fullCurlArgs,
      /api\.github\.com\/repos\/gaofeng21cn\/one-person-lab-app\/releases\/tags\/v26\.7\.20/,
    );
    assert.doesNotMatch(
      fullCurlArgs,
      /releases\/download\/v26\.7\.20\/One-Person-Lab-26\.7\.20-mac-arm64\.dmg/,
    );
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const mismatchResult = runInstaller(["--standard"], { standardDigest: "0".repeat(64) });
    assert.notEqual(mismatchResult.status, 0);
    assert.match(mismatchResult.stderr, /DMG SHA256 mismatch/);
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const manifestIdentityMismatchResult = runInstaller(["--standard"], {
      manifest: { primaryDigest: "0".repeat(64) },
    });
    assert.notEqual(manifestIdentityMismatchResult.status, 0);
    assert.match(
      manifestIdentityMismatchResult.stderr,
      /Component manifest primary Standard DMG identity does not match the selected Release/,
    );
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const manifestDigestMismatchResult = runInstaller(["--standard"], {
      manifestAssetDigest: "0".repeat(64),
    });
    assert.notEqual(manifestDigestMismatchResult.status, 0);
    assert.match(manifestDigestMismatchResult.stderr, /Component manifest SHA256 mismatch/);
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const malformedRecordResult = runInstaller(["--standard"], { standardDigest: "missing" });
    assert.notEqual(malformedRecordResult.status, 0);
    assert.match(malformedRecordResult.stderr, /no unique digest-bound DMG asset/);
    assert.doesNotMatch(
      fs.readFileSync(curlArgsPath, "utf8"),
      /releases\/download\/v26\.7\.20\/One-Person-Lab-26\.7\.20-mac-arm64\.dmg/,
    );
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const customWithoutDigest = runInstaller(["--dmg-path", customDmgPath]);
    assert.notEqual(customWithoutDigest.status, 0);
    assert.match(customWithoutDigest.stderr, /requires --dmg-sha256/);
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const customUrlWithoutDigest = runInstaller(["--dmg-url", "https://example.invalid/custom.dmg"]);
    assert.notEqual(customUrlWithoutDigest.status, 0);
    assert.match(customUrlWithoutDigest.stderr, /requires --dmg-sha256/);
    assert.equal(fs.readFileSync(curlArgsPath, "utf8"), "");
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const customMismatch = runInstaller([
      "--dmg-path",
      customDmgPath,
      "--dmg-sha256",
      "0".repeat(64),
    ]);
    assert.notEqual(customMismatch.status, 0);
    assert.match(customMismatch.stderr, /DMG SHA256 mismatch/);
    assert.equal(fs.readFileSync(hdiutilArgsPath, "utf8"), "");

    const customVerified = runInstaller([
      "--dmg-path",
      customDmgPath,
      "--dmg-sha256",
      digest(standardBytes),
    ]);
    assert.notEqual(customVerified.status, 0, "fake hdiutil should stop after custom DMG verification");
    assert.match(customVerified.stdout, /Release quality: not asserted for a custom DMG source/);
    assert.doesNotMatch(fs.readFileSync(curlArgsPath, "utf8"), /api\.github\.com\/repos/);
    assert.match(fs.readFileSync(hdiutilArgsPath, "utf8"), /attach/);

    const customUrlVerified = runInstaller([
      "--dmg-url",
      "https://example.invalid/custom.dmg",
      "--dmg-sha256",
      digest(standardBytes),
    ]);
    assert.notEqual(customUrlVerified.status, 0, "fake hdiutil should stop after custom URL verification");
    assert.match(customUrlVerified.stdout, /Release quality: not asserted for a custom DMG source/);
    assert.doesNotMatch(fs.readFileSync(curlArgsPath, "utf8"), /opl-app-component-manifest/);
    assert.match(fs.readFileSync(hdiutilArgsPath, "utf8"), /attach/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("local authorization checks each nested directory symlink path once", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-local-authorization-symlink-"));
  const appPath = path.join(tempRoot, "One Person Lab.app");
  writeFile(path.join(appPath, "real", "sub", "f"), "abc");
  fs.mkdirSync(path.join(appPath, "plain"), { recursive: true });
  fs.symlinkSync("../real", path.join(appPath, "plain", "link"));

  const fakeBin = path.join(tempRoot, "bin");
  const xattrLog = path.join(tempRoot, "xattr.log");
  const output = path.join(tempRoot, "local-authorization-policy.json");
  writeExecutable(
    path.join(fakeBin, "xattr"),
    `#!/bin/sh
printf '%s\\n' "$3" >> "$OPL_XATTR_LOG"
exit 0
`,
  );

  const result = runNode(
    [
      "scripts/local-authorization-policy.ts",
      "--package-kind",
      "app_standard",
      "--app-path",
      appPath,
      "--output",
      output,
    ],
    {
      env: {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
        OPL_XATTR_LOG: xattrLog,
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must prove quarantine is absent or removed/);
  const checkedPaths = fs.readFileSync(xattrLog, "utf8").trim().split("\n");
  assert.deepEqual(checkedPaths.map((entry) => path.relative(appPath, entry) || ".").sort(), [
    ".",
    "plain",
    "plain/link",
    "real",
    "real/sub",
    "real/sub/f",
  ]);
  assert.equal(JSON.parse(fs.readFileSync(output, "utf8")).quarantine_attribute_count, 6);
});
