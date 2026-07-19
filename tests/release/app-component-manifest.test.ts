import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '../..');

function asset(name: string, digit: string) {
  return {
    name,
    url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.13/${name}`,
    digest: `sha256:${digit.repeat(64)}`,
    size: 100,
    contentType: 'application/octet-stream',
  };
}

test('App owner manifest records only immutable standard App artifacts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-component-'));
  const releaseJson = path.join(root, 'release.json');
  const output = path.join(root, 'opl-app-component-manifest.json');
  const standardAssets = [
    asset('latest-arm64-mac.yml', '1'),
    asset('One-Person-Lab-26.7.13-mac-arm64.dmg', '2'),
    asset('One-Person-Lab-26.7.13-mac-arm64.zip', '3'),
    asset('One-Person-Lab-26.7.13-mac-arm64.zip.blockmap', '4'),
    asset('standard-local-authorization-policy.json', '5'),
  ];
  fs.writeFileSync(releaseJson, `${JSON.stringify({
    tagName: 'v26.7.13',
    isDraft: true,
    isPrerelease: false,
    url: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/tag/untagged-test',
    assets: [...standardAssets, asset('One-Person-Lab-Full-26.7.13-mac-arm64.dmg', '6')],
  })}\n`);
  execFileSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/write-opl-app-component-manifest.ts',
    '--version', '26.7.13',
    '--source-commit', 'a'.repeat(40),
    '--release-json', releaseJson,
    '--output', output,
  ], { cwd: appRoot, encoding: 'utf8' });
  const component = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(component.surface_kind, 'opl_app_component_manifest.v1');
  assert.equal(component.component_id, 'opl-app');
  assert.equal(component.version, '26.7.13');
  assert.equal(component.primary_artifact.name, 'One-Person-Lab-26.7.13-mac-arm64.dmg');
  assert.equal(component.artifacts.length, 5);
  assert.equal(component.artifacts.some((entry: { name: string }) => entry.name.includes('Full')), false);
  assert.match(component.component_manifest_digest, /^sha256:[0-9a-f]{64}$/);
});

test('App owner manifest fails closed when a standard asset is missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-component-'));
  const releaseJson = path.join(root, 'release.json');
  fs.writeFileSync(releaseJson, `${JSON.stringify({
    tagName: 'v26.7.13',
    isDraft: true,
    isPrerelease: false,
    assets: [asset('One-Person-Lab-26.7.13-mac-arm64.dmg', '2')],
  })}\n`);
  assert.throws(() => execFileSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/write-opl-app-component-manifest.ts',
    '--version', '26.7.13',
    '--source-commit', 'a'.repeat(40),
    '--release-json', releaseJson,
    '--output', path.join(root, 'manifest.json'),
  ], { cwd: appRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
});

test('promotion verifies immutable published manifest fields without regenerating Draft URL bytes', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  assert.doesNotMatch(workflow, /expected-opl-app-component-manifest\.json/);
  assert.doesNotMatch(workflow, /cmp \"\$RUNNER_TEMP\/published-component/);
  assert.match(workflow, /immutable payload digest does not match its bytes/);
  assert.match(workflow, /historical Draft alias/);
  assert.match(workflow, /component manifest bytes do not match the immutable GitHub asset/);
  assert.match(workflow, /artifact\.digest !== remote\.digest/);
  assert.match(workflow, /primary artifact is not the exact qualified DMG/);
});
