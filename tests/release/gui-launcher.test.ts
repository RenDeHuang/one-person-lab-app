import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildNativeCandidateOpenArgs,
  createGuiLaunchPlan,
  installAppBundleAtomically,
  parseGuiLauncherArgs,
  readAppBundleIdentifier,
  resolveGuiRuntimeIdentity,
} from "../../scripts/gui-launcher.ts";

function fakeRuntimePath(): { binDir: string; env: NodeJS.ProcessEnv; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opl-gui-launcher-"));
  const binDir = path.join(root, "bin");
  fs.mkdirSync(binDir);
  for (const [name, version] of [
    ["opl", "opl-framework 9.8.7"],
    ["codex", "codex-cli 6.5.4"],
  ] as const) {
    const executable = path.join(binDir, name);
    fs.writeFileSync(executable, `#!/bin/sh\nprintf '%s\\n' '${version}'\n`, { mode: 0o755 });
  }
  return {
    binDir,
    env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function fakeAppRoot(): { appRoot: string; cleanup: () => void } {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-gui-launcher-app-"));
  const contractsDir = path.join(appRoot, "contracts");
  fs.mkdirSync(contractsDir);
  for (const name of ["app-shell-candidates.json", "app-shell-adapter.json"]) {
    fs.copyFileSync(path.join(process.cwd(), "contracts", name), path.join(contractsDir, name));
  }
  const nativeRoot = path.join(appRoot, "shells", "opl-native-workbench");
  fs.mkdirSync(nativeRoot, { recursive: true });
  fs.writeFileSync(path.join(nativeRoot, "package.json"), '{"private":true}\n');
  return {
    appRoot,
    cleanup: () => fs.rmSync(appRoot, { recursive: true, force: true }),
  };
}

function fakeAppBundle(parent: string, name: string, bundleId: string, marker: string): string {
  const appPath = path.join(parent, `${name}.app`);
  const contents = path.join(appPath, "Contents");
  fs.mkdirSync(contents, { recursive: true });
  fs.writeFileSync(
    path.join(contents, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${bundleId}</string>
</dict></plist>\n`,
  );
  fs.writeFileSync(path.join(contents, "cohort.txt"), `${marker}\n`);
  return appPath;
}

test("GUI launcher parses the explicit candidate safety controls", () => {
  assert.deepEqual(
    parseGuiLauncherArgs([
      "--shell",
      "opl-native-workbench",
      "--mode",
      "packaged",
      "--rebuild",
      "--plan",
      "--workspace",
      "/tmp",
      "--allow-actions",
    ]),
    {
      shell: "opl-native-workbench",
      mode: "packaged",
      rebuild: true,
      plan: true,
      workspace: "/tmp",
      allowActions: true,
    },
  );
  assert.throws(() => parseGuiLauncherArgs(["--shell", "agui-codex"]), /Unsupported GUI shell/);
});

test("GUI Runtime resolver returns absolute executable identity and a stable cohort ref", () => {
  const fixture = fakeRuntimePath();
  try {
    const first = resolveGuiRuntimeIdentity({ env: fixture.env });
    const second = resolveGuiRuntimeIdentity({ env: fixture.env });
    assert.equal(first.opl_path, path.join(fixture.binDir, "opl"));
    assert.equal(first.opl_version, "opl-framework 9.8.7");
    assert.equal(first.codex_path, path.join(fixture.binDir, "codex"));
    assert.equal(first.codex_version, "codex-cli 6.5.4");
    assert.match(first.runtime_cohort_ref, /^sha256:[a-f0-9]{64}$/);
    assert.equal(first.runtime_cohort_ref, second.runtime_cohort_ref);
  } finally {
    fixture.cleanup();
  }
});

test("Native candidate open args preserve one instance and default to read-only actions", () => {
  const fixture = fakeRuntimePath();
  try {
    const identity = resolveGuiRuntimeIdentity({ env: fixture.env });
    const args = buildNativeCandidateOpenArgs({
      appPath: "/tmp/Native Candidate.app",
      runtimeIdentity: identity,
      workspace: "/tmp/workspace",
      allowActions: false,
      env: fixture.env,
    });
    assert.equal(args.includes("-n"), false);
    assert.equal(args.includes("--new"), false);
    assert(args.includes("OPL_NATIVE_WORKBENCH_READ_ONLY=1"));
    assert(args.includes(`OPL_APP_OPL_BIN=${identity.opl_path}`));
    assert(args.includes(`OPL_CODEX_BIN=${identity.codex_path}`));
    assert(args.some((entry) => entry.startsWith("OPL_APP_RUNTIME_IDENTITY_JSON=")));
  } finally {
    fixture.cleanup();
  }
});

test("Candidate plan remains launch-scoped and cannot mutate release adoption", () => {
  const fixture = fakeRuntimePath();
  const appFixture = fakeAppRoot();
  try {
    const plan = createGuiLaunchPlan({
      args: parseGuiLauncherArgs(["--shell", "opl-native-workbench", "--rebuild", "--plan"]),
      appRoot: appFixture.appRoot,
      env: fixture.env,
    });
    assert.equal(plan.shell, "opl-native-workbench");
    assert.equal(plan.bundle_identity_isolated, true);
    assert.equal(plan.candidate_actions, "dry_run_only");
    assert.equal(plan.release_adoption_changed, false);
    assert.equal(plan.updater_channel_changed, false);
    assert.equal(plan.app_path, "/Applications/One Person Lab Native.app");
    assert.equal(
      plan.package_app_path,
      path.join(appFixture.appRoot, "shells", "opl-native-workbench", "out", "One Person Lab Native.app"),
    );
    assert.deepEqual(plan.package_command, {
      executable: "npm",
      args: ["run", "package"],
      cwd: path.join(appFixture.appRoot, "shells", "opl-native-workbench"),
    });
    assert.equal(plan.command.executable, "/usr/bin/open");
    assert.equal(plan.command.args[0], "/Applications/One Person Lab Native.app");
    assert.equal(plan.command.args.includes("-n"), false);
  } finally {
    appFixture.cleanup();
    fixture.cleanup();
  }
});

test("Native install atomically replaces only the isolated bundle identity", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opl-native-install-"));
  const source = fakeAppBundle(root, "source", "cn.gflab.opl.native-workbench.candidate", "new");
  const installed = fakeAppBundle(root, "installed", "cn.gflab.opl.native-workbench.candidate", "old");
  try {
    installAppBundleAtomically({
      sourceAppPath: source,
      installedAppPath: installed,
      expectedBundleId: "cn.gflab.opl.native-workbench.candidate",
    });
    assert.equal(readAppBundleIdentifier(installed), "cn.gflab.opl.native-workbench.candidate");
    assert.equal(fs.readFileSync(path.join(installed, "Contents", "cohort.txt"), "utf8"), "new\n");
    assert.equal(fs.existsSync(source), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Native install refuses to overwrite an unrelated application", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opl-native-install-"));
  const source = fakeAppBundle(root, "source", "cn.gflab.opl.native-workbench.candidate", "new");
  const installed = fakeAppBundle(root, "installed", "example.unrelated.app", "unrelated");
  try {
    assert.throws(
      () => installAppBundleAtomically({
        sourceAppPath: source,
        installedAppPath: installed,
        expectedBundleId: "cn.gflab.opl.native-workbench.candidate",
      }),
      /Refusing app bundle/,
    );
    assert.equal(readAppBundleIdentifier(installed), "example.unrelated.app");
    assert.equal(fs.readFileSync(path.join(installed, "Contents", "cohort.txt"), "utf8"), "unrelated\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
