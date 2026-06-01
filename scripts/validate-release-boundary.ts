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
      'actions/download-artifact@v7',
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
      '--runtime-profile "${{ steps.package_profile.outputs.runtime_profile }}"',
    ],
    forbidden: ['--repo gaofeng21cn/one-person-lab'],
  },
  {
    id: 'build_release_uses_app_publish_script',
    file: '.github/workflows/build-and-release.yml',
    required: ['node --experimental-strip-types scripts/prepare-release-assets.ts', 'node --experimental-strip-types scripts/validate-release.ts'],
    forbidden: ['npm run gui:release', 'packages:full-release'],
  },
  {
    id: 'full_release_workflow_uses_app_scripts',
    file: '.github/workflows/full-first-install-release.yml',
    required: ['npm --silent run release:full', 'npm run release:publish'],
    forbidden: ['npm run gui:release', 'packages:full-release', 'repository: gaofeng21cn/one-person-lab-app'],
  },
  {
    id: 'desktop_release_workflow_uses_app_scripts',
    file: '.github/workflows/desktop-release.yml',
    required: [
      'uses: ./.github/workflows/_build-reusable.yml',
      'node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets',
      'node --experimental-strip-types scripts/validate-release.ts release-assets',
      '--standard-artifacts-dir release-assets',
      'npm run verify-remote-release',
      'draft_candidate',
      'uses: ./.github/workflows/full-first-install-release.yml',
      'uses: ./.github/workflows/opl-first-run-vm.yml',
      'standard-first-run-vm-smoke-after-standard-only:',
      'standard-first-run-vm-smoke-after-full:',
      'full-first-run-vm-smoke:',
      'one-shot-app-installer-smoke:',
      'docker-webui-smoke:',
      'webui-ghcr-publish:',
      'release-readiness-summary:',
      'scripts/summarize-release-readiness.ts',
      'release-readiness-summary.json',
      'release_artifact_name: macos-build-arm64',
      'release_artifact_name: opl-full-first-install-${{ inputs.opl_version }}-mac-arm64',
      'package_profile: standard',
      'package_profile: full',
      'OPL_INSTALL_SCRIPT_URL: file://${{ github.workspace }}/one-person-lab/install.sh',
      './install.sh --complete --skip-modules',
      'docker build -t "one-person-lab-webui:${{ inputs.opl_version }}" shells/aionui',
      'docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin',
      'ghcr.io/${image_owner}/one-person-lab-webui',
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
      'node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets',
      'node --experimental-strip-types scripts/validate-release.ts release-assets',
      'node --experimental-strip-types scripts/generate-release-notes.ts',
      '--ai',
      '--evidence-output',
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
      'release-notes-evidence-${{ needs.resolve-nightly.outputs.version }}',
      'webui-ghcr-publish:',
      'git tag -f "${OPL_RELEASE_TAG}" "$GITHUB_SHA"',
      'git push --force-with-lease origin "refs/tags/${OPL_RELEASE_TAG}"',
      '--title "${OPL_RELEASE_TAG}"',
      '--prerelease',
      '--latest=false',
      'npm run verify-remote-release',
      'docker build -t "one-person-lab-webui:${{ needs.resolve-nightly.outputs.version }}" shells/aionui',
      'docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin',
      'ghcr.io/${image_owner}/one-person-lab-webui',
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
      'published releases must use AI release notes',
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
    forbidden: ['OPL_RELEASE_NOTES_MODE: template'],
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
      'actions/upload-artifact@v4',
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

if (failures > 0) {
  process.exit(1);
}

console.log('PASS: App release boundary is App-owned, agent installation is contract-validated, and release workflows force JavaScript actions onto Node 24.');
