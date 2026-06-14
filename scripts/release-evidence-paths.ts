import path from 'node:path';

const releaseEvidenceBundleDirError =
  'Pass --bundle-dir <release-evidence-dir> or set OPL_RELEASE_EVIDENCE_BUNDLE_DIR.';

export function defaultReleaseEvidenceBundleDir(): string {
  return process.env.OPL_RELEASE_EVIDENCE_BUNDLE_DIR || '';
}

export function applyReleaseEvidenceBundleDirArg(
  argv: string[],
  index: number,
  setBundleDir: (value: string) => void,
): number | null {
  const token = argv[index];
  if (token !== '--bundle-dir') return null;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${token}`);
  }
  setBundleDir(value);
  return index + 1;
}

export function resolveRequiredReleaseEvidenceBundleDir(bundleDir: string): string {
  if (!bundleDir.trim()) {
    throw new Error(releaseEvidenceBundleDirError);
  }
  return path.resolve(bundleDir);
}

export function resolveEvidenceBundlePath(
  bundleDir: string,
  artifactPath: string,
  options: { allowAbsoluteArtifactPath?: boolean } = {},
) {
  if (!options.allowAbsoluteArtifactPath && path.isAbsolute(artifactPath)) {
    throw new Error(`Evidence artifact path must be relative: ${artifactPath}`);
  }
  const resolved = path.resolve(bundleDir, artifactPath);
  const relative = path.relative(bundleDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Evidence artifact path escapes bundle root: ${artifactPath}`);
  }
  return resolved;
}
