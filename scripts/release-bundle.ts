#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  validateArtifactCohortV2,
  type BuildArtifactCohortV2,
} from './build-artifact-cohort.ts';
import {
  validateArtifactQualificationReceipt,
  type ArtifactQualificationReceiptV1,
} from './artifact-qualification-receipt.ts';
import { fileSha256 } from './release-file-helpers.ts';
import {
  assertCanonicalReleaseVersion,
  type AppReleaseChannel,
} from './release-version.ts';

const digestPattern = /^[0-9a-f]{64}$/;
const digestRefPattern = /^sha256:[0-9a-f]{64}$/;
const gitShaPattern = /^[0-9a-f]{40}$/;
const builderRunIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const maxJsonBytes = 16 * 1024 * 1024;
const maxNotesBytes = 2 * 1024 * 1024;

const standardAssetNames = (version: string) => [
  `One-Person-Lab-${version}-mac-arm64.dmg`,
  `One-Person-Lab-${version}-mac-arm64.zip`,
  `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
  'latest-arm64-mac.yml',
  'opl-app-component-manifest.json',
  'standard-local-authorization-policy.json',
] as const;

const fullAssetNames = (version: string) => [
  `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
  'opl-release-manifest.json',
] as const;

type JsonRecord = Record<string, unknown>;
type BuilderExecutor = 'local' | 'github_actions';

export type ReleaseBundleInputV1 = {
  schema: 'opl_app_release_bundle_input.v1';
  channel: AppReleaseChannel;
  version: string;
  release_cohort_ref: string;
  cohort: {
    app_sha: string;
    shell_sha: string;
    framework_sha: string;
    opl_flow_sha: string;
  };
  builders: {
    standard: {
      executor: BuilderExecutor;
      run_id: string;
    };
    full?: {
      executor: BuilderExecutor;
      run_id: string;
    };
  };
};

export type ReleaseBundleAssetV1 = {
  name: string;
  size_bytes: number;
  sha256: string;
};

export type ReleaseBundleQualifiedTrackV1 = {
  status: 'qualified';
  builder: {
    executor: BuilderExecutor;
    run_id: string;
  };
  build_artifact_cohort: {
    schema: 'opl_app_build_artifact_cohort.v2';
    sha256: string;
  };
  qualification_receipt: {
    schema: 'opl_app_artifact_qualification_receipt.v1';
    status: 'passed';
    sha256: string;
  };
  provenance: {
    sha256: string;
  };
  assets: ReleaseBundleAssetV1[];
};

export type ReleaseBundleV1 = {
  schema: 'opl_app_release_bundle.v1';
  bundle_id: string;
  release: {
    channel: AppReleaseChannel;
    version: string;
    tag: string;
    prerelease: boolean;
    release_cohort_ref: string;
    source_input_sha256: string;
  };
  cohort: ReleaseBundleInputV1['cohort'];
  toolchain: {
    manifest_sha256: string;
  };
  notes: {
    source: 'prepared_ai';
    format: 'markdown';
    markdown_sha256: string;
    evidence_schema: 'opl_app_release_notes_evidence.v1';
    evidence_sha256: string;
  };
  tracks: {
    standard: ReleaseBundleQualifiedTrackV1;
    full: ReleaseBundleQualifiedTrackV1 | { status: 'absent' };
  };
  policy: {
    latest: {
      eligible: boolean;
      required_track: 'standard';
      full_required: false;
    };
    full: {
      mode: 'same_cohort_additive_only';
      updater_metadata_allowed: false;
    };
    updater: {
      track: 'standard';
      metadata_asset: 'latest-arm64-mac.yml';
    };
  };
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertRecord(value: unknown, label: string): asserts value is JsonRecord {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object.`);
}

function assertExactKeys(
  value: JsonRecord,
  label: string,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const actual = Object.keys(value).sort();
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !(key in value));
  const extra = actual.filter((key) => !allowed.has(key));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${label} has an invalid closed shape; missing=[${missing.join(',')}], extra=[${extra.join(',')}].`,
    );
  }
}

function assertDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !digestPattern.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
}

function assertDigestRef(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !digestRefPattern.test(value)) {
    throw new Error(`${label} must be a lowercase sha256:<digest> ref.`);
  }
}

function assertGitSha(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !gitShaPattern.test(value)) {
    throw new Error(`${label} must be an exact lowercase 40-character Git SHA.`);
  }
}

function assertBuilder(value: unknown, label: string): asserts value is {
  executor: BuilderExecutor;
  run_id: string;
} {
  assertRecord(value, label);
  assertExactKeys(value, label, ['executor', 'run_id']);
  if (value.executor !== 'local' && value.executor !== 'github_actions') {
    throw new Error(`${label}.executor must be local or github_actions.`);
  }
  if (typeof value.run_id !== 'string' || !builderRunIdPattern.test(value.run_id)) {
    throw new Error(`${label}.run_id must be a bounded opaque run identity.`);
  }
}

function assertRegularFile(filePath: string, label: string, maximumBytes?: number): fs.Stats {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    throw new Error(`${label} is missing: ${filePath}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file and must not be a symlink: ${filePath}`);
  }
  if (stat.size <= 0) throw new Error(`${label} must not be empty: ${filePath}`);
  if (maximumBytes !== undefined && stat.size > maximumBytes) {
    throw new Error(`${label} exceeds the ${maximumBytes}-byte bound: ${filePath}`);
  }
  return stat;
}

function assertRealDirectory(directoryPath: string, label: string): void {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(directoryPath);
  } catch {
    throw new Error(`${label} is missing: ${directoryPath}`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory and must not be a symlink: ${directoryPath}`);
  }
}

function assertDirectoryEntries(
  directoryPath: string,
  expectedNames: readonly string[],
  label: string,
): fs.Dirent[] {
  assertRealDirectory(directoryPath, label);
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const actualNames = entries.map((entry) => entry.name).sort();
  const sortedExpected = [...expectedNames].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(sortedExpected)) {
    throw new Error(
      `${label} must be an exact closed directory; expected=[${sortedExpected.join(',')}], actual=[${actualNames.join(',')}].`,
    );
  }
  return entries;
}

function readJson(filePath: string, label: string): unknown {
  assertRegularFile(filePath, label, maxJsonBytes);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertReleaseBundleInput(value: unknown): asserts value is ReleaseBundleInputV1 {
  assertRecord(value, 'release-input.json');
  assertExactKeys(value, 'release-input.json', [
    'schema',
    'channel',
    'version',
    'release_cohort_ref',
    'cohort',
    'builders',
  ]);
  if (value.schema !== 'opl_app_release_bundle_input.v1') {
    throw new Error(`release-input.json schema is ${String(value.schema)}.`);
  }
  if (value.channel !== 'stable' && value.channel !== 'nightly') {
    throw new Error('release-input.json channel must be stable or nightly.');
  }
  if (typeof value.version !== 'string') throw new Error('release-input.json version is missing.');
  assertCanonicalReleaseVersion(value.channel, value.version);
  assertDigestRef(value.release_cohort_ref, 'release-input.json release_cohort_ref');

  assertRecord(value.cohort, 'release-input.json cohort');
  assertExactKeys(value.cohort, 'release-input.json cohort', [
    'app_sha',
    'shell_sha',
    'framework_sha',
    'opl_flow_sha',
  ]);
  for (const key of ['app_sha', 'shell_sha', 'framework_sha', 'opl_flow_sha'] as const) {
    assertGitSha(value.cohort[key], `release-input.json cohort.${key}`);
  }

  assertRecord(value.builders, 'release-input.json builders');
  assertExactKeys(value.builders, 'release-input.json builders', ['standard'], ['full']);
  assertBuilder(value.builders.standard, 'release-input.json builders.standard');
  if (value.builders.full !== undefined) {
    assertBuilder(value.builders.full, 'release-input.json builders.full');
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  const record = value as JsonRecord;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(',')}}`;
}

function sha256Text(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function bundleCore(bundle: ReleaseBundleV1): Omit<ReleaseBundleV1, 'bundle_id'> {
  const { bundle_id: _bundleId, ...core } = bundle;
  return core;
}

function computeBundleId(core: Omit<ReleaseBundleV1, 'bundle_id'>): string {
  return `sha256:${sha256Text(canonicalJson(core))}`;
}

function assertNoErrors(label: string, errors: string[]): void {
  if (errors.length > 0) throw new Error(`${label} is invalid: ${errors.join('; ')}`);
}

function readTrackAssets(
  trackRoot: string,
  expectedNames: readonly string[],
  label: string,
): ReleaseBundleAssetV1[] {
  const assetsRoot = path.join(trackRoot, 'assets');
  const entries = assertDirectoryEntries(assetsRoot, expectedNames, `${label} assets`);
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`${label} asset must be a regular file and must not be a symlink: ${entry.name}`);
    }
  }
  return expectedNames.map((name) => {
    const assetPath = path.join(assetsRoot, name);
    const stat = assertRegularFile(assetPath, `${label} asset ${name}`);
    return { name, size_bytes: stat.size, sha256: fileSha256(assetPath) };
  });
}

function assembleQualifiedTrack(
  input: ReleaseBundleInputV1,
  inputRoot: string,
  kind: 'standard' | 'full',
): ReleaseBundleQualifiedTrackV1 {
  const trackRoot = path.join(inputRoot, kind);
  const builder = input.builders[kind];
  if (!builder) throw new Error(`${kind} builder identity is missing.`);
  assertDirectoryEntries(trackRoot, [
    'assets',
    'build-artifact-cohort.json',
    'qualification-receipt.json',
    'provenance.json',
  ], `${kind} track`);
  const expectedNames = kind === 'standard'
    ? standardAssetNames(input.version)
    : fullAssetNames(input.version);
  const assets = readTrackAssets(trackRoot, expectedNames, kind);
  const dmgName = expectedNames[0];
  const dmgPath = path.join(trackRoot, 'assets', dmgName);
  const cohortPath = path.join(trackRoot, 'build-artifact-cohort.json');
  const receiptPath = path.join(trackRoot, 'qualification-receipt.json');
  const provenancePath = path.join(trackRoot, 'provenance.json');
  const cohort = readJson(cohortPath, `${kind} build artifact cohort`) as BuildArtifactCohortV2;
  const receipt = readJson(receiptPath, `${kind} qualification receipt`) as ArtifactQualificationReceiptV1;
  const provenance = readJson(provenancePath, `${kind} provenance`);
  assertRecord(provenance, `${kind} provenance`);
  if (Object.keys(provenance).length === 0) throw new Error(`${kind} provenance must not be empty.`);

  assertNoErrors(`${kind} build artifact cohort`, validateArtifactCohortV2(cohort, {
    appSha: input.cohort.app_sha,
    shellSha: input.cohort.shell_sha,
    frameworkSha: input.cohort.framework_sha,
    version: input.version,
    artifactPath: dmgPath,
    actionsRunId: builder.run_id,
    releaseCohortRef: input.release_cohort_ref,
  }));
  if (cohort.build.kind !== kind) {
    throw new Error(`${kind} build artifact cohort kind is ${String(cohort.build.kind)}.`);
  }
  if (!cohort.release.stable_session_id) {
    throw new Error(`${kind} build artifact cohort is not bound to a release session.`);
  }
  if (cohort.artifact.name !== dmgName) {
    throw new Error(`${kind} build artifact cohort names ${cohort.artifact.name}, expected ${dmgName}.`);
  }

  const cohortSha256 = fileSha256(cohortPath);
  assertNoErrors(`${kind} qualification receipt`, validateArtifactQualificationReceipt(receipt, {
    stableSessionId: cohort.release.stable_session_id,
    releaseCohortRef: input.release_cohort_ref,
    version: input.version,
    packageProfile: kind,
    result: 'passed',
    sourceArtifactRunId: builder.run_id,
    sourceArtifactName: cohort.actions.artifact_name,
    artifactSha256: cohort.artifact.sha256,
    appSha: input.cohort.app_sha,
    shellSha: input.cohort.shell_sha,
    frameworkSha: input.cohort.framework_sha,
    qualificationInputManifestDigest: cohort.digests.qualification_input_manifest_sha256,
    ...(kind === 'full' ? {
      fullInputManifestDigest: cohort.digests.full_input_manifest_sha256,
      frameworkBundledCatalogDigest: cohort.digests.framework_bundled_catalog_sha256,
      fullToolchainObservationReceiptDigest: cohort.digests.full_toolchain_observation_receipt_sha256,
    } : {}),
  }));
  if (receipt.build_manifest.sha256 !== cohortSha256) {
    throw new Error(`${kind} qualification receipt is not bound to the exact build artifact cohort bytes.`);
  }
  if (
    receipt.artifact.name !== cohort.artifact.name ||
    receipt.artifact.size_bytes !== cohort.artifact.size_bytes
  ) {
    throw new Error(`${kind} qualification receipt artifact identity does not match the build cohort.`);
  }

  return {
    status: 'qualified',
    builder: { executor: builder.executor, run_id: builder.run_id },
    build_artifact_cohort: {
      schema: 'opl_app_build_artifact_cohort.v2',
      sha256: cohortSha256,
    },
    qualification_receipt: {
      schema: 'opl_app_artifact_qualification_receipt.v1',
      status: 'passed',
      sha256: fileSha256(receiptPath),
    },
    provenance: { sha256: fileSha256(provenancePath) },
    assets,
  };
}

function assertNotesEvidence(
  evidence: unknown,
  input: ReleaseBundleInputV1,
): void {
  assertRecord(evidence, 'notes-evidence.json');
  if (evidence.schema !== 'opl_app_release_notes_evidence.v1') {
    throw new Error(`notes-evidence.json schema is ${String(evidence.schema)}.`);
  }
  if (evidence.version !== input.version || evidence.channel !== input.channel) {
    throw new Error('notes-evidence.json version/channel does not match release-input.json.');
  }
  if (evidence.current_tag !== `v${input.version}`) {
    throw new Error('notes-evidence.json current_tag does not match the release version.');
  }
  if (evidence.release_title !== `One Person Lab v${input.version}`) {
    throw new Error('notes-evidence.json release_title does not match the release version.');
  }
}

export function assembleReleaseBundle(inputDirectory: string): ReleaseBundleV1 {
  const inputRoot = path.resolve(inputDirectory);
  assertRealDirectory(inputRoot, 'Release Bundle input');
  const releaseInputPath = path.join(inputRoot, 'release-input.json');
  const toolchainPath = path.join(inputRoot, 'toolchain.json');
  const notesPath = path.join(inputRoot, 'notes.md');
  const notesEvidencePath = path.join(inputRoot, 'notes-evidence.json');
  const input = readJson(releaseInputPath, 'release-input.json');
  assertReleaseBundleInput(input);
  assertDirectoryEntries(inputRoot, [
    'notes-evidence.json',
    'notes.md',
    'release-input.json',
    'standard',
    'toolchain.json',
    ...(input.builders.full ? ['full'] : []),
  ], 'Release Bundle input');

  const toolchain = readJson(toolchainPath, 'toolchain.json');
  assertRecord(toolchain, 'toolchain.json');
  if (typeof toolchain.schema !== 'string' || !toolchain.schema) {
    throw new Error('toolchain.json must declare its source schema.');
  }
  assertRegularFile(notesPath, 'notes.md', maxNotesBytes);
  const notes = fs.readFileSync(notesPath, 'utf8').trim();
  if (!notes.includes(`One Person Lab v${input.version}`)) {
    throw new Error('notes.md does not contain the exact release title.');
  }
  const notesEvidence = readJson(notesEvidencePath, 'notes-evidence.json');
  assertNotesEvidence(notesEvidence, input);

  const standard = assembleQualifiedTrack(input, inputRoot, 'standard');
  const full = input.builders.full
    ? assembleQualifiedTrack(input, inputRoot, 'full')
    : { status: 'absent' as const };
  const core: Omit<ReleaseBundleV1, 'bundle_id'> = {
    schema: 'opl_app_release_bundle.v1',
    release: {
      channel: input.channel,
      version: input.version,
      tag: `v${input.version}`,
      prerelease: input.channel === 'nightly',
      release_cohort_ref: input.release_cohort_ref,
      source_input_sha256: fileSha256(releaseInputPath),
    },
    cohort: { ...input.cohort },
    toolchain: { manifest_sha256: fileSha256(toolchainPath) },
    notes: {
      source: 'prepared_ai',
      format: 'markdown',
      markdown_sha256: fileSha256(notesPath),
      evidence_schema: 'opl_app_release_notes_evidence.v1',
      evidence_sha256: fileSha256(notesEvidencePath),
    },
    tracks: { standard, full },
    policy: {
      latest: {
        eligible: input.channel === 'stable',
        required_track: 'standard',
        full_required: false,
      },
      full: {
        mode: 'same_cohort_additive_only',
        updater_metadata_allowed: false,
      },
      updater: {
        track: 'standard',
        metadata_asset: 'latest-arm64-mac.yml',
      },
    },
  };
  const bundle: ReleaseBundleV1 = { ...core, bundle_id: computeBundleId(core) };
  const errors = validateReleaseBundle(bundle);
  if (errors.length > 0) throw new Error(`Assembled Release Bundle is invalid: ${errors.join('; ')}`);
  return bundle;
}

function validateAssetSet(
  assets: unknown,
  expectedNames: readonly string[],
  label: string,
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(assets)) return [`${label}.assets must be an array`];
  const names: string[] = [];
  for (const [index, assetValue] of assets.entries()) {
    if (!isRecord(assetValue)) {
      errors.push(`${label}.assets[${index}] must be an object`);
      continue;
    }
    try {
      assertExactKeys(assetValue, `${label}.assets[${index}]`, ['name', 'size_bytes', 'sha256']);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    if (typeof assetValue.name !== 'string') errors.push(`${label}.assets[${index}].name is invalid`);
    else names.push(assetValue.name);
    if (!Number.isSafeInteger(assetValue.size_bytes) || Number(assetValue.size_bytes) <= 0) {
      errors.push(`${label}.assets[${index}].size_bytes is invalid`);
    }
    if (typeof assetValue.sha256 !== 'string' || !digestPattern.test(assetValue.sha256)) {
      errors.push(`${label}.assets[${index}].sha256 is invalid`);
    }
  }
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    errors.push(`${label}.assets is not the exact ordered public asset set`);
  }
  return errors;
}

function validateQualifiedTrack(
  value: unknown,
  expectedNames: readonly string[],
  label: string,
): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return [`${label} must be an object`];
  try {
    assertExactKeys(value, label, [
      'status',
      'builder',
      'build_artifact_cohort',
      'qualification_receipt',
      'provenance',
      'assets',
    ]);
    if (value.status !== 'qualified') errors.push(`${label}.status is not qualified`);
    assertBuilder(value.builder, `${label}.builder`);
    for (const [key, schema] of [
      ['build_artifact_cohort', 'opl_app_build_artifact_cohort.v2'],
      ['qualification_receipt', 'opl_app_artifact_qualification_receipt.v1'],
    ] as const) {
      const ref = value[key];
      assertRecord(ref, `${label}.${key}`);
      assertExactKeys(
        ref,
        `${label}.${key}`,
        key === 'qualification_receipt' ? ['schema', 'status', 'sha256'] : ['schema', 'sha256'],
      );
      if (ref.schema !== schema) errors.push(`${label}.${key}.schema is invalid`);
      if (key === 'qualification_receipt' && ref.status !== 'passed') {
        errors.push(`${label}.qualification_receipt.status is not passed`);
      }
      assertDigest(ref.sha256, `${label}.${key}.sha256`);
    }
    assertRecord(value.provenance, `${label}.provenance`);
    assertExactKeys(value.provenance, `${label}.provenance`, ['sha256']);
    assertDigest(value.provenance.sha256, `${label}.provenance.sha256`);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  errors.push(...validateAssetSet(value.assets, expectedNames, label));
  return errors;
}

export function validateReleaseBundle(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['Release Bundle must be a JSON object'];
  const bundle = value as unknown as ReleaseBundleV1;
  try {
    assertExactKeys(value, 'Release Bundle', [
      'schema',
      'bundle_id',
      'release',
      'cohort',
      'toolchain',
      'notes',
      'tracks',
      'policy',
    ]);
    if (bundle.schema !== 'opl_app_release_bundle.v1') errors.push(`schema is ${String(bundle.schema)}`);
    assertDigestRef(bundle.bundle_id, 'bundle_id');

    assertRecord(bundle.release, 'release');
    assertExactKeys(bundle.release, 'release', [
      'channel',
      'version',
      'tag',
      'prerelease',
      'release_cohort_ref',
      'source_input_sha256',
    ]);
    if (bundle.release.channel !== 'stable' && bundle.release.channel !== 'nightly') {
      errors.push('release.channel is invalid');
    } else {
      assertCanonicalReleaseVersion(bundle.release.channel, bundle.release.version);
    }
    if (bundle.release.tag !== `v${bundle.release.version}`) errors.push('release.tag is inconsistent');
    if (bundle.release.prerelease !== (bundle.release.channel === 'nightly')) {
      errors.push('release.prerelease is inconsistent');
    }
    assertDigestRef(bundle.release.release_cohort_ref, 'release.release_cohort_ref');
    assertDigest(bundle.release.source_input_sha256, 'release.source_input_sha256');

    assertRecord(bundle.cohort, 'cohort');
    assertExactKeys(bundle.cohort, 'cohort', ['app_sha', 'shell_sha', 'framework_sha', 'opl_flow_sha']);
    for (const key of ['app_sha', 'shell_sha', 'framework_sha', 'opl_flow_sha'] as const) {
      assertGitSha(bundle.cohort[key], `cohort.${key}`);
    }

    assertRecord(bundle.toolchain, 'toolchain');
    assertExactKeys(bundle.toolchain, 'toolchain', ['manifest_sha256']);
    assertDigest(bundle.toolchain.manifest_sha256, 'toolchain.manifest_sha256');

    assertRecord(bundle.notes, 'notes');
    assertExactKeys(bundle.notes, 'notes', [
      'source',
      'format',
      'markdown_sha256',
      'evidence_schema',
      'evidence_sha256',
    ]);
    if (bundle.notes.source !== 'prepared_ai' || bundle.notes.format !== 'markdown') {
      errors.push('notes source/format is invalid');
    }
    if (bundle.notes.evidence_schema !== 'opl_app_release_notes_evidence.v1') {
      errors.push('notes evidence schema is invalid');
    }
    assertDigest(bundle.notes.markdown_sha256, 'notes.markdown_sha256');
    assertDigest(bundle.notes.evidence_sha256, 'notes.evidence_sha256');

    assertRecord(bundle.tracks, 'tracks');
    assertExactKeys(bundle.tracks, 'tracks', ['standard', 'full']);
    errors.push(...validateQualifiedTrack(
      bundle.tracks.standard,
      standardAssetNames(bundle.release.version),
      'tracks.standard',
    ));
    if (isRecord(bundle.tracks.full) && bundle.tracks.full.status === 'absent') {
      assertExactKeys(bundle.tracks.full, 'tracks.full', ['status']);
    } else {
      errors.push(...validateQualifiedTrack(
        bundle.tracks.full,
        fullAssetNames(bundle.release.version),
        'tracks.full',
      ));
    }

    assertRecord(bundle.policy, 'policy');
    assertExactKeys(bundle.policy, 'policy', ['latest', 'full', 'updater']);
    assertRecord(bundle.policy.latest, 'policy.latest');
    assertExactKeys(bundle.policy.latest, 'policy.latest', ['eligible', 'required_track', 'full_required']);
    if (
      bundle.policy.latest.eligible !== (bundle.release.channel === 'stable') ||
      bundle.policy.latest.required_track !== 'standard' ||
      bundle.policy.latest.full_required !== false
    ) errors.push('policy.latest is inconsistent');
    assertRecord(bundle.policy.full, 'policy.full');
    assertExactKeys(bundle.policy.full, 'policy.full', ['mode', 'updater_metadata_allowed']);
    if (
      bundle.policy.full.mode !== 'same_cohort_additive_only' ||
      bundle.policy.full.updater_metadata_allowed !== false
    ) errors.push('policy.full is inconsistent');
    assertRecord(bundle.policy.updater, 'policy.updater');
    assertExactKeys(bundle.policy.updater, 'policy.updater', ['track', 'metadata_asset']);
    if (
      bundle.policy.updater.track !== 'standard' ||
      bundle.policy.updater.metadata_asset !== 'latest-arm64-mac.yml'
    ) errors.push('policy.updater is inconsistent');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (errors.length === 0) {
    const expectedBundleId = computeBundleId(bundleCore(bundle));
    if (bundle.bundle_id !== expectedBundleId) errors.push(`bundle_id expected ${expectedBundleId}`);
  }
  return errors;
}

function bundleStatus(bundle: ReleaseBundleV1, contentVerification: 'bundle_only' | 'exact_input'): JsonRecord {
  return {
    schema: 'opl_app_release_bundle_status.v1',
    status: 'passed',
    bundle_id: bundle.bundle_id,
    channel: bundle.release.channel,
    version: bundle.release.version,
    tag: bundle.release.tag,
    prerelease: bundle.release.prerelease,
    latest_eligible: bundle.policy.latest.eligible,
    standard: {
      status: bundle.tracks.standard.status,
      executor: bundle.tracks.standard.builder.executor,
      asset_count: bundle.tracks.standard.assets.length,
    },
    full: bundle.tracks.full.status === 'qualified'
      ? {
          status: 'qualified',
          executor: bundle.tracks.full.builder.executor,
          asset_count: bundle.tracks.full.assets.length,
        }
      : { status: 'absent', executor: null, asset_count: 0 },
    updater_track: bundle.policy.updater.track,
    content_verification: contentVerification,
  };
}

function readBundle(bundlePath: string): ReleaseBundleV1 {
  const bundle = readJson(path.resolve(bundlePath), 'Release Bundle');
  const errors = validateReleaseBundle(bundle);
  if (errors.length > 0) throw new Error(`Release Bundle is invalid: ${errors.join('; ')}`);
  return bundle as ReleaseBundleV1;
}

function writeJsonAtomic(outputPath: string, value: unknown): void {
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
    fs.renameSync(temporary, resolved);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function main(): void {
  const { values, positionals } = parseArgs({
    options: {
      input: { type: 'string' },
      output: { type: 'string' },
      bundle: { type: 'string' },
    },
    strict: true,
    allowPositionals: true,
  });
  const [command, ...extra] = positionals;
  if (extra.length > 0 || !['assemble', 'verify', 'status'].includes(command || '')) {
    throw new Error('Usage: release:bundle <assemble|verify|status> [--input <dir>] [--output <file>] [--bundle <file>].');
  }
  if (command === 'assemble') {
    if (!values.input || !values.output || values.bundle) {
      throw new Error('assemble requires --input <dir> and --output <bundle.json>.');
    }
    const bundle = assembleReleaseBundle(values.input);
    writeJsonAtomic(values.output, bundle);
    process.stdout.write(`${JSON.stringify(bundleStatus(bundle, 'exact_input'))}\n`);
    return;
  }
  if (!values.bundle || values.output) {
    throw new Error(`${command} requires --bundle <bundle.json>.`);
  }
  const bundle = readBundle(values.bundle);
  let contentVerification: 'bundle_only' | 'exact_input' = 'bundle_only';
  if (command === 'verify' && values.input) {
    const expected = assembleReleaseBundle(values.input);
    if (canonicalJson(bundle) !== canonicalJson(expected)) {
      throw new Error('Release Bundle does not match the exact input bytes.');
    }
    contentVerification = 'exact_input';
  } else if (command === 'status' && values.input) {
    throw new Error('status does not accept --input; use verify for exact-byte verification.');
  }
  process.stdout.write(`${JSON.stringify(bundleStatus(bundle, contentVerification))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
