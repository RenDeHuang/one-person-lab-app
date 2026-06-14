#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  readAppReleaseOwnerVerdictContract,
  validateAppReleaseOwnerVerdictContract,
} from './app-release-owner-verdict.ts';
import { writeLinesFile } from './release-file-helpers.ts';
import { applyStringOptionArg } from './cli-option-args.ts';
import { arrayOrEmpty, recordOrNull } from './release-json-helpers.ts';
import {
  applySharedReleaseReadinessArg,
  assertSharedReleaseReadinessOptions,
  buildSharedReleaseReadinessOptions,
  parseStrictBoolean,
} from './release-readiness-args.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseRepo = 'gaofeng21cn/one-person-lab-app';
const allowedStatuses = ['ready_to_promote', 'blocked', 'diagnostic_only'] as const;
const releaseOwnerVerdictContract = validateAppReleaseOwnerVerdictContract(
  readAppReleaseOwnerVerdictContract(appRoot),
);

type Options = {
  version: string;
  releaseMode: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  appCommit: string;
  shellRef: string;
  frameworkRef: string;
  workflowRunId: string;
  preflightPath: string;
  readinessPath: string;
  remoteVerificationPath: string;
  jobResultsPath: string;
  output: string;
  markdown: string;
  promotionMode: string;
  releaseOwnerVerdictRef: string;
  releaseOwnerReceiptRef: string;
  releaseOwnerTypedBlockerRef: string;
  humanGateRef: string;
  allowBlocked: boolean;
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    ...buildSharedReleaseReadinessOptions(parseStrictBoolean),
    appCommit: process.env.OPL_APP_COMMIT || process.env.GITHUB_SHA || '',
    shellRef: process.env.OPL_SHELL_REF || 'main',
    frameworkRef: process.env.OPL_FRAMEWORK_REF || 'main',
    workflowRunId: process.env.GITHUB_RUN_ID || 'local',
    preflightPath: process.env.OPL_RELEASE_PREFLIGHT_SUMMARY || '',
    readinessPath: process.env.OPL_RELEASE_READINESS_SUMMARY || '',
    remoteVerificationPath: process.env.OPL_REMOTE_RELEASE_VERIFICATION || '',
    jobResultsPath: process.env.OPL_RELEASE_READINESS_JOB_RESULTS || '',
    output: process.env.OPL_RELEASE_CANDIDATE_RECORD || '',
    markdown: process.env.OPL_RELEASE_CANDIDATE_MARKDOWN || '',
    promotionMode: process.env.OPL_RELEASE_PROMOTION_MODE || 'candidate_then_promote',
    releaseOwnerVerdictRef: process.env.OPL_RELEASE_OWNER_VERDICT_REF || '',
    releaseOwnerReceiptRef: process.env.OPL_RELEASE_OWNER_RECEIPT_REF || '',
    releaseOwnerTypedBlockerRef: process.env.OPL_RELEASE_OWNER_TYPED_BLOCKER_REF || '',
    humanGateRef: process.env.OPL_RELEASE_OWNER_HUMAN_GATE_REF || '',
    allowBlocked: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--allow-blocked') {
      parsed.allowBlocked = true;
      continue;
    }
    const sharedIndex = applySharedReleaseReadinessArg(argv, index, parsed, parseStrictBoolean);
    if (sharedIndex !== null) {
      index = sharedIndex;
      continue;
    }
    const optionIndex = applyStringOptionArg(argv, index, {
      '--app-commit': (value) => { parsed.appCommit = value; },
      '--shell-ref': (value) => { parsed.shellRef = value; },
      '--framework-ref': (value) => { parsed.frameworkRef = value; },
      '--workflow-run-id': (value) => { parsed.workflowRunId = value; },
      '--preflight': (value) => { parsed.preflightPath = value; },
      '--readiness': (value) => { parsed.readinessPath = value; },
      '--remote-verification': (value) => { parsed.remoteVerificationPath = value; },
      '--job-results': (value) => { parsed.jobResultsPath = value; },
      '--output': (value) => { parsed.output = value; },
      '--markdown': (value) => { parsed.markdown = value; },
      '--promotion-mode': (value) => { parsed.promotionMode = value; },
      '--release-owner-verdict-ref': (value) => { parsed.releaseOwnerVerdictRef = value; },
      '--release-owner-receipt-ref': (value) => { parsed.releaseOwnerReceiptRef = value; },
      '--release-owner-typed-blocker-ref': (value) => { parsed.releaseOwnerTypedBlockerRef = value; },
      '--release-owner-human-gate-ref': (value) => { parsed.humanGateRef = value; },
    });
    if (optionIndex !== null) {
      index = optionIndex;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  assertSharedReleaseReadinessOptions(parsed);
  if (!parsed.appCommit.trim()) parsed.appCommit = gitValue(['rev-parse', 'HEAD']);
  return {
    ...parsed,
    preflightPath: parsed.preflightPath ? path.resolve(parsed.preflightPath) : '',
    readinessPath: parsed.readinessPath ? path.resolve(parsed.readinessPath) : '',
    remoteVerificationPath: parsed.remoteVerificationPath ? path.resolve(parsed.remoteVerificationPath) : '',
    jobResultsPath: parsed.jobResultsPath ? path.resolve(parsed.jobResultsPath) : '',
    output: parsed.output ? path.resolve(parsed.output) : path.resolve(appRoot, 'release-candidate-record.json'),
    markdown: parsed.markdown ? path.resolve(parsed.markdown) : '',
  };
}

function gitValue(args: string[]) {
  const result = spawnSync('git', args, { cwd: appRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function readJsonIfExists(filePath: string) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function statusOf(record: Record<string, unknown> | null) {
  return typeof record?.status === 'string' ? record.status : 'missing';
}

function collectBlockedReasons(options: Options, inputs: {
  preflight: Record<string, unknown> | null;
  readiness: Record<string, unknown> | null;
  remote: Record<string, unknown> | null;
}) {
  const reasons: string[] = [];
  if (statusOf(inputs.preflight) !== 'passed') {
    reasons.push(`preflight status is ${statusOf(inputs.preflight)}`);
  }
  if (statusOf(inputs.readiness) !== 'passed') {
    reasons.push(`readiness status is ${statusOf(inputs.readiness)}`);
  }
  if (statusOf(inputs.remote) !== 'passed') {
    reasons.push(`remote verification status is ${statusOf(inputs.remote)}`);
  }
  if (inputs.remote && inputs.remote.version && inputs.remote.version !== options.version) {
    reasons.push(`remote verification version is ${String(inputs.remote.version)}`);
  }
  if (inputs.readiness && inputs.readiness.version && inputs.readiness.version !== options.version) {
    reasons.push(`readiness version is ${String(inputs.readiness.version)}`);
  }
  const failedGates = arrayOrEmpty(inputs.readiness?.failed_required_gates);
  for (const gate of failedGates) {
    const record = recordOrNull(gate);
    if (record) reasons.push(`required gate ${String(record.id ?? 'unknown')} ${String(record.status ?? 'failed')}: ${String(record.reason ?? 'no reason')}`);
  }
  return reasons;
}

function extractResolvedRefs(readiness: Record<string, unknown> | null) {
  const fullPackage = recordOrNull(readiness?.full_package);
  return recordOrNull(fullPackage?.resolved_refs);
}

function withReleaseOwnerResolution(readiness: Record<string, unknown> | null, options: Options) {
  const verdict = recordOrNull(readiness?.release_owner_verdict);
  if (!verdict) return null;
  const next = { ...verdict };
  if (options.releaseOwnerVerdictRef) {
    next.status = 'release_owner_verdict_recorded';
    next.release_owner_verdict_ref = options.releaseOwnerVerdictRef;
  }
  if (options.releaseOwnerReceiptRef) {
    next.status = 'release_owner_receipt_recorded';
    next.release_owner_receipt_ref = options.releaseOwnerReceiptRef;
  }
  if (options.releaseOwnerTypedBlockerRef) {
    next.status = releaseOwnerVerdictContract.typed_blocker_status;
    next.release_owner_typed_blocker_ref = options.releaseOwnerTypedBlockerRef;
    next.typed_blocker_ref = options.releaseOwnerTypedBlockerRef;
  }
  if (options.humanGateRef) {
    next.status = 'release_owner_human_gate_required';
    next.human_gate_ref = options.humanGateRef;
  }
  return next;
}

function collectReleaseOwnerVerdictReasons(verdict: Record<string, unknown> | null) {
  const reasons: string[] = [];
  if (!verdict) {
    return ['readiness summary is missing release_owner_verdict'];
  }
  if (verdict.schema !== 'opl_app_release_owner_verdict_readout.v1') {
    reasons.push(`release_owner_verdict schema is ${String(verdict.schema)}`);
  }
  if (verdict.release_ready_claim !== false || verdict.stable_latest_promotion_claim !== false) {
    reasons.push('release_owner_verdict must not claim release ready or stable/latest promotion');
  }
  if (
    verdict.status !== 'release_owner_verdict_pending'
    && verdict.status !== 'release_owner_typed_blocker_required'
    && verdict.status !== 'release_owner_verdict_recorded'
    && verdict.status !== 'release_owner_receipt_recorded'
    && verdict.status !== 'release_owner_human_gate_required'
  ) {
    reasons.push(`release_owner_verdict status is ${String(verdict.status)}`);
  }
  if (verdict.status === 'release_owner_typed_blocker_required') {
    reasons.push('release_owner_verdict requires a release owner typed blocker before promotion');
  }
  if (verdict.status === 'release_owner_verdict_pending') {
    reasons.push('release_owner_verdict is pending; promotion requires release_owner_verdict_ref or release_owner_receipt_ref');
  }
  if (
    verdict.status === 'release_owner_verdict_pending'
    && typeof verdict.release_owner_typed_blocker_ref !== 'string'
  ) {
    reasons.push('release_owner_verdict pending status must include release_owner_typed_blocker_ref');
  }
  if (verdict.release_owner_verdict_ref !== null && typeof verdict.release_owner_verdict_ref !== 'string') {
    reasons.push('release_owner_verdict_ref must be a string or null');
  }
  if (verdict.release_owner_receipt_ref !== null && typeof verdict.release_owner_receipt_ref !== 'string') {
    reasons.push('release_owner_receipt_ref must be a string or null');
  }
  const hasOwnerResolution = releaseOwnerVerdictContract.owner_resolution_ref_shapes.some((shape) => {
    const value = verdict[shape];
    return typeof value === 'string' && value.trim().length > 0;
  });
  const installEvidenceRef = verdict.install_evidence_ref;
  if (installEvidenceRef !== null && installEvidenceRef !== undefined && typeof installEvidenceRef !== 'string') {
    reasons.push('install_evidence_ref must be a string or null');
  }
  if (!hasOwnerResolution) {
    reasons.push(
      `release_owner_verdict is missing owner resolution ref (${releaseOwnerVerdictContract.owner_resolution_ref_shapes.join(' or ')})`,
    );
  }
  if (verdict.status === 'release_owner_human_gate_required') {
    reasons.push('release_owner_verdict is waiting on a human gate before promotion');
  }
  return reasons;
}

function buildRecord(options: Options) {
  const preflight = recordOrNull(readJsonIfExists(options.preflightPath));
  const readiness = recordOrNull(readJsonIfExists(options.readinessPath));
  const remote = recordOrNull(readJsonIfExists(options.remoteVerificationPath));
  const jobResults = recordOrNull(readJsonIfExists(options.jobResultsPath)) ?? {};
  const releaseOwnerVerdict = withReleaseOwnerResolution(readiness, options);
  const blockedReasons = collectBlockedReasons(options, { preflight, readiness, remote });
  blockedReasons.push(...collectReleaseOwnerVerdictReasons(releaseOwnerVerdict));
  const status = options.releaseMode === 'draft_candidate'
    ? 'diagnostic_only'
    : blockedReasons.length === 0 ? 'ready_to_promote' : 'blocked';

  const record = {
    schema: 'opl_release_candidate_record.v1',
    status,
    generated_at: new Date().toISOString(),
    release_repo: releaseRepo,
    version: options.version,
    tag: `v${options.version}`,
    release_mode: options.releaseMode,
    promotion_mode: options.promotionMode,
    inputs: {
      include_full_package: options.includeFullPackage,
      run_vm_smoke: options.runVmSmoke,
      shell_ref: options.shellRef,
      framework_ref: options.frameworkRef,
    },
    provenance: {
      app_commit: options.appCommit,
      workflow_run_id: options.workflowRunId,
      preflight_summary: options.preflightPath ? path.basename(options.preflightPath) : null,
      readiness_summary: options.readinessPath ? path.basename(options.readinessPath) : null,
      remote_verification_summary: options.remoteVerificationPath ? path.basename(options.remoteVerificationPath) : null,
      job_results: options.jobResultsPath ? path.basename(options.jobResultsPath) : null,
    },
    source_status: {
      preflight: statusOf(preflight),
      readiness: statusOf(readiness),
      remote_verification: statusOf(remote),
    },
    required_gate_failures: arrayOrEmpty(readiness?.failed_required_gates),
    blocked_reasons: blockedReasons,
    resolved_refs: extractResolvedRefs(readiness),
    remote_asset_summary: remote ? {
      verified_asset_count: remote.verified_asset_count ?? null,
      include_full_package: remote.include_full_package ?? null,
      full_first_install_budget: remote.full_first_install_budget ?? null,
    } : null,
    release_owner_verdict: releaseOwnerVerdict,
    job_results: jobResults,
    decision: {
      can_promote: status === 'ready_to_promote',
      promote_command: status === 'ready_to_promote'
        ? `gh release edit v${options.version} --repo ${releaseRepo} --draft=false --latest`
        : null,
      rule: 'Only ready_to_promote candidate records may publish a Stable draft release.',
    },
  };

  if (!allowedStatuses.includes(record.status as (typeof allowedStatuses)[number])) {
    throw new Error(`Unexpected candidate status: ${record.status}`);
  }
  return record;
}

function writeMarkdown(filePath: string, record: ReturnType<typeof buildRecord>) {
  if (!filePath) return;
  const lines = [
    '## Release Candidate Record',
    '',
    `- Status: ${record.status}`,
    `- Version: ${record.version}`,
    `- Release mode: ${record.release_mode}`,
    `- App commit: ${record.provenance.app_commit}`,
    `- Workflow run: ${record.provenance.workflow_run_id}`,
    `- Can promote: ${record.decision.can_promote}`,
    '',
    '| Source | Status |',
    '| --- | --- |',
    `| Preflight | ${record.source_status.preflight} |`,
    `| Readiness | ${record.source_status.readiness} |`,
    `| Remote verification | ${record.source_status.remote_verification} |`,
  ];
  if (record.blocked_reasons.length > 0) {
    lines.push('', '### Blocked reasons', '');
    for (const reason of record.blocked_reasons) lines.push(`- ${reason}`);
  }
  lines.push('');
  writeLinesFile(filePath, lines);
}

try {
  const options = parseArgs(process.argv.slice(2));
  const record = buildRecord(options);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  writeMarkdown(options.markdown, record);
  console.log(JSON.stringify(record, null, 2));
  if (record.status === 'blocked' && !options.allowBlocked) process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
