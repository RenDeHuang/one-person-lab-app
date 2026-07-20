#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  readReleaseBrokerAuthority,
  releaseBrokerAuthoritySha256,
  resolveHistoricalReleaseBrokerAuthority,
  validateReleaseBrokerAuthority,
  validateReleaseBrokerLookupAuthority,
  type ReleaseBrokerAuthorityV1,
} from './release-broker-authority.ts';
import {
  buildPromotionCheckpointAuthorization,
  buildReleaseMutationBrokerLedgerLookup,
  releaseMutationBrokerRequestSha256,
  releaseMutationPreApiFenceSha256,
  validateHistoricalReleaseMutationAcceptanceReceipt,
  validateReleaseMutationBrokerLedgerLookupResult,
  validateReleaseMutationPreApiFence,
  type ReleaseMutationBrokerLedgerLookupResultV1,
  type ReleaseMutationPreApiFenceV1,
} from './release-mutation-broker.ts';
import { releaseMutationPayloadSha256 } from './release-mutation-payload.ts';

export type ValidationArtifact = {
  schema: 'opl_app_release_broker_workflow_acceptance_validation.v1';
  status: 'verified';
  mode: 'lookup' | 'historical' | 'pre-api' | 'admin-one-shot';
  verified_at: string;
  authority_epoch: number;
  authority_sha256: string;
  key_id: string;
  repository: string;
  stable_session_id: string;
  release_cohort_ref: string;
  version: string;
  workflow: string;
  attempt_id: string;
  request_sha256: string;
  mutation_payload_sha256: string;
  pre_api_fence_sha256: string;
  acceptance_sha256: string | null;
  exact_run_id: string | null;
  run_attempt: number | null;
  controller_sha: string;
  lookup_linearized_at: string | null;
  lookup_expires_at: string | null;
  full_addon_deadline_at: string | null;
  signed_lookup_envelope: ReleaseMutationBrokerLedgerLookupResultV1 | null;
  admin_one_shot_admission: AdminOneShotAdmission | null;
  promotion_checkpoint_authorization: ReleaseMutationPreApiFenceV1['promotion_checkpoint_authorization'];
};

type AdminOneShotAdmission = {
  schema: 'opl_app_release_admin_one_shot_admission.v1';
  status: 'durable_pre_api_fence';
  admission_mode: 'admin_one_shot_controller';
  persisted_at: string;
  request_sha256: string;
  request: {
    stable_session_id: string;
    release_cohort_ref: string;
    operator_actor: string;
    attempt_id: string;
    planned_session_revision: number;
    mutation: string;
    workflow: string;
    artifact_kind: string;
    controller_workflow_sha: string;
    artifact_app_sha: string;
    mutation_payload: Record<string, string>;
    mutation_payload_sha256: string;
    github: { repository: string; operation: string; workflow_ref: string; target_run_id: null };
  };
};

export type BrokerAcceptanceExpectedIdentity = {
  repository: string;
  runId?: string;
  runAttempt?: number;
  workflow: string;
  workflowSha: string;
  payloadSha256: string;
  attemptId: string;
  releaseVersion?: string;
  shellRef?: string;
  frameworkRef?: string;
  includeFull?: 'true' | 'false';
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
}

function sha256(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function decodeFence(value: string): ReleaseMutationPreApiFenceV1 {
  const decoded = Buffer.from(value, 'base64').toString('utf8');
  return JSON.parse(decoded) as ReleaseMutationPreApiFenceV1;
}

function decodeAdmission(value: string): AdminOneShotAdmission {
  return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as AdminOneShotAdmission;
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

function assertExpectedIdentity(
  fence: ReleaseMutationPreApiFenceV1,
  expected: BrokerAcceptanceExpectedIdentity,
): void {
  const request = fence.request;
  const mismatches: string[] = [];
  if (request.github.repository !== expected.repository) mismatches.push('repository');
  if (request.workflow !== expected.workflow) mismatches.push('workflow');
  if (request.controller_workflow_sha !== expected.workflowSha) mismatches.push('controller workflow SHA');
  if (request.mutation_payload_sha256 !== expected.payloadSha256) mismatches.push('mutation payload digest');
  if (request.mutation_payload_sha256 !== releaseMutationPayloadSha256(request.mutation_payload)) {
    mismatches.push('embedded mutation payload digest');
  }
  if (request.attempt_id !== expected.attemptId) mismatches.push('attempt id');
  if (mismatches.length > 0) throw new Error(`pre-API fence expected identity mismatch: ${mismatches.join(', ')}`);
}

function lookupForFence(fence: ReleaseMutationPreApiFenceV1, challenge?: string) {
  return buildReleaseMutationBrokerLedgerLookup({
    repository: fence.request.github.repository,
    version: fence.request.idempotency.version,
    stableSessionId: fence.request.stable_session_id,
    releaseCohortRef: fence.request.release_cohort_ref,
    attemptId: fence.request.attempt_id,
    mutationPayloadSha256: fence.request.mutation_payload_sha256,
    requestSha256: releaseMutationBrokerRequestSha256(fence.request),
    challenge,
  });
}

function assertAcceptanceIdentity(
  result: Extract<ReleaseMutationBrokerLedgerLookupResultV1, { status: 'found' }>,
  expectedRunId: string,
  expectedRunAttempt: number,
): void {
  const acceptance = result.record.acceptance;
  if (acceptance.github.run_id !== expectedRunId || acceptance.github.run_attempt !== expectedRunAttempt) {
    throw new Error('signed broker acceptance does not bind the exact current workflow run id/attempt');
  }
}

async function githubOidcToken(
  authority: ReleaseBrokerAuthorityV1,
  fetchImpl: typeof fetch,
  environment: NodeJS.ProcessEnv,
): Promise<string> {
  const requestUrl = environment.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  const audience = authority.workflow_lookup.oidc_audience;
  if (!requestUrl || !requestToken || !audience) throw new Error('GitHub OIDC request environment or broker audience is unavailable');
  const url = new URL(requestUrl);
  url.searchParams.set('audience', audience);
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${requestToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub OIDC token request failed with HTTP ${response.status}`);
  const body = await response.json() as { value?: unknown };
  if (typeof body.value !== 'string' || !body.value) throw new Error('GitHub OIDC token response is malformed');
  return body.value;
}

export async function remoteWorkflowBrokerLookup(
  authority: ReleaseBrokerAuthorityV1,
  fenceBase64: string,
  lookup: ReturnType<typeof lookupForFence>,
  fetchImpl: typeof fetch = fetch,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<ReleaseMutationBrokerLedgerLookupResultV1> {
  const endpoint = authority.workflow_lookup.endpoint_url;
  if (!endpoint) throw new Error('release workflow broker lookup endpoint is not provisioned');
  const token = await githubOidcToken(authority, fetchImpl, environment);
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      schema: 'opl_app_release_mutation_broker_workflow_lookup_request.v2',
      authority_epoch: authority.authority_epoch,
      pre_api_fence_base64: fenceBase64,
      lookup,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`release workflow broker lookup failed with HTTP ${response.status}`);
  try {
    return await response.json() as ReleaseMutationBrokerLedgerLookupResultV1;
  } catch (error) {
    throw new Error(`release workflow broker lookup returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function buildArtifact(input: {
  mode: ValidationArtifact['mode'];
  verifiedAt: string;
  authority: ReleaseBrokerAuthorityV1;
  fence: ReleaseMutationPreApiFenceV1;
  result: Extract<ReleaseMutationBrokerLedgerLookupResultV1, { status: 'found' }> | null;
}): ValidationArtifact {
  const acceptance = input.result?.record.acceptance ?? null;
  return {
    schema: 'opl_app_release_broker_workflow_acceptance_validation.v1',
    status: 'verified', mode: input.mode, verified_at: input.verifiedAt,
    authority_epoch: input.authority.authority_epoch,
    authority_sha256: releaseBrokerAuthoritySha256(input.authority),
    key_id: input.result?.signature.key_id ?? input.fence.signature.key_id,
    repository: input.fence.request.github.repository,
    stable_session_id: input.fence.request.stable_session_id,
    release_cohort_ref: input.fence.request.release_cohort_ref,
    version: input.fence.request.idempotency.version,
    workflow: input.fence.request.workflow,
    attempt_id: input.fence.request.attempt_id,
    request_sha256: releaseMutationBrokerRequestSha256(input.fence.request),
    mutation_payload_sha256: input.fence.request.mutation_payload_sha256,
    pre_api_fence_sha256: releaseMutationPreApiFenceSha256(input.fence),
    acceptance_sha256: acceptance ? sha256(canonicalJson(acceptance)) : null,
    exact_run_id: acceptance?.github.run_id ?? null,
    run_attempt: acceptance?.github.run_attempt ?? null,
    controller_sha: input.fence.request.controller_workflow_sha,
    lookup_linearized_at: input.result?.read_proof.linearized_at ?? null,
    lookup_expires_at: input.result?.read_proof.expires_at ?? null,
    full_addon_deadline_at: acceptance?.full_addon_deadline_at ?? input.fence.full_addon_deadline_at,
    signed_lookup_envelope: input.result,
    admin_one_shot_admission: null,
    promotion_checkpoint_authorization: input.fence.promotion_checkpoint_authorization,
  };
}

export function verifyAdminOneShotAdmission(input: {
  authority: ReleaseBrokerAuthorityV1;
  admission: AdminOneShotAdmission;
  expected: BrokerAcceptanceExpectedIdentity;
  operatorActor: string;
  githubActor: string;
  verifiedAt: string;
  mode?: 'admin-one-shot' | 'historical';
}): ValidationArtifact {
  const { admission, expected } = input;
  if (
    admission.schema !== 'opl_app_release_admin_one_shot_admission.v1' ||
    admission.status !== 'durable_pre_api_fence' ||
    admission.admission_mode !== 'admin_one_shot_controller'
  ) throw new Error('admin one-shot admission schema/status/mode is invalid');
  const request = admission.request;
  const routes = new Map<string, [string, string]>([
    ['release-stable.yml', ['desktop_release_dispatch', 'standard']],
    ...(input.mode === 'historical' ? [
      ['desktop-release.yml', ['desktop_release_dispatch', 'standard']] as [string, [string, string]],
      ['desktop-release-promote.yml', ['promotion_dispatch', 'promotion']] as [string, [string, string]],
    ] : []),
  ]);
  const route = routes.get(request.workflow);
  if (!route || request.mutation !== route[0] || request.artifact_kind !== route[1]) {
    throw new Error('admin one-shot admission is outside the Standard critical-path allowlist');
  }
  const structuralErrors = validateReleaseBrokerAuthority(input.authority, { capability: 'contract_read' });
  if (structuralErrors.length > 0) throw new Error(`release authority contract is invalid: ${structuralErrors.join('; ')}`);
  if (
    input.mode !== 'historical' &&
    !input.authority.current_release_admission.allowed_workflows.includes(request.workflow as 'release-stable.yml')
  ) throw new Error('admin one-shot admission does not target the current live Stable workflow');
  if (
    input.operatorActor !== input.authority.operator_identity.github_actor ||
    input.githubActor !== input.operatorActor || request.operator_actor !== input.operatorActor
  ) throw new Error('admin one-shot admission actor does not match the canonical administrator identity');
  const mismatches: string[] = [];
  if (request.github.repository !== expected.repository) mismatches.push('repository');
  if (request.github.operation !== 'workflow_dispatch' || request.github.workflow_ref !== 'refs/heads/main' || request.github.target_run_id !== null) mismatches.push('GitHub operation');
  if (request.workflow !== expected.workflow) mismatches.push('workflow');
  if (request.controller_workflow_sha !== expected.workflowSha) mismatches.push('controller workflow SHA');
  if (request.mutation_payload_sha256 !== expected.payloadSha256) mismatches.push('mutation payload digest');
  if (request.mutation_payload_sha256 !== releaseMutationPayloadSha256(request.mutation_payload)) {
    mismatches.push('embedded mutation payload digest');
  }
  if (request.attempt_id !== expected.attemptId) mismatches.push('attempt id');
  if (!Number.isSafeInteger(request.planned_session_revision) || request.planned_session_revision < 1) mismatches.push('planned revision');
  if (admission.request_sha256 !== sha256(canonicalJson(request))) mismatches.push('request digest');
  if (request.workflow === 'release-stable.yml') {
    if (!expected.releaseVersion || !expected.shellRef || !expected.frameworkRef || !expected.includeFull) {
      mismatches.push('frozen Bundle expected identity');
    }
    if (request.artifact_app_sha !== expected.workflowSha) mismatches.push('artifact App SHA');
    if (request.stable_session_id !== request.mutation_payload.stable_session_id) mismatches.push('stable session id');
    if (request.release_cohort_ref !== request.mutation_payload.release_operator_plan_ref) mismatches.push('release cohort ref');
    if (request.mutation_payload.opl_version !== expected.releaseVersion) mismatches.push('release version');
    if (request.mutation_payload.artifact_app_sha !== expected.workflowSha) mismatches.push('payload App SHA');
    if (request.mutation_payload.shell_ref !== expected.shellRef) mismatches.push('frozen Shell SHA');
    if (request.mutation_payload.framework_ref !== expected.frameworkRef) mismatches.push('frozen Framework SHA');
    if (request.mutation_payload.include_full_package !== expected.includeFull) mismatches.push('Full inclusion policy');
    if (request.mutation_payload.run_vm_smoke !== 'true') mismatches.push('VM qualification policy');
    if (request.mutation_payload.publish_docker_webui !== 'false') mismatches.push('WebUI independent-lane policy');
    if (request.mutation_payload.defer_addons !== 'false') mismatches.push('unified Bundle add-on policy');
  }
  if (mismatches.length > 0) throw new Error(`admin one-shot expected identity mismatch: ${mismatches.join(', ')}`);
  const persistedAtMs = Date.parse(admission.persisted_at);
  const verifiedAtMs = Date.parse(input.verifiedAt);
  if (!Number.isFinite(persistedAtMs) || !Number.isFinite(verifiedAtMs) || persistedAtMs > verifiedAtMs || verifiedAtMs - persistedAtMs > 90 * 60_000) {
    throw new Error('admin one-shot admission is outside the immutable 90-minute window');
  }
  return {
    schema: 'opl_app_release_broker_workflow_acceptance_validation.v1',
    status: 'verified', mode: input.mode ?? 'admin-one-shot', verified_at: input.verifiedAt,
    authority_epoch: input.authority.authority_epoch,
    authority_sha256: releaseBrokerAuthoritySha256(input.authority),
    key_id: 'admin-one-shot-controller', repository: request.github.repository,
    stable_session_id: request.stable_session_id, release_cohort_ref: request.release_cohort_ref,
    version: String(request.mutation_payload.opl_version ?? ''), workflow: request.workflow,
    attempt_id: request.attempt_id, request_sha256: admission.request_sha256,
    mutation_payload_sha256: request.mutation_payload_sha256,
    pre_api_fence_sha256: sha256(canonicalJson(admission)), acceptance_sha256: null,
    exact_run_id: expected.runId ?? null, run_attempt: expected.runAttempt ?? null,
    controller_sha: request.controller_workflow_sha,
    lookup_linearized_at: null, lookup_expires_at: null, full_addon_deadline_at: null,
    signed_lookup_envelope: null, admin_one_shot_admission: admission,
    promotion_checkpoint_authorization: buildPromotionCheckpointAuthorization({
      mutation: request.mutation as Parameters<typeof buildPromotionCheckpointAuthorization>[0]['mutation'],
      attempt_id: request.attempt_id,
      mutation_payload: request.mutation_payload,
    }),
  };
}

function assertFullAddonWorkflowAdmissionDeadline(
  fence: ReleaseMutationPreApiFenceV1,
  acceptedDeadline: string | null,
  observedAt: string,
): void {
  if (fence.request.mutation !== 'full_addon_dispatch') return;
  const deadline = acceptedDeadline ?? fence.full_addon_deadline_at;
  const deadlineMs = Date.parse(String(deadline));
  const observedMs = Date.parse(observedAt);
  if (!deadline || !Number.isFinite(deadlineMs)) {
    throw new Error('signed Full add-on admission deadline is unavailable');
  }
  if (!Number.isFinite(observedMs) || observedMs >= deadlineMs) {
    throw new Error('Full add-on workflow admission reached the signed Full add-on deadline');
  }
}

function writeArtifact(artifact: ValidationArtifact, output?: string): void {
  const bytes = `${JSON.stringify(artifact, null, 2)}\n`;
  if (output) {
    const target = path.resolve(output);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, bytes, { mode: 0o600 });
    fs.renameSync(temporary, target);
  }
  process.stdout.write(bytes);
}

export function verifyBrokerLookupResult(input: {
  authority: ReleaseBrokerAuthorityV1;
  fence: ReleaseMutationPreApiFenceV1;
  expected: BrokerAcceptanceExpectedIdentity;
  result: ReleaseMutationBrokerLedgerLookupResultV1;
  verifiedAt: string;
  expectedChallenge?: string;
  mode?: 'lookup' | 'historical';
}): ValidationArtifact {
  assertExpectedIdentity(input.fence, input.expected);
  const fenceErrors = validateReleaseMutationPreApiFence(input.fence, input.fence.request, input.authority);
  if (fenceErrors.length > 0) throw new Error(`signed pre-API fence is invalid: ${fenceErrors.join('; ')}`);
  const expectedLookup = lookupForFence(input.fence, input.expectedChallenge ?? input.result.lookup.challenge);
  const lookupErrors = validateReleaseMutationBrokerLedgerLookupResult(
    input.result, expectedLookup, input.authority, { now: input.verifiedAt },
  );
  if (lookupErrors.length > 0) throw new Error(`signed broker lookup is invalid: ${lookupErrors.join('; ')}`);
  if (input.result.status !== 'found') {
    throw new Error(`broker lookup is ${input.result.status}; reconciliation is required and redispatch is forbidden`);
  }
  assertAcceptanceIdentity(
    input.result, required(input.expected.runId, 'expected-run-id'), input.expected.runAttempt ?? Number.NaN,
  );
  const acceptanceErrors = validateHistoricalReleaseMutationAcceptanceReceipt(
    input.result.record.acceptance, input.fence.request, input.authority,
  );
  if (acceptanceErrors.length > 0) throw new Error(`signed broker acceptance is invalid: ${acceptanceErrors.join('; ')}`);
  assertFullAddonWorkflowAdmissionDeadline(
    input.fence, input.result.record.acceptance.full_addon_deadline_at, input.verifiedAt,
  );
  return buildArtifact({
    mode: input.mode ?? 'lookup', verifiedAt: input.verifiedAt,
    authority: input.authority, fence: input.fence, result: input.result,
  });
}

export function verifyHistoricalBrokerValidation(input: {
  currentAuthority: ReleaseBrokerAuthorityV1;
  validationBytes: Buffer;
  expectedValidationSha256: string;
  expected: BrokerAcceptanceExpectedIdentity;
  verifiedAt: string;
}): ValidationArtifact {
  if (sha256(input.validationBytes) !== input.expectedValidationSha256) {
    throw new Error('historical broker validation artifact digest is mismatched');
  }
  const prior = JSON.parse(input.validationBytes.toString('utf8')) as ValidationArtifact;
  if (
    prior.schema !== 'opl_app_release_broker_workflow_acceptance_validation.v1' || prior.status !== 'verified' ||
    !['lookup', 'admin-one-shot'].includes(prior.mode)
  ) {
    throw new Error('historical broker validation artifact schema/status/mode is invalid');
  }
  if (prior.mode === 'admin-one-shot') {
    if (!prior.admin_one_shot_admission) throw new Error('historical admin one-shot validation lacks its durable admission');
    const artifact = verifyAdminOneShotAdmission({
      authority: input.currentAuthority,
      admission: prior.admin_one_shot_admission,
      expected: input.expected,
      operatorActor: prior.admin_one_shot_admission.request.operator_actor,
      githubActor: prior.admin_one_shot_admission.request.operator_actor,
      verifiedAt: prior.verified_at,
      mode: 'historical',
    });
    if (
      prior.exact_run_id !== input.expected.runId || prior.run_attempt !== input.expected.runAttempt ||
      prior.request_sha256 !== artifact.request_sha256 || prior.pre_api_fence_sha256 !== artifact.pre_api_fence_sha256 ||
      prior.controller_sha !== artifact.controller_sha || prior.mutation_payload_sha256 !== artifact.mutation_payload_sha256
    ) throw new Error('historical admin one-shot validation derived summary is mismatched');
    return { ...artifact, verified_at: input.verifiedAt };
  }
  const result = prior.signed_lookup_envelope;
  if (!result || result.status !== 'found') throw new Error('historical broker validation does not retain a signed found envelope');
  const authority = resolveHistoricalReleaseBrokerAuthority(
    input.currentAuthority, prior.authority_epoch, prior.authority_sha256, prior.key_id,
  );
  const fence = result.record.acceptance.pre_api_fence;
  const artifact = verifyBrokerLookupResult({
    authority, fence, expected: input.expected, result, verifiedAt: prior.verified_at,
    expectedChallenge: result.lookup.challenge, mode: 'historical',
  });
  assertFullAddonWorkflowAdmissionDeadline(
    fence, result.record.acceptance.full_addon_deadline_at, input.verifiedAt,
  );
  if (
    prior.key_id !== result.signature.key_id || prior.request_sha256 !== releaseMutationBrokerRequestSha256(fence.request) ||
    prior.acceptance_sha256 !== sha256(canonicalJson(result.record.acceptance)) ||
    prior.exact_run_id !== result.record.acceptance.github.run_id || prior.run_attempt !== result.record.acceptance.github.run_attempt ||
    prior.lookup_linearized_at !== result.read_proof.linearized_at || prior.lookup_expires_at !== result.read_proof.expires_at ||
    prior.full_addon_deadline_at !== artifact.full_addon_deadline_at
  ) throw new Error('historical broker validation derived summary does not match its retained signed envelope');
  return { ...artifact, verified_at: input.verifiedAt };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      mode: { type: 'string' },
      'pre-api-fence-base64': { type: 'string' },
      validation: { type: 'string' },
      'expected-validation-sha256': { type: 'string' },
      'expected-repository': { type: 'string' },
      'expected-run-id': { type: 'string' },
      'expected-run-attempt': { type: 'string' },
      'expected-workflow': { type: 'string' },
      'expected-workflow-sha': { type: 'string' },
      'expected-payload-sha256': { type: 'string' },
      'expected-attempt-id': { type: 'string' },
      'expected-release-version': { type: 'string' },
      'expected-shell-ref': { type: 'string' },
      'expected-framework-ref': { type: 'string' },
      'expected-include-full': { type: 'string' },
      'expected-operator-actor': { type: 'string' },
      'expected-github-actor': { type: 'string' },
      authority: { type: 'string', default: 'contracts/app-release-broker-authority.json' },
      output: { type: 'string' },
    },
    strict: true,
  });
  const mode = required(values.mode, 'mode');
  if (!['lookup', 'historical', 'pre-api', 'admin-one-shot'].includes(mode)) throw new Error(`unsupported --mode ${mode}`);
  const expected = {
    repository: required(values['expected-repository'], 'expected-repository'),
    runId: values['expected-run-id'],
    runAttempt: values['expected-run-attempt'] ? Number(values['expected-run-attempt']) : undefined,
    workflow: required(values['expected-workflow'], 'expected-workflow'),
    workflowSha: required(values['expected-workflow-sha'], 'expected-workflow-sha'),
    payloadSha256: required(values['expected-payload-sha256'], 'expected-payload-sha256'),
    attemptId: required(values['expected-attempt-id'], 'expected-attempt-id'),
    releaseVersion: values['expected-release-version'],
    shellRef: values['expected-shell-ref'],
    frameworkRef: values['expected-framework-ref'],
    includeFull: values['expected-include-full'] as 'true' | 'false' | undefined,
  };
  if (expected.runAttempt !== undefined && (!Number.isSafeInteger(expected.runAttempt) || expected.runAttempt < 1)) {
    throw new Error('--expected-run-attempt must be a positive integer');
  }
  if (expected.includeFull !== undefined && !['true', 'false'].includes(expected.includeFull)) {
    throw new Error('--expected-include-full must be true or false');
  }
  const currentAuthority = readReleaseBrokerAuthority(values.authority);
  const authorityErrors = mode === 'historical' || mode === 'admin-one-shot'
    ? validateReleaseBrokerAuthority(currentAuthority, { capability: 'contract_read' })
    : validateReleaseBrokerLookupAuthority(currentAuthority);
  if (authorityErrors.length > 0) throw new Error(`release broker lookup authority is not ready: ${authorityErrors.join('; ')}`);

  if (mode === 'historical') {
    const validationPath = path.resolve(required(values.validation, 'validation'));
    const validationBytes = fs.readFileSync(validationPath);
    const expectedValidationSha = required(values['expected-validation-sha256'], 'expected-validation-sha256');
    const artifact = verifyHistoricalBrokerValidation({
      currentAuthority, validationBytes, expectedValidationSha256: expectedValidationSha,
      expected, verifiedAt: new Date().toISOString(),
    });
    writeArtifact(artifact, values.output);
    return;
  }

  if (mode === 'admin-one-shot') {
    const admission = decodeAdmission(required(values['pre-api-fence-base64'], 'pre-api-fence-base64'));
    const artifact = verifyAdminOneShotAdmission({
      authority: currentAuthority,
      admission,
      expected,
      operatorActor: required(values['expected-operator-actor'], 'expected-operator-actor'),
      githubActor: required(values['expected-github-actor'], 'expected-github-actor'),
      verifiedAt: new Date().toISOString(),
    });
    writeArtifact(artifact, values.output);
    return;
  }

  const authority = currentAuthority;

  const fenceBase64 = required(values['pre-api-fence-base64'], 'pre-api-fence-base64');
  const fence = decodeFence(fenceBase64);
  assertExpectedIdentity(fence, expected);
  const fenceErrors = validateReleaseMutationPreApiFence(fence, fence.request, authority);
  if (fenceErrors.length > 0) throw new Error(`signed pre-API fence is invalid: ${fenceErrors.join('; ')}`);
  if (mode === 'pre-api') {
    const verifiedAt = new Date().toISOString();
    assertFullAddonWorkflowAdmissionDeadline(fence, null, verifiedAt);
    writeArtifact(buildArtifact({ mode: 'pre-api', verifiedAt, authority, fence, result: null }), values.output);
    return;
  }

  const expectedLookup = lookupForFence(fence);
  const result = await remoteWorkflowBrokerLookup(authority, fenceBase64, expectedLookup);
  const verifiedAt = new Date().toISOString();
  const artifact = verifyBrokerLookupResult({
    authority, fence, expected, result, verifiedAt, expectedChallenge: expectedLookup.challenge,
  });
  writeArtifact(artifact, values.output);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      schema: 'opl_app_release_broker_workflow_acceptance_validation.v1',
      status: 'failed', error: error instanceof Error ? error.message : String(error),
    })}\n`);
    process.exitCode = 1;
  });
}
