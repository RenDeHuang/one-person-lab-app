import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { captureGuiVisualCohort } from "../../../scripts/capture-gui-visual-cohort.ts";
import { encodeRgbaPng, type RgbaImage } from "../../../scripts/compare-gui-visual-cohort.ts";

const appRoot = path.resolve(import.meta.dirname, "../../..");
const fixtureNow = () => new Date("2026-07-30T00:00:00.000Z");

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
  const frameworkReceipt = {
    schema: "opl_component_compatibility_receipt.v1",
    owner: "one-person-lab",
    producer_role: "opl_framework",
    producer_identity: {
      command_surface: "opl app compatibility receipt",
      executable_path: "/Applications/One Person Lab.app/Contents/Resources/opl",
      executable_sha256: `sha256:${"d".repeat(64)}`,
      framework_version: "0.3.5",
      package_ref: "one-person-lab@0.3.5",
    },
    status: "compatible",
    issued_at: "2026-07-30T00:00:00.000Z",
    expires_at: "2026-07-30T00:05:00.000Z",
    observations: [
      {
        component_id: "opl_framework",
        owner_authority: "one-person-lab",
        version: "0.3.5",
        capabilities: [
          {
            capability_id: "opl_component_compatibility_receipt",
            schema_version: "1.0.0",
          },
        ],
      },
    ],
    coverage: [
      {
        requirement_id: "framework_compatibility_receipt_schema",
        component_id: "opl_framework",
        status: "satisfied",
        observation_component_id: "opl_framework",
      },
    ],
    failures: [],
  };
  const frameworkReceiptBytes = Buffer.from(`${JSON.stringify(frameworkReceipt, null, 2)}\n`);
  const frameworkReceiptPath = path.join(root, "framework-compatibility-receipt.json");
  fs.writeFileSync(frameworkReceiptPath, frameworkReceiptBytes);
  const preflight = {
    schema: "opl_app_installed_gui_artifact_preflight_receipt.v2",
    status: "passed",
    inspected_at: "2026-07-30T00:00:00.000Z",
    compatibility: {
      profile_id: "gui_installed_acceptance",
      framework_receipt: frameworkReceipt,
      framework_receipt_path: frameworkReceiptPath,
      framework_receipt_output_sha256: digest(frameworkReceiptBytes),
      framework_receipt_sources: {
        requirements: {
          path: path.join(root, "compatibility-requirements.json"),
          sha256: "e".repeat(64),
        },
        subject: {
          path: path.join(root, "compatibility-subject.json"),
          sha256: "f".repeat(64),
        },
      },
      authority: "framework_owner_receipt_only",
      app_generated_compatible_claim: false,
    },
    component_provenance: {
      role: "observational_build_provenance_only",
      may_gate_install_or_runtime: false,
      app: { commit: "a".repeat(40) },
      shell: { commit: "b".repeat(40), observational: true },
      framework: { commit: "c".repeat(40), observational: true },
    },
    runtime: {
      cdp_endpoint: "http://127.0.0.1:9230",
      target_url_includes: "app.asar",
      pid: 1201,
      executable_path: "/Applications/One Person Lab.app/Contents/MacOS/One Person Lab",
      app_process_started_at: "Thu Jul 30 08:00:00 2026",
      cdp_target_id: "fixture-page",
      cdp_target_url:
        "file:///Applications/One%20Person%20Lab.app/Contents/Resources/app.asar/index.html",
    },
    profile: {
      kind: "isolated",
      user_profile_protected: true,
      root: path.join(root, "profile"),
      realpath: path.join(root, "profile"),
    },
    identity: {
      package_or_build_identity: "fixture:immutable",
    },
    claims: {
      artifact_identity_verified: true,
      component_compatibility_verified: true,
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

function fakeDriver(
  options: {
    unnamedRoleScene?: string;
    interactionFailureScene?: string;
    contrastFailureScene?: string;
    announcementFailureScene?: string;
    announcementUnchangedScene?: string;
    secondaryContrastFailureScene?: string;
    unsupportedContrastScene?: string;
  } = {},
) {
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
      result: {
        ok: scene.id !== options.interactionFailureScene,
        active: "fixture-control",
        announcement_probe:
          scene.surface_family === "settings"
            ? {
                triggered: true,
                cleared: true,
                before:
                  scene.id === options.announcementUnchangedScene ? ["No matching settings"] : [],
                changed:
                  scene.id !== options.announcementFailureScene &&
                  scene.id !== options.announcementUnchangedScene,
                messages:
                  scene.id === options.announcementFailureScene ? [] : ["No matching settings"],
              }
            : null,
      },
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
        contrast: [
          {
            selector: "[data-testid=fixture]",
            element_index: 0,
            ratio: currentScene.id === options.contrastFailureScene ? 2 : 7,
            visible: true,
            required: true,
            minimum: 4.5,
            failure:
              currentScene.id === options.unsupportedContrastScene
                ? "foreground_color_not_supported"
                : null,
          },
          ...(currentScene.id === options.secondaryContrastFailureScene
            ? [
                {
                  selector: "[data-testid=fixture-secondary]",
                  element_index: 1,
                  ratio: 2,
                  visible: true,
                  required: true,
                  minimum: 4.5,
                  failure: null,
                },
              ]
            : []),
        ],
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
    now: fixtureNow,
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
    "reference_baseline_not_approved",
  );
  const comparatorInput = receipt.comparator_input as {
    bindings: Array<Record<string, unknown>>;
  };
  assert.equal(comparatorInput.bindings.length, 16);
  assert.equal(new Set(comparatorInput.bindings.map((binding) => binding.scene_id)).size, 16);
  assert.equal(comparatorInput.bindings[0].shell_commit, "b".repeat(40));
  assert.equal(fs.readdirSync(path.join(value.root, "output", "candidates")).length, 16);
  assert.ok(fs.existsSync(path.join(value.root, "output", "capture-receipt.json")));
  assert.ok(fs.existsSync(path.join(value.root, "output", "comparator-input.json")));
});

test("capture harness accepts independently versioned provenance with only Shell commit required", async (t) => {
  const value = fixture(t, (preflight) => {
    const provenance = preflight.component_provenance as Record<string, unknown>;
    delete provenance.app;
    delete provenance.framework;
  });
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () => fakeDriver(),
    now: fixtureNow,
  });

  assert.equal(receipt.status, "passed");
  assert.equal((receipt.claims as Record<string, unknown>).installed_identity_bound, true);
});

test("capture harness rejects an unbound Framework compatibility receipt before opening CDP", async (t) => {
  const value = fixture(t, (preflight) => {
    const compatibility = preflight.compatibility as Record<string, unknown>;
    compatibility.framework_receipt_output_sha256 = "0".repeat(64);
  });
  let driverCreated = false;

  await assert.rejects(
    captureGuiVisualCohort(value.input, value.root, {
      createDriver: async () => {
        driverCreated = true;
        return fakeDriver();
      },
      now: fixtureNow,
    }),
    /Framework receipt SHA-256 does not match its bytes/,
  );
  assert.equal(driverCreated, false);
});

test("capture harness rejects a non-Framework compatibility authority before opening CDP", async (t) => {
  const value = fixture(t, (preflight) => {
    const compatibility = preflight.compatibility as Record<string, any>;
    compatibility.framework_receipt.owner = "one-person-lab-app";
    const bytes = Buffer.from(
      `${JSON.stringify(compatibility.framework_receipt, null, 2)}\n`,
    );
    fs.writeFileSync(compatibility.framework_receipt_path, bytes);
    compatibility.framework_receipt_output_sha256 = digest(bytes);
  });
  let driverCreated = false;

  await assert.rejects(
    captureGuiVisualCohort(value.input, value.root, {
      createDriver: async () => {
        driverCreated = true;
        return fakeDriver();
      },
      now: fixtureNow,
    }),
    /owner-authoritative compatibility receipt/,
  );
  assert.equal(driverCreated, false);
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
      now: fixtureNow,
    }),
    /requires an isolated profile/,
  );
  assert.equal(driverCreated, false);
});

test("capture harness fails closed on unnamed interactive accessibility nodes", async (t) => {
  const value = fixture(t);
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () => fakeDriver({ unnamedRoleScene: "settings-general-desktop-light-zh" }),
    now: fixtureNow,
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

test("capture harness rejects a stale preflight before opening CDP", async (t) => {
  const value = fixture(t, (preflight) => {
    preflight.inspected_at = "2026-07-29T23:54:59.000Z";
  });
  let driverCreated = false;

  await assert.rejects(
    captureGuiVisualCohort(value.input, value.root, {
      createDriver: async () => {
        driverCreated = true;
        return fakeDriver();
      },
      now: fixtureNow,
    }),
    /no older than 300 seconds/,
  );
  assert.equal(driverCreated, false);
});

test("capture harness fails closed when an interaction state is not reached", async (t) => {
  const value = fixture(t);
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () =>
      fakeDriver({ interactionFailureScene: "home-model-menu-desktop-light-en" }),
    now: fixtureNow,
  });

  assert.equal(receipt.status, "failed");
  assert.deepEqual(receipt.first_failed, {
    scene_id: "home-model-menu-desktop-light-en",
    reason: "interaction_failed",
  });
});

test("capture harness fails closed when required text contrast is below 4.5", async (t) => {
  const value = fixture(t);
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () =>
      fakeDriver({ contrastFailureScene: "settings-appearance-desktop-dark-en" }),
    now: fixtureNow,
  });

  assert.equal(receipt.status, "failed");
  assert.deepEqual(receipt.first_failed, {
    scene_id: "settings-appearance-desktop-dark-en",
    reason: "contrast_requirement_failed",
  });
});

test("capture harness fails closed when the settings live-region does not announce", async (t) => {
  const value = fixture(t);
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () =>
      fakeDriver({ announcementFailureScene: "settings-general-desktop-light-zh" }),
    now: fixtureNow,
  });

  assert.equal(receipt.status, "failed");
  assert.deepEqual(receipt.first_failed, {
    scene_id: "settings-general-desktop-light-zh",
    reason: "live_region_announcement_failed",
  });
});

test("capture harness rejects a pre-existing live-region message without an announcement delta", async (t) => {
  const value = fixture(t);
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () =>
      fakeDriver({ announcementUnchangedScene: "settings-general-desktop-light-zh" }),
    now: fixtureNow,
  });

  assert.equal(receipt.status, "failed");
  assert.deepEqual(receipt.first_failed, {
    scene_id: "settings-general-desktop-light-zh",
    reason: "live_region_announcement_failed",
  });
});

test("capture harness rejects a noncanonical rail row interaction", async (t) => {
  const value = fixture(t);
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () =>
      fakeDriver({ interactionFailureScene: "rail-selected-desktop-light-en" }),
    now: fixtureNow,
  });

  assert.equal(receipt.status, "failed");
  assert.deepEqual(receipt.first_failed, {
    scene_id: "rail-selected-desktop-light-en",
    reason: "interaction_failed",
  });
});

test("capture harness checks every visible contrast target rather than only the first", async (t) => {
  const value = fixture(t);
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () =>
      fakeDriver({ secondaryContrastFailureScene: "settings-appearance-desktop-dark-en" }),
    now: fixtureNow,
  });

  assert.equal(receipt.status, "failed");
  assert.deepEqual(receipt.first_failed, {
    scene_id: "settings-appearance-desktop-dark-en",
    reason: "contrast_requirement_failed",
  });
});

test("capture harness fails closed when a visible color cannot be measured", async (t) => {
  const value = fixture(t);
  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () =>
      fakeDriver({ unsupportedContrastScene: "settings-appearance-desktop-dark-en" }),
    now: fixtureNow,
  });

  assert.equal(receipt.status, "failed");
  assert.deepEqual(receipt.first_failed, {
    scene_id: "settings-appearance-desktop-dark-en",
    reason: "contrast_requirement_failed",
  });
});

test("capture harness reports an approved contract with missing reference files as incomplete", async (t) => {
  const value = fixture(t);
  const contractDirectory = path.join(value.root, "contracts");
  fs.mkdirSync(contractDirectory);
  fs.copyFileSync(
    path.join(appRoot, "contracts/app-gui-product-contract.json"),
    path.join(contractDirectory, "app-gui-product-contract.json"),
  );
  const cohort = JSON.parse(
    fs.readFileSync(path.join(appRoot, "contracts/app-gui-visual-reference-cohort.json"), "utf8"),
  ) as Record<string, unknown>;
  cohort.reference = {
    ...(cohort.reference as Record<string, unknown>),
    state: "approved",
    approval_receipt_file: "baseline-approval-receipt.json",
    approval_receipt_sha256: "d".repeat(64),
  };
  fs.writeFileSync(
    path.join(contractDirectory, "app-gui-visual-reference-cohort.json"),
    `${JSON.stringify(cohort, null, 2)}\n`,
  );
  value.input.contract_root = value.root;

  const receipt = await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () => fakeDriver(),
    now: fixtureNow,
  });

  assert.equal((receipt.claims as Record<string, unknown>).reference_assets_complete, false);
  assert.deepEqual(receipt.reference_validation, {
    complete: false,
    first_failed: "reference_approval_receipt_missing",
    checked_scene_count: 0,
  });
});

test("capture harness never overwrites an existing evidence set", async (t) => {
  const value = fixture(t);
  await captureGuiVisualCohort(value.input, value.root, {
    createDriver: async () => fakeDriver(),
    now: fixtureNow,
  });

  await assert.rejects(
    captureGuiVisualCohort(value.input, value.root, {
      createDriver: async () => fakeDriver(),
      now: fixtureNow,
    }),
    /capture evidence output already exists/,
  );
});
