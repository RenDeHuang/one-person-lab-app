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
} from './helpers.ts';

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

test('Full first-install manifest consumes the OPL runtime bundle boundary instead of owning dependency truth', async () => {
  const mod = await import('../../../scripts/full-first-install-package.ts');
  const manifest = mod.buildFullPackageManifest({ version: '26.6.21-bundle-consumer' });

  assert.equal(manifest.opl_runtime_bundle_consumer.app_repo_role, 'consumer_only');
  assert.equal(manifest.opl_runtime_bundle_consumer.dependency_truth_owner, false);
  assert.equal(manifest.opl_runtime_bundle_consumer.consumption_boundary.keeps_full_offline_first_install_payloads, true);
  assert.equal(manifest.opl_runtime_bundle_consumer.consumption_boundary.can_delete_required_offline_payloads_for_size, false);
});

test('Full runtime pruning keeps macOS arm64 launch payloads without development environments', async () => {
  const mod = await import('../../../scripts/full-first-install-package.ts');
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

  for (const relativePath of [
    'bin/node',
    'bin/npm',
    'bin/npx',
    'lib/node_modules/npm/lib/cli.js',
    'lib/node_modules/npm/node_modules/@npmcli/arborist/lib/index.js',
    'lib/node_modules/corepack/dist/corepack.js',
  ]) {
    assert.equal(fs.existsSync(path.join(targetRoot, relativePath)), true, relativePath);
  }
  for (const relativePath of [
    'include',
    'share',
    'lib/node_modules/npm/docs',
    'lib/node_modules/npm/man',
    'lib/node_modules/npm/tap-snapshots',
    'lib/node_modules/corepack/tests',
  ]) {
    assert.equal(fs.existsSync(path.join(targetRoot, relativePath)), false, relativePath);
  }

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
  for (const [modulePath, pluginId] of [
    ['modules/mas', 'med-autoscience'],
    ['modules/mag', 'med-autogrant'],
    ['modules/rca', 'redcube-ai'],
  ]) {
    writeFile(path.join(runtimeRoot, modulePath, 'plugins', pluginId, '.codex-plugin', 'plugin.json'), '{}\n');
    writeFile(path.join(runtimeRoot, modulePath, 'plugins', pluginId, 'skills', pluginId, 'SKILL.md'), '# skill\n');
  }
  for (const relativePath of [
    'modules/opl-flow/.codex-plugin/plugin.json',
    'modules/opl-flow/scripts/install_local_plugin.py',
    'modules/opl-flow/skills/opl-flow/SKILL.md',
    'modules/opl-flow/skills/risk-based-development-flow/SKILL.md',
    'modules/opl-flow/skills/codex-ops-kit/SKILL.md',
  ]) {
    writeFile(path.join(runtimeRoot, relativePath), relativePath.endsWith('.json') ? '{}\n' : '# fixture\n');
  }

  const assertions = collectRuntimeAssertions(runtimeRoot);
  assert.equal(assertions.prune_policy_id, 'full_runtime_offline_first_install_slim_v1');
  assert.match(assertions.prune_policy_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(assertions.packaged_global_node_packages, ['corepack', 'npm']);
  for (const [entryPath, field] of [
    ['vendor/codex/codex_cli_darwin_arm64.tar.gz', 'exists'],
    ['vendor/temporal/temporal_cli_darwin_arm64.tar.gz', 'exists'],
    ['node/bin/npm', 'executable'],
    ['modules/mag/plugins/med-autogrant/.codex-plugin/plugin.json', 'exists'],
    ['modules/mag/plugins/med-autogrant/skills/med-autogrant/SKILL.md', 'exists'],
  ]) {
    assert.equal(assertions.offline_required_payloads.find((entry) => entry.path === entryPath)?.[field], true, entryPath);
  }
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
  for (const entryPath of ['node/include', 'node/lib/node_modules/npm/docs']) {
    assert.equal(assertions.declared_pruned_paths.find((entry) => entry.path === entryPath)?.present, false, entryPath);
  }
});
