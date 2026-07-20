#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export type AppReleaseChannel = 'stable' | 'nightly';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseContract = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
);

function contractPattern(name: 'stable_version_pattern' | 'nightly_version_pattern'): string {
  const value = releaseContract?.github_release_name?.[name];
  if (typeof value !== 'string' || !value.startsWith('^') || !value.endsWith('$')) {
    throw new Error(`App release contract is missing an anchored github_release_name.${name}.`);
  }
  return value;
}

export const stableReleaseVersionPatternSource = contractPattern('stable_version_pattern');
export const nightlyReleaseVersionPatternSource = contractPattern('nightly_version_pattern');
export const stableReleaseVersionPattern = new RegExp(stableReleaseVersionPatternSource);
export const nightlyReleaseVersionPattern = new RegExp(nightlyReleaseVersionPatternSource);

function contractNightlyMaximumRebuildRevision(): number {
  const value = releaseContract?.nightly_standard?.same_day_rebuild?.maximum_revision;
  if (!Number.isInteger(value) || value < 1 || value > 9) {
    throw new Error('App release contract must set nightly_standard.same_day_rebuild.maximum_revision from 1 through 9.');
  }
  return value;
}

export const nightlyMaximumRebuildRevision = contractNightlyMaximumRebuildRevision();

export function releaseVersionPattern(channel: AppReleaseChannel): RegExp {
  return channel === 'stable' ? stableReleaseVersionPattern : nightlyReleaseVersionPattern;
}

export function releaseVersionPatternSource(channel: AppReleaseChannel): string {
  return channel === 'stable' ? stableReleaseVersionPatternSource : nightlyReleaseVersionPatternSource;
}

export function matchesCanonicalReleaseVersion(channel: AppReleaseChannel, version: string): boolean {
  return releaseVersionPattern(channel).test(version);
}

export function releaseCalendarParts(channel: AppReleaseChannel, version: string): {
  year: number;
  month: number;
  day: number;
} | null {
  if (!matchesCanonicalReleaseVersion(channel, version)) return null;
  const datePart = channel === 'nightly' ? version.slice(0, version.indexOf('-nightly')) : version;
  const [year, month, day] = datePart.split('.').map(Number);
  const date = new Date(Date.UTC(2000 + year, month - 1, day));
  if (
    date.getUTCFullYear() !== 2000 + year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year: 2000 + year, month, day };
}

export function assertCanonicalReleaseVersion(channel: AppReleaseChannel, version: string): void {
  if (!matchesCanonicalReleaseVersion(channel, version)) {
    throw new Error(
      `Invalid ${channel} App release version ${version}; expected canonical regex ${releaseVersionPatternSource(channel)}.`,
    );
  }
  if (!releaseCalendarParts(channel, version)) {
    throw new Error(`Invalid ${channel} App release calendar date in version ${version}.`);
  }
}

export function currentReleaseCalendarDate(
  timeZone = 'Asia/Shanghai',
  now = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (!year || !month || !day) throw new Error(`Unable to resolve current calendar date for ${timeZone}.`);
  return `${year}-${month}-${day}`;
}

export function assertReleaseVersionNotFuture(
  channel: AppReleaseChannel,
  version: string,
  currentDate = currentReleaseCalendarDate(),
): void {
  assertCanonicalReleaseVersion(channel, version);
  const releaseParts = releaseCalendarParts(channel, version)!;
  const currentMatch = currentDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!currentMatch) throw new Error(`Current release date must use YYYY-MM-DD, got ${currentDate || '<empty>'}.`);
  const current = new Date(Date.UTC(
    Number(currentMatch[1]),
    Number(currentMatch[2]) - 1,
    Number(currentMatch[3]),
  ));
  if (
    current.getUTCFullYear() !== Number(currentMatch[1])
    || current.getUTCMonth() + 1 !== Number(currentMatch[2])
    || current.getUTCDate() !== Number(currentMatch[3])
  ) throw new Error(`Current release date is not a valid calendar date: ${currentDate}.`);

  const releaseOrdinal = releaseParts.year * 10_000 + releaseParts.month * 100 + releaseParts.day;
  const currentOrdinal = current.getUTCFullYear() * 10_000
    + (current.getUTCMonth() + 1) * 100
    + current.getUTCDate();
  if (releaseOrdinal > currentOrdinal) {
    throw new Error(
      `${channel === 'stable' ? 'Stable' : 'Nightly'} version ${version} is future-dated for `
      + `Asia/Shanghai ${currentDate}; use today's version or wait for that calendar date.`,
    );
  }
}

export type NightlyVersionResolution = {
  baseVersion: string;
  version: string;
  rebuildRevision: number | null;
  observedSameDayVersions: string[];
};

function normalizeReleaseRef(rawRef: string): string {
  const token = rawRef.trim().split(/\s+/).at(-1) ?? '';
  return token
    .replace(/^refs\/tags\//, '')
    .replace(/\^\{\}$/, '')
    .replace(/^v/, '');
}

export function resolveNightlyReleaseVersion(
  baseVersion: string,
  existingRefs: Iterable<string>,
): NightlyVersionResolution {
  assertReleaseVersionNotFuture('nightly', baseVersion);
  if (!baseVersion.endsWith('-nightly')) {
    throw new Error(`Nightly base version must not include a rebuild suffix: ${baseVersion}.`);
  }

  const escapedBase = baseVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const canonicalPattern = new RegExp(`^${escapedBase}(?:\\.r([1-9][0-9]*))?$`);
  const legacyRunIdentityPattern = new RegExp(`^${escapedBase}\\.[1-9][0-9]*\\.[1-9][0-9]*$`);
  const observed = new Set<string>();
  let highestRevision = 0;

  for (const rawRef of existingRefs) {
    const version = normalizeReleaseRef(rawRef);
    const canonicalMatch = canonicalPattern.exec(version);
    if (canonicalMatch) {
      observed.add(version);
      if (canonicalMatch[1]) {
        highestRevision = Math.max(highestRevision, Number(canonicalMatch[1]));
      }
      continue;
    }
    if (legacyRunIdentityPattern.test(version)) {
      observed.add(version);
    }
  }

  if (observed.size === 0) {
    return {
      baseVersion,
      version: baseVersion,
      rebuildRevision: null,
      observedSameDayVersions: [],
    };
  }

  const rebuildRevision = highestRevision + 1;
  if (rebuildRevision > nightlyMaximumRebuildRevision) {
    throw new Error(
      `Nightly ${baseVersion} already reached .r${highestRevision}; `
      + `same-day rebuilds stop at .r${nightlyMaximumRebuildRevision} to preserve SemVer ordering.`,
    );
  }

  return {
    baseVersion,
    version: `${baseVersion}.r${rebuildRevision}`,
    rebuildRevision,
    observedSameDayVersions: [...observed].sort(),
  };
}

function main(): void {
  const { values } = parseArgs({
    options: {
      channel: { type: 'string' },
      version: { type: 'string' },
      json: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.channel !== 'stable' && values.channel !== 'nightly') {
    throw new Error('Pass --channel stable or --channel nightly.');
  }
  const version = values.version?.trim() ?? '';
  if (!version) throw new Error('Pass --version <version>.');
  assertReleaseVersionNotFuture(values.channel, version);
  const payload = {
    channel: values.channel,
    version,
    pattern: releaseVersionPatternSource(values.channel),
    calendar_date: releaseCalendarParts(values.channel, version),
    status: 'passed',
  };
  process.stdout.write(
    values.json
      ? `${JSON.stringify(payload)}\n`
      : `${values.channel} App release version ${version} is canonical and not future-dated.\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
