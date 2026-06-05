#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shellPaths = resolveActiveShellPaths();
const commandMaxBuffer = 16 * 1024 * 1024;

const releaseWorkflowPaths = [
  '.github/workflows/_build-reusable.yml',
  '.github/workflows/build-and-release.yml',
  '.github/workflows/build-manual.yml',
  '.github/workflows/desktop-release-cleanup-drafts.yml',
  '.github/workflows/desktop-release-promote.yml',
  '.github/workflows/desktop-release.yml',
  '.github/workflows/full-first-install-release.yml',
  '.github/workflows/full-runtime-cache-warmup.yml',
  '.github/workflows/homebrew-tap-update.yml',
  '.github/workflows/nightly-standard-release.yml',
  '.github/workflows/opl-first-run-vm.yml',
  '.github/workflows/release-verify-remote.yml',
];

const checks = [
  {
    id: 'release_contract_repo',
    file: 'contracts/app-release-channel.json',
    required: ['"release_repo": "gaofeng21cn/one-person-lab-app"'],
    forbidden: ['"release_repo": "gaofeng21cn/one-person-lab"'],
  },
  {
    id: 'publish_script_repo',
    file: 'scripts/publish-release.ts',
    required: ["'gaofeng21cn/one-person-lab-app'"],
    forbidden: ["'gaofeng21cn/one-person-lab'"],
  },
  {
    id: 'update_bridge_repo',
    file: path.relative(appRoot, path.join(shellPaths.shellRoot, 'packages/desktop/src/process/bridge/updateBridge.ts')),
    required: ["'gaofeng21cn/one-person-lab-app'"],
    forbidden: ["const DEFAULT_REPO = 'gaofeng21cn/one-person-lab'"],
  },
  {
    id: 'application_bridge_repo',
    file: path.relative(appRoot, path.join(shellPaths.shellRoot, 'packages/desktop/src/process/bridge/applicationBridgeCore.ts')),
    required: ["'gaofeng21cn/one-person-lab-app'"],
    forbidden: ["|| 'gaofeng21cn/one-person-lab'"],
  },
  {
    id: 'first_run_vm_download_repo',
    file: '.github/workflows/opl-first-run-vm.yml',
    required: [
      '--repo "$GITHUB_REPOSITORY"',
      'One-Person-Lab-Full-*-mac-arm64.dmg',
      'One-Person-Lab-*-mac-arm64.dmg',
      'release_artifact_name:',
      'actions/download-artifact@v8',
      'Using same-run workflow artifact',
      'fetch_release_metadata_with_retry()',
      'Release metadata fetch failed on attempt $attempt',
      'download_asset_with_retry()',
      'download_release_with_retry()',
      'Resolved release DMG asset: $asset_name',
      'Release DMG asset download failed on attempt $attempt',
      'curl -fL --retry 5 --retry-all-errors --retry-delay 10 --connect-timeout 30 --max-time 1800 --continue-at -',
      'package_profile:',
      'Resolve package profile',
      '--smoke-profile no-clt-clean-vm',
      '--display 1920x1080px',
      '--settings-smoke',
      '--assistant-route-smoke',
      '--codex-functional-check',
      '--codex-ai-self-check',
      '--runtime-profile "${{ steps.package_profile.outputs.runtime_profile }}"',
      'guide_screenshots:',
      'CMD+=(--guide-screenshots)',
    ],
    forbidden: ['--repo gaofeng21cn/one-person-lab'],
  },
  {
    id: 'build_release_uses_app_publish_script',
    file: '.github/workflows/build-and-release.yml',
    required: [
      'node --experimental-strip-types scripts/prepare-release-assets.ts',
      'node --experimental-strip-types scripts/validate-release.ts',
      'require_macos_gatekeeper: false',
    ],
    forbidden: ['npm run gui:release', 'packages:full-release'],
  },
  {
    id: 'full_release_workflow_uses_app_scripts',
    file: '.github/workflows/full-first-install-release.yml',
    required: [
      'npm --silent run release:full',
      'npm run release:publish',
      'Inspect optional Full release signing secrets',
      'Full first-install local authorization mode',
      'Missing optional Apple signing secrets:',
      'brew install zstd temporal || true',
      'OPL_FULL_BUN_BIN=$(command -v bun)',
      'OPL_FULL_INCLUDE_BUN_RUNTIME',
      'OPL_FULL_TEMPORAL_CLI_BIN=$(command -v temporal)',
      'export OPL_FULL_BUN_BIN="${OPL_FULL_BUN_BIN:-$(command -v bun)}"',
      'export OPL_FULL_TEMPORAL_CLI_BIN="${OPL_FULL_TEMPORAL_CLI_BIN:-$(command -v temporal)}"',
      'Stable Full assets will use local authorization evidence instead of Developer ID notarization.',
      'full-local-authorization-policy.json',
      'full-runtime-native-trust.json',
      'local-authorization-policy.ts',
      'mounted_app_path="$(find "$mounted_app_dir" -maxdepth 2 -type d -name \'One Person Lab.app\'',
      'codesign --verify --deep --strict --verbose=2 "$mounted_app_path"',
      '--app-path "$mounted_app_path"',
      'spctl --assess --type execute --verbose=4 "$app_path"',
    ],
    forbidden: ['npm run gui:release', 'packages:full-release', 'repository: gaofeng21cn/one-person-lab-app'],
  },
  {
    id: 'desktop_release_workflow_uses_app_scripts',
    file: '.github/workflows/desktop-release.yml',
    required: [
      'uses: ./.github/workflows/_build-reusable.yml',
      'require_macos_gatekeeper: false',
      'node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets',
      'node --experimental-strip-types scripts/validate-release.ts release-assets',
      '--standard-artifacts-dir release-assets',
      'npm run verify-remote-release',
      'draft_candidate',
      'pull-requests: read',
      'uses: ./.github/workflows/full-first-install-release.yml',
      'uses: ./.github/workflows/opl-first-run-vm.yml',
      'standard-first-run-vm-smoke-after-standard-only:',
      'standard-first-run-vm-smoke-after-full:',
      'stable-homebrew-tap-update:',
      'uses: ./.github/workflows/homebrew-tap-update.yml',
      'write_mode: direct_commit',
      'homebrew-tap-plan-stable-app_standard-${{ inputs.opl_version }}',
      'homebrew-standard-first-run-vm-smoke:',
      "needs.stable-homebrew-tap-update.result == 'success'",
      'full-first-run-vm-smoke:',
      'one-shot-app-installer-smoke:',
      'docker-webui-smoke:',
      'webui-ghcr-publish:',
      'release-readiness-summary:',
      'scripts/summarize-release-readiness.ts',
      'release-readiness-summary.json',
      'shell_ref:',
      'shell_ref: ${{ inputs.shell_ref }}',
      'release_artifact_name: macos-build-arm64',
      'release_artifact_name: opl-full-first-install-${{ inputs.opl_version }}-mac-arm64',
      'package_profile: standard',
      'package_profile: homebrew-standard',
      'package_profile: full',
      'opl-first-run-vm-homebrew-standard-${{ github.run_id }}',
      'OPL_INSTALL_SCRIPT_URL: file://${{ github.workspace }}/one-person-lab/install.sh',
      'bash -n ./install-stable.sh',
      './install.sh --complete --skip-modules',
      '--label "org.opencontainers.image.source=https://github.com/${GITHUB_REPOSITORY}"',
      'docker build',
      '-t "one-person-lab-webui:${{ inputs.opl_version }}"',
      'docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin',
      'write_publish_summary "failed" "ghcr_write_package_denied"',
      'ghcr.io/${image_owner}/one-person-lab-webui',
      "required_actions_access_repository: 'gaofeng21cn/one-person-lab-app'",
      "source_repository: 'https://github.com/${GITHUB_REPOSITORY}'",
      '"${ghcr_image}:${{ inputs.opl_version }}"',
      '"${ghcr_image}:stable"',
      '"${ghcr_image}:latest"',
    ],
    forbidden: ['npm run gui:release', 'packages:full-release', 'repository: gaofeng21cn/one-person-lab-app'],
  },
  {
    id: 'nightly_standard_release_workflow',
    file: '.github/workflows/nightly-standard-release.yml',
    required: [
      'name: OPL Nightly Standard Release',
      'schedule:',
      "cron: '17 18 * * *'",
      'uses: ./.github/workflows/_build-reusable.yml',
      'require_macos_gatekeeper: false',
      'node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets',
      'node --experimental-strip-types scripts/validate-release.ts release-assets',
      'node --experimental-strip-types scripts/generate-release-notes.ts',
      'OPL_RELEASE_NOTES_EVIDENCE_OUTPUT',
      '--evidence-output "$OPL_RELEASE_NOTES_EVIDENCE_OUTPUT"',
      'webui-ghcr-publish:',
      'remote_tag_sha="$(git ls-remote --tags origin "refs/tags/${OPL_RELEASE_TAG}"',
      'git tag -f "${OPL_RELEASE_TAG}" "$GITHUB_SHA"',
      'git push --force-with-lease="refs/tags/${OPL_RELEASE_TAG}:${remote_tag_sha}" origin "refs/tags/${OPL_RELEASE_TAG}"',
      'git push origin "refs/tags/${OPL_RELEASE_TAG}"',
      '--title "${OPL_RELEASE_TAG}"',
      '--prerelease',
      '--latest=false',
      'npm run verify-remote-release',
      '--label "org.opencontainers.image.source=https://github.com/${GITHUB_REPOSITORY}"',
      'docker build',
      '-t "one-person-lab-webui:${{ needs.resolve-nightly.outputs.version }}"',
      'docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin',
      'write_publish_summary "failed" "ghcr_write_package_denied"',
      'ghcr.io/${image_owner}/one-person-lab-webui',
      "required_actions_access_repository: 'gaofeng21cn/one-person-lab-app'",
      "source_repository: 'https://github.com/${GITHUB_REPOSITORY}'",
      '"${ghcr_image}:${{ needs.resolve-nightly.outputs.version }}"',
      '"${ghcr_image}:nightly"',
    ],
    forbidden: [
      'full-first-install-release.yml',
      'One-Person-Lab-Full',
      'nightly.${stamp}',
      'One Person Lab Nightly ${OPL_RELEASE_VERSION}',
      '--include-full-package',
      'include_full_package',
      '"${ghcr_image}:stable"',
      '"${ghcr_image}:latest"',
    ],
  },
  {
    id: 'release_notes_ai_first',
    file: 'scripts/publish-release.ts',
    required: [
      'OPL_RELEASE_NOTES_MODE',
      'OPL_RELEASE_NOTES_EVIDENCE_OUTPUT',
      'buildAiReleaseNotesDocument',
      'buildReleaseNotesEvidence',
      'standard published releases must use AI release notes',
      'Full-only asset refreshes',
    ],
    forbidden: ['generate_release_notes: true'],
  },
  {
    id: 'release_notes_ai_provider_chain',
    file: 'scripts/release-notes-ai-writer.ts',
    required: [
      'OPL_RELEASE_NOTES_PROVIDER',
      'OPL_RELEASE_NOTES_GITHUB_MODEL',
      'openai/gpt-5-mini',
      'https://models.github.ai/inference/chat/completions',
      'GitHub Models release-note provider unavailable; falling back to Codex provider.',
      'runCodexProvider',
      'validateAiReleaseNotes',
      'self-referential release-note copy',
      'opening paragraph is process-first',
      'missing opening user benefit paragraph before sections',
      'payload lines formatted as blockquotes',
      'missing user-facing MAS/MAG/RCA role descriptions',
      'missing concrete runtime change detail',
    ],
    forbidden: [],
  },
  {
    id: 'release_notes_agent_runtime_evidence',
    file: 'scripts/release-notes.ts',
    required: [
      'agent_runtime_changes',
      'buildAgentRuntimeChanges',
      'collectComponentChangeSubjects',
      'research automation and study workflow agent',
      'grant-writing and funding workflow agent',
      'visual deliverable, slide, and report graphics agent',
    ],
    forbidden: [],
  },
  {
    id: 'release_notes_codex_ci_config',
    file: 'scripts/setup-release-notes-codex-config.ts',
    required: [
      'OPL_RELEASE_NOTES_CODEX_PROVIDER',
      'OPL_RELEASE_NOTES_CODEX_BASE_URL',
      'OPL_RELEASE_NOTES_CODEX_API_KEY',
      'OPL_RELEASE_NOTES_CODEX_WIRE_API',
      'OPL_RELEASE_NOTES_MODEL',
      'experimental_bearer_token',
      'CODEX_HOME',
      'GITHUB_ENV',
      'trust_level = "trusted"',
    ],
    forbidden: ['OPENAI_API_KEY'],
  },
  {
    id: 'homebrew_tap_boundary_script',
    file: 'scripts/update-homebrew-tap.ts',
    required: [
      'manifest_required: true',
      'checksum_required: true',
      'nightly_targets_only_for_nightly: true',
      'stable_promotion_from_nightly_allowed: false',
      'full_first_install_allowed: false',
      'full_first_install_allowed: true',
      'standard_updater_visible: false',
      'bundled_full_runtime_payload_allowed: true',
      'modules_payload_allowed: false',
      'agent_pack_homebrew_allowed: false',
      'agent_pack_activation_owner: app_cli_managed_background_maintenance',
      'forbidden_module_formulae: one-person-lab-modules,one-person-lab-modules-nightly',
      'publishes_or_pushes_remote: false',
      'app_full_first_install',
      'Nightly Homebrew tap updates may only update nightly formula/cask targets.',
      'Stable Homebrew tap updates must not use a nightly version.',
      'Full first-install Homebrew cask updates must stay on the stable channel.',
      'Full first-install Homebrew cask updates may only update Casks/one-person-lab-full.rb.',
      'Homebrew tap updates are App cask-only; agent packs are App/CLI-managed, not Homebrew formulae.',
      'must not reference Full first-install payloads',
    ],
    forbidden: [
      "from 'node:child_process'",
      'spawnSync(',
      'execSync(',
      'execFileSync(',
    ],
  },
  {
    id: 'homebrew_tap_package_scripts',
    file: 'package.json',
    required: [
      '"homebrew:tap:plan": "node --experimental-strip-types scripts/update-homebrew-tap.ts"',
      '"validate:homebrew-tap": "node --experimental-strip-types scripts/update-homebrew-tap.ts --self-check"',
    ],
    forbidden: [],
  },
  {
    id: 'homebrew_tap_update_workflow',
    file: '.github/workflows/homebrew-tap-update.yml',
    required: [
      'name: OPL Homebrew Tap Update',
      'workflow_call:',
      'OPL_HOMEBREW_TAP_TOKEN',
      'gaofeng21cn/homebrew-one-person-lab',
      'Casks/one-person-lab.rb',
      'Casks/one-person-lab-nightly.rb',
      'Casks/one-person-lab-full.rb',
      'gh release view "$tag"',
      '--json tagName,isDraft,isPrerelease,assets',
      'Homebrew tap updates are App cask-only; agent packs are App/CLI-managed.',
      'GitHub Release asset ${asset.name} must expose a sha256 digest.',
      'Homebrew tap updates must not read draft GitHub Releases.',
      'Homebrew tap updates must read assets from gaofeng21cn/one-person-lab-app',
      'One-Person-Lab-Full-${version}-mac-arm64.dmg',
      'full-package-manifest.json',
      'standard-local-authorization-policy.json',
      'full-local-authorization-policy.json',
      'Full first-install Homebrew cask updates must stay on the stable channel.',
      'node --experimental-strip-types scripts/update-homebrew-tap.ts',
      '--remote-write-mode "${{ inputs.write_mode }}"',
      'OPL_HOMEBREW_TAP_TOKEN is required for direct Stable Homebrew tap updates.',
      'peter-evans/create-pull-request@v8',
      'inputs.write_mode != \'direct_commit\'',
      'git -C homebrew-tap push origin HEAD:main',
      'Homebrew remains an App cask transport/index',
    ],
    forbidden: [
      'gh release upload',
    ],
  },
  {
    id: 'reusable_build_gatekeeper_policy',
    file: '.github/workflows/_build-reusable.yml',
    required: [
      'macos-signing-preflight:',
      'name: macOS release signing preflight',
      'macOS release signing preflight failed',
      'Missing GitHub Actions secrets:',
      'require_macos_gatekeeper:',
      'OPL_REQUIRE_MACOS_GATEKEEPER',
      'Write macOS Stable local authorization policy',
      'spctl --assess --type execute --verbose=4 "$app_path"',
      'standard-local-authorization-policy.json',
      '--package-kind app_standard',
    ],
    forbidden: [],
  },
  {
    id: 'release_asset_local_authorization_verifiers',
    file: 'scripts/verify-remote-release-assets.ts',
    required: [
      'standard-local-authorization-policy.json',
      'full-local-authorization-policy.json',
      'full-runtime-native-trust.json',
      'assertStableLocalAuthorizationPolicy',
      'assertFullRuntimeNativeTrust',
      'spctl_status',
      'codesign_status',
    ],
    forbidden: [],
  },
  {
    id: 'first_run_vm_local_authorization_policy',
    file: path.relative(appRoot, path.join(shellPaths.shellRoot, 'scripts/opl-first-run-vm-smoke.mjs')),
    required: [
      "xattr', ['-dr', 'com.apple.quarantine', targetApp]",
      'gatekeeper-launch-policy.json',
      'gatekeeper_required: false',
      'quarantine_removal_required: true',
      'local_authorization_status: localAuthorizationStatus',
      "'rejected_allowed_unsigned'",
      'if (codesign.status !== 0)',
    ],
    forbidden: [
      'if (codesign.status !== 0 || spctl.status !== 0)',
      'Gatekeeper launch policy rejected the packaged app before first launch.',
    ],
  },
  {
    id: 'one_shot_unsigned_local_authorization',
    file: 'install.sh',
    required: [
      '--free-macos-install',
      '--stable-macos-install',
      'STABLE_MACOS_PACKAGE_PROFILE=${OPL_STABLE_MACOS_PACKAGE_PROFILE:-full}',
      'resolve_latest_release_tag()',
      'release_asset_name()',
      'download_or_use_dmg()',
      'copy_app_from_dmg()',
      'stable_macos_install()',
      'hdiutil attach -nobrowse -readonly',
      'ditto "$source_app" "$OPL_LOCAL_APP_PATH"',
      'run_with_sudo_fallback',
      '--authorize-local-app-only',
      '--authorize-local-app',
      '--app-path',
      'OPL_LOCAL_APP_PATH=${OPL_LOCAL_APP_PATH:-/Applications/One Person Lab.app}',
      'Type "authorize" to continue',
      'xattr -dr com.apple.quarantine "$OPL_LOCAL_APP_PATH"',
      'codesign --verify --deep --strict --verbose=2 "$OPL_LOCAL_APP_PATH"',
      'spctl --assess --type execute --verbose=4 "$OPL_LOCAL_APP_PATH"',
      'quarantine_before',
      'quarantine_after',
      'Stable macOS install',
    ],
    forbidden: [],
  },
  {
    id: 'short_stable_macos_installer',
    file: 'install-stable.sh',
    required: [
      'OPL_APP_INSTALLER_URL=',
      'https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh',
      'curl -fsSL "$installer_url" | bash -s -- --stable-macos-install --yes "$@"',
    ],
    forbidden: [],
  },
  {
    id: 'macos_stable_local_authorization_docs',
    file: 'docs/release/README.md',
    required: [
      '## Stable macOS local authorization',
      'Developer ID Application',
      'security find-identity -v -p codesigning',
      'gh secret set BUILD_CERTIFICATE_BASE64',
      'gh secret set APPLE_ID_PASSWORD',
      'standard-local-authorization-policy.json',
      'full-runtime-native-trust.json',
      'install-stable.sh | bash',
      '--stable-macos-install --yes',
      'latest Full first-install DMG',
      '--authorize-local-app-only',
      'com.apple.quarantine',
      'quarantine_after=0',
      'local_authorization_policy',
    ],
    forbidden: [],
  },
  {
    id: 'install_exposure_unsigned_and_temporal_policy',
    file: 'contracts/app-install-exposure-policy.json',
    required: [
      '"surface": "stable_local_authorized_macos_install"',
      '"entrypoint": "install-stable.sh"',
      '"backing_entrypoint": "install.sh --stable-macos-install --yes"',
      '"default_package_profile": "full"',
      '"hdiutil attach -nobrowse -readonly"',
      '"ditto"',
      '"open"',
      '"surface": "unsigned_local_app_authorization"',
      '"entrypoint": "install.sh --authorize-local-app-only"',
      '"stable_release_path": true',
      '"xattr -dr com.apple.quarantine"',
      '"codesign --verify --deep --strict --verbose=2"',
      '"spctl --assess --type execute --verbose=4"',
      '"auto_configuration_entrypoints"',
      '"opl system startup-maintenance"',
      '"must_export_local_defaults_before_provider_checks": true',
      '"must_surface_service_worker_and_dependency_diagnostics": true',
      '"must_not_block_ready_to_launch_on_worker_residency": true',
      '"must_fail_closed_when_packaged_temporal_payload_is_missing": true',
    ],
    forbidden: [],
  },
  {
    id: 'desktop_release_ai_notes',
    file: '.github/workflows/desktop-release.yml',
    required: [
      'Install Codex release-note writer',
      'models: read',
      'GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}',
      'OPL_RELEASE_NOTES_PROVIDER: auto',
      'OPL_RELEASE_NOTES_GITHUB_MODEL: ${{ vars.OPL_RELEASE_NOTES_GITHUB_MODEL || \'openai/gpt-5-mini\' }}',
      'Configure Codex release-note writer',
      'scripts/setup-release-notes-codex-config.ts',
      'CODEX_HOME: ${{ runner.temp }}/release-notes-codex-home',
      "OPL_RELEASE_NOTES_CODEX_PROVIDER: ${{ vars.OPL_RELEASE_NOTES_CODEX_PROVIDER || 'gflab' }}",
      'OPL_RELEASE_NOTES_CODEX_BASE_URL: ${{ vars.OPL_RELEASE_NOTES_CODEX_BASE_URL }}',
      'OPL_RELEASE_NOTES_CODEX_API_KEY: ${{ secrets.OPL_RELEASE_NOTES_CODEX_API_KEY }}',
      'OPL_RELEASE_NOTES_CODEX_WIRE_API: ${{ vars.OPL_RELEASE_NOTES_CODEX_WIRE_API || \'responses\' }}',
      'OPL_RELEASE_NOTES_MODEL: ${{ vars.OPL_RELEASE_NOTES_MODEL }}',
      'OPL_RELEASE_NOTES_EVIDENCE_OUTPUT',
      'standard-release-notes-evidence-${{ inputs.opl_version }}',
      'full-release-notes-evidence-${{ inputs.opl_version }}',
    ],
    forbidden: [],
  },
  {
    id: 'remote_release_verification_workflow_uses_app_script',
    file: '.github/workflows/release-verify-remote.yml',
    required: ['npm run verify-remote-release', '--include-full-package'],
    forbidden: ['npm run gui:release', 'packages:full-release', 'repository: gaofeng21cn/one-person-lab-app'],
  },
  {
    id: 'full_runtime_cache_warmup_reuses_full_workflow',
    file: '.github/workflows/full-runtime-cache-warmup.yml',
    required: [
      'uses: ./.github/workflows/full-first-install-release.yml',
      'publish_to_release: false',
      'force_rebuild_runtime_cache:',
    ],
    forbidden: ['npm run gui:release', 'packages:full-release', 'gh release upload'],
  },
  {
    id: 'desktop_release_promote_verifies_before_publish',
    file: '.github/workflows/desktop-release-promote.yml',
    required: ['npm run verify-remote-release', 'gh release edit "v${OPL_RELEASE_VERSION}"', '--draft=false'],
    forbidden: ['npm run gui:release', 'packages:full-release', 'repository: gaofeng21cn/one-person-lab-app'],
  },
  {
    id: 'desktop_release_cleanup_drafts_workflow',
    file: '.github/workflows/desktop-release-cleanup-drafts.yml',
    required: [
      'name: OPL Desktop Release Cleanup Drafts',
      'workflow_dispatch:',
      'dry_run:',
      'npm run release:cleanup-drafts',
      '--summary-path release-draft-cleanup-summary.json',
      '--execute',
      '--dry-run',
      'actions/upload-artifact@v7',
    ],
    forbidden: ['One-Person-Lab-*.dmg', 'gh release download', 'actions/download-artifact'],
  },
];

let failures = 0;
for (const check of checks) {
  const absolutePath = path.join(appRoot, check.file);
  if (!fs.existsSync(absolutePath)) {
    console.error(`FAIL ${check.id}: missing ${check.file}`);
    failures += 1;
    continue;
  }
  const text = fs.readFileSync(absolutePath, 'utf8');
  for (const needle of check.required) {
    if (!text.includes(needle)) {
      console.error(`FAIL ${check.id}: ${check.file} missing ${needle}`);
      failures += 1;
    }
  }
  for (const needle of check.forbidden) {
    if (text.includes(needle)) {
      console.error(`FAIL ${check.id}: ${check.file} still contains ${needle}`);
      failures += 1;
    }
  }
}

for (const workflowPath of releaseWorkflowPaths) {
  const absolutePath = path.join(appRoot, workflowPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`FAIL actions_node24_runtime_policy: missing ${workflowPath}`);
    failures += 1;
    continue;
  }
  const text = fs.readFileSync(absolutePath, 'utf8');
  if (!/\nenv:\n(?:  [A-Z0-9_]+: .+\n)*  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true\n/.test(text)) {
    console.error(
      `FAIL actions_node24_runtime_policy: ${workflowPath} must declare FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true in top-level env`,
    );
    failures += 1;
  }
}

const agentInstallationValidation = spawnSync(process.execPath, [
  '--experimental-strip-types',
  'scripts/validate-agent-installation-contract.ts',
], {
  cwd: appRoot,
  encoding: 'utf8',
  maxBuffer: commandMaxBuffer,
});
if (agentInstallationValidation.status !== 0) {
  if (agentInstallationValidation.stdout) process.stdout.write(agentInstallationValidation.stdout);
  if (agentInstallationValidation.stderr) process.stderr.write(agentInstallationValidation.stderr);
  failures += 1;
}

const homebrewTapValidation = spawnSync(process.execPath, [
  '--experimental-strip-types',
  'scripts/update-homebrew-tap.ts',
  '--self-check',
], {
  cwd: appRoot,
  encoding: 'utf8',
  maxBuffer: commandMaxBuffer,
});
if (homebrewTapValidation.status !== 0) {
  if (homebrewTapValidation.stdout) process.stdout.write(homebrewTapValidation.stdout);
  if (homebrewTapValidation.stderr) process.stderr.write(homebrewTapValidation.stderr);
  failures += 1;
}

const releaseContract = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'contracts/app-release-channel.json'), 'utf8'),
);
const webuiPackage = releaseContract.webui_ghcr_image;
if (webuiPackage?.github_package_access?.target_repository_association !== 'gaofeng21cn/one-person-lab-app') {
  console.error('FAIL webui_package_association: target repository association must be gaofeng21cn/one-person-lab-app');
  failures += 1;
}
if (webuiPackage?.github_package_access?.current_historical_association_allowed_until_ui_migration !== 'gaofeng21cn/one-person-lab') {
  console.error('FAIL webui_package_association: historical association allowance must name gaofeng21cn/one-person-lab');
  failures += 1;
}
if (webuiPackage?.retention_policy?.cleanup_execution_mode !== 'dry_run_first_explicit_execute_required') {
  console.error('FAIL webui_retention_policy: cleanup must be dry-run first with explicit execute');
  failures += 1;
}
if (!webuiPackage?.retention_policy?.protected_tags?.includes('nightly')) {
  console.error('FAIL webui_retention_policy: protected tags must include nightly');
  failures += 1;
}

if (failures > 0) {
  process.exit(1);
}

console.log('PASS: App release boundary is App-owned, agent installation is contract-validated, and release workflows force JavaScript actions onto Node 24.');
