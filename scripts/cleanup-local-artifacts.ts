#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultKeepDays = 7;
const validScopes = new Set(['docs', 'tmp', 'artifacts', 'packaged-runtimes', 'all']);

function usage() {
  console.log(`Usage:
  npm run cleanup:local-artifacts
  npm run cleanup:local-artifacts -- --execute
  npm run cleanup:local-artifacts -- --scope artifacts --keep-days 0 --execute

Options:
  --scope <scope>      docs, tmp, artifacts, packaged-runtimes, or all. Repeatable.
  --keep-days <days>   Retain artifacts/* entries newer than this many days. Default: ${defaultKeepDays}.
  --execute            Delete selected paths. Default is dry-run.
  --dry-run            Force dry-run.
  --help               Show this message.`);
}

function options(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      scope: { type: 'string', multiple: true },
      'keep-days': { type: 'string' },
      execute: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
    tokens: true,
  });
  if (parsed.values.help) {
    usage();
    process.exit(0);
  }

  let execute = false;
  for (const token of parsed.tokens) {
    if (token.kind !== 'option') continue;
    if (token.name === 'execute') execute = true;
    if (token.name === 'dry-run') execute = false;
  }

  const keepDays = parsed.values['keep-days'] === undefined ? defaultKeepDays : Number(parsed.values['keep-days']);
  if (!Number.isFinite(keepDays) || keepDays < 0) throw new Error('--keep-days must be a non-negative number.');

  const scopes = new Set((parsed.values.scope ?? ['all']).flatMap((value) => value.split(',').map((scope) => scope.trim())));
  for (const scope of scopes) {
    if (!validScopes.has(scope)) throw new Error(`Unsupported scope: ${scope}`);
  }
  return { execute, keepDays, scopes };
}

function wants(opts: ReturnType<typeof options>, scope: string) {
  return opts.scopes.has('all') || opts.scopes.has(scope);
}

function insideRepo(relativePath: string) {
  const absolute = path.resolve(appRoot, relativePath);
  const relative = path.relative(appRoot, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to manage path outside repo: ${relativePath}`);
  }
  return absolute;
}

function stat(relativePath: string) {
  try {
    return fs.lstatSync(insideRepo(relativePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function maybeRemove(relativePath: string, opts: ReturnType<typeof options>, action: 'delete' | 'skip_recent') {
  const current = stat(relativePath);
  if (current && action === 'delete' && opts.execute) {
    fs.rmSync(insideRepo(relativePath), { recursive: true, force: true });
  }
  return {
    path: relativePath,
    exists: current !== null,
    action: current ? action : 'skip_missing',
    mtime: current ? current.mtime.toISOString() : null,
  };
}

function removeEmpty(relativePath: string, execute: boolean) {
  if (!execute) return;
  const absolute = insideRepo(relativePath);
  if (fs.existsSync(absolute) && fs.readdirSync(absolute).length === 0) fs.rmdirSync(absolute);
}

function main() {
  const opts = options(process.argv.slice(2));
  const entries: Array<Record<string, unknown>> = [];

  if (wants(opts, 'docs')) entries.push({ scope: 'docs', ...maybeRemove('docs/site/latest', opts, 'delete') });
  if (wants(opts, 'tmp')) entries.push({ scope: 'tmp', ...maybeRemove('tmp', opts, 'delete') });
  if (wants(opts, 'packaged-runtimes')) {
    entries.push({
      scope: 'packaged-runtimes',
      ...maybeRemove('packaged-runtimes/opl-full-runtime/runtime', opts, 'delete'),
    });
    entries.push({
      scope: 'packaged-runtimes',
      ...maybeRemove('packaged-runtimes/opl-full-runtime/manifest', opts, 'delete'),
    });
    removeEmpty('packaged-runtimes/opl-full-runtime', opts.execute);
    removeEmpty('packaged-runtimes', opts.execute);
  }
  if (wants(opts, 'artifacts')) {
    const cutoff = Date.now() - opts.keepDays * 24 * 60 * 60 * 1000;
    const root = insideRepo('artifacts');
    for (const name of fs.existsSync(root) ? fs.readdirSync(root).sort() : []) {
      const relativePath = path.join('artifacts', name);
      const current = stat(relativePath);
      const action = current && current.mtimeMs <= cutoff ? 'delete' : 'skip_recent';
      entries.push({ scope: 'artifacts', ...maybeRemove(relativePath, opts, action) });
    }
    removeEmpty('artifacts', opts.execute);
  }

  console.log(JSON.stringify({
    schema: 'opl_app_local_artifact_cleanup.v1',
    status: opts.execute ? 'executed' : 'dry_run',
    keep_days: opts.keepDays,
    scopes: [...opts.scopes],
    entries,
    unmanaged: 'tool state and external shell checkouts are intentionally excluded',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
