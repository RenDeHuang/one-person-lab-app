import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { verifyUnifiedReleasePromotionBarrier } from '../../scripts/verify-unified-release-promotion-barrier.ts';

const workflowRoot = path.join(process.cwd(), '.github', 'workflows');

test('VM finalizer skips absent source artifacts and always has typed receipt paths', () => {
  const workflow = fs.readFileSync(path.join(workflowRoot, 'opl-first-run-vm.yml'), 'utf8');
  const downloadMarker = '      - name: Download exact source artifact manifest without making it a receipt prerequisite';
  const receiptMarker = '      - name: Write durable typed attempt receipt';
  const downloadStart = workflow.indexOf(downloadMarker);
  const receiptStart = workflow.indexOf(receiptMarker);
  assert.ok(downloadStart >= 0 && receiptStart > downloadStart);
  const download = workflow.slice(downloadStart, workflow.indexOf('\n      - name:', downloadStart + downloadMarker.length));
  const receipt = workflow.slice(receiptStart, workflow.indexOf('\n      - name:', receiptStart + receiptMarker.length));

  assert.match(download, /if: \$\{\{ inputs\.release_artifact_name != '' && inputs\.release_artifact_run_id != '' \}\}/);
  assert.match(download, /run-id: \$\{\{ inputs\.release_artifact_run_id \}\}/);
  assert.match(receipt, /mkdir -p recovered-artifact-manifest recovered-vm-evidence/);
  assert.equal((receipt.match(/-print -quit 2>\/dev\/null \|\| true/g) || []).length, 4);
  assert.match(receipt, /-name vm-gate-failure-summary\.json/);
  assert.match(receipt, /--critical-diagnostics "\$critical_diagnostics"/);
});

const promotionFixturePath = path.join(
  process.cwd(),
  'tests',
  'release',
  'fixtures',
  'unified-release-promotion-barrier',
  'final-readback.json',
);

function promotionFixture(): any {
  return JSON.parse(fs.readFileSync(promotionFixturePath, 'utf8'));
}

function admissionFixture(): any {
  const input = promotionFixture();
  input.phase = 'admission';
  input.publication_order.moving_pointer_mutation_started = false;
  input.publication_order.moving_pointer_receipt_digest = null;
  input.cas_prestate.digest = input.candidate.predecessor.digest;
  input.cas_prestate.identity_digest = input.candidate.predecessor.identity_digest;
  for (const projection of input.readback.projections) {
    if (projection.projection_id === 'app_consumption') {
      projection.expected_digest = input.candidate.target.digest;
    }
    projection.observation = { status: 'not_observed' };
  }
  input.readback.framework_release_set = { status: 'not_observed' };
  input.readback.reconcile.attempt = 0;
  return input;
}

function verifyFixture(input: any): any {
  return verifyUnifiedReleasePromotionBarrier(input, { allowSyntheticFixture: true });
}

function productionInput(input: any = promotionFixture()): any {
  input.evidence_class = 'production_readback';
  input.readback.framework_release_set.evidence_class = 'production_readback';
  for (const projection of input.readback.projections) {
    if (projection.observation.status !== 'verified') continue;
    projection.observation.evidence_class = 'production_readback';
    projection.observation.readback_kind = projection.projection_id === 'app_consumption'
      ? 'live_app_consumption'
      : 'live_remote_readback';
    if (projection.projection_id === 'app_consumption') projection.observation.live = true;
  }
  return input;
}

function productionExpectation(input: any): any {
  const identity = Object.fromEntries([
    'display_version',
    'app_sha',
    'framework_sha',
    'bundle_digest',
    'cohort_ref',
    'source_cutoff',
  ].map((key) => [key, input.identity[key]]));
  const carriers = Object.fromEntries(['docker_webui', 'macos_standard'].map((carrierId) => {
    const carrier = input.carriers.find((value: any) => value.carrier_id === carrierId);
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
  const projectionReceipts = input.phase === 'final_readback'
    ? Object.fromEntries(input.readback.projections.map((projection: any) => [
      projection.projection_id,
      projection.observation.receipt_digest,
    ]))
    : {};
  return JSON.parse(JSON.stringify({
    schema: 'opl_app_unified_release_promotion_expectation.v1',
    evidence_class: 'production_expectation',
    phase: input.phase,
    identity,
    carriers,
    candidate: {
      receipt_digest: input.candidate.receipt_digest,
      matching_attested_receipt_count: input.candidate.matching_attested_receipt_count,
      source_cutoff: input.candidate.source_cutoff,
      identity: input.candidate.identity,
      attestation: input.candidate.attestation,
      source_run: input.candidate.source_run,
      predecessor: input.candidate.predecessor,
      target: input.candidate.target,
      components: input.candidate.components,
    },
    promotion: {
      admission: input.publication_order.promotion_admission,
      moving_pointer_receipt_digest: input.publication_order.moving_pointer_receipt_digest,
    },
    framework_release_set: input.readback.framework_release_set,
    projection_receipts: projectionReceipts,
  }));
}

function verifyProduction(input: any, expectation: any = productionExpectation(input)): any {
  return verifyUnifiedReleasePromotionBarrier(input, { productionExpectation: expectation });
}

test('unified promotion barrier admits exactly two qualified and attested carriers in either completion order', () => {
  const first = admissionFixture();
  const firstResult = verifyFixture(first);
  assert.equal(firstResult.status, 'promotion_admitted');
  assert.equal(firstResult.cas_mode, 'predecessor_to_target');
  assert.deepEqual(Object.keys(firstResult.carrier_digests).sort(), ['docker_webui', 'macos_standard']);

  const reversed = admissionFixture();
  reversed.carriers.reverse();
  reversed.candidate.carrier_bindings.reverse();
  const reversedResult = verifyFixture(reversed);
  assert.equal(reversedResult.status, 'promotion_admitted');
  assert.deepEqual(reversedResult.carrier_digests, firstResult.carrier_digests);
});

test('unified final readback accepts exact target idempotency and all six projections', () => {
  const input = promotionFixture();
  const result = verifyFixture(input);
  assert.equal(result.status, 'final_readback_verified');
  assert.equal(result.cas_mode, 'target_idempotent');
  assert.equal(result.exact_projection_count, 6);
  assert.deepEqual(result.bounded_reconcile, {
    attempt: 1,
    max_attempts: 3,
    mutation_retry_allowed: false,
  });
  assert.deepEqual(result.package_selection_summary, {
    advanced_count: 6,
    reused_verified_lkg_count: 1,
  });
  assert.match(result.input_digest, /^sha256:[0-9a-f]{64}$/);
});

test('protected promotion accepts one failed Package via verified immutable LKG while the other Packages advance', () => {
  const input = promotionFixture();
  const selection = input.readback.framework_release_set.package_selection_results.mag;
  const appObservation = input.readback.projections.find(
    (projection: any) => projection.projection_id === 'app_consumption',
  ).observation;
  assert.equal(selection.result, 'reused_verified_lkg');
  assert.equal(selection.update_status, 'failed');
  assert.equal(selection.verified_lkg.status, 'verified');
  assert.equal(selection.verified_lkg.artifact_ref, input.candidate.components.packages.mag.artifact_ref);
  assert.equal(selection.verified_lkg.artifact_digest, input.candidate.components.packages.mag.artifact_digest);
  assert.equal(appObservation.package_versions.mag, input.candidate.components.packages.mag.version);
  assert.equal(appObservation.package_artifact_digests.mag, input.candidate.components.packages.mag.artifact_digest);
  const result = verifyFixture(input);
  assert.equal(result.status, 'final_readback_verified');
  assert.deepEqual(result.package_selection_summary, {
    advanced_count: 6,
    reused_verified_lkg_count: 1,
  });
});

test('unified promotion barrier is deterministic across repeated CLI runs', () => {
  const run = () => spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      'scripts/verify-unified-release-promotion-barrier.ts',
      '--input',
      promotionFixturePath,
      '--allow-synthetic-fixture',
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  const first = run();
  const second = run();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout, first.stdout);
  assert.deepEqual(JSON.parse(first.stdout), verifyFixture(promotionFixture()));
});

test('synthetic capsule cannot claim a production verdict or be relabeled without an exact expectation', () => {
  assert.throws(
    () => verifyUnifiedReleasePromotionBarrier(promotionFixture()),
    /synthetic_fixture evidence cannot claim a production promotion verdict/,
  );
  const relabeled = promotionFixture();
  relabeled.evidence_class = 'production_readback';
  assert.throws(
    () => verifyUnifiedReleasePromotionBarrier(relabeled),
    /evidence_class does not match|separately supplied exact production_expectation/,
  );
  const production = productionInput();
  assert.throws(
    () => verifyUnifiedReleasePromotionBarrier(production),
    /separately supplied exact production_expectation/,
  );
  const result = verifyProduction(production);
  assert.equal(result.evidence_class, 'production_readback');
  assert.equal(result.status, 'final_readback_verified');
  assert.match(result.production_expectation_digest, /^sha256:[0-9a-f]{64}$/);
});

test('unified promotion barrier fail-closes the complete negative matrix', () => {
  const cases: Array<{
    name: string;
    phase?: 'admission' | 'final_readback';
    production?: boolean;
    mutate(input: any): void;
    expected: RegExp;
  }> = [
    {
      name: 'missing carrier',
      mutate: (input) => input.carriers.pop(),
      expected: /carriers must contain exactly/,
    },
    {
      name: 'wrong carrier digest',
      mutate: (input) => { input.carriers[0].artifact_digest = `sha256:${'0'.repeat(64)}`; },
      expected: /immutable_ref must pin its exact OCI artifact_digest/,
    },
    {
      name: 'wrong carrier cohort',
      mutate: (input) => { input.carriers[1].identity.cohort_ref = `sha256:${'0'.repeat(64)}`; },
      expected: /cohort_ref does not match/,
    },
    {
      name: 'wrong carrier Framework SHA',
      mutate: (input) => { input.carriers[0].identity.framework_sha = '0'.repeat(40); },
      expected: /framework_sha does not match/,
    },
    {
      name: 'wrong carrier source cutoff',
      mutate: (input) => { input.carriers[1].identity.source_cutoff = '2026-07-23T01:31:00Z'; },
      expected: /source_cutoff does not match/,
    },
    {
      name: 'carrier manifest digest is missing',
      mutate: (input) => { delete input.carriers[0].manifest_digest; },
      expected: /manifest_digest must be a non-empty/,
    },
    {
      name: 'Desktop carrier adds a WebUI-only content fingerprint',
      mutate: (input) => { input.carriers[1].content_fingerprint = `sha256:${'0'.repeat(64)}`; },
      expected: /content_fingerprint is not part/,
    },
    {
      name: 'wrong carrier App version',
      mutate: (input) => { input.carriers[0].identity.display_version = '26.7.22'; },
      expected: /display_version does not match/,
    },
    {
      name: 'carrier build failed',
      mutate: (input) => { input.carriers[0].build.status = 'failed'; },
      expected: /build.status does not match/,
    },
    {
      name: 'carrier qualification failed',
      mutate: (input) => { input.carriers[1].qualification.status = 'failed'; },
      expected: /qualification.status does not match/,
    },
    {
      name: 'carrier unattested',
      mutate: (input) => { input.carriers[0].attestation.status = 'missing'; },
      expected: /attestation.status does not match/,
    },
    {
      name: 'wrong attestation subject digest',
      mutate: (input) => { input.carriers[1].attestation.subject_digest = `sha256:${'0'.repeat(64)}`; },
      expected: /subject_digest does not match/,
    },
    {
      name: 'immutable carrier is absent',
      mutate: (input) => { input.carriers[0].immutable_upload.status = 'absent'; },
      expected: /immutable_upload.status does not match/,
    },
    {
      name: 'immutable carrier availability is unknown',
      mutate: (input) => { input.carriers[0].immutable_upload.status = 'unknown'; },
      expected: /immutable_upload.status does not match/,
    },
    {
      name: 'immutable and moving refs are conflated',
      mutate: (input) => { input.carriers[0].moving_pointer_refs = [input.carriers[0].immutable_ref]; },
      expected: /immutable upload and moving pointer refs must remain separate/,
    },
    {
      name: 'carrier moving pointer set is wrong',
      mutate: (input) => { input.carriers[0].moving_pointer_refs = ['ghcr.io/example/wrong:stable']; },
      expected: /moving_pointer_refs must contain exactly/,
    },
    {
      name: 'empty carrier bytes',
      mutate: (input) => { input.carriers[1].size_bytes = 0; },
      expected: /size_bytes must be a positive/,
    },
    {
      name: 'barrier omits one build receipt',
      mutate: (input) => { delete input.barrier.stable_built.carrier_receipts.docker_webui; },
      expected: /stable_built.carrier_receipts must contain exactly/,
    },
    {
      name: 'candidate has multiple attested receipts',
      mutate: (input) => { input.candidate.matching_attested_receipt_count = 2; },
      expected: /matching_attested_receipt_count does not match/,
    },
    {
      name: 'candidate is missing',
      mutate: (input) => { delete input.candidate; },
      expected: /candidate must be an object/,
    },
    {
      name: 'candidate receipt is missing',
      mutate: (input) => { delete input.candidate.receipt_digest; },
      expected: /candidate.receipt_digest must be a non-empty/,
    },
    {
      name: 'candidate attestation is missing',
      mutate: (input) => { delete input.candidate.attestation; },
      expected: /candidate.attestation must be an object/,
    },
    {
      name: 'candidate source head differs',
      mutate: (input) => { input.candidate.source_run.head_sha = '0'.repeat(40); },
      expected: /source_run.head_sha does not match/,
    },
    {
      name: 'candidate Package selection cutoff uses a scalar timestamp',
      mutate: (input) => { input.candidate.source_cutoff = '2026-07-23T01:31:00Z'; },
      expected: /candidate.source_cutoff must be an object/,
    },
    {
      name: 'candidate target uses a different App version',
      mutate: (input) => {
        input.candidate.target.immutable_ref = 'ghcr.io/gaofeng21cn/one-person-lab-manifest:26.7.22';
      },
      expected: /candidate.target.immutable_ref does not match/,
    },
    {
      name: 'Base source commit differs from frozen Framework',
      mutate: (input) => { input.candidate.components.base.source_commit = '0'.repeat(40); },
      expected: /components.base.source_commit does not match/,
    },
    {
      name: 'candidate omits one Package',
      mutate: (input) => { delete input.candidate.components.packages.rca; },
      expected: /components.packages must contain exactly/,
    },
    {
      name: 'candidate adds a tenth component',
      mutate: (input) => { input.candidate.components.extra = { component_id: 'extra' }; },
      expected: /candidate.components must contain exactly/,
    },
    {
      name: 'candidate Package digest drifts from exact9 evidence',
      mutate: (input) => {
        const replacement = `sha256:${'0'.repeat(64)}`;
        input.candidate.components.packages.rca.artifact_digest = replacement;
        input.readback.framework_release_set.package_selection_results.rca.selected_artifact_digest =
          replacement;
        input.readback.projections[1].observation.package_artifact_digests.rca = replacement;
      },
      expected: /component_set_digest does not match/,
    },
    {
      name: 'candidate attempts force publish',
      mutate: (input) => { input.candidate.force_publish = true; },
      expected: /force_publish is forbidden/,
    },
    {
      name: 'embedded Package catalog digest is malformed',
      mutate: (input) => { input.candidate.components.package_catalog_digest = 'sha256:short'; },
      expected: /package_catalog_digest must be an exact sha256 digest/,
    },
    {
      name: 'Framework Release Set descriptor differs from the promoted target',
      mutate: (input) => {
        input.readback.framework_release_set.release_set_descriptor_digest = `sha256:${'0'.repeat(64)}`;
      },
      expected: /release_set_descriptor_digest does not match/,
    },
    {
      name: 'Framework channel manifest layer digest is malformed',
      mutate: (input) => {
        input.readback.framework_release_set.channel_manifest_layer_digest = 'sha256:short';
      },
      expected: /channel_manifest_layer_digest must be an exact sha256 digest/,
    },
    {
      name: 'Framework verifier capsule is not the v2 digest-domain contract',
      mutate: (input) => {
        input.readback.framework_release_set.surface_kind =
          'opl_package_latest_stable_verification_capsule.v1';
      },
      expected: /readback.framework_release_set.surface_kind does not match/,
    },
    {
      name: 'Framework v2 app consumption descriptor differs from its Release Set',
      mutate: (input) => {
        input.readback.framework_release_set.app_consumption.release_set_descriptor_digest =
          `sha256:${'0'.repeat(64)}`;
      },
      expected: /app_consumption.observation.release_set_descriptor_digest does not match/,
    },
    {
      name: 'Framework v2 app consumption channel layer differs from its Release Set',
      mutate: (input) => {
        input.readback.framework_release_set.app_consumption.channel_manifest_layer_digest =
          `sha256:${'0'.repeat(64)}`;
      },
      expected: /app_consumption.observation.channel_manifest_layer_digest does not match/,
    },
    {
      name: 'Framework v2 app consumption Package catalog differs from its Release Set',
      mutate: (input) => {
        input.readback.framework_release_set.app_consumption.package_catalog_digest =
          `sha256:${'0'.repeat(64)}`;
      },
      expected: /app_consumption.observation.package_catalog_digest does not match/,
    },
    {
      name: 'Package selection results omit one Package identity',
      mutate: (input) => {
        delete input.readback.framework_release_set.package_selection_results.rca;
      },
      expected: /package_selection_results must contain exactly/,
    },
    {
      name: 'Package selection source cutoff drifts from the Framework candidate receipt',
      mutate: (input) => {
        input.readback.framework_release_set.package_selection_results.mas
          .source_cutoff.frozen_base_release_set.generation = '26.7.19';
      },
      expected: /package_selection_results\.mas\.source_cutoff does not match/,
    },
    {
      name: 'advanced Package reports a failed update',
      mutate: (input) => {
        input.readback.framework_release_set.package_selection_results.mas.update_status = 'failed';
      },
      expected: /package_selection_results\.mas\.update_status does not match/,
    },
    {
      name: 'failed Package reuses an unverified LKG',
      mutate: (input) => {
        input.readback.framework_release_set.package_selection_results.mag.verified_lkg.status =
          'unknown';
      },
      expected: /package_selection_results\.mag\.verified_lkg\.status does not match/,
    },
    {
      name: 'failed Package LKG digest differs from the selected immutable member',
      mutate: (input) => {
        input.readback.framework_release_set.package_selection_results.mag.verified_lkg.artifact_digest =
          `sha256:${'0'.repeat(64)}`;
      },
      expected: /package_selection_results\.mag\.verified_lkg\.artifact_digest does not match/,
    },
    {
      name: 'Framework latest-stable substitutes the App channel layer digest',
      mutate: (input) => {
        const channelDigest = input.readback.framework_release_set.channel_manifest_layer_digest;
        input.readback.projections[0].expected_digest = channelDigest;
        input.readback.projections[0].observation.digest = channelDigest;
      },
      expected: /framework_latest_stable.expected_digest does not match/,
    },
    {
      name: 'App consumption substitutes the Release Set descriptor digest',
      mutate: (input) => {
        const descriptorDigest = input.readback.framework_release_set.release_set_descriptor_digest;
        input.readback.projections[1].expected_digest = descriptorDigest;
        input.readback.projections[1].observation.digest = descriptorDigest;
        input.readback.projections[1].observation.channel_manifest_layer_digest = descriptorDigest;
        for (const packageId of Object.keys(input.readback.projections[1].observation.package_source_digests)) {
          input.readback.projections[1].observation.package_source_digests[packageId] = descriptorDigest;
        }
      },
      expected: /app_consumption.expected_digest does not match/,
    },
    {
      name: 'descriptor and channel manifest digest domains collapse',
      mutate: (input) => {
        const descriptorDigest = input.readback.framework_release_set.release_set_descriptor_digest;
        input.readback.framework_release_set.channel_manifest_layer_digest = descriptorDigest;
        input.readback.framework_release_set.app_consumption.channel_manifest_layer_digest = descriptorDigest;
        input.readback.projections[1].expected_digest = descriptorDigest;
        input.readback.projections[1].observation.digest = descriptorDigest;
        input.readback.projections[1].observation.channel_manifest_layer_digest = descriptorDigest;
        for (const packageId of Object.keys(input.readback.projections[1].observation.package_source_digests)) {
          input.readback.projections[1].observation.package_source_digests[packageId] = descriptorDigest;
        }
      },
      expected: /digest domains must remain distinct/,
    },
    {
      name: 'candidate carrier binding digest differs',
      mutate: (input) => { input.candidate.carrier_bindings[0].artifact_digest = `sha256:${'0'.repeat(64)}`; },
      expected: /candidate artifact_digest does not match/,
    },
    {
      name: 'candidate carrier binding size differs',
      mutate: (input) => { input.candidate.carrier_bindings[1].size_bytes += 1; },
      expected: /candidate size_bytes does not match/,
    },
    {
      name: 'candidate WebUI fingerprint differs',
      mutate: (input) => { input.candidate.carrier_bindings[0].content_fingerprint = `sha256:${'0'.repeat(64)}`; },
      expected: /candidate content_fingerprint does not match/,
    },
    {
      name: 'candidate Desktop binding adds a WebUI-only fingerprint',
      mutate: (input) => {
        input.candidate.carrier_bindings[1].content_fingerprint = `sha256:${'0'.repeat(64)}`;
      },
      expected: /candidate content_fingerprint does not match/,
    },
    {
      name: 'CAS availability is unknown',
      mutate: (input) => { input.cas_prestate.status = 'unknown'; },
      expected: /cas_prestate.status does not match/,
    },
    {
      name: 'CAS predecessor is absent',
      mutate: (input) => { input.cas_prestate.status = 'absent'; },
      expected: /cas_prestate.status does not match/,
    },
    {
      name: 'CAS observes a third digest',
      mutate: (input) => { input.cas_prestate.digest = `sha256:${'0'.repeat(64)}`; },
      expected: /a third digest fails closed/,
    },
    {
      name: 'CAS identity differs at the exact target digest',
      mutate: (input) => { input.cas_prestate.identity_digest = `sha256:${'0'.repeat(64)}`; },
      expected: /cas_prestate.identity_digest does not match/,
    },
    {
      name: 'pointer starts before admission barrier',
      phase: 'admission',
      mutate: (input) => {
        input.publication_order.moving_pointer_mutation_started = true;
        input.publication_order.moving_pointer_receipt_digest = `sha256:${'1'.repeat(64)}`;
      },
      expected: /moving_pointer_mutation_started does not match/,
    },
    {
      name: 'promotion admission receipt is missing',
      mutate: (input) => { delete input.publication_order.promotion_admission; },
      expected: /promotion_admission must be an object/,
    },
    {
      name: 'promotion admission receipt is not unique',
      mutate: (input) => {
        input.publication_order.promotion_admission.matching_attested_receipt_count = 2;
      },
      expected: /matching_attested_receipt_count does not match/,
    },
    {
      name: 'promotion admission receipt is unattested',
      mutate: (input) => { input.publication_order.promotion_admission.attestation.status = 'missing'; },
      expected: /promotion_admission.attestation.status does not match/,
    },
    {
      name: 'promotion admission binds another candidate',
      mutate: (input) => {
        input.publication_order.promotion_admission.candidate_receipt_digest = `sha256:${'0'.repeat(64)}`;
      },
      expected: /candidate_receipt_digest does not match/,
    },
    {
      name: 'promotion admission binds another source run',
      mutate: (input) => { input.publication_order.promotion_admission.source_run.run_id = '30000000002'; },
      expected: /source_run.run_id does not match/,
    },
    {
      name: 'promotion pointer receipt uses a different source cutoff',
      mutate: (input) => { input.publication_order.source_cutoff = '2026-07-23T01:31:00Z'; },
      expected: /publication_order.source_cutoff does not match/,
    },
    {
      name: 'final readback omits one projection',
      mutate: (input) => input.readback.projections.pop(),
      expected: /readback.projections must contain exactly/,
    },
    {
      name: 'final projection result is unknown',
      mutate: (input) => { input.readback.projections[0].observation.status = 'unknown'; },
      expected: /unknown fails closed/,
    },
    {
      name: 'final projection is partial',
      mutate: (input) => { input.readback.projections[1].observation.status = 'not_observed'; },
      expected: /not_observed fails closed/,
    },
    {
      name: 'final projection is explicitly not found',
      mutate: (input) => { input.readback.projections[1].observation.status = 'absent'; },
      expected: /absent fails closed/,
    },
    {
      name: 'final projection digest differs',
      mutate: (input) => { input.readback.projections[2].observation.digest = `sha256:${'0'.repeat(64)}`; },
      expected: /observation.digest does not match/,
    },
    {
      name: 'final projection source cutoff differs',
      mutate: (input) => { input.readback.projections[0].observation.source_cutoff = '2026-07-23T01:31:00Z'; },
      expected: /observation.source_cutoff does not match/,
    },
    {
      name: 'exact9 evidence reports only eight SLSA subjects',
      mutate: (input) => { input.readback.framework_release_set.slsa_attested_subject_count = 8; },
      expected: /slsa_attested_subject_count does not match/,
    },
    {
      name: 'Framework verifier receipt differs from Framework projection',
      mutate: (input) => {
        input.readback.framework_release_set.verifier_receipt_digest = `sha256:${'0'.repeat(64)}`;
      },
      expected: /verifier_receipt_digest does not match/,
    },
    {
      name: 'production App consumption is not live',
      production: true,
      mutate: (input) => { input.readback.projections[1].observation.live = false; },
      expected: /app_consumption.observation.live does not match/,
    },
    {
      name: 'production App consumption uses the fast profile',
      production: true,
      mutate: (input) => { input.readback.projections[1].observation.profile = 'fast'; },
      expected: /app_consumption.observation.profile does not match/,
    },
    {
      name: 'production App consumption is cached',
      production: true,
      mutate: (input) => { input.readback.projections[1].observation.app_state_status = 'cached'; },
      expected: /app_consumption.observation.app_state_status does not match/,
    },
    {
      name: 'production App consumption is not live verified',
      production: true,
      mutate: (input) => { input.readback.projections[1].observation.live_verified = false; },
      expected: /app_consumption.observation.live_verified does not match/,
    },
    {
      name: 'production App catalog uses the Release Set descriptor',
      production: true,
      mutate: (input) => {
        input.readback.projections[1].observation.channel_manifest_layer_digest =
          input.readback.framework_release_set.release_set_descriptor_digest;
      },
      expected: /app_consumption.observation.channel_manifest_layer_digest does not match/,
    },
    {
      name: 'production App descriptor does not bind the Framework v2 app consumption',
      production: true,
      mutate: (input) => {
        input.readback.projections[1].observation.release_set_descriptor_digest =
          `sha256:${'0'.repeat(64)}`;
      },
      expected: /app_consumption.observation.release_set_descriptor_digest does not match/,
    },
    {
      name: 'production App Package catalog does not bind the Framework v2 app consumption',
      production: true,
      mutate: (input) => {
        input.readback.projections[1].observation.package_catalog_digest =
          `sha256:${'0'.repeat(64)}`;
      },
      expected: /app_consumption.observation.package_catalog_digest does not match/,
    },
    {
      name: 'production App observation exposes the legacy ambiguous catalog digest',
      production: true,
      mutate: (input) => {
        input.readback.projections[1].observation.catalog_digest =
          input.readback.framework_release_set.channel_manifest_layer_digest;
      },
      expected: /must not expose the legacy ambiguous catalog_digest/,
    },
    {
      name: 'production App Package source uses the Release Set descriptor',
      production: true,
      mutate: (input) => {
        input.readback.projections[1].observation.package_source_digests.rca =
          input.readback.framework_release_set.release_set_descriptor_digest;
      },
      expected: /package_source_digests.rca does not match/,
    },
    {
      name: 'production App Package version differs from the selected LKG member',
      production: true,
      mutate: (input) => {
        input.readback.projections[1].observation.package_versions.mag = '0.3.5';
      },
      expected: /package_versions.mag does not match/,
    },
    {
      name: 'production App Package digest differs from the selected LKG member',
      production: true,
      mutate: (input) => {
        input.readback.projections[1].observation.package_artifact_digests.mag =
          `sha256:${'0'.repeat(64)}`;
      },
      expected: /package_artifact_digests.mag does not match/,
    },
    {
      name: 'production exact9 receipt is not the expected receipt',
      production: true,
      mutate: (input) => {
        const replacement = `sha256:${'0'.repeat(64)}`;
        input.readback.framework_release_set.verifier_receipt_digest = replacement;
        input.readback.projections[0].observation.receipt_digest = replacement;
      },
      expected: /production_expectation does not exactly match/,
    },
    {
      name: 'production carrier attestation is not the expected attestation',
      production: true,
      mutate: (input) => {
        input.carriers[0].attestation.receipt_digest = `sha256:${'0'.repeat(64)}`;
      },
      expected: /production_expectation does not exactly match/,
    },
    {
      name: 'bounded reconcile is exceeded',
      mutate: (input) => { input.readback.reconcile.attempt = 4; },
      expected: /bounded 0\.\.3 read-only window/,
    },
    {
      name: 'unknown result caused redispatch',
      mutate: (input) => { input.readback.reconcile.redispatch_attempted = true; },
      expected: /redispatch_attempted does not match/,
    },
    {
      name: 'pointer mutation was retried',
      mutate: (input) => { input.readback.reconcile.pointer_mutation_retried = true; },
      expected: /pointer_mutation_retried does not match/,
    },
    {
      name: 'authorized security revocation invalidates frozen cohort',
      mutate: (input) => { input.identity.invalidation_reason = 'exact_ref_or_digest_security_revocation'; },
      expected: /Frozen cohort is invalidated/,
    },
    {
      name: 'source cutoff was refreshed',
      mutate: (input) => { input.identity.source_cutoff_read_count = 2; },
      expected: /source_cutoff_read_count does not match/,
    },
    {
      name: 'post-freeze remote refresh was allowed',
      mutate: (input) => { input.identity.post_freeze_remote_refresh_allowed = true; },
      expected: /post_freeze_remote_refresh_allowed does not match/,
    },
    {
      name: 'Full changes Standard identity',
      mutate: (input) => { input.full_track.standard_identity_unchanged = false; },
      expected: /standard_identity_unchanged does not match/,
    },
  ];

  for (const testCase of cases) {
    let input = testCase.phase === 'admission' ? admissionFixture() : promotionFixture();
    if (testCase.production) input = productionInput(input);
    const expectation = testCase.production ? productionExpectation(input) : undefined;
    testCase.mutate(input);
    assert.throws(
      () => testCase.production ? verifyProduction(input, expectation) : verifyFixture(input),
      testCase.expected,
      testCase.name,
    );
  }
});

test('post-freeze authority advancement alone does not invalidate the frozen cohort', () => {
  const input = admissionFixture();
  input.identity.live_authority_advanced_after_cutoff = true;
  input.identity.invalidation_reason = 'none';
  const result = verifyFixture(input);
  assert.equal(result.status, 'promotion_admitted');
});
