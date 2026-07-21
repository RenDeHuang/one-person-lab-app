import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  assertReleaseOperationDeadline,
  remainingReleaseOperationMilliseconds,
  releaseOperationDeadline,
  releaseOperationDeadlineTimestamp,
  resolveReleaseOperationWindow,
} from '../../scripts/release-operation-deadline.ts';

const startedAt = '2026-07-21T00:00:00.000Z';

test('release operations have bounded independent clocks', () => {
  assert.equal(
    releaseOperationDeadline({ operation: 'standard', startedAt }),
    '2026-07-21T01:30:00.000Z',
  );
  assert.equal(
    releaseOperationDeadline({ operation: 'resume_standard', startedAt }),
    '2026-07-21T00:30:00.000Z',
  );
  assert.equal(
    releaseOperationDeadline({ operation: 'append_full', startedAt }),
    '2026-07-21T00:50:00.000Z',
  );
});

test('GitHub created_at is canonicalized once before operation control is derived', () => {
  const operationWindow = resolveReleaseOperationWindow({
    operation: 'standard',
    startedAt: '2026-07-21T23:20:33Z',
  });
  assert.deepEqual(operationWindow, {
    startedAt: '2026-07-21T23:20:33.000Z',
    deadlineAt: '2026-07-22T00:50:33.000Z',
  });
});

test('resolve CLI writes the canonical operation start and matching deadline to its admission receipt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-operation-admission-'));
  const output = path.join(root, 'release-operation-admission.json');
  try {
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types',
      'scripts/release-operation-deadline.ts',
      'resolve',
      '--operation',
      'standard',
      '--started-at',
      '2026-07-21T23:20:33Z',
      '--output',
      output,
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const expected = {
      operation: 'standard',
      started_at: '2026-07-21T23:20:33.000Z',
      deadline_at: '2026-07-22T00:50:33.000Z',
    };
    assert.deepEqual(JSON.parse(result.stdout), expected);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), expected);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deadline checks reject refreshed or elapsed clocks', () => {
  assert.doesNotThrow(() => assertReleaseOperationDeadline({
    operation: 'resume_standard',
    startedAt,
    deadlineAt: '2026-07-21T00:30:00.000Z',
    now: '2026-07-21T00:29:59.999Z',
  }));
  assert.throws(() => assertReleaseOperationDeadline({
    operation: 'resume_standard',
    startedAt,
    deadlineAt: '2026-07-21T01:30:00.000Z',
    now: '2026-07-21T00:01:00.000Z',
  }), /exactly 30 minutes/);
  assert.throws(() => assertReleaseOperationDeadline({
    operation: 'resume_standard',
    startedAt,
    deadlineAt: '2026-07-21T00:30:00.000Z',
    now: '2026-07-21T00:30:00.000Z',
  }), /deadline elapsed/);
});

test('mutation callers derive remaining milliseconds from the same immutable deadline', () => {
  const deadlineAt = '2026-07-21T00:30:00.000Z';
  const deadlineMs = releaseOperationDeadlineTimestamp(deadlineAt);
  assert.equal(remainingReleaseOperationMilliseconds({ deadlineAt, nowMs: deadlineMs - 12_345 }), 12_345);
  assert.equal(remainingReleaseOperationMilliseconds({ deadlineAt, nowMs: deadlineMs }), 0);
  assert.equal(remainingReleaseOperationMilliseconds({ deadlineAt, nowMs: deadlineMs + 1 }), -1);
  assert.throws(
    () => remainingReleaseOperationMilliseconds({ deadlineAt: 'not-a-timestamp', nowMs: deadlineMs }),
    /exact ISO-8601 timestamp/,
  );
});

test('append_full receives a new operation clock after the Standard clock has expired', () => {
  const expiredStandardDeadline = releaseOperationDeadline({ operation: 'standard', startedAt });
  assert.throws(() => assertReleaseOperationDeadline({
    operation: 'standard',
    startedAt,
    deadlineAt: expiredStandardDeadline,
    now: '2026-07-21T02:00:00.000Z',
  }), /deadline elapsed/);

  const appendStartedAt = '2026-07-21T02:00:00.000Z';
  const appendDeadline = releaseOperationDeadline({ operation: 'append_full', startedAt: appendStartedAt });
  assert.equal(appendDeadline, '2026-07-21T02:50:00.000Z');
  assert.doesNotThrow(() => assertReleaseOperationDeadline({
    operation: 'append_full',
    startedAt: appendStartedAt,
    deadlineAt: appendDeadline,
    now: '2026-07-21T02:00:00.001Z',
  }));
  assert.throws(() => assertReleaseOperationDeadline({
    operation: 'append_full',
    startedAt: appendStartedAt,
    deadlineAt: expiredStandardDeadline,
    now: '2026-07-21T02:00:00.001Z',
  }), /exactly 50 minutes/);
});
