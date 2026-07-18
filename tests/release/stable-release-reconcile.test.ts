import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import type { ReleaseCohortPlan } from '../../scripts/plan-release-cohort.ts';
import {
  appendQualificationAttempt,
  appendQualificationAttemptEvent,
  appendReleaseMutationAttemptEvent,
  buildStableReleaseSession,
  planReleaseMutationAttempt,
} from '../../scripts/stable-release-session.ts';
import { reconcileStableReleaseSession } from '../../scripts/stable-release-reconcile.ts';
import { buildReleaseSessionLease } from '../../scripts/release-session-lease.ts';
import {
  buildCredentialIsolationReceipt,
  readReleaseBrokerAuthority,
  validateCredentialIsolationReceipt,
  type ReleaseBrokerAuthorityV1,
} from '../../scripts/release-broker-authority.ts';
import {
  buildReleaseMutationAcceptanceReceipt,
  buildReleaseMutationBrokerLedgerFound,
  buildReleaseMutationBrokerLedgerNotFound,
  buildReleaseMutationBrokerLedgerLookup,
  buildReleaseMutationBrokerLedgerRecord,
  releaseMutationBrokerRequestSha256,
  validateReleaseMutationBrokerRequest,
  type ReleaseMutationBrokerRequestV1,
} from '../../scripts/release-mutation-broker.ts';
import { releaseMutationPayloadSha256 } from '../../scripts/release-mutation-payload.ts';

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const canonicalAuthority = readReleaseBrokerAuthority();
const authority: ReleaseBrokerAuthorityV1 = {
  ...canonicalAuthority,
  status: 'provisioned',
  authority_epoch: 1,
  historical_verification_epochs: [],
  mutation_broker: {
    ...canonicalAuthority.mutation_broker,
    protocol_version: 1, executable_path: '/usr/local/libexec/opl-release-broker-test',
    executable_sha256: `sha256:${'e'.repeat(64)}`, executable_codesign_identity: 'test.release-broker',
    approved_controller_workflow_shas: ['a'.repeat(40)],
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
const isolationReceipt = buildCredentialIsolationReceipt({
  authority, observedAt: '2026-07-18T00:00:00.000Z', expiresAt: '2026-07-18T00:15:00.000Z',
  normalActor: 'codex-read-only', normalTokenFingerprint: `sha256:${'1'.repeat(64)}`,
  brokerActor: 'opl-release-broker[bot]', brokerTokenFingerprint: `sha256:${'2'.repeat(64)}`,
  brokerBackend: 'github-app', brokerEndpointPath: authority.mutation_broker.executable_path,
  brokerEndpointSha256: authority.mutation_broker.executable_sha256!, brokerEndpointCodesignIdentity: authority.mutation_broker.executable_codesign_identity!,
  privateKeyBackend: 'keychain', callerAdmissionBackend: 'xpc-peer-credential',
  operatorActor: 'gaofeng21cn', operatorIdentitySource: 'broker_authenticated_caller',
  keyId: 'test', signingPrivateKeyPem: privateKeyPem,
});

function plan(): ReleaseCohortPlan {
  const sha = (value: string) => value.repeat(40);
  return {
    schema: 'opl_app_release_cohort_plan.v1', generated_at: '2026-07-18T00:00:00.000Z',
    version: '26.7.18', tag: 'v26.7.18', release_mode: 'new_release', release_intent: 'stable_complete',
    full_omission_reason: null, operator_plan_ref: `sha256:${'4'.repeat(64)}`, gate_reuse_plan_ref: null,
    app_commit: sha('a'), shell_ref: 'main', framework_ref: 'main', include_full_package: true,
    run_vm_smoke: true, publish_docker_webui: true,
    cohort_lock: {
      schema: 'opl_app_release_cohort_lock.v1', generated_at: '2026-07-18T00:00:00.000Z',
      app: { requested_ref: 'main', resolved_sha: sha('a'), repo_root: '/app' },
      shell: { requested_ref: 'main', resolved_sha: sha('b'), repo_root: '/shell' },
      framework: { requested_ref: 'main', resolved_sha: sha('c'), repo_root: '/framework' },
      authority_boundary: { cohort_lock_can_dispatch_workflow: false, cohort_lock_can_publish_release: false, cohort_lock_can_write_runtime_truth: false },
    },
    cheap_gates: [], next_action: { action: 'run_release_train_with_vm_smoke', command: '', reason: '' },
    authority_boundary: { cohort_plan_can_publish_release: false, cohort_plan_can_write_runtime_truth: false, cohort_plan_can_claim_release_ready: false },
  };
}

function runningAttempt(runId: string | null) {
  let session = buildStableReleaseSession(plan(), undefined, '2026-07-18T00:00:00.000Z');
  const planned = appendQualificationAttempt(session, {
    artifactKind: 'standard', workflow: 'opl-first-run-vm.yml', mutation: 'qualification_dispatch',
    at: '2026-07-18T00:01:00.000Z', reason: 'test',
  });
  session = appendQualificationAttemptEvent(planned.session, 'standard', planned.attemptId, {
    at: '2026-07-18T00:01:01.000Z', state: 'dispatching', run_id: runId,
    conclusion: null, failure_taxonomy: 'none', remote_receipt_ref: null, reason: 'test dispatch',
  });
  return { session, attemptId: planned.attemptId };
}

test('legacy qualification state without a broker mutation is not promoted to a false terminal', () => {
  const { session } = runningAttempt(null);
  const result = reconcileStableReleaseSession(session, {
    readBrokerRecord: () => { throw new Error('legacy qualification must not perform broker lookup'); },
    readRun: () => null,
    readAttemptReceipt: () => null,
  });
  assert.equal(result.artifact_tracks.standard.attempts[0].events.at(-1)?.state, 'dispatching');
});

test('terminal qualification cannot bypass broker and exact-run revalidation', () => {
  const running = runningAttempt('101');
  const terminal = appendQualificationAttemptEvent(running.session, 'standard', running.attemptId, {
    at: '2026-07-18T00:01:02.000Z', state: 'passed', run_id: '101', conclusion: 'success',
    failure_taxonomy: 'none', remote_receipt_ref: 'cached-only', remote_receipt_sha256: 'a'.repeat(64),
    reason: 'untrusted cached terminal projection',
  });
  assert.throws(
    () => reconcileStableReleaseSession(terminal, {
      readBrokerRecord: () => { throw new Error('no linked mutation'); },
      readRun: () => null, readAttemptReceipt: () => null,
    }, '2026-07-18T00:01:03.000Z', authority),
    /lacks a broker record validated in this reconcile pass/,
  );
});

function fencedDispatch() {
  let session = buildStableReleaseSession(plan(), undefined, '2026-07-18T00:00:00.000Z');
  const payload = {
    release_tag: `v${session.version}`,
    package_profile: 'standard',
    diagnostic_scope: 'release_gate',
    release_artifact_name: 'macos-build-arm64-dmg',
    release_artifact_run_id: '90',
    stable_session_id: session.id,
    release_cohort_ref: session.cohort_plan.operator_plan_ref,
    artifact_app_ref: session.cohort_plan.cohort_lock.app.resolved_sha,
    shell_ref: session.cohort_plan.cohort_lock.shell.resolved_sha,
    smoke_harness_ref: session.cohort_plan.cohort_lock.shell.resolved_sha,
    framework_ref: session.cohort_plan.cohort_lock.framework.resolved_sha,
    operator_actor: 'gaofeng21cn',
    standard_admission_deadline_at: session.efficiency_policy.standard_admission_deadline_at,
  };
  const mutation = planReleaseMutationAttempt(session, {
    mutation: 'qualification_dispatch', workflow: 'opl-first-run-vm.yml', artifactKind: 'standard',
    controllerWorkflowSha: 'a'.repeat(40), artifactAppSha: 'a'.repeat(40),
    mutationPayloadSha256: releaseMutationPayloadSha256(payload), mutationPayload: payload,
    priorRunIds: ['90'], at: '2026-07-18T00:01:00.000Z', reason: 'durable fence test',
  });
  const qualification = appendQualificationAttempt(mutation.session, {
    artifactKind: 'standard', workflow: 'opl-first-run-vm.yml', mutation: 'qualification_dispatch',
    mutationAttemptId: mutation.attemptId, at: '2026-07-18T00:01:00.000Z', reason: 'linked qualification',
  });
  const attempt = qualification.session.mutation_attempts.find((entry) => entry.attempt_id === mutation.attemptId)!;
  const request: ReleaseMutationBrokerRequestV1 = {
    schema: 'opl_app_release_mutation_broker_request.v1', stable_session_id: qualification.session.id,
    release_cohort_ref: qualification.session.cohort_plan.operator_plan_ref, operator_actor: 'gaofeng21cn',
    attempt_id: attempt.attempt_id, planned_session_revision: attempt.planned_session_revision,
    mutation: attempt.mutation, workflow: attempt.workflow, artifact_kind: attempt.artifact_kind,
    controller_workflow_sha: attempt.controller_workflow_sha, artifact_app_sha: attempt.artifact_app_sha,
    mutation_payload: attempt.mutation_payload!, mutation_payload_sha256: attempt.mutation_payload_sha256,
    idempotency: {
      key: `${qualification.session.repo}:stable:${qualification.session.version}`,
      channel: 'stable', version: qualification.session.version,
      same_attempt_returns_same_receipt: true, conflicting_session_or_cohort_rejected: true,
      concurrent_different_attempt_rejected: true,
    },
    credential_isolation_receipt: isolationReceipt,
    github: {
      repository: qualification.session.repo, operation: 'workflow_dispatch',
      workflow_ref: 'refs/heads/main', target_run_id: null,
    },
  };
  let sessionWithFence = appendReleaseMutationAttemptEvent(qualification.session, mutation.attemptId, {
    at: '2026-07-18T00:01:01.000Z', state: 'dispatching', run_id: null,
    reason: 'exact broker request durably fenced',
  });
  sessionWithFence = {
    ...sessionWithFence,
    mutation_attempts: sessionWithFence.mutation_attempts.map((entry) => entry.attempt_id === mutation.attemptId
      ? { ...entry, broker_lookup: { ...entry.broker_lookup, request_sha256: releaseMutationBrokerRequestSha256(request) } }
      : entry),
  };
  return {
    session: sessionWithFence, mutationId: mutation.attemptId,
    qualificationId: qualification.attemptId, request,
  };
}

test('signed broker not-found remains reconcile-only and never authorizes run discovery or redispatch', () => {
  const { session, mutationId } = fencedDispatch();
  let readRunCalls = 0;
  const result = reconcileStableReleaseSession(session, {
    readBrokerRecord: (lookup) => buildReleaseMutationBrokerLedgerNotFound({
      lookup, observedAt: '2026-07-18T00:01:29.000Z', ledgerGeneration: 1,
      keyId: 'test', signingPrivateKeyPem: privateKeyPem,
    }),
    readRun: () => { readRunCalls += 1; return null; },
    readAttemptReceipt: () => null,
  }, '2026-07-18T00:01:30.000Z', authority);
  assert.equal(result.mutation_attempts.find((attempt) => attempt.attempt_id === mutationId)?.events.at(-1)?.state, 'reconcile_pending');
  assert.equal(result.artifact_tracks.standard.attempts[0].events.at(-1)?.state, 'reconcile_pending');
  assert.equal(readRunCalls, 0);
});

test('broker transport unavailability remains recoverable and never reads a guessed GitHub run', () => {
  const { session, mutationId } = fencedDispatch();
  let readRunCalls = 0;
  const result = reconcileStableReleaseSession(session, {
    readBrokerRecord: () => ({
      schema: 'opl_app_release_mutation_broker_ledger_lookup_result.v1', status: 'unavailable', reason: 'broker restart',
    }),
    readRun: () => { readRunCalls += 1; return null; },
    readAttemptReceipt: () => null,
  }, '2026-07-18T00:01:30.000Z', authority);
  assert.equal(result.mutation_attempts.find((attempt) => attempt.attempt_id === mutationId)?.events.at(-1)?.state, 'reconcile_pending');
  assert.equal(readRunCalls, 0);
});

test('signed not-found invalidates a cached local acceptance and cannot drive qualification', () => {
  const fixture = fencedDispatch();
  const attempt = fixture.session.mutation_attempts.find((entry) => entry.attempt_id === fixture.mutationId)!;
  const lease = buildReleaseSessionLease({
    stableSessionId: fixture.session.id, releaseCohortRef: fixture.session.cohort_plan.operator_plan_ref,
    repository: fixture.session.repo, operatorActor: 'gaofeng21cn', brokerActor: 'opl-release-broker[bot]',
    attemptId: attempt.attempt_id, workflow: attempt.workflow, artifactKind: attempt.artifact_kind,
    controllerWorkflowSha: attempt.controller_workflow_sha, artifactAppSha: attempt.artifact_app_sha,
    mutationPayloadSha256: attempt.mutation_payload_sha256, plannedSessionRevision: attempt.planned_session_revision,
    mutation: attempt.mutation, issuedAt: '2026-07-18T00:01:01.000Z', ttlMs: 60_000,
    signingPrivateKeyPem: privateKeyPem, keyId: 'test',
  });
  const acceptance = buildReleaseMutationAcceptanceReceipt({
    request: fixture.request, lease, acceptedAt: '2026-07-18T00:01:02.000Z',
    brokerActor: 'opl-release-broker[bot]', brokerTokenFingerprint: `sha256:${'2'.repeat(64)}`,
    requestId: 'cached-only', runId: '101', keyId: 'test', signingPrivateKeyPem: privateKeyPem,
    credentialIsolationReceipt: isolationReceipt,
  });
  const session = {
    ...fixture.session, updated_at: '2026-07-18T00:01:02.000Z',
    mutation_leases: [lease], mutation_acceptances: [acceptance],
  };
  let readRunCalls = 0;
  const result = reconcileStableReleaseSession(session, {
    readBrokerRecord: (lookup) => buildReleaseMutationBrokerLedgerNotFound({
      lookup, observedAt: '2026-07-18T00:01:09.000Z', ledgerGeneration: 1,
      keyId: 'test', signingPrivateKeyPem: privateKeyPem,
    }),
    readRun: () => { readRunCalls += 1; return null; },
    readAttemptReceipt: () => null,
  }, '2026-07-18T00:01:10.000Z', authority);
  assert.equal(result.mutation_attempts.find((entry) => entry.attempt_id === fixture.mutationId)?.events.at(-1)?.state, 'ambiguous');
  assert.equal(result.artifact_tracks.standard.attempts[0].events.at(-1)?.state, 'ambiguous');
  assert.equal(readRunCalls, 0);
});

test('reconcile restores signed broker acceptance and exact run after controller crash-before-bind', () => {
  assert.deepEqual(validateCredentialIsolationReceipt(isolationReceipt, authority, '2026-07-18T00:01:10.000Z'), []);
  const { session, mutationId, request } = fencedDispatch();
  const attempt = session.mutation_attempts.find((entry) => entry.attempt_id === mutationId)!;
  const lease = buildReleaseSessionLease({
    stableSessionId: session.id, releaseCohortRef: session.cohort_plan.operator_plan_ref,
    repository: session.repo, operatorActor: 'gaofeng21cn', brokerActor: 'opl-release-broker[bot]',
    attemptId: attempt.attempt_id, workflow: attempt.workflow, artifactKind: attempt.artifact_kind,
    controllerWorkflowSha: attempt.controller_workflow_sha, artifactAppSha: attempt.artifact_app_sha,
    mutationPayloadSha256: attempt.mutation_payload_sha256, plannedSessionRevision: attempt.planned_session_revision,
    mutation: attempt.mutation, issuedAt: '2026-07-18T00:01:01.000Z', ttlMs: 60_000,
    signingPrivateKeyPem: privateKeyPem, keyId: 'test',
  });
  const acceptance = buildReleaseMutationAcceptanceReceipt({
    request, lease, acceptedAt: '2026-07-18T00:01:02.000Z', brokerActor: 'opl-release-broker[bot]',
    brokerTokenFingerprint: `sha256:${'2'.repeat(64)}`, requestId: 'broker-request-1', runId: '101',
    keyId: 'test', signingPrivateKeyPem: privateKeyPem, credentialIsolationReceipt: isolationReceipt,
  });
  assert.deepEqual(validateReleaseMutationBrokerRequest(request, authority, '2026-07-18T00:01:10.000Z'), []);
  let readRunCalls = 0;
  const result = reconcileStableReleaseSession(session, {
    readBrokerRecord: (lookup) => {
      assert.equal(lookup.request_sha256, releaseMutationBrokerRequestSha256(request));
      const ledgerRecord = buildReleaseMutationBrokerLedgerRecord({
        lookup, request, acceptance, recordedAt: '2026-07-18T00:01:03.000Z',
        mutationState: 'run_bound', exactRunId: '101', keyId: 'test', signingPrivateKeyPem: privateKeyPem,
      });
      return buildReleaseMutationBrokerLedgerFound({
        lookup, record: ledgerRecord, observedAt: '2026-07-18T00:01:09.000Z', ledgerGeneration: 1,
        versionAggregateRevision: 1, versionHeadAttemptId: attempt.attempt_id, completeThroughSequence: 1,
        keyId: 'test', signingPrivateKeyPem: privateKeyPem,
      });
    },
    readRun: () => {
      readRunCalls += 1;
      return {
        databaseId: '101', status: 'in_progress', conclusion: null, runAttempt: 1, workflow: attempt.workflow,
        controllerWorkflowSha: attempt.controller_workflow_sha, mutationAttemptId: attempt.attempt_id,
        headBranch: 'main', event: 'workflow_dispatch',
      };
    },
    readAttemptReceipt: () => null,
  }, '2026-07-18T00:01:10.000Z', authority);
  assert.equal(result.mutation_acceptances.length, 1, result.mutation_attempts.find((entry) => entry.attempt_id === mutationId)?.events.at(-1)?.reason);
  assert.equal(result.mutation_attempts.find((entry) => entry.attempt_id === mutationId)?.events.at(-1)?.run_id, '101');
  assert.equal(result.artifact_tracks.standard.attempts[0].events.at(-1)?.run_id, '101');
  assert.equal(readRunCalls, 1, 'linked mutation and qualification must share one GitHub run observation');
});

test('reconcile fails closed when the exact broker run has the wrong GitHub run attempt', () => {
  const { session, mutationId, request } = fencedDispatch();
  const attempt = session.mutation_attempts.find((entry) => entry.attempt_id === mutationId)!;
  const lease = buildReleaseSessionLease({
    stableSessionId: session.id, releaseCohortRef: session.cohort_plan.operator_plan_ref,
    repository: session.repo, operatorActor: 'gaofeng21cn', brokerActor: 'opl-release-broker[bot]',
    attemptId: attempt.attempt_id, workflow: attempt.workflow, artifactKind: attempt.artifact_kind,
    controllerWorkflowSha: attempt.controller_workflow_sha, artifactAppSha: attempt.artifact_app_sha,
    mutationPayloadSha256: attempt.mutation_payload_sha256, plannedSessionRevision: attempt.planned_session_revision,
    mutation: attempt.mutation, issuedAt: '2026-07-18T00:01:01.000Z', ttlMs: 60_000,
    signingPrivateKeyPem: privateKeyPem, keyId: 'test',
  });
  const acceptance = buildReleaseMutationAcceptanceReceipt({
    request, lease, acceptedAt: '2026-07-18T00:01:02.000Z', brokerActor: 'opl-release-broker[bot]',
    brokerTokenFingerprint: `sha256:${'2'.repeat(64)}`, requestId: 'broker-request-2', runId: '102',
    keyId: 'test', signingPrivateKeyPem: privateKeyPem, credentialIsolationReceipt: isolationReceipt,
  });
  const result = reconcileStableReleaseSession(session, {
    readBrokerRecord: (lookup) => {
      const ledgerRecord = buildReleaseMutationBrokerLedgerRecord({
        lookup, request, acceptance, recordedAt: '2026-07-18T00:01:03.000Z',
        mutationState: 'run_bound', exactRunId: '102', keyId: 'test', signingPrivateKeyPem: privateKeyPem,
      });
      return buildReleaseMutationBrokerLedgerFound({
        lookup, record: ledgerRecord, observedAt: '2026-07-18T00:01:09.000Z', ledgerGeneration: 1,
        versionAggregateRevision: 1, versionHeadAttemptId: attempt.attempt_id, completeThroughSequence: 1,
        keyId: 'test', signingPrivateKeyPem: privateKeyPem,
      });
    },
    readRun: () => ({
      databaseId: '102', status: 'in_progress', conclusion: null, runAttempt: 2,
      workflow: attempt.workflow, controllerWorkflowSha: attempt.controller_workflow_sha,
      mutationAttemptId: attempt.attempt_id, headBranch: 'main', event: 'workflow_dispatch',
    }),
    readAttemptReceipt: () => null,
  }, '2026-07-18T00:01:10.000Z', authority);
  const mutation = result.mutation_attempts.find((attempt) => attempt.attempt_id === mutationId)!;
  assert.equal(mutation.events.at(-1)?.state, 'ambiguous');
  assert.match(mutation.events.at(-1)?.reason ?? '', /run attempt is not 1/);
});

test('terminal mutation rejects a conflicting durable broker conclusion', () => {
  const fixture = fencedDispatch();
  const attempt = fixture.session.mutation_attempts.find((entry) => entry.attempt_id === fixture.mutationId)!;
  const lease = buildReleaseSessionLease({
    stableSessionId: fixture.session.id, releaseCohortRef: fixture.session.cohort_plan.operator_plan_ref,
    repository: fixture.session.repo, operatorActor: 'gaofeng21cn', brokerActor: 'opl-release-broker[bot]',
    attemptId: attempt.attempt_id, workflow: attempt.workflow, artifactKind: attempt.artifact_kind,
    controllerWorkflowSha: attempt.controller_workflow_sha, artifactAppSha: attempt.artifact_app_sha,
    mutationPayloadSha256: attempt.mutation_payload_sha256, plannedSessionRevision: attempt.planned_session_revision,
    mutation: attempt.mutation, issuedAt: '2026-07-18T00:01:01.000Z', ttlMs: 60_000,
    signingPrivateKeyPem: privateKeyPem, keyId: 'test',
  });
  const acceptance = buildReleaseMutationAcceptanceReceipt({
    request: fixture.request, lease, acceptedAt: '2026-07-18T00:01:02.000Z',
    brokerActor: 'opl-release-broker[bot]', brokerTokenFingerprint: `sha256:${'2'.repeat(64)}`,
    requestId: 'broker-request-terminal-conflict', runId: '103', keyId: 'test',
    signingPrivateKeyPem: privateKeyPem, credentialIsolationReceipt: isolationReceipt,
  });
  const acceptedSession = {
    ...fixture.session, mutation_leases: [lease], mutation_acceptances: [acceptance],
  };
  const locallySucceeded = appendReleaseMutationAttemptEvent(acceptedSession, fixture.mutationId, {
    at: '2026-07-18T00:01:04.000Z', state: 'succeeded', run_id: '103',
    reason: 'untrusted cached terminal projection',
  });

  assert.throws(
    () => reconcileStableReleaseSession(locallySucceeded, {
      readBrokerRecord: (lookup) => {
        const ledgerRecord = buildReleaseMutationBrokerLedgerRecord({
          lookup, request: fixture.request, acceptance, recordedAt: '2026-07-18T00:01:03.000Z',
          mutationState: 'terminal_failed', exactRunId: '103', keyId: 'test',
          signingPrivateKeyPem: privateKeyPem,
        });
        return buildReleaseMutationBrokerLedgerFound({
          lookup, record: ledgerRecord, observedAt: '2026-07-18T00:01:09.000Z', ledgerGeneration: 1,
          versionAggregateRevision: 1, versionHeadAttemptId: attempt.attempt_id, completeThroughSequence: 1,
          keyId: 'test', signingPrivateKeyPem: privateKeyPem,
        });
      },
      readRun: () => { throw new Error('ledger conflict must fail before GitHub readback'); },
      readAttemptReceipt: () => null,
    }, '2026-07-18T00:01:10.000Z', authority),
    /claims succeeded but durable broker ledger is terminal_failed/,
  );
});
