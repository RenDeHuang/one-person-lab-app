import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot } from './release-readiness/helpers.ts';
import { fakeGhEnv, writeFakeGh } from './fake-gh-fixture.ts';

function runCleanup(args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/cleanup-draft-release-candidates.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    },
  );
}

function release(id: number, tag: string, fields: Record<string, unknown> = {}) {
  return {
    id,
    tag_name: tag,
    name: `One Person Lab ${tag.slice(1)}`,
    draft: true,
    prerelease: false,
    created_at: '2026-05-28T04:28:32Z',
    html_url: `https://example.test/${id}`,
    assets: [],
    ...fields,
  };
}

const releases = [
  release(1, 'v26.5.99-draft.20260528103712', {
    created_at: '2026-05-28T10:33:30Z',
    assets: [
      { name: 'One-Person-Lab-26.5.99-draft.20260528103712-mac-arm64.dmg', size: 271 },
      { name: 'One-Person-Lab-Full-26.5.99-draft.20260528103712-mac-arm64.dmg', size: 529 },
    ],
  }),
  release(2, 'v26.5.99-readiness.20260528040857', {
    assets: [{ name: 'full-package-manifest.json', size: 14 }],
  }),
  release(3, 'v26.5.99-draft.bad'),
  release(4, 'v26.5.98-draft.20260528103712'),
  release(5, 'v26.5.99-draft.20260528111111', { draft: false }),
];

const cleanupAttemptId = `sha256:${'a'.repeat(64)}`;
const canonicalRepo = 'gaofeng21cn/one-person-lab-app';
const orphanRelease = release(362629121, 'v26.7.31', {
  target_commitish: '3'.repeat(40),
  updated_at: '2026-07-30T18:19:53Z',
  published_at: null,
  assets: [],
});

function orphanArgs(summaryPath: string, execute = false) {
  const args = [
    '--version', '26.7.31',
    '--repo', canonicalRepo,
    '--summary-path', summaryPath,
    execute ? '--request-exact-orphan-delete' : '--inspect-exact-orphan',
    '--expected-release-id', String(orphanRelease.id),
    '--expected-tag', orphanRelease.tag_name,
    '--expected-target-commitish', String(orphanRelease.target_commitish),
    '--expected-updated-at', String(orphanRelease.updated_at),
  ];
  if (execute) {
    const operationId = `sha256:${crypto.createHash('sha256').update(JSON.stringify({
      schema: 'opl_exact_orphan_draft_cleanup_operation.v1',
      repository: canonicalRepo,
      release_id: orphanRelease.id,
      tag: orphanRelease.tag_name,
      target_commitish: orphanRelease.target_commitish,
      updated_at: orphanRelease.updated_at,
    })).digest('hex')}`;
    args.push('--operation-id', operationId);
  }
  return args;
}

function writeBrokerAcceptanceTrace(filePath: string, attemptId = cleanupAttemptId) {
  fs.writeFileSync(filePath, `${JSON.stringify({
    schema: 'opl_app_release_mutation_acceptance_receipt.v1',
    status: 'accepted',
    lease: {
      attempt_id: attemptId,
      allowed_mutations: ['release_draft_cleanup'],
    },
    signature: {
      algorithm: 'Ed25519',
      key_id: 'opl-release-broker-primary',
      value_base64: Buffer.from('trace-only-signature').toString('base64'),
    },
  }, null, 2)}\n`);
}

test('draft cleanup dry-run lists only matching draft/readiness candidates', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-draft-cleanup-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const logPath = path.join(tempRoot, 'gh.log');

  const result = runCleanup(['--version', '26.5.99', '--repo', 'owner/repo', '--summary-path', summaryPath], fakeGhEnv(binDir, logPath, {
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({ tagName: 'v26.5.99', isDraft: false, isPrerelease: false }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
  }));

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(logPath), false, 'dry-run must not delete remote releases');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'dry_run');
  assert.equal(summary.schema, 'opl_release_draft_candidate_cleanup.v2');
  assert.equal(summary.execute, false);
  assert.equal(summary.execute_requested, false);
  assert.equal(summary.execute_request_source, 'implicit_dry_run');
  assert.equal(summary.deletion_performed, false);
  assert.equal(summary.mutation_authority.release_attempt_id_required, true);
  assert.equal(summary.mutation_authority.broker_acceptance_receipt_required, true);
  assert.equal(summary.mutation_authority.authorization_verified, false);
  assert.equal(summary.mutation_authority.broker_acceptance_receipt.trace_validation, 'not_requested');
  assert.deepEqual(
    summary.candidates.map((candidate: { tag_name: string }) => candidate.tag_name),
    ['v26.5.99-draft.20260528103712', 'v26.5.99-readiness.20260528040857'],
  );
  assert.deepEqual(summary.deleted_tags, []);
});

test('exact final-tag orphan cleanup deletes only the CAS-bound empty unpublished draft', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-exact-orphan-cleanup-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const logPath = path.join(tempRoot, 'gh.log');
  const statePath = path.join(tempRoot, 'remote-state');
  fs.writeFileSync(statePath, 'present');
  const env = fakeGhEnv(binDir, logPath, {
    FAKE_EXACT_RELEASE_JSON: JSON.stringify(orphanRelease),
    FAKE_MATCHING_TAG_REFS_JSON: JSON.stringify([
      { ref: 'refs/tags/v26.7.31-r4', object: { sha: '4'.repeat(40) } },
      { ref: 'refs/tags/v26.7.31-nightly', object: { sha: '5'.repeat(40) } },
    ]),
    FAKE_GH_STATE_FILE: statePath,
  });

  const inspect = runCleanup(orphanArgs(summaryPath), env);
  assert.equal(inspect.status, 0, inspect.stderr || inspect.stdout);
  const dryRun = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(dryRun.status, 'dry_run');
  assert.equal(dryRun.deletion_performed, false);
  assert.match(dryRun.operation_id, /^sha256:[0-9a-f]{64}$/);
  assert.equal(fs.existsSync(logPath), false);

  const execute = runCleanup(orphanArgs(summaryPath, true), env);
  assert.equal(execute.status, 0, execute.stderr || execute.stdout);
  const receipt = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(receipt.status, 'deleted');
  assert.equal(receipt.deletion_performed, true);
  assert.equal(receipt.after.release, null);
  assert.equal(receipt.retry_disposition, 'terminal_no_retry');
  const mutations = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  assert.equal(mutations.length, 1);
  assert.match(mutations[0], /repos\/gaofeng21cn\/one-person-lab-app\/releases\/362629121/);
});

test('exact orphan cleanup reconciles an unknown accepted deletion without retrying', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-exact-orphan-unknown-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const logPath = path.join(tempRoot, 'gh.log');
  const statePath = path.join(tempRoot, 'remote-state');
  fs.writeFileSync(statePath, 'present');
  const result = runCleanup(orphanArgs(summaryPath, true), fakeGhEnv(binDir, logPath, {
    FAKE_EXACT_RELEASE_JSON: JSON.stringify(orphanRelease),
    FAKE_MATCHING_TAG_REFS_JSON: '[]',
    FAKE_GH_STATE_FILE: statePath,
    FAKE_DELETE_OUTCOME: 'unknown_deleted',
  }));

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const receipt = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(receipt.status, 'deleted_after_unknown_reconcile');
  assert.equal(receipt.mutation_accepted, false);
  assert.equal(receipt.deletion_performed, true);
  assert.equal(fs.readFileSync(logPath, 'utf8').trim().split('\n').length, 1);
});

test('exact orphan cleanup rejects asset or tag drift before any mutation', () => {
  for (const fixture of [
    { release: { ...orphanRelease, assets: [{ name: 'unexpected.dmg', size: 1 }] }, refs: [] },
    { release: orphanRelease, refs: [{ ref: 'refs/tags/v26.7.31', object: { sha: '3'.repeat(40) } }] },
  ]) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-exact-orphan-drift-'));
    const binDir = writeFakeGh(tempRoot);
    const summaryPath = path.join(tempRoot, 'summary.json');
    const logPath = path.join(tempRoot, 'gh.log');
    const result = runCleanup(orphanArgs(summaryPath, true), fakeGhEnv(binDir, logPath, {
      FAKE_EXACT_RELEASE_JSON: JSON.stringify(fixture.release),
      FAKE_MATCHING_TAG_REFS_JSON: JSON.stringify(fixture.refs),
    }));
    assert.notEqual(result.status, 0);
    assert.equal(fs.existsSync(logPath), false);
  }
});

test('draft cleanup execution request requires an independent attempt and acceptance receipt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-draft-cleanup-execute-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const logPath = path.join(tempRoot, 'gh.log');

  const result = runCleanup([
    '--version',
    '26.5.99',
    '--repo',
    'owner/repo',
    '--summary-path',
    summaryPath,
    '--request-brokered-execute',
  ], fakeGhEnv(binDir, logPath, {
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({ tagName: 'v26.5.99', isDraft: false, isPrerelease: false }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
  }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires --release-attempt-id and --broker-acceptance-receipt/);
  assert.equal(fs.existsSync(logPath), false, 'blocked cleanup request must not mutate a release or tag');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.schema, 'opl_release_draft_candidate_cleanup.v2');
  assert.equal(summary.status, 'broker_authorization_required');
  assert.equal(summary.execute_requested, true);
  assert.equal(summary.execute_request_source, 'request_brokered_execute');
  assert.equal(summary.execute, false);
  assert.equal(summary.deletion_performed, false);
  assert.deepEqual(summary.deleted_tags, []);
  assert.equal(summary.mutation_authority.required, 'independent_isolated_release_mutation_broker');
  assert.equal(summary.mutation_authority.required_mutation, 'release_draft_cleanup');
  assert.equal(summary.mutation_authority.broker_mutation_available, false);
  assert.equal(summary.mutation_authority.release_attempt_id_required, true);
  assert.equal(summary.mutation_authority.broker_acceptance_receipt_required, true);
  assert.equal(summary.mutation_authority.requested_release_attempt_id, null);
  assert.equal(summary.mutation_authority.broker_acceptance_receipt.trace_validation, 'missing');
  assert.equal(summary.mutation_authority.authorization_verified, false);
  assert.equal(summary.mutation_authority.direct_github_release_delete_allowed, false);
  assert.equal(summary.mutation_authority.direct_tag_cleanup_allowed, false);
  assert.equal(summary.blocker.code, 'brokered_release_draft_cleanup_authorization_required');
  assert.deepEqual(summary.blocker.details, ['release_attempt_id', 'broker_acceptance_receipt']);
});

test('legacy execute flag cannot bypass the brokered cleanup boundary', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-draft-cleanup-legacy-execute-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const logPath = path.join(tempRoot, 'gh.log');

  const result = runCleanup([
    '--version',
    '26.5.99',
    '--repo',
    'owner/repo',
    '--summary-path',
    summaryPath,
    '--execute',
  ], fakeGhEnv(binDir, logPath, {
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({ tagName: 'v26.5.99', isDraft: false, isPrerelease: false }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
  }));

  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(logPath), false);
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'broker_authorization_required');
  assert.equal(summary.execute_requested, true);
  assert.equal(summary.execute_request_source, 'legacy_execute_alias');
  assert.equal(summary.blocker.code, 'brokered_release_draft_cleanup_authorization_required');
  assert.equal(summary.deletion_performed, false);
});

test('draft cleanup records a matching broker trace but remains blocked until the cleanup mutation is provisioned', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-draft-cleanup-broker-trace-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const receiptPath = path.join(tempRoot, 'acceptance.json');
  const logPath = path.join(tempRoot, 'gh.log');
  writeBrokerAcceptanceTrace(receiptPath);

  const result = runCleanup([
    '--version', '26.5.99',
    '--repo', 'owner/repo',
    '--summary-path', summaryPath,
    '--request-brokered-execute',
    '--release-attempt-id', cleanupAttemptId,
    '--broker-acceptance-receipt', receiptPath,
  ], fakeGhEnv(binDir, logPath, {
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({ tagName: 'v26.5.99', isDraft: false, isPrerelease: false }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
  }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /separately signed broker mutation that is not provisioned/);
  assert.equal(fs.existsSync(logPath), false, 'an unverified trace must never authorize deletion');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'brokered_cleanup_unavailable');
  assert.equal(summary.execute, false);
  assert.equal(summary.deletion_performed, false);
  assert.equal(summary.mutation_authority.requested_release_attempt_id, cleanupAttemptId);
  assert.equal(summary.mutation_authority.broker_acceptance_receipt.path, receiptPath);
  assert.match(summary.mutation_authority.broker_acceptance_receipt.sha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(summary.mutation_authority.broker_acceptance_receipt.lease_attempt_id, cleanupAttemptId);
  assert.deepEqual(summary.mutation_authority.broker_acceptance_receipt.allowed_mutations, ['release_draft_cleanup']);
  assert.equal(
    summary.mutation_authority.broker_acceptance_receipt.trace_validation,
    'structurally_bound_but_not_authorized',
  );
  assert.equal(summary.mutation_authority.authorization_verified, false);
  assert.equal(summary.mutation_authority.cryptographic_verifier, null);
  assert.equal(summary.blocker.code, 'brokered_release_draft_cleanup_unavailable');
});

test('draft cleanup rejects a broker receipt bound to a different attempt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-draft-cleanup-broker-mismatch-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const receiptPath = path.join(tempRoot, 'acceptance.json');
  const logPath = path.join(tempRoot, 'gh.log');
  writeBrokerAcceptanceTrace(receiptPath, `sha256:${'b'.repeat(64)}`);

  const result = runCleanup([
    '--version', '26.5.99',
    '--repo', 'owner/repo',
    '--summary-path', summaryPath,
    '--request-brokered-execute',
    '--release-attempt-id', cleanupAttemptId,
    '--broker-acceptance-receipt', receiptPath,
  ], fakeGhEnv(binDir, logPath, {
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({ tagName: 'v26.5.99', isDraft: false, isPrerelease: false }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
  }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /attempt id does not match/);
  assert.equal(fs.existsSync(logPath), false);
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'broker_authorization_invalid');
  assert.equal(summary.mutation_authority.broker_acceptance_receipt.trace_validation, 'invalid');
  assert.equal(summary.blocker.code, 'brokered_release_draft_cleanup_authorization_invalid');
  assert.equal(summary.deletion_performed, false);
});

test('draft cleanup refuses to run unless the stable release is published', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-draft-cleanup-fail-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const logPath = path.join(tempRoot, 'gh.log');

  const result = runCleanup(['--version', '26.5.99', '--repo', 'owner/repo', '--summary-path', summaryPath], fakeGhEnv(binDir, logPath, {
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({ tagName: 'v26.5.99', isDraft: false, isPrerelease: true }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
  }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be a published stable release/);
  assert.equal(fs.existsSync(summaryPath), false);
  assert.equal(fs.existsSync(logPath), false);
});
