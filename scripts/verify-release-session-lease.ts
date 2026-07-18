#!/usr/bin/env node

import { parseArgs } from 'node:util';
import {
  decodeReleaseSessionLease,
  validateReleaseSessionLease,
  type ReleaseMutation,
} from './release-session-lease.ts';
import { readReleaseBrokerAuthority, validateReleaseBrokerAuthority } from './release-broker-authority.ts';

const { values } = parseArgs({
  options: {
    lease: { type: 'string' }, 'stable-session-id': { type: 'string' },
    'release-cohort-ref': { type: 'string' }, repository: { type: 'string' },
    'operator-actor': { type: 'string' }, 'broker-actor': { type: 'string' }, mutation: { type: 'string' },
    'attempt-id': { type: 'string' }, workflow: { type: 'string' },
    'artifact-kind': { type: 'string' },
    'controller-workflow-sha': { type: 'string' },
    'artifact-app-sha': { type: 'string' },
    'target-attempt-id': { type: 'string' },
    'target-run-id': { type: 'string' },
    authority: { type: 'string', default: 'contracts/app-release-broker-authority.json' },
  },
  strict: true,
});
const errors: string[] = [];
for (const key of [
  'lease', 'stable-session-id', 'release-cohort-ref', 'repository', 'operator-actor', 'broker-actor', 'mutation', 'attempt-id',
  'workflow', 'artifact-kind', 'controller-workflow-sha', 'artifact-app-sha',
] as const) {
  if (!values[key]) errors.push(`missing --${key}`);
}
let lease: ReturnType<typeof decodeReleaseSessionLease> | null = null;
try {
  if (values.lease) lease = decodeReleaseSessionLease(values.lease);
} catch (error) {
  errors.push(`lease encoding or JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
}
let authority: ReturnType<typeof readReleaseBrokerAuthority> | null = null;
try {
  authority = readReleaseBrokerAuthority(values.authority!);
} catch (error) {
  errors.push(`release broker authority cannot be read: ${error instanceof Error ? error.message : String(error)}`);
}
if (authority) errors.push(...validateReleaseBrokerAuthority(authority, {
  capability: 'mutation_submit',
  currentWorkflowRef: process.env.GITHUB_REF,
  requireCredentialReceipt: false,
}));
if (lease && authority && errors.length === 0) {
  errors.push(...validateReleaseSessionLease(lease, {
    stableSessionId: values['stable-session-id']!, releaseCohortRef: values['release-cohort-ref']!,
    repository: values.repository!, operatorActor: values['operator-actor']!, brokerActor: values['broker-actor']!,
    mutation: values.mutation as ReleaseMutation,
    attemptId: values['attempt-id']!,
    workflow: values.workflow as typeof lease.workflow,
    artifactKind: values['artifact-kind'] as typeof lease.artifact_kind,
    controllerWorkflowSha: values['controller-workflow-sha']!,
    artifactAppSha: values['artifact-app-sha']!,
    mutationPayloadSha256: lease.mutation_payload_sha256,
    plannedSessionRevision: lease.planned_session_revision,
    targetAttemptId: values['target-attempt-id'] ?? null,
    targetRunId: values['target-run-id'] ?? null,
    issuer: authority.issuer,
    publicKeys: authority.trusted_ed25519_public_keys,
    requireSigned: true,
  }));
}
if (values.mutation === 'workflow_cancel' && (!values['target-attempt-id'] || !values['target-run-id'])) {
  errors.push('workflow_cancel requires --target-attempt-id and --target-run-id');
}
if (errors.length > 0) {
  process.stdout.write(`${JSON.stringify({ schema: 'opl_app_release_lease_validation.v1', status: 'failed', errors })}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ schema: 'opl_app_release_lease_validation.v1', status: 'passed', lease_id: lease!.payload_digest, operator_actor: lease!.operator_actor, broker_actor: lease!.broker_actor })}\n`);
}
