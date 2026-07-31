import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  validateComponentCompatibilityReceipt,
} from "./validate-active-shell/install-exposure-policy-validator.ts";

const AUTHORITY_SCHEMA = "opl_app_installed_gui_artifact_authority.v2";
const RECEIPT_SCHEMA = "opl_app_installed_gui_artifact_preflight_receipt.v2";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function gitBlobSha256(
  run: NonNullable<PreflightDependencies["run"]>,
  commit: string,
  filePath: string,
  violations: Violation[],
): string | null {
  const result = run("/usr/bin/git", ["-C", APP_ROOT, "show", `${commit}:${filePath}`]);
  if (!commandPassed(result)) {
    addViolation(
      violations,
      "app_contract_blob_unavailable",
      `cannot read ${filePath} from App build provenance ${commit}`,
    );
    return null;
  }
  return crypto.createHash("sha256").update(result.stdout, "utf8").digest("hex");
}

type CompatibilityProfileBinding = {
  profileId: string;
  requirements: JsonRecord[];
  maxAgeSeconds: number;
};

function loadCompatibilityProfile(
  run: NonNullable<PreflightDependencies["run"]>,
  appCommit: string,
  profileId: string,
  violations: Violation[],
): CompatibilityProfileBinding | null {
  const contractPath = "contracts/app-install-exposure-policy.json";
  const result = run("/usr/bin/git", ["-C", APP_ROOT, "show", `${appCommit}:${contractPath}`]);
  if (!commandPassed(result)) {
    addViolation(
      violations,
      "app_compatibility_contract_unavailable",
      `cannot read ${contractPath} from selected App artifact provenance ${appCommit}`,
    );
    return null;
  }
  try {
    const contract = record(JSON.parse(result.stdout), "App compatibility contract");
    const interoperability = record(
      contract.component_interoperability,
      "App component interoperability contract",
    );
    const admission = record(
      interoperability.compatibility_admission,
      "App compatibility admission",
    );
    const profiles = record(
      interoperability.compatibility_profiles,
      "App compatibility profiles",
    );
    const profile = record(profiles[profileId], `App compatibility profile ${profileId}`);
    if (
      profile.profile_id !== profileId ||
      !Array.isArray(profile.requirements) ||
      profile.requirements.length === 0 ||
      admission.receipt_schema !== "opl_component_compatibility_receipt.v1" ||
      admission.requirements_schema !== "opl_component_compatibility_requirements.v1" ||
      admission.subject_schema !== "opl_app_compatibility_subject.v1" ||
      admission.receipt_transport !==
        "cli_envelope_with_independent_json_file_and_sha256_sidecar" ||
      admission.current_framework_producer_status !==
        "canonical_owner_cli_and_receipt_producer" ||
      admission.producer_contract_ref !==
        "contracts/opl-framework/app-component-compatibility-receipt-contract.json" ||
      admission.inline_compatible_claim_allowed !== false ||
      admission.app_may_generate_compatible_receipt !== false
    ) {
      throw new Error("profile or Framework receipt authority fields are incomplete");
    }
    const maxAgeSeconds = positiveInteger(
      admission.observation_max_age_seconds,
      "compatibility observation_max_age_seconds",
    );
    const requirements = profile.requirements.map((item) =>
      record(item, `App compatibility requirement for ${profileId}`),
    );
    return {
      profileId,
      requirements,
      maxAgeSeconds,
    };
  } catch (error) {
    addViolation(
      violations,
      "app_compatibility_contract_invalid",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

function requestFrameworkCompatibilityReceipt(
  run: NonNullable<PreflightDependencies["run"]>,
  profile: CompatibilityProfileBinding,
  producerIdentity: JsonRecord,
  subject: JsonRecord,
  outputFile: string,
  now: Date,
  violations: Violation[],
): {
  receipt: JsonRecord | null;
  outputSha256: string | null;
  command: JsonRecord;
  sources: JsonRecord | null;
} {
  const requirementsFile = `${outputFile}.requirements.json`;
  const subjectFile = `${outputFile}.subject.json`;
  try {
    writeNewJson(requirementsFile, {
      schema: "opl_component_compatibility_requirements.v1",
      owner: "one-person-lab-app",
      contract_ref:
        "contracts/app-install-exposure-policy.json#component_interoperability.compatibility_admission",
      profile_id: profile.profileId,
      requirements: profile.requirements,
    });
    writeNewJson(subjectFile, {
      schema: "opl_app_compatibility_subject.v1",
      owner: "one-person-lab-app",
      ...subject,
    });
  } catch (error) {
    addViolation(
      violations,
      "framework_compatibility_input_write_failed",
      error instanceof Error ? error.message : String(error),
    );
    return { receipt: null, outputSha256: null, command: {}, sources: null };
  }
  const expectedSources = {
    requirements: {
      path: fs.realpathSync(requirementsFile),
      sha256: sha256File(requirementsFile),
    },
    subject: {
      path: fs.realpathSync(subjectFile),
      sha256: sha256File(subjectFile),
    },
  };
  const args = [
    "app",
    "compatibility",
    "receipt",
    "--requirements-file",
    requirementsFile,
    "--subject-file",
    subjectFile,
    "--output",
    outputFile,
    "--ttl-seconds",
    String(profile.maxAgeSeconds),
    "--json",
  ];
  const frameworkExecutable = String(producerIdentity.executable_path);
  const result = run(frameworkExecutable, args);
  const command = {
    executable: frameworkExecutable,
    executable_sha256: producerIdentity.executable_sha256,
    framework_version: producerIdentity.framework_version,
    package_ref: producerIdentity.package_ref,
    argv: args,
    ...commandDiagnostic(result),
  };
  if (!commandPassed(result)) {
    addViolation(
      violations,
      "framework_compatibility_receipt_unavailable",
      "Framework compatibility producer is unavailable or returned a non-zero exit status",
    );
    return { receipt: null, outputSha256: null, command, sources: expectedSources };
  }
  try {
    const envelope = record(JSON.parse(result.stdout), "Framework compatibility CLI envelope");
    const projection = record(
      envelope.app_component_compatibility_receipt,
      "Framework compatibility CLI receipt projection",
    );
    const projectionProducerIdentity = record(
      projection.producer_identity,
      "Framework compatibility CLI producer_identity",
    );
    if (
      projectionProducerIdentity.command_surface !== producerIdentity.command_surface ||
      path.resolve(String(projectionProducerIdentity.executable_path)) !==
        producerIdentity.executable_path ||
      sha256WithoutPrefix(projectionProducerIdentity.executable_sha256) !==
        producerIdentity.executable_sha256 ||
      projectionProducerIdentity.framework_version !== producerIdentity.framework_version ||
      projectionProducerIdentity.package_ref !== producerIdentity.package_ref
    ) {
      throw new Error(
        "Framework compatibility CLI producer identity does not match the executed Framework",
      );
    }
    const projectedReceiptPath = path.resolve(
      requiredString(projection.receipt_file, "Framework compatibility CLI receipt_file"),
    );
    const projectedSidecarPath = path.resolve(
      requiredString(projection.sha256_file, "Framework compatibility CLI sha256_file"),
    );
    if (
      projectedReceiptPath !== path.resolve(outputFile) ||
      projectedSidecarPath !== path.resolve(`${outputFile}.sha256`)
    ) {
      throw new Error("Framework compatibility CLI envelope drifted from the requested output paths");
    }
    for (const [filePath, label] of [
      [projectedReceiptPath, "Framework compatibility receipt"],
      [projectedSidecarPath, "Framework compatibility SHA-256 sidecar"],
    ] as const) {
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`${label} must be a regular non-symlink file`);
      }
    }
    const outputSha256 = sha256File(projectedReceiptPath);
    if (sha256WithoutPrefix(projection.receipt_sha256) !== outputSha256) {
      throw new Error("Framework compatibility CLI receipt SHA-256 does not match receipt bytes");
    }
    const expectedSidecar = `${outputSha256}  ${path.basename(projectedReceiptPath)}\n`;
    if (fs.readFileSync(projectedSidecarPath, "utf8") !== expectedSidecar) {
      throw new Error("Framework compatibility SHA-256 sidecar does not match receipt bytes");
    }
    const expectedSubject = {
      selected_app_artifact: subject.selected_app_artifact,
      installed_app_asar: {
        path: fs.realpathSync(
          String((subject.installed_app_asar as JsonRecord).path),
        ),
        sha256: String((subject.installed_app_asar as JsonRecord).sha256).replace(
          /^sha256:/,
          "",
        ),
      },
      build_receipt: {
        path: fs.realpathSync(String((subject.build_receipt as JsonRecord).path)),
        sha256: String((subject.build_receipt as JsonRecord).sha256).replace(/^sha256:/, ""),
      },
    };
    const receipt = validateComponentCompatibilityReceipt(
      readJson(projectedReceiptPath, "Framework compatibility receipt"),
      {
      expected_producer_identity: producerIdentity,
      expected_receipt_path: projectedReceiptPath,
      expected_requirements: profile.requirements,
      expected_sources: expectedSources,
      expected_subject: expectedSubject,
      max_age_seconds: profile.maxAgeSeconds,
      now,
      },
    ) as JsonRecord;
    if (
      projection.status !== receipt.status ||
      projection.requirement_count !== profile.requirements.length ||
      projection.failure_count !== (receipt.failures as unknown[]).length ||
      projection.issued_at !== receipt.issued_at ||
      projection.expires_at !== receipt.expires_at
    ) {
      throw new Error("Framework compatibility CLI envelope does not match receipt contents");
    }
    if (receipt.status === "incompatible") {
      for (const failure of receipt.failures as JsonRecord[]) {
        addViolation(
          violations,
          String(failure.code),
          typeof failure.message === "string"
            ? failure.message
            : `Framework compatibility failed: ${String(failure.code)}`,
        );
      }
    }
    return { receipt, outputSha256, command, sources: expectedSources };
  } catch (error) {
    addViolation(
      violations,
      "framework_compatibility_receipt_invalid",
      error instanceof Error ? error.message : String(error),
    );
    return {
      receipt: null,
      outputSha256:
        fs.statSync(outputFile, { throwIfNoEntry: false })?.isFile()
          ? sha256File(outputFile)
          : null,
      command,
      sources: expectedSources,
    };
  }
}

function collectTreeEntries(root: string, relative = ""): string[] {
  const directory = path.join(root, relative);
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const childRelative = path.posix.join(relative.split(path.sep).join("/"), entry.name);
      const childPath = path.join(root, childRelative);
      const stat = fs.lstatSync(childPath);
      const mode = (stat.mode & 0o777).toString(8);
      if (entry.isDirectory()) {
        return [`D\t${childRelative}\t${mode}`, ...collectTreeEntries(root, childRelative)];
      }
      if (entry.isSymbolicLink()) {
        return [`L\t${childRelative}\t${mode}\t${fs.readlinkSync(childPath)}`];
      }
      return [`F\t${childRelative}\t${mode}\t${stat.size}\t${sha256File(childPath)}`];
    });
}

function sha256Tree(root: string): string {
  return crypto
    .createHash("sha256")
    .update(`${collectTreeEntries(root).join("\n")}\n`)
    .digest("hex");
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

function valueAtPath(value: unknown, fieldPath: string): unknown {
  return fieldPath.split(".").reduce<unknown>((current, field) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as JsonRecord)[field];
  }, value);
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (
    (typeof actual === "string" || typeof actual === "number") &&
    (typeof expected === "string" || typeof expected === "number")
  ) {
    return String(actual) === String(expected);
  }
  return false;
}

function exactPathMatches(value: unknown, paths: string[], expected: unknown): boolean {
  const present = paths
    .map((fieldPath) => valueAtPath(value, fieldPath))
    .filter((entry) => entry !== undefined);
  return present.length > 0 && present.every((entry) => valuesEqual(entry, expected));
}

function hasExactProcessArgument(commandLine: string, argument: string): boolean {
  const escaped = argument.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?=$|\\s)`).test(commandLine);
}

function requireExactPath(
  value: unknown,
  paths: string[],
  expected: unknown,
  violations: Violation[],
  code: string,
  label: string,
): void {
  if (!exactPathMatches(value, paths, expected)) {
    addViolation(
      violations,
      code,
      `${label} must equal ${JSON.stringify(expected)} at ${paths.join(" or ")}`,
    );
  }
}

function writeNewJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
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

function portFromEndpoint(endpoint: string, label = "CDP"): number {
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "http:") {
    throw new Error(`${label} endpoint must use plain loopback HTTP`);
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
    throw new Error(`${label} endpoint must be loopback-only`);
  }
  if (!parsed.port) throw new Error(`${label} endpoint must declare an explicit port`);
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`${label} endpoint port is invalid`);
  }
  return port;
}

function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function resolveFrameworkRuntimeIdentity(
  rawIdentity: JsonRecord,
  installedAppPath: string,
): JsonRecord {
  if (
    rawIdentity.authority_source !== "app_launcher_bound_framework_runtime_readback"
  ) {
    throw new Error(
      "compatibility.framework_runtime must come from the App launcher-bound Framework runtime readback",
    );
  }
  const executablePath = path.resolve(
    requiredString(rawIdentity.executable_path, "compatibility.framework_runtime.executable_path"),
  );
  const stat = fs.lstatSync(executablePath);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o111) === 0) {
    throw new Error(
      "compatibility Framework executable must be one executable regular non-symlink file",
    );
  }
  const realpath = fs.realpathSync(executablePath);
  if (realpath !== executablePath) {
    throw new Error("compatibility Framework executable path must already be its exact realpath");
  }
  const appBound = isPathWithin(fs.realpathSync(installedAppPath), realpath);
  if (
    !appBound &&
    (isPathWithin(os.homedir(), realpath) || isPathWithin(os.tmpdir(), realpath))
  ) {
    throw new Error(
      "compatibility Framework executable outside the installed App cannot come from a user or temporary directory",
    );
  }
  if (!appBound) {
    let current = realpath;
    while (current !== path.dirname(current)) {
      if ((fs.lstatSync(current).mode & 0o022) !== 0) {
        throw new Error(
          "compatibility Framework executable path cannot be group- or world-writable",
        );
      }
      current = path.dirname(current);
    }
  }
  const expectedSha256 = exactSha256(
    rawIdentity.executable_sha256,
    "compatibility.framework_runtime.executable_sha256",
  );
  if (sha256File(realpath) !== expectedSha256) {
    throw new Error(
      "compatibility Framework executable bytes do not match launcher-bound SHA-256",
    );
  }
  const bindingReceiptPath = path.resolve(
    requiredString(
      rawIdentity.binding_receipt,
      "compatibility.framework_runtime.binding_receipt",
    ),
  );
  const bindingStat = fs.lstatSync(bindingReceiptPath);
  if (!bindingStat.isFile() || bindingStat.isSymbolicLink()) {
    throw new Error(
      "compatibility Framework runtime binding receipt must be a regular non-symlink file",
    );
  }
  const bindingReceiptSha256 = exactSha256(
    rawIdentity.binding_receipt_sha256,
    "compatibility.framework_runtime.binding_receipt_sha256",
  );
  if (sha256File(bindingReceiptPath) !== bindingReceiptSha256) {
    throw new Error("compatibility Framework runtime binding receipt SHA-256 drifted");
  }
  const bindingReceipt = readJson(
    bindingReceiptPath,
    "App launcher Framework runtime binding receipt",
  );
  const frameworkVersion = requiredString(
    rawIdentity.framework_version,
    "compatibility.framework_runtime.framework_version",
  );
  const packageRef = requiredString(
    rawIdentity.package_ref,
    "compatibility.framework_runtime.package_ref",
  );
  if (
    bindingReceipt.schema !== "opl_app_launcher_framework_runtime_binding.v1" ||
    bindingReceipt.owner !== "one-person-lab-app" ||
    bindingReceipt.status !== "bound" ||
    path.resolve(String(bindingReceipt.installed_app_path)) !==
      fs.realpathSync(installedAppPath) ||
    path.resolve(String(bindingReceipt.executable_path)) !== realpath ||
    String(bindingReceipt.executable_sha256).replace(/^sha256:/, "") !==
      expectedSha256 ||
    bindingReceipt.framework_version !== frameworkVersion ||
    bindingReceipt.package_ref !== packageRef
  ) {
    throw new Error(
      "compatibility Framework runtime identity does not match the App launcher binding receipt",
    );
  }
  return {
    command_surface: "opl app compatibility receipt",
    executable_path: realpath,
    executable_sha256: expectedSha256,
    framework_version: frameworkVersion,
    package_ref: packageRef,
  };
}

export function resolveIsolatedProfileRealpath(profileRoot: string): string | null {
  try {
    const lstat = fs.lstatSync(profileRoot);
    if (!lstat.isDirectory() || lstat.isSymbolicLink()) return null;
    const realpath = fs.realpathSync(profileRoot);
    const protectedRoots = [
      path.join(os.homedir(), ".codex"),
      path.join(os.homedir(), "Library", "Application Support"),
    ];
    if (protectedRoots.some((root) => isPathWithin(root, realpath))) return null;
    return realpath;
  } catch {
    return null;
  }
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

function sha256WithoutPrefix(value: unknown): string {
  return requiredString(value, "SHA-256 digest")
    .replace(/^sha256:/, "")
    .toLowerCase();
}

function validateSourceLockReceipt(
  receipt: JsonRecord,
  classification: "diagnostic" | "immutable_stable",
  violations: Violation[],
): JsonRecord | null {
  const schema = receipt.schema;
  const expectedSchema =
    classification === "immutable_stable"
      ? "opl_app_release_cohort_lock.v1"
      : "opl_manual_latest_build_source_lock.v1";
  if (schema !== expectedSchema) {
    addViolation(
      violations,
      "source_lock_schema_mismatch",
      `${classification} acceptance requires ${expectedSchema}`,
    );
    return null;
  }
  const paths =
    schema === "opl_app_release_cohort_lock.v1"
      ? {
          app_sha: "app.resolved_sha",
          shell_sha: "shell.resolved_sha",
          framework_sha: "framework.resolved_sha",
        }
      : schema === "opl_manual_latest_build_source_lock.v1"
        ? {
            app_sha: "repositories.app.head",
            shell_sha: "repositories.shell.head",
            framework_sha: "repositories.framework.head",
          }
        : null;
  if (!paths) {
    addViolation(
      violations,
      "source_lock_schema_unsupported",
      `unsupported source-lock schema: ${String(schema)}`,
    );
    return null;
  }
  const provenance: JsonRecord = {
    source: "source_lock_receipt",
    role: "observational_build_provenance_only",
    may_gate_install_or_runtime: false,
  };
  for (const [field, fieldPath] of Object.entries(paths)) {
    const component = field.replace("_sha", "");
    const rawCommit = valueAtPath(receipt, fieldPath);
    if (component === "app") {
      try {
        provenance[component] = {
          commit: exactCommit(rawCommit, `source-lock ${field}`),
        };
      } catch (error) {
        addViolation(
          violations,
          "source_provenance_invalid",
          error instanceof Error ? error.message : String(error),
        );
      }
    } else if (typeof rawCommit === "string" && COMMIT_PATTERN.test(rawCommit)) {
      provenance[component] = { commit: rawCommit, observational: true };
    } else {
      provenance[component] = { commit: null, observational: true };
    }
  }
  if (!(provenance.app as JsonRecord | undefined)?.commit) {
      addViolation(
        violations,
        "source_provenance_invalid",
        "source-lock receipt must identify the App build provenance commit",
      );
  }
  return provenance;
}

function validatePublishedCarrierReceipt(
  receipt: JsonRecord,
  artifact: JsonRecord,
  violations: Violation[],
): void {
  if (
    receipt.schema !== "opl_app_stable_operation_published_carrier_binding.v1" ||
    receipt.status !== "published_immutable"
  ) {
    addViolation(
      violations,
      "public_release_receipt_schema_mismatch",
      "public release receipt must be one published immutable Stable carrier binding",
    );
    return;
  }
  requireExactPath(
    receipt,
    ["publication_target.tag"],
    artifact.release_tag,
    violations,
    "public_release_receipt_binding_mismatch",
    "public release tag",
  );
  const carrier = record(receipt.published_carrier, "published carrier");
  if (
    carrier.release_id !== artifact.release_id ||
    carrier.immutable !== true ||
    carrier.draft !== false
  ) {
    addViolation(
      violations,
      "public_release_receipt_binding_mismatch",
      "published carrier identity, immutable state, or draft state does not match",
    );
  }
  const assets = Array.isArray(carrier.assets)
    ? carrier.assets.map((entry) => record(entry, "published carrier asset"))
    : [];
  const matches = assets.filter(
    (entry) =>
      entry.name === artifact.asset_name &&
      sha256WithoutPrefix(entry.digest) === artifact.sha256 &&
      entry.size_bytes === artifact.size_bytes,
  );
  if (matches.length !== 1) {
    addViolation(
      violations,
      "public_release_receipt_binding_mismatch",
      "published carrier does not contain exactly one matching artifact name, digest, and size",
    );
  }
}

type BuildReceiptBinding = {
  kind: "standard" | "full" | "diagnostic";
  packagedTreeSha256: string | null;
  fullManifestSha256: string | null;
  componentProvenance: JsonRecord | null;
};

function validateBuildReceipt(
  receipt: JsonRecord,
  authority: {
    classification: "diagnostic" | "immutable_stable";
    artifact: JsonRecord;
    installed: JsonRecord;
    identity: JsonRecord;
  },
  violations: Violation[],
  run: NonNullable<PreflightDependencies["run"]>,
): BuildReceiptBinding {
  if (authority.classification === "immutable_stable") {
    if (receipt.schema !== "opl_app_build_artifact_cohort.v2") {
      addViolation(
        violations,
        "build_receipt_schema_mismatch",
        "immutable Stable requires opl_app_build_artifact_cohort.v2",
      );
      return {
        kind: "standard",
        packagedTreeSha256: null,
        fullManifestSha256: null,
        componentProvenance: null,
      };
    }
    const build = record(receipt.build, "build receipt build");
    const artifact = record(receipt.artifact, "build receipt artifact");
    const digests = record(receipt.digests, "build receipt digests");
    const buildProvenance = record(receipt.cohort, "build receipt provenance");
    const kind = build.kind === "full" ? "full" : "standard";
    if (build.kind !== "standard" && build.kind !== "full") {
      addViolation(violations, "build_receipt_binding_mismatch", "build kind is invalid");
    }
    const appCommit = exactCommit(buildProvenance.app_sha, "build receipt provenance.app_sha");
    const optionalBuildCommit = (value: unknown): string | null =>
      typeof value === "string" && COMMIT_PATTERN.test(value) ? value : null;
    const componentProvenance: JsonRecord = {
      source: "artifact_build_receipt",
      role: "observational_build_provenance_only",
      may_gate_install_or_runtime: false,
      app: { commit: appCommit },
      shell: {
        commit: optionalBuildCommit(buildProvenance.shell_sha),
        observational: true,
      },
      framework: {
        commit: optionalBuildCommit(buildProvenance.framework_sha),
        observational: true,
      },
    };
    if (
      build.version !== authority.identity.display_version ||
      artifact.name !== authority.artifact.asset_name ||
      artifact.sha256 !== authority.artifact.sha256 ||
      artifact.size_bytes !== authority.artifact.size_bytes
    ) {
      addViolation(
        violations,
        "build_receipt_binding_mismatch",
        "build version or artifact name, digest, and size does not match the acceptance authority",
      );
    }
    for (const [field, filePath] of [
      ["app_product_profile_sha256", "contracts/app-product-profile.json"],
      ["gui_product_contract_sha256", "contracts/app-gui-product-contract.json"],
    ] as const) {
      const cohortDigest = gitBlobSha256(
        run,
        String((componentProvenance.app as JsonRecord).commit),
        filePath,
        violations,
      );
      if (cohortDigest !== null && digests[field] !== cohortDigest) {
        addViolation(
          violations,
          "build_receipt_contract_digest_mismatch",
          `build receipt ${field} does not match its App build provenance`,
        );
      }
    }
    const packagedTreeSha256 = exactSha256(
      digests.packaged_tree_sha256,
      "build receipt packaged_tree_sha256",
    );
    const fullManifestSha256 =
      kind === "full"
        ? exactSha256(
            digests.full_package_manifest_sha256,
            "build receipt full_package_manifest_sha256",
          )
        : null;
    return { kind, packagedTreeSha256, fullManifestSha256, componentProvenance };
  }

  if (
    receipt.schema !== "opl_manual_latest_build_receipt.v1" ||
    receipt.status !== "completed" ||
    receipt.mode !== "local-app"
  ) {
    addViolation(
      violations,
      "build_receipt_schema_mismatch",
      "diagnostic acceptance requires one completed manual local-app build receipt",
    );
    return {
      kind: "diagnostic",
      packagedTreeSha256: null,
      fullManifestSha256: null,
      componentProvenance: null,
    };
  }
  requireExactPath(
    receipt,
    ["source_lock_sha256"],
    authority.artifact.source_lock_sha256,
    violations,
    "build_receipt_binding_mismatch",
    "manual build source_lock_sha256",
  );
  return {
    kind: "diagnostic",
    packagedTreeSha256: null,
    fullManifestSha256: null,
    componentProvenance: null,
  };
}

function validateManualInstallReceipt(
  receipt: JsonRecord,
  authority: {
    artifact: JsonRecord;
    installed: JsonRecord;
    identity: JsonRecord;
  },
  violations: Violation[],
): void {
  if (
    receipt.schema !== "opl_manual_local_app_installation.v1" ||
    receipt.status !== "completed" ||
    receipt.launched !== true
  ) {
    addViolation(
      violations,
      "install_receipt_schema_mismatch",
      "manual install receipt must be completed and launched",
    );
    return;
  }
  if (
    path.resolve(String(receipt.installed_app)) !==
      path.resolve(String(authority.installed.app_path)) ||
    !Array.isArray(receipt.launch_process_ids) ||
    !receipt.launch_process_ids.includes(authority.installed.pid)
  ) {
    addViolation(
      violations,
      "install_receipt_binding_mismatch",
      "manual install receipt does not bind the installed App path and live PID",
    );
  }
  const version = record(receipt.installed_version, "manual installed version");
  for (const [field, expected] of [
    ["bundle_id", authority.identity.bundle_id],
    ["display_version", authority.identity.display_version],
    ["public_updater_version", authority.identity.public_updater_version],
    ["bundle_version", authority.identity.machine_version],
    ["source_lock_sha256", authority.artifact.source_lock_sha256],
  ] as const) {
    if (version[field] !== expected) {
      addViolation(
        violations,
        "install_receipt_binding_mismatch",
        `manual installed_version.${field} does not match`,
      );
    }
  }
}

function parseAuthority(
  rawInput: unknown,
  baseDirectory: string,
): {
  classification: "diagnostic" | "immutable_stable";
  compatibilityProfileId: string;
  compatibilityReceiptOutput: string;
  compatibilityFrameworkRuntime: JsonRecord;
  artifact: JsonRecord;
  installed: JsonRecord;
  runtime: JsonRecord;
  profile: JsonRecord;
  identity: JsonRecord;
} {
  const input = record(rawInput, "installed GUI artifact authority");
  if (input.schema !== AUTHORITY_SCHEMA) {
    throw new Error(`authority schema must be ${AUTHORITY_SCHEMA}`);
  }
  const classification = requiredString(input.classification, "classification");
  if (!["diagnostic", "immutable_stable"].includes(classification)) {
    throw new Error("classification must be diagnostic or immutable_stable");
  }
  const normalizePath = (value: unknown, label: string) =>
    path.resolve(baseDirectory, requiredString(value, label));
  const compatibility = record(input.compatibility, "compatibility selector");
  if (
    Object.keys(compatibility).sort().join(",") !==
      "framework_runtime,profile_id,receipt_output" ||
    Object.hasOwn(compatibility, "status") ||
    Object.hasOwn(compatibility, "requirements") ||
    Object.hasOwn(compatibility, "observed_components") ||
    Object.hasOwn(compatibility, "failures")
  ) {
    throw new Error(
      "compatibility selector may contain only profile_id, receipt_output, and launcher-bound framework_runtime; inline compatibility claims are forbidden",
    );
  }
  const compatibilityProfileId = requiredString(
    compatibility.profile_id,
    "compatibility.profile_id",
  );
  const compatibilityReceiptOutput = normalizePath(
    compatibility.receipt_output,
    "compatibility.receipt_output",
  );
  const rawCompatibilityFrameworkRuntime = record(
    compatibility.framework_runtime,
    "compatibility.framework_runtime",
  );
  const artifact = record(input.artifact, "artifact");
  artifact.path = normalizePath(artifact.path, "artifact.path");
  artifact.sha256 = exactSha256(artifact.sha256, "artifact.sha256");
  artifact.owner_authority = requiredString(
    artifact.owner_authority,
    "artifact.owner_authority",
  );
  artifact.release_tag = requiredString(artifact.release_tag, "artifact.release_tag");
  artifact.asset_url = requiredString(artifact.asset_url, "artifact.asset_url");
  artifact.asset_name = requiredString(artifact.asset_name, "artifact.asset_name");
  artifact.size_bytes = positiveInteger(artifact.size_bytes, "artifact.size_bytes");
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
  if (artifact.install_receipt !== undefined || artifact.install_receipt_sha256 !== undefined) {
    artifact.install_receipt = normalizePath(artifact.install_receipt, "artifact.install_receipt");
    artifact.install_receipt_sha256 = exactSha256(
      artifact.install_receipt_sha256,
      "artifact.install_receipt_sha256",
    );
  }
  if (classification === "immutable_stable") {
    if (artifact.immutable !== true || artifact.public !== true) {
      throw new Error("immutable_stable requires immutable=true and public=true");
    }
    artifact.release_id = positiveInteger(artifact.release_id, "artifact.release_id");
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
  const compatibilityFrameworkRuntime = resolveFrameworkRuntimeIdentity(
    rawCompatibilityFrameworkRuntime,
    String(installed.app_path),
  );
  if (installed.full_manifest !== undefined || installed.full_manifest_sha256 !== undefined) {
    installed.full_manifest = normalizePath(installed.full_manifest, "installed.full_manifest");
    installed.full_manifest_sha256 = exactSha256(
      installed.full_manifest_sha256,
      "installed.full_manifest_sha256",
    );
  }
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
  portFromEndpoint(String(runtime.cdp_endpoint), "CDP");
  const aioncoreHealth = new URL(String(runtime.aioncore_health_url));
  const aioncoreRuntime = new URL(String(runtime.aioncore_runtime_url));
  const aioncoreHealthPort = portFromEndpoint(aioncoreHealth.toString(), "AionCore health");
  const aioncoreRuntimePort = portFromEndpoint(aioncoreRuntime.toString(), "AionCore runtime");
  if (
    aioncoreHealth.origin !== aioncoreRuntime.origin ||
    aioncoreHealthPort !== aioncoreRuntimePort
  ) {
    throw new Error("AionCore health and runtime endpoints must share one loopback origin");
  }
  if (runtime.aioncore_parent_pid !== installed.pid) {
    throw new Error("runtime.aioncore_parent_pid must equal installed.pid");
  }
  const profile = record(input.profile, "profile");
  if (profile.kind !== "isolated" || profile.user_profile_protected !== true) {
    throw new Error("profile.kind must be isolated and user_profile_protected must be true");
  }
  profile.root = normalizePath(profile.root, "profile.root");
  if (profile.receipt !== undefined || profile.receipt_sha256 !== undefined) {
    profile.receipt = normalizePath(profile.receipt, "profile.receipt");
    profile.receipt_sha256 = exactSha256(profile.receipt_sha256, "profile.receipt_sha256");
  }
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
    compatibilityProfileId,
    compatibilityReceiptOutput,
    compatibilityFrameworkRuntime,
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
  const inspectedAt = (dependencies.now ?? (() => new Date()))();

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
  const installReceiptActual = authority.artifact.install_receipt
    ? assertFileDigest(
        String(authority.artifact.install_receipt),
        String(authority.artifact.install_receipt_sha256),
        "install receipt",
        violations,
      )
    : null;
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
  const fullManifestActual = authority.installed.full_manifest
    ? assertFileDigest(
        String(authority.installed.full_manifest),
        String(authority.installed.full_manifest_sha256),
        "installed full manifest",
        violations,
      )
    : null;
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
  const profileReceiptActual = authority.profile.receipt
    ? assertFileDigest(
        String(authority.profile.receipt),
        String(authority.profile.receipt_sha256),
        "isolated profile receipt",
        violations,
      )
    : null;
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
  const profileRealpath = resolveIsolatedProfileRealpath(String(authority.profile.root));
  if (!profileRealpath) {
    addViolation(
      violations,
      "isolated_profile_root_unsafe",
      `isolated profile root must be one real, non-symlink directory outside protected user profiles: ${String(authority.profile.root)}`,
    );
  }

  let sourceProvenance: JsonRecord | null = null;
  if (sourceLockActual) {
    const sourceLock = readJson(String(authority.artifact.source_lock), "source-lock receipt");
    sourceProvenance = validateSourceLockReceipt(sourceLock, authority.classification, violations);
  }
  if (publicReleaseReceiptActual) {
    const publicReleaseReceipt = readJson(
      String(authority.artifact.public_release_receipt),
      "public release receipt",
    );
    validatePublishedCarrierReceipt(publicReleaseReceipt, authority.artifact, violations);
  }
  let buildBinding: BuildReceiptBinding = {
    kind: authority.classification === "immutable_stable" ? "standard" : "diagnostic",
    packagedTreeSha256: null,
    fullManifestSha256: null,
    componentProvenance: null,
  };
  if (buildReceiptActual) {
    const buildReceipt = readJson(String(authority.artifact.build_receipt), "build receipt");
    buildBinding = validateBuildReceipt(buildReceipt, authority, violations, run);
  }
  const sourceAndBuildProvenanceConsistent = !(
    sourceProvenance &&
    buildBinding.componentProvenance &&
    ["app", "shell", "framework"].some(
      (component) =>
        (sourceProvenance![component] as JsonRecord | undefined)?.commit !==
        (buildBinding.componentProvenance![component] as JsonRecord | undefined)?.commit,
    )
  );
  checks.build_provenance = {
    source_lock: sourceProvenance,
    build_receipt: buildBinding.componentProvenance,
    consistent: sourceAndBuildProvenanceConsistent,
    role: "observational_build_provenance_only",
    may_gate_install_or_runtime: false,
  };
  const componentProvenance = buildBinding.componentProvenance ?? sourceProvenance;
  let compatibilityReceipt: JsonRecord | null = null;
  let compatibilityOutputSha256: string | null = null;
  let compatibilityCommand: JsonRecord | null = null;
  let compatibilitySources: JsonRecord | null = null;
  const appCommit = (componentProvenance?.app as JsonRecord | undefined)?.commit;
  if (typeof appCommit !== "string" || !COMMIT_PATTERN.test(appCommit)) {
    addViolation(
      violations,
      "app_compatibility_contract_provenance_missing",
      "selected App artifact provenance does not identify the App contract commit",
    );
  } else {
    const compatibilityProfile = loadCompatibilityProfile(
      run,
      appCommit,
      authority.compatibilityProfileId,
      violations,
    );
    if (compatibilityProfile) {
      const selectedAppArtifact: JsonRecord = {
        owner_authority: authority.artifact.owner_authority,
        immutable_release_tag: authority.artifact.release_tag,
        asset_url: authority.artifact.asset_url,
        asset_name: authority.artifact.asset_name,
        byte_size: authority.artifact.size_bytes,
        sha256: authority.artifact.sha256,
      };
      if (authority.artifact.signature) {
        selectedAppArtifact.signature = authority.artifact.signature;
      }
      if (authority.artifact.notarization) {
        selectedAppArtifact.notarization = authority.artifact.notarization;
      }
      const frameworkCompatibility = requestFrameworkCompatibilityReceipt(
        run,
        compatibilityProfile,
        authority.compatibilityFrameworkRuntime,
        {
          selected_app_artifact: selectedAppArtifact,
          installed_app_asar: {
            path: authority.installed.app_asar,
            sha256: authority.installed.app_asar_sha256,
          },
          build_receipt: {
            path: authority.artifact.build_receipt,
            sha256: authority.artifact.build_receipt_sha256,
          },
        },
        authority.compatibilityReceiptOutput,
        inspectedAt,
        violations,
      );
      compatibilityReceipt = frameworkCompatibility.receipt;
      compatibilityOutputSha256 = frameworkCompatibility.outputSha256;
      compatibilityCommand = frameworkCompatibility.command;
      compatibilitySources = frameworkCompatibility.sources;
    }
  }
  checks.framework_compatibility = {
    profile_id: authority.compatibilityProfileId,
    producer_identity: authority.compatibilityFrameworkRuntime,
    command: compatibilityCommand,
    output_sha256: compatibilityOutputSha256,
    receipt_path: authority.compatibilityReceiptOutput,
    sources: compatibilitySources,
    receipt: compatibilityReceipt,
    source_and_build_provenance_consistent: sourceAndBuildProvenanceConsistent,
  };
  if (installReceiptActual) {
    const installReceipt = readJson(String(authority.artifact.install_receipt), "install receipt");
    if (authority.classification !== "diagnostic") {
      addViolation(
        violations,
        "install_receipt_classification_mismatch",
        "manual install receipts are diagnostic-only and cannot prove immutable Stable installation",
      );
    } else {
      validateManualInstallReceipt(installReceipt, authority, violations);
    }
  }
  let installedTreeSha256: string | null = null;
  if (
    buildBinding.packagedTreeSha256 &&
    fs.statSync(String(authority.installed.app_path), { throwIfNoEntry: false })?.isDirectory()
  ) {
    installedTreeSha256 = sha256Tree(String(authority.installed.app_path));
    if (installedTreeSha256 !== buildBinding.packagedTreeSha256) {
      addViolation(
        violations,
        "installed_app_tree_mismatch",
        "installed App tree does not match the exact packaged tree from the Stable build receipt",
      );
    }
  }
  checks.installed_tree_sha256 = installedTreeSha256;
  if (fullManifestActual) {
    if (buildBinding.kind !== "full" || fullManifestActual !== buildBinding.fullManifestSha256) {
      addViolation(
        violations,
        "full_manifest_identity_mismatch",
        "installed Full manifest does not match the Full build receipt",
      );
    }
  } else if (buildBinding.kind === "full") {
    addViolation(
      violations,
      "full_manifest_missing",
      "Full Stable acceptance requires the installed Full package manifest",
    );
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
  const cdpEndpoint = String(authority.runtime.cdp_endpoint);
  const cdpPort = portFromEndpoint(cdpEndpoint);
  const process = run("/bin/ps", ["-p", String(pid), "-o", "comm="]);
  const processStart = run("/bin/ps", ["-p", String(pid), "-o", "lstart="]);
  const processCommand = run("/bin/ps", ["-p", String(pid), "-ww", "-o", "command="]);
  checks.app_process = commandDiagnostic(process);
  checks.app_process_start = commandDiagnostic(processStart);
  checks.app_process_command = commandDiagnostic(processCommand);
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
  if (!commandPassed(processStart) || !processStart.stdout.trim()) {
    addViolation(
      violations,
      "pid_start_time_unavailable",
      `PID ${pid} start time could not be read`,
    );
  }
  const expectedProfileArgument = `--user-data-dir=${String(authority.profile.root)}`;
  const expectedCdpArgument = `--remote-debugging-port=${cdpPort}`;
  if (
    !commandPassed(processCommand) ||
    !hasExactProcessArgument(processCommand.stdout, expectedProfileArgument) ||
    !hasExactProcessArgument(processCommand.stdout, expectedCdpArgument)
  ) {
    addViolation(
      violations,
      "isolated_profile_process_binding_failed",
      `PID ${pid} must include ${expectedProfileArgument} and ${expectedCdpArgument}`,
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
  let cdpTargetId: string | null = null;
  let cdpTargetUrl: string | null = null;
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
    } else {
      cdpTargetId = requiredString(matchingTargets[0]!.id, "CDP target id");
      cdpTargetUrl = requiredString(matchingTargets[0]!.url, "CDP target url");
    }
  } catch (error) {
    addViolation(
      violations,
      "cdp_readback_failed",
      error instanceof Error ? error.message : String(error),
    );
  }

  const aioncorePid = Number(authority.runtime.aioncore_pid);
  const aioncorePort = portFromEndpoint(String(authority.runtime.aioncore_health_url), "AionCore");
  const aioncoreProcess = run("/bin/ps", ["-p", String(aioncorePid), "-o", "comm="]);
  const aioncoreParent = run("/bin/ps", ["-p", String(aioncorePid), "-o", "ppid="]);
  const aioncoreListener = run("/usr/sbin/lsof", [
    "-nP",
    "-a",
    "-p",
    String(aioncorePid),
    `-iTCP:${aioncorePort}`,
    "-sTCP:LISTEN",
  ]);
  checks.aioncore_process = commandDiagnostic(aioncoreProcess);
  checks.aioncore_parent = commandDiagnostic(aioncoreParent);
  checks.aioncore_listener = commandDiagnostic(aioncoreListener);
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
  if (!commandPassed(aioncoreListener)) {
    addViolation(
      violations,
      "aioncore_pid_listener_mismatch",
      `AionCore port ${aioncorePort} is not owned by PID ${aioncorePid}`,
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
    requireExactPath(
      manifest,
      ["version", "aioncore.version"],
      authority.runtime.aioncore_version,
      violations,
      "aioncore_manifest_version_mismatch",
      "AionCore manifest version",
    );
    requireExactPath(
      resources,
      ["schemaVersion", "schema_version"],
      2,
      violations,
      "aioncore_resources_schema_mismatch",
      "AionCore managed resources schema version",
    );
  }
  try {
    const health = await fetchJson(String(authority.runtime.aioncore_health_url));
    checks.aioncore_health = { status: health.status, value: health.value };
    if (
      health.status !== 200 ||
      !exactPathMatches(health.value, ["status", "health.status"], "ok")
    ) {
      addViolation(
        violations,
        "aioncore_health_mismatch",
        "AionCore health readback must return HTTP 200 with status=ok",
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
      ![
        String(authority.runtime.aioncore_version),
        String(authority.runtime.aioncore_version).replace(/^v/, ""),
      ].some((expected) =>
        exactPathMatches(
          runtime.value,
          ["runtime_version", "version", "runtime.version"],
          expected,
        ),
      )
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
    inspected_at: inspectedAt.toISOString(),
    classification: authority.classification,
    compatibility: {
      profile_id: authority.compatibilityProfileId,
      framework_receipt: compatibilityReceipt,
      framework_receipt_path: authority.compatibilityReceiptOutput,
      framework_receipt_output_sha256: compatibilityOutputSha256,
      framework_receipt_sources: compatibilitySources,
      authority: "framework_owner_receipt_only",
      app_generated_compatible_claim: false,
    },
    component_provenance: componentProvenance,
    artifact: authority.artifact,
    installed: authority.installed,
    runtime: {
      ...authority.runtime,
      pid: authority.installed.pid,
      executable_path: authority.installed.executable_path,
      app_process_started_at: processStart.stdout.trim(),
      app_process_command: processCommand.stdout.trim(),
      cdp_target_id: cdpTargetId,
      cdp_target_url: cdpTargetUrl,
    },
    profile: {
      ...authority.profile,
      realpath: profileRealpath,
    },
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
      artifact_identity_verified: status === "passed",
      component_compatibility_verified:
        status === "passed" &&
        compatibilityReceipt?.status === "compatible" &&
        compatibilityOutputSha256 !== null,
      pid_executable_bound: status === "passed" && commandPassed(process),
      cdp_pid_bound: status === "passed" && commandPassed(cdpListener),
      aioncore_runtime_bound:
        status === "passed" &&
        commandPassed(aioncoreProcess) &&
        commandPassed(aioncoreParent) &&
        commandPassed(aioncoreListener),
      isolated_profile_bound:
        status === "passed" &&
        profileRealpath !== null &&
        commandPassed(processCommand) &&
        hasExactProcessArgument(processCommand.stdout, expectedProfileArgument),
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
  if (options.output) writeNewJson(path.resolve(options.output), receipt);
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
            artifact_identity_verified: false,
            component_compatibility_verified: false,
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
