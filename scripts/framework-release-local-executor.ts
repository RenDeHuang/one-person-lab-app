#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

type JsonRecord = Record<string, unknown>;
type Track = 'standard' | 'full';
type ProductExecutor = 'local' | 'github_actions';
type ReleaseOperation = 'standard' | 'resume_standard' | 'append_full';
type FrameworkReleaseOperation =
  | 'freeze' | 'operation-admit' | 'build' | 'verify' | 'checkpoint-export'
  | 'checkpoint-import' | 'publish' | 'reconcile' | 'status';
type FailureKind =
  | 'admission_required' | 'partial_rerun_rejected'
  | 'transport_invalid' | 'framework_cli_failed' | 'framework_result_invalid'
  | 'permanently_rejected_bundle';
type AdapterFailure = Error & {
  failureKind: FailureKind;
  requiredNextAction: string;
  details: JsonRecord;
};
type TransportProvenance = {
  checkpoint_transport_executor: ProductExecutor | null;
  transport_run_id: string | null;
  source_build_receipts: Array<{ path: string; size_bytes: number; sha256: string }>;
};

export type FrameworkReleaseLocalExecutorInput = {
  operation: FrameworkReleaseOperation;
  oplPath?: string;
  requestPath?: string;
  sourceRoot?: string;
  storeRoot?: string;
  bundleDigest?: string;
  executorReceiptPath?: string;
  qualificationReceiptPath?: string;
  track?: Track;
  checkpointPath?: string;
  checkpointOutput?: string;
  sourceBuildReceiptPaths?: string[];
  checkpointTransportExecutor?: ProductExecutor;
  transportRunId?: string;
  releaseOperation?: ReleaseOperation;
  operationId?: string;
  operationStartedAt?: string;
  operationDeadlineAt?: string;
  runAttempt?: string;
  env?: NodeJS.ProcessEnv;
};

const digestPattern = /^sha256:[0-9a-f]{64}$/;
const rejectedBundle = 'sha256:91d5ea069757fca6bb9aa2280615dc952caeff55b6b4bc13e08e40df32378f49';
const runAttemptOneOperations = new Set<FrameworkReleaseOperation>([
  'freeze',
  'operation-admit',
  'build',
  'verify',
  'publish',
  'reconcile',
]);
const operationSpecs: Record<FrameworkReleaseOperation, { command: string[]; resultKey: string }> = {
  freeze: { command: ['freeze'], resultKey: 'release_bundle_freeze' },
  'operation-admit': { command: ['operation', 'admit'], resultKey: 'release_bundle_operation_admit' },
  build: { command: ['build'], resultKey: 'release_bundle_build' },
  verify: { command: ['verify'], resultKey: 'release_bundle_verify' },
  'checkpoint-export': { command: ['checkpoint', 'export'], resultKey: 'release_bundle_checkpoint_export' },
  'checkpoint-import': { command: ['checkpoint', 'import'], resultKey: 'release_bundle_checkpoint_import' },
  publish: { command: ['publish'], resultKey: 'release_bundle_publish' },
  reconcile: { command: ['reconcile'], resultKey: 'release_bundle_reconcile' },
  status: { command: ['status'], resultKey: 'release_bundle_status' },
};

function operationArgs(input: FrameworkReleaseLocalExecutorInput): string[] {
  return [
    '--operation', required(input.releaseOperation, 'operation'),
    '--operation-id', required(input.operationId, 'operation-id'),
    '--operation-started-at', required(input.operationStartedAt, 'operation-started-at'),
    '--operation-deadline-at', required(input.operationDeadlineAt, 'operation-deadline-at'),
  ];
}

function failure(kind: FailureKind, message: string, next: string, details: JsonRecord = {}): AdapterFailure {
  return Object.assign(new Error(message), {
    name: 'AdapterFailure', failureKind: kind, requiredNextAction: next, details,
  });
}

function isAdapterFailure(error: unknown): error is AdapterFailure {
  return error instanceof Error && 'failureKind' in error && 'requiredNextAction' in error && 'details' in error;
}

function required(value: string | undefined, flag: string): string {
  if (!value?.trim()) throw failure('admission_required', `Missing --${flag}.`, 'supply_required_input');
  return value.trim();
}

function optionalArg(argv: string[], flag: string, value: string | undefined): void {
  if (value?.trim()) argv.push(flag, value.trim());
}

function canonicalDigest(value: string, kind: 'admission_required' | 'framework_result_invalid', details: JsonRecord = {}): string {
  if (!digestPattern.test(value)) {
    throw failure(kind, 'Release Bundle identity must be a canonical sha256 digest.', 'correct_bundle_identity', details);
  }
  return value;
}

function assertBundleAllowed(bundle: string, operation: FrameworkReleaseOperation, details: JsonRecord = {}): void {
  if (bundle !== rejectedBundle) return;
  throw failure(
    'permanently_rejected_bundle',
    `Release Bundle ${bundle} is permanently rejected and cannot be reused by ${operation}.`,
    'freeze_new_bundle_from_current_authority',
    {
      ...details,
      authority_ref: 'docs/delivery/release/incidents/2026-07-20-v26.7.20-full-catalog-mismatch.json',
      reason: 'permanently_rejected_catalog_package_ref_mismatch',
    },
  );
}

export function buildFrameworkReleaseArgv(input: FrameworkReleaseLocalExecutorInput): string[] {
  if (input.track && input.operation !== 'verify') {
    throw failure('admission_required', '--track is only valid for Framework verify.', 'use_framework_command_contract');
  }
  const argv = ['release', ...operationSpecs[input.operation].command];
  switch (input.operation) {
    case 'freeze':
      argv.push('--request', required(input.requestPath, 'request'));
      optionalArg(argv, '--source-root', input.sourceRoot);
      break;
    case 'operation-admit':
      argv.push('--bundle', required(input.bundleDigest, 'bundle'), ...operationArgs(input));
      break;
    case 'build':
    case 'publish':
    case 'reconcile':
      argv.push('--bundle', required(input.bundleDigest, 'bundle'), '--executor-receipt', required(input.executorReceiptPath, 'executor-receipt'));
      argv.push(...operationArgs(input));
      break;
    case 'verify':
      argv.push('--bundle', required(input.bundleDigest, 'bundle'), '--qualification-receipt', required(input.qualificationReceiptPath, 'qualification-receipt'));
      argv.push(...operationArgs(input));
      optionalArg(argv, '--track', input.track);
      break;
    case 'checkpoint-export':
      argv.push('--bundle', required(input.bundleDigest, 'bundle'), '--output', required(input.checkpointOutput, 'output'));
      break;
    case 'checkpoint-import':
      argv.push('--checkpoint', required(input.checkpointPath, 'checkpoint'));
      break;
    case 'status':
      argv.push('--bundle', required(input.bundleDigest, 'bundle'));
      break;
  }
  optionalArg(argv, '--store', input.storeRoot);
  return [...argv, '--json'];
}

function assertAdmission(input: FrameworkReleaseLocalExecutorInput): void {
  if (!runAttemptOneOperations.has(input.operation)) return;
  const env = { ...process.env, ...input.env };
  const attempt = input.runAttempt ?? env.GITHUB_RUN_ATTEMPT;
  if ((env.GITHUB_ACTIONS === 'true' || attempt !== undefined) && attempt !== '1') {
    throw failure(
      attempt ? 'partial_rerun_rejected' : 'admission_required',
      attempt ? 'Release executor only accepts run attempt 1.' : 'GitHub release execution requires run attempt 1.',
      'start_new_admitted_operation', { run_attempt: attempt ?? null },
    );
  }
}

function fileDigest(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function opaqueFile(filePath: string): TransportProvenance['source_build_receipts'][number] {
  const resolved = path.resolve(filePath);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(resolved);
  } catch (error) {
    throw failure('transport_invalid', `Transport sidecar is unavailable: ${resolved}.`, 'restore_exact_transport_bytes', {
      path: resolved, cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw failure('transport_invalid', `Transport sidecar is not a regular file: ${resolved}.`, 'restore_exact_transport_bytes');
  }
  return { path: resolved, size_bytes: stat.size, sha256: fileDigest(resolved) };
}

function transportProvenance(input: FrameworkReleaseLocalExecutorInput): TransportProvenance {
  const executor = input.checkpointTransportExecutor;
  const runId = input.transportRunId?.trim();
  if ((executor && !runId) || (!executor && runId)) {
    throw failure('transport_invalid', 'Checkpoint transport executor and run id must be supplied together.', 'supply_checkpoint_transport_identity');
  }
  if (executor === 'github_actions' && !/^[1-9][0-9]*$/.test(runId ?? '')) {
    throw failure('transport_invalid', 'GitHub checkpoint transport run id must be numeric.', 'supply_checkpoint_transport_identity');
  }
  const env = { ...process.env, ...input.env };
  if (executor === 'github_actions' && env.GITHUB_ACTIONS === 'true' && env.GITHUB_RUN_ID && env.GITHUB_RUN_ID !== runId) {
    throw failure('transport_invalid', 'Checkpoint transport run id does not match GITHUB_RUN_ID.', 'use_current_admitted_run');
  }
  const paths = [...new Set((input.sourceBuildReceiptPaths ?? []).map((entry) => path.resolve(entry)))];
  return {
    checkpoint_transport_executor: executor ?? null,
    transport_run_id: runId ?? null,
    source_build_receipts: paths.map(opaqueFile),
  };
}

function record(value: unknown, label: string, details: JsonRecord): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw failure('framework_result_invalid', `${label} must be an object.`, 'inspect_framework_cli_contract', details);
  }
  return value as JsonRecord;
}

export function runFrameworkReleaseLocalExecutor(input: FrameworkReleaseLocalExecutorInput) {
  const expected = input.bundleDigest ? canonicalDigest(input.bundleDigest, 'admission_required') : undefined;
  if (expected) assertBundleAllowed(expected, input.operation);
  assertAdmission(input);
  const provenance = transportProvenance(input);
  const argv = buildFrameworkReleaseArgv(input);
  const child = spawnSync(path.resolve(required(input.oplPath, 'opl')), argv, {
    encoding: 'utf8',
    env: { ...process.env, ...input.env, NODE_NO_WARNINGS: '1', OPL_SKIP_SKILL_SYNC: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = child.stdout ?? '';
  const stderr = child.stderr ?? '';
  const evidence = {
    argv, exit_code: child.status, signal: child.signal, stdout, stderr,
    spawn_error: child.error?.message ?? null,
  };
  if (child.error || child.status !== 0) {
    throw failure('framework_cli_failed', `Framework opl release ${input.operation} failed.`, 'inspect_framework_failure_without_redispatch_or_rerun', evidence);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw failure('framework_result_invalid', 'Framework opl did not return one JSON document.', 'inspect_framework_cli_contract', {
      ...evidence, cause: error instanceof Error ? error.message : String(error),
    });
  }
  const frameworkResult = record(parsed, 'Framework result', evidence);
  if (frameworkResult.version !== 'g2') {
    throw failure('framework_result_invalid', 'Framework result version is not g2.', 'use_admitted_framework_abi', evidence);
  }
  const resultKey = operationSpecs[input.operation].resultKey;
  const operationResult = record(frameworkResult[resultKey], `Framework result.${resultKey}`, evidence);
  const observed = canonicalDigest(
    typeof operationResult.bundle_digest === 'string' ? operationResult.bundle_digest : '',
    'framework_result_invalid', evidence,
  );
  if (expected && observed !== expected) {
    throw failure('framework_result_invalid', 'Framework result belongs to another Release Bundle.', 'inspect_framework_cli_contract', evidence);
  }
  assertBundleAllowed(observed, input.operation, evidence);
  return {
    surface_kind: 'opl_app_framework_release_cli_adapter_result.v1' as const,
    operation: input.operation,
    bundle_digest: observed,
    framework_result: frameworkResult,
    framework_operation_result: operationResult,
    transport_provenance: provenance,
  };
}

function operationFromPositionals(positionals: string[]): FrameworkReleaseOperation {
  const checkpoint = positionals[0] === 'checkpoint';
  const candidate = checkpoint ? `checkpoint-${positionals[1] ?? ''}` : positionals[0];
  if (positionals.length === (checkpoint ? 2 : 1) && candidate && candidate in operationSpecs) {
    return candidate as FrameworkReleaseOperation;
  }
  throw failure('admission_required', 'Unknown or malformed local executor operation.', 'use_documented_operation');
}

function enumOption<T extends string>(value: string | undefined, allowed: readonly T[], flag: string): T | undefined {
  if (value === undefined || allowed.includes(value as T)) return value as T | undefined;
  throw failure('admission_required', `--${flag} has an unsupported value.`, 'correct_input_and_retry');
}

const optionNames = [
  'opl', 'request', 'source-root', 'store', 'bundle', 'executor-receipt', 'qualification-receipt',
  'track', 'checkpoint', 'output', 'checkpoint-transport-executor', 'transport-run-id',
  'release-operation', 'operation-id', 'operation-started-at', 'operation-deadline-at', 'run-attempt',
  'result-output', 'failure-output',
];
const cliOptions = Object.fromEntries(optionNames.map((name) => [name, { type: 'string' as const }]));
cliOptions['source-build-receipt'] = { type: 'string', multiple: true };
type CliValues = Record<string, string | undefined> & { 'source-build-receipt'?: string[] };

function inputEvidence(argv: string[]) {
  const fileFlags = new Set(['--request', '--executor-receipt', '--qualification-receipt', '--checkpoint', '--source-build-receipt']);
  const files: JsonRecord[] = [];
  for (let index = 0; index < argv.length - 1; index += 1) {
    if (!fileFlags.has(argv[index])) continue;
    const candidate = path.resolve(argv[index + 1]);
    try {
      const stat = fs.lstatSync(candidate);
      const regular = stat.isFile() && !stat.isSymbolicLink();
      files.push({ flag: argv[index], path: candidate, regular_file: regular, size_bytes: stat.isFile() ? stat.size : null, sha256: regular ? fileDigest(candidate) : null });
    } catch {
      files.push({ flag: argv[index], path: candidate, regular_file: false, size_bytes: null, sha256: null });
    }
  }
  const evidence = {
    argv, files,
    github_run_id: process.env.GITHUB_RUN_ID ?? null,
    github_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  };
  return { evidence, digest: `sha256:${crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex')}` };
}

function failureDocument(error: unknown, operation: FrameworkReleaseOperation | null, bundle: string | null, input: ReturnType<typeof inputEvidence>) {
  const typed = isAdapterFailure(error)
    ? error
    : failure('admission_required', error instanceof Error ? error.message : String(error), 'correct_input_and_retry');
  const { stdout = '', stderr = '', ...details } = typed.details;
  return {
    surface_kind: 'opl_app_framework_release_cli_adapter_failure.v1' as const,
    failure_kind: typed.failureKind,
    operation,
    bundle_digest: bundle,
    required_next_action: typed.requiredNextAction,
    rebuild_performed: false as const,
    input_digest: input.digest,
    stdout: typeof stdout === 'string' ? stdout : '',
    stderr: typeof stderr === 'string' ? stderr : '',
    message: typed.message,
    details: { ...details, input_evidence: input.evidence },
  };
}

function writeJson(filePath: string, value: unknown): void {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function rawOption(argv: string[], flag: string): string | undefined {
  const index = argv.lastIndexOf(flag);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : undefined;
}

function writeFailure(filePath: string, value: ReturnType<typeof failureDocument>): void {
  writeJson(filePath, value);
  const base = path.resolve(filePath.endsWith('.json') ? filePath.slice(0, -5) : filePath);
  fs.writeFileSync(`${base}.stdout.log`, value.stdout);
  fs.writeFileSync(`${base}.stderr.log`, value.stderr);
}

function main(argv: string[]): void {
  let operation: FrameworkReleaseOperation | null = null;
  let bundle = rawOption(argv, '--bundle') ?? null;
  let failureOutput = rawOption(argv, '--failure-output')
    ?? path.join(process.env.RUNNER_TEMP ?? process.env.TMPDIR ?? '/tmp', 'opl-release-failure-evidence', `framework-release-${process.pid}.json`);
  const evidence = inputEvidence(argv);
  try {
    const parsed = parseArgs({ args: argv, allowPositionals: true, strict: true, options: cliOptions });
    const values = parsed.values as CliValues;
    operation = operationFromPositionals(parsed.positionals);
    bundle = values.bundle ?? null;
    failureOutput = values['failure-output'] ?? failureOutput;
    const result = runFrameworkReleaseLocalExecutor({
      operation,
      oplPath: values.opl,
      requestPath: values.request,
      sourceRoot: values['source-root'],
      storeRoot: values.store,
      bundleDigest: values.bundle,
      executorReceiptPath: values['executor-receipt'],
      qualificationReceiptPath: values['qualification-receipt'],
      track: enumOption(values.track, ['standard', 'full'], 'track'),
      checkpointPath: values.checkpoint,
      checkpointOutput: values.output,
      sourceBuildReceiptPaths: values['source-build-receipt'],
      checkpointTransportExecutor: enumOption(values['checkpoint-transport-executor'], ['local', 'github_actions'], 'checkpoint-transport-executor'),
      transportRunId: values['transport-run-id'],
      releaseOperation: enumOption(values['release-operation'], ['standard', 'resume_standard', 'append_full'], 'release-operation'),
      operationId: values['operation-id'],
      operationStartedAt: values['operation-started-at'],
      operationDeadlineAt: values['operation-deadline-at'],
      runAttempt: values['run-attempt'],
    });
    if (values['result-output']) writeJson(values['result-output'], result);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const typed = failureDocument(error, operation, bundle, evidence);
    writeFailure(failureOutput, typed);
    process.stderr.write(`${JSON.stringify(typed)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
