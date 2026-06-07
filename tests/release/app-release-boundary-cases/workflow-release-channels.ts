import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  sha256,
  workflowJobBlock,
  readFullPackageBuilderSource,
} from './helpers.ts';

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
    'latest-mac.yml',
    'latest-arm64-mac.yml',
  ]);
  assert.deepEqual(releaseContract.standard_updater.allowed_assets, [
    'One-Person-Lab-*-mac-arm64.dmg',
    'One-Person-Lab-*-mac-arm64.zip',
    'One-Person-Lab-*-mac-arm64.dmg.blockmap',
    'One-Person-Lab-*-mac-arm64.zip.blockmap',
  ]);
  assert.equal(releaseContract.standard_updater.scope, 'desktop_app_assets_only');
  assert.equal(releaseContract.standard_updater.module_package_update_allowed, false);
  assert.equal(releaseContract.standard_updater.developer_checkout_selection_allowed, false);
  assert.equal(releaseContract.standard_updater.opl_flow_install_allowed, false);
  assert.match(publishStandard, /node --experimental-strip-types scripts\/prepare-release-assets\.ts build-artifacts release-assets/);
  assert.match(publishStandard, /node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(publishStandard, /npm run release:publish --[\s\S]*--standard-artifacts-dir release-assets/);
  assert.match(publishStandard, /Install Codex release-note writer/);
  assert.match(publishStandard, /npm install -g @openai\/codex@latest/);
  assert.match(workflow, /models: read/);
  assert.match(publishStandard, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(publishStandard, /OPL_RELEASE_NOTES_PROVIDER: auto/);
  assert.match(publishStandard, /OPL_RELEASE_NOTES_GITHUB_MODEL: \$\{\{ vars\.OPL_RELEASE_NOTES_GITHUB_MODEL \|\| 'openai\/gpt-5-mini' \}\}/);
  assert.match(publishStandard, /Configure Codex release-note writer/);
  assert.match(publishStandard, /CODEX_HOME: \$\{\{ runner\.temp \}\}\/release-notes-codex-home/);
  assert.match(publishStandard, /OPL_RELEASE_NOTES_CODEX_PROVIDER: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_PROVIDER \|\| 'gflab' \}\}/);
  assert.match(publishStandard, /OPL_RELEASE_NOTES_CODEX_BASE_URL: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_BASE_URL \}\}/);
  assert.match(publishStandard, /OPL_RELEASE_NOTES_CODEX_API_KEY: \$\{\{ secrets\.OPL_RELEASE_NOTES_CODEX_API_KEY \}\}/);
  assert.match(publishStandard, /OPL_RELEASE_NOTES_CODEX_WIRE_API: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_WIRE_API \|\| 'responses' \}\}/);
  assert.match(publishStandard, /OPL_RELEASE_NOTES_MODEL: \$\{\{ vars\.OPL_RELEASE_NOTES_MODEL \}\}/);
  assert.match(publishStandard, /node --experimental-strip-types scripts\/setup-release-notes-codex-config\.ts/);
  assert.doesNotMatch(publishStandard, /OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/);
  assert.match(publishStandard, /standard-release-notes-evidence-\$\{\{ inputs\.opl_version \}\}/);
  assert.doesNotMatch(publishStandard, /generate_release_notes: true/);
  assert.doesNotMatch(publishStandard, /release-assets\/\*\*\/\*\.exe/);
  assert.doesNotMatch(publishStandard, /release-assets\/\*\*\/\*\.msi/);
  assert.doesNotMatch(publishStandard, /release-assets\/\*\*\/\*\.deb/);
});

test('manual desktop release workflow supports new releases and same-tag refreshes in GitHub Actions', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const fullWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');
  const fullPackageScript = readFullPackageBuilderSource();
  const vmWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'opl-first-run-vm.yml'), 'utf8');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(workflow, /name: OPL Desktop Release/);
  assert.match(workflow, /release-preflight:/);
  assert.match(workflow, /name: Release preflight/);
  assert.match(workflow, /npm run release:preflight --/);
  assert.match(workflow, /release-preflight-summary\.json/);
  assert.match(workflow, /release-preflight-summary\.md/);
  assert.match(workflow, /standard-build:[\s\S]*needs: release-preflight/);
  assert.match(workflow, /full-first-install:[\s\S]*needs: release-preflight/);
  assert.match(workflow, /release_mode:[\s\S]*refresh_existing[\s\S]*new_release[\s\S]*draft_candidate/);
  assert.match(workflow, /permissions:[\s\S]*packages: write/);
  assert.match(workflow, /shell_ref:[\s\S]*description: opl-aion-shell ref to build and verify/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml[\s\S]*shell_ref: \$\{\{ inputs\.shell_ref \}\}/);
  const reusableWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  assert.match(reusableWorkflow, /macos-signing-preflight:/);
  assert.match(reusableWorkflow, /name: macOS release signing preflight/);
  assert.match(reusableWorkflow, /Missing GitHub Actions secrets: \$\{missing_csv\}/);
  assert.match(reusableWorkflow, /BUILD_CERTIFICATE_BASE64 P12_PASSWORD APPLE_ID APPLE_ID_PASSWORD TEAM_ID IDENTITY/);
  assert.match(reusableWorkflow, /build:[\s\S]*needs:[\s\S]*macos-signing-preflight/);
  assert.match(workflow, /node --experimental-strip-types scripts\/prepare-release-assets\.ts build-artifacts release-assets/);
  assert.match(workflow, /name: Verify standard release assets[\s\S]*OPL_RELEASE_VERSION: \$\{\{ inputs\.opl_version \}\}[\s\S]*node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /Install Codex release-note writer/);
  assert.match(workflow, /npm install -g @openai\/codex@latest/);
  assert.match(workflow, /models: read/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_PROVIDER: auto/);
  assert.match(workflow, /OPL_RELEASE_NOTES_GITHUB_MODEL: \$\{\{ vars\.OPL_RELEASE_NOTES_GITHUB_MODEL \|\| 'openai\/gpt-5-mini' \}\}/);
  assert.match(workflow, /Configure Codex release-note writer/);
  assert.match(workflow, /CODEX_HOME: \$\{\{ runner\.temp \}\}\/release-notes-codex-home/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_PROVIDER: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_PROVIDER \|\| 'gflab' \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_BASE_URL: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_BASE_URL \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_API_KEY: \$\{\{ secrets\.OPL_RELEASE_NOTES_CODEX_API_KEY \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_WIRE_API: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_WIRE_API \|\| 'responses' \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_MODEL: \$\{\{ vars\.OPL_RELEASE_NOTES_MODEL \}\}/);
  assert.match(workflow, /node --experimental-strip-types scripts\/setup-release-notes-codex-config\.ts/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_EVIDENCE_OUTPUT: \$\{\{ runner\.temp \}\}\/standard-release-notes-evidence\.json/);
  assert.match(workflow, /standard-release-notes-evidence-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /full-release-notes-evidence-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /git tag "\$tag" "\$GITHUB_SHA"/);
  assert.match(workflow, /--standard-artifacts-dir release-assets/);
  assert.match(workflow, /if \[ "\$RELEASE_MODE" = "new_release" \] \|\| \[ "\$RELEASE_MODE" = "draft_candidate" \]; then[\s\S]*publish_args\+=\(--draft\)/);
  assert.match(workflow, /remote-verify-standard:/);
  assert.match(workflow, /remote-verify-full:/);
  assert.match(workflow, /npm run verify-remote-release/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml[\s\S]*shell_ref: \$\{\{ inputs\.shell_ref \}\}/);
  assert.match(workflow, /publish_to_release: false/);
  assert.match(workflow, /publish-full-assets:/);
  assert.match(workflow, /--full-package-dir full-package-artifacts/);
  assert.match(workflow, /remote-verify-full:[\s\S]*needs: publish-full-assets/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-full:[\s\S]*needs: publish-standard/);
  assert.match(workflow, /run_vm_smoke:/);
  assert.match(workflow, /default: true/);
  assert.match(workflow, /guide_screenshots:[\s\S]*Capture user-guide screenshots/);
  assert.match(workflow, /permissions:[\s\S]*packages: write/);
  assert.doesNotMatch(workflow, /pull-requests: read/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-standard-only:/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-full:/);
  assert.match(workflow, /stable-homebrew-tap-update:/);
  assert.match(workflow, /stable-homebrew-tap-update:[\s\S]*uses: \.\/\.github\/workflows\/homebrew-tap-update\.yml/);
  assert.match(workflow, /full-homebrew-tap-update:/);
  assert.match(workflow, /full-homebrew-tap-update:[\s\S]*needs:[\s\S]*stable-homebrew-tap-update[\s\S]*remote-verify-full/);
  assert.match(workflow, /full-homebrew-tap-update:[\s\S]*package_kind: app_full_first_install/);
  assert.match(workflow, /homebrew-standard-first-run-vm-smoke:[\s\S]*needs:[\s\S]*stable-homebrew-tap-update[\s\S]*full-homebrew-tap-update/);
  assert.match(workflow, /homebrew-standard-first-run-vm-smoke:[\s\S]*needs\.stable-homebrew-tap-update\.result == 'success'/);
  assert.match(workflow, /homebrew-standard-first-run-vm-smoke:[\s\S]*needs\.full-homebrew-tap-update\.result == 'success'/);
  assert.match(workflow, /homebrew-standard-first-run-vm-smoke:/);
  assert.match(workflow, /full-first-run-vm-smoke:/);
  assert.match(workflow, /one-shot-app-installer-smoke:/);
  assert.match(workflow, /docker-webui-smoke:/);
  assert.match(workflow, /webui-ghcr-publish:/);
  assert.match(workflow, /OPL_INSTALL_SCRIPT_URL: file:\/\/\$\{\{ github\.workspace \}\}\/one-person-lab\/install\.sh/);
  assert.match(workflow, /\.\/install\.sh --complete --skip-modules/);
  assert.match(workflow, /docker build[\s\S]*--label "org\.opencontainers\.image\.source=https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}"[\s\S]*-t "one-person-lab-webui:\$\{\{ inputs\.opl_version \}\}"[\s\S]*shells\/aionui/);
  assert.match(workflow, /curl -fsS "http:\/\/127\.0\.0\.1:\$\{port\}\/manifest\.webmanifest"/);
  assert.match(workflow, /docker login ghcr\.io -u "\$GITHUB_ACTOR" --password-stdin/);
  assert.match(workflow, /ghcr\.io\/\$\{image_owner\}\/one-person-lab-webui/);
  assert.match(workflow, /write_publish_summary "failed" "ghcr_write_package_denied"/);
  assert.match(workflow, /required_actions_access_repository: 'gaofeng21cn\/one-person-lab-app'/);
  assert.match(workflow, /source_repository: 'https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}'/);
  assert.match(workflow, /"\$\{ghcr_image\}:\$\{\{ inputs\.opl_version \}\}"/);
  assert.match(workflow, /"\$\{ghcr_image\}:stable"/);
  assert.match(workflow, /"\$\{ghcr_image\}:latest"/);
  assert.match(workflow, /RELEASE_MODE.*draft_candidate/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/opl-first-run-vm\.yml/);
  assert.match(workflow, /release_tag: v\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/opl-first-run-vm\.yml[\s\S]*shell_ref: \$\{\{ inputs\.shell_ref \}\}/);
  assert.match(workflow, /release_artifact_name: macos-build-arm64/);
  assert.match(workflow, /release_artifact_name: opl-full-first-install-\$\{\{ inputs\.opl_version \}\}-mac-arm64/);
  assert.match(workflow, /package_profile: standard/);
  assert.match(workflow, /package_profile: full/);
  assert.match(workflow, /package_profile: homebrew-standard/);
  assert.match(workflow, /opl-first-run-vm-homebrew-standard-\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /homebrew-tap-plan-stable-app_full_first_install-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /guide_screenshots: \$\{\{ inputs\.guide_screenshots \}\}/);
  assert.match(fullWorkflow, /workflow_call:/);
  const fullWorkflowCallBlock = fullWorkflow.match(/\n  workflow_call:[\s\S]*?\npermissions:/)?.[0] ?? '';
  assert.doesNotMatch(fullWorkflowCallBlock, /secrets:[\s\S]*GH_TOKEN:/);
  assert.match(fullWorkflow, /shell_ref:[\s\S]*description: opl-aion-shell ref to bundle/);
  assert.match(fullWorkflow, /name: Checkout active shell[\s\S]*ref: \$\{\{ inputs\.shell_ref \|\| 'main' \}\}/);
  assert.match(fullWorkflow, /name: Checkout OPL Meta Agent/);
  assert.match(fullWorkflow, /repository: gaofeng21cn\/opl-meta-agent/);
  assert.match(fullWorkflow, /path: opl-meta-agent/);
  assert.match(fullWorkflow, /name: Checkout MinerU Ecosystem/);
  assert.match(fullWorkflow, /repository: opendatalab\/MinerU-Ecosystem/);
  assert.match(fullWorkflow, /path: MinerU-Ecosystem/);
  assert.match(fullWorkflow, /uses: actions\/setup-go@v6/);
  assert.match(fullWorkflow, /go-version: '1\.26\.x'/);
  assert.match(fullWorkflow, /mineru_root="\$GITHUB_WORKSPACE\/MinerU-Ecosystem\/cli\/mineru-open-api"/);
  assert.match(fullWorkflow, /go install -ldflags/);
  assert.match(fullWorkflow, /MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.version=\$mineru_version/);
  assert.match(fullWorkflow, /echo "\$HOME\/go\/bin" >> "\$GITHUB_PATH"/);
  assert.match(fullWorkflow, /OPL_FULL_META_AGENT_ROOT="\$GITHUB_WORKSPACE\/opl-meta-agent"/);
  assert.match(fullWorkflow, /OPL_FULL_MINERU_OPEN_API_BIN/);
  assert.match(fullWorkflow, /assets\/companion-skills\/mineru-document-extractor/);
  assert.match(fullPackageScript, /assets', 'companion-skills', 'mineru-document-extractor/);
  assert.ok(
    fs.existsSync(path.join(appRoot, 'assets', 'companion-skills', 'mineru-document-extractor', 'SKILL.md')),
  );
  assert.match(vmWorkflow, /workflow_call:/);
  assert.match(vmWorkflow, /shell_ref:[\s\S]*description: 'opl-aion-shell ref containing the first-run smoke scripts/);
  assert.match(vmWorkflow, /name: Checkout active shell[\s\S]*ref: \$\{\{ inputs\.shell_ref \|\| 'main' \}\}/);
  assert.match(vmWorkflow, /release_artifact_name:/);
  assert.match(vmWorkflow, /actions\/download-artifact@v8/);
  assert.match(vmWorkflow, /Using same-run workflow artifact/);
  assert.match(vmWorkflow, /release tag \$\{\{ inputs\.release_tag \}\} kept for provenance/);
  assert.match(vmWorkflow, /fetch_release_metadata_with_retry\(\)/);
  assert.match(vmWorkflow, /Release metadata fetch failed on attempt \$attempt/);
  assert.match(vmWorkflow, /download_asset_with_retry\(\)/);
  assert.match(vmWorkflow, /download_release_with_retry\(\)/);
  assert.match(vmWorkflow, /max_attempts=8/);
  assert.match(vmWorkflow, /Resolved release DMG asset: \$asset_name/);
  assert.match(vmWorkflow, /Release DMG asset download failed on attempt \$attempt/);
  assert.match(vmWorkflow, /curl -fL --retry 5 --retry-all-errors --retry-delay 10 --connect-timeout 30 --max-time 1800 --continue-at -/);
  assert.match(vmWorkflow, /Resolve host Node\.js runtime for guest smoke/);
  assert.match(vmWorkflow, /os\.path\.realpath/);
  assert.match(vmWorkflow, /--guest-node-root "\$\{\{ steps\.host_node\.outputs\.node_root \}\}"/);
  assert.match(vmWorkflow, /schedule:/);
  assert.match(vmWorkflow, /concurrency:/);
  assert.match(vmWorkflow, /github\.event_name == 'schedule'/);
  assert.match(vmWorkflow, /opl-gui-first-run-vm-scheduled/);
  assert.match(vmWorkflow, /format\('opl-gui-first-run-vm-\{0\}-\{1\}'/);
  assert.match(vmWorkflow, /github\.run_id/);
  assert.match(vmWorkflow, /inputs\.package_profile \|\| 'full'/);
  assert.doesNotMatch(vmWorkflow, /opl-gui-first-run-vm-manual/);
  assert.match(vmWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'schedule' \}\}/);
  assert.match(vmWorkflow, /Resolve Tart source VM/);
  assert.match(vmWorkflow, /package_profile:/);
  assert.match(vmWorkflow, /homebrew-standard/);
  assert.match(vmWorkflow, /guide_screenshots:/);
  assert.match(vmWorkflow, /Resolve package profile/);
  assert.match(vmWorkflow, /Set workflow input tart_source_vm or repository variable OPL_FIRST_RUN_TART_SOURCE/);
  assert.match(vmWorkflow, /OPL_FIRST_RUN_HOMEBREW_TART_SOURCE/);
  assert.match(vmWorkflow, /package_profile=homebrew-standard/);
  assert.match(vmWorkflow, /source_vm=\$SOURCE_VM/);
  assert.doesNotMatch(vmWorkflow, /skip_smoke=true/);
  assert.doesNotMatch(vmWorkflow, /steps\.scheduled_config\.outputs\.skip_smoke != 'true'/);
  assert.match(vmWorkflow, /One-Person-Lab-Full-\*-mac-arm64\.dmg/);
  assert.match(vmWorkflow, /One-Person-Lab-\*-mac-arm64\.dmg/);
  assert.match(vmWorkflow, /!\s+-name 'One-Person-Lab-Full-\*'/);
  assert.match(vmWorkflow, /find artifacts\/release -type f -name 'One-Person-Lab-\*-mac-arm64\.dmg'/);
  assert.match(vmWorkflow, /--smoke-profile no-clt-clean-vm/);
  assert.match(vmWorkflow, /--smoke-profile homebrew-standard-cask/);
  assert.match(vmWorkflow, /--install-mode homebrew-cask/);
  assert.match(vmWorkflow, /--homebrew-cask "\$\{\{ steps\.package_profile\.outputs\.homebrew_cask \}\}"/);
  assert.match(vmWorkflow, /--display 1920x1080px/);
  assert.match(vmWorkflow, /--settings-smoke/);
  assert.match(vmWorkflow, /--assistant-route-smoke/);
  assert.match(vmWorkflow, /Write first-run VM preflight summary/);
  assert.match(vmWorkflow, /deterministic release-blocking clean VM first launch/);
  assert.match(vmWorkflow, /--runtime-profile "\$\{\{ steps\.package_profile\.outputs\.runtime_profile \}\}"/);
  assert.match(vmWorkflow, /CMD\+=\(--guide-screenshots\)/);
  const vmSmokeScript = fs.readFileSync(
    path.join(appRoot, 'shells', 'aionui', 'scripts', 'opl-first-run-vm-smoke.mjs'),
    'utf8',
  );
  assert.match(vmSmokeScript, /xattr', \['-dr', 'com\.apple\.quarantine', targetApp\]/);
  assert.match(vmSmokeScript, /countQuarantineAttributes\(appPath\)/);
  assert.match(vmSmokeScript, /quarantine_attribute_count: quarantineAttributeCount/);
  assert.match(vmSmokeScript, /local_authorization_status: localAuthorizationStatus/);
  assert.match(vmSmokeScript, /'rejected_allowed_unsigned'/);
  assert.match(vmSmokeScript, /'failed_allowed_unsigned'/);
  assert.match(vmSmokeScript, /if \(quarantineAttributeCount !== 0\)/);
  assert.doesNotMatch(vmSmokeScript, /if \(codesign\.status !== 0\)/);
  assert.doesNotMatch(vmSmokeScript, /if \(codesign\.status !== 0 \|\| spctl\.status !== 0\)/);
  assert.match(vmSmokeScript, /gatekeeper_required: false/);
  assert.match(vmSmokeScript, /quarantine_removal_required: true/);
  assert.equal(
    releaseContract.standard_updater.same_tag_refresh.mode,
    'github_actions_prebuilt_assets_upload_clobber',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.desktop_release_workflow,
    '.github/workflows/desktop-release.yml',
  );
  assert.deepEqual(releaseContract.release_preflight, {
    script: 'scripts/validate-release-preflight.ts',
    package_script: 'release:preflight',
    workflow_job: 'release-preflight',
    summary_artifacts: [
      'release-preflight-summary.json',
      'release-preflight-summary.md',
    ],
    required_fast_checks: [
      'version',
      'release_mode',
      'release_preflight_contract',
      'workflow_preflight_shape',
      'release_plan',
      'homebrew_tap_token',
      'remote_target',
    ],
    failure_budget: 'fail before standard or Full builds start',
    rule: 'Every App release train must pass preflight before starting expensive standard, Full, VM, Homebrew, WebUI, or publish jobs.',
  });
  assert.deepEqual(releaseContract.webui_ghcr_image, {
    owner: 'one-person-lab-app',
    registry: 'ghcr.io',
    image: 'ghcr.io/<owner>/one-person-lab-webui',
    version_tag: '<app_or_opl_version>',
    source: 'shells/aionui Dockerfile',
    source_repository: 'https://github.com/gaofeng21cn/one-person-lab-app',
    required_oci_labels: {
      'org.opencontainers.image.source': 'https://github.com/gaofeng21cn/one-person-lab-app',
    },
    github_package_access: {
      package_url: 'https://github.com/users/gaofeng21cn/packages/container/package/one-person-lab-webui/settings',
      package_landing_url: 'https://github.com/users/gaofeng21cn/packages/container/package/one-person-lab-webui',
      target_repository_association: 'gaofeng21cn/one-person-lab-app',
      current_historical_association_allowed_until_ui_migration: 'gaofeng21cn/one-person-lab',
      repository_association_surface: 'GitHub Packages settings Connect repository',
      required_actions_access_repository: 'gaofeng21cn/one-person-lab-app',
      required_actions_access_permission: 'write',
      configuration_surface: 'GitHub Packages settings Manage Actions access',
      public_api_policy: 'GitHub does not expose a stable public REST or GraphQL endpoint for configuring personal package repository association or Actions access; configure these gates through the package settings UI.',
      failure_signal: 'docker push denied: permission_denied: write_package',
      rule: 'App-owned WebUI GHCR publishing requires the one-person-lab-webui package to be associated with gaofeng21cn/one-person-lab-app and to grant write Actions access to gaofeng21cn/one-person-lab-app before App workflows can update existing GHCR tags.',
    },
    retention_policy: {
      strategy: 'retain_latest_n_versions_and_declared_rollbacks',
      retain_stable_versions: 5,
      retain_nightly_versions: 7,
      protected_tags: ['latest', 'stable', 'nightly'],
      cleanup_execution_mode: 'dry_run_first_explicit_execute_required',
      destructive_action_requires: 'package_admin_with_delete_packages_scope',
      rule: 'WebUI GHCR cleanup must retain protected moving tags, recent stable/nightly versions, and declared rollback tags; deletion is never part of ordinary release publishing.',
    },
    publish_workflows: [
      '.github/workflows/desktop-release.yml',
      '.github/workflows/nightly-standard-release.yml',
    ],
    stable_tags: ['<app_or_opl_version>', 'stable', 'latest'],
    nightly_tags: ['<app_or_opl_version>', 'nightly'],
    draft_candidate_push: false,
    full_first_install_payload_allowed: false,
    module_package_publish_allowed: false,
    opl_flow_plugin_publish_allowed: false,
    framework_role: 'references_image_coordinate_only',
    rule: 'WebUI GHCR image publish truth is App-owned; Framework may reference the image coordinate but does not own publishing.',
  });
  assert.equal(
    releaseContract.release_acceleration.github_actions.first_run_vm_workflow,
    '.github/workflows/opl-first-run-vm.yml',
  );
  assert.deepEqual(
    releaseContract.release_acceleration.vm_gates.map((gate) => gate.id),
    ['standard_dmg_clean_vm_smoke', 'homebrew_standard_cask_clean_vm_smoke', 'full_dmg_clean_vm_smoke'],
  );
  assert.equal(releaseContract.release_acceleration.vm_gate.gate_policy, 'deterministic_release_blocking');
  assert.equal(releaseContract.release_acceleration.vm_gate.source, 'clean no-CLT Tart base clone');
  assert.equal(releaseContract.release_acceleration.vm_gate.artifact, 'One-Person-Lab-Full-<version>-mac-arm64.dmg');
  assert.equal(releaseContract.release_acceleration.vm_gate.smoke_profile, 'no-clt-clean-vm');
  assert.equal(releaseContract.release_acceleration.vm_gate.display, '1920x1080px');
  assert.equal(releaseContract.release_acceleration.vm_gate.runtime_profile, 'full');
  assert.ok(releaseContract.release_acceleration.vm_gate.preflight_summary_fields.includes('runner_labels'));
  assert.ok(releaseContract.release_acceleration.vm_gate.preflight_summary_fields.includes('dmg_artifact_path'));
  assert.equal(releaseContract.release_acceleration.ai_exploratory_policy.codex_app, 'non_blocking_exploratory_only');
  assert.equal(
    releaseContract.release_acceleration.ai_exploratory_policy.release_blocking_requirement,
    'findings_must_be_promoted_to_deterministic_contract_workflow_or_script_gate',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.draft_candidate_mode,
    'draft_candidate',
  );
  assert.deepEqual(releaseContract.github_release_name, {
    format: 'One Person Lab v<version>',
    stable_example: 'One Person Lab v26.6.5',
    nightly_example: 'One Person Lab v26.6.5-nightly',
    tag_pattern: 'v<version>',
    rule: 'GitHub Release names use the product-prefixed v-version format for both Stable and Nightly; tags remain v<version> for updater and automation compatibility.',
  });
  assert.equal(
    releaseContract.release_acceleration.post_publish_remote_verification.script,
    'npm run verify-remote-release -- --version <version>',
  );
  assert.deepEqual(
    releaseContract.release_acceleration.post_publish_remote_verification.checks,
    [
      'remote_asset_size',
      'remote_asset_sha256_digest',
      'local_authorization_policy',
      'standard_updater_metadata',
      'full_sha256sums',
      'full_runtime_cache_events',
      'full_runtime_native_trust',
      'full_manifest_distribution_boundary',
      'full_manifest_size_budget',
      'full_release_asset_size_budget',
      'full_runtime_uncompressed_size_budget',
      'full_readme_english_only',
    ],
  );
  assert.deepEqual(releaseContract.release_acceleration.vm_local_authorization_policy, {
    artifact: 'artifacts/gatekeeper-launch-policy.json',
    quarantine_clear_command: 'xattr -dr com.apple.quarantine <installed_app>',
    codesign_gate: 'diagnostic_only_failed_allowed_unsigned',
    spctl_gate: 'diagnostic_only_rejected_allowed_unsigned',
    allowed_local_authorization_statuses: ['passed', 'rejected_allowed_unsigned', 'failed_allowed_unsigned'],
    rule: 'Stable first-run VM smokes must clear quarantine after install, record codesign and spctl diagnostics before launch, and continue when codesign or spctl rejects the unsigned locally authorized App.',
  });
});

test('Nightly release workflow publishes standard-only semver prereleases', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'nightly-standard-release.yml'), 'utf8');
  const boundaryScript = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-release-boundary.ts'), 'utf8');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(workflow, /name: OPL Nightly Standard Release/);
  assert.match(workflow, /permissions:[\s\S]*packages: write/);
  assert.doesNotMatch(workflow, /pull-requests: read/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: '17 18 \* \* \*'/);
  assert.match(workflow, /group: opl-nightly-standard-release/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /version="\$\(date -u \+'%y\.%-m\.%-d'\)-nightly"/);
  assert.match(workflow, /tag="v\$\{version\}"/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml/);
  assert.match(workflow, /opl_release_version: \$\{\{ needs\.resolve-nightly\.outputs\.version \}\}/);
  assert.match(workflow, /node --experimental-strip-types scripts\/prepare-release-assets\.ts build-artifacts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/generate-release-notes\.ts[\s\S]*--channel nightly/);
  assert.match(workflow, /OPL_RELEASE_NOTES_EVIDENCE_OUTPUT: \$\{\{ runner\.temp \}\}\/opl-nightly-notes-evidence\.json/);
  assert.match(workflow, /node --experimental-strip-types scripts\/generate-release-notes\.ts[\s\S]*--evidence-output "\$OPL_RELEASE_NOTES_EVIDENCE_OUTPUT"[\s\S]*--output "\$notes_file"/);
  assert.match(workflow, /release-notes-evidence-\$\{\{ needs\.resolve-nightly\.outputs\.version \}\}/);
  assert.match(workflow, /remote_tag_sha="\$\(git ls-remote --tags origin "refs\/tags\/\$\{OPL_RELEASE_TAG\}" \| awk '\{print \$1\}'\)"/);
  assert.match(workflow, /git push --force-with-lease="refs\/tags\/\$\{OPL_RELEASE_TAG\}:\$\{remote_tag_sha\}" origin "refs\/tags\/\$\{OPL_RELEASE_TAG\}"/);
  assert.match(workflow, /git push origin "refs\/tags\/\$\{OPL_RELEASE_TAG\}"/);
  assert.match(workflow, /gh release create "\$\{OPL_RELEASE_TAG\}"[\s\S]*--prerelease[\s\S]*--latest=false[\s\S]*--verify-tag/);
  assert.match(workflow, /gh release edit "\$\{OPL_RELEASE_TAG\}"[\s\S]*--prerelease/);
  assert.match(workflow, /release_title="One Person Lab \$\{OPL_RELEASE_TAG\}"/);
  assert.match(workflow, /--title "\$release_title"/);
  assert.match(workflow, /gh release upload "\$\{OPL_RELEASE_TAG\}" release-assets\/\*/);
  assert.match(workflow, /npm run verify-remote-release/);
  assert.match(workflow, /webui-ghcr-publish:/);
  assert.match(workflow, /docker build[\s\S]*--label "org\.opencontainers\.image\.source=https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}"[\s\S]*-t "one-person-lab-webui:\$\{\{ needs\.resolve-nightly\.outputs\.version \}\}"[\s\S]*shells\/aionui/);
  assert.match(workflow, /curl -fsS "http:\/\/127\.0\.0\.1:\$\{port\}\/manifest\.webmanifest"/);
  assert.match(workflow, /docker login ghcr\.io -u "\$GITHUB_ACTOR" --password-stdin/);
  assert.match(workflow, /ghcr\.io\/\$\{image_owner\}\/one-person-lab-webui/);
  assert.match(workflow, /write_publish_summary "failed" "ghcr_write_package_denied"/);
  assert.match(workflow, /required_actions_access_repository: 'gaofeng21cn\/one-person-lab-app'/);
  assert.match(workflow, /source_repository: 'https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}'/);
  assert.match(workflow, /"\$\{ghcr_image\}:\$\{\{ needs\.resolve-nightly\.outputs\.version \}\}"/);
  assert.match(workflow, /"\$\{ghcr_image\}:nightly"/);
  assert.doesNotMatch(workflow, /full-first-install-release\.yml/);
  assert.doesNotMatch(workflow, /include_full_package/);
  assert.doesNotMatch(workflow, /homebrew-tap-update:/);
  assert.doesNotMatch(workflow, /uses: \.\/\.github\/workflows\/homebrew-tap-update\.yml/);
  assert.doesNotMatch(workflow, /One-Person-Lab-Full/);
  assert.doesNotMatch(workflow, /nightly\.\$\{stamp\}/);
  assert.doesNotMatch(workflow, /One Person Lab Nightly \$\{OPL_RELEASE_VERSION\}/);
  assert.doesNotMatch(workflow, /This prerelease is for users who opt into prerelease\/Nightly updates/);
  assert.doesNotMatch(workflow, /"\$\{ghcr_image\}:latest"/);
  assert.doesNotMatch(workflow, /"\$\{ghcr_image\}:stable"/);
  assert.match(boundaryScript, /nightly_standard_release_workflow/);
  assert.equal(
    releaseContract.release_acceleration.github_actions.nightly_standard_release_workflow,
    '.github/workflows/nightly-standard-release.yml',
  );
  assert.equal(releaseContract.nightly_standard.prerelease, true);
  assert.equal(releaseContract.nightly_standard.full_first_install_allowed, false);
  assert.equal(releaseContract.nightly_standard.latest_release_allowed, false);
  assert.deepEqual(releaseContract.release_validation_profiles.nightly_standard.required_lanes, [
    'release_boundary_contract',
    'standard_macos_arm64_build',
    'local_standard_asset_validation',
    'remote_standard_release_verification',
    'webui_ghcr_publish',
  ]);
  assert.ok(
    releaseContract.release_validation_profiles.nightly_standard.forbidden_lanes.includes('full_first_install_build'),
  );
  assert.ok(
    releaseContract.release_validation_profiles.nightly_standard.forbidden_lanes.includes('docker_webui_smoke'),
  );
  assert.ok(
    !releaseContract.release_validation_profiles.nightly_standard.required_lanes.includes('docker_webui_smoke'),
  );
});

test('Homebrew tap publication is cohort-based and separates stable from nightly', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const homebrewWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'homebrew-tap-update.yml'), 'utf8');
  const nightlyWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'nightly-standard-release.yml'), 'utf8');
  const homebrew = releaseContract.homebrew_tap_distribution;

  assert.equal(homebrew.owner, 'one-person-lab-app');
  assert.equal(homebrew.tap_repo, 'gaofeng21cn/homebrew-one-person-lab');
  assert.equal(homebrew.role, 'external_app_cask_index_for_distribution_cohorts');
  assert.equal(homebrew.cohort_manifest_required, true);
  assert.deepEqual(homebrew.formulae, []);
  assert.deepEqual(homebrew.casks, ['one-person-lab', 'one-person-lab-full']);
  assert.deepEqual(homebrew.initial_live_targets, [
    'Casks/one-person-lab.rb',
    'Casks/one-person-lab-nightly.rb',
    'Casks/one-person-lab-full.rb',
  ]);
  assert.deepEqual(homebrew.forbidden_formulae, ['one-person-lab-modules', 'one-person-lab-modules-nightly']);
  assert.deepEqual(homebrew.excluded_casks, []);
  assert.deepEqual(homebrew.full_casks, ['one-person-lab-full']);
  assert.deepEqual(homebrew.nightly_formulae, []);
  assert.deepEqual(homebrew.nightly_casks, ['one-person-lab-nightly']);
  assert.equal(
    homebrew.tap_update_policy.discovery_model,
    'user_taps_github_homebrew_tap_repo_then_homebrew_reads_formula_or_cask',
  );
  assert.equal(homebrew.tap_update_policy.download_source, 'app_owned_github_release_asset_url');
  assert.equal(
    homebrew.tap_update_policy.default_remote_write_path,
    'tap_repo_github_actions_self_sync_direct_commit_after_tap_check',
  );
  assert.equal(homebrew.tap_update_policy.default_workflow_repo, 'gaofeng21cn/homebrew-one-person-lab');
  assert.equal(homebrew.tap_update_policy.default_workflow, '.github/workflows/sync-from-app-releases.yml');
  assert.equal(homebrew.tap_update_policy.tap_sync_script, 'scripts/sync-cask-from-release.mjs');
  assert.equal(homebrew.tap_update_policy.app_release_direct_workflow, '.github/workflows/homebrew-tap-update.yml');
  assert.equal(homebrew.tap_update_policy.app_release_direct_token, 'OPL_HOMEBREW_TAP_TOKEN');
  assert.equal(homebrew.tap_update_policy.app_release_pull_request_allowed, false);
  assert.equal(homebrew.tap_update_policy.app_release_workflow_write_mode, 'direct_commit_only');
  assert.equal('app_release_pr_workflow' in homebrew.tap_update_policy, false);
  assert.equal('app_release_pr_token' in homebrew.tap_update_policy, false);
  assert.equal(homebrew.tap_update_policy.stable_release_workflow_write_mode, 'direct_commit_before_homebrew_vm_gate');
  assert.equal(homebrew.tap_update_policy.planner_script, 'scripts/update-homebrew-tap.ts');
  assert.equal(homebrew.tap_update_policy.nightly.mode, 'tap_repo_scheduled_self_sync_to_nightly_cask');
  assert.equal(homebrew.tap_update_policy.nightly.may_update_stable, false);
  assert.equal(homebrew.tap_update_policy.stable.mode, 'desktop_release_direct_commit_after_remote_verification_before_homebrew_vm_gate');
  assert.equal(homebrew.tap_update_policy.stable.may_consume_nightly_directly, false);
  assert.equal(homebrew.tap_update_policy.full.mode, 'stable_full_first_install_cask_after_full_release_gates');
  assert.equal(homebrew.tap_update_policy.full.may_update_standard_cask, false);
  assert.equal(homebrew.tap_update_policy.full.may_update_nightly_cask, false);
  assert.equal(homebrew.tap_update_policy.full.manifest, 'full-package-manifest.json');
  assert.equal(homebrew.tap_update_policy.full.asset, 'One-Person-Lab-Full-<version>-mac-arm64.dmg');
  assert.equal(homebrew.tap_update_policy.full.standard_updater_visible, false);
  assert.deepEqual(homebrew.tap_update_policy.required_manifest_fields, [
    'channel',
    'artifact',
    'sha256',
    'manifest_url',
    'local_authorization_policy_asset',
  ]);
  assert.equal(homebrew.agent_pack_policy.package_kind, 'app_cli_managed_agent_packs');
  assert.equal(homebrew.agent_pack_policy.semantic_authority, 'one-person-lab_and_domain_repositories');
  assert.equal(homebrew.agent_pack_policy.homebrew_role, 'not_a_distribution_target');
  assert.equal(homebrew.agent_pack_policy.activation_owner, 'app_cli_managed_background_maintenance');
  assert.equal(homebrew.agent_pack_policy.homebrew_distribution_allowed, false);
  assert.equal(homebrew.agent_pack_policy.homebrew_formula_allowed, false);
  assert.deepEqual(homebrew.agent_pack_policy.forbidden_formulae, ['one-person-lab-modules', 'one-person-lab-modules-nightly']);
  assert.equal(homebrew.agent_pack_policy.must_not_write_user_codex_state, true);
  assert.equal(homebrew.agent_pack_policy.must_not_define_agent_semantics, true);
  assert.deepEqual(homebrew.agent_pack_policy.activation_commands, ['opl module reconcile', 'opl skill sync']);
  assert.equal(
    homebrew.full_first_install_policy,
    'stable_full_cask_or_github_release_first_install_asset; never standard updater metadata',
  );
  assert.equal(homebrew.codex_temporal_policy.compatibility_mode, 'minimum_version_plus_capability_smoke');
  assert.equal(homebrew.codex_temporal_policy.prefer_valid_newer_system_tool, true);
  assert.equal(homebrew.codex_temporal_policy.bundled_fallback_allowed, true);

  assert.match(homebrewWorkflow, /name: OPL Homebrew Tap Update/);
  assert.match(homebrewWorkflow, /workflow_dispatch:/);
  assert.match(homebrewWorkflow, /workflow_call:/);
  assert.doesNotMatch(homebrewWorkflow, /write_mode:/);
  assert.doesNotMatch(homebrewWorkflow, /pull-requests: read/);
  assert.doesNotMatch(homebrewWorkflow, /pull_request/);
  assert.match(homebrewWorkflow, /OPL_HOMEBREW_TAP_TOKEN/);
  assert.match(homebrewWorkflow, /OPL_HOMEBREW_TAP_TOKEN is required for Homebrew tap direct commits/);
  assert.match(homebrewWorkflow, /repository: \$\{\{ inputs\.tap_repo \}\}/);
  assert.match(homebrewWorkflow, /gh release view "\$tag"[\s\S]*--json tagName,isDraft,isPrerelease,assets/);
  assert.match(homebrewWorkflow, /Homebrew tap updates must read assets from gaofeng21cn\/one-person-lab-app/);
  assert.match(homebrewWorkflow, /GitHub Release asset \$\{asset\.name\} must expose a sha256 digest/);
  assert.match(homebrewWorkflow, /Homebrew tap updates must not read draft GitHub Releases/);
  assert.match(homebrewWorkflow, /One-Person-Lab-\$\{version\}-mac-arm64\.dmg/);
  assert.match(homebrewWorkflow, /One-Person-Lab-Full-\$\{version\}-mac-arm64\.dmg/);
  assert.match(homebrewWorkflow, /full-package-manifest\.json/);
  assert.match(homebrewWorkflow, /Casks\/one-person-lab-full\.rb/);
  assert.match(homebrewWorkflow, /Full first-install Homebrew cask updates must stay on the stable channel/);
  assert.match(homebrewWorkflow, /Homebrew tap updates are App cask-only; agent packs are App\/CLI-managed/);
  assert.doesNotMatch(homebrewWorkflow, /one-person-lab-modules-\$\{version\}\.tar\.gz/);
  assert.match(homebrewWorkflow, /node --experimental-strip-types scripts\/update-homebrew-tap\.ts[\s\S]*--summary-path "\$RUNNER_TEMP\/homebrew-tap-plan\.json"[\s\S]*--remote-write-mode "direct_commit"[\s\S]*--write/);
  assert.doesNotMatch(homebrewWorkflow, /peter-evans\/create-pull-request@v8/);
  assert.doesNotMatch(homebrewWorkflow, /inputs\.write_mode/);
  assert.match(homebrewWorkflow, /git -C homebrew-tap push origin HEAD:main/);
  assert.match(homebrewWorkflow, /path: homebrew-tap/);
  assert.doesNotMatch(homebrewWorkflow, /gh release upload/);

  assert.doesNotMatch(nightlyWorkflow, /homebrew-tap-update:/);
  assert.doesNotMatch(nightlyWorkflow, /uses: \.\/\.github\/workflows\/homebrew-tap-update\.yml/);
  assert.doesNotMatch(nightlyWorkflow, /pull-requests: read/);
});

test('stable validation profile covers every user installation surface', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const firstRunMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const scenarioIds = firstRunMatrix.scenarios.map((scenario) => scenario.id);
  const stable = releaseContract.release_validation_profiles.stable;

  assert.ok(stable.required_lanes.includes('webui_ghcr_publish'));
  assert.ok(stable.required_lanes.indexOf('webui_ghcr_publish') > stable.required_lanes.indexOf('docker_webui_smoke'));
  assert.deepEqual(stable.required_installation_surfaces, [
    'standard_dmg_clean_vm_smoke',
    'homebrew_standard_cask_clean_vm_smoke',
    'full_dmg_clean_vm_smoke',
    'one_shot_app_installer_fresh_install_smoke',
    'docker_webui_smoke',
  ]);
  assert.ok(stable.required_lanes.includes('docker_webui_smoke'));
  assert.ok(stable.required_lanes.includes('webui_ghcr_publish'));
  assert.ok(stable.required_lanes.indexOf('webui_ghcr_publish') > stable.required_lanes.indexOf('docker_webui_smoke'));
  assert.deepEqual(
    firstRunMatrix.scenarios.find((scenario) => scenario.id === 'docker_webui_smoke'),
    {
      id: 'docker_webui_smoke',
      package_type: 'docker_webui',
      release_gate: true,
      command: 'docker build -t one-person-lab-webui:<version> shells/aionui && docker run -p 127.0.0.1::<container_port> one-person-lab-webui:<version>',
      expects: [
        'Docker image builds from the active AionUI shell Dockerfile',
        'WebUI container starts on port 3000',
        'HTTP / returns 200',
        'HTTP /manifest.webmanifest returns 200',
      ],
    },
  );
  assert.ok(stable.required_lanes.includes('operator_evidence_bundle'));
  for (const scenarioId of stable.required_installation_surfaces) {
    assert.ok(scenarioIds.includes(scenarioId), scenarioId);
  }
});

test('release automation workflows cover remote verification, Full cache warmup, and draft promotion', () => {
  const verifyWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'release-verify-remote.yml'), 'utf8');
  const warmupWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-runtime-cache-warmup.yml'), 'utf8');
  const promoteWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-promote.yml'), 'utf8');
  const cleanupWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-cleanup-drafts.yml'), 'utf8');
  const cleanupScript = fs.readFileSync(path.join(appRoot, 'scripts', 'cleanup-draft-release-candidates.ts'), 'utf8');
  const webuiCleanupScript = fs.readFileSync(path.join(appRoot, 'scripts', 'cleanup-webui-ghcr-versions.ts'), 'utf8');
  const candidateRecordValidator = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-release-candidate-record.ts'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(verifyWorkflow, /name: OPL Remote Release Verification/);
  assert.match(verifyWorkflow, /npm run verify-remote-release/);
  assert.match(verifyWorkflow, /--summary-path remote-release-verification\.json/);
  assert.match(verifyWorkflow, /verify_args\+=\(--include-full-package\)/);
  assert.match(verifyWorkflow, /actions\/upload-artifact@v7/);

  assert.match(warmupWorkflow, /name: OPL Full Runtime Cache Warmup/);
  assert.match(warmupWorkflow, /schedule:/);
  assert.match(warmupWorkflow, /permissions:[\s\S]*contents: write/);
  assert.match(warmupWorkflow, /permissions:[\s\S]*models: read/);
  assert.match(warmupWorkflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml/);
  assert.match(warmupWorkflow, /publish_to_release: false/);
  assert.match(warmupWorkflow, /force_rebuild_runtime_cache:/);
  assert.doesNotMatch(warmupWorkflow, /secrets: inherit/);

  assert.match(promoteWorkflow, /name: OPL Desktop Release Promote/);
  assert.match(promoteWorkflow, /release_run_id:/);
  assert.match(promoteWorkflow, /Download release candidate record/);
  assert.match(promoteWorkflow, /release-candidate-record-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(promoteWorkflow, /npm run release:candidate-record:validate/);
  assert.match(promoteWorkflow, /release-candidate-record-input\/release-candidate-record\.json/);
  assert.equal(
    packageJson.scripts['release:candidate-record:validate'],
    'node --experimental-strip-types scripts/validate-release-candidate-record.ts --promote-ready',
  );
  assert.match(candidateRecordValidator, /record\.schema !== expectedSchema/);
  assert.match(candidateRecordValidator, /record\.status !== readyStatus/);
  assert.match(candidateRecordValidator, /decision\?\.can_promote !== true/);
  assert.match(promoteWorkflow, /npm run verify-remote-release/);
  assert.match(promoteWorkflow, /gh release edit "v\$\{OPL_RELEASE_VERSION\}"/);
  assert.match(promoteWorkflow, /--draft=false/);
  assert.match(promoteWorkflow, /--latest/);

  assert.equal(packageJson.scripts['release:cleanup-drafts'], 'node --experimental-strip-types scripts/cleanup-draft-release-candidates.ts');
  assert.equal(packageJson.scripts['release:cleanup-webui-ghcr'], 'node --experimental-strip-types scripts/cleanup-webui-ghcr-versions.ts');
  assert.match(cleanupWorkflow, /name: OPL Desktop Release Cleanup Drafts/);
  assert.match(cleanupWorkflow, /workflow_dispatch:/);
  assert.match(cleanupWorkflow, /dry_run:/);
  assert.match(cleanupWorkflow, /permissions:[\s\S]*contents: write/);
  assert.match(cleanupWorkflow, /npm run release:cleanup-drafts/);
  assert.match(cleanupWorkflow, /--summary-path release-draft-cleanup-summary\.json/);
  assert.match(cleanupWorkflow, /cleanup_args\+=\(--execute\)/);
  assert.match(cleanupWorkflow, /cleanup_args\+=\(--dry-run\)/);
  assert.match(cleanupWorkflow, /actions\/upload-artifact@v7/);
  assert.doesNotMatch(cleanupWorkflow, /actions\/download-artifact/);
  assert.doesNotMatch(cleanupWorkflow, /gh release download/);
  assert.match(cleanupScript, /\^v\$\{escaped\}-\(draft\|readiness\)\\\\\.\\\\d\{14\}\$/);
  assert.match(cleanupScript, /must be a published stable release/);
  assert.match(cleanupScript, /'--cleanup-tag'/);
  assert.match(webuiCleanupScript, /cleanup_execution_mode !== 'dry_run_first_explicit_execute_required'/);
  assert.match(webuiCleanupScript, /retainedStableIds/);
  assert.match(webuiCleanupScript, /retainedNightlyIds/);
  assert.match(webuiCleanupScript, /'-X'[\s\S]*'DELETE'/);

  assert.equal(
    releaseContract.release_acceleration.github_actions.remote_verification_workflow,
    '.github/workflows/release-verify-remote.yml',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.full_runtime_cache_warmup_workflow,
    '.github/workflows/full-runtime-cache-warmup.yml',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.promote_workflow,
    '.github/workflows/desktop-release-promote.yml',
  );
});

test('release CI operations policy distinguishes workflow hygiene from release evidence', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const vmWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'opl-first-run-vm.yml'), 'utf8');
  const workflowActionsDir = path.join(appRoot, '.github', 'actions');

  assert.ok(
    !Object.values(packageJson.scripts).some((script) => String(script).includes('actionlint')),
    'actionlint is a CI gate, not an App-root package script',
  );

  assert.match(vmWorkflow, /concurrency:[\s\S]*opl-gui-first-run-vm-scheduled[\s\S]*github\.run_id[\s\S]*inputs\.package_profile/);
  assert.doesNotMatch(vmWorkflow, /opl-gui-first-run-vm-manual/);
  assert.match(vmWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'schedule' \}\}/);

  assert.equal(fs.existsSync(path.join(workflowActionsDir, 'setup-active-shell-deps', 'action.yml')), true);
});
