import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type JsonRecord = Record<string, unknown>;

export function validateActiveShellCheckout(
  root: string,
  shellSource: JsonRecord,
  verifiedAncestor: string,
  issues: Set<string>,
): void {
  const checkoutPath = typeof shellSource.checkout_path === 'string' ? shellSource.checkout_path : '';
  if (!checkoutPath) {
    issues.add('active shell adapter must declare shell_source.checkout_path');
    return;
  }

  const shellRoot = path.join(root, checkoutPath);
  if (!fs.existsSync(shellRoot)) {
    issues.add(`missing active shell checkout ${checkoutPath}; run npm run ensure:shell`);
    return;
  }

  try {
    const currentHead = execFileSync('git', ['-C', shellRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    if (!/^[0-9a-f]{40}$/.test(currentHead)) {
      issues.add('active AionUI checkout must resolve a 40-character Git HEAD');
      return;
    }
    try {
      execFileSync('git', ['-C', shellRoot, 'merge-base', '--is-ancestor', verifiedAncestor, currentHead], {
        stdio: 'pipe',
      });
    } catch {
      issues.add(`active AionUI checkout ${currentHead} must contain verified GUI ancestor ${verifiedAncestor}`);
    }
  } catch (error) {
    issues.add(`unable to read active AionUI checkout: ${error instanceof Error ? error.message : String(error)}`);
  }
}
