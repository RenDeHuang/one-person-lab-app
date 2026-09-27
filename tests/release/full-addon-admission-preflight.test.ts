import assert from 'node:assert/strict';
import test from 'node:test';

import { runFullAddonAdmissionPreflight } from '../../scripts/validate-full-addon-admission.ts';

const scholarSha = '10e9adf0f580670c75e499391a386fc7ea482166';
const appSha = 'c35ddda55f314438bb7cd999110221d23217c883';

function fakeGitRunner(command: string, args: string[]) {
  if (command === 'git' && args[0] === 'rev-parse') {
    return { status: 0, stdout: `${scholarSha}\n`, stderr: '' };
  }
  return { status: 0, stdout: '', stderr: '' };
}

test('Full admission preflight rejects malformed Scholar Skills refs before remote work', () => {
  assert.throws(() => runFullAddonAdmissionPreflight({
    masScholarSkillsRef: 'not-a-sha',
    artifactAppSha: appSha,
    verificationAppSha: appSha,
    artifactShellSha: appSha,
    verificationShellSha: appSha,
  }, fakeGitRunner), /mas_scholar_skills_ref must be an exact lowercase 40-character SHA/);
});

test('Full admission preflight accepts a reachable exact ref for an unchanged cohort', () => {
  const receipt = runFullAddonAdmissionPreflight({
    masScholarSkillsRef: scholarSha,
    artifactAppSha: appSha,
    verificationAppSha: appSha,
    artifactShellSha: appSha,
    verificationShellSha: appSha,
  }, fakeGitRunner);
  assert.deepEqual(receipt.checks, {
    mas_scholar_skills_ref: 'reachable_exact_commit',
    reusable_harness_scope: 'exact_cohort',
  });
  assert.equal(receipt.mas_scholar_skills_ref, scholarSha);
});

test('Full admission preflight rejects reuse when the verification harness changes product paths', () => {
  const verificationAppSha = 'd'.repeat(40);
  const runner = (command: string, args: string[]) => {
    if (command === 'git' && args[0] === 'rev-parse') {
      return { status: 0, stdout: `${scholarSha}\n`, stderr: '' };
    }
    if (command === 'git' && args[0] === 'show') {
      if (args[1].endsWith('app-shell-adapter.json')) {
        return {
          status: 0,
          stdout: JSON.stringify({
            active_shell: 'opl-studio',
            shell_source: { owner_repo: 'gaofeng21cn/opl-studio' },
          }),
          stderr: '',
        };
      }
      return {
        status: 0,
        stdout: JSON.stringify({
          profiles: { full: { semantic_digest: '1'.repeat(64), probe_digest: '2'.repeat(64) } },
        }),
        stderr: '',
      };
    }
    if (command === 'git' && args[0] === 'diff') {
      return { status: 0, stdout: 'src/modules/app-state.ts\n', stderr: '' };
    }
    return { status: 0, stdout: '', stderr: '' };
  };

  assert.throws(() => runFullAddonAdmissionPreflight({
    masScholarSkillsRef: scholarSha,
    artifactAppSha: appSha,
    verificationAppSha,
    artifactShellSha: appSha,
    verificationShellSha: appSha,
  }, runner), /Reusable Full qualification harness is not authorized: app_changed/);
});
