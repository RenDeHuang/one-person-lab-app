import test from 'node:test';
import {
  assert,
  fs,
  path,
  applyPublishPlan,
  fullAdjunctReleaseIdentity,
  inspectRelease,
  repo,
  canonicalRepo,
  version,
  tag,
  deadlineAt,
  deadlineMs,
  notes,
  sourceCommit,
  executorCommit,
  standardOperationId,
  stableAuthorityRunId,
  durablePublicationRecord,
  mutationAdmission,
  previewFixture,
  success,
  releaseResponse,
  fixture,
  asset,
  isReleaseInspect,
  isReleaseViewFor,
  isTagRefReadFor,
  isTagRefCreateFor,
  tagRefResponse,
  isImmutableCapabilityRead,
  immutableCapabilityResponse,
  fullPublicationRuntime,
} from "./fixtures.ts";
import type {
  GitHubAdapterRuntime,
  Asset,
} from "./fixtures.ts";

test('github-apply admits append_full only for a Framework Full publish plan', () => {
  const files = fixture([], 'append_full');
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  const adjunct = fullAdjunctReleaseIdentity(bundle, files.uploadActions);
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls += 1;
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${adjunct.tag}`) {
        return success({
          ...releaseResponse(files.uploadActions, { targetCommitish: executorCommit }),
          tag_name: adjunct.tag,
          name: adjunct.name,
          body: adjunct.notes,
        });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = applyPublishPlan({
    ...mutationAdmission('append_full', 'full'),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(result.tag, adjunct.tag);
  assert.equal(result.adjunct.target_standard_release.release_id, 12345);
  assert.equal(result.adjunct.target_standard_release.tag, tag);
  assert.match(result.adjunct.notes, /Full content sources: App a{40}, Shell c{40}, Framework d{40}/);
  assert.match(result.adjunct.notes, /Release executor App source: e{40}/);
  assert.equal(calls, 1);
});

test('append_full rehearsal binds the real publication contract to the executor head without mutation', () => {
  const files = fixture([], 'append_full');
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  const adjunct = fullAdjunctReleaseIdentity(bundle, files.uploadActions);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${adjunct.tag}`) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isReleaseViewFor(args, adjunct.tag, repo)) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission('append_full', 'full'),
    'mutation-mode': 'rehearsal',
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'rehearsal_complete');
  assert.equal(result.mutation_authorized, false);
  assert.equal(result.mutation_attempted, false);
  assert.equal(result.target_commitish, executorCommit);
  assert.equal(result.adjunct.target_standard_release.target_commitish, sourceCommit);
  assert.equal(result.adjunct.release_executor.app_sha, executorCommit);
  assert.equal(calls.some((args) => isTagRefCreateFor(args, repo)), false);
  assert.equal(calls.some((args) => args.includes('POST') || args.includes('PATCH')), false);
});

test('append_full rejects the old content target before GitHub when it differs from the executor head', () => {
  const files = fixture([], 'append_full');
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
      ...mutationAdmission('append_full', 'full'),
      'executor-app-sha': sourceCommit,
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /must match the exact release executor/,
  );
  assert.equal(calls, 0);
});

test('append_full reserves the adjunct tag at the executor head, not the old content SHA', () => {
  const files = fixture([], 'append_full');
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  const adjunct = fullAdjunctReleaseIdentity(bundle, files.uploadActions);
  const tagBodies: string[] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 90_000,
    run(_command, args, options) {
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${adjunct.tag}`) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isReleaseViewFor(args, adjunct.tag, repo)) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefReadFor(args, adjunct.tag, repo)) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagBodies.push(String(options.input));
        return {
          status: null,
          signal: 'SIGTERM',
          stdout: '',
          stderr: 'timed out',
          error: Object.assign(new Error('spawnSync gh ETIMEDOUT'), { code: 'ETIMEDOUT' }),
        };
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission('append_full', 'full'),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.failure.mutation, 'tag_reserve');
  assert.deepEqual(JSON.parse(tagBodies[0]!), {
    ref: `refs/tags/${adjunct.tag}`,
    sha: executorCommit,
  });
  assert.notEqual(executorCommit, sourceCommit);
});

test('append_full creates, uploads both assets, and publishes against the executor head', () => {
  const files = fixture([], 'append_full');
  const simulated = fullPublicationRuntime(files);

  const result = applyPublishPlan({
    ...mutationAdmission('append_full', 'full'),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, simulated.runtime);

  assert.equal(result.status, 'complete');
  assert.equal(result.tag, simulated.adjunct.tag);
  assert.equal(result.inspection.release.target_commitish, executorCommit);
  assert.equal(result.inspection.release.immutable, true);
  assert.deepEqual(result.uploaded, files.uploadActions.map((asset) => asset.name));
  assert.deepEqual(simulated.remoteAssets.map((asset) => asset.name), [
    `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
    'opl-release-manifest.json',
  ]);
  assert.equal(
    simulated.calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length,
    2,
  );
  assert.equal(simulated.calls.filter((args) => args.includes('PATCH')).length, 1);
  assert.equal(JSON.parse(simulated.mutationInputs[0]!).sha, executorCommit);
  assert.equal(JSON.parse(simulated.mutationInputs[1]!).target_commitish, executorCommit);
  assert.notEqual(executorCommit, sourceCommit);
});

test('an identity failure after an accepted Full mutation records read-only reconcile disposition', () => {
  const files = fixture([], 'append_full');
  const simulated = fullPublicationRuntime(files, {
    targetDriftAfterFirstUpload: 'f'.repeat(40),
  });

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission('append_full', 'full'),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, simulated.runtime),
    (error: any) => {
      assert.equal(error.result.status, 'failed');
      assert.equal(error.result.retry_disposition, 'read_only_reconcile_only_no_retry');
      assert.equal(error.result.failure.mutation_attempted, true);
      assert.ok(error.result.failure.mutation_attempts.length >= 3);
      assert.match(error.result.failure.stderr, /Release identity conflicts/);
      return true;
    },
  );
  assert.equal(
    simulated.calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length,
    1,
  );
  assert.equal(simulated.calls.filter((args) => args.includes('PATCH')).length, 0);
});

test('append_full identity fails closed without its own manifest and never inspects a Standard Release', () => {
  const bundle = {
    release: { version, tag },
    sources: { app: { repo, source_commit: sourceCommit } },
  };
  let calls = 0;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run() {
      calls += 1;
      throw new Error('No GitHub read is allowed before Full self-identity validation.');
    },
  };
  assert.throws(
    () => fullAdjunctReleaseIdentity(bundle, []),
    /exactly one opl-release-manifest\.json upload action/,
  );
  assert.equal(calls, 0);
});

test('an exact published Full adjunct remains idempotent with complete discovery metadata', () => {
  const files = fixture([], 'append_full');
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  const adjunct = fullAdjunctReleaseIdentity(bundle, files.uploadActions);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) {
        return success(releaseResponse([], { immutable: true }));
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${adjunct.tag}`) {
        return success({
          ...releaseResponse(files.uploadActions, {
            immutable: true,
            targetCommitish: executorCommit,
          }),
          tag_name: adjunct.tag,
          name: adjunct.name,
          body: adjunct.notes,
        });
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = applyPublishPlan({
    ...mutationAdmission('append_full', 'full'),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.equal(result.adjunct.tag, adjunct.tag);
  assert.deepEqual(result.adjunct.manifest, adjunct.manifest);
  assert.deepEqual(result.adjunct.artifact, adjunct.artifact);
  assert.deepEqual(result.adjunct.target_standard_release, adjunct.target_standard_release);
  assert.deepEqual(result.adjunct.release_executor, adjunct.release_executor);
  assert.deepEqual(result.adjunct.full_content_sources, adjunct.full_content_sources);
  assert.equal(result.adjunct.release_url, `https://github.com/${repo}/releases/tag/${adjunct.tag}`);
  assert.equal(
    result.adjunct.asset_download_base_url,
    `https://github.com/${repo}/releases/download/${adjunct.tag}`,
  );
  assert.equal(calls.every((args) => args[0] === 'api'), true);
});

test('github-apply publishes a Nightly Bundle as prerelease and never as Latest', () => {
  const files = fixture([]);
  const nightlyVersion = '26.7.22-nightly';
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  bundle.release = {
    channel: 'nightly',
    version: nightlyVersion,
    updater_version: '26.7.2290-nightly.0',
    tag: `v${nightlyVersion}`,
    prerelease: true,
  };
  fs.writeFileSync(files.bundlePath, `${JSON.stringify(bundle)}\n`);
  const calls: Array<{ args: string[]; stdin?: string }> = [];
  let tagReserved = false;
  let exists = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args, options) {
      calls.push({ args, stdin: options.input });
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/v${nightlyVersion}`) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success({
          id: 12345,
          tag_name: `v${nightlyVersion}`,
          name: `One Person Lab v${nightlyVersion}`,
          draft: !published,
          prerelease: true,
          target_commitish: sourceCommit,
          body: notes,
          immutable: published,
          assets: [],
        });
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/12345`) {
        return success({
          id: 12345,
          tag_name: `v${nightlyVersion}`,
          name: `One Person Lab v${nightlyVersion}`,
          draft: !published,
          prerelease: true,
          target_commitish: sourceCommit,
          body: notes,
          immutable: published,
          assets: [],
        });
      }
      if (isReleaseViewFor(args, `v${nightlyVersion}`, repo)) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefReadFor(args, `v${nightlyVersion}`, repo)) {
        return tagReserved
          ? tagRefResponse(`v${nightlyVersion}`)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(`v${nightlyVersion}`);
      }
      if (args[3] === `repos/${repo}/releases`) {
        exists = true;
        return success({
          id: 12345,
          tag_name: `v${nightlyVersion}`,
          name: `One Person Lab v${nightlyVersion}`,
          draft: true,
          prerelease: true,
          target_commitish: sourceCommit,
          body: notes,
          immutable: false,
          assets: [],
        });
      }
      if (args.includes('PATCH')) {
        published = true;
        return success();
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
    'publication-channel': 'nightly',
  }, runtime);
  assert.equal(result.status, 'complete');
  const create = calls.find(({ args }) => args[3] === `repos/${repo}/releases`);
  assert.ok(create?.stdin);
  const payload = JSON.parse(create.stdin);
  assert.equal(payload.prerelease, true);
  assert.equal(payload.draft, true);
  assert.equal(payload.make_latest, 'false');
});

test('github-apply publishes a qualified Preview as a non-prerelease without implicitly changing Latest', () => {
  const files = previewFixture();
  const calls: Array<{ args: string[]; stdin?: string }> = [];
  let tagReserved = false;
  let exists = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args, options) {
      calls.push({ args, stdin: options.input });
      if (isImmutableCapabilityRead(args)) return immutableCapabilityResponse();
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/tags/${files.previewTag}`) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success({
          id: 12345,
          tag_name: files.previewTag,
          name: `One Person Lab v${files.previewVersion}`,
          draft: !published,
          prerelease: false,
          target_commitish: sourceCommit,
          body: notes,
          immutable: published,
          assets: [],
        });
      }
      if (args[0] === 'api' && args[1] === `repos/${repo}/releases/12345`) {
        return success({
          id: 12345,
          tag_name: files.previewTag,
          name: `One Person Lab v${files.previewVersion}`,
          draft: !published,
          prerelease: false,
          target_commitish: sourceCommit,
          body: notes,
          immutable: published,
          assets: [],
        });
      }
      if (isReleaseViewFor(args, files.previewTag, repo)) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefReadFor(args, files.previewTag, repo)) {
        return tagReserved
          ? tagRefResponse(files.previewTag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(files.previewTag);
      }
      if (args[3] === `repos/${repo}/releases`) {
        exists = true;
        return success({
          id: 12345,
          tag_name: files.previewTag,
          name: `One Person Lab v${files.previewVersion}`,
          draft: true,
          prerelease: false,
          target_commitish: sourceCommit,
          body: notes,
          immutable: false,
          assets: [],
        });
      }
      if (args.includes('PATCH')) {
        published = true;
        return success();
      }
      throw new Error(`Unexpected gh call: ${args.join(' ')}`);
    },
  };
  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
    'publication-channel': 'preview',
  }, runtime);
  assert.equal(result.status, 'complete');
  const create = calls.find(({ args }) => args[3] === `repos/${repo}/releases`);
  assert.ok(create?.stdin);
  const payload = JSON.parse(create.stdin);
  assert.equal(payload.prerelease, false);
  assert.equal(payload.draft, true);
  assert.equal(payload.make_latest, 'false');
});

test('release inspection treats an absent immutable field as false, never true', () => {
  const response = releaseResponse([]);
  delete response.immutable;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      assert.equal(isReleaseInspect(args), true);
      return success(response);
    },
  };
  assert.equal(inspectRelease(repo, tag, runtime).release.immutable, false);
});

test('canonical Stable publication fails closed without bound capability evidence and never calls the admin API', () => {
  const files = fixture([asset('first.zip', '1')]);
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  bundle.sources.app.repo = canonicalRepo;
  fs.writeFileSync(files.bundlePath, `${JSON.stringify(bundle)}\n`);
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
    (error: any) => {
      assert.equal(error.result.status, 'failed');
      assert.equal(error.result.failure.failure_taxonomy, 'github_immutable_releases_evidence_invalid');
      return true;
    },
  );
  assert.equal(calls, 2, 'only bounded tag and draft discovery reads are allowed before evidence rejection');
});

test('canonical Stable publication consumes the exact durable record and never calls immutable-releases at runtime', () => {
  const first = asset('first.zip', '2');
  const files = fixture([first]);
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  bundle.sources.app.repo = canonicalRepo;
  fs.writeFileSync(files.bundlePath, `${JSON.stringify(bundle)}\n`);
  const durable = durablePublicationRecord(files.root, [first]);
  assert.notEqual(durable.operationId, standardOperationId);
  const additionalPath = path.join(files.root, 'additional-upload-actions.json');
  fs.writeFileSync(additionalPath, `${JSON.stringify({
    schema: 'opl_app_immutable_release_upload_actions.v1',
    upload_actions: [durable.recordAction],
  })}\n`);

  const calls: string[][] = [];
  const remoteAssets: Asset[] = [];
  let tagReserved = false;
  let exists = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (args[0] === 'api' && args[1] === `repos/${canonicalRepo}/immutable-releases`) {
        throw new Error('The Actions runtime must not read the admin-only immutable Releases endpoint.');
      }
      if (args[0] === 'api' && args[1] === `repos/${canonicalRepo}/releases/tags/${tag}`) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success(releaseResponse(remoteAssets, {
          draft: !published,
          immutable: published,
        }));
      }
      if (args[0] === 'api' && args[1] === `repos/${canonicalRepo}/releases/12345`) {
        return success(releaseResponse(remoteAssets, {
          draft: !published,
          immutable: published,
        }));
      }
      if (isReleaseViewFor(args, tag, canonicalRepo)) {
        return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefReadFor(args, tag, canonicalRepo)) {
        return tagReserved
          ? tagRefResponse(tag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, canonicalRepo)) {
        tagReserved = true;
        return tagRefResponse(tag);
      }
      if (args[3] === `repos/${canonicalRepo}/releases`) {
        exists = true;
        return success(releaseResponse([], { draft: true, immutable: false }));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        const uploaded = [first, durable.recordAction].find(
          (candidate) => candidate.source_path === args[3],
        );
        assert.ok(uploaded);
        remoteAssets.push({
          name: uploaded.name,
          source_path: uploaded.source_path,
          size_bytes: uploaded.size_bytes,
          sha256: uploaded.sha256,
        });
        return success();
      }
      if (args.includes('PATCH')) {
        published = true;
        return success();
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      'authority-run-id': '30325431855',
      bundle: files.bundlePath,
      plan: files.planPath,
      'additional-upload-actions': additionalPath,
      'publication-record': durable.recordPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    (error: any) => {
      assert.equal(
        error.result.failure.validation_error,
        'Publication record authority run does not match the admitted Stable source run.',
      );
      return true;
    },
  );
  assert.equal(exists, false);
  assert.deepEqual(remoteAssets, []);

  const result = applyPublishPlan({
    ...mutationAdmission(),
    'authority-run-id': stableAuthorityRunId,
    bundle: files.bundlePath,
    plan: files.planPath,
    'additional-upload-actions': additionalPath,
    'publication-record': durable.recordPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'complete');
  assert.deepEqual(result.uploaded, [first.name, durable.recordAction.name]);
  assert.equal(
    calls.some((args) => args[0] === 'api' && args[1] === `repos/${canonicalRepo}/immutable-releases`),
    false,
  );
  assert.equal(result.inspection.release.immutable, true);
});
