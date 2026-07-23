import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  activateLatest,
  applyPublishPlan,
  inspectRelease,
  type GitHubAdapterRuntime,
  type GitHubCommandOptions,
  type GitHubCommandResult,
} from '../../scripts/framework-release-adapter.ts';

type Asset = { name: string; size_bytes: number; sha256: string; source_path: string };

const repo = 'example/one-person-lab-app';
const version = '26.7.22';
const tag = `v${version}`;
const deadlineAt = '2026-07-21T01:00:00.000Z';
const deadlineMs = Date.parse(deadlineAt);
const notes = 'Prepared release notes\n';
const sourceCommit = 'a'.repeat(40);
const shellCommit = 'c'.repeat(40);
const frameworkCommit = 'd'.repeat(40);
const bundleDigest = `sha256:${'b'.repeat(64)}`;
const latestZip = asset(`One-Person-Lab-${version}-mac-arm64.zip`, '9');
const expectedCurrentLatestTag = 'v26.7.20';
const standardOperationId = 'operation-standard-1';
const appendFullOperationId = 'operation-append-full-1';
const standardOperationStartedAt = '2026-07-21T00:00:00.000Z';
const appendFullOperationStartedAt = '2026-07-21T00:05:00.000Z';
const workflowAttemptId = 'gha-workflow-attempt-1';

function mutationAdmission(
  operation: 'standard' | 'resume_standard' | 'append_full' = 'standard',
  track: 'standard' | 'full' = 'standard',
): Record<string, string> {
  return {
    operation,
    track,
    'operation-id': operation === 'append_full' ? appendFullOperationId : standardOperationId,
    'operation-started-at': operation === 'append_full'
      ? appendFullOperationStartedAt
      : standardOperationStartedAt,
    'attempt-id': workflowAttemptId,
    'run-attempt': '1',
  };
}

function expectedMutationAttemptId(
  mutation: 'release_create' | 'asset_upload' | 'latest_patch',
  remoteTarget: string,
  subject: string,
): string {
  return `gha:${crypto.createHash('sha256').update(JSON.stringify({
    base_attempt_id: workflowAttemptId,
    mutation,
    remote_target: remoteTarget,
    subject,
  })).digest('hex').slice(0, 48)}`;
}

function sealAdmission(receipt: Record<string, any>): void {
  const evidence = {
    bundle_digest: receipt.bundle_digest,
    candidate: receipt.candidate,
    standard_assets_sha256: receipt.standard_assets_sha256,
    updater_predecessor_policy: receipt.updater_predecessor_policy,
    updater_receipts: receipt.updater_receipts,
    homebrew: receipt.homebrew,
    latest_compare_and_swap: receipt.latest_compare_and_swap,
  };
  receipt.input_digest = `sha256:${crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex')}`;
}

function success(value: unknown = ''): GitHubCommandResult {
  return {
    status: 0,
    stdout: value === '' ? '' : JSON.stringify(value),
    stderr: '',
  };
}

function releaseResponse(assets: Asset[]): Record<string, unknown> {
  return {
    id: 12345,
    name: `One Person Lab v${version}`,
    draft: false,
    prerelease: false,
    target_commitish: sourceCommit,
    body: notes,
    assets: assets.map((asset) => ({
      name: asset.name,
      size: asset.size_bytes,
      digest: asset.sha256,
    })),
  };
}

function fixture(
  actions: Asset[],
  releaseOperation: 'standard' | 'append_full' = 'standard',
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-github-deadline-'));
  const bundlePath = path.join(root, 'bundle.json');
  const planPath = path.join(root, 'plan.json');
  const statusPath = path.join(root, 'status.json');
  const admissionPath = path.join(root, 'latest-admission.json');
  const bundle = {
    surface_kind: 'opl_release_bundle.v1',
    bundle_digest: bundleDigest,
    release: { channel: 'stable', version, updater_version: version, tag, prerelease: false },
    sources: {
      app: { repo, source_commit: sourceCommit },
      shell: { source_commit: shellCommit },
      framework: { source_commit: frameworkCommit },
    },
    prepared_notes: { markdown: notes },
  };
  const track = releaseOperation === 'append_full' ? 'full' : 'standard';
  const operationId = releaseOperation === 'append_full' ? appendFullOperationId : standardOperationId;
  const operationStartedAt = releaseOperation === 'append_full'
    ? appendFullOperationStartedAt
    : standardOperationStartedAt;
  const operationControl = {
    operation_id: operationId,
    operation_started_at: operationStartedAt,
    operation_deadline_at: deadlineAt,
  };
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle)}\n`);
  fs.writeFileSync(planPath, `${JSON.stringify({
    release_bundle_publish: {
      bundle_digest: bundleDigest,
      track,
      status: 'ready',
      receipt: {
        release_operation: releaseOperation,
        operation_control: operationControl,
        details: {
          upload_actions: actions.map((asset) => ({
            action: 'upload',
            name: asset.name,
            source_path: asset.source_path,
            size_bytes: asset.size_bytes,
            sha256: asset.sha256,
          })),
        },
      },
    },
  })}\n`);
  fs.writeFileSync(statusPath, `${JSON.stringify({
    release_bundle_status: {
      bundle_digest: bundleDigest,
      latest_eligible: true,
      bundle,
      tracks: { standard: { assets: [latestZip] } },
      operation_controls: { standard: operationControl, append_full: null },
    },
  })}\n`);
  const admission: Record<string, any> = {
    schema: 'opl_standard_latest_admission_receipt.v1',
    status: 'passed',
    latest_activation_admitted: true,
    bundle_digest: bundleDigest,
    candidate: {
      display_version: version,
      updater_version: version,
      app_sha: sourceCommit,
      shell_sha: shellCommit,
      framework_sha: frameworkCommit,
      zip: { name: latestZip.name, sha256: latestZip.sha256, size_bytes: latestZip.size_bytes },
    },
    standard_assets_sha256: `sha256:${'e'.repeat(64)}`,
    updater_predecessor_policy: {
      schema: 'opl_standard_updater_predecessor_policy.v1',
      current_latest_tag: expectedCurrentLatestTag,
      highest_public_stable_tag: 'v26.7.21',
      distinct_predecessor_count: 2,
    },
    updater_receipts: [
      {
        baseline: { display_version: '26.7.20', updater_version: '26.7.20' },
        operation_input_digest: `sha256:${'1'.repeat(64)}`,
        updater_receipt_sha256: `sha256:${'2'.repeat(64)}`,
        candidate_identity_sha256: `sha256:${'3'.repeat(64)}`,
      },
      {
        baseline: { display_version: '26.7.21', updater_version: '26.7.21' },
        operation_input_digest: `sha256:${'4'.repeat(64)}`,
        updater_receipt_sha256: `sha256:${'5'.repeat(64)}`,
        candidate_identity_sha256: `sha256:${'6'.repeat(64)}`,
      },
    ],
    homebrew: {
      publication_receipt_sha256: `sha256:${'7'.repeat(64)}`,
      clean_vm_receipt_sha256: `sha256:${'8'.repeat(64)}`,
      readback_receipt_sha256: `sha256:${'a'.repeat(64)}`,
    },
    latest_compare_and_swap: {
      expected_current: {
        tag: expectedCurrentLatestTag,
        display_version: '26.7.20',
        updater_version: '26.7.20',
      },
      candidate: { tag },
    },
  };
  sealAdmission(admission);
  fs.writeFileSync(admissionPath, `${JSON.stringify(admission)}\n`);
  return { root, bundlePath, planPath, statusPath, admissionPath };
}

function asset(name: string, byte: string): Asset {
  return {
    name,
    size_bytes: 100,
    sha256: `sha256:${byte.repeat(64)}`,
    source_path: `/immutable/${name}`,
  };
}

function isReleaseInspect(args: string[]): boolean {
  return args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${tag}`;
}

test('deadline expiry before asset N prevents asset N and every later mutation', () => {
  const first = asset('first.zip', '1');
  const second = asset('second.yml', '2');
  const files = fixture([first, second]);
  const remoteAssets: Asset[] = [];
  const mutationCalls: string[][] = [];
  const mutationTimes = [deadlineMs - 60_000, deadlineMs];
  const runtime: GitHubAdapterRuntime = {
    now: () => mutationTimes.shift() ?? deadlineMs,
    readTimeoutMs: 1_234,
    mutationTimeoutMs: 120_000,
    run(command, args, options) {
      assert.equal(command, 'gh');
      assert.equal(options.killSignal, 'SIGTERM');
      if (isReleaseInspect(args)) {
        assert.equal(options.timeout, 1_234);
        return success(releaseResponse(remoteAssets));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        mutationCalls.push(args);
        assert.equal(options.timeout, 60_000);
        const uploaded = [first, second].find((candidate) => candidate.source_path === args[3]);
        assert.ok(uploaded);
        remoteAssets.push(uploaded);
        return success();
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'deadline_elapsed');
  assert.deepEqual(result.uploaded, [first.name]);
  assert.equal(result.unresolved_asset, second.name);
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_deadline_elapsed');
  assert.equal(result.mutation_attempt_id, expectedMutationAttemptId(
    'asset_upload', `github-release:${repo}@${tag}`, second.name,
  ));
  assert.equal(result.remote_target, `github-release:${repo}@${tag}`);
  assert.equal(result.failure.mutation_attempt_id, result.mutation_attempt_id);
  assert.equal(result.failure.remote_target, result.remote_target);
  assert.equal(result.failure.input_digest.startsWith('sha256:'), true);
  assert.equal(mutationCalls.length, 1);
  assert.equal(mutationCalls[0][3], first.source_path);
});

test('a timed out asset upload stops all mutation and performs only fresh read-only inspection', () => {
  const first = asset('first.zip', '3');
  const second = asset('second.yml', '4');
  const files = fixture([first, second]);
  const calls: Array<{ args: string[]; options: GitHubCommandOptions }> = [];
  let inspections = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 90_000,
    readTimeoutMs: 2_345,
    run(_command, args, options) {
      calls.push({ args, options });
      if (isReleaseInspect(args)) {
        inspections += 1;
        return success(releaseResponse([]));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        return {
          status: null,
          signal: 'SIGTERM',
          stdout: 'partial stdout',
          stderr: 'timed out stderr',
          error: Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        };
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  const uploads = calls.filter(({ args }) => args[0] === 'release' && args[1] === 'upload');
  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.unresolved_asset, first.name);
  assert.equal(result.retry_disposition, 'read_only_reconcile_only');
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_timeout');
  assert.equal(result.mutation_attempt_id, expectedMutationAttemptId(
    'asset_upload', `github-release:${repo}@${tag}`, first.name,
  ));
  assert.equal(result.remote_target, `github-release:${repo}@${tag}`);
  assert.equal(result.failure.mutation_attempt_id, result.mutation_attempt_id);
  assert.equal(result.failure.remote_target, result.remote_target);
  assert.equal(result.failure.timed_out, true);
  assert.equal(result.failure.stdout, 'partial stdout');
  assert.equal(result.failure.stderr, 'timed out stderr');
  assert.match(result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(uploads.length, 1);
  assert.equal(inspections, 3, 'initial, pre-upload, and one post-timeout inspection are bounded reads');
  assert.ok(calls.filter(({ args }) => isReleaseInspect(args)).every(({ options }) => options.timeout === 2_345));
});

test('a timed out Release create performs one mutation and then read-only reconciliation only', () => {
  const files = fixture([asset('first.zip', '5')]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 90_000,
    readTimeoutMs: 2_222,
    run(_command, args, options) {
      calls.push(args);
      if (isReleaseInspect(args)) {
        assert.equal(options.timeout, 2_222);
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (args.includes('POST')) {
        return {
          status: null,
          signal: 'SIGTERM',
          stdout: 'possibly created',
          stderr: 'timed out',
          error: Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        };
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.failure.mutation, 'release_create');
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_timeout');
  assert.equal(result.mutation_attempt_id, expectedMutationAttemptId(
    'release_create', `github-release:${repo}@${tag}`, tag,
  ));
  assert.equal(result.remote_target, `github-release:${repo}@${tag}`);
  assert.equal(result.failure.mutation_attempt_id, result.mutation_attempt_id);
  assert.equal(result.failure.remote_target, result.remote_target);
  assert.equal(calls.filter((args) => args.includes('POST')).length, 1);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
  assert.equal(calls.filter(isReleaseInspect).length, 2, 'one pre-create read and one bounded reconcile read');
});

test('a timed out Latest PATCH performs readback only and remains outcome_unknown', () => {
  const files = fixture([]);
  const calls: string[][] = [];
  let latestTag = expectedCurrentLatestTag;
  let latestReads = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 45_000,
    readTimeoutMs: 3_456,
    run(_command, args, options) {
      calls.push(args);
      assert.equal(options.killSignal, 'SIGTERM');
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        latestReads += 1;
        assert.equal(options.timeout, 3_456);
        return success({ tag_name: latestTag });
      }
      if (args.includes('PATCH')) {
        latestTag = tag;
        return {
          status: null,
          signal: 'SIGTERM',
          stdout: 'possibly accepted',
          stderr: 'deadline killed process',
          error: Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        };
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = activateLatest({
    ...mutationAdmission('resume_standard'),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  const patches = calls.filter((args) => args.includes('PATCH'));
  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_timeout');
  assert.equal(result.mutation_attempt_id, expectedMutationAttemptId(
    'latest_patch', `github-latest:${repo}@${tag}`, tag,
  ));
  assert.equal(result.remote_target, `github-latest:${repo}@${tag}`);
  assert.equal(result.failure.mutation_attempt_id, result.mutation_attempt_id);
  assert.equal(result.failure.remote_target, result.remote_target);
  assert.equal(result.retry_disposition, 'read_only_reconcile_only');
  assert.equal(result.reconciliation.observation.tag_name, tag);
  assert.equal(patches.length, 1);
  assert.equal(latestReads, 2, 'one pre-mutation inspect and one post-timeout readback');
});

test('read-only inspection remains bounded after the operation deadline', () => {
  const seen: GitHubCommandOptions[] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs + 60_000,
    readTimeoutMs: 4_567,
    run(_command, args, options) {
      seen.push(options);
      assert.equal(isReleaseInspect(args), true);
      return success(releaseResponse([]));
    },
  };

  const observation = inspectRelease(repo, tag, runtime);
  assert.equal(observation.release.exists, true);
  assert.deepEqual(seen.map(({ timeout, killSignal }) => ({ timeout, killSignal })), [
    { timeout: 4_567, killSignal: 'SIGTERM' },
  ]);
});

test('Framework latest_eligible cannot bypass the App Latest admission receipt', () => {
  const files = fixture([]);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Missing --latest-admission/,
  );
  assert.equal(calls, 0);
});

test('Latest admission for different ZIP bytes fails before any GitHub call', () => {
  const files = fixture([]);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.candidate.zip.sha256 = `sha256:${'f'.repeat(64)}`;
  sealAdmission(admission);
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Latest admission ZIP sha256 does not match/,
  );
  assert.equal(calls, 0);
});

test('GitHub mutation commands require an immutable operation deadline', () => {
  assert.throws(() => applyPublishPlan(mutationAdmission()), /Missing --operation-deadline-at/);
  assert.throws(() => activateLatest(mutationAdmission()), /Missing --operation-deadline-at/);
});

test('GitHub mutation commands reject incomplete operation identity before any gh call', () => {
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  for (const missing of ['operation-id', 'operation-started-at', 'attempt-id'] as const) {
    const values: Record<string, string> = {
      ...mutationAdmission(),
      'operation-deadline-at': deadlineAt,
    };
    delete values[missing];
    assert.throws(
      () => applyPublishPlan(values, runtime),
      (error: any) => {
        assert.equal(error.result.status, 'failed');
        assert.match(error.result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
        assert.ok(error.result.failure.stderr);
        return true;
      },
    );
  }
  assert.equal(calls, 0);
});

test('Latest compare-and-swap drift fails closed before PATCH', () => {
  const files = fixture([]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: 'v26.7.19' });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    (error: any) => {
      assert.equal(error.result.status, 'failed');
      assert.equal(error.result.failure.failure_taxonomy, 'github_latest_compare_and_swap_drift');
      assert.equal(error.result.failure.expected_current_tag, expectedCurrentLatestTag);
      assert.equal(error.result.failure.observed_current_tag, 'v26.7.19');
      assert.equal(error.result.retry_disposition, 'inspect_only_no_patch_require_new_admission');
      assert.match(error.result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
      assert.equal(error.result.failure.stdout, '');
      assert.match(error.result.failure.stderr, /Latest drifted/);
      return true;
    },
  );
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
});

test('Latest already pointing at the candidate is idempotent with zero PATCH', () => {
  const files = fixture([]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: tag });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = activateLatest({
    ...mutationAdmission('resume_standard'),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'idempotent');
  assert.equal(result.latest_compare_and_swap.patch_performed, false);
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
});

test('Latest rejects an admission whose expected current tag is not an admitted predecessor', () => {
  const files = fixture([]);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.latest_compare_and_swap.expected_current = {
    tag: 'v26.7.19',
    display_version: '26.7.19',
    updater_version: '26.7.19',
  };
  sealAdmission(admission);
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /policy current Latest tag does not match/,
  );
  assert.equal(calls, 0);
});

test('Latest rejects a tampered compare-and-swap predecessor before any GitHub call', () => {
  const files = fixture([]);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.latest_compare_and_swap.expected_current = {
    tag: 'v26.7.21',
    display_version: '26.7.21',
    updater_version: '26.7.21',
  };
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /policy current Latest tag does not match/,
  );
  assert.equal(calls, 0);
});

test('raw GitHub mutation commands reject reruns and operation-track mismatches before gh', () => {
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  for (const values of [
    { 'run-attempt': '1' },
    { operation: 'standard', 'run-attempt': '1' },
    { operation: 'publish', track: 'standard', 'run-attempt': '1' },
    { operation: 'standard', track: 'nightly', 'run-attempt': '1' },
    { ...mutationAdmission(), 'run-attempt': '2' },
    { ...mutationAdmission('append_full', 'standard') },
    { ...mutationAdmission('standard', 'full') },
  ]) {
    assert.throws(
      () => applyPublishPlan(values, runtime),
      (error: any) => {
        assert.equal(error.result.status, 'failed');
        assert.match(error.result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
        assert.equal(error.result.failure.stdout, '');
        assert.ok(error.result.failure.stderr);
        return true;
      },
    );
  }
  assert.equal(calls, 0);
});

test('github-apply admits append_full only for a Framework Full publish plan', () => {
  const files = fixture([], 'append_full');
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls += 1;
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = applyPublishPlan({
    ...mutationAdmission('append_full', 'full'),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(calls, 1);
});

test('raw Latest activation rejects append_full before gh', () => {
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest(mutationAdmission('append_full', 'full'), runtime),
    /rejects operation append_full for track full/,
  );
  assert.equal(calls, 0);
});

test('github-apply binds the caller track to the Framework publish plan before gh', () => {
  const files = fixture([]);
  const plan = JSON.parse(fs.readFileSync(files.planPath, 'utf8'));
  plan.release_bundle_publish.track = 'full';
  fs.writeFileSync(files.planPath, `${JSON.stringify(plan)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Framework publish plan track full does not match admitted standard/,
  );
  assert.equal(calls, 0);
});

test('raw mutation CLI persists typed failure evidence at the deterministic default path before exiting', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-github-admission-failure-'));
  try {
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types',
      path.join(process.cwd(), 'scripts/framework-release-adapter.ts'),
      'github-apply',
      '--operation', 'standard',
      '--track', 'standard',
      '--run-attempt', '2',
    ], { encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: root } });
    assert.equal(result.status, 1);
    const evidence = path.join(root, 'opl-release-mutation-failure/github-apply');
    const output = path.join(evidence, 'failure.json');
    const failure = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(failure.status, 'failed');
    assert.equal(failure.failure.schema, 'opl_release_mutation_failure_receipt.v1');
    assert.equal(failure.failure.failure_taxonomy, 'github_mutation_run_attempt_rejected');
    assert.match(failure.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(failure.failure.stdout, '');
    assert.match(failure.failure.stderr, /run-attempt 1/);
    assert.equal(fs.readFileSync(path.join(evidence, 'input-digest.txt'), 'utf8').trim(), failure.failure.input_digest);
    assert.equal(fs.readFileSync(path.join(evidence, 'stdout.txt'), 'utf8'), '');
    assert.match(fs.readFileSync(path.join(evidence, 'stderr.txt'), 'utf8'), /run-attempt 1/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
