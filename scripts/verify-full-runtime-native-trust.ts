#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { listFullRuntimeNativeExecutables } from './build-full-first-install-package/macos-trust.ts';

function parseArgs(argv: string[]) {
  const parsed = {
    runtimeRoot: '',
    output: '',
    requireSpctl: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--require-spctl') {
      parsed.requireSpctl = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    index += 1;
    if (token === '--runtime-root') parsed.runtimeRoot = path.resolve(value);
    else if (token === '--output') parsed.output = path.resolve(value);
    else throw new Error(`Unknown argument: ${token}`);
  }

  if (!parsed.runtimeRoot) {
    throw new Error('Pass --runtime-root <path>.');
  }
  return parsed;
}

function runCapture(command: string, args: string[]) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function hasExtendedAttribute(filePath: string, attributeName: string) {
  return runCapture('xattr', ['-p', attributeName, filePath]).status === 0;
}

function readCodeSignature(filePath: string) {
  const result = runCapture('codesign', ['-dv', '--verbose=4', filePath]);
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    team_identifier: output.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() || null,
    signature: output.match(/^Signature=(.+)$/m)?.[1]?.trim() || null,
  };
}

function verifyExecutable(entry: { path: string; relative_path: string; requires_spctl: boolean }, requireSpctl: boolean) {
  const codesignResult = runCapture('codesign', ['--verify', '--strict', '--verbose=2', entry.path]);
  const shouldAssessSpctl = requireSpctl && entry.requires_spctl;
  const spctlResult = shouldAssessSpctl
    ? runCapture('spctl', ['--assess', '--type', 'execute', '--verbose=4', entry.path])
    : { status: 0, stdout: '', stderr: '' };
  const signature = readCodeSignature(entry.path);
  const codesignPassed = codesignResult.status === 0;
  const spctlPassed = spctlResult.status === 0;
  return {
    relative_path: entry.relative_path,
    assessment_kind: entry.requires_spctl ? 'launched_executable' : 'loadable_native_code',
    codesign_status: codesignPassed ? 'passed' : 'failed_allowed_unsigned',
    spctl_status: shouldAssessSpctl ? (spctlPassed ? 'passed' : 'failed_allowed_unsigned') : 'not_required',
    team_identifier: signature.team_identifier,
    signature: signature.signature,
    quarantine_status: hasExtendedAttribute(entry.path, 'com.apple.quarantine') ? 'present' : 'absent',
    provenance_status: hasExtendedAttribute(entry.path, 'com.apple.provenance') ? 'present' : 'absent',
  };
}

function isTrusted(entry: ReturnType<typeof verifyExecutable>) {
  return entry.codesign_status === 'passed'
    && (entry.spctl_status === 'passed' || entry.spctl_status === 'not_required')
    && entry.quarantine_status === 'absent'
    && Boolean(entry.team_identifier)
    && entry.signature !== 'adhoc';
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (process.platform !== 'darwin') {
    throw new Error('Full runtime native trust verification must run on macOS.');
  }
  if (!fs.existsSync(options.runtimeRoot) || !fs.statSync(options.runtimeRoot).isDirectory()) {
    throw new Error(`Full runtime root not found: ${options.runtimeRoot}`);
  }

  const executables = listFullRuntimeNativeExecutables(options.runtimeRoot).map((entry) =>
    verifyExecutable(entry, options.requireSpctl),
  );
  const payload = {
    schema: 'opl_full_runtime_native_trust.v1',
    runtime_root: options.runtimeRoot,
    require_spctl: options.requireSpctl,
    status: executables.every(isTrusted)
      ? 'passed'
      : executables.every((entry) => entry.quarantine_status === 'absent') ? 'local_authorized_unsigned' : 'failed',
    executable_count: executables.length,
    executables,
  };

  const output = `${JSON.stringify(payload, null, 2)}\n`;
  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
  if (payload.status !== 'passed' && payload.status !== 'local_authorized_unsigned') {
    throw new Error('Full runtime native executable trust verification failed.');
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
