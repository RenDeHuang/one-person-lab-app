import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildStableWorkflowInventory } from '../../scripts/validate-stable-workflow-inventory.ts';

function fixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-workflow-inventory-'));
  for (const [relativePath, source] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, source);
  }
  return root;
}

function removeFixture(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}

test('recursively inventories local reusable workflows and declared conditional paths', () => {
  const root = fixture({
    '.github/workflows/release-stable.yml': `
on: workflow_dispatch
jobs:
  preflight:
    if: inputs.enabled
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
      - uses: actions/setup-node@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
  standard:
    if: inputs.operation == 'standard'
    uses: ./.github/workflows/standard.yml
`,
    '.github/workflows/standard.yml': `
on:
  workflow_call:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
      - uses: actions/upload-artifact@cccccccccccccccccccccccccccccccccccccccc
  qualify:
    uses: ./.github/workflows/qualify.yml
`,
    '.github/workflows/qualify.yml': `
on:
  workflow_call:
jobs:
  inspect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@dddddddddddddddddddddddddddddddddddddddd
`,
  });
  try {
    const report = buildStableWorkflowInventory({ repoRoot: root });
    assert.equal(report.total_jobs, 3);
    assert.equal(report.explicit_steps, 5);
    assert.equal(report.workflow_instance_count, 3);
    assert.equal(report.reusable_call_count, 2);
    assert.equal(report.conditional_job_count, 3);
    assert.equal(report.conditional_paths.length, 3);
    assert.equal(report.reusable_calls.find((call) => call.job_id === 'standard')?.expanded_total_jobs, 2);
    assert.equal(report.reusable_calls.find((call) => call.job_id === 'standard')?.expanded_explicit_steps, 3);
    assert.deepEqual(
      report.workflows.map((workflow) => ({
        invocation_path: workflow.invocation_path,
        execution_jobs: workflow.execution_jobs,
        explicit_steps: workflow.explicit_steps,
      })),
      [
        {
          invocation_path: '.github/workflows/release-stable.yml',
          execution_jobs: 1,
          explicit_steps: 2,
        },
        {
          invocation_path: '.github/workflows/release-stable.yml/standard',
          execution_jobs: 1,
          explicit_steps: 2,
        },
        {
          invocation_path: '.github/workflows/release-stable.yml/standard/qualify',
          execution_jobs: 1,
          explicit_steps: 1,
        },
      ],
    );
    assert.deepEqual(
      report.duplicate_setup_hotspots.map(({ key, count }) => ({ key, count })),
      [{ key: 'actions/checkout', count: 2 }],
    );
    assert.equal(report.budget_enforcement_enabled, false);
  } finally {
    removeFixture(root);
  }
});

test('fails closed when a repository-local reusable workflow is missing', () => {
  const root = fixture({
    '.github/workflows/release-stable.yml': `
on: workflow_dispatch
jobs:
  standard:
    uses: ./.github/workflows/missing.yml
`,
  });
  try {
    assert.throws(
      () => buildStableWorkflowInventory({ repoRoot: root }),
      /Workflow must be a regular file: \.github\/workflows\/missing\.yml/,
    );
  } finally {
    removeFixture(root);
  }
});

test('fails closed when a reusable workflow path traverses a symbolic link', () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-workflow-outside-'));
  fs.writeFileSync(path.join(outside, 'child.yml'), `
on:
  workflow_call:
jobs:
  escaped:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
`);
  const root = fixture({
    '.github/workflows/release-stable.yml': `
on: workflow_dispatch
jobs:
  linked:
    uses: ./.github/workflows/linked/child.yml
`,
  });
  fs.symlinkSync(outside, path.join(root, '.github', 'workflows', 'linked'), 'dir');
  try {
    assert.throws(
      () => buildStableWorkflowInventory({ repoRoot: root }),
      /Workflow path must not contain symbolic links/,
    );
  } finally {
    removeFixture(root);
    removeFixture(outside);
  }
});

test('fails closed when the workflow root is a symbolic link', () => {
  const outside = fixture({
    'release-stable.yml': `
on: workflow_dispatch
jobs:
  escaped:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
`,
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-stable-workflow-root-link-'));
  fs.mkdirSync(path.join(root, '.github'), { recursive: true });
  fs.symlinkSync(outside, path.join(root, '.github', 'workflows'), 'dir');
  try {
    assert.throws(
      () => buildStableWorkflowInventory({ repoRoot: root }),
      /Workflow path must not contain symbolic links/,
    );
  } finally {
    removeFixture(root);
    removeFixture(outside);
  }
});

test('fails closed when a reusable workflow cannot be recursively inventoried', () => {
  const root = fixture({
    '.github/workflows/release-stable.yml': `
on: workflow_dispatch
jobs:
  external:
    uses: owner/repository/.github/workflows/release.yml@main
`,
  });
  try {
    assert.throws(
      () => buildStableWorkflowInventory({ repoRoot: root }),
      /Cannot inventory unknown reusable workflow target/,
    );
  } finally {
    removeFixture(root);
  }
});

test('fails closed on recursive reusable workflow cycles', () => {
  const root = fixture({
    '.github/workflows/release-stable.yml': `
on: workflow_dispatch
jobs:
  standard:
    uses: ./.github/workflows/loop.yml
`,
    '.github/workflows/loop.yml': `
on:
  workflow_call:
jobs:
  loop:
    uses: ./.github/workflows/release-stable.yml
`,
  });
  try {
    assert.throws(
      () => buildStableWorkflowInventory({ repoRoot: root }),
      /Reusable workflow cycle detected/,
    );
  } finally {
    removeFixture(root);
  }
});

test('maps twelve neutral numbered stage evidence slots', () => {
  const stageIds = Array.from(
    { length: 12 },
    (_, index) => `stage_${String(index + 1).padStart(2, '0')}`,
  );
  const jobs = stageIds.map((stageId) => `
  stable_${stageId}:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
`).join('');
  const root = fixture({
    '.github/workflows/release-stable.yml': `
on: workflow_dispatch
jobs:${jobs}
`,
  });
  try {
    const report = buildStableWorkflowInventory({ repoRoot: root });
    assert.equal(report.business_stage_coverage.length, 12);
    assert.deepEqual(
      report.business_stage_coverage.map(({ stage_id, status }) => ({ stage_id, status })),
      stageIds.map((stage_id) => ({ stage_id, status: 'covered' })),
    );
  } finally {
    removeFixture(root);
  }
});

test('current Stable topology produces a parseable baseline without enabling budgets', () => {
  const report = buildStableWorkflowInventory({ repoRoot: process.cwd() });
  assert.equal(report.schema, 'opl_stable_workflow_inventory.v1');
  assert.equal(report.inventory_mode, 'all_declared_conditional_paths');
  assert.ok(report.total_jobs > 0);
  assert.ok(report.explicit_steps > 0);
  assert.ok(report.workflow_instance_count > 1);
  assert.equal(report.business_stage_coverage.length, 12);
  assert.equal(report.budget_enforcement_enabled, false);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(report)));
});
