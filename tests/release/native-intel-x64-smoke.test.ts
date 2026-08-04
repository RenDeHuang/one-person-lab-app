import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

const appRoot = path.resolve(import.meta.dirname, '../..');
const workflowPath = path.join(appRoot, '.github/workflows/native-intel-x64-smoke.yml');

test('native Intel x64 smoke stays manual, read-only, and dedicated to the i9 label', () => {
  const source = fs.readFileSync(workflowPath, 'utf8');
  const workflow = YAML.parse(source) as any;
  const triggers = workflow.on ?? workflow.true;
  const job = workflow.jobs['native-intel-x64-smoke'];

  assert.deepEqual(Object.keys(triggers), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(job['runs-on'], ['self-hosted', 'macOS', 'X64', 'opl-native-intel-macos']);
  assert.equal(job.env.CSC_IDENTITY_AUTO_DISCOVERY, false);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.match(source, /test "\$\(uname -m\)" = x86_64/);
  assert.match(source, /npm run build-mac:x64/);
  assert.match(source, /hdiutil verify "\$dmg_path"/);
  assert.doesNotMatch(source, /codesign --verify/);
  assert.match(source, /signed_for_distribution:false/);
  assert.match(source, /publication_attempted:false/);
  assert.doesNotMatch(source, /pull_request|push:|contents: write|packages: write/);
});
