#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Lane = {
  id: string;
  phase: 'fast_candidate' | 'parallel_build' | 'release_gate' | 'publish';
  can_run_with: string[];
  command: string;
  required_for: string[];
};

function parseArgs(argv: string[]) {
  const parsed = {
    version: process.env.OPL_RELEASE_VERSION || '',
    includeFullPackage: false,
    settingsVm: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--include-full-package') {
      parsed.includeFullPackage = true;
      continue;
    }
    if (token === '--no-settings-vm') {
      parsed.settingsVm = false;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    if (token === '--version') {
      parsed.version = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!parsed.version.trim()) {
    throw new Error('Missing release version. Pass --version <version> or set OPL_RELEASE_VERSION.');
  }
  return parsed;
}

function buildPlan(options: ReturnType<typeof parseArgs>) {
  const lanes: Lane[] = [
    {
      id: 'release_boundary',
      phase: 'fast_candidate',
      can_run_with: ['standard_build', 'full_runtime_keys'],
      command: 'npm run test:release-boundary',
      required_for: ['standard_release', 'full_first_install'],
    },
    {
      id: 'standard_build',
      phase: 'parallel_build',
      can_run_with: ['release_boundary', 'full_build'],
      command: `npm run build-mac:arm64 && npm run release:publish -- --dry-run --version ${options.version}`,
      required_for: ['standard_release'],
    },
    {
      id: 'full_runtime_keys',
      phase: 'fast_candidate',
      can_run_with: ['release_boundary', 'standard_build'],
      command: `npm run release:full -- --version ${options.version} --print-runtime-cache-keys`,
      required_for: ['full_first_install'],
    },
  ];

  if (options.includeFullPackage) {
    lanes.push({
      id: 'full_build',
      phase: 'parallel_build',
      can_run_with: ['standard_build'],
      command: [
        'OPL_FULL_RUNTIME_CACHE_MODE=readwrite',
        'npm run release:full --',
        `--version ${options.version}`,
      ].join(' '),
      required_for: ['full_first_install'],
    });
  }

  if (options.settingsVm) {
    lanes.push({
      id: 'no_clt_vm_settings_smoke',
      phase: 'release_gate',
      can_run_with: [],
      command: [
        'npm run test:opl-first-run-vm:tart --',
        '--source-vm opl-first-run-no-clt-clean-base',
        `--dmg dist/opl-full-release/One-Person-Lab-Full-${options.version}-mac-arm64.dmg`,
        '--display 1920x1080px',
        '--settings-smoke',
      ].join(' '),
      required_for: ['full_first_install'],
    });
  }

  lanes.push({
    id: 'publish_new_tag',
    phase: 'publish',
    can_run_with: [],
    command: [
      'npm run release:publish --',
      `--version ${options.version}`,
      '--repo gaofeng21cn/one-person-lab-app',
      options.includeFullPackage ? '--include-full-package' : '',
    ].filter(Boolean).join(' '),
    required_for: ['standard_release', ...(options.includeFullPackage ? ['full_first_install'] : [])],
  });

  return {
    schema_version: 1,
    version: options.version,
    release_repo: 'gaofeng21cn/one-person-lab-app',
    strategy: {
      same_tag_replacement: 'avoid_for_new_versions',
      resume_uploads: 'skip_existing_assets_when_size_and_sha256_digest_match',
      full_runtime_cache: 'content_addressed_layer_cache',
      vm_policy: 'clone_clean_no_clt_base_for_release_gate',
    },
    lanes,
  };
}

const options = parseArgs(process.argv.slice(2));
const plan = buildPlan(options);
if (!fs.existsSync(path.join(appRoot, 'contracts', 'app-release-channel.json'))) {
  throw new Error('Release channel contract is missing.');
}
console.log(`${JSON.stringify(plan, null, 2)}\n`);
