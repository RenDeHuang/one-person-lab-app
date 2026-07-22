#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  validateArtifactQualificationReceipt,
  type ArtifactQualificationReceiptV1,
} from './artifact-qualification-receipt.ts';
import { assertUpdaterVersionMatchesDisplay } from './release-version.ts';
import { verifyReleaseNotesFullPayloadAuthority } from './prepare-release-notes-full-payload-authority.ts';
import {
  releaseOperationDeadlineTimestamp,
  remainingReleaseOperationMilliseconds,
} from './release-operation-deadline.ts';
import { assertStandardLatestAdmissionReceipt } from './validate-standard-latest-admission.ts';

type JsonRecord = Record<string, any>;
type Track = 'standard' | 'full';
type StableReleaseOperation = 'standard' | 'resume_standard' | 'append_full';

const packageIds = [
  'mas',
  'mag',
  'rca',
  'oma',
  'obf',
  'mas-scholar-skills',
  'opl-flow',
] as const;
const aiNotesMarker = '<!-- OPL_RELEASE_NOTES_GENERATOR:online-ai -->';

function readJson(filePath: string): JsonRecord {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected a regular JSON file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256Bytes(bytes: Buffer | string): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(filePath: string): string {
  return sha256Bytes(fs.readFileSync(filePath));
}

function digestRef(digest: string): string {
  return digest.startsWith('sha256:') ? digest : `sha256:${digest}`;
}

function gitSha(root: string): string {
  const result = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0 || !/^[0-9a-f]{40}$/.test(result.stdout.trim())) {
    throw new Error(`Cannot resolve exact Git SHA for ${root}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function containedFrameworkFile(frameworkRoot: string, catalogRoot: string, ref: string): string {
  const candidate = path.resolve(ref.startsWith('contracts/') ? frameworkRoot : catalogRoot, ref);
  const relative = path.relative(frameworkRoot, candidate);
  if (relative === '' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(`Framework catalog ref escapes its checkout: ${ref}`);
  }
  const stat = fs.lstatSync(candidate);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Framework catalog ref is not a regular file: ${ref}`);
  }
  return candidate;
}

function frameworkContractRef(ref: string): string {
  const normalized = ref.split(path.sep).join('/');
  return normalized.startsWith('contracts/')
    ? normalized
    : path.posix.join('contracts/opl-framework', normalized);
}

function assertCatalogEntryFiles(
  frameworkRoot: string,
  catalogRoot: string,
  packageId: typeof packageIds[number],
  entry: JsonRecord,
): void {
  const manifestPath = containedFrameworkFile(frameworkRoot, catalogRoot, String(entry.manifest_ref ?? ''));
  const payloadPath = containedFrameworkFile(frameworkRoot, catalogRoot, String(entry.payload_manifest_ref ?? ''));
  for (const [label, filePath, expected] of [
    ['manifest', manifestPath, entry.manifest_sha256],
    ['payload manifest', payloadPath, entry.payload_manifest_sha256],
  ] as const) {
    const actual = digestRef(sha256File(filePath));
    if (actual !== expected) {
      throw new Error(`${packageId} ${label} digest drifted: expected ${String(expected)}, got ${actual}.`);
    }
  }
  const manifest = readJson(manifestPath);
  const payload = readJson(payloadPath);
  if (manifest.package_id !== packageId || manifest.version !== entry.package_version) {
    throw new Error(`${packageId} package manifest identity does not match the Framework catalog.`);
  }
  if (
    payload.package_id !== packageId
    || payload.package_version !== entry.package_version
    || payload.source_commit !== entry.owner_source_commit
  ) {
    throw new Error(`${packageId} payload manifest identity does not match the frozen owner ref.`);
  }
}

function requiredAssetNames(version: string, track: Track): string[] {
  return track === 'standard'
    ? [
        `One-Person-Lab-${version}-mac-arm64.dmg`,
        `One-Person-Lab-${version}-mac-arm64.zip`,
        `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
        'latest-arm64-mac.yml',
        'opl-app-component-manifest.json',
        'standard-local-authorization-policy.json',
      ]
    : [
        `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
        'opl-release-manifest.json',
      ];
}

function requireOption(values: Record<string, string | boolean | undefined>, key: string): string {
  const value = values[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing --${key}.`);
  return value.trim();
}

function requireBooleanOption(values: Record<string, string | boolean | undefined>, key: string): boolean {
  const value = requireOption(values, key);
  if (value !== 'true' && value !== 'false') throw new Error(`--${key} must be true or false.`);
  return value === 'true';
}

function parseCommon(argv: string[]) {
  return parseArgs({
    args: argv,
    options: {
      channel: { type: 'string' },
      version: { type: 'string' },
      'updater-version': { type: 'string' },
      'app-root': { type: 'string' },
      'shell-root': { type: 'string' },
      'framework-root': { type: 'string' },
      notes: { type: 'string' },
      'notes-evidence': { type: 'string' },
      'notes-full-payload-authority': { type: 'string' },
      'include-full-package': { type: 'string' },
      'release-set-manifest': { type: 'string' },
      output: { type: 'string' },
      operation: { type: 'string' },
      'release-operation': { type: 'string' },
      'operation-id': { type: 'string' },
      executor: { type: 'string' },
      'attempt-id': { type: 'string' },
      'remote-target': { type: 'string' },
      'prior-attempt-id': { type: 'string' },
      'publication-scope': { type: 'string' },
      bundle: { type: 'string' },
      track: { type: 'string' },
      outcome: { type: 'string' },
      'assets-dir': { type: 'string' },
      inspection: { type: 'string' },
      'legacy-qualification': { type: 'string' },
      status: { type: 'string' },
      repo: { type: 'string' },
      tag: { type: 'string' },
      name: { type: 'string' },
      plan: { type: 'string' },
      prerelease: { type: 'boolean' },
      'operation-started-at': { type: 'string' },
      'operation-deadline-at': { type: 'string' },
      'latest-admission': { type: 'string' },
      'run-attempt': { type: 'string' },
    },
    allowPositionals: true,
    strict: true,
  });
}

function buildFreezeRequest(values: Record<string, string | boolean | undefined>): JsonRecord {
  const channel = requireOption(values, 'channel');
  if (channel !== 'stable' && channel !== 'nightly') throw new Error('--channel must be stable or nightly.');
  const version = requireOption(values, 'version');
  const updaterVersion = requireOption(values, 'updater-version');
  assertUpdaterVersionMatchesDisplay(channel, version, updaterVersion);
  const appRoot = path.resolve(requireOption(values, 'app-root'));
  const shellRoot = path.resolve(requireOption(values, 'shell-root'));
  const frameworkRoot = path.resolve(requireOption(values, 'framework-root'));
  const notesPath = path.resolve(requireOption(values, 'notes'));
  const evidencePath = path.resolve(requireOption(values, 'notes-evidence'));
  const includeFullPackage = requireBooleanOption(values, 'include-full-package');
  const preparedNotes = fs.readFileSync(notesPath, 'utf8');
  if (!preparedNotes.includes(aiNotesMarker)) {
    throw new Error('Prepared release notes are not bound to the online AI writer.');
  }
  const notesEvidence = readJson(evidencePath);
  if (notesEvidence.schema !== 'opl_app_release_notes_evidence.v1') {
    throw new Error('Prepared release notes evidence has an unsupported schema.');
  }
  if (notesEvidence.payload?.include_full_package !== includeFullPackage) {
    throw new Error(
      'Prepared release notes Full intent does not match the admitted Release Bundle request.',
    );
  }
  const releaseSetPath = path.resolve(requireOption(values, 'release-set-manifest'));
  const appRef = gitSha(appRoot);
  const shellRef = gitSha(shellRoot);
  const frameworkRef = gitSha(frameworkRoot);
  const authorityOption = values['notes-full-payload-authority'];
  if (includeFullPackage) {
    const authorityPath = path.resolve(requireOption(values, 'notes-full-payload-authority'));
    const verifiedAuthority = verifyReleaseNotesFullPayloadAuthority(authorityPath, {
      appRoot,
      appRef,
      shellRoot,
      shellRef,
      frameworkRoot,
      frameworkRef,
      releaseSetManifestPath: releaseSetPath,
      thirdPartySourceManifestPath: path.join(
        appRoot,
        'contracts',
        'app-full-third-party-source-manifest.json',
      ),
    });
    if (notesEvidence.payload?.full_payload_authority_sha256 !== verifiedAuthority.sha256) {
      throw new Error(
        'Prepared release notes evidence does not bind the exact Full payload authority file digest.',
      );
    }
  } else {
    if (typeof authorityOption === 'string' && authorityOption.trim()) {
      throw new Error('Standard-only release notes cannot provide a Full payload authority file.');
    }
    if (
      notesEvidence.payload?.full_payload_authority_sha256 !== undefined
      && notesEvidence.payload?.full_payload_authority_sha256 !== null
    ) {
      throw new Error('Standard-only release notes cannot bind a Full payload authority digest.');
    }
  }
  const catalogPath = path.join(
    frameworkRoot,
    'contracts/opl-framework/bundled-full-runtime-package-catalog.json',
  );
  const catalog = readJson(catalogPath);
  const catalogRoot = path.dirname(catalogPath);
  const packages: JsonRecord = {};
  for (const packageId of packageIds) {
    const entry = catalog.packages?.[packageId];
    if (!entry) throw new Error(`Framework catalog is missing ${packageId}.`);
    assertCatalogEntryFiles(frameworkRoot, catalogRoot, packageId, entry);
    packages[packageId] = {
      package_id: packageId,
      version: entry.package_version,
      owner_source_commit: entry.owner_source_commit,
      manifest_ref: frameworkContractRef(entry.manifest_ref),
      manifest_sha256: entry.manifest_sha256,
      payload_manifest_ref: frameworkContractRef(entry.payload_manifest_ref),
      payload_manifest_sha256: entry.payload_manifest_sha256,
    };
  }

  const relativeReleaseSet = path.relative(frameworkRoot, releaseSetPath).split(path.sep).join('/');
  if (relativeReleaseSet.startsWith('../') || relativeReleaseSet === '') {
    throw new Error('Release Set manifest must be contained by the Framework checkout.');
  }
  return {
    surface_kind: 'opl_release_bundle_freeze_request.v1',
    schema_ref: 'contracts/opl-framework/release-bundle-freeze-request.schema.json',
    release: {
      channel,
      version,
      display_version: version,
      updater_version: updaterVersion,
      tag: `v${version}`,
      prerelease: channel === 'nightly',
    },
    sources: {
      app: { repo: 'gaofeng21cn/one-person-lab-app', source_commit: appRef },
      shell: { repo: 'gaofeng21cn/opl-aion-shell', source_commit: shellRef },
      framework: { repo: 'gaofeng21cn/one-person-lab', source_commit: frameworkRef },
    },
    framework_release_set: {
      generation: path.basename(path.dirname(releaseSetPath)),
      manifest_ref: relativeReleaseSet,
      digest: digestRef(sha256File(releaseSetPath)),
    },
    packages,
    prepared_notes: {
      source: 'prepared_ai',
      format: 'markdown',
      markdown: preparedNotes,
      evidence: notesEvidence,
    },
    tracks: {
      standard: {
        required_asset_names: requiredAssetNames(version, 'standard'),
        required_for_latest: true,
        additive_only: false,
        updater_metadata_allowed: true,
      },
      full: {
        required_asset_names: requiredAssetNames(version, 'full'),
        required_for_latest: false,
        additive_only: true,
        updater_metadata_allowed: false,
      },
    },
  };
}

function bundleDocument(bundlePath: string): JsonRecord {
  const bundle = readJson(path.resolve(bundlePath));
  if (bundle.surface_kind !== 'opl_release_bundle.v1' || typeof bundle.bundle_digest !== 'string') {
    throw new Error('Bundle must be an opl_release_bundle.v1 document.');
  }
  return bundle;
}

function buildExecutorReceipt(values: Record<string, string | boolean | undefined>): JsonRecord {
  const operation = requireOption(values, 'operation');
  const releaseOperation = requireOption(values, 'release-operation') as StableReleaseOperation;
  const operationId = requireOption(values, 'operation-id');
  const executor = requireOption(values, 'executor');
  const attemptId = requireOption(values, 'attempt-id');
  const remoteTarget = requireOption(values, 'remote-target');
  const priorAttemptId = typeof values['prior-attempt-id'] === 'string'
    ? requireOption(values, 'prior-attempt-id')
    : null;
  const track = requireOption(values, 'track') as Track;
  const outcome = requireOption(values, 'outcome');
  if (operation !== 'build' && operation !== 'remote_inspect') throw new Error('Invalid executor operation.');
  if (!['standard', 'resume_standard', 'append_full'].includes(releaseOperation)) {
    throw new Error('Invalid release operation.');
  }
  if (executor !== 'local' && executor !== 'remote') throw new Error('Invalid executor.');
  if (track !== 'standard' && track !== 'full') throw new Error('Invalid track.');
  if (outcome !== 'complete' && outcome !== 'unknown') throw new Error('Invalid outcome.');
  if (
    (track === 'standard' && releaseOperation === 'append_full')
    || (track === 'full' && releaseOperation !== 'append_full')
  ) {
    throw new Error('Release operation does not match the executor receipt track.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(operationId)) {
    throw new Error('--operation-id is not canonical.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(attemptId)) {
    throw new Error('--attempt-id is not canonical.');
  }
  if (priorAttemptId !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(priorAttemptId)) {
    throw new Error('--prior-attempt-id is not canonical.');
  }
  if (!/^[a-z][a-z0-9+.-]{0,31}:[A-Za-z0-9][A-Za-z0-9._~:/?#@!$&'()*+,;=%-]*$/.test(remoteTarget)) {
    throw new Error('--remote-target is not canonical.');
  }
  const publicationScope = values['publication-scope'];
  if (operation === 'build' && publicationScope !== undefined) {
    throw new Error('Build executor receipts must not carry --publication-scope.');
  }
  if (
    operation === 'remote_inspect'
    && publicationScope !== 'track_assets'
    && publicationScope !== 'external_target'
  ) {
    throw new Error('Remote inspection requires --publication-scope track_assets or external_target.');
  }
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  const requiredNames = bundle.tracks?.[track]?.required_asset_names;
  if (!Array.isArray(requiredNames) || requiredNames.some((name) => typeof name !== 'string')) {
    throw new Error(`Bundle ${track} track has no closed required_asset_names.`);
  }
  let assets: JsonRecord[] = [];
  if (outcome === 'complete' && operation === 'build') {
    const root = path.resolve(requireOption(values, 'assets-dir'));
    assets = requiredNames.map((name: string) => {
      const filePath = path.join(root, name);
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
        throw new Error(`Invalid ${track} asset: ${filePath}`);
      }
      return { name, size_bytes: stat.size, sha256: digestRef(sha256File(filePath)), path: filePath };
    });
  } else if (
    outcome === 'complete'
    && operation === 'remote_inspect'
    && publicationScope === 'track_assets'
  ) {
    const inspection = readJson(path.resolve(requireOption(values, 'inspection')));
    const remoteAssets = new Map(
      (Array.isArray(inspection.assets) ? inspection.assets : []).map((asset: JsonRecord) => [asset.name, asset]),
    );
    assets = requiredNames.flatMap((name: string) => {
      const asset = remoteAssets.get(name);
      return asset ? [{ name, size_bytes: asset.size_bytes, sha256: asset.sha256 }] : [];
    });
  }
  return {
    surface_kind: 'opl_release_bundle_executor_receipt.v1',
    schema_ref: 'contracts/opl-framework/release-bundle-executor-receipt.schema.json',
    operation,
    executor,
    attempt_id: attemptId,
    bundle_digest: bundle.bundle_digest,
    track,
    outcome,
    release_operation: releaseOperation,
    operation_id: operationId,
    remote_target: remoteTarget,
    prior_attempt_id: priorAttemptId,
    ...(operation === 'remote_inspect' ? { publication_scope: publicationScope } : {}),
    assets,
  };
}

function buildQualificationReceipt(values: Record<string, string | boolean | undefined>): JsonRecord {
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  const track = requireOption(values, 'track') as Track;
  if (track !== 'standard' && track !== 'full') throw new Error('--track must be standard or full.');
  const legacyPath = path.resolve(requireOption(values, 'legacy-qualification'));
  const legacy = readJson(legacyPath) as ArtifactQualificationReceiptV1;
  const packageProfile = track;
  const artifactSha256 = String(legacy.artifact?.sha256 ?? '').replace(/^sha256:/, '');
  const validationErrors = validateArtifactQualificationReceipt(legacy, {
    stableSessionId: bundle.bundle_digest,
    releaseCohortRef: bundle.bundle_digest,
    version: bundle.release.version,
    packageProfile,
    result: 'passed',
    artifactSha256,
    appSha: bundle.sources.app.source_commit,
    shellSha: bundle.sources.shell.source_commit,
    frameworkSha: bundle.sources.framework.source_commit,
  });
  if (validationErrors.length > 0) {
    throw new Error(`Legacy qualification receipt does not bind this Bundle: ${validationErrors.join('; ')}`);
  }
  const requiredNames = bundle.tracks?.[track]?.required_asset_names;
  const subjectName = String(legacy.artifact?.name ?? '');
  if (!Array.isArray(requiredNames) || !requiredNames.includes(subjectName)) {
    throw new Error(`Qualified artifact ${subjectName || '<missing>'} is not a required ${track} Bundle asset.`);
  }
  const sizeBytes = Number(legacy.artifact?.size_bytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error('Legacy qualification receipt has no positive artifact size.');
  }
  const harnessSha256 = legacy.verification_harness?.smoke_harness_sha256
    ?? legacy.build_manifest?.smoke_harness_sha256;
  const evidenceRef = legacy.qualification?.evidence_ref;
  if (typeof harnessSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(harnessSha256)) {
    throw new Error('Legacy qualification receipt has no valid smoke harness digest.');
  }
  if (typeof evidenceRef !== 'string' || evidenceRef.trim() === '') {
    throw new Error('Legacy qualification receipt has no durable evidence ref.');
  }
  return {
    surface_kind: 'opl_release_bundle_qualification_receipt.v1',
    schema_ref: 'contracts/opl-framework/release-bundle-qualification-receipt.schema.json',
    bundle_digest: bundle.bundle_digest,
    track,
    subject: {
      asset_name: subjectName,
      size_bytes: sizeBytes,
      sha256: digestRef(artifactSha256),
    },
    cohort: {
      app_sha: bundle.sources.app.source_commit,
      shell_sha: bundle.sources.shell.source_commit,
      framework_sha: bundle.sources.framework.source_commit,
      framework_release_set_digest: bundle.framework_release_set.digest,
      package_payload_manifest_sha256: Object.fromEntries(
        packageIds.map((packageId) => [packageId, bundle.packages[packageId].payload_manifest_sha256]),
      ),
    },
    qualification: {
      kind: 'installed_artifact',
      result: 'passed',
      installed_artifact_same_bytes: true,
      harness_sha256: digestRef(harnessSha256),
      evidence_refs: [evidenceRef],
    },
  };
}

const githubReadTimeoutMs = 30_000;
const githubMutationTimeoutMs = 10 * 60_000;

export interface GitHubCommandResult {
  status: number | null;
  signal?: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface GitHubCommandOptions {
  input?: string;
  timeout: number;
  killSignal: NodeJS.Signals;
}

export interface GitHubAdapterRuntime {
  run(command: string, args: string[], options: GitHubCommandOptions): GitHubCommandResult;
  now(): number;
  readTimeoutMs?: number;
  mutationTimeoutMs?: number;
}

const defaultGitHubRuntime: GitHubAdapterRuntime = {
  run(command, args, options) {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      input: options.input,
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
      timeout: options.timeout,
      killSignal: options.killSignal,
    });
    return {
      status: result.status,
      signal: result.signal,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      error: result.error,
    };
  },
  now: () => Date.now(),
};

function commandEvidence(
  args: string[],
  input: string | undefined,
  result: GitHubCommandResult | undefined,
  timeoutMs: number,
): JsonRecord {
  const errorCode = (result?.error as NodeJS.ErrnoException | undefined)?.code;
  return {
    input_digest: digestRef(sha256Bytes(JSON.stringify({
      command: 'gh',
      args,
      input_sha256: input === undefined ? null : digestRef(sha256Bytes(input)),
    }))),
    timeout_ms: timeoutMs,
    exit_status: result?.status ?? null,
    signal: result?.signal ?? null,
    timed_out: errorCode === 'ETIMEDOUT',
    error_code: errorCode ?? null,
    error_message: result?.error?.message ?? null,
    stdout: result?.stdout ?? '',
    stderr: result?.stderr ?? '',
  };
}

class GitHubReadError extends Error {
  readonly evidence: JsonRecord;

  constructor(message: string, evidence: JsonRecord) {
    super(message);
    this.name = 'GitHubReadError';
    this.evidence = evidence;
  }
}

export class GitHubMutationFailure extends Error {
  readonly result: JsonRecord;

  constructor(message: string, result: JsonRecord) {
    super(message);
    this.name = 'GitHubMutationFailure';
    this.result = result;
  }
}

function githubMutationFailure(
  command: 'github-apply' | 'github-activate-latest',
  values: Record<string, string | boolean | undefined>,
  failureTaxonomy: string,
  message: string,
  details: JsonRecord = {},
  commandFailure?: JsonRecord,
  retryDisposition = 'fail_closed_no_github_call',
): GitHubMutationFailure {
  const inputEvidence = {
    command,
    operation: values.operation ?? null,
    operation_id: values['operation-id'] ?? null,
    attempt_id: values['attempt-id'] ?? null,
    track: values.track ?? null,
    run_attempt: values['run-attempt'] ?? null,
    bundle: values.bundle ?? null,
    plan: values.plan ?? null,
    status: values.status ?? null,
    latest_admission: values['latest-admission'] ?? null,
    operation_started_at: values['operation-started-at'] ?? null,
    operation_deadline_at: values['operation-deadline-at'] ?? null,
  };
  const stdout = typeof commandFailure?.stdout === 'string' ? commandFailure.stdout : '';
  const commandStderr = typeof commandFailure?.stderr === 'string' ? commandFailure.stderr.trim() : '';
  return new GitHubMutationFailure(message, {
    surface_kind: 'opl_app_github_mutation_result.v1',
    status: 'failed',
    retry_disposition: retryDisposition,
    failure: {
      schema: 'opl_release_mutation_failure_receipt.v1',
      failure_taxonomy: failureTaxonomy,
      mutation: command,
      input_digest: digestRef(sha256Bytes(JSON.stringify(inputEvidence))),
      stdout,
      stderr: commandStderr ? `${commandStderr}\n${message}` : message,
      ...details,
    },
  });
}

function rejectGitHubMutation(
  command: 'github-apply' | 'github-activate-latest',
  values: Record<string, string | boolean | undefined>,
  failureTaxonomy: string,
  message: string,
  details: JsonRecord = {},
  retryDisposition?: string,
): never {
  throw githubMutationFailure(
    command,
    values,
    failureTaxonomy,
    message,
    details,
    undefined,
    retryDisposition,
  );
}

function persistGitHubMutationFailure(
  command: 'github-apply' | 'github-activate-latest',
  values: Record<string, string | boolean | undefined>,
  result: JsonRecord,
): void {
  const evidenceRoot = path.resolve(
    process.env.RUNNER_TEMP?.trim() || process.env.TMPDIR?.trim() || '/tmp',
    'opl-release-mutation-failure',
    command,
  );
  writeJson(path.join(evidenceRoot, 'failure.json'), result);
  fs.writeFileSync(path.join(evidenceRoot, 'input-digest.txt'), `${String(result.failure.input_digest)}\n`);
  fs.writeFileSync(path.join(evidenceRoot, 'stdout.txt'), String(result.failure.stdout ?? ''));
  fs.writeFileSync(path.join(evidenceRoot, 'stderr.txt'), String(result.failure.stderr ?? ''));
  if (typeof values.output === 'string' && values.output.trim()) {
    writeJson(path.resolve(values.output), result);
  }
}

function assertStableGitHubMutationAdmission(
  command: 'github-apply' | 'github-activate-latest',
  values: Record<string, string | boolean | undefined>,
  requiredTrack?: Track,
): {
  operation: StableReleaseOperation;
  operationId: string;
  operationStartedAt: string;
  attemptId: string;
  track: Track;
} {
  const runAttempt = values['run-attempt'];
  if (runAttempt !== '1') {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_run_attempt_rejected',
      'GitHub mutation requires --run-attempt 1.',
    );
  }
  const operation = values.operation;
  if (operation !== 'standard' && operation !== 'resume_standard' && operation !== 'append_full') {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_rejected',
      'GitHub mutation requires --operation standard, resume_standard, or append_full.',
    );
  }
  const track = values.track;
  if (track !== 'standard' && track !== 'full') {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_track_rejected',
      'GitHub mutation requires --track standard or full.',
    );
  }
  if (
    (track === 'standard' && operation === 'append_full')
    || (track === 'full' && operation !== 'append_full')
    || (requiredTrack !== undefined && track !== requiredTrack)
  ) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_track_mismatch',
      `${command} rejects operation ${operation} for track ${track}.`,
      { operation, track, required_track: requiredTrack ?? null },
    );
  }
  const operationId = values['operation-id'];
  if (typeof operationId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(operationId)) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_id_rejected',
      'GitHub mutation requires one canonical --operation-id.',
    );
  }
  const attemptId = values['attempt-id'];
  if (typeof attemptId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(attemptId)) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_attempt_id_rejected',
      'GitHub mutation requires one canonical --attempt-id.',
    );
  }
  const operationStartedAt = values['operation-started-at'];
  if (typeof operationStartedAt !== 'string' || !operationStartedAt.trim()) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_start_rejected',
      'GitHub mutation requires the immutable --operation-started-at.',
    );
  }
  return { operation, operationId, operationStartedAt, attemptId, track };
}

function ghRead(
  args: string[],
  runtime: GitHubAdapterRuntime,
  options: { allow404?: boolean } = {},
): JsonRecord | string | null {
  const timeoutMs = runtime.readTimeoutMs ?? githubReadTimeoutMs;
  const result = runtime.run('gh', args, { timeout: timeoutMs, killSignal: 'SIGTERM' });
  if (result.status !== 0 || result.error) {
    if (options.allow404 && !result.error && /HTTP 404|Not Found/i.test(`${result.stderr}\n${result.stdout}`)) {
      return null;
    }
    const evidence = commandEvidence(args, undefined, result, timeoutMs);
    throw new GitHubReadError(
      `gh ${args.join(' ')} read failed: ${result.stderr.trim() || result.stdout.trim() || result.error?.message || 'unknown error'}`,
      evidence,
    );
  }
  const output = result.stdout.trim();
  if (!output) return '';
  try {
    return JSON.parse(output) as JsonRecord;
  } catch {
    return output;
  }
}

export function inspectRelease(
  repo: string,
  tag: string,
  runtime: GitHubAdapterRuntime = defaultGitHubRuntime,
): JsonRecord {
  const release = ghRead(
    ['api', `repos/${repo}/releases/tags/${tag}`],
    runtime,
    { allow404: true },
  ) as JsonRecord | null;
  if (!release) {
    return {
      surface_kind: 'opl_app_github_release_inspection.v1',
      repository: repo,
      tag,
      release: { exists: false },
      assets: [],
    };
  }
  const assets = (Array.isArray(release.assets) ? release.assets : []).map((asset: JsonRecord) => {
    const digest = typeof asset.digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(asset.digest)
      ? asset.digest
      : null;
    if (!digest) throw new Error(`GitHub asset ${asset.name} has no authoritative SHA-256 digest.`);
    return { name: asset.name, size_bytes: asset.size, sha256: digest };
  });
  return {
    surface_kind: 'opl_app_github_release_inspection.v1',
    repository: repo,
    tag,
    release: {
      exists: true,
      id: release.id,
      name: release.name,
      draft: release.draft,
      prerelease: release.prerelease,
      target_commitish: release.target_commitish,
      body_sha256: sha256Bytes(String(release.body ?? '')),
    },
    assets,
  };
}

function inspectReleaseForReconcile(repo: string, tag: string, runtime: GitHubAdapterRuntime): JsonRecord {
  try {
    return { status: 'complete', observation: inspectRelease(repo, tag, runtime) };
  } catch (error) {
    return {
      status: 'inspect_failed',
      failure: error instanceof GitHubReadError
        ? error.evidence
        : { error_message: error instanceof Error ? error.message : String(error) },
    };
  }
}

function inspectLatestForReconcile(repo: string, runtime: GitHubAdapterRuntime): JsonRecord {
  try {
    const latest = ghRead(['api', `repos/${repo}/releases/latest`], runtime, { allow404: true });
    return { status: 'complete', observation: latest };
  } catch (error) {
    return {
      status: 'inspect_failed',
      failure: error instanceof GitHubReadError
        ? error.evidence
        : { error_message: error instanceof Error ? error.message : String(error) },
    };
  }
}

type GitHubMutationAttempt =
  | { status: 'accepted'; evidence: JsonRecord }
  | { status: 'deadline_elapsed' | 'outcome_unknown'; failure: JsonRecord };

function mutationAttemptId(
  baseAttemptId: string,
  mutation: 'release_create' | 'asset_upload' | 'latest_patch',
  remoteTarget: string,
  subject: string,
): string {
  return `gha:${sha256Bytes(JSON.stringify({
    base_attempt_id: baseAttemptId,
    mutation,
    remote_target: remoteTarget,
    subject,
  })).slice(0, 48)}`;
}

function runGitHubMutation(input: {
  mutation: 'release_create' | 'asset_upload' | 'latest_patch';
  attemptId: string;
  remoteTarget: string;
  args: string[];
  body?: string;
  operationDeadlineAt: string;
  runtime: GitHubAdapterRuntime;
}): GitHubMutationAttempt {
  const remainingMs = remainingReleaseOperationMilliseconds({
    deadlineAt: input.operationDeadlineAt,
    nowMs: input.runtime.now(),
  });
  if (remainingMs <= 0) {
    return {
      status: 'deadline_elapsed',
      failure: {
        failure_taxonomy: 'github_mutation_deadline_elapsed',
        mutation: input.mutation,
        mutation_attempt_id: input.attemptId,
        remote_target: input.remoteTarget,
        operation_deadline_at: input.operationDeadlineAt,
        ...commandEvidence(input.args, input.body, undefined, 0),
      },
    };
  }
  const timeoutMs = Math.max(1, Math.min(Math.floor(remainingMs), input.runtime.mutationTimeoutMs ?? githubMutationTimeoutMs));
  const result = input.runtime.run('gh', input.args, {
    input: input.body,
    timeout: timeoutMs,
    killSignal: 'SIGTERM',
  });
  const evidence = {
    mutation_attempt_id: input.attemptId,
    remote_target: input.remoteTarget,
    ...commandEvidence(input.args, input.body, result, timeoutMs),
  };
  if (result.status !== 0 || result.error) {
    return {
      status: 'outcome_unknown',
      failure: {
        failure_taxonomy: evidence.timed_out
          ? 'github_mutation_timeout'
          : 'github_mutation_outcome_unknown',
        mutation: input.mutation,
        operation_deadline_at: input.operationDeadlineAt,
        ...evidence,
      },
    };
  }
  return { status: 'accepted', evidence };
}

function stoppedMutation(input: {
  attempt: Exclude<GitHubMutationAttempt, { status: 'accepted' }>;
  repo: string;
  tag: string;
  uploaded?: string[];
  unresolvedAsset?: string;
  reconciliation: JsonRecord;
}): JsonRecord {
  return {
    surface_kind: 'opl_app_github_mutation_result.v1',
    status: input.attempt.status,
    repository: input.repo,
    tag: input.tag,
    uploaded: input.uploaded ?? [],
    unresolved_asset: input.unresolvedAsset ?? null,
    mutation_attempt_id: input.attempt.failure.mutation_attempt_id ?? null,
    remote_target: input.attempt.failure.remote_target ?? null,
    retry_disposition: 'read_only_reconcile_only',
    failure: input.attempt.failure,
    reconciliation: input.reconciliation,
  };
}

function unknownAfterAcceptedMutation(input: {
  mutation: string;
  operationDeadlineAt: string;
  attemptEvidence: JsonRecord;
  repo: string;
  tag: string;
  uploaded?: string[];
  unresolvedAsset?: string;
  reconciliation: JsonRecord;
  reason: string;
}): JsonRecord {
  return {
    surface_kind: 'opl_app_github_mutation_result.v1',
    status: 'outcome_unknown',
    repository: input.repo,
    tag: input.tag,
    uploaded: input.uploaded ?? [],
    unresolved_asset: input.unresolvedAsset ?? null,
    mutation_attempt_id: input.attemptEvidence.mutation_attempt_id ?? null,
    remote_target: input.attemptEvidence.remote_target ?? null,
    retry_disposition: 'read_only_reconcile_only',
    failure: {
      failure_taxonomy: 'github_mutation_readback_unknown',
      mutation: input.mutation,
      operation_deadline_at: input.operationDeadlineAt,
      reason: input.reason,
      mutation_attempt: input.attemptEvidence,
    },
    reconciliation: input.reconciliation,
  };
}

function assertReleaseIdentity(inspection: JsonRecord, options: {
  tag: string;
  name: string;
  notes: string;
  targetCommitish: string;
  prerelease: boolean;
}): void {
  const release = inspection.release;
  if (
    release.name !== options.name
    || release.prerelease !== options.prerelease
    || release.draft !== false
    || release.target_commitish !== options.targetCommitish
  ) {
    throw new Error(`Existing ${options.tag} Release identity conflicts with the Bundle.`);
  }
  if (release.body_sha256 !== sha256Bytes(options.notes)) {
    throw new Error(`Existing ${options.tag} Release notes conflict with the prepared Bundle notes.`);
  }
}

function ensureRelease(options: {
  baseAttemptId: string;
  repo: string;
  tag: string;
  name: string;
  notes: string;
  targetCommitish: string;
  prerelease: boolean;
  operationDeadlineAt: string;
  runtime: GitHubAdapterRuntime;
}): JsonRecord {
  const expectedBody = options.notes;
  const remoteTarget = `github-release:${options.repo}@${options.tag}`;
  let inspection = inspectRelease(options.repo, options.tag, options.runtime);
  if (!inspection.release.exists) {
    const payload = JSON.stringify({
      tag_name: options.tag,
      target_commitish: options.targetCommitish,
      name: options.name,
      body: expectedBody,
      draft: false,
      prerelease: options.prerelease,
      make_latest: 'false',
    });
    const attempt = runGitHubMutation({
      mutation: 'release_create',
      attemptId: mutationAttemptId(options.baseAttemptId, 'release_create', remoteTarget, options.tag),
      remoteTarget,
      args: ['api', '--method', 'POST', `repos/${options.repo}/releases`, '--input', '-'],
      body: payload,
      operationDeadlineAt: options.operationDeadlineAt,
      runtime: options.runtime,
    });
    if (attempt.status !== 'accepted') {
      return stoppedMutation({
        attempt,
        repo: options.repo,
        tag: options.tag,
        reconciliation: inspectReleaseForReconcile(options.repo, options.tag, options.runtime),
      });
    }
    const reconciliation = inspectReleaseForReconcile(options.repo, options.tag, options.runtime);
    if (reconciliation.status !== 'complete' || !reconciliation.observation.release.exists) {
      return unknownAfterAcceptedMutation({
        mutation: 'release_create',
        operationDeadlineAt: options.operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo: options.repo,
        tag: options.tag,
        reconciliation,
        reason: 'GitHub accepted Release creation but exact identity readback did not complete.',
      });
    }
    inspection = reconciliation.observation;
  }
  assertReleaseIdentity(inspection, options);
  return { status: 'complete', inspection };
}

export function applyPublishPlan(
  values: Record<string, string | boolean | undefined>,
  runtime: GitHubAdapterRuntime = defaultGitHubRuntime,
): JsonRecord {
  const admission = assertStableGitHubMutationAdmission('github-apply', values);
  const operationDeadlineAt = requireOption(values, 'operation-deadline-at');
  releaseOperationDeadlineTimestamp(operationDeadlineAt);
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  if (bundle.release.channel !== 'stable' || bundle.release.prerelease !== false) {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_mutation_non_stable_bundle',
      'GitHub mutation operations require a Stable non-prerelease Bundle.',
      { operation: admission.operation, track: admission.track },
    );
  }
  const repo = bundle.sources.app.repo;
  const tag = bundle.release.tag;
  const name = `One Person Lab v${bundle.release.version}`;
  const plan = readJson(path.resolve(requireOption(values, 'plan')));
  const publication = plan.release_bundle_publish;
  if (publication?.bundle_digest !== bundle.bundle_digest) {
    throw new Error('Framework publish plan is bound to a different Bundle.');
  }
  if (publication.track !== admission.track) {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_mutation_framework_track_mismatch',
      `Framework publish plan track ${String(publication.track ?? '<missing>')} does not match admitted ${admission.track}.`,
      {
        operation: admission.operation,
        admitted_track: admission.track,
        framework_plan_track: publication.track ?? null,
      },
    );
  }
  const frameworkControl = publication.receipt?.operation_control;
  if (
    publication.receipt?.release_operation !== admission.operation
    || frameworkControl?.operation_id !== admission.operationId
    || frameworkControl?.operation_started_at !== admission.operationStartedAt
    || frameworkControl?.operation_deadline_at !== operationDeadlineAt
  ) {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_mutation_framework_operation_mismatch',
      'Framework publish plan does not match the exact admitted operation control.',
      {
        admitted_operation: admission.operation,
        admitted_operation_id: admission.operationId,
        framework_operation: publication.receipt?.release_operation ?? null,
        framework_operation_control: frameworkControl ?? null,
      },
    );
  }
  const actions = publication.receipt?.details?.upload_actions;
  if (publication.status === 'reconcile_only') {
    return { status: 'reconcile_only', repository: repo, tag, uploaded: [] };
  }
  if (!Array.isArray(actions)) throw new Error('Framework publish plan has no structured upload_actions.');
  const releaseResult = ensureRelease({
    baseAttemptId: admission.attemptId,
    repo,
    tag,
    name,
    notes: bundle.prepared_notes.markdown,
    targetCommitish: bundle.sources.app.source_commit,
    prerelease: bundle.release.prerelease,
    operationDeadlineAt,
    runtime,
  });
  if (releaseResult.status !== 'complete') return releaseResult;
  const uploaded: string[] = [];
  for (const action of actions as JsonRecord[]) {
    if (action.action !== 'upload' || typeof action.source_path !== 'string') {
      throw new Error('Framework publish plan contains an invalid upload action.');
    }
    const expectedDigest = action.sha256;
    const expectedSize = action.size_bytes;
    const before = inspectRelease(repo, tag, runtime);
    const current = before.assets.find((asset: JsonRecord) => asset.name === action.name);
    if (current) {
      if (current.sha256 === expectedDigest && current.size_bytes === expectedSize) continue;
      throw new Error(`Remote asset ${action.name} conflicts with the immutable Bundle.`);
    }
    const attempt = runGitHubMutation({
      mutation: 'asset_upload',
      attemptId: mutationAttemptId(
        admission.attemptId,
        'asset_upload',
        `github-release:${repo}@${tag}`,
        String(action.name),
      ),
      remoteTarget: `github-release:${repo}@${tag}`,
      args: ['release', 'upload', tag, action.source_path, '--repo', repo],
      operationDeadlineAt,
      runtime,
    });
    if (attempt.status !== 'accepted') {
      return stoppedMutation({
        attempt,
        repo,
        tag,
        uploaded,
        unresolvedAsset: action.name,
        reconciliation: inspectReleaseForReconcile(repo, tag, runtime),
      });
    }
    const reconciliation = inspectReleaseForReconcile(repo, tag, runtime);
    if (reconciliation.status !== 'complete') {
      return unknownAfterAcceptedMutation({
        mutation: 'asset_upload',
        operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo,
        tag,
        uploaded,
        unresolvedAsset: action.name,
        reconciliation,
        reason: `GitHub accepted ${action.name} upload but immutable digest readback failed.`,
      });
    }
    const after = reconciliation.observation;
    const observed = after.assets.find((asset: JsonRecord) => asset.name === action.name);
    if (observed?.sha256 === expectedDigest && observed?.size_bytes === expectedSize) {
      uploaded.push(action.name);
      continue;
    }
    if (observed) throw new Error(`Remote asset ${action.name} digest changed during upload.`);
    return unknownAfterAcceptedMutation({
      mutation: 'asset_upload',
      operationDeadlineAt,
      attemptEvidence: attempt.evidence,
      repo,
      tag,
      uploaded,
      unresolvedAsset: action.name,
      reconciliation,
      reason: 'GitHub accepted the upload but did not expose its immutable digest.',
    });
  }
  return { status: 'complete', repository: repo, tag, uploaded };
}

export function activateLatest(
  values: Record<string, string | boolean | undefined>,
  runtime: GitHubAdapterRuntime = defaultGitHubRuntime,
): JsonRecord {
  const admission = assertStableGitHubMutationAdmission('github-activate-latest', values, 'standard');
  const operationDeadlineAt = requireOption(values, 'operation-deadline-at');
  releaseOperationDeadlineTimestamp(operationDeadlineAt);
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  if (bundle.release.channel !== 'stable' || bundle.release.prerelease !== false) {
    throw new Error('Only a Stable Bundle can become Latest.');
  }
  const status = readJson(path.resolve(requireOption(values, 'status'))).release_bundle_status;
  if (status?.bundle_digest !== bundle.bundle_digest || status.latest_eligible !== true) {
    throw new Error('Framework status does not authorize Latest activation for this Bundle.');
  }
  const statusBundle = status.bundle;
  if (
    statusBundle?.bundle_digest !== bundle.bundle_digest
    || statusBundle?.release?.channel !== bundle.release.channel
    || statusBundle?.release?.version !== bundle.release.version
    || statusBundle?.release?.updater_version !== bundle.release.updater_version
    || statusBundle?.release?.tag !== bundle.release.tag
    || statusBundle?.release?.prerelease !== bundle.release.prerelease
    || statusBundle?.sources?.app?.source_commit !== bundle.sources.app.source_commit
    || statusBundle?.sources?.shell?.source_commit !== bundle.sources.shell.source_commit
    || statusBundle?.sources?.framework?.source_commit !== bundle.sources.framework.source_commit
  ) {
    throw new Error('Framework status Bundle projection does not match the immutable Bundle input.');
  }
  if (!Array.isArray(status.tracks?.standard?.assets)) {
    throw new Error('Framework status has no verified Standard staged assets.');
  }
  const standardControl = status.operation_controls?.standard;
  if (
    standardControl?.operation_id !== admission.operationId
    || standardControl?.operation_started_at !== admission.operationStartedAt
    || standardControl?.operation_deadline_at !== operationDeadlineAt
  ) {
    throw new Error('Framework status does not match the exact admitted Standard operation control.');
  }
  const latestAdmission = readJson(path.resolve(requireOption(values, 'latest-admission')));
  assertStandardLatestAdmissionReceipt(latestAdmission, {
    bundleDigest: bundle.bundle_digest,
    candidateDisplayVersion: bundle.release.version,
    candidateUpdaterVersion: bundle.release.updater_version,
    appSha: bundle.sources.app.source_commit,
    shellSha: bundle.sources.shell.source_commit,
    frameworkSha: bundle.sources.framework.source_commit,
    standardAssets: status.tracks.standard.assets,
  });
  const repo = bundle.sources.app.repo;
  const tag = bundle.release.tag;
  const inspection = inspectRelease(repo, tag, runtime);
  if (!inspection.release.exists || !inspection.release.id) throw new Error(`Release ${tag} is missing.`);
  const latest = ghRead(['api', `repos/${repo}/releases/latest`], runtime, { allow404: true }) as JsonRecord | null;
  const observedLatestTag = typeof latest?.tag_name === 'string' ? latest.tag_name : null;
  const expectedCurrentLatestTag = latestAdmission.latest_compare_and_swap.expected_current.tag;
  if (observedLatestTag === tag) {
    return {
      status: 'idempotent',
      repository: repo,
      tag,
      latest_compare_and_swap: {
        expected_current_tag: expectedCurrentLatestTag,
        observed_current_tag: observedLatestTag,
        patch_performed: false,
      },
    };
  }
  if (observedLatestTag !== expectedCurrentLatestTag) {
    rejectGitHubMutation(
      'github-activate-latest',
      values,
      'github_latest_compare_and_swap_drift',
      `Latest drifted: expected ${expectedCurrentLatestTag}, observed ${observedLatestTag ?? '<missing>'}.`,
      {
        expected_current_tag: expectedCurrentLatestTag,
        observed_current_tag: observedLatestTag,
        candidate_tag: tag,
      },
      'inspect_only_no_patch_require_new_admission',
    );
  }
  const attempt = runGitHubMutation({
    mutation: 'latest_patch',
    attemptId: mutationAttemptId(
      admission.attemptId,
      'latest_patch',
      `github-latest:${repo}@${tag}`,
      tag,
    ),
    remoteTarget: `github-latest:${repo}@${tag}`,
    args: ['api', '--method', 'PATCH', `repos/${repo}/releases/${inspection.release.id}`, '--input', '-'],
    body: JSON.stringify({ make_latest: 'true' }),
    operationDeadlineAt,
    runtime,
  });
  if (attempt.status !== 'accepted') {
    return stoppedMutation({
      attempt,
      repo,
      tag,
      reconciliation: inspectLatestForReconcile(repo, runtime),
    });
  }
  const reconciliation = inspectLatestForReconcile(repo, runtime);
  if (reconciliation.status !== 'complete' || reconciliation.observation?.tag_name !== tag) {
    return unknownAfterAcceptedMutation({
      mutation: 'latest_patch',
      operationDeadlineAt,
      attemptEvidence: attempt.evidence,
      repo,
      tag,
      reconciliation,
      reason: `Latest readback did not prove ${tag}.`,
    });
  }
  return {
    status: 'complete',
    repository: repo,
    tag,
    latest_compare_and_swap: {
      expected_current_tag: expectedCurrentLatestTag,
      observed_current_tag: observedLatestTag,
      patch_performed: true,
    },
  };
}

function main(): void {
  const { values, positionals } = parseCommon(process.argv.slice(2));
  const command = positionals[0];
  try {
    let output: JsonRecord;
    if (command === 'freeze-request') {
      output = buildFreezeRequest(values);
    } else if (command === 'executor-receipt') {
      output = buildExecutorReceipt(values);
    } else if (command === 'qualification-receipt') {
      output = buildQualificationReceipt(values);
    } else if (command === 'github-inspect') {
      if (typeof values['operation-deadline-at'] === 'string') {
        releaseOperationDeadlineTimestamp(values['operation-deadline-at']);
      }
      output = inspectRelease(requireOption(values, 'repo'), requireOption(values, 'tag'));
    } else if (command === 'github-apply') {
      output = applyPublishPlan(values);
    } else if (command === 'github-activate-latest') {
      output = activateLatest(values);
    } else {
      throw new Error('Usage: framework-release-adapter <freeze-request|executor-receipt|qualification-receipt|github-inspect|github-apply|github-activate-latest> ...');
    }
    if (typeof values.output === 'string' && values.output.trim()) writeJson(path.resolve(values.output), output);
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    if (command === 'github-apply' || command === 'github-activate-latest') {
      const typed = error instanceof GitHubMutationFailure
        ? error
        : githubMutationFailure(
            command,
            values,
            'github_mutation_failed',
            error instanceof Error ? error.message : String(error),
            {},
            error instanceof GitHubReadError ? error.evidence : undefined,
          );
      persistGitHubMutationFailure(command, values, typed.result);
      throw typed;
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
