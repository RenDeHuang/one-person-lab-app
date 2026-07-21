import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildReleaseCohortPlan,
  parseReleaseCohortPlanArgs,
  writeReleaseCohortPlan,
  type ReleaseCohortPlanOptions,
} from '../../scripts/plan-release-cohort.ts';
import type { CommandRunner } from '../../scripts/release-cohort-lock.ts';
import { currentReleaseCalendarDate } from '../../scripts/release-version.ts';
import { appRoot, createGitCheckout, runGit } from './release-readiness/helpers.ts';

function options(root: string, overrides: Partial<ReleaseCohortPlanOptions> = {}): ReleaseCohortPlanOptions {
  const shell = createGitCheckout('opl-cohort-plan-shell-');
  const framework = createGitCheckout('opl-cohort-plan-framework-');
  return {
    version: '26.7.18',
    releaseMode: 'new_release',
    releaseIntent: 'stable_complete',
    fullOmissionReason: '',
    gateReusePlanRef: '',
    includeFullPackage: true,
    runVmSmoke: true,
    publishDockerWebui: true,
    appCommit: runGit(appRoot, ['rev-parse', 'HEAD']),
    shellRef: shell.head,
    frameworkRef: framework.head,
    shellRoot: shell.root,
    frameworkRoot: framework.root,
    output: path.join(root, 'release-cohort-plan.json'),
    markdown: path.join(root, 'release-cohort-plan.md'),
    ...overrides,
  };
}

function runner(canonicalMainSha: string): CommandRunner {
  return (_command, args) => {
    if (args[0] === 'rev-parse') {
      const candidate = (args.at(-1) ?? '').replace(/\^\{commit\}$/, '');
      return /^[0-9a-f]{40}$/i.test(candidate)
        ? { status: 0, stdout: `${candidate}\n`, stderr: '' }
        : { status: 1, stdout: '', stderr: `unexpected local ref ${candidate}` };
    }
    if (args[0] === 'ls-remote') {
      return { status: 0, stdout: `${canonicalMainSha}\trefs/heads/main\n`, stderr: '' };
    }
    if (args[0] === 'cat-file') return { status: 0, stdout: '', stderr: '' };
    return { status: 1, stdout: '', stderr: `unexpected command: ${args.join(' ')}` };
  };
}

test('retired cohort plan emits a Framework checkpoint read-only handoff without dispatch authority', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-cohort-plan-handle-'));
  const planOptions = options(root);
  const plan = buildReleaseCohortPlan(planOptions, runner(planOptions.appCommit), '2026-07-18T00:00:00.000Z');

  assert.equal(plan.lifecycle, 'retired_read_only_handoff');
  assert.equal('dispatch_handle' in plan, false);
  assert.equal(plan.next_action.action, 'framework_checkpoint_read_only_handoff');
  assert.equal(plan.next_action.command, 'opl release status --bundle <sha256:digest> --store <directory>');
  assert.equal(plan.next_action.operation, 'standard');
  assert.equal(plan.next_action.mutation_authorized, false);
  assert.equal(plan.next_action.manual_handoff_required, true);
  assert.equal(plan.authority_boundary.cohort_plan_can_start_release, false);
  assert.doesNotMatch(JSON.stringify(plan.next_action), /git push|gh api|gh workflow run|--execute|release:stable/);
  assert.equal(plan.cheap_gates.some((gate) => gate.id === 'release_cohort_lock'), false);
});

test('release cohort builder rejects future-dated versions before resolving cohort refs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-cohort-plan-future-'));
  const [year, month, day] = currentReleaseCalendarDate(
    'Asia/Shanghai',
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  ).split('-').map(Number);
  const planOptions = options(root, { version: `${year - 2000}.${month}.${day}` });
  let commandCount = 0;

  assert.throws(
    () => buildReleaseCohortPlan(planOptions, (...args) => {
      commandCount += 1;
      return runner(planOptions.appCommit)(...args);
    }),
    /future-dated/,
  );
  assert.equal(commandCount, 0);
});

test('release cohort plan passes Docker WebUI intent to every preflight gate', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-cohort-plan-preflight-'));
  const planOptions = options(root, { publishDockerWebui: false });
  const plan = buildReleaseCohortPlan(planOptions, runner(planOptions.appCommit));

  for (const gateId of ['release_preflight', 'vm_smoke_dependency_preflight']) {
    const gate = plan.cheap_gates.find(({ id }) => id === gateId);
    assert.ok(gate, `missing ${gateId}`);
    assert.match(gate.command, /--publish-docker-webui false(?:\s|$)/);
  }
});

test('release cohort source gate command enables the required shell admission checks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-cohort-plan-source-gate-'));
  const plan = buildReleaseCohortPlan(options(root), runner(runGit(appRoot, ['rev-parse', 'HEAD'])));
  const gate = plan.cheap_gates.find(({ id }) => id === 'release_source_gate');

  assert.ok(gate, 'missing release_source_gate');
  assert.match(gate.command, /--require-shell-format true/);
  assert.match(gate.command, /--run-shell-tests true/);
});

test('release cohort plan no longer resolves a live controller dispatch handle', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-cohort-plan-moved-'));
  const planOptions = options(root);
  const controllerSha = 'd'.repeat(40);
  let remoteLookupCount = 0;
  const baseRunner = runner(controllerSha);
  const plan = buildReleaseCohortPlan(planOptions, (command, args, commandOptions) => {
    if (args[0] === 'ls-remote') remoteLookupCount += 1;
    return baseRunner(command, args, commandOptions);
  });

  assert.equal(plan.cohort_lock.app.resolved_sha, planOptions.appCommit);
  assert.equal('dispatch_handle' in plan, false);
  assert.notEqual(controllerSha, plan.cohort_lock.app.resolved_sha);
  assert.equal(remoteLookupCount, 0);
});

test('release cohort plan rejects conflicting App aliases', () => {
  assert.throws(
    () => parseReleaseCohortPlanArgs([
      '--version', '26.7.18', '--release-mode', 'new_release',
      '--release-intent', 'stable_complete', '--include-full-package', 'true', '--run-vm-smoke', 'true',
      '--app-ref', 'a'.repeat(40), '--app-commit', 'b'.repeat(40),
      '--shell-ref', 'c'.repeat(40), '--framework-ref', 'd'.repeat(40),
    ]),
    /--app-ref and --app-commit disagree/,
  );
});

test('release cohort plan create-once write preserves exact bytes for the same identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-cohort-plan-idempotent-'));
  const planOptions = options(root);
  const first = buildReleaseCohortPlan(planOptions, runner(planOptions.appCommit), '2026-07-18T00:00:00.000Z');
  const second = buildReleaseCohortPlan(planOptions, runner(planOptions.appCommit), '2026-07-18T00:01:00.000Z');

  writeReleaseCohortPlan(planOptions, first);
  const firstBytes = fs.readFileSync(planOptions.output, 'utf8');
  const persisted = writeReleaseCohortPlan(planOptions, second);

  assert.equal(persisted.generated_at, first.generated_at);
  assert.equal(fs.readFileSync(planOptions.output, 'utf8'), firstBytes);
});

test('release cohort plan rejects identity mismatch without overwriting the existing plan', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-cohort-plan-mismatch-'));
  const planOptions = options(root);
  const first = buildReleaseCohortPlan(planOptions, runner(planOptions.appCommit));
  writeReleaseCohortPlan(planOptions, first);
  const original = fs.readFileSync(planOptions.output, 'utf8');
  const changedOptions = { ...planOptions, version: '26.7.19' };
  const changed = buildReleaseCohortPlan(changedOptions, runner(changedOptions.appCommit));

  assert.throws(() => writeReleaseCohortPlan(planOptions, changed), /identity mismatch/);
  assert.equal(fs.readFileSync(planOptions.output, 'utf8'), original);
});

test('release cohort plan transaction leaves no partial artifacts after injected failure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-cohort-plan-rollback-'));
  const planOptions = options(root);
  const plan = buildReleaseCohortPlan(planOptions, runner(planOptions.appCommit));

  assert.throws(
    () => writeReleaseCohortPlan(planOptions, plan, {
      afterMarkdownCommit: () => { throw new Error('injected plan failure'); },
    }),
    /injected plan failure/,
  );
  assert.equal(fs.existsSync(planOptions.output), false);
  assert.equal(fs.existsSync(planOptions.markdown), false);
  assert.equal(fs.existsSync(`${planOptions.output}.lock`), false);
});

test('release cohort plan rejects aliased JSON and Markdown paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-cohort-plan-same-path-'));
  const planOptions = options(root);
  planOptions.markdown = planOptions.output;
  const plan = buildReleaseCohortPlan(planOptions, runner(planOptions.appCommit));

  assert.throws(() => writeReleaseCohortPlan(planOptions, plan), /paths must be different/);
  assert.equal(fs.existsSync(planOptions.output), false);
});
