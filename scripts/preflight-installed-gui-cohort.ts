import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AUTHORITY_SCHEMA = "opl_app_installed_gui_cohort_authority.v1";
const RECEIPT_SCHEMA = "opl_app_installed_gui_cohort_preflight_receipt.v1";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

type JsonRecord = Record<string, unknown>;

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error: string | null;
};

type PreflightDependencies = {
  run?: (command: string, args: string[]) => CommandResult;
  fetchJson?: (url: string) => Promise<{ status: number; value: unknown }>;
  now?: () => Date;
};

type Violation = {
  code: string;
  message: string;
};

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function exactSha256(value: unknown, label: string): string {
  const digest = requiredString(value, label).toLowerCase();
  if (!SHA256_PATTERN.test(digest)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return digest;
}

function exactCommit(value: unknown, label: string): string {
  const commit = requiredString(value, label).toLowerCase();
  if (!COMMIT_PATTERN.test(commit)) {
    throw new Error(`${label} must be a lowercase 40-character Git commit`);
  }
  return commit;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Number(value);
}

function sha256File(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readJson(filePath: string, label: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `${label} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return record(parsed, label);
}

function defaultRun(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message ?? null,
  };
}

async function defaultFetchJson(url: string): Promise<{ status: number; value: unknown }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  let value: unknown = null;
  try {
    value = await response.json();
  } catch {
    value = null;
  }
  return { status: response.status, value };
}

function commandPassed(result: CommandResult): boolean {
  return result.error === null && result.status === 0;
}

function commandDiagnostic(result: CommandResult): JsonRecord {
  return {
    status: result.status,
    stdout: result.stdout.trim().slice(0, 4_000),
    stderr: result.stderr.trim().slice(0, 4_000),
    error: result.error,
  };
}

function deepContains(value: unknown, expected: unknown): boolean {
  if (
    value === expected ||
    ((typeof value === "string" || typeof value === "number" || typeof value === "boolean") &&
      (typeof expected === "string" ||
        typeof expected === "number" ||
        typeof expected === "boolean") &&
      String(value) === String(expected))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.some((entry) => deepContains(entry, expected));
  if (value && typeof value === "object") {
    return Object.values(value as JsonRecord).some((entry) => deepContains(entry, expected));
  }
  return false;
}

function addViolation(violations: Violation[], code: string, message: string): void {
  violations.push({ code, message });
}

function assertFileDigest(
  filePath: string,
  expected: string,
  label: string,
  violations: Violation[],
): string | null {
  if (!fs.statSync(filePath, { throwIfNoEntry: false })?.isFile()) {
    addViolation(violations, "missing_file", `${label} is missing: ${filePath}`);
    return null;
  }
  const actual = sha256File(filePath);
  if (actual !== expected) {
    addViolation(
      violations,
      "file_sha256_mismatch",
      `${label} SHA-256 mismatch: expected ${expected}, got ${actual}`,
    );
  }
  return actual;
}

function portFromEndpoint(endpoint: string): number {
  const parsed = new URL(endpoint);
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
    throw new Error("CDP endpoint must be loopback-only");
  }
  if (!parsed.port) throw new Error("CDP endpoint must declare an explicit port");
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("CDP endpoint port is invalid");
  }
  return port;
}

function plistValue(
  run: NonNullable<PreflightDependencies["run"]>,
  appPath: string,
  key: string,
): { value: string | null; command: JsonRecord } {
  const result = run("/usr/bin/plutil", [
    "-extract",
    key,
    "raw",
    "-o",
    "-",
    path.join(appPath, "Contents/Info.plist"),
  ]);
  return {
    value: commandPassed(result) ? result.stdout.trim() : null,
    command: commandDiagnostic(result),
  };
}

function parseAuthority(
  rawInput: unknown,
  baseDirectory: string,
): {
  classification: "diagnostic" | "immutable_stable";
  cohort: JsonRecord;
  artifact: JsonRecord;
  installed: JsonRecord;
  runtime: JsonRecord;
  profile: JsonRecord;
  identity: JsonRecord;
} {
  const input = record(rawInput, "installed GUI cohort authority");
  if (input.schema !== AUTHORITY_SCHEMA) {
    throw new Error(`authority schema must be ${AUTHORITY_SCHEMA}`);
  }
  const classification = requiredString(input.classification, "classification");
  if (!["diagnostic", "immutable_stable"].includes(classification)) {
    throw new Error("classification must be diagnostic or immutable_stable");
  }
  const cohort = record(input.cohort, "cohort");
  for (const field of ["app_sha", "shell_sha", "framework_sha"] as const) {
    cohort[field] = exactCommit(cohort[field], `cohort.${field}`);
  }
  for (const field of ["app_tree", "shell_tree", "framework_tree"] as const) {
    cohort[field] = exactCommit(cohort[field], `cohort.${field}`);
  }
  const normalizePath = (value: unknown, label: string) =>
    path.resolve(baseDirectory, requiredString(value, label));
  const artifact = record(input.artifact, "artifact");
  artifact.path = normalizePath(artifact.path, "artifact.path");
  artifact.sha256 = exactSha256(artifact.sha256, "artifact.sha256");
  artifact.source_lock = normalizePath(artifact.source_lock, "artifact.source_lock");
  artifact.source_lock_sha256 = exactSha256(
    artifact.source_lock_sha256,
    "artifact.source_lock_sha256",
  );
  artifact.build_receipt = normalizePath(artifact.build_receipt, "artifact.build_receipt");
  artifact.build_receipt_sha256 = exactSha256(
    artifact.build_receipt_sha256,
    "artifact.build_receipt_sha256",
  );
  artifact.install_receipt = normalizePath(artifact.install_receipt, "artifact.install_receipt");
  artifact.install_receipt_sha256 = exactSha256(
    artifact.install_receipt_sha256,
    "artifact.install_receipt_sha256",
  );
  if (classification === "immutable_stable") {
    if (artifact.immutable !== true || artifact.public !== true) {
      throw new Error("immutable_stable requires immutable=true and public=true");
    }
    requiredString(artifact.release_id, "artifact.release_id");
    requiredString(artifact.asset_name, "artifact.asset_name");
    artifact.size_bytes = positiveInteger(artifact.size_bytes, "artifact.size_bytes");
    artifact.public_release_receipt = normalizePath(
      artifact.public_release_receipt,
      "artifact.public_release_receipt",
    );
    artifact.public_release_receipt_sha256 = exactSha256(
      artifact.public_release_receipt_sha256,
      "artifact.public_release_receipt_sha256",
    );
  }
  const installed = record(input.installed, "installed");
  installed.app_path = normalizePath(installed.app_path, "installed.app_path");
  installed.pid = positiveInteger(installed.pid, "installed.pid");
  installed.executable_path = normalizePath(installed.executable_path, "installed.executable_path");
  installed.app_asar = normalizePath(installed.app_asar, "installed.app_asar");
  installed.app_asar_sha256 = exactSha256(installed.app_asar_sha256, "installed.app_asar_sha256");
  installed.full_manifest = normalizePath(installed.full_manifest, "installed.full_manifest");
  installed.full_manifest_sha256 = exactSha256(
    installed.full_manifest_sha256,
    "installed.full_manifest_sha256",
  );
  const runtime = record(input.runtime, "runtime");
  runtime.cdp_endpoint = requiredString(runtime.cdp_endpoint, "runtime.cdp_endpoint");
  runtime.target_url_includes = requiredString(
    runtime.target_url_includes,
    "runtime.target_url_includes",
  );
  runtime.aioncore_pid = positiveInteger(runtime.aioncore_pid, "runtime.aioncore_pid");
  runtime.aioncore_parent_pid = positiveInteger(
    runtime.aioncore_parent_pid,
    "runtime.aioncore_parent_pid",
  );
  runtime.aioncore_binary = normalizePath(runtime.aioncore_binary, "runtime.aioncore_binary");
  runtime.aioncore_binary_sha256 = exactSha256(
    runtime.aioncore_binary_sha256,
    "runtime.aioncore_binary_sha256",
  );
  runtime.aioncore_manifest = normalizePath(runtime.aioncore_manifest, "runtime.aioncore_manifest");
  runtime.aioncore_manifest_sha256 = exactSha256(
    runtime.aioncore_manifest_sha256,
    "runtime.aioncore_manifest_sha256",
  );
  runtime.aioncore_resources_manifest = normalizePath(
    runtime.aioncore_resources_manifest,
    "runtime.aioncore_resources_manifest",
  );
  runtime.aioncore_resources_sha256 = exactSha256(
    runtime.aioncore_resources_sha256,
    "runtime.aioncore_resources_sha256",
  );
  runtime.aioncore_health_url = requiredString(
    runtime.aioncore_health_url,
    "runtime.aioncore_health_url",
  );
  runtime.aioncore_runtime_url = requiredString(
    runtime.aioncore_runtime_url,
    "runtime.aioncore_runtime_url",
  );
  if (runtime.aioncore_parent_pid !== installed.pid) {
    throw new Error("runtime.aioncore_parent_pid must equal installed.pid");
  }
  const profile = record(input.profile, "profile");
  if (profile.kind !== "isolated" || profile.user_profile_protected !== true) {
    throw new Error("profile.kind must be isolated and user_profile_protected must be true");
  }
  profile.root = normalizePath(profile.root, "profile.root");
  profile.receipt = normalizePath(profile.receipt, "profile.receipt");
  profile.receipt_sha256 = exactSha256(profile.receipt_sha256, "profile.receipt_sha256");
  const identity = record(input.identity, "identity");
  requiredString(identity.package_or_build_identity, "identity.package_or_build_identity");
  requiredString(identity.bundle_id, "identity.bundle_id");
  requiredString(identity.display_version, "identity.display_version");
  requiredString(identity.public_updater_version, "identity.public_updater_version");
  requiredString(identity.machine_version, "identity.machine_version");
  requiredString(identity.source_lock_plist_key, "identity.source_lock_plist_key");
  if (classification === "immutable_stable") {
    requiredString(identity.team_id, "identity.team_id");
  }
  return {
    classification: classification as "diagnostic" | "immutable_stable",
    cohort,
    artifact,
    installed,
    runtime,
    profile,
    identity,
  };
}

export async function preflightInstalledGuiCohort(
  rawInput: unknown,
  baseDirectory: string,
  dependencies: PreflightDependencies = {},
): Promise<JsonRecord> {
  const run = dependencies.run ?? defaultRun;
  const fetchJson = dependencies.fetchJson ?? defaultFetchJson;
  const violations: Violation[] = [];
  const authority = parseAuthority(rawInput, baseDirectory);
  const checks: JsonRecord = {};

  const artifactActual = assertFileDigest(
    String(authority.artifact.path),
    String(authority.artifact.sha256),
    "public artifact",
    violations,
  );
  if (
    authority.classification === "immutable_stable" &&
    fs.statSync(String(authority.artifact.path), { throwIfNoEntry: false })?.size !==
      authority.artifact.size_bytes
  ) {
    addViolation(
      violations,
      "artifact_size_mismatch",
      "public artifact size does not match the release authority",
    );
  }
  const publicReleaseReceiptActual =
    authority.classification === "immutable_stable"
      ? assertFileDigest(
          String(authority.artifact.public_release_receipt),
          String(authority.artifact.public_release_receipt_sha256),
          "public release receipt",
          violations,
        )
      : null;
  const sourceLockActual = assertFileDigest(
    String(authority.artifact.source_lock),
    String(authority.artifact.source_lock_sha256),
    "source-lock receipt",
    violations,
  );
  const installReceiptActual = assertFileDigest(
    String(authority.artifact.install_receipt),
    String(authority.artifact.install_receipt_sha256),
    "install receipt",
    violations,
  );
  const buildReceiptActual = assertFileDigest(
    String(authority.artifact.build_receipt),
    String(authority.artifact.build_receipt_sha256),
    "build receipt",
    violations,
  );
  const appAsarActual = assertFileDigest(
    String(authority.installed.app_asar),
    String(authority.installed.app_asar_sha256),
    "installed app.asar",
    violations,
  );
  const fullManifestActual = assertFileDigest(
    String(authority.installed.full_manifest),
    String(authority.installed.full_manifest_sha256),
    "installed full manifest",
    violations,
  );
  const aioncoreBinaryActual = assertFileDigest(
    String(authority.runtime.aioncore_binary),
    String(authority.runtime.aioncore_binary_sha256),
    "AionCore binary",
    violations,
  );
  const aioncoreManifestActual = assertFileDigest(
    String(authority.runtime.aioncore_manifest),
    String(authority.runtime.aioncore_manifest_sha256),
    "AionCore manifest",
    violations,
  );
  const aioncoreResourcesActual = assertFileDigest(
    String(authority.runtime.aioncore_resources_manifest),
    String(authority.runtime.aioncore_resources_sha256),
    "AionCore resources manifest",
    violations,
  );
  const profileReceiptActual = assertFileDigest(
    String(authority.profile.receipt),
    String(authority.profile.receipt_sha256),
    "isolated profile receipt",
    violations,
  );
  checks.digests = {
    artifact: artifactActual,
    public_release_receipt: publicReleaseReceiptActual,
    source_lock: sourceLockActual,
    build_receipt: buildReceiptActual,
    install_receipt: installReceiptActual,
    app_asar: appAsarActual,
    full_manifest: fullManifestActual,
    aioncore_binary: aioncoreBinaryActual,
    aioncore_manifest: aioncoreManifestActual,
    aioncore_resources: aioncoreResourcesActual,
    isolated_profile_receipt: profileReceiptActual,
  };

  if (
    !fs.statSync(String(authority.installed.app_path), { throwIfNoEntry: false })?.isDirectory()
  ) {
    addViolation(
      violations,
      "installed_app_missing",
      `installed App is missing: ${String(authority.installed.app_path)}`,
    );
  }
  if (!fs.statSync(String(authority.profile.root), { throwIfNoEntry: false })?.isDirectory()) {
    addViolation(
      violations,
      "isolated_profile_root_missing",
      `isolated profile root is missing: ${String(authority.profile.root)}`,
    );
  }

  if (sourceLockActual) {
    const sourceLock = readJson(String(authority.artifact.source_lock), "source-lock receipt");
    for (const [field, expected] of Object.entries(authority.cohort)) {
      if (!deepContains(sourceLock, String(expected))) {
        addViolation(
          violations,
          "source_lock_cohort_mismatch",
          `source-lock receipt does not bind cohort.${field}=${String(expected)}`,
        );
      }
    }
  }
  if (publicReleaseReceiptActual) {
    const publicReleaseReceipt = readJson(
      String(authority.artifact.public_release_receipt),
      "public release receipt",
    );
    for (const expected of [
      authority.artifact.release_id,
      authority.artifact.asset_name,
      authority.artifact.sha256,
      authority.artifact.size_bytes,
      authority.artifact.source_lock_sha256,
    ]) {
      if (deepContains(publicReleaseReceipt, expected)) continue;
      addViolation(
        violations,
        "public_release_receipt_binding_mismatch",
        `public release receipt does not bind ${String(expected)}`,
      );
    }
  }
  if (buildReceiptActual) {
    const buildReceipt = readJson(String(authority.artifact.build_receipt), "build receipt");
    for (const expected of [
      authority.artifact.source_lock_sha256,
      authority.artifact.sha256,
      authority.installed.app_asar_sha256,
    ]) {
      if (deepContains(buildReceipt, expected)) continue;
      addViolation(
        violations,
        "build_receipt_binding_mismatch",
        `build receipt does not bind ${String(expected)}`,
      );
    }
  }
  if (installReceiptActual) {
    const installReceipt = readJson(String(authority.artifact.install_receipt), "install receipt");
    for (const expected of [
      authority.artifact.source_lock_sha256,
      authority.artifact.build_receipt_sha256,
      authority.artifact.sha256,
      authority.installed.app_path,
      authority.installed.app_asar_sha256,
      authority.installed.pid,
    ]) {
      if (!deepContains(installReceipt, String(expected))) {
        addViolation(
          violations,
          "install_receipt_binding_mismatch",
          `install receipt does not bind ${String(expected)}`,
        );
      }
    }
  }
  if (profileReceiptActual) {
    const profileReceipt = readJson(String(authority.profile.receipt), "isolated profile receipt");
    if (
      !deepContains(profileReceipt, String(authority.profile.root)) ||
      !deepContains(profileReceipt, "isolated")
    ) {
      addViolation(
        violations,
        "isolated_profile_receipt_mismatch",
        "isolated profile receipt does not bind the profile root and isolated kind",
      );
    }
  }
  if (fullManifestActual) {
    const fullManifest = readJson(
      String(authority.installed.full_manifest),
      "installed full manifest",
    );
    if (
      !deepContains(fullManifest, authority.identity.display_version) ||
      !deepContains(fullManifest, authority.artifact.source_lock_sha256)
    ) {
      addViolation(
        violations,
        "full_manifest_identity_mismatch",
        "installed full manifest does not bind display version and source-lock",
      );
    }
  }

  const appPath = String(authority.installed.app_path);
  const identityChecks: JsonRecord = {};
  for (const [label, key, expected] of [
    ["bundle_id", "CFBundleIdentifier", authority.identity.bundle_id],
    ["machine_short_version", "CFBundleShortVersionString", authority.identity.machine_version],
    ["machine_bundle_version", "CFBundleVersion", authority.identity.machine_version],
    [
      "public_updater_version",
      "OPLPublicUpdaterVersion",
      authority.identity.public_updater_version,
    ],
    [
      "source_lock",
      authority.identity.source_lock_plist_key,
      authority.artifact.source_lock_sha256,
    ],
  ] as const) {
    const actual = plistValue(run, appPath, String(key));
    identityChecks[label] = actual;
    if (actual.value !== String(expected)) {
      addViolation(
        violations,
        "plist_identity_mismatch",
        `${label} mismatch: expected ${String(expected)}, got ${String(actual.value)}`,
      );
    }
  }
  checks.plist = identityChecks;

  const pid = Number(authority.installed.pid);
  const process = run("/bin/ps", ["-p", String(pid), "-o", "comm="]);
  checks.app_process = commandDiagnostic(process);
  if (
    !commandPassed(process) ||
    path.resolve(process.stdout.trim()) !==
      path.resolve(String(authority.installed.executable_path))
  ) {
    addViolation(
      violations,
      "pid_executable_mismatch",
      `PID ${pid} does not resolve to ${String(authority.installed.executable_path)}`,
    );
  }

  const codesign = run("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    appPath,
  ]);
  checks.codesign = commandDiagnostic(codesign);
  if (!commandPassed(codesign)) {
    addViolation(violations, "codesign_failed", "installed App codesign verification failed");
  }
  const signature = run("/usr/bin/codesign", ["-dv", "--verbose=4", appPath]);
  checks.signature = commandDiagnostic(signature);
  const signatureOutput = `${signature.stdout}\n${signature.stderr}`;
  if (
    authority.classification === "immutable_stable" &&
    !signatureOutput.includes(`TeamIdentifier=${String(authority.identity.team_id)}`)
  ) {
    addViolation(
      violations,
      "team_identifier_mismatch",
      "installed App signature does not bind the expected TeamIdentifier",
    );
  }
  const gatekeeper = run("/usr/sbin/spctl", [
    "--assess",
    "--type",
    "execute",
    "--verbose=4",
    appPath,
  ]);
  checks.gatekeeper = commandDiagnostic(gatekeeper);
  if (authority.classification === "immutable_stable" && !commandPassed(gatekeeper)) {
    addViolation(
      violations,
      "gatekeeper_failed",
      "immutable Stable installed App is not accepted by Gatekeeper",
    );
  }

  const cdpEndpoint = String(authority.runtime.cdp_endpoint);
  const cdpPort = portFromEndpoint(cdpEndpoint);
  const cdpListener = run("/usr/sbin/lsof", [
    "-nP",
    "-a",
    "-p",
    String(pid),
    `-iTCP:${cdpPort}`,
    "-sTCP:LISTEN",
  ]);
  checks.cdp_listener = commandDiagnostic(cdpListener);
  if (!commandPassed(cdpListener)) {
    addViolation(
      violations,
      "cdp_pid_binding_failed",
      `CDP port ${cdpPort} is not owned by App PID ${pid}`,
    );
  }
  try {
    const version = await fetchJson(new URL("/json/version", cdpEndpoint).toString());
    const targets = await fetchJson(new URL("/json/list", cdpEndpoint).toString());
    checks.cdp_version = { status: version.status, value: version.value };
    checks.cdp_targets = { status: targets.status, value: targets.value };
    if (version.status !== 200) {
      addViolation(
        violations,
        "cdp_version_unreachable",
        "CDP /json/version did not return HTTP 200",
      );
    }
    const matchingTargets = Array.isArray(targets.value)
      ? targets.value
          .map((value) => record(value, "CDP target"))
          .filter((target) => target.type === "page")
          .filter((target) =>
            String(target.url ?? "").includes(String(authority.runtime.target_url_includes)),
          )
      : [];
    if (targets.status !== 200 || matchingTargets.length !== 1) {
      addViolation(
        violations,
        "cdp_target_identity_mismatch",
        `expected one matching renderer target, found ${matchingTargets.length}`,
      );
    }
  } catch (error) {
    addViolation(
      violations,
      "cdp_readback_failed",
      error instanceof Error ? error.message : String(error),
    );
  }

  const aioncorePid = Number(authority.runtime.aioncore_pid);
  const aioncoreProcess = run("/bin/ps", ["-p", String(aioncorePid), "-o", "comm="]);
  const aioncoreParent = run("/bin/ps", ["-p", String(aioncorePid), "-o", "ppid="]);
  checks.aioncore_process = commandDiagnostic(aioncoreProcess);
  checks.aioncore_parent = commandDiagnostic(aioncoreParent);
  if (
    !commandPassed(aioncoreProcess) ||
    path.resolve(aioncoreProcess.stdout.trim()) !==
      path.resolve(String(authority.runtime.aioncore_binary))
  ) {
    addViolation(
      violations,
      "aioncore_pid_binary_mismatch",
      "AionCore PID does not resolve to the bound binary",
    );
  }
  if (
    !commandPassed(aioncoreParent) ||
    Number(aioncoreParent.stdout.trim()) !== Number(authority.runtime.aioncore_parent_pid)
  ) {
    addViolation(
      violations,
      "aioncore_parent_mismatch",
      "AionCore parent PID does not match the bound runtime receipt",
    );
  }
  const version = run(String(authority.runtime.aioncore_binary), ["--version"]);
  checks.aioncore_version = commandDiagnostic(version);
  if (
    !commandPassed(version) ||
    !version.stdout.includes(String(authority.runtime.aioncore_version).replace(/^v/, ""))
  ) {
    addViolation(
      violations,
      "aioncore_version_mismatch",
      "AionCore binary version does not match the bound runtime version",
    );
  }
  if (aioncoreManifestActual && aioncoreResourcesActual) {
    const manifest = readJson(String(authority.runtime.aioncore_manifest), "AionCore manifest");
    const resources = readJson(
      String(authority.runtime.aioncore_resources_manifest),
      "AionCore resources manifest",
    );
    if (!deepContains(manifest, String(authority.runtime.aioncore_version))) {
      addViolation(
        violations,
        "aioncore_manifest_version_mismatch",
        "AionCore manifest does not bind the expected version",
      );
    }
    if (!deepContains(resources, 2)) {
      addViolation(
        violations,
        "aioncore_resources_schema_mismatch",
        "AionCore managed resources do not declare schema version 2",
      );
    }
  }
  try {
    const health = await fetchJson(String(authority.runtime.aioncore_health_url));
    checks.aioncore_health = { status: health.status, value: health.value };
    if (health.status !== 200) {
      addViolation(
        violations,
        "aioncore_health_mismatch",
        "AionCore health readback did not return HTTP 200",
      );
    }
  } catch (error) {
    addViolation(
      violations,
      "aioncore_health_unreachable",
      error instanceof Error ? error.message : String(error),
    );
  }
  try {
    const runtime = await fetchJson(String(authority.runtime.aioncore_runtime_url));
    checks.aioncore_runtime = { status: runtime.status, value: runtime.value };
    if (
      runtime.status !== 200 ||
      (!deepContains(runtime.value, String(authority.runtime.aioncore_version)) &&
        !deepContains(runtime.value, String(authority.runtime.aioncore_version).replace(/^v/, "")))
    ) {
      addViolation(
        violations,
        "aioncore_runtime_mismatch",
        "AionCore runtime readback does not bind the expected version",
      );
    }
  } catch (error) {
    addViolation(
      violations,
      "aioncore_runtime_unreachable",
      error instanceof Error ? error.message : String(error),
    );
  }

  const status = violations.length === 0 ? "passed" : "failed";
  const receipt: JsonRecord = {
    schema: RECEIPT_SCHEMA,
    status,
    inspected_at: (dependencies.now ?? (() => new Date()))().toISOString(),
    classification: authority.classification,
    cohort: authority.cohort,
    artifact: authority.artifact,
    installed: authority.installed,
    runtime: {
      ...authority.runtime,
      pid: authority.installed.pid,
      executable_path: authority.installed.executable_path,
    },
    profile: authority.profile,
    identity: authority.identity,
    checks,
    violations,
    first_failed: violations[0] ?? null,
    claims: {
      artifact_digest_bound: artifactActual === authority.artifact.sha256,
      public_release_bound:
        authority.classification === "immutable_stable" &&
        publicReleaseReceiptActual === authority.artifact.public_release_receipt_sha256,
      source_lock_bound: sourceLockActual === authority.artifact.source_lock_sha256,
      build_receipt_bound: buildReceiptActual === authority.artifact.build_receipt_sha256,
      installed_bytes_bound: appAsarActual === authority.installed.app_asar_sha256,
      same_cohort_installed: status === "passed",
      pid_executable_bound: status === "passed" && commandPassed(process),
      cdp_pid_bound: status === "passed" && commandPassed(cdpListener),
      aioncore_runtime_bound: status === "passed" && commandPassed(aioncoreProcess),
      isolated_profile_bound:
        status === "passed" && profileReceiptActual === authority.profile.receipt_sha256,
      installed_pixel_acceptance: false,
      release_ready: false,
    },
  };
  return receipt;
}

function parseCli(argv: string[]): { input: string; output: string | null } {
  let input = "";
  let output: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${token}`);
    if (token === "--input") input = value;
    else if (token === "--output") output = value;
    else throw new Error(`unknown argument ${token}`);
    index += 1;
  }
  if (!input) throw new Error("--input is required");
  return { input, output };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const receipt = await preflightInstalledGuiCohort(
    readJson(inputPath, "installed GUI cohort authority"),
    path.dirname(inputPath),
  );
  const payload = `${JSON.stringify(receipt, null, 2)}\n`;
  if (options.output) fs.writeFileSync(path.resolve(options.output), payload);
  process.stdout.write(payload);
  if (receipt.status !== "passed") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stdout.write(
      `${JSON.stringify(
        {
          schema: RECEIPT_SCHEMA,
          status: "failed",
          violations: [
            {
              code: "preflight_execution_failed",
              message: error instanceof Error ? error.message : String(error),
            },
          ],
          first_failed: {
            code: "preflight_execution_failed",
            message: error instanceof Error ? error.message : String(error),
          },
          claims: {
            artifact_digest_bound: false,
            source_lock_bound: false,
            installed_bytes_bound: false,
            same_cohort_installed: false,
            pid_executable_bound: false,
            cdp_pid_bound: false,
            aioncore_runtime_bound: false,
            isolated_profile_bound: false,
            installed_pixel_acceptance: false,
            release_ready: false,
          },
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 1;
  });
}
