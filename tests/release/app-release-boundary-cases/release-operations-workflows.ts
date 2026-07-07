import {
  assert,
  fs,
  path,
  test,
  appRoot,
  workflowJobBlock,
} from './helpers.ts';

test('Nightly release workflow publishes standard-only semver prereleases', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'nightly-standard-release.yml'), 'utf8');
  const boundaryReleaseChecks = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-release-boundary', 'release-checks.ts'),
    'utf8',
  );
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
  assert.match(workflowJobBlock(workflow, 'standard-build'), /require_macos_gatekeeper:\s+false/);
  assert.match(workflowJobBlock(workflow, 'publish-nightly'), /runs-on: macos-latest/);
  assert.doesNotMatch(workflowJobBlock(workflow, 'publish-nightly'), /models: read/);
  assert.match(workflow, /node --experimental-strip-types scripts\/prepare-release-assets\.ts build-artifacts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/generate-release-notes\.ts[\s\S]*--channel nightly/);
  assert.match(workflow, /OPL_RELEASE_NOTES_MODE: ai/);
  assert.match(workflow, /OPL_RELEASE_NOTES_PROVIDER: openai_compatible/);
  assert.match(workflow, /OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: \$\{\{ vars\.OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: \$\{\{ secrets\.OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_BASE_URL: \$\{\{ vars\.OPL_RELEASE_NOTES_CODEX_BASE_URL \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_CODEX_API_KEY: \$\{\{ secrets\.OPL_RELEASE_NOTES_CODEX_API_KEY \}\}/);
  assert.match(workflow, /OPL_RELEASE_NOTES_EVIDENCE_OUTPUT: \$\{\{ runner\.temp \}\}\/opl-nightly-notes-evidence\.json/);
  assert.match(workflow, /node --experimental-strip-types scripts\/release-notes-ai-writer\.ts --probe-openai-compatible/);
  assert.match(workflow, /node --experimental-strip-types scripts\/generate-release-notes\.ts[\s\S]*--evidence-output "\$OPL_RELEASE_NOTES_EVIDENCE_OUTPUT"[\s\S]*--output "\$template_notes_file"/);
  assert.match(workflow, /node --experimental-strip-types scripts\/release-notes-ai-writer\.ts[\s\S]*--evidence "\$OPL_RELEASE_NOTES_EVIDENCE_OUTPUT"[\s\S]*--output "\$notes_file"/);
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
  assert.match(workflow, /docker run --rm --entrypoint cat "one-person-lab-webui:\$\{\{ needs\.resolve-nightly\.outputs\.version \}\}"[\s\S]*\/opt\/opl\/image-manifest\.json/);
  assert.match(workflow, /docker run --rm --entrypoint cat "one-person-lab-webui:\$\{\{ needs\.resolve-nightly\.outputs\.version \}\}"[\s\S]*\/opt\/opl\/seed\/metadata\.json/);
  assert.match(workflow, /node --experimental-strip-types scripts\/validate-webui-runtime-image\.ts[\s\S]*--expected-profile webui-full/);
  assert.match(workflow, /curl -fsS "http:\/\/127\.0\.0\.1:\$\{port\}\/manifest\.webmanifest"/);
  assert.match(workflow, /\/api\/opl-runtime\/startup-maintenance[\s\S]*\/tmp\/opl-webui-startup-maintenance\.json/);
  assert.match(workflow, /\/api\/opl-runtime\/update-status[\s\S]*\/tmp\/opl-webui-update-status\.json/);
  assert.match(workflow, /\/tmp\/opl-webui-startup-maintenance\.json/);
  assert.match(workflow, /\/tmp\/opl-webui-update-status\.json/);
  assert.match(workflow, /node --experimental-strip-types scripts\/validate-webui-runtime-smoke-receipts\.ts/);
  assert.match(workflow, /\/tmp\/opl-webui-runtime-smoke-receipts-validation\.json/);
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
  assert.match(boundaryReleaseChecks, /nightly_standard_release_workflow/);
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

test('Non-release validation workflow covers main pushes without publishing release assets', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'non-release-validation.yml'), 'utf8');
  const boundaryReleaseChecks = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-release-boundary', 'release-checks.ts'),
    'utf8',
  );

  assert.match(workflow, /name: OPL Non-Release Validation/);
  assert.match(workflow, /push:[\s\S]*branches:[\s\S]*- main/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:[\s\S]*contents: read/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.doesNotMatch(workflow, /packages: write/);
  assert.doesNotMatch(workflow, /actions: write/);
  assert.match(workflow, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /uses: \.\/\.github\/actions\/setup-active-shell-deps/);
  assert.match(workflow, /install-dependencies: 'false'/);
  assert.match(workflow, /npm run test:release-boundary/);
  assert.match(workflow, /npm run validate:release-boundary/);
  assert.doesNotMatch(workflow, /gh release/);
  assert.doesNotMatch(workflow, /npm run release:publish/);
  assert.doesNotMatch(workflow, /npm run build/);
  assert.doesNotMatch(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml/);
  assert.match(boundaryReleaseChecks, /non_release_validation_workflow/);
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
  assert.deepEqual(homebrew.cask_install_policy, {
    standard_cask: 'one-person-lab',
    standard_cask_install_ref: 'gaofeng21cn/one-person-lab/one-person-lab',
    standard_install_trusted_cask_refs: [
      'gaofeng21cn/one-person-lab/one-person-lab',
      'gaofeng21cn/one-person-lab/one-person-lab-full',
      'gaofeng21cn/one-person-lab/one-person-lab-nightly',
    ],
    fully_qualified_cask_install: true,
    trust_scope: 'explicit_standard_and_conflicting_cask_refs_not_whole_tap',
    rule: 'Homebrew user and CI installs use the fully qualified standard cask ref and trust only the standard plus conflicts_with sibling cask refs so installation stays explicit without granting broad trust to the whole tap.',
  });
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
  assert.equal(
    homebrew.tap_update_policy.app_release_workflow_write_mode,
    'direct_commit_only_with_same_version_channel_serialization_and_fetch_rebase_retry',
  );
  assert.equal('app_release_pr_workflow' in homebrew.tap_update_policy, false);
  assert.equal('app_release_pr_token' in homebrew.tap_update_policy, false);
  assert.equal(
    homebrew.tap_update_policy.stable_release_workflow_write_mode,
    'new_release_promote_direct_commit_after_publish_readback_before_homebrew_vm_gate; refresh_existing_published_release_direct_commit_after_remote_verification_before_homebrew_vm_gate; refresh_existing_draft_release_defer_to_promote_after_publish_readback',
  );
  assert.equal(
    homebrew.tap_update_policy.direct_commit_conflict_policy,
    'serialize same channel/version tap writes across package kinds; on non-fast-forward push, fetch origin main, rebase the local tap commit, and retry before failing',
  );
  assert.equal(homebrew.tap_update_policy.planner_script, 'scripts/update-homebrew-tap.ts');
  assert.equal(homebrew.tap_update_policy.nightly.mode, 'tap_repo_scheduled_self_sync_to_nightly_cask');
  assert.equal(homebrew.tap_update_policy.nightly.may_update_stable, false);
  assert.equal(
    homebrew.tap_update_policy.stable.mode,
    'new_release_desktop_promote_direct_commit_after_publish_readback_before_homebrew_vm_gate; refresh_existing_published_release_desktop_release_direct_commit_after_remote_verification_before_homebrew_vm_gate; refresh_existing_draft_release_desktop_promote_after_publish_readback_before_homebrew_vm_gate',
  );
  assert.equal(homebrew.tap_update_policy.stable.may_consume_nightly_directly, false);
  assert.equal(homebrew.tap_update_policy.full.mode, 'stable_full_first_install_cask_after_full_release_gates');
  assert.equal(homebrew.tap_update_policy.full.may_update_standard_cask, false);
  assert.equal(homebrew.tap_update_policy.full.may_update_nightly_cask, false);
  assert.equal(homebrew.tap_update_policy.full.manifest, 'opl-release-manifest.json');
  assert.equal(homebrew.tap_update_policy.full.asset, 'One-Person-Lab-Full-<version>-mac-arm64.dmg');
  assert.equal(homebrew.tap_update_policy.full.standard_updater_visible, false);
  assert.deepEqual(homebrew.tap_update_policy.required_manifest_fields, [
    'channel',
    'artifact',
    'sha256',
    'manifest_url',
    'local_authorization_policy_ref',
  ]);
  assert.equal(homebrew.agent_pack_policy.package_kind, 'app_cli_managed_opl_packages');
  assert.equal(homebrew.agent_pack_policy.semantic_authority, 'one-person-lab_and_domain_repositories');
  assert.equal(homebrew.agent_pack_policy.homebrew_role, 'not_a_distribution_target');
  assert.equal(homebrew.agent_pack_policy.activation_owner, 'app_cli_managed_background_maintenance');
  assert.equal(homebrew.agent_pack_policy.default_update_mode, 'automatic_apply_for_clean_managed_roots');
  assert.equal(homebrew.agent_pack_policy.default_manifest_tag, 'latest');
  assert.equal(homebrew.agent_pack_policy.distribution_format, 'ghcr_oci_artifact');
  assert.equal(homebrew.agent_pack_policy.ordinary_user_channel_model, 'rolling_latest_only');
  assert.equal(homebrew.agent_pack_policy.publication_cadence, 'daily_when_source_digest_changes');
  assert.equal(homebrew.agent_pack_policy.digest_lock_required, true);
  assert.equal(homebrew.agent_pack_policy.stable_or_nightly_user_channels_allowed, false);
  assert.deepEqual(homebrew.agent_pack_policy.post_update_sync_required, [
    'codex_plugin_registry',
    'plugin_packaged_skills',
    'opl_generated_plugin_surface',
    'codex_surface',
  ]);
  assert.equal(homebrew.agent_pack_policy.homebrew_distribution_allowed, false);
  assert.equal(homebrew.agent_pack_policy.homebrew_formula_allowed, false);
  assert.deepEqual(homebrew.agent_pack_policy.forbidden_formulae, ['one-person-lab-modules', 'one-person-lab-modules-nightly']);
  assert.equal(homebrew.agent_pack_policy.must_not_write_user_codex_state, true);
  assert.equal(homebrew.agent_pack_policy.must_not_define_agent_semantics, true);
  assert.deepEqual(homebrew.agent_pack_policy.activation_commands, ['opl connect reconcile-modules', 'opl connect sync-skills']);
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
  assert.match(homebrewWorkflow, /group: opl-homebrew-tap-\$\{\{ inputs\.channel \}\}-\$\{\{ inputs\.opl_version \}\}/);
  assert.doesNotMatch(homebrewWorkflow, /group: opl-homebrew-tap-\$\{\{ inputs\.channel \}\}-\$\{\{ inputs\.package_kind \}\}-\$\{\{ inputs\.opl_version \}\}/);
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
  assert.match(homebrewWorkflow, /opl-release-manifest\.json/);
  assert.doesNotMatch(homebrewWorkflow, /full-package-manifest\.json/);
  assert.doesNotMatch(homebrewWorkflow, /full-local-authorization-policy\.json/);
  assert.match(homebrewWorkflow, /Casks\/one-person-lab-full\.rb/);
  assert.match(homebrewWorkflow, /Full first-install Homebrew cask updates must stay on the stable channel/);
  assert.match(homebrewWorkflow, /Homebrew tap updates are App cask-only; agent packs are App\/CLI-managed/);
  assert.doesNotMatch(homebrewWorkflow, /one-person-lab-modules-\$\{version\}\.tar\.gz/);
  assert.match(homebrewWorkflow, /node --experimental-strip-types scripts\/update-homebrew-tap\.ts[\s\S]*--summary-path "\$RUNNER_TEMP\/homebrew-tap-plan\.json"[\s\S]*--remote-write-mode "direct_commit"[\s\S]*--write/);
  assert.doesNotMatch(homebrewWorkflow, /peter-evans\/create-pull-request@v8/);
  assert.doesNotMatch(homebrewWorkflow, /inputs\.write_mode/);
  assert.match(homebrewWorkflow, /git -C homebrew-tap push origin HEAD:main/);
  assert.match(homebrewWorkflow, /for attempt in 1 2 3/);
  assert.match(homebrewWorkflow, /git -C homebrew-tap fetch origin main/);
  assert.match(homebrewWorkflow, /git -C homebrew-tap rebase origin\/main/);
  assert.match(homebrewWorkflow, /Homebrew tap push failed on attempt \$\{attempt\}; fetching and rebasing before retry/);
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

  assert.deepEqual(releaseContract.release_acceleration.target_architecture.standard_stable_readiness_critical_path, [
    'publish-standard',
    'remote-verify-standard',
    'standard_dmg_clean_vm_smoke',
    'one_shot_app_installer_fresh_install_smoke',
  ]);
  assert.equal(releaseContract.release_acceleration.target_architecture.addon_gate_blocking_default, false);
  assert.equal(
    releaseContract.release_acceleration.target_architecture.addon_requirement_input,
    'require_addon_gates_for_stable_readiness',
  );
  assert.ok(
    releaseContract.release_acceleration.target_architecture.same_cohort_addon_gates.includes('full_first_install_build'),
  );
  assert.ok(
    releaseContract.release_acceleration.target_architecture.same_cohort_addon_gates.includes('webui_ghcr_publish'),
  );

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
        'Docker image declares /data and /projects volumes',
        'Docker image exposes /opt/opl/image-manifest.json and /opt/opl/seed/metadata.json',
        'Stable/latest WebUI image validates as webui-full rather than metadata-only slim',
        'WebUI container starts on port 3000',
        'HTTP / returns 200',
        'HTTP /manifest.webmanifest returns 200',
        'HTTP /api/auth/user returns success with a session cookie without manual username or password',
        'WebUI runtime can call OPL startup maintenance and managed update status through Framework-owned JSON surfaces',
      ],
    },
  );
  assert.equal(stable.required_lanes.includes('operator_evidence_bundle'), false);
  assert.deepEqual(stable.diagnostic_lanes, ['operator_evidence_bundle']);
  for (const scenarioId of stable.required_installation_surfaces) {
    assert.ok(scenarioIds.includes(scenarioId), scenarioId);
  }
});

test('release automation workflows cover remote verification, Full cache warmup, and draft promotion', () => {
  const verifyWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'release-verify-remote.yml'), 'utf8');
  const warmupWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-runtime-cache-warmup.yml'), 'utf8');
  const promoteWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-promote.yml'), 'utf8');
  const cleanupWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-cleanup-drafts.yml'), 'utf8');
  const diagnosticsWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-diagnostics.yml'), 'utf8');
  const cleanupScript = fs.readFileSync(path.join(appRoot, 'scripts', 'cleanup-draft-release-candidates.ts'), 'utf8');
  const webuiCleanupScript = fs.readFileSync(path.join(appRoot, 'scripts', 'cleanup-webui-ghcr-versions.ts'), 'utf8');
  const candidateRecordValidator = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-release-candidate-record.ts'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(verifyWorkflow, /name: OPL Remote Release Verification/);
  assert.match(verifyWorkflow, /runs-on: macos-latest/);
  assert.match(verifyWorkflow, /npm run verify-remote-release/);
  assert.match(verifyWorkflow, /--summary-path remote-release-verification\.json/);
  assert.match(verifyWorkflow, /verify_args\+=\(--include-full-package\)/);
  assert.match(verifyWorkflow, /actions\/upload-artifact@v7/);

  assert.match(warmupWorkflow, /name: OPL Full Runtime Cache Warmup/);
  assert.match(warmupWorkflow, /schedule:/);
  assert.match(warmupWorkflow, /permissions:[\s\S]*contents: write/);
  assert.doesNotMatch(warmupWorkflow, /models: read/);
  assert.match(warmupWorkflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml/);
  assert.match(warmupWorkflow, /publish_to_release: false/);
  assert.match(warmupWorkflow, /force_rebuild_runtime_cache:/);
  assert.doesNotMatch(warmupWorkflow, /secrets: inherit/);

  assert.match(promoteWorkflow, /name: OPL Desktop Release Promote/);
  assert.match(promoteWorkflow, /runs-on: macos-latest/);
  assert.match(promoteWorkflow, /release_run_id:/);
  assert.match(promoteWorkflow, /release_owner_verdict_ref:/);
  assert.match(promoteWorkflow, /release_owner_receipt_ref:/);
  assert.match(promoteWorkflow, /Download release candidate record/);
  assert.match(promoteWorkflow, /Resolve release owner gate/);
  assert.match(promoteWorkflow, /release:candidate-record:resolve-owner/);
  assert.match(promoteWorkflow, /release-candidate-record-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(promoteWorkflow, /npm run release:candidate-record:validate/);
  assert.match(promoteWorkflow, /release-candidate-record-input\/release-candidate-record\.json/);
  assert.equal(
    packageJson.scripts['release:candidate-record:resolve-owner'],
    'node --experimental-strip-types scripts/resolve-release-owner-candidate-record.ts',
  );
  assert.equal(
    packageJson.scripts['release:candidate-record:validate'],
    'node --experimental-strip-types scripts/validate-release-candidate-record.ts --promote-ready',
  );
  assert.match(candidateRecordValidator, /record\.schema !== expectedSchema/);
  assert.match(candidateRecordValidator, /record\.status !== readyStatus/);
  assert.match(candidateRecordValidator, /decision\?\.can_promote !== true/);
  assert.match(candidateRecordValidator, /release_owner_verdict/);
  assert.match(candidateRecordValidator, /release_ready_claim !== false/);
  assert.match(candidateRecordValidator, /release_owner_receipt_recorded/);
  assert.equal(
    releaseContract.operator_evidence_bundle.release_owner_verdict.pending_ref_template,
    'typed_blocker_ref://one-person-lab-app/release-owner/<tag>/verdict-pending',
  );
  assert.deepEqual(
    releaseContract.operator_evidence_bundle.release_owner_verdict.owner_resolution_ref_shapes,
    ['release_owner_verdict_ref', 'release_owner_receipt_ref'],
  );
  assert.ok(
    releaseContract.operator_evidence_bundle.release_owner_verdict.evidence_input_ref_shapes.includes(
      'install_evidence_ref',
    ),
  );
  assert.equal(
    releaseContract.operator_evidence_bundle.release_owner_verdict.evidence_only_can_close_opl_app_release_user_path,
    false,
  );

  const ownerBlocker = JSON.parse(
    fs.readFileSync(
      path.join(appRoot, 'docs', 'delivery', 'release', 'records', 'v26.6.12-release-owner-verdict-pending.json'),
      'utf8',
    ),
  );
  assert.equal(ownerBlocker.schema, 'opl_app_release_owner_typed_blocker_record.v1');
  assert.equal(ownerBlocker.version, '26.6.12');
  assert.equal(ownerBlocker.tag, 'v26.6.12');
  assert.equal(ownerBlocker.status, releaseContract.operator_evidence_bundle.release_owner_verdict.typed_blocker_status);
  assert.equal(
    ownerBlocker.typed_blocker_ref,
    'typed_blocker_ref://one-person-lab-app/release-owner/v26.6.12/verdict-pending',
  );
  assert.equal(ownerBlocker.release_ready_claim, false);
  assert.equal(ownerBlocker.stable_latest_promotion_claim, false);
  assert.equal(ownerBlocker.family_production_ready_claim, false);
  assert.equal(ownerBlocker.can_close_opl_app_release_user_path, false);
  assert.equal(ownerBlocker.release_owner_verdict_ref, null);
  assert.equal(
    ownerBlocker.release_owner_receipt_ref,
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.6.12/receipt-20260612-owner-verdict',
  );
  assert.equal(ownerBlocker.release_owner_acceptance_recorded, true);
  assert.equal(ownerBlocker.stable_latest_recorded, true);
  assert.equal(ownerBlocker.release_candidate_promote_ready, true);
  assert.equal(ownerBlocker.downloaded_artifact_readback.release_candidate_validator_promote_ready, true);
  assert.equal(ownerBlocker.downloaded_artifact_readback.release_owner_verdict_status, 'release_owner_receipt_recorded');
  assert.equal(ownerBlocker.downloaded_artifact_readback.release_owner_resolution_ref_present, true);

  const ownerReceipt = JSON.parse(
    fs.readFileSync(
      path.join(appRoot, 'docs', 'delivery', 'release', 'records', 'v26.6.12-release-owner-receipt.json'),
      'utf8',
    ),
  );
  assert.equal(ownerReceipt.schema, 'opl_app_release_owner_receipt_record.v1');
  assert.equal(ownerReceipt.version, '26.6.12');
  assert.equal(ownerReceipt.tag, 'v26.6.12');
  assert.equal(ownerReceipt.status, 'release_owner_receipt_recorded');
  assert.equal(
    ownerReceipt.release_owner_receipt_ref,
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.6.12/receipt-20260612-owner-verdict',
  );
  assert.equal(
    ownerReceipt.supersedes_typed_blocker_ref,
    'typed_blocker_ref://one-person-lab-app/release-owner/v26.6.12/verdict-pending',
  );
  assert.equal(ownerReceipt.release_candidate_promote_ready, true);
  assert.equal(ownerReceipt.release_ready_claim, false);
  assert.equal(ownerReceipt.stable_latest_promotion_claim, false);
  assert.equal(ownerReceipt.family_production_ready_claim, false);
  assert.equal(ownerReceipt.can_close_opl_app_release_user_path, true);
  assert.equal(ownerReceipt.source_artifact_readback.source_run_id, '27415765472');
  assert.equal(ownerReceipt.source_artifact_readback.release_readiness_failed_required_gate_count, 0);
  assert.equal(ownerReceipt.source_artifact_readback.remote_verified_asset_count, 14);
  assert.equal(ownerReceipt.source_artifact_readback.full_first_install_budget_status, 'passed');
  assert.equal(ownerReceipt.owner_resolution_validation.release_candidate_validator_promote_ready, true);
  assert.equal(ownerReceipt.owner_resolution_validation.release_owner_verdict_status, 'release_owner_receipt_recorded');
  assert.equal(ownerReceipt.owner_resolution_validation.release_owner_resolution_ref_present, true);
  assert.deepEqual(ownerReceipt.owner_resolution_validation.validator_errors, []);
  assert.equal(ownerReceipt.authority_boundary.can_claim_family_production_ready, false);
  assert.equal(ownerReceipt.authority_boundary.can_claim_domain_ready, false);
  assert.equal(ownerReceipt.authority_boundary.can_claim_quality_or_export_ready, false);
  assert.match(promoteWorkflow, /npm run verify-remote-release/);
  assert.match(promoteWorkflow, /gh release edit "v\$\{OPL_RELEASE_VERSION\}"/);
  assert.match(promoteWorkflow, /--draft=false/);
  assert.match(promoteWorkflow, /--latest/);
  assert.match(promoteWorkflow, /Verify published release readback/);
  assert.match(promoteWorkflow, /gh release view "\$tag"[\s\S]*--json tagName,isDraft,isPrerelease,publishedAt,assets/);
  assert.match(promoteWorkflow, /gh release list[\s\S]*--json tagName,isLatest,isDraft,isPrerelease,publishedAt/);
  assert.match(promoteWorkflow, /git ls-remote --exit-code --tags origin "refs\/tags\/\$\{tag\}"/);
  assert.match(promoteWorkflow, /Promoted release is still a draft/);
  assert.match(promoteWorkflow, /Promoted Stable release is not marked latest/);
  assert.match(promoteWorkflow, /Published release \$\{tag\} did not become readable with a matching tag before Homebrew tap update/);

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
  assert.match(diagnosticsWorkflow, /name: OPL Desktop Release Diagnostics/);
  assert.match(diagnosticsWorkflow, /workflow_dispatch:/);
  assert.match(diagnosticsWorkflow, /permissions:[\s\S]*actions: read[\s\S]*contents: read/);
  assert.match(diagnosticsWorkflow, /npm run release:closeout --/);
  assert.match(diagnosticsWorkflow, /--artifact-profile diagnostics/);
  assert.match(diagnosticsWorkflow, /npm run release:actions-timing --/);
  assert.match(diagnosticsWorkflow, /release-diagnostics-\$\{\{ inputs\.opl_version \}\}/);
  assert.doesNotMatch(diagnosticsWorkflow, /contents:\s+write|packages:\s+write|gh release edit|gh release upload|npm run release:publish/);
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
    releaseContract.release_acceleration.github_actions.diagnostics_workflow,
    '.github/workflows/desktop-release-diagnostics.yml',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.promote_workflow,
    '.github/workflows/desktop-release-promote.yml',
  );
  assert.deepEqual(releaseContract.release_acceleration.github_actions.promote_post_publish_readback, {
    workflow_job: 'promote',
    step: 'Verify published release readback',
    checks: [
      'gh release view v<version> returns tagName, isDraft, isPrerelease, publishedAt, and assets',
      'gh release list marks v<version> as latest',
      'release tag exists at refs/tags/v<version>',
      'stable release is non-draft, non-prerelease, latest, published, and has readable assets',
    ],
    rule:
      'The promote workflow must not start Homebrew tap updates until the just-published Stable GitHub Release and matching tag are readable from remote APIs.',
  });
});

test('release workflows resolve moving refs once and pass fixed SHA cohort refs downstream', () => {
  const desktopWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const webuiWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'webui-ghcr-release.yml'), 'utf8');

  assert.match(desktopWorkflow, /framework_ref:[\s\S]*Prefer a fixed SHA; main is resolved once by the source gate/);
  assert.match(desktopWorkflow, /shell_ref:[\s\S]*Prefer a fixed SHA; main is resolved once by the source gate/);
  assert.match(desktopWorkflow, /release-source-gate:[\s\S]*outputs:[\s\S]*app_sha: \$\{\{ steps\.release-source-gate\.outputs\.app_sha \}\}[\s\S]*shell_sha: \$\{\{ steps\.release-source-gate\.outputs\.shell_sha \}\}[\s\S]*framework_sha: \$\{\{ steps\.release-source-gate\.outputs\.framework_sha \}\}/);
  assert.match(desktopWorkflow, /const outputs = \{[\s\S]*app_sha: report\.app_head,[\s\S]*shell_sha: report\.shell_sha,[\s\S]*framework_sha: report\.framework_sha/);
  assert.match(desktopWorkflow, /release source gate did not resolve \$\{name\} to a fixed SHA/);
  assert.match(desktopWorkflow, /standard-build:[\s\S]*ref: \$\{\{ needs\.release-source-gate\.outputs\.app_sha \}\}[\s\S]*shell_ref: \$\{\{ needs\.release-source-gate\.outputs\.shell_sha \}\}/);
  assert.doesNotMatch(workflowJobBlock(desktopWorkflow, 'publish-standard'), /models: read/);
  assert.match(workflowJobBlock(desktopWorkflow, 'prepare-standard-release-notes'), /OPL_RELEASE_NOTES_MODE: template/);
  assert.match(workflowJobBlock(desktopWorkflow, 'prepare-standard-release-notes'), /--input standard-release-notes-template\.md/);
  assert.doesNotMatch(workflowJobBlock(desktopWorkflow, 'prepare-standard-release-notes'), /OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL/);
  assert.doesNotMatch(workflowJobBlock(desktopWorkflow, 'prepare-standard-release-notes'), /OPL_RELEASE_NOTES_CODEX_BASE_URL/);
  assert.match(workflowJobBlock(desktopWorkflow, 'publish-standard'), /OPL_RELEASE_NOTES_FILE: prepared-standard-release-notes\/standard-release-notes\.md/);
  assert.match(workflowJobBlock(desktopWorkflow, 'publish-standard'), /--release-notes-file "\$OPL_RELEASE_NOTES_FILE"/);
  assert.doesNotMatch(workflowJobBlock(desktopWorkflow, 'publish-standard'), /release-notes-ai-writer\.ts --probe-openai-compatible/);
  assert.match(desktopWorkflow, /publish-standard:[\s\S]*outputs:[\s\S]*app_sha: \$\{\{ steps\.release-cohort\.outputs\.app_sha \}\}[\s\S]*shell_sha: \$\{\{ steps\.release-cohort\.outputs\.shell_sha \}\}[\s\S]*framework_sha: \$\{\{ steps\.release-cohort\.outputs\.framework_sha \}\}/);
  assert.doesNotMatch(workflowJobBlock(desktopWorkflow, 'publish-full-assets'), /models: read/);
  assert.match(workflowJobBlock(desktopWorkflow, 'prepare-full-release-notes'), /OPL_RELEASE_NOTES_MODE: template/);
  assert.match(workflowJobBlock(desktopWorkflow, 'prepare-full-release-notes'), /--input full-release-notes-template\.md/);
  assert.doesNotMatch(workflowJobBlock(desktopWorkflow, 'prepare-full-release-notes'), /OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY/);
  assert.doesNotMatch(workflowJobBlock(desktopWorkflow, 'prepare-full-release-notes'), /OPL_RELEASE_NOTES_CODEX_API_KEY/);
  assert.match(workflowJobBlock(desktopWorkflow, 'publish-full-assets'), /OPL_RELEASE_NOTES_FILE: prepared-full-release-notes\/full-release-notes\.md/);
  assert.match(workflowJobBlock(desktopWorkflow, 'publish-full-assets'), /--release-notes-file "\$OPL_RELEASE_NOTES_FILE"/);
  assert.doesNotMatch(workflowJobBlock(desktopWorkflow, 'publish-full-assets'), /release-notes-ai-writer\.ts --probe-openai-compatible/);
  assert.doesNotMatch(desktopWorkflow, /node --experimental-strip-types scripts\/release-notes-ai-writer\.ts --probe-openai-compatible/);
  assert.match(desktopWorkflow, /name: Record fixed release cohort refs[\s\S]*APP_SHA: \$\{\{ needs\.release-source-gate\.outputs\.app_sha \}\}[\s\S]*FRAMEWORK_SHA: \$\{\{ needs\.release-source-gate\.outputs\.framework_sha \}\}/);
  assert.match(desktopWorkflow, /full-first-install:[\s\S]*framework_ref: \$\{\{ needs\.standard-vm-smoke-gate-after-full\.outputs\.framework_sha \}\}[\s\S]*shell_ref: \$\{\{ needs\.standard-vm-smoke-gate-after-full\.outputs\.shell_sha \}\}/);
  assert.match(desktopWorkflow, /standard-first-run-vm-smoke-after-standard-only:[\s\S]*shell_ref: \$\{\{ needs\.publish-standard\.outputs\.shell_sha \}\}/);
  assert.match(desktopWorkflow, /standard-vm-smoke-gate-after-full:[\s\S]*outputs:[\s\S]*framework_sha: \$\{\{ steps\.release-cohort\.outputs\.framework_sha \}\}/);
  assert.match(desktopWorkflow, /one-shot-app-installer-smoke:[\s\S]*repository: gaofeng21cn\/one-person-lab[\s\S]*ref: \$\{\{ needs\.publish-standard\.outputs\.framework_sha \}\}/);
  assert.match(desktopWorkflow, /docker-webui-smoke:[\s\S]*repository: gaofeng21cn\/opl-aion-shell[\s\S]*ref: \$\{\{ needs\.publish-standard\.outputs\.shell_sha \}\}/);
  assert.match(desktopWorkflow, /OPL_FRAMEWORK_SHA: \$\{\{ needs\.publish-standard\.outputs\.framework_sha \}\}/);
  assert.match(desktopWorkflow, /--build-arg OPL_FRAMEWORK_REF="\$\{OPL_FRAMEWORK_SHA\}"/);
  assert.match(desktopWorkflow, /operator-evidence-bundle-validation:[\s\S]*repository: gaofeng21cn\/one-person-lab[\s\S]*ref: \$\{\{ needs\.publish-standard\.outputs\.framework_sha \}\}/);
  assert.match(desktopWorkflow, /OPL_SHELL_REF: \$\{\{ needs\.publish-standard\.outputs\.shell_sha \}\}/);
  assert.match(desktopWorkflow, /OPL_FRAMEWORK_REF: \$\{\{ needs\.publish-standard\.outputs\.framework_sha \}\}/);
  assert.match(desktopWorkflow, /OPL_APP_COMMIT: \$\{\{ needs\.publish-standard\.outputs\.app_sha \}\}/);

  assert.match(webuiWorkflow, /framework_ref:[\s\S]*Prefer a fixed SHA; main is resolved once by the source gate/);
  assert.match(webuiWorkflow, /shell_ref:[\s\S]*Prefer a fixed SHA; main is resolved once by the source gate/);
  assert.match(webuiWorkflow, /name: Validate release source gate[\s\S]*id: release-source-gate[\s\S]*app_sha: report\.app_head,[\s\S]*shell_sha: report\.shell_sha,[\s\S]*framework_sha: report\.framework_sha/);
  assert.match(webuiWorkflow, /--require-shell-format true[\s\S]*--run-shell-tests true/);
  assert.doesNotMatch(webuiWorkflow, /id: shell[\s\S]*git -C shells\/aionui rev-parse HEAD/);
  assert.match(webuiWorkflow, /echo 'SHELL_SHA=\$\{\{ steps\.release-source-gate\.outputs\.shell_sha \}\}'/);
  assert.match(webuiWorkflow, /echo 'OPL_FRAMEWORK_SHA=\$\{\{ steps\.release-source-gate\.outputs\.framework_sha \}\}'/);
  assert.match(webuiWorkflow, /bash scripts\/webui-ghcr-release-step\.sh build/);
  const webuiHelper = fs.readFileSync(path.join(appRoot, 'scripts', 'webui-ghcr-release-step.sh'), 'utf8');
  assert.match(webuiHelper, /--build-arg "OPL_FRAMEWORK_REF=\$\{OPL_FRAMEWORK_SHA\}"/);
  assert.doesNotMatch(webuiWorkflow, /--build-arg OPL_FRAMEWORK_REF="\$\{\{ inputs\.framework_ref \|\| 'main' \}\}"/);
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
