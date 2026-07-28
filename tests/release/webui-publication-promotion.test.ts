import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

import {
  createWebuiPublicationRecord,
  type JsonRecord,
} from '../../scripts/webui-publication-record.ts';
import {
  admitWebuiPublicationLatestPromotion,
  decideWebuiPublicationLatestPromotion,
  writeWebuiPublicationLatestPromotionReceipt,
} from '../../scripts/webui-publication-promotion.ts';
import { createWebuiSourceAuthority } from '../../scripts/webui-source-authority.ts';
import {
  isAuthorizedWebuiPublicationLatestPromotionWriteJob,
  validateWorkflowDispatchWriteAuthority,
} from '../../scripts/validate-release-boundary/text-check-runner.ts';

const appRoot = process.cwd();
const workflowPath = path.join(
  appRoot,
  '.github',
  'workflows',
  'release-webui-publication-promote.yml',
);
const appSha = 'a'.repeat(40);
const shellSha = 'b'.repeat(40);
const frameworkSha = 'c'.repeat(40);
const executorSha = 'd'.repeat(40);
const childDigest = digest('e');
const versionDigest = digest('f');
const stableDigest = digest('1');
const latestDigest = digest('2');

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function evidenceDigest(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function observation(
  ref: string,
  status: 'present' | 'absent' | 'unknown',
  observedDigest: string | null,
  logoutBeforeReadback?: boolean,
): JsonRecord {
  return {
    schema: 'opl_app_webui_descriptor_readback.v1',
    ref,
    status,
    digest: observedDigest,
    ...(logoutBeforeReadback === undefined
      ? {}
      : { logout_before_readback: logoutBeforeReadback }),
  };
}

function recordFor(version = '26.7.28-preview.r1'): JsonRecord {
  const sourceAuthority = createWebuiSourceAuthority({
    version,
    appSha,
    shellSha,
    frameworkSha,
    runId: '302',
    executorSha,
  });
  return createWebuiPublicationRecord({
    authorityMode: 'independent_preview',
    carrierReceipt: {
      schema: 'opl_app_webui_release_carrier.v1',
      release: {
        version,
        bundle_digest: sourceAuthority.source_authority_digest,
        cohort_ref: sourceAuthority.source_authority_digest,
      },
      cohort: { app_sha: appSha, shell_sha: shellSha, framework_sha: frameworkSha },
      carrier: {
        carrier_id: 'docker_webui',
        carrier_kind: 'oci_image',
        package_profile: 'webui-full',
        ref: `ghcr.io/gaofeng21cn/one-person-lab-webui@${childDigest}`,
        digest: childDigest,
        size_bytes: 123,
        content_fingerprint: digest('3'),
      },
      qualification: {
        status: 'passed',
        image_digest: childDigest,
        content_fingerprint: digest('3'),
      },
    },
    carrierReceiptSha256: evidenceDigest('carrier'),
    versionReadback: {
      ...observation(`ghcr.io/gaofeng21cn/one-person-lab-webui:${version}`, 'present', versionDigest),
      child_digest: childDigest,
      manifest_count: 1,
      media_type: 'application/vnd.oci.image.index.v1+json',
    },
    versionReadbackSha256: evidenceDigest('version'),
    publicationRunId: '302',
    publicationExecutorSha: executorSha,
    sourceAuthority,
    sourceAuthoritySha256: evidenceDigest('source-authority'),
  });
}

function fixture() {
  const publication = recordFor();
  const version = publication.release.version as string;
  const versionRef = publication.image.version_ref as string;
  const stableRef = 'ghcr.io/gaofeng21cn/one-person-lab-webui:stable';
  const latestRef = 'ghcr.io/gaofeng21cn/one-person-lab-webui:latest';
  const admission = admitWebuiPublicationLatestPromotion({
    publicationVersion: version,
    publicationRecord: publication,
    versionReadback: {
      ...observation(versionRef, 'present', versionDigest),
      child_digest: childDigest,
      manifest_count: 1,
      media_type: 'application/vnd.oci.image.index.v1+json',
    },
    stablePrestate: observation(stableRef, 'present', stableDigest),
    latestPrestate: observation(latestRef, 'present', latestDigest),
  });
  return { publication, version, versionRef, stableRef, latestRef, admission };
}

test('durable record selector admits a retained Stable or Preview version without changing quality', () => {
  const { admission, version, stableRef, latestRef } = fixture();
  assert.equal(admission.status, 'passed');
  assert.equal(admission.selector.source, 'durable_webui_publication_record');
  assert.equal(admission.selector.publication_version, version);
  assert.equal(admission.selector.quality_status, 'preview');
  assert.deepEqual(admission.target.promotion_tags, ['latest']);
  assert.equal(admission.target.stable_ref, stableRef);
  assert.equal(admission.target.latest_ref, latestRef);
  assert.equal(admission.expected_prestate.stable.digest, stableDigest);
  assert.equal(admission.expected_prestate.latest.digest, latestDigest);
});

test('selector decision permits only one Latest write while Stable remains frozen', () => {
  const { admission, stableRef, latestRef } = fixture();
  const cases: Array<[JsonRecord, JsonRecord, string, number]> = [
    [
      observation(stableRef, 'present', stableDigest),
      observation(latestRef, 'present', latestDigest),
      'write_once',
      1,
    ],
    [
      observation(stableRef, 'present', stableDigest),
      observation(latestRef, 'present', versionDigest),
      'idempotent',
      0,
    ],
    [
      observation(stableRef, 'present', digest('0')),
      observation(latestRef, 'present', latestDigest),
      'stable_conflict',
      0,
    ],
    [
      observation(stableRef, 'present', stableDigest),
      observation(latestRef, 'present', digest('0')),
      'latest_conflict',
      0,
    ],
    [
      observation(stableRef, 'unknown', null),
      observation(latestRef, 'present', latestDigest),
      'prestate_unknown',
      0,
    ],
  ];
  for (const [stable, latest, decision, attempts] of cases) {
    const actual = decideWebuiPublicationLatestPromotion(admission, stable, latest);
    assert.equal(actual.decision, decision);
    assert.equal(actual.authorized_tag_attempts, attempts);
  }
});

test('selector rejects a non-retained version reference or version digest drift', () => {
  const { publication, stableRef, latestRef } = fixture();
  assert.throws(
    () => admitWebuiPublicationLatestPromotion({
      publicationVersion: '26.7.28-preview.r2',
      publicationRecord: publication,
      versionReadback: {
        ...observation(publication.image.version_ref as string, 'present', versionDigest),
        child_digest: childDigest,
        manifest_count: 1,
        media_type: 'application/vnd.oci.image.index.v1+json',
      },
      stablePrestate: observation(stableRef, 'present', stableDigest),
      latestPrestate: observation(latestRef, 'present', latestDigest),
    }),
    /selected publication version/,
  );
  assert.throws(
    () => admitWebuiPublicationLatestPromotion({
      publicationVersion: publication.release.version as string,
      publicationRecord: publication,
      versionReadback: {
        ...observation(publication.image.version_ref as string, 'present', digest('0')),
        child_digest: childDigest,
        manifest_count: 1,
        media_type: 'application/vnd.oci.image.index.v1+json',
      },
      stablePrestate: observation(stableRef, 'present', stableDigest),
      latestPrestate: observation(latestRef, 'present', latestDigest),
    }),
    /version readback.digest/,
  );
});

test('terminal receipt distinguishes complete, reconciled, idempotent, and inconclusive states', () => {
  const { admission, stableRef, latestRef } = fixture();
  const writeDecision = decideWebuiPublicationLatestPromotion(
    admission,
    observation(stableRef, 'present', stableDigest),
    observation(latestRef, 'present', latestDigest),
  );
  const stableTarget = observation(stableRef, 'present', stableDigest, true);
  const latestTarget = observation(latestRef, 'present', versionDigest, true);
  const readbacks = {
    schema: 'opl_app_webui_publication_latest_reconcile_readbacks.v1',
    observations: [stableTarget],
  };
  const latestReadbacks = {
    schema: 'opl_app_webui_publication_latest_reconcile_readbacks.v1',
    observations: [latestTarget],
  };
  const accepted = {
    schema: 'opl_app_webui_publication_latest_mutation_attempt.v1',
    status: 'accepted',
    attempt_count: 1,
  };
  assert.equal(writeWebuiPublicationLatestPromotionReceipt({
    admission,
    decision: writeDecision,
    mutation: accepted,
    stableReadbacks: readbacks,
    latestReadbacks,
    anonymousStableReadback: stableTarget,
    anonymousLatestReadback: latestTarget,
  }).status, 'complete');
  assert.equal(writeWebuiPublicationLatestPromotionReceipt({
    admission,
    decision: writeDecision,
    mutation: { ...accepted, status: 'unknown' },
    stableReadbacks: readbacks,
    latestReadbacks,
    anonymousStableReadback: stableTarget,
    anonymousLatestReadback: latestTarget,
  }).status, 'reconciled_complete');
  const idempotentDecision = decideWebuiPublicationLatestPromotion(
    admission,
    observation(stableRef, 'present', stableDigest),
    observation(latestRef, 'present', versionDigest),
  );
  assert.equal(writeWebuiPublicationLatestPromotionReceipt({
    admission,
    decision: idempotentDecision,
    mutation: {
      schema: 'opl_app_webui_publication_latest_mutation_attempt.v1',
      status: 'not_attempted',
      attempt_count: 0,
    },
    stableReadbacks: {
      schema: 'opl_app_webui_publication_latest_reconcile_readbacks.v1',
      observations: [],
    },
    latestReadbacks: {
      schema: 'opl_app_webui_publication_latest_reconcile_readbacks.v1',
      observations: [],
    },
    anonymousStableReadback: stableTarget,
    anonymousLatestReadback: latestTarget,
  }).status, 'idempotent');
  assert.equal(writeWebuiPublicationLatestPromotionReceipt({
    admission,
    decision: writeDecision,
    mutation: { ...accepted, status: 'unknown' },
    stableReadbacks: {
      schema: 'opl_app_webui_publication_latest_reconcile_readbacks.v1',
      observations: [observation(stableRef, 'unknown', null)],
    },
    latestReadbacks: {
      schema: 'opl_app_webui_publication_latest_reconcile_readbacks.v1',
      observations: [observation(latestRef, 'unknown', null)],
    },
    anonymousStableReadback: observation(stableRef, 'unknown', null, true),
    anonymousLatestReadback: observation(latestRef, 'unknown', null, true),
  }).status, 'outcome_unknown');
});

test('manual workflow accepts one durable version selector and has one protected Latest-only writer', () => {
  const source = fs.readFileSync(workflowPath, 'utf8');
  const workflow = YAML.parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs), ['publication_version']);
  assert.equal(workflow.permissions.actions, 'read');
  assert.equal(workflow.permissions.contents, 'read');
  assert.deepEqual(workflow.concurrency, {
    group: 'opl-webui-stable-promotion-global',
    'cancel-in-progress': false,
  });
  assert.deepEqual(Object.keys(workflow.jobs), ['admission', 'promote-latest']);
  assert.deepEqual(workflow.jobs.admission.permissions, { actions: 'read', contents: 'read' });
  assert.equal(workflow.jobs['promote-latest'].needs, 'admission');
  assert.equal(workflow.jobs['promote-latest'].environment, 'release-preview-publication');
  assert.deepEqual(workflow.jobs['promote-latest'].permissions, {
    actions: 'read',
    contents: 'read',
    packages: 'write',
  });
  assert.equal(
    isAuthorizedWebuiPublicationLatestPromotionWriteJob(
      '.github/workflows/release-webui-publication-promote.yml',
      'promote-latest',
      workflow.jobs['promote-latest'],
    ),
    true,
  );
  assert.match(source, /oras pull "\$receipt_ref"/);
  assert.match(source, /webui-publication-record\.ts[\s\\]+validate/);
  assert.match(source, /webui-publication-promotion\.ts admit/);
  assert.match(source, /oras tag "\$target_ref" latest/);
  assert.match(source, /stable_unchanged:true/);
  assert.doesNotMatch(source, /\boras tag\b[^\n]*\bstable\b/);
  assert.doesNotMatch(source, /release-webui-development\.yml|release-webui-stable\.yml|gh workflow run|--force/);
  assert.equal(validateWorkflowDispatchWriteAuthority(appRoot), 0);
});
