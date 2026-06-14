#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetStatus, percent } from './release-size-reporting.ts';
import {
  buildAppReleaseL5EvidenceReadout,
  readAppReleaseL5ReadoutContract,
} from './app-release-l5-readout.ts';
import {
  buildAppReleaseOwnerVerdictReadout,
  readAppReleaseOwnerVerdictContract,
} from './app-release-owner-verdict.ts';
import { buildReleaseEvidenceCohort } from './release-evidence-cohort.ts';
import { findFileByName, writeLinesFile } from './release-file-helpers.ts';
import { arrayOrEmpty, recordOrNull } from './release-json-helpers.ts';
import {
  applySharedReleaseReadinessArg,
  applyStringOptionArg,
  assertSharedReleaseReadinessOptions,
  buildSharedReleaseReadinessOptions,
} from './release-readiness-args.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type GateStatus = 'passed' | 'failed' | 'skipped';

type GateSummary = {
  status: GateStatus;
  required: boolean;
  job_name?: string;
  job_result?: string;
  artifact_name?: string;
  artifact_path?: string;
  reason?: string;
  fields?: Record<string, unknown>;
};

type Options = {
  version: string;
  releaseMode: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  artifactsDir: string;
  jobResultsPath: string;
  output: string;
  markdown: string;
};

function parseBoolean(value: string | undefined, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    ...buildSharedReleaseReadinessOptions(parseBoolean),
    artifactsDir: process.env.OPL_RELEASE_READINESS_ARTIFACTS_DIR || '',
    jobResultsPath: process.env.OPL_RELEASE_READINESS_JOB_RESULTS || '',
    output: process.env.OPL_RELEASE_READINESS_OUTPUT || '',
    markdown: process.env.OPL_RELEASE_READINESS_MARKDOWN || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const sharedIndex = applySharedReleaseReadinessArg(argv, index, parsed, parseBoolean);
    if (sharedIndex !== null) {
      index = sharedIndex;
      continue;
    }
    const optionIndex = applyStringOptionArg(argv, index, {
      '--artifacts-dir': (value) => { parsed.artifactsDir = value; },
      '--job-results': (value) => { parsed.jobResultsPath = value; },
      '--output': (value) => { parsed.output = value; },
      '--markdown': (value) => { parsed.markdown = value; },
    });
    if (optionIndex !== null) {
      index = optionIndex;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  assertSharedReleaseReadinessOptions(parsed);
  if (!parsed.artifactsDir.trim()) throw new Error('Pass --artifacts-dir <dir> or set OPL_RELEASE_READINESS_ARTIFACTS_DIR.');
  return {
    ...parsed,
    artifactsDir: path.resolve(parsed.artifactsDir),
    jobResultsPath: parsed.jobResultsPath ? path.resolve(parsed.jobResultsPath) : '',
    output: parsed.output ? path.resolve(parsed.output) : path.resolve(appRoot, 'release-readiness-summary.json'),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
  };
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function artifactDir(options: Options, artifactName: string) {
  return path.join(options.artifactsDir, artifactName);
}

function readJobResults(options: Options) {
  if (!options.jobResultsPath || !fs.existsSync(options.jobResultsPath)) {
    return {};
  }
  const payload = readJson(options.jobResultsPath);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Release readiness job results must be a JSON object.');
  }
  return payload as Record<string, string>;
}

function applyJobResult(gate: GateSummary, jobResults: Record<string, string>, jobName: string, required: boolean): GateSummary {
  const result = jobResults[jobName] || 'unknown';
  const expectedSkipped = !required && result === 'skipped';
  const passed = result === 'success' || expectedSkipped;
  const status = passed ? gate.status : required ? 'failed' : 'skipped';
  const reason = passed
    ? gate.reason
    : gate.reason
      ? `Workflow job ${jobName} result is ${result}; expected ${required ? 'success' : 'success or skipped'}. ${gate.reason}`
      : `Workflow job ${jobName} result is ${result}; expected ${required ? 'success' : 'success or skipped'}.`;
  return {
    ...gate,
    status,
    required,
    job_name: jobName,
    job_result: result,
    reason,
  };
}

function missingGate(required: boolean, artifactName: string, reason: string): GateSummary {
  return {
    status: required ? 'failed' : 'skipped',
    required,
    artifact_name: artifactName,
    reason,
  };
}

function jsonGate(options: Options, gate: {
  required: boolean;
  artifactName: string;
  fileName: string;
  validate: (payload: Record<string, unknown>) => { fields?: Record<string, unknown>; reason?: string };
}): GateSummary {
  const root = artifactDir(options, gate.artifactName);
  const filePath = findFileByName(root, gate.fileName);
  if (!filePath) {
    return missingGate(gate.required, gate.artifactName, `Missing ${gate.fileName} in ${gate.artifactName}.`);
  }
  try {
    const payload = readJson(filePath);
    const record = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const result = gate.validate(record);
    if (result.reason) {
      return {
        status: gate.required ? 'failed' : 'skipped',
        required: gate.required,
        artifact_name: gate.artifactName,
        artifact_path: path.relative(options.artifactsDir, filePath),
        reason: result.reason,
        fields: result.fields,
      };
    }
    return {
      status: 'passed',
      required: gate.required,
      artifact_name: gate.artifactName,
      artifact_path: path.relative(options.artifactsDir, filePath),
      fields: result.fields,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: gate.required ? 'failed' : 'skipped',
      required: gate.required,
      artifact_name: gate.artifactName,
      artifact_path: path.relative(options.artifactsDir, filePath),
      reason: message,
    };
  }
}

function textArtifactGate(options: Options, gate: {
  required: boolean;
  artifactName: string;
  files: string[];
}): GateSummary {
  const root = artifactDir(options, gate.artifactName);
  const foundFiles = gate.files.map((fileName) => findFileByName(root, fileName));
  const missing = gate.files.filter((_, index) => !foundFiles[index]);
  if (missing.length > 0) {
    return missingGate(gate.required, gate.artifactName, `Missing ${missing.join(', ')} in ${gate.artifactName}.`);
  }
  const sizePath = foundFiles[gate.files.indexOf('opl-webui-image-size-bytes.txt')];
  const imageSizeBytes = sizePath ? Number(fs.readFileSync(sizePath, 'utf8').trim()) : null;
  return {
    status: 'passed',
    required: gate.required,
    artifact_name: gate.artifactName,
    artifact_path: foundFiles.map((filePath) => path.relative(options.artifactsDir, filePath as string)).join(', '),
    fields: {
      files: gate.files,
      image_size_bytes: Number.isFinite(imageSizeBytes) ? imageSizeBytes : null,
    },
  };
}

function statusString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function statusOf(record: Record<string, unknown> | null) {
  if (!record) return 'missing';
  return typeof record.status === 'string' ? record.status : 'unknown';
}

function numberField(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function objectField(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function arrayField(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function summarizeFullSizeBudget(remoteGate: GateSummary) {
  const budget = objectField(remoteGate.fields ?? null, 'full_first_install_budget');
  if (!budget) return null;
  const fullDmgSizeBytes = numberField(budget, 'full_dmg_size_bytes');
  const warningFullDmgBytes = numberField(budget, 'warning_full_dmg_bytes') ?? 600000000;
  const explicitFullDmgSizeStatus = typeof budget.full_dmg_size_status === 'string'
    ? budget.full_dmg_size_status
    : null;
  const fullDmgSizeStatus = explicitFullDmgSizeStatus
    ?? (fullDmgSizeBytes !== null && warningFullDmgBytes !== null
      ? fullDmgSizeBytes >= warningFullDmgBytes
        ? 'warning'
        : 'passed'
      : null);
  return {
    ...budget,
    warning_full_dmg_bytes: warningFullDmgBytes,
    full_dmg_size_status: fullDmgSizeStatus,
  };
}

function warningsFromFullSizeBudget(sizeBudget: Record<string, unknown> | null) {
  if (!sizeBudget) return [];
  const explicitWarnings = arrayField(sizeBudget, 'warnings')
    .filter((warning) => warning && typeof warning === 'object' && !Array.isArray(warning));
  if (explicitWarnings.length > 0) return explicitWarnings;
  if (sizeBudget.full_dmg_size_status !== 'warning') return [];
  return [{
    code: 'full_dmg_size_warning',
    message: `Full DMG size ${String(sizeBudget.full_dmg_size_bytes)} is above warning threshold ${String(sizeBudget.warning_full_dmg_bytes)}.`,
  }];
}

function summarizeRuntimeCacheEvents(payload: Record<string, unknown> | null) {
  const events = arrayField(payload, 'events')
    .filter((event) => event && typeof event === 'object' && !Array.isArray(event)) as Record<string, unknown>[];
  const layerStatusCounts: Record<string, number> = {};
  const missWrittenLayers: string[] = [];
  const writtenLayers: string[] = [];
  for (const event of events) {
    const status = typeof event.status === 'string' ? event.status : 'unknown';
    const layerId = typeof event.layer_id === 'string' ? event.layer_id : 'unknown';
    layerStatusCounts[status] = (layerStatusCounts[status] ?? 0) + 1;
    if (status === 'miss_written') missWrittenLayers.push(layerId);
    if (event.write_archive === true) writtenLayers.push(layerId);
  }
  return {
    mode: typeof payload?.mode === 'string' ? payload.mode : null,
    dir: typeof payload?.dir === 'string' ? payload.dir : null,
    layer_status_counts: layerStatusCounts,
    miss_written_layers: missWrittenLayers,
    miss_written_count: missWrittenLayers.length,
    written_layers: writtenLayers,
    written_layer_count: writtenLayers.length,
  };
}

function fullSizeEntries(source: unknown, totalRuntimeBytes: number | null, limit = 8) {
  const record = recordOrNull(source);
  return Object.entries(record ?? {})
    .map(([id, value]) => {
      const entry = recordOrNull(value);
      const sizeBytes = numberField(entry, 'size_bytes');
      return {
        id,
        size_bytes: sizeBytes,
        runtime_percent: sizeBytes !== null && totalRuntimeBytes !== null ? percent(sizeBytes, totalRuntimeBytes) : null,
      };
    })
    .filter((entry) => entry.size_bytes !== null)
    .sort((left, right) => Number(right.size_bytes) - Number(left.size_bytes))
    .slice(0, limit)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
}

function buildManifestSizeAnalysis(
  manifest: Record<string, unknown> | null,
  sizeBudget: Record<string, unknown> | null,
) {
  if (!manifest) return null;
  const sizeBreakdown = objectField(manifest, 'size_breakdown');
  const budget = objectField(manifest, 'size_budget');
  const totalRuntimeBytes = numberField(sizeBreakdown, 'total_runtime_uncompressed_bytes');
  const maxRuntimeBytes = numberField(budget, 'max_runtime_uncompressed_bytes');
  const warningFullDmgBytes = numberField(sizeBudget, 'warning_full_dmg_bytes') ?? numberField(budget, 'warning_full_dmg_bytes');
  const maxFullDmgBytes = numberField(sizeBudget, 'max_full_dmg_bytes') ?? numberField(budget, 'max_full_dmg_bytes');
  const fullDmgSizeBytes = numberField(sizeBudget, 'full_dmg_size_bytes');
  const layers = fullSizeEntries(objectField(sizeBreakdown, 'layers'), totalRuntimeBytes);
  const components = fullSizeEntries(objectField(manifest, 'components'), totalRuntimeBytes);
  const candidates = [...layers.map((entry) => ({ kind: 'layer', reason: 'largest_runtime_layer', ...entry })), ...components.map((entry) => ({ kind: 'component', reason: 'largest_packaged_component', ...entry }))]
    .sort((left, right) => Number(right.size_bytes) - Number(left.size_bytes))
    .slice(0, 8)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  return {
    schema: 'opl_full_package_size_summary.v1',
    source: 'derived_from_full_package_manifest',
    budget: {
      compressed_full_dmg: {
        measurement_source: 'remote_release_verification_asset_size_bytes',
        full_dmg_size_bytes: fullDmgSizeBytes,
        warning_full_dmg_bytes: warningFullDmgBytes,
        max_full_dmg_bytes: maxFullDmgBytes,
        warning_status: budgetStatus(fullDmgSizeBytes, warningFullDmgBytes, 'warning_at_or_above'),
        review_threshold_status: budgetStatus(fullDmgSizeBytes, maxFullDmgBytes, 'review_above'),
        release_blocking: false,
      },
      runtime_uncompressed: {
        measurement_source: 'full-package-manifest.json#size_breakdown.total_runtime_uncompressed_bytes',
        total_runtime_uncompressed_bytes: totalRuntimeBytes,
        max_runtime_uncompressed_bytes: maxRuntimeBytes,
        status: budgetStatus(totalRuntimeBytes, maxRuntimeBytes, 'fail_above'),
        used_percent: totalRuntimeBytes !== null && maxRuntimeBytes !== null ? percent(totalRuntimeBytes, maxRuntimeBytes) : null,
        release_blocking: true,
      },
    },
    top_contributors: {
      layers,
      components,
      manifest_size_hotspots: [],
    },
    optimization_candidates: candidates,
  };
}

function stringField(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : null;
}

function basenameFromUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    const name = path.basename(parsed.pathname);
    return name || null;
  } catch {
    const name = path.basename(value);
    return name || null;
  }
}

function remoteAssetDigestByName(remoteGate: GateSummary, assetName: string | null) {
  if (!assetName) return null;
  const verifiedAssets = arrayField(remoteGate.fields ?? null, 'verified_assets')
    .filter((asset) => asset && typeof asset === 'object' && !Array.isArray(asset)) as Record<string, unknown>[];
  const matched = verifiedAssets.find((asset) => asset.name === assetName);
  return stringField(matched, 'sha256');
}

function validateHomebrewDigestCoherence(
  payload: Record<string, unknown>,
  remoteGate: GateSummary,
  fields: Record<string, unknown>,
) {
  const assetName = basenameFromUrl(payload.download_url);
  const checksumSha256 = stringField(payload, 'checksum_sha256');
  const remoteAssetSha256 = remoteAssetDigestByName(remoteGate, assetName);
  fields.download_url = payload.download_url ?? null;
  fields.download_asset_name = assetName;
  fields.checksum_sha256 = checksumSha256;
  fields.remote_asset_sha256 = remoteAssetSha256;
  if (!assetName) return 'Homebrew tap plan is missing a release asset download_url.';
  if (!checksumSha256) return 'Homebrew tap plan is missing checksum_sha256.';
  if (!/^[a-f0-9]{64}$/i.test(checksumSha256)) return `Homebrew checksum ${checksumSha256} is not a 64-character SHA-256 digest.`;
  if (!remoteAssetSha256) return `Remote verification did not include asset ${assetName} with sha256 evidence.`;
  if (checksumSha256.toLowerCase() !== remoteAssetSha256.toLowerCase()) {
    return `Homebrew checksum ${checksumSha256} does not match remote release digest ${remoteAssetSha256} for ${assetName}.`;
  }
  return null;
}

function readPreflightSummary(options: Options) {
  const artifactName = `release-preflight-summary-${options.version}`;
  const preflightPath = findFileByName(artifactDir(options, artifactName), 'release-preflight-summary.json');
  if (!preflightPath) return { artifactName, path: null, summary: null };
  const summary = readJson(preflightPath);
  return {
    artifactName,
    path: path.relative(options.artifactsDir, preflightPath),
    summary: objectField(summary, 'homebrew') ? summary as Record<string, unknown> : null,
  };
}

function summarizeHomebrewReadiness(options: Options, preflightSummary: Record<string, unknown> | null) {
  const homebrew = objectField(preflightSummary, 'homebrew');
  const releaseTarget = objectField(preflightSummary, 'release_target');
  const fallbackRequired = options.runVmSmoke && options.releaseMode === 'refresh_existing';
  if (!homebrew) {
    return {
      tap_update_required: fallbackRequired,
      tap_token_required: fallbackRequired,
      tap_update_owner: fallbackRequired
        ? 'desktop_release_after_remote_verification'
        : 'not_required_for_this_run',
      reason: fallbackRequired
        ? 'Preflight summary was unavailable; falling back to published-release refresh Homebrew requirement.'
        : 'Preflight summary was unavailable; Homebrew is not required for this run.',
      source: 'fallback_release_mode',
      release_target_kind: null,
    };
  }
  return {
    tap_update_required: homebrew.tap_update_required === true,
    tap_token_required: homebrew.tap_token_required === true,
    tap_update_owner: typeof homebrew.tap_update_owner === 'string' ? homebrew.tap_update_owner : null,
    reason: typeof homebrew.reason === 'string' ? homebrew.reason : null,
    source: 'release_preflight',
    release_target_kind: typeof releaseTarget?.kind === 'string' ? releaseTarget.kind : null,
  };
}

function buildSummary(options: Options) {
  const jobResults = readJobResults(options);
  const preflight = readPreflightSummary(options);
  const homebrewReadiness = summarizeHomebrewReadiness(options, preflight.summary);
  const remoteArtifactName = `remote-release-verification-${options.version}`;
  const standardVmArtifactName = `opl-first-run-vm-standard-${process.env.GITHUB_RUN_ID || 'local'}`;
  const homebrewVmArtifactName = `opl-first-run-vm-homebrew-standard-${process.env.GITHUB_RUN_ID || 'local'}`;
  const homebrewTapArtifactName = `homebrew-tap-plan-stable-app_standard-${options.version}`;
  const fullHomebrewTapArtifactName = `homebrew-tap-plan-stable-app_full_first_install-${options.version}`;
  const fullVmArtifactName = `opl-first-run-vm-full-${process.env.GITHUB_RUN_ID || 'local'}`;
  const oneShotArtifactName = `one-shot-app-installer-smoke-${options.version}`;
  const dockerArtifactName = `docker-webui-smoke-${options.version}`;
  const webuiGhcrArtifactName = `webui-ghcr-publish-${options.version}`;
  const fullTelemetryArtifactName = `opl-full-workflow-telemetry-${options.version}`;
  const fullDiagnosticsArtifactName = `opl-full-diagnostics-${options.version}`;

  const remoteGate = jsonGate(options, {
    required: true,
    artifactName: remoteArtifactName,
    fileName: 'remote-release-verification.json',
    validate: (payload) => {
      const includeFullPackage = payload.include_full_package === true;
      const fields = {
        include_full_package: payload.include_full_package,
        verified_asset_count: payload.verified_asset_count,
        verified_assets: payload.verified_assets ?? [],
        full_first_install_budget: payload.full_first_install_budget ?? null,
      };
      if (payload.status !== 'passed') return { reason: `Remote verification status is ${statusString(payload.status) || 'unknown'}.`, fields };
      if (options.includeFullPackage && !includeFullPackage) return { reason: 'Remote verification did not include the Full package.', fields };
      return { fields };
    },
  });

  const vmGate = (artifactName: string, profile: string, required: boolean) => jsonGate(options, {
    required,
    artifactName,
    fileName: 'tart-smoke-summary.json',
    validate: (payload) => {
      const fields = {
        runtime_profile: payload.runtime_profile,
        settings_smoke: payload.settings_smoke ?? null,
      };
      if (payload.status !== 'passed') return { reason: `VM smoke status is ${statusString(payload.status) || 'unknown'}.`, fields };
      if (payload.runtime_profile !== profile) return { reason: `Expected runtime_profile ${profile}, got ${String(payload.runtime_profile)}.`, fields };
      const settingsSmoke = payload.settings_smoke as Record<string, unknown> | undefined;
      if (!settingsSmoke || settingsSmoke.status !== 'passed') return { reason: 'VM smoke did not include passed Settings evidence.', fields };
      return { fields };
    },
  });

  const homebrewTapGate = jsonGate(options, {
    required: true,
    artifactName: homebrewTapArtifactName,
    fileName: 'homebrew-tap-plan.json',
    validate: (payload) => {
      const policy = objectField(payload, 'policy');
      const fields: Record<string, unknown> = {
        channel: payload.channel,
        package_kind: payload.package_kind,
        version: payload.version,
        tap_repo: 'gaofeng21cn/homebrew-one-person-lab',
        remote_write_mode: policy?.remote_write_mode ?? null,
        publishes_or_pushes_remote: policy?.publishes_or_pushes_remote ?? null,
      };
      if (payload.channel !== 'stable') return { reason: `Homebrew tap plan channel is ${statusString(payload.channel) || 'unknown'}.`, fields };
      if (payload.package_kind !== 'app_standard') return { reason: `Homebrew tap plan package_kind is ${statusString(payload.package_kind) || 'unknown'}.`, fields };
      if (payload.version !== options.version) return { reason: `Homebrew tap plan version is ${statusString(payload.version) || 'unknown'}.`, fields };
      if (policy?.remote_write_mode !== 'direct_commit' || policy?.publishes_or_pushes_remote !== true) {
        return { reason: 'Stable Homebrew tap plan did not record direct_commit remote publication.', fields };
      }
      const digestReason = validateHomebrewDigestCoherence(payload, remoteGate, fields);
      if (digestReason) return { reason: digestReason, fields };
      return { fields };
    },
  });
  const fullHomebrewTapGate = jsonGate(options, {
    required: options.includeFullPackage && options.runVmSmoke && options.releaseMode !== 'draft_candidate',
    artifactName: fullHomebrewTapArtifactName,
    fileName: 'homebrew-tap-plan.json',
    validate: (payload) => {
      const policy = objectField(payload, 'policy');
      const fields: Record<string, unknown> = {
        channel: payload.channel,
        package_kind: payload.package_kind,
        version: payload.version,
        tap_repo: 'gaofeng21cn/homebrew-one-person-lab',
        remote_write_mode: policy?.remote_write_mode ?? null,
        publishes_or_pushes_remote: policy?.publishes_or_pushes_remote ?? null,
        full_first_install_allowed: policy?.full_first_install_allowed ?? null,
        standard_updater_visible: policy?.standard_updater_visible ?? null,
      };
      if (payload.channel !== 'stable') return { reason: `Full Homebrew tap plan channel is ${statusString(payload.channel) || 'unknown'}.`, fields };
      if (payload.package_kind !== 'app_full_first_install') return { reason: `Full Homebrew tap plan package_kind is ${statusString(payload.package_kind) || 'unknown'}.`, fields };
      if (payload.version !== options.version) return { reason: `Full Homebrew tap plan version is ${statusString(payload.version) || 'unknown'}.`, fields };
      if (policy?.remote_write_mode !== 'direct_commit' || policy?.publishes_or_pushes_remote !== true) {
        return { reason: 'Full Homebrew tap plan did not record direct_commit remote publication.', fields };
      }
      if (policy?.full_first_install_allowed !== true || policy?.standard_updater_visible !== false) {
        return { reason: 'Full Homebrew tap plan did not preserve Full first-install boundary policy.', fields };
      }
      const digestReason = validateHomebrewDigestCoherence(payload, remoteGate, fields);
      if (digestReason) return { reason: digestReason, fields };
      return { fields };
    },
  });

  const operatorEvidenceBundleArtifactName = `release-evidence-bundle-${options.version}`;
  const operatorEvidenceBundleGate = jsonGate(options, {
    required: true,
    artifactName: operatorEvidenceBundleArtifactName,
    fileName: 'evidence-validation-summary.json',
    validate: (payload) => {
      const forbiddenAuthority = arrayOrEmpty(payload.forbidden_authority);
      const fields = {
        bundle_dir: payload.bundle_dir ?? null,
        manifest_path: payload.manifest_path ?? null,
        packaged_app_evidence: payload.packaged_app_evidence ?? null,
        authority_boundary: payload.authority_boundary ?? payload.evidence_boundary ?? null,
        verified_artifact_count: payload.verified_artifact_count ?? null,
        missing_artifact_count: payload.missing_artifact_count ?? null,
        blocked_artifact_count: payload.blocked_artifact_count ?? null,
        l5_evidence_readout: payload.l5_evidence_readout ?? null,
      };
      if (payload.status !== 'passed') return { reason: `Operator evidence bundle status is ${statusString(payload.status) || 'unknown'}.`, fields };
      if (payload.packaged_app_evidence !== true) return { reason: 'Operator evidence bundle did not claim packaged_app_evidence=true.', fields };
      if ((payload.authority_boundary ?? payload.evidence_boundary) !== 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority') {
        return { reason: 'Operator evidence bundle did not preserve refs-only authority boundary.', fields };
      }
      if (Number(payload.missing_artifact_count) !== 0 || Number(payload.blocked_artifact_count) !== 0) {
        return { reason: 'Operator evidence bundle has missing or blocked artifacts.', fields };
      }
      for (const forbidden of [
        'runtime_truth',
        'provider_implementation',
        'domain_truth',
        'domain_quality_verdict',
        'domain_artifact_authority',
      ]) {
        if (!forbiddenAuthority.includes(forbidden)) {
          return { reason: `Operator evidence bundle is missing forbidden authority marker ${forbidden}.`, fields };
        }
      }
      return { fields };
    },
  });

  const oneShotGate = jsonGate(options, {
    required: true,
    artifactName: oneShotArtifactName,
    fileName: 'opl-one-shot-system-initialize.json',
    validate: (payload) => {
      const systemInitialize = recordOrNull(payload.system_initialize);
      const setupFlow = recordOrNull(systemInitialize?.setup_flow);
      const fields: Record<string, unknown> = {
        installer_entry: './install.sh --complete --skip-modules',
        bootstrap_status_source: 'workflow job result one-shot-app-installer-smoke',
        initialization_command: 'opl system initialize --json',
        initialization_source: 'system_initialize.setup_flow',
        artifact_files: ['opl-one-shot-system-initialize.json'],
        setup_flow_status: setupFlow?.status ?? payload.status ?? null,
        setup_flow_phase: setupFlow?.phase ?? null,
        core_progress: recordOrNull(setupFlow?.core_progress),
        full_readiness_progress: recordOrNull(setupFlow?.full_readiness_progress),
        maintenance_progress: recordOrNull(setupFlow?.maintenance_progress),
        blockers: arrayOrEmpty(setupFlow?.blockers),
        next_visible_step: setupFlow?.next_visible_step ?? null,
        retry_detected: false,
        skip_modules: true,
      };
      if (payload.status === 'failed') {
        const error = recordOrNull(payload.error);
        if (error) fields.error = error;
        const message = typeof error?.message === 'string' ? error.message : 'One-shot installer reported failed status.';
        return { reason: message, fields };
      }
      if (setupFlow?.status && !['ready_to_launch', 'passed', 'initialized'].includes(String(setupFlow.status))) {
        return { reason: `One-shot setup_flow status is ${String(setupFlow.status)}.`, fields };
      }
      return { fields };
    },
  });

  const dockerGate = textArtifactGate(options, {
    required: true,
    artifactName: dockerArtifactName,
    files: [
      'opl-webui-index.html',
      'opl-webui-manifest.webmanifest',
      'opl-webui-image-size-bytes.txt',
    ],
  });

  const webuiGhcrGate = jsonGate(options, {
    required: true,
    artifactName: webuiGhcrArtifactName,
    fileName: 'opl-webui-ghcr-publish.json',
    validate: (payload) => {
      const tags = arrayOrEmpty(payload.tags);
      const fields = {
        image: payload.image,
        tags,
        draft_candidate_push: payload.draft_candidate_push ?? null,
        package_access_required: payload.package_access_required ?? null,
        error: payload.error ?? null,
      };
      if (options.releaseMode === 'draft_candidate') {
        if (payload.status !== 'draft_not_pushed') {
          return { reason: `Draft WebUI GHCR publish status is ${statusString(payload.status) || 'unknown'}.`, fields };
        }
        if (payload.draft_candidate_push !== false) {
          return { reason: 'Draft WebUI GHCR publish must not push tags.', fields };
        }
        return { fields };
      }
      if (payload.status !== 'published') {
        return { reason: `WebUI GHCR publish status is ${statusString(payload.status) || 'unknown'}.`, fields };
      }
      for (const requiredTag of [options.version, 'stable', 'latest']) {
        if (!tags.includes(requiredTag)) {
          return { reason: `WebUI GHCR publish summary is missing tag ${requiredTag}.`, fields };
        }
      }
      return { fields };
    },
  });

  const fullTelemetryGate = jsonGate(options, {
    required: options.includeFullPackage,
    artifactName: fullTelemetryArtifactName,
    fileName: 'full-workflow-telemetry.json',
    validate: (payload) => {
      const durationSeconds = payload.duration_seconds as Record<string, unknown> | undefined;
      const breakdown = durationSeconds?.full_package_build_breakdown as Record<string, unknown> | undefined;
      const requiredBreakdown = [
        'runtime_materialize',
        'runtime_cache_materialize',
        'payload_sync',
        'shell_build',
        'dmg_package_compression',
        'manifest_checksum',
      ];
      const fields = {
        cache: payload.cache ?? null,
        duration_seconds: durationSeconds ?? null,
        resolved_refs: payload.resolved_refs ?? null,
      };
      if (payload.schema !== 'opl_full_workflow_telemetry.v1') return { reason: 'Full telemetry schema is not opl_full_workflow_telemetry.v1.', fields };
      if (!durationSeconds || typeof durationSeconds.full_package_build !== 'number') return { reason: 'Full telemetry is missing duration_seconds.full_package_build.', fields };
      if (!breakdown || typeof breakdown !== 'object') return { reason: 'Full telemetry is missing duration_seconds.full_package_build_breakdown.', fields };
      const missing = requiredBreakdown.filter((key) => typeof breakdown[key] !== 'number');
      if (missing.length > 0) return { reason: `Full telemetry breakdown is missing numeric fields: ${missing.join(', ')}.`, fields };
      return { fields };
    },
  });

  const fullDiagnosticsRoot = artifactDir(options, fullDiagnosticsArtifactName);
  const manifestPath = findFileByName(fullDiagnosticsRoot, 'full-package-manifest.json');
  const sizeSummaryPath = findFileByName(fullDiagnosticsRoot, 'full-package-size-summary.json');
  const runtimeCacheEventsPath = findFileByName(fullDiagnosticsRoot, 'runtime-cache-events.json');
  const checksumPath = findFileByName(fullDiagnosticsRoot, 'SHA256SUMS.txt');
  const fullDiagnosticsGate: GateSummary = !options.includeFullPackage
    ? missingGate(false, fullDiagnosticsArtifactName, 'Full package is not included.')
    : manifestPath && runtimeCacheEventsPath && checksumPath
      ? {
          status: 'passed',
          required: true,
          artifact_name: fullDiagnosticsArtifactName,
          artifact_path: [
            path.relative(options.artifactsDir, manifestPath),
            ...(sizeSummaryPath ? [path.relative(options.artifactsDir, sizeSummaryPath)] : []),
            path.relative(options.artifactsDir, runtimeCacheEventsPath),
            path.relative(options.artifactsDir, checksumPath),
          ].join(', '),
          fields: {
            full_package_manifest: readJson(manifestPath),
            full_package_size_summary: sizeSummaryPath ? readJson(sizeSummaryPath) : null,
            runtime_cache_events: readJson(runtimeCacheEventsPath),
          },
        }
      : missingGate(true, fullDiagnosticsArtifactName, 'Missing Full diagnostics manifest, runtime cache events, or SHA256SUMS.');

  const fullSizeCacheTimingGate: GateSummary = options.includeFullPackage
    ? fullTelemetryGate.status === 'passed' && fullDiagnosticsGate.status === 'passed'
      ? {
          status: 'passed',
          required: true,
          artifact_name: `${fullTelemetryArtifactName}, ${fullDiagnosticsArtifactName}`,
          fields: {
            telemetry: fullTelemetryGate.fields,
            diagnostics: fullDiagnosticsGate.fields,
          },
        }
      : {
          status: 'failed',
          required: true,
          artifact_name: `${fullTelemetryArtifactName}, ${fullDiagnosticsArtifactName}`,
          reason: [fullTelemetryGate.reason, fullDiagnosticsGate.reason].filter(Boolean).join(' '),
          fields: {
            telemetry_status: fullTelemetryGate.status,
            diagnostics_status: fullDiagnosticsGate.status,
          },
        }
    : missingGate(false, `${fullTelemetryArtifactName}, ${fullDiagnosticsArtifactName}`, 'Full package is not included.');

  const selectedRemoteJob = options.includeFullPackage ? 'remote-verify-full' : 'remote-verify-standard';
  const selectedStandardVmJob = options.includeFullPackage
    ? 'standard-first-run-vm-smoke-after-full'
    : 'standard-first-run-vm-smoke-after-standard-only';
  const stableHomebrewRequired = homebrewReadiness.tap_update_required === true;
  const gates = {
    remote_release_verification: applyJobResult(remoteGate, jobResults, selectedRemoteJob, true),
    standard_dmg_clean_vm: applyJobResult(
      options.runVmSmoke
        ? vmGate(standardVmArtifactName, 'standard', true)
        : missingGate(false, standardVmArtifactName, 'VM smoke disabled for this run.'),
      jobResults,
      selectedStandardVmJob,
      options.runVmSmoke,
    ),
    stable_homebrew_tap_update: applyJobResult(
      stableHomebrewRequired
        ? homebrewTapGate
        : missingGate(false, homebrewTapArtifactName, homebrewReadiness.reason || 'Stable Homebrew tap update is not required for this run.'),
      jobResults,
      'stable-homebrew-tap-update',
      stableHomebrewRequired,
    ),
    full_homebrew_tap_update: applyJobResult(
      options.includeFullPackage && stableHomebrewRequired
        ? fullHomebrewTapGate
        : missingGate(false, fullHomebrewTapArtifactName, homebrewReadiness.reason || 'Full Homebrew tap update is not required for this run.'),
      jobResults,
      'full-homebrew-tap-update',
      options.includeFullPackage && stableHomebrewRequired,
    ),
    homebrew_standard_cask_clean_vm: applyJobResult(
      stableHomebrewRequired
        ? vmGate(homebrewVmArtifactName, 'standard', true)
        : missingGate(false, homebrewVmArtifactName, options.runVmSmoke ? homebrewReadiness.reason || 'Stable Homebrew VM smoke is not required for this run.' : 'VM smoke disabled for this run.'),
      jobResults,
      'homebrew-standard-first-run-vm-smoke',
      stableHomebrewRequired,
    ),
    full_dmg_clean_vm: applyJobResult(
      options.includeFullPackage && options.runVmSmoke
        ? vmGate(fullVmArtifactName, 'full', true)
        : missingGate(false, fullVmArtifactName, options.includeFullPackage ? 'VM smoke disabled for this run.' : 'Full package is not included.'),
      jobResults,
      'full-first-run-vm-smoke',
      options.includeFullPackage && options.runVmSmoke,
    ),
    one_shot_app_installer: applyJobResult(oneShotGate, jobResults, 'one-shot-app-installer-smoke', true),
    docker_webui: applyJobResult(dockerGate, jobResults, 'docker-webui-smoke', true),
    webui_ghcr_publish: applyJobResult(webuiGhcrGate, jobResults, 'webui-ghcr-publish', true),
    full_size_cache_timing: applyJobResult(fullSizeCacheTimingGate, jobResults, 'full-first-install', options.includeFullPackage),
    operator_evidence_bundle: applyJobResult(operatorEvidenceBundleGate, jobResults, 'operator-evidence-bundle-validation', true),
  };

  const failedRequired = Object.entries(gates)
    .filter(([, gate]) => gate.required && gate.status !== 'passed')
    .map(([id, gate]) => ({ id, status: gate.status, reason: gate.reason || 'gate did not pass' }));
  const telemetryPath = findFileByName(artifactDir(options, fullTelemetryArtifactName), 'full-workflow-telemetry.json');
  const fullPackage = telemetryPath ? readJson(telemetryPath) : null;
  const manifest = manifestPath ? readJson(manifestPath) : null;
  const runtimeCacheEvents = runtimeCacheEventsPath ? readJson(runtimeCacheEventsPath) : null;
  const sizeBudget = summarizeFullSizeBudget(gates.remote_release_verification);
  const sizeAnalysis = sizeSummaryPath
    ? {
        ...readJson(sizeSummaryPath),
        source: 'full_package_size_summary_artifact',
      }
    : buildManifestSizeAnalysis(manifest, sizeBudget);
  const warnings = warningsFromFullSizeBudget(sizeBudget);
  const operatorEvidenceReadout = objectField(
    gates.operator_evidence_bundle.fields ?? null,
    'l5_evidence_readout',
  );
  const releaseCohort = buildReleaseEvidenceCohort({
    version: options.version,
    source: 'release_readiness_summary',
  });
  const l5EvidenceReadout = buildAppReleaseL5EvidenceReadout({
    contract: readAppReleaseL5ReadoutContract(appRoot),
    gates,
    upstreamReadout: operatorEvidenceReadout,
    releaseCohort,
  });
  const releaseOwnerVerdict = buildAppReleaseOwnerVerdictReadout({
    contract: readAppReleaseOwnerVerdictContract(appRoot),
    releaseCohort,
    summaryStatus: failedRequired.length === 0 ? 'passed' : 'failed',
    failedRequiredGates: failedRequired,
  });

  return {
    schema: 'opl_release_readiness_summary.v1',
    gate_profile_schema: 'app_release_validation_profiles.v1',
    gate_profile: options.releaseMode === 'nightly' || options.releaseMode === 'nightly_standard' ? 'nightly_standard' : 'stable',
    status: failedRequired.length === 0 ? 'passed' : 'failed',
    version: options.version,
    release_mode: options.releaseMode,
    include_full_package: options.includeFullPackage,
    run_vm_smoke: options.runVmSmoke,
    generated_at: new Date().toISOString(),
    artifacts_policy: {
      downloads_large_dmg_artifacts: false,
      rule: 'readiness aggregation downloads only small diagnostic artifacts and summaries; DMG assets are validated by remote verification and VM jobs.',
    },
    job_results: jobResults,
    preflight: {
      artifact_name: preflight.artifactName,
      artifact_path: preflight.path,
      status: statusOf(preflight.summary),
    },
    homebrew: homebrewReadiness,
    warnings,
    gates,
    failed_required_gates: failedRequired,
    release_cohort: releaseCohort,
    l5_evidence_readout: l5EvidenceReadout,
    release_owner_verdict: releaseOwnerVerdict,
    full_package: {
      duration_seconds: fullPackage?.duration_seconds ?? null,
      cache: fullPackage?.cache ?? null,
      runtime_cache: summarizeRuntimeCacheEvents(runtimeCacheEvents),
      size_budget: sizeBudget,
      size_analysis: sizeAnalysis,
      resolved_refs: fullPackage?.resolved_refs ?? manifest?.resolved_refs ?? null,
      size_breakdown: manifest?.size_breakdown ?? null,
    },
  };
}

function writeMarkdown(filePath: string, summary: ReturnType<typeof buildSummary>) {
  if (!filePath) return;
  const lines = [
    '## Release Readiness Summary',
    '',
    `- Status: ${summary.status}`,
    `- Version: ${summary.version}`,
    `- Release mode: ${summary.release_mode}`,
    `- Full package: ${summary.include_full_package ? 'included' : 'not included'}`,
    `- VM smoke: ${summary.run_vm_smoke ? 'enabled' : 'disabled'}`,
    '- Artifact policy: small diagnostic artifacts only; no standard or Full DMG download in this aggregation job.',
    '',
    '| Gate | Required | Status | Artifact | Reason |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const [id, gate] of Object.entries(summary.gates)) {
    lines.push(`| ${id} | ${gate.required ? 'yes' : 'no'} | ${gate.status} | ${gate.artifact_name ?? ''} | ${gate.reason ?? ''} |`);
  }
  const oneShotFields = summary.gates.one_shot_app_installer.fields;
  if (oneShotFields) {
    const coreProgress = oneShotFields.core_progress as Record<string, unknown> | null | undefined;
    const coreProgressText = coreProgress
      ? `${String(coreProgress.completed ?? '?')}/${String(coreProgress.total ?? '?')}`
      : 'unknown';
    lines.push(
      '',
      '### One-shot installer',
      '',
      `- Entry: ${String(oneShotFields.installer_entry ?? '')}`,
      `- Bootstrap status source: ${String(oneShotFields.bootstrap_status_source ?? '')}`,
      `- Initialization source: ${String(oneShotFields.initialization_source ?? '')}`,
      `- Artifact files: ${Array.isArray(oneShotFields.artifact_files) ? oneShotFields.artifact_files.join(', ') : ''}`,
      `- setup_flow: ${String(oneShotFields.setup_flow_status ?? 'unknown')}`,
      `- core: ${coreProgressText}`,
      `- retry: ${String(oneShotFields.retry_detected ?? 'unknown')}`,
      `- skip_modules: ${String(oneShotFields.skip_modules ?? 'unknown')}`,
    );
  }
  const breakdown = summary.full_package.duration_seconds?.full_package_build_breakdown as Record<string, unknown> | undefined;
  if (breakdown && typeof breakdown === 'object') {
    lines.push('', '| Full build segment | Seconds |', '| --- | ---: |');
    for (const [key, value] of Object.entries(breakdown)) {
      lines.push(`| ${key} | ${String(value)} |`);
    }
  }
  if (summary.warnings.length > 0) {
    lines.push('', '### Warnings', '');
    for (const warning of summary.warnings) {
      const record = warning as Record<string, unknown>;
      lines.push(`- Full DMG size warning: ${String(record.message ?? record.code ?? 'warning')}`);
    }
  }
  const sizeAnalysis = summary.full_package.size_analysis as Record<string, unknown> | null | undefined;
  const topContributors = objectField(sizeAnalysis, 'top_contributors');
  const topLayers = arrayField(topContributors, 'layers').slice(0, 5) as Record<string, unknown>[];
  const topComponents = arrayField(topContributors, 'components').slice(0, 5) as Record<string, unknown>[];
  const optimizationCandidates = arrayField(sizeAnalysis, 'optimization_candidates').slice(0, 8) as Record<string, unknown>[];
  if (sizeAnalysis) {
    const budget = objectField(sizeAnalysis, 'budget');
    const compressedFullDmg = objectField(budget, 'compressed_full_dmg');
    const runtimeUncompressed = objectField(budget, 'runtime_uncompressed');
    lines.push(
      '',
      '### Full package size analysis',
      '',
      `- Source: ${String(sizeAnalysis.source ?? 'unknown')}`,
      `- Full DMG: ${String(compressedFullDmg?.full_dmg_size_bytes ?? 'n/a')} bytes; warning=${String(compressedFullDmg?.warning_status ?? 'n/a')}; review=${String(compressedFullDmg?.review_threshold_status ?? 'n/a')}; release_blocking=${String(compressedFullDmg?.release_blocking ?? false)}`,
      `- Runtime uncompressed: ${String(runtimeUncompressed?.total_runtime_uncompressed_bytes ?? 'n/a')} bytes; budget_status=${String(runtimeUncompressed?.status ?? 'n/a')}; used=${String(runtimeUncompressed?.used_percent ?? 'n/a')}%`,
    );
  }
  if (topLayers.length > 0) {
    lines.push('', '| Top Full runtime layer | Size bytes | Runtime % |', '| --- | ---: | ---: |');
    for (const entry of topLayers) {
      lines.push(`| ${String(entry.id)} | ${String(entry.size_bytes ?? 'n/a')} | ${String(entry.runtime_percent ?? 'n/a')} |`);
    }
  }
  if (topComponents.length > 0) {
    lines.push('', '| Top Full component | Size bytes | Runtime % |', '| --- | ---: | ---: |');
    for (const entry of topComponents) {
      lines.push(`| ${String(entry.id)} | ${String(entry.size_bytes ?? 'n/a')} | ${String(entry.runtime_percent ?? 'n/a')} |`);
    }
  }
  if (optimizationCandidates.length > 0) {
    lines.push('', '| Full size optimization candidate | Kind | Size bytes | Reason |', '| --- | --- | ---: | --- |');
    for (const entry of optimizationCandidates) {
      lines.push(`| ${String(entry.id)} | ${String(entry.kind)} | ${String(entry.size_bytes ?? 'n/a')} | ${String(entry.reason ?? '')} |`);
    }
  }
  if (summary.full_package.runtime_cache?.miss_written_count > 0) {
    lines.push(
      '',
      `- Runtime cache miss_written layers: ${summary.full_package.runtime_cache.miss_written_layers.join(', ')}`,
    );
  }
  lines.push('');
  writeLinesFile(filePath, lines);
}

try {
  const options = parseArgs(process.argv.slice(2));
  const summary = buildSummary(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeMarkdown(options.markdown, summary);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status !== 'passed') {
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
