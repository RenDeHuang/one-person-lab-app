#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requiredOptionValue } from './cli-option-args.ts';
import { asRecord, readJsonFile } from './release-json-helpers.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commandMaxBuffer = 16 * 1024 * 1024;

type Options = {
  candidateRecordPath: string;
  preflightPath: string;
  readinessPath: string;
  remoteVerificationPath: string;
  output: string;
  markdown: string;
  releaseOwnerVerdictRef: string;
  releaseOwnerReceiptRef: string;
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    candidateRecordPath: '',
    preflightPath: '',
    readinessPath: '',
    remoteVerificationPath: '',
    output: '',
    markdown: '',
    releaseOwnerVerdictRef: '',
    releaseOwnerReceiptRef: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--candidate-record') parsed.candidateRecordPath = requiredOptionValue(argv, index, token);
    else if (token === '--preflight') parsed.preflightPath = requiredOptionValue(argv, index, token);
    else if (token === '--readiness') parsed.readinessPath = requiredOptionValue(argv, index, token);
    else if (token === '--remote-verification') parsed.remoteVerificationPath = requiredOptionValue(argv, index, token);
    else if (token === '--output') parsed.output = requiredOptionValue(argv, index, token);
    else if (token === '--markdown') parsed.markdown = requiredOptionValue(argv, index, token);
    else if (token === '--release-owner-verdict-ref') {
      parsed.releaseOwnerVerdictRef = requiredOptionValue(argv, index, token);
    } else if (token === '--release-owner-receipt-ref') {
      parsed.releaseOwnerReceiptRef = requiredOptionValue(argv, index, token);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
    index += 1;
  }
  if (!parsed.candidateRecordPath) throw new Error('Pass --candidate-record <path>.');
  if (!parsed.preflightPath) throw new Error('Pass --preflight <path>.');
  if (!parsed.readinessPath) throw new Error('Pass --readiness <path>.');
  if (!parsed.remoteVerificationPath) throw new Error('Pass --remote-verification <path>.');
  if (!parsed.output) throw new Error('Pass --output <path>.');
  if (!parsed.releaseOwnerVerdictRef && !parsed.releaseOwnerReceiptRef) {
    throw new Error('Pass --release-owner-verdict-ref or --release-owner-receipt-ref.');
  }
  return {
    ...parsed,
    candidateRecordPath: path.resolve(parsed.candidateRecordPath),
    preflightPath: path.resolve(parsed.preflightPath),
    readinessPath: path.resolve(parsed.readinessPath),
    remoteVerificationPath: path.resolve(parsed.remoteVerificationPath),
    output: path.resolve(parsed.output),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
  };
}

function stringValue(record: Record<string, unknown>, key: string, fallback = '') {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function booleanValue(record: Record<string, unknown>, key: string, fallback: boolean) {
  const value = record[key];
  return typeof value === 'boolean' ? value : fallback;
}

function writePreservedJobResults(candidate: Record<string, unknown>, outputPath: string) {
  const jobResults = asRecord(candidate.job_results ?? {}, 'candidate_record.job_results');
  const target = path.join(path.dirname(outputPath), 'release-owner-resolution-job-results.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(jobResults, null, 2)}\n`, 'utf8');
  return target;
}

function runCandidateRecordWriter(args: string[]) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/write-release-candidate-record.ts', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    maxBuffer: commandMaxBuffer,
  });
  if (result.status !== 0) {
    throw new Error(
      [
        'scripts/write-release-candidate-record.ts failed.',
        result.stdout ? `stdout:\n${result.stdout}` : '',
        result.stderr ? `stderr:\n${result.stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidate = asRecord(readJsonFile(options.candidateRecordPath), 'candidate_record');
  const inputs = asRecord(candidate.inputs, 'candidate_record.inputs');
  const provenance = asRecord(candidate.provenance, 'candidate_record.provenance');
  const jobResultsPath = writePreservedJobResults(candidate, options.output);
  const args = [
    '--version',
    stringValue(candidate, 'version'),
    '--release-mode',
    stringValue(candidate, 'release_mode'),
    '--include-full-package',
    String(booleanValue(inputs, 'include_full_package', true)),
    '--run-vm-smoke',
    String(booleanValue(inputs, 'run_vm_smoke', true)),
    '--shell-ref',
    stringValue(inputs, 'shell_ref', 'main'),
    '--framework-ref',
    stringValue(inputs, 'framework_ref', 'main'),
    '--app-commit',
    stringValue(provenance, 'app_commit'),
    '--workflow-run-id',
    stringValue(provenance, 'workflow_run_id', 'local'),
    '--preflight',
    options.preflightPath,
    '--readiness',
    options.readinessPath,
    '--remote-verification',
    options.remoteVerificationPath,
    '--job-results',
    jobResultsPath,
    '--output',
    options.output,
  ];
  if (options.markdown) args.push('--markdown', options.markdown);
  if (options.releaseOwnerVerdictRef) args.push('--release-owner-verdict-ref', options.releaseOwnerVerdictRef);
  if (options.releaseOwnerReceiptRef) args.push('--release-owner-receipt-ref', options.releaseOwnerReceiptRef);

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  const rebuilt = runCandidateRecordWriter(args);
  process.stdout.write(`${JSON.stringify({
    schema: 'opl_release_owner_resolution_candidate_record.v1',
    status: rebuilt.status === 'ready_to_promote' ? 'ready_to_promote' : 'blocked',
    version: rebuilt.version ?? stringValue(candidate, 'version'),
    source_candidate_record: options.candidateRecordPath,
    output_candidate_record: options.output,
    release_owner_verdict_ref: options.releaseOwnerVerdictRef || null,
    release_owner_receipt_ref: options.releaseOwnerReceiptRef || null,
    blocked_reasons: rebuilt.blocked_reasons ?? [],
  }, null, 2)}\n`);
  if (rebuilt.status !== 'ready_to_promote') process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
