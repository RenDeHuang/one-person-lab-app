import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateNativeWebuiPublicationTopology } from '../../scripts/validate-release-boundary/text-check-runner.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const retiredPaths = [
  '.github/workflows/_release-native-webui-carrier.yml',
  '.github/workflows/release-native-webui-follower.yml',
  'scripts/release-native-webui-carrier.ts',
];

function withoutExpectedDiagnostics(run: () => number): number {
  const original = console.error;
  console.error = () => undefined;
  try {
    return run();
  } finally {
    console.error = original;
  }
}

test('the retired Native WebUI carrier has no live workflow or script surface', () => {
  for (const relativePath of retiredPaths) {
    assert.equal(fs.existsSync(path.join(appRoot, relativePath)), false, relativePath);
  }
  assert.equal(withoutExpectedDiagnostics(() => validateNativeWebuiPublicationTopology(appRoot)), 0);
});

test('the release-boundary guard rejects carrier restoration and references from other workflows', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-retired-native-webui-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const workflows = path.join(root, '.github', 'workflows');
  fs.mkdirSync(workflows, { recursive: true });

  fs.writeFileSync(
    path.join(workflows, 'release-native-webui-follower.yml'),
    'name: retired carrier must not return\n',
  );
  assert.ok(withoutExpectedDiagnostics(() => validateNativeWebuiPublicationTopology(root)) > 0);

  fs.rmSync(path.join(workflows, 'release-native-webui-follower.yml'));
  fs.writeFileSync(
    path.join(workflows, 'release-stable.yml'),
    'jobs:\n  forbidden:\n    uses: ./.github/workflows/_release-native-webui-carrier.yml\n',
  );
  assert.ok(withoutExpectedDiagnostics(() => validateNativeWebuiPublicationTopology(root)) > 0);
});
