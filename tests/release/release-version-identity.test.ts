import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertReleaseVersionNotFuture,
  assertUpdaterVersionMatchesDisplay,
  compareUpdaterMachineVersions,
  encodeStableMachineVersion,
  resolveReleaseVersionIdentity,
  resolveStableReleaseVersion,
} from '../../scripts/release-version.ts';
import {
  assertPromotionTargetIsNewerThanPublishedStable,
  compareStableReleaseVersions,
  highestPublishedStableRelease,
} from '../../scripts/stable-release-version-order.ts';

test('legacy Stable base keeps its historical installed machine version', () => {
  assert.deepEqual(resolveReleaseVersionIdentity('stable', '26.7.20'), {
    channel: 'stable',
    displayVersion: '26.7.20',
    updaterVersion: '26.7.20',
    tag: 'v26.7.20',
    revision: 0,
    legacyMachineVersion: true,
  });
});

test('same-day Stable revisions separate display identity from monotonic updater identity', () => {
  assert.equal(resolveReleaseVersionIdentity('stable', '26.7.20-r1').updaterVersion, '26.7.2001');
  assert.equal(resolveReleaseVersionIdentity('stable', '26.7.20-r2').updaterVersion, '26.7.2002');
  assert.equal(resolveReleaseVersionIdentity('stable', '26.7.20-r9').updaterVersion, '26.7.2009');
  assert.ok(compareUpdaterMachineVersions('26.7.20', '26.7.2001') < 0);
  assert.ok(compareUpdaterMachineVersions('26.7.2001', '26.7.2002') < 0);
});

test('machine patch uses decimal integers across day 9 to 10 rather than padded strings', () => {
  assert.equal(encodeStableMachineVersion('26.7.9'), '26.7.900');
  assert.equal(encodeStableMachineVersion('26.7.10'), '26.7.1000');
  assert.ok(compareUpdaterMachineVersions('26.7.900', '26.7.1000') < 0);
});

test('calendar major and minor segments dominate the encoded machine patch', () => {
  assert.ok(compareUpdaterMachineVersions('26.7.3109', '26.8.100') < 0);
  assert.ok(compareUpdaterMachineVersions('26.12.3109', '27.1.100') < 0);
});

test('Stable display ordering handles base, revisions, next day, month, and year rollover', () => {
  assert.ok(compareStableReleaseVersions('v26.7.20', 'v26.7.20-r1') < 0);
  assert.ok(compareStableReleaseVersions('v26.7.20-r1', 'v26.7.20-r9') < 0);
  assert.ok(compareStableReleaseVersions('v26.7.20-r9', 'v26.7.21') < 0);
  assert.ok(compareStableReleaseVersions('v26.7.31-r9', 'v26.8.1') < 0);
  assert.ok(compareStableReleaseVersions('v26.12.31-r9', 'v27.1.1') < 0);
});

test('Stable allocator chooses base, r1, and r2 from explicit base cohort refs', () => {
  assert.equal(resolveStableReleaseVersion('26.7.20', []).version, '26.7.20');
  assert.deepEqual(
    resolveStableReleaseVersion('26.7.20', ['refs/tags/v26.7.20']),
    {
      baseVersion: '26.7.20',
      version: '26.7.20-r1',
      revision: 1,
      updaterVersion: '26.7.2001',
      observedSameDayVersions: ['26.7.20'],
    },
  );
  assert.equal(
    resolveStableReleaseVersion('26.7.20', ['v26.7.20', 'v26.7.20-r1']).version,
    '26.7.20-r2',
  );
});

test('new-scheme next-day Stable and Nightly remain monotonic after same-day revisions', () => {
  const stable = resolveReleaseVersionIdentity('stable', '26.7.21');
  const nightly = resolveReleaseVersionIdentity('nightly', '26.7.21-nightly');
  assert.equal(stable.updaterVersion, '26.7.2100');
  assert.equal(nightly.updaterVersion, '26.7.2190-nightly.0');
  assert.ok(compareUpdaterMachineVersions('26.7.2009', stable.updaterVersion) < 0);
  assert.ok(compareUpdaterMachineVersions(stable.updaterVersion, nightly.updaterVersion) < 0);
});

test('revision overflow, future dates, and display to updater collisions fail closed', () => {
  assert.throws(() => resolveReleaseVersionIdentity('stable', '26.7.20-r10'), /Invalid stable App release version/);
  assert.throws(
    () => assertReleaseVersionNotFuture('stable', '26.7.21-r1', '2026-07-20'),
    /future-dated/,
  );
  assert.throws(
    () => assertUpdaterVersionMatchesDisplay('stable', '26.7.20-r1', '26.7.20-r1'),
    /expected 26\.7\.2001/,
  );
});

test('Stable promotion compares every published Stable rather than GitHub Latest alone', () => {
  const releases = [
    { tag_name: 'v26.7.20', draft: false, prerelease: false },
    { tag_name: 'v26.7.21', draft: false, prerelease: false },
    { tag_name: 'v26.7.22-nightly', draft: false, prerelease: true },
    { tag_name: 'v26.7.23', draft: true, prerelease: false },
  ];
  assert.equal(highestPublishedStableRelease(releases).tagName, 'v26.7.21');
  assert.throws(
    () => assertPromotionTargetIsNewerThanPublishedStable('26.7.20-r1', releases),
    /older than highest published Stable v26\.7\.21/,
  );
  assert.equal(
    assertPromotionTargetIsNewerThanPublishedStable('26.7.21-r1', releases).tagName,
    'v26.7.21',
  );
});
