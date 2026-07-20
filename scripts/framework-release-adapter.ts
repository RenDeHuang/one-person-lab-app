#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import {
  validateArtifactQualificationReceipt,
  type ArtifactQualificationReceiptV1,
} from './artifact-qualification-receipt.ts';
import { assertUpdaterVersionMatchesDisplay } from './release-version.ts';

type JsonRecord = Record<string, any>;
type Track = 'standard' | 'full';

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

function containedFrameworkFile(frameworkRoot: string, catalogRoot: string, ref: string): string {
  const candidate = path.resolve(ref.startsWith('contracts/') ? frameworkRoot : catalogRoot, ref);
  const relative = path.relative(frameworkRoot, candidate);
  if (relative === '' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(`Framework catalog ref escapes its checkout: ${ref}`);
  }
  const stat = fs.lstatSync(candidate);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Framework catalog ref is not a regular file: ${ref}`);
  }
  return candidate;
}

function frameworkContractRef(ref: string): string {
  const normalized = ref.split(path.sep).join('/');
  return normalized.startsWith('contracts/')
    ? normalized
    : path.posix.join('contracts/opl-framework', normalized);
}

function assertCatalogEntryFiles(
  frameworkRoot: string,
  catalogRoot: string,
  packageId: typeof packageIds[number],
  entry: JsonRecord,
): void {
  const manifestPath = containedFrameworkFile(frameworkRoot, catalogRoot, String(entry.manifest_ref ?? ''));
  const payloadPath = containedFrameworkFile(frameworkRoot, catalogRoot, String(entry.payload_manifest_ref ?? ''));
  for (const [label, filePath, expected] of [
    ['manifest', manifestPath, entry.manifest_sha256],
    ['payload manifest', payloadPath, entry.payload_manifest_sha256],
  ] as const) {
    const actual = digestRef(sha256File(filePath));
    if (actual !== expected) {
      throw new Error(`${packageId} ${label} digest drifted: expected ${String(expected)}, got ${actual}.`);
    }
  }
  const manifest = readJson(manifestPath);
  const payload = readJson(payloadPath);
  if (manifest.package_id !== packageId || manifest.version !== entry.package_version) {
    throw new Error(`${packageId} package manifest identity does not match the Framework catalog.`);
  }
  if (
    payload.package_id !== packageId
    || payload.package_version !== entry.package_version
    || payload.source_commit !== entry.owner_source_commit
  ) {
    throw new Error(`${packageId} payload manifest identity does not match the frozen owner ref.`);
  }
}

function requiredAssetNames(version: string, track: Track): string[] {
  return track === 'standard'
    ? [
        `One-Person-Lab-${version}-mac-arm64.dmg`,
        `One-Person-Lab-${version}-mac-arm64.zip`,
        `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
        'latest-arm64-mac.yml',
        'opl-app-component-manifest.json',
        'standard-local-authorization-policy.json',
      ]
    : [
        `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
        'opl-release-manifest.json',
      ];
}

function requireOption(values: Record<string, string | boolean | undefined>, key: string): string {
  const value = values[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing --${key}.`);
  return value.trim();
}

function requireBooleanOption(values: Record<string, string | boolean | undefined>, key: string): boolean {
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
      'release-set-manifest': { type: 'string' },
      output: { type: 'string' },
      operation: { type: 'string' },
      executor: { type: 'string' },
      'attempt-id': { type: 'string' },
      bundle: { type: 'string' },
      track: { type: 'string' },
      outcome: { type: 'string' },
      'assets-dir': { type: 'string' },
      inspection: { type: 'string' },
      'legacy-qualification': { type: 'string' },
      status: { type: 'string' },
      repo: { type: 'string' },
      tag: { type: 'string' },
      name: { type: 'string' },
      plan: { type: 'string' },
      prerelease: { type: 'boolean' },
    },
    allowPositionals: true,
    strict: true,
  });
}

function buildFreezeRequest(values: Record<string, string | boolean | undefined>): JsonRecord {
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
  const includeFullPackage = requireBooleanOption(values, 'include-full-package');
  const preparedNotes = fs.readFileSync(notesPath, 'utf8');
  if (!preparedNotes.includes(aiNotesMarker)) {
    throw new Error('Prepared release notes are not bound to the online AI writer.');
  }
  const notesEvidence = readJson(evidencePath);
  if (notesEvidence.payload?.include_full_package !== includeFullPackage) {
    throw new Error(
      'Prepared release notes Full intent does not match the admitted Release Bundle request.',
    );
  }
  const releaseSetPath = path.resolve(requireOption(values, 'release-set-manifest'));
  const catalogPath = path.join(
    frameworkRoot,
    'contracts/opl-framework/bundled-full-runtime-package-catalog.json',
  );
  const catalog = readJson(catalogPath);
  const catalogRoot = path.dirname(catalogPath);
  const packages: JsonRecord = {};
  for (const packageId of packageIds) {
    const entry = catalog.packages?.[packageId];
    if (!entry) throw new Error(`Framework catalog is missing ${packageId}.`);
    assertCatalogEntryFiles(frameworkRoot, catalogRoot, packageId, entry);
    packages[packageId] = {
      package_id: packageId,
      version: entry.package_version,
      owner_source_commit: entry.owner_source_commit,
      manifest_ref: frameworkContractRef(entry.manifest_ref),
      manifest_sha256: entry.manifest_sha256,
      payload_manifest_ref: frameworkContractRef(entry.payload_manifest_ref),
      payload_manifest_sha256: entry.payload_manifest_sha256,
    };
  }

  const relativeReleaseSet = path.relative(frameworkRoot, releaseSetPath).split(path.sep).join('/');
  if (relativeReleaseSet.startsWith('../') || relativeReleaseSet === '') {
    throw new Error('Release Set manifest must be contained by the Framework checkout.');
  }
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
      app: { repo: 'gaofeng21cn/one-person-lab-app', source_commit: gitSha(appRoot) },
      shell: { repo: 'gaofeng21cn/opl-aion-shell', source_commit: gitSha(shellRoot) },
      framework: { repo: 'gaofeng21cn/one-person-lab', source_commit: gitSha(frameworkRoot) },
    },
    framework_release_set: {
      generation: path.basename(path.dirname(releaseSetPath)),
      manifest_ref: relativeReleaseSet,
      digest: digestRef(sha256File(releaseSetPath)),
    },
    packages,
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
      full: {
        required_asset_names: requiredAssetNames(version, 'full'),
        required_for_latest: false,
        additive_only: true,
        updater_metadata_allowed: false,
      },
    },
  };
}

function bundleDocument(bundlePath: string): JsonRecord {
  const bundle = readJson(path.resolve(bundlePath));
  if (bundle.surface_kind !== 'opl_release_bundle.v1' || typeof bundle.bundle_digest !== 'string') {
    throw new Error('Bundle must be an opl_release_bundle.v1 document.');
  }
  return bundle;
}

function buildExecutorReceipt(values: Record<string, string | boolean | undefined>): JsonRecord {
  const operation = requireOption(values, 'operation');
  const executor = requireOption(values, 'executor');
  const attemptId = requireOption(values, 'attempt-id');
  const track = requireOption(values, 'track') as Track;
  const outcome = requireOption(values, 'outcome');
  if (operation !== 'build' && operation !== 'remote_inspect') throw new Error('Invalid executor operation.');
  if (executor !== 'local' && executor !== 'remote') throw new Error('Invalid executor.');
  if (track !== 'standard' && track !== 'full') throw new Error('Invalid track.');
  if (outcome !== 'complete' && outcome !== 'unknown') throw new Error('Invalid outcome.');
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
  } else if (outcome === 'complete' && operation === 'remote_inspect') {
    const inspection = readJson(path.resolve(requireOption(values, 'inspection')));
    const remoteAssets = new Map(
      (Array.isArray(inspection.assets) ? inspection.assets : []).map((asset: JsonRecord) => [asset.name, asset]),
    );
    assets = requiredNames.flatMap((name: string) => {
      const asset = remoteAssets.get(name);
      return asset ? [{ name, size_bytes: asset.size_bytes, sha256: asset.sha256 }] : [];
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
    assets,
  };
}

function buildQualificationReceipt(values: Record<string, string | boolean | undefined>): JsonRecord {
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  const track = requireOption(values, 'track') as Track;
  if (track !== 'standard' && track !== 'full') throw new Error('--track must be standard or full.');
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
    cohort: {
      app_sha: bundle.sources.app.source_commit,
      shell_sha: bundle.sources.shell.source_commit,
      framework_sha: bundle.sources.framework.source_commit,
      framework_release_set_digest: bundle.framework_release_set.digest,
      package_payload_manifest_sha256: Object.fromEntries(
        packageIds.map((packageId) => [packageId, bundle.packages[packageId].payload_manifest_sha256]),
      ),
    },
    qualification: {
      kind: 'installed_artifact',
      result: 'passed',
      installed_artifact_same_bytes: true,
      harness_sha256: digestRef(harnessSha256),
      evidence_refs: [evidenceRef],
    },
  };
}

function gh(args: string[], options: { input?: string; allow404?: boolean } = {}): JsonRecord | string | null {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    input: options.input,
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    if (options.allow404 && /HTTP 404|Not Found/i.test(`${result.stderr}\n${result.stdout}`)) return null;
    throw new Error(`gh ${args.join(' ')} failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  const output = result.stdout.trim();
  if (!output) return '';
  try {
    return JSON.parse(output) as JsonRecord;
  } catch {
    return output;
  }
}

function inspectRelease(repo: string, tag: string): JsonRecord {
  const release = gh(['api', `repos/${repo}/releases/tags/${tag}`], { allow404: true }) as JsonRecord | null;
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

function ensureRelease(options: {
  repo: string;
  tag: string;
  name: string;
  notes: string;
  targetCommitish: string;
  prerelease: boolean;
}): JsonRecord {
  const expectedBody = options.notes;
  let inspection = inspectRelease(options.repo, options.tag);
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
    try {
      gh(['api', '--method', 'POST', `repos/${options.repo}/releases`, '--input', '-'], { input: payload });
    } catch (error) {
      inspection = inspectRelease(options.repo, options.tag);
      if (!inspection.release.exists) throw error;
    }
    inspection = inspectRelease(options.repo, options.tag);
  }
  const release = inspection.release;
  if (
    release.name !== options.name
    || release.prerelease !== options.prerelease
    || release.draft !== false
    || release.target_commitish !== options.targetCommitish
  ) {
    throw new Error(`Existing ${options.tag} Release identity conflicts with the Bundle.`);
  }
  if (release.body_sha256 !== sha256Bytes(expectedBody)) {
    throw new Error(`Existing ${options.tag} Release notes conflict with the prepared Bundle notes.`);
  }
  return inspection;
}

function applyPublishPlan(values: Record<string, string | boolean | undefined>): JsonRecord {
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  const repo = bundle.sources.app.repo;
  const tag = bundle.release.tag;
  const name = `One Person Lab v${bundle.release.version}`;
  const plan = readJson(path.resolve(requireOption(values, 'plan')));
  const publication = plan.release_bundle_publish;
  if (publication?.bundle_digest !== bundle.bundle_digest) {
    throw new Error('Framework publish plan is bound to a different Bundle.');
  }
  const actions = publication.receipt?.details?.upload_actions;
  if (publication.status === 'reconcile_only') {
    return { status: 'reconcile_only', repository: repo, tag, uploaded: [] };
  }
  if (!Array.isArray(actions)) throw new Error('Framework publish plan has no structured upload_actions.');
  ensureRelease({
    repo,
    tag,
    name,
    notes: bundle.prepared_notes.markdown,
    targetCommitish: bundle.sources.app.source_commit,
    prerelease: bundle.release.prerelease,
  });
  const uploaded: string[] = [];
  for (const action of actions as JsonRecord[]) {
    if (action.action !== 'upload' || typeof action.source_path !== 'string') {
      throw new Error('Framework publish plan contains an invalid upload action.');
    }
    const expectedDigest = action.sha256;
    const expectedSize = action.size_bytes;
    const before = inspectRelease(repo, tag);
    const current = before.assets.find((asset: JsonRecord) => asset.name === action.name);
    if (current) {
      if (current.sha256 === expectedDigest && current.size_bytes === expectedSize) continue;
      throw new Error(`Remote asset ${action.name} conflicts with the immutable Bundle.`);
    }
    const upload = spawnSync('gh', ['release', 'upload', tag, action.source_path, '--repo', repo], {
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
    });
    const after = inspectRelease(repo, tag);
    const observed = after.assets.find((asset: JsonRecord) => asset.name === action.name);
    if (observed?.sha256 === expectedDigest && observed?.size_bytes === expectedSize) {
      uploaded.push(action.name);
      continue;
    }
    if (observed) throw new Error(`Remote asset ${action.name} digest changed during upload.`);
    if (upload.status !== 0) {
      return {
        status: 'outcome_unknown',
        repository: repo,
        tag,
        uploaded,
        unresolved_asset: action.name,
        reason: upload.stderr.trim() || upload.stdout.trim(),
      };
    }
    return {
      status: 'outcome_unknown',
      repository: repo,
      tag,
      uploaded,
      unresolved_asset: action.name,
      reason: 'GitHub accepted the upload but did not expose its immutable digest.',
    };
  }
  return { status: 'complete', repository: repo, tag, uploaded };
}

function activateLatest(values: Record<string, string | boolean | undefined>): JsonRecord {
  const bundle = bundleDocument(requireOption(values, 'bundle'));
  if (bundle.release.channel !== 'stable' || bundle.release.prerelease !== false) {
    throw new Error('Only a Stable Bundle can become Latest.');
  }
  const status = readJson(path.resolve(requireOption(values, 'status'))).release_bundle_status;
  if (status?.bundle_digest !== bundle.bundle_digest || status.latest_eligible !== true) {
    throw new Error('Framework status does not authorize Latest activation for this Bundle.');
  }
  const repo = bundle.sources.app.repo;
  const tag = bundle.release.tag;
  const inspection = inspectRelease(repo, tag);
  if (!inspection.release.exists || !inspection.release.id) throw new Error(`Release ${tag} is missing.`);
  const latest = gh(['api', `repos/${repo}/releases/latest`], { allow404: true }) as JsonRecord | null;
  if (latest?.tag_name === tag) return { status: 'idempotent', repository: repo, tag };
  try {
    gh(
      ['api', '--method', 'PATCH', `repos/${repo}/releases/${inspection.release.id}`, '--input', '-'],
      { input: JSON.stringify({ make_latest: 'true' }) },
    );
  } catch (error) {
    const reconciled = gh(['api', `repos/${repo}/releases/latest`], { allow404: true }) as JsonRecord | null;
    if (reconciled?.tag_name !== tag) throw error;
  }
  const readback = gh(['api', `repos/${repo}/releases/latest`]) as JsonRecord;
  if (readback.tag_name !== tag) throw new Error(`Latest readback is ${readback.tag_name}, expected ${tag}.`);
  return { status: 'complete', repository: repo, tag };
}

function main(): void {
  const { values, positionals } = parseCommon(process.argv.slice(2));
  const command = positionals[0];
  let output: JsonRecord;
  if (command === 'freeze-request') {
    output = buildFreezeRequest(values);
  } else if (command === 'executor-receipt') {
    output = buildExecutorReceipt(values);
  } else if (command === 'qualification-receipt') {
    output = buildQualificationReceipt(values);
  } else if (command === 'github-inspect') {
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
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
