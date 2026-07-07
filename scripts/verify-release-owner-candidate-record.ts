#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { fileSha256, findFileByName } from './release-file-helpers.ts';
import { asRecord, readJsonFile } from './release-json-helpers.ts';
import { parseStrictBoolean } from './release-readiness-args.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Options = {
  version: string;
  ownerRecordPath: string;
  artifactsDir: string;
  outputDir: string;
  releaseMode: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  requireDockerWebui: boolean;
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    version: process.env.OPL_RELEASE_VERSION || '',
    ownerRecordPath: process.env.OPL_RELEASE_OWNER_RECORD || '',
    artifactsDir: process.env.OPL_RELEASE_ARTIFACTS_DIR || '',
    outputDir: process.env.OPL_RELEASE_OWNER_VALIDATION_DIR || '',
    releaseMode: process.env.OPL_RELEASE_MODE || 'refresh_existing',
    includeFullPackage: parseStrictBoolean(process.env.OPL_INCLUDE_FULL_PACKAGE, true),
    runVmSmoke: parseStrictBoolean(process.env.OPL_RUN_VM_SMOKE, true),
    requireDockerWebui: parseStrictBoolean(process.env.OPL_REQUIRE_DOCKER_WEBUI, true),
  };

  const { values } = parseNodeArgs({
    args: argv,
    options: {
      version: { type: 'string' },
      'owner-record': { type: 'string' },
      'artifacts-dir': { type: 'string' },
      'output-dir': { type: 'string' },
      'release-mode': { type: 'string' },
      'include-full-package': { type: 'string' },
      'run-vm-smoke': { type: 'string' },
      'require-docker-webui': { type: 'string' },
    },
  });
  parsed.version = values.version ?? parsed.version;
  parsed.ownerRecordPath = values['owner-record'] ?? parsed.ownerRecordPath;
  parsed.artifactsDir = values['artifacts-dir'] ?? parsed.artifactsDir;
  parsed.outputDir = values['output-dir'] ?? parsed.outputDir;
  parsed.releaseMode = values['release-mode'] ?? parsed.releaseMode;
  if (values['include-full-package'] !== undefined) {
    parsed.includeFullPackage = parseStrictBoolean(values['include-full-package']);
  }
  if (values['run-vm-smoke'] !== undefined) {
    parsed.runVmSmoke = parseStrictBoolean(values['run-vm-smoke']);
  }
  if (values['require-docker-webui'] !== undefined) {
    parsed.requireDockerWebui = parseStrictBoolean(values['require-docker-webui']);
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

function optionalArtifactPath(root: string, fileName: string) {
  return findFileByName(root, fileName);
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
  const addonReadinessPath = optionalArtifactPath(options.artifactsDir, 'release-addon-readiness-summary.json');
  fs.mkdirSync(options.outputDir, { recursive: true });
  const addonReadiness = addonReadinessPath
    ? runNodeScript([
      'scripts/validate-release-addon-readiness.ts',
      '--version',
      options.version,
      '--record',
      addonReadinessPath,
      '--include-full-package',
      String(options.includeFullPackage),
      '--run-vm-smoke',
      String(options.runVmSmoke),
      '--require-docker-webui',
      String(options.requireDockerWebui),
    ])
    : null;
  if (!addonReadiness && (options.includeFullPackage || options.requireDockerWebui)) {
    throw new Error('Missing release-addon-readiness-summary.json under artifacts dir.');
  }

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
      addon_readiness: addonReadinessPath,
    },
    addon_readiness: addonReadiness,
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
