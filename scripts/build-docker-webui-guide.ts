#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, [
  '--experimental-strip-types',
  'scripts/build-quarto-guide.ts',
  'docker-webui-install',
], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
