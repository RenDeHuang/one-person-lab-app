import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

const appRoot = path.resolve(import.meta.dirname, '../..');
const workflowPath = path.join(
  appRoot,
  '.github',
  'workflows',
  'release-post-publication-certification.yml',
);

test('optional certification is an automatic read-only post-publication follower', () => {
  const source = fs.readFileSync(workflowPath, 'utf8');
  const workflow = parseYaml(source) as Record<string, any>;
  assert.deepEqual(Object.keys(workflow.on), ['workflow_run']);
  assert.deepEqual(workflow.on.workflow_run.workflows, ['OPL Stable Release Bundle']);
  assert.deepEqual(workflow.on.workflow_run.types, ['completed']);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), [
    'resolve-standard',
    'write-standard-receipts',
    'resolve-full',
    'write-full-receipt',
  ]);
  assert.equal(workflow.jobs['resolve-standard'].needs, undefined);
  assert.equal(workflow.jobs['resolve-full'].needs, undefined);
  assert.deepEqual(workflow.jobs['write-standard-receipts'].needs, ['resolve-standard']);
  assert.deepEqual(workflow.jobs['write-full-receipt'].needs, ['resolve-full']);
  for (const job of Object.values(workflow.jobs) as Array<Record<string, unknown>>) {
    assert.equal(job['runs-on'], 'ubuntu-latest');
    assert.deepEqual(job.permissions, { contents: 'read', actions: 'read' });
  }
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.match(
    String(workflow.concurrency.group),
    /opl-post-publication-certification-\$\{\{ github\.event\.workflow_run\.id \}\}/,
  );
  assert.match(source, /\.path == "\.github\/workflows\/release-stable\.yml"/);
  assert.match(source, /opl-release-activation-\$\{SOURCE_RUN_ID\}/);
  assert.match(source, /opl-release-full-published-\$\{SOURCE_RUN_ID\}/);
  assert.match(source, /public-component-manifest\.json/);
  assert.match(source, /write-optional-certification-receipt\.ts/);
  assert.match(source, /--status not_run/);
  assert.match(source, /--reason-code not_requested/);
  assert.match(source, /physical_job_dispatched:false/);
  assert.doesNotMatch(
    source,
    /workflow_dispatch:|contents: write|packages: write|gh workflow run|gh run (?:rerun|cancel)|gh release (?:create|edit|upload|delete)|opl release (?:build|publish|reconcile)|codesign|notarize|opl-first-run-vm\.yml/,
  );
});

test('not_run dispatcher binds Standard and optional Full identities without fabricating unavailable', () => {
  const source = fs.readFileSync(workflowPath, 'utf8');
  for (const output of [
    'standard-dmg-clean-machine.json',
    'homebrew-standard-clean-machine.json',
    'one-shot-installer-clean-machine.json',
    'full-dmg-clean-machine.json',
  ]) {
    assert.match(source, new RegExp(output.replaceAll('.', '\\.')));
  }
  assert.match(source, /releases\/tags\/\$tag/);
  assert.match(source, /component_manifest_digest/);
  assert.match(source, /artifact_digest/);
  assert.match(source, /app_sha/);
  assert.match(source, /shell_sha/);
  assert.match(source, /framework_sha/);
  assert.doesNotMatch(source, /--status unavailable|runner_offline|queued_workflow|github_auth_failure|network_failure/);
});
