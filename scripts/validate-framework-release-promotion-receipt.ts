#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from 'node:util';

const canonicalPackageIds = [
  'mas',
  'mag',
  'rca',
  'oma',
  'obf',
  'mas-scholar-skills',
  'opl-flow',
] as const;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const shaPattern = /^[0-9a-f]{40}$/;

type JsonRecord = Record<string, unknown>;

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

function digest(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (!digestPattern.test(normalized)) throw new Error(`${label} must be a sha256 digest.`);
  return normalized;
}

function sameJson(left: unknown, right: unknown, label: string): void {
  if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(`${label} changed between candidate and Stable promotion.`);
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(`${label} must be a positive integer.`);
  return Number(value);
}

function component(
  value: unknown,
  label: string,
  expectedId: string,
  expectedArtifactPrefix: string,
): JsonRecord {
  const entry = record(value, label);
  if (entry.component_id !== expectedId) throw new Error(`${label}.component_id must be ${expectedId}.`);
  text(entry.version, `${label}.version`);
  if (!shaPattern.test(text(entry.source_commit, `${label}.source_commit`))) {
    throw new Error(`${label}.source_commit must be a full Git SHA.`);
  }
  const artifactRef = text(entry.artifact_ref, `${label}.artifact_ref`);
  if (!artifactRef.startsWith(expectedArtifactPrefix)) {
    throw new Error(`${label}.artifact_ref must use ${expectedArtifactPrefix}.`);
  }
  digest(entry.artifact_digest, `${label}.artifact_digest`);
  return entry;
}

function validateComponentLocks(receipt: JsonRecord): {
  base: JsonRecord;
  packages: JsonRecord;
  expectedReadbackRefs: string[];
} {
  const components = record(receipt.components, 'components');
  const base = component(
    components.base,
    'components.base',
    'opl-base',
    'ghcr.io/gaofeng21cn/one-person-lab-framework:',
  );
  const packages = record(components.packages, 'components.packages');
  const memberIds = Object.keys(packages).sort();
  if (JSON.stringify(memberIds) !== JSON.stringify([...canonicalPackageIds].sort())) {
    throw new Error('components.packages must contain exactly the canonical seven Package ids.');
  }
  const expectedReadbackRefs = [
    text(record(receipt.carrier, 'carrier').channel_ref, 'carrier.channel_ref'),
    `ghcr.io/gaofeng21cn/one-person-lab-framework:${receipt.promotion_target}`,
  ];
  for (const packageId of canonicalPackageIds) {
    component(
      packages[packageId],
      `components.packages.${packageId}`,
      packageId,
      `ghcr.io/gaofeng21cn/one-person-lab-packages/${packageId}:`,
    );
    expectedReadbackRefs.push(`ghcr.io/gaofeng21cn/one-person-lab-packages/${packageId}:${receipt.promotion_target}`);
  }
  return { base, packages, expectedReadbackRefs: expectedReadbackRefs.sort() };
}

function validateWebuiCarrierBinding(app: JsonRecord, carrierReceiptPath: string): void {
  if (!Array.isArray(app.carriers) || app.carriers.length !== 2) {
    throw new Error('app.carriers must contain exactly macos_standard and docker_webui.');
  }
  const carriers = app.carriers.map((value, index) => record(value, `app.carriers[${index}]`));
  const carrierIds = carriers.map((entry) => text(entry.carrier_id, 'app.carriers[].carrier_id')).sort();
  if (JSON.stringify(carrierIds) !== JSON.stringify(['docker_webui', 'macos_standard'])) {
    throw new Error('app.carriers must contain exactly macos_standard and docker_webui.');
  }
  const webuiMatches = carriers.filter((entry) => entry.carrier_id === 'docker_webui');
  if (webuiMatches.length !== 1) throw new Error('app.carriers must contain one unique docker_webui carrier.');
  const webui = webuiMatches[0]!;
  if (webui.carrier_kind !== 'oci_image' || webui.package_profile !== 'webui-full') {
    throw new Error('Framework docker_webui carrier kind or package profile is invalid.');
  }
  const webuiRef = text(webui.ref, 'app.carriers[docker_webui].ref');
  const webuiDigest = digest(webui.digest, 'app.carriers[docker_webui].digest');
  if (webuiRef !== `ghcr.io/gaofeng21cn/one-person-lab-webui@${webuiDigest}`) {
    throw new Error('Framework docker_webui carrier ref must pin its exact digest.');
  }
  positiveInteger(webui.size, 'app.carriers[docker_webui].size');
  const webuiFingerprint = digest(
    webui.content_fingerprint,
    'app.carriers[docker_webui].content_fingerprint',
  );

  if (!carrierReceiptPath) return;
  const receipt = record(JSON.parse(fs.readFileSync(carrierReceiptPath, 'utf8')), 'WebUI carrier receipt');
  if (receipt.schema !== 'opl_app_webui_release_carrier.v1') {
    throw new Error('WebUI carrier receipt schema is invalid.');
  }
  const carrier = record(receipt.carrier, 'WebUI carrier receipt.carrier');
  if (
    carrier.carrier_id !== 'docker_webui'
    || carrier.carrier_kind !== 'oci_image'
    || carrier.package_profile !== 'webui-full'
    || carrier.os !== 'linux'
    || carrier.architecture !== 'multiarch'
  ) {
    throw new Error('WebUI carrier receipt does not identify the qualified docker_webui carrier.');
  }
  if (!Array.isArray(carrier.platforms) || carrier.platforms.length !== 2) {
    throw new Error('WebUI carrier receipt must contain exactly amd64 and arm64 platform descriptors.');
  }
  for (const [index, value] of carrier.platforms.entries()) {
    const platform = record(value, `WebUI carrier receipt.carrier.platforms[${index}]`);
    const architecture = index === 0 ? 'amd64' : 'arm64';
    if (platform.os !== 'linux' || platform.architecture !== architecture) {
      throw new Error(`WebUI carrier platform ${index} must be linux/${architecture}.`);
    }
    const platformDigest = digest(platform.digest, `WebUI carrier platform ${index} digest`);
    if (platform.ref !== `ghcr.io/gaofeng21cn/one-person-lab-webui@${platformDigest}`) {
      throw new Error(`WebUI carrier platform ${index} ref must pin its exact digest.`);
    }
  }
  if (
    carrier.ref !== webuiRef
    || carrier.digest !== webuiDigest
    || carrier.content_fingerprint !== webuiFingerprint
    || positiveInteger(carrier.size_bytes, 'WebUI carrier receipt.carrier.size_bytes') !== webui.size
  ) {
    throw new Error('Framework docker_webui carrier does not match the qualified App carrier receipt.');
  }
  const qualification = record(receipt.qualification, 'WebUI carrier receipt.qualification');
  if (qualification.status !== 'passed' || qualification.image_digest !== webuiDigest) {
    throw new Error('WebUI carrier receipt qualification is not passed for the exact Framework digest.');
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      receipt: { type: 'string' },
      target: { type: 'string' },
      'promotion-request-id': { type: 'string' },
      'release-set-generation': { type: 'string' },
      'release-gate': { type: 'string' },
      'source-app-run-id': { type: 'string' },
      'app-version': { type: 'string' },
      'app-source-commit': { type: 'string' },
      'app-artifact-digest': { type: 'string' },
      'framework-source-commit': { type: 'string' },
      'framework-run-id': { type: 'string' },
      'expected-carrier-digest': { type: 'string', default: '' },
      'candidate-receipt': { type: 'string', default: '' },
      'webui-carrier-receipt': { type: 'string', default: '' },
    },
    strict: true,
  });
  for (const key of [
    'receipt', 'target', 'promotion-request-id', 'release-set-generation', 'release-gate',
    'source-app-run-id', 'app-version', 'app-source-commit', 'app-artifact-digest',
    'framework-source-commit', 'framework-run-id',
  ] as const) {
    if (!values[key]) throw new Error(`Missing --${key}.`);
  }
  const target = values.target!;
  if (target !== 'candidate' && target !== 'latest-stable') throw new Error('--target must be candidate or latest-stable.');
  if (!/^\d{2}\.\d{1,2}\.\d{1,2}(?:-r[1-9][0-9]*)?$/.test(values['release-set-generation']!)) {
    throw new Error('--release-set-generation is invalid.');
  }
  if (!/^\d+$/.test(values['source-app-run-id']!) || !/^\d+$/.test(values['framework-run-id']!)) {
    throw new Error('Run ids must be decimal GitHub Actions ids.');
  }
  if (!shaPattern.test(values['app-source-commit']!)) throw new Error('--app-source-commit must be a full Git SHA.');
  if (!shaPattern.test(values['framework-source-commit']!)) {
    throw new Error('--framework-source-commit must be a full Git SHA.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(values['promotion-request-id']!)) {
    throw new Error('--promotion-request-id is invalid.');
  }
  digest(values['app-artifact-digest'], '--app-artifact-digest');
  if (target === 'latest-stable' && (!values['expected-carrier-digest'] || !values['candidate-receipt'])) {
    throw new Error('latest-stable validation requires --expected-carrier-digest and --candidate-receipt.');
  }

  const receipt = record(JSON.parse(fs.readFileSync(values.receipt!, 'utf8')), 'receipt');
  const expectedStatus = target === 'candidate' ? 'published_immutable_candidate' : 'promoted_latest_stable';
  if (receipt.surface_kind !== 'opl_release_set_promotion_receipt.v1' || receipt.status !== expectedStatus) {
    throw new Error('Framework receipt surface kind or target status is invalid.');
  }
  if (receipt.promotion_target !== target
    || receipt.promotion_request_id !== values['promotion-request-id']
    || receipt.release_set_generation !== values['release-set-generation']
    || receipt.release_gate !== values['release-gate']
    || receipt.source_app_run_id !== values['source-app-run-id']) {
    throw new Error('Framework receipt request, target, generation, gate, or source App run does not match the dispatch.');
  }

  const carrier = record(receipt.carrier, 'carrier');
  const carrierDigest = digest(carrier.digest, 'carrier.digest');
  const carrierRepository = 'ghcr.io/gaofeng21cn/one-person-lab-manifest';
  if (carrier.immutable_ref !== `${carrierRepository}:${values['release-set-generation']}`
    || carrier.channel_ref !== `${carrierRepository}:${target}`) {
    throw new Error('Framework receipt carrier refs do not identify the exact generation and promotion target.');
  }
  if (values['expected-carrier-digest'] && carrierDigest !== values['expected-carrier-digest']) {
    throw new Error('Framework receipt carrier digest does not match the exact candidate digest.');
  }

  const frameworkRun = record(receipt.framework_run, 'framework_run');
  if (frameworkRun.repository !== 'gaofeng21cn/one-person-lab'
    || frameworkRun.run_id !== values['framework-run-id']
    || !/^\d+$/.test(text(frameworkRun.run_attempt, 'framework_run.run_attempt'))
    || Number(frameworkRun.run_attempt) < 1) {
    throw new Error('Framework workflow run identity or readback is invalid.');
  }
  const app = component(
    receipt.app,
    'app',
    'opl-app',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/',
  );
  if (app.version !== values['app-version']
    || app.source_commit !== values['app-source-commit']
    || app.artifact_digest !== values['app-artifact-digest']) {
    throw new Error('Framework receipt App version, source commit, or artifact digest does not match the owner manifest.');
  }
  validateWebuiCarrierBinding(app, values['webui-carrier-receipt']!);

  const { base, expectedReadbackRefs } = validateComponentLocks(receipt);
  if (base.source_commit !== values['framework-source-commit']) {
    throw new Error('components.base.source_commit does not match the frozen Framework cohort SHA.');
  }
  const readback = record(receipt.anonymous_readback, 'anonymous_readback');
  if (readback.status !== 'verified' || !Array.isArray(readback.verified_refs)) {
    throw new Error('anonymous_readback must be verified and list exact channel refs.');
  }
  const actualReadbackRefs = [...readback.verified_refs].map((value, index) => text(value, `anonymous_readback.verified_refs[${index}]`)).sort();
  if (JSON.stringify(actualReadbackRefs) !== JSON.stringify(expectedReadbackRefs)) {
    throw new Error('anonymous_readback.verified_refs does not contain exactly the carrier, Base, and seven Package channel refs.');
  }

  if (values['candidate-receipt']) {
    const candidate = record(JSON.parse(fs.readFileSync(values['candidate-receipt'], 'utf8')), 'candidate receipt');
    const candidateCarrier = record(candidate.carrier, 'candidate receipt carrier');
    if (candidate.surface_kind !== 'opl_release_set_promotion_receipt.v1'
      || candidate.status !== 'published_immutable_candidate'
      || candidate.promotion_target !== 'candidate'
      || candidateCarrier.digest !== carrierDigest
      || candidateCarrier.immutable_ref !== carrier.immutable_ref) {
      throw new Error('Stable receipt does not promote the exact immutable candidate carrier.');
    }
    for (const key of ['promotion_request_id', 'release_gate', 'release_set_generation', 'source_app_run_id', 'app', 'components'] as const) {
      sameJson(candidate[key], receipt[key], key);
    }
  }

  process.stdout.write(`${JSON.stringify({
    status: 'verified',
    target,
    release_set_generation: receipt.release_set_generation,
    carrier_digest: carrierDigest,
    framework_run_id: String(frameworkRun.run_id),
  })}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
