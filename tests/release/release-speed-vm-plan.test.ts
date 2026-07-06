import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function readFullPackageBuilderSource() {
  const root = path.join(appRoot, 'scripts', 'build-full-first-install-package');
  return [
    readRepoFile('scripts/build-full-first-install-package.ts'),
    ...fs.readdirSync(root)
      .filter((entry) => entry.endsWith('.ts'))
      .sort()
      .map((entry) => fs.readFileSync(path.join(root, entry), 'utf8')),
  ].join('\n');
}

function assertIncludes(source: string, expected: string, label: string) {
  assert.ok(source.includes(expected), `${label} must include ${expected}`);
}

function assertMatches(source: string, pattern: RegExp, label: string) {
  assert.match(source, pattern, `${label} must match ${pattern}`);
}

function workflowStepBlock(workflow: string, stepName: string) {
  const escaped = stepName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = workflow.match(new RegExp(`\\n\\s+- name: ${escaped}[\\s\\S]*?(?=\\n\\s+- name: |$)`));
  assert.ok(match, `workflow must include step: ${stepName}`);
  return match[0];
}

function runReleasePlan(args: string[]) {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/plan-release-candidate.ts', ...args],
    {
      cwd: appRoot,
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function laneById(plan: { lanes: Array<{ id: string }> }, laneId: string) {
  const lane = plan.lanes.find((candidate) => candidate.id === laneId);
  assert.ok(lane, `release plan must include lane ${laneId}`);
  return lane as {
    id: string;
    phase: string;
    depends_on?: string[];
    can_run_with: string[];
    command: string;
    required_for: string[];
  };
}

test('desktop release workflow keeps the release DAG split by build, publish, verification, and VM gates', () => {
  const workflow = readRepoFile('.github/workflows/desktop-release.yml');

  assertMatches(workflow, /concurrency:[\s\S]*group:\s+opl-desktop-release-\$\{\{ inputs\.release_mode \}\}-\$\{\{ inputs\.opl_version \}\}/, 'desktop release concurrency group');
  assertMatches(workflow, /cancel-in-progress:\s+false/, 'desktop release same-version queue policy');
  assertMatches(
    workflow,
    /release-workflow-contract:[\s\S]*?name:\s+Release workflow contract[\s\S]*?npm run validate:release-boundary/,
    'desktop release workflow contract gate',
  );
  assertMatches(workflow, /release-source-gate:[\s\S]*?name:\s+Release source gate[\s\S]*?npm run release:source-gate --/, 'desktop release source gate');
  assertMatches(workflow, /release-source-gate:[\s\S]*?--app-ref "\$GITHUB_SHA"[\s\S]*?--framework-ref "\$\{\{ inputs\.framework_ref \|\| 'main' \}\}"[\s\S]*?--require-shell-format true[\s\S]*?--run-shell-tests true/, 'desktop release source gate pins App HEAD, framework ref, shell format, and active shell test policy');
  assertIncludes(workflow, 'standard-build:', 'desktop release workflow');
  assertMatches(workflow, /standard-build:[\s\S]*?needs:[\s\S]*?release-workflow-contract[\s\S]*?release-source-gate/, 'standard build waits for cheap source gates');
  assertIncludes(workflow, 'uses: ./.github/workflows/_build-reusable.yml', 'standard build job');
  assertMatches(
    workflow,
    /publish-standard:[\s\S]*?needs:[\s\S]*?release-source-gate[\s\S]*?standard-build/,
    'publish-standard job waits for source gate outputs and standard build',
  );
  assertMatches(workflow, /full-first-install:[\s\S]*?uses:\s+\.\/\.github\/workflows\/full-first-install-release\.yml/, 'Full package build job');
  assertMatches(workflow, /full-first-install:[\s\S]*?needs:\s+standard-vm-smoke-gate-after-full/, 'Full package build waits for standard VM fail-fast gate');
  assertMatches(
    workflow,
    /full-first-install:[\s\S]*?needs\.standard-vm-smoke-gate-after-full\.result == 'success'/,
    'Full package build is skipped unless the standard VM fail-fast gate passed',
  );
  assertMatches(workflow, /full-first-install:[\s\S]*?publish_to_release:\s+false/, 'Full package build-only job');
  assertMatches(workflow, /publish-full-assets:[\s\S]*?needs:[\s\S]*?publish-standard[\s\S]*?full-first-install/, 'Full package publish job');
  assertMatches(
    workflow,
    /remote-verify-standard:[\s\S]*?needs:[\s\S]*?publish-standard[\s\S]*?standard-first-run-vm-smoke-after-standard-only/,
    'standard remote verification waits for the standard VM fail-fast gate',
  );
  assertMatches(
    workflow,
    /remote-verify-standard:[\s\S]*?needs\.standard-first-run-vm-smoke-after-standard-only\.result == 'success'/,
    'standard remote verification is skipped after a failed standard VM gate',
  );
  assertMatches(workflow, /remote-verify-full:[\s\S]*?needs:[\s\S]*?publish-full-assets[\s\S]*?standard-vm-smoke-gate-after-full/, 'Full remote verification job waits for standard VM fail-fast gate');
  assertMatches(
    workflow,
    /standard-first-run-vm-smoke-after-standard-only:[\s\S]*?needs:\s+publish-standard/,
    'standard-only VM smoke runs immediately after standard publish',
  );
  assertMatches(
    workflow,
    /standard-first-run-vm-smoke-after-full:[\s\S]*?needs:\s+publish-standard/,
    'standard VM smoke after Full job',
  );
  assertMatches(
    workflow,
    /standard-vm-smoke-gate-after-full:[\s\S]*?Standard VM smoke must pass before Full build, remote verification, Homebrew, operator evidence, or readiness aggregation can run/,
    'standard VM fail-fast gate for Full release path',
  );
  assertMatches(
    workflow,
    /release_artifact_name:\s+macos-build-arm64-dmg/,
    'standard VM smoke uses the DMG-only artifact',
  );
  assertMatches(
    workflow,
    /stable-homebrew-tap-update:[\s\S]*?uses:\s+\.\/\.github\/workflows\/homebrew-tap-update\.yml/,
    'Stable Homebrew tap update job',
  );
  assertMatches(
    workflow,
    /stable-homebrew-tap-update:[\s\S]*?needs\.standard-vm-smoke-gate-after-full\.result == 'success'/,
    'Stable Homebrew tap update must wait for the standard VM fail-fast gate on Full release runs',
  );
  assertMatches(
    workflow,
    /full-homebrew-tap-update:[\s\S]*?inputs\.release_mode == 'refresh_existing'/,
    'Full Homebrew tap update must stay on published-release refresh path inside desktop release',
  );
  assertMatches(
    workflow,
    /full-homebrew-tap-update:[\s\S]*?if:\s+\$\{\{ !cancelled\(\) && inputs\.include_full_package/,
    'Full Homebrew tap update must opt out of default success() skip propagation from standard-only jobs',
  );
  assertMatches(workflow, /homebrew-standard-first-run-vm-smoke:[\s\S]*?needs:[\s\S]*?stable-homebrew-tap-update/, 'Homebrew VM smoke job');
  const homebrewVmJob = workflow.match(/\n  homebrew-standard-first-run-vm-smoke:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  assertMatches(
    homebrewVmJob,
    /if:\s+\$\{\{ !cancelled\(\) && inputs\.run_vm_smoke/,
    'Homebrew VM smoke must opt out of default success() skip propagation from standard-only jobs',
  );
  assert.doesNotMatch(homebrewVmJob, /full-homebrew-tap-update/, 'standard Homebrew VM smoke must not wait for the unrelated Full cask tap update');
  assertMatches(
    workflow,
    /homebrew-standard-first-run-vm-smoke:[\s\S]*?inputs\.release_mode == 'refresh_existing'/,
    'Homebrew VM smoke must stay on published-release refresh path inside desktop release',
  );
  assertMatches(
    workflow,
    /full-first-run-vm-smoke:[\s\S]*?needs:[\s\S]*?publish-full-assets[\s\S]*?standard-vm-smoke-gate-after-full/,
    'Full VM smoke job waits for published Full assets and the standard VM gate',
  );
  assertMatches(
    workflow,
    /full-first-run-vm-smoke:[\s\S]*?needs\.standard-vm-smoke-gate-after-full\.result == 'success'/,
    'Full VM smoke is skipped unless the standard VM gate passed',
  );
  assertMatches(workflow, /one-shot-app-installer-smoke:[\s\S]*?needs:[\s\S]*?publish-standard[\s\S]*?standard-vm-smoke-gate-after-full/, 'one-shot installer smoke waits for standard VM fail-fast gate');
  assertMatches(workflow, /docker-webui-smoke:[\s\S]*?needs:[\s\S]*?publish-standard[\s\S]*?standard-vm-smoke-gate-after-full/, 'Docker WebUI smoke waits for standard VM fail-fast gate');
  assertMatches(workflow, /same_job_after_docker_webui_smoke/, 'WebUI GHCR publish reuses the smoked image build');
  assertMatches(workflow, /repeated_docker_build: false/, 'WebUI publish summary records avoided rebuild');
  assertMatches(workflow, /webui-ghcr-publish:[\s\S]*Download WebUI GHCR publish summary[\s\S]*Verify WebUI GHCR publish summary/, 'WebUI GHCR gate verifies the publish summary without rebuilding');
  assertMatches(
    workflow,
    /operator-evidence-bundle-validation:[\s\S]*?node --experimental-strip-types scripts\/validate-release-evidence-bundle\.ts[\s\S]*?> evidence-validation-summary\.json/,
    'operator evidence validation must write strict JSON without npm run banner output',
  );
  assertMatches(
    workflow,
    /operator-evidence-bundle-validation:[\s\S]*?repository:\s+gaofeng21cn\/one-person-lab[\s\S]*?ref:\s+\$\{\{ needs\.publish-standard\.outputs\.framework_sha \}\}[\s\S]*?npm ci[\s\S]*?node --experimental-strip-types scripts\/collect-release-evidence\.ts/,
    'operator evidence validation must collect OPL runtime evidence through the pinned Framework CLI',
  );
  assertMatches(
    workflow,
    /operator-evidence-bundle-validation:[\s\S]*?--action-id\s+developer_supervisor_refresh[\s\S]*?--execute-action/,
    'operator evidence collector must use the stable payload-free release evidence action fixture',
  );
  assertMatches(
    workflow,
    /operator-evidence-bundle-validation:[\s\S]*?full_source_dir="release-evidence-inputs\/opl-first-run-vm-full-\$\{\{ github\.run_id \}\}"[\s\S]*?standard_source_dir="release-evidence-inputs\/opl-first-run-vm-standard-\$\{\{ github\.run_id \}\}"[\s\S]*?remote_source_dir="release-evidence-inputs\/remote-release-verification-\$\{\{ inputs\.opl_version \}\}"[\s\S]*?--evidence-source-dir "\$full_source_dir"[\s\S]*?--evidence-source-dir "\$standard_source_dir"[\s\S]*?--evidence-source-dir "\$remote_source_dir"/,
    'operator evidence collector must import same-cohort Full VM, standard VM, and remote verification artifacts',
  );
  assertMatches(
    workflow,
    /operator-evidence-bundle-validation:[\s\S]*?full_source_dir="release-evidence-inputs\/opl-first-run-vm-full-\$\{\{ github\.run_id \}\}"[\s\S]*?runtime_screenshot=\$full_source_dir\/artifacts\/settings-pages\/runtime-status\.png/,
    'operator evidence collector must map the packaged Runtime page screenshot from the Full VM artifact',
  );
  assertMatches(
    workflow,
    /operator-evidence-bundle-validation:[\s\S]*?manifest_args=\([\s\S]*?--bundle-dir "\$bundle_dir"[\s\S]*?--overwrite[\s\S]*?manifest_args\+=\(--require-conditional docker_webui_clean_vm_evidence\)[\s\S]*?node --experimental-strip-types scripts\/write-release-evidence-manifest\.ts "\$\{manifest_args\[@\]\}"/,
    'operator evidence manifest must use the direct script when producing machine artifacts',
  );
  const operatorEvidenceJob = workflow.match(/\n  operator-evidence-bundle-validation:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  assert.doesNotMatch(operatorEvidenceJob, /npm run [^\n]*> evidence-(?:collection|validation)-summary\.json/);
  assertMatches(workflow, /release-readiness-admission:[\s\S]*?Release readiness aggregation is blocked by failed, skipped, or missing required gates/, 'release readiness admission fail-fast job');
  assert.doesNotMatch(
    workflow.match(/\n  release-readiness-admission:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '',
    /full-homebrew-tap-update|homebrew-standard-first-run-vm-smoke|docker-webui-clean-vm-evidence/,
    'Standard readiness admission must not wait for add-on gates by default',
  );
  assertMatches(workflow, /release-readiness-summary:[\s\S]*?needs\.release-readiness-admission\.result == 'success'/, 'final release readiness summary waits for admission');
  assertMatches(workflow, /release-readiness-summary:[\s\S]*?remote-verify-standard[\s\S]*?standard-first-run-vm-smoke-after-standard-only[\s\S]*?standard-first-run-vm-smoke-after-full[\s\S]*?standard-vm-smoke-gate-after-full[\s\S]*?one-shot-app-installer-smoke[\s\S]*?release-readiness-admission/, 'standard release readiness dependencies');
  assert.doesNotMatch(
    workflow.match(/\n  release-readiness-summary:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '',
    /remote-verify-full|full-first-run-vm-smoke|docker-webui-smoke|operator-evidence-bundle-validation/,
    'Standard readiness summary must not wait for add-on jobs',
  );
  assertMatches(workflow, /release-addon-readiness-summary:[\s\S]*?remote-verify-full[\s\S]*?full-first-run-vm-smoke[\s\S]*?docker-webui-smoke[\s\S]*?operator-evidence-bundle-validation/, 'same-cohort add-on status dependencies');
  assertMatches(workflow, /release-readiness-summary:[\s\S]*?remote-release-verification-\$\{\{ inputs\.opl_version \}\}/, 'remote verification small artifact');
  assertMatches(workflow, /release-addon-readiness-summary:[\s\S]*?release-addon-readiness-summary\.json/, 'same-cohort add-on status artifact');
  assertMatches(workflow, /release-readiness-summary:[\s\S]*?release-readiness-summary\.json/, 'machine-readable release readiness summary');
  assertMatches(workflow, /release-readiness-summary:[\s\S]*?summarize-release-readiness\.ts/, 'scripted release readiness aggregation');
  const readinessJob = workflow.match(/\n  release-readiness-summary:[\s\S]*?(?=\n  [a-z0-9-]+:\n|$)/)?.[0] ?? '';
  assert.doesNotMatch(readinessJob, /release:closeout/, 'release readiness must not run diagnostic closeout');
  assert.doesNotMatch(readinessJob, /release:actions-timing/, 'release readiness must not run diagnostic timing');
  assert.doesNotMatch(readinessJob, /release-closeout/, 'release readiness must not upload diagnostic closeout artifacts');
  assert.doesNotMatch(readinessJob, /release-actions-timing/, 'release readiness must not upload diagnostic timing artifacts');
  assert.doesNotMatch(readinessJob, /name:\s+macos-build-arm64/);
  assert.doesNotMatch(readinessJob, /name:\s+opl-full-first-install-\$\{\{ inputs\.opl_version \}\}-mac-arm64/);

  const diagnosticWorkflow = readRepoFile('.github/workflows/desktop-release-diagnostics.yml');
  assertMatches(diagnosticWorkflow, /name:\s+OPL Desktop Release Diagnostics/, 'desktop release diagnostic workflow name');
  assertMatches(diagnosticWorkflow, /workflow_dispatch:/, 'desktop release diagnostic workflow manual trigger');
  assertMatches(diagnosticWorkflow, /permissions:[\s\S]*actions:\s+read[\s\S]*contents:\s+read/, 'desktop release diagnostic workflow read-only permissions');
  assertMatches(
    diagnosticWorkflow,
    /concurrency:[\s\S]*inputs\.diagnostic_scope[\s\S]*temporary-standard-artifact[\s\S]*inputs\.release_artifact_run_id[\s\S]*release-asset[\s\S]*inputs\.run_vm_diagnostic/,
    'diagnostic workflow concurrency distinguishes temporary, release, and existing-artifact VM diagnostics',
  );
  assertMatches(diagnosticWorkflow, /npm run release:closeout --[\s\S]*--artifact-profile diagnostics/, 'diagnostic workflow closeout harness');
  assertMatches(diagnosticWorkflow, /npm run release:actions-timing --/, 'diagnostic workflow timing harness');
  assertMatches(diagnosticWorkflow, /run_vm_diagnostic:/, 'diagnostic workflow VM harness toggle');
  assertMatches(diagnosticWorkflow, /build_standard_artifact:/, 'diagnostic workflow temporary standard artifact toggle');
  assertMatches(diagnosticWorkflow, /diagnostic_scope:[\s\S]*?default:\s+bootstrap_only/, 'diagnostic workflow defaults to bootstrap-only VM scope');
  assertMatches(diagnosticWorkflow, /standard-dmg-diagnostic-artifact:[\s\S]*?upload_installers_only:\s+true/, 'diagnostic workflow can build a temporary standard DMG only');
  assertMatches(diagnosticWorkflow, /uses:\s+\.\/\.github\/workflows\/opl-first-run-vm\.yml/, 'diagnostic workflow reuses the VM harness');
  assertMatches(diagnosticWorkflow, /vm-harness-diagnostics-standard-artifact:/, 'diagnostic workflow has a same-run temporary artifact VM lane');
  assertMatches(diagnosticWorkflow, /vm-harness-diagnostics-release-asset:/, 'diagnostic workflow has a release asset VM lane');
  assertMatches(diagnosticWorkflow, /inputs\.build_standard_artifact && needs\.diagnostic-inputs\.result == 'success' && needs\.standard-dmg-diagnostic-artifact\.result == 'success'/, 'temporary artifact VM lane waits for the temporary DMG build');
  assertMatches(diagnosticWorkflow, /!inputs\.build_standard_artifact && needs\.diagnostic-inputs\.result == 'success'/, 'release asset VM lane does not need the temporary DMG build');
  assertMatches(diagnosticWorkflow, /release_artifact_name:\s+macos-build-arm64-dmg/, 'diagnostic workflow can diagnose the same-run temporary standard DMG');
  assertMatches(diagnosticWorkflow, /release_artifact_run_id:\s+\$\{\{ github\.run_id \}\}/, 'diagnostic workflow uses the current run for the same-run temporary standard DMG');
  assertMatches(diagnosticWorkflow, /release_artifact_name:\s+\$\{\{ inputs\.release_artifact_name \}\}/, 'diagnostic workflow can diagnose artifacts from an existing run');
  assertMatches(diagnosticWorkflow, /release_artifact_run_id:\s+\$\{\{ inputs\.release_artifact_run_id != '' && inputs\.release_artifact_run_id \|\| inputs\.release_run_id \}\}/, 'diagnostic workflow preserves existing artifact run selection');
  assertMatches(diagnosticWorkflow, /diagnostic_scope:\s+\$\{\{ inputs\.diagnostic_scope \}\}/, 'diagnostic workflow forwards diagnostic scope to the VM harness');
  const vmWorkflow = readRepoFile('.github/workflows/opl-first-run-vm.yml');
  assertMatches(vmWorkflow, /diagnostic_scope:[\s\S]*?default:\s+release_gate/, 'VM harness defaults to full release gate scope');
  assertMatches(vmWorkflow, /Restore Codex install asset cache[\s\S]*?if:\s+\$\{\{ needs\.validate-vm-inputs\.outputs\.diagnostic_scope != 'bootstrap_only' \}\}/, 'bootstrap-only skips Codex cache restore');
  assertMatches(vmWorkflow, /Prefetch Codex package install assets[\s\S]*?if:\s+\$\{\{ needs\.validate-vm-inputs\.outputs\.diagnostic_scope != 'bootstrap_only' \}\}/, 'bootstrap-only skips Codex asset prefetch');
  assertMatches(vmWorkflow, /Save Codex install asset cache[\s\S]*?diagnostic_scope != 'bootstrap_only'/, 'bootstrap-only skips Codex cache save');
  assertMatches(vmWorkflow, /if \[ "\$\{\{ needs\.validate-vm-inputs\.outputs\.diagnostic_scope \}\}" != "bootstrap_only" \]; then[\s\S]*?CMD\+=\(--settings-smoke\)[\s\S]*?CMD\+=\(--assistant-route-smoke\)[\s\S]*?CMD\+=\(--codex-functional-check\)[\s\S]*?CMD\+=\(--codex-ai-self-check\)/, 'secondary release checks stay out of bootstrap-only diagnostics');
  assertMatches(vmWorkflow, /id:\s+vm_smoke[\s\S]*?name:\s+Write first-run VM critical diagnostics[\s\S]*?write-first-run-vm-critical-diagnostics\.ts/, 'VM harness writes critical failure diagnostics after smoke');
  assertMatches(vmWorkflow, /RELEASE_ARTIFACT_DOWNLOAD_OUTCOME:\s+\$\{\{ steps\.release_artifact_download\.outcome \|\| 'skipped' \}\}[\s\S]*?DMG_CONCLUSION:\s+\$\{\{ steps\.dmg\.conclusion \|\| 'skipped' \}\}/, 'VM critical diagnostics receive typed pre-smoke failure boundaries');
  const vmCriticalDiagnosticsScript = readRepoFile('scripts/write-first-run-vm-critical-diagnostics.ts');
  assertMatches(vmCriticalDiagnosticsScript, /artifact_download_failed[\s\S]*release_asset_missing[\s\S]*vm_launch_failed[\s\S]*app_ready_failed/, 'VM critical diagnostics classify typed failure boundaries');
  assertMatches(vmCriticalDiagnosticsScript, /retry_entry/, 'VM critical diagnostics write a retry entry');
  assertMatches(vmCriticalDiagnosticsScript, /rerun_diagnostic_same_artifact/, 'VM critical diagnostics point operators at same-artifact rerun diagnostics');
  assertMatches(vmCriticalDiagnosticsScript, /rebuilds_standard_or_full_artifact:\s+false/, 'VM critical diagnostics keep retry scoped away from artifact rebuilds');
  assertMatches(vmCriticalDiagnosticsScript, /truth_boundary: 'critical diagnostics are not release-ready evidence/, 'VM critical diagnostics must not become release-ready evidence');
  assertMatches(vmWorkflow, /name:\s+Upload first-run VM critical diagnostics[\s\S]*?if:\s+\$\{\{ always\(\) \}\}[\s\S]*?if-no-files-found:\s+error[\s\S]*?retention-days:\s+7/, 'VM critical diagnostics upload is independent and fail-closed');
  assertMatches(vmWorkflow, /name:\s+Upload first-run VM critical diagnostics[\s\S]*?name:\s+opl-first-run-vm-critical-diagnostics-\$\{\{[\s\S]*?name:\s+Upload first-run VM artifacts[\s\S]*?if-no-files-found:\s+warn/, 'large VM artifact upload remains separate and cannot mask critical diagnostics');
  assert.doesNotMatch(diagnosticWorkflow, /full-first-install-release|npm run release:publish/, 'diagnostic workflow must not rebuild or publish release assets');
  assertMatches(diagnosticWorkflow, /release-diagnostics-\$\{\{ inputs\.opl_version \}\}/, 'diagnostic workflow artifact');
});

test('_build-reusable splits quality work into parallel App and active-shell jobs with Bun cache boundaries', () => {
  const workflow = readRepoFile('.github/workflows/_build-reusable.yml');
  const setupAction = readRepoFile('.github/actions/setup-active-shell-deps/action.yml');

  for (const jobId of [
    'workflow-lint',
    'lint-format',
    'typecheck',
    'release-boundary',
    'active-shell-tests',
  ]) {
    assertMatches(workflow, new RegExp(`\\n  ${jobId}:\\n`), `_build-reusable job ${jobId}`);
  }

  assertMatches(workflow, /go install github\.com\/rhysd\/actionlint\/cmd\/actionlint@latest/, 'actionlint install');
  assertMatches(workflow, /actionlint -color -shellcheck= -pyflakes=/, 'actionlint semantic gate');
  assertMatches(workflow, /uses:\s+\.\/\.github\/actions\/setup-active-shell-deps/, 'reusable active shell setup action');
  assertMatches(setupAction, /path:\s+shells\/aionui/, 'active shell checkout');
  assertMatches(setupAction, /key:\s+bun-install-[^\n]*hashFiles\('shells\/aionui\/package\.json', 'shells\/aionui\/bun\.lock'\)/, 'active shell Bun dependency cache key');
  assertMatches(setupAction, /~\/\.bun\/install\/cache|\$\{\{\s*runner\.temp\s*\}\}\/\.bun/, 'Bun install cache');
  assertMatches(setupAction, /Install dependencies[\s\S]*bun install --frozen-lockfile/, 'active shell dependency install');
  assertMatches(workflow, /npm run test:release-boundary|node --experimental-strip-types --test tests\/release\/\*\.test\.ts/, 'App release-boundary quality job');
  assertMatches(workflow, /bun run lint/, 'active shell lint job');
  assertMatches(workflow, /bun run format:check/, 'active shell format job');
  assertMatches(workflow, /bunx tsc --noEmit/, 'active shell typecheck job');
  assertMatches(workflow, /node --experimental-strip-types scripts\/run-active-shell-tests\.ts --project \$\{\{ matrix\.project \}\}/, 'active shell project-split test job');
  assertMatches(workflow, /project:[\s\S]*-\s+node[\s\S]*-\s+dom/, 'active shell project matrix');

  const buildNeeds = workflow.match(/build:[\s\S]*?needs:[\s\S]*?if:/)?.[0] ?? '';
  for (const dependency of [
    'workflow-lint',
    'lint-format',
    'typecheck',
    'release-boundary',
    'active-shell-tests',
    'macos-signing-preflight',
  ]) {
    assertIncludes(buildNeeds, dependency, `build job needs`);
  }
  assertMatches(workflow, /macos-signing-preflight:[\s\S]*name:\s+macOS release signing preflight/, 'macOS signing preflight job');
  assertMatches(workflow, /name:\s+Record local authorization mode[\s\S]*if:\s+\$\{\{ !inputs\.require_macos_gatekeeper \}\}/, 'macOS signing preflight succeeds for local authorization callers');
  assertMatches(workflow, /name:\s+Verify Apple signing and notarization secrets[\s\S]*if:\s+\$\{\{ inputs\.require_macos_gatekeeper \}\}/, 'macOS signing preflight only verifies secrets when Gatekeeper is required');
  assertMatches(workflow, /BUILD_CERTIFICATE_BASE64 P12_PASSWORD APPLE_ID APPLE_ID_PASSWORD TEAM_ID IDENTITY/, 'macOS signing preflight required secrets');
  assertMatches(workflow, /macOS release signing preflight failed/, 'macOS signing preflight failure message');
});

test('Full first-install workflow caches npm, uv, Go, and Bun work and writes an operator summary', () => {
  const workflow = readRepoFile('.github/workflows/full-first-install-release.yml');

  assertMatches(workflow, /concurrency:[\s\S]*group:\s+opl-full-first-install-\$\{\{ inputs\.opl_version \}\}/, 'Full workflow concurrency group');
  assertMatches(workflow, /cancel-in-progress:\s+false/, 'Full workflow stable cancellation policy');
  assertMatches(workflow, /Setup Node\.js[\s\S]*cache:\s+npm/, 'Full workflow npm cache');
  assertMatches(workflow, /Setup Go[\s\S]*cache:\s+true/, 'Full workflow Go cache');
  assertMatches(workflow, /uv cache dir|~\/\.cache\/uv|\$\{\{\s*runner\.temp\s*\}\}\/uv-cache/, 'Full workflow uv cache');
  assertMatches(workflow, /~\/\.bun\/install\/cache|\$\{\{\s*runner\.temp\s*\}\}\/\.bun/, 'Full workflow Bun cache');
  assertMatches(workflow, /name:\s+Cache Electron artifacts[\s\S]*id:\s+electron-cache/, 'Full workflow Electron artifact cache');
  assertMatches(workflow, /full-electron-cache-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}/, 'Full Electron cache is scoped to runner OS and arch');
  assertMatches(workflow, /electron-cache-macos-arm64-arm64-/, 'Full Electron cache can reuse standard macOS arm64 cache lineage');
  assertMatches(workflow, /name:\s+Install App shell dependencies[\s\S]*bun install --frozen-lockfile/, 'Full workflow installs shell dependencies before Electron rebuild');
  assert.doesNotMatch(workflow, /name:\s+Install App shell dependencies[\s\S]*npm_config_runtime:\s+electron[\s\S]*bun install --frozen-lockfile/, 'Full shell dependency install must not compile native modules against Electron headers');
  assertMatches(workflow, /name:\s+Resolve App shell Electron version[\s\S]*id:\s+shell-electron-version[\s\S]*OPL_FULL_SHELL_ELECTRON_VERSION/, 'Full workflow resolves shell Electron version once');
  assertMatches(workflow, /name:\s+Rebuild App shell native modules for Electron[\s\S]*npm_config_runtime:\s+electron[\s\S]*npm_config_target:\s+\$\{\{ steps\.shell-electron-version\.outputs\.version \}\}[\s\S]*electron-builder install-app-deps/, 'Full workflow rebuilds native modules against the resolved Electron version');
  assertMatches(workflow, /\$GITHUB_STEP_SUMMARY/, 'Full workflow summary');
  assertMatches(workflow, /Full first-install|runtime layer cache|Full runtime/, 'Full workflow summary content');
  assert.equal(
    (workflow.match(/name:\s+Summarize Full package size/g) ?? []).length,
    1,
    'Full workflow should summarize package size once',
  );
  assertMatches(workflow, /schema:\s+'opl_full_workflow_telemetry\.v1'|schema:\s+"opl_full_workflow_telemetry\.v1"/, 'Full telemetry schema');
  assertMatches(workflow, /full-workflow-telemetry\.json/, 'Full telemetry JSON path');
  assertMatches(workflow, /full-package-build-timing\.json/, 'Full package build timing JSON path');
  assertMatches(workflow, /shell_node_dependencies:\s+duration\(env\.OPL_FULL_FRAMEWORK_BUILD_READY_AT, env\.OPL_FULL_SHELL_NODE_DEPS_READY_AT\)/, 'Full telemetry separates shell Node dependency install timing');
  assertMatches(workflow, /shell_electron_native_rebuild:\s+duration\(env\.OPL_FULL_SHELL_NODE_DEPS_READY_AT, env\.OPL_FULL_SHELL_DEPS_READY_AT\)/, 'Full telemetry separates Electron native rebuild timing');
  assertMatches(workflow, /full_package_build_breakdown/, 'Full telemetry package build breakdown');
  assertMatches(workflow, /## Full Package Build Breakdown/, 'Full summary package build breakdown section');
  assertMatches(workflow, /name:\s+Restore Full shell Vite output cache[\s\S]*id:\s+restore-shell-vite-output/, 'Full workflow restores reusable shell Vite output');
  assertMatches(workflow, /full-shell-vite-output-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-\$\{\{ inputs\.opl_version \}\}-/, 'Full Vite cache key includes release version');
  assert.doesNotMatch(workflow, /full-shell-vite-output-[\s\S]*one-person-lab-app\/shells\/aionui\/scripts\/\*\*/, 'Full Vite cache key should not include unrelated shell scripts');
  assert.doesNotMatch(workflow, /full-shell-vite-output-[\s\S]*one-person-lab-app\/shells\/aionui\/packages\/desktop\/electron-builder\.yml/, 'Full Vite cache key should not include packager-only config');
  assertMatches(workflow, /shell_vite_output:\s+'\$\{\{ steps\.restore-shell-vite-output\.outputs\.cache-hit \|\| 'false' \}\}'/, 'Full telemetry records shell Vite output cache hit');
  assertMatches(workflow, /electron_artifacts:\s+'\$\{\{ steps\.electron-cache\.outputs\.cache-hit \|\| 'false' \}\}'/, 'Full telemetry records Electron cache hit');
  assertMatches(workflow, /full_runtime_layer_key_inputs:\s+readJson\('runtime-cache-events\.json'\)\?\.key_inputs/, 'Full telemetry records runtime cache key inputs');
  assertMatches(workflow, /--reuse-gui-vite-output/, 'Full package build can reuse restored shell Vite output');
  assert.ok(!workflow.includes('reuse_gui_args=()'), 'Full workflow avoids empty bash array expansion under set -u');
  assertMatches(workflow, /if \[ "\$\{\{ steps\.restore-shell-vite-output\.outputs\.cache-hit \|\| 'false' \}\}" = "true" \]; then[\s\S]*--reuse-gui-vite-output[\s\S]*else[\s\S]*npm run release:full/, 'Full workflow handles Vite cache hit and miss explicitly');
  assertMatches(workflow, /name:\s+Save Full shell Vite output cache[\s\S]*actions\/cache\/save@v5/, 'Full workflow saves reusable shell Vite output');
  assertMatches(workflow, /payload_refs:\s+fullManifest\?\.resolved_refs/, 'Full telemetry resolved refs field');
  assertMatches(workflow, /resolved_refs:\s+fullManifest\?\.resolved_refs/, 'Full telemetry normalized resolved refs field');
  assertMatches(workflow, /## Full Payload Resolved Refs/, 'Full summary resolved refs section');
  for (const payloadLabel of [
    'OPL Framework',
    'MAS',
    'MAG',
    'RCA',
    'OPL Meta Agent',
    'OfficeCLI',
    'MinerU',
    'UI UX skill',
  ]) {
    assertIncludes(workflow + readRepoFile('scripts/plan-release-candidate.ts'), payloadLabel, `Full resolved refs payload ${payloadLabel}`);
  }
  assertMatches(workflow, /Upload Full workflow telemetry[\s\S]*actions\/upload-artifact@v7/, 'Full telemetry artifact upload');
  assertMatches(workflow, /npm --silent run release:full:size[\s\S]*--full-dmg-size-bytes[\s\S]*full-package-size-summary\.json[\s\S]*full-package-size-summary\.md/, 'Full workflow emits machine-readable size summary');
  const diagnosticsStep = workflowStepBlock(workflow, 'Upload Full diagnostics artifact');
  const localAuthorizationStep = workflowStepBlock(workflow, 'Upload Full local authorization policy');
  assertMatches(workflow, /name:\s+Inspect optional Full release signing secrets/, 'Full workflow inspects optional signing material');
  assertMatches(workflow, /BUILD_CERTIFICATE_BASE64 P12_PASSWORD APPLE_ID APPLE_ID_PASSWORD TEAM_ID IDENTITY/, 'Full signing preflight required secrets');
  assertMatches(workflow, /Full first-install local authorization mode/, 'Full local authorization mode notice');
  assertMatches(diagnosticsStep, /name:\s+opl-full-diagnostics-\$\{\{ env\.OPL_RELEASE_VERSION \}\}/, 'Full diagnostics artifact upload');
  assertMatches(diagnosticsStep, /full-package-build-timing\.json[\s\S]*full-package-manifest\.json[\s\S]*full-package-size-summary\.json[\s\S]*full-package-size-summary\.md[\s\S]*runtime-cache-events\.json[\s\S]*full-runtime-native-trust\.json[\s\S]*full-app-bundle-trim-report\.json[\s\S]*full-package-boundary-audit\.json[\s\S]*full-local-authorization-policy\.json[\s\S]*SHA256SUMS\.txt/, 'Full diagnostics artifact contents');
  assertMatches(workflow, /## Full Size Release Coupling[\s\S]*Full DMG release-blocking by size alone:[\s\S]*Stable release clean evidence remains coupled to remote verification and VM smoke gates/, 'Full workflow records size review as diagnostic unless hard limits or offline-first regressions fail');
  assert.doesNotMatch(diagnosticsStep, /full-gatekeeper-launch-policy\.json/, 'Full diagnostics artifact must not require release-only Gatekeeper evidence');
  assertMatches(localAuthorizationStep, /if:\s+\$\{\{ inputs\.publish_to_release \|\| inputs\.upload_full_package_artifact \}\}[\s\S]*full-local-authorization-policy\.json/, 'Full local authorization policy is uploaded for Stable assets');
  assertMatches(workflow, /upload_full_package_artifact:[\s\S]*default:\s+true/, 'Full package artifact upload defaults on for release-call consumers');
  assertMatches(workflow, /Upload Full package workflow artifact[\s\S]*if:\s+\$\{\{ inputs\.upload_full_package_artifact \}\}/, 'large Full package artifact is explicitly gated');
  assertMatches(workflow, /cache:[\s\S]*full_runtime_layers/, 'Full telemetry cache fields');
  assertMatches(workflow, /full_dmg_format:[\s\S]*default:\s+ULMO[\s\S]*type:\s+string/, 'Full workflow defaults to ULMO DMG compression');
  assertMatches(workflow, /full_dmg_compression_level:[\s\S]*default:\s+'9'[\s\S]*type:\s+string/, 'Full workflow exposes explicit UDZO compression override');
  assertMatches(workflow, /OPL_FULL_DMG_FORMAT:\s+\$\{\{ inputs\.full_dmg_format \|\| 'ULMO' \}\}/, 'Full workflow passes the release-size DMG format');
  assertMatches(workflow, /OPL_FULL_DMG_COMPRESSION_LEVEL:\s+\$\{\{ inputs\.full_dmg_compression_level \|\| '9' \}\}/, 'Full workflow defaults to release-size DMG compression');
  assertMatches(workflow, /dmg_format:\s+fullBuildTiming\?\.dmg_format/, 'Full telemetry records the DMG compression format');
  assertMatches(workflow, /dmg_compression_level:\s+fullBuildTiming\?\.dmg_compression_level/, 'Full telemetry records the fallback DMG compression level');
  assertMatches(workflow, /Restore Full toolchain runtime cache[\s\S]*Restore Full domain runtime cache[\s\S]*Restore Full OPL runtime cache[\s\S]*Restore Full skills runtime cache/, 'per-layer Full runtime cache restore');
  for (const stepName of [
    'Restore Full toolchain runtime cache',
    'Restore Full domain runtime cache',
    'Restore Full OPL runtime cache',
    'Restore Full skills runtime cache',
  ]) {
    assert.doesNotMatch(workflowStepBlock(workflow, stepName), /restore-keys:/, `${stepName} must use exact-key restore only`);
  }
  assertMatches(workflow, /scripts\/assert-full-runtime-currentness\.ts[\s\S]*--runtime-root "\$mounted_runtime_root"[\s\S]*--framework-root "\$GITHUB_WORKSPACE\/one-person-lab"/, 'mounted Full DMG runtime must pass managed-update currentness probe');
  assertMatches(workflow, /full-runtime-currentness-probe\.json/, 'Full diagnostics include runtime currentness probe');
  assertMatches(workflow, /Save Full toolchain runtime cache[\s\S]*Save Full domain runtime cache[\s\S]*Save Full OPL runtime cache[\s\S]*Save Full skills runtime cache/, 'per-layer Full runtime cache save');
  assertMatches(workflow, /git -C "\$GITHUB_WORKSPACE\/MinerU-Ecosystem" show -s --format=%cI HEAD/, 'MinerU build metadata is source-commit stable');
  assertMatches(workflow, /bash "\$GITHUB_WORKSPACE\/OfficeCLI\/install\.sh"/, 'OfficeCLI install uses the resolved checkout');
  assert.doesNotMatch(workflow, /raw\.githubusercontent\.com\/iOfficeAI\/OfficeCLI\/main\/install\.sh/, 'OfficeCLI install must not bypass the resolved checkout');
  assertMatches(workflow, /duration_seconds:[\s\S]*full_package_build/, 'Full telemetry duration fields');

  const buildScript = readFullPackageBuilderSource();
  assertMatches(buildScript, /reuseGuiViteOutput:\s+process\.env\.OPL_FULL_REUSE_GUI_VITE_OUTPUT === '1'/, 'Full package script reads Vite reuse flag');
  assertMatches(buildScript, /--reuse-gui-vite-output/, 'Full package script exposes Vite reuse CLI flag');
  assertMatches(buildScript, /build-mac:arm64'[\s\S]*--skip-vite/, 'Full package script passes --skip-vite to active shell build when reuse is enabled');
  assertMatches(buildScript, /build-mac:arm64'[\s\S]*--dir-only/, 'Full package script asks the active shell for an app bundle only');

  const warmupWorkflow = readRepoFile('.github/workflows/full-runtime-cache-warmup.yml');
  assertMatches(warmupWorkflow, /upload_full_package_artifact:\s+false/, 'Full warmup must avoid uploading the large Full DMG artifact');
  assertMatches(warmupWorkflow, /default:\s+main[\s\S]*shell_ref/, 'Full warmup defaults to main refs used by Stable release refreshes');
});

test('release operations workflows serialize refreshable GitHub Actions runs without cancelling stable release runs', () => {
  const warmupWorkflow = readRepoFile('.github/workflows/full-runtime-cache-warmup.yml');
  const promoteWorkflow = readRepoFile('.github/workflows/desktop-release-promote.yml');
  const verifyWorkflow = readRepoFile('.github/workflows/release-verify-remote.yml');

  assertMatches(warmupWorkflow, /concurrency:[\s\S]*group:\s+opl-full-runtime-cache-warmup-/, 'Full warmup concurrency group');
  assertMatches(warmupWorkflow, /cancel-in-progress:\s+true/, 'Full warmup cancellation policy');
  assertMatches(promoteWorkflow, /concurrency:[\s\S]*group:\s+opl-desktop-release-promote-\$\{\{ inputs\.opl_version \}\}/, 'promote concurrency group');
  assertMatches(promoteWorkflow, /cancel-in-progress:\s+true/, 'promote cancellation policy');
  assertMatches(verifyWorkflow, /concurrency:[\s\S]*group:\s+opl-remote-release-verification-\$\{\{ inputs\.opl_version \}\}/, 'remote verify concurrency group');
  assertMatches(verifyWorkflow, /cancel-in-progress:\s+true/, 'remote verify cancellation policy');
});

test('first-run VM workflow writes deterministic preflight and final summaries before release-blocking smoke', () => {
  const workflow = readRepoFile('.github/workflows/opl-first-run-vm.yml');
  const preflightIndex = workflow.indexOf('Write first-run VM preflight summary');
  const smokeIndex = workflow.indexOf('Run clean VM first launch smoke');

  assert.ok(preflightIndex > 0, 'VM workflow must include a preflight summary step');
  assert.ok(smokeIndex > preflightIndex, 'preflight summary must run before the VM smoke command');
  assertMatches(workflow, /## OPL GUI first-run VM preflight/, 'VM preflight heading');
  assertMatches(workflow, /deterministic release-blocking clean VM first launch/, 'VM gate purpose');
  assertMatches(workflow, /release_artifact_name:/, 'VM same-run artifact input');
  assertMatches(workflow, /release_artifact_run_id:/, 'VM source-run artifact input');
  assertMatches(workflow, /actions\/download-artifact@v8/, 'VM same-run artifact download');
  assertMatches(workflow, /run-id:\s+\$\{\{ inputs\.release_artifact_run_id \|\| github\.run_id \}\}/, 'VM source-run artifact download');
  assertMatches(workflow, /Using same-run workflow artifact/, 'VM artifact source log');
  assertMatches(workflow, /Using source workflow run artifact/, 'VM source-run artifact source log');
  assertMatches(workflow, /release tag \$\{\{ inputs\.release_tag \}\} kept for provenance/, 'VM release tag provenance');
  assertMatches(workflow, /Resolve host Node\.js runtime for guest smoke/, 'VM host Node runtime resolution');
  assertMatches(workflow, /--guest-node-root "\$\{\{ steps\.host_node\.outputs\.node_root \}\}"/, 'VM guest Node copy');
  assertMatches(workflow, /Runner labels/, 'VM runner labels');
  assertMatches(workflow, /Source VM/, 'VM source summary');
  assertMatches(workflow, /Smoke profile: \\?`no-clt-clean-vm\\?`/, 'VM smoke profile summary');
  assertMatches(workflow, /Display: \\?`1920x1080px\\?`/, 'VM display summary');
  assertMatches(workflow, /Settings smoke: enabled/, 'VM settings smoke summary');
  assertMatches(workflow, /Skip scheduled VM while desktop release is active/, 'scheduled VM release activity guard');
  assertMatches(workflow, /--workflow "OPL Desktop Release"/, 'scheduled VM checks desktop release activity');
  assertMatches(workflow, /skip_reason=desktop_release_active_or_queued/, 'scheduled VM skips when release is active or queued');
  assertMatches(workflow, /skip_reason=desktop_release_guard_unavailable/, 'scheduled VM skips when the release activity guard is unavailable');
  assertMatches(workflow, /profile="standard"/, 'scheduled VM defaults to standard App diagnostics');
  assertMatches(workflow, /diagnostic_scope="bootstrap_only"/, 'scheduled VM defaults to bootstrap-only diagnostics');
  assertMatches(
    workflow,
    /clean-vm-first-run:[\s\S]*?if:\s+\$\{\{ needs\.validate-vm-inputs\.outputs\.skip_vm != 'true' \}\}/,
    'scheduled VM skip exits before occupying the self-hosted runner',
  );
  assertMatches(workflow, /tart-smoke-summary\.json/, 'VM final smoke summary artifact');
  assertMatches(
    workflow,
    /name:\s+opl-first-run-vm-\$\{\{\s*steps\.package_profile\.outputs\.profile \|\| needs\.validate-vm-inputs\.outputs\.package_profile\s*\}\}-\$\{\{\s*github\.run_id\s*\}\}/,
    'VM artifacts must be profile-scoped so standard and Full evidence do not collide',
  );
});

test('Docker WebUI smoke records image size as a release-speed artifact', () => {
  const workflow = readRepoFile('.github/workflows/desktop-release.yml');

  assertMatches(workflow, /docker image inspect|docker images|docker image ls/, 'Docker image size measurement');
  assertMatches(workflow, /image[-_]size|size_bytes|Size/, 'Docker image size field');
  assertMatches(workflow, /\/tmp\/opl-webui-image-size[-\w]*\.(json|txt)|artifacts\/docker-webui-image-size/, 'Docker image size artifact path');
  assertMatches(workflow, /Upload Docker WebUI smoke artifacts[\s\S]*opl-webui-image-size/, 'Docker image size upload');
  assert.equal((workflow.match(/docker build/g) ?? []).length, 2, 'stable WebUI release path should build full and slim variants once each');
  assertMatches(workflow, /-t "one-person-lab-webui:\$\{\{ inputs\.opl_version \}\}"/, 'Docker WebUI full image tag');
  assertMatches(workflow, /-t "one-person-lab-webui:\$\{\{ inputs\.opl_version \}\}-slim"/, 'Docker WebUI slim image tag');
  assertMatches(workflow, /"\$\{ghcr_image\}:\$\{\{ inputs\.opl_version \}\}"[\s\S]*"\$\{ghcr_image\}:\$\{\{ inputs\.opl_version \}\}-slim"[\s\S]*"\$\{ghcr_image\}:stable"/, 'stable remains a full image tag while slim is version-scoped');
});

test('release plan exposes depends_on and can_run_with for parallel speed lanes and serialized gates', () => {
  const plan = runReleasePlan(['--version', '26.5.27', '--include-full-package']);

  assert.equal(plan.profile, 'stable');
  assert.equal(plan.strategy.normal_stable_path, 'new_release_draft_gates_candidate_record_promote');
  assert.equal(plan.strategy.candidate_record_promotion_source, 'only_source_for_stable_promotion');
  assert.equal(plan.strategy.refresh_existing, 'emergency_repair_or_replace_existing_release_only');
  assert.equal(plan.strategy.post_release_user_guide_screenshots, 'after_promotion_not_pre_promotion_gate');
  assert.equal(plan.strategy.vm_policy, 'clone_clean_no_clt_base_for_release_gate');
  assert.equal(plan.full_payload_ref_audit.schema, 'opl_full_payload_ref_audit_plan.v1');
  assert.equal(plan.full_payload_ref_audit.record_path, 'dist/opl-full-release/full-package-manifest.json#resolved_refs');
  assert.equal(plan.full_payload_ref_audit.telemetry_path, 'dist/opl-full-release/full-workflow-telemetry.json#payload_refs');
  assert.equal(plan.full_payload_ref_audit.modes.stable.records_resolved_refs, true);
  assert.equal(plan.full_payload_ref_audit.modes.stable.pin_input_required, false);
  assert.equal(plan.full_payload_ref_audit.modes.draft_candidate.records_resolved_refs, true);
  assert.equal(plan.full_payload_ref_audit.modes.draft_candidate.pin_input_required, false);
  assert.deepEqual(Object.keys(plan.full_payload_ref_audit.payloads), [
    'opl_framework',
    'mas',
    'mag',
    'rca',
    'opl_meta_agent',
    'officecli',
    'mineru',
    'ui_ux_skill',
  ]);

  const releaseBoundary = laneById(plan, 'release_boundary');
  const standardBuild = laneById(plan, 'standard_build');
  const fullBuild = laneById(plan, 'full_build');
  const standardVm = laneById(plan, 'standard_dmg_clean_vm_smoke');
  const homebrewVm = laneById(plan, 'homebrew_standard_cask_clean_vm_smoke');
  const fullVm = laneById(plan, 'full_dmg_clean_vm_smoke');
  const publishStandard = laneById(plan, 'publish_standard');
  const publishFullAssets = laneById(plan, 'publish_full_assets');
  const remoteVerify = laneById(plan, 'remote_verify_standard_and_full');
  const dockerSmoke = laneById(plan, 'docker_webui_smoke');
  const webuiGhcrPublish = laneById(plan, 'webui_ghcr_publish');
  const oneShotInstaller = laneById(plan, 'one_shot_app_installer_smoke');
  const evidenceBundle = laneById(plan, 'release_evidence_bundle');
  const promote = laneById(plan, 'promote_stable_release');
  const stableHomebrewTap = laneById(plan, 'stable_homebrew_tap_update');
  const fullHomebrewTap = laneById(plan, 'full_homebrew_tap_update');
  const readinessSummary = laneById(plan, 'release_readiness_summary');
  const candidateRecord = laneById(plan, 'release_candidate_record');
  const promotionRecord = laneById(plan, 'release_promotion_record');
  const postReleaseScreenshots = laneById(plan, 'post_release_user_guide_screenshots');

  assert.deepEqual(laneById(plan, 'release_preflight').depends_on, []);
  assert.deepEqual(releaseBoundary.depends_on, ['release_preflight']);
  assert.deepEqual(standardBuild.depends_on, ['release_preflight']);
  assert.deepEqual(fullBuild.depends_on?.sort(), [
    'release_preflight',
    'full_runtime_keys',
    'standard_dmg_clean_vm_smoke',
  ].sort());
  assert.equal(standardBuild.can_run_with.includes('full_build'), false);
  assert.equal(fullBuild.can_run_with.includes('standard_build'), false);

  assert.deepEqual(publishStandard.depends_on?.sort(), [
    'active_shell_quick_validation',
    'release_boundary',
    'standard_build',
  ].sort());
  assert.ok(publishStandard.command.includes('release_mode=new_release'));
  assert.deepEqual(publishFullAssets.depends_on?.sort(), ['full_build', 'publish_standard'].sort());
  assert.deepEqual(remoteVerify.depends_on?.sort(), [
    'publish_full_assets',
    'standard_dmg_clean_vm_smoke',
  ].sort());
  assert.deepEqual(standardVm.depends_on, ['publish_standard']);
  assert.deepEqual(homebrewVm.depends_on?.sort(), ['full_homebrew_tap_update', 'stable_homebrew_tap_update'].sort());
  assert.deepEqual(fullVm.depends_on, ['remote_verify_standard_and_full']);
  assert.equal(standardVm.can_run_with.includes('full_build'), false);
  assert.equal(standardVm.can_run_with.includes('publish_full_assets'), false);
  assert.ok(homebrewVm.command.includes('--install-mode homebrew-cask'));
  assert.ok(homebrewVm.command.includes('--homebrew-cask gaofeng21cn/one-person-lab/one-person-lab'));
  assert.ok(homebrewVm.command.includes('--smoke-profile homebrew-standard-cask'));
  assert.deepEqual(fullVm.can_run_with, []);

  assert.deepEqual(oneShotInstaller.depends_on?.sort(), ['publish_standard', 'standard_dmg_clean_vm_smoke'].sort());
  assert.deepEqual(dockerSmoke.depends_on?.sort(), ['publish_standard', 'standard_dmg_clean_vm_smoke'].sort());
  assert.ok(oneShotInstaller.can_run_with.includes('docker_webui_smoke'));
  assert.ok(dockerSmoke.can_run_with.includes('one_shot_app_installer_smoke'));
  assert.deepEqual(webuiGhcrPublish.depends_on, ['docker_webui_smoke']);
  assert.ok(webuiGhcrPublish.command.includes('ghcr.io/<owner>/one-person-lab-webui'));
  assert.ok(webuiGhcrPublish.command.includes('stable'));
  assert.ok(webuiGhcrPublish.command.includes('stable'));
  assert.ok(webuiGhcrPublish.required_for.includes('stable_release'));

  assert.deepEqual(evidenceBundle.depends_on?.sort(), [
    'docker_webui_smoke',
    'full_dmg_clean_vm_smoke',
    'one_shot_app_installer_smoke',
    'remote_verify_standard_and_full',
    'standard_dmg_clean_vm_smoke',
    'webui_ghcr_publish',
  ].sort());
  assert.equal(readinessSummary.phase, 'release_gate');
  assert.deepEqual(readinessSummary.can_run_with, []);
  assert.ok(readinessSummary.depends_on?.includes('release_evidence_bundle'));
  assert.ok(readinessSummary.depends_on?.includes('remote_verify_standard_and_full'));
  assert.ok(readinessSummary.depends_on?.includes('standard_dmg_clean_vm_smoke'));
  assert.ok(readinessSummary.depends_on?.includes('full_dmg_clean_vm_smoke'));
  assert.ok(readinessSummary.depends_on?.includes('one_shot_app_installer_smoke'));
  assert.ok(readinessSummary.depends_on?.includes('docker_webui_smoke'));
  assert.ok(readinessSummary.depends_on?.includes('webui_ghcr_publish'));
  assert.ok(readinessSummary.command.includes('release-readiness-summary'));
  assert.ok(readinessSummary.required_for.includes('stable_release'));
  assert.deepEqual(candidateRecord.depends_on?.sort(), [
    'release_preflight',
    'release_readiness_summary',
    'remote_verify_standard_and_full',
  ].sort());
  assert.ok(candidateRecord.command.includes('release:candidate-record'));
  assert.equal(promote.phase, 'publish');
  assert.deepEqual(promote.depends_on, ['release_candidate_record']);
  assert.ok(promote.command.includes('desktop-release-promote.yml'));
  assert.ok(promote.command.includes('reads only release-candidate-record.json'));
  assert.ok(promote.command.includes('status=ready_to_promote'));
  assert.deepEqual(stableHomebrewTap.depends_on, ['promote_stable_release']);
  assert.ok(stableHomebrewTap.command.includes('homebrew-tap-update.yml'));
  assert.ok(stableHomebrewTap.command.includes('--package-kind app_standard'));
  assert.deepEqual(fullHomebrewTap.depends_on?.sort(), [
    'promote_stable_release',
    'stable_homebrew_tap_update',
  ].sort());
  assert.ok(fullHomebrewTap.command.includes('--package-kind app_full_first_install'));
  assert.deepEqual(promotionRecord.depends_on?.sort(), [
    'full_homebrew_tap_update',
    'homebrew_standard_cask_clean_vm_smoke',
    'promote_stable_release',
    'release_candidate_record',
    'stable_homebrew_tap_update',
  ].sort());
  assert.equal(postReleaseScreenshots.phase, 'post_release');
  assert.deepEqual(postReleaseScreenshots.depends_on, ['release_promotion_record']);
  assert.ok(postReleaseScreenshots.command.includes('after promotion'));
  assert.ok(postReleaseScreenshots.command.includes('never a pre-promotion gate'));
  assert.equal(plan.lanes.at(-1)?.id, 'post_release_user_guide_screenshots');
});

test('AI exploratory release policy is locked in the machine contract', () => {
  const contract = readRepoFile('contracts/app-release-channel.json');
  const policyPattern = /AI exploratory|AI-exploratory|ai[_ -]exploratory|exploratory AI|exploratory triage/i;
  const nonBlockingPattern = /non[- ]blocking|not a release gate|must not block|does not block/i;

  assertMatches(contract, policyPattern, 'release channel AI exploratory policy');
  assertMatches(contract.replaceAll('_', '-'), nonBlockingPattern, 'release channel AI exploratory gate policy');
});

test('release operator docs and contract freeze candidates, fail fast on source gates, and avoid gh watch waits', () => {
  const contract = JSON.parse(readRepoFile('contracts/app-release-channel.json'));
  const releaseDocs = readRepoFile('docs/delivery/release/README.md');
  const sourceGate = contract.release_preflight.source_gate;
  const candidateFreeze = contract.release_acceleration.cohort_prepare.stable_candidate_freeze;
  const blockerPolicy = contract.release_acceleration.release_operator.primary_blocker_policy;

  assert.deepEqual(candidateFreeze.pinned_sha_fields, ['app_sha', 'shell_sha', 'framework_sha']);
  assert.deepEqual(candidateFreeze.obsolete_candidate_statuses, ['obsolete_candidate', 'stale_candidate']);
  assert.equal(candidateFreeze.next_action, 'owner_receipt_then_promote_or_dispatch_new_cohort');
  assertMatches(candidateFreeze.currentness_rule, /post-freeze drift/, 'stable candidate post-freeze drift rule');
  assertMatches(candidateFreeze.currentness_rule, /same frozen cohort only needs owner receipt and promote/, 'stable candidate owner receipt fast path');

  assert.equal(sourceGate.package_script, 'release:source-gate');
  assert.deepEqual(sourceGate.scope, [
    'App release-boundary contract',
    'shell format',
    'shell type',
    'active shell node/dom tests',
    'shell ref resolution',
    'framework ref resolution',
  ]);
  assert.ok(sourceGate.must_run_before.includes('standard_macos_arm64_build'));
  assert.ok(sourceGate.must_run_before.includes('full_first_install_build'));
  assert.ok(sourceGate.must_run_before.includes('homebrew_standard_cask_clean_vm_smoke'));
  assert.ok(sourceGate.must_run_before.includes('webui_ghcr_publish'));
  assert.equal(sourceGate.failure_next_action, 'repair_source_gate');

  assert.equal(blockerPolicy.monitor_mode, 'no_watch');
  assert.deepEqual(blockerPolicy.failed_gate_states, ['failed_gate_draining', 'failed']);
  assert.deepEqual(blockerPolicy.terminal_blocker_states, [
    'failed_gate_draining',
    'failed',
    'stale_candidate',
    'cancelled',
    'superseded',
  ]);
  assert.deepEqual(blockerPolicy.failed_gate_next_actions, ['repair_source_gate', 'dispatch_new_cohort']);
  assert.equal(blockerPolicy.forbidden_wait_strategy, 'continue_waiting_on_gh_run_watch_after_primary_gate_failure');
  assert.ok(contract.release_acceleration.release_operator.typed_next_actions.includes('repair_webui_runtime_image'));
  assert.ok(contract.release_acceleration.release_operator.typed_next_actions.includes('repair_ghcr_publish_access'));
  assert.deepEqual(contract.release_acceleration.release_monitor.required_status_fields, [
    'phase',
    'state',
    'current_job',
    'current_step',
    'elapsed_seconds',
    'warning_after_seconds',
    'timeout_after_seconds',
    'primary_blocker',
    'recommended_next_action',
  ]);
  assert.equal(contract.release_acceleration.release_monitor.mode, 'no_watch');
  assert.equal(contract.release_acceleration.release_monitor.phase_budgets.vm_smoke.recommended_next_actions.timeout, 'rerun_diagnostic_same_artifact');
  assert.equal(contract.release_acceleration.release_monitor.phase_budgets.homebrew.recommended_next_actions.diagnostic, 'inspect_homebrew_tap_diagnostics');
  assert.equal(contract.release_acceleration.release_monitor.phase_budgets.webui_ghcr.recommended_next_actions.diagnostic, 'inspect_webui_runtime_image_diagnostics');
  assert.equal(
    contract.release_acceleration.release_monitor.failure_classification.webui_docker_runtime_image_failure.source_gate_failure,
    false,
  );
  assertMatches(
    contract.release_acceleration.release_monitor.authority_boundary,
    /Release-ready still requires same-cohort evidence, release candidate record, and owner receipt/,
    'release monitor authority boundary',
  );

  assertMatches(releaseDocs, /npm run release:source-gate -- --version <version>/, 'release docs source gate command');
  assertMatches(releaseDocs, /App SHA, shell SHA, and framework SHA/, 'release docs pinned cohort');
  assertMatches(releaseDocs, /post-freeze drift/, 'release docs post-freeze drift');
  assertMatches(releaseDocs, /owner receipt/, 'release docs owner receipt fast path');
  assertMatches(releaseDocs, /npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha>/, 'release docs operator status command');
  assertMatches(releaseDocs, /failed_gate_draining/, 'release docs failed gate draining state');
  assertMatches(releaseDocs, /instead of asking the release owner to keep waiting\s+on `gh run watch`/, 'release docs no-watch policy');
  assertMatches(releaseDocs, /Desktop stable, WebUI GHCR, and diagnostics are separate lanes/, 'release docs lane split');
});
