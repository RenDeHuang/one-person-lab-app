import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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
