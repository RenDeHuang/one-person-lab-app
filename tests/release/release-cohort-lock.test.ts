import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot } from './release-readiness/helpers.ts';

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

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function createGitCheckout(prefix: string): { root: string; head: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return createGitCheckoutAt(root, prefix);
}

function createGitCheckoutAt(root: string, label: string): { root: string; head: string } {
  fs.mkdirSync(root, { recursive: true });
  runGit(root, ['init', '-b', 'main']);
  runGit(root, ['config', 'user.email', 'release-test@example.com']);
  runGit(root, ['config', 'user.name', 'Release Test']);
  fs.writeFileSync(path.join(root, 'README.md'), `${label}\n`, 'utf8');
  runGit(root, ['add', 'README.md']);
  runGit(root, ['commit', '-m', 'Initial test commit']);
  return { root, head: runGit(root, ['rev-parse', 'HEAD']) };
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
    'main',
    '--framework-ref',
    'main',
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
  assert.equal(lock.shell.requested_ref, 'main');
  assert.equal(lock.shell.resolved_sha, shell.head);
  assert.equal(lock.framework.requested_ref, 'main');
  assert.equal(lock.framework.resolved_sha, framework.head);
  assert.equal(lock.authority_boundary.cohort_lock_can_dispatch_workflow, false);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), new RegExp(`Shell resolved SHA: ${shell.head}`));
});

test('release cohort lock fails unresolved source refs before emitting dispatch inputs', () => {
  const shell = createGitCheckout('opl-release-lock-missing-shell-');
  const framework = createGitCheckout('opl-release-lock-missing-framework-');
  const appHead = runGit(appRoot, ['rev-parse', 'HEAD']);
  const result = runScript([
    '--app-ref',
    appHead,
    '--shell-ref',
    'missing-shell-ref',
    '--framework-ref',
    'main',
    '--shell-root',
    shell.root,
    '--framework-root',
    framework.root,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unable to resolve missing-shell-ref/);
  assert.equal(result.stdout, '');
});

test('release cohort lock derives default source roots from an explicit repo root', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-lock-repo-root-'));
  const parentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-lock-parent-'));
  const app = createGitCheckoutAt(path.join(parentRoot, 'app'), 'explicit-app-root');
  const shellRoot = path.join(app.root, 'shells', 'aionui');
  const frameworkRoot = path.join(parentRoot, 'one-person-lab');
  fs.mkdirSync(path.dirname(shellRoot), { recursive: true });
  createGitCheckoutAt(shellRoot, 'nested-shell-root');
  createGitCheckoutAt(frameworkRoot, 'sibling-framework-root');

  const outputPath = path.join(tempRoot, 'release-cohort-lock.json');
  const result = runScript([
    '--repo-root',
    app.root,
    '--app-ref',
    'main',
    '--shell-ref',
    'main',
    '--framework-ref',
    'main',
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const lock = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(lock.app.repo_root, app.root);
  assert.equal(lock.shell.repo_root, shellRoot);
  assert.equal(lock.framework.repo_root, frameworkRoot);
});
