#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = path.join(appRoot, 'packaged-runtimes', 'opl-full-runtime');
const shellRuntimeRoot = path.join(appRoot, 'shells', 'aionui', 'packaged-runtimes', 'opl-full-runtime');

fs.rmSync(path.join(runtimeRoot, 'runtime'), { recursive: true, force: true });
fs.rmSync(path.join(runtimeRoot, 'manifest'), { recursive: true, force: true });
fs.mkdirSync(runtimeRoot, { recursive: true });
fs.rmSync(path.join(shellRuntimeRoot, 'runtime'), { recursive: true, force: true });
fs.rmSync(path.join(shellRuntimeRoot, 'manifest'), { recursive: true, force: true });

console.log(JSON.stringify({
  status: 'standard_release_payload_ready',
  removed_full_runtime_payload: true,
  runtime_root: runtimeRoot,
  shell_runtime_root: shellRuntimeRoot,
}, null, 2));
