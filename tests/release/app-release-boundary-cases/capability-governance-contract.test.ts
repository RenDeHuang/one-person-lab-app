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
  assert.equal(governance.declaration_authority_ref, 'gaofeng21cn/opl-flow:contracts/workflow-policy.json');
  assert.equal(governance.lifecycle_surface, 'opl_framework_package_transaction');
  assert.equal(governance.app_role, 'gui_and_release_frozen_projection_only');
  assert.equal(governance.capability_identity, 'kind_and_id_tuple');
  assert.equal(governance.managed_inventory.app_second_inventory_allowed, false);
  assert.equal(governance.managed_inventory.source, 'framework_unified_capability_projection');
  assert.equal(standard.capability_projection, 'framework_unified_capability_projection');
  assert.equal(full.capability_projection, 'framework_unified_capability_projection');
  assert.equal(full.optional_payload_policy, 'may_bundle_available_compatible_skill_payloads');
  assert.equal(full.missing_optional_payload_blocks_install_or_readiness, false);
  assert.equal(governance.open_composition.carrier_equivalence_required, false);
  assert.equal(governance.open_composition.lock_policy, 'concrete_installation_or_release_result_not_declaration_prerequisite');
  assert.equal(governance.credential_policy.full_may_bundle_secrets, false);
  assert.equal(governance.mcp_policy.undeclared_user_server_policy, 'preserve');
  assert.equal(governance.mcp_policy.undeclared_user_server_delete_or_overwrite_allowed, false);

  const secondInventory = structuredClone(installExposure);
  secondInventory.capability_governance.managed_inventory.app_second_inventory_allowed = true;
  assert.throws(() => validateInstallExposurePolicy(secondInventory), /App-owned managed capability inventory/);

  const requiredPayload = structuredClone(installExposure);
  requiredPayload.installer_surfaces.find((entry: any) => entry.surface === 'full_first_install_dmg')
    .missing_optional_payload_blocks_install_or_readiness = true;
  assert.throws(() => validateInstallExposurePolicy(requiredPayload), /without carrier prerequisites/);
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

test('Full source manifest is a commit-pinned projection and never a second authority', () => {
  const manifest = readJson('contracts/app-full-third-party-source-manifest.json');
  const projection = manifest.projection;
  const sha256 = /^[0-9a-f]{64}$/;

  assert.equal(projection.role, 'release_frozen_projection_not_dependency_authority');
  assert.match(projection.capability_graph.source_commit, /^[0-9a-f]{40}$/);
  assert.match(projection.capability_graph.policy_sha256, sha256);
  assert.match(projection.capability_graph.schema_sha256, sha256);
  assert.equal('dependency_selector' in projection.capability_graph, false);
  assert.equal('offline_carrier_selector' in projection.capability_graph, false);
  assert.match(projection.framework_closure.source_commit, /^[0-9a-f]{40}$/);
  assert.match(projection.framework_closure.release_set_sha256, sha256);
  assert.match(projection.framework_closure.bundled_catalog_sha256, sha256);
  assert.equal(projection.generation_contract.exact_ref_and_digest_binding_required, true);
  assert.equal(projection.generation_contract.framework_lifecycle_receipt_required, true);
  assert.equal(projection.generation_contract.optional_payload_inventory_receipt_required, true);
  assert.equal(manifest.authority_boundary.manifest_is_dependency_authority, false);
  assert.equal(manifest.authority_boundary.source_versions_are_release_frozen_projection, true);
  assert.equal(manifest.authority_boundary.payload_inventory_does_not_define_dependency_closure, true);
  assert.equal(manifest.authority_boundary.missing_optional_skill_payload_blocks_flow_or_app_readiness, false);
  assert.equal(manifest.authority_boundary.credential_values_may_be_bundled, false);
  assert.equal(manifest.authority_boundary.unknown_user_or_third_party_mcp_may_be_removed, false);
});
