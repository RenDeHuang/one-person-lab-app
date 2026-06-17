import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  appRoot,
  runCandidateRecord,
  runCandidateRecordValidator,
  writeJson,
  writePassingJobResults,
} from './helpers.ts';

function releaseOwnerVerdict(status = 'release_owner_verdict_pending') {
  return {
    schema: 'opl_app_release_owner_verdict_readout.v1',
    scope: 'same_cohort_app_release_user_path_owner_verdict',
    owner: 'one-person-lab-app release owner',
    status,
    release_ready_claim: false,
    stable_latest_promotion_claim: false,
    family_production_ready_claim: false,
    release_owner_verdict_ref: null,
    release_owner_receipt_ref: null,
    install_evidence_ref:
      'install_evidence_ref://one-person-lab-app/release-owner/v26.5.99/install-evidence',
    release_owner_typed_blocker_ref:
      'typed_blocker_ref://one-person-lab-app/release-owner/v26.5.99/verdict-pending',
    typed_blocker_ref:
      'typed_blocker_ref://one-person-lab-app/release-owner/v26.5.99/verdict-pending',
  };
}

function runReleaseOwnerCandidateVerifier(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/verify-release-owner-candidate-record.ts', ...args],
    { cwd: appRoot, encoding: 'utf8', env: { ...process.env } },
  );
}

test('release candidate record blocks complete evidence until release owner records a receipt or verdict', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-record-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const jobResultsPath = path.join(tempRoot, 'release-readiness-job-results.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');
  const markdownPath = path.join(tempRoot, 'release-candidate-record.md');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
    release_owner_verdict: releaseOwnerVerdict(),
    full_package: {
      resolved_refs: {
        opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
      },
    },
  });
  writeJson(remotePath, {
    status: 'passed',
    version: '26.5.99',
    include_full_package: true,
    verified_asset_count: 12,
    full_first_install_budget: { status: 'passed', full_dmg_size_bytes: 512 },
  });
  writePassingJobResults(jobResultsPath);

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--app-commit',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '--workflow-run-id',
    '12345',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
    '--markdown',
    markdownPath,
  ]);

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.schema, 'opl_release_candidate_record.v1');
  assert.equal(record.status, 'blocked');
  assert.equal(record.version, '26.5.99');
  assert.equal(record.decision.can_promote, false);
  assert.equal(record.provenance.app_commit, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(record.remote_asset_summary.verified_asset_count, 12);
  assert.equal(record.resolved_refs.opl_framework.commit, '1111111111111111111111111111111111111111');
  assert.equal(record.release_owner_verdict.status, 'release_owner_verdict_pending');
  assert.equal(
    record.release_owner_verdict.install_evidence_ref,
    'install_evidence_ref://one-person-lab-app/release-owner/v26.5.99/install-evidence',
  );
  assert.equal(
    record.release_owner_verdict.release_owner_typed_blocker_ref,
    'typed_blocker_ref://one-person-lab-app/release-owner/v26.5.99/verdict-pending',
  );
  assert.match(record.blocked_reasons.join('\n'), /pending/);
  assert.match(record.blocked_reasons.join('\n'), /missing owner resolution ref/);
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  assert.match(markdown, /Release Candidate Record/);
  assert.match(markdown, /Status: blocked/);

  const validateResult = runCandidateRecordValidator([
    '--promote-ready',
    '--version',
    '26.5.99',
    '--record',
    outputPath,
  ]);
  assert.notEqual(validateResult.status, 0);
  const validation = JSON.parse(validateResult.stdout);
  assert.equal(validation.promote_ready, false);
  assert.equal(validation.status, 'blocked');
  assert.equal(validation.release_owner_verdict_status, 'release_owner_verdict_pending');
  assert.equal(
    validation.release_owner_typed_blocker_ref,
    'typed_blocker_ref://one-person-lab-app/release-owner/v26.5.99/verdict-pending',
  );
});

test('release candidate record promotes only after same-cohort release owner receipt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-record-owner-receipt-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const jobResultsPath = path.join(tempRoot, 'release-readiness-job-results.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
    release_owner_verdict: releaseOwnerVerdict(),
    full_package: {
      resolved_refs: {
        opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
      },
    },
  });
  writeJson(remotePath, {
    status: 'passed',
    version: '26.5.99',
    include_full_package: true,
    verified_asset_count: 12,
    full_first_install_budget: { status: 'passed', full_dmg_size_bytes: 512 },
  });
  writePassingJobResults(jobResultsPath);

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--app-commit',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '--workflow-run-id',
    '12345',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--job-results',
    jobResultsPath,
    '--release-owner-receipt-ref',
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-20260612',
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.status, 'ready_to_promote');
  assert.equal(record.decision.can_promote, true);
  assert.equal(record.release_owner_verdict.status, 'release_owner_receipt_recorded');
  assert.equal(
    record.release_owner_verdict.release_owner_receipt_ref,
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-20260612',
  );

  const validateResult = runCandidateRecordValidator([
    '--promote-ready',
    '--version',
    '26.5.99',
    '--record',
    outputPath,
  ]);
  assert.equal(validateResult.status, 0, validateResult.stderr || validateResult.stdout);
  const validation = JSON.parse(validateResult.stdout);
  assert.equal(validation.promote_ready, true);
  assert.equal(validation.release_owner_verdict_status, 'release_owner_receipt_recorded');
  assert.equal(
    validation.release_owner_receipt_ref,
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-20260612',
  );
});

test('new release candidate record is promote-ready when initial run carries same-cohort owner receipt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-record-new-release-owner-receipt-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const jobResultsPath = path.join(tempRoot, 'release-readiness-job-results.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
    release_owner_verdict: releaseOwnerVerdict(),
  });
  writeJson(remotePath, { status: 'passed', version: '26.5.99', verified_asset_count: 10 });
  writePassingJobResults(jobResultsPath);

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'new_release',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--job-results',
    jobResultsPath,
    '--release-owner-receipt-ref',
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-initial-owner-verdict',
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.status, 'ready_to_promote');
  assert.equal(record.decision.can_promote, true);
  assert.equal(record.release_owner_verdict.status, 'release_owner_receipt_recorded');
  assert.equal(
    record.release_owner_verdict.release_owner_receipt_ref,
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-initial-owner-verdict',
  );
});

test('new release candidate record remains blocked without owner receipt or verdict ref', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-record-new-release-missing-owner-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
    release_owner_verdict: releaseOwnerVerdict(),
  });
  writeJson(remotePath, { status: 'passed', version: '26.5.99', verified_asset_count: 10 });

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'new_release',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.status, 'blocked');
  assert.equal(record.decision.can_promote, false);
  assert.match(
    record.blocked_reasons.join('\n'),
    /promotion requires release_owner_verdict_ref or release_owner_receipt_ref/,
  );
});

test('candidate record rejects cross-cohort owner receipt ref as blocked', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-record-cross-cohort-owner-receipt-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
    release_owner_verdict: releaseOwnerVerdict(),
  });
  writeJson(remotePath, { status: 'passed', version: '26.5.99', verified_asset_count: 10 });

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'new_release',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--release-owner-receipt-ref',
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.98/receipt-previous-cohort',
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.status, 'blocked');
  assert.equal(record.decision.can_promote, false);
  assert.match(record.blocked_reasons.join('\n'), /same cohort v26\.5\.99/);
});

test('release owner receipt verification rebuilds a promote-ready candidate record from small artifacts', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-owner-candidate-verify-'));
  const artifactsDir = path.join(tempRoot, 'artifacts');
  const outputDir = path.join(tempRoot, 'owner-validation');
  const ownerRecordPath = path.join(tempRoot, 'v26.5.99-release-owner-receipt.json');

  writeJson(path.join(artifactsDir, 'release-preflight-summary.json'), {
    schema: 'opl_release_preflight.v1',
    status: 'passed',
  });
  writeJson(path.join(artifactsDir, 'release-readiness-summary.json'), {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
    release_owner_verdict: releaseOwnerVerdict(),
    full_package: {
      resolved_refs: {
        opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
      },
    },
  });
  writeJson(path.join(artifactsDir, 'remote-release-verification.json'), {
    status: 'passed',
    version: '26.5.99',
    include_full_package: true,
    verified_asset_count: 12,
    full_first_install_budget: { status: 'passed', full_dmg_size_bytes: 512 },
  });
  writeJson(ownerRecordPath, {
    schema: 'opl_app_release_owner_receipt_record.v1',
    owner: 'one-person-lab-app release owner',
    scope: 'same_cohort_app_release_user_path_owner_verdict',
    status: 'release_owner_receipt_recorded',
    version: '26.5.99',
    tag: 'v26.5.99',
    channel: 'stable',
    release_owner_receipt_ref:
      'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-test',
    release_owner_verdict_ref: null,
    release_candidate_promote_ready: true,
    release_ready_claim: false,
    stable_latest_promotion_claim: false,
    family_production_ready_claim: false,
    can_close_opl_app_release_user_path: true,
    source_artifact_readback: {
      source_run_id: '12345',
      app_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      include_full_package: true,
    },
    authority_boundary: {
      can_claim_app_release_ready_from_evidence: false,
      can_claim_stable_latest_from_evidence: false,
      can_claim_family_production_ready: false,
    },
  });

  const result = runReleaseOwnerCandidateVerifier([
    '--version',
    '26.5.99',
    '--owner-record',
    ownerRecordPath,
    '--artifacts-dir',
    artifactsDir,
    '--output-dir',
    outputDir,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.schema, 'opl_release_owner_candidate_record_verification.v1');
  assert.equal(summary.status, 'verified');
  assert.equal(summary.version, '26.5.99');
  assert.equal(summary.source_run_id, '12345');
  assert.equal(summary.validator.promote_ready, true);
  assert.equal(summary.validator.release_owner_verdict_status, 'release_owner_receipt_recorded');
  assert.equal(
    summary.validator.release_owner_receipt_ref,
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-test',
  );
  assert.equal(summary.authority_boundary.can_claim_app_release_ready_from_evidence, false);
  assert.equal(summary.authority_boundary.can_claim_family_production_ready, false);
  assert.equal(fs.existsSync(summary.output_candidate_record), true);
  assert.equal(
    JSON.parse(fs.readFileSync(summary.output_candidate_record, 'utf8')).status,
    'ready_to_promote',
  );
});

test('release candidate record blocks promotion when a required gate fails', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-blocked-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'failed',
    version: '26.5.99',
    failed_required_gates: [
      { id: 'one_shot_app_installer', status: 'failed', reason: 'installer exited with 1' },
    ],
    release_owner_verdict: releaseOwnerVerdict('release_owner_typed_blocker_required'),
  });
  writeJson(remotePath, { status: 'passed', version: '26.5.99', verified_asset_count: 10 });

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.status, 'blocked');
  assert.equal(record.decision.can_promote, false);
  assert.match(record.blocked_reasons.join('\n'), /one_shot_app_installer/);
  assert.equal(record.release_owner_verdict.status, 'release_owner_typed_blocker_required');

  const statusResult = runCandidateRecordValidator([
    '--status',
    '--version',
    '26.5.99',
    '--record',
    outputPath,
  ]);
  assert.equal(statusResult.status, 0, statusResult.stderr || statusResult.stdout);
  const status = JSON.parse(statusResult.stdout);
  assert.equal(status.promote_ready, false);
  assert.match(status.blocked_reasons.join('\n'), /one_shot_app_installer/);

  const validateResult = runCandidateRecordValidator([
    '--promote-ready',
    '--version',
    '26.5.99',
    '--record',
    outputPath,
  ]);
  assert.notEqual(validateResult.status, 0);
  assert.match(`${validateResult.stdout}\n${validateResult.stderr}`, /blocked_reasons/);
});

test('release candidate record validator rejects version mismatch', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-version-mismatch-'));
  const recordPath = path.join(tempRoot, 'release-candidate-record.json');
  writeJson(recordPath, {
    schema: 'opl_release_candidate_record.v1',
    version: '26.5.99',
    status: 'ready_to_promote',
    blocked_reasons: [],
    decision: {
      can_promote: true,
      promote_command: 'gh release edit v26.5.99 --draft=false --latest',
    },
  });

  const result = runCandidateRecordValidator([
    '--promote-ready',
    '--version',
    '26.5.100',
    '--record',
    recordPath,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Candidate record version 26\.5\.99 does not match 26\.5\.100/);
  assert.match(result.stderr, /not promote-ready/);
});

test('release candidate record keeps draft candidates diagnostic only even with same-cohort owner receipt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-draft-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
    release_owner_verdict: releaseOwnerVerdict(),
  });
  writeJson(remotePath, { status: 'passed', version: '26.5.99', verified_asset_count: 10 });

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'draft_candidate',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--release-owner-receipt-ref',
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-draft-owner-verdict',
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.status, 'diagnostic_only');
  assert.equal(record.decision.can_promote, false);
  assert.equal(record.release_owner_verdict.status, 'release_owner_receipt_recorded');
});

test('release candidate record blocks when readiness omits release owner verdict readout', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-missing-owner-verdict-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
  });
  writeJson(remotePath, { status: 'passed', version: '26.5.99', verified_asset_count: 10 });

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.status, 'blocked');
  assert.match(record.blocked_reasons.join('\n'), /missing release_owner_verdict/);
});
