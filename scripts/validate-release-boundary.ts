#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
    file: 'shells/aionui/src/process/bridge/updateBridge.ts',
    required: ["'gaofeng21cn/one-person-lab-app'"],
    forbidden: ["const DEFAULT_REPO = 'gaofeng21cn/one-person-lab'"],
  },
  {
    id: 'application_bridge_repo',
    file: 'shells/aionui/src/process/bridge/applicationBridgeCore.ts',
    required: ["'gaofeng21cn/one-person-lab-app'"],
    forbidden: ["|| 'gaofeng21cn/one-person-lab'"],
  },
  {
    id: 'first_run_vm_download_repo',
    file: '.github/workflows/opl-first-run-vm.yml',
    required: ['--repo "$GITHUB_REPOSITORY"'],
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
      'uses: ./.github/workflows/full-first-install-release.yml',
      'uses: ./.github/workflows/opl-first-run-vm.yml',
    ],
    forbidden: ['npm run gui:release', 'packages:full-release', 'repository: gaofeng21cn/one-person-lab-app'],
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

if (failures > 0) {
  process.exit(1);
}

console.log('PASS: App release boundary is App-owned.');
