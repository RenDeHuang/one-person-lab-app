import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeJson(filePath: string, payload: unknown) {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function runSummary(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/summarize-release-readiness.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_RUN_ID: 'local', ...env },
    },
  );
}

function runCandidateRecord(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/write-release-candidate-record.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_RUN_ID: 'local', ...env },
    },
  );
}

function writePassingArtifacts(root: string, version = '26.5.99', runId = 'local', options: {
  fullBudget?: Record<string, unknown>;
  runtimeCacheEvents?: unknown[];
} = {}) {
  const standardDmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;
  const fullDmgName = `One-Person-Lab-Full-${version}-mac-arm64.dmg`;
  writeJson(path.join(root, `remote-release-verification-${version}`, 'remote-release-verification.json'), {
    status: 'passed',
    include_full_package: true,
    verified_asset_count: 10,
    verified_assets: [
      {
        name: standardDmgName,
        size: 512,
        sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      {
        name: fullDmgName,
        size: 1024,
        sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    ],
    full_first_install_budget: {
      status: 'passed',
      full_dmg_size_bytes: 512,
      runtime_uncompressed_bytes: 1024,
      ...options.fullBudget,
    },
  });
  writeJson(path.join(root, `opl-first-run-vm-standard-${runId}`, 'tart-smoke-summary.json'), {
    status: 'passed',
    runtime_profile: 'standard',
    settings_smoke: { status: 'passed', pages: ['overview'] },
  });
  writeJson(path.join(root, `opl-first-run-vm-homebrew-standard-${runId}`, 'tart-smoke-summary.json'), {
    status: 'passed',
    runtime_profile: 'standard',
    settings_smoke: { status: 'passed', pages: ['overview'] },
  });
  writeJson(path.join(root, `homebrew-tap-plan-stable-app_standard-${version}`, 'homebrew-tap-plan.json'), {
    channel: 'stable',
    package_kind: 'app_standard',
    version,
    dry_run: false,
    manifest_url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/latest-arm64-mac.yml`,
    checksum_sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    download_url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/${standardDmgName}`,
    targets: [{ path: 'Casks/one-person-lab.rb', kind: 'cask', previous_exists: true, changed: true }],
    policy: {
      cohort: 'standard_desktop_homebrew_distribution',
      remote_write_mode: 'direct_commit',
      publishes_or_pushes_remote: true,
    },
  });
  writeJson(path.join(root, `homebrew-tap-plan-stable-app_full_first_install-${version}`, 'homebrew-tap-plan.json'), {
    channel: 'stable',
    package_kind: 'app_full_first_install',
    version,
    dry_run: false,
    manifest_url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/full-package-manifest.json`,
    checksum_sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    download_url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${version}/${fullDmgName}`,
    targets: [{ path: 'Casks/one-person-lab-full.rb', kind: 'cask', previous_exists: true, changed: true }],
    policy: {
      cohort: 'full_first_install_homebrew_distribution',
      remote_write_mode: 'direct_commit',
      publishes_or_pushes_remote: true,
      full_first_install_allowed: true,
      standard_updater_visible: false,
    },
  });
  writeJson(path.join(root, `opl-first-run-vm-full-${runId}`, 'tart-smoke-summary.json'), {
    status: 'passed',
    runtime_profile: 'full',
    settings_smoke: { status: 'passed', pages: ['overview'] },
  });
  writeJson(path.join(root, `one-shot-app-installer-smoke-${version}`, 'opl-one-shot-system-initialize.json'), {
    system_initialize: {
      setup_flow: {
        status: 'ready_to_launch',
        phase: 'core_ready',
        core_progress: { completed: 3, total: 3 },
        full_readiness_progress: { completed: 1, total: 4 },
        maintenance_progress: { completed: 0, total: 2 },
        blockers: [],
        next_visible_step: 'Open One Person Lab',
      },
    },
  });
  writeFile(path.join(root, `docker-webui-smoke-${version}`, 'opl-webui-index.html'), '<html></html>');
  writeFile(path.join(root, `docker-webui-smoke-${version}`, 'opl-webui-manifest.webmanifest'), '{"name":"One Person Lab"}\n');
  writeFile(path.join(root, `docker-webui-smoke-${version}`, 'opl-webui-image-size-bytes.txt'), '123456\n');
  writeJson(path.join(root, `webui-ghcr-publish-${version}`, 'opl-webui-ghcr-publish.json'), {
    status: 'draft_not_pushed',
    image: 'ghcr.io/gaofeng21cn/one-person-lab-webui',
    tags: [version, 'stable', 'latest'],
    draft_candidate_push: false,
  });
  writeJson(path.join(root, `opl-full-workflow-telemetry-${version}`, 'full-workflow-telemetry.json'), {
    schema: 'opl_full_workflow_telemetry.v1',
    cache: { full_runtime_layers: 'toolchain:true;domain-runtime:true;opl-runtime:true;skills:true' },
    resolved_refs: {
      opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
      mas: { ref: 'main', commit: '2222222222222222222222222222222222222222' },
      mag: { ref: 'main', commit: '3333333333333333333333333333333333333333' },
      rca: { ref: 'main', commit: '4444444444444444444444444444444444444444' },
      opl_meta_agent: { ref: 'main', commit: '5555555555555555555555555555555555555555' },
      officecli: { ref: 'main', commit: '6666666666666666666666666666666666666666' },
      mineru: { ref: 'main', commit: '7777777777777777777777777777777777777777' },
      ui_ux_skill: { ref: 'main', commit: '8888888888888888888888888888888888888888' },
    },
    duration_seconds: {
      full_package_build: 380,
      full_package_build_breakdown: {
        runtime_materialize: 1,
        runtime_cache_materialize: 2,
        payload_sync: 3,
        shell_build: 4,
        dmg_package_compression: 5,
        manifest_checksum: 6,
      },
    },
  });
  writeJson(path.join(root, `opl-full-diagnostics-${version}`, 'full-package-manifest.json'), {
    manifest_version: 2,
    version: '26.5.99',
    package_kind: 'opl_full_first_install_macos_arm64',
    resolved_refs: {
      opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
      mas: { ref: 'main', commit: '2222222222222222222222222222222222222222' },
      mag: { ref: 'main', commit: '3333333333333333333333333333333333333333' },
      rca: { ref: 'main', commit: '4444444444444444444444444444444444444444' },
      opl_meta_agent: { ref: 'main', commit: '5555555555555555555555555555555555555555' },
      officecli: { ref: 'main', commit: '6666666666666666666666666666666666666666' },
      mineru: { ref: 'main', commit: '7777777777777777777777777777777777777777' },
      ui_ux_skill: { ref: 'main', commit: '8888888888888888888888888888888888888888' },
    },
    size_breakdown: { total_runtime_uncompressed_bytes: 1024 },
  });
  writeJson(path.join(root, `opl-full-diagnostics-${version}`, 'runtime-cache-events.json'), {
    events: options.runtimeCacheEvents ?? [{ layer_id: 'toolchain', status: 'hit' }],
  });
  writeFile(path.join(root, `opl-full-diagnostics-${version}`, 'SHA256SUMS.txt'), 'checksum evidence\n');
  writeJson(path.join(root, `release-evidence-bundle-${version}`, 'evidence-validation-summary.json'), {
    schema: 'opl_release_evidence_bundle_validation.v1',
    status: 'passed',
    bundle_dir: `release-evidence/${version}`,
    manifest_path: 'evidence-manifest.json',
    verified_artifact_count: 16,
    missing_artifact_count: 0,
    blocked_artifact_count: 0,
    packaged_app_evidence: true,
    authority_boundary: 'refs_only_no_runtime_truth_domain_truth_artifact_or_quality_authority',
    forbidden_authority: [
      'runtime_truth',
      'provider_implementation',
      'domain_truth',
      'domain_quality_verdict',
      'domain_artifact_authority',
    ],
  });
}

function writePassingJobResults(filePath: string) {
  writeJson(filePath, {
    'full-first-install': 'success',
    'remote-verify-standard': 'skipped',
    'remote-verify-full': 'success',
    'standard-first-run-vm-smoke-after-standard-only': 'skipped',
    'standard-first-run-vm-smoke-after-full': 'success',
    'stable-homebrew-tap-update': 'success',
    'full-homebrew-tap-update': 'success',
    'homebrew-standard-first-run-vm-smoke': 'success',
    'full-first-run-vm-smoke': 'success',
    'one-shot-app-installer-smoke': 'success',
    'docker-webui-smoke': 'success',
    'webui-ghcr-publish': 'success',
    'operator-evidence-bundle-validation': 'success',
  });
}

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
  assert.equal(summary.gates.operator_evidence_bundle.status, 'passed');
  assert.equal(summary.gates.operator_evidence_bundle.fields.packaged_app_evidence, true);
  assert.equal(summary.gate_profile, 'stable');
  assert.equal(summary.gate_profile_schema, 'app_release_validation_profiles.v1');
  assert.equal(summary.gates.remote_release_verification.status, 'passed');
  assert.equal(summary.gates.full_size_cache_timing.status, 'passed');
  assert.equal(summary.full_package.duration_seconds.full_package_build, 380);
  assert.equal(summary.full_package.duration_seconds.full_package_build_breakdown.shell_build, 4);
  assert.equal(summary.full_package.resolved_refs.opl_framework.commit, '1111111111111111111111111111111111111111');
  const markdown = fs.readFileSync(summaryPath, 'utf8');
  assert.match(markdown, /Release Readiness Summary/);
  assert.match(markdown, /One-shot installer/);
  assert.match(markdown, /\.\/install\.sh --complete --skip-modules/);
  assert.match(markdown, /one-shot-app-installer-smoke/);
  assert.match(markdown, /setup_flow: ready_to_launch/);
  assert.match(markdown, /core: 3\/3/);
  assert.match(markdown, /retry: false/);
  assert.match(markdown, /skip_modules: true/);
});

test('release readiness summary fails closed without a same-cohort operator evidence bundle', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-missing-evidence-bundle-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot);
  writePassingJobResults(jobResultsPath);
  fs.rmSync(path.join(artifactsRoot, 'release-evidence-bundle-26.5.99'), { recursive: true, force: true });

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
  assert.equal(summary.gates.operator_evidence_bundle.status, 'failed');
  assert.match(summary.gates.operator_evidence_bundle.reason, /Missing evidence-validation-summary\.json/);
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
  assert.equal(summary.gates.stable_homebrew_tap_update.status, 'failed');
  assert.match(summary.gates.stable_homebrew_tap_update.reason, /Homebrew checksum ccccc/);
});

test('release candidate record promotes only a complete stable cohort', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-record-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const jobResultsPath = path.join(tempRoot, 'release-readiness-job-results.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');
  const markdownPath = path.join(tempRoot, 'release-candidate-record.md');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
    full_package: {
      resolved_refs: {
        opl_framework: { ref: 'main', commit: '1111111111111111111111111111111111111111' },
      },
    },
  });
  writeJson(remotePath, {
    status: 'passed',
    version: '26.5.99',
    include_full_package: true,
    verified_asset_count: 12,
    full_first_install_budget: { status: 'passed', full_dmg_size_bytes: 512 },
  });
  writePassingJobResults(jobResultsPath);

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--app-commit',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '--workflow-run-id',
    '12345',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--job-results',
    jobResultsPath,
    '--output',
    outputPath,
    '--markdown',
    markdownPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.schema, 'opl_release_candidate_record.v1');
  assert.equal(record.status, 'ready_to_promote');
  assert.equal(record.version, '26.5.99');
  assert.equal(record.decision.can_promote, true);
  assert.equal(record.provenance.app_commit, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(record.remote_asset_summary.verified_asset_count, 12);
  assert.equal(record.resolved_refs.opl_framework.commit, '1111111111111111111111111111111111111111');
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  assert.match(markdown, /Release Candidate Record/);
  assert.match(markdown, /Status: ready_to_promote/);
});

test('release candidate record blocks promotion when a required gate fails', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-blocked-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'failed',
    version: '26.5.99',
    failed_required_gates: [
      { id: 'one_shot_app_installer', status: 'failed', reason: 'installer exited with 1' },
    ],
  });
  writeJson(remotePath, { status: 'passed', version: '26.5.99', verified_asset_count: 10 });

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'refresh_existing',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--output',
    outputPath,
  ]);

  assert.notEqual(result.status, 0);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.status, 'blocked');
  assert.equal(record.decision.can_promote, false);
  assert.match(record.blocked_reasons.join('\n'), /one_shot_app_installer/);
});

test('release candidate record keeps draft candidates diagnostic only', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-candidate-draft-'));
  const preflightPath = path.join(tempRoot, 'release-preflight-summary.json');
  const readinessPath = path.join(tempRoot, 'release-readiness-summary.json');
  const remotePath = path.join(tempRoot, 'remote-release-verification.json');
  const outputPath = path.join(tempRoot, 'release-candidate-record.json');

  writeJson(preflightPath, { schema: 'opl_release_preflight.v1', status: 'passed' });
  writeJson(readinessPath, {
    schema: 'opl_release_readiness_summary.v1',
    status: 'passed',
    version: '26.5.99',
    failed_required_gates: [],
  });
  writeJson(remotePath, { status: 'passed', version: '26.5.99', verified_asset_count: 10 });

  const result = runCandidateRecord([
    '--version',
    '26.5.99',
    '--release-mode',
    'draft_candidate',
    '--include-full-package',
    'true',
    '--run-vm-smoke',
    'true',
    '--preflight',
    preflightPath,
    '--readiness',
    readinessPath,
    '--remote-verification',
    remotePath,
    '--output',
    outputPath,
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(record.status, 'diagnostic_only');
  assert.equal(record.decision.can_promote, false);
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
  assert.deepEqual(summary.warnings.map((warning) => warning.code), ['full_dmg_size_warning']);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /Full DMG size warning/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /725000000/);
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
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /Runtime cache miss_written layers/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /domain-runtime, opl-runtime/);
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

test('desktop release workflow has a final readiness aggregation job that downloads only small artifacts', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const match = workflow.match(/\n  release-readiness-summary:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/);
  assert.ok(match, 'desktop release workflow must include release-readiness-summary job');
  const job = match[0];

  for (const dependency of [
    'remote-verify-standard',
    'remote-verify-full',
    'standard-first-run-vm-smoke-after-standard-only',
    'standard-first-run-vm-smoke-after-full',
    'stable-homebrew-tap-update',
    'full-homebrew-tap-update',
    'homebrew-standard-first-run-vm-smoke',
    'full-first-run-vm-smoke',
    'one-shot-app-installer-smoke',
    'docker-webui-smoke',
    'webui-ghcr-publish',
    'operator-evidence-bundle-validation',
    'full-first-install',
  ]) {
    assert.match(job, new RegExp(dependency), `readiness job must depend on ${dependency}`);
  }

  for (const smallArtifact of [
    'release-preflight-summary-${{ inputs.opl_version }}',
    'remote-release-verification-${{ inputs.opl_version }}',
    'homebrew-tap-plan-stable-app_standard-${{ inputs.opl_version }}',
    'homebrew-tap-plan-stable-app_full_first_install-${{ inputs.opl_version }}',
    'opl-first-run-vm-standard-${{ github.run_id }}',
    'opl-first-run-vm-homebrew-standard-${{ github.run_id }}',
    'opl-first-run-vm-full-${{ github.run_id }}',
    'one-shot-app-installer-smoke-${{ inputs.opl_version }}',
    'docker-webui-smoke-${{ inputs.opl_version }}',
    'webui-ghcr-publish-${{ inputs.opl_version }}',
    'opl-full-workflow-telemetry-${{ inputs.opl_version }}',
    'opl-full-diagnostics-${{ inputs.opl_version }}',
    'release-evidence-bundle-${{ inputs.opl_version }}',
  ]) {
    assert.ok(job.includes(smallArtifact), `readiness job must download ${smallArtifact}`);
  }

  assert.doesNotMatch(job, /name:\s+macos-build-arm64/);
  assert.doesNotMatch(job, /name:\s+opl-full-first-install-\$\{\{ inputs\.opl_version \}\}-mac-arm64/);
  assert.match(job, /release-readiness-summary\.json/);
  assert.match(job, /operator-evidence-bundle-validation/);
  assert.match(job, /summarize-release-readiness\.ts/);
  assert.match(job, /write-release-candidate-record\.ts/);
  assert.match(job, /Upload release candidate record/);
  assert.match(job, /release-candidate-record-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(job, /release-candidate-record\.json/);
  assert.match(job, /release-candidate-record\.md/);
  assert.match(job, /needs\[['"]?remote-verify-full['"]?\]\.result|needs\.remote-verify-full\.result/);
  assert.match(job, /release-readiness-job-results\.json/);
});

test('desktop promote workflow is gated by the candidate record before publishing', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-promote.yml'), 'utf8');
  assert.match(workflow, /release_run_id:/);
  assert.match(workflow, /Download release candidate record/);
  assert.match(workflow, /release-candidate-record-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /release-candidate-record\.json/);
  assert.match(workflow, /record\.schema !== 'opl_release_candidate_record\.v1'/);
  assert.match(workflow, /record\.status !== 'ready_to_promote'/);
  assert.match(workflow, /record\.decision\?\.can_promote !== true/);
  assert.match(workflow, /Verify remote release assets/);
  assert.match(workflow, /Publish draft release/);
  assert.ok(workflow.indexOf('Verify release candidate record') < workflow.indexOf('Publish draft release'));
  assert.ok(workflow.indexOf('Verify remote release assets') < workflow.indexOf('Publish draft release'));
});

test('one-shot installer smoke uploads its diagnostic artifact even when bootstrap fails', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const match = workflow.match(/\n  one-shot-app-installer-smoke:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/);
  assert.ok(match, 'desktop release workflow must include one-shot installer smoke job');
  const job = match[0];

  assert.match(job, /install_status=0/);
  assert.match(job, /initialize_status=0/);
  assert.match(job, /one_shot_app_installer_smoke_failed/);
  assert.match(job, /exit "\$smoke_status"/);
  assert.match(job, /Upload one-shot installer smoke artifact[\s\S]*?if:\s+\$\{\{ always\(\) \}\}/);
  assert.match(job, /path: \/tmp\/opl-one-shot-system-initialize\.json/);
});
