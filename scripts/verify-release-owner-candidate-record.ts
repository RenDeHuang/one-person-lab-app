#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fileSha256, findFileByName } from './release-file-helpers.ts';
import { asRecord, readJsonFile } from './release-json-helpers.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Options = {
  version: string;
  ownerRecordPath: string;
  artifactsDir: string;
  outputDir: string;
  releaseMode: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
};

function parseBoolean(value: string | undefined, fallback = false) {
  if (value === undefined || value === '') return fallback;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new Error(`Boolean value must be true or false, got ${value}`);
}

function requiredOptionValue(argv: string[], index: number, token: string) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
  return value;
}

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    version: process.env.OPL_RELEASE_VERSION || '',
    ownerRecordPath: process.env.OPL_RELEASE_OWNER_RECORD || '',
    artifactsDir: process.env.OPL_RELEASE_ARTIFACTS_DIR || '',
    outputDir: process.env.OPL_RELEASE_OWNER_VALIDATION_DIR || '',
    releaseMode: process.env.OPL_RELEASE_MODE || 'refresh_existing',
    includeFullPackage: parseBoolean(process.env.OPL_INCLUDE_FULL_PACKAGE, true),
    runVmSmoke: parseBoolean(process.env.OPL_RUN_VM_SMOKE, true),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--version') parsed.version = requiredOptionValue(argv, index, token);
    else if (token === '--owner-record') parsed.ownerRecordPath = requiredOptionValue(argv, index, token);
    else if (token === '--artifacts-dir') parsed.artifactsDir = requiredOptionValue(argv, index, token);
    else if (token === '--output-dir') parsed.outputDir = requiredOptionValue(argv, index, token);
    else if (token === '--release-mode') parsed.releaseMode = requiredOptionValue(argv, index, token);
    else if (token === '--include-full-package') {
      parsed.includeFullPackage = parseBoolean(requiredOptionValue(argv, index, token));
    } else if (token === '--run-vm-smoke') {
      parsed.runVmSmoke = parseBoolean(requiredOptionValue(argv, index, token));
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
    index += 1;
  }

  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.ownerRecordPath.trim()) {
    parsed.ownerRecordPath = path.join(
      appRoot,
      'docs',
      'release',
      'records',
      `v${parsed.version}-release-owner-receipt.json`,
    );
  }
  if (!parsed.artifactsDir.trim()) {
    parsed.artifactsDir = path.join(
      appRoot,
      'artifacts',
      'release-closeout',
      `v${parsed.version}`,
      'artifacts',
    );
  }
  if (!parsed.outputDir.trim()) {
    parsed.outputDir = path.join(appRoot, 'artifacts', 'release-owner-validation', `v${parsed.version}`);
  }

  return {
    ...parsed,
    ownerRecordPath: path.resolve(parsed.ownerRecordPath),
    artifactsDir: path.resolve(parsed.artifactsDir),
    outputDir: path.resolve(parsed.outputDir),
  };
}

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanFalse(record: Record<string, unknown>, key: string) {
  return record[key] === false;
}

function validateOwnerRecord(ownerRecord: Record<string, unknown>, options: Options) {
  if (ownerRecord.schema !== 'opl_app_release_owner_receipt_record.v1') {
    throw new Error(`Owner record schema is ${String(ownerRecord.schema)}`);
  }
  if (ownerRecord.scope !== 'same_cohort_app_release_user_path_owner_verdict') {
    throw new Error(`Owner record scope is ${String(ownerRecord.scope)}`);
  }
  if (ownerRecord.status !== 'release_owner_receipt_recorded') {
    throw new Error(`Owner record status is ${String(ownerRecord.status)}`);
  }
  if (ownerRecord.version !== options.version || ownerRecord.tag !== `v${options.version}`) {
    throw new Error(`Owner record version/tag do not match ${options.version}`);
  }
  const releaseOwnerReceiptRef = stringValue(ownerRecord, 'release_owner_receipt_ref');
  if (!releaseOwnerReceiptRef) throw new Error('Owner record is missing release_owner_receipt_ref');
  for (const claimKey of [
    'release_ready_claim',
    'stable_latest_promotion_claim',
    'family_production_ready_claim',
  ]) {
    if (!booleanFalse(ownerRecord, claimKey)) throw new Error(`Owner record ${claimKey} must be false`);
  }
  const authorityBoundary = asRecord(ownerRecord.authority_boundary, 'owner_record.authority_boundary');
  for (const key of [
    'can_claim_app_release_ready_from_evidence',
    'can_claim_stable_latest_from_evidence',
    'can_claim_family_production_ready',
  ]) {
    if (authorityBoundary[key] !== false) throw new Error(`Owner record authority_boundary.${key} must be false`);
  }
  return {
    releaseOwnerReceiptRef,
    sourceRunId: stringValue(asRecord(ownerRecord.source_artifact_readback, 'source_artifact_readback'), 'source_run_id'),
    appCommit: stringValue(asRecord(ownerRecord.source_artifact_readback, 'source_artifact_readback'), 'app_commit'),
    authorityBoundary,
  };
}

function requiredArtifactPath(root: string, fileName: string) {
  const found = findFileByName(root, fileName);
  if (!found) throw new Error(`Missing ${fileName} under ${root}`);
  return found;
}

function runNodeScript(args: string[]) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${args[0]} failed:\n${result.stdout}\n${result.stderr}`.trim());
  }
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

try {
  const options = parseArgs(process.argv.slice(2));
  const ownerRecord = asRecord(readJsonFile(options.ownerRecordPath), 'owner_record');
  const owner = validateOwnerRecord(ownerRecord, options);
  const preflightPath = requiredArtifactPath(options.artifactsDir, 'release-preflight-summary.json');
  const readinessPath = requiredArtifactPath(options.artifactsDir, 'release-readiness-summary.json');
  const remotePath = requiredArtifactPath(options.artifactsDir, 'remote-release-verification.json');
  fs.mkdirSync(options.outputDir, { recursive: true });

  const candidateRecordPath = path.join(options.outputDir, 'release-candidate-record.json');
  const candidateMarkdownPath = path.join(options.outputDir, 'release-candidate-record.md');
  runNodeScript([
    'scripts/write-release-candidate-record.ts',
    '--version',
    options.version,
    '--release-mode',
    options.releaseMode,
    '--include-full-package',
    String(options.includeFullPackage),
    '--run-vm-smoke',
    String(options.runVmSmoke),
    '--app-commit',
    owner.appCommit ?? '',
    '--workflow-run-id',
    owner.sourceRunId ?? 'local',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--release-owner-receipt-ref',
    owner.releaseOwnerReceiptRef,
    '--output',
    candidateRecordPath,
    '--markdown',
    candidateMarkdownPath,
  ]);
  const validator = runNodeScript([
    'scripts/validate-release-candidate-record.ts',
    '--promote-ready',
    '--version',
    options.version,
    '--record',
    candidateRecordPath,
    '--format',
    'json',
  ]);

  const summary = {
    schema: 'opl_release_owner_candidate_record_verification.v1',
    status: validator.promote_ready === true ? 'verified' : 'blocked',
    version: options.version,
    source_run_id: owner.sourceRunId,
    owner_record: options.ownerRecordPath,
    artifacts_dir: options.artifactsDir,
    output_candidate_record: candidateRecordPath,
    output_candidate_record_sha256: fileSha256(candidateRecordPath),
    output_markdown: candidateMarkdownPath,
    inputs: {
      preflight: preflightPath,
      readiness: readinessPath,
      remote_verification: remotePath,
    },
    validator,
    authority_boundary: {
      ...owner.authorityBoundary,
      verification_can_publish_release: false,
      verification_can_claim_app_release_ready: false,
      verification_can_claim_family_production_ready: false,
      verification_can_write_runtime_truth: false,
      verification_can_write_domain_truth: false,
    },
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status !== 'verified') process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
