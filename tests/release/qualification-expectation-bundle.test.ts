import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildFirstRunCompiledExpectations,
  compileCurrentFirstRunExpectations,
  renderCompiledFirstRunExpectations,
  sha256Canonical,
} from '../../scripts/compile-first-run-expectations.ts';
import { appRoot } from './app-release-boundary-cases/helpers.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
const sources = () => ({
  gui: readJson('contracts/app-gui-product-contract.json'),
  matrix: readJson('contracts/app-first-run-test-matrix.json'),
  pageState: readJson('contracts/app-page-state-matrix.json'),
  productProfile: readJson('contracts/app-product-profile.json'),
  release: readJson('contracts/app-release-channel.json'),
});

test('compiled first-run expectations exactly match all App contract projections', () => {
  const compiled = compileCurrentFirstRunExpectations();
  const checkedIn = fs.readFileSync(
    path.join(appRoot, 'contracts/app-first-run-compiled-expectations.json'),
    'utf8',
  );
  assert.equal(checkedIn, renderCompiledFirstRunExpectations(compiled));
  assert.match(compiled.profiles.standard.semantic_digest, /^[0-9a-f]{64}$/);
  assert.match(compiled.profiles.standard.probe_digest, /^[0-9a-f]{64}$/);
  assert.notEqual(compiled.profiles.standard.semantic_digest, compiled.profiles.standard.probe_digest);
  assert.equal(compiled.profiles.full.semantics.artifact_kind, 'full');
  assert.deepEqual(compiled.profiles.standard.semantics.assistant_targets, [
    {
      assistant_id: 'mas', shortcut_id: 'research', package_id: 'mas',
      codex_visible_entry: 'med-autoscience', required_skill_ids: ['med-autoscience'], badge: '@科研',
    },
    {
      assistant_id: 'mag', shortcut_id: 'grant', package_id: 'mag',
      codex_visible_entry: 'med-autogrant', required_skill_ids: ['med-autogrant'], badge: '@基金',
    },
    {
      assistant_id: 'rca', shortcut_id: 'ppt', package_id: 'rca',
      codex_visible_entry: 'redcube-ai', required_skill_ids: ['redcube-ai'], badge: '@演示',
    },
  ]);
  assert.ok(compiled.profiles.standard.semantics.assistant_targets.every(
    (target) => target.package_id !== target.codex_visible_entry && target.required_skill_ids.includes(target.codex_visible_entry),
  ));
});

test('compiler rejects the retired disabled-before-selection Standard expectation', () => {
  const input = sources();
  const standard = input.matrix.scenarios.find((scenario) => scenario.id === 'standard_dmg_clean_vm_smoke');
  standard.expects[standard.expects.length - 1] = 'Visible but disabled before selection.';
  assert.throws(() => buildFirstRunCompiledExpectations(input), /disabled Home shortcuts/);
});

test('compiler rejects scenario profile refs that do not match package and runtime profile', () => {
  const input = sources();
  const full = input.matrix.scenarios.find((scenario) => scenario.id === 'full_dmg_clean_vm_smoke');
  full.compiled_expectation_ref = 'contracts/app-first-run-compiled-expectations.json#profiles.standard';
  assert.throws(() => buildFirstRunCompiledExpectations(input), /compiled Full expectation profile/);
});

test('compiler rejects GUI, product-profile, page-state, and release policy drift', () => {
  for (const mutate of [
    (input) => { input.gui.agent_package_activation_policy.home_shortcut_interaction.configured_shortcut_selectable_before_selection = false; },
    (input) => { input.productProfile.gui.home.home_layout.shortcut_selection_policy = 'disabled'; },
    (input) => { input.pageState.pages.find((page) => page.id === 'guid_home').home_view_model.home_layout.shortcut_selection_policy = 'disabled'; },
    (input) => { input.release.release_acceleration.assistant_route_smoke_policy.standard.required = []; },
  ]) {
    const input = sources();
    mutate(input);
    assert.throws(() => buildFirstRunCompiledExpectations(input), /qualification SSOT|qualification expectation SSOT/);
  }
});

test('semantic and probe digests are independently content-addressed', () => {
  const semantic = { selectable: true, send_allowed: false };
  const probe = { input_selector: '[data-testid="guid-input"]' };
  assert.notEqual(sha256Canonical(semantic), sha256Canonical(probe));
  assert.notEqual(sha256Canonical(semantic), sha256Canonical({ ...semantic, send_allowed: true }));
  assert.notEqual(sha256Canonical(probe), sha256Canonical({ ...probe, timeout_ms: 30_000 }));
});
