import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import {
  type CommandRunner,
  verifyGithubReleaseAdminCredential,
} from '../../scripts/verify-github-release-admin-credential.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');
const token = 'github_pat_fixture_secret_must_not_be_persisted';
const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'gaofeng21cn/one-person-lab-app',
  GITHUB_WORKFLOW_REF:
    'gaofeng21cn/one-person-lab-app/.github/workflows/release-github-admin-credentials-preflight.yml@refs/heads/main',
  GITHUB_RUN_ID: '30871746654',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: 'd'.repeat(40),
  OPL_GITHUB_RELEASE_ADMIN_TOKEN: token,
};

function outputPath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'opl-github-admin-preflight-')), 'receipt.json');
}

test('credential preflight performs one fixed authenticated GET and persists only sanitized capability fields', () => {
  const calls: Array<{ command: string; args: string[]; env: NodeJS.ProcessEnv; timeoutMs: number }> = [];
  const runner: CommandRunner = (command, args, options) => {
    calls.push({ command, args, ...options });
    return {
      status: 0,
      stdout: JSON.stringify({ enabled: true, enforced_by_owner: false, ignored: token }),
      stderr: '',
    };
  };
  const output = outputPath();
  const receipt = verifyGithubReleaseAdminCredential({
    outputPath: output,
    env,
    runner,
    observedAt: '2026-08-04T03:00:00.000Z',
  });

  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.credential_status, 'usable');
  assert.deepEqual(receipt.setting, { enabled: true, enforced_by_owner: false });
  assert.deepEqual(receipt.authority, {
    diagnostic_only: true,
    release_authority: false,
    repository_setting_mutation_authorized: false,
    release_mutation_authorized: false,
    dispatch_rerun_cancel_authorized: false,
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, [
    'api',
    '--method',
    'GET',
    'repos/gaofeng21cn/one-person-lab-app/immutable-releases',
    '-H',
    'X-GitHub-Api-Version: 2026-03-10',
  ]);
  assert.equal(calls[0].env.GH_TOKEN, token);
  assert.equal(calls[0].env.OPL_GITHUB_RELEASE_ADMIN_TOKEN, undefined);
  assert.equal(calls[0].timeoutMs, 30_000);
  const persisted = fs.readFileSync(output, 'utf8');
  assert.doesNotMatch(persisted, new RegExp(token));
  assert.doesNotMatch(persisted, /ignored/);
  assert.equal(fs.statSync(output).mode & 0o777, 0o600);
});

test('401 and unsafe-setting failures are typed without persisting raw GitHub output', () => {
  for (const fixture of [
    {
      result: { status: 1, stdout: '', stderr: `gh: Bad credentials ${token} (HTTP 401)` },
      code: 'github_release_admin_credential_rejected',
      httpStatus: 401,
    },
    {
      result: { status: 0, stdout: JSON.stringify({ enabled: false, enforced_by_owner: false }), stderr: '' },
      code: 'repository_immutability_setting_not_safe',
      httpStatus: 200,
    },
  ]) {
    const output = outputPath();
    const receipt = verifyGithubReleaseAdminCredential({
      outputPath: output,
      env,
      runner: () => fixture.result,
    });
    assert.equal(receipt.status, 'failed');
    assert.equal(receipt.failure.code, fixture.code);
    assert.equal(receipt.failure.http_status, fixture.httpStatus);
    const persisted = fs.readFileSync(output, 'utf8');
    assert.doesNotMatch(persisted, new RegExp(token));
    assert.doesNotMatch(persisted, /Bad credentials/);
  }
});

test('noncanonical or rerun execution fails before the protected credential is exercised', () => {
  for (const override of [
    { GITHUB_REF: 'refs/heads/feature' },
    { GITHUB_RUN_ATTEMPT: '2' },
    { GITHUB_EVENT_NAME: 'push' },
  ]) {
    let callCount = 0;
    const receipt = verifyGithubReleaseAdminCredential({
      outputPath: outputPath(),
      env: { ...env, ...override },
      runner: () => {
        callCount += 1;
        return { status: 0, stdout: '{}', stderr: '' };
      },
    });
    assert.equal(receipt.status, 'failed');
    assert.equal(callCount, 0);
  }
});

test('GitHub admin credential workflow is protected, first-attempt enforced, and mutation-free', () => {
  const workflowPath = path.join(
    appRoot,
    '.github/workflows/release-github-admin-credentials-preflight.yml',
  );
  const source = fs.readFileSync(workflowPath, 'utf8');
  const workflow = parseYaml(source) as Record<string, any>;
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['validate']);
  assert.equal(workflow.jobs.validate.environment, 'release-stable');
  assert.equal(workflow.jobs.validate['runs-on'], 'ubuntu-latest');
  assert.equal(workflow.jobs.validate['timeout-minutes'], 5);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const verify = workflow.jobs.validate.steps.find(
    (step: Record<string, unknown>) => step.name === 'Execute authenticated read-only immutable-release capability GET',
  );
  assert.equal(verify['continue-on-error'], true);
  assert.deepEqual(verify.env, {
    OPL_GITHUB_RELEASE_ADMIN_TOKEN: '${{ secrets.OPL_GITHUB_RELEASE_ADMIN_TOKEN }}',
  });
  assert.match(String(verify.run), /verify-github-release-admin-credential\.ts/);
  assert.match(source, /opl-github-release-admin-credential-preflight-\$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(
    source,
    /contents: write|actions: write|packages: write|--method (?:POST|PUT|PATCH|DELETE)|gh release|gh workflow run|gh run (?:rerun|cancel)|git push/,
  );
});

test('release contract requires the diagnostic before a successor after credential replacement', () => {
  const contract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts/app-release-channel.json'), 'utf8'),
  );
  assert.deepEqual(contract.release_preflight.github_release_admin_credentials_diagnostic, {
    schema: 'opl_app_github_release_admin_credential_preflight.v1',
    workflow: '.github/workflows/release-github-admin-credentials-preflight.yml',
    script: 'scripts/verify-github-release-admin-credential.ts',
    protected_environment: 'release-stable',
    secret_name: 'OPL_GITHUB_RELEASE_ADMIN_TOKEN',
    endpoint: 'GET repos/gaofeng21cn/one-person-lab-app/immutable-releases',
    authority: 'diagnostic_only',
    canonical_main_first_attempt_required: true,
    required_after_credential_replacement_before_new_stable_operation: true,
    raw_secret_response_or_error_persistence_allowed: false,
    repository_setting_mutation_allowed: false,
    release_or_dispatch_mutation_allowed: false,
  });
});
