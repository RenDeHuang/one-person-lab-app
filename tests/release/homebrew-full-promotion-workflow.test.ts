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
  assert.match(source, /\.source\.completed_stage == "full_qualified"/);
  assert.doesNotMatch(source, /workflow_dispatch:|OPL_HOMEBREW_TAP_TOKEN|git\b[^\n]*\bpush\b/);
});

test('Full Homebrew reusable renders, qualifies, publishes, and reads back in order', () => {
  const source = read('_release-homebrew-full-publish.yml');
  const workflow = parse('_release-homebrew-full-publish.yml');
  assert.deepEqual(Object.keys(workflow.on), ['workflow_call']);
  assert.deepEqual(Object.keys(workflow.jobs), [
    'startup-canary',
    'prepare-candidate',
    'qualify-candidate',
    'publish-cask',
    'readback',
  ]);
  assert.deepEqual(workflow.jobs['publish-cask'].needs, ['prepare-candidate', 'qualify-candidate']);
  assert.equal(workflow.jobs['publish-cask'].environment, 'release-stable');
  assert.equal(workflow.jobs['qualify-candidate'].uses, './.github/workflows/opl-first-run-vm.yml');
  assert.equal(workflow.jobs['qualify-candidate'].with.package_profile, 'homebrew-full');
  assert.match(source, /homebrew_candidate_artifact/);
  assert.match(source, /Restore exact qualified Full checkpoint/);
  assert.match(source, /completed_stage \}\}' = full_qualified/);
  assert.match(source, /a1561bdf1dfe6f316dad22f16152a537ddfb69d5/);
  assert.match(source, /merge-base --is-ancestor "\$embedded_base_floor" "\$shell_sha"/);
  assert.match(source, /git -C tap-source push --no-force origin HEAD:refs\/heads\/main/);
  assert.equal((source.match(/git -C tap-source push --no-force/g) ?? []).length, 1);
  assert.match(source, /no second push is allowed/);
  assert.match(source, /formula_opl_installed_before == false/);
  assert.match(source, /formula_opl_installed_after == false/);
  assert.doesNotMatch(source, /\.formula_opl_installed == false/);
  assert.match(source, /active_framework_count == 1/);
  assert.match(source, /official_profile\.status == "passed"/);
  assert.doesNotMatch(source, /depends_on formula: "opl"|github-activate-latest|make_latest/);
});

test('VM harness routes Full Homebrew to candidate-only smoke without Framework injection', () => {
  const source = read('opl-first-run-vm.yml');
  assert.match(source, /homebrew_candidate_artifact/);
  assert.match(source, /package_profile=homebrew-full requires an exact pre-publication Cask artifact/);
  assert.match(source, /--smoke-profile homebrew-full-cask/);
  assert.match(source, /--homebrew-cask-file/);
  assert.match(source, /oplProductProfile\/oplProductProfile\.generated\.json/);
  assert.match(source, /inputs\.package_profile != 'homebrew-full'/);
});
