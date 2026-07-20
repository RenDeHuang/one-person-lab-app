import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import type { ReleaseCohortPlan } from '../../scripts/plan-release-cohort.ts';
import { buildQualificationHarnessScopeProof } from '../../scripts/qualification-harness-scope.ts';
import {
  adminOneShotDispatchArgs,
  applyPromotionCheckpointReadback,
  assertPromotionDispatchBudget,
  buildAdminOneShotAdmission,
  buildStableReleaseSession,
  classifyWorkflowRunObservation,
  completeLocalActivation,
  decodeWorkflowRunReadback,
  desktopReleaseDispatchArgs,
  desktopReleaseMutationPayload,
  dispatchEmergencyCancel,
  executeBrokeredReleaseMutation,
  formatCommandFailure,
  fullAddonMutationPayload,
  minimumPromotionDispatchBudgetMs,
  promoteDispatchArgs,
  promotionMutationPayload,
  promotionCheckpointReceiptsFromJobs,
  qualificationMutationPayload,
  qualificationRetryDispatchArgs,
  start as startStableRelease,
  standardReleaseCircuitBreaker,
  transitionStableReleaseSession,
  validateAcceptedWorkflowRunIdentity,
  watchRunToTerminal,
  applyAddonDebtDisposition,
  type StableReleaseSession,
} from '../../scripts/run-stable-release.ts';
import {
  assertPromotionTargetIsNewerThanLatest,
  compareStableReleaseVersions,
} from '../../scripts/stable-release-version-order.ts';
import { currentReleaseCalendarDate } from '../../scripts/release-version.ts';
import { verifyAdminOneShotAdmission } from '../../scripts/verify-release-broker-acceptance.ts';
import {
  appendStableReleaseEfficiencyAdvisory,
  appendReleaseMutationAttemptEvent,
  appendQualificationAttempt,
  appendQualificationAttemptEvent,
  createStableReleaseSessionAtomic,
  issueReleaseMutationLease,
  inspectStableReleaseSessionLock,
  planReleaseMutationAttempt,
  recoverStaleStableReleaseSessionLock,
  readStableReleaseSession,
  validateStableReleaseSessionInvariants,
  writeStableReleaseSessionAtomic,
} from '../../scripts/stable-release-session.ts';
import { buildReleaseSessionLease, type ReleaseMutation } from '../../scripts/release-session-lease.ts';
import { releaseMutationPayloadSha256 } from '../../scripts/release-mutation-payload.ts';
import {
  buildCredentialIsolationReceipt,
  readReleaseBrokerAuthority,
  releaseBrokerAuthoritySha256,
  type ReleaseBrokerAuthorityV1,
} from '../../scripts/release-broker-authority.ts';
import {
  buildReleaseMutationAcceptanceReceipt,
  type ReleaseMutationBroker,
} from '../../scripts/release-mutation-broker.ts';

const appSha = 'a'.repeat(40);
const shellSha = 'b'.repeat(40);
const frameworkSha = 'c'.repeat(40);
const liveAdmissionAt = new Date(Date.now() - 5 * 60_000).toISOString();
const repositoryHeadResult = spawnSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], { encoding: 'utf8' });
assert.equal(repositoryHeadResult.status, 0, repositoryHeadResult.stderr || repositoryHeadResult.stdout);
const repositoryHead = repositoryHeadResult.stdout.trim();
assert.match(repositoryHead, /^[0-9a-f]{40}$/);
const brokerKeys = crypto.generateKeyPairSync('ed25519');
const brokerPrivateKeyPem = brokerKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const brokerPublicKeyPem = brokerKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const testBroker = (input: Parameters<typeof buildReleaseSessionLease>[0]) => buildReleaseSessionLease({
  ...input, signingPrivateKeyPem: brokerPrivateKeyPem, keyId: 'test-release-broker',
});
const brokerAuthorityRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-broker-authority-'));
const brokerAuthorityPath = path.join(brokerAuthorityRoot, 'authority.json');
const canonicalBrokerAuthority = readReleaseBrokerAuthority();
const brokerAuthority: ReleaseBrokerAuthorityV1 = {
  ...canonicalBrokerAuthority,
  status: 'provisioned',
  authority_epoch: 1,
  historical_verification_epochs: [],
  mutation_broker: {
    ...canonicalBrokerAuthority.mutation_broker,
    executable_path: '/usr/local/libexec/opl-release-broker-test',
    executable_sha256: `sha256:${'e'.repeat(64)}`,
    executable_codesign_identity: 'com.onepersonlab.release-broker.test',
    approved_controller_workflow_shas: [appSha, 'f'.repeat(40)],
  },
  trusted_ed25519_public_keys: {
    'test-release-broker': brokerPublicKeyPem,
  },
  credential_isolation: {
    ...canonicalBrokerAuthority.credential_isolation,
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
fs.writeFileSync(brokerAuthorityPath, `${JSON.stringify(brokerAuthority, null, 2)}\n`);
const isolationReceiptPath = path.join(brokerAuthorityRoot, 'credential-isolation.json');
const isolationNow = Date.now();
const isolationReceipt = buildCredentialIsolationReceipt({
  authority: brokerAuthority,
  observedAt: new Date(isolationNow - 30_000).toISOString(), expiresAt: new Date(isolationNow + 14 * 60_000).toISOString(),
  normalActor: 'codex-read-only', normalTokenFingerprint: `sha256:${'1'.repeat(64)}`,
  brokerActor: 'opl-release-broker[bot]', brokerTokenFingerprint: `sha256:${'2'.repeat(64)}`,
  brokerBackend: 'isolated-github-app-service', privateKeyBackend: 'macos-keychain-release-broker',
  brokerEndpointPath: brokerAuthority.mutation_broker.executable_path,
  brokerEndpointSha256: brokerAuthority.mutation_broker.executable_sha256!,
  brokerEndpointCodesignIdentity: brokerAuthority.mutation_broker.executable_codesign_identity!,
  callerAdmissionBackend: 'launchd-xpc-peer-credential',
  operatorActor: 'gaofeng21cn', operatorIdentitySource: 'broker_authenticated_caller',
  keyId: 'test-release-broker', signingPrivateKeyPem: brokerPrivateKeyPem,
});
fs.writeFileSync(isolationReceiptPath, `${JSON.stringify(isolationReceipt, null, 2)}\n`);
process.env.OPL_RELEASE_BROKER_CREDENTIAL_ISOLATION_RECEIPT_PATH = isolationReceiptPath;
test.after(() => fs.rmSync(brokerAuthorityRoot, { recursive: true, force: true }));

test('plan is a pure read and never creates or rewrites the requested state path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-plan-'));
  const statePath = path.join(root, 'release-session.json');
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/run-stable-release.ts',
    'plan',
    '--version', '26.7.18',
    '--release-mode', 'new_release',
    '--release-intent', 'stable_complete',
    '--include-full-package', 'true',
    '--run-vm-smoke', 'true',
    '--publish-docker-webui', 'false',
    '--app-ref', repositoryHead,
    '--shell-ref', repositoryHead,
    '--framework-ref', repositoryHead,
    '--shell-root', process.cwd(),
    '--framework-root', process.cwd(),
    '--state', statePath,
  ], { cwd: process.cwd(), encoding: 'utf8' });
  try {
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).schema, 'opl_app_stable_release_session.v3');
    assert.equal(fs.existsSync(statePath), false);
    assert.equal(fs.existsSync(`${statePath}.lock`), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('start dry-run is pure and start --execute refuses every existing session path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-start-purity-'));
  const statePath = path.join(root, 'release-session.json');
  const cohortArgs = [
    '--version', '26.7.18', '--release-mode', 'new_release', '--release-intent', 'stable_complete',
    '--include-full-package', 'true', '--run-vm-smoke', 'true', '--publish-docker-webui', 'false',
    '--app-ref', repositoryHead, '--shell-ref', repositoryHead, '--framework-ref', repositoryHead,
    '--shell-root', process.cwd(), '--framework-root', process.cwd(), '--state', statePath,
  ];
  try {
    fs.writeFileSync(statePath, 'do-not-overwrite\n');
    const dry = spawnSync(process.execPath, [
      '--experimental-strip-types', 'scripts/run-stable-release.ts', 'start', ...cohortArgs,
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(dry.status, 0, dry.stderr || dry.stdout);
    assert.equal(fs.readFileSync(statePath, 'utf8'), 'do-not-overwrite\n');
    assert.equal(fs.existsSync(`${statePath}.lock`), false);

    const planResult = spawnSync(process.execPath, [
      '--experimental-strip-types', 'scripts/run-stable-release.ts', 'plan', ...cohortArgs,
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(planResult.status, 0, planResult.stderr || planResult.stdout);
    fs.writeFileSync(statePath, planResult.stdout);
    const before = fs.readFileSync(statePath, 'utf8');
    const execute = spawnSync(process.execPath, [
      '--experimental-strip-types', 'scripts/run-stable-release.ts', 'start', ...cohortArgs, '--execute',
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(execute.status, 0);
    assert.match(execute.stderr, /use status, reconcile, or resume/);
    assert.equal(fs.readFileSync(statePath, 'utf8'), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function acceptanceForRequest(
  request: Parameters<ReleaseMutationBroker>[0],
  runId: string | null,
) {
  const acceptedAt = new Date().toISOString();
  const lease = buildReleaseSessionLease({
    stableSessionId: request.stable_session_id,
    releaseCohortRef: request.release_cohort_ref,
    repository: request.github.repository,
    operatorActor: request.operator_actor,
    brokerActor: brokerAuthority.broker_identity.github_actor,
    attemptId: request.attempt_id,
    workflow: request.workflow,
    artifactKind: request.artifact_kind,
    controllerWorkflowSha: request.controller_workflow_sha,
    artifactAppSha: request.artifact_app_sha,
    mutationPayloadSha256: request.mutation_payload_sha256,
    plannedSessionRevision: request.planned_session_revision,
    mutation: request.mutation,
    targetAttemptId: request.mutation === 'workflow_cancel' ? request.mutation_payload.target_attempt_id : undefined,
    targetRunId: request.mutation === 'workflow_cancel' ? request.github.target_run_id ?? undefined : undefined,
    issuedAt: acceptedAt,
    signingPrivateKeyPem: brokerPrivateKeyPem,
    keyId: 'test-release-broker',
  });
  return buildReleaseMutationAcceptanceReceipt({
    request, lease, acceptedAt,
    brokerActor: brokerAuthority.broker_identity.github_actor,
    brokerTokenFingerprint: `sha256:${'2'.repeat(64)}`,
    requestId: `request-${request.attempt_id.slice(-8)}`,
    runId,
    keyId: 'test-release-broker',
    signingPrivateKeyPem: brokerPrivateKeyPem,
    credentialIsolationReceipt: isolationReceipt,
  });
}

const testMutationBroker: ReleaseMutationBroker = (request) =>
  acceptanceForRequest(request, request.github.target_run_id);

function plan(generatedAt = liveAdmissionAt): ReleaseCohortPlan {
  return {
    schema: 'opl_app_release_cohort_plan.v1',
    generated_at: generatedAt,
    version: '26.7.12',
    tag: 'v26.7.12',
    release_mode: 'new_release',
    release_intent: 'stable_complete',
    full_omission_reason: null,
    operator_plan_ref: `sha256:${'d'.repeat(64)}`,
    gate_reuse_plan_ref: null,
    app_commit: appSha,
    shell_ref: 'main',
    framework_ref: 'main',
    include_full_package: true,
    run_vm_smoke: true,
    publish_docker_webui: true,
    cohort_lock: {
      schema: 'opl_app_release_cohort_lock.v1',
      generated_at: generatedAt,
      app: { requested_ref: 'main', resolved_sha: appSha, repo_root: '/app' },
      shell: { requested_ref: 'main', resolved_sha: shellSha, repo_root: '/shell' },
      framework: { requested_ref: 'main', resolved_sha: frameworkSha, repo_root: '/framework' },
      authority_boundary: {
        cohort_lock_can_dispatch_workflow: false,
        cohort_lock_can_publish_release: false,
        cohort_lock_can_write_runtime_truth: false,
      },
    },
    cheap_gates: [
      { id: 'source', required: true, command: 'npm run source', purpose: 'source' },
      { id: 'duplicate', required: true, command: 'npm run source', purpose: 'duplicate' },
      { id: 'preflight', required: true, command: 'npm run preflight', purpose: 'preflight' },
    ],
    next_action: { action: 'run_release_train_with_vm_smoke', command: 'unused', reason: 'test' },
    authority_boundary: {
      cohort_plan_can_publish_release: false,
      cohort_plan_can_write_runtime_truth: false,
      cohort_plan_can_claim_release_ready: false,
    },
  };
}

test('admin one-shot dispatch passes the exact required digest and verifier rejects embedded payload tampering', () => {
  let session = buildStableReleaseSession(plan('2026-07-18T00:00:00.000Z'), undefined, '2026-07-18T00:00:00.000Z');
  const payload = desktopReleaseMutationPayload(session);
  const planned = planReleaseMutationAttempt(session, {
    mutation: 'desktop_release_dispatch', workflow: 'desktop-release.yml', artifactKind: 'standard',
    admissionMode: 'admin_one_shot_controller', controllerWorkflowSha: appSha, artifactAppSha: appSha,
    mutationPayloadSha256: releaseMutationPayloadSha256(payload), mutationPayload: payload,
    at: '2026-07-18T00:01:00.000Z', reason: 'admin admission test',
  });
  session = appendReleaseMutationAttemptEvent(planned.session, planned.attemptId, {
    at: '2026-07-18T00:01:01.000Z', state: 'dispatching', run_id: null, reason: 'durable admin fence',
  });
  const admission = buildAdminOneShotAdmission(session, planned.attemptId, payload, '2026-07-18T00:01:01.000Z');
  const args = adminOneShotDispatchArgs(admission);
  assert.equal(args.some((value) => value.startsWith('release_mutation_payload_base64=')), false);
  assert.ok(args.includes(`release_mutation_payload_sha256=${admission.request.mutation_payload_sha256}`));
  assert.equal(args.filter((value) => value.startsWith('release_mutation_payload_sha256=')).length, 1);
  for (const [key, value] of Object.entries(payload)) {
    assert.equal(args.filter((arg) => arg === `${key}=${value}`).length, 1, `${key} must be passed exactly once`);
  }
  const expected = {
    repository: session.repo, runId: '301', runAttempt: 1, workflow: 'desktop-release.yml',
    workflowSha: appSha, payloadSha256: admission.request.mutation_payload_sha256, attemptId: planned.attemptId,
  };
  const verified = verifyAdminOneShotAdmission({
    authority: canonicalBrokerAuthority, admission, expected,
    operatorActor: 'gaofeng21cn', githubActor: 'gaofeng21cn', verifiedAt: '2026-07-18T00:01:02.000Z',
  });
  assert.equal(verified.mode, 'admin-one-shot');
  const tampered = structuredClone(admission);
  tampered.request.mutation_payload.shell_ref = 'f'.repeat(40);
  assert.throws(() => verifyAdminOneShotAdmission({
    authority: canonicalBrokerAuthority, admission: tampered, expected,
    operatorActor: 'gaofeng21cn', githubActor: 'gaofeng21cn', verifiedAt: '2026-07-18T00:01:02.000Z',
  }), /embedded mutation payload digest/);
});

test('admin one-shot attempts reject the CLI cancel path', () => {
  let session = buildStableReleaseSession(plan(), undefined, liveAdmissionAt);
  const payload = desktopReleaseMutationPayload(session);
  const planned = planReleaseMutationAttempt(session, {
    mutation: 'desktop_release_dispatch', workflow: 'desktop-release.yml', artifactKind: 'standard',
    admissionMode: 'admin_one_shot_controller', controllerWorkflowSha: appSha, artifactAppSha: appSha,
    mutationPayloadSha256: releaseMutationPayloadSha256(payload), mutationPayload: payload,
    reason: 'admin cancel rejection',
  });
  session = appendReleaseMutationAttemptEvent(planned.session, planned.attemptId, {
    at: new Date().toISOString(), state: 'running', run_id: '301', reason: 'exact admin run',
  });
  assert.throws(() => dispatchEmergencyCancel(
    session, '/tmp/admin-cancel-must-not-write.json', '301', 'must reject', () => {
      throw new Error('runner must not be called');
    },
  ), /Admin one-shot release attempts cannot be cancelled/);
});

function sessionWithActiveReleaseRun(
  runId: string,
  admittedAt = '2026-07-18T00:00:00.000Z',
): StableReleaseSession {
  const admittedAtMs = Date.parse(admittedAt);
  let session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
  const payload = desktopReleaseMutationPayload(session);
  const planned = planReleaseMutationAttempt(session, {
    mutation: 'desktop_release_dispatch', workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: appSha, artifactAppSha: appSha,
    mutationPayloadSha256: releaseMutationPayloadSha256(payload), mutationPayload: payload,
    at: new Date(admittedAtMs + 60_000).toISOString(), reason: 'active release run fixture',
  });
  session = appendReleaseMutationAttemptEvent(planned.session, planned.attemptId, {
    at: new Date(admittedAtMs + 61_000).toISOString(), state: 'acceptance_pending_visibility', run_id: runId,
    reason: 'exact active release run fixture',
  });
  session.release_run = { id: runId, url: `https://example.test/${runId}`, conclusion: null };
  return session;
}

function authorize(
  session: ReturnType<typeof buildStableReleaseSession>,
  mutation: ReleaseMutation,
  workflow: 'desktop-release.yml' | 'opl-first-run-vm.yml' | 'desktop-release-promote.yml',
  artifactKind: 'standard' | 'full' | 'promotion',
  controllerWorkflowSha = appSha,
  artifactAppSha = appSha,
  mutationPayloadSha256 = `sha256:${'8'.repeat(64)}`,
) {
  const planned = planReleaseMutationAttempt(session, {
    mutation, workflow, artifactKind, controllerWorkflowSha, artifactAppSha,
    mutationPayloadSha256, reason: 'test authorization',
  });
  planned.session.revision = planned.session.mutation_attempts.at(-1)!.planned_session_revision;
  return issueReleaseMutationLease(planned.session, {
    actor: 'gaofeng21cn', attemptId: planned.attemptId,
    workflow, artifactKind, controllerWorkflowSha, artifactAppSha, mutation,
    broker: testBroker, authority: brokerAuthority,
  }).session;
}

test('stable release session freezes one cohort and deduplicates cheap gates', () => {
  const admittedAt = '2026-07-12T00:00:00.000Z';
  const session = buildStableReleaseSession(plan(admittedAt), 'gaofeng21cn/one-person-lab-app', admittedAt);
  assert.equal(session.version, '26.7.12');
  assert.equal(session.source_gates.length, 2);
  assert.equal(session.efficiency_policy.desktop_release_dispatch_limit_per_cohort, 1);
  assert.equal(session.efficiency_policy.cross_cohort_artifact_reuse_allowed, false);
  assert.equal(session.authority_boundary.execute_flag_required_for_external_mutation, true);
  assert.equal(session.schema, 'opl_app_stable_release_session.v3');
  assert.deepEqual(session.mutation_leases, []);
  assert.equal(session.metrics.artifact_build_count, 0);
  assert.equal(session.metrics.promotion_retry_count, 0);
  assert.equal(session.efficiency_policy.monitor_transport_retry_limit, 3);
});

test('create-only session persistence never replaces even the same session identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-create-only-'));
  const statePath = path.join(root, 'session.json');
  try {
    const initial = buildStableReleaseSession(plan());
    createStableReleaseSessionAtomic(statePath, initial);
    const before = fs.readFileSync(statePath, 'utf8');
    const sameIdentity = buildStableReleaseSession(plan());
    assert.throws(
      () => createStableReleaseSessionAtomic(statePath, sameIdentity),
      /status, reconcile, or resume/,
    );
    assert.equal(fs.readFileSync(statePath, 'utf8'), before);
    assert.equal(fs.existsSync(`${statePath}.lock`), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('read and write reject terminal truth without both validated receipt digests', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-terminal-invariant-'));
  const statePath = path.join(root, 'session.json');
  try {
    const invalid = buildStableReleaseSession(plan());
    invalid.phase = 'standard_stable_terminal';
    invalid.terminal_truth.standard_status = 'terminal';
    invalid.terminal_truth.standard_terminal_at = new Date().toISOString();
    invalid.metrics.standard_completed_at = invalid.terminal_truth.standard_terminal_at;
    assert.match(validateStableReleaseSessionInvariants(invalid).join('; '), /local activation.*promotion saga/);
    assert.throws(() => writeStableReleaseSessionAtomic(statePath, invalid), /invariant violation/);
    fs.writeFileSync(statePath, `${JSON.stringify(invalid, null, 2)}\n`);
    assert.throws(() => readStableReleaseSession(statePath), /invariant violation/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('legacy deadline-blocked sessions recover blocked terminal truth instead of resuming', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-deadline-fallback-'));
  const statePath = path.join(root, 'session.json');
  try {
    const startedAt = Date.parse('2026-07-18T00:00:00.000Z');
    const deadlineAt = new Date(startedAt + 90 * 60 * 1_000).toISOString();
    const admittedAt = new Date(startedAt).toISOString();
    const initial = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
    const blocked = transitionStableReleaseSession(
      initial, 'standard_deadline_blocked', 'legacy deadline blocker', deadlineAt,
      { stage: 'cohort_planning', run_id: null },
    );
    delete (blocked as Partial<StableReleaseSession>).terminal_truth;
    fs.writeFileSync(statePath, `${JSON.stringify(blocked, null, 2)}\n`);

    const recovered = readStableReleaseSession(statePath);
    assert.equal(recovered.phase, 'standard_deadline_blocked');
    assert.equal(recovered.terminal_truth.standard_status, 'blocked');
    assert.equal(recovered.terminal_truth.standard_terminal_at, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('every signed mutation lease requires a durable matching planned attempt', () => {
  const session = buildStableReleaseSession(plan());
  assert.throws(() => issueReleaseMutationLease(session, {
    actor: 'gaofeng21cn', attemptId: `sha256:${'9'.repeat(64)}`,
    workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: appSha, artifactAppSha: appSha,
    mutation: 'desktop_release_dispatch', broker: testBroker, authority: brokerAuthority,
  }), /durable planned attempt/);
  const planned = planReleaseMutationAttempt(session, {
    mutation: 'desktop_release_dispatch', workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: appSha, artifactAppSha: appSha, reason: 'test durable pre-mutation ledger',
    mutationPayloadSha256: `sha256:${'8'.repeat(64)}`,
  });
  assert.equal(planned.session.mutation_attempts[0].events[0].state, 'planned');
  planned.session.revision = planned.session.mutation_attempts[0].planned_session_revision;
  assert.throws(() => issueReleaseMutationLease(planned.session, {
    actor: 'gaofeng21cn', attemptId: planned.attemptId,
    workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: frameworkSha, artifactAppSha: appSha,
    mutation: 'desktop_release_dispatch', broker: testBroker, authority: brokerAuthority,
  }), /does not match/);
  const issued = issueReleaseMutationLease(planned.session, {
    actor: 'gaofeng21cn', attemptId: planned.attemptId,
    workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: appSha, artifactAppSha: appSha,
    mutation: 'desktop_release_dispatch', broker: testBroker, authority: brokerAuthority,
  });
  assert.throws(() => issueReleaseMutationLease(issued.session, {
    actor: 'gaofeng21cn', attemptId: planned.attemptId,
    workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: appSha, artifactAppSha: appSha,
    mutation: 'desktop_release_dispatch', broker: testBroker, authority: brokerAuthority,
  }), /already has/);
  const dispatching = appendReleaseMutationAttemptEvent(planned.session, planned.attemptId, {
    at: new Date().toISOString(), state: 'dispatching', run_id: null, reason: 'test',
  });
  assert.throws(() => issueReleaseMutationLease(dispatching, {
    actor: 'gaofeng21cn', attemptId: planned.attemptId,
    workflow: 'desktop-release.yml', artifactKind: 'standard',
    controllerWorkflowSha: appSha, artifactAppSha: appSha,
    mutation: 'desktop_release_dispatch', broker: testBroker, authority: brokerAuthority,
  }), /planned state/);
});

test('the same durable attempt is idempotent and late broker attribution can recover dispatch_lost', () => {
  const session = buildStableReleaseSession(plan());
  const payload = desktopReleaseMutationPayload(session);
  const input = {
    mutation: 'desktop_release_dispatch' as const,
    workflow: 'desktop-release.yml' as const,
    artifactKind: 'standard' as const,
    controllerWorkflowSha: appSha,
    artifactAppSha: appSha,
    mutationPayloadSha256: releaseMutationPayloadSha256(payload),
    mutationPayload: payload,
    reason: 'idempotent recovery test',
  };
  const first = planReleaseMutationAttempt(session, input);
  const replay = planReleaseMutationAttempt(first.session, { ...input, at: new Date().toISOString() });
  assert.equal(replay.attemptId, first.attemptId);
  assert.equal(replay.session.mutation_attempts.length, 1);
  const lost = appendReleaseMutationAttemptEvent(replay.session, first.attemptId, {
    at: new Date().toISOString(), state: 'dispatch_lost', run_id: null, reason: 'broker ledger temporarily unavailable',
  });
  const stillSame = planReleaseMutationAttempt(lost, input);
  assert.equal(stillSame.attemptId, first.attemptId);
  assert.equal(stillSame.session.mutation_attempts.length, 1);
  const recovered = appendReleaseMutationAttemptEvent(lost, first.attemptId, {
    at: new Date().toISOString(), state: 'running', run_id: '7001', reason: 'late exact broker ledger attribution',
  });
  assert.equal(recovered.mutation_attempts[0].events.at(-1)?.run_id, '7001');
});

test('runner_lost qualification remains reconcile-only and accepts late exact receipt attribution', () => {
  const initial = appendQualificationAttempt(buildStableReleaseSession(plan()), {
    artifactKind: 'standard', workflow: 'opl-first-run-vm.yml', mutation: 'qualification_dispatch',
    reason: 'late receipt test',
  });
  let session = appendQualificationAttemptEvent(initial.session, 'standard', initial.attemptId, {
    at: new Date().toISOString(), state: 'runner_lost', run_id: '7004', conclusion: 'success',
    failure_taxonomy: 'infrastructure', remote_receipt_ref: null,
    retry_disposition: 'reconcile_only', retry_reason: 'receipt visibility lag',
    reason: 'first readback could not see the durable receipt',
  });
  session = appendQualificationAttemptEvent(session, 'standard', initial.attemptId, {
    at: new Date().toISOString(), state: 'running', run_id: '7004', conclusion: null,
    failure_taxonomy: 'none', remote_receipt_ref: null,
    retry_disposition: 'reconcile_only', retry_reason: 'late exact receipt observed',
    reason: 'read-only reconcile recovered the exact run attribution',
  });
  session = appendQualificationAttemptEvent(session, 'standard', initial.attemptId, {
    at: new Date().toISOString(), state: 'passed', run_id: '7004', conclusion: 'success',
    failure_taxonomy: 'none', remote_receipt_ref: 'opl-first-run-vm-standard-7004',
    remote_receipt_sha256: 'a'.repeat(64), retry_disposition: 'reconcile_only', retry_reason: 'terminal evidence bound',
    reason: 'late exact receipt validated against frozen identity',
  });
  assert.equal(session.artifact_tracks.standard.attempts[0].events.at(-1)?.state, 'passed');
});

test('broker acceptance requires exact run_id and replays without mutation after authority rotation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-exact-acceptance-'));
  const statePath = path.join(root, 'session.json');
  try {
    let session = buildStableReleaseSession(plan());
    const payload = desktopReleaseMutationPayload(session);
    const planned = planReleaseMutationAttempt(session, {
      mutation: 'desktop_release_dispatch', workflow: 'desktop-release.yml', artifactKind: 'standard',
      controllerWorkflowSha: appSha, artifactAppSha: appSha,
      mutationPayloadSha256: releaseMutationPayloadSha256(payload), mutationPayload: payload,
      reason: 'exact acceptance test',
    });
    session = planned.session;
    writeStableReleaseSessionAtomic(statePath, session);
    assert.throws(
      () => executeBrokeredReleaseMutation(
        session, statePath, planned.attemptId, payload,
        { repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
        (request) => acceptanceForRequest(request, null), brokerAuthority,
      ),
      /invalid acceptance receipt|exact numeric GitHub run_id/,
    );
    session = readStableReleaseSession(statePath);
    assert.equal(session.mutation_attempts[0].events.at(-1)?.state, 'dispatching');
    assert.equal(session.mutation_acceptances.length, 0);
    assert.match(session.mutation_attempts[0].broker_lookup.request_sha256 ?? '', /^sha256:[0-9a-f]{64}$/);
    assert.throws(
      () => executeBrokeredReleaseMutation(
        session, statePath, planned.attemptId, payload,
        { repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
        () => { throw new Error('must not resubmit a fenced request'); }, brokerAuthority,
      ),
      /broker ledger reconcile and never resubmit/,
    );

    const successPath = path.join(root, 'success-session.json');
    session = buildStableReleaseSession(plan());
    const successPayload = desktopReleaseMutationPayload(session);
    const successPlanned = planReleaseMutationAttempt(session, {
      mutation: 'desktop_release_dispatch', workflow: 'desktop-release.yml', artifactKind: 'standard',
      controllerWorkflowSha: appSha, artifactAppSha: appSha,
      mutationPayloadSha256: releaseMutationPayloadSha256(successPayload), mutationPayload: successPayload,
      reason: 'exact acceptance success test',
    });
    session = successPlanned.session;
    writeStableReleaseSessionAtomic(successPath, session);
    let brokerCalls = 0;
    const accepted = executeBrokeredReleaseMutation(
      session, successPath, successPlanned.attemptId, successPayload,
      { repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
      (request) => {
        brokerCalls += 1;
        return acceptanceForRequest(request, '7002');
      },
      brokerAuthority,
    );
    assert.equal(brokerCalls, 1);
    const persisted = readStableReleaseSession(successPath);
    assert.equal(persisted.mutation_acceptances[0].github.run_id, '7002');
    assert.equal(persisted.release_run.id, '7002');
    assert.equal(persisted.mutation_attempts[0].events.at(-1)?.state, 'acceptance_pending_visibility');
    assert.equal(persisted.revision, accepted.session.revision);

    const replayed = executeBrokeredReleaseMutation(
      persisted, successPath, successPlanned.attemptId, successPayload,
      { repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
      () => {
        brokerCalls += 1;
        throw new Error('must not call broker for durable acceptance');
      },
      brokerAuthority,
    );
    assert.equal(brokerCalls, 1);
    assert.equal(replayed.receipt.github.run_id, '7002');

    const rotatedKeys = crypto.generateKeyPairSync('ed25519');
    const rotatedAuthority: ReleaseBrokerAuthorityV1 = {
      ...brokerAuthority,
      authority_epoch: 2,
      trusted_ed25519_public_keys: {
        rotated: rotatedKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      },
      historical_verification_epochs: [{
        authority_epoch: brokerAuthority.authority_epoch,
        authority_sha256: releaseBrokerAuthoritySha256(brokerAuthority),
        authority_snapshot_base64: Buffer.from(JSON.stringify(brokerAuthority), 'utf8').toString('base64'),
        trusted_key_ids: ['test-release-broker'],
        admission_closed: true,
        verify_only: true,
      }],
    };
    let rotatedBrokerCalls = 0;
    const replayedAfterRotation = executeBrokeredReleaseMutation(
      persisted, successPath, successPlanned.attemptId, successPayload,
      { repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
      () => {
        rotatedBrokerCalls += 1;
        throw new Error('historical acceptance replay must not submit a new broker mutation');
      },
      rotatedAuthority,
    );
    assert.equal(rotatedBrokerCalls, 0);
    assert.equal(replayedAfterRotation.receipt.github.run_id, '7002');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('broker admission after 90 minutes durably blocks before any external mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-broker-deadline-block-'));
  const statePath = path.join(root, 'session.json');
  try {
    const startedAt = Date.parse('2026-07-18T00:00:00.000Z');
    const admittedAt = new Date(startedAt).toISOString();
    let session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
    session = transitionStableReleaseSession(
      session, 'source_gates_passed', 'passed', new Date(startedAt + 1_000).toISOString(),
    );
    const payload = desktopReleaseMutationPayload(session);
    const planned = planReleaseMutationAttempt(session, {
      mutation: 'desktop_release_dispatch', workflow: 'desktop-release.yml', artifactKind: 'standard',
      controllerWorkflowSha: appSha, artifactAppSha: appSha,
      mutationPayloadSha256: releaseMutationPayloadSha256(payload), mutationPayload: payload,
      at: new Date(startedAt + 2_000).toISOString(), reason: 'deadline admission test',
    });
    session = planned.session;
    writeStableReleaseSessionAtomic(statePath, session);
    let brokerCalls = 0;
    assert.throws(
      () => executeBrokeredReleaseMutation(
        session, statePath, planned.attemptId, payload,
        { repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
        () => {
          brokerCalls += 1;
          throw new Error('deadline-blocked admission must not call the broker');
        },
        brokerAuthority,
      ),
      /cannot reach broker admission after the immutable 90-minute Standard deadline/,
    );
    assert.equal(brokerCalls, 0);
    const blocked = readStableReleaseSession(statePath);
    assert.equal(blocked.phase, 'standard_deadline_blocked');
    assert.equal(blocked.standard_deadline_blocker?.stage, 'broker_admission:desktop_release_dispatch');
    assert.equal(blocked.standard_deadline_blocker?.remaining_ms, 0);
    assert.equal(blocked.mutation_attempts[0].events.at(-1)?.state, 'planned');
    assert.equal(blocked.mutation_acceptances.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('emergency cancel persists planned state before the isolated broker and never uses the normal runner for mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-emergency-cancel-'));
  const statePath = path.join(root, 'session.json');
  try {
    const session = sessionWithActiveReleaseRun('12345', liveAdmissionAt);
    writeStableReleaseSessionAtomic(statePath, session);
    let normalRunnerCalls = 0;
    let brokerCalls = 0;
    const broker: ReleaseMutationBroker = (request) => {
      brokerCalls += 1;
      const persisted = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      assert.equal(persisted.mutation_attempts.at(-1).events.at(-1).state, 'dispatching');
      assert.equal(persisted.mutation_leases.length, 0);
      return testMutationBroker(request);
    };
    const result = dispatchEmergencyCancel(session, statePath, '12345', 'operator detected wrong cohort', () => {
      normalRunnerCalls += 1;
      throw new Error('normal controller runner must remain read-only');
    }, new Date().toISOString(), undefined, broker, brokerAuthority);
    assert.equal(normalRunnerCalls, 0);
    assert.equal(brokerCalls, 1);
    assert.equal(result.mutation_leases.at(-1)?.authorization_class, 'emergency_cancel');
    assert.equal(result.mutation_acceptances.length, 1);
    assert.equal(result.mutation_attempts.at(-1)?.events.at(-1)?.state, 'running');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('unprovisioned authority leaves emergency cancel planned without calling GitHub', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-emergency-cancel-blocked-'));
  const statePath = path.join(root, 'session.json');
  try {
    const session = sessionWithActiveReleaseRun('54321', liveAdmissionAt);
    writeStableReleaseSessionAtomic(statePath, session);
    let calls = 0;
    assert.throws(
      () => dispatchEmergencyCancel(session, statePath, '54321', 'authority test', () => {
        calls += 1;
        return { status: 0, stdout: '', stderr: '' };
      }),
      /authority is not ready/,
    );
    assert.equal(calls, 0);
    const persisted = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(persisted.mutation_attempts.at(-1).events.at(-1).state, 'planned');
    assert.equal(persisted.mutation_leases.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deadline materializes before an exact emergency cancel and cancel never reopens Standard', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-expired-emergency-cancel-'));
  const statePath = path.join(root, 'session.json');
  try {
    const admittedAt = new Date(Date.now() - 91 * 60_000).toISOString();
    const session = sessionWithActiveReleaseRun('54322', admittedAt);
    writeStableReleaseSessionAtomic(statePath, session);
    const cancelled = dispatchEmergencyCancel(
      session,
      statePath,
      '54322',
      'deadline terminal cleanup',
      () => { throw new Error('normal runner must stay read-only'); },
      new Date().toISOString(),
      undefined,
      testMutationBroker,
      brokerAuthority,
    );
    assert.equal(cancelled.phase, 'standard_deadline_blocked');
    assert.equal(cancelled.terminal_truth.standard_status, 'blocked');
    assert.equal(cancelled.standard_deadline_blocker?.stage, 'emergency_cancel_admission');
    assert.equal(cancelled.mutation_attempts.at(-1)?.mutation, 'workflow_cancel');
    assert.equal(cancelled.mutation_attempts.at(-1)?.events.at(-1)?.state, 'running');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('durability failure before rename prevents API calls and preserves an exact recoverable lock', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-emergency-cancel-fsync-'));
  const statePath = path.join(root, 'session.json');
  try {
    const operationAt = new Date(Date.parse(liveAdmissionAt) + 3 * 60_000).toISOString();
    const session = sessionWithActiveReleaseRun('67890', liveAdmissionAt);
    writeStableReleaseSessionAtomic(statePath, session);
    let calls = 0;
    assert.throws(
      () => dispatchEmergencyCancel(
        session,
        statePath,
        '67890',
        'durability injection',
        () => { calls += 1; return { status: 0, stdout: '', stderr: '' }; },
        operationAt,
        (target, value) => writeStableReleaseSessionAtomic(target, value, {
          afterSessionFsync: () => { throw new Error('injected fsync/rename boundary failure'); },
        }),
        testMutationBroker,
        brokerAuthority,
        () => Date.parse(operationAt),
      ),
      /injected fsync\/rename boundary failure/,
    );
    assert.equal(calls, 0);
    assert.equal(JSON.parse(fs.readFileSync(statePath, 'utf8')).mutation_attempts.length, 1);
    assert.equal(fs.existsSync(`${statePath}.lock`), true);
    const lock = JSON.parse(fs.readFileSync(`${statePath}.lock`, 'utf8'));
    fs.writeFileSync(`${statePath}.lock`, `${JSON.stringify({ ...lock, pid: 2_147_483_647 })}\n`);
    const persisted = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    recoverStaleStableReleaseSessionLock(statePath, { sessionId: persisted.id, revision: persisted.revision });
    assert.equal(fs.existsSync(`${statePath}.lock`), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('parent directory fsync failure after rename prevents API calls and preserves committed-byte recovery', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-emergency-cancel-parent-fsync-'));
  const statePath = path.join(root, 'session.json');
  try {
    const operationAt = new Date(Date.parse(liveAdmissionAt) + 4 * 60_000).toISOString();
    const session = sessionWithActiveReleaseRun('67891', liveAdmissionAt);
    writeStableReleaseSessionAtomic(statePath, session);
    let calls = 0;
    assert.throws(
      () => dispatchEmergencyCancel(
        session,
        statePath,
        '67891',
        'after rename durability injection',
        () => { calls += 1; return { status: 0, stdout: '', stderr: '' }; },
        operationAt,
        (target, value) => writeStableReleaseSessionAtomic(target, value, {
          afterRename: () => { throw new Error('injected parent directory fsync failure'); },
        }),
        testMutationBroker,
        brokerAuthority,
        () => Date.parse(operationAt),
      ),
      /injected parent directory fsync failure/,
    );
    assert.equal(calls, 0);
    assert.equal(fs.existsSync(`${statePath}.lock`), true);
    const lock = JSON.parse(fs.readFileSync(`${statePath}.lock`, 'utf8'));
    fs.writeFileSync(`${statePath}.lock`, `${JSON.stringify({ ...lock, pid: 2_147_483_647 })}\n`);
    const persisted = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(persisted.mutation_attempts.at(-1).events.at(-1).state, 'planned');
    recoverStaleStableReleaseSessionLock(statePath, { sessionId: persisted.id, revision: persisted.revision });
    assert.equal(fs.existsSync(`${statePath}.lock`), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('session writes use an exclusive lock and revision CAS to reject stale broker updates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-session-cas-'));
  const statePath = path.join(root, 'session.json');
  try {
    const initial = buildStableReleaseSession(plan());
    writeStableReleaseSessionAtomic(statePath, initial);
    assert.equal(initial.revision, 1);
    const firstBroker = structuredClone(initial);
    const staleBroker = structuredClone(initial);
    writeStableReleaseSessionAtomic(statePath, firstBroker);
    assert.equal(firstBroker.revision, 2);
    assert.throws(
      () => writeStableReleaseSessionAtomic(statePath, staleBroker),
      /revision conflict: expected 1, current 2/,
    );
    assert.equal(JSON.parse(fs.readFileSync(statePath, 'utf8')).revision, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function writeSimulatedStaleLock(
  statePath: string,
  input: { sessionId: string; baseRevision: number; targetRevision: number; targetBytes: string },
): void {
  fs.writeFileSync(`${statePath}.lock`, `${JSON.stringify({
    host: os.hostname(),
    pid: 2_147_483_647,
    session_id: input.sessionId,
    base_revision: input.baseRevision,
    target_revision: input.targetRevision,
    target_session_sha256: crypto.createHash('sha256').update(input.targetBytes).digest('hex'),
    acquired_at: '2026-07-18T00:00:00.000Z',
  })}\n`);
}

test('stale session lock recovery accepts an exact crash before rename', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-session-lock-before-rename-'));
  const statePath = path.join(root, 'session.json');
  try {
    const session = buildStableReleaseSession(plan());
    writeStableReleaseSessionAtomic(statePath, session);
    const targetBytes = `${JSON.stringify({ ...session, revision: session.revision + 1 }, null, 2)}\n`;
    writeSimulatedStaleLock(statePath, {
      sessionId: session.id,
      baseRevision: session.revision,
      targetRevision: session.revision + 1,
      targetBytes,
    });
    const diagnostic = inspectStableReleaseSessionLock(statePath);
    assert.equal(diagnostic.owner_process_alive, false);
    recoverStaleStableReleaseSessionLock(statePath, { sessionId: session.id, revision: session.revision });
    assert.equal(fs.existsSync(`${statePath}.lock`), false);
    assert.equal(JSON.parse(fs.readFileSync(statePath, 'utf8')).revision, session.revision);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stale session lock recovery accepts exact committed bytes after rename', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-session-lock-after-rename-'));
  const statePath = path.join(root, 'session.json');
  try {
    const session = buildStableReleaseSession(plan());
    writeStableReleaseSessionAtomic(statePath, session);
    const baseRevision = session.revision;
    const targetBytes = `${JSON.stringify({ ...session, revision: baseRevision + 1 }, null, 2)}\n`;
    fs.writeFileSync(statePath, targetBytes);
    writeSimulatedStaleLock(statePath, {
      sessionId: session.id,
      baseRevision,
      targetRevision: baseRevision + 1,
      targetBytes,
    });
    recoverStaleStableReleaseSessionLock(statePath, { sessionId: session.id, revision: baseRevision + 1 });
    assert.equal(fs.existsSync(`${statePath}.lock`), false);
    assert.equal(fs.readFileSync(statePath, 'utf8'), targetBytes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stale session lock recovery rejects a live owner and mismatched committed bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-session-lock-reject-'));
  const statePath = path.join(root, 'session.json');
  try {
    const session = buildStableReleaseSession(plan());
    writeStableReleaseSessionAtomic(statePath, session);
    const targetBytes = `${JSON.stringify({ ...session, revision: session.revision + 1 }, null, 2)}\n`;
    writeSimulatedStaleLock(statePath, {
      sessionId: session.id,
      baseRevision: session.revision,
      targetRevision: session.revision + 1,
      targetBytes,
    });
    const lock = JSON.parse(fs.readFileSync(`${statePath}.lock`, 'utf8'));
    fs.writeFileSync(`${statePath}.lock`, `${JSON.stringify({ ...lock, pid: process.pid })}\n`);
    assert.throws(
      () => recoverStaleStableReleaseSessionLock(statePath, { sessionId: session.id, revision: session.revision }),
      /still alive/,
    );

    fs.writeFileSync(`${statePath}.lock`, `${JSON.stringify({ ...lock, target_session_sha256: 'f'.repeat(64) })}\n`);
    fs.writeFileSync(statePath, targetBytes);
    assert.throws(
      () => recoverStaleStableReleaseSessionLock(statePath, { sessionId: session.id, revision: session.revision + 1 }),
      /pre-rename or post-rename/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function awaitingLocalActivationSession(): StableReleaseSession {
  const admittedAt = '2026-07-18T00:00:00.000Z';
  let session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
  const artifactSha256 = 'e'.repeat(64);
  session.qualification_run.artifact_sha256 = artifactSha256;
  session.artifact_tracks.standard.artifact_sha256 = artifactSha256;
  session.artifact_tracks.standard.qualification_run.artifact_sha256 = artifactSha256;
  const advance = (to: Parameters<typeof transitionStableReleaseSession>[1], at: string) => {
    session = transitionStableReleaseSession(session, to, `fixture ${to}`, at);
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
  return session;
}

function standardTerminalSession(): StableReleaseSession {
  let session = awaitingLocalActivationSession();
  session.receipts = {
    promotion_saga: { ref: 'promotion-saga-test', sha256: 'a'.repeat(64) },
    local_activation: { ref: 'local-activation-test', sha256: 'b'.repeat(64) },
  };
  return transitionStableReleaseSession(
    session, 'standard_stable_terminal', 'fixture standard_stable_terminal', '2026-07-18T00:10:00.000Z',
  );
}

test('awaiting and terminal Standard sessions require one exact qualification artifact SHA-256', () => {
  const awaiting = awaitingLocalActivationSession();
  awaiting.qualification_run.artifact_sha256 = null;
  awaiting.artifact_tracks.standard.qualification_run.artifact_sha256 = null;
  assert.match(
    validateStableReleaseSessionInvariants(awaiting).join('; '),
    /lacks an exact qualification artifact SHA-256|qualification and artifact-track SHA-256 differ/,
  );

  const terminal = standardTerminalSession();
  terminal.qualification_run.artifact_sha256 = null;
  terminal.artifact_tracks.standard.artifact_sha256 = null;
  terminal.artifact_tracks.standard.qualification_run.artifact_sha256 = null;
  assert.match(
    validateStableReleaseSessionInvariants(terminal).join('; '),
    /lacks an exact qualification artifact SHA-256|artifact track lacks an exact artifact SHA-256/,
  );
});

test('local activation evidence read crossing 90:00 durably blocks and cannot record late success', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-complete-local-deadline-'));
  const statePath = path.join(root, 'session.json');
  const receiptPath = path.join(root, 'local-activation.json');
  const policyPath = path.join(root, 'local-policy.json');
  try {
    const session = awaitingLocalActivationSession();
    session.receipts.promotion_saga = { ref: 'promotion-saga-test', sha256: 'a'.repeat(64) };
    writeStableReleaseSessionAtomic(statePath, session);
    fs.writeFileSync(receiptPath, '{}\n');
    fs.writeFileSync(policyPath, '{}\n');
    const deadlineAtMs = Date.parse(session.efficiency_policy.standard_admission_deadline_at);
    assert.throws(
      () => completeLocalActivation(
        { statePath, receiptPath, localAuthorizationPolicyPath: policyPath },
        deadlineAtMs - 1,
        () => deadlineAtMs + 1,
      ),
      /cannot create a successful Standard terminal/,
    );
    const blocked = readStableReleaseSession(statePath);
    assert.equal(blocked.phase, 'standard_deadline_blocked');
    assert.equal(blocked.standard_deadline_blocker?.stage, 'complete_local_activation:evidence_read');
    assert.equal(blocked.receipts.local_activation, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

for (const fullStatus of ['qualified', 'failed'] as const) {
  test(`Standard terminal remains valid when Full is ${fullStatus} and WebUI has typed debt`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `opl-addon-debt-${fullStatus}-`));
    const receiptPath = path.join(root, 'webui-debt.json');
    try {
      let session = standardTerminalSession();
      if (fullStatus === 'qualified') {
        const releaseSetGeneration = '26.7.12-r1';
        const releaseSetManifestDigest = `sha256:${'7'.repeat(64)}`;
        session.addon_tracks.full.release_set_generation = releaseSetGeneration;
        session.addon_tracks.full.release_set_manifest_digest = releaseSetManifestDigest;
        const payload = fullAddonMutationPayload(session, releaseSetGeneration, releaseSetManifestDigest);
        const planned = planReleaseMutationAttempt(session, {
          mutation: 'full_addon_dispatch', workflow: 'desktop-release-full-addon.yml', artifactKind: 'full',
          controllerWorkflowSha: appSha, artifactAppSha: appSha,
          mutationPayloadSha256: releaseMutationPayloadSha256(payload), mutationPayload: payload,
          at: new Date().toISOString(), reason: 'qualified Full fixture uses a signed exact-run acceptance',
        });
        const fullStatePath = path.join(root, 'full-session.json');
        session = planned.session;
        writeStableReleaseSessionAtomic(fullStatePath, session);
        session = executeBrokeredReleaseMutation(
          session,
          fullStatePath,
          planned.attemptId,
          payload,
          { repository: session.repo, operation: 'workflow_dispatch', workflow_ref: 'refs/heads/main', target_run_id: null },
          (request) => acceptanceForRequest(request, '7001'),
          brokerAuthority,
        ).session;
        session = appendReleaseMutationAttemptEvent(session, planned.attemptId, {
          at: new Date().toISOString(), state: 'succeeded', run_id: '7001',
          reason: 'qualified Full fixture exact run completed with bound evidence',
        });
        session.addon_tracks.full = {
          ...session.addon_tracks.full,
          status: 'qualified', conclusion: 'success', receipt_ref: 'full-addon-test', receipt_sha256: 'c'.repeat(64),
        };
      }
      if (fullStatus === 'failed') {
        session.addon_tracks.full.status = fullStatus;
        session.addon_tracks.full.run_id = '7001';
        const fullReceiptPath = path.join(root, 'full-debt.json');
        fs.writeFileSync(fullReceiptPath, `${JSON.stringify({
          schema: 'opl_app_addon_debt_receipt.v1', status: 'blocked_with_debt',
          stable_session_id: session.id, release_cohort_ref: session.cohort_plan.operator_plan_ref, addon: 'full',
          source_status: 'failed', source_attempt_id: 'attempt-full-1', source_run_id: '7001',
          failure_taxonomy: 'infrastructure', disposition_reason: 'typed Full failure debt accepted without changing Standard truth',
          recorded_at: '2026-07-18T00:10:30.000Z',
        })}\n`);
        session = applyAddonDebtDisposition(session, 'full', fullReceiptPath);
        assert.equal(session.phase, 'standard_stable_terminal');
      }
      fs.writeFileSync(receiptPath, `${JSON.stringify({
        schema: 'opl_app_addon_debt_receipt.v1', status: 'blocked_with_debt',
        stable_session_id: session.id, release_cohort_ref: session.cohort_plan.operator_plan_ref, addon: 'webui',
        source_status: 'unavailable', source_attempt_id: null, source_run_id: null,
        failure_taxonomy: 'not_implemented', disposition_reason: 'typed external blocker',
        recorded_at: '2026-07-18T00:11:00.000Z',
      })}\n`);
      session = applyAddonDebtDisposition(session, 'webui', receiptPath);
      assert.equal(session.phase, 'addon_train_terminal');
      assert.equal(session.terminal_truth.standard_status, 'terminal');
      assert.equal(session.terminal_truth.addon_status, 'blocked_with_debt');
      assert.equal(session.addon_tracks.full.status, fullStatus === 'failed' ? 'blocked_with_debt' : fullStatus);
      assert.equal(session.addon_tracks.webui.status, 'blocked_with_debt');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test('nonterminal monitor exits stay recoverable and remote terminal readback wins', () => {
  const interrupted = classifyWorkflowRunObservation(
    { status: 1, stdout: '', stderr: 'TLS handshake timeout' },
    {
      databaseId: 1,
      createdAt: '2026-07-12T00:00:00.000Z',
      headBranch: 'codex/release-26.7.12',
      headSha: appSha,
      status: 'in_progress',
      conclusion: '',
      url: 'https://example.test/running',
    },
  );
  assert.deepEqual(interrupted, { terminal: false, succeeded: false, conclusion: null });

  const completed = classifyWorkflowRunObservation(
    { status: 1, stdout: '', stderr: 'transport ended after completion' },
    {
      databaseId: 1,
      createdAt: '2026-07-12T00:00:00.000Z',
      headBranch: 'codex/release-26.7.12',
      headSha: appSha,
      status: 'completed',
      conclusion: 'success',
      url: 'https://example.test/completed',
    },
  );
  assert.deepEqual(completed, { terminal: true, succeeded: true, conclusion: 'success' });
});

test('monitor retry policy remains compatible with sessions written before the retry field', () => {
  const session = buildStableReleaseSession(plan());
  delete (session.efficiency_policy as Partial<typeof session.efficiency_policy>).monitor_transport_retry_limit;
  assert.equal(session.efficiency_policy.monitor_transport_retry_limit ?? 3, 3);
});

test('workflow readback transport and JSON failures stay retryable', () => {
  assert.deepEqual(
    decodeWorkflowRunReadback({ status: 1, stdout: '', stderr: 'HTTP 403: API rate limit exceeded' }),
    {
      readback: null,
      error: 'workflow run readback failed: HTTP 403: API rate limit exceeded',
    },
  );
  const malformed = decodeWorkflowRunReadback({ status: 0, stdout: '{', stderr: '' });
  assert.equal(malformed.readback, null);
  assert.match(malformed.error ?? '', /invalid JSON/);
});

test('workflow watch has a finite wall-clock budget and leaves the durable run recoverable', async () => {
  const started = Date.parse('2026-07-18T00:00:00.000Z');
  const admittedAt = new Date(started).toISOString();
  let session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed', new Date(started + 1_000).toISOString());
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'dispatched', new Date(started + 2_000).toISOString());
  session.release_run.id = '123456';
  let calls = 0;
  await assert.rejects(
    () => watchRunToTerminal((command, args, options) => {
      calls += 1;
      assert.equal(command, 'gh');
      if (args[1] === 'watch') {
        assert.equal(options?.timeoutMs, 3_600_000);
        return { status: null, stdout: '', stderr: 'timed out', timedOut: true };
      }
      return {
        status: 0,
        stdout: JSON.stringify({ databaseId: 123456, createdAt: '2026-07-18T00:00:00Z', headBranch: 'main', headSha: appSha, status: 'in_progress', url: 'https://example.test/123456' }),
        stderr: '',
      };
    }, session, '123456', () => {}, () => started),
    /wall-clock budget.*recoverable.*no mutation was retried/,
  );
  assert.equal(calls, 2);
  assert.equal(session.release_run.id, '123456');
});

test('Standard circuit breaker permits 89:59 and blocks new trains at 90:00 and 90:01', () => {
  const admittedAt = '2026-07-18T00:00:00.000Z';
  const session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
  const started = Date.parse(session.metrics.session_started_at);
  assert.equal(standardReleaseCircuitBreaker(session, started + 5_399_000), 'new_release_train_allowed');
  assert.equal(standardReleaseCircuitBreaker(session, started + 5_400_000), 'typed_blocker_reconcile_or_emergency_cancel_only');
  assert.equal(standardReleaseCircuitBreaker(session, started + 5_401_000), 'typed_blocker_reconcile_or_emergency_cancel_only');
});

test('watch and resume budget use the immutable admission deadline instead of a fresh phase window', async () => {
  const startedAt = Date.parse('2026-07-18T00:00:00.000Z');
  const admittedAt = new Date(startedAt).toISOString();
  let session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed', new Date(startedAt + 1_000).toISOString());
  session.release_run.id = '7003';
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'accepted', new Date(startedAt + 2_000).toISOString());
  const deadline = Date.parse(session.efficiency_policy.standard_admission_deadline_at);
  for (const [elapsedMinutes, expectedRemaining] of [[30, 1_800_000], [80, 600_000], [89 + 59 / 60, 1_000]] as const) {
    const observedAt = Date.parse(session.metrics.session_started_at) + elapsedMinutes * 60_000;
    let currentTime = observedAt;
    await assert.rejects(
      () => watchRunToTerminal((command, args, options) => {
        assert.equal(command, 'gh');
        if (args[1] === 'watch') {
          assert.equal(options?.timeoutMs, expectedRemaining);
          currentTime += options?.timeoutMs ?? 0;
          return { status: null, stdout: '', stderr: 'deadline', timedOut: true };
        }
        assert.equal(options?.timeoutMs, Math.min(30_000, expectedRemaining));
        return {
          status: 0,
          stdout: JSON.stringify({
            databaseId: 7003, attempt: 1, createdAt: '2026-07-18T00:00:00Z', headBranch: 'main',
            headSha: appSha, status: 'in_progress', url: 'https://example.test/7003',
          }),
          stderr: '',
        };
      }, session, '7003', () => {}, () => currentTime),
      /immutable 90-minute Standard deadline|durable typed blocker/,
    );
  }
  let postDeadlineCalls = 0;
  let deadlineBlocked: StableReleaseSession | null = null;
  await assert.rejects(
    () => watchRunToTerminal(() => {
      postDeadlineCalls += 1;
      return { status: 0, stdout: '', stderr: '' };
    }, session, '7003', (next) => { deadlineBlocked = structuredClone(next); }, () => deadline),
    /immutable 90-minute Standard deadline.*only reconcile or emergency cancel/,
  );
  assert.equal(postDeadlineCalls, 0);
  assert.equal(deadlineBlocked?.phase, 'standard_deadline_blocked');
  assert.equal(deadlineBlocked?.standard_deadline_blocker?.stage, 'workflow_watch:artifact_build_running');
  assert.equal(deadlineBlocked?.standard_deadline_blocker?.run_id, '7003');
  assert.equal(deadlineBlocked?.standard_deadline_blocker?.remaining_ms, 0);
  assert.deepEqual(deadlineBlocked?.standard_deadline_blocker?.legal_next_actions, ['read_only_reconcile', 'emergency_cancel']);
  assert.throws(
    () => transitionStableReleaseSession(deadlineBlocked!, 'artifacts_qualified', 'forbidden resume'),
    /Invalid stable release transition/,
  );
  assert.throws(
    () => planReleaseMutationAttempt(deadlineBlocked!, {
      mutation: 'desktop_release_dispatch', workflow: 'desktop-release.yml', artifactKind: 'standard',
      controllerWorkflowSha: appSha, artifactAppSha: appSha,
      mutationPayloadSha256: `sha256:${'8'.repeat(64)}`, reason: 'forbidden redispatch',
    }),
    /permits only read-only reconcile or an exact emergency cancel/,
  );
  assert.equal(session.efficiency_policy.standard_admission_deadline_at, '2026-07-18T01:30:00.000Z');
});

test('terminal success returned after the immutable deadline cannot bypass the typed blocker', async () => {
  const startedAt = Date.parse('2026-07-18T00:00:00.000Z');
  const admittedAt = new Date(startedAt).toISOString();
  let session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed', new Date(startedAt + 1_000).toISOString());
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'accepted', new Date(startedAt + 2_000).toISOString());
  session.release_run.id = '7006';
  const deadline = Date.parse(session.efficiency_policy.standard_admission_deadline_at);
  let currentTime = deadline - 1_000;
  const persisted: StableReleaseSession[] = [];

  await assert.rejects(
    () => watchRunToTerminal((command, args, options) => {
      assert.equal(command, 'gh');
      if (args[1] === 'watch') {
        assert.equal(options?.timeoutMs, 1_000);
        currentTime = deadline - 1;
        return { status: 1, stdout: '', stderr: 'watch transport ended' };
      }
      assert.equal(options?.timeoutMs, 1);
      currentTime = deadline + 1;
      return {
        status: 0,
        stdout: JSON.stringify({
          databaseId: 7006, attempt: 1, createdAt: '2026-07-18T00:00:00Z', headBranch: 'main',
          headSha: appSha, status: 'completed', conclusion: 'success', url: 'https://example.test/7006',
        }),
        stderr: '',
      };
    }, session, '7006', (next) => { persisted.push(structuredClone(next)); }, () => currentTime),
    /immutable 90-minute Standard deadline during terminal readback/,
  );
  const blocked = persisted.at(-1);
  assert.equal(blocked?.phase, 'standard_deadline_blocked');
  assert.equal(blocked?.terminal_truth.standard_status, 'blocked');
  assert.equal(blocked?.standard_deadline_blocker?.run_id, '7006');
  assert.equal(blocked?.standard_deadline_blocker?.observed_at, new Date(deadline + 1).toISOString());
});

test('workflow watcher persists one 60-minute warning and never duplicates it on resume', async () => {
  const started = Date.parse('2026-07-18T00:00:00.000Z');
  const warningAt = started + 60 * 60_000;
  const admittedAt = new Date(started).toISOString();
  let session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed', new Date(started + 1_000).toISOString());
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'accepted', new Date(started + 2_000).toISOString());
  session.release_run.id = '7005';
  let currentTime = started;
  const watchTimeouts: number[] = [];
  let viewCount = 0;
  const persisted: StableReleaseSession[] = [];
  const result = await watchRunToTerminal((command, args, options) => {
    assert.equal(command, 'gh');
    if (args[1] === 'watch') {
      watchTimeouts.push(options?.timeoutMs ?? -1);
      if (watchTimeouts.length === 1) {
        currentTime = warningAt;
        return { status: null, stdout: '', stderr: 'warning boundary', timedOut: true };
      }
      currentTime = warningAt + 1_000;
      return { status: 1, stdout: '', stderr: 'watch transport ended' };
    }
    viewCount += 1;
    return {
      status: 0,
      stdout: JSON.stringify({
        databaseId: 7005, attempt: 1, createdAt: '2026-07-18T00:00:00Z', headBranch: 'main',
        headSha: appSha, status: viewCount === 1 ? 'in_progress' : 'completed',
        conclusion: viewCount === 1 ? null : 'success', url: 'https://example.test/7005',
      }),
      stderr: '',
    };
  }, session, '7005', (next) => { persisted.push(structuredClone(next)); }, () => currentTime);
  assert.deepEqual(watchTimeouts, [3_600_000, 1_800_000]);
  assert.equal(persisted.length, 1);
  assert.equal(result.session.metrics.efficiency_advisories.length, 1);
  assert.deepEqual(result.session.metrics.efficiency_advisories[0], {
    at: '2026-07-18T01:00:00.000Z', elapsed_ms: 3_600_000, threshold_ms: 3_600_000,
    stage: 'artifact_build_running', status: 'watch_timeout_at_warning_boundary', blocker: 'standard_release_elapsed_60m',
    remaining_ms: 1_800_000, action: 'inspect_current_stage_and_preserve_same_cohort_evidence',
  });

  await watchRunToTerminal((command, args) => {
    if (args[1] === 'watch') return { status: 1, stdout: '', stderr: 'already terminal' };
    return {
      status: 0,
      stdout: JSON.stringify({
        databaseId: 7005, attempt: 1, createdAt: '2026-07-18T00:00:00Z', headBranch: 'main',
        headSha: appSha, status: 'completed', conclusion: 'success', url: 'https://example.test/7005',
      }), stderr: '',
    };
  }, result.session, '7005', (next) => { persisted.push(structuredClone(next)); }, () => warningAt + 2_000);
  assert.equal(persisted.length, 1, 'resume must not persist a duplicate 60-minute warning');
});

test('promotion checkpoint readback uses monotonic local observation time after a 60-minute warning', () => {
  const admittedAtMs = Date.parse('2026-07-18T00:00:00.000Z');
  const admittedAt = new Date(admittedAtMs).toISOString();
  let session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
  const advance = (phase: Parameters<typeof transitionStableReleaseSession>[1], minutes: number) => {
    session = transitionStableReleaseSession(
      session,
      phase,
      `fixture ${phase}`,
      new Date(admittedAtMs + minutes * 60_000).toISOString(),
    );
  };
  advance('source_gates_passed', 1);
  advance('artifact_build_running', 2);
  advance('artifacts_qualified', 3);
  advance('owner_approved', 4);
  advance('promotion_running', 5);
  session = appendStableReleaseEfficiencyAdvisory(session, {
    stage: 'promotion_running', status: 'in_progress', observedAtMs: admittedAtMs + 60 * 60_000,
  });
  const remoteCompletedAt = new Date(admittedAtMs + 55 * 60_000).toISOString();
  const jobs = [
    'Publish release without changing latest',
    'Validate brokered atomic Standard distribution',
    'Verify Standard Homebrew activation',
    'Activate App latest after Standard distribution gates',
  ].map((name) => ({ name, status: 'completed', conclusion: 'success', completedAt: remoteCompletedAt }));
  const observedAt = new Date(admittedAtMs + 65 * 60_000).toISOString();
  const projected = applyPromotionCheckpointReadback(session, jobs, observedAt);
  assert.equal(projected.phase, 'latest_activated');
  assert.equal(projected.updated_at, observedAt);
  assert.equal(projected.transitions.at(-1)?.at, observedAt);
});

test('promotion checkpoint receipt digest is deterministic and bound to the exact source run and completed job', () => {
  const jobs = [{
    name: 'Publish release without changing latest',
    status: 'completed',
    conclusion: 'success',
    completedAt: '2026-07-19T15:10:38Z',
  }];
  const receipt = promotionCheckpointReceiptsFromJobs('29692260682', jobs);
  assert.equal(receipt.length, 1);
  assert.equal(receipt[0]?.checkpoint, 'release_public_nonlatest');
  assert.match(receipt[0]?.receipt_sha256 ?? '', /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(promotionCheckpointReceiptsFromJobs('29692260682', jobs), receipt);
  assert.notDeepEqual(promotionCheckpointReceiptsFromJobs('29692260683', jobs), receipt);
  assert.deepEqual(promotionCheckpointReceiptsFromJobs('29692260682', [{ ...jobs[0]!, conclusion: 'failure' }]), []);
});

test('workflow readback transport consumes the same remaining admission budget with a finite per-call cap', async () => {
  const started = Date.parse('2026-07-18T00:00:00.000Z');
  const admittedAt = new Date(started).toISOString();
  let session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed', new Date(started + 1_000).toISOString());
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'accepted', new Date(started + 2_000).toISOString());
  const observedAt = started + 30 * 60_000;
  const result = await watchRunToTerminal((command, args, options) => {
    assert.equal(command, 'gh');
    if (args[1] === 'watch') {
      assert.equal(options?.timeoutMs, 1_800_000);
      return { status: 1, stdout: '', stderr: 'watch transport ended' };
    }
    assert.equal(options?.timeoutMs, 30_000);
    return {
      status: 0,
      stdout: JSON.stringify({
        databaseId: 7004, attempt: 1, createdAt: '2026-07-18T00:00:00Z', headBranch: 'main',
        headSha: appSha, status: 'completed', conclusion: 'success', url: 'https://example.test/7004',
      }),
      stderr: '',
    };
  }, session, '7004', () => {}, () => observedAt);
  assert.equal(result.succeeded, true);
});

test('promotion watch blocks before network readback after the Standard deadline', async () => {
  const started = Date.parse('2026-07-18T00:00:00.000Z');
  const admittedAt = new Date(started).toISOString();
  let session = buildStableReleaseSession(plan(admittedAt), undefined, admittedAt);
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed', new Date(started + 1_000).toISOString());
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'dispatched', new Date(started + 2_000).toISOString());
  session = transitionStableReleaseSession(session, 'artifacts_qualified', 'qualified', new Date(started + 3_000).toISOString());
  session = transitionStableReleaseSession(session, 'owner_approved', 'approved', new Date(started + 4_000).toISOString());
  session = transitionStableReleaseSession(session, 'promotion_running', 'historical successor', new Date(started + 5_000).toISOString());
  const observedAt = Date.parse(session.efficiency_policy.standard_admission_deadline_at) + 1_000;
  let runnerCalls = 0;
  let persisted: StableReleaseSession | null = null;
  await assert.rejects(
    () => watchRunToTerminal(
      () => {
        runnerCalls += 1;
        return { status: 1, stdout: '', stderr: 'must not execute' };
      },
      session,
      '7007',
      (next) => { persisted = next; },
      () => observedAt,
    ),
    /immutable 90-minute Standard deadline/,
  );
  assert.equal(runnerCalls, 0);
  assert.equal(persisted?.phase, 'standard_deadline_blocked');
});

test('source gate failures prefer structured stdout over runtime warnings', () => {
  assert.equal(
    formatCommandFailure(
      {
        status: 1,
        stdout: '{"status":"failed","blocker":"registry metadata unavailable"}\n',
        stderr: 'ExperimentalWarning: Type Stripping is an experimental feature\n',
      },
      'source gate release_preflight',
    ),
    'source gate release_preflight: {"status":"failed","blocker":"registry metadata unavailable"}',
  );
});

function executableStartOptions(statePath: string) {
  return {
    execute: true,
    watch: true,
    repo: 'gaofeng21cn/one-person-lab-app',
    statePath,
    cohort: {
      version: '26.7.18', releaseMode: 'new_release', releaseIntent: 'stable_complete' as const,
      fullOmissionReason: '', gateReusePlanRef: '', includeFullPackage: true,
      runVmSmoke: true, publishDockerWebui: false,
      appCommit: repositoryHead, shellRef: repositoryHead, frameworkRef: repositoryHead,
      shellRoot: process.cwd(), frameworkRoot: process.cwd(), output: '', markdown: '',
    },
  };
}

test('source gate timeout consumes the immutable remaining deadline and blocks before dispatch', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-source-gate-timeout-'));
  const statePath = path.join(root, 'session.json');
  const startedAtMs = Date.parse('2026-07-18T00:00:00.000Z');
  let observedAtMs = startedAtMs;
  const calls: Array<{ command: string; timeoutMs?: number }> = [];
  const runner = ((command, _args, options) => {
    calls.push({ command, timeoutMs: options?.timeoutMs });
    observedAtMs = startedAtMs + 90 * 60 * 1_000;
    return { status: null, stdout: '', stderr: 'bounded source gate timeout', timedOut: true };
  }) satisfies StableReleaseCommandRunner;
  try {
    await assert.rejects(
      () => startStableRelease(executableStartOptions(statePath), runner, () => observedAtMs),
      /source gate .* timed out against the immutable 90-minute Standard admission deadline/,
    );
    assert.deepEqual(calls, [{ command: 'bash', timeoutMs: 90 * 60 * 1_000 }]);
    const blocked = readStableReleaseSession(statePath);
    assert.equal(blocked.phase, 'standard_deadline_blocked');
    assert.equal(blocked.terminal_truth.standard_status, 'blocked');
    assert.equal(blocked.standard_deadline_blocker?.stage, `source_gate:${blocked.source_gates[0].id}`);
    assert.equal(blocked.standard_deadline_blocker?.remaining_ms, 0);
    assert.equal(blocked.source_gates[0].status, 'failed');
    assert.equal(blocked.mutation_attempts.length, 0);
    assert.equal(blocked.mutation_acceptances.length, 0);
    assert.equal(blocked.release_run.id, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('cohort planning time is charged to the immutable deadline and persists a typed blocker', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-source-planning-timeout-'));
  const statePath = path.join(root, 'session.json');
  const startedAtMs = Date.parse('2026-07-18T00:00:00.000Z');
  let clockCalls = 0;
  let runnerCalls = 0;
  const runner = (() => {
    runnerCalls += 1;
    return { status: 0, stdout: '', stderr: '' };
  }) satisfies StableReleaseCommandRunner;
  try {
    await assert.rejects(
      () => startStableRelease(
        executableStartOptions(statePath),
        runner,
        () => clockCalls++ === 0 ? startedAtMs : startedAtMs + 90 * 60 * 1_000,
      ),
      /cohort planning exhausted the immutable 90-minute Standard admission deadline/,
    );
    assert.equal(runnerCalls, 0);
    const blocked = readStableReleaseSession(statePath);
    assert.equal(blocked.metrics.session_started_at, '2026-07-18T00:00:00.000Z');
    assert.equal(blocked.efficiency_policy.standard_admission_deadline_at, '2026-07-18T01:30:00.000Z');
    assert.equal(blocked.phase, 'standard_deadline_blocked');
    assert.equal(blocked.terminal_truth.standard_status, 'blocked');
    assert.equal(blocked.standard_deadline_blocker?.stage, 'cohort_planning');
    assert.equal(blocked.mutation_attempts.length, 0);
    assert.equal(blocked.release_run.id, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('desktop release dispatch is derived entirely from the frozen cohort', () => {
  let session = buildStableReleaseSession(plan());
  session = authorize(
    session, 'desktop_release_dispatch', 'desktop-release.yml', 'standard', appSha, appSha,
    releaseMutationPayloadSha256(desktopReleaseMutationPayload(session)),
  );
  const args = desktopReleaseDispatchArgs(session, undefined, brokerAuthority).join(' ');
  assert.match(args, /--ref main/);
  assert.match(args, new RegExp(`shell_ref=${shellSha}`));
  assert.match(args, new RegExp(`framework_ref=${frameworkSha}`));
  assert.match(args, /include_full_package=true/);
  assert.match(args, /run_vm_smoke=true/);
  assert.match(args, /defer_addons=true/);
  assert.doesNotMatch(args, /shell_ref=main/);
  assert.doesNotMatch(args, /framework_ref=main/);
});

test('promotion reuses the source run id and requires an owner receipt', () => {
  let session = buildStableReleaseSession(plan());
  session.release_run.id = '29211495991';
  session.qualification_run.id = '29211496001';
  session.qualification_run.conclusion = 'success';
  session.qualification_run.artifact_sha256 = 'e'.repeat(64);
  session.artifact_tracks.standard.qualification_run = structuredClone(session.qualification_run);
  assert.throws(() => promoteDispatchArgs(session, '', '26.7.12-r2'), /owner receipt/);
  assert.throws(
    () => promoteDispatchArgs(session, 'release_owner_receipt_ref://test', ''),
    /Release Set generation/,
  );
  const ownerReceiptRef = 'release_owner_receipt_ref://test';
  const releaseSetGeneration = '26.7.12-r2';
  session = authorize(
    session, 'promotion_dispatch', 'desktop-release-promote.yml', 'promotion', appSha, appSha,
    releaseMutationPayloadSha256(promotionMutationPayload(session, ownerReceiptRef, releaseSetGeneration)),
  );
  const args = promoteDispatchArgs(session, ownerReceiptRef, releaseSetGeneration, undefined, undefined, brokerAuthority).join(' ');
  assert.match(args, /release_run_id=29211495991/);
  assert.match(args, /standard_vm_run_id=29211496001/);
  assert.doesNotMatch(args, /schedule_full_addon/);
  assert.match(args, /release_set_generation=26\.7\.12-r2/);
  assert.match(args, /release_owner_receipt_ref=release_owner_receipt_ref:\/\/test/);
  assert.match(args, new RegExp(`shell_ref=${shellSha}`));
});

test('promotion permits one non-replayable attempt and rejects historical successors', () => {
  const startedAt = '2026-07-18T00:00:00.000Z';
  const ownerReceipt = 'release_owner_receipt_ref://test/exact-owner';
  const generation = '26.7.12-r1';
  const session = buildStableReleaseSession(plan(startedAt), undefined, startedAt);
  const payload = promotionMutationPayload(session, ownerReceipt, generation);
  const input = {
    mutation: 'promotion_dispatch' as const,
    workflow: 'desktop-release-promote.yml',
    artifactKind: 'promotion' as const,
    admissionMode: 'admin_one_shot_controller' as const,
    controllerWorkflowSha: appSha,
    artifactAppSha: appSha,
    mutationPayloadSha256: releaseMutationPayloadSha256(payload),
    mutationPayload: payload,
    at: '2026-07-18T01:00:00.000Z',
    reason: 'sole promotion attempt',
  };
  const planned = planReleaseMutationAttempt(session, input);
  assert.equal(validateStableReleaseSessionInvariants(planned.session).length, 0);

  const dispatching = appendReleaseMutationAttemptEvent(planned.session, planned.attemptId, {
    at: '2026-07-18T01:00:01.000Z',
    state: 'dispatching',
    run_id: null,
    reason: 'durable sole promotion fence',
  });
  const admission = buildAdminOneShotAdmission(dispatching, planned.attemptId, payload, '2026-07-18T01:00:01.000Z');
  assert.doesNotMatch(
    adminOneShotDispatchArgs(admission).join(' '),
    /historical_predecessor_admission_receipt_base64/,
  );

  const idempotent = planReleaseMutationAttempt(planned.session, { ...input, at: '2026-07-18T01:01:00.000Z' });
  assert.equal(idempotent.attemptId, planned.attemptId);
  let failed = appendReleaseMutationAttemptEvent(dispatching, planned.attemptId, {
    at: '2026-07-18T01:00:02.000Z', state: 'running', run_id: '301', reason: 'exact sole promotion run',
  });
  failed = appendReleaseMutationAttemptEvent(failed, planned.attemptId, {
    at: '2026-07-18T01:00:03.000Z', state: 'failed', run_id: '301', reason: 'sole promotion failed',
  });
  assert.throws(
    () => planReleaseMutationAttempt(failed, {
      ...input,
      controllerWorkflowSha: 'f'.repeat(40),
      at: '2026-07-18T01:01:00.000Z',
    }),
    /already has its sole promotion attempt/,
  );
  assert.throws(
    () => planReleaseMutationAttempt(session, { ...input, priorRunIds: ['301'] }),
    /cannot carry historical predecessor run ids/,
  );

  const tampered = structuredClone(planned.session);
  tampered.mutation_attempts[0]!.dispatch_fence.prior_run_ids = ['301'];
  assert.match(
    validateStableReleaseSessionInvariants(tampered).join('; '),
    /cannot carry historical predecessor run ids/,
  );
});

test('promotion requires 15 minutes of budget and a strictly newer Stable version', () => {
  const startedAt = '2026-07-18T00:00:00.000Z';
  const session = buildStableReleaseSession(plan(startedAt), undefined, startedAt);
  const deadlineMs = Date.parse(session.efficiency_policy.standard_admission_deadline_at);

  assert.equal(minimumPromotionDispatchBudgetMs, 15 * 60_000);
  assert.doesNotThrow(() => assertPromotionDispatchBudget(session, deadlineMs - minimumPromotionDispatchBudgetMs));
  assert.throws(
    () => assertPromotionDispatchBudget(session, deadlineMs - minimumPromotionDispatchBudgetMs + 1),
    /at least 15 minutes/,
  );

  assert.equal(compareStableReleaseVersions('26.7.20', 'v26.7.19'), 1);
  assert.equal(compareStableReleaseVersions('v26.7.20', '26.7.20'), 0);
  assert.doesNotThrow(() => assertPromotionTargetIsNewerThanLatest('26.7.20', {
    tagName: 'v26.7.19', isDraft: false, isPrerelease: false,
  }));
  assert.throws(() => assertPromotionTargetIsNewerThanLatest('26.7.20', {
    tagName: 'v26.7.20', isDraft: false, isPrerelease: false,
  }), /already GitHub Latest/);
  assert.throws(() => assertPromotionTargetIsNewerThanLatest('26.7.18', {
    tagName: 'v26.7.20', isDraft: false, isPrerelease: false,
  }), /downgrade is forbidden/);
  assert.throws(() => compareStableReleaseVersions('26.2.30', '26.2.28'), /valid calendar date/);
  const [futureYear, futureMonth, futureDay] = currentReleaseCalendarDate(
    'Asia/Shanghai',
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  ).split('-').map(Number);
  assert.throws(() => assertPromotionTargetIsNewerThanLatest(
    `${futureYear - 2000}.${futureMonth}.${futureDay}`,
    { tagName: 'v26.7.20', isDraft: false, isPrerelease: false },
  ), /future-dated/);
});

test('reconcile run readback uses the independent read-only transport budget', () => {
  const controller = fs.readFileSync(path.join(process.cwd(), 'scripts/run-stable-release.ts'), 'utf8');
  assert.match(controller, /runView\(run, current, runId, Date\.now, 'read_only_reconcile'\)/);
  const discovery = controller.slice(
    controller.indexOf('async function discoverAdminOneShotRun'),
    controller.indexOf('function watchRun', controller.indexOf('async function discoverAdminOneShotRun')),
  );
  assert.match(discovery, /timeoutMs: readOnlyReleaseTransportTimeoutMs\(\)/);
  assert.doesNotMatch(discovery, /boundedReleaseTransportTimeoutMs/);
  assert.doesNotMatch(controller, /historicalPromotionRecovery|historicalPredecessor/);
  assert.match(controller, /Promotion dispatch requires the original artifacts_qualified state/);
  assert.match(controller, /assertRemoteLatestAllowsPromotion\(runner, session\)/);
  assert.doesNotMatch(controller, /const runId = session\.promotion_run\.id;\n  if \(!runId\)/);
  const sessionSource = fs.readFileSync(path.join(process.cwd(), 'scripts/stable-release-session.ts'), 'utf8');
  assert.match(sessionSource, /permits exactly one promotion mutation attempt/);
  assert.match(sessionSource, /cannot carry historical predecessor run ids/);
  assert.doesNotMatch(sessionSource, /exactHistoricalPromotionRecoveryChain/);
});

test('same-artifact qualification keeps the verification Shell exact to the artifact cohort', () => {
  const session = buildStableReleaseSession(plan());
  session.release_run.id = '29246288414';
  session.qualification_run.artifact_name = 'opl-full-first-install-dmg-26.7.13-mac-arm64';
  session.qualification_run.artifact_sha256 = 'e'.repeat(64);
  session.artifact_tracks.standard.source_run_id = session.release_run.id;
  session.artifact_tracks.standard.source_artifact_name = session.qualification_run.artifact_name;
  session.artifact_tracks.standard.artifact_sha256 = session.qualification_run.artifact_sha256;
  const verificationAppSha = appSha;
  const verificationShellSha = shellSha;
  const verificationHarness = {
    app_ref: 'main', app_sha: verificationAppSha,
    shell_ref: verificationShellSha, shell_sha: verificationShellSha,
    scope_proof: buildQualificationHarnessScopeProof({
      artifactAppSha: appSha,
      verificationAppSha,
      appChangedPaths: [],
      artifactShellSha: shellSha,
      verificationShellSha,
    shellChangedPaths: [],
    }),
  };
  const authorizedSession = authorize(
    session, 'qualification_dispatch', 'opl-first-run-vm.yml', 'standard', verificationAppSha, appSha,
    releaseMutationPayloadSha256(qualificationMutationPayload(session, verificationHarness, 'standard')),
  );
  const args = qualificationRetryDispatchArgs(authorizedSession, {
    ...verificationHarness,
  }, undefined, 'standard', brokerAuthority).join(' ');

  assert.match(args, /--ref main/);
  assert.match(args, new RegExp(`artifact_app_ref=${appSha}`));
  assert.match(args, new RegExp(`shell_ref=${shellSha}`));
  assert.match(args, new RegExp(`smoke_harness_ref=${verificationShellSha}`));
  assert.match(args, new RegExp(`smoke_harness_ref=${shellSha}`));
});

test('same-artifact qualification rejects a replaceable App verifier or product scope drift before dispatch', () => {
  const session = buildStableReleaseSession(plan());
  session.release_run.id = '29246288414';
  session.qualification_run.artifact_name = 'opl-full-first-install-dmg-26.7.13-mac-arm64';
  session.qualification_run.artifact_sha256 = 'e'.repeat(64);
  const verificationAppSha = 'f'.repeat(40);
  const authorizedSession = authorize(session, 'qualification_dispatch', 'opl-first-run-vm.yml', 'standard', verificationAppSha);
  const scopeProof = buildQualificationHarnessScopeProof({
    artifactAppSha: appSha,
    verificationAppSha,
    appChangedPaths: ['.github/workflows/opl-first-run-vm.yml'],
    artifactShellSha: shellSha,
    verificationShellSha: shellSha,
    shellChangedPaths: [],
  });
  assert.throws(() => qualificationRetryDispatchArgs(authorizedSession, {
    app_ref: 'codex/replaceable-verifier', app_sha: verificationAppSha,
    shell_ref: shellSha, shell_sha: shellSha, scope_proof: scopeProof,
  }), /canonical main/);
  assert.throws(() => qualificationRetryDispatchArgs(authorizedSession, {
    app_ref: 'main', app_sha: verificationAppSha,
    shell_ref: shellSha, shell_sha: shellSha, scope_proof: scopeProof,
  }), /requires a new cohort/);
});

test('state machine rejects skipped stages and repeated release dispatch paths', () => {
  const session = buildStableReleaseSession(plan());
  assert.throws(
    () => transitionStableReleaseSession(session, 'promotion_running', 'skip'),
    /Invalid stable release transition/,
  );
  const gatesPassed = transitionStableReleaseSession(session, 'source_gates_passed', 'passed');
  const running = transitionStableReleaseSession(gatesPassed, 'artifact_build_running', 'dispatched');
  assert.throws(
    () => transitionStableReleaseSession(running, 'source_gates_passed', 'repeat'),
    /Invalid stable release transition/,
  );
});

test('an artifact build false negative can reconcile only the original run', () => {
  let session = buildStableReleaseSession(plan());
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed');
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'dispatched');
  session.metrics.artifact_build_count = 1;
  session.release_run.id = '29234584566';
  session = transitionStableReleaseSession(session, 'artifact_build_failed', 'monitor exited early');
  const reconciled = transitionStableReleaseSession(session, 'artifact_build_running', 'reconcile original run');
  assert.equal(reconciled.release_run.id, '29234584566');
  assert.equal(reconciled.metrics.artifact_build_count, 1);
  assert.throws(
    () => transitionStableReleaseSession(session, 'source_gates_passed', 'redispatch'),
    /Invalid stable release transition/,
  );
});

test('failed promotion cannot replay an old workflow ticket', () => {
  let session = buildStableReleaseSession(plan());
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed');
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'dispatched');
  session = transitionStableReleaseSession(session, 'artifacts_qualified', 'qualified');
  session = transitionStableReleaseSession(session, 'owner_approved', 'owner receipt accepted');
  session = transitionStableReleaseSession(session, 'promotion_running', 'promotion dispatched');
  session = transitionStableReleaseSession(session, 'release_published_not_latest', 'published');
  session = transitionStableReleaseSession(session, 'distribution_synced', 'distributed');
  session = transitionStableReleaseSession(session, 'promotion_failed', 'Homebrew VM failed');
  session.promotion_run = {
    id: '29211497001',
    url: 'https://example.test/promotion',
    conclusion: 'failure',
    attempt: 1,
    rerun_requested_from_attempt: null,
  };
  session.release_owner_receipt_ref = 'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.7.12/test';
  session.metrics.workflow_dispatch_counts.promotion = 1;
  assert.equal(session.metrics.workflow_dispatch_counts.promotion, 1);
  assert.throws(
    () => transitionStableReleaseSession(session, 'owner_approved', 'redispatch'),
    /Invalid stable release transition/,
  );
  const reconciled = transitionStableReleaseSession(session, 'promotion_running', 'read-only reconcile');
  assert.equal(reconciled.promotion_run.id, '29211497001');
  assert.equal(reconciled.metrics.workflow_dispatch_counts.promotion, 1);
  assert.deepEqual(reconciled.mutation_leases, []);
});

test('latest checkpoint can persist a missing saga receipt as promotion_failed', () => {
  let session = buildStableReleaseSession(plan());
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed');
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'dispatched');
  session = transitionStableReleaseSession(session, 'artifacts_qualified', 'qualified');
  session = transitionStableReleaseSession(session, 'owner_approved', 'approved');
  session = transitionStableReleaseSession(session, 'promotion_running', 'promotion');
  session = transitionStableReleaseSession(session, 'release_published_not_latest', 'published');
  session = transitionStableReleaseSession(session, 'distribution_synced', 'distributed');
  session = transitionStableReleaseSession(session, 'homebrew_verified', 'homebrew');
  session = transitionStableReleaseSession(session, 'latest_activated', 'latest');
  assert.equal(transitionStableReleaseSession(session, 'promotion_failed', 'receipt missing').phase, 'promotion_failed');
});

test('controller accepts only the broker run id with exact attempt, workflow, branch, and SHA identity', () => {
  const attemptId = `sha256:${'9'.repeat(64)}`;
  const exact = {
    databaseId: 3, attempt: 1, createdAt: '2026-07-12T00:00:03.000Z',
    headBranch: 'main', headSha: appSha, event: 'workflow_dispatch',
    workflowName: 'OPL Desktop Release', displayTitle: `OPL Desktop Release v26.7.12 attempt=${attemptId}`,
    status: 'queued', url: 'https://example.test/current',
  };
  const expected = {
    runId: '3', attemptId, workflow: 'desktop-release.yml' as const,
    controllerWorkflowSha: appSha,
  };
  assert.deepEqual(validateAcceptedWorkflowRunIdentity(exact, expected), []);
  assert.match(
    validateAcceptedWorkflowRunIdentity({ ...exact, databaseId: 4 }, expected).join('; '),
    /databaseId/,
  );
  assert.match(
    validateAcceptedWorkflowRunIdentity({ ...exact, displayTitle: 'newest unrelated run' }, expected).join('; '),
    /attempt id/,
  );
  assert.match(
    validateAcceptedWorkflowRunIdentity({ ...exact, displayTitle: `attempt=${attemptId} injected suffix` }, expected).join('; '),
    /attempt id/,
  );
  assert.match(
    validateAcceptedWorkflowRunIdentity({ ...exact, headSha: 'e'.repeat(40) }, expected).join('; '),
    /controller SHA/,
  );
});
