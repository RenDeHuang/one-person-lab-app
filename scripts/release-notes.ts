import fs from 'node:fs';
import os from 'node:os';
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
  previousFullPackageManifest?: unknown;
  previousTag?: string;
  currentTag?: string;
  previousAppRef?: string;
  currentAppRef?: string;
  previousShellRef?: string;
  currentShellRef?: string;
};

type ChangeBucketId = 'agents' | 'first_run' | 'release' | 'ui_settings' | 'docs' | 'quality';

type ChangeBucket = {
  title: string;
  bullets: string[];
};

export type AgentRuntimeChange = {
  label: string;
  component: string;
  role: string;
  previous_ref: string | null;
  current_ref: string | null;
  audit_ref: string | null;
  change_subjects: string[];
  user_value_hint: string;
  change_summary_hint: string | null;
};

export type ReleaseNotesEvidence = {
  schema: 'opl_app_release_notes_evidence.v1';
  version: string;
  channel: ReleaseChannel;
  release_repo: string;
  current_tag: string;
  previous_tag: string | null;
  app_commit_subjects: string[];
  shell_commit_subjects: string[];
  grouped_changes: ChangeBucket[];
  payload: {
    include_full_package: boolean;
    lines: string[];
    bundled_refs: string[];
    updates_since_previous_stable: string[];
  };
  agent_runtime_changes: AgentRuntimeChange[];
  release_scope: string;
  full_changelog_url: string | null;
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
  const normalized = normalizedSubject(subject);
  if (/^docs(?:\([^)]+\))?!?:/i.test(subject) || /(readme|guide|screenshot|tutorial)/i.test(subject)) {
    return {
      bucket: 'docs',
      bullet: 'Kept the install and getting-started guidance aligned with the agent entries and runtime payload shipped in the App.',
    };
  }
  if (/(first[- ]run|beginner|setup surface|bootstrap|initialize|launch ready|ready_to_launch|guid readiness)/i.test(subject)) {
    return {
      bucket: 'first_run',
      bullet: 'Simplified the first-run setup flow so new users see the required setup steps earlier and with less noise.',
    };
  }
  if (/(guid|assistant|skill|codex|model-selector|model selector|home skills|purpose assistant|route|mas|mag|rca|oma|opl meta agent|plugin)/i.test(subject)) {
    if (/model/i.test(subject)) {
      return {
        bucket: 'agents',
        bullet: 'Improved Codex model status and preference handling for MAS, MAG, RCA, and related OPL agent sessions.',
      };
    }
    return {
      bucket: 'agents',
      bullet: 'Updated the App-managed MAS, MAG, RCA, OPL Meta Agent, and Codex skill/plugin surface used by OPL agent sessions.',
    };
  }
  if (/(settings|gui|home|progress|runtime|provider|health|display)/i.test(subject)) {
    return {
      bucket: 'ui_settings',
      bullet: 'Made App runtime and provider readiness easier to read before users open MAS, MAG, RCA, or other OPL agent sessions.',
    };
  }
  if (/(release|build|ci|vm|full|package|installer|update|webui|docker|cache|aioncore|dmg|asset)/i.test(subject)) {
    return {
      bucket: 'release',
      bullet: 'Kept the standard DMG, Full DMG, one-shot installer, and Docker/WebUI install paths separately checked so users get the right package for their environment.',
    };
  }
  return {
    bucket: 'quality',
    bullet: 'Reduced maintenance noise around the App release surface so user-facing install and agent paths stay easier to verify.',
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

const payloadComponentSpecs = [
  {
    label: 'OPL Framework',
    key: 'opl',
    role: 'shared runtime and app state/action contracts',
    user_value_hint: 'Keeps App-managed OPL state reads and actions aligned with the runtime shipped in the installer.',
  },
  {
    label: 'Codex CLI',
    key: 'codex',
    role: 'local AI execution engine for App-managed agent sessions',
    user_value_hint: 'Runs the local Codex sessions used by the built-in OPL agent and skill surfaces.',
  },
  {
    label: 'MAS',
    key: 'mas',
    role: 'research automation and study workflow agent',
    user_value_hint: 'Helps users run research and study workflows with clearer evidence, blockers, and next steps.',
  },
  {
    label: 'MAG',
    key: 'mag',
    role: 'grant-writing and funding workflow agent',
    user_value_hint: 'Helps users turn project context into clearer grant and funding materials.',
  },
  {
    label: 'RCA',
    key: 'rca',
    role: 'visual deliverable, slide, and report graphics agent',
    user_value_hint: 'Helps users prepare visual deliverables, slides, and report graphics with fewer manual checks.',
  },
  {
    label: 'OPL Meta Agent',
    key: 'meta_agent',
    role: 'agent design, testing, and improvement assistant',
    user_value_hint: 'Helps users design, test, and improve OPL-compatible agents from inside the App.',
  },
  {
    label: 'OfficeCLI',
    key: 'officecli',
    role: 'Office document generation and editing tool',
    user_value_hint: 'Supports App-managed Word, Excel, and PowerPoint document work.',
  },
  {
    label: 'MinerU',
    key: 'mineru_open_api',
    role: 'document extraction, OCR, and PDF parsing tool',
    user_value_hint: 'Supports document extraction and PDF/OCR intake for OPL workflows.',
  },
] as const;

function shortSha(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 7) : null;
}

function normalizeComponentVersion(label: string, value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const firstLine = value.split(/\r?\n/)[0].trim();
  if (label === 'Codex CLI') {
    return firstLine.replace(/^codex-cli\s+/i, '');
  }
  if (label === 'MinerU') {
    return firstLine.replace(/^mineru-open-api version\s+/i, '');
  }
  return firstLine;
}

function componentDisplayValue(label: string, component: any) {
  if (!component || typeof component !== 'object') {
    return null;
  }
  const sha = shortSha(component.git_commit);
  if (sha) {
    return { kind: 'git', value: sha };
  }
  const version = normalizeComponentVersion(label, component.version);
  return version ? { kind: 'version', value: version } : null;
}

function buildBundledVersionLines(manifest: any) {
  if (!manifest?.components || typeof manifest.components !== 'object') {
    return [];
  }
  const modules = payloadComponentSpecs
    .map(({ label, key }) => {
      const value = componentDisplayValue(label, manifest.components[key]);
      if (!value) {
        return null;
      }
      return value.kind === 'git' ? `${label} @ ${value.value}` : `${label} ${value.value}`;
    })
    .filter(Boolean);
  return modules;
}

function buildFullPayloadDescription(bundledVersions: string[]) {
  const labels = bundledVersions.map((line) => line.replace(/\s+(?:@|[0-9v]).*$/, '').trim());
  const requiredBase = ['OPL Framework', 'Codex CLI', 'MAS', 'MAG', 'RCA'];
  if (requiredBase.every((label) => labels.includes(label))
    && labels.includes('OPL Meta Agent')
    && labels.includes('OfficeCLI')
    && labels.includes('MinerU')) {
    return 'Full clean-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.';
  }
  const payloads = labels.length > 0
    ? labels.join(', ')
    : 'the components recorded in full-package-manifest.json';
  return `Full clean-install DMG payload recorded in this release manifest: ${payloads}, plus packaged Codex skills where present.`;
}

function buildPayloadUpdateLines(currentManifest: any, previousManifest: any) {
  if (!currentManifest?.components || !previousManifest?.components) {
    return [];
  }
  return payloadComponentSpecs
    .map(({ label, key }) => {
      const current = componentDisplayValue(label, currentManifest.components[key]);
      if (!current) {
        return null;
      }
      const previous = componentDisplayValue(label, previousManifest.components[key]);
      if (!previous) {
        return `${label} added at ${current.value}`;
      }
      if (previous.value === current.value) {
        return null;
      }
      return `${label} ${previous.value} -> ${current.value}`;
    })
    .filter(Boolean);
}

function componentRefValue(label: string, component: any) {
  const value = componentDisplayValue(label, component);
  return value?.value ?? null;
}

function componentAuditRef(label: string, component: any) {
  const value = componentDisplayValue(label, component);
  if (!value) {
    return null;
  }
  return value.kind === 'git' ? `${label} @ ${value.value}` : `${label} ${value.value}`;
}

function componentSourcePath(currentComponent: any, previousComponent: any) {
  const sourcePath = currentComponent?.source_path || previousComponent?.source_path;
  return typeof sourcePath === 'string' && sourcePath.trim() ? sourcePath.trim() : null;
}

function collectComponentChangeSubjects(currentComponent: any, previousComponent: any) {
  const sourcePath = componentSourcePath(currentComponent, previousComponent);
  if (!sourcePath || !fs.existsSync(path.join(sourcePath, '.git'))) {
    return [];
  }
  const currentRef = typeof currentComponent?.git_commit === 'string' ? currentComponent.git_commit : null;
  const previousRef = typeof previousComponent?.git_commit === 'string' ? previousComponent.git_commit : null;
  if (!currentRef || !gitRefExists(currentRef, sourcePath)) {
    return [];
  }
  return collectCommitSubjects(sourcePath, previousRef, currentRef, 12).slice(0, 6);
}

function humanizeCommitSubject(subject: string) {
  return subject
    .replace(/\s+\(#\d+\)\s*$/, '')
    .replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/i, '')
    .replace(/\bMAS\b/g, 'MAS')
    .replace(/\bMAG\b/g, 'MAG')
    .replace(/\bRCA\b/g, 'RCA')
    .replace(/\bOMA\b/g, 'OPL Meta Agent')
    .replace(/\bOPL\b/g, 'OPL')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function fallbackChangeSummaryHint(label: string, subjects: string[]) {
  const detail = subjects
    .map(humanizeCommitSubject)
    .filter(Boolean)
    .slice(0, 2)
    .join('; ');
  if (!detail) {
    return null;
  }
  return `${label} change detail to cover in user terms: ${detail}.`;
}

function buildChangeSummaryHint(label: string, subjects: string[]) {
  const text = subjects.join(' ');
  if (!text.trim()) {
    return null;
  }
  if (label === 'MAS') {
    if (/(currentness|closeout|handoff|route[- ]back|blocker|redrive|paper)/i.test(text)) {
      return 'Research workflows carry clearer currentness, blocker, route-back, and closeout handoff context before users rely on study or paper outputs.';
    }
  }
  if (label === 'MAG') {
    if (/(progress[- ]first|owner payload|grant|funding|generated interface|replacement boundary)/i.test(text)) {
      return 'Grant workflows expose progress-first owner payloads and generated-interface boundaries so funding work has clearer next-step context.';
    }
  }
  if (label === 'RCA') {
    if (/(currentness|operator evidence|provider|visual|slide|deliverable|wrapper)/i.test(text)) {
      return 'Visual deliverable workflows record provider currentness and operator evidence before users rely on generated slides or graphics.';
    }
  }
  if (label === 'OPL Meta Agent') {
    if (/(work[- ]order|currentness|progress[- ]first|install path|foundry|agent)/i.test(text)) {
      return 'Agent design and testing workflows carry clearer work-order currentness and progress-first gates.';
    }
  }
  if (label === 'OPL Framework') {
    if (/(runtime|progress[- ]first|provider|state|action|receipt|liveness|supervision)/i.test(text)) {
      return 'The shared runtime better surfaces progress-first supervision, provider liveness, and runtime state/action behavior.';
    }
  }
  return fallbackChangeSummaryHint(label, subjects);
}

function buildAgentRuntimeChanges(currentManifest: any, previousManifest: any): AgentRuntimeChange[] {
  if (!currentManifest?.components || typeof currentManifest.components !== 'object') {
    return [];
  }
  const previousComponents = previousManifest?.components && typeof previousManifest.components === 'object'
    ? previousManifest.components
    : {};
  return payloadComponentSpecs
    .map(({ label, key, role, user_value_hint }) => {
      const currentComponent = currentManifest.components[key];
      if (!currentComponent || typeof currentComponent !== 'object') {
        return null;
      }
      const previousComponent = previousComponents[key];
      const currentRef = componentRefValue(label, currentComponent);
      if (!currentRef) {
        return null;
      }
      const previousRef = componentRefValue(label, previousComponent);
      const changeSubjects = collectComponentChangeSubjects(currentComponent, previousComponent);
      return {
        label,
        component: key,
        role,
        previous_ref: previousRef,
        current_ref: currentRef,
        audit_ref: componentAuditRef(label, currentComponent),
        change_subjects: changeSubjects,
        user_value_hint,
        change_summary_hint: buildChangeSummaryHint(label, changeSubjects),
      };
    })
    .filter((change): change is AgentRuntimeChange => Boolean(change));
}

function readRemoteFullPackageManifest(repo: string, tag: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-manifest-'));
  try {
    const result = spawnSync('gh', ['release', 'download', tag, '--repo', repo, '--pattern', 'full-package-manifest.json', '--dir', tempRoot], {
      encoding: 'utf8',
      stdio: 'pipe',
      env: process.env,
    });
    if (result.status !== 0) {
      return null;
    }
    const manifestPath = path.join(tempRoot, 'full-package-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function ensureAgentBucket(buckets: ChangeBucket[]) {
  let agentBucket = buckets.find((bucket) => bucket.title === bucketTitles.agents);
  if (!agentBucket) {
    agentBucket = { title: bucketTitles.agents, bullets: [] };
    const agentIndex = bucketOrder.indexOf('agents');
    const insertAt = Math.min(agentIndex, buckets.length);
    buckets.splice(insertAt, 0, agentBucket);
  }
  return agentBucket;
}

function appendAgentChangeSummary(buckets: ChangeBucket[], includeFullPackage: boolean) {
  const agentBucket = ensureAgentBucket(buckets);
  addUnique(
    agentBucket.bullets,
    includeFullPackage
      ? 'Shipped the App with the current MAS research workflow, MAG grant workflow, RCA visual-deliverable workflow, OPL Meta Agent, Framework runtime, and companion tools captured at build time.'
      : 'Kept the standard App package aligned with MAS, MAG, RCA, and OPL Meta Agent entry points plus the Codex plugin and skill sync surface.',
  );
}

function buildOplPayloadLines(options: ReleaseNoteOptions, bundledVersions: string[], payloadUpdates: string[]) {
  if (bundledVersions.length > 0) {
    const lines = [
      `- ${buildFullPayloadDescription(bundledVersions)}`,
      `- Build-time payload refs: ${bundledVersions.join('; ')}.`,
    ];
    if (payloadUpdates.length > 0) {
      lines.push(`- Payload updates since previous Stable: ${payloadUpdates.join('; ')}.`);
    }
    return lines;
  }
  if (options.channel === 'nightly') {
    return [
      '- Standard macOS arm64 Nightly package and updater metadata only; Full clean-install assets stay out of the Nightly channel.',
      '- Nightly standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin/skill sync policy.',
      '- Full runtime payloads for MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, and MinerU stay out of the Nightly channel and remain Stable/Full-release material.',
    ];
  }
  return [
    '- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin/skill sync policy.',
    '- Domain runtime payload versions are published only when the release also includes the Full clean-install DMG manifest.',
  ];
}

export function buildReleaseNotesEvidence(options: ReleaseNoteOptions): ReleaseNotesEvidence {
  const currentTag = normalizeTag(options.currentTag || options.version);
  const previousTag = resolvePreviousTag(options, currentTag);
  const releaseRepo = options.releaseRepo || 'gaofeng21cn/one-person-lab-app';
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
  const previousFullPackageManifest = options.previousFullPackageManifest
    || (options.channel === 'stable' && options.includeFullPackage && previousTag
      ? readRemoteFullPackageManifest(releaseRepo, previousTag)
      : null);
  const payloadUpdates = options.includeFullPackage
    ? buildPayloadUpdateLines(options.fullPackageManifest, previousFullPackageManifest)
    : [];
  const agentRuntimeChanges = options.includeFullPackage
    ? buildAgentRuntimeChanges(options.fullPackageManifest, previousFullPackageManifest)
    : [];
  appendAgentChangeSummary(buckets, Boolean(options.includeFullPackage));
  const oplPayloadLines = buildOplPayloadLines(options, bundledVersions, payloadUpdates);
  const releaseScope = options.channel === 'nightly'
    ? 'Standard macOS arm64 Nightly package and updater metadata; no Full clean-install DMG in the Nightly channel.'
    : options.includeFullPackage
      ? 'Standard macOS arm64 updater package plus Full clean-install DMG.'
      : 'Standard macOS arm64 updater package is published for this release.';
  return {
    schema: 'opl_app_release_notes_evidence.v1',
    version: options.version,
    channel: options.channel,
    release_repo: releaseRepo,
    current_tag: currentTag,
    previous_tag: previousTag,
    app_commit_subjects: appSubjects,
    shell_commit_subjects: shellSubjects,
    grouped_changes: buckets,
    payload: {
      include_full_package: Boolean(options.includeFullPackage),
      lines: oplPayloadLines,
      bundled_refs: bundledVersions,
      updates_since_previous_stable: payloadUpdates,
    },
    agent_runtime_changes: agentRuntimeChanges,
    release_scope: releaseScope,
    full_changelog_url: previousTag ? `https://github.com/${releaseRepo}/compare/${previousTag}...${currentTag}` : null,
  };
}

export function buildReleaseNotesDocument(options: ReleaseNoteOptions) {
  const evidence = buildReleaseNotesEvidence(options);
  const title = `One Person Lab ${options.version}`;
  const lines = [
    title,
    '',
    options.channel === 'nightly'
      ? `This Nightly prerelease focuses on changes since ${evidence.previous_tag || 'the previous Nightly'}.`
      : `This Stable release focuses on changes since ${evidence.previous_tag || 'the previous Stable'}.`,
    '',
    '## OPL agents and runtime payload',
    ...evidence.payload.lines,
    '',
    '## What changed',
  ];

  if (evidence.grouped_changes.length === 0) {
    lines.push('- Rebuilt and revalidated the release artifacts without additional user-visible changes.');
  } else {
    for (const bucket of evidence.grouped_changes) {
      lines.push('', `### ${bucket.title}`, ...bucket.bullets.map((bullet) => `- ${bullet}`));
    }
  }

  lines.push('', '## Release scope');
  lines.push(`- ${evidence.release_scope}`);
  if (evidence.full_changelog_url) {
    lines.push('', `**Full Changelog**: ${evidence.full_changelog_url}`);
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
