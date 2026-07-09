import {
  assert,
  fs,
  os,
  path,
  spawnSync,
  test,
  appRoot,
  runNode,
  writeFile,
  writeFakeReleaseNotesAiWriter,
  stableInstallCommand,
  validStandardAiReleaseNotes,
  writeReleaseMetadata,
  writeStandardLocalAuthorizationPolicy,
  writeFakeMacosTrustCommands,
  buildRemoteReleaseView,
  writeStandardRemoteAssets,
  writeFullRemoteAssets,
  walkFiles,
} from './helpers.ts';

function validFullReleaseNotes(version) {
  return `One Person Lab v${version}

This Stable release is for users installing or upgrading One Person Lab App. It focuses on making research, grant-writing, visual-deliverable, agent-design, Office, and document-intake work ready from one App install.

## Highlights
- Use one Stable install path for the App plus refreshed research, grant, visual, Office, and document-intake tools.
- Built-in research, grant-writing, visual deliverable, and agent-design entries have been refreshed for this release.

## What improved

### Built-in research, grant, and visual work
- Refreshed the built-in research, grant, visual deliverable, and agent-design entries used from the App.

## Compatibility and action required
- No manual migration is required beyond installing or upgrading this Stable release.
- Use the Full first-install package for a fresh machine that needs the bundled OPL family tools.

## Technical details
These details are included for operators who audit exactly what was packaged. They should not be needed for ordinary install or upgrade decisions.

## OPL agents and runtime payload
- Full first-install package includes the OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.
- Packaged component refs: OPL Framework @ 1234567; Codex CLI 0.142.4; MAS @ 1234567; MAG @ 1234567; RCA @ 1234567; OPL Meta Agent @ 1234567; OfficeCLI 1.0.125; MinerU v0.1.0.
- Component updates since previous Stable: MAS 0000000 -> 1234567.

## OPL family updates
- MAS: Research sessions make study and paper status clearer (1 commit, audit ref 0000000 -> 1234567).

## Install Stable
\`${stableInstallCommand}\`

## Release scope
- Standard macOS arm64 updater package plus Full first-install DMG.

**Full Changelog**: https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.6.29...v${version}
`;
}

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
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const version = '26.5.15-test';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;

  writeFile(path.join(outDir, dmgName));
  writeFile(path.join(outDir, `One-Person-Lab-${version}-mac-arm64.zip`));
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(outDir);
  writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_NOTES_MODE: 'ai',
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(payload.tag, `v${version}`);
  assert.equal(payload.release_notes_mode, 'ai');
  assert.ok(payload.artifacts.some((artifact) => artifact.endsWith(dmgName)));
});

test('publish dry run accepts prebuilt standard release assets from GitHub Actions', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-prebuilt-release-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.15-test';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    `version: ${version}`,
    'files:',
    `  - url: ${dmgName}`,
    '    sha512: test',
    '    size: 1',
    `path: ${dmgName}`,
    'sha512: test',
    '',
  ].join('\n');

  writeFile(path.join(releaseAssetsDir, dmgName));
  writeFile(path.join(releaseAssetsDir, zipName));
  writeFile(path.join(releaseAssetsDir, `${zipName}.blockmap`));
  writeFile(path.join(releaseAssetsDir, 'latest-arm64-mac.yml'), metadata);
  writeStandardLocalAuthorizationPolicy(releaseAssetsDir);

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--standard-artifacts-dir',
    releaseAssetsDir,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '0',
      OPL_RELEASE_NOTES_MODE: 'template',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.standard_artifacts_dir, releaseAssetsDir);
  assert.equal(payload.release_notes_mode, 'template');
  assert.ok(payload.standard_artifacts.some((artifact) => artifact.endsWith(dmgName)));
  assert.ok(payload.standard_artifacts.some((artifact) => artifact.endsWith('latest-arm64-mac.yml')));
  assert.ok(payload.upload_command.includes('--clobber'));
  assert.ok(payload.upload_commands.every((command) => command.includes('--clobber')));
  assert.equal(payload.upload_commands.length, payload.upload_command.filter((part) => String(part).startsWith(releaseAssetsDir)).length);
});

test('prebuilt standard release assets must include updater metadata', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-prebuilt-release-missing-metadata-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.15-test';

  writeFile(path.join(releaseAssetsDir, `One-Person-Lab-${version}-mac-arm64.dmg`));
  writeFile(path.join(releaseAssetsDir, `One-Person-Lab-${version}-mac-arm64.zip`));

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--standard-artifacts-dir',
    releaseAssetsDir,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '0',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /latest-arm64-mac\.yml/);
});

test('release asset validation fails before tagging when updater metadata keeps the shell version', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-shell-version-metadata-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.25';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    'version: 2.1.1',
    'files:',
    `  - url: ${zipName}`,
    '    sha512: test-zip',
    '    size: 1',
    `  - url: ${dmgName}`,
    '    sha512: test-dmg',
    '    size: 1',
    `path: ${zipName}`,
    'sha512: test-zip',
    '',
  ].join('\n');

  writeFile(path.join(releaseAssetsDir, dmgName));
  writeFile(path.join(releaseAssetsDir, zipName));
  writeFile(path.join(releaseAssetsDir, `${zipName}.blockmap`));
  writeFile(path.join(releaseAssetsDir, 'latest-arm64-mac.yml'), metadata);
  writeStandardLocalAuthorizationPolicy(releaseAssetsDir);
  writeFile(
    path.join(shellRoot, 'scripts', 'verify-release-assets.sh'),
    ['#!/usr/bin/env bash', 'exit 0', ''].join('\n'),
  );
  fs.chmodSync(path.join(shellRoot, 'scripts', 'verify-release-assets.sh'), 0o755);

  const result = runNode(['scripts/validate-release.ts', releaseAssetsDir], {
    env: {
      OPL_APP_SHELL_ROOT: shellRoot,
      OPL_RELEASE_VERSION: version,
    },
  });
  const validationOutput = `${result.stdout}${result.stderr}`;

  assert.notEqual(result.status, 0);
  assert.match(validationOutput, /latest-arm64-mac\.yml does not declare OPL release version 26\.5\.25/);
});

test('release asset preparation drops stale standard assets from older OPL versions', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-stale-assets-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const artifactsDir = path.join(tempRoot, 'artifacts');
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.28';
  const previousVersion = '26.5.27';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    `version: ${version}`,
    'files:',
    `  - url: ${zipName}`,
    '    sha512: test-zip',
    '    size: 1',
    `  - url: ${dmgName}`,
    '    sha512: test-dmg',
    '    size: 1',
    `path: ${zipName}`,
    'sha512: test-zip',
    '',
  ].join('\n');

  writeFile(
    path.join(shellRoot, 'scripts', 'prepare-release-assets.sh'),
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'rm -rf "$2"',
      'mkdir -p "$2"',
      'cp -f "$1"/* "$2"/',
      '',
    ].join('\n'),
  );
  fs.chmodSync(path.join(shellRoot, 'scripts', 'prepare-release-assets.sh'), 0o755);

  writeFile(path.join(artifactsDir, dmgName));
  writeFile(path.join(artifactsDir, zipName));
  writeFile(path.join(artifactsDir, `${dmgName}.blockmap`));
  writeFile(path.join(artifactsDir, `${zipName}.blockmap`));
  writeFile(
    path.join(artifactsDir, 'standard-local-authorization-policy.json'),
    `${JSON.stringify({
      schema: 'opl_local_authorized_macos_policy.v1',
      package_kind: 'app_standard',
      app_path: '/Applications/One Person Lab.app',
      codesign_status: 'passed',
      spctl_status: 'passed',
    }, null, 2)}\n`,
  );
  writeFile(path.join(artifactsDir, `One-Person-Lab-${previousVersion}-mac-arm64.dmg.blockmap`));
  writeFile(path.join(artifactsDir, `One-Person-Lab-${previousVersion}-mac-arm64.zip.blockmap`));
  writeFile(path.join(artifactsDir, 'latest-arm64-mac.yml'), metadata);

  const result = runNode(['scripts/prepare-release-assets.ts', artifactsDir, releaseAssetsDir], {
    env: {
      OPL_APP_SHELL_ROOT: shellRoot,
      OPL_RELEASE_VERSION: version,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(releaseAssetsDir).sort(), [
    dmgName,
    zipName,
    `${zipName}.blockmap`,
    'latest-arm64-mac.yml',
    'standard-local-authorization-policy.json',
  ]);
});

test('release asset preparation preserves App-owned local authorization policy when shell filters assets', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-policy-preserve-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const artifactsDir = path.join(tempRoot, 'artifacts');
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.6.5';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    `version: ${version}`,
    'files:',
    `  - url: ${zipName}`,
    '    sha512: test-zip',
    '    size: 1',
    `path: ${zipName}`,
    'sha512: test-zip',
    '',
  ].join('\n');

  writeFile(
    path.join(shellRoot, 'scripts', 'prepare-release-assets.sh'),
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'rm -rf "$2"',
      'mkdir -p "$2"',
      'cp -f "$1"/*.dmg "$2"/',
      'cp -f "$1"/*.zip "$2"/',
      'cp -f "$1"/*.blockmap "$2"/',
      'cp -f "$1"/*.yml "$2"/',
      '',
    ].join('\n'),
  );
  fs.chmodSync(path.join(shellRoot, 'scripts', 'prepare-release-assets.sh'), 0o755);

  writeFile(path.join(artifactsDir, dmgName));
  writeFile(path.join(artifactsDir, zipName));
  writeFile(path.join(artifactsDir, `${dmgName}.blockmap`));
  writeFile(path.join(artifactsDir, `${zipName}.blockmap`));
  writeFile(path.join(artifactsDir, 'latest-arm64-mac.yml'), metadata);
  writeFile(
    path.join(artifactsDir, 'standard-local-authorization-policy.json'),
    `${JSON.stringify({
      schema: 'opl_local_authorized_macos_policy.v1',
      package_kind: 'app_standard',
      stable_release_path: 'local_authorized_unsigned',
      apple_developer_id_required: false,
      gatekeeper_required: false,
      local_authorization_required: true,
      quarantine_removal_required: true,
      install_entrypoint: 'install.sh --stable-macos-install --yes',
      compatibility_entrypoints: ['install-stable.sh'],
      codesign_status: 'passed',
      spctl_status: 'rejected_allowed_unsigned',
      quarantine_status: 'absent',
    }, null, 2)}\n`,
  );

  const result = runNode(['scripts/prepare-release-assets.ts', artifactsDir, releaseAssetsDir], {
    env: {
      OPL_APP_SHELL_ROOT: shellRoot,
      OPL_RELEASE_VERSION: version,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(releaseAssetsDir, 'standard-local-authorization-policy.json')));
});

test('release asset preparation preserves local authorization policy from GitHub artifact subdirectory', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-policy-artifact-dir-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const artifactsDir = path.join(tempRoot, 'artifacts');
  const buildArtifactDir = path.join(artifactsDir, 'macos-build-arm64');
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.6.5';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    `version: ${version}`,
    'files:',
    `  - url: ${zipName}`,
    '    sha512: test-zip',
    '    size: 1',
    `path: ${zipName}`,
    'sha512: test-zip',
    '',
  ].join('\n');

  writeFile(
    path.join(shellRoot, 'scripts', 'prepare-release-assets.sh'),
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'rm -rf "$2"',
      'mkdir -p "$2"',
      'find "$1" -type f \\( -name "*.dmg" -o -name "*.zip" -o -name "*.blockmap" -o -name "*.yml" \\) -exec cp -f {} "$2"/ \\;',
      '',
    ].join('\n'),
  );
  fs.chmodSync(path.join(shellRoot, 'scripts', 'prepare-release-assets.sh'), 0o755);

  writeFile(path.join(buildArtifactDir, dmgName));
  writeFile(path.join(buildArtifactDir, zipName));
  writeFile(path.join(buildArtifactDir, `${dmgName}.blockmap`));
  writeFile(path.join(buildArtifactDir, `${zipName}.blockmap`));
  writeFile(path.join(buildArtifactDir, 'latest-arm64-mac.yml'), metadata);
  writeStandardLocalAuthorizationPolicy(buildArtifactDir);

  const result = runNode(['scripts/prepare-release-assets.ts', artifactsDir, releaseAssetsDir], {
    env: {
      OPL_APP_SHELL_ROOT: shellRoot,
      OPL_RELEASE_VERSION: version,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(releaseAssetsDir, 'standard-local-authorization-policy.json')));
});

test('remote release verifier validates standard and Full assets from GitHub release view', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-'));
  const binDir = path.join(tempRoot, 'bin');
  const version = '26.5.19-remote';
  const names = [
    ...writeStandardRemoteAssets(tempRoot, version),
    ...writeFullRemoteAssets(tempRoot, version),
  ];
  const summaryPath = path.join(tempRoot, 'remote-release-verification.json');
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`, validFullReleaseNotes(version));
  writeFakeMacosTrustCommands(binDir);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--summary-path',
    summaryPath,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(summary.tag, `v${version}`);
  assert.equal(summary.include_full_package, true);
  assert.equal(summary.download_dir, tempRoot);
  assert.equal(summary.verified_asset_count, names.length);
  assert.deepEqual(summary.verified_assets.map((asset) => asset.name), names);
  assert.ok(summary.verified_assets.some((asset) => asset.name === 'opl-release-manifest.json'));
  assert.ok(!summary.verified_assets.some((asset) => asset.name === 'full-package-manifest.json'));
  assert.equal(summary.standard_updater_app_bundle_trust.status, 'passed');
  assert.equal(summary.standard_updater_app_bundle_trust.version, version);
  assert.equal(summary.standard_updater_app_bundle_trust.team_identifier, 'TESTTEAMID');
  assert.equal(summary.standard_updater_app_bundle_trust.signature, 'Developer ID Application: Test (TESTTEAMID)');
  assert.equal(summary.standard_updater_app_bundle_trust.local_authorization_policy, 'standard-local-authorization-policy.json');
  assert.equal(summary.standard_updater_app_bundle_trust.apple_developer_id_required, false);
  assert.equal(summary.standard_updater_app_bundle_trust.gatekeeper_required, false);
  assert.equal(summary.release_notes.status, 'passed');
  assert.equal(summary.release_notes.body_length, validFullReleaseNotes(version).length);
  assert.equal(summary.full_first_install_budget.status, 'passed');
  assert.equal(summary.full_first_install_budget.platform_scope, 'macos-arm64');
  assert.equal(summary.full_first_install_budget.warning_full_dmg_bytes, 700000000);
  assert.equal(summary.full_first_install_budget.max_full_dmg_bytes, 750000000);
  assert.equal(summary.full_first_install_budget.full_dmg_size_bytes, Buffer.byteLength('full-dmg'));
  assert.equal(summary.full_first_install_budget.full_dmg_size_status, 'passed');
  assert.equal(summary.full_first_install_budget.runtime_uncompressed_bytes, 128);
  assert.deepEqual(summary.full_first_install_budget.warnings, []);
  assert.deepEqual(summary.full_first_install_budget.temporal_core_bridge_releases, ['aarch64-apple-darwin']);
  assert.equal(summary.full_first_install_budget.excluded_module_venv_count, 0);
  assert.equal(summary.full_first_install_budget.required_components.temporal_cli.version, 'temporal version 1.7.0');
  assert.equal(summary.full_first_install_budget.optional_components.bun.status, 'not_packaged');
});

test('remote release verifier rejects short Stable Full GitHub Release notes', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-short-notes-'));
  const binDir = path.join(tempRoot, 'bin');
  const version = '26.5.19-short-notes';
  const names = [
    ...writeStandardRemoteAssets(tempRoot, version),
    ...writeFullRemoteAssets(tempRoot, version),
  ];
  const releaseView = buildRemoteReleaseView(
    tempRoot,
    names,
    `v${version}`,
    [
      `# One Person Lab v${version}`,
      '',
      stableInstallCommand,
      '',
      'Standard macOS arm64 updater package plus Full first-install DMG.',
      '',
    ].join('\n'),
  );
  writeFakeMacosTrustCommands(binDir);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Stable Full GitHub Release notes are incomplete/);
  assert.match(result.stderr, /## What improved/);
  assert.match(result.stderr, /Packaged component refs:/);
});

test('remote release verifier rejects diagnostic-only files as public GitHub Release assets', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-diagnostics-assets-'));
  const binDir = path.join(tempRoot, 'bin');
  const version = '26.5.19-public-assets';
  const names = [
    ...writeStandardRemoteAssets(tempRoot, version),
    ...writeFullRemoteAssets(tempRoot, version),
  ];
  for (const name of [
    'full-package-size-summary.json',
    'full-workflow-telemetry.json',
    'standard-release-notes-evidence.json',
  ]) {
    writeFile(path.join(tempRoot, name), '{}\n');
    names.push(name);
  }
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);
  writeFakeMacosTrustCommands(binDir);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /diagnostic-only files/);
  assert.match(result.stderr, /full-package-size-summary\.json/);
  assert.match(result.stderr, /full-workflow-telemetry\.json/);
  assert.match(result.stderr, /standard-release-notes-evidence\.json/);
});

test('remote release verifier accepts ad-hoc signed standard updater app zips under local authorization policy', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-adhoc-'));
  const binDir = path.join(tempRoot, 'bin');
  const version = '26.5.19-adhoc';
  const names = writeStandardRemoteAssets(tempRoot, version);
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);
  writeFakeMacosTrustCommands(binDir, { teamIdentifier: 'not set', signature: 'adhoc' });

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, 'passed');
  assert.equal(summary.standard_updater_app_bundle_trust.status, 'local_authorized_unsigned');
  assert.equal(summary.standard_updater_app_bundle_trust.signature, 'adhoc');
  assert.equal(summary.standard_updater_app_bundle_trust.team_identifier, 'not set');
});

test('remote release verifier fails closed when Full runtime assertions are missing or broad', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-runtime-assertions-'));
  const binDir = path.join(tempRoot, 'bin');
  const version = '26.5.19-runtime-assertions';
  const names = writeStandardRemoteAssets(tempRoot, version);
  names.push(...writeFullRemoteAssets(tempRoot, version, {
    manifest: {
      runtime_assertions: {
        temporal_core_bridge_releases: ['aarch64-apple-darwin', 'x86_64-apple-darwin'],
        excluded_module_venv_count: 1,
      },
    },
  }));
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);
  writeFakeMacosTrustCommands(binDir);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Temporal core-bridge releases must be only aarch64-apple-darwin/);
});

test('remote release verifier fails closed when the Full runtime currentness probe did not pass', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-runtime-currentness-'));
  const binDir = path.join(tempRoot, 'bin');
  const version = '26.5.19-runtime-currentness';
  const names = writeStandardRemoteAssets(tempRoot, version);
  names.push(...writeFullRemoteAssets(tempRoot, version, {
    currentnessProbe: {
      status: 'failed',
      managed_update_surface_id: 'codex_passthrough',
    },
  }));
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);
  writeFakeMacosTrustCommands(binDir);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Full runtime currentness probe did not pass/);
});

test('remote release verifier rejects standard updater metadata that references Full assets', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-full-leak-'));
  const version = '26.5.19-remote-leak';
  const names = writeStandardRemoteAssets(tempRoot, version, { fullLeak: true });
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /latest-arm64-mac\.yml references Full first-install assets/);
});

test('remote release verifier warns when Full DMG review threshold is exceeded', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-budget-'));
  const binDir = path.join(tempRoot, 'bin');
  const version = '26.5.19-budget';
  const names = [
    ...writeStandardRemoteAssets(tempRoot, version),
    ...writeFullRemoteAssets(tempRoot, version, {
      dmgContent: 'oversized-full-dmg',
      manifest: {
        size_budget: {
          platform_scope: 'macos-arm64',
          warning_full_dmg_bytes: 1,
          max_full_dmg_bytes: 4,
          max_runtime_uncompressed_bytes: 1000000000,
        },
      },
    }),
  ];
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);
  const summaryPath = path.join(tempRoot, 'remote-release-verification.json');
  writeFakeMacosTrustCommands(binDir);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--summary-path',
    summaryPath,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.full_first_install_budget.full_dmg_size_status, 'warning');
  assert.deepEqual(summary.full_first_install_budget.warnings.map((warning) => warning.code), [
    'full_dmg_size_above_review_threshold',
  ]);
});
