import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {
  decodeReleaseSessionLease,
  validateReleaseSessionLease,
  type ReleaseSessionLeaseV2,
} from '../../scripts/release-session-lease.ts';

const session = `sha256:${'1'.repeat(64)}`;
const cohort = `sha256:${'2'.repeat(64)}`;
const attempt = `sha256:${'3'.repeat(64)}`;
const mutationPayload = `sha256:${'4'.repeat(64)}`;
const head = 'a'.repeat(40);
const repository = 'gaofeng21cn/one-person-lab-app';
const operatorActor = 'gaofeng21cn';
const brokerActor = 'opl-release-broker[bot]';
const keys = crypto.generateKeyPairSync('ed25519');
const privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

function historicalLease(): ReleaseSessionLeaseV2 {
  const payload = {
    schema: 'opl_app_release_session_lease.v2' as const,
    authorization_mode: 'ed25519_signed' as const,
    authorization_class: 'standard' as const,
    issuer: 'opl-release-broker',
    repository,
    stable_session_id: session,
    release_cohort_ref: cohort,
    operator_actor: operatorActor,
    broker_actor: brokerActor,
    attempt_id: attempt,
    workflow: 'opl-first-run-vm.yml' as const,
    artifact_kind: 'standard' as const,
    controller_workflow_sha: head,
    artifact_app_sha: head,
    mutation_payload_sha256: mutationPayload,
    planned_session_revision: 1,
    target_attempt_id: null,
    target_run_id: null,
    nonce: 'a'.repeat(32),
    issued_at: '2026-07-18T00:00:00.000Z',
    expires_at: '2026-07-18T00:01:00.000Z',
    allowed_mutations: ['qualification_dispatch' as const],
    credential_boundary: {
      lease_prevents_same_identity_api_bypass: false as const,
      normal_codex_actions_write_allowed: false as const,
      isolated_release_broker_token_required: true as const,
      protected_environment_alone_blocks_cancel_or_rerun: false as const,
      lease_intrinsically_enforces_nonce_single_use: false as const,
      broker_durable_nonce_consumption_required: true as const,
    },
  };
  const bytes = canonicalJson(payload);
  return {
    ...payload,
    payload_digest: `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`,
    signature: {
      algorithm: 'Ed25519',
      key_id: 'historical-test-key',
      value_base64: crypto.sign(null, Buffer.from(bytes), privateKeyPem).toString('base64'),
    },
  };
}

const expected = {
  stableSessionId: session,
  releaseCohortRef: cohort,
  repository,
  operatorActor,
  brokerActor,
  mutation: 'qualification_dispatch' as const,
  attemptId: attempt,
  workflow: 'opl-first-run-vm.yml' as const,
  artifactKind: 'standard' as const,
  controllerWorkflowSha: head,
  artifactAppSha: head,
  mutationPayloadSha256: mutationPayload,
  plannedSessionRevision: 1,
  publicKeys: { 'historical-test-key': publicKeyPem },
  now: '2026-07-18T00:00:30.000Z',
};

test('historical signed lease remains decodable and verifiable', () => {
  const lease = historicalLease();
  const encoded = Buffer.from(JSON.stringify(lease), 'utf8').toString('base64');
  assert.deepEqual(decodeReleaseSessionLease(encoded), lease);
  assert.deepEqual(validateReleaseSessionLease(lease, expected), []);
});

test('historical lease validation fails closed on identity, signature, and malformed fields', () => {
  const tampered = structuredClone(historicalLease());
  tampered.operator_actor = 'someone-else';
  assert.match(validateReleaseSessionLease(tampered, expected).join('; '), /operator actor|payload_digest|signature/);
  assert.doesNotThrow(() => validateReleaseSessionLease({ schema: 'opl_app_release_session_lease.v2' }, expected));
  assert.ok(validateReleaseSessionLease({ schema: 'opl_app_release_session_lease.v2' }, expected).length > 0);
});

test('production lease module exposes no builder, signer, or encoder', () => {
  const source = fs.readFileSync('scripts/release-session-lease.ts', 'utf8');
  assert.doesNotMatch(source, /export function (?:build|encode)ReleaseSessionLease/);
  assert.doesNotMatch(source, /crypto\.sign/);
});
