import assert from 'node:assert/strict';
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
  assert.equal(summary.execute, false);
  assert.deepEqual(
    summary.candidates.map((candidate: { tag_name: string }) => candidate.tag_name),
    ['v26.5.99-draft.20260528103712', 'v26.5.99-readiness.20260528040857'],
  );
  assert.deepEqual(summary.deleted_tags, []);
});

test('draft cleanup execute deletes candidates with matching tags and cleanup-tag', () => {
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
    '--execute',
  ], fakeGhEnv(binDir, logPath, {
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({ tagName: 'v26.5.99', isDraft: false, isPrerelease: false }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
  }));

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const deleted = fs.readFileSync(logPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(deleted, [
    ['release', 'delete', 'v26.5.99-draft.20260528103712', '--repo', 'owner/repo', '--cleanup-tag', '--yes'],
    ['release', 'delete', 'v26.5.99-readiness.20260528040857', '--repo', 'owner/repo', '--cleanup-tag', '--yes'],
  ]);
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'deleted');
  assert.deepEqual(summary.deleted_tags, [
    'v26.5.99-draft.20260528103712',
    'v26.5.99-readiness.20260528040857',
  ]);
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
