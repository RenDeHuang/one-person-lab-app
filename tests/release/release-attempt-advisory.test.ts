import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflow = fs.readFileSync(
  path.join(appRoot, ".github", "workflows", "_release-bundle.yml"),
  "utf8",
);
const stableWorkflow = fs.readFileSync(
  path.join(appRoot, ".github", "workflows", "release-stable.yml"),
  "utf8",
);
const fullWorkflow = fs.readFileSync(
  path.join(appRoot, ".github", "workflows", "full-first-install-release.yml"),
  "utf8",
);
const dockerCleanLinuxWorkflow = fs.readFileSync(
  path.join(appRoot, ".github", "workflows", "docker-webui-clean-linux-vm.yml"),
  "utf8",
);
const firstRunVmWorkflow = fs.readFileSync(
  path.join(appRoot, ".github", "workflows", "opl-first-run-vm.yml"),
  "utf8",
);
const reusableBuildWorkflow = fs.readFileSync(
  path.join(appRoot, ".github", "workflows", "_build-reusable.yml"),
  "utf8",
);

test("live Bundle is one-shot and serialized without a monitor-owned retry loop", () => {
  assert.match(workflow, /test "\$GITHUB_RUN_ATTEMPT" = 1/);
  assert.match(stableWorkflow, /group: opl-stable-release-bundle-\$\{\{ inputs\.version \}\}/);
  assert.match(stableWorkflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /gh run watch|gh run rerun|gh run cancel/);
});

test("gate reuse planning rejects a stale current preflight from another cohort", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-release-reuse-plan-"));
  const fixture = (name: string, value: unknown) => {
    const filePath = path.join(tempRoot, name);
    fs.writeFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
    return filePath;
  };
  const requestedApp = "a".repeat(40);
  const requestedShell = "b".repeat(40);
  const requestedFramework = "c".repeat(40);
  const staleApp = "1".repeat(40);
  const staleShell = "2".repeat(40);
  const staleFramework = "3".repeat(40);
  const currentPreflight = fixture("current-preflight.json", {
    status: "passed",
    inputs: { expected_app_head: staleApp },
    release_refs: [
      { repository: "gaofeng21cn/opl-aion-shell", resolved_sha: staleShell },
      { repository: "gaofeng21cn/one-person-lab", resolved_sha: staleFramework },
    ],
  });
  const currentRemote = fixture("current-remote.json", { status: "failed", verified_assets: [] });
  const previousCandidate = fixture("previous-candidate.json", { status: "failed" });
  const previousReadiness = fixture("previous-readiness.json", { status: "failed", gates: {} });
  const previousRemote = fixture("previous-remote.json", { status: "failed", verified_assets: [] });
  const output = path.join(tempRoot, "reuse-plan.json");

  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "scripts/plan-release-gate-reuse.ts",
      "--version",
      "26.7.12",
      "--release-mode",
      "refresh_existing",
      "--include-full-package",
      "true",
      "--run-vm-smoke",
      "true",
      "--app-commit",
      requestedApp,
      "--shell-ref",
      requestedShell,
      "--framework-ref",
      requestedFramework,
      "--current-preflight",
      currentPreflight,
      "--current-remote-verification",
      currentRemote,
      "--previous-candidate-record",
      previousCandidate,
      "--previous-readiness",
      previousReadiness,
      "--previous-remote-verification",
      previousRemote,
      "--output",
      output,
    ],
    { cwd: appRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const plan = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(plan.cohort.current_app_commit, staleApp);
  assert.equal(plan.cohort.current_shell_sha, staleShell);
  assert.equal(plan.cohort.current_framework_sha, staleFramework);
  assert.ok(
    plan.global_blockers.some((reason: string) =>
      reason.includes("does not match requested app commit"),
    ),
  );
  assert.ok(
    plan.global_blockers.some((reason: string) =>
      reason.includes("does not match requested shell ref"),
    ),
  );
  assert.ok(
    plan.global_blockers.some((reason: string) =>
      reason.includes("does not match requested framework ref"),
    ),
  );
  assert.equal(plan.reuse_allowed_count, 0);
  assert.equal(plan.must_run_count, 11);
});

test("Standard Homebrew publication and clean-VM readback are hard gates before Latest", () => {
  assert.match(workflow, /publish-homebrew-standard:[\s\S]*needs: \[updater-upgrade-qualification, freeze, freeze-inputs\]/);
  assert.match(workflow, /homebrew-standard-vm:[\s\S]*needs: \[publish-homebrew-standard, freeze, freeze-inputs\]/);
  assert.match(workflow, /homebrew-standard-readback:[\s\S]*needs: \[homebrew-standard-vm, publish-homebrew-standard, freeze, freeze-inputs\]/);
  assert.match(workflow, /publish-latest:[\s\S]*homebrew-standard-readback\.result == 'success'/);
});

test("Full DMG artifacts carry the cohort manifest required by the VM gate", () => {
  assert.equal(
    (fullWorkflow.match(/upload_full_package_artifact:[\s\S]*?default: false/g) ?? []).length,
    1,
    "large Full package uploads should be opt-in for the reusable build call",
  );
  assert.match(
    fullWorkflow,
    /name: Upload Full package workflow artifact\n\s+if: \$\{\{ always\(\) && steps\.full_package_build\.outcome == 'success' && !inputs\.cache_only && inputs\.upload_full_package_artifact \}\}/,
  );
  assert.match(fullWorkflow, /name: Write Full build artifact cohort manifest/);
  assert.match(
    fullWorkflow,
    /name: Write Full build artifact cohort manifest\n\s+if: \$\{\{ always\(\) && steps\.full_package_build\.outcome == 'success' && !inputs\.cache_only \}\}/,
  );
  assert.match(fullWorkflow, /write-build-artifact-cohort\.ts/);
  assert.match(fullWorkflow, /--kind full/);
  assert.match(fullWorkflow, /--framework-sha "\$\(git -C one-person-lab rev-parse HEAD\)"/);
  assert.match(
    fullWorkflow,
    /name: opl-full-first-install-dmg-\$\{\{ env\.OPL_RELEASE_VERSION \}\}-mac-arm64-cohort/,
  );
  assert.match(fullWorkflow, /path: \$\{\{ runner\.temp \}\}\/opl-build-cohort\.json/);
  assert.match(
    fullWorkflow,
    /name: Upload Full build artifact cohort manifest\n\s+if: \$\{\{ always\(\) && steps\.full_package_build\.outcome == 'success' && !inputs\.cache_only \}\}/,
  );
  assert.match(
    fullWorkflow,
    /name: Upload Full DMG-only workflow artifact\n\s+if: \$\{\{ always\(\) && steps\.full_package_build\.outcome == 'success' && !inputs\.cache_only \}\}/,
  );
});

test("Standard DMG cohort binds the Framework used by first-run qualification", () => {
  assert.match(
    reusableBuildWorkflow,
    /framework_ref:[\s\S]*Immutable OPL Framework ref bound into release artifact cohort evidence/,
  );
  assert.match(reusableBuildWorkflow, /--framework-sha "\$\{\{ inputs\.framework_ref \}\}"/);
  assert.match(
    workflow,
    /standard-build:[\s\S]*framework_ref: \$\{\{ needs\.freeze-inputs\.outputs\.framework_sha \}\}/,
  );
});

test("Full assembly starts only after the Standard release becomes Latest", () => {
  assert.match(
    workflow,
    /full-build:[\s\S]*needs: \[publish-latest, freeze, freeze-inputs\]/,
  );
});

test("Full VM validation rejects Framework injection into an already-built DMG", () => {
  assert.match(
    firstRunVmWorkflow,
    /package_profile=full executes the Framework bundled inside the DMG; framework_ref cannot override/,
  );
  assert.match(firstRunVmWorkflow, /framework_args=\(--framework-sha/);
});

test("Full build artifacts use deterministic release-note inputs and survive optional package upload", () => {
  assert.match(fullWorkflow, /id: full_package_build/);
  assert.match(fullWorkflow, /OPL_RELEASE_NOTES_MODE: template/);
  assert.doesNotMatch(fullWorkflow, /OPL_RELEASE_NOTES_CODEX_API_KEY:[\s\S]*release:notes:prepare/);
  assert.match(
    fullWorkflow,
    /name: Upload Full DMG-only workflow artifact\n\s+if: \$\{\{ always\(\) && steps\.full_package_build\.outcome == 'success'/,
  );
});

test("Full build rejects App and Shell product profile drift before Electron packaging", () => {
  const profileGate = fullWorkflow.indexOf(
    "name: Verify App product profile against Shell consumer",
  );
  const electronRebuild = fullWorkflow.indexOf(
    "name: Rebuild App shell native modules for Electron",
  );
  const packageBuild = fullWorkflow.indexOf("id: full_package_build");

  assert.ok(profileGate >= 0, "missing Full product-profile compatibility gate");
  assert.match(
    fullWorkflow.slice(profileGate, electronRebuild),
    /node --experimental-strip-types scripts\/app-product-profile\.ts[\s\S]*bun vitest run tests\/unit\/common-config\/oplProductProfile\.test\.ts/,
  );
  assert.ok(profileGate < electronRebuild, "profile gate must run before Electron native rebuild");
  assert.ok(profileGate < packageBuild, "profile gate must run before Full package build");
});

test("Full build verifies managed carrier and Home readiness before expensive packaging", () => {
  const carrierGate = fullWorkflow.indexOf(
    "name: Verify Full bootstrap and Home readiness before packaging",
  );
  const packageBuild = fullWorkflow.indexOf("id: full_package_build");

  assert.ok(carrierGate >= 0, "missing managed Full carrier bootstrap gate");
  assert.match(
    fullWorkflow.slice(carrierGate, packageBuild),
    /bun vitest run[\s\S]*tests\/unit\/opl-runtime\/oplRuntimeBridge\.test\.ts[\s\S]*tests\/unit\/opl-runtime\/firstRunVmSmoke\.test\.ts[\s\S]*tests\/unit\/opl-runtime\/firstRunVmSmokeScripts\.test\.ts[\s\S]*tests\/unit\/guid\/oplHomeAssistants\.test\.ts[\s\S]*VITEST_INCLUDE_DOM=1 bun vitest run --project dom[\s\S]*tests\/unit\/guid\/HomeStarters\.dom\.test\.tsx[\s\S]*tests\/unit\/guid\/useGuidSend\.oplWhitelist\.dom\.test\.tsx/,
  );
  assert.ok(carrierGate < packageBuild, "managed carrier gate must run before Full package build");
});

test("desktop Stable leaves WebUI GHCR independent while Docker evidence still prunes seeded data", () => {
  assert.doesNotMatch(workflow, /docker build|docker push|oras tag|ghcr\.io/);
  assert.match(
    dockerCleanLinuxWorkflow,
    /name: Stop Docker\/WebUI smoke container and prune generated volumes[\s\S]*sudo rm -rf[\s\S]*OnePersonLab\/data[\s\S]*OnePersonLab\/projects[\s\S]*name: Upload clean Linux VM Docker\/WebUI evidence/,
  );
});

test("VM evidence upload excludes preseed caches and package inputs", () => {
  assert.match(
    firstRunVmWorkflow,
    /name: Prune VM preseed inputs before evidence upload[\s\S]*codex-npm-cache[\s\S]*codex-package-tarballs[\s\S]*framework-source[\s\S]*name: Upload first-run VM artifacts/,
  );
});

test("VM job summary bounds large smoke diagnostics instead of exceeding GitHub limits", () => {
  assert.doesNotMatch(
    firstRunVmWorkflow,
    /cat artifacts\/opl-first-run-vm\/tart-smoke-summary\.json/,
  );
  assert.match(firstRunVmWorkflow, /const max=64\*1024/);
  assert.match(firstRunVmWorkflow, /summary truncated at 65536 bytes/);
});
