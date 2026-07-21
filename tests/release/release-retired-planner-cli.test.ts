import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '../..');

function runRetiredScript(script: string, args: string[] = []) {
  return spawnSync(process.execPath, ['--experimental-strip-types', script, ...args], {
    cwd: appRoot,
    encoding: 'utf8',
  });
}

test('retired App planners and preflight expose no direct authority entrypoint', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['release:preflight'], undefined);
  assert.equal(packageJson.scripts['release:cohort-plan'], undefined);
  assert.equal(packageJson.scripts['release:cohort-lock'], undefined);

  const cases = [
    ['scripts/validate-release-preflight.ts', 'opl_app_retired_release_preflight.v1'],
    ['scripts/plan-release-cohort.ts', 'opl_app_retired_release_cohort_plan.v1'],
    ['scripts/release-cohort-lock.ts', 'opl_app_retired_release_cohort_lock.v1'],
  ] as const;
  for (const [script, schema] of cases) {
    const result = runRetiredScript(script);
    assert.equal(result.status, 2, `${script}: ${result.stderr || result.stdout}`);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.schema, schema);
    assert.equal(receipt.status, 'retired_fail_closed');
    assert.equal(receipt.authoritative_for_new_release, false);
    assert.equal(receipt.mutation_authorized, false);
  }
});

test('retired planner CLIs never write caller-selected outputs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-retired-release-planners-'));
  for (const script of [
    'scripts/validate-release-preflight.ts',
    'scripts/plan-release-cohort.ts',
    'scripts/release-cohort-lock.ts',
  ]) {
    const output = path.join(root, `${path.basename(script)}.json`);
    const markdown = `${output}.md`;
    const result = runRetiredScript(script, ['--output', output, '--markdown', markdown]);
    assert.equal(result.status, 2, script);
    assert.equal(fs.existsSync(output), false, script);
    assert.equal(fs.existsSync(markdown), false, script);
  }
});
