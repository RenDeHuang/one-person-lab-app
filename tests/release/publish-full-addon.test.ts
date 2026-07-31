import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { planFullAddonUpload } from '../../scripts/publish-full-addon.ts';

const local = {
  path: '/tmp/One-Person-Lab-Full-26.7.18-mac-arm64.dmg',
  name: 'One-Person-Lab-Full-26.7.18-mac-arm64.dmg',
  size: 42,
  sha256: 'a'.repeat(64),
};

const hostedFullBundle = {
  surface_kind: 'opl_release_bundle.v1',
  bundle_digest: `sha256:${'b'.repeat(64)}`,
  release: { version: '26.7.18' },
  identity_mode: 'app_standard_compatibility',
  package_compatibility: { abi: 'opl_packages.v1', version_range: '>=0.1.0 <1.0.0' },
  sources: {
    app: { source_commit: 'c'.repeat(40) },
    shell: { source_commit: 'd'.repeat(40) },
    framework: { source_commit: 'e'.repeat(40) },
  },
  tracks: {
    full: { required_asset_names: [local.name] },
  },
};

function hostedFullQualification(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'opl_app_hosted_full_core_qualification.v1',
    status: 'passed',
    execution: {
      execution_class: 'github_hosted',
      runner: 'macos-14',
      run_id: '30280000001',
      run_attempt: 1,
    },
    release: {
      version: hostedFullBundle.release.version,
    },
    subject: {
      asset_name: local.name,
      size_bytes: local.size,
      sha256: `sha256:${local.sha256}`,
    },
    manifest: {
      asset_name: 'opl-release-manifest.json',
      sha256: `sha256:${'f'.repeat(64)}`,
    },
    verification: {
      dmg_verified: true,
      read_only_mount: true,
      exact_single_app: true,
      codesign: true,
      stapler: true,
      gatekeeper: true,
      manifest_bound: true,
      full_runtime_native_trust: true,
    },
    evidence_ref: 'opl-hosted-full-core-qualification-30280000001',
    ...overrides,
  };
}

function runHostedFullQualification(bundle: unknown, qualification: unknown) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-hosted-full-qualification-'));
  const bundlePath = path.join(root, 'bundle.json');
  const qualificationPath = path.join(root, 'qualification.json');
  const outputPath = path.join(root, 'output.json');
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle)}\n`);
  fs.writeFileSync(qualificationPath, `${JSON.stringify(qualification)}\n`);
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      'scripts/framework-release-adapter.ts',
      'qualification-receipt',
      '--bundle',
      bundlePath,
      '--track',
      'full',
      '--hosted-core-qualification',
      qualificationPath,
      '--output',
      outputPath,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  return {
    result,
    output: result.status === 0 ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : null,
    root,
  };
}

test('missing Full add-on asset is scheduled for additive upload', () => {
  assert.deepEqual(planFullAddonUpload([local], []), [{ ...local, action: 'upload' }]);
});

test('same Full add-on name and digest is reused idempotently', () => {
  assert.deepEqual(
    planFullAddonUpload(
      [local],
      [
        {
          name: local.name,
          size: local.size,
          digest: `sha256:${local.sha256}`,
        },
      ],
    ),
    [{ ...local, action: 'reuse' }],
  );
});

test('same Full add-on name with different bytes requires a new version', () => {
  assert.throws(
    () => planFullAddonUpload([local], [{ name: local.name, size: local.size, digest: `sha256:${'b'.repeat(64)}` }]),
    /already exists with different bytes; create a new version/,
  );
});

test('retired direct Full add-on publisher fails closed before parsing caller inputs', () => {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/publish-full-addon.ts', '--version', '26.7.21'],
    { cwd: process.cwd(), encoding: 'utf8' },
  );

  assert.equal(result.status, 2, result.stderr || result.stdout);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.schema, 'opl_app_retired_full_addon_publisher.v1');
  assert.equal(receipt.status, 'retired_fail_closed');
  assert.equal(receipt.authoritative_for_new_release, false);
  assert.equal(receipt.mutation_authorized, false);
});

test('hosted Full qualification binds the Full artifact without requiring cross-component identity', (t) => {
  const valid = runHostedFullQualification(hostedFullBundle, hostedFullQualification());
  t.after(() => fs.rmSync(valid.root, { recursive: true, force: true }));
  assert.equal(valid.result.status, 0, valid.result.stderr || valid.result.stdout);
  assert.deepEqual(valid.output.subject, {
    asset_name: local.name,
    size_bytes: local.size,
    sha256: `sha256:${local.sha256}`,
  });
  assert.deepEqual(valid.output.cohort, {
    app_sha: hostedFullBundle.sources.app.source_commit,
    shell_sha: hostedFullBundle.sources.shell.source_commit,
    framework_sha: hostedFullBundle.sources.framework.source_commit,
    identity_mode: 'app_standard_compatibility',
    package_compatibility: { abi: 'opl_packages.v1', version_range: '>=0.1.0 <1.0.0' },
  });

  const independentProvenance = runHostedFullQualification(
    hostedFullBundle,
    hostedFullQualification({
      release: { version: hostedFullBundle.release.version },
      cohort: {
        app_sha: '0'.repeat(40),
        shell_sha: '1'.repeat(40),
        framework_sha: '2'.repeat(40),
      },
    }),
  );
  t.after(() => fs.rmSync(independentProvenance.root, { recursive: true, force: true }));
  assert.equal(
    independentProvenance.result.status,
    0,
    independentProvenance.result.stderr || independentProvenance.result.stdout,
  );

  const mismatches = [
    hostedFullQualification({
      release: { version: '26.7.19' },
    }),
    hostedFullQualification({
      verification: {
        ...hostedFullQualification().verification,
        gatekeeper: false,
      },
    }),
  ];
  for (const qualification of mismatches) {
    const rejected = runHostedFullQualification(hostedFullBundle, qualification);
    t.after(() => fs.rmSync(rejected.root, { recursive: true, force: true }));
    assert.notEqual(rejected.result.status, 0);
    assert.match(
      rejected.result.stderr,
      /Hosted Full core qualification does not bind the exact Full artifact and macOS trust evidence/,
    );
  }
});

test('Full add-on workflow cannot overwrite release state or existing assets', () => {
  const stableWorkflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/release-stable.yml'), 'utf8');
  const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/_release-full-addon.yml'), 'utf8');
  const publisher = fs.readFileSync(path.join(process.cwd(), 'scripts/publish-full-addon.ts'), 'utf8');
  const fullStart = workflow.indexOf('  publish-full:');
  assert.ok(fullStart >= 0);
  const full = workflow.slice(fullStart);
  const qualificationStart = workflow.indexOf('  full-qualification:');
  const checkpointStart = workflow.indexOf('  checkpoint-full:');
  assert.ok(qualificationStart >= 0 && checkpointStart > qualificationStart);
  const qualification = workflow.slice(qualificationStart, checkpointStart);
  const source = `${full}\n${publisher}`;

  assert.match(stableWorkflow, /append-full:[\s\S]*uses: \.\/\.github\/workflows\/_release-full-addon\.yml/);
  assert.match(workflow, /full-build:[\s\S]*needs: \[restore-standard\]/);
  assert.match(qualification, /runs-on: macos-14/);
  assert.match(qualification, /hdiutil attach "\$dmg_path" -nobrowse -readonly/);
  assert.match(qualification, /opl_app_hosted_full_core_qualification\.v1/);
  assert.doesNotMatch(qualification, /opl-first-run-vm|tart\b/i);
  assert.match(workflow, /--hosted-core-qualification "\$hosted_receipt"/);
  assert.doesNotMatch(workflow, /--legacy-qualification/);
  assert.match(full, /Publish exact Full bytes as an immutable adjunct/);
  assert.match(full, /needs\.restore-standard\.outputs\.adjunct_tag/);
  assert.match(full, /carrier:\{kind:"immutable_adjunct_release",base_tag:\$base_tag,adjunct_tag:\$adjunct_tag\}/);
  assert.match(full, /framework-executor\/bin\/opl release publish/);
  assert.match(full, /framework-executor\/bin\/opl release reconcile/);
  assert.doesNotMatch(source, /--clobber/);
  assert.doesNotMatch(source, /release', 'edit|release edit/);
  assert.doesNotMatch(publisher, /node:child_process|spawnSync|\bgh\b|release upload|stable_session_id/);
  assert.match(publisher, /status: 'retired_fail_closed'/);
  assert.doesNotMatch(full, /make_latest|github-activate-latest|latest-arm64-mac\.yml|latest-mac\.yml/);
  assert.doesNotMatch(source, /release notes|notes-file|generate-notes/);
});
