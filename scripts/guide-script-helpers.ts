import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function createGuideScriptHelpers(appRoot: string) {
  return {
    run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
      const result = spawnSync(command, args, {
        cwd: options.cwd ?? appRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        env: options.env ?? process.env,
      });
      if (result.status !== 0) {
        throw new Error([
          `Command failed: ${command} ${args.join(' ')}`,
          result.stdout,
          result.stderr,
        ].filter(Boolean).join('\n'));
      }
      return result;
    },
    relativeToApp(filePath: string) {
      return path.relative(appRoot, filePath);
    },
    readJson<T>(filePath: string): T {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    },
  };
}
