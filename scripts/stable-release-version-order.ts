import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assertReleaseVersionNotFuture } from './release-version.ts';

export type PublishedLatestRelease = {
  tagName: string;
  isDraft: boolean;
  isPrerelease: boolean;
};

function stableVersionTuple(value: string): [number, number, number] {
  const match = value.trim().match(/^v?(\d{2})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) throw new Error(`Stable version must use YY.M.D, got ${value || '<empty>'}.`);
  const tuple: [number, number, number] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(2000 + tuple[0], tuple[1] - 1, tuple[2]));
  if (
    date.getUTCFullYear() !== 2000 + tuple[0] ||
    date.getUTCMonth() !== tuple[1] - 1 ||
    date.getUTCDate() !== tuple[2]
  ) throw new Error(`Stable version is not a valid calendar date: ${value}.`);
  return tuple;
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
): void {
  assertReleaseVersionNotFuture('stable', targetVersion.replace(/^v/, ''));
  if (!latest || typeof latest !== 'object') throw new Error('Current GitHub Latest readback is missing.');
  if (latest.isDraft || latest.isPrerelease) {
    throw new Error('Current GitHub Latest must be a published non-prerelease Stable release.');
  }
  const comparison = compareStableReleaseVersions(targetVersion, latest.tagName);
  if (comparison < 0) {
    throw new Error(
      `Promotion target v${targetVersion.replace(/^v/, '')} is older than current Latest ${latest.tagName}; ` +
      'Stable downgrade is forbidden.',
    );
  }
  if (comparison === 0) {
    throw new Error(
      `Promotion target v${targetVersion.replace(/^v/, '')} is already GitHub Latest; ` +
      'reconcile existing public truth instead of dispatching another promotion.',
    );
  }
}

function cli(): void {
  const args = process.argv.slice(2);
  const targetIndex = args.indexOf('--target');
  const latestJsonIndex = args.indexOf('--latest-json');
  const target = targetIndex >= 0 ? args[targetIndex + 1] : undefined;
  const latestJsonPath = latestJsonIndex >= 0 ? args[latestJsonIndex + 1] : undefined;
  if (!target || !latestJsonPath) {
    throw new Error('Usage: stable-release-version-order.ts --target <YY.M.D> --latest-json <path>');
  }
  const latest = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8')) as PublishedLatestRelease;
  assertPromotionTargetIsNewerThanLatest(target, latest);
  process.stdout.write(`${JSON.stringify({ status: 'allowed', target, latest: latest.tagName })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
