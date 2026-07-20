import {
  assert,
  fs,
  os,
  path,
  test,
  runNode,
  writeFile,
  writeExecutable,
  writeFakeReleaseNotesAiWriter,
  stableInstallCommand,
  validStandardAiReleaseNotes,
  writeReleaseMetadata,
  writeStandardLocalAuthorizationPolicy,
  writeFakeMacosTrustCommands,
  buildRemoteReleaseView,
  writeStandardRemoteAssets,
  writeFullRemoteAssets,
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

test('publish retains a failed draft and writes a typed recovery receipt without deleting release or tag', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const binDir = path.join(tempRoot, 'bin');
  const ghLogPath = path.join(tempRoot, 'gh.log');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const recoveryReceiptPath = path.join(tempRoot, 'release-publish-recovery-receipt.json');
  const version = '26.5.15';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;

  writeFile(path.join(outDir, dmgName));
  writeFile(path.join(outDir, `One-Person-Lab-${version}-mac-arm64.zip`));
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(outDir);
  writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));
  writeExecutable(path.join(binDir, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
process.exit(args[0] === 'release' && args[1] === 'upload' ? 1 : 0);
`);

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
      OPL_RELEASE_EXISTS: '0',
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

  const publishArgs = [
    'scripts/publish-release.ts',
    '--no-build',
    '--draft',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ];
  const publishEnv = {
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    FAKE_GH_LOG: ghLogPath,
    OPL_RELEASE_NOTES_MODE: 'template',
    OPL_RELEASE_UPLOAD_ATTEMPTS: '1',
    OPL_RELEASE_PUBLISH_RECOVERY_RECEIPT_PATH: recoveryReceiptPath,
    OPL_RELEASE_TEST_MODE: '1',
    OPL_RELEASE_MUTATION_STATE_JSON: JSON.stringify({
      tagName: `v${version}`,
      isDraft: true,
      isPrerelease: false,
      publishedAt: null,
    }),
  };
  const newReleaseFailure = runNode(publishArgs, {
    env: { ...publishEnv, OPL_RELEASE_EXISTS: '0' },
  });
  assert.notEqual(newReleaseFailure.status, 0);
  const newReleaseCommands = fs.readFileSync(ghLogPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const newReleaseLifecycle = newReleaseCommands.filter((args) => ['create', 'upload', 'delete'].includes(args[1]));
  assert.deepEqual(newReleaseLifecycle.map((args) => args.slice(0, 2)), [
    ['release', 'create'],
    ['release', 'upload'],
  ]);
  assert.equal(newReleaseLifecycle[1].includes('--clobber'), false);
  assert.doesNotMatch(fs.readFileSync(ghLogPath, 'utf8'), /cleanup-tag|\["release","delete"/);
  assert.match(newReleaseFailure.stderr, /The release was not deleted/);
  const newReleaseRecovery = JSON.parse(fs.readFileSync(recoveryReceiptPath, 'utf8'));
  assert.equal(newReleaseRecovery.schema, 'opl_app_release_publish_recovery_receipt.v1');
  assert.equal(newReleaseRecovery.status, 'incomplete_draft');
  assert.equal(newReleaseRecovery.failure.stage, 'upload_assets');
  assert.equal(newReleaseRecovery.failure.failed_asset, newReleaseRecovery.upload.planned_assets[0].name);
  assert.ok(newReleaseRecovery.upload.planned_assets.some((asset) => asset.name === dmgName));
  assert.equal(newReleaseRecovery.draft.origin, 'created_by_current_publish_invocation');
  assert.equal(newReleaseRecovery.draft.readback, 'incomplete_draft_confirmed');
  assert.equal(newReleaseRecovery.draft.automatic_release_delete_attempted, false);
  assert.equal(newReleaseRecovery.draft.automatic_tag_cleanup_attempted, false);
  assert.equal(newReleaseRecovery.recovery.strategy, 'read_back_then_resume_same_draft_same_cohort');
  assert.equal(newReleaseRecovery.recovery.brokered_cleanup_mutation_available, false);
  assert.equal(newReleaseRecovery.recovery.cleanup_authorization.required_mutation, 'release_draft_cleanup');
  assert.equal(newReleaseRecovery.recovery.cleanup_authorization.release_attempt_id_required, true);
  assert.equal(newReleaseRecovery.recovery.cleanup_authorization.broker_acceptance_receipt_required, true);
  assert.equal(
    newReleaseRecovery.recovery.cleanup_authorization.availability,
    'unavailable_until_broker_cleanup_mutation_is_provisioned',
  );

  fs.writeFileSync(ghLogPath, '', 'utf8');
  const existingReleaseFailure = runNode(publishArgs, {
    env: {
      ...publishEnv,
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_IS_DRAFT: '1',
      OPL_RELEASE_EXISTING_ASSETS_JSON: '[]',
    },
  });
  assert.notEqual(existingReleaseFailure.status, 0);
  const existingReleaseCommands = fs.readFileSync(ghLogPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const existingReleaseLifecycle = existingReleaseCommands.filter((args) => ['create', 'upload', 'delete'].includes(args[1]));
  assert.deepEqual(existingReleaseLifecycle.map((args) => args.slice(0, 2)), [['release', 'upload']]);
  assert.equal(existingReleaseLifecycle[0].includes('--clobber'), true);
  const existingReleaseRecovery = JSON.parse(fs.readFileSync(recoveryReceiptPath, 'utf8'));
  assert.equal(existingReleaseRecovery.status, 'incomplete_draft');
  assert.equal(existingReleaseRecovery.draft.origin, 'preexisting_mutable_draft');
  assert.equal(existingReleaseRecovery.draft.automatic_release_delete_attempted, false);
  assert.equal(existingReleaseRecovery.draft.automatic_tag_cleanup_attempted, false);
});

test('publish refuses to replace an already published Stable or prerelease release', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-immutable-release-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.16';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  writeFile(path.join(releaseAssetsDir, dmgName));
  writeFile(path.join(releaseAssetsDir, zipName));
  writeFile(path.join(releaseAssetsDir, `${zipName}.blockmap`));
  writeReleaseMetadata(releaseAssetsDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(releaseAssetsDir);

  for (const [label, state] of [
    ['stable', { tagName: `v${version}`, isDraft: false, isPrerelease: false, publishedAt: '2026-05-16T00:00:00Z' }],
    ['prerelease', { tagName: `v${version}`, isDraft: false, isPrerelease: true, publishedAt: '2026-05-16T00:00:00Z' }],
  ]) {
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
        OPL_RELEASE_STATE_JSON: JSON.stringify(state),
        OPL_RELEASE_NOTES_MODE: 'template',
      },
    });
    assert.notEqual(result.status, 0, `${label} release mutation should fail`);
    assert.match(result.stderr, new RegExp(`already published ${label} release and is immutable`));
  }

  const promotedBetweenPlanAndUpload = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--draft',
    '--standard-artifacts-dir',
    releaseAssetsDir,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_STATE_JSON: JSON.stringify({
        tagName: `v${version}`,
        isDraft: true,
        isPrerelease: false,
        publishedAt: null,
      }),
      OPL_RELEASE_MUTATION_STATE_JSON: JSON.stringify({
        tagName: `v${version}`,
        isDraft: false,
        isPrerelease: false,
        publishedAt: '2026-05-16T00:01:00Z',
      }),
      OPL_RELEASE_EXISTING_ASSETS_JSON: '[]',
      OPL_RELEASE_NOTES_MODE: 'template',
      OPL_RELEASE_PUBLISH_RECOVERY_RECEIPT_PATH: path.join(tempRoot, 'promoted-race-recovery-receipt.json'),
      OPL_RELEASE_TEST_MODE: '1',
    },
  });
  assert.notEqual(promotedBetweenPlanAndUpload.status, 0);
  assert.match(
    promotedBetweenPlanAndUpload.stderr,
    /already published stable release and is immutable/,
  );
});

test('publish rechecks the draft after notes and before any clobber upload', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-race-'));
  const fullDir = path.join(tempRoot, 'full');
  const binDir = path.join(tempRoot, 'bin');
  const ghLogPath = path.join(tempRoot, 'gh.log');
  const stateReadsPath = path.join(tempRoot, 'state-reads.txt');
  const version = '26.7.13';
  writeFullRemoteAssets(fullDir, version);
  const publicManifestPath = path.join(fullDir, 'opl-release-manifest.json');
  const publicManifest = JSON.parse(fs.readFileSync(publicManifestPath, 'utf8'));
  publicManifest.manifest.components = {
    ...publicManifest.manifest.components,
    mas: { ...publicManifest.manifest.components?.mas, git_commit: '1234567' },
    mag: { ...publicManifest.manifest.components?.mag, git_commit: '1234567' },
    rca: { ...publicManifest.manifest.components?.rca, git_commit: '1234567' },
    meta_agent: { ...publicManifest.manifest.components?.meta_agent, git_commit: '1234567' },
    officecli: { ...publicManifest.manifest.components?.officecli, version: '1.0.125' },
    mineru_open_api: { ...publicManifest.manifest.components?.mineru_open_api, version: 'v0.1.0' },
  };
  fs.writeFileSync(publicManifestPath, `${JSON.stringify(publicManifest, null, 2)}\n`);
  writeExecutable(path.join(binDir, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'release' && args[1] === 'view' && args.includes('tagName,isDraft,isPrerelease,publishedAt')) {
  const count = fs.existsSync(process.env.FAKE_GH_STATE_READS)
    ? Number(fs.readFileSync(process.env.FAKE_GH_STATE_READS, 'utf8'))
    : 0;
  fs.writeFileSync(process.env.FAKE_GH_STATE_READS, String(count + 1));
  process.stdout.write(JSON.stringify({
    tagName: 'v${version}',
    isDraft: count === 0,
    isPrerelease: false,
    publishedAt: count === 0 ? null : '2026-07-13T00:01:00Z',
  }));
}
process.exit(0);
`);

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullDir,
  ], {
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      FAKE_GH_LOG: ghLogPath,
      FAKE_GH_STATE_READS: stateReadsPath,
      OPL_RELEASE_PUBLISH_RECOVERY_RECEIPT_PATH: path.join(tempRoot, 'race-recovery-receipt.json'),
      OPL_RELEASE_STATE_JSON: JSON.stringify({
        tagName: `v${version}`,
        isDraft: true,
        isPrerelease: false,
        publishedAt: null,
      }),
      OPL_RELEASE_EXISTING_ASSETS_JSON: '[]',
      OPL_RELEASE_NOTES_MODE: 'template',
      OPL_RELEASE_UPLOAD_ATTEMPTS: '1',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /already published stable release and is immutable/);
  const commands = fs.readFileSync(ghLogPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  const mutations = commands.filter((args) => (
    (args[1] === 'view' && args.includes('tagName,isDraft,isPrerelease,publishedAt'))
    || args[1] === 'edit'
    || args[1] === 'upload'
  ));
  assert.deepEqual(mutations.map((args) => args[1]), ['view', 'edit', 'view', 'view']);
  assert.equal(mutations.some((args) => args[1] === 'upload'), false);
  assert.equal(mutations.some((args) => args.includes('--clobber')), false);
});

test('publish dry run accepts prebuilt standard release assets from GitHub Actions', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-prebuilt-release-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.15';
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
  assert.equal(payload.upload_command.includes('--clobber'), false);
  assert.ok(payload.upload_commands.every((command) => !command.includes('--clobber')));
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
