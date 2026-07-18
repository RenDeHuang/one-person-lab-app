import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  buildReleaseSessionLease,
  decodeReleaseSessionLease,
  encodeReleaseSessionLease,
  validateReleaseSessionLease,
} from '../../scripts/release-session-lease.ts';

const session = `sha256:${'1'.repeat(64)}`;
const cohort = `sha256:${'2'.repeat(64)}`;
const attempt = `sha256:${'3'.repeat(64)}`;
const mutationPayload = `sha256:${'4'.repeat(64)}`;
const plannedRevision = 1;
const head = 'a'.repeat(40);
const repository = 'gaofeng21cn/one-person-lab-app';
const operatorActor = 'gaofeng21cn';
const brokerActor = 'opl-release-broker[bot]';
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

test('release session lease binds session, cohort, actor, mutation, and expiry', () => {
  const lease = buildReleaseSessionLease({
    stableSessionId: session, releaseCohortRef: cohort, repository, operatorActor, brokerActor,
    issuedAt: '2026-07-18T00:00:00.000Z', ttlMs: 60_000,
    signingPrivateKeyPem: privateKeyPem, keyId: 'test-key', nonce: 'a'.repeat(32),
    attemptId: attempt, workflow: 'opl-first-run-vm.yml', artifactKind: 'standard',
    controllerWorkflowSha: head, artifactAppSha: head, mutation: 'qualification_dispatch',
    mutationPayloadSha256: mutationPayload, plannedSessionRevision: plannedRevision,
  });
  assert.deepEqual(decodeReleaseSessionLease(encodeReleaseSessionLease(lease)), lease);
  assert.deepEqual(validateReleaseSessionLease(lease, {
    stableSessionId: session, releaseCohortRef: cohort, repository, operatorActor, brokerActor,
    mutation: 'qualification_dispatch', now: '2026-07-18T00:00:30.000Z',
    attemptId: attempt, workflow: 'opl-first-run-vm.yml', artifactKind: 'standard',
    controllerWorkflowSha: head, artifactAppSha: head,
    mutationPayloadSha256: mutationPayload, plannedSessionRevision: plannedRevision,
    publicKeys: { 'test-key': publicKeyPem },
  }), []);
  assert.match(validateReleaseSessionLease(lease, {
    stableSessionId: session, releaseCohortRef: cohort, repository, operatorActor: 'someone-else', brokerActor,
    mutation: 'qualification_dispatch', now: '2026-07-18T00:02:00.000Z',
    attemptId: attempt, workflow: 'opl-first-run-vm.yml', artifactKind: 'standard',
    controllerWorkflowSha: head, artifactAppSha: head,
    mutationPayloadSha256: mutationPayload, plannedSessionRevision: plannedRevision,
    publicKeys: { 'test-key': publicKeyPem },
  }).join('; '), /actor|expired/);
});

test('release session lease explicitly records the same-identity API bypass boundary', () => {
  const lease = buildReleaseSessionLease({
    stableSessionId: session, releaseCohortRef: cohort, repository, operatorActor, brokerActor,
    signingPrivateKeyPem: privateKeyPem, keyId: 'test-key', nonce: 'b'.repeat(32),
    attemptId: attempt, workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: head, artifactAppSha: head, mutation: 'desktop_release_dispatch',
    mutationPayloadSha256: mutationPayload, plannedSessionRevision: plannedRevision,
  });
  assert.equal(lease.credential_boundary.lease_prevents_same_identity_api_bypass, false);
  assert.equal(lease.credential_boundary.isolated_release_broker_token_required, true);
  const tampered = structuredClone(lease);
  tampered.allowed_mutations = [];
  assert.match(validateReleaseSessionLease(tampered, {
    stableSessionId: session, releaseCohortRef: cohort, repository, operatorActor, brokerActor, mutation: 'desktop_release_dispatch',
    attemptId: attempt, workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: head, artifactAppSha: head,
    mutationPayloadSha256: mutationPayload, plannedSessionRevision: plannedRevision,
    publicKeys: { 'test-key': publicKeyPem },
  }).join('; '), /payload_digest|signature|does not allow/);
});

test('unsigned integrity receipt cannot authorize a workflow mutation', () => {
  const lease = buildReleaseSessionLease({
    stableSessionId: session, releaseCohortRef: cohort, repository, operatorActor, brokerActor,
    attemptId: attempt, workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: head, artifactAppSha: head, mutation: 'desktop_release_dispatch',
    mutationPayloadSha256: mutationPayload, plannedSessionRevision: plannedRevision,
  });
  assert.equal(lease.authorization_mode, 'advisory_integrity_receipt');
  assert.match(validateReleaseSessionLease(lease, {
    stableSessionId: session, releaseCohortRef: cohort, repository, operatorActor, brokerActor, mutation: 'desktop_release_dispatch',
    attemptId: attempt, workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: head, artifactAppSha: head,
    mutationPayloadSha256: mutationPayload, plannedSessionRevision: plannedRevision,
  }).join('; '), /advisory|signature is missing/);
});

test('cancel uses a dedicated emergency ticket and cannot share a dispatch ticket', () => {
  const cancel = buildReleaseSessionLease({
    stableSessionId: session, releaseCohortRef: cohort, repository, operatorActor, brokerActor,
    signingPrivateKeyPem: privateKeyPem, keyId: 'test-key', nonce: 'c'.repeat(32),
    attemptId: attempt, workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: head, artifactAppSha: head, mutation: 'workflow_cancel',
    targetAttemptId: `sha256:${'5'.repeat(64)}`, targetRunId: '7001',
    mutationPayloadSha256: mutationPayload, plannedSessionRevision: plannedRevision,
  });
  assert.equal(cancel.authorization_class, 'emergency_cancel');
  assert.deepEqual(cancel.allowed_mutations, ['workflow_cancel']);
  assert.match(validateReleaseSessionLease(cancel, {
    stableSessionId: session, releaseCohortRef: cohort, repository, operatorActor, brokerActor, mutation: 'desktop_release_dispatch',
    attemptId: attempt, workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: head, artifactAppSha: head,
    mutationPayloadSha256: mutationPayload, plannedSessionRevision: plannedRevision,
    publicKeys: { 'test-key': publicKeyPem },
  }).join('; '), /authorization_class|does not allow/);
});

test('untrusted malformed lease fields return typed errors instead of throwing', () => {
  const expected = {
    stableSessionId: session, releaseCohortRef: cohort, repository, operatorActor, brokerActor,
    mutation: 'desktop_release_dispatch' as const, attemptId: attempt,
    workflow: 'desktop-release.yml' as const, artifactKind: 'standard' as const,
    controllerWorkflowSha: head, artifactAppSha: head,
    mutationPayloadSha256: mutationPayload, plannedSessionRevision: plannedRevision,
    publicKeys: { 'test-key': 'not-a-public-key' },
  };
  for (const malformed of [
    { schema: 'opl_app_release_session_lease.v2', allowed_mutations: { 0: 'desktop_release_dispatch' } },
    { schema: 'opl_app_release_session_lease.v2', allowed_mutations: ['desktop_release_dispatch'], signature: [] },
    { schema: 'opl_app_release_session_lease.v2', allowed_mutations: ['desktop_release_dispatch'], signature: { algorithm: 'Ed25519', key_id: 'test-key', value_base64: 'AA==' } },
  ]) {
    assert.doesNotThrow(() => validateReleaseSessionLease(malformed, expected));
    assert.ok(validateReleaseSessionLease(malformed, expected).length > 0);
  }
});
