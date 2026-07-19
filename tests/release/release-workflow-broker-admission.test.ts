import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import {
  isBrokerLookupOidcOnlyJob,
  stableReleaseActionPaths,
} from '../../scripts/validate-release-boundary/text-check-runner.ts';

const workflowRoot = path.join(process.cwd(), '.github', 'workflows');
const readWorkflow = (name: string) => fs.readFileSync(path.join(workflowRoot, name), 'utf8');
const count = (source: string, pattern: RegExp) => source.match(pattern)?.length ?? 0;
const jobBlock = (source: string, jobName: string) => {
  const start = source.indexOf(`  ${jobName}:\n`);
  assert.ok(start >= 0, `missing job ${jobName}`);
  const rest = source.slice(start + 1);
  const next = rest.search(/^  [a-z0-9][a-z0-9-]*:\n/m);
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
};

test('release workflows resolve broker admission once and reuse immutable historical validation', () => {
  const expectations = new Map([
    ['desktop-release.yml', { lookup: 0, dynamic: 1, historical: 6 }],
    ['desktop-release-promote.yml', { lookup: 0, dynamic: 1, historical: 2 }],
    ['desktop-release-full-addon.yml', { lookup: 1, dynamic: 0, historical: 3 }],
    ['opl-first-run-vm.yml', { lookup: 1, dynamic: 0, historical: 1 }],
  ]);

  for (const [name, expected] of expectations) {
    const source = readWorkflow(name);
    assert.equal(count(source, /--mode lookup/g), expected.lookup, `${name} lookup count`);
    assert.equal(count(source, /--mode "\$verifier_mode"/g), expected.dynamic, `${name} dynamic admission count`);
    assert.equal(count(source, /--mode historical/g), expected.historical, `${name} historical count`);
    assert.match(source, /opl-release-broker-admission-\$\{\{ github\.run_id \}\}/);
    assert.doesNotMatch(source, /verify-release-session-lease|verify-release-mutation-payload|release_mutation_payload_base64/);
  }
});

test('only broker lookup and attestation jobs receive GitHub OIDC permission', () => {
  const lookupJobs = new Map([
    ['desktop-release.yml', 'release-preflight'],
    ['desktop-release-promote.yml', 'prepare'],
    ['desktop-release-full-addon.yml', 'preflight'],
    ['opl-first-run-vm.yml', 'validate-vm-inputs'],
  ]);
  const expectedOidcCounts = new Map([
    ['desktop-release.yml', 2],
    ['desktop-release-promote.yml', 1],
    ['desktop-release-full-addon.yml', 2],
    ['opl-first-run-vm.yml', 1],
  ]);

  for (const [name, lookupJob] of lookupJobs) {
    const source = readWorkflow(name);
    const block = jobBlock(source, lookupJob);
    assert.match(block, /permissions:\n      contents: read\n      actions: read\n      id-token: write/);
    assert.match(block, /--mode (?:lookup|"\$verifier_mode")/);
    assert.equal(count(source, /id-token: write/g), expectedOidcCounts.get(name), `${name} OIDC permission count`);
  }
});

test('OIDC lookup-only classification is strict and rejects hidden mutation authority', () => {
  const lookupJobs = new Map([
    ['desktop-release.yml', 'release-preflight'],
    ['desktop-release-promote.yml', 'prepare'],
    ['desktop-release-full-addon.yml', 'preflight'],
    ['opl-first-run-vm.yml', 'validate-vm-inputs'],
  ]);
  for (const [name, jobId] of lookupJobs) {
    const workflow = parseYaml(readWorkflow(name));
    assert.equal(isBrokerLookupOidcOnlyJob(workflow.jobs[jobId]), true, `${name}/${jobId}`);
  }

  const workflow = parseYaml(readWorkflow('desktop-release.yml'));
  const baseline = workflow.jobs['release-preflight'];
  const clone = () => structuredClone(baseline);

  const extraWrite = clone();
  extraWrite.permissions.contents = 'write';
  assert.equal(isBrokerLookupOidcOnlyJob(extraWrite), false);

  const missingIdentityBinding = clone();
  const lookupStep = missingIdentityBinding.steps.find((step) => String(step.run ?? '').includes('verify-release-broker-acceptance.ts'));
  lookupStep.run = lookupStep.run.replace('--expected-workflow-sha "$GITHUB_SHA"', '');
  assert.equal(isBrokerLookupOidcOnlyJob(missingIdentityBinding), false);

  const hiddenMutation = clone();
  hiddenMutation.steps.push({ run: 'git push origin refs/tags/v1.0.0' });
  assert.equal(isBrokerLookupOidcOnlyJob(hiddenMutation), false);

  const arbitraryAction = clone();
  arbitraryAction.steps.push({ uses: 'example/opaque-action@0123456789012345678901234567890123456789' });
  assert.equal(isBrokerLookupOidcOnlyJob(arbitraryAction), false);
});

test('the complete Stable action DAG is pinned to immutable action commits', () => {
  for (const relativePath of stableReleaseActionPaths) {
    const document = parseYaml(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8'));
    const steps = relativePath.includes('/actions/')
      ? document.runs.steps
      : Object.values(document.jobs).flatMap((job) => job.steps ?? []);
    for (const step of steps) {
      if (typeof step.uses !== 'string' || step.uses.startsWith('./')) continue;
      assert.match(step.uses, /@[0-9a-f]{40}$/, `${relativePath}: ${step.uses}`);
    }
  }
  assert.match(
    fs.readFileSync(path.join(process.cwd(), '.github/actions/setup-active-shell-deps/action.yml'), 'utf8'),
    /bun-version: '1\.3\.14'/,
  );
});

test('promotion resume is derived only from the broker checkpoint authorization', () => {
  const source = readWorkflow('desktop-release-promote.yml');
  assert.match(source, /promotion_checkpoint_authorization/);
  assert.match(source, /source_promotion_attempt_id !== process\.env\.EXPECTED_ATTEMPT_ID/);
  assert.match(source, /first_unverified_checkpoint !== process\.env\.EXPECTED_RESUME/);
  assert.match(source, /resume_from_checkpoint=\$\{authorization\.first_unverified_checkpoint\}/);
  assert.match(source, /receipt_digests/);
});

test('reusable VM callers bind the outer mutation and cap Standard work to the absolute deadline', () => {
  const vm = readWorkflow('opl-first-run-vm.yml');
  for (const mapping of [
    'desktop-release.yml:desktop_release_dispatch',
    'desktop-release-promote.yml:promotion_dispatch',
    'desktop-release-full-addon.yml:full_addon_dispatch',
  ]) assert.match(vm, new RegExp(mapping.replace('.', '\\.')));
  assert.match(vm, /--expected-validation-sha256 "\$BROKER_ADMISSION_VALIDATION_SHA256"/);
  assert.match(vm, /deadline_ms - now_ms - evidence_reserve_ms/);
  assert.match(vm, /RUN_TIMEOUT_MS="\$\(cap_timeout "\$RUN_TIMEOUT_MS"\)"/);
  assert.match(vm, /CODEX_READINESS_PHASE_TIMEOUT_MS="\$\(cap_timeout "\$CODEX_READINESS_PHASE_TIMEOUT_MS"\)"/);
  assert.doesNotMatch(vm, /RELEASE_MUTATION" != "full_addon_dispatch/);
  assert.match(vm, /effective_deadline_at="\$FULL_ADDON_DEADLINE_AT"/);
  assert.match(vm, /Recalculate Full add-on budget before expensive smoke/);
  assert.match(vm, /steps\.full_smoke_budget\.outputs\.run_timeout_ms \|\| steps\.vm_timeouts\.outputs\.run_timeout_ms/);

  const full = readWorkflow('desktop-release-full-addon.yml');
  assert.match(full, /broker_admission_validation_sha256: \$\{\{ needs\.preflight\.outputs\.broker_admission_validation_sha256 \}\}/);
  assert.match(full, /full_addon_deadline_at: \$\{\{ needs\.preflight\.outputs\.full_addon_deadline_at \}\}/);
  assert.match(full, /release_mutation: full_addon_dispatch/);
  assert.match(full, /release_workflow: desktop-release-full-addon\.yml/);
});

test('Full add-on deadline and broker evidence reach the nested builder and VM without changing diagnostics', () => {
  const addon = readWorkflow('desktop-release-full-addon.yml');
  const builder = readWorkflow('full-first-install-release.yml');
  const vm = readWorkflow('opl-first-run-vm.yml');
  const diagnostics = readWorkflow('desktop-release-diagnostics.yml');

  assert.match(addon, /full_addon_deadline_at: \$\{\{ steps\.broker-admission\.outputs\.full_addon_deadline_at \}\}/);
  assert.equal(count(addon, /full_addon_deadline_at: \$\{\{ needs\.preflight\.outputs\.full_addon_deadline_at \}\}/g), 2);
  assert.equal(count(addon, /release_mutation_payload_sha256: \$\{\{ inputs\.release_mutation_payload_sha256 \}\}/g), 2);

  for (const input of ['full_addon_deadline_at', 'release_mutation_payload_sha256', 'broker_admission_validation_sha256']) {
    assert.match(builder, new RegExp(`${input}:`));
  }
  assert.match(builder, /Download immutable outer Full broker admission validation/);
  assert.match(builder, /--expected-run-id "\$GITHUB_RUN_ID"/);
  assert.match(builder, /--expected-run-attempt "\$GITHUB_RUN_ATTEMPT"/);
  assert.match(builder, /--expected-validation-sha256 "\$BROKER_ADMISSION_VALIDATION_SHA256"/);
  assert.match(builder, /validation\.full_addon_deadline_at !== deadline/);
  assert.match(builder, /timeout-minutes: \$\{\{ inputs\.release_mutation == 'full_addon_dispatch' && 50 \|\| 90 \}\}/);
  assert.match(builder, /const remainingMs = deadlineMs - nowMs - postBuildReserveMs/);
  assert.match(builder, /FULL_BUILD_TIMEOUT_MS="\$full_build_timeout_ms"/);

  assert.equal(count(vm, /^\s{6}full_addon_deadline_at:/gm), 2);
  assert.match(vm, /validation\.full_addon_deadline_at !== process\.env\.FULL_ADDON_DEADLINE_AT/);
  assert.match(vm, /timeout-minutes: \$\{\{ inputs\.release_mutation == 'full_addon_dispatch' && 50 \|\| 75 \}\}/);
  assert.match(vm, /full_addon_deadline_elapsed: expensive VM smoke cannot start/);

  assert.doesNotMatch(diagnostics, /full_addon_deadline_at|release_mutation: full_addon_dispatch/);
});

test('every Standard publication mutation rechecks the signed immutable deadline', () => {
  const publish = jobBlock(readWorkflow('desktop-release.yml'), 'publish-standard');
  assert.equal(count(publish, /--mode historical/g), 6);
  assert.equal(count(publish, /signed_lookup_envelope/g), 5);
  assert.equal(count(publish, /Date\.now\(\) >= deadlineMs/g), 5);
  assert.match(publish, /verify_standard_mutation_deadline "tag-push"\n\s+git push origin "\$tag"/);
  assert.match(publish, /verify_standard_mutation_deadline "tag-force-push"\n\s+git push --force-with-lease=/);
  assert.match(publish, /release-publish-historical-validation\.json[\s\S]*?Date\.now\(\) >= deadlineMs[\s\S]*?"\$\{publish_args\[@\]\}"/);
  assert.match(publish, /component-upload-historical-validation\.json[\s\S]*?Date\.now\(\) >= deadlineMs[\s\S]*?gh release upload/);
  assert.match(publish, /id: standard-asset-attestation-deadline[\s\S]*?authorized=true[\s\S]*?if: \$\{\{ steps\.standard-asset-attestation-deadline\.outputs\.authorized == 'true' \}\}/);
  assert.match(publish, /id: component-manifest-attestation-deadline[\s\S]*?authorized=true[\s\S]*?if: \$\{\{ steps\.component-manifest-attestation-deadline\.outputs\.authorized == 'true' \}\}/);
});
