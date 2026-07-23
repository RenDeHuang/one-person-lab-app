#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

type JsonRecord = Record<string, any>;
type DescriptorStatus = 'present' | 'absent' | 'unknown';
type PromotionDecision = 'idempotent' | 'write_once' | 'conflict' | 'prestate_unknown';

const digestPattern = /^sha256:[0-9a-f]{64}$/;
const shaPattern = /^[0-9a-f]{40}$/;
const runPattern = /^[1-9][0-9]*$/;
const versionPattern = /^[0-9]{2}\.[0-9]{1,2}\.[0-9]{1,2}(?:-r[1-9][0-9]*)?$/;
const appRepository = 'gaofeng21cn/one-person-lab-app';
const frameworkRepository = 'gaofeng21cn/one-person-lab';
const webuiRepository = 'ghcr.io/gaofeng21cn/one-person-lab-webui';

function record(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
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

function sha(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (!shaPattern.test(normalized)) throw new Error(`${label} must be a full lowercase Git SHA.`);
  return normalized;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(`${label} must be a positive integer.`);
  return Number(value);
}

function readJson(filePath: string, label: string): JsonRecord {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`${label} must be one non-empty regular JSON file.`);
  }
  return record(JSON.parse(fs.readFileSync(resolved, 'utf8')), label);
}

function fileDigest(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(path.resolve(filePath))).digest('hex')}`;
}

function objectDigest(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function descriptor(value: unknown, expectedRef: string, label: string): JsonRecord {
  const observation = record(value, label);
  exact(observation.schema, 'opl_app_webui_descriptor_readback.v1', `${label}.schema`);
  exact(observation.ref, expectedRef, `${label}.ref`);
  const status = text(observation.status, `${label}.status`) as DescriptorStatus;
  if (!['present', 'absent', 'unknown'].includes(status)) throw new Error(`${label}.status is invalid.`);
  if (status === 'present') digest(observation.digest, `${label}.digest`);
  else if (observation.digest !== null) throw new Error(`${label}.digest must be null unless present.`);
  return observation;
}

function validateSourceRun(run: JsonRecord, sourceRunId: string, appSha: string): void {
  exact(String(run.id), sourceRunId, 'source run.id');
  exact(run.repository?.full_name, appRepository, 'source run.repository');
  exact(run.head_repository?.full_name, appRepository, 'source run.head_repository');
  exact(run.path, '.github/workflows/release-stable.yml', 'source run.path');
  exact(run.event, 'workflow_dispatch', 'source run.event');
  exact(run.head_branch, 'main', 'source run.head_branch');
  exact(run.status, 'completed', 'source run.status');
  exact(run.conclusion, 'success', 'source run.conclusion');
  exact(run.run_attempt, 1, 'source run.run_attempt');
  exact(sha(run.head_sha, 'source run.head_sha'), appSha, 'source run.head_sha');
}

function appWebuiCarrier(receipt: JsonRecord): {
  release: JsonRecord;
  cohort: JsonRecord;
  carrier: JsonRecord;
} {
  exact(receipt.schema, 'opl_app_webui_release_carrier.v1', 'carrier receipt.schema');
  const release = record(receipt.release, 'carrier receipt.release');
  const version = text(release.version, 'carrier receipt.release.version');
  if (!versionPattern.test(version)) throw new Error('carrier receipt release.version is invalid.');
  digest(release.bundle_digest, 'carrier receipt.release.bundle_digest');
  digest(release.cohort_ref, 'carrier receipt.release.cohort_ref');
  const cohort = record(receipt.cohort, 'carrier receipt.cohort');
  sha(cohort.app_sha, 'carrier receipt.cohort.app_sha');
  sha(cohort.shell_sha, 'carrier receipt.cohort.shell_sha');
  sha(cohort.framework_sha, 'carrier receipt.cohort.framework_sha');
  const carrier = record(receipt.carrier, 'carrier receipt.carrier');
  exact(carrier.carrier_id, 'docker_webui', 'carrier receipt.carrier.carrier_id');
  exact(carrier.carrier_kind, 'oci_image', 'carrier receipt.carrier.carrier_kind');
  exact(carrier.package_profile, 'webui-full', 'carrier receipt.carrier.package_profile');
  const carrierDigest = digest(carrier.digest, 'carrier receipt.carrier.digest');
  exact(carrier.ref, `${webuiRepository}@${carrierDigest}`, 'carrier receipt.carrier.ref');
  positiveInteger(carrier.size_bytes, 'carrier receipt.carrier.size_bytes');
  digest(carrier.content_fingerprint, 'carrier receipt.carrier.content_fingerprint');
  exact(carrier.os, 'linux', 'carrier receipt.carrier.os');
  exact(carrier.architecture, 'amd64', 'carrier receipt.carrier.architecture');
  const qualification = record(receipt.qualification, 'carrier receipt.qualification');
  exact(qualification.status, 'passed', 'carrier receipt.qualification.status');
  exact(qualification.image_digest, carrierDigest, 'carrier receipt.qualification.image_digest');
  exact(
    qualification.content_fingerprint,
    carrier.content_fingerprint,
    'carrier receipt.qualification.content_fingerprint',
  );
  return { release, cohort, carrier };
}

function frameworkWebuiCarrier(receipt: JsonRecord, expected: JsonRecord, label: string): void {
  if (!Array.isArray(receipt.app?.carriers) || receipt.app.carriers.length !== 2) {
    throw new Error(`${label}.app.carriers must contain exactly two carriers.`);
  }
  const matches = receipt.app.carriers.filter((entry: unknown) => record(entry, `${label}.app.carriers[]`).carrier_id === 'docker_webui');
  if (matches.length !== 1) throw new Error(`${label}.app.carriers must contain one docker_webui carrier.`);
  const carrier = record(matches[0], `${label}.app.carriers[docker_webui]`);
  exact(carrier.carrier_kind, 'oci_image', `${label} WebUI carrier kind`);
  exact(carrier.package_profile, 'webui-full', `${label} WebUI package profile`);
  exact(carrier.ref, expected.ref, `${label} WebUI ref`);
  exact(carrier.digest, expected.digest, `${label} WebUI digest`);
  exact(carrier.content_fingerprint, expected.content_fingerprint, `${label} WebUI content fingerprint`);
  exact(positiveInteger(carrier.size, `${label} WebUI size`), expected.size_bytes, `${label} WebUI size`);
}

function validateFrameworkPair(
  candidate: JsonRecord,
  stable: JsonRecord,
  sourceRunId: string,
  release: JsonRecord,
  cohort: JsonRecord,
  carrier: JsonRecord,
): void {
  exact(candidate.surface_kind, 'opl_release_set_promotion_receipt.v1', 'candidate surface_kind');
  exact(candidate.status, 'published_immutable_candidate', 'candidate status');
  exact(candidate.promotion_target, 'candidate', 'candidate promotion_target');
  exact(stable.surface_kind, 'opl_release_set_promotion_receipt.v1', 'Stable surface_kind');
  exact(stable.status, 'promoted_latest_stable', 'Stable status');
  exact(stable.promotion_target, 'latest-stable', 'Stable promotion_target');
  for (const [field, expected] of [
    ['promotion_request_id', candidate.promotion_request_id],
    ['release_gate', candidate.release_gate],
    ['release_set_generation', candidate.release_set_generation],
    ['source_app_run_id', sourceRunId],
  ] as const) {
    exact(stable[field], expected, `Framework ${field}`);
  }
  exact(candidate.source_app_run_id, sourceRunId, 'candidate source_app_run_id');
  exact(candidate.app?.version, release.version, 'candidate App version');
  exact(candidate.app?.source_commit, cohort.app_sha, 'candidate App source commit');
  exact(stable.app?.version, release.version, 'Stable App version');
  exact(stable.app?.source_commit, cohort.app_sha, 'Stable App source commit');
  exact(stable.components?.base?.source_commit, cohort.framework_sha, 'Stable Framework source commit');
  if (!runPattern.test(text(candidate.framework_run?.run_id, 'candidate framework run id'))
    || !runPattern.test(text(stable.framework_run?.run_id, 'Stable framework run id'))) {
    throw new Error('Framework run ids are invalid.');
  }
  exact(candidate.framework_run?.repository, frameworkRepository, 'candidate Framework repository');
  exact(stable.framework_run?.repository, frameworkRepository, 'Stable Framework repository');
  exact(stable.carrier?.digest, candidate.carrier?.digest, 'Framework Release Set carrier digest');
  exact(stable.carrier?.immutable_ref, candidate.carrier?.immutable_ref, 'Framework immutable Release Set ref');
  if (JSON.stringify(stable.app) !== JSON.stringify(candidate.app)
    || JSON.stringify(stable.components) !== JSON.stringify(candidate.components)) {
    throw new Error('Framework Stable receipt changed the candidate App or component set.');
  }
  frameworkWebuiCarrier(candidate, carrier, 'candidate');
  frameworkWebuiCarrier(stable, carrier, 'Stable');
}

export type WebuiStableAdmissionInput = {
  sourceRun: JsonRecord;
  sourceRunId: string;
  frameworkCandidateRunId: string;
  frameworkStableRunId: string;
  appSha: string;
  carrierReceipt: JsonRecord;
  carrierReceiptPath: string;
  frameworkCandidateReceipt: JsonRecord;
  frameworkCandidateReceiptPath: string;
  frameworkStableReceipt: JsonRecord;
  frameworkStableReceiptPath: string;
  homebrewReadback: JsonRecord;
  homebrewReadbackPath: string;
  latestAdmission: JsonRecord;
  latestAdmissionPath: string;
  latestResult: JsonRecord;
  latestResultPath: string;
  githubLatest: JsonRecord;
  githubLatestPath: string;
  immutableReadback: JsonRecord;
  immutableReadbackPath: string;
  versionReadback: JsonRecord;
  versionReadbackPath: string;
  stablePrestate: JsonRecord;
  stablePrestatePath: string;
};

export function admitWebuiStablePromotion(input: WebuiStableAdmissionInput): JsonRecord {
  if (!runPattern.test(input.sourceRunId)) throw new Error('source App run id is invalid.');
  if (!runPattern.test(input.frameworkCandidateRunId) || !runPattern.test(input.frameworkStableRunId)) {
    throw new Error('Framework promotion run ids are invalid.');
  }
  const appSha = sha(input.appSha, 'App SHA');
  validateSourceRun(input.sourceRun, input.sourceRunId, appSha);
  const { release, cohort, carrier } = appWebuiCarrier(input.carrierReceipt);
  exact(cohort.app_sha, appSha, 'carrier cohort App SHA');
  validateFrameworkPair(
    input.frameworkCandidateReceipt,
    input.frameworkStableReceipt,
    input.sourceRunId,
    release,
    cohort,
    carrier,
  );
  exact(
    String(input.frameworkCandidateReceipt.framework_run.run_id),
    input.frameworkCandidateRunId,
    'candidate Framework run id',
  );
  exact(
    String(input.frameworkStableReceipt.framework_run.run_id),
    input.frameworkStableRunId,
    'Stable Framework run id',
  );

  const immutable = descriptor(input.immutableReadback, carrier.ref, 'immutable readback');
  exact(immutable.status, 'present', 'immutable readback.status');
  exact(immutable.digest, carrier.digest, 'immutable readback.digest');
  const versionRef = `${webuiRepository}:${release.version}`;
  const version = descriptor(input.versionReadback, versionRef, 'version readback');
  exact(version.status, 'present', 'version readback.status');
  exact(version.digest, carrier.digest, 'version readback.digest');
  const stableRef = `${webuiRepository}:stable`;
  const prestate = descriptor(input.stablePrestate, stableRef, 'Stable prestate');
  if (prestate.status === 'unknown') throw new Error('Stable prestate is unknown and cannot be treated as absent.');

  exact(input.homebrewReadback.schema, 'opl_bundle_homebrew_readback_receipt.v1', 'Homebrew readback schema');
  exact(input.homebrewReadback.status, 'passed', 'Homebrew readback status');
  exact(input.homebrewReadback.track, 'standard', 'Homebrew readback track');
  exact(input.homebrewReadback.bundle_digest, release.bundle_digest, 'Homebrew bundle digest');
  exact(input.homebrewReadback.release_version, release.version, 'Homebrew release version');
  digest(input.homebrewReadback.publication_receipt_sha256, 'Homebrew publication receipt digest');
  digest(input.homebrewReadback.clean_vm_receipt_sha256, 'Homebrew clean VM receipt digest');

  exact(input.latestAdmission.schema, 'opl_standard_latest_admission_receipt.v1', 'Latest admission schema');
  exact(input.latestAdmission.status, 'passed', 'Latest admission status');
  exact(input.latestAdmission.latest_activation_admitted, true, 'Latest activation admission');
  exact(input.latestAdmission.bundle_digest, release.bundle_digest, 'Latest admission bundle digest');
  exact(input.latestAdmission.candidate?.display_version, release.version, 'Latest admission display version');
  exact(input.latestAdmission.candidate?.app_sha, cohort.app_sha, 'Latest admission App SHA');
  exact(input.latestAdmission.candidate?.shell_sha, cohort.shell_sha, 'Latest admission Shell SHA');
  exact(input.latestAdmission.candidate?.framework_sha, cohort.framework_sha, 'Latest admission Framework SHA');
  exact(
    input.latestAdmission.candidate?.updater_version,
    input.homebrewReadback.updater_version,
    'Latest admission updater version',
  );
  exact(
    input.latestAdmission.homebrew?.readback_receipt_sha256,
    fileDigest(input.homebrewReadbackPath),
    'Latest admission Homebrew readback digest',
  );

  if (!['complete', 'idempotent'].includes(input.latestResult.status)) {
    throw new Error('Latest activation result must be complete or idempotent.');
  }
  exact(input.latestResult.repository, appRepository, 'Latest result repository');
  exact(input.latestResult.tag, `v${release.version}`, 'Latest result tag');
  const patchPerformed = input.latestResult.latest_compare_and_swap?.patch_performed;
  exact(
    patchPerformed,
    input.latestResult.status === 'complete',
    'Latest result patch_performed',
  );
  exact(input.githubLatest.tag_name, `v${release.version}`, 'fresh GitHub Latest tag');
  exact(input.githubLatest.draft, false, 'fresh GitHub Latest draft');
  exact(input.githubLatest.prerelease, false, 'fresh GitHub Latest prerelease');

  const evidence = {
    carrier_receipt_sha256: fileDigest(input.carrierReceiptPath),
    framework_candidate_receipt_sha256: fileDigest(input.frameworkCandidateReceiptPath),
    framework_latest_stable_receipt_sha256: fileDigest(input.frameworkStableReceiptPath),
    homebrew_readback_receipt_sha256: fileDigest(input.homebrewReadbackPath),
    latest_admission_receipt_sha256: fileDigest(input.latestAdmissionPath),
    latest_result_receipt_sha256: fileDigest(input.latestResultPath),
    github_latest_readback_sha256: fileDigest(input.githubLatestPath),
    immutable_readback_sha256: fileDigest(input.immutableReadbackPath),
    version_readback_sha256: fileDigest(input.versionReadbackPath),
    stable_prestate_sha256: fileDigest(input.stablePrestatePath),
  };
  const authority = {
    source: {
      app_repository: appRepository,
      app_run_id: input.sourceRunId,
      app_run_attempt: 1,
      app_head_sha: appSha,
      workflow: '.github/workflows/release-stable.yml',
    },
    release: {
      version: release.version,
      bundle_digest: release.bundle_digest,
      cohort_ref: release.cohort_ref,
      app_sha: cohort.app_sha,
      shell_sha: cohort.shell_sha,
      framework_sha: cohort.framework_sha,
    },
    framework: {
      promotion_request_id: input.frameworkStableReceipt.promotion_request_id,
      release_set_generation: input.frameworkStableReceipt.release_set_generation,
      candidate_run_id: input.frameworkCandidateRunId,
      latest_stable_run_id: input.frameworkStableRunId,
    },
    target: {
      repository: webuiRepository,
      immutable_ref: carrier.ref,
      version_ref: versionRef,
      stable_ref: stableRef,
      digest: carrier.digest,
      size_bytes: carrier.size_bytes,
      content_fingerprint: carrier.content_fingerprint,
    },
    expected_prestate: {
      status: prestate.status,
      digest: prestate.digest,
    },
    evidence,
  };
  return {
    schema: 'opl_app_webui_stable_promotion_admission.v1',
    status: 'passed',
    mutation_admitted: true,
    input_digest: objectDigest(authority),
    ...authority,
  };
}

export function decideWebuiStablePromotion(admission: JsonRecord, currentInput: JsonRecord): JsonRecord {
  exact(admission.schema, 'opl_app_webui_stable_promotion_admission.v1', 'admission schema');
  exact(admission.status, 'passed', 'admission status');
  exact(admission.mutation_admitted, true, 'admission mutation authorization');
  const target = record(admission.target, 'admission.target');
  const expected = record(admission.expected_prestate, 'admission.expected_prestate');
  const current = descriptor(currentInput, text(target.stable_ref, 'target stable ref'), 'current Stable readback');
  let decision: PromotionDecision;
  let writeCount = 0;
  if (current.status === 'unknown') {
    decision = 'prestate_unknown';
  } else if (current.status === 'present' && current.digest === target.digest) {
    decision = 'idempotent';
  } else if (
    (expected.status === 'absent' && current.status === 'absent')
    || (
      expected.status === 'present'
      && current.status === 'present'
      && current.digest === expected.digest
      && current.digest !== target.digest
    )
  ) {
    decision = 'write_once';
    writeCount = 1;
  } else {
    decision = 'conflict';
  }
  const authority = {
    admission_input_digest: admission.input_digest,
    stable_ref: target.stable_ref,
    target_digest: target.digest,
    expected_prestate: expected,
    observed_prestate: { status: current.status, digest: current.digest },
    decision,
    authorized_tag_attempts: writeCount,
  };
  return {
    schema: 'opl_app_webui_stable_promotion_decision.v1',
    status: decision === 'idempotent' || decision === 'write_once' ? 'admitted' : 'rejected',
    decision,
    write_performed: false,
    input_digest: objectDigest(authority),
    ...authority,
  };
}

export function writeWebuiStablePromotionReceipt(input: {
  admission: JsonRecord;
  decision: JsonRecord;
  mutation: JsonRecord;
  readbacks: JsonRecord;
  anonymousReadback: JsonRecord;
}): JsonRecord {
  exact(input.admission.schema, 'opl_app_webui_stable_promotion_admission.v1', 'admission schema');
  exact(input.decision.schema, 'opl_app_webui_stable_promotion_decision.v1', 'decision schema');
  const target = record(input.admission.target, 'admission.target');
  const decision = text(input.decision.decision, 'decision.decision') as PromotionDecision;
  const attemptCount = Number(input.mutation.attempt_count);
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 0 || attemptCount > 1) {
    throw new Error('mutation attempt_count must be zero or one.');
  }
  const readbacks = input.readbacks;
  exact(readbacks.schema, 'opl_app_webui_stable_reconcile_readbacks.v1', 'readbacks schema');
  if (!Array.isArray(readbacks.observations) || readbacks.observations.length > 3) {
    throw new Error('bounded reconcile must contain at most three observations.');
  }
  const observations = readbacks.observations.map((value: unknown, index: number) =>
    descriptor(value, target.stable_ref, `readbacks[${index}]`));
  const anonymous = descriptor(input.anonymousReadback, target.stable_ref, 'anonymous final readback');
  const targetObserved = anonymous.status === 'present' && anonymous.digest === target.digest;
  const boundedTargetObserved = observations.some(
    (entry) => entry.status === 'present' && entry.digest === target.digest,
  );
  let status: 'complete' | 'idempotent' | 'reconciled_complete' | 'outcome_unknown' | 'failed';
  if (decision === 'idempotent') {
    if (attemptCount !== 0) throw new Error('idempotent decision cannot perform a tag mutation.');
    status = targetObserved ? 'idempotent' : 'failed';
  } else if (decision === 'write_once') {
    if (attemptCount === 0 && input.mutation.status === 'not_attempted') {
      status = 'failed';
    } else if (attemptCount !== 1) {
      throw new Error('write_once decision permits zero pre-mutation failure attempts or exactly one tag attempt.');
    } else if (targetObserved && boundedTargetObserved && input.mutation.status === 'accepted') {
      status = 'complete';
    } else if (
      targetObserved
      && boundedTargetObserved
      && input.mutation.status === 'unknown'
    ) {
      status = 'reconciled_complete';
    } else {
      status = 'outcome_unknown';
    }
  } else {
    if (attemptCount !== 0) throw new Error('rejected CAS decision cannot perform a tag mutation.');
    status = 'failed';
  }
  const evidence = {
    admission_input_digest: input.admission.input_digest,
    decision_input_digest: input.decision.input_digest,
    source: input.admission.source,
    release: input.admission.release,
    framework: input.admission.framework,
    target,
    compare_and_swap: {
      decision,
      expected_prestate: input.admission.expected_prestate,
      observed_prestate: input.decision.observed_prestate,
      tag_attempt_count: attemptCount,
      second_tag_attempted: false,
    },
    mutation: input.mutation,
    reconcile: {
      maximum_readbacks: 3,
      performed_readbacks: observations.length,
      target_observed: observations.some(
        (entry) => entry.status === 'present' && entry.digest === target.digest,
      ),
    },
    anonymous_readback: {
      status: anonymous.status,
      digest: anonymous.digest,
      logout_before_readback: input.anonymousReadback.logout_before_readback === true,
    },
  };
  if (status !== 'failed' && status !== 'outcome_unknown') {
    if (evidence.anonymous_readback.logout_before_readback !== true || !targetObserved) {
      status = attemptCount === 1 ? 'outcome_unknown' : 'failed';
    }
  }
  return {
    schema: 'opl_app_webui_stable_promotion_receipt.v1',
    status,
    mutation_performed: attemptCount === 1,
    retry_allowed: false,
    input_digest: objectDigest(evidence),
    ...evidence,
  };
}

function required(value: string | undefined, flag: string): string {
  if (!value?.trim()) throw new Error(`Missing --${flag}.`);
  return value.trim();
}

function writeOutput(filePath: string, value: JsonRecord): void {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function main(argv: string[]): void {
  const command = argv[0];
  const { values } = parseArgs({
    args: argv.slice(1),
    strict: true,
    options: {
      'source-run': { type: 'string' },
      'source-run-id': { type: 'string' },
      'framework-candidate-run-id': { type: 'string' },
      'framework-stable-run-id': { type: 'string' },
      'app-sha': { type: 'string' },
      'carrier-receipt': { type: 'string' },
      'framework-candidate-receipt': { type: 'string' },
      'framework-stable-receipt': { type: 'string' },
      'homebrew-readback': { type: 'string' },
      'latest-admission': { type: 'string' },
      'latest-result': { type: 'string' },
      'github-latest': { type: 'string' },
      'immutable-readback': { type: 'string' },
      'version-readback': { type: 'string' },
      'stable-prestate': { type: 'string' },
      admission: { type: 'string' },
      decision: { type: 'string' },
      current: { type: 'string' },
      mutation: { type: 'string' },
      readbacks: { type: 'string' },
      'anonymous-readback': { type: 'string' },
      output: { type: 'string' },
    },
  });
  let result: JsonRecord;
  if (command === 'admit') {
    const carrierReceiptPath = required(values['carrier-receipt'], 'carrier-receipt');
    const frameworkCandidateReceiptPath = required(
      values['framework-candidate-receipt'],
      'framework-candidate-receipt',
    );
    const frameworkStableReceiptPath = required(
      values['framework-stable-receipt'],
      'framework-stable-receipt',
    );
    const homebrewReadbackPath = required(values['homebrew-readback'], 'homebrew-readback');
    const latestAdmissionPath = required(values['latest-admission'], 'latest-admission');
    const latestResultPath = required(values['latest-result'], 'latest-result');
    const githubLatestPath = required(values['github-latest'], 'github-latest');
    const immutableReadbackPath = required(values['immutable-readback'], 'immutable-readback');
    const versionReadbackPath = required(values['version-readback'], 'version-readback');
    const stablePrestatePath = required(values['stable-prestate'], 'stable-prestate');
    result = admitWebuiStablePromotion({
      sourceRun: readJson(required(values['source-run'], 'source-run'), 'source run'),
      sourceRunId: required(values['source-run-id'], 'source-run-id'),
      frameworkCandidateRunId: required(
        values['framework-candidate-run-id'],
        'framework-candidate-run-id',
      ),
      frameworkStableRunId: required(
        values['framework-stable-run-id'],
        'framework-stable-run-id',
      ),
      appSha: required(values['app-sha'], 'app-sha'),
      carrierReceipt: readJson(carrierReceiptPath, 'carrier receipt'),
      carrierReceiptPath,
      frameworkCandidateReceipt: readJson(frameworkCandidateReceiptPath, 'Framework candidate receipt'),
      frameworkCandidateReceiptPath,
      frameworkStableReceipt: readJson(frameworkStableReceiptPath, 'Framework Stable receipt'),
      frameworkStableReceiptPath,
      homebrewReadback: readJson(homebrewReadbackPath, 'Homebrew readback'),
      homebrewReadbackPath,
      latestAdmission: readJson(latestAdmissionPath, 'Latest admission'),
      latestAdmissionPath,
      latestResult: readJson(latestResultPath, 'Latest result'),
      latestResultPath,
      githubLatest: readJson(githubLatestPath, 'GitHub Latest'),
      githubLatestPath,
      immutableReadback: readJson(immutableReadbackPath, 'immutable readback'),
      immutableReadbackPath,
      versionReadback: readJson(versionReadbackPath, 'version readback'),
      versionReadbackPath,
      stablePrestate: readJson(stablePrestatePath, 'Stable prestate'),
      stablePrestatePath,
    });
  } else if (command === 'decide') {
    result = decideWebuiStablePromotion(
      readJson(required(values.admission, 'admission'), 'admission'),
      readJson(required(values.current, 'current'), 'current Stable readback'),
    );
  } else if (command === 'receipt') {
    result = writeWebuiStablePromotionReceipt({
      admission: readJson(required(values.admission, 'admission'), 'admission'),
      decision: readJson(required(values.decision, 'decision'), 'decision'),
      mutation: readJson(required(values.mutation, 'mutation'), 'mutation'),
      readbacks: readJson(required(values.readbacks, 'readbacks'), 'readbacks'),
      anonymousReadback: readJson(
        required(values['anonymous-readback'], 'anonymous-readback'),
        'anonymous readback',
      ),
    });
  } else {
    throw new Error('Usage: webui-stable-promotion.ts <admit|decide|receipt> [options].');
  }
  writeOutput(required(values.output, 'output'), result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
