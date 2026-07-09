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

  for (const [scriptName, expectedCommand] of Object.entries({
    'release:plan': 'node --experimental-strip-types scripts/plan-release-candidate.ts',
    'release:readiness-summary': 'node --experimental-strip-types scripts/summarize-release-readiness.ts',
    'release:full:size': 'node --experimental-strip-types scripts/analyze-full-package-size.ts',
    'release:full:prune-audit': 'node --experimental-strip-types scripts/audit-full-runtime-prune-policy.ts',
    'release:gate-reuse-plan': 'node --experimental-strip-types scripts/plan-release-gate-reuse.ts',
  })) {
    assert.equal(packageJson.scripts[scriptName], expectedCommand, scriptName);
  }
  assert.equal(releaseContract.release_acceleration.gate_reuse.schema, 'opl_release_gate_reuse_plan.v1');
  for (const id of ['remote_release_verification', 'full_dmg_clean_vm', 'docker_webui', 'webui_ghcr_publish', 'operator_evidence_bundle']) {
    assert.ok(releaseContract.release_acceleration.gate_reuse.eligible_gate_ids.includes(id), id);
  }
  for (const field of ['cohort', 'version', 'release_mode', 'app_commit', 'shell_ref', 'framework_ref', 'reuse_digest']) {
    assert.ok(releaseContract.release_acceleration.gate_reuse.required_match_fields.includes(field), field);
  }
  assert.equal(releaseContract.release_acceleration.gate_reuse.digest_field, 'reuse_digest');
  assert.equal(
    releaseContract.release_acceleration.gate_reuse.workflow_consumption_status,
    'artifact_available_not_consumed_for_gate_skip',
  );
  assert.match(releaseContract.release_acceleration.gate_reuse.authority_boundary, /cannot claim release-ready/);
  assert.match(releaseContract.release_acceleration.gate_reuse.authority_boundary, /workflow explicitly consumes/);
  assert.equal(releaseContract.release_acceleration.cohort_prepare.schema, 'opl_app_release_cohort_plan.v1');
  assert.equal(releaseContract.release_acceleration.cohort_prepare.package_script, 'release:cohort-plan');
  assert.equal(releaseContract.release_acceleration.cohort_prepare.stable_candidate_freeze.required, true);
  assert.deepEqual(releaseContract.release_acceleration.cohort_prepare.stable_candidate_freeze.pinned_sha_fields, ['app_sha', 'shell_sha', 'framework_sha']);
  assert.match(releaseContract.release_acceleration.cohort_prepare.authority_boundary, /cannot publish|claim release-ready|write runtime truth/);
  assert.equal(releaseContract.release_acceleration.release_operator.state_schema, 'opl_app_release_operator_state.v1');
  assert.equal(releaseContract.release_acceleration.release_operator.primary_blocker_policy.monitor_mode, 'no_watch');
  for (const action of ['repair_source_gate', 'dispatch_new_cohort', 'promote_candidate']) {
    assert.ok(releaseContract.release_acceleration.release_operator.typed_next_actions.includes(action), action);
  }
  assert.match(releaseContract.release_acceleration.release_operator.authority_boundary, /must not become release truth|claim release-ready/);
  for (const field of ['phase', 'state', 'primary_blocker', 'recommended_next_action']) {
    assert.ok(releaseContract.release_acceleration.release_monitor.required_status_fields.includes(field), field);
  }
  assert.equal(releaseContract.release_acceleration.release_monitor.mode, 'no_watch');
  assert.match(releaseContract.release_acceleration.release_monitor.authority_boundary, /not release truth/);
  assert.match(releaseContract.release_acceleration.release_monitor.authority_boundary, /same-cohort evidence/);
  assert.match(releaseContract.release_acceleration.release_monitor.authority_boundary, /owner receipt/);
  assert.equal(
    releaseContract.release_acceleration.release_monitor.phase_budgets.full_build.warning_after_seconds,
    3600,
  );
  assert.equal(
    releaseContract.release_acceleration.release_monitor.phase_budgets.full_build.timeout_after_seconds,
    5400,
  );
  assert.deepEqual(
    releaseContract.release_acceleration.release_monitor.phase_budgets.full_build.recommended_next_actions,
    {
      warning: 'inspect_full_build_diagnostics',
      timeout: 'rerun_full_build_same_cohort',
      diagnostic: 'inspect_full_build_diagnostics',
    },
  );
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
  const manifest = mod.buildFullPackageManifest({ version: '26.6.21-bundle-consumer' });
  assert.equal(
    releaseContract.release_acceleration.full_runtime_cache.opl_runtime_bundle_consumer.source_surface.contract_ref,
    manifest.opl_runtime_bundle_consumer.source_surface.contract_ref,
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
  assert.equal(releaseContract.release_acceleration.full_dmg_compression.default_ci_format, 'ULMO');
  assert.equal(releaseContract.release_acceleration.full_dmg_compression.default_ci_level, '9');
  assert.equal(releaseContract.release_acceleration.full_dmg_compression.format_telemetry_field, 'dmg_format');
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
      opl_runtime_bundle_consumer: manifest.opl_runtime_bundle_consumer,
      layers: {
        toolchain: 'full-runtime-v1-toolchain-a',
        'domain-runtime': 'full-runtime-v1-domain-runtime-b',
        'opl-runtime': 'full-runtime-v1-opl-runtime-c',
        skills: 'full-runtime-v1-skills-d',
      },
    },
  );
  assert.match(cacheHit.archive_path, /opl-runtime/);
  for (const pattern of [
    /Library', 'Caches', 'One Person Lab', 'full-runtime-layers'/, /runtimeCacheMode: process\.env\.OPL_FULL_RUNTIME_CACHE_MODE \|\| 'readwrite'/,
    /CODEX_MACOS_ARM64_TARGET = 'aarch64-apple-darwin'/, /siblingPlatformVendorRoot/,
    /const vendorRoots = \[siblingPlatformVendorRoot, platformVendorRoot, localVendorRoot\]/, /codexCandidatesForVendorRoot/, /rgCandidatesForVendorRoot/,
    /const vendorRoot = requireFirstVendorRoot\(\)/, /return \{\s*vendorRoot,/, /function findNodeToolchain\(explicitNodeBin\)/,
    /npmBin: requireNodeToolchainFile\(nodeBinDir, 'npm'/, /npxBin: requireNodeToolchainFile\(nodeBinDir, 'npx'/,
    /npmRoot: requireNodeToolchainDirectory\(path\.join\(nodeRoot, 'lib', 'node_modules', 'npm'\)/, /bunBin: envValue\('OPL_FULL_BUN_BIN', ''\)/,
    /includeBunRuntime: process\.env\.OPL_FULL_INCLUDE_BUN_RUNTIME === '1'/, /temporalCliBin: envValue\('OPL_FULL_TEMPORAL_CLI_BIN', ''\)/,
    /temporalCliArchive: envValue\('OPL_FULL_TEMPORAL_CLI_ARCHIVE', ''\)/, /function findBunBinary\(explicitBunBin\)/,
    /function findTemporalCliBinary\(explicitBin\)/, /function findTemporalCliArchive\(explicitArchive\)/,
    /options\.includeBunRuntime \? findBunBinary\(options\.bunBin\) : null/, /findTemporalCliArchive,/,
    /meta_agent_skill_source: metaAgentSkillSnapshot\(options\)/, /bookforge_skill_source: bookforgeSkillSnapshot\(options\)/,
    /bookforge_commit: readGitHead\(options\.bookforgeRoot\)/, /cron_skill_source: skillSourceSnapshot\(appCompanionSkillCandidates\('cron'\), 'skills\/cron'\)/,
    /pdf_skill_source: skillSourceSnapshot\(appCompanionSkillCandidates\('pdf'\), 'skills\/pdf'\)/,
    /mineru_document_extractor_source: skillSourceSnapshot\(mineruDocumentExtractorSkillCandidates\(options\), 'skills\/mineru-document-extractor'\)/,
    /runtime_layer_builder_source_hash: functionSourceSha256/,
    /support_files:\s+hashFiles\(appRepoRoot,[\s\S]*'contracts\/app-product-profile\.json'[\s\S]*'scripts\/build-full-first-install-package\/runtime-cache\.ts'[\s\S]*'scripts\/build-full-first-install-package\/runtime-layers\.ts'[\s\S]*'scripts\/build-full-first-install-package\/runtime-sources\.ts'[\s\S]*'scripts\/build-full-first-install-package\/skills\.ts'/,
    /key_inputs: cacheKeyInputs/, /resolveFullDmgCompressionLevel\(\)/, /dmg_format: dmgFormat/, /process\.env\.CI === 'true' \? '9' : '7'/,
    /dmg_compression_level: process\.env\.ELECTRON_BUILDER_COMPRESSION_LEVEL/, /guiRoot: envValue\('OPL_FULL_GUI_ROOT', resolveActiveShellPaths\(\)\.shellRoot\)/,
    /syncAppProductProfileToShell\(options\.guiRoot\)/, /if \(cacheEvent\.read_archive\) {\s*extractLayer\(archivePath, targetRoot\);\s*return {\s*\.\.\.cacheEvent,\s*duration_seconds: durationSeconds\(startedAt, monotonicSeconds\(\)\),\s*};\s*}\s*const tempLayerRoot/,
    /duration_seconds: durationSeconds\(startedAt, monotonicSeconds\(\)\)/, /aggregate_key_input: buildFullRuntimeAggregateCacheKeyInput\(\{ layers \}\)/,
    /opl_runtime_environment_substrate: \{/, /contract_path: 'contracts\/opl-framework\/runtime-environment-substrate-contract\.json'/, /artifactNames\.runtimeCacheEvents/,
  ]) assert.match(buildScript, pattern);
  assertFullFirstInstallOptionTables(buildScript);
  for (const pattern of [/--hermes-root/, /support_files:[\s\S]{0,1200}'scripts\/build-full-first-install-package\.ts'/, /support_files:[\s\S]{0,1200}'scripts\/build-full-first-install-package\/archive-output\.ts'/, /support_files:[\s\S]{0,1200}'scripts\/build-full-first-install-package\/manifest-checksum\.ts'/, /guiRoot: process\.env\.OPL_FULL_GUI_ROOT \|\| path\.join\(appRepoRoot, 'shells', 'aionui'\)/]) assert.doesNotMatch(buildScript, pattern);
  for (const pattern of [/repository: obra\/superpowers/, /path: superpowers/, /OPL_FULL_SUPERPOWERS_ROOT="\$GITHUB_WORKSPACE\/superpowers"/]) assert.match(fullWorkflow, pattern);
  const fullRuntimeWrapperScript = fs.readFileSync(
    path.join(appRoot, 'scripts', 'full-first-install-runtime-wrappers.ts'),
    'utf8',
  );
  for (const pattern of [/OPL_MODULE_PATH_MEDAUTOSCIENCE="\$RUNTIME_HOME\/modules\/mas"/, /OPL_MODULE_PATH_MEDAUTOGRANT="\$RUNTIME_HOME\/modules\/mag"/, /OPL_MODULE_PATH_REDCUBE="\$RUNTIME_HOME\/modules\/rca"/, /OPL_MODULE_PATH_OPLMETAAGENT="\$RUNTIME_HOME\/modules\/meta-agent"/, /OPL_MODULE_PATH_OPLBOOKFORGE="\$RUNTIME_HOME\/modules\/bookforge"/, /OPL_TEMPORAL_ADDRESS="\\\$\{OPL_TEMPORAL_ADDRESS:-127\.0\.0\.1:7233\}"/, /OPL_TEMPORAL_NAMESPACE="\\\$\{OPL_TEMPORAL_NAMESPACE:-default\}"/, /OPL_TEMPORAL_TASK_QUEUE="\\\$\{OPL_TEMPORAL_TASK_QUEUE:-opl-stage-attempts\}"/]) assert.match(fullRuntimeWrapperScript, pattern);
  for (const pattern of [/syncAppProductProfileToShell\(shellPaths\.shellRoot, \{ optional: true \}\)/, /fs\.copyFileSync\(appInstallerPath, shellBootstrapInstallerPath\)/, /fs\.chmodSync\(shellBootstrapInstallerPath, 0o755\)/]) assert.match(prepareStandardScript, pattern);
  assert.match(electronBuilder, /from: resources\/opl-install\.sh\s+to: opl-install\.sh/);
  for (const pattern of [/skipped_existing_artifacts/, /--force-upload/, /cleanupNewlyCreatedReleaseAfterUploadFailure/, /'release', 'delete', tag, '--repo', repo, '--yes'\]/]) assert.match(publishScript, pattern);
  assert.doesNotMatch(publishScript, /cleanupNewlyCreatedReleaseAfterUploadFailure[\s\S]*--cleanup-tag/);
});
