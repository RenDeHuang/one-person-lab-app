#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readAppShellAdapterContract, resolveActiveShellPaths } from './app-shell-adapter.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? appRoot,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\nstdout=${result.stdout || ''}\nstderr=${result.stderr || ''}` : '';
    throw new Error(`Command failed: ${command} ${args.join(' ')}${detail}`);
  }
  return result;
}

function parseArgs(argv) {
  const parsed = {
    ref: process.env.OPL_APP_SHELL_REF || '',
    repo: process.env.OPL_APP_SHELL_REPO || '',
    reset: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--reset') {
      parsed.reset = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    index += 1;
    if (token === '--ref') parsed.ref = value;
    else if (token === '--repo') parsed.repo = value;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return parsed;
}

function isGitCheckout(shellRoot) {
  const gitPath = path.join(shellRoot, '.git');
  if (fs.existsSync(gitPath)) return true;
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: shellRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0 && result.stdout.trim() === 'true';
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

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
