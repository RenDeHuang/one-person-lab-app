#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { assertImmutabilitySettingReceipt } from './github-release-immutability-setting.ts';
import { assertAppleNotarizationReceipt, assertGatekeeperLaunchPolicy } from './macos-gatekeeper-policy.ts';
import { validateStableOperationPublicationRecord } from './stable-operation-publication-record.ts';

type JsonRecord = Record<string, any>;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function fileIdentity(filePath: string): { name: string; sha256: string; size_bytes: number } {
  const resolved = path.resolve(filePath);
  const bytes = fs.readFileSync(resolved);
  return {
    name: path.basename(resolved),
    sha256: `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`,
    size_bytes: bytes.length,
  };
}

export function createReleaseAttestation(input: {
  publicationRecord: unknown;
  gatekeeperPolicy: unknown;
  notarizationReceipt: unknown;
  notarizationReceiptSha256: string;
  componentManifestPath: string;
  preflightSettingReceipt: unknown;
  disabledSettingReceipt: unknown;
  bundleDigest: string;
}): JsonRecord {
  const publication = validateStableOperationPublicationRecord(input.publicationRecord);
  const gatekeeper = assertGatekeeperLaunchPolicy(input.gatekeeperPolicy, 'app_standard');
  const notarization = assertAppleNotarizationReceipt(input.notarizationReceipt);
  const preflightSetting = assertImmutabilitySettingReceipt(input.preflightSettingReceipt, 'preflight');
  const disabledSetting = assertImmutabilitySettingReceipt(
    input.disabledSettingReceipt,
    'disabled',
    preflightSetting,
  );
  if (!/^sha256:[0-9a-f]{64}$/.test(input.bundleDigest)) {
    throw new Error('Attestation requires the exact Framework Bundle digest.');
  }
  if (gatekeeper.team_identifier !== notarization.team_identifier) {
    throw new Error('Standard trust evidence does not bind one Developer ID team.');
  }
  if (
    !/^[0-9a-f]{64}$/.test(input.notarizationReceiptSha256)
    || gatekeeper.notarization_receipt_sha256 !== input.notarizationReceiptSha256
  ) {
    throw new Error('Standard trust evidence does not bind the exact notarization receipt bytes.');
  }
  const repository = publication.publication_target.repository;
  const tag = publication.publication_target.tag;
  const version = tag.replace(/^v/, '');
  const component = fileIdentity(input.componentManifestPath);
  if (component.name !== 'opl-app-component-manifest.json') {
    throw new Error('Attestation requires opl-app-component-manifest.json.');
  }
  return {
    schema: 'opl_app_release_attestation.v1',
    status: 'passed',
    release: {
      repository,
      tag,
      version,
      bundle_digest: input.bundleDigest,
    },
    publication_record: publication,
    standard_trust: {
      gatekeeper_launch_policy: gatekeeper,
      apple_notarization_receipt: notarization,
    },
    component_manifest: component,
    repository_immutability_window: {
      preflight: preflightSetting,
      disabled: disabledSetting,
    },
    protection: {
      github_native_immutable: false,
      repository_setting_restore_required: true,
      retroactive_lock_claimed: false,
      standard_asset_policy: 'sealed_name_size_digest_set_no_overwrite_or_delete',
      full_binding: 'full_manifest_binds_this_attestation_and_exact_full_assets',
    },
    superseded_public_assets: [
      'stable-operation-publication-record.json',
      'standard-apple-notarization-receipt.json',
      'standard-gatekeeper-launch-policy.json',
    ],
  };
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      'publication-record': { type: 'string' },
      'gatekeeper-policy': { type: 'string' },
      'notarization-receipt': { type: 'string' },
      'component-manifest': { type: 'string' },
      'disabled-setting-receipt': { type: 'string' },
      'preflight-setting-receipt': { type: 'string' },
      'bundle-digest': { type: 'string' },
      output: { type: 'string' },
    },
  });
  const required = (name: keyof typeof values): string => {
    const value = values[name];
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing --${String(name)}.`);
    return value;
  };
  const notarizationReceiptPath = required('notarization-receipt');
  const attestation = createReleaseAttestation({
    publicationRecord: readJson(required('publication-record')),
    gatekeeperPolicy: readJson(required('gatekeeper-policy')),
    notarizationReceipt: readJson(notarizationReceiptPath),
    notarizationReceiptSha256: fileIdentity(notarizationReceiptPath).sha256.replace(/^sha256:/, ''),
    componentManifestPath: required('component-manifest'),
    preflightSettingReceipt: readJson(required('preflight-setting-receipt')),
    disabledSettingReceipt: readJson(required('disabled-setting-receipt')),
    bundleDigest: required('bundle-digest'),
  });
  const output = path.resolve(required('output'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(attestation, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
