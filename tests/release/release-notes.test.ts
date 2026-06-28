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
  assert.match(result.stdout, /This Stable release makes a new or upgraded OPL App install useful sooner/);
  assert.match(result.stdout, /## Install Stable/);
  assert.match(
    result.stdout,
    /curl -fsSL https:\/\/raw\.githubusercontent\.com\/gaofeng21cn\/one-person-lab-app\/main\/install\.sh \| bash -s -- --stable-macos-install --yes/,
  );
  assert.match(result.stdout, /First-run setup/);
  assert.match(result.stdout, /Simplified the first-run setup flow/);
  assert.match(result.stdout, /OPL agent updates/);
  assert.match(result.stdout, new RegExp(`MAS @ ${mas.currentRef.slice(0, 7)}`));
  assert.match(result.stdout, new RegExp(`MAG @ ${mag.currentRef.slice(0, 7)}`));
  assert.match(result.stdout, new RegExp(`RCA @ ${rca.currentRef.slice(0, 7)}`));
  assert.match(result.stdout, new RegExp(`OPL Meta Agent @ ${metaAgent.currentRef.slice(0, 7)}`));
  assert.match(result.stdout, /OfficeCLI 1\.2\.3/);
  assert.match(result.stdout, /MinerU v0\.1\.3/);
  assert.match(result.stdout, /## OPL family updates/);
  assert.match(result.stdout, /MAS: including .*route paper handoff receipts.*surface currentness blockers/);
  assert.match(result.stdout, /MAG: including expose progress first owner payloads/);
  assert.match(result.stdout, /RCA: including record operator evidence for visual deliverables/);
  assert.match(result.stdout, /OPL Meta Agent: including persist work order currentness gates/);
  assert.match(result.stdout, /OfficeCLI: refs 1\.2\.2 -> 1\.2\.3/);
  assert.match(result.stdout, /MinerU: refs v0\.1\.2 -> v0\.1\.3/);
  assert.match(result.stdout, /Packaging, updates, and release validation/);
  assert.match(result.stdout, /Documentation/);
  assert.doesNotMatch(result.stdout, /Release focus/);
  assert.doesNotMatch(result.stdout, /Update channel guidance/);
  assert.doesNotMatch(result.stdout, /Full clean-install/);
  assert.doesNotMatch(result.stdout, /[\u3400-\u9fff]/);
  assert.doesNotMatch(result.stdout, /Change log\n(?:- .+\n){5,}/);
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
  assert.match(result.stdout, /This Nightly prerelease lets users try the current standard App shell/);
  assert.match(result.stdout, /First-run setup/);
  assert.match(result.stdout, /OPL agent updates/);
  assert.match(result.stdout, /Standard macOS arm64 Nightly package and updater metadata only/);
  assert.doesNotMatch(result.stdout, /Full clean-install/);
  assert.doesNotMatch(result.stdout, /[\u3400-\u9fff]/);
  assert.doesNotMatch(result.stdout, /This prerelease is for users/);
});
