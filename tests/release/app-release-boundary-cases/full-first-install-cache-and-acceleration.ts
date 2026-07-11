import {
  appRoot,
  assert,
  fs,
  os,
  path,
  test,
} from './helpers.ts';

test('Full domain build links the pinned local Framework package into RedCube', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/full-first-install-release.yml'), 'utf8');
  assert.match(
    workflow,
    /npm install --prefix redcube-ai --no-save --package-lock=false "\$GITHUB_WORKSPACE\/one-person-lab"\s+npm run --prefix redcube-ai build/,
  );
});

test('Full runtime cache classifies hit and miss modes from one canonical key', async () => {
  const mod = await import('../../../scripts/full-first-install-package.ts');
  const cacheDir = path.join(os.tmpdir(), 'opl-full-runtime-cache-test');
  const key = mod.buildFullRuntimeCacheKey({
    layerId: 'opl-runtime',
    parts: {
      opl_commit: '1'.repeat(40),
      package_lock_sha256: '2'.repeat(64),
    },
  });

  for (const scenario of [
    {
      mode: 'readwrite',
      archiveExists: false,
      expected: ['miss_written', false, true, true],
    },
    {
      mode: 'readwrite',
      archiveExists: true,
      expected: ['hit', true, false, false],
    },
    {
      mode: 'readonly',
      archiveExists: false,
      expected: ['miss_readonly', false, false, true],
    },
    {
      mode: 'off',
      archiveExists: true,
      expected: ['disabled', false, false, true],
    },
  ] as const) {
    const result = mod.classifyFullRuntimeLayerCache({
      ...scenario,
      cacheDir,
      layerId: 'opl-runtime',
      key,
    });
    assert.deepEqual(
      [result.status, result.read_archive, result.write_archive, result.build_layer],
      scenario.expected,
      scenario.mode,
    );
  }

  const layers = Object.fromEntries(
    mod.FULL_RUNTIME_CACHE_LAYER_IDS.map((id) => [id, `full-runtime-v1-${id}-test`]),
  );
  const aggregate = mod.buildFullRuntimeAggregateCacheKeyInput({ layers });
  assert.equal(aggregate.schema, 'opl_full_runtime_cache_aggregate_key.v1');
  assert.deepEqual(aggregate.layer_ids, mod.FULL_RUNTIME_CACHE_LAYER_IDS);
  assert.deepEqual(aggregate.layers, layers);
  assert.deepEqual(
    aggregate.opl_runtime_bundle_consumer,
    mod.buildFullPackageManifest().opl_runtime_bundle_consumer,
  );
});
