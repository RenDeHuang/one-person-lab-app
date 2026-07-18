import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildQualificationAttemptReceipt,
  writeQualificationAttemptReceiptAtomic,
} from '../../scripts/qualification-attempt-receipt.ts';

const frozenCodex = {
  package: '@openai/codex' as const,
  version: '0.144.5',
  npm_integrity: `sha512-${'A'.repeat(86)}==`,
  tarball_url: 'https://registry.npmjs.org/@openai/codex/-/codex-0.144.5.tgz',
  tarball_sha256: '6'.repeat(64),
  platform: {
    package: '@openai/codex' as const,
    version: '0.144.5-darwin-arm64',
    npm_integrity: `sha512-${'B'.repeat(86)}==`,
    tarball_url: 'https://registry.npmjs.org/@openai/codex/-/codex-0.144.5-darwin-arm64.tgz',
    tarball_sha256: '7'.repeat(64),
  },
};

test('attempt receipt survives missing manifest, scope, smoke summary, and strict receipt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-attempt-receipt-'));
  try {
    const receipt = buildQualificationAttemptReceipt({
      status: 'failed', failureTaxonomy: 'fixture', qualificationRunId: '123',
      manifestPath: path.join(root, 'missing-manifest.json'),
      strictQualificationReceiptPath: path.join(root, 'missing-strict.json'),
      smokeSummaryPath: path.join(root, 'missing-smoke.json'),
      scopeProofBase64: 'not-base64-json',
    });
    assert.equal(receipt.durable_failure_path, true);
    assert.equal(receipt.status, 'failed');
    assert.equal(receipt.failure_taxonomy, 'fixture');
    assert.equal(receipt.identity.qualification_run_id, '123');
    assert.equal(receipt.evidence.scope_proof, null);
    assert.equal(receipt.retry.disposition, 'new_cohort_required');
    assert.ok(receipt.errors.length >= 4);
    const output = path.join(root, 'nested', 'attempt.json');
    writeQualificationAttemptReceiptAtomic(output, receipt);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), receipt);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fixture retry requires the exact unchanged verifier cohort', () => {
  const proof = {
    classification: 'same_as_artifact_cohort',
    app: { base_sha: '1'.repeat(40), head_sha: '1'.repeat(40) },
    shell: { base_sha: '2'.repeat(40), head_sha: '2'.repeat(40) },
    expectations: { artifact_semantic_digest: '4'.repeat(64), verification_semantic_digest: '4'.repeat(64) },
    reuse_authorization: { forbidden_paths: { app: [], shell: [] } },
  };
  const receipt = buildQualificationAttemptReceipt({
    status: 'failed', failureTaxonomy: 'fixture',
    scopeProofBase64: Buffer.from(JSON.stringify(proof)).toString('base64'),
  });
  assert.equal(receipt.retry.disposition, 'same_artifact_retry_allowed');
  assert.equal(receipt.evidence.scope_proof?.shell_head_sha, '2'.repeat(40));
});

test('fixture failure with a changed Shell verifier requires a new cohort even when semantic digests match', () => {
  const proof = {
    classification: 'harness_mechanics_only',
    app: { base_sha: '1'.repeat(40), head_sha: '1'.repeat(40) },
    shell: { base_sha: '2'.repeat(40), head_sha: '3'.repeat(40) },
    expectations: { artifact_semantic_digest: '4'.repeat(64), verification_semantic_digest: '4'.repeat(64) },
    reuse_authorization: { forbidden_paths: { app: [], shell: ['scripts/opl-first-run-vm-smoke.mjs'] } },
  };
  const receipt = buildQualificationAttemptReceipt({
    status: 'failed', failureTaxonomy: 'fixture',
    scopeProofBase64: Buffer.from(JSON.stringify(proof)).toString('base64'),
  });
  assert.equal(receipt.retry.disposition, 'new_cohort_required');
});

test('success without a manifest is downgraded to incomplete', () => {
  const receipt = buildQualificationAttemptReceipt({
    status: 'passed', failureTaxonomy: 'none', manifestPath: '/definitely/missing/manifest.json',
  });
  assert.equal(receipt.status, 'incomplete');
  assert.equal(receipt.failure_taxonomy, 'unknown');
  assert.equal(receipt.retry.disposition, 'reconcile_only');
});

test('success without a strict qualification receipt is downgraded to incomplete', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-attempt-receipt-missing-strict-'));
  try {
    const manifestPath = path.join(root, 'manifest.json');
    const smokePath = path.join(root, 'smoke.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      release: { stable_session_id: `sha256:${'1'.repeat(64)}`, release_cohort_ref: `sha256:${'2'.repeat(64)}` },
      build: { kind: 'standard' }, artifact: { sha256: '3'.repeat(64) },
      actions: { run_id: '10', artifact_name: 'standard-dmg' },
      digests: {
        compiled_expectation_semantic_sha256: '4'.repeat(64), compiled_expectation_probe_sha256: '5'.repeat(64),
        qualification_input_manifest_sha256: '8'.repeat(64),
      },
      qualification_runtime: { codex_cli: frozenCodex },
    }));
    fs.writeFileSync(smokePath, '{}');
    const receipt = buildQualificationAttemptReceipt({
      status: 'passed', failureTaxonomy: 'none', manifestPath, smokeSummaryPath: smokePath,
      qualificationRunId: '11', sourceArtifactRunId: '10', sourceArtifactName: 'standard-dmg',
    });
    assert.equal(receipt.status, 'incomplete');
    assert.match(receipt.errors.join('; '), /strict qualification receipt/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('attempt receipt binds artifact and expectation digests when the manifest is valid', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-attempt-receipt-'));
  try {
    const manifestPath = path.join(root, 'manifest.json');
    const smokePath = path.join(root, 'smoke.json');
    const strictPath = path.join(root, 'strict.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      release: { stable_session_id: `sha256:${'1'.repeat(64)}`, release_cohort_ref: `sha256:${'2'.repeat(64)}` },
      build: { kind: 'standard' }, artifact: { sha256: '3'.repeat(64) },
      actions: { run_id: '10', artifact_name: 'standard-dmg' },
      digests: {
        compiled_expectation_semantic_sha256: '4'.repeat(64),
        compiled_expectation_probe_sha256: '5'.repeat(64),
        qualification_input_manifest_sha256: '8'.repeat(64),
      },
      qualification_runtime: { codex_cli: frozenCodex },
    }));
    fs.writeFileSync(smokePath, '{"status":"passed"}\n');
    const manifestSha = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
    const smokeSha = crypto.createHash('sha256').update(fs.readFileSync(smokePath)).digest('hex');
    fs.writeFileSync(strictPath, JSON.stringify({
      schema: 'opl_app_artifact_qualification_receipt.v1', status: 'passed',
      stable_session_id: `sha256:${'1'.repeat(64)}`, release_cohort_ref: `sha256:${'2'.repeat(64)}`,
      qualification: {
        run_id: '11', source_artifact_run_id: '10', source_artifact_name: 'standard-dmg', result: 'passed',
      },
      artifact: { sha256: '3'.repeat(64) },
      build_manifest: { sha256: manifestSha, qualification_input_manifest_sha256: '8'.repeat(64) },
      qualification_runtime: { codex_cli: frozenCodex }, smoke_summary: { sha256: smokeSha },
    }));
    const receipt = buildQualificationAttemptReceipt({
      status: 'passed', failureTaxonomy: 'none', manifestPath,
      strictQualificationReceiptPath: strictPath, smokeSummaryPath: smokePath,
      qualificationRunId: '11', qualificationRunAttempt: '1', sourceArtifactRunId: '10', sourceArtifactName: 'standard-dmg',
      scopeProofBase64: Buffer.from(JSON.stringify({
        classification: 'same_as_artifact_cohort',
        app: { base_sha: '1'.repeat(40), head_sha: '1'.repeat(40) },
        shell: { base_sha: '2'.repeat(40), head_sha: '2'.repeat(40) },
        expectations: {
          artifact_semantic_digest: '4'.repeat(64), verification_semantic_digest: '4'.repeat(64),
          artifact_probe_digest: '5'.repeat(64), verification_probe_digest: '5'.repeat(64),
        },
        reuse_authorization: { forbidden_paths: { app: [], shell: [] } },
      })).toString('base64'),
    });
    assert.equal(receipt.status, 'passed');
    assert.equal(receipt.expectations.semantic_digest, '4'.repeat(64));
    assert.equal(receipt.expectations.probe_digest, '5'.repeat(64));
    assert.equal(receipt.artifact.sha256, '3'.repeat(64));
    assert.equal(receipt.qualification_inputs.manifest_sha256, '8'.repeat(64));
    assert.equal(receipt.qualification_inputs.runtime?.codex_cli.version, '0.144.5');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
