import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function runCommand(command: string, args: string[], options: { capture?: boolean; cwd?: string } = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = options.capture ? `\nstdout=${result.stdout || ''}\nstderr=${result.stderr || ''}` : '';
    throw new Error(`Command failed: ${command} ${args.join(' ')}${detail}`);
  }
  return result;
}

export function runGh(args: string[], options: { capture?: boolean; cwd?: string } = {}) {
  return runCommand('gh', args, options);
}

export function parseJsonLines<T>(stdout: string): T[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function writeJsonSummary(summaryPath: string, payload: unknown) {
  if (!summaryPath) return;
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

type CleanupArgHandlers = {
  setExecute: (execute: boolean) => void;
  valueHandlers: Record<string, (value: string) => void>;
};

export function applyCleanupArg(argv: string[], index: number, handlers: CleanupArgHandlers): number {
  const token = argv[index];
  if (token === '--execute') {
    handlers.setExecute(true);
    return index;
  }
  if (token === '--dry-run') {
    handlers.setExecute(false);
    return index;
  }

  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${token}`);
  }
  const handler = handlers.valueHandlers[token];
  if (!handler) {
    throw new Error(`Unknown argument: ${token}`);
  }
  handler(value);
  return index + 1;
}
