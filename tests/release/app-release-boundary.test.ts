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
const releaseWorkflowPaths = [
  '.github/workflows/_build-reusable.yml',
  '.github/workflows/build-and-release.yml',
  '.github/workflows/build-manual.yml',
  '.github/workflows/desktop-release-promote.yml',
  '.github/workflows/desktop-release.yml',
  '.github/workflows/full-first-install-release.yml',
  '.github/workflows/full-runtime-cache-warmup.yml',
  '.github/workflows/nightly-standard-release.yml',
  '.github/workflows/opl-first-run-vm.yml',
  '.github/workflows/release-verify-remote.yml',
];
const expectedDefaultCompanionSkillSyncIds = [
  'superpowers',
  'cron',
  'officecli',
  'officecli-docx',
  'officecli-pptx',
  'officecli-xlsx',
  'officecli-academic-paper',
  'officecli-data-dashboard',
  'officecli-financial-model',
  'officecli-pitch-deck',
  'pdf',
  'mineru-document-extractor',
  'ui-ux-pro-max',
];
const expectedDefaultPackagedSkillIds = [
  'mas',
  'mag',
  'rca',
  ...expectedDefaultCompanionSkillSyncIds,
];

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
    path.join(tempRoot, 'app-state-summary.json'),
    '{"app_state":{"schema":"opl_app_state.v1","profile":"fast","operator":{"summary":{"stage_attempt_count":1},"actions":[{"action_id":"provider-scheduler:temporal:trigger"}]},"provider":{"temporal":{"status":"ready"}}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'app-state-full.json'),
    '{"app_state":{"schema":"opl_app_state.v1","profile":"full","operator":{"summary":{"stage_attempt_count":1},"actions":[{"action_id":"provider-scheduler:temporal:trigger"}]},"provider":{"temporal":{"status":"ready"}}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'drilldown-full.json'),
    '{"app_operator_drilldown":{"surface_kind":"opl_app_operator_drilldown_read_model","detail_level":"full","summary":{"stage_attempt_count":1}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'action-dry-run-result.json'),
    '{"app_action_execution":{"surface_kind":"opl_app_action_execution.v1","action_id":"stage-production-attempt:medautoscience:analysis-campaign","dry_run":true,"result":{"execution":{"execution_status":"dry_run"}},"authority_boundary":{"can_write_domain_truth":false}}}\n',
  );
  writeFile(
    path.join(tempRoot, 'action-execute-result.json'),
    '{"app_action_execution":{"surface_kind":"opl_app_action_execution.v1","action_id":"stage-production-attempt:medautoscience:analysis-campaign","dry_run":false,"result":{"execution":{"execution_status":"executed"}},"authority_boundary":{"can_write_domain_truth":false}}}\n',
  );
}

function writeVmSmokeSummaryFiles(tempRoot, runtimeProfile = 'full') {
  const settingsSmoke = { status: 'passed', pages: ['overview', 'runtime', 'capabilities', 'access', 'appearance', 'system', 'about'] };
  const guestSummary = {
    surface_id: 'opl_packaged_gui_first_run_smoke',
    status: 'passed',
    runtime_profile: runtimeProfile,
    gui_ready: {
      hash: '#/guid',
      textLength: 240,
      hasGuidInput: true,
      hasGuidSendButton: true,
      hasAgentPill: true,
    },
    codex_config_wizard_seen: runtimeProfile === 'full',
    codex_config_wizard_submitted: runtimeProfile === 'full',
    settings_smoke: settingsSmoke,
  };
  writeFile(path.join(tempRoot, 'artifacts', 'smoke-summary.json'), `${JSON.stringify(guestSummary)}\n`);
  writeFile(
    path.join(tempRoot, 'tart-smoke-summary.json'),
    `${JSON.stringify({
      surface_id: 'opl_tart_gui_first_run_smoke',
      status: 'passed',
      runtime_profile: runtimeProfile,
      require_codex_config_wizard: runtimeProfile === 'full',
      settings_smoke: settingsSmoke,
      guest_summary: guestSummary,
    })}\n`,
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
      warning_full_dmg_bytes: 530000000,
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
  writeFile(
    path.join(outDir, 'runtime-cache-events.json'),
    `${JSON.stringify({
      mode: 'readwrite',
      dir: '/tmp/opl-full-runtime-cache-test',
      keys: {
        toolchain: 'full-runtime-v1-toolchain-test',
        'domain-runtime': 'full-runtime-v1-domain-runtime-test',
        'opl-runtime': 'full-runtime-v1-opl-runtime-test',
        skills: 'full-runtime-v1-skills-test',
      },
      events: [
        {
          layer_id: 'toolchain',
          key: 'full-runtime-v1-toolchain-test',
          status: 'hit',
          archive_path: '/tmp/opl-full-runtime-cache-test/toolchain/full-runtime-v1-toolchain-test.tar.zst',
          read_archive: true,
          write_archive: false,
          build_layer: false,
        },
      ],
    }, null, 2)}\n`,
  );
  writeFile(path.join(outDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  const checksumNames = [
    fullDmgName,
    'full-package-manifest.json',
    'runtime-cache-events.json',
    'README-Full-First-Install.txt',
  ];
  writeFile(
    path.join(outDir, 'SHA256SUMS.txt'),
    checksumNames.map((name) => `${fileSha256(path.join(outDir, name))}  ${name}`).join('\n') + '\n',
  );
  return [
    fullDmgName,
    'full-package-manifest.json',
    'runtime-cache-events.json',
    'README-Full-First-Install.txt',
    'SHA256SUMS.txt',
  ];
}

function readProductProfile() {
  return JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-product-profile.json'), 'utf8'));
}

function readInstallExposurePolicy() {
  return JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-install-exposure-policy.json'), 'utf8'));
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

test('release workflows force JavaScript actions onto the Node 24 runtime', () => {
  for (const workflowPath of releaseWorkflowPaths) {
    const workflow = fs.readFileSync(path.join(appRoot, workflowPath), 'utf8');

    assert.match(
      workflow,
      /\nenv:\n(?:  [A-Z0-9_]+: .+\n)*  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true\n/,
      `${workflowPath} must declare the Node 24 JavaScript action runtime policy in top-level env`,
    );
  }
});

test('App product profile owns user-facing defaults without runtime authority', () => {
  const profile = readProductProfile();
  const installExposurePolicy = readInstallExposurePolicy();

  assert.equal(profile.owner, 'one-person-lab-app');
  assert.equal(profile.purpose, 'app_owned_product_profile');
  assert.equal(profile.app_repo, 'gaofeng21cn/one-person-lab-app');
  assert.equal(profile.default_session_profile.executor, 'codex_cli');
  assert.equal(profile.default_session_profile.model, profile.codex.default_model);
  assert.equal(profile.default_session_profile.reasoning_effort, profile.codex.default_reasoning_effort);
  assert.equal(profile.gui.authority, 'app_repo_owned_product_truth');
  assert.equal(profile.gui.implementation_carrier, 'opl-aion-shell');
  assert.equal(profile.gui.appearance.default_css_theme_id, 'default-theme');
  assert.equal(profile.gui.appearance.codex_theme_default_enabled, false);
  assert.equal(profile.gui.home.primary_input_surface, 'single_card');
  assert.equal(profile.gui.home.nested_input_card_frames_allowed, false);
  assert.equal(profile.gui.home.codex_cli_fixed_executor, true);
  assert.equal(profile.gui.home.home_executor_selector_visible, false);
  assert.equal(profile.gui.home.codex_model_selector_visible, false);
  assert.equal(profile.gui.home.codex_model_list_visible, false);
  assert.equal(profile.gui.home.codex_model_policy, 'codex_cli_auto_model_hidden_on_home');
  assert.equal(profile.gui.home.codex_default_model, 'codex_cli_auto');
  assert.equal(profile.gui.home.codex_default_reasoning_effort, profile.codex.default_reasoning_effort);
  assert.equal(profile.gui.home.codex_default_permission_mode, 'full-access');
  assert.equal(profile.gui.home.permission_mode_selector_visible, false);
  assert.equal(profile.gui.home.conversation_backend_selector_visible, false);
  assert.equal(profile.gui.home.conversation_model_selector_visible, false);
  assert.equal(profile.gui.home.conversation_permission_mode_selector_visible, false);
  assert.equal(profile.gui.home.codex_home_model_status_label, '自动');
  assert.equal(profile.gui.home.codex_home_model_status_label_en, 'Auto');
  assert.equal(profile.gui.home.codex_precise_model_display_policy, 'technical_details_or_connected_state_only');
  assert.equal(profile.gui.home.codex_auto_model_selection.strategy, 'codex_cli_auto_latest_available_frontier');
  assert.equal(profile.gui.home.codex_auto_model_selection.user_can_override_model, false);
  assert.equal(profile.gui.home.codex_auto_model_selection.user_can_restore_auto, false);
  assert.equal(profile.gui.home.codex_auto_model_selection.selection_persists_into_conversation, true);
  assert.deepEqual(
    profile.gui.home.codex_auto_model_selection.frontier_model_preference_order,
    ['gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2'],
  );
  assert.deepEqual(profile.gui.home.retired_codex_models_must_not_be_exposed, [
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ]);
  assert.deepEqual(profile.gui.home.home_purpose_entries.map((entry) => entry.id), ['research', 'grant', 'ppt']);
  assert.deepEqual(profile.gui.home.home_purpose_entries.map((entry) => entry.primary_label), ['科研', '基金', 'PPT']);
  assert.deepEqual(profile.gui.home.home_purpose_entries.map((entry) => entry.target_assistant_id), ['mas', 'mag', 'rca']);
  assert.ok(profile.gui.home.home_purpose_entries.every((entry) => entry.display_policy === 'purpose_first'));
  assert.deepEqual(profile.gui.default_assistants.map((assistant) => assistant.id), ['mas', 'mag', 'rca']);
  assert.ok(profile.gui.default_assistants.every((assistant) => assistant.home_entry_policy === 'purpose_entry_target'));
  assert.deepEqual(profile.gui.assistant_skill_profiles.map((profile) => profile.assistant_id), ['mas', 'mag', 'rca']);
  assert.deepEqual(
    Object.fromEntries(profile.gui.assistant_skill_profiles.map((profile) => [profile.assistant_id, profile.required_skills])),
    { mas: ['mas'], mag: ['mag'], rca: ['rca'] },
  );
  assert.ok(
    profile.gui.assistant_skill_profiles.every(
      (profile) => profile.skill_menu_policy === 'assistant_scoped_required_checked_optional_visible',
    ),
  );
  assert.ok(profile.gui.assistant_skill_profiles.every((profile) => profile.hidden_home_skill_names.includes('aionui-skills')));
  assert.ok(profile.gui.assistant_skill_profiles.every((profile) => !profile.optional_skills.includes('morph-ppt')));
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.scope, 'home_purpose_entry_to_conversation');
  assert.deepEqual(profile.gui.builtin_assistant_route_receipt_policy.required_for_assistants, ['mas', 'mag', 'rca']);
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.route_kind, 'builtin_capability');
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.executor, 'codex_cli');
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.source, 'opl_app_home');
  assert.deepEqual(profile.gui.builtin_assistant_route_receipt_policy.required_fields, [
    'route_kind',
    'executor',
    'assistant_id',
    'assistant_short_name',
    'source',
  ]);
  assert.equal(profile.gui.builtin_assistant_route_receipt_policy.must_not_depend_on_visible_backend_selection, true);
  assert.deepEqual(profile.settings.visible_tabs, [
    'overview',
    'runtime',
    'capabilities',
    'access',
    'appearance',
    'system',
    'about',
  ]);
  assert.deepEqual(profile.settings.legacy_route_redirects, {
    model: 'runtime',
    agent: 'runtime',
    assistants: 'capabilities',
    'skills-hub': 'capabilities',
    tools: 'capabilities',
    display: 'appearance',
    webui: 'access',
    pet: 'appearance',
  });
  assert.equal(profile.gui.non_default_assistants.find((assistant) => assistant.id === 'oma').home_default_visible, false);
  assert.ok(profile.codex.default_visible_skills.includes('superpowers'));
  assert.ok(profile.codex.default_visible_skills.includes('cron'));
  assert.ok(profile.codex.default_visible_skills.includes('pdf'));
  assert.ok(profile.codex.default_visible_skills.includes('mineru-document-extractor'));
  assert.ok(profile.codex.default_visible_skills.includes('ui-ux-pro-max'));
  assert.ok(profile.companion_payloads.default_packaged_codex_skill_ids.includes('superpowers'));
  assert.deepEqual(profile.companion_payloads.default_packaged_codex_skill_ids, expectedDefaultPackagedSkillIds);
  assert.ok(profile.companion_payloads.packaged_not_default_visible_codex_skill_ids.includes('opl-meta-agent'));
  assert.ok(!profile.codex.skill_priority.includes('morph-ppt'));
  assert.ok(!profile.companion_payloads.default_packaged_codex_skill_ids.includes('morph-ppt'));
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
      'native_helpers',
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
        'native_helpers',
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
      'native_helpers',
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
  assert.equal(profile.companion_payloads.install_exposure_policy_ref, 'contracts/app-install-exposure-policy.json');
  assert.equal(profile.companion_payloads.public_abi.primary_semantic_entry, 'skill');
  assert.equal(profile.companion_payloads.public_abi.plugin_must_not_create_second_semantics, true);
  assert.equal(profile.companion_payloads.domain_plugin_skills_must_not_be_companion_mirrors, true);
  assert.deepEqual(profile.companion_payloads.domain_plugin_skill_ids, ['mas', 'mag', 'rca']);
  assert.deepEqual(profile.companion_payloads.companion_skill_sync_default_ids, expectedDefaultCompanionSkillSyncIds);
  for (const domainPluginId of profile.companion_payloads.domain_plugin_skill_ids) {
    assert.equal(profile.companion_payloads.companion_skill_sync_default_ids.includes(domainPluginId), false);
  }
  assert.equal(installExposurePolicy.public_abi.primary_semantic_entry, profile.companion_payloads.public_abi.primary_semantic_entry);
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

test('App install exposure policy keeps skill ABI and plugin distribution separate', () => {
  const policy = readInstallExposurePolicy();

  assert.equal(policy.owner, 'one-person-lab-app');
  assert.equal(policy.purpose, 'app_install_exposure_policy');
  assert.equal(policy.producer_owner, 'one-person-lab');
  assert.deepEqual(policy.canonical_metadata_sources.sources, [
    'family_action_catalog',
    'family_stage_control_plane',
    'family-product-entry-manifest-v2',
  ]);
  assert.equal(policy.public_abi.primary_semantic_entry, 'skill');
  assert.equal(policy.public_abi.plugin_role, 'codex_app_distribution_and_capability_bundle');
  assert.equal(policy.public_abi.direct_skill_compatibility_required, true);
  assert.equal(policy.public_abi.plugin_must_not_create_second_semantics, true);
  assert.equal(policy.public_abi.app_must_not_mirror_plugin_skill_as_duplicate_bare_skill, true);

  const exposureClassById = new Map(policy.exposure_classes.map((entry) => [entry.id, entry]));
  assert.deepEqual(exposureClassById.get('family_domain_plugin_surfaces').members, ['mas', 'mag', 'rca']);
  assert.equal(exposureClassById.get('family_domain_plugin_surfaces').sync_target, 'codex_plugin_registry');
  assert.deepEqual(exposureClassById.get('family_domain_plugin_surfaces').must_not_sync_to, [
    '~/.codex/skills/mas',
    '~/.codex/skills/mag',
    '~/.codex/skills/rca',
  ]);
  assert.equal(exposureClassById.get('opl_generated_skill_surfaces').sync_target, 'opl_generated_codex_surface');
  assert.deepEqual(exposureClassById.get('opl_generated_skill_surfaces').members, ['opl-meta-agent']);
  assert.deepEqual(exposureClassById.get('companion_skill_sync').members, expectedDefaultCompanionSkillSyncIds);
  assert.equal(exposureClassById.get('companion_skill_sync').members.includes('mas'), false);
  assert.equal(exposureClassById.get('companion_skill_sync').members.includes('mag'), false);
  assert.equal(exposureClassById.get('companion_skill_sync').members.includes('rca'), false);

  const domainById = new Map(policy.domain_exposure.map((entry) => [entry.domain_id, entry]));
  assert.equal(domainById.get('mas').preferred_app_distribution, 'plugin_packaged_skill');
  assert.equal(domainById.get('mag').preferred_app_distribution, 'plugin_packaged_skill');
  assert.equal(domainById.get('rca').preferred_app_distribution, 'plugin_packaged_skill');
  assert.equal(domainById.get('oma').preferred_app_distribution, 'opl_generated_skill_surface');
  assert.equal(domainById.get('oma').default_home_visible, false);

  for (const surface of policy.installer_surfaces) {
    assert.equal(surface.progress_source, 'opl system initialize --json');
  }
  assert.equal(policy.first_run_user_presentation.skill_plugin_distinction_visible_by_default, false);
  assert.deepEqual(policy.setup_flow_contract.ready_to_launch_required_core_items, [
    'workspace_root',
    'codex_cli',
    'codex_config',
  ]);
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
    'native_helpers',
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
      'native_helpers',
      'companion_skills_install',
      'ecosystem_module_updates',
    ],
  });
  assert.ok(fullClean.expects.some((entry) => /without requiring host CLT, Homebrew, Node, or Git/.test(entry)));
  assert.ok(fullClean.expects.some((entry) => /best-effort background maintenance after Core ready/.test(entry)));

  const standardClean = scenarioById.get('standard_dmg_clean_vm_smoke');
  assert.equal(standardClean.release_gate, true);
  assert.equal(standardClean.vm.runtime_profile, 'standard');
  assert.ok(standardClean.expects.some((entry) => /Framework CLI when opl is missing/.test(entry)));
  assert.ok(standardClean.expects.some((entry) => /Core first-launch readiness.*opl system initialize --json/.test(entry)));
  assert.ok(standardClean.release_evidence_artifacts.includes('artifacts/system-initialize.json'));

  const standardBootstrap = scenarioById.get('standard_app_managed_bootstrap');
  assert.equal(standardBootstrap.bootstrap_owner, 'app_managed');
  assert.equal(
    standardBootstrap.maintenance_resolution_policy,
    'app_or_cli_managed_best_effort_until_ready',
  );
  assert.ok(standardBootstrap.expects.some((entry) => /packaged App installer/.test(entry)));
  assert.ok(standardBootstrap.expects.some((entry) => /modules, GUI open, native-helper repair, and online family runtime install disabled/.test(entry)));
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
  const activeShellContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const runtimeBridge = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-runtime-bridge.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const guidHomePage = pageStateMatrix.pages.find((page) => page.id === 'guid_home');
  const runtimePage = pageStateMatrix.pages.find((page) => page.id === 'runtime');
  const environmentPage = pageStateMatrix.pages.find((page) => page.id === 'environment');
  const settingsThemePage = pageStateMatrix.pages.find((page) => page.id === 'settings_theme');

  assert.equal(activeShellContract.runtime_bridge_contract, 'contracts/app-runtime-bridge.json');
  assert.equal(runtimeBridge.owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.purpose, 'runtime_bridge_abstraction');
  assert.equal(runtimeBridge.active_adapter, activeShellContract.active_shell);
  assert.equal(runtimeBridge.adapter_role, 'replaceable_gui_shell_adapter');
  assert.equal(runtimeBridge.protocol_owner, 'one-person-lab');
  assert.equal(runtimeBridge.ui_contract_owner, 'one-person-lab-app');
  assert.equal(runtimeBridge.default_adapter_repo, activeShellContract.shell_source.owner_repo);
  assert.equal(runtimeBridge.default_adapter_path, activeShellContract.shell_root);
  assert.equal(runtimeBridge.summary_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.refresh_command, 'opl app state --profile fast --json');
  assert.equal(runtimeBridge.full_state_command, 'opl app state --profile full --json');
  assert.equal(runtimeBridge.full_state_policy, 'diagnostic_or_release_evidence_only');
  assert.equal(runtimeBridge.full_detail_command, 'opl runtime app-operator-drilldown --detail full --json');
  assert.equal(runtimeBridge.action_command, 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json');
  assert.equal(runtimeBridge.live_conformance_gate.mode, 'explicit_env_opt_in');
  assert.equal(runtimeBridge.live_conformance_gate.default_enforcement, 'disabled');
  assert.equal(runtimeBridge.live_conformance_gate.enable_env, 'OPL_APP_LIVE_CONFORMANCE');
  assert.equal(runtimeBridge.live_conformance_gate.opl_root_env, 'OPL_APP_LIVE_OPL_ROOT');
  assert.equal(runtimeBridge.live_conformance_gate.action_fixture_env, 'OPL_APP_LIVE_ACTION_FIXTURE');
  assert.equal(runtimeBridge.live_conformance_gate.fast_state_max_bytes, 500000);
  assert.equal(runtimeBridge.live_conformance_gate.required_state_schema, 'opl_app_state.v1');
  assert.equal(runtimeBridge.live_conformance_gate.golden_fast_state_fixture, 'contracts/fixtures/opl-app-state-fast.fixture.json');
  assert.equal(runtimeBridge.projection_sources.primary, 'app_state.operator.summary');
  assert.equal(runtimeBridge.projection_sources.provider, 'app_state.provider');
  assert.equal(runtimeBridge.projection_sources.actions, 'app_state.actions');
  assert.equal(runtimeBridge.authority_boundary.shell_adapter_can_own_runtime_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_own_runtime_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_write_domain_truth, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_read_artifact_body, false);
  assert.equal(runtimeBridge.authority_boundary.app_can_read_memory_body, false);
  assert.equal(runtimeBridge.replacement_policy.runtime_protocol_stable_across_shell_replacement, true);

  assert.equal(
    guidHomePage.machine_source,
    'contracts/app-gui-product-contract.json#pages.guid_home + opl app state --profile fast --json',
  );
  assert.equal(guidHomePage.page_contract, 'guid_home_entry');
  assert.equal(guidHomePage.home_view_model.authority, 'app_repo_owned_product_truth');
  assert.equal(guidHomePage.home_view_model.implementation_carrier, 'opl-aion-shell');
  assert.equal(guidHomePage.home_view_model.primary_input_surface, 'single_card');
  assert.equal(guidHomePage.home_view_model.nested_input_card_frames_allowed, false);
  assert.equal(guidHomePage.home_view_model.appearance_default_css_theme_id, 'default-theme');
  assert.equal(guidHomePage.home_view_model.codex_cli_fixed_executor, true);
  assert.equal(guidHomePage.home_view_model.home_executor_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.codex_model_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.codex_model_list_visible, false);
  assert.equal(guidHomePage.home_view_model.codex_model_policy, 'codex_cli_auto_model_hidden_on_home');
  assert.equal(guidHomePage.home_view_model.codex_default_model, 'codex_cli_auto');
  assert.equal(guidHomePage.home_view_model.codex_default_reasoning_effort, 'xhigh');
  assert.equal(guidHomePage.home_view_model.codex_default_display_label, '自动');
  assert.equal(guidHomePage.home_view_model.codex_default_permission_mode, 'full-access');
  assert.equal(guidHomePage.home_view_model.permission_mode_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.conversation_backend_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.conversation_model_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.conversation_permission_mode_selector_visible, false);
  assert.equal(guidHomePage.home_view_model.codex_precise_model_display_policy, 'technical_details_or_connected_state_only');
  assert.deepEqual(guidHomePage.home_view_model.codex_frontier_model_preference_order, [
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.3-codex',
    'gpt-5.2',
  ]);
  assert.equal(guidHomePage.home_view_model.codex_user_can_override_model, false);
  assert.equal(guidHomePage.home_view_model.codex_user_can_restore_auto, false);
  assert.deepEqual(guidHomePage.home_view_model.retired_codex_models_must_not_be_exposed, [
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ]);
  assert.equal(guidHomePage.home_view_model.state_source, 'opl app state --profile fast --json');
  assert.equal(guidHomePage.home_view_model.refresh_source, 'opl app state --profile fast --json');
  assert.equal(guidHomePage.home_view_model.executor_policy_ref, 'contracts/app-gui-product-contract.json#executor_policy');
  assert.equal(guidHomePage.home_view_model.assistant_source_ref, 'contracts/app-gui-product-contract.json#default_assistants');
  assert.equal(guidHomePage.home_view_model.codex_only_default, true);
  assert.equal(guidHomePage.home_view_model.executor_tab_visible_when_single_executor, false);
  assert.equal(guidHomePage.home_view_model.purpose_entry_source_ref, 'contracts/app-gui-product-contract.json#home_purpose_entries');
  assert.equal(
    guidHomePage.home_view_model.assistant_skill_profile_source_ref,
    'contracts/app-gui-product-contract.json#assistant_skill_profiles',
  );
  assert.equal(
    guidHomePage.home_view_model.route_receipt_source_ref,
    'contracts/app-gui-product-contract.json#builtin_assistant_route_receipt_policy',
  );
  assert.deepEqual(guidHomePage.home_view_model.route_receipt_required_fields, [
    'route_kind',
    'executor',
    'assistant_id',
    'assistant_short_name',
    'source',
  ]);
  assert.deepEqual(guidHomePage.home_view_model.default_assistants, ['mas', 'mag', 'rca']);
  assert.deepEqual(guidHomePage.home_view_model.default_assistant_required_skills, {
    mas: ['mas'],
    mag: ['mag'],
    rca: ['rca'],
  });
  assert.deepEqual(guidHomePage.home_view_model.home_purpose_entries.map((entry) => entry.id), ['research', 'grant', 'ppt']);
  assert.deepEqual(guidHomePage.home_view_model.home_purpose_entries.map((entry) => entry.primary_label), ['科研', '基金', 'PPT']);
  assert.deepEqual(guidHomePage.home_view_model.home_purpose_entries.map((entry) => entry.target_assistant_id), ['mas', 'mag', 'rca']);
  assert.ok(guidHomePage.home_view_model.home_purpose_entries.every((entry) => entry.display_policy === 'purpose_first'));
  for (const expected of [
    'Codex CLI fixed executor experience',
    'Codex automatic model status label',
    'purpose-first entries 科研/MAS, 基金/MAG, PPT/RCA',
    'selected assistant keeps purpose entry switcher visible',
    'assistant-scoped skill menu with required skill checked',
    'workspace selector',
    'file attachment control',
    'send action',
  ]) {
    assert.ok(guidHomePage.must_show.includes(expected), expected);
  }
  for (const forbidden of [
    'executor selector on the home input',
    'Aion CLI or Claude Code backend choices on the home input',
    'Codex model override selector on the home input',
    'permission mode selector on the home input',
    'backend/model/permission selectors after entering an ordinary Codex conversation',
    'full assistant names as default home entry labels',
    'AionUI-specific internal skills in home skill menu',
    'OPL Meta Agent as a default home assistant',
    'retired Codex model choices',
    'nested input card frames',
  ]) {
    assert.ok(guidHomePage.must_not_show.includes(forbidden), forbidden);
  }

  assert.equal(
    runtimePage.machine_source,
    'opl app state --profile fast --json',
  );
  assert.equal(runtimePage.primary_projection, 'app_state.operator.summary');
  assert.equal(runtimePage.fallback_projection, 'full App/operator drilldown only for on-demand full detail');
  assert.equal(runtimePage.framework_command, 'opl app state --profile fast --json');
  assert.equal(runtimePage.framework_full_detail_command, 'opl runtime app-operator-drilldown --detail full --json');
  assert.equal(runtimePage.framework_action_command, 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json');
  assert.equal(runtimePage.page_contract, 'runtime_status_summary_first');
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.role,
    'runtime_page_operator_evidence_acceptance',
  );
  assert.equal(runtimePage.operator_evidence_acceptance_path.accepts_refs_only_json, true);
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.summary_state_command,
    'opl app state --profile fast --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.refresh_state_command,
    'opl app state --profile fast --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.full_drilldown_command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_dry_run_command,
    'opl app action execute --action <action_id> --dry-run --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_execute_command,
    'opl app action execute --action <action_id> --json',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_route_source,
    'app_state.actions',
  );
  assert.equal(
    runtimePage.operator_evidence_acceptance_path.action_execution_policy,
    'operator_selected_safe_app_action_route_only',
  );
  assert.equal(runtimePage.runtime_view_model.role, 'opl_runtime_status_summary');
  assert.equal(runtimePage.runtime_view_model.bridge_contract, 'contracts/app-runtime-bridge.json');
  assert.equal(runtimePage.runtime_view_model.default_mode, 'app_state_summary_first');
  assert.equal(runtimePage.runtime_view_model.full_detail_policy, 'on_demand_only');
  assert.equal(runtimePage.runtime_view_model.polling_fallback.interval_seconds_min, 5);
  assert.equal(runtimePage.runtime_view_model.polling_fallback.interval_seconds_max, 10);
  assert.equal(runtimePage.runtime_view_model.polling_fallback.policy, 'lightweight_polling_until_push_projection_available');
  assert.equal(runtimePage.runtime_view_model.action_queue.source, 'app_state.actions');
  assert.equal(runtimePage.runtime_view_model.action_queue.fallback_source, 'app_state.operator.actions');
  assert.equal(runtimePage.runtime_view_model.action_queue.authority, 'framework_refs_only');
  assert.equal(runtimePage.runtime_view_model.primary_state_source, 'opl app state --profile fast --json');
  assert.equal(runtimePage.runtime_view_model.refresh_state_source, 'opl app state --profile fast --json');
  assert.equal(runtimePage.runtime_view_model.summary_source, 'app_state.operator.summary');
  assert.equal(runtimePage.runtime_view_model.full_detail_source, 'opl runtime app-operator-drilldown --detail full --json');
  assert.equal(runtimePage.runtime_view_model.provider_status.source, 'app_state.provider');
  assert.equal(runtimePage.runtime_view_model.provider_status.authority, 'opl_framework');
  assert.equal(runtimePage.runtime_view_model.authority_boundary.refs_only, true);
  assert.equal(runtimePage.runtime_view_model.authority_boundary.non_authority_display_only, true);
  assert.equal(runtimePage.runtime_view_model.authority_boundary.action_execution_owner, 'opl_framework');
  assert.equal(runtimePage.runtime_view_model.authority_boundary.domain_verdict_owner, 'domain_agent');
  for (const expected of [
    'summary-first OPL App state read model',
    'fast App state refresh',
    'full detail lazy load',
    'app_state.operator.summary refs',
    'app_state.provider readiness refs',
    'app_state.actions safe action refs',
    'refs-only non-authority boundary',
    'safe app action dry-run',
    'safe app action execute',
    'receipt/count refresh after execute',
    'authority boundary fields',
  ]) {
    assert.ok(runtimePage.operator_evidence_path.includes(expected), expected);
  }
  for (const expected of [
    'summary-first OPL runtime status',
    'provider readiness from app_state.provider',
    'operator summary from app_state.operator',
    'safe action refs from app_state.actions',
    'summary-first OPL App state read model',
    'full detail lazy load',
    'safe app action dry-run/execute controls',
    'receipt/count refresh after execute',
    'refs-only non-authority boundary',
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
  assert.equal(pageStateMatrix.canonical_state_surface.default_command, 'opl app state --profile fast --json');
  assert.equal(pageStateMatrix.canonical_state_surface.refresh_command, 'opl app state --profile fast --json');
  assert.equal(
    pageStateMatrix.canonical_action_surface.command,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  );
  assert.equal(
    pageStateMatrix.full_detail_exception.command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(environmentPage.machine_source, 'opl app state --profile fast --json');
  assert.equal(environmentPage.refresh_source, 'opl app state --profile fast --json');
  assert.equal(
    environmentPage.module_path_source_policy_ref,
    'contracts/app-gui-product-contract.json#module_path_source_policy',
  );
  assert.ok(environmentPage.must_show.includes('module path source explanation'));
  assert.ok(environmentPage.must_not_show.includes('Med Deep Scientist as a default module'));
  assert.equal(settingsThemePage.machine_source, 'opl app state --profile fast --json');
  assert.equal(settingsThemePage.refresh_source, 'opl app state --profile fast --json');
  assert.ok(settingsThemePage.must_show.includes('Default theme option'));
  assert.ok(settingsThemePage.must_show.includes('Codex theme option'));
  const aboutPage = pageStateMatrix.pages.find((page) => page.id === 'about');
  assert.ok(aboutPage.must_show.includes('OPL Framework revision'));
  assert.ok(pageStateMatrix.pages.every((page) => page.id !== 'docker_webui'));
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
    artifactById.get('app_state_summary').producer,
    'opl app state --profile fast --json',
  );
  assert.equal(
    artifactById.get('app_state_full').producer,
    'opl app state --profile full --json',
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
      'app-state-summary.json',
      'app-state-full.json',
      'drilldown-full.json',
      'action-dry-run-result.json',
      'action-execute-result.json',
      'screenshots/runtime.png',
      'screenshots/full.png',
      'screenshots/action.png',
      'tart-smoke-summary.json',
      'artifacts/smoke-summary.json',
      'remote-release-verification.json',
    ],
  );
  assert.deepEqual(
    [...artifactById.values()].map((artifact) => artifact.source_kind),
    [
      'opl_app_state_summary',
      'opl_app_state_full',
      'opl_app_operator_drilldown_full',
      'opl_app_action_dry_run',
      'opl_app_action_execute',
      'app_runtime_page_screenshot',
      'full_first_install_release_screenshot',
      'app_runtime_action_screenshot',
      'clean_first_run_vm_smoke',
      'packaged_gui_first_run_smoke',
      'remote_release_verification',
    ],
  );
  assert.deepEqual(fullFirstRun.release_evidence_artifacts, [
    'tart-smoke-summary.json',
    'artifacts/smoke-summary.json',
    'artifacts/system-initialize.json',
    'artifacts/settings-smoke-summary.json',
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
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts;
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
  writeVmSmokeSummaryFiles(tempRoot);
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeTinyPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'action.png'));

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
      'app_state_summary',
      'app_state_full',
      'drilldown_full',
      'action_dry_run_result',
      'action_execute_result',
      'runtime_screenshot',
      'full_screenshot',
      'action_screenshot',
      'first_run_vm_summary',
      'guest_smoke_summary',
      'remote_release_verification',
    ],
  );
});

test('release evidence bundle validator fails closed for incomplete packaged App evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-missing-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const missingArtifactIds = new Set(['first_run_vm_summary', 'guest_smoke_summary', 'remote_release_verification']);
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => (
    missingArtifactIds.has(artifact.id)
      ? {
          ...artifact,
          status: 'missing',
          missing_reason: `${artifact.producer} was not generated in this environment`,
        }
      : {
          ...artifact,
          status: 'present',
        }
  ));
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
    'first_run_vm_summary',
    'guest_smoke_summary',
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
    'app-state-summary.json',
    'app-state-full.json',
    'drilldown-full.json',
    'action-dry-run-result.json',
    'action-execute-result.json',
    'remote-release-verification.json',
  ]) {
    writeFile(path.join(tempRoot, name), '{"status":"passed","refs_only":true}\n');
  }
  writeVmSmokeSummaryFiles(tempRoot);
  writeTinyPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeTinyPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /app_state_summary\.app_state/);
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
    'first_run_vm_summary',
    'guest_smoke_summary',
    'remote_release_verification',
  ]);

  const manifest = JSON.parse(fs.readFileSync(path.join(tempRoot, 'evidence-manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'missing_evidence');
  assert.equal(manifest.packaged_app_evidence, false);
  assert.deepEqual(manifest.missing_evidence.map((artifact) => artifact.id), [
    'first_run_vm_summary',
    'guest_smoke_summary',
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
if (args.join(' ') === 'app state --profile fast --json') {
  out({
    app_state: {
      schema: 'opl_app_state.v1',
      profile: 'fast',
      operator: {
        summary: { stage_attempt_count: 2 },
        actions: [{ action_id: 'provider-scheduler:temporal:trigger' }]
      },
      provider: { temporal: { status: 'ready' } }
    }
  });
  process.exit(0);
}
if (args.join(' ') === 'app state --profile full --json') {
  out({
    app_state: {
      schema: 'opl_app_state.v1',
      profile: 'full',
      operator: {
        summary: { stage_attempt_count: 2 },
        actions: [{ action_id: 'provider-scheduler:temporal:trigger' }]
      },
      provider: { temporal: { status: 'ready' } }
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
if (args.slice(0, 4).join(' ') === 'app action execute --action') {
  const actionId = args[4];
  const dryRun = args.includes('--dry-run');
  out({
    app_action_execution: {
      surface_kind: 'opl_app_action_execution.v1',
      action_id: actionId,
      dry_run: dryRun,
      result: { execution: { execution_status: dryRun ? 'dry_run' : 'executed' } },
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
    'app_state_summary',
    'app_state_full',
    'drilldown_full',
    'action_dry_run_result',
    'action_execute_result',
  ]);
  assert.deepEqual(payload.missing_artifacts, [
    'runtime_screenshot',
    'full_screenshot',
    'action_screenshot',
    'first_run_vm_summary',
    'guest_smoke_summary',
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
    ['app', 'state', '--profile', 'fast', '--json'],
    ['app', 'state', '--profile', 'full', '--json'],
    ['runtime', 'app-operator-drilldown', '--detail', 'full', '--json'],
    ['app', 'action', 'execute', '--action', 'provider-scheduler:temporal:trigger', '--dry-run', '--json'],
    ['app', 'action', 'execute', '--action', 'provider-scheduler:temporal:trigger', '--json'],
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

test('release asset preparation drops stale standard assets from older OPL versions', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-stale-assets-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const artifactsDir = path.join(tempRoot, 'artifacts');
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const version = '26.5.28';
  const previousVersion = '26.5.27';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const metadata = [
    `version: ${version}`,
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

  writeFile(
    path.join(shellRoot, 'scripts', 'prepare-release-assets.sh'),
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'rm -rf "$2"',
      'mkdir -p "$2"',
      'cp -f "$1"/* "$2"/',
      '',
    ].join('\n'),
  );
  fs.chmodSync(path.join(shellRoot, 'scripts', 'prepare-release-assets.sh'), 0o755);

  writeFile(path.join(artifactsDir, dmgName));
  writeFile(path.join(artifactsDir, zipName));
  writeFile(path.join(artifactsDir, `${dmgName}.blockmap`));
  writeFile(path.join(artifactsDir, `${zipName}.blockmap`));
  writeFile(path.join(artifactsDir, `One-Person-Lab-${previousVersion}-mac-arm64.dmg.blockmap`));
  writeFile(path.join(artifactsDir, `One-Person-Lab-${previousVersion}-mac-arm64.zip.blockmap`));
  writeFile(path.join(artifactsDir, 'latest-mac.yml'), metadata);
  writeFile(path.join(artifactsDir, 'latest-arm64-mac.yml'), metadata);

  const result = runNode(['scripts/prepare-release-assets.ts', artifactsDir, releaseAssetsDir], {
    env: {
      OPL_APP_SHELL_ROOT: shellRoot,
      OPL_RELEASE_VERSION: version,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(releaseAssetsDir).sort(), [
    dmgName,
    `${dmgName}.blockmap`,
    zipName,
    `${zipName}.blockmap`,
    'latest-arm64-mac.yml',
    'latest-mac.yml',
  ]);
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
  assert.equal(payload.profile, 'stable');
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'standard_dmg_clean_vm_smoke'
    && lane.phase === 'installation_gate'
    && lane.command.includes('One-Person-Lab-26.5.19-mac-arm64.dmg')
    && lane.command.includes('--smoke-profile no-clt-clean-vm')
    && lane.command.includes('--display 1920x1080px')
    && lane.command.includes('--settings-smoke')
    && lane.command.includes('--runtime-profile standard')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'full_dmg_clean_vm_smoke'
    && lane.phase === 'release_gate'
    && lane.command.includes('One-Person-Lab-Full-26.5.19-mac-arm64.dmg')
    && lane.command.includes('--smoke-profile no-clt-clean-vm')
    && lane.command.includes('--display 1920x1080px')
    && lane.command.includes('--settings-smoke')
    && lane.command.includes('--runtime-profile full')
  )));
  assert.ok(payload.lanes.some((lane) => lane.id === 'one_shot_app_installer_smoke'));
  assert.ok(payload.lanes.some((lane) => lane.id === 'docker_webui_smoke'));
  assert.ok(payload.lanes.some((lane) => lane.id === 'release_evidence_bundle'));
});

test('nightly release plan stays lightweight and excludes stable installation gates', () => {
  const result = runNode([
    'scripts/plan-release-candidate.ts',
    '--version',
    '26.5.19-nightly.20260527',
    '--profile',
    'nightly',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.profile, 'nightly_standard');
  assert.deepEqual(payload.lanes.map((lane) => lane.id), [
    'release_boundary',
    'standard_build',
    'publish_nightly_prerelease',
    'remote_verify_standard',
  ]);
  assert.ok(payload.lanes.every((lane) => !/full|vm|installer|docker|evidence/i.test(lane.id)));
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
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
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
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
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

test('active shell command wrapper injects App release version for local builds', () => {
  const today = new Date();
  const expectedDefaultVersion = `${String(today.getUTCFullYear()).slice(-2)}.${today.getUTCMonth() + 1}.${today.getUTCDate()}`;
  const printVersion = ['scripts/run-active-shell-command.ts', process.execPath, '-e', 'process.stdout.write(process.env.OPL_RELEASE_VERSION || "")'];

  const defaultResult = runNode(printVersion, { env: { OPL_RELEASE_VERSION: '' } });
  assert.equal(defaultResult.status, 0, defaultResult.stderr || defaultResult.stdout);
  assert.equal(defaultResult.stdout, expectedDefaultVersion);

  const explicitResult = runNode(printVersion, { env: { OPL_RELEASE_VERSION: '30.1.2-test.3' } });
  assert.equal(explicitResult.status, 0, explicitResult.stderr || explicitResult.stdout);
  assert.equal(explicitResult.stdout, '30.1.2-test.3');
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
  assert.equal(adapterContract.shell_source.upstream_ref, '9a895fa4a57d18016ba8dbf7f893b22145cd7e0a');
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
  assert.equal(
    packageJson.scripts['validate:gui-shell'],
    'node --experimental-strip-types scripts/validate-active-shell.ts && node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run package',
  );
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /--cwd shells\/aionui|cd shells\/aionui/);
  assert.match(shellBuildScript, /--config\.extraMetadata\.version=\$\{version\}/);
  assert.match(shellBuildScript, /\$\{publishArg\} \$\{oplReleaseVersionConfigArg\}/);
  assert.match(shellViteConfig, /const appReleaseVersion = injectedOplReleaseVersion \|\| rootPackageJson\.version/);
  assert.match(shellViteConfig, /__APP_VERSION__:\s*JSON\.stringify\(appReleaseVersion\)/);
});

test('active shell adapter keeps GUI authority and replacement gates in the App repo', () => {
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));

  assert.equal(adapterContract.gui_authority.source_of_truth, 'one-person-lab-app');
  assert.equal(adapterContract.gui_authority.implementation_role, 'active_shell_implementation_carrier');
  for (const contractRef of [
    'contracts/app-gui-product-contract.json',
    'contracts/app-product-profile.json',
    'contracts/app-install-exposure-policy.json',
    'contracts/app-page-state-matrix.json',
    'contracts/app-first-run-test-matrix.json',
    'contracts/app-release-channel.json',
  ]) {
    assert.ok(adapterContract.gui_authority.product_contracts.includes(contractRef), contractRef);
  }
  assert.deepEqual(adapterContract.gui_authority.shell_may_own, [
    'concrete renderer implementation',
    'process and preload implementation',
    'shell package metadata',
    'shell tests and release hooks',
    'upstream AionUI intake',
    'shell-local implementation details',
    'shell-local tests that prove App contracts are implemented',
  ]);
  assert.deepEqual(adapterContract.gui_authority.shell_must_not_own, [
    'App GUI product truth',
    'App user-facing page-state authority',
    'App model-selection policy',
    'App onboarding policy',
    'App release/user documentation authority',
    'App release gate policy',
    'OPL runtime truth',
    'domain truth',
    'provider implementation',
  ]);
  assert.equal(
    adapterContract.gui_authority.upstream_intake_policy,
    'check_against_app_owned_gui_contracts_before_acceptance',
  );
  assert.equal(adapterContract.gui_product_contract, 'contracts/app-gui-product-contract.json');
  assert.deepEqual(adapterContract.gui_product_contract_policy, {
    must_implement: true,
    source_of_truth: 'one-person-lab-app',
    upstream_override_allowed: false,
    upstream_family_role: 'implementation_material_only',
    aionui_upstream_must_not_override_app_truth: true,
  });
  assert.deepEqual(adapterContract.state_surface_contract, {
    primary_read_command: 'opl app state --profile fast --json',
    refresh_read_command: 'opl app state --profile fast --json',
    full_state_read_command: 'opl app state --profile full --json',
    full_state_policy: 'diagnostic_or_release_evidence_only',
    action_command: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
    full_drilldown_exception: 'opl runtime app-operator-drilldown --detail full --json',
    forbidden_gui_truth_sources: [
      'direct opl modules --json page aggregation',
      'direct opl system developer-supervisor page aggregation',
      'direct opl family-runtime worker status page aggregation',
      'application.systemInfo as OPL path truth',
      'application.appVersions as OPL release truth',
      'direct reads of OPL internal state files',
    ],
  });
  for (const capability of [
    'app_owned_gui_product_contract',
    'opl_app_state_bridge',
    'opl_app_action_bridge',
    'app_gui_release_channel_gating',
  ]) {
    assert.ok(adapterContract.shell_contract.capabilities.includes(capability), capability);
  }
  assert.ok(!('docker_webui_contract' in adapterContract));

  assert.equal(adapterContract.shell_replacement_policy.candidate_root_pattern, 'shells/<candidate>');
  assert.equal(
    adapterContract.shell_replacement_policy.candidate_state,
    'candidate_until_contracts_and_tests_complete',
  );
  assert.equal(adapterContract.shell_replacement_policy.authority_transfer_allowed, false);
  for (const gate of [
    'declare candidate in contracts/app-shell-candidates.json',
    'implement contracts/app-gui-product-contract.json',
    'sync App product profile into the candidate shell target',
    'pass App page-state and first-run matrices',
    'pass App-root active shell validation',
    'pass GUI package compile through App wrapper',
    'preserve external checkout history policy',
  ]) {
    assert.ok(adapterContract.shell_replacement_policy.adoption_gate.includes(gate), gate);
  }
  assert.ok(
    !adapterContract.shell_replacement_policy.adoption_gate.includes('declare candidate in contracts/app-shell-adapter.json'),
  );
});

test('App shell candidates are isolated from active AionUI release shell', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));
  const candidateRegistry = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-candidates.json'), 'utf8'),
  );
  const aguiCandidate = candidateRegistry.candidates.find((candidate) => candidate.id === 'agui-codex');

  assert.equal(packageJson.scripts['validate:shell-candidates'], 'node --experimental-strip-types scripts/validate-shell-candidates.ts');
  assert.equal(candidateRegistry.owner, 'one-person-lab-app');
  assert.equal(candidateRegistry.purpose, 'app_shell_candidate_registry');
  assert.equal(candidateRegistry.state, 'active_experimental');
  assert.equal(candidateRegistry.active_shell_unchanged, adapterContract.active_shell);
  assert.equal(candidateRegistry.release_shell_contract, 'contracts/app-shell-adapter.json');
  assert.equal(candidateRegistry.candidate_policy.release_participation_until_adopted, 'explicit_candidate_build_only');
  assert.equal(candidateRegistry.candidate_policy.release_scripts_must_use_active_shell_adapter, true);
  assert.equal(candidateRegistry.candidate_policy.authority_transfer_allowed, false);
  assert.ok(candidateRegistry.candidate_policy.adoption_gate.includes('candidate is declared in contracts/app-shell-candidates.json'));
  assert.ok(
    candidateRegistry.candidate_policy.adoption_gate.includes(
      'contracts/app-shell-adapter.json is changed only when candidate becomes active release shell',
    ),
  );
  assert.ok(aguiCandidate);
  assert.equal(aguiCandidate.state, 'technical_verification');
  assert.equal(aguiCandidate.candidate_root, 'shells/agui-codex');
  assert.equal(aguiCandidate.adapter_contract, 'contracts/shell-adapters/agui-codex.json');
  assert.equal(aguiCandidate.source_topology, 'external_checkout_linked_shell_repo');
  assert.equal(aguiCandidate.release_participation, 'selectable_for_explicit_candidate_build');
  assert.equal(aguiCandidate.target_product_shape.codex_cli_fixed_executor, true);
  assert.equal(aguiCandidate.target_product_shape.home_executor_selector_visible, false);
  assert.equal(aguiCandidate.target_product_shape.home_backend_selector_visible, false);
  assert.equal(aguiCandidate.target_product_shape.home_model_selector_visible, false);
  assert.equal(aguiCandidate.target_product_shape.permission_mode_selector_visible, false);
  assert.deepEqual(aguiCandidate.target_product_shape.purpose_entries, ['research', 'grant', 'ppt']);
  assert.equal(aguiCandidate.framework_surfaces.state, 'opl app state --profile fast --json');
  assert.equal(
    aguiCandidate.framework_surfaces.action,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  );
  assert.ok(aguiCandidate.required_capabilities.includes('agui_event_contract_map'));
  assert.ok(aguiCandidate.required_capabilities.includes('release_isolation'));
  assert.ok(aguiCandidate.required_capabilities.includes('candidate_app_bundle_package'));
  assert.ok(aguiCandidate.validation_commands.some((entry) => (
    entry.id === 'candidate_app_bundle_build'
    && /OPL_APP_SHELL_ADAPTER_CONTRACT=contracts\/shell-adapters\/agui-codex\.json npm run package/.test(entry.command)
  )));
  assert.ok(aguiCandidate.must_not_own.includes('App GUI product truth'));
  assert.ok(aguiCandidate.must_not_own.includes('OPL runtime truth'));
  assert.ok(aguiCandidate.must_not_own.includes('domain truth'));
  assert.ok(aguiCandidate.non_goals.includes('do not switch active_shell away from aionui'));
  assert.ok(aguiCandidate.non_goals.includes('do not enter default stable or nightly release packaging'));
});

test('explicit AG-UI/Codex adapter contract selects linked external candidate shell', () => {
  const result = runNode(
    [
      '-e',
      "import('./scripts/app-shell-adapter.ts').then(({ resolveActiveShellPaths }) => { const shell = resolveActiveShellPaths(); console.log(JSON.stringify({ active_shell: shell.contract.active_shell, shell_root: shell.contract.shell_root, shell_root_for_display: shell.shellRootForDisplay, product_profile_target: shell.productProfileTargetPath, release_role: shell.contract.release_role })); })",
    ],
    {
      env: {
        OPL_APP_SHELL_ADAPTER_CONTRACT: 'contracts/shell-adapters/agui-codex.json',
        OPL_APP_SHELL_ROOT: '',
      },
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const resolved = JSON.parse(result.stdout);
  assert.equal(resolved.active_shell, 'agui-codex');
  assert.equal(resolved.shell_root, 'shells/agui-codex');
  assert.equal(resolved.shell_root_for_display, 'shells/agui-codex');
  assert.match(resolved.product_profile_target, /shells\/agui-codex\/src\/generated\/oplProductProfile\.generated\.json$/);
  assert.equal(resolved.release_role, 'experimental_candidate_shell');
});

test('AG-UI/Codex candidate package validation requires a real app bundle manifest', () => {
  const source = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-shell-candidates.ts'), 'utf8');
  const candidateAdapter = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'shell-adapters', 'agui-codex.json'), 'utf8'),
  );

  assert.equal(candidateAdapter.shell_contract.layout_id, 'agui_codex_app_bundle');
  assert.ok(candidateAdapter.shell_contract.capabilities.includes('candidate_app_bundle_package'));
  assert.ok(candidateAdapter.validation_commands.some((entry) => entry.id === 'candidate_app_bundle_build'));
  assert.match(source, /validateCandidatePackageManifest/);
  assert.match(source, /candidate_app_bundle_ready/);
  assert.match(source, /explicit_candidate_app_bundle/);
  assert.match(source, /\.endsWith\('\.app'\)/);
  assert.match(source, /assertDirectory\(appBundleRoot/);
  assert.match(source, /Contents', 'Info\.plist'/);
  assert.match(source, /Contents', 'MacOS'/);
  assert.match(source, /findMacAppExecutable/);
  assert.match(source, /assertNoAbsoluteSymlinks/);
  assert.match(source, /App-owned product profile input/);
  assert.doesNotMatch(JSON.stringify(candidateAdapter), /candidate_package_smoke|candidate_package_smoke_ready|\.txt/);
});

test('default shell adapter remains stable AionUI when no candidate adapter is selected', () => {
  const result = runNode([
    '-e',
    "import('./scripts/app-shell-adapter.ts').then(({ resolveActiveShellPaths }) => { const shell = resolveActiveShellPaths(); console.log(JSON.stringify({ active_shell: shell.contract.active_shell, shell_root: shell.contract.shell_root, release_role: shell.contract.release_role })); })",
  ], { env: { OPL_APP_SHELL_ADAPTER_CONTRACT: '' } });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const resolved = JSON.parse(result.stdout);
  assert.equal(resolved.active_shell, 'aionui');
  assert.equal(resolved.shell_root, 'shells/aionui');
  assert.equal(resolved.release_role, 'stable_app_shell');
});

test('App GUI product contract owns GUI requirements and unified OPL state/action boundaries', () => {
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.equal(guiContract.owner, 'one-person-lab-app');
  assert.equal(guiContract.purpose, 'app_owned_gui_product_contract');
  assert.equal(guiContract.product_authority.source_of_truth, 'one-person-lab-app');
  assert.equal(guiContract.product_authority.active_shell_role, 'implementation_carrier');
  assert.equal(guiContract.product_authority.upstream_gui_role, 'implementation_material_only');
  assert.equal(
    guiContract.product_authority.upstream_behavior_acceptance_policy,
    'must_match_app_owned_gui_product_contract_before_release',
  );
  assert.equal(guiContract.framework_surfaces.canonical_state.default_command, 'opl app state --profile fast --json');
  assert.equal(guiContract.framework_surfaces.canonical_state.refresh_command, 'opl app state --profile fast --json');
  assert.equal(guiContract.framework_surfaces.canonical_state.default_profile, 'fast');
  assert.equal(guiContract.framework_surfaces.canonical_state.manual_refresh_profile, 'fast');
  assert.equal(guiContract.framework_surfaces.canonical_state.full_profile_policy, 'diagnostic_or_release_evidence_only');
  assert.equal(
    guiContract.framework_surfaces.canonical_action.command,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  );
  assert.equal(
    guiContract.framework_surfaces.runtime_full_drilldown.command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(guiContract.framework_surfaces.runtime_full_drilldown.policy, 'on_demand_only');
  assert.equal(guiContract.executor_policy.default_executor, 'codex_cli');
  assert.equal(guiContract.executor_policy.codex_cli_fixed_executor, true);
  assert.equal(guiContract.executor_policy.codex_only_default, true);
  assert.equal(guiContract.executor_policy.home_executor_selector_visible, false);
  assert.equal(guiContract.executor_policy.executor_tab_visible_when_single_executor, false);
  assert.equal(guiContract.executor_policy.default_model_strategy, 'codex_cli_auto_latest_available_frontier');
  assert.equal(guiContract.executor_policy.home_model_status_label, '自动');
  assert.equal(guiContract.executor_policy.precise_model_display_policy, 'technical_details_or_connected_state_only');
  assert.equal(guiContract.executor_policy.permission_mode_selector_visible_on_home, false);
  assert.equal(guiContract.executor_policy.model_selector_visible_on_new_conversation, false);
  assert.equal(guiContract.executor_policy.model_selector_visible_in_conversation, false);
  assert.equal(guiContract.executor_policy.backend_selector_visible_in_conversation, false);
  assert.equal(guiContract.executor_policy.permission_mode_selector_visible_in_conversation, false);
  assert.equal(guiContract.executor_policy.user_model_override_allowed, false);
  assert.equal(guiContract.executor_policy.restore_auto_model_selection_allowed, false);
  assert.deepEqual(guiContract.executor_policy.frontier_model_preference_order, [
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.3-codex',
    'gpt-5.2',
  ]);
  assert.deepEqual(guiContract.default_assistants.map((assistant) => assistant.id), ['mas', 'mag', 'rca']);
  assert.ok(guiContract.default_assistants.every((assistant) => assistant.home_entry_policy === 'purpose_entry_target'));
  assert.deepEqual(guiContract.assistant_skill_profiles.map((profile) => profile.assistant_id), ['mas', 'mag', 'rca']);
  assert.deepEqual(
    Object.fromEntries(guiContract.assistant_skill_profiles.map((profile) => [profile.assistant_id, profile.required_skills])),
    { mas: ['mas'], mag: ['mag'], rca: ['rca'] },
  );
  assert.ok(
    guiContract.assistant_skill_profiles.every(
      (profile) => profile.skill_menu_policy === 'assistant_scoped_required_checked_optional_visible',
    ),
  );
  assert.ok(guiContract.assistant_skill_profiles.every((profile) => !profile.optional_skills.includes('morph-ppt')));
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.scope, 'home_purpose_entry_to_conversation');
  assert.deepEqual(guiContract.builtin_assistant_route_receipt_policy.required_for_assistants, ['mas', 'mag', 'rca']);
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.route_kind, 'builtin_capability');
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.executor, 'codex_cli');
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.source, 'opl_app_home');
  assert.deepEqual(guiContract.builtin_assistant_route_receipt_policy.required_fields, [
    'route_kind',
    'executor',
    'assistant_id',
    'assistant_short_name',
    'source',
  ]);
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.must_not_depend_on_visible_backend_selection, true);
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.id), ['research', 'grant', 'ppt']);
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.primary_label), ['科研', '基金', 'PPT']);
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.target_assistant_id), ['mas', 'mag', 'rca']);
  assert.ok(guiContract.home_purpose_entries.every((entry) => entry.display_policy === 'purpose_first'));
  assert.equal(guiContract.non_default_assistants.find((assistant) => assistant.id === 'oma').home_default_visible, false);
  assert.equal(guiContract.retired_domain_agents.find((agent) => agent.id === 'mds').default_display_allowed, false);
  assert.equal(guiContract.pages.guid_home.hero_prompt, '把研究、基金和汇报交给 One Person Lab 自动推进');
  assert.ok(guiContract.pages.settings_system.must_show.includes('OPL Agent Codex context'));
  assert.deepEqual(guiContract.settings_navigation.ordinary_visible_tabs, [
    'overview',
    'runtime',
    'capabilities',
    'access',
    'appearance',
    'system',
    'about',
  ]);
  assert.deepEqual(guiContract.settings_navigation.legacy_route_redirects, {
    model: 'runtime',
    agent: 'runtime',
    assistants: 'capabilities',
    'skills-hub': 'capabilities',
    tools: 'capabilities',
    display: 'appearance',
    webui: 'access',
    pet: 'appearance',
  });
  assert.deepEqual(guiContract.settings_navigation.ordinary_hidden_legacy_tabs, [
    'model',
    'agent',
    'assistants',
    'skills-hub',
    'tools',
    'display',
    'webui',
    'pet',
  ]);
  assert.deepEqual(guiContract.settings_navigation.required_sections, ['system', 'runtime', 'about', 'update', 'theme']);
  assert.equal(guiContract.settings_navigation.source, 'opl app state --profile fast --json');
  assert.equal(guiContract.settings_navigation.refresh_source, 'opl app state --profile fast --json');
  assert.equal(
    guiContract.module_path_source_policy.source,
    'app_state.modules[].source + app_state.modules[].path + app_state.paths',
  );
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from the bundled Full runtime payload'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from a local domain repository checkout'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module is managed by App/CLI maintenance'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('that module path display is refs-only and not domain truth authority'));
  assert.equal(guiContract.pages.settings_runtime.module_path_source_policy_ref, 'module_path_source_policy');
  assert.ok(guiContract.pages.settings_runtime.must_show.includes('module path source explanation'));
  assert.ok(guiContract.pages.settings_runtime.must_not_show.includes('Med Deep Scientist as a default module'));
  assert.ok(guiContract.pages.about.must_show.includes('OPL Framework revision'));
  assert.equal(guiContract.theme_and_branding.default_theme_id, 'default-theme');
  assert.deepEqual(guiContract.theme_and_branding.allowed_theme_ids, ['default-theme', 'codex']);
  assert.ok(guiContract.pages.settings_theme.must_show.includes('Default theme option'));
  assert.ok(guiContract.pages.settings_theme.must_show.includes('Codex theme option'));
  assert.deepEqual(
    guiContract.release_channel_policy.stable.must_gate,
    releaseContract.release_validation_profiles.stable.required_lanes,
  );
  assert.deepEqual(
    guiContract.release_channel_policy.nightly.must_gate,
    releaseContract.release_validation_profiles.nightly_standard.required_lanes,
  );
  assert.deepEqual(
    guiContract.release_channel_policy.nightly.must_not_gate,
    releaseContract.release_validation_profiles.nightly_standard.forbidden_lanes,
  );
  assert.ok(!('docker_webui' in guiContract));
  assert.doesNotMatch(JSON.stringify(guiContract), /username input gate|must_skip_username_input|manifest_name|logo_policy/);
});

test('App fallow hygiene is not the active GUI shell validation gate', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const fallowConfig = JSON.parse(fs.readFileSync(path.join(appRoot, '.fallowrc.json'), 'utf8'));
  const testingDocs = fs.readFileSync(path.join(appRoot, 'docs', 'testing', 'README.md'), 'utf8');
  const scriptsDocs = fs.readFileSync(path.join(appRoot, 'scripts', 'README.md'), 'utf8');
  const combinedDocs = `${testingDocs}\n${scriptsDocs}`;

  assert.deepEqual(fallowConfig.ignorePatterns, ['shells/aionui/**', 'shells/agui-codex/**']);
  assert.equal(packageJson.scripts['hygiene:fallow'], 'npx --yes fallow@latest --root . --no-cache --production');
  assert.match(packageJson.scripts['validate:gui-shell'], /validate-active-shell\.ts/);
  assert.match(packageJson.scripts['validate:gui-shell'], /run-active-shell-command\.ts bun run package/);
  assert.match(combinedDocs, /hygiene:fallow[\s\S]*not GUI shell build or runtime evidence/i);
  assert.match(combinedDocs, /validate:gui-shell[\s\S]*active shell[\s\S]*GUI compile/i);
});

test('active shell validation exposes opt-in live OPL conformance without making it default', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const runtimeBridge = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-runtime-bridge.json'), 'utf8'),
  );
  const testingDocs = fs.readFileSync(path.join(appRoot, 'docs', 'testing', 'README.md'), 'utf8');
  const architectureDocs = fs.readFileSync(path.join(appRoot, 'docs', 'architecture.md'), 'utf8');
  const combinedDocs = `${testingDocs}\n${architectureDocs}`;

  assert.equal(packageJson.scripts['validate:active-shell'], 'node --experimental-strip-types scripts/validate-active-shell.ts');
  assert.equal(runtimeBridge.live_conformance_gate.mode, 'explicit_env_opt_in');
  assert.equal(runtimeBridge.live_conformance_gate.default_enforcement, 'disabled');
  assert.equal(runtimeBridge.live_conformance_gate.opl_bin, './bin/opl');
  assert.equal(runtimeBridge.live_conformance_gate.fast_state_command, './bin/opl app state --profile fast --json');
  assert.equal(runtimeBridge.live_conformance_gate.full_state_command, './bin/opl app state --profile full --json');
  assert.equal(
    runtimeBridge.live_conformance_gate.action_dry_run_command,
    './bin/opl app action execute --action <fixture> --dry-run --json',
  );
  assert.equal(runtimeBridge.live_conformance_gate.fast_state_max_bytes, 500000);
  assert.equal(
    runtimeBridge.live_conformance_gate.golden_fast_state_fixture,
    'contracts/fixtures/opl-app-state-fast.fixture.json',
  );
  assert.deepEqual(runtimeBridge.live_conformance_gate.state_schema_paths, [
    'app_state.schema_version',
    'app_state.surface_kind',
    'app_state.schema',
    'app_state.surface',
    'schema',
    'surface',
  ]);
  assert.match(combinedDocs, /OPL_APP_LIVE_CONFORMANCE=1[\s\S]*OPL_APP_LIVE_OPL_ROOT/i);
  assert.match(combinedDocs, /fast[\s\S]*500KB[\s\S]*opl_app_state\.v1/i);
  const fixture = JSON.parse(
    fs.readFileSync(path.join(appRoot, runtimeBridge.live_conformance_gate.golden_fast_state_fixture), 'utf8'),
  );
  assert.equal(fixture.app_state.surface_kind, 'opl_app_state.v1');
  assert.equal(fixture.app_state.operator.workbench.view_model_schema, 'opl_app_operator_workbench.v1');
  assert.equal(
    fixture.app_state.operator.workbench.performance_policy.shell_must_not_derive_layout_from_raw_runtime_projection,
    true,
  );

  const defaultResult = runNode(['scripts/validate-active-shell.ts', '--quick'], {
    env: {
      OPL_APP_LIVE_CONFORMANCE: '',
      OPL_APP_LIVE_OPL_ROOT: '',
      OPL_APP_LIVE_ACTION_FIXTURE: '',
    },
  });
  assert.equal(defaultResult.status, 0, defaultResult.stderr || defaultResult.stdout);

  const enabledWithoutRoot = runNode(['scripts/validate-active-shell.ts', '--quick'], {
    env: {
      OPL_APP_LIVE_CONFORMANCE: '1',
      OPL_APP_LIVE_OPL_ROOT: '',
      OPL_APP_LIVE_ACTION_FIXTURE: 'fixture',
    },
  });
  assert.notEqual(enabledWithoutRoot.status, 0);
  assert.match(enabledWithoutRoot.stderr, /Set OPL_APP_LIVE_OPL_ROOT/);
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
  assert.match(workflow, /publish_to_release: false/);
  assert.match(workflow, /publish-full-assets:/);
  assert.match(workflow, /--full-package-dir full-package-artifacts/);
  assert.match(workflow, /remote-verify-full:[\s\S]*needs: publish-full-assets/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-full:[\s\S]*needs: publish-standard/);
  assert.match(workflow, /run_vm_smoke:/);
  assert.match(workflow, /default: true/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-standard-only:/);
  assert.match(workflow, /standard-first-run-vm-smoke-after-full:/);
  assert.match(workflow, /full-first-run-vm-smoke:/);
  assert.match(workflow, /one-shot-app-installer-smoke:/);
  assert.match(workflow, /docker-webui-smoke:/);
  assert.match(workflow, /OPL_INSTALL_SCRIPT_URL: file:\/\/\$\{\{ github\.workspace \}\}\/one-person-lab\/install\.sh/);
  assert.match(workflow, /\.\/install\.sh --complete --skip-modules/);
  assert.match(workflow, /docker build -t "one-person-lab-webui:\$\{\{ inputs\.opl_version \}\}" shells\/aionui/);
  assert.match(workflow, /curl -fsS "http:\/\/127\.0\.0\.1:\$\{port\}\/manifest\.webmanifest"/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/opl-first-run-vm\.yml/);
  assert.match(workflow, /release_tag: v\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /release_artifact_name: macos-build-arm64/);
  assert.match(workflow, /release_artifact_name: opl-full-first-install-\$\{\{ inputs\.opl_version \}\}-mac-arm64/);
  assert.match(workflow, /package_profile: standard/);
  assert.match(workflow, /package_profile: full/);
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
  assert.match(vmWorkflow, /release_artifact_name:/);
  assert.match(vmWorkflow, /actions\/download-artifact@v7/);
  assert.match(vmWorkflow, /Using same-run workflow artifact/);
  assert.match(vmWorkflow, /release tag \$\{\{ inputs\.release_tag \}\} kept for provenance/);
  assert.match(vmWorkflow, /Resolve host Node\.js runtime for guest smoke/);
  assert.match(vmWorkflow, /--guest-node-root "\$\{\{ steps\.host_node\.outputs\.node_root \}\}"/);
  assert.match(vmWorkflow, /schedule:/);
  assert.match(vmWorkflow, /concurrency:/);
  assert.match(vmWorkflow, /github\.event_name == 'schedule'/);
  assert.match(vmWorkflow, /opl-gui-first-run-vm-scheduled/);
  assert.match(vmWorkflow, /opl-gui-first-run-vm-manual/);
  assert.match(vmWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'schedule' \}\}/);
  assert.match(vmWorkflow, /Resolve Tart source VM/);
  assert.match(vmWorkflow, /package_profile:/);
  assert.match(vmWorkflow, /Resolve package profile/);
  assert.match(vmWorkflow, /Set workflow input tart_source_vm or repository variable OPL_FIRST_RUN_TART_SOURCE/);
  assert.match(vmWorkflow, /source_vm=\$SOURCE_VM/);
  assert.doesNotMatch(vmWorkflow, /skip_smoke=true/);
  assert.doesNotMatch(vmWorkflow, /steps\.scheduled_config\.outputs\.skip_smoke != 'true'/);
  assert.match(vmWorkflow, /One-Person-Lab-Full-\*-mac-arm64\.dmg/);
  assert.match(vmWorkflow, /One-Person-Lab-\*-mac-arm64\.dmg/);
  assert.match(vmWorkflow, /!\s+-name 'One-Person-Lab-Full-\*'/);
  assert.match(vmWorkflow, /find artifacts\/release -type f -name 'One-Person-Lab-\*-mac-arm64\.dmg'/);
  assert.match(vmWorkflow, /--smoke-profile no-clt-clean-vm/);
  assert.match(vmWorkflow, /--display 1920x1080px/);
  assert.match(vmWorkflow, /--settings-smoke/);
  assert.match(vmWorkflow, /Write first-run VM preflight summary/);
  assert.match(vmWorkflow, /deterministic release-blocking clean VM first launch/);
  assert.match(vmWorkflow, /--runtime-profile "\$\{\{ steps\.package_profile\.outputs\.runtime_profile \}\}"/);
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
    releaseContract.release_acceleration.vm_gates.map((gate) => gate.id),
    ['standard_dmg_clean_vm_smoke', 'full_dmg_clean_vm_smoke'],
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
      'full_runtime_cache_events',
      'full_manifest_distribution_boundary',
      'full_manifest_size_budget',
      'full_release_asset_size_budget',
      'full_runtime_uncompressed_size_budget',
      'full_readme_english_only',
    ],
  );
});

test('Nightly release workflow publishes standard-only semver prereleases', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'nightly-standard-release.yml'), 'utf8');
  const boundaryScript = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-release-boundary.ts'), 'utf8');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );

  assert.match(workflow, /name: OPL Nightly Standard Release/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: '17 18 \* \* \*'/);
  assert.match(workflow, /group: opl-nightly-standard-release/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /version="\$\(date -u \+'%y\.%-m\.%-d'\)-nightly"/);
  assert.match(workflow, /tag="v\$\{version\}"/);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/_build-reusable\.yml/);
  assert.match(workflow, /opl_release_version: \$\{\{ needs\.resolve-nightly\.outputs\.version \}\}/);
  assert.match(workflow, /node --experimental-strip-types scripts\/prepare-release-assets\.ts build-artifacts release-assets/);
  assert.match(workflow, /node --experimental-strip-types scripts\/validate-release\.ts release-assets/);
  assert.match(workflow, /gh release create "\$\{OPL_RELEASE_TAG\}"[\s\S]*--prerelease[\s\S]*--latest=false[\s\S]*--verify-tag/);
  assert.match(workflow, /gh release edit "\$\{OPL_RELEASE_TAG\}"[\s\S]*--prerelease/);
  assert.match(workflow, /--title "\$\{OPL_RELEASE_TAG\}"/);
  assert.match(workflow, /gh release upload "\$\{OPL_RELEASE_TAG\}" release-assets\/\*/);
  assert.match(workflow, /npm run verify-remote-release/);
  assert.doesNotMatch(workflow, /full-first-install-release\.yml/);
  assert.doesNotMatch(workflow, /include_full_package/);
  assert.doesNotMatch(workflow, /One-Person-Lab-Full/);
  assert.doesNotMatch(workflow, /nightly\.\$\{stamp\}/);
  assert.doesNotMatch(workflow, /One Person Lab Nightly \$\{OPL_RELEASE_VERSION\}/);
  assert.match(boundaryScript, /nightly_standard_release_workflow/);
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

test('stable validation profile covers every user installation surface', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const firstRunMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const releaseDocs = fs.readFileSync(path.join(appRoot, 'docs', 'release', 'README.md'), 'utf8');
  const testingDocs = fs.readFileSync(path.join(appRoot, 'docs', 'testing', 'README.md'), 'utf8');
  const scriptsDocs = fs.readFileSync(path.join(appRoot, 'scripts', 'README.md'), 'utf8');
  const combinedDocs = `${releaseDocs}\n${testingDocs}\n${scriptsDocs}`;
  const scenarioIds = firstRunMatrix.scenarios.map((scenario) => scenario.id);
  const stable = releaseContract.release_validation_profiles.stable;

  assert.deepEqual(stable.required_installation_surfaces, [
    'standard_dmg_clean_vm_smoke',
    'full_dmg_clean_vm_smoke',
    'one_shot_app_installer_fresh_install_smoke',
    'docker_webui_smoke',
  ]);
  assert.ok(stable.required_lanes.includes('docker_webui_smoke'));
  assert.deepEqual(
    firstRunMatrix.scenarios.find((scenario) => scenario.id === 'docker_webui_smoke'),
    {
      id: 'docker_webui_smoke',
      package_type: 'docker_webui',
      release_gate: true,
      command: 'docker build -t one-person-lab-webui:<version> shells/aionui && docker run -p 127.0.0.1::<container_port> one-person-lab-webui:<version>',
      expects: [
        'Docker image builds from the active AionUI shell Dockerfile',
        'WebUI container starts on port 3000',
        'HTTP / returns 200',
        'HTTP /manifest.webmanifest returns 200',
      ],
    },
  );
  assert.ok(stable.required_lanes.includes('operator_evidence_bundle'));
  for (const scenarioId of stable.required_installation_surfaces) {
    assert.ok(scenarioIds.includes(scenarioId), scenarioId);
  }
  assert.match(combinedDocs, /Nightly[\s\S]*standard[\s\S]*remote/i);
  assert.match(combinedDocs, /Stable[\s\S]*standard DMG[\s\S]*Full DMG[\s\S]*one-shot[\s\S]*Docker\/WebUI/i);
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

test('release CI operations policy distinguishes workflow hygiene from release evidence', () => {
  const testingDocs = fs.readFileSync(path.join(appRoot, 'docs', 'testing', 'README.md'), 'utf8');
  const scriptsDocs = fs.readFileSync(path.join(appRoot, 'scripts', 'README.md'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const vmWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'opl-first-run-vm.yml'), 'utf8');
  const workflowActionsDir = path.join(appRoot, '.github', 'actions');
  const combinedDocs = `${testingDocs}\n${scriptsDocs}`;

  assert.match(combinedDocs, /actionlint[\s\S]*(workflow semantic gate|workflow semantic gate in the reusable build quality jobs)/i);
  assert.match(combinedDocs, /YAML parsing[\s\S]*syntax check|YAML parsing[\s\S]*only proves syntax/i);
  assert.ok(
    !Object.values(packageJson.scripts).some((script) => String(script).includes('actionlint')),
    'actionlint is a CI gate, not an App-root package script',
  );

  assert.match(vmWorkflow, /concurrency:[\s\S]*opl-gui-first-run-vm-scheduled[\s\S]*opl-gui-first-run-vm-manual/);
  assert.match(vmWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'schedule' \}\}/);
  assert.match(combinedDocs, /concurrency[\s\S]*duplicate-run governance/i);
  assert.match(combinedDocs, /not release evidence|not as proof/i);

  assert.match(combinedDocs, /Machine-readable release telemetry[\s\S]*JSON artifact|Machine-readable telemetry[\s\S]*JSON artifact/i);
  assert.match(combinedDocs, /after-release tuning|post-release tuning/i);
  assert.match(combinedDocs, /does not replace[\s\S]*(manifests|manifest)[\s\S]*SHA256SUMS[\s\S]*remote verification[\s\S]*VM/i);
  assert.match(combinedDocs, /same-run workflow artifact[\s\S]*draft/i);
  assert.match(combinedDocs, /release tag[\s\S]*provenance/i);

  assert.equal(fs.existsSync(path.join(workflowActionsDir, 'setup-active-shell-deps', 'action.yml')), true);
  assert.match(combinedDocs, /Composite\/setup[\s\S]*(checked-in composite action|checked in)/i);
  assert.match(combinedDocs, /\.github\/actions\/setup-active-shell-deps/i);
});

test('Full first-install workflow has one MinerU checkout and keeps standalone binary build path', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');

  assert.match(workflow, /npm view @openai\/codex version/);
  assert.match(workflow, /npm install -g "@openai\/codex@\$\{codex_latest\}"/);
  assert.match(workflow, /echo "OPL_FULL_CODEX_VERSION=\$codex_latest" >> "\$GITHUB_ENV"/);
  assert.match(workflow, /\[\[ "\$codex_version" == "codex-cli \$codex_latest" \]\]/);
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
  assert.match(workflow, /name:\s+opl-full-diagnostics-\$\{\{ env\.OPL_RELEASE_VERSION \}\}/);
  assert.match(workflow, /Upload Full diagnostics artifact[\s\S]*full-package-build-timing\.json[\s\S]*full-package-manifest\.json[\s\S]*runtime-cache-events\.json[\s\S]*SHA256SUMS\.txt/);
  assert.match(workflow, /upload_full_package_artifact:[\s\S]*default:\s+true/);
  assert.match(workflow, /Upload Full package workflow artifact[\s\S]*if:\s+\$\{\{ inputs\.upload_full_package_artifact \}\}/);
  assert.match(workflow, /bash "\$GITHUB_WORKSPACE\/OfficeCLI\/install\.sh"/);
  assert.doesNotMatch(workflow, /raw\.githubusercontent\.com\/iOfficeAI\/OfficeCLI\/main\/install\.sh/);
  const warmupWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-runtime-cache-warmup.yml'), 'utf8');
  assert.match(warmupWorkflow, /upload_full_package_artifact:\s+false/);
  assert.match(workflow, /node -e 'const fs = require\("node:fs"\); const report = JSON\.parse\(fs\.readFileSync\(process\.argv\[1\], "utf8"\)\);/);
  assert.doesNotMatch(
    workflow,
    /runtime-cache-events\.json[\s\S]{0,400}<<'NODE'[\s\S]{0,400}NODE/,
    'runtime-cache-events summary must not use a nested heredoc; indented heredoc delimiters break bash on GitHub Actions',
  );
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
    '530MB warning threshold',
    'miss_written',
    'release:full:size',
    '.codegraph',
    'runtime-state',
    'domain repositories',
    'domain repository',
  ]) {
    assert.match(combinedDocs, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }

  assert.match(releaseDocs, /Full size policy/i);
  assert.match(releaseDocs, /compressed DMG size/i);
  assert.match(releaseDocs, /uncompressed runtime size/i);
  assert.match(releaseDocs, /layer breakdown/i);
  assert.match(releaseDocs, /remote verifier size budget/i);
  assert.match(releaseDocs, /Full runtime packaging follows a hygiene-first policy/i);
  assert.match(releaseDocs, /Any narrower runtime allowlist must be declared by the owning domain repository/i);
  assert.match(scriptsDocs, /verify-remote-release-assets\.ts[\s\S]*remote verifier size budget/i);
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
        warning_full_dmg_bytes: 530000000,
        max_full_dmg_bytes: 550000000,
        max_runtime_uncompressed_bytes: 1000,
      },
      size_breakdown: {
        total_runtime_uncompressed_bytes: 500,
        layers: {
          toolchain: { size_bytes: 200 },
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
  assert.equal(summary.warning_full_dmg_bytes, 530000000);
  assert.equal(summary.max_full_dmg_bytes, 550000000);
  assert.equal(summary.runtime_budget_used_percent, 50);
  assert.equal(summary.components[0].id, 'mas');
  assert.equal(summary.layers[0].id, 'toolchain');

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
  assert.match(markdownResult.stdout, /Full DMG warning threshold: 505\.4 MiB/);
  assert.match(markdownResult.stdout, /Full DMG hard budget: 524\.5 MiB/);
  assert.match(markdownResult.stdout, /Runtime budget: 1000 B \(50% used\)/);
  assert.match(markdownResult.stdout, /\| mas \| 180 B \| 36% \|/);
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
    warning_full_dmg_bytes: 530000000,
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
  assert.deepEqual(releaseContract.full_first_install.required_payloads.codex_cli, {
    version_source: 'npm view @openai/codex version',
    install_rule: 'install_exact_latest_npm_version',
    receipt_env: 'OPL_FULL_CODEX_VERSION',
    runtime_path: 'runtime/current/bin/codex',
    verification: 'codex --version must equal codex-cli <npm_latest>',
  });
  assert.deepEqual(releaseContract.full_first_install.required_payloads.temporal_runtime_provider, {
    provider_env_default: 'OPL_FAMILY_RUNTIME_PROVIDER=temporal',
    required_packages: [
      '@temporalio/activity',
      '@temporalio/client',
      '@temporalio/common',
      '@temporalio/worker',
      '@temporalio/workflow',
    ],
    forbidden_packages: ['@temporalio/testing'],
    native_core_bridge_releases: ['aarch64-apple-darwin'],
    verification: 'Full manifest runtime_assertions.temporal_core_bridge_releases must be exactly aarch64-apple-darwin',
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
  const fullWorkflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'full-first-install-release.yml'), 'utf8');
  const publishScript = fs.readFileSync(path.join(appRoot, 'scripts', 'publish-release.ts'), 'utf8');
  const prepareStandardScript = fs.readFileSync(path.join(appRoot, 'scripts', 'prepare-standard-release-payload.ts'), 'utf8');
  const electronBuilder = fs.readFileSync(path.join(activeShellRoot, 'packages', 'desktop', 'electron-builder.yml'), 'utf8');
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
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'bin', 'codex'\)/);
  assert.match(buildScript, /path\.join\(localVendorRoot, 'bin', 'codex'\)/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'codex-path', 'rg'\)/);
  assert.match(buildScript, /path\.join\(localVendorRoot, 'codex-path', 'rg'\)/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'codex', 'codex'\)/);
  assert.match(buildScript, /path\.join\(platformVendorRoot, 'path', 'rg'\)/);
  assert.match(buildScript, /function findNodeToolchain\(explicitNodeBin\)/);
  assert.match(buildScript, /npmBin: requireNodeToolchainFile\(nodeBinDir, 'npm'/);
  assert.match(buildScript, /npxBin: requireNodeToolchainFile\(nodeBinDir, 'npx'/);
  assert.match(buildScript, /npmRoot: requireNodeToolchainDirectory\(path\.join\(nodeRoot, 'lib', 'node_modules', 'npm'\)/);
  assert.match(buildScript, /copySingleFile\(sources\.nodeToolchain\.npmBin, path\.join\(layerRoot, 'node', 'bin', 'npm'\)\)/);
  assert.match(buildScript, /copySingleFile\(sources\.nodeToolchain\.npxBin, path\.join\(layerRoot, 'node', 'bin', 'npx'\)\)/);
  assert.match(buildScript, /copyTreeFiltered\(\s*sources\.nodeToolchain\.npmRoot,\s*path\.join\(layerRoot, 'node', 'lib', 'node_modules', 'npm'\)/);
  assert.match(buildScript, /npm_bin_sha256: fileSha256\(sources\.nodeToolchain\.npmBin\)/);
  assert.match(buildScript, /npx_bin_sha256: fileSha256\(sources\.nodeToolchain\.npxBin\)/);
  assert.match(buildScript, /npm_package_version: packageJsonVersion\(path\.join\(sources\.nodeToolchain\.npmRoot, 'package\.json'\)\)/);
  assert.match(buildScript, /npm_package_fingerprint: directoryFingerprint\(sources\.nodeToolchain\.npmRoot, 'node\/lib\/node_modules\/npm'\)/);
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
  assert.match(buildScript, /codex: \{ source_path: sources\.codexRoot[\s\S]*size_bytes: directorySizeBytes\(path\.join\(runtimeRoot, 'bin', 'codex'\)\)/);
});
