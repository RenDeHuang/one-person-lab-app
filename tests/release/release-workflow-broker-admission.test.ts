import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import { stableReleaseActionPaths } from '../../scripts/validate-release-boundary/text-check-runner.ts';

const workflowRoot = path.join(process.cwd(), '.github', 'workflows');
const readWorkflow = (name: string) => fs.readFileSync(path.join(workflowRoot, name), 'utf8');
const parseWorkflow = (name: string) => parseYaml(readWorkflow(name));

test('live Stable authority validates the durable controller receipt without an OIDC service dependency', () => {
  const stable = readWorkflow('release-stable.yml');
  const bundle = readWorkflow('_release-bundle.yml');

  assert.match(stable, /workflow_dispatch:/);
  assert.match(stable, /uses: \.\/\.github\/workflows\/_release-bundle\.yml/);
  assert.match(stable, /run-name: OPL Stable Release Bundle v\$\{\{ inputs\.version \}\} attempt=\$\{\{ inputs\.release_attempt_id \}\}/);
  assert.match(bundle, /test "\$GITHUB_RUN_ATTEMPT" = 1/);
  assert.match(bundle, /verify-release-broker-acceptance\.ts[\s\S]*--mode admin-one-shot/);
  assert.doesNotMatch(`${stable}\n${bundle}`, /--mode lookup|ACTION[S_]+ID_TOKEN|id-token: write/i);
  assert.doesNotMatch(`${stable}\n${bundle}`, /gh run rerun|gh run cancel|--clobber/);
});

test('legacy broker workflows reject every call with read-only permissions', () => {
  for (const name of [
    'desktop-release.yml',
    'desktop-release-promote.yml',
    'desktop-release-full-addon.yml',
    'desktop-release-cleanup-drafts.yml',
  ]) {
    const workflow = parseWorkflow(name);
    assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.match(readWorkflow(name), /exit 1/);
    assert.doesNotMatch(readWorkflow(name), /workflow_dispatch:|contents: write|id-token: write/);
  }
});

test('Stable dispatch is serialized and cannot cancel or replace an in-flight Bundle', () => {
  const workflow = parseWorkflow('release-stable.yml');
  assert.equal(workflow.concurrency.group, 'opl-stable-release-bundle-${{ inputs.version }}');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs).sort(), [
    'framework_ref',
    'include_full',
    'pre_api_admission_receipt_base64',
    'release_attempt_id',
    'release_mutation_payload_sha256',
    'shell_ref',
    'version',
  ]);
  assert.equal(workflow.jobs.release.with.app_ref, '${{ github.sha }}');
  assert.equal(workflow.jobs.release.with.shell_ref, '${{ inputs.shell_ref }}');
  assert.equal(workflow.jobs.release.with.framework_ref, '${{ inputs.framework_ref }}');
  assert.equal(workflow.jobs.release.with.release_attempt_id, '${{ inputs.release_attempt_id }}');
  assert.equal(workflow.jobs.release.secrets, 'inherit');
});

test('Stable freezes exact controller refs and the reusable ABI rejects movable source refs', () => {
  const workflow = parseWorkflow('_release-bundle.yml');
  const steps = workflow.jobs['freeze-inputs'].steps as Array<Record<string, any>>;
  const shell = steps.find((step) => step.name === 'Checkout frozen Shell authority');
  const framework = steps.find((step) => step.name === 'Checkout frozen Framework authority');
  assert.equal(shell?.with.ref, "${{ inputs.shell_ref || 'main' }}");
  assert.equal(framework?.with.ref, "${{ inputs.framework_ref || 'main' }}");
  assert.match(readWorkflow('_release-bundle.yml'), /Stable requires an exact frozen Shell SHA/);
  assert.match(readWorkflow('_release-bundle.yml'), /Stable requires an exact frozen Framework SHA/);
  assert.match(readWorkflow('_release-bundle.yml'), /--expected-workflow release-stable\.yml/);
});

test('reusable VM call edges remain read-only', () => {
  const jobs = parseWorkflow('_release-bundle.yml').jobs;
  for (const jobId of [
    'standard-qualification',
    'updater-upgrade-qualification',
    'homebrew-standard-vm',
    'full-qualification',
    'homebrew-full-vm',
  ]) {
    const job = jobs[jobId];
    const permissions = job.permissions ?? parseWorkflow('_release-bundle.yml').permissions;
    assert.equal(permissions.contents, 'read', jobId);
    assert.equal(permissions.actions, 'read', jobId);
    assert.equal(job.steps, undefined, `${jobId} must stay a step-free reusable call edge`);
  }
});

test('reusable first-run VM does not request an OIDC permission the caller cannot grant', () => {
  const vm = readWorkflow('opl-first-run-vm.yml');
  assert.doesNotMatch(vm, /id-token:\s*write/);
  const document = parseWorkflow('opl-first-run-vm.yml');
  const validatePermissions = document.jobs['validate-vm-inputs'].permissions;
  assert.deepEqual(validatePermissions, { contents: 'read', actions: 'read' });
});

test('the complete Stable action DAG pins external Actions to immutable commits', () => {
  for (const relativePath of stableReleaseActionPaths) {
    const document = parseYaml(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8'));
    const steps = relativePath.includes('/actions/')
      ? document.runs.steps
      : Object.values(document.jobs).flatMap((job: any) => job.steps ?? []);
    for (const step of steps) {
      if (typeof step.uses !== 'string' || step.uses.startsWith('./')) continue;
      assert.match(step.uses, /@[0-9a-f]{40}$/, `${relativePath}: ${step.uses}`);
    }
  }
});
