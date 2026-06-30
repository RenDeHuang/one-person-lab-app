#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findFileByName } from './release-file-helpers.ts';
import {
  buildCloseoutBottlenecks,
  buildCloseoutOptimizationRecommendations,
  fullPackageTuning,
} from './closeout-release-run-parts/full-package-tuning.ts';
import { writeCloseoutMarkdown } from './closeout-release-run-parts/markdown.ts';

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
  --artifact-profile <profile>     primary, diagnostics, or readiness-inputs. Default: primary.
  --no-download                    Do not download artifacts; read --artifacts-dir only.
  --agent-wall-time <duration>     Operator-loop duration, for example 2h6m43s.
  --agent-started-at <iso>         Operator-loop start timestamp.
  --agent-finished-at <iso>        Operator-loop finish timestamp.
  --help                          Show this message.
`);
}

function readArgValue(argv: string[], index: number, token: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
  return value;
}

function parseArtifactProfile(value: string): ArtifactProfile {
  if (value === 'primary' || value === 'diagnostics' || value === 'readiness-inputs') {
    return value;
  }
  throw new Error('--artifact-profile must be primary, diagnostics, or readiness-inputs.');
}

function applyOption(parsed: Options, token: string, value: string): void {
  if (token === '--version') parsed.version = value;
  else if (token === '--run-id') parsed.runId = value;
  else if (token === '--repo') parsed.repo = value;
  else if (token === '--out-dir' || token === '--output-dir') parsed.outDir = value;
  else if (token === '--output') parsed.output = value;
  else if (token === '--markdown') parsed.markdown = value;
  else if (token === '--monitor') parsed.monitor = value;
  else if (token === '--notification') parsed.notification = value;
  else if (token === '--run-json') parsed.runJsonPath = value;
  else if (token === '--jobs-json') parsed.jobsJsonPath = value;
  else if (token === '--artifacts-json') parsed.artifactsJsonPath = value;
  else if (token === '--artifacts-dir') parsed.artifactsDir = value;
  else if (token === '--artifact-profile') parsed.artifactProfile = parseArtifactProfile(value);
  else if (token === '--agent-started-at') parsed.agentStartedAt = value;
  else if (token === '--agent-finished-at') parsed.agentFinishedAt = value;
  else if (token === '--agent-wall-time') parsed.agentWallTime = value;
  else throw new Error(`Unknown argument: ${token}`);
}

function parseArgs(argv: string[]): Options {
  const parsed = defaultOptions();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    }
    if (token === '--no-download') {
      parsed.noDownload = true;
      continue;
    }
    applyOption(parsed, token, readArgValue(argv, index, token));
    index += 1;
  }

  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.runId.trim() && !parsed.runJsonPath.trim()) {
    throw new Error('Pass --run-id <github-actions-run-id> or --run-json <local-run-json>.');
  }

  const closeoutId = parsed.runId || 'local';
  const outDir = parsed.outDir
    ? path.resolve(parsed.outDir)
    : path.resolve(appRoot, 'artifacts', 'release-closeout', `v${parsed.version}-${closeoutId}`);
  return {
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
  };
}

function runGh(args: string[], label: string): string {
  const result = spawnSync('gh', args, {
    cwd: appRoot,
    encoding: 'utf8',
    maxBuffer: commandMaxBuffer,
  });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `${label} failed`;
    throw new Error(detail);
  }
  return result.stdout;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringField(record: JsonRecord | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' ? value : null;
}

function numberField(record: JsonRecord | null | undefined, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
  ], 'Fetch release run');
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
  ], 'Fetch release run jobs');
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
  ], 'Fetch release run artifacts');
  return normalizeArtifactsPayload(JSON.parse(stdout));
}

function artifactNames(options: Options): string[] {
  const base = [
    `release-candidate-record-${options.version}`,
    `release-readiness-summary-${options.version}`,
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

function downloadArtifacts(options: Options, artifacts: JsonRecord[]): DownloadedArtifact[] {
  fs.mkdirSync(options.artifactsDir, { recursive: true });
  if (options.noDownload || !options.runId) return [];
  const available = new Set(artifacts.map((artifact) => stringField(artifact, 'name')).filter(Boolean) as string[]);
  const downloaded: DownloadedArtifact[] = [];
  for (const name of artifactNames(options)) {
    if (isForbiddenLargeArtifact(name)) {
      throw new Error(`Refusing to download large release artifact: ${name}`);
    }
    if (available.size > 0 && !available.has(name)) continue;
    const targetDir = path.join(options.artifactsDir, name);
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
    runGh([
      'run',
      'download',
      options.runId,
      '--repo',
      options.repo,
      '--name',
      name,
      '--dir',
      targetDir,
    ], `Download artifact ${name}`);
    downloaded.push({ name, path: targetDir });
  }
  return downloaded;
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

function remoteReleaseLooksPublished(remote: JsonRecord | null, preflight: JsonRecord | null) {
  const releaseTarget = asRecord(preflight?.release_target);
  if (stringField(releaseTarget, 'kind') === 'published_release') return true;
  if (!remote || stringField(remote, 'status') !== 'passed') return false;
  if (stringField(remote, 'publishedAt') || stringField(remote, 'published_at')) return true;
  if (remote.isDraft === false || remote.is_draft === false || remote.draft === false) return true;
  return false;
}

function postPublishFailedJobs(remote: JsonRecord | null, preflight: JsonRecord | null, jobs: ReturnType<typeof summarizeJobs>) {
  if (!remoteReleaseLooksPublished(remote, preflight)) return [];
  return jobs.failed_jobs.filter((job) => /homebrew|vm|smoke|guide|screenshot|docs/i.test(job.name));
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
}) {
  const runStatus = stringField(inputs.run, 'status') ?? 'unknown';
  const conclusion = stringField(inputs.run, 'conclusion') ?? 'unknown';
  const candidateStatus = sourceStatus(inputs.candidate);
  const readinessStatus = sourceStatus(inputs.readiness);
  const tag = `v${inputs.options.version}`;

  if (candidateStatus === 'ready_to_promote') {
    const validation = validateCandidatePromotion(inputs.options, inputs.candidatePath);
    if (!validation.promote_ready) {
      return ownerResolutionDecision(validation);
    }
    const candidateDecision = asRecord(inputs.candidate?.decision);
    return {
      next_action: 'promote_from_candidate_record',
      reason: 'Candidate record is ready_to_promote and passed owner-resolution validation.',
      command: stringField(candidateDecision, 'promote_command')
        ?? `gh workflow run desktop-release-promote.yml --repo ${inputs.options.repo} --field opl_version=${inputs.options.version} --field release_run_id=${inputs.options.runId}`,
      owner_resolution: {
        promote_ready: true,
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
    };
  }
  if (readinessStatus === 'failed') {
    return {
      next_action: 'resolve_readiness_failed_gates',
      reason: 'Readiness summary failed; inspect failed_required_gates before job logs.',
      command: `jq '.failed_required_gates' ${path.join(inputs.options.artifactsDir, `release-readiness-summary-${inputs.options.version}`, 'release-readiness-summary.json')}`,
    };
  }
  if (runStatus !== 'completed') {
    return {
      next_action: 'wait_for_release_run_completion',
      reason: `Release run status is ${runStatus}; structured promotion or blocker evidence is not complete yet.`,
      command: `npm run release:closeout -- --version ${inputs.options.version} --run-id ${inputs.options.runId}`,
    };
  }
  const postPublishFailures = postPublishFailedJobs(inputs.remote, inputs.preflight, inputs.jobs);
  if (postPublishFailures.length > 0) {
    return {
      next_action: 'resolve_post_publish_followup_gate',
      reason: 'GitHub release publication or remote release readback is complete, but a post-publish proof gate failed.',
      command: `npm run release:closeout -- --version ${inputs.options.version} --run-id ${inputs.options.runId} --artifact-profile readiness-inputs`,
      post_publish: {
        published_release_readback: true,
        failed_followup_jobs: postPublishFailures,
        rule: 'Do not conflate published release/tap state with post-publish Homebrew VM proof completion.',
      },
    };
  }
  if (inputs.jobs.failed_jobs.length > 0 || conclusion !== 'success') {
    return {
      next_action: 'inspect_failed_jobs',
      reason: `Run conclusion is ${conclusion}; structured summaries are incomplete or inconclusive.`,
      command: `gh run view ${inputs.options.runId} --repo ${inputs.options.repo} --log-failed`,
    };
  }
  return {
    next_action: 'inspect_missing_candidate_record',
    reason: `Run ${tag} completed but release-candidate-record is ${candidateStatus}.`,
    command: `gh run download ${inputs.options.runId} --repo ${inputs.options.repo} --name release-candidate-record-${inputs.options.version} --dir ${inputs.options.artifactsDir}`,
  };
}

function monitorState(input: {
  run: { status: string | null; conclusion: string | null };
  decision: JsonRecord;
  jobs: ReturnType<typeof summarizeJobs>;
  remote: JsonRecord | null;
  preflight: JsonRecord | null;
}) {
  const runStatus = input.run.status ?? 'unknown';
  const conclusion = input.run.conclusion ?? 'unknown';
  const nextAction = stringField(input.decision, 'next_action') ?? 'unknown';
  if (nextAction === 'resolve_post_publish_followup_gate') return 'published_with_post_publish_followup';
  if (remoteReleaseLooksPublished(input.remote, input.preflight)) return 'published';
  if (nextAction === 'promote_from_candidate_record') return 'ready_to_promote';
  if (nextAction === 'wait_for_release_run_completion') return 'running';
  if (
    nextAction === 'owner_needed_release_owner_resolution'
    || nextAction === 'resolve_candidate_record_blockers'
    || nextAction === 'resolve_readiness_failed_gates'
    || nextAction === 'resolve_post_publish_followup_gate'
    || nextAction === 'inspect_failed_jobs'
    || input.jobs.failed_jobs.length > 0
  ) {
    return 'failed';
  }
  if (runStatus !== 'completed') return 'running';
  if (conclusion !== 'success') return 'failed';
  return 'failed';
}

function buildSummary(options: Options) {
  const run = fetchRun(options);
  const jobs = fetchJobs(options, run);
  const artifacts = fetchArtifacts(options);
  const downloadedArtifacts = downloadArtifacts(options, artifacts);

  const candidateArtifact = readArtifactJson(options, `release-candidate-record-${options.version}`, 'release-candidate-record.json');
  const readinessArtifact = readArtifactJson(options, `release-readiness-summary-${options.version}`, 'release-readiness-summary.json');
  const preflightArtifact = readArtifactJson(options, `release-preflight-summary-${options.version}`, 'release-preflight-summary.json');
  const remoteArtifact = readArtifactJson(options, `remote-release-verification-${options.version}`, 'remote-release-verification.json');
  const telemetryArtifact = readArtifactJson(options, `opl-full-workflow-telemetry-${options.version}`, 'full-workflow-telemetry.json');
  const diagnosticsArtifact = readArtifactJson(options, `opl-full-diagnostics-${options.version}`, 'runtime-cache-events.json');
  const jobSummary = summarizeJobs(jobs);
  const timing = summarizeRunTiming(run, jobs);
  const agentWallTimeSeconds = options.agentWallTime
    ? parseDurationSeconds(options.agentWallTime)
    : secondsBetween(options.agentStartedAt, options.agentFinishedAt);
  const decision = buildDecision({
    options,
    run,
    candidate: candidateArtifact.payload,
    candidatePath: candidateArtifact.absolutePath,
    readiness: readinessArtifact.payload,
    remote: remoteArtifact.payload,
    preflight: preflightArtifact.payload,
    jobs: jobSummary,
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
    generated_at: new Date().toISOString(),
    release_repo: options.repo,
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
      downloaded_artifacts: downloadedArtifacts,
      local_artifacts_dir: options.artifactsDir,
      rule: 'Closeout reads final summaries and small diagnostics first; download standard or Full DMG artifacts only for a named release-asset investigation.',
    },
    source_status: {
      candidate_record: sourceStatus(candidateArtifact.payload),
      release_readiness_summary: sourceStatus(readinessArtifact.payload),
      release_preflight_summary: sourceStatus(preflightArtifact.payload),
      remote_release_verification: sourceStatus(remoteArtifact.payload),
    },
    source_paths: {
      candidate_record: candidateArtifact.path,
      release_readiness_summary: readinessArtifact.path,
      release_preflight_summary: preflightArtifact.path,
      remote_release_verification: remoteArtifact.path,
      full_workflow_telemetry: telemetryArtifact.path,
      runtime_cache_events: diagnosticsArtifact.path,
    },
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

function buildMonitorSummary(summary: ReturnType<typeof buildSummary>) {
  const state = monitorState({
    run: summary.run,
    decision: summary.decision,
    jobs: summary.jobs,
    remote: summary.remote_release_verification,
    preflight: summary.release_preflight_summary,
  });
  const nextAction = stringField(summary.decision, 'next_action') ?? 'unknown';
  return {
    schema: 'opl_release_run_monitor.v1',
    version: summary.version,
    generated_at: summary.generated_at,
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
    promote_ready: nextAction === 'promote_from_candidate_record',
    published: state === 'published' || state === 'published_with_post_publish_followup',
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
    state: monitor.state,
    title: `OPL release v${summary.version}: ${monitor.state}`,
    body: `${monitor.next_action}: ${summary.decision.reason}`,
    next_action: monitor.recommended_next_action,
    run_url: summary.run.url,
    artifact: `release-closeout-${summary.version}`,
    machine_payload: 'release-monitor.json',
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.outDir, { recursive: true });
  const summary = buildSummary(options);
  const monitor = buildMonitorSummary(summary);
  const notification = buildNotificationPayload(summary, monitor);
  summary.monitor = monitor;
  summary.notification_payload = notification;
  writeJson(options.output, summary);
  writeJson(options.monitor, monitor);
  writeJson(options.notification, notification);
  writeCloseoutMarkdown(options.markdown, summary, monitor);
  console.log(JSON.stringify({
    status: summary.decision.next_action === 'promote_from_candidate_record'
      ? 'ready_to_promote'
      : summary.decision.next_action,
    monitor_state: monitor.state,
    output: path.relative(appRoot, options.output),
    markdown: path.relative(appRoot, options.markdown),
    monitor: path.relative(appRoot, options.monitor),
    notification: path.relative(appRoot, options.notification),
    next_action: summary.decision.next_action,
  }, null, 2));
}

main();
