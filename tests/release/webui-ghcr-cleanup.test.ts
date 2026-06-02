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
if (args[0] === 'api' && args.includes('--jq')) {
  const versions = JSON.parse(process.env.FAKE_PACKAGE_VERSIONS_JSON || '[]');
  for (const version of versions) {
    process.stdout.write(JSON.stringify(version));
    process.stdout.write('\\n');
  }
  process.exit(0);
}
if (args[0] === 'api' && args.includes('-X') && args.includes('DELETE')) {
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
    ['--experimental-strip-types', 'scripts/cleanup-webui-ghcr-versions.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    },
  );
}

const versions = [
  {
    id: 101,
    updated_at: '2026-06-02T01:11:19Z',
    metadata: { container: { tags: ['nightly', '26.6.2-nightly'] } },
  },
  {
    id: 102,
    updated_at: '2026-06-01T01:11:19Z',
    metadata: { container: { tags: ['26.6.1-nightly'] } },
  },
  {
    id: 103,
    updated_at: '2026-05-31T01:11:19Z',
    metadata: { container: { tags: ['26.5.31-nightly'] } },
  },
  {
    id: 104,
    updated_at: '2026-05-30T01:11:19Z',
    metadata: { container: { tags: ['26.5.30-nightly'] } },
  },
  {
    id: 105,
    updated_at: '2026-05-29T01:11:19Z',
    metadata: { container: { tags: ['26.5.29-nightly'] } },
  },
  {
    id: 106,
    updated_at: '2026-05-28T01:11:19Z',
    metadata: { container: { tags: ['26.5.28-nightly'] } },
  },
  {
    id: 107,
    updated_at: '2026-05-27T01:11:19Z',
    metadata: { container: { tags: ['26.5.27-nightly'] } },
  },
  {
    id: 108,
    updated_at: '2026-05-26T01:11:19Z',
    metadata: { container: { tags: ['26.5.26-nightly'] } },
  },
  {
    id: 109,
    updated_at: '2026-05-25T01:11:19Z',
    metadata: { container: { tags: ['26.5.25-nightly'] } },
  },
  {
    id: 201,
    updated_at: '2026-06-01T00:00:00Z',
    metadata: { container: { tags: ['latest', 'stable', '26.6.1'] } },
  },
  {
    id: 202,
    updated_at: '2026-05-25T00:00:00Z',
    metadata: { container: { tags: ['26.5.25'] } },
  },
  {
    id: 203,
    updated_at: '2026-05-24T00:00:00Z',
    metadata: { container: { tags: ['26.5.24'] } },
  },
  {
    id: 204,
    updated_at: '2026-05-23T00:00:00Z',
    metadata: { container: { tags: ['26.5.23'] } },
  },
  {
    id: 205,
    updated_at: '2026-05-22T00:00:00Z',
    metadata: { container: { tags: ['26.5.22'] } },
  },
  {
    id: 206,
    updated_at: '2026-05-21T00:00:00Z',
    metadata: { container: { tags: ['26.5.21'] } },
  },
];

test('WebUI GHCR cleanup dry-run keeps protected tags and recent retention windows', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-ghcr-cleanup-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const logPath = path.join(tempRoot, 'gh.log');

  const result = runCleanup(['--owner', 'owner', '--summary-path', summaryPath, '--rollback-tag', '26.5.21'], {
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    FAKE_PACKAGE_VERSIONS_JSON: JSON.stringify(versions),
    FAKE_GH_LOG: logPath,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(logPath), false, 'dry-run must not delete package versions');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'dry_run');
  assert.equal(summary.retention_policy.cleanup_execution_mode, 'dry_run_first_explicit_execute_required');
  assert.deepEqual(
    summary.candidates.map((candidate: { id: number }) => candidate.id),
    [109],
  );
  assert.ok(summary.protected_version_ids.includes(101));
  assert.ok(summary.protected_version_ids.includes(201));
  assert.ok(summary.protected_version_ids.includes(206));
});

test('WebUI GHCR cleanup execute deletes only dry-run candidate version ids', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-ghcr-cleanup-execute-'));
  const binDir = writeFakeGh(tempRoot);
  const summaryPath = path.join(tempRoot, 'summary.json');
  const logPath = path.join(tempRoot, 'gh.log');

  const result = runCleanup(['--owner', 'owner', '--summary-path', summaryPath, '--rollback-tag', '26.5.21', '--execute'], {
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    FAKE_PACKAGE_VERSIONS_JSON: JSON.stringify(versions),
    FAKE_GH_LOG: logPath,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const deleted = fs.readFileSync(logPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(deleted, [
    [
      'api',
      '-X',
      'DELETE',
      '-H',
      'X-GitHub-Api-Version: 2022-11-28',
      '/users/owner/packages/container/one-person-lab-webui/versions/109',
    ],
  ]);
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'deleted');
  assert.deepEqual(summary.deleted_version_ids, [109]);
});
