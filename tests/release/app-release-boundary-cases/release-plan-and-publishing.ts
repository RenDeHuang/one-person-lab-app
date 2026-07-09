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
  withHiddenLocalizedReleaseNotes,
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
  assert.equal(payload.strategy.refresh_existing, 'emergency_repair_or_replace_existing_release_only');
  assert.equal(payload.strategy.post_release_user_guide_screenshots, 'after_promotion_not_pre_promotion_gate');
  assert.equal(payload.strategy.same_tag_replacement, 'avoid_for_new_versions');
  assert.equal(payload.strategy.resume_uploads, 'skip_existing_assets_when_size_and_sha256_digest_match');
  assert.equal(payload.strategy.full_runtime_cache, 'content_addressed_layer_cache');
  const lanes = new Map(payload.lanes.map((lane) => [lane.id, lane]));
  const lane = (id: string) => {
    const found = lanes.get(id);
    assert.ok(found, `missing lane ${id}`);
    return found;
  };
  for (const id of [
    'release_preflight',
    'release_boundary',
    'standard_build',
    'full_build',
    'standard_dmg_clean_vm_smoke',
    'remote_verify_standard_and_full',
    'one_shot_app_installer_smoke',
    'docker_webui_smoke',
    'homebrew_standard_cask_clean_vm_smoke',
    'full_dmg_clean_vm_smoke',
    'release_evidence_bundle',
    'release_candidate_record',
    'promote_stable_release',
    'release_promotion_record',
    'post_release_user_guide_screenshots',
  ]) {
    lane(id);
  }
  assert.equal(payload.profile, 'stable');
  assert.equal(lane('release_preflight').phase, 'fast_candidate');
  assert.match(lane('release_preflight').command, /npm run release:preflight/);
  assert.deepEqual(lane('full_build').depends_on, [
    'release_preflight',
    'full_runtime_keys',
    'standard_dmg_clean_vm_smoke',
  ]);
  assert.equal(lane('full_build').can_run_with.includes('standard_build'), false);
  assert.match(lane('full_build').command, /OPL_FULL_RUNTIME_CACHE_MODE=readwrite/);
  assert.equal(lane('standard_dmg_clean_vm_smoke').phase, 'installation_gate');
  assert.match(lane('standard_dmg_clean_vm_smoke').command, /--runtime-profile standard/);
  assert.equal(lane('full_dmg_clean_vm_smoke').phase, 'release_gate');
  assert.match(lane('full_dmg_clean_vm_smoke').command, /--runtime-profile full/);
  assert.match(lane('homebrew_standard_cask_clean_vm_smoke').command, /gaofeng21cn\/one-person-lab\/one-person-lab/);
  assert.ok(lane('remote_verify_standard_and_full').depends_on.includes('standard_dmg_clean_vm_smoke'));
  assert.ok(lane('remote_verify_standard_and_full').depends_on.includes('publish_full_assets'));
  assert.ok(lane('one_shot_app_installer_smoke').depends_on.includes('standard_dmg_clean_vm_smoke'));
  assert.ok(lane('docker_webui_smoke').depends_on.includes('standard_dmg_clean_vm_smoke'));
  assert.ok(lane('release_candidate_record').depends_on.includes('release_readiness_summary'));
  assert.match(lane('release_candidate_record').command, /npm run release:candidate-record/);
  assert.match(lane('promote_stable_release').command, /status=ready_to_promote/);
  assert.ok(lane('release_promotion_record').depends_on.includes('promote_stable_release'));
  assert.equal(lane('post_release_user_guide_screenshots').phase, 'post_release');
  assert.match(lane('post_release_user_guide_screenshots').command, /never a pre-promotion gate/);
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
  assert.ok(payload.checks.some((check) => check.id === 'remote_target' && check.status === 'skipped'));
  assert.ok(payload.checks.some((check) => check.id === 'release_refs' && check.status === 'skipped'));
  assert.ok(payload.checks.some((check) => check.id === 'codex_package_metadata' && check.status === 'skipped'));
  assert.ok(payload.checks.some((check) => (
    check.id === 'docker_webui_clean_windows_evidence_artifact'
    && check.status === 'skipped'
  )));
  assert.ok(payload.checks.some((check) => check.id === 'full_workflow_call' && check.status === 'passed'));
  assert.ok(payload.checks.some((check) => (
    check.id === 'homebrew_vm_gate_static_policy'
    && check.status === 'passed'
  )));
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
  assert.ok(standardOnlyPayload.checks.some((check) => (
    check.id === 'full_workflow_call'
    && check.status === 'skipped'
  )));

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
  assert.ok(staleDraftRefreshPayload.checks.some((check) => (
    check.id === 'remote_target'
    && check.status === 'failed'
    && check.message.includes('points at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    && check.message.includes('expected current App head aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  )));

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
  assert.ok(draftRefreshPayload.checks.some((check) => (
    check.id === 'homebrew_tap_token'
    && check.status === 'skipped'
    && check.message.includes('promote workflow')
  )));

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
  assert.ok(newReleaseWithoutTapTokenPayload.checks.some((check) => (
    check.id === 'homebrew_tap_token'
    && check.status === 'skipped'
    && check.message.includes('does not block App, Full, or Docker/WebUI candidate creation')
  )));

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
  assert.ok(failedPayload.checks.some((check) => (
    check.id === 'homebrew_tap_token'
    && check.status === 'failed'
    && check.message.includes('OPL_HOMEBREW_TAP_TOKEN')
  )));

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
  assert.ok(missingSigningPayload.checks.some((check) => (
    check.id === 'macos_local_authorization'
    && check.status === 'passed'
    && check.message.includes('Developer ID signing/notarization secrets are optional')
  )));
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
  assert.ok(warningPayload.checks.some((check) => (
    check.id === 'docker_webui_clean_windows_evidence_artifact'
    && check.status === 'warning'
    && check.message.includes('optional')
  )));

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
  assert.ok(passedPayload.checks.some((check) => (
    check.id === 'docker_webui_clean_windows_evidence_artifact'
    && check.status === 'passed'
  )));

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
  assert.ok(draftPayload.checks.some((check) => (
    check.id === 'docker_webui_clean_windows_evidence_artifact'
    && check.status === 'warning'
    && check.message.includes('optional')
  )));
});

test('publish dry run skips existing release assets when a resumed upload already has matching files', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-resume-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const version = '26.5.19-resume';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;

  const dmgContent = 'dmg';
  const zipContent = 'zip';
  writeFile(path.join(outDir, dmgName), dmgContent);
  writeFile(path.join(outDir, zipName), zipContent);
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(outDir);
  writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));

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
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const version = '26.5.19-resume-strict';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;

  writeFile(path.join(outDir, dmgName), 'dmg');
  writeFile(path.join(outDir, zipName), 'zip');
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(outDir);
  writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));

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
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const version = '26.5.19-deterministic-notes';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;

  writeFile(path.join(outDir, dmgName), 'dmg');
  writeFile(path.join(outDir, zipName), 'zip');
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(outDir);
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
  assert.match(payload.release_notes, /## What improved/);
  assert.match(payload.release_notes, /## OPL agents and runtime payload/);
  assert.match(payload.release_notes, /## OPL family updates/);
  assert.match(payload.release_notes, /One Person Lab App/);
  assert.match(payload.release_notes, /OPL Aion Shell/);
  assert.match(payload.release_notes, /## Install Stable/);
  assert.match(payload.release_notes, new RegExp(stableInstallCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(payload.release_notes, /## Release scope/);
});

test('standard publish defaults to AI release notes writer', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-standard-ai-notes-'));
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const promptCapture = path.join(tempRoot, 'ai-prompt.txt');
  const version = '26.5.19-ai-default';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;

  writeFile(path.join(outDir, dmgName), 'dmg');
  writeFile(path.join(outDir, zipName), 'zip');
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(outDir);
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
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const releaseNotesFile = path.join(tempRoot, 'prepared-notes.md');
  const badReleaseNotesFile = path.join(tempRoot, 'bad-notes.md');
  const aiCalledMarker = path.join(tempRoot, 'ai-called');
  const version = '26.5.19-prepared-notes';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;
  const publicMarkdown = `One Person Lab v${version}

Users can install or upgrade One Person Lab App and open MAS research, MAG grant-writing, RCA visual deliverable, and OPL Meta Agent sessions with clearer setup.

## Highlights

- Standard App users get clearer MAS, MAG, RCA, and OPL Meta Agent entry points.

## What improved

- MAS research, MAG grant-writing, RCA visual deliverable, and OPL Meta Agent sessions are easier to start after install.

## Compatibility and action required

- No manual migration is required beyond installing or upgrading this Stable release.

## OPL agents and runtime payload

- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.

## OPL family updates

- One Person Lab App: current standard package changes keep the built-in OPL entries aligned.
- OPL Aion Shell: current shell changes keep the first-run and settings UI aligned with the App release.

## Install Stable

\`${stableInstallCommand}\`

## Release scope

- Standard macOS arm64 updater package is published for this release.
`;

  writeFile(path.join(outDir, dmgName), 'dmg');
  writeFile(path.join(outDir, zipName), 'zip');
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(outDir);
  writeExecutable(fakeAi, `#!/usr/bin/env node
require('node:fs').writeFileSync(${JSON.stringify(aiCalledMarker)}, 'called');
process.exit(42);
`);
  writeFile(releaseNotesFile, withHiddenLocalizedReleaseNotes(publicMarkdown, `One Person Lab v${version}

这次更新让用户安装或升级 One Person Lab App 后，更容易打开 MAS、MAG、RCA 和 OPL Meta Agent 会话。

## Highlights

- MAS、MAG、RCA 和 OPL Meta Agent 入口更清楚。

## What improved

- MAS、MAG、RCA 和 OPL Meta Agent 会话更容易开始。

## Compatibility and action required

- 除安装或升级 Stable 版本外，不需要手动迁移。

## OPL agents and runtime payload

- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.

## OPL family updates

- One Person Lab App: 当前标准包更新会让内置 OPL 入口保持一致。
- OPL Aion Shell: 当前 shell 更新会让首次启动和设置界面与 App 发布保持一致。

## Install Stable

\`${stableInstallCommand}\`

## Release scope

- Standard macOS arm64 updater package is published for this release.
`));
  writeFile(
    badReleaseNotesFile,
    fs.readFileSync(releaseNotesFile, 'utf8').replace(/\n## Highlights\n\n- Standard App users get clearer MAS, MAG, RCA, and OPL Meta Agent entry points.\n/, ''),
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
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const binDir = path.join(tempRoot, 'bin');
  const fakeGh = path.join(binDir, 'gh');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const logPath = path.join(tempRoot, 'gh-calls.log');
  const version = '26.5.19-upload-retry';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;

  writeFile(path.join(outDir, dmgName), 'dmg');
  writeFile(path.join(outDir, zipName), 'zip');
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(outDir);
  writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));
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
  const shellRoot = path.join(tempRoot, 'shells', 'aionui');
  const outDir = path.join(shellRoot, 'out');
  const binDir = path.join(tempRoot, 'bin');
  const fakeGh = path.join(binDir, 'gh');
  const fakeAi = path.join(tempRoot, 'fake-release-notes-ai.js');
  const logPath = path.join(tempRoot, 'gh-calls.log');
  const version = '26.5.19-upload-failure';
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const zipName = `One-Person-Lab-${version}-mac-arm64.zip`;

  writeFile(path.join(outDir, dmgName), 'dmg');
  writeFile(path.join(outDir, zipName), 'zip');
  writeReleaseMetadata(outDir, version, dmgName);
  writeStandardLocalAuthorizationPolicy(outDir);
  writeFakeReleaseNotesAiWriter(fakeAi, validStandardAiReleaseNotes(version));
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
  const manifest = {
    generated_at: '2026-05-18T12:00:00.000Z',
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
    },
  };

  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(withFullPackageOptimizationManifest(manifest), null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFullRuntimeCurrentnessProbe(fullPackageDir, manifest);
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullLocalAuthorizationPolicy(fullPackageDir);
  writeFullRuntimeNativeTrust(fullPackageDir);
  writeFullPackageOptimizationArtifacts(fullPackageDir, version);
  writeFullPublicReleaseManifest(fullPackageDir, version, withFullPackageOptimizationManifest(manifest));
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
  const manifest = {
    generated_at: '2026-05-19T12:00:00.000Z',
    distribution: {
      updater_metadata_allowed: false,
    },
      components: {
        opl: { git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        codex: { version: 'codex-cli 0.130.0' },
        mas: { git_commit: '1111111111111111111111111111111111111111' },
        mag: { git_commit: '2222222222222222222222222222222222222222' },
        rca: { git_commit: '3333333333333333333333333333333333333333' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
    },
  };

  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(withFullPackageOptimizationManifest(manifest), null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFullRuntimeCurrentnessProbe(fullPackageDir, manifest);
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullLocalAuthorizationPolicy(fullPackageDir);
  writeFullRuntimeNativeTrust(fullPackageDir);
  writeFullPackageOptimizationArtifacts(fullPackageDir, version);
  writeFullPublicReleaseManifest(fullPackageDir, version, withFullPackageOptimizationManifest(manifest));

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
  const manifest = {
    generated_at: '2026-05-19T12:00:00.000Z',
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
    },
  };

  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(withFullPackageOptimizationManifest(manifest), null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFullRuntimeCurrentnessProbe(fullPackageDir, manifest);
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullLocalAuthorizationPolicy(fullPackageDir);
  writeFullPackageOptimizationArtifacts(fullPackageDir, version);
  writeFile(
    path.join(fullPackageDir, 'full-runtime-native-trust.json'),
    `${JSON.stringify({
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
  );
  writeFullPublicReleaseManifest(fullPackageDir, version, withFullPackageOptimizationManifest(manifest));

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
  const manifest = {
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
    },
  };

  writeFile(path.join(fullPackageDir, `One-Person-Lab-Full-${version}-mac-arm64.dmg`));
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(withFullPackageOptimizationManifest(manifest), null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFullRuntimeCurrentnessProbe(fullPackageDir, manifest);
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullLocalAuthorizationPolicy(fullPackageDir);
  writeFullRuntimeNativeTrust(fullPackageDir);
  writeFullPackageOptimizationArtifacts(fullPackageDir, version);
  writeFullPublicReleaseManifest(fullPackageDir, version, withFullPackageOptimizationManifest(manifest));
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
  assert.match(payload.release_notes, /OPL agents and runtime payload/);
  assert.match(payload.release_notes, /MAS @ 1111111/);
  assert.match(payload.release_notes, /MAG @ 2222222/);
  assert.match(payload.release_notes, /RCA @ 3333333/);
  assert.match(payload.release_notes, /OPL Meta Agent @ 4444444/);
  assert.ok(fs.existsSync(evidencePath));
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  assert.equal(evidence.payload.include_full_package, true);
  assert.ok(evidence.payload.bundled_refs.some((line) => line.includes('MAS @ 1111111')));
});
