#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

type CommandEvidence = {
  check: string;
  executable: string;
  arguments: string[];
  status: 'passed' | 'failed';
  exit_code: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  output_truncated: boolean;
};

type Receipt = {
  schema_version: 'opl_full_dmg_apple_trust_qualification.v1';
  created_at: string;
  mode: 'read_only_qualification' | 'development_validation';
  result: 'incomplete' | 'passed' | 'simulated_passed' | 'failed';
  simulated: boolean;
  artifact: {
    path: string;
    expected_input_sha256: string;
    expected_input_size_bytes: number;
    input_sha256: string;
    input_size_bytes: number;
    final_sha256: string | null;
    final_size_bytes: number | null;
    mutated_by_staple: boolean;
  };
  expected_trust: {
    team_id: string;
    signing_identity: string;
    entitlements_sha256: string | null;
  };
  credentials: {
    keychain_profile_supplied: boolean;
    environment_presence: Record<string, boolean>;
  };
  authority: {
    cli_development_validation: boolean;
    environment_development_validation: boolean;
    mutation_authorized: boolean;
  };
  notarization: {
    submit_requested: boolean;
    staple_requested: boolean;
    submission_id: string | null;
    submission_status: string | null;
  };
  dmg_signature: {
    verified: boolean;
    team_id: string | null;
    authorities: string[];
    timestamp: string | null;
  };
  mounted_app: {
    relative_path: string | null;
    team_id: string | null;
    authorities: string[];
    hardened_runtime: boolean;
    entitlements_sha256: string | null;
  };
  mount: {
    attached: boolean;
    detached: boolean;
  };
  commands: CommandEvidence[];
  errors: string[];
};

const secretEnvironmentNames = [
  'APPLE_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_API_KEY',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER',
  'APP_STORE_CONNECT_API_KEY',
  'APP_STORE_CONNECT_API_ISSUER',
  'AC_PASSWORD',
] as const;

const credentialEnvironmentNames = [
  ...secretEnvironmentNames,
  'APPLE_TEAM_ID',
  'APP_STORE_CONNECT_API_KEY_PATH',
] as const;

const maxRecordedOutputBytes = 64 * 1024;

function required(value: string | undefined, option: string): string {
  if (!value) throw new Error(`Missing required option ${option}.`);
  return value;
}

function normalizeSha256(value: string, option: string): string {
  const normalized = value.toLowerCase().replace(/^sha256:/, '');
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${option} must be a 64-character SHA-256 digest.`);
  }
  return `sha256:${normalized}`;
}

function parsePositiveInteger(value: string, option: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error(`${option} must be a positive integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${option} exceeds the safe integer range.`);
  return parsed;
}

function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return `sha256:${hash.digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function extractEntitlements(stdout: string, stderr: string): string {
  const output = `${stdout}\n${stderr}`;
  const xmlStart = output.indexOf('<?xml');
  const plistStart = output.indexOf('<plist');
  const start = xmlStart >= 0 ? xmlStart : plistStart;
  const end = output.lastIndexOf('</plist>');
  if (start < 0 || end < start) {
    throw new Error('Mounted App codesign output does not contain an entitlements plist.');
  }
  return output.slice(start, end + '</plist>'.length).trim();
}

function redact(value: string): string {
  let redacted = value;
  for (const name of secretEnvironmentNames) {
    const secret = process.env[name];
    if (secret) redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted;
}

function boundedOutput(value: string): { output: string; truncated: boolean } {
  const redacted = redact(value);
  const bytes = Buffer.byteLength(redacted);
  if (bytes <= maxRecordedOutputBytes) return { output: redacted, truncated: false };
  return {
    output: Buffer.from(redacted).subarray(0, maxRecordedOutputBytes).toString('utf8'),
    truncated: true,
  };
}

function writeReceiptAtomic(receiptPath: string, receipt: Receipt): void {
  const resolved = path.resolve(receiptPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, resolved);
}

function commandPaths(simulated: boolean) {
  if (simulated) {
    const root = required(process.env.OPL_APPLE_TRUST_TEST_COMMAND_ROOT, 'OPL_APPLE_TRUST_TEST_COMMAND_ROOT');
    return {
      codesign: path.join(root, 'codesign'),
      hdiutil: path.join(root, 'hdiutil'),
      spctl: path.join(root, 'spctl'),
      xcrun: path.join(root, 'xcrun'),
    };
  }
  return {
    codesign: '/usr/bin/codesign',
    hdiutil: '/usr/bin/hdiutil',
    spctl: '/usr/sbin/spctl',
    xcrun: '/usr/bin/xcrun',
  };
}

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    strict: true,
    allowPositionals: false,
    options: {
      dmg: { type: 'string' },
      receipt: { type: 'string' },
      'expected-dmg-sha256': { type: 'string' },
      'expected-dmg-size-bytes': { type: 'string' },
      'expected-team-id': { type: 'string' },
      'expected-signing-identity': { type: 'string' },
      'expected-entitlements-sha256': { type: 'string' },
      'app-name': { type: 'string' },
      submit: { type: 'boolean', default: false },
      staple: { type: 'boolean', default: false },
      authority: { type: 'string' },
      'keychain-profile': { type: 'string' },
    },
  });

  const dmgPath = path.resolve(required(values.dmg, '--dmg'));
  const receiptPath = path.resolve(required(values.receipt, '--receipt'));
  if (path.extname(receiptPath).toLowerCase() !== '.json') {
    throw new Error('--receipt must identify a .json file.');
  }
  if (receiptPath === dmgPath) {
    throw new Error('--receipt must not overwrite the DMG.');
  }
  const expectedInputSha256 = normalizeSha256(
    required(values['expected-dmg-sha256'], '--expected-dmg-sha256'),
    '--expected-dmg-sha256',
  );
  const expectedInputSize = parsePositiveInteger(
    required(values['expected-dmg-size-bytes'], '--expected-dmg-size-bytes'),
    '--expected-dmg-size-bytes',
  );
  const expectedTeamId = required(values['expected-team-id'], '--expected-team-id');
  const expectedIdentity = required(values['expected-signing-identity'], '--expected-signing-identity');
  const expectedEntitlementsSha256 = values['expected-entitlements-sha256']
    ? normalizeSha256(values['expected-entitlements-sha256'], '--expected-entitlements-sha256')
    : null;
  const submitRequested = Boolean(values.submit);
  const stapleRequested = Boolean(values.staple);
  const mutationRequested = submitRequested || stapleRequested;
  const simulated = process.env.OPL_APPLE_TRUST_TEST_MODE === 'true';

  if (process.platform !== 'darwin' && !simulated) {
    throw new Error('Full DMG Apple trust qualification must run on macOS.');
  }
  if (simulated && process.env.NODE_ENV !== 'test') {
    throw new Error('OPL_APPLE_TRUST_TEST_MODE is restricted to NODE_ENV=test.');
  }
  if (path.extname(dmgPath).toLowerCase() !== '.dmg') throw new Error('--dmg must identify a .dmg file.');
  if (!fs.statSync(dmgPath).isFile()) throw new Error('--dmg must identify a regular file.');
  if (!/^[A-Z0-9]{10}$/.test(expectedTeamId)) {
    throw new Error('--expected-team-id must be an exact 10-character Apple Team ID.');
  }
  if (
    !expectedIdentity.startsWith('Developer ID Application: ')
    || !expectedIdentity.endsWith(`(${expectedTeamId})`)
  ) {
    throw new Error('--expected-signing-identity must be a Developer ID Application identity for the expected Team ID.');
  }
  if (values['app-name'] && (path.basename(values['app-name']) !== values['app-name'] || !values['app-name'].endsWith('.app'))) {
    throw new Error('--app-name must be a top-level .app bundle name.');
  }
  if (submitRequested && !values['keychain-profile']) {
    throw new Error('--submit requires --keychain-profile; direct secret arguments are intentionally unsupported.');
  }
  if (submitRequested && !stapleRequested) {
    throw new Error('--submit requires --staple so the one-shot validation reaches final DMG trust.');
  }

  const inputSha256 = sha256File(dmgPath);
  const inputSize = fs.statSync(dmgPath).size;
  const cliAuthorized = values.authority === 'development_validation';
  const environmentAuthorized =
    process.env.OPL_APPLE_NOTARY_MUTATION_AUTHORITY === 'development_validation';
  const mutationAuthorized = !mutationRequested || (cliAuthorized && environmentAuthorized);
  const receipt: Receipt = {
    schema_version: 'opl_full_dmg_apple_trust_qualification.v1',
    created_at: new Date().toISOString(),
    mode: mutationRequested ? 'development_validation' : 'read_only_qualification',
    result: 'incomplete',
    simulated,
    artifact: {
      path: dmgPath,
      expected_input_sha256: expectedInputSha256,
      expected_input_size_bytes: expectedInputSize,
      input_sha256: inputSha256,
      input_size_bytes: inputSize,
      final_sha256: null,
      final_size_bytes: null,
      mutated_by_staple: false,
    },
    expected_trust: {
      team_id: expectedTeamId,
      signing_identity: expectedIdentity,
      entitlements_sha256: expectedEntitlementsSha256,
    },
    credentials: {
      keychain_profile_supplied: Boolean(values['keychain-profile']),
      environment_presence: Object.fromEntries(
        credentialEnvironmentNames.map((name) => [name, Boolean(process.env[name])]),
      ),
    },
    authority: {
      cli_development_validation: cliAuthorized,
      environment_development_validation: environmentAuthorized,
      mutation_authorized: mutationAuthorized,
    },
    notarization: {
      submit_requested: submitRequested,
      staple_requested: stapleRequested,
      submission_id: null,
      submission_status: null,
    },
    dmg_signature: {
      verified: false,
      team_id: null,
      authorities: [],
      timestamp: null,
    },
    mounted_app: {
      relative_path: null,
      team_id: null,
      authorities: [],
      hardened_runtime: false,
      entitlements_sha256: null,
    },
    mount: {
      attached: false,
      detached: false,
    },
    commands: [],
    errors: [],
  };

  const paths = commandPaths(simulated);
  const redactedProfileArgs = (args: string[]) =>
    args.map((argument, index) => (args[index - 1] === '--keychain-profile' ? '<keychain-profile>' : argument));
  const run = (
    check: string,
    executable: string,
    args: string[],
    displayArgs = args,
  ): { stdout: string; stderr: string } => {
    const result = spawnSync(executable, args, {
      encoding: 'utf8',
      timeout: 30 * 60 * 1000,
      maxBuffer: 16 * 1024 * 1024,
      env: process.env,
    });
    const stdout = boundedOutput(result.stdout ?? '');
    const stderr = boundedOutput(result.stderr ?? '');
    const passed = !result.error && result.status === 0;
    receipt.commands.push({
      check,
      executable,
      arguments: redactedProfileArgs(displayArgs),
      status: passed ? 'passed' : 'failed',
      exit_code: result.status,
      signal: result.signal,
      stdout: stdout.output,
      stderr: stderr.output,
      output_truncated: stdout.truncated || stderr.truncated,
    });
    if (!passed) {
      const detail = result.error?.message || stderr.output.trim() || stdout.output.trim() || 'no command output';
      throw new Error(`${check} failed: ${detail}`);
    }
    return { stdout: stdout.output, stderr: stderr.output };
  };

  let mountRoot: string | null = null;
  let primaryError: Error | null = null;
  try {
    if (inputSha256 !== expectedInputSha256) {
      throw new Error(`DMG SHA-256 mismatch: expected ${expectedInputSha256}, got ${inputSha256}.`);
    }
    if (inputSize !== expectedInputSize) {
      throw new Error(`DMG size mismatch: expected ${expectedInputSize}, got ${inputSize}.`);
    }
    if (!mutationAuthorized) {
      throw new Error(
        'Notary/staple mutation requires --authority development_validation and '
        + 'OPL_APPLE_NOTARY_MUTATION_AUTHORITY=development_validation.',
      );
    }

    run('codesign_verify_dmg', paths.codesign, [
      '--verify',
      '--strict',
      '--verbose=4',
      dmgPath,
    ]);
    const dmgSignature = run('codesign_inspect_dmg', paths.codesign, [
      '-dv',
      '--verbose=4',
      dmgPath,
    ]);
    const dmgSignatureOutput = `${dmgSignature.stdout}\n${dmgSignature.stderr}`;
    receipt.dmg_signature.team_id =
      dmgSignatureOutput.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() ?? null;
    receipt.dmg_signature.authorities = [...dmgSignatureOutput.matchAll(/^Authority=(.+)$/gm)]
      .map((match) => match[1].trim());
    receipt.dmg_signature.timestamp =
      dmgSignatureOutput.match(/^Timestamp=(.+)$/m)?.[1]?.trim() ?? null;
    if (receipt.dmg_signature.team_id !== expectedTeamId) {
      throw new Error(
        `DMG TeamIdentifier mismatch: expected ${expectedTeamId}, got ${String(receipt.dmg_signature.team_id)}.`,
      );
    }
    if (!receipt.dmg_signature.authorities.includes(expectedIdentity)) {
      throw new Error(`DMG signing authorities do not include ${expectedIdentity}.`);
    }
    if (!receipt.dmg_signature.timestamp || receipt.dmg_signature.timestamp.toLowerCase() === 'none') {
      throw new Error('DMG signature does not include a trusted timestamp.');
    }
    receipt.dmg_signature.verified = true;

    run('hdiutil_verify_input', paths.hdiutil, ['verify', dmgPath]);

    if (submitRequested) {
      const submission = run('notarytool_submit_wait', paths.xcrun, [
        'notarytool',
        'submit',
        dmgPath,
        '--keychain-profile',
        values['keychain-profile']!,
        '--wait',
        '--output-format',
        'json',
      ]);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(submission.stdout) as Record<string, unknown>;
      } catch {
        throw new Error('notarytool submit did not return valid JSON.');
      }
      receipt.notarization.submission_id =
        typeof parsed.id === 'string' && parsed.id ? parsed.id : null;
      receipt.notarization.submission_status =
        typeof parsed.status === 'string' && parsed.status ? parsed.status : null;
      if (!receipt.notarization.submission_id || receipt.notarization.submission_status !== 'Accepted') {
        throw new Error(
          `notarytool submission was not accepted (status=${String(receipt.notarization.submission_status)}).`,
        );
      }
    }

    if (stapleRequested) {
      run('stapler_staple_dmg', paths.xcrun, ['stapler', 'staple', '-v', dmgPath]);
      receipt.artifact.mutated_by_staple = true;
    }

    receipt.artifact.final_sha256 = sha256File(dmgPath);
    receipt.artifact.final_size_bytes = fs.statSync(dmgPath).size;
    run('hdiutil_verify_final', paths.hdiutil, ['verify', dmgPath]);
    run('stapler_validate_dmg', paths.xcrun, ['stapler', 'validate', '-v', dmgPath]);
    run('spctl_assess_dmg_open', paths.spctl, [
      '--assess',
      '--type',
      'open',
      '--context',
      'context:primary-signature',
      '--verbose=4',
      dmgPath,
    ]);

    mountRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-dmg-apple-trust-'));
    run('hdiutil_attach_readonly', paths.hdiutil, [
      'attach',
      '-nobrowse',
      '-readonly',
      '-mountpoint',
      mountRoot,
      dmgPath,
    ]);
    receipt.mount.attached = true;

    const appNames = fs.readdirSync(mountRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
      .map((entry) => entry.name);
    const appName = values['app-name'] ?? (appNames.length === 1 ? appNames[0] : null);
    if (!appName || !appNames.includes(appName)) {
      throw new Error(
        values['app-name']
          ? `Mounted DMG does not contain requested top-level App ${values['app-name']}.`
          : `Mounted DMG must contain exactly one top-level .app bundle; found ${appNames.length}.`,
      );
    }
    const appPath = path.join(mountRoot, appName);
    receipt.mounted_app.relative_path = appName;

    run('codesign_verify_mounted_app', paths.codesign, [
      '--verify',
      '--deep',
      '--strict',
      '--verbose=4',
      appPath,
    ]);
    const signature = run('codesign_inspect_mounted_app', paths.codesign, [
      '-dv',
      '--verbose=4',
      appPath,
    ]);
    const signatureOutput = `${signature.stdout}\n${signature.stderr}`;
    receipt.mounted_app.team_id =
      signatureOutput.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() ?? null;
    receipt.mounted_app.authorities = [...signatureOutput.matchAll(/^Authority=(.+)$/gm)]
      .map((match) => match[1].trim());
    receipt.mounted_app.hardened_runtime =
      /^CodeDirectory .*flags=.*(?:\bruntime\b|0x10000)/m.test(signatureOutput);
    if (receipt.mounted_app.team_id !== expectedTeamId) {
      throw new Error(
        `Mounted App TeamIdentifier mismatch: expected ${expectedTeamId}, got ${String(receipt.mounted_app.team_id)}.`,
      );
    }
    if (!receipt.mounted_app.authorities.includes(expectedIdentity)) {
      throw new Error(`Mounted App signing authorities do not include ${expectedIdentity}.`);
    }
    if (!receipt.mounted_app.hardened_runtime) {
      throw new Error('Mounted App signature does not declare hardened runtime.');
    }

    const entitlements = run('codesign_read_mounted_app_entitlements', paths.codesign, [
      '-d',
      '--entitlements',
      ':-',
      appPath,
    ]);
    const entitlementPayload = extractEntitlements(entitlements.stdout, entitlements.stderr);
    receipt.mounted_app.entitlements_sha256 = sha256Text(entitlementPayload);
    if (
      expectedEntitlementsSha256
      && receipt.mounted_app.entitlements_sha256 !== expectedEntitlementsSha256
    ) {
      throw new Error(
        `Mounted App entitlements SHA-256 mismatch: expected ${expectedEntitlementsSha256}, `
        + `got ${receipt.mounted_app.entitlements_sha256}.`,
      );
    }

    run('spctl_assess_mounted_app_execute', paths.spctl, [
      '--assess',
      '--type',
      'execute',
      '--verbose=4',
      appPath,
    ]);
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error(String(error));
  } finally {
    if (receipt.mount.attached && mountRoot) {
      try {
        run('hdiutil_detach', paths.hdiutil, ['detach', mountRoot]);
        receipt.mount.detached = true;
      } catch (error) {
        const detachError = error instanceof Error ? error : new Error(String(error));
        primaryError = primaryError
          ? new Error(`${primaryError.message}; cleanup: ${detachError.message}`)
          : detachError;
      }
    }
    if (mountRoot) fs.rmSync(mountRoot, { recursive: true, force: true });
  }

  if (primaryError) {
    receipt.errors.push(redact(primaryError.message));
    receipt.result = 'failed';
  } else {
    receipt.result = simulated ? 'simulated_passed' : 'passed';
  }
  writeReceiptAtomic(receiptPath, receipt);
  process.stdout.write(`${JSON.stringify({
    result: receipt.result,
    receipt: receiptPath,
    artifact_sha256: receipt.artifact.final_sha256,
    artifact_size_bytes: receipt.artifact.final_size_bytes,
  })}\n`);
  if (primaryError) throw primaryError;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${redact(error instanceof Error ? error.message : String(error))}\n`);
  process.exitCode = 1;
}
