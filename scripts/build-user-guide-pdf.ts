#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, [
  '--experimental-strip-types',
  'scripts/build-quarto-guide.ts',
  'macos-app-install',
  'macos-app-install.quarto.json',
], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
