#!/usr/bin/env node

import fs from 'node:fs';
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

if (result.status === 0) {
  fs.copyFileSync(
    'docs/delivery/user-guides/macos-app-install/verification/macos-app-install-verification.json',
    'docs/delivery/user-guides/macos-app-install/verification/macos-app-install-html-verification.json',
  );
}

process.exit(result.status ?? 1);
