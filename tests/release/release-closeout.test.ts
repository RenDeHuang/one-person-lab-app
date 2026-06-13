import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot, writeJson } from './release-readiness/helpers.ts';

function runCloseout(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/closeout-release-run.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env },
    },
  );
}

function writeCloseoutArtifacts(root: string, version = '26.5.99') {
  writeJson(path.join(root, `release-preflight-summary-${version}`, 'release-preflight-summary.json'), {
    schema: 'opl_release_preflight.v1',
    status: 'passed',
  });
  writeJson(path.join(root, `remote-release-verification-${version}`, 'remote-release-verification.json'), {
    status: 'passed',
    version,
    include_full_package: true,
  });
  writeJson(path.join(root, `release-readiness-summary-${version}`, 'release-readiness-summary.json'), {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version,
    failed_required_gates: [],
    warnings: [],
    full_package: {
      duration_seconds: {
        full_package_build: 405,
        full_package_build_breakdown: {
          runtime_materialize: 20,
          runtime_cache_materialize: 8,
          payload_sync: 18,
          shell_build: 187,
          dmg_package_compression: 175,
          manifest_checksum: 5,
        },
      },
      cache: {
        full_runtime_layers: 'toolchain:true;domain-runtime:true;opl-runtime:true;skills:true',
      },
    },
  });
  writeJson(path.join(root, `release-candidate-record-${version}`, 'release-candidate-record.json'), {
    schema: 'opl_release_candidate_record.v1',
    status: 'ready_to_promote',
    version,
    blocked_reasons: [],
    required_gate_failures: [],
    decision: {
      can_promote: true,
      promote_command: `gh release edit v${version} --repo gaofeng21cn/one-person-lab-app --draft=false --latest`,
    },
  });
}

test('release closeout separates workflow wall time from Agent orchestration wall time and avoids large artifacts', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-closeout-'));
  const artifactsRoot = path.join(tempRoot, 'artifacts');
  const outDir = path.join(tempRoot, 'out');
  const runPath = path.join(tempRoot, 'run.json');
  const jobsPath = path.join(tempRoot, 'jobs.json');
  writeCloseoutArtifacts(artifactsRoot);
  writeJson(runPath, {
    status: 'completed',
    conclusion: 'success',
    createdAt: '2026-06-12T10:38:58Z',
    startedAt: '2026-06-12T10:38:58Z',
    updatedAt: '2026-06-12T11:18:25Z',
    workflowName: 'OPL Desktop Release',
    displayTitle: 'v26.5.99 stable release',
    headBranch: 'main',
    headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/12345',
  });
  writeJson(jobsPath, {
    jobs: [
      {
        name: 'Build Full first-install assets',
        status: 'completed',
        conclusion: 'success',
        startedAt: '2026-06-12T10:50:00Z',
        completedAt: '2026-06-12T11:04:42Z',
      },
      {
        name: 'Summarize release readiness',
        status: 'completed',
        conclusion: 'success',
        startedAt: '2026-06-12T11:17:00Z',
        completedAt: '2026-06-12T11:18:25Z',
      },
    ],
  });

  const result = runCloseout([
    '--version',
    '26.5.99',
    '--run-json',
    runPath,
    '--jobs-json',
    jobsPath,
    '--artifacts-dir',
    artifactsRoot,
    '--out-dir',
    outDir,
    '--no-download',
    '--agent-wall-time',
    '2h6m43s',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'release-closeout.json'), 'utf8'));
  assert.equal(summary.schema, 'opl_release_closeout_summary.v1');
  assert.equal(summary.run.timing.workflow_wall_time_seconds, 2367);
  assert.equal(summary.run.timing.queue_or_admission_seconds, 662);
  assert.equal(summary.run.timing.first_job_started_at, '2026-06-12T10:50:00.000Z');
  assert.equal(summary.run.timing.runner_execution_seconds, 1705);
  assert.equal(summary.clock_boundary.agent_orchestration_wall_time_seconds, 7603);
  assert.equal(summary.source_status.candidate_record, 'ready_to_promote');
  assert.equal(summary.decision.next_action, 'promote_from_candidate_record');
  assert.equal(summary.artifact_policy.downloads_large_artifacts, false);
  assert.deepEqual(summary.artifact_policy.downloaded_artifacts, []);
  assert.match(
    summary.artifact_policy.forbidden_large_artifact_patterns.join('\n'),
    /opl-full-first-install/,
  );
  assert.match(
    summary.operator_loop_optimization.reduced_manual_steps.join('\n'),
    /repeated gh run watch/,
  );
  assert.equal(summary.jobs.slowest_jobs[0].name, 'Build Full first-install assets');
  const markdown = fs.readFileSync(path.join(outDir, 'release-closeout.md'), 'utf8');
  assert.match(markdown, /GitHub Actions workflow wall time is the release execution KPI/);
  assert.match(markdown, /Agent orchestration wall time/);
  assert.match(markdown, /Full Package Timing/);
});

test('release closeout stops at readiness failed gates before raw log inspection', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-closeout-blocked-'));
  const artifactsRoot = path.join(tempRoot, 'artifacts');
  const outDir = path.join(tempRoot, 'out');
  const runPath = path.join(tempRoot, 'run.json');
  writeJson(path.join(artifactsRoot, 'release-readiness-summary-26.5.99', 'release-readiness-summary.json'), {
    schema: 'opl_release_readiness_summary.v1',
    status: 'failed',
    version: '26.5.99',
    failed_required_gates: [
      {
        id: 'homebrew_standard_cask_clean_vm',
        status: 'failed',
        reason: 'Homebrew VM smoke status is failed.',
      },
    ],
  });
  writeJson(runPath, {
    status: 'completed',
    conclusion: 'success',
    createdAt: '2026-06-12T10:00:00Z',
    startedAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:10:00Z',
  });

  const result = runCloseout([
    '--version',
    '26.5.99',
    '--run-json',
    runPath,
    '--artifacts-dir',
    artifactsRoot,
    '--out-dir',
    outDir,
    '--no-download',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'release-closeout.json'), 'utf8'));
  assert.equal(summary.decision.next_action, 'resolve_readiness_failed_gates');
  assert.match(summary.decision.command, /failed_required_gates/);
  assert.doesNotMatch(summary.decision.command, /--log-failed/);
  assert.deepEqual(summary.readiness.failed_required_gates, [
    {
      id: 'homebrew_standard_cask_clean_vm',
      status: 'failed',
      reason: 'Homebrew VM smoke status is failed.',
    },
  ]);
});

test('release closeout uses candidate record inside an in-progress workflow job', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-closeout-default-'));
  const artifactsRoot = path.join(tempRoot, 'release-closeout-inputs');
  const outDir = path.join(tempRoot, 'release-closeout');
  const runPath = path.join(tempRoot, 'run.json');
  const jobsPath = path.join(tempRoot, 'jobs.json');
  writeCloseoutArtifacts(artifactsRoot);
  writeJson(runPath, {
    databaseId: 12345,
    status: 'in_progress',
    conclusion: null,
    createdAt: '2026-06-12T10:38:58Z',
    startedAt: '2026-06-12T10:38:58Z',
    updatedAt: '2026-06-12T11:18:25Z',
    workflowName: 'OPL Desktop Release',
    url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/12345',
  });
  writeJson(jobsPath, {
    jobs: [
      {
        name: 'Summarize release readiness',
        status: 'in_progress',
        conclusion: null,
        startedAt: '2026-06-12T11:17:00Z',
        completedAt: null,
      },
    ],
  });

  const result = runCloseout([
    '--version',
    '26.5.99',
    '--run-json',
    runPath,
    '--jobs-json',
    jobsPath,
    '--artifacts-dir',
    artifactsRoot,
    '--out-dir',
    outDir,
    '--artifact-profile',
    'diagnostics',
    '--no-download',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'release-closeout.json'), 'utf8'));
  assert.equal(summary.run.status, 'in_progress');
  assert.equal(summary.source_status.candidate_record, 'ready_to_promote');
  assert.equal(summary.decision.next_action, 'promote_from_candidate_record');
  assert.doesNotMatch(summary.decision.reason, /not complete|wait/i);
  assert.equal(summary.artifact_policy.downloads_large_artifacts, false);
  assert.deepEqual(summary.artifact_policy.downloaded_artifacts, []);
  assert.match(summary.operator_loop_optimization.implemented_by, /desktop-release\.yml default release closeout artifact/);
  assert.match(summary.operator_loop_optimization.workflow_default_release_summary, /release-readiness-summary job uploads/);
});
