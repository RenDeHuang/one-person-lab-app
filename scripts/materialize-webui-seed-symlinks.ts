#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

type MaterializedSymlink = {
  path: string;
  target: string;
  mode: number;
  size_bytes: number;
};

function fail(message: string): never {
  throw new Error(message);
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function collectSymlinks(root: string): string[] {
  const symlinks: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      symlinks.push(current);
      continue;
    }
    if (!stat.isDirectory()) continue;
    const children = fs.readdirSync(current).sort().reverse();
    for (const child of children) stack.push(path.join(current, child));
  }
  return symlinks.sort();
}

function assertNoSymlinkTraversal(root: string, candidate: string, linkPath: string): void {
  const relative = path.relative(root, candidate);
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch {
      fail(`WebUI seed payload contains a broken symbolic link: ${linkPath}`);
    }
    if (stat.isSymbolicLink()) {
      fail(`WebUI seed symbolic link target may not traverse another symbolic link: ${linkPath}`);
    }
  }
}

export function materializeWebuiSeedSymlinks(rootInput: string): MaterializedSymlink[] {
  const root = path.resolve(rootInput);
  let rootStat: fs.Stats;
  try {
    rootStat = fs.lstatSync(root);
  } catch {
    return fail(`WebUI seed payload root is missing: ${root}`);
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    return fail(`WebUI seed payload root must be a real directory: ${root}`);
  }

  const realRoot = fs.realpathSync.native(root);
  const validated = collectSymlinks(root).map((linkPath) => {
    if (path.basename(path.dirname(linkPath)) !== '.bin') {
      return fail(`WebUI seed payload may materialize only npm .bin symbolic links: ${linkPath}`);
    }
    const target = fs.readlinkSync(linkPath);
    if (path.isAbsolute(target)) {
      return fail(`WebUI seed payload contains an absolute symbolic link: ${linkPath}`);
    }
    const lexicalTarget = path.resolve(path.dirname(linkPath), target);
    if (!isPathInside(root, lexicalTarget)) {
      return fail(`WebUI seed symbolic link target escapes the payload root: ${linkPath}`);
    }
    assertNoSymlinkTraversal(root, lexicalTarget, linkPath);
    let targetStat: fs.Stats;
    try {
      targetStat = fs.lstatSync(lexicalTarget);
    } catch {
      return fail(`WebUI seed payload contains a broken symbolic link: ${linkPath}`);
    }
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
      return fail(`WebUI seed symbolic link must target a regular file: ${linkPath}`);
    }
    if ((targetStat.mode & 0o111) === 0) {
      return fail(`WebUI seed symbolic link must target an executable file: ${linkPath}`);
    }
    const targetHandle = fs.openSync(lexicalTarget, 'r');
    const targetPrefixBytes = Buffer.alloc(2);
    try {
      fs.readSync(targetHandle, targetPrefixBytes, 0, targetPrefixBytes.byteLength, 0);
    } finally {
      fs.closeSync(targetHandle);
    }
    const targetPrefix = targetPrefixBytes.toString('utf8');
    if (targetPrefix !== '#!') {
      return fail(`WebUI seed executable target must declare an interpreter: ${linkPath}`);
    }
    const realTarget = fs.realpathSync.native(lexicalTarget);
    if (!isPathInside(realRoot, realTarget)) {
      return fail(`WebUI seed symbolic link target escapes the physical payload root: ${linkPath}`);
    }
    return {
      linkPath,
      target,
      targetPath: lexicalTarget,
      mode: targetStat.mode & 0o777,
    };
  });

  const materialized: MaterializedSymlink[] = [];
  for (const [index, entry] of validated.entries()) {
    const temporary = `${entry.linkPath}.opl-materialized-${process.pid}-${index}`;
    const wrapper = `#!/bin/sh\nexec "$(dirname "$0")"/${shellSingleQuote(entry.target)} "$@"\n`;
    try {
      fs.writeFileSync(temporary, wrapper, { flag: 'wx', mode: entry.mode });
      fs.chmodSync(temporary, entry.mode);
      fs.renameSync(temporary, entry.linkPath);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
    const resultStat = fs.lstatSync(entry.linkPath);
    if (!resultStat.isFile() || resultStat.isSymbolicLink()) {
      return fail(`WebUI seed symbolic link was not materialized as a regular file: ${entry.linkPath}`);
    }
    materialized.push({
      path: path.relative(root, entry.linkPath),
      target: entry.target,
      mode: resultStat.mode & 0o777,
      size_bytes: resultStat.size,
    });
  }

  const remaining = collectSymlinks(root);
  if (remaining.length > 0) {
    return fail(`WebUI seed payload still contains symbolic links after materialization: ${remaining[0]}`);
  }
  return materialized;
}

function main(): void {
  const { values } = parseArgs({
    options: { root: { type: 'string' } },
    strict: true,
  });
  if (!values.root) fail('Usage: materialize-webui-seed-symlinks.ts --root <payload-directory>');
  const materialized = materializeWebuiSeedSymlinks(values.root);
  process.stdout.write(`${JSON.stringify({
    schema: 'opl_app_webui_seed_symlink_materialization.v1',
    status: 'passed',
    root: path.resolve(values.root),
    materialized,
  })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
