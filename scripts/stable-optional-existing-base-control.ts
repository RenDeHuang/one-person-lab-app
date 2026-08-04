#!/usr/bin/env node

import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

type JsonRecord = Record<string, unknown>;

const shaPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const runIdPattern = /^[1-9][0-9]*$/;
const operationIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const noncePattern = /^[0-9a-f]{32}$/;
const optionalPlatforms = ['linux-x64', 'windows-x64'] as const;
const criticalPaths = [
  '.github/workflows/release-stable-optional-existing-base.yml',
  '.github/workflows/build-manual.yml',
  'contracts/app-release-channel.json',
  'scripts/stable-optional-existing-base-control.ts',
] as const;

export type StableOptionalExistingBaseSourceQualification = {
  run_id: string;
  receipt_digest: string;
  app_sha: string;
  app_tree: string;
  shell_sha: string;
  shell_tree: string;
  framework_sha: string;
  framework_tree: string;
};

export type StableOptionalExistingBaseRelease = {
  release_id: number;
  version: '26.8.4';
  tag: 'v26.8.4';
  target_commitish: string;
  updated_at: string;
  mutable: true;
  latest_tag: 'v26.8.4';
  asset_inventory_digest: string;
};

export type StableOptionalExistingBaseAuthority = {
  schema: 'opl_app_stable_optional_existing_base_authority.v1';
  status: 'issued';
  issuance: {
    source: 'operator_issued_github_dispatch_input';
    cryptographic_signature: false;
  };
  authority_id: string;
  operation: 'stable_optional_follower_existing_base';
  operation_id: string;
  issuer: string;
  issued_at: string;
  expires_at: string;
  objective_fingerprint: string;
  nonce: string;
  nonce_digest: string;
  source_qualification: StableOptionalExistingBaseSourceQualification;
  base_release: StableOptionalExistingBaseRelease;
  platforms: ['linux-x64', 'windows-x64'];
  critical_blobs: Record<string, string>;
  pre_dispatch_evidence: {
    pre_nonce_guard: JsonRecord;
    source_qualification: {
      run_id: string;
      receipt_digest: string;
    };
    base_release: StableOptionalExistingBaseRelease;
  };
  mutation_scope: {
    standard_release: false;
    full_release: false;
    base_release: false;
    latest: false;
    adjunct_release: true;
  };
  authority_digest: string;
};

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be one JSON object.`);
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} is missing.`);
  return value;
}

function sha(value: unknown, label: string): string {
  const normalized = text(value, label).toLowerCase();
  if (!shaPattern.test(normalized)) throw new Error(`${label} must be an exact Git SHA.`);
  return normalized;
}

function digest(value: unknown, label: string): string {
  const normalized = text(value, label).toLowerCase();
  if (!digestPattern.test(normalized)) throw new Error(`${label} must be an exact SHA-256 digest.`);
  return normalized;
}

function runId(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (!runIdPattern.test(normalized)) throw new Error(`${label} must be a positive GitHub run id.`);
  return normalized;
}

function instant(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (!Number.isFinite(Date.parse(normalized)) || !normalized.endsWith('Z')) throw new Error(`${label} must be an ISO UTC instant.`);
  return normalized;
}

function nonceDigest(nonce: string): string {
  return `sha256:${crypto.createHash('sha256').update(nonce, 'utf8').digest('hex')}`;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as JsonRecord;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

function objectDigest(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function normalizeCriticalBlobs(value: unknown): Record<string, string> {
  const object = record(value, 'critical_blobs');
  const normalized = Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, digest(item, `critical_blobs.${key}`)]));
  if (JSON.stringify(Object.keys(normalized)) !== JSON.stringify([...criticalPaths].sort())) {
    throw new Error(`critical_blobs must bind exactly: ${criticalPaths.join(', ')}`);
  }
  return normalized;
}

function normalizeSource(value: unknown): StableOptionalExistingBaseSourceQualification {
  const source = record(value, 'source_qualification');
  return {
    run_id: runId(source.run_id, 'source_qualification.run_id'),
    receipt_digest: digest(source.receipt_digest, 'source_qualification.receipt_digest'),
    app_sha: sha(source.app_sha, 'source_qualification.app_sha'),
    app_tree: sha(source.app_tree, 'source_qualification.app_tree'),
    shell_sha: sha(source.shell_sha, 'source_qualification.shell_sha'),
    shell_tree: sha(source.shell_tree, 'source_qualification.shell_tree'),
    framework_sha: sha(source.framework_sha, 'source_qualification.framework_sha'),
    framework_tree: sha(source.framework_tree, 'source_qualification.framework_tree'),
  };
}

function normalizeBase(value: unknown): StableOptionalExistingBaseRelease {
  const base = record(value, 'base_release');
  if (Number.isInteger(base.release_id) === false || Number(base.release_id) <= 0) throw new Error('base_release.release_id must be positive.');
  if (base.version !== '26.8.4' || base.tag !== 'v26.8.4' || base.latest_tag !== 'v26.8.4') throw new Error('base_release must be the existing v26.8.4 cohort.');
  if (base.mutable !== true) throw new Error('base_release must remain mutable for the adjunct publisher.');
  return {
    release_id: Number(base.release_id),
    version: '26.8.4',
    tag: 'v26.8.4',
    target_commitish: sha(base.target_commitish, 'base_release.target_commitish'),
    updated_at: instant(base.updated_at, 'base_release.updated_at'),
    mutable: true,
    latest_tag: 'v26.8.4',
    asset_inventory_digest: digest(base.asset_inventory_digest, 'base_release.asset_inventory_digest'),
  };
}

function normalizePreNonce(value: unknown, operationId: string): JsonRecord {
  const guard = record(value, 'pre_nonce_guard');
  if (guard.schema !== 'opl_release_dispatch_guard.v1' || guard.phase !== 'pre_nonce' || guard.status !== 'passed' || guard.dispatch_allowed !== true || guard.operation_id !== operationId || guard.owner_run_match_count !== 0 || guard.nonce_consumed !== false) {
    throw new Error('pre_nonce_guard must prove one passed zero-consumer guard for this optional operation.');
  }
  return guard;
}

export function stableOptionalExistingBaseOperationId(input: {
  objectiveFingerprint: string;
  sourceQualification: unknown;
  baseRelease: unknown;
  criticalBlobs: unknown;
}): string {
  const identity = {
    operation: 'stable_optional_follower_existing_base',
    objective_fingerprint: text(input.objectiveFingerprint, 'objective_fingerprint'),
    source_qualification: normalizeSource(input.sourceQualification),
    base_release: normalizeBase(input.baseRelease),
    platforms: [...optionalPlatforms],
    critical_blobs: normalizeCriticalBlobs(input.criticalBlobs),
  };
  return `stable-optional-${crypto.createHash('sha256').update(canonicalJson(identity)).digest('hex').slice(0, 32)}`;
}

export function createStableOptionalExistingBaseAuthority(input: {
  authorityId: string;
  operationId: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  objectiveFingerprint: string;
  nonce: string;
  sourceQualification: unknown;
  baseRelease: unknown;
  criticalBlobs: unknown;
  preNonceGuard: unknown;
}): StableOptionalExistingBaseAuthority {
  const source = normalizeSource(input.sourceQualification);
  const base = normalizeBase(input.baseRelease);
  const criticalBlobs = normalizeCriticalBlobs(input.criticalBlobs);
  const operationId = stableOptionalExistingBaseOperationId({
    objectiveFingerprint: input.objectiveFingerprint,
    sourceQualification: source,
    baseRelease: base,
    criticalBlobs,
  });
  if (text(input.operationId, 'operation_id') !== operationId) throw new Error('operation_id must equal the deterministic existing-base optional identity.');
  const normalizedNonce = text(input.nonce, 'nonce').toLowerCase();
  if (!noncePattern.test(normalizedNonce)) throw new Error('nonce must be 16 random bytes encoded as lowercase hex.');
  const preNonceGuard = normalizePreNonce(input.preNonceGuard, operationId);
  const authorityCore = {
    schema: 'opl_app_stable_optional_existing_base_authority.v1' as const,
    status: 'issued' as const,
    issuance: { source: 'operator_issued_github_dispatch_input' as const, cryptographic_signature: false as const },
    authority_id: text(input.authorityId, 'authority_id'),
    operation: 'stable_optional_follower_existing_base' as const,
    operation_id: operationId,
    issuer: text(input.issuer, 'issuer'),
    issued_at: instant(input.issuedAt, 'issued_at'),
    expires_at: instant(input.expiresAt, 'expires_at'),
    objective_fingerprint: text(input.objectiveFingerprint, 'objective_fingerprint'),
    nonce: normalizedNonce,
    nonce_digest: nonceDigest(normalizedNonce),
    source_qualification: source,
    base_release: base,
    platforms: [...optionalPlatforms] as ['linux-x64', 'windows-x64'],
    critical_blobs: criticalBlobs,
    pre_dispatch_evidence: {
      pre_nonce_guard: preNonceGuard,
      source_qualification: { run_id: source.run_id, receipt_digest: source.receipt_digest },
      base_release: base,
    },
    mutation_scope: { standard_release: false, full_release: false, base_release: false, latest: false, adjunct_release: true },
  };
  if (Date.parse(authorityCore.expires_at) <= Date.parse(authorityCore.issued_at)) throw new Error('expires_at must be later than issued_at.');
  const authority = { ...authorityCore, authority_digest: objectDigest(authorityCore) };
  return authority;
}

export function validateStableOptionalExistingBaseAuthority(value: unknown): StableOptionalExistingBaseAuthority {
  const authority = record(value, 'Stable optional existing-base authority');
  if (authority.schema !== 'opl_app_stable_optional_existing_base_authority.v1' || authority.status !== 'issued' || authority.operation !== 'stable_optional_follower_existing_base') throw new Error('Optional existing-base authority schema, status, or operation is invalid.');
  const issuance = record(authority.issuance, 'authority.issuance');
  if (issuance.source !== 'operator_issued_github_dispatch_input' || issuance.cryptographic_signature !== false) throw new Error('Optional authority must be an operator-issued non-cryptographic dispatch input.');
  const rebuilt = createStableOptionalExistingBaseAuthority({
    authorityId: text(authority.authority_id, 'authority_id'),
    operationId: text(authority.operation_id, 'operation_id'),
    issuer: text(authority.issuer, 'issuer'),
    issuedAt: text(authority.issued_at, 'issued_at'),
    expiresAt: text(authority.expires_at, 'expires_at'),
    objectiveFingerprint: text(authority.objective_fingerprint, 'objective_fingerprint'),
    nonce: text(authority.nonce, 'nonce'),
    sourceQualification: authority.source_qualification,
    baseRelease: authority.base_release,
    criticalBlobs: authority.critical_blobs,
    preNonceGuard: record(record(authority.pre_dispatch_evidence, 'pre_dispatch_evidence').pre_nonce_guard, 'pre_dispatch_evidence.pre_nonce_guard'),
  });
  if (canonicalJson(authority) !== canonicalJson(rebuilt)) throw new Error('Optional existing-base authority digest binding is invalid.');
  return rebuilt;
}

export function encodeStableOptionalExistingBaseCarrier(value: unknown): string {
  const authority = validateStableOptionalExistingBaseAuthority(value);
  return Buffer.from(canonicalJson(authority), 'utf8').toString('base64url');
}

export function decodeStableOptionalExistingBaseCarrier(input: { carrier: string; authorityDigest: string; authorityId: string }): StableOptionalExistingBaseAuthority {
  const carrier = text(input.carrier, 'authority_carrier');
  if (!/^[A-Za-z0-9_-]+$/.test(carrier)) throw new Error('authority_carrier must be unpadded canonical base64url.');
  const decoded = Buffer.from(carrier, 'base64url').toString('utf8');
  let parsed: unknown;
  try { parsed = JSON.parse(decoded); } catch { throw new Error('authority_carrier must contain one JSON object.'); }
  const authority = validateStableOptionalExistingBaseAuthority(parsed);
  if (decoded !== canonicalJson(authority) || encodeStableOptionalExistingBaseCarrier(authority) !== carrier) throw new Error('authority_carrier must contain canonical authority JSON bytes.');
  if (authority.authority_digest !== digest(input.authorityDigest, 'authority_digest')) throw new Error('authority_carrier digest does not match authority_digest.');
  if (authority.authority_id !== text(input.authorityId, 'authority_id')) throw new Error('authority_carrier authority_id does not match authority_id.');
  return authority;
}

export function validateStableOptionalExistingBaseExecutorBinding(input: { authority: unknown; appRoot: string; expectedActor: string; expectedExecutorSha: string }): StableOptionalExistingBaseAuthority {
  const authority = validateStableOptionalExistingBaseAuthority(input.authority);
  if (authority.issuer !== text(input.expectedActor, 'expected_actor')) throw new Error('Optional authority issuer does not match dispatch actor.');
  const root = path.resolve(input.appRoot);
  const head = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 10_000 });
  if (head.status !== 0 || head.error || sha(head.stdout.trim(), 'executor_app_sha') !== sha(input.expectedExecutorSha, 'expected_executor_sha')) {
    throw new Error('Optional workflow executor App commit does not match GitHub Actions.');
  }
  for (const [relativePath, expectedDigest] of Object.entries(authority.critical_blobs)) {
    const candidate = path.resolve(root, relativePath);
    if (!candidate.startsWith(`${root}${path.sep}`)) throw new Error(`Optional authority critical blob escapes App root: ${relativePath}`);
    const stat = fs.lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Optional authority critical blob must be a regular file: ${relativePath}`);
    const actual = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(candidate)).digest('hex')}`;
    if (actual !== expectedDigest) throw new Error(`Optional authority critical blob drifted: ${relativePath}`);
  }
  return authority;
}

function readJson(file: string): unknown { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function required(values: Record<string, string | undefined>, key: string): string {
  const value = values[key];
  if (!value) throw new Error(`Missing --${key}.`);
  return value;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { positionals, values } = parseArgs({
    options: {
      command: { type: 'string' }, authority: { type: 'string' }, output: { type: 'string' },
      'authority-id': { type: 'string' }, 'operation-id': { type: 'string' }, issuer: { type: 'string' },
      'issued-at': { type: 'string' }, 'expires-at': { type: 'string' }, 'objective-fingerprint': { type: 'string' },
      nonce: { type: 'string' }, 'source-qualification': { type: 'string' }, 'base-release': { type: 'string' },
      'critical-blobs': { type: 'string' }, 'pre-nonce-guard': { type: 'string' },
      'authority-carrier': { type: 'string' }, 'authority-digest': { type: 'string' },
      'authority-id-input': { type: 'string' },
    }, allowPositionals: true,
  });
  const command = values.command ?? positionals[0];
  if (command === 'create-authority') {
    const authority = createStableOptionalExistingBaseAuthority({
      authorityId: required(values, 'authority-id'), operationId: required(values, 'operation-id'), issuer: required(values, 'issuer'),
      issuedAt: required(values, 'issued-at'), expiresAt: required(values, 'expires-at'), objectiveFingerprint: required(values, 'objective-fingerprint'),
      nonce: required(values, 'nonce'), sourceQualification: readJson(required(values, 'source-qualification')),
      baseRelease: readJson(required(values, 'base-release')), criticalBlobs: readJson(required(values, 'critical-blobs')),
      preNonceGuard: readJson(required(values, 'pre-nonce-guard')),
    });
    fs.writeFileSync(required(values, 'output'), `${JSON.stringify(authority, null, 2)}\n`);
  } else if (command === 'encode-carrier') {
    const carrier = encodeStableOptionalExistingBaseCarrier(readJson(required(values, 'authority')));
    fs.writeFileSync(required(values, 'output'), `${carrier}\n`);
  } else if (command === 'decode-carrier') {
    const authority = decodeStableOptionalExistingBaseCarrier({ carrier: required(values, 'authority-carrier'), authorityDigest: required(values, 'authority-digest'), authorityId: required(values, 'authority-id-input') });
    process.stdout.write(`${JSON.stringify(authority)}\n`);
  } else {
    throw new Error('Usage: stable-optional-existing-base-control.ts <create-authority|encode-carrier|decode-carrier> ...');
  }
}
