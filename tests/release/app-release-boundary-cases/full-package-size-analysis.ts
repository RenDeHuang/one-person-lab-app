import {
  assert,
  fs,
  os,
  path,
  test,
  runNode,
  writeFile,
} from './helpers.ts';
import { buildFullPackageManifest } from '../../../scripts/full-first-install-package.ts';

function analyzeManifest(manifest: Record<string, any>, args: string[] = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-size-analysis-'));
  const manifestPath = path.join(root, 'full-package-manifest.json');
  writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const result = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
    ...args,
  ]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function sizeManifest(version: string, totalRuntimeBytes: number) {
  const manifest = buildFullPackageManifest({
    version,
    sizeBreakdown: {
      total_runtime_uncompressed_bytes: totalRuntimeBytes,
      layers: {
        toolchain: {
          size_bytes: 200,
          children: { vendor: { size_bytes: 150, children: { temporal: { size_bytes: 150 } } } },
        },
        'domain-runtime': { size_bytes: 180 },
        'opl-runtime': { size_bytes: 100 },
        skills: { size_bytes: 20 },
      },
    },
    components: {
      mas: { size_bytes: 180, git_commit: 'a'.repeat(40) },
      codex: { size_bytes: 120, version: 'codex-cli 0.130.0' },
      opl: { size_bytes: 100, git_commit: 'b'.repeat(40) },
    },
  });
  manifest.size_budget = {
    ...manifest.size_budget,
    max_runtime_uncompressed_bytes: 1000,
  };
  return manifest;
}

test('Full package size analyzer reports component, layer, and runtime budgets', () => {
  const manifest = sizeManifest('26.5.27-size', 500);
  const summary = analyzeManifest(manifest);

  assert.equal(summary.schema, 'opl_full_package_size_summary.v1');
  assert.equal(summary.version, manifest.version);
  assert.equal(summary.budget.compressed_full_dmg.status, 'unavailable');
  assert.equal(summary.budget.compressed_full_dmg.release_blocking, false);
  assert.equal(summary.budget.runtime_uncompressed.status, 'passed');
  assert.equal(summary.budget.runtime_uncompressed.release_blocking, true);
  assert.equal(summary.runtime_budget_used_percent, 50);
  assert.equal(summary.components[0].id, 'mas');
  assert.equal(summary.layers[0].id, 'toolchain');
  assert.deepEqual(
    summary.opl_layer_taxonomy,
    manifest.opl_runtime_bundle_consumer.layer_taxonomy,
  );
  assert.equal(summary.top_contributors.components[0].id, 'mas');
  assert.equal(summary.top_contributors.layers[0].id, 'toolchain');
  assert.equal(summary.optimization_candidates[0].id, 'toolchain');
  assert.equal(summary.manifest_size_hotspots[3].path, 'toolchain/vendor/temporal');
});

test('Full package size analyzer separates review threshold from hard limit', () => {
  const manifest = sizeManifest('26.6.21-size-gate', 734713404);
  manifest.size_budget.max_runtime_uncompressed_bytes = 1000000000;
  const args = ['--full-dmg-size-bytes', '844079932'];

  const review = analyzeManifest(manifest, args);
  assert.equal(review.budget.status, 'requires_review');
  assert.equal(review.budget.compressed_full_dmg.review_threshold_status, 'above_review_threshold');
  assert.equal(review.budget.compressed_full_dmg.hard_limit_status, 'unavailable');
  assert.equal(review.budget.compressed_full_dmg.release_blocking, false);

  manifest.size_budget.hard_full_dmg_bytes = 800000000;
  const blocked = analyzeManifest(manifest, args);
  assert.equal(blocked.budget.status, 'failed');
  assert.equal(blocked.budget.compressed_full_dmg.hard_limit_status, 'failed');
  assert.equal(blocked.budget.compressed_full_dmg.release_blocking, true);
});
