#!/usr/bin/env node

import fs from "node:fs";
import { parseArgs } from "node:util";

type BuildArtifactCohort = {
  schema: "opl_app_build_artifact_cohort.v1";
  app_sha: string;
  shell_sha: string;
  framework_sha?: string;
  version: string;
};

const shaPattern = /^[0-9a-f]{40}$/i;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    "app-sha": { type: "string" },
    "shell-sha": { type: "string" },
    "framework-sha": { type: "string", default: "" },
    version: { type: "string", default: "" },
  },
  strict: true,
});

if (!values.manifest || !values["app-sha"] || !values["shell-sha"]) {
  fail(
    "Usage: validate-build-artifact-cohort.ts --manifest <path> --app-sha <sha> --shell-sha <sha> [--framework-sha <sha>] [--version <version>]",
  );
}

let manifest: BuildArtifactCohort;
try {
  manifest = JSON.parse(fs.readFileSync(values.manifest, "utf8")) as BuildArtifactCohort;
} catch (error) {
  fail(`Unable to read build artifact cohort manifest ${values.manifest}: ${String(error)}`);
}

if (manifest.schema !== "opl_app_build_artifact_cohort.v1") {
  fail(`Unsupported build artifact cohort schema: ${String(manifest.schema)}`);
}

for (const [name, value] of [
  ["manifest app_sha", manifest.app_sha],
  ["manifest shell_sha", manifest.shell_sha],
  ["expected app_sha", values["app-sha"]],
  ["expected shell_sha", values["shell-sha"]],
] as const) {
  if (!shaPattern.test(value)) fail(`${name} must be a 40-character Git SHA: ${value}`);
}
if (values["framework-sha"]) {
  if (!manifest.framework_sha) fail("manifest framework_sha is required when --framework-sha is provided");
  for (const [name, value] of [
    ["manifest framework_sha", manifest.framework_sha],
    ["expected framework_sha", values["framework-sha"]],
  ] as const) {
    if (!shaPattern.test(value)) fail(`${name} must be a 40-character Git SHA: ${value}`);
  }
}

const mismatches: string[] = [];
if (manifest.app_sha !== values["app-sha"]) {
  mismatches.push(
    `app_sha expected ${values["app-sha"]} but artifact contains ${manifest.app_sha}`,
  );
}
if (manifest.shell_sha !== values["shell-sha"]) {
  mismatches.push(
    `shell_sha expected ${values["shell-sha"]} but artifact contains ${manifest.shell_sha}`,
  );
}
if (values["framework-sha"] && manifest.framework_sha !== values["framework-sha"]) {
  mismatches.push(
    `framework_sha expected ${values["framework-sha"]} but artifact contains ${String(manifest.framework_sha)}`,
  );
}
if (values.version && manifest.version !== values.version) {
  mismatches.push(`version expected ${values.version} but artifact contains ${manifest.version}`);
}
if (mismatches.length > 0) {
  fail(`Build artifact cohort mismatch; refusing cross-cohort VM smoke: ${mismatches.join("; ")}`);
}

process.stdout.write(`${JSON.stringify({ status: "passed", manifest })}\n`);
