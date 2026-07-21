import crypto from 'node:crypto';
import {
  validateReleaseSessionLease,
  type ReleaseMutation,
  type ReleaseSessionLeaseV2,
} from './release-session-lease.ts';
import { releaseMutationPayloadSha256, type ReleaseMutationPayload } from './release-mutation-payload.ts';
import type { CredentialIsolationReceiptV1, ReleaseBrokerAuthorityV1 } from './release-broker-authority.ts';

type BrokerSignature = { algorithm: 'Ed25519'; key_id: string; value_base64: string };

export type ReleaseMutationBrokerRequestV1 = {
  schema: 'opl_app_release_mutation_broker_request.v1';
  stable_session_id: string;
  release_cohort_ref: string;
  operator_actor: string;
  attempt_id: string;
  planned_session_revision: number;
  mutation: ReleaseMutation;
  workflow: ReleaseSessionLeaseV2['workflow'];
  artifact_kind: ReleaseSessionLeaseV2['artifact_kind'];
  controller_workflow_sha: string;
  artifact_app_sha: string;
  mutation_payload: ReleaseMutationPayload;
  mutation_payload_sha256: string;
  idempotency: {
    key: string;
    channel: 'stable';
    version: string;
    same_attempt_returns_same_receipt: true;
    conflicting_session_or_cohort_rejected: true;
    concurrent_different_attempt_rejected: true;
  };
  credential_isolation_receipt: CredentialIsolationReceiptV1;
  github: {
    repository: string;
    operation: 'workflow_dispatch' | 'workflow_cancel' | 'release_delete';
    workflow_ref: 'refs/heads/main' | null;
    target_run_id: string | null;
  };
};

export type PromotionCheckpointAuthorization = {
  bundle_schema: 'opl_app_release_promotion_checkpoint_authorization.v1';
  bundle_sha256: string;
  source_promotion_attempt_id: string;
  last_verified_checkpoint: 'release_public_nonlatest' | 'distribution_synced' | 'homebrew_verified' | null;
  first_unverified_checkpoint: 'release_public_nonlatest' | 'distribution_synced' | 'homebrew_verified' | 'latest_activated';
  receipt_digests: Array<{
    checkpoint: 'release_public_nonlatest' | 'distribution_synced' | 'homebrew_verified';
    receipt_sha256: string;
  }>;
};

export type ReleaseMutationPreApiFenceV1 = {
  schema: 'opl_app_release_mutation_pre_api_fence.v1';
  status: 'durable_pre_api_fence';
  authority_epoch: number;
  request: ReleaseMutationBrokerRequestV1;
  request_sha256: string;
  lease: ReleaseSessionLeaseV2;
  lease_payload_digest: string;
  persisted_at: string;
  full_addon_deadline_at: string | null;
  version_aggregate: Record<string, unknown>;
  nonce_consumption: Record<string, unknown>;
  coordination: Record<string, unknown>;
  outbound_api: { state: 'not_started'; call_allowed_only_after_durable_commit: true };
  promotion_checkpoint_authorization: PromotionCheckpointAuthorization | null;
  signature: BrokerSignature;
};

export type ReleaseMutationAcceptanceReceiptV1 = {
  schema: 'opl_app_release_mutation_acceptance_receipt.v1';
  status: 'accepted';
  request_sha256: string;
  lease: ReleaseSessionLeaseV2;
  pre_api_fence: ReleaseMutationPreApiFenceV1;
  pre_api_fence_sha256: string;
  accepted_at: string;
  full_addon_deadline_at: string | null;
  broker_actor: string;
  broker_token_fingerprint: string;
  github: {
    operation: ReleaseMutationBrokerRequestV1['github']['operation'];
    request_id: string;
    run_id: string;
    run_attempt: number;
    workflow_sha: string;
    deleted_release_id: string | null;
    deleted_release_tag: string | null;
    tag_deleted: boolean | null;
  };
  idempotency: Record<string, unknown>;
  ledger_admission: Record<string, unknown>;
  credential_isolation_receipt: CredentialIsolationReceiptV1;
  signature: BrokerSignature;
};

export type ReleaseMutationBrokerLedgerLookupV1 = {
  schema: 'opl_app_release_mutation_broker_ledger_lookup.v1';
  repository: string;
  channel: 'stable';
  version: string;
  stable_session_id: string;
  release_cohort_ref: string;
  attempt_id: string;
  mutation_payload_sha256: string;
  request_sha256: string;
  challenge: string;
};

export type ReleaseMutationBrokerLedgerRecordV1 = {
  schema: 'opl_app_release_mutation_broker_ledger_record.v1';
  lookup: ReleaseMutationBrokerLedgerLookupV1;
  request: ReleaseMutationBrokerRequestV1;
  pre_api_fence: ReleaseMutationPreApiFenceV1;
  recorded_at: string;
  mutation_state: 'run_bound' | 'terminal_succeeded' | 'terminal_failed' | 'terminal_cancelled' | 'outcome_unknown';
  acceptance: ReleaseMutationAcceptanceReceiptV1 | null;
  exact_run_id: string | null;
  reconcile_disposition: 'readback_exact_run' | 'reconcile_only';
  cancel_transition: Record<string, unknown> | null;
  signature: BrokerSignature;
};

export type ReleaseMutationVersionAggregateV1 = Record<string, unknown> & { records: ReleaseMutationBrokerLedgerRecordV1[] };
export type ReleaseLatestMutationHeadV1 = Record<string, unknown> & { signature: BrokerSignature };
export type ReleaseMutationBrokerLedgerSnapshotV1 = Record<string, unknown>;

type LookupReadProof = {
  ledger_generation: number;
  version_aggregate_revision: number;
  latest_mutation_head_revision: number;
  complete_through_sequence: number;
  authority_epoch: number;
  linearized_at: string;
  expires_at: string;
};

type LookupEnvelopeBase = {
  schema: 'opl_app_release_mutation_broker_ledger_lookup_result.v2';
  lookup: ReleaseMutationBrokerLedgerLookupV1;
  read_proof: LookupReadProof;
  signature: BrokerSignature;
};

export type ReleaseMutationBrokerLedgerLookupResultV1 =
  | (LookupEnvelopeBase & { status: 'found'; record: ReleaseMutationBrokerLedgerRecordV1 })
  | (LookupEnvelopeBase & { status: 'not_found'; record: null })
  | (LookupEnvelopeBase & { status: 'outcome_unknown'; record: ReleaseMutationBrokerLedgerRecordV1 | null });

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

function verifySignedPayload(
  candidate: Record<string, unknown>,
  authority: ReleaseBrokerAuthorityV1,
  label: string,
): string[] {
  const { signature, ...payload } = candidate;
  if (!signature || typeof signature !== 'object' || Array.isArray(signature)) return [`${label} signature is missing`];
  const typed = signature as Partial<BrokerSignature>;
  const publicKey = typeof typed.key_id === 'string' ? authority.trusted_ed25519_public_keys[typed.key_id] : undefined;
  if (typed.algorithm !== 'Ed25519' || !publicKey || typeof typed.value_base64 !== 'string') {
    return [`${label} signature is untrusted or malformed`];
  }
  try {
    return crypto.verify(null, Buffer.from(canonicalJson(payload)), publicKey, Buffer.from(typed.value_base64, 'base64'))
      ? []
      : [`${label} signature is invalid`];
  } catch (error) {
    return [`${label} signature validation failed safely: ${error instanceof Error ? error.message : String(error)}`];
  }
}

function retiredMutationApi(requestedCommand: string): never {
  throw new Error(JSON.stringify({
    schema: 'opl_app_legacy_release_entry_retired.v1',
    status: 'retired_fail_closed',
    requested_command: requestedCommand,
    framework_authority: 'opl_release_portable_checkpoint_and_receipt',
    mutation_authorized: false,
    external_lookup_authorized: false,
  }));
}

export function buildPromotionCheckpointAuthorization(
  request: Pick<ReleaseMutationBrokerRequestV1, 'mutation' | 'attempt_id' | 'mutation_payload'>,
): PromotionCheckpointAuthorization | null {
  if (request.mutation !== 'promotion_dispatch') return null;
  const checkpoints = [
    'release_public_nonlatest', 'distribution_synced', 'homebrew_verified', 'latest_activated',
  ] as const;
  const firstUnverified = request.mutation_payload.resume_from_checkpoint as PromotionCheckpointAuthorization['first_unverified_checkpoint'];
  const firstUnverifiedIndex = checkpoints.indexOf(firstUnverified);
  let receipts: PromotionCheckpointAuthorization['receipt_digests'];
  try {
    const parsed = JSON.parse(request.mutation_payload.promotion_checkpoint_receipts_json ?? '[]') as unknown;
    if (!Array.isArray(parsed)) throw new Error('receipt digests are not an array');
    receipts = parsed.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('receipt digest entry is malformed');
      const candidate = entry as Record<string, unknown>;
      if (!checkpoints.slice(0, -1).includes(candidate.checkpoint as never) || !digestRefPattern.test(String(candidate.receipt_sha256))) {
        throw new Error('receipt digest entry checkpoint/digest is invalid');
      }
      return {
        checkpoint: candidate.checkpoint as PromotionCheckpointAuthorization['receipt_digests'][number]['checkpoint'],
        receipt_sha256: String(candidate.receipt_sha256),
      };
    });
  } catch (error) {
    throw new Error(`Promotion checkpoint receipt bundle is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
  const expectedVerified = checkpoints.slice(0, firstUnverifiedIndex);
  if (
    firstUnverifiedIndex < 0 || receipts.length !== expectedVerified.length
    || receipts.some((entry, index) => entry.checkpoint !== expectedVerified[index])
  ) throw new Error('Promotion checkpoint receipt bundle does not cover every checkpoint before resume.');
  const unsigned = {
    bundle_schema: 'opl_app_release_promotion_checkpoint_authorization.v1' as const,
    source_promotion_attempt_id: request.attempt_id,
    last_verified_checkpoint: firstUnverifiedIndex > 0
      ? checkpoints[firstUnverifiedIndex - 1] as PromotionCheckpointAuthorization['last_verified_checkpoint']
      : null,
    first_unverified_checkpoint: firstUnverified,
    receipt_digests: receipts,
  };
  return {
    ...unsigned,
    bundle_sha256: `sha256:${crypto.createHash('sha256').update(canonicalJson(unsigned)).digest('hex')}`,
  };
}

export function releaseMutationBrokerRequestSha256(request: ReleaseMutationBrokerRequestV1): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(request)).digest('hex')}`;
}

export function releaseMutationPreApiFenceSha256(fence: ReleaseMutationPreApiFenceV1): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(fence)).digest('hex')}`;
}

export function buildReleaseMutationBrokerLedgerLookup(input: {
  repository: string;
  version: string;
  stableSessionId: string;
  releaseCohortRef: string;
  attemptId: string;
  mutationPayloadSha256: string;
  requestSha256: string;
  challenge?: string;
}): ReleaseMutationBrokerLedgerLookupV1 {
  return {
    schema: 'opl_app_release_mutation_broker_ledger_lookup.v1',
    repository: input.repository,
    channel: 'stable',
    version: input.version,
    stable_session_id: input.stableSessionId,
    release_cohort_ref: input.releaseCohortRef,
    attempt_id: input.attemptId,
    mutation_payload_sha256: input.mutationPayloadSha256,
    request_sha256: input.requestSha256,
    challenge: input.challenge ?? crypto.randomBytes(16).toString('hex'),
  };
}

export function validateReleaseMutationBrokerRequest(request: unknown): string[] {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return ['historical broker request is missing'];
  const candidate = request as Partial<ReleaseMutationBrokerRequestV1>;
  const errors = ['legacy broker cannot authorize a new mutation'];
  if (candidate.schema !== 'opl_app_release_mutation_broker_request.v1') errors.push('historical broker request schema is invalid');
  if (!digestRefPattern.test(String(candidate.stable_session_id))) errors.push('historical broker stable session id is invalid');
  if (!digestRefPattern.test(String(candidate.release_cohort_ref))) errors.push('historical broker cohort ref is invalid');
  if (!digestRefPattern.test(String(candidate.attempt_id))) errors.push('historical broker attempt id is invalid');
  if (!exactShaPattern.test(String(candidate.controller_workflow_sha))) errors.push('historical broker workflow SHA is invalid');
  if (!exactShaPattern.test(String(candidate.artifact_app_sha))) errors.push('historical broker App SHA is invalid');
  if (candidate.mutation_payload_sha256 !== releaseMutationPayloadSha256(candidate.mutation_payload ?? {})) {
    errors.push('historical broker mutation payload digest is invalid');
  }
  return errors;
}

export function validateReleaseMutationPreApiFence(
  fence: unknown,
  request: ReleaseMutationBrokerRequestV1,
  authority: ReleaseBrokerAuthorityV1,
): string[] {
  if (!fence || typeof fence !== 'object' || Array.isArray(fence)) return ['historical pre-API fence is missing'];
  const candidate = fence as Partial<ReleaseMutationPreApiFenceV1> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_mutation_pre_api_fence.v1' || candidate.status !== 'durable_pre_api_fence') {
    errors.push('historical pre-API fence schema/status is invalid');
  }
  if (candidate.request_sha256 !== releaseMutationBrokerRequestSha256(request)) errors.push('historical pre-API fence request digest is invalid');
  if (candidate.lease_payload_digest !== candidate.lease?.payload_digest) errors.push('historical pre-API fence lease digest is invalid');
  if (candidate.outbound_api?.state !== 'not_started' || candidate.outbound_api.call_allowed_only_after_durable_commit !== true) {
    errors.push('historical pre-API fence outbound state is invalid');
  }
  if (candidate.lease) {
    errors.push(...validateReleaseSessionLease(candidate.lease, {
      stableSessionId: request.stable_session_id,
      releaseCohortRef: request.release_cohort_ref,
      repository: request.github.repository,
      operatorActor: request.operator_actor,
      brokerActor: authority.broker_identity.github_actor,
      mutation: request.mutation,
      attemptId: request.attempt_id,
      workflow: request.workflow,
      artifactKind: request.artifact_kind,
      controllerWorkflowSha: request.controller_workflow_sha,
      artifactAppSha: request.artifact_app_sha,
      mutationPayloadSha256: request.mutation_payload_sha256,
      plannedSessionRevision: request.planned_session_revision,
      issuer: authority.issuer,
      publicKeys: authority.trusted_ed25519_public_keys,
      now: candidate.persisted_at,
      targetAttemptId: candidate.lease.target_attempt_id,
      targetRunId: candidate.lease.target_run_id,
    }).map((error) => `historical fence lease: ${error}`));
  }
  errors.push(...verifySignedPayload(candidate, authority, 'historical pre-API fence'));
  return errors;
}

export function validateReleaseMutationAcceptanceReceipt(): string[] {
  return ['legacy broker acceptance cannot authorize a new mutation'];
}

export function validateHistoricalReleaseMutationAcceptanceReceipt(
  receipt: unknown,
  request: ReleaseMutationBrokerRequestV1,
  authority: ReleaseBrokerAuthorityV1,
): string[] {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return ['historical broker acceptance is missing'];
  const candidate = receipt as Partial<ReleaseMutationAcceptanceReceiptV1> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_mutation_acceptance_receipt.v1' || candidate.status !== 'accepted') {
    errors.push('historical broker acceptance schema/status is invalid');
  }
  if (candidate.request_sha256 !== releaseMutationBrokerRequestSha256(request)) errors.push('historical broker acceptance request digest is invalid');
  if (candidate.pre_api_fence_sha256 !== (candidate.pre_api_fence ? releaseMutationPreApiFenceSha256(candidate.pre_api_fence) : '')) {
    errors.push('historical broker acceptance fence digest is invalid');
  }
  if (candidate.pre_api_fence) errors.push(...validateReleaseMutationPreApiFence(candidate.pre_api_fence, request, authority));
  if (!/^[1-9][0-9]*$/.test(String(candidate.github?.run_id)) || candidate.github?.run_attempt !== 1) {
    errors.push('historical broker acceptance run identity is invalid');
  }
  if (candidate.github?.workflow_sha !== request.controller_workflow_sha || candidate.github?.operation !== request.github?.operation) {
    errors.push('historical broker acceptance workflow identity is invalid');
  }
  errors.push(...verifySignedPayload(candidate, authority, 'historical broker acceptance'));
  return errors;
}

export function validateReleaseMutationBrokerLedgerLookupResult(
  result: unknown,
  lookup: ReleaseMutationBrokerLedgerLookupV1,
  authority: ReleaseBrokerAuthorityV1,
  options: { now?: string; minimumLedgerGeneration?: number; minimumVersionAggregateRevision?: number; minimumLatestHeadRevision?: number; priorAuthoritativeStatus?: string } = {},
): string[] {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return ['historical broker lookup result is missing'];
  const candidate = result as Partial<ReleaseMutationBrokerLedgerLookupResultV1> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_mutation_broker_ledger_lookup_result.v2') errors.push('historical broker lookup schema is invalid');
  if (!['found', 'not_found', 'outcome_unknown'].includes(String(candidate.status))) errors.push('historical broker lookup status is invalid');
  if (canonicalJson(candidate.lookup) !== canonicalJson(lookup)) errors.push('historical broker lookup identity is mismatched');
  const proof = candidate.read_proof as LookupReadProof | undefined;
  if (!proof || proof.authority_epoch !== authority.authority_epoch) errors.push('historical broker lookup authority epoch is invalid');
  if (proof && proof.ledger_generation < (options.minimumLedgerGeneration ?? 0)) errors.push('historical broker lookup generation regressed');
  if (proof && proof.version_aggregate_revision < (options.minimumVersionAggregateRevision ?? 0)) errors.push('historical broker version revision regressed');
  if (proof && proof.latest_mutation_head_revision < (options.minimumLatestHeadRevision ?? 0)) errors.push('historical broker Latest revision regressed');
  if (options.now && proof && Date.parse(options.now) >= Date.parse(proof.expires_at)) errors.push('historical broker lookup currentness expired');
  if (candidate.status === 'found') {
    const record = candidate.record as ReleaseMutationBrokerLedgerRecordV1 | undefined;
    if (!record?.acceptance) errors.push('historical found lookup lacks acceptance');
    else errors.push(...validateHistoricalReleaseMutationAcceptanceReceipt(record.acceptance, record.request, authority));
  }
  errors.push(...verifySignedPayload(candidate, authority, 'historical broker lookup'));
  return errors;
}

export function validateReleaseMutationBrokerLedgerRecord(record: unknown): string[] {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['historical broker ledger record is missing'];
  return (record as { schema?: unknown }).schema === 'opl_app_release_mutation_broker_ledger_record.v1'
    ? []
    : ['historical broker ledger record schema is invalid'];
}

export function validateReleaseMutationBrokerLedgerSnapshot(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return ['historical broker ledger snapshot is missing'];
  return (snapshot as { schema?: unknown }).schema === 'opl_app_release_mutation_broker_ledger_snapshot.v1'
    ? []
    : ['historical broker ledger snapshot schema is invalid'];
}

export function buildReleaseMutationPreApiFence(..._args: unknown[]): never { return retiredMutationApi('buildReleaseMutationPreApiFence'); }
export function buildReleaseMutationAcceptanceReceipt(..._args: unknown[]): never { return retiredMutationApi('buildReleaseMutationAcceptanceReceipt'); }
export function buildReleaseMutationBrokerLedgerRecord(..._args: unknown[]): never { return retiredMutationApi('buildReleaseMutationBrokerLedgerRecord'); }
export function buildReleaseMutationVersionAggregate(..._args: unknown[]): never { return retiredMutationApi('buildReleaseMutationVersionAggregate'); }
export function buildReleaseLatestMutationHead(..._args: unknown[]): never { return retiredMutationApi('buildReleaseLatestMutationHead'); }
export function buildReleaseMutationBrokerLedgerNotFound(..._args: unknown[]): never { return retiredMutationApi('buildReleaseMutationBrokerLedgerNotFound'); }
export function buildReleaseMutationBrokerLedgerFound(..._args: unknown[]): never { return retiredMutationApi('buildReleaseMutationBrokerLedgerFound'); }
export function buildReleaseMutationBrokerLedgerOutcomeUnknown(..._args: unknown[]): never { return retiredMutationApi('buildReleaseMutationBrokerLedgerOutcomeUnknown'); }
export function decideReleaseMutationBrokerAdmission(..._args: unknown[]): never { return retiredMutationApi('decideReleaseMutationBrokerAdmission'); }
export function buildReleaseMutationBrokerLedgerSnapshot(..._args: unknown[]): never { return retiredMutationApi('buildReleaseMutationBrokerLedgerSnapshot'); }
export function externalReleaseMutationBroker(..._args: unknown[]): never { return retiredMutationApi('externalReleaseMutationBroker.submit'); }
export function externalReleaseMutationBrokerLedgerLookup(..._args: unknown[]): never { return retiredMutationApi('externalReleaseMutationBroker.lookup'); }
