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
  const prunePolicy = JSON.parse(
    fs.readFileSync(
      path.join(appRoot, "contracts/full-runtime-prune-policy.json"),
      "utf8",
    ),
  );

  assert.doesNotMatch(workflow, /actions\/setup-python@/);
  assert.match(
    workflow,
    /astral-sh\/setup-uv@1e862dfacbd1d6d858c55d9b792c756523627244[\s\S]*version: '0\.11\.29'[\s\S]*uv python install --managed-python "\$EXPECTED_PYTHON_VERSION"[\s\S]*python_executable="\$\(uv python find --managed-python "\$EXPECTED_PYTHON_VERSION"\)"[\s\S]*uv pip install --python "\$toolchain_root\/bin\/python" --no-deps "uv==\$EXPECTED_UV_VERSION"[\s\S]*OPL_FULL_PYTHON_BIN=\$python_executable/,
  );
  assert.equal(sourceManifest.toolchain.python.version, "3.12.12");
  assert.equal(sourceManifest.toolchain.python.source, "uv-managed CPython standalone release");
  assert.equal(sourceManifest.toolchain.uv.source, "PyPI exact-version distribution");
  const pythonRoot = `python/cpython-${sourceManifest.toolchain.python.version}-macos-aarch64-none/`;
  const pythonExamples = [
    ...prunePolicy.validation_examples.runtime_tree.excluded,
    ...prunePolicy.validation_examples.runtime_tree.retained,
  ].filter((entry: string) => entry.startsWith("python/cpython-"));
  assert.ok(pythonExamples.length > 0);
  assert.ok(pythonExamples.every((entry: string) => entry.startsWith(pythonRoot)));
});

test("Full domain dependency sync uses the frozen carrier Python", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/full-first-install-release.yml"),
    "utf8",
  );

  assert.match(
    workflow,
    /name: Prepare domain runtime dependencies[\s\S]*domain_python="\$OPL_FULL_PYTHON_BIN"[\s\S]*test -x "\$domain_python"[\s\S]*uv sync --project med-autoscience --python "\$domain_python" --no-dev[\s\S]*uv sync --project med-autogrant --python "\$domain_python" --no-dev/,
  );
  assert.doesNotMatch(workflow, /uv sync --project med-auto(?:science|grant) --no-dev/);
});

test("Full workflow delegates Codex to the Shell AionCore carrier without a Framework install", () => {
  const workflow = fs.readFileSync(
    path.join(appRoot, ".github/workflows/full-first-install-release.yml"),
    "utf8",
  );

  assert.doesNotMatch(workflow, /codex_tarball|codex_platform_tarball|OPL_FULL_CODEX_ROOT/);
  assert.doesNotMatch(workflow, /--codex-root|npm install -g "\$codex_tarball"/);
  assert.match(workflow, /working-directory: one-person-lab-app[\s\S]*npm run release:full --/);
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
