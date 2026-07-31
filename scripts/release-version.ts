#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export type AppReleaseChannel = 'stable' | 'nightly' | 'preview';
export type ReleaseQualityStatus = 'stable' | 'preview';
export type ReleaseBuildTrigger = 'manual' | 'automated';
export type ReleasePreviewKind = 'dev' | 'nightly' | null;
export type AppUpdaterAudience = 'stable' | 'preview';

export type AppUpdaterCandidate = {
  releaseTag: string;
  updaterVersion: string;
  qualityStatus: ReleaseQualityStatus;
  previewKind: ReleasePreviewKind;
};

export type AppUpdaterSelection = {
  status: 'update' | 'no_op' | 'rejected_downgrade' | 'no_candidate';
  candidate: AppUpdaterCandidate | null;
};

export function derivePreviewKind(
  qualityStatus: ReleaseQualityStatus,
  buildTrigger: ReleaseBuildTrigger,
): ReleasePreviewKind {
  if (qualityStatus === 'stable') return null;
  return buildTrigger === 'manual' ? 'dev' : 'nightly';
}

export function assertReleaseSemanticsAxes(input: {
  qualityStatus: ReleaseQualityStatus;
  buildTrigger: ReleaseBuildTrigger;
  previewKind: ReleasePreviewKind;
}): void {
  const expected = derivePreviewKind(input.qualityStatus, input.buildTrigger);
  if (input.previewKind !== expected) {
    throw new Error(
      `Release semantics axes disagree: ${input.qualityStatus}/${input.buildTrigger} requires preview_kind=${expected ?? 'null'}.`,
    );
  }
}

export type ReleaseVersionIdentity = {
  channel: AppReleaseChannel;
  displayVersion: string;
  updaterVersion: string;
  tag: string;
  revision: number;
  legacyMachineVersion: boolean;
};

const updaterVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

function comparePrereleaseIdentifiers(left: string, right: string): number {
  const leftParts = left ? left.split('.') : [];
  const rightParts = right ? right.split('.') : [];
  if (leftParts.length === 0 || rightParts.length === 0) {
    if (leftParts.length === rightParts.length) return 0;
    return leftParts.length === 0 ? 1 : -1;
  }
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined || rightPart === undefined) {
      return leftPart === rightPart ? 0 : leftPart === undefined ? -1 : 1;
    }
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) - Number(rightPart);
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}

export function compareUpdaterMachineVersions(left: string, right: string): number {
  const leftMatch = updaterVersionPattern.exec(left);
  const rightMatch = updaterVersionPattern.exec(right);
  if (!leftMatch || !rightMatch) {
    throw new Error(`Updater versions must be valid SemVer values: ${left || '<empty>'}, ${right || '<empty>'}.`);
  }
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(leftMatch[index]) - Number(rightMatch[index]);
    if (difference !== 0) return difference;
  }
  return comparePrereleaseIdentifiers(leftMatch[4] ?? '', rightMatch[4] ?? '');
}

export function selectAppUpdaterCandidate(
  audience: AppUpdaterAudience,
  installedUpdaterVersion: string,
  candidates: AppUpdaterCandidate[],
): AppUpdaterSelection {
  compareUpdaterMachineVersions(installedUpdaterVersion, installedUpdaterVersion);
  const eligible = candidates.filter((candidate) => {
    compareUpdaterMachineVersions(candidate.updaterVersion, candidate.updaterVersion);
    assertReleaseSemanticsAxes({
      qualityStatus: candidate.qualityStatus,
      buildTrigger: candidate.previewKind === 'nightly' ? 'automated' : 'manual',
      previewKind: candidate.previewKind,
    });
    if (audience === 'stable') return candidate.qualityStatus === 'stable';
    return candidate.qualityStatus === 'stable'
      || (candidate.qualityStatus === 'preview'
        && (candidate.previewKind === 'dev' || candidate.previewKind === 'nightly'));
  });
  if (eligible.length === 0) return { status: 'no_candidate', candidate: null };
  eligible.sort((left, right) =>
    compareUpdaterMachineVersions(right.updaterVersion, left.updaterVersion));
  const candidate = eligible[0]!;
  const comparison = compareUpdaterMachineVersions(candidate.updaterVersion, installedUpdaterVersion);
  if (comparison < 0) return { status: 'rejected_downgrade', candidate };
  if (comparison === 0) return { status: 'no_op', candidate };
  return { status: 'update', candidate };
}

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseContract = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
);

function contractPattern(
  name: 'stable_version_pattern' | 'nightly_version_pattern' | 'preview_version_pattern',
): string {
  const value = releaseContract?.github_release_name?.[name];
  if (name === 'preview_version_pattern' && value === undefined) {
    return '^[0-9]{2}\\.(?:[1-9]|1[0-2])\\.(?:[1-9]|[12][0-9]|3[01])-preview\\.r[1-9]$';
  }
  if (typeof value !== 'string' || !value.startsWith('^') || !value.endsWith('$')) {
    throw new Error(`App release contract is missing an anchored github_release_name.${name}.`);
  }
  return value;
}

export const stableReleaseVersionPatternSource = contractPattern('stable_version_pattern');
export const nightlyReleaseVersionPatternSource = contractPattern('nightly_version_pattern');
export const previewReleaseVersionPatternSource = contractPattern('preview_version_pattern');
export const stableReleaseVersionPattern = new RegExp(stableReleaseVersionPatternSource);
export const nightlyReleaseVersionPattern = new RegExp(nightlyReleaseVersionPatternSource);
export const previewReleaseVersionPattern = new RegExp(previewReleaseVersionPatternSource);

function contractNightlyMaximumRebuildRevision(): number {
  const value = releaseContract?.nightly_standard?.same_day_rebuild?.maximum_revision;
  if (!Number.isInteger(value) || value < 1 || value > 9) {
    throw new Error('App release contract must set nightly_standard.same_day_rebuild.maximum_revision from 1 through 9.');
  }
  return value;
}

export const nightlyMaximumRebuildRevision = contractNightlyMaximumRebuildRevision();

function contractStableMaximumRevision(): number {
  const value = releaseContract?.github_release_name?.stable_revision?.maximum_revision;
  if (!Number.isInteger(value) || value < 1 || value > 9) {
    throw new Error('App release contract must set github_release_name.stable_revision.maximum_revision from 1 through 9.');
  }
  return value;
}

function contractLegacyStableMachineVersionLastDisplay(): string {
  const value = releaseContract?.github_release_name?.machine_version?.legacy_stable_last_display_version;
  if (typeof value !== 'string' || !/^\d{2}\.\d{1,2}\.\d{1,2}$/.test(value)) {
    throw new Error('App release contract must set github_release_name.machine_version.legacy_stable_last_display_version.');
  }
  return value;
}

function contractSharedPreviewLaneCutoverDisplayVersion(): string {
  const value = releaseContract?.github_release_name?.machine_version
    ?.shared_preview_lane_cutover_display_version;
  if (typeof value !== 'string' || !/^\d{2}\.\d{1,2}\.\d{1,2}$/.test(value)) {
    throw new Error(
      'App release contract must set github_release_name.machine_version.shared_preview_lane_cutover_display_version.',
    );
  }
  return value;
}

function contractNightlyPatchOffset(): number {
  const value = releaseContract?.github_release_name?.machine_version?.nightly_patch_offset;
  if (!Number.isInteger(value) || value < 10 || value > 90) {
    throw new Error('App release contract must set github_release_name.machine_version.nightly_patch_offset from 10 through 90.');
  }
  return value;
}

export const stableMaximumRevision = contractStableMaximumRevision();
export const legacyStableMachineVersionLastDisplay = contractLegacyStableMachineVersionLastDisplay();
export const sharedPreviewLaneCutoverDisplayVersion =
  contractSharedPreviewLaneCutoverDisplayVersion();
export const nightlyMachinePatchOffset = contractNightlyPatchOffset();

if (nightlyMachinePatchOffset <= stableMaximumRevision
  || nightlyMachinePatchOffset + nightlyMaximumRebuildRevision >= 100) {
  throw new Error('Nightly machine patch slots must follow Stable revisions and remain below the next calendar day.');
}

export function releaseVersionPattern(channel: AppReleaseChannel): RegExp {
  if (channel === 'stable') return stableReleaseVersionPattern;
  return channel === 'nightly' ? nightlyReleaseVersionPattern : previewReleaseVersionPattern;
}

export function releaseVersionPatternSource(channel: AppReleaseChannel): string {
  if (channel === 'stable') return stableReleaseVersionPatternSource;
  return channel === 'nightly' ? nightlyReleaseVersionPatternSource : previewReleaseVersionPatternSource;
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
  const datePart = channel === 'nightly'
    ? version.slice(0, version.indexOf('-nightly'))
    : channel === 'preview'
      ? version.slice(0, version.indexOf('-preview'))
      : version.replace(/-r[1-9][0-9]*$/, '');
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

export function stableReleaseRevision(version: string): number {
  assertCanonicalReleaseVersion('stable', version);
  const match = /-r([1-9][0-9]*)$/.exec(version);
  return match ? Number(match[1]) : 0;
}

function nightlyReleaseRevision(version: string): number {
  assertCanonicalReleaseVersion('nightly', version);
  const match = /\.r([1-9][0-9]*)$/.exec(version);
  return match ? Number(match[1]) : 0;
}

function previewReleaseRevision(version: string): number {
  assertCanonicalReleaseVersion('preview', version);
  return Number(/-preview\.r([1-9][0-9]*)$/.exec(version)?.[1] ?? 0);
}

function calendarTuple(version: string): [number, number, number] {
  const parts = releaseCalendarParts('stable', version);
  if (!parts) throw new Error(`Stable version is not a valid calendar date: ${version}.`);
  return [parts.year - 2000, parts.month, parts.day];
}

function compareCalendarVersions(left: string, right: string): number {
  const leftTuple = calendarTuple(left);
  const rightTuple = calendarTuple(right);
  for (let index = 0; index < leftTuple.length; index += 1) {
    if (leftTuple[index] !== rightTuple[index]) return leftTuple[index]! - rightTuple[index]!;
  }
  return 0;
}

export function encodeStableMachineVersion(displayVersion: string): string {
  assertCanonicalReleaseVersion('stable', displayVersion);
  const calendar = releaseCalendarParts('stable', displayVersion)!;
  const revision = stableReleaseRevision(displayVersion);
  if (revision > stableMaximumRevision) {
    throw new Error(`Stable revision r${revision} exceeds r${stableMaximumRevision}.`);
  }
  const baseDisplayVersion = `${calendar.year - 2000}.${calendar.month}.${calendar.day}`;
  const patchOffset = compareCalendarVersions(
    baseDisplayVersion,
    sharedPreviewLaneCutoverDisplayVersion,
  ) >= 0
    ? nightlyMachinePatchOffset
    : 0;
  return `${calendar.year - 2000}.${calendar.month}.${calendar.day * 100 + patchOffset + revision}`;
}

export function resolveReleaseVersionIdentity(
  channel: AppReleaseChannel,
  displayVersion: string,
): ReleaseVersionIdentity {
  assertCanonicalReleaseVersion(channel, displayVersion);
  const calendar = releaseCalendarParts(channel, displayVersion)!;
  const year = calendar.year - 2000;
  const baseDisplayVersion = `${year}.${calendar.month}.${calendar.day}`;

  if (channel === 'stable') {
    const revision = stableReleaseRevision(displayVersion);
    if (revision > stableMaximumRevision) {
      throw new Error(
        `Stable revision r${revision} exceeds r${stableMaximumRevision}; allocate a new calendar base instead.`,
      );
    }
    const legacyMachineVersion = revision === 0
      && compareCalendarVersions(baseDisplayVersion, legacyStableMachineVersionLastDisplay) <= 0;
    return {
      channel,
      displayVersion,
      updaterVersion: legacyMachineVersion
        ? baseDisplayVersion
        : encodeStableMachineVersion(displayVersion),
      tag: `v${displayVersion}`,
      revision,
      legacyMachineVersion,
    };
  }

  if (channel === 'preview') {
    const revision = previewReleaseRevision(displayVersion);
    if (revision < 1 || revision > stableMaximumRevision) {
      throw new Error(`Preview revision r${revision} must be between r1 and r${stableMaximumRevision}.`);
    }
    const sharedPreviewLane = compareCalendarVersions(
      baseDisplayVersion,
      sharedPreviewLaneCutoverDisplayVersion,
    ) >= 0;
    const core = `${year}.${calendar.month}.${calendar.day * 100 + (
      sharedPreviewLane ? nightlyMachinePatchOffset : 0
    ) + revision}`;
    return {
      channel,
      displayVersion,
      updaterVersion: sharedPreviewLane ? `${core}-preview.${revision}` : core,
      tag: `v${displayVersion}`,
      revision,
      legacyMachineVersion: false,
    };
  }

  const revision = nightlyReleaseRevision(displayVersion);
  if (revision > nightlyMaximumRebuildRevision) {
    throw new Error(
      `Nightly revision r${revision} exceeds r${nightlyMaximumRebuildRevision}.`,
    );
  }
  const legacyMachineVersion = compareCalendarVersions(baseDisplayVersion, legacyStableMachineVersionLastDisplay) <= 0;
  return {
    channel,
    displayVersion,
    updaterVersion: legacyMachineVersion
      ? displayVersion
      : `${year}.${calendar.month}.${calendar.day * 100 + nightlyMachinePatchOffset + revision}-nightly.${revision}`,
    tag: `v${displayVersion}`,
    revision,
    legacyMachineVersion,
  };
}

export function assertUpdaterVersionMatchesDisplay(
  channel: AppReleaseChannel,
  displayVersion: string,
  updaterVersion: string,
): ReleaseVersionIdentity {
  const identity = resolveReleaseVersionIdentity(channel, displayVersion);
  if (identity.updaterVersion !== updaterVersion) {
    throw new Error(
      `Updater version ${updaterVersion || '<empty>'} does not match ${displayVersion}; expected ${identity.updaterVersion}.`,
    );
  }
  return identity;
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
      `${channel === 'stable' ? 'Stable' : channel === 'nightly' ? 'Nightly' : 'Preview'} version ${version} is future-dated for `
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

export type StableVersionResolution = {
  baseVersion: string;
  version: string;
  revision: number;
  updaterVersion: string;
  observedSameDayVersions: string[];
};

export type PreviewVersionResolution = StableVersionResolution;

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
  const stableBase = baseVersion.slice(0, -'-nightly'.length);
  const sharedPreviewLane = compareCalendarVersions(
    stableBase,
    sharedPreviewLaneCutoverDisplayVersion,
  ) >= 0;
  const escapedStableBase = stableBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stablePattern = new RegExp(`^${escapedStableBase}(?:-r([1-9][0-9]*))?$`);
  const previewPattern = new RegExp(`^${escapedStableBase}-preview\\.r([1-9][0-9]*)$`);
  const observed = new Set<string>();
  let highestRevision = -1;

  for (const rawRef of existingRefs) {
    const version = normalizeReleaseRef(rawRef);
    const canonicalMatch = canonicalPattern.exec(version);
    if (canonicalMatch) {
      observed.add(version);
      highestRevision = Math.max(highestRevision, canonicalMatch[1] ? Number(canonicalMatch[1]) : 0);
      continue;
    }
    if (legacyRunIdentityPattern.test(version)) {
      observed.add(version);
      highestRevision = Math.max(highestRevision, 0);
      continue;
    }
    if (sharedPreviewLane) {
      const stableMatch = stablePattern.exec(version);
      const previewMatch = previewPattern.exec(version);
      if (stableMatch || previewMatch) {
        observed.add(version);
        highestRevision = Math.max(
          highestRevision,
          previewMatch ? Number(previewMatch[1]) : stableMatch?.[1] ? Number(stableMatch[1]) : 0,
        );
      }
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

export function resolveStableReleaseVersion(
  baseVersion: string,
  existingRefs: Iterable<string>,
): StableVersionResolution {
  assertReleaseVersionNotFuture('stable', baseVersion);
  if (stableReleaseRevision(baseVersion) !== 0) {
    throw new Error(`Stable base version must not include a revision suffix: ${baseVersion}.`);
  }

  const escapedBase = baseVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const canonicalPattern = new RegExp(`^${escapedBase}(?:-r([1-9][0-9]*))?$`);
  const previewPattern = new RegExp(`^${escapedBase}-preview\\.r([1-9][0-9]*)$`);
  const nightlyPattern = new RegExp(`^${escapedBase}-nightly(?:\\.r([1-9][0-9]*))?$`);
  const sharedPreviewLane = compareCalendarVersions(
    baseVersion,
    sharedPreviewLaneCutoverDisplayVersion,
  ) >= 0;
  const observed = new Set<string>();
  let highestStableRevision = -1;
  let highestPrereleaseRevision = -1;
  for (const rawRef of existingRefs) {
    const version = normalizeReleaseRef(rawRef);
    const match = canonicalPattern.exec(version);
    const previewMatch = previewPattern.exec(version);
    const nightlyMatch = sharedPreviewLane ? nightlyPattern.exec(version) : null;
    if (!match && !previewMatch && !nightlyMatch) continue;
    observed.add(version);
    if (match) {
      highestStableRevision = Math.max(
        highestStableRevision,
        match[1] ? Number(match[1]) : 0,
      );
    } else {
      highestPrereleaseRevision = Math.max(
        highestPrereleaseRevision,
        previewMatch ? Number(previewMatch[1]) : nightlyMatch?.[1] ? Number(nightlyMatch[1]) : 0,
      );
    }
  }

  const highestRevision = Math.max(highestStableRevision, highestPrereleaseRevision);
  const revision = sharedPreviewLane && highestPrereleaseRevision > highestStableRevision
    ? highestPrereleaseRevision
    : highestRevision < 0
      ? 0
      : highestRevision + 1;
  if (revision > stableMaximumRevision) {
    throw new Error(
      `Stable ${baseVersion} already reached r${highestRevision}; revisions stop at r${stableMaximumRevision}.`,
    );
  }
  const version = revision === 0 ? baseVersion : `${baseVersion}-r${revision}`;
  return {
    baseVersion,
    version,
    revision,
    updaterVersion: resolveReleaseVersionIdentity('stable', version).updaterVersion,
    observedSameDayVersions: [...observed].sort(),
  };
}

export function resolvePreviewReleaseVersion(
  baseVersion: string,
  existingRefs: Iterable<string>,
): PreviewVersionResolution {
  assertReleaseVersionNotFuture('stable', baseVersion);
  if (stableReleaseRevision(baseVersion) !== 0) {
    throw new Error(`Preview base version must not include a revision suffix: ${baseVersion}.`);
  }

  const escapedBase = baseVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stablePattern = new RegExp(`^${escapedBase}(?:-r([1-9][0-9]*))?$`);
  const previewPattern = new RegExp(`^${escapedBase}-preview\\.r([1-9][0-9]*)$`);
  const nightlyPattern = new RegExp(`^${escapedBase}-nightly(?:\\.r([1-9][0-9]*))?$`);
  const sharedPreviewLane = compareCalendarVersions(
    baseVersion,
    sharedPreviewLaneCutoverDisplayVersion,
  ) >= 0;
  const observed = new Set<string>();
  let highestRevision = 0;
  for (const rawRef of existingRefs) {
    const version = normalizeReleaseRef(rawRef);
    const stableMatch = stablePattern.exec(version);
    const previewMatch = previewPattern.exec(version);
    const nightlyMatch = sharedPreviewLane ? nightlyPattern.exec(version) : null;
    if (!stableMatch && !previewMatch && !nightlyMatch) continue;
    observed.add(version);
    highestRevision = Math.max(
      highestRevision,
      previewMatch
        ? Number(previewMatch[1])
        : nightlyMatch?.[1]
          ? Number(nightlyMatch[1])
          : stableMatch?.[1]
            ? Number(stableMatch[1])
            : 0,
    );
  }

  const revision = highestRevision + 1;
  if (revision > stableMaximumRevision) {
    throw new Error(`Preview ${baseVersion} cannot allocate r${revision}; revisions stop at r${stableMaximumRevision}.`);
  }
  const version = `${baseVersion}-preview.r${revision}`;
  return {
    baseVersion,
    version,
    revision,
    updaterVersion: resolveReleaseVersionIdentity('preview', version).updaterVersion,
    observedSameDayVersions: [...observed].sort(),
  };
}

function main(): void {
  const { values } = parseArgs({
    options: {
      channel: { type: 'string' },
      version: { type: 'string' },
      'updater-version': { type: 'string' },
      json: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.channel !== 'stable' && values.channel !== 'nightly' && values.channel !== 'preview') {
    throw new Error('Pass --channel stable, --channel nightly, or --channel preview.');
  }
  const version = values.version?.trim() ?? '';
  if (!version) throw new Error('Pass --version <version>.');
  assertReleaseVersionNotFuture(values.channel, version);
  const identity = resolveReleaseVersionIdentity(values.channel, version);
  if (values['updater-version'] !== undefined) {
    assertUpdaterVersionMatchesDisplay(values.channel, version, values['updater-version'].trim());
  }
  const payload = {
    channel: values.channel,
    version,
    display_version: identity.displayVersion,
    updater_version: identity.updaterVersion,
    revision: identity.revision,
    legacy_machine_version: identity.legacyMachineVersion,
    tag: identity.tag,
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
