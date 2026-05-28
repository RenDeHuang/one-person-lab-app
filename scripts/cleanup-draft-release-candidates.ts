#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
  execute: boolean;
  summaryPath: string;
};

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    repo: process.env.OPL_RELEASE_REPO || 'gaofeng21cn/one-person-lab-app',
    version: process.env.OPL_RELEASE_VERSION || '',
    execute: false,
    summaryPath: process.env.OPL_DRAFT_CLEANUP_SUMMARY_PATH || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--execute') {
      parsed.execute = true;
      continue;
    }
    if (token === '--dry-run') {
      parsed.execute = false;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    index += 1;
    if (token === '--repo') parsed.repo = value;
    else if (token === '--version') parsed.version = value;
    else if (token === '--summary-path') parsed.summaryPath = path.resolve(value);
    else throw new Error(`Unknown argument: ${token}`);
  }

  if (!/^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/.test(parsed.version)) {
    throw new Error(`Invalid OPL release version: ${parsed.version}`);
  }
  return parsed;
}

function run(command: string, args: string[], options: { capture?: boolean } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\nstdout=${result.stdout || ''}\nstderr=${result.stderr || ''}` : '';
    throw new Error(`Command failed: ${command} ${args.join(' ')}${detail}`);
  }
  return result;
}

function releaseTag(release: ReleaseView) {
  return release.tag_name || release.tagName || '';
}

function releaseDraft(release: ReleaseView) {
  return release.draft ?? release.isDraft ?? false;
}

function releasePrerelease(release: ReleaseView) {
  return release.prerelease ?? release.isPrerelease ?? false;
}

function readStableRelease(options: Options) {
  const tag = `v${options.version}`;
  const result = run('gh', [
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
    throw new Error(`${tag} must be a published stable release before draft candidates can be cleaned up.`);
  }
  return release;
}

function readAllReleases(options: Options) {
  const result = run('gh', [
    'api',
    `repos/${options.repo}/releases`,
    '--paginate',
    '--jq',
    '.[] | {id,tag_name,name,draft,prerelease,created_at,published_at,html_url,assets:[.assets[]? | {name,size}]}',
  ], { capture: true });
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ReleaseView);
}

function candidateTagPattern(version: string) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^v${escaped}-(draft|readiness)\\.\\d{14}$`);
}

function selectCandidates(releases: ReleaseView[], version: string) {
  const pattern = candidateTagPattern(version);
  return releases
    .filter((release) => releaseDraft(release))
    .filter((release) => pattern.test(releaseTag(release)))
    .sort((left, right) => releaseTag(left).localeCompare(releaseTag(right)));
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
    asset_size_bytes: assets.reduce((total, asset) => total + (Number.isFinite(asset.size) ? Number(asset.size) : 0), 0),
    assets: assets.map((asset) => ({ name: asset.name ?? '', size: asset.size ?? 0 })),
  };
}

function writeSummary(summaryPath: string, payload: unknown) {
  if (!summaryPath) {
    return;
  }
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function cleanup(options: Options) {
  const stable = readStableRelease(options);
  const releases = readAllReleases(options);
  const candidates = selectCandidates(releases, options.version).map(summarizeCandidate);
  const deletedTags: string[] = [];

  if (options.execute) {
    for (const candidate of candidates) {
      run('gh', [
        'release',
        'delete',
        candidate.tag_name,
        '--repo',
        options.repo,
        '--cleanup-tag',
        '--yes',
      ]);
      deletedTags.push(candidate.tag_name);
    }
  }

  const summary = {
    schema: 'opl_release_draft_candidate_cleanup.v1',
    status: options.execute ? 'deleted' : 'dry_run',
    repo: options.repo,
    version: options.version,
    stable_release: {
      tag_name: releaseTag(stable),
      name: stable.name ?? '',
      published_at: stable.publishedAt ?? stable.published_at ?? null,
    },
    execute: options.execute,
    candidate_count: candidates.length,
    candidates,
    deleted_tags: deletedTags,
  };
  writeSummary(options.summaryPath, summary);
  console.log(JSON.stringify(summary, null, 2));
}

try {
  cleanup(parseArgs(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
