import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  createStableFailureFingerprint,
  foldStableStageResults,
  stableFailureFingerprintsEqual,
  stableStageAxes,
  stableStageIds,
  type StableStageAxisInput,
  type StableStageInput,
} from '../../scripts/stable-stage-result.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const cohort = {
  app_sha: '1'.repeat(40),
  shell_sha: '2'.repeat(40),
  framework_sha: '3'.repeat(40),
};
const inputDigest = `sha256:${'4'.repeat(64)}`;
const environmentDigest = `sha256:${'5'.repeat(64)}`;

function axis(
  status: StableStageAxisInput['status'] = 'passed',
  reasonCode?: string,
  extras: Partial<StableStageAxisInput> = {},
): StableStageAxisInput {
  return {
    status,
    reason_code: reasonCode,
    ...extras,
  };
}

function stage(
  stageIndex: number,
  overrides: Partial<StableStageInput> = {},
): StableStageInput {
  return {
    stage_id: stableStageIds[stageIndex]!,
    stage_index: stageIndex,
    cohort,
    artifact_digest_or_input_digest: inputDigest,
    environment_receipt_digest: environmentDigest,
    attempt: 1,
    axes: Object.fromEntries(stableStageAxes.map((entry) => [entry, axis()])) as StableStageInput['axes'],
    ...overrides,
  };
}

test('twelve passed stages fold into one non-authoritative terminal observation', () => {
  const result = foldStableStageResults(stableStageIds.map((_stageId, index) => stage(index)));

  assert.equal(result.status, 'passed');
  assert.equal(result.authority, 'attempt_observation_only_no_framework_state_projection');
  assert.equal(result.business_stage_count, 12);
  assert.equal(result.observed_stage_count, 12);
  assert.equal(result.primary_failure, null);
  assert.deepEqual(result.secondary_failures, []);
  assert.equal(result.failure_fingerprint, null);
});

test('lowest qualification/product stage is primary while other axes and later product failures stay secondary', () => {
  const evidenceFailure = stage(2);
  evidenceFailure.axes.evidence = axis('failed', 'evidence_receipt_missing');
  const firstProductFailure = stage(4);
  firstProductFailure.axes.qualification_product = axis('failed', 'signed_artifact_invalid');
  const laterProductFailure = stage(5);
  laterProductFailure.axes.qualification_product = axis('failed', 'clean_vm_launch_failed');
  const transportFailure = stage(1);
  transportFailure.axes.transport = axis('failed', 'artifact_download_failed');

  const result = foldStableStageResults([
    laterProductFailure,
    evidenceFailure,
    firstProductFailure,
    transportFailure,
  ]);

  assert.equal(result.status, 'failed');
  assert.equal(result.primary_failure?.stage_index, 4);
  assert.equal(result.primary_failure?.axis, 'qualification_product');
  assert.equal(result.primary_failure?.reason_code, 'signed_artifact_invalid');
  assert.deepEqual(
    result.secondary_failures.map((failure) => [
      failure.stage_index,
      failure.axis,
      failure.reason_code,
    ]),
    [
      [1, 'transport', 'artifact_download_failed'],
      [2, 'evidence', 'evidence_receipt_missing'],
      [5, 'qualification_product', 'clean_vm_launch_failed'],
    ],
  );
  assert.equal(result.failure_fingerprint?.digest, result.primary_failure?.fingerprint.digest);
});

test('a secondary-only failure still emits the deterministic circuit-breaker fingerprint', () => {
  const transportFailure = stage(1);
  transportFailure.axes.transport = axis('failed', 'artifact_download_failed');

  const result = foldStableStageResults([transportFailure]);

  assert.equal(result.primary_failure, null);
  assert.equal(result.secondary_failures.length, 1);
  assert.equal(
    result.failure_fingerprint?.digest,
    result.secondary_failures[0]?.fingerprint.digest,
  );
});

test('cleanup command anomaly plus final absent inspection is idempotent success and never primary', () => {
  const cleanup = stage(11);
  cleanup.axes.cleanup = axis('failed', 'vm_cleanup_stop_failure', {
    command_exit_code: 2,
    final_inspection: 'absent',
    evidence_ref: 'vm-final-inspection.json',
  });

  const result = foldStableStageResults([cleanup]);
  const normalized = result.stages[0]!.axes.cleanup;

  assert.equal(normalized.status, 'passed');
  assert.equal(normalized.reason_code, 'cleanup_idempotent_success');
  assert.deepEqual(normalized.command_anomaly, {
    exit_code: 2,
    reason_code: 'vm_cleanup_stop_failure',
  });
  assert.equal(result.status, 'incomplete');
  assert.equal(result.primary_failure, null);
  assert.deepEqual(result.secondary_failures, []);
  assert.equal(result.cleanup_command_anomalies.length, 1);
});

test('failure fingerprint binds exact cohort, stage, reason, artifact/input and environment only', () => {
  const fingerprint = createStableFailureFingerprint({
    cohort,
    stage_id: stableStageIds[5],
    reason_code: 'clean_vm_launch_failed',
    artifact_digest_or_input_digest: inputDigest,
    environment_receipt_digest: environmentDigest,
  });
  const same = structuredClone(fingerprint);
  const changed = createStableFailureFingerprint({
    ...fingerprint,
    environment_receipt_digest: `sha256:${'6'.repeat(64)}`,
  });

  assert.equal(stableFailureFingerprintsEqual(fingerprint, same), true);
  assert.equal(stableFailureFingerprintsEqual(fingerprint, changed), false);
  assert.match(fingerprint.digest, /^sha256:[0-9a-f]{64}$/);
});

test('stage fold rejects duplicate indexes, mismatched stage identity and cross-cohort attempts', () => {
  assert.throws(
    () => foldStableStageResults([stage(0), stage(0)]),
    /duplicate stage indexes/,
  );
  assert.throws(
    () => foldStableStageResults([stage(0, { stage_id: stableStageIds[1] })]),
    /does not match stage_index/,
  );
  assert.throws(
    () => foldStableStageResults([
      stage(0),
      stage(1, { cohort: { ...cohort, app_sha: 'f'.repeat(40) } }),
    ]),
    /one exact cohort and attempt/,
  );
});

test('stage result schema stays closed and enumerates the exact business stages and axes', () => {
  const schema = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts/app-stable-stage-result.schema.json'), 'utf8'),
  );

  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schema.const, 'opl_app_stable_stage_result.v1');
  assert.equal(schema.properties.authority.const, 'attempt_observation_only_no_framework_state_projection');
  assert.equal(schema.properties.business_stage_count.const, 12);
  assert.deepEqual(schema.$defs.stage_id.enum, stableStageIds);
  assert.deepEqual(schema.$defs.axis.enum, stableStageAxes);
  assert.equal(schema.$defs.stage.additionalProperties, false);
  assert.equal(schema.$defs.fingerprint.additionalProperties, false);
});
