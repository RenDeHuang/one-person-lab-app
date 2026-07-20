#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

type ReleaseAsset = {
  name?: string;
  url?: string;
  digest?: string;
  size?: number;
  contentType?: string;
};

function options(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      version: { type: 'string' },
      'source-commit': { type: 'string' },
      'release-json': { type: 'string' },
      output: { type: 'string' },
      repo: { type: 'string', default: 'gaofeng21cn/one-person-lab-app' },
    },
    strict: true,
  });
  const version = values.version?.trim() ?? '';
  const sourceCommit = values['source-commit']?.trim() ?? '';
  if (!/^\d{2}\.\d{1,2}\.\d{1,2}(?:-nightly(?:\.r[1-9][0-9]*)?)?$/.test(version)
    || !/^[0-9a-f]{40}$/.test(sourceCommit)
    || !values['release-json']
    || !values.output) {
    throw new Error('Pass --version <YY.M.D> --source-commit <sha> --release-json <json> --output <json>.');
  }
  return {
    version,
    sourceCommit,
    releaseJson: path.resolve(values['release-json']),
    output: path.resolve(values.output),
    repo: values.repo?.trim() ?? 'gaofeng21cn/one-person-lab-app',
  };
}

function normalizeAsset(asset: ReleaseAsset) {
  const name = asset.name?.trim() ?? '';
  const ref = asset.url?.trim() ?? '';
  const digest = asset.digest?.trim() ?? '';
  if (!name || !ref || !/^sha256:[0-9a-f]{64}$/.test(digest) || !Number.isFinite(asset.size) || Number(asset.size) <= 0) {
    throw new Error(`Release asset is not immutable: ${name || 'unnamed'}`);
  }
  return {
    name,
    ref,
    digest,
    size: Number(asset.size),
    content_type: asset.contentType?.trim() || 'application/octet-stream',
  };
}

function main() {
  const input = options(process.argv.slice(2));
  const release = JSON.parse(fs.readFileSync(input.releaseJson, 'utf8')) as Record<string, unknown>;
  const tag = String(release.tagName ?? '');
  const expectedPrerelease = input.version.includes('-nightly');
  if (tag !== `v${input.version}` || release.isPrerelease !== expectedPrerelease) {
    throw new Error(`Release JSON does not describe v${input.version} with the expected channel.`);
  }
  const standardAssetNames = new Set([
    'latest-arm64-mac.yml',
    `One-Person-Lab-${input.version}-mac-arm64.dmg`,
    `One-Person-Lab-${input.version}-mac-arm64.zip`,
    `One-Person-Lab-${input.version}-mac-arm64.zip.blockmap`,
    'standard-local-authorization-policy.json',
  ]);
  const artifacts = (Array.isArray(release.assets) ? release.assets : [])
    .filter((asset: ReleaseAsset) => standardAssetNames.has(asset.name ?? ''))
    .map(normalizeAsset)
    .sort((left, right) => left.name.localeCompare(right.name));
  const primaryArtifact = artifacts.find((asset) => asset.name === `One-Person-Lab-${input.version}-mac-arm64.dmg`);
  if (!primaryArtifact) throw new Error(`Release v${input.version} has no canonical mac-arm64 DMG.`);
  if (artifacts.length !== standardAssetNames.size) throw new Error(`Release v${input.version} is missing standard App assets.`);
  const core = {
    surface_kind: 'opl_app_component_manifest.v1',
    component_id: 'opl-app',
    version: input.version,
    source_commit: input.sourceCommit,
    release_tag: tag,
    release_url: String(release.url ?? ''),
    primary_artifact: primaryArtifact,
    artifacts,
    component_manifest_ref: `https://github.com/${input.repo}/releases/download/${tag}/opl-app-component-manifest.json`,
  };
  const component = {
    ...core,
    component_manifest_digest: `sha256:${crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex')}`,
  };
  fs.mkdirSync(path.dirname(input.output), { recursive: true });
  fs.writeFileSync(input.output, `${JSON.stringify(component, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ status: 'written', output: input.output, component_manifest_digest: component.component_manifest_digest })}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
