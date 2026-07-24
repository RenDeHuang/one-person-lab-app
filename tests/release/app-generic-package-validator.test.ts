import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertProfessionalAgentPackageUxOverrides,
} from '../../scripts/app-product-profile-shared-validators.ts';
import { readAppProductProfile } from '../../scripts/app-product-profile/profile-contract.ts';
import { validateGuiProductHomeContract } from '../../scripts/validate-active-shell/gui-product-home-validator.ts';
import { validateProductProfile } from '../../scripts/validate-active-shell/product-profile-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

const syntheticPackage = {
  package_id: 'community-clinical-agent',
  agent_id: 'community-clinical-route',
  display_name: 'Community Clinical Agent',
  display_name_i18n: {
    'zh-CN': 'Community Clinical Agent zh-CN',
    'en-US': 'Community Clinical Agent',
  },
  description_i18n: {
    'zh-CN': 'A clinical workflow supplied by its Package owner for zh-CN.',
    'en-US': 'A clinical workflow supplied by its Package owner.',
  },
  short_name: 'CCA',
  role: 'owner_defined_clinical_agent',
  package_kind: 'owner_defined_professional_agent_package',
  installed_manageable: true,
  default_home_visible: false,
  codex_visible_entry: 'community-clinical-plugin',
  home_shortcut_ids: ['community-clinical'],
  required_skill_ids: ['owner-required-capability'],
  optional_skill_ids: ['owner-optional-capability'],
  session_routing_summary_i18n: {
    'zh-CN': 'community clinical workflows zh-CN',
    'en-US': 'community clinical workflows',
  },
  required_skill_policy: 'checked_locked',
  optional_skill_policy: 'unchecked_user_selectable',
  skill_menu_policy: 'assistant_scoped_required_checked_optional_visible',
};

function replacePackageAndCapabilityIdentities(contract: any): any {
  const value = structuredClone(contract);
  const gui = value.gui ?? value;
  gui.professional_agent_packages = [syntheticPackage];
  gui.assistant_skill_profiles[0].required_skills = ['owner-profile-required-capability'];
  gui.assistant_skill_profiles[0].optional_skills = ['owner-profile-optional-capability'];
  const homeShortcuts = gui.home?.home_agent_shortcuts ?? gui.home_agent_shortcuts;
  homeShortcuts[0].required_skill_ids = ['owner-shortcut-capability'];
  return value;
}

function clearOptionalAgentMetadata(contract: any): any {
  const value = structuredClone(contract);
  const gui = value.gui ?? value;
  gui.professional_agent_packages = [];
  gui.assistant_skill_profiles = [];
  if (gui.home?.home_agent_shortcuts) {
    gui.home.home_agent_shortcuts = [];
  } else {
    gui.home_agent_shortcuts = [];
  }
  return value;
}

function driftOptionalAgentMetadata(contract: any): any {
  const value = clearOptionalAgentMetadata(contract);
  const gui = value.gui ?? value;
  gui.professional_agent_packages = [{
    ...syntheticPackage,
    package_id: 'display-only-agent',
    agent_id: 'display-only-agent',
  }];
  gui.assistant_skill_profiles = [{
    assistant_id: 'display-only-agent',
    required_skills: ['display-only-required-capability'],
    optional_skills: ['display-only-optional-capability'],
    required_skill_policy: 'checked_locked',
    optional_skill_policy: 'unchecked_user_selectable',
    skill_menu_policy: 'assistant_scoped_required_checked_optional_visible',
  }];
  const shortcuts = [{
    shortcut_id: 'display-only-shortcut',
    package_id: 'display-only-agent',
    agent_id: 'display-only-agent',
    primary_label: 'Display only',
    package_short_name: 'Display',
    codex_visible_entry: 'display-only-agent',
    required_skill_ids: ['display-only-required-capability'],
    source: 'opl_app_home',
    executor: 'codex_cli',
    display_policy: 'purpose_first',
    home_entry_policy: 'visible_click_to_start',
    default_visible: false,
    user_configurable: true,
  }];
  if (gui.home) {
    gui.home.home_agent_shortcuts = shortcuts;
  } else {
    gui.home_agent_shortcuts = shortcuts;
  }
  return value;
}

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

test('professional Agent Package UX validation accepts an unknown Package and opaque capability identities', () => {
  assert.doesNotThrow(() => assertProfessionalAgentPackageUxOverrides(
    [syntheticPackage],
    'Synthetic product profile',
  ));

  const guiContract = replacePackageAndCapabilityIdentities(
    readJson('contracts/app-gui-product-contract.json'),
  );
  assert.doesNotThrow(() => validateGuiProductHomeContract(guiContract));

  const productProfile = replacePackageAndCapabilityIdentities(
    readJson('contracts/app-product-profile.json'),
  );
  assert.doesNotThrow(() => validateProductProfile(
    productProfile,
    readJson('contracts/app-install-exposure-policy.json'),
  ));

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-app-generic-package-validator-'));
  const profilePath = path.join(tempRoot, 'app-product-profile.json');
  try {
    fs.writeFileSync(profilePath, `${JSON.stringify(productProfile, null, 2)}\n`, 'utf8');
    assert.doesNotThrow(() => readAppProductProfile(profilePath));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('professional Agent Package UX validation still rejects malformed presentation overrides', () => {
  const invalid = structuredClone(syntheticPackage);
  invalid.display_name_i18n['en-US'] = '';

  assert.throws(
    () => assertProfessionalAgentPackageUxOverrides([invalid], 'Synthetic product profile'),
    /display_name_i18n must declare non-empty zh-CN and en-US text/,
  );
});

test('fixed Agent, Skill, and Home metadata may be empty without becoming runtime authority', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const guiContract = clearOptionalAgentMetadata(
    readJson('contracts/app-gui-product-contract.json'),
  );
  const productProfile = clearOptionalAgentMetadata(
    readJson('contracts/app-product-profile.json'),
  );

  assert.equal(
    'palette_required_agent_package_ids' in guiContract.ordinary_capability_selector_policy,
    false,
  );
  assert.equal(
    'palette_required_agent_package_ids' in productProfile.gui.ordinary_capability_selector_policy,
    false,
  );
  assert.doesNotThrow(() => validateGuiProductHomeContract(guiContract));
  assert.doesNotThrow(() => validateProductProfile(productProfile, installExposure));
});

test('fixed Agent, Skill, and Home metadata may drift without redefining runtime membership', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  assert.doesNotThrow(() => validateGuiProductHomeContract(
    driftOptionalAgentMetadata(readJson('contracts/app-gui-product-contract.json')),
  ));
  assert.doesNotThrow(() => validateProductProfile(
    driftOptionalAgentMetadata(readJson('contracts/app-product-profile.json')),
    installExposure,
  ));
});

test('an unknown installed standard Agent is admitted by directory, fresh status, and Home preference', () => {
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
    'render_when_installed_and_preference_visible_without_app_package_id_branch',
  );
  assert.equal(
    shortcutPolicy.runtime_authority_ref,
    'app_state.agent_packages.directory.entries[package_role=standard_agent] + app_state.agent_packages.status_index.home_shortcut_preferences[]',
  );

  const appState = {
    agent_packages: {
      directory: { entries: [syntheticDirectoryEntry] },
      status_index: {
        packages: [syntheticStatusProjection],
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
  assert.equal(status?.presence.present, true);
  assert.equal(status?.presence.callable, true);
  assert.equal(preference?.visible, true);
  assert.equal(preference?.sort_order, 7);
  assert.equal(
    profile.gui.professional_agent_packages.some(
      (entry: any) => entry.package_id === syntheticDirectoryEntry.package_id,
    ),
    false,
  );
});

test('malformed optional Agent presentation metadata still fails closed', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const invalidProfile = structuredClone(readJson('contracts/app-product-profile.json'));
  invalidProfile.gui.professional_agent_packages = [{
    ...syntheticPackage,
    display_name_i18n: { 'zh-CN': '', 'en-US': 'Community Clinical Agent' },
  }];

  assert.throws(
    () => validateProductProfile(invalidProfile, installExposure),
    /display_name_i18n must declare non-empty zh-CN and en-US text/,
  );
});
