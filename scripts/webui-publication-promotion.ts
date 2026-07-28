import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  validateWebuiPublicationRecord,
  type JsonRecord,
} from './webui-publication-record.ts';

const webuiRepository = 'ghcr.io/gaofeng21cn/one-person-lab-webui';
const digestPattern = /^sha256:[0-9a-f]{64}$/;

type DescriptorStatus = 'present' | 'absent' | 'unknown';
type PromotionDecision =
  | 'idempotent'
  | 'write_once'
  | 'stable_conflict'
  | 'latest_conflict'
  | 'prestate_unknown';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as JsonRecord;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(',')}}`;
}

function objectDigest(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function exact(value: unknown, expected: unknown, label: string): void {
  if (value !== expected) throw new Error(`${label} must equal ${String(expected)}.`);
}

function digest(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (!digestPattern.test(normalized)) throw new Error(`${label} must be an exact sha256 digest.`);
  return normalized;
}

function descriptor(value: unknown, expectedRef: string, label: string): JsonRecord {
  const observed = record(value, label);
  exact(observed.schema, 'opl_app_webui_descriptor_readback.v1', `${label}.schema`);
  exact(observed.ref, expectedRef, `${label}.ref`);
  const status = text(observed.status, `${label}.status`) as DescriptorStatus;
  if (!['present', 'absent', 'unknown'].includes(status)) {
    throw new Error(`${label}.status is invalid.`);
  }
  if (status === 'present') {
    digest(observed.digest, `${label}.digest`);
  } else if (observed.digest !== null) {
    throw new Error(`${label}.digest must be null when status is ${status}.`);
  }
  return observed;
}

function descriptorMatches(actual: JsonRecord, expected: JsonRecord): boolean {
  return actual.status === expected.status && actual.digest === expected.digest;
}

function presentVersionDescriptor(
  value: unknown,
  versionRef: string,
  expectedDigest: string,
  expectedChildDigest: string,
): JsonRecord {
  const observed = descriptor(value, versionRef, 'version readback');
  exact(observed.status, 'present', 'version readback.status');
  exact(observed.digest, expectedDigest, 'version readback.digest');
  exact(observed.child_digest, expectedChildDigest, 'version readback.child_digest');
  exact(observed.manifest_count, 1, 'version readback.manifest_count');
  if (![
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
  ].includes(text(observed.media_type, 'version readback.media_type'))) {
    throw new Error('version readback.media_type must be an OCI index or Docker manifest list.');
  }
  return observed;
}

function expectedPrestate(value: unknown, ref: string, label: string): JsonRecord {
  const observed = descriptor(value, ref, label);
  if (observed.status === 'unknown') {
    throw new Error(`${label} is unknown and cannot be used for a pointer mutation.`);
  }
  return { status: observed.status, digest: observed.digest };
}

function readJson(filePath: string, label: string): JsonRecord {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`${label} must be one non-empty regular file.`);
  }
  return record(JSON.parse(fs.readFileSync(resolved, 'utf8')), label);
}

function writeJson(filePath: string, value: unknown): void {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function admissionTarget(admission: JsonRecord): {
  repository: string;
  versionRef: string;
  receiptRef: string;
  stableRef: string;
  latestRef: string;
  digest: string;
  childDigest: string;
} {
  const target = record(admission.target, 'admission.target');
  const repository = text(target.repository, 'admission.target.repository');
  exact(repository, webuiRepository, 'admission.target.repository');
  const versionRef = text(target.version_ref, 'admission.target.version_ref');
  const receiptRef = text(target.receipt_ref, 'admission.target.receipt_ref');
  const stableRef = text(target.stable_ref, 'admission.target.stable_ref');
  const latestRef = text(target.latest_ref, 'admission.target.latest_ref');
  const version = text(record(admission.selector, 'admission.selector').publication_version, 'admission.selector.publication_version');
  exact(versionRef, `${repository}:${version}`, 'admission.target.version_ref');
  exact(receiptRef, `${repository}:receipt-${version}`, 'admission.target.receipt_ref');
  exact(stableRef, `${repository}:stable`, 'admission.target.stable_ref');
  exact(latestRef, `${repository}:latest`, 'admission.target.latest_ref');
  return {
    repository,
    versionRef,
    receiptRef,
    stableRef,
    latestRef,
    digest: digest(target.digest, 'admission.target.digest'),
    childDigest: digest(target.child_digest, 'admission.target.child_digest'),
  };
}

function admissionPrestate(admission: JsonRecord, target: ReturnType<typeof admissionTarget>): {
  stable: JsonRecord;
  latest: JsonRecord;
} {
  const prestate = record(admission.expected_prestate, 'admission.expected_prestate');
  const stable = expectedPrestate(
    {
      schema: 'opl_app_webui_descriptor_readback.v1',
      ref: target.stableRef,
      ...record(prestate.stable, 'admission.expected_prestate.stable'),
    },
    target.stableRef,
    'admission.expected_prestate.stable',
  );
  const latest = expectedPrestate(
    {
      schema: 'opl_app_webui_descriptor_readback.v1',
      ref: target.latestRef,
      ...record(prestate.latest, 'admission.expected_prestate.latest'),
    },
    target.latestRef,
    'admission.expected_prestate.latest',
  );
  return { stable, latest };
}

export type WebuiPublicationLatestAdmissionInput = {
  publicationVersion: string;
  publicationRecord: JsonRecord;
  versionReadback: JsonRecord;
  stablePrestate: JsonRecord;
  latestPrestate: JsonRecord;
};

export function admitWebuiPublicationLatestPromotion(
  input: WebuiPublicationLatestAdmissionInput,
): JsonRecord {
  const publication = validateWebuiPublicationRecord(input.publicationRecord);
  const release = record(publication.release, 'publication.release');
  const image = record(publication.image, 'publication.image');
  const selectorVersion = text(input.publicationVersion, 'publication version');
  exact(selectorVersion, release.version, 'selected publication version');
  exact(image.repository, webuiRepository, 'publication image.repository');
  const versionRef = text(image.version_ref, 'publication image.version_ref');
  const receiptRef = text(image.receipt_ref, 'publication image.receipt_ref');
  const stableRef = `${webuiRepository}:stable`;
  const latestRef = `${webuiRepository}:latest`;
  const versionDigest = digest(image.version_digest, 'publication image.version_digest');
  const childDigest = digest(image.child_digest, 'publication image.child_digest');
  presentVersionDescriptor(input.versionReadback, versionRef, versionDigest, childDigest);
  const stable = expectedPrestate(input.stablePrestate, stableRef, 'Stable prestate');
  const latest = expectedPrestate(input.latestPrestate, latestRef, 'Latest prestate');
  const classification = record(publication.classification, 'publication.classification');
  const authority = record(publication.authority, 'publication.authority');
  const selector = {
    source: 'durable_webui_publication_record',
    publication_id: text(publication.publication_id, 'publication.publication_id'),
    publication_record_digest: digest(
      publication.publication_record_digest,
      'publication.publication_record_digest',
    ),
    publication_version: selectorVersion,
    quality_status: text(classification.quality_status, 'publication.classification.quality_status'),
    authority_mode: text(authority.mode, 'publication.authority.mode'),
  };
  const target = {
    repository: webuiRepository,
    version_ref: versionRef,
    receipt_ref: receiptRef,
    stable_ref: stableRef,
    latest_ref: latestRef,
    digest: versionDigest,
    child_digest: childDigest,
    promotion_tags: ['latest'],
  };
  const state = {
    selector,
    target,
    expected_prestate: { stable, latest },
  };
  return {
    schema: 'opl_app_webui_publication_latest_admission.v1',
    status: 'passed',
    mutation_admitted: true,
    input_digest: objectDigest(state),
    ...state,
  };
}

export function decideWebuiPublicationLatestPromotion(
  admissionInput: JsonRecord,
  currentStableInput: JsonRecord,
  currentLatestInput: JsonRecord,
): JsonRecord {
  const admission = record(admissionInput, 'Latest admission');
  exact(admission.schema, 'opl_app_webui_publication_latest_admission.v1', 'Latest admission.schema');
  exact(admission.status, 'passed', 'Latest admission.status');
  exact(admission.mutation_admitted, true, 'Latest admission.mutation_admitted');
  const target = admissionTarget(admission);
  const expected = admissionPrestate(admission, target);
  const currentStable = descriptor(currentStableInput, target.stableRef, 'current Stable readback');
  const currentLatest = descriptor(currentLatestInput, target.latestRef, 'current Latest readback');
  const stableMatchesExpected = descriptorMatches(currentStable, expected.stable);
  const latestMatchesExpected = descriptorMatches(currentLatest, expected.latest);
  let decision: PromotionDecision;
  let writeCount = 0;
  if (currentStable.status === 'unknown' || currentLatest.status === 'unknown') {
    decision = 'prestate_unknown';
  } else if (!stableMatchesExpected) {
    decision = 'stable_conflict';
  } else if (currentLatest.status === 'present' && currentLatest.digest === target.digest) {
    decision = 'idempotent';
  } else if (!latestMatchesExpected) {
    decision = 'latest_conflict';
  } else {
    decision = 'write_once';
    writeCount = 1;
  }
  const result = {
    admission_input_digest: digest(admission.input_digest, 'Latest admission.input_digest'),
    target,
    expected_prestate: {
      stable: expected.stable,
      latest: expected.latest,
    },
    observed_prestate: {
      stable: { status: currentStable.status, digest: currentStable.digest },
      latest: { status: currentLatest.status, digest: currentLatest.digest },
    },
    decision,
    authorized_tag_attempts: writeCount,
  };
  return {
    schema: 'opl_app_webui_publication_latest_decision.v1',
    status: decision === 'idempotent' || decision === 'write_once' ? 'admitted' : 'rejected',
    write_performed: false,
    input_digest: objectDigest(result),
    ...result,
  };
}

function boundedReadbacks(value: unknown, ref: string, label: string): JsonRecord[] {
  const readbacks = record(value, label);
  exact(readbacks.schema, 'opl_app_webui_publication_latest_reconcile_readbacks.v1', `${label}.schema`);
  if (!Array.isArray(readbacks.observations) || readbacks.observations.length > 3) {
    throw new Error(`${label}.observations must contain at most three entries.`);
  }
  return readbacks.observations.map((entry, index) =>
    descriptor(entry, ref, `${label}.observations[${index}]`));
}

function mutationAttempt(value: unknown): { status: string; attemptCount: number } {
  const mutation = record(value, 'mutation');
  exact(mutation.schema, 'opl_app_webui_publication_latest_mutation_attempt.v1', 'mutation.schema');
  const status = text(mutation.status, 'mutation.status');
  if (!['accepted', 'unknown', 'not_attempted'].includes(status)) {
    throw new Error('mutation.status is invalid.');
  }
  const attemptCount = Number(mutation.attempt_count);
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 0 || attemptCount > 1) {
    throw new Error('mutation.attempt_count must be zero or one.');
  }
  if ((status === 'not_attempted') !== (attemptCount === 0)) {
    throw new Error('mutation.status must agree with mutation.attempt_count.');
  }
  return { status, attemptCount };
}

export function writeWebuiPublicationLatestPromotionReceipt(input: {
  admission: JsonRecord;
  decision: JsonRecord;
  mutation: JsonRecord;
  stableReadbacks: JsonRecord;
  latestReadbacks: JsonRecord;
  anonymousStableReadback: JsonRecord;
  anonymousLatestReadback: JsonRecord;
}): JsonRecord {
  const admission = record(input.admission, 'Latest admission');
  exact(admission.schema, 'opl_app_webui_publication_latest_admission.v1', 'Latest admission.schema');
  const decision = record(input.decision, 'Latest decision');
  exact(decision.schema, 'opl_app_webui_publication_latest_decision.v1', 'Latest decision.schema');
  const target = admissionTarget(admission);
  const expected = admissionPrestate(admission, target);
  exact(
    decision.admission_input_digest,
    admission.input_digest,
    'Latest decision.admission_input_digest',
  );
  const decisionName = text(decision.decision, 'Latest decision.decision') as PromotionDecision;
  if (![
    'idempotent',
    'write_once',
    'stable_conflict',
    'latest_conflict',
    'prestate_unknown',
  ].includes(decisionName)) {
    throw new Error('Latest decision.decision is invalid.');
  }
  const mutation = mutationAttempt(input.mutation);
  const stableReadbacks = boundedReadbacks(
    input.stableReadbacks,
    target.stableRef,
    'Stable reconcile readbacks',
  );
  const latestReadbacks = boundedReadbacks(
    input.latestReadbacks,
    target.latestRef,
    'Latest reconcile readbacks',
  );
  const anonymousStable = descriptor(
    input.anonymousStableReadback,
    target.stableRef,
    'anonymous Stable readback',
  );
  const anonymousLatest = descriptor(
    input.anonymousLatestReadback,
    target.latestRef,
    'anonymous Latest readback',
  );
  const stableFinalObserved = descriptorMatches(anonymousStable, expected.stable);
  const latestFinalObserved =
    anonymousLatest.status === 'present' && anonymousLatest.digest === target.digest;
  const stableBoundedObserved = stableReadbacks.some((entry) => descriptorMatches(entry, expected.stable));
  const latestBoundedObserved = latestReadbacks.some(
    (entry) => entry.status === 'present' && entry.digest === target.digest,
  );
  let status: 'complete' | 'idempotent' | 'reconciled_complete' | 'outcome_unknown' | 'failed';
  if (decisionName === 'idempotent') {
    if (mutation.attemptCount !== 0) {
      throw new Error('idempotent decision cannot perform a tag mutation.');
    }
    status = stableFinalObserved && latestFinalObserved ? 'idempotent' : 'failed';
  } else if (decisionName === 'write_once') {
    if (mutation.attemptCount !== 1) {
      status = 'failed';
    } else if (
      stableFinalObserved
      && latestFinalObserved
      && stableBoundedObserved
      && latestBoundedObserved
      && mutation.status === 'accepted'
    ) {
      status = 'complete';
    } else if (
      stableFinalObserved
      && latestFinalObserved
      && stableBoundedObserved
      && latestBoundedObserved
      && mutation.status === 'unknown'
    ) {
      status = 'reconciled_complete';
    } else {
      status = 'outcome_unknown';
    }
  } else {
    if (mutation.attemptCount !== 0) {
      throw new Error('rejected Latest decision cannot perform a tag mutation.');
    }
    status = 'failed';
  }
  const evidence = {
    selector: admission.selector,
    target: admission.target,
    expected_prestate: admission.expected_prestate,
    decision: {
      input_digest: decision.input_digest,
      decision: decisionName,
      observed_prestate: decision.observed_prestate,
      authorized_tag_attempts: decision.authorized_tag_attempts,
    },
    mutation: input.mutation,
    reconcile: {
      maximum_readbacks: 3,
      stable_expected_state_observed: stableBoundedObserved,
      latest_target_observed: latestBoundedObserved,
    },
    anonymous_readback: {
      stable: { status: anonymousStable.status, digest: anonymousStable.digest },
      latest: { status: anonymousLatest.status, digest: anonymousLatest.digest },
      logout_before_readback:
        input.anonymousStableReadback.logout_before_readback === true
        && input.anonymousLatestReadback.logout_before_readback === true,
      stable_unchanged: stableFinalObserved,
    },
  };
  if (
    status !== 'failed'
    && status !== 'outcome_unknown'
    && evidence.anonymous_readback.logout_before_readback !== true
  ) {
    status = mutation.attemptCount === 1 ? 'outcome_unknown' : 'failed';
  }
  return {
    schema: 'opl_app_webui_publication_latest_receipt.v1',
    status,
    mutation_performed: mutation.attemptCount === 1,
    retry_allowed: false,
    input_digest: objectDigest(evidence),
    ...evidence,
  };
}

function required(value: string | undefined, flag: string): string {
  if (!value?.trim()) throw new Error(`Missing --${flag}.`);
  return value.trim();
}

function main(argv: string[]): void {
  const command = argv[0];
  const { values } = parseArgs({
    args: argv.slice(1),
    strict: true,
    options: {
      'publication-version': { type: 'string' },
      'publication-record': { type: 'string' },
      'version-readback': { type: 'string' },
      'stable-prestate': { type: 'string' },
      'latest-prestate': { type: 'string' },
      admission: { type: 'string' },
      'current-stable': { type: 'string' },
      'current-latest': { type: 'string' },
      decision: { type: 'string' },
      mutation: { type: 'string' },
      'stable-readbacks': { type: 'string' },
      'latest-readbacks': { type: 'string' },
      'anonymous-stable-readback': { type: 'string' },
      'anonymous-latest-readback': { type: 'string' },
      output: { type: 'string' },
    },
  });
  if (command === 'admit') {
    const admission = admitWebuiPublicationLatestPromotion({
      publicationVersion: required(values['publication-version'], 'publication-version'),
      publicationRecord: readJson(required(values['publication-record'], 'publication-record'), 'publication record'),
      versionReadback: readJson(required(values['version-readback'], 'version-readback'), 'version readback'),
      stablePrestate: readJson(required(values['stable-prestate'], 'stable-prestate'), 'Stable prestate'),
      latestPrestate: readJson(required(values['latest-prestate'], 'latest-prestate'), 'Latest prestate'),
    });
    writeJson(required(values.output, 'output'), admission);
    process.stdout.write(`${JSON.stringify({
      status: admission.status,
      publication_id: admission.selector.publication_id,
      publication_version: admission.selector.publication_version,
      target_digest: admission.target.digest,
    })}\n`);
    return;
  }
  if (command === 'decide') {
    const decision = decideWebuiPublicationLatestPromotion(
      readJson(required(values.admission, 'admission'), 'Latest admission'),
      readJson(required(values['current-stable'], 'current-stable'), 'current Stable readback'),
      readJson(required(values['current-latest'], 'current-latest'), 'current Latest readback'),
    );
    writeJson(required(values.output, 'output'), decision);
    process.stdout.write(`${JSON.stringify({
      status: decision.status,
      decision: decision.decision,
      authorized_tag_attempts: decision.authorized_tag_attempts,
    })}\n`);
    return;
  }
  if (command === 'receipt') {
    const receipt = writeWebuiPublicationLatestPromotionReceipt({
      admission: readJson(required(values.admission, 'admission'), 'Latest admission'),
      decision: readJson(required(values.decision, 'decision'), 'Latest decision'),
      mutation: readJson(required(values.mutation, 'mutation'), 'mutation'),
      stableReadbacks: readJson(required(values['stable-readbacks'], 'stable-readbacks'), 'Stable readbacks'),
      latestReadbacks: readJson(required(values['latest-readbacks'], 'latest-readbacks'), 'Latest readbacks'),
      anonymousStableReadback: readJson(
        required(values['anonymous-stable-readback'], 'anonymous-stable-readback'),
        'anonymous Stable readback',
      ),
      anonymousLatestReadback: readJson(
        required(values['anonymous-latest-readback'], 'anonymous-latest-readback'),
        'anonymous Latest readback',
      ),
    });
    writeJson(required(values.output, 'output'), receipt);
    process.stdout.write(`${JSON.stringify({
      status: receipt.status,
      publication_id: receipt.selector.publication_id,
      publication_version: receipt.selector.publication_version,
    })}\n`);
    return;
  }
  throw new Error('Usage: webui-publication-promotion.ts <admit|decide|receipt> ...');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
