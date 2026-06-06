import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function commandOutput(command: string, args: string[], options: { cwd?: string } = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    return '';
  }
  return result.stdout.trim();
}

export function gitOutput(args: string[], cwd: string) {
  return commandOutput('git', args, { cwd });
}

export function gitRefExists(ref: string, cwd: string) {
  return Boolean(gitOutput(['rev-parse', '--verify', '--quiet', ref], cwd));
}

export function normalizeRepositoryName(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const trimmed = value.trim();
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return sshMatch[1];
  }
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (httpsMatch) {
    return httpsMatch[1];
  }
  const ownerRepoMatch = trimmed.match(/^([^/\s]+\/[^/\s]+?)(?:\.git)?$/);
  if (ownerRepoMatch) {
    return ownerRepoMatch[1];
  }
  return null;
}

export function collectCommitSubjects(cwd: string, previousRef: string | null, currentRef: string | null, maxCount = 120) {
  if (!fs.existsSync(path.join(cwd, '.git'))) {
    return [];
  }
  const current = currentRef && gitRefExists(currentRef, cwd) ? currentRef : 'HEAD';
  const range = previousRef && gitRefExists(previousRef, cwd) ? `${previousRef}..${current}` : current;
  const raw = gitOutput(['log', '--no-merges', '--pretty=%s', range, `--max-count=${maxCount}`], cwd);
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function collectRemoteCompare(repository: string | null, previousRef: string | null, currentRef: string | null) {
  if (!repository || !previousRef || !currentRef || previousRef === currentRef) {
    return {
      compare_url: null,
      compare_status: null,
      commit_count: 0,
      change_subjects: [],
    };
  }
  const ownerRepo = normalizeRepositoryName(repository);
  if (!ownerRepo) {
    return {
      compare_url: null,
      compare_status: null,
      commit_count: null,
      change_subjects: [],
    };
  }
  const raw = commandOutput('gh', [
    'api',
    `repos/${ownerRepo}/compare/${previousRef}...${currentRef}`,
    '--jq',
    '{status:.status,ahead_by:.ahead_by,html_url:.html_url,subjects:[.commits[]?.commit.message|split("\\n")[0]]}',
  ]);
  if (!raw) {
    return {
      compare_url: `https://github.com/${ownerRepo}/compare/${previousRef}...${currentRef}`,
      compare_status: null,
      commit_count: null,
      change_subjects: [],
    };
  }
  try {
    const payload = JSON.parse(raw);
    const subjects = (Array.isArray(payload.subjects) ? payload.subjects : [])
      .map((subject: any) => String(subject || '').split(/\r?\n/)[0].trim())
      .filter(Boolean)
      .reverse()
      .slice(0, 8);
    const count = Number.isInteger(payload.ahead_by) ? payload.ahead_by : subjects.length;
    return {
      compare_url: typeof payload.html_url === 'string'
        ? payload.html_url
        : `https://github.com/${ownerRepo}/compare/${previousRef}...${currentRef}`,
      compare_status: typeof payload.status === 'string' ? payload.status : null,
      commit_count: count,
      change_subjects: subjects,
    };
  } catch {
    return {
      compare_url: `https://github.com/${ownerRepo}/compare/${previousRef}...${currentRef}`,
      compare_status: null,
      commit_count: null,
      change_subjects: [],
    };
  }
}

export function readRemoteReleaseTimestamp(repo: string, tag: string | null) {
  if (!tag) {
    return null;
  }
  const raw = commandOutput('gh', ['release', 'view', tag, '--repo', repo, '--json', 'publishedAt,createdAt']);
  if (!raw) {
    return null;
  }
  try {
    const payload = JSON.parse(raw);
    return typeof payload.publishedAt === 'string' && payload.publishedAt
      ? payload.publishedAt
      : typeof payload.createdAt === 'string' && payload.createdAt
        ? payload.createdAt
        : null;
  } catch {
    return null;
  }
}

export function readDefaultBranchRef(repository: string, untilTimestamp: string | null = null) {
  const ownerRepo = normalizeRepositoryName(repository);
  if (!ownerRepo) {
    return null;
  }
  const endpoint = untilTimestamp
    ? `repos/${ownerRepo}/commits?sha=main&until=${encodeURIComponent(untilTimestamp)}&per_page=1`
    : `repos/${ownerRepo}/commits/main`;
  const raw = commandOutput('gh', ['api', endpoint]);
  if (!raw) {
    return null;
  }
  try {
    const payload = JSON.parse(raw);
    if (Array.isArray(payload)) {
      return typeof payload[0]?.sha === 'string' ? payload[0].sha : null;
    }
    return typeof payload.sha === 'string' ? payload.sha : null;
  } catch {
    return null;
  }
}
