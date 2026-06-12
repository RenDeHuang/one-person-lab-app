#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseRepo = 'gaofeng21cn/one-person-lab-app';
const allowedStatuses = ['ready_to_promote', 'blocked', 'diagnostic_only'] as const;

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
  allowBlocked: boolean;
};

function parseBoolean(value: string | undefined, fallback = false) {
  if (value === undefined || value === '') return fallback;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new Error(`Boolean value must be true or false, got ${value}`);
}

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    version: process.env.OPL_RELEASE_VERSION || '',
    releaseMode: process.env.OPL_RELEASE_MODE || '',
    includeFullPackage: parseBoolean(process.env.OPL_INCLUDE_FULL_PACKAGE),
    runVmSmoke: parseBoolean(process.env.OPL_RUN_VM_SMOKE),
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
    allowBlocked: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--allow-blocked') {
      parsed.allowBlocked = true;
      continue;
    }
    if (token === '--include-full-package' || token === '--run-vm-smoke') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
      if (token === '--include-full-package') parsed.includeFullPackage = parseBoolean(value);
      else parsed.runVmSmoke = parseBoolean(value);
      index += 1;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    if (token === '--version') parsed.version = value;
    else if (token === '--release-mode') parsed.releaseMode = value;
    else if (token === '--app-commit') parsed.appCommit = value;
    else if (token === '--shell-ref') parsed.shellRef = value;
    else if (token === '--framework-ref') parsed.frameworkRef = value;
    else if (token === '--workflow-run-id') parsed.workflowRunId = value;
    else if (token === '--preflight') parsed.preflightPath = value;
    else if (token === '--readiness') parsed.readinessPath = value;
    else if (token === '--remote-verification') parsed.remoteVerificationPath = value;
    else if (token === '--job-results') parsed.jobResultsPath = value;
    else if (token === '--output') parsed.output = value;
    else if (token === '--markdown') parsed.markdown = value;
    else if (token === '--promotion-mode') parsed.promotionMode = value;
    else throw new Error(`Unknown argument: ${token}`);
    index += 1;
  }

  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.releaseMode.trim()) throw new Error('Pass --release-mode <mode> or set OPL_RELEASE_MODE.');
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

function objectOrNull(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function arrayOrEmpty(value: unknown) {
  return Array.isArray(value) ? value : [];
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
    const record = objectOrNull(gate);
    if (record) reasons.push(`required gate ${String(record.id ?? 'unknown')} ${String(record.status ?? 'failed')}: ${String(record.reason ?? 'no reason')}`);
  }
  return reasons;
}

function extractResolvedRefs(readiness: Record<string, unknown> | null) {
  const fullPackage = objectOrNull(readiness?.full_package);
  return objectOrNull(fullPackage?.resolved_refs);
}

function collectReleaseOwnerVerdictReasons(readiness: Record<string, unknown> | null) {
  const verdict = objectOrNull(readiness?.release_owner_verdict);
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
  ) {
    reasons.push(`release_owner_verdict status is ${String(verdict.status)}`);
  }
  if (verdict.status === 'release_owner_typed_blocker_required') {
    reasons.push('release_owner_verdict requires a release owner typed blocker before promotion');
  }
  if (
    verdict.status === 'release_owner_verdict_pending'
    && typeof verdict.release_owner_typed_blocker_ref !== 'string'
  ) {
    reasons.push('release_owner_verdict pending status must include release_owner_typed_blocker_ref');
  }
  return reasons;
}

function buildRecord(options: Options) {
  const preflight = objectOrNull(readJsonIfExists(options.preflightPath));
  const readiness = objectOrNull(readJsonIfExists(options.readinessPath));
  const remote = objectOrNull(readJsonIfExists(options.remoteVerificationPath));
  const jobResults = objectOrNull(readJsonIfExists(options.jobResultsPath)) ?? {};
  const blockedReasons = collectBlockedReasons(options, { preflight, readiness, remote });
  blockedReasons.push(...collectReleaseOwnerVerdictReasons(readiness));
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
    release_owner_verdict: objectOrNull(readiness?.release_owner_verdict),
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
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
