import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAppShellAdapterContract, resolveActiveShellPaths } from './app-shell-adapter.ts';
import { readAppProductProfile } from './app-product-profile/profile-contract.ts';
import { appRoot, appProductProfilePath } from './app-product-profile/paths.ts';

const officialProfileApplySourcePath = path.join(appRoot, 'scripts', 'official-profile-package-apply.ts');

export function formatCodexProfilePhrase(profile = readAppProductProfile()): string {
  return `${profile.codex.default_model} with ${profile.codex.default_reasoning_effort} reasoning`;
}

export function buildShellCompatibilityProfile(profile = readAppProductProfile()): Record<string, any> {
  return structuredClone(profile) as Record<string, any>;
}

export function syncOfficialProfileApplyHelperToShell(
  shellRoot: string,
  options: { check?: boolean } = {}
): { synced: boolean; verified: boolean; targetPath: string } {
  const targetPath = path.join(shellRoot, 'resources', 'official-profile-package-apply.ts');
  const expected = fs.readFileSync(officialProfileApplySourcePath, 'utf8');
  if (options.check) {
    let actual = '';
    try {
      actual = fs.readFileSync(targetPath, 'utf8');
    } catch {
      actual = '';
    }
    if (actual !== expected) {
      throw new Error(`Active shell Official Profile apply helper does not match App source: ${targetPath}`);
    }
    return { synced: false, verified: true, targetPath };
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, expected, 'utf8');
  return { synced: true, verified: true, targetPath };
}

export function syncAppProductProfileToShell(
  shellRoot: string,
  options: { optional?: boolean; check?: boolean } = {}
): { synced: boolean; verified: boolean; targetPath: string } {
  const shellPaths = resolveActiveShellPaths({
    contract: readAppShellAdapterContract(),
    shellRoot,
  });
  const targetPath = shellPaths.productProfileTargetPath;
  if (!fs.existsSync(shellPaths.packageManifestPath)) {
    if (options.optional) return { synced: false, verified: false, targetPath };
    throw new Error(`Missing active shell checkout: ${shellRoot}`);
  }

  const profile = readAppProductProfile();
  const shellProfile = buildShellCompatibilityProfile(profile);
  const expected = fs.readFileSync(appProductProfilePath, 'utf8');
  if (JSON.stringify(JSON.parse(expected)) !== JSON.stringify(shellProfile)) {
    throw new Error('Shell compatibility profile must preserve the exact App product profile structure');
  }
  if (options.check) {
    let actual = '';
    try {
      actual = fs.readFileSync(targetPath, 'utf8');
    } catch {
      actual = '';
    }
    if (actual !== expected) {
      throw new Error(
        `Active shell generated product profile does not match the deterministic App profile: ${targetPath}`
      );
    }
    syncOfficialProfileApplyHelperToShell(shellRoot, { check: true });
    return { synced: false, verified: true, targetPath };
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, expected, 'utf8');
  syncOfficialProfileApplyHelperToShell(shellRoot);
  return { synced: true, verified: true, targetPath };
}

function main(): void {
  const profile = readAppProductProfile();
  const shellPaths = resolveActiveShellPaths();
  const check = process.argv.slice(2).includes('--check');
  const result = syncAppProductProfileToShell(shellPaths.shellRoot, { check });
  console.log(
    JSON.stringify(
      {
        status: result.synced ? 'synced' : result.verified ? 'verified' : 'skipped',
        owner: profile.owner,
        source: path.relative(appRoot, appProductProfilePath),
        target: result.targetPath,
      },
      null,
      2
    )
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
