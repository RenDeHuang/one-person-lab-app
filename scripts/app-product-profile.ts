import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readAppShellAdapterContract, resolveActiveShellPaths } from './app-shell-adapter.ts';
import { readAppProductProfile } from './app-product-profile/profile-contract.ts';
import { appRoot, appProductProfilePath } from './app-product-profile/paths.ts';

export function formatCodexProfilePhrase(profile = readAppProductProfile()): string {
  return `${profile.codex.default_model} with ${profile.codex.default_reasoning_effort} reasoning`;
}

export function buildShellCompatibilityProfile(profile = readAppProductProfile()): Record<string, any> {
  return structuredClone(profile) as Record<string, any>;
}

export function syncAppProductProfileToShell(
  shellRoot: string,
  options: { optional?: boolean; check?: boolean } = {},
): { synced: boolean; verified: boolean; targetPath: string } {
  const shellPaths = resolveActiveShellPaths({ contract: readAppShellAdapterContract(), shellRoot });
  const targetPath = shellPaths.productProfileTargetPath;
  if (!fs.existsSync(shellPaths.packageManifestPath)) {
    if (options.optional) return { synced: false, verified: false, targetPath };
    throw new Error(`Missing active shell checkout: ${shellRoot}`);
  }

  const profile = readAppProductProfile();
  const shellProfile = buildShellCompatibilityProfile(profile);
  const expected = `${JSON.stringify(shellProfile, null, 2)}\n`;
  if (options.check) {
    let actual: unknown = null;
    try {
      actual = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    } catch {
      actual = null;
    }
    if (JSON.stringify(actual) !== JSON.stringify(shellProfile)) {
      throw new Error(`Active shell generated product profile does not match the deterministic App profile: ${targetPath}`);
    }
    return { synced: false, verified: true, targetPath };
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, expected, 'utf8');
  const localOxfmt = path.join(shellRoot, 'node_modules', '.bin', 'oxfmt');
  if (fs.existsSync(localOxfmt)) {
    spawnSync(localOxfmt, [targetPath], { cwd: shellRoot, stdio: 'ignore' });
  }
  return { synced: true, verified: true, targetPath };
}

function main(): void {
  const profile = readAppProductProfile();
  const shellPaths = resolveActiveShellPaths();
  const check = process.argv.slice(2).includes('--check');
  const result = syncAppProductProfileToShell(shellPaths.shellRoot, { check });
  console.log(JSON.stringify({
    status: result.synced ? 'synced' : result.verified ? 'verified' : 'skipped',
    owner: profile.owner,
    source: path.relative(appRoot, appProductProfilePath),
    target: result.targetPath,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
