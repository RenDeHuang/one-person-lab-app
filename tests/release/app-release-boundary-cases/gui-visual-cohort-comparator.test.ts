import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  compareGuiVisualCohort,
  comparePixels,
  decodePng,
  encodeRgbaPng,
  type ComparisonInput,
  type RgbaImage,
} from "../../../scripts/compare-gui-visual-cohort.ts";

const appRoot = path.resolve(import.meta.dirname, "../../..");

function readAuthority() {
  const cohortBytes = fs.readFileSync(
    path.join(appRoot, "contracts/app-gui-visual-reference-cohort.json"),
  );
  const appContractBytes = fs.readFileSync(
    path.join(appRoot, "contracts/app-gui-product-contract.json"),
  );
  const cohort = JSON.parse(cohortBytes.toString("utf8"));
  const appContract = JSON.parse(appContractBytes.toString("utf8"));
  cohort.capture_contract.supported_viewports.desktop = {
    width: 4,
    height: 4,
  };
  cohort.capture_contract.supported_viewports.narrow = {
    width: 4,
    height: 4,
  };
  const adjustedCohortBytes = Buffer.from(
    `${JSON.stringify(cohort, null, 2)}\n`,
  );
  return {
    cohort,
    cohortBytes: adjustedCohortBytes,
    appContract,
    appContractBytes,
  };
}

function solidImage(
  width: number,
  height: number,
  rgba: [number, number, number, number],
): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.set(rgba, offset);
  }
  return { width, height, data };
}

function digest(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function makeFixture(
  mutate?: (context: {
    authority: ReturnType<typeof readAuthority>;
    input: ComparisonInput;
    referenceDirectory: string;
    candidateDirectory: string;
  }) => void,
) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "opl-gui-comparator-test-"),
  );
  const referenceDirectory = path.join(root, "reference");
  const candidateDirectory = path.join(root, "candidate");
  const diffDirectory = path.join(root, "diff");
  fs.mkdirSync(referenceDirectory);
  fs.mkdirSync(candidateDirectory);
  const authority = readAuthority();
  const referenceBuild = `${authority.cohort.reference.product} ${authority.cohort.reference.bundle_version} build ${authority.cohort.reference.build}`;
  const bindings: Record<string, string>[] = [];

  for (const scene of authority.cohort.scene_matrix) {
    const referenceBytes = encodeRgbaPng(solidImage(4, 4, [20, 40, 60, 255]));
    const candidateBytes = Buffer.from(referenceBytes);
    fs.writeFileSync(
      path.join(referenceDirectory, scene.image),
      referenceBytes,
    );
    fs.writeFileSync(
      path.join(candidateDirectory, scene.image),
      candidateBytes,
    );
    bindings.push({
      scene_id: scene.id,
      reference_product_build: referenceBuild,
      reference_observed_at: authority.cohort.reference.observed_on,
      app_contract_ref: authority.cohort.candidate.app_contract_ref,
      shell_commit: "1c7c384e8326a3703ab36c2030aaaa22a6da001b",
      package_or_dev_build_identity: "local:test",
      os_version: "macOS test",
      architecture: "arm64",
      display_scale: "2",
      viewport: scene.viewport,
      theme: scene.theme,
      locale: scene.locale,
      route: scene.route,
      state: scene.state,
      reference_screenshot_sha256: digest(referenceBytes),
      candidate_screenshot_sha256: digest(candidateBytes),
      verdict: "accepted",
    });
  }
  const input: ComparisonInput = {
    schema: "opl_app_gui_visual_comparison_input.v1",
    reference_directory: "reference",
    candidate_directory: "candidate",
    diff_directory: "diff",
    bindings,
  };
  mutate?.({
    authority,
    input,
    referenceDirectory,
    candidateDirectory,
  });
  return {
    root,
    authority,
    input,
    receipt: () => compareGuiVisualCohort(input, root, authority),
  };
}

function rewriteCandidate(
  fixture: ReturnType<typeof makeFixture>,
  sceneIndex: number,
  image: RgbaImage,
): string {
  const scene = fixture.authority.cohort.scene_matrix[sceneIndex];
  const bytes = encodeRgbaPng(image);
  fs.writeFileSync(path.join(fixture.root, "candidate", scene.image), bytes);
  return digest(bytes);
}

test("PNG codec preserves RGBA bytes and pixel comparison includes alpha", () => {
  const source = solidImage(2, 2, [10, 20, 30, 40]);
  source.data.set([12, 24, 36, 48], 4);
  const decoded = decodePng(encodeRgbaPng(source));
  assert.deepEqual(decoded, source);

  const candidate = {
    ...decoded,
    data: new Uint8Array(decoded.data),
  };
  candidate.data[3] = 60;
  const metrics = comparePixels(decoded, candidate, [], 8);
  assert.equal(metrics.changedPixels, 1);
  assert.equal(metrics.changedPixelRatio, 0.25);
  assert.equal(metrics.meanAbsoluteChannelDelta, 20 / 16);
});

test("CLI failures are machine-readable and exit nonzero", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "opl-gui-comparator-cli-test-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const inputPath = path.join(root, "invalid.json");
  fs.writeFileSync(inputPath, "{not-json", "utf8");
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      path.join(appRoot, "scripts/compare-gui-visual-cohort.ts"),
      "--input",
      inputPath,
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.schema, "opl_app_gui_visual_comparison_receipt.v1");
  assert.equal(receipt.status, "failed");
  assert.equal(receipt.violations.length, 1);
  assert.equal(receipt.violations[0].code, "comparator_execution_failed");
  assert.match(receipt.violations[0].message, /JSON/);
});

test("canonical 16-scene cohort passes only with exact bindings and emits every diff PNG", (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  const receipt = fixture.receipt();
  assert.equal(receipt.status, "passed");
  assert.deepEqual(receipt.summary, {
    expected_scene_count: 16,
    compared_scene_count: 16,
    passed_scene_count: 16,
    failed_scene_count: 0,
  });
  assert.deepEqual(receipt.claims, {
    scene_compared: true,
    layout_checked: true,
    visual_delta_reviewed: true,
    scene_bound_visual_parity: true,
  });
  assert.equal(
    fs.readdirSync(path.join(fixture.root, "diff")).length,
    16,
  );
  for (const scene of receipt.scenes) {
    assert.match(scene.diff_png, /\.diff\.png$/);
    assert.equal(
      decodePng(
        fs.readFileSync(path.join(fixture.root, "diff", scene.diff_png)),
      ).width,
      4,
    );
  }
});

test("pixel, digest, and human review violations are deterministic and fail closed", (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const scene = fixture.authority.cohort.scene_matrix[0];
  rewriteCandidate(fixture, 0, solidImage(4, 4, [255, 255, 255, 0]));
  const binding = fixture.input.bindings.find(
    (entry) => entry.scene_id === scene.id,
  )!;
  binding.verdict = "rejected";

  const receipt = fixture.receipt();
  assert.equal(receipt.status, "failed");
  assert.deepEqual(
    receipt.scenes[0]!.violations.map((violation) => violation.code),
    [
      "human_review_not_accepted",
      "screenshot_sha256_mismatch",
      "changed_pixel_ratio_exceeded",
      "mean_absolute_channel_delta_exceeded",
    ],
  );
  assert.equal(receipt.claims.visual_delta_reviewed, false);
  assert.equal(receipt.claims.scene_bound_visual_parity, false);
});

test("missing scenes, dimension mismatch, unexpected bindings, and excessive masks fail closed", (t) => {
  const fixture = makeFixture(({ authority, input, referenceDirectory }) => {
    const first = authority.cohort.scene_matrix[0];
    const third = authority.cohort.scene_matrix[2];
    third.masks = [
      {
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        reason: "caret_blink",
      },
    ];
    fs.rmSync(path.join(referenceDirectory, first.image));
    input.bindings.push({
      ...input.bindings[0]!,
      scene_id: "not-a-canonical-scene",
    });
  });
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  rewriteCandidate(fixture, 1, solidImage(3, 4, [20, 40, 60, 255]));

  const receipt = fixture.receipt();
  assert.equal(receipt.status, "failed");
  assert.ok(
    receipt.violations.some(
      (violation) => violation.code === "scene_file_set_mismatch",
    ),
  );
  assert.ok(
    receipt.violations.some(
      (violation) => violation.code === "unexpected_binding",
    ),
  );
  assert.ok(
    receipt.violations.some(
      (violation) => violation.code === "binding_count_mismatch",
    ),
  );
  assert.ok(
    receipt.scenes[0]!.violations.some(
      (violation) => violation.code === "missing_scene_png",
    ),
  );
  assert.ok(
    receipt.scenes[1]!.violations.some(
      (violation) => violation.code === "dimension_mismatch",
    ),
  );
  assert.ok(
    receipt.scenes[2]!.violations.some(
      (violation) => violation.code === "masked_area_ratio_exceeded",
    ),
  );
  assert.equal(
    fs.readdirSync(path.join(fixture.root, "diff")).length,
    16,
  );
});
