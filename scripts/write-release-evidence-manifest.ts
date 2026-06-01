#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseContractPath = path.join(appRoot, 'contracts', 'app-release-channel.json');
const evidenceBoundary = 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority';

function parseArgs(argv) {
  const parsed = {
    bundleDir: process.env.OPL_RELEASE_EVIDENCE_BUNDLE_DIR || '',
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
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!parsed.bundleDir.trim()) {
    throw new Error('Pass --bundle-dir <release-evidence-dir> or set OPL_RELEASE_EVIDENCE_BUNDLE_DIR.');
  }
  return {
    bundleDir: path.resolve(parsed.bundleDir),
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

function readTypedBlocker(bundleDir, artifact) {
  const blockerPath = resolveBundlePath(bundleDir, path.join('typed-blockers', `${artifact.id}.json`));
  if (!fs.existsSync(blockerPath)) return null;
  return readJson(blockerPath);
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

  fs.mkdirSync(options.bundleDir, { recursive: true });
  const manifestPath = resolveBundlePath(options.bundleDir, bundle.manifest_path);
  if (fs.existsSync(manifestPath) && !options.overwrite) {
    throw new Error(`Evidence manifest already exists: ${manifestPath}. Pass --overwrite to replace it.`);
  }

  const artifacts = bundle.required_artifacts.map((artifact) => {
    const exists = fs.existsSync(resolveBundlePath(options.bundleDir, artifact.path));
    const typedBlocker = readTypedBlocker(options.bundleDir, artifact);
    return {
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      producer: artifact.producer,
      source_kind: artifact.source_kind,
      status: exists ? 'present' : typedBlocker ? 'blocked' : 'missing',
      ...(exists
        ? {}
        : typedBlocker
          ? { typed_blocker_path: path.join('typed-blockers', `${artifact.id}.json`) }
          : { missing_reason: missingReasonFor(artifact) }),
    };
  });
  const missingEvidence = artifacts
    .filter((artifact) => artifact.status === 'missing')
    .map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      reason: artifact.missing_reason,
    }));
  const blockedEvidence = artifacts
    .filter((artifact) => artifact.status === 'blocked')
    .map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      typed_blocker_path: artifact.typed_blocker_path,
    }));
  const manifest = {
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: blockedEvidence.length > 0 ? 'blocked_evidence' : missingEvidence.length > 0 ? 'missing_evidence' : 'passed',
    packaged_app_evidence: missingEvidence.length === 0 && blockedEvidence.length === 0,
    acceptance_path: bundle.acceptance_path,
    runtime_page_contract: bundle.runtime_page_contract,
    refs_only: bundle.refs_only,
    authority_boundary: evidenceBoundary,
    artifacts,
    missing_evidence: missingEvidence,
    blocked_evidence: blockedEvidence,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    status: manifest.status,
    bundle_dir: options.bundleDir,
    manifest_path: path.relative(options.bundleDir, manifestPath),
    packaged_app_evidence: manifest.packaged_app_evidence,
    blocked_artifact_count: blockedEvidence.length,
    blocked_artifacts: blockedEvidence,
    missing_artifact_count: missingEvidence.length,
    missing_artifacts: missingEvidence,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
