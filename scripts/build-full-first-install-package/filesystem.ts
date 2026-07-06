import fs from 'node:fs';
import path from 'node:path';

import {
  listFullRuntimeProductionNodeModulePaths,
  shouldExcludeNodeToolchainPackagePath,
  shouldExcludeProductionNodeModulePath,
  shouldExcludeRuntimePath,
} from '../full-first-install-package.ts';

export function requirePath(filePath, label) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath || '(empty)'}`);
  }
  return filePath;
}

export function directorySizeBytes(root) {
  let total = 0;
  if (!fs.existsSync(root)) {
    return 0;
  }
  if (fs.statSync(root).isFile()) {
    return fs.statSync(root).size;
  }
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else {
      total += stat.size;
    }
  }
  return total;
}

export function copyTreeFiltered(sourceRoot, targetRoot, runtimePrefix) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  fs.mkdirSync(targetRoot, { recursive: true });

  const copyEntry = (sourcePath, targetPath, relativeFromSource) => {
    const runtimeRelative = path.posix.join(runtimePrefix, relativeFromSource.split(path.sep).join('/'));
    if (shouldExcludeRuntimePath(runtimeRelative)) {
      return;
    }

    const stat = fs.lstatSync(sourcePath);
    if (stat.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      for (const entry of fs.readdirSync(sourcePath)) {
        copyEntry(path.join(sourcePath, entry), path.join(targetPath, entry), path.join(relativeFromSource, entry));
      }
      return;
    }

    if (stat.isSymbolicLink()) {
      const realPath = fs.realpathSync(sourcePath);
      const realStat = fs.statSync(realPath);
      if (realStat.isDirectory()) {
        fs.mkdirSync(targetPath, { recursive: true });
        for (const entry of fs.readdirSync(realPath)) {
          copyEntry(path.join(realPath, entry), path.join(targetPath, entry), path.join(relativeFromSource, entry));
        }
        return;
      }
      if (realStat.isFile()) {
        copyFileWithMode(realPath, targetPath, realStat);
      }
      return;
    }

    if (stat.isFile()) {
      copyFileWithMode(sourcePath, targetPath, stat);
    }
  };

  for (const entry of fs.readdirSync(sourceRoot)) {
    copyEntry(path.join(sourceRoot, entry), path.join(targetRoot, entry), entry);
  }
}

export function copySingleFile(sourcePath, targetPath) {
  copyFileWithMode(sourcePath, targetPath);
}

function isInsidePath(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function copyFileWithMode(sourcePath, targetPath, stat = fs.statSync(sourcePath)) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  fs.chmodSync(targetPath, stat.mode);
}

function copyDirectoryEntries(sourcePath, targetPath, copyEntry) {
  fs.mkdirSync(targetPath, { recursive: true });
  for (const entry of fs.readdirSync(sourcePath)) {
    copyEntry(path.join(sourcePath, entry), path.join(targetPath, entry), entry);
  }
}

function copyPortableInternalSymlink(targetPath, sourceBase, targetBase, resolvedSourceTarget) {
  if (!isInsidePath(sourceBase, resolvedSourceTarget)) {
    return false;
  }

  const targetEquivalent = path.join(targetBase, path.relative(sourceBase, resolvedSourceTarget));
  const portableLinkTarget = path.relative(path.dirname(targetPath), targetEquivalent) || '.';
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.symlinkSync(portableLinkTarget, targetPath);
  return true;
}

export function copyPortableTree(sourceRoot, targetRoot) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  const sourceBase = path.resolve(sourceRoot);
  const targetBase = path.resolve(targetRoot);

  const copyEntry = (sourcePath, targetPath) => {
    const stat = fs.lstatSync(sourcePath);
    if (stat.isDirectory()) {
      copyDirectoryEntries(sourcePath, targetPath, copyEntry);
      return;
    }

    if (stat.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(sourcePath);
      const resolvedSourceTarget = path.resolve(path.dirname(sourcePath), linkTarget);
      if (copyPortableInternalSymlink(targetPath, sourceBase, targetBase, resolvedSourceTarget)) {
        return;
      }

      const realStat = fs.statSync(resolvedSourceTarget);
      if (realStat.isDirectory()) {
        copyPortableTree(resolvedSourceTarget, targetPath);
        return;
      }
      copyFileWithMode(resolvedSourceTarget, targetPath, realStat);
      return;
    }

    if (stat.isFile()) {
      copyFileWithMode(sourcePath, targetPath, stat);
    }
  };

  copyEntry(sourceBase, targetBase);
}

export function assertNoExternalSymlinks(root, label) {
  const rootPath = path.resolve(root);
  const violations = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    if (!stat.isSymbolicLink()) {
      continue;
    }
    const linkTarget = fs.readlinkSync(current);
    const resolvedTarget = path.resolve(path.dirname(current), linkTarget);
    if (path.isAbsolute(linkTarget) || !isInsidePath(rootPath, resolvedTarget)) {
      violations.push(`${path.relative(rootPath, current)} -> ${linkTarget}`);
    }
  }
  if (violations.length > 0) {
    throw new Error(`${label} contains external symlink(s):\n${violations.map((entry) => `  - ${entry}`).join('\n')}`);
  }
}

export function copyPathContents(sourceRoot, targetRoot) {
  fs.mkdirSync(targetRoot, { recursive: true });
  if (!fs.existsSync(sourceRoot)) {
    return;
  }
  for (const entry of fs.readdirSync(sourceRoot)) {
    copyPortableTree(path.join(sourceRoot, entry), path.join(targetRoot, entry));
  }
}

export function copyExecutableOrSymlinkTarget(sourceRoot, relativePath, targetRoot) {
  const sourcePath = path.join(sourceRoot, ...relativePath.split('/'));
  const targetPath = path.join(targetRoot, ...relativePath.split('/'));
  const stat = fs.lstatSync(sourcePath);
  if (stat.isSymbolicLink()) {
    const resolved = fs.realpathSync(sourcePath);
    const realStat = fs.statSync(resolved);
    copyFileWithMode(resolved, targetPath, realStat);
    return;
  }
  copySingleFile(sourcePath, targetPath);
}

export function copyNodeRuntimePayload(nodeRoot, targetRoot) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  for (const relativePath of ['bin/node', 'bin/npm', 'bin/npx']) {
    copyExecutableOrSymlinkTarget(nodeRoot, relativePath, targetRoot);
  }
  for (const packageName of ['npm', 'corepack']) {
    const sourcePath = path.join(nodeRoot, 'lib', 'node_modules', packageName);
    if (!fs.existsSync(sourcePath)) {
      if (packageName === 'corepack') continue;
      throw new Error(`Node runtime package missing: lib/node_modules/${packageName}`);
    }
    copyNodeToolchainPackage(sourcePath, path.join(targetRoot, 'lib', 'node_modules', packageName));
  }
  assertNoExternalSymlinks(targetRoot, 'Full first-install Node runtime');
}

function copyNodeToolchainPackage(sourceRoot, targetRoot) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  const sourceBase = path.resolve(sourceRoot);
  const targetBase = path.resolve(targetRoot);

  const copyEntry = (sourcePath, targetPath, relativePath) => {
    if (relativePath && shouldExcludeNodeToolchainPackagePath(relativePath)) {
      return;
    }
    const stat = fs.lstatSync(sourcePath);
    if (stat.isDirectory()) {
      copyDirectoryEntries(sourcePath, targetPath, (childSourcePath, childTargetPath, entry) => {
        copyEntry(childSourcePath, childTargetPath, path.posix.join(relativePath, entry));
      });
      return;
    }

    if (stat.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(sourcePath);
      const resolvedSourceTarget = path.resolve(path.dirname(sourcePath), linkTarget);
      if (copyPortableInternalSymlink(targetPath, sourceBase, targetBase, resolvedSourceTarget)) {
        return;
      }

      const realStat = fs.statSync(resolvedSourceTarget);
      if (realStat.isDirectory()) {
        copyDirectoryEntries(resolvedSourceTarget, targetPath, (childSourcePath, childTargetPath, entry) => {
          copyEntry(childSourcePath, childTargetPath, path.posix.join(relativePath, entry));
        });
        return;
      }
      copyFileWithMode(resolvedSourceTarget, targetPath, realStat);
      return;
    }

    if (stat.isFile()) {
      copyFileWithMode(sourcePath, targetPath, stat);
    }
  };

  copyEntry(sourceBase, targetRoot, '');
}

export function copyProductionNodeModules(sourceRoot, targetRoot) {
  const lockPath = path.join(sourceRoot, 'package-lock.json');
  const nodeModulesRoot = path.join(sourceRoot, 'node_modules');
  if (!fs.existsSync(lockPath) || !fs.existsSync(nodeModulesRoot)) {
    return;
  }
  const packageLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  for (const relativePath of listFullRuntimeProductionNodeModulePaths(packageLock)) {
    const sourcePath = path.join(sourceRoot, relativePath);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    const targetPath = path.join(targetRoot, relativePath);
    copyProductionNodeModule(sourcePath, targetPath);
  }
}

function copyProductionNodeModule(sourceRoot, targetRoot) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  const sourceBase = path.resolve(sourceRoot);

  const copyEntry = (sourcePath, targetPath) => {
    const relativePath = path.relative(sourceBase, sourcePath).split(path.sep).join('/');
    if (relativePath && shouldExcludeProductionNodeModulePath(relativePath)) {
      return;
    }
    const stat = fs.lstatSync(sourcePath);
    if (stat.isDirectory()) {
      copyDirectoryEntries(sourcePath, targetPath, copyEntry);
      return;
    }
    if (stat.isSymbolicLink()) {
      const realPath = fs.realpathSync(sourcePath);
      const realStat = fs.statSync(realPath);
      if (realStat.isDirectory()) {
        copyDirectoryEntries(realPath, targetPath, copyEntry);
        return;
      }
      if (realStat.isFile()) {
        copyFileWithMode(realPath, targetPath, realStat);
      }
      return;
    }
    if (stat.isFile()) {
      copyFileWithMode(sourcePath, targetPath, stat);
    }
  };

  copyEntry(sourceBase, targetRoot);
}
