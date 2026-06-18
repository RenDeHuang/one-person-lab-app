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
  assert.match(standardBuild, /require_macos_gatekeeper:\s+false/);
  const reusableWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  assert.match(reusableWorkflow, /macos-signing-preflight:/);
  assert.match(reusableWorkflow, /name: macOS release signing preflight/);
  assert.match(reusableWorkflow, /Missing GitHub Actions secrets: \$\{missing_csv\}/);
  assert.match(reusableWorkflow, /BUILD_CERTIFICATE_BASE64 P12_PASSWORD APPLE_ID APPLE_ID_PASSWORD TEAM_ID IDENTITY/);
  assert.match(reusableWorkflow, /build:[\s\S]*needs:[\s\S]*macos-signing-preflight/);
  assert.match(reusableWorkflow, /Upload macOS DMG-only artifact[\s\S]*format\('\{0\}-dmg', matrix\.artifact-name\)[\s\S]*shells\/aionui\/out\/\*\.dmg/);
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
  assert.match(workflowJobBlock(workflow, 'remote-verify-full'), /runs-on: macos-latest/);
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
  assert.match(workflow, /same_job_after_docker_webui_smoke/);
  assert.match(workflow, /repeated_docker_build: false/);
  assert.match(workflow, /webui-ghcr-publish:[\s\S]*Download WebUI GHCR publish summary[\s\S]*Verify WebUI GHCR publish summary/);
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
      'standard_updater_zip_app_bundle_trust',
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
