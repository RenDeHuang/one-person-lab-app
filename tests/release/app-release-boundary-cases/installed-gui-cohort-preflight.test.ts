import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sha256Tree } from "../../../scripts/build-artifact-cohort.ts";
import { preflightInstalledGuiCohort } from "../../../scripts/preflight-installed-gui-cohort.ts";

const appRoot = path.resolve(import.meta.dirname, "../../..");

function digest(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readJsonFile(filePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, any>;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function appContractBytes(filePath: string): string {
  return fs.readFileSync(path.join(appRoot, filePath), "utf8");
}

const installExposurePolicy = JSON.parse(
  appContractBytes("contracts/app-install-exposure-policy.json"),
) as Record<string, any>;
const compatibilityRequirements = installExposurePolicy.component_interoperability
  .compatibility_profiles.gui_installed_acceptance.requirements as Array<Record<string, unknown>>;

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
  const frameworkExecutable = path.join(
    appPath,
    "Contents/Resources/opl-framework/bin/opl",
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
    [frameworkExecutable, "framework executable fixture"],
    [aioncoreBinary, "aioncore binary"],
  ]) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  fs.chmodSync(frameworkExecutable, 0o755);
  const frameworkExecutableRealpath = fs.realpathSync(frameworkExecutable);
  const frameworkBindingReceiptPath = path.join(
    root,
    "app-launcher-framework-runtime-binding.json",
  );
  writeJson(frameworkBindingReceiptPath, {
    schema: "opl_app_launcher_framework_runtime_binding.v1",
    owner: "one-person-lab-app",
    status: "bound",
    installed_app_path: fs.realpathSync(appPath),
    executable_path: frameworkExecutableRealpath,
    executable_sha256: `sha256:${digest(frameworkExecutableRealpath)}`,
    framework_version: "0.3.5",
    package_ref: "one-person-lab@0.3.5",
  });
  writeJson(aioncoreManifest, { version: "v0.1.54" });
  writeJson(aioncoreResources, { schemaVersion: 2, codex: "0.145.0" });

  const artifactPath = path.join(root, "One-Person-Lab.dmg");
  fs.writeFileSync(artifactPath, "immutable public artifact");
  const artifactSha256 = digest(artifactPath);
  const cohort = {
    app_sha: "a".repeat(40),
    shell_sha: "b".repeat(40),
    framework_sha: "c".repeat(40),
  };
  const sourceLockPath = path.join(root, "source-lock.json");
  writeJson(sourceLockPath, {
    schema: "opl_app_release_cohort_lock.v1",
    generated_at: "2026-07-30T00:00:00.000Z",
    app: {
      requested_ref: cohort.app_sha,
      resolved_sha: cohort.app_sha,
      repo_root: appRoot,
    },
    shell: {
      requested_ref: cohort.shell_sha,
      resolved_sha: cohort.shell_sha,
      repo_root: "/fixture/shell",
    },
    framework: {
      requested_ref: cohort.framework_sha,
      resolved_sha: cohort.framework_sha,
      repo_root: "/fixture/framework",
    },
    authority_boundary: {
      cohort_lock_can_dispatch_workflow: false,
      cohort_lock_can_publish_release: false,
      cohort_lock_can_write_runtime_truth: false,
    },
  });
  const sourceLockSha256 = digest(sourceLockPath);
  const publicReleaseReceiptPath = path.join(root, "public-release-receipt.json");
  writeJson(publicReleaseReceiptPath, {
    schema: "opl_app_stable_operation_published_carrier_binding.v1",
    status: "published_immutable",
    publication_record_digest: `sha256:${"4".repeat(64)}`,
    publication_target: {
      repository: "gaofeng21cn/one-person-lab-app",
      tag: "v26.7.30",
    },
    published_carrier: {
      release_id: 730,
      immutable: true,
      draft: false,
      assets: [
        {
          name: "One-Person-Lab.dmg",
          digest: `sha256:${artifactSha256}`,
          size_bytes: fs.statSync(artifactPath).size,
        },
      ],
    },
    published_carrier_binding_digest: `sha256:${"5".repeat(64)}`,
  });
  const buildReceiptPath = path.join(root, "build-receipt.json");
  writeJson(buildReceiptPath, {
    schema: "opl_app_build_artifact_cohort.v2",
    release: {
      stable_session_id: null,
      release_cohort_ref: null,
    },
    cohort,
    build: {
      version: "26.7.30",
      kind: "standard",
    },
    artifact: {
      name: "One-Person-Lab.dmg",
      sha256: artifactSha256,
      size_bytes: fs.statSync(artifactPath).size,
    },
    actions: {
      run_id: "fixture-run",
      run_attempt: "1",
      artifact_name: "fixture-artifact",
    },
    digests: {
      packaged_tree_sha256: sha256Tree(appPath),
      app_product_profile_sha256: digest(path.join(appRoot, "contracts/app-product-profile.json")),
      gui_product_contract_sha256: digest(
        path.join(appRoot, "contracts/app-gui-product-contract.json"),
      ),
    },
    qualification_runtime: {
      codex_cli: {
        package: "@openai/codex",
        version: "fixture",
      },
    },
  });
  const buildReceiptSha256 = digest(buildReceiptPath);
  const profileRoot = path.join(root, "isolated-profile");
  fs.mkdirSync(profileRoot);
  const input: Record<string, unknown> = {
    schema: "opl_app_installed_gui_artifact_authority.v2",
    classification: "immutable_stable",
    compatibility: {
      profile_id: "gui_installed_acceptance",
      receipt_output: path.join(root, "framework-compatibility-receipt.json"),
      framework_runtime: {
        authority_source: "app_launcher_bound_framework_runtime_readback",
        executable_path: frameworkExecutableRealpath,
        executable_sha256: digest(frameworkExecutableRealpath),
        framework_version: "0.3.5",
        package_ref: "one-person-lab@0.3.5",
        binding_receipt: frameworkBindingReceiptPath,
        binding_receipt_sha256: digest(frameworkBindingReceiptPath),
      },
    },
    artifact: {
      path: artifactPath,
      sha256: artifactSha256,
      owner_authority: "gaofeng21cn/one-person-lab-app",
      immutable: true,
      public: true,
      release_id: 730,
      release_tag: "v26.7.30",
      asset_url:
        "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.30/One-Person-Lab.dmg",
      asset_name: "One-Person-Lab.dmg",
      size_bytes: fs.statSync(artifactPath).size,
      public_release_receipt: publicReleaseReceiptPath,
      public_release_receipt_sha256: digest(publicReleaseReceiptPath),
      source_lock: sourceLockPath,
      source_lock_sha256: sourceLockSha256,
      build_receipt: buildReceiptPath,
      build_receipt_sha256: buildReceiptSha256,
    },
    installed: {
      app_path: appPath,
      pid: 1201,
      executable_path: executablePath,
      app_asar: appAsar,
      app_asar_sha256: digest(appAsar),
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
      profileRoot,
      artifactSha256,
      appAsarSha256: digest(appAsar),
      buildReceiptSha256,
      cohort,
      frameworkExecutable: frameworkExecutableRealpath,
      frameworkExecutableSha256: digest(frameworkExecutableRealpath),
      frameworkBindingReceiptPath,
    },
  };
}

function frameworkCompatibilityReceipt(
  value: ReturnType<typeof fixture>["values"],
  args: string[],
  mutate?: (receipt: Record<string, any>) => void,
): { receipt: Record<string, any>; envelope: Record<string, any> } {
  const argument = (name: string) => {
    const index = args.indexOf(name);
    assert.notEqual(index, -1, `missing ${name}`);
    return String(args[index + 1]);
  };
  const requirementsFile = argument("--requirements-file");
  const subjectFile = argument("--subject-file");
  const outputFile = argument("--output");
  const requirementsDocument = readJsonFile(requirementsFile);
  const subjectDocument = readJsonFile(subjectFile);
  const producerIdentity = {
    command_surface: "opl app compatibility receipt",
    executable_path: value.frameworkExecutable,
    executable_sha256: `sha256:${value.frameworkExecutableSha256}`,
    framework_version: "0.3.5",
    package_ref: "one-person-lab@0.3.5",
  };
  const generatedAt = "2026-07-30T00:00:00.000Z";
  const expiresAt = "2026-07-30T00:05:00.000Z";
  const observationRef =
    "contracts/opl-framework/app-component-compatibility-receipt-contract.json#producer_observation@2026-07-30T00:00:00.000Z";
  const receipt: Record<string, any> = {
    schema: "opl_component_compatibility_receipt.v1",
    owner: "one-person-lab",
    producer_role: "opl_framework",
    contract_ref:
      "contracts/app-install-exposure-policy.json#component_interoperability.compatibility_admission",
    producer_contract_ref:
      "contracts/opl-framework/app-component-compatibility-receipt-contract.json",
    producer_identity: producerIdentity,
    receipt_ref: `file://${path.resolve(outputFile)}`,
    generated_at: generatedAt,
    issued_at: generatedAt,
    expires_at: expiresAt,
    freshness: {
      status: "fresh",
      generated_at: generatedAt,
      max_age_seconds: 300,
    },
    status: "compatible",
    sources: {
      requirements: {
        path: fs.realpathSync(requirementsFile),
        sha256: `sha256:${digest(requirementsFile)}`,
        owner: "one-person-lab-app",
        schema: "opl_component_compatibility_requirements.v1",
      },
      subject: {
        path: fs.realpathSync(subjectFile),
        sha256: `sha256:${digest(subjectFile)}`,
        owner: "one-person-lab-app",
        schema: "opl_app_compatibility_subject.v1",
      },
    },
    subject: {
      selected_app_artifact: {
        ...subjectDocument.selected_app_artifact,
        sha256: `sha256:${String(subjectDocument.selected_app_artifact.sha256).replace(
          /^sha256:/,
          "",
        )}`,
      },
      installed_app_asar: {
        path: fs.realpathSync(subjectDocument.installed_app_asar.path),
        sha256: `sha256:${String(subjectDocument.installed_app_asar.sha256).replace(
          /^sha256:/,
          "",
        )}`,
      },
      build_receipt: {
        path: fs.realpathSync(subjectDocument.build_receipt.path),
        sha256: `sha256:${String(subjectDocument.build_receipt.sha256).replace(
          /^sha256:/,
          "",
        )}`,
      },
    },
    requirements: structuredClone(requirementsDocument.requirements),
    observed_components: [
      {
        component_id: "opl_framework",
        owner_authority: "one-person-lab",
        version: "0.3.5",
        observation_ref: observationRef,
        capabilities: [
          {
            capability_id: "opl_component_compatibility_receipt",
            schema_version: "1.0.0",
          },
        ],
      },
    ],
    coverage: requirementsDocument.requirements.map((requirement: Record<string, unknown>) => ({
      requirement_id: requirement.requirement_id,
      component_id: requirement.component_id,
      kind: requirement.kind,
      status: "satisfied",
      observation_ref: observationRef,
      failure_code: null,
    })),
    failures: [],
    authority_boundary: {
      compatibility_only: true,
      selected_artifact_binding_is_subject_evidence_only: true,
      may_require_exact_cross_component_version_or_sha: false,
      may_require_same_cohort: false,
      may_define_package_currentness: false,
      may_claim_release_ready: false,
      may_claim_install_ready: false,
    },
  };
  mutate?.(receipt);
  writeJson(outputFile, receipt);
  const receiptSha256 = digest(outputFile);
  fs.writeFileSync(
    `${outputFile}.sha256`,
    `${receiptSha256}  ${path.basename(outputFile)}\n`,
  );
  return {
    receipt,
    envelope: {
      app_component_compatibility_receipt: {
        receipt_file: path.resolve(outputFile),
        receipt_sha256: `sha256:${receiptSha256}`,
        sha256_file: path.resolve(`${outputFile}.sha256`),
        producer_identity: receipt.producer_identity,
        status: receipt.status,
        issued_at: receipt.issued_at,
        expires_at: receipt.expires_at,
        requirement_count: receipt.requirements.length,
        failure_count: receipt.failures.length,
      },
    },
  };
}

function successfulDependencies(
  value: ReturnType<typeof fixture>["values"],
  mutateCompatibilityReceipt?: (receipt: Record<string, any>) => void,
) {
  return {
    run: (command: string, args: string[]) => {
      if (command === value.frameworkExecutable) {
        const produced = frameworkCompatibilityReceipt(
          value,
          args,
          mutateCompatibilityReceipt,
        );
        return {
          status: 0,
          stdout: `${JSON.stringify(produced.envelope)}\n`,
          stderr: "",
          error: null,
        };
      }
      if (command === "/usr/bin/git" && args[2] === "show") {
        const [, filePath = ""] = args[3].split(":", 2);
        return {
          status: 0,
          stdout: appContractBytes(filePath),
          stderr: "",
          error: null,
        };
      }
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
      if (command === "/bin/ps" && args.includes("1201") && args.includes("lstart=")) {
        return {
          status: 0,
          stdout: "Thu Jul 30 15:00:00 2026\n",
          stderr: "",
          error: null,
        };
      }
      if (command === "/bin/ps" && args.includes("1201") && args.includes("command=")) {
        return {
          status: 0,
          stdout: `${value.executablePath} --user-data-dir=${value.profileRoot} --remote-debugging-port=9230\n`,
          stderr: "",
          error: null,
        };
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
              id: "fixture-page",
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

function convertToDiagnostic(value: ReturnType<typeof fixture>): void {
  const input = value.input;
  input.classification = "diagnostic";
  const artifact = input.artifact as Record<string, unknown>;
  delete artifact.immutable;
  delete artifact.public;
  delete artifact.release_id;
  delete artifact.public_release_receipt;
  delete artifact.public_release_receipt_sha256;

  const sourceLockPath = String(artifact.source_lock);
  writeJson(sourceLockPath, {
    schema: "opl_manual_latest_build_source_lock.v1",
    display_version: "26.7.30",
    updater_version: "26.7.3000",
    repositories: {
      app: { head: "a".repeat(40) },
      shell: { head: "b".repeat(40) },
      framework: { head: "c".repeat(40) },
    },
    runtime_dependencies: {},
    upstreams: {},
    local_app_identity: {
      build_kind: "local-development",
    },
  });
  const sourceLockSha256 = digest(sourceLockPath);
  artifact.source_lock_sha256 = sourceLockSha256;
  value.values.sourceLockSha256 = sourceLockSha256;

  const buildReceiptPath = String(artifact.build_receipt);
  writeJson(buildReceiptPath, {
    schema: "opl_manual_latest_build_receipt.v1",
    status: "completed",
    mode: "local-app",
    display_version: "26.7.30",
    updater_version: "26.7.3000",
    bundle_version: "26.7.3000",
    local_build_id: "local.srcfixture",
    build_identity: {
      source_lock_sha256: sourceLockSha256,
    },
    source_lock: sourceLockPath,
    source_lock_sha256: sourceLockSha256,
    output: {
      installed_app: value.values.appPath,
    },
  });
  artifact.build_receipt_sha256 = digest(buildReceiptPath);
  value.values.buildReceiptSha256 = String(artifact.build_receipt_sha256);

  const installReceiptPath = path.join(value.root, "manual-local-app-installation.json");
  writeJson(installReceiptPath, {
    schema: "opl_manual_local_app_installation.v1",
    status: "completed",
    installed_app: value.values.appPath,
    installed_version: {
      bundle_id: "cn.onepersonlab.opl",
      display_version: "26.7.30",
      public_updater_version: "26.7.3000",
      bundle_version: "26.7.3000",
      source_lock_sha256: sourceLockSha256,
    },
    prior_app_was_running: false,
    launched: true,
    launch_process_ids: [1201],
  });
  artifact.install_receipt = installReceiptPath;
  artifact.install_receipt_sha256 = digest(installReceiptPath);
  delete (input.identity as Record<string, unknown>).team_id;
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
  assert.equal(claims.component_compatibility_verified, true);
  assert.equal(claims.pid_executable_bound, true);
  assert.equal(claims.cdp_pid_bound, true);
  assert.equal(claims.aioncore_runtime_bound, true);
  assert.equal(claims.isolated_profile_bound, true);
  assert.equal(claims.installed_pixel_acceptance, false);
  assert.equal(claims.release_ready, false);
  const provenance = receipt.component_provenance as Record<string, any>;
  assert.notEqual(provenance.app.commit, provenance.shell.commit);
  assert.notEqual(provenance.shell.commit, provenance.framework.commit);
  const compatibility = receipt.compatibility as Record<string, any>;
  assert.equal(
    compatibility.framework_receipt.producer_identity.executable_path,
    value.values.frameworkExecutable,
  );
  assert.equal(
    compatibility.framework_receipt.producer_identity.executable_sha256,
    `sha256:${value.values.frameworkExecutableSha256}`,
  );
  assert.equal(value.values.frameworkExecutable.startsWith("/opt/homebrew"), false);
});

test("installed preflight accepts the real manual build and installation receipt schemas as diagnostic only", async (t) => {
  const value = fixture(t);
  convertToDiagnostic(value);
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values),
  );

  assert.equal(receipt.status, "passed", JSON.stringify(receipt.violations));
  assert.equal((receipt.claims as Record<string, unknown>).component_compatibility_verified, true);
  assert.equal((receipt.claims as Record<string, unknown>).public_release_bound, false);
  assert.equal((receipt.claims as Record<string, unknown>).release_ready, false);
});

test("installed preflight binds Stable contract digests to the declared App cohort", async (t) => {
  const value = fixture(t);
  const dependencies = successfulDependencies(value.values);
  const receipt = await preflightInstalledGuiCohort(value.input, value.root, {
    ...dependencies,
    run: (command, args) => {
      if (command === "/usr/bin/git" && args[2] === "show") {
        return {
          status: 0,
          stdout: `${dependencies.run(command, args).stdout}\ncohort drift`,
          stderr: "",
          error: null,
        };
      }
      return dependencies.run(command, args);
    },
  });

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "build_receipt_contract_digest_mismatch",
    ),
  );
});

test("installed preflight rejects a manual source lock for immutable Stable", async (t) => {
  const value = fixture(t);
  const artifact = value.input.artifact as Record<string, unknown>;
  const cohort = value.values.cohort;
  writeJson(String(artifact.source_lock), {
    schema: "opl_manual_latest_build_source_lock.v1",
    repositories: {
      app: { head: cohort.app_sha },
      shell: { head: cohort.shell_sha },
      framework: { head: cohort.framework_sha },
    },
  });
  artifact.source_lock_sha256 = digest(String(artifact.source_lock));
  value.values.sourceLockSha256 = String(artifact.source_lock_sha256);

  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values),
  );

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "source_lock_schema_mismatch",
    ),
  );
});

test("installed preflight rejects a release source lock for diagnostic acceptance", async (t) => {
  const value = fixture(t);
  value.input.classification = "diagnostic";

  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values),
  );

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "source_lock_schema_mismatch",
    ),
  );
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
  assert.equal((receipt.claims as Record<string, unknown>).component_compatibility_verified, false);
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

test("installed preflight rejects receipt values that appear only in unrelated notes", async (t) => {
  const value = fixture(t);
  const sourceLockPath = String((value.input.artifact as Record<string, unknown>).source_lock);
  const sourceLock = JSON.parse(fs.readFileSync(sourceLockPath, "utf8")) as Record<string, unknown>;
  sourceLock.app = {};
  sourceLock.notes = value.values.cohort;
  writeJson(sourceLockPath, sourceLock);
  (value.input.artifact as Record<string, unknown>).source_lock_sha256 = digest(sourceLockPath);

  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values),
  );

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "source_provenance_invalid",
    ),
  );
});

test("installed preflight binds the isolated profile to the live App command line", async (t) => {
  const value = fixture(t);
  const dependencies = successfulDependencies(value.values);
  const receipt = await preflightInstalledGuiCohort(value.input, value.root, {
    ...dependencies,
    run: (command, args) => {
      if (command === "/bin/ps" && args.includes("1201") && args.includes("command=")) {
        return {
          status: 0,
          stdout: `${value.values.executablePath} --remote-debugging-port=9230\n`,
          stderr: "",
          error: null,
        };
      }
      return dependencies.run(command, args);
    },
  });

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "isolated_profile_process_binding_failed",
    ),
  );
  assert.equal((receipt.claims as Record<string, unknown>).isolated_profile_bound, false);
});

test("installed preflight rejects process arguments that only share the expected prefix", async (t) => {
  const value = fixture(t);
  const dependencies = successfulDependencies(value.values);
  const receipt = await preflightInstalledGuiCohort(value.input, value.root, {
    ...dependencies,
    run: (command, args) => {
      if (command === "/bin/ps" && args.includes("1201") && args.includes("command=")) {
        return {
          status: 0,
          stdout: `${value.values.executablePath} --user-data-dir=${value.values.profileRoot}-other --remote-debugging-port=92300\n`,
          stderr: "",
          error: null,
        };
      }
      return dependencies.run(command, args);
    },
  });

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "isolated_profile_process_binding_failed",
    ),
  );
});

test("installed preflight rejects an isolated profile symlink even when the PID argument matches it", async (t) => {
  const value = fixture(t);
  const symlinkRoot = path.join(value.root, "isolated-profile-link");
  fs.symlinkSync(value.values.profileRoot, symlinkRoot);
  (value.input.profile as Record<string, unknown>).root = symlinkRoot;
  value.values.profileRoot = symlinkRoot;

  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values),
  );

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "isolated_profile_root_unsafe",
    ),
  );
  assert.equal((receipt.claims as Record<string, unknown>).isolated_profile_bound, false);
});

test("installed preflight binds the AionCore listener port to the declared runtime PID", async (t) => {
  const value = fixture(t);
  const dependencies = successfulDependencies(value.values);
  const receipt = await preflightInstalledGuiCohort(value.input, value.root, {
    ...dependencies,
    run: (command, args) => {
      if (command === "/usr/sbin/lsof" && args.includes("1202")) {
        return { status: 1, stdout: "", stderr: "no listener", error: null };
      }
      return dependencies.run(command, args);
    },
  });

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "aioncore_pid_listener_mismatch",
    ),
  );
  assert.equal((receipt.claims as Record<string, unknown>).aioncore_runtime_bound, false);
});

test("installed preflight rejects HTTP 200 AionCore health without semantic status=ok", async (t) => {
  const value = fixture(t);
  const dependencies = successfulDependencies(value.values);
  const receipt = await preflightInstalledGuiCohort(value.input, value.root, {
    ...dependencies,
    fetchJson: async (url) =>
      url.endsWith("/health")
        ? { status: 200, value: { status: "starting" } }
        : dependencies.fetchJson(url),
  });

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "aioncore_health_mismatch",
    ),
  );
});

test("installed preflight rejects conflicting AionCore manifest aliases", async (t) => {
  const value = fixture(t);
  const runtime = value.input.runtime as Record<string, unknown>;
  writeJson(String(runtime.aioncore_manifest), {
    version: "v0.1.54",
    aioncore: { version: "v0.1.53" },
  });
  runtime.aioncore_manifest_sha256 = digest(String(runtime.aioncore_manifest));

  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values),
  );

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "aioncore_manifest_version_mismatch",
    ),
  );
});

test("installed preflight fails closed when the Framework producer command is unavailable", async (t) => {
  const value = fixture(t);
  const dependencies = successfulDependencies(value.values);
  const receipt = await preflightInstalledGuiCohort(value.input, value.root, {
    ...dependencies,
    run: (command, args) =>
      command === value.values.frameworkExecutable
        ? { status: 127, stdout: "", stderr: "command unavailable", error: null }
        : dependencies.run(command, args),
  });

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "framework_compatibility_receipt_unavailable",
    ),
  );
  assert.equal(
    (receipt.claims as Record<string, unknown>).component_compatibility_verified,
    false,
  );
});

test("installed preflight rejects a Framework receipt with invalid owner authority", async (t) => {
  const value = fixture(t);
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values, (compatibilityReceipt) => {
      compatibilityReceipt.owner = "one-person-lab-app";
    }),
  );

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "framework_compatibility_receipt_invalid",
    ),
  );
});

test("installed preflight rejects an expired Framework receipt", async (t) => {
  const value = fixture(t);
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values, (compatibilityReceipt) => {
      compatibilityReceipt.generated_at = "2026-07-29T23:50:00.000Z";
      compatibilityReceipt.issued_at = "2026-07-29T23:50:00.000Z";
      compatibilityReceipt.expires_at = "2026-07-29T23:55:00.000Z";
      compatibilityReceipt.freshness.generated_at = compatibilityReceipt.generated_at;
    }),
  );

  assert.equal(receipt.status, "failed");
  assert.match(
    String((receipt.first_failed as Record<string, unknown>).message),
    /expired|freshness/i,
  );
});

test("installed preflight rejects Framework subject drift", async (t) => {
  const value = fixture(t);
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values, (compatibilityReceipt) => {
      compatibilityReceipt.subject.selected_app_artifact.sha256 = `sha256:${"0".repeat(64)}`;
    }),
  );

  assert.equal(receipt.status, "failed");
  assert.match(
    String((receipt.first_failed as Record<string, unknown>).message),
    /subject drifted/i,
  );
});

test("installed preflight rejects incomplete requirement coverage", async (t) => {
  const value = fixture(t);
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values, (compatibilityReceipt) => {
      compatibilityReceipt.coverage = [];
    }),
  );

  assert.equal(receipt.status, "failed");
  assert.match(
    String((receipt.first_failed as Record<string, unknown>).message),
    /one coverage entry per requirement/i,
  );
});

test("installed preflight reports a Framework-owned missing-capability verdict", async (t) => {
  const value = fixture(t);
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values, (compatibilityReceipt) => {
      compatibilityReceipt.observed_components[0].capabilities = [];
      compatibilityReceipt.coverage[0].status = "unsatisfied";
      compatibilityReceipt.coverage[0].observation_ref = null;
      compatibilityReceipt.coverage[0].failure_code = "incompatible_missing_capability";
      compatibilityReceipt.failures = [
        {
          requirement_id: compatibilityReceipt.coverage[0].requirement_id,
          component_id: compatibilityReceipt.coverage[0].component_id,
          code: "incompatible_missing_capability",
        },
      ];
      compatibilityReceipt.status = "incompatible";
    }),
  );

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "incompatible_missing_capability",
    ),
  );
});

test("installed preflight reports a Framework-owned capability-schema verdict", async (t) => {
  const value = fixture(t);
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values, (compatibilityReceipt) => {
      compatibilityReceipt.observed_components[0].capabilities[0].schema_version = "2.0.0";
      compatibilityReceipt.coverage[0].status = "unsatisfied";
      compatibilityReceipt.coverage[0].failure_code = "incompatible_capability_schema";
      compatibilityReceipt.failures = [
        {
          requirement_id: compatibilityReceipt.coverage[0].requirement_id,
          component_id: compatibilityReceipt.coverage[0].component_id,
          code: "incompatible_capability_schema",
        },
      ];
      compatibilityReceipt.status = "incompatible";
    }),
  );

  assert.equal(receipt.status, "failed");
  assert.ok(
    (receipt.violations as Array<Record<string, unknown>>).some(
      (violation) => violation.code === "incompatible_capability_schema",
    ),
  );
});

test("installed preflight rejects a compatible receipt with empty observations", async (t) => {
  const value = fixture(t);
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values, (compatibilityReceipt) => {
      compatibilityReceipt.observed_components = [];
      compatibilityReceipt.coverage[0].observation_ref = null;
    }),
  );

  assert.equal(receipt.status, "failed");
  assert.match(
    String((receipt.first_failed as Record<string, unknown>).message),
    /observation|without failures/i,
  );
});

test("installed preflight rejects producer identity that differs from the executed Framework", async (t) => {
  const value = fixture(t);
  const receipt = await preflightInstalledGuiCohort(
    value.input,
    value.root,
    successfulDependencies(value.values, (compatibilityReceipt) => {
      compatibilityReceipt.producer_identity.package_ref = "one-person-lab@0.3.4";
    }),
  );

  assert.equal(receipt.status, "failed");
  assert.match(
    String((receipt.first_failed as Record<string, unknown>).message),
    /producer identity/i,
  );
});

test("installed preflight rejects a drifted Framework receipt sidecar", async (t) => {
  const value = fixture(t);
  const dependencies = successfulDependencies(value.values);
  const receipt = await preflightInstalledGuiCohort(value.input, value.root, {
    ...dependencies,
    run: (command, args) => {
      const result = dependencies.run(command, args);
      if (command === value.values.frameworkExecutable) {
        const outputIndex = args.indexOf("--output");
        fs.appendFileSync(`${args[outputIndex + 1]}.sha256`, "drift");
      }
      return result;
    },
  });

  assert.equal(receipt.status, "failed");
  assert.match(
    String((receipt.first_failed as Record<string, unknown>).message),
    /sidecar/i,
  );
});

test("installed preflight rejects an executable symlink before invoking Framework", async (t) => {
  const value = fixture(t);
  const symlinkPath = path.join(value.root, "framework-opl-link");
  fs.symlinkSync(value.values.frameworkExecutable, symlinkPath);
  const runtime = (value.input.compatibility as Record<string, any>).framework_runtime;
  runtime.executable_path = symlinkPath;

  await assert.rejects(
    preflightInstalledGuiCohort(
      value.input,
      value.root,
      successfulDependencies(value.values),
    ),
    /non-symlink/,
  );
});

test("installed preflight rejects executable-byte drift before invoking Framework", async (t) => {
  const value = fixture(t);
  const runtime = (value.input.compatibility as Record<string, any>).framework_runtime;
  runtime.executable_sha256 = "0".repeat(64);

  await assert.rejects(
    preflightInstalledGuiCohort(
      value.input,
      value.root,
      successfulDependencies(value.values),
    ),
    /launcher-bound SHA-256/,
  );
});

test("installed preflight rejects a wrong global Framework path not present in launcher readback", async (t) => {
  const value = fixture(t);
  const wrongGlobalPath = fs.realpathSync("/usr/bin/true");
  const runtime = (value.input.compatibility as Record<string, any>).framework_runtime;
  runtime.executable_path = wrongGlobalPath;
  runtime.executable_sha256 = digest(wrongGlobalPath);

  await assert.rejects(
    preflightInstalledGuiCohort(
      value.input,
      value.root,
      successfulDependencies(value.values),
    ),
    /launcher binding receipt/,
  );
});

test("installed preflight rejects launcher binding receipt byte drift", async (t) => {
  const value = fixture(t);
  fs.appendFileSync(value.values.frameworkBindingReceiptPath, "drift");

  await assert.rejects(
    preflightInstalledGuiCohort(
      value.input,
      value.root,
      successfulDependencies(value.values),
    ),
    /binding receipt SHA-256 drifted/,
  );
});
