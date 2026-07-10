import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export function writeJson(filePath: string, payload: unknown) {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

export function createGitCheckout(label: string, root = fs.mkdtempSync(path.join(os.tmpdir(), label))) {
  fs.mkdirSync(root, { recursive: true });
  runGit(root, ['init', '-b', 'main']);
  runGit(root, ['config', 'user.email', 'release-test@example.com']);
  runGit(root, ['config', 'user.name', 'Release Test']);
  writeFile(path.join(root, 'README.md'), `${label}\n`);
  runGit(root, ['add', 'README.md']);
  runGit(root, ['commit', '-m', 'Initial test commit']);
  return { root, head: runGit(root, ['rev-parse', 'HEAD']) };
}

export function releaseReadinessFixture(version: string, fields: Record<string, unknown> = {}) {
  return {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version,
    failed_required_gates: [],
    warnings: [],
    ...fields,
  };
}

export function releaseCandidateFixture(version: string, fields: Record<string, unknown> = {}) {
  return {
    schema: 'opl_release_candidate_record.v1',
    status: 'ready_to_promote',
    version,
    blocked_reasons: [],
    required_gate_failures: [],
    ...fields,
  };
}
