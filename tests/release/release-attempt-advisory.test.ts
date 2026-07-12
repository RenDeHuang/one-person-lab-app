import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflow = fs.readFileSync(
  path.join(appRoot, ".github", "workflows", "desktop-release.yml"),
  "utf8",
);
const readinessSummarizer = fs.readFileSync(
  path.join(appRoot, "scripts", "summarize-release-readiness.ts"),
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

test("release attempt telemetry forces a same-cohort reuse strategy without abandoning the release", () => {
  assert.match(workflow, /name: Summarize recent release attempts/);
  assert.doesNotMatch(workflow, /name: Summarize recent release attempts\n\s+continue-on-error: true/);
  assert.match(workflow, /attempts\.length >= 3 && !process\.env\.GATE_REUSE_PLAN_REF/);
  assert.match(workflow, /Generate release:gate-reuse-plan for the same cohort/);
  assert.match(workflow, /elapsed time never abandons an authorized release/);
  assert.match(workflow, /gh run watch --interval 60/);
  assert.doesNotMatch(workflow, /sleep 25/);
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
  assert.ok(plan.global_blockers.some((reason: string) => reason.includes("does not match requested app commit")));
  assert.ok(plan.global_blockers.some((reason: string) => reason.includes("does not match requested shell ref")));
  assert.ok(plan.global_blockers.some((reason: string) => reason.includes("does not match requested framework ref")));
  assert.equal(plan.reuse_allowed_count, 0);
  assert.equal(plan.must_run_count, 11);
});

test("standard readiness does not require Homebrew add-on gates before they run", () => {
  assert.match(
    workflow,
    /name: Build final release readiness summary[\s\S]*--include-full-package false[\s\S]*--publish-docker-webui false/,
  );
  assert.match(
    readinessSummarizer,
    /const stableHomebrewRequired = options\.includeFullPackage && homebrewReadiness\.tap_update_required === true/,
  );
});

test("Full DMG artifacts carry the cohort manifest required by the VM gate", () => {
  assert.match(fullWorkflow, /name: Write Full build artifact cohort manifest/);
  assert.match(fullWorkflow, /schema: 'opl_app_build_artifact_cohort\.v1'/);
  assert.match(
    fullWorkflow,
    /name: opl-full-first-install-dmg-\$\{\{ env\.OPL_RELEASE_VERSION \}\}-mac-arm64-cohort/,
  );
  assert.match(fullWorkflow, /path: \$\{\{ runner\.temp \}\}\/opl-build-cohort\.json/);
});

test("Docker release evidence keeps failure diagnostics without uploading the seeded data volume", () => {
  assert.match(workflow, /OPL_FLOW_SHA: 06cb8e15490e6a98b1196bfc6d526bd50471ecbc/);
  assert.match(workflow, /--build-arg OPL_FLOW_REF="\$\{OPL_FLOW_SHA\}"/);
  assert.match(workflow, /docker compose -p "\$compose_project" -f "\$compose_file" down/);
  assert.match(
    workflow,
    /rm -rf "\$linux_generated_dir\/home\/OnePersonLab\/data" "\$linux_generated_dir\/home\/OnePersonLab\/projects"/,
  );
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
