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

test('retired tag-push Build and Release workflow has no live or compatibility surface', () => {
  const workflowsDir = path.join(appRoot, '.github', 'workflows');
  const workflowNames = fs.readdirSync(workflowsDir).filter((name) => name.endsWith('.yml')).sort();
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const jobLevelIf = (job: string) => job.split('\n').find((line) => /^    if:/.test(line)) ?? '';
  const boundaryReleaseChecks = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-release-boundary', 'release-checks.ts'),
    'utf8',
  );
  const retiredWorkflowPath = path.join(workflowsDir, 'build-and-release.yml');

  assert.equal(fs.existsSync(retiredWorkflowPath), false);
  assert.equal(workflowNames.includes('build-and-release.yml'), false);
  assert.match(boundaryReleaseChecks, /retired_build_and_release_workflow_absent/);
  assert.match(boundaryReleaseChecks, /\.github\/workflows\/build-and-release\.yml/);

  const releaseWorkflows = releaseContract.release_acceleration.github_actions;
  assert.equal(releaseWorkflows.desktop_release_workflow, '.github/workflows/desktop-release.yml');
  assert.equal(releaseWorkflows.promote_workflow, '.github/workflows/desktop-release-promote.yml');
  assert.equal(releaseWorkflows.full_first_install_workflow, '.github/workflows/full-first-install-release.yml');
  assert.equal(releaseWorkflows.nightly_standard_release_workflow, '.github/workflows/nightly-standard-release.yml');
  assert.equal(
    Object.values(releaseWorkflows).some((value) => value === '.github/workflows/build-and-release.yml'),
    false,
  );

  for (const workflowName of workflowNames) {
    const workflow = fs.readFileSync(path.join(workflowsDir, workflowName), 'utf8');
    assert.doesNotMatch(workflow, /^name:\s*Build and Release\s*$/m, workflowName);
  }
});

test('manual desktop release workflow supports new releases and same-tag refreshes in GitHub Actions', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const standardBuild = workflowJobBlock(workflow, 'standard-build');
  const readinessJob = workflowJobBlock(workflow, 'release-readiness-summary');
  const standardVmGateJob = workflowJobBlock(workflow, 'standard-vm-smoke-gate-after-full');
  const stableHomebrewTapJob = workflowJobBlock(workflow, 'stable-homebrew-tap-update');
  const oneShotInstallerJob = workflowJobBlock(workflow, 'one-shot-app-installer-smoke');
  const dockerWebuiJob = workflowJobBlock(workflow, 'docker-webui-smoke');
  const operatorEvidenceJob = workflowJobBlock(workflow, 'operator-evidence-bundle-validation');
  const readinessAdmissionJob = workflowJobBlock(workflow, 'release-readiness-admission');
  const fullWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');
  const fullPackageScript = readFullPackageBuilderSource();
  const vmWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'opl-first-run-vm.yml'), 'utf8');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const jobLevelIf = (job: string) => job.split('\n').find((line) => /^    if:/.test(line)) ?? '';

  assert.match(workflow, /name: OPL Desktop Release/);
  assert.match(workflow, /cancel-in-progress:\s+true/);
  assert.match(workflow, /release-preflight:/);
  assert.match(workflow, /name: Release preflight/);
  assert.match(workflow, /npm run release:preflight --/);
  assert.match(workflow, /release-preflight-summary\.json/);
  assert.match(workflow, /release-preflight-summary\.md/);
  assert.match(workflow, /release-workflow-contract:/);
  assert.match(workflow, /release-workflow-contract:[\s\S]*name: Release workflow contract/);
  assert.match(workflow, /release-workflow-contract:[\s\S]*npm run validate:release-boundary/);
  assert.match(workflow, /release-workflow-contract:[\s\S]*npm run test:release-boundary/);
  assert.match(workflow, /standard-build:[\s\S]*needs: release-workflow-contract/);
  assert.match(workflow, /full-first-install:[\s\S]*needs: standard-vm-smoke-gate-after-full/);
  assert.doesNotMatch(readinessJob, /release:closeout|release:actions-timing|release-closeout|release-actions-timing/);
  assert.match(workflow, /release_mode:[\s\S]*refresh_existing[\s\S]*new_release[\s\S]*draft_candidate/);
  assert.match(workflow, /permissions:[\s\S]*packages: write/);
  assert.match(workflow, /shell_ref:[\s\S]*description: opl-aion-shell ref to build and verify/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml[\s\S]*shell_ref: \$\{\{ inputs\.shell_ref \}\}/);
  assert.match(standardBuild, /require_macos_gatekeeper:\s+false/);
  const reusableWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  assert.match(reusableWorkflow, /macos-signing-preflight:/);
  assert.match(reusableWorkflow, /name: macOS release signing preflight/);
  assert.match(reusableWorkflow, /name:\s+Record local authorization mode[\s\S]*if:\s+\$\{\{ !inputs\.require_macos_gatekeeper \}\}/);
  assert.match(reusableWorkflow, /name:\s+Verify Apple signing and notarization secrets[\s\S]*if:\s+\$\{\{ inputs\.require_macos_gatekeeper \}\}/);
  assert.match(reusableWorkflow, /Missing GitHub Actions secrets: \$\{missing_csv\}/);
  assert.match(reusableWorkflow, /BUILD_CERTIFICATE_BASE64 P12_PASSWORD APPLE_ID APPLE_ID_PASSWORD TEAM_ID IDENTITY/);
  assert.match(reusableWorkflow, /build:[\s\S]*needs:[\s\S]*macos-signing-preflight/);
  assert.match(reusableWorkflow, /Upload macOS DMG-only artifact[\s\S]*format\('\{0\}-dmg', matrix\.artifact-name\)[\s\S]*shells\/aionui\/out\/\*\.dmg/);
  assert.match(reusableWorkflow, /Ensure macOS standard updater ZIP distributable[\s\S]*if: startsWith\(matrix\.platform, 'macos'\) && !inputs\.upload_installers_only/);
  assert.match(reusableWorkflow, /expected_zip="One-Person-Lab-\$\{OPL_RELEASE_VERSION\}-mac-\$\{target_arch\}\.zip"/);
  assert.match(reusableWorkflow, /Missing standard updater ZIP/);
  assert.match(reusableWorkflow, /bunx electron-builder[\s\S]*--mac dmg zip[\s\S]*--prepackaged "\$app_path"[\s\S]*--publish=never[\s\S]*--config\.extraMetadata\.version="\$OPL_RELEASE_VERSION"/);
  assert.match(reusableWorkflow, /grep -q "\$expected_zip" "\$metadata"/);
  assert.match(workflowJobBlock(workflow, 'publish-standard'), /Download standard build artifacts[\s\S]*name:\s+macos-build-arm64[\s\S]*path:\s+build-artifacts/);
  assert.match(workflow, /node --experimental-strip-types scripts\/prepare-release-assets\.ts build-artifacts release-assets/);
  assert.match(workflow, /name: Verify standard release assets[\s\S]*OPL_RELEASE_VERSION: \$\{\{ inputs\.opl_version \}\}[\s\S]*node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.doesNotMatch(workflow, /models: read/);
  assert.doesNotMatch(workflow, /Install Codex release-note writer/);
  assert.doesNotMatch(workflow, /Configure Codex release-note writer/);
  assert.doesNotMatch(workflow, /OPL_RELEASE_NOTES_PROVIDER: auto/);
  assert.doesNotMatch(workflow, /OPL_RELEASE_NOTES_GITHUB_MODEL/);
  assert.doesNotMatch(workflow, /setup-release-notes-codex-config/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY: \$\{\{ secrets\.OPENAI_API_KEY \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_EVIDENCE_OUTPUT: \$\{\{ runner\.temp \}\}\/standard-release-notes-evidence\.json/);
  assert.match(workflow, /standard-release-notes-evidence-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /full-release-notes-evidence-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /git tag "\$tag" "\$GITHUB_SHA"/);
  assert.match(workflow, /--standard-artifacts-dir release-assets/);
  assert.match(workflow, /if \[ "\$RELEASE_MODE" = "new_release" \] \|\| \[ "\$RELEASE_MODE" = "draft_candidate" \]; then[\s\S]*publish_args\+=\(--draft\)/);
  assert.match(workflow, /remote-verify-standard:/);
  assert.match(workflow, /remote-verify-full:/);
  assert.match(workflowJobBlock(workflow, 'remote-verify-standard'), /runs-on: macos-latest/);
  assert.match(
    workflowJobBlock(workflow, 'remote-verify-standard'),
    /needs:[\s\S]*standard-first-run-vm-smoke-after-standard-only/,
  );
  assert.match(
    workflowJobBlock(workflow, 'remote-verify-standard'),
    /needs\.standard-first-run-vm-smoke-after-standard-only\.result == 'success'/,
  );
  assert.match(workflowJobBlock(workflow, 'remote-verify-full'), /runs-on: macos-latest/);
  assert.match(workflow, /npm run verify-remote-release/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml[\s\S]*shell_ref: \$\{\{ inputs\.shell_ref \}\}/);
  assert.match(workflow, /publish_to_release: false/);
  assert.match(workflow, /full-first-install:[\s\S]*needs:\s+standard-vm-smoke-gate-after-full/);
  assert.match(workflow, /publish-full-assets:/);
  assert.match(workflow, /--full-package-dir full-package-artifacts/);
  assert.match(workflow, /remote-verify-full:[\s\S]*needs:[\s\S]*publish-full-assets[\s\S]*standard-vm-smoke-gate-after-full/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-full:[\s\S]*needs: publish-standard/);
  assert.match(workflow, /standard-vm-smoke-gate-after-full:[\s\S]*needs:[\s\S]*publish-standard[\s\S]*standard-first-run-vm-smoke-after-full/);
  assert.doesNotMatch(jobLevelIf(standardVmGateJob), /if:\s*\$\{\{\s*always\(\)/);
  assert.match(jobLevelIf(standardVmGateJob), /if:\s*\$\{\{\s*!cancelled\(\) && inputs\.include_full_package/);
  assert.match(workflow, /Standard VM smoke must pass before Full build, remote verification, Homebrew, operator evidence, or readiness aggregation can run/);
  assert.match(workflow, /run_vm_smoke:/);
  assert.match(workflow, /default: true/);
  assert.match(workflow, /guide_screenshots:[\s\S]*Capture user-guide screenshots/);
  assert.match(workflow, /permissions:[\s\S]*packages: write/);
  assert.doesNotMatch(workflow, /pull-requests: read/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-standard-only:/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-full:/);
  assert.match(workflow, /stable-homebrew-tap-update:/);
  assert.match(workflow, /stable-homebrew-tap-update:[\s\S]*uses: \.\/\.github\/workflows\/homebrew-tap-update\.yml/);
  assert.match(workflow, /stable-homebrew-tap-update:[\s\S]*needs:[\s\S]*standard-vm-smoke-gate-after-full/);
  assert.doesNotMatch(jobLevelIf(stableHomebrewTapJob), /if:\s*\$\{\{\s*always\(\)/);
  assert.match(jobLevelIf(stableHomebrewTapJob), /if:\s*\$\{\{\s*!cancelled\(\) && inputs\.run_vm_smoke/);
  assert.match(workflow, /full-homebrew-tap-update:/);
  assert.match(
    workflow,
    /full-homebrew-tap-update:[\s\S]*needs:[\s\S]*stable-homebrew-tap-update[\s\S]*remote-verify-full[\s\S]*full-first-run-vm-smoke/,
  );
  const fullHomebrewTapJob = workflow.match(/\n  full-homebrew-tap-update:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  assert.match(jobLevelIf(fullHomebrewTapJob), /if:\s*\$\{\{\s*!cancelled\(\) && inputs\.include_full_package/);
  assert.match(workflow, /full-homebrew-tap-update:[\s\S]*needs\.full-first-run-vm-smoke\.result == 'success'/);
  assert.match(workflow, /full-homebrew-tap-update:[\s\S]*package_kind: app_full_first_install/);
  assert.match(workflow, /homebrew-standard-first-run-vm-smoke:[\s\S]*needs:[\s\S]*stable-homebrew-tap-update/);
  assert.match(workflow, /homebrew-standard-first-run-vm-smoke:[\s\S]*needs\.stable-homebrew-tap-update\.result == 'success'/);
  const homebrewStandardVmJob = workflow.match(/\n  homebrew-standard-first-run-vm-smoke:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  assert.match(jobLevelIf(homebrewStandardVmJob), /if:\s*\$\{\{\s*!cancelled\(\) && inputs\.run_vm_smoke/);
  assert.doesNotMatch(homebrewStandardVmJob, /full-homebrew-tap-update/);
  assert.match(workflow, /homebrew-standard-first-run-vm-smoke:/);
  assert.match(workflow, /full-first-run-vm-smoke:/);
  assert.match(
    workflow,
    /full-first-run-vm-smoke:[\s\S]*needs:[\s\S]*publish-full-assets[\s\S]*standard-vm-smoke-gate-after-full/,
  );
  assert.match(workflow, /full-first-run-vm-smoke:[\s\S]*needs\.standard-vm-smoke-gate-after-full\.result == 'success'/);
  assert.match(workflow, /one-shot-app-installer-smoke:/);
  assert.match(workflow, /one-shot-app-installer-smoke:[\s\S]*standard-vm-smoke-gate-after-full/);
  assert.match(workflow, /docker-webui-smoke:/);
  assert.match(workflow, /docker-webui-smoke:[\s\S]*standard-vm-smoke-gate-after-full/);
  assert.doesNotMatch(jobLevelIf(oneShotInstallerJob), /if:\s*\$\{\{\s*always\(\)/);
  assert.doesNotMatch(jobLevelIf(dockerWebuiJob), /if:\s*\$\{\{\s*always\(\)/);
  assert.match(jobLevelIf(oneShotInstallerJob), /if:\s*\$\{\{\s*!cancelled\(\) && inputs\.run_vm_smoke/);
  assert.match(jobLevelIf(dockerWebuiJob), /if:\s*\$\{\{\s*!cancelled\(\)/);
  assert.match(jobLevelIf(dockerWebuiJob), /inputs\.publish_docker_webui/);
  assert.match(jobLevelIf(dockerWebuiJob), /inputs\.run_vm_smoke/);
  assert.match(workflow, /webui-ghcr-publish:/);
  assert.match(workflow, /OPL_INSTALL_SCRIPT_URL: file:\/\/\$\{\{ github\.workspace \}\}\/one-person-lab\/install\.sh/);
  assert.match(workflow, /\.\/install\.sh --complete --skip-modules/);
  assert.match(workflow, /docker build[\s\S]*--label "org\.opencontainers\.image\.source=https:\/\/github\.com\/\$\{GITHUB_REPOSITORY\}"[\s\S]*-t "one-person-lab-webui:\$\{\{ inputs\.opl_version \}\}"[\s\S]*shells\/aionui/);
  assert.match(workflow, /curl -fsS "http:\/\/127\.0\.0\.1:\$\{port\}\/manifest\.webmanifest"/);
  assert.match(workflow, /same_job_after_docker_webui_smoke/);
  assert.match(workflow, /repeated_docker_build: false/);
  assert.match(workflow, /webui-ghcr-publish:[\s\S]*Download WebUI GHCR publish summary[\s\S]*Verify WebUI GHCR publish summary/);
  assert.doesNotMatch(jobLevelIf(operatorEvidenceJob), /if:\s*\$\{\{\s*always\(\)/);
  assert.match(jobLevelIf(operatorEvidenceJob), /if:\s*\$\{\{\s*!cancelled\(\) && inputs\.run_vm_smoke/);
  assert.doesNotMatch(jobLevelIf(readinessAdmissionJob), /if:\s*\$\{\{\s*always\(\)/);
  assert.match(jobLevelIf(readinessAdmissionJob), /if:\s*\$\{\{\s*!cancelled\(\) && inputs\.run_vm_smoke/);
  assert.match(readinessAdmissionJob, /release-preflight/);
  assert.match(jobLevelIf(readinessAdmissionJob), /needs\.release-preflight\.result == 'success'/);
  assert.match(jobLevelIf(readinessAdmissionJob), /needs\.release-preflight\.outputs\.homebrew_tap_update_required != 'true'/);
  assert.match(readinessAdmissionJob, /const homebrewTapUpdateRequired = '\$\{\{ needs\.release-preflight\.outputs\.homebrew_tap_update_required \}\}' === 'true'/);
  assert.match(readinessAdmissionJob, /if \(homebrewTapUpdateRequired\) \{[\s\S]*requireSuccess\('stable-homebrew-tap-update'\)[\s\S]*requireSuccess\('full-homebrew-tap-update'\)[\s\S]*requireSuccess\('homebrew-standard-first-run-vm-smoke'\)/);
  assert.match(readinessAdmissionJob, /else \{[\s\S]*requireSuccessOrSkipped\('stable-homebrew-tap-update'\)[\s\S]*requireSuccessOrSkipped\('full-homebrew-tap-update'\)[\s\S]*requireSuccessOrSkipped\('homebrew-standard-first-run-vm-smoke'\)/);
  assert.doesNotMatch(jobLevelIf(readinessJob), /if:\s*\$\{\{\s*always\(\)/);
  assert.match(jobLevelIf(readinessJob), /if:\s*\$\{\{\s*!cancelled\(\) && needs\.release-readiness-admission\.result == 'success'/);
  assert.doesNotMatch(readinessJob, /name: Write release candidate record[\s\S]{0,80}if:\s*\$\{\{\s*always\(\)/);
  assert.doesNotMatch(readinessJob, /name: Upload release readiness summary[\s\S]{0,80}if:\s*always\(\)/);
  assert.doesNotMatch(readinessJob, /name: Upload release candidate record[\s\S]{0,80}if:\s*always\(\)/);
  assert.equal((workflow.match(/docker build/g) ?? []).length, 1);
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
  assert.match(workflow, /release_artifact_name: macos-build-arm64-dmg/);
  assert.match(workflow, /release_artifact_name: opl-full-first-install-dmg-\$\{\{ inputs\.opl_version \}\}-mac-arm64/);
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
  assert.match(fullWorkflow, /name: Checkout OPL BookForge/);
  assert.match(fullWorkflow, /repository: gaofeng21cn\/opl-bookforge/);
  assert.match(fullWorkflow, /path: opl-bookforge/);
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
  assert.match(fullWorkflow, /OPL_FULL_BOOKFORGE_ROOT="\$GITHUB_WORKSPACE\/opl-bookforge"/);
  assert.match(fullWorkflow, /OPL_FULL_MINERU_OPEN_API_BIN/);
  assert.match(fullWorkflow, /assets\/companion-skills\/mineru-document-extractor/);
  assert.match(fullPackageScript, /assets', 'companion-skills', 'mineru-document-extractor/);
  assert.ok(
    fs.existsSync(path.join(appRoot, 'assets', 'companion-skills', 'mineru-document-extractor', 'SKILL.md')),
  );
  assert.match(vmWorkflow, /workflow_call:/);
  assert.match(vmWorkflow, /shell_ref:[\s\S]*description: 'opl-aion-shell ref containing the first-run smoke scripts/);
  assert.match(vmWorkflow, /diagnostic_scope:[\s\S]*default: release_gate/);
  assert.match(vmWorkflow, /validate-vm-inputs:[\s\S]*runs-on: ubuntu-latest/);
  assert.match(vmWorkflow, /Validate active shell ref before VM runner work/);
  assert.match(vmWorkflow, /opl-aion-shell ref '\$shell_ref' does not exist; fix shell_ref before occupying the first-run VM harness/);
  assert.match(vmWorkflow, /clean-vm-first-run:[\s\S]*needs: validate-vm-inputs/);
  assert.match(vmWorkflow, /PROFILE="\$\{\{ needs\.validate-vm-inputs\.outputs\.package_profile \}\}"/);
  assert.match(vmWorkflow, /name: Checkout active shell[\s\S]*ref: \$\{\{ needs\.validate-vm-inputs\.outputs\.shell_ref \}\}/);
  assert.match(vmWorkflow, /release_artifact_name:/);
  assert.match(vmWorkflow, /release_artifact_run_id:/);
  assert.match(vmWorkflow, /actions\/download-artifact@v8/);
  assert.match(vmWorkflow, /run-id:\s+\$\{\{ inputs\.release_artifact_run_id \|\| github\.run_id \}\}/);
  assert.match(vmWorkflow, /Using same-run workflow artifact/);
  assert.match(vmWorkflow, /Using source workflow run artifact/);
  assert.match(vmWorkflow, /workflow artifact \$\{\{ inputs\.release_artifact_name \}\} from run \$\{\{ inputs\.release_artifact_run_id \|\| github\.run_id \}\}/);
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
  assert.match(vmWorkflow, /Skip scheduled VM while desktop release is active/);
  assert.match(vmWorkflow, /--workflow "OPL Desktop Release"/);
  assert.match(vmWorkflow, /--status "\$status"/);
  assert.match(vmWorkflow, /active_release_runs="\$\(count_runs in_progress\)"/);
  assert.match(vmWorkflow, /queued_release_runs="\$\(count_runs queued\)"/);
  assert.match(vmWorkflow, /skip_reason=desktop_release_active_or_queued/);
  assert.match(vmWorkflow, /skip_reason=desktop_release_guard_unavailable/);
  assert.match(vmWorkflow, /scheduled maintenance must not occupy the self-hosted first-run VM runner/);
  assert.match(vmWorkflow, /if \[ "\$\{\{ github\.event_name \}\}" = "schedule" \]; then\s+profile="standard"/);
  assert.match(vmWorkflow, /if \[ "\$\{\{ github\.event_name \}\}" = "schedule" \]; then\s+diagnostic_scope="bootstrap_only"/);
  assert.doesNotMatch(vmWorkflow, /opl-gui-first-run-vm-manual/);
  assert.match(vmWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'schedule' \}\}/);
  assert.match(vmWorkflow, /clean-vm-first-run:[\s\S]*if: \$\{\{ needs\.validate-vm-inputs\.outputs\.skip_vm != 'true' \}\}/);
  assert.match(vmWorkflow, /Resolve Tart source VM/);
  assert.match(vmWorkflow, /package_profile:/);
  assert.match(vmWorkflow, /homebrew-standard/);
  assert.match(vmWorkflow, /guide_screenshots:/);
  assert.match(vmWorkflow, /Resolve package profile/);
  assert.match(vmWorkflow, /profile="\$\{\{ needs\.validate-vm-inputs\.outputs\.package_profile \}\}"/);
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
  assert.match(vmWorkflow, /diagnostic_scope != 'bootstrap_only'/);
  assert.match(vmWorkflow, /release_inputs:[\s\S]*diagnostic_scope: diagnosticScope/);
  assert.match(vmWorkflow, /Write first-run VM preflight summary/);
  assert.match(vmWorkflow, /deterministic release-blocking clean VM first launch/);
  assert.match(vmWorkflow, /id:\s+vm_smoke/);
  assert.match(vmWorkflow, /Write first-run VM critical diagnostics[\s\S]*vm-gate-failure-summary\.json[\s\S]*vm-gate-failure-summary\.md/);
  assert.match(vmWorkflow, /release_artifact_name: process\.env\.RELEASE_ARTIFACT_NAME/);
  assert.match(vmWorkflow, /release_artifact_run_id: releaseArtifactRunId/);
  assert.match(vmWorkflow, /step_conclusion: smokeConclusion/);
  assert.match(vmWorkflow, /const expectedNextAction =[\s\S]*rerun_diagnostic_same_artifact[\s\S]*expected_next_action: expectedNextAction/);
  assert.match(vmWorkflow, /artifact_upload_failure_boundary:[\s\S]*critical_diagnostics_retention_days: 7[\s\S]*large_vm_artifact_if_no_files_found: 'warn'/);
  assert.match(vmWorkflow, /truth_boundary: 'critical diagnostics are not release-ready evidence/);
  assert.match(vmWorkflow, /Upload first-run VM critical diagnostics[\s\S]*if:\s+\$\{\{ always\(\) \}\}[\s\S]*if-no-files-found:\s+error[\s\S]*retention-days:\s+7/);
  assert.match(vmWorkflow, /--runtime-profile "\$\{\{ steps\.package_profile\.outputs\.runtime_profile \}\}"/);
  assert.match(vmWorkflow, /CMD\+=\(--guide-screenshots\)/);
  assert.match(vmWorkflow, /name:\s+opl-first-run-vm-\$\{\{\s*steps\.package_profile\.outputs\.profile \|\| needs\.validate-vm-inputs\.outputs\.package_profile\s*\}\}-\$\{\{\s*github\.run_id\s*\}\}/);
  assert.match(vmWorkflow, /Upload first-run VM artifacts[\s\S]*name:\s+opl-first-run-vm-\$\{\{[\s\S]*if-no-files-found:\s+warn/);
  const vmSmokeScript = fs.readFileSync(
    path.join(activeShellRoot, 'scripts', 'opl-first-run-vm-smoke.mjs'),
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
    releaseContract.release_acceleration.github_actions.first_run_vm_concurrency.scheduled_default_package_profile,
    'standard',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.first_run_vm_concurrency.scheduled_default_diagnostic_scope,
    'bootstrap_only',
  );
  assert.deepEqual(
    releaseContract.release_acceleration.github_actions.first_run_vm_concurrency
      .scheduled_desktop_release_activity_guard,
    {
      workflow: 'OPL Desktop Release',
      checked_statuses: ['in_progress', 'queued'],
      skip_reason: 'desktop_release_active_or_queued',
      guard_unavailable_skip_reason: 'desktop_release_guard_unavailable',
      runner_boundary: 'github_hosted_preflight_before_self_hosted_vm',
      rule: 'Scheduled maintenance must not occupy the self-hosted first-run VM runner while a desktop release is active, queued, or cannot be checked.',
    },
  );
  assert.equal(
    releaseContract.standard_updater.same_tag_refresh.mode,
    'github_actions_prebuilt_assets_upload_clobber',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.desktop_release_workflow,
    '.github/workflows/desktop-release.yml',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.diagnostics_workflow,
    '.github/workflows/desktop-release-diagnostics.yml',
  );
  assert.deepEqual(releaseContract.release_acceleration.github_actions.desktop_release_concurrency, {
    group: 'opl-desktop-release-<draft|stable>-<version>',
    cancel_in_progress: true,
    rule: 'A newer run for the same version and release lane cancels stale work before another expensive App release attempt can publish or produce contradictory diagnostic artifacts.',
  });
  assert.deepEqual(releaseContract.release_acceleration.github_actions.release_readiness_admission, {
    workflow_job: 'release-readiness-admission',
    preflight_dependency: 'release-preflight',
    homebrew_tap_update_required_source: 'release-preflight.outputs.homebrew_tap_update_required',
    homebrew_required_when_true: [
      'stable-homebrew-tap-update',
      'homebrew-standard-first-run-vm-smoke',
      'full-homebrew-tap-update_for_full_release',
    ],
    homebrew_allowed_when_false: 'success_or_skipped',
    rule: 'Release readiness admission must fail when required same-cohort gates fail, but it must not force Homebrew tap or Homebrew VM gates when release-preflight says no tap update is required.',
  });
  assert.deepEqual(releaseContract.release_acceleration.github_actions.diagnostics_workflow_policy, {
    workflow: '.github/workflows/desktop-release-diagnostics.yml',
    purpose: 'harness_and_standard_artifact_only_release_diagnostics',
    permissions: ['actions:read', 'contents:read'],
    reads: [
      'release_run_id',
      'release_tag',
      'release_dmg_url',
      'release_artifact_name',
      'release_artifact_run_id',
      'diagnostic_scope',
      'build_standard_artifact',
      'small release artifacts',
      'GitHub Actions run timing',
      'first-run VM harness diagnostics',
    ],
    default_diagnostic_scope: 'bootstrap_only',
    diagnostic_scopes: {
      bootstrap_only: {
        purpose: 'fast App launch and bootstrap blocker capture before rerunning a full release train',
        skips: [
          'Codex install asset cache restore',
          'Codex install asset prefetch',
          'Codex install asset cache save',
          'Settings page sweep',
          'assistant route smoke',
          'Codex functional check',
          'Codex AI self-check',
        ],
        keeps: [
          'same-run or supplied DMG resolution',
          'packaged main bootstrap marker verification',
          'App install',
          'Gatekeeper/local authorization diagnostics',
          'App launch',
          'wrapper preflight diagnostics',
          'wrapper smoke command and log artifacts',
          'Tart smoke summary artifact',
        ],
        wrapper_diagnostic_artifacts: [
          'app-wrapper-diagnostics.json',
          'app-wrapper-preflight.log',
          'app-wrapper-smoke-command-preview.txt',
          'app-wrapper-smoke.stdout.log',
          'app-wrapper-smoke.stderr.log',
          'vm-gate-failure-summary.json',
          'vm-gate-failure-summary.md',
          'tart-smoke-summary.json',
        ],
        authority_boundary: 'diagnostic_only_not_release_ready_owner_receipt_or_runtime_truth',
      },
      release_gate: {
        purpose: 'full deterministic VM release gate used by stable release workflows',
        keeps: [
          'same-run or supplied DMG resolution',
          'packaged main bootstrap marker verification',
          'App install',
          'Gatekeeper/local authorization diagnostics',
          'App launch',
          'wrapper preflight diagnostics',
          'wrapper smoke command and log artifacts',
          'Tart smoke summary artifact',
          'Codex install asset cache restore',
          'Codex install asset prefetch',
          'Codex install asset cache save',
          'Settings page sweep',
          'assistant route smoke',
          'Codex functional check',
          'Codex AI self-check',
        ],
        wrapper_diagnostic_artifacts: [
          'app-wrapper-diagnostics.json',
          'app-wrapper-preflight.log',
          'app-wrapper-smoke-command-preview.txt',
          'app-wrapper-smoke.stdout.log',
          'app-wrapper-smoke.stderr.log',
          'vm-gate-failure-summary.json',
          'vm-gate-failure-summary.md',
          'tart-smoke-summary.json',
        ],
        critical_failure_artifact_policy:
          'write vm-gate-failure-summary.json/md before uploading large VM artifacts; classify missing large artifacts separately as diagnostic_artifact_missing and recommend rerun_diagnostic_same_artifact',
        wrapper_diagnostic_policy:
          'host_wrapper_preflight_and_smoke_logs_are_supporting_evidence; full release gate failure still comes from the deterministic VM readiness/settings/route/codex checks',
        authority_boundary: 'release_gate_evidence_only_when_same_cohort_workflow_requires_it',
      },
    },
    writes: [
      'temporary standard DMG diagnostic artifact only',
      'release-diagnostics artifact only',
      'opl-first-run-vm-<profile>-<run_id> diagnostic artifact only',
    ],
    forbidden: [
      'published standard App rebuild',
      'Full package rebuild',
      'release publish',
      'owner receipt',
      'runtime truth',
      'stable/latest promotion',
    ],
  });
  assert.deepEqual(releaseContract.release_acceleration.github_actions.first_run_vm_artifact_handoff, {
    same_run_inputs: ['release_artifact_name'],
    source_run_inputs: ['release_artifact_name', 'release_artifact_run_id'],
    source_run_download_command: 'actions/download-artifact@v8 with run-id=<release_artifact_run_id || github.run_id> and name=<release_artifact_name>',
    scope: 'vm_evidence_only',
    same_artifact_diagnostic_next_action: 'rerun_diagnostic_same_artifact',
    diagnostic_missing_status: 'diagnostic_artifact_missing',
    forbidden_replacements: [
      'stable release same-run VM gates',
      'published release remote verification',
      'owner receipt',
      'release publish',
    ],
    rule: 'Branch-lane or post-release evidence runs may explicitly download a DMG-only artifact from a completed source Actions run without publishing assets; this handoff is VM evidence only and must not replace stable same-run VM gates or published asset verification.',
  });
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
      'release_refs',
      'codex_package_metadata',
      'homebrew_vm_gate_static_policy',
      'homebrew_tap_token',
      'macos_local_authorization',
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
    distribution_role: 'preheated_webui_runtime_image_not_desktop_app_gui_shell',
    ordinary_app_install_path: false,
    managed_package_channel_member: false,
    runtime_image_contract: {
      image_role: 'browser_entrypoint_for_opl_on_linux_container',
      startup_goal: 'open_webui_quickly_then_let_opl_reconcile_persisted_runtime_state',
      base_os_policy: 'slim_lts_linux_base_with_only_runtime_required_packages',
      required_runtime_contents: [
        'webui_static_assets',
        'aionui_web_standalone_launcher',
        'bundled_aioncore',
        'opl_bootstrap_installer',
        'image_manifest',
        'optional_opl_seed_metadata',
      ],
      persistent_mounts: {
        '/data': 'configuration_sessions_sqlite_logs_cache_opl_state_codex_home_and_managed_runtime_state',
        '/projects': 'user_project_files_and_workspaces',
      },
      image_manifest: {
        required: true,
        path_env: 'OPL_IMAGE_MANIFEST_PATH',
        seed_dir_env: 'OPL_IMAGE_SEED_DIR',
        data_dir_env: 'AIONUI_DATA_DIR',
        projects_dir_env: 'OPL_PROJECTS_DIR',
        must_describe: [
          'schema',
          'image_role',
          'base_image_family',
          'webui_package',
          'bundled_aioncore_platforms',
          'bootstrap_path',
          'data_dir',
          'projects_dir',
          'seed_strategy',
        ],
      },
      update_planes: {
        image_update: [
          'webui_shell',
          'aionui_web_launcher',
          'bundled_aioncore',
          'opl_bootstrap_installer',
          'base_os_packages',
          'preheated_seed_payload',
        ],
        opl_managed_update: [
          'opl_framework',
          'codex_cli_or_runtime',
          'companion_skills',
          'domain_modules',
          'managed_toolchain',
        ],
        data_migration: [
          'sqlite_schema',
          'install_manifest',
          'runtime_receipts',
          'user_settings_shape',
        ],
      },
      rule: 'Docker/WebUI starts as a preheated WebUI runtime image: the image gets users to a browser quickly, while OPL Framework owns reconciliation and managed updates inside the mounted /data state.',
    },
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
    rule: 'WebUI GHCR image publish truth is App-owned server deployment artifact truth for the preheated WebUI runtime image. The desktop App embeds the AionUI shell through App packaging; ordinary desktop users do not install this container package. Framework may reference the image coordinate and owns OPL-managed reconciliation inside /data, but it does not own GHCR publishing.',
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
  assert.equal(releaseContract.release_acceleration.vm_gate.diagnostic_scope, 'release_gate');
  assert.equal(releaseContract.release_acceleration.vm_gate.runtime_profile, 'full');
  for (const gate of releaseContract.release_acceleration.vm_gates) {
    assert.equal(gate.diagnostic_scope, 'release_gate');
  }
  assert.ok(releaseContract.release_acceleration.vm_gate.preflight_summary_fields.includes('runner_labels'));
  assert.ok(releaseContract.release_acceleration.vm_gate.preflight_summary_fields.includes('diagnostic_scope'));
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
      'standard_updater_zip_app_bundle_trust',
      'standard_updater_metadata',
      'full_sha256sums',
      'full_runtime_cache_events',
      'full_runtime_native_trust',
      'full_package_optimization_artifacts',
      'full_package_boundary_audit',
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
