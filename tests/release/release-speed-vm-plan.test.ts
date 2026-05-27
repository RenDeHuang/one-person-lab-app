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

function assertIncludes(source: string, expected: string, label: string) {
  assert.ok(source.includes(expected), `${label} must include ${expected}`);
}

function assertMatches(source: string, pattern: RegExp, label: string) {
  assert.match(source, pattern, `${label} must match ${pattern}`);
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

  assertMatches(workflow, /concurrency:[\s\S]*group:\s+opl-desktop-release-\$\{\{ inputs\.release_mode == 'draft_candidate' && 'draft' \|\| 'stable' \}\}-\$\{\{ inputs\.opl_version \}\}/, 'desktop release concurrency group');
  assertMatches(workflow, /cancel-in-progress:\s+\$\{\{ inputs\.release_mode == 'draft_candidate' \}\}/, 'desktop release draft cancellation policy');
  assertIncludes(workflow, 'standard-build:', 'desktop release workflow');
  assertIncludes(workflow, 'uses: ./.github/workflows/_build-reusable.yml', 'standard build job');
  assertMatches(workflow, /publish-standard:[\s\S]*?needs:\s+standard-build/, 'publish-standard job');
  assertMatches(workflow, /full-first-install:[\s\S]*?uses:\s+\.\/\.github\/workflows\/full-first-install-release\.yml/, 'Full package build job');
  assertMatches(workflow, /full-first-install:[\s\S]*?publish_to_release:\s+false/, 'Full package build-only job');
  assertMatches(workflow, /publish-full-assets:[\s\S]*?needs:[\s\S]*?publish-standard[\s\S]*?full-first-install/, 'Full package publish job');
  assertMatches(workflow, /remote-verify-standard:[\s\S]*?needs:\s+publish-standard/, 'standard remote verification job');
  assertMatches(workflow, /remote-verify-full:[\s\S]*?needs:\s+publish-full-assets/, 'Full remote verification job');
  assertMatches(
    workflow,
    /standard-first-run-vm-smoke-after-standard-only:[\s\S]*?needs:\s+remote-verify-standard/,
    'standard-only VM smoke job',
  );
  assertMatches(
    workflow,
    /standard-first-run-vm-smoke-after-full:[\s\S]*?needs:\s+publish-standard/,
    'standard VM smoke after Full job',
  );
  assertMatches(workflow, /full-first-run-vm-smoke:[\s\S]*?needs:\s+remote-verify-full/, 'Full VM smoke job');
  assertMatches(workflow, /one-shot-app-installer-smoke:[\s\S]*?needs:\s+publish-standard/, 'one-shot installer smoke');
  assertMatches(workflow, /docker-webui-smoke:[\s\S]*?needs:\s+publish-standard/, 'Docker WebUI smoke');
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

  assertMatches(workflow, /ACTIONLINT_VERSION:\s+'v\d+\.\d+\.\d+'/, 'pinned actionlint version');
  assertMatches(workflow, /go install "github\.com\/rhysd\/actionlint\/cmd\/actionlint@\$\{ACTIONLINT_VERSION\}"/, 'actionlint install');
  assertMatches(workflow, /actionlint -color -shellcheck "" -pyflakes ""/, 'actionlint semantic gate');
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
  ]) {
    assertIncludes(buildNeeds, dependency, `build job needs`);
  }
});

test('Full first-install workflow caches npm, uv, Go, and Bun work and writes an operator summary', () => {
  const workflow = readRepoFile('.github/workflows/full-first-install-release.yml');

  assertMatches(workflow, /concurrency:[\s\S]*group:\s+opl-full-first-install-\$\{\{ inputs\.opl_version \}\}/, 'Full workflow concurrency group');
  assertMatches(workflow, /cancel-in-progress:\s+false/, 'Full workflow stable cancellation policy');
  assertMatches(workflow, /Setup Node\.js[\s\S]*cache:\s+npm/, 'Full workflow npm cache');
  assertMatches(workflow, /Setup Go[\s\S]*cache:\s+true/, 'Full workflow Go cache');
  assertMatches(workflow, /uv cache dir|~\/\.cache\/uv|\$\{\{\s*runner\.temp\s*\}\}\/uv-cache/, 'Full workflow uv cache');
  assertMatches(workflow, /~\/\.bun\/install\/cache|\$\{\{\s*runner\.temp\s*\}\}\/\.bun/, 'Full workflow Bun cache');
  assertMatches(workflow, /\$GITHUB_STEP_SUMMARY/, 'Full workflow summary');
  assertMatches(workflow, /Full first-install|runtime layer cache|Full runtime/, 'Full workflow summary content');
  assert.equal(
    (workflow.match(/name:\s+Summarize Full package size/g) ?? []).length,
    1,
    'Full workflow should summarize package size once',
  );
  assertMatches(workflow, /schema:\s+'opl_full_workflow_telemetry\.v1'|schema:\s+"opl_full_workflow_telemetry\.v1"/, 'Full telemetry schema');
  assertMatches(workflow, /full-workflow-telemetry\.json/, 'Full telemetry JSON path');
  assertMatches(workflow, /Upload Full workflow telemetry[\s\S]*actions\/upload-artifact@v4/, 'Full telemetry artifact upload');
  assertMatches(workflow, /cache:[\s\S]*full_runtime_layers/, 'Full telemetry cache fields');
  assertMatches(workflow, /duration_seconds:[\s\S]*full_package_build/, 'Full telemetry duration fields');
});

test('release operations workflows serialize refreshable GitHub Actions runs without cancelling stable release runs', () => {
  const docs = readRepoFile('docs/release/README.md');
  const legacyWorkflow = readRepoFile('.github/workflows/build-and-release.yml');
  const warmupWorkflow = readRepoFile('.github/workflows/full-runtime-cache-warmup.yml');
  const promoteWorkflow = readRepoFile('.github/workflows/desktop-release-promote.yml');
  const verifyWorkflow = readRepoFile('.github/workflows/release-verify-remote.yml');

  assertMatches(legacyWorkflow, /concurrency:[\s\S]*group:\s+opl-build-and-release-\$\{\{ github\.ref \}\}/, 'legacy build concurrency group');
  assertMatches(legacyWorkflow, /cancel-in-progress:\s+\$\{\{ github\.ref == 'refs\/heads\/dev' \}\}/, 'legacy dev cancellation policy');
  assertMatches(warmupWorkflow, /concurrency:[\s\S]*group:\s+opl-full-runtime-cache-warmup-/, 'Full warmup concurrency group');
  assertMatches(warmupWorkflow, /cancel-in-progress:\s+true/, 'Full warmup cancellation policy');
  assertMatches(promoteWorkflow, /concurrency:[\s\S]*group:\s+opl-desktop-release-promote-\$\{\{ inputs\.opl_version \}\}/, 'promote concurrency group');
  assertMatches(promoteWorkflow, /cancel-in-progress:\s+true/, 'promote cancellation policy');
  assertMatches(verifyWorkflow, /concurrency:[\s\S]*group:\s+opl-remote-release-verification-\$\{\{ inputs\.opl_version \}\}/, 'remote verify concurrency group');
  assertMatches(verifyWorkflow, /cancel-in-progress:\s+true/, 'remote verify cancellation policy');
  assertMatches(docs, /Stable desktop release runs[\s\S]*do not cancel running jobs/, 'stable release concurrency docs');
  assertMatches(docs, /Draft candidates[\s\S]*cancel older in-progress runs/, 'refreshable release concurrency docs');
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
  assertMatches(workflow, /actions\/download-artifact@v7/, 'VM same-run artifact download');
  assertMatches(workflow, /Using same-run workflow artifact/, 'VM artifact source log');
  assertMatches(workflow, /release tag \$\{\{ inputs\.release_tag \}\} kept for provenance/, 'VM release tag provenance');
  assertMatches(workflow, /Runner labels/, 'VM runner labels');
  assertMatches(workflow, /Source VM/, 'VM source summary');
  assertMatches(workflow, /Smoke profile: \\?`no-clt-clean-vm\\?`/, 'VM smoke profile summary');
  assertMatches(workflow, /Display: \\?`1920x1080px\\?`/, 'VM display summary');
  assertMatches(workflow, /Settings smoke: enabled/, 'VM settings smoke summary');
  assertMatches(workflow, /tart-smoke-summary\.json/, 'VM final smoke summary artifact');
});

test('Docker WebUI smoke records image size as a release-speed artifact', () => {
  const workflow = readRepoFile('.github/workflows/desktop-release.yml');

  assertMatches(workflow, /docker image inspect|docker images|docker image ls/, 'Docker image size measurement');
  assertMatches(workflow, /image[-_]size|size_bytes|Size/, 'Docker image size field');
  assertMatches(workflow, /\/tmp\/opl-webui-image-size[-\w]*\.(json|txt)|artifacts\/docker-webui-image-size/, 'Docker image size artifact path');
  assertMatches(workflow, /Upload Docker WebUI smoke artifacts[\s\S]*opl-webui-image-size/, 'Docker image size upload');
});

test('release CI operations docs separate implemented release gates from follow-up workflow hygiene', () => {
  const testingDocs = readRepoFile('docs/testing/README.md');
  const scriptsDocs = readRepoFile('scripts/README.md');
  const combinedDocs = `${testingDocs}\n${scriptsDocs}`;

  assertMatches(combinedDocs, /actionlint[\s\S]*workflow semantic gate/i, 'actionlint policy');
  assertMatches(combinedDocs, /actionlint[\s\S]*(shellcheck|ShellCheck)[\s\S]*(disabled|separate|style debt)/i, 'actionlint shellcheck boundary');
  assertMatches(combinedDocs, /YAML parsing[\s\S]*syntax/i, 'YAML parse boundary');
  assertMatches(combinedDocs, /concurrency[\s\S]*duplicate-run governance/i, 'concurrency policy');
  assertMatches(combinedDocs, /not release evidence|not as proof/i, 'concurrency non-evidence boundary');
  assertMatches(combinedDocs, /Machine-readable telemetry[\s\S]*JSON artifact/i, 'machine-readable telemetry artifact');
  assertMatches(combinedDocs, /post-release tuning|after-release tuning/i, 'telemetry tuning role');
  assertMatches(combinedDocs, /does not replace[\s\S]*(manifest|manifests)[\s\S]*SHA256SUMS[\s\S]*remote verification[\s\S]*VM/i, 'telemetry non-truth boundary');
  assertMatches(combinedDocs, /Composite\/setup[\s\S]*checked-in composite action|Composite\/setup[\s\S]*checked in/i, 'composite setup implementation policy');
  assertMatches(combinedDocs, /\.github\/actions\/setup-active-shell-deps/i, 'composite active shell setup action');
});

test('release plan exposes depends_on and can_run_with for parallel speed lanes and serialized gates', () => {
  const plan = runReleasePlan(['--version', '26.5.27', '--include-full-package']);

  assert.equal(plan.profile, 'stable');
  assert.equal(plan.strategy.vm_policy, 'clone_clean_no_clt_base_for_release_gate');

  const releaseBoundary = laneById(plan, 'release_boundary');
  const standardBuild = laneById(plan, 'standard_build');
  const fullBuild = laneById(plan, 'full_build');
  const standardVm = laneById(plan, 'standard_dmg_clean_vm_smoke');
  const fullVm = laneById(plan, 'full_dmg_clean_vm_smoke');
  const publishStandard = laneById(plan, 'publish_standard');
  const publishFullAssets = laneById(plan, 'publish_full_assets');
  const remoteVerify = laneById(plan, 'remote_verify_standard_and_full');
  const dockerSmoke = laneById(plan, 'docker_webui_smoke');
  const oneShotInstaller = laneById(plan, 'one_shot_app_installer_smoke');
  const evidenceBundle = laneById(plan, 'release_evidence_bundle');
  const publish = laneById(plan, 'publish_new_tag');

  assert.deepEqual(releaseBoundary.depends_on, []);
  assert.deepEqual(standardBuild.depends_on, []);
  assert.deepEqual(fullBuild.depends_on, ['full_runtime_keys']);
  assert.ok(standardBuild.can_run_with.includes('full_build'));
  assert.ok(fullBuild.can_run_with.includes('standard_build'));

  assert.deepEqual(publishStandard.depends_on?.sort(), [
    'active_shell_quick_validation',
    'release_boundary',
    'standard_build',
  ].sort());
  assert.deepEqual(publishFullAssets.depends_on?.sort(), ['full_build', 'publish_standard'].sort());
  assert.deepEqual(remoteVerify.depends_on, ['publish_full_assets']);
  assert.deepEqual(standardVm.depends_on, ['publish_standard']);
  assert.deepEqual(fullVm.depends_on, ['remote_verify_standard_and_full']);
  assert.ok(standardVm.can_run_with.includes('full_build'));
  assert.ok(standardVm.can_run_with.includes('publish_full_assets'));
  assert.deepEqual(fullVm.can_run_with, []);

  assert.deepEqual(oneShotInstaller.depends_on, ['publish_standard']);
  assert.deepEqual(dockerSmoke.depends_on, ['publish_standard']);
  assert.ok(oneShotInstaller.can_run_with.includes('docker_webui_smoke'));
  assert.ok(dockerSmoke.can_run_with.includes('one_shot_app_installer_smoke'));

  assert.deepEqual(evidenceBundle.depends_on?.sort(), [
    'docker_webui_smoke',
    'full_dmg_clean_vm_smoke',
    'one_shot_app_installer_smoke',
    'remote_verify_standard_and_full',
    'standard_dmg_clean_vm_smoke',
  ].sort());
  assert.ok(publish.depends_on.includes('release_evidence_bundle'));
  assert.ok(publish.depends_on.includes('publish_standard'));
  assert.ok(publish.depends_on.includes('publish_full_assets'));
});

test('AI exploratory release policy is locked in both machine contract and release docs', () => {
  const contract = readRepoFile('contracts/app-release-channel.json');
  const docs = readRepoFile('docs/release/README.md');
  const policyPattern = /AI exploratory|AI-exploratory|ai[_ -]exploratory|exploratory AI|exploratory triage/i;
  const nonBlockingPattern = /non[- ]blocking|not a release gate|must not block|does not block/i;

  assertMatches(contract, policyPattern, 'release channel AI exploratory policy');
  assertMatches(contract.replaceAll('_', '-'), nonBlockingPattern, 'release channel AI exploratory gate policy');
  assertMatches(docs, policyPattern, 'release docs AI exploratory policy');
  assertMatches(docs, nonBlockingPattern, 'release docs AI exploratory gate policy');
});
