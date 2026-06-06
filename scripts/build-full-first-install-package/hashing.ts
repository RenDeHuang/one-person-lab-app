import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  listFullRuntimeProductionNodeModulePaths,
  shouldExcludeRuntimePath,
} from '../full-first-install-package.ts';

export function fileSha256(filePath) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function stringSha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function functionSourceSha256(functions) {
  return stringSha256(functions.map((fn) => fn.toString()).join('\n\n'));
}

export function hashFiles(sourceRoot, relativePaths) {
  const entries = {};
  for (const relativePath of relativePaths) {
    const filePath = path.join(sourceRoot, relativePath);
    entries[relativePath] = fs.existsSync(filePath) ? fileSha256(filePath) : null;
  }
  return entries;
}

export function directoryFingerprint(root, runtimePrefix) {
  if (!fs.existsSync(root)) {
    return null;
  }
  const hash = crypto.createHash('sha256');
  const stack = [['', root]];
  while (stack.length > 0) {
    const [relative, current] = stack.pop();
    const runtimeRelative = relative
      ? path.posix.join(runtimePrefix, relative.split(path.sep).join('/'))
      : runtimePrefix;
    if (relative && shouldExcludeRuntimePath(runtimeRelative)) {
      continue;
    }
    const stat = fs.lstatSync(current);
    hash.update(relative);
    hash.update(stat.isDirectory() ? 'dir' : stat.isSymbolicLink() ? 'symlink' : 'file');
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current).sort().reverse()) {
        stack.push([path.join(relative, entry), path.join(current, entry)]);
      }
    } else if (stat.isSymbolicLink()) {
      hash.update(fs.readlinkSync(current));
    } else if (stat.isFile()) {
      hash.update(fs.readFileSync(current));
    }
  }
  return hash.digest('hex');
}

export function productionNodeModulesFingerprint(sourceRoot) {
  const lockPath = path.join(sourceRoot, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    return null;
  }

  const packageLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const productionPaths = listFullRuntimeProductionNodeModulePaths(packageLock);
  const hash = crypto.createHash('sha256');
  for (const relativePath of productionPaths) {
    const absolutePath = path.join(sourceRoot, relativePath);
    hash.update(relativePath);
    hash.update(fs.existsSync(absolutePath) ? directoryFingerprint(absolutePath, relativePath) : 'missing');
  }
  return hash.digest('hex');
}

export function packageJsonVersion(packagePath) {
  if (!fs.existsSync(packagePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}
