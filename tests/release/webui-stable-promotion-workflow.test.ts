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
const developmentWorkflowPath = path.join(
  appRoot,
  '.github',
  'workflows',
  'release-webui-development.yml',
);
const developmentPromotionWorkflowPath = path.join(
  appRoot,
  '.github',
  'workflows',
  'release-webui-development-promote.yml',
);
const sourceAppSha = 'a'.repeat(40);
const stableExecutorAppSha = 'e'.repeat(40);
const promotionAppSha = 'd'.repeat(40);
const carrierExecutorAppSha = promotionAppSha;
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
const versionDigest = digest('5');

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

function promotionExecutorRun(
  runId = carrierFollowerRunId,
  appSha = promotionAppSha,
  workflow = '.github/workflows/release-webui-follower.yml',
) {
  return {
    id: Number(runId),
    repository: { full_name: 'gaofeng21cn/one-person-lab-app' },
    head_repository: { full_name: 'gaofeng21cn/one-person-lab-app' },
    path: workflow,
    event: workflow.endsWith('release-webui-follower.yml') ? 'workflow_run' : 'workflow_dispatch',
    head_branch: 'main',
    status: 'in_progress',
    conclusion: null,
    run_attempt: 1,
    head_sha: appSha,
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
  const versionReadback = {
    ...observation(versionRef, 'present', versionDigest),
    child_digest: imageDigest,
    manifest_count: 1,
    media_type: 'application/vnd.oci.image.index.v1+json',
  };
  const prestate = observation(stableRef, 'present', digest('f'));
  const paths = {
    stableAuthorityRun: writeJson(root, 'stable-authority-run.json', stableAuthorityRun()),
    carrierFollowerRun: writeJson(root, 'carrier-follower-run.json', carrierFollowerRun(status)),
    carrierFollowerJob: writeJson(root, 'carrier-follower-job.json', carrierFollowerJob()),
    promotionExecutorRun: writeJson(
      root,
      'promotion-executor-run.json',
      promotionExecutorRun(),
    ),
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
    carrierExecutorAppSha,
    promotionExecutorRun: promotionExecutorRun(),
    promotionExecutorRunPath: paths.promotionExecutorRun,
    promotionExecutorRunId: carrierFollowerRunId,
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
    'authority_mode',
    'stable_authority_run_id',
    'carrier_follower_run_id',
    'carrier_executor_ref',
    'carrier_artifact_name',
  ]);
  assert.equal(promotion.task_modes.production_release.desktop_latest_required, true);
  assert.equal(promotion.task_modes.development_validation.desktop_latest_required, false);
  assert.equal(
    promotion.task_modes.development_validation
      .receipt_satisfies_production_latest_or_follower_handoff,
    false,
  );
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
  assert.equal(
    promotion.ordering.github_latest_before_webui_stable_applies_to,
    'production_release',
  );
  assert.equal(promotion.ordering.development_validation_may_precede_desktop_latest, true);
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
    'authority_mode',
    'stable_authority_run_id',
    'carrier_follower_run_id',
    'carrier_executor_ref',
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
  assert.match(
    source,
    /TRIGGERED_BY_STABLE_RUN_ID: \$\{\{ inputs\.authority_mode == 'production_follower' && github\.event\.workflow_run\.id \|\| inputs\.stable_authority_run_id \}\}/,
  );
  assert.match(
    source,
    /CARRIER_FOLLOWER_RUN_ID: \$\{\{ inputs\.carrier_follower_run_id \|\| github\.run_id \}\}/,
  );
  assert.match(
    source,
    /CARRIER_EXECUTOR_REF: \$\{\{ inputs\.carrier_executor_ref \|\| github\.sha \}\}/,
  );
  assert.doesNotMatch(source, /inputs\.carrier_run_id/);
  assert.match(source, /carrier-follower-jobs\.json/);
  assert.match(source, /carrier-follower-job\.json/);
  assert.match(source, /in_progress.*completed/);
  assert.match(source, /version-manifest\.json/);
  assert.match(source, /child_digest/);
  assert.match(source, /public-oci-readback\.json/);
  assert.match(source, /oras blob fetch --descriptor/);
  assert.match(source, /layer-descriptors\.json/);
  assert.match(source, /identical_bytes:true/);
  assert.match(source, /config_descriptor_verified:true/);
  assert.match(source, /carrier_artifact="\$CARRIER_ARTIFACT_NAME"/);
  assert.doesNotMatch(source, /basename "\$\(dirname "\$carrier_source"\)"/);
});

test('development dispatch is a distinct exact-Bundle protected publication lane', () => {
  const source = fs.readFileSync(developmentWorkflowPath, 'utf8');
  const workflow = YAML.parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs), ['source_run_id']);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.permissions.actions, 'read');
  assert.equal(workflow.concurrency.group, 'opl-webui-development-publication-global');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(Object.keys(workflow.jobs), [
    'resolve-frozen-bundle',
    'webui-carrier',
    'promote-webui-stable',
  ]);
  assert.equal(workflow.jobs['webui-carrier'].with.authority_mode, 'development_validation');
  assert.equal(
    workflow.jobs['promote-webui-stable'].with.authority_mode,
    'development_validation',
  );
  assert.match(source, /release-bundle\.json/);
  assert.match(source, /\.conclusion == "success" or \.conclusion == "failure"/);
  assert.doesNotMatch(source, /releases\/latest|github-latest|homebrew/i);
  assert.doesNotMatch(source, /gh workflow run|gh run rerun|gh run cancel|--force/);
});

test('development promotion-only dispatch reuses exact immutable carrier without a rebuild lane', () => {
  const source = fs.readFileSync(developmentPromotionWorkflowPath, 'utf8');
  const workflow = YAML.parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs), [
    'stable_authority_run_id',
    'carrier_follower_run_id',
    'carrier_executor_ref',
    'carrier_artifact_name',
  ]);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.permissions.actions, 'read');
  assert.equal(workflow.concurrency.group, 'opl-webui-development-promotion-only-global');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(Object.keys(workflow.jobs), ['promote-webui-stable']);
  const promotion = workflow.jobs['promote-webui-stable'];
  assert.equal(promotion.uses, './.github/workflows/release-webui-stable.yml');
  assert.equal(promotion.with.mode, 'execute');
  assert.equal(promotion.with.authority_mode, 'development_validation');
  assert.deepEqual(promotion.permissions, {
    contents: 'read',
    actions: 'read',
    packages: 'write',
  });
  assert.equal(promotion.steps, undefined);
  assert.doesNotMatch(source, /_release-webui-carrier|build-and-qualify|publish-immutable-carrier/);
  assert.doesNotMatch(source, /gh workflow run|gh run rerun|gh run cancel|--force/);
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
    assert.equal(admission.authority_mode, 'production_follower');
    assert.equal(admission.stable_authority.run_id, stableAuthorityRunId);
    assert.equal(admission.stable_authority.app_head_sha, stableExecutorAppSha);
    assert.equal(admission.carrier_follower.run_id, carrierFollowerRunId);
    assert.equal(admission.carrier_follower.carrier_job_id, carrierJobId);
    assert.equal(admission.carrier_follower.app_head_sha, carrierExecutorAppSha);
    assert.equal(
      admission.carrier_follower.triggering_stable_authority_run_id,
      stableAuthorityRunId,
    );
    assert.equal(admission.promotion_executor.run_id, carrierFollowerRunId);
    assert.equal(admission.promotion_executor.app_head_sha, promotionAppSha);
    assert.equal(admission.target.digest, versionDigest);
    assert.equal(admission.target.child_digest, imageDigest);
    assert.equal(admission.expected_prestate.digest, digest('f'));
    assert.equal(admission.framework, undefined);
    assert.equal(admission.evidence.carrier_receipt_sha256, sha256File(current.paths.carrier));
  }
});

test('development admission accepts only the exact failed Stable Bundle source and dispatch executor', () => {
  const current = fixture('in_progress');
  current.input.authorityMode = 'development_validation';
  current.input.stableAuthorityRun.conclusion = 'failure';
  current.input.stableAuthorityRun.head_sha = sourceAppSha;
  current.input.carrierFollowerRun.path = '.github/workflows/release-webui-development.yml';
  current.input.carrierFollowerRun.event = 'workflow_dispatch';
  current.input.promotionExecutorRun.path = '.github/workflows/release-webui-development.yml';
  current.input.promotionExecutorRun.event = 'workflow_dispatch';
  const admission = admitWebuiStablePromotion(current.input);
  assert.equal(admission.authority_mode, 'development_validation');
  assert.equal(admission.stable_authority.conclusion, 'failure');
  assert.equal(
    admission.promotion_executor.caller_workflow,
    '.github/workflows/release-webui-development.yml',
  );

  const drift = clone(current.input);
  drift.stableAuthorityRun.head_sha = stableExecutorAppSha;
  assert.throws(() => admitWebuiStablePromotion(drift), /Stable authority run.head_sha/);
});

test('promotion-only admission separates immutable carrier and fresh promotion executors', () => {
  const current = fixture('completed');
  const promotionRunId = '303';
  const freshPromotionAppSha = 'f'.repeat(40);
  current.input.authorityMode = 'development_validation';
  current.input.stableAuthorityRun.conclusion = 'failure';
  current.input.stableAuthorityRun.head_sha = sourceAppSha;
  current.input.carrierFollowerRun.path = '.github/workflows/release-webui-development.yml';
  current.input.carrierFollowerRun.event = 'workflow_dispatch';
  current.input.promotionExecutorRunId = promotionRunId;
  current.input.promotionAppSha = freshPromotionAppSha;
  current.input.promotionExecutorRun = promotionExecutorRun(
    promotionRunId,
    freshPromotionAppSha,
    '.github/workflows/release-webui-development-promote.yml',
  );
  writeJson(
    current.root,
    'promotion-executor-run.json',
    current.input.promotionExecutorRun,
  );

  const admission = admitWebuiStablePromotion(current.input);
  assert.equal(admission.carrier_follower.run_id, carrierFollowerRunId);
  assert.equal(admission.carrier_follower.app_head_sha, carrierExecutorAppSha);
  assert.equal(admission.promotion_executor.run_id, promotionRunId);
  assert.equal(admission.promotion_executor.app_head_sha, freshPromotionAppSha);
  assert.equal(
    admission.promotion_executor.caller_workflow,
    '.github/workflows/release-webui-development-promote.yml',
  );
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
    ['version child digest', (input) => {
      input.versionReadback.child_digest = digest('0');
    }, /version readback.child_digest/],
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
    [observation(stableRef, 'present', versionDigest), 'idempotent', 0],
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
  const targetObservation = observation(stableRef, 'present', versionDigest);
  const targetAnonymous = observation(stableRef, 'present', versionDigest, true);
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
    observation(stableRef, 'present', versionDigest),
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
