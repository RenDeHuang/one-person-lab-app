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

test('stable release notes are English and include bundled OPL-family agent versions', () => {
  const shellRoot = createShellHistory();
  const manifestPath = path.join(shellRoot, 'full-package-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    components: {
      mas: { git_commit: '1111111111111111111111111111111111111111' },
      mag: { git_commit: '2222222222222222222222222222222222222222' },
      rca: { git_commit: '3333333333333333333333333333333333333333' },
      meta_agent: { git_commit: '4444444444444444444444444444444444444444' },
      officecli: { version: '1.2.3' },
      mineru_open_api: { version: 'mineru-open-api version v0.1.3' },
    },
  }, null, 2)}\n`);

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
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /One Person Lab 26\.5\.31/);
  assert.match(result.stdout, /This Stable release focuses on changes since v26\.5\.28\./);
  assert.match(result.stdout, /## Install Stable/);
  assert.match(
    result.stdout,
    /curl -fsSL https:\/\/raw\.githubusercontent\.com\/gaofeng21cn\/one-person-lab-app\/main\/install-stable\.sh \| bash/,
  );
  assert.match(result.stdout, /First-run setup/);
  assert.match(result.stdout, /Simplified the first-run setup flow/);
  assert.match(result.stdout, /OPL agent updates/);
  assert.match(result.stdout, /MAS @ 1111111/);
  assert.match(result.stdout, /MAG @ 2222222/);
  assert.match(result.stdout, /RCA @ 3333333/);
  assert.match(result.stdout, /OPL Meta Agent @ 4444444/);
  assert.match(result.stdout, /OfficeCLI 1\.2\.3/);
  assert.match(result.stdout, /MinerU v0\.1\.3/);
  assert.match(result.stdout, /Packaging, updates, and release validation/);
  assert.match(result.stdout, /Documentation/);
  assert.doesNotMatch(result.stdout, /Release focus/);
  assert.doesNotMatch(result.stdout, /Update channel guidance/);
  assert.doesNotMatch(result.stdout, /Full first-install package/);
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
  ]);

  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  assert.equal(evidence.schema, 'opl_app_release_notes_evidence.v1');
  assert.equal(evidence.version, '26.5.31-nightly');
  assert.equal(evidence.channel, 'nightly');
  assert.equal(
    evidence.release_scope,
    'Standard macOS arm64 Nightly package and updater metadata; no Full clean-install DMG in the Nightly channel.',
  );
  assert.match(result.stdout, /One Person Lab 26\.5\.31-nightly/);
  assert.match(result.stdout, /This Nightly prerelease focuses on changes since v26\.5\.30-nightly\./);
  assert.match(result.stdout, /First-run setup/);
  assert.match(result.stdout, /OPL agent updates/);
  assert.match(result.stdout, /Standard macOS arm64 Nightly package and updater metadata only/);
  assert.doesNotMatch(result.stdout, /Full first-install package/);
  assert.doesNotMatch(result.stdout, /[\u3400-\u9fff]/);
  assert.doesNotMatch(result.stdout, /This prerelease is for users/);
});
