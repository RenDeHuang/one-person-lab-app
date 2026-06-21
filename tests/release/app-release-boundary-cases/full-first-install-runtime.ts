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
} from './helpers.ts';

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertFullFirstInstallOptionTables(buildScript: string) {
  assert.match(buildScript, /const booleanOptionSetters = new Map\(\[/);
  for (const option of [
    '--skip-gui-build',
    '--split-runtime',
    '--reuse-gui-vite-output',
    '--print-runtime-cache-keys',
    '--include-bun-runtime',
  ]) {
    assert.match(buildScript, new RegExp(`\\['${escapedPattern(option)}', \\(parsed\\) =>`));
  }
  assert.match(buildScript, /const valueOptionSetters = new Map\(\[/);
  for (const option of [
    '--version',
    '--out-dir',
    '--framework-root',
    '--opl-root',
    '--gui-root',
    '--mas-root',
    '--mag-root',
    '--rca-root',
    '--meta-agent-root',
    '--bookforge-root',
    '--superpowers-root',
    '--codex-root',
    '--node-bin',
    '--bun-bin',
    '--uv-bin',
    '--temporal-cli-bin',
    '--temporal-cli-archive',
    '--python-root',
    '--officecli-bin',
    '--officecli-root',
    '--mineru-open-api-bin',
    '--mineru-root',
    '--mineru-document-extractor-root',
    '--ui-ux-pro-max-root',
    '--runtime-cache-dir',
    '--runtime-cache-mode',
  ]) {
    assert.match(buildScript, new RegExp(`\\['${escapedPattern(option)}', \\(parsed, value\\) =>`));
  }
  assert.match(buildScript, /const apply = booleanOptionSetters\.get\(token\)/);
  assert.match(buildScript, /const apply = valueOptionSetters\.get\(token\)/);
  assert.match(buildScript, /throw new Error\(`Unknown argument: \$\{token\}`\)/);
}

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
  assert.match(workflow, /full_dmg_compression_level:[\s\S]*default:\s+'9'[\s\S]*type:\s+string/);
  assert.match(workflow, /OPL_FULL_DMG_COMPRESSION_LEVEL:\s+\$\{\{ inputs\.full_dmg_compression_level \|\| '9' \}\}/);
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
  assert.match(diagnosticsStep, /full-package-build-timing\.json[\s\S]*full-package-manifest\.json[\s\S]*full-package-size-summary\.json[\s\S]*full-package-size-summary\.md[\s\S]*runtime-cache-events\.json[\s\S]*full-runtime-native-trust\.json[\s\S]*full-local-authorization-policy\.json[\s\S]*SHA256SUMS\.txt/);
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
      opl_runtime_bundle_consumer: {
        schema: 'opl_runtime_bundle_manifest_consumer.v1',
        app_repo_role: 'consumer_only',
        truth_owner: 'gaofeng21cn/one-person-lab',
        dependency_truth_owner: false,
        consumed_refs: {
          bundle_manifest: 'OPL runtime bundle manifest',
          bundle_lock: 'OPL runtime bundle lock',
          bundle_readback: 'OPL runtime env contract/readback',
          env_contract: 'OPL runtime env contract',
        },
        false_ready_flags: {
          cache_hit_is_release_ready: false,
          manifest_present_is_release_ready: false,
          lock_present_is_release_ready: false,
          full_package_built_is_release_ready: false,
          full_package_built_is_family_production_ready: false,
          app_can_claim_runtime_dependency_truth: false,
        },
        layer_taxonomy: {
          canonical_layer_ids: [
            'base-toolchain',
            'python-wheelhouse',
            'opl-framework-runtime',
            'domain-pack',
            'companion-skills',
            'optional-heavy-tools',
          ],
          legacy_assembly_layer_mapping: {
            toolchain: ['base-toolchain', 'python-wheelhouse', 'optional-heavy-tools'],
            'domain-runtime': ['domain-pack'],
            'opl-runtime': ['opl-framework-runtime'],
            skills: ['companion-skills'],
          },
        },
      },
      size_budget: {
        platform_scope: 'macos-arm64',
        warning_full_dmg_bytes: 700000000,
        max_full_dmg_bytes: 750000000,
        max_runtime_uncompressed_bytes: 1000,
      },
      size_breakdown: {
        opl_layer_taxonomy: {
          canonical_layer_ids: [
            'base-toolchain',
            'python-wheelhouse',
            'opl-framework-runtime',
            'domain-pack',
            'companion-skills',
            'optional-heavy-tools',
          ],
          legacy_assembly_layer_mapping: {
            toolchain: ['base-toolchain', 'python-wheelhouse', 'optional-heavy-tools'],
            'domain-runtime': ['domain-pack'],
            'opl-runtime': ['opl-framework-runtime'],
            skills: ['companion-skills'],
          },
        },
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
  assert.equal(summary.schema, 'opl_full_package_size_summary.v1');
  assert.equal(summary.version, '26.5.27-size');
  assert.equal(summary.budget.compressed_full_dmg.measurement_source, 'not_provided');
  assert.equal(summary.budget.compressed_full_dmg.release_blocking, false);
  assert.equal(summary.budget.compressed_full_dmg.status, 'unavailable');
  assert.equal(summary.budget.compressed_full_dmg.hard_limit_status, 'unavailable');
  assert.equal(summary.budget.runtime_uncompressed.status, 'passed');
  assert.equal(summary.budget.runtime_uncompressed.release_blocking, true);
  assert.equal(summary.warning_full_dmg_bytes, 700000000);
  assert.equal(summary.review_full_dmg_bytes, 750000000);
  assert.equal(summary.max_full_dmg_bytes, 750000000);
  assert.equal(summary.hard_full_dmg_bytes, null);
  assert.equal(summary.runtime_budget_used_percent, 50);
  assert.equal(summary.components[0].id, 'mas');
  assert.equal(summary.layers[0].id, 'toolchain');
  assert.equal(summary.opl_runtime_bundle_consumer.app_repo_role, 'consumer_only');
  assert.deepEqual(summary.opl_layer_taxonomy.canonical_layer_ids, [
    'base-toolchain',
    'python-wheelhouse',
    'opl-framework-runtime',
    'domain-pack',
    'companion-skills',
    'optional-heavy-tools',
  ]);
  assert.deepEqual(summary.opl_layer_taxonomy.legacy_assembly_layer_mapping.toolchain, [
    'base-toolchain',
    'python-wheelhouse',
    'optional-heavy-tools',
  ]);
  assert.equal(summary.top_contributors.components[0].id, 'mas');
  assert.equal(summary.top_contributors.layers[0].id, 'toolchain');
  assert.equal(summary.optimization_candidates[0].id, 'toolchain');
  assert.equal(summary.manifest_size_hotspots[2].path, 'toolchain/vendor');
  assert.equal(summary.manifest_size_hotspots[3].path, 'toolchain/vendor/temporal');

  const markdownResult = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
    '--full-dmg-size-bytes',
    '725000000',
    '--markdown',
  ]);
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /## Full Package Size/);
  assert.match(markdownResult.stdout, /Full DMG size: 691\.4 MiB \(warning\)/);
  assert.match(markdownResult.stdout, /\| Component \| Size \| Runtime % \| Version \/ Commit \|/);
  assert.match(markdownResult.stdout, /mas/);
  assert.match(markdownResult.stdout, /50% used/);
  assert.match(markdownResult.stdout, /Full DMG warning threshold: 667\.6 MiB/);
  assert.match(markdownResult.stdout, /Full DMG review threshold: 715\.3 MiB/);
  assert.match(markdownResult.stdout, /Full DMG hard limit: n\/a/);
  assert.match(markdownResult.stdout, /Full DMG gate status: warning/);
  assert.match(markdownResult.stdout, /Runtime budget: 1000 B \(50% used, passed\)/);
  assert.match(markdownResult.stdout, /\| mas \| 180 B \| 36% \|/);
  assert.match(markdownResult.stdout, /### Manifest Size Hotspots/);
  assert.match(markdownResult.stdout, /\| toolchain\/vendor\/temporal \| 150 B \|/);
  assert.match(markdownResult.stdout, /### Optimization Candidates/);
  assert.match(markdownResult.stdout, /OPL runtime bundle role: consumer_only/);
  assert.match(markdownResult.stdout, /### OPL Runtime Bundle Layer Taxonomy/);
  assert.match(markdownResult.stdout, /toolchain \| base-toolchain, python-wheelhouse, optional-heavy-tools/);
});

test('Full package size analyzer separates review threshold from hard limit', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-size-gate-'));
  const manifestPath = path.join(tempRoot, 'full-package-manifest.json');
  const manifest = {
    manifest_version: 2,
    version: '26.6.21-size-gate',
    package_kind: 'opl_full_first_install_macos_arm64',
    size_budget: {
      platform_scope: 'macos-arm64',
      warning_full_dmg_bytes: 700000000,
      max_full_dmg_bytes: 750000000,
      max_runtime_uncompressed_bytes: 1000000000,
    },
    size_breakdown: {
      total_runtime_uncompressed_bytes: 734713404,
      layers: {
        toolchain: { size_bytes: 539534131 },
        'domain-runtime': { size_bytes: 85679162 },
        'opl-runtime': { size_bytes: 105774657 },
        skills: { size_bytes: 3699940 },
      },
    },
    components: {
      node: { size_bytes: 132662000, version: 'v24.16.0' },
      opl: { size_bytes: 105774657, git_commit: 'b830b82b701e7fab49e2673a5184c2ffe2a3e7a5' },
    },
  };
  writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  const reviewResult = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
    '--full-dmg-size-bytes',
    '844079932',
  ]);
  assert.equal(reviewResult.status, 0, reviewResult.stderr);
  const reviewSummary = JSON.parse(reviewResult.stdout);
  assert.equal(reviewSummary.budget.status, 'requires_review');
  assert.equal(reviewSummary.budget.compressed_full_dmg.status, 'requires_review');
  assert.equal(reviewSummary.budget.compressed_full_dmg.warning_status, 'warning');
  assert.equal(reviewSummary.budget.compressed_full_dmg.review_threshold_status, 'above_review_threshold');
  assert.equal(reviewSummary.budget.compressed_full_dmg.hard_limit_status, 'unavailable');
  assert.equal(reviewSummary.budget.compressed_full_dmg.review_required, true);
  assert.equal(reviewSummary.budget.compressed_full_dmg.release_blocking, false);

  manifest.size_budget.hard_full_dmg_bytes = 800000000;
  writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const hardLimitResult = runNode([
    'scripts/analyze-full-package-size.ts',
    '--manifest',
    manifestPath,
    '--full-dmg-size-bytes',
    '844079932',
  ]);
  assert.equal(hardLimitResult.status, 0, hardLimitResult.stderr);
  const hardLimitSummary = JSON.parse(hardLimitResult.stdout);
  assert.equal(hardLimitSummary.budget.status, 'failed');
  assert.equal(hardLimitSummary.budget.compressed_full_dmg.status, 'failed');
  assert.equal(hardLimitSummary.budget.compressed_full_dmg.hard_limit_status, 'failed');
  assert.equal(hardLimitSummary.budget.compressed_full_dmg.release_blocking, true);
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
    sizePolicy.threshold_semantics.above_review_threshold_rule,
    /must not authorize removing required offline first-install payloads/,
  );
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
  assert.equal(
    packageJson.scripts['release:gate-reuse-plan'],
    'node --experimental-strip-types scripts/plan-release-gate-reuse.ts',
  );
  assert.equal(releaseContract.release_acceleration.gate_reuse.schema, 'opl_release_gate_reuse_plan.v1');
  assert.deepEqual(releaseContract.release_acceleration.gate_reuse.eligible_gate_ids, [
    'remote_release_verification',
    'standard_dmg_clean_vm',
    'stable_homebrew_tap_update',
    'full_homebrew_tap_update',
    'homebrew_standard_cask_clean_vm',
    'full_dmg_clean_vm',
    'one_shot_app_installer',
    'docker_webui',
    'webui_ghcr_publish',
    'full_size_cache_timing',
    'operator_evidence_bundle',
  ]);
  assert.deepEqual(releaseContract.release_acceleration.gate_reuse.required_match_fields, [
    'cohort',
    'version',
    'release_mode',
    'include_full_package',
    'run_vm_smoke',
    'app_commit',
    'shell_ref',
    'framework_ref',
    'resolved_ref_sha',
    'remote_asset_name_size_sha256',
    'previous_gate_status_passed',
    'previous_candidate_status_ready_to_promote',
    'reuse_digest',
  ]);
  assert.equal(releaseContract.release_acceleration.gate_reuse.digest_field, 'reuse_digest');
  assert.equal(
    releaseContract.release_acceleration.gate_reuse.workflow_consumption_status,
    'artifact_available_not_consumed_for_gate_skip',
  );
  assert.match(releaseContract.release_acceleration.gate_reuse.authority_boundary, /cannot claim release-ready/);
  assert.match(releaseContract.release_acceleration.gate_reuse.authority_boundary, /workflow explicitly consumes/);
  assert.equal(releaseContract.release_acceleration.tart_base_prebake.status, 'contracted_not_claimed_current');
  assert.equal(releaseContract.release_acceleration.tart_base_prebake.standard_source_vm_variable, 'OPL_FIRST_RUN_TART_SOURCE');
  assert.equal(releaseContract.release_acceleration.tart_base_prebake.homebrew_source_vm_variable, 'OPL_FIRST_RUN_HOMEBREW_TART_SOURCE');
  assert.ok(releaseContract.release_acceleration.tart_base_prebake.allowed_prebaked_layers.includes('node_runtime_prerequisites'));
  assert.ok(releaseContract.release_acceleration.tart_base_prebake.allowed_prebaked_layers.includes('codex_install_asset_cache_seed'));
  assert.ok(releaseContract.release_acceleration.tart_base_prebake.forbidden_prebaked_layers.includes('One Person Lab.app'));
  assert.ok(releaseContract.release_acceleration.tart_base_prebake.forbidden_prebaked_layers.includes('release_homebrew_cask'));
  assert.ok(releaseContract.release_acceleration.tart_base_prebake.forbidden_prebaked_layers.includes('runtime_truth'));
  assert.deepEqual(releaseContract.release_acceleration.tart_base_prebake.required_receipt_fields, [
    'source_vm',
    'image_id_or_digest',
    'created_at',
    'profile',
    'prebaked_layers',
    'truth_boundary',
    'validation_command',
  ]);
  assert.match(releaseContract.release_acceleration.tart_base_prebake.truth_boundary, /host setup latency only/);
  assert.match(releaseContract.release_acceleration.tart_base_prebake.truth_boundary, /VM smoke artifact/);
  assert.equal(releaseContract.release_acceleration.full_runtime_cache.enabled_by_default, true);
  assert.deepEqual(releaseContract.release_acceleration.full_runtime_cache.layer_ids, mod.FULL_RUNTIME_CACHE_LAYER_IDS);
  assert.deepEqual(
    releaseContract.release_acceleration.full_runtime_cache.opl_runtime_bundle_consumer.layer_taxonomy,
    mod.FULL_RUNTIME_CACHE_LAYER_TAXONOMY,
  );
  assert.equal(
    releaseContract.release_acceleration.full_runtime_cache.opl_runtime_bundle_consumer.source_surface.contract_ref,
    mod.OPL_RUNTIME_BUNDLE_SOURCE_SURFACE.contract_ref,
  );
  assert.equal(
    releaseContract.release_acceleration.full_runtime_cache.opl_runtime_bundle_consumer.consumption_boundary.can_claim_app_release_ready,
    false,
  );
  assert.equal(
    releaseContract.release_acceleration.full_runtime_cache.cache_hit_claim,
    'cache_hit_is_package_assembly_reuse_only',
  );
  assert.deepEqual(releaseContract.release_acceleration.full_runtime_cache.restore_prefixes, {
    toolchain: 'opl-full-runtime-layer-${runner.os}-${runner.arch}-full-runtime-v1-toolchain-',
    'domain-runtime': 'opl-full-runtime-layer-${runner.os}-${runner.arch}-full-runtime-v1-domain-runtime-',
    'opl-runtime': 'opl-full-runtime-layer-${runner.os}-${runner.arch}-full-runtime-v1-opl-runtime-',
    skills: 'opl-full-runtime-layer-${runner.os}-${runner.arch}-full-runtime-v1-skills-',
  });
  assert.equal(
    releaseContract.release_acceleration.full_runtime_cache.key_scope,
    'layer_content_only_not_release_or_dmg_wrapper_scripts',
  );
  assert.equal(releaseContract.release_acceleration.full_dmg_compression.default_ci_level, '9');
  assert.equal(releaseContract.release_acceleration.full_dmg_compression.telemetry_field, 'dmg_compression_level');
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
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.prune_policy_id,
    'full_runtime_offline_first_install_slim_v1',
  );
  assert.equal(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.manifest_policy_schema,
    'opl_full_runtime_prune_policy.v1',
  );
  assert.ok(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.node_toolchain_pruned.includes('npm/docs'),
  );
  assert.ok(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.python_runtime_pruned.includes('stdlib test suites'),
  );
  assert.ok(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.retained_offline_payloads.includes(
      'runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz',
    ),
  );
  assert.ok(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.retained_offline_payloads.includes(
      'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz',
    ),
  );
  assert.ok(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.manifest_assertions.includes(
      'runtime_assertions.offline_required_payloads',
    ),
  );
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
      opl_runtime_bundle_consumer: mod.OPL_RUNTIME_BUNDLE_CONSUMER_CONTRACT,
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
  assert.match(buildScript, /bunBin: envValue\('OPL_FULL_BUN_BIN', ''\)/);
  assert.match(buildScript, /includeBunRuntime: process\.env\.OPL_FULL_INCLUDE_BUN_RUNTIME === '1'/);
  assert.match(buildScript, /temporalCliBin: envValue\('OPL_FULL_TEMPORAL_CLI_BIN', ''\)/);
  assert.match(buildScript, /temporalCliArchive: envValue\('OPL_FULL_TEMPORAL_CLI_ARCHIVE', ''\)/);
  assert.doesNotMatch(buildScript, /--hermes-root/);
  assertFullFirstInstallOptionTables(buildScript);
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
  assert.match(buildScript, /function copyOplBookforgeSkill\(targetRoot, options\)/);
  assert.match(buildScript, /syncFamilySkillPackFromRepoRoot\('oplbookforge'/);
  assert.match(buildScript, /options\.bookforgeRoot/);
  assert.match(buildScript, /copySkillDirectory\(path\.dirname\(generatedSkillPath\), path\.join\(targetRoot, 'opl-bookforge'\), 'opl-bookforge'\)/);
  assert.match(buildScript, /function copySuperpowersBundle\(targetRoot, options\)/);
  assert.match(buildScript, /path\.join\(sourceRoot, 'skills'\)/);
  assert.match(buildScript, /path\.join\(skillsRoot, 'using-superpowers', 'SKILL\.md'\)/);
  assert.match(buildScript, /superpowers: \(targetRoot, options\) => copySuperpowersBundle\(targetRoot, options\)/);
  assert.match(buildScript, /'opl-bookforge': \(targetRoot, options\) => copyOplBookforgeSkill\(targetRoot, options\)/);
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
  assert.match(buildScript, /bookforge_skill_source: bookforgeSkillSnapshot\(options\)/);
  assert.match(buildScript, /bookforge_commit: readGitHead\(options\.bookforgeRoot\)/);
  assert.match(buildScript, /cron_skill_source: skillSourceSnapshot\(appCompanionSkillCandidates\('cron'\), 'skills\/cron'\)/);
  assert.match(buildScript, /pdf_skill_source: skillSourceSnapshot\(appCompanionSkillCandidates\('pdf'\), 'skills\/pdf'\)/);
  assert.match(buildScript, /mineru_document_extractor_source: skillSourceSnapshot\(mineruDocumentExtractorSkillCandidates\(options\), 'skills\/mineru-document-extractor'\)/);
  assert.match(buildScript, /runtime_layer_builder_source_hash: functionSourceSha256/);
  assert.match(buildScript, /support_files:\s+hashFiles\(appRepoRoot,[\s\S]*'contracts\/app-product-profile\.json'[\s\S]*'scripts\/build-full-first-install-package\/runtime-cache\.ts'[\s\S]*'scripts\/build-full-first-install-package\/runtime-layers\.ts'[\s\S]*'scripts\/build-full-first-install-package\/runtime-sources\.ts'[\s\S]*'scripts\/build-full-first-install-package\/skills\.ts'/);
  assert.doesNotMatch(buildScript, /support_files:[\s\S]{0,1200}'scripts\/build-full-first-install-package\.ts'/);
  assert.doesNotMatch(buildScript, /support_files:[\s\S]{0,1200}'scripts\/build-full-first-install-package\/archive-output\.ts'/);
  assert.doesNotMatch(buildScript, /support_files:[\s\S]{0,1200}'scripts\/build-full-first-install-package\/manifest-checksum\.ts'/);
  assert.match(buildScript, /key_inputs: cacheKeyInputs/);
  assert.match(buildScript, /resolveFullDmgCompressionLevel\(\)/);
  assert.match(buildScript, /process\.env\.CI === 'true' \? '9' : '7'/);
  assert.match(buildScript, /dmg_compression_level: process\.env\.ELECTRON_BUILDER_COMPRESSION_LEVEL/);
  assert.match(buildScript, /guiRoot: envValue\('OPL_FULL_GUI_ROOT', resolveActiveShellPaths\(\)\.shellRoot\)/);
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
  assert.match(fullRuntimeWrapperScript, /OPL_MODULE_PATH_OPLBOOKFORGE="\$RUNTIME_HOME\/modules\/bookforge"/);
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
  assert.match(buildScript, /opl_runtime_environment_substrate: \{/);
  assert.match(buildScript, /contract_path: 'contracts\/opl-framework\/runtime-environment-substrate-contract\.json'/);
  assert.match(buildScript, /artifactNames\.runtimeCacheEvents/);
  assert.match(publishScript, /skipped_existing_artifacts/);
  assert.match(publishScript, /--force-upload/);
  assert.match(publishScript, /cleanupNewlyCreatedReleaseAfterUploadFailure/);
  assert.match(publishScript, /'release', 'delete', tag, '--repo', repo, '--yes', '--cleanup-tag'/);
});

test('Full runtime pruning keeps macOS arm64 launch payloads without development environments', async () => {
  const mod = await import('../../../scripts/full-first-install-package.ts');
  const buildScript = readFullPackageBuilderSource();
  const runtimeLayersScript = fs.readFileSync(
    path.join(appRoot, 'scripts', 'build-full-first-install-package', 'runtime-layers.ts'),
    'utf8',
  );

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
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/.github/workflows/ci.yml'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/.next/cache/webpack.bin'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mag/.turbo/cache/hash'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/storybook-static/index.html'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/playwright-report/index.html'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/test-results/e2e/output.zip'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/src/generated/client.js.map'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/runtime-state/quest/output.png'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/runs/2026-05-27/result.json'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/prompts/xiaohongshu/style-references/ref.png'), false);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/assets/branding/logo.png'), false);
  assert.equal(mod.shouldExcludeProductionNodeModulePath('test/fixtures/large.json'), true);
  assert.equal(mod.shouldExcludeProductionNodeModulePath('__snapshots__/case.snap'), true);
  assert.equal(mod.shouldExcludeProductionNodeModulePath('docs/api.md'), true);
  assert.equal(mod.shouldExcludeProductionNodeModulePath('dist/index.js.map'), true);
  assert.equal(mod.shouldExcludeProductionNodeModulePath('lib/index.js'), false);
  assert.equal(mod.shouldExcludeProductionNodeModulePath('lib/native/addon.node'), false);
  assert.equal(mod.shouldExcludeProductionNodeModulePath('schema/runtime.json'), false);
  assert.equal(mod.shouldExcludeRuntimePath('python/cpython-3.12.12-macos-aarch64-none/lib/python3.12/test/test_os.py'), true);
  assert.equal(mod.shouldExcludeRuntimePath('python/cpython-3.12.12-macos-aarch64-none/lib/python3.12/unittest/test/test_case.py'), true);
  assert.equal(mod.shouldExcludeRuntimePath('python/cpython-3.12.12-macos-aarch64-none/include/python3.12/Python.h'), false);
  assert.equal(mod.shouldExcludeRuntimePath('python/cpython-3.12.12-macos-aarch64-none/lib/python3.12/ensurepip/__init__.py'), false);
  assert.equal(mod.shouldExcludeNodeToolchainPackagePath('docs/output/config.md'), true);
  assert.equal(mod.shouldExcludeNodeToolchainPackagePath('man/man1/npm.1'), true);
  assert.equal(mod.shouldExcludeNodeToolchainPackagePath('tap-snapshots/install.snap'), true);
  assert.equal(mod.shouldExcludeNodeToolchainPackagePath('lib/cli.js'), false);
  assert.equal(mod.shouldExcludeNodeToolchainPackagePath('node_modules/@npmcli/arborist/lib/index.js'), false);
  assert.equal(mod.FULL_RUNTIME_PRUNE_POLICY.schema, 'opl_full_runtime_prune_policy.v1');
  assert.equal(mod.FULL_RUNTIME_PRUNE_POLICY.id, 'full_runtime_offline_first_install_slim_v1');
  assert.match(mod.buildFullRuntimePrunePolicyHash(), /^[a-f0-9]{64}$/);
  assert.equal(mod.buildFullPackageManifest({ version: '26.5.15' }).runtime_prune_policy.id, mod.FULL_RUNTIME_PRUNE_POLICY.id);
  assert.match(buildScript, /shouldExcludeProductionNodeModulePath/);
  assert.match(buildScript, /shouldExcludeNodeToolchainPackagePath/);
  assert.match(buildScript, /copyProductionNodeModule\(sourcePath, targetPath\)/);
  assert.match(buildScript, /copyNodeToolchainPackage\(sourcePath, path\.join\(targetRoot, 'lib', 'node_modules', packageName\)\)/);
  assert.match(buildScript, /MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET = 'aarch64-apple-darwin'/);
  assert.match(buildScript, /pruneTemporalCoreBridgeReleases\(path\.join\(targetRoot, 'node_modules'\)\)/);
  assert.match(buildScript, /assertTemporalCoreBridgeMacosArm64Only\(path\.join\(runtimeRoot, 'opl', 'node_modules'\)\)/);
  assert.match(buildScript, /runtimeAssertions: collectRuntimeAssertions\(runtimeRoot\)/);
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

  assert.equal(hygiene.prune_policy_id, 'full_runtime_offline_first_install_slim_v1');
  assert.equal(hygiene.manifest_policy_schema, 'opl_full_runtime_prune_policy.v1');
  assert.ok(hygiene.node_toolchain_pruned.includes('npm/docs'));
  assert.ok(hygiene.python_runtime_pruned.includes('stdlib test suites'));
  assert.ok(hygiene.retained_offline_payloads.includes('runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz'));
  assert.ok(hygiene.retained_offline_payloads.includes('runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz'));
  assert.ok(hygiene.retained_offline_payloads.includes('runtime/current/node/bin/node'));
  assert.ok(hygiene.retained_offline_payloads.includes('runtime/current/python/<cpython>/bin/python3'));
  assert.ok(hygiene.retained_offline_payloads.includes('runtime/current/modules/mas'));
  assert.ok(hygiene.retained_offline_payloads.includes('runtime/current/skills'));
  assert.ok(hygiene.manifest_assertions.includes('runtime_prune_policy.id'));
  assert.ok(hygiene.manifest_assertions.includes('runtime_assertions.prune_policy_hash'));
  assert.ok(hygiene.manifest_assertions.includes('runtime_assertions.offline_required_payloads'));
  assert.ok(hygiene.manifest_assertions.includes('runtime_assertions.declared_pruned_paths'));
  assert.match(hygiene.app_policy, /do not prune declared offline first-install payloads/);
});

test('Full runtime node payload prunes package-only docs while preserving offline launch executables', async () => {
  const { copyNodeRuntimePayload } = await import('../../../scripts/build-full-first-install-package/filesystem.ts');
  const { collectRuntimeAssertions } = await import('../../../scripts/build-full-first-install-package/runtime-layers.ts');
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
  for (const skillId of ['mas', 'mag', 'rca', 'opl-bookforge']) {
    writeFile(path.join(runtimeRoot, 'skills', skillId, 'SKILL.md'), '# skill\n');
  }
  writeFile(path.join(runtimeRoot, 'skills', 'superpowers', '.codex-plugin', 'plugin.json'), '{}\n');

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
    assertions.declared_pruned_paths.find((entry) => entry.path === 'node/include')?.present,
    false,
  );
  assert.equal(
    assertions.declared_pruned_paths.find((entry) => entry.path === 'node/lib/node_modules/npm/docs')?.present,
    false,
  );
});
