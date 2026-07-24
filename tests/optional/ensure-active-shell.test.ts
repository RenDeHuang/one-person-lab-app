import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { isGitCheckout } from '../../scripts/ensure-active-shell.ts';

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
