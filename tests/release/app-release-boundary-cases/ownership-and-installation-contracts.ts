import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  runNode,
  writeFile,
} from './helpers.ts';

test('release boundary guard keeps App release ownership in App repo', () => {
  const result = runNode(['scripts/validate-release-boundary.ts']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /App release boundary is App-owned/);
});

test('release boundary guard wires App-owned installation validators', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const boundaryScriptDeps = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-release-boundary', 'script-dependencies.ts'),
    'utf8',
  );

  for (const [scriptName, command] of Object.entries({
    'homebrew:tap:plan': 'node --experimental-strip-types scripts/update-homebrew-tap.ts',
    'validate:homebrew-tap': 'node --experimental-strip-types scripts/update-homebrew-tap.ts --self-check',
    'validate:agent-installation': 'node --experimental-strip-types scripts/validate-agent-installation-contract.ts',
  })) {
    assert.equal(packageJson.scripts[scriptName], command);
  }
  for (const dependency of [
    /scripts\/update-homebrew-tap\.ts/,
    /--self-check/,
    /validate-agent-installation-contract\.ts/,
  ]) {
    assert.match(boundaryScriptDeps, dependency);
  }
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
