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
import { canonicalAssistantTargets } from './app-release-boundary-cases/helpers-core.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
const sources = () => ({
  gui: readJson('contracts/app-gui-product-contract.json'),
  matrix: readJson('contracts/app-first-run-test-matrix.json'),
  pageState: readJson('contracts/app-page-state-matrix.json'),
  productProfile: readJson('contracts/app-product-profile.json'),
  release: readJson('contracts/app-release-channel.json'),
});

const expectedAssistantTargets = [
  {
    assistant_id: 'mas', shortcut_id: 'research', package_id: 'mas',
    codex_visible_entry: 'med-autoscience', required_skill_ids: ['med-autoscience'], badge: '@科研',
  },
  {
    assistant_id: 'mag', shortcut_id: 'open_grant_user_loop', package_id: 'mag',
    codex_visible_entry: 'med-autogrant', required_skill_ids: ['med-autogrant'], badge: '@基金',
  },
  {
    assistant_id: 'rca', shortcut_id: 'invoke_product_entry', package_id: 'rca',
    codex_visible_entry: 'redcube-ai', required_skill_ids: ['redcube-ai'], badge: '@演示',
  },
];

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
  assert.equal(compiled.profiles.standard.semantics.target_fixture_role, 'release_qualification_probe_input_only');
  assert.deepEqual(compiled.profiles.standard.semantics.target_projection, {
    membership_source_ref: 'app_state.agent_packages.directory.entries',
    opl_standard_agent_membership_policy: {
      ownership_source_fields: ['official', 'publisher'],
      ownership_match_policy:
        'official_equals_true_or_publisher_equals_one-person-lab',
      required_package_role: 'standard_agent',
      required_readiness: 'selectable',
      required_codex_route: {
        source: 'home_shortcuts[].route',
        route_kind: 'agent_package_shortcut',
        executor: 'codex_cli',
        codex_visible_entry: 'non_empty',
      },
      generic_skills_plugins_connections_group_policy:
        'separate_never_in_opl_standard_agent_group',
      package_id_allowlist_allowed: false,
    },
    shortcut_source_ref: 'app_state.agent_packages.directory.entries[].home_shortcuts[]',
    preference_source_ref: 'app_state.agent_packages.status_index.home_shortcut_preferences[]',
    runtime_catalog_authority: false,
    unknown_standard_agent_allowed: false,
    unknown_first_party_opl_standard_agent_allowed: true,
  });
  assert.deepEqual(compiled.profiles.standard.semantics.assistant_targets, expectedAssistantTargets);
  assert.deepEqual(compiled.profiles.full.semantics.assistant_targets, expectedAssistantTargets);
  assert.deepEqual(Object.values(canonicalAssistantTargets), expectedAssistantTargets);
  assert.ok(compiled.profiles.standard.semantics.assistant_targets.every(
    (target) => target.package_id !== target.codex_visible_entry && target.required_skill_ids.includes(target.codex_visible_entry),
  ));
});

test('corrected MAG probe selects the dynamic shortcut instead of visible identity collisions', () => {
  const syntheticHome = new Map([
    ['home-starter-open_grant_user_loop', { visible: true }],
    ['home-starter-mag', { visible: true }],
    ['home-starter-grant', { visible: false }],
  ]);
  const firstVisibleControl = (assistantId: string, shortcutId: string) => [
    `home-starter-${shortcutId}`,
    `preset-pill-${assistantId}`,
    `home-starter-${assistantId}`,
    `preset-pill-${shortcutId}`,
  ].find((testId) => syntheticHome.get(testId)?.visible);

  assert.equal(firstVisibleControl('mag', 'open_grant_user_loop'), 'home-starter-open_grant_user_loop');
  assert.equal(firstVisibleControl('mag', 'grant'), 'home-starter-mag');
  assert.equal(syntheticHome.has('home-starter-grant'), true);
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

test('compiler keeps Full clean-VM qualification optional after publication', () => {
  const input = sources();
  const full = input.matrix.scenarios.find((scenario) => scenario.id === 'full_dmg_clean_vm_smoke');
  assert.equal(full.release_gate, false);
  assert.equal(full.post_publication_optional_certification, true);
  assert.deepEqual(input.matrix.provider_configuration_qualification.required_release_scenarios, []);
});

test('compiler rejects GUI, product-profile, page-state, and release policy drift', () => {
  for (const mutate of [
    (input) => { input.gui.home_agent_shortcuts_metadata_policy.package_id_allowlist_allowed = true; },
    (input) => { input.productProfile.gui.home.home_agent_shortcuts_metadata_policy.package_id_allowlist_allowed = true; },
    (input) => {
      input.pageState.pages
        .find((page) => page.id === 'guid_home')
        .home_view_model.home_agent_shortcuts_metadata_policy.package_id_allowlist_allowed = true;
    },
    (input) => { input.productProfile.gui.home.home_layout.shortcut_selection_policy = 'disabled'; },
    (input) => { input.pageState.pages.find((page) => page.id === 'guid_home').home_view_model.home_layout.shortcut_selection_policy = 'disabled'; },
    (input) => { input.release.release_acceleration.assistant_route_smoke_policy.standard.required = []; },
  ]) {
    const input = sources();
    mutate(input);
    assert.throws(() => buildFirstRunCompiledExpectations(input), /qualification SSOT|qualification expectation SSOT/);
  }
});

test('compiler rejects release target fixtures that gain runtime authority or malformed identities', () => {
  const authoritative = sources();
  authoritative.matrix.release_qualification_agent_target_fixture.runtime_authority = true;
  assert.throws(
    () => buildFirstRunCompiledExpectations(authoritative),
    /target fixture boundary/,
  );

  const malformed = sources();
  malformed.matrix.release_qualification_agent_target_fixture.targets[0].package_id = '';
  assert.throws(
    () => buildFirstRunCompiledExpectations(malformed),
    /incomplete target mapping/,
  );

  const duplicate = sources();
  duplicate.matrix.release_qualification_agent_target_fixture.targets[1].package_id =
    duplicate.matrix.release_qualification_agent_target_fixture.targets[0].package_id;
  assert.throws(
    () => buildFirstRunCompiledExpectations(duplicate),
    /duplicate package_id/,
  );
});

test('semantic and probe digests are independently content-addressed', () => {
  const semantic = { selectable: true, send_allowed: false };
  const probe = { input_selector: '[data-testid="guid-input"]' };
  assert.notEqual(sha256Canonical(semantic), sha256Canonical(probe));
  assert.notEqual(sha256Canonical(semantic), sha256Canonical({ ...semantic, send_allowed: true }));
  assert.notEqual(sha256Canonical(probe), sha256Canonical({ ...probe, timeout_ms: 30_000 }));
});
