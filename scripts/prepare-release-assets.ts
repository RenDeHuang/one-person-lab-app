#!/usr/bin/env node

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = path.resolve(root, process.argv[2] ?? 'build-artifacts');
const outputDir = path.resolve(root, process.argv[3] ?? 'release-assets');
const shellPaths = resolveActiveShellPaths();

const result = spawnSync('bash', [shellPaths.releasePrepareScriptPath, artifactsDir, outputDir], {
  cwd: shellPaths.shellRoot,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
