import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs as parseNodeArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { ReleaseNotesEvidence } from './release-notes.ts';

type AiReleaseNotesOptions = {
  providerCommand?: string;
  model?: string;
};

type ReleaseNotesLocale = 'en-US' | 'zh-CN';
type ReleaseNotesProvider = 'auto' | 'openai_compatible' | 'codex';

const releaseNotesLocales: ReleaseNotesLocale[] = ['en-US', 'zh-CN'];
const defaultOpenAICompatibleModel = 'auto';
const defaultProviderTimeoutSeconds = 75;

const vaguePhrases = [
  'Strengthened package builds',
  'Updated the OPL App package with the current',
  'Refreshed user guidance',
  'Cleaned up tests',
  'Improved runtime and provider status visibility',
  'This Stable release focuses on changes since',
  'This Nightly prerelease focuses on changes since',
];

const processFirstPatterns = [
  /\brelease notes?\b/i,
  /\bCI\b/i,
  /\bworkflow\b/i,
  /\bworkflows\b/i,
  /\bcontract(?:s)?\b/i,
  /\bgate(?:d|s)?\b/i,
  /\bvalidation\b/i,
  /\bmachine-checkable\b/i,
  /\btelemetry\b/i,
];

const userWorkflowPattern = /\b(research|study|studies|grant|funding|visual deliverable|slides?|graphics?|document extraction|OCR|PDF|Office|first launch|first-run|clean install|new Full install|upgrade|ready to use|built-in OPL entries|agent surfaces|agent sessions?)\b/i;

const agentRolePatterns = [
  /\bMAS\b[\s\S]{0,160}\b(research|study|studies)\b/i,
  /\bMAG\b[\s\S]{0,160}\b(grant|funding)\b/i,
  /\bRCA\b[\s\S]{0,180}\b(visual[- ]deliverable|slides?|graphics?|report)\b/i,
];

const runtimeChangeDetailPatterns = [
  /\b(currentness|closeout|handoff|route[- ]back|blocker|redrive|paper)\b/i,
  /\b(progress[- ]first|owner payloads?|generated[- ]interface)\b/i,
  /\b(provider currentness|operator evidence)\b/i,
  /\b(work[- ]order|agent design|agent testing|Foundry)\b/i,
  /\b(runtime state|state\/action|provider liveness|supervision)\b/i,
];

const technicalDetailsHeadingPattern = /^## Technical details\b.*$/im;

const developerMemoTermPatterns = [
  ['refs', /\brefs?\b/i],
  ['SHA', /\bSHA(?:-[0-9]+)?\b/],
  ['cohort', /\bcohort\b/i],
  ['gate', /\bgate(?:d|s)?\b/i],
  ['workflow', /\bworkflows?\b/i],
  ['validation', /\bvalidation\b/i],
  ['release operator', /\brelease operator\b/i],
  ['owner receipt', /\bowner receipt\b/i],
  ['owner verdict', /\bowner verdict\b/i],
  ['release candidate', /\brelease candidate\b/i],
] as const;

function shellCommandArgs(command: string) {
  return ['-lc', command];
}

function defaultCodexCommand(model?: string) {
  const modelArgs = model ? ` --model ${JSON.stringify(model)}` : '';
  return `tmp="$(mktemp)"; codex exec --sandbox read-only --output-last-message "$tmp"${modelArgs} - >/dev/null && cat "$tmp"; status=$?; rm -f "$tmp"; exit "$status"`;
}

function selectedProvider(): ReleaseNotesProvider {
  const value = (process.env.OPL_RELEASE_NOTES_PROVIDER || '').trim().toLowerCase();
  if (!value && process.env.OPL_RELEASE_NOTES_AI_COMMAND) {
    return 'codex';
  }
  if (!value) {
    return 'auto';
  }
  if (!['auto', 'openai_compatible', 'codex'].includes(value)) {
    throw new Error(`Unsupported OPL_RELEASE_NOTES_PROVIDER: ${process.env.OPL_RELEASE_NOTES_PROVIDER}`);
  }
  return value as ReleaseNotesProvider;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listFromEnv(value: string | undefined, fallback: string[]) {
  const items = (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function providerTimeoutSeconds() {
  const value = Number.parseInt(process.env.OPL_RELEASE_NOTES_AI_TIMEOUT_SECONDS || '', 10);
  return Number.isFinite(value) && value > 0 ? value : defaultProviderTimeoutSeconds;
}

function redactSecret(value: string, secret: string) {
  return secret ? value.split(secret).join('[redacted]') : value;
}

function redactProviderOutput(value: string, token: string) {
  return redactSecret(value, token).slice(0, 1200);
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function compactArray<T>(values: T[] | undefined, limit: number) {
  return Array.isArray(values) ? values.slice(0, limit) : [];
}

function compactReleaseNotesEvidence(evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  return {
    schema: source.schema,
    version: source.version,
    channel: source.channel,
    release_title: source.release_title,
    release_repo: source.release_repo,
    current_tag: source.current_tag,
    previous_tag: source.previous_tag,
    install_command: source.install_command,
    full_changelog_url: source.full_changelog_url,
    grouped_changes: source.grouped_changes,
    payload: source.payload,
    agent_runtime_changes: compactArray(source.agent_runtime_changes, 12).map((change: any) => ({
      label: change.label,
      component: change.component,
      role: change.role,
      previous_ref: change.previous_ref,
      current_ref: change.current_ref,
      audit_ref: change.audit_ref,
      user_value_hint: change.user_value_hint,
      change_summary_hint: change.change_summary_hint,
      change_subjects: compactArray(change.change_subjects, 4),
    })),
    family_repo_changes: compactArray(source.family_repo_changes, 12).map((change: any) => ({
      label: change.label,
      repository: change.repository,
      previous_ref: change.previous_ref,
      current_ref: change.current_ref,
      previous_version: change.previous_version,
      current_version: change.current_version,
      compare_url: change.compare_url,
      compare_status: change.compare_status,
      commit_count: change.commit_count,
      change_summary_hint: change.change_summary_hint,
      change_subjects: compactArray(change.change_subjects, 5),
    })),
    app_commit_subjects: compactArray(source.app_commit_subjects, 12),
    shell_commit_subjects: compactArray(source.shell_commit_subjects, 12),
  };
}

function extractLocalizedReleaseNotes(markdown: string, locale: ReleaseNotesLocale) {
  const escapedLocale = escapeRegExp(locale);
  const hiddenBlock = markdown.match(
    new RegExp(`<!--\\s*OPL_RELEASE_NOTES:${escapedLocale}\\s*\\n([\\s\\S]*?)\\n?-->`, 'i')
  );
  if (hiddenBlock?.[1]?.trim()) {
    return `${hiddenBlock[1].trimEnd()}\n`;
  }

  const visibleBlock = markdown.match(
    new RegExp(
      `<!--\\s*OPL_RELEASE_NOTES:${escapedLocale}\\s*-->\\s*([\\s\\S]*?)\\s*<!--\\s*/OPL_RELEASE_NOTES:${escapedLocale}\\s*-->`,
      'i'
    )
  );
  if (visibleBlock?.[1]?.trim()) {
    return `${visibleBlock[1].trimEnd()}\n`;
  }
  return '';
}

function stripLocalizedReleaseNotes(markdown: string) {
  return `${markdown
    .replace(/<!--\s*OPL_RELEASE_NOTES:[A-Za-z-]+\s*\n[\s\S]*?\n?-->\s*/g, '')
    .replace(/<!--\s*OPL_RELEASE_NOTES:[A-Za-z-]+\s*-->[\s\S]*?<!--\s*\/OPL_RELEASE_NOTES:[A-Za-z-]+\s*-->\s*/g, '')
    .replace(/<!--\s*OPL_RELEASE_NOTES:[A-Za-z-]+\s*-->\s*/g, '')
    .trimEnd()}\n`;
}

function technicalDetailsOffset(markdown: string) {
  const match = technicalDetailsHeadingPattern.exec(markdown);
  return match ? match.index : -1;
}

function publicMarkdownBeforeTechnicalDetails(markdown: string) {
  const offset = technicalDetailsOffset(markdown);
  return offset >= 0 ? markdown.slice(0, offset) : markdown;
}

function buildAiReleaseNotesPrompt(evidence: ReleaseNotesEvidence) {
  const promptEvidence = compactReleaseNotesEvidence(evidence);
  return [
    'Write the public GitHub Release notes for One Person Lab App.',
    '',
    'Use the compact JSON evidence below as the only source of truth.',
    'Subject lists are representative; commit counts, compare URLs, payload lines, refs, versions, and install commands are authoritative.',
    'Audience: normal OPL App users who want to know what improved and why they should upgrade.',
    '',
    'Hard requirements:',
    `- Start the visible public Markdown first line exactly with: ${evidence.release_title}`,
    '- The visible public Markdown must be English only.',
    '- Write natural, concrete, user-facing English. Do not sound like a commit classifier.',
    '- The visible first paragraph must explain what a user can do more easily after installing or upgrading. Do not lead with CI, workflows, contracts, release-note generation, or audit mechanics.',
    '- Put that visible first paragraph immediately after the title, before any "##" section heading.',
    '- The first visible screen must be for users, not maintainers: avoid refs, SHA, cohort, gate, workflow, validation, release operator, owner receipt, owner verdict, and release candidate wording before the final technical section.',
    '- Before "## Technical details", never use the words refs, SHA, cohort, gate, workflow, validation, release operator, owner receipt, owner verdict, or release candidate. Use user words such as sessions, work, entries, setup, install, or readiness instead.',
    '- If refs, SHAs, gates, validation details, owner-route terms, or other process evidence are necessary for auditability, put them only after a "## Technical details" heading or inside the hidden localization blocks.',
    '- Put the technical/audit tail after the user-facing narrative. The "## Technical details" heading is the boundary where maintainer evidence may begin.',
    '- Explain bundled OPL agent/runtime changes in plain language: MAS, MAG, RCA, OPL Meta Agent, OPL Framework, Codex CLI, OfficeCLI, MinerU, and Codex skills when present.',
    '- When release_evidence.family_repo_changes is non-empty, include a concise "## OPL family updates" section that summarizes actual changes per repository. Use commit subjects, commit counts, and compare links from that evidence. Do not collapse this into App-only wording.',
    '- When release_evidence.agent_runtime_changes is non-empty, use those entries to write concise role-based bullets. Say what MAS, MAG, RCA, OPL Meta Agent, Framework, Codex CLI, OfficeCLI, or MinerU help users do; do not list refs as the main improvement.',
    '- When an agent_runtime_changes entry has change_summary_hint or change_subjects, include the concrete change in user language. Do not stop at generic role descriptions such as "MAS helps research" or "RCA helps slides".',
    '- Stable compares with the previous Stable; Nightly compares with the previous Nightly.',
    '- Keep the required sections: "## What improved", "## OPL agents and runtime payload", and "## Release scope".',
    '- For Stable releases, include a section titled exactly "## Install Stable" before "## Release scope". In that section include release_evidence.install_command exactly in inline code.',
    '- For Nightly releases, do not include the Stable install command.',
    '- In "## What improved", start with user-facing agent tasks and runtime use cases before mentioning release plumbing.',
    '- In "## OPL agents and runtime payload", include role-based payload bullets first. Keep raw release_evidence.payload.lines entries that contain refs, SHAs, boundaries, gates, validation wording, or packaged component refs after "## Technical details".',
    '- Do not format release_evidence.payload.lines as blockquotes. They must stay normal bullets.',
    '- Keep packaged component refs and payload deltas after "## Technical details". They are supporting evidence, not the headline. Include every release_evidence.payload.lines bullet exactly when provided.',
    '- Include the Full Changelog link when evidence.full_changelog_url is present.',
    '- Do not include Chinese text in the visible public Markdown.',
    '- Do not invent domain results, quality claims, benchmarks, or unsupported agent capabilities.',
    '- Avoid self-referential claims about release notes, AI generation, CI, contracts, validation, telemetry, or workflows unless tied directly to a concrete user install or agent-use benefit.',
    '- Avoid vague filler such as "strengthened validation", "refreshed docs", "improved status visibility", or plain version-change lists unless followed by concrete user impact.',
    '- After the visible English public Markdown, append two hidden machine-readable localization blocks exactly in this form:',
    '  <!-- OPL_RELEASE_NOTES:en-US',
    '  <English Markdown for the App update popup, matching the visible public note>',
    '  -->',
    '  <!-- OPL_RELEASE_NOTES:zh-CN',
    '  <Chinese Markdown for the App update popup, written for normal Chinese users and covering the same concrete improvements>',
    '  -->',
    '- Keep the zh-CN block inside the HTML comment block so the public GitHub Release page remains English-only.',
    '- The en-US block must not contain Chinese text. The zh-CN block must contain Chinese text and mention MAS, MAG, and RCA when the visible note does.',
    '- Output Markdown only. Do not wrap it in code fences.',
    '',
    'release_evidence:',
    JSON.stringify({ release_evidence: promptEvidence }, null, 2),
    '',
  ].join('\n');
}

function buildAiReleaseNotesRepairPrompt(evidence: ReleaseNotesEvidence, markdown: string, failure: unknown) {
  return [
    'Repair the One Person Lab App GitHub Release notes below.',
    '',
    'Use the compact JSON evidence as the only source of truth.',
    `Quality gate failure to fix: ${failure instanceof Error ? failure.message : String(failure)}`,
    '',
    'Return the full corrected Markdown only, with no code fences.',
    'Keep the same required hidden OPL_RELEASE_NOTES:en-US and OPL_RELEASE_NOTES:zh-CN blocks.',
    'Before "## Technical details", remove maintainer/process words such as refs, SHA, cohort, gate, workflow, validation, release operator, owner receipt, owner verdict, and release candidate.',
    'For Stable, keep "## Install Stable" and include the install command exactly.',
    'After "## Technical details", include all payload lines, packaged component refs, component updates, OPL family commit counts, and compare links from the evidence.',
    '',
    'release_evidence:',
    JSON.stringify({ release_evidence: compactReleaseNotesEvidence(evidence) }, null, 2),
    '',
    'draft_markdown:',
    markdown,
    '',
  ].join('\n');
}

function extractMarkdown(stdout: string) {
  const trimmed = stdout.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);
  return `${(fenced ? fenced[1] : trimmed).trimEnd()}\n`;
}

function buildFallbackZhCNReleaseNotes(visibleMarkdown: string, evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  const stableAction = source.channel === 'stable' && source.install_command
    ? `\n\n## 安装 Stable\n\n运行 \`${source.install_command}\``
    : '';
  return [
    source.release_title,
    '',
    '本次更新面向普通 One Person Lab App 用户，重点是让首次启动、App 就绪检查和内置 OPL 会话入口更清楚。',
    '',
    '## 改进内容',
    '',
    '- MAS 支持研究和 study 会话。',
    '- MAG 支持基金写作和资助材料会话。',
    '- RCA 支持可视化交付物、幻灯片和报告图形。',
    '- OPL Meta Agent 支持 agent 设计和改进。',
    stableAction,
    '',
    '## 发布范围',
    '',
    visibleMarkdown.includes('Full first-install')
      ? '标准 macOS arm64 更新包，以及 Full 首次安装 DMG。'
      : '标准 macOS arm64 更新包。',
  ].join('\n');
}

function localizedBlockHasReleaseTitle(markdown: string, evidence: ReleaseNotesEvidence) {
  return new RegExp(`^#?\\s*${escapeRegExp(evidence.release_title)}(?:\\s|$)`).test(markdown);
}

function restoreLocalizedBlocks(visibleMarkdown: string, originalMarkdown: string, evidence: ReleaseNotesEvidence) {
  const extractedEnUS = extractLocalizedReleaseNotes(originalMarkdown, 'en-US');
  const enUS = extractedEnUS && localizedBlockHasReleaseTitle(extractedEnUS, evidence)
    ? extractedEnUS
    : visibleMarkdown;
  let zhCN = extractLocalizedReleaseNotes(originalMarkdown, 'zh-CN');
  if (!zhCN || !localizedBlockHasReleaseTitle(zhCN, evidence)) {
    zhCN = buildFallbackZhCNReleaseNotes(visibleMarkdown, evidence);
  }
  if (/(MAS|MAG|RCA)/.test(visibleMarkdown) && !/(MAS|MAG|RCA)/.test(zhCN)) {
    zhCN = `${zhCN.trimEnd()}\n\n本次更新覆盖 MAS、MAG 和 RCA 的 App 入口与相关使用场景。\n`;
  }
  return `${visibleMarkdown.trimEnd()}

<!-- OPL_RELEASE_NOTES:en-US
${enUS.trimEnd()}
-->
<!-- OPL_RELEASE_NOTES:zh-CN
${zhCN.trimEnd()}
-->
`;
}

function sanitizePreTechnicalDeveloperTerms(visibleMarkdown: string) {
  const offset = technicalDetailsOffset(visibleMarkdown);
  if (offset < 0) {
    return visibleMarkdown
      .split('\n')
      .filter((line) => !/[\u3400-\u9fff]/.test(line))
      .join('\n')
      .replace(/\brelease notes?\b/gi, 'update summary')
      .replace(/\brelease-note\b/gi, 'update')
      .replace(/\bworkflows?\b/gi, 'sessions')
      .replace(/\bvalidation\b/gi, 'checks')
      .replace(/\bgates?\b/gi, 'checks')
      .replace(/\brefs?\b/gi, 'details')
      .replace(/\bSHA(?:-[0-9]+)?\b/g, 'version detail')
      .replace(/\bcohort\b/gi, 'release')
      .replace(/\brelease operator\b/gi, 'release process')
      .replace(/\bowner receipt\b/gi, 'approval record')
      .replace(/\bowner verdict\b/gi, 'approval decision')
      .replace(/\brelease candidate\b/gi, 'release build');
  }
  const before = visibleMarkdown.slice(0, offset)
    .split('\n')
    .filter((line) => !/[\u3400-\u9fff]/.test(line))
    .join('\n')
    .replace(/\brelease notes?\b/gi, 'update summary')
    .replace(/\brelease-note\b/gi, 'update')
    .replace(/\bworkflows?\b/gi, 'sessions')
    .replace(/\bvalidation\b/gi, 'checks')
    .replace(/\bgates?\b/gi, 'checks')
    .replace(/\brefs?\b/gi, 'details')
    .replace(/\bSHA(?:-[0-9]+)?\b/g, 'version detail')
    .replace(/\bcohort\b/gi, 'release')
    .replace(/\brelease operator\b/gi, 'release process')
    .replace(/\bowner receipt\b/gi, 'approval record')
    .replace(/\bowner verdict\b/gi, 'approval decision')
    .replace(/\brelease candidate\b/gi, 'release build');
  const after = visibleMarkdown.slice(offset)
    .split('\n')
    .filter((line) => !/[\u3400-\u9fff]/.test(line))
    .join('\n')
    .replace(/\brelease notes?\b/gi, 'update summary')
    .replace(/\brelease-note\b/gi, 'update');
  return `${before}${after}`;
}

function removePayloadEvidenceBeforeTechnical(visibleMarkdown: string, evidence: ReleaseNotesEvidence) {
  const offset = technicalDetailsOffset(visibleMarkdown);
  if (offset < 0) {
    return visibleMarkdown;
  }
  const source = evidence as any;
  const payloadRefs = compactArray(source.payload?.bundled_refs, 24);
  const payloadUpdates = compactArray(source.payload?.updates_since_previous_stable, 24);
  const before = visibleMarkdown
    .slice(0, offset)
    .split('\n')
    .filter((line) => !payloadRefs.some((ref: string) => line.includes(ref)))
    .filter((line) => !payloadUpdates.some((update: string) => line.includes(update)))
    .join('\n')
    .trimEnd();
  return `${before}\n\n${visibleMarkdown.slice(offset).trimStart()}`;
}

function appendSectionIfMissing(markdown: string, heading: string, section: string) {
  if (markdown.includes(heading)) {
    return markdown;
  }
  return `${markdown.trimEnd()}\n\n${section.trimEnd()}\n`;
}

function insertSectionBeforeTechnicalIfMissing(markdown: string, heading: string, section: string) {
  if (!section || markdown.includes(heading)) {
    return markdown;
  }
  const offset = technicalDetailsOffset(markdown);
  if (offset < 0) {
    return appendSectionIfMissing(markdown, heading, section);
  }
  const before = markdown.slice(0, offset).trimEnd();
  const after = markdown.slice(offset).trimStart();
  return `${before}\n\n${section.trimEnd()}\n\n${after}`;
}

function insertSectionBeforeHeadingIfMissing(markdown: string, heading: string, beforeHeading: string, section: string) {
  if (!section || markdown.includes(heading)) {
    return markdown;
  }
  const offset = markdown.indexOf(`\n${beforeHeading}`);
  if (offset < 0) {
    return insertSectionBeforeTechnicalIfMissing(markdown, heading, section);
  }
  const before = markdown.slice(0, offset).trimEnd();
  const after = markdown.slice(offset).trimStart();
  return `${before}\n\n${section.trimEnd()}\n\n${after}`;
}

function formatFamilyUpdate(change: any) {
  const subjects = compactArray(change.change_subjects, 3);
  const subjectText = subjects.length > 0 ? ` Highlights include ${subjects.join('; ')}.` : '';
  const summary = change.change_summary_hint || `${change.label} changed since the previous release.`;
  const count = Number.isFinite(change.commit_count) ? `${change.commit_count} commits. ` : '';
  const compare = change.compare_url ? ` [Compare changes](${change.compare_url})` : '';
  return `- ${change.label}: ${count}${summary}${subjectText}${compare}`;
}

function buildHighlightsSection(evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  const groupedBullets = compactArray(source.grouped_changes, 4)
    .flatMap((group: any) => compactArray(group.bullets, 1))
    .filter(Boolean);
  const fullPackage = source.payload?.include_full_package
    ? 'Full first-install users get the App plus bundled research, grant, visual, Office, and document-intake tools from one Stable package.'
    : 'Standard App users get refreshed built-in OPL entries for MAS, MAG, RCA, and OPL Meta Agent sessions.';
  const bullets = [
    fullPackage,
    ...groupedBullets,
  ].slice(0, 4);
  return [
    '## Highlights',
    '',
    ...bullets.map((bullet: string) => `- ${bullet}`),
  ].join('\n');
}

function buildWhatImprovedSection(evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  const bullets = compactArray(source.grouped_changes, 6)
    .flatMap((group: any) => compactArray(group.bullets, 2))
    .filter(Boolean);
  const fallback = [
    'Users can start OPL App sessions with clearer setup, readiness, and built-in agent entry points.',
  ];
  return [
    '## What improved',
    '',
    ...(bullets.length > 0 ? bullets : fallback).map((bullet: string) => `- ${bullet}`),
  ].join('\n');
}

function buildCompatibilitySection(evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  const bullets = source.channel === 'nightly'
    ? [
      'Nightly builds are for trying the standard App package before Stable.',
      'Use the Stable channel when you need the Full first-install package.',
    ]
    : source.payload?.include_full_package
      ? [
        'No manual migration is required beyond installing or upgrading this Stable release.',
        'Use the Full first-install package for a fresh machine that needs bundled OPL family tools.',
      ]
      : [
        'No manual migration is required beyond installing or upgrading this Stable release.',
        'Use a Full release when you need bundled runtime, Office, and document-intake payloads on a fresh machine.',
      ];
  return [
    '## Compatibility and action required',
    '',
    ...bullets.map((bullet: string) => `- ${bullet}`),
  ].join('\n');
}

function buildOpeningBenefitParagraph(evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  const installAction = source.channel === 'nightly' ? 'try the Nightly package' : 'install or upgrade One Person Lab App';
  return `Users can ${installAction} and open MAS research, MAG grant-writing, RCA visual deliverable, and OPL Meta Agent sessions with clearer setup and built-in OPL entries.`;
}

function ensureOpeningBenefitParagraph(markdown: string, evidence: ReleaseNotesEvidence) {
  const lines = markdown.trimEnd().split('\n');
  const titleIndex = lines.findIndex((line) => new RegExp(`^#?\\s*${escapeRegExp(evidence.release_title)}(?:\\s|$)`).test(line.trim()));
  if (titleIndex < 0) {
    return markdown;
  }
  const nextContentIndex = lines.findIndex((line, index) => index > titleIndex && line.trim());
  if (nextContentIndex < 0 || /^##\s+/.test(lines[nextContentIndex].trim())) {
    lines.splice(titleIndex + 1, 0, '', buildOpeningBenefitParagraph(evidence));
    return `${lines.join('\n').trimEnd()}\n`;
  }
  return markdown;
}

function ensureReleaseTitle(markdown: string, evidence: ReleaseNotesEvidence) {
  const titlePattern = new RegExp(`^#?\\s*${escapeRegExp(evidence.release_title)}(?:\\s|$)`);
  const trimmed = markdown.trimStart();
  if (titlePattern.test(trimmed)) {
    return markdown;
  }
  return `${evidence.release_title}${trimmed ? `\n\n${trimmed}` : '\n'}`;
}

function removeAiProcessPreamble(markdown: string, evidence: ReleaseNotesEvidence) {
  const title = escapeRegExp(evidence.release_title);
  const processPreamble = new RegExp(
    `^\\s*(?:I['’]m|I am)\\b[\\s\\S]{0,700}?${title}`,
    'i',
  );
  const processLine = /\b(?:I['’]m|I am)\b.*\b(?:evidence|update summary|release notes?|technical tail|sections?|requested|user-facing)\b/i;
  const titleLine = new RegExp(`^#?\\s*${title}(?:\\s|$)`);
  const normalized = markdown.replace(processPreamble, evidence.release_title);
  let sawTitle = false;
  return normalized
    .split('\n')
    .filter((line) => !processLine.test(line.trim()))
    .filter((line) => {
      if (!titleLine.test(line.trim())) {
        return true;
      }
      if (!sawTitle) {
        sawTitle = true;
        return true;
      }
      return false;
    })
    .join('\n');
}

function buildInstallSection(evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  if (source.channel !== 'stable' || !source.install_command) {
    return '';
  }
  return [
    '## Install Stable',
    '',
    `\`${source.install_command}\``,
  ].join('\n');
}

function buildPayloadSection(evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  const roleBullets = compactArray(source.agent_runtime_changes, 12)
    .map((change: any) => `- ${change.label}: ${change.user_value_hint || change.role || 'Supports App-managed OPL work.'}`);
  const bullets = roleBullets;
  return [
    '## OPL agents and runtime payload',
    '',
    ...(bullets.length > 0 ? bullets : [
      '- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.',
    ]),
  ].join('\n');
}

function buildFamilyUpdatesSection(evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  const changes = compactArray(source.family_repo_changes, 12);
  if (changes.length === 0) {
    return '';
  }
  return [
    '## OPL family updates',
    '',
    ...changes.map(formatFamilyUpdate),
  ].join('\n');
}

function buildReleaseScopeSection(evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  const scope = source.channel === 'nightly'
    ? 'Standard macOS arm64 Nightly package and updater metadata; no Full first-install DMG in the Nightly channel.'
    : source.payload?.include_full_package
      ? 'Standard macOS arm64 updater package plus Full first-install DMG.'
      : 'Standard macOS arm64 updater package.';
  return [
    '## Release scope',
    '',
    `- ${scope}`,
  ].join('\n');
}

function buildTechnicalDetailsSection(evidence: ReleaseNotesEvidence) {
  const source = evidence as any;
  const payloadLines = compactArray(source.payload?.lines, 12);
  const lines = [
    '## Technical details',
    '',
    'These details support release audit and package traceability; ordinary users should not need them for install or upgrade decisions.',
  ];
  if (payloadLines.length > 0) {
    lines.push('', ...payloadLines);
  }
  const familyUpdates = buildFamilyUpdatesSection(evidence);
  if (familyUpdates) {
    lines.push('', familyUpdates);
  }
  if (source.full_changelog_url) {
    lines.push('', `Full Changelog: ${source.full_changelog_url}`);
  }
  return lines.join('\n');
}

function completeAiReleaseNotesWithEvidence(markdown: string, evidence: ReleaseNotesEvidence) {
  let visible = stripLocalizedReleaseNotes(markdown).trimEnd();
  visible = sanitizePreTechnicalDeveloperTerms(visible);
  visible = removePayloadEvidenceBeforeTechnical(visible, evidence);
  visible = removeAiProcessPreamble(visible, evidence);
  visible = ensureReleaseTitle(visible, evidence);
  visible = ensureOpeningBenefitParagraph(visible, evidence);
  visible = insertSectionBeforeHeadingIfMissing(visible, '## Highlights', '## What improved', buildHighlightsSection(evidence));
  visible = insertSectionBeforeTechnicalIfMissing(visible, '## What improved', buildWhatImprovedSection(evidence));
  const installSection = buildInstallSection(evidence);
  if (installSection) {
    visible = insertSectionBeforeTechnicalIfMissing(visible, '## Install Stable', installSection);
  }
  visible = insertSectionBeforeTechnicalIfMissing(visible, '## OPL agents and runtime payload', buildPayloadSection(evidence));
  visible = insertSectionBeforeTechnicalIfMissing(visible, '## OPL family updates', buildFamilyUpdatesSection(evidence));
  visible = insertSectionBeforeTechnicalIfMissing(visible, '## Release scope', buildReleaseScopeSection(evidence));
  visible = insertSectionBeforeTechnicalIfMissing(visible, '## Compatibility and action required', buildCompatibilitySection(evidence));
  const technical = technicalDetailsOffset(visible);
  if (technical < 0) {
    visible = `${visible.trimEnd()}\n\n${buildTechnicalDetailsSection(evidence)}`;
  } else {
    const beforeTechnical = visible.slice(0, technical).trimEnd();
    const afterTechnical = visible.slice(technical).trimEnd();
    visible = `${beforeTechnical}\n\n${afterTechnical}`;
  }
  const source = evidence as any;
  for (const line of compactArray(source.payload?.lines, 12)) {
    if (!visible.includes(line)) {
      visible = `${visible.trimEnd()}\n${line}`;
    }
  }
  if (source.full_changelog_url && !visible.includes(source.full_changelog_url)) {
    visible = `${visible.trimEnd()}\n\nFull Changelog: ${source.full_changelog_url}`;
  }
  return restoreLocalizedBlocks(visible, markdown, evidence);
}

function parseChatCompletionsContent(stdout: string, providerLabel: string, token: string) {
  let payload: any;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error(`${providerLabel} returned invalid JSON: ${redactProviderOutput(stdout, token).slice(0, 400)}`);
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`${providerLabel} response did not include choices[0].message.content.`);
  }
  return content;
}

function buildChatCompletionsRequest(model: string, prompt: string) {
  return JSON.stringify({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });
}

function requestChatCompletions(endpoint: string, token: string, model: string, prompt: string, providerLabel: string) {
  const request = buildChatCompletionsRequest(model, prompt);
  const timeoutSeconds = providerTimeoutSeconds();
  const result = spawnSync('curl', [
    '-fsSL',
    '--connect-timeout',
    '10',
    '--max-time',
    String(timeoutSeconds),
    endpoint,
    '-H',
    'Accept: application/json',
    '-H',
    'Content-Type: application/json',
    '-H',
    `Authorization: Bearer ${token}`,
    '-d',
    request,
  ], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
    timeout: (timeoutSeconds + 5) * 1000,
  });
  if (result.error) {
    throw new Error(`${providerLabel} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || `exit ${result.status}`;
    throw new Error(`${providerLabel} failed: ${redactProviderOutput(detail, token)}`);
  }
  return extractMarkdown(parseChatCompletionsContent(result.stdout, providerLabel, token));
}

function validateOrRepairGeneratedMarkdown(
  initialPrompt: string,
  evidence: ReleaseNotesEvidence,
  requestMarkdown: (prompt: string) => string,
) {
  let markdown = completeAiReleaseNotesWithEvidence(requestMarkdown(initialPrompt), evidence);
  try {
    validateAiReleaseNotes(markdown, evidence);
    return markdown;
  } catch (error) {
    const repairPrompt = buildAiReleaseNotesRepairPrompt(evidence, markdown, error);
    markdown = completeAiReleaseNotesWithEvidence(requestMarkdown(repairPrompt), evidence);
    validateAiReleaseNotes(markdown, evidence);
    return markdown;
  }
}

function openAICompatibleEndpoint(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed;
  }
  if (/\/v1$/i.test(trimmed)) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

function openAICompatibleConfig() {
  const baseUrl = envValue(
    'OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL',
    'OPL_RELEASE_NOTES_CODEX_BASE_URL',
  );
  const token = envValue(
    'OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY',
    'OPL_RELEASE_NOTES_CODEX_API_KEY',
  );
  const modelList = envValue(
    'OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODELS',
    'OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL',
    'OPL_RELEASE_NOTES_MODEL',
  );
  return {
    endpoint: openAICompatibleEndpoint(baseUrl),
    token,
    models: listFromEnv(modelList, [defaultOpenAICompatibleModel]),
  };
}

function openAICompatibleConfigured() {
  const config = openAICompatibleConfig();
  return Boolean(config.endpoint && config.token);
}

function runOpenAICompatibleProvider(prompt: string, evidence: ReleaseNotesEvidence) {
  const { endpoint, token, models } = openAICompatibleConfig();
  if (!endpoint || !token) {
    throw new Error('Missing OpenAI-compatible release-note provider config. Set OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL and OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY, or the existing OPL_RELEASE_NOTES_CODEX_BASE_URL and OPL_RELEASE_NOTES_CODEX_API_KEY route.');
  }
  const failures: string[] = [];
  for (const model of models) {
    const providerLabel = `OpenAI-compatible ${model}`;
    try {
      return validateOrRepairGeneratedMarkdown(prompt, evidence, (activePrompt) => (
        requestChatCompletions(endpoint, token, model, activePrompt, providerLabel)
      ));
    } catch (error) {
      failures.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`OpenAI-compatible provider failed for ${models.join(', ')}: ${failures.join(' | ')}`);
}

function runOpenAICompatibleProbe() {
  const { endpoint, token, models } = openAICompatibleConfig();
  if (!endpoint || !token) {
    throw new Error('Missing OpenAI-compatible release-note provider config. Set OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL and OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY, or the existing OPL_RELEASE_NOTES_CODEX_BASE_URL and OPL_RELEASE_NOTES_CODEX_API_KEY route.');
  }
  const failures: string[] = [];
  for (const model of models) {
    const providerLabel = `OpenAI-compatible ${model}`;
    try {
      const content = requestChatCompletions(
        endpoint,
        token,
        model,
        'Return exactly: OPL_RELEASE_NOTES_PROVIDER_OK',
        providerLabel,
      );
      if (!/OPL_RELEASE_NOTES_PROVIDER_OK/.test(content)) {
        throw new Error(`${providerLabel} probe returned unexpected content.`);
      }
      console.log(JSON.stringify({
        status: 'ok',
        provider: 'openai_compatible',
        model,
        endpoint: endpoint.replace(/^https?:\/\//, '').replace(/\/v1\/chat\/completions$/, ''),
      }, null, 2));
      return;
    } catch (error) {
      failures.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`OpenAI-compatible provider probe failed for ${models.join(', ')}: ${failures.join(' | ')}`);
}

function runCodexProvider(prompt: string, evidence: ReleaseNotesEvidence, command: string) {
  const result = spawnSync('/bin/bash', shellCommandArgs(command), {
    encoding: 'utf8',
    input: prompt,
    stdio: 'pipe',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Codex release notes provider failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  const markdown = completeAiReleaseNotesWithEvidence(extractMarkdown(result.stdout), evidence);
  validateAiReleaseNotes(markdown, evidence);
  return markdown;
}

function validateEnglishReleaseNotesMarkdown(markdown: string, evidence: ReleaseNotesEvidence) {
  const failures: string[] = [];
  const firstParagraph = markdown
    .split(/\n\s*\n/)
    .find((block) => !/^#?\s*One Person Lab\b/i.test(block.trim()))
    ?.trim() || '';
  if (/[\u3400-\u9fff]/.test(markdown)) {
    failures.push('contains Chinese text');
  }
  if (!new RegExp(`^#?\\s*${escapeRegExp(evidence.release_title)}(?:\\s|$)`).test(markdown)) {
    failures.push('missing release title');
  }
  for (const required of ['## Highlights', '## What improved', '## Compatibility and action required', '## OPL agents and runtime payload', '## Release scope']) {
    if (!markdown.includes(required)) {
      failures.push(`missing ${required}`);
    }
  }
  if (evidence.channel === 'nightly' && !/Nightly standard package.*MAS, MAG, RCA, and OPL Meta Agent.*Codex plugin.*skill sync policy/i.test(markdown)) {
    failures.push('missing Nightly agent entry surface');
  }
  if (evidence.channel === 'stable') {
    if (!markdown.includes('## Install Stable')) {
      failures.push('missing Stable install section');
    }
    if (!evidence.install_command || !markdown.includes(evidence.install_command)) {
      failures.push('missing Stable install command');
    }
  }
  if (evidence.channel === 'nightly' && evidence.install_command && markdown.includes(evidence.install_command)) {
    failures.push('Nightly release notes include Stable install command');
  }
  if (evidence.payload.include_full_package && !/(?:Build-time payload refs|Packaged component refs):/.test(markdown)) {
    failures.push('missing Full payload refs');
  }
  if (evidence.payload.include_full_package && evidence.payload.updates_since_previous_stable.length > 0 && !/(?:Payload|Component) updates since previous Stable:/.test(markdown)) {
    failures.push('missing Full payload update summary');
  }
  const technicalOffset = technicalDetailsOffset(markdown);
  for (const ref of evidence.payload.bundled_refs) {
    if (!markdown.includes(ref)) {
      failures.push(`missing payload ref: ${ref}`);
    } else if (evidence.payload.include_full_package && technicalOffset < 0) {
      failures.push('payload refs missing Technical details section');
    } else if (evidence.payload.include_full_package && markdown.indexOf(ref) < technicalOffset) {
      failures.push(`payload ref before Technical details: ${ref}`);
    }
  }
  const payloadUpdatesOffset = Math.max(
    markdown.indexOf('Payload updates since previous Stable:'),
    markdown.indexOf('Component updates since previous Stable:'),
  );
  if (payloadUpdatesOffset >= 0 && technicalOffset >= 0 && payloadUpdatesOffset < technicalOffset) {
    failures.push('payload update summary before Technical details');
  }
  if (evidence.family_repo_changes?.length > 0) {
    if (!markdown.includes('## OPL family updates')) {
      failures.push('missing OPL family updates section');
    }
    for (const change of evidence.family_repo_changes) {
      if (!markdown.includes(change.label)) {
        failures.push(`missing OPL family repo change: ${change.label}`);
      }
    }
  }
  if (evidence.full_changelog_url && !markdown.includes(evidence.full_changelog_url)) {
    failures.push('missing Full Changelog link');
  }
  const vagueMatches = vaguePhrases.filter((phrase) => markdown.includes(phrase));
  if (vagueMatches.length > 0) {
    failures.push(`vague boilerplate: ${vagueMatches.join(', ')}`);
  }
  const userFacingMarkdown = publicMarkdownBeforeTechnicalDetails(markdown);
  if (/\brelease notes?\b/i.test(userFacingMarkdown) || /\brelease-note\b/i.test(userFacingMarkdown)) {
    failures.push('self-referential release-note copy');
  }
  if (/^##\s+/m.test(firstParagraph)) {
    failures.push('missing opening user benefit paragraph before sections');
  }
  if (/^>\s*-\s+/m.test(markdown)) {
    failures.push('payload lines formatted as blockquotes');
  }
  if (processFirstPatterns.some((pattern) => pattern.test(firstParagraph)) && !userWorkflowPattern.test(firstParagraph)) {
    failures.push('opening paragraph is process-first');
  }
  const preTechnicalMarkdown = publicMarkdownBeforeTechnicalDetails(markdown);
  const developerMemoTerms = developerMemoTermPatterns
    .filter(([, pattern]) => pattern.test(preTechnicalMarkdown))
    .map(([label]) => label);
  if (developerMemoTerms.length > 0) {
    failures.push(`developer memo terms before Technical details: ${developerMemoTerms.join(', ')}`);
  }
  if (!userWorkflowPattern.test(markdown)) {
    failures.push('missing concrete user impact');
  }
  if (!/(MAS|MAG|RCA)/.test(markdown)) {
    failures.push('missing OPL agent names');
  }
  if (evidence.agent_runtime_changes?.length > 0) {
    const changedLabels = new Set(evidence.agent_runtime_changes.map((change) => change.label));
    for (const label of ['MAS', 'MAG', 'RCA']) {
      if (changedLabels.has(label) && !new RegExp(`\\b${label}\\b`).test(markdown)) {
        failures.push(`missing changed agent: ${label}`);
      }
    }
    const roleFailures = agentRolePatterns
      .filter((pattern) => !pattern.test(markdown))
      .map((pattern) => String(pattern));
    if (['MAS', 'MAG', 'RCA'].every((label) => changedLabels.has(label)) && roleFailures.length > 0) {
      failures.push('missing user-facing MAS/MAG/RCA role descriptions');
    }
    const hasConcreteHints = evidence.agent_runtime_changes.some((change: any) => Boolean(change.change_summary_hint) || change.change_subjects?.length > 0);
    if (hasConcreteHints && !runtimeChangeDetailPatterns.some((pattern) => pattern.test(markdown))) {
      failures.push('missing concrete runtime change detail');
    }
  }
  if (failures.length > 0) {
    throw new Error(`AI release notes failed quality gate: ${failures.join('; ')}`);
  }
}

function validateLocalizedReleaseNotes(markdown: string, evidence: ReleaseNotesEvidence) {
  const failures: string[] = [];
  for (const locale of releaseNotesLocales) {
    const localized = extractLocalizedReleaseNotes(markdown, locale);
    if (!localized) {
      failures.push(`missing localized ${locale} block`);
      continue;
    }
    if (!new RegExp(`^#?\\s*${escapeRegExp(evidence.release_title)}(?:\\s|$)`).test(localized)) {
      failures.push(`localized ${locale} block missing release title`);
    }
    if (locale === 'en-US' && /[\u3400-\u9fff]/.test(localized)) {
      failures.push('localized en-US block contains Chinese text');
    }
    if (locale === 'zh-CN' && !/[\u3400-\u9fff]/.test(localized)) {
      failures.push('localized zh-CN block does not contain Chinese text');
    }
    if (locale === 'zh-CN' && /(MAS|MAG|RCA)/.test(stripLocalizedReleaseNotes(markdown)) && !/(MAS|MAG|RCA)/.test(localized)) {
      failures.push('localized zh-CN block missing OPL agent names');
    }
  }
  if (failures.length > 0) {
    throw new Error(`AI release notes failed localization gate: ${failures.join('; ')}`);
  }
}

export function validateAiReleaseNotes(markdown: string, evidence: ReleaseNotesEvidence) {
  validateEnglishReleaseNotesMarkdown(stripLocalizedReleaseNotes(markdown), evidence);
  validateLocalizedReleaseNotes(markdown, evidence);
}

export function buildAiReleaseNotesDocument(evidence: ReleaseNotesEvidence, options: AiReleaseNotesOptions = {}) {
  const prompt = buildAiReleaseNotesPrompt(evidence);
  const command = options.providerCommand || process.env.OPL_RELEASE_NOTES_AI_COMMAND || defaultCodexCommand(options.model || process.env.OPL_RELEASE_NOTES_MODEL);
  const provider = selectedProvider();
  if (provider === 'openai_compatible') {
    return runOpenAICompatibleProvider(prompt, evidence);
  }
  if (provider === 'codex') {
    return runCodexProvider(prompt, evidence, command);
  }
  if (openAICompatibleConfigured()) {
    return runOpenAICompatibleProvider(prompt, evidence);
  }
  throw new Error('No online OpenAI-compatible release-note provider is configured. Set OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL and OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY, or the existing OPL_RELEASE_NOTES_CODEX_BASE_URL and OPL_RELEASE_NOTES_CODEX_API_KEY route. Set OPL_RELEASE_NOTES_PROVIDER=codex only for a local operator fallback.');
}

type AiReleaseNotesCliOptions = AiReleaseNotesOptions & {
  evidencePath: string;
  inputPath: string;
  outputPath: string;
  probeOpenAICompatible: boolean;
};

function parseCliArgs(argv: string[]): AiReleaseNotesCliOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      evidence: { type: 'string' },
      input: { type: 'string' },
      output: { type: 'string' },
      'provider-command': { type: 'string' },
      model: { type: 'string' },
      'probe-openai-compatible': { type: 'boolean' },
    } as const,
    allowPositionals: false,
    strict: true,
  });
  const parsed: AiReleaseNotesCliOptions = {
    evidencePath: values.evidence ? path.resolve(values.evidence) : process.env.OPL_RELEASE_NOTES_EVIDENCE_INPUT?.trim() || '',
    inputPath: values.input ? path.resolve(values.input) : '',
    outputPath: values.output ? path.resolve(values.output) : '',
    providerCommand: values['provider-command'],
    model: values.model,
    probeOpenAICompatible: values['probe-openai-compatible'] === true,
  };
  if (!parsed.probeOpenAICompatible && !parsed.evidencePath) {
    throw new Error('Missing required --evidence.');
  }
  return parsed;
}

function readReleaseNotesEvidence(evidencePath: string): ReleaseNotesEvidence {
  const payload = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  return (payload?.release_evidence ?? payload) as ReleaseNotesEvidence;
}

function runCli() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.probeOpenAICompatible) {
    runOpenAICompatibleProbe();
    return;
  }
  const evidence = readReleaseNotesEvidence(options.evidencePath);
  const notes = options.inputPath
    ? fs.readFileSync(options.inputPath, 'utf8')
    : buildAiReleaseNotesDocument(evidence, options);
  validateAiReleaseNotes(notes, evidence);
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, notes);
  } else {
    process.stdout.write(notes);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
