import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import type { ReleaseCohortPlan } from '../../scripts/plan-release-cohort.ts';
import { stableReleaseSessionIdentity } from '../../scripts/stable-release-session.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');

function runScript(script: string, args: string[]) {
  return spawnSync(process.execPath, ['--experimental-strip-types', script, ...args], {
    cwd: appRoot,
    encoding: 'utf8',
  });
}

function historicalSession() {
  const generatedAt = '2026-07-18T00:00:00.000Z';
  const plan: ReleaseCohortPlan = {
    schema: 'opl_app_release_cohort_plan.v1',
    lifecycle: 'retired_read_only_handoff',
    generated_at: generatedAt,
    version: '26.7.18',
    tag: 'v26.7.18',
    release_mode: 'new_release',
    release_intent: 'stable_complete',
    full_omission_reason: null,
    operator_plan_ref: `sha256:${'d'.repeat(64)}`,
    gate_reuse_plan_ref: null,
    app_commit: 'a'.repeat(40),
    shell_ref: 'b'.repeat(40),
    framework_ref: 'c'.repeat(40),
    cohort_lock: {
      schema: 'opl_app_release_cohort_lock.v1',
      generated_at: generatedAt,
      app: { requested_ref: 'a'.repeat(40), resolved_sha: 'a'.repeat(40), repo_root: appRoot },
      shell: { requested_ref: 'b'.repeat(40), resolved_sha: 'b'.repeat(40), repo_root: '/historical/shell' },
      framework: { requested_ref: 'c'.repeat(40), resolved_sha: 'c'.repeat(40), repo_root: '/historical/framework' },
      authority_boundary: {
        cohort_lock_can_dispatch_workflow: false,
        cohort_lock_can_publish_release: false,
        cohort_lock_can_write_runtime_truth: false,
      },
    },
    include_full_package: true,
    run_vm_smoke: true,
    publish_docker_webui: false,
    cheap_gates: [],
    next_action: {
      action: 'framework_checkpoint_read_only_handoff',
      command: 'opl release status --bundle <sha256:digest> --store <directory>',
      operation: 'standard',
      mutation_authorized: false,
      manual_handoff_required: true,
      reason: 'historical fixture',
    },
    authority_boundary: {
      cohort_plan_can_start_release: false,
      cohort_plan_can_publish_release: false,
      cohort_plan_can_write_runtime_truth: false,
      cohort_plan_can_claim_release_ready: false,
    },
  };
  return {
    schema: 'opl_app_stable_release_session.v3',
    revision: 1,
    id: stableReleaseSessionIdentity(plan),
    created_at: generatedAt,
    updated_at: generatedAt,
    phase: 'candidate_frozen',
    version: plan.version,
    repo: 'gaofeng21cn/one-person-lab-app',
    cohort_plan: plan,
    release_run: { id: null, url: null, conclusion: null },
    promotion_run: { id: null, url: null, conclusion: null },
    mutation_attempts: [],
    receipts: { promotion_saga: null, local_activation: null },
    authority_boundary: { session_is_release_truth: false },
  };
}

test('retired controller and operator expose historical state inspection only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-retired-release-state-'));
  const statePath = path.join(root, 'stable-session.json');
  fs.writeFileSync(statePath, `${JSON.stringify(historicalSession(), null, 2)}\n`);

  try {
    for (const script of ['scripts/run-stable-release.ts', 'scripts/release-operator.ts']) {
      const result = runScript(script, ['status', '--state', statePath]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const output = JSON.parse(result.stdout);
      assert.equal(output.schema, 'opl_app_historical_release_evidence_inspection.v1');
      assert.equal(output.mode, 'historical_read_only');
      assert.equal(output.evidence_kind, 'stable_session_v3');
      assert.equal(output.authoritative_for_new_release, false);
      assert.equal(output.mutation_authorized, false);
      assert.equal(output.evidence.schema, 'opl_app_stable_release_session.v3');
      assert.equal(output.framework_authority.state_authority, 'framework_opl_release_portable_checkpoint_and_receipt');
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('retired controller inspects receipt bytes without granting authority', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-retired-release-receipt-'));
  const receiptPath = path.join(root, 'receipt.json');
  const bytes = Buffer.from(`${JSON.stringify({ schema: 'historical_receipt.v1', outcome: 'complete' })}\n`);
  fs.writeFileSync(receiptPath, bytes);

  try {
    const result = runScript('scripts/run-stable-release.ts', ['inspect-receipt', '--receipt', receiptPath]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.evidence_kind, 'receipt');
    assert.equal(output.source_sha256, `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`);
    assert.equal(output.authoritative_for_new_release, false);
    assert.equal(output.mutation_authorized, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('every legacy controller mutation command fails closed before parsing arguments', () => {
  const commands = [
    'plan',
    'start',
    'resume',
    'promote',
    'retry-qualification',
    'reconcile',
    'dispatch-full-addon',
    'disposition-addon-debt',
    'cancel',
    'recover-stale-lock',
    'complete-local',
  ];

  for (const command of commands) {
    const result = runScript('scripts/run-stable-release.ts', [command, '--execute']);
    assert.equal(result.status, 2, `${command}: ${result.stderr || result.stdout}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schema, 'opl_app_legacy_release_entry_retired.v1');
    assert.equal(output.status, 'retired_fail_closed');
    assert.equal(output.requested_command, command);
    assert.equal(output.mutation_authorized, false);
  }
});

test('retired entrypoint sources contain no direct release mutation primitive', () => {
  const forbidden = [
    /npm run release:(?:stable|operator)/,
    /gh\s+workflow\s+run/,
    /gh\s+run\s+(?:cancel|rerun)/,
    /gh\s+release\s+(?:create|edit|upload|delete)/,
    /externalReleaseMutationBroker/,
    /--execute/,
  ];
  for (const relativePath of [
    'scripts/run-stable-release.ts',
    'scripts/release-operator.ts',
    'scripts/closeout-release-run.ts',
    'scripts/stable-release-session.ts',
  ]) {
    const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, relativePath);
  }
});

test('historical Stable session module has no state creation or transition API', () => {
  const source = fs.readFileSync(path.join(appRoot, 'scripts/stable-release-session.ts'), 'utf8');
  for (const retiredApi of [
    'buildStableReleaseSession',
    'writeStableReleaseSessionAtomic',
    'createStableReleaseSessionAtomic',
    'recoverStaleStableReleaseSessionLock',
    'transitionStableReleaseSession',
    'planReleaseMutationAttempt',
    'issueReleaseMutationLease',
  ]) assert.doesNotMatch(source, new RegExp(`export function ${retiredApi}\\b`));
  assert.equal(fs.existsSync(path.join(appRoot, 'scripts/stable-release-reconcile.ts')), false);
});
