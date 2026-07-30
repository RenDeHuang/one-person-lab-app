import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { captureGuiVisualCohort } from "../../../scripts/capture-gui-visual-cohort.ts";
import { encodeRgbaPng, type RgbaImage } from "../../../scripts/compare-gui-visual-cohort.ts";

const appRoot = path.resolve(import.meta.dirname, "../../..");

function digest(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function solidPng(width: number, height: number): Buffer {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data.set([20, 40, 60, 255], index);
  }
  const image: RgbaImage = { width, height, data };
  return encodeRgbaPng(image);
}

function fixture(
  t: Parameters<typeof test>[1] extends (context: infer Context) => unknown ? Context : never,
  mutatePreflight?: (receipt: Record<string, unknown>) => void,
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opl-gui-capture-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outputDirectory = path.join(root, "output");
  const referenceDirectory = path.join(root, "reference");
  const diffDirectory = path.join(root, "diff");
  fs.mkdirSync(referenceDirectory);
  fs.mkdirSync(diffDirectory);
  const preflight = {
    schema: "opl_app_installed_gui_cohort_preflight_receipt.v1",
    status: "passed",
    cohort: {
      app_sha: "a".repeat(40),
      shell_sha: "b".repeat(40),
      framework_sha: "c".repeat(40),
    },
    runtime: {
      cdp_endpoint: "http://127.0.0.1:9230",
      target_url_includes: "app.asar",
    },
    profile: {
      kind: "isolated",
      user_profile_protected: true,
      root: path.join(root, "profile"),
    },
    identity: {
      package_or_build_identity: "fixture:immutable",
    },
    claims: {
      same_cohort_installed: true,
      pid_executable_bound: true,
      cdp_pid_bound: true,
    },
  };
  mutatePreflight?.(preflight);
  const preflightBytes = Buffer.from(`${JSON.stringify(preflight, null, 2)}\n`);
  const preflightPath = path.join(root, "preflight.json");
  fs.writeFileSync(preflightPath, preflightBytes);
  return {
    root,
    input: {
      schema: "opl_app_gui_visual_capture_input.v1",
      classification: "installed_acceptance_candidate",
      contract_root: appRoot,
      output_directory: outputDirectory,
      preflight_receipt: preflightPath,
      preflight_receipt_sha256: digest(preflightBytes),
      conversation_id: "conversation-fixture",
      reference_directory: referenceDirectory,
      diff_directory: diffDirectory,
      display: {
        os_version: "macOS fixture",
        architecture: "arm64",
        scale: "2",
      },
    },
  };
}

function fakeDriver(options: { unnamedRoleScene?: string } = {}) {
  let currentScene: Record<string, string> | null = null;
  let route = "";
  return {
    beginScene: async (scene: Record<string, string>) => {
      currentScene = scene;
    },
    applyAppearance: async () => {},
    navigate: async (nextRoute: string) => {
      route = nextRoute;
    },
    execute: async (scene: Record<string, string>) => ({
      interaction: scene.state,
      result: { ok: true, active: "fixture-control" },
    }),
    observe: async () => {
      assert.ok(currentScene);
      const desktop = currentScene.viewport === "desktop";
      return {
        route,
        ready_state: "complete",
        text_length: 100,
        overlay_count: 0,
        theme: currentScene.theme,
        locale: currentScene.locale,
        viewport: {
          width: desktop ? 1440 : 400,
          height: desktop ? 900 : 800,
        },
        visible_test_ids: ["fixture-control"],
        focus: { before: "", after: "fixture-control" },
        live_regions: ["fixture announcement"],
        unnamed_interactive_roles: currentScene.id === options.unnamedRoleScene ? ["button"] : [],
        contrast: [{ selector: "[data-testid=fixture]", ratio: 7, visible: true }],
      };
    },
    screenshot: async () => {
      assert.ok(currentScene);
      return currentScene.viewport === "desktop" ? solidPng(1440, 900) : solidPng(400, 800);
    },
    drainErrors: async () => ({ console: [], page: [] }),
    restore: async () => ({
      route: "/guid",
      locale: "zh-CN",
      theme: "system",
    }),
    close: async () => {},
  };
}

test("capture harness executes the canonical 16 scenes and emits comparator input without claiming Pixel", async (t) => {
  const value = fixture(t);
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () => fakeDriver(),
    now: () => new Date("2026-07-30T00:00:00.000Z"),
  });

  assert.equal(receipt.status, "passed");
  assert.deepEqual(receipt.summary, {
    expected_scene_count: 16,
    captured_scene_count: 16,
    passed_scene_count: 16,
    failed_scene_count: 0,
  });
  assert.equal((receipt.claims as Record<string, unknown>).candidate_assets_complete, true);
  assert.equal((receipt.claims as Record<string, unknown>).reference_assets_complete, false);
  assert.equal((receipt.claims as Record<string, unknown>).visual_parity_complete, false);
  assert.equal((receipt.claims as Record<string, unknown>).installed_pixel_acceptance, false);
  assert.equal(
    (receipt.first_failed as Record<string, unknown>).reason,
    "reference_assets_incomplete",
  );
  const comparatorInput = receipt.comparator_input as {
    bindings: Array<Record<string, unknown>>;
  };
  assert.equal(comparatorInput.bindings.length, 16);
  assert.equal(new Set(comparatorInput.bindings.map((binding) => binding.scene_id)).size, 16);
  assert.equal(fs.readdirSync(path.join(value.root, "output", "candidates")).length, 16);
  assert.ok(fs.existsSync(path.join(value.root, "output", "capture-receipt.json")));
  assert.ok(fs.existsSync(path.join(value.root, "output", "comparator-input.json")));
});

test("capture harness rejects a non-isolated profile before opening CDP", async (t) => {
  const value = fixture(t, (preflight) => {
    preflight.profile = {
      kind: "user",
      user_profile_protected: false,
    };
  });
  let driverCreated = false;
  await assert.rejects(
    captureGuiVisualCohort(value.input, value.root, {
      createDriver: async () => {
        driverCreated = true;
        return fakeDriver();
      },
    }),
    /requires an isolated profile/,
  );
  assert.equal(driverCreated, false);
});

test("capture harness fails closed on unnamed interactive accessibility nodes", async (t) => {
  const value = fixture(t);
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () => fakeDriver({ unnamedRoleScene: "settings-general-desktop-light-zh" }),
  });

  assert.equal(receipt.status, "failed");
  assert.deepEqual(receipt.first_failed, {
    scene_id: "settings-general-desktop-light-zh",
    reason: "unnamed_interactive_control",
  });
  assert.equal((receipt.claims as Record<string, unknown>).candidate_assets_complete, false);
  assert.equal((receipt.claims as Record<string, unknown>).visual_parity_complete, false);
  assert.equal((receipt.claims as Record<string, unknown>).release_ready, false);
});
