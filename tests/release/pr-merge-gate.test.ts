import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'pr-merge-gate.yml');
const templatePath = path.join(process.cwd(), '.github', 'pull_request_template.md');
const testingGuidePath = path.join(process.cwd(), 'docs', 'testing', 'README.md');

test('pull request validation is a read-only optional hosted check', () => {
  const source = fs.readFileSync(workflowPath, 'utf8');
  const workflow = parseYaml(source) as Record<string, any>;

  assert.equal(workflow.name, 'Pull Request Validation');
  assert.deepEqual(Object.keys(workflow.on), ['pull_request']);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(Object.keys(workflow.permissions).length, 1);
  assert.equal(workflow.jobs.quality.name, 'PR / validation');
  assert.deepEqual(Object.keys(workflow.jobs), ['quality']);
  const shellSetup = workflow.jobs.quality.steps.find(
    (step: Record<string, unknown>) => step.uses === './.github/actions/setup-active-shell-deps',
  );
  assert.equal(shellSetup.with['fetch-depth'], '0');
  assert.match(source, /runs-on: ubuntu-latest/);
  assert.match(source, /OPL_FLOW_WORKFLOW_POLICY/);
  assert.match(source, /OPL_FULL_OPL_FLOW_ROOT/);
  assert.match(source, /npm run typecheck/);
  assert.match(source, /npm run validate:active-shell -- --quick/);
  assert.match(source, /npm run format:check/);
  const stableReleaseBoundary = workflow.jobs.quality.steps.find(
    (step: Record<string, unknown>) => step.name === 'Run release-boundary tests',
  );
  assert.equal(stableReleaseBoundary.env.OPL_RELEASE_VALIDATION_PROFILE, 'stable');
  assert.equal(stableReleaseBoundary.run, 'scripts/verify.sh release-boundary');
  const windowsPreview = workflow.jobs.quality.steps.find(
    (step: Record<string, unknown>) => step.name === 'Run Windows Preview release checks (advisory)',
  );
  assert.equal(windowsPreview['continue-on-error'], true);
  assert.equal(windowsPreview.env.OPL_RELEASE_VALIDATION_PROFILE, 'windows-preview');
  assert.equal(windowsPreview.run, 'scripts/verify.sh release-boundary');
  assert.match(source, /actionlint -color -shellcheck= -pyflakes=/);
  assert.doesNotMatch(source, /pull_request_target/);
  assert.doesNotMatch(source, /workflow_dispatch/);
  assert.doesNotMatch(source, /contents:\s*write/);
  assert.doesNotMatch(source, /packages:\s*write/);
  assert.doesNotMatch(source, /gh\s+(release|run\s+(rerun|cancel))/);
  assert.doesNotMatch(source, /PR \/ merge gate/);
});

test('PR guidance keeps local-first direct push separate from optional hosted validation', () => {
  const template = fs.readFileSync(templatePath, 'utf8');
  const testingGuide = fs.readFileSync(testingGuidePath, 'utf8');

  assert.match(template, /PR \/ validation/);
  assert.match(template, /not a required branch-protection check/);
  assert.doesNotMatch(template, /Codex review/i);
  assert.match(testingGuide, /ordinary non-force push/);
  assert.match(testingGuide, /optional hosted evidence/);
  assert.doesNotMatch(testingGuide, /Codex review/i);
  assert.match(testingGuide, /Tart, clean VM, Hyper-V, and WSL2/);
  assert.match(testingGuide, /optional|异步/i);

  for (const retiredPath of [
    path.join(process.cwd(), '.github', 'workflows', 'codex-review-gate.yml'),
    path.join(process.cwd(), 'scripts', 'codex-review-gate.ts'),
    path.join(process.cwd(), 'tests', 'release', 'codex-review-gate.test.ts'),
  ]) {
    assert.equal(fs.existsSync(retiredPath), false);
  }
});
