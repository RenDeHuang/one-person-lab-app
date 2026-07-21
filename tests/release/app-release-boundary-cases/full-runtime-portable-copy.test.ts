import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { copyRuntimePayloadTree } from '../../../scripts/build-full-first-install-package/archive-output.ts';

test('Full runtime copy preserves internal relative symlinks inside the packaged tree', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-runtime-copy-'));
  try {
    const sourceRoot = path.join(tempRoot, 'source');
    const targetRoot = path.join(tempRoot, 'target');
    const packageBin = path.join(sourceRoot, 'node', 'lib', 'node_modules', 'npm', 'node_modules', '.bin');
    const executable = path.join(sourceRoot, 'node', 'lib', 'node_modules', 'npm', 'node_modules', 'which', 'bin', 'which.js');
    fs.mkdirSync(packageBin, { recursive: true });
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, '#!/usr/bin/env node\n', 'utf8');
    fs.symlinkSync('../which/bin/which.js', path.join(packageBin, 'node-which'));

    copyRuntimePayloadTree(sourceRoot, targetRoot);

    const copiedLink = path.join(targetRoot, path.relative(sourceRoot, path.join(packageBin, 'node-which')));
    assert.equal(fs.readlinkSync(copiedLink), '../which/bin/which.js');
    assert.equal(
      fs.realpathSync(copiedLink),
      fs.realpathSync(path.join(targetRoot, path.relative(sourceRoot, executable))),
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('Full runtime copy rejects absolute links before App signing', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-runtime-copy-external-'));
  try {
    const sourceRoot = path.join(tempRoot, 'source');
    const targetRoot = path.join(tempRoot, 'target');
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.symlinkSync('/tmp/outside-full-runtime', path.join(sourceRoot, 'outside'));

    assert.throws(
      () => copyRuntimePayloadTree(sourceRoot, targetRoot),
      /Packaged Full runtime contains external symlink/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
