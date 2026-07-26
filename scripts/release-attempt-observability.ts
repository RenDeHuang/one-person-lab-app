#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

type JsonRecord = Record<string, any>;

export type ReleaseAttemptStage =
  | 'freeze_version_notes_contract'
  | 'build_source_signing_tests'
  | 'native_webui'
  | 'clean_vm'
  | 'checkpoint_restore'
  | 'updater_predecessor'
  | 'homebrew_latest'
  | 'workflow_cancelled'
  | 'unknown';

const terminalFailureConclusions = new Set([
  'failure',
  'cancelled',
  'timed_out',
  'action_required',
  'startup_failure',
  'stale',
]);

function object(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value as JsonRecord;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is missing.`);
  return value.trim();
}

function durationMinutes(startedAt: string, completedAt: string): number {
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  if (!Number.isFinite(duration) || duration < 0) return 0;
  return Number((duration / 60_000).toFixed(3));
}

export function classifyReleaseAttemptStage(jobName: string): ReleaseAttemptStage {
  const name = jobName.toLowerCase();
  if (/freeze|version|notes|contract|admission/.test(name)) return 'freeze_version_notes_contract';
  if (/native.*webui|webui.*native/.test(name)) return 'native_webui';
  if (/first.?run|clean.*vm|tart|standard qualification/.test(name)) return 'clean_vm';
  if (/checkpoint|restore|resume/.test(name)) return 'checkpoint_restore';
  if (/updater|predecessor|upgrade/.test(name)) return 'updater_predecessor';
  if (/homebrew|latest|activate/.test(name)) return 'homebrew_latest';
  if (/build|source|sign|notari|test|lint|type|format/.test(name)) return 'build_source_signing_tests';
  return 'unknown';
}

export function buildReleaseAttemptObservation(runValue: unknown, jobsValue: unknown) {
  const run = object(runValue, 'Release workflow run');
  const jobsPayload = object(jobsValue, 'Release workflow jobs');
  if (
    run.repository?.full_name !== 'gaofeng21cn/one-person-lab-app'
    || run.path !== '.github/workflows/release-stable.yml'
    || run.event !== 'workflow_dispatch'
    || run.run_attempt !== 1
    || run.status !== 'completed'
    || !/^[0-9a-f]{40}$/.test(String(run.head_sha ?? ''))
  ) {
    throw new Error('Release attempt observation requires one completed first-attempt Stable workflow_dispatch run.');
  }
  const jobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs : [];
  const failures = jobs
    .map((entry) => object(entry, 'Release workflow job'))
    .filter((job) => terminalFailureConclusions.has(String(job.conclusion ?? '')))
    .sort((left, right) => {
      const completed = Date.parse(String(left.completed_at ?? '')) - Date.parse(String(right.completed_at ?? ''));
      if (Number.isFinite(completed) && completed !== 0) return completed;
      return Number(left.id ?? 0) - Number(right.id ?? 0);
    });
  const first = failures[0] ?? null;
  const conclusion = requiredString(run.conclusion, 'Release run conclusion');
  const stage: ReleaseAttemptStage = first
    ? classifyReleaseAttemptStage(requiredString(first.name, 'First terminal job name'))
    : conclusion === 'cancelled'
      ? 'workflow_cancelled'
      : 'unknown';
  return {
    schema: 'opl_release_attempt_observation.v1',
    status: 'observed',
    observed_at: new Date().toISOString(),
    authority: {
      release_state_authority: false,
      framework_status_authority: false,
      mutation_authority: false,
      may_authorize_retry_rerun_or_redispatch: false,
    },
    run: {
      id: String(run.id),
      attempt: run.run_attempt,
      workflow: run.path,
      head_sha: run.head_sha,
      conclusion,
      started_at: run.run_started_at ?? run.created_at,
      completed_at: run.updated_at,
      wall_minutes: durationMinutes(String(run.run_started_at ?? run.created_at), String(run.updated_at)),
    },
    first_terminal: first
      ? {
          job_id: String(first.id),
          job_name: first.name,
          conclusion: first.conclusion,
          completed_at: first.completed_at,
          stage,
        }
      : {
          job_id: null,
          job_name: null,
          conclusion,
          completed_at: run.updated_at,
          stage,
        },
    job_count: jobs.length,
    terminal_failure_job_count: failures.length,
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      run: { type: 'string' },
      jobs: { type: 'string' },
      output: { type: 'string' },
    },
    strict: true,
  });
  if (!values.run || !values.jobs || !values.output) throw new Error('Usage: release-attempt-observability.ts --run <json> --jobs <json> --output <json>.');
  const observation = buildReleaseAttemptObservation(
    JSON.parse(fs.readFileSync(values.run, 'utf8')),
    JSON.parse(fs.readFileSync(values.jobs, 'utf8')),
  );
  const output = path.resolve(values.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(observation, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ status: 'observed', output, stage: observation.first_terminal.stage })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
