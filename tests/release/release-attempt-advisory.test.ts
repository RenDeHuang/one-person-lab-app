import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflow = fs.readFileSync(
  path.join(appRoot, ".github", "workflows", "desktop-release.yml"),
  "utf8",
);

test("release attempt telemetry diagnoses repetition without blocking the release", () => {
  assert.match(workflow, /name: Summarize recent release attempts/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /they never stop an authorized release/);
  assert.doesNotMatch(workflow, /attempt_budget_override/);
  assert.doesNotMatch(workflow, /validate-release-attempt-budget/);
});
