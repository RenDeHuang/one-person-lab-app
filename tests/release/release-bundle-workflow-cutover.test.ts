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
  fs.writeFileSync(evidencePath, '{"surface_kind":"opl_app_release_notes_evidence.v1"}\n');
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
    '--release-set-manifest', fixture.releaseSetPath,
    '--output', output,
  ], { cwd: process.cwd(), encoding: 'utf8' });
}

const legacyReleaseWorkflows = [
  'desktop-release-cleanup-drafts.yml',
  'desktop-release-diagnostics.yml',
  'desktop-release-full-addon.yml',
  'desktop-release-promote.yml',
  'desktop-release.yml',
  'full-first-install-release.yml',
  'full-runtime-cache-warmup.yml',
  'opl-first-run-vm.yml',
  'release-verify-remote.yml',
  'opl-updater-upgrade-vm.yml',
] as const;

test('Stable is the only manual release entry and Nightly is schedule-only', () => {
  const stable = parseWorkflow('release-stable.yml');
  const nightly = parseWorkflow('release-nightly.yml');
  const pipeline = parseWorkflow('_release-bundle.yml');

  assert.deepEqual(Object.keys(stable.on), ['workflow_dispatch']);
  assert.ok(stable.on.workflow_dispatch.inputs.version);
  assert.equal(stable.jobs.release.uses, './.github/workflows/_release-bundle.yml');
  assert.equal(stable.jobs.release.with.channel, 'stable');

  assert.deepEqual(Object.keys(nightly.on), ['schedule']);
  assert.ok(Array.isArray(nightly.on.schedule));
  assert.equal(nightly.jobs.release.uses, './.github/workflows/_release-bundle.yml');
  assert.equal(nightly.jobs.release.with.channel, 'nightly');

  assert.deepEqual(Object.keys(pipeline.on), ['workflow_call']);
  for (const name of legacyReleaseWorkflows) {
    const source = readWorkflow(name);
    assert.doesNotMatch(source, /^\s*workflow_dispatch:/m, `${name} retains a manual entry`);
  }
});

test('the reusable DAG gates Latest on exact predecessor upgrade and Standard Homebrew readback', () => {
  const jobs = parseWorkflow('_release-bundle.yml').jobs;

  assert.deepEqual(jobs['cold-preflight'].needs, ['freeze-inputs']);
  assert.deepEqual(jobs['prepare-notes'].needs, ['cold-preflight', 'freeze-inputs']);
  assert.deepEqual(jobs.freeze.needs, ['cold-preflight', 'prepare-notes', 'freeze-inputs']);
  assert.deepEqual(jobs['standard-build'].needs, ['freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['standard-qualification'].needs, ['freeze', 'freeze-inputs', 'standard-build']);
  assert.deepEqual(jobs['bind-standard'].needs, ['freeze', 'freeze-inputs', 'prepare-notes', 'standard-build', 'standard-qualification']);
  assert.deepEqual(jobs['publish-standard-nonlatest'].needs, ['bind-standard', 'freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['remote-digest-verify'].needs, ['publish-standard-nonlatest', 'freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['updater-upgrade-qualification'].needs, ['remote-digest-verify', 'freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['publish-homebrew-standard'].needs, ['updater-upgrade-qualification', 'freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['homebrew-standard-vm'].needs, ['publish-homebrew-standard', 'freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['homebrew-standard-readback'].needs, ['homebrew-standard-vm', 'publish-homebrew-standard', 'freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['publish-latest'].needs, [
    'remote-digest-verify',
    'updater-upgrade-qualification',
    'homebrew-standard-readback',
    'freeze',
    'freeze-inputs',
  ]);
  assert.equal(jobs['installed-updater-readback'], undefined);

  assert.match(readWorkflow('_release-bundle.yml'), /opl release freeze/);
  assert.match(readWorkflow('_release-bundle.yml'), /opl release build/);
  assert.match(readWorkflow('_release-bundle.yml'), /opl release verify/);
  assert.match(readWorkflow('_release-bundle.yml'), /opl release publish/);
  assert.match(readWorkflow('_release-bundle.yml'), /opl release reconcile/);
  assert.match(readWorkflow('_release-bundle.yml'), /release:notes:prepare/);
  assert.match(readWorkflow('_release-bundle.yml'), /opl-updater-upgrade-vm\.yml/);
  assert.match(readWorkflow('_release-bundle.yml'), /OPL_HOMEBREW_TAP_TOKEN/);
  assert.doesNotMatch(readWorkflow('_release-bundle.yml'), /release[_ -]broker|broker[_ -]admission/i);
});

test('source freeze is canonical and every Framework CLI job provisions its runtime', () => {
  const source = readWorkflow('_release-bundle.yml');
  const jobs = parseWorkflow('_release-bundle.yml').jobs as Record<string, Record<string, any>>;

  assert.match(source, /git -C app-source ls-remote origin refs\/heads\/main/);
  assert.match(source, /git -C app-source ls-remote --tags origin 'refs\/tags\/v\*-nightly\*'/);
  assert.doesNotMatch(source, /(?:^|\s)git ls-remote --tags origin/m);

  for (const [jobId, job] of Object.entries(jobs)) {
    if (!Array.isArray(job.steps)) continue;
    const serialized = JSON.stringify(job.steps);
    if (!serialized.includes('framework-source/bin/opl release')) continue;
    assert.match(serialized, /actions\/setup-node@/u, `${jobId} must provision Node for the Framework CLI`);
    assert.match(
      serialized,
      /npm --prefix framework-source ci --ignore-scripts/u,
      `${jobId} must install Framework runtime dependencies`,
    );
    if (serialized.includes('framework-source/bin/opl release freeze')) {
      assert.match(
        serialized,
        /--source-root framework-source/u,
        `${jobId} must resolve Release Set and Package refs under the frozen Framework checkout`,
      );
    }
  }
});

test('Full is additive and only protected publish jobs receive contents write', () => {
  const workflow = parseWorkflow('_release-bundle.yml');
  const jobs = workflow.jobs;

  assert.deepEqual(jobs['full-build'].needs, ['publish-latest', 'freeze', 'freeze-inputs']);
  assert.deepEqual(jobs['full-qualification'].needs, ['freeze', 'freeze-inputs', 'full-build']);
  assert.deepEqual(jobs['bind-full'].needs, ['publish-latest', 'freeze', 'freeze-inputs', 'full-build', 'full-qualification']);
  assert.deepEqual(jobs['publish-full'].needs, ['bind-full', 'freeze', 'freeze-inputs']);

  const writeJobs = new Set([
    'publish-standard-nonlatest',
    'publish-latest',
    'publish-full',
  ]);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  for (const [jobId, job] of Object.entries(jobs) as Array<[string, Record<string, any>]>) {
    const contents = job.permissions?.contents ?? 'read';
    if (writeJobs.has(jobId)) {
      assert.equal(contents, 'write', `${jobId} must own its explicit mutation permission`);
      assert.equal(job.environment, 'release-stable', `${jobId} must use the protected environment`);
    } else {
      assert.notEqual(contents, 'write', `${jobId} must remain read-only`);
    }
  }

  const source = readWorkflow('_release-bundle.yml');
  assert.match(source, /release_bundle_digest/);
  assert.match(source, /Append exact Full bytes only/);
  assert.doesNotMatch(source, /publish-full[\s\S]*latest-arm64-mac\.yml/);
});

test('retired broker workflows are read-only rejection surfaces', () => {
  for (const name of [
    'desktop-release-cleanup-drafts.yml',
    'desktop-release-full-addon.yml',
    'desktop-release-promote.yml',
    'desktop-release.yml',
  ]) {
    const workflow = parseWorkflow(name);
    assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.match(readWorkflow(name), /exit 1/);
    assert.doesNotMatch(readWorkflow(name), /contents: write|workflow_dispatch|verify-release-broker/);
  }
});

test('the remote canary has no manual trigger and no write permission', () => {
  const canary = parseWorkflow('release-bundle-canary.yml');
  assert.ok(canary.on.push);
  assert.equal(canary.on.workflow_dispatch, undefined);
  assert.deepEqual(canary.permissions, { contents: 'read' });
  for (const job of Object.values(canary.jobs) as Array<Record<string, any>>) {
    assert.notEqual(job.permissions?.contents, 'write');
  }
  assert.doesNotMatch(readWorkflow('release-bundle-canary.yml'), /gh release|release upload|contents: write/);
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
      assert.equal(
        request.packages[packageId].manifest_ref,
        `contracts/opl-framework/packages/${packageId}.json`,
      );
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
