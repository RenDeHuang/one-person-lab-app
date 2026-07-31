import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  activateLatest,
  applyPublishPlan,
  buildExecutorReceipt,
  fullAdjunctReleaseIdentity,
  inspectRelease,
  type GitHubAdapterRuntime,
  type GitHubCommandOptions,
  type GitHubCommandResult,
} from '../../scripts/framework-release-adapter.ts';
import {
  bindStableOperationAuthority,
  canonicalJson,
  consumeStableOperationControl,
  createGithubImmutableReleaseCapabilityEvidence,
  createStableOperationAuthority,
  stableOperationIdForFrozenCohort,
} from '../../scripts/stable-operation-control.ts';
import {
  createStableOperationPublicationRecord,
} from '../../scripts/stable-operation-publication-record.ts';

type Asset = { name: string; size_bytes: number; sha256: string; source_path: string };

const repo = 'example/one-person-lab-app';
const canonicalRepo = 'gaofeng21cn/one-person-lab-app';
const version = '26.7.22';
const updaterVersion = '26.7.2200';
const tag = `v${version}`;
const deadlineAt = '2026-07-21T01:00:00.000Z';
const deadlineMs = Date.parse(deadlineAt);
const notes = 'Prepared release notes\n';
const sourceCommit = 'a'.repeat(40);
const shellCommit = 'c'.repeat(40);
const frameworkCommit = 'd'.repeat(40);
const bundleDigest = `sha256:${'b'.repeat(64)}`;
const latestZip = asset(`One-Person-Lab-${version}-mac-arm64.zip`, '9');
const latestDmg = asset(`One-Person-Lab-${version}-mac-arm64.dmg`, '8');
const latestDeb = asset(`One-Person-Lab-${version}-linux-x64.deb`, '7');
const componentManifestAsset = asset('opl-app-component-manifest.json', 'f');
const expectedCurrentLatestTag = 'v26.7.20';
const standardOperationId = 'operation-standard-1';
const appendFullOperationId = 'operation-append-full-1';
const stableAuthorityRunId = '30325431854';
const standardOperationStartedAt = '2026-07-21T00:00:00.000Z';
const appendFullOperationStartedAt = '2026-07-21T00:05:00.000Z';
const workflowAttemptId = 'gha-workflow-attempt-1';
const stableObjectiveFingerprint = 'stable-immutable-capability-evidence-test';
const stableCriticalBlobPaths = [
  '.github/workflows/release-stable.yml',
  '.github/workflows/_release-bundle.yml',
  '.github/workflows/_release-standard-publish.yml',
  'contracts/app-release-channel.json',
  'scripts/framework-release-adapter.ts',
  'scripts/release-dispatch-guard.ts',
  'scripts/stable-operation-control.ts',
  'scripts/stable-operation-publication-record.ts',
  'scripts/stable-release-admission-manifest.ts',
  'scripts/validate-release-source-gate.ts',
];
const stableCriticalBlobs = Object.fromEntries(
  stableCriticalBlobPaths.map((file, index) => [
    file,
    `sha256:${'0123456789abcdef'[(index + 4) % 16]!.repeat(64)}`,
  ]),
);

function sha256Evidence(bytes: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function durablePublicationRecord(root: string, payloadAssets: Asset[]) {
  const generatedAt = '2026-07-21T00:10:00.000Z';
  const sourceGate = {
    schema: 'opl_app_release_source_gate.v1',
    generated_at: generatedAt,
    status: 'passed',
    operation_fingerprint: stableObjectiveFingerprint,
    typed_blocker: null,
    immutable_release_capability: createGithubImmutableReleaseCapabilityEvidence({
      repository: canonicalRepo,
      checkedAt: generatedAt,
      enabled: true,
      enforcedByOwner: false,
    }),
    admission: {
      status: 'passed',
      immutable_cohort: {
        app_sha: sourceCommit,
        shell_sha: shellCommit,
        framework_sha: frameworkCommit,
      },
    },
    checks: [{ id: 'app_frozen_commit_reachable', status: 'passed' }],
  };
  const operationId = stableOperationIdForFrozenCohort({
    objectiveFingerprint: stableObjectiveFingerprint,
    appSha: sourceCommit,
    shellSha: shellCommit,
    frameworkSha: frameworkCommit,
    criticalBlobs: stableCriticalBlobs,
  });
  const preNonceGuard = {
    schema: 'opl_release_dispatch_guard.v1',
    phase: 'pre_nonce',
    status: 'passed',
    dispatch_allowed: true,
    operation_id: operationId,
    owner_run_match_count: 0,
    nonce_consumed: false,
    mutation_invocation_count: 0,
    source_gate: {
      schema: 'opl_app_release_source_gate.v1',
      status: 'passed',
      exact_cohort_bound: true,
    },
  };
  const sourceGateBytes = Buffer.from(canonicalJson(sourceGate), 'utf8');
  const preNonceGuardBytes = Buffer.from(canonicalJson(preNonceGuard), 'utf8');
  const authority = createStableOperationAuthority({
    authorityId: 'authority-stable-capability-evidence-test',
    operationId,
    issuer: 'gaofeng21cn',
    issuedAt: '2026-07-21T00:15:00.000Z',
    expiresAt: '2026-07-21T00:55:00.000Z',
    objectiveFingerprint: stableObjectiveFingerprint,
    nonce: 'a'.repeat(32),
    appSha: sourceCommit,
    shellSha: shellCommit,
    frameworkSha: frameworkCommit,
    criticalBlobs: stableCriticalBlobs,
    sourceGate,
    preNonceGuard,
  });
  const runAuthorityReconcile = {
    schema: 'opl_release_dispatch_guard.v1',
    phase: 'run_bound',
    status: 'passed',
    dispatch_allowed: true,
    operation_id: operationId,
    authority_id: authority.authority_id,
    run_id: stableAuthorityRunId,
    owner_run_match_count: 1,
    nonce_consumed: false,
    mutation_invocation_count: 0,
  };
  const runAuthorityReconcileBytes = Buffer.from(canonicalJson(runAuthorityReconcile), 'utf8');
  const control = bindStableOperationAuthority({
    authority,
    authorityDigest: authority.authority_digest,
    actor: authority.issuer,
    runId: stableAuthorityRunId,
    runAttempt: 1,
    sourceGateDigest: sha256Evidence(sourceGateBytes),
    preNonceGuardDigest: sha256Evidence(preNonceGuardBytes),
    runAuthorityReconcileDigest: sha256Evidence(runAuthorityReconcileBytes),
    now: '2026-07-21T00:20:00.000Z',
  });
  const consumption = consumeStableOperationControl({
    control,
    operationId,
    runId: control.run_id,
    runAttempt: 1,
    nonce: 'a'.repeat(32),
  });
  const record = createStableOperationPublicationRecord({
    authority,
    control,
    consumption,
    sourceGateBytes,
    preNonceGuardBytes,
    runAuthorityReconcileBytes,
    repository: canonicalRepo,
    tag,
    plannedAssets: {
      assets: payloadAssets.map((item) => ({
        name: item.name,
        digest: item.sha256,
        size_bytes: item.size_bytes,
      })),
    },
  });
  const recordPath = path.join(root, 'stable-operation-publication-record.json');
  const recordBytes = Buffer.from(canonicalJson(record), 'utf8');
  fs.writeFileSync(recordPath, recordBytes);
  return {
    operationId,
    recordPath,
    recordAction: {
      action: 'upload',
      name: 'stable-operation-publication-record.json',
      source_path: recordPath,
      size_bytes: recordBytes.length,
      sha256: sha256Evidence(recordBytes),
    },
  };
}

function mutationAdmission(
  operation: 'standard' | 'resume_standard' | 'append_full' = 'standard',
  track: 'standard' | 'full' = 'standard',
): Record<string, string> {
  return {
    operation,
    track,
    'publication-channel': 'stable',
    'operation-id': operation === 'append_full' ? appendFullOperationId : standardOperationId,
    'operation-started-at': operation === 'append_full'
      ? appendFullOperationStartedAt
      : standardOperationStartedAt,
    'attempt-id': workflowAttemptId,
    'run-attempt': '1',
  };
}

function expectedMutationAttemptId(
  mutation: 'tag_reserve' | 'release_create' | 'asset_upload' | 'release_publish' | 'latest_patch',
  remoteTarget: string,
  subject: string,
): string {
  return `gha:${crypto.createHash('sha256').update(JSON.stringify({
    base_attempt_id: workflowAttemptId,
    mutation,
    remote_target: remoteTarget,
    subject,
  })).digest('hex').slice(0, 48)}`;
}

function sealAdmission(receipt: Record<string, any>): void {
  const evidence = {
    ...(receipt.publication_channel === undefined
      ? {}
      : { publication_channel: receipt.publication_channel }),
    operation: receipt.operation,
    classification: receipt.classification,
    component_manifest: receipt.component_manifest,
    pointer_authority: receipt.pointer_authority,
    bundle_digest: receipt.bundle_digest,
    candidate: receipt.candidate,
    standard_assets_sha256: receipt.standard_assets_sha256,
    hosted_publication_floor: receipt.hosted_publication_floor,
    homebrew: receipt.homebrew,
    latest_compare_and_swap: receipt.latest_compare_and_swap,
  };
  receipt.input_digest = `sha256:${crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex')}`;
}

function previewFixture() {
  const files = fixture([]);
  const previewVersion = '26.7.22-preview.r1';
  const previewUpdaterVersion = '26.7.2201';
  const previewTag = `v${previewVersion}`;
  const previewZip = asset(`One-Person-Lab-${previewVersion}-mac-arm64.zip`, '8');
  const previewDmg = asset(`One-Person-Lab-${previewVersion}-mac-arm64.dmg`, '6');
  const previewDeb = asset(`One-Person-Lab-${previewVersion}-linux-x64.deb`, '5');
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  bundle.release = {
    channel: 'preview',
    version: previewVersion,
    updater_version: previewUpdaterVersion,
    tag: previewTag,
    prerelease: false,
  };
  fs.writeFileSync(files.bundlePath, `${JSON.stringify(bundle)}\n`);
  const status = JSON.parse(fs.readFileSync(files.statusPath, 'utf8'));
  status.release_bundle_status.latest_eligible = false;
  status.release_bundle_status.bundle = bundle;
  status.release_bundle_status.tracks.standard.assets = [previewZip, previewDmg, previewDeb, componentManifestAsset];
  fs.writeFileSync(files.statusPath, `${JSON.stringify(status)}\n`);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.publication_channel = 'preview';
  admission.classification = {
    quality_status: 'preview',
    build_trigger: 'manual',
    preview_kind: 'dev',
    quality_unchanged: true,
    non_stable_notice: true,
    skipped_gates: ['homebrew_clean_install'],
    failed_gates: [],
  };
  admission.pointer_authority = {
    mode: 'protected_single_use_exact_version',
    single_use: true,
    persistent_override: false,
    authority_digest: `sha256:${'1'.repeat(64)}`,
    failure_policy: 'preserve_current_latest_lkg',
    stable_reclaim: 'next_qualified_stable',
  };
  admission.candidate = {
    display_version: previewVersion,
    updater_version: previewUpdaterVersion,
    app_sha: sourceCommit,
    shell_sha: shellCommit,
    framework_sha: frameworkCommit,
    zip: {
      name: previewZip.name,
      sha256: previewZip.sha256,
      size_bytes: previewZip.size_bytes,
    },
    dmg: {
      name: previewDmg.name,
      sha256: previewDmg.sha256,
      size_bytes: previewDmg.size_bytes,
    },
  };
  admission.hosted_publication_floor.required_assets = [
    previewDmg.name,
    previewZip.name,
    `${previewZip.name}.blockmap`,
    previewDeb.name,
    'latest-arm64-mac.yml',
    'opl-app-component-manifest.json',
    'opl-install.sh',
    'opl-app-installer.sh',
    'standard-gatekeeper-launch-policy.json',
    'standard-apple-notarization-receipt.json',
  ];
  admission.homebrew = null;
  admission.latest_compare_and_swap.candidate.tag = previewTag;
  sealAdmission(admission);
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  return { ...files, previewVersion, previewUpdaterVersion, previewTag };
}

function nightlyLatestFixture() {
  const files = fixture([]);
  const nightlyVersion = '26.7.22-nightly.r1';
  const nightlyUpdaterVersion = '26.7.2291-nightly.1';
  const nightlyTag = `v${nightlyVersion}`;
  const nightlyZip = asset(`One-Person-Lab-${nightlyVersion}-mac-arm64.zip`, '7');
  const nightlyDmg = asset(`One-Person-Lab-${nightlyVersion}-mac-arm64.dmg`, '5');
  const nightlyDeb = asset(`One-Person-Lab-${nightlyVersion}-linux-x64.deb`, '4');
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  bundle.release = {
    channel: 'nightly',
    version: nightlyVersion,
    updater_version: nightlyUpdaterVersion,
    tag: nightlyTag,
    prerelease: true,
  };
  fs.writeFileSync(files.bundlePath, `${JSON.stringify(bundle)}\n`);
  const status = JSON.parse(fs.readFileSync(files.statusPath, 'utf8'));
  status.release_bundle_status.latest_eligible = false;
  status.release_bundle_status.bundle = bundle;
  status.release_bundle_status.tracks.standard.assets = [nightlyZip, nightlyDmg, nightlyDeb, componentManifestAsset];
  fs.writeFileSync(files.statusPath, `${JSON.stringify(status)}\n`);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.publication_channel = 'nightly';
  admission.classification = {
    quality_status: 'preview',
    build_trigger: 'automated',
    preview_kind: 'nightly',
    quality_unchanged: true,
    non_stable_notice: true,
    skipped_gates: ['stable_heavy_vm', 'homebrew_clean_install'],
    failed_gates: [],
  };
  admission.pointer_authority = {
    mode: 'protected_single_use_exact_version',
    single_use: true,
    persistent_override: false,
    authority_digest: `sha256:${'2'.repeat(64)}`,
    failure_policy: 'preserve_current_latest_lkg',
    stable_reclaim: 'next_qualified_stable',
  };
  admission.candidate = {
    display_version: nightlyVersion,
    updater_version: nightlyUpdaterVersion,
    app_sha: sourceCommit,
    shell_sha: shellCommit,
    framework_sha: frameworkCommit,
    zip: {
      name: nightlyZip.name,
      sha256: nightlyZip.sha256,
      size_bytes: nightlyZip.size_bytes,
    },
    dmg: {
      name: nightlyDmg.name,
      sha256: nightlyDmg.sha256,
      size_bytes: nightlyDmg.size_bytes,
    },
  };
  admission.hosted_publication_floor.required_assets = [
    nightlyDmg.name,
    nightlyZip.name,
    `${nightlyZip.name}.blockmap`,
    nightlyDeb.name,
    'latest-arm64-mac.yml',
    'opl-app-component-manifest.json',
    'opl-install.sh',
    'opl-app-installer.sh',
  ];
  admission.homebrew = null;
  admission.latest_compare_and_swap.candidate.tag = nightlyTag;
  sealAdmission(admission);
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  return { ...files, nightlyVersion, nightlyUpdaterVersion, nightlyTag };
}

function success(value: unknown = ''): GitHubCommandResult {
  return {
    status: 0,
    stdout: value === '' ? '' : JSON.stringify(value),
    stderr: '',
  };
}

function releaseResponse(
  assets: Asset[],
  options: { draft?: boolean; immutable?: boolean } = {},
): Record<string, unknown> {
  return {
    id: 12345,
    tag_name: tag,
    name: `One Person Lab v${version}`,
    draft: options.draft ?? false,
    prerelease: false,
    target_commitish: sourceCommit,
    body: notes,
    immutable: options.immutable ?? true,
    assets: assets.map((asset) => ({
      name: asset.name,
      size: asset.size_bytes,
      digest: asset.sha256,
    })),
  };
}

function fixture(
  actions: Asset[],
  releaseOperation: 'standard' | 'append_full' = 'standard',
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-github-deadline-'));
  const uploadActions = releaseOperation === 'append_full'
    ? writeFullUploadActions(root)
    : actions;
  const bundlePath = path.join(root, 'bundle.json');
  const planPath = path.join(root, 'plan.json');
  const statusPath = path.join(root, 'status.json');
  const admissionPath = path.join(root, 'latest-admission.json');
  const bundle = {
    surface_kind: 'opl_release_bundle.v1',
    bundle_digest: bundleDigest,
    release: { channel: 'stable', version, updater_version: updaterVersion, tag, prerelease: false },
    sources: {
      app: { repo, source_commit: sourceCommit },
      shell: { source_commit: shellCommit },
      framework: { source_commit: frameworkCommit },
    },
    prepared_notes: { markdown: notes },
  };
  const track = releaseOperation === 'append_full' ? 'full' : 'standard';
  const operationId = releaseOperation === 'append_full' ? appendFullOperationId : standardOperationId;
  const operationStartedAt = releaseOperation === 'append_full'
    ? appendFullOperationStartedAt
    : standardOperationStartedAt;
  const operationControl = {
    operation_id: operationId,
    operation_started_at: operationStartedAt,
    operation_deadline_at: deadlineAt,
  };
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle)}\n`);
  fs.writeFileSync(planPath, `${JSON.stringify({
    release_bundle_publish: {
      bundle_digest: bundleDigest,
      track,
      status: 'ready',
      receipt: {
        release_operation: releaseOperation,
        operation_control: operationControl,
        details: {
          upload_actions: uploadActions.map((asset) => ({
            action: 'upload',
            name: asset.name,
            source_path: asset.source_path,
            size_bytes: asset.size_bytes,
            sha256: asset.sha256,
          })),
        },
      },
    },
  })}\n`);
  fs.writeFileSync(statusPath, `${JSON.stringify({
    release_bundle_status: {
      bundle_digest: bundleDigest,
      latest_eligible: true,
      bundle,
      tracks: { standard: { assets: [latestZip, latestDmg, latestDeb, componentManifestAsset] } },
      operation_controls: { standard: operationControl, append_full: null },
    },
  })}\n`);
  const admission: Record<string, any> = {
    schema: 'opl_standard_latest_admission_receipt.v1',
    status: 'passed',
    publication_channel: 'stable',
    operation: 'move_latest_pointer',
    latest_activation_admitted: true,
    classification: {
      quality_status: 'stable',
      build_trigger: 'manual',
      preview_kind: null,
      quality_unchanged: true,
      non_stable_notice: false,
      skipped_gates: [],
      failed_gates: [],
    },
    component_manifest: {
      manifest_digest: `sha256:${'d'.repeat(64)}`,
      file_sha256: componentManifestAsset.sha256,
      source_commit: sourceCommit,
      artifact_digest: `sha256:${'e'.repeat(64)}`,
    },
    pointer_authority: {
      mode: 'qualified_stable_default',
      single_use: false,
      persistent_override: false,
      authority_digest: null,
      failure_policy: 'preserve_current_latest_lkg',
      stable_reclaim: 'next_qualified_stable',
    },
    bundle_digest: bundleDigest,
    candidate: {
      display_version: version,
      updater_version: updaterVersion,
      app_sha: sourceCommit,
      shell_sha: shellCommit,
      framework_sha: frameworkCommit,
      zip: { name: latestZip.name, sha256: latestZip.sha256, size_bytes: latestZip.size_bytes },
      dmg: { name: latestDmg.name, sha256: latestDmg.sha256, size_bytes: latestDmg.size_bytes },
    },
    standard_assets_sha256: `sha256:${'e'.repeat(64)}`,
    hosted_publication_floor: {
      schema: 'opl_standard_hosted_publication_floor.v1',
      source_contract_build_preflight: 'passed',
      remote_digest_readback: 'passed',
      required_assets: [
        latestDmg.name,
        latestZip.name,
        `${latestZip.name}.blockmap`,
        latestDeb.name,
        'latest-arm64-mac.yml',
        'opl-app-component-manifest.json',
        'opl-install.sh',
        'opl-app-installer.sh',
        'standard-gatekeeper-launch-policy.json',
        'standard-apple-notarization-receipt.json',
      ],
      self_hosted_ancestor_count: 0,
      vm_ancestor_count: 0,
      tart_ancestor_count: 0,
    },
    homebrew: {
      publication_receipt_sha256: `sha256:${'7'.repeat(64)}`,
      readback_receipt_sha256: `sha256:${'a'.repeat(64)}`,
    },
    latest_compare_and_swap: {
      expected_current: { tag: expectedCurrentLatestTag },
      candidate: { tag },
    },
  };
  sealAdmission(admission);
  fs.writeFileSync(admissionPath, `${JSON.stringify(admission)}\n`);
  return { root, bundlePath, planPath, statusPath, admissionPath, uploadActions };
}

function asset(name: string, byte: string): Asset {
  return {
    name,
    size_bytes: 100,
    sha256: `sha256:${byte.repeat(64)}`,
    source_path: `/immutable/${name}`,
  };
}

function writeFullUploadActions(root: string): Asset[] {
  const dmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const dmgPath = path.join(root, dmgName);
  const dmgBytes = Buffer.from('exact independently versioned Full DMG bytes\n');
  fs.writeFileSync(dmgPath, dmgBytes);
  const dmgAction: Asset = {
    name: dmgName,
    size_bytes: dmgBytes.length,
    sha256: sha256Evidence(dmgBytes),
    source_path: dmgPath,
  };
  const manifestPath = path.join(root, 'opl-release-manifest.json');
  const manifestBytes = Buffer.from(`${JSON.stringify({
    schema: 'opl_public_release_manifest.v1',
    package_kind: 'opl_full_first_install_macos_arm64',
    owner_authority: 'one-person-lab-app',
    version,
    release_version: version,
    primary_install_asset: dmgName,
    assets: [{
      name: dmgName,
      role: 'full_first_install_carrier',
      size_bytes: dmgBytes.length,
      sha256: dmgAction.sha256,
    }],
  })}\n`);
  fs.writeFileSync(manifestPath, manifestBytes);
  return [
    dmgAction,
    {
      name: 'opl-release-manifest.json',
      size_bytes: manifestBytes.length,
      sha256: sha256Evidence(manifestBytes),
      source_path: manifestPath,
    },
  ];
}

function isReleaseInspect(args: string[]): boolean {
  return args[0] === 'api' && (
    args[1] === `repos/${repo}/releases/tags/${tag}`
    || args[1] === `repos/${repo}/releases/12345`
  );
}

function isReleaseView(args: string[]): boolean {
  return isReleaseViewFor(args, tag, repo);
}

function isReleaseViewFor(args: string[], releaseTag: string, releaseRepo: string): boolean {
  return (
    args[0] === 'release'
    && args[1] === 'view'
    && args[2] === releaseTag
    && args[3] === '--repo'
    && args[4] === releaseRepo
    && args[5] === '--json'
    && args[6] === 'databaseId,tagName'
  );
}

function isTagRefReadFor(args: string[], releaseTag: string, releaseRepo: string): boolean {
  return args[0] === 'api' && args[1] === `repos/${releaseRepo}/git/ref/tags/${releaseTag}`;
}

function isTagRefCreateFor(args: string[], releaseRepo: string): boolean {
  return (
    args[0] === 'api'
    && args[1] === '--method'
    && args[2] === 'POST'
    && args[3] === `repos/${releaseRepo}/git/refs`
    && args[4] === '--input'
    && args[5] === '-'
  );
}

function tagRefResponse(releaseTag: string, targetCommitish = sourceCommit): GitHubCommandResult {
  return success({
    ref: `refs/tags/${releaseTag}`,
    object: {
      type: 'commit',
      sha: targetCommitish,
    },
  });
}

function isImmutableCapabilityRead(args: string[]): boolean {
  return args[0] === 'api' && args[1] === `repos/${repo}/immutable-releases`;
}

function immutableCapabilityResponse(enabled = true): GitHubCommandResult {
  return success({ enabled, enforced_by_owner: false });
}

test('absent GitHub Release remote inspection yields an empty receipt for the first upload plan', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-absent-release-receipt-'));
  const bundlePath = path.join(root, 'bundle.json');
  const inspectionPath = path.join(root, 'remote-before.json');
  const requiredNames = ['first.zip', 'second.dmg'];
  try {
    fs.writeFileSync(bundlePath, `${JSON.stringify({
      surface_kind: 'opl_release_bundle.v1',
      bundle_digest: bundleDigest,
      tracks: { standard: { required_asset_names: requiredNames } },
    })}\n`);
    fs.writeFileSync(inspectionPath, `${JSON.stringify({
      surface_kind: 'opl_app_github_release_inspection.v1',
      repository: repo,
      tag,
      release: { exists: false },
      assets: [],
    })}\n`);
    const receipt = buildExecutorReceipt({
      operation: 'remote_inspect',
      'release-operation': 'standard',
      'operation-id': standardOperationId,
      executor: 'remote',
      'attempt-id': workflowAttemptId,
      'remote-target': `github-release:${repo}@${tag}`,
      track: 'standard',
      outcome: 'complete',
      'publication-scope': 'track_assets',
      bundle: bundlePath,
      inspection: inspectionPath,
    } as any);
    assert.deepEqual(receipt.assets, []);
    assert.equal(receipt.outcome, 'complete');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('absent GitHub Release remote inspection rejects missing, non-empty, or duplicate assets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-malformed-absent-release-receipt-'));
  const bundlePath = path.join(root, 'bundle.json');
  const inspectionPath = path.join(root, 'remote-before.json');
  try {
    fs.writeFileSync(bundlePath, `${JSON.stringify({
      surface_kind: 'opl_release_bundle.v1',
      bundle_digest: bundleDigest,
      tracks: { standard: { required_asset_names: ['first.zip', 'second.dmg'] } },
    })}\n`);
    for (const assets of [
      undefined,
      [{ name: 'unexpected.zip' }],
      [{ name: 'first.zip' }, { name: 'first.zip' }],
    ]) {
      fs.writeFileSync(inspectionPath, `${JSON.stringify({
        surface_kind: 'opl_app_github_release_inspection.v1',
        repository: repo,
        tag,
        release: { exists: false },
        ...(assets === undefined ? {} : { assets }),
      })}\n`);
      assert.throws(
        () => buildExecutorReceipt({
          operation: 'remote_inspect',
          'release-operation': 'standard',
          'operation-id': standardOperationId,
          executor: 'remote',
          'attempt-id': workflowAttemptId,
          'remote-target': `github-release:${repo}@${tag}`,
          track: 'standard',
          outcome: 'complete',
          'publication-scope': 'track_assets',
          bundle: bundlePath,
          inspection: inspectionPath,
        } as any),
        /Remote standard absent-release inspection must contain an empty asset list/,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('existing GitHub Release remote inspection accepts a unique required subset only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-partial-release-receipt-'));
  const bundlePath = path.join(root, 'bundle.json');
  const inspectionPath = path.join(root, 'remote-before.json');
  const requiredNames = ['first.zip', 'second.dmg'];
  const execute = (assets: Array<Record<string, unknown>>) => {
    fs.writeFileSync(inspectionPath, `${JSON.stringify({
      surface_kind: 'opl_app_github_release_inspection.v1',
      repository: repo,
      tag,
      release: { exists: true, id: 12345 },
      assets,
    })}\n`);
    return buildExecutorReceipt({
      operation: 'remote_inspect',
      'release-operation': 'standard',
      'operation-id': standardOperationId,
      executor: 'remote',
      'attempt-id': workflowAttemptId,
      'remote-target': `github-release:${repo}@${tag}`,
      track: 'standard',
      outcome: 'complete',
      'publication-scope': 'track_assets',
      bundle: bundlePath,
      inspection: inspectionPath,
    } as any);
  };
  try {
    fs.writeFileSync(bundlePath, `${JSON.stringify({
      surface_kind: 'opl_release_bundle.v1',
      bundle_digest: bundleDigest,
      tracks: { standard: { required_asset_names: requiredNames } },
    })}\n`);

    assert.deepEqual(execute([]).assets, []);
    const second = asset(requiredNames[1]!, '2');
    assert.deepEqual(execute([second]).assets, [{
      name: second.name,
      size_bytes: second.size_bytes,
      sha256: second.sha256,
    }]);
    assert.throws(
      () => execute([asset('unknown.bin', '3')]),
      /contains unknown asset unknown\.bin/,
    );
    assert.throws(() => execute([second, second]), /contains duplicate asset second\.dmg/);
    assert.throws(
      () => execute([{ ...second, sha256: 'sha256:not-a-digest' }]),
      /has no exact digest and positive size/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deadline expiry before asset N prevents asset N and every later mutation', () => {
  const first = asset('first.zip', '1');
  const second = asset('second.yml', '2');
  const files = fixture([first, second]);
  const remoteAssets: Asset[] = [];
  const mutationCalls: string[][] = [];
  const mutationTimes = [deadlineMs - 60_000, deadlineMs];
  const runtime: GitHubAdapterRuntime = {
    now: () => mutationTimes.shift() ?? deadlineMs,
    readTimeoutMs: 1_234,
    mutationTimeoutMs: 120_000,
    run(command, args, options) {
      assert.equal(command, 'gh');
      assert.equal(options.killSignal, 'SIGTERM');
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) {
        assert.equal(options.timeout, 1_234);
        return success(releaseResponse(remoteAssets, { draft: true, immutable: false }));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        mutationCalls.push(args);
        assert.equal(options.timeout, 60_000);
        const uploaded = [first, second].find((candidate) => candidate.source_path === args[3]);
        assert.ok(uploaded);
        remoteAssets.push(uploaded);
        return success();
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'deadline_elapsed');
  assert.deepEqual(result.uploaded, [first.name]);
  assert.equal(result.unresolved_asset, second.name);
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_deadline_elapsed');
  assert.equal(result.mutation_attempt_id, expectedMutationAttemptId(
    'asset_upload', `github-release:${repo}@${tag}`, second.name,
  ));
  assert.equal(result.remote_target, `github-release:${repo}@${tag}`);
  assert.equal(result.failure.mutation_attempt_id, result.mutation_attempt_id);
  assert.equal(result.failure.remote_target, result.remote_target);
  assert.equal(result.failure.input_digest.startsWith('sha256:'), true);
  assert.equal(mutationCalls.length, 1);
  assert.equal(mutationCalls[0][3], first.source_path);
});

test('a timed out asset upload stops all mutation and performs only fresh read-only inspection', () => {
  const first = asset('first.zip', '3');
  const second = asset('second.yml', '4');
  const files = fixture([first, second]);
  const calls: Array<{ args: string[]; options: GitHubCommandOptions }> = [];
  let inspections = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 90_000,
    readTimeoutMs: 2_345,
    run(_command, args, options) {
      calls.push({ args, options });
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) {
        inspections += 1;
        return success(releaseResponse([], { draft: true, immutable: false }));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        return {
          status: null,
          signal: 'SIGTERM',
          stdout: 'partial stdout',
          stderr: 'timed out stderr',
          error: Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        };
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  const uploads = calls.filter(({ args }) => args[0] === 'release' && args[1] === 'upload');
  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.unresolved_asset, first.name);
  assert.equal(result.retry_disposition, 'read_only_reconcile_only');
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_timeout');
  assert.equal(result.mutation_attempt_id, expectedMutationAttemptId(
    'asset_upload', `github-release:${repo}@${tag}`, first.name,
  ));
  assert.equal(result.remote_target, `github-release:${repo}@${tag}`);
  assert.equal(result.failure.mutation_attempt_id, result.mutation_attempt_id);
  assert.equal(result.failure.remote_target, result.remote_target);
  assert.equal(result.failure.timed_out, true);
  assert.equal(result.failure.stdout, 'partial stdout');
  assert.equal(result.failure.stderr, 'timed out stderr');
  assert.match(result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(uploads.length, 1);
  assert.equal(inspections, 3, 'initial, pre-upload, and one post-timeout inspection are bounded reads');
  assert.ok(calls.filter(({ args }) => isReleaseInspect(args)).every(({ options }) => options.timeout === 2_345));
});

test('a timed out tag reservation performs one mutation and never creates a Release', () => {
  const files = fixture([asset('first.zip', '5')]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 90_000,
    readTimeoutMs: 2_111,
    run(_command, args, options) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isReleaseView(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isTagRefReadFor(args, tag, repo)) {
        assert.equal(options.timeout, 2_111);
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        return {
          status: null,
          signal: 'SIGTERM',
          stdout: 'possibly reserved',
          stderr: 'timed out',
          error: Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        };
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.failure.mutation, 'tag_reserve');
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_timeout');
  assert.equal(result.mutation_attempt_id, expectedMutationAttemptId(
    'tag_reserve',
    `github-ref:${repo}@refs/tags/${tag}`,
    sourceCommit,
  ));
  assert.equal(result.remote_target, `github-ref:${repo}@refs/tags/${tag}`);
  assert.equal(calls.filter((args) => isTagRefCreateFor(args, repo)).length, 1);
  assert.equal(calls.filter((args) => isTagRefReadFor(args, tag, repo)).length, 2);
  assert.equal(calls.filter((args) => args[3] === `repos/${repo}/releases`).length, 0);
});

test('a timed out Release create performs one Release mutation and then read-only reconciliation only', () => {
  const files = fixture([asset('first.zip', '5')]);
  const calls: string[][] = [];
  let tagReserved = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 90_000,
    readTimeoutMs: 2_222,
    run(_command, args, options) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) {
        assert.equal(options.timeout, 2_222);
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isReleaseView(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isTagRefReadFor(args, tag, repo)) {
        assert.equal(options.timeout, 2_222);
        return tagReserved
          ? tagRefResponse(tag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(tag);
      }
      if (args[3] === `repos/${repo}/releases`) {
        return {
          status: null,
          signal: 'SIGTERM',
          stdout: 'possibly created',
          stderr: 'timed out',
          error: Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        };
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.failure.mutation, 'release_create');
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_timeout');
  assert.equal(result.mutation_attempt_id, expectedMutationAttemptId(
    'release_create', `github-release:${repo}@${tag}`, tag,
  ));
  assert.equal(result.remote_target, `github-release:${repo}@${tag}`);
  assert.equal(result.failure.mutation_attempt_id, result.mutation_attempt_id);
  assert.equal(result.failure.remote_target, result.remote_target);
  assert.equal(calls.filter((args) => args[3] === `repos/${repo}/releases`).length, 1);
  assert.equal(calls.filter((args) => isTagRefCreateFor(args, repo)).length, 1);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
  assert.equal(calls.filter(isReleaseInspect).length, 2, 'one pre-create read and one bounded reconcile read');
});

test('accepted Release create uses its exact id while the draft remains absent by tag', () => {
  const first = asset('first.zip', '6');
  const files = fixture([first]);
  const calls: string[][] = [];
  const remoteAssets: Asset[] = [];
  let tagReserved = false;
  let created = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 90_000,
    readTimeoutMs: 2_333,
    run(_command, args, options) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${tag}`) {
        assert.equal(options.timeout, 2_333);
        if (!published) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success(releaseResponse(remoteAssets, { draft: false, immutable: true }));
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/12345`) {
        assert.equal(created, true);
        assert.equal(options.timeout, 2_333);
        return success(releaseResponse(remoteAssets, {
          draft: !published,
          immutable: published,
        }));
      }
      if (isReleaseView(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isTagRefReadFor(args, tag, repo)) {
        return tagReserved
          ? tagRefResponse(tag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(tag);
      }
      if (args[3] === `repos/${repo}/releases`) {
        created = true;
        return success(releaseResponse([], { draft: true, immutable: false }));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        remoteAssets.push(first);
        return success();
      }
      if (args.includes('PATCH')) {
        published = true;
        return success(releaseResponse(remoteAssets, { draft: false, immutable: true }));
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'complete');
  assert.deepEqual(result.uploaded, [first.name]);
  assert.equal(result.inspection.release.id, 12345);
  assert.equal(result.inspection.release.immutable, true);
  assert.equal(calls.filter((args) => isTagRefCreateFor(args, repo)).length, 1);
  assert.equal(calls.filter((args) => args[3] === `repos/${repo}/releases`).length, 1);
  const tagReadIndexes = calls.flatMap((args, index) => (
    isTagRefReadFor(args, tag, repo) ? [index] : []
  ));
  const tagCreateIndex = calls.findIndex((args) => isTagRefCreateFor(args, repo));
  const releaseCreateIndex = calls.findIndex((args) => args[3] === `repos/${repo}/releases`);
  assert.equal(tagReadIndexes.length, 2);
  assert.ok(
    tagReadIndexes[0]! < tagCreateIndex
      && tagCreateIndex < tagReadIndexes[1]!
      && tagReadIndexes[1]! < releaseCreateIndex,
    '404 read, tag reservation, exact readback, and Release creation stay strictly ordered',
  );
  assert.equal(
    calls.filter((args) => args[1] === `repos/${repo}/releases/tags/${tag}`).length,
    1,
    'the draft is never re-queried through the by-tag endpoint',
  );
  assert.ok(
    calls.filter((args) => args[1] === `repos/${repo}/releases/12345`).length >= 4,
    'create, upload, and publish readback stay bound to the exact release id',
  );
});

test('a conflicting reserved tag fails closed before Release creation', () => {
  const files = fixture([asset('first.zip', '6')]);
  const calls: string[][] = [];
  const conflictingCommit = 'e'.repeat(40);
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 90_000,
    run(_command, args) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isReleaseView(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isTagRefReadFor(args, tag, repo)) return tagRefResponse(tag, conflictingCommit);
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    new RegExp(`Existing refs/tags/${tag} points to ${conflictingCommit}, expected ${sourceCommit}`),
  );
  assert.equal(calls.filter((args) => isTagRefCreateFor(args, repo)).length, 0);
  assert.equal(calls.filter((args) => args[3] === `repos/${repo}/releases`).length, 0);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
});

test('an existing draft hidden from the by-tag endpoint is bound by id before any create', () => {
  const first = asset('first.zip', '6');
  const files = fixture([first]);
  const calls: string[][] = [];
  const remoteAssets: Asset[] = [];
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 90_000,
    run(_command, args) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${tag}`) {
        if (!published) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success(releaseResponse(remoteAssets, { draft: false, immutable: true }));
      }
      if (isReleaseView(args)) {
        return success({ databaseId: 12345, tagName: tag });
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/12345`) {
        return success(releaseResponse(remoteAssets, {
          draft: !published,
          immutable: published,
        }));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        remoteAssets.push(first);
        return success();
      }
      if (args.includes('PATCH')) {
        published = true;
        return success(releaseResponse(remoteAssets, { draft: false, immutable: true }));
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'complete');
  assert.deepEqual(result.uploaded, [first.name]);
  assert.equal(result.inspection.release.id, 12345);
  assert.equal(calls.filter(isReleaseView).length, 1);
  assert.equal(calls.filter((args) => args.includes('POST')).length, 0);
  assert.ok(
    calls.findIndex(isReleaseView)
      < calls.findIndex((args) => args[1] === `repos/${repo}/releases/12345`),
  );
});

test('accepted Release create with a mismatched response identity fails closed without follow-up mutation', () => {
  const files = fixture([asset('first.zip', '7')]);
  const calls: string[][] = [];
  let tagReserved = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 90_000,
    run(_command, args) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isReleaseView(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isTagRefReadFor(args, tag, repo)) {
        return tagReserved
          ? tagRefResponse(tag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(tag);
      }
      if (args[3] === `repos/${repo}/releases`) {
        return success({
          ...releaseResponse([], { draft: true, immutable: false }),
          tag_name: `${tag}-other`,
        });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.failure.mutation, 'release_create');
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_readback_unknown');
  assert.equal(result.reconciliation.status, 'create_response_invalid');
  assert.match(result.reconciliation.failure.error_message, /conflicts with the exact draft identity/);
  assert.equal(result.reconciliation.fallback.status, 'complete');
  assert.equal(result.reconciliation.fallback.observation.release.exists, false);
  assert.equal(calls.filter((args) => isTagRefCreateFor(args, repo)).length, 1);
  assert.equal(calls.filter((args) => args[3] === `repos/${repo}/releases`).length, 1);
  assert.equal(calls.filter(isReleaseInspect).length, 2);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
});

test('a timed out Latest PATCH performs readback only and remains outcome_unknown', () => {
  const files = fixture([]);
  const calls: string[][] = [];
  let latestTag = expectedCurrentLatestTag;
  let latestReads = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 45_000,
    readTimeoutMs: 3_456,
    run(_command, args, options) {
      calls.push(args);
      assert.equal(options.killSignal, 'SIGTERM');
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        latestReads += 1;
        assert.equal(options.timeout, 3_456);
        return success({ tag_name: latestTag });
      }
      if (args.includes('PATCH')) {
        latestTag = tag;
        return {
          status: null,
          signal: 'SIGTERM',
          stdout: 'possibly accepted',
          stderr: 'deadline killed process',
          error: Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        };
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = activateLatest({
    ...mutationAdmission('resume_standard'),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  const patches = calls.filter((args) => args.includes('PATCH'));
  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_timeout');
  assert.equal(result.mutation_attempt_id, expectedMutationAttemptId(
    'latest_patch', `github-latest:${repo}@${tag}`, tag,
  ));
  assert.equal(result.remote_target, `github-latest:${repo}@${tag}`);
  assert.equal(result.failure.mutation_attempt_id, result.mutation_attempt_id);
  assert.equal(result.failure.remote_target, result.remote_target);
  assert.equal(result.retry_disposition, 'read_only_reconcile_only');
  assert.equal(result.reconciliation.observation.tag_name, tag);
  assert.equal(patches.length, 1);
  assert.equal(latestReads, 2, 'one pre-mutation inspect and one post-timeout readback');
});

test('read-only inspection remains bounded after the operation deadline', () => {
  const seen: GitHubCommandOptions[] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs + 60_000,
    readTimeoutMs: 4_567,
    run(_command, args, options) {
      seen.push(options);
      assert.equal(isReleaseInspect(args), true);
      return success(releaseResponse([]));
    },
  };

  const observation = inspectRelease(repo, tag, runtime);
  assert.equal(observation.release.exists, true);
  assert.deepEqual(seen.map(({ timeout, killSignal }) => ({ timeout, killSignal })), [
    { timeout: 4_567, killSignal: 'SIGTERM' },
  ]);
});

test('Framework latest_eligible cannot bypass the App Latest admission receipt', () => {
  const files = fixture([]);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Missing --latest-admission/,
  );
  assert.equal(calls, 0);
});

test('complete hosted admission does not require legacy Framework latest_eligible state', () => {
  const files = fixture([]);
  const status = JSON.parse(fs.readFileSync(files.statusPath, 'utf8'));
  status.release_bundle_status.latest_eligible = false;
  fs.writeFileSync(files.statusPath, `${JSON.stringify(status)}\n`);
  let latestTag = expectedCurrentLatestTag;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: latestTag });
      }
      if (args.includes('PATCH')) {
        latestTag = tag;
        return success();
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };
  const result = activateLatest({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(result.latest_compare_and_swap.patch_performed, true);
});

test('Latest admission for different ZIP bytes fails before any GitHub call', () => {
  const files = fixture([]);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.candidate.zip.sha256 = `sha256:${'f'.repeat(64)}`;
  sealAdmission(admission);
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Latest admission ZIP sha256 does not match/,
  );
  assert.equal(calls, 0);
});

test('GitHub mutation commands require an immutable operation deadline', () => {
  assert.throws(() => applyPublishPlan(mutationAdmission()), /Missing --operation-deadline-at/);
  assert.throws(() => activateLatest(mutationAdmission()), /Missing --operation-deadline-at/);
});

test('GitHub mutation commands require an explicit publication channel before any GitHub call', () => {
  const files = fixture([]);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  const values = mutationAdmission();
  delete values['publication-channel'];
  assert.throws(
    () => applyPublishPlan({
      ...values,
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Missing --publication-channel/,
  );
  assert.throws(
    () => activateLatest({
      ...values,
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Missing --publication-channel/,
  );
  assert.equal(calls, 0);
});

test('GitHub mutation commands reject incomplete operation identity before any gh call', () => {
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  for (const missing of ['operation-id', 'operation-started-at', 'attempt-id'] as const) {
    const values: Record<string, string> = {
      ...mutationAdmission(),
      'operation-deadline-at': deadlineAt,
    };
    delete values[missing];
    assert.throws(
      () => applyPublishPlan(values, runtime),
      (error: any) => {
        assert.equal(error.result.status, 'failed');
        assert.match(error.result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
        assert.ok(error.result.failure.stderr);
        return true;
      },
    );
  }
  assert.equal(calls, 0);
});

test('Latest compare-and-swap drift fails closed before PATCH', () => {
  const files = fixture([]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: 'v26.7.19' });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    (error: any) => {
      assert.equal(error.result.status, 'failed');
      assert.equal(error.result.failure.failure_taxonomy, 'github_latest_compare_and_swap_drift');
      assert.equal(error.result.failure.expected_current_tag, expectedCurrentLatestTag);
      assert.equal(error.result.failure.observed_current_tag, 'v26.7.19');
      assert.equal(error.result.retry_disposition, 'inspect_only_no_patch_require_new_admission');
      assert.match(error.result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
      assert.equal(error.result.failure.stdout, '');
      assert.match(error.result.failure.stderr, /Latest drifted/);
      return true;
    },
  );
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
});

test('Latest already pointing at the candidate is idempotent with zero PATCH', () => {
  const files = fixture([]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: tag });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = activateLatest({
    ...mutationAdmission('resume_standard'),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'idempotent');
  assert.equal(result.latest_compare_and_swap.patch_performed, false);
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
});

test('Latest compare-and-swap rejects remote drift from the sealed expected current tag', () => {
  const files = fixture([]);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.latest_compare_and_swap.expected_current = {
    tag: 'v26.7.19',
  };
  sealAdmission(admission);
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls += 1;
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: expectedCurrentLatestTag });
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Latest drifted: expected v26\.7\.19, observed v26\.7\.20/,
  );
  assert.equal(calls, 2);
});

test('Latest rejects a tampered compare-and-swap predecessor before any GitHub call', () => {
  const files = fixture([]);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.latest_compare_and_swap.expected_current = {
    tag: 'v26.7.21',
  };
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Latest admission input_digest does not match/,
  );
  assert.equal(calls, 0);
});

test('raw GitHub mutation commands reject reruns and operation-track mismatches before gh', () => {
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  for (const values of [
    { 'run-attempt': '1' },
    { operation: 'standard', 'run-attempt': '1' },
    { operation: 'publish', track: 'standard', 'run-attempt': '1' },
    { operation: 'standard', track: 'nightly', 'run-attempt': '1' },
    { ...mutationAdmission(), 'run-attempt': '2' },
    { ...mutationAdmission('append_full', 'standard') },
    { ...mutationAdmission('standard', 'full') },
  ]) {
    assert.throws(
      () => applyPublishPlan(values, runtime),
      (error: any) => {
        assert.equal(error.result.status, 'failed');
        assert.match(error.result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
        assert.equal(error.result.failure.stdout, '');
        assert.ok(error.result.failure.stderr);
        return true;
      },
    );
  }
  assert.equal(calls, 0);
});

test('github-apply admits append_full only for a Framework Full publish plan', () => {
  const files = fixture([], 'append_full');
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  const adjunct = fullAdjunctReleaseIdentity(bundle, files.uploadActions);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls += 1;
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${adjunct.tag}`) {
        return success({
          ...releaseResponse(files.uploadActions),
          tag_name: adjunct.tag,
          name: adjunct.name,
          body: adjunct.notes,
        });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = applyPublishPlan({
    ...mutationAdmission('append_full', 'full'),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(result.tag, adjunct.tag);
  assert.equal(calls, 1);
});

test('append_full identity fails closed without its own manifest and never inspects a Standard Release', () => {
  const bundle = {
    release: { version, tag },
    sources: { app: { repo, source_commit: sourceCommit } },
  };
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      throw new Error('No GitHub read is allowed before Full self-identity validation.');
    },
  };
  assert.throws(
    () => fullAdjunctReleaseIdentity(bundle, []),
    /exactly one opl-release-manifest\.json upload action/,
  );
  assert.equal(calls, 0);
});

test('an exact published Full adjunct remains idempotent with complete discovery metadata', () => {
  const files = fixture([], 'append_full');
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  const adjunct = fullAdjunctReleaseIdentity(bundle, files.uploadActions);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) {
        return success(releaseResponse([], { immutable: true }));
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${adjunct.tag}`) {
        return success({
          ...releaseResponse(files.uploadActions, { immutable: true }),
          tag_name: adjunct.tag,
          name: adjunct.name,
          body: adjunct.notes,
        });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = applyPublishPlan({
    ...mutationAdmission('append_full', 'full'),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(result.adjunct.tag, adjunct.tag);
  assert.deepEqual(result.adjunct.manifest, adjunct.manifest);
  assert.deepEqual(result.adjunct.artifact, adjunct.artifact);
  assert.equal(result.adjunct.release_url, `https://github.com/${repo}/releases/tag/${adjunct.tag}`);
  assert.equal(
    result.adjunct.asset_download_base_url,
    `https://github.com/${repo}/releases/download/${adjunct.tag}`,
  );
  assert.equal(calls.every((args) => args[0] === 'api'), true);
});

test('github-apply publishes a Nightly Bundle as prerelease and never as Latest', () => {
  const files = fixture([]);
  const nightlyVersion = '26.7.22-nightly';
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  bundle.release = {
    channel: 'nightly',
    version: nightlyVersion,
    updater_version: '26.7.2290-nightly.0',
    tag: `v${nightlyVersion}`,
    prerelease: true,
  };
  fs.writeFileSync(files.bundlePath, `${JSON.stringify(bundle)}\n`);
  const calls: Array<{ args: string[]; stdin?: string }> = [];
  let tagReserved = false;
  let exists = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args, options) {
      calls.push({ args, stdin: options.input });
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/v${nightlyVersion}`) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success({
          id: 12345,
          tag_name: `v${nightlyVersion}`,
          name: `One Person Lab v${nightlyVersion}`,
          draft: !published,
          prerelease: true,
          target_commitish: sourceCommit,
          body: notes,
          immutable: published,
          assets: [],
        });
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/12345`) {
        return success({
          id: 12345,
          tag_name: `v${nightlyVersion}`,
          name: `One Person Lab v${nightlyVersion}`,
          draft: !published,
          prerelease: true,
          target_commitish: sourceCommit,
          body: notes,
          immutable: published,
          assets: [],
        });
      }
      if (isReleaseViewFor(args, `v${nightlyVersion}`, repo)) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefReadFor(args, `v${nightlyVersion}`, repo)) {
        return tagReserved
          ? tagRefResponse(`v${nightlyVersion}`)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(`v${nightlyVersion}`);
      }
      if (args[3] === `repos/${repo}/releases`) {
        exists = true;
        return success({
          id: 12345,
          tag_name: `v${nightlyVersion}`,
          name: `One Person Lab v${nightlyVersion}`,
          draft: true,
          prerelease: true,
          target_commitish: sourceCommit,
          body: notes,
          immutable: false,
          assets: [],
        });
      }
      if (args.includes('PATCH')) {
        published = true;
        return success();
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
    'publication-channel': 'nightly',
  }, runtime);
  assert.equal(result.status, 'complete');
  const create = calls.find(({ args }) => args[3] === `repos/${repo}/releases`);
  assert.ok(create?.stdin);
  const payload = JSON.parse(create.stdin);
  assert.equal(payload.prerelease, true);
  assert.equal(payload.draft, true);
  assert.equal(payload.make_latest, 'false');
});

test('github-apply publishes a qualified Preview as a non-prerelease without implicitly changing Latest', () => {
  const files = previewFixture();
  const calls: Array<{ args: string[]; stdin?: string }> = [];
  let tagReserved = false;
  let exists = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args, options) {
      calls.push({ args, stdin: options.input });
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${files.previewTag}`) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success({
          id: 12345,
          tag_name: files.previewTag,
          name: `One Person Lab v${files.previewVersion}`,
          draft: !published,
          prerelease: false,
          target_commitish: sourceCommit,
          body: notes,
          immutable: published,
          assets: [],
        });
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/12345`) {
        return success({
          id: 12345,
          tag_name: files.previewTag,
          name: `One Person Lab v${files.previewVersion}`,
          draft: !published,
          prerelease: false,
          target_commitish: sourceCommit,
          body: notes,
          immutable: published,
          assets: [],
        });
      }
      if (isReleaseViewFor(args, files.previewTag, repo)) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefReadFor(args, files.previewTag, repo)) {
        return tagReserved
          ? tagRefResponse(files.previewTag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(files.previewTag);
      }
      if (args[3] === `repos/${repo}/releases`) {
        exists = true;
        return success({
          id: 12345,
          tag_name: files.previewTag,
          name: `One Person Lab v${files.previewVersion}`,
          draft: true,
          prerelease: false,
          target_commitish: sourceCommit,
          body: notes,
          immutable: false,
          assets: [],
        });
      }
      if (args.includes('PATCH')) {
        published = true;
        return success();
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
    'publication-channel': 'preview',
  }, runtime);
  assert.equal(result.status, 'complete');
  const create = calls.find(({ args }) => args[3] === `repos/${repo}/releases`);
  assert.ok(create?.stdin);
  const payload = JSON.parse(create.stdin);
  assert.equal(payload.prerelease, false);
  assert.equal(payload.draft, true);
  assert.equal(payload.make_latest, 'false');
});

test('release inspection treats an absent immutable field as false, never true', () => {
  const response = releaseResponse([]);
  delete response.immutable;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      assert.equal(isReleaseInspect(args), true);
      return success(response);
    },
  };
  assert.equal(inspectRelease(repo, tag, runtime).release.immutable, false);
});

test('canonical Stable publication fails closed without bound capability evidence and never calls the admin API', () => {
  const files = fixture([asset('first.zip', '1')]);
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  bundle.sources.app.repo = canonicalRepo;
  fs.writeFileSync(files.bundlePath, `${JSON.stringify(bundle)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    (error: any) => {
      assert.equal(error.result.status, 'failed');
      assert.equal(error.result.failure.failure_taxonomy, 'github_immutable_releases_evidence_invalid');
      return true;
    },
  );
  assert.equal(calls, 2, 'only bounded tag and draft discovery reads are allowed before evidence rejection');
});

test('canonical Stable publication consumes the exact durable record and never calls immutable-releases at runtime', () => {
  const first = asset('first.zip', '2');
  const files = fixture([first]);
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  bundle.sources.app.repo = canonicalRepo;
  fs.writeFileSync(files.bundlePath, `${JSON.stringify(bundle)}\n`);
  const durable = durablePublicationRecord(files.root, [first]);
  assert.notEqual(durable.operationId, standardOperationId);
  const additionalPath = path.join(files.root, 'additional-upload-actions.json');
  fs.writeFileSync(additionalPath, `${JSON.stringify({
    schema: 'opl_app_immutable_release_upload_actions.v1',
    upload_actions: [durable.recordAction],
  })}\n`);

  const calls: string[][] = [];
  const remoteAssets: Asset[] = [];
  let tagReserved = false;
  let exists = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (args[0] === 'api' && args[1] === `repos/${canonicalRepo}/immutable-releases`) {
        throw new Error('The Actions runtime must not read the admin-only immutable Releases endpoint.');
      }
      if (args[0] === 'api' && args[1] === `repos/${canonicalRepo}/releases/tags/${tag}`) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success(releaseResponse(remoteAssets, {
          draft: !published,
          immutable: published,
        }));
      }
      if (args[0] === 'api' && args[1] === `repos/${canonicalRepo}/releases/12345`) {
        return success(releaseResponse(remoteAssets, {
          draft: !published,
          immutable: published,
        }));
      }
      if (isReleaseViewFor(args, tag, canonicalRepo)) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefReadFor(args, tag, canonicalRepo)) {
        return tagReserved
          ? tagRefResponse(tag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, canonicalRepo)) {
        tagReserved = true;
        return tagRefResponse(tag);
      }
      if (args[3] === `repos/${canonicalRepo}/releases`) {
        exists = true;
        return success(releaseResponse([], { draft: true, immutable: false }));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        const uploaded = [first, durable.recordAction].find(
          (candidate) => candidate.source_path === args[3],
        );
        assert.ok(uploaded);
        remoteAssets.push({
          name: uploaded.name,
          source_path: uploaded.source_path,
          size_bytes: uploaded.size_bytes,
          sha256: uploaded.sha256,
        });
        return success();
      }
      if (args.includes('PATCH')) {
        published = true;
        return success();
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      'authority-run-id': '30325431855',
      bundle: files.bundlePath,
      plan: files.planPath,
      'additional-upload-actions': additionalPath,
      'publication-record': durable.recordPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    (error: any) => {
      assert.equal(
        error.result.failure.validation_error,
        'Publication record authority run does not match the admitted Stable source run.',
      );
      return true;
    },
  );
  assert.equal(exists, false);
  assert.deepEqual(remoteAssets, []);

  const result = applyPublishPlan({
    ...mutationAdmission(),
    'authority-run-id': stableAuthorityRunId,
    bundle: files.bundlePath,
    plan: files.planPath,
    'additional-upload-actions': additionalPath,
    'publication-record': durable.recordPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'complete');
  assert.deepEqual(result.uploaded, [first.name, durable.recordAction.name]);
  assert.equal(
    calls.some((args) => args[0] === 'api' && args[1] === `repos/${canonicalRepo}/immutable-releases`),
    false,
  );
  assert.equal(result.inspection.release.immutable, true);
});

test('immutable capability disabled fails closed before every public mutation', () => {
  const files = fixture([asset('first.zip', '1')]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse(false);
      throw new Error(`Unexpected GitHub call after disabled capability: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    (error: any) => {
      assert.equal(error.result.status, 'failed');
      assert.equal(error.result.failure.failure_taxonomy, 'github_immutable_releases_disabled');
      return true;
    },
  );
  assert.equal(calls.filter((args) => args.includes('POST')).length, 0);
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
});

test('an exact immutable published carrier remains a read-only idempotent reconcile when capability is disabled', () => {
  const first = asset('first.zip', '2');
  const files = fixture([first]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) {
        return success(releaseResponse([first], { draft: false, immutable: true }));
      }
      throw new Error(`Unexpected GitHub mutation or capability read: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.uploaded, []);
  assert.equal(calls.every(isReleaseInspect), true);
});

test('unexpected remote assets fail before immutable publication', () => {
  const first = asset('first.zip', '2');
  const unexpected = asset('unexpected.bin', '3');
  const files = fixture([first]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) {
        return success(releaseResponse([unexpected], { draft: true, immutable: false }));
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /unexpected asset outside the exact planned set/i,
  );
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
});

test('duplicate planned asset names fail before capability read or public mutation', () => {
  const first = asset('first.zip', '4');
  const files = fixture([first]);
  const plan = JSON.parse(fs.readFileSync(files.planPath, 'utf8'));
  plan.release_bundle_publish.receipt.details.upload_actions.push({
    action: 'upload',
    name: first.name,
    source_path: first.source_path,
    size_bytes: first.size_bytes,
    sha256: first.sha256,
  });
  fs.writeFileSync(files.planPath, `${JSON.stringify(plan)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /duplicate or invalid asset names/i,
  );
  assert.equal(calls, 0);
});

test('supplemental immutable carrier receipt joins the exact draft asset set once', () => {
  const first = asset('desktop.zip', 'a');
  const durableReceipt = asset('opl-stable-operation-control.json', 'b');
  const files = fixture([first]);
  const additionalPath = path.join(files.root, 'additional-upload-actions.json');
  fs.writeFileSync(additionalPath, `${JSON.stringify({
    schema: 'opl_app_immutable_release_upload_actions.v1',
    upload_actions: [{ action: 'upload', ...durableReceipt }],
  })}\n`);
  const calls: string[][] = [];
  const remoteAssets: Asset[] = [];
  let tagReserved = false;
  let exists = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success(releaseResponse(remoteAssets, { draft: !published, immutable: published }));
      }
      if (isReleaseView(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isTagRefReadFor(args, tag, repo)) {
        return tagReserved
          ? tagRefResponse(tag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(tag);
      }
      if (args[3] === `repos/${repo}/releases`) {
        exists = true;
        return success(releaseResponse([], { draft: true, immutable: false }));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        const uploaded = [first, durableReceipt].find((asset) => asset.source_path === args[3]);
        assert.ok(uploaded, `unexpected upload ${args[3]}`);
        remoteAssets.push(uploaded);
        return success();
      }
      if (args.includes('PATCH')) {
        assert.deepEqual(remoteAssets.map((asset) => asset.name).sort(), [first.name, durableReceipt.name].sort());
        published = true;
        return success();
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
    'additional-upload-actions': additionalPath,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.uploaded, [first.name, durableReceipt.name]);
  const publishIndex = calls.findIndex((args) => args.includes('PATCH'));
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 2);
  assert.ok(publishIndex > calls.findIndex((args) => args[0] === 'release' && args[1] === 'upload'));
});

test('supplemental immutable carrier actions reject a duplicate main-plan asset before GitHub access', () => {
  const first = asset('desktop.zip', 'c');
  const files = fixture([first]);
  const additionalPath = path.join(files.root, 'duplicate-upload-actions.json');
  fs.writeFileSync(additionalPath, `${JSON.stringify({
    schema: 'opl_app_immutable_release_upload_actions.v1',
    upload_actions: [{ action: 'upload', ...first }],
  })}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
      'additional-upload-actions': additionalPath,
    }, runtime),
    /duplicate or invalid asset names/i,
  );
  assert.equal(calls, 0);
});

test('duplicate remote asset names fail before immutable publication', () => {
  const first = asset('first.zip', '5');
  const files = fixture([first]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) {
        return success(releaseResponse([first, first], { draft: true, immutable: false }));
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /duplicate asset name/i,
  );
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
});

test('an incomplete published immutable carrier is read-only and cannot receive late assets', () => {
  const first = asset('first.zip', '6');
  const files = fixture([first]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /asset set is incomplete/i,
  );
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
});

test('immutable=false after accepted draft publication returns typed terminal evidence', () => {
  const first = asset('first.zip', '7');
  const files = fixture([first]);
  const calls: string[][] = [];
  const remoteAssets: Asset[] = [];
  let tagReserved = false;
  let exists = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success(releaseResponse(remoteAssets, {
          draft: !published,
          immutable: false,
        }));
      }
      if (isReleaseView(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isTagRefReadFor(args, tag, repo)) {
        return tagReserved
          ? tagRefResponse(tag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(tag);
      }
      if (args[3] === `repos/${repo}/releases`) {
        exists = true;
        return success(releaseResponse([], { draft: true, immutable: false }));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        remoteAssets.push(first);
        return success();
      }
      if (args.includes('PATCH')) {
        published = true;
        return success();
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'failed');
  assert.equal(result.failure.failure_taxonomy, 'published_mutable_policy_violation');
  assert.equal(result.failure.mutation, 'release_publish');
  assert.equal(result.retry_disposition, 'read_only_reconcile_only_no_retry');
  assert.deepEqual(result.uploaded, [first.name]);
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 1);
});

test('explicit single-use authority may move Latest to Dev Preview without Stable latest_eligible', () => {
  const files = previewFixture();
  let latestTag = expectedCurrentLatestTag;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${files.previewTag}`) {
        return success({
          id: 12345,
          name: `One Person Lab v${files.previewVersion}`,
          draft: false,
          prerelease: false,
          target_commitish: sourceCommit,
          body: notes,
          immutable: true,
          assets: [{
            name: `One-Person-Lab-${files.previewVersion}-mac-arm64.zip`,
            size: 100,
            digest: `sha256:${'8'.repeat(64)}`,
          }],
        });
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: latestTag });
      }
      if (args.includes('PATCH')) {
        latestTag = files.previewTag;
        return success();
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = activateLatest({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
    'publication-channel': 'preview',
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(result.tag, files.previewTag);
  assert.equal(result.latest_compare_and_swap.patch_performed, true);
});

test('explicit single-use authority may move Latest to Nightly Preview without Stable latest_eligible', () => {
  const files = nightlyLatestFixture();
  let latestTag = expectedCurrentLatestTag;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${files.nightlyTag}`) {
        return success({
          id: 12345,
          name: `One Person Lab v${files.nightlyVersion}`,
          draft: false,
          prerelease: true,
          target_commitish: sourceCommit,
          body: notes,
          immutable: true,
          assets: [{
            name: `One-Person-Lab-${files.nightlyVersion}-mac-arm64.zip`,
            size: 100,
            digest: `sha256:${'7'.repeat(64)}`,
          }],
        });
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: latestTag });
      }
      if (args.includes('PATCH')) {
        latestTag = files.nightlyTag;
        return success();
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = activateLatest({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
    'publication-channel': 'nightly',
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(result.tag, files.nightlyTag);
  assert.equal(result.latest_compare_and_swap.patch_performed, true);
});

test('Preview publication rejects a Stable Bundle and every Full track before any GitHub call', () => {
  const stableFiles = fixture([]);
  const previewFull = previewFixture();
  const plan = JSON.parse(fs.readFileSync(previewFull.planPath, 'utf8'));
  plan.release_bundle_publish.track = 'full';
  plan.release_bundle_publish.receipt.release_operation = 'append_full';
  plan.release_bundle_publish.receipt.operation_control = {
    operation_id: appendFullOperationId,
    operation_started_at: appendFullOperationStartedAt,
    operation_deadline_at: deadlineAt,
  };
  fs.writeFileSync(previewFull.planPath, `${JSON.stringify(plan)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: stableFiles.bundlePath,
      plan: stableFiles.planPath,
      'operation-deadline-at': deadlineAt,
      'publication-channel': 'preview',
    }, runtime),
    (error: any) => error.result?.failure?.failure_taxonomy === 'github_mutation_publication_bundle_mismatch',
  );
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission('append_full', 'full'),
      bundle: previewFull.bundlePath,
      plan: previewFull.planPath,
      'operation-deadline-at': deadlineAt,
      'publication-channel': 'preview',
    }, runtime),
    (error: any) => error.result?.failure?.failure_taxonomy === 'github_mutation_non_stable_full_publication',
  );
  assert.equal(calls, 0);
});

test('Nightly publication rejects Stable Bundle and Full track before any GitHub call', () => {
  const stableFiles = fixture([]);
  const fullFiles = fixture([], 'append_full');
  const fullBundle = JSON.parse(fs.readFileSync(fullFiles.bundlePath, 'utf8'));
  fullBundle.release = {
    channel: 'nightly',
    version: '26.7.22-nightly',
    updater_version: '26.7.2290-nightly.0',
    tag: 'v26.7.22-nightly',
    prerelease: true,
  };
  fs.writeFileSync(fullFiles.bundlePath, `${JSON.stringify(fullBundle)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: stableFiles.bundlePath,
      plan: stableFiles.planPath,
      'operation-deadline-at': deadlineAt,
      'publication-channel': 'nightly',
    }, runtime),
    (error: any) => error.result?.failure?.failure_taxonomy === 'github_mutation_publication_bundle_mismatch',
  );
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission('append_full', 'full'),
      bundle: fullFiles.bundlePath,
      plan: fullFiles.planPath,
      'operation-deadline-at': deadlineAt,
      'publication-channel': 'nightly',
    }, runtime),
    (error: any) => error.result?.failure?.failure_taxonomy === 'github_mutation_non_stable_full_publication',
  );
  assert.equal(calls, 0);
});

test('raw Latest activation rejects append_full before gh', () => {
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest(mutationAdmission('append_full', 'full'), runtime),
    /rejects operation append_full for track full/,
  );
  assert.equal(calls, 0);
});

test('github-apply binds the caller track to the Framework publish plan before gh', () => {
  const files = fixture([]);
  const plan = JSON.parse(fs.readFileSync(files.planPath, 'utf8'));
  plan.release_bundle_publish.track = 'full';
  fs.writeFileSync(files.planPath, `${JSON.stringify(plan)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Framework publish plan track full does not match admitted standard/,
  );
  assert.equal(calls, 0);
});

test('raw mutation CLI persists typed failure evidence at the deterministic default path before exiting', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-github-admission-failure-'));
  try {
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types',
      path.join(process.cwd(), 'scripts/framework-release-adapter.ts'),
      'github-apply',
      '--operation', 'standard',
      '--track', 'standard',
      '--run-attempt', '2',
      '--additional-upload-actions', path.join(root, 'additional-upload-actions.json'),
    ], { encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: root } });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /Unknown option '--additional-upload-actions'/);
    const evidence = path.join(root, 'opl-release-mutation-failure/github-apply');
    const output = path.join(evidence, 'failure.json');
    const failure = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(failure.status, 'failed');
    assert.equal(failure.failure.schema, 'opl_release_mutation_failure_receipt.v1');
    assert.equal(failure.failure.failure_taxonomy, 'github_mutation_run_attempt_rejected');
    assert.match(failure.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(failure.failure.stdout, '');
    assert.match(failure.failure.stderr, /run-attempt 1/);
    assert.equal(fs.readFileSync(path.join(evidence, 'input-digest.txt'), 'utf8').trim(), failure.failure.input_digest);
    assert.equal(fs.readFileSync(path.join(evidence, 'stdout.txt'), 'utf8'), '');
    assert.match(fs.readFileSync(path.join(evidence, 'stderr.txt'), 'utf8'), /run-attempt 1/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
