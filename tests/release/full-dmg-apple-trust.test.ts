import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptPath = path.join(appRoot, 'scripts', 'qualify-full-dmg-apple-trust.ts');
const expectedTeamId = 'SVVC4TA784';
const expectedIdentity = 'Developer ID Application: FENG GAO (SVVC4TA784)';

function sha256(bytes: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function writeExecutable(filePath: string, source: string): void {
  fs.writeFileSync(filePath, source, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-apple-trust-test-'));
  const binaryRoot = path.join(root, 'bin');
  const commandLog = path.join(root, 'commands.log');
  const dmgPath = path.join(root, 'One-Person-Lab-Full.dmg');
  const receiptPath = path.join(root, 'receipt.json');
  fs.mkdirSync(binaryRoot);
  fs.writeFileSync(dmgPath, 'signed-full-dmg-fixture', 'utf8');

  writeExecutable(path.join(binaryRoot, 'hdiutil'), `#!/bin/sh
printf 'hdiutil %s\\n' "$*" >> "$OPL_TEST_COMMAND_LOG"
if [ "$1" = "attach" ]; then
  mountpoint=''
  previous=''
  for argument in "$@"; do
    if [ "$previous" = "-mountpoint" ]; then mountpoint="$argument"; fi
    previous="$argument"
  done
  mkdir -p "$mountpoint/One Person Lab.app/Contents/MacOS"
fi
exit 0
`);
  writeExecutable(path.join(binaryRoot, 'codesign'), `#!/bin/sh
printf 'codesign %s\\n' "$*" >> "$OPL_TEST_COMMAND_LOG"
case "$*" in
  *"-dv --verbose=4"*)
    echo 'Executable=/fixture/One Person Lab' >&2
    echo 'CodeDirectory v=20500 size=123 flags=0x10000(runtime) hashes=4+7 location=embedded' >&2
    echo 'Authority=${expectedIdentity}' >&2
    echo 'Authority=Developer ID Certification Authority' >&2
    echo 'Authority=Apple Root CA' >&2
    echo 'Timestamp=Jul 25, 2026 at 08:00:00' >&2
    echo 'TeamIdentifier=${expectedTeamId}' >&2
    ;;
  *"--entitlements :-"*)
    printf '%s' '<plist><dict><key>com.apple.security.cs.allow-jit</key><true/></dict></plist>'
    ;;
esac
exit 0
`);
  writeExecutable(path.join(binaryRoot, 'spctl'), `#!/bin/sh
printf 'spctl %s\\n' "$*" >> "$OPL_TEST_COMMAND_LOG"
echo 'accepted'
echo 'source=Notarized Developer ID'
exit 0
`);
  writeExecutable(path.join(binaryRoot, 'xcrun'), `#!/bin/sh
printf 'xcrun %s\\n' "$*" >> "$OPL_TEST_COMMAND_LOG"
if [ "$1" = "notarytool" ]; then
  printf '%s\\n' '{"id":"00000000-0000-0000-0000-000000000001","status":"Accepted"}'
elif [ "$1" = "stapler" ] && [ "$2" = "staple" ]; then
  for argument in "$@"; do case "$argument" in *.dmg) printf '%s' '-stapled' >> "$argument";; esac; done
  echo 'The staple and validate action worked!'
else
  echo 'The validate action worked!'
fi
exit 0
`);

  const input = fs.readFileSync(dmgPath);
  const baseArgs = [
    '--dmg', dmgPath,
    '--receipt', receiptPath,
    '--expected-dmg-sha256', sha256(input),
    '--expected-dmg-size-bytes', String(input.byteLength),
    '--expected-team-id', expectedTeamId,
    '--expected-signing-identity', expectedIdentity,
  ];
  const baseEnv = {
    ...process.env,
    NODE_ENV: 'test',
    OPL_APPLE_TRUST_TEST_MODE: 'true',
    OPL_APPLE_TRUST_TEST_COMMAND_ROOT: binaryRoot,
    OPL_TEST_COMMAND_LOG: commandLog,
  };

  return {
    root,
    dmgPath,
    receiptPath,
    commandLog,
    baseArgs,
    baseEnv,
    run(args = baseArgs, env = baseEnv) {
      return spawnSync(process.execPath, ['--experimental-strip-types', scriptPath, ...args], {
        cwd: appRoot,
        env,
        encoding: 'utf8',
      });
    },
    receipt() {
      return JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as Record<string, any>;
    },
    commands() {
      return fs.existsSync(commandLog) ? fs.readFileSync(commandLog, 'utf8') : '';
    },
  };
}

test('read-only qualification binds exact DMG bytes and mounted App trust without mutation', () => {
  const value = fixture();
  const result = value.run();
  assert.equal(result.status, 0, result.stderr);
  const receipt = value.receipt();
  assert.equal(receipt.result, 'simulated_passed');
  assert.equal(receipt.mode, 'read_only_qualification');
  assert.equal(receipt.artifact.input_sha256, receipt.artifact.expected_input_sha256);
  assert.equal(receipt.artifact.input_size_bytes, receipt.artifact.expected_input_size_bytes);
  assert.equal(receipt.artifact.final_sha256, receipt.artifact.input_sha256);
  assert.equal(receipt.dmg_signature.verified, true);
  assert.equal(receipt.dmg_signature.team_id, expectedTeamId);
  assert.deepEqual(receipt.dmg_signature.authorities.slice(0, 1), [expectedIdentity]);
  assert.match(receipt.dmg_signature.timestamp, /^Jul 25, 2026/);
  assert.equal(receipt.mounted_app.team_id, expectedTeamId);
  assert.deepEqual(receipt.mounted_app.authorities.slice(0, 1), [expectedIdentity]);
  assert.equal(receipt.mounted_app.hardened_runtime, true);
  assert.match(receipt.mounted_app.entitlements_sha256, /^sha256:[a-f0-9]{64}$/);
  assert.equal(receipt.mount.detached, true);
  assert.match(value.commands(), /xcrun stapler validate -v/);
  assert.match(value.commands(), /spctl --assess --type open --context context:primary-signature/);
  assert.match(value.commands(), /spctl --assess --type execute --verbose=4/);
  assert.doesNotMatch(value.commands(), /notarytool submit|stapler staple/);
});

test('input SHA mismatch fails before any trust command runs', () => {
  const value = fixture();
  const args = [...value.baseArgs];
  args[args.indexOf('--expected-dmg-sha256') + 1] = `sha256:${'0'.repeat(64)}`;
  const result = value.run(args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DMG SHA-256 mismatch/);
  assert.equal(value.commands(), '');
  assert.equal(value.receipt().result, 'failed');
});

test('receipt path cannot overwrite the DMG artifact', () => {
  const value = fixture();
  const original = fs.readFileSync(value.dmgPath);
  const args = [...value.baseArgs];
  args[args.indexOf('--receipt') + 1] = value.dmgPath;

  const result = value.run(args);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--receipt must identify a \.json file|must not overwrite the DMG/);
  assert.deepEqual(fs.readFileSync(value.dmgPath), original);
  assert.equal(value.commands(), '');
});

test('notary submission is blocked unless both exact development-validation gates are present', () => {
  const value = fixture();
  const args = [
    ...value.baseArgs,
    '--submit',
    '--staple',
    '--keychain-profile', 'OPL Developer ID Notary',
    '--authority', 'development_validation',
  ];
  const result = value.run(args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /OPL_APPLE_NOTARY_MUTATION_AUTHORITY=development_validation/);
  assert.equal(value.commands(), '');
  const receiptText = fs.readFileSync(value.receiptPath, 'utf8');
  assert.doesNotMatch(receiptText, /OPL Developer ID Notary/);
  assert.equal(value.receipt().authority.mutation_authorized, false);
});

test('notary submission cannot omit stapling the final DMG', () => {
  const value = fixture();
  const result = value.run([
    ...value.baseArgs,
    '--submit',
    '--keychain-profile', 'OPL Developer ID Notary',
    '--authority', 'development_validation',
  ], {
    ...value.baseEnv,
    OPL_APPLE_NOTARY_MUTATION_AUTHORITY: 'development_validation',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--submit requires --staple/);
  assert.equal(value.commands(), '');
});

test('authorized development validation submits once, staples, rehashes, and never records secrets', () => {
  const value = fixture();
  const secret = 'app-specific-password-must-not-leak';
  const args = [
    ...value.baseArgs,
    '--submit',
    '--staple',
    '--keychain-profile', 'OPL Developer ID Notary',
    '--authority', 'development_validation',
  ];
  const result = value.run(args, {
    ...value.baseEnv,
    OPL_APPLE_NOTARY_MUTATION_AUTHORITY: 'development_validation',
    APPLE_APP_SPECIFIC_PASSWORD: secret,
  });
  assert.equal(result.status, 0, result.stderr);
  const receiptText = fs.readFileSync(value.receiptPath, 'utf8');
  const receipt = JSON.parse(receiptText);
  assert.equal(receipt.result, 'simulated_passed');
  assert.equal(receipt.notarization.submission_status, 'Accepted');
  assert.equal(receipt.notarization.submission_id, '00000000-0000-0000-0000-000000000001');
  assert.equal(receipt.artifact.mutated_by_staple, true);
  assert.notEqual(receipt.artifact.final_sha256, receipt.artifact.input_sha256);
  assert.equal(receipt.artifact.final_size_bytes, fs.statSync(value.dmgPath).size);
  assert.equal(receipt.credentials.environment_presence.APPLE_APP_SPECIFIC_PASSWORD, true);
  assert.doesNotMatch(receiptText, new RegExp(secret));
  assert.doesNotMatch(receiptText, /OPL Developer ID Notary/);
  const commands = value.commands();
  assert.equal((commands.match(/notarytool submit/g) ?? []).length, 1);
  assert.equal((commands.match(/stapler staple/g) ?? []).length, 1);
  assert.match(commands, /stapler validate/);
});

test('DMG Developer ID identity is verified before notary submission', () => {
  const value = fixture();
  const codesignPath = path.join(value.root, 'bin', 'codesign');
  let source = fs.readFileSync(codesignPath, 'utf8');
  source = source.replace(
    `echo 'TeamIdentifier=${expectedTeamId}' >&2`,
    "echo 'TeamIdentifier=WRONGTEAM1' >&2",
  );
  writeExecutable(codesignPath, source);
  const result = value.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DMG TeamIdentifier mismatch/);
  assert.doesNotMatch(value.commands(), /notarytool submit|stapler staple/);
  assert.equal(value.receipt().dmg_signature.verified, false);
});
