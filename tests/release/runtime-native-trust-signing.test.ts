import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertSignedRuntimeExecutableSmoke,
  macosRuntimeCodesignArgs,
  signedRuntimeExecutableSmokeArgs,
} from '../../scripts/build-full-first-install-package/runtime-native-trust.ts';

test('Full runtime re-signing preserves existing executable metadata', () => {
  assert.deepEqual(
    macosRuntimeCodesignArgs('/tmp/officecli', 'Developer ID Application: Example (TEAMID1234)'),
    [
      '--force',
      '--preserve-metadata=identifier,entitlements,flags,runtime',
      '--options',
      'runtime',
      '--timestamp',
      '--sign',
      'Developer ID Application: Example (TEAMID1234)',
      '/tmp/officecli',
    ],
  );
});

test('Full runtime re-signing runs the OfficeCLI version smoke', () => {
  assert.deepEqual(signedRuntimeExecutableSmokeArgs('runtime/current/bin/officecli'), ['--version']);
  const output = assertSignedRuntimeExecutableSmoke(
    '/tmp/officecli',
    'runtime/current/bin/officecli',
    (command, args) => {
      assert.equal(command, '/tmp/officecli');
      assert.deepEqual(args, ['--version']);
      return { status: 0, stdout: '1.0.139\n', stderr: '' };
    },
  );
  assert.equal(output, '1.0.139');
});

test('Full runtime re-signing fails closed when the OfficeCLI version smoke crashes', () => {
  assert.throws(
    () => assertSignedRuntimeExecutableSmoke(
      '/tmp/officecli',
      'runtime/current/bin/officecli',
      () => ({
        status: 137,
        signal: null,
        stdout: '',
        stderr: 'Failed to create CoreCLR, HRESULT: 0x80070008',
      }),
    ),
    /exit_status=137[\s\S]*Failed to create CoreCLR/,
  );
});

test('Full runtime re-signing does not execute an undeclared binary smoke', () => {
  let invoked = false;
  const result = assertSignedRuntimeExecutableSmoke(
    '/tmp/codex',
    'runtime/current/bin/codex',
    () => {
      invoked = true;
      return { status: 0, stdout: 'codex-cli 1.0.0\n', stderr: '' };
    },
  );
  assert.equal(result, null);
  assert.equal(invoked, false);
});
