import { familyRepoChangeBullet } from './family-repos.ts';
import type { ReleaseNotesEvidence } from './types.ts';

function openingUserBenefit(evidence: ReleaseNotesEvidence) {
  if (evidence.channel === 'nightly') {
    return 'This Nightly prerelease is for users who want to try the current standard App shell before the next Stable release. Full first-install assets stay on the Stable channel.';
  }
  if (evidence.payload.include_full_package) {
    return 'This Stable release is for users installing or upgrading One Person Lab App. It focuses on making research, grant-writing, visual-deliverable, agent-design, Office, and document-intake work ready from one App install.';
  }
  return 'This Stable release is for users upgrading the standard One Person Lab App package. It focuses on keeping the built-in research, grant-writing, visual-deliverable, and agent-design entries ready to start.';
}

function bucketTitles(evidence: ReleaseNotesEvidence) {
  return new Set(evidence.grouped_changes.map((bucket) => bucket.title));
}

function buildHighlightBullets(evidence: ReleaseNotesEvidence) {
  const titles = bucketTitles(evidence);
  const highlights: string[] = [];

  if (evidence.channel === 'nightly') {
    highlights.push('Try the current standard App shell and updater metadata without switching Full first-install users away from Stable.');
  } else if (evidence.payload.include_full_package) {
    highlights.push('Use one Stable install path for the App plus refreshed research, grant, visual, Office, and document-intake tools.');
  } else {
    highlights.push('Upgrade the standard App package while keeping the built-in OPL session entries aligned.');
  }

  if (titles.has('First launch and setup')) {
    highlights.push('First launch and setup guidance is easier to scan before starting built-in OPL sessions.');
  }
  if (titles.has('Built-in research, grant, and visual work')) {
    highlights.push('Built-in research, grant-writing, visual deliverable, and agent-design entries have been refreshed for this release.');
  }
  if (titles.has('App readiness and settings')) {
    highlights.push('App and provider readiness are easier to check before starting work.');
  }
  if (evidence.payload.updates_since_previous_stable.length > 0) {
    highlights.push('Full-package component changes since the previous Stable are recorded in the technical details below.');
  }

  return [...new Set(highlights)].slice(0, 4);
}

function compatibilityBullets(evidence: ReleaseNotesEvidence) {
  if (evidence.channel === 'nightly') {
    return [
      'Nightly builds are for trying the standard App package before Stable.',
      'Use the Stable channel when you need the Full first-install package.',
    ];
  }
  if (evidence.payload.include_full_package) {
    return [
      'No manual migration is required beyond installing or upgrading this Stable release.',
      'Use the Full first-install package for a fresh machine that needs the bundled OPL family tools.',
    ];
  }
  return [
    'No manual migration is required beyond installing or upgrading this Stable release.',
    'Use a Full release when you need bundled runtime, Office, and document-intake payloads on a fresh machine.',
  ];
}

function roleBasedPayloadBullets(evidence: ReleaseNotesEvidence) {
  const selected = evidence.agent_runtime_changes
    .filter((change) => ['MAS', 'MAG', 'RCA', 'OPL Meta Agent', 'OfficeCLI', 'MinerU'].includes(change.label))
    .map((change) => `- ${change.label}: ${change.user_value_hint}`);
  return [...new Set(selected)];
}

export function renderReleaseNotesDocument(evidence: ReleaseNotesEvidence) {
  const lines = [
    openingUserBenefit(evidence),
    '',
    '## Highlights',
    ...buildHighlightBullets(evidence).map((bullet) => `- ${bullet}`),
    '',
    '## What improved',
  ];

  if (evidence.grouped_changes.length === 0) {
    lines.push('- Refreshed and checked the App install and built-in OPL session entry points without additional visible user changes.');
  } else {
    for (const bucket of evidence.grouped_changes) {
      lines.push('', `### ${bucket.title}`, ...bucket.bullets.map((bullet) => `- ${bullet}`));
    }
  }

  if (evidence.install_command) {
    lines.push(
      '',
      '## Install Stable',
      `\`${evidence.install_command}\``,
      '',
      'Use this command for a Stable macOS install or upgrade. It downloads the Stable package, copies One Person Lab.app into /Applications, removes local quarantine markers, and opens the App.',
    );
  }

  lines.push(
    '',
    '## Compatibility and action required',
    ...compatibilityBullets(evidence).map((bullet) => `- ${bullet}`),
    '',
    '## Technical details',
    'These details are included for operators who audit exactly what was packaged. They should not be needed for ordinary install or upgrade decisions.',
    '',
    '## OPL agents and runtime payload',
  );
  const roleBullets = roleBasedPayloadBullets(evidence);
  if (roleBullets.length > 0) {
    lines.push(...roleBullets);
  }
  lines.push(...evidence.payload.lines);

  if (evidence.family_repo_changes.length > 0) {
    lines.push(
      '',
      '## OPL family updates',
      ...evidence.family_repo_changes.map(familyRepoChangeBullet),
    );
  }

  lines.push('', '## Release scope');
  lines.push(`- ${evidence.release_scope}`);
  if (evidence.full_changelog_url) {
    lines.push('', `**Full Changelog**: ${evidence.full_changelog_url}`);
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
