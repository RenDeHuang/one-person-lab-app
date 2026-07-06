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

function writeJsonSummary(summaryPath: string, payload: unknown) {
  if (!summaryPath) return;
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function emitJsonSummary(summaryPath: string, payload: unknown) {
  writeJsonSummary(summaryPath, payload);
  console.log(JSON.stringify(payload, null, 2));
}

export function runCleanupScript(run: (argv: string[]) => void) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
