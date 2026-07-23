import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
const validatorPath = path.join(appRoot, 'scripts', 'validate-framework-release-promotion-receipt.ts');
const appSha = 'a'.repeat(40);
const shellSha = 'b'.repeat(40);
const frameworkSha = 'c'.repeat(40);
const candidateRunId = '401';
const stableRunId = '402';
const sourceRunId = '301';
const version = '26.7.23';
const bundleDigest = digest('1');
const cohortRef = digest('2');
const imageDigest = digest('3');
const fingerprint = digest('4');
const releaseSetDigest = digest('5');
const appArtifactDigest = digest('6');
const packageIds = ['mas', 'mag', 'rca', 'oma', 'obf', 'mas-scholar-skills', 'opl-flow'];

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

function component(
  componentId: string,
  sourceCommit: string,
  artifactRef: string,
  artifactDigest = digest('7'),
) {
  return {
    component_id: componentId,
    version: '0.1.0',
    source_commit: sourceCommit,
    artifact_ref: artifactRef,
    artifact_digest: artifactDigest,
  };
}

function carrierReceipt() {
  return {
    schema: 'opl_app_webui_release_carrier.v1',
    release: { version, bundle_digest: bundleDigest, cohort_ref: cohortRef },
    source_cutoff: {
      observed_at: '2026-07-23T00:00:00Z',
      policy: 'single_read_at_freeze_admission',
      frozen_base_release_set: null,
      post_freeze_remote_refresh_allowed: false,
      later_authority_advancement_invalidates_bundle: false,
    },
    cohort: { app_sha: appSha, shell_sha: shellSha, framework_sha: frameworkSha },
    build_input: {
      schema: 'opl_app_webui_build_input.v1',
      manifest_digest: digest('8'),
      content_fingerprint: fingerprint,
    },
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
      schema: 'opl_app_webui_runtime_qualification.v1',
      status: 'passed',
      build_stage: 'webui_built',
      qualification_stage: 'webui_qualified',
      image_digest: imageDigest,
      build_input_digest: digest('8'),
      content_fingerprint: fingerprint,
      runtime_summary_sha256: digest('9'),
      registry_readback_sha256: digest('a'),
      runtime_image_id: digest('b'),
    },
  };
}

function frameworkReceipt(target: 'candidate' | 'latest-stable') {
  const channel = target;
  const packages = Object.fromEntries(packageIds.map((packageId, index) => [
    packageId,
    component(
      packageId,
      String(index + 1).repeat(40),
      `ghcr.io/gaofeng21cn/one-person-lab-packages/${packageId}:${version}`,
      digest('abcdef0'[index]!),
    ),
  ]));
  const webui = carrierReceipt().carrier;
  const app = {
    ...component(
      'opl-app',
      appSha,
      `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/One-Person-Lab-${version}-mac-arm64.dmg`,
      appArtifactDigest,
    ),
    version,
    carriers: [
      {
        carrier_id: 'macos_standard',
        carrier_kind: 'release_asset',
        package_profile: 'standard',
        ref: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/One-Person-Lab-${version}-mac-arm64.dmg`,
        digest: appArtifactDigest,
        size: 654321,
      },
      {
        carrier_id: 'docker_webui',
        carrier_kind: 'oci_image',
        package_profile: 'webui-full',
        ref: webui.ref,
        digest: webui.digest,
        size: webui.size_bytes,
        content_fingerprint: webui.content_fingerprint,
      },
    ],
  };
  const base = component(
    'opl-base',
    frameworkSha,
    `ghcr.io/gaofeng21cn/one-person-lab-framework:${version}`,
    digest('c'),
  );
  return {
    surface_kind: 'opl_release_set_promotion_receipt.v1',
    status: target === 'candidate' ? 'published_immutable_candidate' : 'promoted_latest_stable',
    promotion_target: target,
    promotion_request_id: 'app-301',
    release_gate: 'attested_candidate_auto_promotion',
    release_set_generation: version,
    carrier: {
      immutable_ref: `ghcr.io/gaofeng21cn/one-person-lab-manifest:${version}`,
      digest: releaseSetDigest,
      channel_ref: `ghcr.io/gaofeng21cn/one-person-lab-manifest:${channel}`,
    },
    framework_run: {
      repository: 'gaofeng21cn/one-person-lab',
      run_id: target === 'candidate' ? candidateRunId : stableRunId,
      run_attempt: '1',
    },
    source_app_run_id: sourceRunId,
    source_cutoff: {
      policy: 'single_read_at_freeze_admission',
      frozen_base_release_set: null,
      later_authority_advancement_invalidates_receipt: false,
    },
    app,
    components: { base, packages },
    anonymous_readback: {
      status: 'verified',
      verified_refs: [
        `ghcr.io/gaofeng21cn/one-person-lab-manifest:${channel}`,
        `ghcr.io/gaofeng21cn/one-person-lab-framework:${channel}`,
        ...packageIds.map(
          (packageId) => `ghcr.io/gaofeng21cn/one-person-lab-packages/${packageId}:${channel}`,
        ),
      ].sort(),
    },
  };
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

function fixture(): {
  root: string;
  input: WebuiStableAdmissionInput;
  paths: Record<string, string>;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-stable-'));
  const carrier = carrierReceipt();
  const candidate = frameworkReceipt('candidate');
  const stable = frameworkReceipt('latest-stable');
  const sourceRun = {
    id: Number(sourceRunId),
    repository: { full_name: 'gaofeng21cn/one-person-lab-app' },
    head_repository: { full_name: 'gaofeng21cn/one-person-lab-app' },
    path: '.github/workflows/release-stable.yml',
    event: 'workflow_dispatch',
    head_branch: 'main',
    status: 'completed',
    conclusion: 'success',
    run_attempt: 1,
    head_sha: appSha,
  };
  const homebrew = {
    schema: 'opl_bundle_homebrew_readback_receipt.v1',
    status: 'passed',
    track: 'standard',
    bundle_digest: bundleDigest,
    release_version: version,
    updater_version: '26.7.2300',
    publication_receipt_sha256: digest('d'),
    clean_vm_receipt_sha256: digest('e'),
  };
  const paths = {
    sourceRun: writeJson(root, 'source-run.json', sourceRun),
    carrier: writeJson(root, 'carrier.json', carrier),
    candidate: writeJson(root, 'candidate.json', candidate),
    stable: writeJson(root, 'stable.json', stable),
    homebrew: writeJson(root, 'homebrew.json', homebrew),
    latestAdmission: '',
    latestResult: '',
    githubLatest: '',
    immutable: '',
    version: '',
    prestate: '',
  };
  const latestAdmission = {
    schema: 'opl_standard_latest_admission_receipt.v1',
    status: 'passed',
    latest_activation_admitted: true,
    bundle_digest: bundleDigest,
    candidate: {
      display_version: version,
      updater_version: homebrew.updater_version,
      app_sha: appSha,
      shell_sha: shellSha,
      framework_sha: frameworkSha,
    },
    homebrew: { readback_receipt_sha256: sha256File(paths.homebrew) },
  };
  const latestResult = {
    status: 'complete',
    repository: 'gaofeng21cn/one-person-lab-app',
    tag: `v${version}`,
    latest_compare_and_swap: { patch_performed: true },
  };
  const githubLatest = { tag_name: `v${version}`, draft: false, prerelease: false };
  const immutableRef = carrier.carrier.ref;
  const versionRef = `ghcr.io/gaofeng21cn/one-person-lab-webui:${version}`;
  const stableRef = 'ghcr.io/gaofeng21cn/one-person-lab-webui:stable';
  const immutable = observation(immutableRef, 'present', imageDigest);
  const versionReadback = observation(versionRef, 'present', imageDigest);
  const prestate = observation(stableRef, 'present', digest('f'));
  paths.latestAdmission = writeJson(root, 'latest-admission.json', latestAdmission);
  paths.latestResult = writeJson(root, 'latest-result.json', latestResult);
  paths.githubLatest = writeJson(root, 'github-latest.json', githubLatest);
  paths.immutable = writeJson(root, 'immutable.json', immutable);
  paths.version = writeJson(root, 'version.json', versionReadback);
  paths.prestate = writeJson(root, 'prestate.json', prestate);
  return {
    root,
    paths,
    input: {
      sourceRun,
      sourceRunId,
      frameworkCandidateRunId: candidateRunId,
      frameworkStableRunId: stableRunId,
      appSha,
      carrierReceipt: carrier,
      carrierReceiptPath: paths.carrier,
      frameworkCandidateReceipt: candidate,
      frameworkCandidateReceiptPath: paths.candidate,
      frameworkStableReceipt: stable,
      frameworkStableReceiptPath: paths.stable,
      homebrewReadback: homebrew,
      homebrewReadbackPath: paths.homebrew,
      latestAdmission,
      latestAdmissionPath: paths.latestAdmission,
      latestResult,
      latestResultPath: paths.latestResult,
      githubLatest,
      githubLatestPath: paths.githubLatest,
      immutableReadback: immutable,
      immutableReadbackPath: paths.immutable,
      versionReadback,
      versionReadbackPath: paths.version,
      stablePrestate: prestate,
      stablePrestatePath: paths.prestate,
    },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withoutExpectedDiagnostics(run: () => number): number {
  const original = console.error;
  console.error = () => {};
  try {
    return run();
  } finally {
    console.error = original;
  }
}

function runFrameworkValidator(paths: Record<string, string>) {
  return spawnSync(process.execPath, [
    '--experimental-strip-types',
    validatorPath,
    '--receipt',
    paths.stable,
    '--target',
    'latest-stable',
    '--promotion-request-id',
    'app-301',
    '--release-set-generation',
    version,
    '--release-gate',
    'attested_candidate_auto_promotion',
    '--source-app-run-id',
    sourceRunId,
    '--app-version',
    version,
    '--app-source-commit',
    appSha,
    '--app-artifact-digest',
    appArtifactDigest,
    '--framework-source-commit',
    frameworkSha,
    '--framework-run-id',
    stableRunId,
    '--expected-carrier-digest',
    releaseSetDigest,
    '--candidate-receipt',
    paths.candidate,
    '--webui-carrier-receipt',
    paths.carrier,
  ], { cwd: appRoot, encoding: 'utf8' });
}

test('contract declares one independent protected WebUI Stable writer after GitHub Latest', () => {
  const contract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  ).webui_ghcr_image;
  assert.deepEqual(contract.stable_promotion_requires, [
    'immutable_version_digest',
    'verified_framework_latest_stable_receipt',
    'verified_homebrew_activation_receipt',
    'verified_github_latest_activation_receipt',
  ]);
  assert.equal(contract.publication_route, 'independent_webui_lane_outside_desktop_release_bundle');
  assert.equal(contract.desktop_release_bundle_may_publish_or_move_tags, false);
  assert.equal(contract.current_writer_declared_by_desktop_release_contract, false);
  assert.equal(contract.independent_stable_writer_declared, true);
  const promotion = contract.stable_promotion;
  assert.equal(promotion.workflow, '.github/workflows/release-webui-stable.yml');
  assert.equal(promotion.writer, 'release-webui-stable.yml#promote-webui-stable');
  assert.equal(promotion.protected_environment, 'release-stable');
  assert.deepEqual(promotion.workflow_dispatch_inputs, [
    'source_app_run_id',
    'framework_candidate_run_id',
    'framework_latest_stable_run_id',
  ]);
  assert.equal(promotion.framework_receipt_intake.cross_run_scanning_allowed, false);
  assert.equal(promotion.framework_receipt_intake.latest_artifact_selection_allowed, false);
  assert.equal(promotion.compare_and_swap.maximum_tag_attempts, 1);
  assert.equal(promotion.unknown_outcome.maximum_bounded_read_only_descriptor_readbacks, 3);
  assert.equal(promotion.ordering.github_latest_before_webui_stable, true);
});

test('workflow exposes only opaque run handles and one protected packages writer', () => {
  const source = fs.readFileSync(workflowPath, 'utf8');
  const workflow = YAML.parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs), [
    'source_app_run_id',
    'framework_candidate_run_id',
    'framework_latest_stable_run_id',
  ]);
  assert.equal(workflow.concurrency.group, 'opl-webui-stable-promotion-global');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const writers = Object.entries(workflow.jobs).filter(
    ([, job]: [string, any]) => job.permissions?.packages === 'write',
  );
  assert.equal(writers.length, 1);
  assert.equal(writers[0]![0], 'promote-webui-stable');
  assert.equal((writers[0]![1] as any).environment, 'release-stable');
  assert.equal(workflow.jobs.admission.permissions.packages, undefined);
  assert.equal(workflow.jobs['promote-webui-stable'].permissions.actions, 'read');
  assert.equal(workflow.jobs['promote-webui-stable'].permissions.contents, 'read');
  assert.equal((source.match(/\boras tag\b/g) ?? []).length, 1);
  assert.doesNotMatch(source, /gh workflow run|gh run rerun|gh run cancel|--force|secrets:\s*inherit/);
  assert.match(source, /test "\$GITHUB_RUN_ATTEMPT" = 1/);
  assert.match(source, /test "\$GITHUB_REF" = refs\/heads\/main/);
  assert.match(source, /for attempt in 1 2 3/);
  assert.match(source, /repository: gaofeng21cn\/one-person-lab/);
  assert.match(source, /run-id: \$\{\{ inputs\.framework_candidate_run_id \}\}/);
  assert.match(source, /run-id: \$\{\{ inputs\.framework_latest_stable_run_id \}\}/);
});

test('write authority is closed to the exact protected promotion job and exact action pins', (t) => {
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

  assert.equal(validateWorkflowDispatchWriteAuthority(appRoot), 0);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-stable-authority-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.github'), { recursive: true });
  fs.cpSync(
    path.join(appRoot, '.github', 'workflows'),
    path.join(root, '.github', 'workflows'),
    { recursive: true },
  );
  const fixturePath = path.join(root, '.github', 'workflows', 'release-webui-stable.yml');
  fs.writeFileSync(
    fixturePath,
    fs.readFileSync(fixturePath, 'utf8').replace(
      /actions\/download-artifact@[0-9a-f]{40}/g,
      'actions/download-artifact@v4',
    ),
  );
  assert.ok(
    withoutExpectedDiagnostics(() => validateWorkflowDispatchWriteAuthority(root)) > 0,
  );
});

test('workflow evidence and mutation ordering is explicit and desktop workflows never move WebUI Stable', () => {
  const source = fs.readFileSync(workflowPath, 'utf8');
  const ordered = [
    'Download exact App WebUI carrier artifact',
    'Download exact App Homebrew readback artifact',
    'Download exact App Latest activation artifact',
    'Download candidate receipt only from the specified Framework run',
    'Download latest-stable receipt only from the specified Framework run',
    'Verify candidate and latest-stable Framework receipts',
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

test('admission binds the exact three runs and all publication evidence', () => {
  const current = fixture();
  const admission = admitWebuiStablePromotion(current.input);
  assert.equal(admission.status, 'passed');
  assert.equal(admission.source.app_run_id, sourceRunId);
  assert.equal(admission.framework.candidate_run_id, candidateRunId);
  assert.equal(admission.framework.latest_stable_run_id, stableRunId);
  assert.equal(admission.target.digest, imageDigest);
  assert.equal(admission.expected_prestate.digest, digest('f'));
  assert.equal(admission.evidence.homebrew_readback_receipt_sha256, sha256File(current.paths.homebrew));
});

test('admission rejects receipt, Homebrew, Latest, and descriptor identity drift', () => {
  const cases: Array<[string, (input: WebuiStableAdmissionInput) => void, RegExp]> = [
    ['Framework run', (input) => { input.frameworkStableRunId = '999'; }, /Stable Framework run id/],
    ['WebUI fingerprint', (input) => {
      input.frameworkStableReceipt.app.carriers[1].content_fingerprint = digest('0');
    }, /WebUI content fingerprint|changed the candidate App/],
    ['Homebrew digest', (input) => {
      input.latestAdmission.homebrew.readback_receipt_sha256 = digest('0');
    }, /Homebrew readback digest/],
    ['Latest result', (input) => { input.latestResult.status = 'outcome_unknown'; }, /complete or idempotent/],
    ['fresh Latest', (input) => { input.githubLatest.tag_name = 'v26.7.22'; }, /fresh GitHub Latest tag/],
    ['version tag', (input) => { input.versionReadback.digest = digest('0'); }, /version readback.digest/],
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

test('Framework validator binds WebUI ref, digest, fingerprint, and size to the App carrier', () => {
  const current = fixture();
  const positive = runFrameworkValidator(current.paths);
  assert.equal(positive.status, 0, positive.stderr || positive.stdout);
  for (const [field, value] of [
    ['ref', `ghcr.io/gaofeng21cn/one-person-lab-webui@${digest('0')}`],
    ['digest', digest('0')],
    ['content_fingerprint', digest('0')],
    ['size', 999],
  ] as const) {
    const negative = fixture();
    const candidate = JSON.parse(fs.readFileSync(negative.paths.candidate, 'utf8'));
    const stable = JSON.parse(fs.readFileSync(negative.paths.stable, 'utf8'));
    candidate.app.carriers[1][field] = value;
    stable.app.carriers[1][field] = value;
    writeJson(negative.root, 'candidate.json', candidate);
    writeJson(negative.root, 'stable.json', stable);
    const result = runFrameworkValidator(negative.paths);
    assert.notEqual(result.status, 0, `${field} drift must fail`);
  }
});

test('CAS decision table permits only target idempotence or frozen predecessor to target', () => {
  const current = fixture();
  const admission = admitWebuiStablePromotion(current.input);
  const stableRef = admission.target.stable_ref;
  const states: Array<[
    ReturnType<typeof observation>,
    string,
    number,
  ]> = [
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
  const bootstrapFixture = fixture();
  bootstrapFixture.input.stablePrestate = observation(stableRef, 'absent', null);
  const bootstrap = admitWebuiStablePromotion(bootstrapFixture.input);
  assert.equal(
    decideWebuiStablePromotion(bootstrap, observation(stableRef, 'absent', null)).decision,
    'write_once',
  );
});

test('terminal receipt closes complete, reconciled, unknown, idempotent, and rejected outcomes', () => {
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
