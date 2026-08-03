import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Release tests that assert Unix mode bits must not create fixtures on WSL's
 * DrvFs-mounted Windows temp directory.
 */
export function createPosixModeTempRoot(prefix: string): string {
  const roots = process.platform === 'win32'
    ? [os.tmpdir()]
    : ['/tmp', os.tmpdir()];
  const attempted: string[] = [];

  for (const root of [...new Set(roots)]) {
    if (!fs.existsSync(root)) continue;
    attempted.push(root);
    const candidate = fs.mkdtempSync(path.join(root, prefix));
    const probe = path.join(candidate, '.mode-probe');
    try {
      fs.writeFileSync(probe, 'probe', { mode: 0o600 });
      fs.chmodSync(probe, 0o600);
      if ((fs.statSync(probe).mode & 0o777) === 0o600) {
        fs.rmSync(probe);
        return candidate;
      }
    } catch {
      // Try the next local filesystem root.
    }
    fs.rmSync(candidate, { recursive: true, force: true });
  }

  throw new Error(
    `No POSIX-mode temporary filesystem is available; attempted: ${attempted.join(', ') || '(none)'}`,
  );
}
