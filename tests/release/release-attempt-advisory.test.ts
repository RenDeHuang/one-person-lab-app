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

test("release attempt telemetry forces a same-cohort reuse strategy without abandoning the release", () => {
  assert.match(workflow, /name: Summarize recent release attempts/);
  assert.doesNotMatch(workflow, /name: Summarize recent release attempts\n\s+continue-on-error: true/);
  assert.match(workflow, /attempts\.length >= 3 && !process\.env\.GATE_REUSE_PLAN_REF/);
  assert.match(workflow, /Generate release:gate-reuse-plan for the same cohort/);
  assert.match(workflow, /elapsed time never abandons an authorized release/);
  assert.match(workflow, /gh run watch --interval 60/);
  assert.doesNotMatch(workflow, /sleep 25/);
});
