#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs?: number },
) => CommandResult;

export const releaseCohortCanonicalRemotes = {
  app: 'https://github.com/gaofeng21cn/one-person-lab-app.git',
  shell: 'https://github.com/gaofeng21cn/opl-aion-shell.git',
  framework: 'https://github.com/gaofeng21cn/one-person-lab.git',
} as const;

const remoteLookupTimeoutMs = 30_000;

export type ReleaseCohortLockOptions = {
  appRef: string;
  shellRef: string;
  frameworkRef: string;
  repoRoot: string;
  shellRoot: string;
  frameworkRoot: string;
  output: string;
  markdown: string;
};

export type LockedRef = {
  requested_ref: string;
  resolved_sha: string;
  canonical_remote?: string;
  resolution_source?: 'immutable_sha' | 'canonical_remote';
  observed_remote_ref?: string | null;
};

export type ReleaseCohortLock = {
  schema: 'opl_app_release_cohort_lock.v1';
  generated_at: string;
  app: LockedRef & {
    repo_root: string;
  };
  shell: LockedRef & {
    repo_root: string;
  };
  framework: LockedRef & {
    repo_root: string;
  };
  authority_boundary: {
    cohort_lock_can_dispatch_workflow: false;
    cohort_lock_can_publish_release: false;
    cohort_lock_can_write_runtime_truth: false;
  };
  cohort_identity?: string;
};

export type ArtifactWriteFailureInjection = {
  afterStage?: () => void;
  afterMarkdownCommit?: () => void;
  beforeAuthorityCommit?: () => void;
};

function usage(): void {
  process.stdout.write(`Usage:
  npm run release:cohort-lock -- --app-ref <ref> --shell-ref <ref> --framework-ref <ref>

Options:
  --app-ref <ref>                  App ref to resolve. Default: current App HEAD.
  --shell-ref <ref>                Active shell ref to resolve. Default: main.
  --framework-ref <ref>            OPL Framework ref to resolve. Default: main.
  --repo-root <path>               App repository root. Default: current script repository.
  --shell-root <path>              Active shell checkout root. Default: <repo-root>/shells/aionui.
  --framework-root <path>          OPL Framework checkout root. Default: <repo-root>/../one-person-lab.
  --output <path>                  Write cohort lock JSON.
  --markdown <path>                Write cohort lock Markdown.
  --help                          Show this message.
`);
}

function run(command: string, args: string[], options: { cwd: string; timeoutMs?: number }): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
    timeout: options.timeoutMs,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
}

function commandDetail(result: CommandResult): string {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

function gitHead(repoRoot: string): string {
  const result = run('git', ['rev-parse', 'HEAD'], { cwd: repoRoot });
  return result.status === 0 ? firstLine(result.stdout) : '';
}

export function appRefFromEnvironment(): string {
  const appRef = process.env.OPL_APP_REF?.trim() ?? '';
  const appCommit = process.env.OPL_APP_COMMIT?.trim() ?? '';
  if (appRef && appCommit && appRef !== appCommit) {
    throw new Error(`OPL_APP_REF and OPL_APP_COMMIT disagree: ${appRef} != ${appCommit}.`);
  }
  return appRef || appCommit || process.env.GITHUB_SHA?.trim() || '';
}

function defaultOptions(): ReleaseCohortLockOptions {
  const repoRoot = appRoot;
  return {
    appRef: appRefFromEnvironment(),
    shellRef: process.env.OPL_SHELL_REF || 'main',
    frameworkRef: process.env.OPL_FRAMEWORK_REF || 'main',
    repoRoot,
    shellRoot: process.env.OPL_SHELL_ROOT || path.join(repoRoot, 'shells', 'aionui'),
    frameworkRoot: process.env.OPL_FRAMEWORK_ROOT || path.resolve(repoRoot, '..', 'one-person-lab'),
    output: process.env.OPL_RELEASE_COHORT_LOCK || '',
    markdown: process.env.OPL_RELEASE_COHORT_LOCK_MARKDOWN || '',
  };
}

export function parseReleaseCohortLockArgs(argv: string[]): ReleaseCohortLockOptions {
  const parsed = defaultOptions();
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      'app-ref': { type: 'string' },
      'app-commit': { type: 'string' },
      'shell-ref': { type: 'string' },
      'framework-ref': { type: 'string' },
      'repo-root': { type: 'string' },
      'shell-root': { type: 'string' },
      'framework-root': { type: 'string' },
      output: { type: 'string' },
      markdown: { type: 'string' },
    },
  });
  if (values.help) {
    usage();
    process.exit(0);
  }
  const appRef = values['app-ref']?.trim();
  const appCommit = values['app-commit']?.trim();
  if (appRef && appCommit && appRef !== appCommit) {
    throw new Error(`--app-ref and --app-commit disagree: ${appRef} != ${appCommit}.`);
  }
  if (appRef || appCommit) parsed.appRef = appRef || appCommit || '';
  if (typeof values['shell-ref'] === 'string') parsed.shellRef = values['shell-ref'];
  if (typeof values['framework-ref'] === 'string') parsed.frameworkRef = values['framework-ref'];
  if (typeof values['repo-root'] === 'string') parsed.repoRoot = values['repo-root'];
  if (typeof values['shell-root'] === 'string') parsed.shellRoot = values['shell-root'];
  if (typeof values['framework-root'] === 'string') parsed.frameworkRoot = values['framework-root'];
  if (typeof values.output === 'string') parsed.output = values.output;
  if (typeof values.markdown === 'string') parsed.markdown = values.markdown;

  const repoRoot = path.resolve(parsed.repoRoot);
  if (!parsed.appRef.trim()) parsed.appRef = gitHead(repoRoot);
  if (!parsed.appRef.trim()) throw new Error('Pass --app-ref <ref>/--app-commit <sha> or run from a git checkout.');
  if (!parsed.shellRef.trim()) throw new Error('Pass --shell-ref <ref> or set OPL_SHELL_REF.');
  if (!parsed.frameworkRef.trim()) throw new Error('Pass --framework-ref <ref> or set OPL_FRAMEWORK_REF.');

  const output = parsed.output ? path.resolve(parsed.output) : '';
  const markdown = parsed.markdown ? path.resolve(parsed.markdown) : '';
  if (output && markdown && output === markdown) {
    throw new Error('--output and --markdown must be different paths.');
  }
  return {
    ...parsed,
    repoRoot,
    shellRoot: path.resolve(
      values['shell-root'] || process.env.OPL_SHELL_ROOT ? parsed.shellRoot : path.join(repoRoot, 'shells', 'aionui'),
    ),
    frameworkRoot: path.resolve(
      values['framework-root'] || process.env.OPL_FRAMEWORK_ROOT
        ? parsed.frameworkRoot
        : path.resolve(repoRoot, '..', 'one-person-lab'),
    ),
    output,
    markdown,
  };
}

function refCandidates(ref: string): string[] {
  if (/^[0-9a-f]{7,40}$/i.test(ref)) return [ref];
  if (ref.startsWith('refs/')) return [ref];
  return [
    `refs/remotes/origin/${ref}`,
    `refs/heads/${ref}`,
    `refs/tags/${ref}`,
    ref,
  ];
}

export function resolveGitRef(root: string, ref: string, runner: CommandRunner = run): string {
  let lastDetail = '';
  for (const candidate of refCandidates(ref)) {
    const result = runner('git', ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`], { cwd: root });
    const resolved = firstLine(result.stdout);
    if (result.status === 0 && /^[0-9a-f]{40}$/i.test(resolved)) return resolved;
    lastDetail = commandDetail(result) || lastDetail;
  }
  throw new Error(`Unable to resolve ${ref} in ${root}.${lastDetail ? ` ${lastDetail}` : ''}`);
}

function canonicalRemoteRefCandidates(ref: string): string[] {
  if (ref.startsWith('refs/heads/')) return [ref];
  if (ref.startsWith('refs/tags/')) return [`${ref}^{}`, ref];
  if (ref.startsWith('refs/')) {
    throw new Error(`Unsupported canonical remote ref ${ref}; use a branch, tag, refs/heads/*, or refs/tags/*.`);
  }
  return [`refs/heads/${ref}`, `refs/tags/${ref}^{}`, `refs/tags/${ref}`];
}

function parseRemoteRefs(stdout: string, candidates: string[]): Array<{ sha: string; ref: string }> {
  const allowed = new Set(candidates);
  return stdout.trim().split(/\r?\n/).filter(Boolean).flatMap((line) => {
    const [sha = '', ref = ''] = line.trim().split(/\s+/, 2);
    return /^[0-9a-f]{40}$/i.test(sha) && allowed.has(ref)
      ? [{ sha: sha.toLowerCase(), ref }]
      : [];
  });
}

function selectRemoteRefMatch(
  requestedRef: string,
  canonicalRemote: string,
  matches: Array<{ sha: string; ref: string }>,
): { sha: string; ref: string } {
  const branch = matches.find((match) => match.ref.startsWith('refs/heads/'));
  const peeledTag = matches.find((match) => match.ref.endsWith('^{}'));
  const directTag = matches.find((match) => match.ref.startsWith('refs/tags/') && !match.ref.endsWith('^{}'));
  const tagCommit = peeledTag ?? directTag;
  if (branch && tagCommit && branch.sha !== tagCommit.sha) {
    throw new Error(
      `Canonical ref ${requestedRef} is ambiguous in ${canonicalRemote}: ` +
      `${branch.ref}=${branch.sha}, ${tagCommit.ref}=${tagCommit.sha}.`,
    );
  }
  return branch ?? tagCommit ?? matches[0];
}

export type CanonicalGitRefResolution = {
  requested_ref: string;
  resolved_sha: string;
  canonical_remote: string;
  resolution_source: 'immutable_sha' | 'canonical_remote';
  observed_remote_ref: string | null;
};

export function resolveCanonicalGitRef(
  root: string,
  ref: string,
  canonicalRemote: string,
  runner: CommandRunner = run,
): CanonicalGitRefResolution {
  const requestedRef = ref.trim();
  if (/^[0-9a-f]{7,40}$/i.test(requestedRef)) {
    return {
      requested_ref: requestedRef,
      resolved_sha: resolveGitRef(root, requestedRef, runner).toLowerCase(),
      canonical_remote: canonicalRemote,
      resolution_source: 'immutable_sha',
      observed_remote_ref: null,
    };
  }

  const candidates = canonicalRemoteRefCandidates(requestedRef);
  const result = runner('git', ['ls-remote', canonicalRemote, ...candidates], {
    cwd: root,
    timeoutMs: remoteLookupTimeoutMs,
  });
  if (result.status !== 0) {
    const detail = commandDetail(result);
    throw new Error(
      `Unable to resolve live canonical ref ${requestedRef} from ${canonicalRemote}.${detail ? ` ${detail}` : ''}`,
    );
  }
  const matches = parseRemoteRefs(result.stdout, candidates);
  if (matches.length === 0) {
    throw new Error(`Unable to resolve live canonical ref ${requestedRef} from ${canonicalRemote}.`);
  }
  const selected = selectRemoteRefMatch(requestedRef, canonicalRemote, matches);
  const resolvedSha = selected.sha;
  const local = runner('git', ['cat-file', '-e', `${resolvedSha}^{commit}`], { cwd: root });
  if (local.status !== 0) {
    throw new Error(
      `Live canonical ref ${requestedRef} resolves to ${resolvedSha}, but ${root} does not contain that commit; fetch before freezing the cohort.`,
    );
  }
  return {
    requested_ref: requestedRef,
    resolved_sha: resolvedSha,
    canonical_remote: canonicalRemote,
    resolution_source: 'canonical_remote',
    observed_remote_ref: selected.ref,
  };
}

function assertCheckout(root: string, label: string): void {
  if (!fs.existsSync(root)) throw new Error(`${label} checkout is missing at ${root}.`);
}

export function buildReleaseCohortLock(
  options: ReleaseCohortLockOptions,
  runner: CommandRunner = run,
  generatedAt = new Date().toISOString(),
): ReleaseCohortLock {
  assertCheckout(options.repoRoot, 'App');
  assertCheckout(options.shellRoot, 'Active shell');
  assertCheckout(options.frameworkRoot, 'OPL Framework');
  const app = resolveCanonicalGitRef(options.repoRoot, options.appRef, releaseCohortCanonicalRemotes.app, runner);
  const shell = resolveCanonicalGitRef(options.shellRoot, options.shellRef, releaseCohortCanonicalRemotes.shell, runner);
  const framework = resolveCanonicalGitRef(
    options.frameworkRoot,
    options.frameworkRef,
    releaseCohortCanonicalRemotes.framework,
    runner,
  );
  const cohortIdentity = releaseCohortIdentityFromShas(
    app.resolved_sha,
    shell.resolved_sha,
    framework.resolved_sha,
  );
  return {
    schema: 'opl_app_release_cohort_lock.v1',
    generated_at: generatedAt,
    app: {
      ...app,
      repo_root: options.repoRoot,
    },
    shell: {
      ...shell,
      repo_root: options.shellRoot,
    },
    framework: {
      ...framework,
      repo_root: options.frameworkRoot,
    },
    authority_boundary: {
      cohort_lock_can_dispatch_workflow: false,
      cohort_lock_can_publish_release: false,
      cohort_lock_can_write_runtime_truth: false,
    },
    cohort_identity: cohortIdentity,
  };
}

function releaseCohortIdentityFromShas(appSha: string, shellSha: string, frameworkSha: string): string {
  const canonical = JSON.stringify({
    app_sha: appSha.toLowerCase(),
    shell_sha: shellSha.toLowerCase(),
    framework_sha: frameworkSha.toLowerCase(),
  });
  return `sha256:${crypto.createHash('sha256').update(canonical).digest('hex')}`;
}

export function releaseCohortLockIdentity(lock: ReleaseCohortLock): string {
  if (lock.schema !== 'opl_app_release_cohort_lock.v1') {
    throw new Error(`Unsupported release cohort lock schema: ${String(lock.schema)}.`);
  }
  const shas = [lock.app?.resolved_sha, lock.shell?.resolved_sha, lock.framework?.resolved_sha];
  if (!shas.every((sha) => typeof sha === 'string' && /^[0-9a-f]{40}$/i.test(sha))) {
    throw new Error('Release cohort lock identity requires exact 40-character App, Shell, and Framework SHAs.');
  }
  const identity = releaseCohortIdentityFromShas(
    lock.app.resolved_sha,
    lock.shell.resolved_sha,
    lock.framework.resolved_sha,
  );
  if (lock.cohort_identity && lock.cohort_identity !== identity) {
    throw new Error(`Release cohort lock identity field ${lock.cohort_identity} does not match computed ${identity}.`);
  }
  return identity;
}

export function renderReleaseCohortLockMarkdown(lock: ReleaseCohortLock): string {
  return `${[
    '# Release Cohort Lock',
    '',
    `- Schema: ${lock.schema}`,
    `- App requested ref: ${lock.app.requested_ref}`,
    `- App resolved SHA: ${lock.app.resolved_sha}`,
    `- Shell requested ref: ${lock.shell.requested_ref}`,
    `- Shell resolved SHA: ${lock.shell.resolved_sha}`,
    `- Framework requested ref: ${lock.framework.requested_ref}`,
    `- Framework resolved SHA: ${lock.framework.resolved_sha}`,
    `- Cohort identity: ${releaseCohortLockIdentity(lock)}`,
    '',
  ].join('\n')}\n`;
}

function fsyncParentDirectory(filePath: string): void {
  const descriptor = fs.openSync(path.dirname(filePath), 'r');
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function writeStagedFile(filePath: string, bytes: string): string {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  const descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, bytes, 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  return temporaryPath;
}

function readJsonObject<T>(filePath: string, label: string): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    throw new Error(`${label} at ${filePath} is unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export type CreateOnceArtifactSetOptions<T> = {
  output: string;
  markdown: string;
  value: T;
  identity: (value: T) => string;
  label: string;
  renderMarkdown: (value: T) => string;
};

export function writeCreateOnceArtifactSet<T>(
  options: CreateOnceArtifactSetOptions<T>,
  failureInjection: ArtifactWriteFailureInjection = {},
): T {
  const { output, markdown, value, identity, label, renderMarkdown } = options;
  if (!output) {
    if (markdown) throw new Error(`${label} Markdown requires an authority JSON --output path.`);
    return value;
  }
  if (markdown && output === markdown) throw new Error(`${label} JSON and Markdown paths must be different.`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (markdown) fs.mkdirSync(path.dirname(markdown), { recursive: true });
  const lockPath = `${output}.lock`;
  let lockDescriptor: number | null = null;
  let jsonTemporaryPath = '';
  let markdownTemporaryPath = '';
  let markdownCommittedByThisAttempt = false;
  let authorityCommitted = false;
  let authorityRenamed = false;
  try {
    lockDescriptor = fs.openSync(lockPath, 'wx', 0o600);
    fs.writeFileSync(lockDescriptor, `${JSON.stringify({
      pid: process.pid,
      identity: identity(value),
      acquired_at: new Date().toISOString(),
    })}\n`, 'utf8');
    fs.fsyncSync(lockDescriptor);

    if (fs.existsSync(output)) {
      const existing = readJsonObject<T>(output, label);
      const existingIdentity = identity(existing);
      const requestedIdentity = identity(value);
      if (existingIdentity !== requestedIdentity) {
        throw new Error(
          `${label} identity mismatch at ${output}: existing ${existingIdentity}, requested ${requestedIdentity}. ` +
          'Freeze a new cohort at a new path instead of overwriting the existing record.',
        );
      }
      if (markdown) {
        const expectedMarkdown = renderMarkdown(existing);
        if (fs.existsSync(markdown)) {
          if (fs.readFileSync(markdown, 'utf8') !== expectedMarkdown) {
            throw new Error(`${label} Markdown at ${markdown} does not match the existing authority JSON.`);
          }
        } else {
          markdownTemporaryPath = writeStagedFile(markdown, expectedMarkdown);
          fs.renameSync(markdownTemporaryPath, markdown);
          markdownTemporaryPath = '';
          fsyncParentDirectory(markdown);
        }
      }
      return existing;
    }

    const jsonBytes = `${JSON.stringify(value, null, 2)}\n`;
    const markdownBytes = markdown ? renderMarkdown(value) : '';
    if (markdown && fs.existsSync(markdown) && fs.readFileSync(markdown, 'utf8') !== markdownBytes) {
      throw new Error(`${label} found conflicting orphan Markdown at ${markdown}; remove or relocate it after inspection.`);
    }
    jsonTemporaryPath = writeStagedFile(output, jsonBytes);
    if (markdown && !fs.existsSync(markdown)) markdownTemporaryPath = writeStagedFile(markdown, markdownBytes);
    failureInjection.afterStage?.();
    if (markdownTemporaryPath) {
      fs.renameSync(markdownTemporaryPath, markdown);
      markdownTemporaryPath = '';
      markdownCommittedByThisAttempt = true;
      fsyncParentDirectory(markdown);
    }
    failureInjection.afterMarkdownCommit?.();
    failureInjection.beforeAuthorityCommit?.();
    fs.renameSync(jsonTemporaryPath, output);
    jsonTemporaryPath = '';
    authorityRenamed = true;
    fsyncParentDirectory(output);
    authorityCommitted = true;
    return value;
  } finally {
    if (jsonTemporaryPath) fs.rmSync(jsonTemporaryPath, { force: true });
    if (markdownTemporaryPath) fs.rmSync(markdownTemporaryPath, { force: true });
    if (!authorityCommitted && authorityRenamed) {
      fs.rmSync(output, { force: true });
      fsyncParentDirectory(output);
    }
    if (!authorityCommitted && markdownCommittedByThisAttempt && markdown) {
      fs.rmSync(markdown, { force: true });
      fsyncParentDirectory(markdown);
    }
    if (lockDescriptor !== null) fs.closeSync(lockDescriptor);
    if (lockDescriptor !== null) {
      fs.rmSync(lockPath, { force: true });
      fsyncParentDirectory(lockPath);
    }
  }
}

export function writeReleaseCohortLockMarkdown(filePath: string, lock: ReleaseCohortLock): void {
  if (!filePath) return;
  const temporaryPath = writeStagedFile(filePath, renderReleaseCohortLockMarkdown(lock));
  try {
    fs.renameSync(temporaryPath, filePath);
    fsyncParentDirectory(filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function writeReleaseCohortLock(
  options: ReleaseCohortLockOptions,
  lock: ReleaseCohortLock,
  failureInjection: ArtifactWriteFailureInjection = {},
): ReleaseCohortLock {
  return writeCreateOnceArtifactSet({
    output: options.output,
    markdown: options.markdown,
    value: lock,
    identity: releaseCohortLockIdentity,
    label: 'Release cohort lock',
    renderMarkdown: renderReleaseCohortLockMarkdown,
  }, failureInjection);
}

function isMainModule(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isMainModule()) {
  try {
    const options = parseReleaseCohortLockArgs(process.argv.slice(2));
    const lock = writeReleaseCohortLock(options, buildReleaseCohortLock(options));
    process.stdout.write(`${JSON.stringify(lock, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
