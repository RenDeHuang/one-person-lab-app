import {
  assert,
  fs,
  os,
  path,
  test,
  runNode,
  writeFile,
} from './helpers.ts';
import { validateInstallExposureRuntimeAndDistribution } from '../../../scripts/validate-active-shell/install-exposure-runtime-distribution-validator.ts';

test('release boundary guard keeps App release ownership in App repo', () => {
  const result = runNode(['scripts/validate-release-boundary.ts']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /App release boundary is App-owned/);
});

test('Homebrew tap updater is a local cohort-bound manifest and checksum planner', () => {
  const tapRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-tap-test-'));
  const digest = 'b'.repeat(64);
  const releaseUrl = (version: string, assetName: string) =>
    `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/${assetName}`;
  const standardDmg = (version: string) => `One-Person-Lab-${version}-mac-arm64.dmg`;
  const fullDmg = (version: string) => `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const runTap = ({
    channel = 'stable',
    packageKind,
    version = '26.6.4',
    targetFlag = '--cask',
    target,
    manifest,
    download,
    write = false,
  }: {
    channel?: string;
    packageKind?: string;
    version?: string;
    targetFlag?: '--cask' | '--formula';
    target: string;
    manifest: string;
    download: string;
    write?: boolean;
  }) => runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    channel,
    ...(packageKind ? ['--package-kind', packageKind] : []),
    '--version',
    version,
    '--tap-root',
    tapRoot,
    targetFlag,
    target,
    '--manifest-url',
    releaseUrl(version, manifest),
    '--checksum-sha256',
    digest,
    '--download-url',
    releaseUrl(version, download),
    ...(write ? ['--write'] : []),
  ]);

  const stableResult = runTap({
    target: 'Casks/one-person-lab.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.4'),
    write: true,
  });
  assert.equal(stableResult.status, 0, stableResult.stderr || stableResult.stdout);
  const stablePlan = JSON.parse(stableResult.stdout);
  assert.equal(stablePlan.channel, 'stable');
  assert.equal(stablePlan.package_kind, 'app_standard');
  assert.equal(stablePlan.policy.manifest_required, true);
  assert.equal(stablePlan.policy.checksum_required, true);
  assert.equal(stablePlan.policy.full_first_install_allowed, false);
  assert.equal(stablePlan.policy.modules_payload_allowed, false);
  assert.equal(stablePlan.policy.agent_pack_homebrew_allowed, false);
  assert.equal(stablePlan.policy.agent_pack_activation_owner, 'app_cli_managed_background_maintenance');
  assert.equal(stablePlan.policy.stable_promotion_from_nightly_allowed, false);
  assert.equal(stablePlan.policy.publishes_or_pushes_remote, false);
  const stableCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab.rb'), 'utf8');
  assert.match(stableCask, /latest-arm64-mac\.yml/);
  assert.match(stableCask, new RegExp(digest));
  assert.match(stableCask, /\n  # OPL_HOMEBREW_BOUNDARY_START\n  # channel: stable/);
  assert.match(stableCask, /full_first_install_allowed: false/);
  assert.match(stableCask, /modules_payload_allowed: false/);
  assert.match(stableCask, /agent_pack_homebrew_allowed: false/);
  assert.match(stableCask, /agent_pack_activation_owner: app_cli_managed_background_maintenance/);
  assert.match(stableCask, /conflicts_with cask: \["one-person-lab-full", "one-person-lab-nightly"\]/);

  const fullResult = runTap({
    packageKind: 'app_full_first_install',
    target: 'Casks/one-person-lab-full.rb',
    manifest: 'opl-release-manifest.json',
    download: fullDmg('26.6.4'),
    write: true,
  });
  assert.equal(fullResult.status, 0, fullResult.stderr || fullResult.stdout);
  const fullPlan = JSON.parse(fullResult.stdout);
  assert.equal(fullPlan.channel, 'stable');
  assert.equal(fullPlan.package_kind, 'app_full_first_install');
  assert.equal(fullPlan.policy.full_first_install_allowed, true);
  assert.equal(fullPlan.policy.standard_updater_visible, false);
  assert.equal(fullPlan.policy.full_cask_install_surface, true);
  assert.equal(fullPlan.policy.bundled_full_runtime_payload_allowed, true);
  assert.equal(fullPlan.policy.agent_pack_homebrew_allowed, false);
  const fullCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab-full.rb'), 'utf8');
  assert.match(fullCask, /One-Person-Lab-Full-#\{version\}-mac-arm64\.dmg/);
  assert.match(fullCask, /opl-release-manifest\.json/);
  assert.match(fullCask, /package_kind: app_full_first_install/);
  assert.match(fullCask, /full_first_install_allowed: true/);
  assert.match(fullCask, /standard_updater_visible: false/);
  assert.match(fullCask, /cohort: full_first_install_homebrew_distribution/);
  assert.match(fullCask, /bundled_full_runtime_payload_allowed: true/);
  assert.match(fullCask, /agent_pack_homebrew_allowed: false/);
  assert.match(fullCask, /conflicts_with cask: \["one-person-lab", "one-person-lab-nightly"\]/);
  assert.match(fullCask, /Full assets stay outside standard updater metadata/);

  const stableRefresh = runTap({
    version: '26.6.5',
    target: 'Casks/one-person-lab.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.5'),
    write: true,
  });
  assert.equal(stableRefresh.status, 0, stableRefresh.stderr || stableRefresh.stdout);
  const stableRefreshedCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab.rb'), 'utf8');
  assert.match(stableRefreshedCask, /\n  # OPL_HOMEBREW_BOUNDARY_START\n  # channel: stable/);

  const modulesPackageKind = runTap({
    packageKind: 'modules_bundle',
    targetFlag: '--formula',
    target: 'Formula/one-person-lab-modules.rb',
    manifest: 'opl-modules-manifest.json',
    download: 'one-person-lab-modules-26.6.4.tar.gz',
    write: true,
  });
  assert.notEqual(modulesPackageKind.status, 0);
  assert.match(modulesPackageKind.stderr, /Homebrew tap updates are App cask-only/);

  const nightlyResult = runTap({
    channel: 'nightly',
    version: '26.6.4-nightly',
    target: 'Casks/one-person-lab-nightly.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.4-nightly'),
    write: true,
  });
  assert.equal(nightlyResult.status, 0, nightlyResult.stderr || nightlyResult.stdout);
  assert.equal(JSON.parse(nightlyResult.stdout).targets[0].path, 'Casks/one-person-lab-nightly.rb');
  const nightlyPlanRootCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab-nightly.rb'), 'utf8');
  assert.match(nightlyPlanRootCask, /livecheck do[\s\S]*skip "Nightly casks track prerelease cohorts through App release automation"/);

  const nightlyToStable = runTap({
    channel: 'nightly',
    version: '26.6.4-nightly',
    target: 'Casks/one-person-lab.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.4-nightly'),
  });
  assert.notEqual(nightlyToStable.status, 0);
  assert.match(nightlyToStable.stderr, /Nightly Homebrew tap updates may only update nightly formula\/cask targets/);

  const stableNightlyPromotion = runTap({
    version: '26.6.4-nightly',
    target: 'Casks/one-person-lab.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.4-nightly'),
  });
  assert.notEqual(stableNightlyPromotion.status, 0);
  assert.match(stableNightlyPromotion.stderr, /Stable Homebrew tap updates must not use a nightly version/);

  const appToModules = runTap({
    packageKind: 'app_standard',
    targetFlag: '--formula',
    target: 'Formula/one-person-lab-modules.rb',
    manifest: 'opl-modules-manifest.json',
    download: 'one-person-lab-modules-26.6.4.tar.gz',
  });
  assert.notEqual(appToModules.status, 0);
  assert.match(appToModules.stderr, /Homebrew tap updates are App cask-only/);

  const fullLeakInStandardPlan = runTap({
    target: 'Casks/one-person-lab.rb',
    manifest: 'opl-release-manifest.json',
    download: standardDmg('26.6.4'),
  });
  assert.notEqual(fullLeakInStandardPlan.status, 0);
  assert.match(fullLeakInStandardPlan.stderr, /Full first-install payloads/);

  const fullNightly = runTap({
    channel: 'nightly',
    packageKind: 'app_full_first_install',
    version: '26.6.4-nightly',
    target: 'Casks/one-person-lab-full.rb',
    manifest: 'opl-release-manifest.json',
    download: fullDmg('26.6.4-nightly'),
  });
  assert.notEqual(fullNightly.status, 0);
  assert.match(fullNightly.stderr, /Full first-install Homebrew cask updates must stay on the stable channel/);

  const fullToStandard = runTap({
    packageKind: 'app_full_first_install',
    target: 'Casks/one-person-lab.rb',
    manifest: 'opl-release-manifest.json',
    download: fullDmg('26.6.4'),
  });
  assert.notEqual(fullToStandard.status, 0);
  assert.match(fullToStandard.stderr, /Full first-install Homebrew cask updates may only update Casks\/one-person-lab-full\.rb/);

  const legacyFullManifestForFullCask = runTap({
    packageKind: 'app_full_first_install',
    target: 'Casks/one-person-lab-full.rb',
    manifest: 'full-package-manifest.json',
    download: fullDmg('26.6.4'),
  });
  assert.notEqual(legacyFullManifestForFullCask.status, 0);
  assert.match(legacyFullManifestForFullCask.stderr, /opl-release-manifest\.json/);

  const selfCheck = runNode(['scripts/update-homebrew-tap.ts', '--self-check']);
  assert.equal(selfCheck.status, 0, selfCheck.stderr || selfCheck.stdout);
});

test('agent installation contract validator accepts repository contracts', () => {
  const result = runNode(['scripts/validate-agent-installation-contract.ts']);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /App agent installation contract is consistent/);
});

test('App install policy selects exactly one compatible OPL Framework carrier', () => {
  const policy = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', 'app-install-exposure-policy.json'), 'utf8'),
  );
  const carrier = policy.distribution_channels.homebrew.framework_core_carrier;

  assert.equal(
    policy.distribution_channels.homebrew.role,
    'app_cask_and_framework_formula_install_index',
  );
  assert.equal(carrier.component, 'opl_framework');
  assert.equal(
    carrier.selection_policy,
    'developer_mode_then_install_origin_and_formula_availability_then_compatibility_handshake',
  );
  assert.deepEqual(carrier.locator_precedence, [
    {
      install_origin: 'explicit_developer_mode',
      carrier: 'developer_checkout',
      locator: '<selected-workspace>/one-person-lab',
    },
    {
      install_origin: 'homebrew_cask',
      carrier: 'system_homebrew_formula',
      formula: 'opl',
      locator: '/opt/homebrew/bin/opl or /usr/local/bin/opl',
      origin_evidence: 'Homebrew Caskroom receipt',
    },
    {
      install_origin: 'dmg_or_direct_download',
      carrier: 'framework_managed_install',
      locator: '~/.opl/one-person-lab',
      installer: 'opl-install.sh --headless --skip-modules',
    },
  ]);
  assert.deepEqual(carrier.pre_formula_transition, {
    allowed: true,
    condition: 'homebrew_cask_receipt_present_and_formula_absent',
    carrier: 'framework_managed_install',
    locator: '~/.opl/one-person-lab',
    installer: 'opl-install.sh --headless --skip-modules',
    selection_status: 'pre_formula_transition',
    must_end_when_formula_available: true,
    incompatible_formula_must_not_fallback: true,
    creates_second_framework_semantics: false,
  });
  assert.deepEqual(carrier.compatibility_handshake, {
    required_before_activation: true,
    producer_owner: 'one-person-lab',
    app_requirement_owner: 'one-person-lab-app',
    required_package_name: 'opl-framework',
    fail_closed_on_missing_or_incompatible: true,
    receipt_fields: [
      'selected_carrier',
      'framework_version',
      'framework_api_version',
      'app_required_api_range',
      'compatibility_status',
      'selection_status',
      'active_framework_count',
    ],
  });
  assert.deepEqual(carrier.activation_invariants, {
    active_framework_count: 1,
    dual_runtime_allowed: false,
    split_brain_allowed: false,
    second_framework_fallback_may_activate: false,
  });
  assert.deepEqual(carrier.release_authority, {
    app_carrier_release_truth_owner: 'one-person-lab-app',
    opl_base_release_truth_owner: 'one-person-lab',
    app_release_must_not_publish_or_promote_opl_base: true,
  });

  const splitBrainPolicy = structuredClone(policy);
  splitBrainPolicy.distribution_channels.homebrew.framework_core_carrier.activation_invariants.split_brain_allowed = true;
  assert.throws(
    () => validateInstallExposureRuntimeAndDistribution(splitBrainPolicy),
    /OPL Framework activation invariants/,
  );
});

test('App is an optional GUI over the same OPL base installed by every channel', () => {
  const policy = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', 'app-install-exposure-policy.json'), 'utf8'),
  );
  const install = policy.opl_base_install_contract;

  assert.deepEqual(install.product_roles, {
    opl_base: 'headless_framework_cli_runtime_required_before_any_opl_package',
    opl_app: 'optional_gui_control_plane_for_opl_base_and_managed_opl_components',
  });
  assert.deepEqual(install.channel_semantics, {
    homebrew: 'formula_installs_opl_base_then_optional_cask_installs_gui',
    dmg_or_direct: 'app_carrier_install_then_framework_installer_reconciles_same_opl_base_into_managed_root',
    headless: 'framework_installer_installs_opl_base_without_app',
  });
  assert.deepEqual(install.two_phase_install, {
    phase_1: 'install_selected_carrier',
    phase_2: 'reconcile_opl_base_and_selected_components_through_framework',
    app_reconcile_command: 'opl-install.sh --headless --skip-modules',
    app_managed_root: '~/.opl/one-person-lab',
    app_owns_framework_semantics: false,
  });
  assert.deepEqual(install.app_managed_update_classes, [
    'runtime_substrate',
    'capability_packages',
    'companion_tools',
    'codex_surface',
  ]);
  assert.deepEqual(install.forbidden_app_install_bypasses, [
    '--bootstrap-only',
    '--complete',
    '--skip-native-helper',
    '--skip-native-helper-repair',
    '--no-online-runtime',
  ]);
});

test('agent installation validator rejects duplicate bare MAS/MAG/RCA skill mirrors', () => {
  const skillsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-skills-'));
  const cleanResult = runNode([
    'scripts/validate-agent-installation-contract.ts',
    '--codex-skills-root',
    skillsRoot,
  ]);
  assert.equal(cleanResult.status, 0, cleanResult.stderr || cleanResult.stdout);

  writeFile(path.join(skillsRoot, 'med-autoscience', 'SKILL.md'), '# duplicate Med Auto Science skill\n');
  const duplicateResult = runNode([
    'scripts/validate-agent-installation-contract.ts',
    '--codex-skills-root',
    skillsRoot,
  ]);
  assert.notEqual(duplicateResult.status, 0);
  assert.match(duplicateResult.stderr, /med-autoscience must not be mirrored as a bare Codex skill/);
});

test('agent installation validator accepts generated OMA local plugin roots', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-oma-plugin-'));
  const pluginRoot = path.join(tempRoot, 'opl-meta-agent');
  try {
    writeFile(
      path.join(pluginRoot, '.codex-plugin', 'plugin.json'),
      `${JSON.stringify({ name: 'opl-meta-agent', skills: './skills/' }, null, 2)}\n`,
    );
    writeFile(
      path.join(pluginRoot, 'skills', 'opl-meta-agent', 'SKILL.md'),
      [
        '---',
        'name: opl-meta-agent',
        'description: Generated OPL Meta Agent primary skill fixture.',
        '---',
        '',
        '# OPL Meta Agent',
        '',
      ].join('\n'),
    );

    const result = runNode([
      'scripts/validate-agent-installation-contract.ts',
      '--agent-root',
      `opl-meta-agent=${pluginRoot}`,
    ]);

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
