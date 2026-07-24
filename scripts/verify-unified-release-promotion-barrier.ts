#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const digestPattern = /^sha256:[0-9a-f]{64}$/;
const shaPattern = /^[0-9a-f]{40}$/;
const stableVersionPattern = /^[0-9]{2}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12][0-9]|3[01])(?:-r[1-9][0-9]*)?$/;
const requiredCarrierIds = ['docker_webui', 'macos_standard'] as const;
const requiredPackageIds = [
  'mag',
  'mas',
  'mas-scholar-skills',
  'obf',
  'oma',
  'opl-flow',
  'rca',
] as const;
const requiredProjectionIds = [
  'app_consumption',
  'framework_latest_stable',
  'ghcr_latest',
  'ghcr_stable',
  'github_latest',
  'homebrew_standard',
] as const;

type JsonRecord = Record<string, any>;
type Phase = 'admission' | 'final_readback';
type EvidenceClass = 'production_readback' | 'synthetic_fixture';
type VerifyOptions = {
  allowSyntheticFixture?: boolean;
  productionExpectation?: unknown;
};

function record(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() !== value || !value) {
    throw new Error(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function digest(value: unknown, label: string): string {
  const result = text(value, label);
  if (!digestPattern.test(result)) throw new Error(`${label} must be an exact sha256 digest.`);
  return result;
}

function sha(value: unknown, label: string): string {
  const result = text(value, label);
  if (!shaPattern.test(result)) throw new Error(`${label} must be an exact lowercase Git SHA.`);
  return result;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
  return Number(value);
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label} does not match the frozen promotion identity.`);
}

function equalJson(actual: unknown, expected: unknown, label: string): void {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} does not match the frozen promotion identity.`);
  }
}

function exactSet(actual: string[], expected: readonly string[], label: string): void {
  const normalized = [...actual].sort();
  const required = [...expected].sort();
  if (new Set(normalized).size !== normalized.length || JSON.stringify(normalized) !== JSON.stringify(required)) {
    throw new Error(`${label} must contain exactly ${required.join(',')}.`);
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const body = Object.keys(value as JsonRecord)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as JsonRecord)[key])}`)
      .join(',');
    return `{${body}}`;
  }
  return JSON.stringify(value);
}

function sha256Json(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function validatePromotionSourceCutoff(value: unknown, label: string): JsonRecord {
  const cutoff = record(value, label);
  exactSet(
    Object.keys(cutoff),
    [
      'frozen_base_release_set',
      'later_authority_advancement_invalidates_receipt',
      'policy',
    ],
    label,
  );
  equal(cutoff.policy, 'single_read_at_freeze_admission', `${label}.policy`);
  equal(
    cutoff.later_authority_advancement_invalidates_receipt,
    false,
    `${label}.later_authority_advancement_invalidates_receipt`,
  );
  if (cutoff.frozen_base_release_set === null) return cutoff;
  const frozenBase = record(cutoff.frozen_base_release_set, `${label}.frozen_base_release_set`);
  exactSet(
    Object.keys(frozenBase),
    ['digest', 'generation'],
    `${label}.frozen_base_release_set`,
  );
  if (!stableVersionPattern.test(text(frozenBase.generation, `${label}.frozen_base_release_set.generation`))) {
    throw new Error(`${label}.frozen_base_release_set.generation must be a Stable CalVer generation.`);
  }
  digest(frozenBase.digest, `${label}.frozen_base_release_set.digest`);
  return cutoff;
}

function validateIdentity(value: unknown, frozen: JsonRecord, label: string): JsonRecord {
  const identity = record(value, label);
  equal(identity.display_version, frozen.display_version, `${label}.display_version`);
  equal(identity.app_sha, frozen.app_sha, `${label}.app_sha`);
  equal(identity.framework_sha, frozen.framework_sha, `${label}.framework_sha`);
  equal(identity.bundle_digest, frozen.bundle_digest, `${label}.bundle_digest`);
  equal(identity.cohort_ref, frozen.cohort_ref, `${label}.cohort_ref`);
  equal(identity.source_cutoff, frozen.source_cutoff, `${label}.source_cutoff`);
  return identity;
}

function frozenIdentity(frozen: JsonRecord): JsonRecord {
  return Object.fromEntries([
    'display_version',
    'app_sha',
    'framework_sha',
    'bundle_digest',
    'cohort_ref',
    'source_cutoff',
  ].map((key) => [key, frozen[key]]));
}

function validateReceipt(value: unknown, label: string, expectedStatus: 'passed' | 'verified'): JsonRecord {
  const receipt = record(value, label);
  equal(receipt.status, expectedStatus, `${label}.status`);
  digest(receipt.receipt_digest, `${label}.receipt_digest`);
  return receipt;
}

function validateComponent(value: unknown, label: string, expectedId: string): JsonRecord {
  const component = record(value, label);
  equal(component.component_id, expectedId, `${label}.component_id`);
  text(component.version, `${label}.version`);
  sha(component.source_commit, `${label}.source_commit`);
  text(component.artifact_ref, `${label}.artifact_ref`);
  digest(component.artifact_digest, `${label}.artifact_digest`);
  return component;
}

function validatePackageSelectionResults(
  value: unknown,
  candidate: JsonRecord,
): { advanced_count: number; reused_verified_lkg_count: number } {
  const selections = record(value, 'readback.framework_release_set.package_selection_results');
  exactSet(
    Object.keys(selections),
    requiredPackageIds,
    'readback.framework_release_set.package_selection_results',
  );
  let advancedCount = 0;
  let reusedVerifiedLkgCount = 0;
  for (const packageId of requiredPackageIds) {
    const label = `readback.framework_release_set.package_selection_results.${packageId}`;
    const selection = record(selections[packageId], label);
    exactSet(
      Object.keys(selection),
      [
        'result',
        'result_receipt_digest',
        'selected_artifact_digest',
        'selected_artifact_ref',
        'selected_version',
        'source_cutoff',
        'update_status',
        'verified_lkg',
      ],
      label,
    );
    const component = record(
      candidate.components.packages[packageId],
      `candidate.components.packages.${packageId}`,
    );
    equalJson(selection.source_cutoff, candidate.source_cutoff, `${label}.source_cutoff`);
    equal(selection.selected_version, component.version, `${label}.selected_version`);
    equal(selection.selected_artifact_ref, component.artifact_ref, `${label}.selected_artifact_ref`);
    equal(
      digest(selection.selected_artifact_digest, `${label}.selected_artifact_digest`),
      component.artifact_digest,
      `${label}.selected_artifact_digest`,
    );
    digest(selection.result_receipt_digest, `${label}.result_receipt_digest`);
    const result = text(selection.result, `${label}.result`);
    const updateStatus = text(selection.update_status, `${label}.update_status`);
    if (result === 'advanced') {
      equal(updateStatus, 'completed', `${label}.update_status`);
      equal(selection.verified_lkg, null, `${label}.verified_lkg`);
      advancedCount += 1;
      continue;
    }
    if (result !== 'reused_verified_lkg') {
      throw new Error(`${label}.result must be advanced or reused_verified_lkg.`);
    }
    if (updateStatus !== 'failed' && updateStatus !== 'unavailable') {
      throw new Error(`${label}.update_status must be failed or unavailable when reusing verified LKG.`);
    }
    const verifiedLkg = record(selection.verified_lkg, `${label}.verified_lkg`);
    exactSet(
      Object.keys(verifiedLkg),
      ['artifact_digest', 'artifact_ref', 'receipt_digest', 'status'],
      `${label}.verified_lkg`,
    );
    equal(verifiedLkg.status, 'verified', `${label}.verified_lkg.status`);
    equal(verifiedLkg.artifact_ref, component.artifact_ref, `${label}.verified_lkg.artifact_ref`);
    equal(
      digest(verifiedLkg.artifact_digest, `${label}.verified_lkg.artifact_digest`),
      component.artifact_digest,
      `${label}.verified_lkg.artifact_digest`,
    );
    digest(verifiedLkg.receipt_digest, `${label}.verified_lkg.receipt_digest`);
    reusedVerifiedLkgCount += 1;
  }
  return {
    advanced_count: advancedCount,
    reused_verified_lkg_count: reusedVerifiedLkgCount,
  };
}

function validateCarrier(value: unknown, frozen: JsonRecord): JsonRecord {
  const carrier = record(value, 'carrier');
  const carrierId = text(carrier.carrier_id, 'carrier.carrier_id');
  if (!requiredCarrierIds.includes(carrierId as (typeof requiredCarrierIds)[number])) {
    throw new Error(`Unexpected carrier id ${carrierId}.`);
  }
  const expected = carrierId === 'docker_webui'
    ? { kind: 'oci_image', profile: 'webui-full' }
    : { kind: 'release_asset', profile: 'standard' };
  equal(carrier.carrier_kind, expected.kind, `${carrierId}.carrier_kind`);
  equal(carrier.package_profile, expected.profile, `${carrierId}.package_profile`);
  const immutableRef = text(carrier.immutable_ref, `${carrierId}.immutable_ref`);
  const artifactDigest = digest(carrier.artifact_digest, `${carrierId}.artifact_digest`);
  digest(carrier.manifest_digest, `${carrierId}.manifest_digest`);
  positiveInteger(carrier.size_bytes, `${carrierId}.size_bytes`);
  if (carrier.content_fingerprint !== undefined) {
    digest(carrier.content_fingerprint, `${carrierId}.content_fingerprint`);
  }
  if (carrierId === 'macos_standard' && carrier.content_fingerprint !== undefined) {
    throw new Error('macos_standard.content_fingerprint is not part of the release_asset carrier interface.');
  }
  if (carrierId === 'docker_webui') {
    if (!immutableRef.startsWith('ghcr.io/gaofeng21cn/one-person-lab-webui@sha256:')
      || !immutableRef.endsWith(artifactDigest.slice('sha256:'.length))) {
      throw new Error('docker_webui immutable_ref must pin its exact OCI artifact_digest.');
    }
  } else if (!immutableRef.startsWith(
    `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${frozen.display_version}/`,
  ) || immutableRef.includes('/releases/latest')) {
    throw new Error('macos_standard immutable_ref must pin the exact versioned GitHub Release asset.');
  }
  if (!Array.isArray(carrier.moving_pointer_refs) || carrier.moving_pointer_refs.length === 0) {
    throw new Error(`${carrierId}.moving_pointer_refs must list its separate moving projections.`);
  }
  for (const [index, pointer] of carrier.moving_pointer_refs.entries()) {
    const pointerRef = text(pointer, `${carrierId}.moving_pointer_refs[${index}]`);
    if (pointerRef === immutableRef || pointerRef.includes('@sha256:')) {
      throw new Error(`${carrierId} immutable upload and moving pointer refs must remain separate.`);
    }
  }
  exactSet(
    carrier.moving_pointer_refs,
    carrierId === 'docker_webui'
      ? [
          'ghcr.io/gaofeng21cn/one-person-lab-webui:latest',
          'ghcr.io/gaofeng21cn/one-person-lab-webui:stable',
        ]
      : [
          'https://github.com/gaofeng21cn/one-person-lab-app/releases/latest',
          'https://raw.githubusercontent.com/gaofeng21cn/homebrew-one-person-lab/main/Casks/one-person-lab.rb',
        ],
    `${carrierId}.moving_pointer_refs`,
  );
  validateIdentity(carrier.identity, frozen, `${carrierId}.identity`);
  const build = validateReceipt(carrier.build, `${carrierId}.build`, 'passed');
  const qualification = validateReceipt(carrier.qualification, `${carrierId}.qualification`, 'passed');
  validateReceipt(carrier.immutable_upload, `${carrierId}.immutable_upload`, 'verified');
  const attestation = validateReceipt(carrier.attestation, `${carrierId}.attestation`, 'verified');
  equal(attestation.subject_digest, artifactDigest, `${carrierId}.attestation.subject_digest`);
  return { ...carrier, build, qualification, artifact_digest: artifactDigest };
}

function validateBarrier(value: unknown, carriers: Map<string, JsonRecord>): void {
  const barrier = record(value, 'barrier');
  for (const stage of ['stable_built', 'stable_qualified'] as const) {
    const entry = record(barrier[stage], `barrier.${stage}`);
    equal(entry.status, 'passed', `barrier.${stage}.status`);
    const receipts = record(entry.carrier_receipts, `barrier.${stage}.carrier_receipts`);
    exactSet(Object.keys(receipts), requiredCarrierIds, `barrier.${stage}.carrier_receipts`);
    for (const carrierId of requiredCarrierIds) {
      const source = stage === 'stable_built' ? carriers.get(carrierId)?.build : carriers.get(carrierId)?.qualification;
      equal(receipts[carrierId], source?.receipt_digest, `barrier.${stage}.${carrierId}`);
    }
  }
}

function validateCandidate(value: unknown, frozen: JsonRecord, carriers: Map<string, JsonRecord>): JsonRecord {
  const candidate = record(value, 'candidate');
  if (candidate.force_publish === true) {
    throw new Error('candidate.force_publish is forbidden; promotion requires complete verified identity.');
  }
  digest(candidate.receipt_digest, 'candidate.receipt_digest');
  equal(candidate.matching_attested_receipt_count, 1, 'candidate.matching_attested_receipt_count');
  validatePromotionSourceCutoff(candidate.source_cutoff, 'candidate.source_cutoff');
  validateIdentity(candidate.identity, frozen, 'candidate.identity');
  const attestation = validateReceipt(candidate.attestation, 'candidate.attestation', 'verified');
  equal(attestation.subject_digest, candidate.receipt_digest, 'candidate.attestation.subject_digest');

  const sourceRun = record(candidate.source_run, 'candidate.source_run');
  equal(sourceRun.repository, 'gaofeng21cn/one-person-lab-app', 'candidate.source_run.repository');
  if (!/^\d+$/.test(text(sourceRun.run_id, 'candidate.source_run.run_id'))) {
    throw new Error('candidate.source_run.run_id must be a decimal GitHub Actions run id.');
  }
  equal(sha(sourceRun.head_sha, 'candidate.source_run.head_sha'), frozen.app_sha, 'candidate.source_run.head_sha');

  const predecessor = record(candidate.predecessor, 'candidate.predecessor');
  const target = record(candidate.target, 'candidate.target');
  text(predecessor.immutable_ref, 'candidate.predecessor.immutable_ref');
  text(target.immutable_ref, 'candidate.target.immutable_ref');
  const predecessorDigest = digest(predecessor.digest, 'candidate.predecessor.digest');
  const targetDigest = digest(target.digest, 'candidate.target.digest');
  digest(predecessor.identity_digest, 'candidate.predecessor.identity_digest');
  equal(
    digest(target.identity_digest, 'candidate.target.identity_digest'),
    sha256Json(candidate.identity),
    'candidate.target.identity_digest',
  );
  const predecessorChannel = text(predecessor.channel_ref, 'candidate.predecessor.channel_ref');
  const targetChannel = text(target.channel_ref, 'candidate.target.channel_ref');
  equal(targetChannel, predecessorChannel, 'candidate target/predecessor channel_ref');
  equal(
    targetChannel,
    'ghcr.io/gaofeng21cn/one-person-lab-manifest:latest-stable',
    'candidate.target.channel_ref',
  );
  equal(
    target.immutable_ref,
    `ghcr.io/gaofeng21cn/one-person-lab-manifest:${frozen.display_version}`,
    'candidate.target.immutable_ref',
  );
  if (predecessorDigest === targetDigest || predecessor.immutable_ref === target.immutable_ref) {
    throw new Error('candidate target must be an immutable successor to its frozen predecessor.');
  }

  const components = record(candidate.components, 'candidate.components');
  exactSet(
    Object.keys(components),
    ['base', 'bom_digest', 'package_catalog_digest', 'packages'],
    'candidate.components',
  );
  const base = validateComponent(components.base, 'candidate.components.base', 'opl-base');
  equal(base.source_commit, frozen.framework_sha, 'candidate.components.base.source_commit');
  const packages = record(components.packages, 'candidate.components.packages');
  exactSet(Object.keys(packages), requiredPackageIds, 'candidate.components.packages');
  for (const packageId of requiredPackageIds) {
    validateComponent(packages[packageId], `candidate.components.packages.${packageId}`, packageId);
  }
  digest(components.package_catalog_digest, 'candidate.components.package_catalog_digest');
  digest(components.bom_digest, 'candidate.components.bom_digest');

  if (!Array.isArray(candidate.carrier_bindings)) {
    throw new Error('candidate.carrier_bindings must be an array.');
  }
  exactSet(
    candidate.carrier_bindings.map((entry: unknown) => text(record(entry, 'carrier binding').carrier_id, 'carrier binding id')),
    requiredCarrierIds,
    'candidate.carrier_bindings',
  );
  for (const bindingValue of candidate.carrier_bindings) {
    const binding = record(bindingValue, 'candidate carrier binding');
    const carrier = carriers.get(binding.carrier_id);
    equal(binding.immutable_ref, carrier?.immutable_ref, `${binding.carrier_id} candidate immutable_ref`);
    equal(binding.artifact_digest, carrier?.artifact_digest, `${binding.carrier_id} candidate artifact_digest`);
    equal(binding.manifest_digest, carrier?.manifest_digest, `${binding.carrier_id} candidate manifest_digest`);
    equal(binding.size_bytes, carrier?.size_bytes, `${binding.carrier_id} candidate size_bytes`);
    if (carrier?.content_fingerprint !== undefined) {
      equal(
        binding.content_fingerprint,
        carrier.content_fingerprint,
        `${binding.carrier_id} candidate content_fingerprint`,
      );
    } else {
      equal(binding.content_fingerprint, undefined, `${binding.carrier_id} candidate content_fingerprint`);
    }
  }
  return candidate;
}

function expectedProjection(
  projectionId: string,
  phase: Phase,
  candidate: JsonRecord,
  carriers: Map<string, JsonRecord>,
  frameworkReleaseSet: JsonRecord,
): {
  ref: string;
  digest: string;
} {
  const docker = carriers.get('docker_webui')!;
  const desktop = carriers.get('macos_standard')!;
  switch (projectionId) {
    case 'framework_latest_stable':
      return { ref: candidate.target.channel_ref, digest: candidate.target.digest };
    case 'app_consumption':
      return {
        ref: candidate.target.channel_ref,
        digest: phase === 'final_readback'
          ? digest(
            frameworkReleaseSet.channel_manifest_layer_digest,
            'readback.framework_release_set.channel_manifest_layer_digest',
          )
          : candidate.target.digest,
      };
    case 'ghcr_stable':
      return { ref: 'ghcr.io/gaofeng21cn/one-person-lab-webui:stable', digest: docker.artifact_digest };
    case 'ghcr_latest':
      return { ref: 'ghcr.io/gaofeng21cn/one-person-lab-webui:latest', digest: docker.artifact_digest };
    case 'github_latest':
      return { ref: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/latest', digest: desktop.artifact_digest };
    case 'homebrew_standard':
      return {
        ref: 'https://raw.githubusercontent.com/gaofeng21cn/homebrew-one-person-lab/main/Casks/one-person-lab.rb',
        digest: desktop.artifact_digest,
      };
    default:
      throw new Error(`Unexpected projection ${projectionId}.`);
  }
}

function validateReadback(
  value: unknown,
  phase: Phase,
  evidenceClass: EvidenceClass,
  frozen: JsonRecord,
  candidate: JsonRecord,
  carriers: Map<string, JsonRecord>,
): {
  attempt: number;
  frameworkReleaseSet: JsonRecord;
  packageSelectionSummary: JsonRecord | null;
  projectionReceipts: JsonRecord;
} {
  const readback = record(value, 'readback');
  const reconcile = record(readback.reconcile, 'readback.reconcile');
  const frameworkReleaseSet = record(readback.framework_release_set, 'readback.framework_release_set');
  let packageSelectionSummary: JsonRecord | null = null;
  equal(reconcile.max_attempts, 3, 'readback.reconcile.max_attempts');
  if (!Number.isSafeInteger(reconcile.attempt) || reconcile.attempt < 0 || reconcile.attempt > 3) {
    throw new Error('readback.reconcile.attempt must remain within the bounded 0..3 read-only window.');
  }
  for (const forbidden of ['redispatch_attempted', 'reupload_attempted', 'pointer_mutation_retried'] as const) {
    equal(reconcile[forbidden], false, `readback.reconcile.${forbidden}`);
  }
  if (!Array.isArray(readback.projections)) throw new Error('readback.projections must be an array.');
  exactSet(
    readback.projections.map((value: unknown) => text(record(value, 'projection').projection_id, 'projection id')),
    requiredProjectionIds,
    'readback.projections',
  );
  const projectionReceipts: JsonRecord = {};
  for (const projectionValue of readback.projections) {
    const projection = record(projectionValue, 'projection');
    const projectionId = text(projection.projection_id, 'projection.projection_id');
    const expected = expectedProjection(projectionId, phase, candidate, carriers, frameworkReleaseSet);
    equal(projection.expected_ref, expected.ref, `${projectionId}.expected_ref`);
    equal(projection.expected_digest, expected.digest, `${projectionId}.expected_digest`);
    const observation = record(projection.observation, `${projectionId}.observation`);
    if (phase === 'admission') {
      equal(observation.status, 'not_observed', `${projectionId}.observation.status`);
      continue;
    }
    if (observation.status !== 'verified') {
      throw new Error(`${projectionId} final observation must be verified; ${String(observation.status)} fails closed.`);
    }
    equal(observation.ref, expected.ref, `${projectionId}.observation.ref`);
    equal(observation.digest, expected.digest, `${projectionId}.observation.digest`);
    equal(observation.source_cutoff, frozen.source_cutoff, `${projectionId}.observation.source_cutoff`);
    equal(observation.evidence_class, evidenceClass, `${projectionId}.observation.evidence_class`);
    equal(
      observation.readback_kind,
      evidenceClass === 'synthetic_fixture'
        ? 'synthetic_fixture'
        : projectionId === 'app_consumption'
          ? 'live_app_consumption'
          : 'live_remote_readback',
      `${projectionId}.observation.readback_kind`,
    );
    if (projectionId === 'app_consumption') {
      equal(observation.live, true, 'app_consumption.observation.live');
      equal(observation.profile, 'full', 'app_consumption.observation.profile');
      equal(observation.app_state_status, 'live', 'app_consumption.observation.app_state_status');
      equal(observation.live_verified, true, 'app_consumption.observation.live_verified');
      if ('catalog_digest' in observation) {
        throw new Error('app_consumption.observation must not expose the legacy ambiguous catalog_digest.');
      }
      const frameworkAppConsumption = record(
        frameworkReleaseSet.app_consumption,
        'readback.framework_release_set.app_consumption',
      );
      for (const field of [
        'release_set_descriptor_digest',
        'channel_manifest_layer_digest',
        'package_catalog_digest',
      ] as const) {
        equal(
          digest(observation[field], `app_consumption.observation.${field}`),
          digest(
            frameworkAppConsumption[field],
            `readback.framework_release_set.app_consumption.${field}`,
          ),
          `app_consumption.observation.${field}`,
        );
      }
      equal(
        observation.channel_manifest_layer_digest,
        expected.digest,
        'app_consumption.observation.channel_manifest_layer_digest',
      );
      const packageSourceDigests = record(
        observation.package_source_digests,
        'app_consumption.observation.package_source_digests',
      );
      const packageVersions = record(
        observation.package_versions,
        'app_consumption.observation.package_versions',
      );
      const packageArtifactDigests = record(
        observation.package_artifact_digests,
        'app_consumption.observation.package_artifact_digests',
      );
      exactSet(
        Object.keys(packageSourceDigests),
        requiredPackageIds,
        'app_consumption.observation.package_source_digests',
      );
      exactSet(
        Object.keys(packageVersions),
        requiredPackageIds,
        'app_consumption.observation.package_versions',
      );
      exactSet(
        Object.keys(packageArtifactDigests),
        requiredPackageIds,
        'app_consumption.observation.package_artifact_digests',
      );
      for (const packageId of requiredPackageIds) {
        const component = record(
          candidate.components.packages[packageId],
          `candidate.components.packages.${packageId}`,
        );
        equal(
          packageSourceDigests[packageId],
          expected.digest,
          `app_consumption.observation.package_source_digests.${packageId}`,
        );
        equal(
          packageVersions[packageId],
          component.version,
          `app_consumption.observation.package_versions.${packageId}`,
        );
        equal(
          digest(
            packageArtifactDigests[packageId],
            `app_consumption.observation.package_artifact_digests.${packageId}`,
          ),
          component.artifact_digest,
          `app_consumption.observation.package_artifact_digests.${packageId}`,
        );
      }
    }
    validateIdentity(observation.identity, frozen, `${projectionId}.observation.identity`);
    projectionReceipts[projectionId] = digest(
      observation.receipt_digest,
      `${projectionId}.observation.receipt_digest`,
    );
  }

  if (phase === 'admission') {
    equal(frameworkReleaseSet.status, 'not_observed', 'readback.framework_release_set.status');
  } else {
    equal(frameworkReleaseSet.status, 'verified', 'readback.framework_release_set.status');
    equal(
      frameworkReleaseSet.surface_kind,
      'opl_package_latest_stable_verification_capsule.v2',
      'readback.framework_release_set.surface_kind',
    );
    equal(
      frameworkReleaseSet.verification_contract,
      'opl_framework_latest_stable_exact9_slsa_spdx_app_live.v1',
      'readback.framework_release_set.verification_contract',
    );
    equal(
      frameworkReleaseSet.evidence_class,
      evidenceClass,
      'readback.framework_release_set.evidence_class',
    );
    equalJson(
      frameworkReleaseSet.source_cutoff,
      candidate.source_cutoff,
      'readback.framework_release_set.source_cutoff',
    );
    for (const field of [
      'verifier_receipt_digest',
      'package_candidate_receipt_digest',
      'package_promotion_receipt_digest',
      'component_set_digest',
      'release_set_descriptor_digest',
      'channel_manifest_layer_digest',
      'package_catalog_digest',
      'bom_digest',
      'app_live_readback_receipt_digest',
    ] as const) {
      digest(frameworkReleaseSet[field], `readback.framework_release_set.${field}`);
    }
    equal(frameworkReleaseSet.subject_count, 9, 'readback.framework_release_set.subject_count');
    equal(frameworkReleaseSet.slsa_attested_subject_count, 9, 'readback.framework_release_set.slsa_attested_subject_count');
    equal(frameworkReleaseSet.spdx_attested_subject_count, 9, 'readback.framework_release_set.spdx_attested_subject_count');
    equal(frameworkReleaseSet.latest_stable_verified_subject_count, 9, 'readback.framework_release_set.latest_stable_verified_subject_count');
    equal(
      frameworkReleaseSet.component_set_digest,
      sha256Json(candidate.components),
      'readback.framework_release_set.component_set_digest',
    );
    equal(
      frameworkReleaseSet.release_set_descriptor_digest,
      candidate.target.digest,
      'readback.framework_release_set.release_set_descriptor_digest',
    );
    if (
      frameworkReleaseSet.channel_manifest_layer_digest ===
        frameworkReleaseSet.release_set_descriptor_digest ||
      frameworkReleaseSet.channel_manifest_layer_digest ===
        frameworkReleaseSet.package_catalog_digest ||
      frameworkReleaseSet.release_set_descriptor_digest ===
        frameworkReleaseSet.package_catalog_digest
    ) {
      throw new Error('Framework Release Set descriptor, channel manifest layer, and embedded Package catalog digest domains must remain distinct.');
    }
    equal(
      frameworkReleaseSet.package_catalog_digest,
      candidate.components.package_catalog_digest,
      'readback.framework_release_set.package_catalog_digest',
    );
    packageSelectionSummary = validatePackageSelectionResults(
      frameworkReleaseSet.package_selection_results,
      candidate,
    );
    const frameworkAppConsumption = record(
      frameworkReleaseSet.app_consumption,
      'readback.framework_release_set.app_consumption',
    );
    if ('catalog_digest' in frameworkAppConsumption) {
      throw new Error('Framework v2 app_consumption must not expose the legacy ambiguous catalog_digest.');
    }
    equal(
      frameworkAppConsumption.live_verified,
      true,
      'readback.framework_release_set.app_consumption.live_verified',
    );
    equal(
      frameworkAppConsumption.catalog_ref,
      candidate.target.channel_ref,
      'readback.framework_release_set.app_consumption.catalog_ref',
    );
    for (const field of [
      'release_set_descriptor_digest',
      'channel_manifest_layer_digest',
      'package_catalog_digest',
    ] as const) {
      equal(
        digest(
          frameworkAppConsumption[field],
          `readback.framework_release_set.app_consumption.${field}`,
        ),
        frameworkReleaseSet[field],
        `readback.framework_release_set.app_consumption.${field}`,
      );
    }
    equal(
      frameworkReleaseSet.bom_digest,
      candidate.components.bom_digest,
      'readback.framework_release_set.bom_digest',
    );
    equal(
      frameworkReleaseSet.verifier_receipt_digest,
      projectionReceipts.framework_latest_stable,
      'readback.framework_release_set.verifier_receipt_digest',
    );
    equal(
      frameworkReleaseSet.app_live_readback_receipt_digest,
      projectionReceipts.app_consumption,
      'readback.framework_release_set.app_live_readback_receipt_digest',
    );
  }
  return {
    attempt: reconcile.attempt,
    frameworkReleaseSet,
    packageSelectionSummary,
    projectionReceipts,
  };
}

function validatePromotionAdmission(
  value: unknown,
  frozen: JsonRecord,
  candidate: JsonRecord,
): JsonRecord {
  const admission = record(value, 'publication_order.promotion_admission');
  equal(admission.status, 'verified', 'publication_order.promotion_admission.status');
  const receiptDigest = digest(
    admission.receipt_digest,
    'publication_order.promotion_admission.receipt_digest',
  );
  equal(
    admission.matching_attested_receipt_count,
    1,
    'publication_order.promotion_admission.matching_attested_receipt_count',
  );
  equal(admission.source_cutoff, frozen.source_cutoff, 'publication_order.promotion_admission.source_cutoff');
  validateIdentity(admission.identity, frozen, 'publication_order.promotion_admission.identity');
  equal(
    admission.candidate_receipt_digest,
    candidate.receipt_digest,
    'publication_order.promotion_admission.candidate_receipt_digest',
  );
  equal(
    admission.source_run?.repository,
    candidate.source_run.repository,
    'publication_order.promotion_admission.source_run.repository',
  );
  equal(
    admission.source_run?.run_id,
    candidate.source_run.run_id,
    'publication_order.promotion_admission.source_run.run_id',
  );
  equal(
    admission.source_run?.head_sha,
    candidate.source_run.head_sha,
    'publication_order.promotion_admission.source_run.head_sha',
  );
  equal(
    admission.predecessor_digest,
    candidate.predecessor.digest,
    'publication_order.promotion_admission.predecessor_digest',
  );
  equal(
    admission.target_digest,
    candidate.target.digest,
    'publication_order.promotion_admission.target_digest',
  );
  const attestation = validateReceipt(
    admission.attestation,
    'publication_order.promotion_admission.attestation',
    'verified',
  );
  equal(
    attestation.subject_digest,
    receiptDigest,
    'publication_order.promotion_admission.attestation.subject_digest',
  );
  return admission;
}

function carrierExpectation(carriers: Map<string, JsonRecord>): JsonRecord {
  return Object.fromEntries(requiredCarrierIds.map((carrierId) => {
    const carrier = carriers.get(carrierId)!;
    return [carrierId, {
      ...Object.fromEntries([
        'carrier_kind',
        'package_profile',
        'immutable_ref',
        'artifact_digest',
        'manifest_digest',
        'size_bytes',
        ...(carrier.content_fingerprint === undefined ? [] : ['content_fingerprint']),
      ].map((key) => [key, carrier[key]])),
      identity: carrier.identity,
      moving_pointer_refs: carrier.moving_pointer_refs,
      build: carrier.build,
      qualification: carrier.qualification,
      immutable_upload: carrier.immutable_upload,
      attestation: carrier.attestation,
    }];
  }));
}

function validateProductionExpectation(value: unknown, expected: JsonRecord): string {
  const expectation = record(value, 'production_expectation');
  equal(expectation.schema, 'opl_app_unified_release_promotion_expectation.v1', 'production_expectation.schema');
  equal(expectation.evidence_class, 'production_expectation', 'production_expectation.evidence_class');
  if (canonicalJson(expectation) !== canonicalJson(expected)) {
    throw new Error('production_expectation does not exactly match the verified production capsule.');
  }
  return sha256Json(expectation);
}

function validateFreeze(value: unknown): JsonRecord {
  const freeze = record(value, 'identity');
  if (!stableVersionPattern.test(text(freeze.display_version, 'identity.display_version'))) {
    throw new Error('identity.display_version must be a Stable display version.');
  }
  sha(freeze.app_sha, 'identity.app_sha');
  sha(freeze.framework_sha, 'identity.framework_sha');
  digest(freeze.bundle_digest, 'identity.bundle_digest');
  digest(freeze.cohort_ref, 'identity.cohort_ref');
  if (Number.isNaN(Date.parse(text(freeze.source_cutoff, 'identity.source_cutoff')))) {
    throw new Error('identity.source_cutoff must be an RFC 3339 timestamp.');
  }
  equal(freeze.source_cutoff_read_count, 1, 'identity.source_cutoff_read_count');
  equal(freeze.post_freeze_remote_refresh_allowed, false, 'identity.post_freeze_remote_refresh_allowed');
  const invalidation = text(freeze.invalidation_reason, 'identity.invalidation_reason');
  if (!['none', 'frozen_byte_or_digest_drift', 'artifact_build_or_integrity_failure', 'exact_ref_or_digest_security_revocation'].includes(invalidation)) {
    throw new Error('identity.invalidation_reason is not an authorized cohort invalidation cause.');
  }
  if (invalidation !== 'none') throw new Error(`Frozen cohort is invalidated by ${invalidation}.`);
  return freeze;
}

export function verifyUnifiedReleasePromotionBarrier(
  inputValue: unknown,
  options: VerifyOptions = {},
): JsonRecord {
  const input = record(inputValue, 'input');
  equal(input.schema, 'opl_app_unified_release_promotion_barrier_input.v1', 'input.schema');
  const evidenceClass = text(input.evidence_class, 'input.evidence_class') as EvidenceClass;
  if (evidenceClass !== 'production_readback' && evidenceClass !== 'synthetic_fixture') {
    throw new Error('input.evidence_class must be production_readback or synthetic_fixture.');
  }
  if (evidenceClass === 'synthetic_fixture' && options.allowSyntheticFixture !== true) {
    throw new Error('synthetic_fixture evidence cannot claim a production promotion verdict.');
  }
  const phase = text(input.phase, 'input.phase') as Phase;
  if (phase !== 'admission' && phase !== 'final_readback') throw new Error('input.phase must be admission or final_readback.');
  const frozen = validateFreeze(input.identity);

  if (!Array.isArray(input.carriers)) throw new Error('carriers must be an array.');
  const carriers = new Map<string, JsonRecord>();
  for (const carrierValue of input.carriers) {
    const carrier = validateCarrier(carrierValue, frozen);
    if (carriers.has(carrier.carrier_id)) throw new Error(`Duplicate carrier ${carrier.carrier_id}.`);
    carriers.set(carrier.carrier_id, carrier);
  }
  exactSet([...carriers.keys()], requiredCarrierIds, 'carriers');
  validateBarrier(input.barrier, carriers);
  const candidate = validateCandidate(input.candidate, frozen, carriers);

  const publication = record(input.publication_order, 'publication_order');
  equal(publication.source_cutoff, frozen.source_cutoff, 'publication_order.source_cutoff');
  const promotionAdmission = validatePromotionAdmission(
    publication.promotion_admission,
    frozen,
    candidate,
  );
  equal(publication.immutable_uploads_complete, true, 'publication_order.immutable_uploads_complete');
  equal(
    publication.immutable_uploads_verified_before_pointer_mutation,
    true,
    'publication_order.immutable_uploads_verified_before_pointer_mutation',
  );
  equal(
    publication.moving_pointer_mutation_started,
    phase === 'final_readback',
    'publication_order.moving_pointer_mutation_started',
  );
  if (phase === 'admission') {
    equal(publication.moving_pointer_receipt_digest, null, 'publication_order.moving_pointer_receipt_digest');
  } else {
    digest(publication.moving_pointer_receipt_digest, 'publication_order.moving_pointer_receipt_digest');
  }

  const current = record(input.cas_prestate, 'cas_prestate');
  equal(current.status, 'verified', 'cas_prestate.status');
  equal(current.channel_ref, candidate.predecessor.channel_ref, 'cas_prestate.channel_ref');
  const currentDigest = digest(current.digest, 'cas_prestate.digest');
  const casMode = currentDigest === candidate.predecessor.digest
    ? 'predecessor_to_target'
    : currentDigest === candidate.target.digest
      ? 'target_idempotent'
      : null;
  if (!casMode) throw new Error('cas_prestate must be the frozen predecessor or exact target; a third digest fails closed.');
  equal(
    digest(current.identity_digest, 'cas_prestate.identity_digest'),
    casMode === 'predecessor_to_target'
      ? candidate.predecessor.identity_digest
      : candidate.target.identity_digest,
    'cas_prestate.identity_digest',
  );

  const full = record(input.full_track, 'full_track');
  if (!['absent', 'appended'].includes(full.status)) throw new Error('full_track.status must be absent or appended.');
  for (const invariant of ['standard_identity_unchanged', 'updater_metadata_unchanged', 'latest_selection_unchanged'] as const) {
    equal(full[invariant], true, `full_track.${invariant}`);
  }

  const readback = validateReadback(input.readback, phase, evidenceClass, frozen, candidate, carriers);
  let productionExpectationDigest: string | null = null;
  if (evidenceClass === 'production_readback') {
    if (options.productionExpectation === undefined) {
      throw new Error('production_readback requires a separately supplied exact production_expectation.');
    }
    productionExpectationDigest = validateProductionExpectation(options.productionExpectation, {
      schema: 'opl_app_unified_release_promotion_expectation.v1',
      evidence_class: 'production_expectation',
      phase,
      identity: frozenIdentity(frozen),
      carriers: carrierExpectation(carriers),
      candidate: {
        receipt_digest: candidate.receipt_digest,
        matching_attested_receipt_count: candidate.matching_attested_receipt_count,
        source_cutoff: candidate.source_cutoff,
        identity: candidate.identity,
        attestation: candidate.attestation,
        source_run: candidate.source_run,
        predecessor: candidate.predecessor,
        target: candidate.target,
        components: candidate.components,
      },
      promotion: {
        admission: promotionAdmission,
        moving_pointer_receipt_digest: publication.moving_pointer_receipt_digest,
      },
      framework_release_set: readback.frameworkReleaseSet,
      projection_receipts: readback.projectionReceipts,
    });
  } else if (options.productionExpectation !== undefined) {
    throw new Error('synthetic_fixture must not consume a production_expectation.');
  }
  return {
    schema: 'opl_app_unified_release_promotion_barrier_result.v1',
    status: phase === 'admission' ? 'promotion_admitted' : 'final_readback_verified',
    evidence_class: evidenceClass,
    phase,
    display_version: frozen.display_version,
    app_sha: frozen.app_sha,
    framework_sha: frozen.framework_sha,
    bundle_digest: frozen.bundle_digest,
    cohort_ref: frozen.cohort_ref,
    candidate_receipt_digest: candidate.receipt_digest,
    promotion_admission_receipt_digest: promotionAdmission.receipt_digest,
    release_set_target_digest: candidate.target.digest,
    carrier_digests: Object.fromEntries(requiredCarrierIds.map((id) => [id, carriers.get(id)!.artifact_digest])),
    cas_mode: casMode,
    exact_projection_count: requiredProjectionIds.length,
    bounded_reconcile: {
      attempt: readback.attempt,
      max_attempts: 3,
      mutation_retry_allowed: false,
    },
    package_selection_summary: readback.packageSelectionSummary,
    production_expectation_digest: productionExpectationDigest,
    input_digest: sha256Json(input),
  };
}

function main(): void {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      'production-expectation': { type: 'string' },
      'allow-synthetic-fixture': { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (!values.input) {
    throw new Error(
      'Usage: verify-unified-release-promotion-barrier.ts --input <capsule.json> '
      + '[--production-expectation <expectation.json>] [--allow-synthetic-fixture]',
    );
  }
  const result = verifyUnifiedReleasePromotionBarrier(
    JSON.parse(fs.readFileSync(values.input, 'utf8')),
    {
      allowSyntheticFixture: values['allow-synthetic-fixture'],
      productionExpectation: values['production-expectation']
        ? JSON.parse(fs.readFileSync(values['production-expectation'], 'utf8'))
        : undefined,
    },
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      schema: 'opl_app_unified_release_promotion_barrier_result.v1',
      status: 'blocked',
      error: error instanceof Error ? error.message : String(error),
    })}\n`);
    process.exitCode = 1;
  }
}
