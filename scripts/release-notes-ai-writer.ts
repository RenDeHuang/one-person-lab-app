import { spawnSync } from 'node:child_process';
import type { ReleaseNotesEvidence } from './release-notes.ts';

type AiReleaseNotesOptions = {
  providerCommand?: string;
  model?: string;
};

type ReleaseNotesLocale = 'en-US' | 'zh-CN';

const releaseNotesLocales: ReleaseNotesLocale[] = ['en-US', 'zh-CN'];

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

function shellCommandArgs(command: string) {
  return ['-lc', command];
}

function defaultCodexCommand(model?: string) {
  const modelArgs = model ? ` --model ${JSON.stringify(model)}` : '';
  return `tmp="$(mktemp)"; codex exec --sandbox read-only --output-last-message "$tmp"${modelArgs} - >/dev/null && cat "$tmp"; status=$?; rm -f "$tmp"; exit "$status"`;
}

function selectedProvider() {
  const value = (process.env.OPL_RELEASE_NOTES_PROVIDER || '').trim().toLowerCase();
  if (!value && process.env.OPL_RELEASE_NOTES_AI_COMMAND) {
    return 'codex';
  }
  if (!value) {
    return 'auto';
  }
  if (!['auto', 'github_models', 'codex'].includes(value)) {
    throw new Error(`Unsupported OPL_RELEASE_NOTES_PROVIDER: ${process.env.OPL_RELEASE_NOTES_PROVIDER}`);
  }
  return value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractLocalizedReleaseNotes(markdown: string, locale: ReleaseNotesLocale) {
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

export function stripLocalizedReleaseNotes(markdown: string) {
  return `${markdown
    .replace(/<!--\s*OPL_RELEASE_NOTES:[A-Za-z-]+\s*\n[\s\S]*?\n?-->\s*/g, '')
    .replace(/<!--\s*OPL_RELEASE_NOTES:[A-Za-z-]+\s*-->[\s\S]*?<!--\s*\/OPL_RELEASE_NOTES:[A-Za-z-]+\s*-->\s*/g, '')
    .trimEnd()}\n`;
}

export function buildAiReleaseNotesPrompt(evidence: ReleaseNotesEvidence) {
  return [
    'Write the public GitHub Release notes for One Person Lab App.',
    '',
    'Use the JSON evidence below as the only source of truth.',
    'Audience: normal OPL App users who want to know what improved and why they should upgrade.',
    '',
    'Hard requirements:',
    `- Start the visible public Markdown first line exactly with: One Person Lab ${evidence.version}`,
    '- The visible public Markdown must be English only.',
    '- Write natural, concrete, user-facing English. Do not sound like a commit classifier.',
    '- The visible first paragraph must explain what a user can do more easily after installing or upgrading. Do not lead with CI, workflows, contracts, release-note generation, or audit mechanics.',
    '- Put that visible first paragraph immediately after the title, before any "##" section heading.',
    '- Explain bundled OPL agent/runtime changes in plain language: MAS, MAG, RCA, OPL Meta Agent, OPL Framework, Codex CLI, OfficeCLI, MinerU, and Codex skills when present.',
    '- When release_evidence.agent_runtime_changes is non-empty, use those entries to write concise role-based bullets. Say what MAS, MAG, RCA, OPL Meta Agent, Framework, Codex CLI, OfficeCLI, or MinerU help users do; do not list refs as the main improvement.',
    '- When an agent_runtime_changes entry has change_summary_hint or change_subjects, include the concrete change in user language. Do not stop at generic role descriptions such as "MAS helps research" or "RCA helps slides".',
    '- Stable compares with the previous Stable; Nightly compares with the previous Nightly.',
    '- Keep the required sections: "## What improved", "## OPL agents and runtime payload", and "## Release scope".',
    '- In "## What improved", start with user-facing agent and runtime workflows before mentioning release plumbing.',
    '- In "## OPL agents and runtime payload", include role-based payload bullets first, then include the release_evidence.payload.lines entries exactly enough that the payload refs, Nightly boundary, and Full runtime boundary remain auditable.',
    '- Do not format release_evidence.payload.lines as blockquotes. They must stay normal bullets.',
    '- Keep build-time refs and payload deltas in the payload/audit part of the note. They are supporting evidence, not the headline.',
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
    JSON.stringify({ release_evidence: evidence }, null, 2),
    '',
  ].join('\n');
}

function extractMarkdown(stdout: string) {
  const trimmed = stdout.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);
  return `${(fenced ? fenced[1] : trimmed).trimEnd()}\n`;
}

function parseGitHubModelsContent(stdout: string) {
  let payload: any;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error(`GitHub Models returned invalid JSON: ${stdout.slice(0, 400)}`);
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('GitHub Models response did not include choices[0].message.content.');
  }
  return content;
}

function buildGitHubModelsRequest(model: string, prompt: string) {
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

function runGitHubModelsProvider(prompt: string, evidence: ReleaseNotesEvidence) {
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (!token) {
    throw new Error('Missing GITHUB_TOKEN or GH_TOKEN for GitHub Models release notes.');
  }
  const model = process.env.OPL_RELEASE_NOTES_GITHUB_MODEL?.trim() || 'openai/gpt-5-mini';
  const endpoint = process.env.OPL_RELEASE_NOTES_GITHUB_MODELS_ENDPOINT?.trim()
    || 'https://models.github.ai/inference/chat/completions';
  const request = buildGitHubModelsRequest(model, prompt);
  const result = spawnSync('curl', [
    '-fsSL',
    endpoint,
    '-H',
    'Accept: application/vnd.github+json',
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
  });
  if (result.status !== 0) {
    throw new Error(`GitHub Models provider failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  const markdown = extractMarkdown(parseGitHubModelsContent(result.stdout));
  validateAiReleaseNotes(markdown, evidence);
  return markdown;
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
  const markdown = extractMarkdown(result.stdout);
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
  if (!new RegExp(`^#?\\s*One Person Lab(?: App)? ${evidence.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(markdown)) {
    failures.push('missing release title');
  }
  for (const required of ['## What improved', '## OPL agents and runtime payload', '## Release scope']) {
    if (!markdown.includes(required)) {
      failures.push(`missing ${required}`);
    }
  }
  if (evidence.channel === 'nightly' && !/Nightly standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin\/skill sync policy\./.test(markdown)) {
    failures.push('missing Nightly agent entry surface');
  }
  if (evidence.payload.include_full_package && !/Build-time payload refs:/.test(markdown)) {
    failures.push('missing Full payload refs');
  }
  if (evidence.payload.include_full_package && evidence.payload.updates_since_previous_stable.length > 0 && !/Payload updates since previous Stable:/.test(markdown)) {
    failures.push('missing Full payload update summary');
  }
  for (const ref of evidence.payload.bundled_refs) {
    if (!markdown.includes(ref)) {
      failures.push(`missing payload ref: ${ref}`);
    }
  }
  if (evidence.full_changelog_url && !markdown.includes(evidence.full_changelog_url)) {
    failures.push('missing Full Changelog link');
  }
  const vagueMatches = vaguePhrases.filter((phrase) => markdown.includes(phrase));
  if (vagueMatches.length > 0) {
    failures.push(`vague boilerplate: ${vagueMatches.join(', ')}`);
  }
  if (/\brelease notes?\b/i.test(markdown) || /\brelease-note\b/i.test(markdown)) {
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
    if (!new RegExp(`^#?\\s*One Person Lab(?: App)? ${escapeRegExp(evidence.version)}(?:\\s|$)`).test(localized)) {
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
  if (provider === 'github_models') {
    return runGitHubModelsProvider(prompt, evidence);
  }
  if (provider === 'codex') {
    return runCodexProvider(prompt, evidence, command);
  }
  try {
    return runGitHubModelsProvider(prompt, evidence);
  } catch (error) {
    console.error(`GitHub Models release-note provider unavailable; falling back to Codex provider. ${error instanceof Error ? error.message : String(error)}`);
    return runCodexProvider(prompt, evidence, command);
  }
}
