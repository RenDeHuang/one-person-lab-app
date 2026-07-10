import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot, readJson } from './release-readiness/helpers.ts';

function writeFakeGh(binDir: string, body: string): string {
  fs.mkdirSync(binDir, { recursive: true });
  const ghPath = path.join(binDir, 'gh');
  fs.writeFileSync(ghPath, `#!/usr/bin/env node\n${body}\n`);
  fs.chmodSync(ghPath, 0o755);
  return ghPath;
}

function runVerifier(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/verify-release-attestations.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env, ...env },
    },
  );
}

test('release attestation verifier writes a passed summary for verified assets and OCI refs', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-attestation-verify-pass-'));
  const binDir = path.join(tempRoot, 'bin');
  const logPath = path.join(tempRoot, 'gh-args.jsonl');
  writeFakeGh(binDir, `
const fs = require('node:fs');
const logPath = ${JSON.stringify(logPath)};
fs.appendFileSync(logPath, JSON.stringify(process.argv.slice(2)) + '\\n');
console.log('verified ' + process.argv[4]);
`);
  const output = path.join(tempRoot, 'attestation-verification-summary.json');
  const assetPath = path.join(tempRoot, 'One-Person-Lab-26.7.8-arm64.dmg');
  const ociSubject = 'oci://ghcr.io/gaofeng21cn/one-person-lab-webui@sha256:abc123';
  const result = runVerifier([
    '--version',
    '26.7.8',
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--asset',
    assetPath,
    '--oci',
    ociSubject,
    '--output',
    output,
  ], {
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = readJson(output);
  assert.equal(summary.schema, 'opl_release_attestation_verification.v1');
  assert.equal(summary.status, 'passed');
  assert.equal(summary.role, 'build_integrity_evidence');
  assert.equal(summary.verified_assets.length, 2);
  assert.equal(summary.failed_assets.length, 0);
  assert.match(summary.command_results[0].command.join(' '), /gh attestation verify/);
  assert.match(summary.rule, /not release readiness evidence/);
  const calls = fs.readFileSync(logPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(calls, [
    ['attestation', 'verify', assetPath, '--repo', 'gaofeng21cn/one-person-lab-app'],
    ['attestation', 'verify', ociSubject, '--repo', 'gaofeng21cn/one-person-lab-app'],
  ]);
});

test('release attestation verifier writes a failed summary when gh verification fails', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-attestation-verify-fail-'));
  const binDir = path.join(tempRoot, 'bin');
  writeFakeGh(binDir, `
console.error('no attestation found');
process.exit(42);
`);
  const output = path.join(tempRoot, 'attestation-verification-summary.json');
  const result = runVerifier([
    '--version',
    '26.7.8',
    '--asset',
    path.join(tempRoot, 'One-Person-Lab-26.7.8-arm64.dmg'),
    '--output',
    output,
  ], {
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
  });

  assert.equal(result.status, 1);
  const summary = readJson(output);
  assert.equal(summary.status, 'failed');
  assert.equal(summary.verified_assets.length, 0);
  assert.equal(summary.failed_assets.length, 1);
  assert.equal(summary.failed_assets[0].exit_status, 42);
  assert.match(summary.failed_assets[0].stderr, /no attestation found/);
});
