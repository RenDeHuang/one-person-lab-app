import {
  assert,
  fs,
  os,
  path,
  spawnSync,
  test,
  appRoot,
  releaseWorkflowPaths,
  runNode,
  writeFile,
  sha256,
} from './helpers.ts';

test('release boundary guard keeps App release ownership in App repo', () => {
  const result = runNode(['scripts/validate-release-boundary.ts']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /App release boundary is App-owned/);
});

test('Homebrew tap updater is a local cohort-bound manifest and checksum planner', () => {
  const tapRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-tap-test-'));
  const digest = 'b'.repeat(64);
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const boundaryScriptDeps = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-release-boundary', 'script-dependencies.ts'),
    'utf8',
  );
  const boundaryReleaseChecks = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-release-boundary', 'release-checks.ts'),
    'utf8',
  );
  const homebrewScript = fs.readFileSync(path.join(appRoot, 'scripts', 'update-homebrew-tap.ts'), 'utf8');

  assert.equal(
    packageJson.scripts['homebrew:tap:plan'],
    'node --experimental-strip-types scripts/update-homebrew-tap.ts',
  );
  assert.equal(
    packageJson.scripts['validate:homebrew-tap'],
    'node --experimental-strip-types scripts/update-homebrew-tap.ts --self-check',
  );
  assert.equal(
    packageJson.scripts['release:preflight'],
    'node --experimental-strip-types scripts/validate-release-preflight.ts',
  );
  assert.match(boundaryReleaseChecks, /release_preflight_script/);
  assert.match(boundaryScriptDeps, /scripts\/update-homebrew-tap\.ts/);
  assert.match(boundaryScriptDeps, /--self-check/);
  assert.match(homebrewScript, /manifest_required: true/);
  assert.match(homebrewScript, /checksum_required: true/);
  assert.match(homebrewScript, /nightly_targets_only_for_nightly: true/);
  assert.match(homebrewScript, /stable_promotion_from_nightly_allowed: false/);
  assert.match(homebrewScript, /full_first_install_allowed: false/);
  assert.match(homebrewScript, /full_first_install_allowed: true/);
  assert.match(homebrewScript, /standard_updater_visible: false/);
  assert.match(homebrewScript, /bundled_full_runtime_payload_allowed: true/);
  assert.match(homebrewScript, /app_full_first_install/);
  assert.match(homebrewScript, /modules_payload_allowed: false/);
  assert.match(homebrewScript, /agent_pack_homebrew_allowed: false/);
  assert.match(homebrewScript, /agent_pack_activation_owner: app_cli_managed_background_maintenance/);
  assert.match(homebrewScript, /publishes_or_pushes_remote: false/);
  assert.doesNotMatch(homebrewScript, /from 'node:child_process'|spawnSync\(|execSync\(|execFileSync\(/);

  const stableResult = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/latest-arm64-mac.yml',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-26.6.4-mac-arm64.dmg',
    '--write',
  ]);
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
  const stableCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab.rb'), 'utf8');
  assert.match(stableCask, /latest-arm64-mac\.yml/);
  assert.match(stableCask, new RegExp(digest));
  assert.match(stableCask, /stable_promotion_from_nightly_allowed: false/);
  assert.match(stableCask, /full_first_install_allowed: false/);
  assert.match(stableCask, /modules_payload_allowed: false/);
  assert.match(stableCask, /agent_pack_homebrew_allowed: false/);
  assert.match(stableCask, /agent_pack_activation_owner: app_cli_managed_background_maintenance/);
  assert.match(stableCask, /desc "AI-first desktop research and agent orchestration app"/);
  assert.match(stableCask, /url "https:\/\/github\.com\/gaofeng21cn\/one-person-lab-app\/releases\/download\/v#\{version\}\/One-Person-Lab-#\{version\}-mac-arm64\.dmg"/);
  assert.match(stableCask, /depends_on macos: :big_sur/);
  assert.match(stableCask, /depends_on arch: :arm64/);
  assert.match(stableCask, /conflicts_with cask: \["one-person-lab-full", "one-person-lab-nightly"\]/);
  assert.match(stableCask, /livecheck do[\s\S]*releases\/latest[\s\S]*regex\(%r\{\/releases\/tag\/v\?\(\\d\+\(\?:\\\.\\d\+\)\*\)\}i\)/);
  assert.match(stableCask, /app "One Person Lab\.app"/);
  assert.ok(stableCask.indexOf('  livecheck do') < stableCask.indexOf('  conflicts_with cask:'));
  assert.ok(stableCask.indexOf('  conflicts_with cask:') < stableCask.indexOf('  depends_on macos: :big_sur'));

  const fullResult = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--package-kind',
    'app_full_first_install',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab-full.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/opl-release-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-Full-26.6.4-mac-arm64.dmg',
    '--write',
  ]);
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
  assert.ok(fullCask.indexOf('  conflicts_with cask:') < fullCask.indexOf('  depends_on macos: :big_sur'));
  assert.match(fullCask, /Full assets stay outside standard updater metadata/);
  assert.match(fullCask, /app "One Person Lab\.app"/);

  const stableRefresh = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--version',
    '26.6.5',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.5/latest-arm64-mac.yml',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.5/One-Person-Lab-26.6.5-mac-arm64.dmg',
    '--write',
  ]);
  assert.equal(stableRefresh.status, 0, stableRefresh.stderr || stableRefresh.stdout);
  const stableRefreshedCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab.rb'), 'utf8');
  assert.match(stableRefreshedCask, /desc "AI-first desktop research and agent orchestration app"/);
  assert.ok(stableRefreshedCask.indexOf('  conflicts_with cask:') < stableRefreshedCask.indexOf('  depends_on macos: :big_sur'));
  assert.match(stableRefreshedCask, /depends_on macos: :big_sur/);
  assert.match(stableRefreshedCask, /\n  # OPL_HOMEBREW_BOUNDARY_START\n  # channel: stable/);

  const modulesPackageKind = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--package-kind',
    'modules_bundle',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--formula',
    'Formula/one-person-lab-modules.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/opl-modules-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/one-person-lab-modules-26.6.4.tar.gz',
    '--write',
  ]);
  assert.notEqual(modulesPackageKind.status, 0);
  assert.match(modulesPackageKind.stderr, /Homebrew tap updates are App cask-only/);

  const nightlyResult = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'nightly',
    '--version',
    '26.6.4-nightly',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab-nightly.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/latest-arm64-mac.yml',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/One-Person-Lab-26.6.4-nightly-mac-arm64.dmg',
    '--write',
  ]);
  assert.equal(nightlyResult.status, 0, nightlyResult.stderr || nightlyResult.stdout);
  assert.equal(JSON.parse(nightlyResult.stdout).targets[0].path, 'Casks/one-person-lab-nightly.rb');
  const nightlyPlanRootCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab-nightly.rb'), 'utf8');
  assert.match(nightlyPlanRootCask, /livecheck do[\s\S]*skip "Nightly casks track prerelease cohorts through App release automation"/);

  const nightlyToStable = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'nightly',
    '--version',
    '26.6.4-nightly',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/latest-arm64-mac.yml',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/One-Person-Lab-26.6.4-nightly-mac-arm64.dmg',
  ]);
  assert.notEqual(nightlyToStable.status, 0);
  assert.match(nightlyToStable.stderr, /Nightly Homebrew tap updates may only update nightly formula\/cask targets/);

  const stableNightlyPromotion = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--version',
    '26.6.4-nightly',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/latest-arm64-mac.yml',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/One-Person-Lab-26.6.4-nightly-mac-arm64.dmg',
  ]);
  assert.notEqual(stableNightlyPromotion.status, 0);
  assert.match(stableNightlyPromotion.stderr, /Stable Homebrew tap updates must not use a nightly version/);

  const appToModules = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--package-kind',
    'app_standard',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--formula',
    'Formula/one-person-lab-modules.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/opl-modules-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/one-person-lab-modules-26.6.4.tar.gz',
  ]);
  assert.notEqual(appToModules.status, 0);
  assert.match(appToModules.stderr, /Homebrew tap updates are App cask-only/);

  const fullLeakInStandardPlan = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/opl-release-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-26.6.4-mac-arm64.dmg',
  ]);
  assert.notEqual(fullLeakInStandardPlan.status, 0);
  assert.match(fullLeakInStandardPlan.stderr, /Full first-install payloads/);

  const fullNightly = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'nightly',
    '--package-kind',
    'app_full_first_install',
    '--version',
    '26.6.4-nightly',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab-full.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/opl-release-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4-nightly/One-Person-Lab-Full-26.6.4-nightly-mac-arm64.dmg',
  ]);
  assert.notEqual(fullNightly.status, 0);
  assert.match(fullNightly.stderr, /Full first-install Homebrew cask updates must stay on the stable channel/);

  const fullToStandard = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--package-kind',
    'app_full_first_install',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/opl-release-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-Full-26.6.4-mac-arm64.dmg',
  ]);
  assert.notEqual(fullToStandard.status, 0);
  assert.match(fullToStandard.stderr, /Full first-install Homebrew cask updates may only update Casks\/one-person-lab-full\.rb/);

  const legacyFullManifestForFullCask = runNode([
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--package-kind',
    'app_full_first_install',
    '--version',
    '26.6.4',
    '--tap-root',
    tapRoot,
    '--cask',
    'Casks/one-person-lab-full.rb',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/full-package-manifest.json',
    '--checksum-sha256',
    digest,
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.6.4/One-Person-Lab-Full-26.6.4-mac-arm64.dmg',
  ]);
  assert.notEqual(legacyFullManifestForFullCask.status, 0);
  assert.match(legacyFullManifestForFullCask.stderr, /opl-release-manifest\.json/);

  const selfCheck = runNode(['scripts/update-homebrew-tap.ts', '--self-check']);
  assert.equal(selfCheck.status, 0, selfCheck.stderr || selfCheck.stdout);
  assert.match(selfCheck.stdout, /Full cask isolation/);
  assert.match(selfCheck.stdout, /agent-pack App\/CLI ownership/);
});

test('agent installation contract validator is wired into release boundary guard', () => {
  const boundaryScriptDeps = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-release-boundary', 'script-dependencies.ts'),
    'utf8',
  );
  const result = runNode(['scripts/validate-agent-installation-contract.ts']);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /App agent installation contract is consistent/);
  assert.match(boundaryScriptDeps, /validate-agent-installation-contract\.ts/);
});

test('agent installation validator rejects duplicate bare MAS/MAG/RCA skill mirrors', () => {
  const skillsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-skills-'));
  const cleanResult = runNode([
    'scripts/validate-agent-installation-contract.ts',
    '--codex-skills-root',
    skillsRoot,
  ]);
  assert.equal(cleanResult.status, 0, cleanResult.stderr || cleanResult.stdout);
  assert.match(cleanResult.stdout, /"validated_codex_skills_root"/);

  writeFile(path.join(skillsRoot, 'mas', 'SKILL.md'), '# duplicate MAS skill\n');
  const duplicateResult = runNode([
    'scripts/validate-agent-installation-contract.ts',
    '--codex-skills-root',
    skillsRoot,
  ]);
  assert.notEqual(duplicateResult.status, 0);
  assert.match(duplicateResult.stderr, /mas must not be mirrored as a bare Codex skill/);
});

test('agent installation validator accepts generated OMA local plugin roots', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-oma-plugin-'));
  const pluginRoot = path.join(tempRoot, 'opl-meta-agent');
  try {
    writeFile(
      path.join(pluginRoot, '.codex-plugin', 'plugin.json'),
      `${JSON.stringify({ name: 'opl-meta-agent', skills: './skills/' }, null, 2)}\n`,
    );
    writeFile(path.join(pluginRoot, 'skills', 'opl-meta-agent', 'SKILL.md'), '# OPL Meta Agent\n');

    const result = runNode([
      'scripts/validate-agent-installation-contract.ts',
      '--agent-root',
      `opl-meta-agent=${pluginRoot}`,
    ]);

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /"generated_plugin_agents"/);
    assert.match(result.stdout, /"opl-meta-agent":/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
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
