import { spawnSync } from 'node:child_process';

const commandMaxBuffer = 16 * 1024 * 1024;

function runNodeValidation(appRoot: string, args: string[]): number {
  const result = spawnSync(process.execPath, args, {
    cwd: appRoot,
    encoding: 'utf8',
    maxBuffer: commandMaxBuffer,
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return 1;
  }

  return 0;
}

export function validateReleaseBoundaryScriptDependencies(appRoot: string): number {
  let failures = 0;
  failures += runNodeValidation(appRoot, [
    '--experimental-strip-types',
    'scripts/validate-agent-installation-contract.ts',
  ]);
  failures += runNodeValidation(appRoot, [
    '--experimental-strip-types',
    'scripts/update-homebrew-tap.ts',
    '--self-check',
  ]);
  return failures;
}
