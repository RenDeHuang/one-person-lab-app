import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { appRoot } from './helpers.ts';

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
    'webui-ghcr-publish',
    'operator-evidence-bundle-validation',
    'full-first-install',
  ]) {
    assert.match(job, new RegExp(dependency), `readiness job must depend on ${dependency}`);
  }

  for (const smallArtifact of [
    'release-preflight-summary-${{ inputs.opl_version }}',
    'remote-release-verification-${{ inputs.opl_version }}',
    'opl-first-run-vm-standard-${{ github.run_id }}',
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
  assert.match(job, /opl-full-diagnostics-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(job, /operator-evidence-bundle-validation/);
  assert.match(job, /summarize-release-readiness\.ts/);
  assert.match(job, /write-release-candidate-record\.ts/);
  assert.match(workflow, /release_owner_receipt_ref:/);
  assert.match(job, /OPL_RELEASE_OWNER_RECEIPT_REF/);
  assert.match(job, /OPL_RELEASE_OWNER_VERDICT_REF/);
  assert.match(job, /OPL_RELEASE_OWNER_TYPED_BLOCKER_REF/);
  assert.match(job, /Upload release candidate record/);
  assert.match(job, /release-candidate-record-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(job, /release-candidate-record\.json/);
  assert.match(job, /release-candidate-record\.md/);
  assert.match(job, /Build release closeout summary/);
  assert.match(job, /npm run release:closeout --/);
  assert.match(job, /--no-download/);
  assert.match(job, /release-closeout-inputs/);
  assert.match(job, /release-closeout\/release-closeout\.json/);
  assert.match(job, /release-closeout\/release-closeout\.md/);
  assert.match(job, /Upload release closeout summary/);
  assert.match(job, /release-closeout-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(job, /needs\[['"]?remote-verify-full['"]?\]\.result|needs\.remote-verify-full\.result/);
  assert.match(job, /release-readiness-job-results\.json/);
});

test('desktop promote workflow is gated by the candidate record before publishing', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-promote.yml'), 'utf8');
  assert.match(workflow, /release_run_id:/);
  assert.match(workflow, /Download release candidate record/);
  assert.match(workflow, /release-candidate-record-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /release-candidate-record\.json/);
  assert.match(workflow, /npm run release:candidate-record:validate/);
  assert.match(workflow, /--record release-candidate-record-input\/release-candidate-record\.json/);
  assert.doesNotMatch(workflow, /node <<'NODE'/);
  assert.match(workflow, /Verify remote release assets/);
  assert.match(workflow, /Publish draft release/);
  assert.match(workflow, /Update Stable Homebrew tap/);
  assert.match(workflow, /Update Full Homebrew tap/);
  assert.match(workflow, /Run Homebrew standard first-run VM smoke/);
  assert.match(workflow, /uses:\s+\.\/\.github\/workflows\/homebrew-tap-update\.yml/);
  assert.match(workflow, /uses:\s+\.\/\.github\/workflows\/opl-first-run-vm\.yml/);
  assert.match(workflow, /needs:\s+promote/);
  assert.match(workflow, /package_profile:\s+homebrew-standard/);
  assert.ok(workflow.indexOf('Verify release candidate record') < workflow.indexOf('Publish draft release'));
  assert.ok(workflow.indexOf('Verify remote release assets') < workflow.indexOf('Publish draft release'));
  assert.ok(workflow.indexOf('Publish draft release') < workflow.indexOf('Update Stable Homebrew tap'));
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
