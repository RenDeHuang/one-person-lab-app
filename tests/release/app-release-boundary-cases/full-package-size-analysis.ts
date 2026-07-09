import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  runNode,
  writeFile,
} from './helpers.ts';

test('Full package size analyzer reports manifest component and layer budgets', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-size-analysis-'));
  const manifestPath = path.join(tempRoot, 'full-package-manifest.json');
  writeFile(
    manifestPath,
    JSON.stringify({
      manifest_version: 2,
      version: '26.5.27-size',
      package_kind: 'opl_full_first_install_macos_arm64',
      opl_runtime_bundle_consumer: {
        schema: 'opl_runtime_bundle_manifest_consumer.v1',
        app_repo_role: 'consumer_only',
        truth_owner: 'gaofeng21cn/one-person-lab',
        dependency_truth_owner: false,
        consumed_refs: {
          bundle_manifest: 'OPL runtime bundle manifest',
          bundle_lock: 'OPL runtime bundle lock',
          bundle_readback: 'OPL runtime env contract/readback',
          env_contract: 'OPL runtime env contract',
        },
        false_ready_flags: {
          cache_hit_is_release_ready: false,
          manifest_present_is_release_ready: false,
          lock_present_is_release_ready: false,
          full_package_built_is_release_ready: false,
          full_package_built_is_family_production_ready: false,
          app_can_claim_runtime_dependency_truth: false,
        },
        layer_taxonomy: {
          canonical_layer_ids: [
            'base-toolchain',
            'python-wheelhouse',
            'opl-framework-runtime',
            'domain-pack',
            'companion-skills',
            'optional-heavy-tools',
          ],
          legacy_assembly_layer_mapping: {
            toolchain: ['base-toolchain', 'python-wheelhouse', 'optional-heavy-tools'],
            'domain-runtime': ['domain-pack'],
            'opl-runtime': ['opl-framework-runtime'],
            skills: ['companion-skills'],
          },
        },
      },
      size_budget: {
        platform_scope: 'macos-arm64',
        warning_full_dmg_bytes: 700000000,
        max_full_dmg_bytes: 750000000,
        max_runtime_uncompressed_bytes: 1000,
      },
      size_breakdown: {
        opl_layer_taxonomy: {
          canonical_layer_ids: [
            'base-toolchain',
            'python-wheelhouse',
            'opl-framework-runtime',
            'domain-pack',
            'companion-skills',
            'optional-heavy-tools',
          ],
          legacy_assembly_layer_mapping: {
            toolchain: ['base-toolchain', 'python-wheelhouse', 'optional-heavy-tools'],
            'domain-runtime': ['domain-pack'],
            'opl-runtime': ['opl-framework-runtime'],
            skills: ['companion-skills'],
          },
        },
        total_runtime_uncompressed_bytes: 500,
        layers: {
          toolchain: {
            size_bytes: 200,
            children: {
              vendor: {
                size_bytes: 150,
                children: {
                  temporal: { size_bytes: 150 },
                },
              },
            },
          },
          'domain-runtime': { size_bytes: 180 },
          'opl-runtime': { size_bytes: 100 },
          skills: { size_bytes: 20 },
        },
      },
      components: {
        mas: { size_bytes: 180, git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        codex: { size_bytes: 120, version: 'codex-cli 0.130.0' },
        opl: { size_bytes: 100, git_commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      },
    }, null, 2),
  );

  const jsonResult = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
  ]);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const summary = JSON.parse(jsonResult.stdout);
  assert.equal(summary.schema, 'opl_full_package_size_summary.v1');
  assert.equal(summary.version, '26.5.27-size');
  assert.equal(summary.budget.compressed_full_dmg.measurement_source, 'not_provided');
  assert.equal(summary.budget.compressed_full_dmg.release_blocking, false);
  assert.equal(summary.budget.compressed_full_dmg.status, 'unavailable');
  assert.equal(summary.budget.compressed_full_dmg.hard_limit_status, 'unavailable');
  assert.equal(summary.budget.runtime_uncompressed.status, 'passed');
  assert.equal(summary.budget.runtime_uncompressed.release_blocking, true);
  assert.equal(summary.warning_full_dmg_bytes, 700000000);
  assert.equal(summary.review_full_dmg_bytes, 750000000);
  assert.equal(summary.max_full_dmg_bytes, 750000000);
  assert.equal(summary.hard_full_dmg_bytes, null);
  assert.equal(summary.runtime_budget_used_percent, 50);
  assert.equal(summary.components[0].id, 'mas');
  assert.equal(summary.layers[0].id, 'toolchain');
  assert.equal(summary.opl_runtime_bundle_consumer.app_repo_role, 'consumer_only');
  assert.deepEqual(summary.opl_layer_taxonomy.canonical_layer_ids, [
    'base-toolchain',
    'python-wheelhouse',
    'opl-framework-runtime',
    'domain-pack',
    'companion-skills',
    'optional-heavy-tools',
  ]);
  assert.deepEqual(summary.opl_layer_taxonomy.legacy_assembly_layer_mapping.toolchain, [
    'base-toolchain',
    'python-wheelhouse',
    'optional-heavy-tools',
  ]);
  assert.equal(summary.top_contributors.components[0].id, 'mas');
  assert.equal(summary.top_contributors.layers[0].id, 'toolchain');
  assert.equal(summary.optimization_candidates[0].id, 'toolchain');
  assert.equal(summary.manifest_size_hotspots[2].path, 'toolchain/vendor');
  assert.equal(summary.manifest_size_hotspots[3].path, 'toolchain/vendor/temporal');

});

test('Full package size analyzer separates review threshold from hard limit', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-size-gate-'));
  const manifestPath = path.join(tempRoot, 'full-package-manifest.json');
  const manifest = {
    manifest_version: 2,
    version: '26.6.21-size-gate',
    package_kind: 'opl_full_first_install_macos_arm64',
    size_budget: {
      platform_scope: 'macos-arm64',
      warning_full_dmg_bytes: 700000000,
      max_full_dmg_bytes: 750000000,
      max_runtime_uncompressed_bytes: 1000000000,
    },
    size_breakdown: {
      total_runtime_uncompressed_bytes: 734713404,
      layers: {
        toolchain: { size_bytes: 539534131 },
        'domain-runtime': { size_bytes: 85679162 },
        'opl-runtime': { size_bytes: 105774657 },
        skills: { size_bytes: 3699940 },
      },
    },
    components: {
      node: { size_bytes: 132662000, version: 'v24.16.0' },
      opl: { size_bytes: 105774657, git_commit: 'b830b82b701e7fab49e2673a5184c2ffe2a3e7a5' },
    },
  };
  writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  const reviewResult = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
    '--full-dmg-size-bytes',
    '844079932',
  ]);
  assert.equal(reviewResult.status, 0, reviewResult.stderr);
  const reviewSummary = JSON.parse(reviewResult.stdout);
  assert.equal(reviewSummary.budget.status, 'requires_review');
  assert.equal(reviewSummary.budget.compressed_full_dmg.status, 'requires_review');
  assert.equal(reviewSummary.budget.compressed_full_dmg.warning_status, 'warning');
  assert.equal(reviewSummary.budget.compressed_full_dmg.review_threshold_status, 'above_review_threshold');
  assert.equal(reviewSummary.budget.compressed_full_dmg.hard_limit_status, 'unavailable');
  assert.equal(reviewSummary.budget.compressed_full_dmg.review_required, true);
  assert.equal(reviewSummary.budget.compressed_full_dmg.release_blocking, false);

  manifest.size_budget.hard_full_dmg_bytes = 800000000;
  writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const hardLimitResult = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
    '--full-dmg-size-bytes',
    '844079932',
  ]);
  assert.equal(hardLimitResult.status, 0, hardLimitResult.stderr);
  const hardLimitSummary = JSON.parse(hardLimitResult.stdout);
  assert.equal(hardLimitSummary.budget.status, 'failed');
  assert.equal(hardLimitSummary.budget.compressed_full_dmg.status, 'failed');
  assert.equal(hardLimitSummary.budget.compressed_full_dmg.hard_limit_status, 'failed');
  assert.equal(hardLimitSummary.budget.compressed_full_dmg.release_blocking, true);
});
