import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { preflightInstalledGuiCohort } from "../../../scripts/preflight-installed-gui-cohort.ts";

function digest(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(
  t: { after(callback: () => void): void },
  mutate?: (input: Record<string, unknown>) => void,
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opl-installed-gui-preflight-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const appPath = path.join(root, "One Person Lab.app");
  const executablePath = path.join(appPath, "Contents/MacOS/One Person Lab");
  const appAsar = path.join(appPath, "Contents/Resources/app.asar");
  const infoPlist = path.join(appPath, "Contents/Info.plist");
  const fullManifest = path.join(
    appPath,
    "Contents/Resources/opl-full-runtime/manifest/full-package-manifest.json",
  );
  const aioncoreBinary = path.join(appPath, "Contents/Resources/opl-full-runtime/aioncore");
  const aioncoreManifest = path.join(
    appPath,
    "Contents/Resources/opl-full-runtime/aioncore-manifest.json",
  );
  const aioncoreResources = path.join(
    appPath,
    "Contents/Resources/opl-full-runtime/managed-resources.json",
  );
  for (const [filePath, content] of [
    [executablePath, "app executable"],
    [appAsar, "app asar bytes"],
    [infoPlist, "plist fixture"],
    [aioncoreBinary, "aioncore binary"],
  ]) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  writeJson(aioncoreManifest, { version: "v0.1.54" });
  writeJson(aioncoreResources, { schemaVersion: 2, codex: "0.145.0" });

  const artifactPath = path.join(root, "One-Person-Lab.dmg");
  fs.writeFileSync(artifactPath, "immutable public artifact");
  const artifactSha256 = digest(artifactPath);
  const cohort = {
    app_sha: "a".repeat(40),
    app_tree: "1".repeat(40),
    shell_sha: "b".repeat(40),
    shell_tree: "2".repeat(40),
    framework_sha: "c".repeat(40),
    framework_tree: "3".repeat(40),
  };
  const sourceLockPath = path.join(root, "source-lock.json");
  writeJson(sourceLockPath, { cohort, artifact_sha256: artifactSha256 });
  const sourceLockSha256 = digest(sourceLockPath);
  const publicReleaseReceiptPath = path.join(root, "public-release-receipt.json");
  writeJson(publicReleaseReceiptPath, {
    release_id: "v26.7.30",
    asset_name: "One-Person-Lab.dmg",
    artifact_sha256: artifactSha256,
    artifact_size_bytes: fs.statSync(artifactPath).size,
    source_lock_sha256: sourceLockSha256,
  });
  writeJson(fullManifest, {
    version: "26.7.30",
    source_lock_sha256: sourceLockSha256,
  });
  const buildReceiptPath = path.join(root, "build-receipt.json");
  writeJson(buildReceiptPath, {
    source_lock_sha256: sourceLockSha256,
    artifact_sha256: artifactSha256,
    app_asar_sha256: digest(appAsar),
  });
  const buildReceiptSha256 = digest(buildReceiptPath);
  const installReceiptPath = path.join(root, "install-receipt.json");
  writeJson(installReceiptPath, {
    source_lock_sha256: sourceLockSha256,
    build_receipt_sha256: buildReceiptSha256,
    artifact_sha256: artifactSha256,
    installed_app: appPath,
    app_asar_sha256: digest(appAsar),
    pid: "1201",
  });
  const profileRoot = path.join(root, "isolated-profile");
  fs.mkdirSync(profileRoot);
  const profileReceiptPath = path.join(root, "isolated-profile-receipt.json");
  writeJson(profileReceiptPath, {
    kind: "isolated",
    root: profileRoot,
    user_profile_protected: true,
  });
  const input: Record<string, unknown> = {
    schema: "opl_app_installed_gui_cohort_authority.v1",
    classification: "immutable_stable",
    cohort,
    artifact: {
      path: artifactPath,
      sha256: artifactSha256,
      immutable: true,
      public: true,
      release_id: "v26.7.30",
      asset_name: "One-Person-Lab.dmg",
      size_bytes: fs.statSync(artifactPath).size,
      public_release_receipt: publicReleaseReceiptPath,
      public_release_receipt_sha256: digest(publicReleaseReceiptPath),
      source_lock: sourceLockPath,
      source_lock_sha256: sourceLockSha256,
      build_receipt: buildReceiptPath,
      build_receipt_sha256: buildReceiptSha256,
      install_receipt: installReceiptPath,
      install_receipt_sha256: digest(installReceiptPath),
    },
    installed: {
      app_path: appPath,
      pid: 1201,
      executable_path: executablePath,
      app_asar: appAsar,
      app_asar_sha256: digest(appAsar),
      full_manifest: fullManifest,
      full_manifest_sha256: digest(fullManifest),
    },
    runtime: {
      cdp_endpoint: "http://127.0.0.1:9230",
      target_url_includes: "app.asar",
      aioncore_pid: 1202,
      aioncore_parent_pid: 1201,
      aioncore_binary: aioncoreBinary,
      aioncore_binary_sha256: digest(aioncoreBinary),
      aioncore_manifest: aioncoreManifest,
      aioncore_manifest_sha256: digest(aioncoreManifest),
      aioncore_resources_manifest: aioncoreResources,
      aioncore_resources_sha256: digest(aioncoreResources),
      aioncore_version: "v0.1.54",
      aioncore_health_url: "http://127.0.0.1:62466/health",
      aioncore_runtime_url: "http://127.0.0.1:62466/runtime",
    },
    profile: {
      kind: "isolated",
      root: profileRoot,
      receipt: profileReceiptPath,
      receipt_sha256: digest(profileReceiptPath),
      user_profile_protected: true,
    },
    identity: {
      package_or_build_identity: "stable:v26.7.30:sha256",
      bundle_id: "cn.onepersonlab.opl",
      display_version: "26.7.30",
      public_updater_version: "26.7.3000",
      machine_version: "26.7.3000",
      source_lock_plist_key: "OPLSourceLockSHA256",
      team_id: "ABCDE12345",
    },
  };
  mutate?.(input);
  return {
    root,
    input,
    values: {
      appPath,
      executablePath,
      sourceLockSha256,
      aioncoreBinary,
    },
  };
}

function successfulDependencies(value: ReturnType<typeof fixture>["values"]) {
  return {
    run: (command: string, args: string[]) => {
      if (command === "/usr/bin/plutil") {
        const key = args[1];
        const values: Record<string, string> = {
          CFBundleIdentifier: "cn.onepersonlab.opl",
          CFBundleShortVersionString: "26.7.3000",
          CFBundleVersion: "26.7.3000",
          OPLPublicUpdaterVersion: "26.7.3000",
          OPLSourceLockSHA256: value.sourceLockSha256,
        };
        return {
          status: values[key] ? 0 : 1,
          stdout: values[key] ?? "",
          stderr: "",
          error: null,
        };
      }
      if (command === "/bin/ps" && args.includes("1201") && args.includes("comm=")) {
        return { status: 0, stdout: `${value.executablePath}\n`, stderr: "", error: null };
      }
      if (command === "/bin/ps" && args.includes("1202") && args.includes("comm=")) {
        return { status: 0, stdout: `${value.aioncoreBinary}\n`, stderr: "", error: null };
      }
      if (command === "/bin/ps" && args.includes("1202") && args.includes("ppid=")) {
        return { status: 0, stdout: "1201\n", stderr: "", error: null };
      }
      if (command === "/usr/bin/codesign" && args[0] === "-dv") {
        return {
          status: 0,
          stdout: "",
          stderr: "TeamIdentifier=ABCDE12345\nAuthority=Developer ID Application: Fixture",
          error: null,
        };
      }
      if (command === value.aioncoreBinary) {
        return { status: 0, stdout: "aioncore 0.1.54\n", stderr: "", error: null };
      }
      return { status: 0, stdout: "fixture passed\n", stderr: "", error: null };
    },
    fetchJson: async (url: string) => {
      if (url.endsWith("/json/version")) {
        return { status: 200, value: { Browser: "Chrome/fixture" } };
      }
      if (url.endsWith("/json/list")) {
        return {
          status: 200,
          value: [
            {
              type: "page",
              url: "file:///Applications/One%20Person%20Lab.app/Contents/Resources/app.asar/index.html",
            },
          ],
        };
      }
      if (url.endsWith("/health")) {
        return { status: 200, value: { status: "ok" } };
      }
      return { status: 200, value: { runtime_version: "v0.1.54" } };
    },
    now: () => new Date("2026-07-30T00:00:00.000Z"),
  };
}

test("installed preflight binds immutable artifact, installed bytes, PID/CDP, isolated profile, and AionCore", async (t) => {
  const value = fixture(t);
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values),
  );

  assert.equal(receipt.status, "passed", JSON.stringify(receipt.violations));
  assert.deepEqual(receipt.violations, []);
  const claims = receipt.claims as Record<string, unknown>;
  assert.equal(claims.artifact_digest_bound, true);
  assert.equal(claims.public_release_bound, true);
  assert.equal(claims.same_cohort_installed, true);
  assert.equal(claims.pid_executable_bound, true);
  assert.equal(claims.cdp_pid_bound, true);
  assert.equal(claims.aioncore_runtime_bound, true);
  assert.equal(claims.isolated_profile_bound, true);
  assert.equal(claims.installed_pixel_acceptance, false);
  assert.equal(claims.release_ready, false);
});

test("installed preflight fails closed when artifact bytes drift", async (t) => {
  const value = fixture(t);
  const artifact = value.input.artifact as Record<string, unknown>;
  fs.appendFileSync(String(artifact.path), "drift");
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values),
  );

  assert.equal(receipt.status, "failed");
  assert.equal((receipt.first_failed as Record<string, unknown>).code, "file_sha256_mismatch");
  assert.equal((receipt.claims as Record<string, unknown>).same_cohort_installed, false);
});

test("installed preflight rejects real user profiles before live inspection", async (t) => {
  const value = fixture(t, (input) => {
    input.profile = {
      kind: "user",
      root: "/Users/example/Library/Application Support",
      receipt: "/tmp/missing.json",
      receipt_sha256: "0".repeat(64),
      user_profile_protected: false,
    };
  });

  await assert.rejects(
    preflightInstalledGuiCohort(value.input, value.root, successfulDependencies(value.values)),
    /profile.kind must be isolated/,
  );
});
