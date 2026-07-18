import crypto from 'node:crypto';

export type ReleaseMutation =
  | 'desktop_release_dispatch'
  | 'qualification_dispatch'
  | 'full_addon_dispatch'
  | 'promotion_dispatch'
  | 'workflow_cancel'
  | 'release_draft_cleanup';

type LeasePayload = {
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
  workflow: 'desktop-release.yml' | 'opl-first-run-vm.yml' | 'desktop-release-promote.yml' |
    'desktop-release-full-addon.yml' | 'desktop-release-cleanup-drafts.yml';
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
};

export type ReleaseSessionLeaseV2 = LeasePayload & {
  payload_digest: string;
  signature: null | {
    algorithm: 'Ed25519';
    key_id: string;
    value_base64: string;
  };
};

const digestRefPattern = /^sha256:[0-9a-f]{64}$/;
const allMutations: ReleaseMutation[] = [
  'desktop_release_dispatch', 'qualification_dispatch', 'full_addon_dispatch', 'promotion_dispatch',
  'workflow_cancel', 'release_draft_cleanup',
];

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

function payloadBytes(payload: LeasePayload): Buffer {
  return Buffer.from(canonicalJson(payload), 'utf8');
}

function payloadDigest(payload: LeasePayload): string {
  return `sha256:${crypto.createHash('sha256').update(payloadBytes(payload)).digest('hex')}`;
}

export function buildReleaseSessionLease(input: {
  stableSessionId: string;
  releaseCohortRef: string;
  repository: string;
  operatorActor: string;
  brokerActor: string;
  attemptId: string;
  workflow: LeasePayload['workflow'];
  artifactKind: LeasePayload['artifact_kind'];
  controllerWorkflowSha: string;
  artifactAppSha: string;
  mutationPayloadSha256: string;
  plannedSessionRevision: number;
  mutation: ReleaseMutation;
  targetAttemptId?: string | null;
  targetRunId?: string | null;
  issuer?: string;
  issuedAt?: string;
  ttlMs?: number;
  nonce?: string;
  signingPrivateKeyPem?: string;
  keyId?: string;
}): ReleaseSessionLeaseV2 {
  if (!digestRefPattern.test(input.stableSessionId)) throw new Error('Lease stable session id must be a sha256 ref.');
  if (!digestRefPattern.test(input.releaseCohortRef)) throw new Error('Lease cohort ref must be a sha256 ref.');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository)) throw new Error('Lease repository must be an exact owner/name pair.');
  if (!/^[A-Za-z0-9-]{1,39}$/.test(input.operatorActor)) throw new Error('Lease operator actor must be an exact GitHub login.');
  if (!/^[A-Za-z0-9-]+(?:\[bot\])?$/.test(input.brokerActor)) throw new Error('Lease broker actor must be an exact GitHub App or login identity.');
  if (!digestRefPattern.test(input.attemptId)) throw new Error('Lease attempt id must be a sha256 ref.');
  if (!/^[0-9a-f]{40}$/.test(input.controllerWorkflowSha)) throw new Error('Lease controller workflow SHA must be exact.');
  if (!/^[0-9a-f]{40}$/.test(input.artifactAppSha)) throw new Error('Lease artifact App SHA must be exact.');
  if (!digestRefPattern.test(input.mutationPayloadSha256)) throw new Error('Lease mutation payload digest must be exact.');
  if (!Number.isSafeInteger(input.plannedSessionRevision) || input.plannedSessionRevision < 1) throw new Error('Lease planned session revision must be positive.');
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const issued = Date.parse(issuedAt);
  const ttlMs = input.ttlMs ?? 15 * 60 * 1000;
  if (!Number.isFinite(issued) || !Number.isSafeInteger(ttlMs) || ttlMs < 60_000 || ttlMs > 15 * 60 * 1000) {
    throw new Error('Lease timestamps or TTL are invalid; TTL must be between one and 15 minutes.');
  }
  if (!allMutations.includes(input.mutation)) throw new Error('Lease contains an unknown mutation.');
  if (input.mutation === 'workflow_cancel') {
    if (!digestRefPattern.test(String(input.targetAttemptId))) {
      throw new Error('Emergency cancel lease must bind the exact target attempt id.');
    }
    if (!/^[1-9]\d*$/.test(String(input.targetRunId))) {
      throw new Error('Emergency cancel lease must bind the exact target run id.');
    }
    if (input.targetAttemptId === input.attemptId) {
      throw new Error('Emergency cancel attempt must be distinct from its target attempt.');
    }
  } else if (input.targetAttemptId != null || input.targetRunId != null) {
    throw new Error('Only an emergency cancel lease may bind a target attempt or run.');
  }
  const signed = Boolean(input.signingPrivateKeyPem);
  const authorizationClass = input.mutation === 'workflow_cancel'
    ? 'emergency_cancel' as const
    : input.mutation === 'release_draft_cleanup'
      ? 'destructive_cleanup' as const
      : 'standard' as const;
  const payload: LeasePayload = {
    schema: 'opl_app_release_session_lease.v2',
    authorization_mode: signed ? 'ed25519_signed' : 'advisory_integrity_receipt',
    authorization_class: authorizationClass,
    issuer: input.issuer ?? 'opl-release-broker',
    repository: input.repository,
    stable_session_id: input.stableSessionId,
    release_cohort_ref: input.releaseCohortRef,
    operator_actor: input.operatorActor,
    broker_actor: input.brokerActor,
    attempt_id: input.attemptId,
    workflow: input.workflow,
    artifact_kind: input.artifactKind,
    controller_workflow_sha: input.controllerWorkflowSha,
    artifact_app_sha: input.artifactAppSha,
    mutation_payload_sha256: input.mutationPayloadSha256,
    planned_session_revision: input.plannedSessionRevision,
    target_attempt_id: input.targetAttemptId ?? null,
    target_run_id: input.targetRunId ?? null,
    nonce: input.nonce ?? crypto.randomBytes(16).toString('hex'),
    issued_at: issuedAt,
    expires_at: new Date(issued + ttlMs).toISOString(),
    allowed_mutations: [input.mutation],
    credential_boundary: {
      lease_prevents_same_identity_api_bypass: false,
      normal_codex_actions_write_allowed: false,
      isolated_release_broker_token_required: true,
      protected_environment_alone_blocks_cancel_or_rerun: false,
      lease_intrinsically_enforces_nonce_single_use: false,
      broker_durable_nonce_consumption_required: true,
    },
  };
  const digest = payloadDigest(payload);
  const signature = input.signingPrivateKeyPem
    ? {
        algorithm: 'Ed25519' as const,
        key_id: input.keyId || 'opl-release-broker-primary',
        value_base64: crypto.sign(null, payloadBytes(payload), input.signingPrivateKeyPem).toString('base64'),
      }
    : null;
  return { ...payload, payload_digest: digest, signature };
}

export function validateReleaseSessionLease(
  lease: unknown,
  expected: {
    stableSessionId: string;
    releaseCohortRef: string;
    repository: string;
    operatorActor: string;
    brokerActor: string;
    mutation: ReleaseMutation;
    attemptId: string;
    workflow: LeasePayload['workflow'];
    artifactKind: LeasePayload['artifact_kind'];
    controllerWorkflowSha: string;
    artifactAppSha: string;
    mutationPayloadSha256: string;
    plannedSessionRevision: number;
    targetAttemptId?: string | null;
    targetRunId?: string | null;
    issuer?: string;
    publicKeys?: Record<string, string>;
    requireSigned?: boolean;
    now?: string;
    freshnessMode?: 'admission' | 'historical';
    acceptedAt?: string;
  },
): string[] {
  if (!lease || typeof lease !== 'object') return ['release session lease is missing'];
  const errors: string[] = [];
  const candidate = lease as Partial<ReleaseSessionLeaseV2> & Record<string, unknown>;
  const { payload_digest: _digest, signature: _signature, ...payload } = candidate;
  if (candidate.schema !== 'opl_app_release_session_lease.v2') errors.push(`lease schema is ${String(candidate.schema)}`);
  try {
    if (candidate.payload_digest !== payloadDigest(payload as LeasePayload)) errors.push('payload_digest does not match lease payload bytes');
  } catch (error) {
    errors.push(`lease payload cannot be canonicalized: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (candidate.issuer !== (expected.issuer ?? 'opl-release-broker')) errors.push(`lease issuer is ${String(candidate.issuer)}`);
  if (candidate.stable_session_id !== expected.stableSessionId) errors.push('lease stable_session_id does not match');
  if (candidate.release_cohort_ref !== expected.releaseCohortRef) errors.push('lease release_cohort_ref does not match');
  if (candidate.repository !== expected.repository) errors.push('lease repository does not match');
  if (candidate.operator_actor !== expected.operatorActor) errors.push(`lease operator_actor is ${String(candidate.operator_actor)}`);
  if (candidate.broker_actor !== expected.brokerActor) errors.push(`lease broker_actor is ${String(candidate.broker_actor)}`);
  if (candidate.attempt_id !== expected.attemptId) errors.push('lease attempt_id does not match');
  if (candidate.workflow !== expected.workflow) errors.push(`lease workflow is ${String(candidate.workflow)}`);
  if (candidate.artifact_kind !== expected.artifactKind) errors.push(`lease artifact_kind is ${String(candidate.artifact_kind)}`);
  if (candidate.controller_workflow_sha !== expected.controllerWorkflowSha) {
    errors.push(`lease controller_workflow_sha is ${String(candidate.controller_workflow_sha)}`);
  }
  if (candidate.artifact_app_sha !== expected.artifactAppSha) {
    errors.push(`lease artifact_app_sha is ${String(candidate.artifact_app_sha)}`);
  }
  if (candidate.mutation_payload_sha256 !== expected.mutationPayloadSha256) errors.push('lease mutation_payload_sha256 does not match');
  if (candidate.planned_session_revision !== expected.plannedSessionRevision) errors.push('lease planned_session_revision does not match');
  const expectedAuthorizationClass = expected.mutation === 'workflow_cancel'
    ? 'emergency_cancel'
    : expected.mutation === 'release_draft_cleanup'
      ? 'destructive_cleanup'
      : 'standard';
  if (candidate.authorization_class !== expectedAuthorizationClass) {
    errors.push(`lease authorization_class is ${String(candidate.authorization_class)}`);
  }
  if (!Array.isArray(candidate.allowed_mutations) || candidate.allowed_mutations.length !== 1) {
    errors.push('lease allowed_mutations must contain exactly one mutation');
  } else if (!allMutations.includes(candidate.allowed_mutations[0] as ReleaseMutation)) {
    errors.push(`lease contains unknown mutation ${String(candidate.allowed_mutations[0])}`);
  } else if (candidate.allowed_mutations[0] !== expected.mutation) {
    errors.push(`lease does not allow ${expected.mutation}`);
  }
  if (typeof candidate.nonce !== 'string' || !/^[0-9a-f]{32}$/.test(candidate.nonce)) errors.push('lease nonce is invalid');
  if (expected.mutation === 'workflow_cancel') {
    if (!digestRefPattern.test(String(candidate.target_attempt_id))) errors.push('cancel lease target_attempt_id is invalid');
    if (!/^[1-9]\d*$/.test(String(candidate.target_run_id))) errors.push('cancel lease target_run_id is invalid');
    if (candidate.target_attempt_id === candidate.attempt_id) errors.push('cancel lease target attempt is not distinct');
    if (expected.targetAttemptId !== undefined && candidate.target_attempt_id !== expected.targetAttemptId) {
      errors.push('cancel lease target_attempt_id does not match');
    }
    if (expected.targetRunId !== undefined && candidate.target_run_id !== expected.targetRunId) {
      errors.push('cancel lease target_run_id does not match');
    }
  } else if (candidate.target_attempt_id !== null || candidate.target_run_id !== null) {
    errors.push('non-cancel lease must not bind a target attempt or run');
  }
  const current = Date.parse(expected.now ?? new Date().toISOString());
  const issued = typeof candidate.issued_at === 'string' ? Date.parse(candidate.issued_at) : Number.NaN;
  const expires = typeof candidate.expires_at === 'string' ? Date.parse(candidate.expires_at) : Number.NaN;
  if (!Number.isFinite(current) || !Number.isFinite(issued) || !Number.isFinite(expires)) {
    errors.push('lease timestamps are invalid');
  } else {
    if (expires <= issued || expires - issued > 15 * 60 * 1000) {
      errors.push('lease validity window must be positive and no longer than 15 minutes');
    }
    if ((expected.freshnessMode ?? 'admission') === 'admission') {
      if (current < issued) errors.push('lease is not active yet');
      if (current >= expires) errors.push('lease is expired');
    } else {
      const accepted = Date.parse(String(expected.acceptedAt));
      if (!Number.isFinite(accepted) || accepted < issued || accepted >= expires) {
        errors.push('historical acceptance was not created inside the lease admission window');
      }
    }
  }
  const requireSigned = expected.requireSigned ?? true;
  if (requireSigned && candidate.authorization_mode !== 'ed25519_signed') {
    errors.push('lease is only an advisory integrity receipt; signed broker authorization is required');
  }
  if (candidate.signature && typeof candidate.signature === 'object') {
    const signature = candidate.signature as Partial<NonNullable<ReleaseSessionLeaseV2['signature']>>;
    const publicKey = expected.publicKeys && typeof expected.publicKeys === 'object'
      && typeof signature.key_id === 'string' ? expected.publicKeys[signature.key_id] : undefined;
    if (signature.algorithm !== 'Ed25519' || typeof signature.key_id !== 'string' || typeof signature.value_base64 !== 'string') {
      errors.push('lease signature shape is invalid');
    } else if (!publicKey || typeof publicKey !== 'string') {
      errors.push(`no trusted broker public key for ${String(signature.key_id)}`);
    } else {
      try {
        if (!crypto.verify(null, payloadBytes(payload as LeasePayload), publicKey, Buffer.from(signature.value_base64, 'base64'))) {
          errors.push('lease Ed25519 signature is invalid');
        }
      } catch (error) {
        errors.push(`lease signature verification failed safely: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } else if (requireSigned) {
    errors.push('lease signature is missing');
  }
  if (
    !candidate.credential_boundary || typeof candidate.credential_boundary !== 'object' ||
    candidate.credential_boundary.lease_prevents_same_identity_api_bypass !== false ||
    candidate.credential_boundary.normal_codex_actions_write_allowed !== false ||
    candidate.credential_boundary.isolated_release_broker_token_required !== true ||
    candidate.credential_boundary.protected_environment_alone_blocks_cancel_or_rerun !== false ||
    candidate.credential_boundary.lease_intrinsically_enforces_nonce_single_use !== false ||
    candidate.credential_boundary.broker_durable_nonce_consumption_required !== true
  ) {
    errors.push('lease credential boundary is incomplete');
  }
  return errors;
}

export function encodeReleaseSessionLease(lease: ReleaseSessionLeaseV2): string {
  return Buffer.from(JSON.stringify(lease), 'utf8').toString('base64');
}

export function decodeReleaseSessionLease(encoded: string): ReleaseSessionLeaseV2 {
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as ReleaseSessionLeaseV2;
}
