import { appRoot, assert, fs, os, path, test } from './helpers.ts';
import { parse as parseYaml } from 'yaml';
import {
  collectActionsCachePolicyViolations,
} from '../../../scripts/validate-release-boundary/actions-cache-policy.ts';

function policyFixture(workflow: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-actions-cache-policy-'));
  const workflowDirectory = path.join(root, '.github', 'workflows');
  fs.mkdirSync(workflowDirectory, { recursive: true });
  fs.writeFileSync(path.join(workflowDirectory, 'fixture.yml'), workflow, 'utf8');
  return root;
}

test('repository Actions caches satisfy the reusable cache policy', () => {
  assert.deepEqual(collectActionsCachePolicyViolations(appRoot), []);
});

test('first-run Codex install seed uses full content identity and main-only miss saves', () => {
  const workflowPath = path.join(appRoot, '.github', 'workflows', 'opl-first-run-vm.yml');
  const workflowText = fs.readFileSync(workflowPath, 'utf8');
  const workflow = parseYaml(workflowText) as Record<string, any>;
  const steps = workflow.jobs['clean-vm-first-run'].steps as Array<Record<string, any>>;
  const saveStep = steps.find((step) => step.name === 'Save Codex install asset cache');

  assert.match(
    workflowText,
    /`\$\{cacheKeyPrefix\}-\$\{version\}-\$\{tarballSha256\}-\$\{platformTarballSha256\}`/,
  );
  assert.doesNotMatch(
    workflowText,
    /cacheKey\s*=\s*[^;]{0,1024}(?:GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT)/,
  );
  assert.match(workflowText, /cacheSaveRequired = Boolean\(cacheKey && restoredCacheKey !== cacheKey\)/);
  assert.match(workflowText, /`cache_save_required=\$\{cacheSaveRequired\}`/);
  assert.equal(
    saveStep?.if,
    "${{ needs.validate-vm-inputs.outputs.diagnostic_scope != 'bootstrap_only' && github.ref == 'refs/heads/main' && steps.codex_package_preflight.outputs.cache_save_required == 'true' }}",
  );
  assert.equal(saveStep?.with?.key, '${{ steps.codex_package_preflight.outputs.cache_key }}');
});

test('Actions cache policy rejects volatile identities in direct and generated keys', () => {
  const directRoot = policyFixture(`
jobs:
  cache:
    steps:
      - uses: actions/cache@0123456789012345678901234567890123456789
        with:
          path: cache
          key: dependency-\${{ github.run_id }}
`);
  assert.match(
    collectActionsCachePolicyViolations(directRoot).join('\n'),
    /reusable cache key contains volatile run identity/,
  );

  const generatedRoot = policyFixture(`
jobs:
  cache:
    steps:
      - id: resolve
        run: |
          const cacheKey = \`dependency-\${process.env.GITHUB_RUN_ATTEMPT}\`;
      - uses: actions/cache/save@0123456789012345678901234567890123456789
        if: \${{ steps.resolve.outputs.save_required == 'true' }}
        with:
          path: cache
          key: \${{ steps.resolve.outputs.cache_key }}
`);
  assert.match(
    collectActionsCachePolicyViolations(generatedRoot).join('\n'),
    /dynamically generated reusable cache key contains volatile run identity/,
  );
});

test('Actions cache policy requires explicit saves to be miss-driven', () => {
  const root = policyFixture(`
jobs:
  cache:
    steps:
      - uses: actions/cache/save@0123456789012345678901234567890123456789
        if: \${{ steps.resolve.outputs.cache_key != '' }}
        with:
          path: cache
          key: \${{ steps.resolve.outputs.cache_key }}
`);
  assert.match(
    collectActionsCachePolicyViolations(root).join('\n'),
    /explicit cache save must be guarded by a cache miss/,
  );
});
