import { assert, fs, path, test } from './helpers.ts';

const appRoot = path.resolve(import.meta.dirname, '../../..');
const release = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'contracts/app-release-channel.json'), 'utf8'),
);

test('App release SSOT exposes exactly the three Framework Bundle operations', () => {
  assert.equal(release.release_preflight.script, 'scripts/framework-release-adapter.ts');
  assert.equal(release.release_preflight.command, 'freeze-request');
  assert.deepEqual(
    release.release_preflight.stable_operations,
    ['standard', 'resume_standard', 'append_full'],
  );
  assert.deepEqual(
    Object.keys(release.release_bundle_control_plane.operation_control.stable_operations),
    ['standard', 'resume_standard', 'append_full'],
  );
});

test('retired App release implementations and legacy workflows stay physically absent', () => {
  const legacy = release.release_bundle_control_plane.legacy_compatibility;
  assert.equal(legacy.removed_implementation_paths_must_be_absent, true);
  for (const relativePath of legacy.removed_implementation_paths) {
    assert.equal(fs.existsSync(path.join(appRoot, relativePath)), false, relativePath);
  }
  for (const relativePath of [
    '.github/workflows/desktop-release.yml',
    '.github/workflows/desktop-release-promote.yml',
    '.github/workflows/desktop-release-full-addon.yml',
    '.github/workflows/desktop-release-cleanup-drafts.yml',
  ]) {
    assert.equal(fs.existsSync(path.join(appRoot, relativePath)), false, relativePath);
  }
});
