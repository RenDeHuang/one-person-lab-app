#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
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
const historicalGateIds = [
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

type Options = ReturnType<typeof parseOptions>;

function parseOptions(argv: string[]) {
  const parsed = {
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
  if (values.version) parsed.version = values.version;
  if (values['release-mode']) parsed.releaseMode = values['release-mode'];
  if (values['include-full-package']) parsed.includeFullPackage = parseStrictBoolean(values['include-full-package']);
  if (values['run-vm-smoke']) parsed.runVmSmoke = parseStrictBoolean(values['run-vm-smoke']);
  if (values['publish-docker-webui']) parsed.publishDockerWebui = parseStrictBoolean(values['publish-docker-webui'], true);
  if (values['app-commit']) parsed.appCommit = values['app-commit'];
  if (values['shell-ref']) parsed.shellRef = values['shell-ref'];
  if (values['framework-ref']) parsed.frameworkRef = values['framework-ref'];
  if (values['current-preflight']) parsed.currentPreflightPath = values['current-preflight'];
  if (values['current-remote-verification']) parsed.currentRemoteVerificationPath = values['current-remote-verification'];
  if (values['previous-candidate-record']) parsed.previousCandidateRecordPath = values['previous-candidate-record'];
  if (values['previous-readiness']) parsed.previousReadinessPath = values['previous-readiness'];
  if (values['previous-remote-verification']) parsed.previousRemoteVerificationPath = values['previous-remote-verification'];
  if (values.output) parsed.output = values.output;
  if (values.markdown) parsed.markdown = values.markdown;
  assertSharedReleaseReadinessOptions(parsed);
  for (const [label, value] of [
    ['--current-preflight', parsed.currentPreflightPath],
    ['--current-remote-verification', parsed.currentRemoteVerificationPath],
    ['--previous-candidate-record', parsed.previousCandidateRecordPath],
    ['--previous-readiness', parsed.previousReadinessPath],
    ['--previous-remote-verification', parsed.previousRemoteVerificationPath],
  ]) {
    if (!String(value).trim()) throw new Error(`Pass ${label} <path>.`);
  }
  return {
    ...parsed,
    currentPreflightPath: path.resolve(parsed.currentPreflightPath),
    currentRemoteVerificationPath: path.resolve(parsed.currentRemoteVerificationPath),
    previousCandidateRecordPath: path.resolve(parsed.previousCandidateRecordPath),
    previousReadinessPath: path.resolve(parsed.previousReadinessPath),
    previousRemoteVerificationPath: path.resolve(parsed.previousRemoteVerificationPath),
    output: parsed.output ? path.resolve(parsed.output) : path.resolve(appRoot, 'release-gate-reuse-inspection.json'),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
  };
}

function readRecord(filePath: string) {
  return asRecord(readJsonFile(filePath), filePath);
}

function currentRefSha(preflight: Record<string, unknown>, repository: string) {
  const refs = arrayOrEmpty(preflight.release_refs)
    .map((entry) => recordOrNull(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
  const value = refs.find((entry) => entry.repository === repository)?.resolved_sha;
  return typeof value === 'string' ? value : '';
}

function currentAppSha(preflight: Record<string, unknown>) {
  const value = recordOrNull(preflight.inputs)?.expected_app_head;
  return typeof value === 'string' ? value : '';
}

function buildInspection(options: Options) {
  const currentPreflight = readRecord(options.currentPreflightPath);
  const currentAppCommit = currentAppSha(currentPreflight);
  const currentShellSha = currentRefSha(currentPreflight, 'gaofeng21cn/opl-aion-shell');
  const currentFrameworkSha = currentRefSha(currentPreflight, 'gaofeng21cn/one-person-lab');
  const blockers = ['App gate-reuse planning is retired; Framework checkpoint receipts decide completed-stage skips.'];
  if (currentAppCommit !== options.appCommit) blockers.push(`current preflight app commit ${currentAppCommit || '(missing)'} does not match requested app commit ${options.appCommit}`);
  if (currentShellSha !== options.shellRef) blockers.push(`current preflight shell sha ${currentShellSha || '(missing)'} does not match requested shell ref ${options.shellRef}`);
  if (currentFrameworkSha !== options.frameworkRef) blockers.push(`current preflight framework sha ${currentFrameworkSha || '(missing)'} does not match requested framework ref ${options.frameworkRef}`);
  const sourceFiles = {
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
  };
  const decisions = historicalGateIds.map((gateId) => ({
    gate_id: gateId,
    status: 'must_run' as const,
    reason: 'Historical App evidence cannot skip a Framework Bundle stage.',
    previous_status: null,
    evidence_refs: {},
  }));
  return {
    schema: 'opl_app_release_gate_reuse_inspection.v1',
    lifecycle: 'retired_read_only',
    status: 'retired_no_reuse_authority',
    generated_at: new Date().toISOString(),
    version: options.version,
    release_mode: options.releaseMode,
    cohort: {
      requested_app_commit: options.appCommit,
      requested_shell_ref: options.shellRef,
      requested_framework_ref: options.frameworkRef,
      current_app_commit: currentAppCommit,
      current_shell_sha: currentShellSha,
      current_framework_sha: currentFrameworkSha,
    },
    inspection_digest: `sha256:${crypto.createHash('sha256').update(JSON.stringify(sourceFiles)).digest('hex')}`,
    source_files: sourceFiles,
    global_blockers: blockers,
    reuse_allowed_count: 0,
    must_run_count: decisions.length,
    decisions,
    authority_boundary: {
      inspection_can_skip_release_gate: false,
      inspection_can_claim_release_ready: false,
      inspection_can_publish_release: false,
      inspection_can_write_runtime_truth: false,
      completed_stage_authority: 'OPL Framework checkpoint and receipts only',
    },
  };
}

function writeMarkdown(filePath: string, inspection: ReturnType<typeof buildInspection>) {
  if (!filePath) return;
  writeLinesFile(filePath, [
    '# Historical Release Gate Inspection',
    '',
    `- Status: ${inspection.status}`,
    `- Version: ${inspection.version}`,
    '- Reuse authority: none',
    '',
    '| Gate | Decision |',
    '| --- | --- |',
    ...inspection.decisions.map((decision) => `| ${decision.gate_id} | ${decision.status} |`),
    '',
  ]);
}

try {
  const options = parseOptions(process.argv.slice(2));
  const inspection = buildInspection(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(inspection, null, 2)}\n`, 'utf8');
  writeMarkdown(options.markdown, inspection);
  process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
