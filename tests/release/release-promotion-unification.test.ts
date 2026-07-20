import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

const workflowRoot = path.join(process.cwd(), '.github', 'workflows');
const readWorkflow = (name: string) => fs.readFileSync(path.join(workflowRoot, name), 'utf8');
const parseWorkflow = (name: string) => parseYaml(readWorkflow(name));

test('Standard publication, Latest activation, and Full append consume one Bundle digest', () => {
  const workflow = parseWorkflow('_release-bundle.yml');
  const jobs = workflow.jobs;

  assert.deepEqual(jobs['publish-standard-nonlatest'].needs, ['bind-standard', 'freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['remote-digest-verify'].needs, ['publish-standard-nonlatest', 'freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['publish-latest'].needs, [
    'remote-digest-verify',
    'updater-upgrade-qualification',
    'homebrew-standard-readback',
    'freeze',
    'freeze-inputs',
  ]);
  assert.deepEqual(jobs['full-build'].needs, ['publish-latest', 'freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['publish-full'].needs, ['bind-full', 'freeze', 'freeze-inputs']);

  const source = readWorkflow('_release-bundle.yml');
  assert.match(source, /BUNDLE_DIGEST: \$\{\{ needs\.freeze\.outputs\.bundle_digest \}\}/);
  assert.match(source, /opl release publish/);
  assert.match(source, /opl release reconcile/);
  assert.match(source, /opl release status/);
  assert.doesNotMatch(source, /release[_ -]broker|broker[_ -]admission/i);
});

test('Latest waits for exact predecessor upgrade and Standard Homebrew readback', () => {
  const jobs = parseWorkflow('_release-bundle.yml').jobs;
  assert.deepEqual(jobs['updater-upgrade-qualification'].needs, [
    'remote-digest-verify',
    'freeze',
    'freeze-inputs',
  ]);
  assert.deepEqual(jobs['publish-homebrew-standard'].needs, [
    'updater-upgrade-qualification',
    'freeze',
    'freeze-inputs',
  ]);
  assert.deepEqual(jobs['homebrew-standard-vm'].needs, [
    'publish-homebrew-standard',
    'freeze',
    'freeze-inputs',
  ]);
  assert.deepEqual(jobs['homebrew-standard-readback'].needs, [
    'homebrew-standard-vm',
    'publish-homebrew-standard',
    'freeze',
    'freeze-inputs',
  ]);
  assert.match(jobs['publish-latest'].if, /updater-upgrade-qualification\.result == 'success'/);
  assert.match(jobs['publish-latest'].if, /homebrew-standard-readback\.result == 'success'/);
});

test('Full and desktop Stable do not mutate the independent WebUI channel', () => {
  const source = readWorkflow('_release-bundle.yml');
  const fullStart = source.indexOf('  full-build:');
  assert.ok(fullStart >= 0);
  const full = source.slice(fullStart);

  assert.match(full, /Append exact Full bytes only/);
  assert.doesNotMatch(full, /latest-arm64-mac\.yml|github-activate-latest|oras tag|ghcr_image/);
  assert.doesNotMatch(source, /\$\{ghcr_image\}:stable|workflow run desktop-release-full-addon\.yml/);
  assert.equal(fs.existsSync(path.join(workflowRoot, 'webui-ghcr-release.yml')), false);
  assert.equal(fs.existsSync(path.join(workflowRoot, 'homebrew-tap-update.yml')), false);
});

test('only protected Bundle jobs can mutate GitHub Release or Homebrew', () => {
  const workflow = parseWorkflow('_release-bundle.yml');
  const githubWriters = new Set(['publish-standard-nonlatest', 'publish-latest', 'publish-full']);
  for (const [jobId, job] of Object.entries(workflow.jobs) as Array<[string, Record<string, any>]>) {
    const contents = job.permissions?.contents ?? workflow.permissions.contents;
    if (githubWriters.has(jobId)) {
      assert.equal(contents, 'write', jobId);
      assert.equal(job.environment, 'release-stable', jobId);
    } else {
      assert.notEqual(contents, 'write', jobId);
    }
    if (jobId.startsWith('publish-homebrew-')) {
      assert.equal(job.environment, 'release-stable', jobId);
    }
  }
});

test('retired promotion and Full add-on workflows are read-only rejection surfaces', () => {
  for (const name of ['desktop-release-promote.yml', 'desktop-release-full-addon.yml']) {
    const workflow = parseWorkflow(name);
    assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.match(readWorkflow(name), /exit 1/);
    assert.doesNotMatch(readWorkflow(name), /workflow_dispatch:|contents: write|verify-release-broker/);
  }
});

test('VM finalizer skips empty source artifacts and always has safe receipt paths', () => {
  const workflow = readWorkflow('opl-first-run-vm.yml');
  const downloadMarker = '      - name: Download exact source artifact manifest without making it a receipt prerequisite';
  const receiptMarker = '      - name: Write durable typed attempt receipt';
  const downloadStart = workflow.indexOf(downloadMarker);
  const receiptStart = workflow.indexOf(receiptMarker);
  assert.ok(downloadStart >= 0 && receiptStart > downloadStart);
  const download = workflow.slice(downloadStart, workflow.indexOf('\n      - name:', downloadStart + downloadMarker.length));
  const receipt = workflow.slice(receiptStart, workflow.indexOf('\n      - name:', receiptStart + receiptMarker.length));

  assert.match(download, /if: \$\{\{ inputs\.release_artifact_name != '' && inputs\.release_artifact_run_id != '' \}\}/);
  assert.match(download, /run-id: \$\{\{ inputs\.release_artifact_run_id \}\}/);
  assert.match(receipt, /mkdir -p recovered-artifact-manifest recovered-vm-evidence/);
  assert.equal((receipt.match(/-print -quit 2>\/dev\/null \|\| true/g) || []).length, 3);
});
