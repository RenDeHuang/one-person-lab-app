#!/usr/bin/env node

import path from 'node:path';
import { parseArgs as parseNodeArgs } from 'node:util';
import {
  emitJsonSummary,
  parseJsonLines,
  runCleanupScript,
  runGh,
} from './release-cleanup-helpers.ts';

type ReleaseAsset = {
  name?: string;
  size?: number;
};

type ReleaseView = {
  id?: number;
  tagName?: string;
  tag_name?: string;
  name?: string;
  isDraft?: boolean;
  draft?: boolean;
  isPrerelease?: boolean;
  prerelease?: boolean;
  publishedAt?: string | null;
  published_at?: string | null;
  created_at?: string;
  html_url?: string;
  assets?: ReleaseAsset[];
};

type Options = {
  repo: string;
  version: string;
  summaryPath: string;
};

function parseArgs(argv: string[]): Options {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      repo: { type: 'string' },
      version: { type: 'string' },
      'summary-path': { type: 'string' },
    },
    allowPositionals: false,
    strict: true,
  });
  const version = values.version ?? process.env.OPL_RELEASE_VERSION ?? '';
  if (!/^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid OPL release version: ${version}`);
  }
  return {
    repo: values.repo ?? process.env.OPL_RELEASE_REPO ?? 'gaofeng21cn/one-person-lab-app',
    version,
    summaryPath: values['summary-path']
      ? path.resolve(values['summary-path'])
      : process.env.OPL_DRAFT_INSPECTION_SUMMARY_PATH ?? '',
  };
}

function releaseTag(release: ReleaseView): string {
  return release.tag_name || release.tagName || '';
}

function releaseDraft(release: ReleaseView): boolean {
  return release.draft ?? release.isDraft ?? false;
}

function releasePrerelease(release: ReleaseView): boolean {
  return release.prerelease ?? release.isPrerelease ?? false;
}

function readStableRelease(options: Options): ReleaseView {
  const tag = `v${options.version}`;
  const result = runGh([
    'release',
    'view',
    tag,
    '--repo',
    options.repo,
    '--json',
    'tagName,name,isDraft,isPrerelease,publishedAt',
  ], { capture: true });
  const release = JSON.parse(result.stdout) as ReleaseView;
  if (releaseTag(release) !== tag || releaseDraft(release) || releasePrerelease(release)) {
    throw new Error(`${tag} must be a published stable release before draft candidates can be inspected.`);
  }
  return release;
}

function readAllReleases(options: Options): ReleaseView[] {
  const result = runGh([
    'api',
    `repos/${options.repo}/releases`,
    '--paginate',
    '--jq',
    '.[] | {id,tag_name,name,draft,prerelease,created_at,published_at,html_url,assets:[.assets[]? | {name,size}]}',
  ], { capture: true });
  return parseJsonLines<ReleaseView>(result.stdout);
}

function candidateTagPattern(version: string): RegExp {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^v${escaped}-(draft|readiness)\\.\\d{14}$`);
}

function summarizeCandidate(release: ReleaseView) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return {
    id: release.id ?? null,
    tag_name: releaseTag(release),
    name: release.name ?? '',
    created_at: release.created_at ?? '',
    html_url: release.html_url ?? '',
    asset_count: assets.length,
    asset_size_bytes: assets.reduce(
      (total, asset) => total + (Number.isFinite(asset.size) ? Number(asset.size) : 0),
      0,
    ),
    assets: assets.map((asset) => ({ name: asset.name ?? '', size: asset.size ?? 0 })),
  };
}

function inspect(options: Options): void {
  const stable = readStableRelease(options);
  const pattern = candidateTagPattern(options.version);
  const candidates = readAllReleases(options)
    .filter((release) => releaseDraft(release) && pattern.test(releaseTag(release)))
    .sort((left, right) => releaseTag(left).localeCompare(releaseTag(right)))
    .map(summarizeCandidate);

  emitJsonSummary(options.summaryPath, {
    schema: 'opl_release_draft_candidate_inspection.v1',
    status: 'inspected',
    lifecycle: 'historical_read_only',
    repo: options.repo,
    version: options.version,
    stable_release: {
      tag_name: releaseTag(stable),
      name: stable.name ?? '',
      published_at: stable.publishedAt ?? stable.published_at ?? null,
    },
    candidate_count: candidates.length,
    candidates,
    mutation_authorized: false,
    deletion_performed: false,
  });
}

runCleanupScript((argv) => inspect(parseArgs(argv)));
