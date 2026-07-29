import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import { sha256File, type BuildArtifactCohortV2 } from '../../scripts/build-artifact-cohort.ts';
import {
  qualifyNightlyRelease,
  type NightlyQualificationReceipt,
} from '../../scripts/nightly-release-qualification.ts';
import {
  publishNightlyRelease,
  type NightlyRemote,
  type NightlyRemoteRelease,
} from '../../scripts/nightly-release-publisher.ts';
import {
  assertNightlyRequestDigest,
  resolveNightlyReleaseRequest,
  type NightlyReleaseRequest,
} from '../../scripts/resolve-nightly-release-request.ts';
import { resolveReleaseVersionIdentity } from '../../scripts/release-version.ts';
import { validateNightlyReleaseTopology } from '../../scripts/validate-release-boundary/text-check-runner.ts';

const appSha = 'a'.repeat(40);
const shellSha = 'b'.repeat(40);
const frameworkSha = 'c'.repeat(40);
const digest = 'd'.repeat(64);

function request(): NightlyReleaseRequest {
  return resolveNightlyReleaseRequest({
    baseVersion: '26.7.26-nightly',
    existingRefs: ['refs/tags/v26.7.26-nightly', 'v26.7.26-nightly.r1'],
    appRef: appSha,
    shellRef: shellSha,
    frameworkRef: frameworkSha,
    actionsRunId: '424242',
    actionsRunAttempt: '1',
  });
}

function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-nightly-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const assetsDir = path.join(root, 'assets');
  fs.mkdirSync(assetsDir);
  const frozen = request();
  const dmgName = `One-Person-Lab-${frozen.version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${frozen.version}-mac-arm64.zip`;
  fs.writeFileSync(path.join(assetsDir, dmgName), 'nightly dmg exact bytes\n');
  fs.writeFileSync(path.join(assetsDir, zipName), 'nightly zip exact bytes\n');
  fs.writeFileSync(path.join(assetsDir, `${zipName}.blockmap`), 'nightly blockmap exact bytes\n');
  fs.writeFileSync(
    path.join(assetsDir, `One-Person-Lab-${frozen.version}-linux-x64.deb`),
    'nightly linux desktop exact bytes\n',
  );
  fs.writeFileSync(path.join(assetsDir, 'opl-install.sh'), '#!/usr/bin/env bash\nexit 0\n');
  fs.writeFileSync(path.join(assetsDir, 'latest-arm64-mac.yml'), [
    `version: ${frozen.updater_version}`,
    'files:',
    `  - url: ${zipName}`,
    '    sha512: fixture',
    `path: ${zipName}`,
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(assetsDir, 'standard-local-authorization-policy.json'), JSON.stringify({
    schema: 'opl_local_authorized_macos_policy.v1',
    package_kind: 'app_standard',
    release_install_path: 'local_authorized_unsigned',
    apple_developer_id_required: false,
    gatekeeper_required: false,
    local_authorization_required: true,
    quarantine_removal_required: true,
  }));
  const cohort: BuildArtifactCohortV2 = {
    schema: 'opl_app_build_artifact_cohort.v2',
    release: { stable_session_id: null, release_cohort_ref: null },
    cohort: { app_sha: appSha, shell_sha: shellSha, framework_sha: frameworkSha },
    build: { version: frozen.version, kind: 'standard' },
    artifact: {
      name: dmgName,
      sha256: sha256File(path.join(assetsDir, dmgName)),
      size_bytes: fs.statSync(path.join(assetsDir, dmgName)).size,
    },
    actions: { run_id: '424242', run_attempt: '1', artifact_name: 'nightly-macos-arm64-dmg' },
    digests: {
      packaged_tree_sha256: digest,
      app_product_profile_sha256: digest,
      gui_product_contract_sha256: digest,
      smoke_harness_sha256: digest,
      compiled_expectation_semantic_sha256: digest,
      compiled_expectation_probe_sha256: digest,
      qualification_input_manifest_sha256: digest,
    },
    qualification_runtime: {
      codex_cli: {
        package: '@openai/codex',
        version: '1.2.3',
        npm_integrity: `sha512-${'A'.repeat(86)}==`,
        tarball_url: 'https://registry.npmjs.org/@openai/codex/-/codex-1.2.3.tgz',
        tarball_sha256: digest,
        platform: {
          package: '@openai/codex',
          version: '1.2.3-darwin-arm64',
          npm_integrity: `sha512-${'B'.repeat(86)}==`,
          tarball_url: 'https://registry.npmjs.org/@openai/codex/-/codex-1.2.3-darwin-arm64.tgz',
          tarball_sha256: digest,
        },
      },
    },
  };
  const cohortPath = path.join(root, 'cohort.json');
  fs.writeFileSync(cohortPath, JSON.stringify(cohort));
  const qualification = qualifyNightlyRelease({
    request: frozen,
    assetsDir,
    cohortManifest: cohort,
    cohortManifestPath: cohortPath,
  });
  return { root, assetsDir, request: frozen, cohort, cohortPath, qualification };
}

class FakeRemote implements NightlyRemote {
  latest = 'v26.7.25';
  release: NightlyRemoteRelease | null = null;
  calls: string[] = [];
  visibilityMissesAfterCreate = 0;
  createThrows = false;
  private releaseVisibilityMisses = 0;

  inspectRelease(): NightlyRemoteRelease | null {
    this.calls.push('inspect-release');
    if (this.releaseVisibilityMisses > 0) {
      this.releaseVisibilityMisses -= 1;
      return null;
    }
    return this.release ? structuredClone(this.release) : null;
  }

  inspectLatestTag(): string | null {
    this.calls.push('inspect-latest');
    return this.latest;
  }

  createDraft(input: { tag: string; targetCommitish: string; name: string; body: string }): void {
    this.calls.push('create');
    this.release = {
      id: 101,
      tag_name: input.tag,
      target_commitish: input.targetCommitish,
      name: input.name,
      body: input.body,
      draft: true,
      prerelease: true,
      html_url: `https://example.invalid/${input.tag}`,
      assets: [],
    };
    this.releaseVisibilityMisses = this.visibilityMissesAfterCreate;
    if (this.createThrows) throw new Error('simulated create timeout');
  }

  uploadAsset(_releaseId: number, filePath: string, name: string): void {
    this.calls.push(`upload:${name}`);
    this.release!.assets.push({
      id: 1000 + this.release!.assets.length,
      name,
      size: fs.statSync(filePath).size,
      digest: `sha256:${sha256File(filePath)}`,
    });
  }

  publishRelease(): void {
    this.calls.push('publish');
    this.release!.draft = false;
  }
}

test('Nightly request freezes exact Standard refs, revision, and non-Stable publication policy', () => {
  const frozen = request();
  assert.equal(frozen.version, '26.7.26-nightly.r2');
  assert.equal(
    frozen.updater_version,
    resolveReleaseVersionIdentity('nightly', '26.7.26-nightly.r2').updaterVersion,
  );
  assert.match(frozen.request_digest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(frozen.source, {
    app_sha: appSha,
    shell_sha: shellSha,
    framework_sha: frameworkSha,
  });
  assert.equal(frozen.quality_status, 'preview');
  assert.equal(frozen.build_trigger, 'automated');
  assert.equal(frozen.preview_kind, 'nightly');
  assert.equal(frozen.publication.make_latest, false);
  assert.equal(frozen.publication.include_full, false);
  assert.equal(frozen.publication.full_allowed, false);
  assert.equal(frozen.publication.webui_allowed, false);
  assert.equal(frozen.publication.heavy_vm_blocking, false);
  assert.throws(() => resolveNightlyReleaseRequest({
    baseVersion: '26.7.26-nightly',
    existingRefs: [],
    appRef: appSha,
    shellRef: shellSha,
    frameworkRef: frameworkSha,
    actionsRunId: '424242',
    actionsRunAttempt: '2',
  }), /attempt 1/);
});

test('Nightly request rejects digest-valid policy widening', () => {
  const widened = structuredClone(request()) as NightlyReleaseRequest;
  widened.publication.include_full = true as false;
  const { request_digest: _digest, ...body } = widened;
  widened.request_digest = `sha256:${crypto.createHash('sha256').update(`${JSON.stringify(body)}\n`).digest('hex')}`;
  assert.throws(() => assertNightlyRequestDigest(widened), /Standard-only non-Latest prerelease/);
});

test('Nightly qualification binds exact Standard assets without Stable, Full, WebUI, or heavy VM claims', (t) => {
  const input = fixture(t);
  assert.equal(input.qualification.status, 'passed');
  assert.equal(input.qualification.include_full, false);
  assert.equal(input.qualification.stable_qualified, false);
  assert.equal(input.qualification.heavy_vm_required, false);
  assert.equal(input.qualification.sampled_vm_nonblocking, true);
  assert.equal(input.qualification.quality_status, 'preview');
  assert.equal(input.qualification.build_trigger, 'automated');
  assert.equal(input.qualification.preview_kind, 'nightly');
  assert.deepEqual(input.qualification.qualification_disclosure, {
    stable_qualified: false,
    passed_gates: [],
    skipped_gates: [
      'stable_heavy_vm',
      'homebrew_clean_install',
      'native_webui',
      'container_webui',
      'full',
    ],
    failed_gates: [],
    non_stable_notice: true,
  });
  assert.equal(input.qualification.assets.length, 7);
  assert.equal(
    input.qualification.assets.filter((asset) => asset.name === 'opl-app-component-manifest.json').length,
    1,
  );
  const componentManifest = JSON.parse(
    fs.readFileSync(path.join(input.assetsDir, 'opl-app-component-manifest.json'), 'utf8'),
  );
  assert.equal(componentManifest.quality_status, 'preview');
  assert.equal(componentManifest.build_trigger, 'automated');
  assert.equal(componentManifest.preview_kind, 'nightly');
  assert.deepEqual(componentManifest.source_cohort, {
    app_sha: appSha,
    shell_sha: shellSha,
    framework_sha: frameworkSha,
  });
  assert.ok(input.qualification.assets.every((asset) => !/Full|WebUI/.test(asset.name)));
  assert.ok(input.qualification.assets.some((asset) =>
    asset.name === `One-Person-Lab-${input.request.version}-linux-x64.deb`));
  assert.ok(input.qualification.assets.some((asset) => asset.name === 'opl-install.sh'));
  assert.equal(input.qualification.primary_dmg.sha256, input.cohort.artifact.sha256);

  fs.writeFileSync(path.join(input.assetsDir, 'One-Person-Lab-Full.dmg'), 'forbidden');
  assert.throws(() => qualifyNightlyRelease({
    request: input.request,
    assetsDir: input.assetsDir,
    cohortManifest: input.cohort,
    cohortManifestPath: input.cohortPath,
  }), /must contain exactly/);
});

test('Nightly publisher is digest-idempotent, prerelease-only, and preserves Latest', (t) => {
  const input = fixture(t);
  const remote = new FakeRemote();
  const first = publishNightlyRelease({
    request: input.request,
    qualification: input.qualification,
    assetsDir: input.assetsDir,
    notes: 'Automated Standard preview.\n',
    remote,
  });
  assert.equal(first.status, 'published');
  assert.equal(first.include_full, false);
  assert.equal(first.github_release.prerelease, true);
  assert.equal(first.github_release.make_latest, false);
  assert.equal(first.github_release.latest_before, 'v26.7.25');
  assert.equal(first.github_release.latest_after, 'v26.7.25');
  assert.equal(
    remote.calls.filter((call) => call.startsWith('upload:')).length,
    input.qualification.assets.length,
  );
  assert.equal(remote.calls.filter((call) => call === 'publish').length, 1);

  remote.calls = [];
  const second = publishNightlyRelease({
    request: input.request,
    qualification: input.qualification,
    assetsDir: input.assetsDir,
    notes: 'Automated Standard preview.\n',
    remote,
  });
  assert.equal(second.status, 'already_complete');
  assert.equal(remote.calls.some((call) => call.startsWith('upload:')), false);
  assert.equal(remote.calls.includes('publish'), false);
});

test('Nightly publisher tolerates eventual-consistency misses after draft creation without retrying creation', (t) => {
  const input = fixture(t);
  const remote = new FakeRemote();
  remote.visibilityMissesAfterCreate = 2;
  const receipt = publishNightlyRelease({
    request: input.request,
    qualification: input.qualification,
    assetsDir: input.assetsDir,
    notes: 'Automated Standard preview.\n',
    remote,
  });
  assert.equal(receipt.status, 'published');
  assert.equal(remote.calls.filter((call) => call === 'create').length, 1);
  assert.equal(remote.calls.filter((call) => call === 'publish').length, 1);
});

test('Nightly publisher reconciles an unknown create result without retrying the draft mutation', (t) => {
  const input = fixture(t);
  const remote = new FakeRemote();
  remote.createThrows = true;
  remote.visibilityMissesAfterCreate = 1;
  const receipt = publishNightlyRelease({
    request: input.request,
    qualification: input.qualification,
    assetsDir: input.assetsDir,
    notes: 'Automated Standard preview.\n',
    remote,
  });
  assert.equal(receipt.status, 'published');
  assert.equal(remote.calls.filter((call) => call === 'create').length, 1);
  assert.equal(remote.calls.filter((call) => call === 'publish').length, 1);
});

test('Nightly publisher refuses same-name different remote bytes', (t) => {
  const input = fixture(t);
  const remote = new FakeRemote();
  publishNightlyRelease({
    request: input.request,
    qualification: input.qualification,
    assetsDir: input.assetsDir,
    notes: 'Automated Standard preview.\n',
    remote,
  });
  remote.release!.assets[0]!.digest = `sha256:${crypto.createHash('sha256').update('drift').digest('hex')}`;
  assert.throws(() => publishNightlyRelease({
    request: input.request,
    qualification: input.qualification,
    assetsDir: input.assetsDir,
    notes: 'Automated Standard preview.\n',
    remote,
  }), /conflicting asset/);
});

test('Nightly publisher refuses an unexpected public asset before publishing a draft', (t) => {
  const input = fixture(t);
  const remote = new FakeRemote();
  remote.createDraft({
    tag: input.request.tag,
    targetCommitish: input.request.source.app_sha,
    name: `One Person Lab ${input.request.tag}`,
    body: 'Automated Standard preview.\n',
  });
  remote.release!.assets.push({
    id: 999,
    name: `One-Person-Lab-Full-${input.request.version}-mac-arm64.dmg`,
    size: 1,
    digest: `sha256:${'e'.repeat(64)}`,
  });
  remote.calls = [];
  assert.throws(() => publishNightlyRelease({
    request: input.request,
    qualification: input.qualification,
    assetsDir: input.assetsDir,
    notes: 'Automated Standard preview.\n',
    remote,
  }), /unexpected public asset/);
  assert.equal(remote.calls.includes('publish'), false);
});

test('Nightly workflows keep one shared build implementation and post-publication followers', () => {
  const release = parseYaml(fs.readFileSync('.github/workflows/release-nightly.yml', 'utf8')) as any;
  const homebrew = parseYaml(
    fs.readFileSync('.github/workflows/release-nightly-homebrew-follower.yml', 'utf8'),
  ) as any;
  const sampledVm = parseYaml(
    fs.readFileSync('.github/workflows/release-nightly-sampled-vm.yml', 'utf8'),
  ) as any;
  assert.deepEqual(Object.keys(release.on), ['schedule']);
  assert.equal(release.jobs['standard-build'].uses, './.github/workflows/_build-reusable.yml');
  assert.equal(release.jobs['standard-build'].with.require_macos_gatekeeper, false);
  assert.deepEqual(JSON.parse(release.jobs['standard-build'].with.matrix).include, [
    {
      platform: 'macos-arm64',
      os: 'macos-14',
      command: 'node scripts/build-with-builder.js arm64 --mac --arm64',
      'artifact-name': 'nightly-macos-arm64',
      arch: 'arm64',
      native_arch: 'arm64',
    },
    {
      platform: 'linux-x64',
      os: 'ubuntu-latest',
      command: 'node scripts/build-with-builder.js x64 --linux --x64',
      'artifact-name': 'nightly-linux-x64',
      arch: 'x64',
    },
  ]);
  const publishSteps = release.jobs['qualify-and-publish'].steps;
  assert.equal(
    publishSteps.find((step: any) => step.name === 'Download Linux Desktop build assets')?.with?.name,
    'nightly-linux-x64',
  );
  const qualificationRun = String(
    publishSteps.find((step: any) => step.name === 'Normalize and qualify Standard-only assets')?.run ?? '',
  );
  assert.match(qualificationRun, /generate-frozen-universal-installer\.ts/);
  assert.match(qualificationRun, /--output nightly-assets\/opl-install\.sh/);
  assert.match(qualificationRun, /--app-sha '\$\{\{ needs\.admission\.outputs\.app_ref \}\}'/);
  assert.match(qualificationRun, /--shell-sha '\$\{\{ needs\.admission\.outputs\.shell_ref \}\}'/);
  assert.match(qualificationRun, /--framework-sha '\$\{\{ needs\.admission\.outputs\.framework_ref \}\}'/);
  assert.equal(release.jobs['qualify-and-publish'].environment, 'release-nightly');
  assert.deepEqual(homebrew.on.workflow_run.workflows, ['OPL Standard Nightly Release']);
  assert.deepEqual(sampledVm.on.workflow_run.workflows, ['OPL Standard Nightly Release']);
  assert.equal(sampledVm.jobs['sampled-standard-vm'].uses, './.github/workflows/opl-first-run-vm.yml');
  assert.equal(sampledVm.jobs['sampled-standard-vm'].with.require_macos_gatekeeper, false);
  assert.equal(validateNightlyReleaseTopology(process.cwd()), 0);
});
