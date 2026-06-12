#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertAppRootBoundary } from './app-root-boundary.ts';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';

const OPL_RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function defaultOplReleaseVersion(date = new Date()): string {
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${year}.${date.getUTCMonth() + 1}.${date.getUTCDate()}`;
}

function resolveOplReleaseVersion(): string {
  const explicit = process.env.OPL_RELEASE_VERSION?.trim();
  const version = explicit || defaultOplReleaseVersion();
  if (!OPL_RELEASE_VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid OPL_RELEASE_VERSION: ${version}`);
  }
  return version;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: run-active-shell-command.ts <command> [...args]');
  process.exit(2);
}

const shellPaths = resolveActiveShellPaths();
const releaseIconPath = process.env.OPL_APP_RELEASE_ICON_ICNS
  || fileURLToPath(new URL('../shells/aionui/resources/app.icns', import.meta.url));
assertAppRootBoundary({ phase: 'before active shell command' });
const result = spawnSync(args[0], args.slice(1), {
  cwd: shellPaths.shellRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    OPL_APP_RELEASE_ICON_ICNS: releaseIconPath,
    OPL_RELEASE_VERSION: resolveOplReleaseVersion(),
  },
});

try {
  assertAppRootBoundary({ phase: 'after active shell command' });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

process.exit(result.status ?? 1);
