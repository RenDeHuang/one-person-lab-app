#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

type CommandResult = ReturnType<typeof spawnSync>;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() || '';
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function runCapture(command: string, args: string[], timeout = 45 * 60_000): CommandResult {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function run(command: string, args: string[], timeout?: number, redactedArgs: string[] = args): CommandResult {
  const result = runCapture(command, args, timeout);
  if (result.status !== 0) {
    throw new Error([
      `Command failed: ${command} ${redactedArgs.map((arg) => JSON.stringify(arg)).join(' ')}`,
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : '',
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : '',
    ].filter(Boolean).join('\n'));
  }
  return result;
}

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function findSingleApp(root: string): string {
  const apps = fs.readdirSync(root)
    .filter((entry) => entry.endsWith('.app') && fs.statSync(path.join(root, entry)).isDirectory())
    .map((entry) => path.join(root, entry));
  if (apps.length !== 1) {
    throw new Error(`Expected one top-level App bundle, found ${apps.length} under ${root}.`);
  }
  return apps[0];
}

function signatureFacts(target: string, expectedTeamId: string, requireHardenedRuntime = false) {
  const result = run('codesign', ['-dv', '--verbose=4', target]);
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const teamIdentifier = output.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() || '';
  const authorities = [...output.matchAll(/^Authority=(.+)$/gm)].map((match) => match[1].trim());
  const runtime = output.match(/^Runtime Version=(.+)$/m)?.[1]?.trim() || null;
  if (teamIdentifier !== expectedTeamId) {
    throw new Error(`Unexpected TeamIdentifier for ${target}: ${teamIdentifier || 'missing'}.`);
  }
  if (!authorities.some((authority) => authority.startsWith('Developer ID Application:'))) {
    throw new Error(`Developer ID Application authority is missing for ${target}.`);
  }
  if (requireHardenedRuntime && !runtime) {
    throw new Error(`Hardened Runtime is missing for ${target}.`);
  }
  return { team_identifier: teamIdentifier, authorities, hardened_runtime: Boolean(runtime), runtime_version: runtime };
}

function submitForNotarization(target: string, credentials: {
  appleId: string;
  password: string;
  teamId: string;
  keychainProfile: string;
}) {
  const credentialArgs = credentials.keychainProfile
    ? ['--keychain-profile', credentials.keychainProfile]
    : [
        '--apple-id',
        credentials.appleId,
        '--password',
        credentials.password,
        '--team-id',
        credentials.teamId,
      ];
  const args = [
    'notarytool',
    'submit',
    target,
    ...credentialArgs,
    '--wait',
    '--output-format',
    'json',
  ];
  const redactedArgs = credentials.keychainProfile
    ? args
    : args.map((arg, index) => args[index - 1] === '--password' ? '<redacted>' : arg);
  const result = run('xcrun', args, undefined, redactedArgs);
  let receipt: Record<string, unknown>;
  try {
    receipt = JSON.parse(String(result.stdout || '{}'));
  } catch {
    throw new Error('notarytool did not return a JSON receipt.');
  }
  if (receipt.status !== 'Accepted' || typeof receipt.id !== 'string' || !receipt.id) {
    throw new Error(`Apple notarization was not accepted: status=${String(receipt.status || 'missing')}.`);
  }
  return { id: receipt.id, status: receipt.status };
}

function parseOptions() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      dmg: { type: 'string' },
      output: { type: 'string' },
    },
    allowPositionals: false,
    strict: true,
  });
  if (!values.dmg || !values.output) throw new Error('Pass --dmg <path> and --output <path>.');
  return {
    dmgPath: path.resolve(values.dmg),
    outputPath: path.resolve(values.output),
  };
}

export function finalizeNotarizedDmg() {
  if (process.platform !== 'darwin') throw new Error('macOS DMG notarization requires a macOS runner.');
  const options = parseOptions();
  if (!fs.existsSync(options.dmgPath)) throw new Error(`DMG not found: ${options.dmgPath}`);
  const identity = requiredEnv('OPL_RUNTIME_CODESIGN_IDENTITY');
  const teamId = requiredEnv('teamId');
  const keychainProfile = process.env.OPL_NOTARYTOOL_KEYCHAIN_PROFILE?.trim() || '';
  const appleId = process.env.appleId?.trim() || '';
  const appleIdPassword = process.env.appleIdPassword?.trim() || '';
  if (!keychainProfile && (!appleId || !appleIdPassword)) {
    throw new Error('Missing Apple notarization credentials: configure OPL_NOTARYTOOL_KEYCHAIN_PROFILE or Apple ID credentials.');
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-notarize-dmg-'));
  const mountPoint = path.join(tempRoot, 'mount');
  const candidateDmg = path.join(
    path.dirname(options.dmgPath),
    `.${path.basename(options.dmgPath, '.dmg')}.${process.pid}.notarizing.dmg`,
  );
  let mounted = false;
  try {
    fs.mkdirSync(mountPoint);
    run('hdiutil', ['attach', options.dmgPath, '-nobrowse', '-readonly', '-mountpoint', mountPoint]);
    mounted = true;
    const sourceApp = findSingleApp(mountPoint);
    run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', sourceApp]);
    const appSignature = signatureFacts(sourceApp, teamId, true);
    run('hdiutil', ['detach', mountPoint]);
    mounted = false;

    fs.rmSync(candidateDmg, { force: true });
    fs.copyFileSync(options.dmgPath, candidateDmg);
    run('codesign', ['--force', '--timestamp', '--sign', identity, candidateDmg]);
    run('codesign', ['--verify', '--strict', '--verbose=2', candidateDmg]);
    const signedDmgSha256 = sha256(candidateDmg);
    const dmgSignature = signatureFacts(candidateDmg, teamId);
    const notarization = submitForNotarization(candidateDmg, {
      appleId,
      password: appleIdPassword,
      teamId,
      keychainProfile,
    });
    run('xcrun', ['stapler', 'staple', candidateDmg]);
    run('xcrun', ['stapler', 'validate', candidateDmg]);
    run('hdiutil', ['verify', candidateDmg]);
    run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=4', candidateDmg]);

    run('hdiutil', ['attach', candidateDmg, '-nobrowse', '-readonly', '-mountpoint', mountPoint]);
    mounted = true;
    const mountedApp = findSingleApp(mountPoint);
    run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', mountedApp]);
    run('spctl', ['--assess', '--type', 'execute', '--verbose=4', mountedApp]);
    const mountedAppSignature = signatureFacts(mountedApp, teamId, true);
    run('hdiutil', ['detach', mountPoint]);
    mounted = false;

    fs.renameSync(candidateDmg, options.dmgPath);
    const evidence = {
      schema: 'opl_apple_notarized_dmg_receipt.v1',
      status: 'passed',
      artifact: path.basename(options.dmgPath),
      team_identifier: teamId,
      signing_identity: identity,
      credential_mode: keychainProfile ? 'keychain_profile' : 'apple_id',
      app_signature: appSignature,
      mounted_app_signature: mountedAppSignature,
      dmg_signature: dmgSignature,
      notarization,
      stapler_validate_status: 'passed',
      dmg_spctl_status: 'passed',
      app_spctl_status: 'passed',
      signed_dmg_sha256_before_staple: signedDmgSha256,
      final_stapled_dmg_sha256: sha256(options.dmgPath),
      final_stapled_dmg_size_bytes: fs.statSync(options.dmgPath).size,
    };
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    return evidence;
  } finally {
    if (mounted) runCapture('hdiutil', ['detach', mountPoint]);
    fs.rmSync(candidateDmg, { force: true });
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(finalizeNotarizedDmg(), null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
