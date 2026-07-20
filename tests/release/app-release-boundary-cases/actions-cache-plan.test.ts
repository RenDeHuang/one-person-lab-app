import crypto from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { appRoot, assert, fs, path, test } from './helpers.ts';
import {
  buildActionsCachePlan,
  buildActionsCacheReceipt,
  validateActionsCachePlan,
} from '../../../scripts/write-actions-cache-plan.ts';

const runtimeKeys = {
  toolchain: `full-runtime-v1-toolchain-${'a'.repeat(24)}`,
  'domain-runtime': `full-runtime-v1-domain-runtime-${'b'.repeat(24)}`,
  'opl-runtime': `full-runtime-v1-opl-runtime-${'c'.repeat(24)}`,
  skills: `full-runtime-v1-skills-${'d'.repeat(24)}`,
};

test('Actions cache plan binds exact cohort and canonical runtime layer keys', () => {
  const plan = buildActionsCachePlan({
    mode: 'cache_only_warmup',
    workflow: 'full-runtime-cache-warmup.yml',
    ref: 'refs/heads/main',
    appSha: 'a'.repeat(40),
    shellSha: 'b'.repeat(40),
    frameworkSha: 'c'.repeat(40),
    runnerOs: 'macOS',
    runnerArch: 'ARM64',
    catalogSha256: 'd'.repeat(64),
    runtimeKeyReport: {
      aggregate_key_input: { schema: 'opl_full_runtime_cache_aggregate_key.v1' },
      layers: runtimeKeys,
    },
  });

  validateActionsCachePlan(plan);
  assert.equal(plan.writer_eligible, true);
  assert.deepEqual(plan.runner, { os: 'macOS', arch: 'ARM64' });
  assert.equal(plan.runtime_layers.length, 4);
  assert.equal(
    plan.runtime_layers[0].actions_key,
    `opl-full-runtime-layer-macOS-ARM64-${runtimeKeys.toolchain}`,
  );
  assert.match(plan.identity, /^sha256:[0-9a-f]{64}$/);
});

test('Actions cache receipt rejects layer drift and records save outcomes', () => {
  const plan = buildActionsCachePlan({
    mode: 'full_package',
    workflow: 'full-first-install-release.yml',
    ref: 'refs/heads/main',
    appSha: '1'.repeat(40),
    shellSha: '2'.repeat(40),
    frameworkSha: '3'.repeat(40),
    runnerOs: 'macOS',
    runnerArch: 'ARM64',
    catalogSha256: '4'.repeat(64),
    runtimeKeyReport: { layers: runtimeKeys },
  });
  const events = {
    events: Object.entries(runtimeKeys).map(([layerId, key]) => ({
      layer_id: layerId,
      key,
      status: 'miss_written',
      duration_seconds: 1,
      read_archive: false,
      write_archive: true,
    })),
  };
  const receipt = buildActionsCacheReceipt({
    plan,
    runtimeEvents: events,
    saveOutcomes: {
      toolchain: 'success',
      'domain-runtime': 'failure',
      'opl-runtime': 'success',
      skills: 'success',
    },
  });

  assert.equal(receipt.plan_identity, plan.identity);
  assert.equal(receipt.runtime_layer_events.length, 4);
  assert.equal(receipt.save_outcomes.toolchain, 'success');
  assert.equal(receipt.save_outcomes['domain-runtime'], 'failure');

  const driftedEvents = structuredClone(events);
  driftedEvents.events[0].key = 'full-runtime-v1-toolchain-drifted';
  assert.throws(
    () => buildActionsCacheReceipt({
      plan,
      runtimeEvents: driftedEvents,
      saveOutcomes: {
        toolchain: 'success',
        'domain-runtime': 'success',
        'opl-runtime': 'success',
        skills: 'success',
      },
    }),
    /does not match the cache plan/,
  );

  assert.throws(
    () => buildActionsCacheReceipt({ plan, runtimeEvents: events, saveOutcomes: {} as never }),
    /save outcome for toolchain/,
  );

  const hitEvents = structuredClone(events);
  hitEvents.events[0] = {
    ...hitEvents.events[0],
    status: 'hit',
    read_archive: true,
    write_archive: false,
  };
  assert.throws(
    () => buildActionsCacheReceipt({
      plan,
      runtimeEvents: hitEvents,
      saveOutcomes: {
        toolchain: 'success',
        'domain-runtime': 'success',
        'opl-runtime': 'success',
        skills: 'success',
      },
    }),
    /must be skipped after an exact cache hit/,
  );
});

test('Actions cache plan validation rejects writer and exact-cohort drift', () => {
  assert.throws(
    () => buildActionsCachePlan({
      mode: 'cache_only_warmup',
      workflow: 'full-runtime-cache-warmup.yml',
      ref: 'refs/heads/feature/cache-test',
      appSha: '5'.repeat(40),
      shellSha: '6'.repeat(40),
      frameworkSha: '7'.repeat(40),
      runnerOs: 'macOS',
      runnerArch: 'ARM64',
      catalogSha256: '8'.repeat(64),
      runtimeKeyReport: { layers: runtimeKeys },
    }),
    /cache-only warmup plans must use refs\/heads\/main/,
  );

  const plan = buildActionsCachePlan({
    mode: 'full_package',
    workflow: 'full-first-install-release.yml',
    ref: 'refs/heads/feature/cache-test',
    appSha: '5'.repeat(40),
    shellSha: '6'.repeat(40),
    frameworkSha: '7'.repeat(40),
    runnerOs: 'macOS',
    runnerArch: 'ARM64',
    catalogSha256: '8'.repeat(64),
    runtimeKeyReport: { layers: runtimeKeys },
  });
  assert.equal(plan.writer_eligible, false);

  const drifted = structuredClone(plan);
  drifted.writer_eligible = true;
  const { identity: _identity, ...payload } = drifted;
  drifted.identity = `sha256:${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
  assert.throws(() => validateActionsCachePlan(drifted), /writer eligibility/);

  const runnerDrifted = structuredClone(plan);
  runnerDrifted.runner.arch = 'X64';
  const { identity: _runnerIdentity, ...runnerPayload } = runnerDrifted;
  runnerDrifted.identity = `sha256:${crypto.createHash('sha256').update(JSON.stringify(runnerPayload)).digest('hex')}`;
  assert.throws(() => validateActionsCachePlan(runnerDrifted), /runtime layer toolchain is invalid/);
});

test('Full cache-only workflow freezes exact refs and cannot emit release assets', () => {
  const fullPath = path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml');
  const warmupPath = path.join(appRoot, '.github', 'workflows', 'full-runtime-cache-warmup.yml');
  const fullText = fs.readFileSync(fullPath, 'utf8');
  const warmupText = fs.readFileSync(warmupPath, 'utf8');
  const full = parseYaml(fullText) as Record<string, any>;
  const warmup = parseYaml(warmupText) as Record<string, any>;
  const fullSteps = full.jobs['full-first-install'].steps as Array<Record<string, any>>;
  const fullStep = (name: string) => fullSteps.find((step) => step.name === name);

  assert.equal(full.on.workflow_call.inputs.cache_only.default, false);
  assert.match(String(fullStep('Enforce cache-only warmup boundary')?.if), /inputs\.cache_only/);
  assert.match(String(fullStep('Build Full first-install package')?.run), /--warm-runtime-cache-only/);
  assert.equal(
    fullStep('Restore Bun install cache')?.with?.key,
    "bun-install-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('one-person-lab-app/shells/aionui/package.json', 'one-person-lab-app/shells/aionui/bun.lock') }}",
  );
  for (const name of [
    'Restore Full toolchain runtime cache',
    'Restore Full domain runtime cache',
    'Restore Full OPL runtime cache',
    'Restore Full skills runtime cache',
    'Save Full toolchain runtime cache',
    'Save Full domain runtime cache',
    'Save Full OPL runtime cache',
    'Save Full skills runtime cache',
  ]) {
    assert.equal(fullStep(name)?.env?.OPL_ACTIONS_CACHE_CLASS, 'full_runtime_layer', name);
  }
  assert.equal(
    fullStep('Restore Electron artifacts cache')?.with?.key,
    "electron-cache-macos-arm64-arm64-${{ hashFiles('one-person-lab-app/shells/aionui/package.json', 'one-person-lab-app/shells/aionui/bun.lock') }}",
  );
  assert.ok(
    fullSteps.indexOf(fullStep('Write exact-cohort Actions cache plan')!) <
      fullSteps.indexOf(fullStep('Restore Full toolchain runtime cache')!),
  );
  for (const name of [
    'Install App shell dependencies',
    'Verify Full package checksums and optional signing',
    'Upload Full DMG-only workflow artifact',
  ]) {
    assert.match(String(fullStep(name)?.if), /!inputs\.cache_only/, name);
  }

  const resolver = warmup.jobs['resolve-version'];
  assert.equal(warmup.jobs.warmup.with.cache_only, true);
  assert.equal(warmup.jobs.warmup.secrets, undefined);
  assert.equal(warmup.jobs.warmup.with.framework_ref, '${{ needs.resolve-version.outputs.framework_sha }}');
  assert.equal(warmup.jobs.warmup.with.shell_ref, '${{ needs.resolve-version.outputs.shell_sha }}');
  assert.equal(warmup.jobs.warmup.with.artifact_app_sha, '${{ needs.resolve-version.outputs.app_sha }}');
  assert.match(
    String((resolver.steps as Array<Record<string, any>>).find((step) => step.name === 'Require canonical main writer')?.run),
    /refs\/heads\/main/,
  );
  assert.doesNotMatch(warmupText, /BUILD_CERTIFICATE_BASE64|APPLE_ID_PASSWORD|IDENTITY:/);
});

test('Full cache-only builder returns before payload sync and DMG construction', () => {
  const source = fs.readFileSync(
    path.join(appRoot, 'scripts', 'build-full-first-install-package.ts'),
    'utf8',
  );
  const cacheOnlyBranch = source.indexOf('if (options.warmRuntimeCacheOnly)');
  const payloadSync = source.indexOf('syncRuntimePayloadToBuildRoots(');
  assert.ok(cacheOnlyBranch >= 0 && payloadSync > cacheOnlyBranch);
  assert.match(source.slice(cacheOnlyBranch, payloadSync), /fs\.rmSync\(prepared\.stagingRoot/);
  assert.match(source.slice(cacheOnlyBranch, payloadSync), /status: 'runtime_cache_warmed'/);
});
