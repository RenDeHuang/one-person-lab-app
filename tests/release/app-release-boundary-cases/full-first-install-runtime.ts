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
  writeExecutable,
  writeReleaseMetadata,
  sha256,
  fileSha256,
  workflowStepBlock,
  readProductProfile,
  matchCount,
  workflowJobBlock,
  readFullPackageBuilderSource,
  assertFullFirstInstallOptionTables,
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
  assert.match(workflow, /npm --silent run release:full:size[\s\S]*--full-dmg-size-bytes "\$dmg_size_bytes"[\s\S]*full-package-size-summary\.json/);
  assert.match(workflow, /npm --silent run release:full:size[\s\S]*--full-dmg-size-bytes "\$dmg_size_bytes"[\s\S]*full-package-size-summary\.md/);
  assert.match(workflow, /cat dist\/opl-full-release\/full-package-size-summary\.md >> "\$GITHUB_STEP_SUMMARY"/);
  assert.match(workflow, /## Full Size Release Coupling/);
  assert.match(workflow, /Full DMG release-blocking by size alone/);
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
  assert.match(workflow, /full_dmg_format:[\s\S]*default:\s+ULMO[\s\S]*type:\s+string/);
  assert.match(workflow, /full_dmg_compression_level:[\s\S]*default:\s+'9'[\s\S]*type:\s+string/);
  assert.match(workflow, /OPL_FULL_DMG_FORMAT:\s+\$\{\{ inputs\.full_dmg_format \|\| 'ULMO' \}\}/);
  assert.match(workflow, /OPL_FULL_DMG_COMPRESSION_LEVEL:\s+\$\{\{ inputs\.full_dmg_compression_level \|\| '9' \}\}/);
  assert.match(workflowStepBlock(workflow, 'Build Full first-install package'), /NODE_OPTIONS:\s+'--max-old-space-size=8192'/);
  assert.match(workflow, /echo "OPL_FULL_DISTRIBUTABLE_ASSETS=\$requires_distributable_assets" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /name: Inspect optional Full release signing secrets/);
  assert.match(workflow, /Full first-install local authorization mode/);
  assert.match(workflow, /Missing optional Apple signing secrets: \$\{missing_csv\}/);
  assert.match(workflow, /BUILD_CERTIFICATE_BASE64 P12_PASSWORD APPLE_ID APPLE_ID_PASSWORD TEAM_ID IDENTITY/);
  assert.match(workflow, /Stable Full assets will use local authorization evidence instead of Developer ID notarization/);
  assert.match(workflow, /local-authorization-policy\.ts[\s\S]*--package-kind app_full_first_install/);
  assert.match(workflow, /mounted_app_path="\$\(find "\$mounted_app_dir" -maxdepth 2 -type d -name 'One Person Lab\.app'/);
  assert.match(workflow, /mounted_runtime_root="\$mounted_app_path\/Contents\/Resources\/opl-full-runtime\/runtime\/current"/);
  assert.match(workflow, /scripts\/assert-full-runtime-currentness\.ts[\s\S]*--runtime-root "\$mounted_runtime_root"[\s\S]*--framework-root "\$GITHUB_WORKSPACE\/one-person-lab"/);
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
    'gaofeng21cn/opl-bookforge',
    'iOfficeAI/OfficeCLI',
    'opendatalab/MinerU-Ecosystem',
    'nextlevelbuilder/ui-ux-pro-max-skill',
  ]) {
    assert.match(`${workflow}\n${fs.readFileSync(path.join(appRoot, 'scripts', 'plan-release-candidate.ts'), 'utf8')}`, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const diagnosticsStep = workflowStepBlock(workflow, 'Upload Full diagnostics artifact');
  const localAuthorizationStep = workflowStepBlock(workflow, 'Upload Full local authorization policy');
  assert.match(workflow, /name:\s+opl-full-diagnostics-\$\{\{ env\.OPL_RELEASE_VERSION \}\}/);
  assert.match(diagnosticsStep, /full-package-build-timing\.json[\s\S]*full-package-manifest\.json[\s\S]*full-package-size-summary\.json[\s\S]*full-package-size-summary\.md[\s\S]*runtime-cache-events\.json[\s\S]*full-runtime-currentness-probe\.json[\s\S]*full-runtime-native-trust\.json[\s\S]*full-app-bundle-trim-report\.json[\s\S]*full-package-boundary-audit\.json[\s\S]*full-local-authorization-policy\.json[\s\S]*SHA256SUMS\.txt/);
  assert.doesNotMatch(diagnosticsStep, /full-gatekeeper-launch-policy\.json/);
  assert.match(localAuthorizationStep, /if:\s+\$\{\{ inputs\.publish_to_release \|\| inputs\.upload_full_package_artifact \}\}[\s\S]*full-local-authorization-policy\.json/);
  assert.match(workflow, /upload_full_package_artifact:[\s\S]*default:\s+true/);
  assert.match(workflow, /Upload Full package workflow artifact[\s\S]*if:\s+\$\{\{ inputs\.upload_full_package_artifact \}\}/);
  assert.match(workflow, /Upload Full DMG-only workflow artifact[\s\S]*opl-full-first-install-dmg-\$\{\{ env\.OPL_RELEASE_VERSION \}\}-mac-arm64[\s\S]*One-Person-Lab-Full-\$\{\{ env\.OPL_RELEASE_VERSION \}\}-mac-arm64\.dmg/);
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
  assert.match(fullPackageScript, /assertFullRuntimeCurrentness/);
  const currentnessScript = fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package', 'runtime-currentness.ts'), 'utf8');
  assert.match(currentnessScript, /opl_managed_updater_kernel/);
  assert.match(currentnessScript, /installation_carrier/);
  assert.match(currentnessScript, /capability_packages/);
  assert.match(currentnessScript, /codex_surface/);
  assert.match(currentnessScript, /\['app', 'state', '--profile', 'fast', '--json'\]/);
  assert.match(currentnessScript, /manifest\.components\.opl\.git_commit/);
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
  assert.match(fullPackageScript, /build-mac:arm64'[\s\S]*--dir-only/);
  assert.doesNotMatch(fullPackageScript, /const sourceDmg = findBuiltDmg/);
  assert.doesNotMatch(fullPackageScript, /fs\.copyFileSync\(sourceDmg, targetDmg\)/);
  const macosTrustScript = fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package', 'macos-trust.ts'), 'utf8');
  assert.match(macosTrustScript, /import os from 'node:os';/);
  assert.match(macosTrustScript, /fs\.mkdtempSync\(path\.join\(os\.tmpdir\(\), 'opl-full-dmg-verify-'\)\)/);
  assert.doesNotMatch(
    fullPackageScript,
    /'--prepackaged'/,
    'Full recovery DMG must be created directly from the verified App bundle; electron-builder prepackaged DMG can drop nested framework signatures',
  );
  assert.match(fullPackageScript, /const rebuiltOptimizedPackage = ensureFullDmgLocalAuthorization\(/);
  assert.match(fullPackageScript, /rebuiltOptimizedPackage\.manifest/);
  assert.doesNotMatch(
    fullPackageScript,
    /if \(!strictMacosRuntimeSigningRequired\(\)\) \{[\s\S]*?verifyDmgAppBundleLocalAuthorization\(targetDmg, 'Full first-install DMG'\);[\s\S]*?return;[\s\S]*?\}/,
    'Stable local authorization mode must rebuild and reverify a bad Full DMG instead of exiting before the recovery path',
  );
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

test('desktop release publish job runs TypeScript asset scripts under Node 24', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const publishStandard = workflowJobBlock(workflow, 'publish-standard');

  assert.match(
    publishStandard,
    /name: Checkout active shell[\s\S]*repository: gaofeng21cn\/opl-aion-shell[\s\S]*path: shells\/aionui[\s\S]*name: Setup Node\.js[\s\S]*uses: actions\/setup-node@v6[\s\S]*node-version: '24'[\s\S]*node --experimental-strip-types scripts\/prepare-release-assets\.ts/,
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
    prune_policy_id: 'full_runtime_offline_first_install_slim_v1',
    prune_policy_hash: mod.buildFullRuntimePrunePolicyHash(),
    temporal_core_bridge_releases: [],
    excluded_module_venv_count: 0,
    packaged_global_node_packages: [],
    offline_required_payloads: [],
    declared_pruned_paths: [],
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

test('Full first-install manifest consumes the OPL runtime bundle boundary instead of owning dependency truth', async () => {
  const mod = await import('../../../scripts/full-first-install-package.ts');
  const manifest = mod.buildFullPackageManifest({ version: '26.6.21-bundle-consumer' });

  assert.equal(manifest.opl_runtime_bundle_consumer.schema, 'opl_runtime_bundle_manifest_consumer.v1');
  assert.equal(manifest.opl_runtime_bundle_consumer.app_repo_role, 'consumer_only');
  assert.equal(manifest.opl_runtime_bundle_consumer.truth_owner, 'gaofeng21cn/one-person-lab');
  assert.equal(manifest.opl_runtime_bundle_consumer.dependency_truth_owner, false);
  assert.equal(
    manifest.opl_runtime_bundle_consumer.source_surface.contract_ref,
    'gaofeng21cn/one-person-lab/contracts/opl-framework/runtime-environment-substrate-contract.json',
  );
  assert.equal(
    manifest.opl_runtime_bundle_consumer.source_surface.readback_command_refs.contract,
    'opl runtime env contract --json',
  );
  assert.equal(
    manifest.opl_runtime_bundle_consumer.source_surface.readback_command_refs.materialize_dry_run,
    'opl runtime env materialize --domain <domain> --profile <profile> --platform <platform> --dry-run --json',
  );
  assert.deepEqual(manifest.opl_runtime_bundle_consumer.source_surface.required_readback_claim_fields, [
    'implementation_status',
    'target_planned',
    'dry_run',
    'can_claim_runtime_ready',
    'can_claim_domain_ready',
    'can_claim_app_release_ready',
  ]);
  assert.deepEqual(manifest.opl_runtime_bundle_consumer.consumed_refs, {
    bundle_manifest: 'OPL runtime bundle manifest',
    bundle_lock: 'OPL runtime bundle lock',
    bundle_readback: 'OPL runtime env contract/readback',
    env_contract: 'OPL runtime env contract',
  });
  assert.deepEqual(manifest.opl_runtime_bundle_consumer.false_ready_flags, {
    cache_hit_is_release_ready: false,
    manifest_present_is_release_ready: false,
    lock_present_is_release_ready: false,
    full_package_built_is_release_ready: false,
    full_package_built_is_family_production_ready: false,
    app_can_claim_runtime_dependency_truth: false,
  });
  assert.deepEqual(manifest.opl_runtime_bundle_consumer.consumption_boundary, {
    records_refs_only: true,
    keeps_full_offline_first_install_payloads: true,
    can_delete_required_offline_payloads_for_size: false,
    can_materialize_runtime_root: false,
    can_claim_runtime_ready: false,
    can_claim_app_release_ready: false,
    can_claim_family_production_ready: false,
  });
  assert.deepEqual(manifest.opl_runtime_bundle_consumer.layer_taxonomy.canonical_layer_ids, [
    'base-toolchain',
    'python-wheelhouse',
    'opl-framework-runtime',
    'domain-pack',
    'companion-skills',
    'optional-heavy-tools',
  ]);
  assert.deepEqual(manifest.opl_runtime_bundle_consumer.layer_taxonomy.legacy_assembly_layer_mapping, {
    toolchain: ['base-toolchain', 'python-wheelhouse', 'optional-heavy-tools'],
    'domain-runtime': ['domain-pack'],
    'opl-runtime': ['opl-framework-runtime'],
    skills: ['companion-skills'],
  });
  assert.deepEqual(
    manifest.opl_runtime_bundle_consumer.runtime_fabric_bundle_taxonomy['environment-materializer.bundle'].materializer_parts,
    {
      language_runtimes: ['node', 'python'],
      package_and_env_resolvers: ['uv'],
      env_cache_and_isolated_prefix: 'runtime/current/.runtime-cache plus module-specific managed env roots',
      optional_resolver_slots: ['pixi_for_scientific_native_stack_when_declared'],
    },
  );
  assert.deepEqual(Object.keys(manifest.runtime_fabric_bundles), [
    'execution-core.bundle',
    'environment-materializer.bundle',
    'system-bridge.bundle',
  ]);
  assert.equal(manifest.runtime_fabric_bundles['execution-core.bundle'].display_name, 'Agent Execution Core');
  assert.equal(manifest.runtime_fabric_bundles['environment-materializer.bundle'].display_name, 'Environment Materializer');
  assert.equal(manifest.runtime_fabric_bundles['system-bridge.bundle'].display_name, 'OPL System Bridge');
  assert.deepEqual(
    Object.keys(manifest.runtime_fabric_bundles['environment-materializer.bundle'].packaged_components),
    ['node', 'python', 'uv'],
  );
  assert.deepEqual(manifest.size_breakdown.opl_layer_taxonomy, manifest.opl_runtime_bundle_consumer.layer_taxonomy);

  assert.deepEqual(
    mod.buildFullRuntimeAggregateCacheKeyInput({
      layers: {
        toolchain: 'full-runtime-v1-toolchain-a',
        'domain-runtime': 'full-runtime-v1-domain-runtime-b',
        'opl-runtime': 'full-runtime-v1-opl-runtime-c',
        skills: 'full-runtime-v1-skills-d',
      },
    }).opl_runtime_bundle_consumer.layer_taxonomy.canonical_layer_ids,
    manifest.opl_runtime_bundle_consumer.layer_taxonomy.canonical_layer_ids,
  );
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
    preferred_sources: ['app_owned_archive_wrapper'],
    fallback_version_source: 'distribution cohort manifest components.codex_cli.fallback_version',
    fallback_runtime_path: 'runtime/current/bin/codex',
    fallback_payload_path: 'runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz',
    must_prefer_valid_newer_user_version: false,
    system_sources_visible_as_diagnostics: true,
    system_sources_require_expert_opt_in: true,
    verification: 'App-owned runtime/current/bin/codex must satisfy minimum_version, execute offline from the packaged archive wrapper, and pass Codex functional smoke; system PATH/Homebrew/global Codex may be reported as diagnostics but is not the default runtime source',
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
    preferred_sources: ['app_owned_archive_wrapper'],
    fallback_version_source: 'distribution cohort manifest components.temporal_cli.fallback_version',
    fallback_runtime_path: 'runtime/current/bin/temporal',
    fallback_payload_path: 'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz',
    must_prefer_valid_newer_user_version: false,
    system_sources_visible_as_diagnostics: true,
    system_sources_require_expert_opt_in: true,
    verification: 'App-owned runtime/current/bin/temporal must satisfy minimum_version, execute offline from the packaged archive wrapper, and pass Temporal provider smoke; system PATH/Homebrew/global Temporal may be reported as diagnostics but is not the default runtime source',
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
    manifest.distribution.payload_boundary.truth_sources.book_domain_truth,
    'gaofeng21cn/opl-bookforge',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.grant_domain_truth,
    'gaofeng21cn/med-autogrant',
  );
  assert.equal(
    manifest.distribution.payload_boundary.truth_sources.visual_deliverable_domain_truth,
    'gaofeng21cn/redcube-ai',
  );
  assert.equal(manifest.distribution.payload_boundary.consumer_refs.opl_runtime_bundle, 'opl_runtime_bundle_consumer');
  assert.equal(manifest.distribution.payload_boundary.consumer_refs.bundle_manifest, 'opl_runtime_bundle_consumer.consumed_refs.bundle_manifest');
  assert.equal(
    releaseContract.full_first_install.opl_runtime_bundle_consumer.source_surface.contract_ref,
    'gaofeng21cn/one-person-lab/contracts/opl-framework/runtime-environment-substrate-contract.json',
  );
  assert.equal(
    releaseContract.full_first_install.opl_runtime_bundle_consumer.consumption_boundary.can_delete_required_offline_payloads_for_size,
    false,
  );
  assert.equal(
    releaseContract.full_first_install.payload_boundary.consumer_refs.bundle_readback,
    'OPL runtime env contract/readback',
  );
  assert.equal(
    releaseContract.full_first_install.payload_boundary.false_ready_flags.cache_hit_is_release_ready,
    false,
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

test('Full size policy records review semantics, measured v26.6.21 breakdown, and package boundary', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const sizeBudget = releaseContract.full_first_install.size_budget;
  const sizePolicy = releaseContract.full_first_install.size_policy;
  const measuredRecord = sizePolicy.measured_records.find((record) => record.version === '26.6.21');

  assert.equal(sizeBudget.warning_full_dmg_bytes, 700000000);
  assert.equal(sizeBudget.max_full_dmg_bytes, 750000000);
  assert.equal(sizePolicy.offline_first_install_completeness_must_not_regress, true);
  assert.equal(
    sizePolicy.threshold_semantics.review_full_dmg_bytes.status,
    'review_required_not_release_blocking_by_size_alone',
  );
  assert.match(
    sizePolicy.threshold_semantics.stable_release_coupling_rule,
    /not release-blocking by size alone/,
  );
  assert.match(
    sizePolicy.threshold_semantics.above_review_threshold_rule,
    /must not authorize removing required offline first-install payloads/,
  );
  assert.deepEqual(sizePolicy.optimization_artifacts.required_manifest_flags, {
    offline_first_install_completeness_preserved: true,
    size_review_release_blocking_by_size_alone: false,
  });
  assert.equal(sizePolicy.optimization_artifacts.manifest_section, 'package_optimization');
  assert.equal(sizePolicy.optimization_artifacts.public_manifest, 'opl-release-manifest.json');
  assert.equal(sizePolicy.optimization_artifacts.trim_report, 'opl-release-manifest.json#evidence.app_bundle_trim_report');
  assert.equal(sizePolicy.optimization_artifacts.boundary_audit, 'opl-release-manifest.json#evidence.package_boundary_audit');
  assert.equal(sizePolicy.optimization_artifacts.mode, 'explicit_non_runtime_prune_only');
  assert.ok(
    sizePolicy.optimization_artifacts.required_preserved_payloads.includes('Contents/Resources/opl-full-runtime'),
  );
  assert.ok(
    sizePolicy.optimization_artifacts.required_preserved_payloads.includes('Contents/Resources/bundled-aioncore'),
  );
  assert.deepEqual(sizePolicy.optimization_artifacts.required_remote_assets, [
    'opl-release-manifest.json',
  ]);
  assert.deepEqual(sizePolicy.optimization_artifacts.transition_accepted_legacy_remote_assets, [
    'full-app-bundle-trim-report.json',
    'full-package-boundary-audit.json',
  ]);
  assert.deepEqual(sizePolicy.package_profile_boundary.standard, {
    asset_pattern: 'One-Person-Lab-<version>-mac-arm64.dmg',
    runtime_profile: 'standard',
    updater_visible: true,
    contains_opl_full_runtime: false,
    role: 'ordinary App package and standard updater target',
  });
  assert.deepEqual(sizePolicy.package_profile_boundary.full, {
    asset_pattern: 'One-Person-Lab-Full-<version>-mac-arm64.dmg',
    runtime_profile: 'full',
    updater_visible: false,
    contains_opl_full_runtime: true,
    role: 'clean-machine first-install package with bundled runtime payloads',
  });
  assert.deepEqual(sizePolicy.package_profile_boundary.offline_kit, {
    asset_pattern: 'opl-runtime-full-<version>-macos-arm64.tar.zst',
    runtime_profile: 'offline-kit',
    updater_visible: false,
    contains_opl_full_runtime: true,
    role: 'manual diagnostic/runtime recovery artifact that consumes the same OPL runtime bundle manifest boundary',
  });
  assert.equal(sizePolicy.runtime_boundary.opl_full_runtime.standard_package_allowed, false);
  assert.equal(sizePolicy.runtime_boundary.opl_full_runtime.owner, 'gaofeng21cn/one-person-lab');
  assert.equal(sizePolicy.runtime_boundary.opl_full_runtime.app_role, 'consumer_and_packager');
  assert.equal(sizePolicy.threshold_semantics.cache_hit_rule, 'A Full runtime cache hit only proves reusable package assembly input; it is never App release readiness, runtime dependency truth, or OPL family production readiness.');
  assert.equal(sizePolicy.runtime_boundary.aionui_bundled_runtime.does_not_replace, 'opl_full_runtime');
  assert.equal(measuredRecord.full_dmg_bytes, 1121919153);
  assert.equal(measuredRecord.standard_dmg_bytes, 440471386);
  assert.equal(measuredRecord.zlib_level_9_estimated_full_dmg_bytes, 844079932);
  assert.equal(measuredRecord.zlib_level_9_estimate_under_review_threshold, false);
  assert.ok(
    measuredRecord.top_app_bundle_contributors.some((entry) => entry.id === 'opl-full-runtime' && entry.size_label === '745M'),
  );
  assert.ok(
    measuredRecord.top_app_bundle_contributors.some((entry) => entry.id === 'bundled-aioncore' && entry.size_label === '678M'),
  );
  assert.ok(
    measuredRecord.top_app_bundle_contributors.some((entry) => entry.id === 'app.asar' && entry.size_label === '367M'),
  );
  assert.ok(
    measuredRecord.top_app_bundle_contributors.some((entry) => entry.id === 'Electron Framework' && entry.size_label === '249M'),
  );
  assert.deepEqual(
    sizePolicy.optimization_priority_order.map((entry) => entry.id),
    [
      'dedupe_or_split_declared_full_runtime_layers',
      'shrink_aionui_app_bundle_payloads',
      'review_electron_framework_footprint',
      'compression_level_tuning',
    ],
  );
});

test('Full runtime pruning keeps macOS arm64 launch payloads without development environments', async () => {
  const mod = await import('../../../scripts/full-first-install-package.ts');
  const buildScript = readFullPackageBuilderSource();
  const runtimeCacheScript = fs.readFileSync(
    path.join(appRoot, 'scripts', 'build-full-first-install-package', 'runtime-cache.ts'),
    'utf8',
  );
  const runtimeLayersScript = fs.readFileSync(
    path.join(appRoot, 'scripts', 'build-full-first-install-package', 'runtime-layers.ts'),
    'utf8',
  );
  const policy = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'full-runtime-prune-policy.json'), 'utf8'),
  );

  for (const relativePath of policy.validation_examples.runtime_tree.excluded) {
    assert.equal(mod.shouldExcludeRuntimePath(relativePath), true, relativePath);
  }
  for (const relativePath of policy.validation_examples.runtime_tree.retained) {
    assert.equal(mod.shouldExcludeRuntimePath(relativePath), false, relativePath);
  }
  for (const relativePath of policy.validation_examples.production_node_modules.excluded) {
    assert.equal(mod.shouldExcludeProductionNodeModulePath(relativePath), true, relativePath);
  }
  for (const relativePath of policy.validation_examples.production_node_modules.retained) {
    assert.equal(mod.shouldExcludeProductionNodeModulePath(relativePath), false, relativePath);
  }
  for (const relativePath of policy.validation_examples.node_toolchain_global_packages.excluded) {
    assert.equal(mod.shouldExcludeNodeToolchainPackagePath(relativePath), true, relativePath);
  }
  for (const relativePath of policy.validation_examples.node_toolchain_global_packages.retained) {
    assert.equal(mod.shouldExcludeNodeToolchainPackagePath(relativePath), false, relativePath);
  }

  assert.equal(mod.FULL_RUNTIME_PRUNE_POLICY.schema, 'opl_full_runtime_prune_policy.v1');
  assert.equal(mod.FULL_RUNTIME_PRUNE_POLICY.id, 'full_runtime_offline_first_install_slim_v1');
  assert.equal(mod.FULL_RUNTIME_PRUNE_POLICY.mode, 'explicit_non_runtime_prune_only');
  assert.equal(mod.FULL_RUNTIME_PRUNE_POLICY_PATH, path.join(appRoot, 'contracts', 'full-runtime-prune-policy.json'));
  assert.deepEqual(mod.FULL_RUNTIME_PRUNE_POLICY.runtime_tree, policy.runtime_tree);
  assert.match(mod.buildFullRuntimePrunePolicyHash(), /^[a-f0-9]{64}$/);
  assert.equal(mod.buildFullPackageManifest({ version: '26.5.15' }).runtime_prune_policy.id, mod.FULL_RUNTIME_PRUNE_POLICY.id);
  assert.match(runtimeCacheScript, /contracts\/full-runtime-prune-policy\.json/);

  const auditResult = runNode(['scripts/audit-full-runtime-prune-policy.ts', '--json']);
  assert.equal(auditResult.status, 0, auditResult.stderr);
  const audit = JSON.parse(auditResult.stdout);
  assert.equal(audit.schema, 'opl_full_runtime_prune_policy_audit.v1');
  assert.equal(audit.source_of_truth, 'contracts/full-runtime-prune-policy.json');
  assert.equal(audit.policy_id, policy.id);
  assert.equal(audit.policy_hash, mod.buildFullRuntimePrunePolicyHash());
  assert.equal(audit.examples.status, 'passed');
  assert.equal(audit.examples.failures.length, 0);

  const auditRuntimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-prune-audit-runtime-'));
  writeFile(path.join(auditRuntimeRoot, 'modules', 'mas', 'logs', 'latest.log'), 'log');
  writeFile(path.join(auditRuntimeRoot, 'modules', 'mas', 'src', 'index.py'), 'print("ok")');
  writeFile(path.join(auditRuntimeRoot, 'node', 'lib', 'node_modules', 'npm', 'docs', 'readme.md'), 'docs');
  writeFile(path.join(auditRuntimeRoot, 'node', 'lib', 'node_modules', 'npm', 'lib', 'cli.js'), 'cli');
  writeFile(path.join(auditRuntimeRoot, 'node', 'bin', 'node'), 'node');
  writeFile(path.join(auditRuntimeRoot, 'opl', 'node_modules', '@temporalio', 'client', 'docs', 'api.md'), 'docs');
  writeFile(path.join(auditRuntimeRoot, 'opl', 'node_modules', '@temporalio', 'client', 'lib', 'index.js'), 'client');
  const baselinePath = path.join(auditRuntimeRoot, 'baseline-audit.json');
  writeFile(
    baselinePath,
    JSON.stringify({
      runtime_scan: {
        excluded_paths: [
          'modules/mas/tmp/old.tmp',
          'node/lib/node_modules/npm/docs',
        ],
      },
    }),
  );
  const scanResult = runNode([
    'scripts/audit-full-runtime-prune-policy.ts',
    '--json',
    '--runtime-root',
    auditRuntimeRoot,
    '--baseline',
    baselinePath,
    '--top',
    '5',
  ]);
  assert.equal(scanResult.status, 0, scanResult.stderr);
  const scanAudit = JSON.parse(scanResult.stdout);
  assert.equal(scanAudit.runtime_scan.runtime_root, auditRuntimeRoot);
  assert.ok(scanAudit.runtime_scan.excluded_paths.includes('modules/mas/logs'));
  assert.ok(scanAudit.runtime_scan.excluded_paths.includes('modules/mas/logs/latest.log'));
  assert.ok(scanAudit.runtime_scan.excluded_paths.includes('node/lib/node_modules/npm/docs'));
  assert.ok(scanAudit.runtime_scan.excluded_paths.includes('node/lib/node_modules/npm/docs/readme.md'));
  assert.ok(scanAudit.runtime_scan.excluded_paths.includes('opl/node_modules/@temporalio/client/docs'));
  assert.ok(scanAudit.runtime_scan.excluded_paths.includes('opl/node_modules/@temporalio/client/docs/api.md'));
  assert.ok(!scanAudit.runtime_scan.excluded_paths.includes('node/lib/node_modules/npm/lib/cli.js'));
  assert.ok(!scanAudit.runtime_scan.excluded_paths.includes('opl/node_modules'));
  assert.ok(!scanAudit.runtime_scan.excluded_paths.includes('opl/node_modules/@temporalio/client'));
  assert.ok(!scanAudit.runtime_scan.excluded_paths.includes('opl/node_modules/@temporalio/client/lib/index.js'));
  assert.ok(scanAudit.runtime_scan.excluded_bytes > 0);
  assert.ok(scanAudit.runtime_scan.excluded_by_surface.runtime_tree >= 2);
  assert.ok(scanAudit.runtime_scan.excluded_by_surface.node_toolchain_global_packages >= 2);
  assert.ok(scanAudit.runtime_scan.excluded_by_surface.production_node_modules >= 2);
  assert.ok(scanAudit.runtime_scan.top_excluded_paths.length <= 5);
  assert.equal(scanAudit.runtime_scan.runtime_assertions.prune_policy_id, policy.id);
  assert.equal(scanAudit.runtime_scan.runtime_assertions.prune_policy_hash, mod.buildFullRuntimePrunePolicyHash());
  assert.ok(
    scanAudit.runtime_scan.runtime_assertions.declared_pruned_paths.some(
      (entry) => entry.path === 'node/lib/node_modules/npm/docs' && entry.expected === 'absent',
    ),
  );
  assert.ok(scanAudit.runtime_scan_diff.added_excluded_paths.includes('modules/mas/logs'));
  assert.ok(scanAudit.runtime_scan_diff.removed_excluded_paths.includes('modules/mas/tmp/old.tmp'));

  assert.match(buildScript, /shouldExcludeProductionNodeModulePath/);
  assert.match(buildScript, /shouldExcludeNodeToolchainPackagePath/);
  assert.match(buildScript, /copyProductionNodeModule\(sourcePath, targetPath\)/);
  assert.match(buildScript, /copyNodeToolchainPackage\(sourcePath, path\.join\(targetRoot, 'lib', 'node_modules', packageName\)\)/);
  assert.match(buildScript, /MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET = 'aarch64-apple-darwin'/);
  assert.match(buildScript, /pruneTemporalCoreBridgeReleases\(path\.join\(targetRoot, 'node_modules'\)\)/);
  assert.match(buildScript, /assertTemporalCoreBridgeMacosArm64Only\(path\.join\(runtimeRoot, 'opl', 'node_modules'\)\)/);
  assert.match(buildScript, /const runtimeAssertions = collectRuntimeAssertions\(runtimeRoot\)/);
  assert.match(buildScript, /assertOfflineRequiredPayloadsPresent\(runtimeAssertions\)/);
  assert.match(buildScript, /prune_policy_hash: buildFullRuntimePrunePolicyHash\(\)/);
  assert.match(buildScript, /offline_required_payloads:/);
  assert.match(buildScript, /declared_pruned_paths:/);
  assert.match(buildScript, /bunBin: envValue\('OPL_FULL_BUN_BIN', ''\)/);
  assert.match(buildScript, /includeBunRuntime: process\.env\.OPL_FULL_INCLUDE_BUN_RUNTIME === '1'/);
  assert.match(buildScript, /temporalCliBin: envValue\('OPL_FULL_TEMPORAL_CLI_BIN', ''\)/);
  assert.match(buildScript, /temporalCliArchive: envValue\('OPL_FULL_TEMPORAL_CLI_ARCHIVE', ''\)/);
  assertFullFirstInstallOptionTables(buildScript);
  assert.match(buildScript, /function findTemporalCliBinary\(explicitBin\)/);
  assert.match(buildScript, /function findTemporalCliArchive\(explicitArchive\)/);
  assert.match(buildScript, /function findBunBinary\(explicitBunBin\)/);
  assert.match(runtimeLayersScript, /CODEX_MACOS_ARM64_TARGET,[\s\S]*MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET,[\s\S]*from '\.\/paths\.ts'/);
  assert.match(runtimeLayersScript, /CODEX_TARGET="\$\{CODEX_MACOS_ARM64_TARGET\}"/);
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

test('Full runtime slim policy is declared without moving required payloads to lazy download', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const hygiene = releaseContract.release_acceleration.full_runtime_packaging_hygiene;
  const policy = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'full-runtime-prune-policy.json'), 'utf8'),
  );

  assert.equal(hygiene.prune_policy_id, 'full_runtime_offline_first_install_slim_v1');
  assert.equal(hygiene.manifest_policy_schema, 'opl_full_runtime_prune_policy.v1');
  assert.equal(hygiene.source_of_truth, 'contracts/full-runtime-prune-policy.json');
  assert.match(hygiene.policy_summary_boundary, /not duplicated here/);
  assert.deepEqual(hygiene.policy_surfaces, [
    'runtime_tree',
    'production_node_modules',
    'node_toolchain_global_packages',
    'app_bundle_staging',
    'runtime_assertions',
    'validation_examples',
  ]);
  assert.equal(policy.app_bundle_staging.report, 'full-app-bundle-trim-report.json');
  assert.equal(policy.app_bundle_staging.audit, 'full-package-boundary-audit.json');
  assert.ok(policy.app_bundle_staging.protected_payloads.includes('Contents/Resources/opl-full-runtime'));
  assert.ok(policy.app_bundle_staging.protected_payloads.includes('Contents/Resources/app.asar.unpacked'));
  assert.ok(policy.runtime_assertions.expected_absent_paths.includes('node/lib/node_modules/npm/docs'));
  assert.ok(policy.runtime_assertions.expected_absent_paths.includes('python/*/lib/python*/test'));
  assert.match(policy.offline_first_install_boundary, /Codex and Temporal archives/);
  assert.match(policy.offline_first_install_boundary, /packaged default skills stay local/);
  assert.ok(policy.validation_examples.runtime_tree.retained.includes('modules/mas/src/med_autoscience/__init__.py'));
  assert.ok(
    policy.validation_examples.runtime_tree.retained.includes(
      'modules/meta-agent/runtime/authority_functions/meta-agent-authority-functions.json',
    ),
  );
  assert.ok(hygiene.manifest_assertions.includes('runtime_prune_policy.id'));
  assert.ok(hygiene.manifest_assertions.includes('runtime_assertions.prune_policy_hash'));
  assert.ok(hygiene.manifest_assertions.includes('runtime_assertions.offline_required_payloads'));
  assert.ok(hygiene.manifest_assertions.includes('runtime_assertions.declared_pruned_paths'));
  assert.match(hygiene.app_policy, /do not prune declared offline first-install payloads/);
});

test('Full App bundle staging trim removes non-runtime artifacts while preserving offline runtime payloads', async () => {
  const {
    trimFullAppBundleForDmg,
    auditFullPackageBundleBoundaries,
    withFullPackageOptimization,
  } = await import('../../../scripts/build-full-first-install-package/package-optimization.ts');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-app-bundle-trim-'));
  const appPath = path.join(tempRoot, 'One Person Lab.app');
  writeFile(path.join(appPath, 'Contents', 'Resources', 'app.asar'), 'app');
  writeFile(path.join(appPath, 'Contents', 'Resources', 'app.asar.map'), 'map');
  writeFile(path.join(appPath, 'Contents', 'Resources', 'bundled-aioncore', 'runtime.js.map'), 'shell map');
  writeFile(path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'native.node.map'), 'native map');
  writeFile(
    path.join(
      appPath,
      'Contents',
      'Frameworks',
      'Electron Framework.framework',
      'Resources',
      'electron.js.map',
    ),
    'electron map',
  );
  writeFile(path.join(appPath, 'Contents', 'Resources', 'test-results', 'result.json'), '{}');
  writeFile(path.join(appPath, 'Contents', 'Resources', 'opl-full-runtime', 'runtime', 'current', 'bin', 'opl'), 'runtime');
  writeFile(path.join(appPath, 'Contents', 'Resources', 'bundled-aioncore', 'node'), 'shell-runtime');
  writeFile(path.join(appPath, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Electron Framework'), 'electron');

  const trimReport = trimFullAppBundleForDmg(appPath);
  assert.equal(trimReport.schema, 'opl_full_app_bundle_trim_report.v1');
  assert.equal(trimReport.required_payload_boundary.preserved, true);
  assert.equal(fs.existsSync(path.join(appPath, 'Contents', 'Resources', 'app.asar.map')), false);
  assert.equal(fs.existsSync(path.join(appPath, 'Contents', 'Resources', 'test-results')), false);
  assert.equal(fs.existsSync(path.join(appPath, 'Contents', 'Resources', 'opl-full-runtime', 'runtime', 'current', 'bin', 'opl')), true);
  assert.equal(fs.existsSync(path.join(appPath, 'Contents', 'Resources', 'bundled-aioncore', 'node')), true);
  assert.equal(fs.existsSync(path.join(appPath, 'Contents', 'Resources', 'bundled-aioncore', 'runtime.js.map')), true);
  assert.equal(fs.existsSync(path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'native.node.map')), true);
  assert.equal(
    fs.existsSync(
      path.join(
        appPath,
        'Contents',
        'Frameworks',
        'Electron Framework.framework',
        'Resources',
        'electron.js.map',
      ),
    ),
    true,
  );

  const boundaryAudit = auditFullPackageBundleBoundaries(appPath, {
    package_kind: 'opl_full_first_install_macos_arm64',
    version: '26.6.21-size-opt',
  });
  assert.equal(boundaryAudit.standard_app_boundary.standard_package_allowed_to_contain_full_runtime, false);
  assert.equal(boundaryAudit.full_package_boundary.contains_opl_full_runtime, true);
  assert.equal(boundaryAudit.full_package_boundary.contains_shell_runtime, true);
  const manifest = withFullPackageOptimization(
    { manifest_version: 2, package_kind: 'opl_full_first_install_macos_arm64' },
    { trimReport, boundaryAudit },
  );
  assert.equal(manifest.package_optimization.offline_first_install_completeness_preserved, true);
  assert.equal(manifest.package_optimization.size_review_release_blocking_by_size_alone, false);
  assert.equal(manifest.package_optimization.app_bundle_trim.bytes_removed, trimReport.bytes_removed);

  const incompleteAudit = auditFullPackageBundleBoundaries(path.join(tempRoot, 'Incomplete.app'), {
    package_kind: 'opl_full_first_install_macos_arm64',
    version: '26.6.21-size-opt',
  });
  assert.throws(
    () => withFullPackageOptimization(
      { manifest_version: 2, package_kind: 'opl_full_first_install_macos_arm64' },
      { trimReport, boundaryAudit: incompleteAudit },
    ),
    /did not preserve the declared offline first-install App bundle boundary/,
  );
});

test('Full runtime node payload prunes package-only docs while preserving offline launch executables', async () => {
  const { copyNodeRuntimePayload } = await import('../../../scripts/build-full-first-install-package/filesystem.ts');
  const { collectRuntimeAssertions } = await import('../../../scripts/build-full-first-install-package/runtime-layers.ts');
  const { writeFullRuntimeManifest } = await import('../../../scripts/build-full-first-install-package/manifest-checksum.ts');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-node-prune-'));
  const sourceRoot = path.join(tempRoot, 'node-source');
  const targetRoot = path.join(tempRoot, 'runtime', 'node');

  writeExecutable(path.join(sourceRoot, 'bin', 'node'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(sourceRoot, 'bin', 'npm'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(sourceRoot, 'bin', 'npx'), '#!/bin/sh\nexit 0\n');
  writeFile(path.join(sourceRoot, 'include', 'node', 'node.h'), 'header');
  writeFile(path.join(sourceRoot, 'share', 'man', 'man1', 'node.1'), 'manual');
  writeFile(path.join(sourceRoot, 'lib', 'node_modules', 'npm', 'package.json'), '{"name":"npm"}\n');
  writeFile(path.join(sourceRoot, 'lib', 'node_modules', 'npm', 'lib', 'cli.js'), 'runtime');
  writeFile(path.join(sourceRoot, 'lib', 'node_modules', 'npm', 'node_modules', '@npmcli', 'arborist', 'lib', 'index.js'), 'runtime');
  writeFile(path.join(sourceRoot, 'lib', 'node_modules', 'npm', 'docs', 'config.md'), 'docs');
  writeFile(path.join(sourceRoot, 'lib', 'node_modules', 'npm', 'man', 'man1', 'npm.1'), 'manual');
  writeFile(path.join(sourceRoot, 'lib', 'node_modules', 'npm', 'tap-snapshots', 'install.snap'), 'snapshot');
  writeFile(path.join(sourceRoot, 'lib', 'node_modules', 'corepack', 'dist', 'corepack.js'), 'runtime');
  writeFile(path.join(sourceRoot, 'lib', 'node_modules', 'corepack', 'tests', 'corepack.test.js'), 'test');

  copyNodeRuntimePayload(sourceRoot, targetRoot);

  assert.equal(fs.existsSync(path.join(targetRoot, 'bin', 'node')), true);
  assert.equal(fs.existsSync(path.join(targetRoot, 'bin', 'npm')), true);
  assert.equal(fs.existsSync(path.join(targetRoot, 'bin', 'npx')), true);
  assert.equal(fs.existsSync(path.join(targetRoot, 'include')), false);
  assert.equal(fs.existsSync(path.join(targetRoot, 'share')), false);
  assert.equal(fs.existsSync(path.join(targetRoot, 'lib', 'node_modules', 'npm', 'lib', 'cli.js')), true);
  assert.equal(
    fs.existsSync(path.join(targetRoot, 'lib', 'node_modules', 'npm', 'node_modules', '@npmcli', 'arborist', 'lib', 'index.js')),
    true,
  );
  assert.equal(fs.existsSync(path.join(targetRoot, 'lib', 'node_modules', 'npm', 'docs')), false);
  assert.equal(fs.existsSync(path.join(targetRoot, 'lib', 'node_modules', 'npm', 'man')), false);
  assert.equal(fs.existsSync(path.join(targetRoot, 'lib', 'node_modules', 'npm', 'tap-snapshots')), false);
  assert.equal(fs.existsSync(path.join(targetRoot, 'lib', 'node_modules', 'corepack', 'dist', 'corepack.js')), true);
  assert.equal(fs.existsSync(path.join(targetRoot, 'lib', 'node_modules', 'corepack', 'tests')), false);

  const runtimeRoot = path.join(tempRoot, 'runtime');
  writeExecutable(path.join(runtimeRoot, 'bin', 'codex'), '#!/bin/sh\nexit 0\n');
  writeFile(path.join(runtimeRoot, 'vendor', 'codex', 'codex_cli_darwin_arm64.tar.gz'), 'codex archive');
  writeExecutable(path.join(runtimeRoot, 'bin', 'temporal'), '#!/bin/sh\nexit 0\n');
  writeFile(path.join(runtimeRoot, 'vendor', 'temporal', 'temporal_cli_darwin_arm64.tar.gz'), 'temporal archive');
  writeExecutable(path.join(runtimeRoot, 'uv', 'bin', 'uv'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(runtimeRoot, 'bin', 'officecli'), '#!/bin/sh\nexit 0\n');
  writeExecutable(path.join(runtimeRoot, 'bin', 'mineru-open-api'), '#!/bin/sh\nexit 0\n');
  for (const skillId of ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge']) {
    writeFile(path.join(runtimeRoot, 'skills', skillId, 'SKILL.md'), '# skill\n');
  }
  writeFile(path.join(runtimeRoot, 'skills', 'superpowers', '.codex-plugin', 'plugin.json'), '{}\n');
  for (const [modulePath, pluginId] of [
    ['modules/mas', 'med-autoscience'],
    ['modules/mag', 'med-autogrant'],
    ['modules/rca', 'redcube-ai'],
  ]) {
    writeFile(path.join(runtimeRoot, modulePath, 'plugins', pluginId, '.codex-plugin', 'plugin.json'), '{}\n');
    writeFile(path.join(runtimeRoot, modulePath, 'plugins', pluginId, 'skills', pluginId, 'SKILL.md'), '# skill\n');
  }

  const assertions = collectRuntimeAssertions(runtimeRoot);
  assert.equal(assertions.prune_policy_id, 'full_runtime_offline_first_install_slim_v1');
  assert.match(assertions.prune_policy_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(assertions.packaged_global_node_packages, ['corepack', 'npm']);
  assert.equal(
    assertions.offline_required_payloads.find((entry) => entry.path === 'vendor/codex/codex_cli_darwin_arm64.tar.gz')?.exists,
    true,
  );
  assert.equal(
    assertions.offline_required_payloads.find((entry) => entry.path === 'vendor/temporal/temporal_cli_darwin_arm64.tar.gz')?.exists,
    true,
  );
  assert.equal(
    assertions.offline_required_payloads.find((entry) => entry.path === 'node/bin/npm')?.executable,
    true,
  );
  assert.equal(
    assertions.offline_required_payloads.find(
      (entry) => entry.path === 'modules/mag/plugins/med-autogrant/.codex-plugin/plugin.json',
    )?.exists,
    true,
  );
  assert.equal(
    assertions.offline_required_payloads.find(
      (entry) => entry.path === 'modules/mag/plugins/med-autogrant/skills/med-autogrant/SKILL.md',
    )?.exists,
    true,
  );
  assert.doesNotThrow(() =>
    writeFullRuntimeManifest(runtimeRoot, { version: '26.7.7-test' }, '2026-07-07T00:00:00.000Z', {}, {}),
  );
  fs.rmSync(path.join(runtimeRoot, 'modules', 'mag', 'plugins', 'med-autogrant', '.codex-plugin'), {
    recursive: true,
    force: true,
  });
  assert.throws(
    () => writeFullRuntimeManifest(runtimeRoot, { version: '26.7.7-test' }, '2026-07-07T00:00:00.000Z', {}, {}),
    /modules\/mag\/plugins\/med-autogrant\/\.codex-plugin\/plugin\.json/,
  );
  assert.equal(
    assertions.declared_pruned_paths.find((entry) => entry.path === 'node/include')?.present,
    false,
  );
  assert.equal(
    assertions.declared_pruned_paths.find((entry) => entry.path === 'node/lib/node_modules/npm/docs')?.present,
    false,
  );
});
