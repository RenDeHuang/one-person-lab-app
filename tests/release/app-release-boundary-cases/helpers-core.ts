import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import test from "node:test";

export { assert, crypto, fs, os, path, spawnSync, deflateSync, test };
export { releaseWorkflowPaths } from "../../../scripts/validate-release-boundary/release-checks.ts";

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const require = createRequire(import.meta.url);
export const externalShellRoot = process.env.OPL_APP_SHELL_ROOT?.trim() ? path.resolve(appRoot, process.env.OPL_APP_SHELL_ROOT) : null;
export const activeShellRoot = externalShellRoot ?? path.join(appRoot, "shells", "aionui");

export function runNode(args, options = {}) {
  return spawnSync(process.execPath, ["--experimental-strip-types", ...args], {
    cwd: appRoot,
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

export function writeFile(filePath, content = "artifact") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function writeJsonFixture(tempRoot, relativePath, value, space) {
  writeFile(path.join(tempRoot, ...relativePath.split("/")), `${JSON.stringify(value, null, space)}\n`);
}

function writeJsonFixtures(tempRoot, fixtures, space) {
  for (const [relativePath, value] of fixtures) writeJsonFixture(tempRoot, relativePath, value, space);
}

export function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: "utf8", mode: 0o755 });
}

export function readFullPackageBuilderSource() {
  const partsRoot = path.join(appRoot, "scripts", "build-full-first-install-package");
  return [
    fs.readFileSync(
      path.join(appRoot, "scripts", "build-full-first-install-package.ts"),
      "utf8",
    ),
    ...fs
      .readdirSync(partsRoot)
      .filter((entry) => entry.endsWith(".ts"))
      .sort()
      .map((entry) => fs.readFileSync(path.join(partsRoot, entry), "utf8")),
  ].join("\n");
}

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function objectKeyPattern(value: string) {
  if (/^[A-Za-z_$][\w$]*$/.test(value)) {
    return escapedPattern(value);
  }
  return `'${escapedPattern(value)}'`;
}

function assertOptionSetters(buildScript, tableName, options, callbackPattern) {
  assert.match(buildScript, new RegExp(`const ${tableName} = \\{`));
  for (const option of options) {
    assert.match(
      buildScript,
      new RegExp(`${objectKeyPattern(option.replace(/^--/, ""))}: ${callbackPattern}`),
    );
  }
}

export function assertFullFirstInstallOptionTables(buildScript: string) {
  assert.match(buildScript, /import \{ parseArgs as parseNodeArgs \} from 'node:util';/);
  assertOptionSetters(buildScript, "booleanOptionSetters", [
    "--skip-gui-build", "--split-runtime", "--reuse-gui-vite-output", "--print-runtime-cache-keys", "--include-bun-runtime",
  ], "\\(parsed\\) =>");
  assertOptionSetters(buildScript, "valueOptionSetters", [
    "--version", "--out-dir", "--framework-root", "--opl-root", "--gui-root", "--mas-root", "--mag-root", "--rca-root", "--meta-agent-root",
    "--bookforge-root", "--superpowers-root", "--codex-root", "--node-bin", "--bun-bin", "--uv-bin", "--temporal-cli-bin", "--temporal-cli-archive",
    "--python-root", "--officecli-bin", "--officecli-root", "--mineru-open-api-bin", "--mineru-root", "--mineru-document-extractor-root",
    "--ui-ux-pro-max-root", "--runtime-cache-dir", "--runtime-cache-mode",
  ], "\\(parsed, value\\) =>");
  for (const pattern of [
    /const nodeOptionConfig = Object\.fromEntries\(\[/,
    /options: nodeOptionConfig/,
    /tokens: true/,
    /const applyBoolean = booleanOptionSetters\[token\.name\]/,
    /const applyValue = valueOptionSetters\[token\.name\]/,
    /throw new Error\(`Unknown argument: \$\{rawArgument\(token\)\}`\)/,
  ]) {
    assert.match(buildScript, pattern);
  }
}

export function writeBinaryFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

export function writeScreenshotPng(filePath, width = 640, height = 360) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * 4;
      raw[offset] = (x + y) % 256;
      raw[offset + 1] = (x * 3 + y) % 256;
      raw[offset + 2] = (x + y * 3) % 256;
      raw[offset + 3] = 255;
    }
  }
  writeBinaryFile(filePath, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]));
}

export function writeWebpVp8x(filePath, width, height, minimumSize = 4096) {
  const payload = Buffer.alloc(10);
  payload.writeUIntLE(width - 1, 4, 3);
  payload.writeUIntLE(height - 1, 7, 3);
  const chunkSize = Buffer.alloc(4);
  chunkSize.writeUInt32LE(payload.length);
  const chunk = Buffer.concat([Buffer.from("VP8X", "ascii"), chunkSize, payload]);
  const padding = Buffer.alloc(Math.max(0, minimumSize - 12 - chunk.length));
  const riffSize = Buffer.alloc(4);
  riffSize.writeUInt32LE(4 + chunk.length + padding.length);
  writeBinaryFile(filePath, Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    riffSize,
    Buffer.from("WEBP", "ascii"),
    chunk,
    padding,
  ]));
}

export function writeAssistantRouteSmokeScreenshots(tempRoot) {
  for (const assistantId of ["mas", "mag", "rca"]) {
    writeScreenshotPng(path.join(tempRoot, "artifacts", "assistant-route-smoke", `${assistantId}.png`));
  }
}

const canonicalAssistantRouteIds = ["med-autoscience", "med-autogrant", "redcube-ai"];
const canonicalAssistantShortNames = { "med-autoscience": "MAS", "med-autogrant": "MAG", "redcube-ai": "RCA" };

function appStateFixture(profile, stageAttemptCount, actions = []) {
  return {
    app_state: {
      schema: "opl_app_state.v1",
      profile,
      operator: { summary: { stage_attempt_count: stageAttemptCount }, ...(actions.length ? { actions } : {}) },
      provider: { temporal: { status: "ready" } },
    },
  };
}

function drilldownFixture(stageAttemptCount) {
  return {
    app_operator_drilldown: {
      surface_kind: "opl_app_operator_drilldown_read_model",
      detail_level: "full",
      summary: { stage_attempt_count: stageAttemptCount },
    },
  };
}

function actionExecutionFixture(actionId, dryRun) {
  return {
    app_action_execution: {
      surface_kind: "opl_app_action_execution.v1",
      action_id: actionId,
      dry_run: dryRun,
      result: { execution: { execution_status: dryRun ? "dry_run" : "executed" } },
      authority_boundary: { can_write_domain_truth: false },
    },
  };
}

export function writeRuntimeEvidenceJsonFiles(tempRoot) {
  const triggerAction = { action_id: "provider-scheduler:temporal:trigger" };
  const stageActionId = "stage-production-attempt:medautoscience:analysis-campaign";
  writeJsonFixtures(tempRoot, [
    ["app-state-summary.json", appStateFixture("fast", 1, [triggerAction])],
    ["app-state-full.json", appStateFixture("full", 1, [triggerAction])],
    ["drilldown-full.json", drilldownFixture(1)],
    ["action-dry-run-result.json", actionExecutionFixture(stageActionId, true)],
    ["action-execute-result.json", actionExecutionFixture(stageActionId, false)],
  ]);
}

export function writeCollectorFakeOpl(fakeOpl, actionLog = "", outputs = {}) {
  const responses = {
    "app state --profile fast --json": outputs.fast ?? appStateFixture("fast", 2),
    "app state --profile full --json": outputs.full ?? appStateFixture("full", 2),
    "runtime app-operator-drilldown --detail full --json": outputs.drilldown ?? drilldownFixture(2),
  };
  writeExecutable(fakeOpl, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const responses = ${JSON.stringify(responses, null, 2)};
${actionLog ? `fs.appendFileSync(${JSON.stringify(actionLog)}, JSON.stringify(args) + '\\n');` : ""}
const key = args.join(' ');
const routeResponse = responses[key];
if (routeResponse) {
  process.stdout.write(JSON.stringify(routeResponse) + '\\n');
  process.exit(0);
}
if (args.slice(0, 4).join(' ') === 'app action execute --action') {
  const dryRun = args.includes('--dry-run');
  const execution_status = dryRun ? 'dry_run' : 'executed';
  process.stdout.write(JSON.stringify({ app_action_execution: {
    surface_kind: 'opl_app_action_execution.v1',
    action_id: args[4],
    dry_run: dryRun,
    result: { execution: { execution_status } },
    authority_boundary: { can_write_domain_truth: false }
  } }) + '\\n');
  process.exit(0);
}
console.error('unexpected opl args: ' + key);
process.exit(2);
`);
}

export function writeVmSmokeSummaryFiles(tempRoot, runtimeProfile = "full") {
  const fullRuntime = runtimeProfile === "full";
  const settingsSmoke = { status: "passed", pages: ["general"] };
  const assistantRouteSmoke = { status: "passed", assistants: canonicalAssistantRouteIds };
  const codexFunctionalCheck = {
    schema: "opl_codex_functional_check_receipt.v1",
    status: "diagnostic_skipped",
    assistant_route_receipts_checked: { status: "passed", required: canonicalAssistantRouteIds, checked: canonicalAssistantRouteIds, deterministic: true },
    blocking_release_gate: { deterministic_fields_passed: true, llm_invocation_required: false },
  };
  const codexAiSelfCheck = {
    schema: "opl_codex_ai_self_check_receipt.v1", status: "skipped_missing_codex_config", mode: "diagnose", mutations_allowed: false, blocking_release_gate: false,
  };
  const guestSummary = {
    surface_id: "opl_packaged_gui_first_run_smoke",
    status: "passed",
    runtime_profile: runtimeProfile,
    gui_ready: { hasGuidInput: true, hasGuidSendButton: true },
    codex_config_wizard_seen: fullRuntime,
    codex_config_wizard_submitted: fullRuntime,
    settings_smoke: settingsSmoke,
    assistant_route_smoke: assistantRouteSmoke,
    codex_functional_check: codexFunctionalCheck,
    codex_ai_self_check: codexAiSelfCheck,
  };
  const assistantRouteSmokeSummary = {
    surface_id: "opl_packaged_gui_assistant_route_smoke",
    status: "passed",
    assistants: canonicalAssistantRouteIds.map((id) => {
      const shortName = canonicalAssistantShortNames[id];
      const badge = `@${shortName}`;
      return {
        id,
        badge,
        ready: { badge, selectors_hidden: true },
        receipt: {
          status: "passed",
          conversation_type: "acp",
          backend: "codex",
          route: { route_kind: "builtin_capability", executor: "codex_cli", assistant_id: id, assistant_short_name: shortName, source: "opl_app_home" },
        },
      };
    }),
  };
  writeJsonFixtures(tempRoot, [
    ["artifacts/smoke-summary.json", guestSummary],
    ["artifacts/codex-functional-check-summary.json", codexFunctionalCheck],
    ["artifacts/codex-ai-self-check-summary.json", codexAiSelfCheck],
    ["artifacts/assistant-route-smoke-summary.json", assistantRouteSmokeSummary],
    ["tart-smoke-summary.json", {
      surface_id: "opl_tart_gui_first_run_smoke",
      status: "passed",
      runtime_profile: runtimeProfile,
      require_codex_config_wizard: fullRuntime,
      settings_smoke: settingsSmoke,
      assistant_route_smoke: assistantRouteSmoke,
      codex_functional_check: codexFunctionalCheck,
      codex_ai_self_check: codexAiSelfCheck,
      guest_summary: guestSummary,
    }],
  ]);
}

export function writeTypedBlockerFile(tempRoot, artifactId, fields = {}) {
  writeJsonFixture(tempRoot, `typed-blockers/${artifactId}.json`, {
    artifact_id: artifactId,
    typed_blocker_ref: `typed_blocker_ref://one-person-lab-app/test/${artifactId}`,
    owner: "one-person-lab-app",
    blocker_kind: "release_evidence_producer_blocked",
    reason: `${artifactId} producer did not complete in this test environment`,
    evidence_refs: [`log_ref://one-person-lab-app/test/${artifactId}`],
    next_action: `rerun ${artifactId} producer with a reachable release environment`,
    ...fields,
  }, 2);
}

export function releaseEvidenceCohort(version = "26.6.5") {
  return {
    schema: "opl_app_release_evidence_cohort.v1",
    version,
    tag: `v${version}`,
    channel: /nightly/i.test(version) ? "nightly" : "stable",
    source: "test_fixture",
    current_cohort_evidence: true,
  };
}

export function remoteReleaseVerificationSummary(version = "26.6.5", fields = {}) {
  return {
    status: "passed",
    repo: "gaofeng21cn/one-person-lab-app",
    tag: `v${version}`,
    version,
    include_full_package: true,
    verified_asset_count: 10,
    full_first_install_budget: { status: "passed" },
    ...fields,
  };
}

export function writeRemoteReleaseVerificationSummary(
  tempRoot,
  version = "26.6.5",
  fields = {},
) {
  writeJsonFixture(tempRoot, "remote-release-verification.json", remoteReleaseVerificationSummary(version, fields));
}

export function dockerWebuiCleanVmEvidenceSummary(fields = {}) {
  const summaryForGate = (gateId, artifactName) => ({
    schema: "opl_docker_webui_clean_vm_evidence_validation.v1",
    gate_id: gateId,
    status: "passed",
    artifact_name: artifactName,
    result_path: `${gateId}/docker-webui-smoke-gate-result.json`,
    validation: { status: "passed" },
    observed_at: "2026-06-30T00:00:00.000Z",
    required_environment: gateId,
  });
  return {
    schema: "opl_docker_webui_clean_vm_evidence_validation.v1",
    status: "passed",
    required_gates: ["clean_linux_vm"],
    optional_gates: ["clean_windows_vm"],
    summaries: [
      summaryForGate("clean_linux_vm", "same_job_ubuntu_clean_vm_generated"),
      summaryForGate("clean_windows_vm", "windows-clean-evidence"),
    ],
    release_readiness_policy:
      "clean Linux Docker runtime evidence must validate as passed before release readiness aggregation; clean Windows VM evidence is optional diagnostic import.",
    ...fields,
  };
}

export function writeDockerWebuiCleanVmEvidenceSummary(tempRoot, fields = {}) {
  writeJsonFixture(tempRoot, "docker-webui-clean-vm-evidence-validation.json", dockerWebuiCleanVmEvidenceSummary(fields));
}

export function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function writeFakeMacosTrustCommands(binDir, options = {}) {
  const teamIdentifier = options.teamIdentifier ?? "TESTTEAMID";
  const signature = options.signature ?? "Developer ID Application: Test (TESTTEAMID)";
  writeExecutable(
    path.join(binDir, "codesign"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'if [ "$1" = "-dv" ]; then',
      `  echo ${JSON.stringify(`Signature=${signature}`)} >&2`,
      `  echo ${JSON.stringify(`TeamIdentifier=${teamIdentifier}`)} >&2`,
      "  exit 0",
      "fi",
      "exit 0",
      "",
    ].join("\n"),
  );
  writeExecutable(
    path.join(binDir, "spctl"),
    "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n",
  );
}

function readAppJson(...segments) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, ...segments), "utf8"));
}

export function readProductProfile() {
  return readAppJson("contracts", "app-product-profile.json");
}

export function readInstallExposurePolicy() {
  return readAppJson("contracts", "app-install-exposure-policy.json");
}

export function walkFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);
      return entry.isDirectory() ? walkFiles(entryPath) : entry.isFile() ? [entryPath] : [];
    });
}

export function matchCount(source, pattern) {
  return Array.from(source.matchAll(pattern)).length;
}
