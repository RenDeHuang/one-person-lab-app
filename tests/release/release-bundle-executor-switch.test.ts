import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  runFrameworkReleaseLocalExecutor,
  type FrameworkReleaseLocalExecutorInput,
} from '../../scripts/framework-release-local-executor.ts';

const appRoot = process.cwd();
const adapterSourcePath = path.join(appRoot, 'scripts', 'framework-release-local-executor.ts');
const fakeOplPath = path.join(
  appRoot,
  'tests',
  'release',
  'fixtures',
  'release-bundle-executor',
  'fake-opl.mjs',
);
const bundleDigest = `sha256:${'a'.repeat(64)}`;
const standardOperation = {
  releaseOperation: 'standard' as const,
  operationId: 'operation-standard-1',
  operationStartedAt: '2026-07-21T00:00:00.000Z',
  operationDeadlineAt: '2099-07-21T01:30:00.000Z',
};
const resumeStandardOperation = {
  ...standardOperation,
  releaseOperation: 'resume_standard' as const,
};
const appendFullOperation = {
  releaseOperation: 'append_full' as const,
  operationId: 'operation-append-full-1',
  operationStartedAt: '2026-07-21T02:00:00.000Z',
  operationDeadlineAt: '2099-07-21T02:50:00.000Z',
};

function digest(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function frameworkResult(key: string, operationResult: Record<string, unknown>) {
  return { version: 'g2', [key]: operationResult };
}

class TransportScenario {
  readonly root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-executor-switch-'));
  readonly responsePath = path.join(this.root, 'response.json');
  readonly callLogPath = path.join(this.root, 'calls.jsonl');
  readonly checkpointPath = path.join(this.root, 'checkpoint', 'checkpoint.json');
  readonly assetPath = path.join(this.root, 'checkpoint', 'tracks', 'standard', 'assets', 'app.zip');
  readonly sourceReceiptPath = path.join(this.root, 'standard-build-receipt.json');
  readonly env = {
    OPL_FAKE_RESPONSE: this.responsePath,
    OPL_FAKE_CALL_LOG: this.callLogPath,
    GITHUB_ACTIONS: 'false',
  };

  constructor() {
    fs.mkdirSync(path.dirname(this.assetPath), { recursive: true });
    fs.writeFileSync(this.assetPath, 'frozen exact ZIP bytes\n');
    fs.writeFileSync(this.checkpointPath, 'opaque Framework checkpoint bytes\n');
    fs.writeFileSync(this.sourceReceiptPath, 'opaque Framework executor receipt bytes\n');
  }

  respond(key: string, operationResult: Record<string, unknown>): void {
    writeJson(this.responsePath, { stdout: frameworkResult(key, operationResult) });
  }

  run(input: Omit<FrameworkReleaseLocalExecutorInput, 'oplPath' | 'env'>) {
    return runFrameworkReleaseLocalExecutor({ ...input, oplPath: fakeOplPath, env: this.env });
  }

  calls(): string[][] {
    return fs.readFileSync(this.callLogPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  }

  cleanup(): void {
    fs.rmSync(this.root, { recursive: true, force: true });
  }
}

const paths: Array<{
  name: string;
  transportExecutor: 'local' | 'github_actions';
  transportRunId: string;
  stage: 'standard_qualified' | 'full_qualified';
  operation: 'verify' | 'publish' | 'build' | 'reconcile';
  operationKey: string;
  operationInput: Omit<FrameworkReleaseLocalExecutorInput, 'operation' | 'oplPath' | 'env'>;
  frameworkStatus: 'idempotent' | 'reconcile_only';
}> = [
  {
    name: 'local freeze -> GitHub Standard -> local resume',
    transportExecutor: 'github_actions', transportRunId: '71001', stage: 'standard_qualified',
    operation: 'verify', operationKey: 'release_bundle_verify',
    operationInput: {
      bundleDigest, qualificationReceiptPath: 'qualification.json', track: 'standard',
      ...resumeStandardOperation,
    },
    frameworkStatus: 'idempotent',
  },
  {
    name: 'local Standard -> GitHub publish',
    transportExecutor: 'local', transportRunId: 'local-standard-71002', stage: 'standard_qualified',
    operation: 'publish', operationKey: 'release_bundle_publish',
    operationInput: { bundleDigest, executorReceiptPath: 'remote-inspect.json', ...standardOperation },
    frameworkStatus: 'idempotent',
  },
  {
    name: 'GitHub Standard -> local Full -> GitHub append',
    transportExecutor: 'github_actions', transportRunId: '71003', stage: 'full_qualified',
    operation: 'build', operationKey: 'release_bundle_build',
    operationInput: { bundleDigest, executorReceiptPath: 'full-build.json', ...appendFullOperation },
    frameworkStatus: 'idempotent',
  },
  {
    name: 'local Standard -> GitHub Full -> local unknown reconcile',
    transportExecutor: 'local', transportRunId: 'local-reconcile-71004', stage: 'full_qualified',
    operation: 'reconcile', operationKey: 'release_bundle_reconcile',
    operationInput: { bundleDigest, executorReceiptPath: 'fresh-inspection.json', ...appendFullOperation },
    frameworkStatus: 'reconcile_only',
  },
];

for (const pathCase of paths) {
  test(`${pathCase.name} preserves Framework authority and transport bytes`, () => {
    const scenario = new TransportScenario();
    try {
      const checkpointBefore = digest(scenario.checkpointPath);
      const assetBefore = digest(scenario.assetPath);
      const receiptBefore = digest(scenario.sourceReceiptPath);
      const importResult = {
        status: 'idempotent',
        bundle_digest: bundleDigest,
        checkpoint_stage: pathCase.stage,
        rebuild_performed: false,
        publish_state_imported: false,
      };
      scenario.respond('release_bundle_checkpoint_import', importResult);
      const imported = scenario.run({
        operation: 'checkpoint-import',
        checkpointPath: scenario.checkpointPath,
        sourceBuildReceiptPaths: [scenario.sourceReceiptPath],
        checkpointTransportExecutor: pathCase.transportExecutor,
        transportRunId: pathCase.transportRunId,
      });
      assert.deepEqual(imported.framework_operation_result, importResult);
      assert.equal(imported.framework_operation_result.rebuild_performed, false);
      assert.equal(imported.framework_operation_result.publish_state_imported, false);

      const nextResult = {
        status: pathCase.frameworkStatus,
        bundle_digest: bundleDigest,
        track: pathCase.stage.startsWith('full') ? 'full' : 'standard',
      };
      scenario.respond(pathCase.operationKey, nextResult);
      const next = scenario.run({
        operation: pathCase.operation,
        ...pathCase.operationInput,
        sourceBuildReceiptPaths: [scenario.sourceReceiptPath],
        checkpointTransportExecutor: pathCase.transportExecutor,
        transportRunId: pathCase.transportRunId,
      });
      assert.deepEqual(next.framework_operation_result, nextResult);
      assert.equal(next.framework_operation_result.status, pathCase.frameworkStatus);
      assert.equal(next.bundle_digest, bundleDigest);
      assert.equal(digest(scenario.checkpointPath), checkpointBefore);
      assert.equal(digest(scenario.assetPath), assetBefore);
      assert.equal(digest(scenario.sourceReceiptPath), receiptBefore);
      assert.equal(scenario.calls().length, 2, 'each adapter call must invoke exactly one requested Framework command');
    } finally {
      scenario.cleanup();
    }
  });
}

test('thin adapter source has no Framework checkpoint, receipt, track-state, or skip implementation', () => {
  const source = fs.readFileSync(adapterSourcePath, 'utf8');
  const forbidden = [
    'readCheckpointProjection',
    'readExecutorReceipt',
    'statusProjection',
    'sourceBuildProjection',
    'source_build_executor',
    'source_builds',
    'reconcileRequired',
    'stage_precondition_failed',
    'opl_release_bundle_executor_receipt.v1',
    'release-bundle-checkpoint.schema.json',
  ];
  for (const token of forbidden) assert.doesNotMatch(source, new RegExp(token));
  assert.ok(source.split('\n').length < 430, 'the App adapter must remain a thin CLI transport');
});
