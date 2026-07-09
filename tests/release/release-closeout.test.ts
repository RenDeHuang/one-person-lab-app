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

function closeoutFixture(prefix: string, artifactDir = 'artifacts', outDirName = 'out') {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    tempRoot,
    artifactsRoot: path.join(tempRoot, artifactDir),
    outDir: path.join(tempRoot, outDirName),
    runPath: path.join(tempRoot, 'run.json'),
    jobsPath: path.join(tempRoot, 'jobs.json'),
  };
}

function writeRun(filePath: string, fields: Record<string, unknown> = {}) {
  writeJson(filePath, {
    databaseId: '12345',
    status: 'completed',
    conclusion: 'success',
    createdAt: '2026-06-12T10:38:58Z',
    startedAt: '2026-06-12T10:38:58Z',
    updatedAt: '2026-06-12T11:18:25Z',
    workflowName: 'OPL Desktop Release',
    headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ...fields,
  });
}

function runCloseoutFixture(options: {
  runPath: string;
  artifactsRoot: string;
  outDir: string;
  jobsPath?: string;
  extra?: string[];
}) {
  return runCloseout([
    '--version',
    '26.5.99',
    '--run-json',
    options.runPath,
    ...(options.jobsPath ? ['--jobs-json', options.jobsPath] : []),
    '--artifacts-dir',
    options.artifactsRoot,
    '--out-dir',
    options.outDir,
    ...(options.extra ?? []),
    '--no-download',
  ]);
}

function expectCloseout(options: Parameters<typeof runCloseoutFixture>[0]) {
  const result = runCloseoutFixture(options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return {
    stdout: JSON.parse(result.stdout),
    summary: readJson(path.join(options.outDir, 'release-closeout.json')),
    monitor: readJson(path.join(options.outDir, 'release-monitor.json')),
    notification: readJson(path.join(options.outDir, 'release-notification.json')),
  };
}

function assertReadoutState(readout: ReturnType<typeof expectCloseout>, status: string, monitorState = status) {
  assert.equal(readout.stdout.status, status);
  assert.equal(readout.stdout.monitor_state, monitorState);
  assert.equal(readout.monitor.state, monitorState);
  assert.equal(readout.notification.state, monitorState);
}

function writeReleaseArtifact(root: string, version: string, artifact: string, file: string, payload: Record<string, unknown>) {
  writeJson(path.join(root, `${artifact}-${version}`, file), payload);
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
  writeReleaseArtifact(root, version, 'release-preflight-summary', 'release-preflight-summary.json', { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeReleaseArtifact(root, version, 'remote-release-verification', 'remote-release-verification.json', { status: 'passed', version, include_full_package: true });
  writeReleaseArtifact(root, version, 'release-readiness-summary', 'release-readiness-summary.json', {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version,
    failed_required_gates: [],
    warnings: [],
    full_package: {
      duration_seconds: {
        full_package_build: 405,
        full_package_build_breakdown: { runtime_materialize: 20, runtime_cache_materialize: 8, payload_sync: 18, shell_build: 187, dmg_package_compression: 175, manifest_checksum: 5 },
      },
      cache: { full_runtime_layers: 'toolchain:true;domain-runtime:true;opl-runtime:true;skills:true' },
      runtime_cache: {
        layer_status_counts: { hit: 2, miss_written: 1 },
        miss_written_layers: ['domain-runtime'],
        miss_written_count: 1,
        written_layers: ['domain-runtime'],
        written_layer_count: 1,
      },
      size_budget: { full_dmg_size_bytes: 865000000, warning_full_dmg_bytes: 700000000, max_full_dmg_bytes: 750000000, full_dmg_size_status: 'warning' },
      size_analysis: {
        schema: 'opl_full_package_size_summary.v1',
        source: 'test_fixture',
        budget: {
          compressed_full_dmg: { full_dmg_size_bytes: 865000000, warning_full_dmg_bytes: 700000000, max_full_dmg_bytes: 750000000, warning_status: 'warning', review_threshold_status: 'above_review_threshold', release_blocking: false },
        },
        optimization_candidates: [
          { rank: 1, kind: 'layer', id: 'toolchain', size_bytes: 512000000, reason: 'largest_runtime_layer' },
          { rank: 2, kind: 'component', id: 'codex', size_bytes: 384000000, reason: 'largest_packaged_component' },
        ],
      },
    },
  });
  writeReleaseArtifact(root, version, 'release-candidate-record', 'release-candidate-record.json', {
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
  writeReleaseArtifact(root, version, 'release-addon-readiness-summary', 'release-addon-readiness-summary.json', {
    schema: 'opl_release_addon_readiness_summary.v1',
    version,
    release_mode: 'new_release',
    job_results: {
      'full-first-install': 'success',
      'remote-verify-full': 'success',
      'full-first-run-vm-smoke': 'success',
      'docker-webui-smoke': 'success',
      'webui-ghcr-publish': 'success',
      'docker-webui-clean-vm-evidence': 'success',
      'operator-evidence-bundle-validation': 'success',
    },
  });
}

test('release closeout separates workflow wall time from Agent orchestration wall time and avoids large artifacts', () => {
  const { artifactsRoot, outDir, runPath, jobsPath } = closeoutFixture('opl-release-closeout-');
  writeCloseoutArtifacts(artifactsRoot);
  writeRun(runPath, {
    displayTitle: 'v26.5.99 stable release',
    headBranch: 'main',
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

  const readout = expectCloseout({
    runPath,
    jobsPath,
    artifactsRoot,
    outDir,
    extra: ['--agent-wall-time', '2h6m43s'],
  });
  const { stdout, summary, monitor, notification } = readout;

  assert.equal(summary.schema, 'opl_release_closeout_summary.v1');
  assertReadoutState(readout, 'ready_to_promote');
  assert.equal(stdout.monitor, path.relative(appRoot, path.join(outDir, 'release-monitor.json')));
  assert.equal(stdout.notification, path.relative(appRoot, path.join(outDir, 'release-notification.json')));
  assert.equal(summary.monitor.schema, 'opl_release_run_monitor.v1');
  assert.equal(summary.monitor.state, 'ready_to_promote');
  assert.equal(summary.notification_payload.schema, 'opl_release_run_notification.v1');
  assert.equal(monitor.schema, 'opl_release_run_monitor.v1');
  assert.equal(monitor.recommended_next_action.action, 'promote_from_candidate_record');
  assert.equal(monitor.promote_ready, true);
  assert.equal(monitor.artifact_policy.downloads_large_artifacts, false);
  assert.match(monitor.no_watch_instructions.join('\n'), /gh run view 12345/);
  assert.match(monitor.no_watch_instructions.join('\n'), /release-monitor\.json/);
  assert.equal(notification.schema, 'opl_release_run_notification.v1');
  assert.equal(notification.machine_payload, 'release-monitor.json');
  assert.equal(summary.source_status.candidate_record, 'ready_to_promote');
  assert.equal(summary.decision.next_action, 'promote_from_candidate_record');
  assert.equal(summary.artifact_policy.downloads_large_artifacts, false);
  assert.deepEqual(summary.artifact_policy.downloaded_artifacts, []);
  assert.equal(summary.artifact_attestation_verification.state, 'missing');
  assert.equal(summary.jobs.slowest_jobs[0].name, 'Build Full first-install assets');
  assert.equal(summary.failed_rerun_tax.failed_rerun_tax_seconds, 1861);
});

test('release closeout reads attestation verification summary from small artifact inputs', () => {
  const { artifactsRoot, outDir, runPath } = closeoutFixture('opl-release-closeout-attestation-');
  writeCloseoutArtifacts(artifactsRoot);
  writeJson(path.join(artifactsRoot, 'release-attestation-verification-26.5.99', 'attestation-verification.json'), {
    schema: 'opl_release_attestation_verification.v1',
    status: 'passed',
    verified_assets: [
      {
        name: 'One-Person-Lab-26.5.99-arm64.dmg',
        predicate_type: 'https://slsa.dev/provenance/v1',
        workflow_run_id: '12345',
      },
    ],
  });
  writeRun(runPath);

  const { summary } = expectCloseout({ runPath, artifactsRoot, outDir });
  assert.equal(summary.artifact_attestation_verification.state, 'verified');
  assert.match(summary.source_paths.artifact_attestation_verification, /attestation-verification\.json/);
  assert.equal(summary.artifact_attestation_verification.verification.status, 'passed');
  assert.equal(summary.artifact_attestation_verification.verification.verified_assets[0].name, 'One-Person-Lab-26.5.99-arm64.dmg');
  assert.deepEqual(summary.artifact_attestation_verification.verify_commands, []);
  assert.match(summary.artifact_attestation_verification.rule, /not release readiness evidence/);
});

test('release closeout marks failed attestation verification without treating it as readiness', () => {
  const { artifactsRoot, outDir, runPath } = closeoutFixture('opl-release-closeout-attestation-failed-');
  writeCloseoutArtifacts(artifactsRoot);
  writeJson(path.join(artifactsRoot, 'release-attestation-verification-26.5.99', 'attestation-verification-summary.json'), {
    schema: 'opl_release_attestation_verification.v1',
    status: 'failed',
    errors: ['No attestation found for One-Person-Lab-26.5.99-arm64.dmg.'],
  });
  writeRun(runPath);

  const { summary } = expectCloseout({ runPath, artifactsRoot, outDir });
  assert.equal(summary.artifact_attestation_verification.state, 'failed');
  assert.equal(summary.artifact_attestation_verification.verification.status, 'failed');
  assert.match(summary.artifact_attestation_verification.rule, /not release readiness evidence/);
});

test('release closeout stops at readiness failed gates before raw log inspection', () => {
  const { artifactsRoot, outDir, runPath } = closeoutFixture('opl-release-closeout-blocked-');
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
  writeRun(runPath, {
    status: 'completed',
    conclusion: 'success',
    createdAt: '2026-06-12T10:00:00Z',
    startedAt: '2026-06-12T10:00:00Z',
    updatedAt: '2026-06-12T10:10:00Z',
  });

  const readout = expectCloseout({ runPath, artifactsRoot, outDir });
  const { summary, monitor } = readout;
  assertReadoutState(readout, 'resolve_readiness_failed_gates', 'failed');
  assert.equal(monitor.failed_gate_count, 1);
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
  const { artifactsRoot, outDir, runPath, jobsPath } = closeoutFixture('opl-release-closeout-post-publish-');
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
  writeRun(runPath, {
    databaseId: '67890',
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

  const readout = expectCloseout({ runPath, jobsPath, artifactsRoot, outDir });
  const { summary, monitor } = readout;
  assertReadoutState(readout, 'resolve_post_publish_followup_gate', 'published_with_post_publish_followup');
  assert.equal(monitor.published, true);
  assert.equal(summary.decision.next_action, 'resolve_post_publish_followup_gate');
  assert.equal(summary.decision.post_publish.published_release_readback, true);
  assert.equal(summary.decision.post_publish.failed_followup_jobs[0].name, 'Run Homebrew standard first-run VM smoke');
});

test('release closeout uses candidate record inside an in-progress workflow job', () => {
  const { artifactsRoot, outDir, runPath, jobsPath } = closeoutFixture('opl-release-closeout-default-', 'release-closeout-inputs', 'release-closeout');
  writeCloseoutArtifacts(artifactsRoot);
  writeRun(runPath, {
    databaseId: 12345,
    status: 'in_progress',
    conclusion: null,
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

  const readout = expectCloseout({
    runPath,
    jobsPath,
    artifactsRoot,
    outDir,
    extra: ['--artifact-profile', 'diagnostics'],
  });

  const { summary } = readout;
  assertReadoutState(readout, 'ready_to_promote');
  assert.equal(summary.run.status, 'in_progress');
  assert.equal(summary.source_status.candidate_record, 'ready_to_promote');
  assert.equal(summary.decision.next_action, 'promote_from_candidate_record');
  assert.doesNotMatch(summary.decision.reason, /not complete|wait/i);
  assert.equal(summary.artifact_policy.downloads_large_artifacts, false);
  assert.deepEqual(summary.artifact_policy.downloaded_artifacts, []);
  assert.match(summary.operator_loop_optimization.implemented_by, /desktop-release\.yml default release closeout artifact/);
  assert.match(summary.operator_loop_optimization.workflow_default_release_summary, /release-readiness-summary job uploads/);
});

test('release closeout requires owner-resolution validation before promote', () => {
  const { artifactsRoot, outDir, runPath } = closeoutFixture('opl-release-closeout-owner-needed-', 'release-closeout-inputs', 'release-closeout');
  writeCloseoutArtifacts(artifactsRoot, '26.5.99', {
    releaseOwnerVerdict: releaseOwnerVerdict('26.5.99', {
      status: 'release_owner_verdict_pending',
      releaseOwnerReceiptRef: null,
    }),
  });
  writeRun(runPath, {
    databaseId: 12345,
    status: 'in_progress',
    conclusion: null,
    url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/12345',
  });

  const readout = expectCloseout({ runPath, artifactsRoot, outDir });
  const { stdout, summary } = readout;
  assert.equal(summary.source_status.candidate_record, 'ready_to_promote');
  assert.equal(summary.decision.next_action, 'owner_needed_release_owner_resolution');
  assert.match(summary.decision.reason, /Release owner verdict status is release_owner_verdict_pending/);
  assert.match(summary.decision.reason, /missing release_owner_verdict_ref or release_owner_receipt_ref/);
  assert.match(summary.decision.command, /validate-release-candidate-record\.ts --promote-ready/);
  assert.match(summary.decision.owner_resolution.typed_blocker_ref, /typed_blocker_ref:\/\/one-person-lab-app\/release-owner\/v26\.5\.99\/verdict-pending/);
  assertReadoutState(readout, 'owner_needed_release_owner_resolution', 'failed');
  assert.equal(stdout.next_action, 'owner_needed_release_owner_resolution');
});

test('release closeout monitor reports running while structured release evidence is still unavailable', () => {
  const { artifactsRoot, outDir, runPath } = closeoutFixture('opl-release-closeout-running-', 'release-closeout-inputs', 'release-closeout');
  writeRun(runPath, {
    databaseId: 98765,
    status: 'in_progress',
    conclusion: null,
    updatedAt: '2026-06-12T10:45:00Z',
    url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/98765',
  });

  const readout = expectCloseout({ runPath, artifactsRoot, outDir });
  const { stdout, monitor } = readout;
  assertReadoutState(readout, 'wait_for_release_run_completion', 'running');
  assert.equal(stdout.next_action, 'wait_for_release_run_completion');
  assert.equal(monitor.recommended_next_action.action, 'wait_for_release_run_completion');
  assert.equal(monitor.promote_ready, false);
});

test('release closeout monitor reports published from explicit release target evidence', () => {
  const { artifactsRoot, outDir, runPath } = closeoutFixture('opl-release-closeout-published-', 'release-closeout-inputs', 'release-closeout');
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
  writeRun(runPath, {
    databaseId: 24680,
    url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/24680',
  });

  const readout = expectCloseout({ runPath, artifactsRoot, outDir });
  const { summary, monitor } = readout;
  assertReadoutState(readout, 'inspect_missing_candidate_record', 'published');
  assert.equal(summary.monitor.state, 'published');
  assert.equal(monitor.published, true);
  assert.equal(monitor.promote_ready, false);
});
