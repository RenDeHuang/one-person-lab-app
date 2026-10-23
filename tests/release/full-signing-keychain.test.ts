import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

test('Full finalizers unlock the signing keychain and stop before notarization if unlock fails', () => {
  const workflow = parse(fs.readFileSync('.github/workflows/full-first-install-release.yml', 'utf8'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-keychain-'));
  try {
    const trace = path.join(root, 'trace');
    fs.writeFileSync(path.join(root, 'security'), '#!/bin/sh\nprintf "%s\\n" "$1" >> "$KEYCHAIN_TEST_TRACE"\nif [ "$1" = unlock-keychain ] && [ "$KEYCHAIN_TEST_FAIL" = 1 ]; then exit 7; fi\n', { mode: 0o755 });
    for (const job of Object.values(workflow.jobs) as any[]) {
      const setup = job.steps?.find((step: any) => step.run?.includes('security create-keychain'));
      if (!setup) continue;
      assert.match(setup.run, /security set-keychain-settings -lut 21600 build\.keychain/);
      const finalizer = job.steps.find((step: any) => step.name.startsWith('Finalize Full Developer ID'));
      assert.ok(finalizer.env.KEYCHAIN_PASSWORD);
      const prefix = finalizer.run.slice(0, finalizer.run.indexOf('node --experimental-strip-types'));
      for (const fail of ['0', '1']) {
        fs.writeFileSync(trace, '');
        const result = spawnSync('bash', ['-c', `${prefix}\nprintf 'notarize\\n' >> "$KEYCHAIN_TEST_TRACE"`], {
          encoding: 'utf8', env: { ...process.env, PATH: `${root}:${process.env.PATH}`, OPL_MAC_STRICT_SIGNING_CHECKS: 'true',
            KEYCHAIN_PASSWORD: 'test-only', KEYCHAIN_TEST_TRACE: trace, KEYCHAIN_TEST_FAIL: fail },
        });
        const calls = fs.readFileSync(trace, 'utf8').trim().split('\n');
        assert.equal(result.status, fail === '1' ? 7 : 0, result.stderr);
        assert.deepEqual(calls, fail === '1' ? ['unlock-keychain'] : ['unlock-keychain', 'default-keychain', 'list-keychains', 'notarize']);
      }
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
