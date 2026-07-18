#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { fileSha256, writeLinesFile } from './release-file-helpers.ts';
import { asRecord, readJsonFile, recordOrNull } from './release-json-helpers.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Options = {
  version: string;
  releaseMode: string;
  candidateRecordPath: string;
  readinessPath: string;
  remoteVerificationPath: string;
  preflightPath: string;
  gateReusePlanPath: string;
  output: string;
  markdown: string;
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    version: process.env.OPL_RELEASE_VERSION || '',
    releaseMode: process.env.OPL_RELEASE_MODE || '',
    candidateRecordPath: process.env.OPL_RELEASE_CANDIDATE_RECORD || '',
    readinessPath: process.env.OPL_RELEASE_READINESS_SUMMARY || '',
    remoteVerificationPath: process.env.OPL_REMOTE_RELEASE_VERIFICATION || '',
    preflightPath: process.env.OPL_RELEASE_PREFLIGHT_SUMMARY || '',
    gateReusePlanPath: process.env.OPL_RELEASE_GATE_REUSE_PLAN || '',
    output: process.env.OPL_RELEASE_COHORT_MANIFEST || '',
    markdown: process.env.OPL_RELEASE_COHORT_MANIFEST_MARKDOWN || '',
  };

  const { values } = parseNodeArgs({
    args: argv,
    options: {
      version: { type: 'string' },
      'release-mode': { type: 'string' },
      'candidate-record': { type: 'string' },
      readiness: { type: 'string' },
      'remote-verification': { type: 'string' },
      preflight: { type: 'string' },
      'gate-reuse-plan': { type: 'string' },
      output: { type: 'string' },
      markdown: { type: 'string' },
    },
  });

  parsed.version = values.version ?? parsed.version;
  parsed.releaseMode = values['release-mode'] ?? parsed.releaseMode;
  parsed.candidateRecordPath = values['candidate-record'] ?? parsed.candidateRecordPath;
  parsed.readinessPath = values.readiness ?? parsed.readinessPath;
  parsed.remoteVerificationPath = values['remote-verification'] ?? parsed.remoteVerificationPath;
  parsed.preflightPath = values.preflight ?? parsed.preflightPath;
  parsed.gateReusePlanPath = values['gate-reuse-plan'] ?? parsed.gateReusePlanPath;
  parsed.output = values.output ?? parsed.output;
  parsed.markdown = values.markdown ?? parsed.markdown;

  const required = [
    ['--version', parsed.version],
    ['--candidate-record', parsed.candidateRecordPath],
    ['--readiness', parsed.readinessPath],
    ['--remote-verification', parsed.remoteVerificationPath],
  ];
  for (const [label, value] of required) {
    if (!String(value).trim()) throw new Error(`Pass ${label} <value>.`);
  }
  return {
    ...parsed,
    candidateRecordPath: path.resolve(parsed.candidateRecordPath),
    readinessPath: path.resolve(parsed.readinessPath),
    remoteVerificationPath: path.resolve(parsed.remoteVerificationPath),
    preflightPath: parsed.preflightPath ? path.resolve(parsed.preflightPath) : '',
    gateReusePlanPath: parsed.gateReusePlanPath ? path.resolve(parsed.gateReusePlanPath) : '',
    output: parsed.output ? path.resolve(parsed.output) : path.resolve(appRoot, 'release-cohort-manifest.json'),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
  };
}

function readRecord(filePath: string) {
  return asRecord(readJsonFile(filePath), filePath);
}

function readOptionalRecord(filePath: string) {
  return filePath && fs.existsSync(filePath) ? readRecord(filePath) : null;
}

function asRecordEntries(value: unknown) {
  const record = recordOrNull(value) ?? {};
  return Object.entries(record).map(([id, gate]) => ({
    id,
    ...(recordOrNull(gate) ?? {}),
  }));
}

function sortedAssets(remote: Record<string, unknown>) {
  return (Array.isArray(remote.verified_assets) ? remote.verified_assets : [])
    .map((asset) => recordOrNull(asset))
    .filter((asset): asset is Record<string, unknown> => asset !== null)
    .map((asset) => ({
      name: String(asset.name ?? ''),
      size: typeof asset.size === 'number' ? asset.size : null,
      sha256: String(asset.sha256 ?? ''),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function recoveryAction(gateId: string) {
  const qualificationGates = new Set([
    'standard_dmg_clean_vm',
    'full_dmg_clean_vm',
    'homebrew_standard_cask_clean_vm',
  ]);
  const isQualification = qualificationGates.has(gateId);
  const artifactKind = gateId === 'full_dmg_clean_vm' ? 'full' : 'standard';
  const subcommand = isQualification ? 'retry-qualification' : 'reconcile';
  const artifactArg = isQualification ? ` --artifact-kind ${artifactKind}` : '';
  return {
    action: isQualification
      ? 'retry_qualification_same_artifact'
      : 'reconcile_stable_session',
    controller: 'release:stable',
    controller_subcommand: subcommand,
    state_ref: 'original_stable_release_session',
    command_template: `npm run release:stable -- ${subcommand} --state <original-release-session.json>${artifactArg}`,
    execution_mode: 'dry_run',
    execute_flag_included: false,
    mutation_authorized: false,
    direct_workflow_dispatch_allowed: false,
  };
}

function buildManifest(options: Options) {
  const candidate = readRecord(options.candidateRecordPath);
  const readiness = readRecord(options.readinessPath);
  const remote = readRecord(options.remoteVerificationPath);
  const preflight = readOptionalRecord(options.preflightPath);
  const gateReusePlan = readOptionalRecord(options.gateReusePlanPath);
  const gates = asRecordEntries(readiness.gates).map((gate) => ({
    id: gate.id,
    status: String(gate.status ?? 'unknown'),
    required: gate.required !== false,
    artifact_name: typeof gate.artifact_name === 'string' ? gate.artifact_name : null,
    artifact_path: typeof gate.artifact_path === 'string' ? gate.artifact_path : null,
    recovery_action: recoveryAction(gate.id),
  }));
  const reusable = recordOrNull(gateReusePlan)?.decisions;

  return {
    schema: 'opl_release_cohort_manifest.v1',
    generated_at: new Date().toISOString(),
    status: String(candidate.status ?? 'unknown'),
    version: options.version,
    release_mode: options.releaseMode || String(candidate.release_mode ?? ''),
    tag: `v${options.version}`,
    source_files: {
      candidate_record: options.candidateRecordPath,
      candidate_record_sha256: fileSha256(options.candidateRecordPath),
      readiness: options.readinessPath,
      readiness_sha256: fileSha256(options.readinessPath),
      remote_verification: options.remoteVerificationPath,
      remote_verification_sha256: fileSha256(options.remoteVerificationPath),
      preflight: options.preflightPath || null,
      preflight_sha256: options.preflightPath ? fileSha256(options.preflightPath) : null,
      gate_reuse_plan: options.gateReusePlanPath || null,
      gate_reuse_plan_sha256: options.gateReusePlanPath ? fileSha256(options.gateReusePlanPath) : null,
    },
    cohort: {
      inputs: recordOrNull(candidate.inputs) ?? {},
      provenance: recordOrNull(candidate.provenance) ?? {},
      resolved_refs: recordOrNull(candidate.resolved_refs) ?? null,
      preflight_release_refs: Array.isArray(preflight?.release_refs) ? preflight.release_refs : [],
    },
    assets: sortedAssets(remote),
    gates,
    reusable_gates: Array.isArray(reusable) ? reusable : [],
    retry_policy: {
      build_once_promote_many: true,
      failed_gate_retry_should_consume_this_manifest: true,
      retry_must_not_rebuild_verified_assets_when_asset_sha256_matches: true,
      recovery_must_use_stable_controller: true,
      direct_workflow_dispatch_allowed: false,
      manifest_can_authorize_mutation: false,
      manifest_can_publish_release: false,
      manifest_can_claim_release_ready: false,
      manifest_can_write_runtime_truth: false,
    },
  };
}

function writeMarkdown(filePath: string, manifest: ReturnType<typeof buildManifest>) {
  if (!filePath) return;
  writeLinesFile(filePath, [
    '# Release Cohort Manifest',
    '',
    `- Status: ${manifest.status}`,
    `- Version: ${manifest.version}`,
    `- Tag: ${manifest.tag}`,
    `- Assets: ${manifest.assets.length}`,
    `- Gates: ${manifest.gates.length}`,
    '',
    '| Gate | Status | Typed recovery action | Stable controller route |',
    '| --- | --- | --- | --- |',
    ...manifest.gates.map((gate) => (
      `| ${gate.id} | ${gate.status} | ${gate.recovery_action.action} | \`${gate.recovery_action.command_template.replaceAll('`', '\\`')}\` |`
    )),
    '',
  ]);
}

try {
  const options = parseArgs(process.argv.slice(2));
  const manifest = buildManifest(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  writeMarkdown(options.markdown, manifest);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
