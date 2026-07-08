import { assert, path, test } from './helpers.ts';
import { parseArgs as parseFullFirstInstallArgs } from '../../../scripts/build-full-first-install-package/env.ts';
import { parseArgs as parseActiveShellArgs } from '../../../scripts/validate-active-shell/validation-config.ts';

test('Full first-install args parse boolean and value options through one explicit option table', () => {
  const options = parseFullFirstInstallArgs([
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
  assert.throws(() => parseFullFirstInstallArgs(['--version']), /Missing value for --version/);
  assert.throws(() => parseFullFirstInstallArgs(['--version', '--out-dir']), /Missing value for --version/);
  assert.throws(
    () => parseFullFirstInstallArgs(['--version=26.6.0']),
    /Unknown argument: --version=26.6.0/,
  );
  assert.throws(
    () => parseFullFirstInstallArgs(['--unknown-option', 'value']),
    /Unknown argument: --unknown-option/,
  );
  assert.throws(
    () => parseFullFirstInstallArgs(['--runtime-cache-mode', 'writeonly']),
    /Unsupported runtime cache mode: writeonly/,
  );
});

test('Active shell args parse process argv shape for quick and only filters', () => {
  const options = parseActiveShellArgs([
    'node',
    'scripts/validate-active-shell.ts',
    '--quick',
    '--only',
    'i18n_types, typecheck,,',
  ]);

  assert.equal(options.quick, true);
  assert.deepEqual([...options.only], ['i18n_types', 'typecheck']);
});

test('Active shell args reject missing values and unknown options', () => {
  assert.throws(
    () => parseActiveShellArgs(['node', 'scripts/validate-active-shell.ts', '--only']),
    /Missing value for --only/,
  );
  assert.throws(
    () => parseActiveShellArgs(['node', 'scripts/validate-active-shell.ts', '--only', '--quick']),
    /Missing value for --only/,
  );
  assert.throws(
    () => parseActiveShellArgs(['node', 'scripts/validate-active-shell.ts', '--quick=false']),
    /Unknown argument: --quick=false/,
  );
  assert.throws(
    () => parseActiveShellArgs(['node', 'scripts/validate-active-shell.ts', '--unknown-option']),
    /Unknown argument: --unknown-option/,
  );
});
