import {
  assert,
  fs,
  os,
  path,
  spawnSync,
  test,
  appRoot,
  runNode,
  writeFile,
  writeScreenshotPng,
  writeWebpVp8x,
  writeAssistantRouteSmokeScreenshots,
  writeRuntimeEvidenceJsonFiles,
  writeVmSmokeSummaryFiles,
} from './helpers.ts';

test('release evidence bundle validator accepts the declared Runtime page artifact set', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts;
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: artifacts.map((artifact) => ({ ...artifact, status: 'present' })),
    missing_evidence: [],
    blocked_evidence: [],
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'passed');
  assert.equal(payload.bundle_dir, tempRoot);
  assert.equal(payload.manifest_path, 'evidence-manifest.json');
  assert.equal(payload.packaged_app_evidence, true);
  assert.equal(
    payload.evidence_boundary,
    'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
  );
  assert.equal(payload.verified_artifact_count, 16);
  assert.equal(payload.verified_diagnostic_count, 0);
  assert.equal(payload.missing_artifact_count, 0);
  assert.deepEqual(
    payload.verified_artifacts.map((artifact) => artifact.id),
    [
      'app_state_summary',
      'app_state_full',
      'drilldown_full',
      'action_dry_run_result',
      'action_execute_result',
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
    ],
  );
});

test('release evidence bundle validator rejects Codex functional checks without packaged route receipt coverage', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-weak-codex-check-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts;
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: artifacts.map((artifact) => ({ ...artifact, status: 'present' })),
    missing_evidence: [],
    blocked_evidence: [],
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeFile(
    path.join(tempRoot, 'artifacts', 'codex-functional-check-summary.json'),
    `${JSON.stringify({
      schema: 'opl_codex_functional_check_receipt.v1',
      status: 'diagnostic_skipped',
      blocking_release_gate: {
        stable_vm_gate: 'receipt_file_exists_and_deterministic_fields_passed',
        deterministic_fields_passed: true,
        llm_invocation_required: false,
      },
    })}\n`,
  );
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /assistant route receipts/i);
});

test('release evidence bundle validator accepts optional Codex AI self-check diagnostics without making them required', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-ai-diagnostic-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const requiredArtifacts = releaseContract.operator_evidence_bundle.required_artifacts;
  const diagnostics = releaseContract.operator_evidence_bundle.optional_diagnostic_artifacts;
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: requiredArtifacts.map((artifact) => ({ ...artifact, status: 'present' })),
    diagnostics: diagnostics.map((artifact) => ({ ...artifact, status: 'present' })),
    missing_evidence: [],
    blocked_evidence: [],
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'passed');
  assert.equal(payload.verified_artifact_count, 16);
  assert.equal(payload.verified_diagnostic_count, 1);
  assert.deepEqual(payload.verified_diagnostics.map((artifact) => artifact.id), [
    'codex_ai_self_check_summary',
  ]);
  assert.equal(payload.missing_artifact_count, 0);
});

test('release evidence bundle validator fails closed for incomplete packaged App evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-missing-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const missingArtifactIds = new Set([
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
  ]);
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => (
    missingArtifactIds.has(artifact.id)
      ? {
          ...artifact,
          status: 'missing',
          missing_reason: `${artifact.producer} was not generated in this environment`,
        }
      : {
          ...artifact,
          status: 'present',
        }
  ));
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'missing_evidence',
    packaged_app_evidence: false,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts,
    missing_evidence: artifacts
    .filter((artifact) => artifact.status === 'missing')
    .map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      status: artifact.status,
      reason: artifact.missing_reason,
    })),
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const blocked = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /cannot be used as packaged App evidence/);

  const allowed = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ]);

  assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
  const payload = JSON.parse(allowed.stdout);
  assert.equal(payload.status, 'missing_evidence');
  assert.equal(payload.packaged_app_evidence, false);
  assert.equal(payload.verified_artifact_count, 8);
  assert.equal(payload.missing_artifact_count, 8);
  assert.deepEqual(payload.missing_artifacts.map((artifact) => artifact.id), [
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
  ]);
});

test('release evidence bundle validator classifies typed blockers and not-applicable artifacts without packaged evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-classified-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const nonPresentById = new Map([
    ['first_run_vm_summary', {
      status: 'typed_blocker',
      reason: 'clean VM host is unavailable for this cohort',
      typed_blocker_ref: 'github-actions:opl-first-run-vm#blocked-no-runner',
    }],
    ['guest_smoke_summary', {
      status: 'not_applicable',
      reason: 'draft evidence cohort did not package a launchable app',
      not_applicable_reason: 'draft_evidence_only_no_packaged_app',
    }],
  ]);
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => (
    nonPresentById.has(artifact.id)
      ? {
          ...artifact,
          ...nonPresentById.get(artifact.id),
        }
      : {
          ...artifact,
          status: 'present',
        }
  ));
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'missing_evidence',
    packaged_app_evidence: false,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts,
    missing_evidence: artifacts
      .filter((artifact) => artifact.status !== 'present')
      .map((artifact) => ({
        id: artifact.id,
        path: artifact.path,
        status: artifact.status,
        reason: artifact.reason,
        ...(artifact.typed_blocker_ref ? { typed_blocker_ref: artifact.typed_blocker_ref } : {}),
        ...(artifact.not_applicable_reason ? { not_applicable_reason: artifact.not_applicable_reason } : {}),
      })),
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const blocked = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /cannot be used as packaged App evidence/);

  const allowed = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ]);

  assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
  const payload = JSON.parse(allowed.stdout);
  assert.equal(payload.status, 'missing_evidence');
  assert.equal(payload.packaged_app_evidence, false);
  assert.equal(payload.verified_artifact_count, 14);
  assert.equal(payload.missing_artifact_count, 2);
  assert.deepEqual(
    payload.missing_artifacts.map((artifact) => [artifact.id, artifact.status]),
    [
      ['first_run_vm_summary', 'typed_blocker'],
      ['guest_smoke_summary', 'not_applicable'],
    ],
  );
  assert.equal(
    payload.missing_artifacts.find((artifact) => artifact.id === 'first_run_vm_summary').typed_blocker_ref,
    'github-actions:opl-first-run-vm#blocked-no-runner',
  );
  assert.equal(
    payload.missing_artifacts.find((artifact) => artifact.id === 'guest_smoke_summary').not_applicable_reason,
    'draft_evidence_only_no_packaged_app',
  );
});

test('release evidence manifest generator applies explicit artifact classifications', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-classified-generated-'));
  const classificationPath = path.join(tempRoot, 'artifact-classifications.json');
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));
  writeFile(path.join(classificationPath), `${JSON.stringify({
    artifact_classifications: [
      {
        id: 'first_run_vm_summary',
        status: 'typed_blocker',
        reason: 'clean VM host is unavailable for this cohort',
        typed_blocker_ref: 'github-actions:opl-first-run-vm#blocked-no-runner',
      },
      {
        id: 'guest_smoke_summary',
        status: 'not_applicable',
        reason: 'draft evidence cohort did not package a launchable app',
        not_applicable_reason: 'draft_evidence_only_no_packaged_app',
      },
    ],
  }, null, 2)}\n`);

  const generated = runNode([
    'scripts/write-release-evidence-manifest.ts',
    '--bundle-dir',
    tempRoot,
    '--classification',
    classificationPath,
  ]);

  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  const generatedPayload = JSON.parse(generated.stdout);
  assert.equal(generatedPayload.status, 'missing_evidence');
  assert.equal(generatedPayload.packaged_app_evidence, false);

  const manifest = JSON.parse(fs.readFileSync(path.join(tempRoot, 'evidence-manifest.json'), 'utf8'));
  assert.deepEqual(
    manifest.missing_evidence.map((artifact) => [artifact.id, artifact.status]),
    [
      ['first_run_vm_summary', 'typed_blocker'],
      ['guest_smoke_summary', 'not_applicable'],
      ['assistant_route_smoke_summary', 'missing'],
      ['codex_functional_check_summary', 'missing'],
      ['assistant_route_smoke_mas_screenshot', 'missing'],
      ['assistant_route_smoke_mag_screenshot', 'missing'],
      ['assistant_route_smoke_rca_screenshot', 'missing'],
      ['remote_release_verification', 'missing'],
    ],
  );
  assert.equal(
    manifest.missing_evidence.find((artifact) => artifact.id === 'first_run_vm_summary').typed_blocker_ref,
    'github-actions:opl-first-run-vm#blocked-no-runner',
  );
  assert.equal(
    manifest.missing_evidence.find((artifact) => artifact.id === 'guest_smoke_summary').not_applicable_reason,
    'draft_evidence_only_no_packaged_app',
  );
});

test('release evidence bundle validator rejects contract-only runtime JSON placeholders', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-placeholder-'));
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => ({
      ...artifact,
      status: 'present',
    })),
    missing_evidence: [],
    blocked_evidence: [],
  }, null, 2)}\n`);
  for (const name of [
    'app-state-summary.json',
    'app-state-full.json',
    'drilldown-full.json',
    'action-dry-run-result.json',
    'action-execute-result.json',
    'artifacts/assistant-route-smoke-summary.json',
    'remote-release-verification.json',
  ]) {
    writeFile(path.join(tempRoot, name), '{"status":"passed","refs_only":true}\n');
  }
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /app_state_summary\.app_state/);
});

test('release evidence bundle validator rejects undersized WebP screenshot evidence', () => {
  const tempAppRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-webp-contract-'));
  const tempRoot = path.join(tempAppRoot, 'release-evidence');
  const tempScriptPath = path.join(tempAppRoot, 'scripts', 'validate-release-evidence-bundle.ts');
  const tempContractPath = path.join(tempAppRoot, 'contracts', 'app-release-channel.json');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  fs.mkdirSync(path.dirname(tempScriptPath), { recursive: true });
  fs.copyFileSync(path.join(appRoot, 'scripts', 'validate-release-evidence-bundle.ts'), tempScriptPath);
  releaseContract.operator_evidence_bundle.required_artifacts = releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => (
    artifact.id === 'runtime_screenshot'
      ? { ...artifact, path: 'screenshots/runtime.webp', status: 'present' }
      : { ...artifact, status: 'present' }
  ));
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts;
  writeFile(tempContractPath, `${JSON.stringify(releaseContract, null, 2)}\n`);
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'passed',
    packaged_app_evidence: true,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts,
    missing_evidence: [],
    blocked_evidence: [],
  }, null, 2)}\n`);
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeFile(path.join(tempRoot, 'remote-release-verification.json'), '{"status":"passed","include_full_package":true,"verified_asset_count":10,"full_first_install_budget":{"status":"passed"}}\n');
  writeWebpVp8x(path.join(tempRoot, 'screenshots', 'runtime.webp'), 1, 1);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    tempScriptPath,
    '--bundle-dir',
    tempRoot,
  ], {
    cwd: tempAppRoot,
    encoding: 'utf8',
    env: process.env,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /runtime_screenshot must be at least 640x360px screenshot evidence/);
});

test('release evidence bundle validator rejects image policy without image scope', () => {
  const tempAppRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-image-policy-'));
  const tempRoot = path.join(tempAppRoot, 'release-evidence');
  const tempScriptPath = path.join(tempAppRoot, 'scripts', 'validate-release-evidence-bundle.ts');
  const tempContractPath = path.join(tempAppRoot, 'contracts', 'app-release-channel.json');
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  fs.mkdirSync(path.dirname(tempScriptPath), { recursive: true });
  fs.copyFileSync(path.join(appRoot, 'scripts', 'validate-release-evidence-bundle.ts'), tempScriptPath);
  releaseContract.operator_evidence_bundle.image_evidence_policy.applies_to_kind = 'json';
  writeFile(tempContractPath, `${JSON.stringify(releaseContract, null, 2)}\n`);
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    status: 'missing_evidence',
    packaged_app_evidence: false,
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    artifacts: releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => ({
      ...artifact,
      status: 'missing',
      missing_reason: `${artifact.producer} output was not generated in this environment`,
    })),
    missing_evidence: releaseContract.operator_evidence_bundle.required_artifacts.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      reason: `${artifact.producer} output was not generated in this environment`,
    })),
    blocked_evidence: [],
  }, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    tempScriptPath,
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ], {
    cwd: tempAppRoot,
    encoding: 'utf8',
    env: process.env,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /image evidence policy must apply to image artifacts/);
});

test('release evidence manifest generator records missing artifacts without claiming packaged App evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-generated-'));
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'runtime.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'full.png'));
  writeScreenshotPng(path.join(tempRoot, 'screenshots', 'action.png'));

  const generated = runNode([
    'scripts/write-release-evidence-manifest.ts',
    '--bundle-dir',
    tempRoot,
  ]);

  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  const generatedPayload = JSON.parse(generated.stdout);
  assert.equal(generatedPayload.status, 'missing_evidence');
  assert.equal(generatedPayload.packaged_app_evidence, false);
  assert.equal(generatedPayload.missing_artifact_count, 8);
  assert.deepEqual(generatedPayload.missing_artifacts.map((artifact) => artifact.id), [
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
  ]);

  const manifest = JSON.parse(fs.readFileSync(path.join(tempRoot, 'evidence-manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'missing_evidence');
  assert.equal(manifest.packaged_app_evidence, false);
  assert.deepEqual(manifest.diagnostics, []);
  assert.deepEqual(manifest.missing_evidence.map((artifact) => artifact.id), [
    'first_run_vm_summary',
    'guest_smoke_summary',
    'assistant_route_smoke_summary',
    'codex_functional_check_summary',
    'assistant_route_smoke_mas_screenshot',
    'assistant_route_smoke_mag_screenshot',
    'assistant_route_smoke_rca_screenshot',
    'remote_release_verification',
  ]);

  const validation = runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
    '--allow-missing-evidence',
  ]);

  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
  const validationPayload = JSON.parse(validation.stdout);
  assert.equal(validationPayload.status, 'missing_evidence');
  assert.equal(validationPayload.packaged_app_evidence, false);
});
