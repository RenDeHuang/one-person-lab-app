#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.resolve(root, process.argv[2] ?? 'release-assets');
const expectedVersion = process.env.OPL_RELEASE_VERSION?.trim() || '';
const shellPaths = resolveActiveShellPaths();

const result = spawnSync('bash', [shellPaths.releaseVerifyScriptPath, outputDir], {
  cwd: shellPaths.shellRoot,
  stdio: 'pipe',
  encoding: 'utf8',
  env: process.env,
});
if (result.status !== 0) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (!existsSync(outputDir)) {
  console.error(`Release asset directory does not exist: ${outputDir}`);
  process.exit(1);
}

const metadataFiles = readdirSync(outputDir)
  .filter((name) => /^latest.*\.ya?ml$/.test(name))
  .sort();

let errors = 0;
const gatekeeperPolicyPath = path.join(outputDir, 'standard-gatekeeper-launch-policy.json');
if (!existsSync(gatekeeperPolicyPath)) {
  console.error('FAIL: missing standard-gatekeeper-launch-policy.json');
  errors += 1;
} else {
  try {
    const policy = JSON.parse(readFileSync(gatekeeperPolicyPath, 'utf8'));
    if (
      policy?.schema !== 'opl_gatekeeper_launch_policy.v1' ||
      policy?.package_kind !== 'app_standard' ||
      policy?.codesign_status !== 'passed' ||
      policy?.spctl_status !== 'passed'
    ) {
      console.error('FAIL: standard-gatekeeper-launch-policy.json must prove codesign and spctl passed for app_standard');
      errors += 1;
    }
  } catch (error) {
    console.error(`FAIL: invalid standard-gatekeeper-launch-policy.json: ${error instanceof Error ? error.message : String(error)}`);
    errors += 1;
  }
}

for (const fileName of metadataFiles) {
  const filePath = path.join(outputDir, fileName);
  const text = readFileSync(filePath, 'utf8');
  if (/One-Person-Lab-Full|Full-/i.test(text)) {
    console.error(`FAIL: standard updater metadata references a Full first-install asset: ${fileName}`);
    errors += 1;
  }
  if (expectedVersion) {
    const escapedVersion = expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`^version:\\s*['"]?${escapedVersion}['"]?\\s*$`, 'm').test(text)) {
      console.error(`FAIL: ${fileName} does not declare OPL release version ${expectedVersion}`);
      errors += 1;
    }
  }
}

if (errors > 0) {
  process.exit(1);
}

console.log('PASS: standard updater metadata excludes Full first-install assets and Gatekeeper launch policy passed');
