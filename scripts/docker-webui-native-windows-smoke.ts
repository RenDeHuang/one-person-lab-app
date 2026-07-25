#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

type JsonRecord = Record<string, unknown>;

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = 'ghcr.io/gaofeng21cn/one-person-lab-webui';
const receiptSchema = 'opl_app_webui_native_windows_smoke_receipt.v1';
const immutableRefPattern = new RegExp(`^${repository.replaceAll('.', '\\.')}@(sha256:[0-9a-f]{64})$`);
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const gitShaPattern = /^[0-9a-f]{40}$/;
const requiredImageLabels = [
  'org.opencontainers.image.source',
  'org.opencontainers.image.revision',
  'org.opencontainers.image.version',
  'dev.onepersonlab.release.bundle-digest',
  'dev.onepersonlab.release.cohort-ref',
  'dev.onepersonlab.release.shell-revision',
  'dev.onepersonlab.release.framework-revision',
] as const;
const ingressProxyScript = [
  "const net=require('net')",
  "const close=(a,b)=>{a.destroy();b.destroy()}",
  "net.createServer(client=>{const upstream=net.connect({host:'webui',port:3000});client.pipe(upstream);upstream.pipe(client);client.on('error',()=>close(client,upstream));upstream.on('error',()=>close(client,upstream))}).listen(3000,'0.0.0.0')",
].join(';');
const proxyEnvironmentKeys = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'no_proxy',
] as const;

function fail(message: string): never {
  throw new Error(message);
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value as JsonRecord;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

function booleanValue(value: unknown, expected: boolean, label: string): void {
  if (value !== expected) fail(`${label} must be ${String(expected)}`);
}

function integerValue(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) fail(`${label} must be an integer`);
  return Number(value);
}

export function parseImmutableImageRef(imageRef: string) {
  const match = imageRef.match(immutableRefPattern);
  if (!match) {
    fail(`--image must be ${repository}@sha256:<64 lowercase hex>; tags and guessed digests are forbidden`);
  }
  return { repository, digest: match[1], requestedRef: imageRef };
}

function runIdValue(input = ''): string {
  if (input) {
    if (!/^[a-z0-9][a-z0-9-]{5,63}$/.test(input)) fail('--run-id must use 6-64 lowercase letters, digits, or hyphens');
    return input;
  }
  return `native-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`;
}

export function buildComposeYaml(options: {
  imageRef: string;
  containerName: string;
  dataDir: string;
  projectsDir: string;
  port: number;
  runId: string;
}) {
  const quote = (value: string) => JSON.stringify(value);
  const ingressName = `${options.containerName}-ingress`;
  return [
    'services:',
    '  webui:',
    `    image: ${quote(options.imageRef)}`,
    '    pull_policy: never',
    `    container_name: ${quote(options.containerName)}`,
    '    restart: "no"',
    '    environment:',
    '      AIONUI_ALLOW_REMOTE: "true"',
    '      AIONUI_DATA_DIR: /data',
    '      OPL_PROJECTS_DIR: /projects',
    '    volumes:',
    `      - ${quote(`${options.dataDir}:/data`)}`,
    `      - ${quote(`${options.projectsDir}:/projects`)}`,
    '    labels:',
    '      dev.onepersonlab.validation.owner: native-windows-smoke',
    `      dev.onepersonlab.validation.run-id: ${quote(options.runId)}`,
    '    networks:',
    '      - native-smoke-internal',
    '  ingress:',
    `    image: ${quote(options.imageRef)}`,
    '    pull_policy: never',
    `    container_name: ${quote(ingressName)}`,
    '    restart: "no"',
    '    user: "65532:65532"',
    '    read_only: true',
    '    cap_drop:',
    '      - ALL',
    '    security_opt:',
    '      - no-new-privileges:true',
    '    environment:',
    ...proxyEnvironmentKeys.map((key) => `      ${key}: ""`),
    '    tmpfs:',
    '      - /data:rw,noexec,nosuid,nodev,size=64k,mode=1777',
    '      - /projects:rw,noexec,nosuid,nodev,size=64k,mode=1777',
    '      - /recovery:rw,noexec,nosuid,nodev,size=64k,mode=1777',
    '    entrypoint: ["/usr/local/bin/node", "-e"]',
    `    command: [${quote(ingressProxyScript)}]`,
    '    depends_on:',
    '      - webui',
    '    ports:',
    `      - ${quote(`127.0.0.1:${options.port}:3000`)}`,
    '    labels:',
    '      dev.onepersonlab.validation.owner: native-windows-smoke',
    `      dev.onepersonlab.validation.run-id: ${quote(options.runId)}`,
    '      dev.onepersonlab.validation.role: ingress',
    '    networks:',
    '      - native-smoke-internal',
    '      - native-smoke-ingress',
    'networks:',
    '  native-smoke-internal:',
    '    internal: true',
    '    labels:',
    '      dev.onepersonlab.validation.owner: native-windows-smoke',
    `      dev.onepersonlab.validation.run-id: ${quote(options.runId)}`,
    '  native-smoke-ingress:',
    '    labels:',
    '      dev.onepersonlab.validation.owner: native-windows-smoke',
    `      dev.onepersonlab.validation.run-id: ${quote(options.runId)}`,
    '',
  ].join('\n');
}

export function verifyPriorExactPullEvidence(filePath: string, requestedRef: string, expectedSha256: string) {
  const resolved = path.resolve(filePath);
  if (!digestPattern.test(expectedSha256)) {
    fail('--initial-pull-evidence-sha256 must be a sha256 digest');
  }
  const actualSha256 = digestFile(resolved);
  if (actualSha256 !== expectedSha256) {
    fail(`--initial-pull-evidence sha256 mismatch: expected ${expectedSha256}, got ${actualSha256}`);
  }
  const index = record(readJson(resolved), 'prior pull command index');
  if (index.schema !== 'opl_app_webui_native_windows_command_index.v1' || !Array.isArray(index.commands)) {
    fail('--initial-pull-evidence must be a native Windows smoke command index');
  }
  const commands = index.commands.map((value) => record(value, 'prior command'));
  const pulls = commands.filter((value) => {
    const command = value.command;
    return Array.isArray(command) && command[0] === 'docker' && (
      command[1] === 'pull' ||
      (command[1] === 'image' && command.includes('pull')) ||
      (command[1] === 'compose' && command.includes('pull'))
    );
  });
  if (
    pulls.length !== 1 ||
    !Array.isArray(pulls[0].command) ||
    pulls[0].command.length !== 3 ||
    pulls[0].command[0] !== 'docker' ||
    pulls[0].command[1] !== 'pull' ||
    pulls[0].command[2] !== requestedRef ||
    pulls[0].status !== 0 ||
    pulls[0].timed_out !== false
  ) {
    fail('--initial-pull-evidence must prove exactly one successful bounded pull of the requested digest');
  }
  for (const value of commands) {
    const command = value.command;
    if (!Array.isArray(command) || command[0] !== 'docker' || command[1] !== 'compose' || !command.includes('up')) continue;
    const pullIndex = command.indexOf('--pull');
    if (pullIndex < 0 || command[pullIndex + 1] !== 'never') {
      fail('--initial-pull-evidence must prove every compose up used --pull never');
    }
  }
  return { path: resolved, sha256: actualSha256 };
}

function validateLabels(labels: JsonRecord, expected: JsonRecord = {}) {
  for (const key of requiredImageLabels) stringValue(labels[key], `image.labels.${key}`);
  if (labels['org.opencontainers.image.source'] !== 'https://github.com/gaofeng21cn/one-person-lab-app') {
    fail('image.labels.org.opencontainers.image.source must identify the App repository');
  }
  for (const key of ['org.opencontainers.image.revision', 'dev.onepersonlab.release.shell-revision', 'dev.onepersonlab.release.framework-revision']) {
    if (!gitShaPattern.test(String(labels[key]))) fail(`image.labels.${key} must be a lowercase 40-character Git SHA`);
  }
  for (const key of ['dev.onepersonlab.release.bundle-digest', 'dev.onepersonlab.release.cohort-ref']) {
    if (!digestPattern.test(String(labels[key]))) fail(`image.labels.${key} must be a sha256 digest`);
  }
  for (const [key, wanted] of Object.entries(expected)) {
    if (wanted && labels[key] !== wanted) fail(`image.labels.${key} expected ${wanted}, got ${String(labels[key])}`);
  }
}

function publicationInput(value: unknown, label = 'receipt.publication') {
  const publication = record(value, label);
  const sourceRunId = stringValue(publication.source_run_id, `${label}.source_run_id`);
  if (!/^[1-9][0-9]*$/.test(sourceRunId)) fail(`${label}.source_run_id must be a positive decimal GitHub Actions run id`);
  const version = stringValue(publication.version, `${label}.version`);
  const appSha = stringValue(publication.app_sha, `${label}.app_sha`);
  const shellSha = stringValue(publication.shell_sha, `${label}.shell_sha`);
  const frameworkSha = stringValue(publication.framework_sha, `${label}.framework_sha`);
  for (const [field, sha] of [['app_sha', appSha], ['shell_sha', shellSha], ['framework_sha', frameworkSha]] as const) {
    if (!gitShaPattern.test(sha)) fail(`${label}.${field} must be a lowercase 40-character Git SHA`);
  }
  const bundleDigest = stringValue(publication.bundle_digest, `${label}.bundle_digest`);
  const cohortRef = stringValue(publication.cohort_ref, `${label}.cohort_ref`);
  for (const [field, digest] of [['bundle_digest', bundleDigest], ['cohort_ref', cohortRef]] as const) {
    if (!digestPattern.test(digest)) fail(`${label}.${field} must be a sha256 digest`);
  }
  if (publication.label_parity !== 'passed') fail(`${label}.label_parity must be passed`);
  return {
    source_run_id: sourceRunId,
    version,
    app_sha: appSha,
    shell_sha: shellSha,
    framework_sha: frameworkSha,
    bundle_digest: bundleDigest,
    cohort_ref: cohortRef,
    label_parity: 'passed',
  };
}

function validateHttpProbe(value: unknown, label: string) {
  const probe = record(value, label);
  if (probe.status !== 'passed') fail(`${label}.status must be passed`);
  const status = integerValue(probe.http_status, `${label}.http_status`);
  if (status < 200 || status >= 400) fail(`${label}.http_status must be 2xx or 3xx`);
  stringValue(probe.url, `${label}.url`);
  return probe;
}

function digestFile(filePath: string) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

export function validateNativeWindowsSmokeReceipt(value: unknown) {
  const receipt = record(value, 'receipt');
  if (receipt.schema !== receiptSchema) fail(`receipt.schema must be ${receiptSchema}`);
  if (receipt.status !== 'passed') fail('receipt.status must be passed');
  if (receipt.lane !== 'windows_wsl2_native_post_public_smoke') fail('receipt.lane is invalid');
  runIdValue(stringValue(receipt.run_id, 'receipt.run_id'));
  if (Number.isNaN(Date.parse(stringValue(receipt.observed_at, 'receipt.observed_at')))) fail('receipt.observed_at must be a timestamp');

  const publication = publicationInput(receipt.publication);

  const image = record(receipt.image, 'receipt.image');
  const identity = parseImmutableImageRef(stringValue(image.requested_ref, 'receipt.image.requested_ref'));
  if (image.repository !== repository || image.digest !== identity.digest) fail('receipt.image identity does not match requested_ref');
  stringValue(image.image_id, 'receipt.image.image_id');
  if (!Array.isArray(image.repo_digests) || !image.repo_digests.includes(identity.requestedRef)) {
    fail('receipt.image.repo_digests must contain the requested immutable ref');
  }
  if (image.os !== 'linux' || image.architecture !== 'amd64') fail('receipt.image platform must be linux/amd64');
  validateLabels(record(image.labels, 'receipt.image.labels'), {
    'org.opencontainers.image.revision': publication.app_sha,
    'org.opencontainers.image.version': publication.version,
    'dev.onepersonlab.release.bundle-digest': publication.bundle_digest,
    'dev.onepersonlab.release.cohort-ref': publication.cohort_ref,
    'dev.onepersonlab.release.shell-revision': publication.shell_sha,
    'dev.onepersonlab.release.framework-revision': publication.framework_sha,
  });

  const host = record(receipt.host, 'receipt.host');
  if (host.platform !== 'windows_wsl2') fail('receipt.host.platform must be windows_wsl2');
  record(host.wsl2, 'receipt.host.wsl2');
  record(host.docker, 'receipt.host.docker');
  record(host.storage, 'receipt.host.storage');

  const runtime = record(receipt.runtime, 'receipt.runtime');
  stringValue(runtime.container_name, 'receipt.runtime.container_name');
  stringValue(runtime.container_id, 'receipt.runtime.container_id');
  if (runtime.container_image_id !== image.image_id) fail('receipt.runtime.container_image_id must match receipt.image.image_id');
  booleanValue(runtime.internal_network, true, 'receipt.runtime.internal_network');
  const internalNetworkName = stringValue(runtime.internal_network_name, 'receipt.runtime.internal_network_name');
  if (!internalNetworkName.endsWith('_native-smoke-internal')) {
    fail('receipt.runtime.internal_network_name is invalid');
  }
  const ingressNetworkName = `${internalNetworkName.slice(0, -'_native-smoke-internal'.length)}_native-smoke-ingress`;
  if (
    !Array.isArray(runtime.network_names) ||
    runtime.network_names.length !== 1 ||
    runtime.network_names[0] !== internalNetworkName
  ) {
    fail('receipt.runtime.network_names must contain only the internal smoke network');
  }
  const containerLabels = record(runtime.container_labels, 'receipt.runtime.container_labels');
  validateLabels(containerLabels, {
    'org.opencontainers.image.revision': publication.app_sha,
    'org.opencontainers.image.version': publication.version,
    'dev.onepersonlab.release.bundle-digest': publication.bundle_digest,
    'dev.onepersonlab.release.cohort-ref': publication.cohort_ref,
    'dev.onepersonlab.release.shell-revision': publication.shell_sha,
    'dev.onepersonlab.release.framework-revision': publication.framework_sha,
  });
  if (containerLabels['dev.onepersonlab.validation.owner'] !== 'native-windows-smoke') {
    fail('receipt.runtime.container_labels must bind native-windows-smoke ownership');
  }
  if (containerLabels['dev.onepersonlab.validation.run-id'] !== receipt.run_id) {
    fail('receipt.runtime.container_labels must bind the receipt run id');
  }
  const ingress = record(runtime.ingress, 'receipt.runtime.ingress');
  stringValue(ingress.container_name, 'receipt.runtime.ingress.container_name');
  stringValue(ingress.container_id, 'receipt.runtime.ingress.container_id');
  const ingressLabels = record(ingress.container_labels, 'receipt.runtime.ingress.container_labels');
  validateLabels(ingressLabels, {
    'org.opencontainers.image.revision': publication.app_sha,
    'org.opencontainers.image.version': publication.version,
    'dev.onepersonlab.release.bundle-digest': publication.bundle_digest,
    'dev.onepersonlab.release.cohort-ref': publication.cohort_ref,
    'dev.onepersonlab.release.shell-revision': publication.shell_sha,
    'dev.onepersonlab.release.framework-revision': publication.framework_sha,
  });
  if (
    ingress.container_image_id !== image.image_id ||
    ingressLabels['dev.onepersonlab.validation.owner'] !== 'native-windows-smoke' ||
    ingressLabels['dev.onepersonlab.validation.run-id'] !== receipt.run_id ||
    ingressLabels['dev.onepersonlab.validation.role'] !== 'ingress' ||
    ingress.same_exact_image !== true ||
    ingress.read_only !== true ||
    ingress.host_volumes !== 0 ||
    ingress.tmpfs_mounts !== 3 ||
    ingress.non_root !== true ||
    ingress.fixed_node_tcp_proxy !== true ||
    ingress.cap_drop_all !== true ||
    ingress.no_new_privileges !== true ||
    ingress.proxy_environment_cleared !== true ||
    !Array.isArray(ingress.network_names) ||
    ingress.network_names.length !== 2 ||
    new Set(ingress.network_names).size !== 2 ||
    !ingress.network_names.includes(internalNetworkName) ||
    !ingress.network_names.includes(ingressNetworkName)
  ) fail('receipt.runtime.ingress must bind the fixed ingress to the exact image without writable host state');

  const http = record(receipt.http, 'receipt.http');
  validateHttpProbe(http.root, 'receipt.http.root');
  validateHttpProbe(http.webmanifest, 'receipt.http.webmanifest');
  if (!Array.isArray(http.assets) || http.assets.length < 1) fail('receipt.http.assets must contain at least one passed asset');
  http.assets.forEach((probe, index) => validateHttpProbe(probe, `receipt.http.assets[${index}]`));
  const login = validateHttpProbe(http.login_session, 'receipt.http.login_session');
  booleanValue(login.session_cookie_observed, true, 'receipt.http.login_session.session_cookie_observed');
  booleanValue(login.json_object, true, 'receipt.http.login_session.json_object');

  const ui = record(receipt.ui, 'receipt.ui');
  if (ui.status !== 'passed' || ui.browser !== 'windows_chrome_headless') fail('receipt.ui must contain a passed Windows Chrome render');
  stringValue(ui.url, 'receipt.ui.url');
  booleanValue(ui.root_hydrated, true, 'receipt.ui.root_hydrated');
  if (integerValue(ui.visible_text_chars, 'receipt.ui.visible_text_chars') < 20) fail('receipt.ui.visible_text_chars must be at least 20');
  const screenshot = record(ui.screenshot, 'receipt.ui.screenshot');
  stringValue(screenshot.path, 'receipt.ui.screenshot.path');
  if (integerValue(screenshot.bytes, 'receipt.ui.screenshot.bytes') < 1000) fail('receipt.ui.screenshot.bytes must be at least 1000');
  if (!digestPattern.test(String(screenshot.sha256))) fail('receipt.ui.screenshot.sha256 must be a sha256 digest');

  const persistence = record(receipt.persistence, 'receipt.persistence');
  if (persistence.status !== 'passed' || persistence.data_marker !== 'preserved' || persistence.projects_marker !== 'preserved') {
    fail('receipt.persistence must prove both markers were preserved');
  }
  if (integerValue(persistence.recreate_count, 'receipt.persistence.recreate_count') < 1) fail('receipt.persistence.recreate_count must be positive');

  const noFetch = record(receipt.no_secondary_fetch, 'receipt.no_secondary_fetch');
  if (noFetch.status !== 'passed') fail('receipt.no_secondary_fetch.status must be passed');
  booleanValue(noFetch.isolated_empty_docker_config, true, 'receipt.no_secondary_fetch.isolated_empty_docker_config');
  if (noFetch.compose_pull_policy !== 'never' || noFetch.compose_up_pull_mode !== 'never') fail('receipt.no_secondary_fetch must use never pull policy');
  booleanValue(noFetch.internal_network, true, 'receipt.no_secondary_fetch.internal_network');
  if (noFetch.image_pull_events_after_initial_pull !== 0) fail('receipt.no_secondary_fetch must have zero later image pull events');
  if (noFetch.ingress_uses_same_exact_image !== true || noFetch.webui_only_internal_network !== true) {
    fail('receipt.no_secondary_fetch must bind the fixed ingress to the exact image and isolate WebUI on the internal network');
  }
  const pullProvenance = record(noFetch.pull_provenance, 'receipt.no_secondary_fetch.pull_provenance');
  if (!['performed_in_this_run', 'reused_prior_exact_pull'].includes(String(pullProvenance.mode))) {
    fail('receipt.no_secondary_fetch.pull_provenance.mode is invalid');
  }
  if (pullProvenance.exact_pull_ref !== identity.requestedRef || pullProvenance.exact_pull_count_total !== 1) {
    fail('receipt.no_secondary_fetch.pull_provenance must prove one exact digest pull');
  }
  stringValue(pullProvenance.evidence_path, 'receipt.no_secondary_fetch.pull_provenance.evidence_path');
  if (!digestPattern.test(String(pullProvenance.evidence_sha256))) {
    fail('receipt.no_secondary_fetch.pull_provenance.evidence_sha256 must be a sha256 digest');
  }

  const cleanup = record(receipt.cleanup, 'receipt.cleanup');
  if (
    cleanup.status !== 'passed' ||
    cleanup.owned_containers_remaining !== 0 ||
    cleanup.owned_networks_remaining !== 0 ||
    cleanup.runtime_directory_remaining !== false
  ) fail('receipt.cleanup must prove zero task-owned runtime remains');

  const bounded = record(receipt.bounded_execution, 'receipt.bounded_execution');
  for (const field of ['pull_timeout_seconds', 'command_timeout_seconds', 'health_timeout_seconds']) {
    if (integerValue(bounded[field], `receipt.bounded_execution.${field}`) < 1) fail(`receipt.bounded_execution.${field} must be positive`);
  }
  booleanValue(bounded.cleanup_always_runs, true, 'receipt.bounded_execution.cleanup_always_runs');
  return {
    schema: receiptSchema,
    status: 'passed',
    image_ref: identity.requestedRef,
    run_id: receipt.run_id,
    source_run_id: publication.source_run_id,
  };
}

type CommandResult = {
  command: string[];
  status: number;
  timed_out: boolean;
  duration_ms: number;
  stdout_path: string;
  stderr_path: string;
  stdout: string;
  stderr: string;
};

export function cleanupEvidence(
  composeDown: Pick<CommandResult, 'status'>,
  remainingContainers: Pick<CommandResult, 'status' | 'stdout'>,
  remainingNetworks: Pick<CommandResult, 'status' | 'stdout'>,
  runtimeDirectoryRemaining: boolean,
) {
  const containerCount = remainingContainers.stdout.split(/\r?\n/).filter(Boolean).length;
  const networkCount = remainingNetworks.stdout.split(/\r?\n/).filter(Boolean).length;
  return {
    status: composeDown.status === 0 &&
      remainingContainers.status === 0 &&
      remainingNetworks.status === 0 &&
      containerCount === 0 &&
      networkCount === 0 &&
      !runtimeDirectoryRemaining ? 'passed' : 'failed',
    owned_containers_remaining: containerCount,
    owned_networks_remaining: networkCount,
    runtime_directory_remaining: runtimeDirectoryRemaining,
  };
}

export function commandRunner(artifactDir: string, baseEnv: NodeJS.ProcessEnv, commandTimeoutSeconds: number) {
  let sequence = 0;
  return (command: string, args: string[], label: string, timeoutSeconds = commandTimeoutSeconds, allowFailure = false): CommandResult => {
    sequence += 1;
    const prefix = `${String(sequence).padStart(2, '0')}-${label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`;
    const stdoutPath = path.join(artifactDir, `${prefix}.stdout.txt`);
    const stderrPath = path.join(artifactDir, `${prefix}.stderr.txt`);
    const started = Date.now();
    const result = spawnSync(command, args, {
      cwd: appRoot,
      encoding: 'utf8',
      env: baseEnv,
      timeout: timeoutSeconds * 1000,
      maxBuffer: 32 * 1024 * 1024,
    });
    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    fs.writeFileSync(stdoutPath, stdout);
    fs.writeFileSync(stderrPath, stderr);
    const recordResult: CommandResult = {
      command: [command, ...args],
      status: result.status ?? (result.error ? 1 : 0),
      timed_out: (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT',
      duration_ms: Date.now() - started,
      stdout_path: path.relative(artifactDir, stdoutPath),
      stderr_path: path.relative(artifactDir, stderrPath),
      stdout,
      stderr,
    };
    if (!allowFailure && (recordResult.status !== 0 || recordResult.timed_out)) {
      fail(`${label} failed${recordResult.timed_out ? ' by timeout' : ''}: ${stderr.trim() || stdout.trim()}`);
    }
    return recordResult;
  };
}

function parseJsonOutput(result: CommandResult, label: string): unknown {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`${label} did not return JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function httpProbe(url: string, cookie = '', timeoutSeconds = 10) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  return fetch(url, {
    redirect: 'follow',
    signal: controller.signal,
    headers: cookie ? { Cookie: cookie } : {},
  }).finally(() => clearTimeout(timer));
}

function cookieHeader(response: Response): string {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : response.headers.get('set-cookie') ? [String(response.headers.get('set-cookie'))] : [];
  return values.map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

function windowsChromePath() {
  const candidates = [
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) fail('Windows Chrome or Edge is required for native UI rendering evidence');
  return found;
}

function windowsPath(run: ReturnType<typeof commandRunner>, linuxPath: string, label: string) {
  return run('wslpath', ['-w', linuxPath], label).stdout.trim();
}

function visibleTextLength(dom: string) {
  return dom
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

export function renderWindowsUi(options: {
  run: ReturnType<typeof commandRunner>;
  artifactDir: string;
  runtimeDir: string;
  url: string;
  timeoutSeconds: number;
}) {
  const browserPath = windowsChromePath();
  const profilePath = path.join(options.runtimeDir, 'windows-browser-profile');
  const screenshotPath = path.join(options.artifactDir, 'windows-ui.png');
  fs.mkdirSync(profilePath, { recursive: true });
  const profileWindowsPath = windowsPath(options.run, profilePath, 'browser-profile-path');
  const screenshotWindowsPath = windowsPath(options.run, screenshotPath, 'browser-screenshot-path');
  const commonArgs = [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-default-browser-check',
    '--no-first-run',
    '--virtual-time-budget=15000',
    `--user-data-dir=${profileWindowsPath}`,
  ];
  const domResult = options.run(browserPath, [...commonArgs, '--dump-dom', options.url], 'windows-ui-dom', options.timeoutSeconds);
  const emptyRoot = /<(?:div|main)[^>]+id=["']root["'][^>]*>\s*<\/(?:div|main)>/i.test(domResult.stdout);
  const hasRoot = /<(?:div|main)[^>]+id=["']root["']/i.test(domResult.stdout);
  const textChars = visibleTextLength(domResult.stdout);
  if (!hasRoot || emptyRoot || textChars < 20) fail('Windows Chrome rendered an empty or unhydrated WebUI root');
  options.run(browserPath, [
    ...commonArgs,
    '--window-size=1440,1000',
    `--screenshot=${screenshotWindowsPath}`,
    options.url,
  ], 'windows-ui-screenshot', options.timeoutSeconds);
  if (!fs.existsSync(screenshotPath) || fs.statSync(screenshotPath).size < 1000) fail('Windows Chrome did not produce a usable UI screenshot');
  return {
    status: 'passed',
    browser: 'windows_chrome_headless',
    url: options.url,
    root_hydrated: true,
    visible_text_chars: textChars,
    screenshot: {
      path: path.relative(options.artifactDir, screenshotPath),
      bytes: fs.statSync(screenshotPath).size,
      sha256: digestFile(screenshotPath),
    },
  };
}

function passedProbe(url: string, response: Response) {
  if (response.status < 200 || response.status >= 400) fail(`HTTP probe ${url} returned ${response.status}`);
  return {
    status: 'passed',
    url,
    http_status: response.status,
    content_type: response.headers.get('content-type'),
  };
}

async function probeWebuiOnce(baseUrl: string) {
  const rootResponse = await httpProbe(`${baseUrl}/`);
  if (rootResponse.status < 200 || rootResponse.status >= 400) fail(`WebUI root returned HTTP ${rootResponse.status}`);
  const rootCookie = cookieHeader(rootResponse);
  const rootHtml = await rootResponse.text();
  if (!/<(?:div|main)[^>]+id=["']root["']/i.test(rootHtml)) fail('WebUI root HTML has no root mount element');
  const assetPaths = [...rootHtml.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/gi)]
    .map((match) => match[1])
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 3);
  if (assetPaths.length < 1) fail('WebUI root HTML exposes no JS or CSS asset');
  const assets = [];
  for (const assetPath of assetPaths) {
    const assetUrl = new URL(assetPath, `${baseUrl}/`).toString();
    const response = await httpProbe(assetUrl, rootCookie);
    assets.push(passedProbe(assetUrl, response));
    await response.arrayBuffer();
  }

  const manifestUrl = `${baseUrl}/manifest.webmanifest`;
  const manifestResponse = await httpProbe(manifestUrl, rootCookie);
  const webmanifest = passedProbe(manifestUrl, manifestResponse);
  const manifestBody = await manifestResponse.json();
  record(manifestBody, 'webmanifest response');

  const authUrl = `${baseUrl}/api/auth/user`;
  const authResponse = await httpProbe(authUrl, rootCookie);
  const authCookie = cookieHeader(authResponse);
  const login = {
    ...passedProbe(authUrl, authResponse),
    session_cookie_observed: Boolean(rootCookie || authCookie),
    json_object: false,
  };
  const authBody = await authResponse.json();
  record(authBody, 'login session response');
  login.json_object = true;
  if (!login.session_cookie_observed) fail('WebUI local login did not issue a session cookie');
  return {
    root: passedProbe(`${baseUrl}/`, rootResponse),
    webmanifest,
    assets,
    login_session: login,
  };
}

export async function probeWebui(baseUrl: string, healthTimeoutSeconds: number) {
  const deadline = Date.now() + healthTimeoutSeconds * 1000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      return await probeWebuiOnce(baseUrl);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  fail(`WebUI qualification timed out: ${lastError}`);
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function planDocument(artifactDir: string) {
  const executeCommand = [
    'npm run smoke:docker-webui:native-windows --',
    `--image ${repository}@sha256:<successor_digest>`,
    '--source-run-id <source_run_id>',
    '--expected-version <version>',
    '--expected-app-sha <40hex>',
    '--expected-shell-sha <40hex>',
    '--expected-framework-sha <40hex>',
    '--expected-bundle-digest sha256:<64hex>',
    '--expected-cohort-ref sha256:<64hex>',
    `--artifacts ${artifactDir}`,
    '--json',
  ].join(' ');
  return {
    schema: 'opl_app_webui_native_windows_smoke_plan.v1',
    status: 'ready_for_successor_digest',
    owner: 'native_windows_smoke_lane',
    public_owner: '019f9725-99e2-7731-bdb6-0d7e073e7704',
    clean_windows_owner: '019f91db-b1d4-7011-9429-6694cf3b3224',
    image_template: `${repository}@sha256:<successor_digest>`,
    required_resume_input: [
      'exact_index_digest',
      'source_run_id',
      'version',
      'app_sha',
      'shell_sha',
      'framework_sha',
      'bundle_digest',
      'cohort_ref',
    ],
    execute_command: executeCommand,
    descriptor_command: `npm run smoke:docker-webui:native-windows -- --descriptor-only --image ${repository}@sha256:<digest> --artifacts ${artifactDir}-descriptor`,
    baseline_command: `npm run smoke:docker-webui:native-windows -- --baseline-only --artifacts ${artifactDir}-baseline`,
    output_directory: artifactDir,
    judgments: [
      'input_is_exact_immutable_digest',
      'anonymous_pull_uses_empty_docker_config',
      'image_and_container_identity_match_digest_and_required_labels',
      'producer_version_bundle_cohort_and_repo_shas_match_image_labels_exactly',
      'producer_source_run_id_is_preserved_for_publication_correlation',
      'root_webmanifest_assets_and_local_login_session_pass',
      'windows_chrome_renders_a_hydrated_ui_and_writes_a_screenshot_digest',
      'data_and_projects_markers_survive_recreate',
      'compose_uses_pull_policy_never_and_internal_network_after_initial_pull',
      'no_image_pull_event_occurs_after_initial_pull',
      'task_owned_container_network_and_runtime_directory_are_removed',
    ],
    prohibited: ['tag_input', 'moving_tag_mutation', 'workflow_dispatch', 'publication', 'rerun', 'cancel', 'guessed_digest'],
  };
}

function collectBaseline(artifactDir: string, commandTimeoutSeconds: number) {
  if (!fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')) fail('Native Windows baseline must run inside WSL2 with Windows interop');
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-native-baseline-'));
  const dockerConfigDir = path.join(runtimeDir, 'docker-config');
  fs.mkdirSync(dockerConfigDir);
  const run = commandRunner(artifactDir, { ...process.env, DOCKER_CONFIG: dockerConfigDir }, commandTimeoutSeconds);
  try {
    const windows = run('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', [
      '-NoProfile',
      '-Command',
      '$os=Get-CimInstance Win32_OperatingSystem; $cs=Get-CimInstance Win32_ComputerSystem; $drives=Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {[pscustomobject]@{device_id=$_.DeviceID;size_bytes=[int64]$_.Size;free_bytes=[int64]$_.FreeSpace}}; [pscustomobject]@{caption=$os.Caption;version=$os.Version;build=$os.BuildNumber;architecture=$os.OSArchitecture;manufacturer=$cs.Manufacturer;model=$cs.Model;hypervisor_present=$cs.HypervisorPresent;drives=@($drives)} | ConvertTo-Json -Depth 4 -Compress',
    ], 'windows-baseline');
    const wslVersion = run('/mnt/c/Windows/System32/wsl.exe', ['--version'], 'wsl-version');
    const wslStatus = run('/mnt/c/Windows/System32/wsl.exe', ['--status'], 'wsl-status');
    const wslDistributions = run('/mnt/c/Windows/System32/wsl.exe', ['--list', '--verbose'], 'wsl-distributions');
    const linux = run('sh', ['-lc', 'uname -a; printf "\\n---os-release---\\n"; cat /etc/os-release; printf "\\n---df---\\n"; df -B1 / /var/lib/docker'], 'linux-baseline');
    const dockerVersion = run('docker', ['version', '--format', '{{json .}}'], 'docker-version');
    const dockerInfo = run('docker', ['info', '--format', '{{json .}}'], 'docker-info');
    const ownedContainers = run('docker', [
      'ps', '-a', '--filter', 'label=dev.onepersonlab.validation.owner=native-windows-smoke', '--format', '{{.ID}}',
    ], 'owned-container-baseline');
    const ownedNetworks = run('docker', [
      'network', 'ls', '--filter', 'label=dev.onepersonlab.validation.owner=native-windows-smoke', '--format', '{{.ID}}',
    ], 'owned-network-baseline');
    const payload = {
      schema: 'opl_app_webui_native_windows_baseline.v1',
      status: 'passed',
      observed_at: new Date().toISOString(),
      platform: 'windows_wsl2',
      windows: parseJsonOutput(windows, 'Windows baseline'),
      wsl2: {
        version_evidence: wslVersion.stdout_path,
        status_evidence: wslStatus.stdout_path,
        distributions_evidence: wslDistributions.stdout_path,
        linux_evidence: linux.stdout_path,
      },
      docker: {
        version: parseJsonOutput(dockerVersion, 'docker version'),
        info: parseJsonOutput(dockerInfo, 'docker info'),
      },
      native_lane_resource_occupancy: {
        containers: ownedContainers.stdout.split(/\r?\n/).filter(Boolean).length,
        networks: ownedNetworks.stdout.split(/\r?\n/).filter(Boolean).length,
      },
      isolated_empty_docker_config: true,
    };
    if (payload.native_lane_resource_occupancy.containers !== 0 || payload.native_lane_resource_occupancy.networks !== 0) {
      fail('Native lane baseline found unexpected task-owned Docker resources');
    }
    writeJson(path.join(artifactDir, 'native-windows-baseline.json'), payload);
    return payload;
  } finally {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  }
}

async function execute() {
  const { values } = parseArgs({
    options: {
      image: { type: 'string' },
      artifacts: { type: 'string' },
      port: { type: 'string' },
      'run-id': { type: 'string' },
      'plan-only': { type: 'boolean' },
      'baseline-only': { type: 'boolean' },
      'descriptor-only': { type: 'boolean' },
      'validate-receipt': { type: 'string' },
      'pull-timeout': { type: 'string' },
      'command-timeout': { type: 'string' },
      'health-timeout': { type: 'string' },
      'expected-app-sha': { type: 'string' },
      'expected-shell-sha': { type: 'string' },
      'expected-framework-sha': { type: 'string' },
      'expected-version': { type: 'string' },
      'expected-bundle-digest': { type: 'string' },
      'expected-cohort-ref': { type: 'string' },
      'source-run-id': { type: 'string' },
      'reuse-local-image': { type: 'boolean' },
      'initial-pull-evidence': { type: 'string' },
      'initial-pull-evidence-sha256': { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    console.log(`Usage:\n  npm run smoke:docker-webui:native-windows -- --plan-only [--artifacts <dir>]\n  npm run smoke:docker-webui:native-windows -- --baseline-only [--artifacts <dir>]\n  npm run smoke:docker-webui:native-windows -- --descriptor-only --image ${repository}@sha256:<digest> [--artifacts <dir>]\n  npm run smoke:docker-webui:native-windows -- --image ${repository}@sha256:<digest> --source-run-id <run> --expected-version <version> --expected-app-sha <sha> --expected-shell-sha <sha> --expected-framework-sha <sha> --expected-bundle-digest sha256:<digest> --expected-cohort-ref sha256:<digest> [--reuse-local-image --initial-pull-evidence <command-index.json> --initial-pull-evidence-sha256 sha256:<digest>] [--artifacts <dir>] [--port <port>] [--json]\n  npm run smoke:docker-webui:native-windows -- --validate-receipt <file> [--json]`);
    return;
  }
  if (values['validate-receipt']) {
    const summary = validateNativeWindowsSmokeReceipt(readJson(path.resolve(values['validate-receipt'])));
    console.log(JSON.stringify(summary, null, values.json ? 0 : 2));
    return;
  }

  const executionRunId = values['plan-only'] || values['baseline-only'] ? '' : runIdValue(values['run-id']);
  const modeDirectory = values['plan-only'] ? 'successor-plan' : values['baseline-only'] ? 'baseline' : executionRunId;
  const artifactDir = path.resolve(values.artifacts ?? path.join(appRoot, 'tmp', 'docker-webui-native-windows-smoke', modeDirectory));
  fs.mkdirSync(artifactDir, { recursive: true });
  if (values['plan-only']) {
    const plan = planDocument(artifactDir);
    writeJson(path.join(artifactDir, 'native-windows-smoke-plan.json'), plan);
    console.log(JSON.stringify(plan, null, values.json ? 0 : 2));
    return;
  }
  if (values['baseline-only']) {
    const commandTimeoutSeconds = Number(values['command-timeout'] ?? 60);
    if (!Number.isInteger(commandTimeoutSeconds) || commandTimeoutSeconds < 1) fail('--command-timeout is invalid');
    const baseline = collectBaseline(artifactDir, commandTimeoutSeconds);
    console.log(JSON.stringify(baseline, null, values.json ? 0 : 2));
    return;
  }
  const identity = parseImmutableImageRef(stringValue(values.image, '--image'));
  const runId = executionRunId;
  const port = Number(values.port ?? 33173);
  const pullTimeoutSeconds = Number(values['pull-timeout'] ?? 1800);
  const commandTimeoutSeconds = Number(values['command-timeout'] ?? 60);
  const healthTimeoutSeconds = Number(values['health-timeout'] ?? 300);
  for (const [label, number] of [['port', port], ['pull-timeout', pullTimeoutSeconds], ['command-timeout', commandTimeoutSeconds], ['health-timeout', healthTimeoutSeconds]] as const) {
    if (!Number.isInteger(number) || number < 1 || (label === 'port' && number > 65535)) fail(`--${label} is invalid`);
  }

  const publication = values['descriptor-only'] ? null : publicationInput({
    source_run_id: values['source-run-id'],
    version: values['expected-version'],
    app_sha: values['expected-app-sha'],
    shell_sha: values['expected-shell-sha'],
    framework_sha: values['expected-framework-sha'],
    bundle_digest: values['expected-bundle-digest'],
    cohort_ref: values['expected-cohort-ref'],
    label_parity: 'passed',
  }, 'full smoke publication input');

  if (!values['descriptor-only'] && !fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')) {
    fail('Native Windows smoke must run inside WSL2 with Windows interop');
  }
  const reuseLocalImage = values['reuse-local-image'] === true;
  let priorPullEvidence: { path: string; sha256: string } | null = null;
  if (!values['descriptor-only'] && reuseLocalImage) {
    priorPullEvidence = verifyPriorExactPullEvidence(
      stringValue(values['initial-pull-evidence'], '--initial-pull-evidence'),
      identity.requestedRef,
      stringValue(values['initial-pull-evidence-sha256'], '--initial-pull-evidence-sha256'),
    );
  } else if (values['initial-pull-evidence'] || values['initial-pull-evidence-sha256']) {
    fail('--initial-pull-evidence and --initial-pull-evidence-sha256 require full smoke with --reuse-local-image');
  }
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), `opl-webui-${runId}-`));
  const dockerConfigDir = path.join(runtimeDir, 'docker-config');
  const dataDir = path.join(runtimeDir, 'data');
  const projectsDir = path.join(runtimeDir, 'projects');
  fs.mkdirSync(dockerConfigDir);
  fs.mkdirSync(dataDir);
  fs.mkdirSync(projectsDir);
  const baseEnv = { ...process.env, DOCKER_CONFIG: dockerConfigDir };
  const run = commandRunner(artifactDir, baseEnv, commandTimeoutSeconds);
  const commands: Omit<CommandResult, 'stdout' | 'stderr'>[] = [];
  const capture = (...args: Parameters<typeof run>) => {
    const result = run(...args);
    const { stdout: _stdout, stderr: _stderr, ...summary } = result;
    commands.push(summary);
    return result;
  };

  if (values['descriptor-only']) {
    try {
      const descriptor = capture('docker', ['manifest', 'inspect', identity.requestedRef], 'anonymous-descriptor', commandTimeoutSeconds);
      const payload = {
        schema: 'opl_app_webui_anonymous_descriptor_readback.v1',
        status: 'passed',
        observed_at: new Date().toISOString(),
        requested_ref: identity.requestedRef,
        repository: identity.repository,
        digest: identity.digest,
        isolated_empty_docker_config: true,
        descriptor: parseJsonOutput(descriptor, 'docker manifest inspect'),
        commands,
      };
      writeJson(path.join(artifactDir, 'anonymous-descriptor-readback.json'), payload);
      console.log(JSON.stringify(payload, null, values.json ? 0 : 2));
      return;
    } finally {
      fs.rmSync(runtimeDir, { recursive: true, force: true });
    }
  }
  if (!publication) fail('full smoke publication input is required');
  const projectName = `opl-native-${runId}`.slice(0, 63);
  const containerName = `${projectName}-webui`;
  const ingressContainerName = `${containerName}-ingress`;
  const internalNetworkName = `${projectName}_native-smoke-internal`;
  const ingressNetworkName = `${projectName}_native-smoke-ingress`;
  const composePath = path.join(runtimeDir, 'compose.yaml');
  const dataMarkerRelative = `.opl-native-smoke/${runId}/data-marker.txt`;
  const projectsMarkerRelative = `.opl-native-smoke/${runId}/projects-marker.txt`;
  fs.mkdirSync(path.dirname(path.join(dataDir, dataMarkerRelative)), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(projectsDir, projectsMarkerRelative)), { recursive: true });
  fs.writeFileSync(path.join(dataDir, dataMarkerRelative), `data:${runId}\n`);
  fs.writeFileSync(path.join(projectsDir, projectsMarkerRelative), `projects:${runId}\n`);
  fs.writeFileSync(composePath, buildComposeYaml({ imageRef: identity.requestedRef, containerName, dataDir, projectsDir, port, runId }));

  const expectedLabels: JsonRecord = {
    'org.opencontainers.image.revision': publication.app_sha,
    'org.opencontainers.image.version': publication.version,
    'dev.onepersonlab.release.bundle-digest': publication.bundle_digest,
    'dev.onepersonlab.release.cohort-ref': publication.cohort_ref,
    'dev.onepersonlab.release.shell-revision': publication.shell_sha,
    'dev.onepersonlab.release.framework-revision': publication.framework_sha,
  };
  const receiptPath = path.join(artifactDir, 'native-windows-smoke-receipt.json');
  const failurePath = path.join(artifactDir, 'failure.json');
  let receipt: JsonRecord | null = null;
  let failure: JsonRecord | null = null;
  let eventSince = 0;
  let pullProvenance: JsonRecord | null = null;
  try {
    const windows = capture('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', [
      '-NoProfile',
      '-Command',
      '$os=Get-CimInstance Win32_OperatingSystem; $c=Get-PSDrive C; [pscustomobject]@{caption=$os.Caption;version=$os.Version;build=$os.BuildNumber;architecture=$os.OSArchitecture;c_free_bytes=[int64]$c.Free} | ConvertTo-Json -Compress',
    ], 'windows-baseline');
    const wsl = capture('sh', ['-lc', 'uname -a; printf "\\n---os-release---\\n"; cat /etc/os-release; printf "\\n---df---\\n"; df -B1 / /var/lib/docker'], 'wsl-baseline');
    const dockerVersion = capture('docker', ['version', '--format', '{{json .}}'], 'docker-version');
    const dockerInfo = capture('docker', ['info', '--format', '{{json .}}'], 'docker-info');
    const preContainers = capture('docker', ['ps', '-a', '--no-trunc', '--format', '{{json .}}'], 'pre-containers');
    const preImages = capture('docker', ['image', 'ls', '--no-trunc', '--digests', '--format', '{{json .}}'], 'pre-images');

    if (priorPullEvidence) {
      pullProvenance = {
        mode: 'reused_prior_exact_pull',
        exact_pull_ref: identity.requestedRef,
        exact_pull_count_total: 1,
        evidence_path: priorPullEvidence.path,
        evidence_sha256: priorPullEvidence.sha256,
      };
    } else {
      capture('docker', ['pull', identity.requestedRef], 'anonymous-pull-by-digest', pullTimeoutSeconds);
      pullProvenance = {
        mode: 'performed_in_this_run',
        exact_pull_ref: identity.requestedRef,
        exact_pull_count_total: 1,
        evidence_path: 'command-index.json',
        evidence_sha256: null,
      };
    }
    const imageInspectResult = capture('docker', ['image', 'inspect', identity.requestedRef], 'image-inspect');
    const imageInspectRaw = parseJsonOutput(imageInspectResult, 'docker image inspect');
    if (!Array.isArray(imageInspectRaw) || imageInspectRaw.length !== 1) fail('docker image inspect must return exactly one image');
    const imageInspect = record(imageInspectRaw[0], 'image inspect[0]');
    const imageId = stringValue(imageInspect.Id, 'image inspect Id');
    const repoDigests = Array.isArray(imageInspect.RepoDigests) ? imageInspect.RepoDigests.filter((entry): entry is string => typeof entry === 'string') : [];
    if (!repoDigests.includes(identity.requestedRef)) fail('pulled image RepoDigests does not include the requested immutable ref');
    if (imageInspect.Os !== 'linux' || imageInspect.Architecture !== 'amd64') fail('pulled image must be linux/amd64');
    const imageConfig = record(imageInspect.Config, 'image inspect Config');
    const imageLabels = record(imageConfig.Labels, 'image inspect Config.Labels');
    validateLabels(imageLabels, expectedLabels);

    eventSince = Math.floor(Date.now() / 1000) + 1;
    await new Promise((resolve) => setTimeout(resolve, 1100));
    capture('docker', ['compose', '-p', projectName, '-f', composePath, 'up', '-d', '--pull', 'never'], 'compose-up-first', commandTimeoutSeconds);
    const firstHttp = await probeWebui(`http://127.0.0.1:${port}`, healthTimeoutSeconds);
    capture('docker', ['exec', containerName, 'cat', `/data/${dataMarkerRelative}`], 'data-marker-first');
    capture('docker', ['exec', containerName, 'cat', `/projects/${projectsMarkerRelative}`], 'projects-marker-first');
    capture('docker', ['compose', '-p', projectName, '-f', composePath, 'down', '--remove-orphans', '--timeout', '15'], 'compose-down-between');
    capture('docker', ['compose', '-p', projectName, '-f', composePath, 'up', '-d', '--pull', 'never'], 'compose-up-second', commandTimeoutSeconds);
    const baseUrl = `http://127.0.0.1:${port}`;
    const secondHttp = await probeWebui(baseUrl, healthTimeoutSeconds);
    const ui = renderWindowsUi({ run: capture, artifactDir, runtimeDir, url: `${baseUrl}/`, timeoutSeconds: healthTimeoutSeconds });
    capture('docker', ['exec', containerName, 'cat', `/data/${dataMarkerRelative}`], 'data-marker-second');
    capture('docker', ['exec', containerName, 'cat', `/projects/${projectsMarkerRelative}`], 'projects-marker-second');
    const containerInspectResult = capture('docker', ['inspect', containerName], 'container-inspect');
    const containerInspectRaw = parseJsonOutput(containerInspectResult, 'docker inspect');
    if (!Array.isArray(containerInspectRaw) || containerInspectRaw.length !== 1) fail('docker inspect must return exactly one container');
    const containerInspect = record(containerInspectRaw[0], 'container inspect[0]');
    const containerConfig = record(containerInspect.Config, 'container inspect Config');
    const containerHostConfig = record(containerInspect.HostConfig, 'container inspect HostConfig');
    const containerLabels = record(containerConfig.Labels, 'container inspect Config.Labels');
    const containerNetworks = Object.keys(
      record(record(containerInspect.NetworkSettings, 'container inspect NetworkSettings').Networks, 'container inspect networks'),
    ).sort();
    if (containerInspect.Image !== imageId) fail('running container image ID does not match pulled image ID');
    if (containerHostConfig.PortBindings && Object.keys(record(containerHostConfig.PortBindings, 'container port bindings')).length > 0) {
      fail('WebUI container must not publish a host port directly');
    }
    if (containerNetworks.length !== 1 || containerNetworks[0] !== internalNetworkName) {
      fail('WebUI container must attach only to the internal smoke network');
    }
    validateLabels(containerLabels, expectedLabels);
    if (containerLabels['dev.onepersonlab.validation.owner'] !== 'native-windows-smoke' || containerLabels['dev.onepersonlab.validation.run-id'] !== runId) {
      fail('running container is not bound to this validation owner and run ID');
    }
    const ingressInspectResult = capture('docker', ['inspect', ingressContainerName], 'ingress-container-inspect');
    const ingressInspectRaw = parseJsonOutput(ingressInspectResult, 'docker inspect ingress');
    if (!Array.isArray(ingressInspectRaw) || ingressInspectRaw.length !== 1) fail('docker inspect must return exactly one ingress container');
    const ingressInspect = record(ingressInspectRaw[0], 'ingress inspect[0]');
    const ingressConfig = record(ingressInspect.Config, 'ingress inspect Config');
    const ingressHostConfig = record(ingressInspect.HostConfig, 'ingress inspect HostConfig');
    const ingressLabels = record(ingressConfig.Labels, 'ingress inspect Config.Labels');
    const ingressNetworks = Object.keys(
      record(record(ingressInspect.NetworkSettings, 'ingress inspect NetworkSettings').Networks, 'ingress inspect networks'),
    ).sort();
    const ingressMounts = Array.isArray(ingressInspect.Mounts) ? ingressInspect.Mounts : [];
    const ingressHostMounts = ingressMounts.filter((value) => {
      const mount = record(value, 'ingress mount');
      return mount.Type === 'bind' || mount.Type === 'volume';
    });
    const ingressTmpfsMounts = ingressMounts.filter((value) => record(value, 'ingress mount').Type === 'tmpfs');
    const ingressEntrypoint = Array.isArray(ingressConfig.Entrypoint) ? ingressConfig.Entrypoint : [];
    const ingressCommand = Array.isArray(ingressConfig.Cmd) ? ingressConfig.Cmd : [];
    const capDrop = Array.isArray(ingressHostConfig.CapDrop) ? ingressHostConfig.CapDrop.map(String) : [];
    const securityOpt = Array.isArray(ingressHostConfig.SecurityOpt) ? ingressHostConfig.SecurityOpt.map(String) : [];
    const ingressEnvironment = Array.isArray(ingressConfig.Env) ? ingressConfig.Env.map(String) : [];
    const ingressPortBindings = record(ingressHostConfig.PortBindings, 'ingress port bindings');
    const ingressPort3000 = ingressPortBindings['3000/tcp'];
    if (ingressInspect.Image !== imageId || ingressLabels['dev.onepersonlab.validation.role'] !== 'ingress') {
      fail('ingress container must use the exact pulled image and fixed ingress role');
    }
    validateLabels(ingressLabels, expectedLabels);
    if (
      ingressLabels['dev.onepersonlab.validation.owner'] !== 'native-windows-smoke' ||
      ingressLabels['dev.onepersonlab.validation.run-id'] !== runId
    ) {
      fail('ingress container must bind native smoke ownership and run ID');
    }
    if (
      ingressEntrypoint.length !== 2 ||
      ingressEntrypoint[0] !== '/usr/local/bin/node' ||
      ingressEntrypoint[1] !== '-e' ||
      ingressCommand.length !== 1 ||
      ingressCommand[0] !== ingressProxyScript
    ) {
      fail('ingress container must run only the fixed Node TCP proxy');
    }
    if (proxyEnvironmentKeys.some((key) => !ingressEnvironment.includes(`${key}=`))) {
      fail('ingress container must clear all proxy environment variables');
    }
    if (
      ingressHostConfig.ReadonlyRootfs !== true ||
      !capDrop.includes('ALL') ||
      !securityOpt.some((value) => value === 'no-new-privileges' || value === 'no-new-privileges:true')
    ) {
      fail('ingress container must use a read-only rootfs, drop all capabilities, and prevent privilege escalation');
    }
    if (
      (Array.isArray(ingressHostConfig.Binds) && ingressHostConfig.Binds.length > 0) ||
      ingressHostMounts.length > 0 ||
      ingressTmpfsMounts.length !== 3
    ) {
      fail('ingress container must replace image volumes with three ephemeral tmpfs mounts and no host state');
    }
    if (
      ingressNetworks.length !== 2 ||
      !ingressNetworks.includes(internalNetworkName) ||
      !ingressNetworks.includes(ingressNetworkName)
    ) {
      fail('ingress container must attach only to the internal and host-ingress smoke networks');
    }
    if (
      Object.keys(ingressPortBindings).length !== 1 ||
      !Array.isArray(ingressPort3000) ||
      ingressPort3000.length !== 1 ||
      record(ingressPort3000[0], 'ingress port binding').HostIp !== '127.0.0.1' ||
      record(ingressPort3000[0], 'ingress port binding').HostPort !== String(port)
    ) {
      fail('ingress container must publish only the requested loopback port');
    }
    const networkInspectResult = capture(
      'docker',
      ['network', 'inspect', internalNetworkName, ingressNetworkName],
      'smoke-network-inspect',
    );
    const networkInspectRaw = parseJsonOutput(networkInspectResult, 'docker network inspect');
    if (!Array.isArray(networkInspectRaw) || networkInspectRaw.length !== 2) {
      fail('docker network inspect must return both smoke networks');
    }
    const inspectedNetworks = new Map(networkInspectRaw.map((value) => {
      const network = record(value, 'smoke network');
      return [stringValue(network.Name, 'smoke network name'), network];
    }));
    const inspectedInternalNetwork = record(inspectedNetworks.get(internalNetworkName), 'internal smoke network');
    const inspectedIngressNetwork = record(inspectedNetworks.get(ingressNetworkName), 'ingress smoke network');
    if (inspectedInternalNetwork.Internal !== true || inspectedIngressNetwork.Internal !== false) {
      fail('WebUI smoke network must be internal and host-ingress network must be non-internal');
    }
    const containerLogs = capture('docker', ['logs', '--tail', '500', containerName], 'container-logs');
    const ingressLogs = capture('docker', ['logs', '--tail', '100', ingressContainerName], 'ingress-container-logs');
    if (/\bnpm\s+(?:ci|install)\b|\bgit\s+clone\b/i.test(`${containerLogs.stdout}\n${containerLogs.stderr}`) || /\bnpm\b|\bgit\b|\bcurl\b|\bwget\b/i.test(`${ingressLogs.stdout}\n${ingressLogs.stderr}`)) {
      fail('container logs show a forbidden secondary dependency fetch command');
    }
    const eventUntil = Math.floor(Date.now() / 1000) + 1;
    const imageEvents = capture('docker', [
      'events', '--since', String(eventSince), '--until', String(eventUntil), '--filter', 'type=image', '--format', '{{json .}}',
    ], 'image-events-after-pull');
    const pullEvents = imageEvents.stdout.split(/\r?\n/).filter((line) => line.trim()).filter((line) => {
      try {
        const event = record(JSON.parse(line), 'docker image event');
        return String(event.Action ?? event.status ?? '').toLowerCase() === 'pull';
      } catch {
        return /\bpull\b/i.test(line);
      }
    });
    if (pullEvents.length !== 0) fail('Docker recorded an image pull after the initial exact-digest pull');

    receipt = {
      schema: receiptSchema,
      status: 'passed',
      run_id: runId,
      observed_at: new Date().toISOString(),
      lane: 'windows_wsl2_native_post_public_smoke',
      publication,
      image: {
        requested_ref: identity.requestedRef,
        repository: identity.repository,
        digest: identity.digest,
        image_id: imageId,
        repo_digests: repoDigests,
        os: imageInspect.Os,
        architecture: imageInspect.Architecture,
        labels: Object.fromEntries(requiredImageLabels.map((key) => [key, imageLabels[key]])),
      },
      host: {
        platform: 'windows_wsl2',
        wsl2: { raw_evidence: wsl.stdout_path },
        docker: {
          version: parseJsonOutput(dockerVersion, 'docker version'),
          info: parseJsonOutput(dockerInfo, 'docker info'),
          pre_containers_evidence: preContainers.stdout_path,
          pre_images_evidence: preImages.stdout_path,
        },
        storage: { windows: parseJsonOutput(windows, 'Windows baseline'), wsl_evidence: wsl.stdout_path },
      },
      runtime: {
        container_name: containerName,
        container_id: stringValue(containerInspect.Id, 'container inspect Id'),
        container_image_id: String(containerInspect.Image),
        container_labels: {
          ...Object.fromEntries(requiredImageLabels.map((key) => [key, containerLabels[key]])),
          'dev.onepersonlab.validation.owner': containerLabels['dev.onepersonlab.validation.owner'],
          'dev.onepersonlab.validation.run-id': containerLabels['dev.onepersonlab.validation.run-id'],
        },
        internal_network: true,
        internal_network_name: internalNetworkName,
        network_names: containerNetworks,
        ingress: {
          container_name: ingressContainerName,
          container_id: stringValue(ingressInspect.Id, 'ingress inspect Id'),
          container_image_id: String(ingressInspect.Image),
          container_labels: {
            ...Object.fromEntries(requiredImageLabels.map((key) => [key, ingressLabels[key]])),
            'dev.onepersonlab.validation.owner': ingressLabels['dev.onepersonlab.validation.owner'],
            'dev.onepersonlab.validation.run-id': ingressLabels['dev.onepersonlab.validation.run-id'],
            'dev.onepersonlab.validation.role': ingressLabels['dev.onepersonlab.validation.role'],
          },
          same_exact_image: ingressInspect.Image === imageId,
          read_only: ingressHostConfig.ReadonlyRootfs === true,
          host_volumes: ingressHostMounts.length,
          tmpfs_mounts: ingressTmpfsMounts.length,
          non_root: ingressConfig.User === '65532:65532',
          fixed_node_tcp_proxy: ingressEntrypoint[0] === '/usr/local/bin/node' &&
            ingressEntrypoint[1] === '-e' &&
            ingressCommand[0] === ingressProxyScript,
          cap_drop_all: capDrop.includes('ALL'),
          no_new_privileges: securityOpt.some((value) => value === 'no-new-privileges' || value === 'no-new-privileges:true'),
          proxy_environment_cleared: proxyEnvironmentKeys.every((key) => ingressEnvironment.includes(`${key}=`)),
          network_names: ingressNetworks,
        },
      },
      http: secondHttp,
      ui,
      persistence: {
        status: 'passed',
        data_marker: 'preserved',
        projects_marker: 'preserved',
        recreate_count: 1,
      },
      no_secondary_fetch: {
        status: 'passed',
        isolated_empty_docker_config: true,
        compose_pull_policy: 'never',
        compose_up_pull_mode: 'never',
        internal_network: inspectedInternalNetwork.Internal === true,
        image_pull_events_after_initial_pull: pullEvents.length,
        ingress_uses_same_exact_image: ingressInspect.Image === imageId,
        webui_only_internal_network: containerNetworks.length === 1 &&
          containerNetworks[0] === internalNetworkName &&
          inspectedInternalNetwork.Internal === true &&
          inspectedIngressNetwork.Internal === false,
        pull_provenance: pullProvenance,
      },
      cleanup: {
        status: 'pending',
        owned_containers_remaining: -1,
        owned_networks_remaining: -1,
        runtime_directory_remaining: true,
      },
      bounded_execution: {
        pull_timeout_seconds: pullTimeoutSeconds,
        command_timeout_seconds: commandTimeoutSeconds,
        health_timeout_seconds: healthTimeoutSeconds,
        cleanup_always_runs: true,
      },
      failure: null,
      first_http_evidence: firstHttp,
    };
  } catch (error) {
    failure = {
      message: error instanceof Error ? error.message : String(error),
      observed_at: new Date().toISOString(),
      event_since: eventSince || null,
    };
    writeJson(failurePath, failure);
  } finally {
    const composeDown = capture(
      'docker',
      ['compose', '-p', projectName, '-f', composePath, 'down', '--remove-orphans', '--timeout', '15'],
      'cleanup-compose-down',
      commandTimeoutSeconds,
      true,
    );
    const remainingContainers = capture('docker', [
      'ps', '-a', '--filter', 'label=dev.onepersonlab.validation.owner=native-windows-smoke', '--filter', `label=dev.onepersonlab.validation.run-id=${runId}`, '--format', '{{.ID}}',
    ], 'cleanup-container-readback', commandTimeoutSeconds, true);
    const remainingNetworks = capture('docker', [
      'network', 'ls', '--filter', 'label=dev.onepersonlab.validation.owner=native-windows-smoke', '--filter', `label=dev.onepersonlab.validation.run-id=${runId}`, '--format', '{{.ID}}',
    ], 'cleanup-network-readback', commandTimeoutSeconds, true);
    fs.rmSync(runtimeDir, { recursive: true, force: true });
    const cleanup = cleanupEvidence(composeDown, remainingContainers, remainingNetworks, fs.existsSync(runtimeDir));
    const commandIndexPath = path.join(artifactDir, 'command-index.json');
    writeJson(commandIndexPath, { schema: 'opl_app_webui_native_windows_command_index.v1', commands });
    if (pullProvenance?.mode === 'performed_in_this_run') {
      pullProvenance.evidence_path = path.basename(commandIndexPath);
      pullProvenance.evidence_sha256 = digestFile(commandIndexPath);
    }
    if (receipt) {
      receipt.cleanup = cleanup;
      delete receipt.first_http_evidence;
      try {
        validateNativeWindowsSmokeReceipt(receipt);
      } catch (error) {
        failure = { message: error instanceof Error ? error.message : String(error), observed_at: new Date().toISOString() };
      }
      if (!failure) writeJson(receiptPath, receipt);
    }
    if (failure) writeJson(failurePath, failure);
  }
  if (failure || !receipt) fail(`Native Windows smoke failed; see ${failurePath}`);
  console.log(JSON.stringify({ status: 'passed', receipt: receiptPath, image_ref: identity.requestedRef, cleanup: receipt.cleanup }, null, values.json ? 0 : 2));
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  execute().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
