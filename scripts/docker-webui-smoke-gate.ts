#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { inflateRawSync } from 'node:zlib';
import { validateDockerWebuiDiagnostics } from './validate-docker-webui-diagnostics.ts';

type ImageIdentity = ReturnType<typeof validateDockerWebuiDiagnostics>['image_identity'];

type GateId = 'clean_linux_vm' | 'clean_windows_vm' | 'existing_docker' | 'existing_old_onepersonlab_data_dir';

type GateResult = {
  schema: 'opl_docker_webui_smoke_gate_result.v1';
  gate: GateId;
  gate_id: GateId;
  status: 'passed' | 'typed_blocker' | 'failed';
  typed_blocker: GateResultBlocker | null;
  observed_at: string;
  host_platform: NodeJS.Platform;
  required_environment: string;
  artifact_dir: string;
  diagnostics_dir: string;
  diagnostics_validation?: ReturnType<typeof validateDockerWebuiDiagnostics>;
  evidence_validation?: {
    status: 'passed' | 'failed';
    evidence_dir: string;
    manifest_path: string;
    errors: string[];
    forbidden_secret_markers: string[];
  };
  blocker?: GateResultBlocker;
  health: { url: string; status: 'passed' | 'failed' | 'not_run'; http_status: number | null };
  compose: { path: string; status: 'present' | 'missing' | 'not_run' };
  container: { name: string; status: string; id: string | null };
  image: {
    ref: string;
    status: 'present' | 'missing' | 'not_run';
    id: string | null;
    repo_digests: string[];
    digest: string | null;
    remote_ref: string | null;
    remote_digest: string | null;
    currentness_status: 'not_checked' | 'current' | 'update_available' | 'unknown';
    currentness_evidence_source: string | null;
    currentness_claim: false;
  };
  data_preservation: { status: 'passed' | 'failed' | 'not_run'; verdict: string | null; summary: string };
  api_key_flow: {
    status: 'passed' | 'failed' | 'not_run';
    mode: 'webui_proxy_configure_codex' | 'imported_evidence' | 'not_run';
    endpoint: string | null;
    command: string | null;
    stdin_transport: boolean;
    receipt_path: string | null;
    errors: string[];
  };
  ordinary_user_status: OrdinaryUserStatus;
  secret_scan: { status: 'passed' | 'failed' | 'not_run'; forbidden_secret_markers: string[] };
  commands: Array<{ command: string; status: number | null; stdout_path: string; stderr_path: string }>;
  evidence: Record<string, string>;
};

type OrdinaryUserStatus = {
  path_id: 'ordinary_docker_webui_user_path';
  priority: 'ordinary_user_path_before_evidence_bundle_language';
  one_click_install: OrdinaryStatusRow;
  browser_webui: OrdinaryStatusRow;
  access_key_settings: OrdinaryStatusRow;
  runtime_proxy: OrdinaryStatusRow;
  startup_recovery: OrdinaryStatusRow;
  data_preservation: OrdinaryStatusRow;
  host_update: OrdinaryStatusRow;
  image_seed_selection: string;
  settings_entry: 'Settings -> Access';
  must_not_claim: string[];
};

type OrdinaryStatusRow = {
  status: 'passed' | 'typed_blocker' | 'failed' | 'not_run';
  summary: string;
  next_action: string | null;
  evidence_ref: string | null;
};

type GateResultBlocker = {
  code: string;
  owner: string;
  message: string;
  required_next_action: string;
};

type GateResultValidation = {
  status: 'passed' | 'failed';
  missing_fields: string[];
  invalid_fields: string[];
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultSchema = 'opl_docker_webui_smoke_gate_result.v1';
const windowsEvidenceManifestName = 'windows-smoke-evidence.json';
const windowsEvidenceSchema = 'opl_docker_webui_windows_smoke_evidence.v1';
const apiKeyFlowEvidenceSchema = 'opl_docker_webui_api_key_flow_evidence.v1';
const apiKeyFlowRequestTimeoutMs = 10_000;
const apiKeyFlowRetryIntervalMs = 2_000;
const apiKeyFlowMaxWaitMs = 120_000;
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /OPENAI_API_KEY\s*[:=]\s*[^ \n\r]+/gi,
  /ANTHROPIC_API_KEY\s*[:=]\s*[^ \n\r]+/gi,
  /OPL_WEBUI_PASSWORD\s*[:=]\s*[^ \n\r]+/gi,
  /OPL_GATEWAY_API_KEY\s*[:=]\s*[^ \n\r]+/gi,
  /GFLABTOKEN\s*[:=]\s*[^ \n\r]+/gi,
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
];
const requiredResultFields = [
  'schema',
  'gate',
  'gate_id',
  'status',
  'typed_blocker',
  'observed_at',
  'host_platform',
  'required_environment',
  'artifact_dir',
  'diagnostics_dir',
  'diagnostics_validation',
  'health',
  'compose',
  'container',
  'image',
  'data_preservation',
  'api_key_flow',
  'ordinary_user_status',
  'secret_scan',
  'commands',
  'evidence',
];

const ordinaryStatusRows = [
  'one_click_install',
  'browser_webui',
  'access_key_settings',
  'runtime_proxy',
  'startup_recovery',
  'data_preservation',
  'host_update',
] as const;
const expectedImageSeedSelection = 'Default stable image must use the WebUI full seed; --tag/--image are explicit advanced overrides.';

const ordinaryMustNotClaim = [
  'desktop_release_ready',
  'real_install_ready',
  'clean_windows_vm_pass_without_clean_windows_evidence',
  'release_ready',
] as const;
const imageCurrentnessStatuses = ['not_checked', 'current', 'update_available', 'unknown'] as const;

function emptyDiagnosticsValidation(diagnosticsDir: string, missingFiles = ['diagnostics not run']) {
  return {
    status: 'failed' as const,
    diagnostics_dir: diagnosticsDir,
    checked_files: [],
    missing_files: missingFiles,
    invalid_evidence: [],
    forbidden_secret_markers: [],
    secret_scan: {
      status: 'passed' as const,
      forbidden_secret_markers: [],
    },
    preservation_verdict: null,
    compose_volume_mapping: {
      status: 'failed' as const,
      required_mounts: ['host_data_dir -> /data', 'host_projects_dir -> /projects'],
      missing_mounts: ['host_data_dir -> /data', 'host_projects_dir -> /projects'],
    },
    preservation_evidence: {
      status: 'failed' as const,
      required_sections: [
        'pre_data_inventory',
        'post_data_inventory',
        'pre_projects_inventory',
        'post_projects_inventory',
      ],
      missing_sections: [
        'pre_data_inventory',
        'post_data_inventory',
        'pre_projects_inventory',
        'post_projects_inventory',
      ],
    },
    image_identity: {
      status: 'failed' as const,
      image_id: null,
      repo_digests: [],
      digest: null,
      remote_ref: null,
      remote_digest: null,
      currentness_status: 'not_checked' as const,
      currentness_evidence_source: null,
      currentness_claim: false as const,
    },
  };
}

function parseArgs(argv: string[]) {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      gate: { type: 'string' },
      artifacts: { type: 'string' },
      evidence: { type: 'string' },
      'validate-result': { type: 'string' },
      image: { type: 'string' },
      port: { type: 'string' },
      'health-timeout': { type: 'string' },
      open: { type: 'boolean' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    } as const,
    allowPositionals: false,
    strict: true,
  });
  if (values.help) {
    printUsage();
    process.exit(0);
  }
  const options = {
    gate: (values.gate ?? '') as GateId | '',
    artifacts: values.artifacts ?? '',
    evidence: values.evidence ?? '',
    validateResult: values['validate-result'] ?? '',
    image: values.image ?? 'ghcr.io/gaofeng21cn/one-person-lab-webui:stable',
    port: values.port === undefined ? 3000 : Number(values.port),
    healthTimeout: values['health-timeout'] === undefined ? 120 : Number(values['health-timeout']),
    noOpen: values.open !== true,
    json: values.json === true,
  };
  if (options.validateResult) {
    return options as typeof options & { gate: GateId | '' };
  }
  if (!['clean_linux_vm', 'clean_windows_vm', 'existing_docker', 'existing_old_onepersonlab_data_dir'].includes(options.gate)) {
    throw new Error('Missing or invalid --gate');
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error('Invalid --port');
  }
  if (!Number.isInteger(options.healthTimeout) || options.healthTimeout < 1) {
    throw new Error('Invalid --health-timeout');
  }
  if (!options.artifacts) {
    options.artifacts = path.join(appRoot, 'tmp', 'docker-webui-smoke-gates', options.gate);
  }
  if (options.evidence && options.gate !== 'clean_windows_vm') {
    throw new Error('--evidence is currently supported only for --gate clean_windows_vm');
  }
  return options as typeof options & { gate: GateId };
}

function printUsage() {
  console.log(`Usage:
  node --experimental-strip-types scripts/docker-webui-smoke-gate.ts --gate <clean_linux_vm|clean_windows_vm|existing_docker|existing_old_onepersonlab_data_dir> [--artifacts <dir>] [--evidence <dir>] [--image <ref>] [--port <port>] [--json]
  node --experimental-strip-types scripts/docker-webui-smoke-gate.ts --validate-result <docker-webui-smoke-gate-result.json> [--json]

Runs a Docker/WebUI smoke gate when the current host matches the gate. If the current host cannot prove the gate, writes a typed blocker instead of passing.

For clean_windows_vm, --evidence <dir-or-zip> imports a Windows VM artifact set with ${windowsEvidenceManifestName} and diagnostics/.`);
}

function makeResult(gate: GateId, artifactDir: string): GateResult {
  const diagnosticsDir = path.join(artifactDir, 'diagnostics');
  return {
    schema: resultSchema,
    gate,
    gate_id: gate,
    status: 'failed',
    typed_blocker: null,
    observed_at: new Date().toISOString(),
    host_platform: process.platform,
    required_environment: requiredEnvironment(gate),
    artifact_dir: artifactDir,
    diagnostics_dir: diagnosticsDir,
    health: {
      url: `http://localhost:3000/`,
      status: 'not_run',
      http_status: null,
    },
    compose: {
      path: '',
      status: 'not_run',
    },
    container: {
      name: 'one-person-lab-webui',
      status: 'not_run',
      id: null,
    },
    image: {
      ref: '',
      status: 'not_run',
      id: null,
      repo_digests: [],
      digest: null,
      remote_ref: null,
      remote_digest: null,
      currentness_status: 'not_checked',
      currentness_evidence_source: null,
      currentness_claim: false,
    },
    data_preservation: {
      status: 'not_run',
      verdict: null,
      summary: 'data preservation diagnostics were not run',
    },
    api_key_flow: {
      status: 'not_run',
      mode: 'not_run',
      endpoint: null,
      command: null,
      stdin_transport: false,
      receipt_path: null,
      errors: [],
    },
    ordinary_user_status: makeOrdinaryUserStatus({
      healthUrl: `http://localhost:3000/`,
      composePath: null,
      diagnosticsDir,
      apiKeyReceiptPath: null,
      dataEvidencePath: null,
    }),
    secret_scan: {
      status: 'not_run',
      forbidden_secret_markers: [],
    },
    commands: [],
    evidence: {},
  };
}

function makeOrdinaryUserStatus(input: {
  healthUrl: string;
  composePath: string | null;
  diagnosticsDir: string | null;
  apiKeyReceiptPath: string | null;
  dataEvidencePath: string | null;
  result?: GateResult;
}): OrdinaryUserStatus {
  const result = input.result;
  const oneClickStatus = result
    ? result.status === 'typed_blocker'
      ? 'typed_blocker'
      : result.compose.status === 'present' && result.image.status === 'present'
        ? 'passed'
        : result.status === 'failed'
          ? 'failed'
          : 'not_run'
    : 'not_run';
  const browserStatus = result
    ? result.health.status === 'passed'
      ? 'passed'
      : result.status === 'typed_blocker'
        ? 'typed_blocker'
        : result.health.status === 'failed'
          ? 'failed'
          : 'not_run'
    : 'not_run';
  const accessStatus = result
    ? result.api_key_flow.status === 'passed'
      ? 'passed'
      : result.status === 'typed_blocker'
        ? 'typed_blocker'
        : result.api_key_flow.status === 'failed'
          ? 'failed'
          : 'not_run'
    : 'not_run';
  const recoveryStatus = result
    ? result.status === 'typed_blocker'
      ? 'typed_blocker'
      : result.diagnostics_validation?.status === 'passed'
        ? 'passed'
        : result.diagnostics_validation?.status === 'failed'
          ? 'failed'
          : 'not_run'
    : 'not_run';
  const dataStatus = result
    ? result.data_preservation.status === 'passed'
      ? 'passed'
      : result.status === 'typed_blocker'
        ? 'typed_blocker'
        : result.data_preservation.status === 'failed'
          ? 'failed'
          : 'not_run'
    : 'not_run';
  return {
    path_id: 'ordinary_docker_webui_user_path',
    priority: 'ordinary_user_path_before_evidence_bundle_language',
    one_click_install: {
      status: oneClickStatus,
      summary: 'One-click installer creates compose.yaml, host data/projects directories, and starts the WebUI image.',
      next_action:
        oneClickStatus === 'passed'
          ? null
          : 'Run the one-click installer on the target host after Docker is available.',
      evidence_ref: input.composePath,
    },
    browser_webui: {
      status: browserStatus,
      summary: `Open the browser WebUI at ${input.healthUrl}.`,
      next_action: browserStatus === 'passed' ? null : 'Fix Docker, image, port, or container startup, then rerun the installer.',
      evidence_ref: input.diagnosticsDir ? path.join(input.diagnosticsDir, 'http-probe.txt') : null,
    },
    access_key_settings: {
      status: accessStatus,
      summary: 'Access keys are entered in the WebUI first-run Access panel or Settings -> Access.',
      next_action: accessStatus === 'passed' ? null : 'Use the WebUI access form; do not pass API keys to the installer.',
      evidence_ref: input.apiKeyReceiptPath,
    },
    runtime_proxy: {
      status: accessStatus,
      summary: 'The WebUI runtime proxy calls /api/opl-runtime/configure-codex and forwards the key through stdin transport.',
      next_action: accessStatus === 'passed' ? null : 'Collect or rerun the API key flow receipt after WebUI health passes.',
      evidence_ref: input.apiKeyReceiptPath,
    },
    startup_recovery: {
      status: recoveryStatus,
      summary: 'Startup diagnostics are redacted and show what to retry or repair for Docker, port, image, or data issues.',
      next_action:
        recoveryStatus === 'passed'
          ? null
          : 'Collect diagnostics, fix the reported Docker/port/image/data issue, then rerun the installer.',
      evidence_ref: input.diagnosticsDir,
    },
    data_preservation: {
      status: dataStatus,
      summary: 'Host OnePersonLab/data and OnePersonLab/projects stay mounted and preserved across image/container replacement.',
      next_action: dataStatus === 'passed' ? null : 'Inspect data-preservation.txt and fix preserve-or-migrate behavior before rerunning.',
      evidence_ref: input.dataEvidencePath,
    },
    host_update: {
      status: oneClickStatus,
      summary: 'Host updates rerun the installer or explicit update mode to pull the WebUI image and recreate the compose service.',
      next_action:
        oneClickStatus === 'passed'
          ? 'Use install-docker-webui.sh --update or install-docker-webui.ps1 -Update when the host image should be updated.'
          : 'Finish the one-click installer before using host update mode.',
      evidence_ref: input.composePath,
    },
    image_seed_selection: expectedImageSeedSelection,
    settings_entry: 'Settings -> Access',
    must_not_claim: [...ordinaryMustNotClaim],
  };
}

function refreshOrdinaryUserStatus(result: GateResult) {
  result.ordinary_user_status = makeOrdinaryUserStatus({
    healthUrl: result.health.url,
    composePath: result.compose.path || result.evidence.compose_yaml || null,
    diagnosticsDir: result.diagnostics_dir || null,
    apiKeyReceiptPath: result.api_key_flow.receipt_path || result.evidence.api_key_flow_evidence || result.evidence.windows_api_key_flow_evidence || null,
    dataEvidencePath: result.diagnostics_dir ? path.join(result.diagnostics_dir, 'data-preservation.txt') : null,
    result,
  });
}

function requiredEnvironment(gate: GateId): string {
  switch (gate) {
    case 'clean_linux_vm':
      return 'clean Linux VM running the Bash one-click installer';
    case 'clean_windows_vm':
      return 'clean Windows VM running the PowerShell one-click installer';
    case 'existing_docker':
      return 'host with existing Docker engine reused by the one-click installer';
    case 'existing_old_onepersonlab_data_dir':
      return 'host with pre-existing OnePersonLab/data preserved by the one-click installer';
  }
}

function blocker(result: GateResult, code: string, message: string, nextAction: string): GateResult {
  const typedBlocker = {
    code,
    owner: 'release_or_install_validation_operator',
    message,
    required_next_action: nextAction,
  };
  return {
    ...result,
    status: 'typed_blocker',
    typed_blocker: typedBlocker,
    blocker: typedBlocker,
  };
}

function runCommand(result: GateResult, command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const index = result.commands.length + 1;
  const stdoutPath = path.join(result.artifact_dir, `command-${index}-stdout.txt`);
  const stderrPath = path.join(result.artifact_dir, `command-${index}-stderr.txt`);
  const executed = spawnSync(command, args, { cwd, env, encoding: 'utf8' });
  fs.writeFileSync(stdoutPath, executed.stdout ?? '');
  fs.writeFileSync(stderrPath, executed.stderr ?? '');
  result.commands.push({
    command: [command, ...args].join(' '),
    status: executed.status,
    stdout_path: stdoutPath,
    stderr_path: stderrPath,
  });
  return executed.status === 0;
}

function dockerAvailable(): boolean {
  const result = spawnSync('docker', ['info'], { encoding: 'utf8' });
  return result.status === 0;
}

function writeJson(filePath: string, payload: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveEvidenceMember(evidenceDir: string, value: unknown, label: string, errors: string[]): string {
  if (!isNonEmptyString(value)) {
    errors.push(`${label} must be a relative path string`);
    return '';
  }
  if (path.isAbsolute(value) || value.includes('\0')) {
    errors.push(`${label} must be relative to the evidence directory`);
    return '';
  }
  const resolved = path.resolve(evidenceDir, value);
  const relative = path.relative(evidenceDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    errors.push(`${label} must stay inside the evidence directory`);
    return '';
  }
  return resolved;
}

function scanDirectoryForSecretMarkers(rootDir: string, scanRoot = rootDir): string[] {
  const markers: string[] = [];
  if (!fs.existsSync(rootDir)) {
    return markers;
  }
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      markers.push(...scanDirectoryForSecretMarkers(fullPath, scanRoot));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const relativePath = path.relative(scanRoot, fullPath);
    const text = fs.readFileSync(fullPath).toString('utf8');
    for (const pattern of secretPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        markers.push(...matches.map((match) => `${relativePath}:${match.slice(0, 48)}`));
      }
    }
  }
  return markers;
}

function validateApiKeyFlowEvidence(filePath: string) {
  const errors: string[] = [];
  let payload: Record<string, unknown> = {};
  if (!fs.existsSync(filePath)) {
    errors.push(`missing API key flow evidence: ${filePath}`);
  } else {
    try {
      payload = readJson(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`API key flow evidence must be valid JSON: ${message}`);
    }
  }
  if (Object.keys(payload).length > 0) {
    if (payload.schema !== apiKeyFlowEvidenceSchema) errors.push(`api_key_flow.schema must be ${apiKeyFlowEvidenceSchema}`);
    if (payload.status !== 'passed') errors.push('api_key_flow.status must be passed');
    if (payload.mode !== 'webui_proxy_configure_codex') errors.push('api_key_flow.mode must be webui_proxy_configure_codex');
    if (payload.command !== 'opl system configure-codex --api-key-stdin --json') {
      errors.push('api_key_flow.command must be the redacted configure-codex stdin command');
    }
    if (payload.stdin_transport !== true) errors.push('api_key_flow.stdin_transport must be true');
    if (payload.key_material_recorded !== false) errors.push('api_key_flow.key_material_recorded must be false');
  }
  const forbiddenSecretMarkers = fs.existsSync(filePath) ? scanDirectoryForSecretMarkers(path.dirname(filePath)).filter((marker) => marker.startsWith(path.basename(filePath))) : [];
  if (forbiddenSecretMarkers.length > 0) {
    errors.push('API key flow evidence contains forbidden secret-like markers');
  }
  return {
    status: errors.length === 0 && forbiddenSecretMarkers.length === 0 ? ('passed' as const) : ('failed' as const),
    filePath,
    errors,
    forbiddenSecretMarkers,
    payload,
  };
}

function readKeyValue(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^([^=\s]+)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function fileStatus(filePath: string): 'present' | 'missing' {
  return fs.existsSync(filePath) ? 'present' : 'missing';
}

function readHttpStatus(httpProbe: Record<string, string>): number | null {
  const candidates = [
    httpProbe.status,
    httpProbe.http_status,
    httpProbe.curl_http_code_or_error,
    httpProbe.python_http_status,
    httpProbe.head_status,
    httpProbe.get_status,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = candidate.match(/\b([1-5][0-9]{2})\b/);
    if (match) return Number(match[1]);
  }
  return null;
}

function runNodeHttpPostJson(url: string, body: Record<string, unknown>) {
  const script = `
const url = process.argv[1];
const payload = JSON.parse(process.argv[2]);
const request = globalThis.fetch
  ? globalThis.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(${apiKeyFlowRequestTimeoutMs}),
    })
  : Promise.reject(new Error('fetch_unavailable'));
request
  .then(async (response) => {
    const text = await response.text();
    process.stdout.write(JSON.stringify({ status: response.status, body: text }) + '\\n');
  })
  .catch((error) => {
    process.stderr.write(String(error && error.message ? error.message : error) + '\\n');
    process.exitCode = 1;
  });
`;
  return spawnSync(process.execPath, ['-e', script, url, JSON.stringify(body)], {
    cwd: appRoot,
    encoding: 'utf8',
  });
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sleepSync(durationMs: number) {
  if (durationMs <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, durationMs);
}

export function shouldRetryConfigureCodexProbe(observation: {
  errors: string[];
  elapsedMs: number;
  timeoutMs: number;
}) {
  if (observation.errors.some((error) => error.includes('leaked the submitted API key placeholder'))) return false;
  return observation.errors.length > 0 && observation.elapsedMs < observation.timeoutMs;
}

function inspectConfigureCodexResponse(response: ReturnType<typeof runNodeHttpPostJson>) {
  const errors: string[] = [];
  let responseStatus: number | null = null;
  let responseSuccess = false;
  let command = 'opl system configure-codex --api-key-stdin --json';
  let stdinTransport = false;

  if (response.status !== 0) {
    errors.push(`configure-codex proxy request failed: ${response.stderr.trim() || response.stdout.trim() || 'unknown error'}`);
  } else {
    const envelope = parseJsonObject(response.stdout.trim());
    responseStatus = typeof envelope?.status === 'number' ? envelope.status : null;
    const bodyText = typeof envelope?.body === 'string' ? envelope.body : '';
    const body = parseJsonObject(bodyText);
    responseSuccess = body?.success === true;
    const data = isObject(body?.data) ? body.data : null;
    const observedCommand = typeof data?.command === 'string' ? data.command : typeof data?.redactedCommand === 'string' ? data.redactedCommand : '';
    if (observedCommand) command = observedCommand;
    stdinTransport = Array.isArray(data?.args)
      ? data.args.includes('--api-key-stdin')
      : command.includes('--api-key-stdin');
    if (responseStatus !== 200) errors.push(`configure-codex proxy returned HTTP ${responseStatus ?? 'unknown'}`);
    if (!responseSuccess) errors.push('configure-codex proxy response did not report success=true');
    if (!stdinTransport) errors.push('configure-codex command did not expose --api-key-stdin transport');
    if (JSON.stringify(body).includes('opl-smoke-placeholder-key') || response.stdout.includes('opl-smoke-placeholder-key')) {
      errors.push('configure-codex response leaked the submitted API key placeholder');
    }
  }

  return { errors, responseStatus, responseSuccess, command, stdinTransport };
}

function collectApiKeyFlowEvidence(result: GateResult, options: ReturnType<typeof parseArgs>) {
  const endpoint = `http://127.0.0.1:${options.port}/api/opl-runtime/configure-codex`;
  const receiptPath = path.join(result.artifact_dir, 'api-key-flow-evidence.json');
  const startedAt = Date.now();
  const timeoutMs = Math.min(options.healthTimeout * 1_000, apiKeyFlowMaxWaitMs);
  let attemptCount = 1;
  let observation = inspectConfigureCodexResponse(
    runNodeHttpPostJson(endpoint, { apiKey: 'opl-smoke-placeholder-key' }),
  );
  while (shouldRetryConfigureCodexProbe({ errors: observation.errors, elapsedMs: Date.now() - startedAt, timeoutMs })) {
    sleepSync(Math.min(apiKeyFlowRetryIntervalMs, Math.max(0, timeoutMs - (Date.now() - startedAt))));
    observation = inspectConfigureCodexResponse(
      runNodeHttpPostJson(endpoint, { apiKey: 'opl-smoke-placeholder-key' }),
    );
    attemptCount += 1;
  }
  const durationMs = Date.now() - startedAt;
  const errors = [...observation.errors];
  if (errors.length > 0 && durationMs >= timeoutMs) {
    errors.push(`configure-codex proxy did not become ready within ${timeoutMs}ms`);
  }

  const payload = {
    schema: apiKeyFlowEvidenceSchema,
    status: errors.length === 0 ? 'passed' : 'failed',
    mode: 'webui_proxy_configure_codex',
    endpoint,
    response_http_status: observation.responseStatus,
    response_success: observation.responseSuccess,
    command: observation.command,
    stdin_transport: observation.stdinTransport,
    attempt_count: attemptCount,
    duration_ms: durationMs,
    retry_interval_ms: apiKeyFlowRetryIntervalMs,
    timeout_ms: timeoutMs,
    key_material_recorded: false,
    secret_scan_note: 'The smoke gate submits a non-real placeholder key and rejects any response that echoes it.',
    errors,
  };
  writeJson(receiptPath, payload);
  result.api_key_flow = {
    status: payload.status,
    mode: 'webui_proxy_configure_codex',
    endpoint,
    command: observation.command,
    stdin_transport: observation.stdinTransport,
    receipt_path: receiptPath,
    errors,
  };
  result.evidence.api_key_flow_evidence = receiptPath;
}

function writeDiagnosticsManifest(result: GateResult, options: ReturnType<typeof parseArgs>) {
  if (!fs.existsSync(result.diagnostics_dir)) return;
  writeJson(path.join(result.diagnostics_dir, 'diagnostics-manifest.json'), {
    schema: 'opl_docker_webui_diagnostics_manifest.v1',
    gate: options.gate,
    artifact_schema: resultSchema,
    created_at: new Date().toISOString(),
    required_files: [
      'metadata.txt',
      'diagnostics-manifest.json',
      'compose.yaml',
      'docker-version.txt',
      'docker-compose-version.txt',
      'docker-compose-ps.txt',
      'docker-compose-logs.txt',
      'docker-image.txt',
      'http-probe.txt',
      'directories.txt',
      'data-preservation.txt',
    ],
  });
}

function refreshDiagnosticsArchive(result: GateResult) {
  const archivePath = result.evidence.diagnostics_archive;
  if (!archivePath || !fs.existsSync(result.diagnostics_dir)) return;
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  const archived = spawnSync('tar', ['-czf', archivePath, '-C', path.dirname(result.diagnostics_dir), path.basename(result.diagnostics_dir)], {
    encoding: 'utf8',
  });
  if (archived.status !== 0) {
    throw new Error(`Failed to refresh diagnostics archive after manifest write: ${archived.stderr || archived.stdout}`);
  }
}

function readDiagnosticsSummary(result: GateResult, options: ReturnType<typeof parseArgs>, imageIdentity: ImageIdentity) {
  const metadata = readKeyValue(path.join(result.diagnostics_dir, 'metadata.txt'));
  const httpProbe = readKeyValue(path.join(result.diagnostics_dir, 'http-probe.txt'));
  const preservation = readKeyValue(path.join(result.diagnostics_dir, 'data-preservation.txt'));
  const composePath = metadata.compose_file || result.evidence.compose_yaml || path.join(result.artifact_dir, 'home', 'OnePersonLab', 'compose.yaml');
  const imageRef = metadata.image || options.image;
  const healthUrl = metadata.health_url || `http://localhost:${options.port}/`;
  const httpStatus = readHttpStatus(httpProbe);

  result.health = {
    url: healthUrl,
    status: httpStatus !== null && httpStatus >= 200 && httpStatus < 400 ? 'passed' : fileStatus(path.join(result.diagnostics_dir, 'http-probe.txt')) === 'present' ? 'failed' : 'not_run',
    http_status: httpStatus,
  };
  result.compose = {
    path: composePath,
    status: fileStatus(path.join(result.diagnostics_dir, 'compose.yaml')),
  };
  result.container = {
    name: 'one-person-lab-webui',
    status: fs.existsSync(path.join(result.diagnostics_dir, 'docker-compose-ps.txt')) ? 'captured' : 'not_run',
    id: null,
  };
  result.image = {
    ref: imageRef,
    status: fileStatus(path.join(result.diagnostics_dir, 'docker-image.txt')),
    id: imageIdentity.image_id,
    repo_digests: imageIdentity.repo_digests,
    digest: imageIdentity.digest,
    remote_ref: imageIdentity.remote_ref,
    remote_digest: imageIdentity.remote_digest,
    currentness_status: imageIdentity.currentness_status,
    currentness_evidence_source: imageIdentity.currentness_evidence_source,
    currentness_claim: false,
  };
  result.data_preservation = {
    status: preservation.verdict ? 'passed' : fileStatus(path.join(result.diagnostics_dir, 'data-preservation.txt')) === 'present' ? 'failed' : 'not_run',
    verdict: preservation.verdict ?? null,
    summary: preservation.verdict ? `verdict=${preservation.verdict}` : 'missing data preservation verdict',
  };
}

function attachDiagnosticsReadback(result: GateResult, options: ReturnType<typeof parseArgs>) {
  writeDiagnosticsManifest(result, options);
  refreshDiagnosticsArchive(result);
  const validation = validateDockerWebuiDiagnostics(result.diagnostics_dir);
  readDiagnosticsSummary(result, options, validation.image_identity);
  result.diagnostics_validation = validation;
  result.secret_scan = validation.secret_scan;
  if (validation.preservation_verdict) {
    result.data_preservation = {
      status: 'passed',
      verdict: validation.preservation_verdict,
      summary: `verdict=${validation.preservation_verdict}`,
    };
  }
  return validation;
}

function validateWindowsEvidence(evidenceDir: string) {
  const errors: string[] = [];
  const manifestPath = path.join(evidenceDir, windowsEvidenceManifestName);
  let manifest: Record<string, unknown> = {};

  if (!fs.existsSync(evidenceDir) || !fs.statSync(evidenceDir).isDirectory()) {
    errors.push(`evidence directory not found: ${evidenceDir}`);
  } else if (!fs.existsSync(manifestPath)) {
    errors.push(`missing ${windowsEvidenceManifestName}`);
  } else {
    try {
      manifest = readJson(manifestPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${windowsEvidenceManifestName} must be valid JSON: ${message}`);
    }
  }

  if (Object.keys(manifest).length > 0) {
    if (manifest.schema !== windowsEvidenceSchema) errors.push(`manifest.schema must be ${windowsEvidenceSchema}`);
    if (manifest.gate_id !== 'clean_windows_vm') errors.push('manifest.gate_id must be clean_windows_vm');
    if (manifest.status !== 'passed') errors.push('manifest.status must be passed');
    if (manifest.host_platform !== 'win32') errors.push('manifest.host_platform must be win32');
    if (!isNonEmptyString(manifest.observed_at)) errors.push('manifest.observed_at must be a non-empty string');
    if (!isNonEmptyString(manifest.installer_command) || !manifest.installer_command.includes('install-docker-webui.ps1')) {
      errors.push('manifest.installer_command must reference install-docker-webui.ps1');
    }
    if (isNonEmptyString(manifest.installer_command) && !/(^|\s)-Yes(\s|$)/.test(manifest.installer_command)) {
      errors.push('manifest.installer_command must include -Yes');
    }
  }

  const diagnosticsDir = resolveEvidenceMember(evidenceDir, manifest.diagnostics_dir, 'manifest.diagnostics_dir', errors);
  const apiKeyFlowEvidencePath = resolveEvidenceMember(
    evidenceDir,
    manifest.api_key_flow_evidence,
    'manifest.api_key_flow_evidence',
    errors,
  );
  const diagnosticsValidation = diagnosticsDir
    ? validateDockerWebuiDiagnostics(diagnosticsDir)
    : (emptyDiagnosticsValidation('', ['diagnostics_dir']) as ReturnType<typeof validateDockerWebuiDiagnostics>);
  if (diagnosticsValidation.status !== 'passed') {
    errors.push('diagnostics validation failed');
  }
  const apiKeyFlowValidation = apiKeyFlowEvidencePath
    ? validateApiKeyFlowEvidence(apiKeyFlowEvidencePath)
    : {
        status: 'failed' as const,
        filePath: '',
        errors: ['missing api_key_flow_evidence'],
        forbiddenSecretMarkers: [],
        payload: {},
      };
  if (apiKeyFlowValidation.status !== 'passed') {
    errors.push('API key flow evidence validation failed');
  }

  const forbiddenSecretMarkers = scanDirectoryForSecretMarkers(evidenceDir);
  if (forbiddenSecretMarkers.length > 0) {
    errors.push('evidence contains forbidden secret-like markers');
  }

  return {
    status: errors.length === 0 && forbiddenSecretMarkers.length === 0 ? ('passed' as const) : ('failed' as const),
    evidenceDir,
    manifestPath,
    diagnosticsDir,
    diagnosticsValidation,
    apiKeyFlowEvidencePath,
    apiKeyFlowValidation,
    errors,
    forbiddenSecretMarkers,
    manifest,
  };
}

type WindowsEvidenceArchiveEntry = {
  raw: string;
  normalized: string;
  isDirectory: boolean;
  payload: Buffer | null;
};

function normalizeWindowsEvidenceArchiveEntry(entry: string) {
  if (entry.startsWith('/') || entry.startsWith('\\') || /^[A-Za-z]:/.test(entry) || entry.includes('\0')) {
    throw new Error(`Windows evidence archive contains an unsafe absolute entry: ${entry}`);
  }
  const normalized = entry.replaceAll('\\', '/');
  const pathForCheck = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  const segments = pathForCheck.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`Windows evidence archive contains an unsafe parent traversal entry: ${entry}`);
  }
  return {
    raw: entry,
    normalized,
    isDirectory: normalized.endsWith('/'),
  };
}

function findZipEndOfCentralDirectory(archive: Buffer, archivePath: string) {
  const minimumEocdSize = 22;
  const maxCommentSize = 0xffff;
  const searchStart = Math.max(0, archive.length - minimumEocdSize - maxCommentSize);
  for (let offset = archive.length - minimumEocdSize; offset >= searchStart; offset--) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error(`Failed to locate Windows evidence archive central directory: ${archivePath}`);
}

function readWindowsEvidenceArchiveEntries(archivePath: string): WindowsEvidenceArchiveEntry[] {
  const archive = fs.readFileSync(archivePath);
  const eocd = findZipEndOfCentralDirectory(archive, archivePath);
  const entriesOnDisk = archive.readUInt16LE(eocd + 8);
  const totalEntries = archive.readUInt16LE(eocd + 10);
  const centralDirectorySize = archive.readUInt32LE(eocd + 12);
  const centralDirectoryOffset = archive.readUInt32LE(eocd + 16);
  if (entriesOnDisk !== totalEntries) {
    throw new Error(`Windows evidence archive spans multiple disks, which is unsupported: ${archivePath}`);
  }
  if (totalEntries === 0) {
    throw new Error(`Windows evidence archive is empty: ${archivePath}`);
  }
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > archive.length) {
    throw new Error(`Windows evidence archive central directory is out of range: ${archivePath}`);
  }

  const entries: WindowsEvidenceArchiveEntry[] = [];
  let cursor = centralDirectoryOffset;
  while (cursor < centralDirectoryEnd) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`Windows evidence archive central directory is invalid at offset ${cursor}: ${archivePath}`);
    }
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const fileNameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localHeaderOffset = archive.readUInt32LE(cursor + 42);
    if ([compressedSize, uncompressedSize, localHeaderOffset].some((value) => value === 0xffffffff)) {
      throw new Error(`Windows evidence archive uses ZIP64 entries, which are unsupported: ${archivePath}`);
    }
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const raw = archive.subarray(fileNameStart, fileNameEnd).toString('utf8');
    const normalized = normalizeWindowsEvidenceArchiveEntry(raw);
    if ((flags & 0x1) !== 0) {
      throw new Error(`Windows evidence archive contains an encrypted entry: ${raw}`);
    }

    let payload: Buffer | null = null;
    if (!normalized.isDirectory) {
      if (![0, 8].includes(method)) {
        throw new Error(`Windows evidence archive entry uses unsupported compression method ${method}: ${raw}`);
      }
      if (archive.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error(`Windows evidence archive local header is invalid for entry: ${raw}`);
      }
      const localFileNameLength = archive.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = archive.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > archive.length) {
        throw new Error(`Windows evidence archive entry data is out of range: ${raw}`);
      }
      const compressedPayload = archive.subarray(dataStart, dataEnd);
      payload = method === 0 ? Buffer.from(compressedPayload) : inflateRawSync(compressedPayload);
      if (payload.length !== uncompressedSize) {
        throw new Error(`Windows evidence archive entry size mismatch: ${raw}`);
      }
    }

    entries.push({ ...normalized, payload });
    cursor = fileNameEnd + extraLength + commentLength;
  }
  if (entries.length !== totalEntries) {
    throw new Error(`Windows evidence archive entry count mismatch: ${archivePath}`);
  }
  return entries;
}

function listSafeWindowsEvidenceArchiveEntries(archivePath: string): WindowsEvidenceArchiveEntry[] {
  return readWindowsEvidenceArchiveEntries(archivePath);
}

function extractWindowsEvidenceArchive(archivePath: string, extractedRoot: string) {
  const entries = listSafeWindowsEvidenceArchiveEntries(archivePath);
  const root = path.resolve(extractedRoot);
  const seenFiles = new Set<string>();

  for (const entry of entries) {
    const destination = path.resolve(root, entry.normalized);
    if (destination !== root && !destination.startsWith(root + path.sep)) {
      throw new Error(`Windows evidence archive contains an unsafe entry outside extraction root: ${entry.raw}`);
    }
    if (entry.isDirectory) {
      fs.mkdirSync(destination, { recursive: true });
      continue;
    }
    if (seenFiles.has(entry.normalized)) {
      throw new Error(`Windows evidence archive contains duplicate normalized entry: ${entry.raw}`);
    }
    seenFiles.add(entry.normalized);

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, entry.payload ?? Buffer.alloc(0));
  }
}

function prepareWindowsEvidenceDir(evidencePath: string, artifactDir: string) {
  const resolved = path.resolve(evidencePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Windows evidence path not found: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return {
      evidenceDir: resolved,
      evidenceArchive: null as string | null,
    };
  }
  if (!stat.isFile() || path.extname(resolved).toLowerCase() !== '.zip') {
    throw new Error(`Windows evidence must be a directory or .zip archive: ${resolved}`);
  }

  const extractedRoot = path.join(artifactDir, 'windows-evidence-archive');
  fs.rmSync(extractedRoot, { recursive: true, force: true });
  fs.mkdirSync(extractedRoot, { recursive: true });
  extractWindowsEvidenceArchive(resolved, extractedRoot);

  const directManifest = path.join(extractedRoot, windowsEvidenceManifestName);
  if (fs.existsSync(directManifest)) {
    return {
      evidenceDir: extractedRoot,
      evidenceArchive: resolved,
    };
  }
  const childDirs = fs.readdirSync(extractedRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const manifestDirs = childDirs
    .map((entry) => path.join(extractedRoot, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, windowsEvidenceManifestName)));
  if (manifestDirs.length === 1) {
    return {
      evidenceDir: manifestDirs[0],
      evidenceArchive: resolved,
    };
  }
  throw new Error(`Windows evidence archive must contain ${windowsEvidenceManifestName} at the archive root or in one top-level directory.`);
}

function importWindowsEvidenceGate(result: GateResult, options: ReturnType<typeof parseArgs>): GateResult {
  const prepared = prepareWindowsEvidenceDir(options.evidence, result.artifact_dir);
  const evidenceDir = prepared.evidenceDir;
  const validation = validateWindowsEvidence(evidenceDir);
  result.diagnostics_dir = validation.diagnosticsDir || result.diagnostics_dir;
  result.diagnostics_validation = validation.diagnosticsValidation;
  result.secret_scan = {
    status:
      validation.diagnosticsValidation.secret_scan.status === 'passed' && validation.forbiddenSecretMarkers.length === 0
        ? 'passed'
        : 'failed',
    forbidden_secret_markers: [
      ...validation.diagnosticsValidation.secret_scan.forbidden_secret_markers,
      ...validation.forbiddenSecretMarkers,
    ],
  };
  result.evidence_validation = {
    status: validation.status,
    evidence_dir: evidenceDir,
    manifest_path: validation.manifestPath,
    errors: validation.errors,
    forbidden_secret_markers: validation.forbiddenSecretMarkers,
  };
  result.evidence.windows_evidence_dir = evidenceDir;
  result.evidence.windows_evidence_manifest = validation.manifestPath;
  if (prepared.evidenceArchive) {
    result.evidence.windows_evidence_archive = prepared.evidenceArchive;
  }
  if (validation.diagnosticsDir) {
    result.evidence.windows_diagnostics_dir = validation.diagnosticsDir;
    readDiagnosticsSummary(result, options, validation.diagnosticsValidation.image_identity);
  }
  if (validation.apiKeyFlowEvidencePath) {
    result.api_key_flow = {
      status: validation.apiKeyFlowValidation.status,
      mode: 'imported_evidence',
      endpoint:
        typeof validation.apiKeyFlowValidation.payload.endpoint === 'string'
          ? validation.apiKeyFlowValidation.payload.endpoint
          : null,
      command:
        typeof validation.apiKeyFlowValidation.payload.command === 'string'
          ? validation.apiKeyFlowValidation.payload.command
          : null,
      stdin_transport: validation.apiKeyFlowValidation.payload.stdin_transport === true,
      receipt_path: validation.apiKeyFlowEvidencePath,
      errors: validation.apiKeyFlowValidation.errors,
    };
    result.evidence.windows_api_key_flow_evidence = validation.apiKeyFlowEvidencePath;
  }
  if (validation.diagnosticsValidation.preservation_verdict) {
    result.data_preservation = {
      status: 'passed',
      verdict: validation.diagnosticsValidation.preservation_verdict,
      summary: `verdict=${validation.diagnosticsValidation.preservation_verdict}`,
    };
  }

  const summaryPath = path.join(result.artifact_dir, 'windows-evidence-import-summary.json');
  writeJson(summaryPath, {
    schema: 'opl_docker_webui_windows_evidence_import_summary.v1',
    status: validation.status,
    evidence_dir: evidenceDir,
    evidence_archive: prepared.evidenceArchive,
    manifest_path: validation.manifestPath,
    diagnostics_dir: validation.diagnosticsDir,
    diagnostics_validation: validation.diagnosticsValidation,
    api_key_flow_validation: validation.apiKeyFlowValidation,
    errors: validation.errors,
    forbidden_secret_markers: validation.forbiddenSecretMarkers,
    manifest: validation.manifest,
  });
  result.evidence.windows_evidence_import_summary = summaryPath;
  result.status = validation.status === 'passed' ? 'passed' : 'failed';
  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateDockerWebuiSmokeGateResult(payload: unknown): GateResultValidation {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];
  if (!isObject(payload)) {
    return {
      status: 'failed',
      missing_fields: [...requiredResultFields],
      invalid_fields: ['payload'],
    };
  }
  for (const field of requiredResultFields) {
    if (!(field in payload)) missingFields.push(field);
  }
  if (payload.schema !== resultSchema) invalidFields.push('schema');
  if (!['clean_linux_vm', 'clean_windows_vm', 'existing_docker', 'existing_old_onepersonlab_data_dir'].includes(String(payload.gate))) {
    invalidFields.push('gate');
  }
  if (!['passed', 'typed_blocker', 'failed'].includes(String(payload.status))) invalidFields.push('status');
  if (payload.status === 'typed_blocker' && !isObject(payload.typed_blocker)) invalidFields.push('typed_blocker');
  for (const objectField of [
    'diagnostics_validation',
    'health',
    'compose',
    'container',
    'image',
    'data_preservation',
    'ordinary_user_status',
    'secret_scan',
  ]) {
    if (objectField in payload && !isObject(payload[objectField])) invalidFields.push(objectField);
  }
  if ('api_key_flow' in payload && !isObject(payload.api_key_flow)) invalidFields.push('api_key_flow');
  if (isObject(payload.ordinary_user_status)) {
    const ordinaryStatus = payload.ordinary_user_status;
    if (ordinaryStatus.path_id !== 'ordinary_docker_webui_user_path') {
      invalidFields.push('ordinary_user_status.path_id');
    }
    if (ordinaryStatus.priority !== 'ordinary_user_path_before_evidence_bundle_language') {
      invalidFields.push('ordinary_user_status.priority');
    }
    if (ordinaryStatus.settings_entry !== 'Settings -> Access') {
      invalidFields.push('ordinary_user_status.settings_entry');
    }
    if (ordinaryStatus.image_seed_selection !== expectedImageSeedSelection) {
      invalidFields.push('ordinary_user_status.image_seed_selection');
    }
    if (!Array.isArray(ordinaryStatus.must_not_claim)) {
      invalidFields.push('ordinary_user_status.must_not_claim');
    } else {
      for (const claim of ordinaryMustNotClaim) {
        if (!ordinaryStatus.must_not_claim.includes(claim)) {
          invalidFields.push(`ordinary_user_status.must_not_claim.${claim}`);
        }
      }
    }
    for (const rowName of ordinaryStatusRows) {
      const row = ordinaryStatus[rowName];
      if (!isObject(row)) {
        invalidFields.push(`ordinary_user_status.${rowName}`);
        continue;
      }
      if (!['passed', 'typed_blocker', 'failed', 'not_run'].includes(String(row.status))) {
        invalidFields.push(`ordinary_user_status.${rowName}.status`);
      }
      if (!isNonEmptyString(row.summary)) {
        invalidFields.push(`ordinary_user_status.${rowName}.summary`);
      }
    }
  }
  if (payload.status === 'passed') {
    if (!isObject(payload.diagnostics_validation) || payload.diagnostics_validation.status !== 'passed') {
      invalidFields.push('diagnostics_validation.status');
    }
    if (
      !isObject(payload.diagnostics_validation) ||
      !isObject(payload.diagnostics_validation.compose_volume_mapping) ||
      payload.diagnostics_validation.compose_volume_mapping.status !== 'passed'
    ) {
      invalidFields.push('diagnostics_validation.compose_volume_mapping.status');
    }
    if (
      !isObject(payload.diagnostics_validation) ||
      !isObject(payload.diagnostics_validation.preservation_evidence) ||
      payload.diagnostics_validation.preservation_evidence.status !== 'passed'
    ) {
      invalidFields.push('diagnostics_validation.preservation_evidence.status');
    }
    if (
      !isObject(payload.diagnostics_validation) ||
      !isObject(payload.diagnostics_validation.image_identity) ||
      payload.diagnostics_validation.image_identity.status !== 'passed' ||
      !isNonEmptyString(payload.diagnostics_validation.image_identity.digest) ||
      !/^sha256:[a-f0-9]{64}$/i.test(payload.diagnostics_validation.image_identity.digest)
    ) {
      invalidFields.push('diagnostics_validation.image_identity.digest');
    }
    if (
      !isObject(payload.diagnostics_validation) ||
      !isObject(payload.diagnostics_validation.image_identity) ||
      payload.diagnostics_validation.image_identity.currentness_claim !== false
    ) {
      invalidFields.push('diagnostics_validation.image_identity.currentness_claim');
    }
    if (
      !isObject(payload.diagnostics_validation) ||
      !isObject(payload.diagnostics_validation.image_identity) ||
      !imageCurrentnessStatuses.includes(String(payload.diagnostics_validation.image_identity.currentness_status) as typeof imageCurrentnessStatuses[number])
    ) {
      invalidFields.push('diagnostics_validation.image_identity.currentness_status');
    }
    if (
      isObject(payload.diagnostics_validation) &&
      isObject(payload.diagnostics_validation.image_identity) &&
      payload.diagnostics_validation.image_identity.remote_digest !== null &&
      (!isNonEmptyString(payload.diagnostics_validation.image_identity.remote_digest) ||
        !/^sha256:[a-f0-9]{64}$/i.test(payload.diagnostics_validation.image_identity.remote_digest))
    ) {
      invalidFields.push('diagnostics_validation.image_identity.remote_digest');
    }
    if (!isObject(payload.health) || payload.health.status !== 'passed') invalidFields.push('health.status');
    if (!isObject(payload.compose) || payload.compose.status !== 'present') invalidFields.push('compose.status');
    if (!isObject(payload.image) || payload.image.status !== 'present') invalidFields.push('image.status');
    if (
      !isObject(payload.image) ||
      !isNonEmptyString(payload.image.digest) ||
      !/^sha256:[a-f0-9]{64}$/i.test(payload.image.digest)
    ) {
      invalidFields.push('image.digest');
    }
    if (!isObject(payload.image) || payload.image.currentness_claim !== false) {
      invalidFields.push('image.currentness_claim');
    }
    if (!isObject(payload.image) || !imageCurrentnessStatuses.includes(String(payload.image.currentness_status) as typeof imageCurrentnessStatuses[number])) {
      invalidFields.push('image.currentness_status');
    }
    if (
      isObject(payload.image) &&
      payload.image.remote_digest !== null &&
      (!isNonEmptyString(payload.image.remote_digest) || !/^sha256:[a-f0-9]{64}$/i.test(payload.image.remote_digest))
    ) {
      invalidFields.push('image.remote_digest');
    }
    if (!isObject(payload.data_preservation) || payload.data_preservation.status !== 'passed') {
      invalidFields.push('data_preservation.status');
    }
    if (!isObject(payload.api_key_flow) || payload.api_key_flow.status !== 'passed') invalidFields.push('api_key_flow.status');
    if (!isObject(payload.api_key_flow) || payload.api_key_flow.stdin_transport !== true) {
      invalidFields.push('api_key_flow.stdin_transport');
    }
    if (!isObject(payload.ordinary_user_status)) {
      invalidFields.push('ordinary_user_status');
    } else {
      for (const rowName of ordinaryStatusRows) {
        const row = payload.ordinary_user_status[rowName];
        if (!isObject(row) || row.status !== 'passed') {
          invalidFields.push(`ordinary_user_status.${rowName}.status`);
        }
      }
    }
    if (!isObject(payload.secret_scan) || payload.secret_scan.status !== 'passed') invalidFields.push('secret_scan.status');
  }
  return {
    status: missingFields.length === 0 && invalidFields.length === 0 ? 'passed' : 'failed',
    missing_fields: missingFields,
    invalid_fields: invalidFields,
  };
}

function runInstallGate(result: GateResult, options: ReturnType<typeof parseArgs>): GateResult {
  fs.mkdirSync(result.artifact_dir, { recursive: true });
  const home = path.join(result.artifact_dir, 'home');
  const webuiHome = path.join(home, 'OnePersonLab');
  const dataDir = path.join(webuiHome, 'data');
  const projectsDir = path.join(webuiHome, 'projects');
  const composeFile = path.join(webuiHome, 'compose.yaml');
  const composeProjectName = `opl_webui_${options.gate}_${path.basename(result.artifact_dir).replace(/[^A-Za-z0-9_-]/g, '_')}`;
  fs.mkdirSync(projectsDir, { recursive: true });

  if (options.gate === 'existing_old_onepersonlab_data_dir') {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'preexisting-sentinel.txt'), 'preserve me\n');
  }

  const env = {
    ...process.env,
    COMPOSE_PROJECT_NAME: composeProjectName,
    OPL_WEBUI_HOME: webuiHome,
    OPL_WEBUI_COMPOSE_FILE: composeFile,
    OPL_WEBUI_IMAGE: options.image,
    OPL_WEBUI_DATA_DIR: dataDir,
    OPL_WEBUI_PROJECTS_DIR: projectsDir,
  };
  const diagnosticsArchive = path.join(result.artifact_dir, 'diagnostics.tar.gz');
  result.health.url = `http://localhost:${options.port}/`;
  result.compose.path = composeFile;
  result.image.ref = options.image;
  const args = [
    path.join(appRoot, 'scripts', 'install-docker-webui.sh'),
    '--yes',
    '--port',
    String(options.port),
    '--health-timeout',
    String(options.healthTimeout),
    '--data-dir',
    dataDir,
    '--projects-dir',
    projectsDir,
    '--diagnostics-dir',
    result.diagnostics_dir,
    '--diagnostics-archive',
    diagnosticsArchive,
  ];
  if (options.noOpen) args.push('--no-open');

  const ok = runCommand(result, 'bash', args, appRoot, env);
  result.evidence.compose_yaml = composeFile;
  result.evidence.diagnostics_archive = diagnosticsArchive;
  result.evidence.data_dir = dataDir;
  result.evidence.projects_dir = projectsDir;
  result.evidence.compose_project_name = composeProjectName;
  if (!ok) {
    if (fs.existsSync(result.diagnostics_dir)) {
      attachDiagnosticsReadback(result, options);
    }
    return blocker(
      result,
      'installer_smoke_command_failed',
      'The Docker/WebUI one-click installer did not complete on this host.',
      'Inspect command stdout/stderr and diagnostics, fix the installer/runtime issue, then rerun this same gate.',
    );
  }

  const validation = attachDiagnosticsReadback(result, options);
  collectApiKeyFlowEvidence(result, options);
  if (result.api_key_flow.status !== 'passed') {
    result.status = 'failed';
    return result;
  }
  if (validation.status !== 'passed') {
    result.status = 'failed';
    return result;
  }
  if (options.gate === 'existing_old_onepersonlab_data_dir' && !fs.existsSync(path.join(dataDir, 'preexisting-sentinel.txt'))) {
    return blocker(
      result,
      'old_data_sentinel_missing',
      'The old data directory sentinel was not preserved after installer startup.',
      'Treat as a data preservation regression; do not claim the old-data gate passed until fixed and rerun.',
    );
  }
  result.status = 'passed';
  return result;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.validateResult) {
    const payload = JSON.parse(fs.readFileSync(path.resolve(options.validateResult), 'utf8'));
    const validation = validateDockerWebuiSmokeGateResult(payload);
    const output = `${JSON.stringify(validation, null, 2)}\n`;
    if (options.json) {
      process.stdout.write(output);
    } else {
      console.log(`Docker/WebUI smoke gate result validation: ${validation.status}`);
      if (validation.missing_fields.length > 0) console.log(`Missing fields: ${validation.missing_fields.join(', ')}`);
      if (validation.invalid_fields.length > 0) console.log(`Invalid fields: ${validation.invalid_fields.join(', ')}`);
    }
    if (validation.status !== 'passed') process.exitCode = 1;
    return;
  }
  const artifactDir = path.resolve(options.artifacts);
  fs.mkdirSync(artifactDir, { recursive: true });
  let result = makeResult(options.gate, artifactDir);
  result.diagnostics_validation = emptyDiagnosticsValidation(result.diagnostics_dir);

  if (options.gate === 'clean_windows_vm' && options.evidence) {
    result = importWindowsEvidenceGate(result, options);
  } else if (options.gate === 'clean_windows_vm') {
    result = blocker(
      result,
      process.platform === 'win32' ? 'windows_vm_runner_not_implemented' : 'requires_windows_vm',
      'This gate must be run inside a clean Windows VM with Docker Desktop/WSL2 readiness evidence.',
      `Run scripts/install-docker-webui.ps1 -Yes in a clean Windows VM with -EvidenceDir and optional -EvidenceArchive, capture api-key-flow-evidence.json through the WebUI configure-codex endpoint, write ${windowsEvidenceManifestName}, then rerun this gate with --evidence <dir-or-zip>.`,
    );
  } else if (options.gate === 'clean_linux_vm' && process.platform !== 'linux') {
    result = blocker(
      result,
      'requires_clean_linux_vm',
      'This gate must be run inside a clean Linux VM; the current host cannot prove it.',
      'Run this script on a clean Linux VM or CI VM where Docker Engine installation/reuse can be observed.',
    );
  } else if (options.gate === 'existing_docker' && !dockerAvailable()) {
    result = blocker(
      result,
      'requires_existing_docker_engine',
      'This gate requires an already-working Docker engine before installer execution.',
      'Start Docker or run on a host with Docker already installed, then rerun the gate.',
    );
  } else if (options.gate === 'existing_old_onepersonlab_data_dir' && !dockerAvailable()) {
    result = blocker(
      result,
      'requires_docker_for_old_data_gate',
      'The old-data preservation gate requires Docker to start the WebUI container and verify preservation evidence.',
      'Run on a Docker-capable host with the old OnePersonLab/data fixture, then rerun the gate.',
    );
  } else {
    result = runInstallGate(result, options);
  }

  const resultPath = path.join(artifactDir, 'docker-webui-smoke-gate-result.json');
  refreshOrdinaryUserStatus(result);
  const resultValidation = validateDockerWebuiSmokeGateResult(result);
  if (resultValidation.status !== 'passed') {
    result.status = 'failed';
    result.evidence.result_schema_validation = JSON.stringify(resultValidation);
    refreshOrdinaryUserStatus(result);
  }
  writeJson(resultPath, result);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`Docker/WebUI ${options.gate} gate: ${result.status}`);
    console.log(`Result: ${resultPath}`);
    if (result.blocker) {
      console.log(`Typed blocker: ${result.blocker.code}`);
    }
  }
  if (result.status === 'failed') {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
