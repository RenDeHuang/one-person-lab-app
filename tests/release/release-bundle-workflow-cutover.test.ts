import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

const workflowRoot = path.join(process.cwd(), '.github', 'workflows');
const readWorkflow = (name: string) => fs.readFileSync(path.join(workflowRoot, name), 'utf8');
const parseWorkflow = (name: string) => parseYaml(readWorkflow(name));
const packageIds = ['mas', 'mag', 'rca', 'oma', 'obf', 'mas-scholar-skills', 'opl-flow'] as const;
const minimumCompatibleFrameworkAbiRef = 'ad09977d7cdfc6cb3d1c04f7f1e6fd9358a7a2fc';
const rejectedBundle = 'sha256:91d5ea069757fca6bb9aa2280615dc952caeff55b6b4bc13e08e40df32378f49';
const transportProvenanceFields = [
  'checkpoint_transport_executor',
  'transport_run_id',
] as const;
const frameworkOwnedLineageFields = [
  'source_build_executor',
  'source_build_run_id',
  'standard_source_build_executor',
  'standard_source_build_run_id',
  'full_source_build_executor',
  'full_source_build_run_id',
] as const;

function sha256(filePath: string) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function gitFixture(root: string, name: string) {
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'fixture.txt'), `${name}\n`);
  for (const args of [
    ['init', '-q'],
    ['config', 'user.email', 'fixture@example.invalid'],
    ['config', 'user.name', 'Fixture'],
    ['add', '.'],
    ['commit', '-qm', 'fixture'],
  ]) {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return directory;
}

function adapterFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-adapter-'));
  const appRoot = gitFixture(root, 'app');
  const shellRoot = gitFixture(root, 'shell');
  const frameworkRoot = gitFixture(root, 'framework');
  const catalogRoot = path.join(frameworkRoot, 'contracts', 'opl-framework');
  const packageRoot = path.join(catalogRoot, 'packages');
  const payloadRoot = path.join(packageRoot, 'payloads');
  fs.mkdirSync(payloadRoot, { recursive: true });
  const packages: Record<string, unknown> = {};
  for (const [index, packageId] of packageIds.entries()) {
    const version = `0.${index + 1}.0`;
    const ownerSourceCommit = String((index + 2).toString(16)).repeat(40).slice(0, 40);
    const manifestRef = `packages/${packageId}.json`;
    const payloadManifestRef = `packages/payloads/${packageId}-${version}.json`;
    const manifestPath = path.join(catalogRoot, manifestRef);
    const payloadPath = path.join(catalogRoot, payloadManifestRef);
    fs.writeFileSync(manifestPath, `${JSON.stringify({ package_id: packageId, version })}\n`);
    fs.writeFileSync(payloadPath, `${JSON.stringify({
      package_id: packageId,
      package_version: version,
      source_commit: ownerSourceCommit,
    })}\n`);
    packages[packageId] = {
      package_version: version,
      owner_source_commit: ownerSourceCommit,
      manifest_ref: manifestRef,
      manifest_sha256: sha256(manifestPath),
      payload_manifest_ref: payloadManifestRef,
      payload_manifest_sha256: sha256(payloadPath),
    };
  }
  fs.writeFileSync(path.join(catalogRoot, 'bundled-full-runtime-package-catalog.json'), `${JSON.stringify({ packages })}\n`);
  const releaseSetPath = path.join(frameworkRoot, 'release', 'cohorts', 'fixture', 'release-set.json');
  fs.mkdirSync(path.dirname(releaseSetPath), { recursive: true });
  fs.writeFileSync(releaseSetPath, '{"surface_kind":"opl_release_set.v2"}\n');
  const notesPath = path.join(root, 'notes.md');
  const evidencePath = path.join(root, 'notes-evidence.json');
  fs.writeFileSync(notesPath, '# One Person Lab v26.7.20\n\nFixture notes.\n\n<!-- OPL_RELEASE_NOTES_GENERATOR:online-ai -->\n');
  fs.writeFileSync(evidencePath, `${JSON.stringify({
    surface_kind: 'opl_app_release_notes_evidence.v1',
    payload: { include_full_package: false },
  })}\n`);
  return { root, appRoot, shellRoot, frameworkRoot, releaseSetPath, notesPath, evidencePath, payloadRoot };
}

function runFreezeRequest(fixture: ReturnType<typeof adapterFixture>, output: string) {
  return spawnSync(process.execPath, [
    '--experimental-strip-types',
    path.join(process.cwd(), 'scripts', 'framework-release-adapter.ts'),
    'freeze-request',
    '--channel', 'stable',
    '--version', '26.7.20',
    '--updater-version', '26.7.20',
    '--app-root', fixture.appRoot,
    '--shell-root', fixture.shellRoot,
    '--framework-root', fixture.frameworkRoot,
    '--notes', fixture.notesPath,
    '--notes-evidence', fixture.evidencePath,
    '--include-full-package', 'false',
    '--release-set-manifest', fixture.releaseSetPath,
    '--output', output,
  ], { cwd: process.cwd(), encoding: 'utf8' });
}

function workflowStep(workflowName: string, jobName: string, stepName: string): Record<string, any> {
  const workflow = parseWorkflow(workflowName);
  const step = workflow.jobs[jobName].steps.find((candidate: Record<string, unknown>) => candidate.name === stepName);
  assert.ok(step, `${workflowName}:${jobName} is missing ${stepName}`);
  return step;
}

function runAdmissionGate(
  workflowName: string,
  jobName: string,
  stepName: string,
  inputs: Record<string, string>,
) {
  const step = workflowStep(workflowName, jobName, stepName);
  const script = String(step.run).replace(
    /\$\{\{\s*inputs\.([A-Za-z0-9_]+)\s*\}\}/g,
    (_match, name: string) => inputs[name] ?? '',
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-workflow-gate-'));
  try {
    return spawnSync('bash', ['-euo', 'pipefail', '-c', script], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_RUN_ATTEMPT: '1',
        GITHUB_RUN_ID: '424242',
        RUNNER_TEMP: root,
      },
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('Stable is the only manual entry and all channels share one non-cancelling mutex', () => {
  const stable = parseWorkflow('release-stable.yml');
  const nightly = parseWorkflow('release-nightly.yml');

  assert.deepEqual(Object.keys(stable.on), ['workflow_dispatch']);
  assert.deepEqual(stable.on.workflow_dispatch.inputs.operation.options, [
    'standard',
    'resume_standard',
    'append_full',
  ]);
  assert.deepEqual(Object.keys(nightly.on), ['schedule']);
  assert.deepEqual(stable.concurrency, { group: 'opl-release-bundle-global', 'cancel-in-progress': false });
  assert.deepEqual(nightly.concurrency, stable.concurrency);
  assert.equal(stable.jobs.standard.uses, './.github/workflows/_release-bundle.yml');
  assert.equal(stable.jobs['resume-standard'].uses, './.github/workflows/_release-standard-publish.yml');
  assert.equal(stable.jobs['append-full'].uses, './.github/workflows/_release-full-addon.yml');
  assert.equal(Object.hasOwn(stable.jobs['resume-standard'].with, 'operation_started_at'), false);
  assert.equal(Object.hasOwn(stable.jobs['resume-standard'].with, 'operation_deadline_at'), false);
  assert.equal(nightly.jobs.release.uses, './.github/workflows/_release-bundle.yml');
  const stableSource = readWorkflow('release-stable.yml');
  assert.match(stableSource, /if \[ "\$OPERATION" = standard \] \|\| \[ "\$OPERATION" = append_full \]; then[\s\S]*actions\/runs\/\$GITHUB_RUN_ID" --jq \.created_at/);
  assert.match(stableSource, /if: \$\{\{ steps\.admission\.outputs\.operation != 'resume_standard' \}\}/);
  assert.doesNotMatch(stableSource, /run_started_at/);
  for (const workflow of ['_release-bundle.yml', '_release-standard-publish.yml', '_release-full-addon.yml']) {
    assert.doesNotMatch(readWorkflow(workflow), /opl-release-bundle-global/);
  }
});

test('new Standard binds fresh remote Framework main while Canary uses only a minimum compatible ABI', () => {
  const stable = parseWorkflow('release-stable.yml');
  assert.equal(stable.env.OPL_FRAMEWORK_RELEASE_ABI_REF, undefined);
  const stableAdmission = String(stable.jobs.admission.steps.find(
    (step: Record<string, unknown>) => step.name === 'Admit one bounded Bundle operation',
  )?.run ?? '');
  assert.match(stableAdmission, /standard\)\n\s+canonical_shell_sha=/);
  assert.match(stableAdmission, /canonical_framework_sha=.*one-person-lab\.git refs\/heads\/main/);
  assert.match(stableAdmission, /\[ "\$FRAMEWORK_REF" = "\$canonical_framework_sha" \]/);
  assert.doesNotMatch(stableAdmission, /OPL_FRAMEWORK_(?:RELEASE|CHECKPOINT)_ABI_REF/);
  assert.match(stableAdmission, /resume_standard\|append_full\)[\s\S]*if \[ -n "\$FRAMEWORK_REF" \]/);
  assert.match(stableAdmission, /framework_executor_ref=\$FRAMEWORK_REF/);
  assert.doesNotMatch(
    stableAdmission.slice(stableAdmission.indexOf('resume_standard|append_full)')),
    /canonical_framework_sha|OPL_FRAMEWORK_RELEASE_ABI_REF/,
  );

  for (const name of ['_release-standard-publish.yml', '_release-full-addon.yml']) {
    const workflow = parseWorkflow(name);
    const input = workflow.on.workflow_call.inputs.framework_executor_ref;
    assert.equal(input.required, false);
    assert.equal(input.default, '');
    assert.equal(workflow.env.OPL_FRAMEWORK_CANARY_MINIMUM_ABI_REF, minimumCompatibleFrameworkAbiRef);
    const source = readWorkflow(name);
    assert.match(source, /Download checkpoint identity bootstrap/);
    assert.match(source, /Resolve Bundle-bound Framework identity/);
    assert.match(source, /framework_source_ref=.*sources\.framework\.source_commit/);
    assert.match(source, /Checkpoint Framework source differs from the optional caller expectation/);
    assert.doesNotMatch(source, /OPL_FRAMEWORK_CHECKPOINT_ABI/);
  }

  const standardRestore = workflowStep(
    '_release-standard-publish.yml',
    'restore',
    'Restore portable checkpoint',
  );
  assert.equal(
    standardRestore.with['framework-executor-ref'],
    '${{ steps.framework-binding.outputs.framework_source_ref }}',
  );
  const fullRestore = workflowStep(
    '_release-full-addon.yml',
    'restore-standard',
    'Restore verified Standard checkpoint',
  );
  assert.equal(
    fullRestore.with['framework-executor-ref'],
    '${{ steps.framework-binding.outputs.framework_source_ref }}',
  );
});

test('Full prepared notes materialize the exact Shell AionCore pin before deep authority derivation', () => {
  const workflow = parseWorkflow('_release-bundle.yml');
  const source = readWorkflow('_release-bundle.yml');
  const frameworkCheckout = workflowStep(
    '_release-bundle.yml',
    'freeze',
    'Checkout Framework source and executor',
  );
  assert.equal(frameworkCheckout.with.repository, 'gaofeng21cn/one-person-lab');
  assert.equal(frameworkCheckout.with.ref, "${{ inputs.framework_ref || 'main' }}");
  assert.equal(frameworkCheckout.with.path, 'framework-source');
  const identityScript = String(workflowStep(
    '_release-bundle.yml',
    'freeze',
    'Freeze source, version, and Package identity',
  ).run);
  for (const scratchPath of [
    '$RUNNER_TEMP/opl-published-releases-$GITHUB_RUN_ID.json',
    '$RUNNER_TEMP/opl-published-tags-$GITHUB_RUN_ID.txt',
    '$RUNNER_TEMP/opl-stable-version-order-$GITHUB_RUN_ID.json',
    '$RUNNER_TEMP/opl-previous-latest-$GITHUB_RUN_ID.json',
    '$RUNNER_TEMP/opl-nightly-tags-$GITHUB_RUN_ID.txt',
  ]) {
    assert.ok(identityScript.includes(scratchPath), `identity scratch is not outside the App tree: ${scratchPath}`);
  }
  assert.doesNotMatch(
    identityScript,
    /> (?:published-releases\.json|published-tags\.txt|stable-version-order\.json|previous-latest\.json|nightly-tags\.txt)/,
  );

  const authorityJob = workflow.jobs['full-notes-authority'];
  assert.equal(authorityJob['runs-on'], 'macos-latest');
  assert.deepEqual(authorityJob.needs, ['admission']);
  assert.match(String(authorityJob.if), /inputs\.mode == 'execute'/);
  assert.match(String(authorityJob.if), /inputs\.include_full/);
  const shellCheckout = workflowStep(
    '_release-bundle.yml',
    'full-notes-authority',
    'Checkout exact Shell authority',
  );
  assert.equal(shellCheckout.with.repository, 'gaofeng21cn/opl-aion-shell');
  assert.equal(shellCheckout.with.ref, '${{ inputs.shell_ref }}');
  assert.equal(shellCheckout.with.path, 'shells/aionui');

  const materialize = workflowStep(
    '_release-bundle.yml',
    'full-notes-authority',
    'Materialize exact Shell AionCore authority',
  );
  assert.equal(materialize['working-directory'], 'shells/aionui');
  assert.equal(materialize.env.AIONUI_BACKEND_ARCH, 'arm64');
  assert.equal(materialize.env.AIONUI_BACKEND_RUN_ID, '');
  assert.match(materialize.env.AIONUI_AIONCORE_CACHE_DIR, /runner\.temp.*github\.run_id/);
  const materializeScript = String(materialize.run);
  assert.match(materializeScript, /test "\$\(uname -m\)" = arm64/);
  assert.match(materializeScript, /test ! -e resources\/bundled-aioncore\/darwin-arm64/);
  assert.match(materializeScript, /package\.json.*aioncoreVersion/s);
  assert.match(materializeScript, /\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$/);
  assert.match(materializeScript, /AIONUI_BACKEND_VERSION="\$aioncore_version" node scripts\/prepareAioncore\.js/);
  assert.doesNotMatch(materializeScript, /latest|AIONUI_BACKEND_RUN_ID/);

  const deriveScript = String(workflowStep(
    '_release-bundle.yml',
    'full-notes-authority',
    'Derive deep-validated Full notes payload authority',
  ).run);
  for (const required of [
    'scripts/prepare-release-notes-full-payload-authority.ts',
    "--app-ref '${{ inputs.app_ref }}'",
    "--shell-ref '${{ inputs.shell_ref }}'",
    "--framework-ref '${{ inputs.framework_ref }}'",
    '--output notes-full-payload-authority.json',
    'shasum -a 256 notes-full-payload-authority.json',
  ]) {
    assert.ok(deriveScript.includes(required), `Full authority derivation is missing ${required}`);
  }
  const upload = workflowStep(
    '_release-bundle.yml',
    'full-notes-authority',
    'Upload exact Full notes payload authority',
  );
  assert.equal(upload.with.name, 'opl-release-full-notes-authority-${{ github.run_id }}');
  assert.equal(
    upload.with.path,
    'notes-full-payload-authority.json\nnotes-full-payload-authority.sha256\n',
  );
  assert.doesNotMatch(String(upload.with.path), /bundled-aioncore|managed-resources/);

  assert.deepEqual(workflow.jobs.freeze.needs, ['admission', 'full-notes-authority']);
  assert.match(String(workflow.jobs.freeze.if), /needs\['full-notes-authority'\]\.result == 'success'/);
  assert.match(String(workflow.jobs.freeze.if), /!inputs\.include_full/);
  const download = workflowStep(
    '_release-bundle.yml',
    'freeze',
    'Download exact Full notes payload authority',
  );
  assert.equal(download.with.name, 'opl-release-full-notes-authority-${{ github.run_id }}');
  const transport = workflowStep(
    '_release-bundle.yml',
    'freeze',
    'Verify Full notes payload authority transport',
  );
  assert.equal(transport.run, 'shasum -a 256 -c notes-full-payload-authority.sha256');

  const step = workflowStep(
    '_release-bundle.yml',
    'freeze',
    'Prepare and validate online AI notes',
  );
  const script = String(step.run);
  assert.match(script, /if \[\[ '\$\{\{ inputs\.include_full \}\}' == true \]\]; then/);
  assert.doesNotMatch(script, /scripts\/prepare-release-notes-full-payload-authority\.ts/);
  assert.match(
    script,
    /--full-package-manifest "\$RUNNER_TEMP\/opl-release-full-notes-authority\/notes-full-payload-authority\.json"/,
  );
  assert.doesNotMatch(script, /One-Person-Lab-Manual|dist\/opl-full-release|full-package-manifest\.json/);
  assert.ok(
    source.indexOf('- name: Materialize exact Shell AionCore authority')
      < source.indexOf('- name: Derive deep-validated Full notes payload authority'),
  );
  assert.ok(
    source.indexOf('- name: Verify Full notes payload authority transport')
      < source.indexOf('- name: Prepare and validate online AI notes'),
  );
});

test('every release-bound low-level admission rejects missing, invalid, or permanently rejected identity', () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  const baseInputs = {
    operation_started_at: '2026-07-21T00:00:00.000Z',
    operation_deadline_at: '2099-07-21T00:00:00.000Z',
    release_bundle_digest: digest,
    ref: '1'.repeat(40),
    artifact_app_ref: '1'.repeat(40),
    app_ref: '1'.repeat(40),
    artifact_app_sha: '1'.repeat(40),
    shell_ref: '2'.repeat(40),
    framework_ref: '3'.repeat(40),
    baseline_dmg_sha256: '4'.repeat(64),
  };
  const gates = [
    {
      workflow: '_build-reusable.yml',
      job: 'build',
      step: 'Admit one-shot release-bound build',
      operation: 'standard',
      fields: ['release_bundle_digest', 'ref', 'shell_ref', 'framework_ref'],
    },
    {
      workflow: 'opl-first-run-vm.yml',
      job: 'validate-vm-inputs',
      step: 'Admit one-shot release-bound qualification',
      operation: 'standard',
      fields: ['release_bundle_digest', 'artifact_app_ref', 'shell_ref', 'framework_ref'],
    },
    {
      workflow: 'opl-updater-upgrade-vm.yml',
      job: 'upgrade',
      step: 'Reject replay and invalid frozen identities',
      operation: 'resume_standard',
      fields: ['release_bundle_digest', 'app_ref', 'shell_ref', 'framework_ref'],
    },
    {
      workflow: 'full-first-install-release.yml',
      job: 'full-first-install',
      step: 'Admit one-shot release-bound Full build',
      operation: 'append_full',
      fields: ['release_bundle_digest', 'artifact_app_sha', 'shell_ref', 'framework_ref'],
    },
  ] as const;

  for (const gate of gates) {
    const admission = workflowStep(gate.workflow, gate.job, gate.step);
    const source = String(admission.run);
    assert.match(source, /opl_release_nested_admission_receipt\.v1/);
    assert.match(source, /input-digest\.txt/);
    assert.match(source, /stdout\.txt/);
    assert.match(source, /stderr\.txt/);
    assert.match(source, /input_digest:\$input_digest/);
    assert.match(source, new RegExp(rejectedBundle));
    const validInputs = { ...baseInputs, operation: gate.operation };
    const valid = runAdmissionGate(gate.workflow, gate.job, gate.step, validInputs);
    assert.equal(valid.status, 0, `${gate.workflow} valid gate failed: ${valid.stderr}`);

    for (const field of gate.fields) {
      const missing = runAdmissionGate(gate.workflow, gate.job, gate.step, { ...validInputs, [field]: '' });
      assert.notEqual(missing.status, 0, `${gate.workflow} accepted missing ${field}`);
      const invalidValue = field === 'release_bundle_digest' ? 'sha256:not-exact' : 'A'.repeat(40);
      const invalid = runAdmissionGate(gate.workflow, gate.job, gate.step, {
        ...validInputs,
        [field]: invalidValue,
      });
      assert.notEqual(invalid.status, 0, `${gate.workflow} accepted invalid ${field}`);
    }

    const rejected = runAdmissionGate(gate.workflow, gate.job, gate.step, {
      ...validInputs,
      release_bundle_digest: rejectedBundle,
    });
    assert.notEqual(rejected.status, 0, `${gate.workflow} accepted the permanently rejected Bundle`);
  }

  for (const [workflow, job, step] of [
    ['_build-reusable.yml', 'build', 'Admit one-shot release-bound build'],
    ['opl-first-run-vm.yml', 'validate-vm-inputs', 'Admit one-shot release-bound qualification'],
    ['full-first-install-release.yml', 'full-first-install', 'Admit one-shot release-bound Full build'],
  ]) {
    assert.equal(workflowStep(workflow, job, step).if, "${{ inputs.operation != '' }}");
  }
});

test('the live control plane is split into Standard build, Standard publish, and additive Full workflows', () => {
  const bundle = parseWorkflow('_release-bundle.yml');
  const standard = parseWorkflow('_release-standard-publish.yml');
  const full = parseWorkflow('_release-full-addon.yml');

  assert.deepEqual(Object.keys(bundle.on), ['workflow_call']);
  assert.deepEqual(Object.keys(standard.on), ['workflow_call']);
  assert.deepEqual(Object.keys(full.on), ['workflow_call']);
  assert.equal(bundle.permissions, undefined);
  assert.equal(standard.permissions, undefined);
  assert.equal(full.permissions, undefined);
  assert.deepEqual(Object.keys(bundle.jobs), [
    'startup-canary',
    'admission',
    'full-notes-authority',
    'freeze',
    'standard-build',
    'standard-qualification',
    'checkpoint-standard',
    'publish-standard',
  ]);
  assert.ok(standard.jobs.restore);
  assert.ok(standard.jobs['updater-upgrade-qualification']);
  assert.ok(standard.jobs['publish-standard-nonlatest']);
  assert.ok(standard.jobs['activate-latest']);
  assert.ok(full.jobs['restore-standard']);
  assert.ok(full.jobs['materialize-full-build']);
  assert.ok(full.jobs['checkpoint-full']);
  assert.ok(full.jobs.provenance);
  assert.ok(full.jobs['publish-full']);
  for (const [workflow, inheritedMutationJobs] of [
    [bundle, new Set(['publish-standard'])],
    [standard, new Set(['publish-standard-nonlatest', 'activate-latest'])],
    [full, new Set(['publish-full'])],
  ] as const) {
    for (const [jobId, job] of Object.entries(workflow.jobs) as Array<[string, Record<string, any>]>) {
      if (inheritedMutationJobs.has(jobId)) {
        assert.equal(job.permissions, undefined, `${jobId} must inherit the caller permission ceiling`);
      } else {
        assert.deepEqual(job.permissions, { contents: 'read', actions: 'read' }, `${jobId} must be read-only`);
      }
    }
  }
  assert.doesNotMatch(`${readWorkflow('_release-bundle.yml')}\n${readWorkflow('_release-standard-publish.yml')}\n${readWorkflow('_release-full-addon.yml')}`, /release[_ -]broker|stable[_ -]session[_ -]lease/i);
});

test('checkpoint state lineage remains Framework-owned while App exposes transport provenance only', () => {
  for (const name of ['_release-bundle.yml', '_release-standard-publish.yml', '_release-full-addon.yml']) {
    const workflow = parseWorkflow(name);
    const inputs = workflow.on.workflow_call.inputs;
    const outputs = workflow.on.workflow_call.outputs;
    for (const field of [...transportProvenanceFields, ...frameworkOwnedLineageFields]) {
      assert.equal(inputs[field], undefined, `${name} must not accept operator-supplied ${field}`);
    }
    for (const field of transportProvenanceFields) {
      assert.ok(outputs[field], `${name} must expose ${field}`);
    }
    for (const field of frameworkOwnedLineageFields) {
      assert.equal(outputs[field], undefined, `${name} must not project Framework-owned ${field}`);
    }
    assert.match(readWorkflow(name), new RegExp(minimumCompatibleFrameworkAbiRef));
    assert.match(readWorkflow(name), new RegExp(rejectedBundle));
  }

  const bundleSource = readWorkflow('_release-bundle.yml');
  assert.match(bundleSource, /standard-build-receipt\.json/);
  assert.match(bundleSource, /checkpoint_transport_executor=github_actions/);
  const fullSource = readWorkflow('_release-full-addon.yml');
  assert.match(fullSource, /standard-build-receipt\.json/);
  assert.match(fullSource, /full-build-receipt\.json/);
  assert.doesNotMatch(readWorkflow('_release-standard-publish.yml'), /bound_standard_v1|checkpoint-migration/);

  const action = fs.readFileSync(path.join(process.cwd(), '.github', 'actions', 'restore-release-checkpoint', 'action.yml'), 'utf8');
  assert.match(action, /rebuild_performed/);
  assert.match(action, /publish_state_imported/);
  assert.match(action, /opl release checkpoint import/);
  assert.match(action, /opl release status/);
  assert.doesNotMatch(action, /standard-build-receipt\.json|full-build-receipt\.json/);
  for (const field of transportProvenanceFields) assert.match(action, new RegExp(field));
  for (const field of frameworkOwnedLineageFields) assert.doesNotMatch(action, new RegExp(field));
});

test('completed Full stages skip work already proven by the checkpoint', () => {
  const full = parseWorkflow('_release-full-addon.yml');
  assert.match(String(full.jobs['full-build'].if), /standard_qualified/);
  assert.match(String(full.jobs['materialize-full-build'].if), /full_built/);
  assert.match(String(full.jobs['full-qualification'].if), /standard_qualified/);
  assert.match(String(full.jobs['full-qualification'].if), /full_built/);
  assert.match(String(full.jobs['checkpoint-full'].if), /full_qualified/);
  assert.match(String(full.jobs.provenance.if), /full_qualified/);

  const bind = full.jobs['checkpoint-full'].steps.find(
    (step: Record<string, unknown>) => step.name === 'Bind Full bytes and export additive checkpoint',
  );
  const run = String(bind?.run ?? '');
  assert.match(run, /standard_qualified\)/);
  assert.match(run, /full_built\)/);
  assert.match(run, /cp "\$original_full_receipt" full-build-receipt\.json/);
  assert.equal((run.match(/opl release build/g) ?? []).length, 1);
  assert.match(readWorkflow('_release-full-addon.yml'), /rebuild_performed/);
});

test('every Stable updater baseline passes before the first public release mutation', () => {
  const standard = parseWorkflow('_release-standard-publish.yml');
  const publish = standard.jobs['publish-standard-nonlatest'];
  const homebrew = standard.jobs['publish-homebrew-standard'];
  const latest = standard.jobs['activate-latest'];

  assert.deepEqual(standard.jobs['updater-upgrade-qualification'].needs, ['restore']);
  assert.deepEqual(standard.jobs['updater-upgrade-qualification-highest'].needs, ['restore']);
  assert.ok(publish.needs.includes('updater-upgrade-qualification'));
  assert.ok(publish.needs.includes('updater-upgrade-qualification-highest'));
  assert.ok(homebrew.needs.includes('remote-digest-verify'));
  assert.ok(latest.needs.includes('updater-upgrade-qualification-highest'));
  assert.match(readWorkflow('_release-standard-publish.yml'), /highest_public_stable/);
  assert.match(readWorkflow('_release-bundle.yml'), /resolveStableReleaseVersion/);
  assert.match(readWorkflow('_release-bundle.yml'), /--published-releases-json/);

  const updater = readWorkflow('opl-updater-upgrade-vm.yml');
  assert.match(updater, /candidate_zip_size/);
  assert.match(updater, /candidate_zip_sha256/);
  assert.match(updater, /tracks\/standard\/assets\.json/);
  assert.match(updater, /candidate ZIP entry must be unique/);
  assert.match(updater, /sha256:\$candidate_zip_sha256.*\$checkpoint_zip_sha256/);
  assert.match(updater, /candidate_zip_size.*checkpoint_zip_size/);
  assert.match(updater, /metadata_declared_sha512/);
  assert.match(updater, /metadata_declared_size/);
  assert.match(updater, /same_candidate_zip_downloaded/);
});

test('mutation unknown states persist evidence and only use bounded read-only reconciliation', () => {
  for (const name of ['_release-standard-publish.yml', '_release-full-addon.yml']) {
    const source = readWorkflow(name);
    assert.match(source, /input-digest\.txt/);
    assert.match(source, /stdout\.txt/);
    assert.match(source, /stderr\.txt/);
    assert.match(source, /if: \$\{\{ always\(\) \}\}/);
    assert.match(source, /--operation-id/);
    assert.match(source, /--operation-started-at/);
    assert.match(source, /--operation-deadline-at/);
  }
  const homebrew = readWorkflow('_release-standard-publish.yml');
  assert.match(homebrew, /timeout --foreground --signal=TERM --kill-after=5s/);
  assert.match(homebrew, /readonly_timeout_seconds=30/);
  assert.match(homebrew, /git -C tap-source ls-remote origin refs\/heads\/main/);
  assert.doesNotMatch(homebrew, /for attempt in 1 2 3|three read-only reconciliations/);
  assert.match(homebrew, /push_count=0/);
  assert.match(homebrew, /test "\$push_count" -eq 1/);
  assert.equal((homebrew.match(/git -C tap-source push --no-force origin/g) ?? []).length, 1);
  const standardSource = readWorkflow('_release-standard-publish.yml');
  const fullSource = readWorkflow('_release-full-addon.yml');
  assert.match(standardSource, /release_bundle_status\.tracks\.standard\.reconcile_required/);
  assert.match(fullSource, /release_bundle_status\.tracks\.full\.reconcile_required/);
  for (const source of [standardSource, fullSource]) {
    assert.match(source, /release_bundle_status\.active_unknown_markers/);
    assert.match(source, /prior_mutation_attempt_id/);
    assert.match(source, /publication_scope/);
    assert.match(source, /outcome_unknown[\s\S]*--outcome unknown[\s\S]*opl release publish[\s\S]*opl release status[\s\S]*opl release reconcile/);
    assert.match(source, /deadline_elapsed[\s\S]*reconcile is not authorized without a persisted unknown outcome/);
  }
  assert.equal((standardSource.match(/framework-release-adapter\.ts github-activate-latest/g) ?? []).length, 1);
  assert.match(standardSource, /case "\$latest_status" in[\s\S]*complete\|idempotent/);
  assert.match(standardSource, /Latest activation was not conclusively read back; no retry was attempted/);
  assert.match(readWorkflow('_release-standard-publish.yml'), /fresh_bounded_read_only_inspect_then_framework_reconcile/);
  assert.match(readWorkflow('_release-full-addon.yml'), /fresh_bounded_read_only_inspect_then_framework_reconcile/);
});

test('every real release build, VM, and mutation job rejects a partial rerun locally', () => {
  const guardedJobs = [
    ['_build-reusable.yml', 'build'],
    ['full-first-install-release.yml', 'full-first-install'],
    ['opl-first-run-vm.yml', 'clean-vm-first-run'],
    ['_release-standard-publish.yml', 'publish-standard-nonlatest'],
    ['_release-standard-publish.yml', 'publish-homebrew-standard'],
    ['_release-standard-publish.yml', 'activate-latest'],
    ['_release-full-addon.yml', 'publish-full'],
  ] as const;

  for (const [workflowName, jobName] of guardedJobs) {
    const workflow = parseWorkflow(workflowName);
    const source = JSON.stringify(workflow.jobs[jobName].steps ?? []);
    assert.match(source, /GITHUB_RUN_ATTEMPT/, `${workflowName}:${jobName}`);
    assert.match(source, /workflow_rerun|Partial rerun/, `${workflowName}:${jobName}`);
  }
  for (const workflowName of ['_release-standard-publish.yml', '_release-full-addon.yml']) {
    const source = readWorkflow(workflowName);
    assert.match(source, /failure_taxonomy:\"workflow_rerun\"/);
    assert.match(source, /input-digest\.txt/);
  }
});

test('the remote Canary starts all three reusable workflows with one synthetic checkpoint handle', () => {
  const canary = parseWorkflow('release-bundle-canary.yml');
  assert.ok(canary.on.push);
  assert.ok(canary.on.pull_request !== undefined);
  assert.equal(canary.on.workflow_dispatch, undefined);
  assert.deepEqual(canary.permissions, { contents: 'read', actions: 'read' });
  assert.equal(canary.jobs.standard.uses, './.github/workflows/_release-bundle.yml');
  assert.equal(canary.jobs['resume-standard'].uses, './.github/workflows/_release-standard-publish.yml');
  assert.equal(canary.jobs['append-full'].uses, './.github/workflows/_release-full-addon.yml');
  assert.equal(canary.jobs['nested-standard-build'].uses, './.github/workflows/_build-reusable.yml');
  assert.equal(canary.jobs['nested-standard-qualification'].uses, './.github/workflows/opl-first-run-vm.yml');
  assert.equal(canary.jobs['nested-updater-qualification'].uses, './.github/workflows/opl-updater-upgrade-vm.yml');
  assert.equal(canary.jobs['nested-full-build'].uses, './.github/workflows/full-first-install-release.yml');
  assert.equal(canary.jobs['resume-standard'].with.source_run_id, '424242');
  assert.equal(canary.jobs['append-full'].with.source_run_id, '424242');
  assert.equal(canary.jobs['resume-standard'].with.source_artifact, 'opl-release-canary-checkpoint-424242');
  assert.equal(canary.jobs['append-full'].with.source_artifact, 'opl-release-canary-checkpoint-424242');
  for (const job of Object.values(canary.jobs) as Array<Record<string, any>>) {
    const permissions = job.permissions ?? canary.permissions;
    assert.equal(permissions.contents, 'read');
    assert.notEqual(permissions['id-token'], 'write');
  }
  assert.doesNotMatch(readWorkflow('release-bundle-canary.yml'), /secrets:\s+inherit/);
  for (const name of ['_release-bundle.yml', '_release-standard-publish.yml', '_release-full-addon.yml']) {
    const workflow = parseWorkflow(name);
    assert.equal(workflow.jobs['startup-canary'].if, "${{ inputs.mode == 'canary' }}");
  }
  for (const name of [
    '_build-reusable.yml',
    'full-first-install-release.yml',
    'opl-first-run-vm.yml',
    'opl-updater-upgrade-vm.yml',
  ]) {
    const workflow = parseWorkflow(name);
    assert.equal(workflow.jobs['startup-canary'].if, "${{ inputs.mode == 'canary' }}");
    assert.match(readWorkflow(name), new RegExp(minimumCompatibleFrameworkAbiRef));
  }
});

test('release-bound nested workflows inherit one operation and absolute deadline', () => {
  for (const name of [
    '_build-reusable.yml',
    'full-first-install-release.yml',
    'opl-first-run-vm.yml',
    'opl-updater-upgrade-vm.yml',
  ]) {
    const workflow = parseWorkflow(name);
    for (const input of ['operation', 'operation_started_at', 'operation_deadline_at']) {
      assert.ok(workflow.on.workflow_call.inputs[input], `${name} is missing ${input}`);
    }
    const source = readWorkflow(name);
    assert.match(source, /GITHUB_RUN_ATTEMPT/);
    assert.match(source, /operation_deadline_at/);
    assert.match(source, /opl_release_nested_admission_receipt\.v1/);
  }

  const bundle = readWorkflow('_release-bundle.yml');
  const standard = readWorkflow('_release-standard-publish.yml');
  const full = readWorkflow('_release-full-addon.yml');
  for (const input of ['operation:', 'operation_started_at:', 'operation_deadline_at:']) {
    assert.match(bundle, new RegExp(input));
    assert.match(standard, new RegExp(input));
    assert.match(full, new RegExp(input));
  }
  const bundleWorkflow = parseWorkflow('_release-bundle.yml');
  assert.equal(
    bundleWorkflow.jobs['standard-build'].with.operation,
    "${{ inputs.channel == 'stable' && inputs.operation || '' }}",
  );
  assert.equal(
    bundleWorkflow.jobs['standard-qualification'].with.operation,
    "${{ inputs.channel == 'stable' && inputs.operation || '' }}",
  );
});

test('real build and qualification calls recalculate and consume the same remaining operation budget', () => {
  const build = parseWorkflow('_build-reusable.yml');
  const buildBudget = build.jobs.build.steps.find(
    (step: Record<string, unknown>) => step.name === 'Recalculate immutable operation budget before release build',
  );
  assert.equal(buildBudget.if, "${{ inputs.operation != '' && startsWith(matrix.platform, 'macos') }}");
  assert.match(String(buildBudget.run), /release-operation-deadline\.ts check/);
  assert.match(String(buildBudget.run), /deadlineMs - Date\.now\(\) - evidenceReserveMs/);
  const macBuild = build.jobs.build.steps.find(
    (step: Record<string, unknown>) => step.name === 'Build with electron-builder (macOS)',
  );
  assert.match(String(macBuild.run), /RELEASE_BUILD_TIMEOUT_MS/);
  assert.match(String(macBuild.run), /process\.kill\(-child\.pid, signal\)/);
  assert.match(String(macBuild.run), /operation_deadline_elapsed/);

  const updater = parseWorkflow('opl-updater-upgrade-vm.yml');
  const updaterBudget = updater.jobs.upgrade.steps.find(
    (step: Record<string, unknown>) => step.name === 'Recalculate immutable operation budget before updater qualification',
  );
  assert.match(String(updaterBudget.run), /release-operation-deadline\.ts check/);
  assert.match(String(updaterBudget.run), /Math\.min\(1_500_000, remainingMs\)/);
  const updaterRun = updater.jobs.upgrade.steps.find(
    (step: Record<string, unknown>) => step.name === 'Run real predecessor-to-candidate updater qualification',
  );
  assert.match(String(updaterRun.run), /steps\.updater_budget\.outputs\.timeout_ms/);
  assert.doesNotMatch(String(updaterRun.run), /--timeout-ms 1500000/);

  const vm = parseWorkflow('opl-first-run-vm.yml');
  const vmBudget = vm.jobs['clean-vm-first-run'].steps.find(
    (step: Record<string, unknown>) => step.name === 'Recalculate immutable operation budget before expensive smoke',
  );
  assert.equal(vmBudget.if, "${{ inputs.operation != '' }}");
  assert.match(String(vmBudget.run), /release-operation-deadline\.ts check/);
  const vmRun = vm.jobs['clean-vm-first-run'].steps.find(
    (step: Record<string, unknown>) => step.name === 'Run clean VM first launch smoke',
  );
  assert.match(String(vmRun.run), /steps\.operation_smoke_budget\.outputs\.run_timeout_ms/);
});

test('deadline failures never authorize Framework reconcile without persisted unknown state', () => {
  const standard = readWorkflow('_release-standard-publish.yml');
  const full = readWorkflow('_release-full-addon.yml');
  assert.match(standard, /bounded_read_only_inspect_only_no_framework_reconcile/);
  assert.match(standard, /framework_reconcile_authorized:false/);
  assert.match(full, /framework_reconcile_authorized=false/);
  assert.match(full, /--argjson framework_reconcile_authorized "\$framework_reconcile_authorized"/);
  assert.match(standard, /push_count:0/);
  assert.match(standard, /bounded_read_only_latest_readback_only_no_second_patch_no_framework_reconcile/);
  assert.match(standard, /--latest-admission standard-latest-admission\.json/);
});

test('append_full cannot mutate Homebrew or any Standard publication surface', () => {
  const full = parseWorkflow('_release-full-addon.yml');
  const source = readWorkflow('_release-full-addon.yml');
  for (const retiredJob of ['publish-homebrew-full', 'homebrew-full-vm', 'homebrew-full-readback']) {
    assert.equal(full.jobs[retiredJob], undefined, retiredJob);
  }
  assert.doesNotMatch(
    source,
    /publish-homebrew-full|homebrew-full|update-homebrew-tap|OPL_HOMEBREW_TAP_TOKEN|tap-source|Casks\/one-person-lab(?:-full)?\.rb|git\b[^\n]*\bpush\b/,
  );
  assert.doesNotMatch(source, /github-activate-latest|opl-updater-upgrade-vm\.yml|latest-arm64-mac\.yml/);
  for (const immutableSurface of [
    'standard_assets_modified:false',
    'prepared_notes_modified:false',
    'standard_updater_metadata_modified:false',
    'homebrew_modified:false',
    'latest_modified:false',
  ]) {
    assert.match(source, new RegExp(immutableSurface));
  }
});

test('Standard Homebrew uses inspect-before-write CAS and one bounded non-force push', () => {
  const workflow = parseWorkflow('_release-standard-publish.yml');
  const source = String(
    workflow.jobs['publish-homebrew-standard'].steps.find(
      (step: Record<string, unknown>) => step.name === 'Publish one digest-bound Standard cask commit',
    )?.run ?? '',
  );
  assert.ok(source.indexOf('preplan_remote_commit="$(inspect_remote_head)"') < source.indexOf('--remote-write-mode inspect_only'));
  assert.ok(source.indexOf('--remote-write-mode inspect_only') < source.indexOf('--remote-write-mode direct_commit'));
  assert.match(source, /case "\$cas_decision" in[\s\S]*idempotent\)[\s\S]*write_homebrew_success idempotent "\$base_commit" 0[\s\S]*exit 0/);
  assert.ok(source.indexOf('write_homebrew_success idempotent "$base_commit" 0') < source.indexOf('git -C tap-source commit '));
  assert.ok(source.indexOf('write_homebrew_success idempotent "$base_commit" 0') < source.indexOf('git -C tap-source push --no-force'));
  assert.match(source, /version_conflict\)[\s\S]*new_release_revision_required[\s\S]*exit 1/);
  assert.match(source, /--expected-current-cask-sha256 "\$current_cask_sha"/);
  assert.equal((source.match(/git -C tap-source commit /g) ?? []).length, 1);
  assert.equal((source.match(/git -C tap-source push --no-force/g) ?? []).length, 1);
  assert.match(source, /push_count=\$\(\(push_count \+ 1\)\)[\s\S]*test "\$push_count" -eq 1/);
  assert.doesNotMatch(source, /for attempt in 1 2 3|three read-only reconciliations/);
  assert.match(source, /write_framework_homebrew_receipt unknown/);
  assert.match(source, /opl release publish[\s\S]*homebrew-unknown-persisted\.json/);
  assert.match(source, /opl release checkpoint export[\s\S]*homebrew-unknown-checkpoint/);
  assert.match(source, /opl release status[\s\S]*active_unknown_markers/);
  assert.match(source, /write_framework_homebrew_receipt complete[\s\S]*opl release reconcile/);
  assert.match(source, /--prior-attempt-id/);
  assert.match(source, /--publication-scope external_target/);
  assert.match(source, /push_exit_status/);
  assert.match(source, /release-failure-evidence\/stdout\.txt/);
  assert.match(source, /release-failure-evidence\/stderr\.txt/);
});

test('new Bundle callers do not activate legacy broker or Stable-session admission', () => {
  for (const name of ['_release-bundle.yml', '_release-standard-publish.yml', '_release-full-addon.yml']) {
    const workflow = parseWorkflow(name);
    for (const job of Object.values(workflow.jobs) as Array<Record<string, any>>) {
      if (!job.uses || !String(job.uses).startsWith('./.github/workflows/')) continue;
      assert.equal(job.with?.stable_session_id, undefined, `${name} must not pass legacy stable_session_id`);
      assert.equal(job.with?.release_mutation, undefined, `${name} must not pass legacy release_mutation`);
      assert.equal(job.with?.release_session_lease_base64, undefined, `${name} must not pass a broker lease`);
    }
  }
  for (const name of ['_build-reusable.yml', 'full-first-install-release.yml', 'opl-first-run-vm.yml']) {
    const workflow = parseWorkflow(name);
    const inputs = workflow.on.workflow_call.inputs;
    for (const legacyInput of [
      'stable_session_id',
      'release_session_lease_base64',
      'release_attempt_id',
      'pre_api_admission_receipt_base64',
      'release_mutation',
      'broker_admission_validation_sha256',
    ]) {
      assert.equal(inputs[legacyInput], undefined, `${name} must not declare legacy ${legacyInput}`);
    }
    assert.doesNotMatch(readWorkflow(name), /verify-release-(?:broker-acceptance|session-lease)\.ts/);
  }
});

test('the App adapter freezes schema-valid digest refs and rejects catalog byte drift before build', () => {
  const fixture = adapterFixture();
  try {
    const output = path.join(fixture.root, 'freeze-request.json');
    const first = runFreezeRequest(fixture, output);
    assert.equal(first.status, 0, first.stderr);
    const request = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(request.surface_kind, 'opl_release_bundle_freeze_request.v1');
    assert.equal(request.schema_ref, 'contracts/opl-framework/release-bundle-freeze-request.schema.json');
    assert.match(request.framework_release_set.digest, /^sha256:[0-9a-f]{64}$/);
    for (const packageId of packageIds) {
      assert.match(request.packages[packageId].manifest_sha256, /^sha256:[0-9a-f]{64}$/);
      assert.match(request.packages[packageId].payload_manifest_sha256, /^sha256:[0-9a-f]{64}$/);
      assert.equal(request.packages[packageId].manifest_ref, `contracts/opl-framework/packages/${packageId}.json`);
      assert.match(
        request.packages[packageId].payload_manifest_ref,
        new RegExp(`^contracts/opl-framework/packages/payloads/${packageId}-`),
      );
    }

    const masPayload = fs.readdirSync(fixture.payloadRoot).find((name) => name.startsWith('mas-'))!;
    fs.appendFileSync(path.join(fixture.payloadRoot, masPayload), 'drift\n');
    const drifted = runFreezeRequest(fixture, path.join(fixture.root, 'drifted.json'));
    assert.notEqual(drifted.status, 0);
    assert.match(drifted.stderr, /mas payload manifest digest drifted/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('the App adapter rejects notes without online AI provenance before build', () => {
  const fixture = adapterFixture();
  try {
    fs.writeFileSync(fixture.notesPath, '# One Person Lab v26.7.20\n\nTemplate notes.\n');
    const result = runFreezeRequest(fixture, path.join(fixture.root, 'untrusted-notes.json'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not bound to the online AI writer/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('the App adapter rejects prepared notes whose Full intent differs from the admitted Bundle request', () => {
  const fixture = adapterFixture();
  try {
    fs.writeFileSync(fixture.evidencePath, `${JSON.stringify({
      surface_kind: 'opl_app_release_notes_evidence.v1',
      payload: { include_full_package: true },
    })}\n`);
    const result = runFreezeRequest(fixture, path.join(fixture.root, 'mismatched-notes-intent.json'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Full intent does not match the admitted Release Bundle request/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
