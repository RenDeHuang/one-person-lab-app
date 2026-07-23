import {
  assert,
  fs,
  test,
} from './helpers.ts';
import { validateInstallExposurePolicy } from '../../../scripts/validate-active-shell/install-exposure-policy-validator.ts';
import { validateProductProfile } from '../../../scripts/validate-active-shell/product-profile-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

test('Flow, Framework, and App preserve open composition without carrier prerequisites', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const productProfile = readJson('contracts/app-product-profile.json');
  const governance = installExposure.capability_governance;
  const surfaces = new Map(installExposure.installer_surfaces.map((entry: any) => [entry.surface, entry]));
  const standard = surfaces.get('standard_dmg') as any;
  const full = surfaces.get('full_first_install_dmg') as any;

  assert.doesNotThrow(() => validateInstallExposurePolicy(installExposure));
  assert.doesNotThrow(() => validateProductProfile(productProfile, installExposure));
  assert.equal(governance.lifecycle_surface, 'opl_framework_package_transaction');
  assert.equal(governance.app_role, 'gui_and_framework_projection_consumer_only');
  assert.equal(governance.managed_inventory.app_second_inventory_allowed, false);
  assert.equal(governance.managed_inventory.source, 'framework_unified_capability_projection');
  assert.equal('open_composition' in governance, false);
  assert.equal('declaration_authority_ref' in governance, false);
  assert.equal(
    installExposure.exposure_classes.some((entry: any) => entry.id === 'companion_tools_codex_skills'),
    false,
  );
  for (const surface of [standard, full]) {
    assert.equal('capability_target_closure' in surface, false);
    assert.equal('capability_source' in surface, false);
    assert.equal('optional_payload_policy' in surface, false);
  }
  assert.equal(governance.credential_policy.full_may_bundle_secrets, false);
  assert.equal(governance.mcp_policy.undeclared_user_server_policy, 'preserve');
  assert.equal(governance.mcp_policy.undeclared_user_server_delete_or_overwrite_allowed, false);

  const secondInventory = structuredClone(installExposure);
  secondInventory.capability_governance.managed_inventory.app_second_inventory_allowed = true;
  assert.throws(() => validateInstallExposurePolicy(secondInventory), /App-owned managed capability inventory/);

  const requiredPayload = structuredClone(installExposure);
  requiredPayload.installer_surfaces.find((entry: any) => entry.surface === 'full_first_install_dmg')
    .optional_payload_policy = 'required';
  assert.throws(() => validateInstallExposurePolicy(requiredPayload), /must not own Package dependency or payload policy/);
});

test('model precedence makes App defaults a Flow-unavailable fallback only', () => {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const productProfile = readJson('contracts/app-product-profile.json');
  assert.deepEqual(productProfile.codex.auto_model_policy.resolution_precedence, [
    'explicit_user_selection',
    'installed_opl_flow_recommendation',
    'fresh_codex_live_default',
    'app_fallback_when_flow_unavailable',
  ]);
  assert.equal(
    productProfile.codex.auto_model_policy.app_fallback_role,
    'availability_only_when_installed_opl_flow_recommendation_is_unavailable',
  );

  const competingAppDefault = structuredClone(productProfile);
  competingAppDefault.codex.auto_model_policy.resolution_precedence = [
    'explicit_user_selection',
    'app_fallback_when_flow_unavailable',
    'installed_opl_flow_recommendation',
    'fresh_codex_live_default',
  ];
  assert.throws(
    () => validateProductProfile(competingAppDefault, installExposure),
    /user, installed Flow, live Codex, then App fallback precedence/,
  );
});

test('Full source manifest selects inputs without requiring a family lock or payload inventory', () => {
  const manifest = readJson('contracts/app-full-third-party-source-manifest.json');
  const projection = manifest.projection;

  assert.equal(projection.role, 'default_full_build_input_selection');
  assert.equal('capability_graph' in projection, false);
  assert.equal(projection.framework_input.selection, 'workflow_input_framework_ref');
  assert.equal(projection.generation_contract.preexisting_release_set_required, false);
  assert.equal(projection.generation_contract.preexisting_lock_required, false);
  assert.equal(projection.generation_contract.payload_inventory_required, false);
  assert.equal(projection.generation_contract.selected_inputs_recorded_after_resolution, true);
  assert.equal(manifest.authority_boundary.manifest_is_dependency_authority, false);
  assert.equal(manifest.authority_boundary.source_versions_are_default_selection_hints, true);
  assert.equal(manifest.authority_boundary.credential_values_may_be_bundled, false);
  assert.equal(manifest.authority_boundary.unknown_user_or_third_party_mcp_may_be_removed, false);
});
