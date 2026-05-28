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
      env: { ...process.env, ...env },
    },
  );
}

function writePassingArtifacts(root: string, version = '26.5.99', runId = 'local') {
  writeJson(path.join(root, `remote-release-verification-${version}`, 'remote-release-verification.json'), {
    status: 'passed',
    include_full_package: true,
    verified_asset_count: 10,
    full_first_install_budget: {
      status: 'passed',
      full_dmg_size_bytes: 512,
      runtime_uncompressed_bytes: 1024,
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
    system_initialize: { setup_flow: { status: 'ready_to_launch' } },
  });
  writeFile(path.join(root, `docker-webui-smoke-${version}`, 'opl-webui-index.html'), '<html></html>');
  writeFile(path.join(root, `docker-webui-smoke-${version}`, 'opl-webui-manifest.webmanifest'), '{"name":"One Person Lab"}\n');
  writeFile(path.join(root, `docker-webui-smoke-${version}`, 'opl-webui-image-size-bytes.txt'), '123456\n');
  writeJson(path.join(root, `opl-full-workflow-telemetry-${version}`, 'full-workflow-telemetry.json'), {
    schema: 'opl_full_workflow_telemetry.v1',
    cache: { full_runtime_layers: 'toolchain:true;domain-runtime:true;opl-runtime:true;skills:true' },
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
    size_breakdown: { total_runtime_uncompressed_bytes: 1024 },
  });
  writeJson(path.join(root, `opl-full-diagnostics-${version}`, 'runtime-cache-events.json'), {
    events: [{ layer_id: 'toolchain', status: 'hit' }],
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
  assert.equal(summary.gates.docker_webui.status, 'passed');
  assert.equal(summary.gates.remote_release_verification.status, 'passed');
  assert.equal(summary.gates.full_size_cache_timing.status, 'passed');
  assert.equal(summary.full_package.duration_seconds.full_package_build, 380);
  assert.equal(summary.full_package.duration_seconds.full_package_build_breakdown.shell_build, 4);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /Release Readiness Summary/);
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
