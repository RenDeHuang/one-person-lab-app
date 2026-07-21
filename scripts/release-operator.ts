#!/usr/bin/env node

import { parseArgs as parseNodeArgs } from 'node:util';
import {
  inspectHistoricalReleaseReceipt,
  inspectHistoricalStableReleaseSession,
  retiredReleaseEntryResult,
} from './run-stable-release.ts';

function usage(): void {
  process.stdout.write(`Usage:
  node --experimental-strip-types scripts/release-operator.ts status --state <historical-session.json>
  node --experimental-strip-types scripts/release-operator.ts inspect-receipt --receipt <historical-receipt.json>

This retired operator can inspect local historical evidence only. It cannot plan, dispatch, resume, reconcile, cancel, or publish a release.
`);
}

function parsePathOption(argv: string[], option: 'state' | 'receipt'): string {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      [option]: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    usage();
    return '';
  }
  const value = values[option];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Pass --${option} <path>.`);
  }
  return value;
}

function main(): void {
  const [command = '', ...args] = process.argv.slice(2);
  if (command === '--help' || command === '-h') {
    usage();
    return;
  }
  if (command === 'status') {
    const statePath = parsePathOption(args, 'state');
    if (statePath) process.stdout.write(`${JSON.stringify(inspectHistoricalStableReleaseSession(statePath), null, 2)}\n`);
    return;
  }
  if (command === 'inspect-receipt') {
    const receiptPath = parsePathOption(args, 'receipt');
    if (receiptPath) process.stdout.write(`${JSON.stringify(inspectHistoricalReleaseReceipt(receiptPath), null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(retiredReleaseEntryResult('release_operator', command), null, 2)}\n`);
  process.exitCode = 2;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
