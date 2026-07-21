import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  assertReleaseVersionNotFuture,
  matchesCanonicalReleaseVersion,
  releaseCalendarParts,
  stableReleaseRevision,
} from './release-version.ts';

export type PublishedLatestRelease = {
  tagName: string;
  isDraft: boolean;
  isPrerelease: boolean;
};

export type PublishedRelease = {
  tagName?: string;
  tag_name?: string;
  isDraft?: boolean;
  draft?: boolean;
  isPrerelease?: boolean;
  prerelease?: boolean;
};

function stableVersionTuple(value: string): [number, number, number, number] {
  const normalized = value.trim().replace(/^v/, '');
  if (!matchesCanonicalReleaseVersion('stable', normalized)) {
    throw new Error(`Stable version must use YY.M.D or YY.M.D-r1 through r9, got ${value || '<empty>'}.`);
  }
  const calendar = releaseCalendarParts('stable', normalized);
  if (!calendar) {
    throw new Error(`Stable version is not a valid calendar date: ${value}.`);
  }
  return [calendar.year - 2000, calendar.month, calendar.day, stableReleaseRevision(normalized)];
}

export function compareStableReleaseVersions(left: string, right: string): number {
  const leftTuple = stableVersionTuple(left);
  const rightTuple = stableVersionTuple(right);
  for (let index = 0; index < leftTuple.length; index += 1) {
    if (leftTuple[index] !== rightTuple[index]) return leftTuple[index]! - rightTuple[index]!;
  }
  return 0;
}

export function assertPromotionTargetIsNewerThanLatest(
  targetVersion: string,
  latest: PublishedLatestRelease,
  referenceLabel = 'current Latest',
): void {
  assertReleaseVersionNotFuture('stable', targetVersion.replace(/^v/, ''));
  if (!latest || typeof latest !== 'object') throw new Error('Current GitHub Latest readback is missing.');
  if (latest.isDraft || latest.isPrerelease) {
    throw new Error('Current GitHub Latest must be a published non-prerelease Stable release.');
  }
  const comparison = compareStableReleaseVersions(targetVersion, latest.tagName);
  if (comparison < 0) {
    throw new Error(
      `Promotion target v${targetVersion.replace(/^v/, '')} is older than ${referenceLabel} ${latest.tagName}; ` +
        'Stable downgrade is forbidden.',
    );
  }
  if (comparison === 0) {
    const equalLabel = referenceLabel === 'current Latest' ? 'GitHub Latest' : referenceLabel;
    throw new Error(
      `Promotion target v${targetVersion.replace(/^v/, '')} is already ${equalLabel}; ` +
        'reconcile existing public truth instead of dispatching another promotion.',
    );
  }
}

function normalizedPublishedStable(release: PublishedRelease): PublishedLatestRelease | null {
  const tagName = release.tagName ?? release.tag_name ?? '';
  if (!/^v/.test(tagName) || !matchesCanonicalReleaseVersion('stable', tagName.slice(1))) return null;
  const isDraft = release.isDraft ?? release.draft;
  const isPrerelease = release.isPrerelease ?? release.prerelease;
  if (typeof isDraft !== 'boolean' || typeof isPrerelease !== 'boolean') {
    throw new Error(`Published Stable readback for ${tagName} is missing draft/prerelease state.`);
  }
  if (isDraft || isPrerelease) return null;
  return { tagName, isDraft, isPrerelease };
}

export function highestPublishedStableRelease(releases: PublishedRelease[]): PublishedLatestRelease {
  const stable = releases
    .map(normalizedPublishedStable)
    .filter((release): release is PublishedLatestRelease => release !== null)
    .sort((left, right) => compareStableReleaseVersions(right.tagName, left.tagName));
  if (stable.length === 0) throw new Error('No published non-prerelease Stable release was found.');
  return stable[0]!;
}

export function assertPromotionTargetIsNewerThanPublishedStable(
  targetVersion: string,
  releases: PublishedRelease[],
): PublishedLatestRelease {
  const highest = highestPublishedStableRelease(releases);
  assertPromotionTargetIsNewerThanLatest(targetVersion, highest, 'highest published Stable');
  return highest;
}

function cli(): void {
  const args = process.argv.slice(2);
  const targetIndex = args.indexOf('--target');
  const latestJsonIndex = args.indexOf('--latest-json');
  const publishedReleasesJsonIndex = args.indexOf('--published-releases-json');
  const target = targetIndex >= 0 ? args[targetIndex + 1] : undefined;
  const latestJsonPath = latestJsonIndex >= 0 ? args[latestJsonIndex + 1] : undefined;
  const publishedReleasesJsonPath = publishedReleasesJsonIndex >= 0
    ? args[publishedReleasesJsonIndex + 1]
    : undefined;
  if (!target || (!latestJsonPath && !publishedReleasesJsonPath)) {
    throw new Error(
      'Usage: stable-release-version-order.ts --target <YY.M.D[-rN]> '
      + '(--published-releases-json <path> | --latest-json <path>)',
    );
  }
  if (publishedReleasesJsonPath) {
    const parsed = JSON.parse(fs.readFileSync(publishedReleasesJsonPath, 'utf8')) as unknown;
    const releases = (Array.isArray(parsed) ? parsed.flat() : []) as PublishedRelease[];
    const highest = assertPromotionTargetIsNewerThanPublishedStable(target, releases);
    process.stdout.write(`${JSON.stringify({
      status: 'allowed',
      target,
      highest_published_stable: highest.tagName,
    })}\n`);
    return;
  }
  const latest = JSON.parse(fs.readFileSync(latestJsonPath!, 'utf8')) as PublishedLatestRelease;
  assertPromotionTargetIsNewerThanLatest(target, latest);
  process.stdout.write(`${JSON.stringify({ status: 'allowed', target, latest: latest.tagName })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
