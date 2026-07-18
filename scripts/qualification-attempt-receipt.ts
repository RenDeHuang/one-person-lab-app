import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { BuildArtifactCohortV2 } from './build-artifact-cohort.ts';
import { validateFrozenCodexCliIdentity } from './build-artifact-cohort.ts';

export type QualificationFailureTaxonomy =
  | 'none'
  | 'product'
  | 'fixture'
  | 'environment'
  | 'operator'
  | 'infrastructure'
  | 'cancelled'
  | 'unknown';

export type QualificationAttemptReceiptV1 = {
  schema: 'opl_app_qualification_attempt_receipt.v1';
  durable_failure_path: true;
  written_at: string;
  status: 'passed' | 'failed' | 'cancelled' | 'incomplete';
  failure_taxonomy: QualificationFailureTaxonomy;
  retry: {
    disposition: 'new_cohort_required' | 'same_artifact_retry_allowed' | 'reconcile_only' | 'terminal_blocked';
    reason: string;
  };
  identity: {
    stable_session_id: string | null;
    release_cohort_ref: string | null;
    artifact_kind: 'standard' | 'full' | null;
    package_profile: string | null;
    qualification_run_id: string | null;
    qualification_run_attempt: string | null;
    source_artifact_run_id: string | null;
    source_artifact_name: string | null;
  };
  artifact: {
    sha256: string | null;
    manifest_sha256: string | null;
  };
  expectations: {
    semantic_digest: string | null;
    probe_digest: string | null;
  };
  qualification_inputs: {
    manifest_sha256: string | null;
    runtime: BuildArtifactCohortV2['qualification_runtime'] | null;
  };
  evidence: {
    strict_qualification_receipt_path: string | null;
    strict_qualification_receipt_sha256: string | null;
    smoke_summary_path: string | null;
    smoke_summary_sha256: string | null;
    scope_proof: null | {
      classification: string | null;
      app_base_sha: string | null;
      app_head_sha: string | null;
      shell_base_sha: string | null;
      shell_head_sha: string | null;
      artifact_semantic_digest: string | null;
      verification_semantic_digest: string | null;
      artifact_probe_digest: string | null;
      verification_probe_digest: string | null;
      forbidden_app_paths: string[];
      forbidden_shell_paths: string[];
    };
  };
  outcomes: Record<string, string>;
  errors: string[];
};

const digestPattern = /^[0-9a-f]{64}$/;
const digestRefPattern = /^sha256:[0-9a-f]{64}$/;

export type QualificationAttemptReceiptExpectation = {
  stableSessionId: string;
  releaseCohortRef: string;
  artifactKind: 'standard' | 'full';
  qualificationRunId: string;
  sourceArtifactRunId: string;
  sourceArtifactName: string;
  artifactSha256: string;
  manifestSha256?: string | null;
  semanticDigest: string;
  probeDigest: string;
  qualificationRunAttempt?: string;
  observedAt?: string;
  maxAgeMs?: number;
  qualificationInputManifestDigest?: string;
};

export function validateQualificationAttemptReceipt(
  value: unknown,
  expected: QualificationAttemptReceiptExpectation,
): string[] {
  if (!value || typeof value !== 'object') return ['qualification attempt receipt is missing or malformed'];
  const receipt = value as Partial<QualificationAttemptReceiptV1>;
  const errors: string[] = [];
  if (receipt.schema !== 'opl_app_qualification_attempt_receipt.v1') errors.push('attempt receipt schema is invalid');
  if (receipt.durable_failure_path !== true) errors.push('attempt receipt durable_failure_path is not true');
  const writtenAt = Date.parse(String(receipt.written_at));
  const observedAt = Date.parse(expected.observedAt ?? new Date().toISOString());
  const maxAgeMs = expected.maxAgeMs ?? 24 * 60 * 60 * 1000;
  if (!Number.isFinite(writtenAt) || !Number.isFinite(observedAt) || writtenAt > observedAt + 30_000 || observedAt - writtenAt > maxAgeMs) {
    errors.push('attempt receipt written_at is invalid, future-dated, or stale');
  }
  if (!['passed', 'failed', 'cancelled', 'incomplete'].includes(String(receipt.status))) errors.push('attempt receipt status is invalid');
  if (!receipt.identity || typeof receipt.identity !== 'object') {
    errors.push('attempt receipt identity is missing');
  } else {
    if (receipt.identity.stable_session_id !== expected.stableSessionId) errors.push('attempt receipt stable_session_id does not match');
    if (receipt.identity.release_cohort_ref !== expected.releaseCohortRef) errors.push('attempt receipt release_cohort_ref does not match');
    if (receipt.identity.artifact_kind !== expected.artifactKind) errors.push('attempt receipt artifact_kind does not match');
    if (receipt.identity.package_profile !== expected.artifactKind) errors.push('attempt receipt package_profile does not match artifact kind');
    if (receipt.identity.qualification_run_id !== expected.qualificationRunId) errors.push('attempt receipt qualification_run_id does not match');
    if (expected.qualificationRunAttempt && receipt.identity.qualification_run_attempt !== expected.qualificationRunAttempt) {
      errors.push('attempt receipt qualification_run_attempt does not match');
    }
    if (receipt.identity.source_artifact_run_id !== expected.sourceArtifactRunId) errors.push('attempt receipt source_artifact_run_id does not match');
    if (receipt.identity.source_artifact_name !== expected.sourceArtifactName) errors.push('attempt receipt source_artifact_name does not match');
  }
  if (receipt.artifact?.sha256 !== expected.artifactSha256) errors.push('attempt receipt artifact SHA-256 does not match');
  if (!digestPattern.test(String(receipt.artifact?.manifest_sha256 ?? ''))) errors.push('attempt receipt manifest SHA-256 is missing or invalid');
  if (expected.manifestSha256 && receipt.artifact?.manifest_sha256 !== expected.manifestSha256) {
    errors.push('attempt receipt manifest SHA-256 does not match expected manifest');
  }
  if (receipt.expectations?.semantic_digest !== expected.semanticDigest) errors.push('attempt receipt semantic expectation digest does not match');
  if (receipt.expectations?.probe_digest !== expected.probeDigest) errors.push('attempt receipt probe expectation digest does not match');
  if (!digestPattern.test(String(receipt.qualification_inputs?.manifest_sha256 ?? ''))) {
    errors.push('attempt receipt qualification input manifest SHA-256 is missing or invalid');
  }
  if (expected.qualificationInputManifestDigest && receipt.qualification_inputs?.manifest_sha256 !== expected.qualificationInputManifestDigest) {
    errors.push('attempt receipt qualification input manifest SHA-256 does not match');
  }
  errors.push(...validateFrozenCodexCliIdentity(receipt.qualification_inputs?.runtime?.codex_cli));
  if (receipt.status === 'passed') {
    if (receipt.failure_taxonomy !== 'none') errors.push('passed attempt receipt has a failure taxonomy');
    if ((receipt.errors?.length ?? 0) > 0) errors.push('passed attempt receipt contains errors');
    if (receipt.retry?.disposition !== 'reconcile_only') errors.push('passed attempt receipt retry disposition is invalid');
    if (!digestPattern.test(String(receipt.evidence?.strict_qualification_receipt_sha256 ?? ''))) {
      errors.push('passed attempt receipt lacks strict qualification receipt digest');
    }
    if (!digestPattern.test(String(receipt.evidence?.smoke_summary_sha256 ?? ''))) {
      errors.push('passed attempt receipt lacks smoke summary digest');
    }
    if (receipt.identity?.qualification_run_attempt !== '1') errors.push('passed attempt receipt must come from workflow run attempt 1');
    if (receipt.evidence?.scope_proof?.classification !== 'same_as_artifact_cohort') {
      errors.push('passed attempt receipt lacks an exact unchanged verifier scope proof');
    }
    if (!receipt.retry?.reason) errors.push('passed attempt receipt retry reason is missing');
  }
  if (!digestRefPattern.test(expected.stableSessionId) || !digestRefPattern.test(expected.releaseCohortRef)) {
    errors.push('expected session or cohort identity is invalid');
  }
  return errors;
}

function sha256IfFile(filePath: string | undefined, errors: string[], label: string): string | null {
  if (!filePath) return null;
  try {
    if (!fs.existsSync(filePath)) {
      errors.push(`${label} is missing: ${filePath}`);
      return null;
    }
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch (error) {
    errors.push(`${label} could not be read: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function readManifest(filePath: string | undefined, errors: string[]): Record<string, any> | null {
  if (!filePath) {
    errors.push('build artifact manifest path was not provided');
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>;
  } catch (error) {
    errors.push(`build artifact manifest is unavailable or invalid: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function validateStrictPassedReceipt(input: {
  strictPath?: string;
  strictSha: string | null;
  smokePath?: string;
  smokeSha: string | null;
  manifestPath?: string;
  manifest: Record<string, any> | null;
  stableSessionId?: string;
  releaseCohortRef?: string;
  qualificationRunId?: string;
  sourceArtifactRunId?: string;
  sourceArtifactName?: string;
}, errors: string[]): void {
  if (!input.strictPath || !input.strictSha) {
    errors.push('passed attempt requires a readable strict qualification receipt');
    return;
  }
  if (!input.smokePath || !input.smokeSha) {
    errors.push('passed attempt requires a readable smoke summary');
  }
  if (!input.manifestPath || !input.manifest) {
    errors.push('passed attempt requires a readable build artifact manifest');
    return;
  }
  try {
    const strict = JSON.parse(fs.readFileSync(input.strictPath, 'utf8')) as Record<string, any>;
    const expected = [
      ['schema', strict.schema, 'opl_app_artifact_qualification_receipt.v1'],
      ['status', strict.status, 'passed'],
      ['qualification.result', strict.qualification?.result, 'passed'],
      ['stable_session_id', strict.stable_session_id, input.stableSessionId || input.manifest.release?.stable_session_id],
      ['release_cohort_ref', strict.release_cohort_ref, input.releaseCohortRef || input.manifest.release?.release_cohort_ref],
      ['qualification.run_id', strict.qualification?.run_id, input.qualificationRunId],
      ['qualification.source_artifact_run_id', strict.qualification?.source_artifact_run_id, input.sourceArtifactRunId || input.manifest.actions?.run_id],
      ['qualification.source_artifact_name', strict.qualification?.source_artifact_name, input.sourceArtifactName || input.manifest.actions?.artifact_name],
      ['artifact.sha256', strict.artifact?.sha256, input.manifest.artifact?.sha256],
      ['build_manifest.sha256', strict.build_manifest?.sha256, sha256IfFile(input.manifestPath, errors, 'build artifact manifest')],
      ['build_manifest.qualification_input_manifest_sha256', strict.build_manifest?.qualification_input_manifest_sha256, input.manifest.digests?.qualification_input_manifest_sha256],
      ['smoke_summary.sha256', strict.smoke_summary?.sha256, input.smokeSha],
    ] as const;
    for (const [label, actual, wanted] of expected) {
      if (typeof wanted !== 'string' || !wanted || actual !== wanted) {
        errors.push(`strict qualification receipt ${label} is not bound to this attempt`);
      }
    }
    if (JSON.stringify(strict.qualification_runtime) !== JSON.stringify(input.manifest.qualification_runtime)) {
      errors.push('strict qualification receipt runtime identity is not bound to this attempt');
    }
    if (input.manifest.build?.kind === 'full') {
      for (const [label, actual, wanted] of [
        ['full_input_manifest_sha256', strict.build_manifest?.full_input_manifest_sha256, input.manifest.digests?.full_input_manifest_sha256],
        ['framework_bundled_catalog_sha256', strict.build_manifest?.framework_bundled_catalog_sha256, input.manifest.digests?.framework_bundled_catalog_sha256],
        ['full_toolchain_observation_receipt_sha256', strict.build_manifest?.full_toolchain_observation_receipt_sha256, input.manifest.digests?.full_toolchain_observation_receipt_sha256],
      ] as const) {
        if (typeof wanted !== 'string' || !digestPattern.test(wanted) || actual !== wanted) {
          errors.push(`strict qualification receipt ${label} is not bound to this attempt`);
        }
      }
    }
  } catch (error) {
    errors.push(`strict qualification receipt is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function buildQualificationAttemptReceipt(input: {
  writtenAt?: string;
  status?: string;
  failureTaxonomy?: string;
  stableSessionId?: string;
  releaseCohortRef?: string;
  artifactKind?: string;
  packageProfile?: string;
  qualificationRunId?: string;
  qualificationRunAttempt?: string;
  sourceArtifactRunId?: string;
  sourceArtifactName?: string;
  manifestPath?: string;
  strictQualificationReceiptPath?: string;
  smokeSummaryPath?: string;
  scopeProofBase64?: string;
  outcomes?: Record<string, string | undefined>;
  errors?: string[];
}): QualificationAttemptReceiptV1 {
  const errors = [...(input.errors ?? [])];
  const manifest = readManifest(input.manifestPath, errors);
  const status = ['passed', 'failed', 'cancelled', 'incomplete'].includes(input.status ?? '')
    ? input.status as QualificationAttemptReceiptV1['status']
    : 'incomplete';
  const allowedTaxonomies: QualificationFailureTaxonomy[] = [
    'none', 'product', 'fixture', 'environment', 'operator', 'infrastructure', 'cancelled', 'unknown',
  ];
  let failureTaxonomy = allowedTaxonomies.includes(input.failureTaxonomy as QualificationFailureTaxonomy)
    ? input.failureTaxonomy as QualificationFailureTaxonomy
    : status === 'passed'
      ? 'none'
      : status === 'cancelled'
        ? 'cancelled'
        : 'unknown';
  if (status === 'passed' && failureTaxonomy !== 'none') {
    errors.push(`passed attempt cannot use failure taxonomy ${failureTaxonomy}`);
    failureTaxonomy = 'unknown';
  }
  const semanticDigest = manifest?.digests?.compiled_expectation_semantic_sha256;
  const probeDigest = manifest?.digests?.compiled_expectation_probe_sha256;
  if (semanticDigest != null && !digestPattern.test(String(semanticDigest))) {
    errors.push('manifest semantic expectation digest is invalid');
  }
  if (probeDigest != null && !digestPattern.test(String(probeDigest))) {
    errors.push('manifest probe expectation digest is invalid');
  }
  let scopeProof: QualificationAttemptReceiptV1['evidence']['scope_proof'] = null;
  if (input.scopeProofBase64) {
    try {
      const proof = JSON.parse(Buffer.from(input.scopeProofBase64, 'base64').toString('utf8'));
      if (proof && typeof proof === 'object') {
        scopeProof = {
          classification: typeof proof.classification === 'string' ? proof.classification : null,
          app_base_sha: typeof proof.app?.base_sha === 'string' ? proof.app.base_sha : null,
          app_head_sha: typeof proof.app?.head_sha === 'string' ? proof.app.head_sha : null,
          shell_base_sha: typeof proof.shell?.base_sha === 'string' ? proof.shell.base_sha : null,
          shell_head_sha: typeof proof.shell?.head_sha === 'string' ? proof.shell.head_sha : null,
          artifact_semantic_digest: typeof proof.expectations?.artifact_semantic_digest === 'string'
            ? proof.expectations.artifact_semantic_digest : null,
          verification_semantic_digest: typeof proof.expectations?.verification_semantic_digest === 'string'
            ? proof.expectations.verification_semantic_digest : null,
          artifact_probe_digest: typeof proof.expectations?.artifact_probe_digest === 'string'
            ? proof.expectations.artifact_probe_digest : null,
          verification_probe_digest: typeof proof.expectations?.verification_probe_digest === 'string'
            ? proof.expectations.verification_probe_digest : null,
          forbidden_app_paths: Array.isArray(proof.reuse_authorization?.forbidden_paths?.app)
            ? proof.reuse_authorization.forbidden_paths.app : [],
          forbidden_shell_paths: Array.isArray(proof.reuse_authorization?.forbidden_paths?.shell)
            ? proof.reuse_authorization.forbidden_paths.shell : [],
        };
      }
    } catch (error) {
      errors.push(`scope proof is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const strictReceiptSha = sha256IfFile(
    input.strictQualificationReceiptPath,
    errors,
    'strict qualification receipt',
  );
  const smokeSummarySha = sha256IfFile(input.smokeSummaryPath, errors, 'smoke summary');
  if (status === 'passed') {
    validateStrictPassedReceipt({
      strictPath: input.strictQualificationReceiptPath,
      strictSha: strictReceiptSha,
      smokePath: input.smokeSummaryPath,
      smokeSha: smokeSummarySha,
      manifestPath: input.manifestPath,
      manifest,
      stableSessionId: input.stableSessionId,
      releaseCohortRef: input.releaseCohortRef,
      qualificationRunId: input.qualificationRunId,
      sourceArtifactRunId: input.sourceArtifactRunId,
      sourceArtifactName: input.sourceArtifactName,
    }, errors);
  }
  const finalStatus = status === 'passed' && errors.length > 0 ? 'incomplete' : status;
  if (finalStatus !== 'passed' && failureTaxonomy === 'none') failureTaxonomy = 'unknown';
  const sameArtifactFixture =
    failureTaxonomy === 'fixture' &&
    scopeProof?.classification === 'same_as_artifact_cohort' &&
    scopeProof.artifact_semantic_digest != null &&
    scopeProof.artifact_semantic_digest === scopeProof.verification_semantic_digest;
  const retry = failureTaxonomy === 'product' || (failureTaxonomy === 'fixture' && !sameArtifactFixture)
    ? { disposition: 'new_cohort_required' as const, reason: failureTaxonomy === 'product'
      ? 'product failure changes the releasable cohort'
      : 'fixture failure lacks a semantic-equal harness-mechanics-only scope proof' }
    : sameArtifactFixture
      ? { disposition: 'same_artifact_retry_allowed' as const, reason: 'fixture failure may retry only with the exact unchanged App and Shell verifier cohort' }
      : failureTaxonomy === 'operator'
        ? { disposition: 'terminal_blocked' as const, reason: 'operator identity or authority must be repaired before any mutation' }
        : { disposition: 'reconcile_only' as const, reason: finalStatus === 'passed'
          ? 'passed attempt needs only receipt/session reconciliation'
          : 'remote state and durable receipts must be reconciled before deciding whether to retry' };
  return {
    schema: 'opl_app_qualification_attempt_receipt.v1',
    durable_failure_path: true,
    written_at: input.writtenAt ?? new Date().toISOString(),
    status: finalStatus,
    failure_taxonomy: failureTaxonomy,
    retry,
    identity: {
      stable_session_id: input.stableSessionId || manifest?.release?.stable_session_id || null,
      release_cohort_ref: input.releaseCohortRef || manifest?.release?.release_cohort_ref || null,
      artifact_kind: ['standard', 'full'].includes(input.artifactKind ?? manifest?.build?.kind)
        ? (input.artifactKind ?? manifest?.build?.kind) as 'standard' | 'full'
        : null,
      package_profile: input.packageProfile || null,
      qualification_run_id: input.qualificationRunId || null,
      qualification_run_attempt: input.qualificationRunAttempt || null,
      source_artifact_run_id: input.sourceArtifactRunId || manifest?.actions?.run_id || null,
      source_artifact_name: input.sourceArtifactName || manifest?.actions?.artifact_name || null,
    },
    artifact: {
      sha256: digestPattern.test(String(manifest?.artifact?.sha256 ?? '')) ? manifest!.artifact.sha256 : null,
      manifest_sha256: sha256IfFile(input.manifestPath, errors, 'build artifact manifest'),
    },
    expectations: {
      semantic_digest: digestPattern.test(String(semanticDigest ?? '')) ? semanticDigest : null,
      probe_digest: digestPattern.test(String(probeDigest ?? '')) ? probeDigest : null,
    },
    qualification_inputs: {
      manifest_sha256: digestPattern.test(String(manifest?.digests?.qualification_input_manifest_sha256 ?? ''))
        ? manifest!.digests.qualification_input_manifest_sha256
        : null,
      runtime: validateFrozenCodexCliIdentity(manifest?.qualification_runtime?.codex_cli).length === 0
        ? manifest!.qualification_runtime
        : null,
    },
    evidence: {
      strict_qualification_receipt_path: strictReceiptSha ? input.strictQualificationReceiptPath! : null,
      strict_qualification_receipt_sha256: strictReceiptSha,
      smoke_summary_path: smokeSummarySha ? input.smokeSummaryPath! : null,
      smoke_summary_sha256: smokeSummarySha,
      scope_proof: scopeProof,
    },
    outcomes: Object.fromEntries(
      Object.entries(input.outcomes ?? {}).map(([key, value]) => [key, value || 'unknown']),
    ),
    errors,
  };
}

export function writeQualificationAttemptReceiptAtomic(
  outputPath: string,
  receipt: QualificationAttemptReceiptV1,
): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporaryPath, outputPath);
    const directory = fs.openSync(path.dirname(outputPath), 'r');
    try {
      fs.fsyncSync(directory);
    } finally {
      fs.closeSync(directory);
    }
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    fs.rmSync(temporaryPath, { force: true });
  }
}
