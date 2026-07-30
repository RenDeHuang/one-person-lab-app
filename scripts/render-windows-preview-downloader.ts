#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export type WindowsPreviewDownloaderIdentity = {
  repository: string;
  release_tag: string;
  installer_asset: string;
  installer_size_bytes: number;
  installer_sha256: string;
};

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const releaseTagPattern = /^windows-rc-([0-9]+\.[0-9]+\.[0-9]+-rc\.[1-9][0-9]*)$/;
const installerAssetPattern =
  /^One-Person-Lab-([0-9]+\.[0-9]+\.[0-9]+-rc\.[1-9][0-9]*)-win-x64\.exe$/;

function fileSha256(filePath: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

export function renderWindowsPreviewDownloader(input: {
  templatePath: string;
  outputPath: string;
  repository: string;
  releaseTag: string;
  installerPath: string;
}): WindowsPreviewDownloaderIdentity {
  const templatePath = path.resolve(input.templatePath);
  const outputPath = path.resolve(input.outputPath);
  const installerPath = path.resolve(input.installerPath);
  if (templatePath === outputPath) {
    throw new Error("Downloader template and output paths must differ.");
  }
  if (!repositoryPattern.test(input.repository)) {
    throw new Error("Windows Preview repository must be an owner/name pair.");
  }
  const releaseMatch = releaseTagPattern.exec(input.releaseTag);
  if (!releaseMatch) {
    throw new Error("Windows Preview release tag is invalid.");
  }
  const installerName = path.basename(installerPath);
  const installerMatch = installerAssetPattern.exec(installerName);
  if (!installerMatch) {
    throw new Error("Windows Preview installer name is invalid.");
  }
  if (releaseMatch[1] !== installerMatch[1]) {
    throw new Error("Windows Preview release tag and installer version disagree.");
  }
  const installerStat = fs.lstatSync(installerPath);
  if (!installerStat.isFile() || installerStat.isSymbolicLink() || installerStat.size <= 0) {
    throw new Error("Windows Preview installer must be a non-empty regular file.");
  }

  const identity: WindowsPreviewDownloaderIdentity = {
    repository: input.repository,
    release_tag: input.releaseTag,
    installer_asset: installerName,
    installer_size_bytes: installerStat.size,
    installer_sha256: fileSha256(installerPath),
  };
  const replacements = new Map<string, string>([
    ["__OPL_WINDOWS_PREVIEW_REPOSITORY__", identity.repository],
    ["__OPL_WINDOWS_PREVIEW_RELEASE_TAG__", identity.release_tag],
    ["__OPL_WINDOWS_PREVIEW_INSTALLER_ASSET__", identity.installer_asset],
    ["__OPL_WINDOWS_PREVIEW_INSTALLER_SIZE_BYTES__", String(identity.installer_size_bytes)],
    ["__OPL_WINDOWS_PREVIEW_INSTALLER_SHA256__", identity.installer_sha256],
  ]);

  let rendered = fs.readFileSync(templatePath, "utf8");
  for (const [placeholder, value] of replacements) {
    if (!rendered.includes(placeholder)) {
      throw new Error(`Downloader template is missing ${placeholder}.`);
    }
    rendered = rendered.replaceAll(placeholder, value);
  }
  const unresolved = rendered.match(/__OPL_WINDOWS_PREVIEW_[A-Z0-9_]+__/g);
  if (unresolved) {
    throw new Error(`Downloader template contains unresolved placeholders: ${unresolved.join(", ")}.`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered, "utf8");
  if (fs.readFileSync(outputPath, "utf8") !== rendered) {
    throw new Error("Rendered Windows Preview downloader readback does not match written bytes.");
  }
  if (
    fileSha256(installerPath) !== identity.installer_sha256 ||
    fs.lstatSync(installerPath).size !== identity.installer_size_bytes
  ) {
    throw new Error("Windows Preview installer changed during downloader rendering.");
  }
  return identity;
}

function main(): void {
  const { values } = parseArgs({
    options: {
      template: { type: "string" },
      output: { type: "string" },
      repository: { type: "string" },
      "release-tag": { type: "string" },
      installer: { type: "string" },
    },
    strict: true,
  });
  if (!values.template) throw new Error("Missing --template");
  if (!values.output) throw new Error("Missing --output");
  if (!values.repository) throw new Error("Missing --repository");
  if (!values["release-tag"]) throw new Error("Missing --release-tag");
  if (!values.installer) throw new Error("Missing --installer");
  const identity = renderWindowsPreviewDownloader({
    templatePath: values.template,
    outputPath: values.output,
    repository: values.repository,
    releaseTag: values["release-tag"],
    installerPath: values.installer,
  });
  process.stdout.write(`${JSON.stringify({ status: "rendered_and_verified", ...identity })}\n`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) main();
