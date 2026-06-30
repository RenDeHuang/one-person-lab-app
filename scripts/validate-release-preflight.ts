#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseStrictBoolean } from './release-readiness-args.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseRepo = 'gaofeng21cn/one-person-lab-app';
const allowedReleaseModes = ['refresh_existing', 'new_release', 'draft_candidate'] as const;
const requiredHomebrewStandardCaskRef = 'gaofeng21cn/one-person-lab/one-person-lab';
const requiredHomebrewTrustedCaskRefs = [
  'gaofeng21cn/one-person-lab/one-person-lab',
  'gaofeng21cn/one-person-lab/one-person-lab-full',
  'gaofeng21cn/one-person-lab/one-person-lab-nightly',
];
const requiredHomebrewTrustScope = 'explicit_standard_and_conflicting_cask_refs_not_whole_tap';

type CheckStatus = 'passed' | 'failed' | 'warning' | 'skipped';

type Check = {
  id: string;
  status: CheckStatus;
  message: string;
};

type ReleaseTarget = {
  tag: string;
  kind: 'offline_unknown' | 'unused' | 'published_release' | 'draft_release' | 'prerelease_release';
  release_exists: boolean | null;
  tag_exists: boolean | null;
  is_draft: boolean | null;
  is_prerelease: boolean | null;
  published_at: string | null;
};

type HomebrewPreflight = {
  tap_update_required: boolean;
  tap_token_required: boolean;
  tap_update_owner: string;
  reason: string;
  vm_gate_static_policy: HomebrewVmGateStaticPolicy;
};

type RefPreflight = {
  ref: string;
  status: 'ok' | 'skipped' | 'failed';
  repository: string;
  resolved_sha: string | null;
  reason: string;
};

type CodexPackagePreflight = {
  status: 'ok' | 'skipped' | 'failed';
  requested_spec: string;
  version: string | null;
  platform_spec: string | null;
  package_tarball_host: string | null;
  platform_tarball_host: string | null;
  reason: string;
};

type HomebrewVmGateStaticPolicy = {
  profile: 'homebrew-standard';
  install_ref: string | null;
  trusted_cask_refs: string[];
  trust_scope: string | null;
  contract_install_ref: string | null;
  contract_trusted_cask_refs: string[];
  contract_trust_scope: string | null;
  required_install_ref: string;
  required_trusted_cask_refs: string[];
  required_trust_scope: string;
  whole_tap_trust_allowed: false;
};

type Options = {
  version: string;
  releaseMode: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  publishDockerWebui: boolean;
  dockerWebuiCleanWindowsEvidenceArtifact: string;
  shellRef: string;
  frameworkRef: string;
  offline: boolean;
  summaryPath: string | null;
  markdownPath: string | null;
};

function usage(): void {
  process.stdout.write(`Usage:
  npm run release:preflight -- --version <version> --release-mode <mode>

Options:
  --version <version>              OPL release version, for example 26.6.20.
  --release-mode <mode>            refresh_existing, new_release, or draft_candidate.
  --include-full-package <bool>    Whether the Full first-install package is in scope.
  --run-vm-smoke <bool>            Whether release VM smokes are in scope.
  --publish-docker-webui <bool>    Whether the Docker WebUI image is in scope.
  --docker-webui-clean-windows-evidence-artifact <name>
                                   Clean Windows VM Docker WebUI evidence artifact for Stable release trains.
  --shell-ref <ref>                opl-aion-shell ref to validate. Default: main.
  --framework-ref <ref>            one-person-lab framework ref to validate. Default: main.
  --summary-path <path>            Write release-preflight-summary.json.
  --markdown-path <path>           Write release-preflight-summary.md.
  --offline                       Skip live GitHub/ref/package probes where supported.
  --help                          Show this message.
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    version: process.env.OPL_RELEASE_VERSION || '',
    releaseMode: process.env.OPL_RELEASE_MODE || 'refresh_existing',
    includeFullPackage: parseStrictBoolean(process.env.OPL_INCLUDE_FULL_PACKAGE, false),
    runVmSmoke: parseStrictBoolean(process.env.OPL_RUN_VM_SMOKE, true),
    publishDockerWebui: parseStrictBoolean(process.env.OPL_PUBLISH_DOCKER_WEBUI, true),
    dockerWebuiCleanWindowsEvidenceArtifact: process.env.OPL_DOCKER_WEBUI_CLEAN_WINDOWS_EVIDENCE_ARTIFACT || '',
    shellRef: process.env.OPL_SHELL_REF || 'main',
    frameworkRef: process.env.OPL_FRAMEWORK_REF || 'main',
    offline: false,
    summaryPath: null,
    markdownPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    }
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
      options.includeFullPackage = parseStrictBoolean(value);
      index += 1;
      continue;
    }
    if (token === '--run-vm-smoke') {
      options.runVmSmoke = parseStrictBoolean(value);
      index += 1;
      continue;
    }
    if (token === '--publish-docker-webui') {
      options.publishDockerWebui = parseStrictBoolean(value);
      index += 1;
      continue;
    }
    if (token === '--docker-webui-clean-windows-evidence-artifact') {
      options.dockerWebuiCleanWindowsEvidenceArtifact = value;
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

function stdoutLine(result: ReturnType<typeof run>) {
  return result.stdout.trim().split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
}

function objectOrNull(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : [];
}

function sameStringSet(actual: string[], expected: string[]) {
  return actual.length === expected.length && expected.every((entry) => actual.includes(entry));
}

function parseReleasePayload(stdout: string) {
  if (!stdout.trim()) return null;
  return objectOrNull(JSON.parse(stdout));
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

function resolveReleaseTarget(options: Options): ReleaseTarget {
  const tag = `v${options.version}`;
  if (options.offline) {
    return {
      tag,
      kind: 'offline_unknown',
      release_exists: null,
      tag_exists: null,
      is_draft: null,
      is_prerelease: null,
      published_at: null,
    };
  }

  const release = run('gh', ['release', 'view', tag, '--repo', releaseRepo, '--json', 'tagName,isDraft,isPrerelease,publishedAt'], {
    allowFailure: true,
  });
  const releaseExists = release.status === 0;
  const releasePayload = releaseExists ? parseReleasePayload(release.stdout) : null;
  const tagLookup = run('git', ['ls-remote', '--tags', `https://github.com/${releaseRepo}.git`, `refs/tags/${tag}`], {
    allowFailure: true,
  });
  const tagExists = tagLookup.status === 0 && tagLookup.stdout.trim().length > 0;
  const isDraft = releaseExists && typeof releasePayload?.isDraft === 'boolean' ? releasePayload.isDraft : null;
  const isPrerelease = releaseExists && typeof releasePayload?.isPrerelease === 'boolean' ? releasePayload.isPrerelease : null;
  const publishedAt = typeof releasePayload?.publishedAt === 'string' ? releasePayload.publishedAt : null;
  const kind = !releaseExists
    ? 'unused'
    : isDraft === true
      ? 'draft_release'
      : isPrerelease === true
        ? 'prerelease_release'
        : 'published_release';

  return {
    tag,
    kind,
    release_exists: releaseExists,
    tag_exists: tagExists,
    is_draft: isDraft,
    is_prerelease: isPrerelease,
    published_at: publishedAt,
  };
}

function checkRemoteTarget(options: Options, checks: Check[], target: ReleaseTarget) {
  if (options.offline) {
    addCheck(checks, 'remote_target', 'skipped', 'Offline mode skipped GitHub tag and release lookup.');
    return;
  }

  if (options.releaseMode === 'refresh_existing') {
    if (!target.release_exists) {
      addCheck(checks, 'remote_target', 'failed', `refresh_existing requires GitHub Release ${target.tag} to exist.`);
      return;
    }
    addCheck(checks, 'remote_target', 'passed', `GitHub Release ${target.tag} exists for refresh_existing as ${target.kind}.`);
    return;
  }

  if (target.release_exists || target.tag_exists) {
    addCheck(
      checks,
      'remote_target',
      'failed',
      `${options.releaseMode} requires ${target.tag} to be unused; release_exists=${target.release_exists}, tag_exists=${target.tag_exists}.`,
    );
    return;
  }

  addCheck(checks, 'remote_target', 'passed', `${target.tag} is unused for ${options.releaseMode}.`);
}

function resolveGitHubRef(repository: string, ref: string, offline: boolean): RefPreflight {
  const normalizedRef = ref.trim() || 'main';
  if (offline) {
    return {
      repository,
      ref: normalizedRef,
      status: 'skipped',
      resolved_sha: null,
      reason: 'Offline mode skipped remote ref lookup.',
    };
  }

  const result = run('gh', ['api', `repos/${repository}/commits/${normalizedRef}`, '--jq', '.sha'], {
    allowFailure: true,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim().replace(/\s+/g, ' ');
    return {
      repository,
      ref: normalizedRef,
      status: 'failed',
      resolved_sha: null,
      reason: `Unable to resolve ${repository}@${normalizedRef}${detail ? `: ${detail}` : ''}`,
    };
  }
  const sha = stdoutLine(result);
  if (!/^[a-f0-9]{40}$/i.test(sha)) {
    return {
      repository,
      ref: normalizedRef,
      status: 'failed',
      resolved_sha: null,
      reason: `GitHub returned an invalid commit sha for ${repository}@${normalizedRef}.`,
    };
  }
  return {
    repository,
    ref: normalizedRef,
    status: 'ok',
    resolved_sha: sha,
    reason: `${repository}@${normalizedRef} resolves before expensive release jobs.`,
  };
}

function checkReleaseRefs(options: Options, checks: Check[]) {
  const refs = [
    resolveGitHubRef('gaofeng21cn/opl-aion-shell', options.shellRef, options.offline),
  ];
  if (options.includeFullPackage) {
    refs.push(resolveGitHubRef('gaofeng21cn/one-person-lab', options.frameworkRef, options.offline));
  }
  const failed = refs.filter((entry) => entry.status === 'failed');
  if (failed.length > 0) {
    addCheck(checks, 'release_refs', 'failed', failed.map((entry) => entry.reason).join('; '));
    return refs;
  }
  if (refs.every((entry) => entry.status === 'skipped')) {
    addCheck(checks, 'release_refs', 'skipped', 'Offline mode skipped shell/framework ref lookups.');
    return refs;
  }
  addCheck(
    checks,
    'release_refs',
    'passed',
    refs.map((entry) => `${entry.repository}@${entry.ref}=${entry.resolved_sha?.slice(0, 12) ?? 'skipped'}`).join(', '),
  );
  return refs;
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

function buildHomebrewVmGateStaticPolicy(): HomebrewVmGateStaticPolicy {
  const contract = JSON.parse(readText('contracts/app-release-channel.json'));
  const firstRunMatrix = JSON.parse(readText('contracts/app-first-run-test-matrix.json'));
  const scenario = Array.isArray(firstRunMatrix.scenarios)
    ? firstRunMatrix.scenarios.find((entry: { id?: string }) => entry.id === 'homebrew_standard_cask_clean_vm_smoke')
    : null;
  const vm = objectOrNull(scenario?.vm);
  const installPolicy = objectOrNull(contract.homebrew_tap_distribution?.cask_install_policy);

  return {
    profile: 'homebrew-standard',
    install_ref: typeof vm?.homebrew_cask_install_ref === 'string' ? vm.homebrew_cask_install_ref : null,
    trusted_cask_refs: stringArray(vm?.homebrew_trusted_cask_refs),
    trust_scope: typeof vm?.homebrew_trust_scope === 'string' ? vm.homebrew_trust_scope : null,
    contract_install_ref: typeof installPolicy?.standard_cask_install_ref === 'string'
      ? installPolicy.standard_cask_install_ref
      : null,
    contract_trusted_cask_refs: stringArray(installPolicy?.standard_install_trusted_cask_refs),
    contract_trust_scope: typeof installPolicy?.trust_scope === 'string' ? installPolicy.trust_scope : null,
    required_install_ref: requiredHomebrewStandardCaskRef,
    required_trusted_cask_refs: requiredHomebrewTrustedCaskRefs,
    required_trust_scope: requiredHomebrewTrustScope,
    whole_tap_trust_allowed: false,
  };
}

function checkHomebrewVmGateStaticPolicy(policy: HomebrewVmGateStaticPolicy, checks: Check[]) {
  const wholeTapRef = 'gaofeng21cn/one-person-lab';
  const failures: string[] = [];
  if (policy.install_ref !== policy.required_install_ref) {
    failures.push(`first-run matrix install_ref=${policy.install_ref ?? 'missing'}`);
  }
  if (policy.contract_install_ref !== policy.required_install_ref) {
    failures.push(`contract install_ref=${policy.contract_install_ref ?? 'missing'}`);
  }
  if (!sameStringSet(policy.trusted_cask_refs, policy.required_trusted_cask_refs)) {
    failures.push(`first-run matrix trusted_cask_refs=${policy.trusted_cask_refs.join(',') || 'missing'}`);
  }
  if (!sameStringSet(policy.contract_trusted_cask_refs, policy.required_trusted_cask_refs)) {
    failures.push(`contract trusted_cask_refs=${policy.contract_trusted_cask_refs.join(',') || 'missing'}`);
  }
  if (policy.trust_scope !== policy.required_trust_scope) {
    failures.push(`first-run matrix trust_scope=${policy.trust_scope ?? 'missing'}`);
  }
  if (policy.contract_trust_scope !== policy.required_trust_scope) {
    failures.push(`contract trust_scope=${policy.contract_trust_scope ?? 'missing'}`);
  }
  if (policy.trusted_cask_refs.includes(wholeTapRef) || policy.contract_trusted_cask_refs.includes(wholeTapRef)) {
    failures.push('whole tap trust is not allowed');
  }
  if (failures.length > 0) {
    addCheck(checks, 'homebrew_vm_gate_static_policy', 'failed', failures.join('; '));
    return;
  }
  addCheck(
    checks,
    'homebrew_vm_gate_static_policy',
    'passed',
    'Homebrew VM gate installs the fully qualified standard cask and trusts only explicit standard/full/nightly cask refs.',
  );
}

function buildHomebrewPreflight(
  options: Options,
  target: ReleaseTarget,
  vmGateStaticPolicy: HomebrewVmGateStaticPolicy,
): HomebrewPreflight {
  const tapTokenRequired = options.runVmSmoke && options.releaseMode !== 'draft_candidate';
  if (!options.runVmSmoke) {
    return {
      tap_update_required: false,
      tap_token_required: false,
      tap_update_owner: 'not_required_vm_smoke_disabled',
      reason: 'VM smoke is disabled for this run.',
      vm_gate_static_policy: vmGateStaticPolicy,
    };
  }
  if (options.releaseMode === 'draft_candidate') {
    return {
      tap_update_required: false,
      tap_token_required: false,
      tap_update_owner: 'not_required_diagnostic_draft_candidate',
      reason: 'Diagnostic draft candidates do not update Stable Homebrew.',
      vm_gate_static_policy: vmGateStaticPolicy,
    };
  }
  if (options.releaseMode === 'refresh_existing' && (target.kind === 'published_release' || target.kind === 'offline_unknown')) {
    return {
      tap_update_required: true,
      tap_token_required: tapTokenRequired,
      tap_update_owner: 'desktop_release_after_remote_verification',
      reason: 'Published-release refreshes update Homebrew in desktop-release after remote verification.',
      vm_gate_static_policy: vmGateStaticPolicy,
    };
  }
  return {
    tap_update_required: false,
    tap_token_required: tapTokenRequired,
    tap_update_owner: 'desktop_release_promote_after_publish',
    reason: 'Release target is a draft; Homebrew tap updates can read it only after promote publishes the draft.',
    vm_gate_static_policy: vmGateStaticPolicy,
  };
}

function checkHomebrewToken(homebrew: HomebrewPreflight, checks: Check[]) {
  if (!homebrew.tap_token_required) {
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

function checkMacosLocalAuthorization(checks: Check[]) {
  addCheck(
    checks,
    'macos_local_authorization',
    'passed',
    'Developer ID signing/notarization secrets are optional; Stable standard macOS releases use App-managed local authorization and quarantine-clear evidence.',
  );
}

function parseNpmViewJson(stdout: string): Record<string, unknown> | null {
  if (!stdout.trim()) return null;
  const parsed = JSON.parse(stdout);
  return objectOrNull(parsed);
}

function hostOf(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  try {
    return new URL(rawUrl).host;
  } catch {
    return null;
  }
}

function checkCodexPackageMetadata(options: Options, checks: Check[]): CodexPackagePreflight {
  const skipped: CodexPackagePreflight = {
    status: 'skipped',
    requested_spec: '@openai/codex@latest',
    version: null,
    platform_spec: null,
    package_tarball_host: null,
    platform_tarball_host: null,
    reason: 'VM smoke is disabled; Codex install asset metadata is not required for this run.',
  };
  if (!options.runVmSmoke) {
    addCheck(checks, 'codex_package_metadata', 'skipped', skipped.reason);
    return skipped;
  }
  if (options.offline) {
    const offlineSkipped = {
      ...skipped,
      reason: 'Offline mode skipped npm registry metadata lookup.',
    };
    addCheck(checks, 'codex_package_metadata', 'skipped', offlineSkipped.reason);
    return offlineSkipped;
  }

  const requestedSpec = '@openai/codex@latest';
  const npmView = run('npm', ['view', requestedSpec, 'version', 'dist.tarball', '--json'], {
    allowFailure: true,
  });
  if (npmView.status !== 0) {
    const reason = `npm registry metadata lookup failed for ${requestedSpec}: ${(npmView.stderr || npmView.stdout).trim()}`;
    addCheck(checks, 'codex_package_metadata', 'failed', reason);
    return {
      ...skipped,
      status: 'failed',
      reason,
    };
  }

  const metadata = parseNpmViewJson(npmView.stdout);
  const version = typeof metadata?.version === 'string' ? metadata.version : null;
  const packageTarballHost = hostOf(metadata?.['dist.tarball'] ?? objectOrNull(metadata?.dist)?.tarball);
  const platformSpec = version ? `@openai/codex@${version}-darwin-arm64` : null;
  if (!version || !packageTarballHost || !platformSpec) {
    const reason = `${requestedSpec} metadata is missing version or tarball URL.`;
    addCheck(checks, 'codex_package_metadata', 'failed', reason);
    return {
      ...skipped,
      status: 'failed',
      version,
      platform_spec: platformSpec,
      package_tarball_host: packageTarballHost,
      reason,
    };
  }

  const platformView = run('npm', ['view', platformSpec, 'version', 'dist.tarball', '--json'], {
    allowFailure: true,
  });
  if (platformView.status !== 0) {
    const reason = `npm registry metadata lookup failed for ${platformSpec}: ${(platformView.stderr || platformView.stdout).trim()}`;
    addCheck(checks, 'codex_package_metadata', 'failed', reason);
    return {
      ...skipped,
      status: 'failed',
      version,
      platform_spec: platformSpec,
      package_tarball_host: packageTarballHost,
      reason,
    };
  }

  const platformMetadata = parseNpmViewJson(platformView.stdout);
  const platformVersion = typeof platformMetadata?.version === 'string' ? platformMetadata.version : null;
  const platformTarballHost = hostOf(platformMetadata?.['dist.tarball'] ?? objectOrNull(platformMetadata?.dist)?.tarball);
  if (!platformVersion || !platformTarballHost) {
    const reason = `${platformSpec} metadata is missing version or tarball URL.`;
    addCheck(checks, 'codex_package_metadata', 'failed', reason);
    return {
      ...skipped,
      status: 'failed',
      version,
      platform_spec: platformSpec,
      package_tarball_host: packageTarballHost,
      platform_tarball_host: platformTarballHost,
      reason,
    };
  }

  const preflight: CodexPackagePreflight = {
    status: 'ok',
    requested_spec: requestedSpec,
    version,
    platform_spec: platformSpec,
    package_tarball_host: packageTarballHost,
    platform_tarball_host: platformTarballHost,
    reason: `${requestedSpec} and ${platformSpec} registry metadata resolved before VM gates.`,
  };
  addCheck(checks, 'codex_package_metadata', 'passed', preflight.reason);
  return preflight;
}

function checkDockerWebuiCleanWindowsEvidence(options: Options, checks: Check[]) {
  if (!options.runVmSmoke) {
    addCheck(
      checks,
      'docker_webui_clean_windows_evidence_artifact',
      'skipped',
      'VM smoke is disabled; Docker WebUI clean Windows VM evidence is not required.',
    );
    return;
  }
  if (!options.publishDockerWebui) {
    addCheck(
      checks,
      'docker_webui_clean_windows_evidence_artifact',
      'skipped',
      'Docker WebUI publishing is disabled; clean Windows VM evidence is not required.',
    );
    return;
  }
  if (options.releaseMode === 'draft_candidate') {
    addCheck(
      checks,
      'docker_webui_clean_windows_evidence_artifact',
      'warning',
      'Draft candidates may omit clean Windows VM Docker WebUI evidence and produce a typed diagnostic blocker later.',
    );
    return;
  }
  if (!options.dockerWebuiCleanWindowsEvidenceArtifact.trim()) {
    addCheck(
      checks,
      'docker_webui_clean_windows_evidence_artifact',
      'failed',
      'Stable Docker WebUI release trains require docker_webui_clean_windows_evidence_artifact before expensive release jobs. Run the clean Windows VM Docker WebUI smoke workflow and pass its artifact name.',
    );
    return;
  }
  addCheck(
    checks,
    'docker_webui_clean_windows_evidence_artifact',
    'passed',
    `Clean Windows VM Docker WebUI evidence artifact ${options.dockerWebuiCleanWindowsEvidenceArtifact} is declared before expensive release jobs.`,
  );
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
    'release_refs',
    'codex_package_metadata',
    'docker_webui_clean_windows_evidence_artifact',
    'workflow_preflight_shape',
    'release_plan',
    'homebrew_vm_gate_static_policy',
    'homebrew_tap_token',
    'macos_local_authorization',
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

function appendGithubOutput(summary: {
  release_target: ReleaseTarget;
  homebrew: HomebrewPreflight;
}) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(outputPath, [
    `release_target_kind=${summary.release_target.kind}`,
    `homebrew_tap_update_required=${String(summary.homebrew.tap_update_required)}`,
    `homebrew_tap_token_required=${String(summary.homebrew.tap_token_required)}`,
    `homebrew_tap_update_owner=${summary.homebrew.tap_update_owner}`,
    '',
  ].join('\n'));
}

function writeSummary(options: Options, checks: Check[], releaseTarget: ReleaseTarget, homebrew: HomebrewPreflight) {
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
      publish_docker_webui: options.publishDockerWebui,
      docker_webui_clean_windows_evidence_artifact: options.dockerWebuiCleanWindowsEvidenceArtifact,
      shell_ref: options.shellRef,
      framework_ref: options.frameworkRef,
      offline: options.offline,
    },
    release_target: releaseTarget,
    release_refs: releaseRefs,
    codex_package_metadata: codexPackageMetadata,
    homebrew,
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
  appendGithubOutput(summary);
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
const homebrewVmGateStaticPolicy = buildHomebrewVmGateStaticPolicy();
checkHomebrewVmGateStaticPolicy(homebrewVmGateStaticPolicy, checks);
const releaseTarget = resolveReleaseTarget(options);
checkRemoteTarget(options, checks, releaseTarget);
const releaseRefs = checkReleaseRefs(options, checks);
const codexPackageMetadata = checkCodexPackageMetadata(options, checks);
checkDockerWebuiCleanWindowsEvidence(options, checks);
const homebrew = buildHomebrewPreflight(options, releaseTarget, homebrewVmGateStaticPolicy);
checkHomebrewToken(homebrew, checks);
checkMacosLocalAuthorization(checks);
writeSummary(options, checks, releaseTarget, homebrew);
