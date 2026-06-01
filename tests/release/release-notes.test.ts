import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildAiReleaseNotesDocument, validateAiReleaseNotes } from '../../scripts/release-notes-ai-writer.ts';
import { buildReleaseNotesEvidence } from '../../scripts/release-notes.ts';

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

function createPayloadHistory(subjects) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-payload-'));
  runGit(['init', '-b', 'main'], repoRoot);
  fs.writeFileSync(path.join(repoRoot, 'changes.txt'), 'base\n');
  runGit(['add', 'changes.txt'], repoRoot);
  runGit(['commit', '-m', 'chore: initial payload baseline'], repoRoot);
  const previousRef = runGit(['rev-parse', 'HEAD'], repoRoot).stdout.trim();
  for (const subject of subjects) {
    commit(repoRoot, subject);
  }
  const currentRef = runGit(['rev-parse', 'HEAD'], repoRoot).stdout.trim();
  return { repoRoot, previousRef, currentRef };
}

function writeReleaseNoteManifests(root) {
  const manifestPath = path.join(root, 'full-package-manifest.json');
  const previousManifestPath = path.join(root, 'previous-full-package-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    components: {
      opl: { git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      codex: { version: 'codex-cli 0.130.0' },
      mas: { git_commit: '1111111111111111111111111111111111111111' },
      mag: { git_commit: '2222222222222222222222222222222222222222' },
      rca: { git_commit: '3333333333333333333333333333333333333333' },
      meta_agent: { git_commit: '4444444444444444444444444444444444444444' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
    },
  }, null, 2)}\n`);
  fs.writeFileSync(previousManifestPath, `${JSON.stringify({
    components: {
      opl: { git_commit: '0000000000000000000000000000000000000000' },
      codex: { version: 'codex-cli 0.129.0' },
      mas: { git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      mag: { git_commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      rca: { git_commit: 'cccccccccccccccccccccccccccccccccccccccc' },
      meta_agent: { git_commit: 'dddddddddddddddddddddddddddddddddddddddd' },
      officecli: { version: '1.2.2' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.2' },
    },
  }, null, 2)}\n`);
  return { manifestPath, previousManifestPath };
}

function writeFakeAiWriter(scriptPath, body) {
  fs.writeFileSync(scriptPath, `#!/usr/bin/env node
const fs = require('node:fs');
const input = fs.readFileSync(0, 'utf8');
if (!input.includes('"release_evidence"')) {
  console.error('missing release evidence input');
  process.exit(2);
}
process.stdout.write(${JSON.stringify(body)});
`, { mode: 0o755 });
}

function sampleAiEvidence(version = '26.6.1') {
  return {
    schema: 'opl_app_release_notes_evidence.v1',
    version,
    channel: 'stable',
    release_repo: 'gaofeng21cn/one-person-lab-app',
    current_tag: `v${version}`,
    previous_tag: 'v26.5.31',
    app_commit_subjects: [],
    shell_commit_subjects: [],
    grouped_changes: [],
    payload: {
      include_full_package: false,
      lines: [
        'Standard macOS arm64 updater package with App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin/skill sync policy.',
      ],
      bundled_refs: [],
      updates_since_previous_stable: [],
    },
    agent_runtime_changes: [],
    release_scope: 'Standard macOS arm64 updater package.',
    full_changelog_url: null,
  };
}

function validAiMarkdown(version: string, lead: string) {
  return `One Person Lab ${version}

${lead} makes the built-in OPL entries ready to use sooner for users upgrading the App.

## What improved
- MAS, MAG, and RCA entry surfaces now open with clearer App-managed setup context, so users can start from the intended OPL agent surface after first launch.

## OPL agents and runtime payload
- MAS, MAG, RCA, and OPL Meta Agent remain exposed through the standard App package with Codex plugin and skill sync policy.

## Release scope
- Standard macOS arm64 updater package.
`;
}

function writeExecutable(scriptPath: string, body: string) {
  fs.writeFileSync(scriptPath, body, { mode: 0o755 });
}

function withTemporaryEnv(env: Record<string, string | undefined>, callback: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(env)) {
    previous.set(key, process.env[key]);
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }
  try {
    callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('stable release notes compare against the previous stable and omit fixed boilerplate sections', () => {
  const shellRoot = createShellHistory();
  const { manifestPath, previousManifestPath } = writeReleaseNoteManifests(shellRoot);
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
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /One Person Lab 26\.5\.31/);
  assert.match(result.stdout, /This Stable release focuses on changes since v26\.5\.28\./);
  assert.match(result.stdout, /OPL agents and runtime payload/);
  assert.match(result.stdout, /Full clean-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills\./);
  assert.match(result.stdout, /Build-time payload refs:/);
  assert.match(result.stdout, /Payload updates since previous Stable:/);
  assert.match(result.stdout, /OPL Framework 0000000 -> aaaaaaa/);
  assert.match(result.stdout, /Codex CLI 0\.129\.0 -> 0\.130\.0/);
  assert.match(result.stdout, /MAS aaaaaaa -> 1111111/);
  assert.match(result.stdout, /MAG bbbbbbb -> 2222222/);
  assert.match(result.stdout, /RCA ccccccc -> 3333333/);
  assert.match(result.stdout, /OPL Meta Agent ddddddd -> 4444444/);
  assert.match(result.stdout, /OfficeCLI 1\.2\.2 -> 1\.2\.3/);
  assert.match(result.stdout, /MinerU v0\.1\.2 -> v0\.1\.3/);
  assert.match(result.stdout, /OPL Framework @ aaaaaaa/);
  assert.match(result.stdout, /Codex CLI 0\.130\.0/);
  assert.match(result.stdout, /MAS @ 1111111/);
  assert.match(result.stdout, /MAG @ 2222222/);
  assert.match(result.stdout, /RCA @ 3333333/);
  assert.match(result.stdout, /OPL Meta Agent @ 4444444/);
  assert.match(result.stdout, /OfficeCLI 1\.2\.3/);
  assert.match(result.stdout, /MinerU v0\.1\.3/);
  assert.match(result.stdout, /First-run and agent readiness/);
  assert.match(result.stdout, /Improved first-run readiness/);
  assert.match(result.stdout, /OPL agents and Codex skills/);
  assert.match(result.stdout, /Shipped the App with the current MAS research workflow, MAG grant workflow, RCA visual-deliverable workflow, OPL Meta Agent, Framework runtime, and companion tools captured at build time\./);
  assert.match(result.stdout, /Packaging and installation validation/);
  assert.match(result.stdout, /User guidance/);
  assert.doesNotMatch(result.stdout, /Release focus/);
  assert.doesNotMatch(result.stdout, /Update channel guidance/);
  assert.doesNotMatch(result.stdout, /Full first-install package/);
  assert.doesNotMatch(result.stdout, /Bundled OPL runtime and agent versions/);
  assert.doesNotMatch(result.stdout, /[\u3400-\u9fff]/);
  assert.doesNotMatch(result.stdout, /Change log\n(?:- .+\n){5,}/);
});

test('release-note evidence includes concrete Full payload agent runtime changes from local source repos', () => {
  const mas = createPayloadHistory([
    'feat(study): show controller closeout summaries in study workspaces',
    'fix(evidence): make research blocker messages actionable',
  ]);
  const mag = createPayloadHistory([
    'feat(grant): add reviewer-ready funding brief outline',
  ]);
  const rca = createPayloadHistory([
    'feat(slides): improve visual deliverable export checks',
  ]);
  const framework = createPayloadHistory([
    'fix(runtime): align app action receipts with packaged runtime state',
  ]);
  const manifest = {
    components: {
      opl: { source_path: framework.repoRoot, git_commit: framework.currentRef },
      codex: { version: 'codex-cli 0.130.0' },
      mas: { source_path: mas.repoRoot, git_commit: mas.currentRef },
      mag: { source_path: mag.repoRoot, git_commit: mag.currentRef },
      rca: { source_path: rca.repoRoot, git_commit: rca.currentRef },
      meta_agent: { git_commit: '4444444444444444444444444444444444444444' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
    },
  };
  const previousManifest = {
    components: {
      opl: { source_path: framework.repoRoot, git_commit: framework.previousRef },
      codex: { version: 'codex-cli 0.129.0' },
      mas: { source_path: mas.repoRoot, git_commit: mas.previousRef },
      mag: { source_path: mag.repoRoot, git_commit: mag.previousRef },
      rca: { source_path: rca.repoRoot, git_commit: rca.previousRef },
      meta_agent: { git_commit: 'dddddddddddddddddddddddddddddddddddddddd' },
      officecli: { version: '1.2.2' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.2' },
    },
  };

  const evidence = buildReleaseNotesEvidence({
    version: '26.6.1',
    channel: 'stable',
    releaseRepo: 'gaofeng21cn/one-person-lab-app',
    includeFullPackage: true,
    fullPackageManifest: manifest,
    previousFullPackageManifest: previousManifest,
    previousTag: 'v26.5.31',
    currentTag: 'v26.6.1',
    previousAppRef: 'HEAD',
    currentAppRef: 'HEAD',
  });

  const masChange = evidence.agent_runtime_changes.find((change) => change.label === 'MAS');
  const magChange = evidence.agent_runtime_changes.find((change) => change.label === 'MAG');
  const rcaChange = evidence.agent_runtime_changes.find((change) => change.label === 'RCA');
  const frameworkChange = evidence.agent_runtime_changes.find((change) => change.label === 'OPL Framework');
  assert.ok(masChange);
  assert.ok(magChange);
  assert.ok(rcaChange);
  assert.ok(frameworkChange);
  assert.equal(masChange.role, 'research automation and study workflow agent');
  assert.match(masChange.user_value_hint, /research/i);
  assert.match(masChange.change_summary_hint, /route-back/i);
  assert.match(magChange.change_summary_hint, /progress-first owner payloads/i);
  assert.match(rcaChange.change_summary_hint, /visual deliverable/i);
  assert.match(frameworkChange.change_summary_hint, /runtime state/i);
  assert.deepEqual(masChange.change_subjects, [
    'fix(evidence): make research blocker messages actionable',
    'feat(study): show controller closeout summaries in study workspaces',
  ]);
  assert.deepEqual(magChange.change_subjects, [
    'feat(grant): add reviewer-ready funding brief outline',
  ]);
  assert.deepEqual(rcaChange.change_subjects, [
    'feat(slides): improve visual deliverable export checks',
  ]);
  assert.deepEqual(frameworkChange.change_subjects, [
    'fix(runtime): align app action receipts with packaged runtime state',
  ]);
  assert.match(masChange.audit_ref, /^MAS @ [a-f0-9]{7}$/);
  assert.equal(evidence.payload.updates_since_previous_stable.length, 8);
});

test('stable release notes describe only the Full payload components present in historical manifests', () => {
  const shellRoot = createShellHistory();
  const manifestPath = path.join(shellRoot, 'historical-full-package-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    components: {
      opl: { git_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      codex: { version: 'codex-cli 0.130.0' },
      mas: { git_commit: '1111111111111111111111111111111111111111' },
      mag: { git_commit: '2222222222222222222222222222222222222222' },
      rca: { git_commit: '3333333333333333333333333333333333333333' },
      officecli: { version: '1.2.3' },
    },
  }, null, 2)}\n`);

  const result = runNode([
    'scripts/generate-release-notes.ts',
    '--version',
    '26.5.18',
    '--channel',
    'stable',
    '--previous-tag',
    'v26.5.17',
    '--current-tag',
    'v26.5.18',
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
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Full clean-install DMG payload recorded in this release manifest: OPL Framework, Codex CLI, MAS, MAG, RCA, OfficeCLI, plus packaged Codex skills where present\./);
  assert.doesNotMatch(result.stdout, /OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills\./);
  assert.doesNotMatch(result.stdout, /MinerU/);
  assert.doesNotMatch(result.stdout, /[\u3400-\u9fff]/);
});

test('nightly release notes compare against the previous nightly and explain the main changes', () => {
  const shellRoot = createShellHistory();
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
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /One Person Lab 26\.5\.31-nightly/);
  assert.match(result.stdout, /Nightly/);
  assert.match(result.stdout, /This Nightly prerelease focuses on changes since v26\.5\.30-nightly\./);
  assert.match(result.stdout, /OPL agents and runtime payload/);
  assert.match(result.stdout, /Nightly standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin\/skill sync policy\./);
  assert.match(result.stdout, /Full runtime payloads for MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, and MinerU stay out of the Nightly channel/);
  assert.match(result.stdout, /First-run and agent readiness/);
  assert.match(result.stdout, /Standard macOS arm64 Nightly package and updater metadata; no Full clean-install DMG in the Nightly channel\./);
  assert.match(result.stdout, /OPL agents and Codex skills/);
  assert.match(result.stdout, /Kept the standard App package aligned with MAS, MAG, RCA, and OPL Meta Agent entry points plus the Codex plugin and skill sync surface\./);
  assert.doesNotMatch(result.stdout, /Full first-install package/);
  assert.doesNotMatch(result.stdout, /Bundled OPL runtime and agent versions/);
  assert.doesNotMatch(result.stdout, /[\u3400-\u9fff]/);
  assert.doesNotMatch(result.stdout, /This prerelease is for users/);
});

test('AI-first release notes use provider output, evidence input, and human-readable improvement copy', () => {
  const shellRoot = createShellHistory();
  const { manifestPath, previousManifestPath } = writeReleaseNoteManifests(shellRoot);
  const fakeAi = path.join(shellRoot, 'fake-release-notes-ai.js');
  writeFakeAiWriter(fakeAi, `One Person Lab 26.5.31

This Stable release is about making a clean OPL install more useful immediately: the App now ships a newer OPL Framework runtime, refreshed MAS/MAG/RCA domain agents, the OPL Meta Agent, Codex CLI, OfficeCLI, MinerU, and the packaged Codex skills needed for those entries to work after first launch.

## What improved

### Packaged OPL agents are fresher at first launch
- MAS, MAG, RCA, and OPL Meta Agent were refreshed from the Full package manifest, so a new Full install starts with newer research, grant-writing, visual-deliverable, and meta-agent surfaces instead of asking users to reconcile those modules after setup.
- The packaged Codex skill/plugin surface was refreshed together with those agents, so the built-in OPL entries open with the expected domain skill context.

### First-run setup is easier for new users
- The first-run path was simplified around the App-managed setup surface, making it clearer when the OPL agents are ready to use and reducing setup noise before the user reaches the main workspace.

### Installation proof is stronger
- Stable validation keeps the standard DMG, Full DMG, one-shot installer, and Docker/WebUI paths separated, so release failures point to the user install path that actually needs attention.

## OPL agents and runtime payload
- Full clean-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.
- Build-time payload refs: OPL Framework @ aaaaaaa; Codex CLI 0.130.0; MAS @ 1111111; MAG @ 2222222; RCA @ 3333333; OPL Meta Agent @ 4444444; OfficeCLI 1.2.3; MinerU v0.1.3.
- Payload updates since previous Stable: OPL Framework 0000000 -> aaaaaaa; Codex CLI 0.129.0 -> 0.130.0; MAS aaaaaaa -> 1111111; MAG bbbbbbb -> 2222222; RCA ccccccc -> 3333333; OPL Meta Agent ddddddd -> 4444444; OfficeCLI 1.2.2 -> 1.2.3; MinerU v0.1.2 -> v0.1.3.

## Release scope
- Standard macOS arm64 updater package plus Full clean-install DMG.

**Full Changelog**: https://github.com/gaofeng21cn/one-person-lab-app/compare/v26.5.28...v26.5.31
`);
  const result = runNode([
    'scripts/generate-release-notes.ts',
    '--ai',
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
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /making a clean OPL install more useful immediately/);
  assert.match(result.stdout, /Packaged OPL agents are fresher at first launch/);
  assert.match(result.stdout, /research, grant-writing, visual-deliverable, and meta-agent surfaces/);
  assert.match(result.stdout, /OPL agents and runtime payload/);
  assert.doesNotMatch(result.stdout, /Strengthened package builds/);
  assert.doesNotMatch(result.stdout, /Updated the OPL App package with the current/);
  assert.doesNotMatch(result.stdout, /[\u3400-\u9fff]/);
});

test('AI-first release notes reject vague provider output before publishing', () => {
  const shellRoot = createShellHistory();
  const { manifestPath, previousManifestPath } = writeReleaseNoteManifests(shellRoot);
  const fakeAi = path.join(shellRoot, 'fake-vague-release-notes-ai.js');
  writeFakeAiWriter(fakeAi, `One Person Lab 26.5.31

This Stable release focuses on changes since v26.5.28.

## OPL agents and runtime payload
- Full clean-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.
- Build-time payload refs: OPL Framework @ aaaaaaa; Codex CLI 0.130.0; MAS @ 1111111; MAG @ 2222222; RCA @ 3333333; OPL Meta Agent @ 4444444; OfficeCLI 1.2.3; MinerU v0.1.3.

## What changed
- Strengthened package builds, updater metadata, VM first-run checks, and release validation for OPL App installs.
- Updated the OPL App package with the current MAS, MAG, RCA, OPL Meta Agent, Framework runtime, and companion tool payloads captured at build time.

## Release scope
- Standard macOS arm64 updater package plus Full clean-install DMG.
`);
  const result = runNode([
    'scripts/generate-release-notes.ts',
    '--ai',
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
      OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fakeAi}`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AI release notes failed quality gate/);
  assert.match(result.stderr, /vague/);
});

test('AI-first release notes reject self-referential or process-first output', () => {
  const evidence = {
    ...sampleAiEvidence('26.6.3'),
    payload: {
      include_full_package: true,
      lines: [
        '- Full clean-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.',
        '- Build-time payload refs: OPL Framework @ aaaaaaa; Codex CLI 0.130.0; MAS @ 1111111; MAG @ 2222222; RCA @ 3333333; OPL Meta Agent @ 4444444; OfficeCLI 1.2.3; MinerU v0.1.3.',
      ],
      bundled_refs: [
        'OPL Framework @ aaaaaaa',
        'Codex CLI 0.130.0',
        'MAS @ 1111111',
        'MAG @ 2222222',
        'RCA @ 3333333',
        'OPL Meta Agent @ 4444444',
        'OfficeCLI 1.2.3',
        'MinerU v0.1.3',
      ],
      updates_since_previous_stable: [],
    },
    agent_runtime_changes: [
      {
        label: 'MAS',
        component: 'mas',
        role: 'research automation and study workflow agent',
        previous_ref: 'aaaaaaa',
        current_ref: '1111111',
        audit_ref: 'MAS @ 1111111',
        change_subjects: ['feat(study): show controller closeout summaries in study workspaces'],
        user_value_hint: 'Helps users run research and study workflows with clearer next steps.',
      },
      {
        label: 'MAG',
        component: 'mag',
        role: 'grant-writing and funding workflow agent',
        previous_ref: 'bbbbbbb',
        current_ref: '2222222',
        audit_ref: 'MAG @ 2222222',
        change_subjects: ['feat(grant): add reviewer-ready funding brief outline'],
        user_value_hint: 'Helps users turn project context into clearer grant-writing material.',
      },
      {
        label: 'RCA',
        component: 'rca',
        role: 'visual deliverable, slide, and report graphics agent',
        previous_ref: 'ccccccc',
        current_ref: '3333333',
        audit_ref: 'RCA @ 3333333',
        change_subjects: ['feat(slides): improve visual deliverable export checks'],
        user_value_hint: 'Helps users prepare visual deliverables with fewer manual checks.',
      },
    ],
  };
  const markdown = `One Person Lab 26.6.3

Release notes are now generated by an AI workflow with machine-checkable contracts, CI validation, and better release-note quality.

## What improved
- CI workflow validation and release readiness contracts are gated more consistently.

## OPL agents and runtime payload
- Full clean-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.
- Build-time payload refs: OPL Framework @ aaaaaaa; Codex CLI 0.130.0; MAS @ 1111111; MAG @ 2222222; RCA @ 3333333; OPL Meta Agent @ 4444444; OfficeCLI 1.2.3; MinerU v0.1.3.

## Release scope
- Standard macOS arm64 updater package plus Full clean-install DMG.
`;

  assert.throws(
    () => validateAiReleaseNotes(markdown, evidence as any),
    /self-referential release-note copy|opening paragraph is process-first/,
  );
});

test('AI-first release notes reject role-only payload copy when concrete runtime changes are available', () => {
  const evidence = {
    ...sampleAiEvidence('26.6.4'),
    payload: {
      include_full_package: true,
      lines: [
        '- Full clean-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.',
        '- Build-time payload refs: OPL Framework @ aaaaaaa; Codex CLI 0.130.0; MAS @ 1111111; MAG @ 2222222; RCA @ 3333333; OPL Meta Agent @ 4444444; OfficeCLI 1.2.3; MinerU v0.1.3.',
      ],
      bundled_refs: [
        'OPL Framework @ aaaaaaa',
        'Codex CLI 0.130.0',
        'MAS @ 1111111',
        'MAG @ 2222222',
        'RCA @ 3333333',
        'OPL Meta Agent @ 4444444',
        'OfficeCLI 1.2.3',
        'MinerU v0.1.3',
      ],
      updates_since_previous_stable: [],
    },
    agent_runtime_changes: [
      {
        label: 'MAS',
        component: 'mas',
        role: 'research automation and study workflow agent',
        previous_ref: 'aaaaaaa',
        current_ref: '1111111',
        audit_ref: 'MAS @ 1111111',
        change_subjects: ['fix(progress): enforce currentness and closeout handoff semantics'],
        user_value_hint: 'Helps users run research and study workflows with clearer evidence, blockers, and next steps.',
        change_summary_hint: 'Research workflows carry clearer currentness checks and closeout handoffs.',
      },
      {
        label: 'MAG',
        component: 'mag',
        role: 'grant-writing and funding workflow agent',
        previous_ref: 'bbbbbbb',
        current_ref: '2222222',
        audit_ref: 'MAG @ 2222222',
        change_subjects: ['fix(progress): expose MAG progress-first owner payloads'],
        user_value_hint: 'Helps users turn project context into clearer grant-writing material.',
        change_summary_hint: 'Grant workflows expose progress-first owner payloads for clearer next-step context.',
      },
      {
        label: 'RCA',
        component: 'rca',
        role: 'visual deliverable, slide, and report graphics agent',
        previous_ref: 'ccccccc',
        current_ref: '3333333',
        audit_ref: 'RCA @ 3333333',
        change_subjects: ['feat(opl): require RCA provider currentness evidence'],
        user_value_hint: 'Helps users prepare visual deliverables with fewer manual checks.',
        change_summary_hint: 'Visual deliverable workflows record provider currentness evidence before users rely on generated slides or graphics.',
      },
    ],
  };
  const markdown = `One Person Lab 26.6.4

This upgrade helps users open the built-in OPL agents and start research, grant, and visual deliverable work from a clean install.

## What improved
- MAS helps with research workflows, MAG helps with grant work, and RCA helps with visual deliverables.

## OPL agents and runtime payload
- MAS helps with research workflows.
- MAG helps turn project context into grant materials.
- RCA helps prepare visual deliverables and slides.
- Full clean-install DMG payload: OPL Framework runtime, Codex CLI, MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, MinerU, and packaged Codex skills.
- Build-time payload refs: OPL Framework @ aaaaaaa; Codex CLI 0.130.0; MAS @ 1111111; MAG @ 2222222; RCA @ 3333333; OPL Meta Agent @ 4444444; OfficeCLI 1.2.3; MinerU v0.1.3.

## Release scope
- Standard macOS arm64 updater package plus Full clean-install DMG.
`;

  assert.throws(
    () => validateAiReleaseNotes(markdown, evidence as any),
    /missing concrete runtime change detail/,
  );
});

test('AI-first release notes require opening user benefit paragraph and normal payload bullets', () => {
  const evidence = {
    ...sampleAiEvidence('26.6.5'),
    channel: 'nightly',
    payload: {
      include_full_package: false,
      lines: [
        '- Nightly standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin/skill sync policy.',
        '- Full runtime payloads for MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, and MinerU stay out of the Nightly channel and remain Stable/Full-release material.',
      ],
      bundled_refs: [],
      updates_since_previous_stable: [],
    },
    release_scope: 'Standard macOS arm64 Nightly package and updater metadata; no Full clean-install DMG in the Nightly channel.',
  };
  const markdown = `One Person Lab 26.6.5

## What improved
After upgrading, users can open MAS, MAG, RCA, and OPL Meta Agent from the standard Nightly App package.

## OPL agents and runtime payload
> - Nightly standard package: App-managed MAS, MAG, RCA, and OPL Meta Agent entry surface plus Codex plugin/skill sync policy.
> - Full runtime payloads for MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, and MinerU stay out of the Nightly channel and remain Stable/Full-release material.

## Release scope
- Standard macOS arm64 Nightly package and updater metadata; no Full clean-install DMG in the Nightly channel.
`;

  assert.throws(
    () => validateAiReleaseNotes(markdown, evidence as any),
    /missing opening user benefit paragraph before sections|payload lines formatted as blockquotes/,
  );
});

test('AI-first release notes prefer GitHub Models when it returns valid Markdown', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-github-models-'));
  const fakeGh = path.join(tempRoot, 'gh');
  const fakeCurl = path.join(tempRoot, 'curl');
  const fallback = path.join(tempRoot, 'fallback.js');
  const fallbackMarker = path.join(tempRoot, 'fallback-called');
  writeExecutable(fakeCurl, `#!/bin/sh
python3 -c 'import json,sys; prompt=sys.stdin.read(); json.dump({"choices":[{"message":{"content":${JSON.stringify(validAiMarkdown('26.6.1', 'The App upgrade'))}}}]}, sys.stdout)'
`);
  writeExecutable(fakeGh, '#!/bin/sh\nexit 2\n');
  writeExecutable(fallback, `#!/usr/bin/env node
require('node:fs').writeFileSync(${JSON.stringify(fallbackMarker)}, 'called');
process.stdout.write(${JSON.stringify(validAiMarkdown('26.6.1', 'The App fallback path'))});
`);

  withTemporaryEnv({
    PATH: `${tempRoot}:${process.env.PATH}`,
    GITHUB_TOKEN: 'github-token',
    OPL_RELEASE_NOTES_PROVIDER: 'auto',
    OPL_RELEASE_NOTES_GITHUB_MODEL: 'openai/gpt-5-mini',
    OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fallback}`,
  }, () => {
    const markdown = buildAiReleaseNotesDocument(sampleAiEvidence('26.6.1') as any);
    assert.match(markdown, /The App upgrade/);
    assert.equal(fs.existsSync(fallbackMarker), false);
  });
});

test('AI-first release notes fall back to Codex provider when GitHub Models fails', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-github-models-fallback-'));
  const fakeGh = path.join(tempRoot, 'gh');
  const fakeCurl = path.join(tempRoot, 'curl');
  const fallback = path.join(tempRoot, 'fallback.js');
  const fallbackMarker = path.join(tempRoot, 'fallback-called');
  writeExecutable(fakeCurl, `#!/bin/sh
echo "rate limited" >&2
exit 1
`);
  writeExecutable(fakeGh, '#!/bin/sh\nexit 2\n');
  writeExecutable(fallback, `#!/usr/bin/env node
require('node:fs').writeFileSync(${JSON.stringify(fallbackMarker)}, 'called');
process.stdout.write(${JSON.stringify(validAiMarkdown('26.6.2', 'The App fallback path'))});
`);

  withTemporaryEnv({
    PATH: `${tempRoot}:${process.env.PATH}`,
    GITHUB_TOKEN: 'github-token',
    OPL_RELEASE_NOTES_PROVIDER: 'auto',
    OPL_RELEASE_NOTES_GITHUB_MODEL: 'openai/gpt-5-mini',
    OPL_RELEASE_NOTES_AI_COMMAND: `${process.execPath} ${fallback}`,
  }, () => {
    const markdown = buildAiReleaseNotesDocument(sampleAiEvidence('26.6.2') as any);
    assert.match(markdown, /The App fallback path/);
    assert.equal(fs.readFileSync(fallbackMarker, 'utf8'), 'called');
  });
});

test('release-note Codex CI config is generated from explicit provider settings', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-codex-home-'));
  const codexHome = path.join(tempRoot, 'codex-home');
  const githubEnv = path.join(tempRoot, 'github-env');
  const result = runNode(['scripts/setup-release-notes-codex-config.ts'], {
    env: {
      CODEX_HOME: codexHome,
      GITHUB_ENV: githubEnv,
      GITHUB_WORKSPACE: tempRoot,
      OPL_RELEASE_NOTES_CODEX_PROVIDER: 'gflab',
      OPL_RELEASE_NOTES_CODEX_BASE_URL: 'https://gflabtoken.cn/v1',
      OPL_RELEASE_NOTES_CODEX_API_KEY: 'test-secret',
      OPL_RELEASE_NOTES_CODEX_WIRE_API: 'responses',
      OPL_RELEASE_NOTES_MODEL: 'gpt-5.5',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const config = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
  assert.match(config, /model_provider = "gflab"/);
  assert.match(config, /model = "gpt-5\.5"/);
  assert.match(config, /\[model_providers\.gflab\]/);
  assert.match(config, /base_url = "https:\/\/gflabtoken\.cn\/v1"/);
  assert.match(config, /wire_api = "responses"/);
  assert.match(config, /experimental_bearer_token = "test-secret"/);
  assert.match(config, new RegExp(`\\[projects\\.${JSON.stringify(tempRoot).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`));
  assert.match(fs.readFileSync(githubEnv, 'utf8'), new RegExp(`CODEX_HOME=${codexHome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('release-note Codex CI config fails closed when provider credentials are absent', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-codex-missing-'));
  const result = runNode(['scripts/setup-release-notes-codex-config.ts'], {
    env: {
      CODEX_HOME: path.join(tempRoot, 'codex-home'),
      OPL_RELEASE_NOTES_CODEX_PROVIDER: 'gflab',
      OPL_RELEASE_NOTES_CODEX_BASE_URL: 'https://gflabtoken.cn/v1',
      OPL_RELEASE_NOTES_CODEX_API_KEY: '',
      OPL_RELEASE_NOTES_CODEX_WIRE_API: 'responses',
      OPL_RELEASE_NOTES_MODEL: 'gpt-5.5',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required OPL_RELEASE_NOTES_CODEX_API_KEY/);
});

test('release-note Codex CI config fails closed when the model is absent', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-notes-codex-model-missing-'));
  const result = runNode(['scripts/setup-release-notes-codex-config.ts'], {
    env: {
      CODEX_HOME: path.join(tempRoot, 'codex-home'),
      OPL_RELEASE_NOTES_CODEX_PROVIDER: 'gflab',
      OPL_RELEASE_NOTES_CODEX_BASE_URL: 'https://gflabtoken.cn/v1',
      OPL_RELEASE_NOTES_CODEX_API_KEY: 'test-secret',
      OPL_RELEASE_NOTES_CODEX_WIRE_API: 'responses',
      OPL_RELEASE_NOTES_MODEL: '',
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required OPL_RELEASE_NOTES_MODEL/);
});
