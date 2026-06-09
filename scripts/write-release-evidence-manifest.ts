#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAppReleaseL5EvidenceReadout,
  validateAppReleaseL5ReadoutContract,
} from './app-release-l5-readout.ts';
import {
  buildReleaseEvidenceCohort,
  releaseCohortFromRemoteVerification,
  unknownReleaseEvidenceCohort,
} from './release-evidence-cohort.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseContractPath = path.join(appRoot, 'contracts', 'app-release-channel.json');
const evidenceBoundary = 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority';

function parseArgs(argv) {
  const parsed = {
    bundleDir: process.env.OPL_RELEASE_EVIDENCE_BUNDLE_DIR || '',
    classificationPath: process.env.OPL_RELEASE_EVIDENCE_CLASSIFICATION || '',
    version: process.env.OPL_RELEASE_VERSION || '',
    tag: process.env.OPL_RELEASE_TAG || '',
    overwrite: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--overwrite') {
      parsed.overwrite = true;
      continue;
    }
    const value = argv[index + 1];
    if (token === '--bundle-dir') {
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --bundle-dir');
      }
      parsed.bundleDir = value;
      index += 1;
      continue;
    }
    if (token === '--classification') {
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --classification');
      }
      parsed.classificationPath = value;
      index += 1;
      continue;
    }
    if (token === '--version') {
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --version');
      }
      parsed.version = value;
      index += 1;
      continue;
    }
    if (token === '--tag') {
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --tag');
      }
      parsed.tag = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!parsed.bundleDir.trim()) {
    throw new Error('Pass --bundle-dir <release-evidence-dir> or set OPL_RELEASE_EVIDENCE_BUNDLE_DIR.');
  }
  return {
    bundleDir: path.resolve(parsed.bundleDir),
    classificationPath: parsed.classificationPath.trim()
      ? path.resolve(parsed.classificationPath)
      : '',
    version: parsed.version.trim(),
    tag: parsed.tag.trim(),
    overwrite: parsed.overwrite,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveBundlePath(bundleDir, artifactPath) {
  if (path.isAbsolute(artifactPath)) {
    throw new Error(`Evidence artifact path must be relative: ${artifactPath}`);
  }
  const resolved = path.resolve(bundleDir, artifactPath);
  const relative = path.relative(bundleDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Evidence artifact path escapes bundle root: ${artifactPath}`);
  }
  return resolved;
}

function missingReasonFor(artifact) {
  if (artifact.id === 'first_run_vm_summary') {
    return 'clean first-run VM smoke summary was not generated for this bundle';
  }
  if (artifact.id === 'guest_smoke_summary') {
    return 'packaged GUI first-run guest smoke summary was not generated for this bundle';
  }
  if (artifact.id === 'assistant_route_smoke_summary') {
    return 'packaged GUI assistant route smoke summary was not generated for this bundle';
  }
  if (artifact.id === 'remote_release_verification') {
    return 'remote release verification JSON was not generated for this bundle';
  }
  return `${artifact.producer} output was not generated for this bundle`;
}

function readArtifactClassifications(classificationPath) {
  if (!classificationPath) {
    return new Map();
  }
  const payload = readJson(classificationPath);
  const records = Array.isArray(payload?.artifact_classifications)
    ? payload.artifact_classifications
    : Array.isArray(payload?.artifacts)
      ? payload.artifacts
      : null;
  if (!records) {
    throw new Error('Evidence classification file must declare artifact_classifications or artifacts array.');
  }

  const classifications = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error('Evidence classification entries must be objects.');
    }
    const id = String(record.id ?? '');
    const status = record.status;
    const reason = String(record.reason ?? record.missing_reason ?? '');
    if (!id.trim()) {
      throw new Error('Evidence classification entries must include id.');
    }
    if (status !== 'missing' && status !== 'typed_blocker' && status !== 'not_applicable') {
      throw new Error(`Evidence classification ${id}.status must be missing, typed_blocker, or not_applicable.`);
    }
    if (!reason.trim()) {
      throw new Error(`Evidence classification ${id} must include reason.`);
    }
    if (
      status === 'typed_blocker' &&
      (typeof record.typed_blocker_ref !== 'string' || !record.typed_blocker_ref.trim())
    ) {
      throw new Error(`Evidence classification ${id} typed_blocker must include typed_blocker_ref.`);
    }
    if (
      status === 'not_applicable' &&
      (typeof record.not_applicable_reason !== 'string' || !record.not_applicable_reason.trim())
    ) {
      throw new Error(`Evidence classification ${id} not_applicable must include not_applicable_reason.`);
    }
    classifications.set(id, {
      status,
      reason,
      ...(typeof record.typed_blocker_ref === 'string'
        ? { typed_blocker_ref: record.typed_blocker_ref }
        : {}),
      ...(typeof record.not_applicable_reason === 'string'
        ? { not_applicable_reason: record.not_applicable_reason }
        : {}),
    });
  }
  return classifications;
}

function readTypedBlocker(bundleDir, artifact) {
  const blockerPath = resolveBundlePath(bundleDir, path.join('typed-blockers', `${artifact.id}.json`));
  if (!fs.existsSync(blockerPath)) {
    return null;
  }
  const blocker = readJson(blockerPath);
  if (!blocker || typeof blocker !== 'object' || Array.isArray(blocker)) {
    throw new Error(`Typed blocker ${artifact.id} must be a JSON object.`);
  }
  const reason = String(blocker.reason ?? '');
  const typedBlockerRef = String(blocker.typed_blocker_ref ?? '');
  if (!reason.trim() || !typedBlockerRef.trim()) {
    throw new Error(`Typed blocker ${artifact.id} must include reason and typed_blocker_ref.`);
  }
  return {
    status: 'typed_blocker',
    reason,
    typed_blocker_ref: typedBlockerRef,
    typed_blocker_path: path.join('typed-blockers', `${artifact.id}.json`),
  };
}

function inferReleaseCohort(bundleDir, options) {
  if (options.version) {
    return buildReleaseEvidenceCohort({
      version: options.version,
      tag: options.tag,
      source: 'write-release-evidence-manifest',
    });
  }
  const remoteVerificationPath = resolveBundlePath(bundleDir, 'remote-release-verification.json');
  if (fs.existsSync(remoteVerificationPath)) {
    const remoteCohort = releaseCohortFromRemoteVerification(
      readJson(remoteVerificationPath),
      'remote_release_verification',
    );
    if (remoteCohort) {
      return remoteCohort;
    }
  }
  return unknownReleaseEvidenceCohort('release version was not provided and remote release verification has no version/tag yet');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const releaseContract = readJson(releaseContractPath);
  const bundle = releaseContract.operator_evidence_bundle;
  if (bundle?.manifest_path !== 'evidence-manifest.json') {
    throw new Error(`Unexpected release evidence manifest path: ${bundle?.manifest_path}`);
  }
  if (!Array.isArray(bundle.required_artifacts)) {
    throw new Error('Release evidence bundle contract must declare required_artifacts.');
  }
  validateAppReleaseL5ReadoutContract(bundle.l5_evidence_readout);
  const optionalDiagnosticArtifacts = Array.isArray(bundle.optional_diagnostic_artifacts)
    ? bundle.optional_diagnostic_artifacts
    : [];
  const classifications = readArtifactClassifications(options.classificationPath);
  const artifactIds = new Set(bundle.required_artifacts.map((artifact) => artifact.id));
  const unknownClassifications = [...classifications.keys()].filter((id) => !artifactIds.has(id));
  if (unknownClassifications.length > 0) {
    throw new Error(`Evidence classification file declares unknown artifact(s): ${unknownClassifications.join(', ')}`);
  }

  fs.mkdirSync(options.bundleDir, { recursive: true });
  const manifestPath = resolveBundlePath(options.bundleDir, bundle.manifest_path);
  if (fs.existsSync(manifestPath) && !options.overwrite) {
    throw new Error(`Evidence manifest already exists: ${manifestPath}. Pass --overwrite to replace it.`);
  }

  const artifacts = bundle.required_artifacts.map((artifact) => {
    const classification = classifications.get(artifact.id);
    const exists = fs.existsSync(resolveBundlePath(options.bundleDir, artifact.path));
    const typedBlocker = readTypedBlocker(options.bundleDir, artifact);
    if (classification) {
      return {
        id: artifact.id,
        path: artifact.path,
        kind: artifact.kind,
        producer: artifact.producer,
        source_kind: artifact.source_kind,
        status: classification.status,
        reason: classification.reason,
        ...(classification.status === 'missing'
          ? { missing_reason: classification.reason }
          : {}),
        ...(classification.status === 'typed_blocker'
          ? { typed_blocker_ref: classification.typed_blocker_ref }
          : {}),
        ...(classification.status === 'not_applicable'
          ? { not_applicable_reason: classification.not_applicable_reason }
          : {}),
      };
    }
    return {
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      producer: artifact.producer,
      source_kind: artifact.source_kind,
      status: exists ? 'present' : typedBlocker ? 'typed_blocker' : 'missing',
      ...(exists
        ? {}
        : typedBlocker
          ? {
              reason: typedBlocker.reason,
              typed_blocker_ref: typedBlocker.typed_blocker_ref,
              typed_blocker_path: typedBlocker.typed_blocker_path,
            }
          : { missing_reason: missingReasonFor(artifact) }),
    };
  });
  const missingEvidence = artifacts
    .filter((artifact) => artifact.status !== 'present' && !(artifact.status === 'typed_blocker' && artifact.typed_blocker_path))
    .map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      status: artifact.status,
      reason: artifact.reason ?? artifact.missing_reason,
      ...(artifact.typed_blocker_ref
        ? { typed_blocker_ref: artifact.typed_blocker_ref }
        : {}),
      ...(artifact.not_applicable_reason
        ? { not_applicable_reason: artifact.not_applicable_reason }
        : {}),
    }));
  const blockedEvidence = artifacts
    .filter((artifact) => artifact.status === 'typed_blocker' && artifact.typed_blocker_path)
    .map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      typed_blocker_path: artifact.typed_blocker_path,
    }));
  const diagnostics = optionalDiagnosticArtifacts
    .filter((artifact) => fs.existsSync(resolveBundlePath(options.bundleDir, artifact.path)))
    .map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      producer: artifact.producer,
      source_kind: artifact.source_kind,
      status: 'present',
    }));
  const releaseCohort = inferReleaseCohort(options.bundleDir, options);
  const manifest = {
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    release_cohort: releaseCohort,
    current_cohort_evidence: releaseCohort.current_cohort_evidence === true,
    status: blockedEvidence.length > 0 ? 'blocked_evidence' : missingEvidence.length > 0 ? 'missing_evidence' : 'passed',
    packaged_app_evidence: missingEvidence.length === 0 && blockedEvidence.length === 0,
    acceptance_path: bundle.acceptance_path,
    runtime_page_contract: bundle.runtime_page_contract,
    refs_only: bundle.refs_only,
    authority_boundary: evidenceBoundary,
    artifacts,
    diagnostics,
    missing_evidence: missingEvidence,
    blocked_evidence: blockedEvidence,
    l5_evidence_readout: buildAppReleaseL5EvidenceReadout({
      contract: bundle.l5_evidence_readout,
      artifacts,
      releaseCohort,
    }),
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    status: manifest.status,
    bundle_dir: options.bundleDir,
    manifest_path: path.relative(options.bundleDir, manifestPath),
    packaged_app_evidence: manifest.packaged_app_evidence,
    release_cohort: manifest.release_cohort,
    current_cohort_evidence: manifest.current_cohort_evidence,
    blocked_artifact_count: blockedEvidence.length,
    blocked_artifacts: blockedEvidence,
    missing_artifact_count: missingEvidence.length,
    missing_artifacts: missingEvidence,
    l5_evidence_readout: manifest.l5_evidence_readout,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
