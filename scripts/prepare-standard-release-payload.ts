#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertAppRootBoundary } from './app-root-boundary.ts';
import { syncAppProductProfileToShell } from './app-product-profile.ts';
import { resolveActiveShellPaths, resolveShellAdapterIdentity } from './app-shell-adapter.ts';
import { resolveDesktopReleaseCarrier } from './desktop-release-carrier.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = path.join(appRoot, 'packaged-runtimes', 'opl-full-runtime');
const appInstallerPath = path.join(appRoot, 'install.sh');
const frameworkShaPattern = /^[0-9a-f]{40}$/;
const frameworkInstallerDefault =
  'OPL_INSTALL_SCRIPT_URL=${OPL_INSTALL_SCRIPT_URL:-https://raw.githubusercontent.com/gaofeng21cn/one-person-lab/main/install.sh}';
const strictModeAnchor = 'set -euo pipefail\n';

export type StandardFrameworkBootstrapPin = {
  frameworkRef: string;
  installerUrl: string;
  archiveUrl: string;
};

export function resolveStandardFrameworkBootstrapPin(
  env: NodeJS.ProcessEnv = process.env,
): StandardFrameworkBootstrapPin | null {
  const releaseBound = env.OPL_STANDARD_PAYLOAD_RELEASE_BOUND?.trim() || 'false';
  if (releaseBound !== 'true' && releaseBound !== 'false') {
    throw new Error('OPL_STANDARD_PAYLOAD_RELEASE_BOUND must be true or false.');
  }

  const frameworkRef = env.OPL_STANDARD_PAYLOAD_FRAMEWORK_REF?.trim() ?? '';
  if (!frameworkRef) {
    if (releaseBound === 'true') {
      throw new Error('Release-bound Standard payload requires an exact OPL_STANDARD_PAYLOAD_FRAMEWORK_REF.');
    }
    return null;
  }
  if (!frameworkShaPattern.test(frameworkRef)) {
    throw new Error('OPL_STANDARD_PAYLOAD_FRAMEWORK_REF must be an exact lowercase 40-character Framework SHA.');
  }

  return {
    frameworkRef,
    installerUrl: `https://raw.githubusercontent.com/gaofeng21cn/one-person-lab/${frameworkRef}/install.sh`,
    archiveUrl: `https://github.com/gaofeng21cn/one-person-lab/archive/${frameworkRef}.tar.gz`,
  };
}

function replaceUnique(source: string, anchor: string, replacement: string, label: string): string {
  const first = source.indexOf(anchor);
  if (first < 0 || source.indexOf(anchor, first + anchor.length) >= 0) {
    throw new Error(`${label} must occur exactly once in the App installer.`);
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + anchor.length)}`;
}

export function materializePinnedStandardBootstrapInstaller(
  source: string,
  pin: StandardFrameworkBootstrapPin,
): string {
  if (!frameworkShaPattern.test(pin.frameworkRef)) {
    throw new Error('Standard bootstrap pin must use an exact lowercase 40-character Framework SHA.');
  }
  const expectedInstallerUrl =
    `https://raw.githubusercontent.com/gaofeng21cn/one-person-lab/${pin.frameworkRef}/install.sh`;
  const expectedArchiveUrl =
    `https://github.com/gaofeng21cn/one-person-lab/archive/${pin.frameworkRef}.tar.gz`;
  if (pin.installerUrl !== expectedInstallerUrl || pin.archiveUrl !== expectedArchiveUrl) {
    throw new Error('Standard bootstrap installer and archive URLs must bind the same exact Framework SHA.');
  }

  let materialized = replaceUnique(
    source,
    frameworkInstallerDefault,
    `OPL_INSTALL_SCRIPT_URL=\${OPL_INSTALL_SCRIPT_URL:-${pin.installerUrl}}`,
    'Canonical Framework installer default',
  );
  const strictModePrelude = [
    strictModeAnchor.trimEnd(),
    `OPL_FRAMEWORK_SOURCE_REF=\${OPL_FRAMEWORK_SOURCE_REF:-${pin.frameworkRef}}`,
    `OPL_INSTALL_BRANCH=\${OPL_INSTALL_BRANCH:-${pin.frameworkRef}}`,
    'OPL_INSTALL_SOURCE_MODE=${OPL_INSTALL_SOURCE_MODE:-archive}',
    `OPL_SOURCE_ARCHIVE_URL=\${OPL_SOURCE_ARCHIVE_URL:-${pin.archiveUrl}}`,
    'export OPL_FRAMEWORK_SOURCE_REF OPL_INSTALL_BRANCH OPL_INSTALL_SOURCE_MODE OPL_SOURCE_ARCHIVE_URL',
    '',
  ].join('\n');
  materialized = replaceUnique(materialized, strictModeAnchor, strictModePrelude, 'Strict-mode anchor');

  if (materialized.includes(frameworkInstallerDefault)) {
    throw new Error('Pinned Standard bootstrap retained the mutable Framework main installer default.');
  }
  for (const required of [pin.frameworkRef, pin.installerUrl, pin.archiveUrl]) {
    if (!materialized.includes(required)) {
      throw new Error(`Pinned Standard bootstrap omitted exact Framework identity: ${required}`);
    }
  }
  return materialized;
}

export function prepareStandardReleasePayload(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const frameworkPin = resolveStandardFrameworkBootstrapPin(env);
  const shellPaths = resolveActiveShellPaths();
  const shellRuntimeRoot = shellPaths.packagedRuntimeRoot;
  const shellBootstrapInstallerPath = path.join(shellPaths.shellRoot, 'resources', 'opl-install.sh');

  assertAppRootBoundary({ phase: 'before standard payload preparation' });
  if (shellPaths.contract.release_role === 'experimental_candidate_shell') {
    return {
      status: 'standard_release_payload_skipped_for_candidate_shell',
      reason: 'Experimental candidate shells do not consume AionUI stable payload preparation before active-shell adoption',
      shell_root: shellPaths.shellRootForDisplay,
      candidate_shell: resolveShellAdapterIdentity(shellPaths.contract),
    };
  }
  const releaseCarrier = resolveDesktopReleaseCarrier({
    contract: shellPaths.contract,
    shellRoot: shellPaths.shellRoot,
  });
  fs.rmSync(path.join(runtimeRoot, 'runtime'), { recursive: true, force: true });
  fs.rmSync(path.join(runtimeRoot, 'manifest'), { recursive: true, force: true });
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.rmSync(path.join(shellRuntimeRoot, 'runtime'), { recursive: true, force: true });
  fs.rmSync(path.join(shellRuntimeRoot, 'manifest'), { recursive: true, force: true });
  const profileSync = syncAppProductProfileToShell(shellPaths.shellRoot, { optional: true });
  fs.mkdirSync(path.dirname(shellBootstrapInstallerPath), { recursive: true });
  const installerSource = fs.readFileSync(appInstallerPath, 'utf8');
  const installerPayload = frameworkPin
    ? materializePinnedStandardBootstrapInstaller(installerSource, frameworkPin)
    : installerSource;
  fs.writeFileSync(shellBootstrapInstallerPath, installerPayload, { mode: 0o755 });
  fs.chmodSync(shellBootstrapInstallerPath, 0o755);
  assertAppRootBoundary({ phase: 'after standard payload preparation' });

  return {
    status: 'standard_release_payload_ready',
    removed_full_runtime_payload: true,
    standard_bootstrap_installer: shellBootstrapInstallerPath,
    framework_bootstrap: frameworkPin
      ? {
          framework_ref: frameworkPin.frameworkRef,
          installer_url: frameworkPin.installerUrl,
          archive_url: frameworkPin.archiveUrl,
          install_source_mode: 'archive',
        }
      : null,
    product_profile_synced: profileSync.synced,
    product_profile_target: profileSync.targetPath,
    runtime_root: runtimeRoot,
    shell_runtime_root: shellRuntimeRoot,
    shell_root: shellPaths.shellRootForDisplay,
    desktop_release_carrier: {
      carrier_id: releaseCarrier.carrierId,
      owner_repo: releaseCarrier.ownerRepo,
      release_role: releaseCarrier.releaseRole,
      bundle_id: releaseCarrier.bundleId,
      release_repository: releaseCarrier.releaseRepository,
      toolchain: releaseCarrier.toolchain,
      manifest_path: releaseCarrier.manifestPath,
    },
  };
}

function main(): void {
  console.log(JSON.stringify(prepareStandardReleasePayload(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
