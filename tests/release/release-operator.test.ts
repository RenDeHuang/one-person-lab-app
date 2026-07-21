import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '../..');

function runOperator(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/release-operator.ts', ...args],
    { cwd: appRoot, encoding: 'utf8' },
  );
}

test('retired release operator only inspects local historical receipt bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-retired-operator-receipt-'));
  const receiptPath = path.join(root, 'receipt.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify({ schema: 'historical_receipt.v1', outcome: 'failed' })}\n`);

  try {
    const result = runOperator(['inspect-receipt', '--receipt', receiptPath]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.mode, 'historical_read_only');
    assert.equal(output.evidence_kind, 'receipt');
    assert.equal(output.authoritative_for_new_release, false);
    assert.equal(output.mutation_authorized, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('retired release operator rejects former planning and recovery commands', () => {
  for (const command of ['plan', 'diagnose-vm', 'reconcile', 'resume', 'promote', 'cancel']) {
    const result = runOperator([command, '--execute']);
    assert.equal(result.status, 2, `${command}: ${result.stderr || result.stdout}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'retired_fail_closed');
    assert.equal(output.entrypoint, 'release_operator');
    assert.equal(output.requested_command, command);
    assert.equal(output.mutation_authorized, false);
  }
});

test('retired release operator help advertises no live controller command', () => {
  const result = runOperator(['--help']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /status --state/);
  assert.match(result.stdout, /inspect-receipt --receipt/);
  assert.doesNotMatch(result.stdout, /--execute|npm run release:/);
});
