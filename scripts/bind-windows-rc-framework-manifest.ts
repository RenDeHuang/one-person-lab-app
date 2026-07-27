#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const gitShaPattern = /^[0-9a-f]{40}$/;

export function bindWindowsRcFrameworkManifest(
  manifestPath: string,
  frameworkRef: string,
): Record<string, unknown> {
  const normalizedRef = frameworkRef.trim().toLowerCase();
  if (!gitShaPattern.test(normalizedRef)) {
    throw new Error(
      "Windows RC Framework ref must be an exact 40-character Git SHA.",
    );
  }

  const absolutePath = path.resolve(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as Record<
    string,
    unknown
  >;
  if (!manifest || Array.isArray(manifest) || typeof manifest !== "object") {
    throw new Error("OPL Linux product manifest must be a JSON object.");
  }

  const bound = {
    ...manifest,
    framework_ref: normalizedRef,
    framework_install_script_url: `https://raw.githubusercontent.com/gaofeng21cn/one-person-lab/${normalizedRef}/install.sh`,
    framework_source_archive_url: `https://github.com/gaofeng21cn/one-person-lab/archive/${normalizedRef}.tar.gz`,
  };
  fs.writeFileSync(
    absolutePath,
    `${JSON.stringify(bound, null, 2)}\n`,
    "utf8",
  );
  return bound;
}

export function isMainModule(moduleUrl: string, entryUrl: URL): boolean {
  return moduleUrl === entryUrl.href;
}

function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: "string" },
      "framework-ref": { type: "string" },
    },
    strict: true,
  });
  if (!values.manifest || !values["framework-ref"]) {
    throw new Error("Both --manifest and --framework-ref are required.");
  }

  const bound = bindWindowsRcFrameworkManifest(
    values.manifest,
    values["framework-ref"],
  );
  process.stdout.write(
    `${JSON.stringify({
      status: "bound",
      manifest: path.resolve(values.manifest),
      framework_ref: bound.framework_ref,
    })}\n`,
  );
}

if (isMainModule(import.meta.url, pathToFileURL(process.argv[1] ?? ""))) {
  main();
}
