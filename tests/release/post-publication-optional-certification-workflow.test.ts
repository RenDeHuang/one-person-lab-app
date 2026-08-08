import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import YAML from 'yaml';

const appRoot = path.resolve(import.meta.dirname, '../..');
const workflowPath = path.join(appRoot, '.github/workflows/release-post-publication-certification.yml');

function readWorkflow(): { source: string; workflow: Record<string, any> } {
  const source = fs.readFileSync(workflowPath, 'utf8');
  return { source, workflow: YAML.parse(source) };
}

test('Desktop Release Set certification follows one completed same-tag append', () => {
  const { source, workflow } = readWorkflow();
  assert.deepEqual(Object.keys(workflow.on), ['workflow_run']);
  assert.deepEqual(workflow.on.workflow_run.workflows, ['OPL Stable Desktop Release Set Follow-up']);
  assert.deepEqual(workflow.on.workflow_run.types, ['completed']);
  assert.deepEqual(Object.keys(workflow.jobs), [
    'resolve-release-set',
    'certify-linux-x64',
    'admit-macos-vm',
    'certify-standard-vm',
    'certify-full-vm',
    'receipt',
  ]);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.doesNotMatch(source, /optional[_-]platform|adjunct|release-stable-optional-existing-base/);
  assert.doesNotMatch(source, /contents: write|packages: write|gh release (?:create|edit|upload|delete)/);
});

test('non-Desktop Stable operations complete certification as not applicable', () => {
  const { source, workflow } = readWorkflow();
  const resolve = workflow.jobs['resolve-release-set'];
  assert.equal(resolve.outputs.applicable, '${{ steps.authority.outputs.applicable }}');
  assert.equal(resolve.outputs.reason_code, '${{ steps.authority.outputs.reason_code }}');
  assert.equal(resolve.outputs.source_run_id, '${{ steps.authority.outputs.source_run_id }}');
  assert.match(source, /source_run_not_successful/);
  assert.match(source, /source_operation_append_full/);
  assert.match(source, /opl-release-operation-admission-\$source_run_id/);
  assert.doesNotMatch(source, /display_title \| startswith\("OPL Stable standard/);
  assert.match(source, /status:\(if \$applicable == "true" then "complete" else "not_applicable" end\)/);

  for (const stepName of [
    'Download exact Release Set follow-up receipt',
    'Download exact Desktop append receipt',
    'Bind completed follow-up identity',
    'Download exact Full append publication evidence',
    'Bind one public Desktop Release Set',
  ]) {
    const step = resolve.steps.find((candidate: Record<string, unknown>) => candidate.name === stepName);
    assert.equal(step.if, "${{ steps.authority.outputs.applicable == 'true' }}");
  }

  assert.equal(
    workflow.jobs['certify-linux-x64'].if,
    "${{ needs.resolve-release-set.outputs.applicable == 'true' }}",
  );
  assert.equal(
    workflow.jobs['admit-macos-vm'].if,
    "${{ needs.resolve-release-set.outputs.applicable == 'true' }}",
  );
});

test('Linux certification consumes the exact public same-tag Desktop assets', () => {
  const { source, workflow } = readWorkflow();
  const resolve = workflow.jobs['resolve-release-set'];
  const linux = workflow.jobs['certify-linux-x64'];
  assert.deepEqual(linux.needs, ['resolve-release-set']);
  assert.equal(linux['runs-on'], 'ubuntu-latest');
  assert.equal(linux.permissions, undefined);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.equal(resolve.outputs.linux_artifact_name, '${{ steps.identity.outputs.linux_artifact_name }}');
  assert.equal(resolve.outputs.linux_artifact_digest, '${{ steps.identity.outputs.linux_artifact_digest }}');
  assert.match(source, /opl-desktop-platforms-manifest\.json/);
  assert.match(source, /releases\/download\/\$\{RELEASE_TAG\}/);
  assert.match(source, /opl_app_linux_same_tag_desktop_install\.v1/);
  assert.match(source, /linux-x64-same-tag-install\.json/);
  assert.match(source, /rebuilt:false/);
});

test('macOS certification remains read-only and binds Standard and Full to the same tag', () => {
  const { workflow } = readWorkflow();
  for (const profile of ['standard', 'full']) {
    const certify = workflow.jobs[`certify-${profile}-vm`];
    assert.deepEqual(certify.needs, ['resolve-release-set', 'admit-macos-vm']);
    assert.equal(certify.uses, './.github/workflows/opl-first-run-vm.yml');
    assert.deepEqual(certify.permissions, { contents: 'read', actions: 'read' });
    assert.equal(certify.with.release_tag, '${{ needs.resolve-release-set.outputs.tag }}');
    assert.equal(certify.with.package_profile, profile);
    assert.equal(
      certify.if,
      "${{ needs.resolve-release-set.outputs.applicable == 'true' && needs.admit-macos-vm.outputs.eligible == 'true' }}",
    );
  }
});
