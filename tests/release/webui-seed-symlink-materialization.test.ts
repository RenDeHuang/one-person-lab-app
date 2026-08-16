import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

import { materializeWebuiSeedSymlinks } from '../../scripts/materialize-webui-seed-symlinks.ts';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-webui-seed-materialize-'));
  const payload = path.join(root, 'payload');
  fs.mkdirSync(path.join(payload, 'node_modules', '.bin'), { recursive: true });
  return {
    root,
    payload,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test('materializes contained regular-file symlinks with exact bytes and executable mode', () => {
  const current = fixture();
  try {
    const target = path.join(current.payload, 'node_modules', 'webpack', 'bin', 'webpack.js');
    const link = path.join(current.payload, 'node_modules', '.bin', 'webpack');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(path.join(path.dirname(target), 'identity.txt'), 'webpack-target-directory\n');
    fs.writeFileSync(
      target,
      '#!/usr/bin/env node\nconst fs = require("node:fs");\nconst path = require("node:path");\nprocess.stdout.write(fs.readFileSync(path.join(__dirname, "identity.txt"), "utf8"));\n',
    );
    fs.chmodSync(target, 0o751);
    fs.symlinkSync('../webpack/bin/webpack.js', link);

    const result = materializeWebuiSeedSymlinks(current.payload);

    assert.deepEqual(result, [{
      path: 'node_modules/.bin/webpack',
      target: '../webpack/bin/webpack.js',
      mode: 0o751,
      size_bytes: fs.statSync(link).size,
    }]);
    assert.equal(fs.lstatSync(link).isSymbolicLink(), false);
    assert.match(fs.readFileSync(link, 'utf8'), /^#!\/bin\/sh\nexec /);
    assert.equal(fs.statSync(link).mode & 0o777, 0o751);
    const execution = spawnSync(link, [], { encoding: 'utf8' });
    assert.equal(execution.status, 0, execution.stderr);
    assert.equal(execution.stdout, 'webpack-target-directory\n');
  } finally {
    current.cleanup();
  }
});

test('materializes only the exact global Codex bin symlink outside npm .bin', () => {
  const current = fixture();
  try {
    const target = path.join(
      current.payload,
      'lib',
      'node_modules',
      '@openai',
      'codex',
      'bin',
      'codex.js',
    );
    const link = path.join(current.payload, 'bin', 'codex');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.writeFileSync(target, '#!/usr/bin/env node\nprocess.stdout.write("codex-global-bin\\n");\n');
    fs.chmodSync(target, 0o755);
    fs.symlinkSync('../lib/node_modules/@openai/codex/bin/codex.js', link);

    const result = materializeWebuiSeedSymlinks(current.payload);

    assert.deepEqual(result, [{
      path: 'bin/codex',
      target: '../lib/node_modules/@openai/codex/bin/codex.js',
      mode: 0o755,
      size_bytes: fs.statSync(link).size,
    }]);
    assert.equal(fs.lstatSync(link).isSymbolicLink(), false);
    const execution = spawnSync(link, [], { encoding: 'utf8' });
    assert.equal(execution.status, 0, execution.stderr);
    assert.equal(execution.stdout, 'codex-global-bin\n');
  } finally {
    current.cleanup();
  }
});

test('materializes exact OPL workspace package links as real directories', () => {
  const current = fixture();
  try {
    const packageRoot = path.join(current.payload, 'packages', 'connect-discovery');
    const scopeRoot = path.join(current.payload, 'node_modules', '@one-person-lab');
    const link = path.join(scopeRoot, 'connect-discovery');
    fs.mkdirSync(path.join(packageRoot, 'dist'), { recursive: true });
    fs.mkdirSync(scopeRoot, { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, 'package.json'),
      `${JSON.stringify({ name: '@one-person-lab/connect-discovery', version: '0.1.0' })}\n`,
    );
    fs.writeFileSync(path.join(packageRoot, 'dist', 'index.js'), 'export const ready = true;\n');
    fs.symlinkSync('../../packages/connect-discovery', link);

    const result = materializeWebuiSeedSymlinks(
      path.join(current.payload, 'node_modules'),
      { workspaceRoot: current.payload },
    );

    assert.equal(result.length, 1);
    assert.equal(result[0].path, path.join('@one-person-lab', 'connect-discovery'));
    assert.equal(fs.lstatSync(link).isSymbolicLink(), false);
    assert.equal(fs.lstatSync(link).isDirectory(), true);
    assert.equal(fs.readFileSync(path.join(link, 'dist', 'index.js'), 'utf8'), 'export const ready = true;\n');
  } finally {
    current.cleanup();
  }
});

test('rejects an OPL workspace link whose package identity does not match', () => {
  const current = fixture();
  try {
    const packageRoot = path.join(current.payload, 'packages', 'connect-discovery');
    const scopeRoot = path.join(current.payload, 'node_modules', '@one-person-lab');
    const link = path.join(scopeRoot, 'connect-discovery');
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.mkdirSync(scopeRoot, { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'package.json'), '{"name":"@one-person-lab/wrong"}\n');
    fs.symlinkSync('../../packages/connect-discovery', link);

    assert.throws(
      () => materializeWebuiSeedSymlinks(
        path.join(current.payload, 'node_modules'),
        { workspaceRoot: current.payload },
      ),
      /workspace package identity does not match/,
    );
    assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  } finally {
    current.cleanup();
  }
});

test('rejects executable symlinks outside npm .bin without partially materializing valid links', () => {
  const current = fixture();
  try {
    const validTarget = path.join(current.payload, 'node_modules', 'valid.js');
    const validLink = path.join(current.payload, 'node_modules', '.bin', 'a-valid');
    const invalidTarget = path.join(current.payload, 'node_modules', 'package', 'target.js');
    const invalidLink = path.join(current.payload, 'node_modules', 'package', 'command');
    fs.mkdirSync(path.dirname(invalidTarget), { recursive: true });
    for (const target of [validTarget, invalidTarget]) {
      fs.writeFileSync(target, '#!/usr/bin/env node\n');
      fs.chmodSync(target, 0o755);
    }
    fs.symlinkSync('../valid.js', validLink);
    fs.symlinkSync('target.js', invalidLink);

    assert.throws(
      () => materializeWebuiSeedSymlinks(current.payload),
      /only npm \.bin, an exact OPL workspace package, or the exact global Codex bin symbolic link/,
    );
    assert.equal(fs.lstatSync(validLink).isSymbolicLink(), true);
    assert.equal(fs.lstatSync(invalidLink).isSymbolicLink(), true);
  } finally {
    current.cleanup();
  }
});

for (const invalid of [
  {
    name: 'absolute target',
    expected: /absolute symbolic link/,
    create(current: ReturnType<typeof fixture>, link: string) {
      const target = path.join(current.payload, 'target.js');
      fs.writeFileSync(target, 'target\n');
      fs.symlinkSync(target, link);
    },
  },
  {
    name: 'root escape',
    expected: /escapes the payload root/,
    create(current: ReturnType<typeof fixture>, link: string) {
      const target = path.join(current.root, 'outside.js');
      fs.writeFileSync(target, 'outside\n');
      fs.symlinkSync('../../../outside.js', link);
    },
  },
  {
    name: 'broken target',
    expected: /broken symbolic link/,
    create(_current: ReturnType<typeof fixture>, link: string) {
      fs.symlinkSync('../missing/bin.js', link);
    },
  },
  {
    name: 'directory target',
    expected: /must target a regular file/,
    create(current: ReturnType<typeof fixture>, link: string) {
      const target = path.join(current.payload, 'node_modules', 'directory-target');
      fs.mkdirSync(target, { recursive: true });
      fs.symlinkSync('../directory-target', link);
    },
  },
  {
    name: 'non-executable target',
    expected: /must target an executable file/,
    create(current: ReturnType<typeof fixture>, link: string) {
      const target = path.join(current.payload, 'node_modules', 'non-executable.js');
      fs.writeFileSync(target, '#!/usr/bin/env node\n');
      fs.chmodSync(target, 0o644);
      fs.symlinkSync('../non-executable.js', link);
    },
  },
  {
    name: 'executable without interpreter',
    expected: /must declare an interpreter/,
    create(current: ReturnType<typeof fixture>, link: string) {
      const target = path.join(current.payload, 'node_modules', 'no-shebang.js');
      fs.writeFileSync(target, 'console.log("no shebang");\n');
      fs.chmodSync(target, 0o755);
      fs.symlinkSync('../no-shebang.js', link);
    },
  },
  {
    name: 'symlink chain',
    expected: /may not traverse another symbolic link/,
    create(current: ReturnType<typeof fixture>, link: string) {
      const target = path.join(current.payload, 'node_modules', 'target.js');
      const intermediate = path.join(current.payload, 'node_modules', 'intermediate.js');
      fs.writeFileSync(target, '#!/usr/bin/env node\ntarget\n');
      fs.chmodSync(target, 0o755);
      fs.symlinkSync('target.js', intermediate);
      fs.symlinkSync('../intermediate.js', link);
    },
  },
] as const) {
  test(`rejects ${invalid.name} without partially materializing valid links`, () => {
    const current = fixture();
    try {
      const validTarget = path.join(current.payload, 'node_modules', 'valid.js');
      const validLink = path.join(current.payload, 'node_modules', '.bin', 'a-valid');
      const invalidLink = path.join(current.payload, 'node_modules', '.bin', 'z-invalid');
      fs.writeFileSync(validTarget, '#!/usr/bin/env node\n');
      fs.chmodSync(validTarget, 0o755);
      fs.symlinkSync('../valid.js', validLink);
      invalid.create(current, invalidLink);

      assert.throws(() => materializeWebuiSeedSymlinks(current.payload), invalid.expected);
      assert.equal(fs.lstatSync(validLink).isSymbolicLink(), true);
    } finally {
      current.cleanup();
    }
  });
}
