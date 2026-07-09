import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  runNode,
  writeFile,
  writeFakeReleaseNotesAiWriter,
  validStandardAiReleaseNotes,
  stableInstallCommand,
  writeReleaseMetadata,
  writeStandardLocalAuthorizationPolicy,
  writeFullLocalAuthorizationPolicy,
  writeFullRuntimeNativeTrust,
  writeExecutable,
  sha256,
  fileSha256,
} from './helpers.ts';
import {
  withFullPackageOptimizationManifest,
  writeFullPackageOptimizationArtifacts,
} from './release-plan-full-package-fixtures.ts';

function writeFullRuntimeCurrentnessProbe(outDir: string, manifest: { components?: { opl?: { git_commit?: string } } }) {
  writeFile(
    path.join(outDir, 'full-runtime-currentness-probe.json'),
    `${JSON.stringify({
      schema: 'opl_full_runtime_currentness_probe.v1',
      status: 'passed',
      framework_commit: manifest.components?.opl?.git_commit ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      managed_update_surface_id: 'opl_managed_updater_kernel',
      managed_update_components: ['installation_carrier', 'runtime_substrate', 'capability_packages', 'codex_surface', 'companion_tools'],
      app_state_schema_version: 'opl_app_state.v1',
      app_state_module_count: 5,
    }, null, 2)}\n`,
  );
}

function writeFullPublicReleaseManifest(outDir: string, version: string, manifest: Record<string, unknown>) {
  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  const readJson = (name: string) => JSON.parse(fs.readFileSync(path.join(outDir, name), 'utf8'));
  writeFile(
    path.join(outDir, 'opl-release-manifest.json'),
    `${JSON.stringify({
      schema: 'opl_public_release_manifest.v1',
      package_kind: 'opl_full_first_install_macos_arm64',
      version,
      primary_install_asset: fullDmgName,
      assets: [
        {
          name: fullDmgName,
          role: 'full_first_install_carrier',
          size_bytes: fs.statSync(path.join(outDir, fullDmgName)).size,
          sha256: fileSha256(path.join(outDir, fullDmgName)),
        },
      ],
      manifest,
      evidence: {
        runtime_cache_events: readJson('runtime-cache-events.json'),
        runtime_currentness_probe: readJson('full-runtime-currentness-probe.json'),
        runtime_native_trust: readJson('full-runtime-native-trust.json'),
        app_bundle_trim_report: readJson('full-app-bundle-trim-report.json'),
        package_boundary_audit: readJson('full-package-boundary-audit.json'),
        local_authorization_policy: readJson('full-local-authorization-policy.json'),
        readme_text: fs.readFileSync(path.join(outDir, 'README-Full-First-Install.txt'), 'utf8'),
      },
      transition_legacy_assets: [
        'full-package-manifest.json',
        'runtime-cache-events.json',
        'full-runtime-currentness-probe.json',
        'full-runtime-native-trust.json',
        'full-app-bundle-trim-report.json',
        'full-package-boundary-audit.json',
      ],
    }, null, 2)}\n`,
  );
}

function writeStandardPublishFixture(tempRoot: string, version: string, options: {
  writeDefaultAi?: boolean;
} = {}) {
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const dmgContent = 'dmg';
  const zipContent = 'zip';

  writeFile(path.join(outDir, dmgName), dmgContent);
  writeFile(path.join(outDir, zipName), zipContent);
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(outDir);
  if (options.writeDefaultAi !== false) {
    writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));
  }

  return { shellRoot, outDir, fakeAi, dmgName, zipName, dmgContent, zipContent };
}

function fullPackageManifest(componentOverrides: Record<string, unknown> = {}) {
  return {
    generated_at: '2026-05-20T12:00:00.000Z',
    distribution: {
      updater_metadata_allowed: false,
    },
    components: {
      opl: { git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      codex: { version: 'codex-cli 0.130.0' },
      mas: { git_commit: '1111111111111111111111111111111111111111' },
      mag: { git_commit: '2222222222222222222222222222222222222222' },
      rca: { git_commit: '3333333333333333333333333333333333333333' },
      meta_agent: { git_commit: '4444444444444444444444444444444444444444' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
      ...componentOverrides,
    },
  };
}

function writeFullPackageFixture(fullPackageDir: string, version: string, manifest = fullPackageManifest(), options: {
  nativeTrustJson?: string;
} = {}) {
  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(withFullPackageOptimizationManifest(manifest), null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFullRuntimeCurrentnessProbe(fullPackageDir, manifest);
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullLocalAuthorizationPolicy(fullPackageDir);
  if (options.nativeTrustJson) {
    writeFile(path.join(fullPackageDir, 'full-runtime-native-trust.json'), options.nativeTrustJson);
  } else {
    writeFullRuntimeNativeTrust(fullPackageDir);
  }
  writeFullPackageOptimizationArtifacts(fullPackageDir, version);
  writeFullPublicReleaseManifest(fullPackageDir, version, withFullPackageOptimizationManifest(manifest));
}

function assertCheck(payload: { checks: Array<{ id: string; status: string; message?: string }> }, id: string, status: string, message?: RegExp) {
  const check = payload.checks.find((entry) => entry.id === id);
  assert.ok(check, `missing check ${id}`);
  assert.equal(check.status, status);
  if (message) {
    assert.match(check.message ?? '', message);
  }
}

test('release plan exposes the standard VM fail-fast gate before expensive Full lanes', () => {
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
  const lanes = new Map(payload.lanes.map((lane) => [lane.id, lane]));
  const lane = (id: string) => {
    const found = lanes.get(id);
    assert.ok(found, `missing lane ${id}`);
    return found;
  };
  assert.equal(payload.profile, 'stable');
  for (const [id, expected] of [
    ['release_preflight', { phase: 'fast_candidate', command: /npm run release:preflight/ }],
    ['release_boundary', {}],
    ['standard_build', {}],
    ['full_build', {
      depends_on: ['release_preflight', 'full_runtime_keys', 'standard_dmg_clean_vm_smoke'],
      cannot_run_with: 'standard_build',
      command: /OPL_FULL_RUNTIME_CACHE_MODE=readwrite/,
    }],
    ['standard_dmg_clean_vm_smoke', { phase: 'installation_gate', command: /--runtime-profile standard/ }],
    ['remote_verify_standard_and_full', { depends_on_includes: ['standard_dmg_clean_vm_smoke', 'publish_full_assets'] }],
    ['one_shot_app_installer_smoke', { depends_on_includes: ['standard_dmg_clean_vm_smoke'] }],
    ['docker_webui_smoke', { depends_on_includes: ['standard_dmg_clean_vm_smoke'] }],
    ['homebrew_standard_cask_clean_vm_smoke', { command: /gaofeng21cn\/one-person-lab\/one-person-lab/ }],
    ['full_dmg_clean_vm_smoke', { phase: 'release_gate', command: /--runtime-profile full/ }],
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
    if (expected.cannot_run_with) {
      assert.equal(current.can_run_with.includes(expected.cannot_run_with), false);
    }
  }
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
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'false',
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
  for (const id of ['remote_target', 'release_refs', 'codex_package_metadata', 'docker_webui_clean_windows_evidence_artifact']) {
    assertCheck(payload, id, 'skipped');
  }
  assertCheck(payload, 'full_workflow_call', 'passed');
  assertCheck(payload, 'homebrew_vm_gate_static_policy', 'passed');
  assert.equal(payload.homebrew.vm_gate_static_policy.install_ref, 'gaofeng21cn/one-person-lab/one-person-lab');
  assert.ok(payload.homebrew.vm_gate_static_policy.trusted_cask_refs.includes('gaofeng21cn/one-person-lab/one-person-lab-full'));
  assert.equal(payload.homebrew.vm_gate_static_policy.whole_tap_trust_allowed, false);

  const standardOnly = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'draft_candidate',
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
  assertCheck(standardOnlyPayload, 'full_workflow_call', 'skipped');
});
