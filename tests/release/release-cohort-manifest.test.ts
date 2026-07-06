import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot, writeJson } from './release-readiness/helpers.ts';

function runCohortManifest(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/write-release-cohort-manifest.ts', ...args],
    { cwd: appRoot, encoding: 'utf8', env: { ...process.env } },
  );
}

test('release cohort manifest binds candidate, readiness, remote assets, and retry commands', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-cohort-manifest-'));
  const candidatePath = path.join(tempRoot, 'release-candidate-record.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const gateReusePath = path.join(tempRoot, 'release-gate-reuse-plan.json');
  const outputPath = path.join(tempRoot, 'release-cohort-manifest.json');
  const markdownPath = path.join(tempRoot, 'release-cohort-manifest.md');

  writeJson(candidatePath, {
    schema: 'opl_release_candidate_record.v1',
    status: 'ready_to_promote',
    version: '26.7.5',
    release_mode: 'refresh_existing',
    inputs: {
      include_full_package: true,
      run_vm_smoke: true,
      shell_ref: '1111111111111111111111111111111111111111',
      framework_ref: '2222222222222222222222222222222222222222',
    },
    provenance: {
      app_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      workflow_run_id: '12345',
    },
    resolved_refs: {
      opl_framework: {
        ref: '2222222222222222222222222222222222222222',
        commit: '2222222222222222222222222222222222222222',
      },
    },
  });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    gates: {
      remote_release_verification: {
        status: 'passed',
        required: true,
        artifact_name: 'remote-release-verification-26.7.5',
        artifact_path: 'remote-release-verification-26.7.5/remote-release-verification.json',
      },
      full_dmg_clean_vm: {
        status: 'passed',
        required: true,
        artifact_name: 'opl-first-run-vm-full-12345',
        artifact_path: 'opl-first-run-vm-full-12345/tart-smoke-summary.json',
      },
    },
  });
  writeJson(remotePath, {
    schema: 'opl_remote_release_verification.v1',
    status: 'passed',
    verified_assets: [
      {
        name: 'One-Person-Lab-Full-26.7.5-mac-arm64.dmg',
        size: 2048,
        sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
      {
        name: 'One-Person-Lab-26.7.5-mac-arm64.dmg',
        size: 1024,
        sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ],
  });
  writeJson(preflightPath, {
    schema: 'opl_release_preflight.v1',
    status: 'passed',
    release_refs: [
      {
        repository: 'gaofeng21cn/opl-aion-shell',
        ref: 'main',
        resolved_sha: '1111111111111111111111111111111111111111',
      },
    ],
  });
  writeJson(gateReusePath, {
    schema: 'opl_release_gate_reuse_plan.v1',
    status: 'reuse_available',
    decisions: [
      {
        gate_id: 'remote_release_verification',
        status: 'reuse_allowed',
        reason: 'same version, refs, and asset digest',
      },
    ],
  });

  const result = runCohortManifest([
    '--version',
    '26.7.5',
    '--release-mode',
    'refresh_existing',
    '--candidate-record',
    candidatePath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--preflight',
    preflightPath,
    '--gate-reuse-plan',
    gateReusePath,
    '--output',
    outputPath,
    '--markdown',
    markdownPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(manifest.schema, 'opl_release_cohort_manifest.v1');
  assert.equal(manifest.status, 'ready_to_promote');
  assert.equal(manifest.version, '26.7.5');
  assert.equal(manifest.tag, 'v26.7.5');
  assert.equal(manifest.source_files.candidate_record, candidatePath);
  assert.match(manifest.source_files.candidate_record_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    manifest.assets.map((asset: { name: string }) => asset.name),
    ['One-Person-Lab-26.7.5-mac-arm64.dmg', 'One-Person-Lab-Full-26.7.5-mac-arm64.dmg'],
  );
  assert.equal(manifest.gates.length, 2);
  assert.ok(
    manifest.gates
      .find((gate: { id: string }) => gate.id === 'remote_release_verification')
      ?.retry_command.includes('npm run verify-remote-release -- --version 26.7.5 --include-full-package'),
  );
  assert.ok(
    manifest.gates
      .find((gate: { id: string }) => gate.id === 'full_dmg_clean_vm')
      ?.retry_command.includes('release_artifact_name=opl-full-first-install-dmg-26.7.5-mac-arm64'),
  );
  assert.equal(manifest.reusable_gates[0].status, 'reuse_allowed');
  assert.equal(manifest.retry_policy.build_once_promote_many, true);
  assert.equal(manifest.retry_policy.manifest_can_claim_release_ready, false);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Release Cohort Manifest/);
});
