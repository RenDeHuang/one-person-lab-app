import { appRoot, assert, fs, os, path, test } from "./helpers.ts";

test("Full domain build links the pinned local Framework package into RedCube", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/full-first-install-release.yml"),
    "utf8",
  );
  assert.match(
    workflow,
    /npm install --prefix redcube-ai --no-save --package-lock=false "\$GITHUB_WORKSPACE\/one-person-lab"\s+npm run --prefix redcube-ai build/,
  );
});

test("Full workflow may select OPL Flow without a fixed Framework package catalog", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/full-first-install-release.yml"),
    "utf8",
  );
  assert.doesNotMatch(workflow, /bundled-full-runtime-package-catalog\.json/);
  assert.match(
    workflow,
    /name: Resolve default Full build inputs[\s\S]*name: Checkout OPL Flow[\s\S]*repository: gaofeng21cn\/opl-flow[\s\S]*ref: main[\s\S]*path: opl-flow/,
  );
  assert.match(
    workflow,
    /name: Validate Full source roots[\s\S]*opl-flow\/\.codex-plugin\/plugin\.json/,
  );
  assert.match(
    workflow,
    /OPL_FULL_OPL_FLOW_REF=\$\(git -C opl-flow rev-parse HEAD\)/,
  );
  assert.equal(
    workflow.match(/export OPL_FULL_OPL_FLOW_ROOT="\$GITHUB_WORKSPACE\/opl-flow"/g)?.length,
    2,
  );
});

test("Full workflow checks out MAS Scholar Skills and binds both runtime assembly passes", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/full-first-install-release.yml"),
    "utf8",
  );
  assert.doesNotMatch(workflow, /bundled-full-runtime-package-catalog\.json/);
  assert.match(
    workflow,
    /name: Checkout MAS Scholar Skills[\s\S]*repository: gaofeng21cn\/mas-scholar-skills[\s\S]*ref: main[\s\S]*path: mas-scholar-skills/,
  );
  assert.match(
    workflow,
    /OPL_FULL_MAS_SCHOLAR_SKILLS_REF=\$\(git -C mas-scholar-skills rev-parse HEAD\)/,
  );
  assert.match(
    workflow,
    /name: Validate Full source roots[\s\S]*mas-scholar-skills\/\.codex-plugin\/plugin\.json[\s\S]*mas-scholar-skills\/contracts\/opl_capability_package_manifest\.json/,
  );
  assert.equal(
    workflow.match(/export OPL_FULL_MAS_SCHOLAR_SKILLS_ROOT="\$GITHUB_WORKSPACE\/mas-scholar-skills"/g)?.length,
    2,
  );
  assert.match(
    workflow,
    /assert-full-runtime-currentness\.ts[\s\S]*--mas-scholar-skills-root "\$GITHUB_WORKSPACE\/mas-scholar-skills"/,
  );
});

test("Full workflow provisions the frozen Python through uv on macOS arm64", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/full-first-install-release.yml"),
    "utf8",
  );
  const sourceManifest = JSON.parse(
    fs.readFileSync(
      path.join(appRoot, "contracts/app-full-third-party-source-manifest.json"),
      "utf8",
    ),
  );

  assert.doesNotMatch(workflow, /actions\/setup-python@/);
  assert.match(
    workflow,
    /astral-sh\/setup-uv@1e862dfacbd1d6d858c55d9b792c756523627244[\s\S]*version: '0\.11\.29'[\s\S]*uv python install --managed-python "\$EXPECTED_PYTHON_VERSION"[\s\S]*uv python find --managed-python "\$EXPECTED_PYTHON_VERSION"[\s\S]*uv pip install --python "\$toolchain_root\/bin\/python" --no-deps "uv==\$EXPECTED_UV_VERSION"/,
  );
  assert.equal(sourceManifest.toolchain.python.source, "uv-managed CPython standalone release");
  assert.equal(sourceManifest.toolchain.uv.source, "PyPI exact-version distribution");
});

test("Full runtime cache classifies hit and miss modes from one canonical key", async () => {
  const mod = await import("../../../scripts/full-first-install-package.ts");
  const cacheDir = path.join(os.tmpdir(), "opl-full-runtime-cache-test");
  const key = mod.buildFullRuntimeCacheKey({
    layerId: "opl-runtime",
    parts: {
      opl_commit: "1".repeat(40),
      package_lock_sha256: "2".repeat(64),
    },
  });

  for (const scenario of [
    {
      mode: "readwrite",
      archiveExists: false,
      expected: ["miss_written", false, true, true],
    },
    {
      mode: "readwrite",
      archiveExists: true,
      expected: ["hit", true, false, false],
    },
    {
      mode: "readonly",
      archiveExists: false,
      expected: ["miss_readonly", false, false, true],
    },
    {
      mode: "off",
      archiveExists: true,
      expected: ["disabled", false, false, true],
    },
  ] as const) {
    const result = mod.classifyFullRuntimeLayerCache({
      ...scenario,
      cacheDir,
      layerId: "opl-runtime",
      key,
    });
    assert.deepEqual(
      [result.status, result.read_archive, result.write_archive, result.build_layer],
      scenario.expected,
      scenario.mode,
    );
  }

  const layers = Object.fromEntries(
    mod.FULL_RUNTIME_CACHE_LAYER_IDS.map((id) => [id, `full-runtime-v2-${id}-test`]),
  );
  const aggregate = mod.buildFullRuntimeAggregateCacheKeyInput({ layers });
  assert.equal(aggregate.schema, "opl_full_runtime_cache_aggregate_key.v1");
  assert.deepEqual(aggregate.layer_ids, mod.FULL_RUNTIME_CACHE_LAYER_IDS);
  assert.deepEqual(aggregate.layers, layers);
  assert.deepEqual(
    aggregate.opl_runtime_bundle_consumer,
    mod.buildFullPackageManifest().opl_runtime_bundle_consumer,
  );
});
