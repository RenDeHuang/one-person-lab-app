import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import { resolveReleasePlatformMatrix } from '../../scripts/resolve-release-platform-matrix.ts';
import {
  releaseBoundaryChecksForProfile,
  releaseWorkflowPathsForProfile,
} from '../../scripts/validate-release-boundary/release-checks.ts';

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
  for (const id of ['windows-x64', 'windows-arm64']) {
    assert.equal(matrix.capabilities[id].stable_allowed, false);
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
      platforms: ['macos-x64', 'linux-arm64'],
    }).include.map((entry) => entry.platform),
    ['macos-x64', 'linux-arm64'],
  );
  assert.throws(
    () => resolveReleasePlatformMatrix({
      policy: 'stable_optional',
      platforms: ['windows-x64'],
    }),
    /outside audited policy/,
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

test('Full macOS post-success follower is automatic, same-cohort, recoverable, and non-blocking', () => {
  const follower = contract.release_platform_matrix.full_macos_additive_follower;
  assert.equal(follower.trigger, 'protected_automatic_post_success');
  assert.equal(follower.same_app_shell_framework_cohort_required, true);
  assert.equal(follower.same_standard_identity_and_version_required, true);
  assert.equal(follower.operation, 'append_full');
  assert.equal(follower.carrier, 'independent_immutable_adjunct_release');
  assert.match(follower.tag_derivation, /bundle-digest/);
  assert.equal(follower.standard_asset_or_latest_mutation_allowed, false);
  assert.equal(follower.blocks_stable_base_terminal, false);
  assert.equal(follower.blocks_latest_activation, false);
  assert.equal(follower.failure_receipt_required, true);
  assert.match(follower.recovery, /distinct_append_full_operation/);
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
  const publish = manual.jobs['publish-selected-platforms'];
  assert.equal(
    publish.environment,
    "${{ needs.prepare-matrix.outputs.publication_mode == 'stable_optional_follower' && 'release-stable' || 'release-preview' }}",
  );
  const publishRun = String(publish.steps.find(
    (step: any) => step.name === 'Publish exact platform bytes as one immutable carrier',
  )?.run);
  assert.match(publishRun, /gh release upload "\$tag" "\$asset_path"/);
  assert.match(publishRun, /immutable-releases/);
  assert.match(publishRun, /draft:true/);
  assert.match(publishRun, /draft:false,make_latest:"false"/);
  assert.match(publishRun, /and \.immutable == true/);
  assert.match(publishRun, /-optional-\$\{manifest_hex:0:12\}/);
  assert.doesNotMatch(publishRun, /--clobber|gh run rerun|gh run cancel/);
  assert.match(publishRun, /latest_after.*latest_before/);
  assert.match(publishRun, /opl_app_optional_platform_publication_receipt\.v1/);
});
