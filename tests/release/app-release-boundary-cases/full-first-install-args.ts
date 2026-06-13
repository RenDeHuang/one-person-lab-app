import { assert, path, test } from './helpers.ts';
import { parseArgs } from '../../../scripts/build-full-first-install-package/env.ts';

test('Full first-install args parse boolean and value options through one explicit option table', () => {
  const options = parseArgs([
    '--skip-gui-build',
    '--split-runtime',
    '--reuse-gui-vite-output',
    '--include-bun-runtime',
    '--print-runtime-cache-keys',
    '--version',
    '26.6.0-test',
    '--out-dir',
    'dist/full',
    '--opl-root',
    '../one-person-lab',
    '--runtime-cache-mode',
    'readonly',
  ]);

  assert.equal(options.skipGuiBuild, true);
  assert.equal(options.splitRuntime, true);
  assert.equal(options.reuseGuiViteOutput, true);
  assert.equal(options.includeBunRuntime, true);
  assert.equal(options.printRuntimeCacheKeys, true);
  assert.equal(options.version, '26.6.0-test');
  assert.equal(options.outDir, path.resolve('dist/full'));
  assert.equal(options.frameworkRoot, path.resolve('../one-person-lab'));
  assert.equal(options.runtimeCacheMode, 'readonly');
});

test('Full first-install args reject missing values, unknown options, and unsupported cache modes', () => {
  assert.throws(() => parseArgs(['--version']), /Missing value for --version/);
  assert.throws(() => parseArgs(['--unknown-option', 'value']), /Unknown argument: --unknown-option/);
  assert.throws(
    () => parseArgs(['--runtime-cache-mode', 'writeonly']),
    /Unsupported runtime cache mode: writeonly/,
  );
});
