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

test('GitHub Actions timing summarizer profiles multi-run release wall time and failed run tax', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-actions-timing-'));
  const runJsonPath = path.join(tempRoot, 'runs.json');
  const outputPath = path.join(tempRoot, 'actions-timing.json');
  const markdownPath = path.join(tempRoot, 'actions-timing.md');

  writeJson(runJsonPath, {
    runs: [
      {
        databaseId: 27732095094,
        workflowName: 'OPL Desktop Release',
        status: 'completed',
        conclusion: 'cancelled',
        createdAt: '2026-06-18T02:08:57Z',
        updatedAt: '2026-06-18T02:13:36Z',
        jobs: [
          {
            name: 'Build standard App assets / TypeScript type check',
            status: 'completed',
            conclusion: 'cancelled',
            startedAt: '2026-06-18T02:09:18Z',
            completedAt: '2026-06-18T02:13:31Z',
            steps: [
              {
                name: 'Setup active shell dependencies',
                status: 'completed',
                conclusion: 'success',
                startedAt: '2026-06-18T02:09:25Z',
                completedAt: '2026-06-18T02:11:25Z',
              },
            ],
          },
        ],
      },
      {
        databaseId: 27732257823,
        workflowName: 'OPL Desktop Release',
        status: 'completed',
        conclusion: 'failure',
        createdAt: '2026-06-18T02:13:52Z',
        updatedAt: '2026-06-18T02:46:27Z',
        jobs: [
          {
            name: 'Build Full first-install assets / Build App-owned Full first-install DMG',
            status: 'completed',
            conclusion: 'failure',
            startedAt: '2026-06-18T02:14:10Z',
            completedAt: '2026-06-18T02:46:20Z',
            steps: [
              {
                name: 'Build Full first-install package',
                status: 'completed',
                conclusion: 'failure',
                startedAt: '2026-06-18T02:20:00Z',
                completedAt: '2026-06-18T02:46:00Z',
              },
            ],
          },
        ],
      },
      {
        databaseId: 27740551584,
        workflowName: 'OPL Desktop Release',
        status: 'completed',
        conclusion: 'success',
        createdAt: '2026-06-18T06:13:49Z',
        updatedAt: '2026-06-18T06:46:15Z',
        jobs: [
          {
            name: 'Build Full first-install assets / Build App-owned Full first-install DMG',
            status: 'completed',
            conclusion: 'success',
            startedAt: '2026-06-18T06:15:24Z',
            completedAt: '2026-06-18T06:29:10Z',
            steps: [
              {
                name: 'Build Full first-install package',
                status: 'completed',
                conclusion: 'success',
                startedAt: '2026-06-18T06:19:25Z',
                completedAt: '2026-06-18T06:24:12Z',
              },
              {
                name: 'Upload Full package workflow artifact',
                status: 'completed',
                conclusion: 'success',
                startedAt: '2026-06-18T06:28:26Z',
                completedAt: '2026-06-18T06:28:58Z',
              },
            ],
          },
          {
            name: 'Run clean Full first-run VM smoke / Clean VM first launch',
            status: 'completed',
            conclusion: 'success',
            startedAt: '2026-06-18T06:34:37Z',
            completedAt: '2026-06-18T06:45:10Z',
            steps: [
              {
                name: 'Checkout active shell',
                status: 'completed',
                conclusion: 'success',
                startedAt: '2026-06-18T06:34:51Z',
                completedAt: '2026-06-18T06:37:28Z',
              },
              {
                name: 'Download release DMG artifact',
                status: 'completed',
                conclusion: 'success',
                startedAt: '2026-06-18T06:37:32Z',
                completedAt: '2026-06-18T06:41:01Z',
              },
            ],
          },
        ],
      },
      {
        databaseId: 27741971528,
        workflowName: 'OPL Desktop Release Promote',
        status: 'completed',
        conclusion: 'success',
        createdAt: '2026-06-18T06:48:11Z',
        updatedAt: '2026-06-18T07:03:33Z',
        jobs: [
          {
            name: 'Run Homebrew standard first-run VM smoke / Clean VM first launch',
            status: 'completed',
            conclusion: 'success',
            startedAt: '2026-06-18T06:50:50Z',
            completedAt: '2026-06-18T07:03:32Z',
            steps: [
              {
                name: 'Checkout active shell',
                status: 'completed',
                conclusion: 'success',
                startedAt: '2026-06-18T06:51:02Z',
                completedAt: '2026-06-18T06:56:37Z',
              },
              {
                name: 'Run clean VM first launch smoke',
                status: 'completed',
                conclusion: 'success',
                startedAt: '2026-06-18T06:56:50Z',
                completedAt: '2026-06-18T07:02:58Z',
              },
            ],
          },
        ],
      },
    ],
  });

  const result = runTimingSummary([
    '--run-json',
    runJsonPath,
    '--agent-wall-time',
    '5h45m51s',
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
  assert.deepEqual(summary.conclusion_counts, {
    cancelled: 1,
    failure: 1,
    success: 2,
  });
  assert.equal(summary.runs[0].id, '27732095094');
  assert.equal(summary.runs[0].queue_or_admission_seconds, 21);
  assert.equal(summary.top_jobs[0].name, 'Build Full first-install assets / Build App-owned Full first-install DMG');
  assert.equal(summary.top_steps[0].name, 'Build Full first-install package');
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Failed\/cancelled run tax: 37m14s across 2 run/);
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Unaccounted operator time outside Actions span: 51m15s/);
});

test('GitHub Actions timing summarizer does not count in-progress runs as failed tax', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-actions-timing-running-'));
  const runJsonPath = path.join(tempRoot, 'runs.json');
  const outputPath = path.join(tempRoot, 'actions-timing.json');

  writeJson(runJsonPath, {
    runs: [
      {
        databaseId: 27866803313,
        workflowName: 'OPL Desktop Release',
        status: 'in_progress',
        conclusion: '',
        createdAt: '2026-06-20T09:19:26Z',
        updatedAt: '2026-06-20T09:50:48Z',
        jobs: [
          {
            name: 'Build Full first-install assets / Build App-owned Full first-install DMG',
            status: 'completed',
            conclusion: 'success',
            startedAt: '2026-06-20T09:19:50Z',
            completedAt: '2026-06-20T09:35:46Z',
          },
        ],
      },
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
