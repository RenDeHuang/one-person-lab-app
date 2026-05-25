#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: run-active-shell-command.ts <command> [...args]');
  process.exit(2);
}

const shellPaths = resolveActiveShellPaths();
const result = spawnSync(args[0], args.slice(1), {
  cwd: shellPaths.shellRoot,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
