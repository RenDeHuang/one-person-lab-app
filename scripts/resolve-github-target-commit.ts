#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const shaPattern = /^[0-9a-f]{40}$/;
const refPattern = /^[A-Za-z0-9._/@-]+$/;

type GhApi = (path: string) => unknown;

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function requireSha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !shaPattern.test(value)) {
    throw new Error(`${label} must resolve to an exact commit SHA.`);
  }
  return value;
}

function readGitObject(
  value: unknown,
  label: string,
  ghApi: GhApi,
  depth = 0,
): string {
  if (depth > 4) throw new Error(`${label} tag chain is too deep.`);
  const ref = requireObject(value, label);
  const object = requireObject(ref.object, `${label}.object`);
  const type = object.type;
  const sha = requireSha(object.sha, `${label}.object.sha`);
  if (type === 'commit') return sha;
  if (type === 'tag') {
    return readGitObject(
      ghApi(`repos/${process.env.GITHUB_REPOSITORY}/git/tags/${sha}`),
      `${label}.tag`,
      ghApi,
      depth + 1,
    );
  }
  throw new Error(`${label} must resolve to a commit object; got ${String(type ?? 'missing')}.`);
}

function resolveRef(name: string, ghApi: GhApi): string {
  const refs: Array<{ kind: string; sha: string }> = [];
  for (const kind of ['heads', 'tags']) {
    try {
      const sha = readGitObject(
        ghApi(`repos/${process.env.GITHUB_REPOSITORY}/git/ref/${kind}/${name}`),
        `${kind}/${name}`,
        ghApi,
      );
      refs.push({ kind, sha });
    } catch (error) {
      if (error instanceof Error && /HTTP 404/.test(error.message)) continue;
      throw error;
    }
  }
  if (refs.length === 0) throw new Error(`Git ref ${name} was not found.`);
  if (refs.length > 1) throw new Error(`Git ref ${name} is ambiguous across branch/tag refs.`);
  return refs[0].sha;
}

export function resolveGithubReleaseCommit(
  target: string,
  releaseTag: string,
  ghApi: GhApi,
): string {
  const normalized = target.trim();
  const normalizedTag = releaseTag.trim();
  if (!/^v[A-Za-z0-9._-]+$/.test(normalizedTag)) {
    throw new Error('Latest release tag is invalid.');
  }
  if (
    !shaPattern.test(normalized)
    && (!normalized
    || !refPattern.test(normalized)
    || normalized.startsWith('/')
    || normalized.endsWith('/')
    || normalized.startsWith('.')
    || normalized.endsWith('.')
    || normalized.includes('..')
    || normalized.includes('@{')
    || normalized.includes('//'))
  ) {
    throw new Error('Latest target_commitish must be an exact SHA or a valid branch/tag ref.');
  }

  const releaseCommit = readGitObject(
    ghApi(`repos/${process.env.GITHUB_REPOSITORY}/git/ref/tags/${normalizedTag}`),
    `tags/${normalizedTag}`,
    ghApi,
  );
  if (shaPattern.test(normalized)) {
    if (normalized !== releaseCommit) {
      throw new Error('Latest exact target_commitish does not match its release tag commit.');
    }
  } else {
    void resolveRef(normalized, ghApi);
  }
  return releaseCommit;
}

function main(): void {
  const { values } = parseArgs({
    options: {
      target: { type: 'string' },
      'release-tag': { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  const target = values.target?.trim() ?? '';
  const releaseTag = values['release-tag']?.trim() ?? '';
  if (!target || !releaseTag) throw new Error('Pass --target <sha|branch|tag> --release-tag <tag>.');
  const repository = process.env.GITHUB_REPOSITORY?.trim() ?? '';
  if (!repository) throw new Error('GITHUB_REPOSITORY is required.');
  const result = resolveGithubReleaseCommit(target, releaseTag, (path) => {
    try {
      const output = execFileSync('gh', ['api', path], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return JSON.parse(output);
    } catch (error) {
      const stderr = error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr?: unknown }).stderr ?? '')
        : '';
      if (/HTTP 404/.test(stderr)) throw new Error('HTTP 404');
      throw new Error(stderr.trim() || (error instanceof Error ? error.message : String(error)));
    }
  });
  process.stdout.write(`${result}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
