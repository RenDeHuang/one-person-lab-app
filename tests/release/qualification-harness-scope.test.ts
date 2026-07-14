import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildQualificationHarnessScopeProof,
  collectRemoteChangedPaths,
  validateQualificationHarnessScopeProof,
} from '../../scripts/qualification-harness-scope.ts';

const artifactAppSha = 'a'.repeat(40);
const verificationAppSha = 'b'.repeat(40);
const artifactShellSha = 'c'.repeat(40);
const verificationShellSha = 'd'.repeat(40);

test('qualification harness scope records exact base, head, and allowlisted changed paths', () => {
  const proof = buildQualificationHarnessScopeProof({
    artifactAppSha,
    verificationAppSha,
    appChangedPaths: [
      '.github/workflows/opl-first-run-vm.yml',
      'scripts/qualification-harness-scope.ts',
    ],
    artifactShellSha,
    verificationShellSha,
    shellChangedPaths: [
      'scripts/opl-first-run-vm-smoke.mjs',
      'tests/unit/opl-runtime/firstRunVmSmoke.test.ts',
    ],
  });

  assert.equal(proof.classification, 'smoke_or_validator_only');
  assert.equal(proof.app.base_sha, artifactAppSha);
  assert.equal(proof.app.head_sha, verificationAppSha);
  assert.equal(proof.shell.base_sha, artifactShellSha);
  assert.equal(proof.shell.head_sha, verificationShellSha);
  assert.deepEqual(validateQualificationHarnessScopeProof(proof, {
    artifactAppSha,
    verificationAppSha,
    artifactShellSha,
    verificationShellSha,
  }), []);
});

test('qualification harness scope rejects App product or runtime source changes', () => {
  assert.throws(
    () => buildQualificationHarnessScopeProof({
      artifactAppSha,
      verificationAppSha,
      appChangedPaths: ['src/modules/app-state.ts'],
      artifactShellSha,
      verificationShellSha: artifactShellSha,
      shellChangedPaths: [],
    }),
    /product\/runtime paths outside the allowlist: src\/modules\/app-state\.ts/,
  );
});

test('qualification harness scope rejects Shell product or runtime source changes', () => {
  assert.throws(
    () => buildQualificationHarnessScopeProof({
      artifactAppSha,
      verificationAppSha: artifactAppSha,
      appChangedPaths: [],
      artifactShellSha,
      verificationShellSha,
      shellChangedPaths: ['src/main/services/oplRuntime.ts'],
    }),
    /product\/runtime paths outside the allowlist: src\/main\/services\/oplRuntime\.ts/,
  );
});

test('qualification harness scope rejects SHA changes without changed paths', () => {
  assert.throws(
    () => buildQualificationHarnessScopeProof({
      artifactAppSha,
      verificationAppSha,
      appChangedPaths: [],
      artifactShellSha,
      verificationShellSha: artifactShellSha,
      shellChangedPaths: [],
    }),
    /SHA equality is inconsistent/,
  );
});

test('qualification harness scope validator rejects missing and tampered proof', () => {
  assert.deepEqual(validateQualificationHarnessScopeProof(undefined), [
    'qualification harness scope proof is missing or malformed',
  ]);
  const proof = buildQualificationHarnessScopeProof({
    artifactAppSha,
    verificationAppSha,
    appChangedPaths: ['.github/workflows/opl-first-run-vm.yml'],
    artifactShellSha,
    verificationShellSha: artifactShellSha,
    shellChangedPaths: [],
  });
  const tampered = structuredClone(proof);
  tampered.app.changed_paths = ['src/modules/app-state.ts'];
  assert.match(validateQualificationHarnessScopeProof(tampered).join('; '), /outside the allowlist/);
});

test('remote qualification diff disables rename detection so forbidden source paths stay visible', () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const changedPaths = collectRemoteChangedPaths(
    (command, args) => {
      calls.push({ command, args });
      return {
        status: 0,
        stdout: args[0] === 'diff' ? '.github/workflows/opl-first-run-vm.yml\n' : '',
        stderr: '',
      };
    },
    'gaofeng21cn/one-person-lab-app',
    artifactAppSha,
    verificationAppSha,
  );

  assert.deepEqual(changedPaths, ['.github/workflows/opl-first-run-vm.yml']);
  const diffCall = calls.find((call) => call.command === 'git' && call.args[0] === 'diff');
  assert.ok(diffCall);
  assert.ok(diffCall.args.includes('--no-renames'));
  assert.ok(diffCall.args.includes('--name-only'));
});
