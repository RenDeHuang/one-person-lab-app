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
const readAdapter = () => fs.readFileSync(
  path.join(process.cwd(), 'scripts', 'framework-release-adapter.ts'),
  'utf8',
);
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

function amendFixture(directory: string) {
  for (const args of [
    ['add', '.'],
    ['commit', '--amend', '--no-edit', '-q'],
  ]) {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
}

function adapterFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-adapter-'));
  const appRoot = gitFixture(root, 'app');
  const shellRoot = gitFixture(root, 'shell');
  const frameworkRoot = gitFixture(root, 'framework');
  const qualificationHarnessPath = path.join(appRoot, 'scripts', 'validate-webui-runtime-image.ts');
  fs.mkdirSync(path.dirname(qualificationHarnessPath), { recursive: true });
  fs.writeFileSync(qualificationHarnessPath, 'export const fixtureHarness = true;\n');
  fs.writeFileSync(path.join(shellRoot, 'Dockerfile'), 'FROM node:22-bookworm-slim\n');
  const intakePath = path.join(shellRoot, 'contracts', 'aionui-upstream-intake.json');
  fs.mkdirSync(path.dirname(intakePath), { recursive: true });
  fs.writeFileSync(intakePath, `${JSON.stringify({
    managed_runtime: { codex_cli: { package: '@openai/codex', version: '1.2.3' } },
  })}\n`);
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
    schema: 'opl_app_release_notes_evidence.v1',
    payload: { include_full_package: false },
  })}\n`);
  const baseImageIndexPath = path.join(root, 'base-image-index.json');
  fs.writeFileSync(baseImageIndexPath, `${JSON.stringify({
    schemaVersion: 2,
    mediaType: 'application/vnd.oci.image.index.v1+json',
    manifests: [{
      digest: `sha256:${'a'.repeat(64)}`,
      size: 4321,
      platform: { os: 'linux', architecture: 'amd64' },
    }],
  })}\n`);
  const codexPackageRoot = path.join(root, 'codex-package', 'package');
  fs.mkdirSync(codexPackageRoot, { recursive: true });
  fs.writeFileSync(path.join(codexPackageRoot, 'package.json'), `${JSON.stringify({
    name: '@openai/codex',
    version: '1.2.3',
  })}\n`);
  const codexTarballPath = path.join(root, 'codex-cli.tgz');
  const packed = spawnSync('tar', ['-czf', codexTarballPath, 'package'], {
    cwd: path.dirname(codexPackageRoot),
    encoding: 'utf8',
  });
  assert.equal(packed.status, 0, packed.stderr);
  amendFixture(appRoot);
  amendFixture(shellRoot);
  amendFixture(frameworkRoot);
  return {
    root,
    appRoot,
    shellRoot,
    frameworkRoot,
    releaseSetPath,
    notesPath,
    evidencePath,
    payloadRoot,
    baseImageIndexPath,
    codexTarballPath,
  };
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
    '--source-cutoff-observed-at', '2026-07-23T00:00:00.000Z',
    '--frozen-base-release-set-generation', '26.7.20',
    '--frozen-base-release-set-digest', `sha256:${'b'.repeat(64)}`,
    '--base-image-index', fixture.baseImageIndexPath,
    '--frozen-codex-tarball', fixture.codexTarballPath,
    '--output', output,
  ], { cwd: process.cwd(), encoding: 'utf8' });
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

function writeJsonFile(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function webuiAdapterFixture() {
  const fixture = adapterFixture();
  const requestPath = path.join(fixture.root, 'freeze-request.json');
  const frozen = runFreezeRequest(fixture, requestPath);
  assert.equal(frozen.status, 0, frozen.stderr);
  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  const bundleDigest = `sha256:${'c'.repeat(64)}`;
  const bundle = {
    ...request,
    surface_kind: 'opl_release_bundle.v1',
    bundle_digest: bundleDigest,
  };
  const bundlePath = path.join(fixture.root, 'release-bundle.json');
  writeJsonFile(bundlePath, bundle);
  const core = {
    schema: 'opl_app_webui_build_input.v1',
    release: { version: request.release.version, bundle_digest: bundleDigest, cohort_ref: bundleDigest },
    source_cutoff: request.source_cutoff,
    cohort: {
      app_sha: request.sources.app.source_commit,
      shell_sha: request.sources.shell.source_commit,
      framework_sha: request.sources.framework.source_commit,
    },
    platform: { os: 'linux', architecture: 'amd64' },
    inputs: request.frozen_build_inputs,
  };
  const buildInput = {
    ...core,
    content_fingerprint: `sha256:${crypto.createHash('sha256').update(canonicalJson(core)).digest('hex')}`,
  };
  const buildInputPath = path.join(fixture.root, 'build-input.json');
  writeJsonFile(buildInputPath, buildInput);
  const buildInputDigest = sha256(buildInputPath);
  const imageDigest = `sha256:${'d'.repeat(64)}`;
  const carrier = {
    schema: 'opl_app_webui_release_carrier.v1',
    release: buildInput.release,
    source_cutoff: buildInput.source_cutoff,
    cohort: buildInput.cohort,
    build_input: {
      schema: 'opl_app_webui_build_input.v1',
      manifest_digest: buildInputDigest,
      content_fingerprint: buildInput.content_fingerprint,
    },
    carrier: {
      carrier_id: 'docker_webui',
      carrier_kind: 'oci_image',
      package_profile: 'webui-full',
      ref: `ghcr.io/gaofeng21cn/one-person-lab-webui@${imageDigest}`,
      digest: imageDigest,
      size_bytes: 123456,
      content_fingerprint: buildInput.content_fingerprint,
      os: 'linux',
      architecture: 'amd64',
    },
    qualification: {
      schema: 'opl_app_webui_runtime_qualification.v1',
      status: 'passed',
      build_stage: 'webui_built',
      qualification_stage: 'webui_qualified',
      image_digest: imageDigest,
      build_input_digest: buildInputDigest,
      content_fingerprint: buildInput.content_fingerprint,
      runtime_summary_sha256: `sha256:${'e'.repeat(64)}`,
      registry_readback_sha256: `sha256:${'f'.repeat(64)}`,
      runtime_image_id: `sha256:${'1'.repeat(64)}`,
    },
  };
  const carrierPath = path.join(fixture.root, 'opl-webui-carrier.json');
  writeJsonFile(carrierPath, carrier);
  return { ...fixture, bundlePath, buildInputPath, carrierPath, bundle, buildInput, carrier };
}

function runWebuiQualification(
  fixture: ReturnType<typeof webuiAdapterFixture>,
  output: string,
  evidenceFiles = ['build-input.json', 'carrier-receipt.json', 'runtime-summary.json', 'registry-readback.json'],
) {
  const evidenceBase = 'github-actions:gaofeng21cn/one-person-lab-app/runs/42/artifacts/webui-carrier';
  const args = [
    '--experimental-strip-types',
    path.join(process.cwd(), 'scripts', 'framework-release-adapter.ts'),
    'qualification-receipt',
    '--bundle', fixture.bundlePath,
    '--track', 'webui',
    '--webui-build-input', fixture.buildInputPath,
    '--webui-carrier', fixture.carrierPath,
    '--output', output,
  ];
  for (const file of evidenceFiles) args.push('--evidence-ref', `${evidenceBase}#${file}`);
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
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

function runPortableStandardBuildReceiptStep(jobName: string, receiptFixture: number | 'symlink-only') {
  const step = workflowStep(
    '_release-standard-publish.yml',
    jobName,
    'Materialize unique Standard build receipt for portable recovery',
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-standard-receipt-transport-'));
  const sourceBytes = Buffer.from('exact App-owned Standard build receipt\n');
  try {
    fs.mkdirSync(path.join(root, 'imported-checkpoint'), { recursive: true });
    if (receiptFixture === 'symlink-only') {
      const receiptDir = path.join(root, 'imported-checkpoint', 'symlink-source');
      const targetPath = path.join(root, 'receipt-target.json');
      fs.mkdirSync(receiptDir, { recursive: true });
      fs.writeFileSync(targetPath, sourceBytes);
      fs.symlinkSync(targetPath, path.join(receiptDir, 'standard-build-receipt.json'));
    } else {
      for (let index = 0; index < receiptFixture; index += 1) {
        const receiptDir = path.join(root, 'imported-checkpoint', `source-${index}`);
        fs.mkdirSync(receiptDir, { recursive: true });
        fs.writeFileSync(
          path.join(receiptDir, 'standard-build-receipt.json'),
          index === 0 ? sourceBytes : Buffer.from(`conflicting receipt ${index}\n`),
        );
      }
    }
    const result = spawnSync('bash', ['-euo', 'pipefail', '-c', String(step.run)], {
      cwd: root,
      encoding: 'utf8',
    });
    const outputPath = path.join(root, 'standard-build-receipt.json');
    return {
      result,
      sourceBytes,
      outputBytes: fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null,
    };
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
  assert.match(stableSource, /--started-at "\$operation_created_at"/);
  assert.match(stableSource, /operation_started_at="\$\(jq -er \.started_at release-operation-admission\.json\)"/);
  assert.match(stableSource, /operation_deadline_at="\$\(jq -er \.deadline_at release-operation-admission\.json\)"/);
  assert.doesNotMatch(stableSource, /operation_started_at="\$\(timeout[\s\S]*actions\/runs\/\$GITHUB_RUN_ID/);
  assert.match(stableSource, /if: \$\{\{ steps\.admission\.outputs\.operation != 'resume_standard' \}\}/);
  assert.doesNotMatch(stableSource, /run_started_at/);
  const bundleSource = readWorkflow('_release-bundle.yml');
  assert.match(bundleSource, /--started-at "\$operation_created_at"/);
  assert.match(bundleSource, /operation_started_at="\$\(jq -er \.started_at nightly-operation-request\.json\)"/);
  assert.match(bundleSource, /operation_deadline_at="\$\(jq -er \.deadline_at nightly-operation-request\.json\)"/);
  assert.doesNotMatch(bundleSource, /operation_started_at="\$\(timeout[\s\S]*actions\/runs\/\$GITHUB_RUN_ID/);
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
  assert.equal(workflow.jobs.freeze['runs-on'], 'macos-latest');
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

  const freezeMaterialize = workflowStep(
    '_release-bundle.yml',
    'freeze',
    'Materialize exact AionCore for Bundle freeze',
  );
  assert.equal(freezeMaterialize.if, '${{ inputs.include_full }}');
  assert.equal(freezeMaterialize['working-directory'], 'shells/aionui');
  assert.equal(freezeMaterialize.env.AIONUI_BACKEND_ARCH, 'arm64');
  assert.equal(freezeMaterialize.env.AIONUI_BACKEND_RUN_ID, '');
  assert.equal(
    freezeMaterialize.env.AIONUI_AIONCORE_CACHE_DIR,
    '${{ runner.temp }}/opl-release-freeze-aioncore-${{ github.run_id }}',
  );
  const freezeMaterializeScript = String(freezeMaterialize.run);
  assert.match(freezeMaterializeScript, /test "\$\(uname -s\)" = Darwin/);
  assert.match(freezeMaterializeScript, /test "\$\(uname -m\)" = arm64/);
  assert.match(freezeMaterializeScript, /test ! -e resources\/bundled-aioncore\/darwin-arm64/);
  assert.match(freezeMaterializeScript, /package\.json.*aioncoreVersion/s);
  assert.match(freezeMaterializeScript, /\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$/);
  assert.match(freezeMaterializeScript, /AIONUI_BACKEND_VERSION="\$aioncore_version" node scripts\/prepareAioncore\.js/);
  assert.match(freezeMaterializeScript, /resources\/bundled-aioncore\/darwin-arm64\/manifest\.json/);
  assert.match(freezeMaterializeScript, /resources\/bundled-aioncore\/darwin-arm64\/managed-resources\/manifest\.json/);
  assert.doesNotMatch(freezeMaterializeScript, /latest|AIONUI_BACKEND_RUN_ID/);
  assert.equal(freezeMaterializeScript, materializeScript);

  for (const script of [materializeScript, freezeMaterializeScript]) {
    assert.match(script, /managed_runtime\.aioncore\.version/);
    assert.match(script, /managed_runtime\.aioncore\.archive_sha256/);
    assert.match(script, /test "\$receipt_version" = "\$aioncore_version"/);
    assert.match(script, /releases\/download\/\$\{aioncore_version\}\/\$\{archive_name\}/);
    assert.match(script, /shasum -a 256 -c -/);
    assert.match(script, /find "\$archive_extract" -type f -name aioncore/);
    assert.match(script, /cmp "\$verified_archive_binary" resources\/bundled-aioncore\/darwin-arm64\/aioncore/);
    assert.doesNotMatch(script, /AIONCORE_MANIFEST_SOURCE_DATE|manifest\.generatedAt/);
  }

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
    /--full-payload-authority "\$RUNNER_TEMP\/opl-release-full-notes-authority\/notes-full-payload-authority\.json"/,
  );
  assert.doesNotMatch(script, /--full-package-manifest/);
  assert.match(script, /notes_root="\$RUNNER_TEMP\/opl-release-prepared-notes-\$GITHUB_RUN_ID"/);
  assert.match(script, /--evidence-output "\$notes_root\/notes-evidence\.json"/);
  assert.doesNotMatch(script, /One-Person-Lab-Manual|dist\/opl-full-release|full-package-manifest\.json/);

  const freezeScript = String(workflowStep(
    '_release-bundle.yml',
    'freeze',
    'Freeze canonical Framework Bundle',
  ).run);
  assert.match(
    freezeScript,
    /--notes-full-payload-authority "\$RUNNER_TEMP\/opl-release-full-notes-authority\/notes-full-payload-authority\.json"/,
  );
  assert.match(freezeScript, /--notes "\$notes_root\/notes\.md"/);
  assert.match(freezeScript, /--notes-evidence "\$notes_root\/notes-evidence\.json"/);
  assert.ok(
    freezeScript.indexOf('scripts/framework-release-adapter.ts freeze-request')
      < freezeScript.indexOf('cp "$notes_root/notes-evidence.json" notes-evidence.json'),
  );

  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const binding = releaseContract.release_bundle_control_plane.prepared_notes.full_payload_authority_binding;
  assert.equal(binding.schema, 'opl_app_release_notes_full_payload_authority.v1');
  assert.equal(binding.evidence_digest_path, 'payload.full_payload_authority_sha256');
  assert.equal(binding.comparison, 'canonical_json_exact_field_set_and_values');
  assert.equal(binding.freeze_adapter_consumes_same_file, true);
  assert.ok(
    source.indexOf('- name: Materialize exact Shell AionCore authority')
      < source.indexOf('- name: Derive deep-validated Full notes payload authority'),
  );
  assert.ok(
    source.indexOf('- name: Verify Full notes payload authority transport')
      < source.indexOf('- name: Prepare and validate online AI notes'),
  );
  assert.ok(
    source.indexOf('- name: Materialize exact AionCore for Bundle freeze')
      < source.indexOf('- name: Prepare and validate online AI notes'),
  );
  assert.ok(
    source.indexOf('- name: Materialize exact AionCore for Bundle freeze')
      < source.indexOf('- name: Freeze canonical Framework Bundle'),
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
    'webui-carrier',
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
    [bundle, new Set(['webui-carrier', 'publish-standard'])],
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

test('every recoverable Standard unknown artifact carries exactly one original build receipt', () => {
  const workflow = parseWorkflow('_release-standard-publish.yml');
  const jobs = [
    {
      name: 'publish-standard-nonlatest',
      uploadStep: 'Upload Standard publication receipt',
      artifact: 'opl-release-standard-published-${{ github.run_id }}',
      checkpoint: 'standard-github-unknown-checkpoint',
    },
    {
      name: 'publish-homebrew-standard',
      uploadStep: 'Upload Standard Homebrew publication receipt',
      artifact: 'opl-release-homebrew-standard-${{ github.run_id }}',
      checkpoint: 'homebrew-unknown-checkpoint',
    },
    {
      name: 'activate-latest',
      uploadStep: 'Upload Latest activation receipt',
      artifact: 'opl-release-activation-${{ github.run_id }}',
      checkpoint: 'latest-unknown-checkpoint',
    },
  ] as const;

  for (const job of jobs) {
    const positive = runPortableStandardBuildReceiptStep(job.name, 1);
    assert.equal(positive.result.status, 0, `${job.name}: ${positive.result.stderr}`);
    assert.deepEqual(positive.outputBytes, positive.sourceBytes, job.name);

    for (const receiptCount of [0, 2]) {
      const rejected = runPortableStandardBuildReceiptStep(job.name, receiptCount);
      assert.notEqual(rejected.result.status, 0, `${job.name}:${receiptCount}`);
      assert.equal(rejected.outputBytes, null, `${job.name}:${receiptCount}`);
      assert.match(
        `${rejected.result.stdout}\n${rejected.result.stderr}`,
        new RegExp(`exactly one App-owned standard-build-receipt\\.json; found ${receiptCount}`),
        `${job.name}:${receiptCount}`,
      );
    }

    const symlinkOnly = runPortableStandardBuildReceiptStep(job.name, 'symlink-only');
    assert.notEqual(symlinkOnly.result.status, 0, `${job.name}:symlink-only`);
    assert.equal(symlinkOnly.outputBytes, null, `${job.name}:symlink-only`);
    assert.match(
      `${symlinkOnly.result.stdout}\n${symlinkOnly.result.stderr}`,
      /exactly one App-owned standard-build-receipt\.json; found 0/,
      `${job.name}:symlink-only`,
    );

    const upload = workflow.jobs[job.name].steps.find(
      (step: Record<string, unknown>) => step.name === job.uploadStep,
    );
    assert.ok(upload, `${job.name}:${job.uploadStep}`);
    assert.equal(upload.with.name, job.artifact);
    assert.match(String(upload.with.path), new RegExp(`(?:^|\\n)${job.checkpoint}(?:\\n|$)`));
    assert.match(String(upload.with.path), /(?:^|\n)standard-build-receipt\.json(?:\n|$)/);
  }

  const standardFailure = String(
    workflowStep(
      '_release-standard-publish.yml',
      'publish-standard-nonlatest',
      'Persist typed Standard publication failure',
    ).run,
  );
  assert.match(standardFailure, /opl-release-standard-published-\$\{GITHUB_RUN_ID\}/);
  assert.match(standardFailure, /resume_source:\(if \$framework_reconcile_authorized then \{run_id:\$resume_source_run_id,artifact:\$resume_source_artifact\}/);

  const homebrewMutation = String(
    workflowStep(
      '_release-standard-publish.yml',
      'publish-homebrew-standard',
      'Publish one digest-bound Standard cask commit',
    ).run,
  );
  assert.match(homebrewMutation, /true "opl-release-homebrew-standard-\$\{GITHUB_RUN_ID\}"/);
  assert.match(homebrewMutation, /resume_source_run_id:\(if \$resume_source_artifact == "" then null else \$resume_source_run_id end\)/);

  const latestFailure = String(
    workflowStep(
      '_release-standard-publish.yml',
      'activate-latest',
      'Persist typed Latest activation failure',
    ).run,
  );
  assert.match(latestFailure, /opl-release-activation-\$\{GITHUB_RUN_ID\}/);
  assert.match(latestFailure, /resume_source_run_id:\(if \$framework_reconcile_authorized then \$resume_source_run_id else null end\)/);
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
    assert.deepEqual(request.source_cutoff, {
      observed_at: '2026-07-23T00:00:00.000Z',
      policy: 'single_read_at_freeze_admission',
      frozen_base_release_set: { generation: '26.7.20', digest: `sha256:${'b'.repeat(64)}` },
      post_freeze_remote_refresh_allowed: false,
      later_authority_advancement_invalidates_bundle: false,
    });
    assert.deepEqual(
      request.frozen_build_inputs.map((descriptor: Record<string, unknown>) => descriptor.id),
      [
        'app_source',
        'base_image',
        'codex_cli',
        'dockerfile',
        'first_party_packages',
        'framework_seed',
        'opl_flow',
        'qualification_harness',
        'shell_webui_source',
      ],
    );
    assert.equal(new Set(request.frozen_build_inputs.map((descriptor: Record<string, unknown>) => descriptor.id)).size, 9);
    for (const descriptor of request.frozen_build_inputs) {
      assert.equal(typeof descriptor.ref, 'string');
      assert.match(descriptor.digest, /^sha256:[0-9a-f]{64}$/);
      assert.equal(Number.isSafeInteger(descriptor.size_bytes) && descriptor.size_bytes > 0, true);
    }
    assert.deepEqual(request.tracks.webui, {
      required_asset_names: ['opl-webui-carrier.json'],
      required_for_latest: true,
      additive_only: false,
      updater_metadata_allowed: false,
    });
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

test('the App adapter fails closed on duplicate base descriptors and Codex package identity drift', () => {
  const duplicate = adapterFixture();
  try {
    const index = JSON.parse(fs.readFileSync(duplicate.baseImageIndexPath, 'utf8'));
    index.manifests.push({ ...index.manifests[0] });
    writeJsonFile(duplicate.baseImageIndexPath, index);
    const result = runFreezeRequest(duplicate, path.join(duplicate.root, 'duplicate-base.json'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exactly one linux\/amd64 descriptor/);
  } finally {
    fs.rmSync(duplicate.root, { recursive: true, force: true });
  }

  const codexDrift = adapterFixture();
  try {
    const packageJson = path.join(codexDrift.root, 'codex-package', 'package', 'package.json');
    writeJsonFile(packageJson, { name: '@openai/codex', version: '9.9.9' });
    const packed = spawnSync('tar', ['-czf', codexDrift.codexTarballPath, 'package'], {
      cwd: path.join(codexDrift.root, 'codex-package'),
      encoding: 'utf8',
    });
    assert.equal(packed.status, 0, packed.stderr);
    const result = runFreezeRequest(codexDrift, path.join(codexDrift.root, 'codex-drift.json'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /package identity does not match/);
  } finally {
    fs.rmSync(codexDrift.root, { recursive: true, force: true });
  }
});

test('the App adapter maps exact WebUI receipt bytes into Framework qualification and rejects identity drift', () => {
  const positive = webuiAdapterFixture();
  try {
    const output = path.join(positive.root, 'webui-qualification.json');
    const result = runWebuiQualification(positive, output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(receipt.track, 'webui');
    assert.deepEqual(receipt.subject, {
      asset_name: 'opl-webui-carrier.json',
      size_bytes: fs.statSync(positive.carrierPath).size,
      sha256: sha256(positive.carrierPath),
    });
    assert.equal(receipt.qualification.harness_sha256, positive.bundle.frozen_build_inputs[7].digest);
    assert.equal(receipt.qualification.evidence_refs.length, 4);
  } finally {
    fs.rmSync(positive.root, { recursive: true, force: true });
  }

  const cases = [
    {
      name: 'descriptor order',
      mutate(fixture: ReturnType<typeof webuiAdapterFixture>) {
        fixture.buildInput.inputs = [...fixture.buildInput.inputs].reverse();
        writeJsonFile(fixture.buildInputPath, fixture.buildInput);
      },
      pattern: /exact-nine descriptors|canonical unique exact-nine descriptor order/,
    },
    {
      name: 'descriptor ref',
      mutate(fixture: ReturnType<typeof webuiAdapterFixture>) {
        fixture.buildInput.inputs[0].ref = ' ';
        writeJsonFile(fixture.bundlePath, fixture.bundle);
        writeJsonFile(fixture.buildInputPath, fixture.buildInput);
      },
      pattern: /ref\/digest\/size identity/,
    },
    {
      name: 'descriptor digest',
      mutate(fixture: ReturnType<typeof webuiAdapterFixture>) {
        fixture.buildInput.inputs[0].digest = 'sha256:invalid';
        writeJsonFile(fixture.bundlePath, fixture.bundle);
        writeJsonFile(fixture.buildInputPath, fixture.buildInput);
      },
      pattern: /ref\/digest\/size identity/,
    },
    {
      name: 'descriptor size',
      mutate(fixture: ReturnType<typeof webuiAdapterFixture>) {
        fixture.buildInput.inputs[0].size_bytes = 0;
        writeJsonFile(fixture.bundlePath, fixture.bundle);
        writeJsonFile(fixture.buildInputPath, fixture.buildInput);
      },
      pattern: /ref\/digest\/size identity/,
    },
    {
      name: 'duplicate descriptor',
      mutate(fixture: ReturnType<typeof webuiAdapterFixture>) {
        fixture.buildInput.inputs = fixture.buildInput.inputs.map((entry: unknown) => structuredClone(entry));
        fixture.buildInput.inputs[8] = structuredClone(fixture.buildInput.inputs[0]);
        writeJsonFile(fixture.buildInputPath, fixture.buildInput);
      },
      pattern: /exact-nine descriptors|canonical unique exact-nine descriptor order/,
    },
    {
      name: 'carrier ref',
      mutate(fixture: ReturnType<typeof webuiAdapterFixture>) {
        fixture.carrier.carrier.ref = `ghcr.io/gaofeng21cn/one-person-lab-webui@sha256:${'2'.repeat(64)}`;
        writeJsonFile(fixture.carrierPath, fixture.carrier);
      },
      pattern: /ref and digest/,
    },
    {
      name: 'qualification digest',
      mutate(fixture: ReturnType<typeof webuiAdapterFixture>) {
        fixture.carrier.qualification.image_digest = `sha256:${'2'.repeat(64)}`;
        writeJsonFile(fixture.carrierPath, fixture.carrier);
      },
      pattern: /qualified image digest/,
    },
    {
      name: 'carrier size',
      mutate(fixture: ReturnType<typeof webuiAdapterFixture>) {
        fixture.carrier.carrier.size_bytes = 0;
        writeJsonFile(fixture.carrierPath, fixture.carrier);
      },
      pattern: /image size/,
    },
    {
      name: 'receipt release',
      mutate(fixture: ReturnType<typeof webuiAdapterFixture>) {
        fixture.carrier.release.bundle_digest = `sha256:${'2'.repeat(64)}`;
        writeJsonFile(fixture.carrierPath, fixture.carrier);
      },
      pattern: /carrier release/,
    },
    {
      name: 'extra qualification field',
      mutate(fixture: ReturnType<typeof webuiAdapterFixture>) {
        fixture.carrier.qualification.unexpected = true;
        writeJsonFile(fixture.carrierPath, fixture.carrier);
      },
      pattern: /qualification does not contain the exact contract fields/,
    },
  ];
  for (const scenario of cases) {
    const fixture = webuiAdapterFixture();
    try {
      scenario.mutate(fixture);
      const result = runWebuiQualification(fixture, path.join(fixture.root, 'rejected.json'));
      assert.notEqual(result.status, 0, scenario.name);
      assert.match(result.stderr, scenario.pattern, scenario.name);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  }

  const missingEvidence = webuiAdapterFixture();
  try {
    const result = runWebuiQualification(
      missingEvidence,
      path.join(missingEvidence.root, 'missing-evidence.json'),
      ['build-input.json', 'carrier-receipt.json', 'runtime-summary.json'],
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exact four durable carrier evidence refs/);
  } finally {
    fs.rmSync(missingEvidence.root, { recursive: true, force: true });
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
      schema: 'opl_app_release_notes_evidence.v1',
      payload: { include_full_package: true },
    })}\n`);
    const result = runFreezeRequest(fixture, path.join(fixture.root, 'mismatched-notes-intent.json'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Full intent does not match the admitted Release Bundle request/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('unified Stable freezes once, builds Desktop and WebUI in parallel, and joins at stable_qualified', () => {
  const workflow = parseWorkflow('_release-bundle.yml');
  const source = readWorkflow('_release-bundle.yml');
  const adapterSource = readAdapter();
  assert.deepEqual(workflow.jobs['standard-build'].needs, ['freeze']);
  assert.deepEqual(workflow.jobs['webui-carrier'].needs, ['freeze']);
  assert.deepEqual(
    workflow.jobs['checkpoint-standard'].needs,
    ['freeze', 'standard-build', 'standard-qualification', 'webui-carrier'],
  );
  assert.equal(
    workflow.jobs['webui-carrier'].with.frozen_build_input_json,
    '${{ needs.freeze.outputs.webui_build_input_json }}',
  );
  assert.equal(
    workflow.jobs['webui-carrier'].with.frozen_codex_artifact_name,
    '${{ needs.freeze.outputs.frozen_codex_artifact_name }}',
  );
  for (const id of [
    'app_source',
    'base_image',
    'codex_cli',
    'dockerfile',
    'first_party_packages',
    'framework_seed',
    'opl_flow',
    'qualification_harness',
    'shell_webui_source',
  ]) {
    assert.match(adapterSource, new RegExp(id));
  }
  assert.equal((source.match(/oras manifest fetch --descriptor "\$\{carrier\}:latest-stable"/g) ?? []).length, 1);
  assert.doesNotMatch(source, /oras login|--password-stdin/);
  assert.match(source, /single_read_at_freeze_admission|--source-cutoff-observed-at/);
  assert.match(source, /--frozen-base-release-set-generation/);
  assert.match(source, /--base-image-index/);
  assert.match(source, /--frozen-codex-tarball/);
  assert.match(source, /cmp "\$webui_carrier_receipt" webui-assets\/opl-webui-carrier\.json/);
  assert.match(source, /--bundle bundle\/release-bundle\.json --track webui --outcome complete/);
  assert.match(source, /qualification-receipt[\s\S]*--track webui/);
  assert.match(source, /release verify \\\n\s+--bundle "\$BUNDLE_DIGEST" \\\n\s+--qualification-receipt webui-qualification-receipt\.json/);
  assert.doesNotMatch(source, /release verify \\\n\s+--bundle "\$BUNDLE_DIGEST" --track webui/);
  assert.match(source, /checkpoint_stage checkpoint-export\.json\)" = stable_qualified/);
  assert.doesNotMatch(
    source.slice(source.indexOf('Freeze canonical Framework Bundle')),
    /npm view[^\n]+latest|git ls-remote[^\n]+(?:shells\/aionui|framework-source)[^\n]+after-freeze/,
  );
});

test('Standard moving pointers require fresh WebUI readback and the Framework stable promotion barrier', () => {
  const workflow = parseWorkflow('_release-standard-publish.yml');
  const source = readWorkflow('_release-standard-publish.yml');
  assert.ok(workflow.jobs['publish-homebrew-standard'].needs.includes('remote-digest-verify'));
  assert.ok(workflow.jobs['activate-latest'].needs.includes('remote-digest-verify'));
  assert.match(source, /docker buildx imagetools inspect "\$webui_ref"/);
  assert.match(source, /docker buildx imagetools inspect "\$latest_webui_ref"/);
  assert.equal((source.match(/--track webui --outcome complete/g) ?? []).length, 2);
  assert.equal((source.match(/stable_promotion_barrier\.satisfied == true/g) ?? []).length, 2);
  assert.equal((source.match(/required_tracks == \["standard","webui"\]/g) ?? []).length, 2);
  assert.match(source, /Unified Stable publish requires an exact stable_qualified checkpoint/);
  assert.match(source, /Legacy Standard publish requires a checkpoint at or after standard_qualified/);
  assert.equal((source.match(/if jq -e '\.tracks\.webui' "\$bundle" >\/dev\/null; then/g) ?? []).length, 5);
  assert.equal((source.match(/\.release_bundle_status\.tracks\.standard\.reconcile_required == false/g) ?? []).length, 4);
  assert.match(source, /find "\$checkpoint_dir" -type f -name opl-webui-carrier\.json/);
  assert.doesNotMatch(source, /oras tag[^\n]+stable|docker buildx imagetools create[^\n]+stable/);
});
