import {
  assert,
  fs,
  path,
  test,
  appRoot,
} from './helpers.ts';

const assertSomeEntryMatches = (entries: string[], patterns: RegExp[]) =>
  patterns.forEach((pattern) => assert.ok(entries.some((entry) => pattern.test(entry)), pattern.source));
const assertEachMatch = (text: string, patterns: RegExp[]) =>
  patterns.forEach((pattern) => assert.match(text, pattern));

test('first-run matrix locks Full clean-machine and App-managed bootstrap rules', () => {
  const matrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const scenarioById = new Map(matrix.scenarios.map((scenario) => [scenario.id, scenario]));
  const fullClean = scenarioById.get('full_first_install_clean_machine');
  const fullDmg = scenarioById.get('full_dmg_clean_vm_smoke');
  const beginner = scenarioById.get('beginner_simplified_first_run_clean_machine');
  const standardClean = scenarioById.get('standard_dmg_clean_vm_smoke');
  const homebrewStandard = scenarioById.get('homebrew_standard_cask_clean_vm_smoke');
  const standardBootstrap = scenarioById.get('standard_app_managed_bootstrap');
  const clt = scenarioById.get('macos_clt_system_installer');
  const fullCleanBackgroundMaintenance = [
    'repo_sync',
    'module_reconcile',
    'command_line_tools_install',
    'native_helpers',
    'companion_skills_install',
    'ecosystem_module_updates',
  ];

  assert.ok(matrix.scenarios.every((scenario) => !('aliases' in scenario)));
  assert.ok(beginner.required_shell_testids.includes('opl-startup-preflight'));
  assert.ok(beginner.required_shell_testids.includes('opl-first-run-initialize-pending'));
  assert.deepEqual(fullClean.clean_machine_missing_tools, ['command_line_tools', 'homebrew', 'node', 'git']);
  assert.equal(fullClean.core_ready_source, 'bundled_runtime');
  assert.deepEqual(fullClean.background_maintenance, fullCleanBackgroundMaintenance);
  assert.deepEqual(fullClean.post_core_ready_background_policy, {
    mode: 'best_effort_non_blocking',
    continues_after_core_ready: true,
    managed_items: fullCleanBackgroundMaintenance,
  });

  assert.equal(standardClean.release_gate, true);
  assert.equal(standardClean.vm.runtime_profile, 'standard');
  assert.ok(standardClean.release_evidence_artifacts.includes('artifacts/system-initialize.json'));
  assert.ok(standardClean.release_evidence_artifacts.includes('artifacts/assistant-route-smoke-summary.json'));

  assert.equal(fullDmg.release_gate, true);
  assert.equal(fullDmg.vm.runtime_profile, 'full');
  assert.ok(fullDmg.release_evidence_artifacts.includes('artifacts/system-initialize.json'));
  assert.ok(fullDmg.release_evidence_artifacts.includes('artifacts/modules.json'));

  assert.equal(homebrewStandard.release_gate, true);
  assert.equal(homebrewStandard.vm.install_mode, 'homebrew-cask');
  assert.equal(homebrewStandard.vm.homebrew_cask, 'one-person-lab');
  assert.equal(homebrewStandard.vm.homebrew_cask_install_ref, 'gaofeng21cn/one-person-lab/one-person-lab');
  assert.deepEqual(homebrewStandard.vm.homebrew_trusted_cask_refs, [
    'gaofeng21cn/one-person-lab/one-person-lab',
    'gaofeng21cn/one-person-lab/one-person-lab-full',
    'gaofeng21cn/one-person-lab/one-person-lab-nightly',
  ]);
  assert.equal(homebrewStandard.vm.homebrew_trust_scope, 'explicit_standard_and_conflicting_cask_refs_not_whole_tap');
  assert.ok(homebrewStandard.expects.every((entry) => !/signed standard App DMG/.test(entry)));

  assert.equal(standardBootstrap.bootstrap_owner, 'app_managed');
  assert.equal(
    standardBootstrap.maintenance_resolution_policy,
    'app_or_cli_managed_best_effort_until_ready',
  );

  assert.equal(clt.command, 'xcode-select --install');

  for (const [scenario, patterns] of [
    [beginner, [/instead of a blank window/, /initialize pending state renders explicit progress copy/]],
    [fullClean, [/without requiring host CLT, Homebrew, Node, or Git/, /best-effort background maintenance after Core ready/]],
    [standardClean, [/Framework CLI when opl is missing/, /Core first-launch readiness.*opl system initialize --json/, /professional Agent Package shortcuts/, /agent_package_shortcut invocation receipts/]],
    [fullDmg, [/Full DMG reaches Core ready from the bundled runtime/]],
    [homebrewStandard, [/standard App DMG from gaofeng21cn\/one-person-lab-app GitHub Releases/, /Homebrew receipt is treated as install evidence only/]],
    [standardBootstrap, [/packaged App installer/, /modules, GUI open, native-helper repair, and online family runtime install disabled/, /does not end.*Homebrew, Node, or Git/i, /App-managed bootstrap or maintenance remains responsible/]],
    [clt, [/user confirmation/, /Core ready is not blocked/]],
  ] as const) {
    assertSomeEntryMatches(scenario.expects, patterns);
  }

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

  assertEachMatch(script, [
    /OPL_APP_INSTALL_MODE=\$\{OPL_APP_INSTALL_MODE:-app-first\}/,
    /--complete/,
    /--skip-modules/,
    /curl -fsSL "\$OPL_INSTALL_SCRIPT_URL" \| bash -s -- "\$\{INSTALL_ARGS\[@\]\}"/,
    /--stable-macos-install/,
    /STABLE_MACOS_PACKAGE_PROFILE=\$\{OPL_STABLE_MACOS_PACKAGE_PROFILE:-full\}/,
    /hdiutil attach -nobrowse -readonly/,
    /ditto "\$source_app" "\$OPL_LOCAL_APP_PATH"/,
    /--authorize-local-app-only/,
    /--authorize-local-app/,
    /--app-path/,
    /OPL_LOCAL_APP_PATH=\$\{OPL_LOCAL_APP_PATH:-\/Applications\/One Person Lab\.app\}/,
    /Type "authorize" to continue/,
    /xattr -dr com\.apple\.quarantine "\$OPL_LOCAL_APP_PATH"/,
    /codesign --verify --deep --strict --verbose=2 "\$OPL_LOCAL_APP_PATH"/,
    /spctl --assess --type execute --verbose=4 "\$OPL_LOCAL_APP_PATH"/,
    /quarantine_before/,
    /quarantine_after/,
    /Stable macOS install/,
  ]);
  assert.doesNotMatch(script, /bash -s -- "\$@"/);
  assert.doesNotMatch(script, /--free-macos-install/);
  assertEachMatch(stableScript, [
    /OPL_APP_INSTALLER_URL=/,
    /https:\/\/raw\.githubusercontent\.com\/gaofeng21cn\/one-person-lab-app\/main\/install\.sh/,
    /install\.sh/,
    /--stable-macos-install/,
    /--yes/,
    /curl -fsSL "\$installer_url" \| bash -s -- --stable-macos-install --yes "\$@"/,
  ]);
  assert.equal(fs.existsSync(path.join(appRoot, 'install-free.sh')), false);
});
