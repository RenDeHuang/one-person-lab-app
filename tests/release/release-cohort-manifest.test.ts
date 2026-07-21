import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  appRoot,
  releaseCandidateFixture,
  releaseReadinessFixture,
  writeJson,
} from './release-readiness/helpers.ts';

function runCohortManifest(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/write-release-cohort-manifest.ts', ...args],
    { cwd: appRoot, encoding: 'utf8', env: { ...process.env } },
  );
}

test('historical cohort manifest projects evidence without Bundle state or mutation authority', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-cohort-manifest-'));
  const fixturePath = (name: string) => path.join(tempRoot, name);
  const candidatePath = fixturePath('release-candidate-record.json');
  const readinessPath = fixturePath('release-readiness-summary.json');
  const remotePath = fixturePath('remote-release-verification.json');
  const preflightPath = fixturePath('release-preflight-summary.json');
  const gateReusePath = fixturePath('release-gate-reuse-plan.json');
  const outputPath = fixturePath('release-cohort-manifest.json');
  const markdownPath = fixturePath('release-cohort-manifest.md');
  const shellRef = '1'.repeat(40);
  const frameworkRef = '2'.repeat(40);

  writeJson(candidatePath, releaseCandidateFixture('26.7.5', {
    release_mode: 'refresh_existing',
    inputs: { include_full_package: true, run_vm_smoke: true, shell_ref: shellRef, framework_ref: frameworkRef },
    provenance: { app_commit: 'a'.repeat(40), workflow_run_id: '12345' },
    resolved_refs: {
      opl_framework: { ref: frameworkRef, commit: frameworkRef },
    },
  }));
  writeJson(readinessPath, releaseReadinessFixture('26.7.5', {
    gates: {
      remote_release_verification: {
        status: 'passed', required: true,
        artifact_name: 'remote-release-verification-26.7.5',
        artifact_path: 'remote-release-verification-26.7.5/remote-release-verification.json',
      },
      full_dmg_clean_vm: {
        status: 'passed', required: true,
        artifact_name: 'opl-first-run-vm-full-12345',
        artifact_path: 'opl-first-run-vm-full-12345/tart-smoke-summary.json',
      },
    },
  }));
  writeJson(remotePath, {
    schema: 'opl_remote_release_verification.v1',
    status: 'passed',
    verified_assets: [
      {
        name: 'One-Person-Lab-Full-26.7.5-mac-arm64.dmg',
        size: 2048, sha256: 'b'.repeat(64),
      },
      {
        name: 'One-Person-Lab-26.7.5-mac-arm64.dmg',
        size: 1024, sha256: 'a'.repeat(64),
      },
    ],
  });
  writeJson(preflightPath, {
    schema: 'opl_release_preflight.v1',
    status: 'passed',
    release_refs: [
      {
        repository: 'gaofeng21cn/opl-aion-shell',
        ref: 'main', resolved_sha: shellRef,
      },
    ],
  });
  writeJson(gateReusePath, {
    schema: 'opl_release_gate_reuse_plan.v1',
    status: 'reuse_available',
    decisions: [
      {
        gate_id: 'remote_release_verification',
        status: 'reuse_allowed', reason: 'same version, refs, and asset digest',
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
  assert.equal(manifest.lifecycle, 'retired_historical_evidence_projection');
  assert.equal(manifest.status, 'historical_read_only');
  assert.equal(manifest.historical_claimed_status, 'ready_to_promote');
  assert.equal(manifest.version, '26.7.5');
  assert.equal(manifest.tag, 'v26.7.5');
  assert.equal(manifest.source_files.candidate_record, candidatePath);
  assert.match(manifest.source_files.candidate_record_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    manifest.assets.map((asset: { name: string }) => asset.name),
    ['One-Person-Lab-26.7.5-mac-arm64.dmg', 'One-Person-Lab-Full-26.7.5-mac-arm64.dmg'],
  );
  assert.equal(manifest.gates.length, 2);
  const gate = (id: string) => manifest.gates.find((entry: { id: string }) => entry.id === id);
  assert.equal(gate('remote_release_verification')?.recovery_action.action, 'inspect_framework_bundle_status');
  assert.match(
    gate('remote_release_verification')?.recovery_action.command_template,
    /^opl release status --bundle /,
  );
  assert.equal(gate('full_dmg_clean_vm')?.recovery_action.action, 'inspect_framework_bundle_status');
  assert.equal(gate('full_dmg_clean_vm')?.recovery_action.execution_mode, 'read_only');
  assert.equal(gate('full_dmg_clean_vm')?.recovery_action.mutation_authorized, false);
  assert.equal(gate('full_dmg_clean_vm')?.recovery_action.direct_workflow_dispatch_allowed, false);
  assert.equal(manifest.reusable_gates[0].status, 'historical_observation_only');
  assert.equal(manifest.reusable_gates[0].skip_authorized, false);
  assert.equal(manifest.retry_policy.build_once_verify_many, true);
  assert.equal(manifest.retry_policy.failed_gate_retry_should_consume_this_manifest, false);
  assert.equal(manifest.retry_policy.completed_stage_skip_authority, 'framework_checkpoint_only');
  assert.match(manifest.retry_policy.recovery_route, /read_only_status_then_framework_reconcile/);
  assert.equal(manifest.retry_policy.direct_workflow_dispatch_allowed, false);
  assert.equal(manifest.retry_policy.manifest_can_authorize_mutation, false);
  assert.equal(manifest.retry_policy.manifest_can_publish_release, false);
  assert.equal(manifest.retry_policy.manifest_can_claim_release_ready, false);
  assert.equal(manifest.retry_policy.manifest_can_write_runtime_truth, false);
  const serialized = JSON.stringify(manifest);
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  assert.doesNotMatch(serialized, /gh workflow run|rerun job|release:stable|--execute/i);
  assert.doesNotMatch(markdown, /gh workflow run|rerun job|release:stable|--execute/i);
  assert.match(markdown, /Read-only handoff/);
  assert.match(markdown, /opl release status --bundle/);
});
