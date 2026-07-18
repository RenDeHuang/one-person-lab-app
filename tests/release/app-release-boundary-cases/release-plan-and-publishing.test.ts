import {
  assert,
  fs,
  os,
  path,
  test,
  runNode,
} from './helpers.ts';
import {
  assertCanonicalReleaseVersion,
  nightlyMaximumRebuildRevision,
  nightlyReleaseVersionPatternSource,
  releaseCalendarParts,
  resolveNightlyReleaseVersion,
  stableReleaseVersionPatternSource,
} from '../../../scripts/release-version.ts';

const offlineOperatorPlanRef = `sha256:${'a'.repeat(64)}`;

test('Stable and Nightly versions use exact contract-backed canonical regexes', () => {
  assert.equal(
    stableReleaseVersionPatternSource,
    String.raw`^[0-9]{2}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12][0-9]|3[01])$`,
  );
  assert.equal(
    nightlyReleaseVersionPatternSource,
    String.raw`^[0-9]{2}\.(?:[1-9]|1[0-2])\.(?:[1-9]|[12][0-9]|3[01])-nightly(?:\.r[1-9])?$`,
  );
  assert.equal(nightlyMaximumRebuildRevision, 9);
  assert.doesNotThrow(() => assertCanonicalReleaseVersion('stable', '26.7.13'));
  assert.doesNotThrow(() => assertCanonicalReleaseVersion('nightly', '26.7.13-nightly'));
  assert.doesNotThrow(() => assertCanonicalReleaseVersion('nightly', '26.7.13-nightly.r1'));
  assert.doesNotThrow(() => assertCanonicalReleaseVersion('nightly', '26.7.13-nightly.r9'));
  assert.deepEqual(releaseCalendarParts('nightly', '26.7.13-nightly'), { year: 2026, month: 7, day: 13 });
  assert.deepEqual(releaseCalendarParts('nightly', '26.7.13-nightly.r1'), { year: 2026, month: 7, day: 13 });
  for (const [channel, version] of [
    ['stable', '026.07.013'],
    ['stable', '26.7.13-nightly.r1'],
    ['stable', '26.2.30'],
    ['nightly', '26.7.13'],
    ['nightly', '26.07.13-nightly.r1'],
    ['nightly', '26.7.13-nightly.r0'],
    ['nightly', '26.7.13-nightly.r10'],
    ['nightly', '26.7.13-nightly.123456789.1'],
  ] as const) {
    assert.throws(() => assertCanonicalReleaseVersion(channel, version));
  }
});

test('Nightly version resolution keeps the first release clean and allocates bounded rebuild suffixes', () => {
  const baseVersion = '26.7.13-nightly';
  assert.deepEqual(resolveNightlyReleaseVersion(baseVersion, []), {
    baseVersion,
    version: baseVersion,
    rebuildRevision: null,
    observedSameDayVersions: [],
  });

  const rebuilt = resolveNightlyReleaseVersion(baseVersion, [
    `refs/tags/v${baseVersion}`,
    `v${baseVersion}.r2`,
    `deadbeef\trefs/tags/v${baseVersion}.r1`,
    'v26.7.12-nightly.r9',
  ]);
  assert.equal(rebuilt.version, `${baseVersion}.r3`);
  assert.equal(rebuilt.rebuildRevision, 3);

  const migrated = resolveNightlyReleaseVersion(baseVersion, [
    `v${baseVersion}.29280129578.1`,
  ]);
  assert.equal(migrated.version, `${baseVersion}.r1`);

  assert.throws(
    () => resolveNightlyReleaseVersion(baseVersion, [`v${baseVersion}.r9`]),
    /same-day rebuilds stop at \.r9 to preserve SemVer ordering/,
  );
  assert.throws(
    () => resolveNightlyReleaseVersion(`${baseVersion}.r1`, []),
    /must not include a rebuild suffix/,
  );
});

function assertCheck(payload: { checks: Array<{ id: string; status: string; message?: string }> }, id: string, status: string, message?: RegExp) {
  const check = payload.checks.find((entry) => entry.id === id);
  assert.ok(check, `missing check ${id}`);
  assert.equal(check.status, status);
  if (message) {
    assert.match(check.message ?? '', message);
  }
}

test('local-install plan stops at exact local build, install handoff, and installed readback', () => {
  const result = runNode([
    'scripts/plan-release-candidate.ts',
    '--profile',
    'local-install',
    '--version',
    '26.7.15',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.profile, 'local_install');
  assert.equal(payload.strategy.distribution_scope, 'local_machine_only');
  assert.equal(payload.strategy.build_app_path, '$SHELL_ROOT/out/mac-arm64/One Person Lab.app');
  assert.equal(payload.strategy.installed_app_path, '/Applications/One Person Lab.app');
  assert.equal(payload.strategy.second_qa_authorization_required, false);
  assert.equal(payload.strategy.public_distribution_requirements, 'not_applicable');

  const lanes = new Map(payload.lanes.map((lane) => [lane.id, lane]));
  assert.deepEqual([...lanes.keys()], [
    'release_source_gate',
    'release_boundary',
    'standard_build',
    'local_install_handoff',
    'installed_app_readback',
  ]);
  assert.match(lanes.get('release_source_gate').command, /npm run release:source-gate/);
  assert.match(lanes.get('release_source_gate').command, /--require-shell-format true --run-shell-tests true/);
  assert.deepEqual(lanes.get('release_boundary').depends_on, ['release_source_gate']);
  assert.deepEqual(lanes.get('standard_build').depends_on, ['release_source_gate']);
  assert.equal(lanes.get('standard_build').command, 'npm run build-mac:arm64');
  assert.deepEqual(lanes.get('local_install_handoff').depends_on, ['release_boundary', 'standard_build']);
  assert.deepEqual(lanes.get('installed_app_readback').depends_on, ['local_install_handoff']);
  assert.match(lanes.get('installed_app_readback').command, /app\.asar SHA-256 equality/);

  const laneIds = new Set(lanes.keys());
  for (const forbidden of [
    'publish_standard',
    'remote_verify_standard_and_full',
    'standard_dmg_clean_vm_smoke',
    'webui_ghcr_publish',
    'release_candidate_record',
    'promote_stable_release',
    'stable_homebrew_tap_update',
  ]) {
    assert.equal(laneIds.has(forbidden), false, `${forbidden} must not enter local-install`);
  }
  assert.match(payload.authority_boundary, /cannot publish or promote a release/);

  for (const unsupportedArgs of [
    ['--include-full-package'],
    ['--no-settings-vm'],
  ]) {
    const unsupported = runNode([
      'scripts/plan-release-candidate.ts',
      '--profile',
      'local-install',
      '--version',
      '26.7.15',
      ...unsupportedArgs,
    ]);
    assert.notEqual(unsupported.status, 0);
  }
});

test('release plan keeps the Standard terminal independent from post-terminal Full add-on lanes', () => {
  const result = runNode([
    'scripts/plan-release-candidate.ts',
    '--version',
    '26.5.19',
    '--include-full-package',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.version, '26.5.19');
  assert.equal(payload.strategy.normal_stable_path, 'new_release_draft_gates_candidate_record_promote');
  assert.equal(payload.strategy.candidate_record_promotion_source, 'only_source_for_stable_promotion');
  assert.equal(payload.strategy.post_release_user_guide_screenshots, 'after_promotion_not_pre_promotion_gate');
  assert.equal(payload.strategy.full_runtime_cache, 'content_addressed_layer_cache');
  assert.equal(payload.full_payload_ref_audit.modes.stable.pin_input_required, true);
  assert.equal(payload.full_payload_ref_audit.modes.stable.default_refs_can_follow_main, false);
  assert.equal(payload.full_payload_ref_audit.modes.draft_candidate.pin_input_required, true);
  assert.equal(payload.full_payload_ref_audit.modes.draft_candidate.default_refs_can_follow_main, false);
  for (const input of Object.values(payload.full_payload_ref_audit.payloads)) {
    assert.equal('default_ref' in input, false);
    assert.match(input.ref_authority, /release_cohort|frozen_framework_catalog|app_full_third_party_source_manifest/);
  }
  const lanes = new Map(payload.lanes.map((lane) => [lane.id, lane]));
  const fullAddonLanes = new Map(payload.addon_graphs.full.lanes.map((lane) => [lane.id, lane]));
  const lane = (id: string, source = lanes) => {
    const found = source.get(id);
    assert.ok(found, `missing lane ${id}`);
    return found;
  };
  assert.equal(payload.profile, 'stable');
  for (const [id, expected] of [
    ['release_preflight', { phase: 'fast_candidate', command: /npm run release:preflight/ }],
    ['release_boundary', {}],
    ['standard_build', {}],
    ['standard_dmg_clean_vm_smoke', { phase: 'installation_gate', command: /--runtime-profile standard/ }],
    ['remote_verify_standard', { depends_on_includes: ['publish_standard'] }],
    ['one_shot_app_installer_smoke', { depends_on_includes: ['standard_dmg_clean_vm_smoke'] }],
    ['homebrew_standard_cask_clean_vm_smoke', { command: /gaofeng21cn\/one-person-lab\/one-person-lab/ }],
    ['release_evidence_bundle', {}],
    ['release_candidate_record', {
      depends_on_includes: ['release_readiness_summary'],
      command: /npm run release:candidate-record/,
    }],
    ['promote_stable_release', { command: /status=ready_to_promote/ }],
    ['release_promotion_record', { depends_on_includes: ['promote_stable_release'] }],
    ['post_release_user_guide_screenshots', { phase: 'post_release', command: /never a pre-promotion gate/ }],
  ]) {
    const current = lane(id);
    if (expected.phase) {
      assert.equal(current.phase, expected.phase);
    }
    if (expected.command) {
      assert.match(current.command, expected.command);
    }
    if (expected.depends_on) {
      assert.deepEqual(current.depends_on, expected.depends_on);
    }
    for (const dependency of expected.depends_on_includes ?? []) {
      assert.ok(current.depends_on.includes(dependency));
    }
    if (expected.can_run_with) {
      assert.equal(current.can_run_with.includes(expected.can_run_with), true);
    }
  }
  assert.equal(payload.strategy.standard_terminal, 'independent_from_full_and_webui_addons');
  assert.equal(payload.addon_graphs.full.starts_after, 'standard_stable_terminal');
  assert.equal(payload.addon_graphs.full.blocking_standard_terminal, false);
  assert.equal(payload.addon_graphs.webui.blocking_standard_terminal, false);
  assert.equal(lanes.has('full_build'), false);
  assert.equal(lanes.has('publish_full_assets'), false);
  assert.deepEqual(lane('full_build', fullAddonLanes).depends_on, ['full_runtime_keys']);
  assert.match(lane('full_build', fullAddonLanes).command, /OPL_FULL_RUNTIME_CACHE_MODE=readwrite/);
  assert.match(lane('full_dmg_clean_vm_smoke', fullAddonLanes).command, /--runtime-profile full/);
  assert.deepEqual(lane('publish_full_assets', fullAddonLanes).depends_on, ['full_dmg_clean_vm_smoke']);
});

test('release preflight fails fast before expensive release jobs', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-preflight-'));
  const summaryPath = path.join(tempRoot, 'release-preflight-summary.json');
  const markdownPath = path.join(tempRoot, 'release-preflight-summary.md');

  const success = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'draft_candidate',
    '--release-intent',
    'stable_complete',
    '--release-operator-plan-ref',
    offlineOperatorPlanRef,
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'false',
    '--offline',
    '--summary-path',
    summaryPath,
    '--markdown-path',
    markdownPath,
  ]);
  assert.equal(success.status, 0, success.stderr || success.stdout);
  const payload = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(payload.schema, 'opl_release_preflight.v1');
  assert.equal(payload.status, 'passed');
  assert.equal(payload.inputs.include_full_package, true);
  assert.equal(payload.inputs.include_full_package_role, 'same_cohort_nonblocking_addon_intent');
  assert.equal(payload.inputs.standard_terminal_requires_full_addon_terminal, false);
  assert.equal(payload.inputs.release_intent, 'stable_complete');
  assert.equal(payload.inputs.release_operator_plan_ref, offlineOperatorPlanRef);
  assertCheck(payload, 'release_intent', 'passed', /independent Standard terminal.*non-blocking add-on/);
  for (const id of ['remote_target', 'release_refs', 'codex_package_metadata', 'docker_webui_clean_windows_evidence_artifact']) {
    assertCheck(payload, id, 'skipped');
  }
  assertCheck(payload, 'full_addon_preflight', 'skipped');
  assertCheck(payload, 'homebrew_vm_gate_static_policy', 'passed');
  assert.equal(payload.homebrew.vm_gate_static_policy.install_ref, 'gaofeng21cn/one-person-lab/one-person-lab');
  assert.ok(payload.homebrew.vm_gate_static_policy.trusted_cask_refs.includes('gaofeng21cn/one-person-lab/one-person-lab-full'));
  assert.equal(payload.homebrew.vm_gate_static_policy.whole_tap_trust_allowed, false);

  const standardStableWithoutFull = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'new_release',
    '--release-intent',
    'stable_complete',
    '--release-operator-plan-ref',
    offlineOperatorPlanRef,
    '--include-full-package',
    'false',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'false',
    '--offline',
  ]);
  assert.equal(standardStableWithoutFull.status, 0, standardStableWithoutFull.stderr || standardStableWithoutFull.stdout);
  const standardStablePayload = JSON.parse(standardStableWithoutFull.stdout);
  assert.equal(standardStablePayload.inputs.include_full_package, false);
  assert.equal(standardStablePayload.inputs.standard_terminal_requires_full_addon_terminal, false);
  assertCheck(standardStablePayload, 'release_intent', 'passed', /independent Standard terminal.*no Full add-on/);
  assertCheck(standardStablePayload, 'full_addon_preflight', 'skipped');

  const standardOnly = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'draft_candidate',
    '--release-intent',
    'standard_hotfix',
    '--full-omission-reason',
    'urgent Standard App correction while Full is rebuilt',
    '--release-operator-plan-ref',
    offlineOperatorPlanRef,
    '--include-full-package',
    'false',
    '--run-vm-smoke',
    'false',
    '--publish-docker-webui',
    'false',
    '--offline',
  ]);
  assert.equal(standardOnly.status, 0, standardOnly.stderr || standardOnly.stdout);
  const standardOnlyPayload = JSON.parse(standardOnly.stdout);
  assertCheck(standardOnlyPayload, 'full_addon_preflight', 'skipped');
  assertCheck(standardOnlyPayload, 'release_intent', 'passed', /explicitly omits Full/);
});

test('release preflight rejects a future-dated Stable version before build dispatch', () => {
  const result = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.7.13',
    '--current-date',
    '2026-07-12',
    '--release-mode',
    'draft_candidate',
    '--release-intent',
    'stable_complete',
    '--release-operator-plan-ref',
    offlineOperatorPlanRef,
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'false',
    '--offline',
  ]);

  assert.notEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assertCheck(payload, 'release_date', 'failed', /future-dated.*2026-07-12/);
});

test('release preflight rejects same-day Stable suffixes', () => {
  const result = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.7.12-a',
    '--current-date',
    '2026-07-12',
    '--release-mode',
    'new_release',
    '--release-intent',
    'stable_complete',
    '--release-operator-plan-ref',
    offlineOperatorPlanRef,
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'false',
    '--offline',
  ]);

  assert.notEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assertCheck(payload, 'version', 'failed', /expected YY\.M\.D without a same-day suffix/);
});

test('Nightly plan is typed-blocked while its brokered replacement is unprovisioned', () => {
  const version = '26.7.12-nightly';
  const result = runNode([
    'scripts/plan-release-candidate.ts',
    '--profile',
    'nightly',
    '--version',
    version,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  const lanes = new Map(payload.lanes.map((lane) => [lane.id, lane]));
  assert.equal(payload.profile, 'nightly_standard');
  assert.equal(payload.status, 'blocked');
  assert.equal(payload.blocker.code, 'retired_pending_brokered_replacement');
  assert.equal(payload.blocker.retry_disposition, 'terminal_blocked');
  assert.equal(payload.strategy.mutation_authority, 'external_release_mutation_broker');
  assert.deepEqual([...lanes.keys()], ['nightly_release_blocked']);
  assert.match(lanes.get('nightly_release_blocked').command, /No release mutation command is available/);
  assert.doesNotMatch(JSON.stringify(payload), /nightly-standard-release\.yml|docker push|gh workflow run/);

  for (const [profile, invalidVersion] of [
    ['nightly', '26.7.12'],
    ['nightly', '26.7.12-nightly.r0'],
    ['nightly', '26.7.12-nightly.123456789.1'],
    ['stable', version],
  ]) {
    const invalid = runNode([
      'scripts/plan-release-candidate.ts',
      '--profile',
      profile,
      '--version',
      invalidVersion,
    ]);
    assert.notEqual(invalid.status, 0, `${profile} plan must reject ${invalidVersion}`);
  }
});

test('release-bound workflows require frozen SHA inputs and keep diagnostic VM fallback out of release sessions', () => {
  const readWorkflow = (name: string) => fs.readFileSync(
    path.join(process.cwd(), '.github', 'workflows', name),
    'utf8',
  );
  const desktop = readWorkflow('desktop-release.yml');
  const full = readWorkflow('full-first-install-release.yml');
  const promote = readWorkflow('desktop-release-promote.yml');
  const vm = readWorkflow('opl-first-run-vm.yml');
  const reusableBuild = readWorkflow('_build-reusable.yml');

  for (const workflow of [desktop, full, promote]) {
    assert.doesNotMatch(workflow, /default: main|\|\| 'main'/);
  }
  assert.match(desktop, /framework_ref:[\s\S]*?required: true[\s\S]*?shell_ref:[\s\S]*?required: true/);
  assert.match(full, /Validate frozen Full source SHAs[\s\S]*?shell_ref must be the exact frozen Shell SHA/);
  assert.match(promote, /shell_ref:[\s\S]*?required: true/);
  assert.match(vm, /if \[ -n "\$STABLE_SESSION_ID" \]; then[\s\S]*?Release-bound shell_ref must be an exact 40-character SHA/);
  assert.match(vm, /Release-bound framework_ref must be an exact 40-character SHA/);
  assert.match(reusableBuild, /Validate immutable release-bound build refs[\s\S]*?inputs\.stable_session_id != ''/);
  for (const field of ['ref', 'shell_ref', 'framework_ref', 'opl_flow_ref']) {
    assert.match(reusableBuild, new RegExp(`Release-bound ${field} must be the exact frozen`));
  }
});

test('release workflows use broker CAS plus narrow GitHub concurrency backstops', () => {
  const readWorkflow = (name: string) => fs.readFileSync(
    path.join(process.cwd(), '.github', 'workflows', name),
    'utf8',
  );
  const desktop = readWorkflow('desktop-release.yml');
  const promote = readWorkflow('desktop-release-promote.yml');
  const full = readWorkflow('full-first-install-release.yml');
  const fullAddon = readWorkflow('desktop-release-full-addon.yml');
  const qualification = readWorkflow('opl-first-run-vm.yml');
  const sharedGroup = 'group: opl-app-release-mutation-${{ inputs.opl_version }}';

  assert.match(desktop, new RegExp(sharedGroup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(promote, /group: opl-app-stable-latest-mutation/);
  assert.match(fullAddon, /group: opl-app-full-addon-\$\{\{ inputs\.opl_version \}\}/);
  assert.doesNotMatch(desktop, /group: opl-desktop-release-\$\{\{ inputs\.release_mode/);
  assert.match(promote, /concurrency:[\s\S]*?cancel-in-progress: false/);
  assert.match(full, /group: opl-full-first-install-build-\$\{\{ inputs\.opl_version \}\}-\$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(full, /release_mutation_owned_by_caller/);
  assert.doesNotMatch(full, /publish_to_release/);
  assert.match(desktop, /defer_addons:[\s\S]*default: true/);
  for (const workflow of [desktop, promote, full, fullAddon, qualification]) {
    assert.doesNotMatch(workflow, /gh release delete|gh api[^\n]*-X DELETE|--cleanup-tag/);
  }
});

test('Full build planning is artifact-only and never probes or mutates a release', () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), '.github', 'workflows', 'full-first-install-release.yml'),
    'utf8',
  );
  const localStart = workflow.indexOf('- name: Verify Full artifact plan without a release mutation');
  const nextStep = workflow.indexOf('- name: Write Full build artifact cohort manifest');
  assert.ok(localStart >= 0 && nextStep > localStart);
  assert.match(workflow.slice(localStart, nextStep), /OPL_RELEASE_EXISTS: '0'/);
  assert.doesNotMatch(workflow, /publish_to_release|gh release upload|gh release create/);
});

test('Stable preflight rejects padded or non-calendar YY.M.D versions', () => {
  for (const version of ['026.07.012', '26.13.1', '26.2.30']) {
    const result = runNode([
      'scripts/validate-release-preflight.ts',
      '--version',
      version,
      '--current-date',
      '2026-07-12',
      '--release-mode',
      'new_release',
      '--release-intent',
      'stable_complete',
      '--release-operator-plan-ref',
      offlineOperatorPlanRef,
      '--include-full-package',
      'true',
      '--run-vm-smoke',
      'true',
      '--publish-docker-webui',
      'false',
      '--offline',
    ]);
    assert.notEqual(result.status, 0, `${version} must be rejected`);
    const payload = JSON.parse(result.stdout);
    const failed = payload.checks.filter((entry) => entry.status === 'failed').map((entry) => entry.id);
    assert.ok(failed.includes('version') || failed.includes('release_date'));
  }
});
