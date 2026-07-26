import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

const appRoot = path.resolve(import.meta.dirname, '../..');
const workflowPath = path.join(appRoot, '.github', 'workflows', 'release-source-qualification.yml');

test('source qualification is one main-only no-secret self-hosted build and Tart lane', () => {
  const source = fs.readFileSync(workflowPath, 'utf8');
  const workflow = parseYaml(source) as Record<string, any>;
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['qualify']);
  assert.equal(workflow.jobs.qualify.environment, undefined);
  assert.deepEqual(workflow.jobs.qualify.permissions, { contents: 'read', actions: 'read' });
  assert.match(String(workflow.jobs.qualify['runs-on']), /OPL_SOURCE_QUALIFICATION_RUNNER_LABELS/);
  assert.match(source, /test "\$GITHUB_RUN_ATTEMPT" = 1/);
  assert.match(source, /test "\$GITHUB_REF" = refs\/heads\/main/);
  assert.match(source, /repos\/gaofeng21cn\/opl-aion-shell\/commits\/main/);
  assert.match(source, /repos\/gaofeng21cn\/one-person-lab\/commits\/main/);
  assert.match(source, /build_invocation_count: 1/);
  assert.match(source, /tart_vm_invocation_count: 1/);
  assert.match(source, /node scripts\/build-with-builder\.js arm64 --mac --arm64/);
  assert.match(source, /node scripts\/opl-first-run-tart-smoke\.mjs/);
  assert.match(source, /--settings-smoke/);
  assert.match(source, /--assistant-route-smoke/);
  assert.match(source, /--runtime-profile standard/);
  assert.match(source, /source-qualification-receipt\.ts create/);
  assert.match(source, /validate-source-qualification-receipt\.ts/);
  assert.match(source, /name: opl-source-qualification-\$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(source, /secrets\./);
  assert.doesNotMatch(source, /contents: write|packages: write|id-token: write/);
  assert.doesNotMatch(source, /release create|release upload|github-activate-latest|make_latest|brew bump-cask-pr/);
});

test('source qualification uploads evidence without publishing the local diagnostic DMG', () => {
  const workflow = parseYaml(fs.readFileSync(workflowPath, 'utf8')) as Record<string, any>;
  const upload = workflow.jobs.qualify.steps.find(
    (step: Record<string, unknown>) => step.name === 'Upload immutable source qualification evidence',
  );
  const paths = String(upload.with.path);
  assert.match(paths, /source-qualification-receipt\.json/);
  assert.match(paths, /opl-build-cohort\.json/);
  assert.match(paths, /tart-smoke-summary\.json/);
  assert.doesNotMatch(paths, /\.dmg/);
});
