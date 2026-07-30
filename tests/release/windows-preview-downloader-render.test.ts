import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { renderWindowsPreviewDownloader } from "../../scripts/render-windows-preview-downloader.ts";
import { appRoot } from "./app-release-boundary-cases/helpers.ts";

test("Windows Preview downloader renderer binds exact public bytes without GitHub API", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opl-windows-preview-downloader-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const installer = path.join(root, "One-Person-Lab-26.7.30-rc.3-win-x64.exe");
  const output = path.join(root, "download-windows-preview.ps1");
  fs.writeFileSync(installer, "exact-rc3-installer-bytes");

  const identity = renderWindowsPreviewDownloader({
    templatePath: path.join(appRoot, "scripts", "download-windows-preview.ps1"),
    outputPath: output,
    repository: "gaofeng21cn/one-person-lab-app",
    releaseTag: "windows-rc-26.7.30-rc.3",
    installerPath: installer,
  });
  const rendered = fs.readFileSync(output, "utf8");
  const expectedSha256 = crypto.createHash("sha256").update(fs.readFileSync(installer)).digest("hex");

  assert.deepEqual(identity, {
    repository: "gaofeng21cn/one-person-lab-app",
    release_tag: "windows-rc-26.7.30-rc.3",
    installer_asset: "One-Person-Lab-26.7.30-rc.3-win-x64.exe",
    installer_size_bytes: fs.statSync(installer).size,
    installer_sha256: expectedSha256,
  });
  assert.match(rendered, /\[string\]\$ReleaseTag = "windows-rc-26\.7\.30-rc\.3"/);
  assert.match(rendered, /\[string\]\$AssetName = "One-Person-Lab-26\.7\.30-rc\.3-win-x64\.exe"/);
  assert.match(rendered, new RegExp(`\\$embeddedInstallerSha256 = "${expectedSha256}"`));
  assert.match(rendered, new RegExp(`\\$embeddedInstallerSizeBytes = ${fs.statSync(installer).size}`));
  assert.match(rendered, /https:\/\/github\.com\/\$repository\/releases\/download\/\$ReleaseTag/);
  assert.doesNotMatch(rendered, /__OPL_WINDOWS_PREVIEW_[A-Z0-9_]+__/);
  assert.doesNotMatch(rendered, /api\.github\.com|Invoke-RestMethod|Invoke-WebRequest/);
});

test("Windows Preview downloader renderer rejects a tag and installer version mismatch", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opl-windows-preview-downloader-mismatch-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const installer = path.join(root, "One-Person-Lab-26.7.30-rc.2-win-x64.exe");
  fs.writeFileSync(installer, "old-installer");

  assert.throws(
    () => renderWindowsPreviewDownloader({
      templatePath: path.join(appRoot, "scripts", "download-windows-preview.ps1"),
      outputPath: path.join(root, "download-windows-preview.ps1"),
      repository: "gaofeng21cn/one-person-lab-app",
      releaseTag: "windows-rc-26.7.30-rc.3",
      installerPath: installer,
    }),
    /release tag and installer version disagree/,
  );
});
