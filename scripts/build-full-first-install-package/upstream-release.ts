import { spawnSync } from 'node:child_process';

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

type CommandRunner = (command: string, args: string[], options: { cwd: string }) => CommandResult;

type StableTag = {
  tag: string;
  version: string;
  commit: string;
};

function run(command: string, args: string[], options: { cwd: string }): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function commandFailure(command: string, args: string[], result: CommandResult) {
  const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return new Error([
    `Command failed: ${command} ${args.join(' ')}`,
    detail,
  ].filter(Boolean).join('\n'));
}

function stableVersion(tag: string) {
  const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    normalized: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`,
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
  };
}

function compareVersionParts(left: number[], right: number[]) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function parseLatestStableGitTag(output: string): StableTag {
  const refs = new Map<string, { object: string | null; peeled: string | null }>();
  for (const rawLine of output.split(/\r?\n/)) {
    const [sha, ref] = rawLine.trim().split(/\s+/, 2);
    if (!sha || !ref?.startsWith('refs/tags/')) continue;
    const peeled = ref.endsWith('^{}');
    const tag = ref.slice('refs/tags/'.length).replace(/\^\{\}$/, '');
    if (!stableVersion(tag)) continue;
    const current = refs.get(tag) ?? { object: null, peeled: null };
    if (peeled) current.peeled = sha;
    else current.object = sha;
    refs.set(tag, current);
  }

  const candidates = [...refs.entries()].map(([tag, refsForTag]) => {
    const parsed = stableVersion(tag)!;
    return {
      tag,
      version: parsed.normalized,
      parts: parsed.parts,
      commit: refsForTag.peeled ?? refsForTag.object,
    };
  }).filter((entry): entry is StableTag & { parts: number[] } => Boolean(entry.commit));

  candidates.sort((left, right) => compareVersionParts(right.parts, left.parts));
  const latest = candidates[0];
  if (!latest) {
    throw new Error('OfficeCLI upstream returned no stable semantic-version release tags.');
  }
  return {
    tag: latest.tag,
    version: latest.version,
    commit: latest.commit,
  };
}

function firstLine(value: string) {
  return value.trim().split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
}

function normalizeReportedVersion(value: string | null) {
  if (!value) return null;
  return value.match(/\b(\d+\.\d+\.\d+)\b/)?.[1] ?? null;
}

export function resolveOfficeCliReleaseSource(
  root: string,
  requestedRef = 'latest-stable',
  runner: CommandRunner = run,
) {
  const headResult = runner('git', ['rev-parse', 'HEAD'], { cwd: root });
  const head = firstLine(headResult.stdout);
  if (headResult.status !== 0 || !head) throw commandFailure('git', ['rev-parse', 'HEAD'], headResult);

  if (requestedRef !== 'latest-stable') {
    const refResult = runner('git', ['rev-parse', '--verify', `${requestedRef}^{commit}`], { cwd: root });
    const resolvedCommit = firstLine(refResult.stdout);
    if (refResult.status !== 0 || !resolvedCommit) {
      throw commandFailure('git', ['rev-parse', '--verify', `${requestedRef}^{commit}`], refResult);
    }
    if (resolvedCommit !== head) {
      throw new Error(`OfficeCLI checkout HEAD ${head} does not match requested replay ref ${requestedRef} (${resolvedCommit}).`);
    }
    return {
      policy: 'explicit_replay_ref',
      requested_ref: requestedRef,
      resolved_ref: requestedRef,
      resolved_commit: resolvedCommit,
      latest_stable_verified: false,
      version: stableVersion(requestedRef)?.normalized ?? null,
    };
  }

  const remoteResult = runner('git', ['ls-remote', '--tags', 'origin'], { cwd: root });
  if (remoteResult.status !== 0) throw commandFailure('git', ['ls-remote', '--tags', 'origin'], remoteResult);
  const latest = parseLatestStableGitTag(remoteResult.stdout);
  if (latest.commit !== head) {
    throw new Error(
      `OfficeCLI checkout is not latest stable: HEAD ${head}, latest ${latest.tag} (${latest.commit}). Update the checkout before building Full.`,
    );
  }
  return {
    policy: 'latest_stable_at_full_build',
    requested_ref: requestedRef,
    resolved_ref: latest.tag,
    resolved_commit: latest.commit,
    latest_stable_verified: true,
    version: latest.version,
  };
}

export function assertOfficeCliBinaryMatchesRelease(
  reportedVersion: string | null,
  release: { version: string | null; resolved_ref: string },
) {
  const normalized = normalizeReportedVersion(reportedVersion);
  if (!normalized) {
    throw new Error('OfficeCLI binary did not report a semantic version.');
  }
  if (release.version && normalized !== release.version) {
    throw new Error(
      `OfficeCLI binary version ${normalized} does not match source release ${release.resolved_ref} (${release.version}).`,
    );
  }
  return normalized;
}
