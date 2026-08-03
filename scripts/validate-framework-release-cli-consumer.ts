#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const fullShaPattern = /^[0-9a-f]{40}$/i;
const releaseCliArgs = ['release', 'checkpoint', 'import', '--help'] as const;

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

export type FrameworkReleaseCliConsumerOptions = {
  frameworkRoot: string;
  expectedFrameworkSha: string;
};

export type FrameworkReleaseCliConsumerReport = {
  schema: 'opl_framework_release_cli_consumer_gate.v1';
  status: 'passed';
  framework_sha: string;
  dependency_install: 'npm ci --ignore-scripts';
  command_surface_source: 'executable_command_specs';
  surface_generation: 'not_invoked';
  release_cli_command: 'bin/opl release checkpoint import --help';
  projection: 'temporary_exact_framework_archive';
  source_framework_mutated: false;
};

function run(command: string, args: readonly string[], cwd: string, timeoutMs = 300_000): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
  };
}

function commandOutput(command: string, args: readonly string[], cwd: string, timeoutMs?: number): string {
  const result = run(command, args, cwd, timeoutMs);
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout, result.error?.message].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout;
}

export function runFrameworkReleaseCliConsumerGate(
  options: FrameworkReleaseCliConsumerOptions,
): FrameworkReleaseCliConsumerReport {
  const frameworkRoot = fs.realpathSync(options.frameworkRoot);
  const expectedFrameworkSha = options.expectedFrameworkSha.trim().toLowerCase();
  if (!fullShaPattern.test(expectedFrameworkSha)) {
    throw new Error('Framework release CLI consumer gate requires a full expected Framework SHA.');
  }

  const frameworkHead = commandOutput('git', ['rev-parse', 'HEAD'], frameworkRoot).trim().toLowerCase();
  if (frameworkHead !== expectedFrameworkSha) {
    throw new Error(`Framework checkout HEAD ${frameworkHead} does not match expected ${expectedFrameworkSha}.`);
  }
  const sourceStatusBefore = commandOutput(
    'git',
    ['status', '--porcelain', '--untracked-files=normal'],
    frameworkRoot,
  );
  if (sourceStatusBefore.trim()) {
    throw new Error('Framework checkout must be clean before creating the isolated release CLI consumer.');
  }

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-framework-release-cli-consumer-'));
  let consumerFailure: unknown = null;
  try {
    const archivePath = path.join(temporaryRoot, 'framework.tar');
    const archiveRoot = path.join(temporaryRoot, 'framework');
    fs.mkdirSync(archiveRoot);
    commandOutput('git', ['archive', '--format=tar', '--output', archivePath, expectedFrameworkSha], frameworkRoot);
    commandOutput('tar', ['-xf', archivePath, '-C', archiveRoot], frameworkRoot);
    commandOutput('npm', ['ci', '--ignore-scripts'], archiveRoot);
    commandOutput(path.join(archiveRoot, 'bin', 'opl'), releaseCliArgs, archiveRoot);
  } catch (error) {
    consumerFailure = error;
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  const sourceStatusAfter = commandOutput(
    'git',
    ['status', '--porcelain', '--untracked-files=normal'],
    frameworkRoot,
  );
  if (sourceStatusAfter !== sourceStatusBefore) {
    throw new Error('Framework checkout changed while the isolated release CLI consumer ran.');
  }
  if (consumerFailure) throw consumerFailure;

  return {
    schema: 'opl_framework_release_cli_consumer_gate.v1',
    status: 'passed',
    framework_sha: frameworkHead,
    dependency_install: 'npm ci --ignore-scripts',
    command_surface_source: 'executable_command_specs',
    surface_generation: 'not_invoked',
    release_cli_command: 'bin/opl release checkpoint import --help',
    projection: 'temporary_exact_framework_archive',
    source_framework_mutated: false,
  };
}

function isMainModule(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
}

if (isMainModule()) {
  try {
    const { values } = parseArgs({
      options: {
        'framework-root': { type: 'string' },
        'expected-framework-sha': { type: 'string' },
        output: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    });
    if (!values['framework-root'] || !values['expected-framework-sha']) {
      throw new Error(
        'Usage: validate-framework-release-cli-consumer.ts --framework-root <path> --expected-framework-sha <sha> [--output <path>].',
      );
    }
    const report = runFrameworkReleaseCliConsumerGate({
      frameworkRoot: values['framework-root'],
      expectedFrameworkSha: values['expected-framework-sha'],
    });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (values.output) {
      const outputPath = path.resolve(values.output);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, serialized, 'utf8');
    }
    process.stdout.write(serialized);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
