#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseRepo = 'gaofeng21cn/one-person-lab-app';
const allowedReleaseModes = ['refresh_existing', 'new_release', 'draft_candidate'] as const;

type CheckStatus = 'passed' | 'failed' | 'warning' | 'skipped';

type Check = {
  id: string;
  status: CheckStatus;
  message: string;
};

type Options = {
  version: string;
  releaseMode: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  shellRef: string;
  frameworkRef: string;
  offline: boolean;
  summaryPath: string | null;
  markdownPath: string | null;
};

function parseBoolean(value: string, name: string) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false, got ${value}`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    version: process.env.OPL_RELEASE_VERSION || '',
    releaseMode: process.env.OPL_RELEASE_MODE || 'refresh_existing',
    includeFullPackage: process.env.OPL_INCLUDE_FULL_PACKAGE === 'true',
    runVmSmoke: process.env.OPL_RUN_VM_SMOKE !== 'false',
    shellRef: process.env.OPL_SHELL_REF || 'main',
    frameworkRef: process.env.OPL_FRAMEWORK_REF || 'main',
    offline: false,
    summaryPath: null,
    markdownPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--offline') {
      options.offline = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    if (token === '--version') {
      options.version = value;
      index += 1;
      continue;
    }
    if (token === '--release-mode') {
      options.releaseMode = value;
      index += 1;
      continue;
    }
    if (token === '--include-full-package') {
      options.includeFullPackage = parseBoolean(value, token);
      index += 1;
      continue;
    }
    if (token === '--run-vm-smoke') {
      options.runVmSmoke = parseBoolean(value, token);
      index += 1;
      continue;
    }
    if (token === '--shell-ref') {
      options.shellRef = value;
      index += 1;
      continue;
    }
    if (token === '--framework-ref') {
      options.frameworkRef = value;
      index += 1;
      continue;
    }
    if (token === '--summary-path') {
      options.summaryPath = value;
      index += 1;
      continue;
    }
    if (token === '--markdown-path') {
      options.markdownPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

function readText(relativePath: string) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function addCheck(checks: Check[], id: string, status: CheckStatus, message: string) {
  checks.push({ id, status, message });
}

function run(command: string, args: string[], options: { allowFailure?: boolean } = {}) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (!options.allowFailure && result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
  return result;
}

function checkVersion(options: Options, checks: Check[]) {
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(options.version)) {
    addCheck(checks, 'version', 'failed', `Invalid release version: ${options.version}`);
    return;
  }
  addCheck(checks, 'version', 'passed', `Release version ${options.version} is valid semver-like OPL syntax.`);
}

function checkReleaseMode(options: Options, checks: Check[]) {
  if (!allowedReleaseModes.includes(options.releaseMode as (typeof allowedReleaseModes)[number])) {
    addCheck(checks, 'release_mode', 'failed', `Unsupported release mode: ${options.releaseMode}`);
    return;
  }
  addCheck(checks, 'release_mode', 'passed', `Release mode ${options.releaseMode} is supported.`);
}

function checkRemoteTarget(options: Options, checks: Check[]) {
  if (options.offline) {
    addCheck(checks, 'remote_target', 'skipped', 'Offline mode skipped GitHub tag and release lookup.');
    return;
  }

  const tag = `v${options.version}`;
  const release = run('gh', ['release', 'view', tag, '--repo', releaseRepo, '--json', 'tagName,isDraft,isPrerelease'], {
    allowFailure: true,
  });
  const releaseExists = release.status === 0;
  const tagLookup = run('git', ['ls-remote', '--tags', `https://github.com/${releaseRepo}.git`, `refs/tags/${tag}`], {
    allowFailure: true,
  });
  const tagExists = tagLookup.status === 0 && tagLookup.stdout.trim().length > 0;

  if (options.releaseMode === 'refresh_existing') {
    if (!releaseExists) {
      addCheck(checks, 'remote_target', 'failed', `refresh_existing requires GitHub Release ${tag} to exist.`);
      return;
    }
    addCheck(checks, 'remote_target', 'passed', `GitHub Release ${tag} exists for refresh_existing.`);
    return;
  }

  if (releaseExists || tagExists) {
    addCheck(
      checks,
      'remote_target',
      'failed',
      `${options.releaseMode} requires ${tag} to be unused; release_exists=${releaseExists}, tag_exists=${tagExists}.`,
    );
    return;
  }

  addCheck(checks, 'remote_target', 'passed', `${tag} is unused for ${options.releaseMode}.`);
}

function checkWorkflowShape(options: Options, checks: Check[]) {
  const workflow = readText('.github/workflows/desktop-release.yml');
  const required = [
    'release-preflight:',
    'name: Release preflight',
    'npm run release:preflight --',
    'release-preflight-summary.json',
    'release-preflight-summary.md',
    'needs: release-preflight',
  ];
  const missing = required.filter((needle) => !workflow.includes(needle));
  if (missing.length > 0) {
    addCheck(checks, 'workflow_preflight_shape', 'failed', `desktop-release.yml missing: ${missing.join(', ')}`);
  } else {
    addCheck(checks, 'workflow_preflight_shape', 'passed', 'desktop-release.yml starts with the App release preflight gate.');
  }

  if (!options.includeFullPackage) {
    addCheck(checks, 'full_workflow_call', 'skipped', 'Full package lane is not requested for this release train.');
  } else if (!workflow.includes('uses: ./.github/workflows/full-first-install-release.yml')) {
    addCheck(checks, 'full_workflow_call', 'failed', 'include_full_package requires the reusable Full first-install workflow.');
  } else {
    addCheck(checks, 'full_workflow_call', 'passed', 'Full package lane uses the reusable Full first-install workflow.');
  }
}

function checkReleasePlan(options: Options, checks: Check[]) {
  const args = ['--experimental-strip-types', 'scripts/plan-release-candidate.ts', '--version', options.version];
  if (options.includeFullPackage) args.push('--include-full-package');
  if (!options.runVmSmoke) args.push('--no-settings-vm');
  const planResult = run(process.execPath, args, { allowFailure: true });
  if (planResult.status !== 0) {
    addCheck(checks, 'release_plan', 'failed', `release plan could not be generated: ${planResult.stderr.trim()}`);
    return;
  }
  const plan = JSON.parse(planResult.stdout);
  const lanes = new Set((plan.lanes ?? []).map((lane: { id?: string }) => lane.id));
  const requiredLanes = [
    'release_preflight',
    'release_boundary',
    'standard_build',
    'publish_standard',
    'remote_verify_standard_and_full',
    'release_readiness_summary',
  ];
  if (options.includeFullPackage) {
    requiredLanes.push('full_build', 'publish_full_assets');
  }
  if (options.runVmSmoke) {
    requiredLanes.push('standard_dmg_clean_vm_smoke', 'homebrew_standard_cask_clean_vm_smoke');
    if (options.includeFullPackage) {
      requiredLanes.push('full_dmg_clean_vm_smoke');
    }
  }
  const missing = requiredLanes.filter((lane) => !lanes.has(lane));
  if (missing.length > 0) {
    addCheck(checks, 'release_plan', 'failed', `release plan missing lanes: ${missing.join(', ')}`);
    return;
  }
  addCheck(checks, 'release_plan', 'passed', `release plan exposes ${requiredLanes.length} required lanes.`);
}

function checkHomebrewToken(options: Options, checks: Check[]) {
  if (!options.runVmSmoke || options.releaseMode === 'draft_candidate') {
    addCheck(checks, 'homebrew_tap_token', 'skipped', 'Stable Homebrew tap update is not required for this run.');
    return;
  }
  if (process.env.OPL_HOMEBREW_TAP_TOKEN_PRESENT !== 'true') {
    addCheck(
      checks,
      'homebrew_tap_token',
      'failed',
      'Stable Homebrew VM gate requires OPL_HOMEBREW_TAP_TOKEN so the tap can update before the Homebrew smoke.',
    );
    return;
  }
  addCheck(checks, 'homebrew_tap_token', 'passed', 'Stable Homebrew tap token is present for direct tap update.');
}

function checkContract(options: Options, checks: Check[]) {
  const contract = JSON.parse(readText('contracts/app-release-channel.json'));
  if (contract.release_preflight?.script !== 'scripts/validate-release-preflight.ts') {
    addCheck(checks, 'release_preflight_contract', 'failed', 'Release contract must point at scripts/validate-release-preflight.ts.');
    return;
  }
  const required = contract.release_preflight?.required_fast_checks;
  const expected = [
    'version',
    'release_mode',
    'release_preflight_contract',
    'remote_target',
    'workflow_preflight_shape',
    'release_plan',
    'homebrew_tap_token',
  ];
  const missing = expected.filter((id) => !required?.includes(id));
  if (missing.length > 0) {
    addCheck(checks, 'release_preflight_contract', 'failed', `Release contract missing preflight checks: ${missing.join(', ')}`);
    return;
  }
  if (options.includeFullPackage && !contract.full_first_install?.validation_required) {
    addCheck(checks, 'release_preflight_contract', 'failed', 'Full package preflight requires full_first_install.validation_required=true.');
    return;
  }
  addCheck(checks, 'release_preflight_contract', 'passed', 'Release contract defines the fast preflight boundary.');
}

function writeOutputs(options: Options, checks: Check[]) {
  const status = checks.some((check) => check.status === 'failed') ? 'failed' : 'passed';
  const summary = {
    schema: 'opl_release_preflight.v1',
    status,
    release_repo: releaseRepo,
    checked_at: new Date().toISOString(),
    inputs: {
      version: options.version,
      release_mode: options.releaseMode,
      include_full_package: options.includeFullPackage,
      run_vm_smoke: options.runVmSmoke,
      shell_ref: options.shellRef,
      framework_ref: options.frameworkRef,
      offline: options.offline,
    },
    checks,
  };

  if (options.summaryPath) {
    fs.mkdirSync(path.dirname(path.resolve(appRoot, options.summaryPath)), { recursive: true });
    fs.writeFileSync(path.resolve(appRoot, options.summaryPath), `${JSON.stringify(summary, null, 2)}\n`);
  }
  if (options.markdownPath) {
    const lines = [
      `# Release preflight: ${status}`,
      '',
      `- Version: ${options.version}`,
      `- Mode: ${options.releaseMode}`,
      `- Full package: ${options.includeFullPackage}`,
      `- VM smoke: ${options.runVmSmoke}`,
      '',
      '| Check | Status | Message |',
      '| --- | --- | --- |',
      ...checks.map((check) => `| ${check.id} | ${check.status} | ${check.message.replaceAll('|', '\\|')} |`),
      '',
    ];
    fs.mkdirSync(path.dirname(path.resolve(appRoot, options.markdownPath)), { recursive: true });
    fs.writeFileSync(path.resolve(appRoot, options.markdownPath), lines.join('\n'));
  }

  console.log(`${JSON.stringify(summary, null, 2)}\n`);
  if (status === 'failed') {
    process.exit(1);
  }
}

const options = parseArgs(process.argv.slice(2));
const checks: Check[] = [];
checkVersion(options, checks);
checkReleaseMode(options, checks);
checkContract(options, checks);
checkWorkflowShape(options, checks);
checkReleasePlan(options, checks);
checkHomebrewToken(options, checks);
checkRemoteTarget(options, checks);
writeOutputs(options, checks);
