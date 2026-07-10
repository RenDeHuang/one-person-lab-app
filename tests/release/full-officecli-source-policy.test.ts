import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertOfficeCliBinaryMatchesRelease,
  parseLatestStableGitTag,
  prepareOfficeCliLatestStableCheckout,
  resolveOfficeCliReleaseSource,
} from '../../scripts/build-full-first-install-package/upstream-release.ts';

test('OfficeCLI Full source policy selects the highest stable semantic-version tag', () => {
  const latest = parseLatestStableGitTag([
    '1111111111111111111111111111111111111111\trefs/tags/v1.0.134',
    '2222222222222222222222222222222222222222\trefs/tags/v1.0.135',
    '3333333333333333333333333333333333333333\trefs/tags/v1.0.136-beta.1',
    '4444444444444444444444444444444444444444\trefs/tags/not-a-release',
  ].join('\n'));

  assert.deepEqual(latest, {
    tag: 'v1.0.135',
    version: '1.0.135',
    commit: '2222222222222222222222222222222222222222',
  });
});

test('OfficeCLI Full source policy uses peeled commits for annotated tags', () => {
  const latest = parseLatestStableGitTag([
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\trefs/tags/v1.0.135',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/v1.0.135^{}',
  ].join('\n'));

  assert.equal(latest.commit, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
});

test('OfficeCLI Full source policy verifies latest stable checkout and binary version', () => {
  const head = '2222222222222222222222222222222222222222';
  const calls: string[] = [];
  const release = resolveOfficeCliReleaseSource('/tmp/OfficeCLI', 'latest-stable', (command, args) => {
    calls.push([command, ...args].join(' '));
    if (args[0] === 'rev-parse') return { status: 0, stdout: `${head}\n`, stderr: '' };
    return {
      status: 0,
      stdout: `${head}\trefs/tags/v1.0.135\n`,
      stderr: '',
    };
  });

  assert.equal(release.latest_stable_verified, true);
  assert.equal(release.resolved_ref, 'v1.0.135');
  assert.equal(assertOfficeCliBinaryMatchesRelease('officecli 1.0.135', release), '1.0.135');
  assert.deepEqual(calls, [
    'git rev-parse HEAD',
    'git ls-remote --tags origin',
  ]);
});

test('OfficeCLI Full source policy rejects a stale checkout or mismatched binary', () => {
  assert.throws(
    () => resolveOfficeCliReleaseSource('/tmp/OfficeCLI', 'latest-stable', (_command, args) => {
      if (args[0] === 'rev-parse') {
        return { status: 0, stdout: '1111111111111111111111111111111111111111\n', stderr: '' };
      }
      return {
        status: 0,
        stdout: '2222222222222222222222222222222222222222\trefs/tags/v1.0.135\n',
        stderr: '',
      };
    }),
    /not latest stable/,
  );
  assert.throws(
    () => assertOfficeCliBinaryMatchesRelease('officecli 1.0.134', {
      version: '1.0.135',
      resolved_ref: 'v1.0.135',
    }),
    /does not match source release/,
  );
});

test('OfficeCLI Full release preparation detaches the checkout at the latest stable tag commit', () => {
  const latestCommit = '2222222222222222222222222222222222222222';
  const calls: string[] = [];
  let prepared = false;
  let fetchAttempts = 0;
  const release = prepareOfficeCliLatestStableCheckout('/tmp/OfficeCLI', (command, args) => {
    calls.push([command, ...args].join(' '));
    if (args[0] === 'ls-remote') {
      return {
        status: 0,
        stdout: `${latestCommit}\trefs/tags/v1.0.135\n`,
        stderr: '',
      };
    }
    if (args[0] === 'fetch') {
      fetchAttempts += 1;
      return fetchAttempts < 3
        ? { status: 1, stdout: '', stderr: 'transient fetch failure' }
        : { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'checkout') {
      prepared = true;
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'rev-parse') {
      return { status: 0, stdout: prepared ? `${latestCommit}\n` : '', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected command' };
  });

  assert.equal(release.resolved_ref, 'v1.0.135');
  assert.equal(release.version, '1.0.135');
  assert.deepEqual(calls, [
    'git ls-remote --tags origin',
    'git fetch --force --depth=1 origin refs/tags/v1.0.135:refs/tags/v1.0.135',
    'git fetch --force --depth=1 origin refs/tags/v1.0.135:refs/tags/v1.0.135',
    'git fetch --force --depth=1 origin refs/tags/v1.0.135:refs/tags/v1.0.135',
    `git checkout --detach ${latestCommit}`,
    'git rev-parse HEAD',
  ]);
});
