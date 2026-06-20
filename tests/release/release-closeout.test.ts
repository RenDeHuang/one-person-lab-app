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

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function releaseOwnerVerdict(version = '26.5.99', options: {
  status?: string;
  releaseOwnerVerdictRef?: string | null;
  releaseOwnerReceiptRef?: string | null;
} = {}) {
  const status = options.status ?? 'release_owner_receipt_recorded';
  const typedBlockerRef = `typed_blocker_ref://one-person-lab-app/release-owner/v${version}/verdict-pending`;
  return {
    schema: 'opl_app_release_owner_verdict_readout.v1',
    scope: 'same_cohort_app_release_user_path_owner_verdict',
    owner: 'one-person-lab-app release owner',
    status,
    release_ready_claim: false,
    stable_latest_promotion_claim: false,
    family_production_ready_claim: false,
    release_owner_verdict_ref: options.releaseOwnerVerdictRef ?? null,
    release_owner_receipt_ref: options.releaseOwnerReceiptRef
      ?? (status === 'release_owner_receipt_recorded'
        ? `release_owner_receipt_ref://one-person-lab-app/release-owner/v${version}/receipt-test`
        : null),
    install_evidence_ref: `install_evidence_ref://one-person-lab-app/release-owner/v${version}/install-evidence`,
    release_owner_typed_blocker_ref: typedBlockerRef,
    typed_blocker_ref: typedBlockerRef,
  };
}

function writeCloseoutArtifacts(root: string, version = '26.5.99', options: {
  releaseOwnerVerdict?: Record<string, unknown>;
} = {}) {
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
      runtime_cache: {
        layer_status_counts: { hit: 2, miss_written: 1 },
        miss_written_layers: ['domain-runtime'],
        miss_written_count: 1,
        written_layers: ['domain-runtime'],
        written_layer_count: 1,
      },
      size_budget: {
        full_dmg_size_bytes: 865000000,
        warning_full_dmg_bytes: 700000000,
        max_full_dmg_bytes: 750000000,
        full_dmg_size_status: 'warning',
      },
      size_analysis: {
        schema: 'opl_full_package_size_summary.v1',
        source: 'test_fixture',
        budget: {
          compressed_full_dmg: {
            full_dmg_size_bytes: 865000000,
            warning_full_dmg_bytes: 700000000,
            max_full_dmg_bytes: 750000000,
            warning_status: 'warning',
            review_threshold_status: 'above_review_threshold',
            release_blocking: false,
          },
        },
        optimization_candidates: [
          { rank: 1, kind: 'layer', id: 'toolchain', size_bytes: 512000000, reason: 'largest_runtime_layer' },
          { rank: 2, kind: 'component', id: 'codex', size_bytes: 384000000, reason: 'largest_packaged_component' },
        ],
      },
    },
  });
  writeJson(path.join(root, `release-candidate-record-${version}`, 'release-candidate-record.json'), {
    schema: 'opl_release_candidate_record.v1',
    status: 'ready_to_promote',
    version,
    blocked_reasons: [],
    required_gate_failures: [],
    release_owner_verdict: options.releaseOwnerVerdict ?? releaseOwnerVerdict(version),
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
    databaseId: '12345',
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
    previous_runs: [
      {
        id: '12222',
        status: 'completed',
        conclusion: 'failure',
        createdAt: '2026-06-12T09:00:00Z',
        updatedAt: '2026-06-12T09:31:01Z',
        url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/12222',
      },
    ],
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
  const stdout = JSON.parse(result.stdout);
  const summary = readJson(path.join(outDir, 'release-closeout.json'));
  const monitor = readJson(path.join(outDir, 'release-monitor.json'));
  const notification = readJson(path.join(outDir, 'release-notification.json'));
  assert.equal(summary.schema, 'opl_release_closeout_summary.v1');
  assert.equal(stdout.status, 'ready_to_promote');
  assert.equal(stdout.monitor_state, 'ready_to_promote');
  assert.equal(stdout.monitor, path.relative(appRoot, path.join(outDir, 'release-monitor.json')));
  assert.equal(stdout.notification, path.relative(appRoot, path.join(outDir, 'release-notification.json')));
  assert.equal(summary.monitor.schema, 'opl_release_run_monitor.v1');
  assert.equal(summary.monitor.state, 'ready_to_promote');
  assert.equal(summary.notification_payload.schema, 'opl_release_run_notification.v1');
  assert.equal(monitor.schema, 'opl_release_run_monitor.v1');
  assert.equal(monitor.state, 'ready_to_promote');
  assert.equal(monitor.recommended_next_action.action, 'promote_from_candidate_record');
  assert.equal(monitor.promote_ready, true);
  assert.equal(monitor.artifact_policy.downloads_large_artifacts, false);
  assert.match(monitor.no_watch_instructions.join('\n'), /gh run view 12345/);
  assert.match(monitor.no_watch_instructions.join('\n'), /release-monitor\.json/);
  assert.equal(notification.schema, 'opl_release_run_notification.v1');
  assert.equal(notification.state, 'ready_to_promote');
  assert.equal(notification.machine_payload, 'release-monitor.json');
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
  assert.equal(summary.failed_rerun_tax.failed_rerun_tax_seconds, 1861);
  assert.equal(summary.failed_rerun_tax.previous_failed_run_count, 1);
  assert.ok(summary.bottlenecks.some((entry) => entry.id === 'failed_rerun_tax'));
  assert.ok(summary.bottlenecks.some((entry) => entry.id === 'Build Full first-install assets'));
  assert.ok(summary.bottlenecks.some((entry) => entry.id === 'dmg_package_compression'));
  assert.ok(summary.bottlenecks.some((entry) => entry.id === 'full_dmg_size'));
  assert.ok(summary.bottlenecks.some((entry) => entry.id === 'runtime_cache_miss_written'));
  assert.ok(summary.optimization_recommendations.some((entry) => entry.id === 'profile_slowest_github_actions_job'));
  assert.ok(summary.optimization_recommendations.some((entry) => entry.id === 'reduce_failed_rerun_tax'));
  assert.ok(summary.optimization_recommendations.some((entry) => entry.id === 'review_full_size_optimization_candidates'));
  assert.ok(summary.optimization_recommendations.some((entry) => entry.id === 'seed_full_runtime_cache'));
  const markdown = fs.readFileSync(path.join(outDir, 'release-closeout.md'), 'utf8');
  assert.match(markdown, /GitHub Actions workflow wall time is the release execution KPI/);
  assert.match(markdown, /Agent orchestration wall time/);
  assert.match(markdown, /Full Package Timing/);
  assert.match(markdown, /Failed Rerun Tax/);
  assert.match(markdown, /Optimization Recommendations/);
  assert.match(markdown, /Full Size Optimization Candidates/);
  assert.match(markdown, /Runtime cache miss_written layers: domain-runtime/);
  assert.match(markdown, /Monitor state: ready_to_promote/);
  assert.match(markdown, /No-watch monitor/);
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
  const stdout = JSON.parse(result.stdout);
  const summary = readJson(path.join(outDir, 'release-closeout.json'));
  const monitor = readJson(path.join(outDir, 'release-monitor.json'));
  const notification = readJson(path.join(outDir, 'release-notification.json'));
  assert.equal(stdout.status, 'resolve_readiness_failed_gates');
  assert.equal(stdout.monitor_state, 'failed');
  assert.equal(monitor.state, 'failed');
  assert.equal(monitor.failed_gate_count, 1);
  assert.equal(notification.state, 'failed');
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

test('release closeout separates published release state from failed post-publish proof gates', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-closeout-post-publish-'));
  const artifactsRoot = path.join(tempRoot, 'artifacts');
  const outDir = path.join(tempRoot, 'out');
  const runPath = path.join(tempRoot, 'run.json');
  const jobsPath = path.join(tempRoot, 'jobs.json');
  writeJson(path.join(artifactsRoot, 'remote-release-verification-26.5.99', 'remote-release-verification.json'), {
    status: 'passed',
    version: '26.5.99',
    isDraft: false,
    publishedAt: '2026-06-20T09:54:13Z',
  });
  writeJson(path.join(artifactsRoot, 'release-preflight-summary-26.5.99', 'release-preflight-summary.json'), {
    schema: 'opl_release_preflight.v1',
    status: 'passed',
    release_target: { kind: 'draft_release' },
  });
  writeJson(runPath, {
    databaseId: '67890',
    status: 'completed',
    conclusion: 'failure',
    createdAt: '2026-06-20T09:52:53Z',
    startedAt: '2026-06-20T09:52:53Z',
    updatedAt: '2026-06-20T10:18:32Z',
    workflowName: 'OPL Desktop Release Promote',
    url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/67890',
  });
  writeJson(jobsPath, {
    jobs: [
      {
        name: 'Verify and publish draft release',
        status: 'completed',
        conclusion: 'success',
        startedAt: '2026-06-20T09:53:00Z',
        completedAt: '2026-06-20T09:54:19Z',
      },
      {
        name: 'Run Homebrew standard first-run VM smoke',
        status: 'completed',
        conclusion: 'failure',
        startedAt: '2026-06-20T09:54:34Z',
        completedAt: '2026-06-20T10:18:32Z',
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
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const stdout = JSON.parse(result.stdout);
  const summary = readJson(path.join(outDir, 'release-closeout.json'));
  const monitor = readJson(path.join(outDir, 'release-monitor.json'));
  assert.equal(stdout.status, 'resolve_post_publish_followup_gate');
  assert.equal(stdout.monitor_state, 'published_with_post_publish_followup');
  assert.equal(monitor.state, 'published_with_post_publish_followup');
  assert.equal(monitor.published, true);
  assert.equal(summary.decision.next_action, 'resolve_post_publish_followup_gate');
  assert.equal(summary.decision.post_publish.published_release_readback, true);
  assert.equal(summary.decision.post_publish.failed_followup_jobs[0].name, 'Run Homebrew standard first-run VM smoke');
  const markdown = fs.readFileSync(path.join(outDir, 'release-closeout.md'), 'utf8');
  assert.match(markdown, /Post-Publish Follow-Up/);
  assert.match(markdown, /Do not conflate published release\/tap state/);
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
  const stdout = JSON.parse(result.stdout);
  const summary = readJson(path.join(outDir, 'release-closeout.json'));
  const monitor = readJson(path.join(outDir, 'release-monitor.json'));
  const notification = readJson(path.join(outDir, 'release-notification.json'));
  assert.equal(stdout.status, 'ready_to_promote');
  assert.equal(stdout.monitor_state, 'ready_to_promote');
  assert.equal(summary.run.status, 'in_progress');
  assert.equal(summary.source_status.candidate_record, 'ready_to_promote');
  assert.equal(summary.decision.next_action, 'promote_from_candidate_record');
  assert.equal(monitor.state, 'ready_to_promote');
  assert.equal(notification.state, 'ready_to_promote');
  assert.doesNotMatch(summary.decision.reason, /not complete|wait/i);
  assert.equal(summary.artifact_policy.downloads_large_artifacts, false);
  assert.deepEqual(summary.artifact_policy.downloaded_artifacts, []);
  assert.match(summary.operator_loop_optimization.implemented_by, /desktop-release\.yml default release closeout artifact/);
  assert.match(summary.operator_loop_optimization.workflow_default_release_summary, /release-readiness-summary job uploads/);
});

test('release closeout requires owner-resolution validation before promote', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-closeout-owner-needed-'));
  const artifactsRoot = path.join(tempRoot, 'release-closeout-inputs');
  const outDir = path.join(tempRoot, 'release-closeout');
  const runPath = path.join(tempRoot, 'run.json');
  writeCloseoutArtifacts(artifactsRoot, '26.5.99', {
    releaseOwnerVerdict: releaseOwnerVerdict('26.5.99', {
      status: 'release_owner_verdict_pending',
      releaseOwnerReceiptRef: null,
    }),
  });
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
  const stdout = JSON.parse(result.stdout);
  const summary = readJson(path.join(outDir, 'release-closeout.json'));
  const monitor = readJson(path.join(outDir, 'release-monitor.json'));
  const notification = readJson(path.join(outDir, 'release-notification.json'));
  assert.equal(summary.source_status.candidate_record, 'ready_to_promote');
  assert.equal(summary.decision.next_action, 'owner_needed_release_owner_resolution');
  assert.match(summary.decision.reason, /Release owner verdict status is release_owner_verdict_pending/);
  assert.match(summary.decision.reason, /missing release_owner_verdict_ref or release_owner_receipt_ref/);
  assert.match(summary.decision.command, /validate-release-candidate-record\.ts --promote-ready/);
  assert.match(summary.decision.owner_resolution.typed_blocker_ref, /typed_blocker_ref:\/\/one-person-lab-app\/release-owner\/v26\.5\.99\/verdict-pending/);
  assert.equal(stdout.status, 'owner_needed_release_owner_resolution');
  assert.equal(stdout.monitor_state, 'failed');
  assert.equal(monitor.state, 'failed');
  assert.equal(notification.state, 'failed');
  assert.equal(stdout.next_action, 'owner_needed_release_owner_resolution');
});

test('release closeout monitor reports running while structured release evidence is still unavailable', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-closeout-running-'));
  const artifactsRoot = path.join(tempRoot, 'release-closeout-inputs');
  const outDir = path.join(tempRoot, 'release-closeout');
  const runPath = path.join(tempRoot, 'run.json');
  writeJson(runPath, {
    databaseId: 98765,
    status: 'in_progress',
    conclusion: null,
    createdAt: '2026-06-12T10:38:58Z',
    startedAt: '2026-06-12T10:38:58Z',
    updatedAt: '2026-06-12T10:45:00Z',
    workflowName: 'OPL Desktop Release',
    url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/98765',
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
  const stdout = JSON.parse(result.stdout);
  const monitor = readJson(path.join(outDir, 'release-monitor.json'));
  const notification = readJson(path.join(outDir, 'release-notification.json'));
  assert.equal(stdout.status, 'wait_for_release_run_completion');
  assert.equal(stdout.monitor_state, 'running');
  assert.equal(stdout.next_action, 'wait_for_release_run_completion');
  assert.equal(monitor.state, 'running');
  assert.equal(monitor.recommended_next_action.action, 'wait_for_release_run_completion');
  assert.equal(monitor.promote_ready, false);
  assert.equal(notification.state, 'running');
});

test('release closeout monitor reports published from explicit release target evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-closeout-published-'));
  const artifactsRoot = path.join(tempRoot, 'release-closeout-inputs');
  const outDir = path.join(tempRoot, 'release-closeout');
  const runPath = path.join(tempRoot, 'run.json');
  writeJson(path.join(artifactsRoot, 'release-preflight-summary-26.5.99', 'release-preflight-summary.json'), {
    schema: 'opl_release_preflight.v1',
    status: 'passed',
    release_target: {
      kind: 'published_release',
      tag: 'v26.5.99',
      published_at: '2026-06-12T12:00:00Z',
    },
  });
  writeJson(path.join(artifactsRoot, 'remote-release-verification-26.5.99', 'remote-release-verification.json'), {
    status: 'passed',
    version: '26.5.99',
    include_full_package: true,
  });
  writeJson(runPath, {
    databaseId: 24680,
    status: 'completed',
    conclusion: 'success',
    createdAt: '2026-06-12T10:38:58Z',
    startedAt: '2026-06-12T10:38:58Z',
    updatedAt: '2026-06-12T11:18:25Z',
    workflowName: 'OPL Desktop Release',
    url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/24680',
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
  const stdout = JSON.parse(result.stdout);
  const summary = readJson(path.join(outDir, 'release-closeout.json'));
  const monitor = readJson(path.join(outDir, 'release-monitor.json'));
  const notification = readJson(path.join(outDir, 'release-notification.json'));
  assert.equal(stdout.status, 'inspect_missing_candidate_record');
  assert.equal(stdout.monitor_state, 'published');
  assert.equal(summary.monitor.state, 'published');
  assert.equal(monitor.state, 'published');
  assert.equal(monitor.published, true);
  assert.equal(monitor.promote_ready, false);
  assert.equal(notification.state, 'published');
});
