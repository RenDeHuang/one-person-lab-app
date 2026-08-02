import test from 'node:test';
import {
  assert,
  fs,
  os,
  path,
  spawnSync,
  activateLatest,
  applyPublishPlan,
  repo,
  version,
  tag,
  deadlineAt,
  deadlineMs,
  notes,
  sourceCommit,
  expectedCurrentLatestTag,
  appendFullOperationId,
  appendFullOperationStartedAt,
  mutationAdmission,
  previewFixture,
  nightlyLatestFixture,
  success,
  fixture,
} from "./fixtures.ts";
import type {
  GitHubAdapterRuntime,
} from "./fixtures.ts";

test('explicit single-use authority may move Latest to Dev Preview without Stable latest_eligible', () => {
  const files = previewFixture();
  let latestTag = expectedCurrentLatestTag;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${files.previewTag}`) {
        return success({
          id: 12345,
          name: `One Person Lab v${files.previewVersion}`,
          draft: false,
          prerelease: false,
          target_commitish: sourceCommit,
          body: notes,
          immutable: true,
          assets: [{
            name: `One-Person-Lab-${files.previewVersion}-mac-arm64.zip`,
            size: 100,
            digest: `sha256:${'8'.repeat(64)}`,
          }],
        });
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: latestTag });
      }
      if (args.includes('PATCH')) {
        latestTag = files.previewTag;
        return success();
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = activateLatest({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
    'publication-channel': 'preview',
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(result.tag, files.previewTag);
  assert.equal(result.latest_compare_and_swap.patch_performed, true);
});

test('explicit single-use authority may move Latest to Nightly Preview without Stable latest_eligible', () => {
  const files = nightlyLatestFixture();
  let latestTag = expectedCurrentLatestTag;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${files.nightlyTag}`) {
        return success({
          id: 12345,
          name: `One Person Lab v${files.nightlyVersion}`,
          draft: false,
          prerelease: true,
          target_commitish: sourceCommit,
          body: notes,
          immutable: true,
          assets: [{
            name: `One-Person-Lab-${files.nightlyVersion}-mac-arm64.zip`,
            size: 100,
            digest: `sha256:${'7'.repeat(64)}`,
          }],
        });
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: latestTag });
      }
      if (args.includes('PATCH')) {
        latestTag = files.nightlyTag;
        return success();
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = activateLatest({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
    'publication-channel': 'nightly',
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(result.tag, files.nightlyTag);
  assert.equal(result.latest_compare_and_swap.patch_performed, true);
});

test('Preview publication rejects a Stable Bundle and every Full track before any GitHub call', () => {
  const stableFiles = fixture([]);
  const previewFull = previewFixture();
  const plan = JSON.parse(fs.readFileSync(previewFull.planPath, 'utf8'));
  plan.release_bundle_publish.track = 'full';
  plan.release_bundle_publish.receipt.release_operation = 'append_full';
  plan.release_bundle_publish.receipt.operation_control = {
    operation_id: appendFullOperationId,
    operation_started_at: appendFullOperationStartedAt,
    operation_deadline_at: deadlineAt,
  };
  fs.writeFileSync(previewFull.planPath, `${JSON.stringify(plan)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: stableFiles.bundlePath,
      plan: stableFiles.planPath,
      'operation-deadline-at': deadlineAt,
      'publication-channel': 'preview',
    }, runtime),
    (error: any) => error.result?.failure?.failure_taxonomy === 'github_mutation_publication_bundle_mismatch',
  );
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission('append_full', 'full'),
      bundle: previewFull.bundlePath,
      plan: previewFull.planPath,
      'operation-deadline-at': deadlineAt,
      'publication-channel': 'preview',
    }, runtime),
    (error: any) => error.result?.failure?.failure_taxonomy === 'github_mutation_non_stable_full_publication',
  );
  assert.equal(calls, 0);
});

test('Nightly publication rejects Stable Bundle and Full track before any GitHub call', () => {
  const stableFiles = fixture([]);
  const fullFiles = fixture([], 'append_full');
  const fullBundle = JSON.parse(fs.readFileSync(fullFiles.bundlePath, 'utf8'));
  fullBundle.release = {
    channel: 'nightly',
    version: '26.7.22-nightly',
    updater_version: '26.7.2290-nightly.0',
    tag: 'v26.7.22-nightly',
    prerelease: true,
  };
  fs.writeFileSync(fullFiles.bundlePath, `${JSON.stringify(fullBundle)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: stableFiles.bundlePath,
      plan: stableFiles.planPath,
      'operation-deadline-at': deadlineAt,
      'publication-channel': 'nightly',
    }, runtime),
    (error: any) => error.result?.failure?.failure_taxonomy === 'github_mutation_publication_bundle_mismatch',
  );
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission('append_full', 'full'),
      bundle: fullFiles.bundlePath,
      plan: fullFiles.planPath,
      'operation-deadline-at': deadlineAt,
      'publication-channel': 'nightly',
    }, runtime),
    (error: any) => error.result?.failure?.failure_taxonomy === 'github_mutation_non_stable_full_publication',
  );
  assert.equal(calls, 0);
});

test('raw Latest activation rejects append_full before gh', () => {
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest(mutationAdmission('append_full', 'full'), runtime),
    /rejects operation append_full for track full/,
  );
  assert.equal(calls, 0);
});

test('github-apply binds the caller track to the Framework publish plan before gh', () => {
  const files = fixture([]);
  const plan = JSON.parse(fs.readFileSync(files.planPath, 'utf8'));
  plan.release_bundle_publish.track = 'full';
  fs.writeFileSync(files.planPath, `${JSON.stringify(plan)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Framework publish plan track full does not match admitted standard/,
  );
  assert.equal(calls, 0);
});

test('raw mutation CLI persists typed failure evidence at the deterministic default path before exiting', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-github-admission-failure-'));
  try {
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types',
      path.join(process.cwd(), 'scripts/framework-release-adapter.ts'),
      'github-apply',
      '--operation', 'standard',
      '--track', 'standard',
      '--run-attempt', '2',
      '--additional-upload-actions', path.join(root, 'additional-upload-actions.json'),
    ], { encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: root } });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /Unknown option '--additional-upload-actions'/);
    const evidence = path.join(root, 'opl-release-mutation-failure/github-apply');
    const output = path.join(evidence, 'failure.json');
    const failure = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(failure.status, 'failed');
    assert.equal(failure.failure.schema, 'opl_release_mutation_failure_receipt.v1');
    assert.equal(failure.failure.failure_taxonomy, 'github_mutation_run_attempt_rejected');
    assert.match(failure.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(failure.failure.stdout, '');
    assert.match(failure.failure.stderr, /run-attempt 1/);
    assert.equal(fs.readFileSync(path.join(evidence, 'input-digest.txt'), 'utf8').trim(), failure.failure.input_digest);
    assert.equal(fs.readFileSync(path.join(evidence, 'stdout.txt'), 'utf8'), '');
    assert.match(fs.readFileSync(path.join(evidence, 'stderr.txt'), 'utf8'), /run-attempt 1/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
