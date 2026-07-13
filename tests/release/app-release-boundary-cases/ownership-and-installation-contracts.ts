import {
  assert,
  appRoot,
  fs,
  os,
  path,
  test,
  runNode,
  writeFile,
} from './helpers.ts';
import { validateInstallExposureRuntimeAndDistribution } from '../../../scripts/validate-active-shell/install-exposure-runtime-distribution-validator.ts';
import { validateReleaseChannelContract } from '../../../scripts/validate-active-shell/release-contract-validator.ts';
import {
  packagedSkillCopyHandlers,
  readOplFlowFullSkillDependencyClosure,
} from '../../../scripts/build-full-first-install-package/skills.ts';

test('App Full packages the OPL Flow offline skill closure without retired workflow plugins', () => {
  const oplFlowRoot = process.env.OPL_FULL_OPL_FLOW_ROOT?.trim() || path.resolve(appRoot, '..', 'opl-flow');
  const closure = readOplFlowFullSkillDependencyClosure(oplFlowRoot);
  const expected = [
    'officecli',
    'officecli-docx',
    'officecli-pptx',
    'officecli-xlsx',
    'officecli-academic-paper',
    'officecli-data-dashboard',
    'officecli-financial-model',
    'officecli-pitch-deck',
    'mineru-document-extractor',
    'ui-ux-pro-max',
  ];

  assert.deepEqual(closure, expected);
  for (const skillId of expected) assert.equal(typeof packagedSkillCopyHandlers[skillId], 'function', skillId);
  for (const retired of ['superpowers', 'superpowers-lite', 'ponytail', 'codexcont', 'codex-ops-kit']) {
    assert.equal(closure.includes(retired), false, retired);
  }
});

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
  assert.equal(stablePlan.policy.homebrew_allowed_software_objects, 'opl_base,opl_app');
  assert.equal(stablePlan.policy.opl_packages_lifecycle_owned_by_homebrew, false);
  assert.equal(stablePlan.policy.opl_packages_lifecycle_owner, 'one-person-lab');
  assert.equal(stablePlan.policy.package_specific_formula_allowed, false);
  assert.equal(stablePlan.policy.package_specific_cask_allowed, false);
  assert.equal(stablePlan.policy.stable_promotion_from_nightly_allowed, false);
  assert.equal(stablePlan.policy.publishes_or_pushes_remote, false);
  const stableCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab.rb'), 'utf8');
  assert.match(stableCask, /latest-arm64-mac\.yml/);
  assert.match(stableCask, new RegExp(digest));
  assert.match(stableCask, /\n  # OPL_HOMEBREW_BOUNDARY_START\n  # channel: stable/);
  assert.match(stableCask, /full_first_install_allowed: false/);
  assert.match(stableCask, /homebrew_allowed_software_objects: opl_base,opl_app/);
  assert.match(stableCask, /opl_packages_lifecycle_owned_by_homebrew: false/);
  assert.match(stableCask, /opl_packages_lifecycle_owner: one-person-lab/);
  assert.match(stableCask, /package_specific_formula_allowed: false/);
  assert.match(stableCask, /package_specific_cask_allowed: false/);
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
  assert.equal(fullPlan.policy.opl_packages_lifecycle_owned_by_homebrew, false);
  const fullCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab-full.rb'), 'utf8');
  assert.match(fullCask, /One-Person-Lab-Full-#\{version\}-mac-arm64\.dmg/);
  assert.match(fullCask, /opl-release-manifest\.json/);
  assert.match(fullCask, /package_kind: app_full_first_install/);
  assert.match(fullCask, /full_first_install_allowed: true/);
  assert.match(fullCask, /standard_updater_visible: false/);
  assert.match(fullCask, /cohort: full_first_install_homebrew_distribution/);
  assert.match(fullCask, /bundled_full_runtime_payload_allowed: true/);
  assert.match(fullCask, /opl_packages_lifecycle_owned_by_homebrew: false/);
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

  const packageBundleKind = runTap({
    packageKind: 'package_bundle',
    targetFlag: '--formula',
    target: 'Formula/mag.rb',
    manifest: 'opl-package-manifest.json',
    download: 'mag-0.1.0.tar.gz',
    write: true,
  });
  assert.notEqual(packageBundleKind.status, 0);
  assert.match(packageBundleKind.stderr, /Homebrew tap updates are App cask-only/);

  const nightlyResult = runTap({
    channel: 'nightly',
    version: '26.6.4-nightly.123456789.1',
    target: 'Casks/one-person-lab-nightly.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.4-nightly.123456789.1'),
    write: true,
  });
  assert.equal(nightlyResult.status, 0, nightlyResult.stderr || nightlyResult.stdout);
  assert.equal(JSON.parse(nightlyResult.stdout).targets[0].path, 'Casks/one-person-lab-nightly.rb');
  const nightlyPlanRootCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab-nightly.rb'), 'utf8');
  assert.match(nightlyPlanRootCask, /livecheck do[\s\S]*skip "Nightly casks track prerelease cohorts through App release automation"/);

  const nightlyToStable = runTap({
    channel: 'nightly',
    version: '26.6.4-nightly.123456789.1',
    target: 'Casks/one-person-lab.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.4-nightly.123456789.1'),
  });
  assert.notEqual(nightlyToStable.status, 0);
  assert.match(nightlyToStable.stderr, /Nightly Homebrew tap updates may only update the Nightly App cask target/);

  const stableNightlyPromotion = runTap({
    version: '26.6.4-nightly.123456789.1',
    target: 'Casks/one-person-lab.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.4-nightly.123456789.1'),
  });
  assert.notEqual(stableNightlyPromotion.status, 0);
  assert.match(stableNightlyPromotion.stderr, /Stable Homebrew tap updates must use YY\.M\.D/);

  const appToPackageFormula = runTap({
    packageKind: 'app_standard',
    targetFlag: '--formula',
    target: 'Formula/mag.rb',
    manifest: 'opl-package-manifest.json',
    download: 'mag-0.1.0.tar.gz',
  });
  assert.notEqual(appToPackageFormula.status, 0);
  assert.match(appToPackageFormula.stderr, /Homebrew tap updates are App cask-only/);

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
    version: '26.6.4-nightly.123456789.1',
    target: 'Casks/one-person-lab-full.rb',
    manifest: 'opl-release-manifest.json',
    download: fullDmg('26.6.4-nightly.123456789.1'),
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

test('App package consumers reject legacy identity, namespace, command, and plain latest aliases', () => {
  const readContract = (name: string) => JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', name), 'utf8'),
  );
  const canonicalPackageIds = ['mas', 'mag', 'rca', 'oma', 'obf', 'mas-scholar-skills', 'opl-flow'];
  const canonicalAgentIds = new Set(['mas', 'mag', 'rca', 'oma', 'obf']);
  const registry = readContract('agent-package-registry.json');
  assert.deepEqual(registry.entries.map((entry) => entry.package_id).sort(), [...canonicalPackageIds].sort());
  assert.equal('latest_version' in registry.entries[0], false);

  for (const entry of registry.entries) {
    const manifestUrl = `https://raw.githubusercontent.com/gaofeng21cn/one-person-lab/main/contracts/opl-framework/packages/${entry.package_id}.json`;
    assert.equal(entry.manifest_url, manifestUrl);
    assert.equal(entry.version_source_ref, `${manifestUrl}#/version`);
    assert.equal(
      entry.ordinary_user_source.ordinary_user_ref,
      `ghcr.io/gaofeng21cn/one-person-lab-packages/${entry.package_id}:latest-stable`,
    );
    assert.equal(
      entry.ordinary_user_source.candidate_ref,
      `ghcr.io/gaofeng21cn/one-person-lab-packages/${entry.package_id}:candidate`,
    );
    assert.equal(entry.ordinary_user_source.ordinary_user_ref.endsWith(':latest'), false);
    assert.equal(JSON.stringify(entry.ordinary_user_source).includes(':candidate-'), false);
    if (canonicalAgentIds.has(entry.package_id)) {
      assert.equal(entry.agent_id, entry.package_id);
    } else {
      assert.equal('agent_id' in entry, false);
      assert.deepEqual(entry.home_shortcut_ids, []);
    }
  }

  const fixtureDir = path.join(appRoot, 'contracts', 'fixtures', 'agent-package-manifests');
  for (const packageId of canonicalPackageIds) {
    const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, `${packageId}.json`), 'utf8'));
    const distribution = JSON.stringify(fixture.distribution_payload);
    assert.equal(fixture.distribution_payload.proof_status, 'contract_fixture_non_live');
    assert.match(fixture.distribution_payload.payload_digest_ref, /@sha256:[0-9a-f]{64}$/);
    assert.equal(fixture.distribution_payload.moving_tag, 'latest-stable');
    assert.equal(/:latest(?:[\"/?#]|$)/.test(distribution), false);
    assert.equal(/\/opl-(?:agent|package)-|\/one-person-lab-modules\//.test(distribution), false);
  }

  const activeInstallSurface = JSON.stringify(readContract('app-install-exposure-policy.json'));
  assert.equal(activeInstallSurface.includes('--skip-modules'), false);
  assert.equal(activeInstallSurface.includes('reconcile-modules'), false);
});

test('App contracts require one generic package use-boundary activation before launch', () => {
  const readContract = (name: string) => JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', name), 'utf8'),
  );
  const runtimeBridge = readContract('app-runtime-bridge.json');
  const installExposure = readContract('app-install-exposure-policy.json');
  const guiProduct = readContract('app-gui-product-contract.json');
  const productProfile = readContract('app-product-profile.json');
  const pageState = readContract('app-page-state-matrix.json');
  const packageSurfaces = readContract('agent-package-surfaces.schema.json');
  const fastFixture = readContract('fixtures/opl-app-state-fast.fixture.json');

  const expectedActivationPolicy = {
    action_id: 'agent_package_activate',
    action_route: 'opl app action execute --action agent_package_activate --payload <json> --json',
    trigger: 'before_every_installed_package_workspace_or_quest_launch',
    payload_fields: ['package_id', 'scope', 'target_workspace', 'target_quest', 'use_boundary_id'],
    scope_values: ['workspace', 'quest'],
    scope_target_policy: {
      workspace: 'target_workspace_required_target_quest_forbidden',
      quest: 'target_quest_required_target_workspace_forbidden',
    },
    result_fields: ['launch_allowed', 'use_receipt_ref', 'use_binding'],
    launch_policy: 'launch_only_when_launch_allowed_true_and_use_receipt_ref_and_use_binding_are_present',
    currentness_policy: 'framework_reconciles_latest_stable_compatible_package_closure_once_at_use_boundary_and_pins_use_binding_for_the_session',
    package_identity_policy: 'generic_package_id_no_hardcoded_agent_or_capability_package_ids',
    app_role: 'prepare_then_launch_using_framework_readback_without_owning_package_currentness_or_materialization',
  };
  const expectedActivationStates = {
    package_not_installed: {
      preparation_status: 'not_installed',
      enabled: false,
      reason_code: 'package_not_installed',
    },
    installed_scope_stale: {
      preparation_status: 'prepare_required',
      enabled: true,
      reason_code: 'scope_reconciliation_required',
    },
    installed_scope_current: {
      preparation_status: 'ready',
      enabled: true,
      reason_code: 'use_boundary_reconciliation_ready',
    },
  };

  assert.deepEqual(
    installExposure.agent_installation_contract.package_manager_lifecycle.activation_contract,
    expectedActivationPolicy,
  );
  assert.deepEqual(guiProduct.agent_package_activation_policy, expectedActivationPolicy);
  assert.deepEqual(productProfile.gui.agent_package_activation_policy, expectedActivationPolicy);
  assert.deepEqual(
    pageState.pages.find((page: { id: string }) => page.id === 'guid_home').home_view_model.agent_package_activation_policy,
    expectedActivationPolicy,
  );

  const packageRow = runtimeBridge.canonical_state_display_action_map.rows.find(
    (row: { semantic_area: string }) => row.semantic_area === 'package',
  );
  assert.equal(packageRow.allowed_action_refs.includes('agent_package_activate'), true);
  assert.deepEqual(packageRow.use_boundary_activation_contract, expectedActivationPolicy);

  const capabilitiesProjection = guiProduct.pages.settings_capabilities.agent_package_lifecycle_ux.package_projection_contract;
  assert.deepEqual(
    capabilitiesProjection.status_index_package_fields.activation_action,
    ['action_id', 'command_ref', 'enabled', 'preparation_status', 'reason_code'],
  );
  assert.deepEqual(
    capabilitiesProjection.activation_preparation_status_values,
    ['not_installed', 'prepare_required', 'ready'],
  );
  assert.deepEqual(capabilitiesProjection.activation_preparation_policy, expectedActivationStates);
  assert.deepEqual(
    pageState.pages.find((page: { id: string }) => page.id === 'capabilities')
      .agent_package_lifecycle_ux.package_projection_contract,
    capabilitiesProjection,
  );
  const profilePackageSurface = productProfile.settings.control_plane.page_adapter_policy.required_pages
    .capabilities.directory_projection_surface;
  assert.equal(
    profilePackageSurface.activation_action_contract_ref,
    'contracts/app-gui-product-contract.json#pages.settings_capabilities.agent_package_lifecycle_ux.package_projection_contract.activation_preparation_policy',
  );
  assert.equal(profilePackageSurface.status_model.axes.includes('activation_action'), true);
  assert.equal(profilePackageSurface.detail_surface.detail_fields.includes('activation_action'), true);

  assert.deepEqual(packageSurfaces.$defs.agent_package_activation_request.required, [
    'package_id',
    'scope',
    'use_boundary_id',
  ]);
  assert.deepEqual(packageSurfaces.$defs.agent_package_activation_result.required, [
    'launch_allowed',
    'use_receipt_ref',
    'use_binding',
  ]);
  assert.deepEqual(packageSurfaces.$defs.agent_package_activation_action.required, [
    'action_id',
    'command_ref',
    'enabled',
    'preparation_status',
    'reason_code',
  ]);
  assert.equal(
    packageSurfaces.$defs.agent_package_activation_request.allOf.length,
    2,
    'workspace and quest payload targets must be mutually exclusive',
  );

  const fixtureStatus = fastFixture.app_state.agent_packages.status_index.packages['example-agent'];
  assert.deepEqual(fixtureStatus.activation_action, {
    action_id: 'agent_package_activate',
    command_ref: 'opl app action execute --action agent_package_activate --payload <json> --json',
    enabled: true,
    preparation_status: 'ready',
    reason_code: 'use_boundary_reconciliation_ready',
  });
  const fixtureAction = fastFixture.app_state.actions.find(
    (action: { action_id: string }) => action.action_id === 'agent_package_activate',
  );
  assert.deepEqual(fixtureAction.payload_fields, expectedActivationPolicy.payload_fields);
  assert.equal(JSON.stringify(fixtureAction).includes('settings_reload_codex_surface'), false);
  assert.equal(JSON.stringify(expectedActivationPolicy).includes('med-autoscience'), false);
  assert.equal(JSON.stringify(expectedActivationPolicy).includes('mas-scholar-skills'), false);
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
      installer: 'opl-install.sh --headless --skip-packages',
    },
  ]);
  assert.deepEqual(carrier.pre_formula_transition, {
    allowed: true,
    condition: 'homebrew_cask_receipt_present_and_formula_absent',
    carrier: 'framework_managed_install',
    locator: '~/.opl/one-person-lab',
    installer: 'opl-install.sh --headless --skip-packages',
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

test('App exposes three software objects while Framework owns Base and Packages lifecycle', () => {
  const policy = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', 'app-install-exposure-policy.json'), 'utf8'),
  );
  const lifecycle = policy.software_lifecycle;

  assert.deepEqual(lifecycle.public_objects, ['opl_base', 'opl_app', 'opl_packages']);
  assert.deepEqual(lifecycle.lifecycle_owners, {
    opl_base: 'one-person-lab',
    opl_app: 'one-person-lab-app',
    opl_packages: 'one-person-lab',
  });
  assert.deepEqual(lifecycle.app_mutation_scope, ['opl_app']);
  assert.equal(lifecycle.base_bootstrap.bootstrap_route, 'opl-install.sh --headless --skip-packages');
  assert.equal(lifecycle.base_bootstrap.app_must_not_implement_installer, true);
  assert.equal(lifecycle.ordinary_component_picker_allowed, false);
  assert.equal(lifecycle.legacy_component_mapping_allowed, false);
  assert.equal(lifecycle.packages_carrier_allowed, false);
  assert.deepEqual(lifecycle.transaction_internal_states, {
    opl_base: ['runtime_substrate', 'companion_tools'],
    opl_packages: ['capability_packages', 'codex_surface', 'workflow_profile'],
  });

  const invalid = structuredClone(policy);
  invalid.software_lifecycle.app_mutation_scope.push('opl_packages');
  assert.throws(
    () => validateInstallExposureRuntimeAndDistribution(invalid),
    /App mutation scope/,
  );
});

test('managed update payload and public actions use only the three software objects', () => {
  const release = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const gui = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageState = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const fastFixture = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', 'fixtures', 'opl-app-state-fast.fixture.json'), 'utf8'),
  );
  const lifecycle = release.managed_update_plane.software_lifecycle;
  const carrierReconcile = release.managed_update_plane.carrier_reconciliation;
  const guiManagedUpdate = gui.framework_surfaces.managed_update_plane;
  const guiEnvironment = gui.pages.settings_environment;
  const environmentPage = pageState.pages.find((page) => page.id === 'environment');
  const capabilitiesPage = pageState.pages.find((page) => page.id === 'capabilities');

  assert.doesNotThrow(() => validateReleaseChannelContract(release));
  assert.deepEqual(lifecycle.public_component_keys, ['opl_base', 'opl_app', 'opl_packages']);
  assert.deepEqual(lifecycle.objects.opl_base.optional_internal_fields, ['dependency_status', 'integration_status']);
  assert.deepEqual(lifecycle.objects.opl_app.required_fields, ['host_update_route', 'host_executor_required']);
  assert.deepEqual(lifecycle.objects.opl_packages.optional_internal_fields, ['projection_status', 'profile_migration_status']);
  assert.equal(lifecycle.public_actions.bootstrap_missing_opl_base, 'opl-install.sh --headless --skip-packages');
  assert.equal(lifecycle.public_actions.apply_eligible_updates, 'opl update apply --json');
  assert.match(lifecycle.public_actions.install_opl_package, /^opl packages install /);
  assert.equal(Object.values(lifecycle.public_actions).some((action) => String(action).includes('--component')), false);
  assert.equal('runtime_substrate_updater' in release, false);
  assert.equal('companion_tools_updater' in release, false);
  assert.equal('planes' in release.managed_update_plane, false);
  assert.equal(carrierReconcile.installation_source_scope, 'all_supported_app_carriers');
  assert.equal(
    carrierReconcile.installation_source_registry_ref,
    'contracts/app-install-exposure-policy.json#installer_surfaces+distribution_channels',
  );
  assert.equal(carrierReconcile.framework_execution.app_catalog_allowed, false);
  assert.equal(
    carrierReconcile.version_checkpoint.write_gate,
    'framework_reconciliation_terminal_readback_projected',
  );
  assert.equal(carrierReconcile.framework_execution.terminal_readback_required, true);
  assert.equal(carrierReconcile.framework_execution.lifecycle_receipt_required_when_apply_executed, true);
  assert.deepEqual(carrierReconcile.framework_execution.command_sequence, [
    'opl update check --json',
    'opl update plan --json',
    'opl update apply --json',
  ]);
  assert.deepEqual(carrierReconcile.framework_execution.auto_apply_gate, {
    eligibility_field: 'auto_apply.eligible',
    background_safety_field: 'app_background_safe',
    command_field: 'command_ref',
    required_boolean_value: true,
  });
  assert.equal('post_update_dependency_reconcile' in release.standard_updater, false);
  assert.equal('optimize_opl_flow' in lifecycle.public_actions, false);
  assert.equal(guiManagedUpdate.contract, 'contracts/app-release-channel.json#managed_update_plane.software_lifecycle');
  assert.deepEqual(guiManagedUpdate.software_objects, lifecycle.public_component_keys);
  assert.deepEqual(guiManagedUpdate.ui_actions, lifecycle.public_actions);
  assert.equal(guiManagedUpdate.ordinary_component_picker_allowed, false);
  assert.deepEqual(
    guiManagedUpdate.ordinary_module_maintenance_entry.manual_action_mapping,
    guiEnvironment.module_maintenance_entry.manual_action_mapping,
  );
  assert.deepEqual(
    guiEnvironment.module_maintenance_entry.manual_action_mapping,
    environmentPage.module_maintenance_entry.manual_action_mapping,
  );
  assert.equal(
    Object.values(guiEnvironment.module_maintenance_entry.manual_action_mapping)
      .some((action) => String(action).includes('--component')),
    false,
  );

  const invalidCarrierReconcile = structuredClone(release);
  invalidCarrierReconcile.managed_update_plane.carrier_reconciliation.framework_execution.auto_apply_gate.background_safety_field =
    'recommended_action';
  assert.throws(
    () => validateReleaseChannelContract(invalidCarrierReconcile),
    /auto-apply gate/,
  );
  assert.deepEqual(
    environmentPage.module_maintenance_entry.state_inputs,
    ['app_state.modules', 'managed_update.components[opl_packages].projection_status'],
  );
  assert.equal(
    capabilitiesPage.status_model.source_inputs.includes('managed_update.components[opl_packages].projection_status'),
    true,
  );
  assert.equal(capabilitiesPage.agent_package_lifecycle_ux.directory_controls.filters.includes('codex_surface'), true);
  assert.deepEqual(
    capabilitiesPage.agent_package_lifecycle_ux.package_projection_contract.status_index_package_fields.dependency_readiness_status_values,
    ['ready', 'repair_required', 'blocked'],
  );
  assert.equal(
    capabilitiesPage.agent_package_lifecycle_ux.package_projection_contract.status_index_package_fields.operational_ready,
    'boolean',
  );
  assert.equal(
    capabilitiesPage.agent_package_lifecycle_ux.package_projection_contract.repair_action_id,
    'repair_dependency_closure',
  );
  assert.deepEqual(
    capabilitiesPage.agent_package_lifecycle_ux.package_projection_contract.status_index_package_fields.allowed_when_blocked,
    ['status', 'doctor', 'repair'],
  );
  assert.equal(
    capabilitiesPage.agent_package_lifecycle_ux.package_projection_contract.launch_gate_policy,
    'operational_ready_false_requires_launch_allowed_false_and_only_status_doctor_repair_remain_allowed',
  );
  assert.deepEqual(
    capabilitiesPage.agent_package_lifecycle_ux.package_projection_contract.launch_fail_closed_reason_codes,
    ['package_not_installed'],
  );
  assert.equal(
    JSON.stringify(capabilitiesPage.agent_package_lifecycle_ux.package_projection_contract).includes('med-autoscience'),
    false,
  );
  const fixturePackage = fastFixture.app_state.agent_packages.status_index.packages['example-agent'];
  assert.equal(fixturePackage.dependency_readiness.status, 'ready');
  assert.equal(fixturePackage.operational_ready, true);
  assert.equal(fixturePackage.launch_allowed, true);
  assert.deepEqual(fixturePackage.allowed_when_blocked, ['status', 'doctor', 'repair']);
  assert.equal(fixturePackage.repair_action.action_id, 'repair_dependency_closure');
  assert.deepEqual(fixturePackage.dependent_guard.required_by_package_ids, []);

  const legacyComponent = structuredClone(release);
  legacyComponent.managed_update_plane.software_lifecycle.public_component_keys.push('runtime_substrate');
  assert.throws(() => validateReleaseChannelContract(legacyComponent), /public component keys/);
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
      `oma=${pluginRoot}`,
    ]);

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
