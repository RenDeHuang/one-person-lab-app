#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';

const requiredSecretNames = [
  'BUILD_CERTIFICATE_BASE64',
  'P12_PASSWORD',
  'APPLE_ID',
  'APPLE_ID_PASSWORD',
  'TEAM_ID',
  'IDENTITY',
] as const;

type RequiredSecretName = (typeof requiredSecretNames)[number];

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

type CommandOptions = {
  redactedArgs?: string[];
  sensitiveValues?: string[];
};

export type CommandRunner = (
  command: string,
  args: string[],
  options?: CommandOptions,
) => CommandResult;

type VerifyOptions = {
  outputPath: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  runner?: CommandRunner;
  now?: () => Date;
};

type SigningFacts = {
  teamIdentifier: string;
  authorities: string[];
  runtimeVersion: string | null;
  timestamp: string | null;
};

type GithubExecution = {
  environment: 'github_actions' | 'local';
  admission_eligible: boolean;
  repository: string | null;
  workflow_ref: string | null;
  run_id: string | null;
  run_attempt: number | null;
  event_name: string | null;
  ref: string | null;
  head_sha: string | null;
};

function defaultRunner(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
  };
}

function requiredEnv(env: NodeJS.ProcessEnv, name: RequiredSecretName): string {
  const value = env[name]?.trim() || '';
  if (!value) throw new Error(`Missing required GitHub Actions secret: ${name}`);
  return value;
}

export function decodeBase64Strict(value: string): Buffer {
  const normalized = value.replace(/\s+/g, '');
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error('BUILD_CERTIFICATE_BASE64 is not valid base64.');
  }
  const decoded = Buffer.from(normalized, 'base64');
  const roundTrip = decoded.toString('base64');
  if (roundTrip !== normalized) {
    throw new Error('BUILD_CERTIFICATE_BASE64 is not canonical base64.');
  }
  return decoded;
}

export function parseSigningFacts(output: string): SigningFacts {
  const teamIdentifier = output.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() || '';
  const authorities = [...output.matchAll(/^Authority=(.+)$/gm)].map((match) => match[1].trim());
  const runtimeVersion = output.match(/^Runtime Version=(.+)$/m)?.[1]?.trim() || null;
  const timestamp = output.match(/^Timestamp=(.+)$/m)?.[1]?.trim() || null;
  return { teamIdentifier, authorities, runtimeVersion, timestamp };
}

function commandText(command: string, args: string[]) {
  return [command, ...args].map((entry) => JSON.stringify(entry)).join(' ');
}

function redactText(value: string, sensitiveValues: string[] = []) {
  return sensitiveValues
    .filter(Boolean)
    .reduce((redacted, secret) => redacted.replaceAll(secret, '<redacted>'), value);
}

function runRequired(
  runner: CommandRunner,
  command: string,
  args: string[],
  options: CommandOptions = {},
) {
  const result = runner(command, args, options);
  if (result.status !== 0) {
    const displayArgs = options.redactedArgs ?? args;
    throw new Error([
      `Command failed: ${commandText(command, displayArgs)}`,
      result.stdout.trim()
        ? `stdout:\n${redactText(result.stdout.trim(), options.sensitiveValues)}`
        : '',
      result.stderr.trim()
        ? `stderr:\n${redactText(result.stderr.trim(), options.sensitiveValues)}`
        : '',
      result.error?.message
        ? `error:\n${redactText(result.error.message, options.sensitiveValues)}`
        : '',
    ].filter(Boolean).join('\n'));
  }
  return result;
}

function parseNotaryHistory(stdout: string) {
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(stdout);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    payload = parsed as Record<string, unknown>;
  } catch {
    throw new Error('Apple notarytool history did not return a JSON object.');
  }
  const entries = Array.isArray(payload.history)
    ? payload.history
    : Array.isArray(payload.submissions)
      ? payload.submissions
      : [];
  return { historyCount: entries.length };
}

function githubExecution(env: NodeJS.ProcessEnv): GithubExecution {
  if (env.GITHUB_ACTIONS !== 'true') {
    return {
      environment: 'local',
      admission_eligible: false,
      repository: null,
      workflow_ref: null,
      run_id: null,
      run_attempt: null,
      event_name: null,
      ref: null,
      head_sha: null,
    };
  }
  const repository = env.GITHUB_REPOSITORY?.trim() || '';
  const workflowRef = env.GITHUB_WORKFLOW_REF?.trim() || '';
  const runId = env.GITHUB_RUN_ID?.trim() || '';
  const runAttemptText = env.GITHUB_RUN_ATTEMPT?.trim() || '';
  const eventName = env.GITHUB_EVENT_NAME?.trim() || '';
  const ref = env.GITHUB_REF?.trim() || '';
  const headSha = env.GITHUB_SHA?.trim().toLowerCase() || '';
  const runAttempt = Number(runAttemptText);
  if (
    repository !== 'gaofeng21cn/one-person-lab-app'
    || !workflowRef.includes('/.github/workflows/')
    || !/^[1-9][0-9]*$/.test(runId)
    || runAttempt !== 1
    || eventName !== 'workflow_dispatch'
    || ref !== 'refs/heads/main'
    || !/^[0-9a-f]{40}$/.test(headSha)
  ) {
    throw new Error(
      'GitHub Apple credential preflight must be a first-attempt workflow_dispatch on canonical App main.',
    );
  }
  return {
    environment: 'github_actions',
    admission_eligible: true,
    repository,
    workflow_ref: workflowRef,
    run_id: runId,
    run_attempt: runAttempt,
    event_name: eventName,
    ref,
    head_sha: headSha,
  };
}

export function verifyAppleReleaseCredentials(options: VerifyOptions) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const runner = options.runner ?? defaultRunner;
  const now = options.now ?? (() => new Date());
  if (platform !== 'darwin') {
    throw new Error('Apple release credential preflight requires a macOS runner.');
  }

  const secrets = Object.fromEntries(
    requiredSecretNames.map((name) => [name, requiredEnv(env, name)]),
  ) as Record<RequiredSecretName, string>;
  if (secrets.IDENTITY === '-') {
    throw new Error('IDENTITY must select a Developer ID Application certificate; ad-hoc signing is forbidden.');
  }
  const execution = githubExecution(env);
  const certificateBytes = decodeBase64Strict(secrets.BUILD_CERTIFICATE_BASE64);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-apple-credential-preflight-'));
  const keychainPath = path.join(tempRoot, 'preflight.keychain-db');
  const certificatePath = path.join(tempRoot, 'certificate.p12');
  const probePath = path.join(tempRoot, 'codesign-probe');
  const keychainPassword = crypto.randomBytes(32).toString('hex');
  let keychainCreated = false;

  try {
    fs.writeFileSync(certificatePath, certificateBytes, { mode: 0o600 });
    runRequired(runner, 'security', ['create-keychain', '-p', keychainPassword, keychainPath], {
      redactedArgs: ['create-keychain', '-p', '<redacted>', keychainPath],
      sensitiveValues: [keychainPassword],
    });
    keychainCreated = true;
    runRequired(runner, 'security', ['unlock-keychain', '-p', keychainPassword, keychainPath], {
      redactedArgs: ['unlock-keychain', '-p', '<redacted>', keychainPath],
      sensitiveValues: [keychainPassword],
    });
    runRequired(runner, 'security', ['set-keychain-settings', '-lut', '900', keychainPath]);
    runRequired(
      runner,
      'security',
      ['import', certificatePath, '-k', keychainPath, '-P', secrets.P12_PASSWORD, '-T', '/usr/bin/codesign'],
      {
        redactedArgs: [
          'import',
          certificatePath,
          '-k',
          keychainPath,
          '-P',
          '<redacted>',
          '-T',
          '/usr/bin/codesign',
        ],
        sensitiveValues: [secrets.P12_PASSWORD, secrets.IDENTITY],
      },
    );
    runRequired(
      runner,
      'security',
      ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', keychainPassword, keychainPath],
      {
        redactedArgs: [
          'set-key-partition-list',
          '-S',
          'apple-tool:,apple:,codesign:',
          '-s',
          '-k',
          '<redacted>',
          keychainPath,
        ],
        sensitiveValues: [keychainPassword],
      },
    );

    const identities = runRequired(
      runner,
      'security',
      ['find-identity', '-v', '-p', 'codesigning', keychainPath],
      { sensitiveValues: [secrets.IDENTITY] },
    );
    const importedDeveloperIdIdentities = [
      ...identities.stdout.matchAll(
        /^\s*\d+\)\s+[0-9a-f]{40}\s+"(Developer ID Application:[^"]+)"$/gim,
      ),
    ];
    if (importedDeveloperIdIdentities.length === 0) {
      throw new Error('Imported P12 does not expose a Developer ID Application identity.');
    }

    fs.copyFileSync('/usr/bin/true', probePath);
    fs.chmodSync(probePath, 0o755);
    runRequired(
      runner,
      'codesign',
      [
        '--force',
        '--timestamp',
        '--options',
        'runtime',
        '--keychain',
        keychainPath,
        '--sign',
        secrets.IDENTITY,
        probePath,
      ],
      {
        redactedArgs: [
          '--force',
          '--timestamp',
          '--options',
          'runtime',
          '--keychain',
          keychainPath,
          '--sign',
          '<configured-identity>',
          probePath,
        ],
        sensitiveValues: [secrets.IDENTITY],
      },
    );
    runRequired(runner, 'codesign', ['--verify', '--strict', '--verbose=2', probePath]);
    const details = runRequired(runner, 'codesign', ['-dv', '--verbose=4', probePath]);
    const signingFacts = parseSigningFacts(`${details.stdout}\n${details.stderr}`);
    if (!signingFacts.authorities.some((authority) => authority.startsWith('Developer ID Application:'))) {
      throw new Error('Signed probe does not contain a Developer ID Application authority.');
    }
    if (signingFacts.teamIdentifier !== secrets.TEAM_ID) {
      throw new Error('Imported Developer ID TeamIdentifier mismatch.');
    }
    if (!signingFacts.runtimeVersion) {
      throw new Error('Signed probe does not contain the hardened runtime flag.');
    }
    if (!signingFacts.timestamp) {
      throw new Error('Signed probe does not contain a trusted timestamp.');
    }

    const notary = runRequired(
      runner,
      'xcrun',
      [
        'notarytool',
        'history',
        '--apple-id',
        secrets.APPLE_ID,
        '--password',
        secrets.APPLE_ID_PASSWORD,
        '--team-id',
        secrets.TEAM_ID,
        '--output-format',
        'json',
      ],
      {
        redactedArgs: [
          'notarytool',
          'history',
          '--apple-id',
          '<redacted>',
          '--password',
          '<redacted>',
          '--team-id',
          '<redacted>',
          '--output-format',
          'json',
        ],
        sensitiveValues: [secrets.APPLE_ID, secrets.APPLE_ID_PASSWORD, secrets.TEAM_ID],
      },
    );
    const notaryHistory = parseNotaryHistory(notary.stdout);
    const receipt = {
      schema: 'opl_apple_release_credentials_preflight.v1',
      status: 'passed',
      checked_at: now().toISOString(),
      platform: 'darwin',
      protected_environment: 'release-stable',
      execution,
      required_secret_names: [...requiredSecretNames],
      required_secret_count: requiredSecretNames.length,
      signing: {
        configured_identity_selector_resolved: true,
        configured_team_id_match: true,
        developer_id_application: true,
        hardened_runtime: true,
        trusted_timestamp: true,
        probe_codesign_strict: 'passed',
      },
      notarization: {
        authentication: 'passed',
        command: 'xcrun notarytool history',
        history_count: notaryHistory.historyCount,
        submission_performed: false,
      },
      mutation: {
        release_dispatch_performed: false,
        notarization_submission_performed: false,
        public_asset_write_performed: false,
      },
      truth_boundary: execution.admission_eligible
        ? 'canonical_main_credential_runtime_preflight_not_release_or_artifact_qualification'
        : 'local_credential_runtime_diagnostic_not_dispatch_admission',
    };
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    return receipt;
  } finally {
    if (keychainCreated) {
      runner('security', ['delete-keychain', keychainPath]);
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function cliOptions() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      output: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.output) throw new Error('Pass --output <receipt.json>.');
  return { outputPath: path.resolve(values.output) };
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  try {
    const receipt = verifyAppleReleaseCredentials(cliOptions());
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
