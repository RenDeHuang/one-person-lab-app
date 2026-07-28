import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parse as parseYaml } from "yaml";

const workflowName = "release-stable-post-success-followups.yml";
const workflowPath = path.join(
  process.cwd(),
  ".github",
  "workflows",
  workflowName,
);
const source = fs.readFileSync(workflowPath, "utf8");
const workflow = parseYaml(source) as Record<string, any>;

test("Stable success has one independent Full append successor trigger", () => {
  assert.deepEqual(Object.keys(workflow.on), ["workflow_run"]);
  assert.deepEqual(workflow.on.workflow_run.workflows, [
    "OPL Stable Release Bundle",
  ]);
  assert.deepEqual(workflow.on.workflow_run.types, ["completed"]);
  assert.deepEqual(workflow.permissions, { contents: "read", actions: "read" });
  assert.equal(
    workflow.concurrency.group,
    "opl-full-append-successor-${{ github.event.workflow_run.id }}",
  );
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.deepEqual(Object.keys(workflow.jobs), [
    "admit",
    "dispatch",
    "receipt",
  ]);
  assert.equal(
    workflow.jobs.admit.if,
    "${{ github.event.workflow_run.conclusion == 'success' && startsWith(github.event.workflow_run.display_title, 'OPL Stable standard ') }}",
  );
  assert.equal(
    workflow.jobs.dispatch.if,
    "${{ needs.admit.outputs.eligible == 'true' }}",
  );
  assert.deepEqual(workflow.jobs.dispatch.needs, ["admit"]);
  assert.deepEqual(workflow.jobs.dispatch.permissions, {
    contents: "read",
    actions: "write",
  });
  assert.deepEqual(workflow.jobs.receipt.needs, ["admit", "dispatch"]);
  assert.deepEqual(workflow.jobs.receipt.permissions, {
    contents: "read",
    actions: "read",
  });
});

test("admission binds Standard run, exact checkpoint, cohort, and stable publication", () => {
  assert.match(source, /\.path == "\.github\/workflows\/release-stable\.yml"/);
  assert.match(source, /\.display_title \| test\("\^OPL Stable standard/);
  assert.match(source, /\.run_attempt == 1/);
  assert.match(
    source,
    /opl-release-standard-checkpoint-\$\{\{ github\.event\.workflow_run\.id \}\}/,
  );
  assert.match(
    source,
    /opl-release-activation-\$\{\{ github\.event\.workflow_run\.id \}\}/,
  );
  assert.match(source, /checkpoint_stage.*standard_qualified/);
  assert.match(source, /standard_checkpoint_not_qualified/);
  assert.match(source, /status:"deferred"/);
  assert.match(source, /\.sources\.app\.source_commit == \$head/);
  assert.match(source, /\.source_cohort\.app_sha == \$head/);
  assert.match(source, /\.release_tag == \("v" \+ \.version\)/);
  assert.match(source, /source_bundle_digest/);
  assert.match(source, /\.bundle_digest "\$bundle"/);
  assert.match(source, /dispatch_payload=.*--argjson inputs "\$inputs_json"/);
  assert.match(source, /--arg ref "\$APP_REF"/);
  assert.match(source, /'\{ref:\$ref,inputs:\$inputs\}'/);
  assert.match(source, /--input - <<<"\$dispatch_payload"/);
  assert.doesNotMatch(source, /current_main_sha/);
});

test("successor dispatch is exactly one append_full JSON input set with no legacy qualification input", () => {
  const dispatches =
    source.match(
      /gh api --method POST "repos\/\$GITHUB_REPOSITORY\/actions\/workflows\/release-stable\.yml\/dispatches"/g,
    ) ?? [];
  assert.equal(dispatches.length, 1);
  assert.match(source, /inputs_json=/);
  assert.match(source, /operation:"append_full"/);
  assert.match(source, /include_full:"false"/);
  assert.match(source, /source_qualification_run_id:""/);
  assert.match(source, /source_qualification_receipt_digest:""/);
  assert.doesNotMatch(source, /-f "inputs=\$inputs_json"/);
  assert.doesNotMatch(
    source,
    /gh workflow run|gh run rerun|gh run cancel|gh release (?:create|edit|upload|delete)|git tag|make_latest/,
  );
});

test("successor is idempotent and does not retry an unknown dispatch result", () => {
  assert.match(source, /existing_append_full_for_cohort/);
  assert.match(source, /\.display_title \| test\("\^OPL Stable append_full/);
  assert.match(source, /cancel-in-progress: false/);
  assert.match(source, /no retry is allowed/);
  assert.match(source, /status=unknown/);
  assert.match(source, /run_attempt == 1/);
  assert.match(source, /unique \| \.\[\]/);
});

test("successor receipt declares additive and non-blocking boundaries", () => {
  assert.match(source, /opl_app_stable_full_successor_receipt\.v1/);
  assert.match(source, /standard_assets_modified:false/);
  assert.match(source, /latest_modified:false/);
  assert.match(source, /homebrew_modified:false/);
  assert.match(source, /certification_blocking:false/);
  assert.match(source, /opl-full-append-successor-intent-/);
  assert.match(source, /opl-full-append-dispatch-readback-/);
  assert.match(source, /opl-full-append-successor-receipt-/);
});
