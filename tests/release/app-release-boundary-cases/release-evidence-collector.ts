import {
  assert,
  fs,
  os,
  path,
  test,
  require,
  runNode,
  writeFile,
  writeScreenshotPng,
  writeAssistantRouteSmokeScreenshots,
  writeRuntimeEvidenceJsonFiles,
  writeCollectorFakeOpl,
  writeVmSmokeSummaryFiles,
  writeTypedBlockerFile,
  releaseEvidenceCohort,
  writeRemoteReleaseVerificationSummary,
  fileSha256,
} from './helpers.ts';

const completeAttachedArtifacts = [
  'runtime_screenshot',
  'full_screenshot',
  'action_screenshot',
  'first_run_vm_summary',
  'guest_smoke_summary',
  'assistant_route_smoke_summary',
  'codex_functional_check_summary',
  'assistant_route_smoke_mas_screenshot',
  'assistant_route_smoke_mag_screenshot',
  'assistant_route_smoke_rca_screenshot',
  'remote_release_verification',
  'codex_ai_self_check_summary',
];

const collectorActionId = 'provider-scheduler:temporal:trigger';

function collectorFixture(prefix, options = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const fakeBin = path.join(tempRoot, 'bin');
  const bundleDir = path.join(tempRoot, 'bundle');
  const actionLog = options.actionLogName ? path.join(tempRoot, options.actionLogName) : '';
  writeCollectorFakeOpl(path.join(fakeBin, 'opl'), actionLog, options.outputs ?? {});
  return {
    tempRoot,
    bundleDir,
    actionLog,
    collect(args = []) {
      return runNode([
        'scripts/collect-release-evidence.ts',
        '--bundle-dir',
        bundleDir,
        '--action-id',
        collectorActionId,
        '--overwrite',
        ...args,
      ], {
        env: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` },
      });
    },
  };
}

function parseCollectedPayload(collected) {
  assert.equal(collected.status, 0, collected.stderr || collected.stdout);
  return JSON.parse(collected.stdout);
}

function validateBundle(bundleDir, allowMissing = false) {
  const validation = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    bundleDir,
    ...(allowMissing ? ['--allow-missing-evidence'] : []),
  ]);
  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  return JSON.parse(validation.stdout);
}

function assertPassedBundle(bundleDir, payload) {
  assert.equal(payload.status, 'passed');
  assert.equal(payload.packaged_app_evidence, true);
  assert.deepEqual(payload.release_cohort, {
    ...releaseEvidenceCohort(),
    source: 'write-release-evidence-manifest',
  });
  assert.equal(payload.current_cohort_evidence, true);
  assert.equal(payload.missing_artifact_count, 0);
  assert.deepEqual(payload.attached_artifacts, completeAttachedArtifacts);

  const validationPayload = validateBundle(bundleDir);
  assert.equal(validationPayload.status, 'passed');
  assert.equal(validationPayload.verified_artifact_count, 16);
  assert.equal(validationPayload.verified_diagnostic_count, 1);
  assert.equal(validationPayload.missing_artifact_count, 0);
}

test('release evidence collector preserves argument error boundaries', () => {
  const unknown = runNode(['scripts/collect-release-evidence.ts', '--unknown']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Unknown argument: --unknown/);

  const missingValue = runNode(['scripts/collect-release-evidence.ts', '--bundle-dir']);
  assert.notEqual(missingValue.status, 0);
  assert.match(missingValue.stderr, /Missing value for --bundle-dir/);
});

test('release evidence collector captures live OPL runtime refs and keeps missing App evidence explicit', () => {
  const { actionLog, bundleDir, collect } = collectorFixture('opl-app-release-evidence-collector-', {
    actionLogName: 'opl-actions.jsonl',
  });
  const collected = collect(['--execute-action']);

  const payload = parseCollectedPayload(collected);
  assert.equal(payload.status, 'missing_evidence');
  assert.equal(payload.packaged_app_evidence, false);
  assert.equal(payload.action_id, collectorActionId);
  assert.deepEqual(payload.collected_artifacts, [
    'app_state_summary',
    'app_state_full',
    'drilldown_full',
    'action_dry_run_result',
    'action_execute_result',
  ]);
  assert.deepEqual(payload.missing_artifacts, [
    'runtime_screenshot',
    'full_screenshot',
    'action_screenshot',
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
  ]);

  const validationPayload = validateBundle(bundleDir, true);
  assert.equal(validationPayload.status, 'missing_evidence');
  assert.equal(validationPayload.verified_artifact_count, 5);
  assert.equal(validationPayload.missing_artifact_count, 11);

  const actionArgs = fs.readFileSync(actionLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(actionArgs, [
    ['app', 'state', '--profile', 'fast', '--json'],
    ['app', 'state', '--profile', 'full', '--json'],
    ['runtime', 'app-operator-drilldown', '--detail', 'full', '--json'],
    ['app', 'action', 'execute', '--action', 'provider-scheduler:temporal:trigger', '--dry-run', '--json'],
    ['app', 'action', 'execute', '--action', 'provider-scheduler:temporal:trigger', '--json'],
  ]);
});

test('release evidence collector validates generated bundle shape before reporting success', () => {
  const { collect } = collectorFixture('opl-app-release-evidence-collector-invalid-', {
    outputs: { fast: { status: 'passed', refs_only: true } },
  });
  const collected = collect();

  assert.notEqual(collected.status, 0);
  assert.match(collected.stderr, /Release evidence bundle validation failed/);
  assert.match(collected.stderr, /app_state_summary\.app_state/);
});

test('release evidence collector can attach externally produced contracted artifacts', () => {
  const { tempRoot, bundleDir, collect } = collectorFixture('opl-app-release-evidence-collector-attach-');
  const externalEvidence = path.join(tempRoot, 'external-evidence');
  writeScreenshotPng(path.join(externalEvidence, 'runtime.png'));
  writeScreenshotPng(path.join(externalEvidence, 'full.png'));
  writeScreenshotPng(path.join(externalEvidence, 'action.png'));
  writeVmSmokeSummaryFiles(externalEvidence);
  writeAssistantRouteSmokeScreenshots(externalEvidence);
  writeRemoteReleaseVerificationSummary(externalEvidence);

  const collected = collect([
    '--execute-action',
    '--version',
    '26.6.5',
    '--artifact',
    `runtime_screenshot=${path.join(externalEvidence, 'runtime.png')}`,
    '--artifact',
    `full_screenshot=${path.join(externalEvidence, 'full.png')}`,
    '--artifact',
    `action_screenshot=${path.join(externalEvidence, 'action.png')}`,
    '--artifact',
    `first_run_vm_summary=${path.join(externalEvidence, 'tart-smoke-summary.json')}`,
    '--artifact',
    `guest_smoke_summary=${path.join(externalEvidence, 'artifacts', 'smoke-summary.json')}`,
    '--artifact',
    `assistant_route_smoke_summary=${path.join(externalEvidence, 'artifacts', 'assistant-route-smoke-summary.json')}`,
    '--artifact',
    `codex_functional_check_summary=${path.join(externalEvidence, 'artifacts', 'codex-functional-check-summary.json')}`,
    '--artifact',
    `codex_ai_self_check_summary=${path.join(externalEvidence, 'artifacts', 'codex-ai-self-check-summary.json')}`,
    '--artifact',
    `assistant_route_smoke_mas_screenshot=${path.join(externalEvidence, 'artifacts', 'assistant-route-smoke', 'mas.png')}`,
    '--artifact',
    `assistant_route_smoke_mag_screenshot=${path.join(externalEvidence, 'artifacts', 'assistant-route-smoke', 'mag.png')}`,
    '--artifact',
    `assistant_route_smoke_rca_screenshot=${path.join(externalEvidence, 'artifacts', 'assistant-route-smoke', 'rca.png')}`,
    '--artifact',
    `remote_release_verification=${path.join(externalEvidence, 'remote-release-verification.json')}`,
  ]);
  assertPassedBundle(bundleDir, parseCollectedPayload(collected));
});

test('release evidence collector imports standard smoke source directories without hand-mapping every artifact', () => {
  const { tempRoot, bundleDir, collect } = collectorFixture('opl-app-release-evidence-collector-source-dir-');
  const sourceDir = path.join(tempRoot, 'standard-smoke-source');
  const overrideEvidence = path.join(tempRoot, 'override-evidence');

  writeVmSmokeSummaryFiles(sourceDir);
  writeAssistantRouteSmokeScreenshots(sourceDir);
  writeScreenshotPng(path.join(sourceDir, 'first-run-beginner.png'));
  writeScreenshotPng(path.join(sourceDir, 'action.png'));
  writeScreenshotPng(path.join(sourceDir, 'settings-pages', 'runtime.png'), 1, 1);
  writeRemoteReleaseVerificationSummary(sourceDir);
  writeScreenshotPng(path.join(overrideEvidence, 'runtime.png'));

  const collected = collect([
    '--execute-action',
    '--version',
    '26.6.5',
    '--evidence-source-dir',
    sourceDir,
    '--artifact',
    `runtime_screenshot=${path.join(overrideEvidence, 'runtime.png')}`,
  ]);

  const payload = parseCollectedPayload(collected);
  assertPassedBundle(bundleDir, payload);
  assert.equal(
    fileSha256(path.join(bundleDir, 'screenshots', 'runtime.png')),
    fileSha256(path.join(overrideEvidence, 'runtime.png')),
  );
});

test('release evidence collector imports typed blockers as blocked evidence', () => {
  const { tempRoot, bundleDir, collect } = collectorFixture('opl-app-release-evidence-collector-blocker-');
  const sourceDir = path.join(tempRoot, 'standard-smoke-source');
  const blockerRoot = path.join(tempRoot, 'blockers');

  writeScreenshotPng(path.join(sourceDir, 'runtime.png'));
  writeScreenshotPng(path.join(sourceDir, 'first-run-beginner.png'));
  writeScreenshotPng(path.join(sourceDir, 'action.png'));
  writeVmSmokeSummaryFiles(sourceDir);
  writeAssistantRouteSmokeScreenshots(sourceDir);
  writeRemoteReleaseVerificationSummary(sourceDir);
  fs.rmSync(path.join(sourceDir, 'tart-smoke-summary.json'), { force: true });
  writeTypedBlockerFile(blockerRoot, 'first_run_vm_summary', {
    typed_blocker_ref: 'typed_blocker_ref://one-person-lab-app/test/collector-first-run-vm-summary',
  });

  const collected = collect([
    '--execute-action',
    '--evidence-source-dir',
    sourceDir,
    '--typed-blocker',
    `first_run_vm_summary=${path.join(blockerRoot, 'typed-blockers', 'first_run_vm_summary.json')}`,
  ]);

  const payload = parseCollectedPayload(collected);
  assert.equal(payload.status, 'blocked_evidence');
  assert.equal(payload.packaged_app_evidence, false);
  assert.deepEqual(payload.attached_artifacts, [
    ...completeAttachedArtifacts.filter((id) => id !== 'first_run_vm_summary'),
    'first_run_vm_summary:typed_blocker',
  ]);
  assert.equal(payload.blocked_artifact_count, 1);
  assert.deepEqual(payload.blocked_artifacts, ['first_run_vm_summary']);
  assert.equal(payload.missing_artifact_count, 0);

  const validationPayload = validateBundle(bundleDir, true);
  assert.equal(validationPayload.status, 'blocked_evidence');
  assert.equal(validationPayload.verified_artifact_count, 15);
  assert.equal(validationPayload.blocked_artifact_count, 1);
  assert.equal(
    validationPayload.blocked_artifacts[0].typed_blocker_ref,
    'typed_blocker_ref://one-person-lab-app/test/collector-first-run-vm-summary',
  );
});

test('release evidence bundle validator rejects non-canonical typed blocker paths', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-blocker-path-'));
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeRemoteReleaseVerificationSummary(tempRoot);
  fs.rmSync(path.join(tempRoot, 'tart-smoke-summary.json'), { force: true });
  writeTypedBlockerFile(tempRoot, 'first_run_vm_summary');

  const generated = runNode([
    'scripts/write-release-evidence-manifest.ts',
    '--bundle-dir',
    tempRoot,
  ]);
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);

  const manifestPath = path.join(tempRoot, 'evidence-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const blockedArtifact = manifest.artifacts.find((artifact) => artifact.id === 'first_run_vm_summary');
  const blockedEvidence = manifest.blocked_evidence.find((artifact) => artifact.id === 'first_run_vm_summary');
  blockedArtifact.typed_blocker_path = 'typed-blockers/noncanonical-first-run-vm-summary.json';
  blockedEvidence.typed_blocker_path = blockedArtifact.typed_blocker_path;
  fs.copyFileSync(
    path.join(tempRoot, 'typed-blockers', 'first_run_vm_summary.json'),
    path.join(tempRoot, blockedArtifact.typed_blocker_path),
  );
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const validation = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ]);

  assert.notEqual(validation.status, 0);
  assert.match(validation.stderr, /typed_blocker_path must match typed-blockers\/<artifact_id>\.json/);
});
