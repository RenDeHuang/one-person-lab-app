import { assertAppRootBoundary } from '../../../scripts/app-root-boundary.ts';
import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
} from './helpers.ts';

const requiredScripts = {
  'validate:app-root-boundary': 'node --experimental-strip-types scripts/app-root-boundary.ts',
  'validate:active-shell': 'node --experimental-strip-types scripts/validate-active-shell.ts',
  'validate:release-boundary': 'node --experimental-strip-types scripts/validate-release-boundary.ts',
  'release:prepare-standard': 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts',
  'release:closeout': 'node --experimental-strip-types scripts/closeout-release-run.ts',
  'build-mac:arm64': 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-mac:arm64',
};

function writeRootPackage(root: string, overrides = {}): void {
  fs.writeFileSync(
    path.join(root, 'package.json'),
    `${JSON.stringify({
      name: 'one-person-lab-app',
      version: '1.9.25',
      private: true,
      type: 'module',
      scripts: requiredScripts,
      ...overrides,
    }, null, 2)}\n`,
    'utf8',
  );
}

test('App root boundary validator accepts the product wrapper and rejects shell-root pollution', () => {
  assertAppRootBoundary({ root: appRoot });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-root-boundary-'));
  writeRootPackage(tempRoot);
  assert.doesNotThrow(() => assertAppRootBoundary({ root: tempRoot }));

  writeRootPackage(tempRoot, {
    name: 'one-person-lab-aion-shell',
    main: './out/main/index.js',
    workspaces: ['packages/*'],
    productName: 'One Person Lab',
  });
  assert.throws(
    () => assertAppRootBoundary({ root: tempRoot }),
    /package\.json name must stay one-person-lab-app[\s\S]*package\.json must not contain shell package field main[\s\S]*package\.json must not contain shell package field workspaces/,
  );

  writeRootPackage(tempRoot);
  fs.writeFileSync(path.join(tempRoot, 'index.js'), '"use strict";\n', 'utf8');
  assert.throws(
    () => assertAppRootBoundary({ root: tempRoot }),
    /shell build artifact must not exist at App root: index\.js/,
  );
});
