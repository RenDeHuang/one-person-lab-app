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
  stripLocalizedReleaseNotesForTest,
  writeReleaseMetadata,
  writeStandardLocalAuthorizationPolicy,
  writeFullLocalAuthorizationPolicy,
  writeFullRuntimeNativeTrust,
  writeExecutable,
  sha256,
} from './helpers.ts';

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
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'release_preflight'
    && lane.phase === 'fast_candidate'
    && lane.command.includes('npm run release:preflight')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'release_boundary'
    && lane.depends_on.includes('release_preflight')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'standard_build'
    && lane.depends_on.includes('release_preflight')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'full_build'
    && lane.depends_on.includes('release_preflight')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'full_build'
    && lane.depends_on.includes('standard_dmg_clean_vm_smoke')
    && !lane.can_run_with.includes('standard_build')
    && lane.command.includes('OPL_FULL_RUNTIME_CACHE_MODE=readwrite')
  )));
  assert.equal(payload.profile, 'stable');
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'standard_dmg_clean_vm_smoke'
    && lane.phase === 'installation_gate'
    && lane.command.includes('One-Person-Lab-26.5.19-mac-arm64.dmg')
    && lane.command.includes('--smoke-profile no-clt-clean-vm')
    && lane.command.includes('--display 1920x1080px')
    && lane.command.includes('--settings-smoke')
    && lane.command.includes('--assistant-route-smoke')
    && lane.command.includes('--runtime-profile standard')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'remote_verify_standard_and_full'
    && lane.depends_on.includes('standard_dmg_clean_vm_smoke')
    && lane.depends_on.includes('publish_full_assets')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'one_shot_app_installer_smoke'
    && lane.depends_on.includes('standard_dmg_clean_vm_smoke')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'docker_webui_smoke'
    && lane.depends_on.includes('standard_dmg_clean_vm_smoke')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'homebrew_standard_cask_clean_vm_smoke'
    && lane.phase === 'installation_gate'
    && lane.command.includes('--install-mode homebrew-cask')
    && lane.command.includes('--homebrew-cask gaofeng21cn/one-person-lab/one-person-lab')
    && lane.command.includes('--smoke-profile homebrew-standard-cask')
    && lane.command.includes('--display 1920x1080px')
    && lane.command.includes('--settings-smoke')
    && lane.command.includes('--assistant-route-smoke')
    && lane.command.includes('--runtime-profile standard')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'full_dmg_clean_vm_smoke'
    && lane.phase === 'release_gate'
    && lane.command.includes('One-Person-Lab-Full-26.5.19-mac-arm64.dmg')
    && lane.command.includes('--smoke-profile no-clt-clean-vm')
    && lane.command.includes('--display 1920x1080px')
    && lane.command.includes('--settings-smoke')
    && lane.command.includes('--assistant-route-smoke')
    && lane.command.includes('--runtime-profile full')
  )));
  assert.ok(payload.lanes.some((lane) => lane.id === 'one_shot_app_installer_smoke'));
  assert.ok(payload.lanes.some((lane) => lane.id === 'docker_webui_smoke'));
  assert.ok(payload.lanes.some((lane) => lane.id === 'release_evidence_bundle'));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'release_candidate_record'
    && lane.depends_on.includes('release_readiness_summary')
    && lane.depends_on.includes('remote_verify_standard_and_full')
    && lane.command.includes('npm run release:candidate-record')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'promote_stable_release'
    && lane.depends_on.includes('release_candidate_record')
    && lane.command.includes('desktop-release-promote.yml')
    && lane.command.includes('reads only release-candidate-record.json')
    && lane.command.includes('status=ready_to_promote')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'release_promotion_record'
    && lane.depends_on.includes('promote_stable_release')
    && lane.depends_on.includes('release_candidate_record')
  )));
  assert.ok(payload.lanes.some((lane) => (
    lane.id === 'post_release_user_guide_screenshots'
    && lane.phase === 'post_release'
    && lane.depends_on.includes('release_promotion_record')
    && lane.command.includes('never a pre-promotion gate')
  )));
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
  assert.ok(payload.checks.some((check) => check.id === 'full_workflow_call' && check.status === 'passed'));
  assert.ok(payload.checks.some((check) => (
    check.id === 'homebrew_vm_gate_static_policy'
    && check.status === 'passed'
  )));
  assert.deepEqual(payload.homebrew.vm_gate_static_policy, {
    profile: 'homebrew-standard',
    install_ref: 'gaofeng21cn/one-person-lab/one-person-lab',
    trusted_cask_refs: [
      'gaofeng21cn/one-person-lab/one-person-lab',
      'gaofeng21cn/one-person-lab/one-person-lab-full',
      'gaofeng21cn/one-person-lab/one-person-lab-nightly',
    ],
    trust_scope: 'explicit_standard_and_conflicting_cask_refs_not_whole_tap',
    contract_install_ref: 'gaofeng21cn/one-person-lab/one-person-lab',
    contract_trusted_cask_refs: [
      'gaofeng21cn/one-person-lab/one-person-lab',
      'gaofeng21cn/one-person-lab/one-person-lab-full',
      'gaofeng21cn/one-person-lab/one-person-lab-nightly',
    ],
    contract_trust_scope: 'explicit_standard_and_conflicting_cask_refs_not_whole_tap',
    required_install_ref: 'gaofeng21cn/one-person-lab/one-person-lab',
    required_trusted_cask_refs: [
      'gaofeng21cn/one-person-lab/one-person-lab',
      'gaofeng21cn/one-person-lab/one-person-lab-full',
      'gaofeng21cn/one-person-lab/one-person-lab-nightly',
    ],
    required_trust_scope: 'explicit_standard_and_conflicting_cask_refs_not_whole_tap',
    whole_tap_trust_allowed: false,
  });
  assert.match(fs.readFileSync(markdownPath, 'utf8'), /Release preflight: passed/);

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
  echo "1111111111111111111111111111111111111111 refs/tags/v26.5.19"
  exit 0
fi
echo "unexpected git args: $*" >&2
exit 2
`);

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
  assert.equal(draftRefreshPayload.homebrew.tap_update_owner, 'desktop_release_promote_after_publish');
  assert.ok(draftRefreshPayload.checks.some((check) => (
    check.id === 'homebrew_tap_token'
    && check.status === 'passed'
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
      name: 'latest-mac.yml',
      size: fs.statSync(path.join(outDir, 'latest-mac.yml')).size,
      digest: `sha256:${sha256(fs.readFileSync(path.join(outDir, 'latest-mac.yml')))}`,
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

test('standard publish uses deterministic evidence release notes without calling AI writer', () => {
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
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullLocalAuthorizationPolicy(fullPackageDir);
  writeFullRuntimeNativeTrust(fullPackageDir);
  const publicMarkdown = `One Person Lab 26.5.18

This release makes a clean OPL install more useful immediately by shipping refreshed MAS, MAG, RCA, OPL Meta Agent, OPL Framework, Codex CLI, OfficeCLI, MinerU, and packaged Codex skills together in the Full installer.

## What improved

### Packaged OPL agents are ready sooner
- MAS, MAG, RCA, and OPL Meta Agent are bundled from the Full package manifest, so new users reach the built-in research, grant-writing, visual-deliverable, and meta-agent entries with less module reconciliation after first launch.

### Installation proof is clearer
- The release keeps standard DMG, Full DMG, one-shot installer, and Docker/WebUI validation as separate install surfaces, so a failed gate points to the user path that needs attention.

## OPL agents and runtime payload
- Full first-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.
- Build-time payload refs: OPL Framework @ aaaaaaa; Codex CLI 0.130.0; MAS @ 1111111; MAG @ 2222222; RCA @ 3333333; OPL Meta Agent @ 4444444; OfficeCLI 1.2.3; MinerU v0.1.3.
- Payload updates since previous Stable: OPL Framework de72385 -> aaaaaaa; Codex CLI 0.129.0 -> 0.130.0; MAS 29369d4 -> 1111111; MAG 36ce5a9 -> 2222222; RCA c4af4b3 -> 3333333; OPL Meta Agent added at 4444444; OfficeCLI 1.0.93 -> 1.2.3; MinerU added at v0.1.3.

## Release scope
- Standard macOS arm64 updater package plus Full first-install DMG.

**Full Changelog**: https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.5.17...v26.5.18
`;
  writeFakeReleaseNotesAiWriter(fakeAi, withHiddenLocalizedReleaseNotes(publicMarkdown, `One Person Lab 26.5.18

这次更新让一次干净的 OPL 安装更快可用：Full installer 会同时带上更新后的 MAS、MAG、RCA、OPL Meta Agent、OPL Framework、Codex CLI、OfficeCLI、MinerU 和打包的 Codex skills。

## What improved

### 打包的 OPL 智能体更快可用
- MAS、MAG、RCA 和 OPL Meta Agent 会随 Full package manifest 一起打包，新用户首次启动后更少需要等待模块 reconcile。

### 安装证明更清晰
- 标准 DMG、Full DMG、一键安装器和 Docker/WebUI 验证继续分开，失败时可以定位到具体用户路径。

## OPL agents and runtime payload
- Full first-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.
- Build-time payload refs: OPL Framework @ aaaaaaa; Codex CLI 0.130.0; MAS @ 1111111; MAG @ 2222222; RCA @ 3333333; OPL Meta Agent @ 4444444; OfficeCLI 1.2.3; MinerU v0.1.3.
- Payload updates since previous Stable: OPL Framework de72385 -> aaaaaaa; Codex CLI 0.129.0 -> 0.130.0; MAS 29369d4 -> 1111111; MAG 36ce5a9 -> 2222222; RCA c4af4b3 -> 3333333; OPL Meta Agent added at 4444444; OfficeCLI 1.0.93 -> 1.2.3; MinerU added at v0.1.3.

## Release scope
- Standard macOS arm64 updater package plus Full first-install DMG.

**Full Changelog**: https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.5.17...v26.5.18
`));

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
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.release_notes_mode, 'template');
  const notes = payload.release_notes;
  const publicNotes = stripLocalizedReleaseNotesForTest(notes);
  assert.match(notes, /One Person Lab v26\.5\.18/);
  assert.match(notes, /What improved/);
  assert.match(notes, /Release scope/);
  assert.match(notes, /Standard macOS arm64 updater package plus Full first-install DMG/);
  assert.match(notes, /OPL agents and runtime payload/);
  assert.match(notes, /MAS @ 1111111/);
  assert.match(notes, /MAG @ 2222222/);
  assert.match(notes, /RCA @ 3333333/);
  assert.match(notes, /OPL Meta Agent @ 4444444/);
  assert.match(notes, /OfficeCLI 1\.2\.3/);
  assert.match(notes, /MinerU v0\.1\.3/);
  assert.doesNotMatch(notes, /Release focus/);
  assert.doesNotMatch(notes, /Update channel guidance/);
  assert.doesNotMatch(notes, /Full clean-install/);
  assert.doesNotMatch(publicNotes, /[\u3400-\u9fff]/);
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
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullLocalAuthorizationPolicy(fullPackageDir);
  writeFullRuntimeNativeTrust(fullPackageDir);

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
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullLocalAuthorizationPolicy(fullPackageDir);
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
  writeFile(path.join(fullPackageDir, 'full-package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(fullPackageDir, 'runtime-cache-events.json'), '{"events":[{"layer_id":"toolchain","status":"hit"}]}\n');
  writeFile(path.join(fullPackageDir, 'SHA256SUMS.txt'), 'test  artifact\n');
  writeFile(path.join(fullPackageDir, 'README-Full-First-Install.txt'), 'One Person Lab Full First-Install Package\n');
  writeFullLocalAuthorizationPolicy(fullPackageDir);
  writeFullRuntimeNativeTrust(fullPackageDir);
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

test('existing same-tag standard plus Full publish uses deterministic full release notes body', () => {
  const source = fs.readFileSync(path.join(appRoot, 'scripts', 'publish-release.ts'), 'utf8');

  assert.match(source, /else if \(options\.includeFullPackage && options\.fullPackageOnly\)/);
  assert.match(source, /replaceReleaseNotes\(options\.releaseRepo, tag, releaseNotes\)/);
  assert.match(source, /buildAiReleaseNotesDocument\(evidence\)/);
  assert.match(source, /OPL_RELEASE_NOTES_EVIDENCE_OUTPUT/);
  assert.match(source, /process\.env\.OPL_RELEASE_NOTES_MODE \|\| 'template'/);
  assert.match(source, /if \(mode === 'template'\)/);
  assert.match(
    source,
    /else if \(options\.includeFullPackage\) {\s*replaceReleaseNotes\(options\.releaseRepo, tag, releaseNotes\);/
  );
  assert.doesNotMatch(source, /Bundled OPL runtime and agent versions/);
  assert.doesNotMatch(source, /buildBundledModuleNotes/);
});
