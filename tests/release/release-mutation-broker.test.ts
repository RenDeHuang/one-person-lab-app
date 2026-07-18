import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  buildCredentialIsolationReceipt,
  readReleaseBrokerAuthority,
  releaseBrokerAuthoritySha256,
  resolveHistoricalReleaseBrokerAuthority,
  validateReleaseBrokerAuthority,
  type ReleaseBrokerAuthorityV1,
} from '../../scripts/release-broker-authority.ts';
import {
  buildReleaseMutationAcceptanceReceipt,
  buildReleaseMutationBrokerLedgerFound,
  buildReleaseMutationBrokerLedgerLookup,
  buildReleaseMutationBrokerLedgerNotFound,
  buildReleaseMutationBrokerLedgerOutcomeUnknown,
  buildReleaseMutationBrokerLedgerRecord,
  buildReleaseMutationBrokerLedgerSnapshot,
  decideReleaseMutationBrokerAdmission,
  externalReleaseMutationBrokerLedgerLookup,
  releaseMutationBrokerRequestSha256,
  validateHistoricalReleaseMutationAcceptanceReceipt,
  validateReleaseMutationAcceptanceReceipt,
  validateReleaseMutationBrokerLedgerLookupResult,
  validateReleaseMutationBrokerLedgerSnapshot,
  validateReleaseMutationBrokerRequest,
  validateReleaseMutationPreApiFence,
  type ReleaseMutationBrokerLedgerRecordV1,
  type ReleaseMutationBrokerRequestV1,
} from '../../scripts/release-mutation-broker.ts';
import {
  remoteWorkflowBrokerLookup,
  verifyBrokerLookupResult,
  verifyHistoricalBrokerValidation,
  type BrokerAcceptanceExpectedIdentity,
} from '../../scripts/verify-release-broker-acceptance.ts';
import { releaseMutationPayloadSha256 } from '../../scripts/release-mutation-payload.ts';
import { buildReleaseSessionLease } from '../../scripts/release-session-lease.ts';

const keys = crypto.generateKeyPairSync('ed25519');
const privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const digest = (value: string) => `sha256:${value.repeat(64)}`;
const sha = (value: string) => value.repeat(40);
const bytesSha = (value: string | Buffer) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;

const canonicalAuthority = readReleaseBrokerAuthority();
const authority: ReleaseBrokerAuthorityV1 = {
  ...canonicalAuthority,
  status: 'provisioned',
  authority_epoch: 1,
  authority_epoch: 1,
  mutation_broker: {
    ...canonicalAuthority.mutation_broker,
    protocol_version: 1, executable_path: '/usr/local/libexec/opl-release-broker-test',
    executable_sha256: `sha256:${'e'.repeat(64)}`, executable_codesign_identity: 'test.release-broker',
    approved_controller_workflow_shas: [sha('d')],
  },
  workflow_lookup: {
    ...canonicalAuthority.workflow_lookup,
    endpoint_url: 'https://release-broker.example.test/v2/lookup',
    oidc_audience: 'opl-release-broker',
  },
  trusted_ed25519_public_keys: { test: publicKeyPem },
  credential_isolation: {
    ...canonicalAuthority.credential_isolation,
    observed: {
      normal_codex_actions_write_allowed: false,
      release_broker_actions_write_token_isolated: true,
      normal_codex_protected_main_push_allowed: false,
      normal_codex_release_control_plane_write_allowed: false,
      normal_codex_ruleset_bypass_allowed: false,
      normal_codex_required_review_bypass_allowed: false,
    },
  },
};

const isolation = buildCredentialIsolationReceipt({
  authority, observedAt: '2026-07-18T00:00:00.000Z', expiresAt: '2026-07-18T00:15:00.000Z',
  normalActor: 'codex-read-only', normalTokenFingerprint: `sha256:${'1'.repeat(64)}`,
  brokerActor: 'opl-release-broker[bot]', brokerTokenFingerprint: `sha256:${'2'.repeat(64)}`,
  brokerBackend: 'github-app', brokerEndpointPath: authority.mutation_broker.executable_path,
  brokerEndpointSha256: authority.mutation_broker.executable_sha256!,
  brokerEndpointCodesignIdentity: authority.mutation_broker.executable_codesign_identity!,
  privateKeyBackend: 'keychain', callerAdmissionBackend: 'xpc-peer-credential',
  operatorActor: 'gaofeng21cn', operatorIdentitySource: 'broker_authenticated_caller',
  keyId: 'test', signingPrivateKeyPem: privateKeyPem,
});

function qualificationRequest(input: { version?: string; attemptChar?: string; sessionChar?: string } = {}): ReleaseMutationBrokerRequestV1 {
  const version = input.version ?? '26.7.18';
  const sessionId = digest(input.sessionChar ?? 'a');
  const cohortRef = digest(input.sessionChar ?? 'b');
  const payload = {
    release_tag: `v${version}`, package_profile: 'standard', diagnostic_scope: 'release_gate',
    release_artifact_name: 'macos-build-arm64-dmg', release_artifact_run_id: '90',
    standard_admission_deadline_at: '2026-07-18T01:30:00.000Z',
    stable_session_id: sessionId, release_cohort_ref: cohortRef, artifact_app_ref: sha('a'),
    shell_ref: sha('b'), smoke_harness_ref: sha('b'), framework_ref: sha('c'), operator_actor: 'gaofeng21cn',
  };
  return {
    schema: 'opl_app_release_mutation_broker_request.v1', stable_session_id: sessionId,
    release_cohort_ref: cohortRef, operator_actor: 'gaofeng21cn', attempt_id: digest(input.attemptChar ?? 'c'),
    planned_session_revision: 1, mutation: 'qualification_dispatch', workflow: 'opl-first-run-vm.yml',
    artifact_kind: 'standard', controller_workflow_sha: sha('d'), artifact_app_sha: sha('a'),
    mutation_payload: payload, mutation_payload_sha256: releaseMutationPayloadSha256(payload),
    idempotency: {
      key: `gaofeng21cn/one-person-lab-app:stable:${version}`, channel: 'stable', version,
      same_attempt_returns_same_receipt: true, conflicting_session_or_cohort_rejected: true,
      concurrent_different_attempt_rejected: true,
    },
    credential_isolation_receipt: isolation,
    github: { repository: 'gaofeng21cn/one-person-lab-app', operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
  };
}

function promotionRequest(input: { version?: string; attemptChar?: string; sessionChar?: string } = {}): ReleaseMutationBrokerRequestV1 {
  const version = input.version ?? '26.7.18';
  const sessionId = digest(input.sessionChar ?? 'a');
  const cohortRef = digest(input.sessionChar ?? 'b');
  const payload = {
    opl_version: version, release_set_generation: 'generation-1', release_run_id: '90',
    stable_session_id: sessionId, release_cohort_ref: cohortRef,
    standard_admission_deadline_at: '2026-07-18T01:30:00.000Z', artifact_app_sha: sha('a'),
    standard_vm_run_id: '91', release_owner_receipt_ref: digest('9'), shell_ref: sha('b'),
    operator_actor: 'gaofeng21cn', framework_ref: sha('c'), resume_from_checkpoint: 'release_public_nonlatest',
  };
  return {
    schema: 'opl_app_release_mutation_broker_request.v1', stable_session_id: sessionId,
    release_cohort_ref: cohortRef, operator_actor: 'gaofeng21cn', attempt_id: digest(input.attemptChar ?? '7'),
    planned_session_revision: 1, mutation: 'promotion_dispatch', workflow: 'desktop-release-promote.yml',
    artifact_kind: 'promotion', controller_workflow_sha: sha('d'), artifact_app_sha: sha('a'),
    mutation_payload: payload, mutation_payload_sha256: releaseMutationPayloadSha256(payload),
    idempotency: {
      key: `gaofeng21cn/one-person-lab-app:stable:${version}`, channel: 'stable', version,
      same_attempt_returns_same_receipt: true, conflicting_session_or_cohort_rejected: true,
      concurrent_different_attempt_rejected: true,
    },
    credential_isolation_receipt: isolation,
    github: { repository: 'gaofeng21cn/one-person-lab-app', operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
  };
}

function fullAddonRequest(input: {
  version?: string;
  attemptChar?: string;
  sessionChar?: string;
  standardDeadlineAt?: string;
} = {}): ReleaseMutationBrokerRequestV1 {
  const version = input.version ?? '26.7.18';
  const sessionId = digest(input.sessionChar ?? 'a');
  const cohortRef = digest(input.sessionChar ?? 'b');
  const payload = {
    opl_version: version, stable_session_id: sessionId, release_cohort_ref: cohortRef,
    app_sha: sha('a'), shell_sha: sha('b'), framework_sha: sha('c'),
    release_set_generation: 'generation-1', release_set_manifest_digest: digest('8'),
    force_rebuild_runtime_cache: 'false', operator_actor: 'gaofeng21cn',
    standard_admission_deadline_at: input.standardDeadlineAt ?? '2026-07-18T00:00:45.000Z',
  };
  return {
    schema: 'opl_app_release_mutation_broker_request.v1', stable_session_id: sessionId,
    release_cohort_ref: cohortRef, operator_actor: 'gaofeng21cn', attempt_id: digest(input.attemptChar ?? '6'),
    planned_session_revision: 1, mutation: 'full_addon_dispatch', workflow: 'desktop-release-full-addon.yml',
    artifact_kind: 'full', controller_workflow_sha: sha('d'), artifact_app_sha: sha('a'),
    mutation_payload: payload, mutation_payload_sha256: releaseMutationPayloadSha256(payload),
    idempotency: {
      key: `gaofeng21cn/one-person-lab-app:stable:${version}`, channel: 'stable', version,
      same_attempt_returns_same_receipt: true, conflicting_session_or_cohort_rejected: true,
      concurrent_different_attempt_rejected: true,
    },
    credential_isolation_receipt: isolation,
    github: {
      repository: 'gaofeng21cn/one-person-lab-app', operation: 'workflow_dispatch',
      workflow_ref: 'refs/heads/main', target_run_id: null,
    },
  };
}

function recordFor(input: {
  request?: ReleaseMutationBrokerRequestV1; runId?: string; nonce?: string; globalSequence?: number;
  versionSequence?: number; globalPredecessor?: string | null; versionPredecessor?: string | null;
  state?: ReleaseMutationBrokerLedgerRecordV1['mutation_state'];
  ownerFenceToken?: string | null;
  cancelTransition?: Parameters<typeof buildReleaseMutationBrokerLedgerRecord>[0]['cancelTransition'];
} = {}): ReleaseMutationBrokerLedgerRecordV1 {
  const request = input.request ?? qualificationRequest();
  const lease = buildReleaseSessionLease({
    stableSessionId: request.stable_session_id, releaseCohortRef: request.release_cohort_ref,
    repository: request.github.repository, operatorActor: request.operator_actor,
    brokerActor: authority.broker_identity.github_actor, attemptId: request.attempt_id,
    workflow: request.workflow, artifactKind: request.artifact_kind,
    controllerWorkflowSha: request.controller_workflow_sha, artifactAppSha: request.artifact_app_sha,
    mutationPayloadSha256: request.mutation_payload_sha256, plannedSessionRevision: request.planned_session_revision,
    mutation: request.mutation, issuedAt: '2026-07-18T00:00:30.000Z', ttlMs: 120_000,
    targetAttemptId: request.mutation === 'workflow_cancel' ? request.mutation_payload.target_attempt_id : undefined,
    targetRunId: request.mutation === 'workflow_cancel' ? request.github.target_run_id ?? undefined : undefined,
    nonce: input.nonce ?? '1'.repeat(32), signingPrivateKeyPem: privateKeyPem, keyId: 'test',
  });
  const acceptance = buildReleaseMutationAcceptanceReceipt({
    request, lease, acceptedAt: '2026-07-18T00:01:00.000Z', brokerActor: authority.broker_identity.github_actor,
    brokerTokenFingerprint: `sha256:${'2'.repeat(64)}`, requestId: `request-${request.attempt_id.slice(-8)}`,
    runId: input.runId ?? '101', globalSequence: input.globalSequence ?? 1,
    versionAttemptSequence: input.versionSequence ?? 1,
    globalPredecessorAttemptId: input.globalPredecessor ?? null,
    versionPredecessorAttemptId: input.versionPredecessor ?? null,
    ownerFenceToken: input.ownerFenceToken,
    keyId: 'test', signingPrivateKeyPem: privateKeyPem, credentialIsolationReceipt: isolation,
  });
  const lookup = buildReleaseMutationBrokerLedgerLookup({
    repository: request.github.repository, version: request.idempotency.version,
    stableSessionId: request.stable_session_id, releaseCohortRef: request.release_cohort_ref,
    attemptId: request.attempt_id, mutationPayloadSha256: request.mutation_payload_sha256,
    requestSha256: releaseMutationBrokerRequestSha256(request),
  });
  return buildReleaseMutationBrokerLedgerRecord({
    lookup, request, acceptance, recordedAt: '2026-07-18T00:01:01.000Z',
    mutationState: input.state ?? 'run_bound', exactRunId: input.runId ?? '101',
    cancelTransition: input.cancelTransition,
    keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
}

test('canonical authority stays unprovisioned while requiring durable global broker controls', () => {
  const canonical = readReleaseBrokerAuthority();
  assert.equal(canonical.status, 'unprovisioned_release_blocking');
  assert.equal(canonical.global_idempotency_ledger.global_latest_mutation_cross_version_mutex, true);
  assert.equal(canonical.global_idempotency_ledger.nonce_single_use_enforced, true);
  assert.equal(canonical.mutation_broker.verified_open_file_descriptor_execution_required, true);
  assert.deepEqual(validateReleaseBrokerAuthority(canonical, { requireProvisioned: false }), []);
  assert.match(validateReleaseBrokerAuthority(canonical).join('; '), /not provisioned/);
  assert.match(fs.readFileSync('scripts/release-mutation-broker.ts', 'utf8'), /spawnSync\('\/dev\/fd\/3'/);
});

test('acceptance exact run identity and admission freshness are separate from historical validity', () => {
  const record = recordFor();
  assert.deepEqual(validateReleaseMutationBrokerRequest(record.request, authority, '2026-07-18T00:01:00.000Z'), []);
  assert.deepEqual(validateHistoricalReleaseMutationAcceptanceReceipt(record.acceptance, record.request, authority), []);
  assert.match(
    validateReleaseMutationAcceptanceReceipt(record.acceptance, record.request, authority, '2026-07-19T00:01:00.000Z').join('; '),
    /not fresh at admission readback/,
  );
  for (const runId of [null, '0', 'not-a-run']) {
    const tampered = structuredClone(record.acceptance) as unknown as Record<string, any>;
    tampered.github.run_id = runId;
    assert.match(validateHistoricalReleaseMutationAcceptanceReceipt(tampered, record.request, authority).join('; '), /GitHub mutation acceptance identity/);
  }
  const missingField = structuredClone(record.request);
  delete missingField.mutation_payload.release_artifact_run_id;
  missingField.mutation_payload_sha256 = releaseMutationPayloadSha256(missingField.mutation_payload);
  assert.match(validateReleaseMutationBrokerRequest(missingField, authority, '2026-07-18T00:01:00.000Z').join('; '), /release_artifact_run_id is required/);
  const missingDeadline = structuredClone(record.request);
  delete missingDeadline.mutation_payload.standard_admission_deadline_at;
  missingDeadline.mutation_payload_sha256 = releaseMutationPayloadSha256(missingDeadline.mutation_payload);
  assert.match(
    validateReleaseMutationBrokerRequest(missingDeadline, authority, '2026-07-18T00:01:00.000Z').join('; '),
    /standard_admission_deadline_at is required/,
  );
  const selfAsserted = structuredClone(record.request);
  selfAsserted.operator_actor = 'someone-else';
  selfAsserted.mutation_payload.operator_actor = 'someone-else';
  selfAsserted.mutation_payload_sha256 = releaseMutationPayloadSha256(selfAsserted.mutation_payload);
  assert.match(validateReleaseMutationBrokerRequest(selfAsserted, authority, '2026-07-18T00:01:00.000Z').join('; '), /canonical operator/);
});

test('Full add-on keeps the Standard deadline as identity but uses broker-derived signed 50-minute clocks', () => {
  const request = fullAddonRequest();
  assert.deepEqual(validateReleaseMutationBrokerRequest(request, authority, '2026-07-18T00:00:40.000Z'), []);
  assert.deepEqual(validateReleaseMutationBrokerRequest(request, authority, '2026-07-18T00:01:00.000Z'), []);

  const standard = qualificationRequest();
  standard.mutation_payload.standard_admission_deadline_at = '2026-07-18T00:00:45.000Z';
  standard.mutation_payload_sha256 = releaseMutationPayloadSha256(standard.mutation_payload);
  assert.deepEqual(validateReleaseMutationBrokerRequest(standard, authority, '2026-07-18T00:00:40.000Z'), []);
  assert.match(
    validateReleaseMutationBrokerRequest(standard, authority, '2026-07-18T00:01:00.000Z').join('; '),
    /reached the Standard admission deadline/,
  );

  const lease = buildReleaseSessionLease({
    stableSessionId: request.stable_session_id, releaseCohortRef: request.release_cohort_ref,
    repository: request.github.repository, operatorActor: request.operator_actor,
    brokerActor: authority.broker_identity.github_actor, attemptId: request.attempt_id,
    workflow: request.workflow, artifactKind: request.artifact_kind,
    controllerWorkflowSha: request.controller_workflow_sha, artifactAppSha: request.artifact_app_sha,
    mutationPayloadSha256: request.mutation_payload_sha256, plannedSessionRevision: request.planned_session_revision,
    mutation: request.mutation, issuedAt: '2026-07-18T00:00:30.000Z', ttlMs: 120_000,
    nonce: 'a'.repeat(32), signingPrivateKeyPem: privateKeyPem, keyId: 'test',
  });
  const acceptance = buildReleaseMutationAcceptanceReceipt({
    request, lease, fencePersistedAt: '2026-07-18T00:00:50.000Z', acceptedAt: '2026-07-18T00:01:00.000Z',
    brokerActor: authority.broker_identity.github_actor, brokerTokenFingerprint: `sha256:${'2'.repeat(64)}`,
    requestId: 'request-full-addon', runId: '401', keyId: 'test', signingPrivateKeyPem: privateKeyPem,
    credentialIsolationReceipt: isolation,
  });
  assert.equal(acceptance.pre_api_fence.full_addon_deadline_at, '2026-07-18T00:50:50.000Z');
  assert.equal(acceptance.full_addon_deadline_at, '2026-07-18T00:51:00.000Z');
  assert.deepEqual(validateHistoricalReleaseMutationAcceptanceReceipt(acceptance, request, authority), []);

  const tamperedFence = structuredClone(acceptance.pre_api_fence);
  tamperedFence.full_addon_deadline_at = '2026-07-18T00:51:50.000Z';
  assert.match(
    validateReleaseMutationPreApiFence(tamperedFence, request, authority).join('; '),
    /not broker-derived|signature is invalid/,
  );
  const tamperedAcceptance = structuredClone(acceptance);
  tamperedAcceptance.full_addon_deadline_at = '2026-07-18T00:52:00.000Z';
  assert.match(
    validateHistoricalReleaseMutationAcceptanceReceipt(tamperedAcceptance, request, authority).join('; '),
    /not broker-derived|signature is invalid/,
  );

  const lookup = buildReleaseMutationBrokerLedgerLookup({
    repository: request.github.repository, version: request.idempotency.version,
    stableSessionId: request.stable_session_id, releaseCohortRef: request.release_cohort_ref,
    attemptId: request.attempt_id, mutationPayloadSha256: request.mutation_payload_sha256,
    requestSha256: releaseMutationBrokerRequestSha256(request), challenge: 'b'.repeat(32),
  });
  const record = buildReleaseMutationBrokerLedgerRecord({
    lookup, request, acceptance, recordedAt: '2026-07-18T00:01:01.000Z',
    mutationState: 'run_bound', exactRunId: '401', keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  const expected: BrokerAcceptanceExpectedIdentity = {
    repository: request.github.repository, runId: '401', runAttempt: 1,
    workflow: request.workflow, workflowSha: request.controller_workflow_sha,
    payloadSha256: request.mutation_payload_sha256, attemptId: request.attempt_id,
  };
  const beforeDeadline = buildReleaseMutationBrokerLedgerFound({
    lookup, record, observedAt: '2026-07-18T00:50:40.000Z', expiresAt: '2026-07-18T00:51:10.000Z',
    ledgerGeneration: 1, versionAggregateRevision: 1, authorityEpoch: authority.authority_epoch,
    keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  const artifact = verifyBrokerLookupResult({
    authority, fence: acceptance.pre_api_fence, expected, result: beforeDeadline,
    verifiedAt: '2026-07-18T00:50:45.000Z', expectedChallenge: lookup.challenge,
  });
  assert.equal(artifact.full_addon_deadline_at, acceptance.full_addon_deadline_at);

  const afterDeadline = buildReleaseMutationBrokerLedgerFound({
    lookup, record, observedAt: '2026-07-18T00:51:00.000Z', expiresAt: '2026-07-18T00:51:30.000Z',
    ledgerGeneration: 1, versionAggregateRevision: 1, authorityEpoch: authority.authority_epoch,
    keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  assert.throws(() => verifyBrokerLookupResult({
    authority, fence: acceptance.pre_api_fence, expected, result: afterDeadline,
    verifiedAt: '2026-07-18T00:51:01.000Z', expectedChallenge: lookup.challenge,
  }), /reached the signed Full add-on deadline/);
});

test('ledger snapshot permits independent version-scoped work, rejects nonce reuse, and admits an exact-target cancel', () => {
  const first = recordFor({ state: 'run_bound', nonce: '1'.repeat(32) });
  const replay = decideReleaseMutationBrokerAdmission([first], first.request, '9'.repeat(32));
  assert.equal(replay.action, 'return_exact_receipt');
  if (replay.action === 'return_exact_receipt') assert.deepEqual(replay.acceptance, first.acceptance);
  const conflictingRequest = structuredClone(first.request);
  conflictingRequest.mutation_payload.release_artifact_name = 'different-artifact';
  conflictingRequest.mutation_payload_sha256 = releaseMutationPayloadSha256(conflictingRequest.mutation_payload);
  assert.equal(decideReleaseMutationBrokerAdmission([first], conflictingRequest, '9'.repeat(32)).action, 'reject');
  const secondRequest = qualificationRequest({ version: '26.7.19', attemptChar: 'd', sessionChar: 'e' });
  const overlapping = recordFor({
    request: secondRequest, runId: '102', nonce: '2'.repeat(32), globalSequence: 2,
    globalPredecessor: first.request.attempt_id,
  });
  const overlappingSnapshot = buildReleaseMutationBrokerLedgerSnapshot({
    repository: first.request.github.repository, records: [first, overlapping], ledgerGeneration: 2,
    observedAt: '2026-07-18T00:02:00.000Z', keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  assert.deepEqual(validateReleaseMutationBrokerLedgerSnapshot(
    overlappingSnapshot, authority, { now: '2026-07-18T00:02:01.000Z' },
  ), []);

  const reusedNonce = recordFor({
    request: secondRequest, runId: '102', nonce: '1'.repeat(32), globalSequence: 2,
    globalPredecessor: first.request.attempt_id,
  });
  const nonceSnapshot = buildReleaseMutationBrokerLedgerSnapshot({
    repository: first.request.github.repository, records: [first, reusedNonce], ledgerGeneration: 2,
    observedAt: '2026-07-18T00:02:00.000Z', keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  assert.match(validateReleaseMutationBrokerLedgerSnapshot(
    nonceSnapshot, authority, { now: '2026-07-18T00:02:01.000Z' },
  ).join('; '), /consumed by multiple attempts/);

  const cancelPayload = {
    opl_version: first.request.idempotency.version, stable_session_id: first.request.stable_session_id,
    release_cohort_ref: first.request.release_cohort_ref, target_attempt_id: first.request.attempt_id,
    target_run_id: first.exact_run_id,
    reason: 'operator emergency stop', operator_actor: 'gaofeng21cn',
  };
  const cancelRequest: ReleaseMutationBrokerRequestV1 = {
    ...first.request, attempt_id: digest('f'), mutation: 'workflow_cancel', mutation_payload: cancelPayload,
    mutation_payload_sha256: releaseMutationPayloadSha256(cancelPayload),
    github: { ...first.request.github, operation: 'workflow_cancel', workflow_ref: null, target_run_id: first.exact_run_id },
  };
  const cancel = recordFor({
    request: cancelRequest, runId: first.exact_run_id, nonce: '3'.repeat(32), globalSequence: 2,
    versionSequence: 2, globalPredecessor: first.request.attempt_id,
    versionPredecessor: first.request.attempt_id,
  });
  const cancelSnapshot = buildReleaseMutationBrokerLedgerSnapshot({
    repository: first.request.github.repository, records: [first, cancel], ledgerGeneration: 2,
    observedAt: '2026-07-18T00:02:00.000Z', keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  assert.deepEqual(validateReleaseMutationBrokerLedgerSnapshot(
    cancelSnapshot, authority, { now: '2026-07-18T00:02:01.000Z' },
  ), []);

  const wrongTarget = recordFor({ ...{ request: cancelRequest }, runId: '999', nonce: '4'.repeat(32) });
  assert.match(validateHistoricalReleaseMutationAcceptanceReceipt(wrongTarget.acceptance, cancelRequest, authority).join('; '), /exact target run id/);
});

test('ledger lookup distinguishes signed found/not-found from unavailable', () => {
  const record = recordFor({ state: 'terminal_succeeded' });
  const found = buildReleaseMutationBrokerLedgerFound({
    lookup: record.lookup, record, observedAt: '2026-07-18T00:02:00.000Z', ledgerGeneration: 2,
    versionAggregateRevision: 1, authorityEpoch: authority.authority_epoch,
    keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  assert.deepEqual(validateReleaseMutationBrokerLedgerLookupResult(
    found, record.lookup, authority, { now: '2026-07-18T00:02:01.000Z' },
  ), []);
  const notFound = buildReleaseMutationBrokerLedgerNotFound({
    lookup: record.lookup, observedAt: '2026-07-18T00:02:00.000Z', ledgerGeneration: 2,
    authorityEpoch: authority.authority_epoch,
    keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  assert.deepEqual(validateReleaseMutationBrokerLedgerLookupResult(
    notFound, record.lookup, authority, { now: '2026-07-18T00:02:01.000Z' },
  ), []);
  const forged = structuredClone(notFound);
  forged.read_proof.ledger_generation += 1;
  assert.match(validateReleaseMutationBrokerLedgerLookupResult(
    forged, record.lookup, authority, { now: '2026-07-18T00:02:01.000Z' },
  ).join('; '), /proof disagrees|signature is invalid/);
  assert.match(validateReleaseMutationBrokerLedgerLookupResult({
    schema: 'opl_app_release_mutation_broker_ledger_lookup_result.v1', status: 'unavailable', reason: 'broker offline',
  }, record.lookup, authority).join('; '), /status is invalid/);
  assert.throws(() => externalReleaseMutationBrokerLedgerLookup({ ...record.lookup, challenge: 'bad' }), /Invalid broker ledger lookup/);
});

test('promotion alone holds the cross-version Latest mutex and cancel releases only after exact terminal readback CAS', () => {
  const ownerRequest = promotionRequest();
  const owner = recordFor({ request: ownerRequest, runId: '301', nonce: '5'.repeat(32), globalSequence: 1 });
  const otherRequest = promotionRequest({ version: '26.7.19', attemptChar: '8', sessionChar: 'e' });
  assert.match(
    (decideReleaseMutationBrokerAdmission([owner], otherRequest, '6'.repeat(32)) as { reason?: string }).reason ?? '',
    /cross-version global latest promotion is still active/,
  );

  const cancelPayload = {
    opl_version: ownerRequest.idempotency.version, stable_session_id: ownerRequest.stable_session_id,
    release_cohort_ref: ownerRequest.release_cohort_ref, target_attempt_id: ownerRequest.attempt_id,
    target_run_id: owner.exact_run_id, reason: 'operator emergency stop', operator_actor: 'gaofeng21cn',
  };
  const cancelRequest: ReleaseMutationBrokerRequestV1 = {
    ...ownerRequest, attempt_id: digest('9'), mutation: 'workflow_cancel', mutation_payload: cancelPayload,
    mutation_payload_sha256: releaseMutationPayloadSha256(cancelPayload),
    github: { ...ownerRequest.github, operation: 'workflow_cancel', workflow_ref: null, target_run_id: owner.exact_run_id },
  };
  const cancelPending = recordFor({
    request: cancelRequest, runId: owner.exact_run_id!, nonce: '7'.repeat(32), globalSequence: 1,
    versionSequence: 2, versionPredecessor: ownerRequest.attempt_id, state: 'terminal_cancelled',
    ownerFenceToken: owner.pre_api_fence.coordination.fence_token,
    cancelTransition: {
      target_attempt_id: ownerRequest.attempt_id, target_run_id: owner.exact_run_id!,
      target_terminal_state: 'terminal_cancelled', atomic_with_owner_state_update: true,
      latest_readback_completed: false,
    },
  });
  const pendingSnapshot = buildReleaseMutationBrokerLedgerSnapshot({
    repository: ownerRequest.github.repository, records: [owner, cancelPending], ledgerGeneration: 2,
    observedAt: '2026-07-18T00:02:00.000Z', keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  assert.equal(pendingSnapshot.latest_mutation_head.state, 'cancel_requested');
  assert.deepEqual(validateReleaseMutationBrokerLedgerSnapshot(
    pendingSnapshot, authority, { now: '2026-07-18T00:02:01.000Z' },
  ), []);
  assert.equal(decideReleaseMutationBrokerAdmission([owner, cancelPending], otherRequest, '8'.repeat(32)).action, 'reject');

  const cancelReleased = recordFor({
    request: cancelRequest, runId: owner.exact_run_id!, nonce: '7'.repeat(32), globalSequence: 1,
    versionSequence: 2, versionPredecessor: ownerRequest.attempt_id, state: 'terminal_cancelled',
    ownerFenceToken: owner.pre_api_fence.coordination.fence_token,
    cancelTransition: {
      target_attempt_id: ownerRequest.attempt_id, target_run_id: owner.exact_run_id!,
      target_terminal_state: 'terminal_cancelled', atomic_with_owner_state_update: true,
      latest_readback_completed: true,
    },
  });
  const releasedSnapshot = buildReleaseMutationBrokerLedgerSnapshot({
    repository: ownerRequest.github.repository, records: [owner, cancelReleased], ledgerGeneration: 3,
    observedAt: '2026-07-18T00:02:00.000Z', keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  assert.equal(releasedSnapshot.latest_mutation_head.state, 'free');
  assert.deepEqual(validateReleaseMutationBrokerLedgerSnapshot(
    releasedSnapshot, authority, { now: '2026-07-18T00:02:01.000Z' },
  ), []);
  assert.equal(decideReleaseMutationBrokerAdmission([owner, cancelReleased], otherRequest, '8'.repeat(32)).action, 'execute_once');
});

test('rotated authority keeps prior epoch verify-only while new admission requires the current epoch', () => {
  const record = recordFor();
  const rotatedKeys = crypto.generateKeyPairSync('ed25519');
  const rotatedPublicKey = rotatedKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const rotated: ReleaseBrokerAuthorityV1 = {
    ...authority,
    authority_epoch: 2,
    trusted_ed25519_public_keys: { rotated: rotatedPublicKey },
    historical_verification_epochs: [{
      authority_epoch: authority.authority_epoch,
      authority_sha256: releaseBrokerAuthoritySha256(authority),
      authority_snapshot_base64: Buffer.from(JSON.stringify(authority), 'utf8').toString('base64'),
      trusted_key_ids: ['test'], admission_closed: true, verify_only: true,
    }],
  };
  assert.deepEqual(validateReleaseBrokerAuthority(rotated, { capability: 'contract_read' }), []);
  const prior = resolveHistoricalReleaseBrokerAuthority(
    rotated, authority.authority_epoch, releaseBrokerAuthoritySha256(authority), 'test',
  );
  assert.deepEqual(validateHistoricalReleaseMutationAcceptanceReceipt(record.acceptance, record.request, prior), []);
  assert.match(
    validateReleaseMutationPreApiFence(record.pre_api_fence, record.request, rotated).join('; '),
    /authority epoch|signature/,
  );
});

test('workflow verifier rejects transport/unknown/stale/identity drift and preserves historical proof past TTL', async () => {
  const record = recordFor({ state: 'terminal_succeeded' });
  const found = buildReleaseMutationBrokerLedgerFound({
    lookup: record.lookup, record, observedAt: '2026-07-18T00:02:00.000Z', ledgerGeneration: 2,
    versionAggregateRevision: 1, authorityEpoch: authority.authority_epoch,
    keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  const expected: BrokerAcceptanceExpectedIdentity = {
    repository: record.request.github.repository, runId: record.exact_run_id, runAttempt: 1,
    workflow: record.request.workflow, workflowSha: record.request.controller_workflow_sha,
    payloadSha256: record.request.mutation_payload_sha256, attemptId: record.request.attempt_id,
  };
  const artifact = verifyBrokerLookupResult({
    authority, fence: record.pre_api_fence, expected, result: found,
    verifiedAt: '2026-07-18T00:02:01.000Z', expectedChallenge: record.lookup.challenge,
  });
  assert.equal(artifact.status, 'verified');
  assert.throws(() => verifyBrokerLookupResult({
    authority, fence: record.pre_api_fence, expected, result: found,
    verifiedAt: '2026-07-18T00:02:01.000Z', expectedChallenge: 'f'.repeat(32),
  }), /challenge|mismatched/);
  assert.throws(() => verifyBrokerLookupResult({
    authority, fence: record.pre_api_fence, expected, result: found,
    verifiedAt: '2026-07-18T00:03:00.000Z', expectedChallenge: record.lookup.challenge,
  }), /stale/);
  assert.throws(() => verifyBrokerLookupResult({
    authority, fence: record.pre_api_fence, expected: { ...expected, runAttempt: 2 }, result: found,
    verifiedAt: '2026-07-18T00:02:01.000Z', expectedChallenge: record.lookup.challenge,
  }), /exact current workflow run/);
  assert.throws(() => verifyBrokerLookupResult({
    authority, fence: record.pre_api_fence, expected: { ...expected, workflowSha: sha('e') }, result: found,
    verifiedAt: '2026-07-18T00:02:01.000Z', expectedChallenge: record.lookup.challenge,
  }), /controller workflow SHA/);

  const notFound = buildReleaseMutationBrokerLedgerNotFound({
    lookup: record.lookup, observedAt: '2026-07-18T00:02:00.000Z', ledgerGeneration: 2,
    authorityEpoch: authority.authority_epoch, keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  assert.throws(() => verifyBrokerLookupResult({
    authority, fence: record.pre_api_fence, expected, result: notFound,
    verifiedAt: '2026-07-18T00:02:01.000Z', expectedChallenge: record.lookup.challenge,
  }), /not_found/);
  const unknownRecord = buildReleaseMutationBrokerLedgerRecord({
    lookup: record.lookup, request: record.request, preApiFence: record.pre_api_fence, acceptance: null,
    recordedAt: '2026-07-18T00:01:01.000Z', mutationState: 'outcome_unknown', exactRunId: null,
    keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  const unknown = buildReleaseMutationBrokerLedgerOutcomeUnknown({
    lookup: record.lookup, record: unknownRecord, observedAt: '2026-07-18T00:02:00.000Z', ledgerGeneration: 2,
    versionAggregateRevision: 1, authorityEpoch: authority.authority_epoch,
    keyId: 'test', signingPrivateKeyPem: privateKeyPem,
  });
  assert.throws(() => verifyBrokerLookupResult({
    authority, fence: record.pre_api_fence, expected, result: unknown,
    verifiedAt: '2026-07-18T00:02:01.000Z', expectedChallenge: record.lookup.challenge,
  }), /outcome_unknown/);

  const validationBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  const historical = verifyHistoricalBrokerValidation({
    currentAuthority: authority, validationBytes, expectedValidationSha256: bytesSha(validationBytes), expected,
    verifiedAt: '2026-07-19T00:02:01.000Z',
  });
  assert.equal(historical.status, 'verified');
  assert.throws(() => verifyHistoricalBrokerValidation({
    currentAuthority: authority, validationBytes, expectedValidationSha256: `sha256:${'0'.repeat(64)}`, expected,
    verifiedAt: '2026-07-19T00:02:01.000Z',
  }), /artifact digest/);
  const tampered = structuredClone(artifact);
  tampered.exact_run_id = '999';
  const tamperedBytes = Buffer.from(`${JSON.stringify(tampered, null, 2)}\n`, 'utf8');
  assert.throws(() => verifyHistoricalBrokerValidation({
    currentAuthority: authority, validationBytes: tamperedBytes,
    expectedValidationSha256: bytesSha(tamperedBytes), expected, verifiedAt: '2026-07-19T00:02:01.000Z',
  }), /derived summary/);

  await assert.rejects(remoteWorkflowBrokerLookup(
    authority, 'ZmFrZQ==', record.lookup,
    (async () => { throw new Error('transport offline'); }) as typeof fetch,
    { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.example.test/token', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'token' },
  ), /transport offline/);
});

test('workflow verifier fails closed against canonical unprovisioned authority before network access', () => {
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', 'scripts/verify-release-broker-acceptance.ts',
    '--mode', 'lookup', '--pre-api-fence-base64', 'e30=',
    '--expected-repository', 'gaofeng21cn/one-person-lab-app', '--expected-run-id', '1',
    '--expected-run-attempt', '1', '--expected-workflow', 'desktop-release.yml',
    '--expected-workflow-sha', sha('a'), '--expected-payload-sha256', digest('a'),
    '--expected-attempt-id', digest('b'), '--output', '/tmp/should-not-exist-broker-validation.json',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not provisioned|not ready/);
});
