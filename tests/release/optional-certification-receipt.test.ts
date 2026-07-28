import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  projectOptionalCertificationStatus,
  validateOptionalCertificationReceipt,
  type OptionalCertificationExpectation,
  type OptionalCertificationStatus,
} from '../../scripts/validate-optional-certification-receipt.ts';
import { writeOptionalCertificationReceipt } from '../../scripts/write-optional-certification-receipt.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const digest = (character: string): string => `sha256:${character.repeat(64)}`;
const expected: OptionalCertificationExpectation = {
  releaseTag: 'v26.7.27-r1',
  artifactName: 'One-Person-Lab-26.7.27-r1-mac-arm64.dmg',
  artifactDigest: digest('a'),
  componentManifestDigest: digest('b'),
  appSha: '1'.repeat(40),
  shellSha: '2'.repeat(40),
  frameworkSha: '3'.repeat(40),
  sourceRunId: '30260000001',
};

function seal(receipt: Record<string, any>): Record<string, any> {
  const core = Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receipt_digest'));
  receipt.receipt_digest = `sha256:${crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex')}`;
  return receipt;
}

function receipt(status: OptionalCertificationStatus): Record<string, any> {
  const notRun = status === 'not_run';
  const unavailable = status === 'unavailable';
  return seal({
    schema: 'opl_app_optional_certification_receipt.v1',
    status,
    required_for_publication: false,
    release: {
      tag: expected.releaseTag,
      artifact: { name: expected.artifactName, digest: expected.artifactDigest },
      component_manifest_digest: expected.componentManifestDigest,
      cohort: {
        app_sha: expected.appSha,
        shell_sha: expected.shellSha,
        framework_sha: expected.frameworkSha,
      },
    },
    certification: {
      kind: 'clean_machine_install',
      platform: 'macos',
      capability: 'tart-clean-macos',
    },
    run: {
      source_run_id: expected.sourceRunId,
      source_run_attempt: 1,
      certification_run_id: notRun ? null : '30260000002',
      certification_run_attempt: notRun ? null : 1,
      job_started: !notRun,
    },
    artifact_handling: {
      downloaded_from_published_release: !notRun,
      rebuilt: false,
      component_manifest_mutated: false,
      component_manifest_resigned: false,
    },
    admission: {
      status: notRun ? 'not_started' : unavailable ? 'failed' : 'passed',
      reason_code: notRun
        ? 'operator_deferred'
        : unavailable
          ? 'fleet_lease_admission_failed'
          : null,
      evidence_digest: digest('c'),
    },
    result: {
      terminal: true,
      evidence_digests: status === 'passed' || status === 'failed' ? [digest('d')] : [],
    },
    created_at: '2026-07-27T12:00:00.000Z',
  });
}

test('optional certification contract exposes exactly four distinct canonical states', () => {
  const schema = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts/app-optional-certification-receipt.schema.json'), 'utf8'),
  );
  assert.deepEqual(schema.properties.status.enum, ['passed', 'failed', 'not_run', 'unavailable']);
  for (const status of ['passed', 'failed', 'not_run', 'unavailable'] as const) {
    const value = receipt(status);
    assert.deepEqual(validateOptionalCertificationReceipt(value, expected), []);
    assert.equal(projectOptionalCertificationStatus(value, expected), status);
  }
  assert.equal(projectOptionalCertificationStatus(null, expected), 'not_run');
});

test('not_run remains explicit non-execution and cannot masquerade as unavailable', () => {
  const value = receipt('not_run');
  value.admission.status = 'failed';
  value.admission.reason_code = 'fleet_lease_admission_failed';
  seal(value);
  assert.ok(
    validateOptionalCertificationReceipt(value, expected)
      .includes('not_run requires a typed non-execution reason'),
  );
});

test('unavailable requires a started typed admission failure and rejects offline, queue, auth, or network guesses', () => {
  for (const reason of ['runner_offline', 'queued_workflow', 'github_auth_failure', 'network_failure']) {
    const value = receipt('unavailable');
    value.admission.reason_code = reason;
    seal(value);
    const errors = validateOptionalCertificationReceipt(value, expected);
    assert.ok(errors.includes('unavailable requires a started-job admission failure with an allowed reason'));
    assert.ok(errors.includes('queued, runner inventory, authentication, or network state cannot prove unavailable'));
  }
});

test('certification is bound to the already-published artifact and may never rebuild or rewrite its manifest', () => {
  const value = receipt('passed');
  value.release.artifact.digest = digest('e');
  value.artifact_handling.rebuilt = true;
  value.artifact_handling.component_manifest_mutated = true;
  value.artifact_handling.component_manifest_resigned = true;
  seal(value);
  assert.deepEqual(validateOptionalCertificationReceipt(value, expected), [
    'artifact digest does not match',
    'certification must never rebuild the artifact',
    'certification must not mutate the component manifest',
    'certification must not resign the component manifest',
  ]);
});

test('receipt writer emits a self-validating not_run record without inventing a physical job', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-optional-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const admission = path.join(root, 'admission.json');
  fs.writeFileSync(admission, '{"status":"not_requested","physical_job_dispatched":false}\n');
  const value = writeOptionalCertificationReceipt({
    expected,
    status: 'not_run',
    certification: {
      kind: 'clean_machine_install',
      platform: 'macos',
      capability: 'tart-clean-macos',
    },
    admissionEvidencePath: admission,
    reasonCode: 'not_requested',
    certificationRunId: null,
    evidencePaths: [],
    createdAt: '2026-07-28T01:00:00.000Z',
  });
  assert.deepEqual(validateOptionalCertificationReceipt(value, expected), []);
  assert.equal(value.run.certification_run_id, null);
  assert.equal(value.run.job_started, false);
  assert.equal(value.artifact_handling.downloaded_from_published_release, false);
  assert.equal(value.admission.reason_code, 'not_requested');
  assert.deepEqual(value.result.evidence_digests, []);
});

test('receipt writer refuses to classify queue, runner, auth, or network state as unavailable', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-optional-certification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const admission = path.join(root, 'admission.json');
  fs.writeFileSync(admission, '{"status":"failed"}\n');
  assert.throws(
    () => writeOptionalCertificationReceipt({
      expected,
      status: 'unavailable',
      certification: {
        kind: 'clean_machine_install',
        platform: 'macos',
        capability: 'tart-clean-macos',
      },
      admissionEvidencePath: admission,
      reasonCode: 'runner_offline',
      certificationRunId: '30260000002',
      evidencePaths: [],
      createdAt: '2026-07-28T01:00:00.000Z',
    }),
    /typed admission failure/,
  );
});
