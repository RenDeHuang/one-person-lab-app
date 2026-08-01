#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const timestampAuthorityUrl = "http://timestamp.apple.com/ts01";
const connectTimeoutSeconds = 10;
const requestTimeoutSeconds = 60;

type CommandResult = ReturnType<typeof spawnSync>;

class CommandFailure extends Error {
  command: string;
  status: number | null;
  errorCode: string | null;
  stdout: string;
  stderr: string;

  constructor(command: string, result: CommandResult) {
    const stdout = String(result.stdout || "");
    const stderr = String(result.stderr || "");
    super(
      [
        `Command failed: ${command}`,
        result.error?.message ? `error: ${result.error.message}` : "",
        stdout.trim() ? `stdout:\n${stdout.trim()}` : "",
        stderr.trim() ? `stderr:\n${stderr.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    this.command = command;
    this.status = result.status;
    this.errorCode = result.error?.code ?? null;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

function testMode(): boolean {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.OPL_TSA_DIAGNOSTIC_TEST_MODE === "true"
  );
}

function commandPath(name: string): string {
  if (testMode()) {
    const root = process.env.OPL_TSA_DIAGNOSTIC_TEST_COMMAND_ROOT?.trim() || "";
    if (!root)
      throw new Error(
        "OPL_TSA_DIAGNOSTIC_TEST_COMMAND_ROOT is required in test mode.",
      );
    return path.join(root, name);
  }
  if (name === "curl") return "/usr/bin/curl";
  if (name === "security") return "/usr/bin/security";
  const candidates = [
    "/opt/homebrew/bin/openssl",
    "/usr/local/opt/openssl@3/bin/openssl",
    "/usr/local/bin/openssl",
    "/usr/bin/openssl",
  ];
  const candidate = candidates.find((filePath) => fs.existsSync(filePath));
  if (!candidate)
    throw new Error(
      "No OpenSSL executable is available for RFC3161 verification.",
    );
  return candidate;
}

function runCapture(
  command: string,
  args: string[],
  timeoutMs = 10_000,
): CommandResult {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function run(
  command: string,
  args: string[],
  timeoutMs?: number,
): CommandResult {
  const result = runCapture(command, args, timeoutMs);
  if (result.status !== 0) throw new CommandFailure(command, result);
  return result;
}

function sha256(filePath: string): string {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
  fs.renameSync(temporaryPath, filePath);
}

function toolIdentity(filePath: string, versionArgs: string[]) {
  const realpath = fs.realpathSync(filePath);
  const stat = fs.statSync(realpath);
  if (!stat.isFile())
    throw new Error(`Tool is not a regular file: ${filePath}`);
  const version =
    run(filePath, versionArgs).stdout.toString().split(/\r?\n/, 1)[0]?.trim() ||
    "";
  if (!version) throw new Error(`Tool did not report a version: ${filePath}`);
  return {
    path: filePath,
    realpath,
    sha256: sha256(realpath),
    version,
  };
}

function classifyFailure(stage: string, error: unknown): string {
  if (stage === "resolve_tools") return "diagnostic_tool_unavailable";
  if (stage === "build_query") return "timestamp_query_generation_failed";
  if (stage === "request_timestamp" && error instanceof CommandFailure) {
    if (error.status === 6) return "timestamp_authority_dns_failed";
    if (error.status === 7) return "timestamp_authority_connection_failed";
    if (error.status === 22) return "timestamp_authority_http_failed";
    if (error.status === 28 || error.errorCode === "ETIMEDOUT")
      return "timestamp_authority_timeout";
    return "timestamp_authority_transport_failed";
  }
  if (stage === "parse_response") return "timestamp_response_parse_failed";
  if (stage === "verify_response")
    return "timestamp_response_verification_failed";
  return "timestamp_authority_diagnostic_failed";
}

function parseOptions() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { output: { type: "string" } },
    allowPositionals: false,
    strict: true,
  });
  if (!values.output) throw new Error("Pass --output <path>.");
  return { outputPath: path.resolve(values.output) };
}

export function diagnoseAppleTimestampAuthority() {
  if (process.platform !== "darwin" && !testMode()) {
    throw new Error(
      "Apple timestamp authority diagnostics require a macOS runner.",
    );
  }
  const options = parseOptions();
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "opl-apple-tsa-diagnostic-"),
  );
  const payloadPath = path.join(temporaryRoot, "payload.bin");
  const queryPath = path.join(temporaryRoot, "request.tsq");
  const responsePath = path.join(temporaryRoot, "response.tsr");
  const tokenPath = path.join(temporaryRoot, "response-token.p7s");
  const untrustedPath = path.join(temporaryRoot, "response-certificates.pem");
  const rootsPath = path.join(temporaryRoot, "system-roots.pem");
  let stage = "resolve_tools";
  const receipt: Record<string, any> = {
    schema: "opl_apple_timestamp_authority_diagnostic.v1",
    status: "failed",
    diagnostic_authority: "standalone_read_only",
    mutation_authorized: false,
    release_authority_used: false,
    production_credentials_used: false,
    developer_id_identity_used: false,
    notarization_submission_performed: false,
    endpoint: timestampAuthorityUrl,
    started_at: new Date().toISOString(),
    finished_at: null,
    runner: {
      platform: process.platform,
      arch: process.arch,
      github_actions: process.env.GITHUB_ACTIONS === "true",
      runner_name: process.env.RUNNER_NAME?.trim() || null,
      runner_os: process.env.RUNNER_OS?.trim() || null,
      runner_arch: process.env.RUNNER_ARCH?.trim() || null,
      image_os: process.env.ImageOS?.trim() || null,
      image_version: process.env.ImageVersion?.trim() || null,
      workflow_run_id: process.env.GITHUB_RUN_ID?.trim() || null,
      workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT?.trim() || null,
      source_sha: process.env.GITHUB_SHA?.trim() || null,
    },
    tools: null,
    request: null,
    response: null,
    verification: {
      openssl_reply_status: "not_run",
      query_response_binding: "not_run",
      signer_chain_to_system_root: "not_run",
    },
    failure: null,
  };
  const persist = () => writeJsonAtomic(options.outputPath, receipt);

  try {
    const openssl = commandPath("openssl");
    const curl = commandPath("curl");
    const security = commandPath("security");
    receipt.tools = {
      openssl: toolIdentity(openssl, ["version"]),
      curl: toolIdentity(curl, ["--version"]),
      security: toolIdentity(security, ["help"]),
    };

    stage = "build_query";
    fs.writeFileSync(payloadPath, crypto.randomBytes(32));
    run(openssl, [
      "ts",
      "-query",
      "-data",
      payloadPath,
      "-sha256",
      "-cert",
      "-out",
      queryPath,
    ]);
    receipt.request = {
      algorithm: "sha256",
      certificate_requested: true,
      query_sha256: sha256(queryPath),
      query_size_bytes: fs.statSync(queryPath).size,
    };

    stage = "request_timestamp";
    const writeOut =
      '{"http_code":%{http_code},"time_total_seconds":%{time_total},' +
      '"remote_ip":"%{remote_ip}","remote_port":%{remote_port},' +
      '"size_download":%{size_download},"url_effective":"%{url_effective}"}';
    const requested = run(
      curl,
      [
        "--silent",
        "--show-error",
        "--fail-with-body",
        "--location",
        "--max-redirs",
        "3",
        "--connect-timeout",
        String(connectTimeoutSeconds),
        "--max-time",
        String(requestTimeoutSeconds),
        "--retry",
        "0",
        "--header",
        "Content-Type: application/timestamp-query",
        "--data-binary",
        `@${queryPath}`,
        "--output",
        responsePath,
        "--write-out",
        writeOut,
        timestampAuthorityUrl,
      ],
      (requestTimeoutSeconds + 10) * 1_000,
    );
    const transport = JSON.parse(String(requested.stdout || "{}")) as Record<
      string,
      unknown
    >;
    if (transport.http_code !== 200) {
      throw new Error(
        `Timestamp authority returned HTTP ${String(transport.http_code)}.`,
      );
    }
    if (!fs.existsSync(responsePath) || fs.statSync(responsePath).size === 0) {
      throw new Error("Timestamp authority returned an empty response.");
    }
    receipt.response = {
      http_status: transport.http_code,
      duration_ms: Math.round(Number(transport.time_total_seconds) * 1_000),
      remote_ip: transport.remote_ip,
      remote_port: transport.remote_port,
      effective_url: transport.url_effective,
      response_sha256: sha256(responsePath),
      response_size_bytes: fs.statSync(responsePath).size,
      curl_size_download: transport.size_download,
    };

    stage = "parse_response";
    const reply = run(openssl, ["ts", "-reply", "-in", responsePath, "-text"]);
    const replyText = `${reply.stdout || ""}${reply.stderr || ""}`;
    if (!/^Status: Granted\.$/m.test(replyText)) {
      throw new Error("Timestamp authority response status is not Granted.");
    }
    receipt.verification.openssl_reply_status = "granted";
    run(openssl, [
      "ts",
      "-reply",
      "-in",
      responsePath,
      "-token_out",
      "-out",
      tokenPath,
    ]);
    run(openssl, [
      "pkcs7",
      "-inform",
      "DER",
      "-in",
      tokenPath,
      "-print_certs",
      "-out",
      untrustedPath,
    ]);

    stage = "verify_response";
    const roots = run(security, [
      "find-certificate",
      "-a",
      "-p",
      "/System/Library/Keychains/SystemRootCertificates.keychain",
    ]);
    fs.writeFileSync(rootsPath, roots.stdout);
    if (fs.statSync(rootsPath).size === 0)
      throw new Error("macOS system root export is empty.");
    const verified = run(openssl, [
      "ts",
      "-verify",
      "-queryfile",
      queryPath,
      "-in",
      responsePath,
      "-untrusted",
      untrustedPath,
      "-CAfile",
      rootsPath,
    ]);
    if (
      !/^Verification: OK$/m.test(
        `${verified.stdout || ""}${verified.stderr || ""}`,
      )
    ) {
      throw new Error(
        "OpenSSL did not confirm RFC3161 query/response verification.",
      );
    }
    receipt.verification.query_response_binding = "passed";
    receipt.verification.signer_chain_to_system_root = "passed";
    receipt.status = "passed";
    receipt.finished_at = new Date().toISOString();
    persist();
    return receipt;
  } catch (error) {
    receipt.status = "failed";
    receipt.finished_at = new Date().toISOString();
    receipt.failure = {
      code: classifyFailure(stage, error),
      stage,
      message: error instanceof Error ? error.message : String(error),
      retry_disposition: "diagnostic_only_no_release_retry",
    };
    persist();
    throw error;
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.stdout.write(
      `${JSON.stringify(diagnoseAppleTimestampAuthority(), null, 2)}\n`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
