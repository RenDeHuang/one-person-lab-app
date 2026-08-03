import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { ensurePackagedRuntimeFilesOwnerWritable } from '../../../scripts/build-full-first-install-package/archive-output.ts';
import { createPosixModeTempRoot } from '../native-posix-temp.ts';

test('Full payload staging makes regular files owner-writable without changing executable bits', () => {
  const runtimeRoot = createPosixModeTempRoot('opl-full-runtime-modes-');
  try {
    const dataFile = path.join(runtimeRoot, 'python', '_emoji_codes.py');
    const executableFile = path.join(runtimeRoot, 'bin', 'python3');
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.mkdirSync(path.dirname(executableFile), { recursive: true });
    fs.writeFileSync(dataFile, "EMOJI = {'lab': 'test'}\n", 'utf8');
    fs.writeFileSync(executableFile, '#!/bin/sh\nexit 0\n', 'utf8');
    fs.chmodSync(dataFile, 0o444);
    fs.chmodSync(executableFile, 0o555);

    assert.deepEqual(ensurePackagedRuntimeFilesOwnerWritable(runtimeRoot), {
      scanned_files: 2,
      updated_files: 2,
    });
    assert.equal(fs.statSync(dataFile).mode & 0o777, 0o644);
    assert.equal(fs.statSync(executableFile).mode & 0o777, 0o755);
    assert.equal(fs.readFileSync(dataFile, 'utf8'), "EMOJI = {'lab': 'test'}\n");

    assert.deepEqual(ensurePackagedRuntimeFilesOwnerWritable(runtimeRoot), {
      scanned_files: 2,
      updated_files: 0,
    });
  } finally {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
});
