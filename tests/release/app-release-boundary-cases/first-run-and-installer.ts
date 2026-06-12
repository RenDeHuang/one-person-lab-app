import {
  assert,
  fs,
  path,
  test,
  appRoot,
} from './helpers.ts';

test('first-run matrix locks Full clean-machine and App-managed bootstrap rules', () => {
  const matrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const scenarioById = new Map(matrix.scenarios.map((scenario) => [scenario.id, scenario]));
  const fullClean = scenarioById.get('full_first_install_clean_machine');
  const fullDmg = scenarioById.get('full_dmg_clean_vm_smoke');

  assert.ok(matrix.scenarios.every((scenario) => !('aliases' in scenario)));
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
  assert.ok(standardClean.release_evidence_artifacts.includes('artifacts/assistant-route-smoke-summary.json'));
  assert.ok(standardClean.expects.some((entry) => /Packaged GUI route smoke selects MAS, MAG, and RCA/.test(entry)));

  assert.equal(fullDmg.release_gate, true);
  assert.equal(fullDmg.vm.runtime_profile, 'full');
  assert.ok(fullDmg.expects.some((entry) => /Full DMG reaches Core ready from the bundled runtime/.test(entry)));
  assert.ok(fullDmg.release_evidence_artifacts.includes('artifacts/system-initialize.json'));
  assert.ok(fullDmg.release_evidence_artifacts.includes('artifacts/modules.json'));

  const homebrewStandard = scenarioById.get('homebrew_standard_cask_clean_vm_smoke');
  assert.equal(homebrewStandard.release_gate, true);
  assert.equal(homebrewStandard.vm.install_mode, 'homebrew-cask');
  assert.equal(homebrewStandard.vm.homebrew_cask, 'one-person-lab');
  assert.equal(homebrewStandard.vm.homebrew_cask_install_ref, 'gaofeng21cn/one-person-lab/one-person-lab');
  assert.equal(homebrewStandard.vm.homebrew_trust_scope, 'explicit_fully_qualified_cask_ref_not_whole_tap');
  assert.ok(homebrewStandard.expects.some((entry) => /standard App DMG from gaofeng21cn\/one-person-lab-app GitHub Releases/.test(entry)));
  assert.ok(homebrewStandard.expects.some((entry) => /Homebrew receipt is treated as install evidence only/.test(entry)));
  assert.ok(homebrewStandard.expects.every((entry) => !/signed standard App DMG/.test(entry)));

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
    scope: 'desktop_app_assets_only',
    module_package_update_allowed: false,
    developer_checkout_selection_allowed: false,
    opl_flow_install_allowed: false,
  });
  assert.ok(updater.expects.includes('standard updater does not update domain module packages'));
  assert.ok(updater.expects.includes('standard updater does not select Developer Profile source_channel checkouts'));
  assert.ok(updater.expects.includes('standard updater does not install opl-flow'));

  const ecosystem = scenarioById.get('ecosystem_modules_app_cli_managed');
  assert.deepEqual(ecosystem.modules, ['officecli', 'mineru', 'opl-meta-agent']);
});

test('one-shot App installer defaults to App-first core setup', () => {
  const script = fs.readFileSync(path.join(appRoot, 'install.sh'), 'utf8');
  const stableScript = fs.readFileSync(path.join(appRoot, 'install-stable.sh'), 'utf8');

  assert.match(script, /OPL_APP_INSTALL_MODE=\$\{OPL_APP_INSTALL_MODE:-app-first\}/);
  assert.match(script, /--complete/);
  assert.match(script, /--skip-modules/);
  assert.match(script, /curl -fsSL "\$OPL_INSTALL_SCRIPT_URL" \| bash -s -- "\$\{INSTALL_ARGS\[@\]\}"/);
  assert.doesNotMatch(script, /bash -s -- "\$@"/);
  assert.doesNotMatch(script, /--free-macos-install/);
  assert.match(script, /--stable-macos-install/);
  assert.match(script, /STABLE_MACOS_PACKAGE_PROFILE=\$\{OPL_STABLE_MACOS_PACKAGE_PROFILE:-full\}/);
  assert.match(script, /resolve_latest_release_tag\(\)/);
  assert.match(script, /release_asset_name\(\)/);
  assert.match(script, /download_or_use_dmg\(\)/);
  assert.match(script, /copy_app_from_dmg\(\)/);
  assert.match(script, /stable_macos_install\(\)/);
  assert.match(script, /hdiutil attach -nobrowse -readonly/);
  assert.match(script, /ditto "\$source_app" "\$OPL_LOCAL_APP_PATH"/);
  assert.match(script, /run_with_sudo_fallback/);
  assert.match(script, /--authorize-local-app-only/);
  assert.match(script, /--authorize-local-app/);
  assert.match(script, /--app-path/);
  assert.match(script, /OPL_LOCAL_APP_PATH=\$\{OPL_LOCAL_APP_PATH:-\/Applications\/One Person Lab\.app\}/);
  assert.match(script, /Type "authorize" to continue/);
  assert.match(script, /xattr -dr com\.apple\.quarantine "\$OPL_LOCAL_APP_PATH"/);
  assert.match(script, /codesign --verify --deep --strict --verbose=2 "\$OPL_LOCAL_APP_PATH"/);
  assert.match(script, /spctl --assess --type execute --verbose=4 "\$OPL_LOCAL_APP_PATH"/);
  assert.match(script, /quarantine_before/);
  assert.match(script, /quarantine_after/);
  assert.match(script, /Stable macOS install/);
  assert.match(stableScript, /OPL_APP_INSTALLER_URL=/);
  assert.match(stableScript, /https:\/\/raw\.githubusercontent\.com\/gaofeng21cn\/one-person-lab-app\/main\/install\.sh/);
  assert.equal(fs.existsSync(path.join(appRoot, 'install-free.sh')), false);
  assert.match(stableScript, /install\.sh/);
  assert.match(stableScript, /--stable-macos-install/);
  assert.match(stableScript, /--yes/);
  assert.match(stableScript, /curl -fsSL "\$installer_url" \| bash -s -- --stable-macos-install --yes "\$@"/);
});
