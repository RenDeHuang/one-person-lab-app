#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs as parseNodeArgs } from 'node:util';
import { readAppShellAdapterContract, resolveActiveShellPaths } from './app-shell-adapter.ts';
import { runCommand } from './release-cleanup-helpers.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command: string, args: string[], options: { capture?: boolean; cwd?: string } = {}) {
  return runCommand(command, args, { ...options, cwd: options.cwd ?? appRoot });
}

function parseArgs(argv) {
  const { values } = parseNodeArgs({
    args: argv.slice(2),
    options: {
      ref: { type: 'string' },
      repo: { type: 'string' },
      reset: { type: 'boolean' },
    } as const,
    allowPositionals: false,
    strict: true,
  });
  return {
    ref: values.ref ?? process.env.OPL_APP_SHELL_REF ?? '',
    repo: values.repo ?? process.env.OPL_APP_SHELL_REPO ?? '',
    reset: values.reset === true,
  };
}

export function isGitCheckout(shellRoot) {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: shellRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0 || result.stdout.trim() !== 'true') return false;
  const topLevel = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: shellRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (topLevel.status !== 0) return false;
  return path.resolve(topLevel.stdout.trim()) === path.resolve(fs.realpathSync(shellRoot));
}

function resolveShellSourceLayout(shellRoot) {
  const topLevel = run('git', ['rev-parse', '--show-toplevel'], { cwd: shellRoot, capture: true }).stdout.trim();
  const resolvedShellRoot = fs.realpathSync(shellRoot);
  return path.resolve(topLevel) === path.resolve(resolvedShellRoot) ? 'external_checkout_root' : 'local_nested_source';
}

function main() {
  const args = parseArgs(process.argv);
  const contract = readAppShellAdapterContract();
  const source = contract.shell_source;
  const shellPaths = resolveActiveShellPaths({ contract });
  const shellRoot = shellPaths.shellRoot;
  const repo = args.repo || `git@github.com:${source.owner_repo}.git`;
  const ref = args.ref || source.default_ref || 'main';

  if (args.reset) {
    fs.rmSync(shellRoot, { recursive: true, force: true });
  }

  if (!fs.existsSync(shellRoot)) {
    fs.mkdirSync(path.dirname(shellRoot), { recursive: true });
    run('git', ['clone', '--depth', '1', '--branch', ref, repo, shellRoot]);
  } else if (!isGitCheckout(shellRoot)) {
    throw new Error(`${source.checkout_path} exists but is not a Git checkout. Move it aside or pass --reset.`);
  }

  const packageJsonPath = shellPaths.packageManifestPath;
  const agentsPath = shellPaths.agentsGuidePath;
  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(agentsPath)) {
    throw new Error(`${source.checkout_path} is missing required shell files.`);
  }

  const head = run('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: shellRoot, capture: true }).stdout.trim();
  console.log(JSON.stringify({
    status: 'active_shell_ready',
    shell_root: shellPaths.shellRootForDisplay,
    source_repo: source.owner_repo,
    ref,
    head,
    source_layout: resolveShellSourceLayout(shellRoot),
  }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
