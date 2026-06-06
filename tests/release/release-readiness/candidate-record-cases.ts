import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  runCandidateRecord,
  runCandidateRecordValidator,
  writeJson,
  writePassingJobResults,
} from './helpers.ts';

test('release candidate record promotes only a complete stable cohort', () => {
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

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.schema, 'opl_release_candidate_record.v1');
  assert.equal(record.status, 'ready_to_promote');
  assert.equal(record.version, '26.5.99');
  assert.equal(record.decision.can_promote, true);
  assert.equal(record.provenance.app_commit, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(record.remote_asset_summary.verified_asset_count, 12);
  assert.equal(record.resolved_refs.opl_framework.commit, '1111111111111111111111111111111111111111');
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  assert.match(markdown, /Release Candidate Record/);
  assert.match(markdown, /Status: ready_to_promote/);

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
  assert.equal(validation.status, 'ready_to_promote');
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

test('release candidate record keeps draft candidates diagnostic only', () => {
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
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.status, 'diagnostic_only');
  assert.equal(record.decision.can_promote, false);
});
