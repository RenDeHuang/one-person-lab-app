import {
  appRoot,
  assert,
  crypto,
  fs,
  os,
  path,
  spawnSync,
  test,
  writeFile,
} from './helpers.ts';
import {
  FULL_RUNTIME_CACHE_LAYER_IDS,
  FULL_RUNTIME_PRUNE_POLICY,
  buildFullRuntimePrunePolicyCacheHash,
} from '../../../scripts/full-first-install-package.ts';
import {
  FULL_RUNTIME_PACKAGE_IDS,
  resolveFrameworkPackageSetInput,
} from '../../../scripts/build-full-first-install-package/runtime-cache-package-set.ts';

function runGit(repoRoot: string, args: string[]) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function commitRepo(repoRoot: string, message: string) {
  runGit(repoRoot, ['add', '.']);
  runGit(repoRoot, ['commit', '-q', '-m', message]);
  return runGit(repoRoot, ['rev-parse', 'HEAD']);
}

function initializeRepo(repoRoot: string) {
  fs.mkdirSync(repoRoot, { recursive: true });
  runGit(repoRoot, ['init', '-q']);
  runGit(repoRoot, ['config', 'user.name', 'Runtime Cache Test']);
  runGit(repoRoot, ['config', 'user.email', 'runtime-cache-test@example.invalid']);
}

function fileDigest(filePath: string) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

test('Full runtime prune policy changes invalidate only affected cache layers', () => {
  const baseline = Object.fromEntries(FULL_RUNTIME_CACHE_LAYER_IDS.map((layerId) => [
    layerId,
    buildFullRuntimePrunePolicyCacheHash(layerId),
  ]));
  const domainPolicy = structuredClone(FULL_RUNTIME_PRUNE_POLICY);
  domainPolicy.runtime_tree.excluded_path_patterns.push('^modules/cache-fixture(?:/|$)');
  const domainChanged = Object.fromEntries(FULL_RUNTIME_CACHE_LAYER_IDS.map((layerId) => [
    layerId,
    buildFullRuntimePrunePolicyCacheHash(layerId, domainPolicy),
  ]));
  assert.notEqual(domainChanged['domain-runtime'], baseline['domain-runtime']);
  assert.equal(domainChanged.toolchain, baseline.toolchain);
  assert.equal(domainChanged['opl-runtime'], baseline['opl-runtime']);
  assert.equal(domainChanged.skills, baseline.skills);

  const oplPolicy = structuredClone(FULL_RUNTIME_PRUNE_POLICY);
  oplPolicy.production_node_modules.excluded_path_patterns.push('(?:^|/)fixture(?:/|$)');
  assert.notEqual(
    buildFullRuntimePrunePolicyCacheHash('opl-runtime', oplPolicy),
    baseline['opl-runtime'],
  );
  for (const layerId of ['toolchain', 'domain-runtime', 'skills'] as const) {
    assert.equal(buildFullRuntimePrunePolicyCacheHash(layerId, oplPolicy), baseline[layerId]);
  }

  const unknownPolicy = structuredClone(FULL_RUNTIME_PRUNE_POLICY);
  unknownPolicy.runtime_tree.excluded_path_patterns.push('^future-layer/cache(?:/|$)');
  for (const layerId of FULL_RUNTIME_CACHE_LAYER_IDS) {
    assert.notEqual(buildFullRuntimePrunePolicyCacheHash(layerId, unknownPolicy), baseline[layerId]);
  }
});

test('Framework package set rejects owner checkout and manifest byte drift', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-runtime-package-set-'));
  const frameworkRoot = path.join(tempRoot, 'one-person-lab');
  const sourceRoots: Record<string, string> = {};
  const sourceCommits: Record<string, string> = {};
  try {
    for (const packageId of FULL_RUNTIME_PACKAGE_IDS) {
      const sourceRoot = path.join(tempRoot, packageId);
      initializeRepo(sourceRoot);
      writeFile(path.join(sourceRoot, 'payload.txt'), `${packageId}\n`);
      sourceRoots[packageId] = sourceRoot;
      sourceCommits[packageId] = commitRepo(sourceRoot, `fixture ${packageId}`);
    }

    initializeRepo(frameworkRoot);
    const catalogRoot = path.join(frameworkRoot, 'contracts', 'opl-framework');
    const packages = Object.fromEntries(FULL_RUNTIME_PACKAGE_IDS.map((packageId) => {
      const manifestRef = `packages/${packageId}.json`;
      const payloadManifestRef = `packages/payloads/${packageId}-1.0.0.json`;
      const manifestPath = path.join(catalogRoot, ...manifestRef.split('/'));
      const payloadManifestPath = path.join(catalogRoot, ...payloadManifestRef.split('/'));
      writeFile(manifestPath, `${JSON.stringify({ package_id: packageId })}\n`);
      writeFile(payloadManifestPath, `${JSON.stringify({ package_id: packageId, files: [] })}\n`);
      return [packageId, {
        package_id: packageId,
        package_role: packageId === 'opl-flow' ? 'workflow_profile' : 'standard_agent',
        package_version: '1.0.0',
        owner_source_commit: sourceCommits[packageId],
        runtime_module_relative_path: `modules/${packageId}`,
        manifest_ref: manifestRef,
        manifest_sha256: fileDigest(manifestPath),
        payload_manifest_ref: payloadManifestRef,
        payload_manifest_sha256: fileDigest(payloadManifestPath),
      }];
    }));
    writeFile(
      path.join(catalogRoot, 'bundled-full-runtime-package-catalog.json'),
      `${JSON.stringify({
        surface_kind: 'opl_bundled_full_runtime_package_catalog.v1',
        packages,
      }, null, 2)}\n`,
    );
    const frameworkSha = commitRepo(frameworkRoot, 'fixture framework catalog');
    const options = {
      frameworkRoot,
      masRoot: sourceRoots.mas,
      magRoot: sourceRoots.mag,
      rcaRoot: sourceRoots.rca,
      metaAgentRoot: sourceRoots.oma,
      bookforgeRoot: sourceRoots.obf,
      masScholarSkillsRoot: sourceRoots['mas-scholar-skills'],
      oplFlowRoot: sourceRoots['opl-flow'],
    };

    const packageSet = resolveFrameworkPackageSetInput(options);
    assert.equal(packageSet.framework_sha, frameworkSha);
    assert.deepEqual(
      packageSet.packages.map((entry) => entry.package_id),
      FULL_RUNTIME_PACKAGE_IDS,
    );

    writeFile(
      path.join(catalogRoot, 'packages', 'mas.json'),
      `${JSON.stringify({ package_id: 'mas', drifted: true })}\n`,
    );
    assert.throws(
      () => resolveFrameworkPackageSetInput(options),
      /manifest or payload digest does not match catalog bytes/,
    );

    writeFile(
      path.join(catalogRoot, 'packages', 'mas.json'),
      `${JSON.stringify({ package_id: 'mas' })}\n`,
    );
    writeFile(path.join(sourceRoots.mag, 'owner-drift.txt'), 'owner drift\n');
    commitRepo(sourceRoots.mag, 'owner drift');
    assert.throws(
      () => resolveFrameworkPackageSetInput(options),
      /mag owner source does not match the frozen checkout/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('App release contract declares the v2 Full runtime cache layout', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const runtimeCache = releaseContract.release_acceleration.full_runtime_cache;
  for (const layerId of FULL_RUNTIME_CACHE_LAYER_IDS) {
    assert.match(runtimeCache.restore_prefixes[layerId], /full-runtime-v2-/);
  }
});
