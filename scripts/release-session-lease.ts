import crypto from 'node:crypto';

export type ReleaseMutation =
  | 'desktop_release_dispatch'
  | 'qualification_dispatch'
  | 'full_addon_dispatch'
  | 'promotion_dispatch'
  | 'workflow_cancel'
  | 'release_draft_cleanup';

export type ReleaseSessionLeaseV2 = {
  schema: 'opl_app_release_session_lease.v2';
  authorization_mode: 'ed25519_signed' | 'advisory_integrity_receipt';
  authorization_class: 'standard' | 'emergency_cancel' | 'destructive_cleanup';
  issuer: string;
  repository: string;
  stable_session_id: string;
  release_cohort_ref: string;
  operator_actor: string;
  broker_actor: string;
  attempt_id: string;
  workflow:
    | 'release-stable.yml'
    | 'desktop-release.yml'
    | 'opl-first-run-vm.yml'
    | 'desktop-release-promote.yml'
    | 'desktop-release-full-addon.yml'
    | 'desktop-release-cleanup-drafts.yml';
  artifact_kind: 'standard' | 'full' | 'promotion' | 'release_metadata';
  controller_workflow_sha: string;
  artifact_app_sha: string;
  mutation_payload_sha256: string;
  planned_session_revision: number;
  target_attempt_id: string | null;
  target_run_id: string | null;
  nonce: string;
  issued_at: string;
  expires_at: string;
  allowed_mutations: ReleaseMutation[];
  credential_boundary: {
    lease_prevents_same_identity_api_bypass: false;
    normal_codex_actions_write_allowed: false;
    isolated_release_broker_token_required: true;
    protected_environment_alone_blocks_cancel_or_rerun: false;
    lease_intrinsically_enforces_nonce_single_use: false;
    broker_durable_nonce_consumption_required: true;
  };
  payload_digest: string;
  signature: null | { algorithm: 'Ed25519'; key_id: string; value_base64: string };
};

type LeaseExpectedIdentity = {
  stableSessionId: string;
  releaseCohortRef: string;
  repository: string;
  operatorActor: string;
  brokerActor: string;
  mutation: ReleaseMutation;
  attemptId: string;
  workflow: ReleaseSessionLeaseV2['workflow'];
  artifactKind: ReleaseSessionLeaseV2['artifact_kind'];
  controllerWorkflowSha: string;
  artifactAppSha: string;
  mutationPayloadSha256: string;
  plannedSessionRevision: number;
  issuer?: string;
  publicKeys?: Record<string, string>;
  requireSigned?: boolean;
  now?: string;
  targetAttemptId?: string | null;
  targetRunId?: string | null;
};

const digestRefPattern = /^sha256:[0-9a-f]{64}$/;
const exactShaPattern = /^[0-9a-f]{40}$/;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

export function validateReleaseSessionLease(
  lease: unknown,
  expected: LeaseExpectedIdentity,
): string[] {
  if (!lease || typeof lease !== 'object' || Array.isArray(lease)) return ['release session lease is missing'];
  const candidate = lease as Partial<ReleaseSessionLeaseV2> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_session_lease.v2') errors.push('release session lease schema is invalid');
  if (candidate.authorization_mode !== 'ed25519_signed') errors.push('release session lease is advisory and cannot authorize mutation');
  if (candidate.stable_session_id !== expected.stableSessionId) errors.push('lease stable_session_id does not match');
  if (candidate.release_cohort_ref !== expected.releaseCohortRef) errors.push('lease release_cohort_ref does not match');
  if (candidate.repository !== expected.repository) errors.push('lease repository does not match');
  if (candidate.operator_actor !== expected.operatorActor) errors.push('lease operator actor does not match');
  if (candidate.broker_actor !== expected.brokerActor) errors.push('lease broker actor does not match');
  if (candidate.attempt_id !== expected.attemptId) errors.push('lease attempt id does not match');
  if (candidate.workflow !== expected.workflow) errors.push('lease workflow does not match');
  if (candidate.artifact_kind !== expected.artifactKind) errors.push('lease artifact kind does not match');
  if (candidate.controller_workflow_sha !== expected.controllerWorkflowSha || !exactShaPattern.test(String(candidate.controller_workflow_sha))) {
    errors.push('lease controller workflow SHA does not match');
  }
  if (candidate.artifact_app_sha !== expected.artifactAppSha || !exactShaPattern.test(String(candidate.artifact_app_sha))) {
    errors.push('lease artifact App SHA does not match');
  }
  if (candidate.mutation_payload_sha256 !== expected.mutationPayloadSha256 || !digestRefPattern.test(String(candidate.mutation_payload_sha256))) {
    errors.push('lease mutation payload digest does not match');
  }
  if (candidate.planned_session_revision !== expected.plannedSessionRevision) errors.push('lease planned session revision does not match');
  if (candidate.issuer !== (expected.issuer ?? 'opl-release-broker')) errors.push('lease issuer does not match');
  if (!Array.isArray(candidate.allowed_mutations) || candidate.allowed_mutations.length !== 1 || candidate.allowed_mutations[0] !== expected.mutation) {
    errors.push('lease does not allow the exact historical mutation');
  }
  const expectedAuthorizationClass = expected.mutation === 'workflow_cancel'
    ? 'emergency_cancel'
    : expected.mutation === 'release_draft_cleanup'
      ? 'destructive_cleanup'
      : 'standard';
  if (candidate.authorization_class !== expectedAuthorizationClass) errors.push('lease authorization_class does not match');
  if (expected.mutation === 'workflow_cancel') {
    if (candidate.target_attempt_id !== (expected.targetAttemptId ?? null)) errors.push('cancel lease target attempt does not match');
    if (candidate.target_run_id !== (expected.targetRunId ?? null)) errors.push('cancel lease target run does not match');
  } else if (candidate.target_attempt_id !== null || candidate.target_run_id !== null) {
    errors.push('non-cancel lease must not bind a target attempt or run');
  }
  const issuedAt = Date.parse(String(candidate.issued_at));
  const expiresAt = Date.parse(String(candidate.expires_at));
  const now = Date.parse(expected.now ?? String(candidate.issued_at));
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt || expiresAt - issuedAt > 15 * 60 * 1000) {
    errors.push('lease timestamps are invalid');
  }
  if (Number.isFinite(now) && Number.isFinite(expiresAt) && now >= expiresAt) errors.push('release session lease is expired');
  if (!/^[0-9a-f]{32}$/.test(String(candidate.nonce))) errors.push('lease nonce is invalid');
  const boundary = candidate.credential_boundary as ReleaseSessionLeaseV2['credential_boundary'] | undefined;
  if (
    !boundary || boundary.lease_prevents_same_identity_api_bypass !== false
    || boundary.normal_codex_actions_write_allowed !== false
    || boundary.isolated_release_broker_token_required !== true
    || boundary.protected_environment_alone_blocks_cancel_or_rerun !== false
    || boundary.lease_intrinsically_enforces_nonce_single_use !== false
    || boundary.broker_durable_nonce_consumption_required !== true
  ) errors.push('lease credential boundary is incomplete');

  const { payload_digest: _digest, signature, ...payload } = candidate;
  const actualDigest = `sha256:${crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex')}`;
  if (candidate.payload_digest !== actualDigest) errors.push('lease payload_digest is invalid');
  if (!signature || typeof signature !== 'object' || Array.isArray(signature)) {
    errors.push('release session lease signature is missing');
  } else {
    const typedSignature = signature as ReleaseSessionLeaseV2['signature'];
    const publicKey = typedSignature && expected.publicKeys?.[typedSignature.key_id];
    if (typedSignature?.algorithm !== 'Ed25519' || !publicKey || typeof typedSignature.value_base64 !== 'string') {
      errors.push('release session lease signature is untrusted or malformed');
    } else {
      try {
        if (!crypto.verify(null, Buffer.from(canonicalJson(payload)), publicKey, Buffer.from(typedSignature.value_base64, 'base64'))) {
          errors.push('release session lease signature is invalid');
        }
      } catch (error) {
        errors.push(`release session lease signature validation failed safely: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return errors;
}

export function decodeReleaseSessionLease(encoded: string): ReleaseSessionLeaseV2 {
  const value = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Historical release session lease payload is malformed.');
  }
  return value as ReleaseSessionLeaseV2;
}
