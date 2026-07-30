#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

type JsonRecord = Record<string, any>;
export type OptionalCertificationStatus = 'passed' | 'failed' | 'not_run' | 'unavailable';

export type OptionalCertificationExpectation = {
  releaseTag: string;
  artifactName: string;
  artifactDigest: string;
  componentManifestDigest: string;
  appSha: string;
  shellSha: string;
  frameworkSha: string;
  sourceRunId: string;
  installerName?: string;
  installerDigest?: string;
};

const digestPattern = /^sha256:[0-9a-f]{64}$/;
const shaPattern = /^[0-9a-f]{40}$/;
const runIdPattern = /^[1-9][0-9]*$/;
export const optionalCertificationUnavailableReasons = new Set([
  'authority_or_capability_not_provable',
  'fleet_lease_admission_failed',
  'vm_admission_failed',
  'capability_admission_failed',
]);
export const optionalCertificationNotRunReasons = new Set([
  'not_requested',
  'not_authorized',
  'operator_deferred',
]);

function receiptDigest(receipt: JsonRecord): string {
  const core = Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receipt_digest'));
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex')}`;
}

function readJson(filePath: string): JsonRecord {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`Expected a non-empty regular JSON receipt: ${resolved}`);
  }
  const value = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected one JSON receipt object: ${resolved}`);
  }
  return value as JsonRecord;
}

export function validateOptionalCertificationReceipt(
  value: unknown,
  expected: OptionalCertificationExpectation,
): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['optional certification receipt is missing or malformed'];
  }
  const receipt = value as JsonRecord;
  const errors: string[] = [];
  if (receipt.schema !== 'opl_app_optional_certification_receipt.v1') errors.push('receipt schema is invalid');
  if (!['passed', 'failed', 'not_run', 'unavailable'].includes(receipt.status)) {
    errors.push('receipt status must be passed, failed, not_run, or unavailable');
  }
  if (receipt.required_for_publication !== false) errors.push('optional certification must not authorize publication');
  if (!['macos', 'linux', 'windows'].includes(receipt.certification?.platform)) {
    errors.push('certification platform is invalid');
  }
  if (
    receipt.certification?.platform === 'linux'
    && (
      expected.installerName !== 'opl-app-installer.sh'
      || !expected.installerDigest
      || !digestPattern.test(expected.installerDigest)
      || receipt.artifact_handling?.installer?.name !== 'opl-app-installer.sh'
      || !['passed', 'failed'].includes(receipt.status)
      || receipt.certification?.kind !== 'clean_machine_install'
      || receipt.certification?.capability !== 'github-hosted-ubuntu-x64'
      || receipt.admission?.status !== 'passed'
      || receipt.admission?.reason_code !== null
      || receipt.artifact_handling?.installer?.digest !== expected.installerDigest
      || typeof receipt.artifact_handling?.installer?.downloaded_from_published_release !== 'boolean'
      || (
        receipt.status === 'passed'
        && receipt.artifact_handling.installer.downloaded_from_published_release !== true
      )
    )
  ) {
    errors.push('hosted Linux certification requires a passed typed admission and an executed passed or failed install');
  }
  if (receipt.release?.tag !== expected.releaseTag) errors.push('release tag does not match');
  if (receipt.release?.artifact?.name !== expected.artifactName) errors.push('artifact name does not match');
  if (receipt.release?.artifact?.digest !== expected.artifactDigest) errors.push('artifact digest does not match');
  if (receipt.release?.component_manifest_digest !== expected.componentManifestDigest) {
    errors.push('component manifest digest does not match');
  }
  for (const [field, expectedSha] of [
    ['app_sha', expected.appSha],
    ['shell_sha', expected.shellSha],
    ['framework_sha', expected.frameworkSha],
  ] as const) {
    if (receipt.release?.cohort?.[field] !== expectedSha) errors.push(`cohort ${field} does not match`);
  }
  if (receipt.run?.source_run_id !== expected.sourceRunId) errors.push('source run id does not match');
  if (receipt.run?.source_run_attempt !== 1) errors.push('source run attempt must be one');
  if (receipt.artifact_handling?.rebuilt !== false) errors.push('certification must never rebuild the artifact');
  if (receipt.artifact_handling?.component_manifest_mutated !== false) {
    errors.push('certification must not mutate the component manifest');
  }
  if (receipt.artifact_handling?.component_manifest_resigned !== false) {
    errors.push('certification must not resign the component manifest');
  }
  if (!digestPattern.test(String(receipt.admission?.evidence_digest ?? ''))) {
    errors.push('admission evidence digest is invalid');
  }
  if (receipt.result?.terminal !== true) errors.push('certification result must be terminal');
  if (
    !Array.isArray(receipt.result?.evidence_digests)
    || receipt.result.evidence_digests.some((digest: unknown) => !digestPattern.test(String(digest)))
  ) {
    errors.push('result evidence digests are invalid');
  }
  if (receipt.status === 'not_run') {
    if (
      receipt.run?.certification_run_id !== null
      || receipt.run?.certification_run_attempt !== null
      || receipt.run?.job_started !== false
    ) {
      errors.push('not_run requires no certification run and job_started false');
    }
    if (receipt.artifact_handling?.downloaded_from_published_release !== false) {
      errors.push('not_run must not claim a published artifact download');
    }
    if (
      receipt.admission?.status !== 'not_started'
      || !optionalCertificationNotRunReasons.has(receipt.admission?.reason_code)
    ) {
      errors.push('not_run requires a typed non-execution reason');
    }
    if ((receipt.result?.evidence_digests?.length ?? 0) !== 0) {
      errors.push('not_run must not claim certification execution evidence');
    }
  } else {
    if (
      !runIdPattern.test(String(receipt.run?.certification_run_id ?? ''))
      || receipt.run?.certification_run_attempt !== 1
      || receipt.run?.job_started !== true
    ) {
      errors.push('executed or admitted certification requires one started run attempt');
    }
    const downloadedFromPublishedRelease = receipt.artifact_handling?.downloaded_from_published_release;
    if (typeof downloadedFromPublishedRelease !== 'boolean') {
      errors.push('started certification must record whether the published artifact was downloaded');
    } else if (
      (receipt.status === 'passed' || receipt.certification?.platform !== 'linux')
      && downloadedFromPublishedRelease !== true
    ) {
      errors.push('passed certification and non-Linux execution must download the published artifact');
    }
  }
  if (receipt.status === 'unavailable') {
    if (
      receipt.admission?.status !== 'failed'
      || !optionalCertificationUnavailableReasons.has(receipt.admission?.reason_code)
    ) {
      errors.push('unavailable requires a started-job admission failure with an allowed reason');
    }
    if ((receipt.result?.evidence_digests?.length ?? 0) !== 0) {
      errors.push('unavailable must not claim certification execution evidence');
    }
  } else if (receipt.status === 'passed' || receipt.status === 'failed') {
    if (receipt.admission?.status !== 'passed' || receipt.admission?.reason_code !== null) {
      errors.push('passed or failed certification requires passed admission');
    }
    if ((receipt.result?.evidence_digests?.length ?? 0) < 1) {
      errors.push('executed certification requires terminal evidence');
    }
  }
  const forbiddenReason = String(receipt.admission?.reason_code ?? '');
  if (/runner[_ -]?offline|queued|github[_ -]?auth|network/i.test(forbiddenReason)) {
    errors.push('queued, runner inventory, authentication, or network state cannot prove unavailable');
  }
  if (!Number.isFinite(Date.parse(String(receipt.created_at)))) errors.push('created_at is invalid');
  if (receipt.receipt_digest !== receiptDigest(receipt)) errors.push('receipt self digest does not match');
  if (!digestPattern.test(expected.artifactDigest) || !digestPattern.test(expected.componentManifestDigest)) {
    errors.push('expected artifact or component manifest digest is invalid');
  }
  for (const sha of [expected.appSha, expected.shellSha, expected.frameworkSha]) {
    if (!shaPattern.test(sha)) errors.push('expected cohort SHA is invalid');
  }
  if (!runIdPattern.test(expected.sourceRunId)) errors.push('expected source run id is invalid');
  return errors;
}

export function projectOptionalCertificationStatus(
  receipt: unknown | null | undefined,
  expected: OptionalCertificationExpectation,
): OptionalCertificationStatus {
  if (receipt === null || receipt === undefined) return 'not_run';
  const errors = validateOptionalCertificationReceipt(receipt, expected);
  if (errors.length > 0) throw new Error(errors.join('; '));
  return (receipt as JsonRecord).status;
}

function required(value: string | undefined, flag: string): string {
  if (!value?.trim()) throw new Error(`Missing --${flag}.`);
  return value.trim();
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      receipt: { type: 'string' },
      'release-tag': { type: 'string' },
      'artifact-name': { type: 'string' },
      'artifact-digest': { type: 'string' },
      'component-manifest-digest': { type: 'string' },
      'app-sha': { type: 'string' },
      'shell-sha': { type: 'string' },
      'framework-sha': { type: 'string' },
      'source-run-id': { type: 'string' },
      'installer-name': { type: 'string' },
      'installer-digest': { type: 'string' },
    },
  });
  const receipt = readJson(required(values.receipt, 'receipt'));
  const linuxReceipt = receipt.certification?.platform === 'linux';
  const errors = validateOptionalCertificationReceipt(receipt, {
    releaseTag: required(values['release-tag'], 'release-tag'),
    artifactName: required(values['artifact-name'], 'artifact-name'),
    artifactDigest: required(values['artifact-digest'], 'artifact-digest'),
    componentManifestDigest: required(values['component-manifest-digest'], 'component-manifest-digest'),
    appSha: required(values['app-sha'], 'app-sha'),
    shellSha: required(values['shell-sha'], 'shell-sha'),
    frameworkSha: required(values['framework-sha'], 'framework-sha'),
    sourceRunId: required(values['source-run-id'], 'source-run-id'),
    installerName: linuxReceipt
      ? required(values['installer-name'], 'installer-name')
      : values['installer-name']?.trim() || undefined,
    installerDigest: linuxReceipt
      ? required(values['installer-digest'], 'installer-digest')
      : values['installer-digest']?.trim() || undefined,
  });
  if (errors.length > 0) throw new Error(errors.join('; '));
  process.stdout.write(`${JSON.stringify({ status: 'valid', certification_status: receipt.status })}\n`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
