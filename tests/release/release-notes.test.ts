import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { appRoot } from './release-readiness/helpers.ts';
import {
  stableInstallCommand,
  validStandardAiReleaseNotes,
} from './app-release-boundary-cases/release-notes-fixtures.ts';
import {
  completeAiReleaseNotesWithEvidence,
  publicMarkdownBeforeTechnicalDetails,
} from '../../scripts/release-notes-ai-writer-parts/markdown-normalization.ts';
import { validateAiReleaseNotes } from '../../scripts/release-notes-ai-writer-parts/validation.ts';

function runNode(args, options = {}) {
  return spawnSync(process.execPath, ['--experimental-strip-types', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

function standardEvidence(version = '26.9.1', overrides: any = {}) {
  const base = {
    schema: 'opl_app_release_notes_evidence.v1',
    version,
    channel: 'stable',
    release_title: `One Person Lab v${version}`,
    release_repo: 'gaofeng21cn/one-person-lab-app',
    current_tag: `v${version}`,
    previous_tag: 'v26.9.0',
    install_command: stableInstallCommand,
    full_changelog_url: `https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v${version}`,
    grouped_changes: [{
      title: 'First launch and setup',
      bullets: ['First launch setup is clearer before users open built-in OPL sessions.'],
    }],
    payload: {
      include_full_package: false,
      lines: ['- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.'],
      bundled_refs: [],
      updates_since_previous_stable: [],
    },
    agent_runtime_changes: [],
    family_repo_changes: [{
      label: 'One Person Lab App',
      repository: 'gaofeng21cn/one-person-lab-app',
      previous_ref: 'v26.9.0',
      current_ref: `v${version}`,
      compare_url: `https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v${version}`,
      commit_count: 1,
      change_subjects: ['fix(first-run): clarify setup'],
    }],
  };
  return {
    ...base,
    ...overrides,
    payload: { ...base.payload, ...(overrides.payload ?? {}) },
  };
}

function writeSequencedOpenAiCompatibleCurl(binDir: string, requestLogPath: string, responses: string[]) {
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'curl'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const payload = JSON.parse(args[args.indexOf('-d') + 1]);
const requestLogPath = ${JSON.stringify(requestLogPath)};
const requests = fs.existsSync(requestLogPath) ? JSON.parse(fs.readFileSync(requestLogPath, 'utf8')) : [];
requests.push(String(payload.messages?.[0]?.content || ''));
fs.writeFileSync(requestLogPath, JSON.stringify(requests));
const responses = ${JSON.stringify(responses)};
const content = responses[Math.min(requests.length - 1, responses.length - 1)];
process.stdout.write(JSON.stringify({ choices: [{ message: { content } }] }));
`, { mode: 0o755 });
}

function writeTransientOpenAiCompatibleCurl(
  binDir: string,
  attemptPath: string,
  failuresBeforeSuccess: number,
  successMarkdown: string,
) {
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'curl'), `#!/usr/bin/env node
const fs = require('node:fs');
const attemptPath = ${JSON.stringify(attemptPath)};
const attempt = fs.existsSync(attemptPath) ? Number(fs.readFileSync(attemptPath, 'utf8')) + 1 : 1;
fs.writeFileSync(attemptPath, String(attempt));
if (attempt <= ${failuresBeforeSuccess}) {
  process.stderr.write('curl: (28) Operation timed out with 0 bytes received\\n');
  process.exit(28);
}
process.stdout.write(JSON.stringify({ choices: [{ message: { content: ${JSON.stringify(successMarkdown)} } }] }));
`, { mode: 0o755 });
}

function runWithFakeOpenAiNotes(evidence: any, responses: string[]) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-notes-repair-'));
  const binDir = path.join(tempRoot, 'bin');
  const requestLogPath = path.join(tempRoot, 'requests.json');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  writeSequencedOpenAiCompatibleCurl(binDir, requestLogPath, responses);
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  const result = runNode([
    'scripts/release-notes-ai-writer.ts',
    '--evidence', evidencePath,
    '--output', outputPath,
  ], {
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      OPL_RELEASE_NOTES_PROVIDER: 'auto',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:3001/v1',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: 'freellmapi-test',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL: 'auto',
    },
  });
  return {
    result,
    outputPath,
    requests: JSON.parse(fs.readFileSync(requestLogPath, 'utf8')),
  };
}

test('AI release notes writer auto provider prefers the OpenAI-compatible online endpoint', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-notes-'));
  const binDir = path.join(tempRoot, 'bin');
  const requestPath = path.join(tempRoot, 'request.json');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  const remoteMarker = '<!-- OPENAI_COMPATIBLE_REMOTE_FIXTURE -->';
  const aiMarkdown = validStandardAiReleaseNotes('26.9.1')
    .replace('## What improved', `${remoteMarker}\n\n## What improved`);

  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'curl'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const endpoint = args.find((arg) => /^https?:\\/\\//.test(arg));
const payload = JSON.parse(args[args.indexOf('-d') + 1]);
fs.writeFileSync(${JSON.stringify(requestPath)}, JSON.stringify({
  endpoint,
  model: payload.model,
  contentIncludesEvidence: String(payload.messages?.[0]?.content || '').includes('"release_evidence"'),
  hasBearer: args.includes('Authorization: Bearer freellmapi-test'),
}));
process.stdout.write(JSON.stringify({ choices: [{ message: { content: ${JSON.stringify(aiMarkdown)} } }] }));
`, { mode: 0o755 });
  fs.writeFileSync(evidencePath, `${JSON.stringify({
    schema: 'opl_app_release_notes_evidence.v1',
    version: '26.9.1',
    channel: 'stable',
    release_title: 'One Person Lab v26.9.1',
    release_repo: 'gaofeng21cn/one-person-lab-app',
    current_tag: 'v26.9.1',
    previous_tag: 'v26.9.0',
    install_command: stableInstallCommand,
    full_changelog_url: 'https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v26.9.1',
    grouped_changes: [{
      title: 'First launch and setup',
      bullets: ['First launch setup is clearer before users open built-in OPL sessions.'],
    }],
    payload: {
      include_full_package: false,
      lines: ['- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.'],
      bundled_refs: [],
      updates_since_previous_stable: [],
    },
    agent_runtime_changes: [],
    family_repo_changes: [{
      label: 'One Person Lab App',
      repository: 'gaofeng21cn/one-person-lab-app',
      previous_ref: 'v26.9.0',
      current_ref: 'v26.9.1',
      compare_url: 'https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v26.9.1',
      commit_count: 1,
      change_subjects: ['fix(first-run): clarify setup'],
    }],
  }, null, 2)}\n`);

  const result = runNode([
    'scripts/release-notes-ai-writer.ts',
    '--evidence',
    evidencePath,
    '--output',
    outputPath,
  ], {
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      OPL_RELEASE_NOTES_PROVIDER: 'auto',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:3001/v1',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: 'freellmapi-test',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL: 'auto',
      GITHUB_TOKEN: 'github-models-legacy-token',
      GH_TOKEN: 'github-models-legacy-token',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(requestPath, 'utf8')), {
    endpoint: 'http://127.0.0.1:3001/v1/chat/completions',
    model: 'auto',
    contentIncludesEvidence: true,
    hasBearer: true,
  });
  const output = fs.readFileSync(outputPath, 'utf8');
  assert.match(output, /OPENAI_COMPATIBLE_REMOTE_FIXTURE/);
  assert.match(output, /<!-- OPL_RELEASE_NOTES_GENERATOR:online-ai -->/);
});

test('online AI notes retries bounded transport timeouts in the same job and writes a passed receipt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-transport-retry-'));
  const binDir = path.join(tempRoot, 'bin');
  const attemptPath = path.join(tempRoot, 'attempt.txt');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  const receiptPath = path.join(tempRoot, 'notes-prepare-receipt.json');
  const evidence = standardEvidence('26.9.6');
  writeTransientOpenAiCompatibleCurl(binDir, attemptPath, 2, validStandardAiReleaseNotes('26.9.6'));
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const result = runNode([
    'scripts/release-notes-ai-writer.ts',
    '--evidence', evidencePath,
    '--output', outputPath,
    '--receipt-output', receiptPath,
  ], {
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      OPL_RELEASE_NOTES_PROVIDER: 'openai_compatible',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:3001/v1',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: 'freellmapi-test',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL: 'auto',
      OPL_RELEASE_NOTES_AI_RETRY_DELAY_MS: '0',
      GITHUB_RUN_ID: '789',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(attemptPath, 'utf8'), '3');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.identity.workflow_run_id, '789');
  assert.equal(receipt.provider.max_transport_attempts_per_request, 3);
  assert.match(receipt.notes_sha256, /^[0-9a-f]{64}$/);
  assert.equal(receipt.failure, null);
});

test('online AI notes exhausts bounded timeout retries and writes a typed failure receipt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-transport-failure-'));
  const binDir = path.join(tempRoot, 'bin');
  const attemptPath = path.join(tempRoot, 'attempt.txt');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  const receiptPath = path.join(tempRoot, 'notes-prepare-receipt.json');
  const evidence = standardEvidence('26.9.7');
  writeTransientOpenAiCompatibleCurl(binDir, attemptPath, 3, validStandardAiReleaseNotes('26.9.7'));
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const result = runNode([
    'scripts/release-notes-ai-writer.ts',
    '--evidence', evidencePath,
    '--output', outputPath,
    '--receipt-output', receiptPath,
  ], {
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      OPL_RELEASE_NOTES_PROVIDER: 'openai_compatible',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:3001/v1',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: 'freellmapi-test',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL: 'auto',
      OPL_RELEASE_NOTES_AI_RETRY_DELAY_MS: '0',
      GITHUB_RUN_ID: '790',
    },
  });

  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(attemptPath, 'utf8'), '3');
  assert.match(result.stderr, /provider_transport_timeout.*transport attempt 3\/3/s);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.identity.workflow_run_id, '790');
  assert.deepEqual(receipt.failure, {
    taxonomy: 'transport',
    type: 'provider_transport_timeout',
    transport_attempts: 3,
    transport_retry_exhausted: true,
    message: receipt.failure.message,
  });
  assert.match(receipt.failure.message, /transport attempt 3\/3/);
  assert.equal(receipt.notes_sha256, null);
  assert.equal(fs.existsSync(outputPath), false);
});

test('stable manifest notes expose install, component refs, and version changes', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-manifest-'));
  const currentPath = path.join(tempRoot, 'current.json');
  const previousPath = path.join(tempRoot, 'previous.json');
  fs.writeFileSync(currentPath, JSON.stringify({ components: {
    mas: { git_commit: 'a'.repeat(40) },
    officecli: { version: '1.2.3' },
  } }));
  fs.writeFileSync(previousPath, JSON.stringify({ components: {
    mas: { git_commit: 'b'.repeat(40) },
    officecli: { version: '1.2.2' },
  } }));

  const result = runNode([
    'scripts/generate-release-notes.ts',
    '--version', '26.9.2',
    '--channel', 'stable',
    '--previous-tag', 'v26.9.1',
    '--current-tag', 'v26.9.2',
    '--shell-root', appRoot,
    '--previous-app-ref', 'HEAD',
    '--current-app-ref', 'HEAD',
    '--previous-shell-ref', 'HEAD',
    '--current-shell-ref', 'HEAD',
    '--full-package-manifest', currentPath,
    '--previous-full-package-manifest', previousPath,
  ], { env: { OPL_RELEASE_NOTES_SKIP_REMOTE_FAMILY_REPOS: '1' } });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(stableInstallCommand));
  assert.match(result.stdout, /Packaged component refs: MAS @ aaaaaaa; OfficeCLI 1\.2\.3/);
  assert.match(result.stdout, /Component updates since previous Stable: MAS bbbbbbb -> aaaaaaa; OfficeCLI 1\.2\.2 -> 1\.2\.3/);
});

test('final notes normalization sanitizes evidence sections added after model cleanup', () => {
  const evidence = standardEvidence('26.9.3', {
    grouped_changes: [{
      title: 'Release readiness',
      bullets: ['The workflow gate keeps first-launch setup ready for research sessions.'],
    }],
  });
  const rawMarkdown = `${evidence.release_title}\n\nUsers can install or upgrade One Person Lab App to open MAS research, MAG grant-writing, RCA visual deliverable, and OPL Meta Agent sessions.\n`;
  const output = completeAiReleaseNotesWithEvidence(rawMarkdown, evidence);
  const publicMarkdown = publicMarkdownBeforeTechnicalDetails(output);

  assert.doesNotMatch(publicMarkdown, /\b(?:gate|workflow)\b/i);
  assert.match(publicMarkdown, /checks|sessions/i);
  assert.doesNotThrow(() => validateAiReleaseNotes(output, evidence));
});

test('online AI notes performs one bounded repair without echoing the validator diagnostic', () => {
  const evidence = standardEvidence('26.9.4', {
    agent_runtime_changes: [
      { label: 'MAS', user_value_hint: 'Supports research sessions.', change_summary_hint: 'Runtime state is clearer.' },
      { label: 'MAG', user_value_hint: 'Supports grant writing.', change_summary_hint: 'Runtime state is clearer.' },
      { label: 'RCA', user_value_hint: 'Supports visual deliverables.', change_summary_hint: 'Runtime state is clearer.' },
    ],
  });
  const firstDraft = validStandardAiReleaseNotes('26.9.4');
  const repairedDraft = firstDraft.replace(
    '## What improved',
    'MAS research sessions, MAG grant writing, and RCA visual deliverable work now shows clearer runtime state.\n\n## What improved',
  );
  const { result, requests, outputPath } = runWithFakeOpenAiNotes(evidence, [firstDraft, repairedDraft]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(requests.length, 2);
  assert.match(requests[1], /Do not quote or paraphrase any diagnostic message/);
  assert.doesNotMatch(requests[1], /Quality gate failure to fix|missing concrete runtime change detail/);
  assert.ok(fs.existsSync(outputPath));
  assert.match(fs.readFileSync(outputPath, 'utf8'), /<!-- OPL_RELEASE_NOTES_GENERATOR:online-ai -->/);
});

test('online AI notes fails closed after the single repair remains invalid', () => {
  const evidence = standardEvidence('26.9.5', {
    agent_runtime_changes: [
      { label: 'MAS', user_value_hint: 'Supports research sessions.', change_summary_hint: 'Runtime state is clearer.' },
      { label: 'MAG', user_value_hint: 'Supports grant writing.', change_summary_hint: 'Runtime state is clearer.' },
      { label: 'RCA', user_value_hint: 'Supports visual deliverables.', change_summary_hint: 'Runtime state is clearer.' },
    ],
  });
  const invalidDraft = validStandardAiReleaseNotes('26.9.5');
  const { result, requests, outputPath } = runWithFakeOpenAiNotes(evidence, [invalidDraft, invalidDraft]);

  assert.notEqual(result.status, 0);
  assert.equal(requests.length, 2);
  assert.match(result.stderr, /AI release notes failed quality gate/);
  assert.equal(fs.existsSync(outputPath), false);
});
