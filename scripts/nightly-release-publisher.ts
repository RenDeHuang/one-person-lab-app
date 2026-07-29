#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { sha256File } from './build-artifact-cohort.ts';
import {
  assertNightlyRequestDigest,
  type NightlyReleaseRequest,
} from './resolve-nightly-release-request.ts';
import type { NightlyQualificationReceipt } from './nightly-release-qualification.ts';

type RemoteAsset = {
  id: number;
  name: string;
  size: number;
  digest: string | null;
};

export type NightlyRemoteRelease = {
  id: number;
  tag_name: string;
  target_commitish: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  assets: RemoteAsset[];
};

export interface NightlyRemote {
  inspectRelease(tag: string): NightlyRemoteRelease | null;
  inspectLatestTag(): string | null;
  createDraft(input: {
    tag: string;
    targetCommitish: string;
    name: string;
    body: string;
  }): void;
  uploadAsset(releaseId: number, filePath: string, name: string): void;
  publishRelease(releaseId: number, name: string, body: string): void;
}

const releaseRepo = 'gaofeng21cn/one-person-lab-app';
const digestPattern = /^[0-9a-f]{64}$/;

function runGh(args: string[], allow404 = false): string {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 30 * 60 * 1000,
  });
  if (result.status === 0) return result.stdout;
  if (allow404 && /(?:HTTP 404|Not Found)/i.test(`${result.stderr}\n${result.stdout}`)) return '';
  throw new Error(`gh ${args.slice(0, 3).join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
}

function withJsonInput(value: unknown, run: (inputPath: string) => void): void {
  const root = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'opl-nightly-gh-'));
  const input = path.join(root, 'input.json');
  try {
    fs.writeFileSync(input, `${JSON.stringify(value)}\n`, { mode: 0o600 });
    run(input);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function normalizeRelease(value: any): NightlyRemoteRelease {
  return {
    id: Number(value.id),
    tag_name: String(value.tag_name),
    target_commitish: String(value.target_commitish),
    name: String(value.name ?? ''),
    body: String(value.body ?? ''),
    draft: value.draft === true,
    prerelease: value.prerelease === true,
    html_url: String(value.html_url ?? ''),
    assets: Array.isArray(value.assets)
      ? value.assets.map((asset: any) => ({
          id: Number(asset.id),
          name: String(asset.name),
          size: Number(asset.size),
          digest: typeof asset.digest === 'string' ? asset.digest : null,
        }))
      : [],
  };
}

export class GhNightlyRemote implements NightlyRemote {
  readonly repo: string;
  private readonly executeGh: typeof runGh;

  constructor(repo = releaseRepo, executeGh: typeof runGh = runGh) {
    if (repo !== releaseRepo) throw new Error(`Nightly publisher is fixed to ${releaseRepo}.`);
    this.repo = repo;
    this.executeGh = executeGh;
  }

  inspectRelease(tag: string): NightlyRemoteRelease | null {
    const output = this.executeGh(['api', `repos/${this.repo}/releases/tags/${tag}`], true);
    if (output) return normalizeRelease(JSON.parse(output));

    const pageOutput = this.executeGh([
      'api',
      '--paginate',
      '--jq',
      `[.[] | select(.tag_name == ${JSON.stringify(tag)})]`,
      `repos/${this.repo}/releases?per_page=100`,
    ]);
    const matches = pageOutput.trim() === ''
      ? []
      : pageOutput.trim().split(/\r?\n/).flatMap((line) => {
        const page = JSON.parse(line) as unknown;
        if (!Array.isArray(page)) {
          throw new Error('GitHub paginated Nightly release response page must be an array.');
        }
        return page;
      });
    if (matches.length > 1) {
      throw new Error(`GitHub release list contains multiple Releases for Nightly tag ${tag}.`);
    }
    return matches.length === 1 ? normalizeRelease(matches[0]) : null;
  }

  inspectLatestTag(): string | null {
    const output = this.executeGh(['api', `repos/${this.repo}/releases/latest`], true);
    return output ? String(JSON.parse(output).tag_name ?? '') || null : null;
  }

  createDraft(input: { tag: string; targetCommitish: string; name: string; body: string }): void {
    withJsonInput({
      tag_name: input.tag,
      target_commitish: input.targetCommitish,
      name: input.name,
      body: input.body,
      draft: true,
      prerelease: true,
      make_latest: 'false',
    }, (inputPath) => {
      this.executeGh(['api', '--method', 'POST', `repos/${this.repo}/releases`, '--input', inputPath]);
    });
  }

  uploadAsset(releaseId: number, filePath: string, name: string): void {
    this.executeGh([
      'api',
      '--method', 'POST',
      '-H', 'Content-Type: application/octet-stream',
      `https://uploads.github.com/repos/${this.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,
      '--input', filePath,
    ]);
  }

  publishRelease(releaseId: number, name: string, body: string): void {
    withJsonInput({
      name,
      body,
      draft: false,
      prerelease: true,
      make_latest: 'false',
    }, (inputPath) => {
      this.executeGh(['api', '--method', 'PATCH', `repos/${this.repo}/releases/${releaseId}`, '--input', inputPath]);
    });
  }
}

function assetMatches(remote: RemoteAsset, expected: { name: string; size_bytes: number; sha256: string }): boolean {
  return remote.name === expected.name
    && remote.size === expected.size_bytes
    && remote.digest === `sha256:${expected.sha256}`;
}

function assertReleaseIdentity(
  release: NightlyRemoteRelease,
  request: NightlyReleaseRequest,
  name: string,
  body: string,
): void {
  if (
    release.tag_name !== request.tag
    || release.target_commitish !== request.source.app_sha
    || release.name !== name
    || release.body !== body
    || release.prerelease !== true
  ) {
    throw new Error(`Existing Nightly release ${request.tag} conflicts with the frozen request.`);
  }
}

function assertExactRemoteAssets(
  release: NightlyRemoteRelease,
  expected: Array<{ name: string; size_bytes: number; sha256: string }>,
  requireComplete: boolean,
): void {
  const expectedNames = expected.map((asset) => asset.name).sort();
  const observedNames = release.assets.map((asset) => asset.name).sort();
  if (release.assets.some((asset) => !expectedNames.includes(asset.name))) {
    throw new Error(`Nightly release ${release.tag_name} contains an unexpected public asset.`);
  }
  if (requireComplete && JSON.stringify(observedNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`Nightly release ${release.tag_name} does not contain the exact qualified asset set.`);
  }
  for (const asset of expected) {
    const matches = release.assets.filter((remoteAsset) => remoteAsset.name === asset.name);
    if (matches.length > 1 || (requireComplete && (matches.length !== 1 || !assetMatches(matches[0]!, asset)))) {
      throw new Error(`Nightly release ${release.tag_name} has conflicting asset ${asset.name}.`);
    }
  }
}

function exactLocalAssets(
  assetsDir: string,
  qualification: NightlyQualificationReceipt,
): Array<{ name: string; size_bytes: number; sha256: string; path: string }> {
  const expectedNames = qualification.assets.map((asset) => asset.name).sort();
  const observedNames = fs.readdirSync(assetsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== 'standard-local-authorization-policy.json')
    .map((entry) => entry.name)
    .sort();
  if (JSON.stringify(expectedNames) !== JSON.stringify(observedNames)) {
    throw new Error('Nightly publisher asset directory differs from the qualified public asset set.');
  }
  return qualification.assets.map((asset) => {
    const filePath = path.join(assetsDir, asset.name);
    const size = fs.statSync(filePath).size;
    const digest = sha256File(filePath);
    if (size !== asset.size_bytes || digest !== asset.sha256 || !digestPattern.test(digest)) {
      throw new Error(`Nightly asset changed after qualification: ${asset.name}.`);
    }
    return { ...asset, path: filePath };
  });
}

function inspectUpToThree<T>(
  inspect: () => T,
  matches: (value: T) => boolean,
): { matched: true; value: T } | { matched: false } {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const value = inspect();
      if (matches(value)) return { matched: true, value };
    } catch {
      // A mutation with an unknown result permits only bounded read-only inspection.
    }
  }
  return { matched: false };
}

function mutateOnceThenRead<T>(input: {
  label: string;
  mutate: () => void;
  inspect: () => T;
  matches: (value: T) => boolean;
}): T {
  let mutationError: unknown;
  try {
    input.mutate();
  } catch (error) {
    mutationError = error;
  }
  const observed = inspectUpToThree(input.inspect, input.matches);
  if (observed.matched) return observed.value;
  if (mutationError) {
    throw new Error(
      `${input.label} outcome is unknown after three read-only inspections; mutation was not retried.`,
      { cause: mutationError },
    );
  }
  throw new Error(`${input.label} did not reach its exact postcondition.`);
}

export function publishNightlyRelease(input: {
  request: NightlyReleaseRequest;
  qualification: NightlyQualificationReceipt;
  assetsDir: string;
  notes: string;
  remote: NightlyRemote;
}) {
  const { request, qualification, remote } = input;
  assertNightlyRequestDigest(request);
  if (
    qualification.schema !== 'opl_standard_nightly_qualification.v1'
    || qualification.status !== 'passed'
    || qualification.request_digest !== request.request_digest
    || qualification.include_full !== false
    || qualification.stable_qualified !== false
    || qualification.heavy_vm_required !== false
    || qualification.full_assets_present !== false
    || qualification.webui_assets_present !== false
  ) {
    throw new Error('Nightly publication requires an exact passed Standard-only qualification receipt.');
  }
  const assets = exactLocalAssets(input.assetsDir, qualification);
  const releaseName = `One Person Lab ${request.tag}`;
  const latestBefore = remote.inspectLatestTag();
  let release = remote.inspectRelease(request.tag);
  const initiallyComplete = Boolean(release && !release.draft);

  if (!release) {
    release = mutateOnceThenRead({
      label: `Create Nightly draft ${request.tag}`,
      mutate: () => remote.createDraft({
        tag: request.tag,
        targetCommitish: request.source.app_sha,
        name: releaseName,
        body: input.notes,
      }),
      inspect: () => remote.inspectRelease(request.tag),
      matches: (value) => value !== null,
    });
  }
  assertReleaseIdentity(release, request, releaseName, input.notes);
  assertExactRemoteAssets(release, assets, !release.draft);

  if (!release.draft) {
    for (const asset of assets) {
      const matches = release.assets.filter((remoteAsset) => remoteAsset.name === asset.name);
      if (matches.length !== 1 || !assetMatches(matches[0]!, asset)) {
        throw new Error(`Published Nightly release has missing or conflicting asset ${asset.name}.`);
      }
    }
  } else {
    for (const asset of assets) {
      const matches = release.assets.filter((remoteAsset) => remoteAsset.name === asset.name);
      if (matches.length > 1 || (matches.length === 1 && !assetMatches(matches[0]!, asset))) {
        throw new Error(`Nightly draft has conflicting asset bytes for ${asset.name}.`);
      }
      if (matches.length === 1) continue;
      release = mutateOnceThenRead({
        label: `Upload Nightly asset ${asset.name}`,
        mutate: () => remote.uploadAsset(release!.id, asset.path, asset.name),
        inspect: () => remote.inspectRelease(request.tag),
        matches: (value) => {
          const reconciled = value?.assets.filter((remoteAsset) => remoteAsset.name === asset.name) ?? [];
          return reconciled.length === 1 && assetMatches(reconciled[0]!, asset);
        },
      });
    }
    release = mutateOnceThenRead({
      label: `Publish Nightly prerelease ${request.tag}`,
      mutate: () => remote.publishRelease(release!.id, releaseName, input.notes),
      inspect: () => remote.inspectRelease(request.tag),
      matches: (value) => Boolean(value && !value.draft && value.prerelease),
    });
    assertReleaseIdentity(release, request, releaseName, input.notes);
  }

  const latestAfter = remote.inspectLatestTag();
  if (latestAfter !== latestBefore) throw new Error('Nightly publication changed GitHub Latest.');
  assertExactRemoteAssets(release, assets, true);
  for (const asset of assets) {
    const matches = release.assets.filter((remoteAsset) => remoteAsset.name === asset.name);
    if (matches.length !== 1 || !assetMatches(matches[0]!, asset)) {
      throw new Error(`Nightly public readback does not match ${asset.name}.`);
    }
  }
  const assetUrl = (name: string) =>
    `https://github.com/${releaseRepo}/releases/download/${request.tag}/${encodeURIComponent(name)}`;
  return {
    schema: 'opl_standard_nightly_publication_receipt.v1',
    status: initiallyComplete ? 'already_complete' : 'published',
    repository: releaseRepo,
    request_digest: request.request_digest,
    version: request.version,
    updater_version: request.updater_version,
    tag: request.tag,
    cohort: request.source,
    actions: request.actions,
    include_full: false,
    github_release: {
      id: release.id,
      url: release.html_url,
      draft: false,
      prerelease: true,
      make_latest: false,
      latest_before: latestBefore,
      latest_after: latestAfter,
    },
    assets: assets.map(({ path: _path, ...asset }) => ({ ...asset, url: assetUrl(asset.name) })),
    primary_dmg: {
      ...qualification.primary_dmg,
      url: assetUrl(qualification.primary_dmg.name),
    },
    updater_metadata: {
      ...qualification.updater_metadata,
      url: assetUrl(qualification.updater_metadata.name),
    },
    stable_qualified: false,
    heavy_vm_blocking: false,
    homebrew_modified: false,
    full_modified: false,
    webui_modified: false,
  };
}

function main(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      request: { type: 'string' },
      qualification: { type: 'string' },
      'assets-dir': { type: 'string' },
      notes: { type: 'string' },
      output: { type: 'string' },
      repo: { type: 'string', default: releaseRepo },
    },
    strict: true,
    allowPositionals: false,
  });
  const required = (name: keyof typeof values): string => {
    const value = values[name];
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing --${String(name)}.`);
    return value.trim();
  };
  if (values.repo !== releaseRepo) throw new Error(`Nightly publisher is fixed to ${releaseRepo}.`);
  const requestPath = path.resolve(required('request'));
  const qualificationPath = path.resolve(required('qualification'));
  const assetsDir = path.resolve(required('assets-dir'));
  const notesPath = path.resolve(required('notes'));
  const output = path.resolve(required('output'));
  const receipt = publishNightlyRelease({
    request: JSON.parse(fs.readFileSync(requestPath, 'utf8')),
    qualification: JSON.parse(fs.readFileSync(qualificationPath, 'utf8')),
    assetsDir,
    notes: fs.readFileSync(notesPath, 'utf8'),
    remote: new GhNightlyRemote(),
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
