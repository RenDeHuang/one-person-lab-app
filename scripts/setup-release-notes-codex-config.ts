#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required ${name} for AI release notes. Configure it as a GitHub secret or variable before publishing.`);
  }
  return value;
}

function optionalEnv(name: string, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

function tomlString(value: string) {
  return JSON.stringify(value);
}

function assertProviderName(provider: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(provider)) {
    throw new Error('OPL_RELEASE_NOTES_CODEX_PROVIDER must use only letters, digits, underscore, or hyphen.');
  }
}

function assertBaseUrl(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new Error('OPL_RELEASE_NOTES_CODEX_BASE_URL must be a valid http(s) URL.');
  }
}

function appendGithubEnv(name: string, value: string) {
  const githubEnv = process.env.GITHUB_ENV?.trim();
  if (!githubEnv) {
    return;
  }
  fs.appendFileSync(githubEnv, `${name}=${value}\n`);
}

function main() {
  const provider = requiredEnv('OPL_RELEASE_NOTES_CODEX_PROVIDER');
  const baseUrl = requiredEnv('OPL_RELEASE_NOTES_CODEX_BASE_URL');
  const apiKey = requiredEnv('OPL_RELEASE_NOTES_CODEX_API_KEY');
  const wireApi = optionalEnv('OPL_RELEASE_NOTES_CODEX_WIRE_API', 'responses');
  const model = requiredEnv('OPL_RELEASE_NOTES_MODEL');
  const codexHome = process.env.CODEX_HOME?.trim()
    || path.join(process.env.RUNNER_TEMP?.trim() || os.tmpdir(), 'opl-release-notes-codex-home');

  assertProviderName(provider);
  assertBaseUrl(baseUrl);

  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::add-mask::${apiKey}`);
  }

  fs.mkdirSync(codexHome, { recursive: true });
  const configPath = path.join(codexHome, 'config.toml');
  const lines = [
    `model_provider = ${tomlString(provider)}`,
    `model = ${tomlString(model)}`,
    '',
    `[model_providers.${provider}]`,
    `name = ${tomlString(provider)}`,
    `base_url = ${tomlString(baseUrl)}`,
    `wire_api = ${tomlString(wireApi)}`,
    `experimental_bearer_token = ${tomlString(apiKey)}`,
    'requires_openai_auth = true',
  ].filter((line) => line !== '');

  const trustedProjects = new Set<string>();
  const workspace = process.env.GITHUB_WORKSPACE?.trim();
  if (workspace) {
    trustedProjects.add(workspace);
  }
  trustedProjects.add(process.cwd());
  for (const projectPath of trustedProjects) {
    lines.push('', `[projects.${tomlString(projectPath)}]`, 'trust_level = "trusted"');
  }

  fs.writeFileSync(configPath, `${lines.join('\n')}\n`, { mode: 0o600 });
  fs.chmodSync(configPath, 0o600);
  appendGithubEnv('CODEX_HOME', codexHome);

  console.log(`Configured Codex release-note writer: provider=${provider}, wire_api=${wireApi}, config=${configPath}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
