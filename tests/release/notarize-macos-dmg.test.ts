import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  notarizationWaitTimeoutSeconds,
  preNotarizationCommandTimeoutMs,
} from '../../scripts/notarize-macos-dmg.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptPath = path.join(appRoot, 'scripts', 'notarize-macos-dmg.ts');
const teamId = 'SVVC4TA784';
const identity = `Developer ID Application: FENG GAO (${teamId})`;
const submissionId = '00000000-0000-0000-0000-000000000001';

function writeExecutable(filePath: string, source: string): void {
  fs.writeFileSync(filePath, source, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function fixture(waitStatus: 'Accepted' | 'In Progress') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-notarize-dmg-test-'));
  const binaryRoot = path.join(root, 'bin');
  const commandLog = path.join(root, 'commands.log');
  const dmgPath = path.join(root, 'One-Person-Lab-Full.dmg');
  const outputPath = path.join(root, 'receipt.json');
  fs.mkdirSync(binaryRoot);
  fs.writeFileSync(dmgPath, 'full-dmg-fixture', 'utf8');

  writeExecutable(path.join(binaryRoot, 'hdiutil'), `#!/bin/sh
printf 'hdiutil %s\n' "$*" >> "$OPL_TEST_COMMAND_LOG"
if [ "$1" = attach ]; then
  mountpoint=''
  previous=''
  for argument in "$@"; do
    if [ "$previous" = -mountpoint ]; then mountpoint="$argument"; fi
    previous="$argument"
  done
  mkdir -p "$mountpoint/One Person Lab.app/Contents/MacOS"
fi
exit 0
`);
  writeExecutable(path.join(binaryRoot, 'codesign'), `#!/bin/sh
printf 'codesign %s\n' "$*" >> "$OPL_TEST_COMMAND_LOG"
case "$*" in
  *"-dv --verbose=4"*)
    echo 'Authority=${identity}' >&2
    echo 'Authority=Developer ID Certification Authority' >&2
    echo 'Authority=Apple Root CA' >&2
    echo 'TeamIdentifier=${teamId}' >&2
    echo 'Runtime Version=26.0.0' >&2
    ;;
esac
exit 0
`);
  writeExecutable(path.join(binaryRoot, 'spctl'), `#!/bin/sh
printf 'spctl %s\n' "$*" >> "$OPL_TEST_COMMAND_LOG"
exit 0
`);
  writeExecutable(path.join(binaryRoot, 'xcrun'), `#!/bin/sh
printf 'xcrun %s\n' "$*" >> "$OPL_TEST_COMMAND_LOG"
if [ "$1" = notarytool ] && [ "$2" = submit ]; then
  printf '%s\n' '{"id":"${submissionId}","status":"In Progress"}'
  exit 0
fi
if [ "$1" = notarytool ] && [ "$2" = wait ]; then
  printf '%s\n' '{"id":"${submissionId}","status":"${waitStatus}"}'
  if [ '${waitStatus}' = Accepted ]; then exit 0; else exit 1; fi
fi
if [ "$1" = notarytool ] && [ "$2" = info ]; then
  printf '%s\n' '{"id":"${submissionId}","status":"${waitStatus}"}'
  exit 0
fi
exit 0
`);

  const deadlineAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    scriptPath,
    '--dmg',
    dmgPath,
    '--output',
    outputPath,
    '--operation-deadline-at',
    deadlineAt,
  ], {
    cwd: appRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      OPL_NOTARIZATION_TEST_MODE: 'true',
      OPL_NOTARIZATION_TEST_COMMAND_ROOT: binaryRoot,
      OPL_TEST_COMMAND_LOG: commandLog,
      OPL_RUNTIME_CODESIGN_IDENTITY: identity,
      appleId: 'release-owner@example.invalid',
      appleIdPassword: 'test-app-password',
      teamId,
    },
  });

  return {
    root,
    result,
    receipt: JSON.parse(fs.readFileSync(outputPath, 'utf8')) as Record<string, any>,
    commands: fs.readFileSync(commandLog, 'utf8'),
  };
}

test('notarization wait budget preserves the exact post-notarization reserve', () => {
  assert.equal(notarizationWaitTimeoutSeconds({
    operationDeadlineAt: '2026-08-01T02:00:00.000Z',
    nowMs: Date.parse('2026-08-01T01:00:00.000Z'),
  }), 40 * 60);
  assert.throws(() => notarizationWaitTimeoutSeconds({
    operationDeadlineAt: '2026-08-01T01:20:59.000Z',
    nowMs: Date.parse('2026-08-01T01:00:00.000Z'),
  }), /twenty minutes of operation reserve/);
});

test('pre-notarization commands use the remaining operation budget without consuming notarization reserve', () => {
  assert.equal(preNotarizationCommandTimeoutMs({}), 45 * 60_000);
  assert.equal(preNotarizationCommandTimeoutMs({
    operationDeadlineAt: '2026-08-01T02:00:00.000Z',
    nowMs: Date.parse('2026-08-01T00:23:00.000Z'),
  }), 76 * 60_000);
  assert.equal(preNotarizationCommandTimeoutMs({
    operationDeadlineAt: '2026-08-01T01:30:00.000Z',
    nowMs: Date.parse('2026-08-01T01:00:00.000Z'),
  }), 9 * 60_000);
  assert.throws(() => preNotarizationCommandTimeoutMs({
    operationDeadlineAt: '2026-08-01T01:20:59.000Z',
    nowMs: Date.parse('2026-08-01T01:00:00.000Z'),
  }), /twenty minutes of operation reserve/);
});

test('notarization persists the submission id before a separate bounded wait', () => {
  const value = fixture('Accepted');
  try {
    assert.equal(value.result.status, 0, value.result.stderr);
    assert.equal(value.receipt.status, 'passed');
    assert.equal(value.receipt.notarization.id, submissionId);
    assert.equal(value.receipt.notarization.status, 'Accepted');
    assert.match(value.commands, /xcrun notarytool submit .* --output-format json/);
    assert.doesNotMatch(
      value.commands.split('\n').find((line) => line.includes('notarytool submit')) ?? '',
      /--wait/,
    );
    assert.match(value.commands, new RegExp(`xcrun notarytool wait ${submissionId} .* --timeout [1-9][0-9]*s`));
    assert.doesNotMatch(value.commands, /notarytool info/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test('an incomplete bounded wait emits durable typed reconcile evidence and never staples', () => {
  const value = fixture('In Progress');
  try {
    assert.notEqual(value.result.status, 0);
    assert.equal(value.receipt.status, 'failed');
    assert.equal(value.receipt.notarization.id, submissionId);
    assert.equal(value.receipt.notarization.status, 'In Progress');
    assert.equal(value.receipt.failure.code, 'notarization_submission_incomplete');
    assert.equal(value.receipt.failure.retry_disposition, 'read_only_reconcile_submission_no_retry');
    assert.equal((value.commands.match(/notarytool submit/g) ?? []).length, 1);
    assert.equal((value.commands.match(/notarytool wait/g) ?? []).length, 1);
    assert.equal((value.commands.match(/notarytool info/g) ?? []).length, 1);
    assert.doesNotMatch(value.commands, /stapler staple/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});
