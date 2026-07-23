import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';
import {
  admitWebuiStablePromotion,
  decideWebuiStablePromotion,
  writeWebuiStablePromotionReceipt,
  type WebuiStableAdmissionInput,
} from '../../scripts/webui-stable-promotion.ts';
import {
  isAuthorizedWebuiStablePromotionWriteJob,
  validateWorkflowDispatchWriteAuthority,
} from '../../scripts/validate-release-boundary/text-check-runner.ts';

const appRoot = process.cwd();
const workflowPath = path.join(appRoot, '.github', 'workflows', 'release-webui-stable.yml');
const sourceAppSha = 'a'.repeat(40);
const stableExecutorAppSha = 'e'.repeat(40);
const promotionAppSha = 'd'.repeat(40);
const shellSha = 'b'.repeat(40);
const frameworkSha = 'c'.repeat(40);
const stableAuthorityRunId = '301';
const carrierFollowerRunId = '302';
const carrierJobId = 501;
const version = '26.7.23';
const bundleDigest = digest('1');
const cohortRef = digest('2');
const imageDigest = digest('3');
const fingerprint = digest('4');

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function writeJson(root: string, name: string, value: unknown): string {
  const filePath = path.join(root, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function observation(
  ref: string,
  status: 'present' | 'absent' | 'unknown',
  observedDigest: string | null,
  logoutBeforeReadback?: boolean,
) {
  return {
    schema: 'opl_app_webui_descriptor_readback.v1',
    ref,
    status,
    digest: observedDigest,
    ...(logoutBeforeReadback === undefined
      ? {}
      : { logout_before_readback: logoutBeforeReadback }),
  };
}

function carrierReceipt() {
  return {
    schema: 'opl_app_webui_release_carrier.v1',
    release: { version, bundle_digest: bundleDigest, cohort_ref: cohortRef },
    cohort: { app_sha: sourceAppSha, shell_sha: shellSha, framework_sha: frameworkSha },
    carrier: {
      carrier_id: 'docker_webui',
      carrier_kind: 'oci_image',
      package_profile: 'webui-full',
      ref: `ghcr.io/gaofeng21cn/one-person-lab-webui@${imageDigest}`,
      digest: imageDigest,
      size_bytes: 123456,
      content_fingerprint: fingerprint,
      os: 'linux',
      architecture: 'amd64',
    },
    qualification: {
      status: 'passed',
      image_digest: imageDigest,
      content_fingerprint: fingerprint,
    },
  };
}

function stableAuthorityRun() {
  return {
    id: Number(stableAuthorityRunId),
    repository: { full_name: 'gaofeng21cn/one-person-lab-app' },
    head_repository: { full_name: 'gaofeng21cn/one-person-lab-app' },
    path: '.github/workflows/release-stable.yml',
    event: 'workflow_dispatch',
    head_branch: 'main',
    status: 'completed',
    conclusion: 'success',
    run_attempt: 1,
    head_sha: stableExecutorAppSha,
  };
}

function carrierFollowerRun(status: 'in_progress' | 'completed' = 'in_progress') {
  return {
    id: Number(carrierFollowerRunId),
    repository: { full_name: 'gaofeng21cn/one-person-lab-app' },
    head_repository: { full_name: 'gaofeng21cn/one-person-lab-app' },
    path: '.github/workflows/release-webui-follower.yml',
    event: 'workflow_run',
    head_branch: 'main',
    status,
    conclusion: status === 'completed' ? 'success' : null,
    run_attempt: 1,
    head_sha: promotionAppSha,
  };
}

function carrierFollowerJob() {
  return {
    id: carrierJobId,
    run_id: Number(carrierFollowerRunId),
    run_url: `https://api.github.com/repos/gaofeng21cn/one-person-lab-app/actions/runs/${carrierFollowerRunId}`,
    name: 'webui-carrier / publish-immutable-carrier',
    status: 'completed',
    conclusion: 'success',
    run_attempt: 1,
    head_sha: promotionAppSha,
  };
}

function fixture(status: 'in_progress' | 'completed' = 'in_progress') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-stable-'));
  const carrier = carrierReceipt();
  const immutableRef = carrier.carrier.ref;
  const versionRef = `ghcr.io/gaofeng21cn/one-person-lab-webui:${version}`;
  const stableRef = 'ghcr.io/gaofeng21cn/one-person-lab-webui:stable';
  const immutable = observation(immutableRef, 'present', imageDigest);
  const versionReadback = observation(versionRef, 'present', imageDigest);
  const prestate = observation(stableRef, 'present', digest('f'));
  const paths = {
    stableAuthorityRun: writeJson(root, 'stable-authority-run.json', stableAuthorityRun()),
    carrierFollowerRun: writeJson(root, 'carrier-follower-run.json', carrierFollowerRun(status)),
    carrierFollowerJob: writeJson(root, 'carrier-follower-job.json', carrierFollowerJob()),
    carrier: writeJson(root, 'carrier.json', carrier),
    immutable: writeJson(root, 'immutable.json', immutable),
    version: writeJson(root, 'version.json', versionReadback),
    prestate: writeJson(root, 'prestate.json', prestate),
  };
  const input: WebuiStableAdmissionInput = {
    stableAuthorityRun: stableAuthorityRun(),
    stableAuthorityRunPath: paths.stableAuthorityRun,
    stableAuthorityRunId,
    triggeredByStableRunId: stableAuthorityRunId,
    carrierFollowerRun: carrierFollowerRun(status),
    carrierFollowerRunPath: paths.carrierFollowerRun,
    carrierFollowerRunId,
    carrierFollowerJob: carrierFollowerJob(),
    carrierFollowerJobPath: paths.carrierFollowerJob,
    promotionAppSha,
    carrierReceipt: carrier,
    carrierReceiptPath: paths.carrier,
    immutableReadback: immutable,
    immutableReadbackPath: paths.immutable,
    versionReadback,
    versionReadbackPath: paths.version,
    stablePrestate: prestate,
    stablePrestatePath: paths.prestate,
  };
  return { root, paths, input };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('contract makes WebUI Stable an independent protected carrier promotion', () => {
  const contract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  ).webui_ghcr_image;
  assert.deepEqual(contract.stable_promotion_requires, [
    'successful_stable_authority_run_after_latest_activation',
    'workflow_run_follower_bound_to_that_stable_authority',
    'unique_successful_carrier_follower_job',
    'qualified_webui_carrier_receipt',
    'immutable_version_digest',
  ]);
  const promotion = contract.stable_promotion;
  assert.equal(promotion.schema, 'opl_app_webui_stable_promotion_contract.v3');
  assert.equal(
    promotion.trigger,
    'successful_release_stable_workflow_run_follower_after_latest_activation',
  );
  assert.equal(promotion.follower_workflow, '.github/workflows/release-webui-follower.yml');
  assert.deepEqual(promotion.workflow_call_inputs, [
    'mode',
    'stable_authority_run_id',
    'carrier_artifact_name',
  ]);
  assert.equal(
    promotion.stable_authority_binding,
    'stable_authority_run_id_must_equal_github_event_workflow_run_id',
  );
  assert.equal(
    promotion.carrier_follower_binding,
    'github_run_id_of_release_webui_follower',
  );
  assert.equal(promotion.operator_supplied_run_handle_allowed, false);
  assert.deepEqual(promotion.stable_authority_requirements, [
    'release-stable.yml',
    'main',
    'attempt_1',
    'completed_success',
    'latest_activation_handoff_present',
  ]);
  assert.deepEqual(promotion.carrier_follower_requirements, [
    'release-webui-follower.yml',
    'workflow_run_event',
    'main',
    'attempt_1',
    'in_progress_or_completed',
    'exact_current_app_main_sha',
    'exact_triggering_stable_authority_run_id',
  ]);
  assert.deepEqual(promotion.promotion_executor_requirements, [
    'release-webui-stable.yml',
    'inside_release-webui-follower.yml',
    'main',
    'attempt_1',
    'exact_current_app_main_sha',
    'release-stable_protected_environment',
  ]);
  assert.equal(promotion.carrier_follower_intake.cross_run_scanning_allowed, false);
  assert.equal(promotion.carrier_follower_intake.latest_artifact_selection_allowed, false);
  assert.equal(promotion.compare_and_swap.maximum_tag_attempts, 1);
  assert.equal(promotion.unknown_outcome.maximum_bounded_read_only_descriptor_readbacks, 3);
  assert.equal(promotion.ordering.github_latest_before_webui_stable, true);
  assert.equal(promotion.ordering.desktop_latest_does_not_wait_for_webui, true);
  assert.equal(promotion.ordering.webui_stable_independent_of_framework_package_promotion, true);
  assert.equal(promotion.receipt_schema, 'opl_app_webui_stable_promotion_receipt.v3');
});

test('workflow binds the triggering Stable authority and current follower run', () => {
  const source = fs.readFileSync(workflowPath, 'utf8');
  const workflow = YAML.parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
  assert.deepEqual(Object.keys(workflow.on.workflow_call.inputs), [
    'mode',
    'stable_authority_run_id',
    'carrier_artifact_name',
  ]);
  assert.equal(
    workflow.concurrency.group,
    "${{ inputs.mode == 'execute' && 'opl-webui-stable-promotion-global' || format('opl-webui-stable-canary-{0}', github.ref) }}",
  );
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const writers = Object.entries(workflow.jobs).filter(
    ([, job]: [string, any]) => job.permissions?.packages === 'write',
  );
  assert.equal(writers.length, 1);
  assert.equal(writers[0]![0], 'promote-webui-stable');
  assert.equal((writers[0]![1] as any).needs, 'admission');
  assert.equal((writers[0]![1] as any).environment, 'release-stable');
  assert.equal(workflow.jobs.admission.permissions.packages, undefined);
  assert.equal(workflow.jobs['promote-webui-stable'].permissions.actions, 'read');
  assert.equal(workflow.jobs['promote-webui-stable'].permissions.contents, 'read');
  assert.equal((source.match(/\boras tag\b/g) ?? []).length, 1);
  assert.doesNotMatch(source, /framework_candidate_run_id|framework_latest_stable_run_id/);
  assert.doesNotMatch(source, /inputs\.source_app_run_id|^\s+workflow_dispatch:/m);
  assert.doesNotMatch(source, /homebrew|github-latest|releases\/latest/i);
  assert.doesNotMatch(source, /gh workflow run|gh run rerun|gh run cancel|--force|secrets:\s*inherit/);
  assert.match(source, /test "\$GITHUB_RUN_ATTEMPT" = 1/);
  assert.match(source, /test "\$GITHUB_REF" = refs\/heads\/main/);
  assert.match(source, /STABLE_AUTHORITY_RUN_ID: \$\{\{ inputs\.stable_authority_run_id \}\}/);
  assert.match(source, /TRIGGERED_BY_STABLE_RUN_ID: \$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(source, /CARRIER_FOLLOWER_RUN_ID: \$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(source, /inputs\.carrier_run_id/);
  assert.match(source, /carrier-follower-jobs\.json/);
  assert.match(source, /carrier-follower-job\.json/);
  assert.match(source, /in_progress.*completed/);
});

test('write authority is closed to the exact protected promotion job and exact action pins', () => {
  const workflow = YAML.parse(fs.readFileSync(workflowPath, 'utf8'));
  const job = workflow.jobs['promote-webui-stable'];
  assert.equal(
    isAuthorizedWebuiStablePromotionWriteJob(
      '.github/workflows/release-webui-stable.yml',
      'promote-webui-stable',
      job,
    ),
    true,
  );
  assert.equal(validateWorkflowDispatchWriteAuthority(appRoot), 0);
  const rejected: Array<[string, string, Record<string, unknown>]> = [
    ['.github/workflows/release-stable.yml', 'promote-webui-stable', job],
    ['.github/workflows/release-webui-stable.yml', 'publish', job],
    [
      '.github/workflows/release-webui-stable.yml',
      'promote-webui-stable',
      { ...job, needs: ['admission', 'other'] },
    ],
    [
      '.github/workflows/release-webui-stable.yml',
      'promote-webui-stable',
      { ...job, environment: 'release-webui' },
    ],
    [
      '.github/workflows/release-webui-stable.yml',
      'promote-webui-stable',
      { ...job, permissions: { ...job.permissions, issues: 'write' } },
    ],
  ];
  for (const [candidateWorkflow, candidateJob, candidate] of rejected) {
    assert.equal(
      isAuthorizedWebuiStablePromotionWriteJob(candidateWorkflow, candidateJob, candidate),
      false,
    );
  }
});

test('workflow reads only source carrier evidence before protected stable CAS', () => {
  const source = fs.readFileSync(workflowPath, 'utf8');
  const ordered = [
    'Reject noncanonical or partial promotion runs',
    'Download exact App WebUI carrier artifact',
    'Materialize exactly one carrier receipt from the exact follower run',
    'Read immutable, version, and Stable authority',
    'Seal one immutable WebUI Stable admission',
    'Re-read Stable prestate and derive CAS decision',
    'Execute at most one WebUI Stable tag mutation and reconcile read-only',
    'Write terminal WebUI Stable receipt',
    'Upload terminal WebUI Stable evidence',
  ].map((entry) => source.indexOf(entry));
  assert.ok(ordered.every((index) => index >= 0));
  assert.deepEqual([...ordered].sort((left, right) => left - right), ordered);
  for (const relativePath of [
    '.github/workflows/_release-webui-carrier.yml',
    '.github/workflows/_release-standard-publish.yml',
  ]) {
    const existing = fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
    assert.doesNotMatch(existing, /\boras tag\b.*one-person-lab-webui|\bone-person-lab-webui:stable\b/);
  }
});

test('admission binds Stable authority, carrier follower, and promotion executor separately', () => {
  for (const status of ['in_progress', 'completed'] as const) {
    const current = fixture(status);
    const admission = admitWebuiStablePromotion(current.input);
    assert.equal(admission.status, 'passed');
    assert.equal(admission.stable_authority.run_id, stableAuthorityRunId);
    assert.equal(admission.stable_authority.app_head_sha, stableExecutorAppSha);
    assert.equal(admission.carrier_follower.run_id, carrierFollowerRunId);
    assert.equal(admission.carrier_follower.carrier_job_id, carrierJobId);
    assert.equal(
      admission.carrier_follower.triggering_stable_authority_run_id,
      stableAuthorityRunId,
    );
    assert.equal(admission.promotion_executor.run_id, carrierFollowerRunId);
    assert.equal(admission.promotion_executor.app_head_sha, promotionAppSha);
    assert.equal(admission.target.digest, imageDigest);
    assert.equal(admission.expected_prestate.digest, digest('f'));
    assert.equal(admission.framework, undefined);
    assert.equal(admission.evidence.carrier_receipt_sha256, sha256File(current.paths.carrier));
  }
});

test('admission rejects stale or ambiguous source and carrier authority', () => {
  const cases: Array<[string, (input: WebuiStableAdmissionInput) => void, RegExp]> = [
    ['Stable conclusion', (input) => { input.stableAuthorityRun.conclusion = 'failure'; }, /Stable authority run.conclusion/],
    ['Stable attempt', (input) => { input.stableAuthorityRun.run_attempt = 2; }, /Stable authority run.run_attempt/],
    ['trigger mismatch', (input) => { input.triggeredByStableRunId = '999'; }, /triggering Stable authority run id/],
    ['follower status', (input) => { input.carrierFollowerRun.status = 'queued'; }, /in_progress or completed/],
    ['follower job name', (input) => { input.carrierFollowerJob.name = 'webui-carrier / desktop'; }, /carrier follower job.name/],
    ['follower job attempt', (input) => { input.carrierFollowerJob.run_attempt = 2; }, /carrier follower job.run_attempt/],
    ['carrier digest', (input) => { input.carrierReceipt.carrier.digest = digest('0'); }, /carrier receipt.carrier.ref/],
    ['version digest', (input) => { input.versionReadback.digest = digest('0'); }, /version readback.digest/],
    ['prestate unknown', (input) => {
      input.stablePrestate.status = 'unknown';
      input.stablePrestate.digest = null;
    }, /prestate is unknown/],
  ];
  for (const [label, mutate, error] of cases) {
    const current = fixture();
    const input = clone(current.input);
    mutate(input);
    assert.throws(() => admitWebuiStablePromotion(input), error, label);
  }
});

test('CAS decision table permits target idempotence or frozen predecessor to target only', () => {
  const current = fixture();
  const admission = admitWebuiStablePromotion(current.input);
  const stableRef = admission.target.stable_ref;
  const states: Array<[ReturnType<typeof observation>, string, number]> = [
    [observation(stableRef, 'present', imageDigest), 'idempotent', 0],
    [observation(stableRef, 'present', digest('f')), 'write_once', 1],
    [observation(stableRef, 'present', digest('0')), 'conflict', 0],
    [observation(stableRef, 'absent', null), 'conflict', 0],
    [observation(stableRef, 'unknown', null), 'prestate_unknown', 0],
  ];
  for (const [state, decision, attempts] of states) {
    const result = decideWebuiStablePromotion(admission, state);
    assert.equal(result.decision, decision);
    assert.equal(result.authorized_tag_attempts, attempts);
  }
});

test('terminal receipt closes complete, reconciled, unknown, idempotent, rejected, and bounded outcomes', () => {
  const current = fixture();
  const admission = admitWebuiStablePromotion(current.input);
  const stableRef = admission.target.stable_ref;
  const writeDecision = decideWebuiStablePromotion(
    admission,
    observation(stableRef, 'present', digest('f')),
  );
  const targetObservation = observation(stableRef, 'present', imageDigest);
  const targetAnonymous = observation(stableRef, 'present', imageDigest, true);
  const accepted = {
    schema: 'opl_app_webui_stable_mutation_attempt.v1',
    status: 'accepted',
    attempt_count: 1,
    attempt_id: 'attempt-1',
  };
  const unknown = { ...accepted, status: 'unknown' };
  const targetReadbacks = {
    schema: 'opl_app_webui_stable_reconcile_readbacks.v1',
    observations: [targetObservation],
  };
  assert.equal(writeWebuiStablePromotionReceipt({
    admission,
    decision: writeDecision,
    mutation: accepted,
    readbacks: targetReadbacks,
    anonymousReadback: targetAnonymous,
  }).status, 'complete');
  assert.equal(writeWebuiStablePromotionReceipt({
    admission,
    decision: writeDecision,
    mutation: unknown,
    readbacks: targetReadbacks,
    anonymousReadback: targetAnonymous,
  }).status, 'reconciled_complete');
  assert.equal(writeWebuiStablePromotionReceipt({
    admission,
    decision: writeDecision,
    mutation: unknown,
    readbacks: {
      schema: 'opl_app_webui_stable_reconcile_readbacks.v1',
      observations: [observation(stableRef, 'unknown', null)],
    },
    anonymousReadback: observation(stableRef, 'unknown', null, true),
  }).status, 'outcome_unknown');
  const idempotent = decideWebuiStablePromotion(
    admission,
    observation(stableRef, 'present', imageDigest),
  );
  assert.equal(writeWebuiStablePromotionReceipt({
    admission,
    decision: idempotent,
    mutation: { status: 'not_attempted', attempt_count: 0 },
    readbacks: { schema: 'opl_app_webui_stable_reconcile_readbacks.v1', observations: [] },
    anonymousReadback: targetAnonymous,
  }).status, 'idempotent');
  const conflict = decideWebuiStablePromotion(
    admission,
    observation(stableRef, 'present', digest('0')),
  );
  assert.equal(writeWebuiStablePromotionReceipt({
    admission,
    decision: conflict,
    mutation: { status: 'not_attempted', attempt_count: 0 },
    readbacks: { schema: 'opl_app_webui_stable_reconcile_readbacks.v1', observations: [] },
    anonymousReadback: observation(stableRef, 'present', digest('0'), true),
  }).status, 'failed');
  assert.throws(() => writeWebuiStablePromotionReceipt({
    admission,
    decision: writeDecision,
    mutation: unknown,
    readbacks: {
      schema: 'opl_app_webui_stable_reconcile_readbacks.v1',
      observations: Array.from({ length: 4 }, () => targetObservation),
    },
    anonymousReadback: targetAnonymous,
  }), /at most three/);
});
