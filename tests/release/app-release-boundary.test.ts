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
const externalShellRoot = process.env.OPL_APP_SHELL_ROOT?.trim()
  ? path.resolve(appRoot, process.env.OPL_APP_SHELL_ROOT)
  : null;
const activeShellRoot = externalShellRoot ?? path.join(appRoot, 'shells', 'aionui');

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

function writeBinaryFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeTinyPng(filePath) {
  writeBinaryFile(
    filePath,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lC0V9wAAAABJRU5ErkJggg==',
      'base64',
    ),
  );
}

function writeRuntimeEvidenceJsonFiles(tempRoot) {
  writeFile(
    path.join(tempRoot, 'runtime-snapshot.json'),
    '{"runtime_tray_snapshot":{"schema_version":"runtime_tray_snapshot.v1","runtime_health":{"status":"running"}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'drilldown-summary.json'),
    '{"app_operator_drilldown":{"surface_kind":"opl_app_operator_drilldown_read_model","detail_level":"summary","summary":{"stage_attempt_count":1}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'drilldown-full.json'),
    '{"app_operator_drilldown":{"surface_kind":"opl_app_operator_drilldown_read_model","detail_level":"full","summary":{"stage_attempt_count":1}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'action-dry-run-result.json'),
    '{"runtime_operator_action_execution":{"surface_kind":"opl_runtime_operator_action_execution","action_id":"stage-production-attempt:medautoscience:analysis-campaign","dry_run":true,"execution":{"execution_status":"dry_run"},"authority_boundary":{"can_write_domain_truth":false}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'action-execute-result.json'),
    '{"runtime_operator_action_execution":{"surface_kind":"opl_runtime_operator_action_execution","action_id":"stage-production-attempt:medautoscience:analysis-campaign","dry_run":false,"execution":{"execution_status":"executed"},"authority_boundary":{"can_write_domain_truth":false}}}\n',
  );
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
      max_full_dmg_bytes: 550000000,
      max_runtime_uncompressed_bytes: 800000000,
    },
    measurement_policy: {
      full_dmg_bytes: 'github_release_asset_size_bytes',
      runtime_uncompressed_bytes: 'manifest_size_breakdown_total_runtime_uncompressed_bytes',
    },
    runtime_assertions: {
      temporal_core_bridge_releases: ['aarch64-apple-darwin'],
      excluded_module_venv_count: 0,
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
  assert.deepEqual(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.missing_host_tools_allowed,
    ['command_line_tools', 'homebrew', 'node', 'git'],
  );
  assert.equal(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.initial_runtime_source,
    'bundled_runtime',
  );
  assert.equal(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.core_ready_without_host_tools,
    true,
  );
  assert.deepEqual(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.must_not_block_core_ready,
    [
      'repo_sync',
      'module_reconcile',
      'command_line_tools_install',
      'companion_skills_install',
      'ecosystem_module_updates',
    ],
  );
  assert.deepEqual(
    profile.first_run.core_ready_policy.full_first_install_clean_machine.post_core_ready_background_policy,
    {
      mode: 'best_effort_non_blocking',
      continues_after_core_ready: true,
      managed_items: [
        'repo_sync',
        'module_reconcile',
        'command_line_tools_install',
        'companion_skills_install',
        'ecosystem_module_updates',
      ],
      user_confirmation_items: ['command_line_tools_install'],
    },
  );
  assert.equal(profile.first_run.background_maintenance.blocks_core_ready, false);
  assert.equal(profile.first_run.background_maintenance.mode, 'best_effort_after_core_ready');
  assert.equal(profile.first_run.background_maintenance.continues_after_core_ready, true);
  assert.deepEqual(
    profile.first_run.background_maintenance.items,
    [
      'repo_sync',
      'module_reconcile',
      'command_line_tools_install',
      'companion_skills_install',
      'ecosystem_module_updates',
    ],
  );
  assert.equal(profile.first_run.core_ready_policy.standard_package.bootstrap_owner, 'app_managed');
  assert.equal(profile.first_run.core_ready_policy.standard_package.maintenance_owner, 'app_managed');
  assert.equal(
    profile.first_run.core_ready_policy.standard_package.user_first_screen_terminal_instruction_allowed,
    false,
  );
  assert.equal(
    profile.first_run.core_ready_policy.standard_package.manual_host_tool_install_terminal_state_allowed,
    false,
  );
  assert.equal(
    profile.first_run.core_ready_policy.standard_package.maintenance_resolution_policy,
    'app_or_cli_managed_best_effort_until_ready',
  );
  assert.deepEqual(
    profile.first_run.core_ready_policy.standard_package.forbidden_terminal_instruction_end_states,
    ['install_homebrew_first', 'install_node_first', 'install_git_first'],
  );
  assert.equal(profile.first_run.command_line_tools.auto_request_installer, true);
  assert.equal(profile.first_run.command_line_tools.installer_command, 'xcode-select --install');
  assert.equal(profile.first_run.command_line_tools.system_installer_only, true);
  assert.equal(profile.first_run.command_line_tools.waits_for_user_confirmation, true);
  assert.equal(profile.first_run.command_line_tools.blocks_full_first_launch, false);
  assert.match(
    profile.first_run.command_line_tools.messages.join('\n'),
    /keep using One Person Lab while that Apple installer runs/,
  );
  assert.doesNotMatch(profile.first_run.command_line_tools.messages.join('\n'), /retry setup/i);
  assert.equal(
    profile.first_run.updates.standard_channel.implementation_reference,
    'electron_autoUpdater_background_download_update_downloaded_restart_prompt',
  );
  assert.deepEqual(profile.first_run.updates.standard_channel.metadata_scope, [
    'latest-mac.yml',
    'latest-arm64-mac.yml',
  ]);
  assert.equal(profile.first_run.updates.standard_channel.download_policy, 'background_download');
  assert.equal(profile.first_run.updates.standard_channel.apply_policy, 'restart_when_ready');
  assert.equal(profile.first_run.updates.standard_channel.ready_prompt, 'prompt_restart_after_download_ready');
  assert.equal(profile.first_run.updates.standard_channel.full_first_install_metadata_allowed, false);
  assert.equal(profile.first_run.updates.standard_channel.blocks_core_ready, false);
  assert.deepEqual(profile.companion_payloads.ecosystem_modules, ['officecli', 'mineru', 'opl-meta-agent']);
  assert.equal(profile.companion_payloads.management_authority.officecli, 'app_or_cli_managed');
  assert.equal(profile.companion_payloads.management_authority.mineru, 'app_or_cli_managed');
  assert.equal(profile.companion_payloads.management_authority['opl-meta-agent'], 'app_or_cli_managed');
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

test('first-run matrix locks Full clean-machine and App-managed bootstrap rules', () => {
  const matrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const scenarioById = new Map(matrix.scenarios.map((scenario) => [scenario.id, scenario]));
  const fullClean = scenarioById.get('full_first_install_clean_machine');

  assert.deepEqual(fullClean.clean_machine_missing_tools, ['command_line_tools', 'homebrew', 'node', 'git']);
  assert.equal(fullClean.core_ready_source, 'bundled_runtime');
  assert.deepEqual(fullClean.background_maintenance, [
    'repo_sync',
    'module_reconcile',
    'command_line_tools_install',
    'companion_skills_install',
    'ecosystem_module_updates',
  ]);
  assert.deepEqual(fullClean.post_core_ready_background_policy, {
    mode: 'best_effort_non_blocking',
    continues_after_core_ready: true,
    managed_items: [
      'repo_sync',
      'module_reconcile',
      'command_line_tools_install',
      'companion_skills_install',
      'ecosystem_module_updates',
    ],
  });
  assert.ok(fullClean.expects.some((entry) => /without requiring host CLT, Homebrew, Node, or Git/.test(entry)));
  assert.ok(fullClean.expects.some((entry) => /best-effort background maintenance after Core ready/.test(entry)));

  const standardBootstrap = scenarioById.get('standard_app_managed_bootstrap');
  assert.equal(standardBootstrap.bootstrap_owner, 'app_managed');
  assert.equal(
    standardBootstrap.maintenance_resolution_policy,
    'app_or_cli_managed_best_effort_until_ready',
  );
  assert.ok(standardBootstrap.expects.some((entry) => /App-managed bootstrap/.test(entry)));
  assert.ok(standardBootstrap.expects.some((entry) => /does not end.*Homebrew, Node, or Git/i.test(entry)));
  assert.ok(standardBootstrap.expects.some((entry) => /App-managed bootstrap or maintenance remains responsible/.test(entry)));

  const clt = scenarioById.get('macos_clt_system_installer');
  assert.equal(clt.command, 'xcode-select --install');
  assert.ok(clt.expects.some((entry) => /user confirmation/.test(entry)));
  assert.ok(clt.expects.some((entry) => /Core ready is not blocked/.test(entry)));

  const updater = scenarioById.get('updater_standard_channel');
  assert.deepEqual(updater.update_policy, {
    download: 'background',
    apply: 'restart_when_ready',
    ready_prompt: 'prompt_restart_after_download_ready',
    full_first_install_metadata_allowed: false,
  });

  const ecosystem = scenarioById.get('ecosystem_modules_app_cli_managed');
  assert.deepEqual(ecosystem.modules, ['officecli', 'mineru', 'opl-meta-agent']);
});

test('one-shot App installer defaults to App-first core setup', () => {
  const script = fs.readFileSync(path.join(appRoot, 'install.sh'), 'utf8');

  assert.match(script, /OPL_APP_INSTALL_MODE=\$\{OPL_APP_INSTALL_MODE:-app-first\}/);
  assert.match(script, /--complete/);
  assert.match(script, /--skip-modules/);
  assert.match(script, /curl -fsSL "\$OPL_INSTALL_SCRIPT_URL" \| bash -s -- "\$\{INSTALL_ARGS\[@\]\}"/);
  assert.doesNotMatch(script, /bash -s -- "\$@"/);
});

test('runtime page consumes OPL App/operator drilldown instead of App-owned runtime truth', () => {
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const runtimePage = pageStateMatrix.pages.find((page) => page.id === 'runtime');

  assert.equal(runtimePage.machine_source, 'runtime_tray_snapshot.app_operator_drilldown');
  assert.equal(runtimePage.framework_command, 'opl runtime app-operator-drilldown --json');
  assert.equal(runtimePage.framework_full_detail_command, 'opl runtime app-operator-drilldown --detail full --json');
  assert.equal(runtimePage.framework_action_command, 'opl runtime action execute --action <id> [--payload refs-only-json] [--dry-run]');
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
    'opl runtime action execute --action <action_id> --dry-run',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_execute_command,
    'opl runtime action execute --action <action_id>',
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
    'summary-first app operator read model',
    'full detail lazy load',
    'safe action dry-run',
    'safe action execute',
    'receipt/count refresh after execute',
    'authority boundary fields',
  ]) {
    assert.ok(runtimePage.operator_evidence_path.includes(expected), expected);
  }
  for (const expected of [
    'operator evidence acceptance state',
    'summary-first app operator read model',
    'full detail lazy load',
    'safe action dry-run/execute controls',
    'receipt/count refresh after execute',
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
    'domain action approval override',
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
  assert.equal(bundle.manifest_path, 'evidence-manifest.json');
  assert.deepEqual(bundle.missing_evidence_policy, {
    default_validation: 'fail_closed',
    allow_missing_evidence_flag: '--allow-missing-evidence',
    missing_status: 'missing_evidence',
    packaged_app_evidence_requires: 'all_required_artifacts_present_and_verified',
  });
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
  assert.deepEqual(
    [...artifactById.values()].map((artifact) => artifact.source_kind),
    [
      'opl_runtime_snapshot',
      'opl_app_operator_drilldown_summary',
      'opl_app_operator_drilldown_full',
      'opl_runtime_action_dry_run',
      'opl_runtime_action_execute',
      'app_runtime_page_screenshot',
      'full_first_install_release_screenshot',
      'app_runtime_action_screenshot',
      'clean_first_run_vm_smoke',
      'settings_smoke',
      'remote_release_verification',
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
  const artifacts = [
    {
      id: 'runtime_snapshot',
      path: 'runtime-snapshot.json',
      kind: 'json',
      producer: 'opl runtime snapshot --json',
      source_kind: 'opl_runtime_snapshot',
    },
    {
      id: 'drilldown_summary',
      path: 'drilldown-summary.json',
      kind: 'json',
      producer: 'opl runtime app-operator-drilldown --json',
      source_kind: 'opl_app_operator_drilldown_summary',
    },
    {
      id: 'drilldown_full',
      path: 'drilldown-full.json',
      kind: 'json',
      producer: 'opl runtime app-operator-drilldown --detail full --json',
      source_kind: 'opl_app_operator_drilldown_full',
    },
    {
      id: 'action_dry_run_result',
      path: 'action-dry-run-result.json',
      kind: 'json',
      producer: 'opl runtime action execute --action <action_id> --dry-run',
      source_kind: 'opl_runtime_action_dry_run',
    },
    {
      id: 'action_execute_result',
      path: 'action-execute-result.json',
      kind: 'json',
      producer: 'opl runtime action execute --action <action_id>',
      source_kind: 'opl_runtime_action_execute',
    },
    {
      id: 'runtime_screenshot',
      path: 'screenshots/runtime.png',
      kind: 'image',
      producer: 'Runtime page screenshot',
      source_kind: 'app_runtime_page_screenshot',
    },
    {
      id: 'full_screenshot',
      path: 'screenshots/full.png',
      kind: 'image',
      producer: 'Full first-install release screenshot',
      source_kind: 'full_first_install_release_screenshot',
    },
    {
      id: 'action_screenshot',
      path: 'screenshots/action.png',
      kind: 'image',
      producer: 'Runtime action confirmation/result screenshot',
      source_kind: 'app_runtime_action_screenshot',
    },
    {
      id: 'first_run_log',
      path: 'first-run.log',
      kind: 'log',
      producer: 'clean first-run VM smoke',
      source_kind: 'clean_first_run_vm_smoke',
    },
    {
      id: 'settings_smoke',
      path: 'settings-smoke.json',
      kind: 'json',
      producer: 'settings smoke',
      source_kind: 'settings_smoke',
    },
    {
      id: 'remote_release_verification',
      path: 'remote-release-verification.json',
      kind: 'json',
      producer: 'npm run verify-remote-release -- --version <version> --include-full-package --summary-path remote-release-verification.json',
      source_kind: 'remote_release_verification',
    },
  ];
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: artifacts.map((artifact) => ({ ...artifact, status: 'present' })),
    missing_evidence: [],
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeFile(path.join(tempRoot, 'settings-smoke.json'), '{"status":"passed","pages_checked":["settings_overview","environment","about","update"]}\n');
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeTinyPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'action.png'));
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
  assert.equal(payload.manifest_path, 'evidence-manifest.json');
  assert.equal(payload.packaged_app_evidence, true);
  assert.equal(
    payload.evidence_boundary,
    'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
  );
  assert.equal(payload.verified_artifact_count, 11);
  assert.equal(payload.missing_artifact_count, 0);
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

test('release evidence bundle validator fails closed for incomplete packaged App evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-missing-'));
  const artifacts = [
    {
      id: 'runtime_snapshot',
      path: 'runtime-snapshot.json',
      kind: 'json',
      producer: 'opl runtime snapshot --json',
      source_kind: 'opl_runtime_snapshot',
      status: 'present',
    },
    {
      id: 'drilldown_summary',
      path: 'drilldown-summary.json',
      kind: 'json',
      producer: 'opl runtime app-operator-drilldown --json',
      source_kind: 'opl_app_operator_drilldown_summary',
      status: 'present',
    },
    {
      id: 'drilldown_full',
      path: 'drilldown-full.json',
      kind: 'json',
      producer: 'opl runtime app-operator-drilldown --detail full --json',
      source_kind: 'opl_app_operator_drilldown_full',
      status: 'present',
    },
    {
      id: 'action_dry_run_result',
      path: 'action-dry-run-result.json',
      kind: 'json',
      producer: 'opl runtime action execute --action <action_id> --dry-run',
      source_kind: 'opl_runtime_action_dry_run',
      status: 'present',
    },
    {
      id: 'action_execute_result',
      path: 'action-execute-result.json',
      kind: 'json',
      producer: 'opl runtime action execute --action <action_id>',
      source_kind: 'opl_runtime_action_execute',
      status: 'present',
    },
    {
      id: 'runtime_screenshot',
      path: 'screenshots/runtime.png',
      kind: 'image',
      producer: 'Runtime page screenshot',
      source_kind: 'app_runtime_page_screenshot',
      status: 'present',
    },
    {
      id: 'full_screenshot',
      path: 'screenshots/full.png',
      kind: 'image',
      producer: 'Full first-install release screenshot',
      source_kind: 'full_first_install_release_screenshot',
      status: 'present',
    },
    {
      id: 'action_screenshot',
      path: 'screenshots/action.png',
      kind: 'image',
      producer: 'Runtime action confirmation/result screenshot',
      source_kind: 'app_runtime_action_screenshot',
      status: 'present',
    },
    {
      id: 'first_run_log',
      path: 'first-run.log',
      kind: 'log',
      producer: 'clean first-run VM smoke',
      source_kind: 'clean_first_run_vm_smoke',
      status: 'missing',
      missing_reason: 'clean VM first-run evidence was not generated in this environment',
    },
    {
      id: 'settings_smoke',
      path: 'settings-smoke.json',
      kind: 'json',
      producer: 'settings smoke',
      source_kind: 'settings_smoke',
      status: 'missing',
      missing_reason: 'settings smoke evidence was not generated in this environment',
    },
    {
      id: 'remote_release_verification',
      path: 'remote-release-verification.json',
      kind: 'json',
      producer: 'npm run verify-remote-release -- --version <version> --include-full-package --summary-path remote-release-verification.json',
      source_kind: 'remote_release_verification',
      status: 'missing',
      missing_reason: 'remote release verification was not generated in this environment',
    },
  ];
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'missing_evidence',
    packaged_app_evidence: false,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts,
    missing_evidence: artifacts
      .filter((artifact) => artifact.status === 'missing')
      .map((artifact) => ({
        id: artifact.id,
        path: artifact.path,
        reason: artifact.missing_reason,
      })),
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeTinyPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const blocked = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /cannot be used as packaged App evidence/);

  const allowed = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ]);

  assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
  const payload = JSON.parse(allowed.stdout);
  assert.equal(payload.status, 'missing_evidence');
  assert.equal(payload.packaged_app_evidence, false);
  assert.equal(payload.verified_artifact_count, 8);
  assert.equal(payload.missing_artifact_count, 3);
  assert.deepEqual(payload.missing_artifacts.map((artifact) => artifact.id), [
    'first_run_log',
    'settings_smoke',
    'remote_release_verification',
  ]);
});

test('release evidence bundle validator rejects contract-only runtime JSON placeholders', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-placeholder-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => ({
      ...artifact,
      status: 'present',
    })),
    missing_evidence: [],
  }, null, 2)}\n`);
  for (const name of [
    'runtime-snapshot.json',
    'drilldown-summary.json',
    'drilldown-full.json',
    'action-dry-run-result.json',
    'action-execute-result.json',
    'settings-smoke.json',
    'remote-release-verification.json',
  ]) {
    writeFile(path.join(tempRoot, name), '{"status":"passed","refs_only":true}\n');
  }
  writeTinyPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'action.png'));
  writeFile(path.join(tempRoot, 'first-run.log'), 'first run passed\n');

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /runtime_snapshot\.runtime_tray_snapshot/);
});

test('release evidence manifest generator records missing artifacts without claiming packaged App evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-generated-'));
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeTinyPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const generated = runNode([
    'scripts/write-release-evidence-manifest.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  const generatedPayload = JSON.parse(generated.stdout);
  assert.equal(generatedPayload.status, 'missing_evidence');
  assert.equal(generatedPayload.packaged_app_evidence, false);
  assert.equal(generatedPayload.missing_artifact_count, 3);
  assert.deepEqual(generatedPayload.missing_artifacts.map((artifact) => artifact.id), [
    'first_run_log',
    'settings_smoke',
    'remote_release_verification',
  ]);

  const manifest = JSON.parse(fs.readFileSync(path.join(tempRoot, 'evidence-manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'missing_evidence');
  assert.equal(manifest.packaged_app_evidence, false);
  assert.deepEqual(manifest.missing_evidence.map((artifact) => artifact.id), [
    'first_run_log',
    'settings_smoke',
    'remote_release_verification',
  ]);

  const validation = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ]);

  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  const validationPayload = JSON.parse(validation.stdout);
  assert.equal(validationPayload.status, 'missing_evidence');
  assert.equal(validationPayload.packaged_app_evidence, false);
});

test('release evidence collector captures live OPL runtime refs and keeps missing App evidence explicit', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-collector-'));
  const fakeBin = path.join(tempRoot, 'bin');
  const bundleDir = path.join(tempRoot, 'bundle');
  const actionLog = path.join(tempRoot, 'opl-actions.jsonl');
  const fakeOpl = path.join(fakeBin, 'opl');
  fs.mkdirSync(fakeBin, { recursive: true });
  fs.writeFileSync(fakeOpl, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(actionLog)}, JSON.stringify(args) + '\\n');
function out(value) {
  process.stdout.write(JSON.stringify(value) + '\\n');
}
if (args.join(' ') === 'runtime snapshot --json') {
  out({ runtime_tray_snapshot: { schema_version: 'runtime_tray_snapshot.v1', runtime_health: { status: 'running' } } });
  process.exit(0);
}
if (args.join(' ') === 'runtime app-operator-drilldown --json') {
  out({
    app_operator_drilldown: {
      surface_kind: 'opl_app_operator_drilldown_read_model',
      detail_level: 'summary',
      summary: { stage_attempt_count: 2 },
      attention_first_payload: {
        next_safe_action: { action_id: 'provider-scheduler:temporal:trigger' }
      }
    }
  });
  process.exit(0);
}
if (args.join(' ') === 'runtime app-operator-drilldown --detail full --json') {
  out({
    app_operator_drilldown: {
      surface_kind: 'opl_app_operator_drilldown_read_model',
      detail_level: 'full',
      summary: { stage_attempt_count: 2 }
    }
  });
  process.exit(0);
}
if (args.slice(0, 4).join(' ') === 'runtime action execute --action') {
  const actionId = args[4];
  const dryRun = args.includes('--dry-run');
  out({
    runtime_operator_action_execution: {
      surface_kind: 'opl_runtime_operator_action_execution',
      action_id: actionId,
      dry_run: dryRun,
      execution: { execution_status: dryRun ? 'dry_run' : 'executed' },
      authority_boundary: { can_write_domain_truth: false }
    }
  });
  process.exit(0);
}
console.error('unexpected opl args: ' + args.join(' '));
process.exit(2);
`, { mode: 0o755 });

  const collected = runNode([
    'scripts/collect-release-evidence.ts',
    '--bundle-dir',
    bundleDir,
    '--action-id',
    'provider-scheduler:temporal:trigger',
    '--execute-action',
    '--overwrite',
  ], {
    env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` },
  });

  assert.equal(collected.status, 0, collected.stderr || collected.stdout);
  const payload = JSON.parse(collected.stdout);
  assert.equal(payload.status, 'missing_evidence');
  assert.equal(payload.packaged_app_evidence, false);
  assert.equal(payload.action_id, 'provider-scheduler:temporal:trigger');
  assert.deepEqual(payload.collected_artifacts, [
    'runtime_snapshot',
    'drilldown_summary',
    'drilldown_full',
    'action_dry_run_result',
    'action_execute_result',
  ]);
  assert.deepEqual(payload.missing_artifacts, [
    'runtime_screenshot',
    'full_screenshot',
    'action_screenshot',
    'first_run_log',
    'settings_smoke',
    'remote_release_verification',
  ]);

  const validation = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    bundleDir,
    '--allow-missing-evidence',
  ]);
  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  const validationPayload = JSON.parse(validation.stdout);
  assert.equal(validationPayload.status, 'missing_evidence');
  assert.equal(validationPayload.verified_artifact_count, 5);
  assert.equal(validationPayload.missing_artifact_count, 6);

  const actionArgs = fs.readFileSync(actionLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(actionArgs, [
    ['runtime', 'snapshot', '--json'],
    ['runtime', 'app-operator-drilldown', '--json'],
    ['runtime', 'app-operator-drilldown', '--detail', 'full', '--json'],
    ['runtime', 'action', 'execute', '--action', 'provider-scheduler:temporal:trigger', '--dry-run'],
    ['runtime', 'action', 'execute', '--action', 'provider-scheduler:temporal:trigger'],
  ]);
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

test('release asset validation fails before tagging when updater metadata keeps the shell version', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-shell-version-metadata-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.25';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    'version: 2.1.1',
    'files:',
    `  - url: ${zipName}`,
    '    sha512: test-zip',
    '    size: 1',
    `  - url: ${dmgName}`,
    '    sha512: test-dmg',
    '    size: 1',
    `path: ${zipName}`,
    'sha512: test-zip',
    '',
  ].join('\n');

  writeFile(path.join(releaseAssetsDir, dmgName));
  writeFile(path.join(releaseAssetsDir, zipName));
  writeFile(path.join(releaseAssetsDir, `${dmgName}.blockmap`));
  writeFile(path.join(releaseAssetsDir, `${zipName}.blockmap`));
  writeFile(path.join(releaseAssetsDir, 'latest-mac.yml'), metadata);
  writeFile(path.join(releaseAssetsDir, 'latest-arm64-mac.yml'), metadata);

  const result = runNode(['scripts/validate-release.ts', releaseAssetsDir], {
    env: { OPL_RELEASE_VERSION: version },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /latest-mac\.yml does not declare OPL release version 26\.5\.25/);
  assert.match(result.stderr, /latest-arm64-mac\.yml does not declare OPL release version 26\.5\.25/);
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
  assert.equal(summary.full_first_install_budget.max_full_dmg_bytes, 550000000);
  assert.equal(summary.full_first_install_budget.full_dmg_size_bytes, Buffer.byteLength('full-dmg'));
  assert.equal(summary.full_first_install_budget.runtime_uncompressed_bytes, 128);
  assert.deepEqual(summary.full_first_install_budget.temporal_core_bridge_releases, ['aarch64-apple-darwin']);
  assert.equal(summary.full_first_install_budget.excluded_module_venv_count, 0);
});

test('remote release verifier fails closed when Full runtime assertions are missing or broad', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-remote-release-runtime-assertions-'));
  const version = '26.5.19-runtime-assertions';
  const names = writeStandardRemoteAssets(tempRoot, version);
  names.push(...writeFullRemoteAssets(tempRoot, version, {
    manifest: {
      runtime_assertions: {
        temporal_core_bridge_releases: ['aarch64-apple-darwin', 'x86_64-apple-darwin'],
        excluded_module_venv_count: 1,
      },
    },
  }));
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
  assert.match(result.stderr, /Temporal core-bridge releases must be only aarch64-apple-darwin/);
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
    && lane.command.includes('One-Person-Lab-Full-26.5.19-mac-arm64.dmg')
    && lane.command.includes('--smoke-profile no-clt-clean-vm')
    && lane.command.includes('--display 1920x1080px')
    && lane.command.includes('--settings-smoke')
    && lane.command.includes('--runtime-profile full')
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
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));
  const shellBuildScript = fs.readFileSync(path.join(activeShellRoot, 'scripts', 'build-with-builder.js'), 'utf8');
  const shellViteConfig = fs.readFileSync(
    path.join(activeShellRoot, 'packages', 'desktop', 'electron.vite.config.ts'),
    'utf8',
  );

  assert.match(workflow, /command:\s*bun install --cwd shells\/aionui --frozen-lockfile/);
  assert.doesNotMatch(workflow, /command:\s*cd shells\/aionui && bun install --frozen-lockfile/);
  assert.equal(adapterContract.shell_contract.layout_id, 'aionui_v2_workspace');
  assert.equal(adapterContract.shell_contract.paths.product_profile_target, 'packages/desktop/src/common/config/oplProductProfile/oplProductProfile.generated.json');
  assert.equal(adapterContract.shell_contract.paths.electron_builder_config, 'packages/desktop/electron-builder.yml');
  assert.equal(adapterContract.shell_source.upstream_ref, 'v2.1.1');
  assert.match(
    workflow,
    /name: Prepare standard App payload[\s\S]*working-directory: \$\{\{ github\.workspace \}\}[\s\S]*run: node --experimental-strip-types scripts\/prepare-standard-release-payload\.ts/,
  );
  assert.match(
    workflow,
    /name: Verify packaged bundled bun assets[\s\S]*working-directory: \$\{\{ github\.workspace \}\}[\s\S]*run: bun run validate:opl-package/,
  );
  assert.equal(packageJson.scripts['test:packaged:bun'], 'node --experimental-strip-types scripts/run-active-shell-command.ts bun run validate:opl-package');
  assert.equal(packageJson.scripts['install:shell'], 'node --experimental-strip-types scripts/run-active-shell-command.ts bun install --frozen-lockfile');
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /--cwd shells\/aionui|cd shells\/aionui/);
  assert.match(shellBuildScript, /--config\.extraMetadata\.version=\$\{version\}/);
  assert.match(shellBuildScript, /\$\{publishArg\} \$\{oplReleaseVersionConfigArg\}/);
  assert.match(shellViteConfig, /const appReleaseVersion = injectedOplReleaseVersion \|\| rootPackageJson\.version/);
  assert.match(shellViteConfig, /__APP_VERSION__:\s*JSON\.stringify\(appReleaseVersion\)/);
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
  assert.equal(packageJson.scripts['build-mac:arm64'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-mac:arm64');
  assert.equal(packageJson.scripts['build-mac'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-mac');
  assert.equal(packageJson.scripts['build-mac:x64'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-mac:x64');
  assert.equal(packageJson.scripts['build-win'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-win');
  assert.equal(packageJson.scripts['build-deb'], 'node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run build-deb');
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
  assert.match(workflow, /name: Verify standard release assets[\s\S]*OPL_RELEASE_VERSION: \$\{\{ inputs\.opl_version \}\}[\s\S]*node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
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
  assert.doesNotMatch(fullWorkflow, /workflow_call:[\s\S]*secrets:[\s\S]*GH_TOKEN:/);
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
  assert.match(vmWorkflow, /schedule:/);
  assert.match(vmWorkflow, /concurrency:/);
  assert.match(vmWorkflow, /github\.event_name == 'schedule'/);
  assert.match(vmWorkflow, /opl-gui-first-run-vm-scheduled/);
  assert.match(vmWorkflow, /opl-gui-first-run-vm-manual/);
  assert.match(vmWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'schedule' \}\}/);
  assert.match(vmWorkflow, /Skip unconfigured scheduled smoke/);
  assert.match(vmWorkflow, /steps\.scheduled_config\.outputs\.skip_smoke != 'true'/);
  assert.match(vmWorkflow, /Configure repository variable `OPL_FIRST_RUN_TART_SOURCE`/);
  assert.match(vmWorkflow, /One-Person-Lab-Full-\*-mac-arm64\.dmg/);
  assert.match(vmWorkflow, /--smoke-profile no-clt-clean-vm/);
  assert.match(vmWorkflow, /--display 1920x1080px/);
  assert.match(vmWorkflow, /--settings-smoke/);
  assert.match(vmWorkflow, /--runtime-profile full/);
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
  assert.deepEqual(
    releaseContract.release_acceleration.vm_gate,
    {
      source: 'clean no-CLT Tart base clone',
      artifact: 'One-Person-Lab-Full-<version>-mac-arm64.dmg',
      smoke_profile: 'no-clt-clean-vm',
      display: '1920x1080px',
      settings_smoke: true,
      runtime_profile: 'full',
      codex_config_wizard: 'required_and_submitted',
      release_blocking_readiness: [
        'core_ready',
        'domain_modules_ready',
        'family_runtime_provider_ready',
      ],
      post_core_ready_background_policy: 'best_effort_non_blocking_until_maintenance_ready',
      non_blocking_deferred_maintenance: [
        'Command Line Tools installation',
        'companion skills install',
        'ecosystem module updates',
        'git availability',
        'managed repo sync',
      ],
    },
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
  assert.match(warmupWorkflow, /permissions:[\s\S]*contents: write/);
  assert.match(warmupWorkflow, /uses: \.\/\.github\/workflows\/full-first-install-release\.yml/);
  assert.match(warmupWorkflow, /publish_to_release: false/);
  assert.match(warmupWorkflow, /force_rebuild_runtime_cache:/);
  assert.doesNotMatch(warmupWorkflow, /secrets: inherit/);

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
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
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

test('release docs lock first-install maintenance and updater reference boundaries', () => {
  const releaseDocs = fs.readFileSync(path.join(appRoot, 'docs', 'release', 'README.md'), 'utf8');
  const statusDocs = fs.readFileSync(path.join(appRoot, 'docs', 'status.md'), 'utf8');
  const combinedDocs = `${releaseDocs}\n${statusDocs}`;

  assert.match(combinedDocs, /Core ready[\s\S]*best-effort background maintenance/i);
  assert.match(combinedDocs, /companion skills/i);
  assert.match(combinedDocs, /standard package[\s\S]*App-managed bootstrap[\s\S]*maintenance/i);
  assert.match(combinedDocs, /Electron autoUpdater/i);
  assert.match(combinedDocs, /background download/i);
  assert.match(combinedDocs, /restart/i);
  assert.match(combinedDocs, /Full[\s\S]*not[\s\S]*updater metadata/i);
  assert.match(combinedDocs, /Apple Command Line Tools/i);
  assert.match(combinedDocs, /xcode-select --install/i);
  assert.match(combinedDocs, /user confirmation/i);
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

  const validator = require(path.join(activeShellRoot, 'scripts', 'validate-packaged-runtime.js'));
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
    max_full_dmg_bytes: 550000000,
    max_runtime_uncompressed_bytes: 800000000,
  });
  assert.deepEqual(manifest.measurement_policy, {
    full_dmg_bytes: 'github_release_asset_size_bytes',
    runtime_uncompressed_bytes: 'manifest_size_breakdown_total_runtime_uncompressed_bytes',
  });
  assert.deepEqual(manifest.runtime_assertions, {
    temporal_core_bridge_releases: [],
    excluded_module_venv_count: 0,
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
  assert.equal(releaseContract.full_first_install.updater_visible, false);
  assert.equal(releaseContract.full_first_install.updater_metadata_allowed, false);
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
  assert.match(buildScript, /CODEX_MACOS_ARM64_TARGET = 'aarch64-apple-darwin'/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'bin', 'codex'\)/);
  assert.match(buildScript, /path\.join\(localVendorRoot, 'bin', 'codex'\)/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'codex-path', 'rg'\)/);
  assert.match(buildScript, /path\.join\(localVendorRoot, 'codex-path', 'rg'\)/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'codex', 'codex'\)/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'path', 'rg'\)/);
  assert.match(buildScript, /function copyOplMetaAgentSkill\(targetRoot, options\)/);
  assert.match(buildScript, /'agent', 'skills', 'opl-meta-agent-domain-skill\.md'/);
  assert.match(buildScript, /fs\.copyFileSync\(domainSkill, path\.join\(target, 'SKILL\.md'\)\)/);
  assert.match(buildScript, /\['knowledge', 'prompts', 'quality_gates', 'skills', 'stages'\]/);
  assert.match(buildScript, /copyOplMetaAgentSkill\(targetRoot, options\)/);
  assert.match(buildScript, /copyFirstSkillSource\('mineru-document-extractor'/);
  assert.match(buildScript, /copySingleFile\(sources\.mineruOpenApiBin, path\.join\(layerRoot, 'bin', 'mineru-open-api'\)\)/);
  assert.match(buildScript, /version: commandOutput\(sources\.mineruOpenApiBin, \['version'\]\)/);
  assert.match(buildScript, /plugins', 'opl-meta-agent', 'skills', 'opl-meta-agent'/);
  assert.match(buildScript, /meta_agent_repo_skill_fingerprint/);
  assert.match(buildScript, /mineru_document_extractor_fingerprint/);
  assert.match(buildScript, /syncAppProductProfileToShell\(options\.guiRoot\)/);
  assert.match(prepareStandardScript, /syncAppProductProfileToShell\(shellPaths\.shellRoot, \{ optional: true \}\)/);
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
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/node_modules/@types/node/index.d.ts'), true);
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/src/med_autoscience/__init__.py'), false);
  assert.equal(mod.shouldExcludeRuntimePath('modules/rca/contracts/runtime-program/schema.json'), false);
  assert.equal(
    mod.shouldExcludeRuntimePath('modules/meta-agent/runtime/authority_functions/meta-agent-authority-functions.json'),
    false,
  );
  assert.equal(mod.shouldExcludeRuntimePath('modules/mas/runtime/legacy-state.json'), true);
  assert.match(buildScript, /MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET = 'aarch64-apple-darwin'/);
  assert.match(buildScript, /pruneTemporalCoreBridgeReleases\(path\.join\(targetRoot, 'node_modules'\)\)/);
  assert.match(buildScript, /assertTemporalCoreBridgeMacosArm64Only\(path\.join\(runtimeRoot, 'opl', 'node_modules'\)\)/);
  assert.match(buildScript, /runtimeAssertions: collectRuntimeAssertions\(runtimeRoot\)/);
  assert.match(buildScript, /codex: \{ source_path: sources\.codexRoot[\s\S]*size_bytes: directorySizeBytes\(path\.join\(runtimeRoot, 'bin', 'codex'\)\)/);
});
