#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const CODEX_RUNTIME_IDENTITY_FIELDS = [
  'path',
  'realpath',
  'version',
  'sha256',
  'codex_home',
  'runtime_cohort_ref',
] as const;

export const REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS = [
  'full_clean_install_finder',
  'standard_update_after_full_finder',
] as const;

export const REQUIRED_CODEX_RUNTIME_ERROR_CODES = [
  'USER_AGENT_NOT_INSTALLED',
  'USER_AGENT_COMMAND_NOT_FOUND',
  'MANAGED_RUNTIME_UNAVAILABLE',
  'RUNTIME_ACTIVATION_REQUIRED',
  'RUNTIME_IDENTITY_MISMATCH',
] as const;

const CLAIM_SCOPE = 'opl_controlled_input_and_successful_handshake_without_aioncore_native_readback';
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

type JsonRecord = Record<string, unknown>;
type EvidenceValidationContext = {
  evidenceRoot?: string;
  verifyReferencedFiles: boolean;
  verifiedFiles: Set<string>;
};

export type CodexRuntimeIdentityEvidenceValidationOptions = {
  evidenceRoot?: string;
  verifyReferencedFiles?: boolean;
};

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, expected: string[], label: string): void {
  const actual = Object.keys(value).toSorted();
  const canonical = [...expected].toSorted();
  if (JSON.stringify(actual) !== JSON.stringify(canonical)) {
    throw new Error(`${label} fields must be exactly ${canonical.join(', ')}`);
  }
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function digest(value: unknown, label: string): string {
  const normalized = string(value, label);
  if (!DIGEST_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return normalized;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function exactValue(value: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}`);
  }
}

function fileSha256(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const descriptor = fs.openSync(filePath, 'r');
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return `sha256:${hash.digest('hex')}`;
}

function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function verifyFileReference(
  rawPath: unknown,
  rawDigest: unknown,
  label: string,
  context: EvidenceValidationContext,
): void {
  const referencePath = string(rawPath, `${label}.path`);
  const expectedDigest = digest(rawDigest, `${label}.sha256`);
  if (!context.verifyReferencedFiles) return;
  if (!context.evidenceRoot) {
    throw new Error('evidenceRoot is required when referenced-file verification is enabled');
  }

  const resolvedPath = path.isAbsolute(referencePath)
    ? path.normalize(referencePath)
    : path.resolve(context.evidenceRoot, referencePath);
  if (!path.isAbsolute(referencePath) && !isPathInside(resolvedPath, context.evidenceRoot)) {
    throw new Error(`${label}.path must not escape the evidence root`);
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolvedPath);
  } catch (error) {
    throw new Error(
      `${label}.path is unavailable: ${resolvedPath} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (!stats.isFile()) {
    throw new Error(`${label}.path must reference a regular file: ${resolvedPath}`);
  }
  const actualDigest = fileSha256(resolvedPath);
  if (actualDigest !== expectedDigest) {
    throw new Error(`${label}.sha256 does not match ${resolvedPath}`);
  }
  context.verifiedFiles.add(resolvedPath);
}

function validateEvidenceRefs(
  value: unknown,
  label: string,
  minimum: number,
  context: EvidenceValidationContext,
  requiredKinds: string[] = [],
): void {
  const refs = array(value, label);
  if (refs.length < minimum) {
    throw new Error(`${label} must include at least ${minimum} evidence reference(s)`);
  }
  const observedKinds = new Set<string>();
  for (const [index, candidate] of refs.entries()) {
    const ref = record(candidate, `${label}[${index}]`);
    exactKeys(ref, ['kind', 'path', 'sha256'], `${label}[${index}]`);
    const kind = string(ref.kind, `${label}[${index}].kind`);
    if (!['artifact_tree', 'environment_capture', 'process_inspection', 'handshake_log', 'typed_error_probe'].includes(kind)) {
      throw new Error(`${label}[${index}].kind is unsupported`);
    }
    observedKinds.add(kind);
    verifyFileReference(ref.path, ref.sha256, `${label}[${index}]`, context);
  }
  for (const kind of requiredKinds) {
    if (!observedKinds.has(kind)) {
      throw new Error(`${label} must include a ${kind} reference`);
    }
  }
}

function validateIdentity(value: unknown, label: string): JsonRecord {
  const identity = record(value, label);
  exactKeys(
    identity,
    [
      'schema',
      'path',
      'realpath',
      'version',
      'sha256',
      'codex_home',
      'runtime_key',
      'runtime_cohort_ref',
      'carrier',
    ],
    label,
  );
  exactValue(identity.schema, 'opl_codex_runtime_identity.v1', `${label}.schema`);
  for (const field of ['path', 'realpath', 'codex_home'] as const) {
    const resolved = string(identity[field], `${label}.${field}`);
    if (!path.isAbsolute(resolved)) {
      throw new Error(`${label}.${field} must be an absolute path`);
    }
  }
  string(identity.version, `${label}.version`);
  string(identity.runtime_key, `${label}.runtime_key`);
  digest(identity.sha256, `${label}.sha256`);
  digest(identity.runtime_cohort_ref, `${label}.runtime_cohort_ref`);

  const carrier = record(identity.carrier, `${label}.carrier`);
  exactKeys(
    carrier,
    ['kind', 'producer_manifest_sha256', 'projection_manifest_sha256', 'aioncore_native_readback'],
    `${label}.carrier`,
  );
  exactValue(carrier.kind, 'aioncore_managed_resources_projection', `${label}.carrier.kind`);
  digest(carrier.producer_manifest_sha256, `${label}.carrier.producer_manifest_sha256`);
  digest(carrier.projection_manifest_sha256, `${label}.carrier.projection_manifest_sha256`);
  exactValue(carrier.aioncore_native_readback, false, `${label}.carrier.aioncore_native_readback`);
  return identity;
}

function validateIdentityEquality(
  managedCandidate: JsonRecord,
  boundaryIdentity: JsonRecord,
  label: string,
): void {
  for (const field of CODEX_RUNTIME_IDENTITY_FIELDS) {
    if (boundaryIdentity[field] !== managedCandidate[field]) {
      throw new Error(`${label}.${field} must match managed_candidate.${field}`);
    }
  }
  if (JSON.stringify(boundaryIdentity.carrier) !== JSON.stringify(managedCandidate.carrier)) {
    throw new Error(`${label}.carrier must match managed_candidate.carrier`);
  }
  if (boundaryIdentity.runtime_key !== managedCandidate.runtime_key) {
    throw new Error(`${label}.runtime_key must match managed_candidate.runtime_key`);
  }
}

function validateTypedErrorProbes(value: unknown, label: string, context: EvidenceValidationContext): void {
  const probes = array(value, label);
  if (probes.length !== REQUIRED_CODEX_RUNTIME_ERROR_CODES.length) {
    throw new Error(`${label} must contain exactly ${REQUIRED_CODEX_RUNTIME_ERROR_CODES.length} probes`);
  }
  const observedCodes: string[] = [];
  for (const [index, candidate] of probes.entries()) {
    const probe = record(candidate, `${label}[${index}]`);
    exactKeys(probe, ['code', 'status', 'evidence_refs'], `${label}[${index}]`);
    observedCodes.push(string(probe.code, `${label}[${index}].code`));
    exactValue(probe.status, 'passed', `${label}[${index}].status`);
    validateEvidenceRefs(
      probe.evidence_refs,
      `${label}[${index}].evidence_refs`,
      1,
      context,
      ['typed_error_probe'],
    );
  }
  exactValue(
    observedCodes.toSorted(),
    [...REQUIRED_CODEX_RUNTIME_ERROR_CODES].toSorted(),
    `${label} code set`,
  );
}

function validateRun(value: unknown, index: number, context: EvidenceValidationContext): string {
  const label = `runs[${index}]`;
  const run = record(value, label);
  exactKeys(
    run,
    [
      'id',
      'status',
      'runtime_profile',
      'transition',
      'launch',
      'artifact',
      'managed_candidate',
      'direct_app_server',
      'aioncore_acp',
      'identity_comparison',
      'typed_error_probes',
    ],
    label,
  );
  const id = string(run.id, `${label}.id`);
  if (!REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS.includes(id as (typeof REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS)[number])) {
    throw new Error(`${label}.id is unsupported`);
  }
  exactValue(run.status, 'passed', `${label}.status`);
  const expectedProfile = id === 'full_clean_install_finder' ? 'full' : 'standard';
  const expectedTransition = id === 'full_clean_install_finder' ? 'clean_install' : 'full_to_standard_update';
  exactValue(run.runtime_profile, expectedProfile, `${label}.runtime_profile`);
  exactValue(run.transition, expectedTransition, `${label}.transition`);

  const launch = record(run.launch, `${label}.launch`);
  exactKeys(
    launch,
    ['entrypoint', 'path', 'shell_profile_loaded', 'global_codex_present', 'restarted'],
    `${label}.launch`,
  );
  exactValue(launch.entrypoint, 'finder', `${label}.launch.entrypoint`);
  exactValue(launch.path, '/usr/bin:/bin', `${label}.launch.path`);
  exactValue(launch.shell_profile_loaded, false, `${label}.launch.shell_profile_loaded`);
  exactValue(launch.global_codex_present, false, `${label}.launch.global_codex_present`);
  exactValue(launch.restarted, true, `${label}.launch.restarted`);

  const artifact = record(run.artifact, `${label}.artifact`);
  exactKeys(artifact, ['profile', 'app_version', 'path', 'sha256'], `${label}.artifact`);
  exactValue(artifact.profile, expectedProfile, `${label}.artifact.profile`);
  string(artifact.app_version, `${label}.artifact.app_version`);
  verifyFileReference(artifact.path, artifact.sha256, `${label}.artifact`, context);

  const managedCandidate = validateIdentity(run.managed_candidate, `${label}.managed_candidate`);
  const direct = record(run.direct_app_server, `${label}.direct_app_server`);
  exactKeys(direct, ['observation_mode', 'handshake', 'identity', 'evidence_refs'], `${label}.direct_app_server`);
  exactValue(
    direct.observation_mode,
    'resolver_verified_spawn_input',
    `${label}.direct_app_server.observation_mode`,
  );
  exactValue(direct.handshake, 'initialize_passed', `${label}.direct_app_server.handshake`);
  const directIdentity = validateIdentity(direct.identity, `${label}.direct_app_server.identity`);
  validateIdentityEquality(managedCandidate, directIdentity, `${label}.direct_app_server.identity`);
  validateEvidenceRefs(
    direct.evidence_refs,
    `${label}.direct_app_server.evidence_refs`,
    2,
    context,
    ['process_inspection', 'handshake_log'],
  );

  const acp = record(run.aioncore_acp, `${label}.aioncore_acp`);
  exactKeys(
    acp,
    ['observation_mode', 'native_readback', 'managed_candidate_count', 'handshake', 'identity', 'evidence_refs'],
    `${label}.aioncore_acp`,
  );
  exactValue(
    acp.observation_mode,
    'unique_managed_candidate_inherited_environment_and_conversation_handshake',
    `${label}.aioncore_acp.observation_mode`,
  );
  exactValue(acp.native_readback, false, `${label}.aioncore_acp.native_readback`);
  exactValue(acp.managed_candidate_count, 1, `${label}.aioncore_acp.managed_candidate_count`);
  exactValue(
    acp.handshake,
    'ordinary_conversation_real_response_passed',
    `${label}.aioncore_acp.handshake`,
  );
  const acpIdentity = validateIdentity(acp.identity, `${label}.aioncore_acp.identity`);
  validateIdentityEquality(managedCandidate, acpIdentity, `${label}.aioncore_acp.identity`);
  validateEvidenceRefs(
    acp.evidence_refs,
    `${label}.aioncore_acp.evidence_refs`,
    2,
    context,
    ['environment_capture', 'handshake_log'],
  );

  const comparison = record(run.identity_comparison, `${label}.identity_comparison`);
  exactKeys(
    comparison,
    ['fields', 'status', 'claim_scope', 'may_gate_install_or_runtime'],
    `${label}.identity_comparison`,
  );
  exactValue(comparison.fields, CODEX_RUNTIME_IDENTITY_FIELDS, `${label}.identity_comparison.fields`);
  exactValue(comparison.status, 'matched', `${label}.identity_comparison.status`);
  exactValue(comparison.claim_scope, CLAIM_SCOPE, `${label}.identity_comparison.claim_scope`);
  exactValue(comparison.may_gate_install_or_runtime, false, `${label}.identity_comparison.may_gate_install_or_runtime`);
  validateTypedErrorProbes(run.typed_error_probes, `${label}.typed_error_probes`, context);
  return id;
}

export function validateCodexRuntimeIdentityEvidence(
  value: unknown,
  options: CodexRuntimeIdentityEvidenceValidationOptions = {},
): {
  schema: 'opl_codex_runtime_identity_evidence_validation.v1';
  status: 'passed';
  run_ids: string[];
  aioncore_native_readback: false;
  evidence_manifest_valid: true;
  artifact_evidence_complete: boolean;
  verified_file_count: number;
} {
  const context: EvidenceValidationContext = {
    evidenceRoot: options.evidenceRoot ? path.resolve(options.evidenceRoot) : undefined,
    verifyReferencedFiles: options.verifyReferencedFiles ?? false,
    verifiedFiles: new Set<string>(),
  };
  const evidence = record(value, 'evidence');
  exactKeys(evidence, ['schema', 'status', 'authority', 'runs', 'created_at'], 'evidence');
  exactValue(evidence.schema, 'opl_codex_runtime_identity_evidence.v1', 'evidence.schema');
  exactValue(evidence.status, 'passed', 'evidence.status');

  const authority = record(evidence.authority, 'evidence.authority');
  exactKeys(
    authority,
    [
      'policy_owner',
      'runtime_identity_producer',
      'carrier',
      'aioncore_modified',
      'aioncore_native_readback',
      'exact_identity_may_gate_install_or_runtime',
      'claim_scope',
    ],
    'evidence.authority',
  );
  exactValue(authority.policy_owner, 'one-person-lab-app', 'evidence.authority.policy_owner');
  exactValue(
    authority.runtime_identity_producer,
    'gaofeng21cn/opl-aion-shell',
    'evidence.authority.runtime_identity_producer',
  );
  exactValue(
    authority.carrier,
    'aioncore_managed_resources_projection',
    'evidence.authority.carrier',
  );
  exactValue(authority.aioncore_modified, false, 'evidence.authority.aioncore_modified');
  exactValue(authority.aioncore_native_readback, false, 'evidence.authority.aioncore_native_readback');
  exactValue(
    authority.exact_identity_may_gate_install_or_runtime,
    false,
    'evidence.authority.exact_identity_may_gate_install_or_runtime',
  );
  exactValue(authority.claim_scope, CLAIM_SCOPE, 'evidence.authority.claim_scope');

  const runs = array(evidence.runs, 'evidence.runs');
  if (runs.length !== REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS.length) {
    throw new Error(`evidence.runs must contain exactly ${REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS.length} runs`);
  }
  const runIds = runs.map((run, index) => validateRun(run, index, context));
  exactValue(runIds.toSorted(), [...REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS].toSorted(), 'evidence.runs id set');
  const createdAt = Date.parse(string(evidence.created_at, 'evidence.created_at'));
  if (!Number.isFinite(createdAt)) {
    throw new Error('evidence.created_at must be an ISO date-time');
  }

  return {
    schema: 'opl_codex_runtime_identity_evidence_validation.v1',
    status: 'passed',
    run_ids: runIds,
    aioncore_native_readback: false,
    evidence_manifest_valid: true,
    artifact_evidence_complete: context.verifyReferencedFiles,
    verified_file_count: context.verifiedFiles.size,
  };
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.input) {
    throw new Error('Usage: codex-runtime-identity-evidence.ts --input <evidence.json>');
  }
  const inputPath = path.resolve(values.input);
  const value = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as unknown;
  console.log(
    JSON.stringify({
      input: inputPath,
      ...validateCodexRuntimeIdentityEvidence(value, {
        evidenceRoot: path.dirname(inputPath),
        verifyReferencedFiles: true,
      }),
    }),
  );
}

const isMain = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
