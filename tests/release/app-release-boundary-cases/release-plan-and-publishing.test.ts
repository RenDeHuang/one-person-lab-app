import { assert, fs, path, test, runNode } from './helpers.ts';

const appRoot = path.resolve(import.meta.dirname, '../../..');

test('retired release projection exposes exactly the three Framework Bundle operations', () => {
  const result = runNode([
    'scripts/plan-release-candidate.ts',
    '--version', '26.7.21',
    '--include-full-package',
    '--no-settings-vm',
  ], { env: { OPL_RELEASE_DATE: '2026-07-21' } });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const projection = JSON.parse(result.stdout);
  assert.equal(projection.schema, 'opl_app_framework_release_operation_projection.v1');
  assert.equal(projection.lifecycle, 'retired_read_only_projection');
  assert.equal(projection.authoritative, false);
  assert.deepEqual(projection.exact_operation_set, ['standard', 'resume_standard', 'append_full']);
  assert.deepEqual(
    projection.stable_operations.map((entry) => entry.operation),
    ['standard', 'resume_standard', 'append_full'],
  );
  assert.equal(projection.stable_operations[1].rebuild_performed, false);
  assert.equal(projection.stable_operations[2].rebuild_performed, false);
  assert.equal(projection.stable_operations[2].modifies_standard_or_latest, false);
  assert.deepEqual(projection.authority_boundary, {
    projection_can_create_state: false,
    projection_can_authorize_mutation: false,
    projection_can_dispatch: false,
    projection_can_publish: false,
    projection_can_claim_release_ready: false,
  });
  assert.doesNotMatch(result.stdout, /desktop-release|candidate-record|broker|promote/i);
});

test('retired release projection preserves the Stable calendar guard', () => {
  const result = runNode([
    'scripts/plan-release-candidate.ts',
    '--version', '99.12.31',
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /future-dated/);
  assert.equal(result.stdout, '');
});

test('manual Nightly and local-install planner profiles are retired', () => {
  for (const profile of ['nightly', 'local-install']) {
    const result = runNode([
      'scripts/plan-release-candidate.ts',
      '--version', '26.7.21',
      '--profile', profile,
    ], { env: { OPL_RELEASE_DATE: '2026-07-21' } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /only the Stable Framework Bundle topology/);
    assert.equal(result.stdout, '');
  }
});

test('retired cohort helpers emit no legacy package or recovery command', () => {
  const combined = [
    'scripts/plan-release-cohort.ts',
    'scripts/write-release-cohort-manifest.ts',
    'scripts/closeout-release-run.ts',
  ].map((file) => fs.readFileSync(path.join(appRoot, file), 'utf8')).join('\n');
  assert.doesNotMatch(combined, /npm run release:(?:plan|stable|closeout|candidate-record)/);
  assert.doesNotMatch(combined, /gh workflow run|gh run rerun|gh run cancel/);
  assert.match(combined, /opl release status --bundle <sha256:digest>/);
});

test('legacy desktop workflow files are read-only tombstones', () => {
  for (const name of [
    'desktop-release.yml',
    'desktop-release-promote.yml',
    'desktop-release-full-addon.yml',
    'desktop-release-cleanup-drafts.yml',
  ]) {
    const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', name), 'utf8');
    assert.doesNotMatch(workflow, /workflow_dispatch:|contents:\s*write|id-token:\s*write/);
    assert.match(workflow, /exit 1/);
  }
});
