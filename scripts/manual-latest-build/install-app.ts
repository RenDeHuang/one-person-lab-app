import fs from 'node:fs';
import path from 'node:path';

import {
  commandOutput,
  commandResult,
  readJson,
  requireDirectory,
} from './common.ts';

const FULL_MANIFEST_REF = path.join(
  'Contents',
  'Resources',
  'opl-full-runtime',
  'manifest',
  'full-package-manifest.json',
);

export type ManualAppVersionIdentity = {
  bundle_id: string;
  display_version: string | null;
  updater_version: string;
  cf_bundle_short_version: string;
  cf_bundle_version: string;
  full_manifest: string | null;
};

function plistValue(appPath: string, key: string) {
  return commandOutput('plutil', ['-extract', key, 'raw', '-o', '-', path.join(appPath, 'Contents', 'Info.plist')]);
}

function processPattern(appPath: string) {
  return `${appPath}/Contents/MacOS/`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appProcessIds(appPath: string) {
  const result = commandResult('pgrep', ['-f', processPattern(appPath)], {
    capture: true,
    allowFailure: true,
    timeoutMs: 10_000,
  });
  if (result.status === 1) return [];
  if (result.status !== 0) {
    throw new Error(`Cannot inspect running App processes: ${String(result.stderr).trim()}`);
  }
  return String(result.stdout).trim().split(/\s+/).filter(Boolean).map(Number);
}

function sleep(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function waitForInstalledApp(appPath: string) {
  const deadline = Date.now() + 30_000;
  let processIds: number[] = [];
  while (Date.now() < deadline) {
    processIds = appProcessIds(appPath);
    if (processIds.length > 0) return processIds;
    sleep(250);
  }
  throw new Error(`Installed App did not start within 30 seconds: ${appPath}`);
}

function stopInstalledApp(appPath: string, bundleId: string) {
  const initial = appProcessIds(appPath);
  if (initial.length === 0) return { was_running: false, stopped_pids: [] as number[] };
  commandResult('osascript', ['-e', `tell application id "${bundleId}" to quit`], {
    timeoutMs: 15_000,
  });
  const deadline = Date.now() + 20_000;
  let remaining = initial;
  while (Date.now() < deadline) {
    remaining = appProcessIds(appPath);
    if (remaining.length === 0) {
      return { was_running: true, stopped_pids: initial };
    }
    sleep(250);
  }
  throw new Error(`Installed App did not quit within 20 seconds; still running PID(s): ${remaining.join(', ')}`);
}

function verifyApp(appPath: string): ManualAppVersionIdentity {
  requireDirectory(appPath, 'App bundle');
  commandResult('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    timeoutMs: 120_000,
  });
  const shortVersion = plistValue(appPath, 'CFBundleShortVersionString');
  const bundleVersion = plistValue(appPath, 'CFBundleVersion');
  if (shortVersion !== bundleVersion) {
    throw new Error(
      `App bundle machine versions differ: CFBundleShortVersionString=${shortVersion} CFBundleVersion=${bundleVersion}`,
    );
  }
  const manifestPath = path.join(appPath, FULL_MANIFEST_REF);
  const manifest = fs.statSync(manifestPath, { throwIfNoEntry: false })?.isFile()
    ? readJson(manifestPath)
    : null;
  return {
    bundle_id: plistValue(appPath, 'CFBundleIdentifier'),
    display_version: typeof manifest?.version === 'string' ? manifest.version : null,
    updater_version: shortVersion,
    cf_bundle_short_version: shortVersion,
    cf_bundle_version: bundleVersion,
    full_manifest: manifest ? manifestPath : null,
  };
}

export function assertManualAppVersionIdentity(
  actual: ManualAppVersionIdentity,
  expectedDisplayVersion: string,
  expectedUpdaterVersion: string,
) {
  if (actual.bundle_id !== 'cn.onepersonlab.opl'
    || actual.display_version !== expectedDisplayVersion
    || actual.updater_version !== expectedUpdaterVersion
    || actual.cf_bundle_short_version !== expectedUpdaterVersion
    || actual.cf_bundle_version !== expectedUpdaterVersion) {
    throw new Error(
      'Built App version identity mismatch: '
      + `bundle_id=${actual.bundle_id} display=${actual.display_version ?? '<missing>'} `
      + `updater=${actual.updater_version} short=${actual.cf_bundle_short_version} `
      + `bundle=${actual.cf_bundle_version}; expected display=${expectedDisplayVersion} `
      + `updater=${expectedUpdaterVersion}`,
    );
  }
}

export function installLocalApp(input: {
  builtApp: string;
  installPath: string;
  expectedDisplayVersion: string;
  expectedUpdaterVersion: string;
  launch: boolean;
}) {
  if (process.platform !== 'darwin') {
    throw new Error('Local App installation is supported only on macOS');
  }
  const installPath = path.resolve(input.installPath);
  if (!installPath.endsWith('.app') || installPath === '/' || installPath === path.parse(installPath).root) {
    throw new Error(`Unsafe App install path: ${installPath}`);
  }
  const built = verifyApp(input.builtApp);
  assertManualAppVersionIdentity(built, input.expectedDisplayVersion, input.expectedUpdaterVersion);

  const parent = path.dirname(installPath);
  fs.mkdirSync(parent, { recursive: true });
  const stagingRoot = fs.mkdtempSync(path.join(parent, '.opl-manual-app-install-'));
  const stagedApp = path.join(stagingRoot, path.basename(installPath));
  commandResult('ditto', [input.builtApp, stagedApp], { timeoutMs: 300_000 });
  const staged = verifyApp(stagedApp);
  assertManualAppVersionIdentity(staged, input.expectedDisplayVersion, input.expectedUpdaterVersion);

  let existing: ManualAppVersionIdentity | null = null;
  let stop = { was_running: false, stopped_pids: [] as number[] };
  let backupRoot: string | null = null;
  let backupPath: string | null = null;
  let movedExisting = false;
  let launchProcessIds: number[] = [];
  let succeeded = false;
  try {
    existing = fs.existsSync(installPath) ? verifyApp(installPath) : null;
    stop = existing
      ? stopInstalledApp(installPath, existing.bundle_id)
      : stop;
    backupRoot = fs.mkdtempSync(path.join(parent, '.opl-manual-app-backup-'));
    backupPath = path.join(backupRoot, path.basename(installPath));
    if (existing) {
      fs.renameSync(installPath, backupPath);
      movedExisting = true;
    }
    fs.renameSync(stagedApp, installPath);
    commandResult('xattr', ['-dr', 'com.apple.quarantine', installPath], {
      timeoutMs: 60_000,
      allowFailure: true,
    });
    const installed = verifyApp(installPath);
    assertManualAppVersionIdentity(installed, input.expectedDisplayVersion, input.expectedUpdaterVersion);
    if (input.launch) {
      commandResult('open', [installPath], { timeoutMs: 30_000 });
      launchProcessIds = waitForInstalledApp(installPath);
    }
    succeeded = true;
  } catch (error) {
    if (movedExisting && backupPath) {
      fs.rmSync(installPath, { recursive: true, force: true });
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, installPath);
        movedExisting = false;
        if (stop.was_running) {
          commandResult('open', [installPath], { timeoutMs: 30_000, allowFailure: true });
        }
      }
    }
    throw error;
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    if (movedExisting && backupPath && !fs.existsSync(installPath) && fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, installPath);
      movedExisting = false;
    }
    if (backupRoot && (succeeded || !movedExisting)) {
      fs.rmSync(backupRoot, { recursive: true, force: true });
    }
  }

  return {
    installed_app: installPath,
    replaced_version: existing,
    installed_version: verifyApp(installPath),
    prior_app_was_running: stop.was_running,
    launched: input.launch,
    launch_process_ids: launchProcessIds,
  };
}
