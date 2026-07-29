import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createAppComponentManifest } from '../../scripts/write-opl-app-component-manifest.ts';
import {
  stableQualificationGates,
  validateReleaseQualityPromotion,
} from '../../scripts/validate-release-quality-promotion.ts';

const artifactDigest = `sha256:${'a'.repeat(64)}`;
const artifactSize = 1_234_567;

function writeJson(root: string, name: string, value: unknown): string {
  const filePath = path.join(root, name);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function fixture(version = '26.7.27-preview.r1') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-quality-promotion-'));
  const updaterVersion = version.includes('-nightly')
    ? '26.7.2791-nightly.1'
    : '26.7.2701';
  const manifest = createAppComponentManifest({
    version,
    updaterVersion,
    sourceCommit: '1'.repeat(40),
    shellCommit: '2'.repeat(40),
    frameworkCommit: '3'.repeat(40),
    tag: `v${version}`,
    releaseUrl: `https://github.com/gaofeng21cn/one-person-lab-app/releases/tag/v${version}`,
    repo: 'gaofeng21cn/one-person-lab-app',
    assets: [
      ['latest-arm64-mac.yml', `sha256:${'b'.repeat(64)}`],
      [`One-Person-Lab-${version}-mac-arm64.dmg`, artifactDigest],
      [`One-Person-Lab-${version}-mac-arm64.zip`, `sha256:${'c'.repeat(64)}`],
      [`One-Person-Lab-${version}-mac-arm64.zip.blockmap`, `sha256:${'d'.repeat(64)}`],
      [`One-Person-Lab-${version}-linux-x64.deb`, `sha256:${'9'.repeat(64)}`],
      ['standard-gatekeeper-launch-policy.json', `sha256:${'e'.repeat(64)}`],
      ['standard-apple-notarization-receipt.json', `sha256:${'f'.repeat(64)}`],
    ].map(([name, digest]) => ({
      name,
      url: `https://example.invalid/${name}`,
      digest,
      size: name.endsWith('.dmg') ? artifactSize : 42,
    })),
  });
  const manifestPath = writeJson(root, 'component-manifest.json', manifest);
  const qualification = {
    schema: 'opl_app_stable_qualification_receipt.v1',
    status: 'passed',
    operation: 'qualify_stable',
    version,
    component_manifest_digest: manifest.component_manifest_digest,
    subject: {
      name: manifest.primary_artifact.name,
      digest: manifest.primary_artifact.digest,
      size: manifest.primary_artifact.size,
    },
    stable_qualified: true,
    passed_gates: [...stableQualificationGates],
    skipped_gates: [],
    failed_gates: [],
    gate_receipts: Object.fromEntries(
      stableQualificationGates.map((gate, index) => [
        gate,
        `sha256:${String(index + 1).repeat(64)}`,
      ]),
    ),
  };
  const qualificationPath = writeJson(root, 'stable-qualification.json', qualification);
  return { root, manifest, manifestPath, qualification, qualificationPath };
}

test('promote_quality upgrades the same exact Preview digest without rewriting manifest or moving Latest', () => {
  const current = fixture();
  try {
    const manifestBefore = fs.readFileSync(current.manifestPath);
    const receipt = validateReleaseQualityPromotion({
      componentManifestPath: current.manifestPath,
      stableQualificationPath: current.qualificationPath,
      generatedAt: '2026-07-27T12:00:00.000Z',
    });
    assert.deepEqual(receipt.source_classification, {
      quality_status: 'preview',
      build_trigger: 'manual',
      preview_kind: 'dev',
      non_stable_notice: true,
    });
    assert.deepEqual(receipt.promoted_classification, {
      quality_status: 'stable',
      build_trigger: 'manual',
      preview_kind: null,
      source_preview_kind_preserved_as_provenance: true,
    });
    assert.equal(receipt.subject.artifact.digest, artifactDigest);
    assert.equal(receipt.subject.component_manifest_digest, current.manifest.component_manifest_digest);
    assert.equal(receipt.invariants.same_exact_artifact_digest, true);
    assert.equal(receipt.invariants.immutable_manifest_rewrite, false);
    assert.equal(receipt.invariants.latest_pointer_mutation, false);
    assert.deepEqual(fs.readFileSync(current.manifestPath), manifestBefore);
    assert.match(receipt.receipt_digest, /^sha256:[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(current.root, { recursive: true, force: true });
  }
});

test('automated Preview promotion preserves Nightly only as source provenance', () => {
  const current = fixture('26.7.27-nightly.r1');
  try {
    const receipt = validateReleaseQualityPromotion({
      componentManifestPath: current.manifestPath,
      stableQualificationPath: current.qualificationPath,
    });
    assert.equal(receipt.source_classification.build_trigger, 'automated');
    assert.equal(receipt.source_classification.preview_kind, 'nightly');
    assert.equal(receipt.promoted_classification.quality_status, 'stable');
    assert.equal(receipt.promoted_classification.build_trigger, 'automated');
    assert.equal(receipt.promoted_classification.preview_kind, null);
  } finally {
    fs.rmSync(current.root, { recursive: true, force: true });
  }
});

test('quality promotion fails closed on incomplete gates, digest drift, or non-Preview source', () => {
  const current = fixture();
  try {
    current.qualification.passed_gates.pop();
    writeJson(current.root, 'stable-qualification.json', current.qualification);
    assert.throws(
      () => validateReleaseQualityPromotion({
        componentManifestPath: current.manifestPath,
        stableQualificationPath: current.qualificationPath,
      }),
      /complete Stable gate set/,
    );

    current.qualification.passed_gates = [...stableQualificationGates];
    current.qualification.subject.digest = `sha256:${'9'.repeat(64)}`;
    writeJson(current.root, 'stable-qualification.json', current.qualification);
    assert.throws(
      () => validateReleaseQualityPromotion({
        componentManifestPath: current.manifestPath,
        stableQualificationPath: current.qualificationPath,
      }),
      /artifact digest/,
    );

    const stableManifest = { ...current.manifest, quality_status: 'stable', preview_kind: null };
    writeJson(current.root, 'component-manifest.json', stableManifest);
    assert.throws(
      () => validateReleaseQualityPromotion({
        componentManifestPath: current.manifestPath,
        stableQualificationPath: current.qualificationPath,
      }),
      /Source quality_status/,
    );
  } finally {
    fs.rmSync(current.root, { recursive: true, force: true });
  }
});
