#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedSchema = 'opl_release_candidate_record.v1';
const readyStatus = 'ready_to_promote';

type Options = {
  mode: 'validate' | 'status';
  recordPath: string;
  version: string;
  format: 'json' | 'markdown';
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    mode: 'validate',
    recordPath: process.env.OPL_RELEASE_CANDIDATE_RECORD || path.resolve(appRoot, 'release-candidate-record.json'),
    version: process.env.OPL_RELEASE_VERSION || '',
    format: 'json',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--status') {
      parsed.mode = 'status';
      continue;
    }
    if (token === '--promote-ready') {
      parsed.mode = 'validate';
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    if (token === '--record') parsed.recordPath = value;
    else if (token === '--version') parsed.version = value;
    else if (token === '--format') {
      if (value !== 'json' && value !== 'markdown') {
        throw new Error(`--format must be json or markdown, got ${value}`);
      }
      parsed.format = value;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
    index += 1;
  }

  return {
    ...parsed,
    recordPath: path.resolve(parsed.recordPath),
  };
}

function objectOrNull(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function readRecord(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const record = objectOrNull(JSON.parse(raw));
  if (!record) throw new Error(`Release candidate record must be a JSON object: ${filePath}`);
  return record;
}

function evaluateRecord(record: Record<string, unknown>, options: Options) {
  const decision = objectOrNull(record.decision);
  const releaseOwnerVerdict = objectOrNull(record.release_owner_verdict);
  const blockedReasons = stringArray(record.blocked_reasons);
  const errors: string[] = [];

  if (record.schema !== expectedSchema) {
    errors.push(`Unexpected candidate record schema: ${String(record.schema)}`);
  }
  if (options.version && record.version !== options.version) {
    errors.push(`Candidate record version ${String(record.version)} does not match ${options.version}`);
  }
  if (record.status !== readyStatus) {
    const reasonText = blockedReasons.length > 0 ? `; blocked_reasons=${JSON.stringify(blockedReasons)}` : '';
    errors.push(`Release candidate status is ${String(record.status)}${reasonText}`);
  }
  if (decision?.can_promote !== true) {
    errors.push(`Release candidate decision.can_promote is ${String(decision?.can_promote)}`);
  }
  if (!releaseOwnerVerdict) {
    errors.push('Release candidate record is missing release_owner_verdict');
  } else {
    if (releaseOwnerVerdict.schema !== 'opl_app_release_owner_verdict_readout.v1') {
      errors.push(`Release owner verdict schema is ${String(releaseOwnerVerdict.schema)}`);
    }
    if (releaseOwnerVerdict.release_ready_claim !== false) {
      errors.push(`Release owner verdict release_ready_claim is ${String(releaseOwnerVerdict.release_ready_claim)}`);
    }
    if (releaseOwnerVerdict.stable_latest_promotion_claim !== false) {
      errors.push(
        `Release owner verdict stable_latest_promotion_claim is ${String(releaseOwnerVerdict.stable_latest_promotion_claim)}`,
      );
    }
  }

  return {
    schema: record.schema ?? null,
    version: record.version ?? null,
    tag: record.tag ?? null,
    status: record.status ?? null,
    can_promote: decision?.can_promote === true,
    promote_command: typeof decision?.promote_command === 'string' ? decision.promote_command : null,
    promote_ready: errors.length === 0,
    release_owner_verdict_status: typeof releaseOwnerVerdict?.status === 'string'
      ? releaseOwnerVerdict.status
      : null,
    release_owner_typed_blocker_ref: typeof releaseOwnerVerdict?.release_owner_typed_blocker_ref === 'string'
      ? releaseOwnerVerdict.release_owner_typed_blocker_ref
      : null,
    blocked_reasons: blockedReasons,
    errors,
  };
}

function formatMarkdown(summary: ReturnType<typeof evaluateRecord>) {
  const lines = [
    '## Release Candidate Status',
    '',
    `- Schema: ${String(summary.schema)}`,
    `- Version: ${String(summary.version)}`,
    `- Status: ${String(summary.status)}`,
    `- Can promote: ${summary.can_promote}`,
    `- Promote ready: ${summary.promote_ready}`,
    `- Release owner verdict: ${String(summary.release_owner_verdict_status)}`,
  ];
  if (summary.blocked_reasons.length > 0) {
    lines.push('', '### Blocked reasons', '');
    for (const reason of summary.blocked_reasons) lines.push(`- ${reason}`);
  }
  if (summary.errors.length > 0) {
    lines.push('', '### Validation errors', '');
    for (const error of summary.errors) lines.push(`- ${error}`);
  }
  return `${lines.join('\n')}\n`;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const record = readRecord(options.recordPath);
  const summary = evaluateRecord(record, options);
  const output = options.format === 'markdown'
    ? formatMarkdown(summary)
    : `${JSON.stringify(summary, null, 2)}\n`;
  process.stdout.write(output);
  if (options.mode === 'validate' && !summary.promote_ready) {
    console.error(`Release candidate record is not promote-ready: ${summary.errors.join('; ')}`);
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
