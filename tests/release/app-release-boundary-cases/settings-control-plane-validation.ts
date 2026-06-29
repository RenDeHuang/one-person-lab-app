import {
  assert,
  fs,
  path,
  test,
  appRoot,
  readProductProfile,
} from './helpers.ts';
import {
  buildHydratedSettingsRegistry,
  remapSettingsExtensionAnchor,
  resolveSettingsControlPlaneRoute,
  validateSettingsControlPlane,
} from '../../../scripts/validate-active-shell/settings-control-plane-validator.ts';

test('Settings control-plane validator binds contract, profile, page-state, and shell adapter behavior', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const adapterContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.doesNotThrow(() =>
    validateSettingsControlPlane(controlPlaneContract, guiContract, pageStateMatrix, productProfile, adapterContract),
  );

  const invalidActionRoute = structuredClone(guiContract);
  invalidActionRoute.settings_navigation.settings_ia.protocols.action_catalog.action_route = 'direct shell mutation';
  assert.throws(
    () =>
      validateSettingsControlPlane(
        controlPlaneContract,
        invalidActionRoute,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /App action route/,
  );

  const invalidMatrix = structuredClone(pageStateMatrix);
  invalidMatrix.pages.find((page) => page.id === 'settings_workspace').route_scope = 'ordinary';
  assert.throws(
    () =>
      validateSettingsControlPlane(
        controlPlaneContract,
        guiContract,
        invalidMatrix,
        productProfile,
        adapterContract,
      ),
    /settings_workspace route_scope must be secondary_or_deep_link/,
  );
});

test('Settings control plane hydrates registry, route resolver, and extension anchor remap behavior', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );

  const registry = buildHydratedSettingsRegistry(controlPlaneContract);
  assert.deepStrictEqual(
    registry.ordinary_routes.map((route) => `${route.id}:${route.slot_id}:${route.component_key}`),
    [
      'general:settings_general:OverviewSettings',
      'access:settings_access:AccessSettingsContent',
      'capabilities:settings_capabilities:CapabilitiesSettingsContent',
      'environment:settings_environment:RuntimeSettings',
      'storage:settings_storage:StorageSettings',
      'appearance:settings_theme:AppearanceModalContent',
      'advanced:settings_advanced:SystemModalContent',
    ],
  );
  assert.deepStrictEqual(
    registry.secondary_pages.map((route) => `${route.id}:${route.route_scope}`),
    [
      'about:secondary_or_deep_link',
      'update:secondary_or_deep_link',
      'theme:secondary_or_deep_link',
      'workspace:secondary_or_deep_link',
      'local-services:secondary_or_deep_link',
    ],
  );
  assert.deepStrictEqual(resolveSettingsControlPlaneRoute(controlPlaneContract, 'general'), {
    input: 'general',
    id: 'general',
    target_id: 'general',
    path: '/settings/general',
    route_scope: 'ordinary',
    slot_id: 'settings_general',
    component_key: 'OverviewSettings',
  });
  assert.deepStrictEqual(resolveSettingsControlPlaneRoute(controlPlaneContract, 'workspace'), {
    input: 'workspace',
    id: 'workspace',
    target_id: 'workspace',
    path: '/settings/workspace',
    route_scope: 'secondary_or_deep_link',
    slot_id: 'workspace',
    component_key: null,
  });
  assert.deepStrictEqual(resolveSettingsControlPlaneRoute(controlPlaneContract, 'skills-hub'), {
    input: 'skills-hub',
    id: 'skills-hub',
    target_id: 'capabilities',
    path: '/settings/capabilities?tab=skills',
    route_scope: 'legacy_redirect',
    slot_id: 'settings_capabilities',
    component_key: 'CapabilitiesSettingsContent',
  });
  assert.strictEqual(remapSettingsExtensionAnchor(controlPlaneContract, 'skills-hub'), 'capabilities');
  assert.strictEqual(remapSettingsExtensionAnchor(controlPlaneContract, 'unknown-upstream-anchor'), 'advanced');
});

test('Settings adapter slot and upstream intake classification are machine-readable gates', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const adapterContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.strictEqual(controlPlaneContract.shell_adapter_slot.host_component, 'SettingsHost');
  assert.strictEqual(controlPlaneContract.shell_adapter_slot.adapter_slot, 'SettingsShellAdapterSlot');
  assert.deepStrictEqual(controlPlaneContract.upstream_intake_checklist.allowed_classifications, [
    'accepted',
    'adapt',
    'redirect',
    'reject',
  ]);
  assert.deepStrictEqual(
    adapterContract.implementation_probes.settings_control_plane_shell_adapter_slot.required_evidence,
    [
      'SettingsHost renders ordinary routes from the hydrated App settings registry',
      'SettingsShellAdapterSlot mounts App-owned route slots without shell-owned product IA',
      'legacy route redirects and extension anchor remaps are resolved before shell rendering',
      'AionUI upstream settings intake is classified as accepted/adapt/redirect/reject before registry or slot changes',
    ],
  );

  const invalidAdapter = structuredClone(adapterContract);
  delete invalidAdapter.implementation_probes.settings_control_plane_shell_adapter_slot.slots.SettingsShellAdapterSlot;
  assert.throws(
    () =>
      validateSettingsControlPlane(
        controlPlaneContract,
        guiContract,
        pageStateMatrix,
        productProfile,
        invalidAdapter,
      ),
    /SettingsShellAdapterSlot/,
  );

  const invalidIntake = structuredClone(controlPlaneContract);
  invalidIntake.upstream_intake_checklist.allowed_classifications = ['accepted', 'redirect'];
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidIntake,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /upstream intake classifications/,
  );
});

test('Settings page adapters and visual QA policy are machine-readable gates', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const adapterContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.deepStrictEqual(Object.keys(controlPlaneContract.page_adapter_policy.required_pages), [
    'access',
    'environment',
    'storage',
    'capabilities',
  ]);
  assert.strictEqual(
    controlPlaneContract.page_adapter_policy.required_pages.access.adapter_entry,
    'packages/desktop/src/renderer/pages/settings/accessProjection.ts',
  );
  assert.strictEqual(
    controlPlaneContract.page_adapter_policy.required_pages.environment.adapter_entry,
    'packages/desktop/src/renderer/pages/settings/RuntimeSettings/runtimeSettingsViewModel.ts',
  );
  assert.deepStrictEqual(controlPlaneContract.visual_qa_policy.required_viewports, ['desktop', 'mobile']);
  assert.ok(controlPlaneContract.visual_qa_policy.evidence_command.includes('E2E_SCREENSHOTS=1'));
  assert.deepStrictEqual(controlPlaneContract.visual_qa_policy.does_not_prove, [
    'release readiness',
    'packaged App readiness',
    'runtime currentness',
    'owner acceptance',
  ]);

  const invalidAdapterPolicy = structuredClone(controlPlaneContract);
  delete invalidAdapterPolicy.page_adapter_policy.required_pages.environment;
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidAdapterPolicy,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /required pages/,
  );

  const invalidVisualQaPolicy = structuredClone(controlPlaneContract);
  invalidVisualQaPolicy.visual_qa_policy.does_not_prove = ['release readiness'];
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidVisualQaPolicy,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /non-release evidence boundary/,
  );
});
