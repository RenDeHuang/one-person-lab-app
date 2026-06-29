#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyStringOptionArg } from './cli-option-args.ts';
import { parseStrictBoolean } from './release-readiness-args.ts';

const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type CheckStatus = 'passed' | 'failed' | 'skipped';
type CommandResult = { status: number | null; stdout: string; stderr: string };
export type CommandRunner = (command: string, args: string[], options: { cwd: string }) => CommandResult;

export type ReleaseSourceGateOptions = {
  expectedAppHead: string;
  shellRef: string;
  requireShellFormat: boolean;
  repoRoot: string;
  output: string;
  json: boolean;
};

type Check = {
  id: string;
  status: CheckStatus;
  message: string;
  expected?: string;
  actual?: string;
  command?: string;
};

type RequiredGate = {
  id: string;
  required: true;
  command: string;
  cwd: string;
  executed: boolean;
  reason: string;
};

export type ReleaseSourceGateReport = {
  schema: 'opl_app_release_source_gate.v1';
  generated_at: string;
  status: 'passed' | 'failed';
  repo_root: string;
  expected_app_head: string;
  app_head: string | null;
  shell_ref: string;
  shell_root: string;
  require_shell_format: boolean;
  checks: Check[];
  required_gates: RequiredGate[];
};

export type ReleaseSourceGateEnvironment = {
  pathExists?: (candidatePath: string) => boolean;
};

function usage(): void {
  process.stdout.write(`Usage:
  npm run release:source-gate -- --expected-app-head <sha> --shell-ref <ref>

Options:
  --expected-app-head <sha>        Expected App repository HEAD commit.
  --shell-ref <ref>                Active shell ref to resolve in shells/aionui. Default: main.
  --require-shell-format <bool>    Run bun run format:check in the active shell. Default: false.
  --repo-root <path>               App repository root. Default: current script repository.
  --output <path>                  Write source gate JSON report.
  --json                          Print the JSON report to stdout.
  --help                          Show this message.
`);
}

function defaultOptions(): ReleaseSourceGateOptions {
  return {
    expectedAppHead: process.env.OPL_EXPECTED_APP_HEAD || process.env.GITHUB_SHA || '',
    shellRef: process.env.OPL_SHELL_REF || 'main',
    requireShellFormat: parseStrictBoolean(process.env.OPL_REQUIRE_SHELL_FORMAT, false),
    repoRoot: defaultRepoRoot,
    output: process.env.OPL_RELEASE_SOURCE_GATE_OUTPUT || '',
    json: false,
  };
}

export function parseReleaseSourceGateArgs(argv: string[]): ReleaseSourceGateOptions {
  const parsed = defaultOptions();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    }
    if (token === '--json') {
      parsed.json = true;
      continue;
    }
    const optionIndex = applyStringOptionArg(argv, index, {
      '--expected-app-head': (value) => { parsed.expectedAppHead = value; },
      '--shell-ref': (value) => { parsed.shellRef = value; },
      '--require-shell-format': (value) => { parsed.requireShellFormat = parseStrictBoolean(value); },
      '--repo-root': (value) => { parsed.repoRoot = value; },
      '--output': (value) => { parsed.output = value; },
    });
    if (optionIndex !== null) {
      index = optionIndex;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!parsed.expectedAppHead.trim()) {
    throw new Error('Pass --expected-app-head <sha> or set OPL_EXPECTED_APP_HEAD/GITHUB_SHA.');
  }
  if (!parsed.shellRef.trim()) throw new Error('Pass --shell-ref <ref> or set OPL_SHELL_REF.');
  return {
    ...parsed,
    repoRoot: path.resolve(parsed.repoRoot),
    output: parsed.output ? path.resolve(parsed.output) : '',
  };
}

function run(command: string, args: string[], options: { cwd: string }): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
}

function commandText(command: string, args: string[]): string {
  return [command, ...args].join(' ');
}

function commandDetail(result: CommandResult): string {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

function addCheck(checks: Check[], check: Check): void {
  checks.push(check);
}

function refCandidates(ref: string): string[] {
  if (/^[0-9a-f]{7,40}$/i.test(ref)) return [ref, 'HEAD'];
  return [ref, `refs/heads/${ref}`, `refs/remotes/origin/${ref}`, `refs/tags/${ref}`, 'HEAD'];
}

function resolveShellRef(shellRoot: string, shellRef: string, runner: CommandRunner): string | null {
  for (const candidate of refCandidates(shellRef)) {
    const result = runner('git', ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`], { cwd: shellRoot });
    const resolved = firstLine(result.stdout);
    if (result.status === 0 && resolved) return resolved;
  }
  return null;
}

function appHeadMatches(expected: string, actual: string): boolean {
  const normalizedExpected = expected.trim().toLowerCase();
  const normalizedActual = actual.trim().toLowerCase();
  if (normalizedExpected.length < 7) return false;
  return normalizedActual === normalizedExpected || normalizedActual.startsWith(normalizedExpected);
}

export function buildReleaseSourceGateReport(
  options: ReleaseSourceGateOptions,
  runner: CommandRunner = run,
  generatedAt = new Date().toISOString(),
  environment: ReleaseSourceGateEnvironment = {},
): ReleaseSourceGateReport {
  const pathExists = environment.pathExists ?? fs.existsSync;
  const shellRoot = path.join(options.repoRoot, 'shells', 'aionui');
  const checks: Check[] = [];
  const requiredGates: RequiredGate[] = [
    {
      id: 'active_shell_format_check',
      required: true,
      command: 'bun run format:check',
      cwd: shellRoot,
      executed: options.requireShellFormat,
      reason: 'Release source gate must prove or require active shell formatting before expensive release work.',
    },
  ];

  const appHeadResult = runner('git', ['rev-parse', 'HEAD'], { cwd: options.repoRoot });
  const appHead = appHeadResult.status === 0 ? firstLine(appHeadResult.stdout) : '';
  addCheck(checks, appHead
    ? {
        id: 'app_head_resolved',
        status: 'passed',
        message: `Resolved App HEAD ${appHead}.`,
        actual: appHead,
        command: commandText('git', ['rev-parse', 'HEAD']),
      }
    : {
        id: 'app_head_resolved',
        status: 'failed',
        message: `Unable to resolve App HEAD.${commandDetail(appHeadResult) ? ` ${commandDetail(appHeadResult)}` : ''}`,
        command: commandText('git', ['rev-parse', 'HEAD']),
      });
  if (appHead) {
    addCheck(checks, {
      id: 'expected_app_head',
      status: appHeadMatches(options.expectedAppHead, appHead) ? 'passed' : 'failed',
      message: appHeadMatches(options.expectedAppHead, appHead)
        ? 'App HEAD matches the expected release dispatch commit.'
        : `App HEAD does not match expected release dispatch commit ${options.expectedAppHead}.`,
      expected: options.expectedAppHead,
      actual: appHead,
      command: commandText('git', ['rev-parse', 'HEAD']),
    });
  }

  const appStatusResult = runner('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: options.repoRoot });
  const statusText = appStatusResult.stdout.trim();
  addCheck(checks, {
    id: 'app_worktree_clean',
    status: appStatusResult.status === 0 && !statusText ? 'passed' : 'failed',
    message: appStatusResult.status === 0 && !statusText
      ? 'App worktree is clean.'
      : `App worktree must be clean before release work.${statusText ? ` Dirty entries:\n${statusText}` : ''}`,
    actual: statusText || undefined,
    command: commandText('git', ['status', '--porcelain', '--untracked-files=normal']),
  });

  if (!pathExists(shellRoot)) {
    addCheck(checks, { id: 'active_shell_checkout', status: 'failed', message: `Active shell checkout is missing at ${shellRoot}.` });
  } else {
    addCheck(checks, { id: 'active_shell_checkout', status: 'passed', message: `Active shell checkout exists at ${shellRoot}.` });
    const resolvedShellRef = resolveShellRef(shellRoot, options.shellRef, runner);
    addCheck(checks, {
      id: 'active_shell_ref_resolved',
      status: resolvedShellRef ? 'passed' : 'failed',
      message: resolvedShellRef
        ? `Active shell ref ${options.shellRef} resolves to ${resolvedShellRef}.`
        : `Active shell ref ${options.shellRef} cannot be resolved in ${shellRoot}.`,
      expected: options.shellRef,
      actual: resolvedShellRef ?? undefined,
      command: commandText('git', ['rev-parse', '--verify', '--quiet', `${options.shellRef}^{commit}`]),
    });
  }

  if (options.requireShellFormat) {
    const formatResult = runner('bun', ['run', 'format:check'], { cwd: shellRoot });
    addCheck(checks, {
      id: 'active_shell_format_check',
      status: formatResult.status === 0 ? 'passed' : 'failed',
      message: formatResult.status === 0
        ? 'Active shell format check passed.'
        : `Active shell format check failed.${commandDetail(formatResult) ? `\n${commandDetail(formatResult)}` : ''}`,
      command: 'bun run format:check',
    });
  } else {
    addCheck(checks, {
      id: 'active_shell_format_check',
      status: 'skipped',
      message: 'Active shell format check was not executed; required gate command is emitted for CI enforcement.',
      command: 'bun run format:check',
    });
  }

  return {
    schema: 'opl_app_release_source_gate.v1',
    generated_at: generatedAt,
    status: checks.some((check) => check.status === 'failed') ? 'failed' : 'passed',
    repo_root: options.repoRoot,
    expected_app_head: options.expectedAppHead,
    app_head: appHead || null,
    shell_ref: options.shellRef,
    shell_root: shellRoot,
    require_shell_format: options.requireShellFormat,
    checks,
    required_gates: requiredGates,
  };
}

export function writeReleaseSourceGateReport(options: ReleaseSourceGateOptions, report: ReleaseSourceGateReport): void {
  if (!options.output) return;
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function isMainModule(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isMainModule()) {
  try {
    const options = parseReleaseSourceGateArgs(process.argv.slice(2));
    const report = buildReleaseSourceGateReport(options);
    writeReleaseSourceGateReport(options, report);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`Release source gate ${report.status} for ${report.app_head ?? '(unresolved)'}.\n`);
    }
    if (report.status !== 'passed') process.exit(1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
