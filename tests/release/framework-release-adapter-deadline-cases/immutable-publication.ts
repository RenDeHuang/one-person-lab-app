import test from 'node:test';
import {
  assert,
  fs,
  path,
  applyPublishPlan,
  repo,
  tag,
  deadlineAt,
  deadlineMs,
  mutationAdmission,
  success,
  releaseResponse,
  fixture,
  asset,
  legacyNotes,
  projectedLegacyNotes,
  isReleaseInspect,
  isReleaseView,
  isTagRefReadFor,
  isTagRefCreateFor,
  tagRefResponse,
} from "./fixtures.ts";
import type {
  GitHubAdapterRuntime,
  Asset,
} from "./fixtures.ts";

test('standard publication projects legacy frozen notes before creating the GitHub Release', () => {
  const files = fixture([]);
  const bundle = JSON.parse(fs.readFileSync(files.bundlePath, 'utf8'));
  bundle.prepared_notes.markdown = legacyNotes;
  fs.writeFileSync(files.bundlePath, `${JSON.stringify(bundle)}\n`);
  const calls: Array<{ args: string[]; stdin?: string }> = [];
  let tagReserved = false;
  let exists = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args, options) {
      calls.push({ args, stdin: options.input });
      if (isReleaseInspect(args)) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success(releaseResponse([], {
          draft: !published,
          immutable: false,
          body: projectedLegacyNotes,
        }));
      }
      if (isReleaseView(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isTagRefReadFor(args, tag, repo)) {
        return tagReserved
          ? tagRefResponse(tag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(tag);
      }
      if (args[3] === `repos/${repo}/releases`) {
        exists = true;
        return success(releaseResponse([], {
          draft: true,
          immutable: false,
          body: projectedLegacyNotes,
        }));
      }
      if (args.includes('PATCH')) {
        published = true;
        return success();
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);

  assert.equal(result.status, 'complete');
  const create = calls.find(({ args }) => args[3] === `repos/${repo}/releases`);
  assert.ok(create?.stdin);
  assert.equal(JSON.parse(create.stdin).body, projectedLegacyNotes);
});

test('an exact immutable published carrier remains a read-only idempotent reconcile when capability is disabled', () => {
  const first = asset('first.zip', '2');
  const files = fixture([first]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) {
        return success(releaseResponse([first], { draft: false, immutable: true }));
      }
      throw new Error(`Unexpected GitHub mutation or capability read: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.uploaded, []);
  assert.equal(calls.every(isReleaseInspect), true);
});

test('unexpected remote assets fail before immutable publication', () => {
  const first = asset('first.zip', '2');
  const unexpected = asset('unexpected.bin', '3');
  const files = fixture([first]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) {
        return success(releaseResponse([unexpected], { draft: true, immutable: false }));
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /unexpected asset outside the exact planned set/i,
  );
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
});

test('duplicate planned asset names fail before capability read or public mutation', () => {
  const first = asset('first.zip', '4');
  const files = fixture([first]);
  const plan = JSON.parse(fs.readFileSync(files.planPath, 'utf8'));
  plan.release_bundle_publish.receipt.details.upload_actions.push({
    action: 'upload',
    name: first.name,
    source_path: first.source_path,
    size_bytes: first.size_bytes,
    sha256: first.sha256,
  });
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
    /duplicate or invalid asset names/i,
  );
  assert.equal(calls, 0);
});

test('supplemental immutable carrier receipt joins the exact draft asset set once', () => {
  const first = asset('desktop.zip', 'a');
  const durableReceipt = asset('opl-stable-operation-control.json', 'b');
  const files = fixture([first]);
  const additionalPath = path.join(files.root, 'additional-upload-actions.json');
  fs.writeFileSync(additionalPath, `${JSON.stringify({
    schema: 'opl_app_immutable_release_upload_actions.v1',
    upload_actions: [{ action: 'upload', ...durableReceipt }],
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
      if (isReleaseInspect(args)) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success(releaseResponse(remoteAssets, { draft: !published, immutable: false }));
      }
      if (isReleaseView(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isTagRefReadFor(args, tag, repo)) {
        return tagReserved
          ? tagRefResponse(tag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(tag);
      }
      if (args[3] === `repos/${repo}/releases`) {
        exists = true;
        return success(releaseResponse([], { draft: true, immutable: false }));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        const uploaded = [first, durableReceipt].find((asset) => asset.source_path === args[3]);
        assert.ok(uploaded, `unexpected upload ${args[3]}`);
        remoteAssets.push(uploaded);
        return success();
      }
      if (args.includes('PATCH')) {
        assert.deepEqual(remoteAssets.map((asset) => asset.name).sort(), [first.name, durableReceipt.name].sort());
        published = true;
        return success();
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
    'additional-upload-actions': additionalPath,
  }, runtime);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.uploaded, [first.name, durableReceipt.name]);
  const publishIndex = calls.findIndex((args) => args.includes('PATCH'));
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 2);
  assert.ok(publishIndex > calls.findIndex((args) => args[0] === 'release' && args[1] === 'upload'));
});

test('supplemental immutable carrier actions reject a duplicate main-plan asset before GitHub access', () => {
  const first = asset('desktop.zip', 'c');
  const files = fixture([first]);
  const additionalPath = path.join(files.root, 'duplicate-upload-actions.json');
  fs.writeFileSync(additionalPath, `${JSON.stringify({
    schema: 'opl_app_immutable_release_upload_actions.v1',
    upload_actions: [{ action: 'upload', ...first }],
  })}\n`);
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
      'additional-upload-actions': additionalPath,
    }, runtime),
    /duplicate or invalid asset names/i,
  );
  assert.equal(calls, 0);
});

test('duplicate remote asset names fail before immutable publication', () => {
  const first = asset('first.zip', '5');
  const files = fixture([first]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) {
        return success(releaseResponse([first, first], { draft: true, immutable: false }));
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /duplicate asset name/i,
  );
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
});

test('an incomplete published immutable carrier is read-only and cannot receive late assets', () => {
  const first = asset('first.zip', '6');
  const files = fixture([first]);
  const calls: string[][] = [];
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) return success(releaseResponse([]));
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  assert.throws(
    () => applyPublishPlan({
      ...mutationAdmission(),
      bundle: files.bundlePath,
      plan: files.planPath,
      'operation-deadline-at': deadlineAt,
    }, runtime),
    /asset set is incomplete/i,
  );
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 0);
  assert.equal(calls.filter((args) => args[0] === 'release' && args[1] === 'upload').length, 0);
});

test('immutable=true after accepted draft publication returns outcome_unknown', () => {
  const first = asset('first.zip', '7');
  const files = fixture([first]);
  const calls: string[][] = [];
  const remoteAssets: Asset[] = [];
  let tagReserved = false;
  let exists = false;
  let published = false;
  const runtime: GitHubAdapterRuntime = {
    now: () => deadlineMs - 60_000,
    run(_command, args) {
      calls.push(args);
      if (isReleaseInspect(args)) {
        if (!exists) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
        return success(releaseResponse(remoteAssets, {
          draft: !published,
          immutable: published,
        }));
      }
      if (isReleaseView(args)) return { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      if (isTagRefReadFor(args, tag, repo)) {
        return tagReserved
          ? tagRefResponse(tag)
          : { status: 1, stdout: '', stderr: 'HTTP 404 Not Found' };
      }
      if (isTagRefCreateFor(args, repo)) {
        tagReserved = true;
        return tagRefResponse(tag);
      }
      if (args[3] === `repos/${repo}/releases`) {
        exists = true;
        return success(releaseResponse([], { draft: true, immutable: false }));
      }
      if (args[0] === 'release' && args[1] === 'upload') {
        remoteAssets.push(first);
        return success();
      }
      if (args.includes('PATCH')) {
        published = true;
        return success();
      }
      throw new Error(`Unexpected GitHub call: ${args.join(' ')}`);
    },
  };

  const result = applyPublishPlan({
    ...mutationAdmission(),
    bundle: files.bundlePath,
    plan: files.planPath,
    'operation-deadline-at': deadlineAt,
  }, runtime);
  assert.equal(result.status, 'outcome_unknown');
  assert.equal(result.failure.failure_taxonomy, 'github_mutation_readback_unknown');
  assert.equal(result.failure.mutation, 'release_publish');
  assert.match(result.failure.reason, /unexpectedly reported immutable=true/);
  assert.equal(result.retry_disposition, 'read_only_reconcile_only');
  assert.deepEqual(result.uploaded, [first.name]);
  assert.equal(calls.filter((args) => args.includes('PATCH')).length, 1);
});
