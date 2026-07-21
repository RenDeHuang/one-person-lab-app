#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { resolveActiveShellPaths } from './app-shell-adapter.ts';
import { findBuiltApp } from './build-full-first-install-package/archive-output.ts';
import {
  assertReleaseVersionNotFuture,
  assertUpdaterVersionMatchesDisplay,
} from './release-version.ts';
import {
  assertDevelopmentRepoSnapshotsUnchanged,
  commandResult,
  fileSha256,
  manualVersions,
  readJson,
  requireFile,
  type RepoSnapshot,
  snapshotDevelopmentRepo,
  writeJson,
} from './manual-latest-build/common.ts';
import { prepareFrameworkOverlay } from './manual-latest-build/framework-overlay.ts';
import { installLocalApp } from './manual-latest-build/install-app.ts';
import { prepareLatestUpstreams } from './manual-latest-build/upstreams.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const OWNER_REPOS = {
  mas: 'med-autoscience',
  mag: 'med-autogrant',
  rca: 'redcube-ai',
  oma: 'opl-meta-agent',
  obf: 'opl-bookforge',
  'mas-scholar-skills': 'mas-scholar-skills',
  'opl-flow': 'opl-flow',
} as const;

type Mode = 'local-app' | 'full-dmg';

function assertManagedOutputPath(input: {
  outDir: string;
  workspaceRoot: string;
  cacheRoot: string;
  mode: Mode;
  version: string;
  updaterVersion: string;
  printPlan: boolean;
}) {
  const broadPaths = new Set([
    path.parse(input.outDir).root,
    os.homedir(),
    input.workspaceRoot,
    appRoot,
  ].map((candidate) => path.resolve(candidate)));
  if (broadPaths.has(input.outDir)) {
    throw new Error(`Unsafe managed output directory: ${input.outDir}`);
  }
  const defaultFull = path.join(
    os.homedir(),
    'Downloads',
    `One-Person-Lab-Manual-Full-${input.version}`,
  );
  const defaultLocal = path.join(
    input.cacheRoot,
    'local-app',
    `${input.version}-${input.updaterVersion}`,
  );
  const isDefault = input.outDir === (input.mode === 'full-dmg' ? defaultFull : defaultLocal);
  const outputStat = fs.statSync(input.outDir, { throwIfNoEntry: false });
  if (outputStat && !outputStat.isDirectory()) {
    throw new Error(`Managed output path is not a directory: ${input.outDir}`);
  }
  const entries = outputStat?.isDirectory() ? fs.readdirSync(input.outDir) : [];
  if (input.printPlan && entries.includes('manual-latest-build-receipt.json')) {
    throw new Error(
      `Refusing to overwrite successful build evidence with --print-plan: ${input.outDir}`,
    );
  }
  const isManaged = entries.length === 0
    || entries.includes('manual-latest-source-lock.json')
    || entries.includes('manual-latest-build-receipt.json');
  if (!isDefault && !isManaged) {
    throw new Error(
      `Refusing to replace a non-empty unmanaged output directory: ${input.outDir}`,
    );
  }
}

function managedOutputStage(outDir: string) {
  const parent = path.dirname(outDir);
  fs.mkdirSync(parent, { recursive: true });
  return fs.mkdtempSync(path.join(parent, `.${path.basename(outDir)}.staging-`));
}

function promoteManagedOutput(stagingDir: string, outDir: string) {
  const parent = path.dirname(outDir);
  const backupRoot = fs.mkdtempSync(path.join(parent, `.${path.basename(outDir)}.backup-`));
  const backupDir = path.join(backupRoot, path.basename(outDir));
  let movedExisting = false;
  try {
    if (fs.existsSync(outDir)) {
      fs.renameSync(outDir, backupDir);
      movedExisting = true;
    }
    fs.renameSync(stagingDir, outDir);
    fs.rmSync(backupRoot, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(outDir) && movedExisting && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, outDir);
    }
    throw error;
  }
}

function parseOptions(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: {
      version: { type: 'string' },
      'updater-version': { type: 'string' },
      'workspace-root': { type: 'string' },
      'shell-root': { type: 'string' },
      'ui-ux-pro-max-root': { type: 'string' },
      'cache-root': { type: 'string' },
      'out-dir': { type: 'string' },
      'install-path': { type: 'string' },
      'no-launch': { type: 'boolean', default: false },
      'reuse-gui-vite-output': { type: 'boolean', default: false },
      'print-plan': { type: 'boolean', default: false },
      'keep-workdir': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    return { help: true } as const;
  }
  const mode = positionals[0] as Mode | undefined;
  if (positionals.length !== 1 || !['local-app', 'full-dmg'].includes(String(mode))) {
    throw new Error('Usage: manual-latest-build.ts <local-app|full-dmg> [options]');
  }
  if (mode === 'full-dmg' && values['install-path']) {
    throw new Error('--install-path is supported only for local-app');
  }
  const defaults = manualVersions();
  const version = values.version?.trim() || defaults.displayVersion;
  const updaterVersion = values['updater-version']?.trim() || defaults.updaterVersion;
  assertReleaseVersionNotFuture('stable', version);
  assertUpdaterVersionMatchesDisplay('stable', version, updaterVersion);
  const workspaceRoot = path.resolve(values['workspace-root'] || path.dirname(appRoot));
  const cacheRoot = path.resolve(
    values['cache-root']
      || path.join(os.homedir(), 'Library', 'Caches', 'One Person Lab', 'manual-latest-build'),
  );
  const defaultOutDir = values['print-plan']
    ? path.join(cacheRoot, 'plans', `${version}-${updaterVersion}`)
    : mode === 'full-dmg'
      ? path.join(os.homedir(), 'Downloads', `One-Person-Lab-Manual-Full-${version}`)
      : path.join(cacheRoot, 'local-app', `${version}-${updaterVersion}`);
  const outDir = path.resolve(values['out-dir'] || defaultOutDir);
  return {
    help: false,
    mode,
    version,
    updaterVersion,
    workspaceRoot,
    shellRoot: values['shell-root'] ? path.resolve(values['shell-root']) : null,
    uiUxProMaxRoot: values['ui-ux-pro-max-root']
      ? path.resolve(values['ui-ux-pro-max-root'])
      : null,
    cacheRoot,
    outDir,
    installPath: path.resolve(values['install-path'] || '/Applications/One Person Lab.app'),
    launch: !values['no-launch'],
    reuseGuiViteOutput: values['reuse-gui-vite-output'],
    printPlan: values['print-plan'],
    keepWorkdir: values['keep-workdir'],
  } as const;
}

function printHelp() {
  console.log(`Usage:
  bun run manual:local-app -- [options]
  bun run manual:full-dmg -- [options]

Shared policy:
  - self-developed App, Shell, Framework, and first-party packages come from clean development-directory main HEADs
  - external companions come from the latest official stable GitHub Release and must match its sha256 digest

Options:
  --version <YY.M.D>              Display version (default: current Asia/Shanghai date)
  --updater-version <YY.M.D00>    Machine updater version (default: current date + 00)
  --workspace-root <path>         Development repositories root
  --out-dir <path>                Evidence/DMG output directory
  --install-path <path>           local-app target (default: /Applications/One Person Lab.app)
  --no-launch                     Do not relaunch local-app after replacement
  --reuse-gui-vite-output         Reuse an already compiled Shell frontend
  --print-plan                    Resolve and verify inputs without building
  --keep-workdir                  Keep the temporary Framework overlay for diagnosis

Guide: docs/delivery/release/manual-latest-builds.md`);
}

function resolveUiUxRoot(workspaceRoot: string, explicit: string | null) {
  const candidates = [
    explicit,
    path.join(workspaceRoot, 'ai-skills-library', 'ui-ux-pro-max'),
    path.join(workspaceRoot, 'ui-ux-pro-max-skill'),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const found = candidates.find((candidate) => fs.statSync(candidate, { throwIfNoEntry: false })?.isDirectory());
  if (!found) throw new Error(`UI UX Pro Max source is missing; checked: ${candidates.join(', ')}`);
  return found;
}

function repoSnapshots(options: ReturnType<typeof parseOptions> & { help: false }) {
  const shellRoot = fs.realpathSync(
    options.shellRoot || resolveActiveShellPaths().shellRoot,
  );
  const framework = snapshotDevelopmentRepo(
    'framework',
    path.join(options.workspaceRoot, 'one-person-lab'),
  );
  const owners = Object.fromEntries(Object.entries(OWNER_REPOS).map(([packageId, repoName]) => [
    packageId,
    snapshotDevelopmentRepo(packageId, path.join(options.workspaceRoot, repoName)),
  ])) as Record<string, RepoSnapshot>;
  const uiUxRoot = resolveUiUxRoot(options.workspaceRoot, options.uiUxProMaxRoot);
  const uiUxRepoRoot = commandResult('git', ['-C', uiUxRoot, 'rev-parse', '--show-toplevel'], {
    capture: true,
    timeoutMs: 30_000,
  }).stdout?.trim();
  if (!uiUxRepoRoot) throw new Error(`Cannot resolve UI UX Pro Max repository: ${uiUxRoot}`);
  return {
    app: snapshotDevelopmentRepo('app', appRoot),
    shell: snapshotDevelopmentRepo('shell', shellRoot),
    framework,
    owners,
    ui_ux_pro_max: snapshotDevelopmentRepo('ui-ux-pro-max', uiUxRepoRoot),
    shellRoot,
    uiUxRoot,
  };
}

function buildEnvironment(snapshots: ReturnType<typeof repoSnapshots>) {
  return {
    ...process.env,
    OPL_FULL_FRAMEWORK_REF: snapshots.framework.head,
    OPL_FULL_MAS_REF: snapshots.owners.mas.head,
    OPL_FULL_MAG_REF: snapshots.owners.mag.head,
    OPL_FULL_RCA_REF: snapshots.owners.rca.head,
    OPL_FULL_META_AGENT_REF: snapshots.owners.oma.head,
    OPL_FULL_BOOKFORGE_REF: snapshots.owners.obf.head,
    OPL_FULL_OPL_FLOW_REF: snapshots.owners['opl-flow'].head,
    OPL_FULL_RUNTIME_CACHE_MODE: 'readwrite',
  };
}

function developmentRepoSnapshots(snapshots: ReturnType<typeof repoSnapshots>) {
  return [
    snapshots.app,
    snapshots.shell,
    snapshots.framework,
    ...Object.values(snapshots.owners),
    snapshots.ui_ux_pro_max,
  ];
}

function runBuild(
  options: ReturnType<typeof parseOptions> & { help: false },
  snapshots: ReturnType<typeof repoSnapshots>,
  overlay: ReturnType<typeof prepareFrameworkOverlay>,
  upstreams: ReturnType<typeof prepareLatestUpstreams>,
) {
  const args = [
    '--experimental-strip-types',
    path.join(appRoot, 'scripts', 'build-full-first-install-package.ts'),
    '--version', options.version,
    '--updater-version', options.updaterVersion,
    '--out-dir', options.outDir,
    '--framework-root', overlay.root,
    '--gui-root', snapshots.shellRoot,
    '--mas-root', snapshots.owners.mas.root,
    '--mas-scholar-skills-root', snapshots.owners['mas-scholar-skills'].root,
    '--mas-scholar-skills-ref', snapshots.owners['mas-scholar-skills'].head,
    '--mag-root', snapshots.owners.mag.root,
    '--rca-root', snapshots.owners.rca.root,
    '--meta-agent-root', snapshots.owners.oma.root,
    '--bookforge-root', snapshots.owners.obf.root,
    '--opl-flow-root', snapshots.owners['opl-flow'].root,
    '--officecli-root', upstreams.officecli.source_root,
    '--officecli-bin', upstreams.officecli.binary,
    '--mineru-open-api-bin', upstreams.mineru_open_api.binary,
    '--ui-ux-pro-max-root', snapshots.uiUxRoot,
    '--temporal-cli-bin', upstreams.temporal.binary,
    '--temporal-cli-archive', upstreams.temporal.archive,
  ];
  if (options.mode === 'local-app') args.push('--app-only');
  if (options.reuseGuiViteOutput) args.push('--reuse-gui-vite-output');
  commandResult(process.execPath, args, {
    cwd: appRoot,
    env: buildEnvironment(snapshots),
    timeoutMs: 2 * 60 * 60 * 1000,
  });
}

function fullDmgEvidence(
  options: ReturnType<typeof parseOptions> & { help: false },
  buildOutDir: string,
) {
  const names = {
    dmg: `One-Person-Lab-Full-${options.version}-mac-arm64.dmg`,
    manifest: 'full-package-manifest.json',
    releaseManifest: 'opl-release-manifest.json',
  };
  const dmg = requireFile(path.join(buildOutDir, names.dmg), 'Manual Full DMG');
  const manifestPath = requireFile(path.join(buildOutDir, names.manifest), 'Full package manifest');
  const releaseManifestPath = requireFile(
    path.join(buildOutDir, names.releaseManifest),
    'Full release manifest',
  );
  const manifest = readJson(manifestPath);
  const releaseManifest = readJson(releaseManifestPath);
  if (manifest.version !== options.version || releaseManifest.version !== options.version) {
    throw new Error(
      `Manual Full output version mismatch: package=${String(manifest.version)} `
      + `release=${String(releaseManifest.version)} expected=${options.version}`,
    );
  }
  commandResult('hdiutil', ['verify', dmg], { timeoutMs: 300_000 });
  return {
    dmg: path.join(options.outDir, names.dmg),
    dmg_sha256: fileSha256(dmg),
    dmg_size_bytes: fs.statSync(dmg).size,
    full_package_manifest: path.join(options.outDir, names.manifest),
    full_package_manifest_sha256: fileSha256(manifestPath),
    release_manifest: path.join(options.outDir, names.releaseManifest),
    release_manifest_sha256: fileSha256(releaseManifestPath),
  };
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  assertManagedOutputPath(options);
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-manual-latest-build-'));
  const buildOutDir = options.printPlan ? options.outDir : managedOutputStage(options.outDir);
  let completed = false;
  let outputPromoted = false;
  try {
    const snapshots = repoSnapshots(options);
    const upstreams = prepareLatestUpstreams(path.join(options.cacheRoot, 'upstreams'));
    const overlay = prepareFrameworkOverlay({
      framework: snapshots.framework,
      ownerSnapshots: snapshots.owners,
      workRoot,
    });
    const sourceLock = {
      schema: 'opl_manual_latest_build_source_lock.v1',
      display_version: options.version,
      updater_version: options.updaterVersion,
      source_policy: {
        self_developed: 'clean_development_directory_main_head',
        external_companions: 'latest_official_stable_github_release_digest_verified',
        framework_projection: 'temporary_overlay_only_canonical_main_unchanged',
      },
      repositories: {
        app: snapshots.app,
        shell: snapshots.shell,
        framework: snapshots.framework,
        ...snapshots.owners,
        ui_ux_pro_max: snapshots.ui_ux_pro_max,
      },
      framework_overlay: {
        head: overlay.head,
        catalog_sha256: overlay.catalog_sha256,
        projections: overlay.projections,
      },
      upstreams,
    };
    fs.mkdirSync(buildOutDir, { recursive: true });
    const stagedSourceLockPath = path.join(buildOutDir, 'manual-latest-source-lock.json');
    const sourceLockPath = path.join(options.outDir, 'manual-latest-source-lock.json');
    writeJson(stagedSourceLockPath, sourceLock);
    if (options.printPlan) {
      console.log(JSON.stringify({ status: 'manual_latest_plan_ready', source_lock: sourceLockPath, ...sourceLock }, null, 2));
      completed = true;
      return;
    }

    const buildOptions = { ...options, outDir: buildOutDir };
    runBuild(buildOptions, snapshots, overlay, upstreams);
    let installation = null;
    if (options.mode === 'local-app') {
      assertDevelopmentRepoSnapshotsUnchanged(developmentRepoSnapshots(snapshots));
      installation = installLocalApp({
        builtApp: findBuiltApp(snapshots.shellRoot),
        installPath: options.installPath,
        expectedDisplayVersion: options.version,
        expectedUpdaterVersion: options.updaterVersion,
        launch: options.launch,
      });
      writeJson(path.join(buildOutDir, 'manual-local-app-installation.json'), installation);
    }
    const output = options.mode === 'full-dmg'
      ? fullDmgEvidence(options, buildOutDir)
      : {
          installed_app: options.installPath,
          installation_receipt: path.join(options.outDir, 'manual-local-app-installation.json'),
        };
    if (options.mode === 'full-dmg') {
      assertDevelopmentRepoSnapshotsUnchanged(developmentRepoSnapshots(snapshots));
    }
    writeJson(path.join(buildOutDir, 'manual-latest-build-receipt.json'), {
      schema: 'opl_manual_latest_build_receipt.v1',
      status: 'completed',
      mode: options.mode,
      display_version: options.version,
      updater_version: options.updaterVersion,
      source_lock: sourceLockPath,
      source_lock_sha256: fileSha256(stagedSourceLockPath),
      output,
      installation,
    });
    promoteManagedOutput(buildOutDir, options.outDir);
    outputPromoted = true;
    console.log(JSON.stringify({
      status: options.mode === 'local-app' ? 'manual_latest_local_app_ready' : 'manual_latest_full_dmg_ready',
      source_lock: sourceLockPath,
      output_dir: options.outDir,
      output,
      installation,
    }, null, 2));
    completed = true;
  } finally {
    if (!options.printPlan && !outputPromoted) {
      fs.rmSync(buildOutDir, { recursive: true, force: true });
    }
    if (!options.keepWorkdir) {
      fs.rmSync(workRoot, { recursive: true, force: true });
    } else {
      console.error(`Manual latest build workdir retained: ${workRoot}`);
    }
    if (!completed) {
      console.error('Manual latest build did not complete; no success claim was written.');
    }
  }
}

main();
