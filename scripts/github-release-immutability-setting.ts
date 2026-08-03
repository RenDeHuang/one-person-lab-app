#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

type JsonRecord = Record<string, any>;
type Phase = 'preflight' | 'disabled' | 'restored';
type UnpublishedOutcome = 'not_published' | 'unknown';

const canonicalRepository = 'gaofeng21cn/one-person-lab-app';
const apiVersion = '2026-03-10';

function digest(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function requireRepository(repository: string): string {
  if (repository !== canonicalRepository) {
    throw new Error(`Repository immutability control is restricted to ${canonicalRepository}.`);
  }
  return repository;
}

function assertSetting(value: unknown, expectedEnabled: boolean): JsonRecord {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || (value as JsonRecord).enabled !== expectedEnabled
    || typeof (value as JsonRecord).enforced_by_owner !== 'boolean'
  ) {
    throw new Error(`Repository immutable release setting must read back enabled=${expectedEnabled}.`);
  }
  return value as JsonRecord;
}

export function assertImmutabilitySettingReceipt(
  value: unknown,
  phase?: Phase,
  priorReceipt?: unknown,
  priorPriorReceipt?: unknown,
): JsonRecord {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || (value as JsonRecord).schema !== 'opl_app_github_immutability_setting_receipt.v1'
    || (value as JsonRecord).status !== 'passed'
    || !['preflight', 'disabled', 'restored'].includes(String((value as JsonRecord).phase ?? ''))
    || (phase && (value as JsonRecord).phase !== phase)
    || (value as JsonRecord).repository !== canonicalRepository
    || typeof (value as JsonRecord).observed_at !== 'string'
    || !Number.isFinite(Date.parse((value as JsonRecord).observed_at))
  ) {
    throw new Error('GitHub immutability setting receipt is invalid.');
  }
  const receipt = value as JsonRecord;
  const receiptPhase = receipt.phase as Phase;
  const expectedEnabled = receiptPhase !== 'disabled';
  if (
    !receipt.setting
    || typeof receipt.setting !== 'object'
    || Array.isArray(receipt.setting)
    || receipt.setting.enabled !== expectedEnabled
    || receipt.setting.enforced_by_owner !== false
    || receipt.applies_to !== 'future_releases_only'
    || receipt.retroactive_lock_claimed !== false
  ) {
    throw new Error(`GitHub immutability ${receiptPhase} receipt has invalid setting semantics.`);
  }
  if (receiptPhase === 'preflight') {
    if (
      receipt.prior_receipt_sha256 !== null
      || receipt.publication_outcome !== null
      || receipt.candidate_release !== null
      || receipt.candidate_native_immutable !== null
      || receipt.candidate_protection !== null
    ) {
      throw new Error('GitHub immutability preflight receipt contains forbidden candidate state.');
    }
    return receipt;
  }
  if (priorReceipt === undefined) {
    throw new Error(`GitHub immutability ${receiptPhase} receipt requires its exact prior receipt.`);
  }
  const priorPhase: Phase = receiptPhase === 'disabled' ? 'preflight' : 'disabled';
  const prior = assertImmutabilitySettingReceipt(
    priorReceipt,
    priorPhase,
    priorPhase === 'disabled' ? priorPriorReceipt : undefined,
  );
  if (receipt.prior_receipt_sha256 !== digest(prior)) {
    throw new Error(`GitHub immutability ${receiptPhase} receipt prior digest is broken.`);
  }
  if (receiptPhase === 'disabled') {
    if (
      receipt.publication_outcome !== null
      || receipt.candidate_release !== null
      || receipt.candidate_native_immutable !== null
      || receipt.candidate_protection !== null
    ) {
      throw new Error('GitHub immutability disabled receipt contains forbidden candidate state.');
    }
    return receipt;
  }
  if (receipt.publication_outcome === 'not_published' || receipt.publication_outcome === 'unknown') {
    if (
      receipt.candidate_release !== null
      || receipt.candidate_native_immutable !== null
      || receipt.candidate_protection !== null
    ) {
      throw new Error('Restore receipt without an exact published candidate must not claim candidate state.');
    }
    return receipt;
  }
  const candidate = receipt.candidate_release;
  if (
    receipt.publication_outcome !== 'published_mutable_standard'
    || !candidate
    || !Number.isSafeInteger(candidate.id)
    || candidate.id <= 0
    || !/^v[0-9]+\.[0-9]+\.[0-9]+(?:-r[1-9][0-9]*)?$/.test(String(candidate.tag ?? ''))
    || candidate.immutable !== false
    || receipt.candidate_native_immutable !== false
    || receipt.candidate_protection !== 'workflow_asset_name_digest_cas_and_unified_attestation'
  ) {
    throw new Error('Restored receipt does not bind one exact published mutable Standard.');
  }
  return receipt;
}

export function buildSettingReceipt(input: {
  phase: Phase;
  setting: unknown;
  observedAt: string;
  priorReceipt?: unknown;
  preflightReceipt?: unknown;
  release?: { id: number; tag: string; immutable: boolean };
  publicationOutcome?: UnpublishedOutcome;
}): JsonRecord {
  const expectedEnabled = input.phase !== 'disabled';
  const setting = assertSetting(input.setting, expectedEnabled);
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error('observedAt must be ISO-8601.');
  let prior: JsonRecord | null = null;
  if (input.phase !== 'preflight') {
    prior = assertImmutabilitySettingReceipt(
      input.priorReceipt,
      input.phase === 'disabled' ? 'preflight' : 'disabled',
      input.phase === 'restored' ? input.preflightReceipt : undefined,
    );
  }
  if (input.phase === 'preflight' && setting.enforced_by_owner !== false) {
    throw new Error('Repository owner enforcement prevents the controlled mutable Standard model.');
  }
  if (input.phase === 'restored') {
    if (input.release && input.publicationOutcome !== undefined) {
      throw new Error('A restored receipt cannot combine an exact candidate with an unpublished outcome.');
    }
    if (!input.release && input.publicationOutcome !== undefined
      && !['not_published', 'unknown'].includes(input.publicationOutcome)) {
      throw new Error('Restore publication outcome must be not_published or unknown.');
    }
    if (input.release && (
      !Number.isSafeInteger(input.release.id)
      || input.release.id <= 0
      || !/^v[0-9]+\.[0-9]+\.[0-9]+(?:-r[1-9][0-9]*)?$/.test(input.release.tag)
      || input.release.immutable !== false
    )) {
      throw new Error('Restore receipt must bind the exact published mutable Standard release.');
    }
  }
  return {
    schema: 'opl_app_github_immutability_setting_receipt.v1',
    status: 'passed',
    phase: input.phase,
    repository: canonicalRepository,
    observed_at: input.observedAt,
    setting: {
      enabled: setting.enabled,
      enforced_by_owner: setting.enforced_by_owner,
    },
    prior_receipt_sha256: prior ? digest(prior) : null,
    applies_to: 'future_releases_only',
    publication_outcome: input.phase === 'restored'
      ? (input.release ? 'published_mutable_standard' : (input.publicationOutcome ?? 'not_published'))
      : null,
    candidate_release: input.phase === 'restored' ? (input.release ?? null) : null,
    candidate_native_immutable: input.phase === 'restored' && input.release ? false : null,
    candidate_protection: input.phase === 'restored' && input.release
      ? 'workflow_asset_name_digest_cas_and_unified_attestation'
      : null,
    retroactive_lock_claimed: false,
  };
}

function ghApi(repository: string, method: 'GET' | 'DELETE' | 'PUT'): JsonRecord | null {
  const result = spawnSync('gh', [
    'api',
    '--method', method,
    `repos/${repository}/immutable-releases`,
    '-H', `X-GitHub-Api-Version: ${apiVersion}`,
  ], { encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `GitHub immutable release ${method} failed.`);
  }
  const output = result.stdout.trim();
  return output ? JSON.parse(output) : null;
}

function inspectRelease(repository: string, releaseId: string, tag: string): JsonRecord {
  if (!/^[1-9][0-9]*$/.test(releaseId)) throw new Error('release-id must be a positive integer.');
  const result = spawnSync('gh', [
    'api',
    `repos/${repository}/releases/${releaseId}`,
    '-H', `X-GitHub-Api-Version: ${apiVersion}`,
  ], { encoding: 'utf8', env: process.env });
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Standard release inspection failed.');
  const release = JSON.parse(result.stdout) as JsonRecord;
  if (String(release.id) !== releaseId || release.tag_name !== tag || release.draft !== false) {
    throw new Error('Standard release inspection does not match the exact published target.');
  }
  return { id: Number(release.id), tag, immutable: release.immutable === true };
}

function main(argv: string[]): void {
  const command = argv[0];
  if (!['preflight', 'disable', 'restore'].includes(command)) {
    throw new Error('Usage: github-release-immutability-setting.ts <preflight|disable|restore> ...');
  }
  const { values } = parseArgs({
    args: argv.slice(1),
    strict: true,
    options: {
      repository: { type: 'string' },
      output: { type: 'string' },
      preflight: { type: 'string' },
      disabled: { type: 'string' },
      'release-id': { type: 'string' },
      tag: { type: 'string' },
      'publication-outcome': { type: 'string' },
    },
  });
  const repository = requireRepository(String(values.repository ?? ''));
  const output = path.resolve(String(values.output ?? ''));
  if (!values.output) throw new Error('--output is required.');
  const observedAt = new Date().toISOString();
  let receipt: JsonRecord;
  if (command === 'preflight') {
    receipt = buildSettingReceipt({ phase: 'preflight', setting: ghApi(repository, 'GET'), observedAt });
  } else if (command === 'disable') {
    const preflight = readJson(String(values.preflight ?? ''));
    assertImmutabilitySettingReceipt(preflight, 'preflight');
    ghApi(repository, 'DELETE');
    receipt = buildSettingReceipt({
      phase: 'disabled',
      setting: ghApi(repository, 'GET'),
      observedAt,
      priorReceipt: preflight,
    });
  } else {
    const preflight = readJson(String(values.preflight ?? ''));
    const disabled = readJson(String(values.disabled ?? ''));
    assertImmutabilitySettingReceipt(disabled, 'disabled', preflight);
    ghApi(repository, 'PUT');
    const releaseId = String(values['release-id'] ?? '');
    const tag = String(values.tag ?? '');
    if ((releaseId && !tag) || (!releaseId && tag)) {
      throw new Error('Restore requires both --release-id and --tag, or neither after a failed publication.');
    }
    const publicationOutcome = String(values['publication-outcome'] ?? '');
    if (releaseId && publicationOutcome) {
      throw new Error('--publication-outcome cannot accompany an exact published release identity.');
    }
    if (!releaseId && publicationOutcome && !['not_published', 'unknown'].includes(publicationOutcome)) {
      throw new Error('--publication-outcome must be not_published or unknown.');
    }
    const release = releaseId ? inspectRelease(repository, releaseId, tag) : undefined;
    receipt = buildSettingReceipt({
      phase: 'restored',
      setting: ghApi(repository, 'GET'),
      observedAt,
      priorReceipt: disabled,
      preflightReceipt: preflight,
      release,
      publicationOutcome: release ? undefined : (publicationOutcome || 'not_published') as UnpublishedOutcome,
    });
    assertImmutabilitySettingReceipt(receipt, 'restored', disabled, preflight);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
