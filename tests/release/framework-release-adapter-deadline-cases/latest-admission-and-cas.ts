import test from 'node:test';
import {
  assert,
  fs,
  activateLatest,
  applyPublishPlan,
  inspectRelease,
  repo,
  tag,
  deadlineAt,
  deadlineMs,
  expectedCurrentLatestTag,
  mutationAdmission,
  expectedMutationAttemptId,
  sealAdmission,
  success,
  releaseResponse,
  fixture,
  isReleaseInspect,
} from "./fixtures.ts";
import type {
  GitHubAdapterRuntime,
  GitHubCommandOptions,
} from "./fixtures.ts";

test('a timed out Latest PATCH performs readback only and remains outcome_unknown', () => {
  const files = fixture([]);
  const calls: string[][] = [];
  let latestTag = expectedCurrentLatestTag;
  let latestReads = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 45_000,
    readTimeoutMs: 3_456,
    run(_command, args, options) {
      calls.push(args);
      assert.equal(options.killSignal, 'SIGTERM');
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        latestReads += 1;
        assert.equal(options.timeout, 3_456);
        return success({ tag_name: latestTag });
      }
      if (args.includes('PATCH')) {
        latestTag = tag;
        return {
          status: null,
          signal: 'SIGTERM',
          stdout: 'possibly accepted',
          stderr: 'deadline killed process',
          error: Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        };
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = activateLatest({
    ...mutationAdmission('resume_standard'),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  const patches = calls.filter((args) => args.includes('PATCH'));
  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_timeout');
  assert.equal(result.mutation_attempt_id, expectedMutationAttemptId(
    'latest_patch', `github-latest:${repo}@${tag}`, tag,
  ));
  assert.equal(result.remote_target, `github-latest:${repo}@${tag}`);
  assert.equal(result.failure.mutation_attempt_id, result.mutation_attempt_id);
  assert.equal(result.failure.remote_target, result.remote_target);
  assert.equal(result.retry_disposition, 'read_only_reconcile_only');
  assert.equal(result.reconciliation.observation.tag_name, tag);
  assert.equal(patches.length, 1);
  assert.equal(latestReads, 2, 'one pre-mutation inspect and one post-timeout readback');
});

test('read-only inspection remains bounded after the operation deadline', () => {
  const seen: GitHubCommandOptions[] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs + 60_000,
    readTimeoutMs: 4_567,
    run(_command, args, options) {
      seen.push(options);
      assert.equal(isReleaseInspect(args), true);
      return success(releaseResponse([]));
    },
  };

  const observation = inspectRelease(repo, tag, runtime);
  assert.equal(observation.release.exists, true);
  assert.deepEqual(seen.map(({ timeout, killSignal }) => ({ timeout, killSignal })), [
    { timeout: 4_567, killSignal: 'SIGTERM' },
  ]);
});

test('Framework latest_eligible cannot bypass the App Latest admission receipt', () => {
  const files = fixture([]);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Missing --latest-admission/,
  );
  assert.equal(calls, 0);
});

test('complete hosted admission does not require legacy Framework latest_eligible state', () => {
  const files = fixture([]);
  const status = JSON.parse(fs.readFileSync(files.statusPath, 'utf8'));
  status.release_bundle_status.latest_eligible = false;
  fs.writeFileSync(files.statusPath, `${JSON.stringify(status)}\n`);
  let latestTag = expectedCurrentLatestTag;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: latestTag });
      }
      if (args.includes('PATCH')) {
        latestTag = tag;
        return success();
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };
  const result = activateLatest({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(result.latest_compare_and_swap.patch_performed, true);
});

test('Latest admission for different ZIP bytes fails before any GitHub call', () => {
  const files = fixture([]);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.candidate.zip.sha256 = `sha256:${'f'.repeat(64)}`;
  sealAdmission(admission);
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Latest admission ZIP sha256 does not match/,
  );
  assert.equal(calls, 0);
});

test('GitHub mutation commands require an immutable operation deadline', () => {
  assert.throws(() => applyPublishPlan(mutationAdmission()), /Missing --operation-deadline-at/);
  assert.throws(() => activateLatest(mutationAdmission()), /Missing --operation-deadline-at/);
});

test('GitHub mutation commands require an explicit publication channel before any GitHub call', () => {
  const files = fixture([]);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  const values = mutationAdmission();
  delete values['publication-channel'];
  assert.throws(
    () => applyPublishPlan({
      ...values,
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Missing --publication-channel/,
  );
  assert.throws(
    () => activateLatest({
      ...values,
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Missing --publication-channel/,
  );
  assert.equal(calls, 0);
});

test('GitHub mutation commands reject incomplete operation identity before any gh call', () => {
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  for (const missing of ['operation-id', 'operation-started-at', 'attempt-id'] as const) {
    const values: Record<string, string> = {
      ...mutationAdmission(),
      'operation-deadline-at': deadlineAt,
    };
    delete values[missing];
    assert.throws(
      () => applyPublishPlan(values, runtime),
      (error: any) => {
        assert.equal(error.result.status, 'failed');
        assert.match(error.result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
        assert.ok(error.result.failure.stderr);
        return true;
      },
    );
  }
  assert.equal(calls, 0);
});

test('Latest compare-and-swap drift fails closed before PATCH', () => {
  const files = fixture([]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: 'v26.7.19' });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    (error: any) => {
      assert.equal(error.result.status, 'failed');
      assert.equal(error.result.failure.failure_taxonomy, 'github_latest_compare_and_swap_drift');
      assert.equal(error.result.failure.expected_current_tag, expectedCurrentLatestTag);
      assert.equal(error.result.failure.observed_current_tag, 'v26.7.19');
      assert.equal(error.result.retry_disposition, 'inspect_only_no_patch_require_new_admission');
      assert.match(error.result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
      assert.equal(error.result.failure.stdout, '');
      assert.match(error.result.failure.stderr, /Latest drifted/);
      return true;
    },
  );
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
});

test('Latest already pointing at the candidate is idempotent with zero PATCH', () => {
  const files = fixture([]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: tag });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = activateLatest({
    ...mutationAdmission('resume_standard'),
    bundle: files.bundlePath,
    status: files.statusPath,
    'latest-admission': files.admissionPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'idempotent');
  assert.equal(result.latest_compare_and_swap.patch_performed, false);
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
});

test('Latest compare-and-swap rejects remote drift from the sealed expected current tag', () => {
  const files = fixture([]);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.latest_compare_and_swap.expected_current = {
    tag: 'v26.7.19',
  };
  sealAdmission(admission);
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls += 1;
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/latest`) {
        return success({ tag_name: expectedCurrentLatestTag });
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Latest drifted: expected v26\.7\.19, observed v26\.7\.20/,
  );
  assert.equal(calls, 2);
});

test('Latest rejects a tampered compare-and-swap predecessor before any GitHub call', () => {
  const files = fixture([]);
  const admission = JSON.parse(fs.readFileSync(files.admissionPath, 'utf8'));
  admission.latest_compare_and_swap.expected_current = {
    tag: 'v26.7.21',
  };
  fs.writeFileSync(files.admissionPath, `${JSON.stringify(admission)}\n`);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  assert.throws(
    () => activateLatest({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      status: files.statusPath,
      'latest-admission': files.admissionPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /Latest admission input_digest does not match/,
  );
  assert.equal(calls, 0);
});

test('raw GitHub mutation commands reject reruns and operation-track mismatches before gh', () => {
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      return success();
    },
  };
  for (const values of [
    { 'run-attempt': '1' },
    { operation: 'standard', 'run-attempt': '1' },
    { operation: 'publish', track: 'standard', 'run-attempt': '1' },
    { operation: 'standard', track: 'nightly', 'run-attempt': '1' },
    { ...mutationAdmission(), 'run-attempt': '2' },
    { ...mutationAdmission('append_full', 'standard') },
    { ...mutationAdmission('standard', 'full') },
  ]) {
    assert.throws(
      () => applyPublishPlan(values, runtime),
      (error: any) => {
        assert.equal(error.result.status, 'failed');
        assert.match(error.result.failure.input_digest, /^sha256:[0-9a-f]{64}$/);
        assert.equal(error.result.failure.stdout, '');
        assert.ok(error.result.failure.stderr);
        return true;
      },
    );
  }
  assert.equal(calls, 0);
});
