import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { ensureShellHistory, isGitCheckout } from '../../scripts/ensure-active-shell.ts';

function runGit(cwd: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });
  assert.equal(result.status, 0, result.stderr);
}

test('does not treat an empty child directory as its parent Git checkout', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-ensure-shell-'));
  try {
    runGit(root, ['init', '--quiet']);
    const incompleteShell = path.join(root, 'shells', 'aionui');
    fs.mkdirSync(incompleteShell, { recursive: true });

    assert.equal(isGitCheckout(incompleteShell), false);

    runGit(incompleteShell, ['init', '--quiet']);
    assert.equal(isGitCheckout(incompleteShell), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('hydrates a shallow Shell checkout before a currentness validator reads ancestry', () => {
  const calls: Array<{ command: string; args: string[]; capture?: boolean; cwd?: string }> = [];
  const shellRoot = '/tmp/opl-active-shell';
  const result = ensureShellHistory(shellRoot, (command, args, options = {}) => {
    calls.push({ command, args, ...options });
    return { stdout: args[0] === 'rev-parse' ? 'true\n' : '' };
  });

  assert.equal(result, true);
  assert.deepEqual(calls, [
    {
      command: 'git',
      args: ['rev-parse', '--is-shallow-repository'],
      capture: true,
      cwd: shellRoot,
    },
    {
      command: 'git',
      args: ['fetch', '--no-tags', '--unshallow', 'origin'],
      cwd: shellRoot,
    },
  ]);
});

test('does not fetch when the Shell checkout already has complete history', () => {
  const calls: Array<{ command: string; args: string[]; capture?: boolean; cwd?: string }> = [];
  const result = ensureShellHistory('/tmp/opl-active-shell', (command, args, options = {}) => {
    calls.push({ command, args, ...options });
    return { stdout: 'false\n' };
  });

  assert.equal(result, false);
  assert.equal(calls.length, 1);
});
