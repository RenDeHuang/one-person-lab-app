import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createGuideScriptHelpers } from "../../scripts/guide-script-helpers.ts";

const isWindows = process.platform === "win32";
const appRoot = process.env.OPL_APP_ROOT
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function powershellLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(
          new Error("Local BITS fixture server did not expose a TCP port."),
        );
        return;
      }
      resolve(address.port);
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function runPowerShell(
  executable: string,
  scriptPath: string,
): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      executable,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
      ],
      {
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test(
  "Windows PowerShell 5.1 parses the exact install-guide bootstrap",
  {
    skip: !isWindows,
    timeout: 30_000,
  },
  async (t) => {
    const powershell =
      process.env.PWSH ??
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(
          appRoot,
          "docs",
          "delivery",
          "user-guides",
          "windows-app-install",
          "source",
          "windows-app-install.quarto.json",
        ),
        "utf8",
      ),
    ) as { download: Record<string, string> };
    const source = fs.readFileSync(
      path.join(appRoot, "docs", "guides", "windows-app-install", "guide.qmd"),
      "utf8",
    );
    const expanded = createGuideScriptHelpers(appRoot).expandTemplate(
      source,
      {},
      manifest.download,
    );
    const bootstrap = /^```powershell\r?\n([\s\S]*?)^```/m.exec(expanded)?.[1];
    assert.ok(bootstrap, "install guide must contain a PowerShell bootstrap");

    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "opl-windows-guide-powershell51-"),
    );
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const bootstrapPath = path.join(root, "windows-install-bootstrap.ps1");
    const parserPath = path.join(root, "parse-windows-install-bootstrap.ps1");
    fs.writeFileSync(bootstrapPath, bootstrap, "utf8");
    fs.writeFileSync(
      parserPath,
      `$tokens = $null
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile(
  ${powershellLiteral(bootstrapPath)},
  [ref]$tokens,
  [ref]$errors
)
if ($errors.Count -ne 0) {
  $errors | ForEach-Object { Write-Error $_.Message }
  exit 1
}
Write-Output "OPL_WINDOWS_GUIDE_POWERSHELL51_PARSE_PASS"
`,
      "utf8",
    );

    const result = await runPowerShell(powershell, parserPath);
    assert.equal(
      result.code,
      0,
      `PowerShell parser failed:\n${result.stdout}\n${result.stderr}`,
    );
    assert.match(result.stdout, /OPL_WINDOWS_GUIDE_POWERSHELL51_PARSE_PASS/);
  },
);

test(
  "Windows PowerShell 5.1 follows the real BITS JobId contract",
  {
    skip: !isWindows,
    timeout: 120_000,
  },
  async (t) => {
    const powershell =
      process.env.PWSH ??
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "opl-windows-bits-jobid-"),
    );
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const body = Buffer.from("opl-bits-jobid-contract\n", "utf8");
    const server = http.createServer((request, response) => {
      response.setHeader("Accept-Ranges", "bytes");
      response.setHeader("Content-Type", "application/octet-stream");
      if (request.method === "HEAD") {
        response.writeHead(200, { "Content-Length": body.length });
        response.end();
        return;
      }
      const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? "");
      if (match) {
        const start = Number(match[1]);
        const requestedEnd = match[2] ? Number(match[2]) : body.length - 1;
        const end = Math.min(requestedEnd, body.length - 1);
        const chunk = body.subarray(start, end + 1);
        response.writeHead(206, {
          "Content-Length": chunk.length,
          "Content-Range": `bytes ${start}-${end}/${body.length}`,
        });
        response.end(chunk);
        return;
      }
      response.writeHead(200, { "Content-Length": body.length });
      response.end(body);
    });
    const port = await listen(server);
    t.after(async () => close(server));

    const template = fs
      .readFileSync(
        path.join(appRoot, "scripts", "download-windows-preview.ps1"),
        "utf8",
      )
      .replaceAll("__OPL_WINDOWS_PREVIEW_REPOSITORY__", "example/fixture")
      .replaceAll(
        "__OPL_WINDOWS_PREVIEW_RELEASE_TAG__",
        "windows-rc-1.0.0-rc.1",
      )
      .replaceAll(
        "__OPL_WINDOWS_PREVIEW_INSTALLER_ASSET__",
        "One-Person-Lab-1.0.0-rc.1-win-x64.exe",
      )
      .replaceAll("__OPL_WINDOWS_PREVIEW_INSTALLER_SIZE_BYTES__", "1")
      .replaceAll("__OPL_WINDOWS_PREVIEW_INSTALLER_SHA256__", "0".repeat(64));
    const mainBoundary = template.indexOf(
      "if ($PSVersionTable.PSVersion.Major -lt 5)",
    );
    assert.ok(
      mainBoundary > 0,
      "downloader template must retain its executable main boundary",
    );
    const destination = path.join(root, "bits-download.bin");
    const harnessPath = path.join(root, "bits-jobid-regression.ps1");
    const displayName = `OPL BITS JobId regression ${Date.now()}`;
    const harness = `${template.slice(0, mainBoundary)}
Import-Module BitsTransfer -ErrorAction Stop
$displayName = ${powershellLiteral(displayName)}
try {
  $pending = Get-BitsProgress -BitsJob ([pscustomobject]@{
    BytesTotal = [uint64]::MaxValue
    BytesTransferred = [uint64]0
    JobState = "Connecting"
  })
  if ($pending.TotalKnown -or $pending.Status -notmatch "total size pending") {
    throw "BITS unknown total size was not normalized."
  }
  Receive-BitsFile \`
    -Source ${powershellLiteral(`http://127.0.0.1:${port}/payload.bin`)} \`
    -Destination ${powershellLiteral(destination)} \`
    -DisplayName $displayName \`
    -Deadline (Get-Date).AddMinutes(1)
  $actual = [System.IO.File]::ReadAllText(${powershellLiteral(destination)})
  if ($actual -cne "opl-bits-jobid-contract\`n") {
    throw "BITS fixture bytes did not match."
  }
  Write-Output "OPL_BITS_JOBID_POWERSHELL51_PASS"
} finally {
  @(Get-BitsTransfer | Where-Object { $_.DisplayName -ceq $displayName }) |
    Remove-BitsTransfer -ErrorAction SilentlyContinue
}
`;
    fs.writeFileSync(harnessPath, harness, "utf8");

    const result = await runPowerShell(powershell, harnessPath);
    assert.equal(
      result.code,
      0,
      `PowerShell failed:\n${result.stdout}\n${result.stderr}`,
    );
    assert.match(result.stdout, /OPL_BITS_JOBID_POWERSHELL51_PASS/);
    assert.equal(fs.readFileSync(destination, "utf8"), body.toString("utf8"));
  },
);
