import { spawnSync } from 'node:child_process';
import type { ReleaseNotesEvidence } from '../release-notes.ts';
import { buildAiReleaseNotesPrompt, buildAiReleaseNotesRepairPrompt } from './evidence-shaping.ts';
import { completeAiReleaseNotesWithEvidence, extractMarkdown } from './markdown-normalization.ts';
import { validateAiReleaseNotes } from './validation.ts';

export type AiReleaseNotesOptions = {
  providerCommand?: string;
  model?: string;
};

type ReleaseNotesProvider = 'auto' | 'openai_compatible' | 'codex';

const defaultOpenAICompatibleModel = 'auto';
const defaultProviderTimeoutSeconds = 75;

export const aiReleaseNotesProvenanceMarker = '<!-- OPL_RELEASE_NOTES_GENERATOR:online-ai -->';

export function markAiGeneratedReleaseNotes(markdown: string) {
  return markdown.includes(aiReleaseNotesProvenanceMarker)
    ? markdown
    : `${markdown.trimEnd()}\n\n${aiReleaseNotesProvenanceMarker}\n`;
}

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

function runOpenAICompatibleModels<T>(
  models: string[],
  failureMessage: string,
  requestModel: (model: string, providerLabel: string) => T,
) {
  const failures: string[] = [];
  for (const model of models) {
    const providerLabel = `OpenAI-compatible ${model}`;
    try {
      return requestModel(model, providerLabel);
    } catch (error) {
      failures.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`${failureMessage} for ${models.join(', ')}: ${failures.join(' | ')}`);
}

function runOpenAICompatibleProvider(prompt: string, evidence: ReleaseNotesEvidence) {
  const { endpoint, token, models } = openAICompatibleConfig();
  if (!endpoint || !token) {
    throw new Error('Missing OpenAI-compatible release-note provider config. Set OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL and OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY, or the existing OPL_RELEASE_NOTES_CODEX_BASE_URL and OPL_RELEASE_NOTES_CODEX_API_KEY route.');
  }
  return runOpenAICompatibleModels(models, 'OpenAI-compatible provider failed', (model, providerLabel) => (
    validateOrRepairGeneratedMarkdown(prompt, evidence, (activePrompt) => (
      requestChatCompletions(endpoint, token, model, activePrompt, providerLabel)
    ))
  ));
}

export function runOpenAICompatibleProbe() {
  const { endpoint, token, models } = openAICompatibleConfig();
  if (!endpoint || !token) {
    throw new Error('Missing OpenAI-compatible release-note provider config. Set OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL and OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY, or the existing OPL_RELEASE_NOTES_CODEX_BASE_URL and OPL_RELEASE_NOTES_CODEX_API_KEY route.');
  }
  runOpenAICompatibleModels(models, 'OpenAI-compatible provider probe failed', (model, providerLabel) => {
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
  });
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


export function buildAiReleaseNotesDocument(evidence: ReleaseNotesEvidence, options: AiReleaseNotesOptions = {}) {
  const prompt = buildAiReleaseNotesPrompt(evidence);
  const command = options.providerCommand || process.env.OPL_RELEASE_NOTES_AI_COMMAND || defaultCodexCommand(options.model || process.env.OPL_RELEASE_NOTES_MODEL);
  const provider = selectedProvider();
  if (provider === 'openai_compatible') {
    return markAiGeneratedReleaseNotes(runOpenAICompatibleProvider(prompt, evidence));
  }
  if (provider === 'codex') {
    return markAiGeneratedReleaseNotes(runCodexProvider(prompt, evidence, command));
  }
  if (openAICompatibleConfigured()) {
    return markAiGeneratedReleaseNotes(runOpenAICompatibleProvider(prompt, evidence));
  }
  throw new Error('No online OpenAI-compatible release-note provider is configured. Set OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL and OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY, or the existing OPL_RELEASE_NOTES_CODEX_BASE_URL and OPL_RELEASE_NOTES_CODEX_API_KEY route. Set OPL_RELEASE_NOTES_PROVIDER=codex only for a local operator fallback.');
}
