#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

type CommandResult = ReturnType<typeof spawnSync>;

type NotarizationState = {
  id: string | null;
  status: string | null;
  submitted_at: string | null;
  last_observed_at: string | null;
  wait_timeout_seconds: number | null;
};

type FailureEvidence = {
  code: string;
  stage: string;
  message: string;
  retry_disposition: string;
};

const defaultCommandTimeoutMs = 45 * 60_000;
const postNotarizationReserveMs = 20 * 60_000;
const minimumNotarizationWaitMs = 60_000;

function testMode(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.OPL_NOTARIZATION_TEST_MODE === 'true';
}

function commandPath(command: string): string {
  if (!testMode()) return command;
  const root = requiredEnv('OPL_NOTARIZATION_TEST_COMMAND_ROOT');
  return path.join(root, command);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() || '';
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function runCapture(command: string, args: string[], timeout = defaultCommandTimeoutMs): CommandResult {
  return spawnSync(commandPath(command), args, {
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
      result.error?.message ? `error: ${result.error.message}` : '',
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : '',
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : '',
    ].filter(Boolean).join('\n'));
  }
  return result;
}

function parseJsonResult(result: CommandResult): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(String(result.stdout || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

export function notarizationWaitTimeoutSeconds(input: {
  operationDeadlineAt?: string;
  nowMs?: number;
  reserveMs?: number;
}): number {
  if (!input.operationDeadlineAt) return defaultCommandTimeoutMs / 1_000;
  const deadlineMs = Date.parse(input.operationDeadlineAt);
  const nowMs = input.nowMs ?? Date.now();
  const reserveMs = input.reserveMs ?? postNotarizationReserveMs;
  if (!Number.isFinite(deadlineMs)) {
    throw new Error('Operation deadline must be an exact ISO-8601 timestamp.');
  }
  const waitMs = deadlineMs - nowMs - reserveMs;
  if (waitMs < minimumNotarizationWaitMs) {
    throw new Error('Notarization cannot start without one minute of wait budget and twenty minutes of operation reserve.');
  }
  return Math.floor(waitMs / 1_000);
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
}, operationDeadlineAt: string, persist: (state: NotarizationState) => void) {
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
  const redactedCredentialArgs = credentialArgs.map((argument) => {
    if (argument === credentials.appleId) return '<redacted-apple-id>';
    if (argument === credentials.password) return '<redacted-password>';
    return argument;
  });
  const submitArgs = [
    'notarytool',
    'submit',
    target,
    ...credentialArgs,
    '--output-format',
    'json',
  ];
  const redactedSubmitArgs = [
    'notarytool',
    'submit',
    target,
    ...redactedCredentialArgs,
    '--output-format',
    'json',
  ];
  const submitBudgetSeconds = notarizationWaitTimeoutSeconds({ operationDeadlineAt });
  const submitted = parseJsonResult(run(
    'xcrun',
    submitArgs,
    Math.min(defaultCommandTimeoutMs, submitBudgetSeconds * 1_000),
    redactedSubmitArgs,
  ));
  const id = typeof submitted?.id === 'string' && submitted.id ? submitted.id : null;
  const submittedStatus = typeof submitted?.status === 'string' && submitted.status
    ? submitted.status
    : null;
  if (!id) throw new Error('notarytool submit did not return a submission id.');

  const state: NotarizationState = {
    id,
    status: submittedStatus,
    submitted_at: new Date().toISOString(),
    last_observed_at: new Date().toISOString(),
    wait_timeout_seconds: null,
  };
  persist(state);

  const waitTimeoutSeconds = notarizationWaitTimeoutSeconds({ operationDeadlineAt });
  state.wait_timeout_seconds = waitTimeoutSeconds;
  persist(state);
  const waitArgs = [
    'notarytool',
    'wait',
    id,
    ...credentialArgs,
    '--timeout',
    `${waitTimeoutSeconds}s`,
    '--output-format',
    'json',
  ];
  const waitResult = runCapture('xcrun', waitArgs, (waitTimeoutSeconds + 30) * 1_000);
  let observed = parseJsonResult(waitResult);
  if (observed?.status !== 'Accepted') {
    const infoArgs = [
      'notarytool',
      'info',
      id,
      ...credentialArgs,
      '--output-format',
      'json',
    ];
    const infoResult = runCapture('xcrun', infoArgs, 30_000);
    observed = parseJsonResult(infoResult) ?? observed;
  }
  state.status = typeof observed?.status === 'string' && observed.status
    ? observed.status
    : state.status;
  state.last_observed_at = new Date().toISOString();
  persist(state);
  if (state.status !== 'Accepted') {
    throw new Error(
      `Apple notarization submission ${id} did not reach Accepted within the bounded wait: status=${state.status || 'unknown'}.`,
    );
  }
  return { id, status: state.status };
}

function parseOptions() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      dmg: { type: 'string' },
      output: { type: 'string' },
      'operation-deadline-at': { type: 'string' },
    },
    allowPositionals: false,
    strict: true,
  });
  if (!values.dmg || !values.output) throw new Error('Pass --dmg <path> and --output <path>.');
  return {
    dmgPath: path.resolve(values.dmg),
    outputPath: path.resolve(values.output),
    operationDeadlineAt: values['operation-deadline-at']?.trim() || '',
  };
}

export function finalizeNotarizedDmg() {
  if (process.platform !== 'darwin' && !testMode()) throw new Error('macOS DMG notarization requires a macOS runner.');
  const options = parseOptions();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-notarize-dmg-'));
  const mountPoint = path.join(tempRoot, 'mount');
  const candidateDmg = path.join(
    path.dirname(options.dmgPath),
    `.${path.basename(options.dmgPath, '.dmg')}.${process.pid}.notarizing.dmg`,
  );
  let mounted = false;
  let stage = 'preflight';
  const evidence: Record<string, any> = {
    schema: 'opl_apple_notarized_dmg_receipt.v1',
    status: 'failed',
    artifact: path.basename(options.dmgPath),
    operation_deadline_at: options.operationDeadlineAt || null,
    team_identifier: null,
    signing_identity: null,
    credential_mode: null,
    notarization: {
      id: null,
      status: null,
      submitted_at: null,
      last_observed_at: null,
      wait_timeout_seconds: null,
    } satisfies NotarizationState,
    failure: null,
  };
  const persist = () => writeJsonAtomic(options.outputPath, evidence);
  try {
    if (!fs.existsSync(options.dmgPath)) throw new Error(`DMG not found: ${options.dmgPath}`);
    const identity = requiredEnv('OPL_RUNTIME_CODESIGN_IDENTITY');
    const teamId = requiredEnv('teamId');
    const keychainProfile = process.env.OPL_NOTARYTOOL_KEYCHAIN_PROFILE?.trim() || '';
    const appleId = process.env.appleId?.trim() || '';
    const appleIdPassword = process.env.appleIdPassword?.trim() || '';
    if (!keychainProfile && (!appleId || !appleIdPassword)) {
      throw new Error('Missing Apple notarization credentials: configure OPL_NOTARYTOOL_KEYCHAIN_PROFILE or Apple ID credentials.');
    }
    evidence.team_identifier = teamId;
    evidence.signing_identity = identity;
    evidence.credential_mode = keychainProfile ? 'keychain_profile' : 'apple_id';

    stage = 'verify_embedded_app';
    fs.mkdirSync(mountPoint);
    run('hdiutil', ['attach', options.dmgPath, '-nobrowse', '-readonly', '-mountpoint', mountPoint]);
    mounted = true;
    const sourceApp = findSingleApp(mountPoint);
    run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', sourceApp]);
    const appSignature = signatureFacts(sourceApp, teamId, true);
    run('hdiutil', ['detach', mountPoint]);
    mounted = false;

    stage = 'sign_dmg';
    fs.rmSync(candidateDmg, { force: true });
    fs.copyFileSync(options.dmgPath, candidateDmg);
    run('codesign', ['--force', '--timestamp', '--sign', identity, candidateDmg]);
    run('codesign', ['--verify', '--strict', '--verbose=2', candidateDmg]);
    const signedDmgSha256 = sha256(candidateDmg);
    const dmgSignature = signatureFacts(candidateDmg, teamId);
    stage = 'submit_and_wait';
    const notarization = submitForNotarization(candidateDmg, {
      appleId,
      password: appleIdPassword,
      teamId,
      keychainProfile,
    }, options.operationDeadlineAt, (notarizationState) => {
      evidence.notarization = { ...notarizationState };
      persist();
    });
    stage = 'staple_and_verify';
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
    Object.assign(evidence, {
      status: 'passed',
      app_signature: appSignature,
      mounted_app_signature: mountedAppSignature,
      dmg_signature: dmgSignature,
      notarization: { ...evidence.notarization, ...notarization },
      stapler_validate_status: 'passed',
      dmg_spctl_status: 'passed',
      app_spctl_status: 'passed',
      signed_dmg_sha256_before_staple: signedDmgSha256,
      final_stapled_dmg_sha256: sha256(options.dmgPath),
      final_stapled_dmg_size_bytes: fs.statSync(options.dmgPath).size,
      failure: null,
    });
    persist();
    return evidence;
  } catch (error) {
    const hasSubmissionId = typeof evidence.notarization.id === 'string' && evidence.notarization.id.length > 0;
    evidence.status = 'failed';
    evidence.failure = {
      code: hasSubmissionId
        ? 'notarization_submission_incomplete'
        : stage === 'submit_and_wait'
          ? 'notarization_submission_outcome_unknown'
          : 'notarization_finalization_failed',
      stage,
      message: error instanceof Error ? error.message : String(error),
      retry_disposition: hasSubmissionId
        ? 'read_only_reconcile_submission_no_retry'
        : stage === 'submit_and_wait'
          ? 'read_only_history_reconcile_before_new_operation'
          : 'new_operation_required_no_retry',
    } satisfies FailureEvidence;
    persist();
    throw error;
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
