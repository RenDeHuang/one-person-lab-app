import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  validateReleaseSessionLease,
  type ReleaseMutation,
  type ReleaseSessionLeaseV2,
} from './release-session-lease.ts';
import type { ReleaseMutationPayload } from './release-mutation-payload.ts';
import { releaseMutationPayloadSha256 } from './release-mutation-payload.ts';
import {
  validateCredentialIsolationReceipt,
  validateReleaseBrokerAuthority,
  validateReleaseBrokerLookupAuthority,
  type CredentialIsolationReceiptV1,
  readReleaseBrokerAuthority,
  type ReleaseBrokerAuthorityV1,
} from './release-broker-authority.ts';

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

type BrokerSignature = { algorithm: 'Ed25519'; key_id: string; value_base64: string };

type PreApiFencePayload = {
  schema: 'opl_app_release_mutation_pre_api_fence.v1';
  status: 'durable_pre_api_fence';
  authority_epoch: number;
  request: ReleaseMutationBrokerRequestV1;
  request_sha256: string;
  lease: ReleaseSessionLeaseV2;
  lease_payload_digest: string;
  persisted_at: string;
  full_addon_deadline_at: string | null;
  version_aggregate: {
    key: string;
    revision: number;
    sequence: number;
    predecessor_attempt_id: string | null;
  };
  nonce_consumption: {
    nonce: string;
    owner_attempt_id: string;
    state: 'consumed';
    consumed_at: string;
    atomic_with_fence: true;
    survives_lease_expiry: true;
  };
  coordination: {
    scope: 'version' | 'latest_promotion' | 'version_cancel' | 'emergency_cancel';
    global_latest_key: string | null;
    global_latest_revision: number | null;
    owner_attempt_id: string | null;
    owner_version: string | null;
    owner_fence_token: string | null;
    fence_token: string | null;
    target_attempt_id: string | null;
    target_run_id: string | null;
    state: 'version_scoped' | 'held' | 'version_cancel_requested' | 'cancel_requested';
    cancel_does_not_advance_head: boolean;
  };
  outbound_api: {
    state: 'not_started';
    call_allowed_only_after_durable_commit: true;
  };
  promotion_checkpoint_authorization: null | {
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
};

export type ReleaseMutationPreApiFenceV1 = PreApiFencePayload & { signature: BrokerSignature };

type AcceptancePayload = {
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
  idempotency: {
    key: string;
    outcome: 'executed';
  };
  ledger_admission: {
    coordination_scope: PreApiFencePayload['coordination']['scope'];
    global_mutation_key: string | null;
    version_aggregate_key: string;
    global_sequence: number | null;
    version_attempt_sequence: number;
    global_predecessor_attempt_id: string | null;
    version_predecessor_attempt_id: string | null;
    admission_class: 'version_scoped' | 'latest_promotion_owner' | 'version_cancel_of_active' | 'emergency_cancel_of_active';
    attempt_state: 'attempt_accepted' | 'emergency_cancel_accepted' | 'destructive_cleanup_accepted';
    lease_nonce: string;
    nonce_state: 'consumed';
  };
  credential_isolation_receipt: CredentialIsolationReceiptV1;
};

export type ReleaseMutationAcceptanceReceiptV1 = AcceptancePayload & {
  signature: BrokerSignature;
};

export type ReleaseMutationBroker = (
  request: ReleaseMutationBrokerRequestV1,
) => ReleaseMutationAcceptanceReceiptV1;

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

type LedgerRecordBase = {
  schema: 'opl_app_release_mutation_broker_ledger_record.v1';
  lookup: ReleaseMutationBrokerLedgerLookupV1;
  request: ReleaseMutationBrokerRequestV1;
  pre_api_fence: ReleaseMutationPreApiFenceV1;
  recorded_at: string;
  reconcile_disposition: 'readback_exact_run' | 'reconcile_only';
  cancel_transition: null | {
    target_attempt_id: string;
    target_run_id: string;
    target_terminal_state: 'terminal_cancelled';
    atomic_with_owner_state_update: true;
    latest_readback_completed: boolean;
  };
};

type BoundLedgerRecordPayload = LedgerRecordBase & {
  mutation_state: 'run_bound' | 'terminal_succeeded' | 'terminal_failed' | 'terminal_cancelled';
  acceptance: ReleaseMutationAcceptanceReceiptV1;
  exact_run_id: string;
  reconcile_disposition: 'readback_exact_run';
};

type UnknownLedgerRecordPayload = LedgerRecordBase & {
  mutation_state: 'outcome_unknown';
  acceptance: null;
  exact_run_id: null;
  reconcile_disposition: 'reconcile_only';
  cancel_transition: null;
};

export type BoundReleaseMutationBrokerLedgerRecordV1 = BoundLedgerRecordPayload & { signature: BrokerSignature };
export type UnknownReleaseMutationBrokerLedgerRecordV1 = UnknownLedgerRecordPayload & { signature: BrokerSignature };
export type ReleaseMutationBrokerLedgerRecordV1 =
  | BoundReleaseMutationBrokerLedgerRecordV1
  | UnknownReleaseMutationBrokerLedgerRecordV1;

type VersionAggregatePayload = {
  schema: 'opl_app_release_mutation_version_aggregate.v1';
  repository: string;
  channel: 'stable';
  version: string;
  stable_session_id: string;
  release_cohort_ref: string;
  challenge: string;
  authority_epoch: number;
  revision: number;
  ledger_generation: number;
  head_attempt_id: string | null;
  record_count: number;
  first_sequence: 1 | null;
  complete_through_sequence: number;
  partition_complete_from_sequence_one: true;
  linearized_at: string;
  expires_at: string;
  records: ReleaseMutationBrokerLedgerRecordV1[];
};

export type ReleaseMutationVersionAggregateV1 = VersionAggregatePayload & { signature: BrokerSignature };

type LatestMutationOwner = {
  attempt_id: string;
  version: string;
  stable_session_id: string;
  release_cohort_ref: string;
  exact_run_id: string | null;
  fence_token: string;
};

type LatestMutationHeadPayload = {
  schema: 'opl_app_release_latest_mutation_head.v1';
  repository: string;
  channel: 'stable';
  challenge: string;
  authority_epoch: number;
  revision: number;
  ledger_generation: number;
  state: 'free' | 'held' | 'outcome_unknown' | 'cancel_requested';
  owner: LatestMutationOwner | null;
  terminal_release: null | {
    owner_attempt_id: string;
    owner_terminal_state: 'terminal_succeeded' | 'terminal_failed' | 'terminal_cancelled';
    exact_run_id: string;
    latest_readback_completed: true;
    cas_from_revision: number;
    released_at: string;
  };
  linearized_at: string;
  expires_at: string;
};

export type ReleaseLatestMutationHeadV1 = LatestMutationHeadPayload & { signature: BrokerSignature };

export type ReleaseMutationBrokerLedgerSnapshotV1 = {
  schema: 'opl_app_release_mutation_broker_ledger_snapshot.v1';
  challenge: string;
  version_aggregates: ReleaseMutationVersionAggregateV1[];
  latest_mutation_head: ReleaseLatestMutationHeadV1;
};

type LinearizableLookupProof = {
  consistency: 'linearizable';
  observed_at: string;
  linearized_at: string;
  expires_at: string;
  ledger_generation: number;
  version_aggregate_revision: number;
  version_head_attempt_id: string | null;
  complete_through_sequence: number;
  authority_epoch: number;
};

type LedgerLookupResultBase = {
  schema: 'opl_app_release_mutation_broker_ledger_lookup_result.v2';
  lookup: ReleaseMutationBrokerLedgerLookupV1;
  read_proof: LinearizableLookupProof;
  version_aggregate: ReleaseMutationVersionAggregateV1;
  latest_mutation_head: ReleaseLatestMutationHeadV1;
};

export type ReleaseMutationBrokerLedgerLookupResultV1 =
  | (LedgerLookupResultBase & {
      status: 'found';
      record: BoundReleaseMutationBrokerLedgerRecordV1;
      signature: BrokerSignature;
    })
  | (LedgerLookupResultBase & { status: 'not_found'; record: null; signature: BrokerSignature })
  | (LedgerLookupResultBase & {
      status: 'outcome_unknown';
      record: UnknownReleaseMutationBrokerLedgerRecordV1;
      signature: BrokerSignature;
    });

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

const digestRefPattern = /^sha256:[0-9a-f]{64}$/;
const exactShaPattern = /^[0-9a-f]{40}$/;
const numericRunIdPattern = /^[1-9]\d*$/;
const canonicalTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const fullAddonAdmissionWindowMs = 50 * 60 * 1_000;

function deriveFullAddonDeadlineAt(
  request: Pick<ReleaseMutationBrokerRequestV1, 'mutation'>,
  sourceAt: string,
): string | null {
  if (request.mutation !== 'full_addon_dispatch') return null;
  const sourceMs = Date.parse(sourceAt);
  if (
    !canonicalTimestampPattern.test(sourceAt) || !Number.isFinite(sourceMs) ||
    new Date(sourceMs).toISOString() !== sourceAt
  ) throw new Error('Full add-on admission deadline source is not canonical UTC ISO-8601');
  return new Date(sourceMs + fullAddonAdmissionWindowMs).toISOString();
}

function requiredPayloadFields(mutation: ReleaseMutation): { required: string[]; optional?: string[] } {
  switch (mutation) {
    case 'desktop_release_dispatch':
      return {
        required: [
          'opl_version', 'release_mode', 'release_intent', 'release_operator_plan_ref', 'stable_session_id',
          'standard_admission_deadline_at',
          'include_full_package', 'run_vm_smoke', 'publish_docker_webui', 'defer_addons', 'shell_ref',
          'framework_ref', 'artifact_app_sha', 'operator_actor',
        ],
        optional: ['full_omission_reason', 'gate_reuse_plan_ref'],
      };
    case 'qualification_dispatch':
      return { required: [
        'release_tag', 'package_profile', 'diagnostic_scope', 'release_artifact_name',
        'release_artifact_run_id', 'stable_session_id', 'release_cohort_ref', 'artifact_app_ref',
        'shell_ref', 'smoke_harness_ref', 'framework_ref', 'operator_actor', 'standard_admission_deadline_at',
      ] };
    case 'promotion_dispatch':
      return { required: [
        'opl_version', 'release_set_generation', 'release_run_id', 'stable_session_id', 'release_cohort_ref',
        'standard_admission_deadline_at',
        'artifact_app_sha', 'standard_vm_run_id', 'release_owner_receipt_ref', 'shell_ref', 'operator_actor',
        'framework_ref', 'resume_from_checkpoint',
      ], optional: ['promotion_checkpoint_receipts_json'] };
    case 'full_addon_dispatch':
      return { required: [
        'opl_version', 'stable_session_id', 'release_cohort_ref', 'app_sha', 'shell_sha', 'framework_sha',
        'release_set_generation', 'release_set_manifest_digest', 'force_rebuild_runtime_cache', 'operator_actor',
        'standard_admission_deadline_at',
      ] };
    case 'workflow_cancel':
      return { required: [
        'opl_version', 'stable_session_id', 'release_cohort_ref', 'target_attempt_id', 'target_run_id', 'reason', 'operator_actor',
      ] };
    case 'release_draft_cleanup':
      return { required: [
        'opl_version', 'stable_session_id', 'release_cohort_ref', 'stable_release_tag', 'candidate_release_id',
        'candidate_tag', 'candidate_discovery_sha256', 'requesting_run_id', 'requesting_run_attempt',
        'delete_tag', 'operator_actor',
      ] };
  }
}

function payloadVersion(request: Partial<ReleaseMutationBrokerRequestV1>): string {
  const payload = request.mutation_payload;
  return request.mutation === 'qualification_dispatch'
    ? String(payload?.release_tag ?? '').replace(/^v/, '')
    : String(payload?.opl_version ?? '');
}

const promotionCheckpoints = [
  'release_public_nonlatest', 'distribution_synced', 'homebrew_verified', 'latest_activated',
] as const;

type PromotionCheckpointAuthorization = NonNullable<PreApiFencePayload['promotion_checkpoint_authorization']>;

function buildPromotionCheckpointAuthorization(
  request: ReleaseMutationBrokerRequestV1,
): PromotionCheckpointAuthorization | null {
  if (request.mutation !== 'promotion_dispatch') return null;
  const firstUnverified = request.mutation_payload.resume_from_checkpoint as PromotionCheckpointAuthorization['first_unverified_checkpoint'];
  const firstUnverifiedIndex = promotionCheckpoints.indexOf(firstUnverified);
  const rawReceipts = request.mutation_payload.promotion_checkpoint_receipts_json ?? '[]';
  let receipts: PromotionCheckpointAuthorization['receipt_digests'];
  try {
    const parsed = JSON.parse(rawReceipts) as unknown;
    if (!Array.isArray(parsed)) throw new Error('receipt digests are not an array');
    receipts = parsed.map((entry) => {
      if (!entry || typeof entry !== 'object') throw new Error('receipt digest entry is malformed');
      const candidate = entry as Record<string, unknown>;
      if (!promotionCheckpoints.slice(0, -1).includes(candidate.checkpoint as never) ||
          !digestRefPattern.test(String(candidate.receipt_sha256))) {
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
  const expectedVerified = promotionCheckpoints.slice(0, firstUnverifiedIndex);
  if (
    firstUnverifiedIndex < 0 || receipts.length !== expectedVerified.length ||
    receipts.some((entry, index) => entry.checkpoint !== expectedVerified[index])
  ) throw new Error('Promotion checkpoint receipt bundle does not cover every checkpoint before resume.');
  const unsigned = {
    bundle_schema: 'opl_app_release_promotion_checkpoint_authorization.v1' as const,
    source_promotion_attempt_id: request.attempt_id,
    last_verified_checkpoint: firstUnverifiedIndex > 0
      ? promotionCheckpoints[firstUnverifiedIndex - 1] as PromotionCheckpointAuthorization['last_verified_checkpoint'] : null,
    first_unverified_checkpoint: firstUnverified,
    receipt_digests: receipts,
  };
  return {
    ...unsigned,
    bundle_sha256: `sha256:${crypto.createHash('sha256').update(canonicalJson(unsigned)).digest('hex')}`,
  };
}

function validateMutationPayload(
  request: Partial<ReleaseMutationBrokerRequestV1>,
  authority: ReleaseBrokerAuthorityV1,
  now: string,
): string[] {
  if (!request.mutation || !request.mutation_payload) return [];
  const payload = request.mutation_payload;
  const errors: string[] = [];
  const shape = requiredPayloadFields(request.mutation);
  const allowed = new Set([...shape.required, ...(shape.optional ?? [])]);
  for (const field of shape.required) {
    if (typeof payload[field] !== 'string' || payload[field].trim() === '') {
      errors.push(`broker mutation payload ${field} is required for ${request.mutation}`);
    }
  }
  for (const field of Object.keys(payload)) {
    if (!allowed.has(field)) errors.push(`broker mutation payload ${field} is not allowed for ${request.mutation}`);
  }
  const canonicalOperator = authority.operator_identity.github_actor;
  if (payload.operator_actor !== canonicalOperator || request.operator_actor !== canonicalOperator) {
    errors.push('broker mutation operator actor is not bound to canonical authority');
  }
  if (payload.stable_session_id !== request.stable_session_id) errors.push('broker mutation payload stable_session_id is identity-mismatched');
  if (payloadVersion(request) !== request.idempotency?.version) errors.push('broker mutation payload version is identity-mismatched');
  const cohortRef = request.mutation === 'desktop_release_dispatch'
    ? payload.release_operator_plan_ref
    : payload.release_cohort_ref;
  if (cohortRef !== request.release_cohort_ref) errors.push('broker mutation payload release cohort is identity-mismatched');
  const artifactSha = request.mutation === 'qualification_dispatch'
    ? payload.artifact_app_ref
    : request.mutation === 'full_addon_dispatch'
      ? payload.app_sha
      : payload.artifact_app_sha;
  if (artifactSha !== undefined && artifactSha !== request.artifact_app_sha) {
    errors.push('broker mutation payload artifact App SHA is identity-mismatched');
  }
  for (const field of ['artifact_app_sha', 'artifact_app_ref', 'app_sha', 'shell_ref', 'shell_sha', 'framework_ref', 'framework_sha']) {
    if (payload[field] !== undefined && !exactShaPattern.test(payload[field])) errors.push(`broker mutation payload ${field} is not an exact SHA`);
  }
  for (const field of ['include_full_package', 'run_vm_smoke', 'publish_docker_webui', 'defer_addons', 'force_rebuild_runtime_cache']) {
    if (payload[field] !== undefined && !['true', 'false'].includes(payload[field])) errors.push(`broker mutation payload ${field} is not a canonical boolean`);
  }
  for (const field of ['release_artifact_run_id', 'release_run_id', 'standard_vm_run_id', 'target_run_id']) {
    if (payload[field] !== undefined && !numericRunIdPattern.test(payload[field])) errors.push(`broker mutation payload ${field} is not a numeric run id`);
  }
  if (request.mutation === 'qualification_dispatch') {
    if (payload.package_profile !== request.artifact_kind) errors.push('qualification package profile does not match broker artifact kind');
    if (payload.diagnostic_scope !== 'release_gate') errors.push('qualification diagnostic scope is not release_gate');
  }
  if (request.mutation === 'desktop_release_dispatch' && payload.defer_addons !== 'true') {
    errors.push('desktop release mutation must keep add-ons outside the Standard terminal chain');
  }
  if (['desktop_release_dispatch', 'qualification_dispatch', 'promotion_dispatch', 'full_addon_dispatch'].includes(request.mutation)) {
    const deadline = String(payload.standard_admission_deadline_at ?? '');
    const deadlineMs = Date.parse(deadline);
    if (!canonicalTimestampPattern.test(deadline) ||
        !Number.isFinite(deadlineMs) || new Date(deadlineMs).toISOString() !== deadline) {
      errors.push('broker mutation payload Standard admission deadline is not canonical UTC ISO-8601');
    } else if (
      request.mutation !== 'full_addon_dispatch' &&
      (!Number.isFinite(Date.parse(now)) || Date.parse(now) >= deadlineMs)
    ) {
      errors.push('broker mutation request reached the Standard admission deadline');
    }
  }
  if (request.mutation === 'promotion_dispatch' && ![
    'release_public_nonlatest', 'distribution_synced', 'homebrew_verified', 'latest_activated',
  ].includes(payload.resume_from_checkpoint)) {
    errors.push('promotion resume_from_checkpoint is invalid');
  }
  if (request.mutation === 'promotion_dispatch') {
    try {
      buildPromotionCheckpointAuthorization(request as ReleaseMutationBrokerRequestV1);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (request.mutation === 'workflow_cancel' && !digestRefPattern.test(String(payload.target_attempt_id))) {
    errors.push('broker cancel target attempt id is invalid');
  }
  if (request.mutation === 'release_draft_cleanup') {
    if (!numericRunIdPattern.test(String(payload.candidate_release_id))) errors.push('draft cleanup candidate release id is invalid');
    if (!numericRunIdPattern.test(String(payload.requesting_run_id))) errors.push('draft cleanup requesting run id is invalid');
    if (!numericRunIdPattern.test(String(payload.requesting_run_attempt))) errors.push('draft cleanup requesting run attempt is invalid');
    if (!digestRefPattern.test(String(payload.candidate_discovery_sha256))) errors.push('draft cleanup discovery digest is invalid');
    if (payload.delete_tag !== 'true') errors.push('draft cleanup must explicitly authorize tag deletion');
    if (!String(payload.candidate_tag).startsWith(`v${request.idempotency?.version}-`)) {
      errors.push('draft cleanup candidate tag is outside the exact version namespace');
    }
  }
  return errors;
}

export function releaseMutationBrokerRequestSha256(request: ReleaseMutationBrokerRequestV1): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(request)).digest('hex')}`;
}

export function validateReleaseMutationBrokerRequest(
  request: unknown,
  authority: ReleaseBrokerAuthorityV1,
  now = new Date().toISOString(),
): string[] {
  if (!request || typeof request !== 'object') return ['release mutation broker request is missing'];
  const candidate = request as Partial<ReleaseMutationBrokerRequestV1> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_mutation_broker_request.v1') errors.push('broker request schema is invalid');
  if (!digestRefPattern.test(String(candidate.stable_session_id))) errors.push('broker request stable session id is invalid');
  if (!digestRefPattern.test(String(candidate.release_cohort_ref))) errors.push('broker request release cohort ref is invalid');
  if (!digestRefPattern.test(String(candidate.attempt_id))) errors.push('broker request attempt id is invalid');
  if (!Number.isSafeInteger(candidate.planned_session_revision) || Number(candidate.planned_session_revision) < 1) {
    errors.push('broker request planned session revision is invalid');
  }
  if (!exactShaPattern.test(String(candidate.controller_workflow_sha))) errors.push('broker request controller workflow SHA is invalid');
  if (
    !Array.isArray(authority.mutation_broker?.approved_controller_workflow_shas) ||
    !authority.mutation_broker.approved_controller_workflow_shas.includes(String(candidate.controller_workflow_sha))
  ) {
    errors.push('broker request controller workflow SHA is not approved by canonical authority');
  }
  if (!exactShaPattern.test(String(candidate.artifact_app_sha))) errors.push('broker request artifact App SHA is invalid');
  if (candidate.operator_actor !== authority.operator_identity.github_actor) {
    errors.push('broker request operator actor is not the broker-authenticated canonical operator');
  }
  if (!candidate.mutation_payload || typeof candidate.mutation_payload !== 'object' || Array.isArray(candidate.mutation_payload)) {
    errors.push('broker mutation payload is malformed');
  } else if (Object.entries(candidate.mutation_payload).some(([key, value]) => !key || typeof value !== 'string')) {
    errors.push('broker mutation payload keys and values must be strings');
  } else {
    errors.push(...validateMutationPayload(candidate, authority, now));
  }
  errors.push(...validateCredentialIsolationReceipt(candidate.credential_isolation_receipt, authority, now)
    .map((error) => `broker request isolation proof: ${error}`));
  if (!candidate.github || typeof candidate.github !== 'object') return [...errors, 'broker GitHub operation is missing'];
  if (!authority.allowed_repositories.includes(candidate.github.repository as never)) errors.push('broker request repository is not allowed');
  if (candidate.github.workflow_ref !== authority.canonical_workflow_ref && candidate.github.operation === 'workflow_dispatch') {
    errors.push('broker workflow dispatch is not bound to the canonical workflow ref');
  }
  if (candidate.mutation_payload_sha256 !== releaseMutationPayloadSha256(candidate.mutation_payload ?? {})) {
    errors.push('broker mutation payload digest is invalid');
  }
  const combination = `${candidate.mutation}|${candidate.workflow}|${candidate.artifact_kind}|${candidate.github.operation}`;
  const allowed = new Set([
    'desktop_release_dispatch|desktop-release.yml|standard|workflow_dispatch',
    'qualification_dispatch|opl-first-run-vm.yml|standard|workflow_dispatch',
    'qualification_dispatch|opl-first-run-vm.yml|full|workflow_dispatch',
    'promotion_dispatch|desktop-release-promote.yml|promotion|workflow_dispatch',
    'full_addon_dispatch|desktop-release-full-addon.yml|full|workflow_dispatch',
    'workflow_cancel|desktop-release.yml|standard|workflow_cancel',
    'workflow_cancel|opl-first-run-vm.yml|standard|workflow_cancel',
    'workflow_cancel|opl-first-run-vm.yml|full|workflow_cancel',
    'workflow_cancel|desktop-release-promote.yml|promotion|workflow_cancel',
    'workflow_cancel|desktop-release-full-addon.yml|full|workflow_cancel',
    'release_draft_cleanup|desktop-release-cleanup-drafts.yml|release_metadata|release_delete',
  ]);
  if (!allowed.has(combination)) errors.push(`broker mutation/workflow/artifact/operation combination is forbidden: ${combination}`);
  const expectedKey = `${candidate.github.repository}:stable:${candidate.idempotency?.version ?? ''}`;
  if (
    !candidate.idempotency || typeof candidate.idempotency !== 'object' ||
    candidate.idempotency.key !== expectedKey || candidate.idempotency.channel !== 'stable' ||
    candidate.idempotency.version !== payloadVersion(candidate) ||
    candidate.idempotency.same_attempt_returns_same_receipt !== true ||
    candidate.idempotency.conflicting_session_or_cohort_rejected !== true ||
    candidate.idempotency.concurrent_different_attempt_rejected !== true
  ) errors.push('broker global idempotency request is malformed');
  if (candidate.github.operation === 'workflow_cancel' && !numericRunIdPattern.test(candidate.github.target_run_id ?? '')) {
    errors.push('broker cancel target run id is invalid');
  }
  if (
    candidate.github.operation === 'workflow_cancel' &&
    candidate.mutation_payload?.target_run_id !== candidate.github.target_run_id
  ) errors.push('broker cancel payload target run id does not match the GitHub target');
  if (
    candidate.github.operation === 'workflow_cancel' &&
    !digestRefPattern.test(String(candidate.mutation_payload?.target_attempt_id))
  ) errors.push('broker cancel payload target attempt id is invalid');
  if (candidate.github.operation === 'workflow_dispatch' && candidate.github.target_run_id !== null) {
    errors.push('workflow dispatch must not include a cancel target');
  }
  if (candidate.github.operation === 'release_delete' && candidate.github.target_run_id !== candidate.mutation_payload?.requesting_run_id) {
    errors.push('draft cleanup broker request is not bound to the exact requesting workflow run');
  }
  return errors;
}

export function releaseMutationPreApiFenceSha256(fence: ReleaseMutationPreApiFenceV1): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(fence)).digest('hex')}`;
}

export function buildReleaseMutationPreApiFence(input: {
  request: ReleaseMutationBrokerRequestV1;
  lease: ReleaseSessionLeaseV2;
  persistedAt: string;
  authorityEpoch?: number;
  versionAggregateRevision?: number;
  versionAttemptSequence?: number;
  versionPredecessorAttemptId?: string | null;
  globalLatestRevision?: number | null;
  ownerAttemptId?: string | null;
  ownerVersion?: string | null;
  ownerFenceToken?: string | null;
  fenceToken?: string | null;
  keyId: string;
  signingPrivateKeyPem: string;
}): ReleaseMutationPreApiFenceV1 {
  const versionSequence = input.versionAttemptSequence ?? 1;
  const promotion = input.request.mutation === 'promotion_dispatch';
  const cancel = input.request.mutation === 'workflow_cancel';
  const promotionCancel = cancel && input.request.workflow === 'desktop-release-promote.yml';
  const globalKey = promotion || promotionCancel ? `${input.request.github.repository}:stable` : null;
  const generatedFenceToken = `sha256:${crypto.createHash('sha256').update([
    releaseMutationBrokerRequestSha256(input.request), input.lease.nonce, String(input.globalLatestRevision ?? 1),
  ].join(':')).digest('hex')}`;
  const targetAttemptId = cancel ? input.lease.target_attempt_id : null;
  const targetRunId = cancel ? input.lease.target_run_id : null;
  const payload: PreApiFencePayload = {
    schema: 'opl_app_release_mutation_pre_api_fence.v1',
    status: 'durable_pre_api_fence',
    authority_epoch: input.authorityEpoch ?? 1,
    request: input.request,
    request_sha256: releaseMutationBrokerRequestSha256(input.request),
    lease: input.lease,
    lease_payload_digest: input.lease.payload_digest,
    persisted_at: input.persistedAt,
    full_addon_deadline_at: deriveFullAddonDeadlineAt(input.request, input.persistedAt),
    version_aggregate: {
      key: input.request.idempotency.key,
      revision: input.versionAggregateRevision ?? versionSequence,
      sequence: versionSequence,
      predecessor_attempt_id: input.versionPredecessorAttemptId ?? null,
    },
    nonce_consumption: {
      nonce: input.lease.nonce,
      owner_attempt_id: input.request.attempt_id,
      state: 'consumed',
      consumed_at: input.persistedAt,
      atomic_with_fence: true,
      survives_lease_expiry: true,
    },
    coordination: {
      scope: promotionCancel ? 'emergency_cancel' : cancel ? 'version_cancel' : promotion ? 'latest_promotion' : 'version',
      global_latest_key: globalKey,
      global_latest_revision: globalKey ? (input.globalLatestRevision ?? 1) : null,
      owner_attempt_id: promotionCancel ? targetAttemptId : promotion ? input.request.attempt_id : null,
      owner_version: promotionCancel ? (input.ownerVersion ?? input.request.idempotency.version) : promotion ? input.request.idempotency.version : null,
      owner_fence_token: promotionCancel ? (input.ownerFenceToken ?? generatedFenceToken) : promotion ? generatedFenceToken : null,
      fence_token: cancel ? null : promotion ? (input.fenceToken ?? generatedFenceToken) : null,
      target_attempt_id: targetAttemptId,
      target_run_id: targetRunId,
      state: promotionCancel ? 'cancel_requested' : cancel ? 'version_cancel_requested' : promotion ? 'held' : 'version_scoped',
      cancel_does_not_advance_head: cancel,
    },
    outbound_api: { state: 'not_started', call_allowed_only_after_durable_commit: true },
    promotion_checkpoint_authorization: buildPromotionCheckpointAuthorization(input.request),
  };
  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519', key_id: input.keyId,
      value_base64: crypto.sign(null, Buffer.from(canonicalJson(payload)), input.signingPrivateKeyPem).toString('base64'),
    },
  };
}

export function validateReleaseMutationPreApiFence(
  fence: unknown,
  request: ReleaseMutationBrokerRequestV1,
  authority: ReleaseBrokerAuthorityV1,
): string[] {
  if (!fence || typeof fence !== 'object') return ['release mutation pre-API fence is missing'];
  const candidate = fence as Partial<ReleaseMutationPreApiFenceV1> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_mutation_pre_api_fence.v1' || candidate.status !== 'durable_pre_api_fence') {
    errors.push('release mutation pre-API fence schema/status is invalid');
  }
  if (candidate.authority_epoch !== authority.authority_epoch) errors.push('release mutation pre-API fence authority epoch is mismatched');
  const requestSha256 = releaseMutationBrokerRequestSha256(request);
  if (candidate.request_sha256 !== requestSha256 || canonicalJson(candidate.request) !== canonicalJson(request)) {
    errors.push('release mutation pre-API fence is not bound to the exact request');
  }
  if (candidate.lease_payload_digest !== candidate.lease?.payload_digest) errors.push('pre-API fence lease digest is mismatched');
  const persistedAt = String(candidate.persisted_at ?? '');
  try {
    if (candidate.full_addon_deadline_at !== deriveFullAddonDeadlineAt(request, persistedAt)) {
      errors.push('pre-API fence Full add-on admission deadline is malformed or not broker-derived');
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  errors.push(...validateReleaseSessionLease(candidate.lease, {
    stableSessionId: request.stable_session_id, releaseCohortRef: request.release_cohort_ref,
    repository: request.github.repository, operatorActor: request.operator_actor,
    brokerActor: authority.broker_identity.github_actor, mutation: request.mutation,
    attemptId: request.attempt_id, workflow: request.workflow, artifactKind: request.artifact_kind,
    controllerWorkflowSha: request.controller_workflow_sha, artifactAppSha: request.artifact_app_sha,
    mutationPayloadSha256: request.mutation_payload_sha256, plannedSessionRevision: request.planned_session_revision,
    targetAttemptId: request.mutation === 'workflow_cancel' ? request.mutation_payload.target_attempt_id : null,
    targetRunId: request.mutation === 'workflow_cancel' ? request.github.target_run_id : null,
    issuer: authority.issuer, publicKeys: authority.trusted_ed25519_public_keys, requireSigned: true, now: persistedAt,
    freshnessMode: 'admission',
  }));
  const version = candidate.version_aggregate;
  if (
    !version || typeof version !== 'object' || version.key !== request.idempotency.key ||
    !Number.isSafeInteger(version.revision) || Number(version.revision) < 1 ||
    !Number.isSafeInteger(version.sequence) || Number(version.sequence) < 1 || Number(version.revision) < Number(version.sequence) ||
    (version.predecessor_attempt_id !== null && !digestRefPattern.test(String(version.predecessor_attempt_id)))
  ) errors.push('pre-API fence version aggregate admission is malformed');
  const nonce = candidate.nonce_consumption;
  if (
    !nonce || typeof nonce !== 'object' || nonce.nonce !== candidate.lease?.nonce ||
    nonce.owner_attempt_id !== request.attempt_id || nonce.state !== 'consumed' ||
    nonce.consumed_at !== persistedAt || nonce.atomic_with_fence !== true || nonce.survives_lease_expiry !== true
  ) errors.push('pre-API fence does not prove durable atomic nonce consumption');
  const coordination = candidate.coordination;
  const expectedScope = request.mutation === 'workflow_cancel'
    ? request.workflow === 'desktop-release-promote.yml' ? 'emergency_cancel' : 'version_cancel'
    : request.mutation === 'promotion_dispatch' ? 'latest_promotion' : 'version';
  if (!coordination || typeof coordination !== 'object' || coordination.scope !== expectedScope) {
    errors.push('pre-API fence coordination scope is invalid');
  } else if (expectedScope === 'version') {
    if (
      coordination.global_latest_key !== null || coordination.global_latest_revision !== null ||
      coordination.owner_attempt_id !== null || coordination.fence_token !== null || coordination.state !== 'version_scoped' ||
      coordination.target_attempt_id !== null || coordination.target_run_id !== null || coordination.cancel_does_not_advance_head !== false
    ) errors.push('version-scoped mutation improperly occupies the global latest mutex');
  } else if (expectedScope === 'version_cancel') {
    if (
      coordination.global_latest_key !== null || coordination.global_latest_revision !== null ||
      coordination.owner_attempt_id !== null || coordination.owner_version !== null ||
      coordination.owner_fence_token !== null || coordination.fence_token !== null ||
      coordination.target_attempt_id !== request.mutation_payload.target_attempt_id ||
      coordination.target_run_id !== request.github.target_run_id || coordination.state !== 'version_cancel_requested' ||
      coordination.cancel_does_not_advance_head !== true
    ) errors.push('version-scoped emergency cancel fence is not bound to its exact target');
  } else if (expectedScope === 'latest_promotion') {
    if (
      coordination.global_latest_key !== `${request.github.repository}:stable` ||
      !Number.isSafeInteger(coordination.global_latest_revision) || Number(coordination.global_latest_revision) < 1 ||
      coordination.owner_attempt_id !== request.attempt_id || coordination.owner_version !== request.idempotency.version ||
      !digestRefPattern.test(String(coordination.fence_token)) || coordination.owner_fence_token !== coordination.fence_token ||
      coordination.state !== 'held' || coordination.cancel_does_not_advance_head !== false
    ) errors.push('promotion pre-API fence does not hold the exact global latest mutex');
  } else if (
    coordination.global_latest_key !== `${request.github.repository}:stable` ||
    !Number.isSafeInteger(coordination.global_latest_revision) || Number(coordination.global_latest_revision) < 1 ||
    coordination.owner_attempt_id !== request.mutation_payload.target_attempt_id ||
    coordination.target_attempt_id !== request.mutation_payload.target_attempt_id ||
    coordination.target_run_id !== request.github.target_run_id || !digestRefPattern.test(String(coordination.owner_fence_token)) ||
    coordination.fence_token !== null || coordination.state !== 'cancel_requested' ||
    coordination.cancel_does_not_advance_head !== true
  ) errors.push('emergency cancel fence is not an exact child of the current global latest owner');
  if (
    !candidate.outbound_api || typeof candidate.outbound_api !== 'object' ||
    candidate.outbound_api.state !== 'not_started' || candidate.outbound_api.call_allowed_only_after_durable_commit !== true
  ) errors.push('pre-API fence does not prove the outbound API call was fenced behind durability');
  try {
    const expectedPromotionAuthorization = buildPromotionCheckpointAuthorization(request);
    if (canonicalJson(candidate.promotion_checkpoint_authorization) !== canonicalJson(expectedPromotionAuthorization)) {
      errors.push('pre-API fence promotion checkpoint authorization is malformed or request-mismatched');
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  const persisted = Date.parse(persistedAt);
  const consumed = Date.parse(String(nonce?.consumed_at));
  if (!Number.isFinite(persisted) || !Number.isFinite(consumed) || persisted !== consumed) {
    errors.push('pre-API fence persistence/nonce timestamps are invalid');
  }
  const { signature, ...payload } = candidate;
  if (!signature || typeof signature !== 'object' || signature.algorithm !== 'Ed25519' ||
    typeof signature.key_id !== 'string' || typeof signature.value_base64 !== 'string') {
    errors.push('pre-API fence signature is malformed');
  } else {
    const publicKey = authority.trusted_ed25519_public_keys[signature.key_id];
    try {
      if (!publicKey || !crypto.verify(null, Buffer.from(canonicalJson(payload)), publicKey, Buffer.from(signature.value_base64, 'base64'))) {
        errors.push('pre-API fence signature is invalid');
      }
    } catch (error) {
      errors.push(`pre-API fence signature verification failed safely: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

export function buildReleaseMutationAcceptanceReceipt(input: {
  request: ReleaseMutationBrokerRequestV1;
  lease: ReleaseSessionLeaseV2;
  acceptedAt: string;
  brokerActor: string;
  brokerTokenFingerprint: string;
  requestId: string;
  runId: string;
  runAttempt?: number;
  workflowSha?: string;
  deletedReleaseId?: string | null;
  deletedReleaseTag?: string | null;
  tagDeleted?: boolean | null;
  preApiFence?: ReleaseMutationPreApiFenceV1;
  fencePersistedAt?: string;
  globalSequence?: number;
  versionAttemptSequence?: number;
  globalPredecessorAttemptId?: string | null;
  versionPredecessorAttemptId?: string | null;
  ownerFenceToken?: string | null;
  keyId: string;
  signingPrivateKeyPem: string;
  credentialIsolationReceipt: CredentialIsolationReceiptV1;
  authorityEpoch?: number;
}): ReleaseMutationAcceptanceReceiptV1 {
  const promotion = input.request.mutation === 'promotion_dispatch';
  const cancel = input.request.mutation === 'workflow_cancel';
  const promotionCancel = cancel && input.request.workflow === 'desktop-release-promote.yml';
  const versionAttemptSequence = input.versionAttemptSequence ?? 1;
  const preApiFence = input.preApiFence ?? buildReleaseMutationPreApiFence({
    request: input.request, lease: input.lease, persistedAt: input.fencePersistedAt ?? input.acceptedAt,
    authorityEpoch: input.authorityEpoch,
    versionAggregateRevision: versionAttemptSequence, versionAttemptSequence,
    versionPredecessorAttemptId: input.versionPredecessorAttemptId ?? null,
    globalLatestRevision: promotion || promotionCancel ? (input.globalSequence ?? 1) : null,
    ownerAttemptId: cancel ? input.lease.target_attempt_id : promotion ? input.request.attempt_id : null,
    ownerVersion: input.request.idempotency.version,
    ownerFenceToken: input.ownerFenceToken,
    keyId: input.keyId, signingPrivateKeyPem: input.signingPrivateKeyPem,
  });
  const payload: AcceptancePayload = {
    schema: 'opl_app_release_mutation_acceptance_receipt.v1',
    status: 'accepted',
    request_sha256: releaseMutationBrokerRequestSha256(input.request),
    lease: input.lease,
    pre_api_fence: preApiFence,
    pre_api_fence_sha256: releaseMutationPreApiFenceSha256(preApiFence),
    accepted_at: input.acceptedAt,
    full_addon_deadline_at: deriveFullAddonDeadlineAt(input.request, input.acceptedAt),
    broker_actor: input.brokerActor,
    broker_token_fingerprint: input.brokerTokenFingerprint,
    github: {
      operation: input.request.github.operation,
      request_id: input.requestId,
      run_id: input.runId,
      run_attempt: input.runAttempt ?? 1,
      workflow_sha: input.workflowSha ?? input.request.controller_workflow_sha,
      deleted_release_id: input.deletedReleaseId ?? null,
      deleted_release_tag: input.deletedReleaseTag ?? null,
      tag_deleted: input.tagDeleted ?? null,
    },
    idempotency: { key: input.request.idempotency.key, outcome: 'executed' },
    ledger_admission: {
      coordination_scope: preApiFence.coordination.scope,
      global_mutation_key: preApiFence.coordination.global_latest_key,
      version_aggregate_key: input.request.idempotency.key,
      global_sequence: promotion ? (input.globalSequence ?? 1) : null,
      version_attempt_sequence: versionAttemptSequence,
      global_predecessor_attempt_id: promotion ? (input.globalPredecessorAttemptId ?? null) : null,
      version_predecessor_attempt_id: input.versionPredecessorAttemptId ?? null,
      admission_class: cancel
        ? promotionCancel ? 'emergency_cancel_of_active' : 'version_cancel_of_active'
        : promotion ? 'latest_promotion_owner' : 'version_scoped',
      attempt_state: cancel
        ? 'emergency_cancel_accepted'
        : input.request.mutation === 'release_draft_cleanup' ? 'destructive_cleanup_accepted' : 'attempt_accepted',
      lease_nonce: input.lease.nonce,
      nonce_state: 'consumed',
    },
    credential_isolation_receipt: input.credentialIsolationReceipt,
  };
  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519',
      key_id: input.keyId,
      value_base64: crypto.sign(null, Buffer.from(canonicalJson(payload)), input.signingPrivateKeyPem).toString('base64'),
    },
  };
}

function validateReleaseMutationAcceptanceReceiptAt(
  receipt: unknown,
  request: ReleaseMutationBrokerRequestV1,
  authority: ReleaseBrokerAuthorityV1,
  observedAt: string,
  mode: 'admission' | 'historical',
): string[] {
  if (!receipt || typeof receipt !== 'object') return ['release mutation acceptance receipt is missing'];
  const candidate = receipt as Partial<ReleaseMutationAcceptanceReceiptV1> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_mutation_acceptance_receipt.v1' || candidate.status !== 'accepted') {
    errors.push('release mutation acceptance receipt schema/status is invalid');
  }
  if (candidate.request_sha256 !== releaseMutationBrokerRequestSha256(request)) {
    errors.push('release mutation acceptance receipt is not bound to the exact broker request');
  }
  const accepted = Date.parse(String(candidate.accepted_at));
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(accepted)) {
    errors.push('release mutation acceptance timestamp is invalid');
  } else {
    errors.push(...validateReleaseMutationBrokerRequest(request, authority, String(candidate.accepted_at)));
    if (
      mode === 'admission' &&
      (!Number.isFinite(observed) || accepted > observed || observed - accepted > 15 * 60 * 1000)
    ) {
      errors.push('release mutation acceptance receipt is not fresh at admission readback');
    }
  }
  try {
    if (candidate.full_addon_deadline_at !== deriveFullAddonDeadlineAt(request, String(candidate.accepted_at ?? ''))) {
      errors.push('release mutation acceptance Full add-on deadline is malformed or not broker-derived');
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (typeof candidate.broker_actor !== 'string' || !candidate.broker_actor) errors.push('broker actor is missing');
  if (!digestRefPattern.test(String(candidate.broker_token_fingerprint))) {
    errors.push('broker acceptance credential fingerprint must be a lowercase sha256 digest');
  }
  if (candidate.broker_actor !== authority.broker_identity.github_actor) {
    errors.push('broker acceptance actor does not match canonical authority');
  }
  const isolationErrors = validateCredentialIsolationReceipt(
    candidate.credential_isolation_receipt,
    authority,
    String(candidate.accepted_at),
  );
  errors.push(...isolationErrors.map((error) => `broker acceptance isolation proof: ${error}`));
  if (candidate.broker_actor !== candidate.credential_isolation_receipt?.broker_credential?.actor) {
    errors.push('broker acceptance actor does not match embedded credential isolation proof');
  }
  if (candidate.broker_token_fingerprint !== candidate.credential_isolation_receipt?.broker_credential?.token_fingerprint) {
    errors.push('broker acceptance credential fingerprint does not match embedded isolation proof');
  }
  if (
    !candidate.github || typeof candidate.github !== 'object' ||
    candidate.github.operation !== request.github.operation ||
    typeof candidate.github.request_id !== 'string' || !candidate.github.request_id ||
    typeof candidate.github.run_id !== 'string' || !numericRunIdPattern.test(candidate.github.run_id) ||
    !Number.isSafeInteger(candidate.github.run_attempt) || Number(candidate.github.run_attempt) < 1 ||
    candidate.github.workflow_sha !== request.controller_workflow_sha || !exactShaPattern.test(String(candidate.github.workflow_sha))
  ) {
    errors.push('GitHub mutation acceptance identity is malformed or mismatched');
  }
  if (
    request.github.operation === 'workflow_cancel' &&
    candidate.github?.run_id !== request.github.target_run_id
  ) errors.push('emergency cancel acceptance is not bound to the exact target run id');
  if (request.github.operation === 'release_delete') {
    if (
      candidate.github?.run_id !== request.mutation_payload.requesting_run_id ||
      candidate.github?.run_attempt !== Number(request.mutation_payload.requesting_run_attempt) ||
      candidate.github?.deleted_release_id !== request.mutation_payload.candidate_release_id ||
      candidate.github?.deleted_release_tag !== request.mutation_payload.candidate_tag ||
      candidate.github?.tag_deleted !== true
    ) errors.push('draft cleanup acceptance does not prove the exact isolated release/tag deletion');
  } else if (
    candidate.github?.deleted_release_id !== null || candidate.github?.deleted_release_tag !== null ||
    candidate.github?.tag_deleted !== null
  ) errors.push('workflow acceptance unexpectedly contains a release deletion result');
  errors.push(...validateReleaseMutationPreApiFence(candidate.pre_api_fence, request, authority));
  if (candidate.pre_api_fence_sha256 !== releaseMutationPreApiFenceSha256(candidate.pre_api_fence as ReleaseMutationPreApiFenceV1)) {
    errors.push('acceptance is not bound to the exact signed pre-API fence bytes');
  }
  const fencePersisted = Date.parse(String(candidate.pre_api_fence?.persisted_at));
  if (!Number.isFinite(accepted) || !Number.isFinite(fencePersisted) || accepted < fencePersisted) {
    errors.push('acceptance predates the durable pre-API fence');
  }
  if (
    !candidate.idempotency || typeof candidate.idempotency !== 'object' ||
    candidate.idempotency.key !== request.idempotency.key ||
    candidate.idempotency.outcome !== 'executed'
  ) {
    errors.push('broker idempotency acceptance is malformed or mismatched');
  }
  const expectedScope = request.mutation === 'workflow_cancel'
    ? request.workflow === 'desktop-release-promote.yml' ? 'emergency_cancel' : 'version_cancel'
    : request.mutation === 'promotion_dispatch' ? 'latest_promotion' : 'version';
  const expectedGlobalKey = ['version', 'version_cancel'].includes(expectedScope) ? null : `${request.github.repository}:stable`;
  const expectedAdmissionClass = request.mutation === 'workflow_cancel'
    ? request.workflow === 'desktop-release-promote.yml' ? 'emergency_cancel_of_active' : 'version_cancel_of_active'
    : request.mutation === 'promotion_dispatch' ? 'latest_promotion_owner' : 'version_scoped';
  const expectedAttemptState = request.mutation === 'workflow_cancel'
    ? 'emergency_cancel_accepted'
    : request.mutation === 'release_draft_cleanup' ? 'destructive_cleanup_accepted' : 'attempt_accepted';
  if (
    !candidate.ledger_admission || typeof candidate.ledger_admission !== 'object' ||
    candidate.ledger_admission.coordination_scope !== expectedScope ||
    candidate.ledger_admission.global_mutation_key !== expectedGlobalKey ||
    candidate.ledger_admission.version_aggregate_key !== request.idempotency.key ||
    (request.mutation === 'promotion_dispatch'
      ? !Number.isSafeInteger(candidate.ledger_admission.global_sequence) || Number(candidate.ledger_admission.global_sequence) < 1
      : candidate.ledger_admission.global_sequence !== null) ||
    !Number.isSafeInteger(candidate.ledger_admission.version_attempt_sequence) ||
    Number(candidate.ledger_admission.version_attempt_sequence) < 1 ||
    (request.mutation !== 'promotion_dispatch' && candidate.ledger_admission.global_predecessor_attempt_id !== null) ||
    (request.mutation === 'promotion_dispatch' && candidate.ledger_admission.global_predecessor_attempt_id !== null &&
      !digestRefPattern.test(String(candidate.ledger_admission.global_predecessor_attempt_id))) ||
    (candidate.ledger_admission.version_predecessor_attempt_id !== null &&
      !digestRefPattern.test(String(candidate.ledger_admission.version_predecessor_attempt_id))) ||
    candidate.ledger_admission.admission_class !== expectedAdmissionClass ||
    candidate.ledger_admission.attempt_state !== expectedAttemptState ||
    candidate.ledger_admission.lease_nonce !== candidate.lease?.nonce ||
    candidate.ledger_admission.nonce_state !== 'consumed' ||
    candidate.ledger_admission.version_attempt_sequence !== candidate.pre_api_fence?.version_aggregate?.sequence ||
    candidate.ledger_admission.version_predecessor_attempt_id !== candidate.pre_api_fence?.version_aggregate?.predecessor_attempt_id
  ) errors.push('broker ledger admission, sequencing, or nonce-consumption proof is malformed');
  errors.push(...validateReleaseSessionLease(candidate.lease, {
    stableSessionId: request.stable_session_id,
    releaseCohortRef: request.release_cohort_ref,
    repository: request.github.repository,
    operatorActor: request.operator_actor,
    brokerActor: String(candidate.broker_actor ?? ''),
    mutation: request.mutation,
    attemptId: request.attempt_id,
    workflow: request.workflow,
    artifactKind: request.artifact_kind,
    controllerWorkflowSha: request.controller_workflow_sha,
    artifactAppSha: request.artifact_app_sha,
    mutationPayloadSha256: request.mutation_payload_sha256,
    plannedSessionRevision: request.planned_session_revision,
    targetAttemptId: request.mutation === 'workflow_cancel' ? request.mutation_payload.target_attempt_id : null,
    targetRunId: request.mutation === 'workflow_cancel' ? request.github.target_run_id : null,
    issuer: authority.issuer,
    publicKeys: authority.trusted_ed25519_public_keys,
    requireSigned: true,
    now: String(candidate.accepted_at), freshnessMode: 'historical', acceptedAt: String(candidate.accepted_at),
  }));
  const { signature, ...payload } = candidate;
  if (
    !signature || typeof signature !== 'object' || signature.algorithm !== 'Ed25519' ||
    typeof signature.key_id !== 'string' || typeof signature.value_base64 !== 'string'
  ) {
    errors.push('release mutation acceptance signature is malformed');
  } else {
    const publicKey = authority.trusted_ed25519_public_keys[signature.key_id];
    try {
      if (!publicKey || !crypto.verify(
        null,
        Buffer.from(canonicalJson(payload)),
        publicKey,
        Buffer.from(signature.value_base64, 'base64'),
      )) errors.push('release mutation acceptance signature is invalid');
    } catch (error) {
      errors.push(`release mutation acceptance signature verification failed safely: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

export function validateReleaseMutationAcceptanceReceipt(
  receipt: unknown,
  request: ReleaseMutationBrokerRequestV1,
  authority: ReleaseBrokerAuthorityV1,
  now = new Date().toISOString(),
): string[] {
  return validateReleaseMutationAcceptanceReceiptAt(receipt, request, authority, now, 'admission');
}

export function validateHistoricalReleaseMutationAcceptanceReceipt(
  receipt: unknown,
  request: ReleaseMutationBrokerRequestV1,
  authority: ReleaseBrokerAuthorityV1,
): string[] {
  return validateReleaseMutationAcceptanceReceiptAt(
    receipt,
    request,
    authority,
    String((receipt as Partial<ReleaseMutationAcceptanceReceiptV1> | null)?.accepted_at ?? ''),
    'historical',
  );
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

function validateLedgerLookup(lookup: unknown, request?: ReleaseMutationBrokerRequestV1): string[] {
  if (!lookup || typeof lookup !== 'object') return ['broker ledger lookup is missing'];
  const candidate = lookup as Partial<ReleaseMutationBrokerLedgerLookupV1>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_mutation_broker_ledger_lookup.v1') errors.push('broker ledger lookup schema is invalid');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(candidate.repository))) errors.push('broker ledger lookup repository is invalid');
  if (candidate.channel !== 'stable') errors.push('broker ledger lookup channel is invalid');
  if (typeof candidate.version !== 'string' || !candidate.version) errors.push('broker ledger lookup version is missing');
  for (const field of ['stable_session_id', 'release_cohort_ref', 'attempt_id', 'mutation_payload_sha256'] as const) {
    if (!digestRefPattern.test(String(candidate[field]))) errors.push(`broker ledger lookup ${field} is invalid`);
  }
  if (!digestRefPattern.test(String(candidate.request_sha256))) {
    errors.push('broker ledger lookup request_sha256 is invalid');
  }
  if (!/^[0-9a-f]{32}$/.test(String(candidate.challenge))) errors.push('broker ledger lookup challenge is invalid');
  if (request) {
    const expected = buildReleaseMutationBrokerLedgerLookup({
      repository: request.github.repository,
      version: request.idempotency.version,
      stableSessionId: request.stable_session_id,
      releaseCohortRef: request.release_cohort_ref,
      attemptId: request.attempt_id,
      mutationPayloadSha256: request.mutation_payload_sha256,
      requestSha256: releaseMutationBrokerRequestSha256(request),
      challenge: String(candidate.challenge),
    });
    for (const field of [
      'repository', 'channel', 'version', 'stable_session_id', 'release_cohort_ref', 'attempt_id',
      'mutation_payload_sha256',
    ] as const) {
      if (candidate[field] !== expected[field]) errors.push(`broker ledger lookup ${field} does not bind the exact mutation attempt`);
    }
    if (candidate.request_sha256 !== expected.request_sha256) errors.push('broker ledger lookup request digest does not bind the exact mutation request');
  }
  return errors;
}

export function buildReleaseMutationBrokerLedgerRecord(input: {
  lookup: ReleaseMutationBrokerLedgerLookupV1;
  request: ReleaseMutationBrokerRequestV1;
  preApiFence?: ReleaseMutationPreApiFenceV1;
  acceptance: ReleaseMutationAcceptanceReceiptV1 | null;
  recordedAt: string;
  mutationState: ReleaseMutationBrokerLedgerRecordV1['mutation_state'];
  exactRunId: string | null;
  cancelTransition?: BoundLedgerRecordPayload['cancel_transition'];
  keyId: string;
  signingPrivateKeyPem: string;
}): ReleaseMutationBrokerLedgerRecordV1 {
  const preApiFence = input.preApiFence ?? input.acceptance?.pre_api_fence;
  if (!preApiFence) throw new Error('Broker ledger record requires the durable pre-API fence.');
  const unknown = input.mutationState === 'outcome_unknown';
  if (unknown && (input.acceptance !== null || input.exactRunId !== null)) {
    throw new Error('Outcome-unknown ledger record must not claim acceptance or an exact run id.');
  }
  if (!unknown && (!input.acceptance || !numericRunIdPattern.test(String(input.exactRunId)))) {
    throw new Error('Run-bound or terminal ledger record requires signed acceptance and a positive exact run id.');
  }
  const payload = {
    schema: 'opl_app_release_mutation_broker_ledger_record.v1',
    lookup: input.lookup,
    request: input.request,
    pre_api_fence: preApiFence,
    acceptance: input.acceptance,
    recorded_at: input.recordedAt,
    mutation_state: input.mutationState,
    exact_run_id: input.exactRunId,
    reconcile_disposition: unknown ? 'reconcile_only' : 'readback_exact_run',
    cancel_transition: unknown ? null : (input.cancelTransition ?? null),
  } as BoundLedgerRecordPayload | UnknownLedgerRecordPayload;
  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519',
      key_id: input.keyId,
      value_base64: crypto.sign(null, Buffer.from(canonicalJson(payload)), input.signingPrivateKeyPem).toString('base64'),
    },
  };
}

export function validateReleaseMutationBrokerLedgerRecord(
  record: unknown,
  expectedLookup: ReleaseMutationBrokerLedgerLookupV1,
  authority: ReleaseBrokerAuthorityV1,
): string[] {
  if (!record || typeof record !== 'object') return ['broker ledger record is missing'];
  const candidate = record as Partial<ReleaseMutationBrokerLedgerRecordV1> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_mutation_broker_ledger_record.v1') errors.push('broker ledger record schema is invalid');
  errors.push(...validateLedgerLookup(candidate.lookup));
  for (const field of [
    'repository', 'channel', 'version', 'stable_session_id', 'release_cohort_ref', 'attempt_id',
    'mutation_payload_sha256',
  ] as const) {
    if (candidate.lookup?.[field] !== expectedLookup[field]) errors.push(`broker ledger record lookup ${field} is mismatched`);
  }
  if (candidate.lookup?.request_sha256 !== expectedLookup.request_sha256) {
    errors.push('broker ledger record request digest is mismatched');
  }
  if (!candidate.request || typeof candidate.request !== 'object') {
    errors.push('broker ledger record request is missing');
  } else {
    errors.push(...validateLedgerLookup(candidate.lookup, candidate.request));
  }
  if (candidate.request) errors.push(...validateReleaseMutationPreApiFence(candidate.pre_api_fence, candidate.request, authority));
  const unknown = candidate.mutation_state === 'outcome_unknown';
  if (unknown) {
    if (candidate.acceptance !== null || candidate.exact_run_id !== null || candidate.reconcile_disposition !== 'reconcile_only') {
      errors.push('outcome-unknown ledger record must have null acceptance/run identity and remain reconcile_only');
    }
    if (candidate.cancel_transition !== null) errors.push('outcome-unknown record cannot claim an atomic cancel transition');
  } else {
    if (!candidate.acceptance || typeof candidate.acceptance !== 'object' || !candidate.request) {
      errors.push('run-bound or terminal broker ledger record acceptance is missing');
    } else {
      errors.push(...validateHistoricalReleaseMutationAcceptanceReceipt(candidate.acceptance, candidate.request, authority));
      if (candidate.acceptance.pre_api_fence_sha256 !== releaseMutationPreApiFenceSha256(candidate.pre_api_fence as ReleaseMutationPreApiFenceV1)) {
        errors.push('broker ledger record acceptance references a different pre-API fence');
      }
    }
    if (!numericRunIdPattern.test(String(candidate.exact_run_id))) errors.push('broker ledger exact run id is invalid');
    if (candidate.acceptance?.github?.run_id !== candidate.exact_run_id) errors.push('broker ledger exact run id differs from signed acceptance');
    if (candidate.reconcile_disposition !== 'readback_exact_run') errors.push('bound broker ledger record must read back the exact run');
  }
  const recorded = Date.parse(String(candidate.recorded_at));
  const lowerBound = Date.parse(String(candidate.acceptance?.accepted_at ?? candidate.pre_api_fence?.persisted_at));
  if (!Number.isFinite(recorded) || !Number.isFinite(lowerBound) || recorded < lowerBound) {
    errors.push('broker ledger record timestamp predates its durable fence/acceptance or is invalid');
  }
  if (!['run_bound', 'terminal_succeeded', 'terminal_failed', 'terminal_cancelled', 'outcome_unknown'].includes(String(candidate.mutation_state))) {
    errors.push('broker ledger mutation state is invalid');
  }
  if (candidate.request?.mutation === 'workflow_cancel' && candidate.cancel_transition) {
    if (
      candidate.cancel_transition.target_attempt_id !== candidate.request.mutation_payload.target_attempt_id ||
      candidate.cancel_transition.target_run_id !== candidate.request.github.target_run_id ||
      candidate.cancel_transition.target_terminal_state !== 'terminal_cancelled' ||
      candidate.cancel_transition.atomic_with_owner_state_update !== true ||
      typeof candidate.cancel_transition.latest_readback_completed !== 'boolean'
    ) errors.push('broker emergency cancel transition is malformed or targets a different owner');
  } else if (candidate.request?.mutation !== 'workflow_cancel' && candidate.cancel_transition !== null) {
    errors.push('non-cancel broker ledger record cannot contain a cancel transition');
  }
  const { signature, ...payload } = candidate;
  if (
    !signature || typeof signature !== 'object' || signature.algorithm !== 'Ed25519' ||
    typeof signature.key_id !== 'string' || typeof signature.value_base64 !== 'string'
  ) {
    errors.push('broker ledger record signature is malformed');
  } else {
    const publicKey = authority.trusted_ed25519_public_keys[signature.key_id];
    try {
      if (!publicKey || !crypto.verify(
        null,
        Buffer.from(canonicalJson(payload)),
        publicKey,
        Buffer.from(signature.value_base64, 'base64'),
      )) errors.push('broker ledger record signature is invalid');
    } catch (error) {
      errors.push(`broker ledger record signature verification failed safely: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

function validateSignedCurrentness(input: {
  linearizedAt: unknown;
  expiresAt: unknown;
  now: string;
  maxAgeSeconds: number;
  label: string;
}): string[] {
  const linearized = Date.parse(String(input.linearizedAt));
  const expires = Date.parse(String(input.expiresAt));
  const now = Date.parse(input.now);
  if (
    !Number.isFinite(linearized) || !Number.isFinite(expires) || !Number.isFinite(now) ||
    expires <= linearized || expires - linearized > input.maxAgeSeconds * 1_000 ||
    now < linearized || now >= expires
  ) return [`${input.label} is stale, future-dated, or exceeds the currentness window`];
  return [];
}

export function buildReleaseMutationVersionAggregate(input: {
  lookup: ReleaseMutationBrokerLedgerLookupV1;
  records: ReleaseMutationBrokerLedgerRecordV1[];
  revision?: number;
  ledgerGeneration: number;
  authorityEpoch?: number;
  linearizedAt: string;
  expiresAt?: string;
  keyId: string;
  signingPrivateKeyPem: string;
}): ReleaseMutationVersionAggregateV1 {
  const records = [...input.records].sort((left, right) =>
    left.pre_api_fence.version_aggregate.sequence - right.pre_api_fence.version_aggregate.sequence,
  );
  const linearized = Date.parse(input.linearizedAt);
  const payload: VersionAggregatePayload = {
    schema: 'opl_app_release_mutation_version_aggregate.v1',
    repository: input.lookup.repository,
    channel: 'stable',
    version: input.lookup.version,
    stable_session_id: input.lookup.stable_session_id,
    release_cohort_ref: input.lookup.release_cohort_ref,
    challenge: input.lookup.challenge,
    authority_epoch: input.authorityEpoch ?? 1,
    revision: input.revision ?? records.length,
    ledger_generation: input.ledgerGeneration,
    head_attempt_id: records.at(-1)?.request.attempt_id ?? null,
    record_count: records.length,
    first_sequence: records.length > 0 ? 1 : null,
    complete_through_sequence: records.length,
    partition_complete_from_sequence_one: true,
    linearized_at: input.linearizedAt,
    expires_at: input.expiresAt ?? new Date(linearized + 30_000).toISOString(),
    records,
  };
  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519', key_id: input.keyId,
      value_base64: crypto.sign(null, Buffer.from(canonicalJson(payload)), input.signingPrivateKeyPem).toString('base64'),
    },
  };
}

export function validateReleaseMutationVersionAggregate(
  aggregate: unknown,
  lookup: ReleaseMutationBrokerLedgerLookupV1,
  authority: ReleaseBrokerAuthorityV1,
  options: { now?: string; minimumLedgerGeneration?: number; minimumRevision?: number } = {},
): string[] {
  if (!aggregate || typeof aggregate !== 'object') return ['signed release mutation version aggregate is missing'];
  const candidate = aggregate as Partial<ReleaseMutationVersionAggregateV1> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_mutation_version_aggregate.v1') errors.push('release mutation version aggregate schema is invalid');
  for (const [field, expected] of [
    ['repository', lookup.repository], ['channel', lookup.channel], ['version', lookup.version],
    ['stable_session_id', lookup.stable_session_id], ['release_cohort_ref', lookup.release_cohort_ref],
    ['challenge', lookup.challenge],
  ] as const) {
    if (candidate[field] !== expected) errors.push(`release mutation version aggregate ${field} is mismatched`);
  }
  if (!Number.isSafeInteger(candidate.revision) || Number(candidate.revision) < 0) errors.push('version aggregate revision is invalid');
  if (candidate.authority_epoch !== authority.authority_epoch) errors.push('version aggregate authority epoch is mismatched');
  if (!Number.isSafeInteger(candidate.ledger_generation) || Number(candidate.ledger_generation) < 0) errors.push('version aggregate ledger generation is invalid');
  if (Number(candidate.revision) < (options.minimumRevision ?? 0)) errors.push('version aggregate revision regressed');
  if (Number(candidate.ledger_generation) < (options.minimumLedgerGeneration ?? 0)) errors.push('version aggregate ledger generation regressed');
  errors.push(...validateSignedCurrentness({
    linearizedAt: candidate.linearized_at, expiresAt: candidate.expires_at,
    now: options.now ?? new Date().toISOString(), maxAgeSeconds: authority.durable_lookup.max_currentness_age_seconds,
    label: 'signed release mutation version aggregate',
  }));
  const records = Array.isArray(candidate.records) ? candidate.records : [];
  if (!Array.isArray(candidate.records)) errors.push('version aggregate records are malformed');
  if (!Number.isSafeInteger(candidate.record_count) || candidate.record_count !== records.length) {
    errors.push('version aggregate record count watermark is invalid');
  }
  if (candidate.partition_complete_from_sequence_one !== true) errors.push('version aggregate partition is not complete from sequence one');
  if (candidate.first_sequence !== (records.length > 0 ? 1 : null)) errors.push('version aggregate first sequence watermark is invalid');
  if (candidate.complete_through_sequence !== records.length) errors.push('version aggregate complete-through watermark is invalid');
  if (Number(candidate.revision) < records.length) errors.push('version aggregate revision precedes its complete record partition');
  const attemptIds = new Set<string>();
  const nonces = new Set<string>();
  records.forEach((record, index) => {
    errors.push(...validateReleaseMutationBrokerLedgerRecord(record, record.lookup, authority));
    if (
      record.request.github.repository !== lookup.repository || record.request.idempotency.version !== lookup.version ||
      record.request.stable_session_id !== lookup.stable_session_id || record.request.release_cohort_ref !== lookup.release_cohort_ref
    ) errors.push('version aggregate contains a record outside its immutable version/session/cohort identity');
    const expectedSequence = index + 1;
    if (record.pre_api_fence.version_aggregate.sequence !== expectedSequence) {
      errors.push(`version aggregate sequence ${expectedSequence} is missing or out of order`);
    }
    if (record.pre_api_fence.version_aggregate.revision > Number(candidate.revision)) {
      errors.push('version aggregate record revision exceeds the signed aggregate revision');
    }
    const expectedPredecessor = records[index - 1]?.request.attempt_id ?? null;
    if (record.pre_api_fence.version_aggregate.predecessor_attempt_id !== expectedPredecessor) {
      errors.push(`version aggregate predecessor is invalid for attempt ${record.request.attempt_id}`);
    }
    if (attemptIds.has(record.request.attempt_id)) errors.push(`version aggregate contains duplicate attempt ${record.request.attempt_id}`);
    attemptIds.add(record.request.attempt_id);
    const nonce = record.pre_api_fence.nonce_consumption.nonce;
    if (nonces.has(nonce)) errors.push(`version aggregate lease nonce ${nonce} was consumed by multiple attempts`);
    nonces.add(nonce);
  });
  if (candidate.head_attempt_id !== (records.at(-1)?.request.attempt_id ?? null)) {
    errors.push('version aggregate head attempt does not match the complete partition');
  }
  const { signature, ...payload } = candidate;
  if (!signature || typeof signature !== 'object' || signature.algorithm !== 'Ed25519' ||
      typeof signature.key_id !== 'string' || typeof signature.value_base64 !== 'string') {
    errors.push('release mutation version aggregate signature is malformed');
  } else {
    const publicKey = authority.trusted_ed25519_public_keys[signature.key_id];
    try {
      if (!publicKey || !crypto.verify(null, Buffer.from(canonicalJson(payload)), publicKey, Buffer.from(signature.value_base64, 'base64'))) {
        errors.push('release mutation version aggregate signature is invalid');
      }
    } catch (error) {
      errors.push(`release mutation version aggregate signature verification failed safely: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

export function buildReleaseLatestMutationHead(input: {
  repository: string;
  challenge: string;
  revision: number;
  ledgerGeneration: number;
  authorityEpoch?: number;
  state: LatestMutationHeadPayload['state'];
  owner: LatestMutationOwner | null;
  terminalRelease?: LatestMutationHeadPayload['terminal_release'];
  linearizedAt: string;
  expiresAt?: string;
  keyId: string;
  signingPrivateKeyPem: string;
}): ReleaseLatestMutationHeadV1 {
  const linearized = Date.parse(input.linearizedAt);
  const payload: LatestMutationHeadPayload = {
    schema: 'opl_app_release_latest_mutation_head.v1',
    repository: input.repository,
    channel: 'stable',
    challenge: input.challenge,
    authority_epoch: input.authorityEpoch ?? 1,
    revision: input.revision,
    ledger_generation: input.ledgerGeneration,
    state: input.state,
    owner: input.owner,
    terminal_release: input.terminalRelease ?? null,
    linearized_at: input.linearizedAt,
    expires_at: input.expiresAt ?? new Date(linearized + 30_000).toISOString(),
  };
  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519', key_id: input.keyId,
      value_base64: crypto.sign(null, Buffer.from(canonicalJson(payload)), input.signingPrivateKeyPem).toString('base64'),
    },
  };
}

export function validateReleaseLatestMutationHead(
  head: unknown,
  lookup: ReleaseMutationBrokerLedgerLookupV1,
  authority: ReleaseBrokerAuthorityV1,
  options: { now?: string; minimumLedgerGeneration?: number; minimumRevision?: number } = {},
): string[] {
  if (!head || typeof head !== 'object') return ['signed global latest mutation head is missing'];
  const candidate = head as Partial<ReleaseLatestMutationHeadV1> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_latest_mutation_head.v1') errors.push('global latest mutation head schema is invalid');
  if (candidate.repository !== lookup.repository || candidate.channel !== 'stable' || candidate.challenge !== lookup.challenge) {
    errors.push('global latest mutation head identity/challenge is mismatched');
  }
  if (!Number.isSafeInteger(candidate.revision) || Number(candidate.revision) < 0) errors.push('global latest mutation head revision is invalid');
  if (candidate.authority_epoch !== authority.authority_epoch) errors.push('global latest mutation head authority epoch is mismatched');
  if (!Number.isSafeInteger(candidate.ledger_generation) || Number(candidate.ledger_generation) < 0) errors.push('global latest mutation head ledger generation is invalid');
  if (Number(candidate.revision) < (options.minimumRevision ?? 0)) errors.push('global latest mutation head revision regressed');
  if (Number(candidate.ledger_generation) < (options.minimumLedgerGeneration ?? 0)) errors.push('global latest mutation head ledger generation regressed');
  if (!['free', 'held', 'outcome_unknown', 'cancel_requested'].includes(String(candidate.state))) {
    errors.push('global latest mutation head state is invalid');
  }
  if (candidate.state === 'free') {
    if (candidate.owner !== null) errors.push('free global latest mutation head cannot retain an owner');
  } else if (
    !candidate.owner || typeof candidate.owner !== 'object' ||
    !digestRefPattern.test(String(candidate.owner.attempt_id)) || !candidate.owner.version ||
    !digestRefPattern.test(String(candidate.owner.stable_session_id)) ||
    !digestRefPattern.test(String(candidate.owner.release_cohort_ref)) ||
    (candidate.owner.exact_run_id !== null && !numericRunIdPattern.test(String(candidate.owner.exact_run_id))) ||
    !digestRefPattern.test(String(candidate.owner.fence_token))
  ) errors.push('active global latest mutation head owner is malformed');
  if (candidate.state !== 'free' && candidate.terminal_release !== null) {
    errors.push('active global latest mutation head cannot claim a terminal release transition');
  }
  if (candidate.terminal_release !== null) {
    const release = candidate.terminal_release;
    if (
      !release || typeof release !== 'object' || !digestRefPattern.test(String(release.owner_attempt_id)) ||
      !['terminal_succeeded', 'terminal_failed', 'terminal_cancelled'].includes(String(release.owner_terminal_state)) ||
      !numericRunIdPattern.test(String(release.exact_run_id)) || release.latest_readback_completed !== true ||
      !Number.isSafeInteger(release.cas_from_revision) || Number(release.cas_from_revision) < 1 ||
      !Number.isFinite(Date.parse(String(release.released_at)))
    ) errors.push('global latest mutation head terminal release proof is malformed');
  }
  errors.push(...validateSignedCurrentness({
    linearizedAt: candidate.linearized_at, expiresAt: candidate.expires_at,
    now: options.now ?? new Date().toISOString(), maxAgeSeconds: authority.durable_lookup.max_currentness_age_seconds,
    label: 'signed global latest mutation head',
  }));
  const { signature, ...payload } = candidate;
  if (!signature || typeof signature !== 'object' || signature.algorithm !== 'Ed25519' ||
      typeof signature.key_id !== 'string' || typeof signature.value_base64 !== 'string') {
    errors.push('global latest mutation head signature is malformed');
  } else {
    const publicKey = authority.trusted_ed25519_public_keys[signature.key_id];
    try {
      if (!publicKey || !crypto.verify(null, Buffer.from(canonicalJson(payload)), publicKey, Buffer.from(signature.value_base64, 'base64'))) {
        errors.push('global latest mutation head signature is invalid');
      }
    } catch (error) {
      errors.push(`global latest mutation head signature verification failed safely: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

function deriveLatestMutationHead(
  records: ReleaseMutationBrokerLedgerRecordV1[],
  observedAt: string,
): Pick<LatestMutationHeadPayload, 'revision' | 'state' | 'owner' | 'terminal_release'> {
  const promotions = records.filter((record) => record.request.mutation === 'promotion_dispatch');
  const ownerRecord = promotions.sort((left, right) =>
    Number(left.pre_api_fence.coordination.global_latest_revision) - Number(right.pre_api_fence.coordination.global_latest_revision),
  ).at(-1) ?? null;
  if (!ownerRecord) return { revision: 0, state: 'free', owner: null, terminal_release: null };
  const revision = Number(ownerRecord.pre_api_fence.coordination.global_latest_revision);
  const cancel = records
    .filter((record) =>
      record.request.mutation === 'workflow_cancel' &&
      record.request.mutation_payload.target_attempt_id === ownerRecord.request.attempt_id &&
      record.request.github.target_run_id === ownerRecord.exact_run_id
    )
    .sort((left, right) =>
      left.pre_api_fence.version_aggregate.sequence - right.pre_api_fence.version_aggregate.sequence,
    )
    .at(-1) ?? null;
  const cancelReleased = cancel?.cancel_transition?.latest_readback_completed === true &&
    cancel.cancel_transition.target_terminal_state === 'terminal_cancelled' &&
    cancel.cancel_transition.atomic_with_owner_state_update === true;
  const terminal = ledgerStateIsTerminal(ownerRecord.mutation_state) || cancelReleased;
  const owner: LatestMutationOwner = {
    attempt_id: ownerRecord.request.attempt_id,
    version: ownerRecord.request.idempotency.version,
    stable_session_id: ownerRecord.request.stable_session_id,
    release_cohort_ref: ownerRecord.request.release_cohort_ref,
    exact_run_id: ownerRecord.exact_run_id,
    fence_token: String(ownerRecord.pre_api_fence.coordination.fence_token),
  };
  return {
    revision,
    state: terminal ? 'free' : cancel ? 'cancel_requested' : ownerRecord.mutation_state === 'outcome_unknown' ? 'outcome_unknown' : 'held',
    owner: terminal ? null : owner,
    terminal_release: terminal ? {
      owner_attempt_id: owner.attempt_id,
      owner_terminal_state: cancelReleased
        ? 'terminal_cancelled'
        : ownerRecord.mutation_state as 'terminal_succeeded' | 'terminal_failed' | 'terminal_cancelled',
      exact_run_id: String(owner.exact_run_id), latest_readback_completed: true,
      cas_from_revision: revision, released_at: observedAt,
    } : null,
  };
}

function buildFixtureLatestHead(input: {
  lookup: ReleaseMutationBrokerLedgerLookupV1;
  records: ReleaseMutationBrokerLedgerRecordV1[];
  ledgerGeneration: number;
  observedAt: string;
  expiresAt?: string;
  keyId: string;
  signingPrivateKeyPem: string;
}): ReleaseLatestMutationHeadV1 {
  const derived = deriveLatestMutationHead(input.records, input.observedAt);
  return buildReleaseLatestMutationHead({
    repository: input.lookup.repository, challenge: input.lookup.challenge, revision: derived.revision,
    ledgerGeneration: input.ledgerGeneration,
    state: derived.state, owner: derived.owner, terminalRelease: derived.terminal_release,
    linearizedAt: input.observedAt, expiresAt: input.expiresAt,
    keyId: input.keyId, signingPrivateKeyPem: input.signingPrivateKeyPem,
  });
}

export function buildReleaseMutationBrokerLedgerNotFound(input: {
  lookup: ReleaseMutationBrokerLedgerLookupV1;
  observedAt: string;
  ledgerGeneration: number;
  authorityEpoch?: number;
  versionAggregateRevision?: number;
  aggregateRecords?: ReleaseMutationBrokerLedgerRecordV1[];
  versionAggregate?: ReleaseMutationVersionAggregateV1;
  latestMutationHead?: ReleaseLatestMutationHeadV1;
  latestHeadRecords?: ReleaseMutationBrokerLedgerRecordV1[];
  expiresAt?: string;
  keyId: string;
  signingPrivateKeyPem: string;
}): Extract<ReleaseMutationBrokerLedgerLookupResultV1, { status: 'not_found' }> {
  const linearized = Date.parse(input.observedAt);
  const records = input.aggregateRecords ?? [];
  const versionAggregate = input.versionAggregate ?? buildReleaseMutationVersionAggregate({
    lookup: input.lookup, records, revision: input.versionAggregateRevision, authorityEpoch: input.authorityEpoch,
    ledgerGeneration: input.ledgerGeneration, linearizedAt: input.observedAt, expiresAt: input.expiresAt,
    keyId: input.keyId, signingPrivateKeyPem: input.signingPrivateKeyPem,
  });
  if (versionAggregate.records.some((record) => record.request.attempt_id === input.lookup.attempt_id)) {
    throw new Error('Not-found lookup cannot be built from an aggregate that already contains the exact attempt.');
  }
  const latestMutationHead = input.latestMutationHead ?? buildFixtureLatestHead({
    lookup: input.lookup, records: input.latestHeadRecords ?? records, ledgerGeneration: input.ledgerGeneration,
    observedAt: input.observedAt, expiresAt: input.expiresAt,
    keyId: input.keyId, signingPrivateKeyPem: input.signingPrivateKeyPem,
  });
  const payload = {
    schema: 'opl_app_release_mutation_broker_ledger_lookup_result.v2',
    status: 'not_found',
    lookup: input.lookup,
    record: null,
    version_aggregate: versionAggregate,
    latest_mutation_head: latestMutationHead,
    read_proof: {
      consistency: 'linearizable',
      observed_at: input.observedAt,
      ledger_generation: input.ledgerGeneration,
      version_aggregate_revision: versionAggregate.revision,
      version_head_attempt_id: versionAggregate.head_attempt_id,
      complete_through_sequence: versionAggregate.complete_through_sequence,
      authority_epoch: input.authorityEpoch ?? 1,
      linearized_at: input.observedAt,
      expires_at: input.expiresAt ?? new Date(linearized + 30_000).toISOString(),
    },
  } as const;
  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519', key_id: input.keyId,
      value_base64: crypto.sign(null, Buffer.from(canonicalJson(payload)), input.signingPrivateKeyPem).toString('base64'),
    },
  };
}

function buildSignedLedgerLookupRecordResult(
  status: 'found' | 'outcome_unknown',
  input: {
    lookup: ReleaseMutationBrokerLedgerLookupV1;
    record: ReleaseMutationBrokerLedgerRecordV1;
    observedAt: string;
    expiresAt?: string;
    ledgerGeneration: number;
    authorityEpoch?: number;
    versionAggregateRevision: number;
    aggregateRecords?: ReleaseMutationBrokerLedgerRecordV1[];
    versionAggregate?: ReleaseMutationVersionAggregateV1;
    latestMutationHead?: ReleaseLatestMutationHeadV1;
    latestHeadRecords?: ReleaseMutationBrokerLedgerRecordV1[];
    keyId: string;
    signingPrivateKeyPem: string;
  },
): ReleaseMutationBrokerLedgerLookupResultV1 {
  const linearized = Date.parse(input.observedAt);
  const aggregateRecords = input.aggregateRecords ?? [input.record];
  const versionAggregate = input.versionAggregate ?? buildReleaseMutationVersionAggregate({
    lookup: input.lookup, records: aggregateRecords, revision: input.versionAggregateRevision, authorityEpoch: input.authorityEpoch,
    ledgerGeneration: input.ledgerGeneration, linearizedAt: input.observedAt, expiresAt: input.expiresAt,
    keyId: input.keyId, signingPrivateKeyPem: input.signingPrivateKeyPem,
  });
  const latestMutationHead = input.latestMutationHead ?? buildFixtureLatestHead({
    lookup: input.lookup, records: input.latestHeadRecords ?? aggregateRecords,
    ledgerGeneration: input.ledgerGeneration, observedAt: input.observedAt, expiresAt: input.expiresAt,
    keyId: input.keyId, signingPrivateKeyPem: input.signingPrivateKeyPem,
  });
  const payload = {
    schema: 'opl_app_release_mutation_broker_ledger_lookup_result.v2' as const,
    status,
    lookup: input.lookup,
    record: input.record,
    version_aggregate: versionAggregate,
    latest_mutation_head: latestMutationHead,
    read_proof: {
      consistency: 'linearizable' as const,
      observed_at: input.observedAt,
      ledger_generation: input.ledgerGeneration,
      version_aggregate_revision: versionAggregate.revision,
      version_head_attempt_id: versionAggregate.head_attempt_id,
      complete_through_sequence: versionAggregate.complete_through_sequence,
      authority_epoch: input.authorityEpoch ?? 1,
      linearized_at: input.observedAt,
      expires_at: input.expiresAt ?? new Date(linearized + 30_000).toISOString(),
    },
  };
  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519', key_id: input.keyId,
      value_base64: crypto.sign(null, Buffer.from(canonicalJson(payload)), input.signingPrivateKeyPem).toString('base64'),
    },
  } as ReleaseMutationBrokerLedgerLookupResultV1;
}

export function buildReleaseMutationBrokerLedgerFound(
  input: Parameters<typeof buildSignedLedgerLookupRecordResult>[1],
): Extract<ReleaseMutationBrokerLedgerLookupResultV1, { status: 'found' }> {
  if (input.record.mutation_state === 'outcome_unknown') throw new Error('Found lookup cannot wrap an outcome-unknown record.');
  return buildSignedLedgerLookupRecordResult('found', input) as Extract<ReleaseMutationBrokerLedgerLookupResultV1, { status: 'found' }>;
}

export function buildReleaseMutationBrokerLedgerOutcomeUnknown(
  input: Parameters<typeof buildSignedLedgerLookupRecordResult>[1],
): Extract<ReleaseMutationBrokerLedgerLookupResultV1, { status: 'outcome_unknown' }> {
  if (input.record.mutation_state !== 'outcome_unknown') throw new Error('Outcome-unknown lookup requires a fenced unknown record.');
  return buildSignedLedgerLookupRecordResult('outcome_unknown', input) as Extract<ReleaseMutationBrokerLedgerLookupResultV1, { status: 'outcome_unknown' }>;
}

export function validateReleaseMutationBrokerLedgerLookupResult(
  result: unknown,
  lookup: ReleaseMutationBrokerLedgerLookupV1,
  authority: ReleaseBrokerAuthorityV1,
  options: {
    now?: string;
    minimumLedgerGeneration?: number;
    minimumVersionAggregateRevision?: number;
    minimumLatestHeadRevision?: number;
    priorAuthoritativeStatus?: 'found' | 'not_found' | 'outcome_unknown';
  } = {},
): string[] {
  if (!result || typeof result !== 'object') return ['broker ledger lookup result is missing'];
  const candidate = result as Partial<ReleaseMutationBrokerLedgerLookupResultV1> & Record<string, unknown>;
  const errors: string[] = [];
  if (candidate.schema !== 'opl_app_release_mutation_broker_ledger_lookup_result.v2') {
    errors.push('broker ledger lookup result schema is invalid');
  }
  if (typeof candidate.status !== 'string' || !['found', 'not_found', 'outcome_unknown'].includes(candidate.status)) {
    errors.push('broker ledger lookup result status is invalid');
  }
  for (const field of [
    'repository', 'channel', 'version', 'stable_session_id', 'release_cohort_ref', 'attempt_id',
    'mutation_payload_sha256', 'request_sha256', 'challenge',
  ] as const) {
    if (candidate.lookup?.[field] !== lookup[field]) errors.push(`signed broker lookup ${field} is mismatched`);
  }
  const proof = candidate.read_proof;
  if (
    !proof || typeof proof !== 'object' || proof.consistency !== 'linearizable' ||
    !Number.isSafeInteger(proof.ledger_generation) || Number(proof.ledger_generation) < 0 ||
    !Number.isSafeInteger(proof.version_aggregate_revision) || Number(proof.version_aggregate_revision) < 0 ||
    !Number.isSafeInteger(proof.complete_through_sequence) || Number(proof.complete_through_sequence) < 0 ||
    proof.authority_epoch !== authority.authority_epoch ||
    (proof.version_head_attempt_id !== null && !digestRefPattern.test(String(proof.version_head_attempt_id)))
  ) errors.push('signed broker lookup linearizable read proof is malformed');
  const linearized = Date.parse(String(proof?.linearized_at ?? proof?.observed_at));
  const observed = Date.parse(String(proof?.observed_at));
  const expires = Date.parse(String(proof?.expires_at));
  const now = Date.parse(options.now ?? new Date().toISOString());
  if (
    !Number.isFinite(linearized) || !Number.isFinite(observed) || !Number.isFinite(expires) || !Number.isFinite(now) ||
    linearized !== observed || expires <= linearized || expires - linearized > authority.durable_lookup.max_currentness_age_seconds * 1_000 ||
    now < linearized || now >= expires
  ) errors.push('signed broker lookup proof is stale, future-dated, or exceeds the currentness window');
  if (Number(proof?.ledger_generation) < (options.minimumLedgerGeneration ?? 0)) {
    errors.push('signed broker lookup ledger generation regressed');
  }
  if (Number(proof?.version_aggregate_revision) < (options.minimumVersionAggregateRevision ?? 0)) {
    errors.push('signed broker lookup version aggregate revision regressed');
  }
  errors.push(...validateReleaseMutationVersionAggregate(candidate.version_aggregate, lookup, authority, {
    now: options.now,
    minimumLedgerGeneration: options.minimumLedgerGeneration,
    minimumRevision: options.minimumVersionAggregateRevision,
  }));
  errors.push(...validateReleaseLatestMutationHead(candidate.latest_mutation_head, lookup, authority, {
    now: options.now,
    minimumLedgerGeneration: options.minimumLedgerGeneration,
    minimumRevision: options.minimumLatestHeadRevision,
  }));
  if (
    proof?.ledger_generation !== candidate.version_aggregate?.ledger_generation ||
    proof?.ledger_generation !== candidate.latest_mutation_head?.ledger_generation ||
    proof?.authority_epoch !== candidate.version_aggregate?.authority_epoch ||
    proof?.authority_epoch !== candidate.latest_mutation_head?.authority_epoch ||
    proof?.version_aggregate_revision !== candidate.version_aggregate?.revision ||
    proof?.version_head_attempt_id !== candidate.version_aggregate?.head_attempt_id ||
    proof?.complete_through_sequence !== candidate.version_aggregate?.complete_through_sequence ||
    proof?.linearized_at !== candidate.version_aggregate?.linearized_at ||
    proof?.linearized_at !== candidate.latest_mutation_head?.linearized_at ||
    proof?.expires_at !== candidate.version_aggregate?.expires_at ||
    proof?.expires_at !== candidate.latest_mutation_head?.expires_at
  ) errors.push('signed broker lookup proof disagrees with the signed aggregate or global latest head');
  if (
    (options.priorAuthoritativeStatus === 'found' && candidate.status !== 'found') ||
    (options.priorAuthoritativeStatus === 'outcome_unknown' && candidate.status === 'not_found')
  ) errors.push('signed broker lookup attempted to downgrade a durable prior attempt fact');
  const aggregateRecords = Array.isArray(candidate.version_aggregate?.records) ? candidate.version_aggregate.records : [];
  const aggregateRecord = aggregateRecords.find((record) => record.request.attempt_id === lookup.attempt_id);
  if (candidate.status === 'found') {
    const foundRecord = candidate.record as BoundReleaseMutationBrokerLedgerRecordV1 | undefined;
    if (!foundRecord) errors.push('found lookup lacks a bound record');
    else {
      errors.push(...validateReleaseMutationBrokerLedgerRecord(foundRecord, lookup, authority));
      if (!aggregateRecord || canonicalJson(aggregateRecord) !== canonicalJson(foundRecord)) {
        errors.push('found lookup record is absent from the signed complete version aggregate');
      }
    }
  } else if (candidate.status === 'outcome_unknown') {
    const unknownRecord = candidate.record as UnknownReleaseMutationBrokerLedgerRecordV1 | undefined;
    if (!unknownRecord || unknownRecord.mutation_state !== 'outcome_unknown') {
      errors.push('outcome-unknown lookup lacks the exact fenced unknown record');
    } else {
      errors.push(...validateReleaseMutationBrokerLedgerRecord(unknownRecord, lookup, authority));
      if (!aggregateRecord || canonicalJson(aggregateRecord) !== canonicalJson(unknownRecord)) {
        errors.push('outcome-unknown lookup record is absent from the signed complete version aggregate');
      }
    }
  } else if (candidate.status === 'not_found') {
    if (candidate.record !== null) errors.push('not-found lookup must not contain a ledger record');
    if (aggregateRecord) errors.push('not-found lookup contradicts the signed complete version aggregate');
  }
  const { signature, ...payload } = candidate;
  if (
    !signature || typeof signature !== 'object' || signature.algorithm !== 'Ed25519' ||
    typeof signature.key_id !== 'string' || typeof signature.value_base64 !== 'string'
  ) {
    errors.push('signed broker lookup signature is malformed');
  } else {
    const publicKey = authority.trusted_ed25519_public_keys[signature.key_id];
    try {
      if (!publicKey || !crypto.verify(
        null, Buffer.from(canonicalJson(payload)), publicKey, Buffer.from(signature.value_base64, 'base64'),
      )) errors.push('signed broker lookup signature is invalid');
    } catch (error) {
      errors.push(`signed broker lookup signature verification failed safely: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

function ledgerStateIsTerminal(state: ReleaseMutationBrokerLedgerRecordV1['mutation_state']): boolean {
  return ['terminal_succeeded', 'terminal_failed', 'terminal_cancelled'].includes(state);
}

export type ReleaseMutationBrokerAdmissionDecision =
  | {
      action: 'execute_once';
      global_sequence: number | null;
      version_attempt_sequence: number;
      global_predecessor_attempt_id: string | null;
      version_predecessor_attempt_id: string | null;
    }
  | { action: 'return_exact_receipt'; acceptance: ReleaseMutationAcceptanceReceiptV1 }
  | { action: 'reconcile_only'; reason: string }
  | { action: 'reject'; reason: string };

export function decideReleaseMutationBrokerAdmission(
  records: ReleaseMutationBrokerLedgerRecordV1[],
  request: ReleaseMutationBrokerRequestV1,
  proposedLeaseNonce: string,
): ReleaseMutationBrokerAdmissionDecision {
  const requestSha256 = releaseMutationBrokerRequestSha256(request);
  const sameAttempt = records.find((record) => record.request.attempt_id === request.attempt_id);
  if (sameAttempt) {
    if (sameAttempt.request && releaseMutationBrokerRequestSha256(sameAttempt.request) !== requestSha256) {
      return { action: 'reject', reason: 'attempt id already exists with a different request digest' };
    }
    return sameAttempt.acceptance
      ? { action: 'return_exact_receipt', acceptance: sameAttempt.acceptance }
      : { action: 'reconcile_only', reason: 'attempt has a durable pre-API fence but its external outcome is unknown' };
  }
  if (records.some((record) => record.pre_api_fence.nonce_consumption.nonce === proposedLeaseNonce)) {
    return { action: 'reject', reason: 'lease nonce was already consumed by another attempt' };
  }
  const sameVersion = records
    .filter((record) => record.request.idempotency.key === request.idempotency.key)
    .sort((left, right) => left.pre_api_fence.version_aggregate.sequence - right.pre_api_fence.version_aggregate.sequence);
  if (sameVersion.some((record) =>
    record.request.stable_session_id !== request.stable_session_id ||
    record.request.release_cohort_ref !== request.release_cohort_ref
  )) return { action: 'reject', reason: 'version aggregate is already bound to a different stable session or cohort' };
  const versionPrevious = sameVersion.at(-1) ?? null;
  if (versionPrevious && !ledgerStateIsTerminal(versionPrevious.mutation_state) && request.mutation !== 'workflow_cancel') {
    return { action: 'reject', reason: 'version aggregate already has an active different attempt' };
  }
  const promotions = records
    .filter((record) => record.request.mutation === 'promotion_dispatch')
    .sort((left, right) =>
      Number(left.acceptance?.ledger_admission.global_sequence ?? left.pre_api_fence.coordination.global_latest_revision ?? 0) -
      Number(right.acceptance?.ledger_admission.global_sequence ?? right.pre_api_fence.coordination.global_latest_revision ?? 0),
    );
  const latest = promotions.at(-1) ?? null;
  const latestReleasedByCancel = latest !== null && records.some((record) =>
    record.request.mutation === 'workflow_cancel' &&
    record.request.mutation_payload.target_attempt_id === latest.request.attempt_id &&
    record.cancel_transition?.target_terminal_state === 'terminal_cancelled' &&
    record.cancel_transition.latest_readback_completed === true &&
    record.cancel_transition.atomic_with_owner_state_update === true
  );
  if (latest && !ledgerStateIsTerminal(latest.mutation_state) && !latestReleasedByCancel && request.mutation === 'promotion_dispatch') {
    return { action: 'reject', reason: 'cross-version global latest promotion is still active' };
  }
  if (request.mutation === 'workflow_cancel') {
    const target = records.find((record) => record.request.attempt_id === request.mutation_payload.target_attempt_id) ?? null;
    const targetIsCurrentPromotionOwner = target?.request.mutation !== 'promotion_dispatch' || target === latest;
    const isExactEmergencyCancel =
      target !== null && !ledgerStateIsTerminal(target.mutation_state) && target.exact_run_id !== null &&
      request.idempotency.key === target.request.idempotency.key &&
      request.stable_session_id === target.request.stable_session_id &&
      request.release_cohort_ref === target.request.release_cohort_ref &&
      request.github.repository === target.request.github.repository &&
      request.workflow === target.request.workflow && request.artifact_kind === target.request.artifact_kind &&
      request.github.target_run_id === target.exact_run_id &&
      request.mutation_payload.target_run_id === target.exact_run_id && targetIsCurrentPromotionOwner;
    if (!isExactEmergencyCancel) {
      return { action: 'reject', reason: 'emergency cancel is not an exact child of the active promotion owner' };
    }
  }
  return {
    action: 'execute_once',
    global_sequence: request.mutation === 'promotion_dispatch'
      ? Number(latest?.acceptance?.ledger_admission.global_sequence ?? 0) + 1 : null,
    version_attempt_sequence: (versionPrevious?.pre_api_fence.version_aggregate.sequence ?? 0) + 1,
    global_predecessor_attempt_id: request.mutation === 'promotion_dispatch' ? (latest?.request.attempt_id ?? null) : null,
    version_predecessor_attempt_id: versionPrevious?.request.attempt_id ?? null,
  };
}

export function buildReleaseMutationBrokerLedgerSnapshot(input: {
  repository: string;
  records: ReleaseMutationBrokerLedgerRecordV1[];
  challenge?: string;
  ledgerGeneration: number;
  observedAt: string;
  expiresAt?: string;
  keyId: string;
  signingPrivateKeyPem: string;
}): ReleaseMutationBrokerLedgerSnapshotV1 {
  const challenge = input.challenge ?? crypto.randomBytes(16).toString('hex');
  const grouped = new Map<string, ReleaseMutationBrokerLedgerRecordV1[]>();
  for (const record of input.records) {
    const values = grouped.get(record.request.idempotency.key) ?? [];
    values.push(record);
    grouped.set(record.request.idempotency.key, values);
  }
  const versionAggregates = [...grouped.values()].map((records) => {
    const head = [...records].sort((left, right) =>
      left.pre_api_fence.version_aggregate.sequence - right.pre_api_fence.version_aggregate.sequence,
    ).at(-1)!;
    const lookup = buildReleaseMutationBrokerLedgerLookup({
      repository: input.repository, version: head.request.idempotency.version,
      stableSessionId: head.request.stable_session_id, releaseCohortRef: head.request.release_cohort_ref,
      attemptId: head.request.attempt_id, mutationPayloadSha256: head.request.mutation_payload_sha256,
      requestSha256: releaseMutationBrokerRequestSha256(head.request), challenge,
    });
    return buildReleaseMutationVersionAggregate({
      lookup, records, revision: Math.max(...records.map((record) => record.pre_api_fence.version_aggregate.revision)),
      ledgerGeneration: input.ledgerGeneration, linearizedAt: input.observedAt, expiresAt: input.expiresAt,
      keyId: input.keyId, signingPrivateKeyPem: input.signingPrivateKeyPem,
    });
  });
  const representativeLookup = versionAggregates[0]
    ? buildReleaseMutationBrokerLedgerLookup({
        repository: input.repository, version: versionAggregates[0].version,
        stableSessionId: versionAggregates[0].stable_session_id,
        releaseCohortRef: versionAggregates[0].release_cohort_ref,
        attemptId: versionAggregates[0].head_attempt_id!,
        mutationPayloadSha256: versionAggregates[0].records.at(-1)!.request.mutation_payload_sha256,
        requestSha256: releaseMutationBrokerRequestSha256(versionAggregates[0].records.at(-1)!.request), challenge,
      })
    : buildReleaseMutationBrokerLedgerLookup({
        repository: input.repository, version: 'none', stableSessionId: `sha256:${'0'.repeat(64)}`,
        releaseCohortRef: `sha256:${'0'.repeat(64)}`, attemptId: `sha256:${'0'.repeat(64)}`,
        mutationPayloadSha256: `sha256:${'0'.repeat(64)}`, requestSha256: `sha256:${'0'.repeat(64)}`, challenge,
      });
  return {
    schema: 'opl_app_release_mutation_broker_ledger_snapshot.v1', challenge,
    version_aggregates: versionAggregates,
    latest_mutation_head: buildFixtureLatestHead({
      lookup: representativeLookup, records: input.records, ledgerGeneration: input.ledgerGeneration,
      observedAt: input.observedAt, expiresAt: input.expiresAt,
      keyId: input.keyId, signingPrivateKeyPem: input.signingPrivateKeyPem,
    }),
  };
}

export function validateReleaseMutationBrokerLedgerSnapshot(
  snapshot: ReleaseMutationBrokerLedgerSnapshotV1,
  authority: ReleaseBrokerAuthorityV1,
  options: { now?: string; minimumLedgerGeneration?: number; minimumLatestHeadRevision?: number } = {},
): string[] {
  const errors: string[] = [];
  if (!snapshot || typeof snapshot !== 'object' || snapshot.schema !== 'opl_app_release_mutation_broker_ledger_snapshot.v1') {
    return ['signed broker ledger snapshot is missing or malformed'];
  }
  if (!/^[0-9a-f]{32}$/.test(String(snapshot.challenge))) errors.push('broker ledger snapshot challenge is invalid');
  if (!Array.isArray(snapshot.version_aggregates)) return [...errors, 'broker ledger version aggregates are malformed'];
  const records = snapshot.version_aggregates.flatMap((aggregate) => aggregate.records ?? []);
  const aggregateKeys = new Set<string>();
  for (const aggregate of snapshot.version_aggregates) {
    const key = `${aggregate.repository}:${aggregate.channel}:${aggregate.version}`;
    if (aggregateKeys.has(key)) errors.push(`broker ledger contains duplicate version aggregate ${key}`);
    aggregateKeys.add(key);
    const headRecord = aggregate.records.at(-1);
    const lookup = buildReleaseMutationBrokerLedgerLookup({
      repository: aggregate.repository, version: aggregate.version,
      stableSessionId: aggregate.stable_session_id, releaseCohortRef: aggregate.release_cohort_ref,
      attemptId: headRecord?.request.attempt_id ?? `sha256:${'0'.repeat(64)}`,
      mutationPayloadSha256: headRecord?.request.mutation_payload_sha256 ?? `sha256:${'0'.repeat(64)}`,
      requestSha256: headRecord ? releaseMutationBrokerRequestSha256(headRecord.request) : `sha256:${'0'.repeat(64)}`,
      challenge: snapshot.challenge,
    });
    errors.push(...validateReleaseMutationVersionAggregate(aggregate, lookup, authority, {
      now: options.now, minimumLedgerGeneration: options.minimumLedgerGeneration,
    }));
  }
  const representative = snapshot.version_aggregates[0];
  const headLookup = buildReleaseMutationBrokerLedgerLookup({
    repository: representative?.repository ?? snapshot.latest_mutation_head.repository,
    version: representative?.version ?? 'none',
    stableSessionId: representative?.stable_session_id ?? `sha256:${'0'.repeat(64)}`,
    releaseCohortRef: representative?.release_cohort_ref ?? `sha256:${'0'.repeat(64)}`,
    attemptId: representative?.head_attempt_id ?? `sha256:${'0'.repeat(64)}`,
    mutationPayloadSha256: representative?.records.at(-1)?.request.mutation_payload_sha256 ?? `sha256:${'0'.repeat(64)}`,
    requestSha256: representative?.records.at(-1)
      ? releaseMutationBrokerRequestSha256(representative.records.at(-1)!.request) : `sha256:${'0'.repeat(64)}`,
    challenge: snapshot.challenge,
  });
  errors.push(...validateReleaseLatestMutationHead(snapshot.latest_mutation_head, headLookup, authority, {
    now: options.now, minimumLedgerGeneration: options.minimumLedgerGeneration,
    minimumRevision: options.minimumLatestHeadRevision,
  }));
  const attemptIds = new Set<string>();
  const nonceOwners = new Map<string, string>();
  for (const record of records) {
    errors.push(...validateReleaseMutationBrokerLedgerRecord(record, record.lookup, authority));
    const attemptId = record.request.attempt_id;
    if (attemptIds.has(attemptId)) errors.push(`broker ledger contains duplicate attempt ${attemptId}`);
    attemptIds.add(attemptId);
    const nonce = record.pre_api_fence.nonce_consumption.nonce;
    const owner = nonceOwners.get(nonce);
    if (owner && owner !== attemptId) errors.push(`broker lease nonce ${nonce} was consumed by multiple attempts`);
    nonceOwners.set(nonce, attemptId);
  }

  const globallyOrdered = records
    .filter((record) => record.pre_api_fence.coordination.scope === 'latest_promotion')
    .sort((left, right) =>
      Number(left.pre_api_fence.coordination.global_latest_revision) -
      Number(right.pre_api_fence.coordination.global_latest_revision),
    );
  for (let index = 0; index < globallyOrdered.length; index += 1) {
    const record = globallyOrdered[index];
    const revision = record.pre_api_fence.coordination.global_latest_revision;
    const previous = globallyOrdered[index - 1] ?? null;
    const previousRevision = previous?.pre_api_fence.coordination.global_latest_revision ?? null;
    if (index > 0 && Number(revision) <= Number(previousRevision)) errors.push('broker global latest revisions are not strictly monotonic');
    if (
      record.acceptance &&
      record.acceptance.ledger_admission.global_predecessor_attempt_id !== (previous?.request.attempt_id ?? null)
    ) {
      errors.push(`broker global predecessor is invalid for attempt ${record.request.attempt_id}`);
    }
    if (!previous) continue;
    const terminalCancel = records.some((candidate) =>
      candidate.request.mutation === 'workflow_cancel' &&
      candidate.request.mutation_payload.target_attempt_id === previous.request.attempt_id &&
      candidate.cancel_transition?.latest_readback_completed === true
    );
    if (!ledgerStateIsTerminal(previous.mutation_state) && !terminalCancel) {
      errors.push('broker admitted a new mutation while the cross-version global latest mutation was active');
    }
  }

  for (const cancel of records.filter((record) => record.pre_api_fence.coordination.scope === 'emergency_cancel')) {
    const owner = records.find((record) => record.request.attempt_id === cancel.pre_api_fence.coordination.target_attempt_id);
    const promotionRevisionMatches = owner?.request.mutation !== 'promotion_dispatch' ||
      cancel.pre_api_fence.coordination.global_latest_revision === owner.pre_api_fence.coordination.global_latest_revision;
    if (
      !owner ||
      cancel.request.idempotency.key !== owner.request.idempotency.key ||
      cancel.request.stable_session_id !== owner.request.stable_session_id ||
      cancel.request.release_cohort_ref !== owner.request.release_cohort_ref ||
      cancel.request.github.target_run_id !== owner.exact_run_id ||
      cancel.request.workflow !== owner.request.workflow || cancel.request.artifact_kind !== owner.request.artifact_kind ||
      !promotionRevisionMatches ||
      (owner.request.mutation === 'promotion_dispatch' &&
        cancel.pre_api_fence.coordination.owner_fence_token !== owner.pre_api_fence.coordination.fence_token) ||
      ledgerStateIsTerminal(owner.mutation_state)
    ) errors.push('emergency cancel is not the distinct exact child of its active global mutation owner');
    if (
      cancel.cancel_transition?.latest_readback_completed === false && snapshot.latest_mutation_head.state === 'free'
    ) errors.push('cancel API acceptance released the global latest mutex before terminal target readback');
  }

  const byVersion = new Map<string, ReleaseMutationBrokerLedgerRecordV1[]>();
  for (const record of records) {
    const values = byVersion.get(record.request.idempotency.key) ?? [];
    values.push(record);
    byVersion.set(record.request.idempotency.key, values);
  }
  for (const values of byVersion.values()) {
    values.sort((left, right) =>
      left.pre_api_fence.version_aggregate.sequence - right.pre_api_fence.version_aggregate.sequence,
    );
    for (let index = 0; index < values.length; index += 1) {
      const admission = values[index].pre_api_fence.version_aggregate;
      const previous = values[index - 1] ?? null;
      if (index > 0 && admission.sequence !== previous!.pre_api_fence.version_aggregate.sequence + 1) {
        errors.push(`broker version attempt sequence is not contiguous for ${values[index].request.idempotency.key}`);
      }
      if (admission.predecessor_attempt_id !== (previous?.request.attempt_id ?? null)) {
        errors.push(`broker version predecessor is invalid for attempt ${values[index].request.attempt_id}`);
      }
      if (
        previous && !ledgerStateIsTerminal(previous.mutation_state) &&
        values[index].request.mutation !== 'workflow_cancel'
      ) errors.push(`broker admitted a new version attempt while ${previous.request.attempt_id} was active`);
    }
  }
  const expectedHead = deriveLatestMutationHead(records, snapshot.latest_mutation_head.linearized_at);
  if (
    snapshot.latest_mutation_head.state !== expectedHead.state ||
    canonicalJson(snapshot.latest_mutation_head.owner) !== canonicalJson(expectedHead.owner) ||
    snapshot.latest_mutation_head.terminal_release?.owner_attempt_id !== expectedHead.terminal_release?.owner_attempt_id ||
    snapshot.latest_mutation_head.terminal_release?.owner_terminal_state !== expectedHead.terminal_release?.owner_terminal_state
  ) errors.push('signed global latest mutation head does not match the complete ledger snapshot');
  return errors;
}

type ReleaseMutationBrokerCommandV1 =
  | { schema: 'opl_app_release_mutation_broker_command.v1'; operation: 'submit'; request: ReleaseMutationBrokerRequestV1 }
  | { schema: 'opl_app_release_mutation_broker_command.v1'; operation: 'lookup'; lookup: ReleaseMutationBrokerLedgerLookupV1 };

function executeExternalReleaseBrokerCommand(commandPayload: ReleaseMutationBrokerCommandV1): unknown {
  const authority = readReleaseBrokerAuthority();
  const authorityErrors = validateReleaseBrokerAuthority(authority, {
    capability: commandPayload.operation === 'lookup' ? 'ledger_lookup' : 'mutation_submit',
  });
  if (authorityErrors.length > 0) throw new Error(`Release mutation broker authority is not ready: ${authorityErrors.join('; ')}`);
  const command = authority.mutation_broker.executable_path;
  const expectedDigest = authority.mutation_broker.executable_sha256;
  if (!command || !path.isAbsolute(command) || !expectedDigest || !fs.existsSync(command)) {
    throw new Error('Release mutation broker executable is not provisioned by canonical authority.');
  }
  if (process.platform !== 'darwin') throw new Error('Provisioned release mutation broker execution requires macOS code-sign verification.');
  const openFlags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
  const brokerFd = fs.openSync(command, openFlags);
  try {
    const stat = fs.fstatSync(brokerFd);
    if (!stat.isFile()) throw new Error('Release mutation broker endpoint is not a regular file.');
    if ((stat.mode & 0o022) !== 0) throw new Error('Release mutation broker endpoint is group/world writable.');
    const actualDigest = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(brokerFd)).digest('hex')}`;
    if (actualDigest !== expectedDigest) throw new Error('Release mutation broker executable digest does not match canonical authority.');

    const verify = spawnSync('/usr/bin/codesign', ['--verify', '--strict', '--verbose=2', '/dev/fd/3'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe', brokerFd], timeout: 10_000, maxBuffer: 1024 * 1024,
    });
    if (verify.status !== 0) throw new Error(`Release mutation broker code signature is invalid: ${(verify.stderr || verify.stdout).trim()}`);
    const inspect = spawnSync('/usr/bin/codesign', ['--display', '--verbose=4', '/dev/fd/3'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe', brokerFd], timeout: 10_000, maxBuffer: 1024 * 1024,
    });
    const codeSignOutput = `${inspect.stdout}\n${inspect.stderr}`;
    if (inspect.status !== 0 || !codeSignOutput.split(/\r?\n/).includes(`Identifier=${authority.mutation_broker.executable_codesign_identity}`)) {
      throw new Error('Release mutation broker code-sign identity does not match canonical authority.');
    }

    const result = spawnSync('/dev/fd/3', [], {
      input: `${JSON.stringify(commandPayload)}\n`,
      encoding: 'utf8',
      env: {
        OPL_RELEASE_BROKER_PROTOCOL_VERSION: '1',
        OPL_RELEASE_BROKER_OPERATION: commandPayload.operation,
      },
      stdio: ['pipe', 'pipe', 'pipe', brokerFd],
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    if (result.error && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      throw new Error('Release mutation broker timed out; lookup the durable broker ledger before any retry.');
    }
    if (result.status !== 0) {
      throw new Error(`Release mutation broker failed: ${(result.stderr || result.stdout || 'no broker response').trim()}`);
    }
    try {
      return JSON.parse(result.stdout) as unknown;
    } catch (error) {
      throw new Error(`Release mutation broker returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  } finally {
    fs.closeSync(brokerFd);
  }
}

export function externalReleaseMutationBroker(
  request: ReleaseMutationBrokerRequestV1,
): ReleaseMutationAcceptanceReceiptV1 {
  return executeExternalReleaseBrokerCommand({
    schema: 'opl_app_release_mutation_broker_command.v1', operation: 'submit', request,
  }) as ReleaseMutationAcceptanceReceiptV1;
}

export function externalReleaseMutationBrokerLedgerLookup(
  lookup: ReleaseMutationBrokerLedgerLookupV1,
): ReleaseMutationBrokerLedgerLookupResultV1 {
  const errors = validateLedgerLookup(lookup);
  if (errors.length > 0) throw new Error(`Invalid broker ledger lookup: ${errors.join('; ')}`);
  const response = executeExternalReleaseBrokerCommand({
    schema: 'opl_app_release_mutation_broker_command.v1', operation: 'lookup', lookup,
  });
  const authority = readReleaseBrokerAuthority();
  const responseErrors = validateReleaseMutationBrokerLedgerLookupResult(response, lookup, authority);
  if (responseErrors.length > 0) {
    throw new Error(`Invalid signed broker lookup result: ${responseErrors.join('; ')}`);
  }
  return response as ReleaseMutationBrokerLedgerLookupResultV1;
}
