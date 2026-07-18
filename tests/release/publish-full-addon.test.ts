import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { planFullAddonUpload } from '../../scripts/publish-full-addon.ts';

const local = {
  path: '/tmp/One-Person-Lab-Full-26.7.18-mac-arm64.dmg',
  name: 'One-Person-Lab-Full-26.7.18-mac-arm64.dmg',
  size: 42,
  sha256: 'a'.repeat(64),
};

test('missing Full add-on asset is scheduled for additive upload', () => {
  assert.deepEqual(planFullAddonUpload([local], []), [{ ...local, action: 'upload' }]);
});

test('same Full add-on name and digest is reused idempotently', () => {
  assert.deepEqual(planFullAddonUpload([local], [{
    name: local.name,
    size: local.size,
    digest: `sha256:${local.sha256}`,
  }]), [{ ...local, action: 'reuse' }]);
});

test('same Full add-on name with different bytes requires a new version', () => {
  assert.throws(
    () => planFullAddonUpload([local], [{ name: local.name, size: local.size, digest: `sha256:${'b'.repeat(64)}` }]),
    /already exists with different bytes; create a new version/,
  );
});

test('Full add-on workflow cannot overwrite release state or existing assets', () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/desktop-release-full-addon.yml'), 'utf8');
  const publisher = fs.readFileSync(path.join(process.cwd(), 'scripts/publish-full-addon.ts'), 'utf8');
  const source = `${workflow}\n${publisher}`;

  assert.match(workflow, /release_artifact_run_id: \$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /Bind add-on inputs to the immutable Standard distribution receipt/);
  assert.match(workflow, /--kind distribution --receipt "\$receipt"/);
  assert.match(workflow, /--release-set-manifest-digest "\$\{\{ inputs\.release_set_manifest_digest \}\}"/);
  assert.match(publisher, /gh\(\['release', 'upload', tag, asset\.path, '--repo', values\.repo!\]\)/);
  assert.doesNotMatch(source, /--clobber/);
  assert.doesNotMatch(source, /release', 'edit|release edit/);
  assert.doesNotMatch(source, /make_latest|latest-arm64-mac\.yml|latest-mac\.yml/);
  assert.doesNotMatch(source, /release notes|notes-file|generate-notes/);
});
