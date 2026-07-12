#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs as parseNodeArgs } from 'node:util';
import {
  buildReleaseCohortPlan,
  parseReleaseCohortPlanArgs,
  type ReleaseCohortPlan,
  type ReleaseCohortPlanOptions,
} from './plan-release-cohort.ts';

const defaultRepo = 'gaofeng21cn/one-person-lab-app';

export type StableReleasePhase =
  | 'planned'
  | 'source_gates_passed'
  | 'release_running'
  | 'owner_review_required'
  | 'release_failed'
  | 'promotion_running'
  | 'published'
  | 'promotion_failed';

export type StableReleaseSession = {
  schema: 'opl_app_stable_release_session.v1';
  id: string;
  created_at: string;
  updated_at: string;
  phase: StableReleasePhase;
  version: string;
  repo: string;
  cohort_plan: ReleaseCohortPlan;
  source_gates: Array<{
    id: string;
    command: string;
    status: 'pending' | 'passed' | 'failed';
  }>;
  release_run: {
    id: string | null;
    url: string | null;
    conclusion: string | null;
  };
  promotion_run: {
    id: string | null;
    url: string | null;
    conclusion: string | null;
  };
  release_owner_receipt_ref: string | null;
  transitions: Array<{
    at: string;
    from: StableReleasePhase | null;
    to: StableReleasePhase;
    reason: string;
  }>;
  efficiency_policy: {
    desktop_release_dispatch_limit_per_cohort: 1;
    monitor_interval_seconds: 60;
    run_id_discovery_timeout_seconds: 60;
    cross_cohort_artifact_reuse_allowed: false;
    rebuild_after_smoke_only_change_allowed: false;
  };
  authority_boundary: {
    session_is_release_truth: false;
    execute_flag_required_for_external_mutation: true;
    publish_requires_candidate_and_owner_receipt: true;
  };
};

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type StableReleaseCommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => CommandResult;

type StartOptions = {
  execute: boolean;
  watch: boolean;
  repo: string;
  statePath: string;
  cohort: ReleaseCohortPlanOptions;
};

type PromoteOptions = {
  execute: boolean;
  watch: boolean;
  repo: string;
  statePath: string;
  ownerReceiptRef: string;
};

type ResumeOptions = {
  statePath: string;
};

function run(command: string, args: string[], options: { cwd?: string } = {}): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function now(): string {
  return new Date().toISOString();
}

function failResult(result: CommandResult, label: string): never {
  const detail = result.stderr.trim() || result.stdout.trim() || `${label} failed`;
  throw new Error(`${label}: ${detail}`);
}

function writeSession(statePath: string, session: StableReleaseSession): void {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
}

function readSession(statePath: string): StableReleaseSession {
  const session = JSON.parse(fs.readFileSync(statePath, 'utf8')) as StableReleaseSession;
  if (session.schema !== 'opl_app_stable_release_session.v1') {
    throw new Error(`Unsupported stable release session schema in ${statePath}.`);
  }
  return session;
}

export function buildStableReleaseSession(
  plan: ReleaseCohortPlan,
  repo = defaultRepo,
  generatedAt = now(),
): StableReleaseSession {
  const identity = JSON.stringify({
    version: plan.version,
    operator_plan_ref: plan.operator_plan_ref,
    app_sha: plan.cohort_lock.app.resolved_sha,
    shell_sha: plan.cohort_lock.shell.resolved_sha,
    framework_sha: plan.cohort_lock.framework.resolved_sha,
  });
  return {
    schema: 'opl_app_stable_release_session.v1',
    id: `sha256:${crypto.createHash('sha256').update(identity).digest('hex')}`,
    created_at: generatedAt,
    updated_at: generatedAt,
    phase: 'planned',
    version: plan.version,
    repo,
    cohort_plan: plan,
    source_gates: plan.cheap_gates
      .filter((gate) => gate.id !== 'release_cohort_lock')
      .filter((gate, index, gates) => gates.findIndex((candidate) => candidate.command === gate.command) === index)
      .map((gate) => ({ id: gate.id, command: gate.command, status: 'pending' })),
    release_run: { id: null, url: null, conclusion: null },
    promotion_run: { id: null, url: null, conclusion: null },
    release_owner_receipt_ref: null,
    transitions: [{ at: generatedAt, from: null, to: 'planned', reason: 'immutable cohort planned' }],
    efficiency_policy: {
      desktop_release_dispatch_limit_per_cohort: 1,
      monitor_interval_seconds: 60,
      run_id_discovery_timeout_seconds: 60,
      cross_cohort_artifact_reuse_allowed: false,
      rebuild_after_smoke_only_change_allowed: false,
    },
    authority_boundary: {
      session_is_release_truth: false,
      execute_flag_required_for_external_mutation: true,
      publish_requires_candidate_and_owner_receipt: true,
    },
  };
}

const allowedTransitions: Record<StableReleasePhase, StableReleasePhase[]> = {
  planned: ['source_gates_passed', 'release_failed'],
  source_gates_passed: ['release_running', 'release_failed'],
  release_running: ['owner_review_required', 'release_failed'],
  owner_review_required: ['promotion_running'],
  release_failed: [],
  promotion_running: ['published', 'promotion_failed'],
  published: [],
  promotion_failed: ['promotion_running'],
};

export function transitionStableReleaseSession(
  session: StableReleaseSession,
  to: StableReleasePhase,
  reason: string,
  at = now(),
): StableReleaseSession {
  if (!allowedTransitions[session.phase].includes(to)) {
    throw new Error(`Invalid stable release transition: ${session.phase} -> ${to}.`);
  }
  return {
    ...session,
    phase: to,
    updated_at: at,
    transitions: [...session.transitions, { at, from: session.phase, to, reason }],
  };
}

function workflowRef(plan: ReleaseCohortPlan): string {
  const ref = plan.cohort_lock.app.requested_ref;
  if (/^[0-9a-f]{7,40}$/i.test(ref)) {
    throw new Error('Stable release dispatch requires the branch or tag recorded by the cohort plan, not a manually entered SHA.');
  }
  return ref;
}

export function desktopReleaseDispatchArgs(session: StableReleaseSession): string[] {
  const plan = session.cohort_plan;
  return [
    'workflow', 'run', 'desktop-release.yml',
    '--repo', session.repo,
    '--ref', workflowRef(plan),
    '--field', `opl_version=${plan.version}`,
    '--field', `release_mode=${plan.release_mode}`,
    '--field', `release_intent=${plan.release_intent}`,
    '--field', `full_omission_reason=${plan.full_omission_reason ?? ''}`,
    '--field', `release_operator_plan_ref=${plan.operator_plan_ref}`,
    '--field', `gate_reuse_plan_ref=${plan.gate_reuse_plan_ref ?? ''}`,
    '--field', `include_full_package=${String(plan.include_full_package)}`,
    '--field', `run_vm_smoke=${String(plan.run_vm_smoke)}`,
    '--field', `publish_docker_webui=${String(plan.publish_docker_webui)}`,
    '--field', `require_addon_gates_for_stable_readiness=${String(plan.release_intent === 'stable_complete')}`,
    '--field', `shell_ref=${plan.cohort_lock.shell.resolved_sha}`,
    '--field', `framework_ref=${plan.cohort_lock.framework.resolved_sha}`,
  ];
}

function verifyRemoteDispatchHead(
  runner: StableReleaseCommandRunner,
  session: StableReleaseSession,
): void {
  const ref = workflowRef(session.cohort_plan);
  const result = runner('gh', [
    'api', `repos/${session.repo}/commits/${encodeURIComponent(ref)}`, '--jq', '.sha',
  ]);
  if (result.status !== 0) failResult(result, `resolve remote App dispatch ref ${ref}`);
  const actual = result.stdout.trim().toLowerCase();
  const expected = session.cohort_plan.cohort_lock.app.resolved_sha.toLowerCase();
  if (actual !== expected) {
    throw new Error(
      `Remote App dispatch ref moved after cohort freeze: expected ${expected}, got ${actual || '<missing>'}. Freeze a new cohort instead of dispatching stale inputs.`,
    );
  }
}

export function promoteDispatchArgs(session: StableReleaseSession, ownerReceiptRef: string): string[] {
  if (!session.release_run.id) throw new Error('Stable release session has no source release run id.');
  if (!ownerReceiptRef.trim()) throw new Error('Promotion requires a same-cohort release owner receipt ref.');
  return [
    'workflow', 'run', 'desktop-release-promote.yml',
    '--repo', session.repo,
    '--ref', workflowRef(session.cohort_plan),
    '--field', `opl_version=${session.version}`,
    '--field', `include_full_package=${String(session.cohort_plan.include_full_package)}`,
    '--field', `require_docker_webui=${String(session.cohort_plan.publish_docker_webui)}`,
    '--field', `release_run_id=${session.release_run.id}`,
    '--field', `release_owner_receipt_ref=${ownerReceiptRef}`,
    '--field', `shell_ref=${session.cohort_plan.cohort_lock.shell.resolved_sha}`,
  ];
}

type WorkflowRun = {
  databaseId: number;
  createdAt: string;
  headBranch: string;
  headSha: string;
  status: string;
  conclusion?: string;
  url: string;
};

function listRuns(runner: StableReleaseCommandRunner, workflow: string, repo: string): WorkflowRun[] {
  const result = runner('gh', [
    'run', 'list', '--repo', repo, '--workflow', workflow, '--event', 'workflow_dispatch', '--limit', '30',
    '--json', 'databaseId,createdAt,headBranch,headSha,status,conclusion,url',
  ]);
  if (result.status !== 0) failResult(result, `list ${workflow} runs`);
  return JSON.parse(result.stdout) as WorkflowRun[];
}

export function selectNewCohortRun(
  runs: WorkflowRun[],
  previousIds: Set<number>,
  expectedHead: string | null,
  expectedBranch: string,
  dispatchedAt: string,
): WorkflowRun | null {
  const earliest = Date.parse(dispatchedAt) - 5_000;
  return runs
    .filter((candidate) => (
      !previousIds.has(candidate.databaseId)
      && candidate.headBranch === expectedBranch
      && (expectedHead === null || candidate.headSha.toLowerCase() === expectedHead.toLowerCase())
      && Date.parse(candidate.createdAt) >= earliest
    ))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function discoverRun(
  runner: StableReleaseCommandRunner,
  workflow: string,
  session: StableReleaseSession,
  previousIds: Set<number>,
  dispatchedAt: string,
  expectedHead: string | null,
): Promise<WorkflowRun> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = selectNewCohortRun(
      listRuns(runner, workflow, session.repo),
      previousIds,
      expectedHead,
      workflowRef(session.cohort_plan),
      dispatchedAt,
    );
    if (candidate) return candidate;
    await delay(3_000);
  }
  throw new Error(`Unable to discover the exact ${workflow} run within 60 seconds; session was not advanced.`);
}

function watchRun(runner: StableReleaseCommandRunner, session: StableReleaseSession, runId: string): CommandResult {
  return runner('gh', ['run', 'watch', runId, '--repo', session.repo, '--interval', '60', '--exit-status']);
}

function runView(runner: StableReleaseCommandRunner, session: StableReleaseSession, runId: string): WorkflowRun {
  const result = runner('gh', [
    'run', 'view', runId, '--repo', session.repo,
    '--json', 'databaseId,createdAt,headBranch,headSha,status,conclusion,url',
  ]);
  if (result.status !== 0) failResult(result, `read workflow run ${runId}`);
  return JSON.parse(result.stdout) as WorkflowRun;
}

async function dispatchAndWatchRelease(
  session: StableReleaseSession,
  statePath: string,
  watch: boolean,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  if (session.release_run.id) throw new Error('This frozen cohort already has a desktop release run; refusing a second dispatch.');
  verifyRemoteDispatchHead(runner, session);
  const previousIds = new Set(listRuns(runner, 'desktop-release.yml', session.repo).map((candidate) => candidate.databaseId));
  const dispatchedAt = now();
  const dispatch = runner('gh', desktopReleaseDispatchArgs(session));
  if (dispatch.status !== 0) failResult(dispatch, 'dispatch desktop release');
  const releaseRun = await discoverRun(
    runner,
    'desktop-release.yml',
    session,
    previousIds,
    dispatchedAt,
    session.cohort_plan.cohort_lock.app.resolved_sha,
  );
  session = transitionStableReleaseSession(session, 'release_running', `desktop release run ${releaseRun.databaseId} dispatched`);
  session.release_run = { id: String(releaseRun.databaseId), url: releaseRun.url, conclusion: null };
  writeSession(statePath, session);
  if (!watch) return session;

  const watched = watchRun(runner, session, String(releaseRun.databaseId));
  const readback = runView(runner, session, String(releaseRun.databaseId));
  session.release_run = {
    id: String(readback.databaseId),
    url: readback.url,
    conclusion: readback.conclusion ?? (watched.status === 0 ? 'success' : 'failure'),
  };
  session = transitionStableReleaseSession(
    session,
    watched.status === 0 ? 'owner_review_required' : 'release_failed',
    watched.status === 0 ? 'release workflow completed; owner review is required before promotion' : 'release workflow failed',
  );
  writeSession(statePath, session);
  return session;
}

async function dispatchAndWatchPromotion(
  session: StableReleaseSession,
  statePath: string,
  ownerReceiptRef: string,
  watch: boolean,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  const previousIds = new Set(listRuns(runner, 'desktop-release-promote.yml', session.repo).map((candidate) => candidate.databaseId));
  const dispatchedAt = now();
  const dispatch = runner('gh', promoteDispatchArgs(session, ownerReceiptRef));
  if (dispatch.status !== 0) failResult(dispatch, 'dispatch stable promotion');
  const promotionRun = await discoverRun(
    runner,
    'desktop-release-promote.yml',
    session,
    previousIds,
    dispatchedAt,
    null,
  );
  session = transitionStableReleaseSession(session, 'promotion_running', `promotion run ${promotionRun.databaseId} dispatched`);
  session.promotion_run = { id: String(promotionRun.databaseId), url: promotionRun.url, conclusion: null };
  session.release_owner_receipt_ref = ownerReceiptRef;
  writeSession(statePath, session);
  if (!watch) return session;

  const watched = watchRun(runner, session, String(promotionRun.databaseId));
  const readback = runView(runner, session, String(promotionRun.databaseId));
  session.promotion_run = {
    id: String(readback.databaseId),
    url: readback.url,
    conclusion: readback.conclusion ?? (watched.status === 0 ? 'success' : 'failure'),
  };
  session = transitionStableReleaseSession(
    session,
    watched.status === 0 ? 'published' : 'promotion_failed',
    watched.status === 0 ? 'promotion workflow and public release readback passed' : 'promotion workflow failed',
  );
  writeSession(statePath, session);
  return session;
}

async function resumeSession(
  options: ResumeOptions,
  runner: StableReleaseCommandRunner,
): Promise<StableReleaseSession> {
  let session = readSession(options.statePath);
  const isRelease = session.phase === 'release_running';
  const isPromotion = session.phase === 'promotion_running';
  if (!isRelease && !isPromotion) {
    throw new Error(`Resume requires release_running or promotion_running state, got ${session.phase}.`);
  }
  const runId = isRelease ? session.release_run.id : session.promotion_run.id;
  if (!runId) throw new Error(`Session phase ${session.phase} has no workflow run id.`);
  const watched = watchRun(runner, session, runId);
  const readback = runView(runner, session, runId);
  if (isRelease) {
    session.release_run = {
      id: String(readback.databaseId),
      url: readback.url,
      conclusion: readback.conclusion ?? (watched.status === 0 ? 'success' : 'failure'),
    };
    session = transitionStableReleaseSession(
      session,
      watched.status === 0 ? 'owner_review_required' : 'release_failed',
      watched.status === 0 ? 'release workflow completed; owner review is required before promotion' : 'release workflow failed',
    );
  } else {
    session.promotion_run = {
      id: String(readback.databaseId),
      url: readback.url,
      conclusion: readback.conclusion ?? (watched.status === 0 ? 'success' : 'failure'),
    };
    session = transitionStableReleaseSession(
      session,
      watched.status === 0 ? 'published' : 'promotion_failed',
      watched.status === 0 ? 'promotion workflow and public release readback passed' : 'promotion workflow failed',
    );
  }
  writeSession(options.statePath, session);
  return session;
}

function parseStartArgs(argv: string[]): StartOptions {
  const trainArgs: string[] = [];
  let execute = false;
  let watch = true;
  let repo = defaultRepo;
  let statePath = '';
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--execute') {
      execute = true;
      continue;
    }
    if (token === '--no-watch') {
      watch = false;
      continue;
    }
    if (token === '--repo' || token === '--state') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}.`);
      if (token === '--repo') repo = value;
      else statePath = value;
      index += 1;
      continue;
    }
    trainArgs.push(token);
  }
  const cohort = parseReleaseCohortPlanArgs(trainArgs);
  return {
    execute,
    watch,
    repo,
    statePath: path.resolve(statePath || `release-session-v${cohort.version}.json`),
    cohort,
  };
}

function parsePromoteArgs(argv: string[]): PromoteOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      execute: { type: 'boolean' },
      'no-watch': { type: 'boolean' },
      repo: { type: 'string' },
      state: { type: 'string' },
      'release-owner-receipt-ref': { type: 'string' },
    },
  });
  if (!values.state) throw new Error('Pass --state <release-session.json>.');
  return {
    execute: values.execute === true,
    watch: values['no-watch'] !== true,
    repo: values.repo || defaultRepo,
    statePath: path.resolve(values.state),
    ownerReceiptRef: values['release-owner-receipt-ref'] || '',
  };
}

function parseResumeArgs(argv: string[]): ResumeOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: { state: { type: 'string' } },
  });
  if (!values.state) throw new Error('Pass --state <release-session.json>.');
  return { statePath: path.resolve(values.state) };
}

function printSession(session: StableReleaseSession): void {
  process.stdout.write(`${JSON.stringify(session, null, 2)}\n`);
}

async function start(options: StartOptions, runner: StableReleaseCommandRunner): Promise<StableReleaseSession> {
  let session = buildStableReleaseSession(buildReleaseCohortPlan(options.cohort), options.repo);
  writeSession(options.statePath, session);
  if (!options.execute) return session;

  for (let index = 0; index < session.source_gates.length; index += 1) {
    const gate = session.source_gates[index];
    const result = runner('bash', ['-lc', gate.command]);
    session.source_gates[index] = { ...gate, status: result.status === 0 ? 'passed' : 'failed' };
    writeSession(options.statePath, session);
    if (result.status !== 0) {
      session = transitionStableReleaseSession(session, 'release_failed', `source gate ${gate.id} failed`);
      writeSession(options.statePath, session);
      failResult(result, `source gate ${gate.id}`);
    }
  }
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'all deduplicated cheap source gates passed');
  writeSession(options.statePath, session);
  return dispatchAndWatchRelease(session, options.statePath, options.watch, runner);
}

async function promote(options: PromoteOptions, runner: StableReleaseCommandRunner): Promise<StableReleaseSession> {
  let session = readSession(options.statePath);
  if (session.phase !== 'owner_review_required' && session.phase !== 'promotion_failed') {
    throw new Error(`Promotion requires owner_review_required or promotion_failed state, got ${session.phase}.`);
  }
  if (!options.execute) return session;
  return dispatchAndWatchPromotion(session, options.statePath, options.ownerReceiptRef, options.watch, runner);
}

async function main(): Promise<void> {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`Usage:\n  npm run release:stable -- start <cohort options> [--state <path>] [--execute] [--no-watch]\n  npm run release:stable -- resume --state <path>\n  npm run release:stable -- promote --state <path> --release-owner-receipt-ref <ref> [--execute] [--no-watch]\n\nDry-run is the default. External workflow dispatch requires --execute.\n`);
    return;
  }
  if (command === 'start' || command === 'plan') {
    const options = parseStartArgs(argv);
    printSession(await start({ ...options, execute: command === 'plan' ? false : options.execute }, run));
    return;
  }
  if (command === 'promote') {
    printSession(await promote(parsePromoteArgs(argv), run));
    return;
  }
  if (command === 'resume') {
    printSession(await resumeSession(parseResumeArgs(argv), run));
    return;
  }
  throw new Error(`Unknown release:stable command: ${command}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
