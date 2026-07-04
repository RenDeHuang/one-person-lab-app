import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  activeShellRoot,
  sha256,
  workflowJobBlock,
  readFullPackageBuilderSource,
} from '../helpers.ts';

test('release artifact upload preserves electron-updater blockmaps', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');

  assert.match(workflow, /find out\/ -type f[\s\S]*-name "\*\.blockmap"/);
  assert.match(workflow, /shells\/aionui\/out\/\*\.blockmap/);
});

test('stable release workflow publishes only macOS arm64 standard assets', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const standardBuild = workflowJobBlock(workflow, 'standard-build');
  const publishStandard = workflowJobBlock(workflow, 'publish-standard');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(standardBuild, /"platform":"macos-arm64"/);
  assert.match(standardBuild, /"command":"node scripts\/build-with-builder\.js arm64 --mac --arm64"/);
  assert.match(standardBuild, /"artifact-name":"macos-build-arm64"/);
  assert.doesNotMatch(standardBuild, /"platform":"windows-/);
  assert.doesNotMatch(standardBuild, /"platform":"linux-/);
  assert.doesNotMatch(standardBuild, /"platform":"macos-universal"/);
  assert.equal(packageJson.scripts['build-mac:arm64'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-mac:arm64');
  assert.equal(packageJson.scripts['build-mac'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-mac');
  assert.equal(packageJson.scripts['build-mac:x64'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-mac:x64');
  assert.equal(packageJson.scripts['build-win'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-win');
  assert.equal(packageJson.scripts['build-deb'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-deb');
  assert.deepEqual(releaseContract.standard_updater.allowed_metadata, [
    'latest-arm64-mac.yml',
  ]);
  assert.deepEqual(releaseContract.standard_updater.legacy_metadata, [
    'latest-mac.yml',
  ]);
  assert.deepEqual(releaseContract.standard_updater.allowed_assets, [
    'One-Person-Lab-*-mac-arm64.dmg',
    'One-Person-Lab-*-mac-arm64.zip',
    'One-Person-Lab-*-mac-arm64.zip.blockmap',
  ]);
  assert.deepEqual(releaseContract.standard_updater.dmg_compression, {
    default_format: 'ULFO',
    format_owner: 'shells/aionui/packages/desktop/electron-builder.yml#dmg.format',
    electron_builder_version: '26.8.1',
    electron_builder_supported_formats: ['UDBZ', 'UDCO', 'UDRO', 'UDRW', 'UDZO', 'ULFO'],
    ulmo_standard_default_allowed: false,
    ulmo_postprocess_status: 'separate_experiment_required',
    metadata_blockmap_gate: 'node --experimental-strip-types scripts/validate-release.ts release-assets plus focused hdiutil imageinfo/verify readback from a standard macOS build artifact',
    rule: 'Standard macOS DMG uses electron-builder-supported ULFO by default because electron-builder 26.8.1 does not accept ULMO in dmg.format. ULMO for standard assets requires a separate postprocess patch that proves canonical updater metadata, ZIP blockmap, and latest-arm64-mac.yml still match the published assets before it can replace the default; latest-mac.yml and DMG blockmap files are legacy compatibility assets only when deliberately published.',
  });
  assert.equal(releaseContract.standard_updater.scope, 'desktop_app_assets_only');
  assert.deepEqual(releaseContract.standard_updater.apply_lifecycle, {
    downloaded_state_is_not_success: true,
    states: [
      'update_available',
      'update_download_started',
      'update_downloaded',
      'update_apply_started',
      'update_apply_completed',
      'running_version_switched',
      'apply_failed_recovery_available',
    ],
    apply_started_receipt: 'auto-update-diagnostics.json#quit-and-install',
    post_restart_version_gate: 'running_app_version_must_be_gte_downloaded_target_version',
    failure_state: 'install-not-applied',
    recovery: {
      cache_policy: 'keep_downloaded_zip_for_retry_or_reveal',
      primary_action: 'install_downloaded_update_now',
      diagnostic_ref: 'auto-update-diagnostics.json#install-not-applied',
    },
  });
  assert.equal(releaseContract.standard_updater.module_package_update_allowed, false);
  assert.equal(releaseContract.standard_updater.developer_checkout_selection_allowed, false);
  assert.equal(releaseContract.standard_updater.opl_flow_install_allowed, false);
  assert.match(publishStandard, /node --experimental-strip-types scripts\/prepare-release-assets\.ts build-artifacts release-assets/);
  assert.match(publishStandard, /node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(publishStandard, /npm run release:publish --[\s\S]*--standard-artifacts-dir release-assets/);
  assert.match(publishStandard, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(publishStandard, /models: read/);
  assert.doesNotMatch(publishStandard, /Install Codex release-note writer/);
  assert.doesNotMatch(publishStandard, /Configure Codex release-note writer/);
  assert.match(publishStandard, /OPL_RELEASE_NOTES_PROVIDER: auto/);
  assert.match(publishStandard, /OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL/);
  assert.doesNotMatch(publishStandard, /OPL_RELEASE_NOTES_GITHUB_MODEL:/);
  assert.doesNotMatch(publishStandard, /setup-release-notes-codex-config/);
  assert.doesNotMatch(publishStandard, /OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/);
  assert.match(publishStandard, /standard-release-notes-evidence-\$\{\{ inputs\.opl_version \}\}/);
  assert.doesNotMatch(publishStandard, /generate_release_notes: true/);
  assert.doesNotMatch(publishStandard, /release-assets\/\*\*\/\*\.exe/);
  assert.doesNotMatch(publishStandard, /release-assets\/\*\*\/\*\.msi/);
  assert.doesNotMatch(publishStandard, /release-assets\/\*\*\/\*\.deb/);

  const shellBuildScript = fs.readFileSync(path.join(activeShellRoot, 'scripts', 'build-with-builder.js'), 'utf8');
  assert.match(shellBuildScript, /function normalizeBuilderTargetArgs\(rawBuilderArgs\)/);
  assert.match(shellBuildScript, /parts\.splice\(macIndex \+ 1, 0, 'dmg', 'zip'\)/);
  assert.match(shellBuildScript, /normalizeBuilderTargetArgs\(builderArgs\)/);
});
