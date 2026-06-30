import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  runSummary,
  writeJson,
  writePassingArtifacts,
  writePassingJobResults,
} from './helpers.ts';

test('release readiness summary passes only from small diagnostic artifacts', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const summaryPath = path.join(tempRoot, 'summary.md');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writePassingJobResults(jobResultsPath);
  writeJson(path.join(artifactsRoot, 'webui-ghcr-publish-26.5.99', 'opl-webui-ghcr-publish.json'), {
    status: 'published',
    image: 'ghcr.io/gaofeng21cn/one-person-lab-webui',
    tags: ['26.5.99', 'stable', 'latest'],
    draft_candidate_push: false,
    build_reuse: {
      mode: 'same_job_after_docker_webui_smoke',
      source_gate: 'docker-webui-smoke',
      repeated_docker_build: false,
    },
  });

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
    '--markdown',
    summaryPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.gates.standard_dmg_clean_vm.status, 'passed');
  assert.equal(summary.gates.stable_homebrew_tap_update.status, 'passed');
  assert.equal(summary.gates.stable_homebrew_tap_update.fields.remote_asset_sha256, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(summary.gates.full_homebrew_tap_update.status, 'passed');
  assert.equal(summary.gates.full_homebrew_tap_update.fields.remote_asset_sha256, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.equal(summary.gates.homebrew_standard_cask_clean_vm.status, 'passed');
  assert.equal(summary.gates.full_dmg_clean_vm.status, 'passed');
  assert.equal(summary.gates.one_shot_app_installer.status, 'passed');
  assert.deepEqual(summary.gates.one_shot_app_installer.fields, {
    installer_entry: './install.sh --complete --skip-modules',
    bootstrap_status_source: 'workflow job result one-shot-app-installer-smoke',
    initialization_command: 'opl system initialize --json',
    initialization_source: 'system_initialize.setup_flow',
    artifact_files: ['opl-one-shot-system-initialize.json'],
    setup_flow_status: 'ready_to_launch',
    setup_flow_phase: 'core_ready',
    core_progress: { completed: 3, total: 3 },
    full_readiness_progress: { completed: 1, total: 4 },
    maintenance_progress: { completed: 0, total: 2 },
    blockers: [],
    next_visible_step: 'Open One Person Lab',
    retry_detected: false,
    skip_modules: true,
  });
  assert.equal(summary.gates.docker_webui.status, 'passed');
  assert.equal(summary.gates.webui_ghcr_publish.status, 'passed');
  assert.deepEqual(summary.gates.webui_ghcr_publish.fields.tags, ['26.5.99', 'stable', 'latest']);
  assert.equal(summary.gates.webui_ghcr_publish.fields.build_reuse.repeated_docker_build, false);
  assert.equal(summary.gates.docker_webui_clean_vm_evidence.status, 'passed');
  assert.equal(summary.gates.docker_webui_clean_vm_evidence.fields.clean_linux_vm.status, 'passed');
  assert.equal(summary.gates.docker_webui_clean_vm_evidence.fields.clean_windows_vm.status, 'passed');
  assert.equal(summary.gates.docker_webui_clean_vm_evidence.fields.clean_windows_vm.artifact_name, 'windows-clean-evidence');
  assert.equal(summary.gates.operator_evidence_bundle.status, 'passed');
  assert.equal(summary.gates.operator_evidence_bundle.fields.packaged_app_evidence, true);
  assert.deepEqual(summary.release_cohort, {
    schema: 'opl_app_release_evidence_cohort.v1',
    version: '26.5.99',
    tag: 'v26.5.99',
    channel: 'stable',
    source: 'release_readiness_summary',
    current_cohort_evidence: true,
  });
  assert.equal(summary.release_owner_verdict.schema, 'opl_app_release_owner_verdict_readout.v1');
  assert.equal(summary.release_owner_verdict.status, 'release_owner_verdict_pending');
  assert.equal(summary.release_owner_verdict.release_ready_claim, false);
  assert.equal(summary.release_owner_verdict.stable_latest_promotion_claim, false);
  assert.equal(summary.release_owner_verdict.family_production_ready_claim, false);
  assert.equal(summary.release_owner_verdict.release_owner_verdict_ref, null);
  assert.equal(summary.release_owner_verdict.release_owner_receipt_ref, null);
  assert.equal(
    summary.release_owner_verdict.install_evidence_ref,
    'install_evidence_ref://one-person-lab-app/release-owner/v26.5.99/install-evidence',
  );
  assert.equal(
    summary.release_owner_verdict.release_owner_typed_blocker_ref,
    'typed_blocker_ref://one-person-lab-app/release-owner/v26.5.99/verdict-pending',
  );
  assert.deepEqual(summary.release_owner_verdict.owner_resolution_ref_shapes, [
    'release_owner_verdict_ref',
    'release_owner_receipt_ref',
  ]);
  assert.ok(summary.release_owner_verdict.promotion_blocking_until_owner_resolution_ref);
  assert.equal(summary.release_owner_verdict.can_close_opl_app_release_user_path, false);
  assert.equal(summary.gate_profile, 'stable');
  assert.equal(summary.gate_profile_schema, 'app_release_validation_profiles.v1');
  assert.equal(summary.gates.remote_release_verification.status, 'passed');
  assert.equal(summary.gates.full_size_cache_timing.status, 'passed');
  assert.equal(summary.gates.full_size_cache_timing.required, false);
  assert.equal(summary.gates.full_size_cache_timing.fields.diagnostic_only, true);
  assert.equal(summary.full_package.duration_seconds.full_package_build, 380);
  assert.equal(summary.full_package.duration_seconds.full_package_build_breakdown.shell_build, 4);
  assert.equal(summary.full_package.resolved_refs.opl_framework.commit, '1111111111111111111111111111111111111111');
  assert.equal(summary.bottlenecks[0].id, 'manifest_checksum');
  assert.equal(summary.bottlenecks[0].category, 'full_build_segment');
  assert.ok(summary.bottlenecks.some((entry) => entry.id === 'dmg_package_compression'));
  assert.ok(summary.optimization_recommendations.some((entry) => entry.id === 'profile_slowest_full_build_segment'));
  assert.ok(summary.optimization_recommendations.some((entry) => entry.id === 'reduce_dmg_package_compression_time'));
  const markdown = fs.readFileSync(summaryPath, 'utf8');
  assert.match(markdown, /Release Readiness Summary/);
  assert.match(markdown, /One-shot installer/);
  assert.match(markdown, /\.\/install\.sh --complete --skip-modules/);
  assert.match(markdown, /one-shot-app-installer-smoke/);
  assert.match(markdown, /setup_flow: ready_to_launch/);
  assert.match(markdown, /core: 3\/3/);
  assert.match(markdown, /retry: false/);
  assert.match(markdown, /skip_modules: true/);
  assert.match(markdown, /Bottlenecks/);
  assert.match(markdown, /Optimization recommendations/);
});

test('release readiness summary does not fail the clean evidence gate when Full diagnostics are absent', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-full-diagnostics-optional-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const summaryPath = path.join(tempRoot, 'summary.md');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  fs.rmSync(path.join(artifactsRoot, 'opl-full-workflow-telemetry-26.5.99'), { recursive: true, force: true });
  fs.rmSync(path.join(artifactsRoot, 'opl-full-diagnostics-26.5.99'), { recursive: true, force: true });
  writeJson(path.join(artifactsRoot, 'webui-ghcr-publish-26.5.99', 'opl-webui-ghcr-publish.json'), {
    status: 'published',
    image: 'ghcr.io/gaofeng21cn/one-person-lab-webui',
    tags: ['26.5.99', 'stable', 'latest'],
    draft_candidate_push: false,
    build_reuse: {
      mode: 'same_job_after_docker_webui_smoke',
      source_gate: 'docker-webui-smoke',
      repeated_docker_build: false,
    },
  });
  writePassingJobResults(jobResultsPath);
  const jobResults = JSON.parse(fs.readFileSync(jobResultsPath, 'utf8'));
  jobResults['full-first-install'] = 'success';
  writeJson(jobResultsPath, jobResults);

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
    '--markdown',
    summaryPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.gates.full_size_cache_timing.status, 'skipped');
  assert.equal(summary.gates.full_size_cache_timing.required, false);
  assert.equal(summary.gates.full_size_cache_timing.fields.diagnostic_only, true);
  assert.deepEqual(summary.failed_required_gates, []);
});

test('release readiness summary treats Docker WebUI gates as optional when Docker publishing is disabled', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-docker-disabled-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  fs.rmSync(path.join(artifactsRoot, 'docker-webui-smoke-26.5.99'), { recursive: true, force: true });
  fs.rmSync(path.join(artifactsRoot, 'webui-ghcr-publish-26.5.99'), { recursive: true, force: true });
  fs.rmSync(path.join(artifactsRoot, 'docker-webui-clean-vm-evidence-26.5.99'), { recursive: true, force: true });
  writePassingJobResults(jobResultsPath);
  const jobResults = JSON.parse(fs.readFileSync(jobResultsPath, 'utf8'));
  jobResults['docker-webui-smoke'] = 'skipped';
  jobResults['webui-ghcr-publish'] = 'skipped';
  jobResults['docker-webui-clean-vm-evidence'] = 'skipped';
  writeJson(jobResultsPath, jobResults);

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--publish-docker-webui',
    'false',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.publish_docker_webui, false);
  assert.equal(summary.gates.docker_webui.status, 'skipped');
  assert.equal(summary.gates.docker_webui.required, false);
  assert.equal(summary.gates.webui_ghcr_publish.status, 'skipped');
  assert.equal(summary.gates.webui_ghcr_publish.required, false);
  assert.equal(summary.gates.docker_webui_clean_vm_evidence.status, 'skipped');
  assert.equal(summary.gates.docker_webui_clean_vm_evidence.required, false);
  assert.deepEqual(summary.failed_required_gates, []);
});

test('release readiness summary allows missing optional Docker WebUI clean Windows VM evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-docker-clean-vm-missing-windows-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writePassingJobResults(jobResultsPath);
  writeJson(path.join(artifactsRoot, 'webui-ghcr-publish-26.5.99', 'opl-webui-ghcr-publish.json'), {
    status: 'published',
    image: 'ghcr.io/gaofeng21cn/one-person-lab-webui',
    tags: ['26.5.99', 'stable', 'latest'],
    draft_candidate_push: false,
    build_reuse: {
      mode: 'same_job_after_docker_webui_smoke',
      source_gate: 'docker-webui-smoke',
      repeated_docker_build: false,
    },
  });
  writeJson(path.join(artifactsRoot, 'docker-webui-clean-vm-evidence-26.5.99', 'docker-webui-clean-vm-evidence-validation.json'), {
    schema: 'opl_docker_webui_clean_vm_evidence_validation.v1',
    status: 'passed',
    required_gates: ['clean_linux_vm'],
    optional_gates: ['clean_windows_vm'],
    summaries: [
      {
        schema: 'opl_docker_webui_clean_vm_evidence_validation.v1',
        gate_id: 'clean_linux_vm',
        status: 'passed',
        artifact_name: 'same_job_ubuntu_clean_vm_generated',
        result_path: 'clean-linux-vm-generated/docker-webui-smoke-gate-result.json',
      },
      {
        schema: 'opl_docker_webui_clean_vm_evidence_validation.v1',
        gate_id: 'clean_windows_vm',
        status: 'skipped',
        artifact_name: null,
        optional: true,
        message: 'clean Windows VM evidence was not supplied; Docker/WebUI release readiness does not require Windows Docker host proof.',
      },
    ],
    release_readiness_policy: 'clean Linux Docker runtime evidence must validate as passed before release readiness aggregation; clean Windows VM evidence is optional diagnostic import.',
  });

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.gates.docker_webui_clean_vm_evidence.status, 'passed');
  assert.equal(summary.gates.docker_webui_clean_vm_evidence.required, true);
  assert.equal(summary.gates.docker_webui_clean_vm_evidence.fields.clean_linux_vm.status, 'passed');
  assert.equal(summary.gates.docker_webui_clean_vm_evidence.fields.clean_windows_vm.status, 'skipped');
  assert.deepEqual(summary.failed_required_gates, []);
});

test('release readiness summary treats missing operator evidence bundle as diagnostic', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-missing-evidence-bundle-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writePassingJobResults(jobResultsPath);
  writeJson(path.join(artifactsRoot, 'webui-ghcr-publish-26.5.99', 'opl-webui-ghcr-publish.json'), {
    status: 'published',
    image: 'ghcr.io/gaofeng21cn/one-person-lab-webui',
    tags: ['26.5.99', 'stable', 'latest'],
    draft_candidate_push: false,
    build_reuse: {
      mode: 'same_job_after_docker_webui_smoke',
      source_gate: 'docker-webui-smoke',
      repeated_docker_build: false,
    },
  });
  fs.rmSync(path.join(artifactsRoot, 'release-evidence-bundle-26.5.99'), { recursive: true, force: true });

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.gates.operator_evidence_bundle.status, 'skipped');
  assert.equal(summary.gates.operator_evidence_bundle.required, false);
  assert.match(summary.gates.operator_evidence_bundle.reason, /Missing evidence-validation-summary\.json/);
  assert.equal(summary.release_owner_verdict.status, 'release_owner_verdict_pending');
  assert.equal(
    summary.release_owner_verdict.release_owner_typed_blocker_ref,
    'typed_blocker_ref://one-person-lab-app/release-owner/v26.5.99/verdict-pending',
  );
  assert.equal(summary.release_owner_verdict.blocked_by_required_gate_ids.includes('operator_evidence_bundle'), false);
  assert.equal(summary.release_owner_verdict.release_ready_claim, false);
});

test('release readiness summary includes App L5 readout for current cohort evidence gaps', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-l5-gaps-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writePassingJobResults(jobResultsPath);
  fs.rmSync(path.join(artifactsRoot, 'opl-first-run-vm-homebrew-standard-local'), { recursive: true, force: true });
  writeJson(path.join(artifactsRoot, 'release-evidence-bundle-26.5.99', 'evidence-validation-summary.json'), {
    schema: 'opl_release_evidence_bundle_validation.v1',
    status: 'blocked_evidence',
    bundle_dir: 'release-evidence/26.5.99',
    manifest_path: 'evidence-manifest.json',
    verified_artifact_count: 14,
    missing_artifact_count: 1,
    blocked_artifact_count: 1,
    packaged_app_evidence: false,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    forbidden_authority: [
      'runtime_truth',
      'provider_implementation',
      'domain_truth',
      'domain_quality_verdict',
      'domain_artifact_authority',
    ],
    l5_evidence_readout: {
      schema: 'opl_app_release_l5_evidence_readout.v1',
      scope: 'app_release_user_path_evidence_for_opl_console_l5_input',
      ordinary_cockpit_excluded: true,
      release_ready_claim: false,
      family_l5_claim: false,
      evidence_classes: [
        {
          class_id: 'live_user_path',
          status: 'blocked_evidence',
          accepted_ref_shapes: ['user_path_evidence_ref', 'operator_evidence_ref', 'typed_blocker_ref'],
          missing_artifact_ids: ['guest_smoke_summary'],
          blocked_artifact_ids: ['first_run_vm_summary'],
        },
        {
          class_id: 'owner_acceptance',
          status: 'owner_acceptance_ref_required',
          accepted_ref_shapes: ['owner_acceptance_ref', 'owner_receipt_ref', 'typed_blocker_ref', 'human_gate_ref'],
          missing_artifact_ids: [],
          blocked_artifact_ids: [],
        },
      ],
      missing_current_cohort_evidence: [
        {
          class_id: 'live_user_path',
          status: 'blocked_evidence',
          missing_artifact_ids: ['guest_smoke_summary'],
          blocked_artifact_ids: ['first_run_vm_summary'],
          closeable_by: ['user_path_evidence_ref', 'operator_evidence_ref', 'typed_blocker_ref'],
        },
        {
          class_id: 'owner_acceptance',
          status: 'owner_acceptance_ref_required',
          missing_artifact_ids: [],
          blocked_artifact_ids: [],
          closeable_by: ['owner_acceptance_ref', 'owner_receipt_ref', 'typed_blocker_ref', 'human_gate_ref'],
        },
      ],
    },
  });
  writeJson(jobResultsPath, {
    'full-first-install': 'success',
    'remote-verify-standard': 'skipped',
    'remote-verify-full': 'success',
    'standard-first-run-vm-smoke-after-standard-only': 'skipped',
    'standard-first-run-vm-smoke-after-full': 'success',
    'stable-homebrew-tap-update': 'success',
    'full-homebrew-tap-update': 'success',
    'homebrew-standard-first-run-vm-smoke': 'failure',
    'full-first-run-vm-smoke': 'success',
    'one-shot-app-installer-smoke': 'success',
    'docker-webui-smoke': 'success',
    'webui-ghcr-publish': 'success',
    'docker-webui-clean-vm-evidence': 'success',
    'operator-evidence-bundle-validation': 'success',
  });

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0, result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'failed');
  assert.equal(summary.l5_evidence_readout.schema, 'opl_app_release_l5_evidence_readout.v1');
  assert.equal(summary.l5_evidence_readout.scope, 'app_release_user_path_evidence_for_opl_console_l5_input');
  assert.equal(summary.l5_evidence_readout.release_ready_claim, false);
  assert.equal(summary.l5_evidence_readout.family_l5_claim, false);
  assert.equal(summary.l5_evidence_readout.ordinary_cockpit_excluded, true);
  assert.ok(summary.l5_evidence_readout.failed_required_gate_ids.includes('homebrew_standard_cask_clean_vm'));
  assert.equal(summary.l5_evidence_readout.failed_required_gate_ids.includes('operator_evidence_bundle'), false);
  const classById = new Map(
    summary.l5_evidence_readout.evidence_classes.map((entry) => [entry.class_id, entry]),
  );
  assert.equal(classById.get('release_install_evidence').status, 'missing_evidence');
  assert.ok(classById.get('release_install_evidence').missing_gate_ids.includes('homebrew_standard_cask_clean_vm'));
  assert.equal(classById.get('live_user_path').status, 'blocked_evidence');
  assert.deepEqual(classById.get('live_user_path').blocked_artifact_ids, ['first_run_vm_summary']);
  assert.ok(classById.get('owner_acceptance').closeable_by.includes('owner_receipt_ref'));
  assert.ok(
    summary.l5_evidence_readout.missing_current_cohort_evidence.some((entry) =>
      entry.class_id === 'release_install_evidence' && entry.closeable_by.includes('install_evidence_ref')
    ),
  );
});

test('release readiness summary rejects Homebrew checksum drift from remote release digest', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-homebrew-digest-drift-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writePassingJobResults(jobResultsPath);
  writeJson(path.join(artifactsRoot, 'homebrew-tap-plan-stable-app_standard-26.5.99', 'homebrew-tap-plan.json'), {
    channel: 'stable',
    package_kind: 'app_standard',
    version: '26.5.99',
    dry_run: false,
    manifest_url: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.5.99/latest-arm64-mac.yml',
    checksum_sha256: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    download_url: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.5.99/One-Person-Lab-26.5.99-mac-arm64.dmg',
    targets: [{ path: 'Casks/one-person-lab.rb', kind: 'cask', previous_exists: true, changed: true }],
    policy: {
      cohort: 'standard_desktop_homebrew_distribution',
      remote_write_mode: 'direct_commit',
      publishes_or_pushes_remote: true,
    },
  });

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0, result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'failed');
  assert.equal(summary.gates.stable_homebrew_tap_update.status, 'failed');
  assert.match(summary.gates.stable_homebrew_tap_update.reason, /Homebrew checksum ccccc/);
});

test('release readiness summary defers Homebrew gates for refresh_existing draft release targets', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-draft-refresh-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writeJson(path.join(artifactsRoot, 'webui-ghcr-publish-26.5.99', 'opl-webui-ghcr-publish.json'), {
    status: 'published',
    image: 'ghcr.io/gaofeng21cn/one-person-lab-webui',
    tags: ['26.5.99', 'stable', 'latest'],
    draft_candidate_push: false,
  });
  fs.rmSync(path.join(artifactsRoot, 'homebrew-tap-plan-stable-app_standard-26.5.99'), { recursive: true, force: true });
  fs.rmSync(path.join(artifactsRoot, 'homebrew-tap-plan-stable-app_full_first_install-26.5.99'), { recursive: true, force: true });
  fs.rmSync(path.join(artifactsRoot, 'opl-first-run-vm-homebrew-standard-local'), { recursive: true, force: true });
  writeJson(path.join(artifactsRoot, 'release-preflight-summary-26.5.99', 'release-preflight-summary.json'), {
    schema: 'opl_release_preflight.v1',
    status: 'passed',
    release_target: {
      tag: 'v26.5.99',
      kind: 'draft_release',
      release_exists: true,
      tag_exists: true,
      is_draft: true,
      is_prerelease: false,
      published_at: null,
    },
    homebrew: {
      tap_update_required: false,
      tap_update_owner: 'desktop_release_promote_after_publish',
      reason: 'Release target is a draft; Homebrew tap updates can read it only after promote publishes the draft.',
    },
  });
  writeJson(jobResultsPath, {
    'full-first-install': 'success',
    'remote-verify-standard': 'skipped',
    'remote-verify-full': 'success',
    'standard-first-run-vm-smoke-after-standard-only': 'skipped',
    'standard-first-run-vm-smoke-after-full': 'success',
    'stable-homebrew-tap-update': 'skipped',
    'full-homebrew-tap-update': 'skipped',
    'homebrew-standard-first-run-vm-smoke': 'skipped',
    'full-first-run-vm-smoke': 'success',
    'one-shot-app-installer-smoke': 'success',
    'docker-webui-smoke': 'success',
    'webui-ghcr-publish': 'success',
    'docker-webui-clean-vm-evidence': 'success',
    'operator-evidence-bundle-validation': 'success',
  });

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.homebrew.tap_update_required, false);
  assert.equal(summary.homebrew.tap_update_owner, 'desktop_release_promote_after_publish');
  assert.equal(summary.gates.stable_homebrew_tap_update.required, false);
  assert.equal(summary.gates.stable_homebrew_tap_update.status, 'skipped');
  assert.equal(summary.gates.full_homebrew_tap_update.required, false);
  assert.equal(summary.gates.homebrew_standard_cask_clean_vm.required, false);
});

test('release readiness summary passes with explicit Full size warning below review threshold', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-full-warning-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const summaryPath = path.join(tempRoot, 'summary.md');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot, '26.5.99', 'local', {
    fullBudget: {
      warning_full_dmg_bytes: 700000000,
      max_full_dmg_bytes: 750000000,
      full_dmg_size_bytes: 725000000,
    },
  });
  writePassingJobResults(jobResultsPath);

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'draft_candidate',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
    '--markdown',
    summaryPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.full_package.size_budget.status, 'passed');
  assert.equal(summary.full_package.size_budget.full_dmg_size_status, 'warning');
  assert.equal(summary.full_package.size_budget.warning_full_dmg_bytes, 700000000);
  assert.equal(summary.full_package.size_budget.max_full_dmg_bytes, 750000000);
  assert.equal(summary.full_package.size_analysis.source, 'full_package_size_summary_artifact');
  assert.equal(summary.full_package.size_analysis.budget.compressed_full_dmg.warning_status, 'warning');
  assert.equal(summary.full_package.size_analysis.budget.compressed_full_dmg.review_threshold_status, 'within_review_threshold');
  assert.equal(summary.full_package.size_analysis.budget.compressed_full_dmg.release_blocking, false);
  assert.equal(summary.full_package.size_analysis.top_contributors.layers[0].id, 'toolchain');
  assert.equal(summary.full_package.size_analysis.optimization_candidates[0].id, 'toolchain');
  assert.ok(summary.bottlenecks.some((entry) => entry.id === 'full_dmg_size'));
  assert.ok(summary.optimization_recommendations.some((entry) => entry.id === 'review_full_size_optimization_candidates'));
  assert.deepEqual(summary.warnings.map((warning) => warning.code), ['full_dmg_size_warning']);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /Full DMG size warning/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /725000000/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /Full package size analysis/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /Top Full runtime layer/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /review_full_size_optimization_candidates/);
});

test('release readiness summary warns without failing when Full DMG exceeds review threshold', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-full-review-threshold-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const summaryPath = path.join(tempRoot, 'summary.md');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot, '26.5.99', 'local', {
    fullBudget: {
      warning_full_dmg_bytes: 700000000,
      max_full_dmg_bytes: 750000000,
      full_dmg_size_bytes: 865000000,
      full_dmg_size_status: 'warning',
      warnings: [{
        code: 'full_dmg_size_above_review_threshold',
        message: 'Full DMG size 865000000 is above review threshold 750000000.',
      }],
    },
  });
  writePassingJobResults(jobResultsPath);

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'draft_candidate',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
    '--markdown',
    summaryPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.full_package.size_budget.full_dmg_size_status, 'warning');
  assert.equal(summary.full_package.size_analysis.budget.compressed_full_dmg.review_threshold_status, 'above_review_threshold');
  assert.equal(summary.full_package.size_analysis.budget.compressed_full_dmg.release_blocking, false);
  assert.deepEqual(summary.warnings.map((warning) => warning.code), [
    'full_dmg_size_above_review_threshold',
  ]);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /Full DMG size warning/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /865000000/);
});

test('release readiness summary surfaces miss_written runtime cache layers', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-cache-miss-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const summaryPath = path.join(tempRoot, 'summary.md');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot, '26.5.99', 'local', {
    runtimeCacheEvents: [
      { layer_id: 'toolchain', status: 'hit', duration_seconds: 1 },
      { layer_id: 'domain-runtime', status: 'miss_written', duration_seconds: 12.5, write_archive: true },
      { layer_id: 'opl-runtime', status: 'miss_written', duration_seconds: 7.25, write_archive: true },
      { layer_id: 'skills', status: 'miss_readonly', duration_seconds: 2 },
    ],
  });
  writePassingJobResults(jobResultsPath);

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'draft_candidate',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
    '--markdown',
    summaryPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'passed');
  assert.equal(summary.full_package.runtime_cache.layer_status_counts.hit, 1);
  assert.equal(summary.full_package.runtime_cache.layer_status_counts.miss_written, 2);
  assert.deepEqual(summary.full_package.runtime_cache.miss_written_layers, ['domain-runtime', 'opl-runtime']);
  assert.equal(summary.full_package.runtime_cache.miss_written_count, 2);
  assert.equal(summary.full_package.runtime_cache.written_layer_count, 2);
  assert.ok(summary.bottlenecks.some((entry) => entry.id === 'runtime_cache_miss_written'));
  assert.ok(summary.optimization_recommendations.some((entry) => entry.id === 'seed_full_runtime_cache'));
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /Runtime cache miss_written layers/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /domain-runtime, opl-runtime/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /seed_full_runtime_cache/);
});

test('release readiness summary fails closed when a stable-required gate is missing', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-missing-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writePassingJobResults(jobResultsPath);
  fs.rmSync(path.join(artifactsRoot, 'opl-first-run-vm-standard-local'), { recursive: true, force: true });

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'draft_candidate',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0, result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'failed');
  assert.equal(summary.gates.standard_dmg_clean_vm.status, 'failed');
  assert.match(summary.gates.standard_dmg_clean_vm.reason, /Missing/);
});

test('release readiness summary keeps one-shot fields actionable when setup_flow is absent', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-oneshot-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writePassingJobResults(jobResultsPath);
  writeJson(path.join(artifactsRoot, 'one-shot-app-installer-smoke-26.5.99', 'opl-one-shot-system-initialize.json'), {
    status: 'passed',
  });

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'draft_candidate',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.gates.one_shot_app_installer.fields.setup_flow_status, 'passed');
  assert.equal(summary.gates.one_shot_app_installer.fields.initialization_source, 'system_initialize.setup_flow');
  assert.deepEqual(summary.gates.one_shot_app_installer.fields.artifact_files, ['opl-one-shot-system-initialize.json']);
  assert.equal(summary.gates.one_shot_app_installer.fields.retry_detected, false);
  assert.equal(summary.gates.one_shot_app_installer.fields.skip_modules, true);
});

test('release readiness summary keeps one-shot failure diagnostics when the installer job fails', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-oneshot-failure-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writePassingJobResults(jobResultsPath);
  writeJson(jobResultsPath, {
    'full-first-install': 'success',
    'remote-verify-standard': 'skipped',
    'remote-verify-full': 'success',
    'standard-first-run-vm-smoke-after-standard-only': 'skipped',
    'standard-first-run-vm-smoke-after-full': 'success',
    'stable-homebrew-tap-update': 'skipped',
    'full-homebrew-tap-update': 'skipped',
    'homebrew-standard-first-run-vm-smoke': 'success',
    'full-first-run-vm-smoke': 'success',
    'one-shot-app-installer-smoke': 'failure',
    'docker-webui-smoke': 'success',
    'webui-ghcr-publish': 'success',
    'operator-evidence-bundle-validation': 'success',
  });
  writeJson(path.join(artifactsRoot, 'one-shot-app-installer-smoke-26.5.99', 'opl-one-shot-system-initialize.json'), {
    status: 'failed',
    error: {
      code: 'one_shot_app_installer_smoke_failed',
      message: 'one-shot installer exited with 1',
      install_exit_code: 1,
      initialize_exit_code: 0,
    },
  });

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'draft_candidate',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0, result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'failed');
  assert.equal(summary.gates.one_shot_app_installer.status, 'failed');
  assert.match(summary.gates.one_shot_app_installer.reason, /one-shot installer exited with 1/);
  assert.deepEqual(summary.gates.one_shot_app_installer.fields.error, {
    code: 'one_shot_app_installer_smoke_failed',
    message: 'one-shot installer exited with 1',
    install_exit_code: 1,
    initialize_exit_code: 0,
  });
});

test('release readiness summary surfaces GHCR package Actions access failures', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-ghcr-failure-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writePassingJobResults(jobResultsPath);
  writeJson(jobResultsPath, {
    'full-first-install': 'success',
    'remote-verify-standard': 'skipped',
    'remote-verify-full': 'success',
    'standard-first-run-vm-smoke-after-standard-only': 'skipped',
    'standard-first-run-vm-smoke-after-full': 'success',
    'stable-homebrew-tap-update': 'skipped',
    'full-homebrew-tap-update': 'skipped',
    'homebrew-standard-first-run-vm-smoke': 'success',
    'full-first-run-vm-smoke': 'success',
    'one-shot-app-installer-smoke': 'success',
    'docker-webui-smoke': 'success',
    'webui-ghcr-publish': 'failure',
    'operator-evidence-bundle-validation': 'success',
  });
  writeJson(path.join(artifactsRoot, 'webui-ghcr-publish-26.5.99', 'opl-webui-ghcr-publish.json'), {
    status: 'failed',
    image: 'ghcr.io/gaofeng21cn/one-person-lab-webui',
    tags: ['26.5.99', 'stable', 'latest'],
    draft_candidate_push: false,
    source_repository: 'https://github.com/gaofeng21cn/one-person-lab-app',
    package_access_required: {
      package_url: 'https://github.com/users/gaofeng21cn/packages/container/package/one-person-lab-webui/settings',
      required_actions_access_repository: 'gaofeng21cn/one-person-lab-app',
      required_actions_access_permission: 'write',
      configuration_surface: 'GitHub Packages settings Manage Actions access',
      failure_signal: 'docker push denied: permission_denied: write_package',
    },
    error: {
      code: 'ghcr_write_package_denied',
      message: 'GHCR push failed. Ensure the one-person-lab-webui package grants write Actions access to gaofeng21cn/one-person-lab-app.',
    },
  });

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'stable',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    artifactsRoot,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0, result.stdout);
  const summary = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(summary.status, 'failed');
  assert.equal(summary.gates.webui_ghcr_publish.status, 'failed');
  assert.match(summary.gates.webui_ghcr_publish.reason, /WebUI GHCR publish status is failed/);
  assert.equal(summary.gates.webui_ghcr_publish.fields.error.code, 'ghcr_write_package_denied');
  assert.equal(
    summary.gates.webui_ghcr_publish.fields.package_access_required.required_actions_access_repository,
    'gaofeng21cn/one-person-lab-app',
  );
});

test('release readiness summary rejects non-boolean shared release args', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-bool-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');

  const result = runSummary([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'maybe',
    '--run-vm-smoke',
    'true',
    '--artifacts-dir',
    tempRoot,
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /Boolean value must be true or false, got maybe/);
  assert.equal(fs.existsSync(outputPath), false);
});
