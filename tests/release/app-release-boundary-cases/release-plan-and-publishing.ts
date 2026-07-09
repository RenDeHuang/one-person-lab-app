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

test('nightly release plan stays lightweight and excludes stable installation gates', () => {
  const result = runNode([
    'scripts/plan-release-candidate.ts',
    '--version',
    '26.5.19-nightly.20260527',
    '--profile',
    'nightly',
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.profile, 'nightly_standard');
  assert.deepEqual(payload.lanes.map((lane) => lane.id), [
    'release_preflight',
    'release_boundary',
    'standard_build',
    'publish_nightly_prerelease',
    'remote_verify_standard',
    'webui_ghcr_publish',
  ]);
  assert.ok(payload.lanes.every((lane) => !/full|vm|installer|docker|evidence/i.test(lane.id)));
  assert.ok(
    payload.lanes
      .find((lane) => lane.id === 'webui_ghcr_publish')
      ?.command.includes('ghcr.io/<owner>/one-person-lab-webui:nightly'),
  );
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

  const invalidBooleanEnv = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'draft_candidate',
    '--publish-docker-webui',
    'false',
    '--offline',
  ], {
    env: {
      OPL_INCLUDE_FULL_PACKAGE: 'maybe',
    },
  });
  assert.notEqual(invalidBooleanEnv.status, 0);
  assert.match(invalidBooleanEnv.stderr, /Boolean value must be true or false, got maybe/);

  const fakeBin = path.join(tempRoot, 'bin');
  writeExecutable(path.join(fakeBin, 'gh'), `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.join(' ').startsWith('release view')) {
  process.stdout.write(JSON.stringify({
    tagName: 'v26.5.19',
    isDraft: true,
    isPrerelease: false,
    publishedAt: null
  }) + '\\n');
  process.exit(0);
}
if (args.join(' ') === 'api repos/gaofeng21cn/opl-aion-shell/commits/main --jq .sha') {
  process.stdout.write('2222222222222222222222222222222222222222\\n');
  process.exit(0);
}
if (args.join(' ') === 'api repos/gaofeng21cn/one-person-lab/commits/main --jq .sha') {
  process.stdout.write('3333333333333333333333333333333333333333\\n');
  process.exit(0);
}
console.error('unexpected gh args: ' + JSON.stringify(args));
process.exit(2);
`);
  writeExecutable(path.join(fakeBin, 'npm'), `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.join(' ') === 'view @openai/codex@latest version dist.tarball --json') {
  process.stdout.write(JSON.stringify({
    version: '0.141.0',
    dist: { tarball: 'https://registry.npmjs.org/@openai/codex/-/codex-0.141.0.tgz' }
  }) + '\\n');
  process.exit(0);
}
if (args.join(' ') === 'view @openai/codex@0.141.0-darwin-arm64 version dist.tarball --json') {
  process.stdout.write(JSON.stringify({
    version: '0.141.0-darwin-arm64',
    dist: { tarball: 'https://registry.npmjs.org/@openai/codex/-/codex-0.141.0-darwin-arm64.tgz' }
  }) + '\\n');
  process.exit(0);
}
console.error('unexpected npm args: ' + JSON.stringify(args));
process.exit(2);
`);
  writeExecutable(path.join(fakeBin, 'git'), `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "ls-remote" ]; then
  echo "\${OPL_FAKE_TAG_SHA:-1111111111111111111111111111111111111111} refs/tags/v26.5.19"
  exit 0
fi
echo "unexpected git args: $*" >&2
exit 2
`);

  const staleDraftRefresh = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'false',
    '--expected-app-head',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ], {
    env: {
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
      OPL_HOMEBREW_TAP_TOKEN_PRESENT: 'true',
      OPL_FAKE_TAG_SHA: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
  });
  assert.notEqual(staleDraftRefresh.status, 0);
  const staleDraftRefreshPayload = JSON.parse(staleDraftRefresh.stdout);
  assert.equal(staleDraftRefreshPayload.status, 'failed');
  assert.equal(staleDraftRefreshPayload.release_target.tag_sha, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assertCheck(
    staleDraftRefreshPayload,
    'remote_target',
    'failed',
    /points at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.*expected current App head aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/s,
  );

  const draftRefresh = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'false',
    '--expected-app-head',
    '1111111111111111111111111111111111111111',
  ], {
    env: {
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
      OPL_HOMEBREW_TAP_TOKEN_PRESENT: 'true',
    },
  });
  assert.equal(draftRefresh.status, 0, draftRefresh.stderr || draftRefresh.stdout);
  const draftRefreshPayload = JSON.parse(draftRefresh.stdout);
  assert.equal(draftRefreshPayload.release_target.kind, 'draft_release');
  assert.equal(draftRefreshPayload.homebrew.tap_update_required, false);
  assert.equal(draftRefreshPayload.homebrew.tap_token_required, false);
  assert.equal(draftRefreshPayload.homebrew.tap_update_owner, 'desktop_release_promote_after_publish');
  assertCheck(draftRefreshPayload, 'homebrew_tap_token', 'skipped', /promote workflow/);

  const newReleaseWithoutTapToken = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.20',
    '--release-mode',
    'new_release',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'true',
    '--offline',
  ], {
    env: {
      OPL_HOMEBREW_TAP_TOKEN_PRESENT: 'false',
    },
  });
  assert.equal(newReleaseWithoutTapToken.status, 0, newReleaseWithoutTapToken.stderr || newReleaseWithoutTapToken.stdout);
  const newReleaseWithoutTapTokenPayload = JSON.parse(newReleaseWithoutTapToken.stdout);
  assert.equal(newReleaseWithoutTapTokenPayload.status, 'passed');
  assert.equal(newReleaseWithoutTapTokenPayload.homebrew.tap_update_required, false);
  assert.equal(newReleaseWithoutTapTokenPayload.homebrew.tap_token_required, false);
  assert.equal(newReleaseWithoutTapTokenPayload.homebrew.tap_update_owner, 'desktop_release_promote_after_publish');
  assertCheck(newReleaseWithoutTapTokenPayload, 'homebrew_tap_token', 'skipped', /does not block App, Full, or Docker\/WebUI candidate creation/);

  const failure = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'false',
    '--offline',
  ], {
    env: {
      OPL_HOMEBREW_TAP_TOKEN_PRESENT: 'false',
    },
  });
  assert.notEqual(failure.status, 0);
  const failedPayload = JSON.parse(failure.stdout);
  assert.equal(failedPayload.status, 'failed');
  assertCheck(failedPayload, 'homebrew_tap_token', 'failed', /OPL_HOMEBREW_TAP_TOKEN/);

  const missingSigningSecrets = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'false',
    '--run-vm-smoke',
    'false',
    '--publish-docker-webui',
    'false',
    '--offline',
  ]);
  assert.equal(missingSigningSecrets.status, 0, missingSigningSecrets.stderr || missingSigningSecrets.stdout);
  const missingSigningPayload = JSON.parse(missingSigningSecrets.stdout);
  assert.equal(missingSigningPayload.status, 'passed');
  assertCheck(missingSigningPayload, 'macos_local_authorization', 'passed', /Developer ID signing\/notarization secrets are optional/);
});

test('release preflight allows Docker WebUI trains without clean Windows VM evidence', () => {
  const missingEvidence = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'false',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'true',
    '--offline',
  ], {
    env: {
      OPL_HOMEBREW_TAP_TOKEN_PRESENT: 'true',
    },
  });

  assert.equal(missingEvidence.status, 0, missingEvidence.stderr || missingEvidence.stdout);
  const warningPayload = JSON.parse(missingEvidence.stdout);
  assert.equal(warningPayload.status, 'passed');
  assert.equal(warningPayload.inputs.publish_docker_webui, true);
  assert.equal(warningPayload.inputs.docker_webui_clean_windows_evidence_artifact, '');
  assertCheck(warningPayload, 'docker_webui_clean_windows_evidence_artifact', 'warning', /optional/);

  const emptyWorkflowInput = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'false',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'true',
    '--docker-webui-clean-windows-evidence-artifact',
    '',
    '--framework-ref',
    'main',
    '--shell-ref',
    'main',
    '--offline',
  ], {
    env: {
      OPL_HOMEBREW_TAP_TOKEN_PRESENT: 'true',
    },
  });
  assert.equal(emptyWorkflowInput.status, 0, emptyWorkflowInput.stderr || emptyWorkflowInput.stdout);
  const emptyWorkflowPayload = JSON.parse(emptyWorkflowInput.stdout);
  assert.equal(emptyWorkflowPayload.inputs.docker_webui_clean_windows_evidence_artifact, '');
  assert.equal(emptyWorkflowPayload.inputs.framework_ref, 'main');
  assert.equal(emptyWorkflowPayload.inputs.shell_ref, 'main');

  const declaredEvidence = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'false',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'true',
    '--docker-webui-clean-windows-evidence-artifact',
    'docker-webui-clean-windows-vm-evidence',
    '--offline',
  ], {
    env: {
      OPL_HOMEBREW_TAP_TOKEN_PRESENT: 'true',
    },
  });
  assert.equal(declaredEvidence.status, 0, declaredEvidence.stderr || declaredEvidence.stdout);
  const passedPayload = JSON.parse(declaredEvidence.stdout);
  assertCheck(passedPayload, 'docker_webui_clean_windows_evidence_artifact', 'passed');

  const diagnosticDraft = runNode([
    'scripts/validate-release-preflight.ts',
    '--version',
    '26.5.19',
    '--release-mode',
    'draft_candidate',
    '--include-full-package',
    'false',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'true',
    '--offline',
  ]);
  assert.equal(diagnosticDraft.status, 0, diagnosticDraft.stderr || diagnosticDraft.stdout);
  const draftPayload = JSON.parse(diagnosticDraft.stdout);
  assertCheck(draftPayload, 'docker_webui_clean_windows_evidence_artifact', 'warning', /optional/);
});

test('publish dry run skips existing release assets when a resumed upload already has matching files', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-resume-'));
  const version = '26.5.19-resume';
  const { shellRoot, outDir, fakeAi, dmgName, zipName, dmgContent, zipContent } = writeStandardPublishFixture(tempRoot, version);

  const existingAssets = [
    { name: dmgName, size: Buffer.byteLength(dmgContent), digest: `sha256:${sha256(dmgContent)}` },
    { name: zipName, size: Buffer.byteLength(zipContent), digest: `sha256:${sha256(zipContent)}` },
    {
      name: 'latest-arm64-mac.yml',
      size: fs.statSync(path.join(outDir, 'latest-arm64-mac.yml')).size,
      digest: `sha256:${sha256(fs.readFileSync(path.join(outDir, 'latest-arm64-mac.yml')))}`,
    },
  ];
  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_EXISTING_ASSETS_JSON: JSON.stringify(existingAssets),
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_exists, true);
  assert.ok(payload.skipped_existing_artifacts.some((artifact) => artifact.name === dmgName));
  assert.ok(payload.skipped_existing_artifacts.some((artifact) => artifact.name === zipName));
  assert.ok(payload.upload_command.every((part) => !String(part).endsWith('.dmg')));
  assert.equal(payload.force_upload, false);
});

test('publish dry run reuploads same-size existing release assets when sha256 digest is missing or different', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-resume-strict-'));
  const version = '26.5.19-resume-strict';
  const { shellRoot, fakeAi, dmgName, zipName } = writeStandardPublishFixture(tempRoot, version);

  const existingAssets = [
    { name: dmgName, size: 3 },
    { name: zipName, size: 3, digest: `sha256:${sha256('old')}` },
  ];
  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_EXISTING_ASSETS_JSON: JSON.stringify(existingAssets),
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.upload_command.some((part) => String(part).endsWith('.dmg')));
  assert.ok(payload.upload_command.some((part) => String(part).endsWith('.zip')));
  assert.deepEqual(payload.skipped_existing_artifacts, []);
});

test('standard publish can explicitly use deterministic template release notes without calling AI writer', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-standard-deterministic-notes-'));
  const version = '26.5.19-deterministic-notes';
  const { shellRoot, fakeAi } = writeStandardPublishFixture(tempRoot, version, { writeDefaultAi: false });
  fs.writeFileSync(fakeAi, '#!/usr/bin/env node\nprocess.exit(42);\n', { mode: 0o755 });

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_NOTES_MODE: 'template',
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_notes_mode, 'template');
  assert.match(payload.release_notes, /One Person Lab v26\.5\.19-deterministic-notes/);
  assert.match(payload.release_notes, new RegExp(stableInstallCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('standard publish defaults to AI release notes writer', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-standard-ai-notes-'));
  const promptCapture = path.join(tempRoot, 'ai-prompt.txt');
  const version = '26.5.19-ai-default';
  const { shellRoot, fakeAi } = writeStandardPublishFixture(tempRoot, version, { writeDefaultAi: false });
  writeExecutable(fakeAi, `#!/usr/bin/env node
const fs = require('node:fs');
const input = fs.readFileSync(0, 'utf8');
fs.writeFileSync(${JSON.stringify(promptCapture)}, input);
process.stdout.write(${JSON.stringify(validStandardAiReleaseNotes(version))});
`);

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_notes_mode, 'ai');
  assert.match(payload.release_notes, /One Person Lab v26\.5\.19-ai-default/);
  assert.ok(fs.existsSync(promptCapture));
  assert.match(fs.readFileSync(promptCapture, 'utf8'), /"release_evidence"/);
});

test('publish consumes a prepared release notes file before calling AI', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-prepared-release-notes-'));
  const releaseNotesFile = path.join(tempRoot, 'prepared-notes.md');
  const badReleaseNotesFile = path.join(tempRoot, 'bad-notes.md');
  const aiCalledMarker = path.join(tempRoot, 'ai-called');
  const version = '26.5.19-prepared-notes';
  const { shellRoot, fakeAi } = writeStandardPublishFixture(tempRoot, version, { writeDefaultAi: false });

  writeExecutable(fakeAi, `#!/usr/bin/env node
require('node:fs').writeFileSync(${JSON.stringify(aiCalledMarker)}, 'called');
process.exit(42);
`);
  const preparedNotes = validStandardAiReleaseNotes(version)
    .replace('\n## What improved', '\n## Highlights\n\n- Users get the Stable App package with the built-in OPL agent entries ready after install.\n\n## What improved')
    .replace('\n## OPL agents and runtime payload', '\n## Compatibility and action required\n\n- Install or upgrade the Stable App package.\n\n## OPL agents and runtime payload');
  writeFile(releaseNotesFile, preparedNotes);
  writeFile(
    badReleaseNotesFile,
    preparedNotes.replace(/\n## Highlights\n\n- Users get the Stable App package with the built-in OPL agent entries ready after install.\n/, ''),
  );

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
    '--release-notes-file',
    releaseNotesFile,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_notes_mode, 'file');
  assert.equal(payload.release_notes_file, releaseNotesFile);
  assert.match(payload.release_notes, /## Highlights/);
  assert.ok(!fs.existsSync(aiCalledMarker));

  const missingSection = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--dry-run',
    '--shell-root',
    shellRoot,
    '--version',
    version,
    '--release-notes-file',
    badReleaseNotesFile,
  ], {
    env: {
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });
  assert.notEqual(missingSection.status, 0);
  assert.match(missingSection.stderr, /missing ## Highlights/);
  assert.ok(!fs.existsSync(aiCalledMarker));
});

test('publish retries an individual release asset upload before failing the refresh', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-upload-retry-'));
  const binDir = path.join(tempRoot, 'bin');
  const fakeGh = path.join(binDir, 'gh');
  const logPath = path.join(tempRoot, 'gh-calls.log');
  const version = '26.5.19-upload-retry';
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const { shellRoot, fakeAi } = writeStandardPublishFixture(tempRoot, version);
  writeFile(
    fakeGh,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `echo "$*" >> ${JSON.stringify(logPath)}`,
      'if [ "$1" = "release" ] && [ "$2" = "view" ]; then',
      '  echo \'{"tagName":"vtest","assets":[]}\'',
      '  exit 0',
      'fi',
      'if [ "$1" = "release" ] && [ "$2" = "edit" ]; then',
      '  exit 0',
      'fi',
      'if [ "$1" = "release" ] && [ "$2" = "upload" ]; then',
      '  asset="$4"',
      '  if [[ "$asset" == *.zip ]]; then',
      '    marker="$asset.retry-marker"',
      '    if [ ! -f "$marker" ]; then',
      '      touch "$marker"',
      '      echo "simulated zip upload timeout" >&2',
      '      exit 124',
      '    fi',
      '  fi',
      '  exit 0',
      'fi',
      'echo "unexpected gh call: $*" >&2',
      'exit 1',
      '',
    ].join('\n'),
  );
  fs.chmodSync(fakeGh, 0o755);

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const ghCalls = fs.readFileSync(logPath, 'utf8');
  assert.equal((ghCalls.match(new RegExp(`${zipName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} --repo`, 'g')) ?? []).length, 2);
});

test('new release upload failure deletes only the incomplete release and keeps tag for recovery', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-upload-failure-cleanup-'));
  const binDir = path.join(tempRoot, 'bin');
  const fakeGh = path.join(binDir, 'gh');
  const logPath = path.join(tempRoot, 'gh-calls.log');
  const version = '26.5.19-upload-failure';
  const { shellRoot, fakeAi } = writeStandardPublishFixture(tempRoot, version);
  writeFile(
    fakeGh,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `echo "$*" >> ${JSON.stringify(logPath)}`,
      'if [ "$1" = "release" ] && [ "$2" = "view" ]; then',
      '  exit 1',
      'fi',
      'if [ "$1" = "release" ] && [ "$2" = "create" ]; then',
      '  exit 0',
      'fi',
      'if [ "$1" = "release" ] && [ "$2" = "upload" ]; then',
      '  echo "simulated upload failure" >&2',
      '  exit 1',
      'fi',
      'if [ "$1" = "release" ] && [ "$2" = "delete" ]; then',
      '  for arg in "$@"; do',
      '    if [ "$arg" = "--cleanup-tag" ]; then',
      '      echo "cleanup-tag must not be used by publish failure cleanup" >&2',
      '      exit 2',
      '    fi',
      '  done',
      '  exit 0',
      'fi',
      'echo "unexpected gh call: $*" >&2',
      'exit 1',
      '',
    ].join('\n'),
  );
  fs.chmodSync(fakeGh, 0o755);

  const result = runNode([
    'scripts/publish-release.ts',
    '--no-build',
    '--shell-root',
    shellRoot,
    '--version',
    version,
  ], {
    env: {
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      OPL_RELEASE_UPLOAD_ATTEMPTS: '1',
    },
  });

  assert.notEqual(result.status, 0);
  const ghCalls = fs.readFileSync(logPath, 'utf8');
  assert.match(ghCalls, new RegExp(`release create v${version}`));
  assert.match(ghCalls, new RegExp(`release delete v${version} --repo gaofeng21cn/one-person-lab-app --yes`));
  assert.doesNotMatch(ghCalls, /--cleanup-tag/);
});

test('publish dry run generates deterministic English release notes for Full-only lane', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-notes-'));
  const fullPackageDir = path.join(tempRoot, 'full');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const version = '26.5.18';
  writeFullPackageFixture(fullPackageDir, version);
  fs.writeFileSync(fakeAi, '#!/usr/bin/env node\nprocess.exit(42);\n', { mode: 0o755 });

  const result = runNode([
    'scripts/publish-release.ts',
    '--dry-run',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullPackageDir,
  ], {
    env: {
      OPL_RELEASE_NOTES_MODE: 'template',
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_notes_mode, 'template');
  assert.deepEqual(
    payload.full_package_artifacts.map((artifact) => path.basename(artifact)),
    [`One-Person-Lab-Full-${version}-mac-arm64.dmg`, 'opl-release-manifest.json'],
  );
  assert.ok(payload.upload_commands.some((command) => command.some((part) => String(part).endsWith('opl-release-manifest.json'))));
  for (const legacyName of [
    'full-package-manifest.json',
    'runtime-cache-events.json',
    'full-runtime-currentness-probe.json',
    'full-runtime-native-trust.json',
    'full-app-bundle-trim-report.json',
    'full-package-boundary-audit.json',
    'README-Full-First-Install.txt',
    'SHA256SUMS.txt',
    'full-local-authorization-policy.json',
  ]) {
    assert.ok(!payload.full_package_artifacts.some((artifact) => artifact.endsWith(legacyName)));
    assert.ok(!payload.upload_commands.some((command) => command.some((part) => String(part).endsWith(legacyName))));
  }
});

test('publish rejects Full notes when OPL Meta Agent release-note metadata is missing', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-notes-meta-agent-'));
  const fullPackageDir = path.join(tempRoot, 'full');
  const version = '26.5.19-meta-missing';
  writeFullPackageFixture(fullPackageDir, version, fullPackageManifest({ meta_agent: undefined }));

  const result = runNode([
    'scripts/publish-release.ts',
    '--dry-run',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullPackageDir,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /components\.meta_agent\.git_commit/);
});

test('publish rejects Full package native trust when quarantine remains', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-full-native-trust-quarantine-'));
  const fullPackageDir = path.join(tempRoot, 'full');
  const version = '26.5.19-native-trust-quarantine';
  writeFullPackageFixture(fullPackageDir, version, fullPackageManifest(), {
    nativeTrustJson: `${JSON.stringify({
      schema: 'opl_full_runtime_native_trust.v1',
      status: 'local_authorized_unsigned',
      executable_count: 1,
      executables: [
        {
          relative_path: 'runtime/current/node/bin/node',
          assessment_kind: 'launched_executable',
          codesign_status: 'failed_allowed_unsigned',
          spctl_status: 'deferred_until_notarized_app',
          team_identifier: null,
          signature: null,
          quarantine_status: 'present',
        },
      ],
    }, null, 2)}\n`,
  });

  const result = runNode([
    'scripts/publish-release.ts',
    '--dry-run',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullPackageDir,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Full runtime native executable is not locally authorized/);
});

test('Full-only release publish uses deterministic notes and does not call the AI note writer', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-full-only-template-notes-'));
  const fullPackageDir = path.join(tempRoot, 'full');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const evidencePath = path.join(tempRoot, 'full-release-notes-evidence.json');
  const version = '26.5.20-full-only-template';
  writeFullPackageFixture(fullPackageDir, version);
  fs.mkdirSync(path.dirname(fakeAi), { recursive: true });
  fs.writeFileSync(fakeAi, '#!/usr/bin/env node\nprocess.exit(42);\n', { mode: 0o755 });

  const result = runNode([
    'scripts/publish-release.ts',
    '--dry-run',
    '--version',
    version,
    '--full-package-only',
    '--include-full-package',
    '--full-package-dir',
    fullPackageDir,
  ], {
    env: {
      OPL_RELEASE_NOTES_MODE: 'template',
      OPL_RELEASE_EXISTS: '1',
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
      OPL_RELEASE_NOTES_EVIDENCE_OUTPUT: evidencePath,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_notes_mode, 'template');
  assert.equal(payload.full_package_only, true);
  assert.equal(payload.create_release, false);
  assert.ok(fs.existsSync(evidencePath));
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  assert.equal(evidence.payload.include_full_package, true);
  assert.ok(evidence.payload.bundled_refs.some((line) => line.includes('MAS @ 1111111')));
});
