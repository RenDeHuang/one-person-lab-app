import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot } from './release-readiness/helpers.ts';
import { fakeGhEnv, writeFakeGh } from './fake-gh-fixture.ts';

function runInspection(args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/inspect-release-draft-candidates.ts', ...args],
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

test('draft inspection lists only matching draft and readiness candidates', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-draft-inspection-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const logPath = path.join(tempRoot, 'gh.log');

  const result = runInspection([
    '--version', '26.5.99',
    '--repo', 'owner/repo',
    '--summary-path', summaryPath,
  ], fakeGhEnv(binDir, logPath, {
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({
      tagName: 'v26.5.99',
      name: 'One Person Lab 26.5.99',
      isDraft: false,
      isPrerelease: false,
      publishedAt: '2026-05-28T11:00:00Z',
    }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
  }));

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(logPath), false, 'read-only inspection must not mutate GitHub');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.schema, 'opl_release_draft_candidate_inspection.v1');
  assert.equal(summary.status, 'inspected');
  assert.equal(summary.lifecycle, 'historical_read_only');
  assert.equal(summary.mutation_authorized, false);
  assert.equal(summary.deletion_performed, false);
  assert.deepEqual(
    summary.candidates.map((candidate: { tag_name: string }) => candidate.tag_name),
    ['v26.5.99-draft.20260528103712', 'v26.5.99-readiness.20260528040857'],
  );
  assert.equal(summary.candidates[0].asset_size_bytes, 800);
});

test('draft inspection rejects every retired mutation option before GitHub access', () => {
  for (const option of [
    '--execute',
    '--request-brokered-execute',
    '--request-exact-orphan-delete',
    '--broker-acceptance-receipt',
  ]) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-draft-inspection-option-'));
    const binDir = writeFakeGh(tempRoot);
    const logPath = path.join(tempRoot, 'gh.log');
    const args = ['--version', '26.5.99', option];
    if (option === '--broker-acceptance-receipt') args.push(path.join(tempRoot, 'receipt.json'));
    const result = runInspection(args, fakeGhEnv(binDir, logPath));
    assert.notEqual(result.status, 0, option);
    assert.match(result.stderr, /Unknown option/);
    assert.equal(fs.existsSync(logPath), false, option);
  }
});

test('draft inspection requires a published Stable release', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-draft-inspection-stable-'));
  const binDir = writeFakeGh(tempRoot);
  const logPath = path.join(tempRoot, 'gh.log');
  const result = runInspection([
    '--version', '26.5.99',
    '--repo', 'owner/repo',
  ], fakeGhEnv(binDir, logPath, {
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({
      tagName: 'v26.5.99',
      isDraft: false,
      isPrerelease: true,
    }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
  }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be a published stable release/);
  assert.equal(fs.existsSync(logPath), false);
});
