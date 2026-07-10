import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  appRoot,
  readJson,
  releaseCandidateFixture,
  releaseReadinessFixture,
  writeJson,
} from './release-readiness/helpers.ts';

const VERSION = '26.5.99';
type JsonRecord = Record<string, unknown>;

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

function writeRun(filePath: string, fields: JsonRecord = {}) {
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
    VERSION,
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
  assert.equal(readout.summary.monitor.state, monitorState);
  assert.equal(readout.monitor.state, monitorState);
  assert.equal(readout.notification.state, monitorState);
}

type CloseoutFixture = ReturnType<typeof closeoutFixture>;

function writeJobs(filePath: string, jobs: JsonRecord[]) {
  writeJson(filePath, { jobs });
}

function completedJob(name: string, conclusion: string, startedAt: string, completedAt: string) {
  return { name, status: 'completed', conclusion, startedAt, completedAt };
}

function writeReleaseArtifact(root: string, version: string, artifact: string, file: string, payload: JsonRecord) {
  writeJson(path.join(root, `${artifact}-${version}`, file), payload);
}

function writeReleaseArtifacts(root: string, artifacts: Array<[string, string, JsonRecord]>, version = VERSION) {
  for (const [artifact, file, payload] of artifacts) writeReleaseArtifact(root, version, artifact, file, payload);
}

function runCloseoutCase(prefix: string, options: {
  artifactDir?: string;
  outDirName?: string;
  closeoutArtifacts?: false | Parameters<typeof writeCloseoutArtifacts>[2];
  run?: false | JsonRecord;
  jobs?: JsonRecord[];
  extra?: string[];
  setup?: (fixture: CloseoutFixture) => void;
} = {}) {
  const fixture = closeoutFixture(prefix, options.artifactDir ?? 'artifacts', options.outDirName ?? 'out');
  if (options.closeoutArtifacts !== false) writeCloseoutArtifacts(fixture.artifactsRoot, VERSION, options.closeoutArtifacts ?? {});
  if (options.run !== false) writeRun(fixture.runPath, options.run ?? {});
  if (options.jobs) writeJobs(fixture.jobsPath, options.jobs);
  options.setup?.(fixture);
  return {
    ...fixture,
    readout: expectCloseout({
      runPath: fixture.runPath,
      jobsPath: options.jobs ? fixture.jobsPath : undefined,
      artifactsRoot: fixture.artifactsRoot,
      outDir: fixture.outDir,
      extra: options.extra,
    }),
  };
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
  releaseOwnerVerdict?: JsonRecord;
} = {}) {
  writeReleaseArtifact(root, version, 'release-preflight-summary', 'release-preflight-summary.json', { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeReleaseArtifact(root, version, 'remote-release-verification', 'remote-release-verification.json', { status: 'passed', version, include_full_package: true });
  writeReleaseArtifact(root, version, 'release-readiness-summary', 'release-readiness-summary.json', releaseReadinessFixture(version));
  writeReleaseArtifact(root, version, 'release-candidate-record', 'release-candidate-record.json', releaseCandidateFixture(version, {
    release_owner_verdict: options.releaseOwnerVerdict ?? releaseOwnerVerdict(version),
    decision: {
      can_promote: true,
      promote_command: `gh release edit v${version} --repo gaofeng21cn/one-person-lab-app --draft=false --latest`,
    },
  }));
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
  const { readout } = runCloseoutCase('opl-release-closeout-', {
    run: {
      displayTitle: 'v26.5.99 stable release',
      headBranch: 'main',
      url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/12345',
      previous_runs: [{
        id: '12222',
        status: 'completed',
        conclusion: 'failure',
        createdAt: '2026-06-12T09:00:00Z',
        updatedAt: '2026-06-12T09:31:01Z',
        url: 'https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/12222',
      }],
    },
    jobs: [
      completedJob('Build Full first-install assets', 'success', '2026-06-12T10:50:00Z', '2026-06-12T11:04:42Z'),
      completedJob('Summarize release readiness', 'success', '2026-06-12T11:17:00Z', '2026-06-12T11:18:25Z'),
    ],
    extra: ['--agent-wall-time', '2h6m43s'],
  });
  const { summary, monitor } = readout;
  assertReadoutState(readout, 'ready_to_promote');
  assert.equal(monitor.promote_ready, true);
  assert.equal(monitor.artifact_policy.downloads_large_artifacts, false);
  assert.equal(summary.jobs.slowest_jobs[0].name, 'Build Full first-install assets');
  assert.equal(summary.failed_rerun_tax.failed_rerun_tax_seconds, 1861);
});

for (const scenario of [
  {
    name: 'release closeout reads attestation verification summary from small artifact inputs',
    prefix: 'opl-release-closeout-attestation-',
    file: 'attestation-verification.json',
    state: 'verified',
    payload: {
      schema: 'opl_release_attestation_verification.v1',
      status: 'passed',
      verified_assets: [{ name: 'One-Person-Lab-26.5.99-arm64.dmg', predicate_type: 'https://slsa.dev/provenance/v1', workflow_run_id: '12345' }],
    },
  },
  {
    name: 'release closeout marks failed attestation verification without treating it as readiness',
    prefix: 'opl-release-closeout-attestation-failed-',
    file: 'attestation-verification-summary.json',
    state: 'failed',
    payload: {
      schema: 'opl_release_attestation_verification.v1',
      status: 'failed',
      errors: ['No attestation found for One-Person-Lab-26.5.99-arm64.dmg.'],
    },
  },
]) {
  test(scenario.name, () => {
    const { readout: { summary } } = runCloseoutCase(scenario.prefix, {
      setup: ({ artifactsRoot }) => writeReleaseArtifact(artifactsRoot, VERSION, 'release-attestation-verification', scenario.file, scenario.payload),
    });

    assert.equal(summary.artifact_attestation_verification.state, scenario.state);
    assert.equal(summary.artifact_attestation_verification.verification.status, scenario.payload.status);
    if (scenario.state === 'verified') {
      assert.equal(summary.artifact_attestation_verification.verification.verified_assets[0].name, 'One-Person-Lab-26.5.99-arm64.dmg');
    }
  });
}

test('release closeout stops at readiness failed gates before raw log inspection', () => {
  const failedGate = {
    id: 'homebrew_standard_cask_clean_vm',
    status: 'failed',
    reason: 'Homebrew VM smoke status is failed.',
  };
  const { readout } = runCloseoutCase('opl-release-closeout-blocked-', {
    closeoutArtifacts: false,
    setup: ({ artifactsRoot }) => writeReleaseArtifact(artifactsRoot, VERSION, 'release-readiness-summary', 'release-readiness-summary.json', releaseReadinessFixture(VERSION, {
      status: 'failed',
      failed_required_gates: [failedGate],
    })),
  });
  const { summary, monitor } = readout;
  assertReadoutState(readout, 'resolve_readiness_failed_gates', 'failed');
  assert.equal(monitor.failed_gate_count, 1);
  assert.doesNotMatch(summary.decision.command, /--log-failed/);
  assert.deepEqual(summary.readiness.failed_required_gates, [failedGate]);
});

test('release closeout separates published release state from failed post-publish proof gates', () => {
  const { readout } = runCloseoutCase('opl-release-closeout-post-publish-', {
    closeoutArtifacts: false,
    run: {
      conclusion: 'failure',
      workflowName: 'OPL Desktop Release Promote',
    },
    jobs: [
      completedJob('Verify and publish draft release', 'success', '2026-06-20T09:53:00Z', '2026-06-20T09:54:19Z'),
      completedJob('Run Homebrew standard first-run VM smoke', 'failure', '2026-06-20T09:54:34Z', '2026-06-20T10:18:32Z'),
    ],
    setup: ({ artifactsRoot }) => writeReleaseArtifacts(artifactsRoot, [
      ['remote-release-verification', 'remote-release-verification.json', { status: 'passed', version: VERSION, isDraft: false, publishedAt: '2026-06-20T09:54:13Z' }],
      ['release-preflight-summary', 'release-preflight-summary.json', { schema: 'opl_release_preflight.v1', status: 'passed', release_target: { kind: 'draft_release' } }],
    ]),
  });
  const { summary, monitor } = readout;
  assertReadoutState(readout, 'resolve_post_publish_followup_gate', 'published_with_post_publish_followup');
  assert.equal(monitor.published, true);
  assert.equal(summary.decision.post_publish.failed_followup_jobs[0].name, 'Run Homebrew standard first-run VM smoke');
});

test('release closeout uses candidate record inside an in-progress workflow job', () => {
  const { readout } = runCloseoutCase('opl-release-closeout-default-', {
    artifactDir: 'release-closeout-inputs',
    outDirName: 'release-closeout',
    run: {
      status: 'in_progress',
      conclusion: null,
    },
    jobs: [{
      name: 'Summarize release readiness',
      status: 'in_progress',
      conclusion: null,
      startedAt: '2026-06-12T11:17:00Z',
      completedAt: null,
    }],
    extra: ['--artifact-profile', 'diagnostics'],
  });

  const { summary } = readout;
  assertReadoutState(readout, 'ready_to_promote');
  assert.equal(summary.run.status, 'in_progress');
  assert.equal(summary.source_status.candidate_record, 'ready_to_promote');
  assert.equal(summary.decision.next_action, 'promote_from_candidate_record');
  assert.doesNotMatch(summary.decision.reason, /not complete|wait/i);
});

test('release closeout requires owner-resolution validation before promote', () => {
  const { readout } = runCloseoutCase('opl-release-closeout-owner-needed-', {
    artifactDir: 'release-closeout-inputs',
    outDirName: 'release-closeout',
    closeoutArtifacts: {
      releaseOwnerVerdict: releaseOwnerVerdict(VERSION, {
        status: 'release_owner_verdict_pending',
        releaseOwnerReceiptRef: null,
      }),
    },
    run: {
      status: 'in_progress',
      conclusion: null,
    },
  });
  const { summary } = readout;
  assert.equal(summary.source_status.candidate_record, 'ready_to_promote');
  assert.equal(summary.decision.next_action, 'owner_needed_release_owner_resolution');
  assert.match(summary.decision.owner_resolution.typed_blocker_ref, /typed_blocker_ref:\/\/one-person-lab-app\/release-owner\/v26\.5\.99\/verdict-pending/);
  assertReadoutState(readout, 'owner_needed_release_owner_resolution', 'failed');
});

test('release closeout monitor reports running while structured release evidence is still unavailable', () => {
  const { readout } = runCloseoutCase('opl-release-closeout-running-', {
    artifactDir: 'release-closeout-inputs',
    outDirName: 'release-closeout',
    closeoutArtifacts: false,
    run: {
      status: 'in_progress',
      conclusion: null,
    },
  });
  const { monitor } = readout;
  assertReadoutState(readout, 'wait_for_release_run_completion', 'running');
  assert.equal(monitor.recommended_next_action.action, 'wait_for_release_run_completion');
  assert.equal(monitor.promote_ready, false);
});

test('release closeout monitor reports published from explicit release target evidence', () => {
  const { readout } = runCloseoutCase('opl-release-closeout-published-', {
    artifactDir: 'release-closeout-inputs',
    outDirName: 'release-closeout',
    closeoutArtifacts: false,
    setup: ({ artifactsRoot }) => writeReleaseArtifacts(artifactsRoot, [
      ['release-preflight-summary', 'release-preflight-summary.json', {
        schema: 'opl_release_preflight.v1',
        status: 'passed',
        release_target: { kind: 'published_release', tag: `v${VERSION}`, published_at: '2026-06-12T12:00:00Z' },
      }],
      ['remote-release-verification', 'remote-release-verification.json', { status: 'passed', version: VERSION, include_full_package: true }],
    ]),
  });
  const { monitor } = readout;
  assertReadoutState(readout, 'inspect_missing_candidate_record', 'published');
  assert.equal(monitor.published, true);
  assert.equal(monitor.promote_ready, false);
});
