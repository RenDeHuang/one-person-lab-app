import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type ReleaseChannel = 'stable' | 'nightly';

type ReleaseNoteOptions = {
  version: string;
  channel: ReleaseChannel;
  releaseRepo?: string;
  shellRoot?: string;
  includeFullPackage?: boolean;
  fullPackageManifest?: unknown;
  previousTag?: string;
  currentTag?: string;
  previousAppRef?: string;
  currentAppRef?: string;
  previousShellRef?: string;
  currentShellRef?: string;
};

type ChangeBucketId = 'first_run' | 'agents' | 'ui_settings' | 'release' | 'docs' | 'quality';

type ChangeBucket = {
  title: string;
  bullets: string[];
};

const bucketOrder: ChangeBucketId[] = ['first_run', 'agents', 'ui_settings', 'release', 'docs', 'quality'];

const bucketTitles: Record<ChangeBucketId, string> = {
  first_run: 'First-run setup',
  agents: 'OPL agent updates',
  ui_settings: 'App UI and runtime status',
  release: 'Packaging, updates, and release validation',
  docs: 'Documentation',
  quality: 'Maintenance',
};

function commandOutput(command: string, args: string[], options: { cwd?: string } = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
  });
  if (result.status !== 0) {
    return '';
  }
  return result.stdout.trim();
}

function gitOutput(args: string[], cwd: string) {
  return commandOutput('git', args, { cwd });
}

function gitRefExists(ref: string, cwd: string) {
  return Boolean(gitOutput(['rev-parse', '--verify', '--quiet', ref], cwd));
}

function normalizeTag(versionOrTag: string) {
  return versionOrTag.startsWith('v') ? versionOrTag : `v${versionOrTag}`;
}

function releaseTimestamp(release: any) {
  const value = release.publishedAt || release.published_at || release.createdAt || release.created_at || '';
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareReleaseVersions(left: string, right: string) {
  const leftMatch = left.match(/^v?(\d+)\.(\d+)\.(\d+)(-nightly)?$/);
  const rightMatch = right.match(/^v?(\d+)\.(\d+)\.(\d+)(-nightly)?$/);
  if (!leftMatch || !rightMatch) {
    return 0;
  }
  for (let index = 1; index <= 3; index += 1) {
    const delta = Number(leftMatch[index]) - Number(rightMatch[index]);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function listRemoteReleaseTags(channel: ReleaseChannel, repo: string, currentTag: string) {
  const raw = commandOutput('gh', ['release', 'list', '--repo', repo, '--limit', '100', '--json', 'tagName,isDraft,isPrerelease,createdAt,publishedAt']);
  if (!raw) {
    return [];
  }
  try {
    const releases = JSON.parse(raw);
    const currentRelease = releases.find((release: any) => release.tagName === currentTag);
    const currentTimestamp = currentRelease ? releaseTimestamp(currentRelease) : 0;
    return releases
      .filter((release: any) => !release.isDraft)
      .filter((release: any) => release.tagName !== currentTag)
      .filter((release: any) => {
        if (channel === 'nightly') {
          return release.isPrerelease === true && /^v\d+\.\d+\.\d+-nightly$/.test(release.tagName);
        }
        return release.isPrerelease !== true && /^v\d+\.\d+\.\d+$/.test(release.tagName);
      })
      .filter((release: any) => {
        if (currentTimestamp > 0) {
          return releaseTimestamp(release) < currentTimestamp;
        }
        return compareReleaseVersions(release.tagName, currentTag) < 0;
      })
      .sort((left: any, right: any) => releaseTimestamp(right) - releaseTimestamp(left))
      .map((release: any) => release.tagName);
  } catch {
    return [];
  }
}

function listLocalTags(channel: ReleaseChannel, currentTag: string) {
  const pattern = channel === 'nightly' ? 'v*-nightly' : 'v[0-9]*.[0-9]*.[0-9]*';
  const raw = commandOutput('git', ['tag', '--list', pattern, '--sort=-creatordate']);
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((tag) => tag !== currentTag)
    .filter((tag) => (channel === 'nightly' ? /^v\d+\.\d+\.\d+-nightly$/.test(tag) : /^v\d+\.\d+\.\d+$/.test(tag)))
    .filter((tag) => compareReleaseVersions(tag, currentTag) < 0);
}

function resolvePreviousTag(options: ReleaseNoteOptions, currentTag: string) {
  if (options.previousTag) {
    return normalizeTag(options.previousTag);
  }
  const releaseRepo = options.releaseRepo || 'gaofeng21cn/one-person-lab-app';
  const [remoteTag] = listRemoteReleaseTags(options.channel, releaseRepo, currentTag);
  if (remoteTag) {
    return remoteTag;
  }
  const [localTag] = listLocalTags(options.channel, currentTag);
  return localTag || null;
}

function readAppShellRefAt(appRef: string | null) {
  if (!appRef || !gitRefExists(appRef, process.cwd())) {
    return null;
  }
  const raw = gitOutput(['show', `${appRef}:contracts/app-shell-adapter.json`], process.cwd());
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw)?.shell_source?.upstream_ref || null;
  } catch {
    return null;
  }
}

function resolveShellRef(shellRoot: string | null, explicitRef: string | undefined, fallbackAppRef: string | null) {
  if (explicitRef) {
    return explicitRef;
  }
  const fromAppContract = readAppShellRefAt(fallbackAppRef);
  if (fromAppContract) {
    return fromAppContract;
  }
  if (shellRoot && fs.existsSync(path.join(shellRoot, '.git'))) {
    const ref = gitOutput(['rev-parse', 'HEAD'], shellRoot);
    if (ref) {
      return ref;
    }
  }
  return null;
}

function resolvePreviousShellRef(shellRoot: string | null, explicitRef: string | undefined, previousAppRef: string | null) {
  if (explicitRef) {
    return explicitRef;
  }
  const fromAppContract = readAppShellRefAt(previousAppRef);
  if (fromAppContract) {
    return fromAppContract;
  }
  if (shellRoot && fs.existsSync(path.join(shellRoot, '.git'))) {
    return gitOutput(['describe', '--tags', '--abbrev=0', 'HEAD^'], shellRoot) || null;
  }
  return null;
}

function collectCommitSubjects(cwd: string, previousRef: string | null, currentRef: string | null, maxCount = 120) {
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

function normalizedSubject(subject: string) {
  return subject
    .replace(/\s+\(#\d+\)\s*$/, '')
    .replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/i, '')
    .trim()
    .toLowerCase();
}

function addUnique(target: string[], value: string) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function classifySubject(subject: string): { bucket: ChangeBucketId; bullet: string } {
  if (/^docs(?:\([^)]+\))?!?:/i.test(subject) || /(readme|guide|screenshot|tutorial)/i.test(subject)) {
    return {
      bucket: 'docs',
      bullet: 'Refreshed installation guides, screenshots, or release documentation so user-facing instructions match the current app.',
    };
  }
  if (/(first[- ]run|beginner|setup surface|bootstrap|initialize|launch ready|ready_to_launch|guid readiness)/i.test(subject)) {
    return {
      bucket: 'first_run',
      bullet: 'Simplified the first-run setup flow so new users see the required setup steps earlier and with less noise.',
    };
  }
  if (/(guid|assistant|skill|codex|model-selector|model selector|home skills|purpose assistant|route)/i.test(subject)) {
    if (/model/i.test(subject)) {
      return {
        bucket: 'agents',
        bullet: 'Improved model status and preference persistence for Codex-backed OPL agent sessions.',
      };
    }
    return {
      bucket: 'agents',
      bullet: 'Updated the packaged OPL agent entry points so MAS, MAG, RCA, and related Codex skills come from the app-controlled bundle.',
    };
  }
  if (/(settings|gui|home|progress|runtime|provider|health|display)/i.test(subject)) {
    return {
      bucket: 'ui_settings',
      bullet: 'Improved settings, runtime status, and progress displays to reduce false initialization waits and unclear readiness states.',
    };
  }
  if (/(release|build|ci|vm|full|package|installer|update|webui|docker|cache|aioncore|dmg|asset)/i.test(subject)) {
    return {
      bucket: 'release',
      bullet: 'Strengthened package builds, updater metadata, VM first-run checks, and CI release validation.',
    };
  }
  return {
    bucket: 'quality',
    bullet: 'Cleaned up tests, formatting, and maintenance work that reduces noise in future release validation.',
  };
}

function summarizeChanges(subjects: string[]) {
  const buckets = new Map<ChangeBucketId, ChangeBucket>();
  for (const bucketId of bucketOrder) {
    buckets.set(bucketId, { title: bucketTitles[bucketId], bullets: [] });
  }

  for (const subject of subjects) {
    const { bucket, bullet } = classifySubject(subject);
    addUnique(buckets.get(bucket)?.bullets ?? [], bullet);
  }

  return bucketOrder
    .map((bucketId) => buckets.get(bucketId))
    .filter((bucket): bucket is ChangeBucket => Boolean(bucket && bucket.bullets.length > 0));
}

function shortSha(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 7) : null;
}

function buildBundledVersionLines(manifest: any) {
  if (!manifest?.components || typeof manifest.components !== 'object') {
    return [];
  }
  const modules = [
    ['MAS', manifest.components.mas],
    ['MAG', manifest.components.mag],
    ['RCA', manifest.components.rca],
    ['OPL Meta Agent', manifest.components.meta_agent],
  ]
    .map(([label, component]) => {
      const sha = shortSha((component as any)?.git_commit);
      return sha ? `${label} @ ${sha}` : null;
    })
    .filter(Boolean);
  const officeCliVersion = manifest.components.officecli?.version;
  if (officeCliVersion) {
    modules.push(`OfficeCLI ${String(officeCliVersion).split(/\r?\n/)[0]}`);
  }
  const mineruOpenApiVersion = manifest.components.mineru_open_api?.version;
  if (mineruOpenApiVersion) {
    modules.push(`MinerU ${String(mineruOpenApiVersion).split(/\r?\n/)[0].replace(/^mineru-open-api version\s+/i, '')}`);
  }
  return modules;
}

function appendBundledAgentBullet(buckets: ChangeBucket[], bundledVersions: string[]) {
  if (bundledVersions.length === 0) {
    return;
  }
  let agentBucket = buckets.find((bucket) => bucket.title === bucketTitles.agents);
  if (!agentBucket) {
    agentBucket = { title: bucketTitles.agents, bullets: [] };
    const agentIndex = bucketOrder.indexOf('agents');
    const insertAt = Math.min(agentIndex, buckets.length);
    buckets.splice(insertAt, 0, agentBucket);
  }
  addUnique(
    agentBucket.bullets,
    `Bundled OPL-family agent and companion tool updates: ${bundledVersions.join('; ')}.`,
  );
}

export function buildReleaseNotesDocument(options: ReleaseNoteOptions) {
  const currentTag = normalizeTag(options.currentTag || options.version);
  const previousTag = resolvePreviousTag(options, currentTag);
  const appCurrentRef = options.currentAppRef || (gitRefExists(currentTag, process.cwd()) ? currentTag : 'HEAD');
  const appPreviousRef = options.previousAppRef || previousTag;
  const shellRoot = options.shellRoot || '';
  const shellPreviousRef = resolvePreviousShellRef(shellRoot || null, options.previousShellRef, appPreviousRef);
  const shellCurrentRef = resolveShellRef(shellRoot || null, options.currentShellRef, appCurrentRef);
  const appSubjects = appPreviousRef
    ? collectCommitSubjects(process.cwd(), appPreviousRef, appCurrentRef)
    : collectCommitSubjects(process.cwd(), null, appCurrentRef, 40);
  const shellSubjects = shellRoot
    ? collectCommitSubjects(shellRoot, shellPreviousRef, shellCurrentRef)
    : [];
  const seen = new Set<string>();
  const subjects = [...shellSubjects, ...appSubjects].filter((subject) => {
    const key = normalizedSubject(subject);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const buckets = summarizeChanges(subjects);
  const bundledVersions = options.includeFullPackage ? buildBundledVersionLines(options.fullPackageManifest) : [];
  appendBundledAgentBullet(buckets, bundledVersions);
  const title = `One Person Lab ${options.version}`;
  const lines = [
    title,
    '',
    options.channel === 'nightly'
      ? `This Nightly prerelease focuses on changes since ${previousTag || 'the previous Nightly'}.`
      : `This Stable release focuses on changes since ${previousTag || 'the previous Stable'}.`,
    '',
    '## What changed',
  ];

  if (buckets.length === 0) {
    lines.push('- Rebuilt and revalidated the release artifacts without additional user-visible changes.');
  } else {
    for (const bucket of buckets) {
      lines.push('', `### ${bucket.title}`, ...bucket.bullets.map((bullet) => `- ${bullet}`));
    }
  }

  lines.push('', '## Release scope');
  if (options.channel === 'nightly') {
    lines.push('- Standard macOS arm64 Nightly package and updater metadata only; Full clean-install assets stay out of the Nightly channel.');
  } else if (options.includeFullPackage) {
    lines.push('- Standard macOS arm64 updater package and Full clean-install DMG are both published for this release.');
  } else {
    lines.push('- Standard macOS arm64 updater package is published for this release.');
  }

  if (bundledVersions.length > 0) {
    lines.push('', '## Bundled OPL runtime and agent versions', `- ${bundledVersions.join('; ')}`);
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
