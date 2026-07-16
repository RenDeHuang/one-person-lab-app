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
    version: '26.6.4-nightly.r1',
    target: 'Casks/one-person-lab-nightly.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.4-nightly.r1'),
    write: true,
  });
  assert.equal(nightlyResult.status, 0, nightlyResult.stderr || nightlyResult.stdout);
  assert.equal(JSON.parse(nightlyResult.stdout).targets[0].path, 'Casks/one-person-lab-nightly.rb');
  const nightlyPlanRootCask = fs.readFileSync(path.join(tapRoot, 'Casks', 'one-person-lab-nightly.rb'), 'utf8');
  assert.match(nightlyPlanRootCask, /livecheck do[\s\S]*skip "Nightly casks track prerelease cohorts through App release automation"/);

  const nightlyToStable = runTap({
    channel: 'nightly',
    version: '26.6.4-nightly.r1',
    target: 'Casks/one-person-lab.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.4-nightly.r1'),
  });
  assert.notEqual(nightlyToStable.status, 0);
  assert.match(nightlyToStable.stderr, /Nightly Homebrew tap updates may only update the Nightly App cask target/);

  const stableNightlyPromotion = runTap({
    version: '26.6.4-nightly.r1',
    target: 'Casks/one-person-lab.rb',
    manifest: 'latest-arm64-mac.yml',
    download: standardDmg('26.6.4-nightly.r1'),
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
    version: '26.6.4-nightly.r1',
    target: 'Casks/one-person-lab-full.rb',
    manifest: 'opl-release-manifest.json',
    download: fullDmg('26.6.4-nightly.r1'),
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

test('agent installation validator rejects the retired first-party GHCR lifecycle source kind', () => {
  const policy = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-install-exposure-policy.json'), 'utf8'),
  );
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-agent-source-kind-invalid-'));
  const invalidPolicyPath = path.join(tempRoot, 'app-install-exposure-policy.json');
  const invalidCases = [
    {
      name: 'ordinary default source kind',
      mutate: (candidate: any) => {
        candidate.agent_installation_contract.third_party_manual_source_policy
          .ordinary_user_default_source_kinds[0] = 'first_party_ghcr_oci_artifact';
      },
      expected: /manual source ordinary defaults expected/,
    },
    {
      name: 'package lock receipt source kind',
      mutate: (candidate: any) => {
        candidate.agent_installation_contract.package_lock_receipt_contract
          .source_kind_allowed_values[0] = 'first_party_ghcr_oci_artifact';
      },
      expected: /package lock source kinds expected/,
    },
  ];

  assert.equal(JSON.stringify(policy).includes('first_party_ghcr_oci_artifact'), false);
  try {
    for (const invalidCase of invalidCases) {
      const invalidPolicy = structuredClone(policy);
      invalidCase.mutate(invalidPolicy);
      writeFile(invalidPolicyPath, `${JSON.stringify(invalidPolicy, null, 2)}\n`);
      const result = runNode([
        'scripts/validate-agent-installation-contract.ts',
        '--policy-path',
        invalidPolicyPath,
      ]);
      assert.notEqual(result.status, 0, invalidCase.name);
      assert.match(result.stderr, invalidCase.expected, invalidCase.name);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
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

test('App contracts define one minimal package activation authority', () => {
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

  const policy = guiProduct.agent_package_activation_policy;
  assert.equal(policy.release_scope, 'trusted_local_thin_shell');
  assert.equal(policy.action_id, 'agent_package_activate');
  assert.equal(policy.action_ref, 'app_state.actions#agent_package_activate');
  assert.equal(policy.result_schema_scope, 'live_non_dry_package_launch_only');
  assert.equal(
    policy.projected_action_source,
    'app_state.agent_packages.directory.entries[].available_actions[action_id=agent_package_activate]',
  );
  assert.equal(policy.required_payload_fields_source, 'projected_action.required_payload_fields');
  assert.equal(policy.request_policy.package_id_source, 'current_selected_professional_agent.package_id');
  assert.equal(policy.request_policy.scope_policy, 'use_projected_scope_without_assuming_workspace');
  assert.equal(
    policy.request_policy.target_workspace_source,
    'normalized_current_session_directory_only_when_required_payload_fields_contains_target_workspace',
  );
  assert.equal(policy.request_policy.global_workspace_root_mutation_allowed, false);
  assert.deepEqual(policy.optional_diagnostic_binding_fields, ['use_binding', 'package_use_binding']);
  assert.deepEqual(policy.minimal_launch_validation, [
    'activation.package_id_matches_current_selection',
    'returned_package_version_is_compatible_with_current_selection_when_present',
    'selected_package_entrypoint_exists_and_is_callable',
    'managed_target_is_safe_and_matches_the_owner_required_target_when_present',
  ]);
  assert.equal(
    policy.receipt_policy,
    'use_receipt_ref_is_optional_audit_evidence_not_a_launch_precondition',
  );
  assert.equal(
    policy.binding_policy,
    'validate_binding_when_present_but_do_not_require_a_complete_binding_for_ordinary_launch',
  );
  assert.deepEqual(policy.launch_state_machine.states, ['ready', 'degraded', 'package_unavailable']);
  assert.equal(policy.launch_state_machine.ready.selected_package_send_allowed, true);
  assert.equal(policy.launch_state_machine.degraded.selected_package_send_allowed, true);
  assert.equal(policy.launch_state_machine.package_unavailable.selected_package_send_allowed, false);
  assert.deepEqual(policy.typed_failure_codes, [
    'agent_package_unavailable',
    'agent_package_activation_invalid',
    'agent_package_selection_mismatch',
    'agent_package_version_mismatch',
    'agent_package_entrypoint_missing',
    'agent_package_target_mismatch',
  ]);
  assert.deepEqual(policy.failure_policy.selected_package_create_allowed_by_state, {
    ready: true,
    degraded: true,
    package_unavailable: false,
  });
  assert.equal(policy.failure_policy.plain_codex_create_allowed, true);
  assert.equal(policy.failure_policy.other_agent_selection_allowed, true);
  assert.equal(policy.failure_policy.existing_sessions_remain_available, true);
  assert.equal(policy.failure_policy.draft_preserved, true);
  assert.equal(policy.workspace_policy.session_is_primary_unit, true);
  assert.equal(policy.workspace_policy.project_owns_session, false);
  assert.equal(policy.workspace_policy.working_directory_is_mutable_context, true);
  assert.equal(policy.workspace_policy.workspace_is_not_a_universal_agent_launch_precondition, true);
  assert.equal(policy.workspace_policy.plain_conversation_policy, 'unchanged');
  assert.equal(policy.framework_component.cohort_commit, 'e10ec54f29b8a7d5b54c9a44f49ba4d5c492f252');

  const authorityRef = 'contracts/app-gui-product-contract.json#agent_package_activation_policy';
  assert.equal(
    installExposure.agent_installation_contract.package_manager_lifecycle.activation_contract.contract_ref,
    authorityRef,
  );
  assert.equal(productProfile.gui.agent_package_activation_policy.contract_ref, authorityRef);
  assert.equal(
    pageState.pages.find((page: { id: string }) => page.id === 'guid_home')
      .home_view_model.agent_package_activation_policy.contract_ref,
    authorityRef,
  );
  const agentsPage = pageState.pages.find((page: { id: string }) => page.id === 'agents');
  assert.equal(agentsPage.agent_package_lifecycle_ux.package_launch_contract_ref, authorityRef);
  assert.equal(
    agentsPage.agent_package_lifecycle_ux.contract_ref,
    'contracts/app-gui-product-contract.json#pages.settings_agents.agent_package_lifecycle_ux',
  );

  const packageRow = runtimeBridge.canonical_state_display_action_map.rows.find(
    (row: { semantic_area: string }) => row.semantic_area === 'package',
  );
  assert.equal(packageRow.agent_package_activation_contract.contract_ref, authorityRef);
  assert.equal(
    guiProduct.pages.settings_agents.agent_package_lifecycle_ux
      .package_projection_contract.minimal_launch_validation_ref,
    authorityRef,
  );

  const activationRequest = packageSurfaces.$defs.agent_package_activation_request;
  assert.deepEqual(activationRequest.required, ['package_id']);
  assert.equal(activationRequest.properties.package_version, undefined);
  assert.deepEqual(activationRequest.properties.scope.enum, ['workspace']);
  assert.equal(activationRequest.properties.target_workspace.type, 'string');
  assert.equal(activationRequest.properties.target_quest, undefined);
  assert.equal(activationRequest.properties.use_boundary_id, undefined);
  const activationResult = packageSurfaces.$defs.agent_package_activation_result;
  assert.deepEqual(activationResult.required, [
    'launch_state',
    'launch_allowed',
    'package_id',
    'launch_state_reason',
  ]);
  assert.deepEqual(
    activationResult.properties.launch_state.enum,
    ['ready', 'degraded', 'package_unavailable'],
  );
  assert.equal(activationResult.properties.launch_allowed.type, 'boolean');
  assert.equal(activationResult.required.includes('package_lock'), false);
  assert.equal(activationResult.required.includes('use_receipt_ref'), false);
  assert.equal(activationResult.properties.use_receipt_ref.type, 'string');
  assert.deepEqual(activationResult.properties.package_lock.required, ['package_id', 'package_version']);
  assert.deepEqual(packageSurfaces.$defs.agent_package_use_binding.required, [
    'root_package',
    'scope',
    'target_root',
  ]);
  assert.deepEqual(
    packageSurfaces.$defs.agent_package_use_binding.properties.root_package.required,
    ['package_id', 'package_version'],
  );
  assert.equal(activationResult.required.includes('use_binding'), false);
  assert.equal(activationResult.required.includes('package_use_binding'), false);
  assert.equal(activationResult.anyOf, undefined);
  assert.equal(packageSurfaces.$defs.agent_package_use_boundary_action, undefined);
  assert.equal(packageSurfaces.$defs.agent_package_session_launch_projection, undefined);

  const fixtureAction = fastFixture.app_state.actions.find(
    (action: { action_id: string }) => action.action_id === 'agent_package_activate',
  );
  assert.deepEqual(fixtureAction.payload_fields, ['package_id', 'scope', 'target_workspace']);
  assert.equal(fixtureAction.result_fields.includes('package_id'), true);
  assert.equal(fixtureAction.result_fields.includes('launch_allowed'), true);
  const directoryEntries = fastFixture.app_state.agent_packages.directory.entries;
  assert.equal(directoryEntries.some((entry: any) => 'use_boundary_action' in entry), false);
  const activationEntry = directoryEntries.find(
    (entry: any) => entry.recommended_action === 'agent_package_activate',
  );
  assert.deepEqual(activationEntry.recommended_action_ref.payload, {
    package_id: activationEntry.package_id,
    scope: 'workspace',
    target_workspace: fastFixture.app_state.paths.workspace_root_path,
  });
  assert.deepEqual(
    activationEntry.recommended_action_ref.required_payload_fields,
    ['package_id', 'scope', 'target_workspace'],
  );

  assert.equal(launchMatrix.read_and_action_sources.status_and_dry_run_write_count, 0);
  assert.deepEqual(launchMatrix.launch_state_contract.states, [
    'ready',
    'degraded',
    'package_unavailable',
  ]);
  assert.deepEqual(launchMatrix.launch_state_contract.selected_package_send_allowed, {
    ready: true,
    degraded: true,
    package_unavailable: false,
  });
  assert.deepEqual(launchMatrix.launch_state_contract.fault_isolation, {
    plain_codex_send_allowed: true,
    other_agent_selection_allowed: true,
    existing_sessions_remain_available: true,
    draft_preserved: true,
  });
  const shellCases = new Map(
    launchMatrix.normal_shell_launch_contract.cases.map(
      (entry: { case_id: string }) => [entry.case_id, entry],
    ),
  );
  assert.deepEqual(
    [
      'package_unavailable',
      'malformed_activation',
      'selection_drift',
      'version_drift',
      'entrypoint_missing',
      'required_target_drift',
    ]
      .map((caseId) => (shellCases.get(caseId) as any).reason_code),
    policy.typed_failure_codes,
  );
  for (const caseId of [
    'ready_without_optional_evidence',
    'degraded_without_optional_evidence',
    'valid_optional_evidence',
    'optional_target_difference',
  ]) {
    assert.equal((shellCases.get(caseId) as any).accepted, true, caseId);
  }
  for (const caseId of ['invalid_optional_receipt', 'invalid_optional_binding']) {
    assert.equal((shellCases.get(caseId) as any).accepted, false, caseId);
  }
  assert.equal((shellCases.get('package_unavailable') as any).failure_scope, 'selected_package_only');
  assert.equal((shellCases.get('package_unavailable') as any).plain_codex_send_allowed, true);
  assert.equal((shellCases.get('package_unavailable') as any).other_agent_selection_allowed, true);
  assert.deepEqual(shellCases.get('plain_conversation'), {
    case_id: 'plain_conversation',
    package_backed: false,
    activation_required: false,
    accepted: true,
  });

  const lifecycleCases = new Map(
    launchMatrix.cases.map((entry: { case_id: string }) => [entry.case_id, entry]),
  );
  for (const entry of launchMatrix.cases) {
    assert.equal(entry.activation_required_before_launch, false, entry.case_id);
    assert.equal(
      entry.selected_package_send_allowed,
      entry.launch_state !== 'package_unavailable',
      entry.case_id,
    );
  }
  for (const caseId of ['ready_visible_enabled', 'hidden_enabled_standard_agent']) {
    assert.equal((lifecycleCases.get(caseId) as any).launch_state, 'ready', caseId);
  }
  for (const caseId of [
    'verification_deferred_visible_enabled',
    'activation_required_visible_enabled',
    'stale_status_visible_enabled',
    'optional_dependency_missing_visible_enabled',
  ]) {
    assert.equal((lifecycleCases.get(caseId) as any).launch_state, 'degraded', caseId);
    assert.equal((lifecycleCases.get(caseId) as any).selected_package_send_allowed, true, caseId);
  }
  for (const caseId of [
    'disabled_visible_standard_agent',
    'not_installed_standard_agent',
    'installed_capability_package',
    'installed_workflow_profile',
    'installed_standard_agent_lock_corrupt',
    'recovery_in_progress',
    'recovery_required_executable',
    'recovery_required_manual_owner_intervention',
  ]) {
    assert.equal((lifecycleCases.get(caseId) as any).launch_state, 'package_unavailable', caseId);
    assert.equal((lifecycleCases.get(caseId) as any).selected_package_send_allowed, false, caseId);
  }
  assert.equal(
    (lifecycleCases.get('hidden_enabled_standard_agent') as any).ordinary_discovery_visible,
    false,
  );
  assert.equal(
    (lifecycleCases.get('hidden_enabled_standard_agent') as any)
      .retained_shortcut_send_allowed,
    true,
  );
  for (const caseId of [
    'recovery_in_progress',
    'recovery_required_executable',
    'recovery_required_manual_owner_intervention',
  ]) {
    assert.deepEqual(
      (lifecycleCases.get(caseId) as any).read_surfaces_are_pure,
      ['fast', 'list', 'status', 'dry_run'],
      caseId,
    );
  }
  const workspaceCases = new Map(
    launchMatrix.workspace_transition_contract.cases.map(
      (entry: { case_id: string }) => [entry.case_id, entry],
    ),
  );
  assert.equal(
    (workspaceCases.get('workspace_required_a_to_b') as any)
      .fresh_minimal_validation_required_before_next_launch,
    true,
  );
  assert.equal(
    (workspaceCases.get('workspace_optional_a_to_b') as any).target_workspace_required,
    false,
  );
  assert.equal((workspaceCases.get('workspace_optional_a_to_b') as any).accepted, true);
  assert.equal(
    (workspaceCases.get('workspace_required_b_to_c_validation_failure') as any).failure_scope,
    'selected_package_only',
  );
  assert.equal(
    (workspaceCases.get('plain_conversation_workspace_transition') as any).activation_required,
    false,
  );

  assert.deepEqual(activationResults.framework_component, {
    status: 'canonical_release_cohort_reference',
    repository: 'gaofeng21cn/one-person-lab',
    commit: 'e10ec54f29b8a7d5b54c9a44f49ba4d5c492f252',
    fixture_role: 'minimal_live_consumer_examples_not_an_exact_producer_fixture',
    exact_producer_fixture: false,
    installed_runtime_readback_required: true,
  });
  const activationResultMatchesSelection = (entry: any) => {
    const { result, selected } = entry;
    if (!['ready', 'degraded', 'package_unavailable'].includes(result.launch_state)) return false;
    if (result.launch_allowed !== (result.launch_state !== 'package_unavailable')) return false;
    if (result.launch_state === 'ready' && result.launch_state_reason !== null) return false;
    if (
      result.launch_state !== 'ready'
      && (typeof result.launch_state_reason !== 'string' || !result.launch_state_reason.trim())
    ) return false;
    if (result.package_id !== selected.package_id) return false;
    if (result.package_version !== undefined && result.package_version !== selected.package_version) return false;
    if (result.package_lock !== undefined && (
      result.package_lock.package_id !== selected.package_id
      || result.package_lock.package_version !== selected.package_version
    )) return false;
    if (
      result.use_receipt_ref !== undefined
      && (typeof result.use_receipt_ref !== 'string' || !result.use_receipt_ref.trim())
    ) return false;
    for (const field of ['use_binding', 'package_use_binding']) {
      const binding = result[field];
      if (binding === undefined || binding === null) continue;
      if (
        binding.root_package?.package_id !== selected.package_id
        || binding.root_package?.package_version !== selected.package_version
        || binding.scope !== 'workspace'
        || typeof binding.target_root !== 'string'
        || !binding.target_root
        || (
          selected.normalized_target_workspace
          && binding.target_root !== selected.normalized_target_workspace
        )
      ) return false;
    }
    return true;
  };
  const resultCases = new Map(
    activationResults.cases.map((entry: { case_id: string }) => [entry.case_id, entry]),
  );
  assert.equal(
    activationResultMatchesSelection(resultCases.get('ready_minimal_without_optional_evidence')),
    true,
  );
  assert.equal(
    activationResultMatchesSelection(resultCases.get('ready_with_optional_evidence')),
    true,
  );
  assert.equal(
    activationResultMatchesSelection(resultCases.get('degraded_without_optional_evidence')),
    true,
  );
  assert.equal(
    activationResultMatchesSelection(resultCases.get('package_unavailable_local_only')),
    true,
  );
  const activationPackageDrift = structuredClone(
    resultCases.get('ready_minimal_without_optional_evidence') as any,
  );
  activationPackageDrift.result.package_id = 'other-agent';
  assert.equal(activationResultMatchesSelection(activationPackageDrift), false);
  const lockPackageDrift = structuredClone(resultCases.get('ready_with_optional_evidence') as any);
  lockPackageDrift.result.package_lock.package_id = 'other-agent';
  assert.equal(activationResultMatchesSelection(lockPackageDrift), false);
  const rootPackageDrift = structuredClone(resultCases.get('ready_with_optional_evidence') as any);
  rootPackageDrift.result.package_use_binding.root_package.package_id = 'other-agent';
  assert.equal(activationResultMatchesSelection(rootPackageDrift), false);
  const versionDrift = structuredClone(resultCases.get('ready_with_optional_evidence') as any);
  versionDrift.result.package_use_binding.root_package.package_version = '9.9.9';
  assert.equal(activationResultMatchesSelection(versionDrift), false);
  const targetDrift = structuredClone(resultCases.get('ready_with_optional_evidence') as any);
  targetDrift.result.package_use_binding.target_root = '/Users/example/Other';
  assert.equal(activationResultMatchesSelection(targetDrift), false);
  const optionalTargetDifference = structuredClone(targetDrift);
  delete optionalTargetDifference.selected.normalized_target_workspace;
  optionalTargetDifference.selected.required_payload_fields = ['package_id'];
  assert.equal(activationResultMatchesSelection(optionalTargetDifference), true);
  const receiptDrift = structuredClone(resultCases.get('ready_with_optional_evidence') as any);
  receiptDrift.result.use_receipt_ref = '';
  assert.equal(activationResultMatchesSelection(receiptDrift), false);
  const allowanceDrift = structuredClone(resultCases.get('degraded_without_optional_evidence') as any);
  allowanceDrift.result.launch_allowed = false;
  assert.equal(activationResultMatchesSelection(allowanceDrift), false);

  assert.equal(JSON.stringify(policy).includes('med-autoscience'), false);
  assert.equal(JSON.stringify(policy).includes('mas-scholar-skills'), false);
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
  const agentsPage = gui.pages.settings_agents;
  const agentsPageState = pageState.pages.find((page) => page.id === 'agents');

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
  assert.equal(
    agentsPageState.agent_package_lifecycle_ux.contract_ref,
    'contracts/app-gui-product-contract.json#pages.settings_agents.agent_package_lifecycle_ux',
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
    'directory readiness is advisory for session launch; use the App ready_degraded_package_unavailable state machine, consume owner-projected JIT actions, and fail closed only for the selected package on identity version entrypoint safe-target permission or authorization boundaries',
  );
  assert.deepEqual(
    agentsPage.agent_package_lifecycle_ux.package_projection_contract.package_unavailable_reason_codes,
    ['package_not_installed', 'package_disabled', 'package_dependency_incompatible', 'package_identity_mismatch', 'package_version_mismatch', 'package_entrypoint_missing', 'unsafe_managed_target', 'permission_or_authorization_denied', 'package_lock_corrupt', 'package_ledger_corrupt', 'package_recovery_in_progress', 'package_recovery_required'],
  );
  assert.deepEqual(
    agentsPage.agent_package_lifecycle_ux.package_projection_contract.degraded_reason_codes,
    ['package_status_read_failed', 'package_dependency_missing', 'physical_surface_not_ready', 'runtime_source_missing', 'runtime_source_incompatible', 'carrier_authority_invalid', 'live_verification_deferred', 'update_available', 'optional_dependency_missing'],
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
