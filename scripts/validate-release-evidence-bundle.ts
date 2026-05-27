#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseContractPath = path.join(appRoot, 'contracts', 'app-release-channel.json');
const evidenceBoundary = 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority';

type Options = {
  bundleDir: string;
  allowMissingEvidence: boolean;
};

type EvidenceArtifact = {
  id: string;
  path: string;
  kind: 'json' | 'image' | 'log';
  producer: string;
  source_kind: string;
};

type EvidenceContract = {
  manifestPath: string;
  artifacts: EvidenceArtifact[];
};

type ManifestArtifact = EvidenceArtifact & {
  status: 'present' | 'missing';
  missing_reason?: string;
};

function parseArgs(argv: string[]): Options {
  const parsed = {
    bundleDir: process.env.OPL_RELEASE_EVIDENCE_BUNDLE_DIR || '',
    allowMissingEvidence: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--allow-missing-evidence') {
      parsed.allowMissingEvidence = true;
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
    allowMissingEvidence: parsed.allowMissingEvidence,
  };
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertFile(filePath: string, label: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`${label} must be a file: ${filePath}`);
  }
}

function assertJsonFile(filePath: string, label: string) {
  assertFile(filePath, label);
  try {
    return readJson(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} must be valid JSON: ${message}`);
  }
}

function assertImageFile(filePath: string, label: string) {
  assertFile(filePath, label);
  if (!/\.(png|jpg|jpeg|webp)$/i.test(filePath)) {
    throw new Error(`${label} must be a screenshot image file: ${filePath}`);
  }
  const header = fs.readFileSync(filePath).subarray(0, 12);
  const extension = path.extname(filePath).toLowerCase();
  const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isWebp = header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
  if ((extension === '.png' && !isPng) || (['.jpg', '.jpeg'].includes(extension) && !isJpeg) || (extension === '.webp' && !isWebp)) {
    throw new Error(`${label} must contain real screenshot image bytes: ${filePath}`);
  }
}

function assertLogFile(filePath: string, label: string) {
  assertFile(filePath, label);
  if (!fs.readFileSync(filePath, 'utf8').trim()) {
    throw new Error(`${label} must not be empty: ${filePath}`);
  }
}

function resolveBundlePath(bundleDir: string, artifactPath: string) {
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

function validateJsonEvidenceShape(artifact: EvidenceArtifact, payload: unknown) {
  const record = asRecord(payload, artifact.id);
  if (artifact.id === 'app_state_summary' || artifact.id === 'app_state_full') {
    const appState = asRecord(record.app_state, `${artifact.id}.app_state`);
    if (appState.schema !== 'opl_app_state.v1' && appState.schema_version !== 'opl_app_state.v1') {
      throw new Error(`${artifact.id} must be real OPL App state JSON with schema opl_app_state.v1.`);
    }
    if (artifact.id === 'app_state_summary' && appState.profile !== 'fast') {
      throw new Error('app_state_summary must use the fast OPL App state profile.');
    }
    if (artifact.id === 'app_state_full' && appState.profile !== 'full') {
      throw new Error('app_state_full must use the full OPL App state profile.');
    }
    if (!appState.operator || typeof appState.operator !== 'object') {
      throw new Error(`${artifact.id} must include operator state from OPL.`);
    }
    if (!appState.provider || typeof appState.provider !== 'object') {
      throw new Error(`${artifact.id} must include provider state from OPL.`);
    }
  }
  if (artifact.id === 'drilldown_full') {
    const drilldown = asRecord(record.app_operator_drilldown, `${artifact.id}.app_operator_drilldown`);
    if (drilldown.surface_kind !== 'opl_app_operator_drilldown_read_model') {
      throw new Error(`${artifact.id} must be an OPL App/operator drilldown read model.`);
    }
    if (drilldown.detail_level !== 'full') {
      throw new Error('drilldown_full must be full-detail App/operator drilldown JSON.');
    }
    if (!drilldown.summary || typeof drilldown.summary !== 'object') {
      throw new Error(`${artifact.id} must include App/operator drilldown summary.`);
    }
  }
  if (artifact.id === 'action_dry_run_result' || artifact.id === 'action_execute_result') {
    const execution = asRecord(record.app_action_execution, `${artifact.id}.app_action_execution`);
    if (execution.surface_kind !== 'opl_app_action_execution') {
      throw new Error(`${artifact.id} must be an OPL App action execution JSON result.`);
    }
    if (typeof execution.action_id !== 'string' || !execution.action_id.trim()) {
      throw new Error(`${artifact.id} must include action_id.`);
    }
    if (artifact.id === 'action_dry_run_result' && execution.dry_run !== true) {
      throw new Error('action_dry_run_result must be a dry-run execution result.');
    }
    if (artifact.id === 'action_execute_result' && execution.dry_run !== false) {
      throw new Error('action_execute_result must be a non-dry-run execution result.');
    }
    if (!execution.execution || typeof execution.execution !== 'object') {
      throw new Error(`${artifact.id} must include execution details.`);
    }
    if (!execution.authority_boundary || typeof execution.authority_boundary !== 'object') {
      throw new Error(`${artifact.id} must include authority_boundary.`);
    }
  }
  if (artifact.id === 'settings_smoke') {
    if (record.status !== 'passed') {
      throw new Error('settings_smoke must be a passed settings smoke JSON artifact.');
    }
    if (!Array.isArray(record.pages_checked) || record.pages_checked.length === 0) {
      throw new Error('settings_smoke must report checked Settings pages.');
    }
  }
  if (artifact.id === 'remote_release_verification') {
    if (record.status !== 'passed') {
      throw new Error('remote_release_verification must be a passed remote release verification summary.');
    }
    if (record.include_full_package !== true) {
      throw new Error('remote_release_verification must include the Full first-install package check.');
    }
    if (!Number.isSafeInteger(record.verified_asset_count) || Number(record.verified_asset_count) <= 0) {
      throw new Error('remote_release_verification must report verified release assets.');
    }
    if (!record.full_first_install_budget || typeof record.full_first_install_budget !== 'object') {
      throw new Error('remote_release_verification must report the Full first-install budget check.');
    }
  }
}

function validateContractBoundary(bundle: unknown): EvidenceContract {
  const record = bundle as {
    purpose?: unknown;
    manifest_path?: unknown;
    acceptance_path?: unknown;
    refs_only?: unknown;
    required_artifacts?: unknown;
    forbidden_authority?: unknown;
    missing_evidence_policy?: Record<string, unknown>;
  };
  if (record.purpose !== 'runtime_page_operator_evidence_acceptance') {
    throw new Error(`Unexpected operator evidence bundle purpose: ${String(record.purpose)}`);
  }
  if (record.manifest_path !== 'evidence-manifest.json') {
    throw new Error(`Unexpected operator evidence manifest path: ${String(record.manifest_path)}`);
  }
  if (record.acceptance_path !== 'Runtime page') {
    throw new Error(`Unexpected operator evidence bundle acceptance path: ${String(record.acceptance_path)}`);
  }
  if (record.refs_only !== true) {
    throw new Error('Operator evidence bundle must be refs-only.');
  }
  if (record.missing_evidence_policy?.default_validation !== 'fail_closed') {
    throw new Error('Operator evidence bundle missing evidence policy must fail closed by default.');
  }
  if (record.missing_evidence_policy?.allow_missing_evidence_flag !== '--allow-missing-evidence') {
    throw new Error('Operator evidence bundle missing evidence policy must declare --allow-missing-evidence.');
  }
  if (record.missing_evidence_policy?.missing_status !== 'missing_evidence') {
    throw new Error('Operator evidence bundle missing evidence policy must declare missing_evidence status.');
  }
  if (record.missing_evidence_policy?.packaged_app_evidence_requires !== 'all_required_artifacts_present_and_verified') {
    throw new Error('Operator evidence bundle must require all artifacts before claiming packaged App evidence.');
  }
  if (!Array.isArray(record.required_artifacts) || record.required_artifacts.length === 0) {
    throw new Error('Operator evidence bundle must declare required artifacts.');
  }
  const forbiddenAuthority = Array.isArray(record.forbidden_authority) ? record.forbidden_authority : [];
  for (const forbidden of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    if (!forbiddenAuthority.includes(forbidden)) {
      throw new Error(`Operator evidence bundle must exclude ${forbidden}`);
    }
  }
  for (const artifact of record.required_artifacts as EvidenceArtifact[]) {
    if (!artifact.id || !artifact.path || !artifact.kind || !artifact.producer || !artifact.source_kind) {
      throw new Error(`Invalid operator evidence artifact contract: ${JSON.stringify(artifact)}`);
    }
  }
  return {
    manifestPath: record.manifest_path,
    artifacts: record.required_artifacts as EvidenceArtifact[],
  };
}

function validateManifestArtifact(manifestArtifact: unknown, expected: EvidenceArtifact): ManifestArtifact {
  const artifact = asRecord(manifestArtifact, `manifest artifact ${expected.id}`);
  for (const key of ['id', 'path', 'kind', 'producer', 'source_kind'] as const) {
    if (artifact[key] !== expected[key]) {
      throw new Error(`Manifest artifact ${expected.id}.${key} must match release contract.`);
    }
  }
  if (artifact.status !== 'present' && artifact.status !== 'missing') {
    throw new Error(`Manifest artifact ${expected.id}.status must be present or missing.`);
  }
  if (artifact.status === 'missing' && typeof artifact.missing_reason !== 'string') {
    throw new Error(`Manifest artifact ${expected.id} must explain missing_reason.`);
  }
  return artifact as ManifestArtifact;
}

function validateMissingEvidenceList(manifest: Record<string, unknown>, missingArtifacts: ManifestArtifact[]) {
  const missingEvidence = manifest.missing_evidence;
  if (!Array.isArray(missingEvidence)) {
    throw new Error('Evidence manifest must declare missing_evidence array.');
  }
  const missingIds = new Set(missingArtifacts.map((artifact) => artifact.id));
  const declaredIds = new Set();
  for (const entry of missingEvidence) {
    const record = asRecord(entry, 'missing evidence entry');
    if (typeof record.id !== 'string' || typeof record.path !== 'string' || typeof record.reason !== 'string') {
      throw new Error('Missing evidence entries must include id, path, and reason.');
    }
    declaredIds.add(record.id);
  }
  if (declaredIds.size !== missingIds.size || [...missingIds].some((id) => !declaredIds.has(id))) {
    throw new Error('Evidence manifest missing_evidence must match missing artifact statuses.');
  }
}

function validateBundle(bundleDir: string, options: Options) {
  const releaseContract = readJson(releaseContractPath);
  const contract = validateContractBoundary(releaseContract.operator_evidence_bundle);
  const manifestPath = resolveBundlePath(bundleDir, contract.manifestPath);
  const manifest = asRecord(assertJsonFile(manifestPath, 'evidence-manifest'), 'evidence-manifest');

  if (manifest.schema_version !== 1) {
    throw new Error(`Evidence manifest schema_version must be 1; got ${String(manifest.schema_version)}`);
  }
  if (manifest.purpose !== 'app_release_evidence_bundle') {
    throw new Error(`Unexpected evidence manifest purpose: ${String(manifest.purpose)}`);
  }
  if (manifest.acceptance_path !== 'Runtime page') {
    throw new Error(`Unexpected evidence manifest acceptance_path: ${String(manifest.acceptance_path)}`);
  }
  if (manifest.runtime_page_contract !== 'contracts/app-page-state-matrix.json#runtime') {
    throw new Error(`Unexpected evidence manifest runtime_page_contract: ${String(manifest.runtime_page_contract)}`);
  }
  if (manifest.refs_only !== true) {
    throw new Error('Evidence manifest must be refs-only.');
  }
  if (manifest.authority_boundary !== evidenceBoundary) {
    throw new Error(`Evidence manifest authority_boundary must be ${evidenceBoundary}.`);
  }
  if (!Array.isArray(manifest.artifacts)) {
    throw new Error('Evidence manifest must declare artifacts array.');
  }

  const manifestArtifacts = new Map(
    manifest.artifacts.map((entry) => {
      const record = asRecord(entry, 'evidence manifest artifact');
      return [record.id, entry];
    }),
  );
  const unexpectedIds = [...manifestArtifacts.keys()].filter((id) => !contract.artifacts.some((artifact) => artifact.id === id));
  if (unexpectedIds.length > 0) {
    throw new Error(`Evidence manifest declares unknown artifact(s): ${unexpectedIds.join(', ')}`);
  }

  const verified: ManifestArtifact[] = [];
  const missing: ManifestArtifact[] = [];

  for (const expected of contract.artifacts) {
    const entry = manifestArtifacts.get(expected.id);
    if (!entry) {
      throw new Error(`Evidence manifest is missing artifact ${expected.id}`);
    }
    const artifact = validateManifestArtifact(entry, expected);
    if (artifact.status === 'missing') {
      missing.push(artifact);
      continue;
    }

    const filePath = resolveBundlePath(bundleDir, artifact.path);
    if (artifact.kind === 'json') {
      validateJsonEvidenceShape(artifact, assertJsonFile(filePath, artifact.id));
    } else if (artifact.kind === 'image') {
      assertImageFile(filePath, artifact.id);
    } else if (artifact.kind === 'log') {
      assertLogFile(filePath, artifact.id);
    } else {
      throw new Error(`Unsupported operator evidence artifact kind: ${artifact.kind}`);
    }
    verified.push(artifact);
  }

  if (missing.length > 0) {
    if (manifest.status !== 'missing_evidence') {
      throw new Error('Evidence manifest status must be missing_evidence when required artifacts are missing.');
    }
    if (manifest.packaged_app_evidence !== false) {
      throw new Error('Evidence manifest must set packaged_app_evidence=false while evidence is missing.');
    }
    validateMissingEvidenceList(manifest, missing);
    if (!options.allowMissingEvidence) {
      throw new Error(
        `Release evidence bundle is missing required evidence and cannot be used as packaged App evidence: ${missing.map((artifact) => artifact.id).join(', ')}`,
      );
    }
  } else {
    if (manifest.status !== 'passed') {
      throw new Error('Evidence manifest status must be passed when all required artifacts are present.');
    }
    if (manifest.packaged_app_evidence !== true) {
      throw new Error('Evidence manifest must set packaged_app_evidence=true only when all artifacts are present and verified.');
    }
    validateMissingEvidenceList(manifest, []);
  }

  return {
    status: missing.length > 0 ? 'missing_evidence' : 'passed',
    bundle_dir: bundleDir,
    manifest_path: contract.manifestPath,
    packaged_app_evidence: missing.length === 0,
    evidence_boundary: evidenceBoundary,
    verified_artifact_count: verified.length,
    verified_artifacts: verified.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      producer: artifact.producer,
      source_kind: artifact.source_kind,
      status: artifact.status,
    })),
    missing_artifact_count: missing.length,
    missing_artifacts: missing.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      producer: artifact.producer,
      source_kind: artifact.source_kind,
      status: artifact.status,
      missing_reason: artifact.missing_reason,
    })),
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  console.log(`${JSON.stringify(validateBundle(options.bundleDir, options), null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
