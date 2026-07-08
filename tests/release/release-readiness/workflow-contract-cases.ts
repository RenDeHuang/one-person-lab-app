import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { appRoot } from './helpers.ts';
import { activeShellRoot } from '../app-release-boundary-cases/helpers.ts';

test('desktop release workflow has a final readiness aggregation job that downloads only small artifacts', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const match = workflow.match(/\n  release-readiness-summary:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/);
  assert.ok(match, 'desktop release workflow must include release-readiness-summary job');
  const job = match[0];

  for (const dependency of [
    'remote-verify-standard',
    'standard-first-run-vm-smoke-after-standard-only',
    'standard-first-run-vm-smoke-after-full',
    'standard-vm-smoke-gate-after-full',
    'one-shot-app-installer-smoke',
    'release-readiness-admission',
  ]) {
    assert.match(job, new RegExp(dependency), `readiness job must depend on ${dependency}`);
  }

  for (const addOnDependency of [
    'remote-verify-full',
    'full-first-install',
    'full-first-run-vm-smoke',
    'docker-webui-smoke',
    'webui-ghcr-publish',
    'operator-evidence-bundle-validation',
  ]) {
    assert.doesNotMatch(job, new RegExp(addOnDependency), `standard readiness job must not wait for ${addOnDependency}`);
  }

  for (const smallArtifact of [
    'release-preflight-summary-${{ inputs.opl_version }}',
    'remote-release-verification-${{ inputs.opl_version }}',
    'opl-first-run-vm-standard-${{ github.run_id }}',
    'one-shot-app-installer-smoke-${{ inputs.opl_version }}',
  ]) {
    assert.ok(job.includes(smallArtifact), `readiness job must download ${smallArtifact}`);
  }

  assert.doesNotMatch(job, /name:\s+macos-build-arm64/);
  assert.doesNotMatch(job, /name:\s+opl-full-first-install-\$\{\{ inputs\.opl_version \}\}-mac-arm64/);
  assert.match(job, /release-readiness-summary\.json/);
  assert.doesNotMatch(job, /opl-full-diagnostics-\$\{\{ inputs\.opl_version \}\}/);
  assert.doesNotMatch(job, /operator-evidence-bundle-validation/);
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
  assert.doesNotMatch(job, /Build release closeout summary/);
  assert.doesNotMatch(job, /npm run release:closeout --/);
  assert.doesNotMatch(job, /release-closeout/);
  assert.doesNotMatch(job, /Build GitHub Actions timing summary/);
  assert.doesNotMatch(job, /npm run release:actions-timing --/);
  assert.doesNotMatch(job, /release-actions-timing/);
  assert.doesNotMatch(job, /needs\[['"]?remote-verify-full['"]?\]\.result|needs\.remote-verify-full\.result/);
  assert.match(workflow, /release-addon-readiness-summary:[\s\S]*release-addon-readiness-summary\.json/);
  assert.match(job, /release-readiness-job-results\.json/);
  assert.match(workflow, /release_artifact_name:\s+macos-build-arm64-dmg/);
  assert.match(workflow, /release_artifact_name:\s+opl-full-first-install-dmg-\$\{\{ inputs\.opl_version \}\}-mac-arm64/);
  assert.match(workflow, /same_job_after_docker_webui_smoke/);
  assert.match(workflow, /webui-ghcr-publish:[\s\S]*Verify WebUI GHCR publish summary/);
});

test('desktop release workflow fails fast before expensive builds and queues same-version runs', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release.yml'), 'utf8');
  const fullFirstInstallJob = workflow.match(/\n  full-first-install:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  const publishFullAssetsJob = workflow.match(/\n  publish-full-assets:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  const remoteVerifyFullJob = workflow.match(/\n  remote-verify-full:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  const standardGateJob = workflow.match(/\n  standard-vm-smoke-gate-after-full:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  const webuiGhcrPublishJob = workflow.match(/\n  webui-ghcr-publish:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  const operatorEvidenceJob = workflow.match(/\n  operator-evidence-bundle-validation:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  const readinessAdmissionJob = workflow.match(/\n  release-readiness-admission:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  const readinessJob = workflow.match(/\n  release-readiness-summary:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';

  assert.match(workflow, /concurrency:[\s\S]*group:\s+opl-desktop-release-\$\{\{ inputs\.release_mode \}\}-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /cancel-in-progress:\s+false/);
  assert.match(workflow, /release-workflow-contract:[\s\S]*name:\s+Release workflow contract/);
  assert.match(workflow, /release-workflow-contract:[\s\S]*npm run validate:release-boundary/);
  assert.match(workflow, /release-workflow-contract:[\s\S]*npm run test:release-boundary/);
  assert.match(workflow, /standard-build:[\s\S]*needs:[\s\S]*release-workflow-contract[\s\S]*release-source-gate/);
  assert.match(fullFirstInstallJob, /needs:[\s\S]*release-workflow-contract[\s\S]*release-source-gate/);
  assert.match(fullFirstInstallJob, /needs\.release-workflow-contract\.result == 'success'/);
  assert.match(fullFirstInstallJob, /needs\.release-source-gate\.result == 'success'/);
  assert.doesNotMatch(fullFirstInstallJob, /standard-vm-smoke-gate-after-full/);
  assert.match(standardGateJob, /needs:[\s\S]*publish-standard[\s\S]*standard-first-run-vm-smoke-after-full/);
  assert.match(standardGateJob, /Standard VM smoke must pass before Full publish, remote verification, Homebrew, operator evidence, or readiness aggregation can run/);
  assert.match(publishFullAssetsJob, /needs\.publish-standard\.result == 'success'/);
  assert.match(publishFullAssetsJob, /needs\.full-first-install\.result == 'success'/);
  assert.match(publishFullAssetsJob, /needs\.standard-vm-smoke-gate-after-full\.result == 'success'/);
  assert.match(workflow, /remote-verify-full:[\s\S]*needs:[\s\S]*publish-full-assets[\s\S]*standard-vm-smoke-gate-after-full/);
  assert.match(remoteVerifyFullJob, /needs\.publish-full-assets\.result == 'success'/);
  assert.match(remoteVerifyFullJob, /needs\.standard-vm-smoke-gate-after-full\.result == 'success'/);
  assert.match(workflow, /full-first-run-vm-smoke:[\s\S]*needs:[\s\S]*publish-full-assets[\s\S]*standard-vm-smoke-gate-after-full/);
  assert.match(workflow, /full-first-run-vm-smoke:[\s\S]*needs\.standard-vm-smoke-gate-after-full\.result == 'success'/);
  assert.match(workflow, /full-homebrew-tap-update:[\s\S]*needs:[\s\S]*full-first-run-vm-smoke/);
  assert.match(workflow, /full-homebrew-tap-update:[\s\S]*needs\.full-first-run-vm-smoke\.result == 'success'/);
  assert.match(workflow, /stable-homebrew-tap-update:[\s\S]*standard-vm-smoke-gate-after-full/);
  assert.match(readinessAdmissionJob, /release-preflight/);
  assert.doesNotMatch(readinessAdmissionJob, /homebrewTapUpdateRequired/);
  assert.doesNotMatch(readinessAdmissionJob, /full-homebrew-tap-update|homebrew-standard-first-run-vm-smoke|stable-homebrew-tap-update/);
  assert.doesNotMatch(
    readinessAdmissionJob.match(/\n    if:[^\n]+/)?.[0] ?? '',
    /needs\.release-preflight\.outputs\.homebrew_tap_update_required != 'true'/,
  );
  assert.match(webuiGhcrPublishJob, /needs\.docker-webui-smoke\.result == 'success'/);
  assert.match(workflow, /docker-webui-smoke:[\s\S]*needs:\s+[\s\S]*publish-standard/);
  assert.doesNotMatch(
    workflow.match(/\n  docker-webui-smoke:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '',
    /standard-vm-smoke-gate-after-full|standard-first-run-vm-smoke-after-standard-only/,
  );
  assert.match(operatorEvidenceJob, /standard-vm-smoke-gate-after-full/);
  assert.match(operatorEvidenceJob, /needs\.standard-vm-smoke-gate-after-full\.result == 'success'/);
  assert.doesNotMatch(
    publishFullAssetsJob.match(/\n    if:[^\n]+/)?.[0] ?? '',
    /if:\s+\$\{\{\s*always\(\)\s*\}\}/,
  );
  assert.doesNotMatch(
    remoteVerifyFullJob.match(/\n    if:[^\n]+/)?.[0] ?? '',
    /if:\s+\$\{\{\s*always\(\)\s*\}\}/,
  );
  assert.doesNotMatch(
    webuiGhcrPublishJob.match(/\n    if:[^\n]+/)?.[0] ?? '',
    /if:\s+\$\{\{\s*always\(\)\s*\}\}/,
  );
  assert.doesNotMatch(
    operatorEvidenceJob.match(/\n    if:[^\n]+/)?.[0] ?? '',
    /if:\s+\$\{\{\s*always\(\)\s*\}\}/,
  );
  assert.match(readinessAdmissionJob, /Release readiness aggregation is blocked by failed, skipped, or missing required gates/);
  assert.match(readinessAdmissionJob, /standard-vm-smoke-gate-after-full/);
  assert.match(readinessJob, /needs\.release-readiness-admission\.result == 'success'/);
  assert.doesNotMatch(readinessJob, /full-first-install|remote-verify-full|docker-webui-smoke|operator-evidence-bundle-validation/);
  assert.match(workflow, /release-addon-readiness-summary:[\s\S]*full-homebrew-tap-update[\s\S]*docker-webui-clean-vm-evidence[\s\S]*release-addon-readiness-summary-\$\{\{ inputs\.opl_version \}\}/);
  assert.doesNotMatch(
    readinessJob.match(/\n    if:[^\n]+/)?.[0] ?? '',
    /if:\s+\$\{\{\s*always\(\)\s*\}\}/,
  );
});

test('desktop release diagnostics workflow is diagnostic-only and read-only', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-diagnostics.yml'), 'utf8');

  assert.match(workflow, /name: OPL Desktop Release Diagnostics/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /release_run_id:/);
  assert.match(workflow, /run_vm_diagnostic:/);
  assert.match(workflow, /build_standard_artifact:/);
  assert.match(workflow, /release_dmg_url:/);
  assert.match(workflow, /release_artifact_name:/);
  assert.match(workflow, /release_artifact_run_id:/);
  assert.match(workflow, /package_profile:/);
  assert.match(workflow, /concurrency:[\s\S]*inputs\.diagnostic_scope[\s\S]*temporary-standard-artifact[\s\S]*inputs\.release_artifact_run_id[\s\S]*release-asset[\s\S]*inputs\.run_vm_diagnostic/);
  assert.match(workflow, /permissions:[\s\S]*actions: read[\s\S]*contents: read/);
  assert.match(workflow, /diagnostic-inputs:/);
  assert.match(workflow, /Validate diagnostic workflow inputs/);
  assert.match(workflow, /build_standard_artifact only supports package_profile=standard/);
  assert.match(workflow, /build_standard_artifact must not be combined with release_dmg_url, release_artifact_name, or release_artifact_run_id/);
  assert.match(workflow, /npm run release:closeout --/);
  assert.match(workflow, /--artifact-profile diagnostics/);
  assert.match(workflow, /npm run release:actions-timing --/);
  assert.match(workflow, /standard-dmg-diagnostic-artifact:/);
  assert.match(workflow, /Build temporary standard DMG diagnostic artifact/);
  assert.match(workflow, /upload_installers_only:\s+true/);
  assert.match(workflow, /skip_code_quality:\s+true/);
  assert.match(workflow, /vm-harness-diagnostics-standard-artifact:/);
  assert.match(workflow, /Run first-run VM diagnostic harness for temporary standard artifact/);
  assert.match(workflow, /inputs\.build_standard_artifact && needs\.diagnostic-inputs\.result == 'success' && needs\.standard-dmg-diagnostic-artifact\.result == 'success'/);
  assert.match(workflow, /vm-harness-diagnostics-release-asset:/);
  assert.match(workflow, /Run first-run VM diagnostic harness for release asset/);
  assert.match(workflow, /!inputs\.build_standard_artifact && needs\.diagnostic-inputs\.result == 'success'/);
  assert.match(workflow, /uses:\s+\.\/\.github\/workflows\/opl-first-run-vm\.yml/);
  assert.match(workflow, /release_artifact_name:\s+macos-build-arm64-dmg/);
  assert.match(workflow, /release_artifact_run_id:\s+\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /release_artifact_name:\s+\$\{\{ inputs\.release_artifact_name \}\}/);
  assert.match(workflow, /release_artifact_run_id:\s+\$\{\{ inputs\.release_artifact_run_id != '' && inputs\.release_artifact_run_id \|\| inputs\.release_run_id \}\}/);
  assert.match(workflow, /release-diagnostics-\$\{\{ inputs\.opl_version \}\}/);
  assert.doesNotMatch(workflow, /contents:\s+write/);
  assert.doesNotMatch(workflow, /packages:\s+write/);
  assert.doesNotMatch(workflow, /full-first-install-release|gh release edit|gh release upload|npm run release:publish/);
});

test('desktop promote workflow is gated by the candidate record before publishing', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', 'desktop-release-promote.yml'), 'utf8');
  assert.match(workflow, /release_run_id:/);
  assert.match(workflow, /release_owner_verdict_ref:/);
  assert.match(workflow, /release_owner_receipt_ref:/);
  assert.match(workflow, /require_docker_webui:/);
  assert.match(workflow, /Download release candidate record/);
  assert.match(workflow, /release-candidate-record-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /release-candidate-record\.json/);
  assert.match(workflow, /Download owner-resolution preflight input/);
  assert.match(workflow, /Download owner-resolution readiness input/);
  assert.match(workflow, /Download owner-resolution remote verification input/);
  assert.match(workflow, /Download add-on readiness input/);
  assert.match(workflow, /release-addon-readiness-summary-\$\{\{ inputs\.opl_version \}\}/);
  assert.match(workflow, /Resolve release owner gate/);
  assert.match(workflow, /RELEASE_OWNER_RECEIPT_REF:\s+\$\{\{ inputs\.release_owner_receipt_ref \}\}/);
  assert.match(workflow, /npm run release:candidate-record:resolve-owner/);
  assert.match(workflow, /--release-owner-receipt-ref "\$\{RELEASE_OWNER_RECEIPT_REF\}"/);
  assert.match(workflow, /Verify same-cohort add-on readiness/);
  assert.match(workflow, /scripts\/validate-release-addon-readiness\.ts/);
  assert.match(workflow, /--require-docker-webui "\$\{\{ inputs\.require_docker_webui \}\}"/);
  assert.match(workflow, /npm run release:candidate-record:validate/);
  assert.match(workflow, /--record release-candidate-record-input\/release-candidate-record\.json/);
  assert.match(workflow, /outputs:[\s\S]*framework_ref: \$\{\{ steps\.release-cohort\.outputs\.framework_ref \}\}/);
  assert.match(workflow, /Resolve release cohort refs/);
  assert.match(workflow, /record\?\.inputs\?\.framework_ref/);
  assert.match(workflow, /Release candidate record must expose a fixed framework_ref SHA for Homebrew VM smoke/);
  assert.doesNotMatch(workflow, /node <<'NODE'/);
  assert.match(workflow, /Verify remote release assets/);
  assert.match(workflow, /Publish draft release/);
  assert.match(workflow, /Verify published release readback/);
  assert.match(workflow, /gh release view "\$tag"[\s\S]*--json tagName,isDraft,isPrerelease,publishedAt,assets/);
  assert.match(workflow, /gh release list[\s\S]*--json tagName,isLatest,isDraft,isPrerelease,publishedAt/);
  assert.match(workflow, /git ls-remote --exit-code --tags origin "refs\/tags\/\$\{tag\}"/);
  assert.match(workflow, /^ {10}NODE\n {14}then$/m);
  assert.match(workflow, /Update Stable Homebrew tap/);
  assert.match(workflow, /Update Full Homebrew tap/);
  assert.match(workflow, /Run Homebrew standard first-run VM smoke/);
  assert.match(workflow, /uses:\s+\.\/\.github\/workflows\/homebrew-tap-update\.yml/);
  assert.match(workflow, /uses:\s+\.\/\.github\/workflows\/opl-first-run-vm\.yml/);
  assert.match(workflow, /package_profile:\s+homebrew-standard/);
  const homebrewStandardVmJob = workflow.match(/\n  homebrew-standard-first-run-vm-smoke:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  assert.match(homebrewStandardVmJob, /needs:[\s\S]*- promote/);
  assert.match(homebrewStandardVmJob, /stable-homebrew-tap-update/);
  assert.match(homebrewStandardVmJob, /shell_ref: \$\{\{ needs\.promote\.outputs\.shell_ref \}\}/);
  assert.match(homebrewStandardVmJob, /framework_ref: \$\{\{ needs\.promote\.outputs\.framework_ref \}\}/);
  assert.doesNotMatch(homebrewStandardVmJob, /full-homebrew-tap-update/);
  assert.ok(workflow.indexOf('Verify release candidate record') < workflow.indexOf('Publish draft release'));
  assert.ok(workflow.indexOf('Verify same-cohort add-on readiness') < workflow.indexOf('Publish draft release'));
  assert.ok(workflow.indexOf('Verify remote release assets') < workflow.indexOf('Publish draft release'));
  assert.ok(workflow.indexOf('Publish draft release') < workflow.indexOf('Verify published release readback'));
  assert.ok(workflow.indexOf('Verify published release readback') < workflow.indexOf('Update Stable Homebrew tap'));
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
  assert.match(workflow, /release_artifact_run_id:/);
  assert.match(job, /run-id:\s+\$\{\{ inputs\.release_artifact_run_id \|\| github\.run_id \}\}/);
  assert.match(job, /workflow artifact \$\{\{ inputs\.release_artifact_name \}\} from run \$\{\{ inputs\.release_artifact_run_id \|\| github\.run_id \}\}/);
  assert.match(job, /Resolve first-run VM timeouts/);
  assert.match(job, /Record first-run VM wrapper diagnostics/);
  assert.match(job, /app-wrapper-diagnostics\.json/);
  assert.match(job, /app-wrapper-preflight\.log/);
  assert.match(job, /Restore Codex install asset cache/);
  assert.match(job, /actions\/cache\/restore@v5/);
  assert.match(job, /Save Codex install asset cache/);
  assert.match(job, /actions\/cache\/save@v5/);
  assert.match(job, /continue-on-error:\s+true/);
  assert.match(job, /Prefetch Codex package install assets/);
  assert.match(job, /codex-package-preflight\.json/);
  assert.match(job, /codex-package-registry-response\.json/);
  assert.match(job, /codex-package-tarballs\/openai-codex\.tgz/);
  assert.match(job, /codex-package-tarballs\/openai-codex-darwin-arm64\.tgz/);
  assert.match(job, /codex-npm-cache/);
  assert.match(job, /npm[\s\S]*view[\s\S]*@openai\/codex@latest[\s\S]*version[\s\S]*dist\.tarball/);
  assert.match(job, /platformPackageSpec/);
  assert.match(job, /platform_tarball_path/);
  assert.match(job, /platform_tarball[\s\S]*sha256/);
  assert.match(job, /platform_tarball[\s\S]*size_bytes/);
  assert.match(job, /registry[\s\S]*status_code/);
  assert.match(job, /npm_view:\s+npmView/);
  assert.doesNotMatch(job, /\bnpm_view,/);
  assert.match(job, /package[\s\S]*version/);
  assert.match(job, /tarball_url_host/);
  assert.match(job, /tarball[\s\S]*sha256/);
  assert.match(job, /tarball[\s\S]*size_bytes/);
  assert.match(job, /elapsed_ms/);
  assert.match(job, /const diagnostics = \[\]/);
  assert.match(job, /const blockingFailures = \[\]/);
  assert.match(job, /registry package metadata request failed/);
  assert.match(job, /diagnostics\.push\('registry package metadata request failed'\)/);
  assert.match(job, /status: blockingFailures\.length === 0 \? 'ok' : 'failed'/);
  assert.match(job, /blocking_failures: blockingFailures/);
  assert.match(job, /warnings: diagnostics/);
  assert.match(job, /failures: blockingFailures/);
  assert.match(job, /Codex package install asset diagnostic warning/);
  assert.match(job, /if \(blockingFailures\.length > 0\)/);
  assert.match(job, /install_asset_cache_preseed_not_app_readiness_truth_or_owner_receipt/);
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
  assert.match(job, /--codex-package-tarball "\$\{\{ steps\.codex_package_preflight\.outputs\.tarball_path \}\}"/);
  assert.match(
    job,
    /--codex-platform-package-tarball "\$\{\{ steps\.codex_package_preflight\.outputs\.platform_tarball_path \}\}"/,
  );
  assert.match(job, /--codex-npm-cache-dir "\$\{\{ steps\.codex_package_preflight\.outputs\.npm_cache_dir \}\}"/);
  assert.match(job, /codex_phase_timeout_interface: 'opl_aion_shell_phase_options'/);
  assert.match(job, /shell_interface_status: 'implemented_opl_aion_shell_phase_options'/);
  assert.doesNotMatch(job, /shell interface pending/);
  assert.doesNotMatch(job, /pending_opl_aion_shell/);
  assert.match(job, /app-wrapper-smoke-command-preview\.txt/);
  assert.match(job, /app-wrapper-smoke\.stdout\.log/);
  assert.match(job, /app-wrapper-smoke\.stderr\.log/);
  assert.match(job, /exit_code/);
  assert.match(job, /phase_timings/);
  assert.doesNotMatch(job, /--bootstrap-launch-diagnostics/);
  assert.match(job, /id:\s+vm_smoke/);
  assert.match(job, /Write first-run VM critical diagnostics[\s\S]*write-first-run-vm-critical-diagnostics\.ts/);
  assert.match(job, /RELEASE_ARTIFACT_DOWNLOAD_OUTCOME:\s+\$\{\{ steps\.release_artifact_download\.outcome \|\| 'skipped' \}\}/);
  assert.match(job, /DMG_CONCLUSION:\s+\$\{\{ steps\.dmg\.conclusion \|\| 'skipped' \}\}/);
  const vmCriticalDiagnosticsScript = fs.readFileSync(
    path.join(appRoot, 'scripts', 'write-first-run-vm-critical-diagnostics.ts'),
    'utf8',
  );
  assert.match(vmCriticalDiagnosticsScript, /vm-gate-failure-summary\.json/);
  assert.match(vmCriticalDiagnosticsScript, /artifact_download_failed/);
  assert.match(vmCriticalDiagnosticsScript, /release_asset_missing/);
  assert.match(vmCriticalDiagnosticsScript, /vm_launch_failed/);
  assert.match(vmCriticalDiagnosticsScript, /app_ready_failed/);
  assert.match(vmCriticalDiagnosticsScript, /retry_entry/);
  assert.match(vmCriticalDiagnosticsScript, /rebuilds_standard_or_full_artifact:\s+false/);
  assert.match(vmCriticalDiagnosticsScript, /truth_boundary: 'critical diagnostics are not release-ready evidence/);
  assert.match(job, /Upload first-run VM critical diagnostics[\s\S]*if:\s+\$\{\{ always\(\) \}\}[\s\S]*if-no-files-found:\s+error[\s\S]*retention-days:\s+7/);
  assert.match(job, /Upload first-run VM artifacts[\s\S]*?if:\s+\$\{\{ always\(\) \}\}/);
  assert.match(job, /Upload first-run VM artifacts[\s\S]*?if-no-files-found:\s+warn/);

  const shellSmoke = fs.readFileSync(
    path.join(activeShellRoot, 'scripts', 'opl-first-run-vm-smoke.mjs'),
    'utf8',
  );
  const tartSmoke = fs.readFileSync(
    path.join(activeShellRoot, 'scripts', 'opl-first-run-tart-smoke.mjs'),
    'utf8',
  );
  assert.match(tartSmoke, /--smoke-timeout-ms <n>/);
  assert.match(tartSmoke, /--codex-install-phase-timeout-ms <n>/);
  assert.match(tartSmoke, /--codex-readiness-phase-timeout-ms <n>/);
  assert.match(tartSmoke, /GUEST_SMOKE_SCRIPT_PATH/);
  assert.match(tartSmoke, /tart-smoke-summary\.json/);
  assert.match(tartSmoke, /smoke-events\.jsonl/);
  assert.match(tartSmoke, /runtime_profile: options\.runtimeProfile/);
  assert.match(tartSmoke, /settings_smoke: options\.settingsSmoke/);
  assert.match(tartSmoke, /assistant_route_smoke: options\.assistantRouteSmoke/);
  assert.match(shellSmoke, /--codex-install-phase-timeout-ms <n>/);
  assert.match(shellSmoke, /--codex-readiness-phase-timeout-ms <n>/);
  assert.match(shellSmoke, /waitForFullFirstRunEquivalence/);
  assert.match(shellSmoke, /full_runtime_equivalence/);
  assert.match(shellSmoke, /app-release-runtime-evidence-summary\.json/);
  assert.match(shellSmoke, /codex-functional-check-summary\.json/);
  assert.match(shellSmoke, /codex-ai-self-check-summary\.json/);
  assert.match(shellSmoke, /first-launch\.png/);

  const vmArtifactScenarioIds = new Set([
    'standard_dmg_clean_vm_smoke',
    'homebrew_standard_cask_clean_vm_smoke',
    'full_dmg_clean_vm_smoke',
  ]);

  for (const scenarioId of [
    'full_first_install_clean_machine',
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
    if (vmArtifactScenarioIds.has(scenarioId)) {
      for (const artifact of [
        'codex-package-preflight.json',
        'codex-package-registry-response.json',
        'codex-package-tarballs/openai-codex.tgz',
        'codex-package-tarballs/openai-codex-darwin-arm64.tgz',
        'codex-npm-cache',
      ]) {
        assert.ok(
          scenario.release_evidence_artifacts.includes(artifact),
          `${scenarioId} must require Codex install asset evidence ${artifact}`,
        );
      }
    }
    assert.equal(scenario.diagnostics_contract.app_wrapper.current_artifact, 'app-wrapper-diagnostics.json');
    assert.deepEqual(scenario.diagnostics_contract.app_wrapper.current_install_asset_artifacts, [
      'codex-package-preflight.json',
      'codex-package-registry-response.json',
      'codex-package-tarballs/openai-codex.tgz',
      'codex-package-tarballs/openai-codex-darwin-arm64.tgz',
    ]);
    assert.deepEqual(scenario.diagnostics_contract.app_wrapper.current_cache_dirs, [
      'codex-npm-cache',
    ]);
    assert.deepEqual(scenario.diagnostics_contract.app_wrapper.required_preflight_fields, [
      'host.node',
      'host.npm',
      'host.curl',
      'host.npm_registry',
      'host.codex_package_metadata',
      'host.codex_package_preflight',
      'release_inputs.diagnostic_scope',
      'artifact_paths.codex_package_preflight',
      'artifact_paths.codex_package_registry_response',
      'artifact_paths.codex_package_tarball',
      'artifact_paths.codex_platform_package_tarball',
      'artifact_paths.codex_npm_cache_dir',
      'codex_install.install_asset_preseed',
    ]);
    assert.deepEqual(scenario.diagnostics_contract.app_wrapper.required_codex_package_preflight_fields, [
      'status',
      'registry.status_code',
      'package.version',
      'package.tarball_url',
      'package.tarball_url_host',
      'package.platform_version',
      'package.platform_tarball_url',
      'package.platform_tarball_url_host',
      'tarball.sha256',
      'tarball.size_bytes',
      'platform_tarball.sha256',
      'platform_tarball.size_bytes',
      'timings.elapsed_ms',
      'cache.npm_cache_dir',
      'blocking_failures',
      'warnings',
      'truth_boundary',
    ]);
    assert.deepEqual(scenario.diagnostics_contract.app_wrapper.required_timeout_fields, [
      'job_timeout_minutes',
      'run_timeout_ms',
      'smoke_timeout_ms',
      'codex_install_phase_timeout_ms',
      'codex_readiness_phase_timeout_ms',
    ]);
    assert.deepEqual(scenario.diagnostics_contract.app_wrapper.required_wrapper_diagnostic_fields, [
      'app-wrapper-diagnostics.json',
      'app-wrapper-preflight.log',
      'app-wrapper-smoke-command-preview.txt',
      'app-wrapper-smoke.stdout.log',
      'app-wrapper-smoke.stderr.log',
      'tart-smoke-summary.json',
      'artifact_paths.smoke_command_preview',
      'artifact_paths.smoke_stdout',
      'artifact_paths.smoke_stderr',
      'artifact_paths.tart_smoke_summary',
      'smoke_command.exit_code',
      'phase_timings.app_wrapper_preflight',
      'phase_timings.app_wrapper_smoke',
    ]);
    assert.deepEqual(scenario.diagnostics_contract.codex_install.install_asset_preseed, {
      mode: 'host_prefetch_cache_preseed',
      shell_arguments: [
        '--codex-package-tarball',
        '--codex-platform-package-tarball',
        '--codex-npm-cache-dir',
      ],
      required_artifacts: [
        'codex-package-preflight.json',
        'codex-package-registry-response.json',
        'codex-package-tarballs/openai-codex.tgz',
        'codex-package-tarballs/openai-codex-darwin-arm64.tgz',
        'codex-npm-cache',
      ],
      truth_boundary: 'install_asset_cache_preseed_not_app_readiness_truth_or_owner_receipt',
    });
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
