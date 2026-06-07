import { familyRepoChangeBullet } from './family-repos.ts';
import type { ReleaseNotesEvidence } from './types.ts';

function openingUserBenefit(evidence: ReleaseNotesEvidence) {
  if (evidence.channel === 'nightly') {
    return 'This Nightly prerelease lets users try the current standard App shell with MAS research, MAG grant-writing, RCA visual-deliverable, and OPL Meta Agent entry updates while Full first-install payloads stay on the Stable channel.';
  }
  if (evidence.payload.include_full_package) {
    return 'This Stable release makes a new or upgraded OPL App install useful sooner by carrying MAS research, MAG grant-writing, RCA visual-deliverable, OPL Meta Agent, document extraction, Office, and runtime payload evidence from the same release cohort.';
  }
  return 'This Stable release helps users upgrade One Person Lab App with MAS research, MAG grant-writing, RCA visual-deliverable, and OPL Meta Agent entries aligned with the current App runtime surface.';
}

export function renderReleaseNotesDocument(evidence: ReleaseNotesEvidence) {
  const lines = [
    evidence.release_title,
    '',
    openingUserBenefit(evidence),
    '',
    '## What improved',
  ];

  if (evidence.grouped_changes.length === 0) {
    lines.push('- Rebuilt and revalidated the App install and agent entry surfaces without additional user-visible changes.');
  } else {
    for (const bucket of evidence.grouped_changes) {
      lines.push('', `### ${bucket.title}`, ...bucket.bullets.map((bullet) => `- ${bullet}`));
    }
  }

  lines.push('', '## OPL agents and runtime payload', ...evidence.payload.lines);

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

  lines.push('', '## Release scope');
  lines.push(`- ${evidence.release_scope}`);
  if (evidence.full_changelog_url) {
    lines.push('', `**Full Changelog**: ${evidence.full_changelog_url}`);
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
