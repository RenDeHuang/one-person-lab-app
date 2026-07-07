#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { fileSha256, writeLinesFile } from './release-file-helpers.ts';
import { arrayOrEmpty, asRecord, readJsonFile, recordOrNull } from './release-json-helpers.ts';
import {
  assertSharedReleaseReadinessOptions,
  buildSharedReleaseReadinessOptions,
  parseStrictBoolean,
} from './release-readiness-args.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reusableGateIds = [
  'remote_release_verification',
  'standard_dmg_clean_vm',
  'stable_homebrew_tap_update',
  'full_homebrew_tap_update',
  'homebrew_standard_cask_clean_vm',
  'full_dmg_clean_vm',
  'one_shot_app_installer',
  'docker_webui',
  'webui_ghcr_publish',
  'full_size_cache_timing',
  'operator_evidence_bundle',
];

type Options = {
  version: string;
  releaseMode: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  appCommit: string;
  shellRef: string;
  frameworkRef: string;
  currentPreflightPath: string;
  currentRemoteVerificationPath: string;
  previousCandidateRecordPath: string;
  previousReadinessPath: string;
  previousRemoteVerificationPath: string;
  output: string;
  markdown: string;
};

type ReuseDecision = {
  gate_id: string;
  status: 'reuse_allowed' | 'must_run';
  reason: string;
  previous_status: string | null;
  evidence_refs: Record<string, unknown>;
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    ...buildSharedReleaseReadinessOptions(parseStrictBoolean),
    appCommit: process.env.OPL_APP_COMMIT || process.env.GITHUB_SHA || '',
    shellRef: process.env.OPL_SHELL_REF || 'main',
    frameworkRef: process.env.OPL_FRAMEWORK_REF || 'main',
    currentPreflightPath: process.env.OPL_RELEASE_PREFLIGHT_SUMMARY || '',
    currentRemoteVerificationPath: process.env.OPL_REMOTE_RELEASE_VERIFICATION || '',
    previousCandidateRecordPath: process.env.OPL_PREVIOUS_RELEASE_CANDIDATE_RECORD || '',
    previousReadinessPath: process.env.OPL_PREVIOUS_RELEASE_READINESS_SUMMARY || '',
    previousRemoteVerificationPath: process.env.OPL_PREVIOUS_REMOTE_RELEASE_VERIFICATION || '',
    output: process.env.OPL_RELEASE_GATE_REUSE_PLAN || '',
    markdown: process.env.OPL_RELEASE_GATE_REUSE_MARKDOWN || '',
  };

  const { values } = parseNodeArgs({
    args: argv,
    options: {
      version: { type: 'string' },
      'release-mode': { type: 'string' },
      'include-full-package': { type: 'string' },
      'run-vm-smoke': { type: 'string' },
      'publish-docker-webui': { type: 'string' },
      'app-commit': { type: 'string' },
      'shell-ref': { type: 'string' },
      'framework-ref': { type: 'string' },
      'current-preflight': { type: 'string' },
      'current-remote-verification': { type: 'string' },
      'previous-candidate-record': { type: 'string' },
      'previous-readiness': { type: 'string' },
      'previous-remote-verification': { type: 'string' },
      output: { type: 'string' },
      markdown: { type: 'string' },
    },
  });
  if (typeof values.version === 'string') parsed.version = values.version;
  if (typeof values['release-mode'] === 'string') parsed.releaseMode = values['release-mode'];
  if (typeof values['include-full-package'] === 'string') {
    parsed.includeFullPackage = parseStrictBoolean(values['include-full-package']);
  }
  if (typeof values['run-vm-smoke'] === 'string') parsed.runVmSmoke = parseStrictBoolean(values['run-vm-smoke']);
  if (typeof values['publish-docker-webui'] === 'string') {
    parsed.publishDockerWebui = parseStrictBoolean(values['publish-docker-webui'], true);
  }
  if (typeof values['app-commit'] === 'string') parsed.appCommit = values['app-commit'];
  if (typeof values['shell-ref'] === 'string') parsed.shellRef = values['shell-ref'];
  if (typeof values['framework-ref'] === 'string') parsed.frameworkRef = values['framework-ref'];
  if (typeof values['current-preflight'] === 'string') parsed.currentPreflightPath = values['current-preflight'];
  if (typeof values['current-remote-verification'] === 'string') {
    parsed.currentRemoteVerificationPath = values['current-remote-verification'];
  }
  if (typeof values['previous-candidate-record'] === 'string') {
    parsed.previousCandidateRecordPath = values['previous-candidate-record'];
  }
  if (typeof values['previous-readiness'] === 'string') parsed.previousReadinessPath = values['previous-readiness'];
  if (typeof values['previous-remote-verification'] === 'string') {
    parsed.previousRemoteVerificationPath = values['previous-remote-verification'];
  }
  if (typeof values.output === 'string') parsed.output = values.output;
  if (typeof values.markdown === 'string') parsed.markdown = values.markdown;

  assertSharedReleaseReadinessOptions(parsed);
  const requiredPaths = [
    ['--current-preflight', parsed.currentPreflightPath],
    ['--current-remote-verification', parsed.currentRemoteVerificationPath],
    ['--previous-candidate-record', parsed.previousCandidateRecordPath],
    ['--previous-readiness', parsed.previousReadinessPath],
    ['--previous-remote-verification', parsed.previousRemoteVerificationPath],
  ];
  for (const [label, value] of requiredPaths) {
    if (!String(value).trim()) throw new Error(`Pass ${label} <path>.`);
  }

  return {
    ...parsed,
    currentPreflightPath: path.resolve(parsed.currentPreflightPath),
    currentRemoteVerificationPath: path.resolve(parsed.currentRemoteVerificationPath),
    previousCandidateRecordPath: path.resolve(parsed.previousCandidateRecordPath),
    previousReadinessPath: path.resolve(parsed.previousReadinessPath),
    previousRemoteVerificationPath: path.resolve(parsed.previousRemoteVerificationPath),
    output: parsed.output ? path.resolve(parsed.output) : path.resolve(appRoot, 'release-gate-reuse-plan.json'),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
  };
}

function readRecord(filePath: string) {
  return asRecord(readJsonFile(filePath), filePath);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function gateStatus(readiness: Record<string, unknown>, gateId: string) {
  const gates = recordOrNull(readiness.gates);
  return recordOrNull(gates?.[gateId]);
}

function sortedRemoteAssets(record: Record<string, unknown>) {
  return arrayOrEmpty(record.verified_assets)
    .map((entry) => recordOrNull(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      name: String(entry.name ?? ''),
      size: typeof entry.size === 'number' ? entry.size : null,
      sha256: String(entry.sha256 ?? ''),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function stableDigest(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function currentRefSha(preflight: Record<string, unknown>, repository: string) {
  const refs = arrayOrEmpty(preflight.release_refs)
    .map((entry) => recordOrNull(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
  return stringValue(refs.find((entry) => entry.repository === repository)?.resolved_sha);
}

function previousFrameworkSha(candidate: Record<string, unknown>) {
  const refs = recordOrNull(candidate.resolved_refs);
  const framework = recordOrNull(refs?.opl_framework);
  return stringValue(framework?.commit);
}

function collectGlobalBlockers(options: Options, inputs: {
  currentPreflight: Record<string, unknown>;
  currentRemote: Record<string, unknown>;
  previousCandidate: Record<string, unknown>;
  previousReadiness: Record<string, unknown>;
  previousRemote: Record<string, unknown>;
}) {
  const blockers: string[] = [];
  const previousInputs = recordOrNull(inputs.previousCandidate.inputs);
  const previousProvenance = recordOrNull(inputs.previousCandidate.provenance);

  if (inputs.currentPreflight.status !== 'passed') blockers.push(`current preflight status is ${String(inputs.currentPreflight.status)}`);
  if (inputs.currentRemote.status !== 'passed') blockers.push(`current remote verification status is ${String(inputs.currentRemote.status)}`);
  if (inputs.previousCandidate.status !== 'ready_to_promote') blockers.push(`previous candidate status is ${String(inputs.previousCandidate.status)}`);
  if (inputs.previousReadiness.status !== 'passed') blockers.push(`previous readiness status is ${String(inputs.previousReadiness.status)}`);
  if (inputs.previousRemote.status !== 'passed') blockers.push(`previous remote verification status is ${String(inputs.previousRemote.status)}`);
  if (inputs.previousCandidate.version !== options.version) blockers.push(`previous candidate version is ${String(inputs.previousCandidate.version)}`);
  if (inputs.previousCandidate.release_mode !== options.releaseMode) blockers.push(`previous candidate release_mode is ${String(inputs.previousCandidate.release_mode)}`);
  if (previousInputs?.include_full_package !== options.includeFullPackage) blockers.push('include_full_package does not match previous candidate');
  if (previousInputs?.run_vm_smoke !== options.runVmSmoke) blockers.push('run_vm_smoke does not match previous candidate');
  if (previousInputs?.shell_ref !== options.shellRef) blockers.push(`shell_ref does not match previous candidate (${String(previousInputs?.shell_ref)})`);
  if (previousInputs?.framework_ref !== options.frameworkRef) blockers.push(`framework_ref does not match previous candidate (${String(previousInputs?.framework_ref)})`);
  if (options.appCommit && previousProvenance?.app_commit !== options.appCommit) {
    blockers.push(`app_commit does not match previous candidate (${String(previousProvenance?.app_commit)})`);
  }

  const currentShellSha = currentRefSha(inputs.currentPreflight, 'gaofeng21cn/opl-aion-shell');
  const currentFrameworkSha = currentRefSha(inputs.currentPreflight, 'gaofeng21cn/one-person-lab');
  const previousFrameworkCommit = previousFrameworkSha(inputs.previousCandidate);
  if (currentFrameworkSha && previousFrameworkCommit && currentFrameworkSha !== previousFrameworkCommit) {
    blockers.push(`framework commit changed from ${previousFrameworkCommit} to ${currentFrameworkSha}`);
  }
  if (!currentShellSha) blockers.push('current preflight did not resolve shell ref sha');
  if (options.includeFullPackage && !currentFrameworkSha) blockers.push('current preflight did not resolve framework ref sha');

  if (!sameJson(sortedRemoteAssets(inputs.currentRemote), sortedRemoteAssets(inputs.previousRemote))) {
    blockers.push('remote verified asset name/size/sha256 set changed');
  }
  return blockers;
}

function buildDecision(gateId: string, blockers: string[], previousReadiness: Record<string, unknown>, inputs: Options): ReuseDecision {
  const gate = gateStatus(previousReadiness, gateId);
  const previousStatus = stringValue(gate?.status) || null;
  const artifactName = gate?.artifact_name ?? null;
  const artifactPath = gate?.artifact_path ?? null;
  if (!gate) {
    return {
      gate_id: gateId,
      status: 'must_run',
      reason: `previous readiness is missing gate ${gateId}`,
      previous_status: null,
      evidence_refs: {},
    };
  }
  if (previousStatus !== 'passed') {
    return {
      gate_id: gateId,
      status: 'must_run',
      reason: `previous gate status is ${previousStatus}`,
      previous_status: previousStatus,
      evidence_refs: { artifact_name: artifactName, artifact_path: artifactPath },
    };
  }
  if (blockers.length > 0) {
    return {
      gate_id: gateId,
      status: 'must_run',
      reason: blockers.join('; '),
      previous_status: previousStatus,
      evidence_refs: { artifact_name: artifactName, artifact_path: artifactPath },
    };
  }
  return {
    gate_id: gateId,
    status: 'reuse_allowed',
    reason: 'same version, release mode, inputs, app commit, resolved refs, remote asset digests, and previous passed gate evidence',
    previous_status: previousStatus,
    evidence_refs: {
      candidate_record: inputs.previousCandidateRecordPath,
      readiness_summary: inputs.previousReadinessPath,
      remote_verification: inputs.previousRemoteVerificationPath,
      artifact_name: artifactName,
      artifact_path: artifactPath,
    },
  };
}

function writeMarkdown(filePath: string, summary: ReturnType<typeof buildPlan>) {
  if (!filePath) return;
  const lines = [
    '# Release Gate Reuse Plan',
    '',
    `- Status: ${summary.status}`,
    `- Version: ${summary.version}`,
    `- Reuse allowed: ${summary.reuse_allowed_count}`,
    `- Must run: ${summary.must_run_count}`,
    '',
    '| Gate | Decision | Reason |',
    '| --- | --- | --- |',
    ...summary.decisions.map((decision) => (
      `| ${decision.gate_id} | ${decision.status} | ${decision.reason.replaceAll('|', '\\|')} |`
    )),
    '',
  ];
  writeLinesFile(filePath, lines);
}

function buildPlan(options: Options) {
  const currentPreflight = readRecord(options.currentPreflightPath);
  const currentRemote = readRecord(options.currentRemoteVerificationPath);
  const previousCandidate = readRecord(options.previousCandidateRecordPath);
  const previousReadiness = readRecord(options.previousReadinessPath);
  const previousRemote = readRecord(options.previousRemoteVerificationPath);
  const cohort = {
    version: options.version,
    release_mode: options.releaseMode,
    include_full_package: options.includeFullPackage,
    run_vm_smoke: options.runVmSmoke,
    app_commit: options.appCommit,
    shell_ref: options.shellRef,
    framework_ref: options.frameworkRef,
    current_shell_sha: currentRefSha(currentPreflight, 'gaofeng21cn/opl-aion-shell'),
    current_framework_sha: currentRefSha(currentPreflight, 'gaofeng21cn/one-person-lab'),
    remote_asset_name_size_sha256: sortedRemoteAssets(currentRemote),
  };
  const blockers = collectGlobalBlockers(options, {
    currentPreflight,
    currentRemote,
    previousCandidate,
    previousReadiness,
    previousRemote,
  });
  const decisions = reusableGateIds.map((gateId) => buildDecision(gateId, blockers, previousReadiness, options));
  return {
    schema: 'opl_release_gate_reuse_plan.v1',
    status: decisions.every((decision) => decision.status === 'reuse_allowed') ? 'reuse_available' : 'partial_or_blocked',
    generated_at: new Date().toISOString(),
    version: options.version,
    release_mode: options.releaseMode,
    inputs: {
      include_full_package: options.includeFullPackage,
      run_vm_smoke: options.runVmSmoke,
      app_commit: options.appCommit,
      shell_ref: options.shellRef,
      framework_ref: options.frameworkRef,
    },
    cohort,
    reuse_digest: stableDigest({
      schema: 'opl_release_gate_reuse_digest.v1',
      cohort,
      previous_candidate_record_sha256: fileSha256(options.previousCandidateRecordPath),
      previous_readiness_sha256: fileSha256(options.previousReadinessPath),
      previous_remote_verification_sha256: fileSha256(options.previousRemoteVerificationPath),
    }),
    source_files: {
      current_preflight: options.currentPreflightPath,
      current_preflight_sha256: fileSha256(options.currentPreflightPath),
      current_remote_verification: options.currentRemoteVerificationPath,
      current_remote_verification_sha256: fileSha256(options.currentRemoteVerificationPath),
      previous_candidate_record: options.previousCandidateRecordPath,
      previous_candidate_record_sha256: fileSha256(options.previousCandidateRecordPath),
      previous_readiness: options.previousReadinessPath,
      previous_readiness_sha256: fileSha256(options.previousReadinessPath),
      previous_remote_verification: options.previousRemoteVerificationPath,
      previous_remote_verification_sha256: fileSha256(options.previousRemoteVerificationPath),
    },
    global_blockers: blockers,
    reuse_allowed_count: decisions.filter((decision) => decision.status === 'reuse_allowed').length,
    must_run_count: decisions.filter((decision) => decision.status === 'must_run').length,
    decisions,
    authority_boundary: {
      reuse_plan_can_skip_release_gate_by_itself: false,
      workflow_must_explicitly_consume_reuse_allowed_decision: true,
      reuse_plan_can_claim_release_ready: false,
      reuse_plan_can_publish_release: false,
      reuse_plan_can_write_runtime_truth: false,
    },
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  const plan = buildPlan(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  writeMarkdown(options.markdown, plan);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
