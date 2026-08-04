import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

const appRoot = path.resolve(import.meta.dirname, '../..');
const workflowPath = path.join(appRoot, '.github/workflows/release-stable-optional-existing-base.yml');
const source = fs.readFileSync(workflowPath, 'utf8');
const workflow = parseYaml(source) as any;
const manualSource = fs.readFileSync(path.join(appRoot, '.github/workflows/build-manual.yml'), 'utf8');

test('existing-base optional route is one protected workflow_dispatch with no Standard or Full dispatch', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs), [
    'operation_id', 'authority_id', 'authority_digest', 'authority_carrier',
    'source_qualification_run_id', 'confirmation',
  ]);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.confirmation.options, [
    'publish_existing_v26_8_4_linux_windows_adjunct_v1',
  ]);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['admit', 'publish-optional-platforms']);
  assert.doesNotMatch(source, /release-stable\.yml\/dispatches|operation:\s*(?:standard|resume_standard|append_full)/);
  assert.doesNotMatch(source, /gh run (?:rerun|cancel)|gh workflow run|make_latest:\s*true/);
});

test('authority transport is pure base64url and server uniqueness binds one exact workflow run', () => {
  assert.match(source, /\[\[ "\$AUTHORITY_CARRIER" =~ \^\[A-Za-z0-9_-\]\+\$ \]\]/);
  assert.match(source, /decodeStableOptionalExistingBaseCarrier/);
  assert.match(fs.readFileSync(path.join(appRoot, 'scripts/stable-optional-existing-base-control.ts'), 'utf8'), /authority_carrier must be unpadded canonical base64url/);
  assert.match(source, /\.path == "\.github\/workflows\/release-stable-optional-existing-base\.yml"/);
  assert.match(source, /\(\$matches \| length\) == 1/);
  assert.match(source, /\.run_attempt == 1/);
  assert.match(source, /opl-source-qualification-\$\{\{ inputs\.source_qualification_run_id \}\}/);
});

test('admission freezes exact source qualification and existing v26.8.4 base without touching Latest', () => {
  assert.match(source, /validate-source-qualification-receipt\.ts/);
  assert.match(source, /\.platforms == \["linux-x64", "windows-x64"\]/);
  assert.match(source, /mutation_scope == \{standard_release:false,full_release:false,base_release:false,latest:false,adjunct_release:true\}/);
  assert.match(source, /\.base_release\.target_commitish == \$base\[0\]\.target_commitish/);
  assert.match(source, /\.base_release\.asset_inventory_digest == \$digest/);
  assert.match(source, /\$latest\[0\]\.tag_name == "v26\.8\.4"/);
  assert.match(source, /startswith\("v26\.8\.4-optional-"\)/);
});

test('publisher receives distinct build cohort and base target authority', () => {
  const publish = workflow.jobs['publish-optional-platforms'];
  assert.equal(publish.uses, './.github/workflows/build-manual.yml');
  assert.equal(publish.with.invocation_mode, 'stable_optional_follower');
  assert.equal(publish.with.platform_ids, '${{ needs.admit.outputs.platforms }}');
  assert.equal(publish.with.source_authority_kind, 'existing_base_source_qualification');
  assert.equal(publish.with.source_bundle_digest, '');
  assert.equal(publish.with.base_release_target_commitish, '${{ needs.admit.outputs.base_release_target_commitish }}');
  assert.deepEqual(publish.permissions, { contents: 'write', actions: 'read' });

  assert.match(manualSource, /base_target_commitish="\$BASE_RELEASE_TARGET_COMMITISH"/);
  assert.match(manualSource, /\.target_commitish == \$target/);
  assert.match(manualSource, /test "\$actual_inventory_digest" = "\$BASE_ASSET_INVENTORY_DIGEST"/);
  assert.match(manualSource, /authority_kind:\$authority_kind/);
  assert.match(manualSource, /authority_digest:\$authority_digest/);
  assert.match(manualSource, /if \[ "\$PUBLICATION_MODE" = stable_optional_follower \]; then verify_exact_base_release; fi/);
});

test('matrix control is checked out from the executor while the requested App cohort stays separate', () => {
  const manualWorkflow = parseYaml(manualSource) as any;
  const prepareSteps = manualWorkflow.jobs['prepare-matrix'].steps;
  const appCheckout = prepareSteps.find((step: any) => step.name === 'Checkout requested App source');
  const controlCheckout = prepareSteps.find((step: any) => step.name === 'Checkout protected release control source');
  assert.equal(appCheckout.with.ref, '${{ inputs.app_ref || inputs.branch }}');
  assert.equal(controlCheckout.with.ref, '${{ github.sha }}');
  assert.equal(controlCheckout.with.path, '.release-control');
  assert.match(manualSource, /\.release-control\/scripts\/resolve-release-platform-matrix\.ts/);
  assert.doesNotMatch(manualSource, /node --experimental-strip-types scripts\/resolve-release-platform-matrix\.ts/);
});

test('nonempty invocation mode selects the protected reusable route independently of event name', () => {
  const manualWorkflow = parseYaml(manualSource) as any;
  const matrixRun = manualWorkflow.jobs['prepare-matrix'].steps.find(
    (step: any) => step.name === 'Generate build matrix',
  ).run;
  assert.match(matrixRun, /if \[ -n '\$\{\{ inputs\.invocation_mode \}\}' \]; then/);
  assert.match(matrixRun, /test '\$\{\{ inputs\.invocation_mode \}\}' = stable_optional_follower/);
  assert.doesNotMatch(matrixRun, /GITHUB_EVENT_NAME.*workflow_call/);
});
