import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { FULL_RUNTIME_RESOURCE_DIR } from '../full-first-install-package.ts';
import { resolveActiveShellPaths } from '../app-shell-adapter.ts';
import { appRepoRoot } from './paths.ts';
import { requirePath } from './filesystem.ts';
import {
  assertAppBundleLocalAuthorization,
  canRunMacosSigningChecks,
  ensureAppBundleAdHocCodesign,
  verifyDmgAppBundleLocalAuthorization,
} from './macos-trust.ts';
import { findExecutable, run, runCapture } from './process.ts';

function createTarZst(archivePath, cwd, entries = ['.']) {
  requirePath(findExecutable('zstd'), 'zstd');
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.rmSync(archivePath, { force: true });
  const tarPath = `${archivePath}.tar`;
  fs.rmSync(tarPath, { force: true });
  try {
    run('tar', ['-cf', tarPath, '-C', cwd, ...entries]);
    run('zstd', ['-q', '-T0', '-f', tarPath, '-o', archivePath]);
  } finally {
    fs.rmSync(tarPath, { force: true });
  }
}

export function archiveLayer(sourceRoot, archivePath) {
  createTarZst(archivePath, sourceRoot, ['.']);
}

export function extractLayer(archivePath, targetRoot) {
  fs.mkdirSync(targetRoot, { recursive: true });
  const tarPath = path.join(os.tmpdir(), `opl-full-layer-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tar`);
  try {
    run('zstd', ['-q', '-d', '-f', archivePath, '-o', tarPath]);
    run('tar', ['-xf', tarPath, '-C', targetRoot]);
  } finally {
    fs.rmSync(tarPath, { force: true });
  }
}

function syncRuntimePayload(runtimeRoot, manifest, payloadRoot) {
  fs.rmSync(path.join(payloadRoot, 'runtime'), { recursive: true, force: true });
  fs.rmSync(path.join(payloadRoot, 'manifest'), { recursive: true, force: true });
  fs.mkdirSync(path.join(payloadRoot, 'runtime'), { recursive: true });
  fs.cpSync(runtimeRoot, path.join(payloadRoot, 'runtime', 'current'), {
    recursive: true,
    dereference: true,
    preserveTimestamps: true,
  });
  fs.mkdirSync(path.join(payloadRoot, 'manifest'), { recursive: true });
  fs.writeFileSync(
    path.join(payloadRoot, 'manifest', 'full-package-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

export function syncRuntimePayloadToBuildRoots(runtimeRoot, manifest, guiRoot) {
  const appPayloadRoot = path.join(appRepoRoot, 'packaged-runtimes', FULL_RUNTIME_RESOURCE_DIR);
  const shellPayloadRoot = resolveActiveShellPaths({ shellRoot: guiRoot }).packagedRuntimeRoot;
  syncRuntimePayload(runtimeRoot, manifest, appPayloadRoot);
  syncRuntimePayload(runtimeRoot, manifest, shellPayloadRoot);
  return { appPayloadRoot, shellPayloadRoot };
}

export function findBuiltDmg(guiRoot, version) {
  const outDir = resolveActiveShellPaths({ shellRoot: guiRoot }).buildOutputDir;
  const candidates = [
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One Person Lab-${version}-mac-arm64.dmg`,
  ].map((name) => path.join(outDir, name));
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Built arm64 DMG not found under ${outDir} for version ${version}`);
  }
  return found;
}

function removeBuiltDmgCandidates(guiRoot, version) {
  const outDir = resolveActiveShellPaths({ shellRoot: guiRoot }).buildOutputDir;
  for (const name of [
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One Person Lab-${version}-mac-arm64.dmg`,
  ]) {
    fs.rmSync(path.join(outDir, name), { force: true });
  }
}

export function findBuiltApp(guiRoot) {
  const outDir = resolveActiveShellPaths({ shellRoot: guiRoot }).buildOutputDir;
  const candidates = [
    path.join(outDir, 'mac-arm64', 'One Person Lab.app'),
    path.join(outDir, 'mac', 'One Person Lab.app'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Built app bundle not found under ${outDir}`);
  }
  return found;
}

function createFullDmgFromVerifiedApp(guiRoot, appPath, targetDmg, version) {
  removeBuiltDmgCandidates(guiRoot, version);
  ensureAppBundleAdHocCodesign(appPath, 'Full built app bundle');
  assertAppBundleLocalAuthorization(appPath, 'Full built app bundle');
  const compressionLevel = process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL || (process.env.CI === 'true' ? '9' : '7');
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-stage-'));
  try {
    const stagedApp = path.join(stagingRoot, 'One Person Lab.app');
    run('ditto', [appPath, stagedApp]);
    assertAppBundleLocalAuthorization(stagedApp, 'Full staged app bundle');
    fs.symlinkSync('/Applications', path.join(stagingRoot, 'Applications'));
    run('hdiutil', [
      'create',
      targetDmg,
      '-volname',
      `One Person Lab ${version}`,
      '-srcfolder',
      stagingRoot,
      '-format',
      'UDZO',
      '-ov',
      '-imagekey',
      `zlib-level=${compressionLevel}`,
    ]);
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
  verifyDmgAppBundleLocalAuthorization(targetDmg, 'Full first-install DMG');
}

export function ensureFullDmgLocalAuthorization(guiRoot, targetDmg, version) {
  if (!canRunMacosSigningChecks()) {
    return;
  }
  try {
    verifyDmgAppBundleLocalAuthorization(targetDmg, 'Full first-install DMG');
  } catch (error) {
    const builtApp = findBuiltApp(guiRoot);
    ensureAppBundleAdHocCodesign(builtApp, 'Full built app bundle');
    assertAppBundleLocalAuthorization(builtApp, 'Full built app bundle');
    fs.rmSync(targetDmg, { force: true });
    createFullDmgFromVerifiedApp(guiRoot, builtApp, targetDmg, version);
    console.warn(`Rebuilt Full DMG after local authorization verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function removeStandardGuiArtifacts(guiRoot, version) {
  const outDir = resolveActiveShellPaths({ shellRoot: guiRoot }).buildOutputDir;
  if (!fs.existsSync(outDir)) {
    return;
  }
  for (const entry of fs.readdirSync(outDir)) {
    if (
      entry === `One-Person-Lab-${version}-mac-arm64.dmg`
      || entry === `One Person Lab-${version}-mac-arm64.dmg`
      || entry === `One-Person-Lab-${version}-mac-arm64.zip`
      || entry === `One Person Lab-${version}-mac-arm64.zip`
      || entry === `One-Person-Lab-${version}-mac-arm64.dmg.blockmap`
      || entry === `One Person Lab-${version}-mac-arm64.dmg.blockmap`
      || entry === `One-Person-Lab-${version}-mac-arm64.zip.blockmap`
      || entry === `One Person Lab-${version}-mac-arm64.zip.blockmap`
      || entry === 'latest-mac.yml'
      || entry === 'latest-arm64-mac.yml'
    ) {
      fs.rmSync(path.join(outDir, entry), { force: true });
    }
  }
}

export function maybeCreateRuntimeTar(options, runtimeRoot, artifactNames) {
  if (!options.splitRuntime) {
    return null;
  }
  const target = path.join(options.outDir, artifactNames.runtimeTar);
  createTarZst(target, path.dirname(runtimeRoot), [path.basename(runtimeRoot)]);
  return target;
}
