import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAppendPlan } from '../../scripts/append-stable-desktop-assets.ts';

const release = {
  id: 1,
  tag_name: 'v26.8.4',
  target_commitish: 'a'.repeat(40),
  draft: false,
  prerelease: false,
  immutable: false,
  assets: [{ name: 'mac.dmg', size: 3, digest: `sha256:${'1'.repeat(64)}` }],
};

test('same-tag Desktop append plans only missing exact assets', () => {
  const missing = { name: 'linux.deb', size: 4, digest: `sha256:${'2'.repeat(64)}`, source_path: '/tmp/linux.deb' };
  const complete = { ...release.assets[0], source_path: '/tmp/mac.dmg' };
  const plan = buildAppendPlan(release, [complete, missing]);
  assert.deepEqual(plan.upload, [missing]);
  assert.deepEqual(plan.already_complete, [complete]);
});

test('same-name different bytes fail closed', () => {
  assert.throws(
    () => buildAppendPlan(release, [{
      name: 'mac.dmg', size: 4, digest: `sha256:${'3'.repeat(64)}`, source_path: '/tmp/mac.dmg',
    }]),
    /asset conflict/,
  );
});
