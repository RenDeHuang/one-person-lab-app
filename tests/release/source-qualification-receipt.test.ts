import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import {
  buildSourceQualificationReceipt,
  sourceQualificationReceiptDigest,
  validateSourceQualificationReceipt,
  type SourceQualificationBuildInput,
} from '../../scripts/source-qualification-receipt.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const appSha = '1'.repeat(40);
const shellSha = '2'.repeat(40);
const frameworkSha = '3'.repeat(40);

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-source-preflight-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    preflight: path.join(root, 'source-contract-build-preflight.json'),
    cohort: path.join(root, 'source-preflight-cohort.json'),
  };
  writeJson(files.preflight, {
    schema: 'opl_source_contract_build_preflight.v1',
    status: 'passed',
    execution: 'github_hosted',
    reusable_workflow: '.github/workflows/_build-reusable.yml',
    checks: { source: 'passed', contract: 'passed', build: 'passed' },
    build_invocation_count: 1,
    formal_candidate_build_count: 0,
    self_hosted_invocation_count: 0,
    tart_vm_invocation_count: 0,
  });
  writeJson(files.cohort, {
    schema: 'opl_source_preflight_cohort.v1',
    cohort: {
      app: { sha: appSha, tree: '4'.repeat(40) },
      shell: { sha: shellSha, tree: '5'.repeat(40) },
      framework: { sha: frameworkSha, tree: '6'.repeat(40) },
    },
  });
  return files;
}

function input(files: ReturnType<typeof fixture>): SourceQualificationBuildInput {
  return {
    completedAt: '2026-07-27T01:00:00.000Z',
    operationScope: 'stable_operation_source_preflight',
    runId: '30230000001',
    runAttempt: 1,
    repository: 'gaofeng21cn/one-person-lab-app',
    workflow: '.github/workflows/release-source-qualification.yml',
    event: 'workflow_dispatch',
    ref: 'refs/heads/main',
    headSha: appSha,
    runnerLabels: ['ubuntu-latest'],
    cohort: {
      app: { sha: appSha, tree: '4'.repeat(40) },
      shell: { sha: shellSha, tree: '5'.repeat(40) },
      framework: { sha: frameworkSha, tree: '6'.repeat(40) },
    },
    preflightManifestPath: files.preflight,
    cohortManifestPath: files.cohort,
    workflowPaths: [
      '.github/workflows/release-source-qualification.yml',
      'contracts/app-source-qualification-receipt.schema.json',
      'scripts/source-qualification-receipt.ts',
      'scripts/validate-source-qualification-receipt.ts',
    ],
    appRoot,
  };
}

test('source preflight receipt binds one hosted diagnostic build and zero VM or formal builds', (t) => {
  const files = fixture(t);
  const receipt = buildSourceQualificationReceipt(input(files));
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.execution.execution_class, 'github_hosted');
  assert.deepEqual(receipt.execution.runner_labels, ['ubuntu-latest']);
  assert.equal(receipt.qualification.build_invocation_count, 1);
  assert.equal(receipt.qualification.formal_candidate_build_count, 0);
  assert.equal(receipt.qualification.self_hosted_invocation_count, 0);
  assert.equal(receipt.qualification.tart_vm_invocation_count, 0);
  assert.equal(receipt.artifact.formal_candidate, false);
  const { receipt_digest: digest, ...core } = receipt;
  assert.equal(digest, sourceQualificationReceiptDigest(core));
  assert.equal(
    validateSourceQualificationReceipt(receipt, {
      digest,
      runId: '30230000001',
      headSha: appSha,
    }),
    receipt,
  );
});

test('source preflight rejects self-hosted runners and VM or formal candidate invocations', (t) => {
  const files = fixture(t);
  assert.throws(
    () => buildSourceQualificationReceipt({ ...input(files), runnerLabels: ['self-hosted'] }),
    /GitHub-hosted ubuntu-latest/,
  );
  for (const field of [
    'formal_candidate_build_count',
    'self_hosted_invocation_count',
    'tart_vm_invocation_count',
  ] as const) {
    const manifest = JSON.parse(fs.readFileSync(files.preflight, 'utf8'));
    manifest[field] = 1;
    writeJson(files.preflight, manifest);
    assert.throws(
      () => buildSourceQualificationReceipt(input(files)),
      /zero formal, self-hosted, or Tart invocations/,
    );
    manifest[field] = 0;
    writeJson(files.preflight, manifest);
  }
});

test('source preflight rejects reruns and cross-cohort evidence', (t) => {
  const files = fixture(t);
  assert.throws(() => buildSourceQualificationReceipt({ ...input(files), runAttempt: 2 }), /attempt 1/);
  const cohort = JSON.parse(fs.readFileSync(files.cohort, 'utf8'));
  cohort.cohort.shell.sha = 'f'.repeat(40);
  writeJson(files.cohort, cohort);
  assert.throws(() => buildSourceQualificationReceipt(input(files)), /drifted at shell/);
});

test('source preflight validation rejects digest drift and release authority escalation', (t) => {
  const files = fixture(t);
  const receipt = buildSourceQualificationReceipt(input(files));
  const digestDrift = structuredClone(receipt);
  digestDrift.artifact.size_bytes += 1;
  assert.throws(() => validateSourceQualificationReceipt(digestDrift), /digest is invalid/);

  const authorityDrift = structuredClone(receipt) as any;
  authorityDrift.authority.release_authority = true;
  const { receipt_digest: _ignored, ...core } = authorityDrift;
  authorityDrift.receipt_digest = sourceQualificationReceiptDigest(core);
  assert.throws(() => validateSourceQualificationReceipt(authorityDrift), /non-authoritative/);
});

test('source preflight distinguishes same-operation and standalone diagnostic scope', (t) => {
  const files = fixture(t);
  const diagnostic = buildSourceQualificationReceipt({
    ...input(files),
    operationScope: 'standalone_diagnostic',
  });
  assert.equal(diagnostic.execution.operation_scope, 'standalone_diagnostic');
  assert.equal(diagnostic.artifact.diagnostic_only, true);
  assert.equal(validateSourceQualificationReceipt(diagnostic), diagnostic);
});
