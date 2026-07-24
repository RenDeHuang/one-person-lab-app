import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import {
  planNativeWebuiAssetPublication,
  publishNativeWebuiAssets,
  sealNativeWebuiPublicationManifest,
  type NativeWebuiGitHubRuntime,
  type NativeWebuiLocalAsset,
  type NativeWebuiRemoteAsset,
} from '../../scripts/release-native-webui-carrier.ts';

const workflowRoot = path.join(process.cwd(), '.github', 'workflows');

function workflow(name: string): { source: string; parsed: Record<string, any> } {
  const source = fs.readFileSync(path.join(workflowRoot, name), 'utf8');
  return { source, parsed: parseYaml(source) as Record<string, any> };
}

function digest(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

test('Native follower consumes only successful Stable Latest activation exact handoff', () => {
  const { source, parsed } = workflow('release-native-webui-follower.yml');
  assert.deepEqual(Object.keys(parsed.on), ['workflow_run']);
  assert.deepEqual(parsed.on.workflow_run.workflows, ['OPL Stable Release Bundle']);
  assert.deepEqual(parsed.on.workflow_run.types, ['completed']);
  assert.deepEqual(parsed.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(Object.keys(parsed.jobs), ['resolve-handoff', 'native-webui-carrier']);
  assert.equal(parsed.jobs['native-webui-carrier'].uses, './.github/workflows/_release-native-webui-carrier.yml');
  assert.deepEqual(parsed.jobs['native-webui-carrier'].permissions, { contents: 'write', actions: 'read' });
  assert.match(source, /\.path == "\.github\/workflows\/release-stable\.yml"/);
  assert.match(source, /\.run_attempt == 1/);
  assert.match(source, /opl-release-activation-\$\{STABLE_AUTHORITY_RUN_ID\}/);
  assert.match(source, /webui-follower-handoff\.json/);
  assert.match(source, /opl_standard_latest_admission_receipt\.v1/);
  assert.match(source, /framework_terminal_status == "complete"/);
  assert.doesNotMatch(source, /workflow_dispatch:/);
  assert.doesNotMatch(source, /release-webui-stable\.yml|_release-webui-carrier\.yml|packages: write/);
});

test('Native reusable separates read-only qualification from protected additive GitHub publication', () => {
  const { source, parsed } = workflow('_release-native-webui-carrier.yml');
  assert.deepEqual(Object.keys(parsed.on), ['workflow_call']);
  assert.deepEqual(parsed.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(parsed.jobs), ['startup-canary', 'build-and-qualify', 'publish-native-assets']);
  assert.deepEqual(parsed.jobs['build-and-qualify'].permissions, { contents: 'read', actions: 'read' });
  assert.equal(parsed.jobs['publish-native-assets'].environment, 'release-stable');
  assert.deepEqual(parsed.jobs['publish-native-assets'].permissions, { contents: 'write', actions: 'read' });
  for (const required of [
    'test "$GITHUB_RUN_ATTEMPT" = 1',
    'test "$(id -u)" -ne 0',
    'repository: gaofeng21cn/opl-aion-shell',
    'repository: gaofeng21cn/one-person-lab',
    'desired_root_package_ids',
    'OPL_SOURCE_ARCHIVE_URL',
    'tests/unit/web-cli/nativeDistribution.test.ts',
    'tests/unit/web-cli/packWebCli.test.ts',
    '0.0.1',
    '--rollback',
    'user-sentinel.txt',
    'project-sentinel.txt',
    'official-profile-first-install-complete',
    'http://127.0.0.1:${port}/',
    'release-native-webui-carrier.ts publish',
    'latest_modified',
    'container_registry_modified',
    'homebrew_modified',
  ]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(source, /ghcr\.io|docker build|docker push|packages: write|make_latest|github-activate-latest/);
  assert.doesNotMatch(source, /release-stable\.yml|_release-standard-publish\.yml|_release-full-addon\.yml/);
});

test('asset plan is idempotent and rejects same-name different bytes', () => {
  const local: NativeWebuiLocalAsset = {
    role: 'runtime_tarball',
    name: 'runtime.tar.gz',
    path: '/tmp/runtime.tar.gz',
    size_bytes: 42,
    sha256: 'a'.repeat(64),
  };
  assert.deepEqual(planNativeWebuiAssetPublication([local], []), [{ ...local, action: 'upload' }]);
  assert.deepEqual(planNativeWebuiAssetPublication([local], [{
    name: local.name,
    size: local.size_bytes,
    digest: `sha256:${local.sha256}`,
  }]), [{ ...local, action: 'reuse' }]);
  assert.throws(() => planNativeWebuiAssetPublication([local], [{
    name: local.name,
    size: local.size_bytes,
    digest: `sha256:${'b'.repeat(64)}`,
  }]), /already exists with different bytes/);
  assert.throws(() => planNativeWebuiAssetPublication([local], [
    { name: local.name, size: local.size_bytes, digest: `sha256:${local.sha256}` },
    { name: local.name, size: local.size_bytes, digest: `sha256:${local.sha256}` },
  ]), /duplicate Native WebUI asset names/);
});

function fixtureManifest(t: test.TestContext) {
  const root = fs.mkdtempSync(path.join(process.cwd(), '.opl-native-publication-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const version = '26.7.25';
  const names = {
    runtime_tarball: `one-person-lab-webui-${version}-linux-x86_64.tar.gz`,
    runtime_metadata: `one-person-lab-webui-${version}-linux-x86_64.tar.gz.sha256`,
    installer: 'install-web.sh',
    installer_sha256: 'install-web.sh.sha256',
    qualification_receipt: `one-person-lab-webui-${version}-linux-x86_64.qualification.json`,
  };
  const paths = Object.fromEntries(Object.entries(names).map(([role, name]) => [role, path.join(root, name)])) as Record<keyof typeof names, string>;
  fs.writeFileSync(paths.runtime_tarball, 'runtime-bytes');
  fs.writeFileSync(paths.runtime_metadata, 'runtime-metadata');
  fs.writeFileSync(paths.installer, '#!/bin/sh\n');
  fs.writeFileSync(paths.installer_sha256, `${digest('#!/bin/sh\n')}  install-web.sh\n`);
  fs.writeFileSync(paths.qualification_receipt, `${JSON.stringify({
    schema: 'opl_app_native_webui_qualification_receipt.v1',
    status: 'passed',
    version,
    release_bundle_digest: `sha256:${'d'.repeat(64)}`,
    stable_authority_run_id: '123',
    platform: 'linux',
    architecture: 'x86_64',
    non_root: true,
    cohort: { app_sha: 'a'.repeat(40), shell_sha: 'b'.repeat(40), framework_sha: 'c'.repeat(40) },
    lifecycle: {
      first_install: 'passed',
      same_version_idempotence: 'passed',
      cross_version_update: 'passed',
      rollback: 'passed',
      data_preservation: 'passed',
      http_health: 'passed',
      official_profile_first_install: 'passed',
    },
  })}\n`);
  const manifest = sealNativeWebuiPublicationManifest({
    repository: 'gaofeng21cn/one-person-lab-app',
    version,
    releaseBundleDigest: `sha256:${'d'.repeat(64)}`,
    stableAuthorityRunId: '123',
    appSha: 'a'.repeat(40),
    shellSha: 'b'.repeat(40),
    frameworkSha: 'c'.repeat(40),
    qualificationReceiptPath: path.relative(process.cwd(), paths.qualification_receipt),
    assetPaths: Object.fromEntries(Object.entries(paths).map(([role, file]) => [
      role,
      path.relative(process.cwd(), file),
    ])) as Record<keyof typeof names, string>,
  });
  return { root, manifest };
}

function remoteAssets(manifest: ReturnType<typeof fixtureManifest>['manifest']): NativeWebuiRemoteAsset[] {
  return manifest.assets.map((asset, index) => ({
    id: index + 1,
    name: asset.name,
    size: asset.size_bytes,
    digest: `sha256:${asset.sha256}`,
    browser_download_url: `https://example.invalid/${asset.name}`,
  }));
}

function runtimeFor(input: {
  manifest: ReturnType<typeof fixtureManifest>['manifest'];
  initial: NativeWebuiRemoteAsset[];
  uploadStatus?: number;
  exposeAfterUpload?: boolean;
}): NativeWebuiGitHubRuntime & { uploads: string[] } {
  let assets = [...input.initial];
  const uploads: string[] = [];
  return {
    uploads,
    run(command, args) {
      if (command === 'gh' && args[0] === 'api') {
        return {
          status: 0,
          stdout: JSON.stringify({
            tag_name: input.manifest.tag,
            draft: false,
            prerelease: false,
            target_commitish: input.manifest.cohort.app_sha,
            assets,
          }),
          stderr: '',
        };
      }
      if (command === 'gh' && args[0] === 'release' && args[1] === 'upload') {
        const local = input.manifest.assets.find((asset) => path.resolve(asset.path) === args[3]);
        assert.ok(local);
        uploads.push(local.name);
        if (input.exposeAfterUpload !== false) {
          assets = [...assets, {
            name: local.name,
            size: local.size_bytes,
            digest: `sha256:${local.sha256}`,
            browser_download_url: `https://example.invalid/${local.name}`,
          }];
        }
        return { status: input.uploadStatus ?? 0, stdout: '', stderr: input.uploadStatus ? 'unknown' : '' };
      }
      if (command === 'curl') {
        const output = args[args.indexOf('--output') + 1];
        const name = path.basename(args.at(-1) ?? '');
        const local = input.manifest.assets.find((asset) => asset.name === name);
        assert.ok(local);
        fs.copyFileSync(path.resolve(local.path), output);
        return { status: 0, stdout: '', stderr: '' };
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    },
  };
}

test('publisher performs zero mutations for exact remote bytes and verifies anonymous bytes', (t) => {
  const current = fixtureManifest(t);
  const runtime = runtimeFor({ manifest: current.manifest, initial: remoteAssets(current.manifest) });
  const receipt = publishNativeWebuiAssets(current.manifest, runtime);
  assert.equal(receipt.status, 'idempotent');
  assert.deepEqual(runtime.uploads, []);
  assert.equal(receipt.anonymous_readback.length, 5);
  assert.equal(receipt.latest_modified, false);
  assert.equal(receipt.container_registry_modified, false);
});

test('unknown upload is reconciled read-only when exact bytes appeared, otherwise remains unknown', (t) => {
  const reconciled = fixtureManifest(t);
  const reconciledRuntime = runtimeFor({
    manifest: reconciled.manifest,
    initial: [],
    uploadStatus: 1,
    exposeAfterUpload: true,
  });
  const reconciledReceipt = publishNativeWebuiAssets(reconciled.manifest, reconciledRuntime);
  assert.equal(reconciledReceipt.status, 'reconciled_complete');
  assert.equal(reconciledRuntime.uploads.length, 5);

  const unknown = fixtureManifest(t);
  const unknownRuntime = runtimeFor({
    manifest: unknown.manifest,
    initial: [],
    uploadStatus: 1,
    exposeAfterUpload: false,
  });
  const unknownReceipt = publishNativeWebuiAssets(unknown.manifest, unknownRuntime);
  assert.equal(unknownReceipt.status, 'outcome_unknown');
  assert.deepEqual(unknownRuntime.uploads, [unknown.manifest.assets[0].name]);
  assert.equal(unknownReceipt.retry_disposition, 'read_only_reconcile_only_no_upload_retry');
});
