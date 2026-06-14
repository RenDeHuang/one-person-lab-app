import path from 'node:path';

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
