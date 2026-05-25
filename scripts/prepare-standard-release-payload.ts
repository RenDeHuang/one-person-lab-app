#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncAppProductProfileToShell } from './app-product-profile.ts';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = path.join(appRoot, 'packaged-runtimes', 'opl-full-runtime');
const shellPaths = resolveActiveShellPaths();
const shellRuntimeRoot = shellPaths.packagedRuntimeRoot;

fs.rmSync(path.join(runtimeRoot, 'runtime'), { recursive: true, force: true });
fs.rmSync(path.join(runtimeRoot, 'manifest'), { recursive: true, force: true });
fs.mkdirSync(runtimeRoot, { recursive: true });
fs.rmSync(path.join(shellRuntimeRoot, 'runtime'), { recursive: true, force: true });
fs.rmSync(path.join(shellRuntimeRoot, 'manifest'), { recursive: true, force: true });
const profileSync = syncAppProductProfileToShell(shellPaths.shellRoot, { optional: true });

console.log(JSON.stringify({
  status: 'standard_release_payload_ready',
  removed_full_runtime_payload: true,
  product_profile_synced: profileSync.synced,
  product_profile_target: profileSync.targetPath,
  runtime_root: runtimeRoot,
  shell_runtime_root: shellRuntimeRoot,
  shell_root: shellPaths.shellRootForDisplay,
}, null, 2));
