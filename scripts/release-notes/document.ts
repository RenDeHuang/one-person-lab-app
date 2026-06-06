import { familyRepoChangeBullet } from './family-repos.ts';
import type { ReleaseNotesEvidence } from './types.ts';

export function renderReleaseNotesDocument(evidence: ReleaseNotesEvidence) {
  const lines = [
    evidence.release_title,
    '',
    evidence.channel === 'nightly'
      ? `This Nightly prerelease focuses on changes since ${evidence.previous_tag || 'the previous Nightly'}.`
      : `This Stable release focuses on changes since ${evidence.previous_tag || 'the previous Stable'}.`,
    '',
    '## OPL agents and runtime payload',
    ...evidence.payload.lines,
  ];

  if (evidence.family_repo_changes.length > 0) {
    lines.push(
      '',
      '## OPL family updates',
      ...evidence.family_repo_changes.map(familyRepoChangeBullet),
    );
  }

  if (evidence.install_command) {
    lines.push(
      '',
      '## Install Stable',
      `\`${evidence.install_command}\``,
      '',
      'This installer downloads the Stable macOS package, copies One Person Lab.app into /Applications, removes local quarantine markers, and opens the App.',
    );
  }

  lines.push('', '## What changed');

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
