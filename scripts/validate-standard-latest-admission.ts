#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

type JsonRecord = Record<string, any>;

export type StandardLatestAdmissionInput = {
  bundleDigest: string;
  candidateDisplayVersion: string;
  candidateUpdaterVersion: string;
  appSha: string;
  shellSha: string;
  frameworkSha: string;
  standardAssetsPath: string;
  expectedCurrentLatestTag: string;
  predecessors: string[];
  updaterEvidenceDirs: string[];
  homebrewPublicationPath: string;
  homebrewVmPath: string;
  homebrewReadbackPath: string;
};

export type StandardLatestAdmissionAuthority = {
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
const requiredPredecessorDisplayVersions = ['26.7.20', '26.7.21'] as const;
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

function requireReleaseTag(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^v[0-9]+\.[0-9]+\.[0-9]+(?:-r[1-9][0-9]*)?$/.test(value)) {
    throw new Error(`${label} must be an exact Stable release tag.`);
  }
  return value;
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
  requireEqual(receipt.schema, 'opl_standard_latest_admission_receipt.v1', 'Latest admission schema');
  requireEqual(receipt.status, 'passed', 'Latest admission status');
  requireEqual(receipt.latest_activation_admitted, true, 'Latest activation admission');
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

  if (!Array.isArray(receipt.updater_receipts) || receipt.updater_receipts.length !== 2) {
    throw new Error('Latest admission receipt must bind exactly two updater predecessor receipts.');
  }
  const baselines = receipt.updater_receipts.map((entry: JsonRecord) => String(entry?.baseline?.display_version ?? '').replace(/^v/, '')).sort();
  if (JSON.stringify(baselines) !== JSON.stringify([...requiredPredecessorDisplayVersions].sort())) {
    throw new Error('Latest admission receipt must bind v26.7.20 and v26.7.21 updater evidence.');
  }
  for (const entry of receipt.updater_receipts) {
    if (typeof entry?.baseline?.updater_version !== 'string' || !entry.baseline.updater_version) {
      throw new Error('Latest admission predecessor updater version is missing.');
    }
    requireDigest(entry.operation_input_digest, 'Updater operation input_digest');
    requireDigest(entry.updater_receipt_sha256, 'Updater receipt sha256');
    requireDigest(entry.candidate_identity_sha256, 'Updater candidate identity sha256');
  }
  const expectedCurrentTag = requireReleaseTag(
    receipt.latest_compare_and_swap?.expected_current?.tag,
    'Latest admission expected current tag',
  );
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
    requireReleaseTag(receipt.latest_compare_and_swap?.candidate?.tag, 'Latest admission candidate tag'),
    `v${authority.candidateDisplayVersion}`,
    'Latest admission candidate tag',
  );
  if (expectedCurrentTag === receipt.latest_compare_and_swap.candidate.tag) {
    throw new Error('Latest admission compare-and-swap predecessor must differ from the candidate.');
  }
  requireDigest(receipt.standard_assets_sha256, 'Standard assets receipt sha256');
  requireDigest(receipt.homebrew?.publication_receipt_sha256, 'Homebrew publication receipt sha256');
  requireDigest(receipt.homebrew?.clean_vm_receipt_sha256, 'Homebrew clean VM receipt sha256');
  requireDigest(receipt.homebrew?.readback_receipt_sha256, 'Homebrew readback receipt sha256');

  const inputEvidence = {
    bundle_digest: receipt.bundle_digest,
    candidate: receipt.candidate,
    standard_assets_sha256: receipt.standard_assets_sha256,
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
  if (
    expectedPredecessors.length !== requiredPredecessorDisplayVersions.length
    || expectedByDisplay.size !== expectedPredecessors.length
    || JSON.stringify(observedPredecessorVersions) !== JSON.stringify([...requiredPredecessorDisplayVersions].sort())
  ) {
    throw new Error('Latest admission requires exactly the v26.7.20 and v26.7.21 public predecessor identities.');
  }
  if (input.updaterEvidenceDirs.length !== expectedByDisplay.size) {
    throw new Error('Every distinct predecessor requires one real updater evidence directory.');
  }
  const expectedCurrentLatestTag = requireReleaseTag(
    input.expectedCurrentLatestTag,
    'Expected current Latest tag',
  );
  const expectedCurrentLatest = expectedPredecessors.filter(
    (entry) => `v${entry.displayVersion}` === expectedCurrentLatestTag,
  );
  if (expectedCurrentLatest.length !== 1) {
    throw new Error('Expected current Latest tag must identify exactly one admitted updater predecessor.');
  }
  if (expectedCurrentLatestTag === `v${input.candidateDisplayVersion}`) {
    throw new Error('Expected current Latest tag must differ from the candidate tag.');
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

  const publicationPath = path.resolve(input.homebrewPublicationPath);
  const vmPath = path.resolve(input.homebrewVmPath);
  const readbackPath = path.resolve(input.homebrewReadbackPath);
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
  if (!shaPattern.test(String(publication.tap_commit ?? ''))) throw new Error('Homebrew publication tap_commit must be exact.');
  requireEqual(publication.cask?.path, standardCaskPath, 'Homebrew Standard cask path');
  requireDigest(publication.cask?.sha256, 'Homebrew cask sha256');
  requireEqual(publication.artifact?.name, bundleDmg.name, 'Homebrew DMG name');
  requireEqual(requireDigest(publication.artifact?.sha256, 'Homebrew DMG sha256'), bundleDmg.sha256, 'Homebrew DMG sha256');
  const releaseBase = `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${input.candidateDisplayVersion}`;
  requireEqual(publication.artifact?.url, `${releaseBase}/${bundleDmg.name}`, 'Homebrew DMG URL');
  requireEqual(publication.component_manifest_url, `${releaseBase}/opl-app-component-manifest.json`, 'Homebrew component manifest URL');
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
  requireEqual(readback.publication_receipt_sha256, sha256File(publicationPath), 'Homebrew publication receipt digest');
  requireEqual(readback.clean_vm_receipt_sha256, sha256File(vmPath), 'Homebrew clean VM receipt digest');

  const inputEvidence = {
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
    updater_receipts: updaterReceipts,
    homebrew: {
      publication_receipt_sha256: sha256File(publicationPath),
      clean_vm_receipt_sha256: sha256File(vmPath),
      readback_receipt_sha256: sha256File(readbackPath),
    },
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
      'candidate-display-version': { type: 'string' },
      'candidate-updater-version': { type: 'string' },
      'app-sha': { type: 'string' },
      'shell-sha': { type: 'string' },
      'framework-sha': { type: 'string' },
      'standard-assets': { type: 'string' },
      'expected-current-latest-tag': { type: 'string' },
      predecessor: { type: 'string', multiple: true },
      'updater-evidence': { type: 'string', multiple: true },
      'homebrew-publication': { type: 'string' },
      'homebrew-vm': { type: 'string' },
      'homebrew-readback': { type: 'string' },
      output: { type: 'string' },
    },
  });
  const receipt = validateStandardLatestAdmission({
    bundleDigest: required(values.bundle, 'bundle'),
    candidateDisplayVersion: required(values['candidate-display-version'], 'candidate-display-version'),
    candidateUpdaterVersion: required(values['candidate-updater-version'], 'candidate-updater-version'),
    appSha: required(values['app-sha'], 'app-sha'),
    shellSha: required(values['shell-sha'], 'shell-sha'),
    frameworkSha: required(values['framework-sha'], 'framework-sha'),
    standardAssetsPath: required(values['standard-assets'], 'standard-assets'),
    expectedCurrentLatestTag: required(values['expected-current-latest-tag'], 'expected-current-latest-tag'),
    predecessors: values.predecessor ?? [],
    updaterEvidenceDirs: values['updater-evidence'] ?? [],
    homebrewPublicationPath: required(values['homebrew-publication'], 'homebrew-publication'),
    homebrewVmPath: required(values['homebrew-vm'], 'homebrew-vm'),
    homebrewReadbackPath: required(values['homebrew-readback'], 'homebrew-readback'),
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
