import { spawnSync } from 'node:child_process';

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : '',
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : '',
    ].filter(Boolean).join('\n'));
  }
  return result;
}

export function runCapture(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

export function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    return null;
  }
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || null;
}

export function findExecutable(name) {
  const result = spawnSync('which', [name], { encoding: 'utf8', stdio: 'pipe' });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

export function monotonicSeconds() {
  return Number(process.hrtime.bigint()) / 1_000_000_000;
}

export function durationSeconds(start, end) {
  return Number((end - start).toFixed(3));
}
