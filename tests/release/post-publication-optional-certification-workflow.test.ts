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
const vmWorkflowPath = path.join(appRoot, '.github', 'workflows', 'opl-first-run-vm.yml');

function readWorkflow(filePath: string): { source: string; workflow: Record<string, any> } {
  const source = fs.readFileSync(filePath, 'utf8');
  return { source, workflow: parseYaml(source) as Record<string, any> };
}

test('optional certification is an automatic read-only post-publication executor', () => {
  const { source, workflow } = readWorkflow(workflowPath);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_run']);
  assert.deepEqual(workflow.on.workflow_run.workflows, ['OPL Stable Release Bundle']);
  assert.deepEqual(workflow.on.workflow_run.types, ['completed']);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), [
    'resolve-standard',
    'admit-standard-vm',
    'certify-standard-vm',
    'write-standard-receipts',
    'resolve-full',
    'admit-full-vm',
    'certify-full-vm',
    'write-full-receipt',
  ]);

  for (const profile of ['standard', 'full']) {
    const resolve = workflow.jobs[`resolve-${profile}`];
    const admit = workflow.jobs[`admit-${profile}-vm`];
    const certify = workflow.jobs[`certify-${profile}-vm`];
    const write = workflow.jobs[profile === 'standard' ? 'write-standard-receipts' : 'write-full-receipt'];

    assert.equal(resolve.needs, undefined);
    assert.deepEqual(admit.needs, [`resolve-${profile}`]);
    assert.deepEqual(certify.needs, [`resolve-${profile}`, `admit-${profile}-vm`]);
    assert.deepEqual(write.needs, [
      `resolve-${profile}`,
      `admit-${profile}-vm`,
      `certify-${profile}-vm`,
    ]);

    for (const hostedJob of [resolve, admit, write]) {
      assert.equal(hostedJob['runs-on'], 'ubuntu-latest');
      assert.deepEqual(hostedJob.permissions, { contents: 'read', actions: 'read' });
      assert.equal(hostedJob.uses, undefined);
    }
    assert.equal(certify['runs-on'], undefined);
    assert.equal(certify.steps, undefined);
    assert.equal(certify.uses, './.github/workflows/opl-first-run-vm.yml');
    assert.deepEqual(certify.permissions, { contents: 'read', actions: 'read' });
    assert.deepEqual(certify.with, {
      mode: 'execute',
      release_tag: `\${{ needs.resolve-${profile}.outputs.tag }}`,
      published_artifact_name: `\${{ needs.resolve-${profile}.outputs.artifact_name }}`,
      published_artifact_digest: `\${{ needs.resolve-${profile}.outputs.artifact_digest }}`,
      artifact_app_ref: `\${{ needs.resolve-${profile}.outputs.app_sha }}`,
      shell_ref: `\${{ needs.resolve-${profile}.outputs.shell_sha }}`,
      smoke_harness_ref: `\${{ needs.resolve-${profile}.outputs.shell_sha }}`,
      framework_ref: `\${{ needs.resolve-${profile}.outputs.framework_sha }}`,
      package_profile: profile,
      diagnostic_scope: 'post_publication_optional_certification',
      require_macos_gatekeeper: true,
    });
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
  assert.doesNotMatch(
    source,
    /workflow_dispatch:|contents: write|packages: write|gh workflow run|gh run (?:rerun|cancel)|gh release (?:create|edit|upload|delete)|opl release (?:build|publish|reconcile)|codesign|notarize/,
  );
});

test('Standard and Full VM certification consume the exact published DMG without rebuilding it', () => {
  const { source, workflow } = readWorkflow(workflowPath);
  const { source: vmSource, workflow: vmWorkflow } = readWorkflow(vmWorkflowPath);

  for (const profile of ['standard', 'full']) {
    const admit = workflow.jobs[`admit-${profile}-vm`];
    const certify = workflow.jobs[`certify-${profile}-vm`];
    assert.equal(admit.outputs.eligible, '${{ steps.capability.outputs.eligible }}');
    assert.equal(admit.outputs.reason_code, '${{ steps.capability.outputs.reason_code }}');
    const capabilityStep = admit.steps.find((step: Record<string, any>) => step.id === 'capability');
    assert.equal(
      capabilityStep.env.RUNNER_INVENTORY_TOKEN,
      '${{ secrets.OPL_RUNNER_INVENTORY_TOKEN }}',
    );
    assert.match(capabilityStep.run, /\[ -z "\$RUNNER_INVENTORY_TOKEN" \]/);
    assert.match(capabilityStep.run, /GH_TOKEN="\$RUNNER_INVENTORY_TOKEN" gh api/);
    assert.equal(certify.with.release_tag, `\${{ needs.resolve-${profile}.outputs.tag }}`);
    assert.equal(
      certify.with.published_artifact_name,
      `\${{ needs.resolve-${profile}.outputs.artifact_name }}`,
    );
    assert.equal(
      certify.with.published_artifact_digest,
      `\${{ needs.resolve-${profile}.outputs.artifact_digest }}`,
    );
  }

  assert.match(source, /actions\/runners\?per_page=100/);
  assert.match(source, /runner\.status === 'online' && runner\.busy === false/);
  assert.match(source, /reason_code=not_authorized/);
  assert.match(source, /reason_code=operator_deferred/);
  assert.match(source, /status=unavailable/);
  assert.match(source, /capability_admission_failed/);

  assert.equal(
    vmWorkflow.on.workflow_call.outputs.post_publication_status.value,
    '${{ jobs.clean-vm-first-run.outputs.post_publication_status }}',
  );
  assert.equal(
    vmWorkflow.on.workflow_call.outputs.post_publication_reason_code.value,
    '${{ jobs.clean-vm-first-run.outputs.post_publication_reason_code }}',
  );
  for (const output of [
    'published_artifact_verified',
    'post_publication_job_started',
    'post_publication_execution_started',
    'post_publication_classification_valid',
  ]) {
    assert.equal(
      vmWorkflow.on.workflow_call.outputs[output].value,
      `\${{ jobs.clean-vm-first-run.outputs.${output} }}`,
    );
  }
  assert.match(vmSource, /post-publication certification requires published_artifact_name/);
  assert.match(vmSource, /post-publication certification requires an exact published_artifact_digest/);
  assert.match(vmSource, /post-publication certification must consume public release bytes, not an Actions artifact/);
  assert.match(vmSource, /Verify exact published DMG identity before install/);
  assert.match(vmSource, /download_pattern='\$\{\{ inputs\.published_artifact_name \}\}'/);
  assert.match(vmSource, /test "\$\(basename "\$dmg_path"\)" = "\$expected_name"/);
  assert.match(vmSource, /actual_digest="sha256:\$\(shasum -a 256 "\$dmg_path" \| awk '\{print \$1\}'\)"/);
  assert.match(vmSource, /Admit exact Tart capability for post-publication certification/);
  assert.match(vmSource, /Mark post-publication certification execution started/);
  assert.match(vmSource, /clone_vm\|configure_display\|start_vm\|wait_for_ip\|wait_for_ssh/);
  assert.match(vmSource, /run_guest_smoke\|validate_guest_summary/);
  assert.match(vmSource, /needs\.validate-vm-inputs\.outputs\.diagnostic_scope != 'post_publication_optional_certification'/);
});

test('receipt projection distinguishes execution, capability absence, and residual not-run checks', () => {
  const { source } = readWorkflow(workflowPath);
  for (const output of [
    'standard-dmg-clean-machine.json',
    'homebrew-standard-clean-machine.json',
    'one-shot-installer-clean-machine.json',
    'full-dmg-clean-machine.json',
  ]) {
    assert.match(source, new RegExp(output.replaceAll('.', '\\.')));
  }
  assert.match(source, /--status "\$standard_status"/);
  assert.match(source, /--status "\$full_status"/);
  assert.match(source, /--status not_run/);
  assert.match(source, /--reason-code not_requested/);
  assert.match(source, /physical_job_dispatched:\$dispatched/);
  assert.match(source, /certification_run_id/);
  assert.match(source, /component_manifest_digest/);
  assert.match(source, /artifact_digest/);
  assert.match(source, /app_sha/);
  assert.match(source, /shell_sha/);
  assert.match(source, /framework_sha/);
  assert.match(source, /VM_CLASSIFICATION_VALID/);
  assert.match(source, /VM_ARTIFACT_VERIFIED/);
  assert.match(source, /VM_JOB_STARTED/);
  assert.match(source, /VM_EXECUTION_STARTED/);
  assert.match(source, /passed requires a successful reusable job and a started executor/);
  assert.match(source, /failed requires a failed reusable job after execution started/);
  assert.match(source, /did not return one sealable terminal classification/);
  assert.doesNotMatch(source, /runner_offline|queued_workflow|github_auth_failure|network_failure/);
});
