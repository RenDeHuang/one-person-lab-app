import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  require,
  activeShellRoot,
  runNode,
  writeFile,
  writeReleaseMetadata,
  sha256,
  fileSha256,
  workflowStepBlock,
  readProductProfile,
  matchCount,
  workflowJobBlock,
  readFullPackageBuilderSource,
} from './helpers.ts';

test('Full first-install workflow has one MinerU checkout and keeps standalone binary build path', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');

  assert.match(workflow, /npm view @openai\/codex version/);
  assert.match(workflow, /npm install -g "@openai\/codex@\$\{codex_latest\}"/);
  assert.match(workflow, /echo "OPL_FULL_CODEX_VERSION=\$codex_latest" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /\[\[ "\$codex_version" == "codex-cli \$codex_latest" \]\]/);
  assert.match(workflow, /brew install zstd temporal \|\| true/);
  assert.match(workflow, /temporal --version/);
  assert.match(workflow, /echo "OPL_FULL_BUN_BIN=\$\(command -v bun\)" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /echo "OPL_FULL_TEMPORAL_CLI_BIN=\$\(command -v temporal\)" >> "\$GITHUB_ENV"/);
  assert.equal(matchCount(workflow, /name: Checkout MinerU Ecosystem/g), 1);
  assert.equal(matchCount(workflow, /repository: opendatalab\/MinerU-Ecosystem/g), 1);
  assert.equal(matchCount(workflow, /^\s+path: MinerU-Ecosystem$/gm), 1);
  assert.match(workflow, /mineru_root="\$GITHUB_WORKSPACE\/MinerU-Ecosystem\/cli\/mineru-open-api"/);
  assert.match(workflow, /mineru_built_at="\$\(git -C "\$GITHUB_WORKSPACE\/MinerU-Ecosystem" show -s --format=%cI HEAD\)"/);
  assert.doesNotMatch(workflow, /mineru_built_at="\$\(date -u/);
  assert.match(workflow, /cd "\$mineru_root"[\s\S]*go install -ldflags/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /github\.com\/opendatalab\/MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.version=\$mineru_version/);
  assert.match(workflow, /github\.com\/opendatalab\/MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.commit=\$mineru_commit/);
  assert.match(workflow, /github\.com\/opendatalab\/MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.date=\$mineru_built_at/);
  assert.match(workflow, /name: Summarize Full package size/);
  assert.match(workflow, /npm run release:full:size -- --markdown >> "\$GITHUB_STEP_SUMMARY"/);
  assert.match(workflow, /name: Summarize Full caches and timings/);
  assert.match(workflow, /name: Cache Electron artifacts[\s\S]*id: electron-cache/);
  assert.match(workflow, /full-electron-cache-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}/);
  assert.match(workflow, /electron-cache-macos-arm64-arm64-/);
  assert.match(workflow, /ELECTRON_CACHE: \$\{\{ runner\.temp \}\}\/\.cache\/electron/);
  assert.match(workflow, /ELECTRON_BUILDER_CACHE: \$\{\{ runner\.temp \}\}\/\.cache\/electron-builder/);
  assert.match(workflow, /opl-full-runtime-cache-aggregate-key\.json/);
  assert.match(workflow, /export OPL_FULL_BUN_BIN="\$\{OPL_FULL_BUN_BIN:-\$\(command -v bun\)\}"/);
  assert.match(workflow, /export OPL_FULL_TEMPORAL_CLI_BIN="\$\{OPL_FULL_TEMPORAL_CLI_BIN:-\$\(command -v temporal\)\}"/);
  assert.match(workflow, /input\.aggregate_key_input/);
  assert.match(workflow, /toolchain:\s+'toolchain'/);
  assert.match(workflow, /'domain-runtime':\s+'domain_runtime'/);
  assert.match(workflow, /'opl-runtime':\s+'opl_runtime'/);
  assert.match(workflow, /skills:\s+'skills'/);
  assert.match(workflow, /\$\{outputName\}_cache_key=opl-full-runtime-layer-\$\{process\.env\.RUNNER_OS\}-\$\{process\.env\.RUNNER_ARCH\}-\$\{key\}/);
  assert.match(workflow, /name: Restore Full toolchain runtime cache[\s\S]*path: \$\{\{ steps\.runtime-cache-keys\.outputs\.toolchain_cache_dir \}\}/);
  assert.match(workflow, /name: Restore Full domain runtime cache[\s\S]*path: \$\{\{ steps\.runtime-cache-keys\.outputs\.domain_runtime_cache_dir \}\}/);
  assert.match(workflow, /name: Restore Full OPL runtime cache[\s\S]*path: \$\{\{ steps\.runtime-cache-keys\.outputs\.opl_runtime_cache_dir \}\}/);
  assert.match(workflow, /name: Restore Full skills runtime cache[\s\S]*path: \$\{\{ steps\.runtime-cache-keys\.outputs\.skills_cache_dir \}\}/);
  assert.match(workflow, /name: Save Full toolchain runtime cache[\s\S]*key: \$\{\{ steps\.runtime-cache-keys\.outputs\.toolchain_cache_key \}\}/);
  assert.match(workflow, /name: Save Full domain runtime cache[\s\S]*key: \$\{\{ steps\.runtime-cache-keys\.outputs\.domain_runtime_cache_key \}\}/);
  assert.match(workflow, /name: Save Full OPL runtime cache[\s\S]*key: \$\{\{ steps\.runtime-cache-keys\.outputs\.opl_runtime_cache_key \}\}/);
  assert.match(workflow, /name: Save Full skills runtime cache[\s\S]*key: \$\{\{ steps\.runtime-cache-keys\.outputs\.skills_cache_key \}\}/);
  assert.doesNotMatch(workflow, /restore-keys:\s*\|\s*\n\s*opl-full-runtime-layers-/);
  assert.match(workflow, /runtime-cache-events\.json/);
  assert.match(workflow, /full_runtime_layer_events/);
  assert.match(workflow, /full_runtime_layer_key_inputs/);
  assert.match(workflow, /electron_artifacts/);
  assert.match(workflow, /full-package-build-timing\.json/);
  assert.match(workflow, /full_package_build_breakdown/);
  assert.match(workflow, /## Full Package Build Breakdown/);
  assert.match(workflow, /payload_refs:\s+fullManifest\?\.resolved_refs/);
  assert.match(workflow, /resolved_refs:\s+fullManifest\?\.resolved_refs/);
  assert.match(workflow, /## Full Payload Resolved Refs/);
  assert.match(workflow, /requires_distributable_assets="\$\{\{ inputs\.publish_to_release \|\| inputs\.upload_full_package_artifact \}\}"/);
  assert.match(workflow, /echo "OPL_FULL_DISTRIBUTABLE_ASSETS=\$requires_distributable_assets" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /name: Inspect optional Full release signing secrets/);
  assert.match(workflow, /Full first-install local authorization mode/);
  assert.match(workflow, /Missing optional Apple signing secrets: \$\{missing_csv\}/);
  assert.match(workflow, /BUILD_CERTIFICATE_BASE64 P12_PASSWORD APPLE_ID APPLE_ID_PASSWORD TEAM_ID IDENTITY/);
  assert.match(workflow, /Stable Full assets will use local authorization evidence instead of Developer ID notarization/);
  assert.match(workflow, /local-authorization-policy\.ts[\s\S]*--package-kind app_full_first_install/);
  assert.match(workflow, /mounted_app_path="\$\(find "\$mounted_app_dir" -maxdepth 2 -type d -name 'One Person Lab\.app'/);
  assert.match(workflow, /codesign --verify --deep --strict --verbose=2 "\$mounted_app_path" \|\| true/);
  assert.match(workflow, /--app-path "\$mounted_app_path"/);
  assert.match(workflow, /hdiutil detach "\$mounted_app_dir"/);
  assert.match(workflow, /name: Verify release upload plan[\s\S]*if:\s+\$\{\{ inputs\.publish_to_release \|\| inputs\.upload_full_package_artifact \}\}/);
  for (const expected of [
    'gaofeng21cn/one-person-lab',
    'gaofeng21cn/med-autoscience',
    'gaofeng21cn/med-autogrant',
    'gaofeng21cn/redcube-ai',
    'gaofeng21cn/opl-meta-agent',
    'iOfficeAI/OfficeCLI',
    'opendatalab/MinerU-Ecosystem',
    'nextlevelbuilder/ui-ux-pro-max-skill',
  ]) {
    assert.match(`${workflow}\n${fs.readFileSync(path.join(appRoot, 'scripts', 'plan-release-candidate.ts'), 'utf8')}`, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const diagnosticsStep = workflowStepBlock(workflow, 'Upload Full diagnostics artifact');
  const localAuthorizationStep = workflowStepBlock(workflow, 'Upload Full local authorization policy');
  assert.match(workflow, /name:\s+opl-full-diagnostics-\$\{\{ env\.OPL_RELEASE_VERSION \}\}/);
  assert.match(diagnosticsStep, /full-package-build-timing\.json[\s\S]*full-package-manifest\.json[\s\S]*runtime-cache-events\.json[\s\S]*full-runtime-native-trust\.json[\s\S]*full-local-authorization-policy\.json[\s\S]*SHA256SUMS\.txt/);
  assert.doesNotMatch(diagnosticsStep, /full-gatekeeper-launch-policy\.json/);
  assert.match(localAuthorizationStep, /if:\s+\$\{\{ inputs\.publish_to_release \|\| inputs\.upload_full_package_artifact \}\}[\s\S]*full-local-authorization-policy\.json/);
  assert.match(workflow, /upload_full_package_artifact:[\s\S]*default:\s+true/);
  assert.match(workflow, /Upload Full package workflow artifact[\s\S]*if:\s+\$\{\{ inputs\.upload_full_package_artifact \}\}/);
  assert.match(workflow, /bash "\$GITHUB_WORKSPACE\/OfficeCLI\/install\.sh"/);
  assert.doesNotMatch(workflow, /raw\.githubusercontent\.com\/iOfficeAI\/OfficeCLI\/main\/install\.sh/);
  const warmupWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-runtime-cache-warmup.yml'), 'utf8');
  assert.match(warmupWorkflow, /upload_full_package_artifact:\s+false/);
  assert.match(warmupWorkflow, /publish_to_release:\s+false/);
  assert.match(workflow, /node -e 'const fs = require\("node:fs"\); const report = JSON\.parse\(fs\.readFileSync\(process\.argv\[1\], "utf8"\)\);/);
  assert.doesNotMatch(
    workflow,
    /runtime-cache-events\.json[\s\S]{0,400}<<'NODE'[\s\S]{0,400}NODE/,
    'runtime-cache-events summary must not use a nested heredoc; indented heredoc delimiters break bash on GitHub Actions',
  );
  const fullPackageScript = readFullPackageBuilderSource();
  assert.match(fullPackageScript, /verifyDmgAppBundleLocalAuthorization/);
  assert.match(fullPackageScript, /assertAppBundleLocalAuthorization/);
  assert.match(fullPackageScript, /codesign verification must pass even when Stable Full uses local authorization/);
  assert.match(fullPackageScript, /ensureAppBundleAdHocCodesign/);
  assert.match(fullPackageScript, /'--sign', '-'/);
  assert.match(fullPackageScript, /createFullDmgFromVerifiedApp/);
  assert.match(fullPackageScript, /local_authorized_unsigned/);
  assert.doesNotMatch(fullPackageScript, /codesign_status=\$\{codesign\.status === 0 \? 'passed' : 'failed_allowed_unsigned'\}/);
  assert.match(fullPackageScript, /'ditto'/);
  assert.match(fullPackageScript, /'hdiutil'/);
  assert.match(fullPackageScript, /'-srcfolder'/);
  assert.match(fullPackageScript, /ELECTRON_BUILDER_COMPRESSION_LEVEL/);
  const macosTrustScript = fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package', 'macos-trust.ts'), 'utf8');
  assert.match(macosTrustScript, /import os from 'node:os';/);
  assert.match(macosTrustScript, /fs\.mkdtempSync\(path\.join\(os\.tmpdir\(\), 'opl-full-dmg-verify-'\)\)/);
  assert.doesNotMatch(
    fullPackageScript,
    /'--prepackaged'/,
    'Full recovery DMG must be created directly from the verified App bundle; electron-builder prepackaged DMG can drop nested framework signatures',
  );
  assert.match(fullPackageScript, /ensureFullDmgLocalAuthorization\(options\.guiRoot, targetDmg, options\.version\)/);
  assert.doesNotMatch(
    fullPackageScript,
    /if \(!strictMacosRuntimeSigningRequired\(\)\) \{[\s\S]*?verifyDmgAppBundleLocalAuthorization\(targetDmg, 'Full first-install DMG'\);[\s\S]*?return;[\s\S]*?\}/,
    'Stable local authorization mode must rebuild and reverify a bad Full DMG instead of exiting before the recovery path',
  );
});

test('Full package size analyzer reports manifest component and layer budgets', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-size-analysis-'));
  const manifestPath = path.join(tempRoot, 'full-package-manifest.json');
  writeFile(
    manifestPath,
    JSON.stringify({
      manifest_version: 2,
      version: '26.5.27-size',
      package_kind: 'opl_full_first_install_macos_arm64',
      size_budget: {
        platform_scope: 'macos-arm64',
        warning_full_dmg_bytes: 700000000,
        max_full_dmg_bytes: 750000000,
        max_runtime_uncompressed_bytes: 1000,
      },
      size_breakdown: {
        total_runtime_uncompressed_bytes: 500,
        layers: {
          toolchain: {
            size_bytes: 200,
            children: {
              vendor: {
                size_bytes: 150,
                children: {
                  temporal: { size_bytes: 150 },
                },
              },
            },
          },
          'domain-runtime': { size_bytes: 180 },
          'opl-runtime': { size_bytes: 100 },
          skills: { size_bytes: 20 },
        },
      },
      components: {
        mas: { size_bytes: 180, git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        codex: { size_bytes: 120, version: 'codex-cli 0.130.0' },
        opl: { size_bytes: 100, git_commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      },
    }, null, 2),
  );

  const jsonResult = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
  ]);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const summary = JSON.parse(jsonResult.stdout);
  assert.equal(summary.version, '26.5.27-size');
  assert.equal(summary.warning_full_dmg_bytes, 700000000);
  assert.equal(summary.max_full_dmg_bytes, 750000000);
  assert.equal(summary.runtime_budget_used_percent, 50);
  assert.equal(summary.components[0].id, 'mas');
  assert.equal(summary.layers[0].id, 'toolchain');
  assert.equal(summary.manifest_size_hotspots[2].path, 'toolchain/vendor');
  assert.equal(summary.manifest_size_hotspots[3].path, 'toolchain/vendor/temporal');

  const markdownResult = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
    '--markdown',
  ]);
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /## Full Package Size/);
  assert.match(markdownResult.stdout, /\| Component \| Size \| Runtime % \| Version \/ Commit \|/);
  assert.match(markdownResult.stdout, /mas/);
  assert.match(markdownResult.stdout, /50% used/);
  assert.match(markdownResult.stdout, /Full DMG warning threshold: 667\.6 MiB/);
  assert.match(markdownResult.stdout, /Full DMG review threshold: 715\.3 MiB/);
  assert.match(markdownResult.stdout, /Runtime budget: 1000 B \(50% used\)/);
  assert.match(markdownResult.stdout, /\| mas \| 180 B \| 36% \|/);
  assert.match(markdownResult.stdout, /### Manifest Size Hotspots/);
  assert.match(markdownResult.stdout, /\| toolchain\/vendor\/temporal \| 150 B \|/);
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

test('desktop release publish job runs TypeScript asset scripts under Node 22', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const publishStandard = workflowJobBlock(workflow, 'publish-standard');

  assert.match(
    publishStandard,
    /name: Checkout active shell[\s\S]*repository: gaofeng21cn\/opl-aion-shell[\s\S]*path: shells\/aionui[\s\S]*name: Setup Node\.js[\s\S]*uses: actions\/setup-node@v6[\s\S]*node-version: '22'[\s\S]*node --experimental-strip-types scripts\/prepare-release-assets\.ts/,
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

  const validator = require(path.join(activeShellRoot, 'scripts', 'validate-packaged-runtime.js'));
  const optional = validator.validateFullRuntimeResources(resourcesRoot, { require: false });
  const required = validator.validateFullRuntimeResources(resourcesRoot, { require: true });

  assert.equal(optional.checked, false);
  assert.deepEqual(optional.issues, []);
  assert.equal(required.checked, false);
  assert.match(required.issues.join('\n'), /missing opl-full-runtime extraResource/);
});

test('Full first-install manifest declares App-owned distribution and Framework payload role', async () => {
  const mod = await import('../../../scripts/full-first-install-package.ts');
  const manifest = mod.buildFullPackageManifest({ version: '26.5.15' });

  assert.equal(manifest.manifest_version, 2);
  assert.deepEqual(manifest.size_budget, {
    platform_scope: 'macos-arm64',
    warning_full_dmg_bytes: 700000000,
    max_full_dmg_bytes: 750000000,
    max_runtime_uncompressed_bytes: 1000000000,
  });
  assert.deepEqual(manifest.measurement_policy, {
    full_dmg_bytes: 'github_release_asset_size_bytes',
    runtime_uncompressed_bytes: 'manifest_size_breakdown_total_runtime_uncompressed_bytes',
  });
  assert.deepEqual(manifest.runtime_assertions, {
    temporal_core_bridge_releases: [],
    excluded_module_venv_count: 0,
    packaged_global_node_packages: [],
  });
  assert.deepEqual(Object.keys(manifest.size_breakdown.layers), [
    'toolchain',
    'domain-runtime',
    'opl-runtime',
    'skills',
  ]);
  assert.equal(manifest.distribution.owner_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(manifest.distribution.updater_metadata_allowed, false);
  assert.equal(
    manifest.runtime.domain_module_payload_policy,
    'packaged_runtime_modules_are_launch_sources; managed repo reconciliation is deferred maintenance',
  );
  assert.equal(manifest.components.opl.role, 'framework_cli_and_shared_contracts_payload_source');
});

test('Full first-install payload boundary stays assembly-only', async () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const mod = await import('../../../scripts/full-first-install-package.ts');
  const manifest = mod.buildFullPackageManifest({ version: '26.5.15' });
  const profile = readProductProfile();
  const codexProfilePhrase = `${profile.codex.default_model} with ${profile.codex.default_reasoning_effort} reasoning`;

  assert.equal(
    releaseContract.full_first_install.payload_boundary.role,
    'declared_payload_assembly_and_validation',
  );
  assert.equal(releaseContract.full_first_install.generated_companion_text_language, 'en');
  assert.equal(releaseContract.full_first_install.updater_visible, false);
  assert.equal(releaseContract.full_first_install.updater_metadata_allowed, false);
  assert.equal(releaseContract.full_first_install.same_tag_refresh.mode, 'github_release_upload_clobber');
  assert.deepEqual(releaseContract.full_first_install.required_payloads.codex_cli, {
    compatibility_mode: 'minimum_version_plus_capability_smoke',
    minimum_version_source: 'distribution cohort manifest components.codex_cli.minimum_version',
    preferred_sources: ['explicit_user_path', 'system_path', 'homebrew_formula'],
    fallback_version_source: 'distribution cohort manifest components.codex_cli.fallback_version',
    fallback_runtime_path: 'runtime/current/bin/codex',
    fallback_payload_path: 'runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz',
    must_prefer_valid_newer_user_version: true,
    verification: 'codex --version must satisfy minimum_version, bundled fallback must execute offline from the packaged archive wrapper, and Codex functional smoke must pass',
  });
  assert.equal(releaseContract.full_first_install.required_payloads.bun_cli, undefined);
  assert.deepEqual(releaseContract.full_first_install.optional_payloads.bun_cli, {
    source: 'Full workflow setup-bun resolved binary',
    runtime_path: 'runtime/current/bin/bun',
    default_packaged: false,
    enable_env: 'OPL_FULL_INCLUDE_BUN_RUNTIME=1',
    verification: 'Full manifest optional_components.bun records packaged or not_packaged status',
  });
  assert.deepEqual(releaseContract.full_first_install.required_payloads.temporal_cli, {
    compatibility_mode: 'minimum_version_plus_capability_smoke',
    minimum_version_source: 'distribution cohort manifest components.temporal_cli.minimum_version',
    preferred_sources: ['explicit_user_path', 'system_path', 'homebrew_formula'],
    fallback_version_source: 'distribution cohort manifest components.temporal_cli.fallback_version',
    fallback_runtime_path: 'runtime/current/bin/temporal',
    fallback_payload_path: 'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz',
    must_prefer_valid_newer_user_version: true,
    verification: 'temporal --version must satisfy minimum_version, bundled fallback must execute offline from the packaged archive wrapper, and Temporal provider smoke must pass',
  });
  assert.deepEqual(releaseContract.full_first_install.required_payloads.temporal_runtime_provider, {
    provider_env_default: 'OPL_FAMILY_RUNTIME_PROVIDER=temporal',
    local_service_defaults: {
      address_env: 'OPL_TEMPORAL_ADDRESS',
      default_address: '127.0.0.1:7233',
      namespace_env: 'OPL_TEMPORAL_NAMESPACE',
      default_namespace: 'default',
      task_queue_env: 'OPL_TEMPORAL_TASK_QUEUE',
      default_task_queue: 'opl-stage-attempts',
    },
    managed_commands: [
      'opl family-runtime service start --provider temporal',
      'opl family-runtime worker status --provider temporal',
      'opl family-runtime worker start --provider temporal',
      'opl family-runtime residency proof --provider temporal --production',
    ],
    required_packages: [
      '@temporalio/activity',
      '@temporalio/client',
      '@temporalio/common',
      '@temporalio/worker',
      '@temporalio/workflow',
    ],
    forbidden_packages: ['@temporalio/testing'],
    native_core_bridge_releases: ['aarch64-apple-darwin'],
    verification: 'Full manifest runtime_assertions.temporal_core_bridge_releases must be exactly aarch64-apple-darwin and wrapper must export local Temporal defaults',
  });
  assert.deepEqual(
    manifest.distribution.payload_boundary.app_repo_does_not_own,
    releaseContract.full_first_install.payload_boundary.forbidden_authority,
  );
  assert.equal(manifest.distribution.product_profile_contract, 'contracts/app-product-profile.json');
  assert.deepEqual(
    manifest.distribution.product_profile.default_packaged_codex_skill_ids,
    profile.companion_payloads.default_packaged_codex_skill_ids,
  );
  assert.deepEqual(
    manifest.distribution.product_profile.packaged_not_default_visible_codex_skill_ids,
    profile.companion_payloads.packaged_not_default_visible_codex_skill_ids,
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
    manifest.distribution.payload_boundary.truth_sources.foundry_agent_domain_truth,
    'gaofeng21cn/opl-meta-agent',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.grant_domain_truth,
    'gaofeng21cn/med-autogrant',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.visual_deliverable_domain_truth,
    'gaofeng21cn/redcube-ai',
  );
  assert.equal(manifest.components.mineru_open_api.role, 'document_extraction_cli_binary');
  assert.equal(
    manifest.components.skills.role,
    'packaged_codex_skills_declared_by_app_product_profile',
  );
  assert.equal(manifest.components.codex.role, 'default_agent_cli_offline_archive_wrapper');
  assert.equal(manifest.components.codex.required, true);
  assert.equal(manifest.components.codex.binary_path, null);
  assert.equal(
    manifest.components.codex.archive_path,
    'runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz',
  );
  assert.equal(manifest.components.temporal_cli.role, 'temporal_cli_offline_archive_wrapper');
  assert.equal(manifest.components.temporal_cli.required, true);
  assert.equal(manifest.optional_components.bun.role, 'optional_bun_cli_runtime_payload');
  assert.equal(manifest.optional_components.bun.required, false);
  assert.equal(manifest.optional_components.bun.status, 'not_packaged');
  const fullReadme = mod.buildFullFirstInstallReadme({
    version: '26.5.15',
    dmgName: 'One-Person-Lab-Full-26.5.15-mac-arm64.dmg',
    runtimeTarName: null,
    notarized: false,
  });
  assert.match(fullReadme, /The Full package only assembles and validates declared framework\/runtime, domain module, and companion tool payloads/);
  assert.match(fullReadme, /OPL Meta Agent/);
  assert.match(fullReadme, /mineru-open-api CLI binary/);
  assert.match(fullReadme, /mineru-document-extractor/);
  assert.ok(fullReadme.includes(codexProfilePhrase));
  assert.match(fullReadme, /deferred maintenance and does not block first launch/);
  assert.match(fullReadme, /without requiring Command Line Tools or git to finish first/);
  assert.doesNotMatch(fullReadme, /materialized under the standard module directory/);
  assert.doesNotMatch(fullReadme, /[\u3400-\u9fff]/);
});

test('Full first-install cache and release acceleration contract are explicit', async () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const buildScript = readFullPackageBuilderSource();
  const fullWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');
  const publishScript = fs.readFileSync(path.join(appRoot, 'scripts', 'publish-release.ts'), 'utf8');
  const prepareStandardScript = fs.readFileSync(path.join(appRoot, 'scripts', 'prepare-standard-release-payload.ts'), 'utf8');
  const electronBuilder = fs.readFileSync(path.join(activeShellRoot, 'packages', 'desktop', 'electron-builder.yml'), 'utf8');
  const mod = await import('../../../scripts/full-first-install-package.ts');
  const cacheDir = path.join(os.tmpdir(), 'opl-full-runtime-cache-test');
  const cacheKey = mod.buildFullRuntimeCacheKey({
    layerId: 'opl-runtime',
    parts: {
      opl_commit: '1111111111111111111111111111111111111111',
      package_lock_sha256: '2222222222222222222222222222222222222222222222222222222222222222',
    },
  });
  const cacheMiss = mod.classifyFullRuntimeLayerCache({
    mode: 'readwrite',
    cacheDir,
    layerId: 'opl-runtime',
    key: cacheKey,
    archiveExists: false,
  });
  const cacheHit = mod.classifyFullRuntimeLayerCache({
    mode: 'readwrite',
    cacheDir,
    layerId: 'opl-runtime',
    key: cacheKey,
    archiveExists: true,
  });
  const readonlyMiss = mod.classifyFullRuntimeLayerCache({
    mode: 'readonly',
    cacheDir,
    layerId: 'opl-runtime',
    key: cacheKey,
    archiveExists: false,
  });
  const disabled = mod.classifyFullRuntimeLayerCache({
    mode: 'off',
    cacheDir,
    layerId: 'opl-runtime',
    key: cacheKey,
    archiveExists: true,
  });

  assert.equal(packageJson.scripts['release:plan'], 'node --experimental-strip-types scripts/plan-release-candidate.ts');
  assert.equal(
    packageJson.scripts['release:readiness-summary'],
    'node --experimental-strip-types scripts/summarize-release-readiness.ts',
  );
  assert.equal(
    packageJson.scripts['release:full:size'],
    'node --experimental-strip-types scripts/analyze-full-package-size.ts',
  );
  assert.equal(releaseContract.release_acceleration.full_runtime_cache.enabled_by_default, true);
  assert.deepEqual(releaseContract.release_acceleration.full_runtime_cache.layer_ids, mod.FULL_RUNTIME_CACHE_LAYER_IDS);
  assert.deepEqual(releaseContract.release_acceleration.full_runtime_packaging_hygiene.local_state_excluded, [
    '.codegraph',
    '.git',
    '.worktrees',
    '.venv',
    'node_modules',
    'runtime',
    'runtime-state',
    'runs',
    'sessions',
    'tests',
  ]);
  assert.equal(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.measurement_command,
    'npm run release:full:size -- --markdown',
  );
  assert.equal(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.domain_runtime_allowlist_owner,
    'domain_repositories',
  );
  assert.deepEqual(releaseContract.release_acceleration.publish_resume.match_fields, ['asset_name', 'size', 'sha256']);
  assert.equal(releaseContract.release_acceleration.publish_resume.upload_order, 'largest_assets_first_then_name');
  assert.equal(releaseContract.release_acceleration.publish_resume.upload_mode, 'one_asset_per_gh_release_upload_command');
  assert.equal(releaseContract.release_acceleration.publish_resume.upload_attempts, 3);
  assert.equal(releaseContract.release_acceleration.publish_resume.upload_timeout_ms, 300000);
  assert.deepEqual(releaseContract.release_acceleration.publish_resume.new_release_upload_failure_cleanup, {
    enabled: true,
    scope: 'release created by the current publish invocation before asset upload',
    command: 'gh release delete <tag> --repo <repo> --yes --cleanup-tag',
    existing_release_refresh_cleanup_allowed: false,
    rule: 'If standard or Full asset upload fails after creating a new draft or release, delete that newly-created incomplete release and tag so the next same-cohort attempt starts from a clean remote state.',
  });
  assert.equal(cacheMiss.status, 'miss_written');
  assert.equal(cacheMiss.build_layer, true);
  assert.equal(cacheMiss.write_archive, true);
  assert.equal(cacheMiss.read_archive, false);
  assert.equal(cacheHit.status, 'hit');
  assert.equal(cacheHit.build_layer, false);
  assert.equal(cacheHit.read_archive, true);
  assert.equal(cacheHit.write_archive, false);
  assert.equal(readonlyMiss.status, 'miss_readonly');
  assert.equal(readonlyMiss.build_layer, true);
  assert.equal(readonlyMiss.write_archive, false);
  assert.equal(disabled.status, 'disabled');
  assert.equal(disabled.archive_path, null);
  assert.equal(mod.FULL_RUNTIME_CACHE_AGGREGATE_KEY_SCHEMA, 'opl_full_runtime_cache_aggregate_key.v1');
  assert.deepEqual(
    mod.buildFullRuntimeAggregateCacheKeyInput({
      layers: {
        toolchain: 'full-runtime-v1-toolchain-a',
        'domain-runtime': 'full-runtime-v1-domain-runtime-b',
        'opl-runtime': 'full-runtime-v1-opl-runtime-c',
        skills: 'full-runtime-v1-skills-d',
      },
    }),
    {
      schema: 'opl_full_runtime_cache_aggregate_key.v1',
      layout_version: 1,
      layer_ids: ['toolchain', 'domain-runtime', 'opl-runtime', 'skills'],
      layers: {
        toolchain: 'full-runtime-v1-toolchain-a',
        'domain-runtime': 'full-runtime-v1-domain-runtime-b',
        'opl-runtime': 'full-runtime-v1-opl-runtime-c',
        skills: 'full-runtime-v1-skills-d',
      },
    },
  );
  assert.match(cacheHit.archive_path, /opl-runtime/);
  assert.match(buildScript, /Library', 'Caches', 'One Person Lab', 'full-runtime-layers'/);
  assert.match(buildScript, /runtimeCacheMode: process\.env\.OPL_FULL_RUNTIME_CACHE_MODE \|\| 'readwrite'/);
  assert.match(buildScript, /CODEX_MACOS_ARM64_TARGET = 'aarch64-apple-darwin'/);
  assert.match(buildScript, /siblingPlatformVendorRoot/);
  assert.match(buildScript, /const vendorRoots = \[siblingPlatformVendorRoot, platformVendorRoot, localVendorRoot\]/);
  assert.match(buildScript, /codexCandidatesForVendorRoot/);
  assert.match(buildScript, /rgCandidatesForVendorRoot/);
  assert.match(buildScript, /const vendorRoot = requireFirstVendorRoot\(\)/);
  assert.match(buildScript, /return \{\s*vendorRoot,/);
  assert.match(buildScript, /function findNodeToolchain\(explicitNodeBin\)/);
  assert.match(buildScript, /npmBin: requireNodeToolchainFile\(nodeBinDir, 'npm'/);
  assert.match(buildScript, /npxBin: requireNodeToolchainFile\(nodeBinDir, 'npx'/);
  assert.match(buildScript, /npmRoot: requireNodeToolchainDirectory\(path\.join\(nodeRoot, 'lib', 'node_modules', 'npm'\)/);
  assert.match(buildScript, /bunBin: process\.env\.OPL_FULL_BUN_BIN \|\| ''/);
  assert.match(buildScript, /includeBunRuntime: process\.env\.OPL_FULL_INCLUDE_BUN_RUNTIME === '1'/);
  assert.match(buildScript, /temporalCliBin: process\.env\.OPL_FULL_TEMPORAL_CLI_BIN \|\| ''/);
  assert.match(buildScript, /temporalCliArchive: process\.env\.OPL_FULL_TEMPORAL_CLI_ARCHIVE \|\| ''/);
  assert.doesNotMatch(buildScript, /--hermes-root/);
  assert.match(buildScript, /else if \(token === '--bun-bin'\) parsed\.bunBin = path\.resolve\(value\)/);
  assert.match(buildScript, /token === '--include-bun-runtime'/);
  assert.match(buildScript, /else if \(token === '--temporal-cli-bin'\) parsed\.temporalCliBin = path\.resolve\(value\)/);
  assert.match(buildScript, /else if \(token === '--temporal-cli-archive'\) parsed\.temporalCliArchive = path\.resolve\(value\)/);
  assert.match(buildScript, /function findBunBinary\(explicitBunBin\)/);
  assert.match(buildScript, /function findTemporalCliBinary\(explicitBin\)/);
  assert.match(buildScript, /function findTemporalCliArchive\(explicitArchive\)/);
  assert.match(buildScript, /options\.includeBunRuntime \? findBunBinary\(options\.bunBin\) : null/);
  assert.match(buildScript, /findTemporalCliArchive,/);
  assert.match(buildScript, /copyPortableTree,\s+copyExecutableOrSymlinkTarget,\s+copyNodeRuntimePayload,\s+writeCodexCliWrapper,\s+createCodexCliArchive,\s+writeTemporalCliWrapper,\s+assertNoExternalSymlinks,/);
  assert.match(buildScript, /if \(sources\.bunBin\) {\s*copySingleFile\(sources\.bunBin, path\.join\(layerRoot, 'bin', 'bun'\)\);\s*}/);
  assert.match(buildScript, /copySingleFile\(sources\.temporalCliArchive, path\.join\(layerRoot, 'vendor', 'temporal', 'temporal_cli_darwin_arm64\.tar\.gz'\)\)/);
  assert.doesNotMatch(buildScript, /extractTemporalCliBinary\(sources\.temporalCliArchive, path\.join\(layerRoot, 'vendor', 'temporal', 'cli', 'temporal'\)\)/);
  assert.doesNotMatch(buildScript, /function extractTemporalCliBinary/);
  assert.match(buildScript, /writeTemporalCliWrapper\(path\.join\(layerRoot, 'bin', 'temporal'\), commandOutput\(sources\.temporalCliBin, \['--version'\]\)\)/);
  assert.match(buildScript, /function writeTemporalCliWrapper\(targetPath, versionOutput\)/);
  assert.match(buildScript, /TEMPORAL_VERSION_OUTPUT=\$\{shellSingleQuote\(versionOutput\)\}/);
  assert.match(buildScript, /if \[\[ "\\\$\{1:-\}" == "--version" \]\]/);
  assert.match(buildScript, /ARCHIVE="\$RUNTIME_HOME\/vendor\/temporal\/temporal_cli_darwin_arm64\.tar\.gz"/);
  assert.match(buildScript, /TEMPORAL_BIN="\$EXTRACT_ROOT\/temporal"/);
  assert.match(buildScript, /tar -xzf "\$ARCHIVE" -C "\$EXTRACT_ROOT"/);
  assert.match(buildScript, /copyNodeRuntimePayload\(path\.dirname\(path\.dirname\(sources\.nodeToolchain\.nodeBin\)\), path\.join\(layerRoot, 'node'\)\)/);
  assert.match(buildScript, /function copyNodeRuntimePayload\(nodeRoot, targetRoot\)/);
  assert.match(buildScript, /for \(const relativePath of \['bin\/node', 'bin\/npm', 'bin\/npx'\]\)/);
  assert.match(buildScript, /for \(const packageName of \['npm', 'corepack'\]\)/);
  assert.match(buildScript, /assertNoExternalSymlinks\(targetRoot, 'Full first-install Node runtime'\)/);
  assert.match(buildScript, /function assertNoExternalSymlinks\(root, label\)/);
  assert.match(buildScript, /path\.isAbsolute\(linkTarget\) \|\| !isInsidePath\(rootPath, resolvedTarget\)/);
  assert.match(buildScript, /npm_bin_sha256: fileSha256\(sources\.nodeToolchain\.npmBin\)/);
  assert.match(buildScript, /npx_bin_sha256: fileSha256\(sources\.nodeToolchain\.npxBin\)/);
  assert.match(buildScript, /npm_package_version: packageJsonVersion\(path\.join\(sources\.nodeToolchain\.npmRoot, 'package\.json'\)\)/);
  assert.match(buildScript, /npm_package_fingerprint: directoryFingerprint\(sources\.nodeToolchain\.npmRoot, 'node\/lib\/node_modules\/npm'\)/);
  assert.match(buildScript, /bun_runtime_included: options\.includeBunRuntime/);
  assert.match(buildScript, /bun_sha256: sources\.bunBin \? fileSha256\(sources\.bunBin\) : null/);
  assert.match(buildScript, /temporal_cli_sha256: fileSha256\(sources\.temporalCliBin\)/);
  assert.match(buildScript, /temporal_cli_version: commandOutput\(sources\.temporalCliBin, \['--version'\]\)/);
  assert.match(buildScript, /temporal_cli_archive_sha256: fileSha256\(sources\.temporalCliArchive\)/);
  assert.match(buildScript, /packaged_global_node_packages: fs\.existsSync\(path\.join\(runtimeRoot, 'node', 'lib', 'node_modules'\)\)/);
  assert.match(buildScript, /optionalComponents = \{[\s\S]*bun: sources\.bunBin/);
  assert.match(buildScript, /status: 'not_packaged'/);
  assert.match(buildScript, /temporal_cli: \{[\s\S]*source_path: sources\.temporalCliBin/);
  assert.match(buildScript, /function copyOplMetaAgentSkill\(targetRoot, options\)/);
  assert.match(buildScript, /'agent', 'skills', 'opl-meta-agent-domain-skill\.md'/);
  assert.match(buildScript, /fs\.copyFileSync\(domainSkill, path\.join\(target, 'SKILL\.md'\)\)/);
  assert.match(buildScript, /\['knowledge', 'prompts', 'quality_gates', 'skills', 'stages'\]/);
  assert.match(buildScript, /function copySuperpowersBundle\(targetRoot, options\)/);
  assert.match(buildScript, /path\.join\(sourceRoot, 'skills'\)/);
  assert.match(buildScript, /path\.join\(skillsRoot, 'using-superpowers', 'SKILL\.md'\)/);
  assert.match(buildScript, /superpowers: \(targetRoot, options\) => copySuperpowersBundle\(targetRoot, options\)/);
  assert.match(buildScript, /superpowers_fingerprint: directoryFingerprint\(options\.superpowersRoot, 'skills\/superpowers'\)/);
  assert.match(fullWorkflow, /repository: obra\/superpowers/);
  assert.match(fullWorkflow, /path: superpowers/);
  assert.match(fullWorkflow, /OPL_FULL_SUPERPOWERS_ROOT="\$GITHUB_WORKSPACE\/superpowers"/);
  assert.match(buildScript, /cron: \(targetRoot\) => copyFirstSkillSource\('cron', targetRoot, appCompanionSkillCandidates\('cron'\)\)/);
  assert.match(buildScript, /'opl-meta-agent': \(targetRoot, options\) => copyOplMetaAgentSkill\(targetRoot, options\)/);
  assert.match(buildScript, /pdf: \(targetRoot\) => copyFirstSkillSource\('pdf', targetRoot, appCompanionSkillCandidates\('pdf'\)\)/);
  assert.match(
    buildScript,
    /'mineru-document-extractor': \(targetRoot, options\) => copyFirstSkillSource\(\s*'mineru-document-extractor'/,
  );
  assert.match(buildScript, /copySingleFile\(sources\.mineruOpenApiBin, path\.join\(layerRoot, 'bin', 'mineru-open-api'\)\)/);
  assert.match(buildScript, /version: commandOutput\(sources\.mineruOpenApiBin, \['version'\]\)/);
  assert.match(buildScript, /plugins', 'opl-meta-agent', 'skills', 'opl-meta-agent'/);
  assert.match(buildScript, /function masSkillCandidates\(options\)[\s\S]*options\.masRoot[\s\S]*\.codex', 'skills', 'mas'/);
  assert.match(buildScript, /copyFirstSkillSource\('mas', targetRoot, masSkillCandidates\(options\)\)/);
  assert.match(buildScript, /meta_agent_skill_source: metaAgentSkillSnapshot\(options\)/);
  assert.match(buildScript, /cron_skill_source: skillSourceSnapshot\(appCompanionSkillCandidates\('cron'\), 'skills\/cron'\)/);
  assert.match(buildScript, /pdf_skill_source: skillSourceSnapshot\(appCompanionSkillCandidates\('pdf'\), 'skills\/pdf'\)/);
  assert.match(buildScript, /mineru_document_extractor_source: skillSourceSnapshot\(mineruDocumentExtractorSkillCandidates\(options\), 'skills\/mineru-document-extractor'\)/);
  assert.match(buildScript, /runtime_layer_builder_source_hash: functionSourceSha256/);
  assert.match(buildScript, /key_inputs: cacheKeyInputs/);
  assert.match(buildScript, /guiRoot: process\.env\.OPL_FULL_GUI_ROOT \|\| resolveActiveShellPaths\(\)\.shellRoot/);
  assert.doesNotMatch(buildScript, /guiRoot: process\.env\.OPL_FULL_GUI_ROOT \|\| path\.join\(appRepoRoot, 'shells', 'aionui'\)/);
  assert.match(buildScript, /syncAppProductProfileToShell\(options\.guiRoot\)/);
  const fullRuntimeWrapperScript = fs.readFileSync(
    path.join(appRoot, 'scripts', 'full-first-install-runtime-wrappers.ts'),
    'utf8',
  );
  assert.match(fullRuntimeWrapperScript, /OPL_MODULE_PATH_MEDAUTOSCIENCE="\$RUNTIME_HOME\/modules\/mas"/);
  assert.match(fullRuntimeWrapperScript, /OPL_MODULE_PATH_MEDAUTOGRANT="\$RUNTIME_HOME\/modules\/mag"/);
  assert.match(fullRuntimeWrapperScript, /OPL_MODULE_PATH_REDCUBE="\$RUNTIME_HOME\/modules\/rca"/);
  assert.match(fullRuntimeWrapperScript, /OPL_MODULE_PATH_OPLMETAAGENT="\$RUNTIME_HOME\/modules\/meta-agent"/);
  assert.match(fullRuntimeWrapperScript, /OPL_TEMPORAL_ADDRESS="\\\$\{OPL_TEMPORAL_ADDRESS:-127\.0\.0\.1:7233\}"/);
  assert.match(fullRuntimeWrapperScript, /OPL_TEMPORAL_NAMESPACE="\\\$\{OPL_TEMPORAL_NAMESPACE:-default\}"/);
  assert.match(fullRuntimeWrapperScript, /OPL_TEMPORAL_TASK_QUEUE="\\\$\{OPL_TEMPORAL_TASK_QUEUE:-opl-stage-attempts\}"/);
  assert.match(prepareStandardScript, /syncAppProductProfileToShell\(shellPaths\.shellRoot, \{ optional: true \}\)/);
  assert.match(prepareStandardScript, /fs\.copyFileSync\(appInstallerPath, shellBootstrapInstallerPath\)/);
  assert.match(prepareStandardScript, /fs\.chmodSync\(shellBootstrapInstallerPath, 0o755\)/);
  assert.match(electronBuilder, /from: resources\/opl-install\.sh\s+to: opl-install\.sh/);
  assert.match(
    buildScript,
    /if \(cacheEvent\.read_archive\) {\s*extractLayer\(archivePath, targetRoot\);\s*return {\s*\.\.\.cacheEvent,\s*duration_seconds: durationSeconds\(startedAt, monotonicSeconds\(\)\),\s*};\s*}\s*const tempLayerRoot/,
  );
  assert.match(buildScript, /duration_seconds: durationSeconds\(startedAt, monotonicSeconds\(\)\)/);
  assert.match(buildScript, /aggregate_key_input: buildFullRuntimeAggregateCacheKeyInput\(\{ layers \}\)/);
  assert.match(buildScript, /artifactNames\.runtimeCacheEvents/);
  assert.match(publishScript, /skipped_existing_artifacts/);
  assert.match(publishScript, /--force-upload/);
  assert.match(publishScript, /cleanupNewlyCreatedReleaseAfterUploadFailure/);
  assert.match(publishScript, /'release', 'delete', tag, '--repo', repo, '--yes', '--cleanup-tag'/);
});

test('Full runtime pruning keeps macOS arm64 launch payloads without development environments', async () => {
  const mod = await import('../../../scripts/full-first-install-package.ts');
  const buildScript = readFullPackageBuilderSource();

  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/.venv/lib/python3.12/site-packages/numpy/core.so'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mag/.venv/pyvenv.cfg'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/node_modules/@types/node/index.d.ts'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/src/med_autoscience/__init__.py'), false);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/contracts/runtime-program/schema.json'), false);
  assert.equal(
    mod.shouldExcludeRuntimePath('modules/meta-agent/runtime/authority_functions/meta-agent-authority-functions.json'),
    false,
  );
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/runtime/legacy-state.json'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/.codegraph/codegraph.db'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/.codegraph/codegraph.db-wal'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/runtime-state/quest/output.png'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/runs/2026-05-27/result.json'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/prompts/xiaohongshu/style-references/ref.png'), false);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/assets/branding/logo.png'), false);
  assert.match(buildScript, /MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET = 'aarch64-apple-darwin'/);
  assert.match(buildScript, /pruneTemporalCoreBridgeReleases\(path\.join\(targetRoot, 'node_modules'\)\)/);
  assert.match(buildScript, /assertTemporalCoreBridgeMacosArm64Only\(path\.join\(runtimeRoot, 'opl', 'node_modules'\)\)/);
  assert.match(buildScript, /runtimeAssertions: collectRuntimeAssertions\(runtimeRoot\)/);
  assert.match(buildScript, /bunBin: process\.env\.OPL_FULL_BUN_BIN \|\| ''/);
  assert.match(buildScript, /includeBunRuntime: process\.env\.OPL_FULL_INCLUDE_BUN_RUNTIME === '1'/);
  assert.match(buildScript, /temporalCliBin: process\.env\.OPL_FULL_TEMPORAL_CLI_BIN \|\| ''/);
  assert.match(buildScript, /temporalCliArchive: process\.env\.OPL_FULL_TEMPORAL_CLI_ARCHIVE \|\| ''/);
  assert.match(buildScript, /else if \(token === '--bun-bin'\) parsed\.bunBin = path\.resolve\(value\)/);
  assert.match(buildScript, /token === '--include-bun-runtime'/);
  assert.match(buildScript, /else if \(token === '--temporal-cli-bin'\) parsed\.temporalCliBin = path\.resolve\(value\)/);
  assert.match(buildScript, /else if \(token === '--temporal-cli-archive'\) parsed\.temporalCliArchive = path\.resolve\(value\)/);
  assert.match(buildScript, /function findTemporalCliBinary\(explicitBin\)/);
  assert.match(buildScript, /function findTemporalCliArchive\(explicitArchive\)/);
  assert.match(buildScript, /function findBunBinary\(explicitBunBin\)/);
  assert.match(buildScript, /if \(sources\.bunBin\) {\s*copySingleFile\(sources\.bunBin, path\.join\(layerRoot, 'bin', 'bun'\)\);\s*}/);
  assert.match(buildScript, /createCodexCliArchive\(\s*path\.join\(layerRoot, 'vendor', 'codex', 'codex_cli_darwin_arm64\.tar\.gz'\),\s*sources\.codexBinaries\.vendorRoot,\s*\)/);
  assert.match(buildScript, /writeCodexCliWrapper\(path\.join\(layerRoot, 'bin', 'codex'\), commandOutput\(sources\.codexBinaries\.codex, \['--version'\]\)\)/);
  assert.match(buildScript, /copySingleFile\(sources\.temporalCliArchive, path\.join\(layerRoot, 'vendor', 'temporal', 'temporal_cli_darwin_arm64\.tar\.gz'\)\)/);
  assert.doesNotMatch(buildScript, /extractTemporalCliBinary\(sources\.temporalCliArchive, path\.join\(layerRoot, 'vendor', 'temporal', 'cli', 'temporal'\)\)/);
  assert.doesNotMatch(buildScript, /function extractTemporalCliBinary/);
  assert.match(buildScript, /writeTemporalCliWrapper\(path\.join\(layerRoot, 'bin', 'temporal'\), commandOutput\(sources\.temporalCliBin, \['--version'\]\)\)/);
  assert.match(buildScript, /copyNodeRuntimePayload\(path\.dirname\(path\.dirname\(sources\.nodeToolchain\.nodeBin\)\), path\.join\(layerRoot, 'node'\)\)/);
  assert.match(buildScript, /assertNoExternalSymlinks\(targetRoot, 'Full first-install Node runtime'\)/);
  assert.match(buildScript, /packaged_global_node_packages:/);
  assert.match(buildScript, /optionalComponents = \{[\s\S]*bun: sources\.bunBin/);
  assert.match(buildScript, /status: 'not_packaged'/);
  assert.doesNotMatch(buildScript, /binary_path: 'runtime\/current\/vendor\/temporal\/cli\/temporal'/);
  assert.match(buildScript, /version: commandOutput\(path\.join\(runtimeRoot, 'bin', 'temporal'\), \['--version'\]\)/);
  assert.match(buildScript, /writeJsonFile\(runtimeNativeTrustPath, prepared\.manifest\.native_trust\)/);
  assert.match(buildScript, /codex: \{[\s\S]*source_path: sources\.codexRoot[\s\S]*size_bytes: directorySizeBytes\(path\.join\(runtimeRoot, 'bin', 'codex'\)\)[\s\S]*archive_path: 'runtime\/current\/vendor\/codex\/codex_cli_darwin_arm64\.tar\.gz'/);
});
