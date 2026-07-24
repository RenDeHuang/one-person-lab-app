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
