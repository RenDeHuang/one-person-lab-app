import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

function runNode(args, options = {}) {
  return spawnSync(process.execPath, ['--experimental-strip-types', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

function writeFile(filePath, content = 'artifact') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeReleaseMetadata(outDir, version, assetName) {
  writeFile(path.join(outDir, 'latest-mac.yml'), [
    `version: ${version}`,
    'files:',
    `  - url: ${assetName}`,
    '    sha512: test',
    '    size: 1',
    `path: ${assetName}`,
    'sha512: test',
    '',
  ].join('\n'));
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((left, right) => (
    left.name.localeCompare(right.name)
  ));
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

test('release boundary guard keeps App release ownership in App repo', () => {
  const result = runNode(['scripts/validate-release-boundary.ts']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /App release boundary is App-owned/);
});

test('runtime page consumes OPL App/operator drilldown instead of App-owned runtime truth', () => {
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const runtimePage = pageStateMatrix.pages.find((page) => page.id === 'runtime');

  assert.equal(runtimePage.machine_source, 'runtime_tray_snapshot.app_operator_drilldown');
  assert.equal(runtimePage.framework_command, 'opl runtime app-operator-drilldown --json');
  assert.equal(runtimePage.page_contract, 'runtime_workbench_drilldown');
  for (const expected of [
    'route graph and decision map refs',
    'review and repair queue',
    'artifact gallery and package/export lifecycle refs',
    'memory refs and writeback receipt refs',
    'quality/readiness refs',
    'provider SLO and repair refs',
    'owner-aware action routing',
  ]) {
    assert.ok(runtimePage.must_show.includes(expected), expected);
  }
  for (const forbiddenOwner of [
    'runtime truth',
    'provider implementation',
    'domain truth',
    'memory body',
    'artifact body',
    'quality/readiness/export verdict',
  ]) {
    assert.ok(runtimePage.must_not_own.includes(forbiddenOwner), forbiddenOwner);
  }
});

test('App-owned automation entrypoints are TypeScript, not JavaScript wrappers', () => {
  const appOwnedEntrypoints = [
    ...walkFiles(path.join(appRoot, 'scripts')),
    ...walkFiles(path.join(appRoot, 'tests')),
  ];
  const javascriptEntrypoints = appOwnedEntrypoints
    .map((filePath) => path.relative(appRoot, filePath))
    .filter((relativePath) => /\.(mjs|cjs|js)$/.test(relativePath));

  assert.deepEqual(javascriptEntrypoints, []);
});

test('tracked App repo implementation files do not reintroduce JavaScript', () => {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: appRoot,
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);

  const javascriptFiles = result.stdout
    .split('\0')
    .filter(Boolean)
    .filter((relativePath) => /\.(mjs|cjs|js|jsx)$/.test(relativePath));

  assert.deepEqual(javascriptFiles, []);
});

test('publish dry run defaults to the App GitHub Release repo', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const version = '26.5.15-test';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;

  writeFile(path.join(outDir, dmgName));
  writeFile(path.join(outDir, `One-Person-Lab-${version}-mac-arm64.zip`));
  writeReleaseMetadata(outDir, version, dmgName);

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ]);

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(payload.tag, `v${version}`);
  assert.ok(payload.artifacts.some((artifact) => artifact.endsWith(dmgName)));
});

test('tag-triggered release workflow stamps package metadata from tag version', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const tagVersionResolver = [
    'if [ -z "$version" ] && [[ "$GITHUB_REF" == refs/tags/v* ]]; then',
    'version="${REF_NAME#v}"',
    'echo "OPL_RELEASE_VERSION=$version" >> "$GITHUB_ENV"',
  ];

  for (const expectedLine of tagVersionResolver) {
    assert.match(workflow, new RegExp(expectedLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('release code-quality uses App active-shell test runner', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');

  assert.match(workflow, /node --experimental-strip-types scripts\/run-active-shell-tests\.ts/);
  assert.doesNotMatch(workflow, /run:\s*bunx vitest run/);
});

test('release build uses App wrappers for cross-shell active-shell commands', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));

  assert.match(workflow, /command:\s*bun install --cwd shells\/aionui --frozen-lockfile/);
  assert.doesNotMatch(workflow, /command:\s*cd shells\/aionui && bun install --frozen-lockfile/);
  assert.match(
    workflow,
    /name: Prepare standard App payload[\s\S]*working-directory: \$\{\{ github\.workspace \}\}[\s\S]*run: node --experimental-strip-types scripts\/prepare-standard-release-payload\.ts/,
  );
  assert.match(
    workflow,
    /name: Verify packaged bundled bun assets[\s\S]*working-directory: \$\{\{ github\.workspace \}\}[\s\S]*run: bun run validate:opl-package/,
  );
  assert.equal(packageJson.scripts['test:packaged:bun'], 'bun run --cwd shells/aionui validate:opl-package');
});

test('release artifact upload preserves electron-updater blockmaps', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');

  assert.match(workflow, /find out\/ -type f[\s\S]*-name "\*\.blockmap"/);
  assert.match(workflow, /shells\/aionui\/out\/\*\.blockmap/);
});

test('stable release workflow publishes only macOS arm64 standard assets', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'build-and-release.yml'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(workflow, /"platform":"macos-arm64"/);
  assert.match(workflow, /"artifact-name":"macos-build-arm64"/);
  assert.doesNotMatch(workflow, /"platform":"windows-/);
  assert.doesNotMatch(workflow, /"platform":"linux-/);
  assert.doesNotMatch(workflow, /"platform":"macos-universal"/);
  assert.equal(packageJson.scripts['build-mac:arm64'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && bun run --cwd shells/aionui build-mac:arm64');
  assert.equal(packageJson.scripts['build-mac'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && bun run --cwd shells/aionui build-mac');
  assert.equal(packageJson.scripts['build-mac:x64'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && bun run --cwd shells/aionui build-mac:x64');
  assert.equal(packageJson.scripts['build-win'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && bun run --cwd shells/aionui build-win');
  assert.equal(packageJson.scripts['build-deb'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && bun run --cwd shells/aionui build-deb');
  assert.deepEqual(releaseContract.standard_updater.allowed_metadata, [
    'latest-mac.yml',
    'latest-arm64-mac.yml',
  ]);
  assert.deepEqual(releaseContract.standard_updater.allowed_assets, [
    'One-Person-Lab-*-mac-arm64.dmg',
    'One-Person-Lab-*-mac-arm64.zip',
    'One-Person-Lab-*-mac-arm64.dmg.blockmap',
    'One-Person-Lab-*-mac-arm64.zip.blockmap',
  ]);
  assert.match(workflow, /release-assets\/\*\*\/\*\.dmg/);
  assert.match(workflow, /release-assets\/\*\*\/\*\.zip/);
  assert.match(workflow, /release-assets\/\*\*\/\*\.blockmap/);
  assert.match(workflow, /release-assets\/\*\*\/\*\.yml/);
  assert.doesNotMatch(workflow, /release-assets\/\*\*\/\*\.exe/);
  assert.doesNotMatch(workflow, /release-assets\/\*\*\/\*\.msi/);
  assert.doesNotMatch(workflow, /release-assets\/\*\*\/\*\.deb/);
});

test('manual build workflow keeps cross-platform builds behind an explicit switch', () => {
  const reusableWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const manualWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'build-manual.yml'), 'utf8');

  assert.match(manualWorkflow, /default: 'macos-arm64'/);
  for (const platform of [
    'macos-arm64',
    'macos-x64',
    'macos-universal',
    'windows-x64',
    'windows-arm64',
    'linux-x64',
    'linux-arm64',
    'all',
  ]) {
    assert.match(manualWorkflow, new RegExp(`- ${platform}`));
  }

  assert.match(manualWorkflow, /case "\$PLATFORM" in/);
  assert.match(manualWorkflow, /WINDOWS_X64=.*"platform":"windows-x64"/);
  assert.match(manualWorkflow, /LINUX_X64=.*"platform":"linux-x64"/);
  assert.match(reusableWorkflow, /Build with electron-builder \(Windows\)/);
  assert.match(reusableWorkflow, /Build with electron-builder \(Linux\)/);
  assert.match(reusableWorkflow, /shells\/aionui\/out\/\*\.exe/);
  assert.match(reusableWorkflow, /shells\/aionui\/out\/\*\.deb/);
});

test('release creation job runs TypeScript asset scripts under Node 22', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'build-and-release.yml'), 'utf8');

  assert.match(
    workflow,
    /name: Create Release[\s\S]*name: Checkout active shell[\s\S]*repository: gaofeng21cn\/opl-aion-shell[\s\S]*path: shells\/aionui[\s\S]*name: Setup Node\.js[\s\S]*uses: actions\/setup-node@v4[\s\S]*node-version: '22'[\s\S]*node --experimental-strip-types scripts\/prepare-release-assets\.ts/,
  );
});

test('publish rejects standard App artifacts that contain the Full runtime payload', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-full-leak-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const version = '26.5.15-test';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;

  writeFile(path.join(outDir, dmgName));
  writeFile(path.join(outDir, `One-Person-Lab-${version}-mac-arm64.zip`));
  writeReleaseMetadata(outDir, version, dmgName);
  writeFile(
    path.join(shellRoot, 'out', 'mac-arm64', 'One Person Lab.app', 'Contents', 'Resources', 'opl-full-runtime', 'runtime', 'current', 'manifest', 'full-package-manifest.json'),
    '{}\n',
  );

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contains Full runtime payload/);
});

test('packaged runtime validator only requires Full runtime when explicitly requested', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-packaged-runtime-'));
  const resourcesRoot = path.join(tempRoot, 'One Person Lab.app', 'Contents', 'Resources');
  const asarPath = path.join(resourcesRoot, 'app.asar');

  fs.mkdirSync(resourcesRoot, { recursive: true });
  fs.writeFileSync(asarPath, '', 'utf8');

  const validator = require('../../shells/aionui/scripts/validate-packaged-runtime.js');
  const optional = validator.validateFullRuntimeResources(resourcesRoot, { require: false });
  const required = validator.validateFullRuntimeResources(resourcesRoot, { require: true });

  assert.equal(optional.checked, false);
  assert.deepEqual(optional.issues, []);
  assert.equal(required.checked, false);
  assert.match(required.issues.join('\n'), /missing opl-full-runtime extraResource/);
});

test('Full first-install manifest declares App-owned distribution and Framework payload role', async () => {
  const mod = await import('../../scripts/full-first-install-package.ts');
  const manifest = mod.buildFullPackageManifest({ version: '26.5.15' });

  assert.equal(manifest.distribution.owner_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(manifest.distribution.updater_metadata_allowed, false);
  assert.equal(manifest.components.opl.role, 'framework_cli_and_shared_contracts_payload_source');
});

test('Full first-install payload boundary stays assembly-only', async () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const mod = await import('../../scripts/full-first-install-package.ts');
  const manifest = mod.buildFullPackageManifest({ version: '26.5.15' });

  assert.equal(
    releaseContract.full_first_install.payload_boundary.role,
    'declared_payload_assembly_and_validation',
  );
  assert.deepEqual(
    manifest.distribution.payload_boundary.app_repo_does_not_own,
    releaseContract.full_first_install.payload_boundary.forbidden_authority,
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.framework_runtime_contracts,
    'gaofeng21cn/one-person-lab',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.research_domain_truth,
    'gaofeng21cn/med-autoscience',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.grant_domain_truth,
    'gaofeng21cn/med-autogrant',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.visual_deliverable_domain_truth,
    'gaofeng21cn/redcube-ai',
  );
  assert.match(
    mod.buildFullFirstInstallReadme({
      version: '26.5.15',
      dmgName: 'One-Person-Lab-Full-26.5.15-mac-arm64.dmg',
      runtimeTarName: null,
      notarized: false,
    }),
    /Full 包只负责组装和校验已声明的 framework\/runtime、domain module 与 companion tool payload/,
  );
});
