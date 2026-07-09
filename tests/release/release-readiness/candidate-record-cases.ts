import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  appRoot,
  runCandidateRecord,
  runCandidateRecordValidator,
  writeJson,
  writePassingJobResults,
} from './helpers.ts';

function releaseOwnerVerdict(status = 'release_owner_verdict_pending') {
  return {
    schema: 'opl_app_release_owner_verdict_readout.v1',
    scope: 'same_cohort_app_release_user_path_owner_verdict',
    owner: 'one-person-lab-app release owner',
    status,
    release_ready_claim: false,
    stable_latest_promotion_claim: false,
    family_production_ready_claim: false,
    release_owner_verdict_ref: null,
    release_owner_receipt_ref: null,
    install_evidence_ref:
      'install_evidence_ref://one-person-lab-app/release-owner/v26.5.99/install-evidence',
    release_owner_typed_blocker_ref:
      'typed_blocker_ref://one-person-lab-app/release-owner/v26.5.99/verdict-pending',
    typed_blocker_ref:
      'typed_blocker_ref://one-person-lab-app/release-owner/v26.5.99/verdict-pending',
  };
}

function runReleaseOwnerCandidateVerifier(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/verify-release-owner-candidate-record.ts', ...args],
    { cwd: appRoot, encoding: 'utf8', env: { ...process.env } },
  );
}

function runReleaseOwnerResolver(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/resolve-release-owner-candidate-record.ts', ...args],
    { cwd: appRoot, encoding: 'utf8', env: { ...process.env } },
  );
}

function runGateReusePlan(args: string[]) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/plan-release-gate-reuse.ts', ...args],
    { cwd: appRoot, encoding: 'utf8', env: { ...process.env } },
  );
}

function gateReuseFixture(root: string, options: { currentAssetSha?: string } = {}) {
  const version = '26.5.99';
  const currentPreflightPath = path.join(root, 'current-preflight.json');
  const currentRemotePath = path.join(root, 'current-remote-verification.json');
  const previousCandidatePath = path.join(root, 'previous-candidate-record.json');
  const previousReadinessPath = path.join(root, 'previous-readiness-summary.json');
  const previousRemotePath = path.join(root, 'previous-remote-verification.json');
  const outputPath = path.join(root, 'release-gate-reuse-plan.json');
  const markdownPath = path.join(root, 'release-gate-reuse-plan.md');
  const appCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const standardAsset = {
    name: `One-Person-Lab-${version}-mac-arm64.dmg`,
    size: 512,
    sha256: options.currentAssetSha ?? 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  };
  const previousStandardAsset = {
    ...standardAsset,
    sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  };
  const gates = Object.fromEntries([
    'remote_release_verification',
    'standard_dmg_clean_vm',
    'stable_homebrew_tap_update',
    'full_homebrew_tap_update',
    'homebrew_standard_cask_clean_vm',
    'full_dmg_clean_vm',
    'one_shot_app_installer',
    'docker_webui',
    'webui_ghcr_publish',
    'full_size_cache_timing',
    'operator_evidence_bundle',
  ].map((gateId) => [gateId, {
    status: 'passed',
    required: true,
    artifact_name: `${gateId}-${version}`,
    artifact_path: `${gateId}-${version}/summary.json`,
  }]));

  writeJson(currentPreflightPath, {
    schema: 'opl_release_preflight.v1',
    status: 'passed',
    release_refs: [
      {
        repository: 'gaofeng21cn/opl-aion-shell',
        ref: 'main',
        resolved_sha: '1111111111111111111111111111111111111111',
      },
      {
        repository: 'gaofeng21cn/one-person-lab',
        ref: 'main',
        resolved_sha: '2222222222222222222222222222222222222222',
      },
    ],
  });
  writeJson(currentRemotePath, {
    schema: 'opl_remote_release_verification.v1',
    status: 'passed',
    version,
    verified_assets: [standardAsset],
  });
  writeJson(previousCandidatePath, {
    schema: 'opl_release_candidate_record.v1',
    status: 'ready_to_promote',
    version,
    release_mode: 'refresh_existing',
    inputs: {
      include_full_package: true,
      run_vm_smoke: true,
      shell_ref: 'main',
      framework_ref: 'main',
    },
    provenance: { app_commit: appCommit },
    resolved_refs: {
      opl_framework: { ref: 'main', commit: '2222222222222222222222222222222222222222' },
    },
    decision: { can_promote: true },
  });
  writeJson(previousReadinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version,
    gates,
  });
  writeJson(previousRemotePath, {
    schema: 'opl_remote_release_verification.v1',
    status: 'passed',
    version,
    verified_assets: [previousStandardAsset],
  });

  return {
    version,
    appCommit,
    currentPreflightPath,
    currentRemotePath,
    previousCandidatePath,
    previousReadinessPath,
    previousRemotePath,
    outputPath,
    markdownPath,
  };
}

function runGateReuseFixture(fixture: ReturnType<typeof gateReuseFixture>) {
  return runGateReusePlan([
    '--version',
    fixture.version,
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--app-commit',
    fixture.appCommit,
    '--shell-ref',
    'main',
    '--framework-ref',
    'main',
    '--current-preflight',
    fixture.currentPreflightPath,
    '--current-remote-verification',
    fixture.currentRemotePath,
    '--previous-candidate-record',
    fixture.previousCandidatePath,
    '--previous-readiness',
    fixture.previousReadinessPath,
    '--previous-remote-verification',
    fixture.previousRemotePath,
    '--output',
    fixture.outputPath,
    '--markdown',
    fixture.markdownPath,
  ]);
}

function candidateInputs(root: string, options: {
  includeOwnerVerdict?: boolean;
  ownerVerdictStatus?: string;
  readiness?: Record<string, unknown>;
  remote?: Record<string, unknown>;
  withJobResults?: boolean;
} = {}) {
  const paths = {
    preflightPath: path.join(root, 'release-preflight-summary.json'),
    readinessPath: path.join(root, 'release-readiness-summary.json'),
    remotePath: path.join(root, 'remote-release-verification.json'),
    jobResultsPath: path.join(root, 'release-readiness-job-results.json'),
    outputPath: path.join(root, 'release-candidate-record.json'),
    markdownPath: path.join(root, 'release-candidate-record.md'),
  };
  writeJson(paths.preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(paths.readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
    ...(options.includeOwnerVerdict === false
      ? {}
      : { release_owner_verdict: releaseOwnerVerdict(options.ownerVerdictStatus) }),
    ...options.readiness,
  });
  writeJson(paths.remotePath, {
    status: 'passed',
    version: '26.5.99',
    verified_asset_count: 10,
    ...options.remote,
  });
  if (options.withJobResults) {
    writePassingJobResults(paths.jobResultsPath);
  }
  return paths;
}

function candidateRecordArgs(
  paths: ReturnType<typeof candidateInputs>,
  options: {
    releaseMode?: string;
    appCommit?: string;
    workflowRunId?: string;
    shellRef?: string;
    frameworkRef?: string;
    withJobResults?: boolean;
    markdown?: boolean;
    outputPath?: string;
    extra?: string[];
  } = {},
) {
  return [
    '--version',
    '26.5.99',
    '--release-mode',
    options.releaseMode ?? 'new_release',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    ...(options.appCommit ? ['--app-commit', options.appCommit] : []),
    ...(options.workflowRunId ? ['--workflow-run-id', options.workflowRunId] : []),
    ...(options.shellRef ? ['--shell-ref', options.shellRef] : []),
    ...(options.frameworkRef ? ['--framework-ref', options.frameworkRef] : []),
    '--preflight',
    paths.preflightPath,
    '--readiness',
    paths.readinessPath,
    '--remote-verification',
    paths.remotePath,
    ...(options.withJobResults ? ['--job-results', paths.jobResultsPath] : []),
    ...(options.extra ?? []),
    '--output',
    options.outputPath ?? paths.outputPath,
    ...(options.markdown ? ['--markdown', paths.markdownPath] : []),
  ];
}

function writeReleaseOwnerVerificationArtifacts(
  artifactsDir: string,
  options: { withAddonReadiness?: boolean } = {},
) {
  writeJson(path.join(artifactsDir, 'release-preflight-summary.json'), {
    schema: 'opl_release_preflight.v1',
    status: 'passed',
  });
  writeJson(path.join(artifactsDir, 'release-readiness-summary.json'), {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
    release_owner_verdict: releaseOwnerVerdict(),
    full_package: {
      resolved_refs: {
        opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
      },
    },
  });
  writeJson(path.join(artifactsDir, 'remote-release-verification.json'), {
    status: 'passed',
    version: '26.5.99',
    include_full_package: true,
    verified_asset_count: 12,
    full_first_install_budget: { status: 'passed', full_dmg_size_bytes: 512 },
  });
  if (options.withAddonReadiness) {
    writeJson(path.join(artifactsDir, 'release-addon-readiness-summary.json'), {
      schema: 'opl_release_addon_readiness_summary.v1',
      version: '26.5.99',
      release_mode: 'refresh_existing',
      job_results: {
        'full-first-install': 'success',
        'remote-verify-full': 'success',
        'full-first-run-vm-smoke': 'success',
        'docker-webui-smoke': 'success',
        'webui-ghcr-publish': 'success',
        'docker-webui-clean-vm-evidence': 'success',
        'operator-evidence-bundle-validation': 'success',
      },
    });
  }
}

function writeReleaseOwnerReceipt(filePath: string, extra: Record<string, unknown> = {}) {
  writeJson(filePath, {
    schema: 'opl_app_release_owner_receipt_record.v1',
    owner: 'one-person-lab-app release owner',
    scope: 'same_cohort_app_release_user_path_owner_verdict',
    status: 'release_owner_receipt_recorded',
    version: '26.5.99',
    tag: 'v26.5.99',
    channel: 'stable',
    release_owner_receipt_ref:
      'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-test',
    release_ready_claim: false,
    stable_latest_promotion_claim: false,
    family_production_ready_claim: false,
    source_artifact_readback: {
      source_run_id: '12345',
      app_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    authority_boundary: {
      can_claim_app_release_ready_from_evidence: false,
      can_claim_stable_latest_from_evidence: false,
      can_claim_family_production_ready: false,
    },
    ...extra,
  });
}

test('release candidate record blocks complete evidence until release owner records a receipt or verdict', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-record-'));
  const paths = candidateInputs(tempRoot, {
    withJobResults: true,
    readiness: {
      full_package: {
        resolved_refs: {
          opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
        },
      },
    },
    remote: {
      include_full_package: true,
      verified_asset_count: 12,
      full_first_install_budget: { status: 'passed', full_dmg_size_bytes: 512 },
    },
  });

  const result = runCandidateRecord(candidateRecordArgs(paths, {
    releaseMode: 'refresh_existing',
    appCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    workflowRunId: '12345',
    withJobResults: true,
    markdown: true,
  }));

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(paths.outputPath, 'utf8'));
  assert.equal(record.schema, 'opl_release_candidate_record.v1');
  assert.equal(record.status, 'blocked');
  assert.equal(record.version, '26.5.99');
  assert.equal(record.decision.can_promote, false);
  assert.equal(record.release_owner_verdict.status, 'release_owner_verdict_pending');
  assert.match(record.blocked_reasons.join('\n'), /pending/);
  assert.match(record.blocked_reasons.join('\n'), /missing owner resolution ref/);
  const validateResult = runCandidateRecordValidator([
    '--promote-ready',
    '--version',
    '26.5.99',
    '--record',
    paths.outputPath,
  ]);
  assert.notEqual(validateResult.status, 0);
  const validation = JSON.parse(validateResult.stdout);
  assert.equal(validation.promote_ready, false);
  assert.equal(validation.status, 'blocked');
  assert.equal(validation.release_owner_verdict_status, 'release_owner_verdict_pending');
  assert.equal(
    validation.release_owner_typed_blocker_ref,
    'typed_blocker_ref://one-person-lab-app/release-owner/v26.5.99/verdict-pending',
  );
});

test('release candidate record promotes only after same-cohort release owner receipt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-record-owner-receipt-'));
  const paths = candidateInputs(tempRoot, {
    withJobResults: true,
    readiness: {
      full_package: {
        resolved_refs: {
          opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
        },
      },
    },
    remote: {
      include_full_package: true,
      verified_asset_count: 12,
      full_first_install_budget: { status: 'passed', full_dmg_size_bytes: 512 },
    },
  });

  const receiptRef = 'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-20260612';
  const result = runCandidateRecord(candidateRecordArgs(paths, {
    releaseMode: 'refresh_existing',
    appCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    workflowRunId: '12345',
    withJobResults: true,
    extra: ['--release-owner-receipt-ref', receiptRef],
  }));

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(fs.readFileSync(paths.outputPath, 'utf8'));
  assert.equal(record.status, 'ready_to_promote');
  assert.equal(record.decision.can_promote, true);
  assert.equal(record.release_owner_verdict.release_owner_receipt_ref, receiptRef);

  const validateResult = runCandidateRecordValidator([
    '--promote-ready',
    '--version',
    '26.5.99',
    '--record',
    paths.outputPath,
  ]);
  assert.equal(validateResult.status, 0, validateResult.stderr || validateResult.stdout);
  const validation = JSON.parse(validateResult.stdout);
  assert.equal(validation.promote_ready, true);
  assert.equal(validation.release_owner_verdict_status, 'release_owner_receipt_recorded');
  assert.equal(validation.release_owner_receipt_ref, receiptRef);
});

test('release gate reuse plan allows same cohort gates with matching remote asset digests', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-gate-reuse-'));
  const fixture = gateReuseFixture(tempRoot);
  const result = runGateReuseFixture(fixture);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const plan = JSON.parse(fs.readFileSync(fixture.outputPath, 'utf8'));
  assert.equal(plan.schema, 'opl_release_gate_reuse_plan.v1');
  assert.equal(plan.status, 'reuse_available');
  assert.equal(plan.reuse_allowed_count, 11);
  assert.equal(plan.must_run_count, 0);
  assert.match(plan.reuse_digest, /^[a-f0-9]{64}$/);
  assert.equal(plan.cohort.version, fixture.version);
  assert.equal(plan.cohort.app_commit, fixture.appCommit);
  assert.equal(plan.cohort.remote_asset_name_size_sha256[0].sha256, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.equal(plan.authority_boundary.reuse_plan_can_skip_release_gate_by_itself, false);
  assert.equal(plan.authority_boundary.workflow_must_explicitly_consume_reuse_allowed_decision, true);
  assert.ok(plan.decisions.every((decision: { status: string }) => decision.status === 'reuse_allowed'));
});

test('release gate reuse plan forces gates to rerun when remote asset digest changes', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-gate-reuse-digest-mismatch-'));
  const fixture = gateReuseFixture(tempRoot, {
    currentAssetSha: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  });
  const result = runGateReuseFixture(fixture);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const plan = JSON.parse(fs.readFileSync(fixture.outputPath, 'utf8'));
  assert.equal(plan.schema, 'opl_release_gate_reuse_plan.v1');
  assert.equal(plan.status, 'partial_or_blocked');
  assert.equal(plan.reuse_allowed_count, 0);
  assert.equal(plan.must_run_count, 11);
  assert.ok(plan.global_blockers.includes('remote verified asset name/size/sha256 set changed'));
  assert.ok(plan.decisions.every((decision: { status: string; reason: string }) => (
    decision.status === 'must_run' && decision.reason.includes('remote verified asset name/size/sha256 set changed')
  )));
  assert.equal(plan.authority_boundary.reuse_plan_can_claim_release_ready, false);
  assert.equal(plan.authority_boundary.reuse_plan_can_publish_release, false);
});

test('promote owner resolver rebuilds a blocked candidate record without rerunning release gates', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-owner-resolver-'));
  const paths = candidateInputs(tempRoot);
  const blockedCandidatePath = path.join(tempRoot, 'blocked-release-candidate-record.json');
  const resolvedCandidatePath = path.join(tempRoot, 'resolved-release-candidate-record.json');
  const resolvedMarkdownPath = path.join(tempRoot, 'resolved-release-candidate-record.md');

  const blockedResult = runCandidateRecord(candidateRecordArgs(paths, {
    appCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    workflowRunId: '12345',
    shellRef: 'aion-shell-ref',
    frameworkRef: 'framework-ref',
    outputPath: blockedCandidatePath,
    extra: ['--allow-blocked'],
  }));
  assert.equal(blockedResult.status, 0, blockedResult.stderr || blockedResult.stdout);
  assert.equal(JSON.parse(fs.readFileSync(blockedCandidatePath, 'utf8')).status, 'blocked');

  const receiptRef = 'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-promote-owner';
  const resolverResult = runReleaseOwnerResolver([
    '--candidate-record',
    blockedCandidatePath,
    '--preflight',
    paths.preflightPath,
    '--readiness',
    paths.readinessPath,
    '--remote-verification',
    paths.remotePath,
    '--release-owner-receipt-ref',
    receiptRef,
    '--output',
    resolvedCandidatePath,
    '--markdown',
    resolvedMarkdownPath,
  ]);

  assert.equal(resolverResult.status, 0, resolverResult.stderr || resolverResult.stdout);
  const resolverSummary = JSON.parse(resolverResult.stdout);
  const resolved = JSON.parse(fs.readFileSync(resolvedCandidatePath, 'utf8'));
  assert.equal(resolverSummary.schema, 'opl_release_owner_resolution_candidate_record.v1');
  assert.equal(resolverSummary.status, 'ready_to_promote');
  assert.equal(resolved.status, 'ready_to_promote');
  assert.equal(resolved.provenance.workflow_run_id, '12345');
  assert.equal(resolved.inputs.shell_ref, 'aion-shell-ref');
  assert.equal(resolved.release_owner_verdict.release_owner_receipt_ref, receiptRef);
  assert.equal(fs.existsSync(resolvedMarkdownPath), true);
});

test('new release candidate record remains blocked without owner receipt or verdict ref', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-record-new-release-missing-owner-'));
  const paths = candidateInputs(tempRoot);

  const result = runCandidateRecord(candidateRecordArgs(paths));

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(paths.outputPath, 'utf8'));
  assert.equal(record.status, 'blocked');
  assert.match(
    record.blocked_reasons.join('\n'),
    /promotion requires release_owner_verdict_ref or release_owner_receipt_ref/,
  );
});

test('candidate record rejects cross-cohort owner receipt ref as blocked', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-record-cross-cohort-owner-receipt-'));
  const paths = candidateInputs(tempRoot);

  const result = runCandidateRecord(candidateRecordArgs(paths, {
    extra: [
      '--release-owner-receipt-ref',
      'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.98/receipt-previous-cohort',
    ],
  }));

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(paths.outputPath, 'utf8'));
  assert.equal(record.status, 'blocked');
  assert.match(record.blocked_reasons.join('\n'), /same cohort v26\.5\.99/);
});

test('release owner receipt verification rebuilds a promote-ready candidate record from small artifacts', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-owner-candidate-verify-'));
  const artifactsDir = path.join(tempRoot, 'artifacts');
  const outputDir = path.join(tempRoot, 'owner-validation');
  const ownerRecordPath = path.join(tempRoot, 'v26.5.99-release-owner-receipt.json');

  writeReleaseOwnerVerificationArtifacts(artifactsDir, { withAddonReadiness: true });
  writeReleaseOwnerReceipt(ownerRecordPath, {
    release_owner_verdict_ref: null,
    release_candidate_promote_ready: true,
    can_close_opl_app_release_user_path: true,
    source_artifact_readback: {
      source_run_id: '12345',
      app_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      include_full_package: true,
    },
  });

  const result = runReleaseOwnerCandidateVerifier([
    '--version',
    '26.5.99',
    '--owner-record',
    ownerRecordPath,
    '--artifacts-dir',
    artifactsDir,
    '--output-dir',
    outputDir,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.schema, 'opl_release_owner_candidate_record_verification.v1');
  assert.equal(summary.status, 'verified');
  assert.equal(summary.version, '26.5.99');
  assert.equal(summary.source_run_id, '12345');
  assert.equal(summary.validator.promote_ready, true);
  assert.equal(summary.validator.release_owner_verdict_status, 'release_owner_receipt_recorded');
  assert.equal(summary.addon_readiness.status, 'verified');
  assert.equal(
    summary.validator.release_owner_receipt_ref,
    'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-test',
  );
  assert.equal(summary.authority_boundary.can_claim_app_release_ready_from_evidence, false);
  assert.equal(summary.authority_boundary.can_claim_family_production_ready, false);
  assert.equal(fs.existsSync(summary.output_candidate_record), true);
  assert.equal(
    JSON.parse(fs.readFileSync(summary.output_candidate_record, 'utf8')).status,
    'ready_to_promote',
  );
});

test('release owner receipt verification requires same-cohort add-on evidence when Full or Docker is in scope', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-owner-candidate-addon-'));
  const artifactsDir = path.join(tempRoot, 'artifacts');
  const outputDir = path.join(tempRoot, 'owner-validation');
  const ownerRecordPath = path.join(tempRoot, 'v26.5.99-release-owner-receipt.json');

  writeReleaseOwnerVerificationArtifacts(artifactsDir);
  writeReleaseOwnerReceipt(ownerRecordPath);

  const result = runReleaseOwnerCandidateVerifier([
    '--version',
    '26.5.99',
    '--owner-record',
    ownerRecordPath,
    '--artifacts-dir',
    artifactsDir,
    '--output-dir',
    outputDir,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing release-addon-readiness-summary\.json/);
});

test('release candidate record blocks promotion when a required gate fails', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-blocked-'));
  const paths = candidateInputs(tempRoot, {
    ownerVerdictStatus: 'release_owner_typed_blocker_required',
    readiness: {
      status: 'failed',
      failed_required_gates: [
        { id: 'one_shot_app_installer', status: 'failed', reason: 'installer exited with 1' },
      ],
    },
  });

  const result = runCandidateRecord(candidateRecordArgs(paths, { releaseMode: 'refresh_existing' }));

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(paths.outputPath, 'utf8'));
  assert.equal(record.status, 'blocked');
  assert.equal(record.decision.can_promote, false);
  assert.match(record.blocked_reasons.join('\n'), /one_shot_app_installer/);
  assert.equal(record.release_owner_verdict.status, 'release_owner_typed_blocker_required');

  const statusResult = runCandidateRecordValidator([
    '--status',
    '--version',
    '26.5.99',
    '--record',
    paths.outputPath,
  ]);
  assert.equal(statusResult.status, 0, statusResult.stderr || statusResult.stdout);
  const status = JSON.parse(statusResult.stdout);
  assert.equal(status.promote_ready, false);
  assert.match(status.blocked_reasons.join('\n'), /one_shot_app_installer/);

  const validateResult = runCandidateRecordValidator([
    '--promote-ready',
    '--version',
    '26.5.99',
    '--record',
    paths.outputPath,
  ]);
  assert.notEqual(validateResult.status, 0);
  assert.match(`${validateResult.stdout}\n${validateResult.stderr}`, /blocked_reasons/);
});

test('release candidate record validator rejects version mismatch', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-version-mismatch-'));
  const recordPath = path.join(tempRoot, 'release-candidate-record.json');
  writeJson(recordPath, {
    schema: 'opl_release_candidate_record.v1',
    version: '26.5.99',
    status: 'ready_to_promote',
    blocked_reasons: [],
    decision: {
      can_promote: true,
      promote_command: 'gh release edit v26.5.99 --draft=false --latest',
    },
  });

  const result = runCandidateRecordValidator([
    '--promote-ready',
    '--version',
    '26.5.100',
    '--record',
    recordPath,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Candidate record version 26\.5\.99 does not match 26\.5\.100/);
  assert.match(result.stderr, /not promote-ready/);
});

test('release candidate record keeps draft candidates diagnostic only even with same-cohort owner receipt', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-draft-'));
  const paths = candidateInputs(tempRoot);

  const result = runCandidateRecord(candidateRecordArgs(paths, {
    releaseMode: 'draft_candidate',
    extra: [
      '--release-owner-receipt-ref',
      'release_owner_receipt_ref://one-person-lab-app/release-owner/v26.5.99/receipt-draft-owner-verdict',
    ],
  }));

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(fs.readFileSync(paths.outputPath, 'utf8'));
  assert.equal(record.status, 'diagnostic_only');
  assert.equal(record.decision.can_promote, false);
});

test('release candidate record blocks when readiness omits release owner verdict readout', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-missing-owner-verdict-'));
  const paths = candidateInputs(tempRoot, { includeOwnerVerdict: false });

  const result = runCandidateRecord(candidateRecordArgs(paths, { releaseMode: 'refresh_existing' }));

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(paths.outputPath, 'utf8'));
  assert.equal(record.status, 'blocked');
  assert.match(record.blocked_reasons.join('\n'), /missing release_owner_verdict/);
});
