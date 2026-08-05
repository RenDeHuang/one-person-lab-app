#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

type ReleaseAsset = { name: string; size: number; digest: string };
type ReleaseRecord = {
  id: number;
  tag_name: string;
  target_commitish: string;
  draft: boolean;
  prerelease: boolean;
  immutable: boolean;
  assets: ReleaseAsset[];
};

function fail(message: string): never {
  throw new Error(message);
}

function runGh(args: string[], input?: string): string {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    input,
    timeout: 120_000,
    env: { ...process.env, GH_PROMPT_DISABLED: '1' },
  });
  if (result.error || result.status !== 0) {
    fail(`gh ${args.join(' ')} failed: ${(result.stderr || result.error?.message || '').trim()}`);
  }
  return result.stdout;
}

function readRelease(repository: string, releaseId: number): ReleaseRecord {
  const value = JSON.parse(runGh(['api', `repos/${repository}/releases/${releaseId}`])) as ReleaseRecord;
  if (!Number.isInteger(value.id) || !Array.isArray(value.assets)) fail('GitHub returned an invalid Release record.');
  return value;
}

function digestFile(file: string): ReleaseAsset & { source_path: string } {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size <= 0) fail(`Desktop asset must be a nonempty regular file: ${file}`);
  return {
    name: path.basename(file),
    size: stat.size,
    digest: `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`,
    source_path: file,
  };
}

function inventory(record: ReleaseRecord): ReleaseAsset[] {
  return record.assets
    .map(({ name, size, digest }) => ({ name, size, digest }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function assertRelease(record: ReleaseRecord, expected: {
  releaseId: number;
  tag: string;
  target: string;
}) {
  if (
    record.id !== expected.releaseId
    || record.tag_name !== expected.tag
    || record.target_commitish !== expected.target
    || record.draft !== false
    || record.prerelease !== false
    || record.immutable !== false
  ) {
    fail('Stable Desktop append requires the exact published mutable non-prerelease Release.');
  }
  const names = record.assets.map((asset) => asset.name);
  if (new Set(names).size !== names.length) fail('Stable Release contains duplicate asset names.');
}

function assertExpectedState(
  record: ReleaseRecord,
  base: ReleaseAsset[],
  completed: Array<ReleaseAsset & { source_path: string }>,
) {
  const expected = [...base, ...completed.map(({ source_path: _sourcePath, ...asset }) => asset)]
    .sort((left, right) => left.name.localeCompare(right.name));
  if (JSON.stringify(inventory(record)) !== JSON.stringify(expected)) {
    fail('Stable Release inventory changed outside this append operation.');
  }
}

export function buildAppendPlan(record: ReleaseRecord, assets: Array<ReleaseAsset & { source_path: string }>) {
  const remoteByName = new Map(record.assets.map((asset) => [asset.name, asset]));
  const upload: Array<ReleaseAsset & { source_path: string }> = [];
  for (const asset of assets) {
    const remote = remoteByName.get(asset.name);
    if (!remote) {
      upload.push(asset);
      continue;
    }
    if (remote.size !== asset.size || remote.digest !== asset.digest) {
      fail(`Stable Release asset conflict for ${asset.name}.`);
    }
  }
  return { upload, already_complete: assets.filter((asset) => !upload.includes(asset)) };
}

function main() {
  const { values } = parseArgs({
    options: {
      repository: { type: 'string' },
      'release-id': { type: 'string' },
      tag: { type: 'string' },
      target: { type: 'string' },
      'asset-dir': { type: 'string' },
      output: { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
  });
  const repository = values.repository || fail('--repository is required.');
  const releaseId = Number(values['release-id'] || fail('--release-id is required.'));
  const tag = values.tag || fail('--tag is required.');
  const target = values.target || fail('--target is required.');
  const assetDir = path.resolve(values['asset-dir'] || fail('--asset-dir is required.'));
  const output = path.resolve(values.output || fail('--output is required.'));
  if (!Number.isInteger(releaseId) || releaseId <= 0) fail('--release-id must be a positive integer.');
  if (!/^v[0-9][0-9A-Za-z._-]*$/.test(tag)) fail('--tag must be an exact v-prefixed Release tag.');
  if (!/^[0-9a-f]{40}$/.test(target)) fail('--target must be an exact Git SHA.');

  const files = fs.readdirSync(assetDir)
    .map((name) => path.join(assetDir, name))
    .filter((file) => fs.statSync(file).isFile())
    .sort();
  if (files.length === 0) fail('Desktop append asset directory is empty.');
  const assets = files.map(digestFile);
  if (new Set(assets.map((asset) => asset.name)).size !== assets.length) fail('Desktop append contains duplicate names.');

  let release = readRelease(repository, releaseId);
  assertRelease(release, { releaseId, tag, target });
  const base = inventory(release);
  const plan = buildAppendPlan(release, assets);
  const completed: Array<ReleaseAsset & { source_path: string }> = [];

  if (values.apply) {
    for (const asset of plan.upload) {
      release = readRelease(repository, releaseId);
      assertRelease(release, { releaseId, tag, target });
      assertExpectedState(release, base, completed);
      const result = spawnSync('gh', ['release', 'upload', tag, asset.source_path, '--repo', repository], {
        encoding: 'utf8', timeout: 1_800_000, env: { ...process.env, GH_PROMPT_DISABLED: '1' },
      });
      release = readRelease(repository, releaseId);
      const observed = release.assets.filter((candidate) => candidate.name === asset.name);
      if (observed.length !== 1 || observed[0].size !== asset.size || observed[0].digest !== asset.digest) {
        fail(`Upload outcome for ${asset.name} is unknown or conflicting; no retry is allowed.`);
      }
      if (result.error || result.status !== 0) {
        fail(`Upload for ${asset.name} returned failure after owner-authoritative readback.`);
      }
      completed.push(asset);
    }
  }

  release = readRelease(repository, releaseId);
  assertRelease(release, { releaseId, tag, target });
  if (values.apply) assertExpectedState(release, base, completed);
  const finalPlan = buildAppendPlan(release, assets);
  if (values.apply && finalPlan.upload.length !== 0) fail('Stable Desktop append did not reach exact completion.');

  fs.writeFileSync(output, `${JSON.stringify({
    schema: 'opl_app_stable_desktop_asset_append.v1',
    status: values.apply ? 'complete' : 'planned',
    release: { id: releaseId, tag, target_commitish: target, draft: false, prerelease: false },
    assets: assets.map(({ source_path: _sourcePath, ...asset }) => asset),
    upload: finalPlan.upload.map(({ source_path: _sourcePath, ...asset }) => asset),
    remaining: values.apply ? [] : finalPlan.upload.map((asset) => asset.name),
  }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
