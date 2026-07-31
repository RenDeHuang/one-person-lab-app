import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { stringify as stringifyYaml } from 'yaml';

import {
  ISSUE_122_APP_PROVENANCE_FLOOR,
  ISSUE_122_SHELL_PROVENANCE_FLOOR,
  digestCodexRuntimeArtifactEligibilityPacket,
  validateCodexRuntimeArtifactEligibility,
} from '../../scripts/codex-runtime-artifact-eligibility.ts';

const version = '26.7.31';
const updaterVersion = '26.7.3190';
const appSha = 'a'.repeat(40);
const shellSha = 'b'.repeat(40);
const frameworkSha = 'c'.repeat(40);
const stableSessionId = `sha256:${'e'.repeat(64)}`;
const repository = 'gaofeng21cn/one-person-lab-app';

type JsonRecord = Record<string, any>;
type FileRef = { path: string; sha256: string };
type Asset = {
  name: string;
  sizeBytes: number;
  digest: string;
  ref: FileRef;
  contentType: string;
};
type SourceRepository = 'app' | 'shell' | 'framework';
type FreshReadbacks = {
  releases: Map<string, JsonRecord>;
  runs: Map<string, JsonRecord>;
};

const freshReadbacksByRoot = new Map<string, FreshReadbacks>();

type FixtureOptions = {
  mutateBundleAfterDigest?: (bundle: JsonRecord) => void;
  mutateUpdaterMetadata?: (metadata: JsonRecord) => void;
  mutateComponentManifest?: (manifest: JsonRecord) => void;
  mutateStandardCheckpoint?: (checkpoint: JsonRecord) => void;
  mutateFullCheckpoint?: (checkpoint: JsonRecord) => void;
  mutateStandardReceipt?: (receipt: JsonRecord) => void;
  mutateAppendReceipt?: (receipt: JsonRecord) => void;
  mutateSuccessorReceipt?: (receipt: JsonRecord) => void;
  mutateStandardRunInspection?: (inspection: JsonRecord) => void;
  mutateAppendFullRunInspection?: (inspection: JsonRecord) => void;
  mutateStandardInspection?: (inspection: JsonRecord) => void;
  mutateFullInspection?: (inspection: JsonRecord) => void;
};

function sha256(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function sha512(value: string | Buffer): string {
  return crypto.createHash('sha512').update(value).digest('base64');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === 'object') {
    const source = value as JsonRecord;
    return Object.fromEntries(
      Object.keys(source).toSorted().map((key) => [key, canonicalize(source[key])]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function digestWithout(value: JsonRecord, field: string): string {
  const core = { ...value };
  delete core[field];
  return sha256(canonicalJson(core));
}

function redigest(value: JsonRecord, field: string): void {
  value[field] = digestWithout(value, field);
}

function writeFileRef(root: string, relativePath: string, value: string | Buffer): FileRef {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
  return { path: relativePath, sha256: sha256(value) };
}

function writeJsonRef(root: string, relativePath: string, value: unknown): FileRef {
  return writeFileRef(root, relativePath, `${JSON.stringify(value)}\n`);
}

function rewriteJsonRef(root: string, ref: FileRef, value: unknown): void {
  const bytes = `${JSON.stringify(value)}\n`;
  fs.writeFileSync(path.join(root, ref.path), bytes, 'utf8');
  ref.sha256 = sha256(bytes);
}

function fileSize(root: string, ref: FileRef): number {
  return fs.statSync(path.join(root, ref.path)).size;
}

function frozenCodexCliIdentity() {
  const codexVersion = '0.144.6';
  const integrity = `sha512-${'A'.repeat(86)}==`;
  return {
    package: '@openai/codex',
    version: codexVersion,
    npm_integrity: integrity,
    tarball_url: `https://registry.npmjs.org/@openai/codex/-/codex-${codexVersion}.tgz`,
    tarball_sha256: '1'.repeat(64),
    platform: {
      package: '@openai/codex',
      version: `${codexVersion}-darwin-arm64`,
      npm_integrity: integrity,
      tarball_url:
        `https://registry.npmjs.org/@openai/codex/-/codex-${codexVersion}-darwin-arm64.tgz`,
      tarball_sha256: '2'.repeat(64),
    },
  };
}

function temporalSupervisorProof() {
  const databasePath =
    '/Users/opl/Library/Application Support/OPL/state/family-runtime/temporal-server/temporal.sqlite';
  const plistPath =
    '/Users/opl/Library/LaunchAgents/ai.opl.family-runtime.temporal-service.plist';
  const managedStatus = (pid: number) => ({
    service_status: 'running',
    server_reachable: true,
    supervisor: {
      supported: true,
      applicable: true,
      required: true,
      installed: true,
      loaded: true,
      ready: true,
      configuration_current: true,
      process_state: 'running',
      pid,
      error: null,
    },
  });
  const readback = (pid: number) => ({
    service_ready: true,
    server_reachable: true,
    supervisor: {
      installed: true,
      loaded: true,
      ready: true,
      supported: true,
      applicable: true,
      required: true,
      configuration_current: true,
      run_at_load: true,
      keep_alive: true,
      schedule_independent: true,
      process_state: 'running',
      pid,
      error: null,
      observed_at: `2026-07-31T00:00:${String(pid).padStart(2, '0')}.000Z`,
      database_path: databasePath,
    },
  });
  return {
    schema: 'opl_temporal_service_supervisor_proof.v1',
    status: 'passed',
    runtime_profile: 'full',
    applicable: true,
    required: true,
    supervisor_label: 'ai.opl.family-runtime.temporal-service',
    start_action: {
      action_id: 'provider_service_start',
      dry_run: false,
      delegated_surface: 'opl family-runtime service start --provider temporal',
      result: {
        family_runtime_service: {
          action: 'start',
          start_status: 'started_supervised',
          status: managedStatus(11),
        },
      },
    },
    restart_action: {
      action_id: 'provider_service_restart',
      dry_run: false,
      delegated_surface: 'opl family-runtime service restart --provider temporal',
      result: {
        family_runtime_service: {
          action: 'restart',
          restart_status: 'restarted',
          applicable: true,
          ready: true,
          supervisor_pid_changed: true,
          previous_supervisor_pid: 12,
          supervisor_pid: 13,
          status: managedStatus(13),
        },
      },
    },
    plist: {
      path: plistPath,
      label: 'ai.opl.family-runtime.temporal-service',
      program_arguments: [
        '/runtime/bin/temporal',
        'server',
        'start-dev',
        '--db-filename',
        databasePath,
      ],
      run_at_load: true,
      keep_alive: true,
      database_path: databasePath,
    },
    initial_readback: readback(11),
    keep_alive_recovery: {
      termination: { pid: 11, signal: 'SIGTERM', status: 'sent' },
      readback: readback(12),
    },
    restart_readback: readback(13),
    session_reload: {
      bootout: {
        args: ['bootout', 'gui/501/ai.opl.family-runtime.temporal-service'],
        status: 0,
      },
      bootstrap: {
        args: ['bootstrap', 'gui/501', plistPath],
        status: 0,
      },
      readback: readback(14),
    },
    persistent_database: {
      path: databasePath,
      sqlite_header_valid: true,
      file_identity: '1:42',
      same_file_after_keep_alive_recovery: true,
      same_file_after_restart: true,
      same_file_after_session_reload: true,
    },
  };
}

function standardAssetNames(): string[] {
  return [
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One-Person-Lab-${version}-mac-arm64.zip`,
    `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
    `One-Person-Lab-${version}-linux-x64.deb`,
    'latest-arm64-mac.yml',
    'opl-app-component-manifest.json',
    'opl-install.sh',
    'opl-app-installer.sh',
    'standard-gatekeeper-launch-policy.json',
    'standard-apple-notarization-receipt.json',
  ];
}

function fullAssetNames(): string[] {
  return [
    `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
    'opl-release-manifest.json',
  ];
}

function addAsset(
  root: string,
  assets: Map<string, Asset>,
  name: string,
  value: string | Buffer,
  contentType = 'application/octet-stream',
): Asset {
  const ref = writeFileRef(root, `release-assets/${name}`, value);
  const asset = {
    name,
    sizeBytes: fileSize(root, ref),
    digest: ref.sha256,
    ref,
    contentType,
  };
  assets.set(name, asset);
  return asset;
}

function componentArtifact(asset: Asset) {
  const tag = `v${version}`;
  return {
    name: asset.name,
    ref: `https://github.com/${repository}/releases/download/${tag}/${asset.name}`,
    digest: asset.digest,
    size: asset.sizeBytes,
    content_type: asset.contentType,
  };
}

function buildCohort(input: {
  kind: 'standard' | 'full';
  runId: string;
  artifact: Asset;
  bundleDigest: string;
}) {
  return {
    schema: 'opl_app_build_artifact_cohort.v2',
    release: {
      stable_session_id: stableSessionId,
      release_cohort_ref: input.bundleDigest,
    },
    cohort: {
      app_sha: appSha,
      shell_sha: shellSha,
      framework_sha: frameworkSha,
    },
    build: { version, kind: input.kind },
    artifact: {
      name: input.artifact.name,
      sha256: input.artifact.digest.slice('sha256:'.length),
      size_bytes: input.artifact.sizeBytes,
    },
    actions: {
      run_id: input.runId,
      run_attempt: '1',
      artifact_name: `opl-${input.kind}-artifact-${input.runId}`,
    },
    digests: {
      packaged_tree_sha256: '3'.repeat(64),
      app_product_profile_sha256: '4'.repeat(64),
      gui_product_contract_sha256: '5'.repeat(64),
      smoke_harness_sha256: '6'.repeat(64),
      compiled_expectation_semantic_sha256: '7'.repeat(64),
      compiled_expectation_probe_sha256: '8'.repeat(64),
      qualification_input_manifest_sha256: '9'.repeat(64),
      ...(input.kind === 'full'
        ? {
            full_input_manifest_sha256: 'a'.repeat(64),
            full_package_manifest_sha256: 'b'.repeat(64),
            full_toolchain_observation_receipt_sha256: 'c'.repeat(64),
          }
        : {}),
    },
    qualification_runtime: { codex_cli: frozenCodexCliIdentity() },
  };
}

function qualificationReceipt(input: {
  kind: 'standard' | 'full';
  runId: string;
  build: ReturnType<typeof buildCohort>;
  buildRef: FileRef;
  bundleDigest: string;
}) {
  return {
    schema: 'opl_app_artifact_qualification_receipt.v1',
    status: 'passed',
    stable_session_id: stableSessionId,
    release_cohort_ref: input.bundleDigest,
    version,
    package_profile: input.kind,
    qualification: {
      run_id: `${input.runId}9`,
      source_artifact_run_id: input.runId,
      source_artifact_name: input.build.actions.artifact_name,
      evidence_ref: `github-actions:${input.runId}`,
      result: 'passed',
    },
    artifact: input.build.artifact,
    cohort: input.build.cohort,
    build_manifest: {
      schema: input.build.schema,
      sha256: input.buildRef.sha256.slice('sha256:'.length),
      smoke_harness_sha256: input.build.digests.smoke_harness_sha256,
      qualification_input_manifest_sha256:
        input.build.digests.qualification_input_manifest_sha256,
      full_input_manifest_sha256:
        input.build.digests.full_input_manifest_sha256 ?? null,
      full_package_manifest_sha256:
        input.build.digests.full_package_manifest_sha256 ?? null,
      full_toolchain_observation_receipt_sha256:
        input.build.digests.full_toolchain_observation_receipt_sha256 ?? null,
    },
    qualification_runtime: input.build.qualification_runtime,
    verification_harness: null,
    smoke_summary: {
      path: `smoke/${input.kind}.json`,
      sha256: 'f'.repeat(64),
      temporal_service_supervisor_proof:
        input.kind === 'full' ? temporalSupervisorProof() : null,
    },
  };
}

function frameworkBundle(): JsonRecord {
  const markdown = '# One Person Lab release';
  const evidence = { source: 'issue-122-fixture', reviewed: true };
  const bundle = {
    surface_kind: 'opl_release_bundle.v1',
    schema_ref: 'contracts/opl-framework/release-bundle.schema.json',
    bundle_digest: '',
    release: {
      channel: 'stable',
      version,
      display_version: version,
      updater_version: updaterVersion,
      tag: `v${version}`,
      prerelease: false,
    },
    sources: {
      app: { repo: repository, source_commit: appSha },
      shell: { repo: 'gaofeng21cn/opl-aion-shell', source_commit: shellSha },
      framework: { repo: 'gaofeng21cn/one-person-lab', source_commit: frameworkSha },
    },
    identity_mode: 'app_standard_compatibility',
    package_compatibility: {
      abi: 'opl_packages.v1',
      version_range: '>=1',
    },
    prepared_notes: {
      markdown,
      markdown_sha256: sha256(markdown),
      evidence,
      evidence_sha256: sha256(canonicalJson(evidence)),
    },
    tracks: {
      standard: {
        required_asset_names: standardAssetNames(),
        required_for_latest: true,
        additive_only: false,
        updater_metadata_allowed: true,
      },
      full: {
        required_asset_names: fullAssetNames(),
        required_for_latest: false,
        additive_only: true,
        updater_metadata_allowed: false,
      },
    },
    policy: {
      build_once: true,
      verify_and_promote_many: true,
      executor_neutral: true,
      allowed_executors: ['local', 'remote'],
      prepared_notes_required_before_build: true,
      publish_may_generate_notes: false,
      latest_required_track: 'standard',
      full_additive_only: true,
      full_updates_updater_metadata: false,
    },
  };
  redigest(bundle, 'bundle_digest');
  return bundle;
}

function operationControl(
  bundleDigest: string,
  operationKind: 'standard' | 'append_full',
): JsonRecord {
  const standard = operationKind === 'standard';
  const control = {
    surface_kind: 'opl_release_bundle_operation_control.v1',
    schema_ref: 'contracts/opl-framework/release-bundle-operation-control.schema.json',
    control_digest: '',
    bundle_digest: bundleDigest,
    operation_id: standard ? 'standard-operation-1001' : 'append-full-operation-1002',
    operation_kind: operationKind,
    track: standard ? 'standard' : 'full',
    operation_started_at: standard
      ? '2026-07-31T00:00:00.000Z'
      : '2026-07-31T00:40:00.000Z',
    operation_deadline_at: standard
      ? '2026-07-31T02:00:00.000Z'
      : '2026-07-31T02:40:00.000Z',
  };
  redigest(control, 'control_digest');
  return control;
}

function operationReceipt(
  bundleDigest: string,
  control: JsonRecord,
  operationKind: 'standard' | 'append_full',
): JsonRecord {
  const standard = operationKind === 'standard';
  return {
    surface_kind: 'opl_release_bundle_operation_receipt.v1',
    schema_ref: 'contracts/opl-framework/release-bundle-operation-receipt.schema.json',
    operation: 'operation_admit',
    status: 'complete',
    bundle_digest: bundleDigest,
    track: standard ? 'standard' : 'full',
    executor: null,
    attempt_id: control.operation_id,
    recorded_at: standard
      ? '2026-07-31T00:01:00.000Z'
      : '2026-07-31T00:41:00.000Z',
    release_operation: operationKind,
    operation_control: structuredClone(control),
    unknown_marker: null,
    details: {
      control_digest: control.control_digest,
      deadline_frozen_once: true,
      deadline_refresh_allowed: false,
      resume_of: null,
      append_full_independent_deadline: !standard,
    },
  };
}

function checkpointEntry(input: {
  entryPath: string;
  role: string;
  track: 'standard' | 'full' | null;
  assetName: string | null;
  sizeBytes: number;
  digest: string;
}) {
  return {
    path: input.entryPath,
    role: input.role,
    track: input.track,
    asset_name: input.assetName,
    size_bytes: input.sizeBytes,
    sha256: input.digest,
  };
}

function assetManifestBytes(
  track: 'standard' | 'full',
  assets: Map<string, Asset>,
): Buffer {
  return Buffer.from(`${JSON.stringify({
    surface_kind: 'opl_release_bundle_staged_assets.v1',
    bundle_digest: currentBundleDigest(assets),
    track,
    assets: [...assets.values()]
      .map((asset) => ({
        name: asset.name,
        size_bytes: asset.sizeBytes,
        sha256: asset.digest,
      }))
      .toSorted((left, right) => left.name.localeCompare(right.name)),
  }, null, 2)}\n`);
}

const assetBundleDigests = new WeakMap<Map<string, Asset>, string>();

function currentBundleDigest(assets: Map<string, Asset>): string {
  const value = assetBundleDigests.get(assets);
  assert.ok(value);
  return value;
}

function createCheckpoint(input: {
  final: boolean;
  standardVerified: boolean;
  bundleDigest: string;
  bundleRef: FileRef;
  bundleSize: number;
  notes: string;
  standardControl: JsonRecord;
  appendControl: JsonRecord;
  standardAssets: Map<string, Asset>;
  fullAssets: Map<string, Asset>;
  standardQualificationRef: FileRef;
  standardQualificationSize: number;
  fullQualificationRef: FileRef;
  fullQualificationSize: number;
}): JsonRecord {
  assetBundleDigests.set(input.standardAssets, input.bundleDigest);
  assetBundleDigests.set(input.fullAssets, input.bundleDigest);
  const standardManifestBytes = assetManifestBytes('standard', input.standardAssets);
  const fullManifestBytes = assetManifestBytes('full', input.fullAssets);
  const standardEntries = [
    checkpointEntry({
      entryPath: 'bundle.json',
      role: 'bundle',
      track: null,
      assetName: null,
      sizeBytes: input.bundleSize,
      digest: input.bundleRef.sha256,
    }),
    checkpointEntry({
      entryPath: 'notes.md',
      role: 'prepared_notes',
      track: null,
      assetName: null,
      sizeBytes: Buffer.byteLength(input.notes),
      digest: sha256(input.notes),
    }),
    checkpointEntry({
      entryPath: 'tracks/standard/assets.json',
      role: 'track_asset_manifest',
      track: 'standard',
      assetName: null,
      sizeBytes: standardManifestBytes.byteLength,
      digest: sha256(standardManifestBytes),
    }),
    ...[...input.standardAssets.values()]
      .toSorted((left, right) => left.name.localeCompare(right.name))
      .map((asset) => checkpointEntry({
        entryPath: `tracks/standard/assets/${asset.name}`,
        role: 'track_asset',
        track: 'standard',
        assetName: asset.name,
        sizeBytes: asset.sizeBytes,
        digest: asset.digest,
      })),
    ...(
      input.standardVerified
        ? [
            checkpointEntry({
              entryPath: 'tracks/standard/qualification.json',
              role: 'qualification_receipt',
              track: 'standard',
              assetName: null,
              sizeBytes: input.standardQualificationSize,
              digest: input.standardQualificationRef.sha256,
            }),
          ]
        : []
    ),
  ];
  const fullEntries = [
    checkpointEntry({
      entryPath: 'tracks/full/assets.json',
      role: 'track_asset_manifest',
      track: 'full',
      assetName: null,
      sizeBytes: fullManifestBytes.byteLength,
      digest: sha256(fullManifestBytes),
    }),
    ...[...input.fullAssets.values()]
      .toSorted((left, right) => left.name.localeCompare(right.name))
      .map((asset) => checkpointEntry({
        entryPath: `tracks/full/assets/${asset.name}`,
        role: 'track_asset',
        track: 'full',
        assetName: asset.name,
        sizeBytes: asset.sizeBytes,
        digest: asset.digest,
      })),
    checkpointEntry({
      entryPath: 'tracks/full/qualification.json',
      role: 'qualification_receipt',
      track: 'full',
      assetName: null,
      sizeBytes: input.fullQualificationSize,
      digest: input.fullQualificationRef.sha256,
    }),
  ];
  const checkpoint = {
    surface_kind: 'opl_release_bundle_checkpoint.v1',
    schema_ref: 'contracts/opl-framework/release-bundle-checkpoint.schema.json',
    checkpoint_digest: '',
    bundle_digest: input.bundleDigest,
    checkpoint_stage: input.final
      ? 'full_qualified'
      : input.standardVerified
        ? 'standard_qualified'
        : 'standard_built',
    operation_controls: {
      standard: structuredClone(input.standardControl),
      append_full: input.final ? structuredClone(input.appendControl) : null,
    },
    active_unknown_markers: [],
    tracks: {
      standard: {
        built: true,
        verified: input.standardVerified,
        asset_names: standardAssetNames().toSorted(),
        asset_manifest_path: 'tracks/standard/assets.json',
        asset_manifest_sha256: sha256(standardManifestBytes),
        qualification_receipt_path: input.standardVerified
          ? 'tracks/standard/qualification.json'
          : null,
        qualification_receipt_sha256: input.standardVerified
          ? input.standardQualificationRef.sha256
          : null,
      },
      full: input.final
        ? {
            built: true,
            verified: true,
            asset_names: fullAssetNames().toSorted(),
            asset_manifest_path: 'tracks/full/assets.json',
            asset_manifest_sha256: sha256(fullManifestBytes),
            qualification_receipt_path: 'tracks/full/qualification.json',
            qualification_receipt_sha256: input.fullQualificationRef.sha256,
          }
        : {
            built: false,
            verified: false,
            asset_names: [],
            asset_manifest_path: null,
            asset_manifest_sha256: null,
            qualification_receipt_path: null,
            qualification_receipt_sha256: null,
          },
    },
    entries: input.final ? [...standardEntries, ...fullEntries] : standardEntries,
    policy: {
      portable_between_executors: true,
      import_never_rebuilds: true,
      publish_state_requires_fresh_remote_readback: true,
    },
  };
  redigest(checkpoint, 'checkpoint_digest');
  return checkpoint;
}

function releaseInspection(
  tag: string,
  id: number,
  assets: Map<string, Asset>,
): JsonRecord {
  return {
    surface_kind: 'opl_app_github_release_inspection.v1',
    repository,
    tag,
    release: {
      exists: true,
      id,
      name: `One Person Lab ${tag}`,
      draft: false,
      prerelease: false,
      target_commitish: appSha,
      body_sha256: sha256(`release body ${tag}\n`),
      immutable: true,
    },
    assets: [...assets.values()]
      .map((asset) => ({
        name: asset.name,
        size_bytes: asset.sizeBytes,
        sha256: asset.digest,
      }))
      .toSorted((left, right) => left.name.localeCompare(right.name)),
  };
}

function workflowRunInspection(
  runId: number,
  kind: 'standard' | 'append_full',
  headSha = appSha,
): JsonRecord {
  return {
    surface_kind: 'opl_app_github_actions_run_inspection.v1',
    repository,
    run: {
      id: runId,
      repository,
      head_repository: repository,
      path: '.github/workflows/release-stable.yml',
      event: 'workflow_dispatch',
      head_branch: 'main',
      head_sha: headSha,
      run_attempt: 1,
      status: 'completed',
      conclusion: 'success',
      display_title: kind === 'standard'
        ? `OPL Stable standard operation:standard-operation-1001 authority:authority-1001 run:${runId}`
        : `OPL Stable append_full source:1001 run:${runId}`,
    },
  };
}

function stableFullSuccessorReceipt(appendFullHeadSha: string): JsonRecord {
  return {
    schema: 'opl_app_stable_full_successor_receipt.v1',
    operation: 'append_full',
    source: {
      run_id: '1001',
      artifact: 'opl-release-standard-checkpoint-1001',
    },
    cohort: {
      app_sha: appSha,
      shell_sha: shellSha,
      framework_sha: frameworkSha,
    },
    release: { version },
    admission: {
      eligible: true,
      reason_code: 'admitted',
      existing_run_id: null,
    },
    dispatch: {
      status: 'dispatched',
      run_id: '1002',
      executor_run_head_sha: appendFullHeadSha,
      run_attempt: 1,
      conclusion: null,
    },
    mutation_scope: {
      standard_assets_modified: false,
      latest_modified: false,
      homebrew_modified: false,
      certification_blocking: false,
    },
  };
}

function writeEligibilityFixture(root: string, options: FixtureOptions = {}) {
  const standardAssets = new Map<string, Asset>();
  const fullAssets = new Map<string, Asset>();
  const standardDmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const standardZipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const standardDmg = addAsset(
    root,
    standardAssets,
    standardDmgName,
    'exact Standard DMG bytes\n',
    'application/x-apple-diskimage',
  );
  const standardZip = addAsset(
    root,
    standardAssets,
    standardZipName,
    'exact Standard updater ZIP bytes\n',
    'application/zip',
  );
  addAsset(
    root,
    standardAssets,
    `${standardZipName}.blockmap`,
    'exact updater blockmap bytes\n',
  );
  addAsset(
    root,
    standardAssets,
    `One-Person-Lab-${version}-linux-x64.deb`,
    'exact Linux DEB bytes\n',
    'application/vnd.debian.binary-package',
  );
  addAsset(root, standardAssets, 'opl-install.sh', '#!/bin/sh\nexit 0\n', 'text/x-shellscript');
  addAsset(
    root,
    standardAssets,
    'opl-app-installer.sh',
    '#!/bin/sh\nexit 0\n',
    'text/x-shellscript',
  );
  addAsset(
    root,
    standardAssets,
    'standard-gatekeeper-launch-policy.json',
    '{"status":"passed"}\n',
    'application/json',
  );
  addAsset(
    root,
    standardAssets,
    'standard-apple-notarization-receipt.json',
    '{"status":"passed"}\n',
    'application/json',
  );
  const updaterMetadata = {
    version: updaterVersion,
    files: [
      {
        url: standardZipName,
        sha512: sha512(fs.readFileSync(path.join(root, standardZip.ref.path))),
        size: standardZip.sizeBytes,
      },
      {
        url: standardDmgName,
        sha512: sha512(fs.readFileSync(path.join(root, standardDmg.ref.path))),
        size: standardDmg.sizeBytes,
      },
    ],
    path: standardZipName,
    sha512: sha512(fs.readFileSync(path.join(root, standardZip.ref.path))),
  };
  options.mutateUpdaterMetadata?.(updaterMetadata);
  addAsset(
    root,
    standardAssets,
    'latest-arm64-mac.yml',
    stringifyYaml(updaterMetadata),
    'text/yaml',
  );

  const componentArtifacts = [...standardAssets.values()]
    .map(componentArtifact)
    .toSorted((left, right) => left.name.localeCompare(right.name));
  const componentCore: JsonRecord = {
    surface_kind: 'opl_app_component_manifest.v1',
    component_id: 'opl-app',
    version,
    release_version: version,
    updater_version: updaterVersion,
    release_tag: `v${version}`,
    quality_status: 'stable',
    build_trigger: 'manual',
    preview_kind: null,
    distribution_pointer_policy: {
      pointer: 'latest',
      automatic_writer: 'qualified_stable_default',
      explicit_override: 'protected_single_use_exact_version',
      quality_unchanged: true,
      stable_reclaim: 'next_qualified_stable',
    },
    qualification_disclosure: {
      stable_qualified: true,
      passed_gates: ['standard_vm'],
      skipped_gates: [],
      failed_gates: [],
      non_stable_notice: false,
    },
    source_commit: appSha,
    source_cohort: {
      app_sha: appSha,
      shell_sha: shellSha,
      framework_sha: frameworkSha,
    },
    release_url: `https://github.com/${repository}/releases/tag/v${version}`,
    component_manifest_ref:
      `https://github.com/${repository}/releases/download/v${version}/opl-app-component-manifest.json`,
    artifacts: componentArtifacts,
    primary_artifact: structuredClone(
      componentArtifacts.find((artifact) => artifact.name === standardDmgName),
    ),
  };
  options.mutateComponentManifest?.(componentCore);
  const componentManifest = {
    ...componentCore,
    component_manifest_digest: sha256(JSON.stringify(componentCore)),
  };
  addAsset(
    root,
    standardAssets,
    'opl-app-component-manifest.json',
    `${JSON.stringify(componentManifest)}\n`,
    'application/json',
  );

  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const fullDmg = addAsset(
    root,
    fullAssets,
    fullDmgName,
    'exact Full DMG bytes\n',
    'application/x-apple-diskimage',
  );
  const fullManifest = {
    schema: 'opl_public_release_manifest.v1',
    package_kind: 'opl_full_first_install_macos_arm64',
    owner_authority: 'one-person-lab-app',
    version,
    release_version: version,
    primary_install_asset: fullDmgName,
    assets: [
      {
        name: fullDmgName,
        role: 'full_first_install_carrier',
        size_bytes: fullDmg.sizeBytes,
        sha256: fullDmg.digest,
      },
    ],
  };
  const fullManifestAsset = addAsset(
    root,
    fullAssets,
    'opl-release-manifest.json',
    `${JSON.stringify(fullManifest)}\n`,
    'application/json',
  );

  const bundle = frameworkBundle();
  const bundleDigest = bundle.bundle_digest as string;
  options.mutateBundleAfterDigest?.(bundle);
  const frameworkBundleRef = writeJsonRef(root, 'framework/bundle.json', bundle);
  const notes = bundle.prepared_notes.markdown as string;

  const standardBuild = buildCohort({
    kind: 'standard',
    runId: '1001',
    artifact: standardDmg,
    bundleDigest,
  });
  const fullBuild = buildCohort({
    kind: 'full',
    runId: '1002',
    artifact: fullDmg,
    bundleDigest,
  });
  const standardBuildRef = writeJsonRef(root, 'cohorts/standard.json', standardBuild);
  const fullBuildRef = writeJsonRef(root, 'cohorts/full.json', fullBuild);
  const standardQualification = qualificationReceipt({
    kind: 'standard',
    runId: '1001',
    build: standardBuild,
    buildRef: standardBuildRef,
    bundleDigest,
  });
  const fullQualification = qualificationReceipt({
    kind: 'full',
    runId: '1002',
    build: fullBuild,
    buildRef: fullBuildRef,
    bundleDigest,
  });
  const standardQualificationRef = writeJsonRef(
    root,
    'qualification/standard.json',
    standardQualification,
  );
  const fullQualificationRef = writeJsonRef(
    root,
    'qualification/full.json',
    fullQualification,
  );

  const standardControl = operationControl(bundleDigest, 'standard');
  const appendControl = operationControl(bundleDigest, 'append_full');
  const checkpointInput = {
    standardVerified: false,
    bundleDigest,
    bundleRef: frameworkBundleRef,
    bundleSize: fileSize(root, frameworkBundleRef),
    notes,
    standardControl,
    appendControl,
    standardAssets,
    fullAssets,
    standardQualificationRef,
    standardQualificationSize: fileSize(root, standardQualificationRef),
    fullQualificationRef,
    fullQualificationSize: fileSize(root, fullQualificationRef),
  };
  const standardCheckpoint = createCheckpoint({ ...checkpointInput, final: false });
  options.mutateStandardCheckpoint?.(standardCheckpoint);
  redigest(standardCheckpoint, 'checkpoint_digest');
  const fullCheckpoint = createCheckpoint({ ...checkpointInput, final: true });
  options.mutateFullCheckpoint?.(fullCheckpoint);
  redigest(fullCheckpoint, 'checkpoint_digest');
  const standardCheckpointRef = writeJsonRef(
    root,
    'checkpoints/standard.json',
    standardCheckpoint,
  );
  const fullCheckpointRef = writeJsonRef(root, 'checkpoints/full.json', fullCheckpoint);

  const standardReceipt = operationReceipt(
    bundleDigest,
    standardCheckpoint.operation_controls.standard,
    'standard',
  );
  options.mutateStandardReceipt?.(standardReceipt);
  const appendReceipt = operationReceipt(
    bundleDigest,
    fullCheckpoint.operation_controls.append_full,
    'append_full',
  );
  options.mutateAppendReceipt?.(appendReceipt);
  const standardReceiptRef = writeJsonRef(
    root,
    'operations/standard-admit.json',
    standardReceipt,
  );
  const appendReceiptRef = writeJsonRef(
    root,
    'operations/append-full-admit.json',
    appendReceipt,
  );
  const standardRunInspection = workflowRunInspection(1001, 'standard');
  const freshStandardRunInspection = structuredClone(standardRunInspection);
  options.mutateStandardRunInspection?.(standardRunInspection);
  const standardRunInspectionRef = writeJsonRef(
    root,
    'runs/standard.json',
    standardRunInspection,
  );
  const appendFullRunInspection = workflowRunInspection(
    1002,
    'append_full',
    'd'.repeat(40),
  );
  const freshAppendFullRunInspection = structuredClone(appendFullRunInspection);
  options.mutateAppendFullRunInspection?.(appendFullRunInspection);
  const appendFullRunInspectionRef = writeJsonRef(
    root,
    'runs/append-full.json',
    appendFullRunInspection,
  );
  const successorReceipt = stableFullSuccessorReceipt(
    freshAppendFullRunInspection.run.head_sha,
  );
  options.mutateSuccessorReceipt?.(successorReceipt);
  const successorReceiptRef = writeJsonRef(
    root,
    'operations/stable-full-successor-receipt.json',
    successorReceipt,
  );

  const fullTag =
    `v${version}-full-${fullManifestAsset.digest.slice('sha256:'.length, 'sha256:'.length + 12)}`;
  const standardInspection = releaseInspection(`v${version}`, 101, standardAssets);
  const freshStandardInspection = structuredClone(standardInspection);
  options.mutateStandardInspection?.(standardInspection);
  const fullInspection = releaseInspection(fullTag, 102, fullAssets);
  const freshFullInspection = structuredClone(fullInspection);
  options.mutateFullInspection?.(fullInspection);
  const standardInspectionRef = writeJsonRef(
    root,
    'releases/standard/release-inspection.json',
    standardInspection,
  );
  const fullInspectionRef = writeJsonRef(
    root,
    'releases/full/release-inspection.json',
    fullInspection,
  );

  const packet = {
    schema: 'opl_codex_runtime_artifact_eligibility.v1',
    status: 'candidate',
    purpose: 'issue_122_runtime_identity_evidence',
    authority: {
      source_pins_role: 'build_provenance_only',
      may_gate_install_or_runtime: false,
      exact_cross_component_compatibility_gate: false,
    },
    pair: {
      version,
      bundle_digest: bundleDigest,
      release_cohort_ref: bundleDigest,
      source: {
        app_sha: appSha,
        shell_sha: shellSha,
        framework_sha: frameworkSha,
      },
    },
    evidence: {
      framework_bundle: frameworkBundleRef,
      standard_checkpoint: standardCheckpointRef,
      full_checkpoint: fullCheckpointRef,
      standard_operation_receipt: standardReceiptRef,
      append_full_operation_receipt: appendReceiptRef,
      stable_full_successor_receipt: successorReceiptRef,
      standard_run_inspection: standardRunInspectionRef,
      append_full_run_inspection: appendFullRunInspectionRef,
    },
    standard: {
      primary_asset_name: standardDmgName,
      updater_asset_name: standardZipName,
      updater_metadata_asset_name: 'latest-arm64-mac.yml',
      manifest_asset_name: 'opl-app-component-manifest.json',
      files: {
        primary_artifact: standardDmg.ref,
        updater_artifact: standardZip.ref,
        updater_blockmap: standardAssets.get(`${standardZipName}.blockmap`)!.ref,
        updater_metadata: standardAssets.get('latest-arm64-mac.yml')!.ref,
        release_manifest: standardAssets.get('opl-app-component-manifest.json')!.ref,
        release_inspection: standardInspectionRef,
        build_cohort: standardBuildRef,
        qualification_receipt: standardQualificationRef,
      },
    },
    full: {
      primary_asset_name: fullDmgName,
      manifest_asset_name: 'opl-release-manifest.json',
      files: {
        primary_artifact: fullDmg.ref,
        release_manifest: fullManifestAsset.ref,
        release_inspection: fullInspectionRef,
        build_cohort: fullBuildRef,
        qualification_receipt: fullQualificationRef,
      },
    },
    created_at: '2026-07-31T01:30:00.000Z',
  };
  const packetPath = path.join(root, 'artifact-eligibility.json');
  fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  return {
    packet,
    packetPath,
    bundle,
    standardCheckpoint,
    fullCheckpoint,
    freshReadbacks: {
      releases: new Map([
        [`v${version}`, freshStandardInspection],
        [fullTag, freshFullInspection],
      ]),
      runs: new Map([
        ['1001', freshStandardRunInspection],
        ['1002', freshAppendFullRunInspection],
      ]),
    },
  };
}

function withFixture(
  callback: (fixture: ReturnType<typeof writeEligibilityFixture>, root: string) => void,
  options: FixtureOptions = {},
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-artifact-eligibility-'));
  try {
    const fixture = writeEligibilityFixture(root, options);
    freshReadbacksByRoot.set(root, fixture.freshReadbacks);
    callback(fixture, root);
  } finally {
    freshReadbacksByRoot.delete(root);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function checks(input: {
  ancestryCalls?: Array<[SourceRepository, string, string]>;
  remoteCalls?: Array<[SourceRepository, string]>;
  rejectAncestor?: SourceRepository;
  rejectRemote?: SourceRepository;
} = {}) {
  return {
    isAncestor(repositoryName: SourceRepository, floor: string, candidate: string) {
      input.ancestryCalls?.push([repositoryName, floor, candidate]);
      return repositoryName !== input.rejectAncestor;
    },
    isRemoteMainReachable(repositoryName: SourceRepository, candidate: string) {
      input.remoteCalls?.push([repositoryName, candidate]);
      return repositoryName !== input.rejectRemote;
    },
  };
}

function validate(packet: unknown, root: string, check = checks()) {
  const fresh = freshReadbacksByRoot.get(root);
  assert.ok(fresh);
  return validateCodexRuntimeArtifactEligibility(packet, {
    evidenceRoot: root,
    isAncestor: check.isAncestor,
    isRemoteMainReachable: check.isRemoteMainReachable,
    inspectRelease(tag) {
      const inspection = fresh.releases.get(tag);
      assert.ok(inspection);
      return structuredClone(inspection);
    },
    inspectWorkflowRun(runId) {
      const inspection = fresh.runs.get(runId);
      assert.ok(inspection);
      return structuredClone(inspection);
    },
  });
}

test('validator accepts one canonical Standard checkpoint plus distinct append_full successor', () => {
  withFixture(({ packet }, root) => {
    const ancestryCalls: Array<[SourceRepository, string, string]> = [];
    const remoteCalls: Array<[SourceRepository, string]> = [];
    const result = validate(packet, root, checks({ ancestryCalls, remoteCalls }));
    assert.equal(result.status, 'passed');
    assert.equal(result.release_cohort_ref, packet.pair.bundle_digest);
    assert.equal(result.operations.serialized_checkpoint_link_verified, true);
    assert.equal(result.operations.standard_operation_id, 'standard-operation-1001');
    assert.equal(result.operations.append_full_operation_id, 'append-full-operation-1002');
    assert.equal(result.operations.standard_run_id, '1001');
    assert.equal(result.operations.append_full_run_id, '1002');
    assert.equal(result.artifacts.standard.name, `One-Person-Lab-${version}-mac-arm64.zip`);
    assert.equal(result.verified_file_count, 18);
    assert.equal(result.authority.source_pins_role, 'build_provenance_only');
    assert.equal(result.authority.may_gate_install_or_runtime, false);
    assert.equal(result.authority.exact_cross_component_compatibility_gate, false);
    assert.equal(
      result.eligibility_digest,
      digestCodexRuntimeArtifactEligibilityPacket(packet),
    );
    assert.deepEqual(ancestryCalls, [
      ['app', ISSUE_122_APP_PROVENANCE_FLOOR, appSha],
      ['shell', ISSUE_122_SHELL_PROVENANCE_FLOOR, shellSha],
    ]);
    assert.deepEqual(remoteCalls, [
      ['app', appSha],
      ['shell', shellSha],
      ['framework', frameworkSha],
    ]);
  });
});

test('validator rejects Bundle digest drift and source pins outside accepted remote-main history', () => {
  withFixture(
    ({ packet }, root) => {
      assert.throws(() => validate(packet, root), /Framework Bundle canonical digest/);
    },
    {
      mutateBundleAfterDigest(bundle) {
        bundle.policy.full_additive_only = false;
      },
    },
  );
  withFixture(({ packet }, root) => {
    assert.throws(
      () => validate(packet, root, checks({ rejectAncestor: 'shell' })),
      /does not descend from Shell PR #34/,
    );
    assert.throws(
      () => validate(packet, root, checks({ rejectRemote: 'framework' })),
      /framework_sha is not reachable from a remote main/,
    );
    assert.throws(
      () =>
        validateCodexRuntimeArtifactEligibility(packet, {
          evidenceRoot: root,
          isAncestor: checks().isAncestor,
        }),
      /Remote-main reachability verifier is required/,
    );
  });
});

test('validator rejects checkpoint/control/operation-receipt successor drift', () => {
  withFixture(
    ({ packet }, root) => {
      assert.throws(() => validate(packet, root), /distinct operation_id/);
    },
    {
      mutateFullCheckpoint(checkpoint) {
        const controls = checkpoint.operation_controls;
        controls.append_full.operation_id = controls.standard.operation_id;
        redigest(controls.append_full, 'control_digest');
      },
    },
  );
  withFixture(
    ({ packet }, root) => {
      assert.throws(
        () => validate(packet, root),
        /must preserve the exact Standard operation control/,
      );
    },
    {
      mutateFullCheckpoint(checkpoint) {
        const standardControl = checkpoint.operation_controls.standard;
        standardControl.operation_deadline_at = '2026-07-31T02:01:00.000Z';
        redigest(standardControl, 'control_digest');
      },
    },
  );
  withFixture(
    ({ packet }, root) => {
      assert.throws(() => validate(packet, root), /Standard operation receipt\.attempt_id/);
    },
    {
      mutateStandardReceipt(receipt) {
        receipt.attempt_id = 'different-standard-operation';
      },
    },
  );
});

test('validator rejects incomplete immutable release asset sets', () => {
  withFixture(
    ({ packet }, root) => {
      assert.throws(
        () => validate(packet, root),
        /Standard release inspection\.assets closed immutable set/,
      );
    },
    {
      mutateStandardInspection(inspection) {
        inspection.assets.pop();
      },
    },
  );
  withFixture(
    ({ packet }, root) => {
      assert.throws(
        () => validate(packet, root),
        /Full release inspection\.assets closed immutable set/,
      );
    },
    {
      mutateFullInspection(inspection) {
        inspection.assets.push({
          name: 'unexpected-full-sidecar.json',
          size_bytes: 1,
          sha256: `sha256:${'0'.repeat(64)}`,
        });
      },
    },
  );
});

test('validator requires the component manifest DMG primary and exact nine sidecars', () => {
  withFixture(
    ({ packet }, root) => {
      assert.throws(
        () => validate(packet, root),
        /primary_artifact must be the exact canonical DMG artifact/,
      );
    },
    {
      mutateComponentManifest(manifest) {
        manifest.primary_artifact = structuredClone(
          manifest.artifacts.find((artifact: JsonRecord) => artifact.name.endsWith('.zip')),
        );
      },
    },
  );
  withFixture(
    ({ packet }, root) => {
      assert.throws(
        () => validate(packet, root),
        /Standard manifest artifacts closed set/,
      );
    },
    {
      mutateComponentManifest(manifest) {
        manifest.artifacts.pop();
      },
    },
  );
});

test('validator structurally parses updater YAML and binds ZIP and DMG bytes', () => {
  withFixture(
    ({ packet }, root) => {
      assert.throws(() => validate(packet, root), /Standard updater metadata\.sha512/);
    },
    {
      mutateUpdaterMetadata(metadata) {
        metadata.sha512 = 'not-the-updater-zip-sha512';
      },
    },
  );
  withFixture(
    ({ packet }, root) => {
      assert.throws(() => validate(packet, root), /Standard updater metadata ZIP size/);
    },
    {
      mutateUpdaterMetadata(metadata) {
        const zip = metadata.files.find((entry: JsonRecord) => entry.url.endsWith('.zip'));
        zip.size += 1;
      },
    },
  );
});

test('validator rejects qualification source drift, byte drift, and symlinked evidence', () => {
  withFixture(({ packet }, root) => {
    const buildRef = packet.full.files.build_cohort;
    const buildPath = path.join(root, buildRef.path);
    const build = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
    build.cohort.framework_sha = 'f'.repeat(40);
    rewriteJsonRef(root, buildRef, build);
    assert.throws(() => validate(packet, root), /full build cohort is invalid/);
  });

  withFixture(({ packet }, root) => {
    fs.appendFileSync(
      path.join(root, packet.standard.files.updater_artifact.path),
      'unexpected drift',
    );
    assert.throws(
      () => validate(packet, root),
      /packet\.standard\.files\.updater_artifact\.sha256 does not match/,
    );
  });

  withFixture(({ packet }, root) => {
    const original = path.join(root, packet.standard.files.release_manifest.path);
    const symlink = path.join(root, 'release-assets/component-manifest-link.json');
    fs.symlinkSync(original, symlink);
    packet.standard.files.release_manifest.path =
      path.relative(root, symlink).split(path.sep).join('/');
    assert.throws(() => validate(packet, root), /must not reference a symbolic link/);
  });
});
