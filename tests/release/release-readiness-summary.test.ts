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

function writePassingArtifacts(root: string, version = '26.5.99', runId = 'local', options: {
  fullBudget?: Record<string, unknown>;
  runtimeCacheEvents?: unknown[];
} = {}) {
  writeJson(path.join(root, `remote-release-verification-${version}`, 'remote-release-verification.json'), {
    status: 'passed',
    include_full_package: true,
    verified_asset_count: 10,
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
}

function writePassingJobResults(filePath: string) {
  writeJson(filePath, {
    'full-first-install': 'success',
    'remote-verify-standard': 'skipped',
    'remote-verify-full': 'success',
    'standard-first-run-vm-smoke-after-standard-only': 'skipped',
    'standard-first-run-vm-smoke-after-full': 'success',
    'full-first-run-vm-smoke': 'success',
    'one-shot-app-installer-smoke': 'success',
    'docker-webui-smoke': 'success',
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
  assert.equal(summary.gates.standard_dmg_clean_vm.status, 'passed');
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

test('release readiness summary passes with explicit Full size warning below hard budget', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-release-readiness-full-warning-'));
  const outputPath = path.join(tempRoot, 'release-readiness-summary.json');
  const summaryPath = path.join(tempRoot, 'summary.md');
  const jobResultsPath = path.join(tempRoot, 'job-results.json');
  const artifactsRoot = path.join(tempRoot, 'inputs');
  writePassingArtifacts(artifactsRoot, '26.5.99', 'local', {
    fullBudget: {
      max_full_dmg_bytes: 550000000,
      full_dmg_size_bytes: 540000000,
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
  assert.equal(summary.full_package.size_budget.warning_full_dmg_bytes, 530000000);
  assert.equal(summary.full_package.size_budget.max_full_dmg_bytes, 550000000);
  assert.deepEqual(summary.warnings.map((warning) => warning.code), ['full_dmg_size_warning']);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /Full DMG size warning/);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /540000000/);
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
    'full-first-run-vm-smoke',
    'one-shot-app-installer-smoke',
    'docker-webui-smoke',
    'full-first-install',
  ]) {
    assert.match(job, new RegExp(dependency), `readiness job must depend on ${dependency}`);
  }

  for (const smallArtifact of [
    'remote-release-verification-${{ inputs.opl_version }}',
    'opl-first-run-vm-standard-${{ github.run_id }}',
    'opl-first-run-vm-full-${{ github.run_id }}',
    'one-shot-app-installer-smoke-${{ inputs.opl_version }}',
    'docker-webui-smoke-${{ inputs.opl_version }}',
    'opl-full-workflow-telemetry-${{ inputs.opl_version }}',
    'opl-full-diagnostics-${{ inputs.opl_version }}',
  ]) {
    assert.ok(job.includes(smallArtifact), `readiness job must download ${smallArtifact}`);
  }

  assert.doesNotMatch(job, /name:\s+macos-build-arm64/);
  assert.doesNotMatch(job, /name:\s+opl-full-first-install-\$\{\{ inputs\.opl_version \}\}-mac-arm64/);
  assert.match(job, /release-readiness-summary\.json/);
  assert.match(job, /summarize-release-readiness\.ts/);
  assert.match(job, /needs\[['"]?remote-verify-full['"]?\]\.result|needs\.remote-verify-full\.result/);
  assert.match(job, /release-readiness-job-results\.json/);
});
