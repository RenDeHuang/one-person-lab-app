import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function runNode(args, options = {}) {
  return spawnSync(process.execPath, ['--experimental-strip-types', ...args], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

function runGit(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'OPL Test',
      GIT_AUTHOR_EMAIL: 'opl-test@example.com',
      GIT_COMMITTER_NAME: 'OPL Test',
      GIT_COMMITTER_EMAIL: 'opl-test@example.com',
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function commit(shellRoot, subject) {
  fs.writeFileSync(path.join(shellRoot, 'changes.txt'), `${subject}\n`, { flag: 'a' });
  runGit(['add', 'changes.txt'], shellRoot);
  runGit(['commit', '-m', subject], shellRoot);
}

function commitSha(repoRoot, ref = 'HEAD') {
  return runGit(['rev-parse', ref], repoRoot).stdout.trim();
}

function createShellHistory() {
  const shellRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-shell-'));
  runGit(['init', '-b', 'main'], shellRoot);
  fs.writeFileSync(path.join(shellRoot, 'changes.txt'), 'base\n');
  runGit(['add', 'changes.txt'], shellRoot);
  runGit(['commit', '-m', 'chore: initial shell baseline'], shellRoot);
  runGit(['tag', 'previous-shell'], shellRoot);
  commit(shellRoot, 'fix(first-run): simplify beginner setup surface');
  commit(shellRoot, 'fix(guid): load home skills from app packaged set');
  commit(shellRoot, 'fix(settings): use provider health check probe');
  commit(shellRoot, 'fix(build): align bundled aioncore target arch');
  commit(shellRoot, 'docs: refresh beginner setup guide');
  return shellRoot;
}

function createFamilyRepoHistory(subjects) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-family-repo-'));
  runGit(['init', '-b', 'main'], repoRoot);
  fs.writeFileSync(path.join(repoRoot, 'changes.txt'), 'base\n');
  runGit(['add', 'changes.txt'], repoRoot);
  runGit(['commit', '-m', 'chore: initial family baseline'], repoRoot);
  const previousRef = commitSha(repoRoot);
  for (const subject of subjects) {
    commit(repoRoot, subject);
  }
  return {
    repoRoot,
    repository: repoRoot,
    previousRef,
    currentRef: commitSha(repoRoot),
  };
}

function buildFullManifest(refs) {
  const components = {};
  const resolvedRefs = {};
  for (const [componentKey, value] of Object.entries(refs)) {
    components[componentKey] = {
      source_path: value.repoRoot,
      git_commit: value.currentRef,
      ...(value.version ? { version: value.version } : {}),
    };
    resolvedRefs[value.resolvedKey] = {
      label: value.label,
      source_path: value.repoRoot,
      repository: value.repository,
      requested_ref: 'main',
      resolved_commit: value.currentRef,
      ...(value.version ? { version: value.version } : {}),
    };
  }
  return {
    components,
    resolved_refs: resolvedRefs,
  };
}

function publicFirstScreen(markdown) {
  const technicalDetails = markdown.indexOf('\n## Technical details\n');
  return technicalDetails === -1 ? markdown : markdown.slice(0, technicalDetails);
}

function assertUserFirstLead(markdown) {
  const lead = publicFirstScreen(markdown);
  assert.match(lead, /## Highlights/);
  assert.match(lead, /## What improved/);
  assert.match(lead, /## Compatibility and action required/);
  assert.doesNotMatch(
    lead,
    /\b(?:refs?|sha|cohort|gate|workflow|validation|release operator|owner receipt|currentness|handoff)\b/i,
  );
  assert.doesNotMatch(lead, /@\s*[0-9a-f]{7}/i);
}

test('AI release notes writer auto provider prefers the OpenAI-compatible online endpoint', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-notes-'));
  const binDir = path.join(tempRoot, 'bin');
  const fakeCurl = path.join(binDir, 'curl');
  const requestPath = path.join(tempRoot, 'request.json');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  const installCommand = 'curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash -s -- --stable-macos-install --yes';
  const publicMarkdown = `One Person Lab v26.9.1

This release helps users upgrade the OPL App with clearer first launch setup before opening MAS research, MAG grant-writing, RCA visual deliverable, and OPL Meta Agent sessions.

## What improved

- First launch setup is clearer before users open built-in MAS, MAG, RCA, and OPL Meta Agent sessions.

## OPL agents and runtime payload
- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.

## OPL family updates
- One Person Lab App: current standard package changes keep the built-in OPL entries aligned.

## Install Stable
\`${installCommand}\`

## Release scope
- Standard macOS arm64 updater package is published for this release.

Full Changelog: https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v26.9.1
`;
  const aiMarkdown = `${publicMarkdown}
<!-- OPL_RELEASE_NOTES:en-US
${publicMarkdown.trimEnd()}
-->
<!-- OPL_RELEASE_NOTES:zh-CN
One Person Lab v26.9.1

这次更新让用户升级 OPL App 后，更容易从首次启动进入 MAS、MAG、RCA 和 OPL Meta Agent 会话。

## What improved
- MAS、MAG 和 RCA 入口更清楚。

## OPL agents and runtime payload
- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.

## Install Stable
\`${installCommand}\`

## Release scope
- Standard macOS arm64 updater package is published for this release.
-->
`;

  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(fakeCurl, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const endpoint = args.find((arg) => /^https?:\\/\\//.test(arg));
const body = args[args.indexOf('-d') + 1];
const payload = JSON.parse(body);
fs.writeFileSync(${JSON.stringify(requestPath)}, JSON.stringify({
  endpoint,
  model: payload.model,
  contentIncludesEvidence: String(payload.messages?.[0]?.content || '').includes('"release_evidence"'),
  hasBearer: args.includes('Authorization: Bearer freellmapi-test'),
}, null, 2));
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
    install_command: installCommand,
    full_changelog_url: 'https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v26.9.1',
    grouped_changes: [
      {
        title: 'First launch and setup',
        bullets: ['First launch setup is clearer before users open built-in OPL sessions.'],
      },
    ],
    payload: {
      include_full_package: false,
      lines: ['- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.'],
      bundled_refs: [],
      updates_since_previous_stable: [],
    },
    agent_runtime_changes: [],
    family_repo_changes: [
      {
        label: 'One Person Lab App',
        repository: 'gaofeng21cn/one-person-lab-app',
        previous_ref: 'v26.9.0',
        current_ref: 'v26.9.1',
        compare_url: 'https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.0...v26.9.1',
        commit_count: 1,
        change_subjects: ['fix(first-run): clarify setup'],
      },
    ],
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
  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  assert.deepEqual(request, {
    endpoint: 'http://127.0.0.1:3001/v1/chat/completions',
    model: 'auto',
    contentIncludesEvidence: true,
    hasBearer: true,
  });
  assert.match(fs.readFileSync(outputPath, 'utf8'), /One Person Lab v26\.9\.1/);
});

test('AI release notes provider probe uses OpenAI-compatible endpoint without printing the secret', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-probe-'));
  const binDir = path.join(tempRoot, 'bin');
  const fakeCurl = path.join(binDir, 'curl');
  const requestPath = path.join(tempRoot, 'probe-request.json');

  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(fakeCurl, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const endpoint = args.find((arg) => /^https?:\\/\\//.test(arg));
const body = args[args.indexOf('-d') + 1];
const payload = JSON.parse(body);
fs.writeFileSync(${JSON.stringify(requestPath)}, JSON.stringify({
  endpoint,
  model: payload.model,
  hasBearer: args.includes('Authorization: Bearer freellmapi-secret-test'),
  prompt: payload.messages?.[0]?.content,
}, null, 2));
process.stdout.write(JSON.stringify({ choices: [{ message: { content: 'OPL_RELEASE_NOTES_PROVIDER_OK' } }] }));
`, { mode: 0o755 });

  const result = runNode(['scripts/release-notes-ai-writer.ts', '--probe-openai-compatible'], {
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:3001/v1',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: 'freellmapi-secret-test',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL: 'auto',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /freellmapi-secret-test/);
  assert.doesNotMatch(result.stderr, /freellmapi-secret-test/);
  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  assert.deepEqual(request, {
    endpoint: 'http://127.0.0.1:3001/v1/chat/completions',
    model: 'auto',
    hasBearer: true,
    prompt: 'Return exactly: OPL_RELEASE_NOTES_PROVIDER_OK',
  });
  const readback = JSON.parse(result.stdout);
  assert.equal(readback.status, 'ok');
  assert.equal(readback.provider, 'openai_compatible');
  assert.equal(readback.model, 'auto');
});

test('AI release notes writer keeps evidence-completed user sections before Technical details', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-openai-compatible-section-order-'));
  const binDir = path.join(tempRoot, 'bin');
  const fakeCurl = path.join(binDir, 'curl');
  const evidencePath = path.join(tempRoot, 'evidence.json');
  const outputPath = path.join(tempRoot, 'notes.md');
  const installCommand = 'curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash -s -- --stable-macos-install --yes';

  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(fakeCurl, `#!/usr/bin/env node
process.stdout.write(JSON.stringify({ choices: [{ message: { content: ${JSON.stringify(`One Person Lab v26.9.2

## Technical details

Generated by the provider.

<!-- OPL_RELEASE_NOTES:en-US
Popup summary without the release title.
-->
<!-- OPL_RELEASE_NOTES:zh-CN
缺少发布标题的弹窗摘要。
-->
`)} } }] }));
`, { mode: 0o755 });
  fs.writeFileSync(evidencePath, `${JSON.stringify({
    schema: 'opl_app_release_notes_evidence.v1',
    version: '26.9.2',
    channel: 'stable',
    release_title: 'One Person Lab v26.9.2',
    release_repo: 'gaofeng21cn/one-person-lab-app',
    current_tag: 'v26.9.2',
    previous_tag: 'v26.9.1',
    install_command: installCommand,
    full_changelog_url: 'https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.1...v26.9.2',
    grouped_changes: [
      {
        title: 'First launch and setup',
        bullets: ['MAS research, MAG grant-writing, RCA visual deliverable, and OPL Meta Agent sessions are clearer after first launch.'],
      },
    ],
    payload: {
      include_full_package: false,
      lines: ['- Standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin and skill sync policy.'],
      bundled_refs: [],
      updates_since_previous_stable: [],
    },
    agent_runtime_changes: [],
    family_repo_changes: [
      {
        label: 'One Person Lab App',
        repository: 'gaofeng21cn/one-person-lab-app',
        previous_ref: 'v26.9.1',
        current_ref: 'v26.9.2',
        compare_url: 'https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.9.1...v26.9.2',
        commit_count: 1,
        change_summary_hint: 'First launch copy now describes the built-in OPL entries more clearly.',
        change_subjects: ['fix(first-run): clarify setup'],
      },
    ],
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
      OPL_RELEASE_NOTES_PROVIDER: 'openai_compatible',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL: 'http://127.0.0.1:3001/v1',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY: 'freellmapi-test',
      OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_MODEL: 'auto',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const notes = fs.readFileSync(outputPath, 'utf8');
  const publicNotes = publicFirstScreen(notes);
  assert.match(publicNotes, /Users can install or upgrade One Person Lab App/);
  assert.match(publicNotes, /## What improved/);
  assert.match(publicNotes, /## OPL agents and runtime payload/);
  assert.match(publicNotes, /## OPL family updates/);
  assert.match(publicNotes, /## Install Stable/);
  assert.match(publicNotes, /## Release scope/);
});

function writeFakeGhReleaseDownload(binDir, publicReleaseManifest) {
  fs.mkdirSync(binDir, { recursive: true });
  const fakeGh = path.join(binDir, 'gh');
  fs.writeFileSync(fakeGh, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const pattern = args[args.indexOf('--pattern') + 1];
const dir = args[args.indexOf('--dir') + 1];
if (args[0] === 'release' && args[1] === 'download' && pattern === 'opl-release-manifest.json' && dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'opl-release-manifest.json'), ${JSON.stringify(JSON.stringify(publicReleaseManifest, null, 2))} + '\\n');
  process.exit(0);
}
process.exit(1);
`);
  fs.chmodSync(fakeGh, 0o755);
}

test('stable release notes are English and include bundled OPL-family agent versions', () => {
  const shellRoot = createShellHistory();
  const manifestPath = path.join(shellRoot, 'full-package-manifest.json');
  const previousManifestPath = path.join(shellRoot, 'previous-full-package-manifest.json');
  const mas = createFamilyRepoHistory([
    'fix(runtime): surface currentness blockers',
    'feat(study): route paper handoff receipts',
  ]);
  const mag = createFamilyRepoHistory([
    'feat(grant): expose progress-first owner payloads',
  ]);
  const rca = createFamilyRepoHistory([
    'fix(provider): record operator evidence for visual deliverables',
  ]);
  const metaAgent = createFamilyRepoHistory([
    'feat(foundry): persist work-order currentness gates',
  ]);
  const currentManifest = buildFullManifest({
    mas: { ...mas, resolvedKey: 'mas', label: 'MAS' },
    mag: { ...mag, resolvedKey: 'mag', label: 'MAG' },
    rca: { ...rca, resolvedKey: 'rca', label: 'RCA' },
    meta_agent: { ...metaAgent, resolvedKey: 'opl_meta_agent', label: 'OPL Meta Agent' },
    officecli: {
      repoRoot: null,
      repository: 'iOfficeAI/OfficeCLI',
      previousRef: null,
      currentRef: null,
      resolvedKey: 'officecli',
      label: 'OfficeCLI',
      version: '1.2.3',
    },
    mineru_open_api: {
      repoRoot: null,
      repository: 'opendatalab/MinerU-Ecosystem',
      previousRef: null,
      currentRef: null,
      resolvedKey: 'mineru',
      label: 'MinerU',
      version: 'mineru-open-api version v0.1.3',
    },
  });
  const previousManifest = buildFullManifest({
    mas: { ...mas, currentRef: mas.previousRef, resolvedKey: 'mas', label: 'MAS' },
    mag: { ...mag, currentRef: mag.previousRef, resolvedKey: 'mag', label: 'MAG' },
    rca: { ...rca, currentRef: rca.previousRef, resolvedKey: 'rca', label: 'RCA' },
    meta_agent: { ...metaAgent, currentRef: metaAgent.previousRef, resolvedKey: 'opl_meta_agent', label: 'OPL Meta Agent' },
    officecli: {
      repoRoot: null,
      repository: 'iOfficeAI/OfficeCLI',
      previousRef: null,
      currentRef: null,
      resolvedKey: 'officecli',
      label: 'OfficeCLI',
      version: '1.2.2',
    },
    mineru_open_api: {
      repoRoot: null,
      repository: 'opendatalab/MinerU-Ecosystem',
      previousRef: null,
      currentRef: null,
      resolvedKey: 'mineru',
      label: 'MinerU',
      version: 'mineru-open-api version v0.1.2',
    },
  });
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    ...currentManifest,
  }, null, 2)}\n`);
  fs.writeFileSync(previousManifestPath, `${JSON.stringify(previousManifest, null, 2)}\n`);

  const result = runNode([
    'scripts/generate-release-notes.ts',
    '--version',
    '26.5.31',
    '--channel',
    'stable',
    '--previous-tag',
    'v26.5.28',
    '--current-tag',
    'v26.5.31',
    '--shell-root',
    shellRoot,
    '--previous-shell-ref',
    'previous-shell',
    '--current-shell-ref',
    'HEAD',
    '--previous-app-ref',
    'HEAD',
    '--current-app-ref',
    'HEAD',
    '--include-full-package',
    '--full-package-manifest',
    manifestPath,
    '--previous-full-package-manifest',
    previousManifestPath,
  ], {
    env: {
      OPL_RELEASE_NOTES_SKIP_REMOTE_FAMILY_REPOS: '1',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /One Person Lab v26\.5\.31/);
  assert.match(result.stdout, /This Stable release is for users installing or upgrading One Person Lab App/);
  assertUserFirstLead(result.stdout);
  assert.match(result.stdout, /## Install Stable/);
  assert.match(
    result.stdout,
    /curl -fsSL https:\/\/raw\.githubusercontent\.com\/gaofeng21cn\/one-person-lab-app\/main\/install\.sh \| bash -s -- --stable-macos-install --yes/,
  );
  assert.match(result.stdout, /First launch and setup/);
  assert.match(result.stdout, /Made first launch and setup steps clearer/);
  assert.match(result.stdout, /Built-in research, grant, and visual work/);
  assert.match(result.stdout, new RegExp(`MAS @ ${mas.currentRef.slice(0, 7)}`));
  assert.match(result.stdout, new RegExp(`MAG @ ${mag.currentRef.slice(0, 7)}`));
  assert.match(result.stdout, new RegExp(`RCA @ ${rca.currentRef.slice(0, 7)}`));
  assert.match(result.stdout, new RegExp(`OPL Meta Agent @ ${metaAgent.currentRef.slice(0, 7)}`));
  assert.match(result.stdout, /OfficeCLI 1\.2\.3/);
  assert.match(result.stdout, /MinerU v0\.1\.3/);
  assert.match(result.stdout, /## OPL family updates/);
  assert.match(result.stdout, /MAS: Research sessions make study and paper status/);
  assert.match(result.stdout, /MAG: Grant-writing sessions make progress/);
  assert.match(result.stdout, /RCA: Visual deliverable sessions make provider readiness/);
  assert.match(result.stdout, /OPL Meta Agent: Agent-design sessions make work-order status/);
  assert.match(result.stdout, /OfficeCLI: updated in the bundled OPL family payload \(audit ref 1\.2\.2 -> 1\.2\.3\)/);
  assert.match(result.stdout, /MinerU: updated in the bundled OPL family payload \(audit ref v0\.1\.2 -> v0\.1\.3\)/);
  assert.match(result.stdout, /Installing and updating/);
  assert.match(result.stdout, /Guides and screenshots/);
  assert.match(result.stdout, /## Technical details/);
  assert.match(result.stdout, /Packaged component refs:/);
  assert.doesNotMatch(result.stdout, /Release focus/);
  assert.doesNotMatch(result.stdout, /Update channel guidance/);
  assert.doesNotMatch(result.stdout, /Full clean-install/);
  assert.doesNotMatch(result.stdout, /[\u3400-\u9fff]/);
  assert.doesNotMatch(result.stdout, /Change log\n(?:- .+\n){5,}/);
});

test('stable release notes compare previous Full payload from public release manifest asset', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-public-manifest-'));
  const binDir = path.join(tempRoot, 'bin');
  const shellRoot = createShellHistory();
  const manifestPath = path.join(tempRoot, 'full-package-manifest.json');
  const currentManifest = buildFullManifest({
    mas: {
      repoRoot: null,
      repository: 'gaofeng21cn/med-autoscience',
      previousRef: null,
      currentRef: '1234567890abcdef1234567890abcdef12345678',
      resolvedKey: 'mas',
      label: 'MAS',
    },
    officecli: {
      repoRoot: null,
      repository: 'iOfficeAI/OfficeCLI',
      previousRef: null,
      currentRef: null,
      resolvedKey: 'officecli',
      label: 'OfficeCLI',
      version: '1.2.3',
    },
  });
  const previousManifest = buildFullManifest({
    mas: {
      repoRoot: null,
      repository: 'gaofeng21cn/med-autoscience',
      previousRef: null,
      currentRef: '0000000000abcdef1234567890abcdef12345678',
      resolvedKey: 'mas',
      label: 'MAS',
    },
    officecli: {
      repoRoot: null,
      repository: 'iOfficeAI/OfficeCLI',
      previousRef: null,
      currentRef: null,
      resolvedKey: 'officecli',
      label: 'OfficeCLI',
      version: '1.2.2',
    },
  });
  fs.writeFileSync(manifestPath, `${JSON.stringify(currentManifest, null, 2)}\n`);
  writeFakeGhReleaseDownload(binDir, {
    schema: 'opl_public_release_manifest.v1',
    manifest: previousManifest,
  });

  const result = runNode([
    'scripts/generate-release-notes.ts',
    '--version',
    '26.5.31',
    '--channel',
    'stable',
    '--previous-tag',
    'v26.5.28',
    '--current-tag',
    'v26.5.31',
    '--shell-root',
    shellRoot,
    '--previous-shell-ref',
    'previous-shell',
    '--current-shell-ref',
    'HEAD',
    '--previous-app-ref',
    'HEAD',
    '--current-app-ref',
    'HEAD',
    '--include-full-package',
    '--full-package-manifest',
    manifestPath,
  ], {
    env: {
      OPL_RELEASE_NOTES_SKIP_REMOTE_FAMILY_REPOS: '1',
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /Component updates since previous Stable: MAS 0000000 -> 1234567; OfficeCLI 1\.2\.2 -> 1\.2\.3\./,
  );
});

test('nightly release notes compare against the previous nightly and stay standard-only', () => {
  const shellRoot = createShellHistory();
  const evidencePath = path.join(os.tmpdir(), `opl-nightly-notes-evidence-${Date.now()}.json`);
  const result = runNode([
    'scripts/generate-release-notes.ts',
    '--version',
    '26.5.31-nightly',
    '--channel',
    'nightly',
    '--previous-tag',
    'v26.5.30-nightly',
    '--current-tag',
    'v26.5.31-nightly',
    '--shell-root',
    shellRoot,
    '--previous-shell-ref',
    'previous-shell',
    '--current-shell-ref',
    'HEAD',
    '--previous-app-ref',
    'HEAD',
    '--current-app-ref',
    'HEAD',
    '--evidence-output',
    evidencePath,
  ], {
    env: {
      OPL_RELEASE_NOTES_SKIP_REMOTE_FAMILY_REPOS: '1',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  assert.equal(evidence.schema, 'opl_app_release_notes_evidence.v1');
  assert.equal(evidence.version, '26.5.31-nightly');
  assert.equal(evidence.channel, 'nightly');
  assert.equal(evidence.release_title, 'One Person Lab v26.5.31-nightly');
  assert.equal(
    evidence.release_scope,
    'Standard macOS arm64 Nightly package and updater metadata; no Full first-install DMG in the Nightly channel.',
  );
  assert.match(result.stdout, /One Person Lab v26\.5\.31-nightly/);
  assert.match(result.stdout, /This Nightly prerelease is for users who want to try the current standard App shell/);
  assertUserFirstLead(result.stdout);
  assert.match(result.stdout, /First launch and setup/);
  assert.match(result.stdout, /Built-in research, grant, and visual work/);
  assert.match(result.stdout, /Standard macOS arm64 Nightly package and updater metadata only/);
  assert.doesNotMatch(result.stdout, /Full clean-install/);
  assert.doesNotMatch(result.stdout, /[\u3400-\u9fff]/);
  assert.doesNotMatch(result.stdout, /This prerelease is for users/);
});
