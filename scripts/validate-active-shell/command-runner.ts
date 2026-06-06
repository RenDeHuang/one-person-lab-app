import { spawnSync } from 'node:child_process';
import { resolveValidationCwd } from './active-shell-contract.ts';

export function runCommand(entry, contract, shellPaths) {
  const cwd = resolveValidationCwd(entry, contract, shellPaths);
  console.log(`\n==> ${entry.id}: ${entry.command}`);
  const result = spawnSync(entry.command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Validation command failed: ${entry.id}`);
  }
}
