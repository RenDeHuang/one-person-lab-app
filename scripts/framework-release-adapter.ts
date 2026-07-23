#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  validateArtifactQualificationReceipt,
  type ArtifactQualificationReceiptV1,
} from './artifact-qualification-receipt.ts';
import { assertUpdaterVersionMatchesDisplay } from './release-version.ts';
import {
  releaseOperationDeadlineTimestamp,
  remainingReleaseOperationMilliseconds,
} from './release-operation-deadline.ts';
import { assertStandardLatestAdmissionReceipt } from './validate-standard-latest-admission.ts';

type JsonRecord = Record<string, any>;
type Track = 'standard' | 'webui' | 'full';
type StableReleaseOperation = 'standard' | 'resume_standard' | 'append_full';
type AdapterOptionValues = Record<string, string | boolean | string[] | undefined>;

const packageIds = [
  'mas',
  'mag',
  'rca',
  'oma',
  'obf',
  'mas-scholar-skills',
  'opl-flow',
] as const;
const aiNotesMarker = '<!-- OPL_RELEASE_NOTES_GENERATOR:online-ai -->';
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const appStandardIdentityMode = 'app_standard_compatibility';
const packageCompatibility = {
  abi: 'opl_packages.v1',
  version_range: '>=0.1.0 <1.0.0',
} as const;
const frozenBuildInputIds = [
  'app_source',
  'base_image',
  'codex_cli',
  'dockerfile',
  'framework_seed',
  'qualification_harness',
  'shell_webui_source',
] as const;

function readJson(filePath: string): JsonRecord {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected a regular JSON file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256Bytes(bytes: Buffer | string): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(filePath: string): string {
  return sha256Bytes(fs.readFileSync(filePath));
}

function regularFileBytes(filePath: string, label: string): Buffer {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`${label} must be a non-empty regular file: ${filePath}`);
  }
  return fs.readFileSync(filePath);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function exactJson(left: unknown, right: unknown, label: string): void {
  if (canonicalJson(left) !== canonicalJson(right)) throw new Error(`${label} does not match the frozen Bundle.`);
}

function gitArchiveDescriptor(root: string, ref: string, id: string): JsonRecord {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `opl-${id}-archive-`));
  const archivePath = path.join(tempRoot, 'source.tar');
  const archiveFd = fs.openSync(archivePath, 'w');
  try {
    const result = spawnSync('git', ['-C', root, 'archive', '--format=tar', ref], {
      stdio: ['ignore', archiveFd, 'pipe'],
    });
    if (result.status !== 0) {
      throw new Error(`Cannot materialize deterministic ${id} archive at ${ref}: ${String(result.stderr).trim()}`);
    }
    const bytes = regularFileBytes(archivePath, `${id} archive`);
    return { id, ref, digest: digestRef(sha256Bytes(bytes)), size_bytes: bytes.byteLength };
  } finally {
    fs.closeSync(archiveFd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function gitFileBytes(root: string, ref: string, relativePath: string, label: string): Buffer {
  const normalized = relativePath.split(path.sep).join('/');
  if (!normalized || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error(`${label} path escapes its exact checkout: ${relativePath}`);
  }
  const result = spawnSync('git', ['-C', root, 'show', `${ref}:${normalized}`], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || result.stdout.byteLength === 0) {
    throw new Error(`Cannot read exact ${label} bytes at ${ref}:${normalized}: ${String(result.stderr).trim()}`);
  }
  return result.stdout;
}

function fileDescriptor(id: string, ref: string, bytes: Buffer): JsonRecord {
  return { id, ref, digest: digestRef(sha256Bytes(bytes)), size_bytes: bytes.byteLength };
}

function verifyCodexTarball(tarballPath: string, expectedVersion: string): Buffer {
  const bytes = regularFileBytes(tarballPath, 'Frozen Codex tarball');
  const listing = spawnSync('tar', ['-tzf', tarballPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (listing.status !== 0) throw new Error(`Frozen Codex tarball is unreadable: ${listing.stderr.trim()}`);
  const identities = listing.stdout
    .split(/\r?\n/)
    .map((entry) => entry.replace(/^\.\//, ''))
    .filter((entry) => entry === 'package/package.json');
  if (identities.length !== 1) throw new Error('Frozen Codex tarball must contain exactly one package/package.json.');
  const identity = spawnSync('tar', ['-xOzf', tarballPath, 'package/package.json'], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (identity.status !== 0) throw new Error(`Cannot read frozen Codex package identity: ${identity.stderr.trim()}`);
  const packageJson = JSON.parse(identity.stdout) as JsonRecord;
  if (packageJson.name !== '@openai/codex' || packageJson.version !== expectedVersion) {
    throw new Error('Frozen Codex tarball package identity does not match the exact Shell intake contract.');
  }
  return bytes;
}

function digestRef(digest: string): string {
  return digest.startsWith('sha256:') ? digest : `sha256:${digest}`;
}

function gitSha(root: string): string {
  const result = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0 || !/^[0-9a-f]{40}$/.test(result.stdout.trim())) {
    throw new Error(`Cannot resolve exact Git SHA for ${root}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function requiredAssetNames(version: string, track: Track): string[] {
  if (track === 'standard') {
    return [
        `One-Person-Lab-${version}-mac-arm64.dmg`,
        `One-Person-Lab-${version}-mac-arm64.zip`,
        `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
        'latest-arm64-mac.yml',
        'opl-app-component-manifest.json',
        'standard-local-authorization-policy.json',
      ];
  }
  if (track === 'webui') return ['opl-webui-carrier.json'];
  return [`One-Person-Lab-Full-${version}-mac-arm64.dmg`, 'opl-release-manifest.json'];
}

function requireOption(values: AdapterOptionValues, key: string): string {
  const value = values[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing --${key}.`);
  return value.trim();
}

function requireBooleanOption(values: AdapterOptionValues, key: string): boolean {
  const value = requireOption(values, key);
  if (value !== 'true' && value !== 'false') throw new Error(`--${key} must be true or false.`);
  return value === 'true';
}

function parseCommon(argv: string[]) {
  return parseArgs({
    args: argv,
    options: {
      channel: { type: 'string' },
      version: { type: 'string' },
      'updater-version': { type: 'string' },
      'app-root': { type: 'string' },
      'shell-root': { type: 'string' },
      'framework-root': { type: 'string' },
      notes: { type: 'string' },
      'notes-evidence': { type: 'string' },
      'include-full-package': { type: 'string' },
      'package-compatibility-abi': { type: 'string' },
      'package-compatibility-version-range': { type: 'string' },
      'source-cutoff-observed-at': { type: 'string' },
      'base-image-index': { type: 'string' },
      'frozen-codex-tarball': { type: 'string' },
      output: { type: 'string' },
      operation: { type: 'string' },
      'release-operation': { type: 'string' },
      'operation-id': { type: 'string' },
      executor: { type: 'string' },
      'attempt-id': { type: 'string' },
      'remote-target': { type: 'string' },
      'prior-attempt-id': { type: 'string' },
      'publication-scope': { type: 'string' },
      bundle: { type: 'string' },
      track: { type: 'string' },
      outcome: { type: 'string' },
      'assets-dir': { type: 'string' },
      inspection: { type: 'string' },
      'legacy-qualification': { type: 'string' },
      'webui-build-input': { type: 'string' },
      'webui-carrier': { type: 'string' },
      'evidence-ref': { type: 'string', multiple: true },
      status: { type: 'string' },
      repo: { type: 'string' },
      tag: { type: 'string' },
      name: { type: 'string' },
      plan: { type: 'string' },
      prerelease: { type: 'boolean' },
      'operation-started-at': { type: 'string' },
      'operation-deadline-at': { type: 'string' },
      'latest-admission': { type: 'string' },
      'run-attempt': { type: 'string' },
    },
    allowPositionals: true,
    strict: true,
  });
}

function frozenBaseImageDescriptor(indexPath: string): JsonRecord {
  const index = readJson(path.resolve(indexPath));
  const manifests = Array.isArray(index.manifests) ? index.manifests : [];
  const linuxAmd64 = manifests.filter((descriptor: JsonRecord) => (
    descriptor?.platform?.os === 'linux'
    && descriptor?.platform?.architecture === 'amd64'
    && (descriptor?.platform?.variant === undefined || descriptor.platform.variant === '')
  ));
  if (linuxAmd64.length !== 1) {
    throw new Error('Frozen node base index must contain exactly one linux/amd64 descriptor without a variant.');
  }
  const descriptor = linuxAmd64[0];
  if (!digestPattern.test(String(descriptor.digest ?? ''))
    || !Number.isSafeInteger(descriptor.size)
    || Number(descriptor.size) <= 0) {
    throw new Error('Frozen node base linux/amd64 descriptor has no exact digest and positive manifest size.');
  }
  return {
    id: 'base_image',
    ref: `docker.io/library/node@${descriptor.digest}`,
    digest: descriptor.digest,
    size_bytes: Number(descriptor.size),
  };
}

function frozenBuildInputs(input: {
  values: AdapterOptionValues;
  appRoot: string;
  appRef: string;
  shellRoot: string;
  shellRef: string;
  frameworkRoot: string;
  frameworkRef: string;
}): JsonRecord[] {
  const dockerfileRef = 'Dockerfile';
  const dockerfileBytes = gitFileBytes(input.shellRoot, input.shellRef, dockerfileRef, 'Shell Dockerfile');
  const dockerfile = dockerfileBytes.toString('utf8');
  if (!dockerfile.includes('FROM node:22-bookworm-slim')) {
    throw new Error('Exact Shell Dockerfile no longer contains FROM node:22-bookworm-slim.');
  }
  const intakeBytes = gitFileBytes(
    input.shellRoot,
    input.shellRef,
    'contracts/aionui-upstream-intake.json',
    'Shell upstream intake contract',
  );
  const intake = JSON.parse(intakeBytes.toString('utf8')) as JsonRecord;
  if (intake.managed_runtime?.codex_cli?.package !== '@openai/codex') {
    throw new Error('Shell intake contract does not bind @openai/codex.');
  }
  const codexVersion = String(intake.managed_runtime?.codex_cli?.version ?? '');
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(codexVersion)) {
    throw new Error('Shell intake contract does not bind an exact Codex version.');
  }
  const codexBytes = verifyCodexTarball(
    path.resolve(requireOption(input.values, 'frozen-codex-tarball')),
    codexVersion,
  );
  const qualificationHarnessRef = 'scripts/validate-webui-runtime-image.ts';
  const qualificationHarnessBytes = gitFileBytes(
    input.appRoot,
    input.appRef,
    qualificationHarnessRef,
    'WebUI qualification harness',
  );
  const descriptors = [
    gitArchiveDescriptor(input.appRoot, input.appRef, 'app_source'),
    frozenBaseImageDescriptor(requireOption(input.values, 'base-image-index')),
    fileDescriptor('codex_cli', `@openai/codex@${codexVersion}`, codexBytes),
    fileDescriptor('dockerfile', 'shells/aionui/Dockerfile', dockerfileBytes),
    gitArchiveDescriptor(input.frameworkRoot, input.frameworkRef, 'framework_seed'),
    fileDescriptor('qualification_harness', qualificationHarnessRef, qualificationHarnessBytes),
    gitArchiveDescriptor(input.shellRoot, input.shellRef, 'shell_webui_source'),
  ];
  const ids = descriptors.map((descriptor) => descriptor.id);
  if (ids.some((id, index) => id !== frozenBuildInputIds[index]) || new Set(ids).size !== ids.length) {
    throw new Error('Frozen WebUI build inputs are not the canonical App Standard exact-seven ordered set.');
  }
  for (const descriptor of descriptors) {
    if (typeof descriptor.ref !== 'string' || descriptor.ref.length === 0
      || !digestPattern.test(String(descriptor.digest ?? ''))
      || !Number.isSafeInteger(descriptor.size_bytes)
      || Number(descriptor.size_bytes) <= 0) {
      throw new Error(`Frozen WebUI build input ${descriptor.id} has no exact ref/digest/size identity.`);
    }
  }
  return descriptors;
}

function buildFreezeRequest(values: AdapterOptionValues): JsonRecord {
  const channel = requireOption(values, 'channel');
  if (channel !== 'stable' && channel !== 'nightly') throw new Error('--channel must be stable or nightly.');
  const version = requireOption(values, 'version');
  const updaterVersion = requireOption(values, 'updater-version');
  assertUpdaterVersionMatchesDisplay(channel, version, updaterVersion);
  const appRoot = path.resolve(requireOption(values, 'app-root'));
  const shellRoot = path.resolve(requireOption(values, 'shell-root'));
  const frameworkRoot = path.resolve(requireOption(values, 'framework-root'));
  const notesPath = path.resolve(requireOption(values, 'notes'));
  const evidencePath = path.resolve(requireOption(values, 'notes-evidence'));
  requireBooleanOption(values, 'include-full-package');
  if (
    requireOption(values, 'package-compatibility-abi') !== packageCompatibility.abi
    || requireOption(values, 'package-compatibility-version-range') !== packageCompatibility.version_range
  ) {
    throw new Error('App Standard Package compatibility must use the supported typed ABI and range.');
  }
  const preparedNotes = fs.readFileSync(notesPath, 'utf8');
  if (!preparedNotes.includes(aiNotesMarker)) {
    throw new Error('Prepared release notes are not bound to the online AI writer.');
  }
  const notesEvidence = readJson(evidencePath);
  if (notesEvidence.schema !== 'opl_app_release_notes_evidence.v1') {
    throw new Error('Prepared release notes evidence has an unsupported schema.');
  }
  if (notesEvidence.payload?.include_full_package !== false) {
    throw new Error(
      'App Standard prepared notes must not bind a future Full Package payload.',
    );
  }
  const appRef = gitSha(appRoot);
  const shellRef = gitSha(shellRoot);
  const frameworkRef = gitSha(frameworkRoot);
  if (
    notesEvidence.payload?.full_payload_authority_sha256 !== undefined
    && notesEvidence.payload?.full_payload_authority_sha256 !== null
  ) {
    throw new Error('App Standard prepared notes cannot bind a Full payload authority digest.');
  }
  const observedAt = requireOption(values, 'source-cutoff-observed-at');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(observedAt)
    || Number.isNaN(Date.parse(observedAt))) {
    throw new Error('Source cutoff observed_at must be a canonical UTC timestamp with milliseconds.');
  }
  const frozenInputs = frozenBuildInputs({
    values,
    appRoot,
    appRef,
    shellRoot,
    shellRef,
    frameworkRoot,
    frameworkRef,
  });
  return {
    surface_kind: 'opl_release_bundle_freeze_request.v1',
    schema_ref: 'contracts/opl-framework/release-bundle-freeze-request.schema.json',
    release: {
      channel,
      version,
      display_version: version,
      updater_version: updaterVersion,
      tag: `v${version}`,
      prerelease: channel === 'nightly',
    },
    sources: {
      app: { repo: 'gaofeng21cn/one-person-lab-app', source_commit: appRef },
      shell: { repo: 'gaofeng21cn/opl-aion-shell', source_commit: shellRef },
      framework: { repo: 'gaofeng21cn/one-person-lab', source_commit: frameworkRef },
    },
    identity_mode: appStandardIdentityMode,
    package_compatibility: packageCompatibility,
    prepared_notes: {
      source: 'prepared_ai',
      format: 'markdown',
      markdown: preparedNotes,
      evidence: notesEvidence,
    },
    tracks: {
      standard: {
        required_asset_names: requiredAssetNames(version, 'standard'),
        required_for_latest: true,
        additive_only: false,
        updater_metadata_allowed: true,
      },
      webui: {
        required_asset_names: requiredAssetNames(version, 'webui'),
        required_for_latest: true,
        additive_only: false,
        updater_metadata_allowed: false,
      },
      full: {
        required_asset_names: requiredAssetNames(version, 'full'),
        required_for_latest: false,
        additive_only: true,
        updater_metadata_allowed: false,
      },
    },
    source_cutoff: {
      observed_at: observedAt,
      policy: 'single_read_at_freeze_admission',
      frozen_base_release_set: null,
      post_freeze_remote_refresh_allowed: false,
      later_authority_advancement_invalidates_bundle: false,
    },
    frozen_build_inputs: frozenInputs,
  };
}

function qualificationCohort(bundle: JsonRecord): JsonRecord {
  const sources = {
    app_sha: bundle.sources.app.source_commit,
    shell_sha: bundle.sources.shell.source_commit,
    framework_sha: bundle.sources.framework.source_commit,
  };
  if (bundle.identity_mode === appStandardIdentityMode) {
    exactJson(
      bundle.package_compatibility,
      packageCompatibility,
      'App Standard Package compatibility',
    );
    return {
      ...sources,
      identity_mode: appStandardIdentityMode,
      package_compatibility: packageCompatibility,
    };
  }
  return {
    ...sources,
    framework_release_set_digest: bundle.framework_release_set.digest,
    package_payload_manifest_sha256: Object.fromEntries(
      packageIds.map((packageId) => [packageId, bundle.packages[packageId].payload_manifest_sha256]),
    ),
  };
}

function bundleDocument(bundlePath: string): JsonRecord {
  const bundle = readJson(path.resolve(bundlePath));
  if (bundle.surface_kind !== 'opl_release_bundle.v1' || typeof bundle.bundle_digest !== 'string') {
    throw new Error('Bundle must be an opl_release_bundle.v1 document.');
  }
  return bundle;
}

function buildExecutorReceipt(values: AdapterOptionValues): JsonRecord {
  const operation = requireOption(values, 'operation');
  const releaseOperation = requireOption(values, 'release-operation') as StableReleaseOperation;
  const operationId = requireOption(values, 'operation-id');
  const executor = requireOption(values, 'executor');
  const attemptId = requireOption(values, 'attempt-id');
  const remoteTarget = requireOption(values, 'remote-target');
  const priorAttemptId = typeof values['prior-attempt-id'] === 'string'
    ? requireOption(values, 'prior-attempt-id')
    : null;
  const track = requireOption(values, 'track') as Track;
  const outcome = requireOption(values, 'outcome');
  if (operation !== 'build' && operation !== 'remote_inspect') throw new Error('Invalid executor operation.');
  if (!['standard', 'resume_standard', 'append_full'].includes(releaseOperation)) {
    throw new Error('Invalid release operation.');
  }
  if (executor !== 'local' && executor !== 'remote') throw new Error('Invalid executor.');
  if (track !== 'standard' && track !== 'webui' && track !== 'full') throw new Error('Invalid track.');
  if (outcome !== 'complete' && outcome !== 'unknown') throw new Error('Invalid outcome.');
  if (
    ((track === 'standard' || track === 'webui') && releaseOperation === 'append_full')
    || (track === 'full' && releaseOperation !== 'append_full')
  ) {
    throw new Error('Release operation does not match the executor receipt track.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(operationId)) {
    throw new Error('--operation-id is not canonical.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(attemptId)) {
    throw new Error('--attempt-id is not canonical.');
  }
  if (priorAttemptId !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(priorAttemptId)) {
    throw new Error('--prior-attempt-id is not canonical.');
  }
  if (!/^[a-z][a-z0-9+.-]{0,31}:[A-Za-z0-9][A-Za-z0-9._~:/?#@!$&'()*+,;=%-]*$/.test(remoteTarget)) {
    throw new Error('--remote-target is not canonical.');
  }
  const publicationScope = values['publication-scope'];
  if (operation === 'build' && publicationScope !== undefined) {
    throw new Error('Build executor receipts must not carry --publication-scope.');
  }
  if (
    operation === 'remote_inspect'
    && publicationScope !== 'track_assets'
    && publicationScope !== 'external_target'
  ) {
    throw new Error('Remote inspection requires --publication-scope track_assets or external_target.');
  }
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  const requiredNames = bundle.tracks?.[track]?.required_asset_names;
  if (!Array.isArray(requiredNames) || requiredNames.some((name) => typeof name !== 'string')) {
    throw new Error(`Bundle ${track} track has no closed required_asset_names.`);
  }
  let assets: JsonRecord[] = [];
  if (outcome === 'complete' && operation === 'build') {
    const root = path.resolve(requireOption(values, 'assets-dir'));
    assets = requiredNames.map((name: string) => {
      const filePath = path.join(root, name);
      const stat = fs.lstatSync(filePath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
        throw new Error(`Invalid ${track} asset: ${filePath}`);
      }
      return { name, size_bytes: stat.size, sha256: digestRef(sha256File(filePath)), path: filePath };
    });
  } else if (
    outcome === 'complete'
    && operation === 'remote_inspect'
    && publicationScope === 'track_assets'
  ) {
    const inspection = readJson(path.resolve(requireOption(values, 'inspection')));
    const inspectedAssets = Array.isArray(inspection.assets) ? inspection.assets : [];
    const remoteAssets = new Map(inspectedAssets.map((asset: JsonRecord) => [asset.name, asset]));
    if (remoteAssets.size !== inspectedAssets.length
      || remoteAssets.size !== requiredNames.length
      || requiredNames.some((name: string) => !remoteAssets.has(name))) {
      throw new Error(`Remote ${track} inspection does not contain the exact unique required asset set.`);
    }
    assets = requiredNames.map((name: string) => {
      const asset = remoteAssets.get(name) as JsonRecord;
      if (!Number.isSafeInteger(asset.size_bytes) || Number(asset.size_bytes) <= 0
        || !digestPattern.test(String(asset.sha256 ?? ''))) {
        throw new Error(`Remote ${track} asset ${name} has no exact digest and positive size.`);
      }
      return { name, size_bytes: asset.size_bytes, sha256: asset.sha256 };
    });
  }
  return {
    surface_kind: 'opl_release_bundle_executor_receipt.v1',
    schema_ref: 'contracts/opl-framework/release-bundle-executor-receipt.schema.json',
    operation,
    executor,
    attempt_id: attemptId,
    bundle_digest: bundle.bundle_digest,
    track,
    outcome,
    release_operation: releaseOperation,
    operation_id: operationId,
    remote_target: remoteTarget,
    prior_attempt_id: priorAttemptId,
    ...(operation === 'remote_inspect' ? { publication_scope: publicationScope } : {}),
    assets,
  };
}

function exactObjectKeys(value: JsonRecord, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} does not contain the exact contract fields.`);
  }
}

function exactString(value: unknown, expected: string, label: string): void {
  if (value !== expected) throw new Error(`${label} does not match the frozen identity.`);
}

function webuiQualificationReceipt(values: AdapterOptionValues, bundle: JsonRecord): JsonRecord {
  const buildInputPath = path.resolve(requireOption(values, 'webui-build-input'));
  const carrierPath = path.resolve(requireOption(values, 'webui-carrier'));
  const buildInputBytes = regularFileBytes(buildInputPath, 'WebUI build input');
  const carrierBytes = regularFileBytes(carrierPath, 'WebUI carrier receipt');
  const buildInput = JSON.parse(buildInputBytes.toString('utf8')) as JsonRecord;
  const carrier = JSON.parse(carrierBytes.toString('utf8')) as JsonRecord;
  exactObjectKeys(
    buildInput,
    ['schema', 'release', 'source_cutoff', 'cohort', 'platform', 'inputs', 'content_fingerprint'],
    'WebUI build input',
  );
  exactString(buildInput.schema, 'opl_app_webui_build_input.v1', 'WebUI build input schema');
  const expectedRelease = {
    version: bundle.release.version,
    bundle_digest: bundle.bundle_digest,
    cohort_ref: bundle.bundle_digest,
  };
  const expectedCohort = {
    app_sha: bundle.sources.app.source_commit,
    shell_sha: bundle.sources.shell.source_commit,
    framework_sha: bundle.sources.framework.source_commit,
  };
  exactJson(buildInput.release, expectedRelease, 'WebUI build input release');
  exactJson(buildInput.source_cutoff, bundle.source_cutoff, 'WebUI build input source cutoff');
  exactJson(buildInput.cohort, expectedCohort, 'WebUI build input cohort');
  exactJson(buildInput.platform, { os: 'linux', architecture: 'amd64' }, 'WebUI build input platform');
  exactJson(buildInput.inputs, bundle.frozen_build_inputs, 'WebUI build input exact descriptors');
  const ids = Array.isArray(buildInput.inputs)
    ? buildInput.inputs.map((descriptor: JsonRecord) => descriptor?.id)
    : [];
  if (ids.some((id: string, index: number) => id !== frozenBuildInputIds[index])
    || ids.length !== frozenBuildInputIds.length
    || new Set(ids).size !== ids.length) {
    throw new Error('WebUI build input must preserve the canonical unique App Standard exact-seven descriptor order.');
  }
  for (const descriptor of buildInput.inputs as JsonRecord[]) {
    exactObjectKeys(descriptor, ['id', 'ref', 'digest', 'size_bytes'], `WebUI build input ${descriptor.id}`);
    if (typeof descriptor.ref !== 'string' || descriptor.ref.trim() === ''
      || !digestPattern.test(String(descriptor.digest ?? ''))
      || !Number.isSafeInteger(descriptor.size_bytes)
      || Number(descriptor.size_bytes) <= 0) {
      throw new Error(`WebUI build input ${descriptor.id} has no exact ref/digest/size identity.`);
    }
  }
  const inputCore = {
    schema: buildInput.schema,
    release: buildInput.release,
    source_cutoff: buildInput.source_cutoff,
    cohort: buildInput.cohort,
    platform: buildInput.platform,
    inputs: buildInput.inputs,
  };
  const fingerprint = digestRef(sha256Bytes(canonicalJson(inputCore)));
  exactString(buildInput.content_fingerprint, fingerprint, 'WebUI build input content fingerprint');
  const buildInputDigest = digestRef(sha256Bytes(buildInputBytes));

  exactObjectKeys(
    carrier,
    ['schema', 'release', 'source_cutoff', 'cohort', 'build_input', 'carrier', 'qualification'],
    'WebUI carrier receipt',
  );
  exactString(carrier.schema, 'opl_app_webui_release_carrier.v1', 'WebUI carrier schema');
  exactJson(carrier.release, expectedRelease, 'WebUI carrier release');
  exactJson(carrier.source_cutoff, bundle.source_cutoff, 'WebUI carrier source cutoff');
  exactJson(carrier.cohort, expectedCohort, 'WebUI carrier cohort');
  exactObjectKeys(
    carrier.build_input,
    ['schema', 'manifest_digest', 'content_fingerprint'],
    'WebUI carrier build input',
  );
  exactObjectKeys(
    carrier.carrier,
    [
      'carrier_id',
      'carrier_kind',
      'package_profile',
      'ref',
      'digest',
      'size_bytes',
      'content_fingerprint',
      'os',
      'architecture',
    ],
    'WebUI carrier identity',
  );
  exactObjectKeys(
    carrier.qualification,
    [
      'schema',
      'status',
      'build_stage',
      'qualification_stage',
      'image_digest',
      'build_input_digest',
      'content_fingerprint',
      'runtime_summary_sha256',
      'registry_readback_sha256',
      'runtime_image_id',
    ],
    'WebUI qualification',
  );
  exactString(carrier.build_input?.schema, 'opl_app_webui_build_input.v1', 'WebUI carrier build input schema');
  exactString(carrier.build_input?.manifest_digest, buildInputDigest, 'WebUI carrier build input digest');
  exactString(carrier.build_input?.content_fingerprint, fingerprint, 'WebUI carrier content fingerprint');
  exactString(carrier.carrier?.carrier_id, 'docker_webui', 'WebUI carrier id');
  exactString(carrier.carrier?.carrier_kind, 'oci_image', 'WebUI carrier kind');
  exactString(carrier.carrier?.package_profile, 'webui-full', 'WebUI carrier profile');
  exactString(carrier.carrier?.os, 'linux', 'WebUI carrier OS');
  exactString(carrier.carrier?.architecture, 'amd64', 'WebUI carrier architecture');
  if (!Number.isSafeInteger(carrier.carrier?.size_bytes) || Number(carrier.carrier.size_bytes) <= 0) {
    throw new Error('WebUI carrier image size must be a positive integer.');
  }
  const imageRef = String(carrier.carrier?.ref ?? '');
  const imageDigest = String(carrier.carrier?.digest ?? '');
  const imageRefParts = imageRef.split('@');
  if (imageRefParts.length !== 2
    || !/^ghcr\.io\/[a-z0-9][a-z0-9._/-]*[a-z0-9]$/.test(imageRefParts[0])
    || imageRefParts[1] !== imageDigest
    || !digestPattern.test(imageDigest)) {
    throw new Error('WebUI carrier ref and digest do not bind the same immutable OCI image.');
  }
  exactString(carrier.carrier?.content_fingerprint, fingerprint, 'WebUI carrier image fingerprint');
  exactString(carrier.qualification?.schema, 'opl_app_webui_runtime_qualification.v1', 'WebUI qualification schema');
  exactString(carrier.qualification?.status, 'passed', 'WebUI qualification status');
  exactString(carrier.qualification?.build_stage, 'webui_built', 'WebUI build stage');
  exactString(carrier.qualification?.qualification_stage, 'webui_qualified', 'WebUI qualification stage');
  exactString(carrier.qualification?.image_digest, imageDigest, 'WebUI qualified image digest');
  exactString(carrier.qualification?.build_input_digest, buildInputDigest, 'WebUI qualification build input digest');
  exactString(carrier.qualification?.content_fingerprint, fingerprint, 'WebUI qualification fingerprint');
  for (const field of ['runtime_summary_sha256', 'registry_readback_sha256'] as const) {
    if (!digestPattern.test(String(carrier.qualification?.[field] ?? ''))) {
      throw new Error(`WebUI qualification ${field} is not an exact digest.`);
    }
  }
  if (typeof carrier.qualification?.runtime_image_id !== 'string'
    || !digestPattern.test(carrier.qualification.runtime_image_id)) {
    throw new Error('WebUI qualification runtime image id is not an exact digest.');
  }
  const requiredNames = bundle.tracks?.webui?.required_asset_names;
  if (!Array.isArray(requiredNames)
    || requiredNames.length !== 1
    || requiredNames[0] !== 'opl-webui-carrier.json'
    || path.basename(carrierPath) !== requiredNames[0]) {
    throw new Error('WebUI carrier receipt is not the Bundle exact required asset.');
  }
  const evidenceRefs = values['evidence-ref'];
  const requiredEvidenceFiles = [
    'build-input.json',
    'carrier-receipt.json',
    'registry-readback.json',
    'runtime-summary.json',
  ];
  const evidenceBases = Array.isArray(evidenceRefs)
    ? evidenceRefs.map((ref) => ref.slice(0, ref.lastIndexOf('#')))
    : [];
  const evidenceFiles = Array.isArray(evidenceRefs)
    ? evidenceRefs.map((ref) => ref.slice(ref.lastIndexOf('#') + 1)).sort()
    : [];
  if (!Array.isArray(evidenceRefs)
    || evidenceRefs.length !== requiredEvidenceFiles.length
    || new Set(evidenceRefs).size !== evidenceRefs.length
    || evidenceRefs.some((ref) => !/^[a-z][a-z0-9+.-]{0,31}:[^\s#]+#[^\s#]+$/.test(ref))
    || new Set(evidenceBases).size !== 1
    || evidenceFiles.some((file, index) => file !== requiredEvidenceFiles[index])) {
    throw new Error('WebUI qualification requires the exact four durable carrier evidence refs.');
  }
  const harness = (bundle.frozen_build_inputs as JsonRecord[])
    .find((descriptor) => descriptor.id === 'qualification_harness');
  if (!harness || !digestPattern.test(String(harness.digest ?? ''))) {
    throw new Error('Bundle has no exact frozen qualification harness descriptor.');
  }
  return {
    surface_kind: 'opl_release_bundle_qualification_receipt.v1',
    schema_ref: 'contracts/opl-framework/release-bundle-qualification-receipt.schema.json',
    bundle_digest: bundle.bundle_digest,
    track: 'webui',
    subject: {
      asset_name: requiredNames[0],
      size_bytes: carrierBytes.byteLength,
      sha256: digestRef(sha256Bytes(carrierBytes)),
    },
    cohort: qualificationCohort(bundle),
    qualification: {
      kind: 'installed_artifact',
      result: 'passed',
      installed_artifact_same_bytes: true,
      harness_sha256: harness.digest,
      evidence_refs: evidenceRefs,
    },
  };
}

function buildQualificationReceipt(values: AdapterOptionValues): JsonRecord {
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  const track = requireOption(values, 'track') as Track;
  if (track === 'webui') return webuiQualificationReceipt(values, bundle);
  if (track !== 'standard' && track !== 'full') throw new Error('--track must be standard, webui, or full.');
  const legacyPath = path.resolve(requireOption(values, 'legacy-qualification'));
  const legacy = readJson(legacyPath) as ArtifactQualificationReceiptV1;
  const packageProfile = track;
  const artifactSha256 = String(legacy.artifact?.sha256 ?? '').replace(/^sha256:/, '');
  const validationErrors = validateArtifactQualificationReceipt(legacy, {
    stableSessionId: bundle.bundle_digest,
    releaseCohortRef: bundle.bundle_digest,
    version: bundle.release.version,
    packageProfile,
    result: 'passed',
    artifactSha256,
    appSha: bundle.sources.app.source_commit,
    shellSha: bundle.sources.shell.source_commit,
    frameworkSha: bundle.sources.framework.source_commit,
  });
  if (validationErrors.length > 0) {
    throw new Error(`Legacy qualification receipt does not bind this Bundle: ${validationErrors.join('; ')}`);
  }
  const requiredNames = bundle.tracks?.[track]?.required_asset_names;
  const subjectName = String(legacy.artifact?.name ?? '');
  if (!Array.isArray(requiredNames) || !requiredNames.includes(subjectName)) {
    throw new Error(`Qualified artifact ${subjectName || '<missing>'} is not a required ${track} Bundle asset.`);
  }
  const sizeBytes = Number(legacy.artifact?.size_bytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error('Legacy qualification receipt has no positive artifact size.');
  }
  const harnessSha256 = legacy.verification_harness?.smoke_harness_sha256
    ?? legacy.build_manifest?.smoke_harness_sha256;
  const evidenceRef = legacy.qualification?.evidence_ref;
  if (typeof harnessSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(harnessSha256)) {
    throw new Error('Legacy qualification receipt has no valid smoke harness digest.');
  }
  if (typeof evidenceRef !== 'string' || evidenceRef.trim() === '') {
    throw new Error('Legacy qualification receipt has no durable evidence ref.');
  }
  return {
    surface_kind: 'opl_release_bundle_qualification_receipt.v1',
    schema_ref: 'contracts/opl-framework/release-bundle-qualification-receipt.schema.json',
    bundle_digest: bundle.bundle_digest,
    track,
    subject: {
      asset_name: subjectName,
      size_bytes: sizeBytes,
      sha256: digestRef(artifactSha256),
    },
    cohort: qualificationCohort(bundle),
    qualification: {
      kind: 'installed_artifact',
      result: 'passed',
      installed_artifact_same_bytes: true,
      harness_sha256: digestRef(harnessSha256),
      evidence_refs: [evidenceRef],
    },
  };
}

const githubReadTimeoutMs = 30_000;
const githubMutationTimeoutMs = 10 * 60_000;

export interface GitHubCommandResult {
  status: number | null;
  signal?: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface GitHubCommandOptions {
  input?: string;
  timeout: number;
  killSignal: NodeJS.Signals;
}

export interface GitHubAdapterRuntime {
  run(command: string, args: string[], options: GitHubCommandOptions): GitHubCommandResult;
  now(): number;
  readTimeoutMs?: number;
  mutationTimeoutMs?: number;
}

const defaultGitHubRuntime: GitHubAdapterRuntime = {
  run(command, args, options) {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      input: options.input,
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
      timeout: options.timeout,
      killSignal: options.killSignal,
    });
    return {
      status: result.status,
      signal: result.signal,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      error: result.error,
    };
  },
  now: () => Date.now(),
};

function commandEvidence(
  args: string[],
  input: string | undefined,
  result: GitHubCommandResult | undefined,
  timeoutMs: number,
): JsonRecord {
  const errorCode = (result?.error as NodeJS.ErrnoException | undefined)?.code;
  return {
    input_digest: digestRef(sha256Bytes(JSON.stringify({
      command: 'gh',
      args,
      input_sha256: input === undefined ? null : digestRef(sha256Bytes(input)),
    }))),
    timeout_ms: timeoutMs,
    exit_status: result?.status ?? null,
    signal: result?.signal ?? null,
    timed_out: errorCode === 'ETIMEDOUT',
    error_code: errorCode ?? null,
    error_message: result?.error?.message ?? null,
    stdout: result?.stdout ?? '',
    stderr: result?.stderr ?? '',
  };
}

class GitHubReadError extends Error {
  readonly evidence: JsonRecord;

  constructor(message: string, evidence: JsonRecord) {
    super(message);
    this.name = 'GitHubReadError';
    this.evidence = evidence;
  }
}

export class GitHubMutationFailure extends Error {
  readonly result: JsonRecord;

  constructor(message: string, result: JsonRecord) {
    super(message);
    this.name = 'GitHubMutationFailure';
    this.result = result;
  }
}

function githubMutationFailure(
  command: 'github-apply' | 'github-activate-latest',
  values: AdapterOptionValues,
  failureTaxonomy: string,
  message: string,
  details: JsonRecord = {},
  commandFailure?: JsonRecord,
  retryDisposition = 'fail_closed_no_github_call',
): GitHubMutationFailure {
  const inputEvidence = {
    command,
    operation: values.operation ?? null,
    operation_id: values['operation-id'] ?? null,
    attempt_id: values['attempt-id'] ?? null,
    track: values.track ?? null,
    run_attempt: values['run-attempt'] ?? null,
    bundle: values.bundle ?? null,
    plan: values.plan ?? null,
    status: values.status ?? null,
    latest_admission: values['latest-admission'] ?? null,
    operation_started_at: values['operation-started-at'] ?? null,
    operation_deadline_at: values['operation-deadline-at'] ?? null,
  };
  const stdout = typeof commandFailure?.stdout === 'string' ? commandFailure.stdout : '';
  const commandStderr = typeof commandFailure?.stderr === 'string' ? commandFailure.stderr.trim() : '';
  return new GitHubMutationFailure(message, {
    surface_kind: 'opl_app_github_mutation_result.v1',
    status: 'failed',
    retry_disposition: retryDisposition,
    failure: {
      schema: 'opl_release_mutation_failure_receipt.v1',
      failure_taxonomy: failureTaxonomy,
      mutation: command,
      input_digest: digestRef(sha256Bytes(JSON.stringify(inputEvidence))),
      stdout,
      stderr: commandStderr ? `${commandStderr}\n${message}` : message,
      ...details,
    },
  });
}

function rejectGitHubMutation(
  command: 'github-apply' | 'github-activate-latest',
  values: AdapterOptionValues,
  failureTaxonomy: string,
  message: string,
  details: JsonRecord = {},
  retryDisposition?: string,
): never {
  throw githubMutationFailure(
    command,
    values,
    failureTaxonomy,
    message,
    details,
    undefined,
    retryDisposition,
  );
}

function persistGitHubMutationFailure(
  command: 'github-apply' | 'github-activate-latest',
  values: AdapterOptionValues,
  result: JsonRecord,
): void {
  const evidenceRoot = path.resolve(
    process.env.RUNNER_TEMP?.trim() || process.env.TMPDIR?.trim() || '/tmp',
    'opl-release-mutation-failure',
    command,
  );
  writeJson(path.join(evidenceRoot, 'failure.json'), result);
  fs.writeFileSync(path.join(evidenceRoot, 'input-digest.txt'), `${String(result.failure.input_digest)}\n`);
  fs.writeFileSync(path.join(evidenceRoot, 'stdout.txt'), String(result.failure.stdout ?? ''));
  fs.writeFileSync(path.join(evidenceRoot, 'stderr.txt'), String(result.failure.stderr ?? ''));
  if (typeof values.output === 'string' && values.output.trim()) {
    writeJson(path.resolve(values.output), result);
  }
}

function assertStableGitHubMutationAdmission(
  command: 'github-apply' | 'github-activate-latest',
  values: AdapterOptionValues,
  requiredTrack?: Track,
): {
  operation: StableReleaseOperation;
  operationId: string;
  operationStartedAt: string;
  attemptId: string;
  track: Track;
} {
  const runAttempt = values['run-attempt'];
  if (runAttempt !== '1') {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_run_attempt_rejected',
      'GitHub mutation requires --run-attempt 1.',
    );
  }
  const operation = values.operation;
  if (operation !== 'standard' && operation !== 'resume_standard' && operation !== 'append_full') {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_rejected',
      'GitHub mutation requires --operation standard, resume_standard, or append_full.',
    );
  }
  const track = values.track;
  if (track !== 'standard' && track !== 'full') {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_track_rejected',
      'GitHub mutation requires --track standard or full.',
    );
  }
  if (
    (track === 'standard' && operation === 'append_full')
    || (track === 'full' && operation !== 'append_full')
    || (requiredTrack !== undefined && track !== requiredTrack)
  ) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_track_mismatch',
      `${command} rejects operation ${operation} for track ${track}.`,
      { operation, track, required_track: requiredTrack ?? null },
    );
  }
  const operationId = values['operation-id'];
  if (typeof operationId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(operationId)) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_id_rejected',
      'GitHub mutation requires one canonical --operation-id.',
    );
  }
  const attemptId = values['attempt-id'];
  if (typeof attemptId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(attemptId)) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_attempt_id_rejected',
      'GitHub mutation requires one canonical --attempt-id.',
    );
  }
  const operationStartedAt = values['operation-started-at'];
  if (typeof operationStartedAt !== 'string' || !operationStartedAt.trim()) {
    rejectGitHubMutation(
      command,
      values,
      'github_mutation_operation_start_rejected',
      'GitHub mutation requires the immutable --operation-started-at.',
    );
  }
  return { operation, operationId, operationStartedAt, attemptId, track };
}

function ghRead(
  args: string[],
  runtime: GitHubAdapterRuntime,
  options: { allow404?: boolean } = {},
): JsonRecord | string | null {
  const timeoutMs = runtime.readTimeoutMs ?? githubReadTimeoutMs;
  const result = runtime.run('gh', args, { timeout: timeoutMs, killSignal: 'SIGTERM' });
  if (result.status !== 0 || result.error) {
    if (options.allow404 && !result.error && /HTTP 404|Not Found/i.test(`${result.stderr}\n${result.stdout}`)) {
      return null;
    }
    const evidence = commandEvidence(args, undefined, result, timeoutMs);
    throw new GitHubReadError(
      `gh ${args.join(' ')} read failed: ${result.stderr.trim() || result.stdout.trim() || result.error?.message || 'unknown error'}`,
      evidence,
    );
  }
  const output = result.stdout.trim();
  if (!output) return '';
  try {
    return JSON.parse(output) as JsonRecord;
  } catch {
    return output;
  }
}

export function inspectRelease(
  repo: string,
  tag: string,
  runtime: GitHubAdapterRuntime = defaultGitHubRuntime,
): JsonRecord {
  const release = ghRead(
    ['api', `repos/${repo}/releases/tags/${tag}`],
    runtime,
    { allow404: true },
  ) as JsonRecord | null;
  if (!release) {
    return {
      surface_kind: 'opl_app_github_release_inspection.v1',
      repository: repo,
      tag,
      release: { exists: false },
      assets: [],
    };
  }
  const assets = (Array.isArray(release.assets) ? release.assets : []).map((asset: JsonRecord) => {
    const digest = typeof asset.digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(asset.digest)
      ? asset.digest
      : null;
    if (!digest) throw new Error(`GitHub asset ${asset.name} has no authoritative SHA-256 digest.`);
    return { name: asset.name, size_bytes: asset.size, sha256: digest };
  });
  return {
    surface_kind: 'opl_app_github_release_inspection.v1',
    repository: repo,
    tag,
    release: {
      exists: true,
      id: release.id,
      name: release.name,
      draft: release.draft,
      prerelease: release.prerelease,
      target_commitish: release.target_commitish,
      body_sha256: sha256Bytes(String(release.body ?? '')),
    },
    assets,
  };
}

function inspectReleaseForReconcile(repo: string, tag: string, runtime: GitHubAdapterRuntime): JsonRecord {
  try {
    return { status: 'complete', observation: inspectRelease(repo, tag, runtime) };
  } catch (error) {
    return {
      status: 'inspect_failed',
      failure: error instanceof GitHubReadError
        ? error.evidence
        : { error_message: error instanceof Error ? error.message : String(error) },
    };
  }
}

function inspectLatestForReconcile(repo: string, runtime: GitHubAdapterRuntime): JsonRecord {
  try {
    const latest = ghRead(['api', `repos/${repo}/releases/latest`], runtime, { allow404: true });
    return { status: 'complete', observation: latest };
  } catch (error) {
    return {
      status: 'inspect_failed',
      failure: error instanceof GitHubReadError
        ? error.evidence
        : { error_message: error instanceof Error ? error.message : String(error) },
    };
  }
}

type GitHubMutationAttempt =
  | { status: 'accepted'; evidence: JsonRecord }
  | { status: 'deadline_elapsed' | 'outcome_unknown'; failure: JsonRecord };

function mutationAttemptId(
  baseAttemptId: string,
  mutation: 'release_create' | 'asset_upload' | 'latest_patch',
  remoteTarget: string,
  subject: string,
): string {
  return `gha:${sha256Bytes(JSON.stringify({
    base_attempt_id: baseAttemptId,
    mutation,
    remote_target: remoteTarget,
    subject,
  })).slice(0, 48)}`;
}

function runGitHubMutation(input: {
  mutation: 'release_create' | 'asset_upload' | 'latest_patch';
  attemptId: string;
  remoteTarget: string;
  args: string[];
  body?: string;
  operationDeadlineAt: string;
  runtime: GitHubAdapterRuntime;
}): GitHubMutationAttempt {
  const remainingMs = remainingReleaseOperationMilliseconds({
    deadlineAt: input.operationDeadlineAt,
    nowMs: input.runtime.now(),
  });
  if (remainingMs <= 0) {
    return {
      status: 'deadline_elapsed',
      failure: {
        failure_taxonomy: 'github_mutation_deadline_elapsed',
        mutation: input.mutation,
        mutation_attempt_id: input.attemptId,
        remote_target: input.remoteTarget,
        operation_deadline_at: input.operationDeadlineAt,
        ...commandEvidence(input.args, input.body, undefined, 0),
      },
    };
  }
  const timeoutMs = Math.max(1, Math.min(Math.floor(remainingMs), input.runtime.mutationTimeoutMs ?? githubMutationTimeoutMs));
  const result = input.runtime.run('gh', input.args, {
    input: input.body,
    timeout: timeoutMs,
    killSignal: 'SIGTERM',
  });
  const evidence = {
    mutation_attempt_id: input.attemptId,
    remote_target: input.remoteTarget,
    ...commandEvidence(input.args, input.body, result, timeoutMs),
  };
  if (result.status !== 0 || result.error) {
    return {
      status: 'outcome_unknown',
      failure: {
        failure_taxonomy: evidence.timed_out
          ? 'github_mutation_timeout'
          : 'github_mutation_outcome_unknown',
        mutation: input.mutation,
        operation_deadline_at: input.operationDeadlineAt,
        ...evidence,
      },
    };
  }
  return { status: 'accepted', evidence };
}

function stoppedMutation(input: {
  attempt: Exclude<GitHubMutationAttempt, { status: 'accepted' }>;
  repo: string;
  tag: string;
  uploaded?: string[];
  unresolvedAsset?: string;
  reconciliation: JsonRecord;
}): JsonRecord {
  return {
    surface_kind: 'opl_app_github_mutation_result.v1',
    status: input.attempt.status,
    repository: input.repo,
    tag: input.tag,
    uploaded: input.uploaded ?? [],
    unresolved_asset: input.unresolvedAsset ?? null,
    mutation_attempt_id: input.attempt.failure.mutation_attempt_id ?? null,
    remote_target: input.attempt.failure.remote_target ?? null,
    retry_disposition: 'read_only_reconcile_only',
    failure: input.attempt.failure,
    reconciliation: input.reconciliation,
  };
}

function unknownAfterAcceptedMutation(input: {
  mutation: string;
  operationDeadlineAt: string;
  attemptEvidence: JsonRecord;
  repo: string;
  tag: string;
  uploaded?: string[];
  unresolvedAsset?: string;
  reconciliation: JsonRecord;
  reason: string;
}): JsonRecord {
  return {
    surface_kind: 'opl_app_github_mutation_result.v1',
    status: 'outcome_unknown',
    repository: input.repo,
    tag: input.tag,
    uploaded: input.uploaded ?? [],
    unresolved_asset: input.unresolvedAsset ?? null,
    mutation_attempt_id: input.attemptEvidence.mutation_attempt_id ?? null,
    remote_target: input.attemptEvidence.remote_target ?? null,
    retry_disposition: 'read_only_reconcile_only',
    failure: {
      failure_taxonomy: 'github_mutation_readback_unknown',
      mutation: input.mutation,
      operation_deadline_at: input.operationDeadlineAt,
      reason: input.reason,
      mutation_attempt: input.attemptEvidence,
    },
    reconciliation: input.reconciliation,
  };
}

function assertReleaseIdentity(inspection: JsonRecord, options: {
  tag: string;
  name: string;
  notes: string;
  targetCommitish: string;
  prerelease: boolean;
}): void {
  const release = inspection.release;
  if (
    release.name !== options.name
    || release.prerelease !== options.prerelease
    || release.draft !== false
    || release.target_commitish !== options.targetCommitish
  ) {
    throw new Error(`Existing ${options.tag} Release identity conflicts with the Bundle.`);
  }
  if (release.body_sha256 !== sha256Bytes(options.notes)) {
    throw new Error(`Existing ${options.tag} Release notes conflict with the prepared Bundle notes.`);
  }
}

function ensureRelease(options: {
  baseAttemptId: string;
  repo: string;
  tag: string;
  name: string;
  notes: string;
  targetCommitish: string;
  prerelease: boolean;
  operationDeadlineAt: string;
  runtime: GitHubAdapterRuntime;
}): JsonRecord {
  const expectedBody = options.notes;
  const remoteTarget = `github-release:${options.repo}@${options.tag}`;
  let inspection = inspectRelease(options.repo, options.tag, options.runtime);
  if (!inspection.release.exists) {
    const payload = JSON.stringify({
      tag_name: options.tag,
      target_commitish: options.targetCommitish,
      name: options.name,
      body: expectedBody,
      draft: false,
      prerelease: options.prerelease,
      make_latest: 'false',
    });
    const attempt = runGitHubMutation({
      mutation: 'release_create',
      attemptId: mutationAttemptId(options.baseAttemptId, 'release_create', remoteTarget, options.tag),
      remoteTarget,
      args: ['api', '--method', 'POST', `repos/${options.repo}/releases`, '--input', '-'],
      body: payload,
      operationDeadlineAt: options.operationDeadlineAt,
      runtime: options.runtime,
    });
    if (attempt.status !== 'accepted') {
      return stoppedMutation({
        attempt,
        repo: options.repo,
        tag: options.tag,
        reconciliation: inspectReleaseForReconcile(options.repo, options.tag, options.runtime),
      });
    }
    const reconciliation = inspectReleaseForReconcile(options.repo, options.tag, options.runtime);
    if (reconciliation.status !== 'complete' || !reconciliation.observation.release.exists) {
      return unknownAfterAcceptedMutation({
        mutation: 'release_create',
        operationDeadlineAt: options.operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo: options.repo,
        tag: options.tag,
        reconciliation,
        reason: 'GitHub accepted Release creation but exact identity readback did not complete.',
      });
    }
    inspection = reconciliation.observation;
  }
  assertReleaseIdentity(inspection, options);
  return { status: 'complete', inspection };
}

export function applyPublishPlan(
  values: AdapterOptionValues,
  runtime: GitHubAdapterRuntime = defaultGitHubRuntime,
): JsonRecord {
  const admission = assertStableGitHubMutationAdmission('github-apply', values);
  const operationDeadlineAt = requireOption(values, 'operation-deadline-at');
  releaseOperationDeadlineTimestamp(operationDeadlineAt);
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  if (bundle.release.channel !== 'stable' || bundle.release.prerelease !== false) {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_mutation_non_stable_bundle',
      'GitHub mutation operations require a Stable non-prerelease Bundle.',
      { operation: admission.operation, track: admission.track },
    );
  }
  const repo = bundle.sources.app.repo;
  const tag = bundle.release.tag;
  const name = `One Person Lab v${bundle.release.version}`;
  const plan = readJson(path.resolve(requireOption(values, 'plan')));
  const publication = plan.release_bundle_publish;
  if (publication?.bundle_digest !== bundle.bundle_digest) {
    throw new Error('Framework publish plan is bound to a different Bundle.');
  }
  if (publication.track !== admission.track) {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_mutation_framework_track_mismatch',
      `Framework publish plan track ${String(publication.track ?? '<missing>')} does not match admitted ${admission.track}.`,
      {
        operation: admission.operation,
        admitted_track: admission.track,
        framework_plan_track: publication.track ?? null,
      },
    );
  }
  const frameworkControl = publication.receipt?.operation_control;
  if (
    publication.receipt?.release_operation !== admission.operation
    || frameworkControl?.operation_id !== admission.operationId
    || frameworkControl?.operation_started_at !== admission.operationStartedAt
    || frameworkControl?.operation_deadline_at !== operationDeadlineAt
  ) {
    rejectGitHubMutation(
      'github-apply',
      values,
      'github_mutation_framework_operation_mismatch',
      'Framework publish plan does not match the exact admitted operation control.',
      {
        admitted_operation: admission.operation,
        admitted_operation_id: admission.operationId,
        framework_operation: publication.receipt?.release_operation ?? null,
        framework_operation_control: frameworkControl ?? null,
      },
    );
  }
  const actions = publication.receipt?.details?.upload_actions;
  if (publication.status === 'reconcile_only') {
    return { status: 'reconcile_only', repository: repo, tag, uploaded: [] };
  }
  if (!Array.isArray(actions)) throw new Error('Framework publish plan has no structured upload_actions.');
  const releaseResult = ensureRelease({
    baseAttemptId: admission.attemptId,
    repo,
    tag,
    name,
    notes: bundle.prepared_notes.markdown,
    targetCommitish: bundle.sources.app.source_commit,
    prerelease: bundle.release.prerelease,
    operationDeadlineAt,
    runtime,
  });
  if (releaseResult.status !== 'complete') return releaseResult;
  const uploaded: string[] = [];
  for (const action of actions as JsonRecord[]) {
    if (action.action !== 'upload' || typeof action.source_path !== 'string') {
      throw new Error('Framework publish plan contains an invalid upload action.');
    }
    const expectedDigest = action.sha256;
    const expectedSize = action.size_bytes;
    const before = inspectRelease(repo, tag, runtime);
    const current = before.assets.find((asset: JsonRecord) => asset.name === action.name);
    if (current) {
      if (current.sha256 === expectedDigest && current.size_bytes === expectedSize) continue;
      throw new Error(`Remote asset ${action.name} conflicts with the immutable Bundle.`);
    }
    const attempt = runGitHubMutation({
      mutation: 'asset_upload',
      attemptId: mutationAttemptId(
        admission.attemptId,
        'asset_upload',
        `github-release:${repo}@${tag}`,
        String(action.name),
      ),
      remoteTarget: `github-release:${repo}@${tag}`,
      args: ['release', 'upload', tag, action.source_path, '--repo', repo],
      operationDeadlineAt,
      runtime,
    });
    if (attempt.status !== 'accepted') {
      return stoppedMutation({
        attempt,
        repo,
        tag,
        uploaded,
        unresolvedAsset: action.name,
        reconciliation: inspectReleaseForReconcile(repo, tag, runtime),
      });
    }
    const reconciliation = inspectReleaseForReconcile(repo, tag, runtime);
    if (reconciliation.status !== 'complete') {
      return unknownAfterAcceptedMutation({
        mutation: 'asset_upload',
        operationDeadlineAt,
        attemptEvidence: attempt.evidence,
        repo,
        tag,
        uploaded,
        unresolvedAsset: action.name,
        reconciliation,
        reason: `GitHub accepted ${action.name} upload but immutable digest readback failed.`,
      });
    }
    const after = reconciliation.observation;
    const observed = after.assets.find((asset: JsonRecord) => asset.name === action.name);
    if (observed?.sha256 === expectedDigest && observed?.size_bytes === expectedSize) {
      uploaded.push(action.name);
      continue;
    }
    if (observed) throw new Error(`Remote asset ${action.name} digest changed during upload.`);
    return unknownAfterAcceptedMutation({
      mutation: 'asset_upload',
      operationDeadlineAt,
      attemptEvidence: attempt.evidence,
      repo,
      tag,
      uploaded,
      unresolvedAsset: action.name,
      reconciliation,
      reason: 'GitHub accepted the upload but did not expose its immutable digest.',
    });
  }
  return { status: 'complete', repository: repo, tag, uploaded };
}

export function activateLatest(
  values: AdapterOptionValues,
  runtime: GitHubAdapterRuntime = defaultGitHubRuntime,
): JsonRecord {
  const admission = assertStableGitHubMutationAdmission('github-activate-latest', values, 'standard');
  const operationDeadlineAt = requireOption(values, 'operation-deadline-at');
  releaseOperationDeadlineTimestamp(operationDeadlineAt);
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  if (bundle.release.channel !== 'stable' || bundle.release.prerelease !== false) {
    throw new Error('Only a Stable Bundle can become Latest.');
  }
  const status = readJson(path.resolve(requireOption(values, 'status'))).release_bundle_status;
  if (status?.bundle_digest !== bundle.bundle_digest || status.latest_eligible !== true) {
    throw new Error('Framework status does not authorize Latest activation for this Bundle.');
  }
  const statusBundle = status.bundle;
  if (
    statusBundle?.bundle_digest !== bundle.bundle_digest
    || statusBundle?.release?.channel !== bundle.release.channel
    || statusBundle?.release?.version !== bundle.release.version
    || statusBundle?.release?.updater_version !== bundle.release.updater_version
    || statusBundle?.release?.tag !== bundle.release.tag
    || statusBundle?.release?.prerelease !== bundle.release.prerelease
    || statusBundle?.sources?.app?.source_commit !== bundle.sources.app.source_commit
    || statusBundle?.sources?.shell?.source_commit !== bundle.sources.shell.source_commit
    || statusBundle?.sources?.framework?.source_commit !== bundle.sources.framework.source_commit
  ) {
    throw new Error('Framework status Bundle projection does not match the immutable Bundle input.');
  }
  if (!Array.isArray(status.tracks?.standard?.assets)) {
    throw new Error('Framework status has no verified Standard staged assets.');
  }
  const standardControl = status.operation_controls?.standard;
  if (
    standardControl?.operation_id !== admission.operationId
    || standardControl?.operation_started_at !== admission.operationStartedAt
    || standardControl?.operation_deadline_at !== operationDeadlineAt
  ) {
    throw new Error('Framework status does not match the exact admitted Standard operation control.');
  }
  const latestAdmission = readJson(path.resolve(requireOption(values, 'latest-admission')));
  assertStandardLatestAdmissionReceipt(latestAdmission, {
    bundleDigest: bundle.bundle_digest,
    candidateDisplayVersion: bundle.release.version,
    candidateUpdaterVersion: bundle.release.updater_version,
    appSha: bundle.sources.app.source_commit,
    shellSha: bundle.sources.shell.source_commit,
    frameworkSha: bundle.sources.framework.source_commit,
    standardAssets: status.tracks.standard.assets,
  });
  const repo = bundle.sources.app.repo;
  const tag = bundle.release.tag;
  const inspection = inspectRelease(repo, tag, runtime);
  if (!inspection.release.exists || !inspection.release.id) throw new Error(`Release ${tag} is missing.`);
  const latest = ghRead(['api', `repos/${repo}/releases/latest`], runtime, { allow404: true }) as JsonRecord | null;
  const observedLatestTag = typeof latest?.tag_name === 'string' ? latest.tag_name : null;
  const expectedCurrentLatestTag = latestAdmission.latest_compare_and_swap.expected_current.tag;
  if (observedLatestTag === tag) {
    return {
      status: 'idempotent',
      repository: repo,
      tag,
      latest_compare_and_swap: {
        expected_current_tag: expectedCurrentLatestTag,
        observed_current_tag: observedLatestTag,
        patch_performed: false,
      },
    };
  }
  if (observedLatestTag !== expectedCurrentLatestTag) {
    rejectGitHubMutation(
      'github-activate-latest',
      values,
      'github_latest_compare_and_swap_drift',
      `Latest drifted: expected ${expectedCurrentLatestTag}, observed ${observedLatestTag ?? '<missing>'}.`,
      {
        expected_current_tag: expectedCurrentLatestTag,
        observed_current_tag: observedLatestTag,
        candidate_tag: tag,
      },
      'inspect_only_no_patch_require_new_admission',
    );
  }
  const attempt = runGitHubMutation({
    mutation: 'latest_patch',
    attemptId: mutationAttemptId(
      admission.attemptId,
      'latest_patch',
      `github-latest:${repo}@${tag}`,
      tag,
    ),
    remoteTarget: `github-latest:${repo}@${tag}`,
    args: ['api', '--method', 'PATCH', `repos/${repo}/releases/${inspection.release.id}`, '--input', '-'],
    body: JSON.stringify({ make_latest: 'true' }),
    operationDeadlineAt,
    runtime,
  });
  if (attempt.status !== 'accepted') {
    return stoppedMutation({
      attempt,
      repo,
      tag,
      reconciliation: inspectLatestForReconcile(repo, runtime),
    });
  }
  const reconciliation = inspectLatestForReconcile(repo, runtime);
  if (reconciliation.status !== 'complete' || reconciliation.observation?.tag_name !== tag) {
    return unknownAfterAcceptedMutation({
      mutation: 'latest_patch',
      operationDeadlineAt,
      attemptEvidence: attempt.evidence,
      repo,
      tag,
      reconciliation,
      reason: `Latest readback did not prove ${tag}.`,
    });
  }
  return {
    status: 'complete',
    repository: repo,
    tag,
    latest_compare_and_swap: {
      expected_current_tag: expectedCurrentLatestTag,
      observed_current_tag: observedLatestTag,
      patch_performed: true,
    },
  };
}

function main(): void {
  const { values, positionals } = parseCommon(process.argv.slice(2));
  const command = positionals[0];
  try {
    let output: JsonRecord;
    if (command === 'freeze-request') {
      output = buildFreezeRequest(values);
    } else if (command === 'executor-receipt') {
      output = buildExecutorReceipt(values);
    } else if (command === 'qualification-receipt') {
      output = buildQualificationReceipt(values);
    } else if (command === 'github-inspect') {
      if (typeof values['operation-deadline-at'] === 'string') {
        releaseOperationDeadlineTimestamp(values['operation-deadline-at']);
      }
      output = inspectRelease(requireOption(values, 'repo'), requireOption(values, 'tag'));
    } else if (command === 'github-apply') {
      output = applyPublishPlan(values);
    } else if (command === 'github-activate-latest') {
      output = activateLatest(values);
    } else {
      throw new Error('Usage: framework-release-adapter <freeze-request|executor-receipt|qualification-receipt|github-inspect|github-apply|github-activate-latest> ...');
    }
    if (typeof values.output === 'string' && values.output.trim()) writeJson(path.resolve(values.output), output);
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    if (command === 'github-apply' || command === 'github-activate-latest') {
      const typed = error instanceof GitHubMutationFailure
        ? error
        : githubMutationFailure(
            command,
            values,
            'github_mutation_failed',
            error instanceof Error ? error.message : String(error),
            {},
            error instanceof GitHubReadError ? error.evidence : undefined,
          );
      persistGitHubMutationFailure(command, values, typed.result);
      throw typed;
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
