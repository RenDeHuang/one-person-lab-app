import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { appRoot } from './app-release-boundary-cases/helpers.ts';
import { validateDistributionInstallSsot } from '../../scripts/validate-active-shell/distribution-install-ssot-validator.ts';

function readJson(relativePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

function canonicalContracts() {
  return {
    release: readJson('contracts/app-release-channel.json'),
    install: readJson('contracts/app-install-exposure-policy.json'),
  };
}

test('distribution/install SSOT validates the current and approved state split', () => {
  const { release, install } = canonicalContracts();
  assert.doesNotThrow(() => validateDistributionInstallSsot(release, install));
  assert.equal(
    release.distribution_semantics.retired_compatibility.desktop_nightly.new_publication_status,
    'not_approved_requires_new_product_decision',
  );
  assert.equal(
    install.distribution_install_model.runtime_forms.native_webui.public_install_status,
    'not_published',
  );
  assert.equal(
    install.distribution_install_model.homebrew_carriers.full.formula_dependency_current,
    true,
  );
  assert.equal(
    install.distribution_install_model.homebrew_carriers.full.formula_dependency_target,
    false,
  );
  assert.equal(
    release.distribution_semantics.approved_targets.homebrew_full.generation_status,
    'implemented_unpublished',
  );
  assert.equal(
    release.homebrew_tap_distribution.tap_update_policy.full.homebrew_publish_allowed,
    false,
  );
});

test('Homebrew generator keeps Standard on Formula Base and Full on embedded Base', () => {
  const tapRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-homebrew-full-carrier-'));
  const digest = 'a'.repeat(64);
  const common = [
    'scripts/update-homebrew-tap.ts',
    '--channel',
    'stable',
    '--version',
    '26.7.24',
    '--updater-version',
    '26.7.2400',
    '--tap-root',
    tapRoot,
    '--checksum-sha256',
    digest,
    '--write',
  ];
  const run = (args: string[]) => spawnSync(
    process.execPath,
    ['--experimental-strip-types', ...common, ...args],
    { cwd: appRoot, encoding: 'utf8' },
  );

  const standard = run([
    '--package-kind',
    'app_standard',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.24/latest-arm64-mac.yml',
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.24/One-Person-Lab-26.7.24-mac-arm64.dmg',
    '--cask',
    'Casks/one-person-lab.rb',
  ]);
  assert.equal(standard.status, 0, standard.stderr || standard.stdout);

  fs.writeFileSync(
    path.join(tapRoot, 'Casks/one-person-lab-full.rb'),
    [
      'cask "one-person-lab-full" do',
      '  version "26.7.2300"',
      `  sha256 "${'b'.repeat(64)}"`,
      '  url "https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.23/One-Person-Lab-Full-26.7.23-mac-arm64.dmg"',
      '  conflicts_with cask: ["one-person-lab", "one-person-lab-nightly"]',
      '  depends_on formula: "gaofeng21cn/one-person-lab/opl"',
      '  depends_on macos: :big_sur',
      '  depends_on arch: :arm64',
      '  app "One Person Lab.app"',
      'end',
      '',
    ].join('\n'),
    'utf8',
  );
  const full = run([
    '--package-kind',
    'app_full_first_install',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.24/opl-release-manifest.json',
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.24/One-Person-Lab-Full-26.7.24-mac-arm64.dmg',
    '--cask',
    'Casks/one-person-lab-full.rb',
  ]);
  assert.equal(full.status, 0, full.stderr || full.stdout);

  const standardCask = fs.readFileSync(path.join(tapRoot, 'Casks/one-person-lab.rb'), 'utf8');
  const fullCask = fs.readFileSync(path.join(tapRoot, 'Casks/one-person-lab-full.rb'), 'utf8');
  const standardPlan = JSON.parse(standard.stdout);
  const fullPlan = JSON.parse(full.stdout);
  assert.match(standardCask, /depends_on formula: "opl"/);
  assert.doesNotMatch(fullCask, /depends_on formula:/);
  assert.match(fullCask, /conflicts_with cask: \["one-person-lab", "one-person-lab-nightly"\]/);
  assert.equal(standardPlan.policy.formula_dependency_required, true);
  assert.equal(standardPlan.policy.framework_carrier, 'homebrew_formula_opl');
  assert.equal(fullPlan.policy.formula_dependency_required, false);
  assert.equal(fullPlan.policy.framework_carrier, 'full_dmg_embedded_opl_base');
  assert.equal(fullPlan.policy.active_framework_count_target, 1);
  assert.equal(fullPlan.policy.publishes_or_pushes_remote, false);
  assert.equal(fullPlan.cas.decision, 'write_once');

  const fullAgain = run([
    '--package-kind',
    'app_full_first_install',
    '--manifest-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.24/opl-release-manifest.json',
    '--download-url',
    'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.24/One-Person-Lab-Full-26.7.24-mac-arm64.dmg',
    '--cask',
    'Casks/one-person-lab-full.rb',
  ]);
  assert.equal(fullAgain.status, 0, fullAgain.stderr || fullAgain.stdout);
  assert.equal(JSON.parse(fullAgain.stdout).cas.decision, 'idempotent');
  assert.equal(JSON.parse(fullAgain.stdout).cas.write_performed, false);
  assert.equal(fs.readFileSync(path.join(tapRoot, 'Casks/one-person-lab-full.rb'), 'utf8'), fullCask);
});

test('cross-contract drift fails closed for channel, carrier, and convergence mutations', () => {
  const mutations: Array<[string, (release: any, install: any) => void]> = [
    [
      'Nightly becoming Full',
      (release) => {
        release.distribution_semantics.terms.nightly.full_by_default = true;
      },
    ],
    [
      'ungated Preview moving Latest',
      (release) => {
        release.distribution_semantics.latest_policy.manual_ungated_or_preview_build_may_become_latest = true;
      },
    ],
    [
      'Full target retaining Formula dependency',
      (release) => {
        release.distribution_semantics.approved_targets.homebrew_full.formula_dependency_target = true;
      },
    ],
    [
      'Full target losing digest CAS',
      (release) => {
        release.distribution_semantics.approved_targets.homebrew_full.digest_cas_required = false;
      },
    ],
    [
      'Full generator being presented as publicly promoted',
      (release) => {
        release.distribution_semantics.approved_targets.homebrew_full.public_promotion_status = 'published';
      },
    ],
    [
      'Native WebUI being advertised before publication',
      (_, install) => {
        install.distribution_install_model.runtime_forms.native_webui.public_install_status = 'supported';
      },
    ],
    [
      'multiple active Frameworks',
      (_, install) => {
        install.distribution_install_model.consistency_target.active_framework_count = 2;
      },
    ],
    [
      'Package published current stable owned by App carrier',
      (_, install) => {
        install.distribution_install_model.consistency_target.package_published_current_stable_authority =
          'app_carrier';
      },
    ],
    [
      'Package installed state inferred without carrier readback',
      (_, install) => {
        install.distribution_install_model.consistency_target.configured_carrier_terminal_readback_required =
          false;
      },
    ],
  ];

  for (const [label, mutate] of mutations) {
    const { release, install } = canonicalContracts();
    mutate(release, install);
    assert.throws(
      () => validateDistributionInstallSsot(release, install),
      undefined,
      label,
    );
  }
});

test('ordinary docs point to the SSOT without advertising retired or unpublished paths', () => {
  const ssot = 'docs/delivery/distribution-and-install-ssot.md';
  const rootReadme = fs.readFileSync(path.join(appRoot, 'README.md'), 'utf8');
  const docsIndex = fs.readFileSync(path.join(appRoot, 'docs/README.md'), 'utf8');
  const deliveryIndex = fs.readFileSync(path.join(appRoot, 'docs/delivery/README.md'), 'utf8');
  const releaseGuide = fs.readFileSync(path.join(appRoot, 'docs/delivery/release/README.md'), 'utf8');
  const macGuide = fs.readFileSync(
    path.join(appRoot, 'docs/guides/macos-app-install/guide.qmd'),
    'utf8',
  );
  const macGuideManifest = readJson(
    'docs/delivery/user-guides/macos-app-install/source/macos-app-install.quarto.json',
  );
  assert.match(rootReadme, new RegExp(ssot.replaceAll('/', '\\/')));
  assert.match(docsIndex, /delivery\/distribution-and-install-ssot\.md/);
  assert.match(deliveryIndex, /distribution-and-install-ssot\.md/);
  assert.match(releaseGuide, /\.\.\/distribution-and-install-ssot\.md/);
  assert.match(macGuide, /\{\{download\.stable_install_command\}\}/);
  assert.equal(
    macGuideManifest.download.stable_install_command,
    'brew install --cask gaofeng21cn/one-person-lab/one-person-lab',
  );
  assert.doesNotMatch(rootReadme, /brew install --cask .*one-person-lab-nightly/);
  assert.doesNotMatch(rootReadme, /brew install --cask .*one-person-lab-full/);
  assert.doesNotMatch(rootReadme, /--stable-macos-install --yes/);
});
