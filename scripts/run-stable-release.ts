#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs as parseNodeArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import {
  readStableReleaseSession,
  type StableReleaseSession,
} from './stable-release-session.ts';

type JsonRecord = Record<string, unknown>;

export type HistoricalReleaseEvidenceInspection = {
  schema: 'opl_app_historical_release_evidence_inspection.v1';
  mode: 'historical_read_only';
  evidence_kind: 'stable_session_v3' | 'receipt';
  source_path: string;
  source_sha256: string;
  source_size_bytes: number;
  source_schema: string | null;
  authoritative_for_new_release: false;
  mutation_authorized: false;
  framework_authority: {
    state_authority: 'framework_opl_release_portable_checkpoint_and_receipt';
    stable_operations: readonly ['standard', 'resume_standard', 'append_full'];
    status_command: 'opl release status --bundle <sha256:digest> --store <directory>';
  };
  evidence: JsonRecord;
};

export type RetiredReleaseEntryResult = {
  schema: 'opl_app_legacy_release_entry_retired.v1';
  status: 'retired_fail_closed';
  entrypoint: 'stable_controller' | 'release_operator';
  requested_command: string;
  mutation_authorized: false;
  replacement_authority: 'framework_opl_release_portable_checkpoint_and_receipt';
  stable_operations: ['standard', 'resume_standard', 'append_full'];
  next_action: 'inspect_framework_checkpoint_or_create_a_new_framework_bundle';
};

const frameworkAuthority = {
  state_authority: 'framework_opl_release_portable_checkpoint_and_receipt',
  stable_operations: ['standard', 'resume_standard', 'append_full'],
  status_command: 'opl release status --bundle <sha256:digest> --store <directory>',
} as const;

function readJsonObject(filePath: string): { bytes: Buffer; value: JsonRecord } {
  const resolved = path.resolve(filePath);
  const bytes = fs.readFileSync(resolved);
  const value = JSON.parse(bytes.toString('utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Historical release evidence must be a JSON object: ${resolved}`);
  }
  return { bytes, value: value as JsonRecord };
}

function inspection(
  evidenceKind: HistoricalReleaseEvidenceInspection['evidence_kind'],
  filePath: string,
  bytes: Buffer,
  evidence: JsonRecord,
): HistoricalReleaseEvidenceInspection {
  return {
    schema: 'opl_app_historical_release_evidence_inspection.v1',
    mode: 'historical_read_only',
    evidence_kind: evidenceKind,
    source_path: path.resolve(filePath),
    source_sha256: `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`,
    source_size_bytes: bytes.byteLength,
    source_schema: typeof evidence.schema === 'string' ? evidence.schema : null,
    authoritative_for_new_release: false,
    mutation_authorized: false,
    framework_authority: frameworkAuthority,
    evidence,
  };
}

export function inspectHistoricalStableReleaseSession(
  statePath: string,
): HistoricalReleaseEvidenceInspection {
  const resolved = path.resolve(statePath);
  const bytes = fs.readFileSync(resolved);
  const session: StableReleaseSession = readStableReleaseSession(resolved);
  return inspection('stable_session_v3', resolved, bytes, session as unknown as JsonRecord);
}

export function inspectHistoricalReleaseReceipt(
  receiptPath: string,
): HistoricalReleaseEvidenceInspection {
  const resolved = path.resolve(receiptPath);
  const { bytes, value } = readJsonObject(resolved);
  return inspection('receipt', resolved, bytes, value);
}

export function retiredReleaseEntryResult(
  entrypoint: RetiredReleaseEntryResult['entrypoint'],
  requestedCommand: string,
): RetiredReleaseEntryResult {
  return {
    schema: 'opl_app_legacy_release_entry_retired.v1',
    status: 'retired_fail_closed',
    entrypoint,
    requested_command: requestedCommand || '<none>',
    mutation_authorized: false,
    replacement_authority: 'framework_opl_release_portable_checkpoint_and_receipt',
    stable_operations: ['standard', 'resume_standard', 'append_full'],
    next_action: 'inspect_framework_checkpoint_or_create_a_new_framework_bundle',
  };
}

function usage(): void {
  process.stdout.write(`Usage:
  node --experimental-strip-types scripts/run-stable-release.ts status --state <historical-session.json>
  node --experimental-strip-types scripts/run-stable-release.ts inspect-receipt --receipt <historical-receipt.json>

This retired controller is read-only. Framework opl release portable checkpoints and receipts are the only live release state authority.
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

function isMainModule(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
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
  process.stdout.write(`${JSON.stringify(retiredReleaseEntryResult('stable_controller', command), null, 2)}\n`);
  process.exitCode = 2;
}

if (isMainModule()) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
