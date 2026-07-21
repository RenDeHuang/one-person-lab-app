import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  buildFrameworkReleaseArgv,
  runFrameworkReleaseLocalExecutor,
  type FrameworkReleaseLocalExecutorInput,
} from '../../scripts/framework-release-local-executor.ts';

const appRoot = process.cwd();
const adapterPath = path.join(appRoot, 'scripts', 'framework-release-local-executor.ts');
const fakeOplPath = path.join(
  appRoot,
  'tests',
  'release',
  'fixtures',
  'release-bundle-executor',
  'fake-opl.mjs',
);
const bundleDigest = `sha256:${'a'.repeat(64)}`;
const rejectedBundleDigest = 'sha256:91d5ea069757fca6bb9aa2280615dc952caeff55b6b4bc13e08e40df32378f49';
const standardInvocation = {
  releaseOperation: 'standard' as const,
  operationId: 'operation-standard-1',
  operationStartedAt: '2026-07-21T00:00:00.000Z',
  operationDeadlineAt: '2099-07-21T01:30:00.000Z',
};

function digest(bytes: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): string {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

class FakeFramework {
  readonly root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-thin-release-adapter-'));
  readonly responsePath = path.join(this.root, 'response.json');
  readonly callLogPath = path.join(this.root, 'calls.jsonl');
  readonly env = {
    OPL_FAKE_RESPONSE: this.responsePath,
    OPL_FAKE_CALL_LOG: this.callLogPath,
    GITHUB_ACTIONS: 'false',
  };

  respond(stdout: unknown, options: { stderr?: string; exitCode?: number; rawStdout?: string } = {}): void {
    writeJson(this.responsePath, {
      stdout,
      stderr: options.stderr,
      exit_code: options.exitCode,
      raw_stdout: options.rawStdout,
    });
  }

  calls(): string[][] {
    if (!fs.existsSync(this.callLogPath)) return [];
    return fs.readFileSync(this.callLogPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  }

  clearCalls(): void {
    fs.rmSync(this.callLogPath, { force: true });
  }

  cleanup(): void {
    fs.rmSync(this.root, { recursive: true, force: true });
  }
}

function baseInput(fake: FakeFramework, input: Omit<FrameworkReleaseLocalExecutorInput, 'oplPath' | 'env'>): FrameworkReleaseLocalExecutorInput {
  return { ...input, oplPath: fakeOplPath, env: fake.env };
}

function frameworkResult(key: string, operationResult: Record<string, unknown>) {
  return { version: 'g2', [key]: operationResult };
}

test('forwards the nine public Framework release commands without App state-machine calls', () => {
  const cases: Array<{ input: FrameworkReleaseLocalExecutorInput; argv: string[] }> = [
    {
      input: { operation: 'freeze', requestPath: 'freeze.json', sourceRoot: 'framework' },
      argv: ['release', 'freeze', '--request', 'freeze.json', '--source-root', 'framework', '--json'],
    },
    {
      input: { operation: 'operation-admit', bundleDigest, ...standardInvocation },
      argv: [
        'release', 'operation', 'admit', '--bundle', bundleDigest,
        '--operation', 'standard', '--operation-id', standardInvocation.operationId,
        '--operation-started-at', standardInvocation.operationStartedAt,
        '--operation-deadline-at', standardInvocation.operationDeadlineAt, '--json',
      ],
    },
    {
      input: { operation: 'build', bundleDigest, executorReceiptPath: 'build.json', ...standardInvocation },
      argv: [
        'release', 'build', '--bundle', bundleDigest, '--executor-receipt', 'build.json',
        '--operation', 'standard', '--operation-id', standardInvocation.operationId,
        '--operation-started-at', standardInvocation.operationStartedAt,
        '--operation-deadline-at', standardInvocation.operationDeadlineAt, '--json',
      ],
    },
    {
      input: {
        operation: 'verify', bundleDigest, qualificationReceiptPath: 'qualification.json',
        track: 'standard', ...standardInvocation,
      },
      argv: [
        'release', 'verify', '--bundle', bundleDigest, '--qualification-receipt', 'qualification.json',
        '--operation', 'standard', '--operation-id', standardInvocation.operationId,
        '--operation-started-at', standardInvocation.operationStartedAt,
        '--operation-deadline-at', standardInvocation.operationDeadlineAt,
        '--track', 'standard', '--json',
      ],
    },
    {
      input: { operation: 'checkpoint-export', bundleDigest, checkpointOutput: 'checkpoint', storeRoot: 'store' },
      argv: ['release', 'checkpoint', 'export', '--bundle', bundleDigest, '--output', 'checkpoint', '--store', 'store', '--json'],
    },
    {
      input: { operation: 'checkpoint-import', checkpointPath: 'checkpoint/checkpoint.json', storeRoot: 'store' },
      argv: ['release', 'checkpoint', 'import', '--checkpoint', 'checkpoint/checkpoint.json', '--store', 'store', '--json'],
    },
    {
      input: { operation: 'publish', bundleDigest, executorReceiptPath: 'remote.json', ...standardInvocation },
      argv: [
        'release', 'publish', '--bundle', bundleDigest, '--executor-receipt', 'remote.json',
        '--operation', 'standard', '--operation-id', standardInvocation.operationId,
        '--operation-started-at', standardInvocation.operationStartedAt,
        '--operation-deadline-at', standardInvocation.operationDeadlineAt, '--json',
      ],
    },
    {
      input: { operation: 'reconcile', bundleDigest, executorReceiptPath: 'inspect.json', ...standardInvocation },
      argv: [
        'release', 'reconcile', '--bundle', bundleDigest, '--executor-receipt', 'inspect.json',
        '--operation', 'standard', '--operation-id', standardInvocation.operationId,
        '--operation-started-at', standardInvocation.operationStartedAt,
        '--operation-deadline-at', standardInvocation.operationDeadlineAt, '--json',
      ],
    },
    {
      input: { operation: 'status', bundleDigest },
      argv: ['release', 'status', '--bundle', bundleDigest, '--json'],
    },
  ];
  for (const entry of cases) assert.deepEqual(buildFrameworkReleaseArgv(entry.input), entry.argv);
});

test('returns the Framework document and operation result unchanged while treating source receipts as opaque bytes', () => {
  const fake = new FakeFramework();
  try {
    const standardReceipt = path.join(fake.root, 'standard-build-receipt.json');
    const fullReceipt = path.join(fake.root, 'full-build-receipt.json');
    fs.writeFileSync(standardReceipt, 'opaque standard receipt bytes\n');
    fs.writeFileSync(fullReceipt, 'opaque full receipt bytes\n');
    const operationResult = {
      status: 'idempotent',
      bundle_digest: bundleDigest,
      checkpoint_stage: 'full_qualified',
      rebuild_performed: false,
      publish_state_imported: false,
      framework_owned_extension: { untouched: true },
    };
    const document = frameworkResult('release_bundle_checkpoint_import', operationResult);
    fake.respond(document);

    const input = baseInput(fake, {
      operation: 'checkpoint-import',
      checkpointPath: path.join(fake.root, 'checkpoint.json'),
      storeRoot: path.join(fake.root, 'store'),
      sourceBuildReceiptPaths: [standardReceipt, fullReceipt],
      checkpointTransportExecutor: 'github_actions',
      transportRunId: '424242',
    });
    input.env = { ...fake.env, GITHUB_RUN_ID: '999999' };
    const result = runFrameworkReleaseLocalExecutor(input);

    assert.deepEqual(result.framework_result, document);
    assert.deepEqual(result.framework_operation_result, operationResult);
    assert.equal(result.bundle_digest, bundleDigest);
    assert.deepEqual(result.transport_provenance, {
      checkpoint_transport_executor: 'github_actions',
      transport_run_id: '424242',
      source_build_receipts: [
        { path: standardReceipt, size_bytes: Buffer.byteLength('opaque standard receipt bytes\n'), sha256: digest('opaque standard receipt bytes\n') },
        { path: fullReceipt, size_bytes: Buffer.byteLength('opaque full receipt bytes\n'), sha256: digest('opaque full receipt bytes\n') },
      ],
    });
    assert.deepEqual(fake.calls(), [[
      'release', 'checkpoint', 'import', '--checkpoint', path.join(fake.root, 'checkpoint.json'),
      '--store', path.join(fake.root, 'store'), '--json',
    ]]);
  } finally {
    fake.cleanup();
  }
});

test('binds a GitHub transport run only inside an actual GitHub Actions executor', () => {
  const fake = new FakeFramework();
  try {
    assert.throws(
      () => runFrameworkReleaseLocalExecutor({
        ...baseInput(fake, {
          operation: 'checkpoint-import',
          checkpointPath: path.join(fake.root, 'checkpoint.json'),
          checkpointTransportExecutor: 'github_actions',
          transportRunId: '424242',
        }),
        env: { ...fake.env, GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '999999' },
      }),
      (error: any) => error?.failureKind === 'transport_invalid' && error?.requiredNextAction === 'use_current_admitted_run',
    );
    assert.deepEqual(fake.calls(), []);
  } finally {
    fake.cleanup();
  }
});

test('does not reinterpret Framework idempotent, reconcile-only, or upload-required outcomes', () => {
  const fake = new FakeFramework();
  try {
    for (const status of ['idempotent', 'reconcile_only', 'upload_required']) {
      const operationResult = { status, bundle_digest: bundleDigest };
      fake.respond(frameworkResult('release_bundle_build', operationResult));
      const result = runFrameworkReleaseLocalExecutor(baseInput(fake, {
        operation: 'build', bundleDigest, executorReceiptPath: `${status}.json`, ...standardInvocation,
      }));
      assert.deepEqual(result.framework_operation_result, operationResult);
    }
    assert.equal(fake.calls().length, 3, 'the adapter must invoke only the requested Framework command');
    assert.ok(fake.calls().every((argv) => argv.slice(0, 2).join(' ') === 'release build'));
  } finally {
    fake.cleanup();
  }
});

test('checks only g2, the operation key, and Release Bundle identity on Framework output', () => {
  const fake = new FakeFramework();
  try {
    fake.respond({ version: 'g1', release_bundle_status: { bundle_digest: bundleDigest } });
    assert.throws(
      () => runFrameworkReleaseLocalExecutor(baseInput(fake, { operation: 'status', bundleDigest })),
      (error: any) => error.failureKind === 'framework_result_invalid',
    );
    fake.respond({ version: 'g2', unrelated: { bundle_digest: bundleDigest } });
    assert.throws(
      () => runFrameworkReleaseLocalExecutor(baseInput(fake, { operation: 'status', bundleDigest })),
      (error: any) => error.failureKind === 'framework_result_invalid',
    );
    fake.respond(frameworkResult('release_bundle_status', { bundle_digest: `sha256:${'b'.repeat(64)}` }));
    assert.throws(
      () => runFrameworkReleaseLocalExecutor(baseInput(fake, { operation: 'status', bundleDigest })),
      (error: any) => error.failureKind === 'framework_result_invalid',
    );
  } finally {
    fake.cleanup();
  }
});

test('enforces one-shot App admission but delegates deadline decisions to Framework', () => {
  const fake = new FakeFramework();
  try {
    assert.throws(
      () => runFrameworkReleaseLocalExecutor(baseInput(fake, {
        operation: 'build', bundleDigest, executorReceiptPath: 'build.json', runAttempt: '2',
      })),
      (error: any) => error.failureKind === 'partial_rerun_rejected',
    );
    fake.respond(frameworkResult('release_bundle_build', {
      status: 'late_observation', bundle_digest: bundleDigest, rebuild_performed: false,
    }));
    const result = runFrameworkReleaseLocalExecutor(baseInput(fake, {
      operation: 'build', bundleDigest, executorReceiptPath: 'build.json', runAttempt: '1',
      ...standardInvocation,
      operationDeadlineAt: '2026-07-21T01:30:00.000Z',
    }));
    assert.equal(result.framework_operation_result.status, 'late_observation');
    assert.equal(result.framework_operation_result.rebuild_performed, false);
    assert.equal(fake.calls().length, 1);
  } finally {
    fake.cleanup();
  }
});

test('delegates exact-marker reconcile admission and result semantics to Framework', () => {
  const fake = new FakeFramework();
  try {
    const frameworkDecision = {
      status: 'late_observation',
      bundle_digest: bundleDigest,
      rebuild_performed: false,
      exact_unknown_marker_cleared: true,
    };
    fake.respond(frameworkResult('release_bundle_reconcile', frameworkDecision));
    const result = runFrameworkReleaseLocalExecutor(baseInput(fake, {
      operation: 'reconcile', bundleDigest, executorReceiptPath: 'inspection.json',
      ...standardInvocation,
    }));
    assert.deepEqual(result.framework_operation_result, frameworkDecision);
    assert.equal(fake.calls().length, 1);
    assert.deepEqual(fake.calls()[0], [
      'release', 'reconcile', '--bundle', bundleDigest, '--executor-receipt', 'inspection.json',
      '--operation', 'standard', '--operation-id', standardInvocation.operationId,
      '--operation-started-at', standardInvocation.operationStartedAt,
      '--operation-deadline-at', standardInvocation.operationDeadlineAt, '--json',
    ]);
  } finally {
    fake.cleanup();
  }
});

test('requires immutable GitHub admission for real build or qualification and rejects the permanent Bundle', () => {
  const fake = new FakeFramework();
  try {
    const githubEnv = { ...fake.env, GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '1' };
    assert.throws(
      () => runFrameworkReleaseLocalExecutor({
        operation: 'verify', oplPath: fakeOplPath, bundleDigest, qualificationReceiptPath: 'qualification.json', env: githubEnv,
      }),
      (error: any) => error.failureKind === 'admission_required',
    );
    fake.respond(frameworkResult('release_bundle_verify', { status: 'complete', bundle_digest: bundleDigest }));
    const admitted = runFrameworkReleaseLocalExecutor({
      operation: 'verify',
      oplPath: fakeOplPath,
      bundleDigest,
      qualificationReceiptPath: 'qualification.json',
      releaseOperation: 'standard',
      operationId: standardInvocation.operationId,
      operationStartedAt: '2026-07-21T00:00:00.000Z',
      operationDeadlineAt: '2026-07-21T01:30:00.000Z',
      env: githubEnv,
    });
    assert.equal(admitted.framework_operation_result.status, 'complete');
    fake.clearCalls();
    assert.throws(
      () => runFrameworkReleaseLocalExecutor(baseInput(fake, { operation: 'status', bundleDigest: rejectedBundleDigest })),
      (error: any) => error.failureKind === 'permanently_rejected_bundle',
    );
    assert.equal(fake.calls().length, 0);
  } finally {
    fake.cleanup();
  }
});

test('persists typed input, stdout, and stderr evidence before returning a Framework failure', () => {
  const fake = new FakeFramework();
  try {
    const receiptPath = path.join(fake.root, 'remote-inspect.json');
    fs.writeFileSync(receiptPath, 'opaque remote inspection\n');
    fake.respond(null, { stderr: 'framework stderr\n', exitCode: 42, rawStdout: 'framework stdout\n' });
    const failurePath = path.join(fake.root, 'evidence', 'failure.json');
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types', adapterPath,
      'publish', '--opl', fakeOplPath, '--bundle', bundleDigest,
      '--executor-receipt', receiptPath, '--failure-output', failurePath,
      '--release-operation', 'standard', '--operation-id', standardInvocation.operationId,
      '--operation-started-at', standardInvocation.operationStartedAt,
      '--operation-deadline-at', standardInvocation.operationDeadlineAt,
      '--run-attempt', '1',
    ], { encoding: 'utf8', env: { ...process.env, ...fake.env } });

    assert.equal(result.status, 1);
    const failure = JSON.parse(fs.readFileSync(failurePath, 'utf8'));
    assert.equal(failure.failure_kind, 'framework_cli_failed');
    assert.equal(failure.rebuild_performed, false);
    assert.equal(failure.stdout, 'framework stdout\n');
    assert.equal(failure.stderr, 'framework stderr\n');
    assert.match(failure.input_digest, /^sha256:[0-9a-f]{64}$/);
    assert.ok(failure.details.input_evidence.files.some((entry: any) => (
      entry.path === receiptPath && entry.sha256 === digest('opaque remote inspection\n')
    )));
    assert.equal(fs.readFileSync(failurePath.replace('.json', '.stdout.log'), 'utf8'), 'framework stdout\n');
    assert.equal(fs.readFileSync(failurePath.replace('.json', '.stderr.log'), 'utf8'), 'framework stderr\n');
  } finally {
    fake.cleanup();
  }
});

test('real Framework CLI accepts the exact operation-control ABI emitted by the App adapter', {
  skip: !process.env.OPL_FRAMEWORK_ROOT,
}, () => {
  const frameworkRoot = path.resolve(String(process.env.OPL_FRAMEWORK_ROOT));
  const oplPath = path.join(frameworkRoot, 'bin', 'opl');
  assert.equal(fs.existsSync(oplPath), true, `Missing Framework CLI at ${oplPath}`);
  const storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-real-framework-abi-'));
  try {
    assert.throws(
      () => runFrameworkReleaseLocalExecutor({
        operation: 'operation-admit',
        oplPath,
        storeRoot,
        bundleDigest,
        ...standardInvocation,
        runAttempt: '1',
      }),
      (error: any) => {
        assert.equal(error.failureKind, 'framework_cli_failed');
        assert.doesNotMatch(`${error.message}\n${error.details?.stderr ?? ''}`, /Unknown option|Missing --operation/);
        assert.match(`${error.message}\n${error.details?.stderr ?? ''}`, /Release Bundle|bundle/i);
        return true;
      },
    );
  } finally {
    fs.rmSync(storeRoot, { recursive: true, force: true });
  }
});
