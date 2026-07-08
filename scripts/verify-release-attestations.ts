#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs as parseNodeArgs } from 'node:util';

const defaultRepo = 'gaofeng21cn/one-person-lab-app';
const commandMaxBuffer = 8 * 1024 * 1024;

type Subject = {
  kind: 'asset' | 'oci';
  value: string;
};

type CommandResult = {
  subject: string;
  kind: Subject['kind'];
  command: string[];
  exit_status: number | null;
  stdout: string;
  stderr: string;
};

type Options = {
  version: string;
  repo: string;
  output: string;
  subjects: Subject[];
};

function usage(): void {
  process.stdout.write(`Usage:
  npm run release:attestation:verify -- --version <version> --asset <path> [--asset <path>] [--oci <ref>]

Options:
  --version <version>      OPL release version, for example 26.7.8.
  --repo <owner/name>      GitHub repository. Default: ${defaultRepo}
  --asset <path>           Downloaded release asset to verify with gh attestation verify.
  --oci <ref>              OCI subject such as oci://ghcr.io/owner/image@sha256:<digest>.
  --output <path>          Output JSON summary. Default: attestation-verification-summary.json.
  --help                   Show this message.
`);
}

function values(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function parseArgs(argv: string[]): Options {
  const parsed = parseNodeArgs({
    args: argv,
    allowPositionals: false,
    options: {
      version: { type: 'string' },
      repo: { type: 'string' },
      asset: { type: 'string', multiple: true },
      oci: { type: 'string', multiple: true },
      output: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (parsed.values.help) {
    usage();
    process.exit(0);
  }
  const version = parsed.values.version?.trim() ?? '';
  if (!version) throw new Error('Pass --version <version>.');
  const repo = parsed.values.repo?.trim() || defaultRepo;
  const output = parsed.values.output?.trim() || 'attestation-verification-summary.json';
  const subjects: Subject[] = [
    ...values(parsed.values.asset).map((entry) => ({ kind: 'asset' as const, value: entry.trim() })),
    ...values(parsed.values.oci).map((entry) => ({ kind: 'oci' as const, value: entry.trim() })),
  ].filter((entry) => entry.value);
  if (subjects.length === 0) {
    throw new Error('Pass at least one --asset <path> or --oci <ref> to verify.');
  }
  return { version, repo, output, subjects };
}

function runGhAttestationVerify(subject: Subject, repo: string): CommandResult {
  const args = ['attestation', 'verify', subject.value, '--repo', repo];
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    maxBuffer: commandMaxBuffer,
  });
  return {
    subject: subject.value,
    kind: subject.kind,
    command: ['gh', ...args],
    exit_status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function buildSummary(options: Options, results: CommandResult[]) {
  const failures = results.filter((result) => result.exit_status !== 0);
  return {
    schema: 'opl_release_attestation_verification.v1',
    version: options.version,
    repo: options.repo,
    generated_at: new Date().toISOString(),
    status: failures.length === 0 ? 'passed' : 'failed',
    role: 'build_integrity_evidence',
    verified_assets: results
      .filter((result) => result.exit_status === 0)
      .map((result) => ({
        name: path.basename(result.subject),
        subject: result.subject,
        kind: result.kind,
      })),
    failed_assets: failures.map((result) => ({
      name: path.basename(result.subject),
      subject: result.subject,
      kind: result.kind,
      exit_status: result.exit_status,
      stderr: result.stderr.trim(),
    })),
    command_results: results,
    rule: 'Artifact attestation verifies build integrity for public release bytes; it is not release readiness evidence by itself.',
    does_not_replace: [
      'checksum verification',
      'remote asset readback',
      'codesign/spctl',
      'clean install/VM readiness',
      'candidate-record validation',
      'release-owner receipt',
    ],
  };
}

function writeJson(filePath: string, payload: unknown): void {
  const dir = path.dirname(path.resolve(filePath));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const results = options.subjects.map((subject) => runGhAttestationVerify(subject, options.repo));
  const summary = buildSummary(options, results);
  writeJson(options.output, summary);
  if (summary.status === 'failed') {
    process.stderr.write(`Artifact attestation verification failed for ${summary.failed_assets.length} subject(s).\n`);
    process.exit(1);
  }
  process.stdout.write(`Artifact attestation verification passed for ${summary.verified_assets.length} subject(s).\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
