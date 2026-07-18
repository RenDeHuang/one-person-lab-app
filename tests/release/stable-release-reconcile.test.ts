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
  transitionStableReleaseSession,
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

function reconcileAt(
  session: ReturnType<typeof buildStableReleaseSession>,
  provider: Parameters<typeof reconcileStableReleaseSession>[1],
  at = '2026-07-18T00:01:30.000Z',
) {
  return reconcileStableReleaseSession(session, provider, at, authority, () => Date.parse(at));
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
  const result = reconcileAt(session, {
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
    () => reconcileAt(terminal, {
      readBrokerRecord: () => { throw new Error('no linked mutation'); },
      readRun: () => null, readAttemptReceipt: () => null,
    }, '2026-07-18T00:01:03.000Z'),
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

function acceptedFencedDispatch(runId: string) {
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
    requestId: `broker-request-${runId}`, runId, keyId: 'test', signingPrivateKeyPem: privateKeyPem,
    credentialIsolationReceipt: isolationReceipt,
  });
  return {
    ...fixture,
    attempt,
    acceptance,
    readBrokerRecord: (
      lookup: Parameters<typeof buildReleaseMutationBrokerLedgerRecord>[0]['lookup'],
      observedAt: string,
      mutationState: Parameters<typeof buildReleaseMutationBrokerLedgerRecord>[0]['mutationState'],
    ) => {
      const record = buildReleaseMutationBrokerLedgerRecord({
        lookup, request: fixture.request, acceptance, recordedAt: '2026-07-18T00:01:03.000Z',
        mutationState, exactRunId: runId, keyId: 'test', signingPrivateKeyPem: privateKeyPem,
      });
      return buildReleaseMutationBrokerLedgerFound({
        lookup, record, observedAt, ledgerGeneration: 1, versionAggregateRevision: 1,
        versionHeadAttemptId: attempt.attempt_id, completeThroughSequence: 1,
        keyId: 'test', signingPrivateKeyPem: privateKeyPem,
      });
    },
  };
}

function sequenceClock(...timestamps: string[]): () => number {
  let index = 0;
  return () => Date.parse(timestamps[Math.min(index++, timestamps.length - 1)]!);
}

function addonTerminalSession() {
  let session = buildStableReleaseSession(plan(), undefined, '2026-07-18T00:00:00.000Z');
  const artifactSha256 = 'e'.repeat(64);
  session.qualification_run.artifact_sha256 = artifactSha256;
  session.artifact_tracks.standard.artifact_sha256 = artifactSha256;
  session.artifact_tracks.standard.qualification_run.artifact_sha256 = artifactSha256;
  const advance = (phase: Parameters<typeof transitionStableReleaseSession>[1], at: string) => {
    session = transitionStableReleaseSession(session, phase, `fixture ${phase}`, at);
  };
  advance('source_gates_passed', '2026-07-18T00:01:00.000Z');
  advance('artifact_build_running', '2026-07-18T00:02:00.000Z');
  advance('artifacts_qualified', '2026-07-18T00:03:00.000Z');
  advance('owner_approved', '2026-07-18T00:04:00.000Z');
  advance('promotion_running', '2026-07-18T00:05:00.000Z');
  advance('release_published_not_latest', '2026-07-18T00:06:00.000Z');
  advance('distribution_synced', '2026-07-18T00:07:00.000Z');
  advance('homebrew_verified', '2026-07-18T00:08:00.000Z');
  advance('latest_activated', '2026-07-18T00:09:00.000Z');
  advance('awaiting_local_activation', '2026-07-18T00:09:30.000Z');
  session.receipts = {
    promotion_saga: { ref: 'promotion-saga-test', sha256: 'a'.repeat(64) },
    local_activation: { ref: 'local-activation-test', sha256: 'b'.repeat(64) },
  };
  advance('standard_stable_terminal', '2026-07-18T00:10:00.000Z');
  const fullAttempt = appendQualificationAttempt(session, {
    artifactKind: 'full', workflow: 'desktop-release-full-addon.yml', mutation: 'full_addon_dispatch',
    at: '2026-07-18T00:10:30.000Z', reason: 'terminal absorption fixture',
  });
  session = {
    ...fullAttempt.session,
    addon_tracks: {
      full: {
        ...fullAttempt.session.addon_tracks.full,
        status: 'blocked_with_debt', receipt_ref: 'full-debt.json', receipt_sha256: 'c'.repeat(64),
      },
      webui: {
        ...fullAttempt.session.addon_tracks.webui,
        status: 'blocked_with_debt', receipt_ref: 'webui-debt.json', receipt_sha256: 'd'.repeat(64),
      },
    },
    terminal_truth: { ...fullAttempt.session.terminal_truth, addon_status: 'blocked_with_debt' },
  };
  return transitionStableReleaseSession(
    session, 'addon_train_terminal', 'fixture addon terminal', '2026-07-18T00:11:00.000Z',
  );
}

test('signed broker not-found remains reconcile-only and never authorizes run discovery or redispatch', () => {
  const { session, mutationId } = fencedDispatch();
  let readRunCalls = 0;
  const result = reconcileAt(session, {
    readBrokerRecord: (lookup) => buildReleaseMutationBrokerLedgerNotFound({
      lookup, observedAt: '2026-07-18T00:01:29.000Z', ledgerGeneration: 1,
      keyId: 'test', signingPrivateKeyPem: privateKeyPem,
    }),
    readRun: () => { readRunCalls += 1; return null; },
    readAttemptReceipt: () => null,
  }, '2026-07-18T00:01:30.000Z');
  assert.equal(result.mutation_attempts.find((attempt) => attempt.attempt_id === mutationId)?.events.at(-1)?.state, 'reconcile_pending');
  assert.equal(result.artifact_tracks.standard.attempts[0].events.at(-1)?.state, 'reconcile_pending');
  assert.equal(readRunCalls, 0);
});

test('broker transport unavailability remains recoverable and never reads a guessed GitHub run', () => {
  const { session, mutationId } = fencedDispatch();
  let readRunCalls = 0;
  const result = reconcileAt(session, {
    readBrokerRecord: () => ({
      schema: 'opl_app_release_mutation_broker_ledger_lookup_result.v1', status: 'unavailable', reason: 'broker restart',
    }),
    readRun: () => { readRunCalls += 1; return null; },
    readAttemptReceipt: () => null,
  }, '2026-07-18T00:01:30.000Z');
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
  const result = reconcileAt(session, {
    readBrokerRecord: (lookup) => buildReleaseMutationBrokerLedgerNotFound({
      lookup, observedAt: '2026-07-18T00:01:09.000Z', ledgerGeneration: 1,
      keyId: 'test', signingPrivateKeyPem: privateKeyPem,
    }),
    readRun: () => { readRunCalls += 1; return null; },
    readAttemptReceipt: () => null,
  }, '2026-07-18T00:01:10.000Z');
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
  const result = reconcileAt(session, {
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
  }, '2026-07-18T00:01:10.000Z');
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
  const result = reconcileAt(session, {
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
  }, '2026-07-18T00:01:10.000Z');
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
    () => reconcileAt(locallySucceeded, {
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
    }, '2026-07-18T00:01:10.000Z'),
    /claims succeeded but durable broker ledger is terminal_failed/,
  );
});

test('Standard deadline is materialized at 90:00 before reconcile performs provider I/O', () => {
  const deadline = '2026-07-18T01:30:00.000Z';
  for (const [observedAt, expectedPhase, expectedBrokerCalls] of [
    ['2026-07-18T01:29:59.999Z', 'candidate_frozen', 1],
    [deadline, 'standard_deadline_blocked', 0],
    ['2026-07-18T01:30:00.001Z', 'standard_deadline_blocked', 0],
  ] as const) {
    const fixture = fencedDispatch();
    let brokerCalls = 0;
    const result = reconcileStableReleaseSession(fixture.session, {
      readBrokerRecord: () => {
        brokerCalls += 1;
        return { status: 'unavailable', reason: 'test transport outage' };
      },
      readRun: () => { throw new Error('deadline entry must not guess a run'); },
      readAttemptReceipt: () => null,
    }, observedAt, authority, () => Date.parse(observedAt));
    assert.equal(result.phase, expectedPhase);
    assert.equal(brokerCalls, expectedBrokerCalls);
    if (expectedPhase === 'standard_deadline_blocked') {
      assert.equal(result.standard_deadline_blocker?.stage, 'reconcile_entry');
      assert.equal(result.standard_deadline_blocker?.observed_at, observedAt);
    }
  }
});

test('broker lookup crossing the Standard deadline returns a durable blocker before run readback', () => {
  const fixture = fencedDispatch();
  let brokerCalls = 0;
  let runCalls = 0;
  const result = reconcileStableReleaseSession(fixture.session, {
    readBrokerRecord: () => {
      brokerCalls += 1;
      throw new Error('broker transport crossed the deadline');
    },
    readRun: () => { runCalls += 1; return null; },
    readAttemptReceipt: () => null,
  }, '2026-07-18T01:29:59.999Z', authority, sequenceClock(
    '2026-07-18T01:29:59.999Z',
    '2026-07-18T01:30:00.000Z',
  ));
  assert.equal(brokerCalls, 1);
  assert.equal(runCalls, 0);
  assert.equal(result.phase, 'standard_deadline_blocked');
  assert.equal(result.standard_deadline_blocker?.stage, 'broker_lookup:qualification_dispatch');
});

test('exact run readback crossing the Standard deadline cannot keep the session open', () => {
  const fixture = acceptedFencedDispatch('201');
  let runCalls = 0;
  let evidenceCalls = 0;
  const result = reconcileStableReleaseSession(fixture.session, {
    readBrokerRecord: (lookup) => fixture.readBrokerRecord(
      lookup,
      '2026-07-18T01:29:59.400Z',
      'run_bound',
    ),
    readRun: () => {
      runCalls += 1;
      return {
        databaseId: '201', status: 'in_progress', conclusion: null, runAttempt: 1,
        workflow: fixture.attempt.workflow, controllerWorkflowSha: fixture.attempt.controller_workflow_sha,
        mutationAttemptId: fixture.attempt.attempt_id, headBranch: 'main', event: 'workflow_dispatch',
      };
    },
    readAttemptReceipt: () => { evidenceCalls += 1; return null; },
  }, '2026-07-18T01:29:59.000Z', authority, sequenceClock(
    '2026-07-18T01:29:59.000Z',
    '2026-07-18T01:29:59.500Z',
    '2026-07-18T01:30:00.000Z',
  ));
  assert.equal(runCalls, 1);
  assert.equal(evidenceCalls, 0);
  assert.equal(result.phase, 'standard_deadline_blocked');
  assert.equal(result.standard_deadline_blocker?.stage, 'run_readback:opl-first-run-vm.yml');
  assert.equal(result.standard_deadline_blocker?.run_id, '201');
});

test('late evidence readback cannot upgrade Standard qualification', () => {
  const fixture = acceptedFencedDispatch('202');
  let attemptReceiptCalls = 0;
  let manifestCalls = 0;
  const result = reconcileStableReleaseSession(fixture.session, {
    readBrokerRecord: (lookup) => fixture.readBrokerRecord(
      lookup,
      '2026-07-18T01:29:58.400Z',
      'terminal_succeeded',
    ),
    readRun: () => ({
      databaseId: '202', status: 'completed', conclusion: 'success', runAttempt: 1,
      workflow: fixture.attempt.workflow, controllerWorkflowSha: fixture.attempt.controller_workflow_sha,
      mutationAttemptId: fixture.attempt.attempt_id, headBranch: 'main', event: 'workflow_dispatch',
    }),
    readAttemptReceipt: () => { attemptReceiptCalls += 1; return null; },
    readBuildManifest: () => { manifestCalls += 1; return null; },
  }, '2026-07-18T01:29:58.000Z', authority, sequenceClock(
    '2026-07-18T01:29:58.000Z',
    '2026-07-18T01:29:58.500Z',
    '2026-07-18T01:29:59.000Z',
    '2026-07-18T01:30:00.000Z',
  ));
  assert.equal(attemptReceiptCalls, 1);
  assert.equal(manifestCalls, 0);
  assert.equal(result.phase, 'standard_deadline_blocked');
  assert.equal(result.standard_deadline_blocker?.stage, 'evidence:standard:attempt_receipt');
  assert.notEqual(result.phase, 'artifacts_qualified');
});

test('every Standard evidence read rechecks the live deadline before later evidence or qualification commit', () => {
  const stages = [
    'evidence:standard:attempt_receipt',
    'evidence:standard:build_manifest',
    'evidence:standard:strict_qualification_receipt',
    'evidence:standard:smoke_summary',
  ] as const;
  for (const [crossingIndex, expectedStage] of stages.entries()) {
    const fixture = acceptedFencedDispatch(String(210 + crossingIndex));
    const calls: string[] = [];
    const before = '2026-07-18T01:29:59.900Z';
    const clockValues = [before, before, before, ...stages.map((_, index) =>
      index === crossingIndex ? '2026-07-18T01:30:00.000Z' : before
    )];
    const result = reconcileStableReleaseSession(fixture.session, {
      readBrokerRecord: (lookup) => fixture.readBrokerRecord(
        lookup,
        '2026-07-18T01:29:59.800Z',
        'terminal_succeeded',
      ),
      readRun: () => ({
        databaseId: String(210 + crossingIndex), status: 'completed', conclusion: 'success', runAttempt: 1,
        workflow: fixture.attempt.workflow, controllerWorkflowSha: fixture.attempt.controller_workflow_sha,
        mutationAttemptId: fixture.attempt.attempt_id, headBranch: 'main', event: 'workflow_dispatch',
      }),
      readAttemptReceipt: () => {
        calls.push(stages[0]);
        return {
          receipt: { identity: { source_artifact_run_id: '90' } } as never,
          ref: 'partial-attempt-receipt', sha256: 'a'.repeat(64),
        };
      },
      readBuildManifest: () => {
        calls.push(stages[1]);
        return { value: {} as never, ref: 'partial-manifest', sha256: 'b'.repeat(64) };
      },
      readStrictQualificationReceipt: () => {
        calls.push(stages[2]);
        return { value: {} as never, ref: 'partial-strict', sha256: 'c'.repeat(64) };
      },
      readSmokeSummary: () => {
        calls.push(stages[3]);
        return { value: {}, ref: 'partial-smoke', sha256: 'd'.repeat(64) };
      },
    }, before, authority, sequenceClock(...clockValues));
    assert.equal(result.phase, 'standard_deadline_blocked');
    assert.equal(result.standard_deadline_blocker?.stage, expectedStage);
    assert.deepEqual(calls, stages.slice(0, crossingIndex + 1));
  }
});

test('late success remains historical on a blocked Standard session and repeated reconcile is idempotent', () => {
  const fixture = acceptedFencedDispatch('203');
  const blocked = reconcileStableReleaseSession(fixture.session, {
    readBrokerRecord: () => { throw new Error('entry blocker must precede broker lookup'); },
    readRun: () => { throw new Error('entry blocker must precede run readback'); },
    readAttemptReceipt: () => null,
  }, '2026-07-18T01:30:00.000Z', authority, () => Date.parse('2026-07-18T01:30:00.000Z'));
  const provider = {
    readBrokerRecord: (lookup: Parameters<typeof fixture.readBrokerRecord>[0]) => fixture.readBrokerRecord(
      lookup,
      '2026-07-18T01:30:00.100Z',
      'terminal_succeeded',
    ),
    readRun: () => ({
      databaseId: '203', status: 'completed', conclusion: 'success', runAttempt: 1,
      workflow: fixture.attempt.workflow, controllerWorkflowSha: fixture.attempt.controller_workflow_sha,
      mutationAttemptId: fixture.attempt.attempt_id, headBranch: 'main', event: 'workflow_dispatch',
    }),
    readAttemptReceipt: () => null,
  };
  const first = reconcileStableReleaseSession(
    blocked, provider, '2026-07-18T01:30:00.200Z', authority,
    () => Date.parse('2026-07-18T01:30:00.200Z'),
  );
  assert.equal(first.phase, 'standard_deadline_blocked');
  assert.deepEqual(first.standard_deadline_blocker, blocked.standard_deadline_blocker);
  assert.equal(first.mutation_attempts[0]?.events.at(-1)?.state, 'succeeded');
  assert.equal(first.artifact_tracks.standard.attempts[0]?.events.at(-1)?.state, 'runner_lost');
  const repeated = reconcileStableReleaseSession(
    first, provider, '2026-07-18T01:30:00.300Z', authority,
    () => Date.parse('2026-07-18T01:30:00.300Z'),
  );
  assert.deepEqual(repeated, first);
});

test('Full blocked_with_debt is absorbing during reconcile', () => {
  const initial = buildStableReleaseSession(plan(), undefined, '2026-07-18T00:00:00.000Z');
  const planned = appendQualificationAttempt(initial, {
    artifactKind: 'full', workflow: 'desktop-release-full-addon.yml', mutation: 'full_addon_dispatch',
    at: '2026-07-18T00:01:00.000Z', reason: 'Full debt absorption test',
  });
  const session = {
    ...planned.session,
    addon_tracks: {
      ...planned.session.addon_tracks,
      full: {
        ...planned.session.addon_tracks.full,
        status: 'blocked_with_debt' as const,
        receipt_ref: 'full-debt-receipt.json',
        receipt_sha256: 'd'.repeat(64),
      },
    },
    terminal_truth: { ...planned.session.terminal_truth, addon_status: 'blocked_with_debt' as const },
  };
  let providerCalls = 0;
  const result = reconcileAt(session, {
    readBrokerRecord: () => { providerCalls += 1; throw new Error('absorbing Full debt must not read broker'); },
    readRun: () => { providerCalls += 1; return null; },
    readAttemptReceipt: () => { providerCalls += 1; return null; },
  }, '2026-07-18T00:02:00.000Z');
  assert.equal(providerCalls, 0);
  assert.deepEqual(result, session);
});

test('addon_train_terminal is an absorbing reconcile state', () => {
  const session = addonTerminalSession();
  let providerCalls = 0;
  const result = reconcileStableReleaseSession(session, {
    readBrokerRecord: () => { providerCalls += 1; throw new Error('terminal add-on state must not read broker'); },
    readRun: () => { providerCalls += 1; return null; },
    readAttemptReceipt: () => { providerCalls += 1; return null; },
  }, '2026-07-18T02:00:00.000Z', authority, () => Date.parse('2026-07-18T02:00:00.000Z'));
  assert.equal(providerCalls, 0);
  assert.deepEqual(result, session);
});
