import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import type { ReleaseCohortPlan } from '../../scripts/plan-release-cohort.ts';
import {
  buildStableReleaseSession,
  transitionStableReleaseSession,
  type StableReleasePhase,
} from '../../scripts/stable-release-session.ts';
import {
  appRoot,
  readJson,
  releaseCandidateFixture,
  releaseReadinessFixture,
  writeJson,
} from './release-readiness/helpers.ts';

const VERSION = '26.5.99';
type JsonRecord = Record<string, unknown>;

function runCloseout(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/closeout-release-run.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env, ...env },
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
    completion: readJson(path.join(options.outDir, 'release-closeout-completion.json')),
  };
}

function assertReadoutState(readout: ReturnType<typeof expectCloseout>, nextAction: string, monitorState: string) {
  assert.equal(readout.stdout.status, 'diagnostics_only');
  assert.equal(readout.stdout.next_action, nextAction);
  assert.equal(readout.stdout.monitor_state, monitorState);
  assert.equal(readout.summary.monitor.state, monitorState);
  assert.equal(readout.monitor.state, monitorState);
  assert.equal(readout.notification.state, monitorState);
  assert.equal(readout.monitor.mutation_authorized, false);
  assert.equal(readout.summary.authority_boundary.mutation_authorized, false);
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
      promote_command: 'npm run release:stable -- promote --state <release-session.json> --release-set-generation <YY.M.D[-rN]> --release-owner-receipt-ref <ref> --execute',
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

function closeoutPlan(): ReleaseCohortPlan {
  const appSha = 'a'.repeat(40);
  const shellSha = 'b'.repeat(40);
  const frameworkSha = 'c'.repeat(40);
  return {
    schema: 'opl_app_release_cohort_plan.v1',
    generated_at: '2026-06-12T10:00:00.000Z',
    version: VERSION,
    tag: `v${VERSION}`,
    release_mode: 'new_release',
    release_intent: 'stable_complete',
    full_omission_reason: null,
    operator_plan_ref: `sha256:${'d'.repeat(64)}`,
    gate_reuse_plan_ref: null,
    app_commit: appSha,
    shell_ref: 'main',
    framework_ref: 'main',
    include_full_package: false,
    run_vm_smoke: true,
    publish_docker_webui: false,
    cohort_lock: {
      schema: 'opl_app_release_cohort_lock.v1',
      generated_at: '2026-06-12T10:00:00.000Z',
      app: { requested_ref: 'main', resolved_sha: appSha, repo_root: '/app' },
      shell: { requested_ref: 'main', resolved_sha: shellSha, repo_root: '/shell' },
      framework: { requested_ref: 'main', resolved_sha: frameworkSha, repo_root: '/framework' },
      authority_boundary: {
        cohort_lock_can_dispatch_workflow: false,
        cohort_lock_can_publish_release: false,
        cohort_lock_can_write_runtime_truth: false,
      },
    },
    cheap_gates: [{ id: 'source', required: true, command: 'npm run source', purpose: 'source' }],
    next_action: { action: 'run_release_train_with_vm_smoke', command: 'unused', reason: 'test' },
    authority_boundary: {
      cohort_plan_can_publish_release: false,
      cohort_plan_can_write_runtime_truth: false,
      cohort_plan_can_claim_release_ready: false,
    },
  };
}

function writeCanonicalStableEvidence(root: string, options: {
  terminal?: boolean;
  sourceRunId?: string;
  receiptTransform?: (receipt: JsonRecord) => JsonRecord;
} = {}) {
  let session = buildStableReleaseSession(
    closeoutPlan(),
    'gaofeng21cn/one-person-lab-app',
    '2026-06-12T10:00:00.000Z',
  );
  const promotionRunId = '67890';
  const releaseSetGeneration = '26.5.99';
  const releaseSetManifestDigest = `sha256:${'7'.repeat(64)}`;
  const releaseOwnerReceiptRef = `release_owner_receipt_ref://one-person-lab-app/release-owner/v${VERSION}/receipt-test`;
  session.release_run = {
    id: options.sourceRunId ?? '12345',
    url: 'https://example.test/source',
    conclusion: 'success',
  };
  session.promotion_run = {
    id: promotionRunId,
    url: 'https://example.test/promotion',
    conclusion: 'success',
    attempt: 1,
    rerun_requested_from_attempt: null,
  };
  session.release_owner_receipt_ref = releaseOwnerReceiptRef;
  const artifactSha256 = '5'.repeat(64);
  session.qualification_run.artifact_sha256 = artifactSha256;
  session.artifact_tracks.standard.artifact_sha256 = artifactSha256;
  session.artifact_tracks.standard.qualification_run = { ...session.qualification_run };
  const receiptPath = path.join(root, 'opl-app-promotion-saga-receipt.json');
  const baseReceipt: JsonRecord = {
    schema: 'opl_app_promotion_saga_receipt.v2',
    status: 'verified',
    stable_session_id: session.id,
    version: VERSION,
    release: {
      repo: 'gaofeng21cn/one-person-lab-app',
      tag: `v${VERSION}`,
      public: true,
      latest: true,
    },
    provenance: {
      workflow_run_id: promotionRunId,
      workflow_run_attempt: 1,
      release_attempt_id: `sha256:${'e'.repeat(64)}`,
      controller_workflow_sha: 'f'.repeat(40),
      source_release_run_id: options.sourceRunId ?? '12345',
      standard_qualification_run_id: '45678',
    },
    cohort: {
      release_cohort_ref: `sha256:${'6'.repeat(64)}`,
      app_sha: 'a'.repeat(40),
      shell_sha: 'b'.repeat(40),
      framework_sha: 'c'.repeat(40),
      release_set_generation: releaseSetGeneration,
      release_set_manifest_digest: releaseSetManifestDigest,
    },
    release_owner: { receipt_ref: releaseOwnerReceiptRef },
    distribution: {
      receipt_ref: 'opl-stable-distribution-receipt.json',
      receipt_sha256: '2'.repeat(64),
      release_set_generation: releaseSetGeneration,
      release_set_manifest_digest: releaseSetManifestDigest,
    },
    homebrew_activation: {
      receipt_ref: 'opl-app-homebrew-activation-receipt.json',
      receipt_sha256: '3'.repeat(64),
      standard_vm_run_id: '45678',
    },
    stages: [
      { id: 'release_public_nonlatest', status: 'verified' },
      { id: 'distribution_synced', status: 'verified' },
      { id: 'homebrew_verified', status: 'verified' },
      { id: 'latest_activated', status: 'verified' },
    ],
  };
  writeJson(receiptPath, options.receiptTransform?.(baseReceipt) ?? baseReceipt);
  session.receipts.promotion_saga = {
    ref: `opl-promotion-saga-receipt-${VERSION}-${session.id.slice('sha256:'.length)}`,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(receiptPath)).digest('hex'),
  };
  if (options.terminal !== false) {
    session.receipts.local_activation = {
      ref: 'local-activation-receipt.json',
      sha256: '4'.repeat(64),
    };
  }
  const phases: Array<[StableReleasePhase, string]> = [
    ['source_gates_passed', '2026-06-12T10:05:00.000Z'],
    ['artifact_build_running', '2026-06-12T10:10:00.000Z'],
    ['artifacts_qualified', '2026-06-12T10:20:00.000Z'],
    ['owner_approved', '2026-06-12T10:25:00.000Z'],
    ['promotion_running', '2026-06-12T10:30:00.000Z'],
    ['release_published_not_latest', '2026-06-12T10:35:00.000Z'],
    ['distribution_synced', '2026-06-12T10:40:00.000Z'],
    ['homebrew_verified', '2026-06-12T10:45:00.000Z'],
    ['latest_activated', '2026-06-12T10:50:00.000Z'],
    ['awaiting_local_activation', '2026-06-12T10:55:00.000Z'],
    ...(options.terminal === false
      ? []
      : [['standard_stable_terminal', '2026-06-12T11:00:00.000Z'] as [StableReleasePhase, string]]),
  ];
  for (const [phase, at] of phases) {
    session = transitionStableReleaseSession(session, phase, `fixture reached ${phase}`, at);
  }
  session.revision = 7;
  session.mutation_attempts = [{
    attempt_id: `sha256:${'e'.repeat(64)}`,
    mutation: 'promotion_dispatch',
    workflow: 'desktop-release-promote.yml',
    artifact_kind: 'promotion',
    controller_workflow_sha: 'f'.repeat(40),
    artifact_app_sha: 'a'.repeat(40),
    mutation_payload_sha256: `sha256:${'1'.repeat(64)}`,
    mutation_payload: {},
    planned_session_revision: 4,
    broker_lookup: {
      request_sha256: null, last_status: 'never', observed_at: null,
      ledger_generation: null, version_aggregate_revision: null, latest_mutation_head_revision: null,
      complete_through_sequence: null, authority_epoch: null, not_found_ledger_generation: null,
    },
    dispatch_fence: {
      mode: 'new_workflow_run', workflow_head_branch: 'main',
      earliest_created_at: '2026-06-12T10:30:00.000Z', prior_run_ids: [],
      target_attempt_id: null, target_run_id: null,
    },
    created_at: '2026-06-12T10:30:00.000Z',
    events: [
      { at: '2026-06-12T10:30:00.000Z', state: 'planned', run_id: null, reason: 'promotion planned' },
      { at: '2026-06-12T10:31:00.000Z', state: 'dispatching', run_id: null, reason: 'broker request durable' },
      { at: '2026-06-12T10:50:00.000Z', state: 'succeeded', run_id: promotionRunId, reason: 'exact promotion run and receipt reconciled' },
    ],
  }];
  const sessionPath = path.join(root, 'release-session.json');
  writeJson(sessionPath, session as unknown as JsonRecord);
  return { session, sessionPath, receiptPath };
}

test('release closeout preserves workflow timing diagnostics without becoming promotion authority', () => {
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
  assertReadoutState(readout, 'reconcile_canonical_stable_session', 'diagnostics_only');
  assert.equal(monitor.promote_ready, false);
  assert.equal(monitor.artifact_policy.downloads_large_artifacts, false);
  assert.equal(summary.jobs.slowest_jobs[0].name, 'Build Full first-install assets');
  assert.equal(summary.failed_rerun_tax.failed_rerun_tax_seconds, 1861);
  assert.equal(summary.stable_terminal_evidence.status, 'unavailable');
  assert.equal(readout.completion.status, 'complete');
  assert.equal(readout.completion.generation.id, summary.output_generation.id);
  assert.equal(monitor.output_generation.id, summary.output_generation.id);
  assert.equal(readout.notification.output_generation.id, summary.output_generation.id);
  assert.equal(readout.completion.outputs.length, 4);
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

test('release closeout preserves readiness failures without becoming recovery authority', () => {
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

test('release closeout ignores remote publication heuristics when canonical terminal evidence is absent', () => {
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
  assertReadoutState(readout, 'inspect_failed_jobs', 'failed');
  assert.equal(monitor.published, false);
  assert.equal(monitor.terminal, false);
  assert.equal(summary.stable_terminal_evidence.status, 'unavailable');
});

test('release closeout never recommends promotion while the observed source run is nonterminal', () => {
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
  assertReadoutState(readout, 'reconcile_canonical_stable_session', 'running');
  assert.equal(summary.run.status, 'in_progress');
  assert.equal(summary.source_status.candidate_record, 'ready_to_promote');
  assert.equal(summary.decision.mutation_authorized, false);
  assert.doesNotMatch(summary.decision.command, /\bpromote\b/);
  assert.match(summary.decision.command, /release:stable -- reconcile/);
});

test('release closeout reports an owner-resolution blocker without becoming promotion authority', () => {
  const { readout } = runCloseoutCase('opl-release-closeout-owner-needed-', {
    artifactDir: 'release-closeout-inputs',
    outDirName: 'release-closeout',
    closeoutArtifacts: {
      releaseOwnerVerdict: releaseOwnerVerdict(VERSION, {
        status: 'release_owner_verdict_pending',
        releaseOwnerReceiptRef: null,
      }),
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
  assertReadoutState(readout, 'reconcile_canonical_stable_session', 'running');
  assert.equal(monitor.recommended_next_action.action, 'reconcile_canonical_stable_session');
  assert.equal(monitor.promote_ready, false);
});

test('release closeout does not report published from preflight and remote observations alone', () => {
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
  assertReadoutState(readout, 'inspect_missing_candidate_record', 'diagnostics_only');
  assert.equal(monitor.published, false);
  assert.equal(monitor.promote_ready, false);
});

test('release closeout reports terminal only from an exact canonical session and bound promotion saga receipt', () => {
  const fixture = closeoutFixture('opl-release-closeout-terminal-');
  writeRun(fixture.runPath);
  writeCloseoutArtifacts(fixture.artifactsRoot, VERSION);
  const evidence = writeCanonicalStableEvidence(fixture.tempRoot);
  const readout = expectCloseout({
    runPath: fixture.runPath,
    artifactsRoot: fixture.artifactsRoot,
    outDir: fixture.outDir,
    extra: [
      '--stable-session', evidence.sessionPath,
      '--promotion-saga-receipt', evidence.receiptPath,
    ],
  });

  assertReadoutState(readout, 'stable_terminal_verified', 'terminal');
  assert.equal(readout.monitor.published, true);
  assert.equal(readout.monitor.terminal, true);
  assert.equal(readout.summary.stable_terminal_evidence.status, 'standard_terminal_verified');
  assert.equal(readout.summary.stable_terminal_evidence.observed_run_role, 'source_release');
  assert.deepEqual(readout.summary.stable_terminal_evidence.errors, []);
  for (const output of readout.completion.outputs) {
    const outputPath = path.resolve(appRoot, output.path);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(outputPath)).digest('hex');
    assert.equal(output.sha256, digest);
  }
});

test('release closeout reports published but nonterminal only from the same exact session and receipt join', () => {
  const fixture = closeoutFixture('opl-release-closeout-published-receipt-');
  writeRun(fixture.runPath);
  writeCloseoutArtifacts(fixture.artifactsRoot, VERSION);
  const evidence = writeCanonicalStableEvidence(fixture.tempRoot, { terminal: false });
  const readout = expectCloseout({
    runPath: fixture.runPath,
    artifactsRoot: fixture.artifactsRoot,
    outDir: fixture.outDir,
    extra: [
      '--stable-session', evidence.sessionPath,
      '--promotion-saga-receipt', evidence.receiptPath,
    ],
  });

  assertReadoutState(readout, 'complete_local_activation_from_canonical_session', 'published_awaiting_local_activation');
  assert.equal(readout.summary.stable_terminal_evidence.status, 'published_verified');
  assert.equal(readout.monitor.published, true);
  assert.equal(readout.monitor.terminal, false);
});

for (const scenario of [
  {
    name: 'release closeout fails closed when the observed run is not joined to the canonical session',
    setup: (root: string) => writeCanonicalStableEvidence(root, { sourceRunId: '99999' }),
    error: /observed workflow run is not bound/,
  },
  {
    name: 'release closeout fails closed when promotion receipt bytes no longer match the session digest',
    setup: (root: string) => {
      const evidence = writeCanonicalStableEvidence(root);
      fs.appendFileSync(evidence.receiptPath, ' ');
      return evidence;
    },
    error: /receipt bytes do not match/,
  },
]) {
  test(scenario.name, () => {
    const fixture = closeoutFixture('opl-release-closeout-invalid-terminal-');
    writeRun(fixture.runPath);
    writeCloseoutArtifacts(fixture.artifactsRoot, VERSION);
    const evidence = scenario.setup(fixture.tempRoot);
    const readout = expectCloseout({
      runPath: fixture.runPath,
      artifactsRoot: fixture.artifactsRoot,
      outDir: fixture.outDir,
      extra: [
        '--stable-session', evidence.sessionPath,
        '--promotion-saga-receipt', evidence.receiptPath,
      ],
    });

    assertReadoutState(readout, 'reconcile_canonical_stable_session', 'diagnostics_only');
    assert.equal(readout.monitor.published, false);
    assert.equal(readout.monitor.terminal, false);
    assert.equal(readout.summary.stable_terminal_evidence.status, 'invalid');
    assert.match(readout.summary.stable_terminal_evidence.errors.join('; '), scenario.error);
    assert.doesNotMatch(readout.summary.decision.command, /\bpromote\b/);
  });
}

test('release closeout leaves no completion authority when one output write fails', () => {
  const fixture = closeoutFixture('opl-release-closeout-partial-output-');
  writeRun(fixture.runPath);
  writeCloseoutArtifacts(fixture.artifactsRoot, VERSION);
  const notificationDirectory = path.join(fixture.tempRoot, 'notification-directory');
  const completionPath = path.join(fixture.tempRoot, 'completion.json');
  fs.mkdirSync(notificationDirectory);
  writeJson(completionPath, { schema: 'old-completion', generation: { id: 'old-generation' } });
  const result = runCloseoutFixture({
    runPath: fixture.runPath,
    artifactsRoot: fixture.artifactsRoot,
    outDir: fixture.outDir,
    extra: [
      '--notification', notificationDirectory,
      '--completion-manifest', completionPath,
    ],
  });

  assert.notEqual(result.status, 0);
  assert.equal(readJson(completionPath).generation.id, 'old-generation');
  assert.equal(fs.readdirSync(fixture.tempRoot).some((name) => name.includes('.tmp-')), false);
});

test('release closeout validates a staged artifact generation before replacing and preserves the previous generation', () => {
  const fixture = closeoutFixture('opl-release-closeout-artifact-generation-');
  writeRun(fixture.runPath);
  writeJobs(fixture.jobsPath, []);
  const artifactName = `release-candidate-record-${VERSION}`;
  const oldArtifactPath = path.join(fixture.artifactsRoot, artifactName, 'old-generation.json');
  writeJson(oldArtifactPath, { generation: 'old' });
  const artifactsJsonPath = path.join(fixture.tempRoot, 'artifacts.json');
  writeJson(artifactsJsonPath, { artifacts: [{ name: artifactName }] });
  const fakeBin = path.join(fixture.tempRoot, 'bin');
  const fakeGh = path.join(fakeBin, 'gh');
  fs.mkdirSync(fakeBin);
  fs.writeFileSync(fakeGh, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const directory = args[args.indexOf('--dir') + 1];
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'release-candidate-record.json'), process.env.FAKE_GH_PAYLOAD, 'utf8');
`);
  fs.chmodSync(fakeGh, 0o755);
  const args = [
    '--version', VERSION,
    '--run-id', '12345',
    '--run-json', fixture.runPath,
    '--jobs-json', fixture.jobsPath,
    '--jobs-json', fixture.jobsPath,
    '--artifacts-json', artifactsJsonPath,
    '--artifacts-dir', fixture.artifactsRoot,
    '--out-dir', fixture.outDir,
  ];
  writeJobs(fixture.jobsPath, []);
  const invalid = runCloseout(args, {
    PATH: `${fakeBin}:${process.env.PATH}`,
    FAKE_GH_PAYLOAD: '{invalid-json',
  });
  assert.notEqual(invalid.status, 0);
  assert.equal(readJson(oldArtifactPath).generation, 'old');
  assert.equal(fs.readdirSync(fixture.tempRoot).some((name) => name.includes('.staging-')), false);

  const valid = runCloseout(args, {
    PATH: `${fakeBin}:${process.env.PATH}`,
    FAKE_GH_PAYLOAD: JSON.stringify({ schema: 'opl_release_candidate_record.v1', status: 'blocked' }),
  });
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  assert.equal(fs.existsSync(oldArtifactPath), false);
  assert.equal(readJson(path.join(fixture.artifactsRoot, artifactName, 'release-candidate-record.json')).status, 'blocked');
  const previous = fs.readdirSync(fixture.tempRoot).filter((name) => name.startsWith('artifacts.previous-'));
  assert.equal(previous.length, 1);
  assert.equal(readJson(path.join(fixture.tempRoot, previous[0], artifactName, 'old-generation.json')).generation, 'old');
  const summary = readJson(path.join(fixture.outDir, 'release-closeout.json'));
  assert.equal(summary.artifact_policy.download_generation.mode, 'downloaded_generation');
  assert.equal(summary.artifact_policy.download_generation.previous_generation_path, path.join(fixture.tempRoot, previous[0]));
});
