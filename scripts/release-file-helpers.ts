import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type RunGhOptions = {
  cwd?: string;
  maxBuffer?: number;
  prefixErrorWithLabel?: boolean;
};

export function findFileByName(root: string, name: string): string | null {
  if (!fs.existsSync(root)) return null;
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else if (entry.isFile() && entry.name === name) return entryPath;
    }
  }
  return null;
}

export function writeLinesFile(filePath: string, lines: string[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

export function fileSha256(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = fs.openSync(filePath, 'r');
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

export function runGitHubCli(args: string[], label: string, options: RunGhOptions = {}): string {
  const result = spawnSync('gh', args, {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `${label} failed`;
    throw new Error(options.prefixErrorWithLabel ? `${label} failed: ${result.stderr || result.stdout}` : detail);
  }
  return result.stdout;
}
