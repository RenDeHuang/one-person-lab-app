import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import { resolveReleasePlatformMatrix } from '../../scripts/resolve-release-platform-matrix.ts';
import {
  activeShellReleaseValidationProfile,
  releaseBoundaryChecksForProfile,
  releaseWorkflowPathsForProfile,
} from '../../scripts/validate-release-boundary/release-checks.ts';
import { validateReleasePlatformMatrix } from '../../scripts/validate-release-boundary/release-contract-policy.ts';
import { validateReleaseChannelContract } from '../../scripts/validate-active-shell/release-contract-validator.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const contract = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'contracts/app-release-channel.json'), 'utf8'),
);

test('Stable and Nightly resolve the exact required macOS ARM64 plus Linux x64 matrix', () => {
  assert.deepEqual(
    resolveReleasePlatformMatrix({ policy: 'stable_required' }).include,
    [
      {
        platform: 'macos-arm64',
        os: 'macos-14',
        command: 'node scripts/build-with-builder.js arm64 --mac --arm64',
        'artifact-name': 'macos-build-arm64',
        arch: 'arm64',
        native_arch: 'arm64',
      },
      {
        platform: 'linux-x64',
        os: 'ubuntu-latest',
        command: 'node scripts/build-with-builder.js x64 --linux --x64',
        'artifact-name': 'linux-build-x64',
        arch: 'x64',
      },
    ],
  );
  assert.deepEqual(
    resolveReleasePlatformMatrix({ policy: 'nightly_standard' }).include.map((row) => [
      row.platform,
      row['artifact-name'],
    ]),
    [
      ['macos-arm64', 'nightly-macos-arm64'],
      ['linux-x64', 'nightly-linux-x64'],
    ],
  );
});

test('all seven declared capabilities remain explicitly buildable without entering Stable by default', () => {
  const matrix = contract.release_platform_matrix;
  const capabilityIds = [
    'macos-arm64',
    'macos-x64',
    'macos-universal',
    'linux-x64',
    'linux-arm64',
    'windows-x64',
    'windows-arm64',
  ];
  assert.deepEqual(Object.keys(matrix.capabilities), capabilityIds);
  assert.deepEqual(
    resolveReleasePlatformMatrix({ policy: 'manual_all', platform: 'all' }).include.map(
      (row) => row.platform,
    ),
    capabilityIds,
  );
  for (const id of ['macos-arm64', 'linux-x64']) {
    assert.equal(matrix.capabilities[id].default_enabled, true);
    assert.equal(matrix.capabilities[id].blocks_stable, true);
  }
  for (const id of ['macos-x64', 'macos-universal', 'linux-arm64', 'windows-x64', 'windows-arm64']) {
    assert.equal(matrix.capabilities[id].default_enabled, false);
    assert.equal(matrix.capabilities[id].blocks_stable, false);
  }
  assert.equal(matrix.capabilities['windows-x64'].stable_allowed, true);
  assert.ok(matrix.capabilities['windows-x64'].quality_channels.includes('stable_optional'));
  assert.equal(matrix.capabilities['windows-arm64'].stable_allowed, false);
  for (const id of ['windows-x64', 'windows-arm64']) {
    assert.ok(matrix.capabilities[id].quality_channels.includes('preview_rc'));
  }
  for (const id of capabilityIds) {
    assert.equal(typeof matrix.capabilities[id].publication_route, 'string');
    assert.doesNotMatch(matrix.capabilities[id].publication_status, /unavailable/);
  }
});

test('optional Stable publication is a canonical contract switch and defaults to no follower build', (t) => {
  assert.deepEqual(resolveReleasePlatformMatrix({ policy: 'stable_optional' }).include, []);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-platform-switch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const changed = structuredClone(contract);
  changed.release_platform_matrix.capabilities['macos-x64'].default_enabled = true;
  const contractPath = path.join(root, 'app-release-channel.json');
  fs.writeFileSync(contractPath, `${JSON.stringify(changed, null, 2)}\n`);
  assert.deepEqual(
    resolveReleasePlatformMatrix({ policy: 'stable_optional', contractPath }).include.map(
      (row) => row.platform,
    ),
    ['macos-x64'],
  );
});

test('resolver accepts only audited policy and platform IDs', () => {
  assert.throws(
    () => resolveReleasePlatformMatrix({ policy: '{"include":[]}' }),
    /Unknown audited release platform policy/,
  );
  assert.throws(
    () => resolveReleasePlatformMatrix({ policy: 'stable_required', platform: 'windows-x64' }),
    /allowed only with manual_all/,
  );
  assert.throws(
    () => resolveReleasePlatformMatrix({ policy: 'manual_all', platform: 'custom-shell-command' }),
    /outside audited policy/,
  );
  assert.deepEqual(
    resolveReleasePlatformMatrix({
      policy: 'stable_optional',
      platforms: ['windows-x64', 'macos-x64', 'linux-arm64'],
    }).include.map((entry) => entry.platform),
    ['windows-x64', 'macos-x64', 'linux-arm64'],
  );
  assert.deepEqual(
    resolveReleasePlatformMatrix({
      policy: 'stable_optional',
      platforms: ['windows-x64'],
    }).include,
    [{
      platform: 'windows-x64',
      os: 'windows-2022',
      command: 'node scripts/build-with-builder.js x64 --win --x64',
      'artifact-name': 'optional-windows-x64',
      arch: 'x64',
    }],
  );
});

test('workflow callers consume resolver output while reusable build keeps generic matrix input', () => {
  const bundle = parseYaml(
    fs.readFileSync(path.join(appRoot, '.github/workflows/_release-bundle.yml'), 'utf8'),
  ) as any;
  const nightly = parseYaml(
    fs.readFileSync(path.join(appRoot, '.github/workflows/release-nightly.yml'), 'utf8'),
  ) as any;
  const manual = parseYaml(
    fs.readFileSync(path.join(appRoot, '.github/workflows/build-manual.yml'), 'utf8'),
  ) as any;
  const reusable = parseYaml(
    fs.readFileSync(path.join(appRoot, '.github/workflows/_build-reusable.yml'), 'utf8'),
  ) as any;
  const packageValidation = parseYaml(
    fs.readFileSync(path.join(appRoot, '.github/workflows/windows-updater-package-validation.yml'), 'utf8'),
  ) as any;

  assert.equal(bundle.jobs['standard-build'].with.matrix, '${{ needs.resolve-platform-matrix.outputs.matrix }}');
  assert.equal(bundle.jobs['standard-build'].with.release_validation_profile, 'stable');
  assert.match(
    String(bundle.jobs['resolve-platform-matrix'].steps.find((step: any) => step.id === 'resolve')?.run),
    /--policy stable_required/,
  );
  assert.equal(nightly.jobs['standard-build'].with.matrix, '${{ needs.admission.outputs.matrix }}');
  assert.equal(nightly.jobs['standard-build'].with.release_validation_profile, 'stable');
  assert.match(
    String(nightly.jobs.admission.steps.find((step: any) => step.id === 'platforms')?.run),
    /--policy nightly_standard/,
  );
  const manualRun = String(manual.jobs['prepare-matrix'].steps.find(
    (step: any) => step.id === 'set-matrix',
  )?.run);
  assert.match(manualRun, /policy=manual_all/);
  assert.match(manualRun, /--platform '\$\{\{ inputs\.platform \}\}'/);
  assert.equal(reusable.on.workflow_call.inputs.matrix.type, 'string');
  assert.equal(reusable.on.workflow_call.inputs.matrix.required, true);
  assert.equal(reusable.on.workflow_call.inputs.release_validation_profile.default, 'aggregate');
  assert.equal(reusable.on.workflow_call.inputs.require_windows_updater_assets.default, false);
  assert.equal(reusable.on.workflow_call.inputs.require_windows_authenticode.default, false);
  const windowsBuild = reusable.jobs.build.steps.find(
    (step: any) => step.name === 'Build with electron-builder (Windows)',
  );
  assert.match(String(windowsBuild?.run), /config\.nsis\.differentialPackage=true/);
  assert.doesNotMatch(String(windowsBuild?.run), /config\.publish\.(?:provider|url)=/);
  const updaterValidation = reusable.jobs.build.steps.find(
    (step: any) => step.name === 'Validate exact Windows updater asset set',
  );
  assert.equal(
    updaterValidation?.if,
    "matrix.platform == 'windows-x64' && inputs.require_windows_updater_assets",
  );
  assert.match(String(updaterValidation?.run), /validate-windows-updater-assets\.ts/);
  const authenticodeValidation = reusable.jobs.build.steps.find(
    (step: any) => step.name === 'Verify timestamped Windows Authenticode signature',
  );
  assert.equal(
    authenticodeValidation?.if,
    "matrix.platform == 'windows-x64' && inputs.require_windows_authenticode",
  );
  assert.match(String(authenticodeValidation?.run), /Get-AuthenticodeSignature/);
  assert.match(String(authenticodeValidation?.run), /TimeStamperCertificate/);
  const artifactCleanup = reusable.jobs.build.steps.find(
    (step: any) => step.name === 'Clean up non-installer artifacts',
  );
  assert.match(String(artifactCleanup?.run), /! -name 'latest\.yml'/);
  assert.match(String(artifactCleanup?.run), /\.exe\.blockmap/);
  const artifactUpload = reusable.jobs.build.steps.find(
    (step: any) => step.name === 'Upload build artifacts',
  );
  assert.match(String(artifactUpload?.with?.path), /opl-windows-updater-assets\.json/);
  assert.match(String(artifactUpload?.with?.path), /opl-windows-authenticode-receipt\.json/);
  assert.deepEqual(packageValidation.permissions, { contents: 'read' });
  assert.equal(packageValidation.jobs['build-windows-updater-package']['runs-on'], 'windows-2022');
  const validationBuild = packageValidation.jobs['build-windows-updater-package'].steps.find(
    (step: any) => step.name === 'Build updater-capable Windows x64 package',
  );
  assert.match(String(validationBuild?.run), /config\.nsis\.differentialPackage=true/);
  assert.doesNotMatch(String(validationBuild?.run), /config\.publish\.(?:provider|url)=/);
  const validationUpload = packageValidation.jobs['build-windows-updater-package'].steps.find(
    (step: any) => step.name === 'Upload non-published updater validation assets',
  );
  assert.match(String(validationUpload?.with?.path), /latest\.yml/);
  assert.match(String(validationUpload?.with?.path), /\.exe\.blockmap/);
  assert.match(String(validationUpload?.with?.path), /opl-windows-updater-assets\.json/);
  assert.equal(packageValidation.jobs['build-windows-updater-package'].permissions, undefined);
  const releaseBoundary = reusable.jobs['release-boundary'];
  assert.equal(
    releaseBoundary.steps.find((step: any) => step.name === 'Run audited release-boundary profile')
      ?.env?.OPL_RELEASE_VALIDATION_PROFILE,
    '${{ inputs.release_validation_profile }}',
  );
});

test('Stable profile excludes only Windows-only checks and retains shared build safety', () => {
  const stableIds = new Set(releaseBoundaryChecksForProfile('stable').map((check) => check.id));
  const windowsIds = new Set(
    releaseBoundaryChecksForProfile('windows-preview').map((check) => check.id),
  );
  assert.equal(stableIds.has('docker_webui_clean_windows_vm_workflow'), false);
  assert.equal(windowsIds.has('docker_webui_clean_windows_vm_workflow'), true);
  assert.equal(stableIds.has('immutable_release_bundle_workflow'), true);
  assert.equal(stableIds.has('nightly_standard_release_entry'), true);
  assert.ok(releaseWorkflowPathsForProfile('stable').includes('.github/workflows/_build-reusable.yml'));
  assert.ok(releaseWorkflowPathsForProfile('stable').includes('.github/workflows/build-manual.yml'));
  assert.equal(
    releaseWorkflowPathsForProfile('stable').includes(
      '.github/workflows/docker-webui-clean-windows-vm.yml',
    ),
    false,
  );
});

test('Stable validation ignores Windows publication drift while aggregate and Preview remain fail-closed', () => {
  const changed = structuredClone(contract);
  changed.release_platform_matrix.capabilities['windows-x64'].publication_route = null;
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    assert.equal(validateReleasePlatformMatrix(changed, 'stable'), 0);
    assert.ok(validateReleasePlatformMatrix(changed, 'aggregate') > 0);
    assert.ok(validateReleasePlatformMatrix(changed, 'windows-preview') > 0);
  } finally {
    console.error = originalConsoleError;
  }
  assert.doesNotThrow(() => validateReleaseChannelContract(changed, null, 'stable'));
  assert.throws(
    () => validateReleaseChannelContract(changed, null, 'aggregate'),
    /Release platform matrix/,
  );
  assert.throws(
    () => validateReleaseChannelContract(changed, null, 'windows-preview'),
    /Release platform matrix/,
  );
});

test('active-shell quick validation defaults to Stable while full validation remains aggregate', () => {
  assert.equal(activeShellReleaseValidationProfile(true, ''), 'stable');
  assert.equal(activeShellReleaseValidationProfile(false, ''), 'aggregate');
  assert.equal(activeShellReleaseValidationProfile(true, 'windows-preview'), 'windows-preview');
  assert.throws(
    () => activeShellReleaseValidationProfile(true, 'unsupported'),
    /Unsupported OPL_RELEASE_VALIDATION_PROFILE/,
  );
});

test('Windows-only Docker/WebUI cases live only in the Preview-owned test file', () => {
  const windowsOwned = contract.release_platform_matrix.validation_ownership['windows-preview']
    .owned_test_paths;
  assert.ok(windowsOwned.includes('tests/release/docker-webui-windows-installer.test.ts'));
  assert.equal(windowsOwned.includes('tests/release/docker-webui-installer.test.ts'), false);
  const sharedInstallerTests = fs.readFileSync(
    path.join(appRoot, 'tests/release/docker-webui-installer.test.ts'),
    'utf8',
  );
  assert.doesNotMatch(sharedInstallerTests, /test\(['"`][^\n]*Windows/);
});

test('Full macOS publication is self-identified, independently admissible, recoverable, and non-blocking', () => {
  const follower = contract.release_platform_matrix.full_macos_additive_follower;
  assert.equal(
    follower.trigger,
    'protected_automatic_post_success_or_explicit_independent_full_publication',
  );
  assert.equal(follower.source_policy, 'full_artifact_self_identity_plus_component_compatibility_plus_exact_standard_reference_cas');
  assert.equal(follower.standard_release_prerequisite_required, true);
  assert.equal(follower.cross_component_exact_version_sha_or_cohort_binding_allowed, false);
  assert.equal(
    follower.compatibility_contract_ref,
    'contracts/app-install-exposure-policy.json#component_interoperability.compatibility_admission',
  );
  assert.equal(follower.operation, 'append_full');
  assert.equal(follower.carrier, 'independent_immutable_adjunct_release');
  assert.match(follower.tag_derivation, /full-manifest-sha256/);
  assert.equal(follower.full_release_must_be_published_immutable, true);
  assert.equal(follower.standard_asset_or_latest_mutation_allowed, false);
  assert.deepEqual(follower.target_standard_reference.required_fields, [
    'repository',
    'release_id',
    'tag',
    'target_commitish',
    'immutable',
  ]);
  assert.equal(follower.target_standard_reference.purpose, 'reference_and_release_notes_only');
  assert.equal(follower.target_standard_reference.cross_component_compatibility_gate_allowed, false);
  assert.equal(follower.blocks_stable_base_terminal, false);
  assert.equal(follower.blocks_latest_activation, false);
  assert.equal(follower.failure_receipt_required, true);
  assert.match(follower.recovery, /same_full_artifact_identity/);
});

test('optional platform publication is an independent protected post-success operation', () => {
  const follower = parseYaml(
    fs.readFileSync(
      path.join(appRoot, '.github/workflows/release-stable-post-success-followups.yml'),
      'utf8',
    ),
  ) as any;
  const manual = parseYaml(
    fs.readFileSync(path.join(appRoot, '.github/workflows/build-manual.yml'), 'utf8'),
  ) as any;
  const optional = follower.jobs['publish-optional-platforms'];
  assert.equal(optional.if, "${{ needs.admit.outputs.optional_platforms_enabled == 'true' }}");
  assert.equal(optional.uses, './.github/workflows/build-manual.yml');
  assert.equal(optional.with.invocation_mode, 'stable_optional_follower');
  assert.equal(optional.with.platform_policy, 'stable_optional');
  assert.equal(optional.with.platform_ids, '${{ needs.admit.outputs.optional_platforms }}');
  assert.equal(optional.with.opl_updater_version, '${{ needs.admit.outputs.updater_version }}');
  assert.equal(
    manual.jobs['build-pipeline'].with.require_windows_updater_assets,
    "${{ needs.prepare-matrix.outputs.publication_mode == 'stable_optional_follower' && contains(needs.prepare-matrix.outputs.platform_ids, 'windows-x64') }}",
  );
  assert.equal(
    manual.jobs['build-pipeline'].with.require_windows_authenticode,
    "${{ needs.prepare-matrix.outputs.publication_mode == 'stable_optional_follower' && contains(needs.prepare-matrix.outputs.platform_ids, 'windows-x64') }}",
  );
  const publish = manual.jobs['publish-selected-platforms'];
  assert.equal(
    publish.environment,
    "${{ needs.prepare-matrix.outputs.publication_mode == 'stable_optional_follower' && 'release-stable' || 'release-preview' }}",
  );
  const publishRun = String(publish.steps.find(
    (step: any) => step.name === 'Publish exact platform bytes as one immutable carrier',
  )?.run);
  assert.match(publishRun, /gh release upload "\$tag" "\$asset_path"/);
  assert.match(publishRun, /and \.immutable == true/);
  assert.match(publishRun, /validateGithubImmutableReleaseCapabilityEvidence/);
  assert.doesNotMatch(publishRun, /"repos\/\$GITHUB_REPOSITORY\/immutable-releases"/);
  assert.match(publishRun, /jq -S -n/);
  assert.match(publishRun, /validate-windows-updater-assets\.ts/);
  assert.match(publishRun, /opl-windows-updater-assets\.json/);
  assert.match(publishRun, /opl-windows-authenticode-receipt\.json/);
  assert.match(publishRun, /\.exe\.blockmap/);
  assert.match(publishRun, /release_identity:\{display_version:\$display_version,updater_version:\$updater_version\}/);
  assert.match(publishRun, /test -s "\$manifest_path"/);
  assert.match(publishRun, /draft:true/);
  assert.match(publishRun, /draft:false,make_latest:"false"/);
  assert.match(publishRun, /and \.immutable == true/);
  assert.match(publishRun, /-optional-\$\{manifest_hex:0:12\}/);
  assert.match(publishRun, /fetch_release_including_drafts/);
  assert.match(
    publishRun,
    /gh api --paginate "repos\/\$GITHUB_REPOSITORY\/releases\?per_page=100"[\s\S]*--slurp/,
  );
  assert.match(publishRun, /gh api "repos\/\$GITHUB_REPOSITORY\/releases\/\$release_id"/);
  assert.doesNotMatch(publishRun, /--clobber|gh run rerun|gh run cancel/);
  assert.match(publishRun, /latest_after.*latest_before/);
  assert.match(publishRun, /opl_app_optional_platform_publication_receipt\.v1/);
});
