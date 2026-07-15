import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  buildArtifactQualificationReceipt,
  validateArtifactQualificationReceipt,
} from '../../scripts/artifact-qualification-receipt.ts';
import type { BuildArtifactCohortV2 } from '../../scripts/build-artifact-cohort.ts';
import { buildQualificationHarnessScopeProof } from '../../scripts/qualification-harness-scope.ts';
import { validateReleaseAddonReadiness } from '../../scripts/validate-release-addon-readiness.ts';

const stableSessionId = `sha256:${'1'.repeat(64)}`;
const releaseCohortRef = `sha256:${'2'.repeat(64)}`;
const artifactSha256 = '3'.repeat(64);
const sourceArtifactName = 'opl-full-first-install-dmg-26.7.13-mac-arm64';

function writeFixture(root: string) {
  const manifestPath = path.join(root, 'opl-build-cohort.json');
  const receiptPath = path.join(root, 'artifact-qualification-receipt.json');
  const recordPath = path.join(root, 'release-addon-readiness-summary.json');
  const manifest: BuildArtifactCohortV2 = {
    schema: 'opl_app_build_artifact_cohort.v2',
    release: { stable_session_id: stableSessionId, release_cohort_ref: releaseCohortRef },
    cohort: { app_sha: 'a'.repeat(40), shell_sha: 'b'.repeat(40), framework_sha: 'c'.repeat(40) },
    build: { version: '26.7.13', kind: 'full' },
    artifact: { name: 'One-Person-Lab-Full-26.7.13-arm64.dmg', sha256: artifactSha256, size_bytes: 1234 },
    actions: { run_id: '101', run_attempt: '1', artifact_name: sourceArtifactName },
    digests: {
      packaged_tree_sha256: '4'.repeat(64),
      app_product_profile_sha256: '5'.repeat(64),
      gui_product_contract_sha256: '6'.repeat(64),
      smoke_harness_sha256: '7'.repeat(64),
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const receipt = buildArtifactQualificationReceipt({
    manifest,
    manifestPath,
    result: 'passed',
    packageProfile: 'full',
    qualificationRunId: '202',
    sourceArtifactRunId: '101',
    sourceArtifactName,
    evidenceRef: 'opl-first-run-vm-full-202',
  });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  fs.writeFileSync(recordPath, `${JSON.stringify({
    schema: 'opl_release_addon_readiness_summary.v1',
    version: '26.7.13',
    job_results: {
      'full-first-install': 'success',
      'remote-verify-full': 'success',
      'full-first-run-vm-smoke': 'failure',
      'docker-webui-smoke': 'success',
      'webui-ghcr-publish': 'success',
      'docker-webui-clean-vm-evidence': 'success',
      'operator-evidence-bundle-validation': 'success',
    },
  }, null, 2)}\n`);
  return { manifestPath, receiptPath, recordPath, receipt };
}

function options(fixture: ReturnType<typeof writeFixture>) {
  return {
    version: '26.7.13',
    recordPath: fixture.recordPath,
    includeFullPackage: true,
    runVmSmoke: true,
    requireDockerWebui: true,
    fullQualificationReceiptPath: fixture.receiptPath,
    buildArtifactManifestPath: fixture.manifestPath,
    stableSessionId,
    releaseCohortRef,
    sourceArtifactRunId: '101',
    sourceArtifactName,
  };
}

test('qualification receipt records a separately pinned smoke-only verification harness', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-qualification-harness-'));
  try {
    const fixture = writeFixture(root);
    const smokeHarnessPath = path.join(root, 'opl-first-run-vm-smoke.mjs');
    fs.writeFileSync(smokeHarnessPath, 'fixed smoke harness');
    const verificationAppSha = 'd'.repeat(40);
    const verificationShellSha = 'e'.repeat(40);
    const scopeProof = buildQualificationHarnessScopeProof({
      artifactAppSha: 'a'.repeat(40),
      verificationAppSha,
      appChangedPaths: ['.github/workflows/opl-first-run-vm.yml'],
      artifactShellSha: 'b'.repeat(40),
      verificationShellSha,
      shellChangedPaths: ['scripts/opl-first-run-vm-smoke.mjs'],
    });
    const receipt = buildArtifactQualificationReceipt({
      manifest: JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8')) as BuildArtifactCohortV2,
      manifestPath: fixture.manifestPath,
      result: 'passed',
      packageProfile: 'full',
      qualificationRunId: '203',
      sourceArtifactRunId: '101',
      sourceArtifactName,
      evidenceRef: 'opl-first-run-vm-full-203',
      verificationHarness: {
        appSha: verificationAppSha,
        shellSha: verificationShellSha,
        smokeHarnessPath,
        scopeProof,
      },
    });

    assert.equal(receipt.verification_harness?.differs_from_artifact_cohort, true);
    assert.equal(receipt.verification_harness?.change_scope, 'smoke_or_validator_only');
    assert.deepEqual(validateArtifactQualificationReceipt(receipt, {
      stableSessionId,
      releaseCohortRef,
      version: '26.7.13',
      packageProfile: 'full',
      verificationAppSha,
      verificationShellSha,
      verificationScopeProof: scopeProof,
    }), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('same-artifact Full qualification receipt overrides only the stale Full VM result', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-addon-readiness-'));
  try {
    const fixture = writeFixture(root);
    const result = validateReleaseAddonReadiness(options(fixture));
    assert.equal(result.status, 'verified');
    assert.equal(result.full_qualification_override.applied, true);
    assert.equal(result.job_results['full-first-run-vm-smoke'], 'success');
    assert.equal(result.job_results['docker-webui-smoke'], 'success');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Full qualification override rejects a receipt for different artifact bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-addon-readiness-'));
  try {
    const fixture = writeFixture(root);
    fixture.receipt.artifact.sha256 = '8'.repeat(64);
    fs.writeFileSync(fixture.receiptPath, `${JSON.stringify(fixture.receipt, null, 2)}\n`);
    const result = validateReleaseAddonReadiness(options(fixture));
    assert.equal(result.status, 'blocked');
    assert.equal(result.full_qualification_override.applied, false);
    assert.match(result.errors.join('\n'), /artifact sha256/);
    assert.match(result.errors.join('\n'), /full-first-run-vm-smoke is failure/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Full qualification override rejects a receipt for a different build smoke harness', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-addon-readiness-'));
  try {
    const fixture = writeFixture(root);
    fixture.receipt.build_manifest.smoke_harness_sha256 = '8'.repeat(64);
    fs.writeFileSync(fixture.receiptPath, `${JSON.stringify(fixture.receipt, null, 2)}\n`);
    const result = validateReleaseAddonReadiness(options(fixture));
    assert.equal(result.status, 'blocked');
    assert.equal(result.full_qualification_override.applied, false);
    assert.match(result.errors.join('\n'), /build manifest smoke_harness_sha256/);
    assert.match(result.errors.join('\n'), /full-first-run-vm-smoke is failure/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('owner resolution accepts a failed source readiness only through the exact retry receipt', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-owner-override-'));
  try {
    const fixture = writeFixture(root);
    const candidatePath = path.join(root, 'release-candidate-record.json');
    const preflightPath = path.join(root, 'release-preflight-summary.json');
    const readinessPath = path.join(root, 'release-readiness-summary.json');
    const remotePath = path.join(root, 'remote-release-verification.json');
    fs.writeFileSync(candidatePath, `${JSON.stringify({
      schema: 'opl_release_candidate_record.v1',
      status: 'blocked',
      version: '26.7.13',
      release_mode: 'new_release',
      inputs: { include_full_package: true, run_vm_smoke: true, shell_ref: 'b'.repeat(40), framework_ref: 'c'.repeat(40) },
      provenance: { app_commit: 'a'.repeat(40), workflow_run_id: '101' },
      job_results: { 'full-first-run-vm-smoke': 'failure' },
    }, null, 2)}\n`);
    fs.writeFileSync(preflightPath, `${JSON.stringify({ status: 'passed' })}\n`);
    fs.writeFileSync(remotePath, `${JSON.stringify({ status: 'passed', version: '26.7.13' })}\n`);
    fs.writeFileSync(readinessPath, `${JSON.stringify({
      schema: 'opl_release_readiness_summary.v1',
      status: 'failed',
      version: '26.7.13',
      job_results: { 'full-first-run-vm-smoke': 'failure' },
      gates: { full_dmg_clean_vm: { required: true, status: 'failed', reason: 'old VM assertion failed' } },
      failed_required_gates: [{ id: 'full_dmg_clean_vm', status: 'failed', reason: 'old VM assertion failed' }],
      release_cohort: {
        schema: 'opl_app_release_evidence_cohort.v1',
        version: '26.7.13',
        tag: 'v26.7.13',
        channel: 'stable',
        source: 'release_readiness_summary',
        current_cohort_evidence: true,
      },
    }, null, 2)}\n`);
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types',
      'scripts/resolve-release-owner-candidate-record.ts',
      '--candidate-record', candidatePath,
      '--preflight', preflightPath,
      '--readiness', readinessPath,
      '--remote-verification', remotePath,
      '--output', candidatePath,
      '--release-owner-receipt-ref', 'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.7.13/receipt-test',
      '--full-qualification-receipt', fixture.receiptPath,
      '--build-artifact-manifest', fixture.manifestPath,
      '--stable-session-id', stableSessionId,
      '--release-cohort-ref', releaseCohortRef,
      '--source-artifact-run-id', '101',
      '--source-artifact-name', sourceArtifactName,
    ], { cwd: path.resolve(import.meta.dirname, '../..'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const resolved = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
    assert.equal(resolved.status, 'ready_to_promote');
    assert.equal(resolved.job_results['full-first-run-vm-smoke'], 'success');
    assert.equal(resolved.qualification_override.original_job_result, 'failure');
    assert.equal(resolved.qualification_override.artifact_sha256, artifactSha256);
    assert.equal(resolved.provenance.original_readiness_summary, 'release-readiness-summary.json');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
