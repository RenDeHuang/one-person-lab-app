#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const DEFAULT_REPO = 'gaofeng21cn/one-person-lab-app';
const DEFAULT_APP_NAME = 'One Person Lab.app';
const DEFAULT_BUNDLE_ID = 'cn.onepersonlab.opl';

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

export type CommandRunner = (command: string, args: string[]) => CommandResult;

export type FullDmgDistributionOptions = {
  expectedSha256: string;
  expectedSize: number;
  outputPath?: string;
  execute?: boolean;
  qualifyInstall?: boolean;
  sourceFile?: string;
  assetUrl?: string;
  repo?: string;
  tag?: string;
  asset?: string;
  browserDmg?: string;
  applicationsDir?: string;
  appName?: string;
  bundleId?: string;
  healthUrl?: string;
  healthFile?: string;
  healthExpected?: string;
  healthTimeoutSeconds?: number;
  workDir?: string;
  keepWorkDir?: boolean;
};

type HealthProbeInput = {
  healthUrl?: string;
  healthFile?: string;
  healthExpected: string;
};

type QualificationDependencies = {
  runner?: CommandRunner;
  fetchImpl?: typeof fetch;
  healthProbe?: (input: HealthProbeInput) => Promise<boolean>;
  now?: () => string;
};

type CommandTraceEntry = {
  command: string;
  args: string[];
};

type FullDmgDistributionFailureReceipt = {
  schema: 'opl_full_dmg_distribution_qualification.v1';
  status: 'failed';
  mode: 'execute';
  authority: 'read_only_no_public_mutation';
  source: {
    kind: ResolvedSource['kind'];
    repo: string | null;
    tag: string | null;
    asset: string;
    url: string | null;
    local_path: string | null;
  };
  expected_identity: {
    sha256: string;
    size_bytes: number;
  };
  qualification: {
    exact_byte_download: true;
    quarantine_required: boolean;
    dmg_readonly_mount: boolean;
    isolated_applications_copy: boolean;
    first_launch_health_readback: boolean;
  };
  forbidden_workarounds: {
    xattr_invocation: false;
    right_click_open: false;
    system_settings_authorization: false;
  };
  public_mutations: [];
  error: string;
  downloaded_identity: { sha256: string; size_bytes: number } | null;
  browser_downloaded_identity: { sha256: string; size_bytes: number } | null;
  quarantine: {
    install_source_dmg: boolean;
    mounted_app: boolean;
    installed_app: boolean;
  };
  work_root: { path: string; retained: boolean };
  command_trace: CommandTraceEntry[];
  cleanup: {
    status: string;
    app_quit_requested: boolean;
    mount_detached: boolean;
    installed_app_removed: boolean;
    work_root_retained: boolean;
    errors: string[];
  };
  completed_at: string;
};

export class FullDmgDistributionQualificationError extends Error {
  readonly receipt: FullDmgDistributionFailureReceipt;

  constructor(message: string, receipt: FullDmgDistributionFailureReceipt) {
    super(message);
    this.name = 'FullDmgDistributionQualificationError';
    this.receipt = receipt;
  }
}

type ResolvedSource = {
  kind: 'file' | 'url' | 'github_release';
  value: string;
  repo: string | null;
  tag: string | null;
  asset: string;
};

function defaultRunner(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300_000,
  });
  return {
    status: result.status,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
    error: result.error,
  };
}

function normalizeSha256(value: string): string {
  const normalized = value.trim().replace(/^sha256:/i, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('--expected-sha256 must be exactly 64 hexadecimal characters');
  }
  return normalized;
}

function validateAssetName(value: string): string {
  if (path.basename(value) !== value || !value.endsWith('.dmg')) {
    throw new Error(`Full asset must be a DMG basename: ${value}`);
  }
  return value;
}

function githubAssetUrl(repo: string, tag: string, asset: string): string {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error(`Invalid GitHub repository: ${repo}`);
  }
  if (!tag.trim() || tag.includes('/')) {
    throw new Error(`Invalid GitHub release tag: ${tag}`);
  }
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset)}`;
}

function validateUrl(value: string): URL {
  const url = new URL(value);
  const loopbackHttp = url.protocol === 'http:'
    && (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1');
  if (url.protocol !== 'https:' && !loopbackHttp) {
    throw new Error('Asset URL must use HTTPS; loopback HTTP is accepted only for local fixtures');
  }
  return url;
}

function resolveSource(options: FullDmgDistributionOptions): ResolvedSource {
  const selections = [
    Boolean(options.sourceFile),
    Boolean(options.assetUrl),
    Boolean(options.tag || options.asset),
  ].filter(Boolean).length;
  if (selections !== 1) {
    throw new Error('Choose exactly one source: --source-file, --asset-url, or --repo/--tag/--asset');
  }
  if (options.sourceFile) {
    const source = path.resolve(options.sourceFile);
    return {
      kind: 'file',
      value: source,
      repo: null,
      tag: null,
      asset: validateAssetName(path.basename(source)),
    };
  }
  if (options.assetUrl) {
    const url = validateUrl(options.assetUrl);
    return {
      kind: 'url',
      value: url.href,
      repo: null,
      tag: null,
      asset: validateAssetName(decodeURIComponent(path.basename(url.pathname))),
    };
  }
  if (!options.tag || !options.asset) {
    throw new Error('--repo/--tag/--asset requires both --tag and --asset');
  }
  const repo = options.repo ?? DEFAULT_REPO;
  const asset = validateAssetName(options.asset);
  return {
    kind: 'github_release',
    value: githubAssetUrl(repo, options.tag, asset),
    repo,
    tag: options.tag,
    asset,
  };
}

function fileIdentity(filePath: string): { sha256: string; size_bytes: number } {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  if (!stat?.isFile()) {
    throw new Error(`DMG file is missing: ${filePath}`);
  }
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return { sha256: hash.digest('hex'), size_bytes: stat.size };
}

function assertIdentity(
  label: string,
  actual: { sha256: string; size_bytes: number },
  expected: { sha256: string; size_bytes: number },
): void {
  if (actual.size_bytes !== expected.size_bytes) {
    throw new Error(
      `${label} size mismatch: expected ${expected.size_bytes}, received ${actual.size_bytes}`,
    );
  }
  if (actual.sha256 !== expected.sha256) {
    throw new Error(
      `${label} SHA-256 mismatch: expected ${expected.sha256}, received ${actual.sha256}`,
    );
  }
}

export function writeFullDmgDistributionReceiptAtomic(
  outputPath: string,
  receipt: unknown,
): void {
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const temporaryPath = `${resolved}.tmp-${process.pid}`;
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporaryPath, resolved);
    const directory = fs.openSync(path.dirname(resolved), 'r');
    try {
      fs.fsyncSync(directory);
    } finally {
      fs.closeSync(directory);
    }
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    fs.rmSync(temporaryPath, { force: true });
  }
}

async function downloadUrl(
  url: string,
  destination: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'one-person-lab-full-dmg-qualification' },
    redirect: 'follow',
  });
  if (!response.ok || !response.body) {
    throw new Error(`Asset download failed with HTTP ${response.status}: ${url}`);
  }
  await pipeline(
    Readable.fromWeb(response.body as never),
    fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 }),
  );
}

function commandFailure(command: string, args: string[], result: CommandResult): Error {
  const detail = [
    result.error?.message,
    result.stderr.trim(),
    result.stdout.trim(),
  ].filter(Boolean).join('\n');
  return new Error([
    `Command failed: ${command} ${args.join(' ')}`,
    detail,
  ].filter(Boolean).join('\n'));
}

function hasQuarantine(
  filePath: string,
  runChecked: (command: string, args: string[]) => CommandResult,
): boolean {
  const result = runChecked('/bin/ls', ['-ld@', filePath]);
  return /^\s*com\.apple\.quarantine\s+/m.test(result.stdout);
}

async function defaultHealthProbe(input: HealthProbeInput): Promise<boolean> {
  if (input.healthUrl) {
    try {
      const response = await fetch(input.healthUrl, { cache: 'no-store' });
      if (!response.ok) return false;
      const body = await response.text();
      return !input.healthExpected || body.includes(input.healthExpected);
    } catch {
      return false;
    }
  }
  if (!input.healthFile) return false;
  try {
    return fs.readFileSync(input.healthFile, 'utf8').includes(input.healthExpected);
  } catch {
    return false;
  }
}

async function waitForHealth(
  input: HealthProbeInput,
  timeoutSeconds: number,
  probe: (input: HealthProbeInput) => Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + timeoutSeconds * 1_000;
  do {
    if (await probe(input)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  throw new Error(
    `First-launch health did not become ready within ${timeoutSeconds} seconds: `
    + `${input.healthUrl ?? input.healthFile ?? '<missing health target>'}`,
  );
}

function onlyAppAtMount(mountPoint: string, expectedName: string): string {
  const apps = fs.readdirSync(mountPoint, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
    .map((entry) => entry.name)
    .sort();
  if (apps.length !== 1 || apps[0] !== expectedName) {
    throw new Error(
      `Mounted Full DMG must contain exactly ${expectedName}; found ${apps.join(', ') || '<none>'}`,
    );
  }
  return path.join(mountPoint, expectedName);
}

function validateOptions(options: FullDmgDistributionOptions) {
  const expected = {
    sha256: normalizeSha256(options.expectedSha256),
    size_bytes: options.expectedSize,
  };
  if (!Number.isSafeInteger(expected.size_bytes) || expected.size_bytes <= 0) {
    throw new Error('--expected-size must be a positive integer');
  }
  const source = resolveSource(options);
  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    if (path.extname(outputPath).toLowerCase() !== '.json') {
      throw new Error('--output must identify a .json receipt file');
    }
    const protectedArtifacts = [
      source.kind === 'file' ? source.value : null,
      options.browserDmg ? path.resolve(options.browserDmg) : null,
    ].filter((candidate): candidate is string => Boolean(candidate));
    if (protectedArtifacts.includes(outputPath)) {
      throw new Error('--output must not overwrite a Full DMG artifact');
    }
  }
  const qualifyInstall = options.qualifyInstall === true;
  if (qualifyInstall && !options.healthUrl && !options.healthFile) {
    throw new Error('--qualify-install requires --health-url or --health-file');
  }
  if (options.healthUrl) validateUrl(options.healthUrl);
  if (
    options.healthTimeoutSeconds !== undefined
    && (!Number.isSafeInteger(options.healthTimeoutSeconds) || options.healthTimeoutSeconds <= 0)
  ) {
    throw new Error('--health-timeout-seconds must be a positive integer');
  }
  if (options.browserDmg && !qualifyInstall) {
    throw new Error('--browser-dmg is valid only with --qualify-install');
  }
  if (options.browserDmg) {
    validateAssetName(path.basename(options.browserDmg));
  }
  if (qualifyInstall && options.applicationsDir) {
    const applicationsDir = path.resolve(options.applicationsDir);
    if (applicationsDir === '/Applications' || path.basename(applicationsDir) !== 'Applications') {
      throw new Error(
        '--applications-dir must be an isolated directory named Applications and must not be /Applications',
      );
    }
  }
  return { expected, source, qualifyInstall };
}

export async function qualifyFullDmgDistribution(
  options: FullDmgDistributionOptions,
  dependencies: QualificationDependencies = {},
) {
  const { expected, source, qualifyInstall } = validateOptions(options);
  const execute = options.execute === true;
  const appName = options.appName ?? DEFAULT_APP_NAME;
  const bundleId = options.bundleId ?? DEFAULT_BUNDLE_ID;
  validateAssetName(source.asset);
  if (!appName.endsWith('.app') || path.basename(appName) !== appName) {
    throw new Error(`Invalid App bundle name: ${appName}`);
  }
  if (!/^[A-Za-z0-9.-]+$/.test(bundleId)) {
    throw new Error('--bundle-id must contain only letters, digits, dots, and hyphens');
  }

  const plan = {
    schema: 'opl_full_dmg_distribution_qualification.v1',
    status: 'planned',
    mode: execute ? 'execute' : 'dry_run',
    authority: 'read_only_no_public_mutation',
    source: {
      kind: source.kind,
      repo: source.repo,
      tag: source.tag,
      asset: source.asset,
      url: source.kind === 'file' ? null : source.value,
      local_path: source.kind === 'file' ? source.value : null,
    },
    expected_identity: expected,
    qualification: {
      exact_byte_download: true,
      quarantine_required: qualifyInstall,
      dmg_readonly_mount: qualifyInstall,
      isolated_applications_copy: qualifyInstall,
      first_launch_health_readback: qualifyInstall,
    },
    forbidden_workarounds: {
      xattr_invocation: false,
      right_click_open: false,
      system_settings_authorization: false,
    },
    public_mutations: [] as string[],
  };
  if (!execute) return plan;
  if (qualifyInstall && process.platform !== 'darwin') {
    throw new Error('Full DMG install qualification requires macOS');
  }

  const runner = dependencies.runner ?? defaultRunner;
  const commandTrace: CommandTraceEntry[] = [];
  const runChecked = (command: string, args: string[]) => {
    const commandName = path.basename(command);
    if (commandName === 'xattr') {
      throw new Error('Qualification harness forbids xattr invocation');
    }
    commandTrace.push({ command, args: [...args] });
    const result = runner(command, args);
    if (result.error || result.status !== 0) throw commandFailure(command, args, result);
    return result;
  };

  const baseDir = options.workDir ? path.resolve(options.workDir) : os.tmpdir();
  fs.mkdirSync(baseDir, { recursive: true });
  const workRoot = fs.mkdtempSync(path.join(baseDir, 'opl-full-dmg-qualification-'));
  const downloadedDmg = path.join(workRoot, source.asset);
  const mountPoint = path.join(workRoot, 'mount');
  const applicationsDir = options.applicationsDir
    ? path.resolve(options.applicationsDir)
    : path.join(workRoot, 'Applications');
  const installedApp = path.join(applicationsDir, appName);
  let mounted = false;
  let installed = false;
  let launched = false;
  let quitRequested = false;
  let downloadedIdentity: { sha256: string; size_bytes: number } | null = null;
  let browserIdentity: { sha256: string; size_bytes: number } | null = null;
  let quarantine = {
    install_source_dmg: false,
    mounted_app: false,
    installed_app: false,
  };
  let healthPassed = false;
  let primaryFailureMessage: string | null = null;
  const cleanupState = {
    status: 'pending',
    app_quit_requested: false,
    mount_detached: false,
    installed_app_removed: false,
    work_root_retained: options.keepWorkDir === true,
    errors: [] as string[],
  };
  const failureReceipt = (message: string): FullDmgDistributionFailureReceipt => ({
    ...plan,
    status: 'failed',
    mode: 'execute',
    error: message,
    downloaded_identity: downloadedIdentity,
    browser_downloaded_identity: browserIdentity,
    quarantine,
    work_root: { path: workRoot, retained: options.keepWorkDir === true },
    command_trace: commandTrace,
    cleanup: cleanupState,
    completed_at: (dependencies.now ?? (() => new Date().toISOString()))(),
  });

  try {
    if (source.kind === 'file') {
      if (process.platform === 'darwin') {
        runChecked('/usr/bin/ditto', ['--rsrc', '--extattr', '--qtn', source.value, downloadedDmg]);
      } else {
        fs.copyFileSync(source.value, downloadedDmg, fs.constants.COPYFILE_EXCL);
      }
    } else {
      await downloadUrl(source.value, downloadedDmg, dependencies.fetchImpl ?? fetch);
    }
    downloadedIdentity = fileIdentity(downloadedDmg);
    assertIdentity('Downloaded Full DMG', downloadedIdentity, expected);

    if (!qualifyInstall) {
      return {
        ...plan,
        status: 'passed',
        downloaded_identity: downloadedIdentity,
        work_root: { path: workRoot, retained: options.keepWorkDir === true },
        command_trace: commandTrace,
        cleanup: cleanupState,
        completed_at: (dependencies.now ?? (() => new Date().toISOString()))(),
      };
    }

    const installSource = options.browserDmg
      ? path.resolve(options.browserDmg)
      : downloadedDmg;
    if (options.browserDmg) {
      browserIdentity = fileIdentity(installSource);
      assertIdentity('Browser-downloaded Full DMG', browserIdentity, expected);
    }
    quarantine.install_source_dmg = hasQuarantine(installSource, runChecked);
    if (!quarantine.install_source_dmg) {
      throw new Error(
        'Install-source Full DMG is missing com.apple.quarantine; '
        + 'provide the browser-downloaded exact asset with --browser-dmg',
      );
    }

    runChecked('/usr/bin/hdiutil', ['verify', installSource]);
    runChecked('/usr/bin/xcrun', ['stapler', 'validate', installSource]);
    runChecked('/usr/sbin/spctl', [
      '--assess',
      '--type',
      'open',
      '--context',
      'context:primary-signature',
      '--verbose=4',
      installSource,
    ]);
    fs.mkdirSync(mountPoint);
    runChecked('/usr/bin/hdiutil', [
      'attach',
      '-readonly',
      '-nobrowse',
      '-mountpoint',
      mountPoint,
      installSource,
    ]);
    mounted = true;

    const mountedApp = onlyAppAtMount(mountPoint, appName);
    quarantine.mounted_app = hasQuarantine(mountedApp, runChecked);
    if (!quarantine.mounted_app) {
      throw new Error(`Mounted App did not preserve quarantine: ${mountedApp}`);
    }
    runChecked('/usr/bin/xcrun', ['stapler', 'validate', mountedApp]);
    runChecked('/usr/bin/codesign', [
      '--verify',
      '--deep',
      '--strict',
      '--verbose=2',
      mountedApp,
    ]);
    runChecked('/usr/sbin/spctl', [
      '--assess',
      '--type',
      'execute',
      '--verbose=4',
      mountedApp,
    ]);

    fs.mkdirSync(applicationsDir, { recursive: true });
    if (fs.existsSync(installedApp)) {
      throw new Error(`Isolated Applications target already exists: ${installedApp}`);
    }
    runChecked('/usr/bin/ditto', [
      '--rsrc',
      '--extattr',
      '--qtn',
      mountedApp,
      installedApp,
    ]);
    installed = true;
    quarantine.installed_app = hasQuarantine(installedApp, runChecked);
    if (!quarantine.installed_app) {
      throw new Error(`Installed App did not preserve quarantine: ${installedApp}`);
    }
    runChecked('/usr/sbin/spctl', [
      '--assess',
      '--type',
      'execute',
      '--verbose=4',
      installedApp,
    ]);
    const healthInput = {
      healthUrl: options.healthUrl,
      healthFile: options.healthFile ? path.resolve(options.healthFile) : undefined,
      healthExpected: options.healthExpected ?? 'ready',
    };
    const healthProbe = dependencies.healthProbe ?? defaultHealthProbe;
    if (await healthProbe(healthInput)) {
      throw new Error(
        `First-launch health was already ready before launch: `
        + `${healthInput.healthUrl ?? healthInput.healthFile}`,
      );
    }
    runChecked('/usr/bin/open', ['-n', installedApp]);
    launched = true;
    await waitForHealth(
      healthInput,
      options.healthTimeoutSeconds ?? 60,
      healthProbe,
    );
    healthPassed = true;
    runChecked('/usr/bin/osascript', [
      '-e',
      `tell application id "${bundleId}" to quit`,
    ]);
    quitRequested = true;
    cleanupState.app_quit_requested = true;

    return {
      ...plan,
      status: 'passed',
      downloaded_identity: downloadedIdentity,
      browser_downloaded_identity: browserIdentity,
      quarantine,
      trust: {
        dmg_stapler: 'passed',
        dmg_gatekeeper: 'accepted',
        app_stapler: 'passed',
        app_codesign: 'passed',
        app_gatekeeper: 'accepted',
      },
      installation: {
        applications_dir: applicationsDir,
        installed_app: installedApp,
        drag_copy_semantics: 'ditto_preserving_resource_forks_extended_attributes_and_quarantine',
        first_launch: 'passed',
        health_readback: healthPassed ? 'passed' : 'failed',
      },
      cleanup: cleanupState,
      work_root: { path: workRoot, retained: options.keepWorkDir === true },
      command_trace: commandTrace,
      completed_at: (dependencies.now ?? (() => new Date().toISOString()))(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    primaryFailureMessage = message;
    throw new FullDmgDistributionQualificationError(message, failureReceipt(message));
  } finally {
    if (launched && !quitRequested) {
      try {
        runChecked('/usr/bin/osascript', [
          '-e',
          `tell application id "${bundleId}" to quit`,
        ]);
        cleanupState.app_quit_requested = true;
      } catch (error) {
        cleanupState.errors.push(
          `App quit failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (mounted) {
      try {
        runChecked('/usr/bin/hdiutil', ['detach', mountPoint]);
        cleanupState.mount_detached = true;
      } catch (error) {
        cleanupState.errors.push(
          `DMG detach failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (installed && fs.existsSync(installedApp)) {
      try {
        fs.rmSync(installedApp, { recursive: true, force: true });
        cleanupState.installed_app_removed = true;
      } catch (error) {
        cleanupState.errors.push(
          `Installed App removal failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (!options.keepWorkDir) {
      try {
        fs.rmSync(workRoot, { recursive: true, force: true });
      } catch (error) {
        cleanupState.errors.push(
          `Work root removal failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    cleanupState.status = cleanupState.errors.length === 0 ? 'completed' : 'failed';
    if (cleanupState.errors.length > 0) {
      const cleanupMessage = `Qualification cleanup failed:\n${cleanupState.errors.join('\n')}`;
      const message = primaryFailureMessage
        ? `${primaryFailureMessage}\n${cleanupMessage}`
        : cleanupMessage;
      throw new FullDmgDistributionQualificationError(message, failureReceipt(message));
    }
  }
}

export function parseFullDmgDistributionCli(argv: string[]): FullDmgDistributionOptions {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      execute: { type: 'boolean', default: false },
      'qualify-install': { type: 'boolean', default: false },
      'source-file': { type: 'string' },
      'asset-url': { type: 'string' },
      repo: { type: 'string' },
      tag: { type: 'string' },
      asset: { type: 'string' },
      'expected-sha256': { type: 'string' },
      'expected-size': { type: 'string' },
      'browser-dmg': { type: 'string' },
      'applications-dir': { type: 'string' },
      'app-name': { type: 'string' },
      'bundle-id': { type: 'string' },
      'health-url': { type: 'string' },
      'health-file': { type: 'string' },
      'health-expected': { type: 'string' },
      'health-timeout-seconds': { type: 'string' },
      'work-dir': { type: 'string' },
      'keep-work-dir': { type: 'boolean', default: false },
      output: { type: 'string' },
    },
  });
  if (!values['expected-sha256']) throw new Error('Missing --expected-sha256');
  if (!values['expected-size']) throw new Error('Missing --expected-size');
  return {
    execute: values.execute,
    qualifyInstall: values['qualify-install'],
    sourceFile: values['source-file'],
    assetUrl: values['asset-url'],
    repo: values.repo,
    tag: values.tag,
    asset: values.asset,
    expectedSha256: values['expected-sha256'],
    expectedSize: Number(values['expected-size']),
    outputPath: values.output,
    browserDmg: values['browser-dmg'],
    applicationsDir: values['applications-dir'],
    appName: values['app-name'],
    bundleId: values['bundle-id'],
    healthUrl: values['health-url'],
    healthFile: values['health-file'],
    healthExpected: values['health-expected'],
    healthTimeoutSeconds: values['health-timeout-seconds'] === undefined
      ? undefined
      : Number(values['health-timeout-seconds']),
    workDir: values['work-dir'],
    keepWorkDir: values['keep-work-dir'],
  };
}

export function isFullDmgDistributionCliMain(
  moduleUrl = import.meta.url,
  executablePath = process.argv[1],
): boolean {
  return Boolean(executablePath) && pathToFileURL(path.resolve(executablePath)).href === moduleUrl;
}

if (isFullDmgDistributionCliMain()) {
  try {
    const options = parseFullDmgDistributionCli(process.argv.slice(2));
    const result = await qualifyFullDmgDistribution(options);
    if (options.outputPath) {
      writeFullDmgDistributionReceiptAtomic(options.outputPath, result);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const options = (() => {
      try {
        return parseFullDmgDistributionCli(process.argv.slice(2));
      } catch {
        return null;
      }
    })();
    const failure = error instanceof FullDmgDistributionQualificationError
      ? error.receipt
      : {
      schema: 'opl_full_dmg_distribution_qualification_failure.v1',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      public_mutations: [],
    };
    if (options?.outputPath) {
      writeFullDmgDistributionReceiptAtomic(options.outputPath, failure);
    }
    process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 1;
  }
}
