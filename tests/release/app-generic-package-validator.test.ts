import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { readAppProductProfile } from '../../scripts/app-product-profile/profile-contract.ts';
import { validatePackageAppContributionsProductContract } from '../../scripts/validate-active-shell/gui-framework-surfaces-validator.ts';
import { validateGuiProductHomeContract } from '../../scripts/validate-active-shell/gui-product-home-validator.ts';
import { validateProductProfile } from '../../scripts/validate-active-shell/product-profile-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

const unknownAgentFixture = readJson('contracts/fixtures/opl-app-state-unknown-agent.fixture.json');
const syntheticDirectoryEntry = unknownAgentFixture.app_state.agent_packages.directory.entries[0];
const syntheticStatusProjection =
  unknownAgentFixture.app_state.agent_packages.status_index.packages[syntheticDirectoryEntry.package_id];
const syntheticHomeShortcutPreference =
  unknownAgentFixture.app_state.agent_packages.status_index.home_shortcut_preferences[0];

test('App-owned Agent, Skill, and generated session authorities stay absent and cannot be restored', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const guiContract = readJson('contracts/app-gui-product-contract.json');
  const productProfile = readJson('contracts/app-product-profile.json');
  const pageState = readJson('contracts/app-page-state-matrix.json');
  const homeViewModel = pageState.pages.find((page: any) => page.id === 'guid_home').home_view_model;

  assert.equal('sync_and_install_contract' in installExposure, false);
  assert.equal('transaction_internal_states' in installExposure.software_lifecycle, false);
  assert.equal(installExposure.capability_governance.lifecycle_authority, 'configured_carrier');
  assert.equal(installExposure.software_lifecycle.lifecycle_owners.opl_packages, 'configured_carrier');

  for (const field of [
    'default_assistants',
    'non_default_assistants',
    'home_purpose_entries',
    'professional_agent_packages',
    'professional_agent_packages_metadata_policy',
  ]) {
    assert.equal(field in guiContract, false, `GUI contract must not carry ${field}`);
  }
  assert.equal('retired_domain_agents' in guiContract, false);
  assert.equal('default_assistants' in productProfile.gui, false);
  assert.equal('non_default_assistants' in productProfile.gui, false);
  assert.equal('home_purpose_entries' in productProfile.gui.home, false);
  assert.equal('professional_agent_packages' in productProfile.gui, false);
  assert.equal('professional_agent_packages_metadata_policy' in productProfile.gui, false);
  for (const field of [
    'opl_app_session_context',
    'default_visible_skills',
    'skill_priority',
    'session_context_lines',
    'session_context_i18n',
  ]) {
    assert.equal(field in productProfile.codex, false, `Product profile must not carry codex.${field}`);
  }
  assert.equal('forbidden_skill_examples' in productProfile.gui.ordinary_capability_selector_policy, false);
  assert.equal(
    productProfile.gui.ordinary_capability_selector_policy.authority,
    'owner_or_carrier_skill_projection_and_mcp_negative_filter',
  );
  assert.deepEqual(productProfile.codex.new_conversation_additional_instructions, {
    content_owner: 'user',
    delivery: 'new_conversation_additional_instructions_only',
    storage_key: 'codex.oplAppSessionContextAdditional',
    storage_key_status: 'legacy_compatibility_storage_key',
    generated_base_context_allowed: false,
    agent_route_fallback_allowed: false,
    empty_value_policy: 'inject_nothing',
    reset_behavior: 'clear_additional_instructions',
    effect: 'next_new_conversation',
  });
  assert.doesNotThrow(() => readAppProductProfile());
  assert.equal('default_assistants' in homeViewModel, false);
  assert.equal('default_assistant_purpose_labels' in homeViewModel, false);
  assert.equal('home_purpose_entries' in homeViewModel, false);

  const restoredGui = structuredClone(guiContract);
  restoredGui.default_assistants = [{ id: 'fixed-package-id' }];
  assert.throws(
    () => validateGuiProductHomeContract(restoredGui),
    /must not restore fixed Agent\/Home presentation field default_assistants/,
  );

  const restoredProfile = structuredClone(productProfile);
  restoredProfile.gui.professional_agent_packages = [];
  assert.throws(
    () => validateProductProfile(restoredProfile, installExposure),
    /must not restore fixed Agent\/Home presentation field gui.professional_agent_packages/,
  );

  const restoredSkillAllowlist = structuredClone(productProfile);
  restoredSkillAllowlist.gui.ordinary_capability_selector_policy.forbidden_skill_examples = ['skill-creator'];
  assert.throws(
    () => validateProductProfile(restoredSkillAllowlist, installExposure),
    /owner\/carrier Skill projection/,
  );

  const restoredSessionContext = structuredClone(productProfile);
  restoredSessionContext.codex.opl_app_session_context = { owner: 'one-person-lab-app' };
  assert.throws(
    () => validateProductProfile(restoredSessionContext, installExposure),
    /must not restore legacy Codex authority codex.opl_app_session_context/,
  );
});

test('one unknown Agent projection covers Settings, Home, Runtime, and projected actions without an App id branch', () => {
  const profile = readJson('contracts/app-product-profile.json');
  const guiContract = readJson('contracts/app-gui-product-contract.json');
  const palettePolicy = profile.gui.ordinary_capability_selector_policy;
  const shortcutPolicy = profile.gui.home.home_agent_shortcuts_metadata_policy;

  assert.equal(
    palettePolicy.palette_agent_catalog_source_ref,
    'app_state.agent_packages.directory.entries[package_role=standard_agent]',
  );
  assert.equal(
    palettePolicy.palette_agent_status_source_ref,
    'app_state.agent_packages.status_index.packages[]',
  );
  assert.equal(
    palettePolicy.palette_unknown_standard_agent_policy,
    'include_without_app_package_id_branch',
  );
  assert.equal(
    guiContract.home_layout.unknown_standard_agent_policy,
    'render_when_default_or_user_preference_visible_without_app_package_id_branch_and_independent_of_installed_state',
  );
  assert.equal(
    guiContract.home_layout.starter_visibility_policy,
    'standard_agent_directory_membership_with_default_or_user_visible_shortcuts_independent_of_installed_state',
  );
  assert.equal(
    shortcutPolicy.shortcut_source_ref,
    'app_state.agent_packages.directory.entries[].home_shortcuts[]',
  );
  assert.equal(shortcutPolicy.package_id_allowlist_allowed, false);

  const appState = unknownAgentFixture.app_state;
  const standardAgents = appState.agent_packages.directory.entries.filter(
    (entry) => entry.package_role === 'standard_agent',
  );
  const status = appState.agent_packages.status_index.packages[syntheticDirectoryEntry.package_id];
  const preference = appState.agent_packages.status_index.home_shortcut_preferences.find(
    (entry) => entry.package_id === syntheticDirectoryEntry.package_id,
  );

  assert.deepEqual(standardAgents.map((entry) => entry.package_id), ['future.agent-lab']);
  assert.equal(standardAgents[0]?.installed, true);
  assert.equal(status?.presence.present, true);
  assert.equal(status?.presence.callable, true);
  assert.equal(status?.presence.reason, null);
  assert.equal(preference?.visible, true);
  assert.equal(preference?.sort_order, 7);
  assert.deepEqual(standardAgents[0]?.available_actions.map((action: any) => action.action_id), [
    'future_agent_inspect',
  ]);
  assert.deepEqual(Object.keys(appState.actions), ['future_agent_inspect']);
  assert.deepEqual(
    appState.operator.workbench.work_item_projection_v2.agent_catalog.map((agent: any) => agent.package_id),
    ['future.agent-lab'],
  );
  assert.deepEqual(
    appState.operator.workbench.work_item_projection_v2.items.map((item: any) => item.agent_id),
    ['future.agent-lab'],
  );
  assert.equal('professional_agent_packages' in profile.gui, false);
});

test('App-owned Agent presentation overlay restoration fails closed', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const invalidProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  invalidProfile.gui.professional_agent_packages_metadata_policy = {};

  assert.throws(
    () => validateProductProfile(invalidProfile, installExposure),
    /must not restore fixed Agent\/Home presentation field gui.professional_agent_packages_metadata_policy/,
  );
});

test('any Package role may project one closed standard App contribution block', () => {
  const schema = readJson('contracts/opl-app-contributions.schema.json');
  const guiContract = readJson('contracts/app-gui-product-contract.json');
  const shellAdapter = readJson('contracts/app-shell-adapter.json');
  const contributionContract = guiContract.framework_surfaces.package_app_contributions;
  const viewTypes = [
    'list_detail',
    'timeline',
    'approval_diff',
    'task_board',
    'artifact_view',
    'activity_log',
  ];

  assert.doesNotThrow(() => validatePackageAppContributionsProductContract(contributionContract));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schema_version.const, 'opl-app-contributions.v1');
  assert.deepEqual(
    schema.anyOf,
    ['navigation', 'views', 'commands', 'badges'].map((collection) => ({
      required: [collection],
      properties: { [collection]: { minItems: 1 } },
    })),
  );
  for (const collection of ['navigation', 'views', 'commands', 'badges']) {
    assert.equal(schema.properties[collection].maxItems, 100);
  }
  assert.equal(schema.$defs.view.properties.command_ids.maxItems, 100);
  assert.equal(schema.$defs.view.properties.badge_ids.maxItems, 100);
  assert.deepEqual(schema.$defs.view.properties.view_type.enum, viewTypes);
  for (const entry of ['navigation', 'view', 'command', 'badge']) {
    assert.equal(schema.$defs[entry].additionalProperties, false);
    for (const forbiddenField of ['component', 'code', 'path', 'url']) {
      assert.equal(forbiddenField in schema.$defs[entry].properties, false);
    }
  }

  assert.equal(contributionContract.package_role_policy, 'role_agnostic_no_package_role_filter');
  assert.equal(
    contributionContract.invalid_block_policy,
    'reject_entire_package_app_contributions_block_and_preserve_other_packages',
  );
  assert.deepEqual(contributionContract.supported_view_types, viewTypes);
  assert.deepEqual(contributionContract.reference_integrity, {
    navigation_view_id: 'must_reference_local_views_view_id',
    view_command_ids: 'must_reference_local_commands_command_id',
  });
  assert.equal(contributionContract.arbitrary_plugin_ui_code_allowed, false);

  assert.ok(shellAdapter.gui_authority.product_contracts.includes('contracts/opl-app-contributions.schema.json'));
  assert.ok(shellAdapter.shell_contract.capabilities.includes('app_owned_package_contribution_contract'));
  assert.deepEqual(shellAdapter.state_surface_contract.package_app_contributions, {
    contract_ref: 'contracts/app-gui-product-contract.json#framework_surfaces.package_app_contributions',
    schema_ref: 'contracts/opl-app-contributions.schema.json',
    source_ref: 'app_state.agent_packages.directory.entries[].app_contributions',
    package_role_filter_allowed: false,
    invalid_block_policy: 'reject_entire_package_app_contributions_block_and_preserve_other_packages',
    arbitrary_plugin_ui_code_allowed: false,
  });
});

test('App contribution product contract rejects role filters, executable UI, and view-type drift', () => {
  const source = readJson('contracts/app-gui-product-contract.json').framework_surfaces.package_app_contributions;

  for (const mutate of [
    (contract: any) => { contract.package_role_policy = 'standard_agent_only'; },
    (contract: any) => { contract.arbitrary_plugin_ui_code_allowed = true; },
    (contract: any) => { contract.supported_view_types.push('custom_react_component'); },
    (contract: any) => { contract.invalid_block_policy = 'filter_invalid_entries_individually'; },
  ]) {
    const invalid = structuredClone(source);
    mutate(invalid);
    assert.throws(
      () => validatePackageAppContributionsProductContract(invalid),
      /role-agnostic|view types/,
    );
  }
});
