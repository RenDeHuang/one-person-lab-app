#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoParent = path.dirname(repoRoot);
const workspaceRoot = path.basename(repoParent) === '.worktrees' ? path.dirname(repoParent) : repoParent;
const frameworkRepo = path.resolve(process.env.OPL_FRAMEWORK_REPO || path.join(workspaceRoot, 'one-person-lab'));
const runner = path.join(frameworkRepo, 'scripts', 'run-domain-whitepaper.ts');

if (!fs.existsSync(runner) || !fs.statSync(runner).isFile()) {
  throw new Error(
    `Cannot find the canonical OPL whitepaper runner at ${runner}. ` +
      'Set OPL_FRAMEWORK_REPO to a one-person-lab checkout.',
  );
}

const result = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    runner,
    '--repo-root',
    repoRoot,
    '--profile',
    'contracts/whitepaper_profile.json',
  ],
  {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
