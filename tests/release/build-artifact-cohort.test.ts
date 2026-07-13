import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { appRoot } from './app-release-boundary-cases/helpers.ts';
import { buildArtifactCohortV2 } from '../../scripts/build-artifact-cohort.ts';

const validator = path.join(appRoot, 'scripts', 'validate-build-artifact-cohort.ts');
const appSha = 'a'.repeat(40);
const shellSha = 'b'.repeat(40);
const frameworkSha = 'c'.repeat(40);

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-build-cohort-'));
  const artifact = path.join(root, 'One-Person-Lab-Full.dmg');
  const tree = path.join(root, 'One Person Lab.app');
  fs.mkdirSync(tree);
  fs.writeFileSync(artifact, 'same artifact bytes');
  fs.writeFileSync(path.join(tree, 'app.asar'), 'packaged bytes');
  const appProfile = path.join(root, 'app-product-profile.json');
  const guiContract = path.join(root, 'app-gui-product-contract.json');
  const smokeHarness = path.join(root, 'opl-first-run-vm-smoke.mjs');
  for (const file of [appProfile, guiContract, smokeHarness]) fs.writeFileSync(file, file);
  const manifestPath = path.join(root, 'opl-build-cohort.json');
  const manifest = buildArtifactCohortV2({
    appSha, shellSha, frameworkSha, version: '26.7.13', kind: 'full', artifactPath: artifact,
    artifactName: path.basename(artifact), packagedTreePath: tree, appProductProfilePath: appProfile,
    guiProductContractPath: guiContract, smokeHarnessPath: smokeHarness, actionsRunId: '12345',
    actionsRunAttempt: '1', actionsArtifactName: 'opl-full-first-install-dmg-26.7.13-mac-arm64',
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  return { root, artifact, manifestPath, manifest };
}

function validate(input: ReturnType<typeof fixture>, expectedShellSha = shellSha) {
  return spawnSync(process.execPath, [
    '--experimental-strip-types', validator, '--manifest', input.manifestPath, '--artifact', input.artifact,
    '--app-sha', appSha, '--shell-sha', expectedShellSha, '--framework-sha', frameworkSha,
    '--version', '26.7.13', '--actions-run-id', '12345',
  ], { encoding: 'utf8' });
}

test('accepts an exact-byte App, Shell, Framework, and DMG cohort', () => {
  const input = fixture();
  try {
    const result = validate(input);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).manifest.schema, 'opl_app_build_artifact_cohort.v2');
    assert.equal(input.manifest.artifact.sha256.length, 64);
    assert.equal(input.manifest.digests.packaged_tree_sha256.length, 64);
  } finally {
    fs.rmSync(input.root, { recursive: true, force: true });
  }
});

test('rejects a new smoke harness against an older Shell artifact cohort', () => {
  const input = fixture();
  try {
    const result = validate(input, 'd'.repeat(40));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /refusing cross-cohort VM smoke/);
    assert.match(result.stderr, /shell_sha expected/);
  } finally {
    fs.rmSync(input.root, { recursive: true, force: true });
  }
});

test('rejects a mutated DMG even when every Git SHA still matches', () => {
  const input = fixture();
  try {
    fs.appendFileSync(input.artifact, 'mutation');
    const result = validate(input);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /artifact (size|SHA-256)/);
  } finally {
    fs.rmSync(input.root, { recursive: true, force: true });
  }
});

test('rejects the legacy v1 manifest before VM allocation', () => {
  const input = fixture();
  try {
    fs.writeFileSync(input.manifestPath, JSON.stringify({ schema: 'opl_app_build_artifact_cohort.v1' }));
    const result = validate(input);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsupported schema/);
  } finally {
    fs.rmSync(input.root, { recursive: true, force: true });
  }
});
