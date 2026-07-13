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
  const datePart = channel === 'nightly' ? version.slice(0, version.indexOf('-nightly.')) : version;
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
  assertCanonicalReleaseVersion(values.channel, version);
  const payload = {
    channel: values.channel,
    version,
    pattern: releaseVersionPatternSource(values.channel),
    calendar_date: releaseCalendarParts(values.channel, version),
    status: 'passed',
  };
  process.stdout.write(values.json ? `${JSON.stringify(payload)}\n` : `${values.channel} App release version ${version} is canonical.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
