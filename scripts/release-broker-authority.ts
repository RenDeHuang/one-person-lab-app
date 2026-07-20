import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export type CredentialIsolationReceiptV1 = {
  schema: 'opl_app_release_credential_isolation_receipt.v1';
  status: 'verified';
  authority_sha256: string;
  observed_at: string;
  expires_at: string;
  normal_credential: {
    actor: string;
    token_fingerprint: string;
    actions_write_allowed: false;
    protected_main_push_allowed: false;
    release_control_plane_write_allowed: false;
    ruleset_bypass_allowed: false;
    required_review_bypass_allowed: false;
  };
  broker_credential: {
    actor: string; token_fingerprint: string; actions_write_allowed: true; backend: string;
    endpoint_path: string; endpoint_sha256: string; endpoint_codesign_identity: string;
  };
  private_key: { backend: string; inherited_by_normal_codex_processes: false };
  caller_admission: {
    backend: string;
    operator_actor: string;
    operator_identity_source: string;
    self_asserted_operator_allowed: false;
    normal_codex_direct_github_mutation_allowed: false;
  };
  signature: { algorithm: 'Ed25519'; key_id: string; value_base64: string };
};

export type ReleaseBrokerAuthorityV1 = {
  schema: 'opl_app_release_broker_authority.v1';
  status: 'provisioned' | 'unprovisioned_release_blocking';
  authority_epoch: number;
  issuer: string;
  allowed_repositories: ['gaofeng21cn/one-person-lab-app'];
  broker_identity: { github_actor: string };
  operator_identity: { github_actor: string; source: 'broker_authenticated_caller' };
  current_release_admission: {
    mode: 'admin_one_shot_controller';
    allowed_workflows: ['release-stable.yml'];
    requires_canonical_main: true;
    requires_durable_planned_and_dispatching: true;
    requires_exact_payload_digest: true;
    requires_run_attempt_one: true;
    redispatch_after_unknown_outcome: false;
    rerun_allowed: false;
    cancel_allowed: false;
    isolated_broker_is_current_release_prerequisite: false;
    isolated_broker_disposition: 'post_release_hardening';
  };
  mutation_broker: {
    protocol_version: 1;
    executable_path: string;
    executable_sha256: string | null;
    executable_codesign_identity: string | null;
    environment_inheritance_allowed: false;
    caller_admission_required: true;
    verified_open_file_descriptor_execution_required: true;
    ledger_lookup_supported: true;
    exact_run_id_binding_required: true;
    lookup_read_consistency: 'linearizable';
    lookup_caller_admission_required: true;
    lookup_requires_mutation_isolation_receipt: false;
    lookup_result_signature_required: true;
    outbound_pre_api_fence_input: 'pre_api_admission_receipt_base64';
    approved_controller_workflow_shas: string[];
  };
  workflow_lookup: {
    protocol_version: 2;
    endpoint_url: string | null;
    request_method: 'POST';
    github_oidc_caller_admission_required: true;
    oidc_audience: string | null;
    response_schema: 'opl_app_release_mutation_broker_ledger_lookup_result.v2';
    random_challenge_required: true;
    authority_epoch_required: true;
    transport_failure_is_authoritative_not_found: false;
    redispatch_allowed_after_lookup_failure: false;
  };
  historical_verification_epochs: Array<{
    authority_epoch: number;
    authority_sha256: string;
    authority_snapshot_base64: string;
    trusted_key_ids: string[];
    admission_closed: true;
    verify_only: true;
  }>;
  canonical_workflow_ref: 'refs/heads/main';
  trusted_ed25519_public_keys: Record<string, string>;
  credential_isolation_receipt: {
    required: true;
    max_age_seconds: number;
    environment_path_variable: 'OPL_RELEASE_BROKER_CREDENTIAL_ISOLATION_RECEIPT_PATH';
  };
  credential_isolation: {
    observed: {
      normal_codex_actions_write_allowed: boolean;
      release_broker_actions_write_token_isolated: boolean;
      normal_codex_protected_main_push_allowed: boolean;
      normal_codex_release_control_plane_write_allowed: boolean;
      normal_codex_ruleset_bypass_allowed: boolean;
      normal_codex_required_review_bypass_allowed: boolean;
    };
    required: {
      normal_codex_actions_write_allowed: false;
      release_broker_actions_write_token_isolated: true;
      same_identity_direct_api_bypass_prevented: true;
      normal_codex_protected_main_push_allowed: false;
      normal_codex_release_control_plane_write_allowed: false;
      normal_codex_ruleset_bypass_allowed: false;
      normal_codex_required_review_bypass_allowed: false;
    };
    protected_environment_alone_blocks_cancel_or_rerun: false;
  };
  global_idempotency_ledger: {
    required: true;
    key_fields: ['repository', 'channel', 'version'];
    global_latest_mutation_key_fields: ['repository', 'channel'];
    global_latest_mutation_cross_version_mutex: true;
    global_latest_mutation_applies_to: ['promotion_dispatch'];
    version_scoped_mutations: ['desktop_release_dispatch', 'qualification_dispatch', 'full_addon_dispatch', 'release_draft_cleanup'];
    version_attempts_strictly_ordered: true;
    emergency_cancel_has_distinct_attempt_state: true;
    admission_fence_durable_before_api_call: true;
    ledger_lookup_by_attempt_required: true;
    nonce_single_use_enforced: true;
    same_attempt_returns_same_receipt: true;
    conflicting_session_or_cohort_rejected: true;
    concurrent_different_attempt_rejected: true;
    pre_api_planned_fence_required: true;
    unknown_api_result_requires_reconcile: true;
  };
  version_aggregate: {
    schema: 'opl_app_release_mutation_version_aggregate.v1';
    key_fields: ['repository', 'channel', 'version'];
    immutable_identity_fields: ['stable_session_id', 'release_cohort_ref'];
    signed_complete_snapshot_required: true;
    monotonic_revision_required: true;
    sequence_starts_at: 1;
    sequence_must_be_contiguous: true;
    head_record_count_watermark_required: true;
    partition_complete_from_sequence_one_required: true;
    linearizable_currentness_proof_required: true;
  };
  latest_mutation_mutex: {
    schema: 'opl_app_release_latest_mutation_head.v1';
    key_fields: ['repository', 'channel'];
    applies_to_mutations: ['promotion_dispatch'];
    states: ['free', 'held', 'outcome_unknown', 'cancel_requested'];
    cross_version_conflict_rejected: true;
    emergency_cancel_is_owner_child_operation: true;
    emergency_cancel_does_not_advance_head: true;
    cancel_binds_owner_attempt_fence_and_exact_run: true;
    release_requires_owner_terminal_and_latest_readback: true;
    expiry_does_not_release: true;
  };
  nonce_ledger: {
    consume_before_api: true;
    durable_atomic_with_pre_api_fence: true;
    single_use: true;
    same_attempt_replay_returns_original_receipt: true;
    different_attempt_reuse_rejected: true;
    lease_expiry_does_not_forget_consumption: true;
  };
  durable_lookup: {
    schema: 'opl_app_release_mutation_broker_ledger_lookup_result.v2';
    statuses: ['found', 'not_found', 'outcome_unknown'];
    signed_response_required: true;
    linearizable_read_required: true;
    max_currentness_age_seconds: 30;
    lookup_by_attempt_required: true;
    exact_request_digest_required: true;
    not_found_proves_no_durable_fence_or_api_call: true;
    outcome_unknown_is_reconcile_only: true;
    malformed_or_unavailable_never_downgrades_to_not_found: true;
  };
  receipt_lifetime: {
    admission_ttl_seconds: 900;
    historical_signature_validation_expires: false;
    expired_lease_cannot_authorize_new_api_call: true;
    expired_lease_does_not_invalidate_historical_acceptance: true;
  };
  full_addon_admission_clock: {
    duration_seconds: 3000;
    standard_admission_deadline_role: 'immutable_standard_identity_only';
    deadline_field: 'full_addon_deadline_at';
    pre_api_fence_source: 'persisted_at';
    acceptance_source: 'accepted_at';
    workflow_validation_source: 'signed_acceptance';
    signed_in_pre_api_fence: true;
    signed_in_acceptance: true;
    expired_workflow_admission_fails_closed: true;
    reopens_standard_terminal: false;
  };
  pre_api_fence: {
    schema: 'opl_app_release_mutation_pre_api_fence.v1';
    signed: true;
    durable_before_api_call: true;
    contains_exact_request_and_lease: true;
    nonce_consumption_atomic_with_fence: true;
    api_outcome_unknown_until_signed_acceptance: true;
  };
};

const credentialFingerprintPattern = /^sha256:[0-9a-f]{64}$/;

function validateCredentialIdentity(input: {
  normalActor: unknown;
  normalTokenFingerprint: unknown;
  brokerActor: unknown;
  brokerTokenFingerprint: unknown;
}): string[] {
  const errors: string[] = [];
  const normalActor = typeof input.normalActor === 'string' ? input.normalActor.trim() : '';
  const brokerActor = typeof input.brokerActor === 'string' ? input.brokerActor.trim() : '';
  if (!normalActor) errors.push('normal credential actor is missing');
  if (!brokerActor) errors.push('broker credential actor is missing');
  if (normalActor && brokerActor && normalActor === brokerActor) {
    errors.push('normal credential actor must differ from broker actor');
  }
  if (!credentialFingerprintPattern.test(String(input.normalTokenFingerprint))) {
    errors.push('normal credential token fingerprint must be a lowercase sha256 digest');
  }
  if (!credentialFingerprintPattern.test(String(input.brokerTokenFingerprint))) {
    errors.push('broker credential token fingerprint must be a lowercase sha256 digest');
  }
  if (
    typeof input.normalTokenFingerprint === 'string' &&
    input.normalTokenFingerprint === input.brokerTokenFingerprint
  ) {
    errors.push('normal and broker credential fingerprints must differ');
  }
  return errors;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
}

export function releaseBrokerAuthoritySha256(authority: ReleaseBrokerAuthorityV1): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(authority)).digest('hex')}`;
}

export function buildCredentialIsolationReceipt(input: {
  authority: ReleaseBrokerAuthorityV1; observedAt: string; expiresAt: string;
  normalActor: string; normalTokenFingerprint: string;
  brokerActor: string; brokerTokenFingerprint: string; brokerBackend: string;
  brokerEndpointPath: string; brokerEndpointSha256: string; brokerEndpointCodesignIdentity: string;
  privateKeyBackend: string; keyId: string; signingPrivateKeyPem: string;
  callerAdmissionBackend: string; operatorActor: string; operatorIdentitySource: string;
}): CredentialIsolationReceiptV1 {
  const identityErrors = validateCredentialIdentity(input);
  if (identityErrors.length > 0) {
    throw new Error(`Invalid credential isolation identity: ${identityErrors.join('; ')}`);
  }
  const payload = {
    schema: 'opl_app_release_credential_isolation_receipt.v1' as const,
    status: 'verified' as const,
    authority_sha256: releaseBrokerAuthoritySha256(input.authority),
    observed_at: input.observedAt,
    expires_at: input.expiresAt,
    normal_credential: {
      actor: input.normalActor,
      token_fingerprint: input.normalTokenFingerprint,
      actions_write_allowed: false as const,
      protected_main_push_allowed: false as const,
      release_control_plane_write_allowed: false as const,
      ruleset_bypass_allowed: false as const,
      required_review_bypass_allowed: false as const,
    },
    broker_credential: {
      actor: input.brokerActor, token_fingerprint: input.brokerTokenFingerprint,
      actions_write_allowed: true as const, backend: input.brokerBackend,
      endpoint_path: input.brokerEndpointPath, endpoint_sha256: input.brokerEndpointSha256,
      endpoint_codesign_identity: input.brokerEndpointCodesignIdentity,
    },
    private_key: { backend: input.privateKeyBackend, inherited_by_normal_codex_processes: false as const },
    caller_admission: {
      backend: input.callerAdmissionBackend,
      operator_actor: input.operatorActor,
      operator_identity_source: input.operatorIdentitySource,
      self_asserted_operator_allowed: false as const,
      normal_codex_direct_github_mutation_allowed: false as const,
    },
  };
  return { ...payload, signature: {
    algorithm: 'Ed25519', key_id: input.keyId,
    value_base64: crypto.sign(null, Buffer.from(canonicalJson(payload)), input.signingPrivateKeyPem).toString('base64'),
  } };
}

export function validateCredentialIsolationReceipt(
  receipt: unknown,
  authority: ReleaseBrokerAuthorityV1,
  now = new Date().toISOString(),
): string[] {
  if (!receipt || typeof receipt !== 'object') return ['fresh credential isolation receipt is missing'];
  const candidate = receipt as Partial<CredentialIsolationReceiptV1> & Record<string, unknown>;
  const errors: string[] = [];
  const { signature, ...payload } = candidate;
  if (candidate.schema !== 'opl_app_release_credential_isolation_receipt.v1' || candidate.status !== 'verified') errors.push('credential isolation receipt schema/status is invalid');
  if (candidate.authority_sha256 !== releaseBrokerAuthoritySha256(authority)) errors.push('credential isolation receipt is not bound to canonical authority bytes');
  const observed = Date.parse(String(candidate.observed_at));
  const expires = Date.parse(String(candidate.expires_at));
  const current = Date.parse(now);
  const maxAgeMs = authority.credential_isolation_receipt.max_age_seconds * 1_000;
  if (!Number.isFinite(observed) || !Number.isFinite(expires) || !Number.isFinite(current) || current < observed || current >= expires || expires - observed > maxAgeMs) {
    errors.push('credential isolation receipt is expired, not active, or exceeds the freshness window');
  }
  if (candidate.normal_credential?.actions_write_allowed !== false) errors.push('normal Codex credential is not proven Actions read-only');
  if (
    candidate.normal_credential?.protected_main_push_allowed !== false ||
    candidate.normal_credential?.release_control_plane_write_allowed !== false ||
    candidate.normal_credential?.ruleset_bypass_allowed !== false ||
    candidate.normal_credential?.required_review_bypass_allowed !== false
  ) errors.push('normal Codex credential is not proven unable to push protected main, alter the release control plane, or bypass repository policy');
  if (candidate.broker_credential?.actions_write_allowed !== true || !candidate.broker_credential?.backend) errors.push('isolated broker Actions-write credential is not proven');
  if (candidate.broker_credential?.actor !== authority.broker_identity.github_actor) errors.push('credential isolation receipt broker actor does not match authority');
  if (
    candidate.broker_credential?.endpoint_path !== authority.mutation_broker.executable_path ||
    candidate.broker_credential?.endpoint_sha256 !== authority.mutation_broker.executable_sha256 ||
    candidate.broker_credential?.endpoint_codesign_identity !== authority.mutation_broker.executable_codesign_identity
  ) errors.push('credential isolation receipt broker endpoint does not match canonical authority');
  errors.push(...validateCredentialIdentity({
    normalActor: candidate.normal_credential?.actor,
    normalTokenFingerprint: candidate.normal_credential?.token_fingerprint,
    brokerActor: candidate.broker_credential?.actor,
    brokerTokenFingerprint: candidate.broker_credential?.token_fingerprint,
  }));
  if (candidate.private_key?.inherited_by_normal_codex_processes !== false || !candidate.private_key?.backend) errors.push('broker private-key isolation is not proven');
  if (
    !candidate.caller_admission?.backend ||
    candidate.caller_admission.operator_actor !== authority.operator_identity.github_actor ||
    candidate.caller_admission.operator_identity_source !== authority.operator_identity.source ||
    candidate.caller_admission.self_asserted_operator_allowed !== false ||
    candidate.caller_admission.normal_codex_direct_github_mutation_allowed !== false
  ) errors.push('broker caller admission is not proven');
  if (!signature || typeof signature !== 'object' || signature.algorithm !== 'Ed25519' || typeof signature.key_id !== 'string' || typeof signature.value_base64 !== 'string') {
    errors.push('credential isolation receipt signature is malformed');
  } else {
    const publicKey = authority.trusted_ed25519_public_keys[signature.key_id];
    try {
      if (!publicKey || !crypto.verify(null, Buffer.from(canonicalJson(payload)), publicKey, Buffer.from(signature.value_base64, 'base64'))) errors.push('credential isolation receipt signature is invalid');
    } catch (error) {
      errors.push(`credential isolation receipt signature verification failed safely: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

const canonicalReleaseBrokerAuthorityPath = fileURLToPath(new URL('../contracts/app-release-broker-authority.json', import.meta.url));

export function readReleaseBrokerAuthority(
  authorityPath = canonicalReleaseBrokerAuthorityPath,
): ReleaseBrokerAuthorityV1 {
  return JSON.parse(fs.readFileSync(path.resolve(authorityPath), 'utf8')) as ReleaseBrokerAuthorityV1;
}

export function readValidatedCredentialIsolationReceipt(
  authority: ReleaseBrokerAuthorityV1,
  now = new Date().toISOString(),
): CredentialIsolationReceiptV1 {
  const receiptPath = process.env[authority.credential_isolation_receipt.environment_path_variable];
  if (!receiptPath) throw new Error('fresh external credential isolation receipt path is not configured');
  const receipt = JSON.parse(fs.readFileSync(path.resolve(receiptPath), 'utf8')) as CredentialIsolationReceiptV1;
  const errors = validateCredentialIsolationReceipt(receipt, authority, now);
  if (errors.length > 0) throw new Error(errors.join('; '));
  return receipt;
}

export function resolveHistoricalReleaseBrokerAuthority(
  currentAuthority: ReleaseBrokerAuthorityV1,
  authorityEpoch: number,
  authoritySha256: string,
  keyId: string,
): ReleaseBrokerAuthorityV1 {
  if (
    authorityEpoch === currentAuthority.authority_epoch &&
    authoritySha256 === releaseBrokerAuthoritySha256(currentAuthority) &&
    typeof currentAuthority.trusted_ed25519_public_keys[keyId] === 'string'
  ) return currentAuthority;
  const entry = currentAuthority.historical_verification_epochs.find((candidate) =>
    candidate.authority_epoch === authorityEpoch && candidate.authority_sha256 === authoritySha256 &&
    candidate.trusted_key_ids.includes(keyId)
  );
  if (!entry || entry.admission_closed !== true || entry.verify_only !== true) {
    throw new Error('historical release broker authority epoch/key is not present in the append-only verify-only registry');
  }
  let snapshot: ReleaseBrokerAuthorityV1;
  try {
    snapshot = JSON.parse(Buffer.from(entry.authority_snapshot_base64, 'base64').toString('utf8')) as ReleaseBrokerAuthorityV1;
  } catch (error) {
    throw new Error(`historical release broker authority snapshot is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (
    snapshot.authority_epoch !== authorityEpoch || releaseBrokerAuthoritySha256(snapshot) !== authoritySha256 ||
    typeof snapshot.trusted_ed25519_public_keys[keyId] !== 'string'
  ) throw new Error('historical release broker authority snapshot digest/epoch/key is mismatched');
  const errors = validateReleaseBrokerAuthority(snapshot, { capability: 'contract_read' });
  if (errors.length > 0) throw new Error(`historical release broker authority snapshot is malformed: ${errors.join('; ')}`);
  return snapshot;
}

export function validateReleaseBrokerAuthority(
  authority: unknown,
  options: {
    capability?: 'contract_read' | 'ledger_lookup' | 'mutation_submit';
    requireProvisioned?: boolean;
    requireCredentialReceipt?: boolean;
    currentWorkflowRef?: string;
  } = {},
): string[] {
  if (!authority || typeof authority !== 'object') return ['release broker authority is missing or malformed'];
  const candidate = authority as Partial<ReleaseBrokerAuthorityV1> & Record<string, unknown>;
  const errors: string[] = [];
  const capability = options.capability ?? (options.requireProvisioned === false ? 'contract_read' : 'mutation_submit');
  if (candidate.schema !== 'opl_app_release_broker_authority.v1') errors.push('release broker authority schema is invalid');
  if (candidate.status !== 'provisioned' && candidate.status !== 'unprovisioned_release_blocking') {
    errors.push('release broker authority status is invalid');
  }
  if (!Number.isSafeInteger(candidate.authority_epoch) || Number(candidate.authority_epoch) < 0) {
    errors.push('release broker authority epoch is invalid');
  }
  if (candidate.canonical_workflow_ref !== 'refs/heads/main') errors.push('release broker canonical workflow ref must be refs/heads/main');
  if (!Array.isArray(candidate.allowed_repositories) || candidate.allowed_repositories.length !== 1 || candidate.allowed_repositories[0] !== 'gaofeng21cn/one-person-lab-app') {
    errors.push('release broker repository allowlist is invalid');
  }
  if (!candidate.broker_identity || typeof candidate.broker_identity !== 'object' || typeof candidate.broker_identity.github_actor !== 'string' || !candidate.broker_identity.github_actor) {
    errors.push('release broker GitHub actor identity is missing');
  }
  if (
    !candidate.operator_identity || typeof candidate.operator_identity !== 'object' ||
    typeof candidate.operator_identity.github_actor !== 'string' || !candidate.operator_identity.github_actor ||
    candidate.operator_identity.source !== 'broker_authenticated_caller'
  ) errors.push('release operator identity authority is malformed');
  const currentAdmission = candidate.current_release_admission;
  if (
    !currentAdmission || typeof currentAdmission !== 'object' ||
    currentAdmission.mode !== 'admin_one_shot_controller' ||
    JSON.stringify(currentAdmission.allowed_workflows) !== JSON.stringify(['release-stable.yml']) ||
    currentAdmission.requires_canonical_main !== true ||
    currentAdmission.requires_durable_planned_and_dispatching !== true ||
    currentAdmission.requires_exact_payload_digest !== true ||
    currentAdmission.requires_run_attempt_one !== true ||
    currentAdmission.redispatch_after_unknown_outcome !== false ||
    currentAdmission.rerun_allowed !== false ||
    currentAdmission.cancel_allowed !== false ||
    currentAdmission.isolated_broker_is_current_release_prerequisite !== false ||
    currentAdmission.isolated_broker_disposition !== 'post_release_hardening'
  ) errors.push('current Stable release admission authority is malformed or targets a retired workflow');
  const mutationBroker = candidate.mutation_broker;
  if (
    !mutationBroker || typeof mutationBroker !== 'object' || mutationBroker.protocol_version !== 1 ||
    typeof mutationBroker.executable_path !== 'string' || !path.isAbsolute(mutationBroker.executable_path) ||
    mutationBroker.environment_inheritance_allowed !== false || mutationBroker.caller_admission_required !== true ||
    mutationBroker.verified_open_file_descriptor_execution_required !== true ||
    mutationBroker.ledger_lookup_supported !== true ||
    mutationBroker.exact_run_id_binding_required !== true ||
    mutationBroker.lookup_read_consistency !== 'linearizable' ||
    mutationBroker.lookup_caller_admission_required !== true ||
    mutationBroker.lookup_requires_mutation_isolation_receipt !== false ||
    mutationBroker.lookup_result_signature_required !== true ||
    mutationBroker.outbound_pre_api_fence_input !== 'pre_api_admission_receipt_base64' ||
    !Array.isArray(mutationBroker.approved_controller_workflow_shas) ||
    mutationBroker.approved_controller_workflow_shas.some((sha) => !/^[0-9a-f]{40}$/.test(String(sha))) ||
    new Set(mutationBroker.approved_controller_workflow_shas).size !== mutationBroker.approved_controller_workflow_shas.length
  ) errors.push('release mutation broker endpoint authority is malformed');
  const workflowLookup = candidate.workflow_lookup;
  if (
    !workflowLookup || typeof workflowLookup !== 'object' || workflowLookup.protocol_version !== 2 ||
    (workflowLookup.endpoint_url !== null && !/^https:\/\/[^\s]+$/.test(String(workflowLookup.endpoint_url))) ||
    workflowLookup.request_method !== 'POST' || workflowLookup.github_oidc_caller_admission_required !== true ||
    (workflowLookup.oidc_audience !== null && (typeof workflowLookup.oidc_audience !== 'string' || !workflowLookup.oidc_audience)) ||
    workflowLookup.response_schema !== 'opl_app_release_mutation_broker_ledger_lookup_result.v2' ||
    workflowLookup.random_challenge_required !== true || workflowLookup.authority_epoch_required !== true ||
    workflowLookup.transport_failure_is_authoritative_not_found !== false ||
    workflowLookup.redispatch_allowed_after_lookup_failure !== false
  ) errors.push('release workflow broker lookup authority is malformed');
  const historicalEpochs = candidate.historical_verification_epochs;
  if (!Array.isArray(historicalEpochs)) {
    errors.push('historical release broker verification epoch registry is malformed');
  } else {
    let previousEpoch = -1;
    for (const entry of historicalEpochs) {
      if (
        !entry || typeof entry !== 'object' || !Number.isSafeInteger(entry.authority_epoch) ||
        entry.authority_epoch < 1 || entry.authority_epoch >= Number(candidate.authority_epoch) ||
        entry.authority_epoch <= previousEpoch || !/^sha256:[0-9a-f]{64}$/.test(String(entry.authority_sha256)) ||
        typeof entry.authority_snapshot_base64 !== 'string' || !entry.authority_snapshot_base64 ||
        !Array.isArray(entry.trusted_key_ids) || entry.trusted_key_ids.length === 0 ||
        entry.trusted_key_ids.some((keyId) => typeof keyId !== 'string' || !keyId) ||
        entry.admission_closed !== true || entry.verify_only !== true
      ) {
        errors.push('historical release broker verification epoch entry is malformed, reusable, or not append-only ordered');
        continue;
      }
      previousEpoch = entry.authority_epoch;
      try {
        const snapshot = JSON.parse(Buffer.from(entry.authority_snapshot_base64, 'base64').toString('utf8')) as ReleaseBrokerAuthorityV1;
        if (
          snapshot.authority_epoch !== entry.authority_epoch ||
          releaseBrokerAuthoritySha256(snapshot) !== entry.authority_sha256 ||
          entry.trusted_key_ids.some((keyId) => typeof snapshot.trusted_ed25519_public_keys?.[keyId] !== 'string')
        ) errors.push('historical release broker verification epoch snapshot digest/epoch/key is mismatched');
      } catch (error) {
        errors.push(`historical release broker verification epoch snapshot is unreadable: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  if (typeof candidate.issuer !== 'string' || !candidate.issuer.trim()) errors.push('release broker issuer is missing');
  const keys = candidate.trusted_ed25519_public_keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) errors.push('trusted Ed25519 public key map is malformed');
  const isolation = candidate.credential_isolation;
  if (!isolation || typeof isolation !== 'object') {
    errors.push('release broker credential isolation boundary is missing');
  } else {
    if (!isolation.observed || typeof isolation.observed !== 'object') {
      errors.push('release broker observed credential isolation is missing');
    }
    if (
      !isolation.required || typeof isolation.required !== 'object' ||
      isolation.required.normal_codex_actions_write_allowed !== false ||
      isolation.required.release_broker_actions_write_token_isolated !== true ||
      isolation.required.same_identity_direct_api_bypass_prevented !== true ||
      isolation.required.normal_codex_protected_main_push_allowed !== false ||
      isolation.required.normal_codex_release_control_plane_write_allowed !== false ||
      isolation.required.normal_codex_ruleset_bypass_allowed !== false ||
      isolation.required.normal_codex_required_review_bypass_allowed !== false
    ) {
      errors.push('release broker required credential isolation is malformed');
    }
    if (isolation.protected_environment_alone_blocks_cancel_or_rerun !== false) {
      errors.push('protected environment must not be represented as sufficient cancel/rerun protection');
    }
  }
  const ledger = candidate.global_idempotency_ledger;
  if (
    !ledger || typeof ledger !== 'object' || ledger.required !== true ||
    JSON.stringify(ledger.key_fields) !== JSON.stringify(['repository', 'channel', 'version']) ||
    JSON.stringify(ledger.global_latest_mutation_key_fields) !== JSON.stringify(['repository', 'channel']) ||
    ledger.global_latest_mutation_cross_version_mutex !== true ||
    JSON.stringify(ledger.global_latest_mutation_applies_to) !== JSON.stringify(['promotion_dispatch']) ||
    JSON.stringify(ledger.version_scoped_mutations) !== JSON.stringify([
      'desktop_release_dispatch', 'qualification_dispatch', 'full_addon_dispatch', 'release_draft_cleanup',
    ]) ||
    ledger.version_attempts_strictly_ordered !== true ||
    ledger.emergency_cancel_has_distinct_attempt_state !== true ||
    ledger.admission_fence_durable_before_api_call !== true ||
    ledger.ledger_lookup_by_attempt_required !== true ||
    ledger.nonce_single_use_enforced !== true ||
    ledger.same_attempt_returns_same_receipt !== true ||
    ledger.conflicting_session_or_cohort_rejected !== true ||
    ledger.concurrent_different_attempt_rejected !== true ||
    ledger.pre_api_planned_fence_required !== true ||
    ledger.unknown_api_result_requires_reconcile !== true
  ) errors.push('release broker global idempotency ledger policy is malformed');
  const versionAggregate = candidate.version_aggregate;
  if (
    !versionAggregate || typeof versionAggregate !== 'object' ||
    versionAggregate.schema !== 'opl_app_release_mutation_version_aggregate.v1' ||
    JSON.stringify(versionAggregate.key_fields) !== JSON.stringify(['repository', 'channel', 'version']) ||
    JSON.stringify(versionAggregate.immutable_identity_fields) !== JSON.stringify(['stable_session_id', 'release_cohort_ref']) ||
    versionAggregate.signed_complete_snapshot_required !== true ||
    versionAggregate.monotonic_revision_required !== true || versionAggregate.sequence_starts_at !== 1 ||
    versionAggregate.sequence_must_be_contiguous !== true ||
    versionAggregate.head_record_count_watermark_required !== true ||
    versionAggregate.partition_complete_from_sequence_one_required !== true ||
    versionAggregate.linearizable_currentness_proof_required !== true
  ) errors.push('release broker version aggregate policy is malformed');
  const latestMutex = candidate.latest_mutation_mutex;
  if (
    !latestMutex || typeof latestMutex !== 'object' || latestMutex.schema !== 'opl_app_release_latest_mutation_head.v1' ||
    JSON.stringify(latestMutex.key_fields) !== JSON.stringify(['repository', 'channel']) ||
    JSON.stringify(latestMutex.applies_to_mutations) !== JSON.stringify(['promotion_dispatch']) ||
    JSON.stringify(latestMutex.states) !== JSON.stringify(['free', 'held', 'outcome_unknown', 'cancel_requested']) ||
    latestMutex.cross_version_conflict_rejected !== true || latestMutex.emergency_cancel_is_owner_child_operation !== true ||
    latestMutex.emergency_cancel_does_not_advance_head !== true || latestMutex.cancel_binds_owner_attempt_fence_and_exact_run !== true ||
    latestMutex.release_requires_owner_terminal_and_latest_readback !== true || latestMutex.expiry_does_not_release !== true
  ) errors.push('release broker latest mutation mutex policy is malformed');
  const nonceLedger = candidate.nonce_ledger;
  if (
    !nonceLedger || typeof nonceLedger !== 'object' || nonceLedger.consume_before_api !== true ||
    nonceLedger.durable_atomic_with_pre_api_fence !== true || nonceLedger.single_use !== true ||
    nonceLedger.same_attempt_replay_returns_original_receipt !== true || nonceLedger.different_attempt_reuse_rejected !== true ||
    nonceLedger.lease_expiry_does_not_forget_consumption !== true
  ) errors.push('release broker nonce ledger policy is malformed');
  const durableLookup = candidate.durable_lookup;
  if (
    !durableLookup || typeof durableLookup !== 'object' ||
    durableLookup.schema !== 'opl_app_release_mutation_broker_ledger_lookup_result.v2' ||
    JSON.stringify(durableLookup.statuses) !== JSON.stringify(['found', 'not_found', 'outcome_unknown']) ||
    durableLookup.signed_response_required !== true || durableLookup.linearizable_read_required !== true ||
    durableLookup.max_currentness_age_seconds !== 30 || durableLookup.lookup_by_attempt_required !== true ||
    durableLookup.exact_request_digest_required !== true || durableLookup.not_found_proves_no_durable_fence_or_api_call !== true ||
    durableLookup.outcome_unknown_is_reconcile_only !== true || durableLookup.malformed_or_unavailable_never_downgrades_to_not_found !== true
  ) errors.push('release broker durable lookup policy is malformed');
  const lifetime = candidate.receipt_lifetime;
  if (
    !lifetime || typeof lifetime !== 'object' || lifetime.admission_ttl_seconds !== 900 ||
    lifetime.historical_signature_validation_expires !== false || lifetime.expired_lease_cannot_authorize_new_api_call !== true ||
    lifetime.expired_lease_does_not_invalidate_historical_acceptance !== true
  ) errors.push('release broker receipt lifetime policy is malformed');
  const fullAddonClock = candidate.full_addon_admission_clock;
  if (
    !fullAddonClock || typeof fullAddonClock !== 'object' || fullAddonClock.duration_seconds !== 3000 ||
    fullAddonClock.standard_admission_deadline_role !== 'immutable_standard_identity_only' ||
    fullAddonClock.deadline_field !== 'full_addon_deadline_at' || fullAddonClock.pre_api_fence_source !== 'persisted_at' ||
    fullAddonClock.acceptance_source !== 'accepted_at' || fullAddonClock.workflow_validation_source !== 'signed_acceptance' ||
    fullAddonClock.signed_in_pre_api_fence !== true || fullAddonClock.signed_in_acceptance !== true ||
    fullAddonClock.expired_workflow_admission_fails_closed !== true || fullAddonClock.reopens_standard_terminal !== false
  ) errors.push('release broker Full add-on admission clock policy is malformed');
  const fence = candidate.pre_api_fence;
  if (
    !fence || typeof fence !== 'object' || fence.schema !== 'opl_app_release_mutation_pre_api_fence.v1' ||
    fence.signed !== true || fence.durable_before_api_call !== true || fence.contains_exact_request_and_lease !== true ||
    fence.nonce_consumption_atomic_with_fence !== true || fence.api_outcome_unknown_until_signed_acceptance !== true
  ) errors.push('release broker pre-API fence policy is malformed');
  if (options.currentWorkflowRef && options.currentWorkflowRef !== candidate.canonical_workflow_ref) {
    errors.push(`release verifier must run from ${String(candidate.canonical_workflow_ref)}, got ${options.currentWorkflowRef}`);
  }
  if (capability !== 'contract_read') {
    if (candidate.status !== 'provisioned') errors.push('release broker authority is not provisioned; successor release mutation remains blocked');
    if (Number(candidate.authority_epoch) < 1) errors.push('release broker authority epoch is not provisioned');
    if (!keys || typeof keys !== 'object' || Object.keys(keys).length === 0) {
      errors.push('release broker has no trusted Ed25519 public key');
    }
    if (capability === 'ledger_lookup') {
      if (
        !workflowLookup || typeof workflowLookup.endpoint_url !== 'string' || !workflowLookup.endpoint_url ||
        typeof workflowLookup.oidc_audience !== 'string' || !workflowLookup.oidc_audience
      ) errors.push('release workflow broker lookup HTTPS endpoint/OIDC audience is not provisioned');
    }
    if (capability === 'mutation_submit') {
      if (
        !mutationBroker || !/^sha256:[0-9a-f]{64}$/.test(String(mutationBroker.executable_sha256)) ||
        typeof mutationBroker.executable_codesign_identity !== 'string' || !mutationBroker.executable_codesign_identity
      ) errors.push('release mutation broker executable digest/code-sign identity is not provisioned');
      if (
        !mutationBroker || !Array.isArray(mutationBroker.approved_controller_workflow_shas) ||
        mutationBroker.approved_controller_workflow_shas.length === 0
      ) errors.push('release broker has no approved controller workflow SHA');
      if (isolation?.observed?.normal_codex_actions_write_allowed !== false) {
        errors.push('normal Codex credential still has Actions write authority');
      }
      if (isolation?.observed?.release_broker_actions_write_token_isolated !== true) {
        errors.push('release broker Actions write token is not isolated');
      }
      if (
        isolation?.observed?.normal_codex_protected_main_push_allowed !== false ||
        isolation?.observed?.normal_codex_release_control_plane_write_allowed !== false ||
        isolation?.observed?.normal_codex_ruleset_bypass_allowed !== false ||
        isolation?.observed?.normal_codex_required_review_bypass_allowed !== false
      ) errors.push('normal Codex repository-policy bypass remains possible');
      const receiptConfig = candidate.credential_isolation_receipt;
      if (!receiptConfig || receiptConfig.required !== true || receiptConfig.max_age_seconds !== 900 || receiptConfig.environment_path_variable !== 'OPL_RELEASE_BROKER_CREDENTIAL_ISOLATION_RECEIPT_PATH') {
        errors.push('credential isolation receipt policy is malformed');
      } else if (options.requireCredentialReceipt !== false) {
      const receiptPath = process.env[receiptConfig.environment_path_variable];
      if (!receiptPath) {
        errors.push('fresh external credential isolation receipt path is not configured');
      } else {
        try {
          readValidatedCredentialIsolationReceipt(candidate as ReleaseBrokerAuthorityV1);
        } catch (error) {
          errors.push(`fresh credential isolation receipt is unreadable: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      }
    }
  }
  return errors;
}

export function validateReleaseBrokerLookupAuthority(
  authority: unknown,
  currentWorkflowRef?: string,
): string[] {
  return validateReleaseBrokerAuthority(authority, {
    capability: 'ledger_lookup', requireCredentialReceipt: false, currentWorkflowRef,
  });
}
