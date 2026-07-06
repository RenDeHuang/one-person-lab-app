#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { parseStrictBoolean } from './release-readiness-args.ts';

const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type CheckStatus = 'passed' | 'failed' | 'skipped';

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type CommandRunner = (command: string, args: string[], options: { cwd: string }) => CommandResult;

export type ReleaseSourceGateOptions = {
  version: string;
  expectedAppHead: string;
  shellRef: string;
  frameworkRef: string;
  requireShellFormat: boolean;
  runShellTests: boolean;
  repoRoot: string;
  frameworkRoot: string;
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
  version: string;
  expected_app_head: string;
  app_head: string | null;
  shell_ref: string;
  shell_sha: string | null;
  shell_root: string;
  framework_ref: string;
  framework_sha: string | null;
  framework_root: string;
  require_shell_format: boolean;
  run_shell_tests: boolean;
  checks: Check[];
  required_gates: RequiredGate[];
};

export type ReleaseSourceGateEnvironment = {
  pathExists?: (candidatePath: string) => boolean;
  readJson?: (candidatePath: string) => unknown;
};

function usage(): void {
  process.stdout.write(`Usage:
  npm run release:source-gate -- --version <version> --app-ref <sha> --shell-ref <ref> --framework-ref <ref>

Options:
  --version <version>              Release version for the candidate cohort.
  --app-ref <sha>                  Expected App repository HEAD commit.
  --expected-app-head <sha>        Alias for --app-ref.
  --shell-ref <ref>                Active shell ref to resolve in shells/aionui. Default: main.
  --framework-ref <ref>            OPL Framework ref to resolve. Default: main.
  --require-shell-format <bool>    Run bun run format:check in the active shell. Default: false.
  --run-shell-tests <bool>         Run active shell node/dom tests before expensive release jobs. Default: false.
  --repo-root <path>               App repository root. Default: current script repository.
  --framework-root <path>          OPL Framework checkout root. Default: ../one-person-lab.
  --output <path>                  Write source gate JSON report.
  --json                          Print the JSON report to stdout.
  --help                          Show this message.
`);
}

function defaultOptions(): ReleaseSourceGateOptions {
  return {
    version: process.env.OPL_RELEASE_VERSION || '',
    expectedAppHead: process.env.OPL_EXPECTED_APP_HEAD || process.env.GITHUB_SHA || '',
    shellRef: process.env.OPL_SHELL_REF || 'main',
    frameworkRef: process.env.OPL_FRAMEWORK_REF || 'main',
    requireShellFormat: parseStrictBoolean(process.env.OPL_REQUIRE_SHELL_FORMAT, false),
    runShellTests: parseStrictBoolean(process.env.OPL_RELEASE_SOURCE_GATE_RUN_SHELL_TESTS, false),
    repoRoot: defaultRepoRoot,
    frameworkRoot: process.env.OPL_FRAMEWORK_ROOT || path.resolve(defaultRepoRoot, '..', 'one-person-lab'),
    output: process.env.OPL_RELEASE_SOURCE_GATE_OUTPUT || '',
    json: false,
  };
}

export function parseReleaseSourceGateArgs(argv: string[]): ReleaseSourceGateOptions {
  const parsed = defaultOptions();
  const { values, tokens } = parseNodeArgs({
    args: argv,
    tokens: true,
    options: {
      version: { type: 'string' },
      'app-ref': { type: 'string' },
      'expected-app-head': { type: 'string' },
      'shell-ref': { type: 'string' },
      'framework-ref': { type: 'string' },
      'require-shell-format': { type: 'string' },
      'run-shell-tests': { type: 'string' },
      'repo-root': { type: 'string' },
      'framework-root': { type: 'string' },
      output: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    usage();
    process.exit(0);
  }
  parsed.version = values.version ?? parsed.version;
  const expectedAppHeadToken = tokens
    .filter((token) => token.kind === 'option' && (token.name === 'app-ref' || token.name === 'expected-app-head'))
    .at(-1);
  parsed.expectedAppHead = expectedAppHeadToken?.value ?? parsed.expectedAppHead;
  parsed.shellRef = values['shell-ref'] ?? parsed.shellRef;
  parsed.frameworkRef = values['framework-ref'] ?? parsed.frameworkRef;
  if (values['require-shell-format'] !== undefined) {
    parsed.requireShellFormat = parseStrictBoolean(values['require-shell-format']);
  }
  if (values['run-shell-tests'] !== undefined) {
    parsed.runShellTests = parseStrictBoolean(values['run-shell-tests']);
  }
  parsed.repoRoot = values['repo-root'] ?? parsed.repoRoot;
  parsed.frameworkRoot = values['framework-root'] ?? parsed.frameworkRoot;
  parsed.output = values.output ?? parsed.output;
  parsed.json = values.json ?? parsed.json;

  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.expectedAppHead.trim()) {
    throw new Error('Pass --app-ref <sha>/--expected-app-head <sha> or set OPL_EXPECTED_APP_HEAD/GITHUB_SHA.');
  }
  if (!parsed.shellRef.trim()) throw new Error('Pass --shell-ref <ref> or set OPL_SHELL_REF.');
  if (!parsed.frameworkRef.trim()) throw new Error('Pass --framework-ref <ref> or set OPL_FRAMEWORK_REF.');
  return {
    ...parsed,
    repoRoot: path.resolve(parsed.repoRoot),
    frameworkRoot: path.resolve(parsed.frameworkRoot),
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
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
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
  if (/^[0-9a-f]{7,40}$/i.test(ref)) return [ref];
  return [
    ref,
    `refs/heads/${ref}`,
    `refs/remotes/origin/${ref}`,
    `refs/tags/${ref}`,
  ];
}

function resolveGitRef(root: string, ref: string, runner: CommandRunner): string | null {
  for (const candidate of refCandidates(ref)) {
    const result = runner('git', ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`], { cwd: root });
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

function pathForGitStatus(candidatePath: string): string {
  return candidatePath.split(path.sep).join('/');
}

function ignoredFrameworkCheckoutStatusPrefixes(repoRoot: string, frameworkRoot: string): string[] {
  const relative = path.relative(repoRoot, frameworkRoot);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return [];
  const normalized = pathForGitStatus(relative).replace(/\/+$/, '');
  return normalized ? [`?? ${normalized}`, `?? ${normalized}/`] : [];
}

function isIgnoredFrameworkCheckoutStatusLine(line: string, ignoredPrefixes: string[]): boolean {
  const exactDirectory = ignoredPrefixes[0];
  const directoryContents = ignoredPrefixes[1];
  return line === exactDirectory || Boolean(directoryContents && line.startsWith(directoryContents));
}

function statusTextWithoutDeclaredFrameworkCheckout(statusText: string, repoRoot: string, frameworkRoot: string): string {
  const ignoredPrefixes = ignoredFrameworkCheckoutStatusPrefixes(repoRoot, frameworkRoot);
  if (ignoredPrefixes.length === 0) return statusText;
  return statusText
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trimEnd();
      if (!trimmed) return false;
      return !isIgnoredFrameworkCheckoutStatusLine(trimmed, ignoredPrefixes);
    })
    .join('\n');
}

export function buildReleaseSourceGateReport(
  options: ReleaseSourceGateOptions,
  runner: CommandRunner = run,
  generatedAt = new Date().toISOString(),
  environment: ReleaseSourceGateEnvironment = {},
): ReleaseSourceGateReport {
  const pathExists = environment.pathExists ?? fs.existsSync;
  const readJson = environment.readJson ?? ((candidatePath: string) => JSON.parse(fs.readFileSync(candidatePath, 'utf8')));
  const shellRoot = path.join(options.repoRoot, 'shells', 'aionui');
  const frameworkRoot = options.frameworkRoot;
  let shellSha: string | null = null;
  let frameworkSha: string | null = null;
  const checks: Check[] = [];
  const requiredGates: RequiredGate[] = [
    {
      id: 'app_release_boundary_contract',
      required: true,
      command: 'npm run validate:release-boundary',
      cwd: options.repoRoot,
      executed: true,
      reason: 'Release source gate must prove the App-owned release boundary before expensive release work.',
    },
    {
      id: 'active_shell_format_check',
      required: true,
      command: 'bun run format:check',
      cwd: shellRoot,
      executed: options.requireShellFormat,
      reason: 'Release source gate must prove or require active shell formatting before expensive release work.',
    },
    {
      id: 'active_shell_node_dom_tests',
      required: true,
      command: 'node --experimental-strip-types scripts/run-active-shell-tests.ts --project all --chunk-size 8 --max-workers 2',
      cwd: options.repoRoot,
      executed: options.runShellTests,
      reason: 'Release source gate must catch active shell node/dom regressions before expensive release work.',
    },
  ];

  const releaseBoundaryResult = runner('npm', ['run', 'validate:release-boundary'], { cwd: options.repoRoot });
  addCheck(checks, {
    id: 'app_release_boundary_contract',
    status: releaseBoundaryResult.status === 0 ? 'passed' : 'failed',
    message: releaseBoundaryResult.status === 0
      ? 'App release-boundary contract passed.'
      : `App release-boundary contract failed.${commandDetail(releaseBoundaryResult) ? `\n${commandDetail(releaseBoundaryResult)}` : ''}`,
    command: 'npm run validate:release-boundary',
  });

  const appHeadResult = runner('git', ['rev-parse', 'HEAD'], { cwd: options.repoRoot });
  const appHead = appHeadResult.status === 0 ? firstLine(appHeadResult.stdout) : '';
  if (!appHead) {
    addCheck(checks, {
      id: 'app_head_resolved',
      status: 'failed',
      message: `Unable to resolve App HEAD.${commandDetail(appHeadResult) ? ` ${commandDetail(appHeadResult)}` : ''}`,
      command: commandText('git', ['rev-parse', 'HEAD']),
    });
  } else {
    addCheck(checks, {
      id: 'app_head_resolved',
      status: 'passed',
      message: `Resolved App HEAD ${appHead}.`,
      actual: appHead,
      command: commandText('git', ['rev-parse', 'HEAD']),
    });
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
  const rawStatusText = appStatusResult.stdout.trim();
  const statusText = statusTextWithoutDeclaredFrameworkCheckout(rawStatusText, options.repoRoot, frameworkRoot);
  addCheck(checks, {
    id: 'app_worktree_clean',
    status: appStatusResult.status === 0 && !statusText ? 'passed' : 'failed',
    message: appStatusResult.status === 0 && !statusText
      ? 'App worktree is clean apart from declared release source checkouts.'
      : `App worktree must be clean before release work.${statusText ? ` Dirty entries:\n${statusText}` : ''}`,
    actual: statusText || undefined,
    command: commandText('git', ['status', '--porcelain', '--untracked-files=normal']),
  });

  if (!pathExists(shellRoot)) {
    addCheck(checks, {
      id: 'active_shell_checkout',
      status: 'failed',
      message: `Active shell checkout is missing at ${shellRoot}.`,
    });
  } else {
    addCheck(checks, {
      id: 'active_shell_checkout',
      status: 'passed',
      message: `Active shell checkout exists at ${shellRoot}.`,
    });
    shellSha = resolveGitRef(shellRoot, options.shellRef, runner);
    addCheck(checks, {
      id: 'active_shell_ref_resolved',
      status: shellSha ? 'passed' : 'failed',
      message: shellSha
        ? `Active shell ref ${options.shellRef} resolves to ${shellSha}.`
        : `Active shell ref ${options.shellRef} cannot be resolved in ${shellRoot}.`,
      expected: options.shellRef,
      actual: shellSha ?? undefined,
      command: commandText('git', ['rev-parse', '--verify', '--quiet', `${options.shellRef}^{commit}`]),
    });
    try {
      const packageJson = readJson(path.join(shellRoot, 'package.json')) as { name?: unknown };
      addCheck(checks, {
        id: 'active_shell_type',
        status: packageJson?.name === 'one-person-lab-aion-shell' ? 'passed' : 'failed',
        message: packageJson?.name === 'one-person-lab-aion-shell'
          ? 'Active shell package type is one-person-lab-aion-shell.'
          : `Active shell package name must be one-person-lab-aion-shell, got ${String(packageJson?.name ?? 'missing')}.`,
        expected: 'one-person-lab-aion-shell',
        actual: typeof packageJson?.name === 'string' ? packageJson.name : undefined,
      });
    } catch (error) {
      addCheck(checks, {
        id: 'active_shell_type',
        status: 'failed',
        message: `Unable to read active shell package.json.${error instanceof Error ? ` ${error.message}` : ''}`,
        expected: 'one-person-lab-aion-shell',
      });
    }
  }

  if (!pathExists(frameworkRoot)) {
    addCheck(checks, {
      id: 'framework_checkout',
      status: 'failed',
      message: `OPL Framework checkout is missing at ${frameworkRoot}.`,
    });
  } else {
    addCheck(checks, {
      id: 'framework_checkout',
      status: 'passed',
      message: `OPL Framework checkout exists at ${frameworkRoot}.`,
    });
    frameworkSha = resolveGitRef(frameworkRoot, options.frameworkRef, runner);
    addCheck(checks, {
      id: 'framework_ref_resolved',
      status: frameworkSha ? 'passed' : 'failed',
      message: frameworkSha
        ? `OPL Framework ref ${options.frameworkRef} resolves to ${frameworkSha}.`
        : `OPL Framework ref ${options.frameworkRef} cannot be resolved in ${frameworkRoot}.`,
      expected: options.frameworkRef,
      actual: frameworkSha ?? undefined,
      command: commandText('git', ['rev-parse', '--verify', '--quiet', `${options.frameworkRef}^{commit}`]),
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

  if (options.runShellTests) {
    const shellTestsArgs = [
      '--experimental-strip-types',
      'scripts/run-active-shell-tests.ts',
      '--project',
      'all',
      '--chunk-size',
      '8',
      '--max-workers',
      '2',
    ];
    const shellTestsResult = runner(process.execPath, shellTestsArgs, { cwd: options.repoRoot });
    addCheck(checks, {
      id: 'active_shell_node_dom_tests',
      status: shellTestsResult.status === 0 ? 'passed' : 'failed',
      message: shellTestsResult.status === 0
        ? 'Active shell node/dom tests passed before expensive release work.'
        : `Active shell node/dom tests failed before expensive release work.${commandDetail(shellTestsResult) ? `\n${commandDetail(shellTestsResult)}` : ''}`,
      command: commandText('node', shellTestsArgs.slice(1)),
    });
  } else {
    addCheck(checks, {
      id: 'active_shell_node_dom_tests',
      status: 'skipped',
      message: 'Active shell node/dom tests were not executed; required gate command is emitted for CI enforcement.',
      command: 'node --experimental-strip-types scripts/run-active-shell-tests.ts --project all --chunk-size 8 --max-workers 2',
    });
  }

  return {
    schema: 'opl_app_release_source_gate.v1',
    generated_at: generatedAt,
    status: checks.some((check) => check.status === 'failed') ? 'failed' : 'passed',
    repo_root: options.repoRoot,
    version: options.version,
    expected_app_head: options.expectedAppHead,
    app_head: appHead || null,
    shell_ref: options.shellRef,
    shell_sha: shellSha,
    shell_root: shellRoot,
    framework_ref: options.frameworkRef,
    framework_sha: frameworkSha,
    framework_root: frameworkRoot,
    require_shell_format: options.requireShellFormat,
    run_shell_tests: options.runShellTests,
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
