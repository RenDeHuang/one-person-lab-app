import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  appRoot,
  createGitCheckout,
  runGit,
} from './release-readiness/helpers.ts';
import {
  parseReleaseCohortLockArgs,
  releaseCohortCanonicalRemotes,
  releaseCohortLockIdentity,
  resolveCanonicalGitRef,
  writeReleaseCohortLock,
  type ReleaseCohortLock,
  type ReleaseCohortLockOptions,
} from '../../scripts/release-cohort-lock.ts';

function cleanEnv() {
  const {
    OPL_APP_REF,
    OPL_APP_COMMIT,
    OPL_SHELL_REF,
    OPL_FRAMEWORK_REF,
    OPL_SHELL_ROOT,
    OPL_FRAMEWORK_ROOT,
    OPL_RELEASE_COHORT_LOCK,
    OPL_RELEASE_COHORT_LOCK_MARKDOWN,
    ...env
  } = process.env;
  return env;
}

function runScript(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/release-cohort-lock.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: cleanEnv(),
    },
  );
}

function lockFixture(
  appSha = 'a'.repeat(40),
  shellSha = 'b'.repeat(40),
  frameworkSha = 'c'.repeat(40),
  generatedAt = '2026-07-18T00:00:00.000Z',
): ReleaseCohortLock {
  const lock: ReleaseCohortLock = {
    schema: 'opl_app_release_cohort_lock.v1',
    generated_at: generatedAt,
    app: { requested_ref: appSha, resolved_sha: appSha, repo_root: '/app' },
    shell: { requested_ref: shellSha, resolved_sha: shellSha, repo_root: '/shell' },
    framework: { requested_ref: frameworkSha, resolved_sha: frameworkSha, repo_root: '/framework' },
    authority_boundary: {
      cohort_lock_can_dispatch_workflow: false,
      cohort_lock_can_publish_release: false,
      cohort_lock_can_write_runtime_truth: false,
    },
  };
  lock.cohort_identity = releaseCohortLockIdentity(lock);
  return lock;
}

function writeOptions(root: string): ReleaseCohortLockOptions {
  return {
    appRef: 'a'.repeat(40),
    shellRef: 'b'.repeat(40),
    frameworkRef: 'c'.repeat(40),
    repoRoot: '/app',
    shellRoot: '/shell',
    frameworkRoot: '/framework',
    output: path.join(root, 'release-cohort-lock.json'),
    markdown: path.join(root, 'release-cohort-lock.md'),
  };
}

test('release cohort lock resolves requested refs to immutable SHAs', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-cohort-lock-'));
  const shell = createGitCheckout('opl-release-lock-shell-');
  const framework = createGitCheckout('opl-release-lock-framework-');
  const appHead = runGit(appRoot, ['rev-parse', 'HEAD']);
  const outputPath = path.join(tempRoot, 'release-cohort-lock.json');
  const markdownPath = path.join(tempRoot, 'release-cohort-lock.md');

  const result = runScript([
    '--app-ref',
    appHead,
    '--shell-ref',
    shell.head,
    '--framework-ref',
    framework.head,
    '--shell-root',
    shell.root,
    '--framework-root',
    framework.root,
    '--output',
    outputPath,
    '--markdown',
    markdownPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const stdout = JSON.parse(result.stdout);
  const lock = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(stdout.schema, 'opl_app_release_cohort_lock.v1');
  assert.equal(lock.schema, 'opl_app_release_cohort_lock.v1');
  assert.equal(lock.app.requested_ref, appHead);
  assert.equal(lock.app.resolved_sha, appHead);
  assert.equal(lock.shell.requested_ref, shell.head);
  assert.equal(lock.shell.resolved_sha, shell.head);
  assert.equal(lock.framework.requested_ref, framework.head);
  assert.equal(lock.framework.resolved_sha, framework.head);
  assert.equal(lock.authority_boundary.cohort_lock_can_dispatch_workflow, false);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), new RegExp(`Shell resolved SHA: ${shell.head}`));
});

test('release cohort lock resolves mutable refs from the live canonical remote, not stale local tracking refs', () => {
  const remoteSha = '1'.repeat(40);
  const calls: string[] = [];
  const resolved = resolveCanonicalGitRef(
    '/tmp/unused-release-cohort-lock-root',
    'main',
    releaseCohortCanonicalRemotes.shell,
    (command, args) => {
      calls.push(`${command} ${args.join(' ')}`);
      if (args[0] === 'ls-remote') {
        return { status: 0, stdout: `${remoteSha}\trefs/heads/main\n`, stderr: '' };
      }
      if (args[0] === 'cat-file' && args[2] === `${remoteSha}^{commit}`) {
        return { status: 0, stdout: '', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: 'unexpected local ref lookup' };
    }
  );

  assert.equal(resolved.resolved_sha, remoteSha);
  assert.equal(resolved.resolution_source, 'canonical_remote');
  assert.match(calls[0], new RegExp(`^git ls-remote ${releaseCohortCanonicalRemotes.shell}`));
  assert.deepEqual(calls.slice(1), [`git cat-file -e ${remoteSha}^{commit}`]);
  assert.equal(calls.some((call) => call.includes('refs/remotes/origin/main')), false);
});

test('release cohort lock fails unresolved source refs before emitting dispatch inputs', () => {
  const shell = createGitCheckout('opl-release-lock-missing-shell-');
  const framework = createGitCheckout('opl-release-lock-missing-framework-');
  const appHead = runGit(appRoot, ['rev-parse', 'HEAD']);
  const result = runScript([
    '--app-ref',
    appHead,
    '--shell-ref',
    'f'.repeat(40),
    '--framework-ref',
    framework.head,
    '--shell-root',
    shell.root,
    '--framework-root',
    framework.root,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unable to resolve f{40}/);
  assert.equal(result.stdout, '');
});

test('release cohort lock derives default source roots from an explicit repo root', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-lock-repo-root-'));
  const parentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-lock-parent-'));
  const app = createGitCheckout('explicit-app-root', path.join(parentRoot, 'app'));
  const shellRoot = path.join(app.root, 'shells', 'aionui');
  const frameworkRoot = path.join(parentRoot, 'one-person-lab');
  fs.mkdirSync(path.dirname(shellRoot), { recursive: true });
  const shell = createGitCheckout('nested-shell-root', shellRoot);
  const framework = createGitCheckout('sibling-framework-root', frameworkRoot);

  const outputPath = path.join(tempRoot, 'release-cohort-lock.json');
  const result = runScript([
    '--repo-root',
    app.root,
    '--shell-ref',
    shell.head,
    '--framework-ref',
    framework.head,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const lock = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(lock.app.requested_ref, app.head);
  assert.equal(lock.app.resolved_sha, app.head);
  assert.equal(lock.app.repo_root, app.root);
  assert.equal(lock.shell.repo_root, shellRoot);
  assert.equal(lock.framework.repo_root, frameworkRoot);
});

test('release cohort lock rejects conflicting App ref aliases', () => {
  assert.throws(
    () => parseReleaseCohortLockArgs([
      '--app-ref', 'a'.repeat(40), '--app-commit', 'b'.repeat(40),
      '--shell-ref', 'c'.repeat(40), '--framework-ref', 'd'.repeat(40),
    ]),
    /--app-ref and --app-commit disagree/,
  );
});

test('release cohort lock create-once write preserves exact bytes for the same identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-lock-idempotent-'));
  const options = writeOptions(root);
  const first = lockFixture('a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40), '2026-07-18T00:00:00.000Z');
  const second = lockFixture('a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40), '2026-07-18T00:01:00.000Z');

  const firstPersisted = writeReleaseCohortLock(options, first);
  const firstBytes = fs.readFileSync(options.output, 'utf8');
  const secondPersisted = writeReleaseCohortLock(options, second);

  assert.equal(firstPersisted.generated_at, first.generated_at);
  assert.equal(secondPersisted.generated_at, first.generated_at);
  assert.equal(fs.readFileSync(options.output, 'utf8'), firstBytes);
  assert.equal(fs.existsSync(`${options.output}.lock`), false);
});

test('release cohort lock CAS rejects an existing different identity without changing bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-lock-mismatch-'));
  const options = writeOptions(root);
  writeReleaseCohortLock(options, lockFixture());
  const originalJson = fs.readFileSync(options.output, 'utf8');
  const originalMarkdown = fs.readFileSync(options.markdown, 'utf8');

  assert.throws(
    () => writeReleaseCohortLock(options, lockFixture('d'.repeat(40))),
    /identity mismatch.*Freeze a new cohort/s,
  );
  assert.equal(fs.readFileSync(options.output, 'utf8'), originalJson);
  assert.equal(fs.readFileSync(options.markdown, 'utf8'), originalMarkdown);
});

test('release cohort lock transaction rolls back derived output after an injected pre-commit failure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-lock-rollback-'));
  const options = writeOptions(root);

  assert.throws(
    () => writeReleaseCohortLock(options, lockFixture(), {
      afterMarkdownCommit: () => { throw new Error('injected failure'); },
    }),
    /injected failure/,
  );
  assert.equal(fs.existsSync(options.output), false);
  assert.equal(fs.existsSync(options.markdown), false);
  assert.equal(fs.existsSync(`${options.output}.lock`), false);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('release cohort lock rejects aliased JSON and Markdown paths before writing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-lock-same-path-'));
  const options = writeOptions(root);
  options.markdown = options.output;

  assert.throws(() => writeReleaseCohortLock(options, lockFixture()), /paths must be different/);
  assert.equal(fs.existsSync(options.output), false);
});

test('release cohort lock exclusive writer lock rejects concurrent creation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-lock-concurrent-'));
  const options = writeOptions(root);
  fs.writeFileSync(`${options.output}.lock`, 'held\n');

  assert.throws(() => writeReleaseCohortLock(options, lockFixture()), /EEXIST/);
  assert.equal(fs.existsSync(options.output), false);
});
