#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const gitShaPattern = /^[0-9a-f]{40}$/;
const versionPattern = /^\d+\.\d+\.\d+-rc\.[1-9]\d*$/;

type FileIdentity = {
  path: string;
  size_bytes: number;
  sha256: string;
};

export type WindowsRcBuildCohortV1 = {
  schema: "opl_windows_rc_build_cohort.v1";
  status: "sealed";
  release: {
    quality: "preview";
    display_version: string;
    latest_allowed: false;
    stable_updater_allowed: false;
    homebrew_allowed: false;
  };
  source: {
    app: { sha: string; tree: string };
    shell: { sha: string; tree: string };
    framework_sha: string | null;
  };
  target: {
    platform: "win32";
    arch: "x64";
    runtime_key: "linux-x64";
  };
  artifact: FileIdentity;
  packaged_tree: {
    path: string;
    file_count: number;
    size_bytes: number;
    sha256: string;
  };
  runtime: {
    execution_substrate: "dedicated_opl_linux_wsl2";
    wsl2_only_terminal_claim: true;
    native_windows_executor_fallback_allowed: false;
    distribution_product: FileIdentity;
    aioncore: FileIdentity;
    runtime_manifest: FileIdentity;
    managed_resources_manifest: FileIdentity;
    codex: FileIdentity;
  };
  actions: {
    run_id: string;
    run_attempt: string;
    artifact_name: string;
  };
};

function sha256File(filePath: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function relativeFileIdentity(root: string, filePath: string): FileIdentity {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`Expected a regular file: ${filePath}`);
  return {
    path: path.relative(root, filePath).split(path.sep).join("/"),
    size_bytes: stat.size,
    sha256: sha256File(filePath),
  };
}

function collectTreeFiles(root: string, relative = ""): FileIdentity[] {
  const directory = path.join(root, relative);
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const childRelative = path.join(relative, entry.name);
      const childPath = path.join(root, childRelative);
      if (entry.isSymbolicLink())
        throw new Error(
          `Packaged Windows tree must not contain symlinks: ${childPath}`,
        );
      if (entry.isDirectory()) return collectTreeFiles(root, childRelative);
      return [relativeFileIdentity(root, childPath)];
    });
}

function packagedTreeIdentity(root: string) {
  const stat = fs.statSync(root);
  if (!stat.isDirectory())
    throw new Error(`Packaged Windows tree is not a directory: ${root}`);
  const files = collectTreeFiles(root);
  if (files.length === 0) throw new Error("Packaged Windows tree is empty.");
  const serialized = files
    .map((entry) => `${entry.path}\t${entry.size_bytes}\t${entry.sha256}`)
    .join("\n");
  return {
    path: path.basename(root),
    file_count: files.length,
    size_bytes: files.reduce((sum, entry) => sum + entry.size_bytes, 0),
    sha256: crypto.createHash("sha256").update(`${serialized}\n`).digest("hex"),
  };
}

function exactSha(value: string, label: string): string {
  const normalized = value.trim().toLowerCase();
  if (!gitShaPattern.test(normalized))
    throw new Error(`${label} must be an exact 40-character Git SHA.`);
  return normalized;
}

function optionalExactSha(
  value: string | undefined,
  label: string,
): string | null {
  if (!value?.trim()) return null;
  return exactSha(value, label);
}

function exactFile(matches: string[], label: string): string {
  if (matches.length !== 1)
    throw new Error(`Expected exactly one ${label}, found ${matches.length}.`);
  return matches[0];
}

function findFiles(
  root: string,
  predicate: (relativePath: string) => boolean,
): string[] {
  return collectTreeFiles(root)
    .filter((entry) => predicate(entry.path))
    .map((entry) => path.join(root, ...entry.path.split("/")));
}

export function buildWindowsRcBuildCohort(input: {
  installerPath: string;
  packagedTreePath: string;
  appSha: string;
  appTree: string;
  shellSha: string;
  shellTree: string;
  frameworkSha?: string;
  version: string;
  platform: string;
  arch: string;
  actionsRunId: string;
  actionsRunAttempt: string;
  actionsArtifactName: string;
}): WindowsRcBuildCohortV1 {
  if (input.platform !== "win32")
    throw new Error("Windows RC cohort platform must be win32.");
  if (input.arch !== "x64")
    throw new Error("Windows RC cohort arch must be x64.");
  if (!versionPattern.test(input.version))
    throw new Error(
      "Windows RC display version must match <semver>-rc.<positive integer>.",
    );
  if (!/^[1-9]\d*$/.test(input.actionsRunId))
    throw new Error("GitHub Actions run id must be a positive integer.");
  if (!/^[1-9]\d*$/.test(input.actionsRunAttempt))
    throw new Error("GitHub Actions run attempt must be a positive integer.");
  if (!input.actionsArtifactName.trim())
    throw new Error("GitHub Actions artifact name is required.");

  const packagedTree = path.resolve(input.packagedTreePath);
  const runtimeKey = "linux-x64";
  const runtimeRoot = path.join(
    packagedTree,
    "resources",
    "bundled-aioncore",
    runtimeKey,
  );
  const nativeWindowsRuntimeRoot = path.join(
    packagedTree,
    "resources",
    "bundled-aioncore",
    "win32-x64",
  );
  const distributionProductPath = path.join(
    packagedTree,
    "resources",
    "opl-linux",
    "product.json",
  );
  const aioncorePath = path.join(runtimeRoot, "aioncore");
  const runtimeManifestPath = path.join(runtimeRoot, "manifest.json");
  const managedManifestPath = path.join(
    runtimeRoot,
    "managed-resources",
    "manifest.json",
  );
  const codexPackage = `@openai/codex-${runtimeKey}`;
  const codexPath = exactFile(
    findFiles(
      runtimeRoot,
      (relativePath) =>
        relativePath.includes(`/node_modules/${codexPackage}/vendor/`) &&
        relativePath.endsWith("/bin/codex"),
    ),
    `${codexPackage} binary`,
  );

  if (fs.existsSync(nativeWindowsRuntimeRoot)) {
    throw new Error(
      "Windows RC packaged tree must not contain a native win32-x64 AionCore runtime.",
    );
  }
  for (const required of [
    input.installerPath,
    distributionProductPath,
    aioncorePath,
    runtimeManifestPath,
    managedManifestPath,
    codexPath,
  ]) {
    if (!fs.existsSync(required))
      throw new Error(`Windows RC cohort input is missing: ${required}`);
  }
  const runtimeManifest = JSON.parse(
    fs.readFileSync(runtimeManifestPath, "utf8"),
  );
  if (runtimeManifest.platform !== "linux" || runtimeManifest.arch !== "x64") {
    throw new Error(
      "Bundled AionCore manifest must identify the Linux x64 WSL2 executor.",
    );
  }
  const frameworkSha = optionalExactSha(input.frameworkSha, "Framework SHA");
  if (!frameworkSha)
    throw new Error("Windows RC cohort requires an exact Framework SHA.");
  const distributionProduct = JSON.parse(
    fs.readFileSync(distributionProductPath, "utf8"),
  );
  if (
    distributionProduct.framework_ref !== frameworkSha ||
    distributionProduct.framework_install_script_url !==
      `https://raw.githubusercontent.com/gaofeng21cn/one-person-lab/${frameworkSha}/install.sh` ||
    distributionProduct.framework_source_archive_url !==
      `https://github.com/gaofeng21cn/one-person-lab/archive/${frameworkSha}.tar.gz`
  ) {
    throw new Error(
      "OPL Linux product manifest does not bind the exact Framework source cohort.",
    );
  }
  const managedManifest = JSON.parse(
    fs.readFileSync(managedManifestPath, "utf8"),
  );
  const codexTools = Array.isArray(managedManifest.acpTools)
    ? managedManifest.acpTools.filter(
        (tool: { slug?: string }) => tool?.slug === "codex-acp",
      )
    : [];
  if (codexTools.length !== 1)
    throw new Error(
      "Managed resources must contain exactly one codex-acp tool.",
    );

  return {
    schema: "opl_windows_rc_build_cohort.v1",
    status: "sealed",
    release: {
      quality: "preview",
      display_version: input.version,
      latest_allowed: false,
      stable_updater_allowed: false,
      homebrew_allowed: false,
    },
    source: {
      app: {
        sha: exactSha(input.appSha, "App SHA"),
        tree: exactSha(input.appTree, "App tree"),
      },
      shell: {
        sha: exactSha(input.shellSha, "Shell SHA"),
        tree: exactSha(input.shellTree, "Shell tree"),
      },
      framework_sha: frameworkSha,
    },
    target: {
      platform: "win32",
      arch: input.arch,
      runtime_key: runtimeKey,
    },
    artifact: relativeFileIdentity(
      path.dirname(input.installerPath),
      input.installerPath,
    ),
    packaged_tree: packagedTreeIdentity(packagedTree),
    runtime: {
      execution_substrate: "dedicated_opl_linux_wsl2",
      wsl2_only_terminal_claim: true,
      native_windows_executor_fallback_allowed: false,
      distribution_product: relativeFileIdentity(
        packagedTree,
        distributionProductPath,
      ),
      aioncore: relativeFileIdentity(packagedTree, aioncorePath),
      runtime_manifest: relativeFileIdentity(packagedTree, runtimeManifestPath),
      managed_resources_manifest: relativeFileIdentity(
        packagedTree,
        managedManifestPath,
      ),
      codex: relativeFileIdentity(packagedTree, codexPath),
    },
    actions: {
      run_id: input.actionsRunId,
      run_attempt: input.actionsRunAttempt,
      artifact_name: input.actionsArtifactName,
    },
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      output: { type: "string" },
      installer: { type: "string" },
      "packaged-tree": { type: "string" },
      "app-sha": { type: "string" },
      "app-tree": { type: "string" },
      "shell-sha": { type: "string" },
      "shell-tree": { type: "string" },
      "framework-sha": { type: "string", default: "" },
      version: { type: "string" },
      platform: { type: "string" },
      arch: { type: "string" },
      "actions-run-id": { type: "string" },
      "actions-run-attempt": { type: "string", default: "1" },
      "actions-artifact-name": { type: "string" },
    },
    strict: true,
  });
  for (const key of [
    "output",
    "installer",
    "packaged-tree",
    "app-sha",
    "app-tree",
    "shell-sha",
    "shell-tree",
    "version",
    "platform",
    "arch",
    "actions-run-id",
    "actions-artifact-name",
  ] as const) {
    if (!values[key]) throw new Error(`Missing --${key}`);
  }
  const cohort = buildWindowsRcBuildCohort({
    installerPath: values.installer!,
    packagedTreePath: values["packaged-tree"]!,
    appSha: values["app-sha"]!,
    appTree: values["app-tree"]!,
    shellSha: values["shell-sha"]!,
    shellTree: values["shell-tree"]!,
    frameworkSha: values["framework-sha"],
    version: values.version!,
    platform: values.platform!,
    arch: values.arch!,
    actionsRunId: values["actions-run-id"]!,
    actionsRunAttempt: values["actions-run-attempt"]!,
    actionsArtifactName: values["actions-artifact-name"]!,
  });
  fs.writeFileSync(
    values.output!,
    `${JSON.stringify(cohort, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(
    `${JSON.stringify({ status: "written", output: values.output, cohort })}\n`,
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) main();
