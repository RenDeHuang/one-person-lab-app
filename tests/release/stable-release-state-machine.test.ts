import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReleaseCohortPlan } from '../../scripts/plan-release-cohort.ts';
import {
  buildStableReleaseSession,
  desktopReleaseDispatchArgs,
  formatCommandFailure,
  promoteDispatchArgs,
  promotionRerunArgs,
  selectNewCohortRun,
  transitionStableReleaseSession,
} from '../../scripts/run-stable-release.ts';

const appSha = 'a'.repeat(40);
const shellSha = 'b'.repeat(40);
const frameworkSha = 'c'.repeat(40);

function plan(): ReleaseCohortPlan {
  return {
    schema: 'opl_app_release_cohort_plan.v1',
    generated_at: '2026-07-12T00:00:00.000Z',
    version: '26.7.12',
    tag: 'v26.7.12',
    release_mode: 'new_release',
    release_intent: 'stable_complete',
    full_omission_reason: null,
    operator_plan_ref: `sha256:${'d'.repeat(64)}`,
    gate_reuse_plan_ref: null,
    app_commit: appSha,
    shell_ref: 'main',
    framework_ref: 'main',
    include_full_package: true,
    run_vm_smoke: true,
    publish_docker_webui: true,
    cohort_lock: {
      schema: 'opl_app_release_cohort_lock.v1',
      generated_at: '2026-07-12T00:00:00.000Z',
      app: { requested_ref: 'codex/release-26.7.12', resolved_sha: appSha, repo_root: '/app' },
      shell: { requested_ref: 'main', resolved_sha: shellSha, repo_root: '/shell' },
      framework: { requested_ref: 'main', resolved_sha: frameworkSha, repo_root: '/framework' },
      authority_boundary: {
        cohort_lock_can_dispatch_workflow: false,
        cohort_lock_can_publish_release: false,
        cohort_lock_can_write_runtime_truth: false,
      },
    },
    cheap_gates: [
      { id: 'source', required: true, command: 'npm run source', purpose: 'source' },
      { id: 'duplicate', required: true, command: 'npm run source', purpose: 'duplicate' },
      { id: 'preflight', required: true, command: 'npm run preflight', purpose: 'preflight' },
    ],
    next_action: { action: 'run_release_train_with_vm_smoke', command: 'unused', reason: 'test' },
    authority_boundary: {
      cohort_plan_can_publish_release: false,
      cohort_plan_can_write_runtime_truth: false,
      cohort_plan_can_claim_release_ready: false,
    },
  };
}

test('stable release session freezes one cohort and deduplicates cheap gates', () => {
  const session = buildStableReleaseSession(plan(), 'gaofeng21cn/one-person-lab-app', '2026-07-12T00:00:00.000Z');
  assert.equal(session.version, '26.7.12');
  assert.equal(session.source_gates.length, 2);
  assert.equal(session.efficiency_policy.desktop_release_dispatch_limit_per_cohort, 1);
  assert.equal(session.efficiency_policy.cross_cohort_artifact_reuse_allowed, false);
  assert.equal(session.authority_boundary.execute_flag_required_for_external_mutation, true);
  assert.equal(session.schema, 'opl_app_stable_release_session.v2');
  assert.equal(session.metrics.artifact_build_count, 0);
  assert.equal(session.metrics.promotion_retry_count, 0);
});

test('source gate failures prefer structured stdout over runtime warnings', () => {
  assert.equal(
    formatCommandFailure(
      {
        status: 1,
        stdout: '{"status":"failed","blocker":"registry metadata unavailable"}\n',
        stderr: 'ExperimentalWarning: Type Stripping is an experimental feature\n',
      },
      'source gate release_preflight',
    ),
    'source gate release_preflight: {"status":"failed","blocker":"registry metadata unavailable"}',
  );
});

test('desktop release dispatch is derived entirely from the frozen cohort', () => {
  const session = buildStableReleaseSession(plan());
  const args = desktopReleaseDispatchArgs(session).join(' ');
  assert.match(args, /--ref codex\/release-26\.7\.12/);
  assert.match(args, new RegExp(`shell_ref=${shellSha}`));
  assert.match(args, new RegExp(`framework_ref=${frameworkSha}`));
  assert.match(args, /include_full_package=true/);
  assert.match(args, /run_vm_smoke=true/);
  assert.match(args, /require_addon_gates_for_stable_readiness=true/);
  assert.doesNotMatch(args, /shell_ref=main/);
  assert.doesNotMatch(args, /framework_ref=main/);
});

test('promotion reuses the source run id and requires an owner receipt', () => {
  const session = buildStableReleaseSession(plan());
  session.release_run.id = '29211495991';
  session.qualification_run.id = '29211496001';
  session.qualification_run.conclusion = 'success';
  session.qualification_run.artifact_sha256 = 'e'.repeat(64);
  assert.throws(() => promoteDispatchArgs(session, '', '26.7.12-r2'), /owner receipt/);
  assert.throws(
    () => promoteDispatchArgs(session, 'release_owner_receipt_ref://test', ''),
    /Release Set generation/,
  );
  const args = promoteDispatchArgs(session, 'release_owner_receipt_ref://test', '26.7.12-r2').join(' ');
  assert.match(args, /release_run_id=29211495991/);
  assert.match(args, /release_set_generation=26\.7\.12-r2/);
  assert.match(args, /release_owner_receipt_ref=release_owner_receipt_ref:\/\/test/);
  assert.match(args, new RegExp(`shell_ref=${shellSha}`));
});

test('state machine rejects skipped stages and repeated release dispatch paths', () => {
  const session = buildStableReleaseSession(plan());
  assert.throws(
    () => transitionStableReleaseSession(session, 'promotion_running', 'skip'),
    /Invalid stable release transition/,
  );
  const gatesPassed = transitionStableReleaseSession(session, 'source_gates_passed', 'passed');
  const running = transitionStableReleaseSession(gatesPassed, 'artifact_build_running', 'dispatched');
  assert.throws(
    () => transitionStableReleaseSession(running, 'source_gates_passed', 'repeat'),
    /Invalid stable release transition/,
  );
});

test('failed promotion can only rerun failed jobs in the original run', () => {
  let session = buildStableReleaseSession(plan());
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed');
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'dispatched');
  session = transitionStableReleaseSession(session, 'artifacts_qualified', 'qualified');
  session = transitionStableReleaseSession(session, 'owner_approved', 'owner receipt accepted');
  session = transitionStableReleaseSession(session, 'promotion_running', 'promotion dispatched');
  session = transitionStableReleaseSession(session, 'release_published_not_latest', 'published');
  session = transitionStableReleaseSession(session, 'distribution_synced', 'distributed');
  session = transitionStableReleaseSession(session, 'promotion_failed', 'Homebrew VM failed');
  session.promotion_run = {
    id: '29211497001',
    url: 'https://example.test/promotion',
    conclusion: 'failure',
    attempt: 1,
    rerun_requested_from_attempt: null,
  };
  session.release_owner_receipt_ref = 'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.7.12/test';
  session.metrics.workflow_dispatch_counts.promotion = 1;
  assert.deepEqual(promotionRerunArgs(session), [
    'run', 'rerun', '29211497001',
    '--repo', 'gaofeng21cn/one-person-lab-app',
    '--failed',
  ]);
  assert.equal(session.metrics.workflow_dispatch_counts.promotion, 1);
  assert.throws(
    () => transitionStableReleaseSession(session, 'owner_approved', 'redispatch'),
    /Invalid stable release transition/,
  );
  assert.equal(
    transitionStableReleaseSession(session, 'promotion_running', 'same-run retry').promotion_run.id,
    '29211497001',
  );
});

test('latest checkpoint can persist a missing saga receipt as promotion_failed', () => {
  let session = buildStableReleaseSession(plan());
  session = transitionStableReleaseSession(session, 'source_gates_passed', 'passed');
  session = transitionStableReleaseSession(session, 'artifact_build_running', 'dispatched');
  session = transitionStableReleaseSession(session, 'artifacts_qualified', 'qualified');
  session = transitionStableReleaseSession(session, 'owner_approved', 'approved');
  session = transitionStableReleaseSession(session, 'promotion_running', 'promotion');
  session = transitionStableReleaseSession(session, 'release_published_not_latest', 'published');
  session = transitionStableReleaseSession(session, 'distribution_synced', 'distributed');
  session = transitionStableReleaseSession(session, 'homebrew_verified', 'homebrew');
  session = transitionStableReleaseSession(session, 'latest_activated', 'latest');
  assert.equal(transitionStableReleaseSession(session, 'promotion_failed', 'receipt missing').phase, 'promotion_failed');
});

test('run discovery selects only a new run from the exact frozen App SHA', () => {
  const selected = selectNewCohortRun([
    {
      databaseId: 1,
      createdAt: '2026-07-12T00:00:01.000Z',
      headBranch: 'codex/release-26.7.12',
      headSha: appSha,
      status: 'queued',
      url: 'https://example.test/old',
    },
    {
      databaseId: 2,
      createdAt: '2026-07-12T00:00:02.000Z',
      headBranch: 'codex/release-26.7.12',
      headSha: 'e'.repeat(40),
      status: 'queued',
      url: 'https://example.test/wrong-cohort',
    },
    {
      databaseId: 3,
      createdAt: '2026-07-12T00:00:03.000Z',
      headBranch: 'codex/release-26.7.12',
      headSha: appSha,
      status: 'queued',
      url: 'https://example.test/current',
    },
  ], new Set([1]), appSha, 'codex/release-26.7.12', '2026-07-12T00:00:00.000Z');
  assert.equal(selected?.databaseId, 3);
});
