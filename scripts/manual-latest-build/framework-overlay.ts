import fs from 'node:fs';
import path from 'node:path';

import {
  commandOutput,
  commandResult,
  fileSha256,
  readJson,
  type JsonRecord,
  type RepoSnapshot,
  writeJson,
} from './common.ts';

const CATALOG_REF = 'contracts/opl-framework/bundled-full-runtime-package-catalog.json';
const PACKAGE_ROOT_REF = 'contracts/opl-framework/packages';
const ALLOWLIST_ROOT_REF = 'contracts/opl-framework/package-payload-allowlists';

const OWNER_MANIFEST_REFS: Record<string, string | null> = {
  mas: 'contracts/opl_agent_package_manifest.json',
  mag: 'contracts/opl_agent_package_manifest.json',
  rca: 'contracts/opl_agent_package_manifest.json',
  oma: 'contracts/opl_agent_package_manifest.json',
  obf: 'contracts/opl_agent_package_manifest.json',
  'mas-scholar-skills': 'contracts/opl_capability_package_manifest.json',
  'opl-flow': null,
};

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function requireObject(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function ownerRepoName(repoUrl: string) {
  const parsed = new URL(repoUrl);
  return path.posix.basename(parsed.pathname).replace(/\.git$/, '');
}

function ownerManifest(packageId: string, ownerRoot: string, frameworkManifest: JsonRecord) {
  const relativeRef = OWNER_MANIFEST_REFS[packageId];
  if (relativeRef === undefined) throw new Error(`No owner manifest mapping for ${packageId}`);
  if (relativeRef === null) return deepClone(frameworkManifest);
  return readJson(path.join(ownerRoot, ...relativeRef.split('/')));
}

function pluginManifest(ownerRoot: string, sourceRoot: string) {
  const pluginPath = path.join(
    ownerRoot,
    ...(sourceRoot === '.' ? [] : sourceRoot.split('/')),
    '.codex-plugin',
    'plugin.json',
  );
  return readJson(pluginPath);
}

export function projectFrameworkPackageManifest(
  frameworkManifest: JsonRecord,
  sourceManifest: JsonRecord,
  ownerCommit: string,
) {
  let projected = deepClone(frameworkManifest);
  if (frameworkManifest.source === 'first_party_owner_projection') {
    projected = deepClone(sourceManifest);
    projected.source = frameworkManifest.source;
    projected.source_repo = frameworkManifest.source_repo;
    projected.codex_surface = {
      ...requireObject(frameworkManifest.codex_surface, 'Framework codex_surface'),
      ...requireObject(sourceManifest.codex_surface, 'Owner codex_surface'),
    };
    for (const field of ['source_manifest_ref']) {
      if (frameworkManifest[field] !== undefined) projected[field] = frameworkManifest[field];
    }
  }
  const codexSurface = requireObject(projected.codex_surface, 'Projected codex_surface');
  if (typeof codexSurface.plugin_payload_manifest_url !== 'string') {
    throw new Error(`Framework package ${String(projected.package_id)} has no payload manifest URL`);
  }
  codexSurface.carrier_source_commit = ownerCommit;
  if (projected.source_commit !== undefined) projected.source_commit = ownerCommit;
  return projected;
}

function ownerCohortLock(
  catalog: JsonRecord,
  overlayRoot: string,
  ownerSnapshots: Record<string, RepoSnapshot>,
) {
  const packages = requireObject(catalog.packages, 'Framework catalog packages');
  return {
    surface_kind: 'opl_package_owner_cohort_lock.v1',
    generated_at: new Date().toISOString(),
    packages: Object.fromEntries(Object.keys(packages).map((packageId) => {
      const allowlist = readJson(path.join(overlayRoot, ALLOWLIST_ROOT_REF, `${packageId}.json`));
      const repoUrl = String(allowlist.source_repo);
      const snapshot = ownerSnapshots[packageId];
      if (!snapshot) throw new Error(`Missing owner development snapshot for ${packageId}`);
      return [packageId, {
        package_id: packageId,
        repo_name: ownerRepoName(repoUrl),
        repo_url: repoUrl,
        source_commit: snapshot.head,
      }];
    })),
  };
}

function projectOnePackage(input: {
  packageId: string;
  catalogEntry: JsonRecord;
  overlayRoot: string;
  cohortLockPath: string;
  ownerSnapshot: RepoSnapshot;
}) {
  const { packageId, catalogEntry, overlayRoot, cohortLockPath, ownerSnapshot } = input;
  if (catalogEntry.owner_source_commit === ownerSnapshot.head) {
    return { package_id: packageId, status: 'already_current', owner_source_commit: ownerSnapshot.head };
  }

  const manifestPath = path.join(overlayRoot, PACKAGE_ROOT_REF, `${packageId}.json`);
  const allowlistPath = path.join(overlayRoot, ALLOWLIST_ROOT_REF, `${packageId}.json`);
  const frameworkManifest = readJson(manifestPath);
  const allowlist = readJson(allowlistPath);
  const sourceManifest = ownerManifest(packageId, ownerSnapshot.root, frameworkManifest);
  const plugin = pluginManifest(ownerSnapshot.root, String(allowlist.source_root));
  const versions = [catalogEntry.package_version, frameworkManifest.version, sourceManifest.version, plugin.version];
  if (versions.some((version) => version !== versions[0])) {
    throw new Error(
      `Cannot mechanically project ${packageId}: version surfaces differ (${versions.join(', ')}). `
      + 'Project the semantic version change into Framework main first.',
    );
  }

  const projected = projectFrameworkPackageManifest(
    frameworkManifest,
    sourceManifest,
    ownerSnapshot.head,
  );
  const contentLock = projected.content_lock;
  if (contentLock !== undefined) {
    const lock = requireObject(contentLock, `${packageId} content_lock`);
    if (!Array.isArray(lock.paths) || lock.paths.length === 0) {
      throw new Error(`${packageId} content_lock has no paths`);
    }
    allowlist.paths = [...lock.paths];
    writeJson(allowlistPath, allowlist);
  }
  writeJson(manifestPath, projected);

  const payloadRef = String(projected.codex_surface.plugin_payload_manifest_url);
  const payloadPath = path.resolve(path.dirname(manifestPath), ...payloadRef.split('/'));
  const payloadRoot = path.resolve(path.join(overlayRoot, PACKAGE_ROOT_REF, 'payloads'));
  if (!payloadPath.startsWith(`${payloadRoot}${path.sep}`)) {
    throw new Error(`${packageId} payload path escapes Framework packages/payloads: ${payloadRef}`);
  }
  fs.rmSync(payloadPath, { force: true });
  const generatorOutput = commandOutput(process.execPath, [
    path.join(overlayRoot, 'scripts', 'first-party-package-payload.mjs'),
    '--manifest', manifestPath,
    '--allowlist', allowlistPath,
    '--owner-cohort-lock', cohortLockPath,
    '--repo', ownerSnapshot.root,
    '--source-commit', ownerSnapshot.head,
  ], { cwd: overlayRoot, timeoutMs: 180_000 });
  const generated = JSON.parse(generatorOutput) as JsonRecord;
  if (generated.source_commit !== ownerSnapshot.head || generated.status !== 'created') {
    throw new Error(`${packageId} payload generator returned an unexpected result: ${generatorOutput}`);
  }

  catalogEntry.owner_source_commit = ownerSnapshot.head;
  catalogEntry.manifest_sha256 = `sha256:${fileSha256(manifestPath)}`;
  catalogEntry.payload_manifest_sha256 = `sha256:${fileSha256(payloadPath)}`;
  return {
    package_id: packageId,
    status: 'projected_latest_owner',
    owner_source_commit: ownerSnapshot.head,
    manifest_sha256: catalogEntry.manifest_sha256,
    payload_manifest_sha256: catalogEntry.payload_manifest_sha256,
  };
}

export function prepareFrameworkOverlay(input: {
  framework: RepoSnapshot;
  ownerSnapshots: Record<string, RepoSnapshot>;
  workRoot: string;
}) {
  const overlayRoot = path.join(input.workRoot, 'framework-overlay');
  commandResult('git', [
    'clone', '--shared', '--no-checkout', '--quiet', input.framework.root, overlayRoot,
  ], { timeoutMs: 120_000 });
  commandResult('git', ['checkout', '--detach', input.framework.head], {
    cwd: overlayRoot,
    timeoutMs: 60_000,
  });
  const frameworkNodeModules = path.join(input.framework.root, 'node_modules');
  if (!fs.statSync(frameworkNodeModules, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Framework dependencies are not installed: ${frameworkNodeModules}`);
  }
  fs.symlinkSync(frameworkNodeModules, path.join(overlayRoot, 'node_modules'));

  const catalogPath = path.join(overlayRoot, CATALOG_REF);
  const catalog = readJson(catalogPath);
  const packages = requireObject(catalog.packages, 'Framework catalog packages');
  const cohortLockPath = path.join(input.workRoot, 'manual-owner-cohort-lock.json');
  writeJson(cohortLockPath, ownerCohortLock(catalog, overlayRoot, input.ownerSnapshots));

  const projections = Object.entries(packages).map(([packageId, entry]) => projectOnePackage({
    packageId,
    catalogEntry: requireObject(entry, `Framework catalog entry ${packageId}`),
    overlayRoot,
    cohortLockPath,
    ownerSnapshot: input.ownerSnapshots[packageId],
  }));
  writeJson(catalogPath, catalog);

  const overlayHead = commandOutput('git', ['rev-parse', 'HEAD'], { cwd: overlayRoot });
  if (overlayHead !== input.framework.head) {
    throw new Error(`Framework overlay HEAD drifted: expected=${input.framework.head} actual=${overlayHead}`);
  }
  return {
    root: overlayRoot,
    head: overlayHead,
    catalog_sha256: `sha256:${fileSha256(catalogPath)}`,
    projections,
  };
}
