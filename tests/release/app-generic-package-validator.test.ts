import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { readAppProductProfile } from '../../scripts/app-product-profile/profile-contract.ts';
import { validateGuiProductHomeContract } from '../../scripts/validate-active-shell/gui-product-home-validator.ts';
import { validateProductProfile } from '../../scripts/validate-active-shell/product-profile-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

const syntheticDirectoryEntry = {
  package_id: 'community-clinical-agent',
  display_name: 'Community Clinical Agent',
  description: 'A community supplied clinical workflow.',
  package_role: 'standard_agent',
  installed: true,
  readiness: {
    status: 'available',
    launch_allowed: true,
  },
  recommended_action_ref: null,
  available_actions: [],
};

const syntheticStatusProjection = {
  package_id: syntheticDirectoryEntry.package_id,
  presence: {
    registered: true,
    installed: true,
    present: true,
    callable: true,
    status: 'present',
    reason: null,
  },
};

const syntheticHomeShortcutPreference = {
  package_id: syntheticDirectoryEntry.package_id,
  shortcut_id: 'community-clinical',
  visible: true,
  sort_order: 7,
};

test('App-owned Agent, Skill, and generated session authorities stay absent and cannot be restored', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const guiContract = readJson('contracts/app-gui-product-contract.json');
  const productProfile = readJson('contracts/app-product-profile.json');
  const pageState = readJson('contracts/app-page-state-matrix.json');
  const homeViewModel = pageState.pages.find((page: any) => page.id === 'guid_home').home_view_model;

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

test('an unknown standard Agent remains admitted when Home-visible even if it is not installed', () => {
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
    shortcutPolicy.runtime_authority_ref,
    'app_state.agent_packages.directory.entries[package_role=standard_agent] + app_state.agent_packages.status_index.home_shortcut_preferences[]',
  );

  const unavailableDirectoryEntry = {
    ...syntheticDirectoryEntry,
    installed: false,
    readiness: {
      status: 'unavailable',
      launch_allowed: false,
      reason: 'package_not_installed',
    },
  };
  const unavailableStatusProjection = {
    ...syntheticStatusProjection,
    presence: {
      ...syntheticStatusProjection.presence,
      installed: false,
      present: false,
      callable: false,
      status: 'missing',
      reason: 'package_not_installed',
    },
  };
  const appState = {
    agent_packages: {
      directory: { entries: [unavailableDirectoryEntry] },
      status_index: {
        packages: [unavailableStatusProjection],
        home_shortcut_preferences: [syntheticHomeShortcutPreference],
      },
    },
  };
  const standardAgents = appState.agent_packages.directory.entries.filter(
    (entry) => entry.package_role === 'standard_agent',
  );
  const status = appState.agent_packages.status_index.packages.find(
    (entry) => entry.package_id === syntheticDirectoryEntry.package_id,
  );
  const preference = appState.agent_packages.status_index.home_shortcut_preferences.find(
    (entry) => entry.package_id === syntheticDirectoryEntry.package_id,
  );

  assert.deepEqual(standardAgents.map((entry) => entry.package_id), ['community-clinical-agent']);
  assert.equal(standardAgents[0]?.installed, false);
  assert.equal(status?.presence.present, false);
  assert.equal(status?.presence.callable, false);
  assert.equal(status?.presence.reason, 'package_not_installed');
  assert.equal(preference?.visible, true);
  assert.equal(preference?.sort_order, 7);
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
