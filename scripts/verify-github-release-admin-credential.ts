#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

type JsonRecord = Record<string, any>;

export type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; timeoutMs: number },
) => CommandResult;

const canonicalRepository = 'gaofeng21cn/one-person-lab-app';
const workflowPath = '.github/workflows/release-github-admin-credentials-preflight.yml';
const endpoint = `repos/${canonicalRepository}/immutable-releases`;
const apiVersion = '2026-03-10';

const defaultRunner: CommandRunner = (command, args, options) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: options.env,
    timeout: options.timeoutMs,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
};

function execution(env: NodeJS.ProcessEnv): JsonRecord {
  return {
    workflow_ref: env.GITHUB_WORKFLOW_REF ?? null,
    run_id: env.GITHUB_RUN_ID ?? null,
    run_attempt: env.GITHUB_RUN_ATTEMPT ?? null,
    event_name: env.GITHUB_EVENT_NAME ?? null,
    ref: env.GITHUB_REF ?? null,
    head_sha: env.GITHUB_SHA ?? null,
  };
}

function baseReceipt(env: NodeJS.ProcessEnv, observedAt: string): JsonRecord {
  return {
    schema: 'opl_app_github_release_admin_credential_preflight.v1',
    status: 'failed',
    observed_at: observedAt,
    repository: canonicalRepository,
    protected_environment: 'release-stable',
    secret_name: 'OPL_GITHUB_RELEASE_ADMIN_TOKEN',
    execution: execution(env),
    request: {
      method: 'GET',
      endpoint,
      api_version: apiVersion,
      timeout_ms: 30_000,
      raw_response_persisted: false,
      raw_error_persisted: false,
    },
    authority: {
      diagnostic_only: true,
      release_authority: false,
      repository_setting_mutation_authorized: false,
      release_mutation_authorized: false,
      dispatch_rerun_cancel_authorized: false,
    },
    credential_status: 'not_checked',
    setting: null,
    failure: null,
  };
}

function failure(
  receipt: JsonRecord,
  code: string,
  httpStatus: number | null = null,
): JsonRecord {
  return {
    ...receipt,
    status: 'failed',
    credential_status: httpStatus === 401 || httpStatus === 403 ? 'rejected' : 'not_verified',
    failure: {
      code,
      http_status: httpStatus,
    },
  };
}

function executionFailure(env: NodeJS.ProcessEnv): string | null {
  if (env.GITHUB_ACTIONS !== 'true') return 'github_actions_required';
  if (env.GITHUB_REPOSITORY !== canonicalRepository) return 'canonical_repository_required';
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch') return 'workflow_dispatch_required';
  if (env.GITHUB_REF !== 'refs/heads/main') return 'canonical_main_required';
  if (env.GITHUB_RUN_ATTEMPT !== '1') return 'first_attempt_required';
  if (!/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? '')) return 'run_id_invalid';
  if (!/^[0-9a-f]{40}$/.test(env.GITHUB_SHA ?? '')) return 'head_sha_invalid';
  const expectedWorkflowRef = `${canonicalRepository}/${workflowPath}@refs/heads/main`;
  if (env.GITHUB_WORKFLOW_REF !== expectedWorkflowRef) return 'canonical_workflow_ref_required';
  return null;
}

function httpStatus(stderr: string): number | null {
  const match = stderr.match(/\bHTTP\s+([1-5][0-9]{2})\b/i);
  return match ? Number(match[1]) : null;
}

function failureCode(status: number | null): string {
  if (status === 401) return 'github_release_admin_credential_rejected';
  if (status === 403) return 'github_release_admin_credential_scope_rejected';
  if (status !== null) return 'github_release_admin_capability_get_failed';
  return 'github_release_admin_capability_transport_failed';
}

export function verifyGithubReleaseAdminCredential(options: {
  outputPath: string;
  env?: NodeJS.ProcessEnv;
  runner?: CommandRunner;
  observedAt?: string;
}): JsonRecord {
  const env = options.env ?? process.env;
  const observedAt = options.observedAt ?? new Date().toISOString();
  const base = baseReceipt(env, observedAt);
  let receipt: JsonRecord;
  const admissionFailure = executionFailure(env);
  const token = env.OPL_GITHUB_RELEASE_ADMIN_TOKEN?.trim() ?? '';
  if (admissionFailure) {
    receipt = failure(base, admissionFailure);
  } else if (!token) {
    receipt = failure(base, 'github_release_admin_credential_missing');
  } else {
    const commandEnvironment = { ...env, GH_TOKEN: token };
    delete commandEnvironment.OPL_GITHUB_RELEASE_ADMIN_TOKEN;
    const result = (options.runner ?? defaultRunner)(
      'gh',
      [
        'api',
        '--method',
        'GET',
        endpoint,
        '-H',
        `X-GitHub-Api-Version: ${apiVersion}`,
      ],
      { env: commandEnvironment, timeoutMs: 30_000 },
    );
    if (result.status !== 0 || result.error) {
      const status = httpStatus(result.stderr);
      receipt = failure(base, failureCode(status), status);
    } else {
      try {
        const setting = JSON.parse(result.stdout) as JsonRecord;
        if (setting.enabled !== true || setting.enforced_by_owner !== false) {
          receipt = failure(base, 'repository_immutability_setting_not_safe', 200);
        } else {
          receipt = {
            ...base,
            status: 'passed',
            credential_status: 'usable',
            setting: {
              enabled: true,
              enforced_by_owner: false,
            },
            failure: null,
          };
        }
      } catch {
        receipt = failure(base, 'github_release_admin_capability_response_invalid', 200);
      }
    }
  }
  const output = path.resolve(options.outputPath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return receipt;
}

function main(): void {
  const { values } = parseArgs({
    strict: true,
    options: {
      output: { type: 'string' },
    },
  });
  if (!values.output) {
    throw new Error('Usage: verify-github-release-admin-credential.ts --output <receipt.json>.');
  }
  const receipt = verifyGithubReleaseAdminCredential({ outputPath: values.output });
  process.stdout.write(`${JSON.stringify({ status: receipt.status, output: path.resolve(values.output) })}\n`);
  if (receipt.status !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
