#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';

type JsonRecord = Record<string, unknown>;

const releaseVersionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
const updaterVersionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be one object.`);
  }
  return value as JsonRecord;
}

function requiredFile(filePath: string, label: string): fs.Stats {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`${label} must be one non-empty regular file.`);
  }
  return stat;
}

function digest(filePath: string, algorithm: 'sha256' | 'sha512', encoding: 'hex' | 'base64'): string {
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest(encoding);
}

function exactFileSet(actual: string[], expected: string[], label: string): void {
  if (JSON.stringify(actual.slice().sort()) !== JSON.stringify(expected.slice().sort())) {
    throw new Error(`${label} must be exactly ${expected.join(', ')}; found ${actual.join(', ') || 'none'}.`);
  }
}

export type WindowsUpdaterAssetReceipt = {
  schema: 'opl_windows_updater_assets_receipt.v1';
  status: 'passed';
  platform: 'windows-x64';
  release_version: string;
  updater_version: string;
  assets: {
    installer: { name: string; size_bytes: number; sha256: string; sha512: string };
    metadata: { name: 'latest.yml'; size_bytes: number; sha256: string };
    blockmap: { name: string; size_bytes: number; sha256: string };
  };
  metadata_binding: {
    path: string;
    file_url: string;
    size_bytes: number;
    sha512: string;
  };
  feed_resolution: 'exact_release_download_base_plus_relative_asset_name';
};

export type WindowsAuthenticodeReceipt = {
  schema: 'opl_windows_authenticode_receipt.v1';
  status: 'passed';
  platform: 'windows-x64';
  installer: { name: string; size_bytes: number; sha256: string };
  signature: {
    status: 'Valid';
    signature_type: 'Authenticode';
    signer_subject: string;
    signer_thumbprint: string;
    signer_not_before: string;
    signer_not_after: string;
    timestamp_verified: true;
    timestamper_subject: string;
    timestamper_thumbprint: string;
  };
  verification_tool: 'Get-AuthenticodeSignature';
};

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be one non-empty string.`);
  }
  return value;
}

export function validateWindowsAuthenticodeReceipt(input: {
  receiptPath: string;
  installerPath: string;
}): WindowsAuthenticodeReceipt {
  const receiptPath = path.resolve(input.receiptPath);
  requiredFile(receiptPath, 'Windows Authenticode receipt');
  const installerPath = path.resolve(input.installerPath);
  const installerStat = requiredFile(installerPath, 'Windows Authenticode installer');
  const receipt = record(JSON.parse(fs.readFileSync(receiptPath, 'utf8')), 'Windows Authenticode receipt');
  const installer = record(receipt.installer, 'Windows Authenticode receipt installer');
  const signature = record(receipt.signature, 'Windows Authenticode receipt signature');
  const sha256 = `sha256:${digest(installerPath, 'sha256', 'hex')}`;
  const thumbprintPattern = /^[0-9a-f]{40,128}$/;

  if (
    receipt.schema !== 'opl_windows_authenticode_receipt.v1'
    || receipt.status !== 'passed'
    || receipt.platform !== 'windows-x64'
    || receipt.verification_tool !== 'Get-AuthenticodeSignature'
    || installer.name !== path.basename(installerPath)
    || installer.size_bytes !== installerStat.size
    || installer.sha256 !== sha256
  ) {
    throw new Error('Windows Authenticode receipt does not bind the exact installer bytes.');
  }
  if (
    signature.status !== 'Valid'
    || signature.signature_type !== 'Authenticode'
    || signature.timestamp_verified !== true
  ) {
    throw new Error('Windows Authenticode receipt must prove a valid timestamped Authenticode signature.');
  }
  nonEmptyString(signature.signer_subject, 'Windows Authenticode signer subject');
  nonEmptyString(signature.timestamper_subject, 'Windows Authenticode timestamper subject');
  if (
    !thumbprintPattern.test(nonEmptyString(signature.signer_thumbprint, 'Windows Authenticode signer thumbprint'))
    || !thumbprintPattern.test(nonEmptyString(signature.timestamper_thumbprint, 'Windows Authenticode timestamper thumbprint'))
  ) {
    throw new Error('Windows Authenticode certificate thumbprints must be lowercase hexadecimal.');
  }
  for (const [label, value] of [
    ['Windows Authenticode signer not-before', signature.signer_not_before],
    ['Windows Authenticode signer not-after', signature.signer_not_after],
  ] as const) {
    const date = nonEmptyString(value, label);
    if (!Number.isFinite(Date.parse(date))) {
      throw new Error(`${label} must be one ISO timestamp.`);
    }
  }
  return receipt as WindowsAuthenticodeReceipt;
}

export function validateWindowsUpdaterAssets(input: {
  artifactDir: string;
  releaseVersion: string;
  updaterVersion: string;
  outputPath?: string;
}): WindowsUpdaterAssetReceipt {
  if (!releaseVersionPattern.test(input.releaseVersion)) {
    throw new Error('releaseVersion must be one valid OPL display version.');
  }
  if (!updaterVersionPattern.test(input.updaterVersion)) {
    throw new Error('updaterVersion must be one valid machine SemVer.');
  }

  const artifactDir = path.resolve(input.artifactDir);
  const dirStat = fs.lstatSync(artifactDir);
  if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) {
    throw new Error('artifactDir must be one real directory.');
  }

  const installerName = `One-Person-Lab-${input.releaseVersion}-win-x64.exe`;
  const blockmapName = `${installerName}.blockmap`;
  const entries = fs.readdirSync(artifactDir, { withFileTypes: true });
  const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  exactFileSet(fileNames.filter((name) => name.toLowerCase().endsWith('.exe')), [installerName], 'Windows updater installer set');
  exactFileSet(fileNames.filter((name) => name.toLowerCase().endsWith('.exe.blockmap')), [blockmapName], 'Windows updater blockmap set');
  exactFileSet(fileNames.filter((name) => /^latest(?:-[^.]+)?\.ya?ml$/i.test(name)), ['latest.yml'], 'Windows updater metadata set');

  const installerPath = path.join(artifactDir, installerName);
  const metadataPath = path.join(artifactDir, 'latest.yml');
  const blockmapPath = path.join(artifactDir, blockmapName);
  const installerStat = requiredFile(installerPath, 'Windows updater installer');
  const metadataStat = requiredFile(metadataPath, 'Windows updater metadata');
  const blockmapStat = requiredFile(blockmapPath, 'Windows updater blockmap');
  const installerSha512 = digest(installerPath, 'sha512', 'base64');

  const metadata = record(parseYaml(fs.readFileSync(metadataPath, 'utf8')), 'latest.yml');
  if (metadata.version !== input.updaterVersion) {
    throw new Error(`latest.yml version must equal ${input.updaterVersion}.`);
  }
  if (metadata.path !== installerName || metadata.sha512 !== installerSha512) {
    throw new Error('latest.yml top-level installer binding does not match the exact EXE bytes.');
  }
  if (!Array.isArray(metadata.files) || metadata.files.length !== 1) {
    throw new Error('latest.yml files must contain exactly one Windows installer.');
  }
  const file = record(metadata.files[0], 'latest.yml files[0]');
  if (
    file.url !== installerName
    || file.sha512 !== installerSha512
    || file.size !== installerStat.size
  ) {
    throw new Error('latest.yml files[0] does not match the exact EXE name, size, and SHA-512.');
  }

  const receipt: WindowsUpdaterAssetReceipt = {
    schema: 'opl_windows_updater_assets_receipt.v1',
    status: 'passed',
    platform: 'windows-x64',
    release_version: input.releaseVersion,
    updater_version: input.updaterVersion,
    assets: {
      installer: {
        name: installerName,
        size_bytes: installerStat.size,
        sha256: `sha256:${digest(installerPath, 'sha256', 'hex')}`,
        sha512: `sha512:${installerSha512}`,
      },
      metadata: {
        name: 'latest.yml',
        size_bytes: metadataStat.size,
        sha256: `sha256:${digest(metadataPath, 'sha256', 'hex')}`,
      },
      blockmap: {
        name: blockmapName,
        size_bytes: blockmapStat.size,
        sha256: `sha256:${digest(blockmapPath, 'sha256', 'hex')}`,
      },
    },
    metadata_binding: {
      path: installerName,
      file_url: installerName,
      size_bytes: installerStat.size,
      sha512: `sha512:${installerSha512}`,
    },
    feed_resolution: 'exact_release_download_base_plus_relative_asset_name',
  };

  if (input.outputPath) {
    const outputPath = path.resolve(input.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const temporaryPath = `${outputPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporaryPath, outputPath);
  }
  return receipt;
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      'artifact-dir': { type: 'string' },
      'release-version': { type: 'string' },
      'updater-version': { type: 'string' },
      'authenticode-receipt': { type: 'string' },
      output: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values['artifact-dir'] || !values['release-version'] || !values['updater-version']) {
    throw new Error('Usage: validate-windows-updater-assets.ts --artifact-dir <dir> --release-version <version> --updater-version <version> [--output <file>]');
  }
  const receipt = validateWindowsUpdaterAssets({
    artifactDir: values['artifact-dir'],
    releaseVersion: values['release-version'],
    updaterVersion: values['updater-version'],
    outputPath: values.output,
  });
  const authenticode = values['authenticode-receipt']
    ? validateWindowsAuthenticodeReceipt({
      receiptPath: values['authenticode-receipt'],
      installerPath: path.join(
        path.resolve(values['artifact-dir']),
        `One-Person-Lab-${values['release-version']}-win-x64.exe`,
      ),
    })
    : null;
  process.stdout.write(`${JSON.stringify(authenticode ? { updater_assets: receipt, authenticode } : receipt)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
