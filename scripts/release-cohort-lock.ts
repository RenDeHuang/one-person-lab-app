#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { writeLinesFile } from './release-file-helpers.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type CommandRunner = (command: string, args: string[], options: { cwd: string }) => CommandResult;

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

function run(command: string, args: string[], options: { cwd: string }): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
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

function defaultOptions(): ReleaseCohortLockOptions {
  const repoRoot = appRoot;
  return {
    appRef: process.env.OPL_APP_REF || process.env.OPL_APP_COMMIT || process.env.GITHUB_SHA || gitHead(repoRoot),
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
  if (typeof values['app-ref'] === 'string') parsed.appRef = values['app-ref'];
  if (typeof values['app-commit'] === 'string') parsed.appRef = values['app-commit'];
  if (typeof values['shell-ref'] === 'string') parsed.shellRef = values['shell-ref'];
  if (typeof values['framework-ref'] === 'string') parsed.frameworkRef = values['framework-ref'];
  if (typeof values['repo-root'] === 'string') parsed.repoRoot = values['repo-root'];
  if (typeof values['shell-root'] === 'string') parsed.shellRoot = values['shell-root'];
  if (typeof values['framework-root'] === 'string') parsed.frameworkRoot = values['framework-root'];
  if (typeof values.output === 'string') parsed.output = values.output;
  if (typeof values.markdown === 'string') parsed.markdown = values.markdown;

  if (!parsed.appRef.trim()) throw new Error('Pass --app-ref <ref>/--app-commit <sha> or run from a git checkout.');
  if (!parsed.shellRef.trim()) throw new Error('Pass --shell-ref <ref> or set OPL_SHELL_REF.');
  if (!parsed.frameworkRef.trim()) throw new Error('Pass --framework-ref <ref> or set OPL_FRAMEWORK_REF.');

  const repoRoot = path.resolve(parsed.repoRoot);
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
    output: parsed.output ? path.resolve(parsed.output) : '',
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
  };
}

function refCandidates(ref: string): string[] {
  if (/^[0-9a-f]{7,40}$/i.test(ref)) return [ref];
  return [
    ref,
    `refs/heads/${ref}`,
    `refs/remotes/origin/${ref}`,
    `refs/tags/${ref}`,
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
  return {
    schema: 'opl_app_release_cohort_lock.v1',
    generated_at: generatedAt,
    app: {
      requested_ref: options.appRef,
      resolved_sha: resolveGitRef(options.repoRoot, options.appRef, runner),
      repo_root: options.repoRoot,
    },
    shell: {
      requested_ref: options.shellRef,
      resolved_sha: resolveGitRef(options.shellRoot, options.shellRef, runner),
      repo_root: options.shellRoot,
    },
    framework: {
      requested_ref: options.frameworkRef,
      resolved_sha: resolveGitRef(options.frameworkRoot, options.frameworkRef, runner),
      repo_root: options.frameworkRoot,
    },
    authority_boundary: {
      cohort_lock_can_dispatch_workflow: false,
      cohort_lock_can_publish_release: false,
      cohort_lock_can_write_runtime_truth: false,
    },
  };
}

export function writeReleaseCohortLockMarkdown(filePath: string, lock: ReleaseCohortLock): void {
  if (!filePath) return;
  writeLinesFile(filePath, [
    '# Release Cohort Lock',
    '',
    `- Schema: ${lock.schema}`,
    `- App requested ref: ${lock.app.requested_ref}`,
    `- App resolved SHA: ${lock.app.resolved_sha}`,
    `- Shell requested ref: ${lock.shell.requested_ref}`,
    `- Shell resolved SHA: ${lock.shell.resolved_sha}`,
    `- Framework requested ref: ${lock.framework.requested_ref}`,
    `- Framework resolved SHA: ${lock.framework.resolved_sha}`,
    '',
  ]);
}

export function writeReleaseCohortLock(options: ReleaseCohortLockOptions, lock: ReleaseCohortLock): void {
  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  }
  writeReleaseCohortLockMarkdown(options.markdown, lock);
}

function isMainModule(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isMainModule()) {
  try {
    const options = parseReleaseCohortLockArgs(process.argv.slice(2));
    const lock = buildReleaseCohortLock(options);
    writeReleaseCohortLock(options, lock);
    process.stdout.write(`${JSON.stringify(lock, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
