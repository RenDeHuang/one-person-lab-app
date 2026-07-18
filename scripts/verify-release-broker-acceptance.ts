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
  buildReleaseMutationBrokerLedgerLookup,
  releaseMutationBrokerRequestSha256,
  releaseMutationPreApiFenceSha256,
  validateHistoricalReleaseMutationAcceptanceReceipt,
  validateReleaseMutationBrokerLedgerLookupResult,
  validateReleaseMutationPreApiFence,
  type ReleaseMutationBrokerLedgerLookupResultV1,
  type ReleaseMutationPreApiFenceV1,
} from './release-mutation-broker.ts';

export type ValidationArtifact = {
  schema: 'opl_app_release_broker_workflow_acceptance_validation.v1';
  status: 'verified';
  mode: 'lookup' | 'historical' | 'pre-api';
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
  promotion_checkpoint_authorization: ReleaseMutationPreApiFenceV1['promotion_checkpoint_authorization'];
};

export type BrokerAcceptanceExpectedIdentity = {
  repository: string;
  runId?: string;
  runAttempt?: number;
  workflow: string;
  workflowSha: string;
  payloadSha256: string;
  attemptId: string;
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
    promotion_checkpoint_authorization: input.fence.promotion_checkpoint_authorization,
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
  if (prior.schema !== 'opl_app_release_broker_workflow_acceptance_validation.v1' || prior.status !== 'verified' || prior.mode !== 'lookup') {
    throw new Error('historical broker validation artifact schema/status/mode is invalid');
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
      authority: { type: 'string', default: 'contracts/app-release-broker-authority.json' },
      output: { type: 'string' },
    },
    strict: true,
  });
  const mode = required(values.mode, 'mode');
  if (!['lookup', 'historical', 'pre-api'].includes(mode)) throw new Error(`unsupported --mode ${mode}`);
  const expected = {
    repository: required(values['expected-repository'], 'expected-repository'),
    runId: values['expected-run-id'],
    runAttempt: values['expected-run-attempt'] ? Number(values['expected-run-attempt']) : undefined,
    workflow: required(values['expected-workflow'], 'expected-workflow'),
    workflowSha: required(values['expected-workflow-sha'], 'expected-workflow-sha'),
    payloadSha256: required(values['expected-payload-sha256'], 'expected-payload-sha256'),
    attemptId: required(values['expected-attempt-id'], 'expected-attempt-id'),
  };
  if (expected.runAttempt !== undefined && (!Number.isSafeInteger(expected.runAttempt) || expected.runAttempt < 1)) {
    throw new Error('--expected-run-attempt must be a positive integer');
  }
  const currentAuthority = readReleaseBrokerAuthority(values.authority);
  const authorityErrors = mode === 'historical'
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
