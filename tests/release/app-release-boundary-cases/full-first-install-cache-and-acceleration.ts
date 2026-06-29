import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  activeShellRoot,
  readFullPackageBuilderSource,
  runNode,
  assertFullFirstInstallOptionTables,
} from './helpers.ts';

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
    packageJson.scripts['release:full:prune-audit'],
    'node --experimental-strip-types scripts/audit-full-runtime-prune-policy.ts',
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
  assert.deepEqual(releaseContract.release_acceleration.cohort_prepare, {
    package_script: 'release:cohort-plan',
    script: 'scripts/plan-release-cohort.ts',
    schema: 'opl_app_release_cohort_plan.v1',
    records: [
      'version',
      'tag',
      'release_mode',
      'app_commit',
      'shell_ref',
      'framework_ref',
      'include_full_package',
      'run_vm_smoke',
      'cheap_source_gates',
      'next_action',
    ],
    purpose: 'separate currentness preparation from stable release dispatch by recording the exact pinned cohort refs before expensive release gates',
    authority_boundary:
      'cohort plan is an operator planning artifact only; it cannot publish a release, claim release-ready, write runtime truth, or replace same-cohort release evidence',
  });
  assert.deepEqual(releaseContract.release_acceleration.release_operator, {
    package_script: 'release:operator',
    script: 'scripts/release-operator.ts',
    state_schema: 'opl_app_release_operator_state.v1',
    state_artifacts: [
      'release-operator-state.json',
      'release-operator-state.md',
    ],
    commands: [
      'plan',
      'diagnose-vm',
    ],
    typed_next_actions: [
      'repair_source_gate',
      'rerun_diagnostic_same_artifact',
      'provide_owner_receipt',
      'wait_for_runner_capacity',
      'retry_transient_upload',
      'promote_candidate',
    ],
    authority_boundary:
      'release operator is a thin controller over existing release scripts, workflows, and artifacts; it must not become release truth, publish by implication, claim release-ready, or write runtime/domain truth',
  });
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
  assert.equal(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.source_of_truth,
    'contracts/full-runtime-prune-policy.json',
  );
  assert.equal(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.prune_policy_id,
    'full_runtime_offline_first_install_slim_v1',
  );
  assert.equal(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.manifest_policy_schema,
    'opl_full_runtime_prune_policy.v1',
  );
  assert.equal(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.policy_summary_boundary,
    'This release contract records the policy owner and evidence surfaces only. Runtime tree filters, package filters, app-bundle trim rules, protected payloads, validation examples, and expected absent paths are not duplicated here; they live in the source_of_truth contract and must be read through the policy audit.',
  );
  assert.deepEqual(releaseContract.release_acceleration.full_runtime_packaging_hygiene.policy_surfaces, [
    'runtime_tree',
    'production_node_modules',
    'node_toolchain_global_packages',
    'app_bundle_staging',
    'runtime_assertions',
    'validation_examples',
  ]);
  for (const duplicatedPolicyField of [
    'local_state_excluded',
    'node_toolchain_pruned',
    'python_runtime_pruned',
    'retained_offline_payloads',
    'app_bundle_staging',
  ]) {
    assert.equal(
      Object.hasOwn(releaseContract.release_acceleration.full_runtime_packaging_hygiene, duplicatedPolicyField),
      false,
      duplicatedPolicyField,
    );
  }
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
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.policy_audit_command,
    'npm run release:full:prune-audit -- --markdown',
  );
  assert.equal(
    releaseContract.release_acceleration.full_runtime_packaging_hygiene.app_bundle_staging_surface,
    'contracts/full-runtime-prune-policy.json#app_bundle_staging',
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
