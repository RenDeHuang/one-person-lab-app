import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

const workflowRoot = path.join(process.cwd(), '.github', 'workflows');
const read = (name: string) => fs.readFileSync(path.join(workflowRoot, name), 'utf8');
const parse = (name: string) => parseYaml(read(name)) as Record<string, any>;

test('append_full exports exact qualification-bound handoff without mutating Homebrew', () => {
  const source = read('_release-full-addon.yml');
  for (const required of [
    'opl_homebrew_full_follower_handoff.v1',
    'operation_control',
    'operation_id',
    'operation_started_at',
    'operation_deadline_at',
    'checkpoint_transport_executor',
    'transport_run_id',
    'completed_stage:"full_qualified"',
    'qualification_receipt_sha256',
    'homebrew_modified:false',
    'latest_modified:false',
    'homebrew-full-handoff.json',
  ]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(source, /OPL_HOMEBREW_TAP_TOKEN|update-homebrew-tap|git\b[^\n]*\bpush\b/);
});

test('Full Homebrew follower has no manual or direct mutation entry', () => {
  const source = read('release-homebrew-full-follower.yml');
  const workflow = parse('release-homebrew-full-follower.yml');
  assert.deepEqual(Object.keys(workflow.on), ['workflow_run']);
  assert.deepEqual(workflow.on.workflow_run.workflows, ['OPL Stable Release Bundle']);
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['resolve-handoff', 'publish-homebrew-full']);
  assert.equal(workflow.jobs['publish-homebrew-full'].uses, './.github/workflows/_release-homebrew-full-publish.yml');
  assert.match(source, /homebrew-full-handoff\.json/);
  assert.match(source, /\.operation_control\.operation_id/);
  assert.match(source, /\.operation_control\.operation_deadline_at/);
  assert.match(source, /\.source\.completed_stage == "full_qualified"/);
  assert.match(source, /\.source\.checkpoint_transport_executor == "github_actions"/);
  assert.match(source, /\.source\.transport_run_id/);
  assert.doesNotMatch(source, /workflow_dispatch:|OPL_HOMEBREW_TAP_TOKEN|git\b[^\n]*\bpush\b/);
});

test('Full Homebrew reusable publishes hosted-qualified bytes before optional physical certification', () => {
  const source = read('_release-homebrew-full-publish.yml');
  const workflow = parse('_release-homebrew-full-publish.yml');
  assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
  assert.deepEqual(Object.keys(workflow.jobs), [
    'startup-canary',
    'prepare-candidate',
    'publish-cask',
    'readback',
  ]);
  assert.deepEqual(workflow.jobs['publish-cask'].needs, ['prepare-candidate']);
  assert.equal(workflow.jobs['publish-cask'].environment, 'release-stable');
  assert.match(source, /Restore exact qualified Full checkpoint/);
  assert.match(source, /completed_stage \}\}' = full_qualified/);
  assert.match(source, /Restore qualified Full publication checkpoint/);
  assert.match(source, /append_full_operation_id/);
  assert.match(source, /append_full_operation_deadline_at/);
  assert.match(source, /publication-scope track_assets/);
  assert.match(source, /homebrew:gaofeng21cn\/homebrew-one-person-lab\/Casks\/one-person-lab-full\.rb\/\$\{expected_cask_sha\}/);
  assert.match(source, /publication-scope external_target/);
  assert.match(source, /release-operation-deadline\.ts check/);
  assert.match(source, /release publish/);
  assert.match(source, /write_framework_homebrew_receipt unknown/);
  assert.match(source, /active_unknown_markers/);
  assert.match(source, /test "\$\(jq -r \.operation_id <<<"\$marker"\)" = "\$operation_id"/);
  assert.match(source, /prior_mutation_attempt_id/);
  assert.match(source, /release reconcile/);
  assert.match(source, /no second push was attempted/);
  assert.match(source, /homebrew-full-unknown-checkpoint/);
  assert.match(source, /standard-build-receipt\.json/);
  assert.match(source, /full-build-receipt\.json/);
  assert.match(source, /a1561bdf1dfe6f316dad22f16152a537ddfb69d5/);
  assert.match(source, /merge-base --is-ancestor "\$embedded_base_floor" "\$shell_sha"/);
  assert.match(source, /git -C tap-source push --no-force origin "\$result_commit:refs\/heads\/main"/);
  assert.equal((source.match(/git -C tap-source push --no-force/g) ?? []).length, 1);
  assert.match(source, /git -C tap-source ls-remote origin refs\/heads\/main/);
  assert.match(source, /git -C tap-source fetch --no-tags --depth=1 origin "\$remote_commit"/);
  assert.match(source, /git -C tap-source rev-parse FETCH_HEAD/);
  assert.match(source, /git -C tap-source show 'FETCH_HEAD:Casks\/one-person-lab-full\.rb'/);
  assert.doesNotMatch(source, /contents\/Casks\/one-person-lab-full\.rb\?ref=main/);
  assert.match(source, /no second push was attempted/);
  assert.doesNotMatch(
    source,
    /qualify-candidate|opl-first-run-vm\.yml|tart-smoke-summary\.json|smoke_harness_sha|shell-harness|opl-first-run-tart-smoke|--homebrew-cask-file|clean_vm_receipt_sha256|formula_opl_installed_before|official_profile_first_install/,
  );
  assert.match(source, /qualification_receipt_sha256:\$qualification_sha/);
  assert.match(source, /cohort:\{app_sha:\$app_sha,shell_sha:\$shell_sha,framework_sha:\$framework_sha\}/);
  assert.doesNotMatch(source, /depends_on formula: "opl"|github-activate-latest|make_latest/);
});

test('append_full resume recognizes only exact GitHub Full or Full Cask unknown targets', () => {
  const source = read('_release-full-addon.yml');
  assert.match(source, /case "\$target" in/);
  assert.match(source, /github-release:\*\)/);
  assert.match(source, /homebrew:\*\)/);
  assert.match(source, /Casks\/one-person-lab-full\.rb\/\$\{expected_cask_sha\}/);
  assert.match(source, /test "\$publication_scope" = external_target/);
  assert.match(source, /Unsupported append_full portable unknown target/);
  assert.match(source, /publication-scope "\$publication_scope"/);
  assert.match(source, /test "\$\(jq -r \.operation_id <<<"\$marker"\)" = "\$operation_id"/);
  assert.match(source, /git -C full-resume-tap fetch --no-tags --depth=1 origin "\$remote_commit"/);
  assert.match(source, /git -C full-resume-tap show 'FETCH_HEAD:Casks\/one-person-lab-full\.rb'/);
  assert.doesNotMatch(source, /contents\/Casks\/one-person-lab-full\.rb\?ref=main/);
  assert.doesNotMatch(source, /git\b[^\n]*\bpush\b/);
});

test('VM harness retains an isolated Full Homebrew probe outside the publication DAG', () => {
  const source = read('opl-first-run-vm.yml');
  assert.match(source, /homebrew_candidate_artifact/);
  assert.match(source, /package_profile=homebrew-full requires an exact pre-publication Cask artifact/);
  assert.match(source, /--smoke-profile homebrew-full-cask/);
  assert.match(source, /--homebrew-cask-file/);
  assert.match(source, /oplProductProfile\/oplProductProfile\.generated\.json/);
  assert.match(source, /inputs\.package_profile != 'homebrew-full'/);
});
