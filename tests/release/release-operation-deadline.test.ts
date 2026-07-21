import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertReleaseOperationDeadline,
  remainingReleaseOperationMilliseconds,
  releaseOperationDeadline,
  releaseOperationDeadlineTimestamp,
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
