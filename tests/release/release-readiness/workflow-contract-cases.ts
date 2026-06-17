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
  assert.match(job, /OPL_RELEASE_OWNER_VERDICT_REF:\s+\$\{\{ inputs\.release_owner_verdict_ref \}\}/);
  assert.match(job, /OPL_RELEASE_OWNER_RECEIPT_REF:\s+\$\{\{ inputs\.release_owner_receipt_ref \}\}/);
  assert.match(job, /OPL_RELEASE_OWNER_TYPED_BLOCKER_REF:\s+\$\{\{ inputs\.release_owner_typed_blocker_ref \}\}/);
  assert.match(job, /OPL_RELEASE_OWNER_HUMAN_GATE_REF:\s+\$\{\{ inputs\.release_owner_human_gate_ref \}\}/);
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

test('first-run VM workflow preserves App-side diagnostics and visible timeout contract', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'opl-first-run-vm.yml'), 'utf8');
  const matrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const match = workflow.match(/\n  clean-vm-first-run:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/);
  assert.ok(match, 'first-run VM workflow must include clean-vm-first-run job');
  const job = match[0];

  assert.match(workflow, /run_timeout_ms:[\s\S]*default: '900000'/);
  assert.match(workflow, /smoke_timeout_ms:[\s\S]*default: '900000'/);
  assert.match(job, /Resolve first-run VM timeouts/);
  assert.match(job, /Record first-run VM wrapper diagnostics/);
  assert.match(job, /app-wrapper-diagnostics\.json/);
  assert.match(job, /app-wrapper-preflight\.log/);
  assert.match(job, /npm[\s\S]*config[\s\S]*get[\s\S]*registry/);
  assert.match(job, /@openai\/codex/);
  assert.match(job, /curl[\s\S]*--version/);
  assert.match(job, /node[\s\S]*--version/);
  assert.match(job, /npm[\s\S]*--version/);
  assert.match(job, /job_timeout_minutes/);
  assert.match(job, /run_timeout_ms/);
  assert.match(job, /smoke_timeout_ms/);
  assert.match(job, /codex_install_phase_timeout_ms/);
  assert.match(job, /codex_readiness_phase_timeout_ms/);
  assert.match(job, /--timeout-ms "\$\{\{ steps\.vm_timeouts\.outputs\.run_timeout_ms \}\}"/);
  assert.match(job, /--smoke-timeout-ms "\$\{\{ steps\.vm_timeouts\.outputs\.smoke_timeout_ms \}\}"/);
  assert.match(job, /--codex-install-phase-timeout-ms "\$\{\{ steps\.vm_timeouts\.outputs\.codex_install_phase_timeout_ms \}\}"/);
  assert.match(
    job,
    /--codex-readiness-phase-timeout-ms "\$\{\{ steps\.vm_timeouts\.outputs\.codex_readiness_phase_timeout_ms \}\}"/,
  );
  assert.match(job, /codex_phase_timeout_interface: 'opl_aion_shell_phase_options'/);
  assert.match(job, /shell_interface_status: 'implemented_opl_aion_shell_phase_options'/);
  assert.doesNotMatch(job, /shell interface pending/);
  assert.doesNotMatch(job, /pending_opl_aion_shell/);
  assert.match(job, /app-wrapper-smoke-command-preview\.txt/);
  assert.match(job, /app-wrapper-smoke\.stdout\.log/);
  assert.match(job, /app-wrapper-smoke\.stderr\.log/);
  assert.match(job, /exit_code/);
  assert.match(job, /phase_timings/);
  assert.match(job, /Upload first-run VM artifacts[\s\S]*?if:\s+\$\{\{ always\(\) \}\}/);

  for (const scenarioId of [
    'standard_dmg_clean_vm_smoke',
    'homebrew_standard_cask_clean_vm_smoke',
    'full_dmg_clean_vm_smoke',
  ]) {
    const scenario = matrix.scenarios.find((candidate) => candidate.id === scenarioId);
    assert.ok(scenario, `first-run matrix must include ${scenarioId}`);
    assert.ok(
      scenario.release_evidence_artifacts.includes('app-wrapper-diagnostics.json'),
      `${scenarioId} must require App wrapper diagnostics`,
    );
    assert.equal(scenario.diagnostics_contract.app_wrapper.current_artifact, 'app-wrapper-diagnostics.json');
    assert.deepEqual(scenario.diagnostics_contract.app_wrapper.required_timeout_fields, [
      'job_timeout_minutes',
      'run_timeout_ms',
      'smoke_timeout_ms',
      'codex_install_phase_timeout_ms',
      'codex_readiness_phase_timeout_ms',
    ]);
    assert.deepEqual(scenario.diagnostics_contract.codex_install.required_fields, [
      'command_preview',
      'stdout',
      'stderr',
      'exit_code',
      'phase_timings',
      'timeouts.codex_install_phase_ms',
      'timeouts.codex_readiness_phase_ms',
    ]);
    assert.deepEqual(scenario.diagnostics_contract.codex_install.allowed_sources, [
      'tart-smoke-summary.json',
      'artifacts/codex-install-diagnostics.json',
    ]);
    assert.equal(scenario.diagnostics_contract.codex_install.current_app_scope, 'required_from_tart_smoke_summary_or_shell_companion_diagnostics');
    assert.equal(scenario.diagnostics_contract.codex_install.shell_interface_status, 'implemented_opl_aion_shell_phase_options');
  }
});
