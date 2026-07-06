#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { emitJsonSummary, parseJsonLines, runCleanupScript, runGh } from './release-cleanup-helpers.ts';

type GhcrVersion = {
  id?: number;
  name?: string;
  updated_at?: string;
  html_url?: string;
  metadata?: {
    container?: {
      tags?: string[];
    };
  };
};

type Options = {
  owner: string;
  packageName: string;
  execute: boolean;
  summaryPath: string;
  rollbackTags: string[];
};

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseContract = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
);

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    owner: process.env.OPL_GHCR_OWNER || 'gaofeng21cn',
    packageName: process.env.OPL_WEBUI_GHCR_PACKAGE || 'one-person-lab-webui',
    execute: false,
    summaryPath: process.env.OPL_WEBUI_GHCR_CLEANUP_SUMMARY_PATH || '',
    rollbackTags: [],
  };

  const { values, tokens } = parseNodeArgs({
    args: argv,
    options: {
      owner: { type: 'string' },
      package: { type: 'string' },
      'summary-path': { type: 'string' },
      'rollback-tag': { type: 'string', multiple: true },
      execute: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
    tokens: true,
  });
  parsed.owner = values.owner ?? parsed.owner;
  parsed.packageName = values.package ?? parsed.packageName;
  parsed.summaryPath = values['summary-path'] ? path.resolve(values['summary-path']) : parsed.summaryPath;
  parsed.rollbackTags = values['rollback-tag'] ?? parsed.rollbackTags;
  for (const token of tokens) {
    if (token.kind !== 'option') continue;
    if (token.name === 'execute') parsed.execute = true;
    if (token.name === 'dry-run') parsed.execute = false;
  }

  return parsed;
}

function encodedPackageName(packageName: string) {
  return packageName.replaceAll('/', '%2F');
}

function readPackageVersions(options: Options) {
  const result = runGh([
    'api',
    '-H',
    'X-GitHub-Api-Version: 2022-11-28',
    `/users/${options.owner}/packages/container/${encodedPackageName(options.packageName)}/versions?per_page=100`,
    '--paginate',
    '--jq',
    '.[] | @json',
  ], { capture: true });
  return parseJsonLines<GhcrVersion>(result.stdout);
}

function versionTags(version: GhcrVersion) {
  return version.metadata?.container?.tags ?? [];
}

function isNightly(tags: string[]) {
  return tags.some((tag) => tag.endsWith('-nightly'));
}

function isStable(tags: string[]) {
  return tags.some((tag) => /^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$/.test(tag) && !tag.includes('nightly'));
}

function sortRecentFirst(versions: GhcrVersion[]) {
  return [...versions].sort((left, right) =>
    String(right.updated_at ?? '').localeCompare(String(left.updated_at ?? '')),
  );
}

function selectedIds(versions: GhcrVersion[]) {
  return new Set(versions.map((version) => version.id).filter((id): id is number => Number.isFinite(id)));
}

function summarizeVersion(version: GhcrVersion) {
  return {
    id: version.id ?? null,
    tags: versionTags(version),
    updated_at: version.updated_at ?? null,
    html_url: version.html_url ?? null,
  };
}

function cleanup(options: Options) {
  const policy = releaseContract.webui_ghcr_image.retention_policy;
  if (policy.cleanup_execution_mode !== 'dry_run_first_explicit_execute_required') {
    throw new Error('WebUI GHCR cleanup policy must remain dry-run first.');
  }

  const versions = readPackageVersions(options);
  const protectedTags = new Set<string>([...policy.protected_tags, ...options.rollbackTags]);
  const protectedIds = selectedIds(versions.filter((version) =>
    versionTags(version).some((tag) => protectedTags.has(tag)),
  ));
  const retainedStableIds = selectedIds(
    sortRecentFirst(versions.filter((version) =>
      !protectedIds.has(version.id as number) && isStable(versionTags(version)),
    ))
      .slice(0, policy.retain_stable_versions),
  );
  const retainedNightlyIds = selectedIds(
    sortRecentFirst(versions.filter((version) =>
      !protectedIds.has(version.id as number) && isNightly(versionTags(version)),
    ))
      .slice(0, policy.retain_nightly_versions),
  );

  const candidates = versions
    .filter((version) => Number.isFinite(version.id))
    .filter((version) => !protectedIds.has(version.id as number))
    .filter((version) => !retainedStableIds.has(version.id as number))
    .filter((version) => !retainedNightlyIds.has(version.id as number))
    .map(summarizeVersion);

  const deletedVersionIds: number[] = [];
  if (options.execute) {
    for (const candidate of candidates) {
      if (!candidate.id) continue;
      runGh([
        'api',
        '-X',
        'DELETE',
        '-H',
        'X-GitHub-Api-Version: 2022-11-28',
        `/users/${options.owner}/packages/container/${encodedPackageName(options.packageName)}/versions/${candidate.id}`,
      ]);
      deletedVersionIds.push(candidate.id);
    }
  }

  const summary = {
    schema: 'opl_webui_ghcr_cleanup.v1',
    status: options.execute ? 'deleted' : 'dry_run',
    owner: options.owner,
    package: options.packageName,
    execute: options.execute,
    retention_policy: policy,
    rollback_tags: options.rollbackTags,
    version_count: versions.length,
    protected_version_ids: [...protectedIds].sort((left, right) => left - right),
    retained_stable_version_ids: [...retainedStableIds].sort((left, right) => left - right),
    retained_nightly_version_ids: [...retainedNightlyIds].sort((left, right) => left - right),
    candidate_count: candidates.length,
    candidates,
    deleted_version_ids: deletedVersionIds,
  };
  emitJsonSummary(options.summaryPath, summary);
}

runCleanupScript((argv) => {
  cleanup(parseArgs(argv));
});
