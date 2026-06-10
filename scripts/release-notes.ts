import { collectCommitSubjects, gitRefExists } from './release-notes/command.ts';
import { appendAgentChangeSummary, normalizedSubject, summarizeChanges } from './release-notes/changes.ts';
import {
  buildAppAndShellRepoChanges,
  buildDefaultFamilyRepoWindowChanges,
  buildFamilyRepoChanges,
  mergeFamilyRepoChanges,
} from './release-notes/family-repos.ts';
import {
  buildAgentRuntimeChanges,
  buildBundledVersionLines,
  buildOplPayloadLines,
  buildPayloadUpdateLines,
  collectComponentChangeSubjects,
} from './release-notes/payload.ts';
import { readRemoteFullPackageManifest } from './release-notes/remote-manifest.ts';
import {
  buildReleaseTitle,
  normalizeTag,
  resolvePreviousShellRef,
  resolvePreviousTag,
  resolveShellRef,
} from './release-notes/tags.ts';
import { renderReleaseNotesDocument } from './release-notes/document.ts';
import type { ReleaseNoteOptions, ReleaseNotesEvidence } from './release-notes/types.ts';

export type {
  ReleaseNoteOptions,
  ReleaseNotesEvidence,
} from './release-notes/types.ts';

export { buildReleaseTitle } from './release-notes/tags.ts';

const stableInstallCommand = 'curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install-stable.sh | bash';

const releaseNotesAgentRuntimeEvidenceBoundary = {
  collectComponentChangeSubjects,
  roles: [
    'research automation and study workflow agent',
    'grant-writing and funding workflow agent',
    'visual deliverable, slide, and report graphics agent',
  ],
} as const;

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
  const familyRepoChanges = mergeFamilyRepoChanges([
    ...buildAppAndShellRepoChanges({
      releaseRepo,
      previousTag,
      currentTag,
      appSubjects,
      shellSubjects,
      shellPreviousRef,
      shellCurrentRef,
    }),
    ...(options.includeFullPackage
      ? buildFamilyRepoChanges(options.fullPackageManifest, previousFullPackageManifest)
      : []),
    ...buildDefaultFamilyRepoWindowChanges(options, previousTag),
  ]);
  appendAgentChangeSummary(buckets, Boolean(options.includeFullPackage));
  const oplPayloadLines = buildOplPayloadLines(options, bundledVersions, payloadUpdates);
  const releaseScope = options.channel === 'nightly'
    ? 'Standard macOS arm64 Nightly package and updater metadata; no Full first-install DMG in the Nightly channel.'
    : options.includeFullPackage
      ? 'Standard macOS arm64 updater package plus Full first-install DMG.'
      : 'Standard macOS arm64 updater package is published for this release.';
  return {
    schema: 'opl_app_release_notes_evidence.v1',
    version: options.version,
    channel: options.channel,
    release_title: buildReleaseTitle(options.version),
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
    family_repo_changes: familyRepoChanges,
    release_scope: releaseScope,
    install_command: options.channel === 'stable' ? stableInstallCommand : null,
    full_changelog_url: previousTag ? `https://github.com/${releaseRepo}/compare/${previousTag}...${currentTag}` : null,
  };
}

export function buildReleaseNotesDocument(options: ReleaseNoteOptions) {
  return renderReleaseNotesDocument(buildReleaseNotesEvidence(options));
}
