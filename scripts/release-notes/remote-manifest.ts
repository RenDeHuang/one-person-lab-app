import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function readRemoteFullPackageManifest(repo: string, tag: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-manifest-'));
  try {
    const result = spawnSync('gh', ['release', 'download', tag, '--repo', repo, '--pattern', 'full-package-manifest.json', '--dir', tempRoot], {
      encoding: 'utf8',
      stdio: 'pipe',
      env: process.env,
    });
    if (result.status !== 0) {
      return null;
    }
    const manifestPath = path.join(tempRoot, 'full-package-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
