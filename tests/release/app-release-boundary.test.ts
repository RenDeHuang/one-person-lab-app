import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

function runNode(args, options = {}) {
  return spawnSync(process.execPath, ['--experimental-strip-types', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

function writeFile(filePath, content = 'artifact') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeReleaseMetadata(outDir, version, assetName) {
  writeFile(path.join(outDir, 'latest-mac.yml'), [
    `version: ${version}`,
    'files:',
    `  - url: ${assetName}`,
    '    sha512: test',
    '    size: 1',
    `path: ${assetName}`,
    'sha512: test',
    '',
  ].join('\n'));
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function buildRemoteReleaseView(assetDir, names, tagName) {
  return {
    tagName,
    isDraft: false,
    isPrerelease: false,
    assets: names.map((name) => {
      const filePath = path.join(assetDir, name);
      return {
        name,
        size: fs.statSync(filePath).size,
        digest: `sha256:${fileSha256(filePath)}`,
      };
    }),
  };
}

function standardRemoteAssetNames(version) {
  return [
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One-Person-Lab-${version}-mac-arm64.zip`,
    `One-Person-Lab-${version}-mac-arm64.dmg.blockmap`,
    `One-Person-Lab-${version}-mac-arm64.zip.blockmap`,
    'latest-mac.yml',
    'latest-arm64-mac.yml',
  ];
}

function writeStandardRemoteAssets(outDir, version, options = {}) {
  const names = standardRemoteAssetNames(version);
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  writeFile(path.join(outDir, dmgName), 'standard-dmg');
  writeFile(path.join(outDir, zipName), 'standard-zip');
  writeFile(path.join(outDir, `${dmgName}.blockmap`), 'standard-dmg-blockmap');
  writeFile(path.join(outDir, `${zipName}.blockmap`), 'standard-zip-blockmap');
  const metadata = [
    `version: ${version}`,
    'files:',
    `  - url: ${dmgName}`,
    '    sha512: test-dmg',
    '    size: 12',
    `  - url: ${zipName}`,
    '    sha512: test-zip',
    '    size: 12',
    `path: ${dmgName}`,
    'sha512: test-dmg',
    ...(options.fullLeak ? [`notes: One-Person-Lab-Full-${version}-mac-arm64.dmg`] : []),
    '',
  ].join('\n');
  writeFile(path.join(outDir, 'latest-mac.yml'), metadata);
  writeFile(path.join(outDir, 'latest-arm64-mac.yml'), metadata);
  return names;
}

function writeFullRemoteAssets(outDir, version, options = {}) {
  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const manifest = {
    manifest_version: 2,
    version,
    package_kind: 'opl_full_first_install_macos_arm64',
    size_budget: {
      platform_scope: 'macos-arm64',
      max_full_dmg_bytes: 450000000,
      max_runtime_uncompressed_bytes: 800000000,
    },
    measurement_policy: {
      full_dmg_bytes: 'github_release_asset_size_bytes',
      runtime_uncompressed_bytes: 'manifest_size_breakdown_total_runtime_uncompressed_bytes',
    },
    size_breakdown: {
      total_runtime_uncompressed_bytes: 128,
      layers: {
        toolchain: { size_bytes: 64 },
        'domain-runtime': { size_bytes: 32 },
        'opl-runtime': { size_bytes: 24 },
        skills: { size_bytes: 8 },
      },
    },
    distribution: {
      updater_metadata_allowed: false,
    },
    ...(options.manifest ?? {}),
  };
  writeFile(path.join(outDir, fullDmgName), options.dmgContent ?? 'full-dmg');
  writeFile(path.join(outDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(outDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  const checksumNames = [
    fullDmgName,
    'full-package-manifest.json',
    'README-Full-First-Install.txt',
  ];
  writeFile(
    path.join(outDir, 'SHA256SUMS.txt'),
    checksumNames.map((name) => `${fileSha256(path.join(outDir, name))}  ${name}`).join('\n') + '\n',
  );
  return [
    fullDmgName,
    'full-package-manifest.json',
    'README-Full-First-Install.txt',
    'SHA256SUMS.txt',
  ];
}

function readProductProfile() {
  return JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-product-profile.json'), 'utf8'));
}

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((left, right) => (
    left.name.localeCompare(right.name)
  ));
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function matchCount(source, pattern) {
  return Array.from(source.matchAll(pattern)).length;
}

test('release boundary guard keeps App release ownership in App repo', () => {
  const result = runNode(['scripts/validate-release-boundary.ts']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /App release boundary is App-owned/);
});

test('App product profile owns user-facing defaults without runtime authority', () => {
  const profile = readProductProfile();

  assert.equal(profile.owner, 'one-person-lab-app');
  assert.equal(profile.purpose, 'app_owned_product_profile');
  assert.equal(profile.app_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(profile.default_session_profile.executor, 'codex_cli');
  assert.equal(profile.default_session_profile.model, profile.codex.default_model);
  assert.equal(profile.default_session_profile.reasoning_effort, profile.codex.default_reasoning_effort);
  assert.ok(profile.codex.default_visible_skills.includes('mineru-document-extractor'));
  assert.ok(profile.codex.default_visible_skills.includes('ui-ux-pro-max'));
  assert.ok(profile.codex.skill_priority.includes('morph-ppt'));
  assert.ok(profile.first_run.deferred_blockers.includes('domain_modules'));
  assert.equal(profile.first_run.command_line_tools.auto_request_installer, true);
  assert.equal(profile.first_run.command_line_tools.blocks_full_first_launch, false);
  assert.ok(profile.companion_payloads.domain_modules.includes('opl-meta-agent'));
  for (const forbiddenOwner of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    assert.ok(profile.boundary.app_does_not_own.includes(forbiddenOwner), forbiddenOwner);
  }
});

test('runtime page consumes OPL App/operator drilldown instead of App-owned runtime truth', () => {
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const runtimePage = pageStateMatrix.pages.find((page) => page.id === 'runtime');

  assert.equal(runtimePage.machine_source, 'runtime_tray_snapshot.app_operator_drilldown');
  assert.equal(runtimePage.framework_command, 'opl runtime app-operator-drilldown --json');
  assert.equal(runtimePage.page_contract, 'runtime_workbench_drilldown');
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.role,
    'runtime_page_operator_evidence_acceptance',
  );
  assert.equal(runtimePage.operator_evidence_acceptance_path.accepts_refs_only_json, true);
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.summary_drilldown_command,
    'opl runtime app-operator-drilldown --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.full_drilldown_command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_dry_run_command,
    'opl runtime action execute --action <action_id> --dry-run --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_execute_command,
    'opl runtime action execute --action <action_id> --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_route_source,
    'runtime_tray_snapshot.app_operator_drilldown.safe_action_routes',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_execution_policy,
    'operator_selected_safe_action_route_only',
  );
  for (const expected of [
    'operator evidence acceptance state',
    'route graph and decision map refs',
    'review and repair queue',
    'artifact gallery and package/export lifecycle refs',
    'memory refs and writeback receipt refs',
    'quality/readiness refs',
    'provider SLO and repair refs',
    'owner-aware action routing',
    'safe action dry-run and execute result refs',
  ]) {
    assert.ok(runtimePage.must_show.includes(expected), expected);
  }
  for (const forbiddenOwner of [
    'runtime truth',
    'provider implementation',
    'domain truth',
    'memory body',
    'artifact body',
    'quality/readiness/export verdict',
    'action route authority',
  ]) {
    assert.ok(runtimePage.must_not_own.includes(forbiddenOwner), forbiddenOwner);
  }
});

test('release evidence bundle records Runtime page acceptance artifacts without App authority', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const firstRunMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const runtimePage = pageStateMatrix.pages.find((page) => page.id === 'runtime');
  const fullFirstRun = firstRunMatrix.scenarios.find((scenario) => scenario.id === 'full_first_install_clean_machine');
  const bundle = releaseContract.operator_evidence_bundle;
  const artifactById = new Map(bundle.required_artifacts.map((artifact) => [artifact.id, artifact]));

  assert.equal(bundle.purpose, 'runtime_page_operator_evidence_acceptance');
  assert.equal(bundle.acceptance_path, 'Runtime page');
  assert.equal(bundle.runtime_page_contract, 'contracts/app-page-state-matrix.json#runtime');
  assert.equal(bundle.refs_only, true);
  assert.equal(bundle.bundle_root_pattern, 'release-evidence/<version>/');
  assert.equal(
    artifactById.get('runtime_snapshot').producer,
    'opl runtime snapshot --json',
  );
  assert.equal(
    artifactById.get('drilldown_summary').producer,
    runtimePage.operator_evidence_acceptance_path.summary_drilldown_command,
  );
  assert.equal(
    artifactById.get('drilldown_full').producer,
    runtimePage.operator_evidence_acceptance_path.full_drilldown_command,
  );
  assert.equal(
    artifactById.get('action_dry_run_result').producer,
    runtimePage.operator_evidence_acceptance_path.action_dry_run_command,
  );
  assert.equal(
    artifactById.get('action_execute_result').producer,
    runtimePage.operator_evidence_acceptance_path.action_execute_command,
  );
  assert.deepEqual(
    [...artifactById.values()].map((artifact) => artifact.path),
    [
      'runtime-snapshot.json',
      'drilldown-summary.json',
      'drilldown-full.json',
      'action-dry-run-result.json',
      'action-execute-result.json',
      'screenshots/runtime.png',
      'screenshots/full.png',
      'screenshots/action.png',
      'first-run.log',
      'settings-smoke.json',
      'remote-release-verification.json',
    ],
  );
  assert.deepEqual(fullFirstRun.release_evidence_artifacts, [
    'first-run.log',
    'settings-smoke.json',
  ]);
  for (const forbiddenAuthority of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    assert.ok(bundle.forbidden_authority.includes(forbiddenAuthority), forbiddenAuthority);
  }
  assert.match(bundle.acceptance_rule, /does not reinterpret the bundle as runtime truth/);
});

test('release evidence bundle validator accepts the declared Runtime page artifact set', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-'));
  const jsonFiles = [
    'runtime-snapshot.json',
    'drilldown-summary.json',
    'drilldown-full.json',
    'action-dry-run-result.json',
    'action-execute-result.json',
    'settings-smoke.json',
    'remote-release-verification.json',
  ];
  for (const name of jsonFiles) {
    writeFile(path.join(tempRoot, name), '{"status":"passed"}\n');
  }
  writeFile(path.join(tempRoot, 'screenshots', 'runtime.png'), 'runtime-screenshot');
  writeFile(path.join(tempRoot, 'screenshots', 'full.png'), 'full-screenshot');
  writeFile(path.join(tempRoot, 'screenshots', 'action.png'), 'action-screenshot');
  writeFile(path.join(tempRoot, 'first-run.log'), 'first run passed\n');

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'passed');
  assert.equal(payload.bundle_dir, tempRoot);
  assert.equal(
    payload.evidence_boundary,
    'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
  );
  assert.equal(payload.verified_artifact_count, 11);
  assert.deepEqual(
    payload.verified_artifacts.map((artifact) => artifact.id),
    [
      'runtime_snapshot',
      'drilldown_summary',
      'drilldown_full',
      'action_dry_run_result',
      'action_execute_result',
      'runtime_screenshot',
      'full_screenshot',
      'action_screenshot',
      'first_run_log',
      'settings_smoke',
      'remote_release_verification',
    ],
  );
});

test('App-owned automation entrypoints are TypeScript, not JavaScript wrappers', () => {
  const appOwnedEntrypoints = [
    ...walkFiles(path.join(appRoot, 'scripts')),
    ...walkFiles(path.join(appRoot, 'tests')),
  ];
  const javascriptEntrypoints = appOwnedEntrypoints
    .map((filePath) => path.relative(appRoot, filePath))
    .filter((relativePath) => /\.(mjs|cjs|js)$/.test(relativePath));

  assert.deepEqual(javascriptEntrypoints, []);
});

test('tracked App repo implementation files do not reintroduce JavaScript', () => {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: appRoot,
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);

  const javascriptFiles = result.stdout
    .split('\0')
    .filter(Boolean)
    .filter((relativePath) => /\.(mjs|cjs|js|jsx)$/.test(relativePath));

  assert.deepEqual(javascriptFiles, []);
});

test('publish dry run defaults to the App GitHub Release repo', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const version = '26.5.15-test';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;

  writeFile(path.join(outDir, dmgName));
  writeFile(path.join(outDir, `One-Person-Lab-${version}-mac-arm64.zip`));
  writeReleaseMetadata(outDir, version, dmgName);

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ]);

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(payload.tag, `v${version}`);
  assert.ok(payload.artifacts.some((artifact) => artifact.endsWith(dmgName)));
});

test('publish dry run accepts prebuilt standard release assets from GitHub Actions', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-prebuilt-release-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.15-test';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    `version: ${version}`,
    'files:',
    `  - url: ${dmgName}`,
    '    sha512: test',
    '    size: 1',
    `path: ${dmgName}`,
    'sha512: test',
    '',
  ].join('\n');

  writeFile(path.join(releaseAssetsDir, dmgName));
  writeFile(path.join(releaseAssetsDir, zipName));
  writeFile(path.join(releaseAssetsDir, `${dmgName}.blockmap`));
  writeFile(path.join(releaseAssetsDir, `${zipName}.blockmap`));
  writeFile(path.join(releaseAssetsDir, 'latest-mac.yml'), metadata);
  writeFile(path.join(releaseAssetsDir, 'latest-arm64-mac.yml'), metadata);

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--standard-artifacts-dir',
    releaseAssetsDir,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '0',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.standard_artifacts_dir, releaseAssetsDir);
  assert.ok(payload.standard_artifacts.some((artifact) => artifact.endsWith(dmgName)));
  assert.ok(payload.standard_artifacts.some((artifact) => artifact.endsWith('latest-arm64-mac.yml')));
  assert.ok(payload.upload_command.includes('--clobber'));
});

test('prebuilt standard release assets must include updater metadata', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-prebuilt-release-missing-metadata-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.15-test';

  writeFile(path.join(releaseAssetsDir, `One-Person-Lab-${version}-mac-arm64.dmg`));
  writeFile(path.join(releaseAssetsDir, `One-Person-Lab-${version}-mac-arm64.zip`));

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--standard-artifacts-dir',
    releaseAssetsDir,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '0',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /latest-mac\.yml/);
});

test('remote release verifier validates standard and Full assets from GitHub release view', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-'));
  const version = '26.5.19-remote';
  const names = [
    ...writeStandardRemoteAssets(tempRoot, version),
    ...writeFullRemoteAssets(tempRoot, version),
  ];
  const summaryPath = path.join(tempRoot, 'remote-release-verification.json');
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--summary-path',
    summaryPath,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(summary.tag, `v${version}`);
  assert.equal(summary.include_full_package, true);
  assert.equal(summary.download_dir, tempRoot);
  assert.equal(summary.verified_asset_count, names.length);
  assert.deepEqual(summary.verified_assets.map((asset) => asset.name), names);
  assert.equal(summary.full_first_install_budget.status, 'passed');
  assert.equal(summary.full_first_install_budget.platform_scope, 'macos-arm64');
  assert.equal(summary.full_first_install_budget.max_full_dmg_bytes, 450000000);
  assert.equal(summary.full_first_install_budget.full_dmg_size_bytes, Buffer.byteLength('full-dmg'));
  assert.equal(summary.full_first_install_budget.runtime_uncompressed_bytes, 128);
});

test('remote release verifier rejects standard updater metadata that references Full assets', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-full-leak-'));
  const version = '26.5.19-remote-leak';
  const names = writeStandardRemoteAssets(tempRoot, version, { fullLeak: true });
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /latest-mac\.yml references Full first-install assets/);
});

test('remote release verifier fails closed when Full size budget is exceeded', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-budget-'));
  const version = '26.5.19-budget';
  const names = [
    ...writeStandardRemoteAssets(tempRoot, version),
    ...writeFullRemoteAssets(tempRoot, version, {
      dmgContent: 'oversized-full-dmg',
      manifest: {
        size_budget: {
          platform_scope: 'macos-arm64',
          max_full_dmg_bytes: 4,
          max_runtime_uncompressed_bytes: 800000000,
        },
      },
    }),
  ];
  const releaseView = buildRemoteReleaseView(tempRoot, names, `v${version}`);

  const result = runNode([
    'scripts/verify-remote-release-assets.ts',
    '--version',
    version,
    '--repo',
    'gaofeng21cn/one-person-lab-app',
    '--include-full-package',
    '--download-dir',
    tempRoot,
    '--no-download',
  ], {
    env: {
      OPL_REMOTE_RELEASE_VIEW_JSON: JSON.stringify(releaseView),
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Full DMG size budget exceeded/);
});

test('release plan exposes parallel lanes and the serialized no-CLT VM gate', () => {
  const result = runNode([
    'scripts/plan-release-candidate.ts',
    '--version',
    '26.5.19',
    '--include-full-package',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.version, '26.5.19');
  assert.equal(payload.strategy.same_tag_replacement, 'avoid_for_new_versions');
  assert.equal(payload.strategy.resume_uploads, 'skip_existing_assets_when_size_and_sha256_digest_match');
  assert.equal(payload.strategy.full_runtime_cache, 'content_addressed_layer_cache');
  assert.ok(payload.lanes.some((lane) => lane.id === 'standard_build' && lane.can_run_with.includes('full_build')));
  assert.ok(payload.lanes.some((lane) => lane.id === 'full_build' && lane.command.includes('OPL_FULL_RUNTIME_CACHE_MODE=readwrite')));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'no_clt_vm_settings_smoke'
    && lane.phase === 'release_gate'
    && lane.command.includes('--display 1920x1080px')
    && lane.command.includes('--settings-smoke')
  )));
});

test('publish dry run skips existing release assets when a resumed upload already has matching files', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-resume-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const version = '26.5.19-resume';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;

  const dmgContent = 'dmg';
  const zipContent = 'zip';
  writeFile(path.join(outDir, dmgName), dmgContent);
  writeFile(path.join(outDir, zipName), zipContent);
  writeReleaseMetadata(outDir, version, dmgName);

  const existingAssets = [
    { name: dmgName, size: Buffer.byteLength(dmgContent), digest: `sha256:${sha256(dmgContent)}` },
    { name: zipName, size: Buffer.byteLength(zipContent), digest: `sha256:${sha256(zipContent)}` },
    {
      name: 'latest-mac.yml',
      size: fs.statSync(path.join(outDir, 'latest-mac.yml')).size,
      digest: `sha256:${sha256(fs.readFileSync(path.join(outDir, 'latest-mac.yml')))}`,
    },
  ];
  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_EXISTING_ASSETS_JSON: JSON.stringify(existingAssets),
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_exists, true);
  assert.ok(payload.skipped_existing_artifacts.some((artifact) => artifact.name === dmgName));
  assert.ok(payload.skipped_existing_artifacts.some((artifact) => artifact.name === zipName));
  assert.ok(payload.upload_command.every((part) => !String(part).endsWith('.dmg')));
  assert.equal(payload.force_upload, false);
});

test('publish dry run reuploads same-size existing release assets when sha256 digest is missing or different', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-resume-strict-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const version = '26.5.19-resume-strict';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;

  writeFile(path.join(outDir, dmgName), 'dmg');
  writeFile(path.join(outDir, zipName), 'zip');
  writeReleaseMetadata(outDir, version, dmgName);

  const existingAssets = [
    { name: dmgName, size: 3 },
    { name: zipName, size: 3, digest: `sha256:${sha256('old')}` },
  ];
  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_EXISTING_ASSETS_JSON: JSON.stringify(existingAssets),
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.upload_command.some((part) => String(part).endsWith('.dmg')));
  assert.ok(payload.upload_command.some((part) => String(part).endsWith('.zip')));
  assert.deepEqual(payload.skipped_existing_artifacts, []);
});

test('publish dry run generates professional v26.5.18 notes for standard and Full lanes', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-notes-'));
  const fullPackageDir = path.join(tempRoot, 'full');
  const version = '26.5.18';
  const manifest = {
    generated_at: '2026-05-18T12:00:00.000Z',
    distribution: {
      updater_metadata_allowed: false,
    },
    components: {
      mas: { git_commit: '1111111111111111111111111111111111111111' },
      mag: { git_commit: '2222222222222222222222222222222222222222' },
      rca: { git_commit: '3333333333333333333333333333333333333333' },
      meta_agent: { git_commit: '4444444444444444444444444444444444444444' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
    },
  };

  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');

  const result = runNode([
    'scripts/publish-release.ts',
    '--dry-run',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullPackageDir,
  ]);

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  const notes = payload.release_notes;
  const profile = readProductProfile();
  const codexProfileLabel = `${profile.codex.default_model} / ${profile.codex.default_reasoning_effort}`;
  assert.match(notes, /Release focus/);
  assert.match(notes, /Settings page:/);
  assert.match(notes, /First-run resilience:/);
  assert.ok(notes.includes(`Codex defaults: applies the ${codexProfileLabel} profile`));
  assert.match(notes, /VM validation: clean no-CLT macOS arm64 first-install smoke passed at 1920x1080/);
  assert.match(notes, /Full runtime readiness/);
  assert.match(notes, /Update channel guidance/);
  assert.match(notes, /Standard DMG\/ZIP assets and latest\*\.yml metadata remain the only source for the auto-updater/);
  assert.match(notes, /Full first-install assets are GitHub Release downloads/);
  assert.match(notes, /Full first-install package/);
  assert.match(notes, /OPL Meta Agent/);
  assert.match(notes, /OPL Meta Agent: .*main @ 4444444/);
  assert.match(notes, /MinerU document extraction/);
  assert.match(notes, /MinerU OpenAPI CLI: mineru-open-api version v0\.1\.3/);
  assert.match(notes, /After installation, users still configure their Codex\/OpenAI API key/);
  assert.match(notes, /Command Line Tools installation is requested through deferred maintenance/);
  assert.doesNotMatch(notes, /[\u3400-\u9fff]/);
});

test('publish rejects Full notes when OPL Meta Agent release-note metadata is missing', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-notes-meta-agent-'));
  const fullPackageDir = path.join(tempRoot, 'full');
  const version = '26.5.19-meta-missing';
  const manifest = {
    generated_at: '2026-05-19T12:00:00.000Z',
    distribution: {
      updater_metadata_allowed: false,
    },
    components: {
      mas: { git_commit: '1111111111111111111111111111111111111111' },
      mag: { git_commit: '2222222222222222222222222222222222222222' },
      rca: { git_commit: '3333333333333333333333333333333333333333' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
    },
  };

  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');

  const result = runNode([
    'scripts/publish-release.ts',
    '--dry-run',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullPackageDir,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /components\.meta_agent\.git_commit/);
});

test('existing same-tag standard plus Full publish replaces the full release notes body', () => {
  const source = fs.readFileSync(path.join(appRoot, 'scripts', 'publish-release.ts'), 'utf8');

  assert.match(source, /else if \(options\.includeFullPackage && options\.fullPackageOnly\)/);
  assert.match(source, /ensureFullPackageReleaseNotes\(options\.releaseRepo, tag, options\.version, fullPackageManifest\)/);
  assert.match(
    source,
    /else if \(options\.includeFullPackage\) {\s*replaceReleaseNotes\(options\.releaseRepo, tag, releaseNotes\);/
  );
});

test('tag-triggered release workflow stamps package metadata from tag version', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const tagVersionResolver = [
    'if [ -z "$version" ] && [[ "$GITHUB_REF" == refs/tags/v* ]]; then',
    'version="${REF_NAME#v}"',
    'echo "OPL_RELEASE_VERSION=$version" >> "$GITHUB_ENV"',
  ];

  for (const expectedLine of tagVersionResolver) {
    assert.match(workflow, new RegExp(expectedLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('release code-quality uses App active-shell test runner', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');

  assert.match(workflow, /node --experimental-strip-types scripts\/run-active-shell-tests\.ts/);
  assert.doesNotMatch(workflow, /run:\s*bunx vitest run/);
});

test('release build uses App wrappers for cross-shell active-shell commands', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));

  assert.match(workflow, /command:\s*bun install --cwd shells\/aionui --frozen-lockfile/);
  assert.doesNotMatch(workflow, /command:\s*cd shells\/aionui && bun install --frozen-lockfile/);
  assert.match(
    workflow,
    /name: Prepare standard App payload[\s\S]*working-directory: \$\{\{ github\.workspace \}\}[\s\S]*run: node --experimental-strip-types scripts\/prepare-standard-release-payload\.ts/,
  );
  assert.match(
    workflow,
    /name: Verify packaged bundled bun assets[\s\S]*working-directory: \$\{\{ github\.workspace \}\}[\s\S]*run: bun run validate:opl-package/,
  );
  assert.equal(packageJson.scripts['test:packaged:bun'], 'bun run --cwd shells/aionui validate:opl-package');
});

test('release artifact upload preserves electron-updater blockmaps', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');

  assert.match(workflow, /find out\/ -type f[\s\S]*-name "\*\.blockmap"/);
  assert.match(workflow, /shells\/aionui\/out\/\*\.blockmap/);
});

test('stable release workflow publishes only macOS arm64 standard assets', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'build-and-release.yml'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(workflow, /"platform":"macos-arm64"/);
  assert.match(workflow, /"artifact-name":"macos-build-arm64"/);
  assert.doesNotMatch(workflow, /"platform":"windows-/);
  assert.doesNotMatch(workflow, /"platform":"linux-/);
  assert.doesNotMatch(workflow, /"platform":"macos-universal"/);
  assert.equal(packageJson.scripts['build-mac:arm64'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && bun run --cwd shells/aionui build-mac:arm64');
  assert.equal(packageJson.scripts['build-mac'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && bun run --cwd shells/aionui build-mac');
  assert.equal(packageJson.scripts['build-mac:x64'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && bun run --cwd shells/aionui build-mac:x64');
  assert.equal(packageJson.scripts['build-win'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && bun run --cwd shells/aionui build-win');
  assert.equal(packageJson.scripts['build-deb'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && bun run --cwd shells/aionui build-deb');
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
  assert.match(workflow, /release-assets\/\*\*\/\*\.dmg/);
  assert.match(workflow, /release-assets\/\*\*\/\*\.zip/);
  assert.match(workflow, /release-assets\/\*\*\/\*\.blockmap/);
  assert.match(workflow, /release-assets\/\*\*\/\*\.yml/);
  assert.doesNotMatch(workflow, /release-assets\/\*\*\/\*\.exe/);
  assert.doesNotMatch(workflow, /release-assets\/\*\*\/\*\.msi/);
  assert.doesNotMatch(workflow, /release-assets\/\*\*\/\*\.deb/);
});

test('manual desktop release workflow supports new releases and same-tag refreshes in GitHub Actions', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const fullWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');
  const fullPackageScript = fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package.ts'), 'utf8');
  const vmWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'opl-first-run-vm.yml'), 'utf8');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(workflow, /name: OPL Desktop Release/);
  assert.match(workflow, /release_mode:[\s\S]*refresh_existing[\s\S]*new_release[\s\S]*draft_candidate/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml/);
  assert.match(workflow, /node --experimental-strip-types scripts\/prepare-release-assets\.ts build-artifacts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /git tag "\$tag" "\$GITHUB_SHA"/);
  assert.match(workflow, /--standard-artifacts-dir release-assets/);
  assert.match(workflow, /publish_args\+=\(--draft\)/);
  assert.match(workflow, /remote-verify-standard:/);
  assert.match(workflow, /remote-verify-full:/);
  assert.match(workflow, /npm run verify-remote-release/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml/);
  assert.match(workflow, /publish_to_release: true/);
  assert.match(workflow, /run_vm_smoke:/);
  assert.match(workflow, /needs: remote-verify-full/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/opl-first-run-vm\.yml/);
  assert.match(workflow, /release_tag: v\$\{\{ inputs\.opl_version \}\}/);
  assert.match(fullWorkflow, /workflow_call:/);
  assert.match(fullWorkflow, /name: Checkout OPL Meta Agent/);
  assert.match(fullWorkflow, /repository: gaofeng21cn\/opl-meta-agent/);
  assert.match(fullWorkflow, /path: opl-meta-agent/);
  assert.match(fullWorkflow, /name: Checkout MinerU Ecosystem/);
  assert.match(fullWorkflow, /repository: opendatalab\/MinerU-Ecosystem/);
  assert.match(fullWorkflow, /path: MinerU-Ecosystem/);
  assert.match(fullWorkflow, /uses: actions\/setup-go@v5/);
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
  assert.equal(
    releaseContract.standard_updater.same_tag_refresh.mode,
    'github_actions_prebuilt_assets_upload_clobber',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.desktop_release_workflow,
    '.github/workflows/desktop-release.yml',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.first_run_vm_workflow,
    '.github/workflows/opl-first-run-vm.yml',
  );
  assert.equal(
    releaseContract.release_acceleration.github_actions.draft_candidate_mode,
    'draft_candidate',
  );
  assert.equal(
    releaseContract.release_acceleration.post_publish_remote_verification.script,
    'npm run verify-remote-release -- --version <version>',
  );
  assert.deepEqual(
    releaseContract.release_acceleration.post_publish_remote_verification.checks,
    [
      'remote_asset_size',
      'remote_asset_sha256_digest',
      'standard_updater_metadata',
      'full_sha256sums',
      'full_manifest_distribution_boundary',
      'full_manifest_size_budget',
      'full_release_asset_size_budget',
      'full_runtime_uncompressed_size_budget',
      'full_readme_english_only',
    ],
  );
});

test('release automation workflows cover remote verification, Full cache warmup, and draft promotion', () => {
  const verifyWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'release-verify-remote.yml'), 'utf8');
  const warmupWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-runtime-cache-warmup.yml'), 'utf8');
  const promoteWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-promote.yml'), 'utf8');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(verifyWorkflow, /name: OPL Remote Release Verification/);
  assert.match(verifyWorkflow, /npm run verify-remote-release/);
  assert.match(verifyWorkflow, /--summary-path remote-release-verification\.json/);
  assert.match(verifyWorkflow, /verify_args\+=\(--include-full-package\)/);
  assert.match(verifyWorkflow, /actions\/upload-artifact@v4/);

  assert.match(warmupWorkflow, /name: OPL Full Runtime Cache Warmup/);
  assert.match(warmupWorkflow, /schedule:/);
  assert.match(warmupWorkflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml/);
  assert.match(warmupWorkflow, /publish_to_release: false/);
  assert.match(warmupWorkflow, /force_rebuild_runtime_cache:/);

  assert.match(promoteWorkflow, /name: OPL Desktop Release Promote/);
  assert.match(promoteWorkflow, /npm run verify-remote-release/);
  assert.match(promoteWorkflow, /gh release edit "v\$\{OPL_RELEASE_VERSION\}"/);
  assert.match(promoteWorkflow, /--draft=false/);
  assert.match(promoteWorkflow, /--latest/);

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

test('Full first-install workflow has one MinerU checkout and keeps standalone binary build path', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');

  assert.equal(matchCount(workflow, /name: Checkout MinerU Ecosystem/g), 1);
  assert.equal(matchCount(workflow, /repository: opendatalab\/MinerU-Ecosystem/g), 1);
  assert.equal(matchCount(workflow, /path: MinerU-Ecosystem/g), 1);
  assert.match(workflow, /mineru_root="\$GITHUB_WORKSPACE\/MinerU-Ecosystem\/cli\/mineru-open-api"/);
  assert.match(workflow, /cd "\$mineru_root"[\s\S]*go install -ldflags/);
  assert.match(workflow, /github\.com\/opendatalab\/MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.version=\$mineru_version/);
  assert.match(workflow, /github\.com\/opendatalab\/MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.commit=\$mineru_commit/);
  assert.match(workflow, /github\.com\/opendatalab\/MinerU-Ecosystem\/cli\/mineru-open-api\/cmd\.date=\$mineru_built_at/);
});

test('Full release docs publish size policy and remote verifier budget boundaries', () => {
  const releaseDocs = fs.readFileSync(path.join(appRoot, 'docs', 'release', 'README.md'), 'utf8');
  const scriptsDocs = fs.readFileSync(path.join(appRoot, 'scripts', 'README.md'), 'utf8');
  const combinedDocs = `${releaseDocs}\n${scriptsDocs}`;

  for (const expected of [
    'Full size policy',
    'compressed DMG size',
    'uncompressed runtime size',
    'layer breakdown',
    'remote verifier size budget',
  ]) {
    assert.match(combinedDocs, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }

  assert.match(releaseDocs, /Full size policy/i);
  assert.match(releaseDocs, /compressed DMG size/i);
  assert.match(releaseDocs, /uncompressed runtime size/i);
  assert.match(releaseDocs, /layer breakdown/i);
  assert.match(releaseDocs, /remote verifier size budget/i);
  assert.match(scriptsDocs, /verify-remote-release-assets\.ts[\s\S]*remote verifier size budget/i);
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

test('release creation job runs TypeScript asset scripts under Node 22', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'build-and-release.yml'), 'utf8');

  assert.match(
    workflow,
    /name: Create Release[\s\S]*name: Checkout active shell[\s\S]*repository: gaofeng21cn\/opl-aion-shell[\s\S]*path: shells\/aionui[\s\S]*name: Setup Node\.js[\s\S]*uses: actions\/setup-node@v4[\s\S]*node-version: '22'[\s\S]*node --experimental-strip-types scripts\/prepare-release-assets\.ts/,
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

  const validator = require('../../shells/aionui/scripts/validate-packaged-runtime.js');
  const optional = validator.validateFullRuntimeResources(resourcesRoot, { require: false });
  const required = validator.validateFullRuntimeResources(resourcesRoot, { require: true });

  assert.equal(optional.checked, false);
  assert.deepEqual(optional.issues, []);
  assert.equal(required.checked, false);
  assert.match(required.issues.join('\n'), /missing opl-full-runtime extraResource/);
});

test('Full first-install manifest declares App-owned distribution and Framework payload role', async () => {
  const mod = await import('../../scripts/full-first-install-package.ts');
  const manifest = mod.buildFullPackageManifest({ version: '26.5.15' });

  assert.equal(manifest.manifest_version, 2);
  assert.deepEqual(manifest.size_budget, {
    platform_scope: 'macos-arm64',
    max_full_dmg_bytes: 450000000,
    max_runtime_uncompressed_bytes: 800000000,
  });
  assert.deepEqual(manifest.measurement_policy, {
    full_dmg_bytes: 'github_release_asset_size_bytes',
    runtime_uncompressed_bytes: 'manifest_size_breakdown_total_runtime_uncompressed_bytes',
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
  const mod = await import('../../scripts/full-first-install-package.ts');
  const manifest = mod.buildFullPackageManifest({ version: '26.5.15' });
  const profile = readProductProfile();
  const codexProfilePhrase = `${profile.codex.default_model} with ${profile.codex.default_reasoning_effort} reasoning`;

  assert.equal(
    releaseContract.full_first_install.payload_boundary.role,
    'declared_payload_assembly_and_validation',
  );
  assert.equal(releaseContract.full_first_install.generated_companion_text_language, 'en');
  assert.equal(releaseContract.full_first_install.same_tag_refresh.mode, 'github_release_upload_clobber');
  assert.deepEqual(
    manifest.distribution.payload_boundary.app_repo_does_not_own,
    releaseContract.full_first_install.payload_boundary.forbidden_authority,
  );
  assert.equal(manifest.distribution.product_profile_contract, 'contracts/app-product-profile.json');
  assert.deepEqual(
    manifest.distribution.product_profile.recommended_codex_skills,
    profile.companion_payloads.recommended_codex_skills,
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
  assert.equal(manifest.components.skills.role, 'recommended_codex_skills_including_officecli_mineru_ui_ux');
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
  const buildScript = fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package.ts'), 'utf8');
  const publishScript = fs.readFileSync(path.join(appRoot, 'scripts', 'publish-release.ts'), 'utf8');
  const prepareStandardScript = fs.readFileSync(path.join(appRoot, 'scripts', 'prepare-standard-release-payload.ts'), 'utf8');
  const mod = await import('../../scripts/full-first-install-package.ts');
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
  assert.equal(releaseContract.release_acceleration.full_runtime_cache.enabled_by_default, true);
  assert.deepEqual(releaseContract.release_acceleration.full_runtime_cache.layer_ids, mod.FULL_RUNTIME_CACHE_LAYER_IDS);
  assert.deepEqual(releaseContract.release_acceleration.publish_resume.match_fields, ['asset_name', 'size', 'sha256']);
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
  assert.match(cacheHit.archive_path, /opl-runtime/);
  assert.match(buildScript, /Library', 'Caches', 'One Person Lab', 'full-runtime-layers'/);
  assert.match(buildScript, /runtimeCacheMode: process\.env\.OPL_FULL_RUNTIME_CACHE_MODE \|\| 'readwrite'/);
  assert.match(buildScript, /copyFirstSkillSource\('opl-meta-agent'/);
  assert.match(buildScript, /copyFirstSkillSource\('mineru-document-extractor'/);
  assert.match(buildScript, /copySingleFile\(sources\.mineruOpenApiBin, path\.join\(layerRoot, 'bin', 'mineru-open-api'\)\)/);
  assert.match(buildScript, /version: commandOutput\(sources\.mineruOpenApiBin, \['version'\]\)/);
  assert.match(buildScript, /plugins', 'opl-meta-agent', 'skills', 'opl-meta-agent'/);
  assert.match(buildScript, /meta_agent_repo_skill_fingerprint/);
  assert.match(buildScript, /mineru_document_extractor_fingerprint/);
  assert.match(buildScript, /syncAppProductProfileToShell\(options\.guiRoot\)/);
  assert.match(prepareStandardScript, /syncAppProductProfileToShell\(shellRoot, \{ optional: true \}\)/);
  assert.match(
    buildScript,
    /if \(cacheEvent\.read_archive\) {\s*extractLayer\(archivePath, targetRoot\);\s*return cacheEvent;\s*}\s*const tempLayerRoot/,
  );
  assert.match(publishScript, /skipped_existing_artifacts/);
  assert.match(publishScript, /--force-upload/);
});

test('Full runtime pruning keeps macOS arm64 launch payloads without development environments', async () => {
  const mod = await import('../../scripts/full-first-install-package.ts');
  const buildScript = fs.readFileSync(path.join(appRoot, 'scripts', 'build-full-first-install-package.ts'), 'utf8');

  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/.venv/lib/python3.12/site-packages/numpy/core.so'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mag/.venv/pyvenv.cfg'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/src/med_autoscience/__init__.py'), false);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/contracts/runtime-program/schema.json'), false);
  assert.match(buildScript, /MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET = 'aarch64-apple-darwin'/);
  assert.match(buildScript, /pruneTemporalCoreBridgeReleases\(path\.join\(targetRoot, 'node_modules'\)\)/);
  assert.match(buildScript, /assertTemporalCoreBridgeMacosArm64Only\(path\.join\(runtimeRoot, 'opl', 'node_modules'\)\)/);
  assert.match(buildScript, /codex: \{ source_path: sources\.codexRoot[\s\S]*size_bytes: directorySizeBytes\(path\.join\(runtimeRoot, 'bin', 'codex'\)\)/);
});
