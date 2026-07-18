import crypto from 'node:crypto';

export type ReleaseMutationPayload = Record<string, string>;

export function canonicalReleaseMutationPayload(payload: ReleaseMutationPayload): string {
  return JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([left], [right]) => left.localeCompare(right))));
}

export function releaseMutationPayloadSha256(payload: ReleaseMutationPayload): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalReleaseMutationPayload(payload)).digest('hex')}`;
}

export function encodeReleaseMutationPayload(payload: ReleaseMutationPayload): string {
  return Buffer.from(canonicalReleaseMutationPayload(payload), 'utf8').toString('base64');
}

export function decodeReleaseMutationPayload(encoded: string): ReleaseMutationPayload {
  const value = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Mutation payload must be an object.');
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!key || typeof entry !== 'string') throw new Error('Mutation payload keys and values must be strings.');
  }
  return value as ReleaseMutationPayload;
}
