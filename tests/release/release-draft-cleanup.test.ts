import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function writeFakeGh(tempRoot: string) {
  const binDir = path.join(tempRoot, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const ghPath = path.join(binDir, 'gh');
  fs.writeFileSync(
    ghPath,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'release' && args[1] === 'view') {
  if (!process.env.FAKE_STABLE_RELEASE_JSON) process.exit(1);
  process.stdout.write(process.env.FAKE_STABLE_RELEASE_JSON);
  process.stdout.write('\\n');
  process.exit(0);
}
if (args[0] === 'api') {
  const releases = JSON.parse(process.env.FAKE_RELEASES_JSON || '[]');
  for (const release of releases) {
    process.stdout.write(JSON.stringify(release));
    process.stdout.write('\\n');
  }
  process.exit(0);
}
if (args[0] === 'release' && args[1] === 'delete') {
  fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
  process.exit(0);
}
console.error('unexpected gh args: ' + JSON.stringify(args));
process.exit(2);
`,
    'utf8',
  );
  fs.chmodSync(ghPath, 0o755);
  return binDir;
}

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

const releases = [
  {
    id: 1,
    tag_name: 'v26.5.99-draft.20260528103712',
    name: 'One Person Lab 26.5.99-draft.20260528103712',
    draft: true,
    prerelease: false,
    created_at: '2026-05-28T10:33:30Z',
    html_url: 'https://example.test/draft',
    assets: [
      { name: 'One-Person-Lab-26.5.99-draft.20260528103712-mac-arm64.dmg', size: 271 },
      { name: 'One-Person-Lab-Full-26.5.99-draft.20260528103712-mac-arm64.dmg', size: 529 },
    ],
  },
  {
    id: 2,
    tag_name: 'v26.5.99-readiness.20260528040857',
    name: 'One Person Lab 26.5.99-readiness.20260528040857',
    draft: true,
    prerelease: false,
    created_at: '2026-05-28T04:28:32Z',
    html_url: 'https://example.test/readiness',
    assets: [{ name: 'full-package-manifest.json', size: 14 }],
  },
  {
    id: 3,
    tag_name: 'v26.5.99-draft.bad',
    name: 'Malformed draft candidate',
    draft: true,
    prerelease: false,
    created_at: '2026-05-28T04:28:32Z',
    html_url: 'https://example.test/bad',
    assets: [],
  },
  {
    id: 4,
    tag_name: 'v26.5.98-draft.20260528103712',
    name: 'Different version',
    draft: true,
    prerelease: false,
    created_at: '2026-05-28T04:28:32Z',
    html_url: 'https://example.test/other',
    assets: [],
  },
  {
    id: 5,
    tag_name: 'v26.5.99-draft.20260528111111',
    name: 'Published candidate must be preserved',
    draft: false,
    prerelease: false,
    created_at: '2026-05-28T11:11:11Z',
    html_url: 'https://example.test/published',
    assets: [],
  },
];

test('draft cleanup dry-run lists only matching draft/readiness candidates', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-draft-cleanup-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const logPath = path.join(tempRoot, 'gh.log');

  const result = runCleanup(['--version', '26.5.99', '--repo', 'owner/repo', '--summary-path', summaryPath], {
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({ tagName: 'v26.5.99', isDraft: false, isPrerelease: false }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
    FAKE_GH_LOG: logPath,
  });

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
  ], {
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({ tagName: 'v26.5.99', isDraft: false, isPrerelease: false }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
    FAKE_GH_LOG: logPath,
  });

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

  const result = runCleanup(['--version', '26.5.99', '--repo', 'owner/repo', '--summary-path', summaryPath], {
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    FAKE_STABLE_RELEASE_JSON: JSON.stringify({ tagName: 'v26.5.99', isDraft: false, isPrerelease: true }),
    FAKE_RELEASES_JSON: JSON.stringify(releases),
    FAKE_GH_LOG: logPath,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be a published stable release/);
  assert.equal(fs.existsSync(summaryPath), false);
  assert.equal(fs.existsSync(logPath), false);
});
