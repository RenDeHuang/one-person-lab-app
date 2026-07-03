import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function readRemoteFullPackageManifest(repo: string, tag: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-manifest-'));
  try {
    const publicManifest = downloadManifestAsset(repo, tag, 'opl-release-manifest.json', tempRoot);
    const normalizedPublicManifest = normalizeFullPackageManifest(publicManifest);
    if (normalizedPublicManifest) {
      return normalizedPublicManifest;
    }
    const legacyManifest = downloadManifestAsset(repo, tag, 'full-package-manifest.json', tempRoot);
    return normalizeFullPackageManifest(legacyManifest);
  } catch {
    return null;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function downloadManifestAsset(repo: string, tag: string, assetName: string, downloadDir: string) {
  const result = spawnSync('gh', [
    'release',
    'download',
    tag,
    '--repo',
    repo,
    '--pattern',
    assetName,
    '--dir',
    downloadDir,
    '--clobber',
  ], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
  });
  if (result.status !== 0) {
    return null;
  }
  const manifestPath = path.join(downloadDir, assetName);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function normalizeFullPackageManifest(releaseManifest: any) {
  if (!releaseManifest || typeof releaseManifest !== 'object') {
    return null;
  }
  if (releaseManifest.schema === 'opl_public_release_manifest.v1') {
    return releaseManifest.manifest && typeof releaseManifest.manifest === 'object'
      ? releaseManifest.manifest
      : null;
  }
  return releaseManifest.components && typeof releaseManifest.components === 'object'
    ? releaseManifest
    : null;
}
