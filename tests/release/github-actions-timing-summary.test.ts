import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot, writeJson } from './release-readiness/helpers.ts';

function runTimingSummary(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/summarize-github-actions-timing.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
    },
  );
}

const timestamp = (day: string, time: string) => `2026-06-${day}T${time}Z`;

function step(name: string, startedAt: string, completedAt: string, conclusion = 'success', day = '18') {
  return {
    name,
    status: 'completed',
    conclusion,
    startedAt: timestamp(day, startedAt),
    completedAt: timestamp(day, completedAt),
  };
}

function job(name: string, startedAt: string, completedAt: string, conclusion: string, steps = [], day = '18') {
  return { ...step(name, startedAt, completedAt, conclusion, day), steps };
}

function run(
  databaseId: number,
  createdAt: string,
  updatedAt: string,
  conclusion: string,
  jobs: unknown[],
  workflowName = 'OPL Desktop Release',
  day = '18',
) {
  return {
    databaseId,
    workflowName,
    status: conclusion ? 'completed' : 'in_progress',
    conclusion,
    createdAt: timestamp(day, createdAt),
    updatedAt: timestamp(day, updatedAt),
    jobs,
  };
}

test('GitHub Actions timing summarizer profiles multi-run release wall time and failed run tax', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-actions-timing-'));
  const runJsonPath = path.join(tempRoot, 'runs.json');
  const outputPath = path.join(tempRoot, 'actions-timing.json');
  const markdownPath = path.join(tempRoot, 'actions-timing.md');

  writeJson(runJsonPath, {
    runs: [
      run(27732095094, '02:08:57', '02:13:36', 'cancelled', [
        job('Build standard App assets / TypeScript type check', '02:09:18', '02:13:31', 'cancelled', [
          step('Setup active shell dependencies', '02:09:25', '02:11:25'),
        ]),
      ]),
      run(27732257823, '02:13:52', '02:46:27', 'failure', [
        job('Build Full first-install assets / Build App-owned Full first-install DMG', '02:14:10', '02:46:20', 'failure', [
          step('Build Full first-install package', '02:20:00', '02:46:00', 'failure'),
        ]),
      ]),
      run(27740551584, '06:13:49', '06:46:15', 'success', [
        job('Build Full first-install assets / Build App-owned Full first-install DMG', '06:15:24', '06:29:10', 'success', [
          step('Build Full first-install package', '06:19:25', '06:24:12'),
          step('Upload Full package workflow artifact', '06:28:26', '06:28:58'),
        ]),
        job('Finalize Full DMG on ARM', '06:30:00', '06:34:00', 'success', [
          step('Finalize Full Developer ID signing and notarization on ARM', '06:31:00', '06:33:00'),
        ]),
        job('Publish Standard GitHub Release assets', '06:45:20', '06:48:20', 'success'),
        job('Resolve release set identity', '06:48:25', '06:52:25', 'success'),
        job('Upload skipped certification evidence', '06:52:30', '06:56:30', 'skipped'),
        job('Run clean Full first-run VM smoke / Clean VM first launch', '06:34:37', '06:45:10', 'success', [
          step('Checkout active shell', '06:34:51', '06:37:28'),
          step('Download release DMG artifact', '06:37:32', '06:41:01'),
        ]),
      ]),
      run(27741971528, '06:48:11', '07:03:33', 'success', [
        job('Run Homebrew standard first-run VM smoke / Clean VM first launch', '06:50:50', '07:03:32', 'success', [
          step('Checkout active shell', '06:51:02', '06:56:37'),
          step('Run clean VM first launch smoke', '06:56:50', '07:02:58'),
        ]),
      ], 'OPL Desktop Release Promote'),
    ],
  });

  const result = runTimingSummary([
    '--run-json',
    runJsonPath,
    '--agent-wall-time',
    '5h45m51s',
    '--operation-kind',
    'append_full',
    '--output',
    outputPath,
    '--markdown',
    markdownPath,
    '--top',
    '5',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.schema, 'opl_github_actions_timing_summary.v1');
  assert.equal(summary.timing.total_span_seconds, 17676);
  assert.equal(summary.timing.agent_wall_time_seconds, 20751);
  assert.equal(summary.timing.unaccounted_operator_seconds, 3075);
  assert.equal(summary.timing.failed_or_cancelled_run_count, 2);
  assert.equal(summary.timing.failed_or_cancelled_run_wall_seconds, 2234);
  assert.equal(summary.operation_kind, 'append_full');
  assert.equal(summary.source.operation_kind, 'append_full');
  assert.equal(summary.timing.recovery_gap_seconds, 12574);
  assert.deepEqual(summary.conclusion_counts, {
    cancelled: 1,
    failure: 1,
    success: 2,
  });
  assert.equal(summary.runs[0].id, '27732095094');
  assert.equal(summary.runs[0].queue_or_admission_seconds, 21);
  assert.equal(summary.top_jobs[0].name, 'Build Full first-install assets / Build App-owned Full first-install DMG');
  assert.equal(summary.top_steps[0].name, 'Build Full first-install package');
  assert.equal(summary.runs[1].stage_durations_seconds.build, 1930);
  assert.equal(summary.runs[2].stage_durations_seconds.apple_wait, 240);
  assert.equal(summary.runs[2].stage_durations_seconds.publication, 180);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Failed\/cancelled run tax: 37m14s across 2 run/);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Unaccounted operator time outside Actions span: 51m15s/);
});

test('GitHub Actions timing summarizer does not count in-progress runs as failed tax', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-actions-timing-running-'));
  const runJsonPath = path.join(tempRoot, 'runs.json');
  const outputPath = path.join(tempRoot, 'actions-timing.json');

  writeJson(runJsonPath, {
    runs: [
      run(27866803313, '09:19:26', '09:50:48', '', [
        job('Build Full first-install assets / Build App-owned Full first-install DMG', '09:19:50', '09:35:46', 'success', [], '20'),
      ], 'OPL Desktop Release', '20'),
    ],
  });

  const result = runTimingSummary([
    '--run-json',
    runJsonPath,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.deepEqual(summary.conclusion_counts, { in_progress: 1 });
  assert.equal(summary.timing.failed_or_cancelled_run_count, 0);
  assert.equal(summary.timing.failed_or_cancelled_run_wall_seconds, 0);
});
