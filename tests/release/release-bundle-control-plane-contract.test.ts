import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { appRoot } from "./app-release-boundary-cases/helpers.ts";

function readJson(relativePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), "utf8"));
}

const release = readJson("contracts/app-release-channel.json");
const control = release.release_bundle_control_plane;
const rejected = readJson(
  "docs/delivery/release/incidents/2026-07-20-v26.7.20-full-catalog-mismatch.json",
);

test("Framework owns the live immutable Release Bundle and App remains a product adapter", () => {
  assert.equal(control.schema, "opl_app_release_bundle_control_plane.v1");
  assert.equal(control.contract_status, "active");
  assert.equal(
    control.implementation_status,
    "bundle_authority_active_first_stable_terminal_proof_pending",
  );
  assert.deepEqual(control.framework_authority, {
    owner: "gaofeng21cn/one-person-lab",
    bundle_schema: "opl_release_bundle.v1",
    bundle_schema_owner: "OPL Framework",
    app_may_redefine_framework_bundle_closed_shape: false,
    store_owner: "OPL Framework",
    canonical_digest_owner: "OPL Framework",
    cli: "opl release",
    commands: ["freeze", "build", "verify", "publish", "reconcile", "status"],
    command_forms: [
      "opl release freeze --request <request.json>",
      "opl release build --bundle <bundle.json> --executor-receipt <receipt.json>",
      "opl release verify --bundle <bundle.json>",
      "opl release publish --bundle <bundle.json> --track <standard|full> --executor-receipt <remote-inspect-receipt.json>",
      "opl release reconcile --bundle <bundle.json>",
      "opl release status --bundle <bundle.json>",
    ],
    receipt_schemas: [
      "opl_release_bundle_executor_receipt.v1",
      "opl_release_bundle_operation_receipt.v1",
    ],
    live_mutation_authority: "framework_release_bundle_executor",
    rule: control.framework_authority.rule,
  });
  assert.deepEqual(control.app_authority.owns, [
    "product_release_adapter",
    "public_asset_policy",
    "prepared_ai_release_notes_policy",
    "installed_app_acceptance",
    "standard_updater_readback",
    "predecessor_to_candidate_updater_qualification",
    "homebrew_cask_publication_and_clean_vm_readback",
  ]);
  assert.ok(control.app_authority.does_not_own.includes("generic_release_bundle_schema"));
  assert.ok(control.app_authority.does_not_own.includes("generic_publisher_ledger"));
});

test("Bundle identity closes the seven-package catalog drift that invalidated Full", () => {
  assert.equal(control.identity.three_repo_sha_tuple_is_sufficient, false);
  assert.deepEqual(control.identity.minimum_source_refs, ["app_sha", "shell_sha", "framework_sha"]);
  assert.deepEqual(control.identity.required_package_ids, [
    "mas",
    "mag",
    "rca",
    "oma",
    "obf",
    "mas-scholar-skills",
    "opl-flow",
  ]);
  assert.deepEqual(
    control.identity.accepted_package_binding_modes.explicit_members.required_per_package_fields,
    ["package_id", "package_version", "owner_source_commit", "payload_manifest_sha256"],
  );
  assert.equal(
    control.identity.accepted_package_binding_modes.framework_release_set
      .must_transitively_bind_exact_required_package_set,
    true,
  );
  assert.equal(control.identity.framework_catalog_or_manifest_digest_required, true);
  assert.match(control.identity.prebuild_rule, /before any expensive build/);
});

test("local and GitHub executors consume one exact build-once Bundle", () => {
  assert.equal(control.execution.model, "build_once_verify_and_promote_many");
  assert.deepEqual(control.execution.executors, ["local", "github_actions"]);
  assert.equal(control.execution.executors_are_transport_only, true);
  assert.equal(control.execution.same_exact_bundle_required, true);
  assert.equal(control.execution.executor_switch_rebuild_allowed, false);
  assert.equal(control.execution.canonical_main_lock_during_build_verify_or_publish, false);
  assert.equal(control.prepared_notes.required_before_expensive_build, true);
  assert.equal(control.prepared_notes.publish_may_generate_or_replace, false);
  assert.equal(control.prepared_notes.template_fallback_may_publish, false);
});

test("Standard may become Latest before additive Full and Nightly is schedule-only", () => {
  assert.equal(
    control.publication.stable.only_manual_dispatch_workflow,
    ".github/workflows/release-stable.yml",
  );
  assert.equal(control.publication.stable.trigger, "workflow_dispatch");
  assert.equal(control.publication.stable.lower_level_workflows, "workflow_call_only");
  assert.deepEqual(control.publication.stable.latest_requires.slice(-3), [
    "previous_latest_to_candidate_exact_zip_updater_upgrade",
    "standard_homebrew_digest_bound_publication",
    "standard_homebrew_clean_vm_install_and_readback",
  ]);
  assert.deepEqual(control.publication.full.required_assets, [
    "One-Person-Lab-Full-<version>-mac-arm64.dmg",
    "opl-release-manifest.json",
  ]);
  assert.equal(control.publication.full.may_follow_latest, true);
  assert.deepEqual(control.publication.full.must_not_modify, [
    "standard_assets",
    "latest-arm64-mac.yml",
    "prepared_ai_release_notes",
    "latest_selection",
  ]);
  assert.equal(control.publication.full.updater_metadata_allowed, false);
  assert.equal(control.publication.ghcr.stable_critical_path, false);
  assert.equal(control.publication.ghcr.desktop_release_bundle_asset, false);
  assert.equal(control.publication.nightly.trigger, "schedule_only");
  assert.equal(control.publication.nightly.manual_dispatch_allowed, false);
  assert.equal(control.publication.nightly.uses_same_framework_cli, true);
  assert.equal(control.publication.nightly.uses_same_release_dag, true);
  assert.equal(control.publication.nightly.latest_allowed, false);
  assert.equal(release.nightly_standard.status, "retired_pending_brokered_replacement");
  assert.equal(release.nightly_standard.workflow, null);
});

test("publisher is digest-idempotent and unknown API results only reconcile", () => {
  assert.deepEqual(control.publisher_idempotency, {
    missing_asset: "upload",
    same_name_same_digest: "already_complete",
    same_name_different_digest: "fail_closed_require_new_bundle_or_version",
    unknown_api_result: "reconcile_only",
    redispatch_on_unknown_allowed: false,
    rerun_on_unknown_allowed: false,
    cancel_on_unknown_allowed: false,
  });
});

test("legacy App Bundle and broker/state-machine surfaces are read-only compatibility", () => {
  assert.equal(control.legacy_compatibility.mode, "read_only_receipt_parser");
  assert.equal(control.legacy_compatibility.app_schema, "opl_app_release_bundle.v1");
  assert.deepEqual(control.legacy_compatibility.accepted_commands, [
    "assemble",
    "verify",
    "status",
  ]);
  assert.equal(control.legacy_compatibility.can_claim_release_ready, false);
  assert.equal(
    control.legacy_compatibility.legacy_broker_and_stable_state_machine_live_mutation_authority,
    false,
  );
  assert.equal(control.legacy_compatibility.new_legacy_dispatch_publish_or_rebuild_allowed, false);
});

test("failed v26.7.20 Full digest is permanently excluded from every Bundle", () => {
  assert.equal(rejected.schema, "opl_app_rejected_release_artifact.v1");
  assert.equal(rejected.artifact.size_bytes, 708064535);
  assert.equal(
    rejected.artifact.sha256,
    "3b34e0831609b9c593798d335a757643c4a7f2cfafbe38b818704c03ea42fb1e",
  );
  assert.equal(rejected.qualification.typed_failure, "catalog/package_ref_mismatch");
  assert.equal(rejected.evidence.root, "/private/tmp/opl-terminal-full-a80e-p0");
  assert.equal(rejected.disposition.status, "permanently_rejected");
  assert.equal(rejected.disposition.publish_allowed, false);
  assert.equal(rejected.disposition.upload_retry_allowed, false);
  assert.equal(rejected.disposition.same_bytes_requalification_allowed, false);
  assert.equal(rejected.disposition.same_bytes_may_enter_release_bundle, false);
  assert.ok(
    control.cutover.rejected_artifact_receipts.includes(
      "docs/delivery/release/incidents/2026-07-20-v26.7.20-full-catalog-mismatch.json",
    ),
  );
});

test("release guide points to the Bundle authority before legacy instructions", () => {
  const readme = fs.readFileSync(path.join(appRoot, "docs/delivery/release/README.md"), "utf8");
  const bundlePointer = readme.indexOf("immutable-release-bundle.md");
  const legacyInstructions = readme.indexOf("## GitHub Actions Release Path");
  assert.ok(bundlePointer >= 0);
  assert.ok(legacyInstructions < 0 || bundlePointer < legacyInstructions);
  assert.match(readme, /legacy surfaces are read-only/);
});
