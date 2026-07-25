import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  decodeBase64Strict,
  type CommandRunner,
  verifyAppleReleaseCredentials,
} from '../../scripts/verify-apple-release-credentials.ts';

const identity = 'Developer ID Application: Example Owner (TEAM123456)';
const credentialEnv = {
  BUILD_CERTIFICATE_BASE64: Buffer.from('fixture-p12').toString('base64'),
  P12_PASSWORD: 'fixture-p12-password',
  APPLE_ID: 'release@example.invalid',
  APPLE_ID_PASSWORD: 'fixture-app-password',
  TEAM_ID: 'TEAM123456',
  IDENTITY: 'Example Owner',
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'gaofeng21cn/one-person-lab-app',
  GITHUB_WORKFLOW_REF:
    'gaofeng21cn/one-person-lab-app/.github/workflows/release-apple-credentials-preflight.yml@refs/heads/main',
  GITHUB_RUN_ID: '123456789',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: 'a'.repeat(40),
};

function successfulRunner(overrides: {
  teamId?: string;
  failImport?: boolean;
  identityOutput?: string;
  notaryStdout?: string;
} = {}) {
  const calls: Array<{ command: string; args: string[]; redactedArgs?: string[] }> = [];
  const runner: CommandRunner = (command, args, options) => {
    calls.push({ command, args, redactedArgs: options?.redactedArgs });
    if (overrides.failImport && command === 'security' && args[0] === 'import') {
      return {
        status: 1,
        stdout: '',
        stderr: 'fixture import failed for fixture-p12-password',
      };
    }
    if (command === 'security' && args[0] === 'find-identity') {
      return {
        status: 0,
        stdout: overrides.identityOutput ?? `  1) ${'A'.repeat(40)} "${identity}"\n`,
        stderr: '',
      };
    }
    if (command === 'codesign' && args[0] === '-dv') {
      return {
        status: 0,
        stdout: '',
        stderr: [
          `Authority=${identity}`,
          `TeamIdentifier=${overrides.teamId ?? 'TEAM123456'}`,
          'Runtime Version=15.0.0',
          'Timestamp=Jul 25, 2026 at 12:00:00',
        ].join('\n'),
      };
    }
    if (command === 'xcrun') {
      return {
        status: 0,
        stdout: overrides.notaryStdout ?? '{"history":[{"status":"Accepted"}]}',
        stderr: '',
      };
    }
    return { status: 0, stdout: '', stderr: '' };
  };
  return { runner, calls };
}

test('strict base64 decoding rejects malformed or non-canonical certificate bytes', () => {
  assert.equal(decodeBase64Strict(Buffer.from('certificate').toString('base64')).toString(), 'certificate');
  assert.throws(() => decodeBase64Strict('not base64'), /not valid base64/);
  assert.throws(() => decodeBase64Strict('YQ==='), /not valid base64/);
});

test('Apple credential preflight imports the P12, signs a probe, and authenticates notarization read-only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-apple-credential-test-'));
  const outputPath = path.join(root, 'receipt.json');
  const fixture = successfulRunner();
  const receipt = verifyAppleReleaseCredentials({
    outputPath,
    env: credentialEnv,
    platform: 'darwin',
    runner: fixture.runner,
    now: () => new Date('2026-07-25T04:00:00.000Z'),
  });

  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.execution.admission_eligible, true);
  assert.equal(receipt.execution.head_sha, 'a'.repeat(40));
  assert.equal(receipt.signing.configured_team_id_match, true);
  assert.equal(receipt.signing.configured_identity_selector_resolved, true);
  assert.equal(receipt.signing.probe_codesign_strict, 'passed');
  assert.equal(receipt.notarization.authentication, 'passed');
  assert.equal(receipt.notarization.history_count, 1);
  assert.equal(receipt.notarization.submission_performed, false);
  assert.equal(receipt.mutation.release_dispatch_performed, false);
  assert.equal(receipt.mutation.public_asset_write_performed, false);
  assert.equal(fs.statSync(outputPath).mode & 0o777, 0o600);
  assert.equal(
    fixture.calls.some((call) => call.command === 'codesign' && call.args.includes('--timestamp')),
    true,
  );
  assert.equal(
    fixture.calls.some((call) => (
      call.command === 'codesign'
      && call.args[call.args.indexOf('--sign') + 1] === credentialEnv.IDENTITY
    )),
    true,
  );
  assert.equal(
    fixture.calls.some((call) => call.command === 'xcrun' && call.args.slice(0, 2).join(' ') === 'notarytool history'),
    true,
  );
});

test('Apple credential preflight fails closed on platform, Team ID, and notary response drift', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-apple-credential-failures-'));
  assert.throws(
    () => verifyAppleReleaseCredentials({
      outputPath: path.join(root, 'linux.json'),
      env: credentialEnv,
      platform: 'linux',
      runner: successfulRunner().runner,
    }),
    /requires a macOS runner/,
  );
  assert.throws(
    () => verifyAppleReleaseCredentials({
      outputPath: path.join(root, 'team.json'),
      env: credentialEnv,
      platform: 'darwin',
      runner: successfulRunner({ teamId: 'OTHERTEAM1' }).runner,
    }),
    /TeamIdentifier mismatch/,
  );
  assert.throws(
    () => verifyAppleReleaseCredentials({
      outputPath: path.join(root, 'ad-hoc.json'),
      env: { ...credentialEnv, IDENTITY: '-' },
      platform: 'darwin',
      runner: successfulRunner().runner,
    }),
    /ad-hoc signing is forbidden/,
  );
  assert.throws(
    () => verifyAppleReleaseCredentials({
      outputPath: path.join(root, 'notary.json'),
      env: credentialEnv,
      platform: 'darwin',
      runner: successfulRunner({ notaryStdout: 'not-json' }).runner,
    }),
    /did not return a JSON object/,
  );
  assert.throws(
    () => verifyAppleReleaseCredentials({
      outputPath: path.join(root, 'identity.json'),
      env: credentialEnv,
      platform: 'darwin',
      runner: successfulRunner({
        identityOutput: `  1) ${'B'.repeat(40)} "Apple Development: Example Owner (TEAM123456)"\n`,
      }).runner,
    }),
    /does not expose a Developer ID Application identity/,
  );
});

test('GitHub admission receipt requires canonical main and first-attempt workflow dispatch identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-apple-credential-authority-'));
  assert.throws(
    () => verifyAppleReleaseCredentials({
      outputPath: path.join(root, 'branch.json'),
      env: { ...credentialEnv, GITHUB_REF: 'refs/heads/feature' },
      platform: 'darwin',
      runner: successfulRunner().runner,
    }),
    /first-attempt workflow_dispatch on canonical App main/,
  );
  const receipt = verifyAppleReleaseCredentials({
    outputPath: path.join(root, 'local.json'),
    env: Object.fromEntries(
      Object.entries(credentialEnv).filter(([name]) => !name.startsWith('GITHUB_')),
    ),
    platform: 'darwin',
    runner: successfulRunner().runner,
  });
  assert.equal(receipt.execution.environment, 'local');
  assert.equal(receipt.execution.admission_eligible, false);
  assert.match(receipt.truth_boundary, /not_dispatch_admission/);
});

test('command diagnostics redact certificate and notarization passwords', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-apple-credential-redaction-'));
  assert.throws(
    () => verifyAppleReleaseCredentials({
      outputPath: path.join(root, 'receipt.json'),
      env: credentialEnv,
      platform: 'darwin',
      runner: successfulRunner({ failImport: true }).runner,
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /fixture-p12-password|fixture-app-password/);
      assert.match(error.message, /<redacted>/);
      return true;
    },
  );
});
