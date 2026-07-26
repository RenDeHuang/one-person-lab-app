import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

import {
  buildReleaseAttemptObservation,
  classifyReleaseAttemptStage,
} from '../../scripts/release-attempt-observability.ts';

const appRoot = path.resolve(import.meta.dirname, '../..');

function run(conclusion = 'failure') {
  return {
    id: 30180000002,
    run_attempt: 1,
    repository: { full_name: 'gaofeng21cn/one-person-lab-app' },
    path: '.github/workflows/release-stable.yml',
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion,
    head_sha: 'a'.repeat(40),
    created_at: '2026-07-26T01:00:00.000Z',
    run_started_at: '2026-07-26T01:01:00.000Z',
    updated_at: '2026-07-26T01:11:30.000Z',
  };
}

test('machine stage classifier covers the release critical path without becoming authority', () => {
  assert.equal(classifyReleaseAttemptStage('Freeze Bundle contract'), 'freeze_version_notes_contract');
  assert.equal(classifyReleaseAttemptStage('Standard macOS build and notarization'), 'build_source_signing_tests');
  assert.equal(classifyReleaseAttemptStage('Native WebUI qualification'), 'native_webui');
  assert.equal(classifyReleaseAttemptStage('Clean VM first launch'), 'clean_vm');
  assert.equal(classifyReleaseAttemptStage('Restore portable checkpoint'), 'checkpoint_restore');
  assert.equal(classifyReleaseAttemptStage('Updater predecessor 26.7.20'), 'updater_predecessor');
  assert.equal(classifyReleaseAttemptStage('Homebrew and Latest activation'), 'homebrew_latest');

  const observation = buildReleaseAttemptObservation(run(), {
    jobs: [
      { id: 2, name: 'Updater predecessor 26.7.20', conclusion: 'failure', completed_at: '2026-07-26T01:10:00.000Z' },
      { id: 1, name: 'Standard macOS build and notarization', conclusion: 'failure', completed_at: '2026-07-26T01:08:00.000Z' },
    ],
  });
  assert.equal(observation.first_terminal.stage, 'build_source_signing_tests');
  assert.equal(observation.first_terminal.job_id, '1');
  assert.equal(observation.run.wall_minutes, 10.5);
  assert.deepEqual(observation.authority, {
    release_state_authority: false,
    framework_status_authority: false,
    mutation_authority: false,
    may_authorize_retry_rerun_or_redispatch: false,
  });
});

test('cancelled workflow without a terminal job stays observational', () => {
  const observation = buildReleaseAttemptObservation(run('cancelled'), { jobs: [] });
  assert.equal(observation.first_terminal.stage, 'workflow_cancelled');
  assert.equal(observation.terminal_failure_job_count, 0);
});

test('observability workflow is a read-only append-only follower', () => {
  const source = fs.readFileSync(path.join(appRoot, '.github/workflows/release-attempt-observability.yml'), 'utf8');
  const workflow = parseYaml(source) as Record<string, any>;
  assert.deepEqual(Object.keys(workflow.on), ['workflow_run']);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['observe']);
  assert.match(source, /release-attempt-observability\.ts/);
  assert.match(source, /opl-release-attempt-observation-\$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.doesNotMatch(source, /workflow_dispatch|contents: write|actions: write|gh workflow run|gh run rerun|gh run cancel/);
});
