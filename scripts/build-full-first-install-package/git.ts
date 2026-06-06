import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function readGitHead(sourcePath) {
  if (!fs.existsSync(path.join(sourcePath, '.git'))) {
    return null;
  }
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: sourcePath,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

export function readGitOriginUrl(sourcePath) {
  if (!fs.existsSync(path.join(sourcePath, '.git'))) {
    return null;
  }
  const result = spawnSync('git', ['config', '--get', 'remote.origin.url'], {
    cwd: sourcePath,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0 ? result.stdout.trim() || null : null;
}
