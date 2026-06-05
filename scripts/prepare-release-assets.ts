#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = path.resolve(root, process.argv[2] ?? 'build-artifacts');
const outputDir = path.resolve(root, process.argv[3] ?? 'release-assets');
const shellPaths = resolveActiveShellPaths();
const expectedVersion = process.env.OPL_RELEASE_VERSION?.trim() || '';

const result = spawnSync('bash', [shellPaths.releasePrepareScriptPath, artifactsDir, outputDir], {
  cwd: shellPaths.shellRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findFilesByName(rootDir: string, fileName: string): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const matches: string[] = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findFilesByName(entryPath, fileName));
    } else if (entry.isFile() && entry.name === fileName) {
      matches.push(entryPath);
    }
  }
  return matches;
}

function preserveStandardLocalAuthorizationPolicy(): void {
  const policyName = 'standard-local-authorization-policy.json';
  const sources = findFilesByName(artifactsDir, policyName);
  if (sources.length === 0) {
    return;
  }
  if (sources.length > 1) {
    throw new Error(`Expected one ${policyName}, found ${sources.length}: ${sources.join(', ')}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  fs.copyFileSync(sources[0], path.join(outputDir, policyName));
}

function readMetadataVersion(): string {
  const versions = new Set<string>();
  for (const metadataName of ['latest-mac.yml', 'latest-arm64-mac.yml']) {
    const metadataPath = path.join(outputDir, metadataName);
    if (!fs.existsSync(metadataPath)) {
      continue;
    }
    const match = fs.readFileSync(metadataPath, 'utf8').match(/^version:\s*['"]?([^'"\s]+)['"]?\s*$/m);
    if (match?.[1]) {
      versions.add(match[1]);
    }
  }
  if (versions.size === 1) {
    return [...versions][0];
  }
  if (versions.size > 1) {
    throw new Error(`Updater metadata declares multiple versions: ${[...versions].sort().join(', ')}`);
  }
  return '';
}

function filterStandardAssetsToVersion(version: string): void {
  if (!version) {
    return;
  }
  const escapedVersion = escapeRegExp(version);
  const currentAsset = new RegExp(`^One-Person-Lab-${escapedVersion}-mac-arm64\\.(?:dmg|zip)(?:\\.blockmap)?$`);
  const standardAsset = /^One-Person-Lab-.+-mac-arm64\.(?:dmg|zip)(?:\.blockmap)?$/;
  for (const entry of fs.readdirSync(outputDir)) {
    if (!standardAsset.test(entry) || currentAsset.test(entry)) {
      continue;
    }
    fs.rmSync(path.join(outputDir, entry), { force: true });
  }
}

preserveStandardLocalAuthorizationPolicy();
filterStandardAssetsToVersion(expectedVersion || readMetadataVersion());
