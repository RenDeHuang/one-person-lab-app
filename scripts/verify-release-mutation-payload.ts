#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { decodeReleaseSessionLease } from './release-session-lease.ts';
import {
  decodeReleaseMutationPayload,
  releaseMutationPayloadSha256,
} from './release-mutation-payload.ts';

const { values } = parseArgs({
  options: {
    payload: { type: 'string' }, lease: { type: 'string' }, field: { type: 'string', multiple: true, default: [] },
  },
  strict: true,
});
if (!values.payload || !values.lease) throw new Error('Mutation payload verification requires --payload and --lease.');
const payload = decodeReleaseMutationPayload(values.payload);
const lease = decodeReleaseSessionLease(values.lease);
const actual: Record<string, string> = {};
for (const entry of values.field ?? []) {
  const separator = entry.indexOf('=');
  if (separator <= 0) throw new Error(`Malformed mutation field ${entry}.`);
  actual[entry.slice(0, separator)] = entry.slice(separator + 1);
}
const digest = releaseMutationPayloadSha256(payload);
if (lease.mutation_payload_sha256 !== digest) throw new Error('Signed lease does not bind the supplied mutation payload.');
const expectedKeys = Object.keys(payload).sort();
const actualKeys = Object.keys(actual).sort();
if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
  throw new Error(`Mutation payload keys differ: expected ${expectedKeys.join(',')}, got ${actualKeys.join(',')}.`);
}
for (const key of expectedKeys) {
  if (actual[key] !== payload[key]) throw new Error(`Mutation payload field ${key} was tampered.`);
}
process.stdout.write(`${JSON.stringify({ status: 'verified', mutation_payload_sha256: digest })}\n`);
