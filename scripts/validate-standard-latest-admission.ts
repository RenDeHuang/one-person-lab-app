#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  assertReleaseSemanticsAxes,
  assertUpdaterVersionMatchesDisplay,
  type ReleaseBuildTrigger,
  type ReleasePreviewKind,
  type ReleaseQualityStatus,
} from './release-version.ts';

type JsonRecord = Record<string, any>;
type StandardPublicationChannel = 'stable' | 'preview' | 'nightly';

export type StandardLatestAdmissionInput = {
  publicationChannel: StandardPublicationChannel;
  bundleDigest: string;
  candidateDisplayVersion: string;
  candidateUpdaterVersion: string;
  appSha: string;
  shellSha: string;
  frameworkSha: string;
  standardAssetsPath: string;
  componentManifestPath: string;
  expectedCurrentLatestTag: string;
  highestPublicStableTag: string;
  predecessors: string[];
  updaterEvidenceDirs: string[];
  latestOverrideAuthorityPath?: string;
  homebrewPublicationPath?: string;
  homebrewVmPath?: string;
  homebrewReadbackPath?: string;
};

export type StandardLatestAdmissionAuthority = {
  publicationChannel?: StandardPublicationChannel;
  bundleDigest: string;
  candidateDisplayVersion: string;
  candidateUpdaterVersion: string;
  appSha: string;
  shellSha: string;
  frameworkSha: string;
  standardAssets: JsonRecord[];
};

const digestPattern = /^sha256:[0-9a-f]{64}$/;
const shaPattern = /^[0-9a-f]{40}$/;
const standardTapRepository = 'gaofeng21cn/homebrew-one-person-lab';
const standardCaskPath = 'Casks/one-person-lab.rb';

function readJson(filePath: string): JsonRecord {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`Expected a non-empty regular JSON file: ${resolved}`);
  }
  const value = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected one JSON object: ${resolved}`);
  }
  return value as JsonRecord;
}

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function requireDigest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !digestPattern.test(value)) {
    throw new Error(`${label} must be an exact sha256 digest.`);
  }
  return value;
}

function requireRawDigest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} must be an exact lowercase SHA-256.`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return Number(value);
}

function requireEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label} does not match the frozen Standard candidate.`);
}

function parsePredecessor(value: string): { displayVersion: string; updaterVersion: string } {
  const separator = value.indexOf('=');
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error('--predecessor must use <display_version>=<updater_version>.');
  }
  const displayVersion = value.slice(0, separator).replace(/^v/, '');
  const updaterVersion = value.slice(separator + 1);
  if (!displayVersion || !updaterVersion) {
    throw new Error('--predecessor must contain non-empty display and updater versions.');
  }
  return { displayVersion, updaterVersion };
}

function requireStableReleaseTag(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^v[0-9]+\.[0-9]+\.[0-9]+(?:-r[1-9][0-9]*)?$/.test(value)) {
    throw new Error(`${label} must be an exact Stable release tag.`);
  }
  return value;
}

function requireLatestReleaseTag(value: unknown, label: string): string {
  if (
    typeof value !== 'string'
    || !/^v[0-9]+\.[0-9]+\.[0-9]+(?:(?:-r[1-9][0-9]*)|(?:-preview\.r[1-9][0-9]*)|(?:-nightly(?:\.r[1-9][0-9]*)?))?$/.test(value)
  ) {
    throw new Error(`${label} must be an exact Stable, Dev Preview, or Nightly Preview Latest tag.`);
  }
  return value;
}

function requireCandidateReleaseTag(
  value: unknown,
  channel: StandardPublicationChannel,
  label: string,
): string {
  if (channel === 'stable') return requireStableReleaseTag(value, label);
  const pattern = channel === 'preview'
    ? /^v[0-9]+\.[0-9]+\.[0-9]+-preview\.r[1-9][0-9]*$/
    : /^v[0-9]+\.[0-9]+\.[0-9]+-nightly(?:\.r[1-9][0-9]*)?$/;
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(`${label} must be an exact ${channel === 'preview' ? 'Dev' : 'Nightly'} Preview release tag.`);
  }
  return value;
}

function sha256JsonWithoutDigest(value: JsonRecord, digestKey: string): string {
  const core = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey));
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex')}`;
}

function expectedClassification(channel: StandardPublicationChannel): {
  qualityStatus: ReleaseQualityStatus;
  buildTrigger: ReleaseBuildTrigger;
  previewKind: ReleasePreviewKind;
} {
  if (channel === 'stable') {
    return { qualityStatus: 'stable', buildTrigger: 'manual', previewKind: null };
  }
  if (channel === 'nightly') {
    return { qualityStatus: 'preview', buildTrigger: 'automated', previewKind: 'nightly' };
  }
  return { qualityStatus: 'preview', buildTrigger: 'manual', previewKind: 'dev' };
}

function validateComponentManifest(
  manifestPath: string,
  input: StandardLatestAdmissionInput,
): JsonRecord {
  const manifest = readJson(manifestPath);
  requireEqual(manifest.surface_kind, 'opl_app_component_manifest.v1', 'Component manifest surface_kind');
  requireEqual(manifest.component_id, 'opl-app', 'Component manifest component_id');
  requireEqual(manifest.version, input.candidateDisplayVersion, 'Component manifest version');
  requireEqual(manifest.release_version, input.candidateDisplayVersion, 'Component manifest release version');
  requireEqual(manifest.updater_version, input.candidateUpdaterVersion, 'Component manifest updater version');
  requireEqual(manifest.release_tag, `v${input.candidateDisplayVersion}`, 'Component manifest release tag');
  requireEqual(manifest.source_commit, input.appSha, 'Component manifest source commit');
  const classification = expectedClassification(input.publicationChannel);
  requireEqual(manifest.quality_status, classification.qualityStatus, 'Component manifest quality_status');
  requireEqual(manifest.build_trigger, classification.buildTrigger, 'Component manifest build_trigger');
  requireEqual(manifest.preview_kind, classification.previewKind, 'Component manifest preview_kind');
  assertReleaseSemanticsAxes({
    qualityStatus: manifest.quality_status,
    buildTrigger: manifest.build_trigger,
    previewKind: manifest.preview_kind,
  });
  requireEqual(
    manifest.component_manifest_digest,
    sha256JsonWithoutDigest(manifest, 'component_manifest_digest'),
    'Component manifest self digest',
  );
  requireDigest(manifest.primary_artifact?.digest, 'Component manifest primary artifact digest');
  requirePositiveInteger(manifest.primary_artifact?.size, 'Component manifest primary artifact size');
  if (classification.qualityStatus === 'preview') {
    requireEqual(manifest.qualification_disclosure?.stable_qualified, false, 'Preview stable_qualified disclosure');
    requireEqual(manifest.qualification_disclosure?.non_stable_notice, true, 'Preview non-Stable disclosure');
    if (
      !Array.isArray(manifest.qualification_disclosure?.skipped_gates)
      || manifest.qualification_disclosure.skipped_gates.length === 0
    ) {
      throw new Error('Preview component manifest must disclose skipped Stable gates.');
    }
  }
  return manifest;
}

function validateLatestOverrideAuthority(
  authorityPath: string,
  manifest: JsonRecord,
  expectedCurrentLatestTag: string,
): JsonRecord {
  const authority = readJson(authorityPath);
  requireEqual(authority.schema, 'opl_app_latest_pointer_override_authority.v1', 'Latest override authority schema');
  requireEqual(authority.status, 'admitted', 'Latest override authority status');
  requireEqual(authority.operation, 'move_latest_pointer', 'Latest override operation');
  requireEqual(authority.authorization?.source, 'user_explicit', 'Latest override authority source');
  requireEqual(
    authority.authorization?.protected_environment,
    'release-preview-latest',
    'Latest override protected environment',
  );
  requireEqual(authority.authorization?.single_use, true, 'Latest override single-use policy');
  requireEqual(authority.authorization?.persistent_override, false, 'Latest override persistent policy');
  requireEqual(authority.candidate?.tag, manifest.release_tag, 'Latest override candidate tag');
  requireEqual(
    authority.candidate?.component_manifest_digest,
    manifest.component_manifest_digest,
    'Latest override component manifest digest',
  );
  requireEqual(
    authority.candidate?.artifact_digest,
    manifest.primary_artifact?.digest,
    'Latest override artifact digest',
  );
  requireEqual(authority.candidate?.quality_status, manifest.quality_status, 'Latest override quality_status');
  requireEqual(authority.candidate?.build_trigger, manifest.build_trigger, 'Latest override build_trigger');
  requireEqual(authority.candidate?.preview_kind, manifest.preview_kind, 'Latest override preview_kind');
  requireEqual(authority.candidate?.quality_unchanged, true, 'Latest override quality policy');
  requireEqual(authority.candidate?.non_stable_notice, true, 'Latest override non-Stable disclosure');
  if (
    JSON.stringify(authority.candidate?.skipped_gates)
    !== JSON.stringify(manifest.qualification_disclosure?.skipped_gates)
  ) {
    throw new Error('Latest override skipped-gate disclosure must match the immutable component manifest.');
  }
  requireEqual(
    authority.compare_and_swap?.expected_current_tag,
    expectedCurrentLatestTag,
    'Latest override expected-current tag',
  );
  requireEqual(authority.compare_and_swap?.exact_expected_current, true, 'Latest override exact CAS policy');
  requireEqual(authority.readback?.required, true, 'Latest override readback requirement');
  requireEqual(
    authority.readback?.policy,
    'exact_public_tag_latest_and_quality_disclosure',
    'Latest override readback policy',
  );
  requireEqual(
    authority.authority_digest,
    sha256JsonWithoutDigest(authority, 'authority_digest'),
    'Latest override authority digest',
  );
  return authority;
}

function evidenceFile(root: string, name: string): string {
  const direct = path.join(path.resolve(root), name);
  if (fs.statSync(direct, { throwIfNoEntry: false })?.isFile()) return direct;
  const matches: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(candidate);
      else if (entry.isFile() && entry.name === name) matches.push(candidate);
    }
  };
  visit(path.resolve(root));
  if (matches.length !== 1) {
    throw new Error(`Updater evidence must contain exactly one ${name}; found ${matches.length}.`);
  }
  return matches[0];
}

export function assertStandardLatestAdmissionReceipt(
  receipt: JsonRecord,
  authority: StandardLatestAdmissionAuthority,
): void {
  const receiptPublicationChannel = receipt.publication_channel;
  const publicationChannel = authority.publicationChannel
    ?? (receiptPublicationChannel === undefined ? 'stable' : receiptPublicationChannel);
  if (
    publicationChannel !== 'stable'
    && publicationChannel !== 'preview'
    && publicationChannel !== 'nightly'
  ) {
    throw new Error('Latest admission publication channel must be stable, preview, or nightly.');
  }
  requireEqual(receipt.schema, 'opl_standard_latest_admission_receipt.v1', 'Latest admission schema');
  requireEqual(receipt.status, 'passed', 'Latest admission status');
  requireEqual(receipt.operation, 'move_latest_pointer', 'Latest admission operation');
  requireEqual(receipt.latest_activation_admitted, true, 'Latest activation admission');
  if (receiptPublicationChannel === undefined) {
    if (publicationChannel !== 'stable') {
      throw new Error('Preview Latest admission receipt must bind its publication route.');
    }
  } else {
    requireEqual(receiptPublicationChannel, publicationChannel, 'Latest admission publication channel');
  }
  const classification = expectedClassification(publicationChannel);
  requireEqual(receipt.classification?.quality_status, classification.qualityStatus, 'Latest admission quality_status');
  requireEqual(receipt.classification?.build_trigger, classification.buildTrigger, 'Latest admission build_trigger');
  requireEqual(receipt.classification?.preview_kind, classification.previewKind, 'Latest admission preview_kind');
  requireEqual(receipt.classification?.quality_unchanged, true, 'Latest admission quality policy');
  requireEqual(
    receipt.classification?.non_stable_notice,
    publicationChannel === 'stable' ? false : true,
    'Latest admission non-Stable disclosure',
  );
  requireDigest(receipt.component_manifest?.manifest_digest, 'Latest admission component manifest digest');
  const manifestAsset = authority.standardAssets.filter(
    (asset) => asset?.name === 'opl-app-component-manifest.json',
  );
  if (manifestAsset.length !== 1) {
    throw new Error('Framework status must contain exactly one opl-app-component-manifest.json.');
  }
  requireEqual(
    requireDigest(receipt.component_manifest?.file_sha256, 'Latest admission component manifest sha256'),
    requireDigest(manifestAsset[0].sha256, 'Framework status component manifest sha256'),
    'Latest admission component manifest sha256',
  );
  if (publicationChannel === 'stable') {
    requireEqual(receipt.pointer_authority?.mode, 'qualified_stable_default', 'Stable Latest authority mode');
    requireEqual(receipt.pointer_authority?.single_use, false, 'Stable Latest single-use policy');
    requireEqual(receipt.pointer_authority?.persistent_override, false, 'Stable Latest persistent policy');
    requireEqual(receipt.pointer_authority?.authority_digest, null, 'Stable Latest authority digest');
  } else {
    requireEqual(
      receipt.pointer_authority?.mode,
      'protected_single_use_exact_version',
      'Preview Latest authority mode',
    );
    requireEqual(receipt.pointer_authority?.single_use, true, 'Preview Latest single-use policy');
    requireEqual(receipt.pointer_authority?.persistent_override, false, 'Preview Latest persistent policy');
    requireDigest(receipt.pointer_authority?.authority_digest, 'Preview Latest authority digest');
  }
  requireEqual(
    receipt.pointer_authority?.failure_policy,
    'preserve_current_latest_lkg',
    'Latest failure policy',
  );
  requireEqual(
    receipt.pointer_authority?.stable_reclaim,
    'next_qualified_stable',
    'Latest Stable reclaim policy',
  );
  requireEqual(receipt.bundle_digest, authority.bundleDigest, 'Latest admission bundle_digest');
  requireEqual(receipt.candidate?.display_version, authority.candidateDisplayVersion, 'Latest admission display version');
  requireEqual(receipt.candidate?.updater_version, authority.candidateUpdaterVersion, 'Latest admission updater version');
  requireEqual(receipt.candidate?.app_sha, authority.appSha, 'Latest admission app_sha');
  requireEqual(receipt.candidate?.shell_sha, authority.shellSha, 'Latest admission shell_sha');
  requireEqual(receipt.candidate?.framework_sha, authority.frameworkSha, 'Latest admission framework_sha');

  const expectedZipName = `One-Person-Lab-${authority.candidateDisplayVersion}-mac-arm64.zip`;
  const statusZip = authority.standardAssets.filter((asset) => asset?.name === expectedZipName);
  if (statusZip.length !== 1) {
    throw new Error(`Framework status must contain exactly one ${expectedZipName}.`);
  }
  requireEqual(receipt.candidate?.zip?.name, expectedZipName, 'Latest admission ZIP name');
  requireEqual(
    requireDigest(receipt.candidate?.zip?.sha256, 'Latest admission ZIP sha256'),
    requireDigest(statusZip[0].sha256, 'Framework status ZIP sha256'),
    'Latest admission ZIP sha256',
  );
  requireEqual(
    requirePositiveInteger(receipt.candidate?.zip?.size_bytes, 'Latest admission ZIP size'),
    requirePositiveInteger(statusZip[0].size_bytes, 'Framework status ZIP size'),
    'Latest admission ZIP size',
  );

  requireEqual(
    receipt.updater_predecessor_policy?.schema,
    'opl_standard_updater_predecessor_policy.v1',
    'Updater predecessor policy schema',
  );
  const policyCurrentLatestTag = requireLatestReleaseTag(
    receipt.updater_predecessor_policy?.current_latest_tag,
    'Updater predecessor current Latest tag',
  );
  const policyHighestPublicStableTag = requireStableReleaseTag(
    receipt.updater_predecessor_policy?.highest_public_stable_tag,
    'Updater predecessor highest public Stable tag',
  );
  const requiredBaselineTags = [...new Set([
    policyCurrentLatestTag,
    policyHighestPublicStableTag,
  ])].sort();
  requireEqual(
    receipt.updater_predecessor_policy?.distinct_predecessor_count,
    requiredBaselineTags.length,
    'Updater predecessor distinct count',
  );
  if (
    !Array.isArray(receipt.updater_receipts)
    || receipt.updater_receipts.length !== requiredBaselineTags.length
  ) {
    throw new Error('Latest admission receipt must bind the dynamic current Latest and highest public Stable predecessors.');
  }
  const baselineTags = receipt.updater_receipts
    .map((entry: JsonRecord) => `v${String(entry?.baseline?.display_version ?? '').replace(/^v/, '')}`)
    .sort();
  if (JSON.stringify(baselineTags) !== JSON.stringify(requiredBaselineTags)) {
    throw new Error('Latest admission receipt predecessor evidence does not match its dynamic policy.');
  }
  for (const entry of receipt.updater_receipts) {
    if (typeof entry?.baseline?.updater_version !== 'string' || !entry.baseline.updater_version) {
      throw new Error('Latest admission predecessor updater version is missing.');
    }
    requireDigest(entry.operation_input_digest, 'Updater operation input_digest');
    requireDigest(entry.updater_receipt_sha256, 'Updater receipt sha256');
    requireDigest(entry.candidate_identity_sha256, 'Updater candidate identity sha256');
  }
  const expectedCurrentTag = requireLatestReleaseTag(
    receipt.latest_compare_and_swap?.expected_current?.tag,
    'Latest admission expected current tag',
  );
  requireEqual(expectedCurrentTag, policyCurrentLatestTag, 'Latest admission policy current Latest tag');
  const expectedCurrentPredecessors = receipt.updater_receipts.filter(
    (entry: JsonRecord) => `v${String(entry?.baseline?.display_version ?? '').replace(/^v/, '')}` === expectedCurrentTag,
  );
  if (expectedCurrentPredecessors.length !== 1) {
    throw new Error('Latest admission expected current tag must identify exactly one admitted predecessor.');
  }
  requireEqual(
    receipt.latest_compare_and_swap?.expected_current?.display_version,
    expectedCurrentPredecessors[0].baseline.display_version,
    'Latest admission expected current display version',
  );
  requireEqual(
    receipt.latest_compare_and_swap?.expected_current?.updater_version,
    expectedCurrentPredecessors[0].baseline.updater_version,
    'Latest admission expected current updater version',
  );
  requireEqual(
    requireCandidateReleaseTag(
      receipt.latest_compare_and_swap?.candidate?.tag,
      publicationChannel,
      'Latest admission candidate tag',
    ),
    `v${authority.candidateDisplayVersion}`,
    'Latest admission candidate tag',
  );
  if (expectedCurrentTag === receipt.latest_compare_and_swap.candidate.tag) {
    throw new Error('Latest admission compare-and-swap predecessor must differ from the candidate.');
  }
  requireDigest(receipt.standard_assets_sha256, 'Standard assets receipt sha256');
  if (publicationChannel === 'stable') {
    requireDigest(receipt.homebrew?.publication_receipt_sha256, 'Homebrew publication receipt sha256');
    requireDigest(receipt.homebrew?.clean_vm_receipt_sha256, 'Homebrew clean VM receipt sha256');
    requireDigest(receipt.homebrew?.readback_receipt_sha256, 'Homebrew readback receipt sha256');
  } else if (receipt.homebrew !== null) {
    throw new Error('Preview Latest admission must not claim Homebrew publication evidence.');
  }

  const inputEvidence = {
    ...(receiptPublicationChannel === undefined ? {} : { publication_channel: receiptPublicationChannel }),
    operation: receipt.operation,
    classification: receipt.classification,
    component_manifest: receipt.component_manifest,
    pointer_authority: receipt.pointer_authority,
    bundle_digest: receipt.bundle_digest,
    candidate: receipt.candidate,
    standard_assets_sha256: receipt.standard_assets_sha256,
    updater_predecessor_policy: receipt.updater_predecessor_policy,
    updater_receipts: receipt.updater_receipts,
    homebrew: receipt.homebrew,
    latest_compare_and_swap: receipt.latest_compare_and_swap,
  };
  requireEqual(
    receipt.input_digest,
    `sha256:${crypto.createHash('sha256').update(JSON.stringify(inputEvidence)).digest('hex')}`,
    'Latest admission input_digest',
  );
}

export function validateStandardLatestAdmission(input: StandardLatestAdmissionInput): JsonRecord {
  assertUpdaterVersionMatchesDisplay(
    input.publicationChannel,
    input.candidateDisplayVersion,
    input.candidateUpdaterVersion,
  );
  const bundleDigest = requireDigest(input.bundleDigest, 'bundle_digest');
  for (const [label, value] of [
    ['app_sha', input.appSha],
    ['shell_sha', input.shellSha],
    ['framework_sha', input.frameworkSha],
  ] as const) {
    if (!shaPattern.test(value)) throw new Error(`${label} must be an exact lowercase Git SHA.`);
  }
  if (!input.candidateDisplayVersion || !input.candidateUpdaterVersion) {
    throw new Error('Candidate display and updater versions are required.');
  }

  const expectedPredecessors = input.predecessors.map(parsePredecessor);
  const expectedByDisplay = new Map(expectedPredecessors.map((entry) => [entry.displayVersion, entry]));
  const observedPredecessorVersions = [...expectedByDisplay.keys()].sort();
  const expectedCurrentLatestTag = requireLatestReleaseTag(
    input.expectedCurrentLatestTag,
    'Expected current Latest tag',
  );
  const highestPublicStableTag = requireStableReleaseTag(
    input.highestPublicStableTag,
    'Highest public Stable tag',
  );
  const requiredPredecessorVersions = [...new Set([
    expectedCurrentLatestTag,
    highestPublicStableTag,
  ].map((tag) => tag.slice(1)))].sort();
  if (
    expectedPredecessors.length !== requiredPredecessorVersions.length
    || expectedByDisplay.size !== expectedPredecessors.length
    || JSON.stringify(observedPredecessorVersions) !== JSON.stringify(requiredPredecessorVersions)
  ) {
    throw new Error('Latest admission requires exactly the current Latest and highest public Stable predecessor identities.');
  }
  if (input.updaterEvidenceDirs.length !== expectedByDisplay.size) {
    throw new Error('Every distinct predecessor requires one real updater evidence directory.');
  }
  const expectedCurrentLatest = expectedPredecessors.filter(
    (entry) => `v${entry.displayVersion}` === expectedCurrentLatestTag,
  );
  if (expectedCurrentLatest.length !== 1) {
    throw new Error('Expected current Latest tag must identify exactly one admitted updater predecessor.');
  }
  if (expectedCurrentLatestTag === `v${input.candidateDisplayVersion}`) {
    throw new Error('Expected current Latest tag must differ from the candidate tag.');
  }
  if (highestPublicStableTag === `v${input.candidateDisplayVersion}`) {
    throw new Error('Highest public Stable tag must differ from the candidate tag.');
  }
  const componentManifestPath = path.resolve(input.componentManifestPath);
  const componentManifest = validateComponentManifest(componentManifestPath, input);
  let pointerAuthority: JsonRecord;
  if (input.publicationChannel === 'stable') {
    if (input.latestOverrideAuthorityPath !== undefined) {
      throw new Error('Qualified Stable Latest admission must not consume Preview override authority.');
    }
    pointerAuthority = {
      mode: 'qualified_stable_default',
      single_use: false,
      persistent_override: false,
      authority_digest: null,
      failure_policy: 'preserve_current_latest_lkg',
      stable_reclaim: 'next_qualified_stable',
    };
  } else {
    if (!input.latestOverrideAuthorityPath) {
      throw new Error('Preview Latest admission requires protected single-use user authority.');
    }
    const overrideAuthority = validateLatestOverrideAuthority(
      input.latestOverrideAuthorityPath,
      componentManifest,
      expectedCurrentLatestTag,
    );
    pointerAuthority = {
      mode: 'protected_single_use_exact_version',
      single_use: true,
      persistent_override: false,
      authority_digest: overrideAuthority.authority_digest,
      failure_policy: 'preserve_current_latest_lkg',
      stable_reclaim: 'next_qualified_stable',
    };
  }

  const standardAssetsPath = path.resolve(input.standardAssetsPath);
  const standardAssets = readJson(standardAssetsPath);
  requireEqual(standardAssets.surface_kind, 'opl_release_bundle_staged_assets.v1', 'Standard assets surface_kind');
  requireEqual(standardAssets.bundle_digest, bundleDigest, 'Standard assets bundle_digest');
  requireEqual(standardAssets.track, 'standard', 'Standard assets track');
  const zipName = `One-Person-Lab-${input.candidateDisplayVersion}-mac-arm64.zip`;
  const zipEntries = Array.isArray(standardAssets.assets)
    ? standardAssets.assets.filter((entry: JsonRecord) => entry?.name === zipName)
    : [];
  if (zipEntries.length !== 1) throw new Error(`Standard assets must contain exactly one ${zipName}.`);
  const bundleZip = {
    name: zipName,
    sha256: requireDigest(zipEntries[0].sha256, 'Standard candidate ZIP sha256'),
    size_bytes: requirePositiveInteger(zipEntries[0].size_bytes, 'Standard candidate ZIP size'),
  };
  const dmgName = `One-Person-Lab-${input.candidateDisplayVersion}-mac-arm64.dmg`;
  const dmgEntries = Array.isArray(standardAssets.assets)
    ? standardAssets.assets.filter((entry: JsonRecord) => entry?.name === dmgName)
    : [];
  if (dmgEntries.length !== 1) throw new Error(`Standard assets must contain exactly one ${dmgName}.`);
  const bundleDmg = {
    name: dmgName,
    sha256: requireDigest(dmgEntries[0].sha256, 'Standard candidate DMG sha256'),
    size_bytes: requirePositiveInteger(dmgEntries[0].size_bytes, 'Standard candidate DMG size'),
  };
  const componentManifestEntries = Array.isArray(standardAssets.assets)
    ? standardAssets.assets.filter((entry: JsonRecord) => entry?.name === 'opl-app-component-manifest.json')
    : [];
  if (componentManifestEntries.length !== 1) {
    throw new Error('Standard assets must contain exactly one opl-app-component-manifest.json.');
  }
  requireEqual(
    requireDigest(componentManifestEntries[0].sha256, 'Staged component manifest sha256'),
    sha256File(componentManifestPath),
    'Staged component manifest sha256',
  );

  const observedBaselines = new Set<string>();
  const updaterReceipts = input.updaterEvidenceDirs.map((directory) => {
    const receiptPath = evidenceFile(directory, 'updater-upgrade-qualification-receipt.json');
    const identityPath = evidenceFile(directory, 'candidate-zip-identity.json');
    const inputDigestPath = evidenceFile(directory, 'input-digest.txt');
    const receipt = readJson(receiptPath);
    const identity = readJson(identityPath);
    const operationInputDigest = fs.readFileSync(inputDigestPath, 'utf8').trim();
    requireDigest(operationInputDigest, 'Updater operation input_digest');
    requireEqual(receipt.schema, 'opl_updater_upgrade_qualification_receipt.v1', 'Updater receipt schema');
    requireEqual(receipt.status, 'passed', 'Updater receipt status');
    requireEqual(receipt.latest_activation_allowed, true, 'Updater Latest admission');
    requireEqual(receipt.bundle_digest, bundleDigest, 'Updater receipt bundle_digest');
    requireEqual(receipt.cohort?.app_sha, input.appSha, 'Updater receipt app_sha');
    requireEqual(receipt.cohort?.shell_sha, input.shellSha, 'Updater receipt shell_sha');
    requireEqual(receipt.cohort?.framework_sha, input.frameworkSha, 'Updater receipt framework_sha');
    const baselineDisplay = String(receipt.baseline?.display_version ?? '').replace(/^v/, '');
    const expected = expectedByDisplay.get(baselineDisplay);
    if (!expected || observedBaselines.has(baselineDisplay)) {
      throw new Error(`Unexpected or duplicate updater predecessor ${baselineDisplay || '<missing>'}.`);
    }
    observedBaselines.add(baselineDisplay);
    requireEqual(receipt.baseline?.updater_version, expected.updaterVersion, 'Predecessor updater version');
    requireEqual(receipt.candidate?.display_version, input.candidateDisplayVersion, 'Candidate display version');
    requireEqual(receipt.candidate?.updater_version, input.candidateUpdaterVersion, 'Candidate updater version');
    for (const [label, value] of [
      ['same candidate ZIP downloaded', receipt.qualification?.same_candidate_zip_downloaded],
      ['install and restart completed', receipt.qualification?.install_and_restart_completed],
      ['second updater check reported no update', receipt.qualification?.second_check_no_update],
    ] as const) requireEqual(value, true, label);
    requireEqual(receipt.qualification?.installed_app_version, input.candidateUpdaterVersion, 'Installed App updater version');
    requireEqual(receipt.qualification?.allow_downgrade, false, 'Updater downgrade policy');

    requireEqual(identity.schema, 'opl_updater_candidate_zip_identity.v1', 'Candidate ZIP identity schema');
    const identitySha = requireRawDigest(identity.sha256, 'Candidate ZIP identity sha256');
    const identitySize = requirePositiveInteger(identity.size_bytes, 'Candidate ZIP identity size');
    const receiptSha = requireRawDigest(receipt.candidate?.feed?.zip?.sha256, 'Updater receipt candidate ZIP sha256');
    const receiptSize = requirePositiveInteger(receipt.candidate?.feed?.zip?.size_bytes, 'Updater receipt candidate ZIP size');
    requireEqual(`sha256:${identitySha}`, bundleZip.sha256, 'Candidate ZIP identity sha256');
    requireEqual(identitySize, bundleZip.size_bytes, 'Candidate ZIP identity size');
    requireEqual(receiptSha, identitySha, 'Downloaded candidate ZIP sha256');
    requireEqual(receiptSize, identitySize, 'Downloaded candidate ZIP size');
    return {
      baseline: { display_version: baselineDisplay, updater_version: expected.updaterVersion },
      operation_input_digest: operationInputDigest,
      updater_receipt_sha256: sha256File(receiptPath),
      candidate_identity_sha256: sha256File(identityPath),
    };
  }).sort((left, right) => left.baseline.display_version.localeCompare(right.baseline.display_version));
  if (observedBaselines.size !== expectedByDisplay.size) throw new Error('Updater predecessor evidence is incomplete.');

  let homebrewEvidence: JsonRecord | null = null;
  if (input.publicationChannel === 'stable') {
    const publicationPath = path.resolve(required(input.homebrewPublicationPath, 'homebrew-publication'));
    const vmPath = path.resolve(required(input.homebrewVmPath, 'homebrew-vm'));
    const readbackPath = path.resolve(required(input.homebrewReadbackPath, 'homebrew-readback'));
    const publication = readJson(publicationPath);
    const vm = readJson(vmPath);
    const readback = readJson(readbackPath);
    requireEqual(publication.schema, 'opl_bundle_homebrew_publication_receipt.v1', 'Homebrew publication schema');
    requireEqual(publication.status, 'passed', 'Homebrew publication status');
    requireEqual(publication.track, 'standard', 'Homebrew publication track');
    requireEqual(publication.bundle_digest, bundleDigest, 'Homebrew publication bundle_digest');
    requireEqual(publication.release_version, input.candidateDisplayVersion, 'Homebrew release version');
    requireEqual(publication.updater_version, input.candidateUpdaterVersion, 'Homebrew updater version');
    requireEqual(publication.tap_repository, standardTapRepository, 'Homebrew tap repository');
    if (!shaPattern.test(String(publication.tap_commit ?? ''))) {
      throw new Error('Homebrew publication tap_commit must be exact.');
    }
    requireEqual(publication.cask?.path, standardCaskPath, 'Homebrew Standard cask path');
    requireDigest(publication.cask?.sha256, 'Homebrew cask sha256');
    requireEqual(publication.artifact?.name, bundleDmg.name, 'Homebrew DMG name');
    requireEqual(
      requireDigest(publication.artifact?.sha256, 'Homebrew DMG sha256'),
      bundleDmg.sha256,
      'Homebrew DMG sha256',
    );
    const releaseBase = `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${input.candidateDisplayVersion}`;
    requireEqual(publication.artifact?.url, `${releaseBase}/${bundleDmg.name}`, 'Homebrew DMG URL');
    requireEqual(
      publication.component_manifest_url,
      `${releaseBase}/opl-app-component-manifest.json`,
      'Homebrew component manifest URL',
    );
    requireEqual(vm.surface_id, 'opl_tart_gui_first_run_smoke', 'Homebrew clean VM surface');
    requireEqual(vm.status, 'passed', 'Homebrew clean VM status');
    requireEqual(vm.smoke_profile, 'homebrew-standard-cask', 'Homebrew clean VM smoke profile');
    requireEqual(vm.runtime_profile, 'standard', 'Homebrew clean VM runtime profile');
    if (
      !Array.isArray(vm.homebrew_install_attempts)
      || vm.homebrew_install_attempts.length < 1
      || vm.homebrew_install_attempts.at(-1)?.status !== 'passed'
    ) {
      throw new Error('Homebrew clean VM must contain a passed cask installation attempt.');
    }
    requireEqual(readback.schema, 'opl_bundle_homebrew_readback_receipt.v1', 'Homebrew readback schema');
    requireEqual(readback.status, 'passed', 'Homebrew readback status');
    requireEqual(readback.track, 'standard', 'Homebrew readback track');
    requireEqual(readback.bundle_digest, bundleDigest, 'Homebrew readback bundle_digest');
    requireEqual(readback.release_version, input.candidateDisplayVersion, 'Homebrew readback release version');
    requireEqual(readback.updater_version, input.candidateUpdaterVersion, 'Homebrew readback updater version');
    requireEqual(
      readback.publication_receipt_sha256,
      sha256File(publicationPath),
      'Homebrew publication receipt digest',
    );
    requireEqual(readback.clean_vm_receipt_sha256, sha256File(vmPath), 'Homebrew clean VM receipt digest');
    homebrewEvidence = {
      publication_receipt_sha256: sha256File(publicationPath),
      clean_vm_receipt_sha256: sha256File(vmPath),
      readback_receipt_sha256: sha256File(readbackPath),
    };
  } else if (
    input.homebrewPublicationPath !== undefined
    || input.homebrewVmPath !== undefined
    || input.homebrewReadbackPath !== undefined
  ) {
    throw new Error('Preview Latest admission rejects Homebrew evidence.');
  }

  const classification = expectedClassification(input.publicationChannel);
  const inputEvidence = {
    publication_channel: input.publicationChannel,
    operation: 'move_latest_pointer',
    classification: {
      quality_status: classification.qualityStatus,
      build_trigger: classification.buildTrigger,
      preview_kind: classification.previewKind,
      quality_unchanged: true,
      non_stable_notice: classification.qualityStatus === 'preview',
      skipped_gates: componentManifest.qualification_disclosure?.skipped_gates ?? [],
      failed_gates: componentManifest.qualification_disclosure?.failed_gates ?? [],
    },
    component_manifest: {
      manifest_digest: componentManifest.component_manifest_digest,
      file_sha256: sha256File(componentManifestPath),
      source_commit: componentManifest.source_commit,
      artifact_digest: componentManifest.primary_artifact.digest,
    },
    pointer_authority: pointerAuthority,
    bundle_digest: bundleDigest,
    candidate: {
      display_version: input.candidateDisplayVersion,
      updater_version: input.candidateUpdaterVersion,
      app_sha: input.appSha,
      shell_sha: input.shellSha,
      framework_sha: input.frameworkSha,
      zip: bundleZip,
    },
    standard_assets_sha256: sha256File(standardAssetsPath),
    updater_predecessor_policy: {
      schema: 'opl_standard_updater_predecessor_policy.v1',
      current_latest_tag: expectedCurrentLatestTag,
      highest_public_stable_tag: highestPublicStableTag,
      distinct_predecessor_count: requiredPredecessorVersions.length,
    },
    updater_receipts: updaterReceipts,
    homebrew: homebrewEvidence,
    latest_compare_and_swap: {
      expected_current: {
        tag: expectedCurrentLatestTag,
        display_version: expectedCurrentLatest[0].displayVersion,
        updater_version: expectedCurrentLatest[0].updaterVersion,
      },
      candidate: { tag: `v${input.candidateDisplayVersion}` },
    },
  };
  return {
    schema: 'opl_standard_latest_admission_receipt.v1',
    status: 'passed',
    latest_activation_admitted: true,
    input_digest: `sha256:${crypto.createHash('sha256').update(JSON.stringify(inputEvidence)).digest('hex')}`,
    ...inputEvidence,
  };
}

function required(value: string | undefined, flag: string): string {
  if (!value?.trim()) throw new Error(`Missing --${flag}.`);
  return value.trim();
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      bundle: { type: 'string' },
      'publication-channel': { type: 'string' },
      'candidate-display-version': { type: 'string' },
      'candidate-updater-version': { type: 'string' },
      'app-sha': { type: 'string' },
      'shell-sha': { type: 'string' },
      'framework-sha': { type: 'string' },
      'standard-assets': { type: 'string' },
      'component-manifest': { type: 'string' },
      'expected-current-latest-tag': { type: 'string' },
      'highest-public-stable-tag': { type: 'string' },
      predecessor: { type: 'string', multiple: true },
      'updater-evidence': { type: 'string', multiple: true },
      'latest-override-authority': { type: 'string' },
      'homebrew-publication': { type: 'string' },
      'homebrew-vm': { type: 'string' },
      'homebrew-readback': { type: 'string' },
      output: { type: 'string' },
    },
  });
  if (
    values['publication-channel'] !== 'stable'
    && values['publication-channel'] !== 'preview'
    && values['publication-channel'] !== 'nightly'
  ) {
    throw new Error('--publication-channel must be stable, preview, or nightly.');
  }
  const receipt = validateStandardLatestAdmission({
    publicationChannel: values['publication-channel'],
    bundleDigest: required(values.bundle, 'bundle'),
    candidateDisplayVersion: required(values['candidate-display-version'], 'candidate-display-version'),
    candidateUpdaterVersion: required(values['candidate-updater-version'], 'candidate-updater-version'),
    appSha: required(values['app-sha'], 'app-sha'),
    shellSha: required(values['shell-sha'], 'shell-sha'),
    frameworkSha: required(values['framework-sha'], 'framework-sha'),
    standardAssetsPath: required(values['standard-assets'], 'standard-assets'),
    componentManifestPath: required(values['component-manifest'], 'component-manifest'),
    expectedCurrentLatestTag: required(values['expected-current-latest-tag'], 'expected-current-latest-tag'),
    highestPublicStableTag: required(values['highest-public-stable-tag'], 'highest-public-stable-tag'),
    predecessors: values.predecessor ?? [],
    updaterEvidenceDirs: values['updater-evidence'] ?? [],
    latestOverrideAuthorityPath: values['latest-override-authority']?.trim() || undefined,
    homebrewPublicationPath: values['homebrew-publication']?.trim() || undefined,
    homebrewVmPath: values['homebrew-vm']?.trim() || undefined,
    homebrewReadbackPath: values['homebrew-readback']?.trim() || undefined,
  });
  const output = path.resolve(required(values.output, 'output'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
