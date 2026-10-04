import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { remainingReleaseOperationMilliseconds } from './release-operation-deadline.ts';
import { digestRef, sha256Bytes, writeJson, type AdapterOptionValues, type GitHubMutation, type GitHubMutationCommand, type JsonRecord } from './framework-release-adapter-bundle.ts';

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
  wait?(milliseconds: number): void;
  onMutationAttempt?(evidence: JsonRecord): void;
  readTimeoutMs?: number;
  mutationTimeoutMs?: number;
}

export const defaultGitHubRuntime: GitHubAdapterRuntime = {
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
  wait(milliseconds) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
  },
};

export function commandEvidence(
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

export class GitHubReadError extends Error {
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

export function githubMutationFailure(
  command: GitHubMutationCommand,
  values: AdapterOptionValues,
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

export function rejectGitHubMutation(
  command: GitHubMutationCommand,
  values: AdapterOptionValues,
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

export function persistGitHubMutationFailure(
  command: GitHubMutationCommand,
  values: AdapterOptionValues,
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
export function ghRead(
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
  includeBody = false,
): JsonRecord {
  const release = ghRead(
    ['api', `repos/${repo}/releases/tags/${tag}`],
    runtime,
    { allow404: true },
  ) as JsonRecord | null;
  if (!release) {
    const hiddenRelease = ghRead(
      ['release', 'view', tag, '--repo', repo, '--json', 'databaseId,tagName'],
      runtime,
      { allow404: true },
    ) as JsonRecord | null;
    if (hiddenRelease) {
      if (
        !Number.isSafeInteger(hiddenRelease.databaseId)
        || Number(hiddenRelease.databaseId) <= 0
        || hiddenRelease.tagName !== tag
      ) {
        throw new Error(`GitHub Release discovery identity conflicts with ${tag}.`);
      }
      return inspectReleaseById(repo, tag, Number(hiddenRelease.databaseId), runtime);
    }
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
  const targetIdentity = releaseTargetIdentity(repo, tag, release.target_commitish, runtime);
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
      ...targetIdentity,
      ...(includeBody ? { body: String(release.body ?? '') } : {}),
      body_sha256: sha256Bytes(String(release.body ?? '')),
      immutable: release.immutable === true,
    },
    assets,
  };
}

export function inspectReleaseById(
  repo: string,
  tag: string,
  releaseId: number,
  runtime: GitHubAdapterRuntime,
): JsonRecord {
  if (!Number.isSafeInteger(releaseId) || releaseId <= 0) {
    throw new Error(`GitHub Release ${tag} has an invalid numeric identity.`);
  }
  const release = ghRead(
    ['api', `repos/${repo}/releases/${releaseId}`],
    runtime,
    { allow404: true },
  ) as JsonRecord | null;
  if (!release) {
    return {
      surface_kind: 'opl_app_github_release_inspection.v1',
      repository: repo,
      tag,
      release: { exists: false, id: releaseId },
      assets: [],
    };
  }
  if (release.id !== releaseId || release.tag_name !== tag) {
    throw new Error(`GitHub Release ${releaseId} identity conflicts with ${tag}.`);
  }
  const assets = (Array.isArray(release.assets) ? release.assets : []).map((asset: JsonRecord) => {
    const digest = typeof asset.digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(asset.digest)
      ? asset.digest
      : null;
    if (!digest) throw new Error(`GitHub asset ${asset.name} has no authoritative SHA-256 digest.`);
    return { name: asset.name, size_bytes: asset.size, sha256: digest };
  });
  const targetIdentity = releaseTargetIdentity(repo, tag, release.target_commitish, runtime);
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
      ...targetIdentity,
      body_sha256: sha256Bytes(String(release.body ?? '')),
      immutable: release.immutable === true,
    },
    assets,
  };
}

export function inspectReleaseForReconcile(repo: string, tag: string, runtime: GitHubAdapterRuntime, includeBody = false): JsonRecord {
  try {
    return { status: 'complete', observation: inspectRelease(repo, tag, runtime, includeBody) };
  } catch (error) {
    return {
      status: 'inspect_failed',
      failure: error instanceof GitHubReadError
        ? error.evidence
        : { error_message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export function inspectReleaseTagRef(repo: string, tag: string, runtime: GitHubAdapterRuntime): JsonRecord {
  const expectedRef = `refs/tags/${tag}`;
  const observed = ghRead(
    ['api', `repos/${repo}/git/ref/tags/${tag}`],
    runtime,
    { allow404: true },
  ) as JsonRecord | null;
  if (!observed) {
    return {
      surface_kind: 'opl_app_github_release_tag_reservation.v1',
      repository: repo,
      tag,
      ref: expectedRef,
      exists: false,
      target_commitish: null,
    };
  }
  if (
    observed.ref !== expectedRef
    || observed.object?.type !== 'commit'
    || typeof observed.object?.sha !== 'string'
    || !/^[0-9a-f]{40}$/.test(observed.object.sha)
  ) {
    throw new Error(`GitHub tag reservation identity conflicts with ${expectedRef}.`);
  }
  return {
    surface_kind: 'opl_app_github_release_tag_reservation.v1',
    repository: repo,
    tag,
    ref: expectedRef,
    exists: true,
    target_commitish: observed.object.sha,
  };
}

export function releaseTargetIdentity(
  repo: string,
  tag: string,
  declaredTarget: unknown,
  runtime: GitHubAdapterRuntime,
): JsonRecord {
  const declared = typeof declaredTarget === 'string' ? declaredTarget : '';
  if (/^[0-9a-f]{40}$/.test(declared)) {
    return { target_commitish: declared, declared_target_commitish: declared };
  }
  const tagRef = inspectReleaseTagRef(repo, tag, runtime);
  if (tagRef.exists !== true || !/^[0-9a-f]{40}$/.test(String(tagRef.target_commitish ?? ''))) {
    throw new Error(`GitHub Release ${tag} has no exact commit target.`);
  }
  return {
    target_commitish: tagRef.target_commitish,
    declared_target_commitish: declared || null,
  };
}

export function inspectReleaseByIdForReconcile(
  repo: string,
  tag: string,
  releaseId: number,
  runtime: GitHubAdapterRuntime,
): JsonRecord {
  try {
    return { status: 'complete', observation: inspectReleaseById(repo, tag, releaseId, runtime) };
  } catch (error) {
    return {
      status: 'inspect_failed',
      failure: error instanceof GitHubReadError
        ? error.evidence
        : { error_message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export function inspectLatestForReconcile(repo: string, runtime: GitHubAdapterRuntime): JsonRecord {
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
  | { status: 'deadline_elapsed' | 'outcome_unknown' | 'rejected'; failure: JsonRecord };

export function mutationAttemptId(
  baseAttemptId: string,
  mutation: GitHubMutation,
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

export function runGitHubMutation(input: {
  mutation: GitHubMutation;
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
  const evidence: JsonRecord = {
    mutation_attempt_id: input.attemptId,
    remote_target: input.remoteTarget,
    ...commandEvidence(input.args, input.body, result, timeoutMs),
  };
  input.runtime.onMutationAttempt?.(evidence);
  if (result.status !== 0 || result.error) {
    let response: JsonRecord | null = null;
    try { response = JSON.parse(String(result.stdout ?? '')); } catch { /* No structured rejection. */ }
    const creationRejected = input.mutation === 'release_create'
      && result.status === 1 && !result.error && !result.signal
      && ['401', '403', '404'].includes(String(response?.status))
      && response?.documentation_url === 'https://docs.github.com/rest/releases/releases#create-a-release';
    return {
      status: creationRejected ? 'rejected' : 'outcome_unknown',
      failure: {
        failure_taxonomy: creationRejected ? 'github_release_creation_rejected' : evidence.timed_out
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

export function stoppedMutation(input: {
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
    retry_disposition: input.attempt.status === 'rejected'
      ? 'repair_permission_then_start_new_admitted_operation'
      : 'read_only_reconcile_only',
    failure: input.attempt.failure,
    reconciliation: input.reconciliation,
  };
}

export function unknownAfterAcceptedMutation(input: {
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

export function assertReleaseIdentity(inspection: JsonRecord, options: {
  tag: string;
  name: string;
  notes: string;
  targetCommitish: string;
  prerelease: boolean;
  draft: boolean;
}): void {
  const release = inspection.release;
  if (
    release.name !== options.name
    || release.prerelease !== options.prerelease
    || release.draft !== options.draft
    || release.target_commitish !== options.targetCommitish
  ) {
    throw new Error(`Existing ${options.tag} Release identity conflicts with the Bundle.`);
  }
  if (release.body_sha256 !== sha256Bytes(options.notes)) {
    throw new Error(`Existing ${options.tag} Release notes conflict with the prepared Bundle notes.`);
  }
}

export function acceptedDraftReleaseId(
  attemptEvidence: JsonRecord,
  options: {
    tag: string;
    name: string;
    notes: string;
    targetCommitish: string;
    prerelease: boolean;
    exactTagPreexisting: boolean;
  },
): number {
  let response: JsonRecord;
  try {
    response = JSON.parse(String(attemptEvidence.stdout ?? '')) as JsonRecord;
  } catch {
    throw new Error('Accepted GitHub Release creation returned no structured response.');
  }
  if (
    !response
    || typeof response !== 'object'
    || Array.isArray(response)
    || !Number.isSafeInteger(response.id)
    || response.id <= 0
    || response.tag_name !== options.tag
    || (
      options.exactTagPreexisting
        ? typeof response.target_commitish !== 'string' || response.target_commitish.trim() === ''
        : response.target_commitish !== options.targetCommitish
    )
    || response.name !== options.name
    || response.draft !== true
    || response.prerelease !== options.prerelease
    || sha256Bytes(String(response.body ?? '')) !== sha256Bytes(options.notes)
    || !Array.isArray(response.assets)
    || response.assets.length !== 0
  ) {
    throw new Error('Accepted GitHub Release creation response conflicts with the exact draft identity.');
  }
  return response.id;
}
