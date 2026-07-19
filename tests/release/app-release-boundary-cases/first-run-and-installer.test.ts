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
  for (const id of [
    "standard_dmg_clean_vm_smoke",
    "full_dmg_clean_vm_smoke",
    "homebrew_standard_cask_clean_vm_smoke",
  ]) {
    const scenario = matrix.scenarios.find((entry) => entry.id === id);
    assert.ok(scenario, id);
    assert.equal(scenario.release_gate, true, id);
  }
  const routeSmokeExpectations = matrix.scenarios
    .flatMap((scenario) => scenario.expects ?? [])
    .filter((expectation) => expectation.includes("Packaged GUI route smoke selects MAS"));
  assert.equal(routeSmokeExpectations.length, 2);
  for (const expectation of routeSmokeExpectations) {
    assert.match(expectation, /hides ordinary backend\/provider selectors/);
    assert.match(
      expectation,
      /shows the App-owned model\/reasoning and permission\/access controls/,
    );
    assert.doesNotMatch(expectation, /hides ordinary backend\/model\/permission selectors/);
  }
  const fullDmg = matrix.scenarios.find((scenario) => scenario.id === "full_dmg_clean_vm_smoke");
  assert.deepEqual(fullDmg.diagnostics_contract.home_composer_probe.required_summary_fields, [
    "missing_controls",
    "composer_state",
    "instance_counts",
  ]);
  const launchGateExpectations = matrix.scenarios
    .flatMap((scenario) => scenario.expects ?? [])
    .filter((expectation) => expectation.includes("Packaged GUI launch-gate smoke keeps MAS"));
  assert.equal(launchGateExpectations.length, 2);
  for (const expectation of launchGateExpectations) {
    assert.match(expectation, /visible and selectable before selection/);
    assert.match(expectation, /blocks only that send with typed repair guidance/);
    assert.doesNotMatch(expectation, /visible but disabled/);
    assert.match(expectation, /does not claim an agent_package_shortcut invocation receipt/);
  }
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

test("one-shot App installer boundary is enforced by release-boundary checks", () => {
  const oneShot = requireReleaseBoundaryCheck("one_shot_unsigned_local_authorization");
  const stable = requireReleaseBoundaryCheck("short_stable_macos_installer");

  assert.equal(oneShot.file, "install.sh");
  assert.ok(oneShot.required.includes("--stable-macos-install"));
  assert.ok(oneShot.required.includes("--authorize-local-app-only"));
  assert.equal(stable.file, "install-stable.sh");
  assert.ok(stable.required.some((entry) => entry.includes("install.sh")));
  assert.ok(stable.required.some((entry) => entry.includes("--stable-macos-install")));
  assert.equal(fs.existsSync(path.join(appRoot, "install-free.sh")), false);
});

test("release boundary requires profile-aware Standard launch gates and Full route receipts", () => {
  const assistantSmoke = requireReleaseBoundaryCheck("first_run_vm_profile_aware_assistant_smoke");
  const release = readJson("contracts/app-release-channel.json");
  const fullPolicy = release.release_acceleration.assistant_route_smoke_policy.full;

  assert.ok(assistantSmoke.required.includes("homeAssistantStandardLaunchGateExpression"));
  assert.ok(assistantSmoke.required.includes("homeAssistantWorkspacePreparationExpression"));
  assert.ok(assistantSmoke.required.includes("homeAssistantRouteSendExpression"));
  assert.ok(assistantSmoke.required.includes("activeConversationRouteReceiptExpression"));
  assert.ok(assistantSmoke.required.includes("opl_agent_package_activation"));
  assert.ok(assistantSmoke.required.includes("data-opl-workspace-path"));
  assert.ok(assistantSmoke.required.includes("options.runtimeProfile !== 'full'"));
  assert.ok(assistantSmoke.required.includes("verification_mode: 'launch_gate'"));
  assert.ok(assistantSmoke.required.includes("verification_mode: 'route_receipt'"));
  assert.ok(assistantSmoke.required.includes("assistant_launch_gates_checked"));
  assert.ok(assistantSmoke.required.includes("not_applicable_standard"));
  assert.ok(assistantSmoke.forbidden.includes("createAssistantRouteReceiptConversationExpression"));
  assert.ok(assistantSmoke.forbidden.includes("POST /api/conversations"));
  assert.ok(fullPolicy.required.includes("agent_package_activate_action_per_starter"));
  assert.ok(fullPolicy.required.includes("real_guid_composer_send_per_starter"));
  assert.ok(fullPolicy.required.includes("conversation_get_readback_per_starter"));
  assert.ok(fullPolicy.forbidden.includes("direct_conversation_post"));

  const syntheticReceiptAllowed = structuredClone(release);
  syntheticReceiptAllowed.release_acceleration.assistant_route_smoke_policy.full.forbidden = [];
  assert.throws(
    () => validateReleaseChannelContract(syntheticReceiptAllowed),
    /Full assistant synthetic launch-path prohibitions/,
  );
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

test("App product profile check verifies the deterministic compatibility projection without rewriting it", () => {
  const shellRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-profile-sync-"));
  const policyPath = path.join(shellRoot, "workflow-policy.json");
  const previousPolicy = process.env.OPL_FLOW_WORKFLOW_POLICY;
  try {
    writeFile(path.join(shellRoot, "package.json"), "{}\n");
    writeFile(policyPath, JSON.stringify({ requires: [], recommends: [] }));
    process.env.OPL_FLOW_WORKFLOW_POLICY = policyPath;

    const written = syncAppProductProfileToShell(shellRoot);
    assert.equal(written.synced, true);
    assert.equal(syncAppProductProfileToShell(shellRoot, { check: true }).verified, true);

    fs.appendFileSync(written.targetPath, '{"stale":true}\n');
    assert.throws(
      () => syncAppProductProfileToShell(shellRoot, { check: true }),
      /does not match the deterministic App \+ OPL Flow projection/,
    );
  } finally {
    if (previousPolicy === undefined) delete process.env.OPL_FLOW_WORKFLOW_POLICY;
    else process.env.OPL_FLOW_WORKFLOW_POLICY = previousPolicy;
    fs.rmSync(shellRoot, { recursive: true, force: true });
  }
});

test("reusable release-boundary job checks out its OPL Flow authority source", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/_build-reusable.yml"),
    "utf8",
  );
  const jobStart = workflow.indexOf("  release-boundary:");
  const jobEnd = workflow.indexOf("\n  active-shell-tests:", jobStart);
  const job = workflow.slice(jobStart, jobEnd);

  assert.ok(jobStart >= 0 && jobEnd > jobStart, "missing reusable release-boundary job");
  assert.match(workflow, /opl_flow_ref:[\s\S]*Immutable opl-flow ref[\s\S]*default: ''/);
  assert.match(
    job,
    /name: Checkout OPL Flow policy source[\s\S]*repository: gaofeng21cn\/opl-flow/,
  );
  assert.match(job, /ref: \$\{\{ inputs\.opl_flow_ref \}\}[\s\S]*path: opl-flow/);
  assert.match(job, /OPL_FLOW_WORKFLOW_POLICY:.*opl-flow\/contracts\/workflow-policy\.json/);
  assert.match(job, /OPL_FULL_OPL_FLOW_ROOT:.*opl-flow/);
});

test("fresh-runner release-boundary jobs install App root dependencies before validation", () => {
  const cases = [
    {
      path: ".github/workflows/non-release-validation.yml",
      start: "  release-boundary:",
      end: null,
    },
    {
      path: ".github/workflows/_build-reusable.yml",
      start: "  release-boundary:",
      end: "\n  active-shell-tests:",
    },
    {
      path: ".github/workflows/desktop-release.yml",
      start: "  release-workflow-contract:",
      end: "\n  release-source-gate:",
    },
  ];

  for (const candidate of cases) {
    const workflow = fs.readFileSync(path.join(appRoot, candidate.path), "utf8");
    const jobStart = workflow.indexOf(candidate.start);
    const jobEnd = candidate.end === null ? workflow.length : workflow.indexOf(candidate.end, jobStart);
    const job = workflow.slice(jobStart, jobEnd);
    const install = job.indexOf("run: npm ci --ignore-scripts");
    const validation = job.indexOf("npm run test:release-boundary");

    assert.ok(jobStart >= 0 && jobEnd > jobStart, `missing release-boundary job in ${candidate.path}`);
    assert.ok(install >= 0 && validation > install, `${candidate.path} must install App root dependencies before validation`);
  }
});

test("release source gate installs frozen App dependencies before boundary validation", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/desktop-release.yml"),
    "utf8",
  );
  const jobStart = workflow.indexOf("  release-source-gate:");
  const jobEnd = workflow.indexOf("\n  standard-build:", jobStart);
  const job = workflow.slice(jobStart, jobEnd);
  const setup = job.indexOf(
    "uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38",
  );
  const install = job.indexOf(
    "working-directory: artifact-app\n        run: npm ci --ignore-scripts",
  );
  const setupBun = job.indexOf(
    "uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
  );
  const installShell = job.indexOf(
    "working-directory: artifact-app/shells/aionui\n        run: bun install --frozen-lockfile",
  );
  const validation = job.indexOf("- name: Validate release source gate");

  assert.ok(jobStart >= 0 && jobEnd > jobStart, "missing release source gate job");
  assert.ok(setup >= 0 && install > setup, "release source gate must install with pinned Node");
  assert.ok(
    setupBun > install && installShell > setupBun,
    "release source gate must install the frozen Shell with pinned Bun",
  );
  assert.match(job.slice(setupBun, installShell), /bun-version: '1\.3\.14'/);
  assert.ok(
    validation > installShell,
    "release source gate must install frozen App and Shell dependencies before validation",
  );
});

test("reusable build job checks out OPL Flow before preparing the standard payload", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/_build-reusable.yml"),
    "utf8",
  );
  const jobStart = workflow.indexOf("  build:");
  const job = workflow.slice(jobStart);
  const checkout = job.indexOf("- name: Checkout OPL Flow policy source");
  const payload = job.indexOf("- name: Prepare standard App payload");

  assert.ok(jobStart >= 0, "missing reusable build job");
  assert.ok(
    checkout >= 0 && payload > checkout,
    "OPL Flow must be available before standard payload preparation",
  );
  assert.match(
    job,
    /repository: gaofeng21cn\/opl-flow[\s\S]*ref: \$\{\{ inputs\.opl_flow_ref \}\}[\s\S]*path: opl-flow/,
  );
  assert.match(
    job.slice(payload),
    /OPL_FLOW_WORKFLOW_POLICY:.*opl-flow\/contracts\/workflow-policy\.json/,
  );
  assert.match(job.slice(payload), /OPL_FULL_OPL_FLOW_ROOT:.*opl-flow/);
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
    assert.equal(fs.readFileSync(capturePath, "utf8").trim(), "--with-app --skip-packages");
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
