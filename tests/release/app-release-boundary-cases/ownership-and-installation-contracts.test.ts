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
import { forbiddenExternalFirstPartyClaimPattern } from '../../../scripts/app-product-profile-shared-validators.ts';

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

test('App package consumers separate the Framework first-party Release Set from external discovery', () => {
  const readContract = (name: string) => JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', name), 'utf8'),
  );
  const canonicalPackageIds = ['mas', 'mag', 'rca', 'oma', 'obf', 'mas-scholar-skills', 'opl-flow'];
  const expectedFirstPartyMetadata: Record<string, {
    description: string;
    tags: string[];
    package_role: string;
  }> = {
    mas: {
      description: 'Medical research workflows for evidence, analysis, writing, figures, and submission.',
      tags: ['medical-research', 'evidence', 'manuscript'],
      package_role: 'standard_agent',
    },
    mag: {
      description: 'Grant planning, drafting, critique, revision, and submission workflows.',
      tags: ['grant-writing', 'proposal', 'review'],
      package_role: 'standard_agent',
    },
    rca: {
      description: 'Visual deliverable, presentation, and figure production workflows.',
      tags: ['visual-deliverables', 'presentations', 'figures'],
      package_role: 'standard_agent',
    },
    oma: {
      description: 'Agent architecture, baseline, takeover, and OPL conformance workflows.',
      tags: ['agent-design', 'architecture', 'conformance'],
      package_role: 'standard_agent',
    },
    obf: {
      description: 'Long-form book architecture, drafting, review, and publication workflows.',
      tags: ['book-authoring', 'long-form', 'publishing'],
      package_role: 'standard_agent',
    },
    'mas-scholar-skills': {
      description: 'Reusable medical research capabilities consumed by Med Auto Science.',
      tags: ['medical-research', 'capabilities', 'skills'],
      package_role: 'framework_capability_package',
    },
    'opl-flow': {
      description: 'Recommended OPL workflow profile and managed Codex policy.',
      tags: ['workflow-profile', 'codex', 'policy'],
      package_role: 'workflow_profile',
    },
  };
  const registry = readContract('agent-package-registry.json');
  const profile = readContract('app-product-profile.json');
  const registryProjection = profile.gui.agent_package_registry;
  const registryEntrySchema = readContract('agent-package-surfaces.schema.json').$defs.agent_package_registry_entry;
  assert.equal(registry.purpose, 'external_agent_package_registry_catalog_contract');
  assert.equal(registry.registry_source_kind, 'default_external_registry');
  assert.equal(registry.empty_registry_allowed, true);
  assert.equal(registry.canonical_first_party_entries_allowed, false);
  assert.equal(registry.first_party_trust_claims_allowed, false);
  assert.deepEqual(registry.entries, []);
  assert.deepEqual(registryProjection.canonical_first_party_package_ids, canonicalPackageIds);
  assert.equal(registryProjection.first_party_runtime_authority, 'one-person-lab-framework#built_in_release_set');
  assert.equal(registryProjection.registry_scope, 'external_discovery_only');
  assert.equal(registryProjection.external_first_party_identity_claims_allowed, false);
  assert.equal(registryProjection.external_first_party_trust_claims_allowed, false);
  assert.equal(registryProjection.collision_failure_code, 'agent_package_registry_first_party_identity_collision');
  assert.deepEqual(
    registryEntrySchema.properties.package_role.enum,
    ['standard_agent', 'framework_capability_package', 'workflow_profile'],
  );
  assert.deepEqual(registryEntrySchema.properties.package_id.not.enum, canonicalPackageIds);
  assert.equal(registryEntrySchema.properties.source.not.pattern, forbiddenExternalFirstPartyClaimPattern);
  assert.equal(registryEntrySchema.properties.trust_tier.not.pattern, forbiddenExternalFirstPartyClaimPattern);
  for (const claim of ['first_party', 'First-Party', 'first party managed', 'first.party', 'firstPartyManaged']) {
    assert.match(claim, new RegExp(forbiddenExternalFirstPartyClaimPattern));
  }
  assert.equal(registryEntrySchema.properties.description.pattern, '\\S');
  assert.equal(registryEntrySchema.properties.tags.minItems, 1);
  assert.equal(registryEntrySchema.properties.tags.uniqueItems, true);
  assert.equal(registryEntrySchema.oneOf.length, 2);

  const releaseSetMetadata = registryProjection.first_party_release_set_metadata;
  assert.deepEqual(releaseSetMetadata.map((entry) => entry.package_id), canonicalPackageIds);
  for (const entry of releaseSetMetadata) {
    const expectedMetadata = expectedFirstPartyMetadata[entry.package_id];
    assert.ok(expectedMetadata, entry.package_id);
    assert.equal(entry.description, expectedMetadata.description);
    assert.deepEqual(entry.tags, expectedMetadata.tags);
    assert.equal(entry.package_role, expectedMetadata.package_role);
    assert.equal(entry.source, 'first_party');
    assert.equal(entry.trust_tier, 'first_party');
    assert.equal(
      entry.manifest_fixture_ref,
      `contracts/fixtures/agent-package-manifests/${entry.package_id}.json`,
    );
  }
  assert.deepEqual(
    new Set(releaseSetMetadata.map((entry) => entry.package_role)),
    new Set(['standard_agent', 'framework_capability_package', 'workflow_profile']),
  );

  const fixtureDir = path.join(appRoot, 'contracts', 'fixtures', 'agent-package-manifests');
  for (const packageId of canonicalPackageIds) {
    const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, `${packageId}.json`), 'utf8'));
    const metadata = releaseSetMetadata.find((entry) => entry.package_id === packageId);
    assert.equal(fixture.package_id, metadata.package_id);
    assert.equal(fixture.package_kind, metadata.package_kind);
    assert.equal(fixture.display_name, metadata.display_name);
    assert.equal(fixture.publisher, metadata.publisher);
    assert.equal(fixture.source, metadata.source);
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

test('default refresh registry has zero Framework-shaped first-party identity collisions', () => {
  const profile = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-product-profile.json'), 'utf8'),
  );
  const registry = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'agent-package-registry.json'), 'utf8'),
  );
  const builtInReleaseSet = new Set(profile.gui.agent_package_registry.canonical_first_party_package_ids);
  const identityCollisions = registry.entries.filter((entry) => builtInReleaseSet.has(entry.package_id));
  const firstPartyTrustClaims = registry.entries.filter((entry) =>
    entry.source === 'first_party' ||
    entry.source === 'first_party_release_catalog' ||
    entry.source === 'first_party_managed_cohort' ||
    /^first_party(?:$|_)/i.test(entry.trust_tier));

  assert.deepEqual(identityCollisions, []);
  assert.deepEqual(firstPartyTrustClaims, []);
  assert.equal(
    registry.reserved_identity_collision_failure_code,
    'agent_package_registry_first_party_identity_collision',
  );
});

test('agent installation validator rejects invalid external registry metadata and first-party claims', () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'agent-package-registry.json'), 'utf8'),
  );
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-agent-registry-invalid-'));
  const invalidRegistryPath = path.join(tempRoot, 'agent-package-registry.json');
  const invalidCases: Array<{
    name: string;
    mutate: (entry: any) => void;
    expected: RegExp;
  }> = [
    {
      name: 'invalid role',
      mutate: (entry) => { entry.package_role = 'domain_agent'; },
      expected: /package_role must be one of/,
    },
    {
      name: 'empty description',
      mutate: (entry) => { entry.description = '   '; },
      expected: /description must be non-empty/,
    },
    {
      name: 'empty tags',
      mutate: (entry) => { entry.tags = []; },
      expected: /tags must contain at least one non-empty tag/,
    },
    {
      name: 'duplicate tag',
      mutate: (entry) => { entry.tags = ['medical-research', 'medical-research']; },
      expected: /tags must not contain duplicates/,
    },
    {
      name: 'selected and stable version mismatch',
      mutate: (entry) => {
        entry.selected_version = '0.2.1';
        entry.stable_version = '0.2.0';
        entry.manifest_validation = 'fetched_manifest';
      },
      expected: /selected_version must equal stable_version/,
    },
    {
      name: 'version source mismatch',
      mutate: (entry) => { entry.version_source_ref = `${entry.manifest_url}#/latest`; },
      expected: /version source expected/,
    },
    {
      name: 'canonical first-party identity collision',
      mutate: (entry) => { entry.package_id = 'mas'; },
      expected: /agent_package_registry_first_party_identity_collision/,
    },
    {
      name: 'first-party source claim',
      mutate: (entry) => { entry.source = 'first_party'; },
      expected: /must not claim first-party source/,
    },
    {
      name: 'first-party trust claim',
      mutate: (entry) => { entry.trust_tier = 'first_party'; },
      expected: /must not claim first-party trust/,
    },
    {
      name: 'managed first-party trust claim',
      mutate: (entry) => { entry.trust_tier = 'first_party_managed'; },
      expected: /must not claim first-party trust/,
    },
    {
      name: 'managed-cohort first-party trust claim',
      mutate: (entry) => { entry.trust_tier = 'first_party_managed_cohort'; },
      expected: /must not claim first-party trust/,
    },
    {
      name: 'separated first-party source claim',
      mutate: (entry) => { entry.source = 'First Party Managed'; },
      expected: /must not claim first-party source/,
    },
    {
      name: 'camel-case first-party trust claim',
      mutate: (entry) => { entry.trust_tier = 'firstPartyManaged'; },
      expected: /must not claim first-party trust/,
    },
  ];
  const externalEntry = {
    package_id: 'community-review-tools',
    package_kind: 'capability_package',
    display_name: 'Community Review Tools',
    publisher: 'community.example',
    description: 'Third-party review helpers.',
    tags: ['review', 'community'],
    package_role: 'framework_capability_package',
    source: 'third_party',
    manifest_url: 'https://raw.githubusercontent.com/community/example/main/manifest.json',
    version_source_ref: 'https://raw.githubusercontent.com/community/example/main/manifest.json#/version',
    selected_version: null,
    stable_version: null,
    manifest_validation: 'deferred',
    trust_tier: 'third_party_unverified',
  };

  try {
    for (const invalidCase of invalidCases) {
      const invalidRegistry = structuredClone(registry);
      invalidRegistry.entries = [structuredClone(externalEntry)];
      invalidCase.mutate(invalidRegistry.entries[0]);
      writeFile(invalidRegistryPath, `${JSON.stringify(invalidRegistry, null, 2)}\n`);
      const result = runNode([
        'scripts/validate-agent-installation-contract.ts',
        '--registry-path',
        invalidRegistryPath,
      ]);
      assert.notEqual(result.status, 0, invalidCase.name);
      assert.match(result.stderr, invalidCase.expected, invalidCase.name);
    }
    for (const trustTier of [
      'third_party_verified',
      'third_party_unverified',
      'organization_reviewed',
      'user_assigned',
    ]) {
      const validRegistry = structuredClone(registry);
      validRegistry.entries = [{ ...structuredClone(externalEntry), trust_tier: trustTier }];
      writeFile(invalidRegistryPath, `${JSON.stringify(validRegistry, null, 2)}\n`);
      const result = runNode([
        'scripts/validate-agent-installation-contract.ts',
        '--registry-path',
        invalidRegistryPath,
      ]);
      assert.equal(result.status, 0, `${trustTier}: ${result.stderr || result.stdout}`);
    }
    for (const source of ['organization_registry', 'user_registry', 'community.catalog']) {
      const validRegistry = structuredClone(registry);
      validRegistry.entries = [{ ...structuredClone(externalEntry), source }];
      writeFile(invalidRegistryPath, `${JSON.stringify(validRegistry, null, 2)}\n`);
      const result = runNode([
        'scripts/validate-agent-installation-contract.ts',
        '--registry-path',
        invalidRegistryPath,
      ]);
      assert.equal(result.status, 0, `${source}: ${result.stderr || result.stdout}`);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
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
  const launchMatrix = readContract('fixtures/agent-package-launch-state-matrix.fixture.json');
  const activationResults = readContract('fixtures/agent-package-activation-results.fixture.json');

  const expectedActivationPolicy = guiProduct.agent_package_activation_policy;
  assert.equal(expectedActivationPolicy.projection_source, 'app_state.agent_packages.directory.entries[].use_boundary_action');
  assert.equal(expectedActivationPolicy.projection_scope, 'installed_standard_agent_only');
  assert.equal(
    expectedActivationPolicy.projection_independence,
    'independent_from_lifecycle_available_actions_recommended_action_and_status_index_activation_action',
  );
  assert.equal(expectedActivationPolicy.request_scoped_projection_policy.producer_cli_route, null);
  assert.equal(
    expectedActivationPolicy.request_scoped_projection_policy.result_schema_ref,
    'contracts/agent-package-surfaces.schema.json#/$defs/agent_package_session_launch_projection',
  );
  assert.equal(
    expectedActivationPolicy.request_scoped_projection_policy.settings_global_status_source,
    'app_state.paths.workspace_root_path_allowed',
  );
  assert.equal(
    expectedActivationPolicy.request_scoped_projection_policy.session_target_source,
    'normalized_selected_local_directory',
  );
  assert.match(
    expectedActivationPolicy.request_scoped_projection_policy.global_workspace_root_policy,
    /never_call_workspace_root_set/,
  );
  assert.deepEqual(expectedActivationPolicy.result_fields, [
    'launch_allowed',
    'launch_blocked_reason',
    'use_boundary_id',
    'use_receipt_ref',
    'use_binding',
  ]);
  assert.equal(expectedActivationPolicy.result_contract.canonical_binding_field, 'use_binding');
  assert.match(expectedActivationPolicy.result_contract.temporary_alias_policy, /alias_only_never_satisfies/);
  assert.deepEqual(expectedActivationPolicy.transition_policy.prelaunch_transition_reason_codes, [
    'scope_reconciliation_required',
    'live_verification_deferred',
    'use_boundary_reconciliation_ready',
  ]);
  assert.equal(expectedActivationPolicy.transition_policy.hard_block_reason_codes.includes('package_recovery_required'), true);
  assert.match(expectedActivationPolicy.transition_policy.blocked_result_write_policy, /zero_scope_use_and_activation_receipt_delta/);
  assert.equal(
    expectedActivationPolicy.recovery_state_policy.framework_vocabulary.vocabulary_version,
    'opl-agent-package-recovery.v1',
  );
  assert.deepEqual(expectedActivationPolicy.recovery_state_policy.launch_blocked_reason_by_status, {
    recovery_in_progress: 'package_recovery_in_progress',
    recovery_required: 'package_recovery_required',
  });
  assert.equal(
    expectedActivationPolicy.recovery_state_policy.repair_action_policy.recovery_required_executable
      .required_recovery_action_executable,
    true,
  );
  assert.equal(
    expectedActivationPolicy.recovery_state_policy.repair_action_policy.recovery_required_manual_owner_intervention
      .required_recovery_action_executable,
    false,
  );
  assert.equal(expectedActivationPolicy.single_use_policy.token_scope, 'globally_unique_within_agent_package_use_ledger');
  assert.deepEqual(expectedActivationPolicy.single_use_policy.conflict_reason_codes, [
    'agent_package_use_boundary_replay_conflict',
    'agent_package_use_boundary_replay_stale',
  ]);
  assert.match(expectedActivationPolicy.single_use_policy.exact_retry_policy, /zero_new_writes/);
  assert.match(expectedActivationPolicy.single_use_policy.receipt_index_policy, /indexed_by_use_boundary_id/);
  assert.deepEqual(expectedActivationPolicy.workspace_transition_policy.stale_on, [
    'workspace_root_change',
    'local_to_worktree',
    'worktree_to_local',
    'workspace_cleanup',
    'workspace_restore',
  ]);
  assert.match(expectedActivationPolicy.workspace_transition_policy.failure_policy, /zero_warmup_zero_runtime_task_zero_turn_zero_message/);
  assert.equal(
    expectedActivationPolicy.host_launch_authorization_policy.enforcement_owner,
    'opl_aion_shell_OPL_adapter_or_OPL_owned_local_gateway',
  );
  assert.equal(
    expectedActivationPolicy.host_launch_authorization_policy.aioncore_write_policy,
    'forbid_OPL_domain_semantics_ledger_DB_migration_or_launch_gate_changes',
  );
  assert.equal(
    expectedActivationPolicy.host_launch_authorization_policy.current_p0_scope,
    'normal_OPL_shell_package_launch_path',
  );
  assert.equal(
    expectedActivationPolicy.host_launch_authorization_policy.renderer_extra_role,
    'persistence_and_transport_only_after_deep_validation_not_independent_authority',
  );
  assert.deepEqual(expectedActivationPolicy.host_launch_authorization_policy.protected_boundaries, [
    'conversation_create',
    'conversation_warmup',
    'runtime_ensure',
    'turn_or_message_send_build',
  ]);
  assert.match(
    expectedActivationPolicy.host_launch_authorization_policy.normal_path_failure_policy,
    /block_before_calling_create_warmup_runtime_ensure_or_send/,
  );
  assert.equal(
    expectedActivationPolicy.host_launch_authorization_policy.deferred_hardening.release_blocking_for_26_7_14,
    false,
  );
  assert.equal(
    expectedActivationPolicy.host_launch_authorization_policy.deferred_hardening.aioncore_domain_semantics_allowed,
    false,
  );
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
  assert.equal(packageRow.allowed_action_refs.includes('agent_package_repair'), true);
  assert.equal(packageRow.allowed_action_refs.includes('repair_dependency_closure'), false);
  assert.deepEqual(packageRow.use_boundary_activation_contract, expectedActivationPolicy);

  const agentsProjection = guiProduct.pages.settings_agents.agent_package_lifecycle_ux.package_projection_contract;
  assert.deepEqual(
    agentsProjection.status_index_package_fields.activation_action,
    ['action_id', 'command_ref', 'enabled', 'preparation_status', 'reason_code'],
  );
  assert.deepEqual(
    agentsProjection.activation_preparation_status_values,
    ['not_installed', 'prepare_required', 'ready'],
  );
  assert.deepEqual(agentsProjection.activation_preparation_policy, expectedActivationStates);
  assert.deepEqual(
    pageState.pages.find((page: { id: string }) => page.id === 'agents')
      .agent_package_lifecycle_ux.package_projection_contract,
    agentsProjection,
  );
  const profilePackageSurface = productProfile.settings.control_plane.page_adapter_policy.required_pages
    .agents.directory_projection_surface;
  assert.equal(profilePackageSurface.surface, 'settings_agents');
  assert.equal(
    profilePackageSurface.activation_action_contract_ref,
    'contracts/app-gui-product-contract.json#pages.settings_agents.agent_package_lifecycle_ux.workspace_activation_contract',
  );
  assert.equal(profilePackageSurface.status_model.axes.includes('activation_action'), true);
  assert.equal(profilePackageSurface.detail_surface.detail_fields.includes('activation_action'), true);

  assert.deepEqual(packageSurfaces.$defs.agent_package_activation_request.required, [
    'package_id',
    'scope',
    'use_boundary_id',
  ]);
  assert.deepEqual(packageSurfaces.$defs.agent_package_activation_result.required, ['launch_allowed', 'use_boundary_id']);
  assert.equal(packageSurfaces.$defs.agent_package_activation_result.oneOf.length, 2);
  assert.deepEqual(packageSurfaces.$defs.agent_package_activation_result.oneOf[0].required, [
    'use_receipt_ref',
    'use_binding',
  ]);
  assert.deepEqual(packageSurfaces.$defs.agent_package_activation_result.oneOf[1].required, [
    'launch_blocked_reason',
  ]);
  assert.deepEqual(packageSurfaces.$defs.agent_package_activation_action.required, [
    'action_id',
    'command_ref',
    'enabled',
    'preparation_status',
    'reason_code',
  ]);
  assert.deepEqual(packageSurfaces.$defs.agent_package_use_boundary_action.required, [
    'surface_kind',
    'action_id',
    'action_ref',
    'payload',
    'required_payload_fields',
    'confirmation_required',
    'use_boundary_id',
    'directory_entry_ref',
    'readiness_ref',
    'enabled',
    'preparation_status',
    'reason_code',
    'blocker',
  ]);
  assert.equal(
    packageSurfaces.$defs.agent_package_activation_request.allOf.length,
    2,
    'workspace and quest payload targets must be mutually exclusive',
  );
  assert.deepEqual(packageSurfaces.$defs.agent_package_use_binding.required, [
    'surface_kind',
    'use_boundary_id',
    'use_receipt_ref',
    'root_package',
    'provider_packages',
    'dependency_closure_digest',
    'freshness_mode',
    'latest_verified',
    'checked_at',
    'refresh_outcome',
    'channel_ref',
    'channel_digest',
    'scope',
    'target_root',
    'core_skill_tree_digest',
    'skill_tree_digest',
    'core_readiness',
    'specialty_exposure',
  ]);
  assert.equal(
    packageSurfaces.$defs.agent_package_use_binding.properties.surface_kind.const,
    'opl_agent_package_use_binding.v1',
  );
  assert.deepEqual(packageSurfaces.$defs.agent_package_use_binding_package.required, [
    'package_id',
    'package_version',
    'owner_language_version',
    'package_lock_ref',
    'manifest_sha256',
    'content_digest',
    'source_artifact_ref',
    'artifact_digest',
    'owner_source_commit',
    'carrier_authority',
  ]);
  assert.deepEqual(
    packageSurfaces.$defs.agent_package_activation_result.dependentRequired.package_use_binding,
    ['use_binding'],
  );
  assert.equal(
    packageSurfaces.$defs.agent_package_session_launch_projection.properties.surface_kind.const,
    'opl_agent_package_session_launch_projection.v1',
  );
  assert.equal(
    packageSurfaces.$defs.agent_package_session_launch_projection.properties.writes_performed.const,
    false,
  );

  const fixtureStatus = fastFixture.app_state.agent_packages.status_index.packages.mas;
  assert.equal(fixtureStatus.source_kind, 'first_party_managed_cohort');
  assert.equal(fixtureStatus.physical_surface.status, 'materialized');
  assert.equal(
    fixtureStatus.dependency_readiness.checks[0].physical_surface_status,
    'materialized',
  );
  assert.deepEqual(fixtureStatus.activation_action, {
    action_id: 'agent_package_activate',
    command_ref: 'opl app action execute --action agent_package_activate --payload <json> --json',
    enabled: true,
    preparation_status: 'ready',
    reason_code: 'use_boundary_reconciliation_ready',
  });
  assert.deepEqual(fixtureStatus.capability_exposure, {
    enabled: true,
    visibility: 'visible',
    codex_visible: true,
  });
  const fastDirectoryEntries = fastFixture.app_state.agent_packages.directory.entries;
  const deferredEntry = fastDirectoryEntries.find((entry: { package_id: string }) => entry.package_id === 'mas');
  assert.equal(deferredEntry.use_boundary_action.preparation_status, 'verification_deferred');
  assert.equal(deferredEntry.use_boundary_action.reason_code, 'live_verification_deferred');
  assert.deepEqual(deferredEntry.use_boundary_action.payload, {
    package_id: 'mas',
    scope: 'workspace',
    target_workspace: '/Users/example/OPL Workspace',
    use_boundary_id: deferredEntry.use_boundary_action.use_boundary_id,
  });
  assert.equal(
    fastDirectoryEntries.find((entry: { package_id: string }) => entry.package_id === 'obf').use_boundary_action,
    null,
  );

  const launchCases = new Map(launchMatrix.cases.map((entry: { case_id: string }) => [entry.case_id, entry]));
  for (const caseId of [
    'ready_visible_enabled',
    'verification_deferred_visible_enabled',
    'activation_required_visible_enabled',
    'hidden_enabled_standard_agent',
  ]) {
    const launchCase: any = launchCases.get(caseId);
    assert.equal(launchCase.activation_must_execute, true, caseId);
    assert.equal(launchCase.use_boundary_action.enabled, true, caseId);
    assert.equal(
      launchCase.use_boundary_action.payload.use_boundary_id,
      launchCase.use_boundary_action.use_boundary_id,
      caseId,
    );
  }
  const disabledCase: any = launchCases.get('disabled_visible_standard_agent');
  assert.deepEqual(disabledCase.exposure, { enabled: false, visibility: 'visible', codex_visible: false });
  assert.equal(disabledCase.activation_must_execute, false);
  assert.equal(disabledCase.use_boundary_action.enabled, false);
  assert.equal(disabledCase.use_boundary_action.reason_code, 'package_disabled');
  const hiddenCase: any = launchCases.get('hidden_enabled_standard_agent');
  assert.equal(hiddenCase.ordinary_discovery_visible, false);
  assert.equal(hiddenCase.retained_shortcut_launch_allowed_after_activation, true);
  assert.equal(hiddenCase.use_boundary_action.enabled, true);
  assert.deepEqual(launchMatrix.exposure_state.transitions, {
    hide: { enabled: 'preserve', visibility: 'hidden' },
    unhide: { enabled: 'preserve', visibility: 'visible' },
    disable: { enabled: false, visibility: 'preserve' },
    enable: { enabled: true, visibility: 'preserve' },
  });
  for (const caseId of [
    'not_installed_standard_agent',
    'installed_capability_package',
    'installed_workflow_profile',
  ]) {
    assert.equal((launchCases.get(caseId) as any).use_boundary_action, null, caseId);
  }
  for (const caseId of [
    'installed_standard_agent_lock_corrupt',
    'recovery_in_progress',
    'recovery_required_executable',
    'recovery_required_manual_owner_intervention',
  ]) {
    const launchCase: any = launchCases.get(caseId);
    assert.equal(launchCase.activation_must_execute, false, caseId);
    assert.equal(launchCase.use_boundary_action.enabled, false, caseId);
    assert.deepEqual(launchCase.expected_receipt_delta, {
      scope: 0,
      use: 0,
      activation: 0,
    });
  }
  for (const caseId of [
    'recovery_in_progress',
    'recovery_required_executable',
    'recovery_required_manual_owner_intervention',
  ]) {
    const launchCase: any = launchCases.get(caseId);
    assert.deepEqual(launchCase.read_surfaces_are_pure, ['fast', 'list', 'status', 'dry_run'], caseId);
    assert.equal(launchCase.owner_token_exposed, false, caseId);
  }
  const recoveryInProgress: any = launchCases.get('recovery_in_progress');
  assert.equal(recoveryInProgress.framework_recovery_projection.recovery_action_state, 'wait_only');
  assert.equal(recoveryInProgress.status_index_repair_action.enabled, false);
  assert.equal(recoveryInProgress.directory_repair_action, null);
  const executableRecovery: any = launchCases.get('recovery_required_executable');
  assert.equal(executableRecovery.framework_recovery_projection.recovery_action_state, 'executable');
  assert.equal(executableRecovery.status_index_repair_action.enabled, true);
  assert.equal(executableRecovery.directory_repair_action.action_id, 'agent_package_repair');
  const manualRecovery: any = launchCases.get('recovery_required_manual_owner_intervention');
  assert.equal(
    manualRecovery.framework_recovery_projection.recovery_action_state,
    'manual_owner_intervention_required',
  );
  assert.equal(manualRecovery.status_index_repair_action.enabled, false);
  assert.equal(manualRecovery.directory_repair_action, null);

  const hasExactFields = (value: any, expected: string[]) => value
    && typeof value === 'object'
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
  const bindingFields = packageSurfaces.$defs.agent_package_use_binding.required;
  const bindingPackageFields = packageSurfaces.$defs.agent_package_use_binding_package.required;
  const activationResultConformsToPublicContract = (result: any) => {
    if (
      typeof result?.launch_allowed !== 'boolean'
      || typeof result?.use_boundary_id !== 'string'
      || !result.use_boundary_id
      || ['recovery_in_progress', 'recovery_required'].includes(result.launch_blocked_reason)
    ) {
      return false;
    }
    if (result.launch_allowed) {
      if (typeof result.use_receipt_ref !== 'string' || !result.use_receipt_ref || !result.use_binding) return false;
      if (!hasExactFields(result.use_binding, bindingFields)) return false;
      if (result.use_binding.surface_kind !== 'opl_agent_package_use_binding.v1') return false;
      if (!hasExactFields(result.use_binding.root_package, bindingPackageFields)) return false;
      if (result.use_binding.root_package.package_id !== result.package_id) return false;
      if (!Array.isArray(result.use_binding.provider_packages)) return false;
      if (result.use_binding.provider_packages.some((entry: any) => !hasExactFields(entry, bindingPackageFields))) return false;
      if (
        result.package_use_binding !== undefined
        && JSON.stringify(result.package_use_binding) !== JSON.stringify(result.use_binding)
      ) return false;
      return result.use_binding.use_boundary_id === result.use_boundary_id
        && result.use_binding.use_receipt_ref === result.use_receipt_ref;
    }
    return typeof result.launch_blocked_reason === 'string'
      && result.launch_blocked_reason.length > 0
      && (result.use_receipt_ref === null || result.use_receipt_ref === undefined)
      && (result.use_binding === null || result.use_binding === undefined)
      && (result.package_use_binding === null || result.package_use_binding === undefined);
  };
  assert.equal(
    activationResults.framework_binding_admission.status,
    'pending_exact_Framework_producer_checkpoint',
  );
  assert.equal(activationResults.framework_binding_admission.producer_commit, null);
  assert.equal(
    activationResults.framework_binding_admission.fixture_role,
    'App_design_authority_only_not_cross_repo_admission_evidence',
  );
  assert.equal(activationResults.framework_binding_admission.cross_repo_admission_satisfied, false);
  assert.deepEqual(
    activationResults.framework_binding_admission.required_admission_consumers,
    ['App_schema', 'App_validator', 'Shell_parser'],
  );
  for (const example of activationResults.cases) {
    const result = example.result;
    assert.equal(activationResultConformsToPublicContract(result), true, example.case_id);
    if (result.launch_allowed) {
      assert.equal(typeof result.use_receipt_ref, 'string', example.case_id);
      assert.equal(typeof result.use_binding, 'object', example.case_id);
      assert.equal(result.use_binding.use_receipt_ref, result.use_receipt_ref, example.case_id);
      assert.equal(result.use_binding.use_boundary_id, result.use_boundary_id, example.case_id);
    } else {
      assert.equal(typeof result.launch_blocked_reason, 'string', example.case_id);
      assert.equal(result.use_receipt_ref, null, example.case_id);
      assert.equal(result.use_binding, null, example.case_id);
      assert.equal(result.writes_performed, false, example.case_id);
    }
  }
  const activationCases = new Map(activationResults.cases.map((entry: { case_id: string }) => [entry.case_id, entry]));
  const canonicalSuccess = structuredClone((activationCases.get('ready_live') as any).result);
  const compatibleAlias = structuredClone(canonicalSuccess);
  compatibleAlias.package_use_binding = structuredClone(compatibleAlias.use_binding);
  assert.equal(activationResultConformsToPublicContract(compatibleAlias), true, 'deep-identical alias may migrate');
  const aliasOnly = structuredClone(canonicalSuccess);
  aliasOnly.package_use_binding = structuredClone(aliasOnly.use_binding);
  delete aliasOnly.use_binding;
  assert.equal(activationResultConformsToPublicContract(aliasOnly), false, 'alias-only success must fail');
  const aliasRootDrift = structuredClone(compatibleAlias);
  aliasRootDrift.package_use_binding.root_package.package_lock_ref = 'opl://drift/root-lock';
  assert.equal(activationResultConformsToPublicContract(aliasRootDrift), false, 'alias root drift must fail');
  const aliasProviderDrift = structuredClone(compatibleAlias);
  aliasProviderDrift.package_use_binding.provider_packages[0].package_version = '9.9.9';
  assert.equal(activationResultConformsToPublicContract(aliasProviderDrift), false, 'alias provider drift must fail');
  const invalidSurface = structuredClone(canonicalSuccess);
  invalidSurface.use_binding.surface_kind = 'opl_agent_package_use_binding';
  assert.equal(activationResultConformsToPublicContract(invalidSurface), false, 'unversioned binding must fail');
  const rootIdentityDrift = structuredClone(canonicalSuccess);
  rootIdentityDrift.use_binding.root_package.package_id = 'different-root';
  assert.equal(activationResultConformsToPublicContract(rootIdentityDrift), false, 'root identity drift must fail');
  const missingBinding = structuredClone(canonicalSuccess);
  delete missingBinding.use_binding;
  assert.equal(activationResultConformsToPublicContract(missingBinding), false, 'success without binding must fail');
  const blockedWithoutReason = structuredClone((activationCases.get('not_installed') as any).result);
  delete blockedWithoutReason.launch_blocked_reason;
  assert.equal(activationResultConformsToPublicContract(blockedWithoutReason), false, 'blocked result without reason must fail');
  assert.deepEqual(
    (activationCases.get('exact_retry_live') as any).result,
    (activationCases.get('ready_live') as any).result,
  );
  assert.deepEqual((activationCases.get('exact_retry_live') as any).invocation_write_delta, {
    package_transaction: 0,
    scope_receipt: 0,
    use_receipt: 0,
    activation_receipt: 0,
  });
  assert.equal(
    (activationCases.get('replay_identity_conflict') as any).result.launch_blocked_reason,
    'agent_package_use_boundary_replay_conflict',
  );
  assert.equal(
    (activationCases.get('replay_currentness_stale') as any).result.launch_blocked_reason,
    'agent_package_use_boundary_replay_stale',
  );
  assert.notEqual(
    (activationCases.get('fresh_token_after_refresh') as any).result.use_boundary_id,
    (activationCases.get('fresh_token_after_refresh') as any).previous_use_boundary_id,
  );
  const workspaceCases = new Map(launchMatrix.workspace_transition_contract.cases.map(
    (entry: { case_id: string }) => [entry.case_id, entry],
  ));
  assert.equal((workspaceCases.get('workspace_a_to_b') as any).old_token_can_authorize_new_root, false);
  assert.equal(
    (workspaceCases.get('workspace_a_to_b') as any).failure_effect,
    'zero_warmup_zero_runtime_task_zero_turn_zero_message',
  );
  assert.equal((workspaceCases.get('plain_conversation_workspace_transition') as any).activation_required, false);
  const projectionCases = new Map(launchMatrix.request_scoped_projection_contract.cases.map(
    (entry: { case_id: string }) => [entry.case_id, entry],
  ));
  const globalAndSession: any = projectionCases.get('global_A_session_B_zero_write');
  assert.equal(
    globalAndSession.settings_global_workspace_root_before,
    globalAndSession.settings_global_workspace_root_after,
  );
  assert.notEqual(
    globalAndSession.settings_global_workspace_root_before,
    globalAndSession.selected_session_target_workspace,
  );
  assert.equal(globalAndSession.projection_result.writes_performed, false);
  assert.equal(globalAndSession.projection_result.global_workspace_root_unchanged, true);
  assert.equal(globalAndSession.workspace_root_set_called, false);
  assert.equal(
    globalAndSession.projection_result.use_boundary_action.payload.target_workspace,
    globalAndSession.selected_session_target_workspace,
  );
  const selectedProjectionEntry = globalAndSession.projection_result.directory.entries.find(
    (entry: any) => entry.package_id === globalAndSession.projection_result.package_id,
  );
  assert.deepEqual(
    globalAndSession.projection_result.use_boundary_action,
    selectedProjectionEntry.use_boundary_action,
  );
  assert.equal((projectionCases.get('rapid_A_to_B_discards_late_A') as any).late_A_response_discarded, true);
  assert.equal(
    (projectionCases.get('rapid_A_to_B_discards_late_A') as any).cache_and_inflight_key_includes_normalized_target,
    true,
  );
  const projectless: any = projectionCases.get('projectless_package_launch');
  assert.equal(projectless.activation_executed, false);
  assert.equal(projectless.launch_allowed, false);
  assert.equal(projectless.reason_code, 'agent_package_target_workspace_required');
  const transitionToC: any = projectionCases.get('session_B_to_C_transition');
  assert.equal(transitionToC.fresh_projection_target_workspace, transitionToC.new_target_workspace);
  assert.deepEqual(transitionToC.fresh_projection_required_before, [
    'conversation_warmup',
    'runtime_ensure',
    'turn_or_message_send_build',
  ]);
  const targetDrift: any = projectionCases.get('projection_target_drift');
  assert.equal(targetDrift.accepted, false);
  assert.deepEqual(targetDrift.write_delta, {
    conversation: 0,
    message: 0,
    turn: 0,
    runtime_task: 0,
  });
  const hostCases = new Map(launchMatrix.host_launch_authorization_contract.cases.map(
    (entry: { case_id: string }) => [entry.case_id, entry],
  ));
  assert.equal(
    launchMatrix.host_launch_authorization_contract.enforcement_owner,
    'opl_aion_shell_OPL_adapter_or_OPL_owned_local_gateway',
  );
  assert.equal(
    launchMatrix.host_launch_authorization_contract.aioncore_write_policy,
    'forbid_OPL_domain_semantics_ledger_DB_migration_or_launch_gate_changes',
  );
  assert.deepEqual(launchMatrix.host_launch_authorization_contract.current_p0_case_ids, [
    'normal_shell_create_missing_or_invalid_activation',
    'warmup_or_send_stale_workspace',
    'normal_shell_valid_activation',
    'plain_conversation',
  ]);
  assert.equal(
    launchMatrix.host_launch_authorization_contract.deferred_hardening.release_blocking_for_26_7_14,
    false,
  );
  assert.deepEqual(launchMatrix.host_launch_authorization_contract.deferred_hardening.case_ids, [
    'direct_create_missing_or_forged_binding',
    'same_token_two_conversations',
    'clone_reuses_source_extra',
    'exact_create_retry_same_conversation',
  ]);
  for (const caseId of launchMatrix.host_launch_authorization_contract.current_p0_case_ids) {
    assert.equal((hostCases.get(caseId) as any).scope, 'current_p0');
  }
  for (const caseId of launchMatrix.host_launch_authorization_contract.deferred_hardening.case_ids) {
    assert.equal((hostCases.get(caseId) as any).scope, 'deferred_hardening');
  }
  const invalidNormalCreate: any = hostCases.get('normal_shell_create_missing_or_invalid_activation');
  assert.equal(invalidNormalCreate.accepted, false);
  assert.equal(invalidNormalCreate.downstream_create_called, false);
  assert.deepEqual(invalidNormalCreate.write_delta, {
    conversation: 0,
    message: 0,
    turn: 0,
    runtime_task: 0,
  });
  const stalePreRuntime: any = hostCases.get('warmup_or_send_stale_workspace');
  assert.equal(stalePreRuntime.accepted, false);
  assert.deepEqual(stalePreRuntime.protected_boundaries, [
    'conversation_warmup',
    'runtime_ensure',
    'turn_or_message_send_build',
  ]);
  assert.deepEqual(stalePreRuntime.write_delta, { message: 0, turn: 0, runtime_task: 0 });
  const validNormalActivation: any = hostCases.get('normal_shell_valid_activation');
  assert.equal(validNormalActivation.accepted, true);
  assert.equal(validNormalActivation.deep_validation_passed, true);
  assert.equal(validNormalActivation.canonical_use_receipt_ref_forwarded, true);
  assert.equal(validNormalActivation.canonical_use_binding_persisted, true);
  assert.equal(validNormalActivation.downstream_create_called, true);
  assert.equal((hostCases.get('plain_conversation') as any).accepted, true);
  assert.equal((hostCases.get('plain_conversation') as any).activation_required, false);
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

test('local data lifecycle separates runtime inventory from managed prune and canonical delete authority', () => {
  const release = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const localDataLifecycle = release.local_data_lifecycle;
  const runtime = localDataLifecycle.runtime_substrate;
  const deleteBoundary = localDataLifecycle.user_data_artifacts.delete_execution_boundary;

  assert.doesNotThrow(() => validateReleaseChannelContract(release));
  const missingShellRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-local-data-shell-'));
  try {
    assert.throws(
      () => validateReleaseChannelContract(release, { shellRoot: missingShellRoot }),
      /Missing active shell implementation file .*localDataLifecycleBridge/,
    );
  } finally {
    fs.rmSync(missingShellRoot, { recursive: true, force: true });
  }
  assert.deepEqual(
    runtime.inventory_roots.map((root) => root.id),
    ['shell_toolchain_runtime', 'managed_opl_runtime'],
  );
  assert.equal(runtime.prune_authority_root, 'managed_opl_runtime');
  const managedRuntimeRoot = runtime.inventory_roots.find((root) => root.id === 'managed_opl_runtime');
  assert.equal(managedRuntimeRoot.default_platform, 'darwin');
  assert.equal(managedRuntimeRoot.non_darwin_without_override, 'blocked');
  assert.equal(
    runtime.authority_gate.missing_or_invalid_authority,
    'blocked_no_candidates_no_execute',
  );
  assert.equal(deleteBoundary.canonical_verifier, 'verifyConversationArchiveReceipt');

  const conflatedRuntimeRoots = structuredClone(release);
  conflatedRuntimeRoots.local_data_lifecycle.runtime_substrate.inventory_roots[0].derivation =
    "app.getPath('userData')/runtime";
  assert.throws(
    () => validateReleaseChannelContract(conflatedRuntimeRoots),
    /runtime inventory roots/,
  );

  const markerOptional = structuredClone(release);
  markerOptional.local_data_lifecycle.runtime_substrate.authority_gate.current_target_marker = null;
  assert.throws(
    () => validateReleaseChannelContract(markerOptional),
    /fail closed on managed OPL authority and marker checks/,
  );

  const verifierBypassed = structuredClone(release);
  verifierBypassed.local_data_lifecycle.user_data_artifacts.delete_execution_boundary.canonical_verifier =
    'readJsonRecord';
  assert.throws(
    () => validateReleaseChannelContract(verifierBypassed),
    /canonical archive verifier/,
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
  const agentsPage = pageState.pages.find((page) => page.id === 'agents');

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
  assert.deepEqual(carrierReconcile.framework_execution.projection_prefetch, {
    command: 'opl update status --json',
    publish_when: 'valid_typed_status_readback_available',
    purpose: 'make_framework_typed_state_available_before_network_check_and_plan_complete',
    failure_policy: 'continue_reconciliation_without_clearing_last_valid_projection',
  });
  assert.deepEqual(carrierReconcile.framework_execution.command_sequence, [
    'opl update check --json',
    'opl update plan --json',
    'opl update apply --json',
    'opl update status --json',
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
    agentsPage.status_model.source_inputs.includes('managed_update.components[opl_packages].projection_status'),
    true,
  );
  assert.deepEqual(
    agentsPage.agent_package_lifecycle_ux.directory_controls.filters,
    ['package_role', 'install_or_activation_status', 'source'],
  );
  assert.deepEqual(
    agentsPage.agent_package_lifecycle_ux.package_projection_contract.status_index_package_fields.dependency_readiness_status_values,
    ['ready', 'repair_required', 'blocked'],
  );
  assert.equal(
    agentsPage.agent_package_lifecycle_ux.package_projection_contract.status_index_package_fields.operational_ready,
    'boolean',
  );
  assert.equal(
    agentsPage.agent_package_lifecycle_ux.package_projection_contract.status_index_repair_action_id,
    'agent_package_repair',
  );
  assert.deepEqual(
    agentsPage.agent_package_lifecycle_ux.package_projection_contract.status_index_package_fields.allowed_when_blocked,
    ['status', 'doctor', 'repair'],
  );
  assert.equal(
    agentsPage.agent_package_lifecycle_ux.package_projection_contract.launch_gate_policy,
    'directory readiness remains positive eligibility authority, while live_verification_deferred is a prelaunch transition that must execute the independent use_boundary_action; no local relabeling may promote readiness',
  );
  assert.deepEqual(
    agentsPage.agent_package_lifecycle_ux.package_projection_contract.launch_fail_closed_reason_codes,
    ['package_not_installed', 'package_disabled', 'package_status_read_failed', 'package_dependency_missing', 'package_dependency_incompatible', 'physical_surface_not_ready', 'runtime_source_missing', 'runtime_source_incompatible', 'carrier_authority_invalid', 'package_lock_corrupt', 'package_ledger_corrupt', 'package_recovery_in_progress', 'package_recovery_required'],
  );
  assert.equal(
    JSON.stringify(agentsPage.agent_package_lifecycle_ux.package_projection_contract).includes('med-autoscience'),
    false,
  );
  const fixturePackage = fastFixture.app_state.agent_packages.status_index.packages.mas;
  assert.equal(fixturePackage.dependency_readiness.status, 'ready');
  assert.equal(fixturePackage.package_dependency_readiness.status, 'current');
  assert.equal(fixturePackage.operational_ready, false);
  assert.equal(fixturePackage.launch_allowed, false);
  assert.deepEqual(fixturePackage.allowed_when_blocked, ['status', 'doctor', 'repair']);
  assert.equal(fixturePackage.repair_action.action_id, 'agent_package_repair');
  assert.deepEqual(fixturePackage.dependent_guard.required_by_package_ids, []);
  assert.equal(fixturePackage.action_receipt_ref, 'opl://agent-package/install/mas/fixture');
  assert.equal(fixturePackage.rollback_ref, 'rollback-ref:mas/previous');
  assert.equal(fixturePackage.physical_surface.status, 'materialized');
  assert.deepEqual(fixturePackage.physical_surface.materialized_required_skill_ids, ['medical-research']);

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
