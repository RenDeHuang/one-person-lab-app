#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from 'node:util';

export type ReleaseOperation =
  | 'standard'
  | 'resume_standard'
  | 'append_full'
  | 'move_latest_pointer'
  | 'native_webui_follower';

export type StandardReleaseOperation = Extract<ReleaseOperation, 'standard' | 'resume_standard'>;

const operationBudgetMinutes: Record<ReleaseOperation, number> = {
  standard: 90,
  resume_standard: 30,
  append_full: 120,
  move_latest_pointer: 30,
  native_webui_follower: 30,
};

function operation(value: string | undefined): ReleaseOperation {
  if (
    value === 'standard'
    || value === 'resume_standard'
    || value === 'append_full'
    || value === 'move_latest_pointer'
    || value === 'native_webui_follower'
  ) return value;
  throw new Error(
    'Release operation must be standard, resume_standard, append_full, move_latest_pointer, or native_webui_follower.',
  );
}

function timestamp(value: string | undefined, label: string): number {
  const parsed = Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return parsed;
}

export function releaseOperationDeadlineTimestamp(deadlineAt: string): number {
  return timestamp(deadlineAt, 'Operation deadline');
}

export function remainingReleaseOperationMilliseconds(input: {
  deadlineAt: string;
  nowMs?: number;
}): number {
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isFinite(nowMs)) throw new Error('Current time must be a finite epoch timestamp.');
  return releaseOperationDeadlineTimestamp(input.deadlineAt) - nowMs;
}

export function releaseOperationDeadline(input: {
  operation: ReleaseOperation;
  startedAt: string;
}): string {
  return resolveReleaseOperationWindow(input).deadlineAt;
}

export function resolveReleaseOperationWindow(input: {
  operation: ReleaseOperation;
  startedAt: string;
}): { startedAt: string; deadlineAt: string } {
  const startedAt = timestamp(input.startedAt, 'Operation start');
  return {
    startedAt: new Date(startedAt).toISOString(),
    deadlineAt: new Date(startedAt + operationBudgetMinutes[input.operation] * 60_000).toISOString(),
  };
}

export function inferStandardReleaseOperation(input: {
  startedAt: string;
  deadlineAt: string;
}): StandardReleaseOperation {
  const startedAt = timestamp(input.startedAt, 'Operation start');
  const deadlineAt = timestamp(input.deadlineAt, 'Operation deadline');
  for (const releaseOperation of ['standard', 'resume_standard'] as const) {
    if (deadlineAt === startedAt + operationBudgetMinutes[releaseOperation] * 60_000) {
      return releaseOperation;
    }
  }
  throw new Error('Standard control window must be exactly 90 or 30 minutes.');
}

export function assertReleaseOperationDeadline(input: {
  operation: ReleaseOperation;
  startedAt: string;
  deadlineAt: string;
  now?: string;
}): void {
  const startedAt = timestamp(input.startedAt, 'Operation start');
  const deadlineAt = timestamp(input.deadlineAt, 'Operation deadline');
  const expected = startedAt + operationBudgetMinutes[input.operation] * 60_000;
  if (deadlineAt !== expected) {
    throw new Error(
      `${input.operation} deadline must be exactly ${operationBudgetMinutes[input.operation]} minutes after operation start.`,
    );
  }
  const now = timestamp(input.now ?? new Date().toISOString(), 'Current time');
  if (now >= deadlineAt) {
    throw new Error(`${input.operation} operation deadline elapsed; no new release mutation may start.`);
  }
}

function usage(): never {
  process.stderr.write(
    'Usage:\n' +
      '  release-operation-deadline.ts resolve --operation <standard|resume_standard|append_full|move_latest_pointer|native_webui_follower> --started-at <iso>\n' +
      '  release-operation-deadline.ts infer-standard --started-at <iso> --deadline-at <iso>\n' +
      '  release-operation-deadline.ts check --operation <...> --started-at <iso> --deadline-at <iso> [--now <iso>]\n',
  );
  process.exit(2);
}

function main(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      operation: { type: 'string' },
      'started-at': { type: 'string' },
      'deadline-at': { type: 'string' },
      now: { type: 'string' },
      output: { type: 'string' },
    },
  });
  const command = positionals[0];
  const startedAt = values['started-at'];
  if (command === 'infer-standard') {
    const releaseOperation = inferStandardReleaseOperation({
      startedAt: startedAt ?? '',
      deadlineAt: values['deadline-at'] ?? '',
    });
    const operationWindow = resolveReleaseOperationWindow({
      operation: releaseOperation,
      startedAt: startedAt ?? '',
    });
    process.stdout.write(`${JSON.stringify({
      operation: releaseOperation,
      started_at: operationWindow.startedAt,
      deadline_at: operationWindow.deadlineAt,
    })}\n`);
    return;
  }
  const releaseOperation = operation(values.operation);
  if (command === 'resolve') {
    const operationWindow = resolveReleaseOperationWindow({
      operation: releaseOperation,
      startedAt: startedAt ?? '',
    });
    const payload = `${JSON.stringify({
      operation: releaseOperation,
      started_at: operationWindow.startedAt,
      deadline_at: operationWindow.deadlineAt,
    })}\n`;
    if (values.output) fs.writeFileSync(values.output, payload);
    process.stdout.write(payload);
    return;
  }
  if (command === 'check') {
    assertReleaseOperationDeadline({
      operation: releaseOperation,
      startedAt: startedAt ?? '',
      deadlineAt: values['deadline-at'] ?? '',
      now: values.now,
    });
    process.stdout.write(`${JSON.stringify({ operation: releaseOperation, status: 'admitted' })}\n`);
    return;
  }
  usage();
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
