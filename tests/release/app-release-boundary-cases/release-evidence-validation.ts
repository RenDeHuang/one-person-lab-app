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
  releaseEvidenceCohort,
  writeRemoteReleaseVerificationSummary,
  writeDockerWebuiCleanVmEvidenceSummary,
} from './helpers.ts';

function readReleaseContract() {
  return JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
}

function presentArtifacts(artifacts) {
  return artifacts.map((artifact) => ({ ...artifact, status: 'present' }));
}

function writeEvidenceManifest(tempRoot, fields) {
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), `${JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    missing_evidence: [],
    blocked_evidence: [],
    ...fields,
  }, null, 2)}\n`);
}

function writeEvidenceScreenshots(tempRoot, ids = ['runtime', 'full', 'action']) {
  for (const id of ids) {
    writeScreenshotPng(path.join(tempRoot, 'screenshots', `${id}.png`));
  }
}

function writePackagedEvidenceFiles(tempRoot, options = {}) {
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeRemoteReleaseVerificationSummary(tempRoot, options.remoteVersion);
  writeDockerWebuiCleanVmEvidenceSummary(tempRoot, options.dockerWebuiCleanVmEvidence);
  writeEvidenceScreenshots(tempRoot, options.screenshotIds);
}

function evidenceGaps(artifacts, predicate) {
  return artifacts
    .filter(predicate)
    .map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      status: artifact.status,
      reason: artifact.missing_reason ?? artifact.reason,
      ...(artifact.typed_blocker_ref ? { typed_blocker_ref: artifact.typed_blocker_ref } : {}),
      ...(artifact.not_applicable_reason ? { not_applicable_reason: artifact.not_applicable_reason } : {}),
    }));
}

test('release evidence bundle validator accepts the declared Runtime page artifact set', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-'));
  const releaseContract = readReleaseContract();
  const artifacts = releaseContract.operator_evidence_bundle.required_artifacts;
  writeEvidenceManifest(tempRoot, {
    status: 'passed',
    packaged_app_evidence: true,
    release_cohort: releaseEvidenceCohort(),
    current_cohort_evidence: true,
    artifacts: presentArtifacts(artifacts),
  });
  writePackagedEvidenceFiles(tempRoot);

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
  assert.deepEqual(payload.release_cohort, releaseEvidenceCohort());
  assert.equal(payload.current_cohort_evidence, true);
  assert.deepEqual(payload.l5_evidence_readout.release_cohort, releaseEvidenceCohort());
  assert.equal(payload.l5_evidence_readout.current_cohort_evidence, true);
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

test('release evidence bundle validator fails closed for incomplete packaged App evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-missing-'));
  const releaseContract = readReleaseContract();
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
  writeEvidenceManifest(tempRoot, {
    status: 'missing_evidence',
    packaged_app_evidence: false,
    artifacts,
    missing_evidence: evidenceGaps(artifacts, (artifact) => artifact.status === 'missing'),
  });
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeEvidenceScreenshots(tempRoot);

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
