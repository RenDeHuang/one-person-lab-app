#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  assertReleaseSemanticsAxes,
  type ReleaseBuildTrigger,
  type ReleasePreviewKind,
} from './release-version.ts';

type JsonRecord = Record<string, any>;

export const stableQualificationGates = [
  'container_webui',
  'full',
  'homebrew_clean_install',
  'native_webui',
  'stable_heavy_vm',
  'standard_vm',
] as const;

type StableQualificationGate = typeof stableQualificationGates[number];

export type ReleaseQualityPromotionInput = {
  componentManifestPath: string;
  stableQualificationPath: string;
  generatedAt?: string;
};

function readJson(filePath: string, label: string): JsonRecord {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error(`${label} must be a non-empty regular JSON file.`);
  }
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must contain one JSON object.`);
  }
  return parsed as JsonRecord;
}

function digest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} must be an exact sha256 digest.`);
  }
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return Number(value);
}

function exact(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label} must equal ${String(expected)}.`);
}

function sha256Bytes(bytes: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function sha256File(filePath: string): string {
  return sha256Bytes(fs.readFileSync(path.resolve(filePath)));
}

function componentManifestDigest(manifest: JsonRecord): string {
  const core = Object.fromEntries(
    Object.entries(manifest).filter(([key]) => key !== 'component_manifest_digest'),
  );
  return sha256Bytes(JSON.stringify(core));
}

function exactGateSet(value: unknown, label: string): StableQualificationGate[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`${label} must be an array of gate ids.`);
  }
  const observed = [...value].sort();
  if (JSON.stringify(observed) !== JSON.stringify(stableQualificationGates)) {
    throw new Error(`${label} must contain the complete Stable gate set.`);
  }
  return observed as StableQualificationGate[];
}

function emptyGateSet(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length !== 0) {
    throw new Error(`${label} must be empty for Stable promotion.`);
  }
}

export function validateReleaseQualityPromotion(input: ReleaseQualityPromotionInput): JsonRecord {
  const manifest = readJson(input.componentManifestPath, 'Component manifest');
  const qualification = readJson(input.stableQualificationPath, 'Stable qualification receipt');

  exact(manifest.surface_kind, 'opl_app_component_manifest.v1', 'Component manifest surface_kind');
  exact(manifest.component_id, 'opl-app', 'Component manifest component_id');
  exact(manifest.quality_status, 'preview', 'Source quality_status');
  const buildTrigger = manifest.build_trigger as ReleaseBuildTrigger;
  const previewKind = manifest.preview_kind as ReleasePreviewKind;
  assertReleaseSemanticsAxes({
    qualityStatus: 'preview',
    buildTrigger,
    previewKind,
  });
  exact(manifest.qualification_disclosure?.stable_qualified, false, 'Source stable_qualified disclosure');
  exact(manifest.qualification_disclosure?.non_stable_notice, true, 'Source non-Stable disclosure');
  const declaredManifestDigest = digest(
    manifest.component_manifest_digest,
    'Component manifest component_manifest_digest',
  );
  exact(
    componentManifestDigest(manifest),
    declaredManifestDigest,
    'Component manifest self digest',
  );
  const artifact = {
    name: String(manifest.primary_artifact?.name ?? ''),
    digest: digest(manifest.primary_artifact?.digest, 'Component manifest primary artifact digest'),
    size: positiveInteger(manifest.primary_artifact?.size, 'Component manifest primary artifact size'),
  };
  if (!artifact.name) throw new Error('Component manifest primary artifact name is missing.');
  if (!/^[0-9a-f]{40}$/.test(String(manifest.source_commit ?? ''))) {
    throw new Error('Component manifest source_commit must be an exact Git SHA.');
  }
  if (manifest.release_tag !== `v${manifest.version}` || manifest.release_version !== manifest.version) {
    throw new Error('Component manifest version and release tag identity disagree.');
  }

  exact(qualification.schema, 'opl_app_stable_qualification_receipt.v1', 'Stable qualification schema');
  exact(qualification.status, 'passed', 'Stable qualification status');
  exact(qualification.operation, 'qualify_stable', 'Stable qualification operation');
  exact(qualification.version, manifest.version, 'Stable qualification version');
  exact(
    qualification.component_manifest_digest,
    declaredManifestDigest,
    'Stable qualification component manifest digest',
  );
  exact(qualification.subject?.name, artifact.name, 'Stable qualification artifact name');
  exact(
    digest(qualification.subject?.digest, 'Stable qualification artifact digest'),
    artifact.digest,
    'Stable qualification artifact digest',
  );
  exact(
    positiveInteger(qualification.subject?.size, 'Stable qualification artifact size'),
    artifact.size,
    'Stable qualification artifact size',
  );
  exact(qualification.stable_qualified, true, 'Stable qualification result');
  const passedGates = exactGateSet(qualification.passed_gates, 'Stable qualification passed_gates');
  emptyGateSet(qualification.skipped_gates, 'Stable qualification skipped_gates');
  emptyGateSet(qualification.failed_gates, 'Stable qualification failed_gates');
  if (
    !qualification.gate_receipts
    || typeof qualification.gate_receipts !== 'object'
    || Array.isArray(qualification.gate_receipts)
  ) {
    throw new Error('Stable qualification gate_receipts must bind every gate to an evidence digest.');
  }
  const receiptGates = Object.keys(qualification.gate_receipts).sort();
  if (JSON.stringify(receiptGates) !== JSON.stringify(stableQualificationGates)) {
    throw new Error('Stable qualification gate_receipts must contain the complete Stable gate set.');
  }
  for (const gate of stableQualificationGates) {
    digest(qualification.gate_receipts[gate], `Stable qualification ${gate} receipt`);
  }

  const core = {
    schema: 'opl_app_quality_promotion_receipt.v1',
    status: 'passed',
    operation: 'promote_quality',
    generated_at: input.generatedAt ?? new Date().toISOString(),
    subject: {
      version: manifest.version,
      release_tag: manifest.release_tag,
      source_commit: manifest.source_commit,
      component_manifest_digest: declaredManifestDigest,
      component_manifest_sha256: sha256File(input.componentManifestPath),
      artifact,
    },
    source_classification: {
      quality_status: 'preview',
      build_trigger: buildTrigger,
      preview_kind: previewKind,
      non_stable_notice: true,
    },
    promoted_classification: {
      quality_status: 'stable',
      build_trigger: buildTrigger,
      preview_kind: null,
      source_preview_kind_preserved_as_provenance: true,
    },
    qualification: {
      stable_qualified: true,
      stable_qualification_receipt_sha256: sha256File(input.stableQualificationPath),
      passed_gates: passedGates,
      skipped_gates: [],
      failed_gates: [],
    },
    invariants: {
      same_exact_artifact_digest: true,
      immutable_manifest_rewrite: false,
      latest_pointer_mutation: false,
      promotion_receipt_is_separate_authority: true,
    },
  };
  return {
    ...core,
    receipt_digest: sha256Bytes(JSON.stringify(core)),
  };
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      'component-manifest': { type: 'string' },
      'stable-qualification': { type: 'string' },
      'generated-at': { type: 'string' },
      output: { type: 'string' },
    },
  });
  if (!values['component-manifest'] || !values['stable-qualification'] || !values.output) {
    throw new Error(
      'Pass --component-manifest <json> --stable-qualification <json> --output <json>.',
    );
  }
  const receipt = validateReleaseQualityPromotion({
    componentManifestPath: values['component-manifest'],
    stableQualificationPath: values['stable-qualification'],
    generatedAt: values['generated-at'],
  });
  const output = path.resolve(values.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    status: 'passed',
    output,
    receipt_digest: receipt.receipt_digest,
  })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
