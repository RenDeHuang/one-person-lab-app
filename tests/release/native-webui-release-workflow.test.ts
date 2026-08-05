import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import {
  planNativeWebuiAssetPublication,
  publishNativeWebuiAssets,
  readbackNativeWebuiAssets,
  sealNativeWebuiPublicationManifest,
  type NativeWebuiGitHubRuntime,
  type NativeWebuiLocalAsset,
  type NativeWebuiRemoteAsset,
} from '../../scripts/release-native-webui-carrier.ts';
import { isAuthorizedFollowerRecoveryWriteJob } from '../../scripts/validate-release-boundary/text-check-runner.ts';

const workflowRoot = path.join(process.cwd(), '.github', 'workflows');

function workflow(name: string): { source: string; parsed: Record<string, any> } {
  const source = fs.readFileSync(path.join(workflowRoot, name), 'utf8');
  return { source, parsed: parseYaml(source) as Record<string, any> };
}

function digest(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

test('Native follower consumes only one successful Stable handoff and executes two isolated targets', () => {
  const { source, parsed } = workflow('release-native-webui-follower.yml');
  assert.deepEqual(Object.keys(parsed.on), ['workflow_run', 'workflow_dispatch']);
  assert.deepEqual(parsed.on.workflow_run.workflows, ['OPL Stable Release Bundle']);
  assert.deepEqual(parsed.on.workflow_run.types, ['completed']);
  assert.deepEqual(parsed.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(Object.keys(parsed.jobs), ['resolve-handoff', 'native-webui-linux', 'native-webui-macos']);
  const linux = parsed.jobs['native-webui-linux'];
  const macos = parsed.jobs['native-webui-macos'];
  assert.equal(linux.uses, './.github/workflows/_release-native-webui-carrier.yml');
  assert.equal(macos.uses, './.github/workflows/_release-native-webui-carrier.yml');
  assert.deepEqual(linux.permissions, { contents: 'write', actions: 'read' });
  assert.deepEqual(macos.permissions, { contents: 'write', actions: 'read' });
  assert.equal(linux.with.mode, 'execute');
  assert.equal(linux.with.target_platform, 'linux');
  assert.equal(linux.with.target_architecture, 'x86_64');
  assert.equal(macos.with.mode, 'execute');
  assert.equal(macos.with.target_platform, 'darwin');
  assert.equal(macos.with.target_architecture, 'arm64');
  assert.deepEqual(macos.needs, ['resolve-handoff', 'native-webui-linux']);
  assert.match(macos.if, /always\(\)/);
  assert.match(macos.if, /needs\.resolve-handoff\.outputs\.eligible == 'true'/);
  assert.match(source, /\.path == "\.github\/workflows\/release-stable\.yml"/);
  assert.match(source, /\.run_attempt == 1/);
  assert.match(source, /opl-release-activation-\$\{STABLE_AUTHORITY_RUN_ID\}/);
  assert.match(source, /webui-follower-handoff\.json/);
  assert.match(source, /\.source\.artifact_run_id \| test\("\^\[1-9\]\[0-9\]\*\$"\)/);
  assert.match(source, /\.source\.checkpoint_artifact \| test/);
  assert.match(source, /\.source\.standard_identity_sha256 \| test/);
  assert.match(source, /opl_standard_latest_admission_receipt\.v1/);
  assert.match(source, /framework_terminal_status == "complete"/);
  assert.deepEqual(Object.keys(parsed.on.workflow_dispatch.inputs), [
    'source_run_id',
    'failed_follower_run_id',
    'failed_recovery_run_id',
    'failed_recovery_v2_run_id',
    'full_authority_run_id',
    'recovery_confirmation',
  ]);
  assert.equal(parsed.on.workflow_dispatch.inputs.failed_recovery_run_id.required, false);
  assert.equal(parsed.on.workflow_dispatch.inputs.failed_recovery_run_id.type, 'string');
  assert.deepEqual(parsed.on.workflow_dispatch.inputs.recovery_confirmation.options, [
    'recover_exact_failed_native_webui_follower_v1',
    'recover_exact_failed_native_webui_follower_v2',
    'recover_exact_failed_native_webui_follower_v3',
  ]);
  assert.match(
    source,
    /recover_exact_failed_native_webui_follower_v1\)\s+test -z "\$FAILED_RECOVERY_RUN_ID\$FAILED_RECOVERY_V2_RUN_ID\$FULL_AUTHORITY_RUN_ID"/,
  );
  assert.match(
    source,
    /recover_exact_failed_native_webui_follower_v2\)\s+\[\[ "\$FAILED_RECOVERY_RUN_ID" =~ \^\[1-9\]\[0-9\]\*\$ \]\]\s+test -z "\$FAILED_RECOVERY_V2_RUN_ID\$FULL_AUTHORITY_RUN_ID"/,
  );
  assert.match(
    source,
    /recover_exact_failed_native_webui_follower_v3\)\s+\[\[ "\$FAILED_RECOVERY_RUN_ID" =~ \^\[1-9\]\[0-9\]\*\$ \]\]\s+\[\[ "\$FAILED_RECOVERY_V2_RUN_ID" =~ \^\[1-9\]\[0-9\]\*\$ \]\]\s+\[\[ "\$FULL_AUTHORITY_RUN_ID" =~ \^\[1-9\]\[0-9\]\*\$ \]\]/,
  );
  assert.equal(
    parsed.concurrency.group,
    "opl-native-webui-follower-${{ github.event_name == 'workflow_dispatch' && inputs.source_run_id || github.event.workflow_run.id }}",
  );
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const recovery = releaseContract.native_webui_distribution.exact_failed_follower_recovery;
  assert.equal(recovery.recovery_generation, 3);
  assert.deepEqual(recovery.consumed_recovery_generations, [1, 2]);
  assert.deepEqual(recovery.inputs, [
    'source_run_id',
    'failed_follower_run_id',
    'failed_recovery_run_id',
    'failed_recovery_v2_run_id',
    'full_authority_run_id',
    'recovery_confirmation',
  ]);
  assert.equal(recovery.confirmation, 'recover_exact_failed_native_webui_follower_v3');
  assert.equal(recovery.legacy_confirmation, 'recover_exact_failed_native_webui_follower_v1');
  assert.equal(recovery.consumed_confirmation, 'recover_exact_failed_native_webui_follower_v2');
  assert.equal(recovery.failed_public_mutation_count_required, 0);
  assert.equal(recovery.failed_recovery_public_mutation_count_required, 0);
  assert.equal(recovery.failed_recovery_v2_public_mutation_count_required, 0);
  assert.equal(recovery.same_identity_recovery_v3_run_count_required, 1);
  assert.equal(recovery.full_authority_operation, 'append_full');
  assert.equal(recovery.same_tag_remote_asset_policy, 'exact_standard_plus_full_union_only_unknown_assets_fail_closed');
  for (const required of [
    '.total_count == 7',
    'native-webui-linux / publish-native-assets',
    'native-webui-macos / build-and-qualify',
    'standard deadline must be exactly 90 minutes after operation start.',
    'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory',
    'failed recovery v1 ${FAILED_RECOVERY_RUN_ID}',
    'failed-recovery-jobs.json',
    'line 18: rg: command not found',
    'failed recovery v2 ${FAILED_RECOVERY_V2_RUN_ID}',
    'Remote standard inspection contains unknown asset One-Person-Lab-Full-26.8.4-mac-arm64.dmg.',
    'OPL Stable append_full source:30880171420 run:',
    'opl-release-append-full-operation-checkpoint-${FULL_AUTHORITY_RUN_ID}',
    'Append exact Full bytes to the mutable Standard Release',
    '($artifacts | length) == 4',
    '($matches | length) == 1',
  ]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const jobId of ['native-webui-linux', 'native-webui-macos']) {
    assert.equal(
      isAuthorizedFollowerRecoveryWriteJob(
        '.github/workflows/release-native-webui-follower.yml',
        parsed,
        jobId,
        parsed.jobs[jobId],
      ),
      true,
    );
  }
  const widened = JSON.parse(JSON.stringify(parsed));
  widened.on.workflow_dispatch.inputs.recovery_confirmation.options.push('recover_anything');
  assert.equal(
    isAuthorizedFollowerRecoveryWriteJob(
      '.github/workflows/release-native-webui-follower.yml',
      widened,
      'native-webui-linux',
      widened.jobs['native-webui-linux'],
    ),
    false,
  );
  const directMutation = { ...parsed.jobs['native-webui-linux'], steps: [{ run: 'gh api --method DELETE /repos/example' }] };
  assert.equal(
    isAuthorizedFollowerRecoveryWriteJob(
      '.github/workflows/release-native-webui-follower.yml',
      parsed,
      'native-webui-linux',
      directMutation,
    ),
    false,
  );
  assert.doesNotMatch(source, /publication_prefix|publication_artifact_name|release-webui-stable\.yml|_release-webui-carrier\.yml|packages: write/);
});

test('Native reusable builds one exact target then performs protected additive publication and readback', () => {
  const { source, parsed } = workflow('_release-native-webui-carrier.yml');
  assert.deepEqual(Object.keys(parsed.on), ['workflow_call']);
  assert.deepEqual(parsed.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(parsed.jobs), ['startup-canary', 'build-and-qualify', 'publish-native-assets']);
  assert.deepEqual(parsed.jobs['build-and-qualify'].permissions, { contents: 'read', actions: 'read' });
  assert.equal(parsed.jobs['build-and-qualify']['continue-on-error'], undefined);
  assert.equal(
    parsed.jobs['build-and-qualify']['runs-on'],
    "${{ inputs.target_platform == 'darwin' && 'macos-14' || 'ubuntu-latest' }}",
  );
  assert.equal(parsed.jobs['publish-native-assets'].environment, 'release-stable');
  assert.equal(parsed.jobs['publish-native-assets']['continue-on-error'], undefined);
  assert.deepEqual(parsed.jobs['publish-native-assets'].permissions, { contents: 'write', actions: 'read' });
  const nativeBuildStep = parsed.jobs['build-and-qualify'].steps.find(
    (step: Record<string, any>) => step.name === 'Build target Native WebUI artifact',
  );
  assert.equal(nativeBuildStep.env.NODE_OPTIONS, '--max-old-space-size=8192');
  const appendStep = parsed.jobs['publish-native-assets'].steps.find(
    (step: Record<string, any>) => step.name === 'Append one exact Native asset set through the Framework ledger',
  );
  const activationIdentityStep = parsed.jobs['publish-native-assets'].steps.find(
    (step: Record<string, any>) => step.name === 'Download exact Stable activation identity',
  );
  assert.equal(
    activationIdentityStep.uses,
    'actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c',
  );
  assert.deepEqual(activationIdentityStep.with, {
    name: 'opl-release-activation-${{ inputs.stable_authority_run_id }}',
    'run-id': '${{ inputs.stable_authority_run_id }}',
    'github-token': '${{ github.token }}',
    path: 'stable-activation',
  });
  const bindStep = parsed.jobs['publish-native-assets'].steps.find(
    (step: Record<string, any>) => step.name === 'Bind qualified Native bytes to the Standard checkpoint',
  );
  const bindRun = String(bindStep.run);
  assert.match(
    bindRun,
    /find stable-activation -type f -name standard-identity-receipt\.json -print/,
  );
  assert.doesNotMatch(
    bindRun,
    /find imported-checkpoint -type f -name standard-identity-receipt\.json -print/,
  );
  const appendRun = String(appendStep.run);
  assert.ok(appendRun.indexOf('infer-standard') < appendRun.indexOf('opl release operation admit'));
  assert.ok(
    appendRun.indexOf('--operation native_webui_follower')
      < appendRun.indexOf('release-native-webui-carrier.ts publish'),
  );
  assert.match(appendRun, /--release-operation "\$release_operation"/);
  assert.match(
    appendRun,
    /grep -F -- "\$release_operation operation deadline elapsed"/,
  );
  assert.match(appendRun, /--allow-same-tag-full-assets true/);
  assert.equal(parsed.on.workflow_call.inputs.allow_same_tag_full_assets.type, 'boolean');
  assert.equal(parsed.on.workflow_call.inputs.allow_same_tag_full_assets.default, false);
  assert.doesNotMatch(appendRun, /\brg\s/);
  for (const required of [
    'test "$GITHUB_RUN_ATTEMPT" = 1',
    'test "$(id -u)" -ne 0',
    'linux/x86_64|darwin/arm64',
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
    'release-native-webui-carrier.ts readback',
    'restore-release-checkpoint',
    "completed_stage }}' = full_qualified",
    'append_full_operation_id',
    'native_webui_follower',
    'native-follower-operation.json',
    'infer-standard',
    'opl release operation admit',
    'steps.append.outputs.release_operation',
    'publication-scope external_target',
    'prior_mutation_attempt_id',
    'find native-release/native-publication-checkpoint -type f -name checkpoint.json',
    'test -f native-release/publication-manifest.json',
    'test "$(jq -r .operation_id <<<"$marker")"',
    'opl release reconcile',
    'latest_modified',
    'container_registry_modified',
    'homebrew_modified',
  ]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /PACK_PLATFORM: \$\{\{ inputs\.target_platform \}\}/);
  assert.match(source, /PACK_ARCH: \$\{\{ inputs\.target_architecture == 'x86_64' && 'x64' \|\| 'arm64' \}\}/);
  assert.match(source, /OPL_WEBUI_IMAGE_PROFILE: webui-full/);
  assert.match(source, /run-id: \$\{\{ github\.run_id \}\}/);
  assert.match(source, /source-run-id: \$\{\{ inputs\.source_run_id \}\}/);
  assert.match(source, /source-artifact: \$\{\{ inputs\.source_artifact \}\}/);
  assert.match(source, /standard_identity_sha256/);
  assert.doesNotMatch(source, /ghcr\.io|docker build|docker push|packages: write|make_latest|github-activate-latest/);
  assert.doesNotMatch(source, /release-stable\.yml|_release-full-addon\.yml/);
  assert.equal((source.match(/--max-old-space-size=8192/g) ?? []).length, 1);
  assert.doesNotMatch(source, /--release-operation standard|--operation standard/);
});

test('Desktop Stable bundle has no Native mandatory job or dependency', () => {
  const { source, parsed } = workflow('_release-bundle.yml');
  assert.equal(parsed.jobs['prepare-native-webui'], undefined);
  assert.equal(parsed.jobs['prepare-native-webui-macos'], undefined);
  assert.equal(parsed.jobs['publish-native-webui'], undefined);
  assert.doesNotMatch(source, /_release-native-webui-carrier\.yml|prepare-native-webui|publish-native-webui/);
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

function fixtureManifest(
  t: test.TestContext,
  target: { platform: 'linux' | 'darwin'; architecture: 'x86_64' | 'arm64' } = {
    platform: 'linux',
    architecture: 'x86_64',
  },
) {
  const root = fs.mkdtempSync(path.join(process.cwd(), '.opl-native-publication-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const version = '26.7.25';
  const base = `one-person-lab-webui-${version}-${target.platform}-${target.architecture}`;
  const names = {
    runtime_tarball: `${base}.tar.gz`,
    runtime_metadata: `${base}.tar.gz.sha256`,
    installer: 'install-web.sh',
    installer_sha256: 'install-web.sh.sha256',
    qualification_receipt: `${base}.qualification.json`,
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
    platform: target.platform,
    architecture: target.architecture,
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
    platform: target.platform,
    architecture: target.architecture,
    appSha: 'a'.repeat(40),
    shellSha: 'b'.repeat(40),
    frameworkSha: 'c'.repeat(40),
    qualificationReceiptPath: path.relative(process.cwd(), paths.qualification_receipt),
    assetPaths: Object.fromEntries(Object.entries(paths).map(([role, file]) => [
      role,
      path.relative(process.cwd(), file),
    ])) as Record<keyof typeof names, string>,
  });
  return { root, manifest, paths };
}

test('manifests bind both supported Native targets and reject every cross-pair', (t) => {
  const linux = fixtureManifest(t);
  const macos = fixtureManifest(t, { platform: 'darwin', architecture: 'arm64' });
  assert.equal(linux.manifest.platform, 'linux');
  assert.equal(linux.manifest.architecture, 'x86_64');
  assert.match(linux.manifest.assets[0].name, /-linux-x86_64\.tar\.gz$/);
  assert.equal(macos.manifest.platform, 'darwin');
  assert.equal(macos.manifest.architecture, 'arm64');
  assert.match(macos.manifest.assets[0].name, /-darwin-arm64\.tar\.gz$/);

  for (const target of [
    { platform: 'linux', architecture: 'arm64' },
    { platform: 'darwin', architecture: 'x86_64' },
  ] as const) {
    assert.throws(() => sealNativeWebuiPublicationManifest({
      repository: linux.manifest.repository,
      version: linux.manifest.version,
      releaseBundleDigest: linux.manifest.release_bundle_digest,
      stableAuthorityRunId: linux.manifest.stable_authority_run_id,
      platform: target.platform,
      architecture: target.architecture,
      appSha: linux.manifest.cohort.app_sha,
      shellSha: linux.manifest.cohort.shell_sha,
      frameworkSha: linux.manifest.cohort.framework_sha,
      qualificationReceiptPath: linux.manifest.qualification_receipt.path,
      assetPaths: Object.fromEntries(linux.manifest.assets.map((asset) => [asset.role, asset.path])) as never,
    }), new RegExp(`Unsupported Native WebUI target ${target.platform}-${target.architecture}`));
  }
});

test('seal CLI accepts the workflow-relative qualification receipt and preserves target identity', (t) => {
  const current = fixtureManifest(t, { platform: 'darwin', architecture: 'arm64' });
  const byRole = Object.fromEntries(current.manifest.assets.map((asset) => [asset.role, asset.path]));
  const output = path.join(current.root, 'cli-publication-manifest.json');
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/release-native-webui-carrier.ts',
    'seal',
    '--repository', current.manifest.repository,
    '--version', current.manifest.version,
    '--release-bundle-digest', current.manifest.release_bundle_digest,
    '--stable-authority-run-id', current.manifest.stable_authority_run_id,
    '--platform', current.manifest.platform,
    '--architecture', current.manifest.architecture,
    '--app-sha', current.manifest.cohort.app_sha,
    '--shell-sha', current.manifest.cohort.shell_sha,
    '--framework-sha', current.manifest.cohort.framework_sha,
    '--runtime-tarball', byRole.runtime_tarball,
    '--runtime-metadata', byRole.runtime_metadata,
    '--installer', byRole.installer,
    '--installer-sha256', byRole.installer_sha256,
    '--qualification-receipt', current.manifest.qualification_receipt.path,
    '--output', output,
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), current.manifest);
});

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
  anonymousReadbackStatus?: number;
}): NativeWebuiGitHubRuntime & { uploads: string[]; uploadCalls: number } {
  let assets = [...input.initial];
  const uploads: string[] = [];
  let uploadCalls = 0;
  return {
    uploads,
    get uploadCalls() { return uploadCalls; },
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
        uploadCalls += 1;
        const localPaths = args.slice(3, args.indexOf('--repo'));
        const localAssets = localPaths.map((localPath) => {
          const local = input.manifest.assets.find((asset) => path.resolve(asset.path) === localPath);
          assert.ok(local);
          return local;
        });
        uploads.push(...localAssets.map((local) => local.name));
        if (input.exposeAfterUpload !== false) {
          assets = [...assets, ...localAssets.map((local) => ({
            name: local.name,
            size: local.size_bytes,
            digest: `sha256:${local.sha256}`,
            browser_download_url: `https://example.invalid/${local.name}`,
          }))];
        }
        return { status: input.uploadStatus ?? 0, stdout: '', stderr: input.uploadStatus ? 'unknown' : '' };
      }
      if (command === 'curl') {
        if (input.anonymousReadbackStatus) {
          return { status: input.anonymousReadbackStatus, stdout: '', stderr: 'anonymous readback failed' };
        }
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
  const receipt = publishNativeWebuiAssets(current.manifest, 'gha-123-native', runtime);
  assert.equal(receipt.status, 'idempotent');
  assert.deepEqual(runtime.uploads, []);
  assert.equal(receipt.anonymous_readback.length, 5);
  assert.equal(receipt.latest_modified, false);
  assert.equal(receipt.container_registry_modified, false);
  assert.equal(receipt.homebrew_modified, false);
});

test('publisher never converts a zero-mutation public readback failure into idempotent completion', (t) => {
  const current = fixtureManifest(t);
  const runtime = runtimeFor({
    manifest: current.manifest,
    initial: remoteAssets(current.manifest),
    anonymousReadbackStatus: 22,
  });
  const receipt = publishNativeWebuiAssets(current.manifest, 'gha-126-native', runtime);
  assert.equal(receipt.status, 'public_readback_failed');
  assert.equal(runtime.uploadCalls, 0);
  assert.deepEqual(runtime.uploads, []);
  assert.deepEqual(receipt.requested_uploads, []);
  assert.equal(receipt.retry_disposition, 'fix_public_readback_then_freeze_a_new_standard_bundle_no_upload_retry');
});

test('publisher invokes one asset-set mutation and leaves unknown resolution to Framework readback', (t) => {
  const reconciled = fixtureManifest(t);
  const reconciledRuntime = runtimeFor({
    manifest: reconciled.manifest,
    initial: [],
    uploadStatus: 1,
    exposeAfterUpload: true,
  });
  const reconciledReceipt = publishNativeWebuiAssets(reconciled.manifest, 'gha-124-native', reconciledRuntime);
  assert.equal(reconciledReceipt.status, 'outcome_unknown');
  assert.equal(reconciledRuntime.uploadCalls, 1);
  assert.equal(reconciledRuntime.uploads.length, 5);
  assert.deepEqual(reconciledReceipt.requested_uploads, reconciled.manifest.assets.map((asset) => asset.name));
  assert.equal(readbackNativeWebuiAssets(reconciled.manifest, reconciledRuntime).status, 'complete');

  const unknown = fixtureManifest(t);
  const unknownRuntime = runtimeFor({
    manifest: unknown.manifest,
    initial: [],
    uploadStatus: 1,
    exposeAfterUpload: false,
  });
  const unknownReceipt = publishNativeWebuiAssets(unknown.manifest, 'gha-125-native', unknownRuntime);
  assert.equal(unknownReceipt.status, 'outcome_unknown');
  assert.equal(unknownRuntime.uploadCalls, 1);
  assert.deepEqual(unknownRuntime.uploads, unknown.manifest.assets.map((asset) => asset.name));
  assert.equal(unknownReceipt.retry_disposition, 'persist_framework_marker_then_exact_read_only_reconcile_no_upload_retry');
});
