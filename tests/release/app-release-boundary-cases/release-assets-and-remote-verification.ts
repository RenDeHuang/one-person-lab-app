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
