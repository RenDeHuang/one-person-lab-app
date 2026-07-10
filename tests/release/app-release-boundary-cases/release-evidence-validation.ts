import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  runNode,
  writeFile,
  writeScreenshotPng,
  writeAssistantRouteSmokeScreenshots,
  writeRuntimeEvidenceJsonFiles,
  writeVmSmokeSummaryFiles,
  releaseEvidenceCohort,
  writeRemoteReleaseVerificationSummary,
  writeDockerWebuiCleanVmEvidenceSummary,
} from './helpers.ts';

const requiredArtifacts = JSON.parse(
  fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
).operator_evidence_bundle.required_artifacts;

function presentArtifacts() {
  return requiredArtifacts.map((artifact) => ({ ...artifact, status: 'present' }));
}

function writeEvidenceManifest(tempRoot, fields) {
  writeFile(path.join(tempRoot, 'evidence-manifest.json'), JSON.stringify({
    schema_version: 1,
    purpose: 'app_release_evidence_bundle',
    acceptance_path: 'Runtime page',
    runtime_page_contract: 'contracts/app-page-state-matrix.json#runtime',
    refs_only: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    missing_evidence: [],
    blocked_evidence: [],
    ...fields,
  }));
}

function writeEvidenceScreenshots(tempRoot, ids = ['runtime', 'full', 'action']) {
  for (const id of ids) writeScreenshotPng(path.join(tempRoot, 'screenshots', id + '.png'));
}

function writePackagedEvidenceFiles(tempRoot, options = {}) {
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeVmSmokeSummaryFiles(tempRoot);
  writeAssistantRouteSmokeScreenshots(tempRoot);
  writeRemoteReleaseVerificationSummary(tempRoot, options.remoteVersion);
  writeDockerWebuiCleanVmEvidenceSummary(tempRoot, options.dockerWebuiCleanVmEvidence);
  writeEvidenceScreenshots(tempRoot, options.screenshotIds);
}

function evidenceGaps(artifacts) {
  return artifacts.filter((artifact) => artifact.status === 'missing').map((artifact) => ({
    id: artifact.id,
    path: artifact.path,
    status: artifact.status,
    reason: artifact.missing_reason ?? artifact.reason,
    ...(artifact.typed_blocker_ref ? { typed_blocker_ref: artifact.typed_blocker_ref } : {}),
    ...(artifact.not_applicable_reason ? { not_applicable_reason: artifact.not_applicable_reason } : {}),
  }));
}

function validateBundle(tempRoot, allowMissing = false) {
  return runNode([
    'scripts/validate-release-evidence-bundle.ts',
    '--bundle-dir',
    tempRoot,
    ...(allowMissing ? ['--allow-missing-evidence'] : []),
  ]);
}

test('release evidence bundle validator accepts the declared Runtime page artifact set', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-'));
  writeEvidenceManifest(tempRoot, {
    status: 'passed',
    packaged_app_evidence: true,
    release_cohort: releaseEvidenceCohort(),
    current_cohort_evidence: true,
    artifacts: presentArtifacts(),
  });
  writePackagedEvidenceFiles(tempRoot);

  const result = validateBundle(tempRoot);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual({
    status: payload.status,
    packaged_app_evidence: payload.packaged_app_evidence,
    release_cohort: payload.release_cohort,
    current_cohort_evidence: payload.current_cohort_evidence,
    evidence_boundary: payload.evidence_boundary,
    verified_artifact_count: payload.verified_artifact_count,
    verified_diagnostic_count: payload.verified_diagnostic_count,
    missing_artifact_count: payload.missing_artifact_count,
  }, {
    status: 'passed',
    packaged_app_evidence: true,
    release_cohort: releaseEvidenceCohort(),
    current_cohort_evidence: true,
    evidence_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    verified_artifact_count: 16,
    verified_diagnostic_count: 0,
    missing_artifact_count: 0,
  });
  assert.deepEqual(payload.verified_artifacts.map((artifact) => artifact.id), requiredArtifacts.map((artifact) => artifact.id));
});

test('release evidence bundle validator fails closed for incomplete packaged App evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-release-evidence-missing-'));
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
  const artifacts = requiredArtifacts.map((artifact) => missingArtifactIds.has(artifact.id)
    ? { ...artifact, status: 'missing', missing_reason: artifact.producer + ' was not generated in this environment' }
    : { ...artifact, status: 'present' });
  writeEvidenceManifest(tempRoot, {
    status: 'missing_evidence',
    packaged_app_evidence: false,
    artifacts,
    missing_evidence: evidenceGaps(artifacts),
  });
  writeRuntimeEvidenceJsonFiles(tempRoot);
  writeEvidenceScreenshots(tempRoot);

  const blocked = validateBundle(tempRoot);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /cannot be used as packaged App evidence/);

  const allowed = validateBundle(tempRoot, true);
  assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
  const payload = JSON.parse(allowed.stdout);
  assert.deepEqual({
    status: payload.status,
    packaged_app_evidence: payload.packaged_app_evidence,
    verified_artifact_count: payload.verified_artifact_count,
    missing_artifact_count: payload.missing_artifact_count,
    missing_artifacts: payload.missing_artifacts.map((artifact) => artifact.id),
  }, {
    status: 'missing_evidence',
    packaged_app_evidence: false,
    verified_artifact_count: 8,
    missing_artifact_count: 8,
    missing_artifacts: [...missingArtifactIds],
  });
});
