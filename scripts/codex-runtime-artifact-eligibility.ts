#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';

import {
  validateArtifactQualificationReceipt,
  type ArtifactQualificationReceiptV1,
} from './artifact-qualification-receipt.ts';
import {
  validateArtifactCohortV2,
  type BuildArtifactCohortV2,
} from './build-artifact-cohort.ts';
import { inspectRelease as inspectCanonicalGitHubRelease } from './framework-release-adapter.ts';
import { readAppComponentManifestIdentity } from './read-opl-app-component-manifest-identity.ts';

export const ISSUE_122_APP_PROVENANCE_FLOOR =
  '87e002e38341435df45b17e9ad6ec8fbe300c238';
export const ISSUE_122_SHELL_PROVENANCE_FLOOR =
  '002b235853cc0ea05a5a5e79e8cd92999ac10a4a';

const APP_REPOSITORY = 'gaofeng21cn/one-person-lab-app';
const SHELL_REPOSITORY = 'gaofeng21cn/opl-aion-shell';
const FRAMEWORK_REPOSITORY = 'gaofeng21cn/one-person-lab';
const BUFFER_SIZE = 1024 * 1024;
const MAX_JSON_BYTES = 16 * 1024 * 1024;
const MAX_YAML_BYTES = 1024 * 1024;

type JsonRecord = Record<string, unknown>;
type SourceRepository = 'app' | 'shell' | 'framework';

export type ArtifactEligibilityFileRef = {
  path: string;
  sha256: string;
};

type StandardEligibilityTrack = {
  primary_asset_name: string;
  updater_asset_name: string;
  updater_metadata_asset_name: 'latest-arm64-mac.yml';
  manifest_asset_name: 'opl-app-component-manifest.json';
  files: {
    primary_artifact: ArtifactEligibilityFileRef;
    updater_artifact: ArtifactEligibilityFileRef;
    updater_blockmap: ArtifactEligibilityFileRef;
    updater_metadata: ArtifactEligibilityFileRef;
    release_manifest: ArtifactEligibilityFileRef;
    release_inspection: ArtifactEligibilityFileRef;
    build_cohort: ArtifactEligibilityFileRef;
    qualification_receipt: ArtifactEligibilityFileRef;
  };
};

type FullEligibilityTrack = {
  primary_asset_name: string;
  manifest_asset_name: 'opl-release-manifest.json';
  files: {
    primary_artifact: ArtifactEligibilityFileRef;
    release_manifest: ArtifactEligibilityFileRef;
    release_inspection: ArtifactEligibilityFileRef;
    build_cohort: ArtifactEligibilityFileRef;
    qualification_receipt: ArtifactEligibilityFileRef;
  };
};

export type CodexRuntimeArtifactEligibilityPacketV1 = {
  schema: 'opl_codex_runtime_artifact_eligibility.v1';
  status: 'candidate';
  purpose: 'issue_122_runtime_identity_evidence';
  authority: {
    source_pins_role: 'build_provenance_only';
    may_gate_install_or_runtime: false;
    exact_cross_component_compatibility_gate: false;
  };
  pair: {
    version: string;
    bundle_digest: string;
    release_cohort_ref: string;
    source: {
      app_sha: string;
      shell_sha: string;
      framework_sha: string;
    };
  };
  evidence: {
    framework_bundle: ArtifactEligibilityFileRef;
    standard_checkpoint: ArtifactEligibilityFileRef;
    full_checkpoint: ArtifactEligibilityFileRef;
    standard_operation_receipt: ArtifactEligibilityFileRef;
    append_full_operation_receipt: ArtifactEligibilityFileRef;
    stable_full_successor_receipt: ArtifactEligibilityFileRef;
    standard_run_inspection: ArtifactEligibilityFileRef;
    append_full_run_inspection: ArtifactEligibilityFileRef;
  };
  standard: StandardEligibilityTrack;
  full: FullEligibilityTrack;
  created_at: string;
};

type GitAncestorCheck = (
  repository: SourceRepository,
  ancestorSha: string,
  candidateSha: string,
) => boolean;

type GitRemoteMainCheck = (
  repository: SourceRepository,
  candidateSha: string,
) => boolean;

type GitAncestryResolver = GitAncestorCheck & {
  isRemoteMainReachable: GitRemoteMainCheck;
};

type GitHubReleaseInspector = (tag: string) => unknown;
type GitHubWorkflowRunInspector = (runId: string) => unknown;

export type CodexRuntimeArtifactEligibilityValidationOptions = {
  evidenceRoot: string;
  isAncestor: GitAncestorCheck;
  isRemoteMainReachable?: GitRemoteMainCheck;
  inspectRelease: GitHubReleaseInspector;
  inspectWorkflowRun: GitHubWorkflowRunInspector;
};

type VerifiedFile = {
  path: string;
  sizeBytes: number;
  declaredDigest: string;
};

type VerifiedJsonFile = VerifiedFile & {
  value: JsonRecord;
};

type AssetIdentity = {
  name: string;
  sizeBytes: number;
  digest: string;
};

type OperationControl = {
  value: JsonRecord;
  operationId: string;
  startedAt: string;
  deadlineAt: string;
  controlDigest: string;
};

type CheckpointIdentity = {
  value: JsonRecord;
  checkpointDigest: string;
  stage: string;
  standardControl: OperationControl;
  appendFullControl: OperationControl | null;
  standardAssets: Map<string, AssetIdentity>;
  fullAssets: Map<string, AssetIdentity>;
  entries: Map<string, JsonRecord>;
  standardTrack: JsonRecord;
  fullTrack: JsonRecord;
};

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;
const RUN_ID_PATTERN = /^[1-9][0-9]*$/;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function exactKeys(
  value: JsonRecord,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).toSorted();
  const canonical = [...expected].toSorted();
  if (JSON.stringify(actual) !== JSON.stringify(canonical)) {
    throw new Error(`${label} fields must be exactly ${canonical.join(', ')}`);
  }
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new Error(`${label} must be a normalized non-empty string`);
  }
  return value;
}

function exact(value: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}`);
  }
}

function sha(value: unknown, label: string): string {
  const normalized = string(value, label);
  if (!SHA_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a lowercase 40-character Git SHA`);
  }
  return normalized;
}

function digest(value: unknown, label: string): string {
  const normalized = string(value, label);
  if (!DIGEST_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return normalized;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return Number(value);
}

function canonicalTimestamp(value: unknown, label: string): string {
  const normalized = string(value, label);
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== normalized) {
    throw new Error(`${label} must be a canonical UTC ISO date-time with milliseconds`);
  }
  return normalized;
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

function canonicalEqual(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function sha256Bytes(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function canonicalDigestWithout(value: JsonRecord, field: string): string {
  const core = { ...value };
  delete core[field];
  return sha256Bytes(canonicalJson(core));
}

export function digestCodexRuntimeArtifactEligibilityPacket(value: unknown): string {
  return sha256Bytes(canonicalJson(value));
}

function isInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function inspectRegularFile(filePath: string, label: string): {
  sizeBytes: number;
  sha256: string;
} {
  let descriptor: number;
  try {
    descriptor = fs.openSync(
      filePath,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
    );
  } catch (error) {
    throw new Error(
      `${label} is unavailable (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.size <= 0n) {
      throw new Error(`${label} must be a non-empty regular file`);
    }
    if (before.size > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`${label} exceeds the safe file-size range`);
    }
    const hash = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(BUFFER_SIZE);
    let offset = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, offset);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
      || BigInt(offset) !== after.size
    ) {
      throw new Error(`${label} changed while its bytes were inspected`);
    }
    return {
      sizeBytes: Number(after.size),
      sha256: `sha256:${hash.digest('hex')}`,
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function streamedDigest(
  filePath: string,
  algorithm: 'sha512',
  encoding: crypto.BinaryToTextEncoding,
): string {
  const descriptor = fs.openSync(
    filePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
  );
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    const hash = crypto.createHash(algorithm);
    const buffer = Buffer.allocUnsafe(BUFFER_SIZE);
    let offset = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, offset);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
      || BigInt(offset) !== after.size
    ) {
      throw new Error(`File changed while computing ${algorithm}: ${filePath}`);
    }
    return hash.digest(encoding);
  } finally {
    fs.closeSync(descriptor);
  }
}

function verifiedFile(
  value: unknown,
  label: string,
  evidenceRoot: string,
): VerifiedFile {
  const reference = record(value, label);
  exactKeys(reference, ['path', 'sha256'], label);
  const relativePath = string(reference.path, `${label}.path`);
  const declaredDigest = digest(reference.sha256, `${label}.sha256`);
  if (path.isAbsolute(relativePath) || relativePath.includes('\\')) {
    throw new Error(`${label}.path must be a portable relative path`);
  }
  const normalized = path.posix.normalize(relativePath);
  if (
    normalized !== relativePath
    || normalized === '..'
    || normalized.startsWith('../')
  ) {
    throw new Error(`${label}.path must not escape the evidence root`);
  }

  const rootRealpath = fs.realpathSync(evidenceRoot);
  const resolved = path.resolve(rootRealpath, relativePath);
  const unresolvedStats = fs.lstatSync(resolved);
  if (unresolvedStats.isSymbolicLink()) {
    throw new Error(`${label}.path must not reference a symbolic link`);
  }
  const fileRealpath = fs.realpathSync(resolved);
  if (!isInside(fileRealpath, rootRealpath)) {
    throw new Error(`${label}.path resolves outside the evidence root`);
  }
  const observed = inspectRegularFile(fileRealpath, label);
  if (observed.sha256 !== declaredDigest) {
    throw new Error(`${label}.sha256 does not match ${fileRealpath}`);
  }
  return {
    path: fileRealpath,
    sizeBytes: observed.sizeBytes,
    declaredDigest,
  };
}

function verifiedJsonFile(
  value: unknown,
  label: string,
  evidenceRoot: string,
): VerifiedJsonFile {
  const file = verifiedFile(value, label, evidenceRoot);
  if (file.sizeBytes > MAX_JSON_BYTES) {
    throw new Error(`${label}.path exceeds the ${MAX_JSON_BYTES}-byte JSON limit`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file.path, 'utf8'));
  } catch (error) {
    throw new Error(
      `${label}.path must contain JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  return { ...file, value: record(parsed, `${label} JSON`) };
}

function verifiedYamlFile(
  value: unknown,
  label: string,
  evidenceRoot: string,
): VerifiedFile & { text: string } {
  const file = verifiedFile(value, label, evidenceRoot);
  if (file.sizeBytes > MAX_YAML_BYTES) {
    throw new Error(`${label}.path exceeds the ${MAX_YAML_BYTES}-byte YAML limit`);
  }
  return { ...file, text: fs.readFileSync(file.path, 'utf8') };
}

function standardAssetNames(version: string): string[] {
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

function fullAssetNames(version: string): string[] {
  return [
    `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
    'opl-release-manifest.json',
  ];
}

function validateTrackPlan(
  value: unknown,
  label: string,
  expectedNames: string[],
  expected: {
    requiredForLatest: boolean;
    additiveOnly: boolean;
    updaterMetadataAllowed: boolean;
  },
): void {
  const plan = record(value, label);
  exactKeys(
    plan,
    [
      'required_asset_names',
      'required_for_latest',
      'additive_only',
      'updater_metadata_allowed',
    ],
    label,
  );
  exact(plan.required_asset_names, expectedNames, `${label}.required_asset_names`);
  exact(plan.required_for_latest, expected.requiredForLatest, `${label}.required_for_latest`);
  exact(plan.additive_only, expected.additiveOnly, `${label}.additive_only`);
  exact(
    plan.updater_metadata_allowed,
    expected.updaterMetadataAllowed,
    `${label}.updater_metadata_allowed`,
  );
}

function validateFrameworkBundle(
  bundle: JsonRecord,
  expected: {
    version: string;
    bundleDigest: string;
    source: { appSha: string; shellSha: string; frameworkSha: string };
  },
): {
  updaterVersion: string;
  standardNames: string[];
  fullNames: string[];
} {
  exact(bundle.surface_kind, 'opl_release_bundle.v1', 'Framework Bundle surface_kind');
  exact(
    bundle.schema_ref,
    'contracts/opl-framework/release-bundle.schema.json',
    'Framework Bundle schema_ref',
  );
  exact(
    digest(bundle.bundle_digest, 'Framework Bundle bundle_digest'),
    expected.bundleDigest,
    'Framework Bundle bundle_digest',
  );
  exact(
    canonicalDigestWithout(bundle, 'bundle_digest'),
    expected.bundleDigest,
    'Framework Bundle canonical digest',
  );

  const release = record(bundle.release, 'Framework Bundle release');
  exact(release.channel, 'stable', 'Framework Bundle release.channel');
  exact(release.version, expected.version, 'Framework Bundle release.version');
  exact(release.display_version, expected.version, 'Framework Bundle release.display_version');
  const updaterVersion = string(
    release.updater_version,
    'Framework Bundle release.updater_version',
  );
  exact(release.tag, `v${expected.version}`, 'Framework Bundle release.tag');
  exact(release.prerelease, false, 'Framework Bundle release.prerelease');

  const sources = record(bundle.sources, 'Framework Bundle sources');
  exactKeys(sources, ['app', 'shell', 'framework'], 'Framework Bundle sources');
  const expectedSources = {
    app: { repo: APP_REPOSITORY, sha: expected.source.appSha },
    shell: { repo: SHELL_REPOSITORY, sha: expected.source.shellSha },
    framework: { repo: FRAMEWORK_REPOSITORY, sha: expected.source.frameworkSha },
  } as const;
  for (const [repository, identity] of Object.entries(expectedSources)) {
    const source = record(sources[repository], `Framework Bundle sources.${repository}`);
    exactKeys(source, ['repo', 'source_commit'], `Framework Bundle sources.${repository}`);
    exact(source.repo, identity.repo, `Framework Bundle sources.${repository}.repo`);
    exact(
      sha(source.source_commit, `Framework Bundle sources.${repository}.source_commit`),
      identity.sha,
      `Framework Bundle sources.${repository}.source_commit`,
    );
  }

  exact(bundle.identity_mode, 'app_standard_compatibility', 'Framework Bundle identity_mode');
  const packageCompatibility = record(
    bundle.package_compatibility,
    'Framework Bundle package_compatibility',
  );
  exactKeys(
    packageCompatibility,
    ['abi', 'version_range'],
    'Framework Bundle package_compatibility',
  );
  exact(packageCompatibility.abi, 'opl_packages.v1', 'Framework Bundle package_compatibility.abi');
  string(
    packageCompatibility.version_range,
    'Framework Bundle package_compatibility.version_range',
  );

  const notes = record(bundle.prepared_notes, 'Framework Bundle prepared_notes');
  exact(
    notes.markdown_sha256,
    sha256Bytes(string(notes.markdown, 'Framework Bundle prepared_notes.markdown')),
    'Framework Bundle prepared_notes.markdown_sha256',
  );
  exact(
    notes.evidence_sha256,
    sha256Bytes(canonicalJson(record(
      notes.evidence,
      'Framework Bundle prepared_notes.evidence',
    ))),
    'Framework Bundle prepared_notes.evidence_sha256',
  );

  const standardNames = standardAssetNames(expected.version);
  const fullNames = fullAssetNames(expected.version);
  const tracks = record(bundle.tracks, 'Framework Bundle tracks');
  exactKeys(tracks, ['standard', 'full'], 'Framework Bundle tracks');
  validateTrackPlan(
    tracks.standard,
    'Framework Bundle tracks.standard',
    standardNames,
    {
      requiredForLatest: true,
      additiveOnly: false,
      updaterMetadataAllowed: true,
    },
  );
  validateTrackPlan(
    tracks.full,
    'Framework Bundle tracks.full',
    fullNames,
    {
      requiredForLatest: false,
      additiveOnly: true,
      updaterMetadataAllowed: false,
    },
  );

  const policy = record(bundle.policy, 'Framework Bundle policy');
  exact(policy.build_once, true, 'Framework Bundle policy.build_once');
  exact(policy.verify_and_promote_many, true, 'Framework Bundle policy.verify_and_promote_many');
  exact(policy.executor_neutral, true, 'Framework Bundle policy.executor_neutral');
  exact(policy.allowed_executors, ['local', 'remote'], 'Framework Bundle policy.allowed_executors');
  exact(
    policy.prepared_notes_required_before_build,
    true,
    'Framework Bundle policy.prepared_notes_required_before_build',
  );
  exact(policy.publish_may_generate_notes, false, 'Framework Bundle policy.publish_may_generate_notes');
  exact(policy.latest_required_track, 'standard', 'Framework Bundle policy.latest_required_track');
  exact(policy.full_additive_only, true, 'Framework Bundle policy.full_additive_only');
  exact(
    policy.full_updates_updater_metadata,
    false,
    'Framework Bundle policy.full_updates_updater_metadata',
  );

  return { updaterVersion, standardNames, fullNames };
}

function validateOperationControl(
  value: unknown,
  label: string,
  expected: {
    bundleDigest: string;
    kind: 'standard' | 'append_full';
    track: 'standard' | 'full';
  },
): OperationControl {
  const control = record(value, label);
  exactKeys(
    control,
    [
      'surface_kind',
      'schema_ref',
      'control_digest',
      'bundle_digest',
      'operation_id',
      'operation_kind',
      'track',
      'operation_started_at',
      'operation_deadline_at',
    ],
    label,
  );
  exact(control.surface_kind, 'opl_release_bundle_operation_control.v1', `${label}.surface_kind`);
  exact(
    control.schema_ref,
    'contracts/opl-framework/release-bundle-operation-control.schema.json',
    `${label}.schema_ref`,
  );
  exact(control.bundle_digest, expected.bundleDigest, `${label}.bundle_digest`);
  exact(control.operation_kind, expected.kind, `${label}.operation_kind`);
  exact(control.track, expected.track, `${label}.track`);
  const operationId = string(control.operation_id, `${label}.operation_id`);
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    throw new Error(`${label}.operation_id is not canonical`);
  }
  const startedAt = canonicalTimestamp(control.operation_started_at, `${label}.operation_started_at`);
  const deadlineAt = canonicalTimestamp(
    control.operation_deadline_at,
    `${label}.operation_deadline_at`,
  );
  if (Date.parse(deadlineAt) <= Date.parse(startedAt)) {
    throw new Error(`${label}.operation_deadline_at must be after its immutable start`);
  }
  const controlDigest = digest(control.control_digest, `${label}.control_digest`);
  exact(
    canonicalDigestWithout(control, 'control_digest'),
    controlDigest,
    `${label}.control_digest`,
  );
  return { value: control, operationId, startedAt, deadlineAt, controlDigest };
}

function validateOperationReceipt(
  value: JsonRecord,
  label: string,
  expected: {
    bundleDigest: string;
    releaseOperation: 'standard' | 'append_full';
    track: 'standard' | 'full';
    control: OperationControl;
  },
): string {
  exactKeys(
    value,
    [
      'surface_kind',
      'schema_ref',
      'operation',
      'status',
      'bundle_digest',
      'track',
      'executor',
      'attempt_id',
      'recorded_at',
      'release_operation',
      'operation_control',
      'unknown_marker',
      'details',
    ],
    label,
  );
  exact(value.surface_kind, 'opl_release_bundle_operation_receipt.v1', `${label}.surface_kind`);
  exact(
    value.schema_ref,
    'contracts/opl-framework/release-bundle-operation-receipt.schema.json',
    `${label}.schema_ref`,
  );
  exact(value.operation, 'operation_admit', `${label}.operation`);
  if (value.status !== 'complete' && value.status !== 'idempotent') {
    throw new Error(`${label}.status must be complete or idempotent`);
  }
  exact(value.bundle_digest, expected.bundleDigest, `${label}.bundle_digest`);
  exact(value.track, expected.track, `${label}.track`);
  exact(value.executor, null, `${label}.executor`);
  exact(value.attempt_id, expected.control.operationId, `${label}.attempt_id`);
  const recordedAt = canonicalTimestamp(value.recorded_at, `${label}.recorded_at`);
  exact(value.release_operation, expected.releaseOperation, `${label}.release_operation`);
  if (!canonicalEqual(value.operation_control, expected.control.value)) {
    throw new Error(`${label}.operation_control does not match the preserved control`);
  }
  exact(value.unknown_marker, null, `${label}.unknown_marker`);
  const details = record(value.details, `${label}.details`);
  exactKeys(
    details,
    [
      'control_digest',
      'deadline_frozen_once',
      'deadline_refresh_allowed',
      'resume_of',
      'append_full_independent_deadline',
    ],
    `${label}.details`,
  );
  exact(details.control_digest, expected.control.controlDigest, `${label}.details.control_digest`);
  exact(details.deadline_frozen_once, true, `${label}.details.deadline_frozen_once`);
  exact(details.deadline_refresh_allowed, false, `${label}.details.deadline_refresh_allowed`);
  exact(details.resume_of, null, `${label}.details.resume_of`);
  exact(
    details.append_full_independent_deadline,
    expected.releaseOperation === 'append_full',
    `${label}.details.append_full_independent_deadline`,
  );
  return recordedAt;
}

function validateCheckpointTrack(
  value: unknown,
  label: string,
  expected: {
    built: boolean;
    verified: boolean;
    assetNames: string[];
    track: 'standard' | 'full';
  },
): JsonRecord {
  const track = record(value, label);
  exactKeys(
    track,
    [
      'built',
      'verified',
      'asset_names',
      'asset_manifest_path',
      'asset_manifest_sha256',
      'qualification_receipt_path',
      'qualification_receipt_sha256',
    ],
    label,
  );
  exact(track.built, expected.built, `${label}.built`);
  exact(track.verified, expected.verified, `${label}.verified`);
  exact(
    track.asset_names,
    expected.built ? [...expected.assetNames].toSorted() : [],
    `${label}.asset_names`,
  );
  const trackRoot = `tracks/${expected.track}`;
  exact(
    track.asset_manifest_path,
    expected.built ? `${trackRoot}/assets.json` : null,
    `${label}.asset_manifest_path`,
  );
  if (expected.built) {
    digest(track.asset_manifest_sha256, `${label}.asset_manifest_sha256`);
  } else {
    exact(track.asset_manifest_sha256, null, `${label}.asset_manifest_sha256`);
  }
  exact(
    track.qualification_receipt_path,
    expected.verified ? `${trackRoot}/qualification.json` : null,
    `${label}.qualification_receipt_path`,
  );
  if (expected.verified) {
    digest(track.qualification_receipt_sha256, `${label}.qualification_receipt_sha256`);
  } else {
    exact(track.qualification_receipt_sha256, null, `${label}.qualification_receipt_sha256`);
  }
  return track;
}

function validateCheckpointEntries(
  checkpoint: JsonRecord,
  label: string,
  input: {
    bundleDigest: string;
    bundleFile: VerifiedFile;
    notes: string;
    standardNames: string[];
    fullNames: string[];
    standardVerified: boolean;
    fullBuilt: boolean;
    fullVerified: boolean;
  },
): {
  entries: Map<string, JsonRecord>;
  standardAssets: Map<string, AssetIdentity>;
  fullAssets: Map<string, AssetIdentity>;
} {
  if (!Array.isArray(checkpoint.entries)) {
    throw new Error(`${label}.entries must be an array`);
  }
  const entries = new Map<string, JsonRecord>();
  for (const [index, candidate] of checkpoint.entries.entries()) {
    const entryLabel = `${label}.entries[${index}]`;
    const entry = record(candidate, entryLabel);
    exactKeys(
      entry,
      ['path', 'role', 'track', 'asset_name', 'size_bytes', 'sha256'],
      entryLabel,
    );
    const entryPath = string(entry.path, `${entryLabel}.path`);
    if (
      path.posix.isAbsolute(entryPath)
      || entryPath.includes('\\')
      || path.posix.normalize(entryPath) !== entryPath
      || entryPath.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      throw new Error(`${entryLabel}.path must be a canonical relative POSIX path`);
    }
    if (entries.has(entryPath)) throw new Error(`${label}.entries contains duplicate paths`);
    positiveInteger(entry.size_bytes, `${entryLabel}.size_bytes`);
    digest(entry.sha256, `${entryLabel}.sha256`);
    entries.set(entryPath, entry);
  }

  const expectedPaths = new Set(['bundle.json', 'notes.md']);
  const addTrackPaths = (
    track: 'standard' | 'full',
    names: string[],
    built: boolean,
    verified: boolean,
  ) => {
    if (!built) return;
    expectedPaths.add(`tracks/${track}/assets.json`);
    for (const name of names) expectedPaths.add(`tracks/${track}/assets/${name}`);
    if (verified) expectedPaths.add(`tracks/${track}/qualification.json`);
  };
  addTrackPaths('standard', input.standardNames, true, input.standardVerified);
  addTrackPaths('full', input.fullNames, input.fullBuilt, input.fullVerified);
  exact(
    [...entries.keys()].toSorted(),
    [...expectedPaths].toSorted(),
    `${label}.entries closed path set`,
  );

  const bundleEntry = entries.get('bundle.json')!;
  exact(bundleEntry.role, 'bundle', `${label} bundle entry role`);
  exact(bundleEntry.track, null, `${label} bundle entry track`);
  exact(bundleEntry.asset_name, null, `${label} bundle entry asset_name`);
  exact(bundleEntry.size_bytes, input.bundleFile.sizeBytes, `${label} bundle entry size_bytes`);
  exact(bundleEntry.sha256, input.bundleFile.declaredDigest, `${label} bundle entry sha256`);

  const notesBytes = Buffer.from(input.notes, 'utf8');
  const notesEntry = entries.get('notes.md')!;
  exact(notesEntry.role, 'prepared_notes', `${label} notes entry role`);
  exact(notesEntry.track, null, `${label} notes entry track`);
  exact(notesEntry.asset_name, null, `${label} notes entry asset_name`);
  exact(notesEntry.size_bytes, notesBytes.byteLength, `${label} notes entry size_bytes`);
  exact(notesEntry.sha256, sha256Bytes(notesBytes), `${label} notes entry sha256`);

  const assetMap = (
    track: 'standard' | 'full',
    names: string[],
    built: boolean,
    verified: boolean,
  ): Map<string, AssetIdentity> => {
    const assets = new Map<string, AssetIdentity>();
    if (!built) return assets;
    for (const name of names) {
      const entry = entries.get(`tracks/${track}/assets/${name}`)!;
      exact(entry.role, 'track_asset', `${label} ${track} ${name} role`);
      exact(entry.track, track, `${label} ${track} ${name} track`);
      exact(entry.asset_name, name, `${label} ${track} ${name} asset_name`);
      assets.set(name, {
        name,
        sizeBytes: positiveInteger(entry.size_bytes, `${label} ${track} ${name} size_bytes`),
        digest: digest(entry.sha256, `${label} ${track} ${name} sha256`),
      });
    }
    const manifestEntry = entries.get(`tracks/${track}/assets.json`)!;
    exact(manifestEntry.role, 'track_asset_manifest', `${label} ${track} asset manifest role`);
    exact(manifestEntry.track, track, `${label} ${track} asset manifest track`);
    exact(manifestEntry.asset_name, null, `${label} ${track} asset manifest asset_name`);
    const manifestBytes = Buffer.from(`${JSON.stringify({
      surface_kind: 'opl_release_bundle_staged_assets.v1',
      bundle_digest: input.bundleDigest,
      track,
      assets: [...assets.values()]
        .map((asset) => ({
          name: asset.name,
          size_bytes: asset.sizeBytes,
          sha256: asset.digest,
        }))
        .toSorted((left, right) => left.name.localeCompare(right.name)),
    }, null, 2)}\n`);
    exact(
      manifestEntry.size_bytes,
      manifestBytes.byteLength,
      `${label} ${track} asset manifest size_bytes`,
    );
    exact(
      manifestEntry.sha256,
      sha256Bytes(manifestBytes),
      `${label} ${track} asset manifest sha256`,
    );
    if (verified) {
      const qualificationEntry = entries.get(`tracks/${track}/qualification.json`)!;
      exact(
        qualificationEntry.role,
        'qualification_receipt',
        `${label} ${track} qualification role`,
      );
      exact(
        qualificationEntry.track,
        track,
        `${label} ${track} qualification track`,
      );
      exact(
        qualificationEntry.asset_name,
        null,
        `${label} ${track} qualification asset_name`,
      );
    }
    return assets;
  };

  return {
    entries,
    standardAssets: assetMap(
      'standard',
      input.standardNames,
      true,
      input.standardVerified,
    ),
    fullAssets: assetMap(
      'full',
      input.fullNames,
      input.fullBuilt,
      input.fullVerified,
    ),
  };
}

function validateCheckpoint(
  file: VerifiedJsonFile,
  label: 'Standard checkpoint' | 'Full checkpoint',
  input: {
    bundleDigest: string;
    bundleFile: VerifiedFile;
    bundle: JsonRecord;
    standardNames: string[];
    fullNames: string[];
    final: boolean;
  },
): CheckpointIdentity {
  const checkpoint = file.value;
  exactKeys(
    checkpoint,
    [
      'surface_kind',
      'schema_ref',
      'checkpoint_digest',
      'bundle_digest',
      'checkpoint_stage',
      'operation_controls',
      'active_unknown_markers',
      'tracks',
      'entries',
      'policy',
    ],
    label,
  );
  exact(checkpoint.surface_kind, 'opl_release_bundle_checkpoint.v1', `${label}.surface_kind`);
  exact(
    checkpoint.schema_ref,
    'contracts/opl-framework/release-bundle-checkpoint.schema.json',
    `${label}.schema_ref`,
  );
  const checkpointDigest = digest(checkpoint.checkpoint_digest, `${label}.checkpoint_digest`);
  exact(
    canonicalDigestWithout(checkpoint, 'checkpoint_digest'),
    checkpointDigest,
    `${label}.checkpoint_digest`,
  );
  exact(checkpoint.bundle_digest, input.bundleDigest, `${label}.bundle_digest`);
  exact(checkpoint.active_unknown_markers, [], `${label}.active_unknown_markers`);
  const policy = record(checkpoint.policy, `${label}.policy`);
  exactKeys(
    policy,
    [
      'portable_between_executors',
      'import_never_rebuilds',
      'publish_state_requires_fresh_remote_readback',
    ],
    `${label}.policy`,
  );
  exact(policy.portable_between_executors, true, `${label}.policy.portable_between_executors`);
  exact(policy.import_never_rebuilds, true, `${label}.policy.import_never_rebuilds`);
  exact(
    policy.publish_state_requires_fresh_remote_readback,
    true,
    `${label}.policy.publish_state_requires_fresh_remote_readback`,
  );

  const controls = record(checkpoint.operation_controls, `${label}.operation_controls`);
  exactKeys(controls, ['standard', 'append_full'], `${label}.operation_controls`);
  const standardControl = validateOperationControl(
    controls.standard,
    `${label}.operation_controls.standard`,
    { bundleDigest: input.bundleDigest, kind: 'standard', track: 'standard' },
  );
  let appendFullControl: OperationControl | null = null;
  if (input.final) {
    appendFullControl = validateOperationControl(
      controls.append_full,
      `${label}.operation_controls.append_full`,
      { bundleDigest: input.bundleDigest, kind: 'append_full', track: 'full' },
    );
    if (appendFullControl.operationId === standardControl.operationId) {
      throw new Error(`${label} append_full control must use a distinct operation_id`);
    }
  } else {
    exact(controls.append_full, null, `${label}.operation_controls.append_full`);
  }

  const tracks = record(checkpoint.tracks, `${label}.tracks`);
  exactKeys(tracks, ['standard', 'full'], `${label}.tracks`);
  const standardVerified =
    record(tracks.standard, `${label}.tracks.standard`).verified === true;
  const standardTrack = validateCheckpointTrack(
    tracks.standard,
    `${label}.tracks.standard`,
    {
      built: true,
      verified: standardVerified,
      assetNames: input.standardNames,
      track: 'standard',
    },
  );
  const fullTrack = validateCheckpointTrack(
    tracks.full,
    `${label}.tracks.full`,
    {
      built: input.final,
      verified: input.final,
      assetNames: input.fullNames,
      track: 'full',
    },
  );
  const stage = string(checkpoint.checkpoint_stage, `${label}.checkpoint_stage`);
  exact(
    stage,
    input.final
      ? 'full_qualified'
      : standardVerified
        ? 'standard_qualified'
        : 'standard_built',
    `${label}.checkpoint_stage`,
  );

  const notes = record(
    input.bundle.prepared_notes,
    'Framework Bundle prepared_notes',
  );
  const validatedEntries = validateCheckpointEntries(checkpoint, label, {
    bundleDigest: input.bundleDigest,
    bundleFile: input.bundleFile,
    notes: string(notes.markdown, 'Framework Bundle prepared_notes.markdown'),
    standardNames: input.standardNames,
    fullNames: input.fullNames,
    standardVerified,
    fullBuilt: input.final,
    fullVerified: input.final,
  });
  const standardAssetManifest = validatedEntries.entries.get('tracks/standard/assets.json')!;
  exact(
    standardTrack.asset_manifest_sha256,
    standardAssetManifest.sha256,
    `${label}.tracks.standard.asset_manifest_sha256`,
  );
  if (standardVerified) {
    const standardQualification =
      validatedEntries.entries.get('tracks/standard/qualification.json')!;
    exact(
      standardTrack.qualification_receipt_sha256,
      standardQualification.sha256,
      `${label}.tracks.standard.qualification_receipt_sha256`,
    );
  }
  if (input.final) {
    const fullAssetManifest = validatedEntries.entries.get('tracks/full/assets.json')!;
    const fullQualification =
      validatedEntries.entries.get('tracks/full/qualification.json')!;
    exact(
      fullTrack.asset_manifest_sha256,
      fullAssetManifest.sha256,
      `${label}.tracks.full.asset_manifest_sha256`,
    );
    exact(
      fullTrack.qualification_receipt_sha256,
      fullQualification.sha256,
      `${label}.tracks.full.qualification_receipt_sha256`,
    );
  }
  return {
    value: checkpoint,
    checkpointDigest,
    stage,
    standardControl,
    appendFullControl,
    standardAssets: validatedEntries.standardAssets,
    fullAssets: validatedEntries.fullAssets,
    entries: validatedEntries.entries,
    standardTrack,
    fullTrack,
  };
}

function validateCheckpointSuccessor(
  standard: CheckpointIdentity,
  full: CheckpointIdentity,
): void {
  if (standard.checkpointDigest === full.checkpointDigest) {
    throw new Error('Full checkpoint must be a distinct successor checkpoint');
  }
  if (!canonicalEqual(standard.standardControl.value, full.standardControl.value)) {
    throw new Error('Full checkpoint must preserve the exact Standard operation control');
  }
  if (!canonicalEqual(standard.standardTrack, full.standardTrack)) {
    throw new Error('Full checkpoint must preserve the exact Standard track state');
  }
  if (!full.appendFullControl) {
    throw new Error('Full checkpoint must contain the append_full operation control');
  }
  for (const [name, identity] of standard.standardAssets) {
    const successor = full.standardAssets.get(name);
    if (!successor || !canonicalEqual(successor, identity)) {
      throw new Error(`Full checkpoint changed preserved Standard asset ${name}`);
    }
  }
  const preservedEntryPaths = [
    'bundle.json',
    'notes.md',
    'tracks/standard/assets.json',
    ...(
      standard.entries.has('tracks/standard/qualification.json')
        ? ['tracks/standard/qualification.json']
        : []
    ),
  ];
  for (const entryPath of preservedEntryPaths) {
    if (!canonicalEqual(standard.entries.get(entryPath), full.entries.get(entryPath))) {
      throw new Error(`Full checkpoint changed preserved Standard entry ${entryPath}`);
    }
  }
}

function validateReleaseInspection(
  value: JsonRecord,
  label: string,
  expected: {
    tag: string;
    appSha: string;
    names: string[];
  },
): {
  id: number;
  assets: Map<string, AssetIdentity>;
} {
  exactKeys(
    value,
    ['surface_kind', 'repository', 'tag', 'release', 'assets'],
    label,
  );
  exact(
    value.surface_kind,
    'opl_app_github_release_inspection.v1',
    `${label}.surface_kind`,
  );
  exact(value.repository, APP_REPOSITORY, `${label}.repository`);
  exact(value.tag, expected.tag, `${label}.tag`);
  const release = record(value.release, `${label}.release`);
  exactKeys(
    release,
    [
      'exists',
      'id',
      'name',
      'draft',
      'prerelease',
      'target_commitish',
      'body_sha256',
      'immutable',
    ],
    `${label}.release`,
  );
  exact(release.exists, true, `${label}.release.exists`);
  const id = positiveInteger(release.id, `${label}.release.id`);
  string(release.name, `${label}.release.name`);
  exact(release.draft, false, `${label}.release.draft`);
  exact(release.prerelease, false, `${label}.release.prerelease`);
  exact(
    sha(release.target_commitish, `${label}.release.target_commitish`),
    expected.appSha,
    `${label}.release.target_commitish`,
  );
  digest(release.body_sha256, `${label}.release.body_sha256`);
  exact(release.immutable, true, `${label}.release.immutable`);
  if (!Array.isArray(value.assets)) throw new Error(`${label}.assets must be an array`);
  const assets = new Map<string, AssetIdentity>();
  for (const [index, candidate] of value.assets.entries()) {
    const assetLabel = `${label}.assets[${index}]`;
    const asset = record(candidate, assetLabel);
    exactKeys(asset, ['name', 'size_bytes', 'sha256'], assetLabel);
    const name = string(asset.name, `${assetLabel}.name`);
    if (assets.has(name)) throw new Error(`${label}.assets contains duplicate ${name}`);
    assets.set(name, {
      name,
      sizeBytes: positiveInteger(asset.size_bytes, `${assetLabel}.size_bytes`),
      digest: digest(asset.sha256, `${assetLabel}.sha256`),
    });
  }
  exact(
    [...assets.keys()].toSorted(),
    [...expected.names].toSorted(),
    `${label}.assets closed immutable set`,
  );
  return { id, assets };
}

function assertFreshInspection(
  saved: JsonRecord,
  fresh: unknown,
  label: string,
): JsonRecord {
  const freshInspection = record(fresh, `${label} fresh readback`);
  if (!canonicalEqual(saved, freshInspection)) {
    throw new Error(`${label} does not match the fresh canonical GitHub readback`);
  }
  return freshInspection;
}

function validateWorkflowRunInspection(
  value: JsonRecord,
  label: string,
  expected: {
    runId: string;
    kind: 'standard' | 'append_full';
    sourceRunId?: string;
    headSha?: string;
  },
): {
  runId: string;
  headSha: string;
} {
  exactKeys(value, ['surface_kind', 'repository', 'run'], label);
  exact(
    value.surface_kind,
    'opl_app_github_actions_run_inspection.v1',
    `${label}.surface_kind`,
  );
  exact(value.repository, APP_REPOSITORY, `${label}.repository`);
  const run = record(value.run, `${label}.run`);
  exactKeys(
    run,
    [
      'id',
      'repository',
      'head_repository',
      'path',
      'event',
      'head_branch',
      'head_sha',
      'run_attempt',
      'status',
      'conclusion',
      'display_title',
    ],
    `${label}.run`,
  );
  const runId = String(positiveInteger(run.id, `${label}.run.id`));
  exact(runId, expected.runId, `${label}.run.id`);
  exact(run.repository, APP_REPOSITORY, `${label}.run.repository`);
  exact(run.head_repository, APP_REPOSITORY, `${label}.run.head_repository`);
  exact(
    run.path,
    '.github/workflows/release-stable.yml',
    `${label}.run.path`,
  );
  exact(run.event, 'workflow_dispatch', `${label}.run.event`);
  exact(run.head_branch, 'main', `${label}.run.head_branch`);
  const headSha = sha(run.head_sha, `${label}.run.head_sha`);
  if (expected.headSha) {
    exact(headSha, expected.headSha, `${label}.run.head_sha`);
  }
  exact(run.run_attempt, 1, `${label}.run.run_attempt`);
  exact(run.status, 'completed', `${label}.run.status`);
  exact(run.conclusion, 'success', `${label}.run.conclusion`);
  const displayTitle = string(run.display_title, `${label}.run.display_title`);
  if (expected.kind === 'standard') {
    const legacyTitle = `OPL Stable standard ${runId}`;
    const currentTitlePattern = new RegExp(
      `^OPL Stable standard operation:[A-Za-z0-9._:-]{1,128} authority:[A-Za-z0-9._:-]{1,128} run:${runId}$`,
    );
    if (displayTitle !== legacyTitle && !currentTitlePattern.test(displayTitle)) {
      throw new Error(`${label}.run.display_title is not the exact Standard run identity`);
    }
  } else {
    const sourceRunId = string(
      expected.sourceRunId,
      `${label} expected source run id`,
    );
    exact(
      displayTitle,
      `OPL Stable append_full source:${sourceRunId} run:${runId}`,
      `${label}.run.display_title`,
    );
  }
  return { runId, headSha };
}

function validateStableFullSuccessorReceipt(
  value: JsonRecord,
  expected: {
    version: string;
    source: { appSha: string; shellSha: string; frameworkSha: string };
    standardRunId: string;
    appendFullRunId: string;
    appendFullHeadSha: string;
  },
): void {
  const label = 'Stable Full successor receipt';
  exactKeys(
    value,
    [
      'schema',
      'operation',
      'source',
      'cohort',
      'release',
      'admission',
      'dispatch',
      'mutation_scope',
    ],
    label,
  );
  exact(
    value.schema,
    'opl_app_stable_full_successor_receipt.v1',
    `${label}.schema`,
  );
  exact(value.operation, 'append_full', `${label}.operation`);

  const source = record(value.source, `${label}.source`);
  exactKeys(source, ['run_id', 'artifact'], `${label}.source`);
  exact(source.run_id, expected.standardRunId, `${label}.source.run_id`);
  exact(
    source.artifact,
    `opl-release-standard-checkpoint-${expected.standardRunId}`,
    `${label}.source.artifact`,
  );

  const cohort = record(value.cohort, `${label}.cohort`);
  exactKeys(cohort, ['app_sha', 'shell_sha', 'framework_sha'], `${label}.cohort`);
  exact(cohort.app_sha, expected.source.appSha, `${label}.cohort.app_sha`);
  exact(cohort.shell_sha, expected.source.shellSha, `${label}.cohort.shell_sha`);
  exact(
    cohort.framework_sha,
    expected.source.frameworkSha,
    `${label}.cohort.framework_sha`,
  );

  const release = record(value.release, `${label}.release`);
  exactKeys(release, ['version'], `${label}.release`);
  exact(release.version, expected.version, `${label}.release.version`);

  const admission = record(value.admission, `${label}.admission`);
  exactKeys(
    admission,
    ['eligible', 'reason_code', 'existing_run_id'],
    `${label}.admission`,
  );
  exact(admission.eligible, true, `${label}.admission.eligible`);
  exact(admission.reason_code, 'admitted', `${label}.admission.reason_code`);
  exact(admission.existing_run_id, null, `${label}.admission.existing_run_id`);

  const dispatch = record(value.dispatch, `${label}.dispatch`);
  exactKeys(
    dispatch,
    [
      'status',
      'run_id',
      'executor_run_head_sha',
      'run_attempt',
      'conclusion',
    ],
    `${label}.dispatch`,
  );
  exact(dispatch.status, 'dispatched', `${label}.dispatch.status`);
  exact(dispatch.run_id, expected.appendFullRunId, `${label}.dispatch.run_id`);
  exact(
    dispatch.executor_run_head_sha,
    expected.appendFullHeadSha,
    `${label}.dispatch.executor_run_head_sha`,
  );
  exact(dispatch.run_attempt, 1, `${label}.dispatch.run_attempt`);
  if (dispatch.conclusion !== null && dispatch.conclusion !== 'success') {
    throw new Error(`${label}.dispatch.conclusion must be null or success`);
  }

  const mutationScope = record(value.mutation_scope, `${label}.mutation_scope`);
  exactKeys(
    mutationScope,
    [
      'standard_assets_modified',
      'latest_modified',
      'homebrew_modified',
      'certification_blocking',
    ],
    `${label}.mutation_scope`,
  );
  for (const field of Object.keys(mutationScope)) {
    exact(mutationScope[field], false, `${label}.mutation_scope.${field}`);
  }
}

function assertAssetMatchesFile(
  asset: AssetIdentity | undefined,
  file: VerifiedFile,
  label: string,
): void {
  if (!asset) throw new Error(`${label} is absent`);
  if (asset.sizeBytes !== file.sizeBytes || asset.digest !== file.declaredDigest) {
    throw new Error(`${label} does not match its exact local bytes`);
  }
}

function assertAssetMapsEqual(
  left: Map<string, AssetIdentity>,
  right: Map<string, AssetIdentity>,
  label: string,
): void {
  if (
    left.size !== right.size
    || [...left.entries()].some(([name, identity]) => (
      !right.has(name) || !canonicalEqual(identity, right.get(name))
    ))
  ) {
    throw new Error(`${label} asset identities do not match`);
  }
}

function validateStandardManifest(
  manifest: JsonRecord,
  version: string,
  source: { appSha: string; shellSha: string; frameworkSha: string },
  inspectionAssets: Map<string, AssetIdentity>,
  checkpointAssets: Map<string, AssetIdentity>,
): {
  updaterVersion: string;
  primary: AssetIdentity;
} {
  const tag = `v${version}`;
  const identity = readAppComponentManifestIdentity(manifest, tag, false, source.appSha);
  const sourceCohort = record(manifest.source_cohort, 'Standard manifest source_cohort');
  exactKeys(sourceCohort, ['app_sha', 'shell_sha', 'framework_sha'], 'Standard manifest source_cohort');
  exact(sourceCohort.app_sha, source.appSha, 'Standard manifest source_cohort.app_sha');
  exact(sourceCohort.shell_sha, source.shellSha, 'Standard manifest source_cohort.shell_sha');
  exact(sourceCohort.framework_sha, source.frameworkSha, 'Standard manifest source_cohort.framework_sha');
  exact(
    manifest.release_url,
    `https://github.com/${APP_REPOSITORY}/releases/tag/${tag}`,
    'Standard manifest release_url',
  );
  exact(
    manifest.component_manifest_ref,
    `https://github.com/${APP_REPOSITORY}/releases/download/${tag}/opl-app-component-manifest.json`,
    'Standard manifest component_manifest_ref',
  );

  if (!Array.isArray(manifest.artifacts)) {
    throw new Error('Standard manifest artifacts must be an array');
  }
  const expectedNames = standardAssetNames(version)
    .filter((name) => name !== 'opl-app-component-manifest.json')
    .toSorted();
  const artifacts = new Map<string, { value: JsonRecord; identity: AssetIdentity }>();
  for (const [index, candidate] of manifest.artifacts.entries()) {
    const label = `Standard manifest artifacts[${index}]`;
    const artifact = record(candidate, label);
    exactKeys(artifact, ['name', 'ref', 'digest', 'size', 'content_type'], label);
    const name = string(artifact.name, `${label}.name`);
    if (artifacts.has(name)) throw new Error(`Standard manifest contains duplicate ${name}`);
    const observed: AssetIdentity = {
      name,
      sizeBytes: positiveInteger(artifact.size, `${label}.size`),
      digest: digest(artifact.digest, `${label}.digest`),
    };
    exact(
      artifact.ref,
      `https://github.com/${APP_REPOSITORY}/releases/download/${tag}/${name}`,
      `${label}.ref`,
    );
    string(artifact.content_type, `${label}.content_type`);
    const inspected = inspectionAssets.get(name);
    const checkpoint = checkpointAssets.get(name);
    if (!inspected || !checkpoint || !canonicalEqual(observed, inspected)
      || !canonicalEqual(observed, checkpoint)) {
      throw new Error(`Standard manifest artifact ${name} does not bind inspection/checkpoint identity`);
    }
    artifacts.set(name, { value: artifact, identity: observed });
  }
  exact([...artifacts.keys()].toSorted(), expectedNames, 'Standard manifest artifacts closed set');
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const primary = record(manifest.primary_artifact, 'Standard manifest primary_artifact');
  const primaryArtifact = artifacts.get(dmgName);
  if (!primaryArtifact || !canonicalEqual(primary, primaryArtifact.value)) {
    throw new Error('Standard manifest primary_artifact must be the exact canonical DMG artifact');
  }
  return {
    updaterVersion: string(identity.updater_version, 'Standard manifest updater_version'),
    primary: primaryArtifact.identity,
  };
}

function validateUpdaterMetadata(
  metadata: string,
  label: string,
  input: {
    updaterVersion: string;
    zipName: string;
    zipFile: VerifiedFile;
    dmgName: string;
    dmgFile: VerifiedFile;
  },
): void {
  let parsed: unknown;
  try {
    parsed = parseYaml(metadata);
  } catch (error) {
    throw new Error(`${label} is invalid YAML (${error instanceof Error ? error.message : String(error)})`);
  }
  const document = record(parsed, label);
  exact(document.version, input.updaterVersion, `${label}.version`);
  exact(document.path, input.zipName, `${label}.path`);
  const zipSha512 = streamedDigest(input.zipFile.path, 'sha512', 'base64');
  const dmgSha512 = streamedDigest(input.dmgFile.path, 'sha512', 'base64');
  exact(document.sha512, zipSha512, `${label}.sha512`);
  if (!Array.isArray(document.files)) throw new Error(`${label}.files must be an array`);
  const files = new Map<string, JsonRecord>();
  for (const [index, candidate] of document.files.entries()) {
    const entry = record(candidate, `${label}.files[${index}]`);
    const url = string(entry.url, `${label}.files[${index}].url`);
    if (files.has(url)) throw new Error(`${label}.files contains duplicate ${url}`);
    files.set(url, entry);
  }
  exact(
    [...files.keys()].toSorted(),
    [input.dmgName, input.zipName].toSorted(),
    `${label}.files updater asset set`,
  );
  const zipEntry = files.get(input.zipName)!;
  exact(zipEntry.sha512, zipSha512, `${label} ZIP sha512`);
  exact(zipEntry.size, input.zipFile.sizeBytes, `${label} ZIP size`);
  const dmgEntry = files.get(input.dmgName)!;
  exact(dmgEntry.sha512, dmgSha512, `${label} DMG sha512`);
  exact(dmgEntry.size, input.dmgFile.sizeBytes, `${label} DMG size`);
}

function validateFullManifest(
  manifest: JsonRecord,
  version: string,
  primaryAsset: AssetIdentity,
): void {
  exact(manifest.schema, 'opl_public_release_manifest.v1', 'Full release manifest schema');
  exact(
    manifest.package_kind,
    'opl_full_first_install_macos_arm64',
    'Full release manifest package_kind',
  );
  exact(manifest.owner_authority, 'one-person-lab-app', 'Full release manifest owner_authority');
  exact(manifest.version, version, 'Full release manifest version');
  exact(manifest.release_version, version, 'Full release manifest release_version');
  exact(
    manifest.primary_install_asset,
    primaryAsset.name,
    'Full release manifest primary_install_asset',
  );
  if (!Array.isArray(manifest.assets) || manifest.assets.length !== 1) {
    throw new Error('Full release manifest assets must contain exactly one Full DMG');
  }
  const bound = record(manifest.assets[0], 'Full release manifest primary asset');
  exactKeys(
    bound,
    ['name', 'role', 'size_bytes', 'sha256'],
    'Full release manifest primary asset',
  );
  exact(bound.name, primaryAsset.name, 'Full release manifest primary asset name');
  exact(bound.role, 'full_first_install_carrier', 'Full release manifest primary asset role');
  exact(
    bound.size_bytes,
    primaryAsset.sizeBytes,
    'Full release manifest primary asset size_bytes',
  );
  exact(bound.sha256, primaryAsset.digest, 'Full release manifest primary asset sha256');
}

function validateBuildAndQualification(
  label: 'standard' | 'full',
  buildFile: VerifiedJsonFile,
  qualificationFile: VerifiedJsonFile,
  input: {
    source: { appSha: string; shellSha: string; frameworkSha: string };
    version: string;
    releaseCohortRef: string;
    primaryAsset: AssetIdentity;
  },
): {
  build: BuildArtifactCohortV2;
  qualification: ArtifactQualificationReceiptV1;
  runId: string;
} {
  const build = buildFile.value as unknown as BuildArtifactCohortV2;
  const runId = string(build.actions?.run_id, `${label} build cohort actions.run_id`);
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`${label} build cohort actions.run_id must be a positive Actions run id`);
  }
  const buildErrors = validateArtifactCohortV2(build, {
    appSha: input.source.appSha,
    shellSha: input.source.shellSha,
    frameworkSha: input.source.frameworkSha,
    version: input.version,
    actionsRunId: runId,
    releaseCohortRef: input.releaseCohortRef,
  });
  if (buildErrors.length > 0) {
    throw new Error(`${label} build cohort is invalid: ${buildErrors.join('; ')}`);
  }
  exact(build.build.kind, label, `${label} build cohort kind`);
  exact(build.artifact.name, input.primaryAsset.name, `${label} build cohort artifact name`);
  exact(
    `sha256:${build.artifact.sha256}`,
    input.primaryAsset.digest,
    `${label} build cohort artifact sha256`,
  );
  exact(
    build.artifact.size_bytes,
    input.primaryAsset.sizeBytes,
    `${label} build cohort artifact size_bytes`,
  );
  exact(
    build.release.release_cohort_ref,
    input.releaseCohortRef,
    `${label} build cohort release_cohort_ref`,
  );

  const qualification =
    qualificationFile.value as unknown as ArtifactQualificationReceiptV1;
  const stableSessionId = digest(
    qualification.stable_session_id,
    `${label} qualification stable_session_id`,
  );
  const qualificationErrors = validateArtifactQualificationReceipt(qualification, {
    stableSessionId,
    releaseCohortRef: input.releaseCohortRef,
    version: input.version,
    packageProfile: label,
    result: 'passed',
    sourceArtifactRunId: build.actions.run_id,
    sourceArtifactName: build.actions.artifact_name,
    artifactSha256: build.artifact.sha256,
    appSha: input.source.appSha,
    shellSha: input.source.shellSha,
    frameworkSha: input.source.frameworkSha,
  });
  if (qualificationErrors.length > 0) {
    throw new Error(
      `${label} qualification receipt is invalid: ${qualificationErrors.join('; ')}`,
    );
  }
  exact(
    build.release.stable_session_id,
    stableSessionId,
    `${label} build cohort stable_session_id`,
  );
  exact(
    `sha256:${qualification.build_manifest.sha256}`,
    buildFile.declaredDigest,
    `${label} qualification build manifest sha256`,
  );
  return { build, qualification, runId };
}

function assertRemoteSourceEligibility(
  source: { appSha: string; shellSha: string; frameworkSha: string },
  options: CodexRuntimeArtifactEligibilityValidationOptions,
): void {
  if (!options.isAncestor('app', ISSUE_122_APP_PROVENANCE_FLOOR, source.appSha)) {
    throw new Error('packet.pair.source.app_sha does not descend from App PR #152');
  }
  if (!options.isAncestor('shell', ISSUE_122_SHELL_PROVENANCE_FLOOR, source.shellSha)) {
    throw new Error('packet.pair.source.shell_sha does not descend from Shell PR #34');
  }
  const remoteMainCheck = options.isRemoteMainReachable
    ?? (options.isAncestor as Partial<GitAncestryResolver>).isRemoteMainReachable;
  if (!remoteMainCheck) {
    throw new Error('Remote-main reachability verifier is required');
  }
  for (const [repository, candidate] of [
    ['app', source.appSha],
    ['shell', source.shellSha],
    ['framework', source.frameworkSha],
  ] as const) {
    if (!remoteMainCheck(repository, candidate)) {
      throw new Error(`packet.pair.source.${repository}_sha is not reachable from a remote main`);
    }
  }
}

export function validateCodexRuntimeArtifactEligibility(
  value: unknown,
  options: CodexRuntimeArtifactEligibilityValidationOptions,
): {
  schema: 'opl_codex_runtime_artifact_eligibility_validation.v1';
  status: 'passed';
  eligibility_digest: string;
  version: string;
  bundle_digest: string;
  release_cohort_ref: string;
  source: {
    app_sha: string;
    shell_sha: string;
    framework_sha: string;
    app_floor: string;
    shell_floor: string;
    ancestry_verified: true;
    remote_main_reachable: true;
  };
  operations: {
    standard_operation_id: string;
    append_full_operation_id: string;
    standard_run_id: string;
    append_full_run_id: string;
    standard_checkpoint_digest: string;
    full_checkpoint_digest: string;
    serialized_checkpoint_link_verified: true;
  };
  artifacts: {
    standard: {
      name: string;
      sha256: string;
      size_bytes: number;
      file_path: string;
    };
    full: {
      name: string;
      sha256: string;
      size_bytes: number;
      file_path: string;
    };
  };
  verified_file_count: 21;
  authority: {
    source_pins_role: 'build_provenance_only';
    may_gate_install_or_runtime: false;
    exact_cross_component_compatibility_gate: false;
  };
} {
  const packet = record(value, 'packet');
  exactKeys(
    packet,
    [
      'schema',
      'status',
      'purpose',
      'authority',
      'pair',
      'evidence',
      'standard',
      'full',
      'created_at',
    ],
    'packet',
  );
  exact(packet.schema, 'opl_codex_runtime_artifact_eligibility.v1', 'packet.schema');
  exact(packet.status, 'candidate', 'packet.status');
  exact(packet.purpose, 'issue_122_runtime_identity_evidence', 'packet.purpose');
  const createdAt = canonicalTimestamp(packet.created_at, 'packet.created_at');

  const authority = record(packet.authority, 'packet.authority');
  exactKeys(
    authority,
    [
      'source_pins_role',
      'may_gate_install_or_runtime',
      'exact_cross_component_compatibility_gate',
    ],
    'packet.authority',
  );
  exact(authority.source_pins_role, 'build_provenance_only', 'packet.authority.source_pins_role');
  exact(authority.may_gate_install_or_runtime, false, 'packet.authority.may_gate_install_or_runtime');
  exact(
    authority.exact_cross_component_compatibility_gate,
    false,
    'packet.authority.exact_cross_component_compatibility_gate',
  );

  const pair = record(packet.pair, 'packet.pair');
  exactKeys(
    pair,
    ['version', 'bundle_digest', 'release_cohort_ref', 'source'],
    'packet.pair',
  );
  const version = string(pair.version, 'packet.pair.version');
  if (!VERSION_PATTERN.test(version)) throw new Error('packet.pair.version is invalid');
  const bundleDigest = digest(pair.bundle_digest, 'packet.pair.bundle_digest');
  const releaseCohortRef = digest(
    pair.release_cohort_ref,
    'packet.pair.release_cohort_ref',
  );
  exact(releaseCohortRef, bundleDigest, 'packet.pair.release_cohort_ref');
  const sourceValue = record(pair.source, 'packet.pair.source');
  exactKeys(
    sourceValue,
    ['app_sha', 'shell_sha', 'framework_sha'],
    'packet.pair.source',
  );
  const source = {
    appSha: sha(sourceValue.app_sha, 'packet.pair.source.app_sha'),
    shellSha: sha(sourceValue.shell_sha, 'packet.pair.source.shell_sha'),
    frameworkSha: sha(sourceValue.framework_sha, 'packet.pair.source.framework_sha'),
  };
  assertRemoteSourceEligibility(source, options);

  const evidenceRoot = fs.realpathSync(options.evidenceRoot);
  const evidence = record(packet.evidence, 'packet.evidence');
  exactKeys(
    evidence,
    [
      'framework_bundle',
      'standard_checkpoint',
      'full_checkpoint',
      'standard_operation_receipt',
      'append_full_operation_receipt',
      'stable_full_successor_receipt',
      'standard_run_inspection',
      'append_full_run_inspection',
    ],
    'packet.evidence',
  );
  const frameworkBundleFile = verifiedJsonFile(
    evidence.framework_bundle,
    'packet.evidence.framework_bundle',
    evidenceRoot,
  );
  const bundleIdentity = validateFrameworkBundle(frameworkBundleFile.value, {
    version,
    bundleDigest,
    source,
  });
  const standardCheckpointFile = verifiedJsonFile(
    evidence.standard_checkpoint,
    'packet.evidence.standard_checkpoint',
    evidenceRoot,
  );
  const fullCheckpointFile = verifiedJsonFile(
    evidence.full_checkpoint,
    'packet.evidence.full_checkpoint',
    evidenceRoot,
  );
  const standardCheckpoint = validateCheckpoint(
    standardCheckpointFile,
    'Standard checkpoint',
    {
      bundleDigest,
      bundleFile: frameworkBundleFile,
      bundle: frameworkBundleFile.value,
      standardNames: bundleIdentity.standardNames,
      fullNames: bundleIdentity.fullNames,
      final: false,
    },
  );
  const fullCheckpoint = validateCheckpoint(
    fullCheckpointFile,
    'Full checkpoint',
    {
      bundleDigest,
      bundleFile: frameworkBundleFile,
      bundle: frameworkBundleFile.value,
      standardNames: bundleIdentity.standardNames,
      fullNames: bundleIdentity.fullNames,
      final: true,
    },
  );
  validateCheckpointSuccessor(standardCheckpoint, fullCheckpoint);

  const standardReceiptFile = verifiedJsonFile(
    evidence.standard_operation_receipt,
    'packet.evidence.standard_operation_receipt',
    evidenceRoot,
  );
  const appendReceiptFile = verifiedJsonFile(
    evidence.append_full_operation_receipt,
    'packet.evidence.append_full_operation_receipt',
    evidenceRoot,
  );
  const successorReceiptFile = verifiedJsonFile(
    evidence.stable_full_successor_receipt,
    'packet.evidence.stable_full_successor_receipt',
    evidenceRoot,
  );
  const standardRunInspectionFile = verifiedJsonFile(
    evidence.standard_run_inspection,
    'packet.evidence.standard_run_inspection',
    evidenceRoot,
  );
  const appendFullRunInspectionFile = verifiedJsonFile(
    evidence.append_full_run_inspection,
    'packet.evidence.append_full_run_inspection',
    evidenceRoot,
  );
  const standardRecordedAt = validateOperationReceipt(
    standardReceiptFile.value,
    'Standard operation receipt',
    {
      bundleDigest,
      releaseOperation: 'standard',
      track: 'standard',
      control: standardCheckpoint.standardControl,
    },
  );
  const appendRecordedAt = validateOperationReceipt(
    appendReceiptFile.value,
    'append_full operation receipt',
    {
      bundleDigest,
      releaseOperation: 'append_full',
      track: 'full',
      control: fullCheckpoint.appendFullControl!,
    },
  );
  if (
    Date.parse(appendRecordedAt) <= Date.parse(standardRecordedAt)
    || Date.parse(fullCheckpoint.appendFullControl!.startedAt)
      <= Date.parse(standardCheckpoint.standardControl.startedAt)
  ) {
    throw new Error('append_full operation must be a real successor of the Standard operation');
  }
  if (
    Date.parse(createdAt) < Date.parse(standardRecordedAt)
    || Date.parse(createdAt) < Date.parse(appendRecordedAt)
  ) {
    throw new Error('packet.created_at must follow both canonical operation receipts');
  }

  const standard = record(packet.standard, 'packet.standard');
  exactKeys(
    standard,
    [
      'primary_asset_name',
      'updater_asset_name',
      'updater_metadata_asset_name',
      'manifest_asset_name',
      'files',
    ],
    'packet.standard',
  );
  const standardPrimaryName = string(
    standard.primary_asset_name,
    'packet.standard.primary_asset_name',
  );
  const standardUpdaterName = string(
    standard.updater_asset_name,
    'packet.standard.updater_asset_name',
  );
  exact(
    standardPrimaryName,
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    'packet.standard.primary_asset_name',
  );
  exact(
    standardUpdaterName,
    `One-Person-Lab-${version}-mac-arm64.zip`,
    'packet.standard.updater_asset_name',
  );
  exact(
    standard.updater_metadata_asset_name,
    'latest-arm64-mac.yml',
    'packet.standard.updater_metadata_asset_name',
  );
  exact(
    standard.manifest_asset_name,
    'opl-app-component-manifest.json',
    'packet.standard.manifest_asset_name',
  );
  const standardFiles = record(standard.files, 'packet.standard.files');
  exactKeys(
    standardFiles,
    [
      'primary_artifact',
      'updater_artifact',
      'updater_blockmap',
      'updater_metadata',
      'release_manifest',
      'release_inspection',
      'build_cohort',
      'qualification_receipt',
    ],
    'packet.standard.files',
  );

  const full = record(packet.full, 'packet.full');
  exactKeys(
    full,
    ['primary_asset_name', 'manifest_asset_name', 'files'],
    'packet.full',
  );
  const fullPrimaryName = string(full.primary_asset_name, 'packet.full.primary_asset_name');
  exact(
    fullPrimaryName,
    `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
    'packet.full.primary_asset_name',
  );
  exact(full.manifest_asset_name, 'opl-release-manifest.json', 'packet.full.manifest_asset_name');
  const fullFiles = record(full.files, 'packet.full.files');
  exactKeys(
    fullFiles,
    [
      'primary_artifact',
      'release_manifest',
      'release_inspection',
      'build_cohort',
      'qualification_receipt',
    ],
    'packet.full.files',
  );

  const standardPrimaryFile = verifiedFile(
    standardFiles.primary_artifact,
    'packet.standard.files.primary_artifact',
    evidenceRoot,
  );
  const standardUpdaterFile = verifiedFile(
    standardFiles.updater_artifact,
    'packet.standard.files.updater_artifact',
    evidenceRoot,
  );
  const standardBlockmapFile = verifiedFile(
    standardFiles.updater_blockmap,
    'packet.standard.files.updater_blockmap',
    evidenceRoot,
  );
  const standardMetadataFile = verifiedYamlFile(
    standardFiles.updater_metadata,
    'packet.standard.files.updater_metadata',
    evidenceRoot,
  );
  const standardManifestFile = verifiedJsonFile(
    standardFiles.release_manifest,
    'packet.standard.files.release_manifest',
    evidenceRoot,
  );
  const standardInspectionFile = verifiedJsonFile(
    standardFiles.release_inspection,
    'packet.standard.files.release_inspection',
    evidenceRoot,
  );
  const standardBuildFile = verifiedJsonFile(
    standardFiles.build_cohort,
    'packet.standard.files.build_cohort',
    evidenceRoot,
  );
  const standardQualificationFile = verifiedJsonFile(
    standardFiles.qualification_receipt,
    'packet.standard.files.qualification_receipt',
    evidenceRoot,
  );
  const fullPrimaryFile = verifiedFile(
    fullFiles.primary_artifact,
    'packet.full.files.primary_artifact',
    evidenceRoot,
  );
  const fullManifestFile = verifiedJsonFile(
    fullFiles.release_manifest,
    'packet.full.files.release_manifest',
    evidenceRoot,
  );
  const fullInspectionFile = verifiedJsonFile(
    fullFiles.release_inspection,
    'packet.full.files.release_inspection',
    evidenceRoot,
  );
  const fullBuildFile = verifiedJsonFile(
    fullFiles.build_cohort,
    'packet.full.files.build_cohort',
    evidenceRoot,
  );
  const fullQualificationFile = verifiedJsonFile(
    fullFiles.qualification_receipt,
    'packet.full.files.qualification_receipt',
    evidenceRoot,
  );

  const fullManifestAsset = fullCheckpoint.fullAssets.get('opl-release-manifest.json')!;
  assertAssetMatchesFile(
    fullManifestAsset,
    fullManifestFile,
    'Full checkpoint manifest asset',
  );
  const expectedFullTag =
    `v${version}-full-${fullManifestFile.declaredDigest.slice('sha256:'.length, 'sha256:'.length + 12)}`;
  const standardInspection = validateReleaseInspection(
    standardInspectionFile.value,
    'Standard release inspection',
    {
      tag: `v${version}`,
      appSha: source.appSha,
      names: bundleIdentity.standardNames,
    },
  );
  validateReleaseInspection(
    assertFreshInspection(
      standardInspectionFile.value,
      options.inspectRelease(`v${version}`),
      'Standard release inspection',
    ),
    'Fresh Standard release inspection',
    {
      tag: `v${version}`,
      appSha: source.appSha,
      names: bundleIdentity.standardNames,
    },
  );
  const fullInspection = validateReleaseInspection(
    fullInspectionFile.value,
    'Full release inspection',
    {
      tag: expectedFullTag,
      appSha: source.appSha,
      names: bundleIdentity.fullNames,
    },
  );
  validateReleaseInspection(
    assertFreshInspection(
      fullInspectionFile.value,
      options.inspectRelease(expectedFullTag),
      'Full release inspection',
    ),
    'Fresh Full release inspection',
    {
      tag: expectedFullTag,
      appSha: source.appSha,
      names: bundleIdentity.fullNames,
    },
  );
  if (standardInspection.id === fullInspection.id) {
    throw new Error('Standard and Full inspections must bind distinct immutable releases');
  }
  assertAssetMapsEqual(
    standardInspection.assets,
    fullCheckpoint.standardAssets,
    'Standard inspection/final checkpoint',
  );
  assertAssetMapsEqual(
    fullInspection.assets,
    fullCheckpoint.fullAssets,
    'Full inspection/final checkpoint',
  );

  const standardManifestIdentity = validateStandardManifest(
    standardManifestFile.value,
    version,
    source,
    standardInspection.assets,
    fullCheckpoint.standardAssets,
  );
  exact(
    standardManifestIdentity.updaterVersion,
    bundleIdentity.updaterVersion,
    'Standard manifest updater_version',
  );
  assertAssetMatchesFile(
    standardManifestIdentity.primary,
    standardPrimaryFile,
    'Standard primary DMG',
  );
  assertAssetMatchesFile(
    standardInspection.assets.get('opl-app-component-manifest.json'),
    standardManifestFile,
    'Standard component manifest asset',
  );
  assertAssetMatchesFile(
    standardInspection.assets.get(standardUpdaterName),
    standardUpdaterFile,
    'Standard updater ZIP',
  );
  assertAssetMatchesFile(
    standardInspection.assets.get(`${standardUpdaterName}.blockmap`),
    standardBlockmapFile,
    'Standard updater blockmap',
  );
  assertAssetMatchesFile(
    standardInspection.assets.get('latest-arm64-mac.yml'),
    standardMetadataFile,
    'Standard updater metadata',
  );
  validateUpdaterMetadata(
    standardMetadataFile.text,
    'Standard updater metadata',
    {
      updaterVersion: bundleIdentity.updaterVersion,
      zipName: standardUpdaterName,
      zipFile: standardUpdaterFile,
      dmgName: standardPrimaryName,
      dmgFile: standardPrimaryFile,
    },
  );

  const fullPrimaryAsset = fullCheckpoint.fullAssets.get(fullPrimaryName)!;
  assertAssetMatchesFile(fullPrimaryAsset, fullPrimaryFile, 'Full primary DMG');
  validateFullManifest(fullManifestFile.value, version, fullPrimaryAsset);

  const standardValidated = validateBuildAndQualification(
    'standard',
    standardBuildFile,
    standardQualificationFile,
    {
      source,
      version,
      releaseCohortRef,
      primaryAsset: standardManifestIdentity.primary,
    },
  );
  const fullValidated = validateBuildAndQualification(
    'full',
    fullBuildFile,
    fullQualificationFile,
    {
      source,
      version,
      releaseCohortRef,
      primaryAsset: fullPrimaryAsset,
    },
  );
  if (standardValidated.runId === fullValidated.runId) {
    throw new Error('Standard and append_full Actions run ids must be distinct');
  }
  exact(
    fullValidated.qualification.stable_session_id,
    standardValidated.qualification.stable_session_id,
    'Full qualification stable_session_id',
  );
  const standardRun = validateWorkflowRunInspection(
    standardRunInspectionFile.value,
    'Standard source run inspection',
    {
      runId: standardValidated.runId,
      kind: 'standard',
      headSha: source.appSha,
    },
  );
  validateWorkflowRunInspection(
    assertFreshInspection(
      standardRunInspectionFile.value,
      options.inspectWorkflowRun(standardValidated.runId),
      'Standard source run inspection',
    ),
    'Fresh Standard source run inspection',
    {
      runId: standardValidated.runId,
      kind: 'standard',
      headSha: source.appSha,
    },
  );
  const appendFullRun = validateWorkflowRunInspection(
    appendFullRunInspectionFile.value,
    'append_full run inspection',
    {
      runId: fullValidated.runId,
      kind: 'append_full',
      sourceRunId: standardRun.runId,
    },
  );
  validateWorkflowRunInspection(
    assertFreshInspection(
      appendFullRunInspectionFile.value,
      options.inspectWorkflowRun(fullValidated.runId),
      'append_full run inspection',
    ),
    'Fresh append_full run inspection',
    {
      runId: fullValidated.runId,
      kind: 'append_full',
      sourceRunId: standardRun.runId,
    },
  );
  validateStableFullSuccessorReceipt(successorReceiptFile.value, {
    version,
    source,
    standardRunId: standardRun.runId,
    appendFullRunId: appendFullRun.runId,
    appendFullHeadSha: appendFullRun.headSha,
  });

  const allFiles = [
    frameworkBundleFile,
    standardCheckpointFile,
    fullCheckpointFile,
    standardReceiptFile,
    appendReceiptFile,
    successorReceiptFile,
    standardRunInspectionFile,
    appendFullRunInspectionFile,
    standardPrimaryFile,
    standardUpdaterFile,
    standardBlockmapFile,
    standardMetadataFile,
    standardManifestFile,
    standardInspectionFile,
    standardBuildFile,
    standardQualificationFile,
    fullPrimaryFile,
    fullManifestFile,
    fullInspectionFile,
    fullBuildFile,
    fullQualificationFile,
  ];
  if (new Set(allFiles.map((file) => file.path)).size !== allFiles.length) {
    throw new Error('Eligibility evidence roles must reference 21 distinct regular files');
  }

  return {
    schema: 'opl_codex_runtime_artifact_eligibility_validation.v1',
    status: 'passed',
    eligibility_digest: digestCodexRuntimeArtifactEligibilityPacket(packet),
    version,
    bundle_digest: bundleDigest,
    release_cohort_ref: releaseCohortRef,
    source: {
      app_sha: source.appSha,
      shell_sha: source.shellSha,
      framework_sha: source.frameworkSha,
      app_floor: ISSUE_122_APP_PROVENANCE_FLOOR,
      shell_floor: ISSUE_122_SHELL_PROVENANCE_FLOOR,
      ancestry_verified: true,
      remote_main_reachable: true,
    },
    operations: {
      standard_operation_id: standardCheckpoint.standardControl.operationId,
      append_full_operation_id: fullCheckpoint.appendFullControl!.operationId,
      standard_run_id: standardValidated.runId,
      append_full_run_id: fullValidated.runId,
      standard_checkpoint_digest: standardCheckpoint.checkpointDigest,
      full_checkpoint_digest: fullCheckpoint.checkpointDigest,
      serialized_checkpoint_link_verified: true,
    },
    artifacts: {
      standard: {
        name: standardUpdaterName,
        sha256: standardUpdaterFile.declaredDigest,
        size_bytes: standardUpdaterFile.sizeBytes,
        file_path: string(
          record(
            standardFiles.updater_artifact,
            'packet.standard.files.updater_artifact',
          ).path,
          'packet.standard.files.updater_artifact.path',
        ),
      },
      full: {
        name: fullPrimaryName,
        sha256: fullPrimaryFile.declaredDigest,
        size_bytes: fullPrimaryFile.sizeBytes,
        file_path: string(
          record(fullFiles.primary_artifact, 'packet.full.files.primary_artifact').path,
          'packet.full.files.primary_artifact.path',
        ),
      },
    },
    verified_file_count: 21,
    authority: {
      source_pins_role: 'build_provenance_only',
      may_gate_install_or_runtime: false,
      exact_cross_component_compatibility_gate: false,
    },
  };
}

function gitResult(root: string, args: string[]) {
  return spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
}

function ghApiJson(endpoint: string): JsonRecord {
  const result = spawnSync('gh', ['api', endpoint], {
    encoding: 'utf8',
    timeout: 30_000,
    killSignal: 'SIGTERM',
    maxBuffer: MAX_JSON_BYTES,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(
      `Fresh GitHub read failed for ${endpoint}: ${
        result.stderr.trim()
        || result.stdout.trim()
        || result.error?.message
        || `exit ${String(result.status)}`
      }`,
    );
  }
  try {
    return record(JSON.parse(result.stdout), `GitHub response for ${endpoint}`);
  } catch (error) {
    throw new Error(
      `GitHub response for ${endpoint} is not JSON (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }
}

export function inspectCanonicalGitHubWorkflowRun(runId: string): JsonRecord {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error('GitHub workflow run id must be a positive decimal string');
  }
  const raw = ghApiJson(`repos/${APP_REPOSITORY}/actions/runs/${runId}`);
  const repository = record(raw.repository, 'GitHub workflow run repository');
  const headRepository = record(
    raw.head_repository,
    'GitHub workflow run head_repository',
  );
  return {
    surface_kind: 'opl_app_github_actions_run_inspection.v1',
    repository: APP_REPOSITORY,
    run: {
      id: raw.id,
      repository: repository.full_name,
      head_repository: headRepository.full_name,
      path: raw.path,
      event: raw.event,
      head_branch: raw.head_branch,
      head_sha: raw.head_sha,
      run_attempt: raw.run_attempt,
      status: raw.status,
      conclusion: raw.conclusion,
      display_title: raw.display_title,
    },
  };
}

export function inspectCanonicalGitHubReleaseReadback(tag: string): JsonRecord {
  return inspectCanonicalGitHubRelease(APP_REPOSITORY, tag);
}

function sourceRepositoryName(repository: SourceRepository): string {
  if (repository === 'app') return APP_REPOSITORY;
  if (repository === 'shell') return SHELL_REPOSITORY;
  return FRAMEWORK_REPOSITORY;
}

function liveRemoteMainHead(repository: SourceRepository): string {
  const repositoryName = sourceRepositoryName(repository);
  const ref = ghApiJson(`repos/${repositoryName}/git/ref/heads/main`);
  return sha(
    record(ref.object, `${repository} remote main object`).sha,
    `${repository} remote main SHA`,
  );
}

function defaultFrameworkRepo(appRepo: string): string {
  const commonDir = gitResult(appRepo, [
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
  ]);
  if (commonDir.status === 0) {
    const common = commonDir.stdout.trim();
    const canonicalApp = path.basename(common) === '.git'
      ? path.dirname(common)
      : path.resolve(appRepo);
    return path.resolve(path.dirname(canonicalApp), 'one-person-lab');
  }
  return path.resolve(appRepo, '..', 'one-person-lab');
}

export function createGitAncestryResolver(input: {
  appRepo: string;
  shellRepo: string;
  frameworkRepo?: string;
}): GitAncestryResolver {
  const roots: Record<SourceRepository, string> = {
    app: path.resolve(input.appRepo),
    shell: path.resolve(input.shellRepo),
    framework: path.resolve(input.frameworkRepo ?? defaultFrameworkRepo(input.appRepo)),
  };
  const resolver = ((
    repository: SourceRepository,
    ancestorSha: string,
    candidateSha: string,
  ) => {
    const result = gitResult(
      roots[repository],
      ['merge-base', '--is-ancestor', ancestorSha, candidateSha],
    );
    if (result.status === 0) return true;
    if (result.status === 1) return false;
    throw new Error(
      `git ancestry check failed for ${repository}: ${result.stderr || result.stdout || `exit ${String(result.status)}`}`,
    );
  }) as GitAncestryResolver;
  resolver.isRemoteMainReachable = (repository, candidateSha) => {
    const wireHead = liveRemoteMainHead(repository);
    if (wireHead === candidateSha) return true;
    const wireObject = gitResult(
      roots[repository],
      ['cat-file', '-e', `${wireHead}^{commit}`],
    );
    if (wireObject.status !== 0) {
      const repositoryUrl =
        `https://github.com/${sourceRepositoryName(repository)}.git`;
      const fetch = gitResult(
        roots[repository],
        ['fetch', '--no-tags', '--quiet', repositoryUrl, 'refs/heads/main'],
      );
      if (fetch.status !== 0) {
        throw new Error(
          `fresh remote-main fetch failed for ${repository}: ${
            fetch.stderr || fetch.stdout || `exit ${String(fetch.status)}`
          }`,
        );
      }
    }
    return resolver(repository, candidateSha, wireHead);
  };
  return resolver;
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      input: { type: 'string' },
      'app-repo': { type: 'string' },
      'shell-repo': { type: 'string' },
      'framework-repo': { type: 'string' },
    },
  });
  if (!values.input || !values['app-repo'] || !values['shell-repo']) {
    throw new Error(
      'Usage: codex-runtime-artifact-eligibility.ts --input <packet.json> --app-repo <repo> --shell-repo <repo> [--framework-repo <repo>]',
    );
  }
  const inputPath = path.resolve(values.input);
  const packet = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as unknown;
  const ancestry = createGitAncestryResolver({
    appRepo: values['app-repo'],
    shellRepo: values['shell-repo'],
    frameworkRepo: values['framework-repo'],
  });
  const result = validateCodexRuntimeArtifactEligibility(packet, {
    evidenceRoot: path.dirname(inputPath),
    isAncestor: ancestry,
    inspectRelease: inspectCanonicalGitHubReleaseReadback,
    inspectWorkflowRun: inspectCanonicalGitHubWorkflowRun,
  });
  process.stdout.write(`${JSON.stringify({ input: inputPath, ...result })}\n`);
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
