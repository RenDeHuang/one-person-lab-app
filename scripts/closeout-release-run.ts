#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { findFileByName, runGitHubCli as runGh } from './release-file-helpers.ts';
import {
  arrayOrEmpty as asArray,
  numberField,
  readJsonFile as readJson,
  recordOrNull as asRecord,
  stringField,
} from './release-json-helpers.ts';
import {
  buildCloseoutBottlenecks,
  buildCloseoutOptimizationRecommendations,
  fullPackageTuning,
} from './closeout-release-run-parts/full-package-tuning.ts';
import { writeCloseoutMarkdown } from './closeout-release-run-parts/markdown.ts';
import {
  readReceipt,
  receiptFileSha256,
  validatePromotionSagaReceipt,
} from './release-saga-receipts.ts';
import { readStableReleaseSession, type StableReleaseSession } from './stable-release-session.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultRepo = 'gaofeng21cn/one-person-lab-app';
const commandMaxBuffer = 16 * 1024 * 1024;

type ArtifactProfile = 'primary' | 'diagnostics' | 'readiness-inputs';

type Options = {
  version: string;
  runId: string;
  repo: string;
  outDir: string;
  output: string;
  markdown: string;
  monitor: string;
  notification: string;
  runJsonPath: string;
  jobsJsonPath: string;
  artifactsJsonPath: string;
  artifactsDir: string;
  stableSessionPath: string;
  promotionSagaReceiptPath: string;
  completionManifest: string;
  artifactProfile: ArtifactProfile;
  noDownload: boolean;
  agentStartedAt: string;
  agentFinishedAt: string;
  agentWallTime: string;
};

type DownloadedArtifact = {
  name: string;
  path: string;
};

type ArtifactDownloadResult = {
  mode: 'read_existing' | 'downloaded_generation' | 'no_matching_artifacts';
  generation_id: string | null;
  committed_path: string;
  previous_generation_path: string | null;
  downloaded: DownloadedArtifact[];
};

type JsonRecord = Record<string, unknown>;

type ArtifactJson = {
  path: string | null;
  absolutePath: string | null;
  payload: JsonRecord | null;
};

type CandidatePromotionValidation = {
  command: string;
  exit_status: number | null;
  promote_ready: boolean;
  summary: JsonRecord | null;
  errors: string[];
};

type AttestationVerificationSummary = {
  state: 'verified' | 'failed' | 'missing';
  role: 'build_integrity_evidence';
  source_path: string | null;
  verification: JsonRecord | null;
  verify_commands: string[];
  does_not_replace: string[];
  rule: string;
};

type StableTerminalEvidence = {
  status: 'unavailable' | 'invalid' | 'published_verified' | 'standard_terminal_verified';
  authority: 'canonical_stable_session_and_exact_promotion_saga_receipt';
  diagnostics_only: true;
  stable_session_path: string | null;
  promotion_saga_receipt_path: string | null;
  stable_session_id: string | null;
  session_revision: number | null;
  session_phase: string | null;
  observed_run_role: 'source_release' | 'promotion' | null;
  published: boolean;
  standard_terminal: boolean;
  errors: string[];
  routes: {
    status: string;
    resume: string;
  };
};

type OutputGeneration = {
  schema: 'opl_release_closeout_output_generation.v1';
  id: string;
  generated_at: string;
  required_output_count: 4;
  completion_manifest: string;
};

const forbiddenLargeArtifactPatterns = [
  /^macos-build-/,
  /^opl-full-first-install-\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?-mac-arm64$/,
];

function defaultOptions(): Options {
  return {
    version: process.env.OPL_RELEASE_VERSION || '',
    runId: process.env.OPL_RELEASE_RUN_ID || '',
    repo: process.env.OPL_RELEASE_REPO || defaultRepo,
    outDir: process.env.OPL_RELEASE_CLOSEOUT_DIR || '',
    output: process.env.OPL_RELEASE_CLOSEOUT_OUTPUT || '',
    markdown: process.env.OPL_RELEASE_CLOSEOUT_MARKDOWN || '',
    monitor: process.env.OPL_RELEASE_MONITOR_OUTPUT || '',
    notification: process.env.OPL_RELEASE_NOTIFICATION_OUTPUT || '',
    runJsonPath: process.env.OPL_RELEASE_CLOSEOUT_RUN_JSON || '',
    jobsJsonPath: process.env.OPL_RELEASE_CLOSEOUT_JOBS_JSON || '',
    artifactsJsonPath: process.env.OPL_RELEASE_CLOSEOUT_ARTIFACTS_JSON || '',
    artifactsDir: process.env.OPL_RELEASE_CLOSEOUT_ARTIFACTS_DIR || '',
    stableSessionPath: process.env.OPL_RELEASE_STABLE_SESSION || '',
    promotionSagaReceiptPath: process.env.OPL_RELEASE_PROMOTION_SAGA_RECEIPT || '',
    completionManifest: process.env.OPL_RELEASE_CLOSEOUT_COMPLETION_MANIFEST || '',
    artifactProfile: (process.env.OPL_RELEASE_CLOSEOUT_ARTIFACT_PROFILE as ArtifactProfile) || 'primary',
    noDownload: false,
    agentStartedAt: process.env.OPL_AGENT_STARTED_AT || '',
    agentFinishedAt: process.env.OPL_AGENT_FINISHED_AT || '',
    agentWallTime: process.env.OPL_AGENT_WALL_TIME || '',
  };
}

function usage(): void {
  process.stdout.write(`Usage:
  npm run release:closeout -- --version <version> --run-id <github-actions-run-id>
  npm run release:closeout -- --version <version> --run-json <path> --jobs-json <path> --artifacts-dir <path> --no-download

Options:
  --version <version>              OPL release version, for example 26.6.20.
  --run-id <id>                    GitHub Actions release run id.
  --repo <owner/name>              GitHub repository. Default: ${defaultRepo}
  --out-dir <path>                 Output directory.
  --output-dir <path>              Alias for --out-dir.
  --output <path>                  Write release-closeout.json.
  --markdown <path>                Write release-closeout.md.
  --monitor <path>                 Write release-monitor.json.
  --notification <path>            Write release-notification.json.
  --run-json <path>                Read saved gh run JSON instead of fetching.
  --jobs-json <path>               Read saved jobs JSON.
  --artifacts-json <path>          Read saved artifact list JSON.
  --artifacts-dir <path>           Directory containing downloaded small release artifacts.
  --stable-session <path>          Canonical opl_app_stable_release_session.v3 state (diagnostic read only).
  --promotion-saga-receipt <path>  Exact receipt bytes bound by the canonical stable session.
  --completion-manifest <path>     Write the output-generation completion manifest last.
  --artifact-profile <profile>     primary, diagnostics, or readiness-inputs. Default: primary.
  --no-download                    Do not download artifacts; read --artifacts-dir only.
  --agent-wall-time <duration>     Operator-loop duration, for example 2h6m43s.
  --agent-started-at <iso>         Operator-loop start timestamp.
  --agent-finished-at <iso>        Operator-loop finish timestamp.
  --help                          Show this message.
`);
}

function parseArtifactProfile(value: string): ArtifactProfile {
  if (value === 'primary' || value === 'diagnostics' || value === 'readiness-inputs') {
    return value;
  }
  throw new Error('--artifact-profile must be primary, diagnostics, or readiness-inputs.');
}

function parseArgs(argv: string[]): Options {
  const parsed = defaultOptions();
  const { values, tokens } = parseNodeArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'string' },
      'run-id': { type: 'string', multiple: true },
      repo: { type: 'string' },
      'out-dir': { type: 'string' },
      'output-dir': { type: 'string' },
      output: { type: 'string' },
      markdown: { type: 'string' },
      monitor: { type: 'string' },
      notification: { type: 'string' },
      'run-json': { type: 'string', multiple: true },
      'jobs-json': { type: 'string' },
      'artifacts-json': { type: 'string' },
      'artifacts-dir': { type: 'string' },
      'stable-session': { type: 'string' },
      'promotion-saga-receipt': { type: 'string' },
      'completion-manifest': { type: 'string' },
      'artifact-profile': { type: 'string' },
      'no-download': { type: 'boolean' },
      'agent-started-at': { type: 'string' },
      'agent-finished-at': { type: 'string' },
      'agent-wall-time': { type: 'string' },
    },
    tokens: true,
  });

  if (values.help) {
    usage();
    process.exit(0);
  }

  parsed.version = values.version ?? parsed.version;
  parsed.runId = values['run-id']?.at(-1) ?? parsed.runId;
  parsed.repo = values.repo ?? parsed.repo;
  parsed.output = values.output ?? parsed.output;
  parsed.markdown = values.markdown ?? parsed.markdown;
  parsed.monitor = values.monitor ?? parsed.monitor;
  parsed.notification = values.notification ?? parsed.notification;
  parsed.runJsonPath = values['run-json']?.at(-1) ?? parsed.runJsonPath;
  parsed.jobsJsonPath = values['jobs-json'] ?? parsed.jobsJsonPath;
  parsed.artifactsJsonPath = values['artifacts-json'] ?? parsed.artifactsJsonPath;
  parsed.artifactsDir = values['artifacts-dir'] ?? parsed.artifactsDir;
  parsed.stableSessionPath = values['stable-session'] ?? parsed.stableSessionPath;
  parsed.promotionSagaReceiptPath = values['promotion-saga-receipt'] ?? parsed.promotionSagaReceiptPath;
  parsed.completionManifest = values['completion-manifest'] ?? parsed.completionManifest;
  parsed.agentStartedAt = values['agent-started-at'] ?? parsed.agentStartedAt;
  parsed.agentFinishedAt = values['agent-finished-at'] ?? parsed.agentFinishedAt;
  parsed.agentWallTime = values['agent-wall-time'] ?? parsed.agentWallTime;
  parsed.noDownload = values['no-download'] ?? parsed.noDownload;

  const outDirToken = tokens
    .filter((token) => token.kind === 'option' && (token.name === 'out-dir' || token.name === 'output-dir'))
    .at(-1);
  if (outDirToken?.value) parsed.outDir = outDirToken.value;
  if (values['artifact-profile']) parsed.artifactProfile = parseArtifactProfile(values['artifact-profile']);

  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.runId.trim() && !parsed.runJsonPath.trim()) {
    throw new Error('Pass --run-id <github-actions-run-id> or --run-json <local-run-json>.');
  }

  const closeoutId = parsed.runId || 'local';
  const outDir = parsed.outDir
    ? path.resolve(parsed.outDir)
    : path.resolve(appRoot, 'artifacts', 'release-closeout', `v${parsed.version}-${closeoutId}`);
  const resolved = {
    ...parsed,
    outDir,
    output: parsed.output ? path.resolve(parsed.output) : path.join(outDir, 'release-closeout.json'),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : path.join(outDir, 'release-closeout.md'),
    monitor: parsed.monitor ? path.resolve(parsed.monitor) : path.join(outDir, 'release-monitor.json'),
    notification: parsed.notification ? path.resolve(parsed.notification) : path.join(outDir, 'release-notification.json'),
    runJsonPath: parsed.runJsonPath ? path.resolve(parsed.runJsonPath) : '',
    jobsJsonPath: parsed.jobsJsonPath ? path.resolve(parsed.jobsJsonPath) : '',
    artifactsJsonPath: parsed.artifactsJsonPath ? path.resolve(parsed.artifactsJsonPath) : '',
    artifactsDir: parsed.artifactsDir ? path.resolve(parsed.artifactsDir) : path.join(outDir, 'artifacts'),
    stableSessionPath: parsed.stableSessionPath ? path.resolve(parsed.stableSessionPath) : '',
    promotionSagaReceiptPath: parsed.promotionSagaReceiptPath ? path.resolve(parsed.promotionSagaReceiptPath) : '',
    completionManifest: parsed.completionManifest
      ? path.resolve(parsed.completionManifest)
      : path.join(outDir, 'release-closeout-completion.json'),
  };
  const outputPaths = [resolved.output, resolved.markdown, resolved.monitor, resolved.notification, resolved.completionManifest];
  if (new Set(outputPaths).size !== outputPaths.length) {
    throw new Error('Closeout output and completion-manifest paths must be distinct.');
  }
  return resolved;
}

function fsyncDirectory(directoryPath: string): void {
  const descriptor = fs.openSync(directoryPath, 'r');
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function writeFileAtomic(filePath: string, bytes: string | Buffer): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporaryPath, filePath);
    fsyncDirectory(path.dirname(filePath));
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    fs.rmSync(temporaryPath, { force: true });
  }
}

function writeJson(filePath: string, payload: unknown): void {
  writeFileAtomic(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function parseDateMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function secondsBetween(start: unknown, end: unknown): number | null {
  const left = parseDateMs(start);
  const right = parseDateMs(end);
  if (left === null || right === null || right < left) return null;
  return Math.round((right - left) / 1000);
}

function parseDurationSeconds(value: string): number | null {
  if (!value.trim()) return null;
  const compact = value.trim();
  if (/^\d+$/.test(compact)) return Number(compact);
  const hms = compact.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (hms && hms[0]) {
    return Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0);
  }
  const colon = compact.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (colon) {
    return colon[3]
      ? Number(colon[1]) * 3600 + Number(colon[2]) * 60 + Number(colon[3])
      : Number(colon[1]) * 60 + Number(colon[2]);
  }
  return null;
}

function normalizeRunPayload(payload: unknown): JsonRecord {
  const record = asRecord(payload);
  if (!record) throw new Error('Run JSON must be an object.');
  return record;
}

function normalizeJobsPayload(payload: unknown): JsonRecord[] {
  const record = asRecord(payload);
  const source = Array.isArray(payload)
    ? payload
    : asArray(record?.jobs ?? record?.workflow_jobs);
  return source
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => entry !== null);
}

function normalizeArtifactsPayload(payload: unknown): JsonRecord[] {
  const record = asRecord(payload);
  const source = Array.isArray(payload) ? payload : asArray(record?.artifacts);
  return source
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => entry !== null);
}

function fetchRun(options: Options): JsonRecord {
  if (options.runJsonPath) return normalizeRunPayload(readJson(options.runJsonPath));
  const stdout = runGh([
    'run',
    'view',
    options.runId,
    '--repo',
    options.repo,
    '--json',
    [
      'databaseId',
      'status',
      'conclusion',
      'createdAt',
      'updatedAt',
      'startedAt',
      'headSha',
      'headBranch',
      'workflowName',
      'displayTitle',
      'event',
      'url',
      'jobs',
    ].join(','),
  ], 'Fetch release run', { cwd: appRoot, maxBuffer: commandMaxBuffer });
  return normalizeRunPayload(JSON.parse(stdout));
}

function fetchJobs(options: Options, run: JsonRecord): JsonRecord[] {
  if (options.jobsJsonPath) return normalizeJobsPayload(readJson(options.jobsJsonPath));
  const embedded = normalizeJobsPayload(run.jobs ? { jobs: run.jobs } : []);
  if (embedded.length > 0) return embedded;
  if (!options.runId) return [];
  const stdout = runGh([
    'run',
    'view',
    options.runId,
    '--repo',
    options.repo,
    '--json',
    'jobs',
  ], 'Fetch release run jobs', { cwd: appRoot, maxBuffer: commandMaxBuffer });
  return normalizeJobsPayload(JSON.parse(stdout));
}

function fetchArtifacts(options: Options): JsonRecord[] {
  if (options.artifactsJsonPath) return normalizeArtifactsPayload(readJson(options.artifactsJsonPath));
  if (!options.runId || options.noDownload) return [];
  const [owner, repoName] = options.repo.split('/');
  if (!owner || !repoName) throw new Error(`Repository must use owner/name form: ${options.repo}`);
  const stdout = runGh([
    'api',
    `/repos/${owner}/${repoName}/actions/runs/${options.runId}/artifacts`,
    '-H',
    'Accept: application/vnd.github+json',
  ], 'Fetch release run artifacts', { cwd: appRoot, maxBuffer: commandMaxBuffer });
  return normalizeArtifactsPayload(JSON.parse(stdout));
}

function artifactNames(options: Options): string[] {
  const base = [
    `release-candidate-record-${options.version}`,
    `release-readiness-summary-${options.version}`,
    `release-addon-readiness-summary-${options.version}`,
    `release-preflight-summary-${options.version}`,
    `remote-release-verification-${options.version}`,
  ];
  const diagnostics = [
    `opl-full-workflow-telemetry-${options.version}`,
    `opl-full-diagnostics-${options.version}`,
  ];
  const readinessInputs = [
    `opl-first-run-vm-standard-${options.runId}`,
    `opl-first-run-vm-homebrew-standard-${options.runId}`,
    `homebrew-tap-plan-stable-app_standard-${options.version}`,
    `homebrew-tap-plan-stable-app_full_first_install-${options.version}`,
    `opl-first-run-vm-full-${options.runId}`,
    `one-shot-app-installer-smoke-${options.version}`,
    `docker-webui-smoke-${options.version}`,
    `webui-ghcr-publish-${options.version}`,
    `release-evidence-bundle-${options.version}`,
  ].filter((name) => !name.endsWith('-'));
  if (options.artifactProfile === 'primary') return base;
  if (options.artifactProfile === 'diagnostics') return [...base, ...diagnostics];
  return [...base, ...diagnostics, ...readinessInputs];
}

function isForbiddenLargeArtifact(name: string): boolean {
  return forbiddenLargeArtifactPatterns.some((pattern) => pattern.test(name));
}

function validateDownloadedArtifactDirectory(artifactName: string, artifactDirectory: string): void {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      const relative = path.relative(artifactDirectory, entryPath);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Downloaded artifact ${artifactName} escaped its staging directory.`);
      }
      if (entry.isSymbolicLink()) {
        throw new Error(`Downloaded artifact ${artifactName} contains a symbolic link: ${relative}`);
      }
      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Downloaded artifact ${artifactName} contains a non-file entry: ${relative}`);
      }
      files.push(entryPath);
      if (entry.name.endsWith('.json')) {
        JSON.parse(fs.readFileSync(entryPath, 'utf8'));
      }
    }
  };
  if (!fs.statSync(artifactDirectory).isDirectory()) {
    throw new Error(`Downloaded artifact ${artifactName} is not a directory.`);
  }
  visit(artifactDirectory);
  if (files.length === 0) throw new Error(`Downloaded artifact ${artifactName} is empty.`);
}

function downloadArtifacts(options: Options, artifacts: JsonRecord[]): ArtifactDownloadResult {
  if (options.noDownload || !options.runId) {
    return {
      mode: 'read_existing',
      generation_id: null,
      committed_path: options.artifactsDir,
      previous_generation_path: null,
      downloaded: [],
    };
  }
  fs.mkdirSync(path.dirname(options.artifactsDir), { recursive: true });
  const available = new Set(artifacts.map((artifact) => stringField(artifact, 'name')).filter(Boolean) as string[]);
  const downloaded: DownloadedArtifact[] = [];
  const generationToken = `${Date.now()}-${process.pid}-${crypto.randomUUID()}`;
  const stagingRoot = `${options.artifactsDir}.staging-${generationToken}`;
  const previousRoot = `${options.artifactsDir}.previous-${generationToken}`;
  let previousMoved = false;
  let generationCommitted = false;
  fs.mkdirSync(stagingRoot, { recursive: false });
  try {
    for (const name of artifactNames(options)) {
      if (isForbiddenLargeArtifact(name)) {
        throw new Error(`Refusing to download large release artifact: ${name}`);
      }
      if (available.size > 0 && !available.has(name)) continue;
      const stagedArtifactDir = path.join(stagingRoot, name);
      fs.mkdirSync(stagedArtifactDir, { recursive: true });
      runGh([
        'run',
        'download',
        options.runId,
        '--repo',
        options.repo,
        '--name',
        name,
        '--dir',
        stagedArtifactDir,
      ], `Download artifact ${name}`, { cwd: appRoot, maxBuffer: commandMaxBuffer });
      validateDownloadedArtifactDirectory(name, stagedArtifactDir);
      downloaded.push({ name, path: path.join(options.artifactsDir, name) });
    }
    if (downloaded.length === 0) {
      return {
        mode: 'no_matching_artifacts',
        generation_id: generationToken,
        committed_path: options.artifactsDir,
        previous_generation_path: null,
        downloaded,
      };
    }
    if (fs.existsSync(options.artifactsDir)) {
      fs.renameSync(options.artifactsDir, previousRoot);
      previousMoved = true;
    }
    try {
      fs.renameSync(stagingRoot, options.artifactsDir);
      fsyncDirectory(path.dirname(options.artifactsDir));
      generationCommitted = true;
    } catch (error) {
      if (previousMoved && !fs.existsSync(options.artifactsDir)) {
        fs.renameSync(previousRoot, options.artifactsDir);
        fsyncDirectory(path.dirname(options.artifactsDir));
      }
      throw error;
    }
    return {
      mode: 'downloaded_generation',
      generation_id: generationToken,
      committed_path: options.artifactsDir,
      previous_generation_path: previousMoved ? previousRoot : null,
      downloaded,
    };
  } finally {
    if (!generationCommitted) fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

function readArtifactJson(options: Options, artifactName: string, fileName: string): ArtifactJson {
  const root = path.join(options.artifactsDir, artifactName);
  const filePath = findFileByName(root, fileName);
  if (!filePath) return { path: null, absolutePath: null, payload: null };
  return {
    path: path.relative(options.outDir, filePath),
    absolutePath: filePath,
    payload: asRecord(readJson(filePath)),
  };
}

function readJsonByName(options: Options, fileName: string): ArtifactJson {
  const filePath = findFileByName(options.artifactsDir, fileName);
  if (!filePath) return { path: null, absolutePath: null, payload: null };
  return {
    path: path.relative(options.outDir, filePath),
    absolutePath: filePath,
    payload: asRecord(readJson(filePath)),
  };
}

function attestationVerifyCommands(options: Options): string[] {
  return [
    `gh attestation verify <downloaded-release-asset-path> --repo ${options.repo}`,
    `gh attestation verify oci://ghcr.io/gaofeng21cn/one-person-lab-webui@sha256:<digest> --repo ${options.repo}`,
  ];
}

function summarizeAttestationVerification(options: Options): AttestationVerificationSummary {
  const artifactName = `release-attestation-verification-${options.version}`;
  const artifact = readArtifactJson(options, artifactName, 'attestation-verification.json');
  const artifactSummary = artifact.payload
    ? artifact
    : readArtifactJson(options, artifactName, 'attestation-verification-summary.json');
  const rootSummary = artifactSummary.payload
    ? artifactSummary
    : readJsonByName(options, 'attestation-verification.json');
  const fallback = rootSummary.payload ? rootSummary : readJsonByName(options, 'attestation-verification-summary.json');
  const verification = fallback.payload;
  const status = verification ? sourceStatus(verification) : 'missing';
  const verified = status === 'passed' || status === 'success' || status === 'verified';
  return {
    state: verification ? (verified ? 'verified' : 'failed') : 'missing',
    role: 'build_integrity_evidence',
    source_path: fallback.path,
    verification,
    verify_commands: verification ? [] : attestationVerifyCommands(options),
    does_not_replace: [
      'checksum verification',
      'remote asset readback',
      'codesign/spctl',
      'clean install/VM readiness',
      'candidate-record validation',
      'release-owner receipt',
    ],
    rule: 'Artifact attestation verifies build integrity for public release bytes; it is not release readiness evidence by itself.',
  };
}

function jobDuration(job: JsonRecord): number | null {
  const started = job.startedAt ?? job.started_at;
  const completed = job.completedAt ?? job.completed_at;
  return secondsBetween(started, completed);
}

function jobName(job: JsonRecord): string {
  return stringField(job, 'name') ?? stringField(job, 'displayName') ?? stringField(job, 'job_name') ?? 'unknown';
}

function summarizeJobs(jobs: JsonRecord[]) {
  const slowest = jobs
    .map((job) => ({
      name: jobName(job),
      status: stringField(job, 'status'),
      conclusion: stringField(job, 'conclusion'),
      started_at: stringField(job, 'startedAt') ?? stringField(job, 'started_at'),
      completed_at: stringField(job, 'completedAt') ?? stringField(job, 'completed_at'),
      duration_seconds: jobDuration(job),
    }))
    .sort((left, right) => Number(right.duration_seconds ?? -1) - Number(left.duration_seconds ?? -1));
  const failed = slowest.filter((job) => job.conclusion && job.conclusion !== 'success' && job.conclusion !== 'skipped');
  return {
    count: jobs.length,
    slowest_jobs: slowest.slice(0, 12),
    failed_jobs: failed,
  };
}

function summarizeRunTiming(run: JsonRecord, jobs: JsonRecord[]) {
  const createdAt = stringField(run, 'createdAt') ?? stringField(run, 'created_at');
  const startedAt = stringField(run, 'runStartedAt')
    ?? stringField(run, 'run_started_at')
    ?? stringField(run, 'startedAt')
    ?? stringField(run, 'started_at');
  const updatedAt = stringField(run, 'updatedAt') ?? stringField(run, 'updated_at');
  const jobStarts = jobs
    .map((job) => parseDateMs(job.startedAt ?? job.started_at))
    .filter((value): value is number => value !== null);
  const jobEnds = jobs
    .map((job) => parseDateMs(job.completedAt ?? job.completed_at))
    .filter((value): value is number => value !== null);
  const firstJobStartMs = jobStarts.length > 0 ? Math.min(...jobStarts) : null;
  const lastJobEndMs = jobEnds.length > 0 ? Math.max(...jobEnds) : null;
  const createdMs = parseDateMs(createdAt);
  const updatedMs = parseDateMs(updatedAt);
  const firstJobStartedAt = firstJobStartMs !== null ? new Date(firstJobStartMs).toISOString() : null;
  return {
    created_at: createdAt,
    run_started_at: startedAt,
    first_job_started_at: firstJobStartedAt,
    updated_at: updatedAt,
    workflow_wall_time_seconds: secondsBetween(createdAt, updatedAt),
    queue_or_admission_seconds: createdMs !== null && firstJobStartMs !== null
      ? Math.round((firstJobStartMs - createdMs) / 1000)
      : secondsBetween(createdAt, startedAt),
    runner_execution_seconds: firstJobStartMs !== null && updatedMs !== null && updatedMs >= firstJobStartMs
      ? Math.round((updatedMs - firstJobStartMs) / 1000)
      : secondsBetween(startedAt, updatedAt),
    first_job_delay_seconds: createdMs !== null && firstJobStartMs !== null
      ? Math.round((firstJobStartMs - createdMs) / 1000)
      : null,
    job_span_seconds: firstJobStartMs !== null && lastJobEndMs !== null && lastJobEndMs >= firstJobStartMs
      ? Math.round((lastJobEndMs - firstJobStartMs) / 1000)
      : null,
  };
}

function sourceStatus(record: JsonRecord | null): string {
  return stringField(record, 'status') ?? 'missing';
}

function artifactPresenceStatus(record: JsonRecord | null): string {
  if (!record) return 'missing';
  return stringField(record, 'status') ?? 'present';
}

function failedGateSummaries(readiness: JsonRecord | null) {
  return asArray(readiness?.failed_required_gates)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => entry !== null)
    .map((entry) => ({
      id: stringField(entry, 'id') ?? 'unknown',
      status: stringField(entry, 'status') ?? 'unknown',
      reason: stringField(entry, 'reason') ?? 'no reason recorded',
    }));
}

function previousRunDurationSeconds(run: JsonRecord): number | null {
  return numberField(run, 'workflow_wall_time_seconds')
    ?? numberField(run, 'duration_seconds')
    ?? secondsBetween(
      run.createdAt ?? run.created_at ?? run.startedAt ?? run.started_at,
      run.updatedAt ?? run.updated_at ?? run.completedAt ?? run.completed_at,
    );
}

function failedConclusion(value: string | null) {
  return Boolean(value && value !== 'success' && value !== 'skipped');
}

function summarizeFailedRerunTax(
  run: JsonRecord,
  jobs: ReturnType<typeof summarizeJobs>,
  timing: ReturnType<typeof summarizeRunTiming>,
) {
  const previousRuns = [
    ...asArray(run.previous_runs),
    ...asArray(run.previousRuns),
    ...asArray(run.failed_runs),
    ...asArray(run.failedRuns),
  ]
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => entry !== null);
  const previousFailedRuns = previousRuns
    .filter((entry) => failedConclusion(stringField(entry, 'conclusion')))
    .map((entry) => ({
      id: stringField(entry, 'id') ?? stringField(entry, 'databaseId') ?? stringField(entry, 'run_id'),
      conclusion: stringField(entry, 'conclusion'),
      status: stringField(entry, 'status'),
      url: stringField(entry, 'url'),
      duration_seconds: previousRunDurationSeconds(entry),
    }));
  const previousFailedSeconds = previousFailedRuns
    .reduce((sum, entry) => sum + (entry.duration_seconds ?? 0), 0);
  const currentConclusion = stringField(run, 'conclusion');
  const currentFailedWorkflowSeconds = failedConclusion(currentConclusion)
    ? timing.workflow_wall_time_seconds
    : null;
  const currentFailedJobSeconds = jobs.failed_jobs
    .reduce((sum, job) => sum + (job.duration_seconds ?? 0), 0);
  const failedRerunTaxSeconds = previousFailedSeconds + (currentFailedWorkflowSeconds ?? 0);
  return {
    failed_rerun_tax_seconds: failedRerunTaxSeconds,
    previous_failed_run_count: previousFailedRuns.length,
    previous_failed_runs: previousFailedRuns,
    current_failed_workflow_seconds: currentFailedWorkflowSeconds,
    current_failed_job_tax_seconds: currentFailedJobSeconds,
    source: previousFailedRuns.length > 0
      ? 'run.previous_runs'
      : currentFailedWorkflowSeconds !== null
        ? 'current_run_conclusion'
        : jobs.failed_jobs.length > 0
          ? 'jobs.failed_jobs'
          : 'current_run_no_failed_rerun_tax',
    note: 'Failed rerun tax counts failed workflow wall time when the run metadata includes previous failed runs or the current run itself failed.',
  };
}

function shellArg(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function validatorCommand(options: Options, candidatePath: string): string {
  return [
    'node',
    '--experimental-strip-types',
    'scripts/validate-release-candidate-record.ts',
    '--promote-ready',
    '--version',
    options.version,
    '--record',
    candidatePath,
  ].map(shellArg).join(' ');
}

function validateCandidatePromotion(options: Options, candidatePath: string | null): CandidatePromotionValidation {
  const command = candidatePath
    ? validatorCommand(options, candidatePath)
    : `npm run release:candidate-record:validate -- --version ${options.version} --record <release-candidate-record.json>`;
  if (!candidatePath) {
    return {
      command,
      exit_status: 1,
      promote_ready: false,
      summary: null,
      errors: ['Release candidate record path is missing.'],
    };
  }

  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/validate-release-candidate-record.ts',
    '--promote-ready',
    '--version',
    options.version,
    '--record',
    candidatePath,
  ], {
    cwd: appRoot,
    encoding: 'utf8',
    maxBuffer: commandMaxBuffer,
  });
  const summary = asRecord(result.stdout.trim() ? JSON.parse(result.stdout) : null);
  const summaryErrors = asArray(summary?.errors).map((entry) => String(entry));
  const stderr = result.stderr.trim();
  const errors = summaryErrors.length > 0
    ? summaryErrors
    : stderr ? [stderr] : [];
  return {
    command,
    exit_status: result.status,
    promote_ready: result.status === 0 && summary?.promote_ready === true,
    summary,
    errors,
  };
}

function ownerResolutionDecision(validation: CandidatePromotionValidation) {
  const releaseOwnerVerdictStatus = stringField(validation.summary, 'release_owner_verdict_status');
  const typedBlockerRef = stringField(validation.summary, 'release_owner_typed_blocker_ref');
  return {
    next_action: 'owner_needed_release_owner_resolution',
    reason: [
      'Candidate record is not promote-ready until the App release owner records a same-cohort owner-resolution ref.',
      ...validation.errors,
    ].join(' '),
    command: validation.command,
    owner_resolution: {
      promote_ready: validation.promote_ready,
      validator_exit_status: validation.exit_status,
      release_owner_verdict_status: releaseOwnerVerdictStatus,
      release_owner_verdict_ref: stringField(validation.summary, 'release_owner_verdict_ref'),
      release_owner_receipt_ref: stringField(validation.summary, 'release_owner_receipt_ref'),
      typed_blocker_ref: typedBlockerRef,
      errors: validation.errors,
      next_owner_action: typedBlockerRef
        ? `Resolve ${typedBlockerRef} by recording a same-cohort release_owner_verdict_ref or release_owner_receipt_ref.`
        : 'Record a same-cohort release_owner_verdict_ref or release_owner_receipt_ref before promotion.',
    },
  };
}

function runDatabaseId(options: Options, run: JsonRecord): string | null {
  if (options.runId) return options.runId;
  const stringId = stringField(run, 'databaseId') ?? stringField(run, 'id');
  if (stringId) return stringId;
  const numberId = numberField(run, 'databaseId') ?? numberField(run, 'id');
  return numberId === null ? null : String(numberId);
}

function stableSessionRoutes(options: Options) {
  const statePath = options.stableSessionPath || '<canonical-release-session.json>';
  return {
    status: `npm run release:stable -- reconcile --state ${shellArg(statePath)}`,
    resume: `npm run release:stable -- resume --state ${shellArg(statePath)} --execute`,
  };
}

function canonicalSessionId(session: StableReleaseSession): string | null {
  const plan = asRecord(session.cohort_plan);
  const cohortLock = asRecord(plan?.cohort_lock);
  const app = asRecord(cohortLock?.app);
  const shell = asRecord(cohortLock?.shell);
  const framework = asRecord(cohortLock?.framework);
  const version = stringField(plan, 'version');
  const operatorPlanRef = stringField(plan, 'operator_plan_ref');
  const appSha = stringField(app, 'resolved_sha');
  const shellSha = stringField(shell, 'resolved_sha');
  const frameworkSha = stringField(framework, 'resolved_sha');
  if (!version || !operatorPlanRef || !appSha || !shellSha || !frameworkSha) return null;
  const identity = JSON.stringify({
    version,
    operator_plan_ref: operatorPlanRef,
    app_sha: appSha,
    shell_sha: shellSha,
    framework_sha: frameworkSha,
  });
  return `sha256:${crypto.createHash('sha256').update(identity).digest('hex')}`;
}

function expectedPromotionSagaArtifactName(session: StableReleaseSession): string {
  return `opl-promotion-saga-receipt-${session.version}-${session.id.slice('sha256:'.length)}`;
}

function buildStableTerminalEvidence(options: Options, run: JsonRecord): StableTerminalEvidence {
  const routes = stableSessionRoutes(options);
  const base = {
    authority: 'canonical_stable_session_and_exact_promotion_saga_receipt' as const,
    diagnostics_only: true as const,
    stable_session_path: options.stableSessionPath || null,
    promotion_saga_receipt_path: options.promotionSagaReceiptPath || null,
    stable_session_id: null,
    session_revision: null,
    session_phase: null,
    observed_run_role: null,
    published: false,
    standard_terminal: false,
    routes,
  };
  if (!options.stableSessionPath && !options.promotionSagaReceiptPath) {
    return {
      ...base,
      status: 'unavailable',
      errors: [
        'Canonical stable session and exact promotion saga receipt were not supplied; closeout artifact observations are diagnostics only.',
      ],
    };
  }

  const errors: string[] = [];
  if (!options.stableSessionPath) errors.push('canonical stable session path is missing');
  if (!options.promotionSagaReceiptPath) errors.push('exact promotion saga receipt path is missing');
  if (options.stableSessionPath && !fs.existsSync(options.stableSessionPath)) errors.push('canonical stable session file is missing');
  if (options.promotionSagaReceiptPath && !fs.existsSync(options.promotionSagaReceiptPath)) errors.push('promotion saga receipt file is missing');
  if (options.stableSessionPath && fs.existsSync(`${options.stableSessionPath}.lock`)) {
    errors.push('canonical stable session has an active or unrecovered lock');
  }
  if (errors.length > 0) return { ...base, status: 'invalid', errors };

  let session: StableReleaseSession;
  let receipt: unknown;
  try {
    session = readStableReleaseSession(options.stableSessionPath);
  } catch (error) {
    return { ...base, status: 'invalid', errors: [`canonical stable session is unreadable: ${error instanceof Error ? error.message : String(error)}`] };
  }
  try {
    receipt = readReceipt(options.promotionSagaReceiptPath);
  } catch (error) {
    return {
      ...base,
      stable_session_id: session.id,
      session_revision: session.revision,
      session_phase: session.phase,
      status: 'invalid',
      errors: [`promotion saga receipt is unreadable: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  const observedRunId = runDatabaseId(options, run);
  const observedStatus = stringField(run, 'status') ?? 'unknown';
  const observedConclusion = stringField(run, 'conclusion') ?? 'unknown';
  const observedHeadSha = stringField(run, 'headSha') ?? stringField(run, 'head_sha');
  const appSha = session.cohort_plan?.cohort_lock?.app?.resolved_sha;
  const sourceRunId = session.release_run?.id;
  const promotionRunId = session.promotion_run?.id;
  const observedRole = observedRunId && observedRunId === sourceRunId
    ? 'source_release'
    : observedRunId && observedRunId === promotionRunId
      ? 'promotion'
      : null;

  if (session.schema !== 'opl_app_stable_release_session.v3') errors.push(`stable session schema is ${session.schema}`);
  if (!Number.isSafeInteger(session.revision) || session.revision < 1) errors.push('stable session revision is not durably persisted');
  if (session.id !== canonicalSessionId(session)) errors.push('stable session id does not match its frozen cohort identity');
  if (session.version !== options.version || session.cohort_plan.version !== options.version) errors.push('stable session version does not match closeout version');
  if (session.repo !== options.repo) errors.push('stable session repository does not match closeout repository');
  if (!/^\d+$/.test(sourceRunId ?? '') || session.release_run.conclusion !== 'success') {
    errors.push('stable session source release run is not exact and successful');
  }
  if (!/^\d+$/.test(promotionRunId ?? '') || session.promotion_run.conclusion !== 'success') {
    errors.push('stable session promotion run is not exact and successful');
  }
  if (!observedRole) errors.push('observed workflow run is not bound to the stable session source or promotion run');
  if (observedStatus !== 'completed' || observedConclusion !== 'success') {
    errors.push(`observed ${observedRole ?? 'unbound'} run is ${observedStatus}/${observedConclusion}, not completed/success`);
  }
  if (observedRole === 'source_release' && observedHeadSha !== appSha) {
    errors.push('observed source release run head SHA does not match the frozen artifact App SHA');
  }
  const promotionAttempt = [...(session.mutation_attempts ?? [])].reverse().find((attempt) =>
    attempt.mutation === 'promotion_dispatch'
    && attempt.workflow === 'desktop-release-promote.yml'
    && attempt.artifact_app_sha === appSha
    && attempt.events.some((event) => event.run_id === promotionRunId));
  if (!promotionAttempt || promotionAttempt.events.at(-1)?.state !== 'succeeded') {
    errors.push('stable session has no succeeded durable promotion attempt bound to the exact promotion run');
  }
  if (observedRole === 'promotion' && observedHeadSha !== promotionAttempt?.controller_workflow_sha) {
    errors.push('observed promotion run head SHA does not match the durable controller workflow SHA');
  }
  if (!['awaiting_local_activation', 'standard_stable_terminal', 'addon_train_terminal'].includes(session.phase)) {
    errors.push(`stable session phase ${session.phase} is not publication-complete`);
  }

  const sessionReceipt = session.receipts?.promotion_saga;
  if (!sessionReceipt) {
    errors.push('stable session has no promotion saga receipt binding');
  } else {
    if (sessionReceipt.ref !== expectedPromotionSagaArtifactName(session)) {
      errors.push('stable session promotion saga receipt ref is not the canonical artifact identity');
    }
    const receiptDigest = receiptFileSha256(options.promotionSagaReceiptPath);
    if (sessionReceipt.sha256 !== receiptDigest) errors.push('promotion saga receipt bytes do not match the digest bound by the stable session');
  }
  errors.push(...validatePromotionSagaReceipt(receipt, {
    stableSessionId: session.id,
    version: session.version,
  }));

  const published = errors.length === 0;
  const standardTerminal = published
    && session.terminal_truth?.standard_status === 'terminal'
    && ['standard_stable_terminal', 'addon_train_terminal'].includes(session.phase);
  return {
    ...base,
    stable_session_id: session.id,
    session_revision: session.revision,
    session_phase: session.phase,
    observed_run_role: observedRole,
    status: standardTerminal ? 'standard_terminal_verified' : published ? 'published_verified' : 'invalid',
    published,
    standard_terminal: standardTerminal,
    errors,
  };
}

function buildDecision(inputs: {
  options: Options;
  run: JsonRecord;
  candidate: JsonRecord | null;
  candidatePath: string | null;
  readiness: JsonRecord | null;
  remote: JsonRecord | null;
  preflight: JsonRecord | null;
  jobs: ReturnType<typeof summarizeJobs>;
  terminalEvidence: StableTerminalEvidence;
}) {
  const runStatus = stringField(inputs.run, 'status') ?? 'unknown';
  const conclusion = stringField(inputs.run, 'conclusion') ?? 'unknown';
  const candidateStatus = sourceStatus(inputs.candidate);
  const readinessStatus = sourceStatus(inputs.readiness);
  const tag = `v${inputs.options.version}`;

  if (runStatus !== 'completed') {
    return {
      next_action: 'reconcile_canonical_stable_session',
      reason: `Observed source run status is ${runStatus}; candidate/preflight/remote observations cannot authorize promotion while the source run is nonterminal.`,
      command: inputs.terminalEvidence.routes.status,
      routes: inputs.terminalEvidence.routes,
      diagnostics_only: true,
      mutation_authorized: false,
    };
  }
  if (inputs.terminalEvidence.standard_terminal) {
    return {
      next_action: 'stable_terminal_verified',
      reason: 'Canonical stable session and its exact validated promotion saga receipt prove the Standard Stable terminal state.',
      command: inputs.terminalEvidence.routes.status,
      routes: inputs.terminalEvidence.routes,
      diagnostics_only: true,
      mutation_authorized: false,
    };
  }
  if (inputs.terminalEvidence.published) {
    return {
      next_action: 'complete_local_activation_from_canonical_session',
      reason: 'Publication is receipt-verified, but the canonical stable session has not reached the independent Standard terminal state.',
      command: inputs.terminalEvidence.routes.status,
      routes: inputs.terminalEvidence.routes,
      diagnostics_only: true,
      mutation_authorized: false,
    };
  }

  if (candidateStatus === 'ready_to_promote') {
    const validation = validateCandidatePromotion(inputs.options, inputs.candidatePath);
    if (!validation.promote_ready) {
      return {
        ...ownerResolutionDecision(validation),
        diagnostics_only: true,
        mutation_authorized: false,
        routes: inputs.terminalEvidence.routes,
      };
    }
    return {
      next_action: 'reconcile_canonical_stable_session',
      reason: 'Candidate record passed its diagnostic validator, but closeout never authorizes promotion; reconcile the canonical stable session before any resume decision.',
      command: inputs.terminalEvidence.routes.status,
      routes: inputs.terminalEvidence.routes,
      diagnostics_only: true,
      mutation_authorized: false,
      owner_resolution: {
        promote_ready: false,
        candidate_validation_passed: true,
        validator_exit_status: validation.exit_status,
        release_owner_verdict_status: stringField(validation.summary, 'release_owner_verdict_status'),
        release_owner_verdict_ref: stringField(validation.summary, 'release_owner_verdict_ref'),
        release_owner_receipt_ref: stringField(validation.summary, 'release_owner_receipt_ref'),
      },
    };
  }
  if (candidateStatus === 'blocked') {
    return {
      next_action: 'resolve_candidate_record_blockers',
      reason: 'Candidate record is blocked; use blocked_reasons before inspecting raw logs.',
      command: `jq '.blocked_reasons, .required_gate_failures' ${path.join(inputs.options.artifactsDir, `release-candidate-record-${inputs.options.version}`, 'release-candidate-record.json')}`,
      diagnostics_only: true,
      mutation_authorized: false,
      routes: inputs.terminalEvidence.routes,
    };
  }
  if (readinessStatus === 'failed') {
    return {
      next_action: 'resolve_readiness_failed_gates',
      reason: 'Readiness summary failed; inspect failed_required_gates before job logs.',
      command: `jq '.failed_required_gates' ${path.join(inputs.options.artifactsDir, `release-readiness-summary-${inputs.options.version}`, 'release-readiness-summary.json')}`,
      diagnostics_only: true,
      mutation_authorized: false,
      routes: inputs.terminalEvidence.routes,
    };
  }
  if (inputs.jobs.failed_jobs.length > 0 || conclusion !== 'success') {
    return {
      next_action: 'inspect_failed_jobs',
      reason: `Run conclusion is ${conclusion}; structured summaries are incomplete or inconclusive.`,
      command: `gh run view ${inputs.options.runId} --repo ${inputs.options.repo} --log-failed`,
      diagnostics_only: true,
      mutation_authorized: false,
      routes: inputs.terminalEvidence.routes,
    };
  }
  return {
    next_action: 'inspect_missing_candidate_record',
    reason: `Run ${tag} completed but release-candidate-record is ${candidateStatus}.`,
    command: `gh run download ${inputs.options.runId} --repo ${inputs.options.repo} --name release-candidate-record-${inputs.options.version} --dir ${inputs.options.artifactsDir}`,
    diagnostics_only: true,
    mutation_authorized: false,
    routes: inputs.terminalEvidence.routes,
  };
}

function monitorState(input: {
  run: { status: string | null; conclusion: string | null };
  decision: JsonRecord;
  jobs: ReturnType<typeof summarizeJobs>;
  terminalEvidence: StableTerminalEvidence;
}) {
  const runStatus = input.run.status ?? 'unknown';
  const conclusion = input.run.conclusion ?? 'unknown';
  const nextAction = stringField(input.decision, 'next_action') ?? 'unknown';
  if (input.terminalEvidence.standard_terminal) return 'terminal';
  if (input.terminalEvidence.published) return 'published_awaiting_local_activation';
  if (runStatus !== 'completed') return 'running';
  if (
    nextAction === 'owner_needed_release_owner_resolution'
    || nextAction === 'resolve_candidate_record_blockers'
    || nextAction === 'resolve_readiness_failed_gates'
    || nextAction === 'inspect_failed_jobs'
    || input.jobs.failed_jobs.length > 0
  ) {
    return 'failed';
  }
  if (conclusion !== 'success') return 'failed';
  return 'diagnostics_only';
}

function buildSummary(options: Options, outputGeneration: OutputGeneration) {
  const run = fetchRun(options);
  const jobs = fetchJobs(options, run);
  const artifacts = fetchArtifacts(options);
  const artifactDownload = downloadArtifacts(options, artifacts);

  const candidateArtifact = readArtifactJson(options, `release-candidate-record-${options.version}`, 'release-candidate-record.json');
  const readinessArtifact = readArtifactJson(options, `release-readiness-summary-${options.version}`, 'release-readiness-summary.json');
  const addonReadinessArtifact = readArtifactJson(options, `release-addon-readiness-summary-${options.version}`, 'release-addon-readiness-summary.json');
  const preflightArtifact = readArtifactJson(options, `release-preflight-summary-${options.version}`, 'release-preflight-summary.json');
  const remoteArtifact = readArtifactJson(options, `remote-release-verification-${options.version}`, 'remote-release-verification.json');
  const telemetryArtifact = readArtifactJson(options, `opl-full-workflow-telemetry-${options.version}`, 'full-workflow-telemetry.json');
  const diagnosticsArtifact = readArtifactJson(options, `opl-full-diagnostics-${options.version}`, 'runtime-cache-events.json');
  const attestationVerification = summarizeAttestationVerification(options);
  const jobSummary = summarizeJobs(jobs);
  const timing = summarizeRunTiming(run, jobs);
  const agentWallTimeSeconds = options.agentWallTime
    ? parseDurationSeconds(options.agentWallTime)
    : secondsBetween(options.agentStartedAt, options.agentFinishedAt);
  const terminalEvidence = buildStableTerminalEvidence(options, run);
  const decision = buildDecision({
    options,
    run,
    candidate: candidateArtifact.payload,
    candidatePath: candidateArtifact.absolutePath,
    readiness: readinessArtifact.payload,
    remote: remoteArtifact.payload,
    preflight: preflightArtifact.payload,
    jobs: jobSummary,
    terminalEvidence,
  });
  const fullPackageProfile = fullPackageTuning(
    readinessArtifact.payload,
    telemetryArtifact.payload,
    diagnosticsArtifact.payload,
  );
  const failedRerunTax = summarizeFailedRerunTax(run, jobSummary, timing);
  const bottlenecks = buildCloseoutBottlenecks({
    readiness: readinessArtifact.payload,
    jobs: jobSummary,
    fullPackage: fullPackageProfile,
    failedRerunTax,
  });
  const optimizationRecommendations = buildCloseoutOptimizationRecommendations({
    readiness: readinessArtifact.payload,
    jobs: jobSummary,
    fullPackage: fullPackageProfile,
    failedRerunTax,
    bottlenecks,
  });

  return {
    schema: 'opl_release_closeout_summary.v1',
    version: options.version,
    generated_at: outputGeneration.generated_at,
    output_generation: outputGeneration,
    release_repo: options.repo,
    authority_boundary: {
      mode: 'diagnostics_only',
      mutation_authorized: false,
      terminal_or_published_authority: 'canonical stable session joined to exact validated promotion saga receipt only',
      candidate_preflight_remote_artifacts_can_authorize_terminal_state: false,
    },
    run: {
      id: options.runId || stringField(run, 'databaseId') || 'local',
      workflow_name: stringField(run, 'workflowName') ?? stringField(run, 'name'),
      display_title: stringField(run, 'displayTitle'),
      status: stringField(run, 'status'),
      conclusion: stringField(run, 'conclusion'),
      event: stringField(run, 'event'),
      head_branch: stringField(run, 'headBranch'),
      head_sha: stringField(run, 'headSha'),
      url: stringField(run, 'url'),
      timing,
    },
    clock_boundary: {
      github_actions_workflow_wall_time: 'release execution KPI from GitHub Actions run timestamps',
      agent_orchestration_wall_time: 'operator loop KPI including run waits, artifact readback, local verification, docs, commits, pushes, cleanup, and model/tool round trips',
      agent_orchestration_wall_time_seconds: agentWallTimeSeconds,
      rule: 'Do not compare Agent orchestration wall time directly to GitHub Actions workflow wall time.',
    },
    artifact_policy: {
      downloads_large_artifacts: false,
      artifact_profile: options.artifactProfile,
      forbidden_large_artifact_patterns: forbiddenLargeArtifactPatterns.map((pattern) => pattern.source),
      downloaded_artifacts: artifactDownload.downloaded,
      download_generation: {
        mode: artifactDownload.mode,
        generation_id: artifactDownload.generation_id,
        committed_path: artifactDownload.committed_path,
        previous_generation_path: artifactDownload.previous_generation_path,
      },
      local_artifacts_dir: options.artifactsDir,
      rule: 'Closeout reads final summaries and small diagnostics first; download standard or Full DMG artifacts only for a named release-asset investigation.',
    },
    source_status: {
      candidate_record: sourceStatus(candidateArtifact.payload),
      release_readiness_summary: sourceStatus(readinessArtifact.payload),
      release_addon_readiness_summary: artifactPresenceStatus(addonReadinessArtifact.payload),
      release_preflight_summary: sourceStatus(preflightArtifact.payload),
      remote_release_verification: sourceStatus(remoteArtifact.payload),
    },
    source_paths: {
      candidate_record: candidateArtifact.path,
      release_readiness_summary: readinessArtifact.path,
      release_addon_readiness_summary: addonReadinessArtifact.path,
      release_preflight_summary: preflightArtifact.path,
      remote_release_verification: remoteArtifact.path,
      artifact_attestation_verification: attestationVerification.source_path,
      full_workflow_telemetry: telemetryArtifact.path,
      runtime_cache_events: diagnosticsArtifact.path,
    },
    artifact_attestation_verification: attestationVerification,
    stable_terminal_evidence: terminalEvidence,
    candidate_record: candidateArtifact.payload ? {
      status: sourceStatus(candidateArtifact.payload),
      blocked_reasons: asArray(candidateArtifact.payload.blocked_reasons),
      required_gate_failures: asArray(candidateArtifact.payload.required_gate_failures),
      release_owner_verdict: asRecord(candidateArtifact.payload.release_owner_verdict),
      decision: asRecord(candidateArtifact.payload.decision),
    } : null,
    release_preflight_summary: preflightArtifact.payload,
    remote_release_verification: remoteArtifact.payload,
    readiness: readinessArtifact.payload ? {
      status: sourceStatus(readinessArtifact.payload),
      failed_required_gates: failedGateSummaries(readinessArtifact.payload),
      warnings: asArray(readinessArtifact.payload.warnings),
      bottlenecks: asArray(readinessArtifact.payload.bottlenecks),
      optimization_recommendations: asArray(readinessArtifact.payload.optimization_recommendations),
    } : null,
    addon_readiness: addonReadinessArtifact.payload ? {
      status: artifactPresenceStatus(addonReadinessArtifact.payload),
      require_addon_gates_for_stable_readiness: addonReadinessArtifact.payload.require_addon_gates_for_stable_readiness === true,
      job_results: asRecord(addonReadinessArtifact.payload.job_results),
    } : null,
    failed_rerun_tax: failedRerunTax,
    bottlenecks,
    optimization_recommendations: optimizationRecommendations,
    full_package_tuning: fullPackageProfile,
    jobs: jobSummary,
    decision,
    operator_loop_optimization: {
      implemented_by: 'desktop-release.yml default release closeout artifact and npm run release:closeout rerun',
      workflow_default_release_summary: 'release-readiness-summary job uploads release-closeout-<version> after the candidate record is written',
      reduced_manual_steps: [
        'repeated gh run watch / gh run view polling',
        'manual small-artifact selection and download',
        'large artifact downloads before structured summaries identify a need',
        'manual reconstruction of release closeout Markdown from scattered logs',
      ],
      inspect_logs_only_after: [
        'candidate record is missing',
        'readiness summary is missing',
        'readiness failed_required_gates names a job without enough reason',
        'GitHub run conclusion is failed or cancelled and no structured summary exists',
      ],
    },
  };
}

function appendAttestationMarkdown(filePath: string, summary: ReturnType<typeof buildSummary>): void {
  const attestation = summary.artifact_attestation_verification;
  const lines = [
    '',
    '### Artifact Attestation Verification',
    '',
    `- State: ${attestation.state}`,
    `- Role: ${attestation.role}`,
    `- Source: ${attestation.source_path ?? 'not provided'}`,
    `- Rule: ${attestation.rule}`,
    `- Does not replace: ${attestation.does_not_replace.join(', ')}`,
    '',
    '### Output Generation',
    '',
    `- Generation: ${summary.output_generation.id}`,
    `- Completion manifest: ${summary.output_generation.completion_manifest}`,
    '- Authority: diagnostics_only; this closeout never authorizes a release mutation.',
  ];
  if (attestation.verify_commands.length > 0) {
    lines.push('', 'Verify commands:');
    for (const command of attestation.verify_commands) lines.push(`- \`${command}\``);
  }
  fs.appendFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function buildMonitorSummary(summary: ReturnType<typeof buildSummary>) {
  const state = monitorState({
    run: summary.run,
    decision: summary.decision,
    jobs: summary.jobs,
    terminalEvidence: summary.stable_terminal_evidence,
  });
  const nextAction = stringField(summary.decision, 'next_action') ?? 'unknown';
  return {
    schema: 'opl_release_run_monitor.v1',
    version: summary.version,
    generated_at: summary.generated_at,
    output_generation: summary.output_generation,
    repo: summary.release_repo,
    run: {
      id: summary.run.id,
      status: summary.run.status,
      conclusion: summary.run.conclusion,
      url: summary.run.url,
      workflow_name: summary.run.workflow_name,
      head_branch: summary.run.head_branch,
      head_sha: summary.run.head_sha,
      workflow_wall_time_seconds: summary.run.timing.workflow_wall_time_seconds,
    },
    state,
    next_action: nextAction,
    recommended_next_action: {
      action: nextAction,
      reason: summary.decision.reason,
      command: summary.decision.command,
    },
    failed_gate_count: summary.readiness?.failed_required_gates.length ?? null,
    failed_job_count: summary.jobs.failed_jobs.length,
    source_status: summary.source_status,
    authority: 'diagnostics_only',
    mutation_authorized: false,
    promote_ready: false,
    published: summary.stable_terminal_evidence.published,
    terminal: summary.stable_terminal_evidence.standard_terminal,
    terminal_evidence_status: summary.stable_terminal_evidence.status,
    no_watch_instructions: [
      `gh run view ${summary.run.id} --repo ${summary.release_repo} --json status,conclusion,url,updatedAt`,
      `gh run download ${summary.run.id} --repo ${summary.release_repo} --name release-closeout-${summary.version} --dir artifacts/release-closeout/v${summary.version}-${summary.run.id}`,
      `jq '.state,.recommended_next_action' artifacts/release-closeout/v${summary.version}-${summary.run.id}/release-monitor.json`,
    ],
    artifact_policy: {
      downloads_large_artifacts: false,
      read_small_artifact: `release-closeout-${summary.version}/release-monitor.json`,
    },
  };
}

function buildNotificationPayload(summary: ReturnType<typeof buildSummary>, monitor: ReturnType<typeof buildMonitorSummary>) {
  return {
    schema: 'opl_release_run_notification.v1',
    topic: 'opl_release_run_monitor',
    version: summary.version,
    output_generation: summary.output_generation,
    state: monitor.state,
    title: `OPL release v${summary.version}: ${monitor.state}`,
    body: `${monitor.next_action}: ${summary.decision.reason}`,
    next_action: monitor.recommended_next_action,
    run_url: summary.run.url,
    artifact: `release-closeout-${summary.version}`,
    machine_payload: 'release-monitor.json',
  };
}

function buildOutputGeneration(options: Options): OutputGeneration {
  return {
    schema: 'opl_release_closeout_output_generation.v1',
    id: `urn:uuid:${crypto.randomUUID()}`,
    generated_at: new Date().toISOString(),
    required_output_count: 4,
    completion_manifest: path.relative(appRoot, options.completionManifest),
  };
}

function writeMarkdownAtomic(
  filePath: string,
  summary: ReturnType<typeof buildSummary>,
  monitor: ReturnType<typeof buildMonitorSummary>,
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const renderPath = `${filePath}.render-${process.pid}-${crypto.randomUUID()}`;
  try {
    writeCloseoutMarkdown(renderPath, summary, monitor);
    appendAttestationMarkdown(renderPath, summary);
    writeFileAtomic(filePath, fs.readFileSync(renderPath));
  } finally {
    fs.rmSync(renderPath, { force: true });
  }
}

function outputDescriptor(role: string, filePath: string) {
  const bytes = fs.readFileSync(filePath);
  return {
    role,
    path: path.relative(appRoot, filePath),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    size_bytes: bytes.byteLength,
  };
}

function writeCompletionManifest(options: Options, generation: OutputGeneration): void {
  const outputs = [
    outputDescriptor('closeout_summary', options.output),
    outputDescriptor('closeout_markdown', options.markdown),
    outputDescriptor('release_monitor', options.monitor),
    outputDescriptor('release_notification', options.notification),
  ];
  writeJson(options.completionManifest, {
    schema: 'opl_release_closeout_completion_manifest.v1',
    status: 'complete',
    generation,
    completed_at: new Date().toISOString(),
    required_output_count: 4,
    completed_output_count: outputs.length,
    outputs,
    authority: 'diagnostics_only',
    mutation_authorized: false,
    rule: 'Consumers must verify all four output digests and their shared generation id; a missing, stale, or mismatched manifest is incomplete diagnostics and never mutation authority.',
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.outDir, { recursive: true });
  const outputGeneration = buildOutputGeneration(options);
  const summaryBase = buildSummary(options, outputGeneration);
  const monitor = buildMonitorSummary(summaryBase);
  const notification = buildNotificationPayload(summaryBase, monitor);
  const summary = { ...summaryBase, monitor, notification_payload: notification };
  writeJson(options.output, summary);
  writeJson(options.monitor, monitor);
  writeJson(options.notification, notification);
  writeMarkdownAtomic(options.markdown, summary, monitor);
  writeCompletionManifest(options, outputGeneration);
  console.log(JSON.stringify({
    status: 'diagnostics_only',
    monitor_state: monitor.state,
    output: path.relative(appRoot, options.output),
    markdown: path.relative(appRoot, options.markdown),
    monitor: path.relative(appRoot, options.monitor),
    notification: path.relative(appRoot, options.notification),
    completion_manifest: path.relative(appRoot, options.completionManifest),
    output_generation_id: outputGeneration.id,
    next_action: summary.decision.next_action,
    mutation_authorized: false,
  }, null, 2));
}

main();
