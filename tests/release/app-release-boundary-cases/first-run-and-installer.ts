import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  runNode,
  writeExecutable,
  writeFile,
} from './helpers.ts';
import { validateFirstRunMatrix } from '../../../scripts/validate-active-shell/first-run-matrix-validator.ts';
import { releaseBoundaryChecks } from '../../../scripts/validate-release-boundary/release-checks.ts';

const readJson = (relativePath: string) => JSON.parse(
  fs.readFileSync(path.join(appRoot, relativePath), 'utf8'),
);
const requireReleaseBoundaryCheck = (id: string) => {
  const check = releaseBoundaryChecks.find((entry) => entry.id === id);
  assert.ok(check, id);
  return check;
};

test('first-run matrix delegates policy shape to the active-shell validator', () => {
  const matrix = readJson('contracts/app-first-run-test-matrix.json');
  const adapter = readJson('contracts/app-shell-adapter.json');
  assert.doesNotThrow(() => validateFirstRunMatrix(matrix, adapter));
  for (const id of [
    'standard_dmg_clean_vm_smoke',
    'full_dmg_clean_vm_smoke',
    'homebrew_standard_cask_clean_vm_smoke',
  ]) {
    const scenario = matrix.scenarios.find((entry) => entry.id === id);
    assert.ok(scenario, id);
    assert.equal(scenario.release_gate, true, id);
  }
  const routeSmokeExpectations = matrix.scenarios
    .flatMap((scenario) => scenario.expects ?? [])
    .filter((expectation) => expectation.includes('Packaged GUI route smoke selects MAS'));
  assert.equal(routeSmokeExpectations.length, 3);
  for (const expectation of routeSmokeExpectations) {
    assert.match(expectation, /hides ordinary backend\/provider selectors/);
    assert.match(expectation, /shows the App-owned model\/reasoning and permission\/access controls/);
    assert.doesNotMatch(expectation, /hides ordinary backend\/model\/permission selectors/);
  }

  const invalid = structuredClone(matrix);
  invalid.scenarios[0].aliases = ['legacy'];
  assert.throws(
    () => validateFirstRunMatrix(invalid, adapter),
    /must not declare compatibility aliases/,
  );
});

test('one-shot App installer boundary is enforced by release-boundary checks', () => {
  const oneShot = requireReleaseBoundaryCheck('one_shot_unsigned_local_authorization');
  const stable = requireReleaseBoundaryCheck('short_stable_macos_installer');

  assert.equal(oneShot.file, 'install.sh');
  assert.ok(oneShot.required.includes('--stable-macos-install'));
  assert.ok(oneShot.required.includes('--authorize-local-app-only'));
  assert.equal(stable.file, 'install-stable.sh');
  assert.ok(stable.required.some((entry) => entry.includes('install.sh')));
  assert.ok(stable.required.some((entry) => entry.includes('--stable-macos-install')));
  assert.equal(fs.existsSync(path.join(appRoot, 'install-free.sh')), false);
});

test('local authorization checks each nested directory symlink path once', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-local-authorization-symlink-'));
  const appPath = path.join(tempRoot, 'One Person Lab.app');
  writeFile(path.join(appPath, 'real', 'sub', 'f'), 'abc');
  fs.mkdirSync(path.join(appPath, 'plain'), { recursive: true });
  fs.symlinkSync('../real', path.join(appPath, 'plain', 'link'));

  const fakeBin = path.join(tempRoot, 'bin');
  const xattrLog = path.join(tempRoot, 'xattr.log');
  const output = path.join(tempRoot, 'local-authorization-policy.json');
  writeExecutable(path.join(fakeBin, 'xattr'), `#!/bin/sh
printf '%s\\n' "$3" >> "$OPL_XATTR_LOG"
exit 0
`);

  const result = runNode([
    'scripts/local-authorization-policy.ts',
    '--package-kind',
    'app_standard',
    '--app-path',
    appPath,
    '--output',
    output,
  ], {
    env: {
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}`,
      OPL_XATTR_LOG: xattrLog,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must prove quarantine is absent or removed/);
  const checkedPaths = fs.readFileSync(xattrLog, 'utf8').trim().split('\n');
  assert.deepEqual(
    checkedPaths.map((entry) => path.relative(appPath, entry) || '.').sort(),
    ['.', 'plain', 'plain/link', 'real', 'real/sub', 'real/sub/f'],
  );
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).quarantine_attribute_count, 6);
});
