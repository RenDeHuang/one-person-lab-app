import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const validator = path.join(appRoot, "scripts", "validate-build-artifact-cohort.ts");
const appSha = "a".repeat(40);
const shellSha = "b".repeat(40);

function run(expectedShellSha = shellSha) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opl-build-cohort-"));
  const manifest = path.join(root, "opl-build-cohort.json");
  fs.writeFileSync(
    manifest,
    JSON.stringify({
      schema: "opl_app_build_artifact_cohort.v1",
      app_sha: appSha,
      shell_sha: shellSha,
      version: "26.7.12",
    }),
  );
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      validator,
      "--manifest",
      manifest,
      "--app-sha",
      appSha,
      "--shell-sha",
      expectedShellSha,
      "--version",
      "26.7.12",
    ],
    { encoding: "utf8" },
  );
}

test("accepts an exact App and Shell build cohort", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "passed");
});

test("rejects a new smoke harness against an older Shell artifact cohort", () => {
  const result = run("c".repeat(40));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /refusing cross-cohort VM smoke/);
  assert.match(result.stderr, /shell_sha expected/);
});
