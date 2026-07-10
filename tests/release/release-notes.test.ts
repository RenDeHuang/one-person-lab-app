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

function runNode(args, options = {}) {
  return spawnSync(process.execPath, ['--experimental-strip-types', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

test('AI release notes writer auto provider prefers the OpenAI-compatible online endpoint', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-notes-'));
  const binDir = path.join(tempRoot, 'bin');
  const requestPath = path.join(tempRoot, 'request.json');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  const aiMarkdown = validStandardAiReleaseNotes('26.9.1');

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
  assert.match(fs.readFileSync(outputPath, 'utf8'), /One Person Lab v26\.9\.1/);
});
